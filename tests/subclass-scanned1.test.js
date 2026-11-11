// tests/subclass-scanned1.test.js — Scanned Batch S1 (Xanathar part 1):
// Barbarian 2, Bard 2, Cleric 2, Druid 2, Fighter 3 = 11 new,
// registry 48 -> 59. Zealot and Glamour are NOT rebuilt here:
// they are already PHB 2024 entries and are asserted as still
// present from the PHB files, not duplicated.
// Real services, real DB, same pattern as earlier subclass tests.
//
// CONVERSION NOTE: these are 2014-era Xanathar subclasses.
// No 2024 reprint exists for any of them, so every S1 number
// is conversionCheck + gateCheck: the 2014 extract mapped onto
// the built 2024 class cadences (Barbarian 3/6/10/14, Bard
// 3/6/14, Cleric 3/6/17, Druid 3/6/10/14, Fighter 3/7/10/15/18).
// Cleric/Druid selection moved 1st/2nd -> 3rd; Cleric 2nd/8th
// features were re-pointed onto 3rd/6th; domain-spell tiers
// 1st+3rd collapsed into the 2024 3rd tier. See each entry's
// conversionCheck for its own mapping. Nothing here was
// authored from the mislabeled 2014 PHB Pt1/Pt2 scans.
//
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-subclass-scanned1-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const ss = await import(svc('server/services/subclassService.js'));
const { SPELL_DATA_ENTRIES } = await import(svc('server/data/spellCatalogData.js'));

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
  const r = await dbRun(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals
  );
  return Number(r.lastInsertRowid);
}

async function addPc(over = {}) {
  const id = await insertRow('characters', {
    name: 'Tester', class: 'Barbarian', level: 6,
    current_hp: 60, max_hp: 60, armor_class: 15,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 16, int: 10, wis: 12, cha: 10 }),
    skills: JSON.stringify([]),
    spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 3 }),
    spell_slots_used: JSON.stringify({}),
    ...over
  });
  return dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}

async function addCompanion(name, pcId, over = {}) {
  const npcId = await insertRow('npcs', { name });
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    companion_spell_slots_used: JSON.stringify({}),
    progression_type: 'class_based', companion_level: 6,
    companion_ability_scores: JSON.stringify({ str: 16, dex: 12, con: 16, int: 10, wis: 14, cha: 10 }),
    companion_current_hp: 50, companion_max_hp: 50, armor_class: 18,
    ...over
  });
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [id]);
  return { ...row, display_name: name };
}

const S1 = [
  ['barbarian', 'Path of the Ancestral Guardian'],
  ['barbarian', 'Path of the Storm Herald'],
  ['bard', 'College of Swords'],
  ['bard', 'College of Whispers'],
  ['cleric', 'Forge Domain'],
  ['cleric', 'Grave Domain'],
  ['druid', 'Circle of Dreams'],
  ['druid', 'Circle of the Shepherd'],
  ['fighter', 'Arcane Archer'],
  ['fighter', 'Cavalier'],
  ['fighter', 'Samurai'],
];

