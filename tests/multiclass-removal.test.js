// tests/multiclass-removal.test.js — multiclass prerequisites removal
// (Zach, 2026-11-08, main chat: all classes multiclass freely, no
// ability-score gates). Honest-integration rules: every assertion calls
// the REAL levelProgression.js / magusService.js / pugilistService.js /
// scholarService.js / LevelUpPage.jsx source. Nothing here re-implements
// service logic; deleting a service file makes this suite fail at import.
// Coverage: the option list offers all 23 classes (minus held ones);
// the requirements table + both check functions are gone; the grants
// (magus / blood_hunter / scholar / pugilist / warlord) still exist and
// the new warlord grant has the right shape; slot math is untouched
// (Magus still contributes 0); subclass-level gates still fire; the
// client list + hit-die map cover all 23 with server values, and the
// deferred classes render disabled, not hidden.
// What this does NOT cover (honest scope): the level-up-info HTTP route
// (covered by levelup-subclass-prompts + mvp-class-scope tests, which
// run against the real DB/route), the POST /level-up refusal for
// deferred classes (mvp-class-scope group (d)), or the client render
// itself (static guards below assert the source, not the DOM).
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;

const F = await import(svc('server/config/levelProgression.js'));
const magus = await import(svc('server/services/magusService.js'));
const pugilist = await import(svc('server/services/pugilistService.js'));
const scholar = await import(svc('server/services/scholarService.js'));
const clientClasses = JSON.parse(fs.readFileSync(path.join(REPO, 'client/src/data/classes.json'), 'utf8'));
const levelUpSrc = fs.readFileSync(path.join(REPO, 'client/src/components/LevelUpPage.jsx'), 'utf8');

const ALL_23 = Object.keys(F.CLASS_FEATURES);
assert.equal(ALL_23.length, 23, `CLASS_FEATURES must hold all 23 classes (got ${ALL_23.length})`);

// --- 1. The option list offers every class, minus held ones ---
{
  const fighterHeld = F.getAvailableMulticlassOptions([{ class: 'fighter', level: 2 }]);
  assert.equal(fighterHeld.length, 22, 'all 23 minus the held fighter');
  assert.ok(!fighterHeld.includes('fighter'), 'held class excluded');
  for (const cls of ['spellshot', 'warden', 'duelist', 'blackguard']) {
    assert.ok(fighterHeld.includes(cls), `${cls} is offered now (no requirements key hid it)`);
  }
  for (const cls of ['magus', 'blackguard', 'scholar']) {
    assert.ok(fighterHeld.includes(cls), `${cls} stays offered server-side (flagged, not removed — POST guard enforces)`);
  }
  const twoHeld = F.getAvailableMulticlassOptions([
    { class: 'fighter', level: 2 }, { class: 'rogue', level: 1 },
  ]);
  assert.equal(twoHeld.length, 21, 'two held classes excluded');
  assert.deepEqual([...fighterHeld].sort(), [...ALL_23.filter((c) => c !== 'fighter')].sort(),
    'options are exactly CLASS_FEATURES minus held');
  assert.equal(F.getAvailableMulticlassOptions([]).length, 23, 'a fresh character is offered all 23');
}

// --- 2. The table + both check functions are gone ---
assert.equal(F.MULTICLASS_REQUIREMENTS, undefined);
assert.equal(F.meetsMulticlassRequirements, undefined);
assert.equal(magus.meetsMagusMulticlassRequirements, undefined);
assert.equal(magus.SOCIETY_MULTICLASS_ABILITY, undefined);
assert.equal(pugilist.MULTICLASS_REQUIREMENTS, undefined);
// What stays: the casting ability per society (a different thing) and
// every grant.
assert.equal(magus.SOCIETY_SPELLCASTING_ABILITY.arcane_order, 'int');
assert.equal(magus.SOCIETY_SPELLCASTING_ABILITY.sylvan_circle, 'wis');
assert.deepEqual(magus.MULTICLASS_GRANT,
  { hitDie: 8, armor: ['light', 'medium', 'shields'], weapons: ['simple', 'martial'] });
