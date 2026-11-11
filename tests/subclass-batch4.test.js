// tests/subclass-batch4.test.js — Batch 4 (PHB 2024 entity-heavy
// classes, LAST PHB batch): Druid 4, Ranger 4. Completes all 48
// PHB 2024 subclasses (40 built through Batch 3 + 8 here).
// Gloom Stalker is counted once, as PHB 2024, not double-counted
// from Xanathar; Fey Wanderer once, as PHB 2024, not from Tasha's.
// Real services, real DB, same pattern as earlier subclass tests.
//
// SCAN-EDITION NOTE: the "PHB 2024 Classes Pt1/Pt2" scans are
// image-only printouts of the 2014 PHB, Chapter 3 (AnyFlip
// flipbook dated 2024-04-24). They cannot source Sea, Stars,
// Fey Wanderer, or Gloom Stalker, and their Land/Moon/Hunter/
// Beast numbers are the 2014 numbers. Batch 4 is therefore NOT
// scan-checked: every level and number is gateCheck, authored
// from 2024 knowledge cross-checked against secondary 2024
// summaries, in the app's own wording, never copied verbatim.
//
// H-KIND HONESTY: Circle of the Moon Wild Shape forms and the
// Beast Master Primal Companion have no entity row in the app.
// Their numbers, limits, and choices are registry data + DM
// prompt only; the entity paths are modeled-not-ready and are
// asserted as such, never as entities.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-subclass-batch4-'));
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
    name: 'Tester', class: 'Druid', level: 6,
    current_hp: 60, max_hp: 60, armor_class: 15,
    ability_scores: JSON.stringify({ str: 10, dex: 14, con: 14, int: 12, wis: 18, cha: 10 }),
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

group('1. Registry counts and lookup');
ok(ss.listSubclasses('druid').length === 9, 'Druid file exports exactly 9 (4 PHB + 2 S1 + 1 S3 + 1 S4) + 1 Additional');
ok(ss.listSubclasses('ranger').length === 9, 'Ranger file exports exactly 9 (4 PHB + 2 S2 + 1 S4 + 1 S5) + 1 Additional');
ok(ss.getSubclass('druid', 'Circle of the Land')?.key === 'circle_of_the_land', 'Circle of the Land found');
ok(ss.getSubclass('druid', 'Circle of the Moon')?.key === 'circle_of_the_moon', 'Circle of the Moon found');
ok(ss.getSubclass('druid', 'Circle of the Sea')?.key === 'circle_of_the_sea', 'Circle of the Sea found (new in 2024, absent from the 2014 scans)');
ok(ss.getSubclass('druid', 'Circle of the Stars')?.key === 'circle_of_the_stars', 'Circle of the Stars found (imported from Tasha\'s, updated for 2024)');
ok(ss.getSubclass('ranger', 'Beast Master')?.key === 'beast_master', 'Beast Master found');
ok(ss.getSubclass('ranger', 'Fey Wanderer')?.key === 'fey_wanderer', 'Fey Wanderer found (PHB 2024, counted once, not double-counted from Tasha\'s)');
ok(ss.getSubclass('ranger', 'Gloom Stalker')?.key === 'gloom_stalker', 'Gloom Stalker found (PHB 2024, counted once, not double-counted from Xanathar)');
ok(ss.getSubclass('ranger', 'Hunter')?.key === 'hunter', 'Hunter found');
ok(ss.getSubclass('ranger', 'Unknown Subclass') === null, 'Unknown Subclass is not in Batch 4 (never invented)');
ok(ss.getSubclass('ranger', 'Swarmkeeper') === null, 'Swarmkeeper is not in Batch 4 (Tasha\'s, later batch, never invented)');

