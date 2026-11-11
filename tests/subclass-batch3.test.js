// tests/subclass-batch3.test.js — Batch 3 (PHB 2024 choice-heavy
// classes): Bard 4, Sorcerer 4 (incl. Wild Magic as the
// trigger-table complexity pilot), Paladin 4. Glamour and Glory
// are counted once, as PHB 2024, not double-counted from scanned
// sources. Real services, real DB, same pattern as earlier
// subclass tests. An unbuilt subclass must return null, never
// invented features. Oath and subclass spells are ALWAYS
// PREPARED; Lore Magical Discoveries is a choice feature with
// no fixed list, so it is asserted as a choice, not a catalog
// feature. Summon Dragon was the one logged catalog gap; it landed in the catalog in the 2026-11-06 sorcerer reconciliation, so this batch has no catalog gap.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-subclass-batch3-'));
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
    ability_scores: JSON.stringify({ str: 10, dex: 14, con: 14, int: 12, wis: 10, cha: 18 }),
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
    companion_ability_scores: JSON.stringify({ str: 16, dex: 12, con: 16, int: 10, wis: 12, cha: 18 }),
    companion_current_hp: 50, companion_max_hp: 50, armor_class: 18,
    ...over
  });
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [id]);
  return { ...row, display_name: name };
}

group('1. Registry counts and lookup');
ok(ss.listSubclasses('bard').length === 11, 'Bard file exports exactly 11 (4 PHB + 2 S1 + 1 S3 + 1 S4 + 1 S5) + 2 Additional');
ok(ss.listSubclasses('sorcerer').length === 10, 'Sorcerer file exports exactly 10 (4 PHB + 3 S2 + 1 S4 + 1 S5) + 1 Additional');
ok(ss.listSubclasses('paladin').length === 9, 'Paladin file exports exactly 9 (4 PHB + 2 S2 + 1 S4 + 1 S5) + 1 Additional');
ok(ss.getSubclass('bard', 'College of Dance')?.key === 'college_of_dance', 'College of Dance found');
ok(ss.getSubclass('bard', 'College of Glamour')?.key === 'college_of_glamour', 'College of Glamour found (PHB 2024, counted once)');
ok(ss.getSubclass('bard', 'College of Lore')?.key === 'college_of_lore', 'College of Lore found');
ok(ss.getSubclass('bard', 'College of Valor')?.key === 'college_of_valor', 'College of Valor found');
ok(ss.getSubclass('sorcerer', 'Aberrant Sorcery')?.key === 'aberrant_sorcery', 'Aberrant Sorcery found');
ok(ss.getSubclass('sorcerer', 'Clockwork Sorcery')?.key === 'clockwork_sorcery', 'Clockwork Sorcery found');
ok(ss.getSubclass('sorcerer', 'Draconic Sorcery')?.key === 'draconic_sorcery', 'Draconic Sorcery found');
ok(ss.getSubclass('sorcerer', 'Wild Magic Sorcery')?.key === 'wild_magic_sorcery', 'Wild Magic Sorcery found');
ok(ss.getSubclass('paladin', 'Oath of Devotion')?.key === 'oath_of_devotion', 'Oath of Devotion found');
ok(ss.getSubclass('paladin', 'Oath of Glory')?.key === 'oath_of_glory', 'Oath of Glory found (PHB 2024, counted once)');
ok(ss.getSubclass('paladin', 'Oath of the Ancients')?.key === 'oath_of_the_ancients', 'Oath of the Ancients found');
ok(ss.getSubclass('paladin', 'Oath of Vengeance')?.key === 'oath_of_vengeance', 'Oath of Vengeance found');
ok(ss.getSubclass('bard', 'Unknown Subclass') === null, 'Unknown Subclass is not in Batch 3 (never invented)');
ok(ss.getSubclass('sorcerer', 'Unknown Subclass') === null, 'Unknown Subclass is not in Batch 3 (never invented)');
ok(ss.getSubclass('paladin', 'Unknown Subclass') === null, 'Unknown Subclass is not in Batch 3 (never invented)');
ok(ss.getSubclass('bard', 'Unknown Subclass') === null, 'Unknown Subclass is not in Batch 3 (never invented)');
ok(ss.getSubclass('sorcerer', 'Unknown Subclass') === null, 'Unknown Subclass is not in Batch 3 (never invented)');

