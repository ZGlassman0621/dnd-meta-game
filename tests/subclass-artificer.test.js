// tests/subclass-artificer.test.js — Artificer Job 1 (Forge 2024
// subclasses, 2026-11-07): the five Forge entries in
// server/data/subclasses/artificer.js go from SPELLS-ONLY to complete
// (+28 non-spell features at 3/5/9/15; Lumberjack byte-preserved,
// out of scope). Artificer stays 6 entries — no count-assert churn.
// Real services, real DB, same 10-group pattern as the S5 test.
//
// FORGE WINS (settled decision, 2026-11-07, vetoable at the gate):
// Forge 2024 spell lists + features throughout; Eberron only where
// Forge is silent. Two spell-list corrections land here (group 6):
// Alchemist 13th Death Ward + Vitriolic Sphere (not Blight +
// Death Ward) and Battle Smith 5th Shining Smite + Warding Bond
// (not Branding Smite + Warding Bond) — the Battle Smith sourceNote
// that forbade the Shining Smite correction is overturned in the
// data and asserted here. Shining Smite and Vitriolic Sphere are
// in the live catalog without an Artificer class tag (same
// pre-existing pattern as Banishing Smite in the Battle Smith
// list); always-prepared lists grant by name, so no catalog gap.
// No migration (choices ride migration 103 subclass_choices_json;
// atlas_holders is a free-form name array, not a validated choice).
// No dmPromptBuilder.js change, no service-index change.
//
// SOURCE NOTE: mechanics are paraphrased in the app's own wording
// from subclass-sources/forge-artificer/forge-artificer.txt
// (173,879 bytes, two-column OCR). Every number is gateCheck for
// Zach against the Forge book. Two OCR gaps are carried with
// explicit notes in the data (Flamethrower opening line, Arcane
// Jolt trigger line) and flagged in group 10's comments — not
// silently filled.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-subclass-artificer-'));
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
    name: 'Tester', class: 'Artificer', level: 10,
    current_hp: 60, max_hp: 60, armor_class: 18,
    ability_scores: JSON.stringify({ str: 14, dex: 12, con: 14, int: 16, wis: 14, cha: 10 }),
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

const FIVE = ['Alchemist', 'Armorer', 'Artillerist', 'Battle Smith', 'Cartographer'];

group('1. Registry counts/lookup (artificer stays 6; +28 features, no new entries)');
ok(ss.listSubclasses('artificer').length === 6, 'Artificer still lists exactly 6 entries (no count-assert churn)');
ok(JSON.stringify(ss.listSubclasses('artificer').map((e) => e.name)) ===
  JSON.stringify(['Lumberjack', 'Alchemist', 'Armorer', 'Artillerist', 'Battle Smith', 'Cartographer']),
  'Artificer order is Lumberjack + the five Forge subclasses');
for (const name of FIVE) {
  ok(ss.getSubclass('artificer', name), `${name} resolves in the registry`);
}
ok(ss.getSubclass('artificer', 'Lumberjack').features.length === 7, 'Lumberjack still has exactly 7 features (byte-preserved, out of scope)');
ok(ss.getSubclass('artificer', 'Alchemist').features.length === 6, 'Alchemist has 6 features (5 new + spells)');
ok(ss.getSubclass('artificer', 'Armorer').features.length === 7, 'Armorer has 7 features (6 new + spells)');
ok(ss.getSubclass('artificer', 'Artillerist').features.length === 6, 'Artillerist has 6 features (5 new + spells)');
ok(ss.getSubclass('artificer', 'Battle Smith').features.length === 7, 'Battle Smith has 7 features (6 new + spells)');
ok(ss.getSubclass('artificer', 'Cartographer').features.length === 7, 'Cartographer has 7 features (6 new + spells)');
{
  const total = FIVE.reduce((a, n) => a + ss.getSubclass('artificer', n).features.length, 0);
  ok(total === 33, 'Five Forge entries carry 33 features total (28 new + 5 spells features)');
  for (const name of FIVE) {
    const entry = ss.getSubclass('artificer', name);
    ok(entry.features.filter((f) => f.kind === 'D').length === 1, `${name} keeps exactly ONE kind-D feature (the spells list)`);
    ok(entry.features.every((f) => f.gateCheck === true), `${name}: every feature carries gateCheck`);
    ok(entry.features.every((f) => f.key && f.name && f.level && f.kind && f.mechanics && f.prompt && f.engine),
      `${name}: every feature carries all 8 registry fields`);
  }
}