group('2. Selection levels, origins, and cadences');
for (const [cls, name] of [
  ['druid', 'Circle of the Land'], ['druid', 'Circle of the Moon'], ['druid', 'Circle of the Sea'], ['druid', 'Circle of the Stars'],
  ['ranger', 'Beast Master'], ['ranger', 'Fey Wanderer'], ['ranger', 'Gloom Stalker'], ['ranger', 'Hunter'],
]) {
  const e = ss.getSubclass(cls, name);
  ok(e?.selectionLevel === 3, `${name} selection level is 3`);
  ok(e?.origin_setting === 'Forgotten Realms', `${name} origin is Forgotten Realms`);
  ok(e?.gateCheckRequired === true, `${name} is flagged gateCheck (not scan-checked — see header)`);
  ok((e?.features || []).every((f) => f.gateCheck === true), `${name} every feature is flagged gateCheck`);
}
// Cadences: Druid 3/6/10/14 (two features at 3rd), Ranger 3/7/11/15.
for (const name of ['Circle of the Land', 'Circle of the Moon', 'Circle of the Sea', 'Circle of the Stars']) {
  ok(ss.featuresAtLevel('druid', name, 3).length === 2, `${name} L3 has exactly 2 features`);
  ok(ss.featuresAtLevel('druid', name, 6).length === 3, `${name} L6 has exactly 3 features`);
  ok(ss.featuresAtLevel('druid', name, 14).length === 5, `${name} L14 has all 5 features`);
}
ok(ss.featuresAtLevel('ranger', 'Beast Master', 3).length === 1, 'Beast Master L3 has Primal Companion only');
ok(ss.featuresAtLevel('ranger', 'Beast Master', 15).length === 4, 'Beast Master L15 has all 4 features');
ok(ss.featuresAtLevel('ranger', 'Fey Wanderer', 3).length === 3, 'Fey Wanderer L3 has Dreadful Strikes + Spells + Otherworldly Glamour');
ok(ss.featuresAtLevel('ranger', 'Fey Wanderer', 15).length === 6, 'Fey Wanderer L15 has all 6 features');
ok(ss.featuresAtLevel('ranger', 'Gloom Stalker', 3).length === 3, 'Gloom Stalker L3 has Dread Ambusher + Spells + Umbral Sight');
ok(ss.featuresAtLevel('ranger', 'Gloom Stalker', 15).length === 6, 'Gloom Stalker L15 has all 6 features');
ok(ss.featuresAtLevel('ranger', 'Hunter', 3).length === 2, 'Hunter L3 has Hunter\'s Lore + Hunter\'s Prey');
ok(ss.featuresAtLevel('ranger', 'Hunter', 15).length === 5, 'Hunter L15 has all 5 features');

group('3. Batch 4 pure math');
ok(ss.moonWildShapeTempHp(6) === 18, 'Moon Wild Shape L6: 3 x 6 = 18 temp HP');
ok(ss.moonWildShapeTempHp(20) === 60, 'Moon Wild Shape L20: 3 x 20 = 60 temp HP');
ok(ss.moonWildShapeMaxCr(9) === 3, 'Moon Wild Shape L9: max CR 9 / 3 = 3');
ok(ss.moonWildShapeMaxCr(10) === 3, 'Moon Wild Shape L10: max CR floor(10 / 3) = 3');
ok(ss.moonWildShapeMaxCr(2) === 0, 'Moon Wild Shape below 3rd: max CR 0');
ok(ss.moonWildShapeAc(3, 12) === 16, 'Moon Wild Shape Wis +3, Beast AC 12: 13 + 3 = 16 wins');
ok(ss.moonWildShapeAc(3, 18) === 18, 'Moon Wild Shape Wis +3, Beast AC 18: Beast AC wins');
ok(ss.landAidDice(3).count === 2 && ss.landAidDice(3).die === 6, 'Land\'s Aid L3: 2d6');
ok(ss.landAidDice(10).count === 3, 'Land\'s Aid L10: 3d6');
ok(ss.landAidDice(14).count === 4, 'Land\'s Aid L14: 4d6');
ok(ss.wrathOfTheSeaDice(4).count === 4 && ss.wrathOfTheSeaDice(4).die === 6, 'Wrath of the Sea Wis +4: 4d6 Cold');
ok(ss.wrathOfTheSeaDice(0).count === 1, 'Wrath of the Sea Wis 0: minimum 1 die');
ok(ss.wrathOfTheSeaDice(-1).count === 1, 'Wrath of the Sea negative Wis: minimum 1 die');
ok(ss.starryFormDice(9).count === 1 && ss.starryFormDice(9).die === 8, 'Starry Form L9: Archer/Chalice 1d8');
ok(ss.starryFormDice(10).count === 2, 'Starry Form L10: Archer/Chalice 2d8');
ok(ss.primalCompanionAc(2) === 15, 'Primal Companion Wis +2: AC 13 + 2 = 15');
ok(ss.primalCompanionHp('Beast of the Land', 5) === 30, 'Land companion L5: 5 + 5 x 5 = 30 HP');
ok(ss.primalCompanionHp('Beast of the Sea', 5) === 30, 'Sea companion L5: 5 + 5 x 5 = 30 HP (gateCheck)');
ok(ss.primalCompanionHp('Beast of the Sky', 5) === 24, 'Sky companion L5: 4 + 4 x 5 = 24 HP');
ok(ss.primalCompanionHp('Beast of the Pack', 5) === null, 'Beast of the Pack is not a PHB 2024 statblock — no HP invented for it');
ok(ss.dreadfulStrikesDie(3).die === 4, 'Dreadful Strikes L3: 1d4 Psychic');
ok(ss.dreadfulStrikesDie(11).die === 6, 'Dreadful Strikes L11: 1d6 Psychic');
ok(ss.dreadAmbusherDice(3).count === 2 && ss.dreadAmbusherDice(3).die === 6, 'Dread Ambusher L3: 2d6 Psychic');
ok(ss.dreadAmbusherDice(11).die === 8, 'Dread Ambusher L11 (Stalker\'s Flurry): 2d8 Psychic');
ok(ss.colossusSlayerDamage() === '1d8', 'Colossus Slayer: extra 1d8');