group('2. Selection levels, origins, and cadences');
for (const [cls, name] of [
  ['bard', 'College of Dance'], ['bard', 'College of Glamour'], ['bard', 'College of Lore'], ['bard', 'College of Valor'],
  ['sorcerer', 'Aberrant Sorcery'], ['sorcerer', 'Clockwork Sorcery'], ['sorcerer', 'Draconic Sorcery'], ['sorcerer', 'Wild Magic Sorcery'],
  ['paladin', 'Oath of Devotion'], ['paladin', 'Oath of Glory'], ['paladin', 'Oath of the Ancients'], ['paladin', 'Oath of Vengeance'],
]) {
  const e = ss.getSubclass(cls, name);
  ok(e?.selectionLevel === 3, `${name} selection level is 3`);
  ok(e?.origin_setting === 'Forgotten Realms', `${name} origin is Forgotten Realms`);
  ok(e?.gateCheckRequired === true, `${name} is flagged gateCheck`);
  ok((e?.features || []).every((f) => f.gateCheck === true), `${name} every feature is flagged gateCheck`);
}
// Cadences are per-class, not uniform: Bard 3/6/14, Sorcerer 3/6/14/18, Paladin 3/7/15/20.
ok(ss.featuresAtLevel('bard', 'College of Dance', 6).length === 3, 'Dance L6 has Dazzling Footwork + Inspiring Movement + Tandem Footwork');
ok(ss.featuresAtLevel('bard', 'College of Dance', 14).length === 4, 'Dance L14 has all 4 features (no 10th-level feature)');
ok(ss.featuresAtLevel('bard', 'College of Glamour', 14).length === 4, 'Glamour L14 has all 4 features');
ok(ss.featuresAtLevel('sorcerer', 'Wild Magic Sorcery', 6).length === 3, 'Wild Magic L6 has Surge + Tides + Bend Luck');
ok(ss.featuresAtLevel('sorcerer', 'Wild Magic Sorcery', 18).length === 5, 'Wild Magic L18 has all 5 features (no 10th-level feature)');
ok(ss.featuresAtLevel('paladin', 'Oath of Devotion', 7).length === 3, 'Devotion L7 has Oath Spells + Channel Divinity + Aura of Devotion');
ok(ss.featuresAtLevel('paladin', 'Oath of Devotion', 20).length === 5, 'Devotion L20 has all 5 features (no 6th/10th/14th-level features)');
ok(ss.featuresAtLevel('paladin', 'Oath of Glory', 15).length === 4, 'Glory L15 has Oath Spells + Channel Divinity + Aura + Glorious Defense');

group('3. Batch 3 pure math');
ok(ss.danceUnarmoredAc(3, 4) === 17, 'Dance unarmored AC Dex +3 Cha +4: 10 + 3 + 4 = 17');
ok(ss.mantleOfInspirationTempHp(6) === 12, 'Mantle of Inspiration roll 6: 2 x 6 = 12 temp HP');
ok(ss.wildMagicSurgeOnRoll(20) === true, 'Wild Magic Surge triggers on a d20 roll of 20');
ok(ss.wildMagicSurgeOnRoll(19) === false, 'Wild Magic Surge does not trigger on 19');
ok(ss.bendLuckDie().dice === '1d4' && ss.bendLuckDie().costSorceryPoints === 1, 'Bend Luck: 1d4 for 1 Sorcery Point');
ok(ss.bastionOfLawWardDice(3).count === 3 && ss.bastionOfLawWardDice(3).die === 8, 'Bastion of Law 3 Sorcery Points: 3d8 ward');
ok(ss.draconicResilienceHpBonus(3) === 3, 'Draconic Resilience L3: +3 HP max');
ok(ss.draconicResilienceHpBonus(6) === 6, 'Draconic Resilience L6: +6 HP max (3 + 1 per level after 3rd)');
ok(ss.draconicResilienceHpBonus(2) === 0, 'no Draconic Resilience bonus before level 3');
ok(ss.gloriousDefenseBonus(4) === 4, 'Glorious Defense Cha +4: +4 AC');
ok(ss.gloriousDefenseBonus(0) === 1, 'Glorious Defense never drops below +1 in the helper');

