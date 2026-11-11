// tests/subclass-scanned5.test.js — Scanned Batch S5 (Heroes of
// Faerûn, 2024-era, Forgotten Realms — the FINAL subclass batch):
// Bard College of the Moon, Cleric Knowledge Domain, Fighter
// Banneret, Paladin Oath of the Noble Genies, Ranger Winter
// Walker, Rogue Scion of the Three, Sorcerer Spellfire Sorcery,
// Wizard Bladesinger = 8 new, registry 94 -> 102, completing the
// authorized set (PHB 48 + scanned 46 + Heroes 8). No still-unbuilt
// authorized subclass remains after this batch.
// Real services, real DB, same pattern as earlier subclass tests.
//
// SOURCE NOTE: mechanics are paraphrased in the app's own wording
// from the Heroes of Faerûn text extract on the Mac (660,813
// bytes, pulled 2026-11-03; subclass text at lines 565-1189 of
// that extract). Heroes grants coincide exactly with the built
// 2024 class cadences, so no feature was re-pointed; every S5
// number is gateCheck for Zach against the Heroes book.
// Nothing here was authored from the mislabeled 2014 PHB Pt1/Pt2
// scans, and nothing was authored from memory alone.
//
// CLASS CORRECTION: the S5 brief listed Scion of the Three under
// Sorcerer. The Heroes intake (Batch 3) and the Heroes text
// extract both place Scion of the Three under Rogue (Dead Three
// patron choice: Bane, Bhaal, Myrkul), so it is wired as a Rogue
// subclass here, and the batch still lands one subclass per class.
//
// FOLLOW-UPS NOT WIRED HERE: Heroes feats (34) and Heroes spells
// (19, incl. Circle magic) are separate systems, not subclasses.
// Frozen Haunt and Crown of Spellfire are transformation states,
// DM-tracked — no entity row is created for either.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-subclass-scanned5-'));
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
    name: 'Tester', class: 'Rogue', level: 10,
    current_hp: 60, max_hp: 60, armor_class: 18,
    ability_scores: JSON.stringify({ str: 14, dex: 12, con: 14, int: 10, wis: 16, cha: 10 }),
    skills: JSON.stringify([]),
    spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 3 }),
    spell_slots_used: JSON.stringify({}),
    ...over
  });
  return await dbGet('SELECT * FROM characters WHERE id = ?', [id]);
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

const S5 = [
  ['bard', 'College of the Moon'],
  ['cleric', 'Knowledge Domain'],
  ['fighter', 'Banneret'],
  ['paladin', 'Oath of the Noble Genies'],
  ['ranger', 'Winter Walker'],
  ['rogue', 'Scion of the Three'],
  ['sorcerer', 'Spellfire Sorcery'],
  ['wizard', 'Bladesinger'],
];

group('1. Registry counts/lookup (94 -> 102, authorized set complete)');
ok(ss.listSubclasses('barbarian').length === 9, 'Barbarian file exports exactly 9 (unchanged by S5) + 2 Additional');
ok(ss.listSubclasses('bard').length === 11, 'Bard file exports exactly 11 (8 prior + College of the Moon) + 2 Additional');
ok(ss.listSubclasses('cleric').length === 11, 'Cleric file exports exactly 11 (8 prior + Knowledge Domain) + 2 Additional');
ok(ss.listSubclasses('druid').length === 9, 'Druid file exports exactly 9 (unchanged by S5 — no Heroes druid exists) + 1 Additional');
ok(ss.listSubclasses('fighter').length === 11, 'Fighter file exports exactly 11 (9 prior + Banneret) + 1 Additional');
ok(ss.listSubclasses('monk').length === 9, 'Monk file exports exactly 9 (unchanged by S5) + 1 Additional');
ok(ss.listSubclasses('paladin').length === 9, 'Paladin file exports exactly 9 (7 prior + Oath of the Noble Genies) + 1 Additional');
ok(ss.listSubclasses('ranger').length === 9, 'Ranger file exports exactly 9 (7 prior + Winter Walker) + 1 Additional');
ok(ss.listSubclasses('rogue').length === 11, 'Rogue file exports exactly 11 (9 prior + Scion of the Three) + 1 Additional');
ok(ss.listSubclasses('sorcerer').length === 10, 'Sorcerer file exports exactly 10 (8 prior + Spellfire Sorcery) + 1 Additional');
ok(ss.listSubclasses('warlock').length === 9, 'Warlock file exports exactly 9 (unchanged by S5) + 2 Additional');
ok(ss.listSubclasses('wizard').length === 10, 'Wizard file exports exactly 10 (8 prior + Bladesinger) + 1 Additional');
{
  const total = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'rogue', 'wizard', 'warlock', 'sorcerer', 'paladin', 'ranger']
    .reduce((a, c) => a + ss.listSubclasses(c).length, 0);
  ok(total === 118, 'Registry total is 118 (102 + 16 Additional across the 12 classes; artificer + new classes counted separately)');
}
for (const [cls, name] of S5) {
  ok(ss.getSubclass(cls, name)?.name === name, `${name} found by class + name`);
}
ok(ss.getSubclass('rogue', 'Scion of the Three')?.key === 'scion_of_the_three', 'Scion of the Three is a Rogue subclass, not a Sorcerer one');
ok(ss.getSubclass('sorcerer', 'Scion of the Three') === null, 'Scion of the Three is NOT a Sorcerer subclass (brief correction)');

