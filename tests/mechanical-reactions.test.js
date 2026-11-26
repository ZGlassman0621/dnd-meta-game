// tests/mechanical-reactions.test.js — mechanical-reactions job
// (docs/pm/mechanical-reactions/BRIEF.md). Every reaction resolves
// through the engine: budget spent exactly once, a counter's slot spent
// only when it fires, a countered spell's slot NOT expended (2024 PHB
// Counterspell: "If that spell was cast with a spell slot, the slot
// isn't expended"), Shield applied, and a narration-only attempt
// producing no mechanical effect.
// Real services, real DB. Server-rolled saves (enemy / companion) are
// never assumed: both branches are modelled and asserted.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-mech-reactions-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const tl = await import(svc('server/services/turnLedgerService.js'));
const ct = await import(svc('server/services/combatTurnService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const wid = await import(svc('server/services/worldIdService.js'));
const ast = await import(svc('server/services/actionStateService.js'));
const ess = await import(svc('server/services/enemySpellService.js'));
const rs = await import(svc('server/services/reactionService.js'));
const conc = await import(svc('server/services/concentrationService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers combat markers
await import(svc('server/services/spellCastService.js')); // registers SPELL_CAST
await import(svc('server/services/rollRequestService.js'));
await import(svc('server/services/subclassMarkerService.js')); // BEND_LUCK
await import(svc('server/services/artificerService.js')); // ARTIFICER_FLASH

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

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
  const r = await dbRun(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
  return Number(r.lastInsertRowid);
}

let wseq = 0;
async function addPc(over = {}) {
  const id = await insertRow('characters', {
    name: 'Tester', class: 'Wizard', level: 5,
    current_hp: 40, max_hp: 40, armor_class: 12,
    ability_scores: JSON.stringify({ str: 10, dex: 14, con: 12, int: 16, wis: 12, cha: 8 }),
    skills: JSON.stringify([]),
    spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }),
    spell_slots_used: JSON.stringify({}),
    class_resources_json: '{"used":{}}',
    world_id: `pc-mr-${++wseq}`,
    ...over,
  });
  return dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}

async function addCompanion(name, pcId, over = {}) {
  const npcId = await insertRow('npcs', { name });
  await wid.assignWorldId('npcs', npcId);
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    companion_spell_slots_used: JSON.stringify({}),
    progression_type: 'class_based', companion_level: 3, companion_class: 'Cleric',
    companion_ability_scores: JSON.stringify({ str: 12, dex: 12, con: 14, int: 10, wis: 16, cha: 8 }),
    companion_current_hp: 24, companion_max_hp: 24, armor_class: 14,
    class_resources_json: '{"used":{}}',
    ...over,
  });
  return dbGet('SELECT * FROM companions WHERE id = ?', [id]);
}

async function addSession(pcId) { return insertRow('dm_sessions', { character_id: pcId, status: 'active' }); }

async function markerResult(text, characterId, sessionId, key) {
  const res = await pipeline.processResponseMarkers(text, { characterId, sessionId });
  const h = res.handlerResults.filter((hr) => hr.schemaKey === key);
  return h.length ? h[0].result : null;
}
async function cfg(sessionId) {
  const row = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  try { return JSON.parse(row?.session_config || '{}'); } catch { return {}; }
}
async function enemySlots(enemyRowId) {
  const row = await dbGet('SELECT enemy_spell_slots_json FROM combat_enemies WHERE id = ?', [enemyRowId]);
  try { return JSON.parse(row?.enemy_spell_slots_json || '{}'); } catch { return {}; }
}
async function pcUsed(pcId, lvl) {
  const row = await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [pcId]);
  try { return Number(JSON.parse(row?.spell_slots_used || '{}')[String(lvl)] || 0); } catch { return 0; }
}
async function compUsed(compId, lvl) {
  const row = await dbGet('SELECT companion_spell_slots_used FROM companions WHERE id = ?', [compId]);
  try { return Number(JSON.parse(row?.companion_spell_slots_used || '{}')[String(lvl)] || 0); } catch { return 0; }
}
async function enemyHp(id) { return (await dbGet('SELECT current_hp FROM combat_enemies WHERE id = ?', [id]))?.current_hp; }
const reactionFree = (sessionId, name) => rs.hasReactionAvailable(sessionId, 1, name);

