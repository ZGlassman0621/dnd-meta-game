// tests/subclass-scanned4.test.js — Scanned Batch S4 (Hoard of
// Heroes, third-party/homebrew — Zach: ABSOLUTELY NECESSARY):
// Barbarian Path of the Mountain, Bard College of Mirrors, Cleric
// Revelry Domain, Druid Circle of Sand, Fighter Monster Hunter,
// Monk Warrior of Waves (source: Way of Waves), Paladin Oath of
// Resolve, Ranger Stone Singer, Rogue Slider, Sorcerer Planar
// Magic, Warlock The Ancient Dragon + The Beholder, Wizard Hedge
// Mage = 13 new, registry 81 -> 94. Heroes 8 remain unbuilt.
// Real services, real DB, same pattern as earlier subclass tests.
//
// CONVERSION NOTE: Hoard is 2014-pattern (Cleric 1st, Druid 2nd,
// Sorcerer 1st, Warlock 1st, Wizard 2nd, others 3rd). Every S4
// grant is re-pointed onto the built 2024 cadences (see each
// entry's conversionCheck); no 2024 reprint exists for any S4
// subclass, so every S4 number is conversionCheck + gateCheck.
// Nothing here was authored from the mislabeled 2014 PHB Pt1/Pt2
// scans. Mechanics are paraphrased in the app's own wording.
// The S2 Hexblade ruling (Banishing kept, Shining replaces
// Branding, catalog 543) is NOT re-litigated here; the catalog
// count asserted below is 583 (544 + 38 overnight-build spells from the
// Artificer base class build, 2026-11-04, + Summon Dragon from the sorcerer
// reconciliation, 2026-11-06), verified against the live Mac catalog, not assumed from 542.
//
// ORIGIN NOTE: Hoard entries are Forgotten Realms except Warrior
// of Waves, whose source places it with the sea elves of the
// coast of Deva'lamirusandia (a Hoard-invented place, not FR),
// so it carries a non-FR origin and requires an origin
// explanation — flagged for Zach to confirm/override. No other
// S4 entry takes the outside-FR explanation requirement, and no
// outside-FR origin is invented for any entry the source leaves
// setting-neutral.
//
// INVOCATIONS NOTE: the Hoard Eldritch Invocations section tied
// to the two new patrons (9 invocations, extract p.16) is a
// separate feature system, NOT subclasses, and is NOT wired in
// this batch — logged as a follow-up so it is not lost.
//
// MODELED-NOT-READY (no invented rows): the Sand spirit and its
// Large mount form, the Dust Devil merged form, the Hidden
// Hoard lair space, and the Extraneous Ego clone body are
// DM-tracked positions/states, not entity rows. Monster
// Hunter's feature table names a "Last Dance" 18th-level grant
// for which the extract carries NO body text — it is NOT
// invented here and is flagged for Zach/the gate.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-subclass-scanned4-'));
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
    name: 'Tester', class: 'Fighter', level: 10,
    current_hp: 60, max_hp: 60, armor_class: 18,
    ability_scores: JSON.stringify({ str: 14, dex: 12, con: 14, int: 10, wis: 16, cha: 10 }),
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
    companion_ability_scores: JSON.stringify({ str: 14, dex: 12, con: 14, int: 16, wis: 14, cha: 10 }),
    companion_current_hp: 50, companion_max_hp: 50, armor_class: 16,
    ...over
  });
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [id]);
  return { ...row, display_name: name };
}

const S4 = [
  ['barbarian', 'Path of the Mountain'],
  ['bard', 'College of Mirrors'],
  ['cleric', 'Revelry Domain'],
  ['druid', 'Circle of Sand'],
  ['fighter', 'Monster Hunter'],
  ['monk', 'Warrior of Waves'],
  ['paladin', 'Oath of Resolve'],
  ['ranger', 'Stone Singer'],
  ['rogue', 'Slider'],
  ['sorcerer', 'Planar Magic'],
  ['warlock', 'The Ancient Dragon'],
  ['warlock', 'The Beholder'],
  ['wizard', 'Hedge Mage'],
];

