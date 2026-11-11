/**
 * Mechanics-hooks Family 8 — kind-H entity system tests.
 *
 * Covers Amendment 2 §3 (one system, two shapes): (a) separate-actor
 * rows in combat_allies — friendly-side, never a combat_enemies row —
 * with bestiary/registry numbers only, no invented statblocks; and (b)
 * form-state records on the actor row (Circle Forms reference, Dust
 * Devil, Frozen Haunt, Crown of Spellfire, Potted Plant first
 * consumer). Plus expiry/dismissal and the Extraneous Ego clone
 * boundary (row yes, character-row swap no — that is a follow-up).
 *
 * Same isolated-DB pattern as mechanics-hooks-markers.test.js.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mechanics-hooks-entities-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const entity = await import(fromRepo('server/services/entityService.js'));
const { createEncounterEnemies } = await import(fromRepo('server/services/enemyCombatService.js'));

let widCounter = 0;
function nextWorldId(prefix) { widCounter += 1; return `${prefix}-${widCounter}`; }

async function insertRow(table, overrides = {}) {
  const cols = await db.dbAll(`PRAGMA table_info(${table})`);
  const names = [];
  const values = [];
  for (const col of cols) {
    if (col.pk && col.type.toUpperCase().includes('INT')) continue;
    if (Object.prototype.hasOwnProperty.call(overrides, col.name)) {
      names.push(col.name); values.push(overrides[col.name]);
    } else if (col.notnull) {
      names.push(col.name);
      const t = col.type.toUpperCase();
      values.push(t.includes('INT') || t.includes('REAL') || t.includes('NUM') ? 0 : 'x');
    }
  }
  const placeholders = names.map(() => '?').join(',');
  const r = await db.dbRun(`INSERT INTO ${table} (${names.join(',')}) VALUES (${placeholders})`, values);
  return Number(r.lastInsertRowid);
}

function abilities({ str = 10, dex = 12, con = 14, int = 10, wis = 10, cha = 10 } = {}) {
  return JSON.stringify({ str, dex, con, int, wis, cha });
}

async function makePc({ name, cls, subclass, level, cha = 10, wis = 10, int = 10, hp = 40 } = {}) {
  return insertRow('characters', {
    name, class: cls, subclass, level,
    ability_scores: abilities({ cha, wis, int }),
    class_resources_json: '{"used":{}}',
    current_hp: hp, max_hp: hp,
    world_id: nextWorldId('pc'),
  });
}

async function makeCompanion(pcId, { name, cls, subclass, level, cha = 10, wis = 10, int = 10, hp = 40 } = {}) {
  const npcId = await insertRow('npcs', { name, world_id: nextWorldId('npc') });
  const compId = await insertRow('companions', {
    recruited_by_character_id: pcId, npc_id: npcId, status: 'active',
    companion_class: cls, companion_subclass: subclass, companion_level: level,
    companion_ability_scores: abilities({ cha, wis, int }),
    class_resources_json: '{"used":{}}',
    companion_current_hp: hp, companion_max_hp: hp,
  });
  return { npcId, compId };
}

async function makeSession(pcId) {
  return insertRow('dm_sessions', { character_id: pcId, session_config: '{}' });
}

async function enemyCount(sessionId) {
  return (await db.dbAll('SELECT id FROM combat_enemies WHERE session_id = ?', [sessionId])).length;
}

function owner(pcId, name) { return { kind: 'player', id: pcId, name }; }

// ---------------------------------------------------------------------------
group('1. Migration 112 — combat_allies exists with the friendly-side shape');
{
  const cols = await db.dbAll('PRAGMA table_info(combat_allies)');
  const names = cols.map((c) => c.name);
  assert(cols.length > 0, 'combat_allies table exists after migrations');
  for (const c of ['session_id', 'encounter_seq', 'name', 'kind', 'owner_kind', 'owner_id', 'owner_name',
    'max_hp', 'current_hp', 'temp_hp', 'armor_class', 'attack_bonus', 'damage_dice', 'dex_mod',
    'zone', 'status', 'stats_json', 'flags_json', 'expires_kind', 'expires_value']) {
    assert(names.includes(c), `combat_allies has column ${c}`);
  }
  const idx = await db.dbAll("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'combat_allies'");
  assert(idx.length >= 3, 'combat_allies has session/owner/kind indexes');
}

// ---------------------------------------------------------------------------
group('2. Friendly-side row — created in combat_allies, never in combat_enemies');
{
  const pcId = await makePc({ name: 'Mira', cls: 'sorcerer', subclass: 'wild_magic_sorcery', level: 6, cha: 16 });
  const sessionId = await makeSession(pcId);
  const before = await enemyCount(sessionId);
  const res = await entity.createFriendlyActor(sessionId, 1, {
    kind: 'surge_creature', name: 'Flumph', ownerKind: 'player', ownerId: pcId, ownerName: 'Mira',
    maxHp: 7, ac: 12, attackBonus: 0, damageDice: null, dexMod: 1,
    expiresKind: 'minutes', expiresValue: 1,
  });
  assert(res.success === true, 'createFriendlyActor succeeds for a known kind + owner');
  assert(res.ally?.status === 'active' && res.ally?.ownerName === 'Mira', 'row carries owner + active status');
  assert(await enemyCount(sessionId) === before, 'no combat_enemies row created');
  assert((await entity.listFriendlyActors(sessionId)).length === 1, 'row is listable as a friendly actor');
  assert(await entity.createFriendlyActor(sessionId, 1, {
    kind: 'dragon', name: 'Nope', ownerKind: 'player', ownerId: pcId, maxHp: 10, ac: 10,
  }).then((r) => r.success === false), 'unknown kind refuses');
  assert(await entity.createFriendlyActor(sessionId, 1, {
    kind: 'echo', name: 'Echo', ownerKind: 'player', ownerId: 99999, maxHp: 1, ac: 10,
  }).then((r) => r.success === false), 'unknown owner refuses');
  assert(await entity.createFriendlyActor(sessionId, 1, {
    kind: 'echo', name: 'Echo', ownerKind: 'player', ownerId: pcId, maxHp: 0, ac: 10,
  }).then((r) => r.success === false), 'maxHp below 1 refuses');
}

// ---------------------------------------------------------------------------
group('3. Bestiary constructors — registry/bestiary numbers, no invented statblocks');
{
  const pcId = await makePc({ name: 'Shade', cls: 'sorcerer', subclass: 'shadow_magic', level: 6, cha: 16 });
  const sessionId = await makeSession(pcId);
  const hound = await entity.createHoundOfIllOmen(sessionId, 1, owner(pcId, 'Shade'), { targetName: 'GobA', sorcererLevel: 6 });
  assert(hound.success === true, 'Hound created');
  assert(hound.ally.maxHp === 37 && hound.ally.armorClass === 14, 'Hound: dire wolf HP 37 / AC 14');
  assert(hound.ally.attackBonus === 5 && hound.ally.damageDice === '2d6+3', 'Hound: dire wolf bite +5, 2d6+3');
  assert(hound.ally.tempHp === 3, 'Hound temp HP = half Sorcerer level');
  assert(hound.ally.flags.typeOverride === 'monstrosity' && hound.ally.flags.sizeOverride === 'Medium',
    'Hound overrides: Medium monstrosity, not Large beast');

  const warId = await makePc({ name: 'Hex', cls: 'warlock', subclass: 'hexblade', level: 6, cha: 16 });
  const s2 = await makeSession(warId);
  const specter = await entity.createAccursedSpecter(s2, 1, owner(warId, 'Hex'), { warlockLevel: 6, chaMod: 3, slainName: 'GobA' });
  assert(specter.success === true, 'Specter created');
  assert(specter.ally.maxHp === 22 && specter.ally.armorClass === 12, 'Specter: HP 22 / AC 12');
  assert(specter.ally.attackBonus === 7, 'Specter attack bonus +4 base, +3 Cha');
  assert(specter.ally.damageDice === '3d6', 'Specter damage 3d6 necrotic');

  assert(entity.surgeCreatureKeyForRoll(1) === 'duodrone', 'surge d4 1 → Modron Duodrone');
  assert(entity.surgeCreatureKeyForRoll(2) === 'flumph', 'surge d4 2 → Flumph');
  assert(entity.surgeCreatureKeyForRoll(3) === 'monodrone', 'surge d4 3 → Modron Monodrone');
  assert(entity.surgeCreatureKeyForRoll(4) === 'unicorn', 'surge d4 4 → Unicorn');
  assert(entity.surgeCreatureKeyForRoll(5) === null, 'surge d4 outside 1–4 maps to nothing');
  const surge = await entity.createSurgeCreature(s2, 1, owner(warId, 'Hex'), { d4Roll: 2 });
  assert(surge.success === true && surge.ally.name === 'Flumph' && surge.ally.flags.dmControlled === true,
    'surge creature created from the d4 roll, DM-controlled');
  const badSurge = await entity.createSurgeCreature(s2, 1, owner(warId, 'Hex'), { d4Roll: 9 });
  assert(badSurge.success === false, 'surge creature refuses an out-of-range d4');

  const vOk = await entity.validateFaithfulBeast('Goat');
  assert(vOk.success === true, 'Goat validates for Faithful Summons (CR 0)');
  const vBad = await entity.validateFaithfulBeast('Owlbear');
  assert(vBad.success === false && /CR 3/.test(vBad.reason || ''), 'Owlbear fails validation (CR 3 > 2)');
  const beast = await entity.createFaithfulBeast(s2, 1, owner(warId, 'Hex'), { beastName: 'Goat' });
  assert(beast.success === true && beast.ally.maxHp === 4 && beast.ally.armorClass === 10, 'Goat: HP 4 / AC 10');
}
{
  const pcId = await makePc({ name: 'Rin', cls: 'ranger', subclass: 'beast_master', level: 5, wis: 16 });
  const sessionId = await makeSession(pcId);
  const comp = await entity.createPrimalCompanion(sessionId, 1, owner(pcId, 'Rin'), { statblock: 'Land', rangerLevel: 5, wisMod: 3, pb: 3 });
  assert(comp.success === true, 'Primal Companion (Land) created');
  assert(comp.ally.maxHp === 30 && comp.ally.armorClass === 16, 'Land beast: HP 5+5x5=30, AC 13+Wis=16');
  assert(comp.ally.damageDice === '1d8+2+3', 'Land strike 1d8+2+Wis');
  assert(comp.ally.flags.strikeRiders?.proneIfLargeOrSmaller === true, 'Land charge rider recorded');
  const comp2 = await entity.createPrimalCompanion(sessionId, 1, owner(pcId, 'Rin'), { statblock: 'Sky', rangerLevel: 5, wisMod: 3, pb: 3 });
  assert(comp2.success === false, 'a second Primal Companion refuses while one is active');
  const bad = await entity.createPrimalCompanion(sessionId, 1, owner(pcId, 'Rin'), { statblock: 'Pack', rangerLevel: 5, wisMod: 3, pb: 3 });
  assert(bad.success === false, 'an unknown statblock refuses');

  const artId = await makePc({ name: 'Tink', cls: 'artificer', subclass: 'battle_smith', level: 5, int: 16 });
  const s2 = await makeSession(artId);
  const def = await entity.createSteelDefender(s2, 1, owner(artId, 'Tink'), { artificerLevel: 5, intMod: 3, spellAttackBonus: 6 });
  assert(def.success === true, 'Steel Defender created');
  assert(def.ally.maxHp === 30 && def.ally.armorClass === 15, 'Defender: HP 5+5x5=30, AC 12+Int=15');
  assert(def.ally.damageDice === '1d8+2+3', 'Defender Rend 1d8+2+Int');
  assert(def.ally.flags.repairUsesMax === 3, 'Defender Repair 3/day recorded');
  assert((await entity.createSteelDefender(s2, 1, owner(artId, 'Tink'), { artificerLevel: 5, intMod: 3 })).success === false,
    'a second Steel Defender refuses (replace is a Long Rest flow)');

  const cannon = await entity.createEldritchCannon(s2, 1, owner(artId, 'Tink'), { artificerLevel: 5, option: 'protector' });
  assert(cannon.success === true, 'Eldritch Cannon created');
  assert(cannon.ally.maxHp === 25 && cannon.ally.armorClass === 18, 'Cannon: HP 5x5=25, AC 18');
  assert(cannon.ally.flags.option === 'protector', 'Cannon option recorded');
  assert((await entity.createEldritchCannon(s2, 1, owner(artId, 'Tink'), { artificerLevel: 5, option: 'flamethrower' })).success === false,
    'a second cannon refuses at max 1 (no Fortified Position)');
}
{
  const pcId = await makePc({ name: 'Faye', cls: 'fighter', subclass: 'echo_knight', level: 5, cha: 10 });
  const sessionId = await makeSession(pcId);
  const two = await entity.createEcho(sessionId, 1, owner(pcId, 'Faye'), { count: 2 });
  assert(two.success === true && two.allies.length === 2, 'Legion of One: two echoes coexist');
  assert(two.allies[0].armorClass === 17 && two.allies[0].maxHp === 1, 'Echo: AC 14+PB(3)=17, HP 1');
  assert(two.allies[0].flags.conditionImmune === true, 'Echo immune to all conditions');
  const third = await entity.createEcho(sessionId, 1, owner(pcId, 'Faye'), { count: 1 });
  assert(third.success === true && third.allies.length === 1, 'a third echo is created');
  const actives = await entity.listActiveFriendlyActors(sessionId, 1);
  assert(actives.length === 1 && actives[0].id === third.allies[0].id,
    'creating the third echo destroyed the previous two (Legion rule)');
  for (const old of two.allies) {
    const row = await entity.getFriendlyActor(old.id);
    assert(row.status === 'dismissed', 'previous echo is dismissed, not deleted');
  }
}

// ---------------------------------------------------------------------------
group('4. Damage / heal / dismiss — temp HP first, kill at 0, untargetable and necrotic-heal flags');
{
  const pcId = await makePc({ name: 'Shade', cls: 'sorcerer', subclass: 'shadow_magic', level: 6, cha: 16 });
  const sessionId = await makeSession(pcId);
  const hound = await entity.createHoundOfIllOmen(sessionId, 1, owner(pcId, 'Shade'), { targetName: 'GobA', sorcererLevel: 6 });
  const id = hound.ally.id;
  const d1 = await entity.applyDamageToAlly(id, 5);
  assert(d1.damageDealt === 5 && d1.tempAbsorbed === 3, 'damage hits temp HP first (3 absorbed)');
  let row = await entity.getFriendlyActor(id);
  assert(row.tempHp === 0 && row.currentHp === 35, 'remaining 2 damage lands on HP (37-2)');
  const h1 = await entity.healFriendlyActor(id, 10);
  assert(h1.healed === 2 && h1.currentHp === 37, 'healing caps at maximum HP');
  const d2 = await entity.applyDamageToAlly(id, 40);
  assert(d2.killed === true && d2.status === 'dead', '0 HP kills the ally');
  row = await entity.getFriendlyActor(id);
  assert(row.status === 'dead' && row.currentHp === 0, 'dead ally row keeps 0 HP');

  const druidId = await makePc({ name: 'Sable', cls: 'druid', subclass: 'circle_of_the_sand', level: 3, wis: 16 });
  const s2 = await makeSession(druidId);
  const spirit = await entity.createServantOfTheDesert(s2, 1, owner(druidId, 'Sable'), {});
  assert(spirit.success === true, 'Servant of the Desert created (flags-only row)');
  const d3 = await entity.applyDamageToAlly(spirit.ally.id, 20);
  assert(d3.damageDealt === 0 && d3.reason != null, 'the desert spirit cannot be damaged (attacks miss automatically)');
  row = await entity.getFriendlyActor(spirit.ally.id);
  assert(row.currentHp === 1 && row.status === 'active', 'untargetable spirit HP untouched');
  const dis = await entity.dismissFriendlyActor(spirit.ally.id, 'test dismiss');
  assert(dis.success === true && dis.ally.status === 'dismissed', 'dismiss marks the row, never deletes it');

  const unbornId = await makePc({ name: 'Mara', cls: 'druid', subclass: 'circle_of_the_unborn', level: 6, wis: 16 });
  const s3 = await makeSession(unbornId);
  const stilled = await entity.createStilledSpirit(s3, 1, owner(unbornId, 'Mara'), { beastKey: 'Wolf', druidLevel: 6 });
  assert(stilled.success === true, 'Stilled spirit created from a bestiary beast');
  assert(stilled.ally.flags.typeOverride === 'Undead', 'stilled spirit is Undead-typed');
  await entity.applyDamageToAlly(stilled.ally.id, 10);
  const d4 = await entity.applyDamageToAlly(stilled.ally.id, 10, { damageType: 'necrotic' });
  assert(d4.healed === 5, 'necrotic damage heals the stilled spirit for half');
}

// ---------------------------------------------------------------------------
group('5. Form-state records — Circle Forms reference, Potted Plant first consumer, revert rules');
{
  const pcId = await makePc({ name: 'Moira', cls: 'druid', subclass: 'circle_of_the_moon', level: 6, wis: 16, hp: 40 });
  const form = await entity.applyCircleForm('player', pcId, { beast: 'Brown Bear', wisMod: 3, druidLevel: 6 });
  assert(form.success === true, 'Circle Form applies for a CR-legal beast');
  assert(form.form?.ac === 16, 'Circle Form AC is max(beast 11, 13+Wis 16)');
  assert(form.form?.tempHp === 18, 'Circle Form temp HP is 3 x Druid level');
  assert(form.form?.maxCr === 2, 'Circle Form max CR is Druid level / 3');
  assert(form.form?.hpPool === 'own', 'the form has no second HP pool — the actor\'s own HP');
  const stored = await entity.getFormState('player', pcId);
  assert(stored?.beast === 'Brown Bear', 'form-state record persists on the actor row');
  const tooBig = await entity.applyCircleForm('player', pcId, { beast: 'Owlbear', wisMod: 3, druidLevel: 6 });
  assert(tooBig.success === false && /CR 3/.test(tooBig.reason || ''), 'a CR 3 beast refuses at Druid 6 (max CR 2)');
  const second = await entity.applyCircleForm('player', pcId, { beast: 'Wolf', wisMod: 3, druidLevel: 6 });
  assert(second.success === false && /already active/.test(second.reason || ''), 'a second form refuses while transformed');
  const cleared = await entity.clearFormState('player', pcId);
  assert(cleared.success === true && cleared.cleared === true, 'form clears');
  assert(await entity.getFormState('player', pcId) === null, 'no form record remains');

  const sorcId = await makePc({ name: 'Pip', cls: 'sorcerer', subclass: 'wild_magic_sorcery', level: 6, cha: 16, hp: 30 });
  const plant = await entity.applyPottedPlant('player', sorcId);
  assert(plant.success === true, 'Potted Plant applies');
  assert(plant.form?.kind === 'potted_plant' && plant.form?.vulnerableAll === true, 'plant records vulnerability to all damage');
  assert(plant.form?.until === 'start of next turn', 'plant reverts at the start of the next turn');
  const conds = await db.dbGet('SELECT active_conditions FROM characters WHERE id = ?', [sorcId]);
  assert(JSON.parse(conds.active_conditions || '[]').includes('incapacitated'), 'plant applies Incapacitated via conditionService');
  const noRevert = await entity.revertFormIfZeroHp('player', sorcId);
  assert(noRevert.reverted === false, 'no revert while the sorcerer has HP');
  await db.dbRun('UPDATE characters SET current_hp = 0 WHERE id = ?', [sorcId]);
  const reverted = await entity.revertFormIfZeroHp('player', sorcId);
  assert(reverted.reverted === true && reverted.form?.kind === 'potted_plant', '0 HP breaks the pot and reverts the form');
  const conds2 = await db.dbGet('SELECT active_conditions FROM characters WHERE id = ?', [sorcId]);
  assert(!JSON.parse(conds2.active_conditions || '[]').includes('incapacitated'), 'revert clears Incapacitated');

  const sandId = await makePc({ name: 'Dune', cls: 'druid', subclass: 'circle_of_the_sand', level: 14, wis: 18 });
  const devil = await entity.applyDustDevil('player', sandId, { druidLevel: 14, walkSpeed: 30 });
  assert(devil.success === true, 'Dust Devil applies');
  assert(devil.form?.resistances?.includes('cold') && devil.form?.resistances?.includes('fire'), 'Dust Devil resists cold + fire');
  assert(devil.form?.tempHpPerTurn === 14 && devil.form?.size === 'Large', 'Dust Devil temp HP is Druid level per turn, size Large');
  assert(devil.form?.aura?.radiusFt === 10, 'Dust Devil 10-ft heavily-obscured aura recorded');
  await entity.clearFormState('player', sandId);
  const haunt = await entity.applyFrozenHaunt('player', sandId);
  assert(haunt.success === true, 'Frozen Haunt applies');
  assert(haunt.form?.immunities?.includes('cold'), 'Frozen Haunt is cold-immune');
  assert(haunt.form?.conditionImmunities?.includes('grappled') && haunt.form?.emanation?.damage === '2d4 Cold',
    'Frozen Haunt condition immunities + 2d4 Cold emanation recorded');
  await entity.clearFormState('player', sandId);
  const crown = await entity.applyCrownOfSpellfire('player', sandId, { chaMod: 4 });
  assert(crown.success === true, 'Crown of Spellfire applies');
  assert(crown.form?.flySpeed === 60 && crown.form?.hover === true, 'Crown grants Fly 60 + hover');
  assert(crown.form?.burningLifeForceMaxDice === 4, 'Crown Burning Life Force caps at Cha mod dice');
  assert(crown.form?.spellAvoidance === true, 'Crown Spell Avoidance recorded');
}

// ---------------------------------------------------------------------------
group('6. Extraneous Ego — clone row yes, character-row swap NO (follow-up, not smuggled in)');
{
  const pcId = await makePc({ name: 'Bea', cls: 'warlock', subclass: 'beholder', level: 14, cha: 18, hp: 40 });
  const sessionId = await makeSession(pcId);
  const before = await db.dbGet('SELECT current_hp, max_hp FROM characters WHERE id = ?', [pcId]);
  const clone = await entity.createExtraneousEgoClone(sessionId, 1, owner(pcId, 'Bea'), {});
  assert(clone.success === true, 'Ego clone created');
  assert(clone.ally.maxHp === 20, 'clone HP is half the owner\'s maximum');
  assert(clone.ally.flags.deathSaveSuspended === true, 'death saves suspended for the original body while the clone lives');
  assert(clone.ally.flags.hpTransferOnVanish === true, 'HP transfer on vanish recorded');
  assert(clone.ally.flags.permanencePending === true, 'permanence rule flagged pending — NOT built here');
  const after = await db.dbGet('SELECT current_hp, max_hp FROM characters WHERE id = ?', [pcId]);
  assert(after.current_hp === before.current_hp && after.max_hp === before.max_hp,
    'the owner character row is untouched — no swap was smuggled in');
  assert((await entity.listFriendlyActors(sessionId)).length === 1, 'only the clone row exists');
}

// ---------------------------------------------------------------------------
group('7. Ox — no invented statblock; explicit transcribed stats required');
{
  const pcId = await makePc({ name: 'Ash', cls: 'artificer', subclass: 'lumberjack', level: 3, int: 16 });
  const sessionId = await makeSession(pcId);
  const noStats = await entity.createOx(sessionId, 1, owner(pcId, 'Ash'), {});
  assert(noStats.success === false && /not transcribed/.test(noStats.reason || ''), 'Ox refuses without transcribed stats');
  assert(await entity.listFriendlyActors(sessionId).then((l) => l.length) === 0, 'refused Ox creates no row');
  const withStats = await entity.createOx(sessionId, 1, owner(pcId, 'Ash'), {
    stats: { maxHp: 50, ac: 15, attackBonus: 5, damageDice: '2d6+3', goreBonus: '3d6' },
  });
  assert(withStats.success === true && withStats.ally.maxHp === 50, 'Ox creates with caller-supplied transcribed stats');
  assert(withStats.ally.flags.statsSource === 'source-document', 'Ox stats are marked source-document, not registry');
}

// ---------------------------------------------------------------------------
group('8. Expiry — turn-count sweep and long-rest dismissal');
{
  const pcId = await makePc({ name: 'Mira', cls: 'sorcerer', subclass: 'wild_magic_sorcery', level: 6, cha: 16 });
  const sessionId = await makeSession(pcId);
  const short = await entity.createFriendlyActor(sessionId, 1, {
    kind: 'echo', name: 'Echo of Mira', ownerKind: 'player', ownerId: pcId, ownerName: 'Mira',
    maxHp: 1, ac: 17, expiresKind: 'turns', expiresValue: 1,
  });
  assert(short.success === true, 'turns-expiry row created');
  const expired = await entity.decrementTurnExpiry(sessionId, 1);
  assert(expired.length === 1 && expired[0].id === short.ally.id, 'turn-count sweep expires the row at 0');
  assert((await entity.getFriendlyActor(short.ally.id)).status === 'expired', 'expired status recorded');
  const warId = await makePc({ name: 'Hex', cls: 'warlock', subclass: 'hexblade', level: 6, cha: 16 });
  const s2 = await makeSession(warId);
  const specter = await entity.createAccursedSpecter(s2, 1, owner(warId, 'Hex'), { warlockLevel: 6, chaMod: 3 });
  assert(specter.success === true, 'specter created (long_rest expiry)');
  const dismissed = await entity.dismissByExpiryKind(s2, 'long_rest');
  assert(dismissed.length === 1 && dismissed[0].id === specter.ally.id, 'long-rest dismissal expires long_rest rows');
  const ownerDismissed = await entity.dismissOwnerAllies(s2, 'player', warId, 'owner died');
  assert(ownerDismissed.length === 0, 'already-expired allies are not dismissed twice');
}

// ---------------------------------------------------------------------------
console.log(`\n mechanics-hooks-entities: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
