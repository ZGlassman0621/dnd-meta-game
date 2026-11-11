// tests/subclass-batch1.test.js — Batch 1 (PHB 2024 passive + resource
// classes): Barbarian 4, Fighter 3 remaining, Monk 4, Rogue 4.
// Champion is Tier 0 and is NOT re-asserted here except for its
// count in the Fighter file (4 total). Real services, real DB,
// same pattern as subclass-tier0.test.js. No other subclass is
// asserted here — an unbuilt subclass must return null, never
// invented features.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-subclass-batch1-'));
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
    current_hp: 80, max_hp: 80, armor_class: 16,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 16, int: 10, wis: 12, cha: 8 }),
    skills: JSON.stringify([]),
    spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }),
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
    progression_type: 'class_based', companion_level: 3,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 12 }),
    companion_current_hp: 40, companion_max_hp: 40, armor_class: 15,
    ...over
  });
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [id]);
  return { ...row, display_name: name };
}

group('1. Registry counts and lookup');
ok(ss.listSubclasses('barbarian').length === 9, 'Barbarian file exports exactly 9 (4 PHB + 2 S1 + 1 S4) + 2 Additional');
ok(ss.listSubclasses('fighter').length === 11, 'Fighter file exports exactly 11 (4 PHB + 3 S1 + 1 S3 + 1 S4 + 1 S5) + 1 Additional');
ok(ss.listSubclasses('monk').length === 9, 'Monk file exports exactly 9 (4 PHB + 3 S2 + 1 S4) + 1 Additional');
ok(ss.listSubclasses('rogue').length === 11, 'Rogue file exports exactly 11 (4 PHB + 4 S2 + 1 S4 + 1 S5) + 1 Additional');
ok(ss.getSubclass('fighter', 'Champion')?.key === 'champion', 'Champion still in the Fighter file, unchanged by Batch 1');
ok(ss.getSubclass('barbarian', 'Path of the Berserker')?.key === 'path_of_the_berserker', 'Berserker found');
ok(ss.getSubclass('barbarian', 'Path of the Wild Heart')?.key === 'path_of_the_wild_heart', 'Wild Heart found');
ok(ss.getSubclass('barbarian', 'Path of the World Tree')?.key === 'path_of_the_world_tree', 'World Tree found');
ok(ss.getSubclass('barbarian', 'Path of the Zealot')?.key === 'path_of_the_zealot', 'Zealot found');
ok(ss.getSubclass('fighter', 'Battle Master')?.key === 'battle_master', 'Battle Master found');
ok(ss.getSubclass('fighter', 'Eldritch Knight')?.key === 'eldritch_knight', 'Eldritch Knight found');
ok(ss.getSubclass('fighter', 'Psi Warrior')?.key === 'psi_warrior', 'Psi Warrior found');
ok(ss.getSubclass('monk', 'Warrior of Mercy')?.key === 'warrior_of_mercy', 'Warrior of Mercy found (2024 name, not Way of Mercy)');
ok(ss.getSubclass('monk', 'Warrior of the Open Hand')?.key === 'warrior_of_the_open_hand', 'Warrior of the Open Hand found');
ok(ss.getSubclass('monk', 'Warrior of Shadow')?.key === 'warrior_of_shadow', 'Warrior of Shadow found');
ok(ss.getSubclass('monk', 'Warrior of the Elements')?.key === 'warrior_of_the_elements', 'Warrior of the Elements found');
ok(ss.getSubclass('rogue', 'Arcane Trickster')?.key === 'arcane_trickster', 'Arcane Trickster found');
ok(ss.getSubclass('rogue', 'Assassin')?.key === 'assassin', 'Assassin found');
ok(ss.getSubclass('rogue', 'Soulknife')?.key === 'soulknife', 'Soulknife found');
ok(ss.getSubclass('rogue', 'Thief')?.key === 'thief', 'Thief found');
ok(ss.getSubclass('fighter', 'Unknown Subclass') === null, 'Unknown Subclass is not in Batch 1 (never invented)');