const arch = (name = 'Archmage') => ({ name, maxHp: 60, armorClass: 15, attackBonus: 3, damageDice: '1d6', dexMod: 1 });
const gob = (name) => ({ name, maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 });
async function order(sessionId, entries) { await ct.initializeTurnOrder(sessionId, 1, entries); }
const pcKey = (pc) => tl.ledgerKeyForPlayer(pc.id);
const compKey = (comp) => tl.ledgerKeyForCompanion(comp);
const enemyKey = (sessionId, row) => `combat:${sessionId}:1:${row.id}`;

// ---------------------------------------------------------------------------
group('1. Enemy Counterspell vs a PLAYER cast: pays on fire; a countered spell keeps its slot');
{
  for (const saveTotal of [2, 25]) {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
    ]);
    const arm = await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Counterspell" Level=3 Reaction="true" Target="Tester"]', pc.id, sessionId, 'ENEMY_CAST');
    ok(arm && arm.counterArmed === true, 'enemy Counterspell arms');
    ok(Number((await enemySlots(mage.id))['3']) === 3, 'arming spends NO enemy slot (bestiary 3 seeded, 3 left)');
    ok(await reactionFree(sessionId, 'Archmage'), 'arming spends NO enemy reaction');
    const hpBefore = await enemyHp(mage.id);
    const r = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="Archmage"]', pc.id, sessionId, 'SPELL_CAST');
    ok(r && r.countered === 'pending', 'PC cast pends on its Constitution save');
    ok(Number((await enemySlots(mage.id))['3']) === 2, 'the counter fired: its 3rd-level slot spent now (2 left)');
    ok(!(await reactionFree(sessionId, 'Archmage')), 'the counter fired: Archmage reaction spent now');
    ok((await pcUsed(pc.id, 1)) === 1, 'PC slot reserved at declaration');
    const c = await cfg(sessionId);
    const out = await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: saveTotal, dc: 17 });
    if (saveTotal < 17) {
      ok(out && out.countered === true && out.slotRefunded === true, 'failed save: countered, slot refunded');
      ok((await pcUsed(pc.id, 1)) === 0, 'countered spell: the PC slot is NOT expended');
      ok((await enemyHp(mage.id)) === hpBefore, 'countered spell had no effect (no damage pending or applied)');
      ok(!(await cfg(sessionId)).pendingSpellEffect, 'countered spell left no pending damage total');
    } else {
      ok(out && out.countered === false && !out.slotRefunded, 'made save: the spell goes through, no refund');
      ok((await pcUsed(pc.id, 1)) === 1, 'spell that goes through spends its slot exactly once');
    }
    ok(Number((await enemySlots(mage.id))['3']) === 2, 'counter slot spent exactly once either way');
  }
}