group('1. Registry counts and lookup (59 -> 75)');
ok(ss.listSubclasses('barbarian').length === 9, 'Barbarian file exports exactly 9 (4 PHB + 2 S1 + 1 S4) + 2 Additional');
ok(ss.listSubclasses('bard').length === 11, 'Bard file exports exactly 11 (4 PHB + 2 S1 + 1 S3 + 1 S4 + 1 S5) + 2 Additional');
ok(ss.listSubclasses('cleric').length === 11, 'Cleric file exports exactly 11 (4 PHB + 2 S1 + 1 S3 + 1 S4 + 1 S5) + 2 Additional');
ok(ss.listSubclasses('druid').length === 9, 'Druid file exports exactly 9 (4 PHB + 2 S1 + 1 S3 + 1 S4) + 1 Additional');
ok(ss.listSubclasses('fighter').length === 11, 'Fighter file exports exactly 11 (4 PHB + 3 S1 + 1 S3 + 1 S4 + 1 S5) + 1 Additional');
{
  const total = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'rogue', 'wizard', 'warlock', 'sorcerer', 'paladin', 'ranger']
    .reduce((a, c) => a + ss.listSubclasses(c).length, 0);
  ok(total === 118, 'Registry total is 118 (102 + 16 Additional across the 12 classes; artificer + new classes counted separately)');
}
for (const [cls, name] of S1) {
  ok(ss.getSubclass(cls, name) !== null, `${name} is in the registry`);
}
// PHB overlaps are NOT rebuilt: Zealot and Glamour stay PHB entries.
{
  const zealot = ss.getSubclass('barbarian', 'Path of the Zealot');
  ok(zealot && zealot.source === 'PHB 2024', 'Zealot remains the PHB 2024 entry, not an S1 duplicate');
  const glamour = ss.getSubclass('bard', 'College of Glamour');
  ok(glamour && glamour.source === 'PHB 2024', 'Glamour remains the PHB 2024 entry, not an S1 duplicate');
  ok(ss.listSubclasses('barbarian').filter((s) => s.key === 'path_of_the_zealot').length === 1, 'Zealot appears exactly once');
}

group('2. No still-null authorized subclass remains after S5');
for (const [cls, name] of [
  ['bard', 'College of the Moon'],
  ['cleric', 'Knowledge Domain'],
  ['fighter', 'Banneret'],
  ['paladin', 'Oath of the Noble Genies'],
  ['ranger', 'Winter Walker'],
  ['rogue', 'Scion of the Three'],
  ['sorcerer', 'Spellfire Sorcery'],
  ['wizard', 'Bladesinger'],
]) {
  ok(ss.getSubclass(cls, name) !== null, `${name} is now built in S5, no longer still-null`);
}

group('3. Selection levels, origins, conversion flags');
for (const [cls, name] of S1) {
  const e = ss.getSubclass(cls, name);
  ok(e.selectionLevel === 3, `${name} selects at 3rd (2024 cadence, not the 2014 1st/2nd)`);
  ok(e.origin_setting === 'Forgotten Realms' && e.origin_region === 'Forgotten Realms', `${name} is Forgotten Realms origin, no explanation required`);
  ok(e.sourceTier === 'scanned' && typeof e.conversionCheck === 'string' && e.conversionCheck.length > 0, `${name} carries a conversionCheck note`);
  ok(e.gateCheckRequired === true, `${name} is gateCheck-flagged`);
  ok(e.features.every((f) => f.kind && f.prompt && f.gateCheck === true), `${name} every feature has a kind, a prompt, and gateCheck`);
  ok(!ss.validateSelection({ className: cls, subclassName: name, level: 2 }).complete, `${name} at level 2 is incomplete (selection is 3rd)`);
  ok(ss.validateSelection({ className: cls, subclassName: name, level: 3, originExplanation: '' }).complete, `${name} at level 3 with no explanation is complete (FR origin)`);
}