group('2. Selection levels and origins');
for (const [cls, name] of [
  ['barbarian', 'Path of the Berserker'], ['barbarian', 'Path of the Wild Heart'],
  ['barbarian', 'Path of the World Tree'], ['barbarian', 'Path of the Zealot'],
  ['fighter', 'Battle Master'], ['fighter', 'Eldritch Knight'], ['fighter', 'Psi Warrior'],
  ['monk', 'Warrior of Mercy'], ['monk', 'Warrior of the Open Hand'],
  ['monk', 'Warrior of Shadow'], ['monk', 'Warrior of the Elements'],
  ['rogue', 'Arcane Trickster'], ['rogue', 'Assassin'], ['rogue', 'Soulknife'], ['rogue', 'Thief'],
]) {
  const e = ss.getSubclass(cls, name);
  ok(e?.selectionLevel === 3, `${name} selection level is 3`);
  ok(e?.origin_setting === 'Forgotten Realms', `${name} origin is Forgotten Realms`);
  ok(e?.gateCheckRequired === true, `${name} is flagged gateCheck`);
  ok((e?.features || []).every((f) => f.gateCheck === true), `${name} every feature is flagged gateCheck`);
}

group('3. Features at level');
ok(ss.featuresAtLevel('barbarian', 'Path of the Berserker', 3).length === 1, 'Berserker L3 has Frenzy only');
ok(ss.featuresAtLevel('barbarian', 'Path of the Berserker', 14).length === 4, 'Berserker L14 has all 4 features');
ok(ss.featuresAtLevel('barbarian', 'Path of the Berserker', 10).some((f) => f.key === 'retaliation'), 'Berserker L10 grants Retaliation (2024 PHB — was Intimidating Presence at 10)');
ok(ss.featuresAtLevel('barbarian', 'Path of the Berserker', 14).some((f) => f.key === 'intimidating_presence'), 'Berserker L14 grants Intimidating Presence (2024 PHB — was Retaliation at 14)');
ok(ss.featuresAtLevel('barbarian', 'Path of the Zealot', 14).some((f) => f.key === 'rage_of_the_gods'), 'Zealot L14 is Rage of the Gods (2024 PHB — was Rage Beyond Death)');
ok(!ss.featuresAtLevel('barbarian', 'Path of the Zealot', 14).some((f) => f.key === 'rage_beyond_death'), 'no Rage Beyond Death key survives the 2024 rename');
ok(ss.featuresAtLevel('fighter', 'Battle Master', 18).some((f) => f.key === 'ultimate_combat_superiority'), 'Battle Master L18 grants Ultimate Combat Superiority (2024 PHB — was folded into the L10 row)');
ok(ss.featuresAtLevel('fighter', 'Battle Master', 3).some((f) => f.key === 'combat_superiority'), 'Battle Master L3 has Combat Superiority');
ok(ss.featuresAtLevel('fighter', 'Battle Master', 15).length === 6, 'Battle Master L15 has all 6 features');
ok(ss.featuresAtLevel('monk', 'Warrior of Mercy', 3).length === 3, 'Mercy L3 has Hand of Healing + Hand of Harm + Implements of Mercy');
ok(ss.featuresAtLevel('monk', 'Warrior of Shadow', 3).some((f) => f.key === 'shadow_arts'), 'Shadow L3 has Shadow Arts');
ok(ss.featuresAtLevel('rogue', 'Soulknife', 3).length === 4, 'Soulknife L3 has Psionic Power + Psychic Blades + Psi-Bolstered Knack + Psychic Whispers (2024 PHB — Whispers is part of Psionic Power at 3rd, not 9th)');
ok(ss.featuresAtLevel('rogue', 'Assassin', 17).some((f) => f.key === 'death_strike'), 'Assassin L17 has Death Strike');
ok(ss.featuresAtLevel('rogue', 'Thief', 3).length === 2, 'Thief L3 has Fast Hands + Second-Story Work');