group('2. Selection levels + origins (Forge five: all 5 Eberron)');
for (const name of [...FIVE, 'Lumberjack']) {
  ok(ss.getSubclass('artificer', name).selectionLevel === 3, `${name} selection level derives as 3`);
}
ok(ss.getSubclass('artificer', 'Alchemist').origin_setting === 'Eberron', 'Alchemist origin stays Eberron');
ok(ss.getSubclass('artificer', 'Artillerist').origin_setting === 'Eberron', 'Artillerist origin stays Eberron');
ok(ss.getSubclass('artificer', 'Battle Smith').origin_setting === 'Eberron', 'Battle Smith origin stays Eberron');
ok(ss.getSubclass('artificer', 'Armorer').origin_setting === 'Eberron', 'Armorer origin is Eberron (micro-push #4: artificers are Eberron-origin per Zach 2026-11-08)');
ok(ss.getSubclass('artificer', 'Cartographer').origin_setting === 'Eberron', 'Cartographer origin is Eberron (micro-push #4: artificers are Eberron-origin per Zach 2026-11-08)');
ok(!ss.validateSelection({ className: 'artificer', subclassName: 'Alchemist', level: 3, originExplanation: '' }).complete,
  'Alchemist with a blank origin explanation is incomplete (outside-FR rule)');
ok(!ss.validateSelection({ className: 'artificer', subclassName: 'Battle Smith', level: 3, originExplanation: '' }).complete,
  'Battle Smith with a blank origin explanation is incomplete (outside-FR rule)');
ok(ss.validateSelection({ className: 'artificer', subclassName: 'Alchemist', level: 3, originExplanation: 'Came through a manifest zone.' }).complete,
  'Alchemist with an origin explanation is complete');
ok(!ss.validateSelection({ className: 'artificer', subclassName: 'Armorer', level: 3, originExplanation: '' }).complete,
  'Armorer with a blank origin explanation is incomplete (outside-FR rule, micro-push #4)');
ok(!ss.validateSelection({ className: 'artificer', subclassName: 'Cartographer', level: 3, originExplanation: '' }).complete,
  'Cartographer with a blank origin explanation is incomplete (outside-FR rule, micro-push #4)');
ok(ss.validateSelection({ className: 'artificer', subclassName: 'Armorer', level: 3, originExplanation: 'Came through a manifest zone.' }).complete,
  'Armorer with an origin explanation is complete');
ok(!ss.validateSelection({ className: 'artificer', subclassName: 'Alchemist', level: 2 }).complete,
  'Alchemist below selection level 3 is incomplete');

group('3. Features at level (Forge cadence 3/5/9/15)');
ok(ss.featuresAtLevel('artificer', 'Alchemist', 3).length === 3, 'Alchemist L3 has Tools of the Trade + Spells + Experimental Elixir');
ok(ss.featuresAtLevel('artificer', 'Alchemist', 15).length === 6, 'Alchemist L15 has all 6 features');
ok(ss.featuresAtLevel('artificer', 'Armorer', 3).length === 4, 'Armorer L3 has Tools + Spells + Arcane Armor + Armor Model');
ok(ss.featuresAtLevel('artificer', 'Armorer', 15).length === 7, 'Armorer L15 has all 7 features');
ok(ss.featuresAtLevel('artificer', 'Artillerist', 3).length === 3, 'Artillerist L3 has Tools + Spells + Eldritch Cannon');
ok(ss.featuresAtLevel('artificer', 'Artillerist', 15).length === 6, 'Artillerist L15 has all 6 features');
ok(ss.featuresAtLevel('artificer', 'Battle Smith', 3).length === 4, 'Battle Smith L3 has Tools + Spells + Battle Ready + Steel Defender');
ok(ss.featuresAtLevel('artificer', 'Battle Smith', 15).length === 7, 'Battle Smith L15 has all 7 features');
ok(ss.featuresAtLevel('artificer', 'Cartographer', 3).length === 4, 'Cartographer L3 has Tools + Spells + Atlas + Mapping Magic');
ok(ss.featuresAtLevel('artificer', 'Cartographer', 15).length === 7, 'Cartographer L15 has all 7 features');
ok(ss.featuresAtLevel('artificer', 'Alchemist', 2).length === 0, 'No artificer subclass features before level 3');
ok(ss.getSubclass('artificer', 'Armorer').features.find((f) => f.key === 'armor_model').kind === 'G',
  'Armor Model is the kind-G choice feature');