group('4. Features at level');
ok(ss.featuresAtLevel('barbarian', 'Path of the Ancestral Guardian', 3).length === 1, 'Ancestral Guardian L3 has Ancestral Protectors only');
ok(ss.featuresAtLevel('barbarian', 'Path of the Ancestral Guardian', 14).length === 4, 'Ancestral Guardian L14 has all 4 features');
ok(ss.featuresAtLevel('barbarian', 'Path of the Storm Herald', 14).length === 4, 'Storm Herald L14 has all 4 features');
ok(ss.featuresAtLevel('bard', 'College of Swords', 3).length === 3, 'Swords L3 has Bonus Proficiencies + Fighting Style + Blade Flourish');
ok(ss.featuresAtLevel('bard', 'College of Swords', 14).length === 5, 'Swords L14 has all 5 features');
ok(ss.featuresAtLevel('bard', 'College of Whispers', 3).length === 2, 'Whispers L3 has Psychic Blades + Words of Terror');
ok(ss.featuresAtLevel('bard', 'College of Whispers', 14).length === 4, 'Whispers L14 has all 4 features');
ok(ss.featuresAtLevel('cleric', 'Forge Domain', 3).length === 4, 'Forge L3 has Domain Spells + Bonus Proficiencies + Blessing + Artisan\'s Blessing');
ok(ss.featuresAtLevel('cleric', 'Forge Domain', 17).length === 7, 'Forge L17 has all 7 features');
ok(ss.featuresAtLevel('cleric', 'Grave Domain', 3).length === 4, 'Grave L3 has Domain Spells + Circle of Mortality + Eyes of the Grave + Path to the Grave');
ok(ss.featuresAtLevel('cleric', 'Grave Domain', 17).length === 7, 'Grave L17 has all 7 features');
ok(ss.featuresAtLevel('druid', 'Circle of Dreams', 3).length === 1, 'Dreams L3 has Balm only');
ok(ss.featuresAtLevel('druid', 'Circle of Dreams', 14).length === 4, 'Dreams L14 has all 4 features');
ok(ss.featuresAtLevel('druid', 'Circle of the Shepherd', 3).length === 2, 'Shepherd L3 has Speech of the Woods + Spirit Totem');
ok(ss.featuresAtLevel('druid', 'Circle of the Shepherd', 14).length === 5, 'Shepherd L14 has all 5 features');
ok(ss.featuresAtLevel('fighter', 'Arcane Archer', 3).length === 2, 'Arcane Archer L3 has Lore + Arcane Shot');
ok(ss.featuresAtLevel('fighter', 'Arcane Archer', 18).length === 5, 'Arcane Archer L18 has 5 named features (10th/18th add options and damage, not named features)');
ok(ss.featuresAtLevel('fighter', 'Cavalier', 18).length === 7, 'Cavalier L18 has all 7 features');
ok(ss.featuresAtLevel('fighter', 'Samurai', 18).length === 6, 'Samurai L18 has all 6 features');