group('2. No still-unbuilt authorized subclass remains');
for (const [cls, name] of S5) {
  ok(ss.getSubclass(cls, name) !== null, `${name} is no longer still-null after S5`);
}
ok(ss.getSubclass('bard', 'Unknown Subclass') === null, 'A genuinely unknown name still returns null');
ok(ss.getSubclass('fighter', 'Banneret 2') === null, 'Near-miss Banneret name returns null');

group('3. Selection levels, origins, conversion flags');
for (const [cls, name] of S5) {
  const e = ss.getSubclass(cls, name);
  ok(e.selectionLevel === 3, `${name} selects at 3rd (2024 cadence)`);
  ok(e.origin_setting === 'Forgotten Realms' && e.origin_region === 'Forgotten Realms', `${name} is Forgotten Realms origin, no explanation required`);
  ok(e.source === 'Heroes of Faerûn', `${name} source is Heroes of Faerûn`);
  ok(e.sourceTier === 'scanned' && typeof e.conversionCheck === 'string' && e.conversionCheck.length > 0, `${name} carries a conversionCheck note`);
  ok(e.gateCheckRequired === true, `${name} is gateCheck-flagged`);
  ok(e.features.every((f) => f.kind && f.prompt && f.gateCheck === true), `${name} every feature has a kind, a prompt, and gateCheck`);
  ok(e.features.every((f) => ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].includes(f.kind)), `${name} every feature kind is in the plan taxonomy`);
  ok(!ss.validateSelection({ className: cls, subclassName: name, level: 2 }).complete, `${name} at level 2 is incomplete (selection is 3rd)`);
  ok(ss.validateSelection({ className: cls, subclassName: name, level: 3, originExplanation: '' }).complete, `${name} at level 3 with no explanation is complete (FR origin)`);
}

group('4. Features at level');
ok(ss.featuresAtLevel('bard', 'College of the Moon', 3).length === 2, 'Moon L3 has Moon\'s Inspiration + Primal Lore');
ok(ss.featuresAtLevel('bard', 'College of the Moon', 14).length === 4, 'Moon L14 has all 4 features');
ok(ss.featuresAtLevel('cleric', 'Knowledge Domain', 3).length === 3, 'Knowledge L3 has Blessings of Knowledge + Domain Spells + Mind Magic');
ok(ss.featuresAtLevel('cleric', 'Knowledge Domain', 17).length === 5, 'Knowledge L17 has all 5 features');
ok(ss.featuresAtLevel('fighter', 'Banneret', 3).length === 2, 'Banneret L3 has Knightly Envoy + Group Recovery');
ok(ss.featuresAtLevel('fighter', 'Banneret', 18).length === 6, 'Banneret L18 has all 6 features');
ok(ss.featuresAtLevel('paladin', 'Oath of the Noble Genies', 3).length === 3, 'Noble Genies L3 has Elemental Smite + Genie Spells + Genie\'s Splendor');
ok(ss.featuresAtLevel('paladin', 'Oath of the Noble Genies', 20).length === 6, 'Noble Genies L20 has all 6 features');
ok(ss.featuresAtLevel('ranger', 'Winter Walker', 3).length === 3, 'Winter Walker L3 has Frigid Explorer + Hunter\'s Rime + Winter Walker Spells');
ok(ss.featuresAtLevel('ranger', 'Winter Walker', 15).length === 6, 'Winter Walker L15 has all 6 features');
ok(ss.featuresAtLevel('rogue', 'Scion of the Three', 3).length === 2, 'Scion L3 has Bloodthirst + Dread Allegiance');
ok(ss.featuresAtLevel('rogue', 'Scion of the Three', 17).length === 5, 'Scion L17 has all 5 features');
ok(ss.featuresAtLevel('sorcerer', 'Spellfire Sorcery', 3).length === 2, 'Spellfire L3 has Spellfire Burst + Spellfire Spells');
ok(ss.featuresAtLevel('sorcerer', 'Spellfire Sorcery', 18).length === 5, 'Spellfire L18 has all 5 features');
ok(ss.featuresAtLevel('wizard', 'Bladesinger', 3).length === 2, 'Bladesinger L3 has Bladesong + Training in War and Song');
ok(ss.featuresAtLevel('wizard', 'Bladesinger', 14).length === 5, 'Bladesinger L14 has all 5 features');