group('4. Spell access: oath and subclass spells are always prepared');
ok(ss.paladinOathSpellsAtLevel('paladin', 'Oath of Devotion', 3).join(',') === 'Protection from Evil and Good,Shield of Faith', 'Devotion L3 always-prepared oath spells');
ok(ss.paladinOathSpellsAtLevel('paladin', 'Oath of Glory', 9).includes('Haste'), 'Glory L9 adds Haste');
ok(ss.paladinOathSpellsAtLevel('paladin', 'Oath of the Ancients', 17).length === 10, 'Ancients L17 always-prepared list is all 10 oath spells');
ok(ss.paladinOathSpellsAtLevel('paladin', 'Oath of Vengeance', 5).includes("Hunter's Mark"), 'Vengeance keeps Hunter’s Mark in its oath list');
ok(ss.sorcererSubclassSpellsAtLevel('sorcerer', 'Aberrant Sorcery', 3).includes('Mind Sliver'), 'Aberrant L3 includes Mind Sliver (PHB 2024 re-tiering)');
ok(ss.sorcererSubclassSpellsAtLevel('sorcerer', 'Aberrant Sorcery', 9).length === 11, 'Aberrant L9 always-prepared list is all 11 psionic spells (5+2+2+2)');
ok(ss.sorcererSubclassSpellsAtLevel('sorcerer', 'Aberrant Sorcery', 9).includes("Rary's Telepathic Bond") && ss.sorcererSubclassSpellsAtLevel('sorcerer', 'Aberrant Sorcery', 9).includes('Telekinesis'), 'Aberrant L9 adds Rary’s Telepathic Bond and Telekinesis');
ok(ss.sorcererSubclassSpellsAtLevel('sorcerer', 'Aberrant Sorcery', 11).length === 11, 'Aberrant L11 always-prepared list is still 11 (no new tier above 9th)');
ok(ss.sorcererSubclassSpellsAtLevel('sorcerer', 'Clockwork Sorcery', 3).includes('Aid'), 'Clockwork L3 includes Aid (PHB 2024 re-tiering)');
ok(ss.sorcererSubclassSpellsAtLevel('sorcerer', 'Clockwork Sorcery', 5).includes('Dispel Magic'), 'Clockwork L5 adds Dispel Magic');
ok(ss.sorcererSubclassSpellsAtLevel('sorcerer', 'Draconic Sorcery', 3).length === 4, 'Draconic L3 always-prepared list is 4 spells');
{
  const devotion = ss.getSubclass('paladin', 'Oath of Devotion').features.find((f) => f.kind === 'D');
  const draconic = ss.getSubclass('sorcerer', 'Draconic Sorcery').features.find((f) => f.kind === 'D');
  ok(devotion.mechanics.access === 'always prepared', 'oath spells are always prepared');
  ok(draconic.mechanics.access === 'always prepared', 'sorcerer subclass spells are always prepared');
  const glamour = ss.getSubclass('bard', 'College of Glamour').features.find((f) => f.key === 'beguiling_magic');
  ok(glamour.mechanics.access === 'always prepared', 'Beguiling Magic spells are always prepared');
}

