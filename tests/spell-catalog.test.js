// ============================================================
// spell-catalog.test.js — v1.0.193 catalog completion
// The full 2024 PHB + official-expansion spell list: every entry
// complete, every save resolvable, every effect spec sane.
// Pure data test — no database.
// ============================================================

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = await import(pathToFileURL(path.join(ROOT, 'server/data/spellCatalog.js')).href);

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n${name}`); }

const { SPELL_CATALOG, SPELL_EFFECTS, SPELL_SAVES, spellSaveAbility, spellEffectSpec, lookupSpell } = catalog;
const names = Object.keys(SPELL_CATALOG);

group('1. scale — the whole list, every level');
assert(names.length >= 500, `catalog holds the full list (${names.length} spells, floor 500)`);
const byLevel = {};
for (const s of Object.values(SPELL_CATALOG)) byLevel[s.level] = (byLevel[s.level] || 0) + 1;
const floors = { 0: 40, 1: 70, 2: 75, 3: 65, 4: 45, 5: 55, 6: 40, 7: 25, 8: 20, 9: 18 };
for (const [lvl, floor] of Object.entries(floors)) {
  assert((byLevel[lvl] || 0) >= floor, `level ${lvl}: ${byLevel[lvl] || 0} spells (floor ${floor})`);
}

group('2. completeness — every entry has every field');
const CLASSES = new Set(['Artificer', 'Bard', 'Blackguard', 'Cleric', 'Druid', 'Magus', 'Paladin', 'Ranger', 'Sorcerer', 'Spellshot', 'Warlock', 'Wizard']);
const SAVES = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
const CONDS = new Set(['blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious']);
let badFields = 0, badClasses = 0, badSave = 0, badCond = 0, badDesc = 0;
for (const [name, s] of Object.entries(SPELL_CATALOG)) {
  if (!(typeof s.level === 'number' && s.level >= 0 && s.level <= 9 && s.school && s.castTime && s.range
    && Array.isArray(s.components) && s.components.length > 0 && s.duration
    && typeof s.concentration === 'boolean' && typeof s.ritual === 'boolean' && s.source)) badFields++;
  if (!(Array.isArray(s.classes) && s.classes.length > 0 && s.classes.every(c => CLASSES.has(c)))) badClasses++;
  if (s.save && !SAVES.has(s.save)) badSave++;
  if (s.appliesCondition && !CONDS.has(s.appliesCondition)) badCond++;
  if (!(typeof s.description === 'string' && s.description.length >= 30 && !/TODO|lorem/i.test(s.description))) badDesc++;
}
assert(badFields === 0, `all entries carry level/school/castTime/range/components/duration/flags/source (${badFields} bad)`);
assert(badClasses === 0, `all entries carry valid class lists (${badClasses} bad)`);
assert(badSave === 0 && badCond === 0, `all save/condition fields use legal values (${badSave} saves, ${badCond} conditions bad)`);
assert(badDesc === 0, `all entries carry a real description (${badDesc} bad)`);

group('3. saves resolve through the derived map');
let saveMismatch = 0;
for (const [name, s] of Object.entries(SPELL_CATALOG)) {
  if (s.save && spellSaveAbility(name) !== s.save) saveMismatch++;
  if (!s.save && spellSaveAbility(name)) saveMismatch++;
}
assert(saveMismatch === 0, `spellSaveAbility agrees with every entry's save field (${saveMismatch} mismatches)`);
assert(Object.keys(SPELL_SAVES).length >= 200, `derived SPELL_SAVES covers ${Object.keys(SPELL_SAVES).length} save spells`);
assert(spellSaveAbility('Fireball') === 'dex' && spellSaveAbility('Hold Person') === 'wis' && spellSaveAbility('Sacred Flame') === 'dex', 'classic saves intact');
assert(spellSaveAbility('Power Word Kill') === null, 'Power Word Kill has no save');
assert(spellSaveAbility('Counterspell') === 'con', 'Counterspell is a Constitution save in 2024');
assert(spellSaveAbility('Sleep') === 'wis', 'Sleep is a Wisdom save in 2024 (no HP pool)');

group('4. every damage/healing effect resolves to a sane spec');
let fxBad = 0, fxOrphan = 0;
for (const key of Object.keys(SPELL_EFFECTS)) {
  if (!SPELL_CATALOG[key]) { fxOrphan++; continue; }
  const spec = spellEffectSpec(key, { slotLevel: SPELL_CATALOG[key].level, casterLevel: 5 });
  if (!spec) { fxBad++; continue; }
  if (spec.flat) {
    if (!(spec.flatAmount === 'full' || (typeof spec.flatAmount === 'number' && spec.flatAmount > 0))) fxBad++;
  } else if (!(spec.count >= 1 && spec.sides >= 2 && spec.sides <= 100)) fxBad++;
}
assert(fxOrphan === 0, `every effect belongs to a catalog entry (${fxOrphan} orphans)`);
assert(fxBad === 0, `every effect produces a sane spec (${fxBad} bad of ${Object.keys(SPELL_EFFECTS).length})`);

group('5. spot checks — the famous and the corrected');
assert(lookupSpell('Wish')?.level === 9 && lookupSpell('Wish').classes.includes('Wizard'), 'Wish exists at 9th level');
const ms = spellEffectSpec('Meteor Swarm', {});
assert(ms && ms.count === 40 && ms.sides === 6 && /fire/.test(ms.damageType), 'Meteor Swarm is 40d6 fire/bludgeoning');
const fb = spellEffectSpec('Fireball', {});
assert(fb && fb.count === 8 && fb.sides === 6, 'Fireball is still 8d6');
const tw = spellEffectSpec('Thunderwave', {});
assert(tw && tw.count === 2 && tw.sides === 8, 'Thunderwave is 2d8 (assembly-verified against the 2024 PHB)');
const iw = spellEffectSpec('Inflict Wounds', {});
assert(iw && iw.count === 3 && iw.sides === 10 && iw.damageOnSave === 'half' && spellSaveAbility('Inflict Wounds') === 'con', 'Inflict Wounds is the 2024 save spell: CON, 3d10, half on success');
const cw2 = spellEffectSpec('Cure Wounds', { slotLevel: 2 });
assert(cw2 && cw2.spec === '4d8', 'Cure Wounds upcasts +2d8 per slot in 2024');
const heal = spellEffectSpec('Heal', {});
assert(heal && heal.flat === true && heal.flatAmount === 70, 'Heal is a flat 70');
const mh = spellEffectSpec('Mass Heal', {});
assert(mh && mh.flat === true && mh.flatAmount === 700, 'Mass Heal is a flat 700');
const ct = spellEffectSpec('Chill Touch', { casterLevel: 1 });
assert(ct && ct.count === 1 && ct.sides === 10 && lookupSpell('Chill Touch').range === 'Touch', 'Chill Touch is the 2024 melee 1d10 cantrip');
const vm = spellEffectSpec('Vicious Mockery', { casterLevel: 1 });
assert(vm && vm.sides === 6, 'Vicious Mockery deals d6s in 2024');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
