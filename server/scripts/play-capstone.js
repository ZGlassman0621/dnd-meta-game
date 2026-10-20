#!/usr/bin/env node
/**
 * Playable Capstone — human-in-the-loop combat acceptance test.
 *
 * The automated capstone (tests/capstone-combat.test.js) proves the combat
 * MATH: it calls the services directly and asserts exact accounting. It
 * cannot prove the GAME: whether the AI emits the right markers in live
 * conditions, whether the narration matches the mechanical outcome, whether
 * companions act on their own initiative, whether combat feels like combat.
 * That takes a human playing the player. This harness is that test.
 *
 * What it does:
 *   1. Seeds the capstone scenario (L3 caster + Lyra the ranger + campaign)
 *      into a throwaway database. The companion goes through the real
 *      enrichNewCompanion() so her hidden agenda is rolled mechanically,
 *      exactly as in production recruitment.
 *   2. Boots the REAL server (server/index.js) against that database on a
 *      scratch port and drives it over HTTP, the same way the UI does.
 *      Your configured LLM provider DMs — same voice as real play.
 *   3. You type natural-language actions. After every exchange a watcher
 *      re-reads the database and checks the invariants the automated
 *      capstone asserts (HP bounds, slot accounting, no mid-combat XP,
 *      death events matching dead enemies, sane turn state), plus soft
 *      warnings when the narration claims something the math never did.
 *   4. /end runs the real session-end flow (XP scoring included) and the
 *      harness prints a final divergence report.
 *
 * Usage:
 *   node server/scripts/play-capstone.js           — play the scenario
 *   node server/scripts/play-capstone.js --smoke   — hands-free: 3 canned
 *       actions + session end; verifies your LLM setup and the pipeline
 *   node server/scripts/play-capstone.js --keep    — keep the scenario DB
 *       afterwards (path printed) for post-mortem inspection
 *
 * In-game commands: /state (mechanical snapshot), /report (divergences so
 * far), /end (end session properly, with XP), /quit (stop, no session end).
 *
 * Deliberately NOT checked: prose quality and playbook discipline (echoed
 * phrasing, narrated internal states, summation sentences). Those are yours
 * to judge while playing — no assertion can see them. Note them; they are
 * findings too.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SMOKE = process.argv.includes('--smoke');
const KEEP = process.argv.includes('--keep');
const PORT = Number(process.env.PLAY_CAPSTONE_PORT || 3109);
const BASE = `http://localhost:${PORT}`;

// ---------------------------------------------------------------------------
// Phase 0 — point the database layer at a throwaway file BEFORE importing any
// server code. (Same lesson as the test-isolation fix: database.js prefers
// TURSO_DATABASE_URL over everything, so we claim it first. dotenv, loaded
// later by both this process and the server child, never overrides a
// variable that is already set.)
// ---------------------------------------------------------------------------
const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-play-capstone-'));
const DB_FILE = path.join(dbDir, 'play.db');
process.env.TURSO_DATABASE_URL = `file:${DB_FILE}`;
process.env.TURSO_AUTH_TOKEN = '';

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------
const say = (s = '') => console.log(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, route, body, timeoutMs = 30000) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* leave null */ }
  return { status: res.status, json, text };
}

// ---------------------------------------------------------------------------
// Phase 1 — seed the scenario (in-process; migrations run here first so the
// server boots against a ready database)
// ---------------------------------------------------------------------------
say('Seeding the capstone scenario…');
const { initDatabase, dbRun, dbGet, dbAll } = await import(
  pathToFileURL(path.join(REPO, 'server', 'database.js')).href
);
await initDatabase();

/** PRAGMA-driven insert (same pattern as the test fixtures). */
async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = [];
  const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(overrides, c.name)) {
      cols.push(c.name);
      vals.push(overrides[c.name]);
      continue;
    }
    if (c.notnull && c.dflt_value == null) {
      const t = (c.type || '').toUpperCase();
      cols.push(c.name);
      vals.push(t.includes('INT') ? 1 : `PLAYTEST_${c.name}`);
    }
  }
  const r = await dbRun(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    vals
  );
  return Number(r.lastInsertRowid);
}

