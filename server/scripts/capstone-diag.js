/**
 * server/scripts/capstone-diag.js — DIAGNOSTIC (not a test).
 * Replays capstone-combat groups 1, 2, 3, 7, 8 enemy-affecting steps with
 * a combat_enemies + combat_death_events dump after every step, to find
 * which step creates an unexpected death in the group-8 flake.
 * Run: node server/scripts/capstone-diag.js
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-capdiag-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDatabase, dbGet, dbRun, dbAll } = await import(
  pathToFileURL(path.join(REPO, 'server', 'database.js')).href
);
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js'));
const spellSvc = await import(svc('server/services/spellCastService.js'));
const enemySvc = await import(svc('server/services/enemyCombatService.js'));
const turnSvc = await import(svc('server/services/combatTurnService.js'));

const RUN = 'T' + Date.now().toString(36).toUpperCase();
let seq = 0;
const tn = (b) => `TEST_${b}_${RUN}_${++seq}`;

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
      vals.push(t.includes('INT') ? 1 : `TEST_${c.name}`);
    }
  }
  const r = await dbRun(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    vals
  );
  return Number(r.lastInsertRowid);
}

const heroName = tn('Hero');
const allyName = tn('Ally');
const pcId = await insertRow('characters', {
  name: heroName,
  level: 3,
  current_hp: 60,
  max_hp: 60,
  armor_class: 14,
  ability_scores: JSON.stringify({
    strength: 10, dexterity: 14, constitution: 8,
    intelligence: 16, wisdom: 12, charisma: 10,
  }),
  spell_slots: JSON.stringify({ 1: 2, 2: 1 }),
  spell_slots_used: JSON.stringify({}),
  inventory: JSON.stringify([]),
});
const allyNpcId = await insertRow('npcs', { name: allyName });
const allyId = await insertRow('companions', {
  npc_id: allyNpcId,
  recruited_by_character_id: pcId,
  status: 'active',
  armor_class: 13,
  companion_current_hp: 12,
  companion_max_hp: 12,
  companion_ability_scores: JSON.stringify({ dexterity: 12 }),
});
const sessionId = await insertRow('dm_sessions', {
  character_id: pcId,
  status: 'active',
});
const CTX = { characterId: pcId, sessionId };
const SEQ = 1;

async function dump(label) {
  const rows = await dbAll(
    'SELECT id, name, current_hp, max_hp, status FROM combat_enemies WHERE session_id = ? ORDER BY id',
    [sessionId]
  );
  const evts = await dbAll(
    'SELECT id, enemy_id, enemy_name, xp_value FROM combat_death_events WHERE session_id = ? ORDER BY id',
    [sessionId]
  );
  console.log(`\n--- ${label}`);
  for (const r of rows) console.log(`    enemy #${r.id} ${r.name} hp ${r.current_hp}/${r.max_hp} ${r.status}`);
  console.log(`    death events: ${evts.length}${evts.length ? ' -> ' + evts.map((e) => `#${e.id} enemy_id=${e.enemy_id} ${e.enemy_name}`).join('; ') : ''}`);
}

console.log('== G1 COMBAT_START');
await pipeline.processResponseMarkers(
  'Three goblins burst from the treeline, blades out! [COMBAT_START: Enemies="Goblin, Goblin, Goblin"]',
  CTX
);
await dump('after COMBAT_START');

console.log('\n== G2 advanceTurn x5');
{
  const s0 = await turnSvc.getTurnState(sessionId, SEQ);
  const order = s0.turnOrder;
  for (let i = 1; i <= order.length; i++) await turnSvc.advanceTurn(sessionId, SEQ);
}
await dump('after group 2 advances');

console.log('\n== G3 SPELL_CAST Magic Missile (pipeline)');
{
  const res = await pipeline.processResponseMarkers('[SPELL_CAST: Spell="Magic Missile" Level=1]', CTX);
  const cast = res.handlerResults.find((h) => h.schemaKey === 'SPELL_CAST');
  console.log('    pipeline cast result:', JSON.stringify(cast?.result));
}
await dump('after pipeline Magic Missile');

console.log('\n== G3 castSpell Magic Missile x2 (2nd ok, 3rd no slots)');
{
  const second = await spellSvc.castSpell(pcId, 'Magic Missile', 1);
  console.log('    second:', JSON.stringify(second));
  const third = await spellSvc.castSpell(pcId, 'Magic Missile', 1);
  console.log('    third:', JSON.stringify(third));
  const cantrip = await spellSvc.castSpell(pcId, 'Fire Bolt', 0);
  console.log('    fire bolt:', JSON.stringify(cantrip));
}
await dump('after group 3 casts');

console.log('\n== G7 OPPORTUNITY_ATTACK x2 (companion ally)');
{
  const marker = `[OPPORTUNITY_ATTACK: Attacker="${allyName}" Target="Goblin"]`;
  const first = await pipeline.processResponseMarkers(marker, CTX);
  const r1 = first.handlerResults.find((h) => h.schemaKey === 'OPPORTUNITY_ATTACK');
  console.log('    OA 1 result:', JSON.stringify(r1?.result));
  await dump('after OA 1');
  const second = await pipeline.processResponseMarkers(marker, CTX);
  const r2 = second.handlerResults.find((h) => h.schemaKey === 'OPPORTUNITY_ATTACK');
  console.log('    OA 2 result:', JSON.stringify(r2?.result));
  await dump('after OA 2');
  await dbRun('UPDATE combat_enemies SET current_hp = max_hp WHERE session_id = ? AND encounter_seq = ?', [sessionId, SEQ]);
  await dump('after group 7 HP reset');
}

console.log('\n== G8 ENEMY_DAMAGE 4 then 3');
{
  const dmg1 = await pipeline.processResponseMarkers('[ENEMY_DAMAGE: Enemy="Goblin" Amount=4]', CTX);
  const d1 = dmg1.handlerResults.find((h) => h.schemaKey === 'ENEMY_DAMAGE');
  console.log('    dmg1 result:', JSON.stringify(d1?.result));
  await dump('after ENEMY_DAMAGE 4');
  const dmg2 = await pipeline.processResponseMarkers('[ENEMY_DAMAGE: Enemy="Goblin" Amount=3]', CTX);
  const d2 = dmg2.handlerResults.find((h) => h.schemaKey === 'ENEMY_DAMAGE');
  console.log('    dmg2 result:', JSON.stringify(d2?.result));
  await dump('after ENEMY_DAMAGE 3');
  const active = await enemySvc.getActiveEnemies(sessionId, SEQ);
  console.log(`\nFINAL: active enemies = ${active.length} (test expects 2)`);
}
console.log('\nDIAG DONE');

