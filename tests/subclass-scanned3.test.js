// tests/subclass-scanned3.test.js — Scanned Batch S3 (outside-FR
// scanned batch): Wildemount 3 (Echo Knight, Chronurgy Magic,
// Graviturgy Magic), Ravnica 2 (Order Domain, Circle of Spores),
// Theros 1 (College of Eloquence) = 6 new, registry 75 -> 81.
// Oath of Glory from the Theros extract is already PHB and is NOT
// rebuilt here; it is asserted as still present from PHB, once.
// Real services, real DB, same pattern as earlier subclass tests.
//
// OUTSIDE-FR RULING (Zach, plan section 12): this material is kept
// labeled as it is, concepts intact, NOT reskinned (dunamis, Kryn
// Dynasty, Ravnica guilds, Theros all stay as themselves). Every S3
// entry carries origin_setting/origin_region outside the Forgotten
// Realms, and validateSelection must treat a blank origin
// explanation for these as incomplete — asserted in group 7.
//
// CONVERSION NOTE: Wildemount is 2020-era, Ravnica/Theros are
// 2019/2020-era. No 2024 reprint exists for any S3 subclass, so
// every S3 number is conversionCheck + gateCheck: Wildemount
// wizard grants 2/6/10/14 -> 3/6/10/14; Ravnica cleric grants
// 1/2/6/8/17 -> 3/6/17 and druid grants 2/6/10/14 -> 3/6/10/14;
// Theros bard grants 3/6/14 coincide with the 2024 Bard cadence.
// Echo Knight grants 3/7/10/15/18 coincide with the 2024 Fighter
// cadence. See each entry's conversionCheck for its own mapping.
// Nothing here was authored from the mislabeled 2014 PHB Pt1/Pt2
// scans. Mechanics are paraphrased in the app's own wording.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-subclass-scanned3-'));
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
    name: 'Tester', class: 'Cleric', level: 6,
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

const S3 = [
  ['fighter', 'Echo Knight'],
  ['wizard', 'Chronurgy Magic'],
  ['wizard', 'Graviturgy Magic'],
  ['cleric', 'Order Domain'],
  ['druid', 'Circle of Spores'],
  ['bard', 'College of Eloquence'],
];

group('1. Registry counts/lookup');
ok(ss.listSubclasses('fighter').length === 11, 'Fighter file exports exactly 11 (9 prior + Banneret) + 1 Additional');
ok(ss.listSubclasses('wizard').length === 10, 'Wizard file exports exactly 10 (8 prior + Bladesinger) + 1 Additional');
ok(ss.listSubclasses('cleric').length === 11, 'Cleric file exports exactly 11 (8 prior + Knowledge Domain) + 2 Additional');
ok(ss.listSubclasses('druid').length === 9, 'Druid file exports exactly 9 (7 prior + Circle of Sand) + 1 Additional');
ok(ss.listSubclasses('bard').length === 11, 'Bard file exports exactly 11 (8 prior + College of the Moon) + 2 Additional');
for (const [cls, name] of S3) {
  ok(ss.getSubclass(cls, name)?.name === name, `${name} found by class + name`);
}
ok(ss.listSubclasses('fighter').filter((s) => s.key === 'echo_knight').length === 1, 'Echo Knight appears exactly once');
ok(ss.getSubclass('paladin', 'Oath of Glory')?.source === 'PHB 2024', 'Oath of Glory remains the PHB 2024 entry, not a Theros duplicate');

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
for (const [cls, name] of S3) {
  const e = ss.getSubclass(cls, name);
  ok(e.selectionLevel === 3, `${name} selects at 3rd (2024 cadence, not the 2019/2020 1st/2nd)`);
  ok(e.origin_setting !== 'Forgotten Realms', `${name} is outside-FR origin (${e.origin_setting})`);
  ok(e.sourceTier === 'scanned' && typeof e.conversionCheck === 'string' && e.conversionCheck.length > 0, `${name} carries a conversionCheck note`);
  ok(e.gateCheckRequired === true, `${name} is gateCheck-flagged`);
  ok(e.features.every((f) => f.kind && f.prompt && f.gateCheck === true), `${name} every feature has a kind, a prompt, and gateCheck`);
}
ok(ss.getSubclass('fighter', 'Echo Knight').origin_setting === 'Exandria', 'Echo Knight origin_setting is Exandria');
ok(ss.getSubclass('cleric', 'Order Domain').origin_setting === 'Ravnica', 'Order Domain origin_setting is Ravnica');
ok(ss.getSubclass('bard', 'College of Eloquence').origin_setting === 'Theros', 'College of Eloquence origin_setting is Theros');

