/**
 * tests/exhaustion-2024.test.js — Exhaustion under the 2024 PHB model
 * (build after the 2026-10-26 rulings: book on both questions).
 *
 * Pins:
 *   - penalty = -2 x level to every d20 test (checks, saves, attacks,
 *     death saves, concentration saves); Speed -5 ft x level (display);
 *   - death at exhaustion 6 is instant, no death saves (lethal: true);
 *   - the 2014 disadvantage ladder is gone (no disadvantage from
 *     exhaustion anywhere);
 *   - long-rest step-down still works (reduceExhaustion unit; the rest
 *     integration is pinned by pc-conditions group 11).
 *
 * Isolated throwaway DB (clock-unification pattern).
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-exh-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const cs = await import(svc('server/services/conditionService.js'));
const rr = await import(svc('server/services/rollRequestService.js'));
const pa = await import(svc('server/services/partyAttackService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const ss = await import(svc('server/services/spellCastService.js'));
const hp = await import(svc('server/services/characterHpService.js'));
const cc = await import(svc('server/services/concentrationService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; } else { failed++; console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n== ${name}`); }

async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = [];
  const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(overrides, c.name)) {
      cols.push(c.name); vals.push(overrides[c.name]); continue;
    }
    if (c.notnull && c.dflt_value == null) {
      const t = (c.type || '').toUpperCase();
      cols.push(c.name); vals.push(t.includes('INT') ? 1 : `TEST_${c.name}`);
    }
  }
  const r = await dbRun(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals
  );
  return Number(r.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// Fixtures: Wren (L3 wizard, Arcana + INT 16) + Ash (npc_stats companion)
// + a session. One PC doubles as the spell caster (Wizard) and the
// pending-roll actor (Arcana is INT-based, same +5 as the DEX example).
// ---------------------------------------------------------------------------
const pcId = await insertRow('characters', {
  name: 'Wren', class: 'Wizard', level: 3,
  current_hp: 30, max_hp: 30,
  ability_scores: JSON.stringify({ str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 8 }),
  skills: JSON.stringify(['Arcana']),
  hit_dice: JSON.stringify({ d6: 3 })
});
const ashNpcId = await insertRow('npcs', { name: 'Ash' });
const ashId = await insertRow('companions', {
  npc_id: ashNpcId, recruited_by_character_id: pcId, status: 'active',
  progression_type: 'npc_stats',
  original_stats_snapshot: JSON.stringify({ cr: 1 }),
  companion_current_hp: 20, companion_max_hp: 20,
  companion_class: 'Ranger', companion_level: 3,
  companion_ability_scores: JSON.stringify({ dex: 14 })
});
const sessionId = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });

// ---------------------------------------------------------------------------
group('1. Pure penalty + speed values at every level');
// ---------------------------------------------------------------------------
{
  assert(cs.exhaustionPenalty([]) === 0, 'penalty 0 with no exhaustion');
  assert(cs.exhaustionPenalty(['exhaustion_1']) === -2, 'penalty -2 at level 1');
  assert(cs.exhaustionPenalty(['exhaustion_3']) === -6, 'penalty -6 at level 3');
  assert(cs.exhaustionPenalty(['exhaustion_5']) === -10, 'penalty -10 at level 5');
  assert(cs.exhaustionPenalty(['exhaustion_6']) === -12, 'penalty -12 at level 6');
  assert(cs.exhaustionSpeedReduction([]) === 0, 'speed 0 with no exhaustion');
  assert(cs.exhaustionSpeedReduction(['exhaustion_1']) === 5, 'speed -5 at level 1');
  assert(cs.exhaustionSpeedReduction(['exhaustion_3']) === 15, 'speed -15 at level 3');
  assert(cs.exhaustionSpeedReduction(['exhaustion_5']) === 25, 'speed -25 at level 5');
  assert(cs.exhaustionSpeedReduction(['exhaustion_6']) === 30, 'speed -30 at level 6');

  const rollFx = (c, k, n) => cs.conditionRollEffects(c, k, n);
  assert(rollFx(['exhaustion_1'], 'skill', 'Perception').penalty === -2, 'check profile: -2 at level 1');
  assert(rollFx(['exhaustion_2'], 'save', 'Wisdom').penalty === -4, 'save profile: -4 at level 2');
  assert(rollFx(['exhaustion_3'], 'save', 'Wisdom').penalty === -6, 'save profile: -6 at level 3');
  assert(rollFx(['exhaustion_5'], 'skill', 'Perception').penalty === -10, 'check profile: -10 at level 5');
  assert(!rollFx(['exhaustion_3'], 'skill', 'Perception').disadvantage, 'no disadvantage from exhaustion (checks)');
  assert(!rollFx(['exhaustion_3'], 'save', 'Wisdom').disadvantage, 'no disadvantage from exhaustion (saves)');
  assert(rollFx(['poisoned'], 'skill', 'Stealth').disadvantage, 'poisoned still disadvantages checks');

  const atkFx = (c) => cs.conditionAttackEffects(c);
  assert(atkFx(['exhaustion_1']).penalty === -2, 'attack profile: -2 at level 1');
  assert(atkFx(['exhaustion_3']).penalty === -6, 'attack profile: -6 at level 3');
  assert(atkFx(['exhaustion_5']).penalty === -10, 'attack profile: -10 at level 5');
  assert(!atkFx(['exhaustion_3']).disadvantage, 'no disadvantage from exhaustion (attacks)');
  assert(atkFx(['poisoned']).disadvantage, 'poisoned still disadvantages attacks');
}

// ---------------------------------------------------------------------------
group('2. PC pending roll carries the penalty; resolution folds it in');
// ---------------------------------------------------------------------------
{
  await cs.addCondition('player', pcId, 'exhaustion_2');
  const r = await rr.requestPcRoll({
    sessionId, characterId: pcId, kind: 'skill', name: 'Arcana',
    dc: 15, looks: 'a faded rune circle'
  });
  assert(r.success && r.pending.penalty === -4, 'pending roll stores penalty -4 (exhaustion 2)');
  const res = await rr.resolveReportedRoll(sessionId, [12]);
  assert(res.penalty === -4, 'resolution returns the penalty');
  assert(res.total === res.takenDie + res.modifier + res.penalty, 'total = die + modifier + penalty');
  assert(res.total === 12 + res.modifier - 4, 'reported 12 resolves with the -4 folded in');
  const block = rr.formatRollOutcomeBlock(res);
  assert(block.includes('-4'), 'the ROLL RESULT block shows the exhaustion term');
  await cs.removeCondition('player', pcId, 'exhaustion_2');
}

// ---------------------------------------------------------------------------
group('3. Companion attack carries the penalty');
// ---------------------------------------------------------------------------
{
  await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Goblin', maxHp: 30, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }
  ]);
  await cs.addCondition('companion', ashId, 'exhaustion_2');
  const ashRow = await dbGet('SELECT * FROM companions WHERE id = ?', [ashId]);
  ashRow.name = 'Ash';
  const built = pa.buildAttackProfile('companion', ashRow);
  assert(!built.error, 'companion attack profile builds');
  const enemy = await es.findActiveEnemy(sessionId, 1, 'Goblin');
  const out = await pa.resolveCompanionAttack(sessionId, pcId, ashRow, enemy, {});
  assert(out.penalty === -4, 'companion attack outcome carries penalty -4 (exhaustion 2)');
  assert(out.attackBonus === built.profile.attackBonus - 4, 'companion attack bonus folds the penalty in');
  await cs.removeCondition('companion', ashId, 'exhaustion_2');
}

// ---------------------------------------------------------------------------
group('4. Enemy attack carries the penalty');
// ---------------------------------------------------------------------------
{
  const goblins = await es.createEncounterEnemies(sessionId, 2, [
    { name: 'Goblin', maxHp: 30, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }
  ]);
  await dbRun(`UPDATE combat_enemies SET active_conditions = ? WHERE id = ?`,
    [JSON.stringify(['exhaustion_3']), goblins[0].id]);
  const atk = await es.resolveEnemyAttack(sessionId, 2, 'Goblin',
    { type: 'player', id: pcId, armorClass: 14, name: 'Wren' });
  assert(atk.penalty === -6, 'enemy attack outcome carries penalty -6');
  assert(atk.totalToHit === atk.attackRoll + atk.attackBonus + atk.penalty,
    'enemy total = roll + bonus + penalty');
  // Heal the PC back up so later groups start clean.
  await hp.applyHpChange(pcId, 1000, 'exhaustion test reset');
}

// ---------------------------------------------------------------------------
group('5. Spell save carries the penalty (Wizard + Fireball)');
// ---------------------------------------------------------------------------
{
  const goblins = await es.createEncounterEnemies(sessionId, 3, [
    { name: 'Goblin', maxHp: 30, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }
  ]);
  await dbRun(`UPDATE combat_enemies SET active_conditions = ? WHERE id = ?`,
    [JSON.stringify(['exhaustion_2']), goblins[0].id]);
  const casterRow = await dbGet('SELECT * FROM characters WHERE id = ?', [pcId]);
  const save = await ss.resolveSpellSave({
    sessionId, casterCharacterId: pcId, casterKind: 'player', casterRow,
    spellName: 'Fireball', targetName: 'Goblin'
  });
  assert(save !== null, 'Fireball save resolves (wizard profile + catalog save)');
  assert(save.penalty === -4, 'spell save carries penalty -4');
  assert(save.total === save.takenDie + save.modifier + save.penalty,
    'spell save total = die + modifier + penalty');
}

// ---------------------------------------------------------------------------
group('6. Death save carries the penalty');
// ---------------------------------------------------------------------------
{
  const dyingId = await insertRow('characters', {
    name: 'Dying', class: 'Fighter', level: 3,
    current_hp: 0, max_hp: 30, is_unconscious: 1, is_dead: 0,
    death_save_successes: 0, death_save_failures: 0,
    ability_scores: JSON.stringify({ str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 })
  });
  await cs.addCondition('player', dyingId, 'exhaustion_3');
  const ds = await hp.rollDeathSave(dyingId);
  assert(ds !== null, 'a dying, exhausted PC rolls a death save');
  assert(ds.penalty === -6, 'death save carries penalty -6');
  if (ds.outcome === 'revived') assert(ds.roll === 20, 'revive implies a natural 20');
  else if (ds.outcome === 'success') assert(ds.roll + ds.penalty >= 10, 'success implies total >= DC 10');
  else if (ds.outcome === 'failure') assert(ds.roll + ds.penalty < 10 && ds.roll !== 1, 'failure implies total < DC 10');
  else if (ds.outcome === 'critical_failure') assert(ds.roll === 1, 'critical failure implies a natural 1');
  else assert(false, `unexpected death-save outcome: ${ds.outcome}`);
  assert(ds.died === false && ds.stabilised === false, 'one save from 0/0 neither kills nor stabilizes');
}

// ---------------------------------------------------------------------------
group('7. Concentration saves carry the penalty');
// ---------------------------------------------------------------------------
{
  await cs.addCondition('player', pcId, 'exhaustion_2');
  await dbRun('UPDATE characters SET concentrating_on = ? WHERE id = ?', ['Hold Person', pcId]);
  const chk = await cc.checkConcentration(pcId, 10);
  assert(chk !== null, 'a concentrating, exhausted PC checks');
  assert(chk.penalty === -4, 'PC concentration check carries penalty -4');
  assert(chk.total === chk.roll + chk.conMod + chk.penalty, 'PC concentration total folds the penalty in');
  assert(chk.success === (chk.total >= chk.dc), 'PC concentration success matches total vs DC');
  await dbRun('UPDATE characters SET concentrating_on = NULL WHERE id = ?', [pcId]);
  await cs.removeCondition('player', pcId, 'exhaustion_2');

  await cs.addCondition('companion', ashId, 'exhaustion_1');
  await dbRun('UPDATE companions SET concentrating_on = ? WHERE id = ?', ['Bless', ashId]);
  const chkC = await cc.checkCompanionConcentration(ashId, 10);
  assert(chkC !== null, 'a concentrating, exhausted companion checks');
  assert(chkC.penalty === -2, 'companion concentration check carries penalty -2');
  assert(chkC.total === chkC.roll + chkC.saveBonus + chkC.penalty, 'companion concentration total folds the penalty in');
  assert(chkC.success === (chkC.total >= chkC.dc), 'companion concentration success matches total vs DC');
  await dbRun('UPDATE companions SET concentrating_on = NULL WHERE id = ?', [ashId]);
  await cs.removeCondition('companion', ashId, 'exhaustion_1');
}

// ---------------------------------------------------------------------------
group('8. Exhaustion 6 kills: PC, companion, enemy');
// ---------------------------------------------------------------------------
{
  const deadPcId = await insertRow('characters', {
    name: 'Doomed', class: 'Fighter', level: 3,
    current_hp: 24, max_hp: 30,
    ability_scores: JSON.stringify({ str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 })
  });
  const kill = await cs.addCondition('player', deadPcId, 'exhaustion_6');
  assert(kill.lethal === true, 'PC exhaustion_6 add returns lethal');
  const deadPc = await dbGet('SELECT current_hp, is_unconscious, is_dead FROM characters WHERE id = ?', [deadPcId]);
  assert(deadPc.is_dead === 1 && deadPc.current_hp === 0 && deadPc.is_unconscious === 1,
    'PC exhaustion death records is_dead + 0 HP (the 3-failed-saves shape)');

  const doomedNpcId = await insertRow('npcs', { name: 'DoomedComp' });
  const doomedId = await insertRow('companions', {
    npc_id: doomedNpcId, recruited_by_character_id: pcId, status: 'active',
    progression_type: 'npc_stats',
    original_stats_snapshot: JSON.stringify({ cr: 1 }),
    companion_current_hp: 15, companion_max_hp: 15,
    companion_class: 'Ranger', companion_level: 3,
    companion_ability_scores: JSON.stringify({ dex: 14 })
  });
  const killC = await cs.addCondition('companion', doomedId, 'exhaustion_6');
  assert(killC.lethal === true, 'companion exhaustion_6 add returns lethal');
  const deadComp = await dbGet('SELECT companion_current_hp, status FROM companions WHERE id = ?', [doomedId]);
  assert(deadComp.status === 'dead' && deadComp.companion_current_hp === 0,
    'companion exhaustion death records status dead + 0 HP');

  const goblins = await es.createEncounterEnemies(sessionId, 4, [
    { name: 'Goblin', maxHp: 30, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }
  ]);
  const killE = await cs.addCondition('enemy', goblins[0].id, 'exhaustion_6');
  assert(killE.lethal === true, 'enemy exhaustion_6 add returns lethal');
  const deadEnemy = await dbGet('SELECT current_hp, status FROM combat_enemies WHERE id = ?', [goblins[0].id]);
  assert(deadEnemy.status === 'dead' && deadEnemy.current_hp === 0,
    'enemy exhaustion death records status dead + 0 HP');
}

// ---------------------------------------------------------------------------
group('9. Marker handler: enemy exhaustion-6 death records a death event');
// ---------------------------------------------------------------------------
{
  const session2 = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
  await es.createEncounterEnemies(session2, 1, [
    { name: 'Goblin', maxHp: 30, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }
  ]);
  const res = await pipeline.processResponseMarkers(
    'The goblin collapses, spent beyond endurance. [CONDITION_ADD: Target="Goblin" Condition="exhaustion_6"]',
    { characterId: pcId, sessionId: session2 });
  const h = res.handlerResults.find(x => x.schemaKey === 'CONDITION_ADD');
  assert(h?.ok && h.result?.success === true && h.result?.lethal === true,
    'the handler reports a lethal exhaustion death, not a plain add');
  const evt = await dbGet(
    'SELECT * FROM combat_death_events WHERE session_id = ? AND enemy_name = ?', [session2, 'Goblin']);
  assert(!!evt, 'the exhaustion death records a death event for the encounter');
  const gone = await es.findActiveEnemy(session2, 1, 'Goblin');
  assert(!gone, 'the exhausted goblin is no longer an active enemy');
}

// ---------------------------------------------------------------------------
group('10. Step-down still works');
// ---------------------------------------------------------------------------
{
  await cs.addCondition('player', pcId, 'exhaustion_3');
  const step = await cs.reduceExhaustion('player', pcId);
  assert(step.changed && step.level === 2, 'reduce steps 3 -> 2');
  await cs.removeCondition('player', pcId, 'exhaustion_2');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