group('5. Pure math helpers');
ok(ss.unfetteredMindContacts(3) === 3 && ss.unfetteredMindContacts(0) === 1 && ss.unfetteredMindContacts(-1) === 1, 'Unfettered Mind contacts are Wisdom modifier, minimum 1');
ok(ss.groupRecoveryAllies(4) === 4 && ss.groupRecoveryAllies(0) === 1, 'Group Recovery / Rallying Surge allies are Charisma modifier, minimum 1');
ok(ss.elementalRebukeUses(3) === 3 && ss.elementalRebukeUses(0) === 1, 'Elemental Rebuke uses are Charisma modifier, minimum 1');
ok(ss.polarStrikesDie(3) === 4 && ss.polarStrikesDie(10) === 4 && ss.polarStrikesDie(11) === 6, 'Polar Strikes die is 1d4, 1d6 at Ranger 11');
ok(ss.fortifyingSoulTargets(2) === 2 && ss.fortifyingSoulTargets(0) === 1, 'Fortifying Soul targets are Wisdom modifier, minimum 1');
ok(ss.chillingRetributionUses(4) === 4 && ss.chillingRetributionUses(0) === 1, 'Chilling Retribution uses are Wisdom modifier, minimum 1');
ok(ss.bloodthirstUses(3) === 3 && ss.bloodthirstUses(0) === 1, 'Bloodthirst uses are Intelligence modifier, minimum 1');
ok(ss.scionAuraDamage(3) === 3 && ss.scionAuraDamage(-1) === -1, 'Aura of Malevolence damage equals Intelligence modifier');
ok(ss.crownLifeForceMaxDice(4) === 4 && ss.crownLifeForceMaxDice(0) === 1, 'Crown of Spellfire Hit Point Dice cap is Charisma modifier, minimum 1');
ok(ss.bladesongUses(4) === 4 && ss.bladesongUses(0) === 1, 'Bladesong uses are Intelligence modifier, minimum 1');
ok(ss.bladesongAcBonus(4) === 4 && ss.bladesongAcBonus(0) === 1, 'Bladesong AC bonus is Intelligence modifier, minimum +1');
ok(ss.songOfDefenseReduction(3) === 15 && ss.songOfDefenseReduction(1) === 5, 'Song of Defense reduction is 5 times the spell slot level');
ok(typeof ss.unfetteredMindContacts === 'function' && typeof ss.songOfDefenseReduction === 'function', 'All 12 S5 helpers are named exports');
ok(ss.default && ss.default.unfetteredMindContacts && ss.default.songOfDefenseReduction, 'S5 helpers are in the default export');

