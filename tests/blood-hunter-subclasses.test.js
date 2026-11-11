// tests/blood-hunter-subclasses.test.js — Blood Hunter subclasses
// (Ghostslayer / Lycan / Mutant / Profane Soul) + base-class corrections.
//
// Source of truth: Blood Hunter (2024 Rules), GM Binder fan conversion of
// Matt Mercer's Blood Hunter — ~/workspace/dnd-app-review/blood-hunter-mixed-ancestry/Blood_Hunter_2024.txt.
// Every name/level below is pinned from that extract, NOT from the
// client's display lists (which carried invented patrons, wrong Rite
// Focus benefits, a wrong Dark Augmentation, and a wrong Aether Walk —
// all corrected in this job; the corrections are asserted in group (d)).
//
// Honest integration tests: the real subclassService registry, the real
// levelProgression getters, the real spellSelectionService, and real HTTP
// (subclasses + spells + character level-up routes) on a real throwaway
// DB (the levelup-subclass-prompts pattern). If the registry file or
// levelProgression.js were deleted, the imports fail and the suite fails.
//
// Warlord is NOT covered here: it landed as a separate sibling batch
// (2026-11-06, gaps-batch item 8b — 8 KibblesTasty v1.5 Presences from
// the Mac PDF, registry + its own test). Its SUBCLASS_LEVELS entry
// landed 2026-11-06 (warlord: 1), so group (g) pins warlord prompting
// at 1st instead.
import assert from 'node:assert';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blood-hunter-subclasses-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const { BLOOD_HUNTER_SUBCLASSES } = await import(fromRepo('server/data/subclasses/blood_hunter.js'));
const subclassService = await import(fromRepo('server/services/subclassService.js'));
const { listSubclasses, getSubclass, validateChoice, validateSelection } = subclassService;
const lp = await import(fromRepo('server/config/levelProgression.js'));
const { SUBCLASS_LEVELS, CLASS_FEATURES, HIT_DICE,
  CASTER_TYPE, BLOOD_HUNTER_MULTICLASS_GRANT, PROFANE_SOUL_SPELL_SLOTS,
  PROFANE_SOUL_CANTRIPS_KNOWN, PROFANE_SOUL_SPELLS_PREPARED,
  needsSubclassSelection, getAvailableMulticlassOptions, getMulticlassSpellSlots,
  getSpellSlots, getCantripsKnown, getSpellsPrepared, spellcastingAbilityFor,
  getClassFeatures } = lp;
const { canLearnSpell } = await import(fromRepo('server/services/spellSelectionService.js'));
const { validateClassSubclass } = await import(fromRepo('server/services/classValidationService.js'));
const classes = (await import(fromRepo('client/src/data/classes.json'), { with: { type: 'json' } })).default;

