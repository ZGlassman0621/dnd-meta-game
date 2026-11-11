/**
 * tests/pc-conditions.test.js — durable PC/companion conditions with
 * mechanical enforcement (Phase 1, v1.0.190; design:
 * pc-conditions-design.md, Option B).
 *
 * Pins:
 *   - migration 083: characters.active_conditions (mirror of 030);
 *   - conditionService storage on both tables, exhaustion exclusivity,
 *     long-rest step-down, key normalization;
 *   - the pure effect profiles (penalty / auto-fail / defense);
 *   - the seam: the 'unconscious' CONDITION never touches the dying
 *     flag (is_unconscious) or death-save counters;
 *   - CONDITION_ADD/REMOVE as real pipeline handlers writing the DB;
 *   - enforcement in the resolver: a poisoned PC's pending roll is
 *     created at disadvantage (opposite states cancel), a paralyzed
 *     PC's DEX save auto-fails without a pending roll, companions the
 *     same through rollForNpc;
 *   - enforcement in combat: attacks vs a prone target roll with
 *     advantage, vs an invisible target with disadvantage;
 *   - a long rest reduces exhaustion one level for PC + companions.
 *
 * Isolated throwaway DB (clock-unification pattern).
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-cond-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const cs = await import(svc('server/services/conditionService.js'));
const rr = await import(svc('server/services/rollRequestService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const rt = await import(svc('server/services/restTimeService.js'));
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
// Fixtures: Garrick (L3 fighter) + Lyra (npc_stats companion) + a session.
// ---------------------------------------------------------------------------
const pcId = await insertRow('characters', {
  name: 'Garrick', class: 'Fighter', level: 3,
  current_hp: 30, max_hp: 30,
  ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
  skills: JSON.stringify(['Sleight of Hand']),
  hit_dice: JSON.stringify({ d10: 3 })
});
const lyraNpcId = await insertRow('npcs', { name: 'Lyra' });
const lyraId = await insertRow('companions', {
  npc_id: lyraNpcId, recruited_by_character_id: pcId, status: 'active',
  progression_type: 'npc_stats',
  original_stats_snapshot: JSON.stringify({ cr: 1 }),
  companion_current_hp: 20, companion_max_hp: 20,
  companion_class: 'Ranger', companion_level: 3,
  companion_ability_scores: JSON.stringify({ dex: 14 })
});
const sessionId = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
const CTX = { characterId: pcId, sessionId };

// ---------------------------------------------------------------------------
group('1. Migration 083 — the PC condition column');
{
  const charCols = (await dbAll('PRAGMA table_info(characters)')).map(r => r.name);
  assert(charCols.includes('active_conditions'), 'characters has active_conditions');
  const compCols = (await dbAll('PRAGMA table_info(companions)')).map(r => r.name);
  assert(compCols.includes('active_conditions'), 'companions has active_conditions (030)');
  assert((await cs.getConditions('player', pcId)).length === 0, 'a fresh character has no conditions');
}

// ---------------------------------------------------------------------------
group('2. Storage — round-trips on both tables');
{
  const add = await cs.addCondition('player', pcId, 'Poisoned');
  assert(add.success && add.conditions.includes('poisoned'), 'add normalizes and stores (player)');
  await cs.addCondition('player', pcId, 'prone');
  assert((await cs.getConditions('player', pcId)).join(',') === 'poisoned,prone', 'conditions accumulate in order');
  const rm = await cs.removeCondition('player', pcId, 'poisoned');
  assert(rm.success && (await cs.getConditions('player', pcId)).join(',') === 'prone', 'remove takes exactly one out');
  await cs.removeCondition('player', pcId, 'prone');
  await cs.addCondition('companion', lyraId, 'frightened');
  assert((await cs.getConditions('companion', lyraId)).includes('frightened'), 'companion storage works');
  await cs.removeCondition('companion', lyraId, 'frightened');
  const bad = await cs.addCondition('player', pcId, 'sleepy');
  assert(!bad.success, 'a condition outside the vocabulary is refused');
}

// ---------------------------------------------------------------------------
group('3. Exhaustion — mutually exclusive levels, rest steps down');
{
  await cs.addCondition('player', pcId, 'Exhaustion 1');
  await cs.addCondition('player', pcId, 'exhaustion_3');
  let conds = await cs.getConditions('player', pcId);
  assert(conds.filter(c => c.startsWith('exhaustion_')).join(',') === 'exhaustion_3', 'adding level 3 replaces level 1');
  assert(cs.exhaustionLevel(conds) === 3, 'exhaustionLevel reads the level');
  const step1 = await cs.reduceExhaustion('player', pcId);
  assert(step1.changed && step1.level === 2, 'reduce steps 3 → 2');
  await cs.reduceExhaustion('player', pcId);
  const step3 = await cs.reduceExhaustion('player', pcId);
  assert(step3.changed && step3.level === 0, 'reduce steps 1 → cleared');
  const noop = await cs.reduceExhaustion('player', pcId);
  assert(!noop.changed && noop.level === 0, 'reduce with no exhaustion is a no-op');
  assert(cs.normalizeConditionKey('Exhaustion 3') === 'exhaustion_3', 'normalization: spaced form');
  assert(cs.normalizeConditionKey('sleepy') === null, 'normalization: unknown → null');
}

// ---------------------------------------------------------------------------
group('4. Effect profiles — the enforcement math (pure)');
{
  const fx = cs.conditionRollEffects;
  assert(fx(['poisoned'], 'skill', 'Stealth').disadvantage, 'poisoned: checks at disadvantage');
  assert(!fx(['poisoned'], 'save', 'Constitution').disadvantage, 'poisoned: saves unaffected');
  assert(fx(['frightened'], 'ability', 'Strength').disadvantage, 'frightened: ability checks at disadvantage');
  assert(fx(['exhaustion_1'], 'skill', 'Perception').penalty === -2, 'exhaustion 1: checks at -2');
  assert(!fx(['exhaustion_1'], 'skill', 'Perception').disadvantage, 'exhaustion 1: no disadvantage (2024 penalty model)');
  assert(fx(['exhaustion_2'], 'save', 'Wisdom').penalty === -4, 'exhaustion 2: saves at -4');
  assert(fx(['exhaustion_3'], 'save', 'Wisdom').penalty === -6, 'exhaustion 3: saves at -6');
  assert(fx(['exhaustion_5'], 'skill', 'Perception').penalty === -10, 'exhaustion 5: -10');
  assert(fx([], 'skill', 'Perception').penalty === 0, 'no exhaustion: penalty 0');
  assert(fx(['restrained'], 'save', 'Dexterity').disadvantage, 'restrained: DEX saves at disadvantage');
  assert(!fx(['restrained'], 'save', 'Strength').disadvantage, 'restrained: STR saves unaffected');
  assert(fx(['paralyzed'], 'save', 'Dexterity').autoFail, 'paralyzed: DEX save auto-fails');
  assert(fx(['stunned'], 'save', 'Strength').autoFail, 'stunned: STR save auto-fails');
  assert(!fx(['paralyzed'], 'save', 'Wisdom').autoFail, 'paralyzed: WIS save still rolled');
  assert(!fx(['paralyzed'], 'skill', 'Athletics').autoFail, 'paralyzed: skills never auto-fail (only saves)');
  assert(!fx([], 'save', 'Dexterity').autoFail && !fx([], 'save', 'Dexterity').disadvantage, 'no conditions → no effects');

  const df = cs.conditionDefenseEffects;
  assert(df(['prone']).attackerAdvantage, 'prone: attackers have advantage');
  assert(df(['invisible']).attackerDisadvantage, 'invisible: attackers have disadvantage');
  const both = df(['prone', 'invisible']);
  assert(both.attackerAdvantage && both.attackerDisadvantage, 'prone + invisible: both flags set (the caller cancels them)');
  assert(!df([]).attackerAdvantage && !df([]).attackerDisadvantage, 'no conditions → no defense effects');
  assert(cs.mergeAdvantageState('advantage', 'disadvantage') === null, 'advantage algebra: opposites cancel');
  assert(cs.mergeAdvantageState(null, 'disadvantage') === 'disadvantage', 'advantage algebra: imposition applies');
  assert(cs.mergeAdvantageState('disadvantage', 'disadvantage') === 'disadvantage', 'advantage algebra: no stacking');
}

// ---------------------------------------------------------------------------
group('5. The seam — the unconscious CONDITION is not the dying state');
{
  await cs.addCondition('player', pcId, 'unconscious');
  const row = await dbGet('SELECT is_unconscious, is_dead, death_save_successes, death_save_failures FROM characters WHERE id = ?', [pcId]);
  assert(!row.is_unconscious && !row.is_dead, 'condition does not set the dying flags');
  assert((row.death_save_successes || 0) === 0 && (row.death_save_failures || 0) === 0, 'condition does not touch death saves');
  await cs.removeCondition('player', pcId, 'unconscious');
}

// ---------------------------------------------------------------------------
group('6. Marker handlers — CONDITION_ADD/REMOVE write the DB');
{
  const add = await pipeline.processResponseMarkers(
    'The needle trap springs. [CONDITION_ADD: Target="Player" Condition="poisoned"]', CTX);
  const addH = add.handlerResults.find(h => h.schemaKey === 'CONDITION_ADD');
  assert(addH?.ok && addH.result?.success === true, 'CONDITION_ADD handler succeeds for the player');
  assert((await cs.getConditions('player', pcId)).includes('poisoned'), 'the poison is in the DB');

  const addC = await pipeline.processResponseMarkers(
    'Lyra freezes at the sight. [CONDITION_ADD: Target="Lyra" Condition="frightened"]', CTX);
  const addCH = addC.handlerResults.find(h => h.schemaKey === 'CONDITION_ADD');
  assert(addCH?.ok && addCH.result?.success === true, 'CONDITION_ADD resolves a companion by name');
  assert((await cs.getConditions('companion', lyraId)).includes('frightened'), 'companion condition is in the DB');

  const bad = await pipeline.processResponseMarkers(
    '[CONDITION_ADD: Target="Nobody" Condition="prone"]', CTX);
  const badH = bad.handlerResults.find(h => h.schemaKey === 'CONDITION_ADD');
  assert(badH?.result?.success === false, 'an unknown target fails cleanly (the DM can correct it)');

  const rm = await pipeline.processResponseMarkers(
    'The antidote burns going down. [CONDITION_REMOVE: Target="Player" Condition="poisoned"]', CTX);
  const rmH = rm.handlerResults.find(h => h.schemaKey === 'CONDITION_REMOVE');
  assert(rmH?.ok && rmH.result?.success === true, 'CONDITION_REMOVE handler succeeds');
  assert(!(await cs.getConditions('player', pcId)).includes('poisoned'), 'the poison is gone from the DB');

  const party = await cs.getPartyConditions(pcId);
  assert(party.companions.Lyra?.includes('frightened'), 'party conditions surface the companion by name');
  await cs.removeCondition('companion', lyraId, 'frightened');
}

// ---------------------------------------------------------------------------
group('7. Resolver — the poisoned PC rolls at disadvantage');
{
  await cs.addCondition('player', pcId, 'poisoned');
  const r = await rr.requestPcRoll({
    sessionId, characterId: pcId, kind: 'skill', name: 'Sleight of Hand',
    dc: 15, looks: 'a masterfully crafted lock'
  });
  assert(r.success && r.pending.advantage === 'disadvantage', 'pending roll carries forced disadvantage');
  assert(/poisoned/.test(r.pending.advantageReason || ''), 'the pending roll names the condition as the reason');
  // The example from the design fork: the dice come up 17 and 4.
  const res = await rr.resolveReportedRoll(sessionId, [17, 4]);
  assert(res.takenDie === 4, 'disadvantage takes the lower die — the 4 counts');
  assert(res.total === 9 && res.outcome === 'failure', 'total = 4 + 5 (DEX 16 + proficiency) vs DC 15 → failure');

  const cancel = await rr.requestPcRoll({
    sessionId, characterId: pcId, kind: 'skill', name: 'Sleight of Hand',
    dc: 15, looks: 'x', advantage: 'advantage', advantageReason: 'guidance'
  });
  assert(cancel.pending.advantage === null, 'marker advantage + condition disadvantage cancel to a straight roll');
  await rr.resolveReportedRoll(sessionId, [11]);
  await cs.removeCondition('player', pcId, 'poisoned');
}

// ---------------------------------------------------------------------------
group('8. Resolver — a paralyzed PC auto-fails a DEX save (no dice)');
{
  await cs.addCondition('player', pcId, 'paralyzed');
  const s2 = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
  const res = await pipeline.processResponseMarkers(
    'The trap detonates. [ROLL_REQUEST: Save="Dexterity" DC=13 Looks="a thunderclap of force"]',
    { characterId: pcId, sessionId: s2 });
  const h = res.handlerResults.find(x => x.schemaKey === 'ROLL_REQUEST');
  assert(h?.ok && h.result?.success === true && h.result?.autoFail === true, 'the handler reports an auto-fail, not a pending roll');
  assert((await rr.getPendingRoll(s2)) === null, 'no pending roll waits for dice that cannot matter');
  const log = await dbGet("SELECT outcome, source FROM roll_log WHERE session_id = ? ORDER BY id DESC LIMIT 1", [s2]);
  assert(log?.outcome === 'failure' && log?.source === 'auto', 'the auto-fail is in the permanent roll log');
  const cfg = JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [s2])).session_config || '{}');
  assert((cfg.recentRolls || []).some(x => x.autoFail), 'the outcome is stashed for next-turn fact injection');
  assert(rr.formatRollOutcomeBlock(h.result).includes('AUTO-FAIL'), 'the DM-facing block states the auto-fail');
  await cs.removeCondition('player', pcId, 'paralyzed');
}

// ---------------------------------------------------------------------------
group('9. Companions — the same enforcement through rollForNpc');
{
  await cs.addCondition('companion', lyraId, 'frightened');
  const chk = await rr.rollForNpc({
    sessionId, characterId: pcId, actorName: 'Lyra',
    kind: 'skill', name: 'Perception', dc: 12
  });
  assert(Array.isArray(chk.dice) && chk.dice.length === 2, 'frightened companion rolls two dice');
  assert(chk.takenDie === Math.min(...chk.dice), 'disadvantage takes the lower die');
  await cs.addCondition('companion', lyraId, 'paralyzed');
  const save = await rr.rollForNpc({
    sessionId, characterId: pcId, actorName: 'Lyra',
    kind: 'save', name: 'Dexterity', dc: 13
  });
  assert(save.autoFail === true && save.outcome === 'failure', 'paralyzed companion auto-fails the DEX save');
  await cs.removeCondition('companion', lyraId, 'frightened');
  await cs.removeCondition('companion', lyraId, 'paralyzed');
}

// ---------------------------------------------------------------------------
group('10. Combat — prone is advantaged against, invisible is not');
{
  await es.createEncounterEnemies(sessionId, 1, [
    { name: 'Goblin', maxHp: 7, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }
  ]);
  await cs.addCondition('companion', lyraId, 'prone');
  for (let i = 0; i < 6; i++) {
    const atk = await es.resolveEnemyAttack(sessionId, 1, 'Goblin',
      { type: 'companion', id: lyraId, armorClass: 13, name: 'Lyra' });
    assert(atk.attackMode === 'advantage' && Array.isArray(atk.attackRolls) && atk.attackRolls.length === 2,
      `prone target: attack ${i + 1} rolls two dice`);
    assert(atk.attackRoll === Math.max(...atk.attackRolls), `prone target: attack ${i + 1} takes the higher die`);
  }
  await cs.removeCondition('companion', lyraId, 'prone');
  await cs.addCondition('companion', lyraId, 'invisible');
  for (let i = 0; i < 3; i++) {
    const atk = await es.resolveEnemyAttack(sessionId, 1, 'Goblin',
      { type: 'companion', id: lyraId, armorClass: 13, name: 'Lyra' });
    assert(atk.attackMode === 'disadvantage' && atk.attackRoll === Math.min(...atk.attackRolls),
      `invisible target: attack ${i + 1} takes the lower die`);
  }
  await cs.removeCondition('companion', lyraId, 'invisible');
  const plain = await es.resolveEnemyAttack(sessionId, 1, 'Goblin',
    { type: 'player', id: pcId, armorClass: 14, name: 'Garrick' });
  assert(plain.attackRolls === undefined, 'a conditionless target is attacked with a single die, as before');
}

// ---------------------------------------------------------------------------
group('11. Long rest — exhaustion steps down for the whole party');
{
  // Top both actors up: group 10's goblins may have dropped Lyra, and a
  // 0-HP actor correctly gains no benefit from a rest.
  await dbRun('UPDATE companions SET companion_current_hp = 20 WHERE id = ?', [lyraId]);
  await dbRun('UPDATE characters SET current_hp = 30 WHERE id = ?', [pcId]);
  await cs.addCondition('player', pcId, 'exhaustion_2');
  await cs.addCondition('companion', lyraId, 'exhaustion_1');
  const r = await rt.applyRest({ sessionId, characterId: pcId, type: 'long' });
  assert(r.success, 'the long rest applies');
  assert((await cs.getConditions('player', pcId)).includes('exhaustion_1'), 'PC exhaustion 2 → 1');
  assert(!(await cs.getConditions('player', pcId)).includes('exhaustion_2'), 'the old level is gone');
  assert((await cs.getConditions('companion', lyraId)).filter(c => c.startsWith('exhaustion_')).length === 0,
    'companion exhaustion 1 → cleared');
  const pcLine = r.event.results.find(x => x.kind === 'pc');
  assert(pcLine.exhaustionAfter === 1, 'the rest result reports the new level');
  assert(rt.formatTimeEventBlock(r.event).includes('Exhaustion reduced to level 1'),
    'the DM-facing rest block states the step-down');
  await cs.removeCondition('player', pcId, 'exhaustion_1');
}

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(60)}`);
console.log(`pc-conditions: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);