ok(ss.getSubclass('artificer', 'Artillerist').features.find((f) => f.key === 'eldritch_cannon').kind === 'H',
  'Eldritch Cannon is kind H (entity)');
ok(ss.getSubclass('artificer', 'Battle Smith').features.find((f) => f.key === 'steel_defender').kind === 'H',
  'Steel Defender is kind H (entity)');

group('4. Pure math helpers (Forge numbers)');
ok(ss.experimentalElixirCount(2) === 0 && ss.experimentalElixirCount(3) === 2 && ss.experimentalElixirCount(5) === 3 &&
  ss.experimentalElixirCount(9) === 4 && ss.experimentalElixirCount(15) === 5 && ss.experimentalElixirCount(20) === 5,
  'Elixir count is 2/3/4/5 at levels 3/5/9/15');
ok(ss.experimentalElixirHealingDice(3) === 2 && ss.experimentalElixirHealingDice(9) === 3 && ss.experimentalElixirHealingDice(15) === 4,
  'Elixir Healing dice are 2d8, 3d8 at 9th, 4d8 at 15th');
ok(ss.eldritchCannonHp(3) === 15 && ss.eldritchCannonHp(10) === 50 && ss.eldritchCannonHp(0) === 0,
  'Cannon HP is 5 x Artificer level');
ok(ss.eldritchCannonAc() === 18, 'Cannon AC is 18');
ok(ss.cannonProtectorTempHp(4, 3) === 7 && ss.cannonProtectorTempHp(1, 0) === 2,
  'Protector temp HP is 1d8 + Int mod (minimum +1)');
ok(ss.cannonDetonateDice() === '3d10', 'Detonate damage is 3d10');
ok(ss.cannonFirepowerDice() === '1d8', 'Firepower bonus is 1d8');
ok(ss.steelDefenderHp(3) === 20 && ss.steelDefenderHp(10) === 55 && ss.steelDefenderHp(1) === 10,
  'Defender HP is 5 + 5 x Artificer level');
ok(ss.steelDefenderAc(3) === 15 && ss.steelDefenderAc(0) === 12, 'Defender AC is 12 + Int mod');
ok(ss.steelDefenderRendBonus(3) === 5 && ss.steelDefenderRendBonus(0) === 2, 'Rend damage bonus is 2 + Int mod');
ok(ss.arcaneJoltDice(9) === '2d6' && ss.arcaneJoltDice(15) === '4d6' && ss.arcaneJoltDice(14) === '2d6',
  'Arcane Jolt is 2d6, 4d6 at 15th');
ok(ss.arcaneJoltUses(3) === 3 && ss.arcaneJoltUses(0) === 1, 'Arcane Jolt uses are Int mod, minimum 1');
ok(ss.restorativeReagentsUses(4) === 4 && ss.restorativeReagentsUses(0) === 1, 'Restorative Reagents uses are Int mod, minimum 1');
ok(ss.illuminatedCartographyUses(2) === 2 && ss.illuminatedCartographyUses(-1) === 1, 'Illuminated Cartography uses are Int mod, minimum 1');
ok(ss.atlasMaxHolders(3) === 4 && ss.atlasMaxHolders(0) === 2 && ss.atlasMaxHolders(-2) === 2,
  'Atlas holders max at 1 + Int mod, minimum two');