group('1. Registry counts/lookup');
ok(ss.listSubclasses('barbarian').length === 9, 'Barbarian file exports exactly 9 (6 prior + Path of the Mountain) + 2 Additional');
ok(ss.listSubclasses('bard').length === 11, 'Bard file exports exactly 11 (8 prior + College of the Moon) + 2 Additional');
ok(ss.listSubclasses('cleric').length === 11, 'Cleric file exports exactly 11 (8 prior + Knowledge Domain) + 2 Additional');
ok(ss.listSubclasses('druid').length === 9, 'Druid file exports exactly 9 (7 prior + Circle of Sand) + 1 Additional');
ok(ss.listSubclasses('fighter').length === 11, 'Fighter file exports exactly 11 (9 prior + Banneret) + 1 Additional');
ok(ss.listSubclasses('monk').length === 9, 'Monk file exports exactly 9 (7 prior + Warrior of Waves) + 1 Additional');
ok(ss.listSubclasses('paladin').length === 9, 'Paladin file exports exactly 9 (7 prior + Oath of the Noble Genies) + 1 Additional');
ok(ss.listSubclasses('ranger').length === 9, 'Ranger file exports exactly 9 (7 prior + Winter Walker) + 1 Additional');
ok(ss.listSubclasses('rogue').length === 11, 'Rogue file exports exactly 11 (9 prior + Scion of the Three) + 1 Additional');
ok(ss.listSubclasses('sorcerer').length === 10, 'Sorcerer file exports exactly 10 (8 prior + Spellfire Sorcery) + 1 Additional');
ok(ss.listSubclasses('warlock').length === 9, 'Warlock file exports exactly 9 (5 prior + Ancient Dragon + Beholder) + 2 Additional');
ok(ss.listSubclasses('wizard').length === 10, 'Wizard file exports exactly 10 (8 prior + Bladesinger) + 1 Additional');
{
  const total = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'rogue', 'wizard', 'warlock', 'sorcerer', 'paladin', 'ranger']
    .reduce((a, c) => a + ss.listSubclasses(c).length, 0);
  ok(total === 118, 'Registry total is 118 (102 + 16 Additional across the 12 classes; artificer + new classes counted separately)');
}
for (const [cls, name] of S4) {
  ok(ss.getSubclass(cls, name)?.name === name, `${name} found by class + name`);
}
ok(ss.listSubclasses('warlock').filter((s) => s.key === 'the_beholder').length === 1, 'The Beholder appears exactly once');
ok(ss.getSubclass('monk', 'Way of Waves') === null, 'The 2014 name Way of Waves is NOT a second registry entry (2024 name Warrior of Waves only)');

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
for (const [cls, name] of S4) {
  const e = ss.getSubclass(cls, name);
  ok(e.selectionLevel === 3, `${name} selects at 3rd (2024 cadence, not the Hoard 1st/2nd)`);
  ok(e.sourceTier === 'scanned' && typeof e.conversionCheck === 'string' && e.conversionCheck.length > 0, `${name} carries a conversionCheck note`);
  ok(e.gateCheckRequired === true, `${name} is gateCheck-flagged`);
  ok(e.features.every((f) => f.kind && f.prompt && f.gateCheck === true), `${name} every feature has a kind, a prompt, and gateCheck`);
  ok(e.features.every((f) => ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].includes(f.kind)), `${name} every feature kind is in the plan taxonomy`);
}
{
  const fr = S4.filter(([cls, name]) => name !== 'Warrior of Waves');
  for (const [cls, name] of fr) {
    const e = ss.getSubclass(cls, name);
    ok(e.origin_setting === 'Forgotten Realms' && e.origin_region === 'Forgotten Realms', `${name} is Forgotten Realms origin, no explanation required`);
    ok(ss.validateSelection({ className: cls, subclassName: name, level: 3, originExplanation: '' }).complete, `${name} at level 3 with no explanation is complete (FR origin)`);
  }
  const waves = ss.getSubclass('monk', 'Warrior of Waves');
  ok(waves.origin_setting === 'Hoard of Heroes' && waves.origin_region === "Deva'lamirusandia", 'Warrior of Waves origin is Hoard of Heroes / Deva\'lamirusandia (source-placed, not FR)');
  ok(!ss.validateSelection({ className: 'monk', subclassName: 'Warrior of Waves', level: 3, originExplanation: '' }).complete, 'Warrior of Waves with blank origin explanation is incomplete (non-FR origin)');
  ok(ss.validateSelection({ className: 'monk', subclassName: 'Warrior of Waves', level: 3, originExplanation: 'A sea-elf Waves monk who sailed from Deva\'lamirusandia to the Sword Coast.' }).complete, 'Warrior of Waves with an origin explanation is complete');
  for (const [cls, name] of S4) {
    ok(!ss.validateSelection({ className: cls, subclassName: name, level: 2 }).complete, `${name} at level 2 is incomplete (selection is 3rd)`);
  }
}