group('4. Spell access: circle and subclass spells are always prepared');
ok(ss.druidCircleSpellsAtLevel('druid', 'Circle of the Land', 9, 'temperate').join(',') === 'Misty Step,Shocking Grasp,Sleep,Lightning Bolt,Freedom of Movement,Tree Stride', 'Land temperate L9: 6 spells (3 at 3rd, 1 each at 5th/7th/9th)');
ok(ss.druidCircleSpellsAtLevel('druid', 'Circle of the Land', 9, 'arid').includes('Fireball'), 'Land arid L9 includes Fireball');
ok(ss.druidCircleSpellsAtLevel('druid', 'Circle of the Land', 9).length === 0, 'Land with no stored land_type returns no spells — never silently defaults a land');
ok(ss.druidCircleSpellsAtLevel('druid', 'Circle of the Moon', 9).join(',') === 'Cure Wounds,Moonbeam,Starry Wisp,Conjure Animals,Fount of Moonlight,Mass Cure Wounds', 'Moon L9: 6 always-prepared spells, castable in Wild Shape');
ok(ss.druidCircleSpellsAtLevel('druid', 'Circle of the Sea', 9).length === 11, 'Sea L9: 11 always-prepared spells');
ok(ss.druidCircleSpellsAtLevel('druid', 'Circle of the Sea', 9).includes('Conjure Elemental'), 'Sea L9 includes Conjure Elemental');
ok(ss.druidCircleSpellsAtLevel('druid', 'Circle of the Stars', 3).join(',') === 'Guidance,Guiding Bolt', 'Stars: Guidance + Guiding Bolt prepared while holding the Star Map');
ok(ss.rangerSubclassSpellsAtLevel('ranger', 'Fey Wanderer', 17).join(',') === 'Charm Person,Misty Step,Summon Fey,Dimension Door,Mislead', 'Fey Wanderer L17: all 5 always-prepared spells');
ok(ss.rangerSubclassSpellsAtLevel('ranger', 'Gloom Stalker', 17).join(',') === 'Disguise Self,Rope Trick,Fear,Greater Invisibility,Seeming', 'Gloom Stalker L17: all 5 always-prepared spells');
ok(ss.rangerSubclassSpellsAtLevel('ranger', 'Beast Master', 15).length === 0, 'Beast Master has no subclass spell list');
ok(ss.rangerSubclassSpellsAtLevel('ranger', 'Hunter', 15).length === 0, 'Hunter has no subclass spell list');
{
  const moon = ss.getSubclass('druid', 'Circle of the Moon').features.find((f) => f.kind === 'D');
  ok(moon.mechanics.access === 'always prepared' && moon.mechanics.castableInWildShape === true, 'Moon spells are always prepared and castable in Wild Shape');
  const sea = ss.getSubclass('druid', 'Circle of the Sea').features.find((f) => f.kind === 'D');
  ok(sea.mechanics.access === 'always prepared', 'Sea spells are always prepared');
}

