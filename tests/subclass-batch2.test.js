// tests/subclass-batch2.test.js — Batch 2 (PHB 2024 spell-list
// classes): Cleric 3 remaining, Wizard 4, Warlock 4. Life Domain
// is Tier 0 and is NOT re-asserted here except for its count in
// the Cleric file (4 total) and its unchanged helper. Real
// services, real DB, same pattern as subclass-tier0/batch1 tests.
// An unbuilt subclass must return null, never invented features.
// Patron spells are ADDED TO THE LIST; domain spells are ALWAYS
// PREPARED — the two are asserted apart, never conflated.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-subclass-batch2-'));
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
    name: 'Tester', class: 'Cleric', level: 9,
    current_hp: 80, max_hp: 80, armor_class: 18,
    ability_scores: JSON.stringify({ str: 14, dex: 12, con: 16, int: 10, wis: 18, cha: 8 }),
    skills: JSON.stringify([]),
    spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }),
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
    companion_ability_scores: JSON.stringify({ str: 10, dex: 14, con: 14, int: 18, wis: 12, cha: 10 }),
    companion_current_hp: 40, companion_max_hp: 40, armor_class: 15,
    ...over
  });
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [id]);
  return { ...row, display_name: name };
}

group('1. Registry counts and lookup');
ok(ss.listSubclasses('cleric').length === 11, 'Cleric file exports exactly 11 (4 PHB + 2 S1 + 1 S3 + 1 S4 + 1 S5) + 2 Additional');
ok(ss.listSubclasses('wizard').length === 10, 'Wizard file exports exactly 10 (4 PHB + 1 S2 + 2 S3 + 1 S4 + 1 S5) + 1 Additional');
ok(ss.listSubclasses('warlock').length === 9, 'Warlock file exports exactly 9 (4 PHB + 1 S2 + 2 S4) + 2 Additional');
ok(ss.getSubclass('cleric', 'Life Domain')?.key === 'life_domain', 'Life Domain still in the Cleric file, unchanged by Batch 2');
ok(ss.getSubclass('cleric', 'Light Domain')?.key === 'light_domain', 'Light Domain found');
ok(ss.getSubclass('cleric', 'Trickery Domain')?.key === 'trickery_domain', 'Trickery Domain found');
ok(ss.getSubclass('cleric', 'War Domain')?.key === 'war_domain', 'War Domain found');
ok(ss.getSubclass('wizard', 'Abjurer')?.key === 'abjurer', 'Abjurer found');
ok(ss.getSubclass('wizard', 'Diviner')?.key === 'diviner', 'Diviner found');
ok(ss.getSubclass('wizard', 'Evoker')?.key === 'evoker', 'Evoker found');
ok(ss.getSubclass('wizard', 'Illusionist')?.key === 'illusionist', 'Illusionist found');
ok(ss.getSubclass('warlock', 'Archfey Patron')?.key === 'archfey_patron', 'Archfey Patron found');
ok(ss.getSubclass('warlock', 'Celestial Patron')?.key === 'celestial_patron', 'Celestial Patron found (PHB 2024, counted once — not double-counted from Xanathar)');
ok(ss.getSubclass('warlock', 'Fiend Patron')?.key === 'fiend_patron', 'Fiend Patron found');
ok(ss.getSubclass('warlock', 'Great Old One Patron')?.key === 'great_old_one_patron', 'Great Old One Patron found');
ok(ss.getSubclass('cleric', 'Unknown Subclass') === null, 'Unknown Subclass is not in Batch 2 (never invented)');
ok(ss.getSubclass('wizard', 'Unknown Subclass') === null, 'Unknown Subclass is not in Batch 2 (never invented)');

group('2. Selection levels and origins');
for (const [cls, name] of [
  ['cleric', 'Light Domain'], ['cleric', 'Trickery Domain'], ['cleric', 'War Domain'],
  ['wizard', 'Abjurer'], ['wizard', 'Diviner'], ['wizard', 'Evoker'], ['wizard', 'Illusionist'],
  ['warlock', 'Archfey Patron'], ['warlock', 'Celestial Patron'], ['warlock', 'Fiend Patron'], ['warlock', 'Great Old One Patron'],
]) {
  const e = ss.getSubclass(cls, name);
  ok(e?.selectionLevel === 3, `${name} selection level is 3`);
  ok(e?.origin_setting === 'Forgotten Realms', `${name} origin is Forgotten Realms`);
  ok(e?.gateCheckRequired === true, `${name} is flagged gateCheck`);
  ok((e?.features || []).every((f) => f.gateCheck === true), `${name} every feature is flagged gateCheck`);
}