ok(ss.giantStatureUses(3) === 3 && ss.giantStatureUses(0) === 1, 'Giant Stature uses are Int mod, minimum 1');
ok(ss.guardianPullUses(2) === 2 && ss.guardianPullUses(0) === 1, 'Guardian pull uses are Int mod, minimum 1');
ok(ss.infiltratorFlightUses(4) === 4 && ss.infiltratorFlightUses(0) === 1, 'Infiltrator flight uses are Int mod, minimum 1');
ok(typeof ss.experimentalElixirCount === 'function' && typeof ss.steelDefenderHp === 'function' &&
  typeof ss.arcaneJoltDice === 'function', 'All 18 Job 1 helpers are named exports');
ok(ss.default && ss.default.experimentalElixirCount && ss.default.steelDefenderHp && ss.default.arcaneJoltDice &&
  ss.default.atlasMaxHolders && ss.default.cannonDetonateDice, 'Job 1 helpers are in the default export');

group('5. Spell access vs catalog (no gaps; catalog is 583)');
{
  const inCatalog = (name) => Object.prototype.hasOwnProperty.call(SPELL_DATA_ENTRIES, String(name).toLowerCase());
  ok(Object.keys(SPELL_DATA_ENTRIES).length === 583, 'Live catalog has 583 entries (unchanged by Job 1)');
  for (const name of FIVE) {
    const spells = ss.artificerSubclassSpellsAtLevel('artificer', name, 17);
    ok(spells.length >= 10 && spells.every(inCatalog), `${name} always-prepared list is fully in the catalog (${spells.length} spells)`);
  }
  const cart3 = ss.artificerSubclassSpellsAtLevel('artificer', 'Cartographer', 3);
  ok(cart3.length === 3 && cart3.includes('Faerie Fire') && cart3.includes('Guiding Bolt') && cart3.includes('Healing Word'),
    'Cartographer grants THREE spells at 3rd level, not two');
  ok(ss.artificerSubclassSpellsAtLevel('artificer', 'Alchemist', 2).length === 0, 'No artificer subclass spells before level 3');
  ok(inCatalog('Shining Smite') && inCatalog('Vitriolic Sphere'),
    'Shining Smite and Vitriolic Sphere are in the catalog (no Artificer class tag — always-prepared grants by name, same pattern as Banishing Smite)');
  ok(inCatalog("Tasha's Bubbling Cauldron") && inCatalog('Find the Path') && inCatalog('Lesser Restoration') && inCatalog('Faerie Fire'),
    'Spells named by Chemical Mastery / Superior Atlas / Restorative Reagents / Mapping Magic are all in the catalog');
}

group('6. Forge-vs-Eberron corrections (Forge governs)');
{
  const alch13 = ss.artificerSubclassSpellsAtLevel('artificer', 'Alchemist', 13);
  ok(alch13.includes('Death Ward') && alch13.includes('Vitriolic Sphere') && !alch13.includes('Blight'),
    'Alchemist 13th is Death Ward + Vitriolic Sphere (Forge), NOT Blight + Death Ward (Eberron)');
  const bs5 = ss.artificerSubclassSpellsAtLevel('artificer', 'Battle Smith', 5);
  ok(bs5.includes('Shining Smite') && bs5.includes('Warding Bond') && !bs5.includes('Branding Smite'),
    'Battle Smith 5th is Shining Smite + Warding Bond (Forge), NOT Branding Smite + Warding Bond (Eberron)');
  for (const name of FIVE) {
    ok(ss.getSubclass('artificer', name).source === 'Forge (2024 Artificer)', `${name} source is Forge (2024 Artificer)`);
  }
  ok(ss.getSubclass('artificer', 'Battle Smith').sourceNote.includes('OVERTURNED'),
    'Battle Smith sourceNote records the overturning of the old do-not-correct-Branding-Smite instruction');
  ok(!ss.getSubclass('artificer', 'Battle Smith').sourceNote.includes('do NOT "correct" it'),
    'No Battle Smith sourceNote still forbids the Shining Smite correction');
  const bs = ss.getSubclass('artificer', 'Battle Smith');
  ok(bs.features.find((f) => f.key === 'battle_ready') && bs.features.find((f) => f.key === 'arcane_jolt'),
    'Battle Smith carries Battle Ready (Int for magic-weapon attacks) and Arcane Jolt');
  const arm = ss.getSubclass('artificer', 'Armorer');
  ok(arm.features.find((f) => f.key === 'armor_model').mechanics.models.includes('Dreadnaught'),
    'Armorer carries the Forge Dreadnaught model (not in Eberron/Tasha\'s Armorer)');
  const art = ss.getSubclass('artificer', 'Artillerist');
  ok(art.features.find((f) => f.key === 'eldritch_cannon').mechanics.hp === '5 x your Artificer level',
    'Cannon HP follows the Forge printing (5 x level)');
  const alc = ss.getSubclass('artificer', 'Alchemist');
  ok(alc.features.find((f) => f.key === 'experimental_elixir').mechanics.elixirsByLevel[15] === 5,
    'Elixir count reaches 5 at 15th (Forge scaling)');
}