group('6. Spell access vs catalog (no gaps in S5; catalog is 583)');
{
  const inCatalog = (name) => Object.prototype.hasOwnProperty.call(SPELL_DATA_ENTRIES, String(name).toLowerCase());
  ok(Object.keys(SPELL_DATA_ENTRIES).length === 583, 'Live catalog has 583 entries (544 + 38 overnight-build spells + Summon Dragon, sorcerer reconciliation 2026-11-06)');
  const knowledge = ss.clericDomainSpellsAtLevel('cleric', 'Knowledge Domain', 9);
  ok(knowledge.length === 15 && knowledge.every(inCatalog), 'Knowledge 15/15 domain spells in catalog');
  const knowledgeSpells = ss.getSubclass('cleric', 'Knowledge Domain').features.find((f) => f.key === 'knowledge_domain_spells');
  ok(knowledgeSpells.prompt.includes('Mind Magic pool: Comprehend Languages, Detect Magic, Detect Thoughts, Identify, Mind Spike, Tongues, Arcane Eye, Legend Lore, Scrying'), 'Mind Magic pool is exactly the starred Divination spells on the domain table (Mind Spike and Arcane Eye included)');
  const genie = ss.paladinOathSpellsAtLevel('paladin', 'Oath of the Noble Genies', 17);
  ok(genie.length === 11 && genie.every(inCatalog), 'Noble Genies 11/11 oath spells in catalog');
  const winter = ss.rangerSubclassSpellsAtLevel('ranger', 'Winter Walker', 17);
  ok(winter.length === 5 && winter.every(inCatalog), 'Winter Walker 5/5 spells in catalog');
  const spellfire = ss.sorcererSubclassSpellsAtLevel('sorcerer', 'Spellfire Sorcery', 9);
  ok(spellfire.length === 10 && spellfire.every(inCatalog), 'Spellfire 10/10 spells in catalog via the helper');
  const absorb = ss.getSubclass('sorcerer', 'Spellfire Sorcery').features.find((f) => f.key === 'absorb_spells');
  ok(absorb && absorb.mechanics.alwaysPreparedByLevel[6].includes('Counterspell') && inCatalog('Counterspell'), 'Absorb Spells always-prepared Counterspell is in the catalog (asserted directly, not via the first-D-only helper)');
  const moonbeam = ss.getSubclass('bard', 'College of the Moon').features.find((f) => f.key === 'blessing_of_moonlight');
  ok(moonbeam && moonbeam.mechanics.alwaysPreparedByLevel[6].includes('Moonbeam') && inCatalog('Moonbeam'), 'Blessing of Moonlight always-prepared Moonbeam is in the catalog');
  ok(inCatalog('Minor Illusion') && inCatalog('Blade Ward') && inCatalog('Chill Touch'), 'Dread Allegiance cantrips are all in the catalog');
  ok(ss.getSubclass('fighter', 'Banneret').features.every((f) => f.kind !== 'D'), 'Banneret grants no spell list feature');
  ok(ss.getSubclass('rogue', 'Scion of the Three').features.every((f) => f.kind !== 'D'), 'Scion grants no spell list feature (its cantrip comes from the allegiance choice)');
  ok(ss.getSubclass('wizard', 'Bladesinger').features.every((f) => f.kind !== 'D'), 'Bladesinger grants no spell list feature');
}

group('7. Choice validation (migration 103, no silent defaults)');
ok(ss.validateChoice('bard', 'College of the Moon', 'moon_lore_skill', 'Nature').valid, 'Nature is a valid Moon lore skill');
ok(!ss.validateChoice('bard', 'College of the Moon', 'moon_lore_skill', 'Arcana').valid, 'Arcana is not a Moon lore skill');
ok(ss.validateChoice('cleric', 'Knowledge Domain', 'knowledge_skills', 'Arcana').valid, 'Arcana is a valid Knowledge skill');
ok(ss.validateChoiceList('cleric', 'Knowledge Domain', 'knowledge_skills', ['Arcana', 'History']).valid, 'Arcana + History are valid Knowledge skills');
ok(!ss.validateChoiceList('cleric', 'Knowledge Domain', 'knowledge_skills', ['Arcana', 'History', 'Nature']).valid, '3 Knowledge skills exceeds maxCount 2');
ok(ss.validateChoice('fighter', 'Banneret', 'envoy_skill', 'Persuasion').valid, 'Persuasion is a valid envoy skill');
ok(!ss.validateChoice('fighter', 'Banneret', 'envoy_skill', 'Arcana').valid, 'Arcana is not an envoy skill');
ok(ss.validateChoice('paladin', 'Oath of the Noble Genies', 'splendor_skill', 'Acrobatics').valid, 'Acrobatics is a valid splendor skill');
ok(ss.validateChoice('rogue', 'Scion of the Three', 'dread_allegiance', 'Bhaal').valid, 'Bhaal is a valid Dread Allegiance');
ok(!ss.validateChoice('rogue', 'Scion of the Three', 'dread_allegiance', 'Tiamat').valid, 'Tiamat is not a Dread Allegiance');
ok(ss.validateChoice('wizard', 'Bladesinger', 'bladesinger_skill', 'Performance').valid, 'Performance is a valid Bladesinger skill');
ok(!ss.validateChoice('wizard', 'Bladesinger', 'bladesinger_skill', 'Stealth').valid, 'Stealth is not a Bladesinger skill');