group('5. Spell access checked against the catalog (kind D)');
{
  const inCatalog = (name) => Object.prototype.hasOwnProperty.call(SPELL_DATA_ENTRIES, String(name).toLowerCase());
  for (const [cls, name, helper, expected] of [
    ['paladin', 'Oath of Devotion', ss.paladinOathSpellsAtLevel, 10],
    ['paladin', 'Oath of Glory', ss.paladinOathSpellsAtLevel, 10],
    ['paladin', 'Oath of the Ancients', ss.paladinOathSpellsAtLevel, 10],
    ['paladin', 'Oath of Vengeance', ss.paladinOathSpellsAtLevel, 10],
    ['sorcerer', 'Aberrant Sorcery', ss.sorcererSubclassSpellsAtLevel, 11],
    ['sorcerer', 'Clockwork Sorcery', ss.sorcererSubclassSpellsAtLevel, 10],
    ['sorcerer', 'Draconic Sorcery', ss.sorcererSubclassSpellsAtLevel, 10],
  ]) {
    const spells = helper(cls, name, 17);
    ok(spells.length === expected && spells.every(inCatalog), `${name} all ${expected} spells are in the catalog (no catalog gap)`);
  }
  // Draconic was the exception; Summon Dragon landed in the catalog
  // (2026-11-06 sorcerer reconciliation), so it joins the loop above.
  const draconic = ss.sorcererSubclassSpellsAtLevel('sorcerer', 'Draconic Sorcery', 9);
  ok(draconic.length === 10, 'Draconic L9 list is 10 spells');
  ok(inCatalog('Summon Dragon'), 'Summon Dragon is in the catalog (the former Batch 3 gap, closed)');
  // Glamour fixed spells, checked directly.
  ok(['Charm Person', 'Mirror Image', 'Command'].every(inCatalog), 'Glamour Beguiling Magic + Mantle of Majesty spells are all in the catalog');
}

group('6. Choice validation (kind G)');
ok(ss.validateChoiceList('bard', 'College of Lore', 'lore_bonus_skills', ['History', 'Arcana', 'Insight']).valid, 'History + Arcana + Insight are valid Lore bonus skills');
ok(!ss.validateChoiceList('bard', 'College of Lore', 'lore_bonus_skills', ['History', 'Arcana', 'Insight', 'Nature']).valid, '4 Lore bonus skills exceeds maxCount 3');
ok(!ss.validateChoiceList('bard', 'College of Lore', 'lore_bonus_skills', ['History', 'Fireball']).valid, 'Fireball is not a skill');
ok(ss.validateChoice('sorcerer', 'Draconic Sorcery', 'draconic_affinity', 'Fire').valid, 'Fire is a valid Draconic affinity');
ok(!ss.validateChoice('sorcerer', 'Draconic Sorcery', 'draconic_affinity', 'Radiant').valid, 'Radiant is not a Draconic affinity option');
ok(!ss.validateChoice('bard', 'College of Dance', 'lore_bonus_skills', 'History').valid, 'Dance has no stored choices');
ok(ss.parseSubclassChoices(JSON.stringify({ draconic_affinity: 'Cold' })).draconic_affinity === 'Cold', 'stored Draconic affinity parses');