group('4. Features at level');
ok(ss.featuresAtLevel('barbarian', 'Path of the Mountain', 3).length === 2, 'Mountain L3 has Highest Habitat + Become the Mountain');
ok(ss.featuresAtLevel('barbarian', 'Path of the Mountain', 14).length === 5, 'Mountain L14 has all 5 features');
ok(ss.featuresAtLevel('bard', 'College of Mirrors', 3).length === 2, 'Mirrors L3 has Bonus Proficiencies + Mirror Warrior');
ok(ss.featuresAtLevel('bard', 'College of Mirrors', 14).length === 4, 'Mirrors L14 has all 4 features');
ok(ss.featuresAtLevel('cleric', 'Revelry Domain', 3).length === 4, 'Revelry L3 has Domain Spells + Life of the Party + More the Merrier + Spread the Revel');
ok(ss.featuresAtLevel('cleric', 'Revelry Domain', 17).length === 7, 'Revelry L17 has all 7 features');
ok(ss.featuresAtLevel('druid', 'Circle of Sand', 3).length === 2, 'Sand L3 has Sandwalker + Servant of the Desert');
ok(ss.featuresAtLevel('druid', 'Circle of Sand', 14).length === 5, 'Sand L14 has all 5 features');
ok(ss.featuresAtLevel('fighter', 'Monster Hunter', 3).length === 3, "Monster Hunter L3 has Teachings + Quarry + Mysticism");
ok(ss.featuresAtLevel('fighter', 'Monster Hunter', 18).length === 8, 'Monster Hunter L18 has all 8 features (no invented Last Dance)');
ok(ss.featuresAtLevel('monk', 'Warrior of Waves', 3).length === 2, 'Waves L3 has Bonus Proficiencies + Ebb and Flow');
ok(ss.featuresAtLevel('monk', 'Warrior of Waves', 17).length === 5, 'Waves L17 has all 5 features');
ok(ss.featuresAtLevel('paladin', 'Oath of Resolve', 3).length === 2, 'Resolve L3 has Oath Spells + Channel Divinity');
ok(ss.featuresAtLevel('paladin', 'Oath of Resolve', 20).length === 5, 'Resolve L20 has all 5 features');
ok(ss.featuresAtLevel('ranger', 'Stone Singer', 3).length === 3, 'Stone Singer L3 has Magic + Earthen Armament + Stone Step');
ok(ss.featuresAtLevel('ranger', 'Stone Singer', 15).length === 6, 'Stone Singer L15 has all 6 features');
ok(ss.featuresAtLevel('rogue', 'Slider', 3).length === 2, 'Slider L3 has Alter Inertia + Slider Style');
ok(ss.featuresAtLevel('rogue', 'Slider', 17).length === 5, 'Slider L17 has all 5 features');
ok(ss.featuresAtLevel('sorcerer', 'Planar Magic', 3).length === 1, 'Planar Magic L3 has Out of Phase only');
ok(ss.featuresAtLevel('sorcerer', 'Planar Magic', 18).length === 4, 'Planar Magic L18 has all 4 features');
ok(ss.featuresAtLevel('warlock', 'The Ancient Dragon', 3).length === 2, 'Ancient Dragon L3 has Expanded Spells + Might of the Maw');
ok(ss.featuresAtLevel('warlock', 'The Ancient Dragon', 14).length === 5, 'Ancient Dragon L14 has all 5 features');
ok(ss.featuresAtLevel('warlock', 'The Beholder', 3).length === 2, 'Beholder L3 has Expanded Spells + Eye of the Beholder');
ok(ss.featuresAtLevel('warlock', 'The Beholder', 14).length === 5, 'Beholder L14 has all 5 features');
ok(ss.featuresAtLevel('wizard', 'Hedge Mage', 3).length === 2, 'Hedge Mage L3 has Nothing to Waste + Student\'s Eye');
ok(ss.featuresAtLevel('wizard', 'Hedge Mage', 14).length === 5, 'Hedge Mage L14 has all 5 features');