// ---------------------------------------------------------------------------
group('2. Enemy Counterspell vs a COMPANION cast: slot unspent when countered, spent when not');
{
  const pc = await addPc({ class: 'Fighter' });
  const sessionId = await addSession(pc.id);
  const wren = await addCompanion('Wren', pc.id);
  const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
  await order(sessionId, [
    { name: 'Wren', type: 'companion', key: await compKey(wren) },
    { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
  ]);
  await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Counterspell" Level=3 Reaction="true"]', pc.id, sessionId, 'ENEMY_CAST');
  const r = await markerResult('[SPELL_CAST: Caster="Wren" Spell="Cure Wounds" Level=1 Target="Tester"]', pc.id, sessionId, 'SPELL_CAST');
  ok(r && r.success === true, 'companion cast resolves under the counter');
  if (r.countered === true) {
    ok(r.slotConsumed === false && (await compUsed(wren.id, 1)) === 0, 'countered: the companion slot is NOT expended');
  } else {
    ok((await compUsed(wren.id, 1)) === 1, 'save made: the companion slot is spent once');
  }
  ok(Number((await enemySlots(mage.id))['3']) === 2 && !(await reactionFree(sessionId, 'Archmage')), 'counter paid slot + reaction once, on fire');
  ok((await ess.takeEnemyCounter(sessionId, 1, 'Wren')) === null, 'counter consumed');
}

// ---------------------------------------------------------------------------
group('3. Party Counterspell vs an ENEMY cast: pays on fire; countered enemy keeps its slot');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
  await order(sessionId, [
    { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
  ]);
  const res = await pipeline.processResponseMarkers('[SPELL_CAST: Spell="Counterspell" Level=3 Target="Archmage" Reaction="true"] [ENEMY_CAST: Enemy="Archmage" Spell="Lightning Bolt" Level=3 Target="Player"]', { characterId: pc.id, sessionId });
  const arm = res.handlerResults.find((h) => h.schemaKey === 'SPELL_CAST').result;
  const ec = res.handlerResults.find((h) => h.schemaKey === 'ENEMY_CAST').result;
  ok(arm && arm.counterArmed === true && arm.slotConsumed === false, 'arm result: armed, nothing spent at arm');
  ok((await pcUsed(pc.id, 3)) === 1, 'the counter fired: the PC 3rd-level slot spent exactly once');
  ok(!(await reactionFree(sessionId, 'Tester')), 'the counter fired: the PC reaction spent');
  if (ec.countered === true) {
    ok(ec.slotRefunded === true && Number((await enemySlots(mage.id))['3']) === 3, 'countered enemy spell: its slot is NOT expended (3 of 3 left)');
    ok(!(await cfg(sessionId)).pendingEnemySpellEffect, 'countered enemy spell had no effect (no save asked)');
  } else {
    ok(Number((await enemySlots(mage.id))['3']) === 2, 'enemy save made: its spell goes through and spends its slot');
    ok(ec.targets && ec.targets[0].pending === true, 'uncountered spell resolves (PC save pends)');
  }
}

// ---------------------------------------------------------------------------
group('4. A counter that answers nothing spends nothing');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
  await order(sessionId, [
    { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
  ]);
  const arm = await markerResult('[SPELL_CAST: Spell="Counterspell" Level=3 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
  ok(arm && arm.counterArmed === true, 'party counter arms');
  ok((await pcUsed(pc.id, 3)) === 0 && (await reactionFree(sessionId, 'Tester')), 'no enemy cast followed: no PC slot, no PC reaction spent');
  // Enemy counter that expires unused at round end: nothing spent.
  await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Counterspell" Level=3 Reaction="true"]', pc.id, sessionId, 'ENEMY_CAST');
  await ct.advanceTurn(sessionId, 1); // Tester
  await ct.advanceTurn(sessionId, 1); // round 2: Archmage
  ok((await ess.takeEnemyCounter(sessionId, 1, 'Tester')) === null, 'enemy counter expired at round end');
  ok(Number((await enemySlots(mage.id))['3']) === 3, 'expired enemy counter spent no slot');
  // Only one counter fires per reaction: two arms, one reaction.
  const pc2 = await addPc();
  const s2 = await addSession(pc2.id);
  const [m2] = await es.createEncounterEnemies(s2, 1, [arch()]);
  await order(s2, [
    { name: 'Archmage', type: 'enemy', key: enemyKey(s2, m2) },
    { name: 'Tester', type: 'player', key: await pcKey(pc2) },
  ]);
  await pipeline.processResponseMarkers('[SPELL_CAST: Spell="Counterspell" Level=3 Reaction="true"] [SPELL_CAST: Spell="Counterspell" Level=3 Reaction="true"] [ENEMY_CAST: Enemy="Archmage" Spell="Fire Bolt" Level=0 Target="Player"]', { characterId: pc2.id, sessionId: s2 });
  ok((await pcUsed(pc2.id, 3)) === 1, 'two armed counters, one reaction: exactly one slot spent');
}

// ---------------------------------------------------------------------------
group('5. An enemy who can no longer pay does not fire; the cast goes on untouched');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
  await order(sessionId, [
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
  ]);
  await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Counterspell" Level=3 Reaction="true"]', pc.id, sessionId, 'ENEMY_CAST');
  await rs.useReaction(sessionId, 1, 'Archmage'); // e.g. an opportunity attack took it
  const r = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="Archmage"]', pc.id, sessionId, 'SPELL_CAST');
  ok(r && r.success === true && r.countered !== 'pending' && r.countered !== true, 'counter did not fire: the cast resolves normally');
  ok((await pcUsed(pc.id, 1)) === 1, 'the uncountered cast spends its slot');
  ok(Number((await enemySlots(mage.id))['3']) === 3, 'the counter that did not fire spent no slot');
}