group('7. Wild Magic: trigger, full PHB d100 table, and modeled-not-ready remainder');
{
  const surge = ss.getSubclass('sorcerer', 'Wild Magic Sorcery').features.find((f) => f.key === 'wild_magic_surge');
  ok(surge.kind === 'T', 'Wild Magic Surge is kind T (trigger_table)');
  ok(surge.mechanics.trigger.includes('spell slot'), 'surge trigger requires a Sorcerer spell cast with a spell slot');
  ok(surge.mechanics.surgeOn === 'a roll of 20', 'surge fires on a d20 roll of 20');
  ok(surge.mechanics.tableStatus.includes('PHB 2024'), 'surge table status cites the PHB 2024 full table, not PARTIAL');
  ok(!surge.mechanics.tableStatus.includes('PARTIAL'), 'surge table is no longer flagged PARTIAL');
  const entries = surge.mechanics.surgeTable.entries;
  ok(surge.mechanics.surgeTable.roll === 'd100', 'surge table rolls a d100');
  ok(Array.isArray(entries) && entries.length === 25, 'surge table has exactly 25 entries (the full PHB d100 table)');
  ok(entries.every((e) => e.gateCheck === false), 'every surge entry is gateCheck false (photographed from the PHB, not a placeholder)');
  ok(!entries.some((e) => e.name === 'Self Fireball' || e.name === 'Wild Growth'), 'no invented Self Fireball / Wild Growth entries');
  // Ranges cover 01-00 contiguously: each starts where the last
  // ended, '00' is 100. No gaps, no overlaps.
  {
    const num = (s) => (s === '00' ? 100 : parseInt(s, 10));
    let next = 1, contiguous = true;
    for (const e of entries) {
      const [a, b] = e.range.split(/\D+/).filter(Boolean).map(num);
      if (a !== next || b < a) { contiguous = false; break; }
      next = b + 1;
    }
    ok(contiguous && next === 101, 'surge ranges cover 01-00 contiguously with no gaps or overlaps');
  }
  ok(surge.engine.includes('spellCastService'), 'surge engine field names the spell-cast hook as a follow-up');
  const tamed = ss.getSubclass('sorcerer', 'Wild Magic Sorcery').features.find((f) => f.key === 'tamed_surge');
  ok(tamed.level === 18, 'Tamed Surge is the 18th-level feature');
  ok(tamed.engine.includes('full modeled table'), 'Tamed Surge chooses from the full modeled table');
  const tides = ss.getSubclass('sorcerer', 'Wild Magic Sorcery').features.find((f) => f.key === 'tides_of_chaos');
  ok(tides.mechanics.recharge.includes('automatically roll'), 'Tides of Chaos auto-surges on the next qualifying cast');
}

group('8. DB round-trip + prompt section + migration 103 column');
const pc = await addPc({ subclass: 'Wild Magic Sorcery', subclass_choices_json: JSON.stringify({ draconic_affinity: 'Fire' }) });
const devotionComp = await addCompanion('Seraph', pc.id, { companion_class: 'Paladin', companion_subclass: 'Oath of Devotion' });
const npcStatsComp = await addCompanion('Brute', pc.id, { companion_class: 'Bard', companion_subclass: 'College of Dance', progression_type: 'npc_stats' });
const pcRow = await dbGet('SELECT * FROM characters WHERE id = ?', [pc.id]);
ok(pcRow.subclass === 'Wild Magic Sorcery', 'PC subclass persists on the character row');
ok(pcRow.subclass_choices_json != null, 'subclass_choices_json column exists on characters (migration 103)');
ok(ss.validateChoice('sorcerer', 'Draconic Sorcery', 'draconic_affinity', ss.parseSubclassChoices(pcRow.subclass_choices_json).draconic_affinity).valid, 'stored Draconic affinity validates against the registry');
const section = ss.buildSubclassPromptSection(pcRow, [devotionComp, npcStatsComp]);
ok(section.includes('Wild Magic Sorcery'), 'prompt section names the PC subclass');
ok(section.includes('Wild Magic Surge'), 'prompt section lists Wild Magic Surge');
ok(section.includes('The full table is modeled with its d100 ranges'), 'prompt section carries the full Wild Magic table line');
ok(!section.includes('PARTIAL'), 'prompt section carries no PARTIAL flag');
ok(section.includes('Oath of Devotion'), 'prompt section lists the companion Devotion feature');
ok(!section.includes('Brute'), 'npc_stats companion is skipped in the subclass section');
ok(section.includes('Never silently add'), 'prompt section carries the PC reported-total rule');

console.log(`\nsubclass-batch3: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