group('4. Superiority dice (Battle Master)');
ok(ss.superiorityDice(2).count === 0, 'no superiority dice before level 3');
ok(ss.superiorityDice(3).count === 4 && ss.superiorityDice(3).die === 8, 'L3: 4d8');
ok(ss.superiorityDice(7).count === 5, 'L7: 5 dice');
ok(ss.superiorityDice(10).die === 10, 'L10: d10');
ok(ss.superiorityDice(15).count === 6, 'L15: 6 dice');
ok(ss.superiorityDice(18).die === 12, 'L18: d12');

group('5. Psionic Energy dice');
ok(ss.psiWarriorDice(3).count === 4 && ss.psiWarriorDice(3).die === 6, 'Psi Warrior L3: 4d6 (2 x PB 2)');
ok(ss.psiWarriorDice(5).die === 8, 'Psi Warrior L5: d8');
ok(ss.psiWarriorDice(11).die === 10, 'Psi Warrior L11: d10');
ok(ss.psiWarriorDice(17).die === 12, 'Psi Warrior L17: d12');
ok(ss.soulknifeDice(3).count === 4 && ss.soulknifeDice(3).die === 6, 'Soulknife L3: 4d6 (2024 PHB Energy Dice table, p. 135 — was PB 2)');
ok(ss.soulknifeDice(5).count === 6 && ss.soulknifeDice(5).die === 8, 'Soulknife L5: 6d8 (2024 PHB Energy Dice table)');
ok(ss.soulknifeDice(9).count === 8 && ss.soulknifeDice(9).die === 8, 'Soulknife L9: 8d8 (2024 PHB Energy Dice table — was PB 4)');
ok(ss.soulknifeDice(11).count === 8 && ss.soulknifeDice(11).die === 10, 'Soulknife L11: 8d10 (2024 PHB Energy Dice table)');
ok(ss.soulknifeDice(13).count === 10 && ss.soulknifeDice(13).die === 10, 'Soulknife L13: 10d10 (2024 PHB Energy Dice table)');
ok(ss.soulknifeDice(17).count === 12 && ss.soulknifeDice(17).die === 12, 'Soulknife L17: 12d12 (2024 PHB Energy Dice table)');