group('4. Features at level');
ok(ss.featuresAtLevel('fighter', 'Echo Knight', 3).length === 2, 'Echo Knight L3 has Manifest Echo + Unleash Incarnation');
ok(ss.featuresAtLevel('fighter', 'Echo Knight', 18).length === 6, 'Echo Knight L18 has all 6 features');
ok(ss.featuresAtLevel('wizard', 'Chronurgy Magic', 3).length === 2, 'Chronurgy L3 has Chronal Shift + Temporal Awareness');
ok(ss.featuresAtLevel('wizard', 'Chronurgy Magic', 14).length === 5, 'Chronurgy L14 has all 5 features');
ok(ss.featuresAtLevel('wizard', 'Graviturgy Magic', 3).length === 1, 'Graviturgy L3 has Adjust Density only');
ok(ss.featuresAtLevel('wizard', 'Graviturgy Magic', 14).length === 4, 'Graviturgy L14 has all 4 features');
ok(ss.featuresAtLevel('cleric', 'Order Domain', 3).length === 4, 'Order L3 has Domain Spells + Bonus Proficiencies + Voice of Authority + Order Demand');
ok(ss.featuresAtLevel('cleric', 'Order Domain', 17).length === 7, 'Order L17 has all 7 features');
ok(ss.featuresAtLevel('druid', 'Circle of Spores', 3).length === 3, 'Spores L3 has Circle Spells + Halo of Spores + Symbiotic Entity');
ok(ss.featuresAtLevel('druid', 'Circle of Spores', 14).length === 6, 'Spores L14 has all 6 features');
ok(ss.featuresAtLevel('bard', 'College of Eloquence', 3).length === 2, 'Eloquence L3 has Silver Tongue + Unsettling Words');
ok(ss.featuresAtLevel('bard', 'College of Eloquence', 14).length === 5, 'Eloquence L14 has all 5 features');

group('5. Pure math helpers');
ok(ss.echoKnightAc(3) === 17 && ss.echoKnightAc(5) === 19, 'Echo AC is 14 + Proficiency Bonus');
ok(ss.echoUses(3) === 3 && ss.echoUses(0) === 1 && ss.echoUses(-1) === 1, 'Echo uses are Con modifier, minimum 1');
ok(ss.chronalShiftUses() === 2, 'Chronal Shift has 2 uses');
ok(ss.momentaryStasisUses(4) === 4 && ss.momentaryStasisUses(0) === 1, 'Momentary Stasis uses are Int modifier, minimum 1');
ok(ss.violentAttractionUses(2) === 2 && ss.violentAttractionUses(0) === 1, 'Violent Attraction uses are Int modifier, minimum 1');
ok(ss.haloOfSporesDie(3) === 4 && ss.haloOfSporesDie(6) === 6 && ss.haloOfSporesDie(10) === 8 && ss.haloOfSporesDie(14) === 10, 'Halo of Spores die scales 1d4/1d6/1d8/1d10');
ok(ss.symbioticEntityTempHp(6) === 24 && ss.symbioticEntityTempHp(3) === 12, 'Symbiotic Entity temp HP is 4 per druid level');
ok(ss.orderDivineStrikeDice(6).count === 1 && ss.orderDivineStrikeDice(17).count === 2 && ss.orderDivineStrikeDice(17).die === 8, 'Order Divine Strike is 1d8, 2d8 at 17th');
ok(ss.eloquenceFloor(9) === 10 && ss.eloquenceFloor(3) === 10 && ss.eloquenceFloor(15) === 15, 'Silver Tongue treats 9 or lower as 10');

group('6. Spell access vs catalog (no gaps in S3)');
{
  const inCatalog = (name) => Object.prototype.hasOwnProperty.call(SPELL_DATA_ENTRIES, String(name).toLowerCase());
  const order = ss.clericDomainSpellsAtLevel('cleric', 'Order Domain', 9);
  ok(order.length === 10 && order.every(inCatalog), 'Order Domain 10/10 spells in catalog');
  const spores = ss.druidCircleSpellsAtLevel('druid', 'Circle of Spores', 9);
  ok(spores.length === 8 && spores.every(inCatalog), 'Spores 8/8 tier spells in catalog');
  ok(inCatalog('Chill Touch'), 'Spores cantrip Chill Touch in catalog');
  const dunamancy = ['Sapping Sting', 'Temporal Shunt', 'Gift of Alacrity', 'Magnify Gravity', 'Pulse Wave', 'Dark Star', 'Reality Break', 'Time Ravage', 'Ravenous Void'];
  ok(dunamancy.every(inCatalog), 'Dunamancy spell shelf is in the catalog (Chronurgy/Graviturgy grant no list of their own)');
  ok(ss.getSubclass('wizard', 'Chronurgy Magic').features.every((f) => f.kind !== 'D'), 'Chronurgy grants no spell list feature');
  ok(ss.getSubclass('wizard', 'Graviturgy Magic').features.every((f) => f.kind !== 'D'), 'Graviturgy grants no spell list feature');
}