group('8. Prompt-contains (origins, transformation honesty, PC reported-total rule)');
{
  const moon = ss.buildSubclassPromptSection({ class: 'Bard', subclass: 'College of the Moon', level: 14 }, []);
  ok(moon.includes('College of the Moon') && moon.includes('Eventide\'s Splendor') && moon.includes('Forgotten Realms'), 'Prompt names Moon, Eventide\'s Splendor, and its FR origin');
  const knowledge = ss.buildSubclassPromptSection({ class: 'Cleric', subclass: 'Knowledge Domain', level: 17 }, []);
  ok(knowledge.includes('Knowledge Domain') && knowledge.includes('Divine Foreknowledge'), 'Prompt names Knowledge Domain and Divine Foreknowledge');
  const banneret = ss.buildSubclassPromptSection({ class: 'Fighter', subclass: 'Banneret', level: 18 }, []);
  ok(banneret.includes('Banneret') && banneret.includes('Inspiring Commander'), 'Prompt names Banneret and Inspiring Commander');
  const frozen = ss.buildSubclassPromptSection({ class: 'Ranger', subclass: 'Winter Walker', level: 15 }, []);
  ok(frozen.includes('Frozen Haunt') && frozen.includes('no entity row'), 'Prompt names Frozen Haunt and its no-entity-row honesty note');
  const crown = ss.buildSubclassPromptSection({ class: 'Sorcerer', subclass: 'Spellfire Sorcery', level: 18 }, []);
  ok(crown.includes('Crown of Spellfire') && crown.includes('no entity row'), 'Prompt names Crown of Spellfire and its no-entity-row honesty note');
  const blades = ss.buildSubclassPromptSection({ class: 'Wizard', subclass: 'Bladesinger', level: 14 }, []);
  ok(blades.includes('Bladesinger') && blades.includes('Song of Victory'), 'Prompt names Bladesinger and Song of Victory');
  const scion = ss.buildSubclassPromptSection({ class: 'Rogue', subclass: 'Scion of the Three', level: 17 }, []);
  ok(scion.includes('Scion of the Three') && scion.includes('Dread Incarnate'), 'Prompt names Scion of the Three (Rogue) and Dread Incarnate');
  ok(moon.includes('Never silently add'), 'Prompt section carries the PC reported-total rule');
  const unknown = ss.buildSubclassPromptSection({ class: 'Bard', subclass: 'Unknown Subclass', level: 5 }, []);
  ok(unknown.includes('not yet in the subclass registry') && !unknown.includes('Moon\'s Inspiration'), 'Unknown subclass renders a not-yet line, no invented features');
}

group('9. Unknown-subclass null asserts');
ok(ss.getSubclass('bard', 'College of the Moon 2') === null, 'Near-miss Moon name returns null');
ok(ss.featuresAtLevel('wizard', 'Bladesinger 2', 9).length === 0, 'Features for an unknown subclass are empty, never invented');
ok(!ss.validateSelection({ className: 'rogue', subclassName: 'Scion of the Three 2', level: 3 }).found, 'Unknown subclass selection reports not found');
ok(ss.getSubclass('ranger', 'Winter Walker').features.some((f) => f.key === 'frozen_haunt'), 'Winter Walker entry includes Frozen Haunt (transformation honesty: DM-tracked form, no row invented)');
ok(ss.getSubclass('sorcerer', 'Spellfire Sorcery').features.some((f) => f.key === 'crown_of_spellfire'), 'Spellfire entry includes Crown of Spellfire (transformation honesty: DM-tracked state, no row invented)');

group('10. DB integration: stored choice + companion prompt + origin');
{
  const pc = await addPc({
    class: 'Rogue', level: 10, subclass: 'Scion of the Three',
    subclass_choices_json: JSON.stringify({ dread_allegiance: 'Myrkul' }),
  });
  ok(pc.subclass === 'Scion of the Three', 'PC row carries the S5 subclass');
  const parsed = ss.parseSubclassChoices(pc.subclass_choices_json);
  ok(ss.validateChoice('rogue', 'Scion of the Three', 'dread_allegiance', parsed.dread_allegiance).valid, 'PC stored Dread Allegiance validates from the DB row');
  const comp = await addCompanion('Ally', pc.id, {
    companion_class: 'Wizard', companion_subclass: 'Bladesinger', companion_level: 6,
  });
  const section = ss.buildSubclassPromptSection(pc, [comp]);
  ok(section.includes('Scion of the Three') && section.includes('Bladesinger'), 'Prompt section covers PC + class-progression companion S5 subclasses');
  const npcStats = await addCompanion('Mook', pc.id, {
    companion_class: 'Bard', companion_subclass: 'College of the Moon', companion_level: 6, progression_type: 'npc_stats',
  });
  const section2 = ss.buildSubclassPromptSection(pc, [npcStats]);
  ok(!section2.includes('College of the Moon'), 'npc_stats companions are skipped by the prompt section, as before');
}

console.log(`\nsubclass-scanned5: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