group('5b. Rogue PHB-photo pins (2024 PHB photos, Zach-provided 2026-11-06)');
{
  const at3 = ss.featuresAtLevel('rogue', 'Arcane Trickster', 3).find((f) => f.key === 'arcane_trickster_spellcasting');
  ok(at3 && at3.mechanics.schools === undefined, 'Arcane Trickster Spellcasting has NO school restriction in 2024 (2014 Enchantment/Illusion limit is gone)');
  ok(at3 && String(at3.mechanics.note).includes('13 at 20th'), 'Arcane Trickster Spellcasting note carries the 2024 prepared table (3 at 3rd to 13 at 20th)');
  const ambush = ss.featuresAtLevel('rogue', 'Arcane Trickster', 9).find((f) => f.key === 'magical_ambush');
  ok(ambush && String(ambush.mechanics.requirement).includes('Invisible condition'), 'Magical Ambush triggers on the Invisible condition (2024 PHB — was "target cannot see you")');
  const versatile = ss.featuresAtLevel('rogue', 'Arcane Trickster', 13).find((f) => f.key === 'versatile_trickster');
  ok(versatile && String(versatile.mechanics.trigger).includes('Trip option of Cunning Strike'), 'Versatile Trickster rides on the Trip Cunning Strike option (2024 PHB — was Advantage while the hand is near)');
  const thief = ss.featuresAtLevel('rogue', 'Arcane Trickster', 17).find((f) => f.key === 'spell_thief');
  ok(thief && String(thief.mechanics.reaction).includes('Intelligence saving throw'), 'Spell Thief forces an Intelligence save vs your spell save DC (2024 PHB — was an Int-save contest)');
  ok(thief && String(thief.mechanics.uses).includes('once per Long Rest'), 'Spell Thief is once per Long Rest (2024 PHB)');
  ok(ss.featuresAtLevel('rogue', 'Assassin', 3).length === 2, 'Assassin L3 has Assassinate + Assassin\'s Tools (2024 PHB — Tools was missing)');
  ok(ss.featuresAtLevel('rogue', 'Assassin', 3).some((f) => f.key === 'assassins_tools'), 'Assassin L3 grants Assassin\'s Tools (Disguise Kit + Poisoner\'s Kit)');
  ok(ss.featuresAtLevel('rogue', 'Assassin', 13).some((f) => f.key === 'envenom_weapons'), 'Assassin L13 is Envenom Weapons (2024 PHB)');
  ok(!ss.featuresAtLevel('rogue', 'Assassin', 13).some((f) => f.key === 'impostor'), 'no Impostor key survives the 2024 rename (Impostor was 2014)');
  const envenom = ss.featuresAtLevel('rogue', 'Assassin', 13).find((f) => f.key === 'envenom_weapons');
  ok(envenom && String(envenom.mechanics.effect).includes('2d6 Poison damage'), 'Envenom Weapons adds 2d6 Poison on a failed Poison save (2024 PHB)');
  const assassinate = ss.featuresAtLevel('rogue', 'Assassin', 3).find((f) => f.key === 'assassinate');
  ok(assassinate && String(assassinate.mechanics.surprisingStrikes).includes('equal to your Rogue level'), 'Assassinate Surprising Strikes adds damage equal to Rogue level (2024 PHB — no crit-vs-Surprised)');
  ok(ss.featuresAtLevel('rogue', 'Soulknife', 3).some((f) => f.key === 'psychic_whispers'), 'Soulknife L3 has Psychic Whispers (2024 PHB — was at 9th)');
  const whispers = ss.featuresAtLevel('rogue', 'Soulknife', 3).find((f) => f.key === 'psychic_whispers');
  ok(whispers && String(whispers.mechanics.duration).includes('equal to the die roll'), 'Psychic Whispers lasts hours equal to the die roll (2024 PHB — was 1 hour)');
  const soulBlades = ss.featuresAtLevel('rogue', 'Soulknife', 9).find((f) => f.key === 'soul_blades');
  ok(soulBlades && JSON.stringify(soulBlades.mechanics.effects).includes('add it to the attack roll'), 'Soul Blades Homing Strikes ADDS the die to the attack roll (2024 PHB — was a reroll)');
  ok(soulBlades && JSON.stringify(soulBlades.mechanics.effects).includes('teleport to that space'), 'Soul Blades Psychic Teleportation teleports you to the thrown blade (2024 PHB — was teleport-to-target on a hit)');
  const veil = ss.featuresAtLevel('rogue', 'Soulknife', 13).find((f) => f.key === 'psychic_veil');
  ok(veil && String(veil.mechanics.effect).includes('1 hour'), 'Psychic Veil lasts 1 hour (2024 PHB — was 10 minutes)');
  const rend = ss.featuresAtLevel('rogue', 'Soulknife', 17).find((f) => f.key === 'rend_mind');
  ok(rend && String(rend.mechanics.trigger).includes('Sneak Attack damage'), 'Rend Mind triggers on Sneak Attack damage with Psychic Blades (2024 PHB — was any Psychic Blade damage)');
  const supreme = ss.featuresAtLevel('rogue', 'Thief', 9).find((f) => f.key === 'supreme_sneak');
  ok(supreme && String(supreme.mechanics.effect).includes('Stealth Attack Cunning Strike option'), 'Supreme Sneak grants the Stealth Attack Cunning Strike option (2024 PHB — was Advantage on Stealth)');
  const umd = ss.featuresAtLevel('rogue', 'Thief', 13).find((f) => f.key === 'use_magic_device');
  ok(umd && JSON.stringify(umd.mechanics.effects).includes('up to four magic items'), 'Use Magic Device attunes up to four magic items (2024 PHB — was ignore requirements)');
  const secondStory = ss.featuresAtLevel('rogue', 'Thief', 3).find((f) => f.key === 'second_story_work');
  ok(secondStory && String(secondStory.mechanics.jumpDistance).includes('using Dexterity rather than Strength'), 'Second-Story Work determines jump distance using Dexterity (2024 PHB — was +Dex modifier feet)');
  const fastHands = ss.featuresAtLevel('rogue', 'Thief', 3).find((f) => f.key === 'fast_hands');
  ok(fastHands && JSON.stringify(fastHands.mechanics.effects).includes('pick a pocket'), 'Fast Hands includes picking a pocket (2024 PHB)');
}