group('5. Spell access checked against the catalog (kind D) — no catalog gap in Batch 4');
{
  const inCatalog = (name) => Object.prototype.hasOwnProperty.call(SPELL_DATA_ENTRIES, String(name).toLowerCase());
  const lists = [
    ['Land arid', ss.druidCircleSpellsAtLevel('druid', 'Circle of the Land', 9, 'arid')],
    ['Land polar', ss.druidCircleSpellsAtLevel('druid', 'Circle of the Land', 9, 'polar')],
    ['Land temperate', ss.druidCircleSpellsAtLevel('druid', 'Circle of the Land', 9, 'temperate')],
    ['Land tropical', ss.druidCircleSpellsAtLevel('druid', 'Circle of the Land', 9, 'tropical')],
    ['Moon', ss.druidCircleSpellsAtLevel('druid', 'Circle of the Moon', 9)],
    ['Sea', ss.druidCircleSpellsAtLevel('druid', 'Circle of the Sea', 9)],
    ['Stars', ss.druidCircleSpellsAtLevel('druid', 'Circle of the Stars', 3)],
    ['Fey Wanderer', ss.rangerSubclassSpellsAtLevel('ranger', 'Fey Wanderer', 17)],
    ['Gloom Stalker', ss.rangerSubclassSpellsAtLevel('ranger', 'Gloom Stalker', 17)],
  ];
  for (const [label, spells] of lists) {
    ok(spells.length > 0 && spells.every(inCatalog), `${label} every spell is in the catalog (no gap)`);
  }
}

group('6. Choice validation (kind G)');
ok(ss.validateChoice('druid', 'Circle of the Land', 'land_type', 'temperate').valid, 'temperate is a valid Land type');
ok(!ss.validateChoice('druid', 'Circle of the Land', 'land_type', 'swamp').valid, 'swamp is a 2014 terrain, not a 2024 land option — rejected');
ok(ss.validateChoice('ranger', 'Beast Master', 'primal_beast_statblock', 'Beast of the Sky').valid, 'Beast of the Sky is a valid Primal Companion statblock');
ok(!ss.validateChoice('ranger', 'Beast Master', 'primal_beast_statblock', 'Beast of the Pack').valid, 'Beast of the Pack is a later variant, not a PHB 2024 option — rejected');
ok(ss.validateChoice('ranger', 'Fey Wanderer', 'otherworldly_glamour_skill', 'Persuasion').valid, 'Persuasion is a valid Otherworldly Glamour skill');
ok(!ss.validateChoice('ranger', 'Fey Wanderer', 'otherworldly_glamour_skill', 'Stealth').valid, 'Stealth is not an Otherworldly Glamour skill option');
ok(ss.validateChoice('ranger', 'Hunter', 'hunters_prey', 'Colossus Slayer').valid, 'Colossus Slayer is a valid Hunter\'s Prey option');
ok(ss.validateChoice('ranger', 'Hunter', 'hunters_prey', 'Horde Breaker').valid, 'Horde Breaker is a valid Hunter\'s Prey option');
ok(!ss.validateChoice('ranger', 'Hunter', 'hunters_prey', 'Multiattack').valid, 'Multiattack is not a Hunter\'s Prey option (2024 Hunter dropped it)');
ok(ss.validateChoice('ranger', 'Hunter', 'defensive_tactics', 'Escape the Horde').valid, 'Escape the Horde is a valid Defensive Tactics option');
ok(ss.validateChoice('ranger', 'Hunter', 'defensive_tactics', 'Multiattack Defense').valid, 'Multiattack Defense is a valid Defensive Tactics option');
ok(ss.validateChoice('druid', 'Circle of the Stars', 'starry_constellation', 'Dragon').valid, 'Dragon is a valid Starry Form constellation (per-activation choice)');
ok(!ss.validateChoice('druid', 'Circle of the Stars', 'starry_constellation', 'Phoenix').valid, 'Phoenix is not a Starry Form constellation');
ok(!ss.validateChoice('druid', 'Circle of the Moon', 'land_type', 'temperate').valid, 'Moon has no land_type choice');
ok(ss.parseSubclassChoices(JSON.stringify({ land_type: 'polar', primal_beast_statblock: 'Beast of the Land' })).land_type === 'polar', 'stored Land choice parses');
ok(ss.validateChoice('druid', 'Circle of the Land', 'land_type', ss.parseSubclassChoices(JSON.stringify({ land_type: 'polar' })).land_type).valid, 'stored Land choice validates against the registry');