// ---------------------------------------------------------------------------
group('6. Readied spell: readying is a cast — the counter answers the hold');
{
  for (const saveTotal of [2, 25]) {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
    ]);
    await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Counterspell" Level=3 Reaction="true"]', pc.id, sessionId, 'ENEMY_CAST');
    const r = await markerResult('[READY: Target="Tester" Action="Cast Magic Missile" Spell="Magic Missile" Level=1 Trigger="the mage moves"]', pc.id, sessionId, 'READY');
    ok(r && r.countered === 'pending' && r.slotConsumed === false, 'readied spell pends on the counter save, no slot yet');
    ok(Number((await enemySlots(mage.id))['3']) === 2, 'the counter fired on the hold: its slot spent');
    const c = await cfg(sessionId);
    const out = await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: saveTotal, dc: 17 });
    const entry = await ast.getEntry(sessionId, 1, await pcKey(pc));
    if (saveTotal < 17) {
      ok(out && out.countered === true, 'failed save: the readied spell is countered');
      ok((await pcUsed(pc.id, 1)) === 0, 'countered hold: the slot is NOT expended');
      ok(!entry.ready, 'countered hold: nothing is readied');
    } else {
      ok(out && out.countered === false && out.completed?.success === true, 'made save: the spell is held');
      ok((await pcUsed(pc.id, 1)) === 1, 'held spell spends its slot exactly once');
      ok(entry.ready?.heldSpell?.spell === 'Magic Missile', 'the ready is stored with the held spell');
      ok(String(await conc.getConcentration(pc.id)).toLowerCase() === 'magic missile', 'holding takes concentration');
    }
  }
}

// ---------------------------------------------------------------------------
group('7. Shield: +5 AC on the enemy attack path, one reaction');
{
  const pc = await addPc({ armor_class: 12 });
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
  ]);
  const s = await markerResult('[SPELL_CAST: Spell="Shield" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
  ok(s && s.shieldSet === true && (await pcUsed(pc.id, 1)) === 1, 'Shield sets and spends one slot');
  ok(!(await reactionFree(sessionId, 'Tester')), 'Shield spends the reaction');
  const again = await markerResult('[SPELL_CAST: Spell="Shield" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
  ok(again && again.success === false && /reaction already used/.test(again.reason || ''), 'a second reaction the same round is refused');
  ok((await pcUsed(pc.id, 1)) === 1, 'the refused second Shield spent no slot');
  const atk = await markerResult('[ENEMY_ATTACK: Enemy="GobA" Target="Player"]', pc.id, sessionId, 'ENEMY_ATTACK');
  const a = atk?.attack || atk;
  ok(a && a.targetAc === 17, 'the enemy attack is judged against AC 12 + 5');
}

// ---------------------------------------------------------------------------
group('8. Opportunity attacks and readied attacks: one reaction each');
{
  const pc = await addPc({ class: 'Fighter' });
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
  ]);
  const oa1 = await markerResult('[OPPORTUNITY_ATTACK: Attacker="GobA" Target="Player"]', pc.id, sessionId, 'OPPORTUNITY_ATTACK');
  ok(oa1 && oa1.success === true && oa1.reactionConsumed === true, 'first opportunity attack resolves and spends the reaction');
  const oa2 = await markerResult('[OPPORTUNITY_ATTACK: Attacker="GobA" Target="Player"]', pc.id, sessionId, 'OPPORTUNITY_ATTACK');
  ok(oa2 && oa2.success === false, 'a second opportunity attack the same round is refused');
  // Readied Dodge fires once.
  await markerResult('[READY: Target="Tester" Action="Dodge" Trigger="the goblin charges"]', pc.id, sessionId, 'READY');
  const f1 = await markerResult('[DODGE: Target="Tester" Ready="true"]', pc.id, sessionId, 'DODGE');
  ok(f1 && f1.success !== false, 'readied Dodge fires on the reaction');
  const f2 = await markerResult('[DODGE: Target="Tester" Ready="true"]', pc.id, sessionId, 'DODGE');
  ok(f2 && f2.success === false, 'the ready cannot fire twice');
}