group('6. Zealot Divine Fury');
ok(ss.zealotDivineFuryBonus(3).dice === '1d6' && ss.zealotDivineFuryBonus(3).flat === 1, 'Zealot L3: 1d6 + 1');
ok(ss.zealotDivineFuryBonus(6).flat === 3, 'Zealot L6: 1d6 + 3');
ok(ss.zealotDivineFuryBonus(10).flat === 5, 'Zealot L10: 1d6 + 5');

group('7. Choice validation (kind G)');
ok(ss.validateChoiceList('fighter', 'Battle Master', 'battle_master_maneuvers', ['Precision Attack', 'Riposte']).valid, 'Precision Attack + Riposte are valid maneuvers');
ok(!ss.validateChoiceList('fighter', 'Battle Master', 'battle_master_maneuvers', ['Precision Attack', 'Fireball']).valid, 'Fireball is not a maneuver');
ok(!ss.validateChoiceList('fighter', 'Battle Master', 'battle_master_maneuvers', ['Riposte', 'Riposte']).valid, 'duplicate maneuver is invalid');
ok(!ss.validateChoiceList('fighter', 'Battle Master', 'battle_master_maneuvers', ['Ambush', 'Parry', 'Riposte', 'Trip Attack', 'Precision Attack', 'Menacing Attack', 'Goading Attack', 'Rally', 'Sweeping Attack', 'Feinting Attack']).valid, '10 maneuvers exceeds maxCount 9 (2024 PHB: 3 at L3, +2 at 7/10/15 = 9)');
ok(ss.validateChoiceList('fighter', 'Battle Master', 'battle_master_maneuvers', ['Ambush', 'Bait and Switch', "Commander's Strike", 'Commanding Presence', 'Disarming Attack', 'Distracting Strike', 'Evasive Footwork', 'Feinting Attack', 'Goading Attack']).valid, 'all 9 PHB maneuvers at once are valid (2024 PHB list of 20)');
ok(!ss.validateChoiceList('fighter', 'Battle Master', 'battle_master_maneuvers', ['Grappling Strike']).valid, 'Grappling Strike is not a 2024 PHB maneuver (2014 Tasha\'s)');
ok(!ss.validateChoiceList('fighter', 'Battle Master', 'battle_master_maneuvers', ['Quick Toss']).valid, 'Quick Toss is not a 2024 PHB maneuver (2014 Tasha\'s)');
ok(ss.validateChoice('barbarian', 'Path of the Wild Heart', 'wild_heart_animal', 'Bear').valid, 'Bear is a valid Wild Heart animal');
ok(ss.validateChoice('barbarian', 'Path of the Wild Heart', 'wild_heart_animal', 'Eagle').valid, 'Eagle is a valid Wild Heart animal');
ok(!ss.validateChoice('barbarian', 'Path of the Wild Heart', 'wild_heart_animal', 'Lion').valid, 'Lion is not a Rage of the Wilds animal (L3 list is Bear/Eagle/Wolf; Lion is a Power of the Wilds L14 option)');
ok(ss.validateChoice('barbarian', 'Path of the Wild Heart', 'wild_heart_aspect', 'Owl').valid, 'Owl is a valid Aspect of the Wilds animal (2024 PHB L6)');
ok(ss.validateChoice('barbarian', 'Path of the Wild Heart', 'wild_heart_aspect', 'Panther').valid, 'Panther is a valid Aspect of the Wilds animal (2024 PHB L6)');
ok(ss.validateChoice('barbarian', 'Path of the Wild Heart', 'wild_heart_aspect', 'Salmon').valid, 'Salmon is a valid Aspect of the Wilds animal (2024 PHB L6)');
ok(!ss.validateChoice('barbarian', 'Path of the Wild Heart', 'wild_heart_aspect', 'Bear').valid, 'Bear is not an Aspect of the Wilds animal (Bear is L3 Rage of the Wilds)');
ok(ss.validateChoice('barbarian', 'Path of the Wild Heart', 'wild_heart_power', 'Falcon').valid, 'Falcon is a valid Power of the Wilds animal (2024 PHB L14)');
ok(ss.validateChoice('barbarian', 'Path of the Wild Heart', 'wild_heart_power', 'Lion').valid, 'Lion IS a valid Power of the Wilds animal (2024 PHB L14)');
ok(ss.validateChoice('barbarian', 'Path of the Wild Heart', 'wild_heart_power', 'Ram').valid, 'Ram is a valid Power of the Wilds animal (2024 PHB L14)');
ok(ss.parseSubclassChoices('').battle_master_maneuvers === undefined, 'blank choices parse to empty');
ok(Object.keys(ss.parseSubclassChoices('not json')).length === 0, 'malformed choices parse to empty, never throw');
ok(Object.keys(ss.parseSubclassChoices('[]')).length === 0, 'array choices parse to empty');