group('5. Pure math helpers');
ok(ss.mountainDizzyingHeightsDc(4, 3) === 15 && ss.mountainDizzyingHeightsDc(2, 2) === 12, 'Dizzying Heights DC is 8 + Proficiency Bonus + Constitution modifier');
ok(ss.mirrorLucentCharges(3) === 4 && ss.mirrorLucentCharges(1) === 2, 'Lucent Purge charges are 1 + spell level');
ok(ss.mirrorLucentMaxCharges(14) === 14 && ss.mirrorLucentMaxCharges(6) === 6, 'Lucent Purge capacity is bard level');
ok(ss.revelryFeatureUses(3) === 3 && ss.revelryFeatureUses(0) === 1 && ss.revelryFeatureUses(-1) === 1, 'Revelry uses are Wisdom modifier, minimum 1');
ok(ss.sandSpiritCarryCapacity(16) === 480 && ss.sandSpiritCarryCapacity(10) === 300, 'Spirit Guide carry capacity is 30 times Strength score');
ok(ss.dustDevilTempHp(14) === 14 && ss.dustDevilTempHp(10) === 10, 'Dust Devil temp HP equals Druid level');
ok(ss.hunterQuarryBonus(10) === 5 && ss.hunterQuarryBonus(7) === 3 && ss.hunterQuarryBonus(3) === 1, 'Quarry bonus is half Fighter level, rounded down');
ok(ss.hunterQuarryUsesPerCreature(10) === 1 && ss.hunterQuarryUsesPerCreature(18) === 2, 'Quarry bonus usable once per creature, twice at 18th');
ok(ss.wavesMaelstromIncrements(3).radiusIncreaseFeet === 30 && ss.wavesMaelstromIncrements(3).damageDice === 3, 'Maelstrom gains 10 feet of radius and 1d6 per ki spent');
ok(ss.wavesMaelstromIncrements(8).damageDice === 8 && ss.wavesMaelstromIncrements(9).damageDice === 8, 'Maelstrom ki is capped at 8');
ok(ss.stoneDiamondDefenseTempHp(15, 3) === 10 && ss.stoneDiamondDefenseTempHp(10, 2) === 7, 'Diamond Defense temp HP is half Ranger level + Constitution modifier');
ok(ss.sliderMarkDc(4, 3) === 15 && ss.sliderMarkDc(6, 5) === 19, 'Mark of the Slider DC is 8 + Proficiency Bonus + Dexterity modifier');
ok(ss.planarDisplacementTargetCount(4) === 8 && ss.planarDisplacementTargetCount(3) === 6 && ss.planarDisplacementTargetCount(0) === 0, 'Displacement targets are twice Charisma modifier');
ok(typeof ss.mountainDizzyingHeightsDc === 'function' && typeof ss.planarDisplacementTargetCount === 'function', 'All 12 S4 helpers are named exports');
ok(ss.default && ss.default.mountainDizzyingHeightsDc && ss.default.planarDisplacementTargetCount, 'S4 helpers are in the default export');

