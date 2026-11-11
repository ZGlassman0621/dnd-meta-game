// tests/subclass-scanned2.test.js — Scanned Batch S2 (Xanathar part 2,
// completing Xanathar): Monk 3, Paladin 2, Ranger 2, Rogue 4,
// Sorcerer 3, Warlock 1, Wizard 1 = 16 new, registry 59 -> 75.
// Gloom Stalker and Celestial are NOT rebuilt here: they are
// already PHB 2024 entries and are asserted as still present
// from the PHB files, not duplicated.
// Real services, real DB, same pattern as earlier subclass tests.
//
// CONVERSION NOTE: these are 2014-era Xanathar subclasses.
// No 2024 reprint exists for any of them, so every S2 number
// is conversionCheck + gateCheck: the 2014 extract mapped onto
// the built 2024 class cadences (Monk 3/6/11/17, Paladin
// 3/7/15/20, Ranger 3/7/11/15, Rogue 3/9/13/17, Sorcerer 3/6/14/18,
// Warlock 3/6/10/14, Wizard 3/6/10/14). Sorcerer/Warlock selection
// moved 1st -> 3rd; Wizard selection moved 2nd -> 3rd; Paladin
// 18th-level aura-range steps folded into the 7th-level auras;
// Ranger/Paladin subclass spells carried as always prepared at
// 3/5/9/13/17. See each entry's conversionCheck for its own
// mapping. Nothing here was authored from the mislabeled 2014
// PHB Pt1/Pt2 scans. Monk entries use the 2024 Warrior names,
// with the 2014 Way names noted in the conversion note only.
//
// CATALOG GAPS — RESOLVED BY APPROVED RULING 2026-11-03 (Zach):
// Hexblade formerly named two 2014-era smites not in the catalog.
// Ruling: Shining Smite replaces Branding Smite (already in the
// catalog), and Banishing Smite is kept in its 2024 form with a
// new catalog entry (numbers flagged for Zach's physical PHB
// check). The old gap asserts below were updated to match.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-subclass-scanned2-'));
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
    name: 'Tester', class: 'Sorcerer', level: 6,
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

const S2 = [
  ['monk', 'Warrior of the Drunken Master'],
  ['monk', 'Warrior of the Kensei'],
  ['monk', 'Warrior of the Sun Soul'],
  ['paladin', 'Oath of Conquest'],
  ['paladin', 'Oath of Redemption'],
  ['ranger', 'Horizon Walker'],
  ['ranger', 'Monster Slayer'],
  ['rogue', 'Inquisitive'],
  ['rogue', 'Mastermind'],
  ['rogue', 'Scout'],
  ['rogue', 'Swashbuckler'],
  ['sorcerer', 'Divine Soul'],
  ['sorcerer', 'Shadow Magic'],
  ['sorcerer', 'Storm Sorcery'],
  ['warlock', 'Hexblade'],
  ['wizard', 'War Magic'],
];