group('7. Choice validation (armorer_model stored; atlas_holders free-form)');
ok(ss.validateChoice('artificer', 'Armorer', 'armorer_model', 'Dreadnaught').valid, 'Dreadnaught is a valid armor model');
ok(ss.validateChoice('artificer', 'Armorer', 'armorer_model', 'Guardian').valid, 'Guardian is a valid armor model');
ok(ss.validateChoice('artificer', 'Armorer', 'armorer_model', 'Infiltrator').valid, 'Infiltrator is a valid armor model');
ok(ss.validateChoice('artificer', 'Armorer', 'armorer_model', 'guardian').value === 'Guardian',
  'Model validation normalizes case to the declared option');
ok(!ss.validateChoice('artificer', 'Armorer', 'armorer_model', 'Juggernaut').valid, 'Juggernaut is not an armor model');
ok(!ss.validateChoice('artificer', 'Alchemist', 'armorer_model', 'Guardian').valid,
  'armorer_model is not a choice on Alchemist (no silent cross-subclass default)');
{
  const stored = ss.parseSubclassChoices(JSON.stringify({ atlas_holders: ['Tester', 'Ally', 'Scout'] }));
  ok(Array.isArray(stored.atlas_holders) && stored.atlas_holders.length === 3 && stored.atlas_holders[0] === 'Tester',
    'atlas_holders round-trips as a free-form array of creature names via parseSubclassChoices');
  ok(!ss.validateChoice('artificer', 'Cartographer', 'atlas_holders', 'Tester').valid,
    'atlas_holders has no declared choice to validate against (free-form runtime names, by design — no fixed list invented)');
  ok(!ss.validateChoiceList('artificer', 'Cartographer', 'atlas_holders', ['Tester']).valid,
    'validateChoiceList likewise refuses atlas_holders (no declared option list)');
  ok(ss.parseSubclassChoices('not json').atlas_holders === undefined && JSON.stringify(ss.parseSubclassChoices('')) === '{}',
    'parseSubclassChoices stays total for malformed input');
}