group('5. Pure math (kind A/B helpers)');
ok(ss.spiritShieldDice(6) === '2d6' && ss.spiritShieldDice(10) === '3d6' && ss.spiritShieldDice(14) === '4d6', 'Spirit Shield dice scale 2d6/3d6/4d6');
ok(ss.stormAuraDamage('Desert', 3) === 2 && ss.stormAuraDamage('Desert', 20) === 6, 'Storm Aura desert damage scales 2 -> 6');
ok(ss.stormAuraDamage('Sea', 3) === '1d6' && ss.stormAuraDamage('Sea', 10) === '2d6' && ss.stormAuraDamage('Sea', 20) === '4d6', 'Storm Aura sea damage scales 1d6 -> 4d6');
ok(ss.stormAuraTempHp(3) === 2 && ss.stormAuraTempHp(15) === 5, 'Storm Aura tundra temp HP scales 2 -> 5 at 15th');
ok(ss.stormAuraDc(3, 4) === 15, 'Storm Aura DC is 8 + proficiency + Constitution');
ok(ss.psychicBladesDice(3) === '2d6' && ss.psychicBladesDice(5) === '3d6' && ss.psychicBladesDice(10) === '5d6' && ss.psychicBladesDice(15) === '8d6', 'Psychic Blades dice scale 2d6/3d6/5d6/8d6');
ok(ss.mastersFlourishDie() === 'd6', "Master's Flourish replaces the Bardic Inspiration spend with a d6");
ok(ss.forgeDivineStrikeDice(6) === '1d8' && ss.forgeDivineStrikeDice(17) === '2d8', 'Forge Divine Strike scales 1d8 -> 2d8 at 17th (converted from 14th)');
ok(ss.graveFeatureUses(3) === 3 && ss.graveFeatureUses(0) === 1 && ss.graveFeatureUses(-1) === 1, 'Grave uses are Wisdom modifier, minimum 1');
{
  const balm = ss.balmPool(7);
  ok(balm.pool === 7 && balm.maxSpend === 3, 'Balm pool is druid level d6s, max spend half level');
}
ok(ss.spiritTotemTempHp(6) === 11, 'Bear Spirit temp HP is 5 + druid level');
ok(ss.guardianSpiritHeal(10) === 5, 'Guardian Spirit heal is half druid level');
ok(ss.arcaneShotOptionsAtLevel(3) === 2 && ss.arcaneShotOptionsAtLevel(7) === 3 && ss.arcaneShotOptionsAtLevel(10) === 4 && ss.arcaneShotOptionsAtLevel(15) === 5 && ss.arcaneShotOptionsAtLevel(18) === 6, 'Arcane Shot options grow 2 -> 6');
ok(ss.arcaneShotSaveDc(4, 3) === 15, 'Arcane Shot DC is 8 + proficiency + Intelligence');
ok(ss.arcaneShotExtraDamage('Grasping Arrow', 3) === '2d6 poison + 2d6 slashing' && ss.arcaneShotExtraDamage('Grasping Arrow', 18) === '4d6 poison + 4d6 slashing', 'Grasping Arrow damage rises at 18th');
ok(ss.arcaneShotExtraDamage('Piercing Arrow', 3) === '1d6 piercing' && ss.arcaneShotExtraDamage('Piercing Arrow', 18) === '2d6 piercing', 'Piercing Arrow damage rises at 18th');
ok(ss.arcaneShotExtraDamage('Banishing Arrow', 3) === null && ss.arcaneShotExtraDamage('Banishing Arrow', 18) === '2d6 force', 'Banishing Arrow gains force damage only at 18th');
ok(ss.arcaneShotExtraDamage('Not An Option', 10) === null, 'Unknown Arcane Shot option returns null, never invented');
ok(ss.cavalierMarkExtraDamage(15) === 7, 'Unwavering Mark retaliation bonus is half fighter level');
ok(ss.wardingManeuverDie() === 'd8', 'Warding Maneuver rolls 1d8');
ok(ss.ferociousChargerDc(5, 4) === 17, 'Ferocious Charger DC is 8 + proficiency + Strength');
ok(ss.fightingSpiritTempHp(3) === 5 && ss.fightingSpiritTempHp(10) === 10 && ss.fightingSpiritTempHp(15) === 15, 'Fighting Spirit temp HP scales 5/10/15');
ok(ss.fightingSpiritUses() === 3, 'Fighting Spirit has 3 uses');

group('6. Spell access checked against the catalog (kind D)');
{
  const inCatalog = (name) => Object.prototype.hasOwnProperty.call(SPELL_DATA_ENTRIES, String(name).toLowerCase());
  const forge = ss.clericDomainSpellsAtLevel('cleric', 'Forge Domain', 9);
  ok(forge.length === 10 && forge.every(inCatalog), 'Forge L9 always-prepared list is all 10 spells, all in the catalog (no catalog gap)');
  const grave = ss.clericDomainSpellsAtLevel('cleric', 'Grave Domain', 9);
  ok(grave.length === 10 && grave.every(inCatalog), 'Grave L9 always-prepared list is all 10 spells, all in the catalog (no catalog gap)');
  ok(ss.consultTheSpiritsSpells().every(inCatalog), 'Consult the Spirits spells (Augury, Clairvoyance) are in the catalog');
  ok(ss.walkerInDreamsSpells().every(inCatalog), 'Walker in Dreams spells (Dream, Scrying, Teleportation Circle) are in the catalog');
  ok(inCatalog('Conjure Animals'), 'Faithful Summons spell (Conjure Animals) is in the catalog');
  ok(inCatalog('Prestidigitation') && inCatalog('Druidcraft'), 'Arcane Archer lore cantrips are in the catalog');
  ok(inCatalog('Spare the Dying'), 'Circle of Mortality cantrip (Spare the Dying) is in the catalog');
}