assert.deepEqual(F.BLOOD_HUNTER_MULTICLASS_GRANT,
  { hitDie: 10, armor: ['light', 'medium', 'shields'], weapons: ['simple', 'martial'], tools: ["Alchemist's Supplies"] });

// --- 3. Grants: scholar + pugilist surfaced, warlord built ---
assert.deepEqual(F.WARLORD_MULTICLASS_GRANT, { hitDie: 8, armor: ['light', 'medium'] });
assert.equal(scholar.MULTICLASS_GRANT.hitDie, 6);
assert.deepEqual(scholar.MULTICLASS_GRANT.armor, ['light']);
assert.equal(scholar.MULTICLASS_GRANT.skillChoices, 1);
assert.equal(scholar.MULTICLASS_GRANT.skillOptions.length, 12);
assert.deepEqual(pugilist.MULTICLASS_GRANT,
  { hitDie: 8, armor: ['light'], weapons: ['improvised'] });

// --- 4. Slot math untouched (the rule covers prerequisites, not slots) ---
assert.deepEqual(F.getMulticlassSpellSlots([{ class: 'magus', level: 3 }]).spellSlots, {},
  'Magus still contributes 0 multiclass spell slots (source states no slot rule)');
assert.deepEqual(F.getMulticlassSpellSlots([{ class: 'fighter', level: 5 }]).spellSlots, {},
  'a non-caster still contributes 0');
assert.equal(F.CASTER_TYPE.blackguard, 'half', 'Blackguard half-caster table-shape fact unchanged');

// --- 5. Subclass-level gates still fire (separate machinery, untouched) ---
assert.equal(F.needsSubclassSelection('fighter', 3), true);
assert.equal(F.needsSubclassSelection('cleric', 1), false);
assert.equal(F.needsSubclassSelection('magus', 1), true);
assert.equal(F.needsSubclassSelection('scholar', 1), true);
assert.equal(F.needsSubclassSelection('wizard', 1), false);

// --- 6. Client static guards: list + hit dice cover all 23 ---
assert.ok(levelUpSrc.includes('Object.keys(classesData)'),
  'ALL_CLASSES is derived from classes.json keys, not a hardcoded 14');
assert.ok(!levelUpSrc.includes("'Sorcerer', 'Warlock', 'Wizard'\n]"),
  'the hardcoded 14-class list is gone');
const hitDiceBlock = levelUpSrc.match(/const HIT_DICE = \{([\s\S]*?)\n\}/);
assert.ok(hitDiceBlock, 'HIT_DICE block found in LevelUpPage.jsx');
const clientDice = Object.fromEntries(
  [...hitDiceBlock[1].matchAll(/([a-z_]+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]),
);
assert.equal(Object.keys(clientDice).length, 23, 'client HIT_DICE covers all 23 classes');
for (const cls of ALL_23) {
  assert.equal(clientDice[cls], F.HIT_DICE[cls],
    `client HIT_DICE.${cls} (${clientDice[cls]}) matches server (${F.HIT_DICE[cls]})`);
}
// Deferred classes render disabled, not hidden — same pattern as the
// deferred subclasses in this file.
assert.ok(levelUpSrc.includes('deferredMulticlassOptions'),
  'deferred multiclass options are collected for the note line');
assert.ok(levelUpSrc.includes("pcCreatable === false ? ' deferred' : ''") ||
  levelUpSrc.includes('pcCreatable === false'),
  'deferred multiclass cards carry the deferred treatment');
// The gray-out set is exactly magus / blackguard / scholar in classes.json.
const deferred = Object.keys(clientClasses).filter((k) => clientClasses[k].pcCreatable === false);
assert.deepEqual(deferred.sort(), ['blackguard', 'magus', 'scholar']);

console.log('multiclass-removal: all assertions passed');