group('3. Features at level');
ok(ss.featuresAtLevel('cleric', 'Light Domain', 3).length === 3, 'Light L3 has Domain Spells + Warding Flare + Radiance of the Dawn');
ok(ss.featuresAtLevel('cleric', 'Light Domain', 17).length === 5, 'Light L17 has all 5 features');
ok(ss.featuresAtLevel('cleric', 'Trickery Domain', 3).length === 3, 'Trickery L3 has Domain Spells + Blessing + Invoke Duplicity');
ok(ss.featuresAtLevel('cleric', 'Trickery Domain', 17).length === 5, 'Trickery L17 has all 5 features');
ok(ss.featuresAtLevel('cleric', 'War Domain', 17).length === 5, 'War L17 has all 5 features');
ok(ss.featuresAtLevel('wizard', 'Abjurer', 3).length === 2, 'Abjurer L3 has Savant + Arcane Ward');
ok(ss.featuresAtLevel('wizard', 'Abjurer', 14).length === 5, 'Abjurer L14 has all 5 features');
ok(ss.featuresAtLevel('wizard', 'Diviner', 14).length === 5, 'Diviner L14 has all 5 features');
ok(ss.featuresAtLevel('wizard', 'Evoker', 14).length === 5, 'Evoker L14 has all 5 features');
ok(ss.featuresAtLevel('wizard', 'Illusionist', 14).length === 5, 'Illusionist L14 has all 5 features');
ok(ss.featuresAtLevel('warlock', 'Archfey Patron', 3).length === 2, 'Archfey L3 has Patron Spells + Steps of the Fey');
ok(ss.featuresAtLevel('warlock', 'Archfey Patron', 14).length === 5, 'Archfey L14 has all 5 features');
ok(ss.featuresAtLevel('warlock', 'Celestial Patron', 14).length === 5, 'Celestial L14 has all 5 features');
ok(ss.featuresAtLevel('warlock', 'Fiend Patron', 14).length === 5, 'Fiend L14 has all 5 features');
ok(ss.featuresAtLevel('warlock', 'Great Old One Patron', 14).length === 7, 'Great Old One L14 has all 7 features');

group('3b. Wizard PHB-photo corrections (2026-11-06)');
{
  // Evoker: Potent Cantrip / Sculpt Spells levels were SWAPPED in the registry.
  // PHB (p. 165 table + school list): Potent Cantrip at 3rd, Sculpt Spells at 6th.
  // NOTE: featuresAtLevel is cumulative (level <= given), so exact-level
  // checks filter the raw feature list instead.
  const evokerAt = (lvl) => ss.getSubclass('wizard', 'Evoker').features.filter((f) => f.level === lvl).map((f) => f.name);
  ok(evokerAt(3).includes('Potent Cantrip'), 'Evoker L3 has Potent Cantrip (PHB photo)');
  ok(!evokerAt(3).includes('Sculpt Spells'), 'Evoker L3 does NOT have Sculpt Spells (PHB photo)');
  ok(evokerAt(6).includes('Sculpt Spells'), 'Evoker L6 has Sculpt Spells (PHB photo)');
  ok(!evokerAt(6).includes('Potent Cantrip'), 'Evoker L6 does NOT have Potent Cantrip (PHB photo)');
  // Illusionist: 'Improved Minor Illusion' is the 2014 name; 2024 is 'Improved Illusions'.
  const illuL3 = ss.getSubclass('wizard', 'Illusionist').features.filter((f) => f.level === 3).map((f) => f.name);
  ok(illuL3.includes('Improved Illusions'), 'Illusionist L3 has Improved Illusions (PHB photo)');
  ok(!illuL3.includes('Improved Minor Illusion'), 'Illusionist L3 does NOT have Improved Minor Illusion (2014 name gone)');
  ok(ss.getSubclass('wizard', 'Illusionist').features.some((f) => f.key === 'improved_illusions'),
    'Illusionist feature key is improved_illusions (renamed with the 2024 name)');
  // Savant x4: the 2014 copying-discount rule is gone; the 2024 shared rule is
  // two school spells of 2nd level or lower free at 3rd, +1 free school spell
  // per new slot level. One shared mechanic, school-substituted per entry.
  for (const [school, key] of [['Abjurer', 'abjuration_savant'], ['Diviner', 'divination_savant'], ['Evoker', 'evocation_savant'], ['Illusionist', 'illusion_savant']]) {
    const savant = ss.getSubclass('wizard', school).features.find((f) => f.key === key);
    ok(savant?.prompt.includes('for free') && !savant?.prompt.includes('halved') && savant?.mechanics?.effect.includes('2nd level or lower'),
      `${school} Savant carries the 2024 free-spells rule, not the 2014 copying discount (PHB photo)`);
  }
  // PHB-school cadence is 3/3/6/10/14 for all four schools.
  for (const school of ['Abjurer', 'Diviner', 'Evoker', 'Illusionist']) {
    const levels = ss.getSubclass('wizard', school).features.map((f) => f.level);
    ok(JSON.stringify(levels) === JSON.stringify([3, 3, 6, 10, 14]),
      `${school} feature levels are [3, 3, 6, 10, 14] (PHB photo, got ${JSON.stringify(levels)})`);
  }
}