group('6. Spell access vs catalog (no gaps in S4; catalog is 583)');
{
  const inCatalog = (name) => Object.prototype.hasOwnProperty.call(SPELL_DATA_ENTRIES, String(name).toLowerCase());
  ok(Object.keys(SPELL_DATA_ENTRIES).length === 583, 'Live catalog has 583 entries (544 + 38 overnight-build spells + Summon Dragon, sorcerer reconciliation 2026-11-06)');
  const revelry = ss.clericDomainSpellsAtLevel('cleric', 'Revelry Domain', 9);
  ok(revelry.length === 10 && revelry.every(inCatalog), 'Revelry 10/10 domain spells in catalog');
  const resolve = ss.paladinOathSpellsAtLevel('paladin', 'Oath of Resolve', 17);
  ok(resolve.length === 10 && resolve.every(inCatalog), 'Resolve 10/10 oath spells in catalog');
  const stone = ss.rangerSubclassSpellsAtLevel('ranger', 'Stone Singer', 17);
  ok(stone.length === 5 && stone.every(inCatalog), 'Stone Singer 5/5 spells in catalog');
  const dragon = ss.warlockPatronSpellsAtLevel('warlock', 'The Ancient Dragon', 9);
  ok(dragon.length === 10 && dragon.every(inCatalog), 'Ancient Dragon 10/10 patron spells in catalog');
  const beholder = ss.warlockPatronSpellsAtLevel('warlock', 'The Beholder', 9);
  ok(beholder.length === 10 && beholder.every(inCatalog), 'Beholder 10/10 patron spells in catalog');
  ok(inCatalog('Detect Magic') && inCatalog('Protection from Evil and Good'), 'Monster Hunter ritual + rest spell in catalog');
  ok(inCatalog('Wall of Sand'), 'Sand Call the Dune spell Wall of Sand in catalog');
  ok(inCatalog('Prestidigitation'), 'Revelry Life of the Party cantrip Prestidigitation in catalog');
  ok(ss.getSubclass('bard', 'College of Mirrors').features.every((f) => f.kind !== 'D'), 'Mirrors grants no spell list feature');
  ok(ss.getSubclass('sorcerer', 'Planar Magic').features.every((f) => f.kind !== 'D'), 'Planar Magic grants no spell list feature');
  ok(ss.getSubclass('wizard', 'Hedge Mage').features.every((f) => f.kind !== 'D'), 'Hedge Mage grants no spell list feature');
  ok(!ss.getSubclass('fighter', 'Monster Hunter').features.some((f) => f.key === 'last_dance'), 'No Last Dance feature invented for Monster Hunter (extract has no body text for it)');
}

group('7. Choice validation (migration 103, no silent defaults)');
ok(ss.validateChoice('barbarian', 'Path of the Mountain', 'pilgrimage_mountain', 'Nan Yegra').valid, 'Nan Yegra is a valid pilgrimage mountain');
ok(!ss.validateChoice('barbarian', 'Path of the Mountain', 'pilgrimage_mountain', 'Mount Doom').valid, 'Mount Doom is not a pilgrimage mountain');
ok(ss.validateChoice('cleric', 'Revelry Domain', 'revel_trait', 'Those charmed by you grin widely').valid, 'Grin widely is a valid revel trait');
ok(ss.validateChoice('druid', 'Circle of Sand', 'spirit_form', 'Scorpion').valid, 'Scorpion is a valid spirit form');
ok(ss.validateChoiceList('fighter', 'Monster Hunter', 'hunter_teachings_skills', ['Arcana', 'Nature']).valid, 'Arcana + Nature are valid Hunter teachings');
ok(!ss.validateChoiceList('fighter', 'Monster Hunter', 'hunter_teachings_skills', ['Arcana', 'Nature', 'History']).valid, '3 Hunter teachings exceeds maxCount 2');
ok(!ss.validateChoiceList('fighter', 'Monster Hunter', 'hunter_teachings_skills', ['Arcana', 'Arcana']).valid, 'Duplicate Hunter teaching is invalid');
ok(ss.validateChoice('fighter', 'Monster Hunter', 'quarry_type', 'dragons').valid, 'Dragons is a valid quarry type');
ok(!ss.validateChoice('fighter', 'Monster Hunter', 'quarry_type', 'humanoids').valid, 'Humanoids is not a quarry type');
ok(ss.validateChoice('fighter', 'Monster Hunter', 'hunter_exotic_language', 'Draconic').valid, 'Draconic is a valid exotic language');
ok(ss.validateChoice('sorcerer', 'Planar Magic', 'planar_affinity', 'Shadowfell').valid, 'Shadowfell is a valid planar affinity');
ok(ss.validateChoice('warlock', 'The Ancient Dragon', 'dragon_patron_type', 'Gold').valid, 'Gold is a valid dragon patron type');
ok(!ss.validateChoice('warlock', 'The Ancient Dragon', 'dragon_patron_type', 'Purple').valid, 'Purple is not a dragon patron type');