group('1. Registry counts and lookup (59 -> 75)');
ok(ss.listSubclasses('monk').length === 9, 'Monk file exports exactly 9 (4 PHB + 3 S2 + 1 S4) + 1 Additional');
ok(ss.listSubclasses('paladin').length === 9, 'Paladin file exports exactly 9 (4 PHB + 2 S2 + 1 S4 + 1 S5) + 1 Additional');
ok(ss.listSubclasses('ranger').length === 9, 'Ranger file exports exactly 9 (4 PHB + 2 S2 + 1 S4 + 1 S5) + 1 Additional');
ok(ss.listSubclasses('rogue').length === 11, 'Rogue file exports exactly 11 (4 PHB + 4 S2 + 1 S4 + 1 S5) + 1 Additional');
ok(ss.listSubclasses('sorcerer').length === 10, 'Sorcerer file exports exactly 10 (4 PHB + 3 S2 + 1 S4 + 1 S5) + 1 Additional');
ok(ss.listSubclasses('warlock').length === 9, 'Warlock file exports exactly 9 (4 PHB + 1 S2 + 2 S4) + 2 Additional');
ok(ss.listSubclasses('wizard').length === 10, 'Wizard file exports exactly 10 (4 PHB + 1 S2 + 2 S3 + 1 S4 + 1 S5) + 1 Additional');
{
  const total = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'rogue', 'wizard', 'warlock', 'sorcerer', 'paladin', 'ranger']
    .reduce((a, c) => a + ss.listSubclasses(c).length, 0);
  ok(total === 118, 'Registry total is 118 (102 + 16 Additional across the 12 classes; artificer + new classes counted separately)');
}
for (const [cls, name] of S2) {
  ok(ss.getSubclass(cls, name) !== null, `${name} is in the registry`);
}
// PHB overlaps are NOT rebuilt: Gloom Stalker and Celestial stay PHB entries.
{
  const gloom = ss.getSubclass('ranger', 'Gloom Stalker');
  ok(gloom && gloom.source === 'PHB 2024', 'Gloom Stalker remains the PHB 2024 entry, not an S2 duplicate');
  const celestial = ss.getSubclass('warlock', 'Celestial Patron');
  ok(celestial && celestial.source === 'PHB 2024', 'Celestial remains the PHB 2024 entry, not an S2 duplicate');
  ok(ss.listSubclasses('ranger').filter((s) => s.key === 'gloom_stalker').length === 1, 'Gloom Stalker appears exactly once');
  ok(ss.listSubclasses('warlock').filter((s) => s.key === 'celestial_patron').length === 1, 'Celestial appears exactly once');
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
for (const [cls, name] of S2) {
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
ok(ss.featuresAtLevel('monk', 'Warrior of the Drunken Master', 3).length === 2, 'Drunken Master L3 has Bonus Proficiencies + Drunken Technique');
ok(ss.featuresAtLevel('monk', 'Warrior of the Drunken Master', 17).length === 5, 'Drunken Master L17 has all 5 features');
ok(ss.featuresAtLevel('monk', 'Warrior of the Kensei', 3).length === 1, 'Kensei L3 has Path of the Kensei only');
ok(ss.featuresAtLevel('monk', 'Warrior of the Kensei', 17).length === 4, 'Kensei L17 has all 4 features');
ok(ss.featuresAtLevel('monk', 'Warrior of the Sun Soul', 3).length === 1, 'Sun Soul L3 has Radiant Sun Bolt only');
ok(ss.featuresAtLevel('monk', 'Warrior of the Sun Soul', 17).length === 4, 'Sun Soul L17 has all 4 features');
ok(ss.featuresAtLevel('paladin', 'Oath of Conquest', 7).length === 3, 'Conquest L7 has Oath Spells + Channel Divinity + Aura of Conquest');
ok(ss.featuresAtLevel('paladin', 'Oath of Conquest', 20).length === 5, 'Conquest L20 has all 5 features (18th is the aura-range step inside the aura, not a separate feature)');
ok(ss.featuresAtLevel('paladin', 'Oath of Redemption', 7).length === 3, 'Redemption L7 has Oath Spells + Channel Divinity + Aura of the Guardian');
ok(ss.featuresAtLevel('paladin', 'Oath of Redemption', 20).length === 5, 'Redemption L20 has all 5 features (18th is the aura-range step inside the aura, not a separate feature)');
ok(ss.featuresAtLevel('ranger', 'Horizon Walker', 3).length === 3, 'Horizon Walker L3 has Magic + Detect Portal + Planar Warrior');
ok(ss.featuresAtLevel('ranger', 'Horizon Walker', 15).length === 6, 'Horizon Walker L15 has all 6 features');
ok(ss.featuresAtLevel('ranger', 'Monster Slayer', 3).length === 3, 'Monster Slayer L3 has Magic + Hunter\'s Sense + Slayer\'s Prey');
ok(ss.featuresAtLevel('ranger', 'Monster Slayer', 15).length === 6, 'Monster Slayer L15 has all 6 features');
ok(ss.featuresAtLevel('rogue', 'Inquisitive', 3).length === 3, 'Inquisitive L3 has Ear for Deceit + Eye for Detail + Insightful Fighting');
ok(ss.featuresAtLevel('rogue', 'Inquisitive', 17).length === 6, 'Inquisitive L17 has all 6 features');
ok(ss.featuresAtLevel('rogue', 'Mastermind', 3).length === 2, 'Mastermind L3 has Master of Intrigue + Master of Tactics');
ok(ss.featuresAtLevel('rogue', 'Mastermind', 17).length === 5, 'Mastermind L17 has all 5 features');
ok(ss.featuresAtLevel('rogue', 'Scout', 3).length === 2, 'Scout L3 has Skirmisher + Survivalist');
ok(ss.featuresAtLevel('rogue', 'Scout', 17).length === 5, 'Scout L17 has all 5 features');
ok(ss.featuresAtLevel('rogue', 'Swashbuckler', 3).length === 2, 'Swashbuckler L3 has Fancy Footwork + Rakish Audacity');
ok(ss.featuresAtLevel('rogue', 'Swashbuckler', 17).length === 5, 'Swashbuckler L17 has all 5 features');
ok(ss.featuresAtLevel('sorcerer', 'Divine Soul', 3).length === 2, 'Divine Soul L3 has Divine Magic + Favored by the Gods (both moved 1st -> 3rd)');
ok(ss.featuresAtLevel('sorcerer', 'Divine Soul', 18).length === 5, 'Divine Soul L18 has all 5 features');
ok(ss.featuresAtLevel('sorcerer', 'Shadow Magic', 3).length === 2, 'Shadow Magic L3 has Eyes of the Dark + Strength of the Grave (both moved 1st -> 3rd)');
ok(ss.featuresAtLevel('sorcerer', 'Shadow Magic', 18).length === 5, 'Shadow Magic L18 has all 5 features');
ok(ss.featuresAtLevel('sorcerer', 'Storm Sorcery', 6).length === 4, 'Storm Sorcery L6 has Wind Speaker + Tempestuous Magic + Heart of the Storm + Storm Guide');
ok(ss.featuresAtLevel('sorcerer', 'Storm Sorcery', 18).length === 6, 'Storm Sorcery L18 has all 6 features');
ok(ss.featuresAtLevel('warlock', 'Hexblade', 3).length === 3, 'Hexblade L3 has Spells + Curse + Hex Warrior (all moved 1st -> 3rd)');
ok(ss.featuresAtLevel('warlock', 'Hexblade', 14).length === 6, 'Hexblade L14 has all 6 features');
ok(ss.featuresAtLevel('wizard', 'War Magic', 3).length === 2, 'War Magic L3 has Arcane Deflection + Tactical Wit (both moved 2nd -> 3rd)');
ok(ss.featuresAtLevel('wizard', 'War Magic', 14).length === 5, 'War Magic L14 has all 5 features');

group('5. Pure math (kind A/B helpers)');
ok(ss.conquestAuraDamage(7) === 3 && ss.conquestAuraDamage(20) === 10, 'Aura of Conquest psychic damage is half paladin level');
ok(ss.protectiveSpiritHeal(15) === '1d6 + 7' && ss.protectiveSpiritHeal(20) === '1d6 + 10', 'Protective Spirit heal is 1d6 + half paladin level');
ok(ss.planarWarriorDamage(3) === '1d8' && ss.planarWarriorDamage(11) === '2d8', 'Planar Warrior damage rises 1d8 -> 2d8 at 11th');
ok(ss.stormHeartDamage(6) === 3 && ss.stormHeartDamage(20) === 10, 'Heart of the Storm damage is half sorcerer level');
ok(ss.stormsFuryDamage(14) === 14 && ss.stormsFuryDamage(18) === 18, "Storm's Fury damage equals sorcerer level");
ok(ss.hexbladeCurseHeal(5, 3) === 8 && ss.hexbladeCurseHeal(5, -9) === 1, "Hexblade's Curse kill heal is warlock level + Charisma, minimum 1");
ok(ss.strengthOfGraveDc(10) === 15 && ss.strengthOfGraveDc(0) === 5, 'Strength of the Grave DC is 5 + damage taken');
ok(ss.houndTempHp(6) === 3 && ss.houndTempHp(7) === 3, 'Hound of Ill Omen temp HP is half sorcerer level');
ok(ss.powerSurgeDamage(6) === 3 && ss.powerSurgeDamage(14) === 7, 'Power Surge damage is half wizard level');
ok(ss.deflectingShroudDamage(14) === 7 && ss.deflectingShroudDamage(6) === 3, 'Deflecting Shroud damage is half wizard level');
ok(ss.divineAffinitySpell('Good') === 'Cure Wounds' && ss.divineAffinitySpell('Evil') === 'Inflict Wounds' && ss.divineAffinitySpell('Law') === 'Bless' && ss.divineAffinitySpell('Chaos') === 'Bane' && ss.divineAffinitySpell('Neutrality') === 'Protection from Evil and Good', 'Divine affinity maps to its spell');
ok(ss.divineAffinitySpell('good') === 'Cure Wounds' && ss.divineAffinitySpell('Purple') === null, 'Divine affinity lookup is case-insensitive and unknown affinities return null, never invented');

group('6. Spell access checked against the catalog (kind D)');
{
  const inCatalog = (name) => Object.prototype.hasOwnProperty.call(SPELL_DATA_ENTRIES, String(name).toLowerCase());
  const conquest = ss.paladinOathSpellsAtLevel('paladin', 'Oath of Conquest', 17);
  ok(conquest.length === 10 && conquest.every(inCatalog), 'Conquest L17 always-prepared list is all 10 spells, all in the catalog (no catalog gap)');
  const redemption = ss.paladinOathSpellsAtLevel('paladin', 'Oath of Redemption', 17);
  ok(redemption.length === 10 && redemption.every(inCatalog), 'Redemption L17 always-prepared list is all 10 spells, all in the catalog (no catalog gap)');
  const hw = ss.rangerSubclassSpellsAtLevel('ranger', 'Horizon Walker', 17);
  ok(hw.length === 5 && hw.every(inCatalog), 'Horizon Walker L17 always-prepared list is all 5 spells, all in the catalog (no catalog gap)');
  const ms = ss.rangerSubclassSpellsAtLevel('ranger', 'Monster Slayer', 17);
  ok(ms.length === 5 && ms.every(inCatalog), 'Monster Slayer L17 always-prepared list is all 5 spells, all in the catalog (no catalog gap)');
  const hex = ss.warlockPatronSpellsAtLevel('warlock', 'Hexblade', 17);
  ok(hex.length === 10, 'Hexblade L17 added-to-list list is all 10 spells');
  ok(hex.filter((s) => inCatalog(s)).length === 10, 'Hexblade L17: 10 of 10 spells are in the catalog (approved ruling applied)');
  ok(!hex.includes('Branding Smite') && hex.includes('Shining Smite') && hex.includes('Banishing Smite'), 'Hexblade list: Branding Smite replaced by Shining Smite, Banishing Smite kept');
  ok(inCatalog('Shining Smite') && inCatalog('Banishing Smite'), 'Shining Smite (already in catalog) and Banishing Smite (new catalog entry) are both in the catalog');
  ok(JSON.stringify(ss.getSubclass('warlock', 'Hexblade').features.find((f) => f.key === 'hexblade_spells').mechanics.catalogGap) === JSON.stringify([]), 'Hexblade entry records no remaining catalog gaps in its mechanics');
  ok(ss.sorcererSubclassSpellsAtLevel('sorcerer', 'Divine Soul', 17).length === 0, 'Divine Soul has no fixed subclass spell list — its spell comes from the affinity choice, not a list helper');
  ok(ss.divineAffinitySpell('Good') && inCatalog(ss.divineAffinitySpell('Good')) && inCatalog(ss.divineAffinitySpell('Evil')) && inCatalog(ss.divineAffinitySpell('Law')) && inCatalog(ss.divineAffinitySpell('Chaos')) && inCatalog(ss.divineAffinitySpell('Neutrality')), 'All five Divine affinity spells are in the catalog');
  ok(inCatalog('Darkness'), 'Eyes of the Dark spell (Darkness) is in the catalog');
  ok(inCatalog('Burning Hands'), 'Searing Arc Strike spell (Burning Hands) is in the catalog');
}

group('7. Choice validation (kind G, migration 103 storage shape)');
ok(ss.validateChoice('sorcerer', 'Divine Soul', 'divine_affinity', 'Good').valid, 'Good is a valid Divine affinity');
ok(ss.validateChoice('sorcerer', 'Divine Soul', 'divine_affinity', 'Law').valid, 'Law is a valid Divine affinity');
ok(!ss.validateChoice('sorcerer', 'Divine Soul', 'divine_affinity', 'Purple').valid, 'Purple is not a Divine affinity');
{
  // Free-form choices (Kensei weapons, Mastermind gaming set and
  // languages) are DM-recorded in the migration 103 column, not
  // closed-list validated: validateChoice is closed-list only,
  // so a free-form pick does not validate there — but the stored
  // JSON still round-trips exactly.
  const stored = JSON.stringify({ kensei_weapons: ['Longsword', 'Longbow'], mastermind_gaming_set: 'Dice', mastermind_languages: ['Elvish', 'Dwarvish'], divine_affinity: 'Good' });
  const parsed = ss.parseSubclassChoices(stored);
  ok(JSON.stringify(parsed.kensei_weapons) === JSON.stringify(['Longsword', 'Longbow']), 'Stored Kensei weapon picks parse back');
  ok(parsed.mastermind_gaming_set === 'Dice', 'Stored Mastermind gaming set parses back');
  ok(JSON.stringify(parsed.mastermind_languages) === JSON.stringify(['Elvish', 'Dwarvish']), 'Stored Mastermind languages parse back');
  ok(ss.validateChoice('sorcerer', 'Divine Soul', 'divine_affinity', parsed.divine_affinity).valid, 'Stored Divine affinity re-validates');
  ok(!ss.validateChoice('rogue', 'Mastermind', 'mastermind_gaming_set', 'Dice').valid, 'Free-form Mastermind pick is DM-recorded, not closed-list validated (options is null by design)');
  ok(!ss.validateChoice('monk', 'Warrior of the Kensei', 'kensei_weapons', 'Longsword').valid, 'Free-form Kensei pick is DM-recorded, not closed-list validated (options is null by design)');
  ok(!ss.validateChoice('sorcerer', 'Divine Soul', 'divine_affinity', undefined).valid, 'A missing stored choice never silently defaults');
}

group('8. Prompt-contains (registry-driven DM prompt section)');
for (const [cls, name, needle] of [
  ['Monk', 'Warrior of the Drunken Master', 'Intoxicated Frenzy'],
  ['Monk', 'Warrior of the Kensei', 'Unerring Accuracy'],
  ['Monk', 'Warrior of the Sun Soul', 'Sun Shield'],
  ['Paladin', 'Oath of Conquest', 'Invincible Conqueror'],
  ['Paladin', 'Oath of Redemption', 'Emissary of Redemption'],
  ['Ranger', 'Horizon Walker', 'Spectral Defense'],
  ['Ranger', 'Monster Slayer', "Slayer's Counter"],
  ['Rogue', 'Inquisitive', 'Eye for Weakness'],
  ['Rogue', 'Mastermind', 'Soul of Deceit'],
  ['Rogue', 'Scout', 'Sudden Strike'],
  ['Rogue', 'Swashbuckler', 'Master Duelist'],
  ['Sorcerer', 'Divine Soul', 'Unearthly Recovery'],
  ['Sorcerer', 'Shadow Magic', 'Umbral Form'],
  ['Sorcerer', 'Storm Sorcery', 'Wind Soul'],
  ['Warlock', 'Hexblade', 'Master of Hexes'],
  ['Wizard', 'War Magic', 'Deflecting Shroud'],
]) {
  const section = ss.buildSubclassPromptSection({ class: cls, subclass: name, level: 20 }, []);
  ok(section.includes(needle), `${name} prompt contains ${needle}`);
}
{
  const section = ss.buildSubclassPromptSection({ class: 'Fighter', subclass: 'Unknown Subclass', level: 5 }, []);
  ok(section.includes('not yet in the subclass registry'), 'Unknown subclass renders a not-yet line, no invented features');
  const full = ss.buildSubclassPromptSection({ class: 'Paladin', subclass: 'Oath of Conquest', level: 3 }, []);
  ok(full.includes('Never silently add subclass numbers'), 'Prompt section carries the PC pending-instruction rule');
  ok(full.includes('Forgotten Realms'), 'Conquest prompt shows FR origin');
}

group('9. Unknown-subclass null asserts');
ok(ss.getSubclass('monk', 'Warrior of the Drunken Master 2') === null, 'Near-miss monk name returns null');
ok(ss.getSubclass('warlock', 'Hexblade 2') === null, 'Near-miss warlock name returns null');
ok(ss.featuresAtLevel('warlock', 'Hexblade 2', 9).length === 0, 'Features for an unknown subclass are empty, never invented');
ok(!ss.validateSelection({ className: 'wizard', subclassName: 'War Magic 2', level: 3 }).found, 'Unknown subclass selection reports not found');

group('10. DB integration: stored choices + companion prompt');
{
  const pc = await addPc({
    class: 'Sorcerer', level: 6, subclass: 'Divine Soul',
    subclass_choices_json: JSON.stringify({ divine_affinity: 'Good' }),
  });
  ok(pc.subclass === 'Divine Soul', 'PC row carries the S2 subclass');
  const parsed = ss.parseSubclassChoices(pc.subclass_choices_json);
  ok(ss.validateChoice('sorcerer', 'Divine Soul', 'divine_affinity', parsed.divine_affinity).valid, 'PC stored Divine affinity validates from the DB row');
  const comp = await addCompanion('Ally', pc.id, {
    companion_class: 'Ranger', companion_subclass: 'Horizon Walker', companion_level: 7,
  });
  const section = ss.buildSubclassPromptSection(pc, [comp]);
  ok(section.includes('Divine Soul') && section.includes('Horizon Walker'), 'Prompt section covers PC + class-progression companion S2 subclasses');
  const npcStats = await addCompanion('Mook', pc.id, {
    companion_class: 'Rogue', companion_subclass: 'Swashbuckler', companion_level: 7, progression_type: 'npc_stats',
  });
  const section2 = ss.buildSubclassPromptSection(pc, [npcStats]);
  ok(!section2.includes('Swashbuckler'), 'npc_stats companions are skipped by the prompt section, as before');
}

console.log(`\nsubclass-scanned2: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