group('7. Choice + origin-explanation validation');
ok(ss.validateChoice('cleric', 'Order Domain', 'order_bonus_skill', 'Persuasion').valid, 'Persuasion is a valid Order bonus skill');
ok(ss.validateChoice('cleric', 'Order Domain', 'order_bonus_skill', 'persuasion').valid, 'Order bonus skill validation is normalized');
ok(!ss.validateChoice('cleric', 'Order Domain', 'order_bonus_skill', 'Stealth').valid, 'Stealth is not an Order bonus skill');
for (const [cls, name] of S3) {
  ok(!ss.validateSelection({ className: cls, subclassName: name, level: 3, originExplanation: '' }).complete, `${name} with blank origin explanation is incomplete (outside-FR)`);
  ok(ss.validateSelection({ className: cls, subclassName: name, level: 3, originExplanation: 'Arrived in the Forgotten Realms by a portal mishap.' }).complete, `${name} with an origin explanation is complete`);
  ok(!ss.validateSelection({ className: cls, subclassName: name, level: 2, originExplanation: 'Arrived in the Forgotten Realms by a portal mishap.' }).complete, `${name} at level 2 is incomplete (selection is 3rd)`);
}
ok(ss.validateSelection({ className: 'fighter', subclassName: 'Champion', level: 3, originExplanation: '' }).complete, 'Forgotten Realms subclass still needs no origin explanation');

group('8. Prompt-contains (origin labels, no reskin, no invented features)');
{
  const pc = { class: 'Fighter', subclass: 'Echo Knight', level: 7 };
  const section = ss.buildSubclassPromptSection(pc, []);
  ok(section.includes('Echo Knight') && section.includes('Manifest Echo') && section.includes('Exandria'), 'Prompt section names Echo Knight, Manifest Echo, and its Exandria origin');
  ok(section.includes('dunamis') || section.includes('Dunamis'), 'Prompt keeps dunamis as dunamis, not reskinned');
  ok(section.includes('Never silently add'), 'Prompt section carries the PC reported-total rule');
  const orderSection = ss.buildSubclassPromptSection({ class: 'Cleric', subclass: 'Order Domain', level: 6 }, []);
  ok(orderSection.includes('Order Domain') && orderSection.includes('Ravnica'), 'Prompt section names Order Domain and its Ravnica origin');
  const unknown = ss.buildSubclassPromptSection({ class: 'Bard', subclass: 'Unknown Subclass', level: 5 }, []);
  ok(unknown.includes('not yet in the subclass registry') && !unknown.includes('Silver Tongue'), 'Unknown subclass renders a not-yet line, no invented features');
}

group('9. Unknown-subclass null asserts');
ok(ss.getSubclass('fighter', 'Echo Knight 2') === null, 'Near-miss fighter name returns null');
ok(ss.featuresAtLevel('wizard', 'Chronurgy Magic 2', 9).length === 0, 'Features for an unknown subclass are empty, never invented');
ok(!ss.validateSelection({ className: 'cleric', subclassName: 'Order Domain 2', level: 3 }).found, 'Unknown subclass selection reports not found');
ok(ss.getSubclass('druid', 'Circle of Spores').features.some((f) => f.key === 'fungal_infestation'), 'Spores entry includes Fungal Infestation (entity honesty: DM-tracked zombie, no row invented)');

group('10. DB integration: stored choice + companion prompt + origin');
{
  const pc = await addPc({
    class: 'Cleric', level: 6, subclass: 'Order Domain',
    subclass_choices_json: JSON.stringify({ order_bonus_skill: 'Intimidation' }),
  });
  ok(pc.subclass === 'Order Domain', 'PC row carries the S3 subclass');
  const parsed = ss.parseSubclassChoices(pc.subclass_choices_json);
  ok(ss.validateChoice('cleric', 'Order Domain', 'order_bonus_skill', parsed.order_bonus_skill).valid, 'PC stored Order bonus skill validates from the DB row');
  const comp = await addCompanion('Ally', pc.id, {
    companion_class: 'Wizard', companion_subclass: 'Chronurgy Magic', companion_level: 6,
  });
  const section = ss.buildSubclassPromptSection(pc, [comp]);
  ok(section.includes('Order Domain') && section.includes('Chronurgy Magic'), 'Prompt section covers PC + class-progression companion S3 subclasses');
  const npcStats = await addCompanion('Mook', pc.id, {
    companion_class: 'Bard', companion_subclass: 'College of Eloquence', companion_level: 6, progression_type: 'npc_stats',
  });
  const section2 = ss.buildSubclassPromptSection(pc, [npcStats]);
  ok(!section2.includes('College of Eloquence'), 'npc_stats companions are skipped by the prompt section, as before');
}

console.log(`\nsubclass-scanned3: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
