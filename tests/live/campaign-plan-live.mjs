#!/usr/bin/env node
/**
 * LIVE campaign-plan check (brief docs/pm/campaign-plan-live-check/BRIEF.md). NOT part of `npm test`
 * (the runner only reads tests/*.test.js and points OLLAMA_URL at a dead port). Run on purpose:
 *
 *   npm run test:campaign-plan
 *
 * Needs Ollama running with the configured model pulled. Uses a throwaway database
 * (.test-tmp/plan-live.db), never the real one. Writes everything it saw to
 * .test-tmp/plan-live-results.json and each plan to .test-tmp/plan-<A|B>.json.
 *
 * It drives the REAL path a player reaches: POST /api/campaign (create) and
 * POST /api/campaign/:id/plan/generate (the route CampaignPlanPage.jsx calls), through the real
 * campaignPlanService, aiCallLogger, llm.js and Ollama. The campaign and character rows are
 * inserted directly (the creator flow is not what this checks).
 *
 * Two runs, different on purpose: A is a plain Sword Coast levels 1-5 seed; B is a different
 * region and level range. Per run it records input, model, latency, token counts (from
 * ai_call_log) and whether the plan came back parsed. It checks structure mechanically against
 * the limits the service's own prompt states; quality is judged by a human reading the plans.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRATCH = path.join(ROOT, '.test-tmp');
fs.mkdirSync(SCRATCH, { recursive: true });
const DB = path.join(SCRATCH, 'plan-live.db');
for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) { try { fs.rmSync(f); } catch { /* fresh */ } }