group('8. Prompt-contains (origins, entity honesty, PC reported-total rule)');
{
  const mountain = ss.buildSubclassPromptSection({ class: 'Barbarian', subclass: 'Path of the Mountain', level: 14 }, []);
  ok(mountain.includes('Path of the Mountain') && mountain.includes('Tallest Peak') && mountain.includes('Forgotten Realms'), 'Prompt names Mountain, Tallest Peak, and its FR origin');
  const sand = ss.buildSubclassPromptSection({ class: 'Druid', subclass: 'Circle of Sand', level: 3 }, []);
  ok(sand.includes('Servant of the Desert') && sand.includes('no entity row'), 'Prompt names the Sand spirit and its no-entity-row honesty note');
  const waves = ss.buildSubclassPromptSection({ class: 'Monk', subclass: 'Warrior of Waves', level: 6 }, []);
  ok(waves.includes('Warrior of Waves') && waves.includes("Deva'lamirusandia") && waves.includes('origin explanation required'), 'Prompt names Waves, its Deva\'lamirusandia origin, and the explanation requirement');
  ok(!waves.includes('Way of Waves'), 'Prompt uses the 2024 name Warrior of Waves, not the 2014 Way name');
  const beholder = ss.buildSubclassPromptSection({ class: 'Warlock', subclass: 'The Beholder', level: 14 }, []);
  ok(beholder.includes('Extraneous Ego') && beholder.includes('DM-tracked'), 'Prompt names Extraneous Ego and its DM-tracked honesty note');
  ok(mountain.includes('Never silently add'), 'Prompt section carries the PC reported-total rule');
  const unknown = ss.buildSubclassPromptSection({ class: 'Bard', subclass: 'Unknown Subclass', level: 5 }, []);
  ok(unknown.includes('not yet in the subclass registry') && !unknown.includes('Mirror Warrior'), 'Unknown subclass renders a not-yet line, no invented features');
}

group('9. Unknown-subclass null asserts');
ok(ss.getSubclass('barbarian', 'Path of the Mountain 2') === null, 'Near-miss barbarian name returns null');
ok(ss.featuresAtLevel('wizard', 'Hedge Mage 2', 9).length === 0, 'Features for an unknown subclass are empty, never invented');
ok(!ss.validateSelection({ className: 'warlock', subclassName: 'The Beholder 2', level: 3 }).found, 'Unknown subclass selection reports not found');
ok(ss.getSubclass('druid', 'Circle of Sand').features.some((f) => f.key === 'servant_of_the_desert'), 'Sand entry includes Servant of the Desert (entity honesty: DM-tracked spirit, no row invented)');
ok(ss.getSubclass('warlock', 'The Ancient Dragon').features.some((f) => f.key === 'hidden_hoard'), 'Ancient Dragon entry includes Hidden Hoard (entity honesty: DM-tracked lair, no row invented)');

group('10. DB integration: stored choice + companion prompt + origin');
{
  const pc = await addPc({
    class: 'Fighter', level: 10, subclass: 'Monster Hunter',
    subclass_choices_json: JSON.stringify({ quarry_type: 'dragons', hunter_teachings_skills: ['Arcana', 'Nature'] }),
  });
  ok(pc.subclass === 'Monster Hunter', 'PC row carries the S4 subclass');
  const parsed = ss.parseSubclassChoices(pc.subclass_choices_json);
  ok(ss.validateChoice('fighter', 'Monster Hunter', 'quarry_type', parsed.quarry_type).valid, 'PC stored quarry type validates from the DB row');
  ok(ss.validateChoiceList('fighter', 'Monster Hunter', 'hunter_teachings_skills', parsed.hunter_teachings_skills).valid, 'PC stored teachings validate from the DB row');
  const comp = await addCompanion('Ally', pc.id, {
    companion_class: 'Monk', companion_subclass: 'Warrior of Waves', companion_level: 6,
  });
  const section = ss.buildSubclassPromptSection(pc, [comp]);
  ok(section.includes('Monster Hunter') && section.includes('Warrior of Waves'), 'Prompt section covers PC + class-progression companion S4 subclasses');
  const npcStats = await addCompanion('Mook', pc.id, {
    companion_class: 'Wizard', companion_subclass: 'Hedge Mage', companion_level: 6, progression_type: 'npc_stats',
  });
  const section2 = ss.buildSubclassPromptSection(pc, [npcStats]);
  ok(!section2.includes('Hedge Mage'), 'npc_stats companions are skipped by the prompt section, as before');
}

console.log(`\nsubclass-scanned4: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