group('4. Batch 2 pure math');
ok(ss.arcaneWardHp(3, 3) === 9, 'Arcane Ward L3 Int +3: 2x3 + 3 = 9');
ok(ss.arcaneWardHp(10, 4) === 24, 'Arcane Ward L10 Int +4: 2x10 + 4 = 24');
ok(ss.portentDice(3) === 2, 'Portent L3: 2 dice');
ok(ss.portentDice(14) === 3, 'Greater Portent L14: 3 dice');
ok(ss.wardingFlareUses(3) === 3, 'Warding Flare Wis +3: 3 uses');
ok(ss.wardingFlareUses(0) === 1, 'Warding Flare never drops below 1 use in the helper');
ok(ss.radianceOfTheDawnDamage(6).dice === '2d10' && ss.radianceOfTheDawnDamage(6).flat === 6, 'Radiance of the Dawn L6: 2d10 + 6');
ok(ss.healingLightDice(3) === 4, 'Healing Light L3: 1 + 3 = 4d6 pool');
ok(ss.darkOnesBlessingTempHp(5, 3) === 8, "Dark One's Blessing L5 Cha +3: 5 + 3 = 8 temp HP");
ok(ss.celestialResilienceTempHp(10, 4) === 14, 'Celestial Resilience L10 Cha +4: 10 + 4 = 14 temp HP');

group('5. Domain spells (always prepared) vs patron spells (added to list)');
ok(ss.clericDomainSpellsAtLevel('cleric', 'Light Domain', 3).join(',') === 'Burning Hands,Faerie Fire,Scorching Ray,See Invisibility', 'Light L3 always-prepared spells (2024 PHB)');
ok(ss.clericDomainSpellsAtLevel('cleric', 'Light Domain', 9).length === 10, 'Light L9 always-prepared list is all 10 spells (2024 PHB)');
ok(ss.clericDomainSpellsAtLevel('cleric', 'Trickery Domain', 5).includes('Hypnotic Pattern'), 'Trickery L5 adds Hypnotic Pattern (2024 PHB)');
ok(ss.clericDomainSpellsAtLevel('cleric', 'War Domain', 9).includes('Hold Monster'), 'War L9 adds Hold Monster (2024 PHB)');
ok(ss.lifeDomainSpellsAtLevel(3).join(',') === 'Aid,Bless,Cure Wounds,Lesser Restoration', 'Life Domain helper unchanged by Batch 2');
ok(ss.warlockPatronSpellsAtLevel('warlock', 'Archfey Patron', 3).join(',') === 'Calm Emotions,Faerie Fire,Misty Step,Phantasmal Force,Sleep', 'Archfey L3 added-to-list spells');
ok(ss.warlockPatronSpellsAtLevel('warlock', 'Archfey Patron', 9).length === 11, 'Archfey L9 added-to-list list is all 11 spells');
ok(ss.warlockPatronSpellsAtLevel('warlock', 'Celestial Patron', 5).includes('Revivify'), 'Celestial L5 adds Revivify');
ok(ss.warlockPatronSpellsAtLevel('warlock', 'Fiend Patron', 7).includes('Wall of Fire'), 'Fiend L7 adds Wall of Fire');
ok(ss.warlockPatronSpellsAtLevel('warlock', 'Great Old One Patron', 3).includes('Detect Thoughts'), 'Great Old One L3 adds Detect Thoughts');
{
  const domain = ss.getSubclass('cleric', 'Light Domain').features.find((f) => f.kind === 'D');
  const patron = ss.getSubclass('warlock', 'Archfey Patron').features.find((f) => f.kind === 'D');
  ok(domain.mechanics.access === 'always prepared', 'domain spells are always prepared');
  ok(patron.mechanics.access === 'added to list', 'patron spells are added to the list, not always prepared');
}