group('7. Choice validation (kind G, migration 103 storage shape)');
ok(ss.validateChoice('barbarian', 'Path of the Storm Herald', 'storm_environment', 'Sea').valid, 'Sea is a valid Storm Herald environment');
ok(!ss.validateChoice('barbarian', 'Path of the Storm Herald', 'storm_environment', 'Arctic').valid, 'Arctic is not a Storm Herald environment');
ok(ss.validateChoice('bard', 'College of Swords', 'swords_fighting_style', 'Dueling').valid, 'Dueling is a valid Swords fighting style');
ok(!ss.validateChoice('bard', 'College of Swords', 'swords_fighting_style', 'Archery').valid, 'Archery is not a Swords fighting style');
ok(ss.validateChoice('druid', 'Circle of the Shepherd', 'spirit_totem', 'Unicorn Spirit').valid, 'Unicorn Spirit is a valid Spirit Totem');
ok(!ss.validateChoice('druid', 'Circle of the Shepherd', 'spirit_totem', 'Wolf Spirit').valid, 'Wolf Spirit is not a Spirit Totem option');
ok(ss.validateChoice('fighter', 'Arcane Archer', 'arcane_archer_lore_skill', 'Nature').valid, 'Nature is a valid Arcane Archer lore skill');
ok(ss.validateChoice('fighter', 'Arcane Archer', 'arcane_archer_lore_cantrip', 'Druidcraft').valid, 'Druidcraft is a valid Arcane Archer lore cantrip');
ok(ss.validateChoice('fighter', 'Cavalier', 'cavalier_bonus_proficiency', 'Animal Handling').valid, 'Animal Handling is a valid Cavalier proficiency');
ok(ss.validateChoice('fighter', 'Samurai', 'samurai_bonus_proficiency', 'Persuasion').valid, 'Persuasion is a valid Samurai proficiency');
{
  const list = ss.validateChoiceList('fighter', 'Arcane Archer', 'arcane_shot_options', ['Banishing Arrow', 'Seeking Arrow']);
  ok(list.valid && list.values.length === 2, 'Two Arcane Shot options validate as a stored list');
  ok(!ss.validateChoiceList('fighter', 'Arcane Archer', 'arcane_shot_options', ['Banishing Arrow', 'Banishing Arrow']).valid, 'Duplicate Arcane Shot options are refused');
  ok(!ss.validateChoiceList('fighter', 'Arcane Archer', 'arcane_shot_options', ['Banishing Arrow', 'Beguiling Arrow', 'Bursting Arrow', 'Enfeebling Arrow', 'Grasping Arrow', 'Piercing Arrow', 'Seeking Arrow']).valid, 'Seven Arcane Shot options exceed maxCount 6');
  ok(!ss.validateChoiceList('fighter', 'Arcane Archer', 'arcane_shot_options', ['Fireball Arrow']).valid, 'An undeclared Arcane Shot option is refused');
}
{
  // Stored choices round-trip through the migration 103 column shape.
  const stored = JSON.stringify({ storm_environment: 'Tundra', arcane_shot_options: ['Shadow Arrow', 'Piercing Arrow'] });
  const parsed = ss.parseSubclassChoices(stored);
  ok(parsed.storm_environment === 'Tundra', 'Stored Storm Herald choice parses back');
  ok(ss.validateChoiceList('fighter', 'Arcane Archer', 'arcane_shot_options', parsed.arcane_shot_options).valid, 'Stored Arcane Shot list re-validates');
  ok(!ss.validateChoice('barbarian', 'Path of the Storm Herald', 'storm_environment', undefined).valid, 'A missing stored choice never silently defaults');
}

