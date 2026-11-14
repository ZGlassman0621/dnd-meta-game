#!/usr/bin/env node
/**
 * LIVE local-model check — the local model's acceptance run. NOT part of
 * `npm test` (the runner only reads tests/*.test.js, and it points OLLAMA_URL
 * at a dead port so no test can reach a model). Run on purpose:
 *
 *   npm run test:leak
 *
 * Needs Ollama running with the configured model pulled. Uses a throwaway
 * database (.test-tmp/live.db), never the real one. Writes everything it saw
 * to .test-tmp/live-results.json.
 *
 * What it runs, all through the REAL game path (the real Express routes, the
 * real DM system prompt, llm.js, Ollama):
 *
 *  A. The secret-holding leak test (brief docs/pm/local-model-only/BRIEF.md,
 *     item 7). Tomas the merchant survived a road attack; his secret has three
 *     facts: grey-skinned raiders, a red banner, a broken bridge. The secret is
 *     held where the system holds an NPC secret — the npcs.secret field, which
 *     the DM prompt renders as "Secret (reveal gradually if appropriate)".
 *     Three exchanges: neutral ask → press with 5 gold → ask directly.
 *     Pass bar per run: reply 1 reveals 0 facts; reply 2 reveals ≤1 fact; no
 *     reply reveals all 3. The test passes if ≥2 of 3 runs meet the bar.
 *     Facts are counted by pattern AND every reply is printed verbatim for a
 *     human check — the report carries the human count.
 *
 *  B. Measurements (brief item 5): DM system-prompt size (chars/4 estimate AND
 *     Ollama's real prompt_eval_count), structured-output reliability on six
 *     marker-eliciting turns + a chronicle extraction at session end, and
 *     per-turn latency — read from ai_call_log, which the game writes anyway.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRATCH = path.join(ROOT, '.test-tmp');
fs.mkdirSync(SCRATCH, { recursive: true });
const DB = path.join(SCRATCH, 'live.db');
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
const { estimateTokens } = await imp('server/utils/contextManager.js');

const status = await checkStatus();
if (!status.available) {
  console.error(`Local AI not available: ${status.error}`);
  process.exit(2);
}
console.log(`Ollama ready at ${status.url}; DM model ${modelFor('dm')}; window ${contextWindow()}`);

await initDatabase();
const { default: dmSessionRoutes } = await imp('server/routes/dmSession.js');
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/api/dm-session', dmSessionRoutes);
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
async function post(p, body) {
  const t0 = Date.now();
  const res = await fetch(`${base}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: json, ms: Date.now() - t0 };
}

// ── Fixtures (invented test characters; TEST_LIVE prefix) ─────────────────
async function seedCharacter(name) {
  const camp = await dbRun('INSERT INTO campaigns (name, setting, status) VALUES (?, ?, ?)', [`TEST_LIVE ${name} Campaign`, 'Forgotten Realms', 'active']);
  const campaignId = Number(camp.lastInsertRowid);
  const ch = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location,
       experience_to_next_level, campaign_id, game_day, game_year, ability_scores, gold_gp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, 'Fighter', 'Human', 3, 28, 28, 'Ashford', 900, campaignId, 120, 1492,
      JSON.stringify({ str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 }), 40]
  );
  return { campaignId, characterId: Number(ch.lastInsertRowid) };
}
async function seedTomas() {
  const r = await dbRun(
    `INSERT INTO npcs (name, race, gender, occupation, occupation_category, current_location,
       relationship_to_party, personality_trait_1, personality_trait_2, motivation, secret,
       background_notes, campaign_availability)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Tomas', 'Human', 'male', 'Travelling merchant', 'merchant', 'The Drowned Rat, Ashford',
      'neutral', 'frightened', 'drinking to steady his nerves',
      'To forget the road and get drunk enough to sleep tonight.',
      'His wagon was attacked on the road two days ago by grey-skinned raiders who rode under a red banner. It happened at the broken bridge on the river road.',
      'Survived an attack on the road. He is frightened, drinking, and does not want to talk about it.',
      'available']
  );
  return dbGet('SELECT * FROM npcs WHERE id = ?', [Number(r.lastInsertRowid)]);
}

const STARTING_LOCATION = { name: 'The Drowned Rat', description: 'A dim riverside tavern in the village of Ashford. A shaken merchant, Tomas, sits alone near the fire with a cup of wine.', region: 'Sword Coast' };

// ── Fact detection (pattern count; the report carries the human count) ────
const FACTS = {
  grey_skin: /\b(gr[ae]y|ashen|ash-gr[ae]y|slate)[- ]?(skinned|skins?|flesh|hides?|faces?)\b|\bskin (the colou?r of|like) (ash|stone|slate|grey|gray)\b/i,
  red_banner: /\b(red|crimson|scarlet|blood[- ]red)\b[^.!?\n]{0,40}\b(banner|flag|standard|pennant|colou?rs)\b|\b(banner|flag|standard|pennant)\b[^.!?\n]{0,40}\b(red|crimson|scarlet)\b/i,
  broken_bridge: /\b(broken|collapsed|ruined|shattered|fallen|washed[- ]out|half[- ]fallen)\b[^.!?\n]{0,30}\bbridge\b|\bbridge\b[^.!?\n]{0,30}\b(broken|collapsed|out|down|gone|fell)\b/i,
};
const factsIn = (text) => Object.entries(FACTS).filter(([, re]) => re.test(text || '')).map(([k]) => k);

const LEAK_SCRIPT = [
  'I sit down across from Tomas and ask him, gently, what happened on the road. Who attacked you?',
  'I slide 5 gold pieces across the table to him. "Please, Tomas. Who were they?"',
  'I lean in. "Tomas. I need to know. Who attacked you?"',
];

const results = { model: modelFor('dm'), window: contextWindow(), started: new Date().toISOString(), leak: [], markers: null };

async function turnMeta(sessionId) {
  const rows = await dbAll(
    `SELECT call_purpose, latency_ms, input_tokens, output_tokens, model_id, metadata, markers_detected, marker_failures, system_prompt
       FROM ai_call_log WHERE session_id = ? AND call_purpose = 'gameplay_turn' ORDER BY id`, [sessionId]);
  return rows.map((r) => ({
    latency_ms: r.latency_ms,
    prompt_tokens_ollama: r.input_tokens,
    output_tokens: r.output_tokens,
    model: r.model_id,
    role: (() => { try { return JSON.parse(r.metadata || '{}').role; } catch { return null; } })(),
    system_chars: r.system_prompt ? r.system_prompt.length : null,
    system_tokens_estimate: r.system_prompt ? estimateTokens(r.system_prompt) : null,
    markers_detected: r.markers_detected ? JSON.parse(r.markers_detected) : {},
    marker_failures: r.marker_failures ? JSON.parse(r.marker_failures) : [],
  }));
}

// ── A. Leak test: 3 runs ──────────────────────────────────────────────────
for (let run = 1; run <= 3; run++) {
  console.log(`\n=== Leak test run ${run}/3 ===`);
  const { characterId } = await seedCharacter(`TEST_LIVE Hero ${run}`);
  const tomas = await seedTomas();
  const start = await post('/api/dm-session/start', {
    characterId, startingLocation: STARTING_LOCATION, customNpcs: [tomas], campaignLength: 'one-shot',
  });
  if (start.status !== 200) { console.error('start failed', start.status, start.body); process.exit(3); }
  const sessionId = start.body.sessionId;
  const openingRow = await dbGet(`SELECT latency_ms, input_tokens, system_prompt FROM ai_call_log WHERE call_purpose = 'session_start' ORDER BY id DESC LIMIT 1`);
  const runOut = {
    run, sessionId,
    opening: start.body.openingNarrative,
    opening_ms: start.ms,
    opening_prompt_tokens_ollama: openingRow?.input_tokens ?? null,
    opening_system_tokens_estimate: openingRow?.system_prompt ? estimateTokens(openingRow.system_prompt) : null,
    secret_in_prompt: /Secret \(reveal gradually if appropriate\): His wagon was attacked/.test(openingRow?.system_prompt || ''),
    exchanges: [],
  };
  console.log(`opening (${start.ms} ms): ${String(start.body.openingNarrative).slice(0, 160)}…`);
  for (let i = 0; i < LEAK_SCRIPT.length; i++) {
    const r = await post(`/api/dm-session/${sessionId}/message`, { action: LEAK_SCRIPT[i] });
    const text = r.body?.narrative ?? r.body?.response ?? JSON.stringify(r.body);
    const facts = factsIn(text);
    runOut.exchanges.push({ n: i + 1, action: LEAK_SCRIPT[i], status: r.status, ms: r.ms, reply: text, facts_auto: facts,
      has_quoted_dialogue: /["“][^"”]{3,}["”]/.test(text || ''), names_tomas: /\bTomas\b/.test(text || '') });
    console.log(`  reply ${i + 1} (${r.ms} ms, status ${r.status}) facts=${facts.join(',') || 'none'}`);
  }
  const [r1, r2] = runOut.exchanges;
  const anyAll3 = runOut.exchanges.some((e) => e.facts_auto.length === 3);
  runOut.pass_auto = r1.facts_auto.length === 0 && r2.facts_auto.length <= 1 && !anyAll3;
  runOut.turns = await turnMeta(sessionId);
  results.leak.push(runOut);
  console.log(`  run ${run}: ${runOut.pass_auto ? 'PASS' : 'FAIL'} (pattern count)`);
}
results.leak_pass_auto = results.leak.filter((r) => r.pass_auto).length >= 2;

// ── B. Markers + chronicle ────────────────────────────────────────────────
console.log('\n=== Marker reliability session ===');
const { characterId: mChar } = await seedCharacter('TEST_LIVE Marker Hero');
const mStart = await post('/api/dm-session/start', {
  characterId: mChar,
  startingLocation: { name: 'Ashford crossroads', description: 'A muddy crossroads village with a general store, a tavern and a road east into the hills.', region: 'Sword Coast' },
  campaignLength: 'one-shot',
});
if (mStart.status !== 200) { console.error('marker start failed', mStart.status, mStart.body); process.exit(4); }
const mSession = mStart.body.sessionId;
const MARKER_CASES = [
  { expect: 'MERCHANT_SHOP', action: 'I walk into the general store and ask the shopkeeper what she has for sale.' },
  { expect: 'TIME_ADVANCE', action: 'I leave the store and wait by the crossroads for two hours, watching the road.' },
  { expect: 'COMBAT_START', action: 'Two bandits step out of the trees with drawn knives. I draw my longsword and attack the nearest one!' },
  { expect: 'LOOT_DROP', action: 'The fight is over. I search the fallen bandits for anything of value.' },
  { expect: 'EAT', action: 'I sit on a stump and eat one of my travel rations.' },
  { expect: 'REST', action: 'I make camp off the road and take a long rest, sleeping through the night.' },
];
const markerOut = [];
for (const c of MARKER_CASES) {
  const r = await post(`/api/dm-session/${mSession}/message`, { action: c.action });
  const meta = (await turnMeta(mSession)).at(-1) || {};
  const detected = meta.markers_detected || {};
  const ok = !!detected[c.expect] && (meta.marker_failures || []).length === 0;
  markerOut.push({ ...c, status: r.status, ms: r.ms, detected, failures: meta.marker_failures || [], pass: ok,
    reply: r.body?.narrative ?? r.body?.response ?? JSON.stringify(r.body) });
  console.log(`  ${c.expect}: ${ok ? 'PASS' : 'FAIL'} detected=${JSON.stringify(detected)} failures=${(meta.marker_failures || []).length} (${r.ms} ms)`);
}
const end = await post(`/api/dm-session/${mSession}/end`, {});
console.log(`  session end: status ${end.status} (${end.ms} ms)`);
const chronicle = await dbGet('SELECT * FROM story_chronicles WHERE session_id = ? ORDER BY id DESC LIMIT 1', [mSession]).catch(() => null);
const extractionCalls = await dbAll(
  `SELECT call_purpose, response_status, latency_ms, input_tokens, output_tokens, metadata FROM ai_call_log
     WHERE (session_id = ? OR call_purpose = 'chronicle_extraction') ORDER BY id`, [mSession]);
results.markers = {
  sessionId: mSession,
  cases: markerOut,
  pass_count: markerOut.filter((m) => m.pass).length,
  end_status: end.status,
  end_ms: end.ms,
  chronicle_written: !!chronicle,
  chronicle_summary: chronicle?.summary || null,
  session_end_calls: extractionCalls.map((c) => ({ purpose: c.call_purpose, status: c.response_status, ms: c.latency_ms,
    in: c.input_tokens, out: c.output_tokens, role: (() => { try { return JSON.parse(c.metadata || '{}').role; } catch { return null; } })() })),
  turns: await turnMeta(mSession),
};
console.log(`  chronicle written: ${!!chronicle}`);

results.finished = new Date().toISOString();
fs.writeFileSync(path.join(SCRATCH, 'live-results.json'), JSON.stringify(results, null, 2));
console.log(`\nLeak test (pattern count): ${results.leak.filter((r) => r.pass_auto).length}/3 runs pass → ${results.leak_pass_auto ? 'PASS' : 'FAIL'}`);
console.log(`Markers: ${results.markers.pass_count}/${MARKER_CASES.length}; chronicle written: ${results.markers.chronicle_written}`);
console.log('Full output: .test-tmp/live-results.json');
server.close();
process.exit(0);