group('6. Spell access checked against the catalog (kind D)');
{
  const inCatalog = (name) => Object.prototype.hasOwnProperty.call(SPELL_DATA_ENTRIES, String(name).toLowerCase());
  for (const [cls, name] of [
    ['cleric', 'Light Domain'], ['cleric', 'Trickery Domain'], ['cleric', 'War Domain'],
    ['warlock', 'Archfey Patron'], ['warlock', 'Celestial Patron'], ['warlock', 'Fiend Patron'], ['warlock', 'Great Old One Patron'],
  ]) {
    const spells = cls === 'cleric'
      ? ss.clericDomainSpellsAtLevel(cls, name, 9)
      : ss.warlockPatronSpellsAtLevel(cls, name, 9);
    // 2024 PHB: 10 domain spells; patron spells vary by patron —
    // Archfey 11, Celestial 12, Fiend 10, Great Old One 10.
    const PATRON_SPELL_COUNTS = { 'Archfey Patron': 11, 'Celestial Patron': 12, 'Fiend Patron': 10, 'Great Old One Patron': 10 };
    const want = cls === 'cleric' ? 10 : PATRON_SPELL_COUNTS[name];
    ok(spells.length === want && spells.every(inCatalog), `${name} all ${want} spells are in the catalog (no catalog gap)`);
  }
}

group('7. Choice validation (kind G)');
ok(ss.validateChoice('wizard', 'Diviner', 'third_eye_benefit', 'Darkvision').valid, 'Darkvision is a valid Third Eye benefit');
ok(ss.validateChoice('wizard', 'Diviner', 'third_eye_benefit', 'See Invisibility').valid, 'See Invisibility is a valid Third Eye benefit');
ok(!ss.validateChoice('wizard', 'Diviner', 'third_eye_benefit', 'Fireball').valid, 'Fireball is not a Third Eye benefit');
ok(ss.validateChoice('warlock', 'Fiend Patron', 'fiendish_resilience_type', 'Fire').valid, 'Fire is a valid Fiendish Resilience type');
ok(!ss.validateChoice('warlock', 'Fiend Patron', 'fiendish_resilience_type', 'Force').valid, 'Force is not a Fiendish Resilience type (2024 PHB: other than Force)');
ok(!ss.validateChoice('warlock', 'Fiend Patron', 'fiendish_resilience_type', 'Banana').valid, 'Banana is not a damage type');
ok(!ss.validateChoice('cleric', 'Light Domain', 'third_eye_benefit', 'Darkvision').valid, 'Light Domain has no stored choices');
ok(ss.parseSubclassChoices(JSON.stringify({ fiendish_resilience_type: 'Cold' })).fiendish_resilience_type === 'Cold', 'stored Fiendish Resilience choice parses');

group('8. DB round-trip + prompt section + migration 103 column');
const pc = await addPc({ subclass: 'Light Domain' });
const abjurerComp = await addCompanion('Mira', pc.id, { companion_class: 'Wizard', companion_subclass: 'Abjurer', subclass_choices_json: JSON.stringify({ third_eye_benefit: 'Darkvision' }) });
const npcStatsComp = await addCompanion('Brute', pc.id, { companion_class: 'Warlock', companion_subclass: 'Fiend Patron', progression_type: 'npc_stats' });
const pcRow = await dbGet('SELECT * FROM characters WHERE id = ?', [pc.id]);
ok(pcRow.subclass === 'Light Domain', 'PC subclass persists on the character row');
const compRow = await dbGet('SELECT * FROM companions WHERE id = ?', [abjurerComp.id]);
ok(compRow.subclass_choices_json != null, 'subclass_choices_json column exists on companions (migration 103)');
ok(ss.validateChoice('wizard', 'Diviner', 'third_eye_benefit', ss.parseSubclassChoices(compRow.subclass_choices_json).third_eye_benefit).valid, 'stored Third Eye choice validates against the registry');
const section = ss.buildSubclassPromptSection(pcRow, [abjurerComp, npcStatsComp]);
ok(section.includes('Light Domain'), 'prompt section names the PC subclass');
ok(section.includes('Radiance of the Dawn'), 'prompt section lists Radiance of the Dawn');
ok(section.includes('ALWAYS PREPARED'), 'prompt section distinguishes always-prepared domain spells');
ok(section.includes('Arcane Ward'), 'prompt section lists the companion Abjurer feature');
ok(!section.includes('Brute'), 'npc_stats companion is skipped in the subclass section');
ok(section.includes('Never silently add'), 'prompt section carries the PC reported-total rule');

console.log(`\nsubclass-batch2: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