group('7. H-kind entity paths: modeled-not-ready, honestly');
{
  const forms = ss.getSubclass('druid', 'Circle of the Moon').features.find((f) => f.key === 'circle_forms');
  ok(forms.kind === 'H', 'Circle Forms is kind H (entity/transformation)');
  ok(forms.mechanics.entityPath.includes('MODELED-NOT-READY'), 'Circle Forms entity path is flagged modeled-not-ready');
  ok(forms.prompt.includes('modeled-not-ready'), 'Circle Forms prompt says modeled-not-ready, never pretends a form entity exists');
  const companion = ss.getSubclass('ranger', 'Beast Master').features.find((f) => f.key === 'primal_companion');
  ok(companion.kind === 'H', 'Primal Companion is kind H (entity/transformation)');
  ok(companion.mechanics.entityPath.includes('MODELED-NOT-READY'), 'Primal Companion entity path is flagged modeled-not-ready');
  ok(companion.prompt.includes('modeled-not-ready'), 'Primal Companion prompt says modeled-not-ready, never pretends a beast entity exists');
  ok(!('entityRow' in forms.mechanics) && !('entityRow' in companion.mechanics), 'no invented entity row shape is encoded for either H feature');
  const starMap = ss.getSubclass('druid', 'Circle of the Stars').features.find((f) => f.key === 'star_map');
  ok(starMap.mechanics.freeGuidingBolt.includes('Wisdom modifier'), 'Star Map free Guiding Bolt count is settled: Wis mod per Long Rest (2024 PHB)');
  ok(!starMap.mechanics.freeGuidingBolt.includes('DM confirms'), 'Star Map no longer hedges on the count (the PHB settles it)');
  const omen = ss.getSubclass('druid', 'Circle of the Stars').features.find((f) => f.key === 'cosmic_omen');
  ok(omen.kind === 'F' && omen.mechanics.effect.includes('gate-check'), 'Cosmic Omen is DM-prompt only with numbers held as gate-check items');
}

group('8. DB round-trip + prompt section + migration 103 column');
const pc = await addPc({ subclass: 'Circle of the Land', subclass_choices_json: JSON.stringify({ land_type: 'temperate' }) });
const beastComp = await addCompanion('Ash', pc.id, { companion_class: 'Ranger', companion_subclass: 'Beast Master', subclass_choices_json: JSON.stringify({ primal_beast_statblock: 'Beast of the Land' }) });
const npcStatsComp = await addCompanion('Brute', pc.id, { companion_class: 'Druid', companion_subclass: 'Circle of the Moon', progression_type: 'npc_stats' });
const pcRow = await dbGet('SELECT * FROM characters WHERE id = ?', [pc.id]);
ok(pcRow.subclass === 'Circle of the Land', 'PC subclass persists on the character row');
ok(pcRow.subclass_choices_json != null, 'subclass_choices_json column exists on characters (migration 103)');
ok(ss.validateChoice('druid', 'Circle of the Land', 'land_type', ss.parseSubclassChoices(pcRow.subclass_choices_json).land_type).valid, 'stored Land choice validates against the registry');
const section = ss.buildSubclassPromptSection(pcRow, [beastComp, npcStatsComp]);
ok(section.includes('Circle of the Land'), 'prompt section names the PC subclass');
ok(section.includes("Land's Aid"), 'prompt section lists Land\'s Aid');
ok(section.includes('Beast Master'), 'prompt section lists the companion Beast Master feature');
ok(section.includes('Primal Companion'), 'prompt section lists the companion Primal Companion');
ok(!section.includes('Brute'), 'npc_stats companion is skipped in the subclass section');
ok(section.includes('Never silently add'), 'prompt section carries the PC reported-total rule');

console.log(`\nsubclass-batch4: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