const campaignId = await insertRow('campaigns', {
  name: 'Playtest — Goblin Ambush',
  setting: 'Forgotten Realms',
  status: 'active',
});

const pcId = await insertRow('characters', {
  name: 'Playtest Hero',
  class: 'Wizard',
  race: 'Human',
  level: 3,
  current_hp: 30,
  max_hp: 30,
  armor_class: 14,
  ability_scores: JSON.stringify({
    strength: 10, dexterity: 14, constitution: 8,
    intelligence: 16, wisdom: 12, charisma: 10,
  }),
  spell_slots: JSON.stringify({ 1: 2, 2: 1 }),
  spell_slots_used: JSON.stringify({}),
  current_location: "The Miller's Road",
  campaign_id: campaignId,
});

const lyraNpcId = await insertRow('npcs', {
  name: 'Lyra',
  race: 'Human',
  gender: 'female',
  occupation: 'Ranger',
});
const companionId = await insertRow('companions', {
  npc_id: lyraNpcId,
  recruited_by_character_id: pcId,
  companion_class: 'Ranger',
  companion_level: 3,
  companion_max_hp: 26,
  companion_current_hp: 26,
  armor_class: 15,
  status: 'active',
});

// Real recruitment enrichment: mechanical hidden-agenda roll, relationship
// seed, one private fact. No llmCall — agenda content defers to session
// start, exactly as in the production recruit path.
try {
  const { enrichNewCompanion } = await import(
    pathToFileURL(path.join(REPO, 'server', 'services', 'companionInitiativeService.js')).href
  );
  await enrichNewCompanion(companionId, { background: 'Border scout; knows these woods.' });
} catch (e) {
  say(`  (companion enrichment skipped: ${e.message})`);
}

// Best-effort spellbook: seed known spells if the table exists, so the DM
// prompt can offer them. The SPELL_CAST path validates against the spell
// catalog by name either way, so a miss here is cosmetic.
try {
  const tbl = await dbGet(`SELECT name FROM sqlite_master WHERE type='table' AND name='character_spells'`);
  if (tbl) {
    for (const spell of ['Magic Missile', 'Bless', 'Fire Bolt', 'Cure Wounds']) {
      await insertRow('character_spells', { character_id: pcId, spell_name: spell, name: spell });
    }
  }
} catch (e) {
  say(`  (spellbook seed skipped: ${e.message})`);
}

const pcBaseline = await dbGet('SELECT experience FROM characters WHERE id = ?', [pcId]);
const XP_AT_START = pcBaseline?.experience ?? 0;
say(`  Scenario ready: campaign ${campaignId}, PC ${pcId}, companion ${companionId} (Lyra).`);

// ---------------------------------------------------------------------------
// Phase 2 — boot the real server against the scenario database
// ---------------------------------------------------------------------------
say(`Booting the server on port ${PORT}…`);
const serverLog = [];
const server = spawn(process.execPath, [path.join(REPO, 'server', 'index.js')], {
  cwd: REPO,
  env: {
    ...process.env,
    PORT: String(PORT),
    TURSO_DATABASE_URL: `file:${DB_FILE}`,
    TURSO_AUTH_TOKEN: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverExited = false;
server.on('exit', (code) => { serverExited = true; serverLog.push(`[server exited: ${code}]`); });
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', (d) => {
    for (const line of String(d).split('\n')) {
      if (line.trim()) serverLog.push(line);
      if (serverLog.length > 300) serverLog.shift();
    }
  });
}

let serverUp = false;
for (let i = 0; i < 180 && !serverExited; i++) {
  try {
    const h = await api('GET', '/api/health', null, 3000);
    if (h.status === 200) { serverUp = true; break; }
  } catch { /* not up yet */ }
  await sleep(500);
}
if (!serverUp) {
  say('Server did not come up. Last log lines:');
  for (const l of serverLog.slice(-30)) say(`  ${l}`);
  process.exit(1);
}

