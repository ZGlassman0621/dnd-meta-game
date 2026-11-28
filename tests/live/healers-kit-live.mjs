#!/usr/bin/env node
/**
 * LIVE Healer's Kit probe (healers-kit-stabilize brief, Part 1 item 7).
 * NOT part of `npm test`. Needs Ollama running with the DM model
 * (gemma4:12b). Throwaway database (.test-tmp/healers-kit-live.db), never
 * the real one. Writes what it saw to .test-tmp/healers-kit-live-results.json.
 *
 *   node tests/live/healers-kit-live.mjs
 *
 * Drives the REAL turn route (Express + dmSession.js + llm.js + Ollama).
 * The player character is down at 0 HP, dying, mid-fight; the party carries
 * a Healer's Kit; Lyra (a companion) is up. Turn order: player, Lyra,
 * goblin. The player sends their death save; the ENGINE then runs Lyra's
 * turn (one DM call — the model chooses her action) and the goblin's.
 * Pass: the model has Lyra use the kit, the engine stabilizes the player
 * with no check (successes 3, failures 0, 0 HP) and one use is spent.
 * Up to three rounds; whatever fired is recorded either way.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRATCH = path.join(ROOT, '.test-tmp');
fs.mkdirSync(SCRATCH, { recursive: true });
const DB = path.join(SCRATCH, 'healers-kit-live.db');
for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) { try { fs.rmSync(f); } catch { /* fresh */ } }
process.env.TURSO_DATABASE_URL = `file:${DB}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.FF_SESSION_END_BACKUP = 'false';

const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { initDatabase, dbRun, dbGet, dbAll } = await imp('server/database.js');
const { default: express } = await import('express');
const { once } = await import('node:events');
const { checkStatus } = await imp('server/services/llm.js');
const { modelFor } = await imp('server/services/localModels.js');

const status = await checkStatus();
if (!status.available) { console.error(`Local AI not available: ${status.error}`); process.exit(2); }
console.log(`Ollama ready; DM model ${modelFor('dm')}`);

await initDatabase();
const es = await imp('server/services/enemyCombatService.js');
const ct = await imp('server/services/combatTurnService.js');
const tl = await imp('server/services/turnLedgerService.js');
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
async function insertRow(table, overrides) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = []; const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(overrides, c.name)) { cols.push(c.name); vals.push(overrides[c.name]); continue; }
    if (c.notnull && c.dflt_value == null) { const t = (c.type || '').toUpperCase(); cols.push(c.name); vals.push(t.includes('INT') || t.includes('REAL') ? 1 : `TEST_${c.name}`); }
  }
  const r = await dbRun(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
  return Number(r.lastInsertRowid);
}
function markersOf(body) {
  const out = [];
  const walk = (v) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v.schemaKey) out.push({ key: v.schemaKey, result: v.result });
    for (const k of Object.keys(v)) walk(v[k]);
  };
  walk(body);
  return out;
}
const pcState = (id) => dbGet('SELECT current_hp, is_unconscious, is_dead, death_save_successes AS s, death_save_failures AS f, stable_recover_at, inventory FROM characters WHERE id = ?', [id]);
async function rawCalls(sessionId) {
  const rows = await dbAll(`SELECT call_purpose, response FROM ai_call_log WHERE session_id = ? ORDER BY id`, [sessionId]).catch(() => []);
  return rows.map((r) => ({ purpose: r.call_purpose, response: String(r.response || '').slice(0, 700) }));
}

const START_LOC = { name: 'Ashford ruins', description: 'A collapsed watchtower outside Ashford. Rubble, a broken stair, cold wind.', region: 'Sword Coast' };
const results = { model: modelFor('dm'), started: new Date().toISOString(), rounds: [] };

const camp = await insertRow('campaigns', { name: 'TEST_LIVE Kit Campaign', setting: 'Forgotten Realms', status: 'active' });
const pcId = await insertRow('characters', {
  name: 'TEST_LIVE Kael', class: 'Fighter', race: 'Human', level: 3, current_hp: 28, max_hp: 28, armor_class: 16,
  current_location: 'Ashford ruins', experience_to_next_level: 2700, campaign_id: camp, game_day: 120, game_year: 1492,
  ability_scores: JSON.stringify({ str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 }), gold_gp: 20,
  inventory: JSON.stringify([{ name: "Healer's Kit", quantity: 1 }, { name: 'Rations', quantity: 3 }]),
});
const npcId = await insertRow('npcs', { name: 'Lyra', race: 'Half-Elf', occupation: 'Acolyte', current_location: 'Ashford ruins' });
const lyraId = await insertRow('companions', {
  npc_id: npcId, recruited_by_character_id: pcId, status: 'active', companion_class: 'Cleric', companion_level: 3,
  companion_current_hp: 21, companion_max_hp: 21,
});

// Give Lyra her world id BEFORE the turn keys are built (run 2 seeded the key
// first; the engine later assigned the id, and her own turn read as out of turn).
const wid = await imp('server/services/worldIdService.js');
await wid.assignWorldId('npcs', npcId);
const start = await post('/api/dm-session/start', { characterId: pcId, startingLocation: START_LOC, campaignLength: 'one-shot' });
if (start.status !== 200) { console.error('start failed', start.status, start.body); process.exit(3); }
const sessionId = start.body.sessionId;
results.sessionId = sessionId;

// The fight: the goblin has just dropped Kael to 0 HP. Kael is dying.
const [gob] = await es.createEncounterEnemies(sessionId, 1, [{ name: 'Goblin Raider', maxHp: 12, armorClass: 13, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }]);
await dbRun('UPDATE characters SET current_hp = 0, is_unconscious = 1, death_save_successes = 0, death_save_failures = 0 WHERE id = ?', [pcId]);
await ct.initializeTurnOrder(sessionId, 1, [
  { name: 'TEST_LIVE Kael', type: 'player', key: await tl.ledgerKeyForPlayer(pcId) },
  { name: 'Lyra', type: 'companion', key: await tl.ledgerKeyForTarget('companion', lyraId) },
  { name: 'Goblin Raider', type: 'enemy', key: `combat:${sessionId}:1:${gob.id}` },
]);
const cfg = JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config || '{}');
cfg.pendingDeathSave = { characterId: pcId, postedAt: Date.now() };
await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);

const kitUses = async () => {
  const inv = JSON.parse((await pcState(pcId)).inventory || '[]');
  const k = inv.find((i) => /healer/i.test(i.name || ''));
  return k ? (Number.isInteger(k.uses) ? k.uses : 10) : null;
};
const dice = ['12', '11', '13'];
for (let round = 0; round < 3; round++) {
  const before = { ...(await pcState(pcId)), kit: await kitUses() };
  const r = await post(`/api/dm-session/${sessionId}/message`, { action: dice[round] });
  const after = { ...(await pcState(pcId)), kit: await kitUses() };
  const ms = markersOf(r.body);
  const kit = ms.filter((m) => m.key === 'HEALERS_KIT');
  const kitLine = (String(r.body?.narrative || '').match(/⚙ [^\n]*Healer's Kit[^\n]*/g) || []);
  const entry = {
    round: round + 1, status: r.status, ms: r.ms,
    before: { hp: before.current_hp, s: before.s, f: before.f, kit: before.kit },
    after: { hp: after.current_hp, s: after.s, f: after.f, dead: after.is_dead, kit: after.kit, recoverAt: after.stable_recover_at },
    npcTurns: r.body?.npcTurns || null,
    markers: ms.map((m) => ({ key: m.key, success: m.result?.success, reason: m.result?.reason, user: m.result?.user, target: m.result?.target })),
    healersKit: kit.map((m) => m.result),
    kitEngineLines: kitLine,
    kitSpent: (before.kit ?? 0) - (after.kit ?? 0),
    rollPrompts: r.body?.rollPrompts ?? null,
    narrativeTail: String(r.body?.narrative || r.body?.response || '').slice(-1500),
  };
  results.rounds.push(entry);
  console.log(JSON.stringify({ ...entry, narrativeTail: entry.narrativeTail.slice(-600) }, null, 2));
  if (after.is_dead) break;
  if (kit.some((m) => m.result?.success) || kitLine.some((l) => /stabilized, no check/.test(l))) {
    // The player reports the 1d4 for the recovery hours.
    const pending = JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config || '{}').pendingRecoveryDie;
    results.recoveryAskPosted = !!pending;
    if (pending) {
      const d4 = await post(`/api/dm-session/${sessionId}/message`, { action: '3' });
      const after4 = await pcState(pcId);
      results.recoveryDie = {
        status: d4.status, stabilizedAt: pending.stabilizedAt, recoverAt: after4.stable_recover_at,
        askCleared: !JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config || '{}').pendingRecoveryDie,
        hp: after4.current_hp, s: after4.s, f: after4.f,
        lines: (String(d4.body?.narrative || '').match(/⚙ [^\n]*/g) || []),
      };
      console.log(JSON.stringify(results.recoveryDie, null, 2));
    }
    break;
  }
  // Re-ask the death save if the engine did (it does when the player is still dying).
}
results.final = { ...(await pcState(pcId)), kit: await kitUses() };
delete results.final.inventory;
// Pass: in one round the engine line says Lyra stabilized Kael with no check and exactly
// one use was spent. (An enemy hit later in the same message can clear the stable
// state, by the book: damage at 0 HP adds a failure — so the end state is not the test.)
results.passed = results.rounds.some((x) => x.kitEngineLines.some((l) => /Lyra uses a Healer's Kit on TEST_LIVE Kael: stabilized, no check \(kit: 9 uses left\)/.test(l)) && x.kitSpent === 1);
results.raw = await rawCalls(sessionId);
fs.writeFileSync(path.join(SCRATCH, 'healers-kit-live-results.json'), JSON.stringify(results, null, 2));
console.log(`\nPASSED: ${results.passed}`);
console.log(JSON.stringify(results.final));
server.close();
process.exit(0);