// Same safety as the test runner: a throwaway database, no session-end backup.
process.env.TURSO_DATABASE_URL = `file:${DB}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.FF_SESSION_END_BACKUP = 'false';

const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { initDatabase, dbRun, dbGet, dbAll } = await imp('server/database.js');
const { default: express } = await import('express');
const { once } = await import('node:events');
const { checkStatus } = await imp('server/services/llm.js');
const { modelFor, contextWindow } = await imp('server/services/localModels.js');

const status = await checkStatus();
if (!status.available) {
  console.error(`Local AI not available: ${status.error}`);
  process.exit(2);
}
console.log(`Ollama ready at ${status.url}; generation model ${modelFor('generation')}; window ${contextWindow()}`);

await initDatabase();
const { default: campaignRoutes } = await imp('server/routes/campaign.js');
const { default: currentPlayer } = await imp('server/middleware/currentPlayer.js');
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(currentPlayer);
app.use('/api/campaign', campaignRoutes);
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;

async function post(p, body) {
  const t0 = Date.now();
  const res = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text, ms: Date.now() - t0 };
}

// Invented test seeds (the handoff: test characters are invented).
const SEEDS = [
  {
    key: 'A',
    label: 'Plain seed: a Sword Coast campaign, levels 1-5',
    campaign: {
      name: 'TEST_PLAN A — The Ember Road',
      description: 'A Sword Coast campaign for levels 1-5. A caravan road between Waterdeep and Baldur\'s Gate has gone quiet, and the party is hired to find out why.',
      setting: 'Forgotten Realms', tone: 'heroic fantasy', starting_location: 'Waterdeep',
    },
    character: {
      name: 'TEST_PLAN Brannoch Vael', race: 'Human', class: 'Fighter', background: 'Soldier', level: 1,
      backstory: 'Brannoch served three years in the Waterdeep city guard under Captain Ilsa Dornwright, who vouched for him when he left. His younger brother Tavin, a caravan driver, stopped writing two months ago.',
    },
  },
  {
    key: 'B',
    label: 'Different seed: Moonsea / Anauroch frontier, levels 5-10',
    campaign: {
      name: 'TEST_PLAN B — The Salt Crown',
      description: 'A dark, slow-burning intrigue campaign for levels 5-10 on the Moonsea shore and the edge of Anauroch. A failing mining town is being quietly bought up by someone who never shows their face.',
      setting: 'Forgotten Realms', tone: 'dark and political', starting_location: 'Mulmaster',
    },
    character: {
      name: 'TEST_PLAN Ysolde Marrek', race: 'Half-Elf', class: 'Warlock', background: 'Criminal', level: 5,
      backstory: 'Ysolde ran contraband salt out of Hillsfar until a patron she has never named paid off her debts. Her old partner, Osric Fenn, took the fall for her and is still in a Zhentarim cell in Zhentil Keep.',
    },
  },
];

const results = { model: modelFor('generation'), window: contextWindow(), started: new Date().toISOString(), runs: [] };

function textOf(v) { return typeof v === 'string' ? v : JSON.stringify(v ?? ''); }
function analyse(plan, seed) {
  const a = { problems: [] };
  const count = (k) => Array.isArray(plan?.[k]) ? plan[k].length : 0;
  a.counts = {
    acts: plan?.main_quest?.acts?.length ?? 0,
    world_events: plan?.world_timeline?.events?.length ?? 0,
    npcs: count('npcs'), potential_companions: count('potential_companions'), locations: count('locations'),
    merchants: count('merchants'), factions: count('factions'), side_quests: count('side_quests'),
    themes: count('themes'), faction_tensions: plan?.world_state?.faction_tensions?.length ?? 0,
  };
  // Limits the service's own prompt states (rules 5, 9, 10).
  const lim = [['acts', 1, 3], ['world_events', 5, 99], ['npcs', 6, 8], ['potential_companions', 3, 4], ['locations', 5, 6], ['factions', 3, 4], ['side_quests', 4, 5]];
  a.limits = Object.fromEntries(lim.map(([k, lo, hi]) => [k, { got: a.counts[k], want: `${lo}-${hi === 99 ? '+' : hi}`, ok: a.counts[k] >= lo && a.counts[k] <= hi }]));
  // The parser silently substitutes defaults for a missing section.
  if (plan?.main_quest?.title === 'Untitled Quest' || !plan?.main_quest?.summary) a.problems.push('main_quest missing or defaulted (parser fallback)');
  for (const k of ['npcs', 'locations', 'factions', 'side_quests', 'potential_companions']) if (!count(k)) a.problems.push(`${k} empty`);
  if (!plan?.dm_notes || !Object.keys(plan.dm_notes).length) a.problems.push('dm_notes empty');
  // Cross references: act NPCs / locations must exist in the plan; merchant locations too.
  const npcNames = new Set((plan?.npcs || []).map((n) => String(n.name || '').toLowerCase()));
  const locNames = new Set((plan?.locations || []).map((n) => String(n.name || '').toLowerCase()));
  const missingNpc = [], missingLoc = [];
  for (const act of plan?.main_quest?.acts || []) {
    for (const n of act.key_npcs || []) if (!npcNames.has(String(n).toLowerCase())) missingNpc.push(`${n} (act ${act.act_number})`);
    for (const l of act.key_locations || []) if (!locNames.has(String(l).toLowerCase())) missingLoc.push(`${l} (act ${act.act_number})`);
  }
  a.act_npcs_not_in_plan = missingNpc;
  a.act_locations_not_in_plan = missingLoc;
  a.merchant_locations_not_in_plan = (plan?.merchants || []).filter((m) => m.location && !locNames.has(String(m.location).toLowerCase())).map((m) => `${m.name} @ ${m.location}`);
  // Backstory use: the prompt requires backstory NPCs to appear with from_backstory true.
  const bs = seed.character.backstory;
  const named = [...bs.matchAll(/\b([A-Z][a-z]+(?: [A-Z][a-z]+)+)\b/g)].map((m) => m[1]).filter((n) => !/^(Waterdeep|Hillsfar|Zhentil Keep|Zhentarim)/.test(n));
  a.backstory_names_seen = named;
  const all = textOf(plan).toLowerCase();
  a.backstory_names_used = Object.fromEntries(named.map((n) => [n, all.includes(n.toLowerCase())]));
  a.from_backstory_npcs = (plan?.npcs || []).filter((n) => n.from_backstory === true).map((n) => n.name);
  // Alignment spread (prompt rule 12: at most 2-3 good-aligned of 6-8).
  const spread = {};
  for (const n of plan?.npcs || []) spread[n.alignment || '(none)'] = (spread[n.alignment || '(none)'] || 0) + 1;
  a.npc_alignment_spread = spread;
  a.npc_good_count = (plan?.npcs || []).filter((n) => /_good$/.test(n.alignment || '')).length;
  // Input fidelity: the plan should mention the seed's region/start and nothing contradicting it.
  a.mentions_start_location = all.includes(seed.campaign.starting_location.toLowerCase());
  // Empty-string leaf count (filler / truncation signal).
  let empties = 0, leaves = 0;
  (function walk(v) { if (v == null) return; if (typeof v === 'string') { leaves++; if (!v.trim()) empties++; } else if (Array.isArray(v)) v.forEach(walk); else if (typeof v === 'object') Object.values(v).forEach(walk); })(plan);
  a.leaf_strings = leaves; a.empty_strings = empties;
  a.json_chars = JSON.stringify(plan).length;
  return a;
}

for (const seed of SEEDS) {
  console.log(`\n=== Run ${seed.key}: ${seed.label} ===`);
  const created = await post('/api/campaign', seed.campaign);
  if (created.status !== 201 || !created.json?.id) {
    console.error('campaign create failed', created.status, created.text.slice(0, 300));
    results.runs.push({ key: seed.key, error: `campaign create ${created.status}: ${created.text.slice(0, 300)}` });
    continue;
  }
  const campaignId = created.json.id;
  const ch = seed.character;
  const ins = await dbRun(
    `INSERT INTO characters (name, class, race, level, background, backstory, current_hp, max_hp, current_location,
       experience_to_next_level, campaign_id, game_day, game_year, ability_scores)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ch.name, ch.class, ch.race, ch.level, ch.background, ch.backstory, 12 + ch.level * 6, 12 + ch.level * 6, seed.campaign.starting_location,
      900, campaignId, 1, 1492, JSON.stringify({ str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 10 })]
  );
  const characterId = Number(ins.lastInsertRowid);

  const run = { key: seed.key, label: seed.label, input: { campaign: seed.campaign, character: { ...ch } }, campaignId, characterId };
  console.log('POST /api/campaign/' + campaignId + '/plan/generate …');
  const gen = await post(`/api/campaign/${campaignId}/plan/generate`, { character_id: characterId });
  run.http_status = gen.status;
  run.wall_ms = gen.ms;
  console.log(`  HTTP ${gen.status} in ${(gen.ms / 1000).toFixed(1)} s`);

  const log = await dbGet(
    `SELECT id, model_id, latency_ms, input_tokens, output_tokens, response_status, response_error, length(response_text) AS response_chars, metadata
       FROM ai_call_log WHERE campaign_id = ? AND call_purpose = 'campaign_plan_gen' ORDER BY id DESC LIMIT 1`, [campaignId]);
  run.ai_call_log = log;
  const raw = await dbGet(`SELECT response_text FROM ai_call_log WHERE id = ?`, [log?.id ?? -1]);
  if (raw?.response_text) fs.writeFileSync(path.join(SCRATCH, `plan-${seed.key}-raw.txt`), raw.response_text);

  if (gen.status === 200 && gen.json) {
    const stored = await dbGet('SELECT campaign_plan FROM campaigns WHERE id = ?', [campaignId]);
    run.stored_plan_matches_response = !!stored?.campaign_plan && stored.campaign_plan === JSON.stringify(gen.json);
    run.analysis = analyse(gen.json, seed);
    run.merchants_rows = (await dbAll('SELECT COUNT(*) AS n FROM merchant_inventories WHERE campaign_id = ?', [campaignId]).catch(() => [{ n: 'n/a' }]))[0]?.n;
    fs.writeFileSync(path.join(SCRATCH, `plan-${seed.key}.json`), JSON.stringify(gen.json, null, 2));
    console.log('  counts:', JSON.stringify(run.analysis.counts));
    console.log('  problems:', run.analysis.problems.length ? run.analysis.problems.join('; ') : 'none');
  } else {
    run.error_body = gen.text.slice(0, 1200);
    console.log('  FAILED:', run.error_body.slice(0, 300));
  }
  results.runs.push(run);
}

results.finished = new Date().toISOString();
fs.writeFileSync(path.join(SCRATCH, 'plan-live-results.json'), JSON.stringify(results, null, 2));
console.log(`\nWrote ${path.join(SCRATCH, 'plan-live-results.json')}`);
server.close();
process.exit(0);