// ---------------------------------------------------------------------------
group('9. Bend Luck is a reaction: spent once in a fight, refused without one');
{
  const pc = await addPc({ name: 'Mira', class: 'sorcerer', subclass: 'wild_magic_sorcery', level: 6,
    ability_scores: JSON.stringify({ str: 10, dex: 12, con: 14, int: 10, wis: 10, cha: 16 }) });
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    { name: 'Mira', type: 'player', key: await pcKey(pc) },
  ]);
  const b1 = await markerResult('[BEND_LUCK: Target="Mira" Roll="attack" Direction="penalty"]', pc.id, sessionId, 'BEND_LUCK');
  ok(b1 && b1.success === true && b1.reactionSpent === true, 'Bend Luck resolves and spends the reaction');
  ok(!(await reactionFree(sessionId, 'Mira')), 'Mira has no reaction left this round');
  const used1 = b1.sorceryUsed;
  const b2 = await markerResult('[BEND_LUCK: Target="Mira" Roll="attack" Direction="penalty"]', pc.id, sessionId, 'BEND_LUCK');
  ok(b2 && b2.success === false && /reaction already used/.test(b2.reason || ''), 'a second Bend Luck the same round is refused');
  const row = await dbGet('SELECT class_resources_json FROM characters WHERE id = ?', [pc.id]);
  const sorceryUsed = Number(JSON.parse(row.class_resources_json || '{}')?.used?.sorcery || 0);
  ok(used1 === 1 && sorceryUsed === 1, `the refused Bend Luck spent no sorcery point (used ${sorceryUsed}, expected 1)`);
}

