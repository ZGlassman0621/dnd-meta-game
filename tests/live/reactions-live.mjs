#!/usr/bin/env node
/**
 * LIVE reactions probe (mechanical-reactions brief, item 6). NOT part of
 * `npm test`. Needs Ollama running with the DM model (gemma4:12b) pulled.
 * Throwaway database (.test-tmp/reactions-live.db), never the real one.
 * Writes what it saw to .test-tmp/reactions-live-results.json.
 *
 *   node tests/live/reactions-live.mjs
 *
 * Drives the REAL turn route (Express + dmSession.js + llm.js + Ollama):
 *  A. Shield — the player says they cast Shield; the model must emit the
 *     SPELL_CAST marker; the engine spends the slot + reaction and the
 *     goblin's attack (engine loop, model-chosen) is judged against AC+5.
 *  B. Counterspell — an Archmage holds a Counterspell (armed through the
 *     engine service, as its own reaction cast does); the player casts
 *     Magic Missile; the model emits SPELL_CAST; the engine fires the
 *     counter (enemy slot + reaction spent now), asks the player for a
 *     Constitution save; the player reports a failing die; the spell is
 *     countered and the player's slot is NOT expended.
 * The fight state is seeded directly (encounter + turn order), so the
 * probe tests the reactions, not the model's choice to start a fight.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRATCH = path.join(ROOT, '.test-tmp');
fs.mkdirSync(SCRATCH, { recursive: true });
const DB = path.join(SCRATCH, 'reactions-live.db');
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
const ess = await imp('server/services/enemySpellService.js');
const rs = await imp('server/services/reactionService.js');
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

async function seedWizard(name) {
  const camp = await dbRun('INSERT INTO campaigns (name, setting, status) VALUES (?, ?, ?)', [`TEST_LIVE ${name} Campaign`, 'Forgotten Realms', 'active']);
  const ch = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, armor_class, current_location,
       experience_to_next_level, campaign_id, game_day, game_year, ability_scores, gold_gp, spell_slots, spell_slots_used, known_spells)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, 'Wizard', 'Human', 5, 30, 30, 12, 'Ashford ruins', 6500, Number(camp.lastInsertRowid), 120, 1492,
      JSON.stringify({ str: 8, dex: 14, con: 12, int: 17, wis: 12, cha: 10 }), 40,
      JSON.stringify({ 1: 4, 2: 3, 3: 2 }), '{}', JSON.stringify(['Shield', 'Magic Missile', 'Counterspell', 'Fire Bolt'])]
  );
  return Number(ch.lastInsertRowid);
}
async function slotsUsed(id) { return JSON.parse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [id]))?.spell_slots_used || '{}'); }
async function enemySlots(id) { return JSON.parse((await dbGet('SELECT enemy_spell_slots_json FROM combat_enemies WHERE id = ?', [id]))?.enemy_spell_slots_json || '{}'); }
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
async function lastRaw(sessionId) {
  const rows = await dbAll(`SELECT response, markers_detected FROM ai_call_log WHERE session_id = ? ORDER BY id DESC LIMIT 6`, [sessionId]).catch(() => []);
  return rows.map((r) => ({ markers: r.markers_detected, response: String(r.response || '').slice(0, 600) }));
}

const results = { model: modelFor('dm'), started: new Date().toISOString() };
const START_LOC = { name: 'Ashford ruins', description: 'A collapsed watchtower outside Ashford. Rubble, a broken stair, cold wind.', region: 'Sword Coast' };

// ── A. Shield ──────────────────────────────────────────────────────────────
{
  console.log('\n=== A. Shield ===');
  const pcId = await seedWizard('TEST_LIVE Shield Wizard');
  const start = await post('/api/dm-session/start', { characterId: pcId, startingLocation: START_LOC, campaignLength: 'one-shot' });
  if (start.status !== 200) { console.error('start failed', start.status, start.body); process.exit(3); }
  const sessionId = start.body.sessionId;
  const [gob] = await es.createEncounterEnemies(sessionId, 1, [{ name: 'Goblin Skirmisher', maxHp: 30, armorClass: 13, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }]);
  const pcKey = await tl.ledgerKeyForPlayer(pcId);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'TEST_LIVE Shield Wizard', type: 'player', key: pcKey },
    { name: 'Goblin Skirmisher', type: 'enemy', key: `combat:${sessionId}:1:${gob.id}` },
  ]);
  const before = await slotsUsed(pcId);
  const r = await post(`/api/dm-session/${sessionId}/message`, { action: 'The goblin skirmisher lunges at me with its blade. I cast Shield (1st-level slot) as my reaction, a shimmering barrier springing up around me.' });
  const after = await slotsUsed(pcId);
  const shieldEntry = JSON.parse((await dbGet('SELECT action_state_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = 1', [sessionId]))?.action_state_json || '{}');
  const ms = markersOf(r.body);
  results.shield = {
    status: r.status, ms: r.ms,
    narrative: String(r.body?.narrative || r.body?.response || '').slice(0, 4000),
    markers: ms.map((m) => ({ key: m.key, success: m.result?.success, shieldSet: m.result?.shieldSet, targetAc: m.result?.targetAc ?? m.result?.attack?.targetAc, hit: m.result?.hit ?? m.result?.attack?.hit, reason: m.result?.reason })),
    rollMath: r.body?.rollMath ?? null,
    slot1_before: before["1"] || 0, slot1_after: after["1"] || 0,
    reaction_spent: !(await rs.hasReactionAvailable(sessionId, 1, 'TEST_LIVE Shield Wizard')),
    shield_entry_live: JSON.stringify(shieldEntry).includes('"shield"'),
    raw: await lastRaw(sessionId),
  };
  console.log(JSON.stringify({ ...results.shield, raw: undefined, narrative: results.shield.narrative.slice(0, 300) }, null, 2));
}

// ── B. Counterspell ────────────────────────────────────────────────────────
{
  console.log('\n=== B. Counterspell ===');
  const pcId = await seedWizard('TEST_LIVE Counter Wizard');
  const start = await post('/api/dm-session/start', { characterId: pcId, startingLocation: START_LOC, campaignLength: 'one-shot' });
  if (start.status !== 200) { console.error('start failed', start.status, start.body); process.exit(4); }
  const sessionId = start.body.sessionId;
  const [mage] = await es.createEncounterEnemies(sessionId, 1, [{ name: 'Archmage', maxHp: 99, armorClass: 15, attackBonus: 6, damageDice: '1d8', dexMod: 2 }]);
  const pcKey = await tl.ledgerKeyForPlayer(pcId);
  await ct.initializeTurnOrder(sessionId, 1, [
    { name: 'TEST_LIVE Counter Wizard', type: 'player', key: pcKey },
    { name: 'Archmage', type: 'enemy', key: `combat:${sessionId}:1:${mage.id}` },
  ]);
  // The Archmage holds a Counterspell — armed exactly as its reaction cast arms it.
  await dbRun('UPDATE combat_enemies SET enemy_spell_slots_json = ? WHERE id = ?', [JSON.stringify({ 1: 4, 2: 3, 3: 3 }), mage.id]);
  await ess.armEnemyCounter(sessionId, 1, { enemyName: 'Archmage', dc: 17, targetName: null, deferred: true, level: 3, enemyId: mage.id });
  const r1 = await post(`/api/dm-session/${sessionId}/message`, { action: 'I point at the Archmage and cast Magic Missile with a 1st-level slot, three glowing darts streaking toward him.' });
  const cfg1 = JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config || '{}');
  const step1 = {
    status: r1.status, ms: r1.ms,
    narrative: String(r1.body?.narrative || r1.body?.response || '').slice(0, 4000),
    markers: markersOf(r1.body).map((m) => ({ key: m.key, success: m.result?.success, countered: m.result?.countered, slotConsumed: m.result?.slotConsumed, reason: m.result?.reason })),
    rollPrompts: r1.body?.rollPrompts ?? null,
    pending_countered_cast: !!cfg1.pendingCounteredCast,
    pc_slot1_after_cast: (await slotsUsed(pcId))['1'] || 0,
    archmage_slot3_after_fire: (await enemySlots(mage.id))['3'],
    archmage_reaction_spent: !(await rs.hasReactionAvailable(sessionId, 1, 'Archmage')),
  };
  console.log(JSON.stringify({ ...step1, narrative: step1.narrative.slice(0, 300) }, null, 2));
  let step2 = null;
  if (cfg1.pendingCounteredCast) {
    // The player rolls a 3 on the Constitution save (fails DC 17).
    const r2 = await post(`/api/dm-session/${sessionId}/message`, { action: '3' });
    const cfg2 = JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config || '{}');
    step2 = {
      status: r2.status, ms: r2.ms,
      narrative: String(r2.body?.narrative || r2.body?.response || '').slice(0, 4000),
      pending_countered_cast_cleared: !cfg2.pendingCounteredCast,
      pc_slot1_after_counter: (await slotsUsed(pcId))['1'] || 0,
      archmage_hp: (await dbGet('SELECT current_hp FROM combat_enemies WHERE id = ?', [mage.id]))?.current_hp,
      dm_notices: cfg2.dmNotices || cfg2.pendingDmNotices || null,
    };
    console.log(JSON.stringify({ ...step2, narrative: step2.narrative.slice(0, 400) }, null, 2));
  }
  results.counterspell = { step1, step2, raw: await lastRaw(sessionId) };
}

results.finished = new Date().toISOString();
fs.writeFileSync(path.join(SCRATCH, 'reactions-live-results.json'), JSON.stringify(results, null, 2));
console.log('\nwrote .test-tmp/reactions-live-results.json');
server.close();
process.exit(0);