// Preflight: is there a DM at all?
const llm = await api('GET', '/api/dm-session/llm-status');
if (!llm.json || !llm.json.provider) {
  say('No LLM provider is available — the DM cannot narrate. Check your .env / Ollama setup, then re-run.');
  server.kill('SIGTERM');
  process.exit(1);
}
say(`  DM provider: ${llm.json.provider}${llm.json.model ? ` (${llm.json.model})` : ''}`);

// ---------------------------------------------------------------------------
// Phase 3 — the watcher. An independent libsql client on the same file;
// reads happen between turns, when the server is idle. Every check mirrors
// an invariant the automated capstone asserts.
// ---------------------------------------------------------------------------
const { createClient } = await import('@libsql/client');
const watch = createClient({ url: `file:${DB_FILE}` });
async function wAll(sql, args = []) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await watch.execute({ sql, args });
      return r.rows;
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(150);
    }
  }
  return [];
}
const wGet = async (sql, args = []) => (await wAll(sql, args))[0] || null;

const violations = [];
const warnings = [];
let sessionId = null;
let prevPcHp = 30;
let prevDeadCount = 0;

async function checkInvariants(turnLabel, narrative) {
  const v = [];
  const w = [];
  try {
    const pc = await wGet(
      'SELECT current_hp, max_hp, temp_hp, experience, level, spell_slots, spell_slots_used FROM characters WHERE id = ?',
      [pcId]
    );
    if (!pc) { v.push('PC row missing'); return { v, w }; }
    if (!(pc.current_hp >= 0 && pc.current_hp <= pc.max_hp)) {
      v.push(`PC HP out of bounds: ${pc.current_hp}/${pc.max_hp}`);
    }
    if ((pc.temp_hp ?? 0) < 0) v.push(`PC temp_hp negative: ${pc.temp_hp}`);
    if (pc.level !== 3) v.push(`PC level changed mid-session: ${pc.level}`);
    if (sessionId && pc.experience !== XP_AT_START) {
      v.push(`XP changed mid-session: ${XP_AT_START} -> ${pc.experience} (session-end XP must be the only source)`);
    }
    let slots = {}; let used = {};
    try { slots = JSON.parse(pc.spell_slots || '{}'); } catch { v.push('spell_slots is not valid JSON'); }
    try { used = JSON.parse(pc.spell_slots_used || '{}'); } catch { v.push('spell_slots_used is not valid JSON'); }
    for (const [lvl, n] of Object.entries(used)) {
      if (n < 0 || n > (slots[lvl] ?? 0)) v.push(`slot accounting broken at level ${lvl}: used ${n} of ${slots[lvl] ?? 0}`);
    }

    const comp = await wGet(
      'SELECT companion_current_hp, companion_max_hp FROM companions WHERE id = ?',
      [companionId]
    );
    if (comp && !(comp.companion_current_hp >= 0 && comp.companion_current_hp <= comp.companion_max_hp)) {
      v.push(`Lyra HP out of bounds: ${comp.companion_current_hp}/${comp.companion_max_hp}`);
    }

    if (sessionId) {
      const enemies = await wAll(
        'SELECT name, current_hp, max_hp, status FROM combat_enemies WHERE session_id = ?',
        [sessionId]
      );
      for (const e of enemies) {
        if (!(e.current_hp >= 0 && e.current_hp <= e.max_hp)) {
          v.push(`enemy ${e.name} HP out of bounds: ${e.current_hp}/${e.max_hp}`);
        }
      }
      const deadCount = enemies.filter((e) => e.status === 'dead').length;
      const events = await wAll(
        'SELECT xp_awarded FROM combat_death_events WHERE session_id = ?',
        [sessionId]
      );
      if (deadCount !== events.length) {
        v.push(`dead enemies (${deadCount}) != death events (${events.length})`);
      }
      if (events.some((e) => e.xp_awarded)) {
        v.push('a death event awarded XP mid-combat (kill-XP must stay removed)');
      }
      const ts = await wGet(
        'SELECT turn_order_json, current_index, round_number FROM combat_turn_state WHERE session_id = ? ORDER BY encounter_seq DESC LIMIT 1',
        [sessionId]
      );
      if (ts) {
        try {
          const order = JSON.parse(ts.turn_order_json || '[]');
          if (!(ts.current_index >= 0 && ts.current_index < Math.max(order.length, 1))) {
            v.push(`turn index out of range: ${ts.current_index} of ${order.length}`);
          }
          if (!(ts.round_number >= 1)) v.push(`round invalid: ${ts.round_number}`);
        } catch { v.push('turn_order_json is not valid JSON'); }
      }

      // Soft fiction checks — warnings, not verdicts. The in-app
      // reconciliation should already have applied narrated damage; a hit
      // here means it missed.
      if (narrative) {
        const dmg = narrative.match(/you take (\d+) damage/i);
        if (dmg && pc.current_hp >= prevPcHp) {
          w.push(`narration says "you take ${dmg[1]} damage" but PC HP did not drop (${prevPcHp} -> ${pc.current_hp})`);
        }
        if (/(goblin|enemy|creature) (dies|is slain|falls dead|drops dead)/i.test(narrative) && deadCount <= prevDeadCount) {
          w.push('narration reports a kill but no enemy is newly dead in the database');
        }
      }
      prevDeadCount = deadCount;
    }
    prevPcHp = pc.current_hp;
  } catch (e) {
    w.push(`watcher read failed (${e.message}) — checks skipped this turn`);
  }
  for (const msg of v) violations.push(`${turnLabel}: ${msg}`);
  for (const msg of w) warnings.push(`${turnLabel}: ${msg}`);
  return { v, w };
}