group('8. Spell access checked against the catalog (kind D)');
{
  const inCatalog = (name) => Object.prototype.hasOwnProperty.call(SPELL_DATA_ENTRIES, String(name).toLowerCase());
  const shadow = ss.getSubclass('monk', 'Warrior of Shadow').features.find((f) => f.key === 'shadow_arts');
  ok(shadow.mechanics.spells.every(inCatalog), 'Shadow Arts spells are all in the catalog');
  ok(inCatalog(shadow.mechanics.cantrip), 'Minor Illusion is in the catalog');
  const ek = ss.getSubclass('fighter', 'Eldritch Knight').features.find((f) => f.key === 'eldritch_knight_spellcasting');
  ok(ek.mechanics.cantrips.every(inCatalog), 'Eldritch Knight cantrips are all in the catalog');
  ok(ek.mechanics.exampleSpells.every(inCatalog), 'Eldritch Knight example spells are all in the catalog');
  ok(inCatalog('Mage Hand'), 'Mage Hand (Arcane Trickster) is in the catalog');
  ok(inCatalog('Elementalism'), 'Elementalism (Warrior of the Elements) is in the catalog');
}

group('9. DB round-trip + prompt section + migration 103 column');
const pc = await addPc({ subclass: 'Path of the Zealot', subclass_choices_json: JSON.stringify({ battle_master_maneuvers: ['Precision Attack', 'Riposte'] }) });
const mercyComp = await addCompanion('Mira', pc.id, { companion_class: 'Monk', companion_subclass: 'Warrior of Mercy' });
const npcStatsComp = await addCompanion('Brute', pc.id, { companion_class: 'Barbarian', companion_subclass: 'Path of the Berserker', progression_type: 'npc_stats' });
const pcRow = await dbGet('SELECT * FROM characters WHERE id = ?', [pc.id]);
ok(pcRow.subclass === 'Path of the Zealot', 'PC subclass persists on the character row');
ok(pcRow.subclass_choices_json != null, 'subclass_choices_json column exists on characters (migration 103)');
const stored = ss.parseSubclassChoices(pcRow.subclass_choices_json);
ok(ss.validateChoiceList('fighter', 'Battle Master', 'battle_master_maneuvers', stored.battle_master_maneuvers).valid, 'stored maneuvers validate against the registry');
const section = ss.buildSubclassPromptSection(pcRow, [mercyComp, npcStatsComp]);
ok(section.includes('Path of the Zealot'), 'prompt section names the PC subclass');
ok(section.includes('Divine Fury'), 'prompt section lists Divine Fury');
ok(section.includes('Hand of Healing'), 'prompt section lists the companion Mercy feature');
ok(!section.includes('Brute'), 'npc_stats companion is skipped in the subclass section');
ok(section.includes('Never silently add'), 'prompt section carries the PC reported-total rule');

console.log(`\nsubclass-batch1: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