// ---------------------------------------------------------------------------
group('10. Flash of Genius is a reaction: spent only when the bonus flips the failure');
{
  const pc = await addPc({ name: 'Ada', class: 'artificer', level: 3,
    ability_scores: JSON.stringify({ str: 10, dex: 12, con: 14, int: 16, wis: 10, cha: 8 }) });
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
  await order(sessionId, [
    { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    { name: 'Ada', type: 'player', key: await pcKey(pc) },
  ]);
  const miss = await markerResult('[ARTIFICER_FLASH: Target="Ada" Total="5" DC="15"]', pc.id, sessionId, 'ARTIFICER_FLASH');
  ok(miss && miss.success === false && (await reactionFree(sessionId, 'Ada')), 'a Flash that cannot flip the roll spends no reaction');
  const hit = await markerResult('[ARTIFICER_FLASH: Target="Ada" Total="13" DC="15"]', pc.id, sessionId, 'ARTIFICER_FLASH');
  ok(hit && hit.success === true && hit.flips === true && hit.reactionSpent === true, 'a flipping Flash spends the reaction');
  const again = await markerResult('[ARTIFICER_FLASH: Target="Ada" Total="13" DC="15"]', pc.id, sessionId, 'ARTIFICER_FLASH');
  ok(again && again.success === false && /reaction already used/.test(again.reason || ''), 'a second Flash the same round is refused');
}

// ---------------------------------------------------------------------------
group('11. Narration-only reactions produce no mechanical effect');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
  await order(sessionId, [
    { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
  ]);
  await pipeline.processResponseMarkers('The archmage snaps out a counterspell and raises a shimmering shield as you cast.', { characterId: pc.id, sessionId });
  ok((await ess.takeEnemyCounter(sessionId, 1, 'Tester')) === null, 'narrated counterspell arms nothing');
  ok((await ess.shieldBonusFor(sessionId, 1, enemyKey(sessionId, mage))) === 0, 'narrated shield gives no AC');
  ok(await reactionFree(sessionId, 'Archmage'), 'narration spends no reaction');
  const noFlag = await markerResult('[SPELL_CAST: Spell="Counterspell" Level=3]', pc.id, sessionId, 'SPELL_CAST');
  ok(noFlag && noFlag.counterArmed === true && (await pcUsed(pc.id, 3)) === 0, 'Counterspell without the flag is still a reaction: it arms, spends nothing until it fires');
  const fb = await markerResult('[SPELL_CAST: Spell="Fire Bolt" Level=0 Target="Archmage" Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
  ok(fb && fb.success === false && /not a reaction spell/.test(fb.reason || ''), 'a non-reaction spell flagged as a reaction is still refused');
}

// ---------------------------------------------------------------------------
group('12. The DM prompt states the book slot rule');
{
  const src = fs.readFileSync(path.join(REPO, 'server/services/dmPromptBuilder.js'), 'utf8');
  ok(!/fizzles with its slot spent/.test(src), 'old wrong rule ("fizzles with its slot spent") is gone');
  ok(/its slot is NOT spent/.test(src), 'prompt says a countered spell keeps its slot');
  for (const f of ['enemySpellService.js', 'displayService.js']) {
    const s = fs.readFileSync(path.join(REPO, 'server/services', f), 'utf8');
    ok(!/slot stays spent/.test(s), `${f}: no DM notice claims a countered slot stays spent`);
  }
}

// ---------------------------------------------------------------------------
group('13. A declared reaction spell the DM narrated without a marker is flagged (live-probe finding)');
{
  const { verifyDeclaredReactionCast, buildRuleCorrectionMessage } = await import(svc('server/services/ruleVerifiers.js'));
  const narrated = verifyDeclaredReactionCast('I cast Shield (1st-level slot) as my reaction.', 'A shimmering veil of arcane energy flares into existence around you.');
  ok(!narrated.ok && narrated.violations[0].spell === 'Shield', 'cast Shield + no marker -> flagged');
  const marked = verifyDeclaredReactionCast('I cast Shield as my reaction.', 'A veil flares. [SPELL_CAST: Spell="Shield" Level=1 Reaction="true"]');
  ok(marked.ok, 'cast Shield + its SPELL_CAST marker -> clean');
  ok(verifyDeclaredReactionCast('I raise my shield and brace.', 'You brace behind the oak shield.').ok, 'an ordinary shield is never flagged');
  ok(!verifyDeclaredReactionCast('I cast counterspell at the mage!', 'Your words tear at his spell.').ok, 'Counterspell declared without a marker -> flagged');
  const note = buildRuleCorrectionMessage(narrated.violations);
  ok(/SPELL_CAST: Spell="Shield"/.test(note) && /never narration/.test(note), 'the DM correction names the marker to emit');
  const { stripMarkers } = await import(svc('server/services/markerStrip.js'));
  const echoed = stripMarkers('[SPELL NOTICE — system facts for the DM. Ask Tester for a Constitution save vs counterspell DC 17.]\n\nThe darts fray. [COUNTERSPELL — system fact: the player failed.] [OOC: Recruit Lyra?]');
  ok(!/DC 17|system fact|SPELL NOTICE/.test(echoed), 'an echoed engine block (with its hidden DC) never reaches the player');
  ok(/\[OOC: Recruit Lyra\?\]/.test(echoed) && /The darts fray\./.test(echoed), 'narration and [OOC: …] survive the strip');
  const route = fs.readFileSync(path.join(REPO, 'server/routes/dmSession.js'), 'utf8');
  ok(/verifyDeclaredReactionCast\(action/.test(route), 'the turn route runs the check on the player action');
  ok(/COUNTERSPELL — system fact/.test(route) && /pendingEffectOutcome\?\.slot === 'pendingCounteredCast'/.test(route), 'a countered cast is a binding engine fact on the roll turn');
}

// ---------------------------------------------------------------------------
// PM decision 2026-11-25: pause and ask the player about THEIR reactions.
const ro = await import(svc('server/services/reactionOfferService.js'));
const brute = (name) => ({ name, maxHp: 60, armorClass: 5, attackBonus: 30, damageDice: '1d6', dexMod: 1 });
async function shieldPc(over = {}) {
  return addPc({ armor_class: 12, known_spells: JSON.stringify(['Shield', 'Counterspell', 'Magic Missile']), ...over });
}
async function pcHp(id) { return (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [id]))?.current_hp; }

group('14. Shield offer: a hit on the player pauses before damage; accept re-judges at +5');
{
  for (const answer of ['accept', 'pass']) {
    const pc = await shieldPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [brute('Brute')]);
    await order(sessionId, [
      { name: 'Brute', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    const hp0 = await pcHp(pc.id);
    const r = await markerResult('[ENEMY_ATTACK: Enemy="Brute" Target="Player"]', pc.id, sessionId, 'ENEMY_ATTACK');
    if (!r.held) {
      ok(r.hit === false && r.isFumble === true, 'only a natural 1 misses at +30 — no hit, no offer');
      continue;
    }
    ok(/Cast Shield/.test(r.reactionOffer || ''), 'the hit pauses with a Shield question');
    ok((await pcHp(pc.id)) === hp0, 'no damage while the player decides');
    ok(await reactionFree(sessionId, 'Tester') && (await pcUsed(pc.id, 1)) === 0, 'nothing spent before the answer');
    const out = await ro.resolveOffer(sessionId, answer);
    const landed = out.results[0].result;
    if (answer === 'accept') {
      ok((await pcUsed(pc.id, 1)) === 1 && !(await reactionFree(sessionId, 'Tester')), 'accept: one 1st-level slot and the reaction spent');
      ok(landed.targetAc === 17, 'accept: the attack is re-judged against AC 12 + 5');
      ok(landed.hit === (landed.isCrit || landed.totalToHit >= 17), 'accept: hit only if the total still reaches 17 (or a crit)');
    } else {
      ok((await pcUsed(pc.id, 1)) === 0 && (await reactionFree(sessionId, 'Tester')), 'pass: no slot, no reaction spent');
      ok(landed.hit === true && (await pcHp(pc.id)) === Math.max(0, hp0 - landed.damage), 'pass: the hit lands with its damage');
    }
    ok(!(await ro.getOffer(sessionId)), 'the offer is cleared');
  }
  // No offer when Shield is unknown or the reaction is used.
  const pc = await addPc({ armor_class: 12 });
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [brute('Brute')]);
  await order(sessionId, [{ name: 'Brute', type: 'enemy', key: enemyKey(sessionId, g) }, { name: 'Tester', type: 'player', key: await pcKey(pc) }]);
  const r = await markerResult('[ENEMY_ATTACK: Enemy="Brute" Target="Player"]', pc.id, sessionId, 'ENEMY_ATTACK');
  ok(!r.held && !(await ro.getOffer(sessionId)), 'Shield not known: no question, the attack resolves');
  const pc2 = await shieldPc();
  const s2 = await addSession(pc2.id);
  const [g2] = await es.createEncounterEnemies(s2, 1, [brute('Brute')]);
  await order(s2, [{ name: 'Brute', type: 'enemy', key: enemyKey(s2, g2) }, { name: 'Tester', type: 'player', key: await pcKey(pc2) }]);
  await rs.useReaction(s2, 1, 'Tester');
  const r2 = await markerResult('[ENEMY_ATTACK: Enemy="Brute" Target="Player"]', pc2.id, s2, 'ENEMY_ATTACK');
  ok(!r2.held, 'reaction already used: no question');
}

group('15. Counterspell offer: an enemy cast pauses before it resolves');
{
  for (const answer of ['accept', 'pass']) {
    const pc = await shieldPc();
    const sessionId = await addSession(pc.id);
    const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
    await order(sessionId, [{ name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) }, { name: 'Tester', type: 'player', key: await pcKey(pc) }]);
    const r = await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Lightning Bolt" Level=3 Target="Player"]', pc.id, sessionId, 'ENEMY_CAST');
    ok(r && r.held === true && /Cast Counterspell/.test(r.reactionOffer || ''), 'the cast pauses with a Counterspell question');
    ok(!(await cfg(sessionId)).pendingEnemySpellEffect, 'the spell has not resolved yet');
    ok(Number((await enemySlots(mage.id))['3']) === 2, 'the enemy slot is spent (the casting is under way)');
    const out = await ro.resolveOffer(sessionId, answer);
    if (answer === 'accept') {
      ok((await pcUsed(pc.id, 3)) === 1 && !(await reactionFree(sessionId, 'Tester')), 'accept: the level-3 slot and the reaction spent');
      const countered = /is countered/.test(out.lines.join(' '));
      if (countered) {
        ok(Number((await enemySlots(mage.id))['3']) === 3, 'countered: the enemy slot is not expended');
        ok(!(await cfg(sessionId)).pendingEnemySpellEffect, 'countered: no effect');
      } else {
        ok((await cfg(sessionId)).pendingEnemySpellEffect?.spell === 'Lightning Bolt', 'save made: the spell resolves (player save asked)');
      }
    } else {
      ok((await pcUsed(pc.id, 3)) === 0 && (await reactionFree(sessionId, 'Tester')), 'pass: nothing spent');
      ok((await cfg(sessionId)).pendingEnemySpellEffect?.spell === 'Lightning Bolt', 'pass: the spell resolves');
    }
  }
}

group('16. Markers after a paused one queue and replay; DM-written player reactions become questions');
{
  const pc = await shieldPc();
  const sessionId = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sessionId, 1, [brute('Brute')]);
  await order(sessionId, [{ name: 'Brute', type: 'enemy', key: enemyKey(sessionId, g) }, { name: 'Tester', type: 'player', key: await pcKey(pc) }]);
  const res = await pipeline.processResponseMarkers('[ENEMY_ATTACK: Enemy="Brute" Target="Player"] [ENEMY_ATTACK: Enemy="Brute" Target="Player" Multiattack="true"]', { characterId: pc.id, sessionId });
  const [a1, a2] = res.handlerResults.filter((h) => h.schemaKey === 'ENEMY_ATTACK').map((h) => h.result);
  if (a1.held) {
    ok(a2 && a2.queued === true, 'the second swing waits behind the question');
    const out = await ro.resolveOffer(sessionId, 'pass');
    ok(/ENEMY_ATTACK/.test(out.replay) && /Multiattack="true"/.test(out.replay), 'the queued swing replays after the answer');
  } else {
    ok(true, 'first swing was a natural 1 (no question) — queue not exercised this run');
  }
  // The DM writes the player's opportunity attack on the goblin's turn.
  const pc2 = await addPc();
  const s2 = await addSession(pc2.id);
  const [g2] = await es.createEncounterEnemies(s2, 1, [gob('GobA')]);
  await order(s2, [{ name: 'GobA', type: 'enemy', key: enemyKey(s2, g2) }, { name: 'Tester', type: 'player', key: await pcKey(pc2) }]);
  const ex = await ro.extractPlayerReactions(s2, 1, pc2.id, 'GobA bolts. [OPPORTUNITY_ATTACK: Attacker="Player" Target="GobA"] [SPELL_CAST: Spell="Shield" Level=1]', 'Tester');
  ok(!/OPPORTUNITY_ATTACK|SPELL_CAST/.test(ex.text), 'player reactions are removed from the NPC turn text');
  ok(ex.offered && /opportunity attack/.test(ex.offered.prompt), 'the opportunity attack becomes a question');
  ok(ex.notes.some((n) => /Shield/.test(n) && /Never spend the player's reaction/.test(n)), 'the DM-written Shield is dropped with a note');
  ok(await reactionFree(s2, 'Tester'), 'nothing spent until the player answers');
  const out = await ro.resolveOffer(s2, 'accept');
  ok(/OPPORTUNITY_ATTACK: Attacker="Player" Target="GobA"/.test(out.replay), 'yes replays the exact marker');
  // Answers.
  ok(ro.parseOfferAnswer('Shield!', { kind: 'shield' }) === 'accept' && ro.parseOfferAnswer('pass', { kind: 'shield' }) === 'pass', 'Shield / pass parse');
  ok(ro.parseOfferAnswer("no, let it hit", {}) === 'pass' && ro.parseOfferAnswer('yes', {}) === 'accept', 'no / yes parse');
  ok(ro.parseOfferAnswer('What would happen if I let the goblin hit me and then ran for the door?', {}) === null, 'a long message is not an answer (the question stays open)');
}

group('17. The prompt fences unwired class-feature reactions');
{
  const src = fs.readFileSync(path.join(REPO, 'server/services/dmPromptBuilder.js'), 'utf8');
  ok(/never write the player's reaction on an NPC's turn/.test(src), 'prompt: the engine asks the player about their reactions');
  ok(/never state a number change \(damage reduced, AC raised, extra damage, HP\) the engine did not apply/.test(src), 'prompt: no number change the engine did not apply');
}

console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