async function snapshot() {
  const pc = await wGet('SELECT current_hp, max_hp, temp_hp, spell_slots, spell_slots_used FROM characters WHERE id = ?', [pcId]);
  const comp = await wGet('SELECT companion_current_hp, companion_max_hp FROM companions WHERE id = ?', [companionId]);
  let s = `You: ${pc.current_hp}/${pc.max_hp} HP${pc.temp_hp ? ` (+${pc.temp_hp} temp)` : ''} · Lyra: ${comp.companion_current_hp}/${comp.companion_max_hp} HP`;
  try {
    const slots = JSON.parse(pc.spell_slots || '{}');
    const used = JSON.parse(pc.spell_slots_used || '{}');
    const parts = Object.keys(slots).sort().map((l) => `L${l} ${slots[l] - (used[l] || 0)}/${slots[l]}`);
    if (parts.length) s += ` · Slots ${parts.join(' ')}`;
  } catch { /* snapshot is best-effort */ }
  if (sessionId) {
    const enemies = await wAll('SELECT name, current_hp, max_hp, status FROM combat_enemies WHERE session_id = ?', [sessionId]);
    if (enemies.length) {
      const alive = enemies.filter((e) => e.status === 'active');
      s += ` · Enemies: ${alive.length} up (${alive.map((e) => `${e.name} ${e.current_hp}/${e.max_hp}`).join(', ')})`;
      const ts = await wGet('SELECT round_number FROM combat_turn_state WHERE session_id = ? ORDER BY encounter_seq DESC LIMIT 1', [sessionId]);
      if (ts) s += ` · Round ${ts.round_number}`;
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// Phase 4 — start the session and play
// ---------------------------------------------------------------------------
say('Starting the session…');
const start = await api('POST', '/api/dm-session/start', {
  characterId: pcId,
  startingLocation: "The Miller's Road, a forest track",
  era: '1492 DR',
  arrivalHook:
    'A supply wagon lies tipped across the road ahead, its driver — Toma, a lad of seventeen — ' +
    'pinned beneath it and trying not to shout. Three goblins are picking through the spilled ' +
    'grain sacks, spears close at hand, and have not yet seen you. Lyra is at your shoulder.',
}, 300000);
if (start.status !== 200 || !start.json?.sessionId) {
  say(`Session start failed (HTTP ${start.status}): ${start.json?.error || start.text.slice(0, 400)}`);
  say('Last server log lines:');
  for (const l of serverLog.slice(-20)) say(`  ${l}`);
  server.kill('SIGTERM');
  process.exit(1);
}
sessionId = start.json.sessionId;
say(`\n=== Session ${sessionId}: ${start.json.title || 'Goblin Ambush'} ===`);
say(`\n${start.json.openingNarrative || '(no opening narrative)'}`);
say(`\n[${await snapshot()}]`);

let turn = 0;
async function takeTurn(action) {
  turn++;
  say('\n(DM is thinking…)');
  const r = await api('POST', `/api/dm-session/${sessionId}/message`, { action }, 300000);
  if (r.status !== 200) {
    say(`Turn failed (HTTP ${r.status}): ${r.json?.error || r.text.slice(0, 300)}`);
    return false;
  }
  say(`\n${r.json.narrative || ''}`);
  if (r.json.combatStart) say('\n[combat started]');
  if (r.json.combatEnd) say('\n[combat ended]');
  if (Array.isArray(r.json.hpChanges) && r.json.hpChanges.length) {
    say(`[mechanical: ${r.json.hpChanges.map((h) => `${h.name || 'HP'} ${h.delta > 0 ? '+' : ''}${h.delta}`).join(', ')}]`);
  }
  if (r.json.deathSave) say('[death save rolled — check the state line]');
  const { v, w } = await checkInvariants(`turn ${turn}`, r.json.narrative || '');
  for (const msg of v) say(`  ⚠ VIOLATION — ${msg}`);
  for (const msg of w) say(`  · warning — ${msg}`);
  say(`[${await snapshot()}]`);
  return true;
}

async function endSession() {
  say('\nEnding the session (XP scoring runs now)…');
  const r = await api('POST', `/api/dm-session/${sessionId}/end`, {}, 300000);
  if (r.status !== 200) {
    say(`End failed (HTTP ${r.status}): ${r.json?.error || r.text.slice(0, 300)}`);
    return;
  }
  if (r.json.summary) say(`\nSummary: ${r.json.summary}`);
  if (r.json.rewards) say(`Rewards: ${JSON.stringify(r.json.rewards)}`);
  sessionId = null; // XP may now legitimately change; watcher stands down.
}

if (SMOKE) {
  say('\n--- SMOKE MODE: three canned actions, then session end ---');
  await takeTurn('I step into the open with my staff raised and call out to the goblins to drop their spears.');
  await takeTurn('I cast Magic Missile at the goblin nearest the wagon.');
  await takeTurn('Lyra and I press the attack — drive them off and get Toma out from under that wagon.');
  await endSession();
} else {
  say('\nPlay. Type what your character does. Commands: /state  /report  /end  /quit');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  for (;;) {
    const line = (await rl.question('\n> ')).trim();
    if (!line) continue;
    if (line === '/quit') break;
    if (line === '/state') { say(`[${await snapshot()}]`); continue; }
    if (line === '/report') {
      say(violations.length ? `Violations:\n${violations.map((x) => `  ⚠ ${x}`).join('\n')}` : 'No violations so far.');
      say(warnings.length ? `Warnings:\n${warnings.map((x) => `  · ${x}`).join('\n')}` : 'No warnings so far.');
      continue;
    }
    if (line === '/end') { await endSession(); break; }
    await takeTurn(line);
  }
  rl.close();
}

// ---------------------------------------------------------------------------
// Phase 5 — report + teardown
// ---------------------------------------------------------------------------
say('\n================ PLAYABLE CAPSTONE REPORT ================');
say(`Turns played: ${turn}`);
say(`Violations: ${violations.length}`);
for (const msg of violations) say(`  ⚠ ${msg}`);
say(`Warnings: ${warnings.length}`);
for (const msg of warnings) say(`  · ${msg}`);
say(violations.length === 0
  ? 'Mechanical invariants held for every checked turn.'
  : 'Divergences found — the turns above are the reproduction.');
say('Not covered (your judgment while playing): prose quality, playbook ' +
    'discipline, whether Lyra felt like her own person, whether it was fun.');
say('==========================================================');

server.kill('SIGTERM');
await sleep(1500);
if (!serverExited) server.kill('SIGKILL');
if (KEEP) {
  say(`Scenario database kept at: ${DB_FILE}`);
} else {
  fs.rmSync(dbDir, { recursive: true, force: true });
}
process.exit(SMOKE && violations.length > 0 ? 1 : 0);