group('8. Prompt-contains (registry-driven DM prompt section)');
{
  const section = ss.buildSubclassPromptSection({ class: 'Barbarian', subclass: 'Path of the Storm Herald', level: 6 }, []);
  ok(section.includes('Storm Aura') && section.includes('Storm Soul'), 'Storm Herald prompt names Storm Aura + Storm Soul');
  ok(section.includes('Forgotten Realms'), 'Storm Herald prompt shows FR origin');
}
for (const [cls, name, needle] of [
  ['Barbarian', 'Path of the Ancestral Guardian', 'Vengeful Ancestors'],
  ['Bard', 'College of Swords', "Master's Flourish"],
  ['Bard', 'College of Whispers', 'Shadow Lore'],
  ['Cleric', 'Forge Domain', 'Saint of Forge and Fire'],
  ['Cleric', 'Grave Domain', 'Keeper of Souls'],
  ['Druid', 'Circle of Dreams', 'Walker in Dreams'],
  ['Druid', 'Circle of the Shepherd', 'Faithful Summons'],
  ['Fighter', 'Arcane Archer', 'Ever-Ready Shot'],
  ['Fighter', 'Cavalier', 'Vigilant Defender'],
  ['Fighter', 'Samurai', 'Strength Before Death'],
]) {
  const section = ss.buildSubclassPromptSection({ class: cls, subclass: name, level: 20 }, []);
  ok(section.includes(needle), `${name} prompt contains ${needle}`);
}
{
  const section = ss.buildSubclassPromptSection({ class: 'Fighter', subclass: 'Unknown Subclass', level: 5 }, []);
  ok(section.includes('not yet in the subclass registry'), 'Unknown subclass renders a not-yet line, no invented features');
  const full = ss.buildSubclassPromptSection({ class: 'Cleric', subclass: 'Forge Domain', level: 3 }, []);
  ok(full.includes('Never silently add subclass numbers'), 'Prompt section carries the PC pending-instruction rule');
}

group('9. Unknown-subclass null asserts');
ok(ss.getSubclass('barbarian', 'Path of the Whatever') === null, 'Unknown barbarian path returns null');
ok(ss.getSubclass('fighter', 'Arcane Archer 2') === null, 'Near-miss fighter name returns null');
ok(ss.featuresAtLevel('cleric', 'Forge Domain 2', 9).length === 0, 'Features for an unknown subclass are empty, never invented');
ok(!ss.validateSelection({ className: 'druid', subclassName: 'Circle of Dreams 2', level: 3 }).found, 'Unknown subclass selection reports not found');

group('10. DB integration: stored choices + companion prompt');
{
  const pc = await addPc({
    class: 'Barbarian', level: 14, subclass: 'Path of the Storm Herald',
    subclass_choices_json: JSON.stringify({ storm_environment: 'Desert' }),
  });
  ok(pc.subclass === 'Path of the Storm Herald', 'PC row carries the S1 subclass');
  const parsed = ss.parseSubclassChoices(pc.subclass_choices_json);
  ok(ss.validateChoice('barbarian', 'Path of the Storm Herald', 'storm_environment', parsed.storm_environment).valid, 'PC stored Storm Herald choice validates from the DB row');
  const comp = await addCompanion('Ally', pc.id, {
    companion_class: 'Fighter', companion_subclass: 'Samurai', companion_level: 7,
  });
  const section = ss.buildSubclassPromptSection(pc, [comp]);
  ok(section.includes('Path of the Storm Herald') && section.includes('Samurai'), 'Prompt section covers PC + class-progression companion S1 subclasses');
  const npcStats = await addCompanion('Mook', pc.id, {
    companion_class: 'Fighter', companion_subclass: 'Cavalier', companion_level: 7, progression_type: 'npc_stats',
  });
  const section2 = ss.buildSubclassPromptSection(pc, [npcStats]);
  ok(!section2.includes('Cavalier'), 'npc_stats companions are skipped by the prompt section, as before');
}

console.log(`\nsubclass-scanned1: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