group('8. Prompt-contains (names, origins, entity honesty, PC rule)');
{
  const alch = ss.buildSubclassPromptSection({ class: 'Artificer', subclass: 'Alchemist', level: 15 }, []);
  ok(alch.includes('Alchemist') && alch.includes('Experimental Elixir') && alch.includes('Chemical Mastery') && alch.includes('Eberron'),
    'Prompt names Alchemist, Experimental Elixir, Chemical Mastery, and its Eberron origin');
  const arm = ss.buildSubclassPromptSection({ class: 'Artificer', subclass: 'Armorer', level: 15 }, []);
  ok(arm.includes('Armorer') && arm.includes('Perfected Armor') && arm.includes('Eberron'),
    'Prompt names Armorer, Perfected Armor, and its Eberron origin (micro-push #4)');
  const art = ss.buildSubclassPromptSection({ class: 'Artificer', subclass: 'Artillerist', level: 15 }, []);
  ok(art.includes('Artillerist') && art.includes('Eldritch Cannon') && art.includes('no entity row'),
    'Prompt names Artillerist and Eldritch Cannon with its no-entity-row honesty note');
  const bs = ss.buildSubclassPromptSection({ class: 'Artificer', subclass: 'Battle Smith', level: 15 }, []);
  ok(bs.includes('Battle Smith') && bs.includes('Steel Defender') && bs.includes('no entity row'),
    'Prompt names Battle Smith and Steel Defender with its no-entity-row honesty note');
  const cart = ss.buildSubclassPromptSection({ class: 'Artificer', subclass: 'Cartographer', level: 15 }, []);
  ok(cart.includes('Cartographer') && cart.includes("Adventurer's Atlas") && cart.includes('Superior Atlas'),
    'Prompt names Cartographer, Adventurer\'s Atlas, and Superior Atlas');
  ok(alch.includes('Never silently add'), 'Prompt section carries the PC reported-total rule');
  const unknown = ss.buildSubclassPromptSection({ class: 'Artificer', subclass: 'Forgewright', level: 5 }, []);
  ok(unknown.includes('not yet in the subclass registry') && !unknown.includes('Experimental Elixir'),
    'Forgewright (unverified client-list name) renders a not-yet line, no invented features');
}

group('9. Unknown-subclass null asserts');
ok(ss.getSubclass('artificer', 'Forgewright') === null, 'Forgewright is not in the registry (client list is not truth)');
ok(ss.getSubclass('artificer', 'Warsmith') === null, 'Warsmith is not in the registry (client list is not truth)');
ok(ss.featuresAtLevel('artificer', 'Alchemist 2', 9).length === 0, 'Features for an unknown subclass are empty, never invented');
ok(!ss.validateSelection({ className: 'artificer', subclassName: 'Forgewright', level: 3 }).found,
  'Unknown artificer subclass selection reports not found');
ok(ss.getSubclass('artificer', 'Artillerist').features.some((f) => f.key === 'eldritch_cannon'),
  'Artillerist entry includes Eldritch Cannon (entity honesty: DM-tracked, no row invented)');
ok(ss.getSubclass('artificer', 'Battle Smith').features.some((f) => f.key === 'steel_defender'),
  'Battle Smith entry includes Steel Defender (entity honesty: DM-tracked, no row invented)');

group('10. DB integration: stored choice + companion prompt + atlas holders');
{
  const pc = await addPc({
    class: 'Artificer', level: 9, subclass: 'Armorer',
    subclass_choices_json: JSON.stringify({ armorer_model: 'Guardian' }),
  });
  ok(pc.subclass === 'Armorer', 'PC row carries the Job 1 subclass');
  const parsed = ss.parseSubclassChoices(pc.subclass_choices_json);
  ok(ss.validateChoice('artificer', 'Armorer', 'armorer_model', parsed.armorer_model).valid,
    'PC stored armor model validates from the DB row');
  const cartPc = await addPc({
    class: 'Artificer', level: 9, subclass: 'Cartographer',
    subclass_choices_json: JSON.stringify({ atlas_holders: ['Tester', 'Ally'] }),
  });
  const cartParsed = ss.parseSubclassChoices(cartPc.subclass_choices_json);
  ok(Array.isArray(cartParsed.atlas_holders) && cartParsed.atlas_holders.length === 2,
    'Cartographer atlas_holders survive a DB round-trip as a free-form array');
  const comp = await addCompanion('Ally', pc.id, {
    companion_class: 'Artificer', companion_subclass: 'Battle Smith', companion_level: 6,
  });
  const section = ss.buildSubclassPromptSection(pc, [comp]);
  ok(section.includes('Armorer') && section.includes('Battle Smith'),
    'Prompt section covers PC + class-progression companion Job 1 subclasses');
  const npcStats = await addCompanion('Mook', pc.id, {
    companion_class: 'Artificer', companion_subclass: 'Alchemist', companion_level: 6, progression_type: 'npc_stats',
  });
  const section2 = ss.buildSubclassPromptSection(pc, [npcStats]);
  ok(!section2.includes('Alchemist'), 'npc_stats companions are skipped by the prompt section, as before');
}

console.log(`\nsubclass-artificer: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