// --- HTTP harness: the real routers on a real express app ----
const app = express();
app.use(express.json());
app.use('/api/subclasses', (await import(fromRepo('server/routes/subclasses.js'))).default);
app.use('/api/spells', (await import(fromRepo('server/routes/spells.js'))).default);
app.use('/api/character', (await import(fromRepo('server/routes/character.js'))).default);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
async function req(method, url, body) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function makeLeveled({ name, cls, level, xp, subclass = null }) {
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  assert(created.status === 201, `fixture POST creates ${name} (${cls}) — got ${created.status}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level, experience: xp, max_hp: 20, current_hp: 20, subclass,
    class_levels: JSON.stringify([{ class: cls, level, subclass }]),
  });
  assert(put.status === 200, `fixture PUT sets ${name} to level ${level} (${xp} XP) — got ${put.status}`);
  return id;
}
async function readCharacter(id) {
  return db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
function existingOption(info) {
  return info.json.classOptions.find((o) => o.type === 'existing');
}
function multiclassOption(info, cls) {
  return info.json.classOptions.find((o) => o.type === 'multiclass' && o.class.toLowerCase() === cls);
}
const XP = { to2: 300, to3: 900 };

// Expected subclass features, transcribed from the PDF (name + level).
// The registry is checked against THIS list — deriving it from the
// registry file itself would prove nothing.
const EXPECTED_FEATURES = {
  'Order of the Ghostslayer': [
    ['Rite of the Dawn', 3], ['Curse Specialist', 3], ['Aether Walk', 7],
    ['Brand of Sundering', 11], ['Blood Curse of the Exorcist', 15], ['Rite Revival', 18],
  ],
  'Order of the Lycan': [
    ['Heightened Senses', 3], ['Hybrid Transformation', 3], ["Stalker's Prowess", 7],
    ['Advanced Transformation', 11], ['Brand of the Voracious', 15],
    ['Hybrid Transformation Mastery', 18],
  ],
  'Order of the Mutant': [
    ['Mutagencraft', 3], ['Mutagen Formulas', 3], ['Strange Metabolism', 7],
    ['Brand of Axiom', 11], ['Blood Curse of Corrosion', 15], ['Exalted Mutation', 18],
  ],
  'Order of the Profane Soul': [
    ['Otherworldly Patron', 3], ['Pact Magic', 3], ['Rite Focus', 3],
    ['Mystic Frenzy', 7], ['Revealed Arcana', 7], ['Brand of the Sapping Scar', 11],
    ['Unsealed Arcana', 15], ['Blood Curse of the Soul Eater', 18],
  ],
};

// ===========================================================================
// (a) Registry: all 4 Orders, feature levels 3/7/11/15/18
// ===========================================================================
group('(a) registry — 4 Orders with PDF-verified feature levels');
{
  check(BLOOD_HUNTER_SUBCLASSES.length === 4, `data file holds 4 Orders (got ${BLOOD_HUNTER_SUBCLASSES.length})`);
  const listed = listSubclasses('blood_hunter');
  check(listed.length === 4, `listSubclasses('blood_hunter') returns 4 (got ${listed.length})`);
  // Registry total is DERIVED, not a literal: the sibling warlord batch
  // landed 8 Presences mid-flight (169 -> 177), so any literal total
  // would rot on the next sibling landing. What this pins is that
  // blood_hunter contributes exactly its 4 Orders on top of whatever
  // else the registry holds — and that the merged floor is 181
  // (169 + 8 warlord + 4 Orders) as of this push.
  const ALL = ['artificer', 'barbarian', 'bard', 'blackguard', 'blood_hunter', 'cleric', 'druid', 'duelist', 'fighter', 'keeper', 'magus', 'monk', 'paladin', 'pugilist', 'ranger', 'rogue', 'scholar', 'sorcerer', 'spellshot', 'warden', 'warlock', 'warlord', 'wizard'];
  const total = ALL.reduce((n, c) => n + listSubclasses(c).length, 0);
  const nonBh = total - listSubclasses('blood_hunter').length;
  check(total === nonBh + BLOOD_HUNTER_SUBCLASSES.length, `registry total (${total}) is non-BH total (${nonBh}) + 4 Orders`);
  check(total === 181, `registry total is 181 (169 + 8 warlord + 4 Orders, got ${total})`);
  for (const [name, features] of Object.entries(EXPECTED_FEATURES)) {
    const entry = getSubclass('blood_hunter', name);
    check(entry !== null, `${name} is in the registry`);
    check(entry?.selectionLevel === 3, `${name} selectionLevel derives to 3 (got ${entry?.selectionLevel})`);
    check(entry?.class === 'blood_hunter', `${name} is filed under blood_hunter`);
    for (const [fname, level] of features) {
      const f = (entry?.features || []).find((x) => x.name === fname);
      check(f !== undefined, `${name} has ${fname}`);
      check(f?.level === level, `${name} ${fname} is at level ${level} (got ${f?.level})`);
    }
    const levels = [...new Set((entry?.features || []).map((f) => f.level))].sort((a, b) => a - b);
    check(JSON.stringify(levels) === JSON.stringify([3, 7, 11, 15, 18]),
      `${name} features land only at 3/7/11/15/18 (got ${levels.join(',')})`);
  }
  check(getSubclass('blood_hunter', 'Order of the Warlord') === null, 'no Warlord entry is smuggled into blood_hunter');
  // Warlord is a separate sibling batch (8 Presences, landed 2026-11-06);
  // its coverage is pinned by tests/warlord-subclasses.test.js, not here —
  // this suite only pins that the merged registry holds its 8 alongside BH.
  check(listSubclasses('warlord').length === 8, `warlord registry holds its 8 Presences (got ${listSubclasses('warlord').length})`);
  check(validateClassSubclass({ classId: 'blood_hunter', subclassId: 'Order of the Ghostslayer' }).ok === true,
    'validateClassSubclass accepts blood_hunter + Ghostslayer (now a known class)');
}

// ===========================================================================
// (b) Mutant: 20 formulas, prerequisites, formula/creation counts
// ===========================================================================
group('(b) Mutant — 20 formulas, prerequisites, counts');
{
  const mutant = getSubclass('blood_hunter', 'Order of the Mutant');
  const formulas = mutant.features.find((f) => f.key === 'mutagen_formulas');
  const list = formulas?.mechanics?.formulas || [];
  check(list.length === 20, `20 mutagen formulas (got ${list.length})`);
  const names = list.map((f) => f.name);
  for (const n of ['Aether', 'Alluring', 'Celerity', 'Conversant', 'Cruelty', 'Deftness', 'Embers', 'Gelid', 'Impermeable', 'Mobility', 'Nighteye', 'Percipient', 'Potency', 'Precision', 'Rapidity', 'Reconstruction', 'Sagacity', 'Shielded', 'Unbreakable', 'Vermillion']) {
    check(names.includes(n), `formula ${n} present`);
  }
  check(new Set(names).size === 20, 'no duplicate formula names');
  for (const [n, prereq] of [['Aether', '11th level'], ['Cruelty', '11th level'], ['Precision', '11th level'], ['Reconstruction', '7th level']]) {
    check(list.find((f) => f.name === n)?.prerequisite === prereq, `${n} prerequisite is ${prereq}`);
  }
  for (const f of list) {
    check(typeof f.effect === 'string' && f.effect.length > 0, `${f.name} has an effect`);
    check(typeof f.sideEffect === 'string' && f.sideEffect.length > 0, `${f.name} has a side effect`);
  }
  const craft = mutant.features.find((f) => f.key === 'mutagencraft');
  check(JSON.stringify(craft?.mechanics?.formulasKnownByLevel) === JSON.stringify({ 3: 4, 7: 5, 11: 6, 15: 7, 18: 8 }),
    'formulas known 4/5/6/7/8 at 3/7/11/15/18');
  check(JSON.stringify(craft?.mechanics?.mutagensCreatedByLevel) === JSON.stringify({ 3: 1, 7: 2, 11: 2, 15: 3, 18: 3 }),
    'mutagens created 1/2/2/3/3 at 3/7/11/15/18');
}

// ===========================================================================
// (c) Profane Soul: patron subchoices + spell tables
// ===========================================================================
group('(c) Profane Soul — patron choices + spell tables');
{
  const ps = getSubclass('blood_hunter', 'Order of the Profane Soul');
  const patronChoice = (ps.choices || []).find((c) => c.key === 'patron');
  check(patronChoice !== undefined, 'Profane Soul declares a patron choice');
  check(patronChoice?.level === 3, 'patron choice is at level 3');
  check(JSON.stringify(patronChoice?.options) === JSON.stringify(['The Archfey', 'The Celestial', 'The Fiend', 'The Great Old One']),
    'patron options are exactly the 4 PDF patrons');
  for (const p of ['The Archfey', 'The Celestial', 'The Fiend', 'The Great Old One']) {
    check(validateChoice('blood_hunter', 'Order of the Profane Soul', 'patron', p).valid === true, `patron ${p} validates`);
  }
  for (const p of ['The Undying', 'The Hexblade']) {
    check(validateChoice('blood_hunter', 'Order of the Profane Soul', 'patron', p).valid === false, `patron ${p} is refused (not in the PDF)`);
  }
  // Spell tables, level by level from the PDF's Profane Soul table.
  const EXPECTED_SLOTS = { 3: [1, 1], 4: [1, 1], 5: [1, 1], 6: [2, 1], 7: [2, 2], 10: [2, 2], 12: [2, 2], 13: [2, 3], 18: [2, 3], 19: [2, 4], 20: [2, 4] };
  for (const [lvl, [slots, slotLevel]] of Object.entries(EXPECTED_SLOTS)) {
    const s = getSpellSlots('blood_hunter', Number(lvl), 'Order of the Profane Soul');
    check(s.slots === slots && s.level === slotLevel, `Profane Soul L${lvl}: ${slots} slot(s) at level ${slotLevel} (got ${JSON.stringify(s)})`);
  }
  check(JSON.stringify(getSpellSlots('blood_hunter', 2, 'Order of the Profane Soul')) === JSON.stringify({}),
    'Profane Soul L2 has no slots (casting begins at 3rd)');
  check(JSON.stringify(getSpellSlots('blood_hunter', 7, 'Order of the Ghostslayer')) === JSON.stringify({}),
    'Ghostslayer never has slots');
  check(getCantripsKnown('blood_hunter', 3, 'Order of the Profane Soul') === 2, 'Profane Soul cantrips 2 at 3rd');
  check(getCantripsKnown('blood_hunter', 9, 'Order of the Profane Soul') === 2, 'Profane Soul cantrips still 2 at 9th');
  check(getCantripsKnown('blood_hunter', 10, 'Order of the Profane Soul') === 3, 'Profane Soul cantrips 3 at 10th');
  check(getCantripsKnown('blood_hunter', 20, 'Order of the Profane Soul') === 3, 'Profane Soul cantrips 3 at 20th');
  check(getCantripsKnown('blood_hunter', 10, 'Order of the Lycan') === 0, 'Lycan has no cantrips');
  const EXPECTED_PREPARED = { 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6, 12: 6, 13: 7, 14: 7, 15: 8, 16: 8, 17: 9, 18: 9, 19: 10, 20: 11 };
  for (const [lvl, count] of Object.entries(EXPECTED_PREPARED)) {
    check(getSpellsPrepared('blood_hunter', Number(lvl), 3, 'Order of the Profane Soul') === count,
      `Profane Soul prepares ${count} at L${lvl}`);
  }
  check(getSpellsPrepared('blood_hunter', 2, 3, 'Order of the Profane Soul') === null, 'Profane Soul L2 prepares null (no casting yet)');
  check(getSpellsPrepared('blood_hunter', 10, 3, 'Order of the Mutant') === null, 'Mutant never prepares spells');
  check(spellcastingAbilityFor('blood_hunter', 'Order of the Profane Soul') === 'int', 'Profane Soul casts with Intelligence');
  check(spellcastingAbilityFor('blood_hunter', 'Order of the Ghostslayer') === null, 'Ghostslayer has no casting ability');
  // Tables exported from levelProgression agree with the PDF spot checks.
  check(PROFANE_SOUL_CANTRIPS_KNOWN[2] === 2 && PROFANE_SOUL_CANTRIPS_KNOWN[9] === 3, 'PROFANE_SOUL_CANTRIPS_KNOWN table shape');
  check(PROFANE_SOUL_SPELLS_PREPARED[2] === 2 && PROFANE_SOUL_SPELLS_PREPARED[19] === 11, 'PROFANE_SOUL_SPELLS_PREPARED table shape');
  check(PROFANE_SOUL_SPELL_SLOTS[3].slots === 1 && PROFANE_SOUL_SPELL_SLOTS[6].slots === 2 && PROFANE_SOUL_SPELL_SLOTS[19].level === 4,
    'PROFANE_SOUL_SPELL_SLOTS table shape');
  // Always-prepared patron spells (Revealed L7 / Unsealed L15).
  const revealed = ps.features.find((f) => f.key === 'revealed_arcana');
  check(JSON.stringify(revealed?.mechanics?.alwaysPreparedByPatron) === JSON.stringify({
    'The Archfey': ['Blur'], 'The Celestial': ['Lesser Restoration'],
    'The Fiend': ['Scorching Ray'], 'The Great Old One': ['Detect Thoughts'],
  }), 'Revealed Arcana spells by patron (Blur / Lesser Restoration / Scorching Ray / Detect Thoughts)');
  const unsealed = ps.features.find((f) => f.key === 'unsealed_arcana');
  check(JSON.stringify(unsealed?.mechanics?.alwaysPreparedByPatron) === JSON.stringify({
    'The Archfey': ['Slow'], 'The Celestial': ['Revivify'],
    'The Fiend': ['Fireball'], 'The Great Old One': ['Haste'],
  }), 'Unsealed Arcana spells by patron (Slow / Revivify / Fireball / Haste)');
  // canLearnSpell: Warlock list only, slot-level cap, 3rd+.
  const PS = 'Order of the Profane Soul';
  check(canLearnSpell({ classId: 'blood_hunter', level: 3, spellName: 'hex', subclass: PS }).ok === true, 'Profane Soul L3 can learn Hex (Warlock 1st)');
  check(canLearnSpell({ classId: 'blood_hunter', level: 3, spellName: 'eldritch blast', subclass: PS }).ok === true, 'Profane Soul L3 can learn Eldritch Blast (Warlock cantrip)');
  check(canLearnSpell({ classId: 'blood_hunter', level: 7, spellName: 'darkness', subclass: PS }).ok === true, 'Profane Soul L7 can learn Darkness (Warlock 2nd, slot level 2)');
  check(canLearnSpell({ classId: 'blood_hunter', level: 7, spellName: 'counterspell', subclass: PS }).ok === false, 'Profane Soul L7 cannot learn Counterspell (3rd-level, above slot level 2)');
  check(canLearnSpell({ classId: 'blood_hunter', level: 13, spellName: 'hunger of hadar', subclass: PS }).ok === true, 'Profane Soul L13 can learn Hunger of Hadar (Warlock 3rd, slot level 3)');
  check(canLearnSpell({ classId: 'blood_hunter', level: 13, spellName: 'fireball', subclass: PS }).ok === false, 'Profane Soul L13 cannot PICK Fireball (no Warlock tag in the catalog — Unsealed Arcana GRANTS it instead)');
  check(canLearnSpell({ classId: 'blood_hunter', level: 2, spellName: 'hex', subclass: PS }).ok === false, 'Profane Soul L2 cannot learn spells (casting begins at 3rd)');
  check(canLearnSpell({ classId: 'blood_hunter', level: 7, spellName: 'hex', subclass: 'Order of the Ghostslayer' }).ok === false, 'Ghostslayer cannot learn spells (never casts)');
  check(canLearnSpell({ classId: 'blood_hunter', level: 7, spellName: 'hex' }).ok === false, 'Blood Hunter with no subclass cannot learn spells');
  check(canLearnSpell({ classId: 'blood_hunter', level: 7, spellName: 'fireball' }).ok === false, 'Blood Hunter with no subclass cannot learn Fireball either');
}

// ===========================================================================
// (d) Base-class corrections (PDF wins over the old client data)
// ===========================================================================
group('(d) base-class corrections — PDF vs old client data');
{
  check(SUBCLASS_LEVELS.blood_hunter === 3, 'SUBCLASS_LEVELS: blood_hunter 3');
  check(HIT_DICE.blood_hunter === 10, 'HIT_DICE: blood_hunter d10 (was falling back to d8)');
  const bh = CLASS_FEATURES.blood_hunter;
  check(JSON.stringify(bh[1]) === JSON.stringify(["Hunter's Bane", 'Blood Maledict', 'Weapon Mastery']), 'CLASS_FEATURES L1: Hunter\'s Bane / Blood Maledict / Weapon Mastery');
  check(JSON.stringify(bh[2]) === JSON.stringify(['Fighting Style', 'Crimson Rite']), 'CLASS_FEATURES L2');
  check(JSON.stringify(bh[3]) === JSON.stringify(['Blood Hunter Order']), 'CLASS_FEATURES L3: Blood Hunter Order');
  check(JSON.stringify(bh[5]) === JSON.stringify(['Extra Attack', 'Rite Focus']), 'CLASS_FEATURES L5: Extra Attack / Rite Focus');
  check(JSON.stringify(bh[6]) === JSON.stringify(['Brand of Castigation', 'Blood Maledict (2 uses)']), 'CLASS_FEATURES L6');
  check(JSON.stringify(bh[7]) === JSON.stringify(['Subclass Feature', 'Primal Rite']), 'CLASS_FEATURES L7');
  check(JSON.stringify(bh[9]) === JSON.stringify(['Grim Psychometry']), 'CLASS_FEATURES L9: Grim Psychometry');
  check(JSON.stringify(bh[10]) === JSON.stringify(['Dark Augmentation']), 'CLASS_FEATURES L10: Dark Augmentation');
  check(JSON.stringify(bh[13]) === JSON.stringify(['Brand of Tethering', 'Blood Maledict (3 uses)']), 'CLASS_FEATURES L13');
  check(JSON.stringify(bh[14]) === JSON.stringify(['Hardened Soul', 'Esoteric Rite']), 'CLASS_FEATURES L14');
  check(JSON.stringify(bh[17]) === JSON.stringify(['Blood Maledict (4 uses)']), 'CLASS_FEATURES L17');
  check(JSON.stringify(bh[19]) === JSON.stringify(['Epic Boon']), 'CLASS_FEATURES L19: Epic Boon');
  check(JSON.stringify(bh[20]) === JSON.stringify(['Sanguine Mastery']), 'CLASS_FEATURES L20: Sanguine Mastery');
  check(getClassFeatures('blood_hunter', 3).includes('Blood Hunter Order'), 'getClassFeatures L3 returns Blood Hunter Order');
  // Client classes.json corrections.
  const cj = classes.blood_hunter;
  check(JSON.stringify(cj.primaryAbility) === JSON.stringify(['str', 'dex', 'int']),
    'classes.json primaryAbility is Str/Dex + Int (was Int only)');
  check(cj.hitDie === 10 && JSON.stringify(cj.savingThrows) === JSON.stringify(['dex', 'int']), 'classes.json hit die 10, saves Dex/Int');
  const darkAug = cj.features.find((f) => f.startsWith('Dark Augmentation'));
  check(darkAug.includes('10 feet') && darkAug.includes('Strength, Dexterity, and Constitution'),
    'Dark Augmentation blurb: +10 feet, Str/Dex/Con saves (was +5 feet, Int/Wis/Cha)');
  const cjText = JSON.stringify(cj);
  check(!cjText.includes('Undying') && !cjText.includes('Hexblade'), 'no Undying/Hexblade patrons anywhere in the BH client entry');
  check(!cjText.includes('Hunger of Hadar'), 'Great Old One Unsealed Arcana is Haste, not Hunger of Hadar');
  check(!cjText.includes('charm resistance') && !cjText.includes('psychic messaging'), 'invented Rite Focus benefits are gone');
  check(cjText.includes('reroll 1s and 2s'), 'Fiend Rite Focus is the PDF reroll-1s-and-2s benefit');
  check(cjText.includes('Frightened until the end of your next turn') || cjText.includes('frightened until the end of your next turn'),
    'Great Old One Rite Focus is the PDF Frightened benefit');
  const gs = cj.subclasses.find((s) => s.name === 'Order of the Ghostslayer');
  const aether = gs.featuresByLevel['7'][0].description;
  check(aether.startsWith('At the start of your turn') && !aether.includes('bonus action'),
    'Aether Walk starts at the start of your turn (was "as a bonus action")');
  check(!aether.includes('Material Plane'), 'Aether Walk no longer claims Material Plane sight');
  check(aether.includes('Ethereal Plane'), 'Aether Walk sees/affects the Ethereal Plane');
  const mu = cj.subclasses.find((s) => s.name === 'Order of the Mutant');
  check(mu.featuresByLevel['15'][0].description.includes('again each time it fails'),
    'Blood Curse of Corrosion amplify repeats on failed saves (was "start of each turn")');
  check(mu.featuresByLevel['18'][0].description.includes('Intelligence modifier (minimum of once)'),
    'Exalted Mutation uses Intelligence modifier (was "Hemocraft modifier")');
  check(JSON.stringify(cj.startingEquipment.given).includes("Alchemist's Supplies"),
    'starting equipment includes Alchemist\'s Supplies (PDF option A)');
  check(cj.startingEquipment.choices.length === 0, 'starting equipment has no invented choice forks (PDF option A is a fixed bundle)');
  check(cj.startingGold.average === 100, 'starting gold average 100 (PDF option B)');
}

// ===========================================================================
// (e) Multiclass free (prerequisites removed 2026-11-08); Profane
// Soul + Warlock third-rule
// ===========================================================================
group('(e) multiclass free + Profane Soul/Warlock rule');
{
  // Every class is offered, no ability-score gate — a fighter is
  // offered blood_hunter, and the requirement table and the check
  // function are gone.
  check(getAvailableMulticlassOptions([{ class: 'fighter', level: 2 }]).includes('blood_hunter'),
    'blood_hunter is offered as a multiclass option (prerequisites removed)');
  check(lp.MULTICLASS_REQUIREMENTS === undefined && lp.meetsMulticlassRequirements === undefined,
    'MULTICLASS_REQUIREMENTS / meetsMulticlassRequirements are gone');
  check(CASTER_TYPE.blood_hunter === 'profane', "CASTER_TYPE.blood_hunter is 'profane'");
  const PS = 'Order of the Profane Soul';
  // Profane Soul 9 + Warlock 5: 5 + floor(9/3)=3 → Warlock 8 (2 slots, 4th level).
  const combined = getMulticlassSpellSlots([
    { class: 'blood_hunter', level: 9, subclass: PS },
    { class: 'warlock', level: 5 },
  ], {});
  check(JSON.stringify(combined.pactMagic) === JSON.stringify({ slots: 2, level: 4 }),
    `Profane Soul 9 + Warlock 5 → Warlock 8 pact slots (got ${JSON.stringify(combined.pactMagic)})`);
  // Profane Soul 3 + Warlock 2: 2 + 1 → Warlock 3 (2 slots, 2nd level).
  const combined2 = getMulticlassSpellSlots([
    { class: 'blood_hunter', level: 3, subclass: PS },
    { class: 'warlock', level: 2 },
  ], {});
  check(JSON.stringify(combined2.pactMagic) === JSON.stringify({ slots: 2, level: 2 }),
    `Profane Soul 3 + Warlock 2 → Warlock 3 pact slots (got ${JSON.stringify(combined2.pactMagic)})`);
  // Profane Soul 5 + Warlock 5: floor(5/3)=1 → Warlock 6 (2 slots, 3rd level).
  const combined3 = getMulticlassSpellSlots([
    { class: 'blood_hunter', level: 5, subclass: PS },
    { class: 'warlock', level: 5 },
  ], {});
  check(JSON.stringify(combined3.pactMagic) === JSON.stringify({ slots: 2, level: 3 }),
    `Profane Soul 5 + Warlock 5 → Warlock 6 pact slots (got ${JSON.stringify(combined3.pactMagic)})`);
  // Profane Soul alone keeps its own table (no warlock to combine with).
  const alone = getMulticlassSpellSlots([{ class: 'blood_hunter', level: 3, subclass: PS }], {});
  check(JSON.stringify(alone.pactMagic) === JSON.stringify({ slots: 1, level: 1 }), 'Profane Soul 3 alone keeps its own pact slots');
  // Ghostslayer adds nothing to a warlock's pact slots.
  const ghost = getMulticlassSpellSlots([
    { class: 'blood_hunter', level: 9, subclass: 'Order of the Ghostslayer' },
    { class: 'warlock', level: 5 },
  ], {});
  check(JSON.stringify(ghost.pactMagic) === JSON.stringify({ slots: 2, level: 3 }),
    'Ghostslayer 9 + Warlock 5 → plain Warlock 5 pact slots (no third-rule)');
  // Combined level caps at 20 (Warlock table max).
  const capped = getMulticlassSpellSlots([
    { class: 'blood_hunter', level: 18, subclass: PS },
    { class: 'warlock', level: 20 },
  ], {});
  check(JSON.stringify(capped.pactMagic) === JSON.stringify({ slots: 4, level: 5 }),
    `Profane Soul 18 + Warlock 20 caps at Warlock 20 (got ${JSON.stringify(capped.pactMagic)})`);
  // Multiclass grant (proficiencies gained), per the PDF.
  check(BLOOD_HUNTER_MULTICLASS_GRANT.hitDie === 10, 'multiclass grant hit die d10');
  check(JSON.stringify(BLOOD_HUNTER_MULTICLASS_GRANT.armor) === JSON.stringify(['light', 'medium', 'shields']), 'multiclass grant armor light/medium/shields');
  check(JSON.stringify(BLOOD_HUNTER_MULTICLASS_GRANT.weapons) === JSON.stringify(['simple', 'martial']), 'multiclass grant weapons simple/martial');
  check(JSON.stringify(BLOOD_HUNTER_MULTICLASS_GRANT.tools) === JSON.stringify(["Alchemist's Supplies"]), "multiclass grant tool Alchemist's Supplies");
}

// ===========================================================================
// (f) HTTP: GET /api/subclasses + GET /api/spells for blood_hunter
// ===========================================================================
group('(f) HTTP — /api/subclasses and /api/spells serve blood_hunter');
{
  const all = await req('GET', '/api/subclasses');
  check(all.status === 200, 'GET /api/subclasses is 200');
  const bhList = all.json?.subclassesByClass?.blood_hunter;
  check(Array.isArray(bhList) && bhList.length === 4, `GET /api/subclasses lists 4 blood_hunter Orders (got ${bhList?.length})`);
  check(bhList?.map((e) => e.name).join('|') === 'Order of the Ghostslayer|Order of the Lycan|Order of the Mutant|Order of the Profane Soul',
    'GET /api/subclasses blood_hunter names are the 4 Orders in PDF order');
  check(bhList?.every((e) => e.selectionLevel === 3) === true, 'GET /api/subclasses blood_hunter selectionLevel is 3 on every entry');
  const one = await req('GET', '/api/subclasses/blood_hunter');
  check(one.status === 200, 'GET /api/subclasses/blood_hunter is 200');
  check(one.json?.subclasses?.length === 4, 'GET /api/subclasses/blood_hunter returns 4');
  const ps = one.json?.subclasses?.find((e) => e.key === 'profane_soul');
  check(Array.isArray(ps?.choices) && ps.choices[0]?.options?.length === 4, 'GET /api/subclasses/blood_hunter Profane Soul carries the 4-option patron choice');
  const wl = await req('GET', '/api/subclasses/warlord');
  check(wl.status === 200 && wl.json?.subclasses?.length === 8, 'GET /api/subclasses/warlord serves the sibling batch (8 Presences)');

  const psSpells = await req('GET', '/api/spells?class=blood_hunter&subclass=Order%20of%20the%20Profane%20Soul&level=3&abilityMod=3');
  check(psSpells.status === 200, 'GET /api/spells for Profane Soul L3 is 200');
  check(psSpells.json?.cantripsKnown === 2, 'spells route: Profane Soul L3 cantripsKnown 2');
  check(psSpells.json?.spellsPrepared === 2, 'spells route: Profane Soul L3 spellsPrepared 2');
  check(psSpells.json?.spellcastingAbility === 'int', 'spells route: Profane Soul ability int');
  check(psSpells.json?.spells?.some((s) => s.key === 'hex') === true, 'spells route: Profane Soul L3 list includes Hex');
  check(psSpells.json?.spells?.some((s) => s.key === 'fireball') === false, 'spells route: Profane Soul L3 list excludes Fireball (not Warlock-tagged)');
  const ghostSpells = await req('GET', '/api/spells?class=blood_hunter&subclass=Order%20of%20the%20Ghostslayer&level=7&abilityMod=3');
  check(ghostSpells.status === 200, 'GET /api/spells for Ghostslayer L7 is 200');
  check(ghostSpells.json?.cantripsKnown === 0 && ghostSpells.json?.spellsPrepared === null, 'spells route: Ghostslayer has no cantrips/prepared');
  check(ghostSpells.json?.spells?.length === 0, 'spells route: Ghostslayer spell list is empty');
  const bhL1 = await req('GET', '/api/spells?class=blood_hunter&level=1');
  check(bhL1.status === 200 && bhL1.json?.spellsPrepared === null && bhL1.json?.spells?.length === 0,
    'spells route: blood_hunter L1 has no spells (non-caster at level 1)');
}

// ===========================================================================
// (g) Level-up: prompts at 3rd, 422 gate, subclass write; warlord prompts
// at 1st (its SUBCLASS_LEVELS entry landed 2026-11-06 — gaps-batch item
// 8b; coordinator ruling: third-party classes follow their own books)
// ===========================================================================
group('(g) level-up prompts at 3rd; warlord prompts at 1st');
{
  check(needsSubclassSelection('blood_hunter', 3) === true, 'blood_hunter prompts at 3rd');
  check(needsSubclassSelection('blood_hunter', 1) === false, 'blood_hunter does NOT prompt at 1st');
  check(needsSubclassSelection('blood_hunter', 2) === false, 'blood_hunter does NOT prompt at 2nd');
  check(SUBCLASS_LEVELS.warlord === 1, 'warlord is in SUBCLASS_LEVELS at 1 (staged patch landed 2026-11-06)');
  check(needsSubclassSelection('warlord', 1) === true, 'warlord prompts at 1st (Presence choice)');
  check(needsSubclassSelection('warlord', 3) === false, 'warlord does NOT prompt at 3rd');

  const bh2 = await makeLeveled({ name: 'BhTwo', cls: 'blood_hunter', level: 2, xp: XP.to3 });
  const info2 = await req('GET', `/api/character/level-up-info/${bh2}`);
  check(info2.status === 200, 'blood_hunter L2 info loads');
  check(existingOption(info2)?.choices.needsSubclass === true, 'blood_hunter 2->3: needsSubclass true');
  check(existingOption(info2)?.subclassLevel === 3, 'blood_hunter 2->3: subclassLevel 3');
  check(existingOption(info2)?.newFeatures?.includes('Blood Hunter Order') === true, 'blood_hunter 2->3: newFeatures lists Blood Hunter Order');
  check(existingOption(info2)?.hpGain?.hitDie === 10, 'blood_hunter 2->3: hpGain hit die d10');
  const bh1 = await makeLeveled({ name: 'BhOne', cls: 'blood_hunter', level: 1, xp: XP.to2 });
  const info1 = await req('GET', `/api/character/level-up-info/${bh1}`);
  check(existingOption(info1)?.choices.needsSubclass === false, 'blood_hunter 1->2: needsSubclass false');
  check(existingOption(info1)?.subclassLevel === 3, 'blood_hunter 1->2: subclassLevel still 3');

  // Multiclass option on a fighter: blood_hunter is listed, with its
  // grant surfaced (2026-11-08: the requirement fields are gone —
  // prerequisites removed, all classes multiclass freely).
  const fighter1 = await makeLeveled({ name: 'FighterBh', cls: 'fighter', level: 1, xp: XP.to2 });
  const fighterInfo = await req('GET', `/api/character/level-up-info/${fighter1}`);
  const bhOpt = multiclassOption(fighterInfo, 'blood_hunter');
  check(bhOpt !== undefined, 'multiclass option exists for blood_hunter');
  check(bhOpt?.choices.needsSubclass === false, 'multiclass into blood_hunter: no subclass at class level 1');
  check(bhOpt?.subclassLevel === 3, 'multiclass into blood_hunter: subclassLevel 3');
  check(bhOpt?.requirements === undefined && bhOpt?.bloodHunterRequirements === undefined,
    'multiclass into blood_hunter: requirement fields are gone (prerequisites removed)');
  check(bhOpt?.multiclassGrant?.hitDie === 10, 'multiclass into blood_hunter: grant hit die d10');

  // POST: 2->3 without a subclass is refused, row untouched.
  const refused = await req('POST', `/api/character/level-up/${bh2}`, {});
  check(refused.status === 422, 'blood_hunter 2->3 without subclass: 422');
  check(String(refused.json?.error || '').includes('Subclass selection required'), 'blood_hunter 2->3 refusal names the subclass requirement');
  const refusedRow = await readCharacter(bh2);
  check(refusedRow.level === 2 && refusedRow.subclass === null, 'refused level-up leaves the row unchanged');
  // POST: 2->3 with a real Order succeeds and persists the subclass.
  const ok = await req('POST', `/api/character/level-up/${bh2}`, { subclass: 'Order of the Ghostslayer' });
  check(ok.status === 200, 'blood_hunter 2->3 with Order of the Ghostslayer: 200');
  const okRow = await readCharacter(bh2);
  check(okRow.level === 3, 'blood_hunter row is level 3 after the level-up');
  check(okRow.subclass === 'Order of the Ghostslayer', 'blood_hunter row stores Order of the Ghostslayer (legacy field)');
  const okLevels = JSON.parse(okRow.class_levels || '[]');
  check(okLevels[0]?.subclass === 'Order of the Ghostslayer', 'blood_hunter class_levels stores Order of the Ghostslayer');
  // POST: 1->2 without a subclass succeeds (no prompt before 3rd).
  const bh1Up = await req('POST', `/api/character/level-up/${bh1}`, {});
  check(bh1Up.status === 200, 'blood_hunter 1->2 without subclass: 200');
  const bh1Row = await readCharacter(bh1);
  check(bh1Row.level === 2 && bh1Row.subclass === null, 'blood_hunter 1->2 leaves subclass null');
}

server.close();
console.log(`\n blood-hunter-subclasses: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
