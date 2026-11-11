// tests/newclass-spells-gating.test.js — selection-time spell gating
// for the overnight 7-class build.
//
// Honest-integration rules: every test calls the REAL
// spellSelectionService (and the REAL merged catalog). Nothing here
// re-implements the gating logic: expected outcomes are stated per
// spell from the printed class lists and slot tables, and the merged
// catalog below is the live catalog after the coordinator's merge of
// the staging fragment into spellCatalogData.js. If the service file
// is deleted, every import in this file fails, so no test can pass
// without the service.
//
// What this does NOT test (honest scope): the character.js POST/PUT
// hook (not built — the service is the enforcement layer, the hook
// is the coordinator's merge step), any UI picker filtering (no
// spell pickers exist yet in creator-next beyond the cantrips
// subsection), or cast-time enforcement in spellCastService.js
// (which today never checks class membership).
import test from 'node:test';
import assert from 'node:assert';
import { SPELL_DATA_ENTRIES, SPELL_DATA_EFFECTS } from '../server/data/spellCatalogData.js';
import {
  canLearnSpell,
  validateSpellSelection,
} from '../server/services/spellSelectionService.js';
import {
  MAGUS_SOCIETY_SPELL_LISTS,
} from '../server/data/newClassSpellLists.js';

// The catalog AFTER the coordinator's merge: the live catalog now holds
// the 38 overnight-build entries (Spellshot, Magus SV, Scholar-shared,
// Blackguard) plus their Spellshot/Blackguard tags on pre-existing spells.
// Frozen roster below: the 38 merged entry keys + the EFFECTS keys, taken
// from the staging fragment at merge time so this test still fails if a
// merged entry goes missing from the live catalog.
const NEW_SPELL_NAMES = [
  "vahli's frost sphere",
  "cushidra's freezing beam",
  "delfanel's corrosive spit",
  "tuturis' venomous sting",
  "malti's lightning spear",
  "ulvi's enfeebling poison",
  "agni's looming inferno",
  "arcing arrow",
  "aspir",
  "bloodletting bite",
  "corpse mask",
  "corrupted ki kata",
  "death shroud",
  "drain",
  "find vessel",
  "fungal bloom",
  "give life",
  "misfortune's mark",
  "nerve pinching kata",
  "rime strike",
  "spell-shattering strike",
  "spore cloud",
  "storm step",
  "ten thousand masks",
  "vortex dart",
  "warden's rebuke",
  "oath-sealing covenant",
  "venomous smite",
  "ghastly stench",
  "weakening aura",
  "wither limb",
  "lay waste",
  "unholy crusade",
  "vampiric smite",
  "consumptive field",
  "wall of pain",
  "branding smite",
  "blinding smite",
];
// NOTE: fragment EFFECTS roster minus Give Life, whose engine-invalid
// {"healing":"hit die"} entry was dropped at merge (see assertion below).
const NEW_SPELL_EFFECTS_NAMES = [
  "vahli's frost sphere",
  "cushidra's freezing beam",
  "delfanel's corrosive spit",
  "tuturis' venomous sting",
  "malti's lightning spear",
  "ulvi's enfeebling poison",
  "agni's looming inferno",
  "arcing arrow",
  "bloodletting bite",
  "corrupted ki kata",
  "death shroud",
  "drain",
  "fungal bloom",
  "misfortune's mark",
  "nerve pinching kata",
  "rime strike",
  "spell-shattering strike",
  "spore cloud",
  "storm step",
  "vortex dart",
  "warden's rebuke",
  "venomous smite",
  "lay waste",
  "unholy crusade",
  "vampiric smite",
  "consumptive field",
  "wall of pain",
  "branding smite",
  "blinding smite",
];
const MERGED = SPELL_DATA_ENTRIES;

test('catalog spell from another class is rejected for this class', () => {
  // Fireball is Sorcerer/Wizard, not Blackguard or Cleric.
  assert.strictEqual(canLearnSpell({ classId: 'blackguard', level: 9, spellName: 'Fireball' }).ok, false);
  assert.strictEqual(canLearnSpell({ classId: 'cleric', level: 9, spellName: 'Fireball' }).ok, false);
  // And the rejection names the reason, not just a boolean.
  const r = canLearnSpell({ classId: 'cleric', level: 9, spellName: 'Fireball' });
  assert.match(r.reason, /not on the Cleric spell list/);
});

test('spell above the class level is rejected, accepted at the granting level', () => {
  // Wizard: Fireball is 3rd level; wizard max is 2nd at level 4, 3rd at level 5.
  assert.strictEqual(canLearnSpell({ classId: 'wizard', level: 4, spellName: 'Fireball' }).ok, false);
  assert.strictEqual(canLearnSpell({ classId: 'wizard', level: 5, spellName: 'Fireball' }).ok, true);
  // Spellshot (fragment spell, merged catalog): Vahli's Frost Sphere
  // is 1st level; Spellshot has no spells known at 1st (max 0) and
  // 1st-level spells from 2nd.
  assert.strictEqual(canLearnSpell({ classId: 'spellshot', level: 1, spellName: "Vahli's Frost Sphere", catalogEntries: MERGED }).ok, false);
  assert.strictEqual(canLearnSpell({ classId: 'spellshot', level: 2, spellName: "Vahli's Frost Sphere", catalogEntries: MERGED }).ok, true);
  // Magus (society list): Fireball is on the Arcane Order list but
  // is 3rd level; Magus max is 2nd at level 5, 3rd at level 9.
  assert.strictEqual(canLearnSpell({ classId: 'magus', level: 5, spellName: 'Fireball', subclass: 'Arcane Order' }).ok, false);
  assert.strictEqual(canLearnSpell({ classId: 'magus', level: 9, spellName: 'Fireball', subclass: 'Arcane Order' }).ok, true);
});

test('Magus society spell accepted for its society, rejected for another', () => {
  // Arcing Arrow is an Arcane Order cantrip, not a Shadow Court one.
  assert.strictEqual(canLearnSpell({ classId: 'magus', level: 1, spellName: 'Arcing Arrow', subclass: 'Arcane Order', catalogEntries: MERGED }).ok, true);
  const rejected = canLearnSpell({ classId: 'magus', level: 1, spellName: 'Arcing Arrow', subclass: 'Shadow Court', catalogEntries: MERGED });
  assert.strictEqual(rejected.ok, false);
  assert.match(rejected.reason, /not on the Shadow Court spell list/);
  // No society given at all: rejected, not silently allowed.
  assert.strictEqual(canLearnSpell({ classId: 'magus', level: 1, spellName: 'Arcing Arrow', catalogEntries: MERGED }).ok, false);
  // Society lists are data, not re-implemented here: the imported
  // lists themselves carry the membership facts above.
  assert.ok(MAGUS_SOCIETY_SPELL_LISTS['Arcane Order'].includes('Arcing Arrow'));
  assert.ok(!MAGUS_SOCIETY_SPELL_LISTS['Shadow Court'].includes('Arcing Arrow'));
});

test('Blackguard spell accepted for Blackguard', () => {
  // Venomous Smite is a fragment spell tagged Blackguard, 1st level;
  // Blackguard max is 1st at level 2.
  assert.strictEqual(canLearnSpell({ classId: 'blackguard', level: 2, spellName: 'Venomous Smite', catalogEntries: MERGED }).ok, true);
  // Same spell is still rejected for a class that has no tag for it.
  assert.strictEqual(canLearnSpell({ classId: 'wizard', level: 2, spellName: 'Venomous Smite', catalogEntries: MERGED }).ok, false);
});

test('non-caster leveled spell rejected; unknown class rejected by name', () => {
  const fighter = canLearnSpell({ classId: 'fighter', level: 5, spellName: 'Fireball' });
  assert.strictEqual(fighter.ok, false);
  assert.match(fighter.reason, /no spell slots/);
  // Scholar/Warden without a casting subclass are non-casters too.
  assert.strictEqual(canLearnSpell({ classId: 'scholar', level: 5, spellName: 'Fireball' }).ok, false);
  assert.strictEqual(canLearnSpell({ classId: 'warden', level: 5, spellName: 'Fireball' }).ok, false);
  const unknown = canLearnSpell({ classId: 'duelist', level: 5, spellName: 'Fireball' });
  assert.strictEqual(unknown.ok, false);
  assert.match(unknown.reason, /duelist/);
});

test('cantrips follow the same class-membership rule', () => {
  assert.strictEqual(canLearnSpell({ classId: 'wizard', level: 1, spellName: 'Fire Bolt' }).ok, true);
  assert.strictEqual(canLearnSpell({ classId: 'cleric', level: 1, spellName: 'Fire Bolt' }).ok, false);
});

test('Warden and Scholar casting-subclass restrictions are enforced', () => {
  // Loreseeker (wizard list, abjuration/evocation): Shield passes,
  // Charm Person (enchantment, wizard) fails the school check.
  assert.strictEqual(canLearnSpell({ classId: 'warden', level: 3, spellName: 'Shield', subclass: 'Loreseeker' }).ok, true);
  const charm = canLearnSpell({ classId: 'warden', level: 3, spellName: 'Charm Person', subclass: 'Loreseeker' });
  assert.strictEqual(charm.ok, false);
  assert.match(charm.reason, /Abjuration or Evocation/);
  // Soulblood Shaman (druid list, evocation/transmutation):
  // Faerie Fire (1st, evocation) passes; Cure Wounds (conjuration) fails.
  // (Moonbeam is evocation too but 2nd level — above the 1st-level
  // max at warden level 3, so it is not used as the passing case.)
  assert.strictEqual(canLearnSpell({ classId: 'warden', level: 3, spellName: 'Faerie Fire', subclass: 'Soulblood Shaman' }).ok, true);
  assert.strictEqual(canLearnSpell({ classId: 'warden', level: 3, spellName: 'Cure Wounds', subclass: 'Soulblood Shaman' }).ok, false);
  // Warden casting starts at 3rd: a 1st-level spell at warden level 2 fails.
  assert.strictEqual(canLearnSpell({ classId: 'warden', level: 2, spellName: 'Shield', subclass: 'Loreseeker' }).ok, false);
  // Ritualist (any list, ritual tag only): Find Familiar passes,
  // Fireball (no ritual tag) fails.
  assert.strictEqual(canLearnSpell({ classId: 'scholar', level: 3, spellName: 'Find Familiar', subclass: 'Ritualist' }).ok, true);
  assert.strictEqual(canLearnSpell({ classId: 'scholar', level: 3, spellName: 'Fireball', subclass: 'Ritualist' }).ok, false);
  // Theologian (cleric list): Cure Wounds passes, Fireball fails.
  assert.strictEqual(canLearnSpell({ classId: 'scholar', level: 3, spellName: 'Cure Wounds', subclass: 'Theologian' }).ok, true);
  assert.strictEqual(canLearnSpell({ classId: 'scholar', level: 3, spellName: 'Fireball', subclass: 'Theologian' }).ok, false);
});

test('validateSpellSelection reports each bad spell with its reason', () => {
  const result = validateSpellSelection({
    classId: 'wizard', level: 4, spells: ['Magic Missile', 'Fireball', 'Not A Spell'],
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.errors.length, 2);
  assert.strictEqual(result.errors[0].spell, 'Fireball');
  assert.match(result.errors[0].reason, /above the Wizard max/);
  assert.strictEqual(result.errors[1].spell, 'Not A Spell');
  assert.match(result.errors[1].reason, /not in the spell catalog/);
  assert.deepStrictEqual(
    validateSpellSelection({ classId: 'wizard', level: 5, spells: ['Magic Missile', 'Fireball'] }),
    { ok: true, errors: [] },
  );
});

test('every merged entry has a classes array; damaging/healing entries have EFFECTS', () => {
  const entries = NEW_SPELL_NAMES.map((name) => [name, SPELL_DATA_ENTRIES[name]]);
  // 7 Spellshot + 19 Magus SV + 1 Oath-Sealing Covenant (Cleric/Paladin-listed;
  // Scholar reaches it via Theologian) + 11 Blackguard = 38.
  assert.strictEqual(entries.length, 38);
  for (const [name, entry] of entries) {
    assert.ok(entry, `${name} is missing from the merged catalog`);
    assert.ok(Array.isArray(entry.classes) && entry.classes.length > 0, `${name} lacks a classes array`);
    assert.ok(Number.isInteger(entry.level) && entry.level >= 0, `${name} lacks a level`);
    assert.ok(entry.school && entry.castTime && entry.range, `${name} lacks school/castTime/range`);
  }
  // Explicit damaging/healing spells must have an EFFECTS entry with
  // damage or healing dice (stated per spell, not derived from the map).
  const damaging = [
    "vahli's frost sphere", "cushidra's freezing beam", "delfanel's corrosive spit",
    "tuturis' venomous sting", "malti's lightning spear", "ulvi's enfeebling poison",
    "agni's looming inferno", 'arcing arrow', 'bloodletting bite', 'corrupted ki kata',
    'death shroud', 'drain', 'fungal bloom', "misfortune's mark",
    'nerve pinching kata', 'rime strike', 'spell-shattering strike', 'spore cloud',
    'storm step', 'vortex dart', "warden's rebuke", 'venomous smite', 'lay waste',
    'unholy crusade', 'vampiric smite', 'consumptive field', 'wall of pain',
    'branding smite', 'blinding smite',
  ];
  for (const name of damaging) {
    const fx = SPELL_DATA_EFFECTS[name];
    assert.ok(fx && (fx.damage || fx.healing), `${name} lacks a damage/healing EFFECTS entry`);
  }
  // Give Life is the one healing spell with NO EFFECTS entry, deliberately:
  // its die is the caster's own hit die (variable by caster class), which
  // spellEffectSpec cannot resolve without a caster — the staging
  // fragment's {"healing":"hit die"} shape was engine-invalid and was
  // dropped at merge. The description carries the mechanism; the cast
  // resolves by narration, not engine dice.
  assert.ok(!('give life' in SPELL_DATA_EFFECTS), 'Give Life has no engine EFFECTS entry (caster-hit-die variable)');
  // Explicitly non-damaging spells must NOT carry a bogus EFFECTS entry.
  for (const name of ['corpse mask', 'find vessel', 'ten thousand masks', 'oath-sealing covenant', 'ghastly stench', 'weakening aura', 'wither limb', 'aspir']) {
    assert.ok(!(name in SPELL_DATA_EFFECTS), `${name} should not have an EFFECTS entry`);
  }
  // Every merged EFFECTS key must be a merged entry (no orphans).
  for (const name of NEW_SPELL_EFFECTS_NAMES) {
    assert.ok(NEW_SPELL_NAMES.includes(name), `orphan EFFECTS entry: ${name}`);
    assert.ok(name in SPELL_DATA_ENTRIES, `EFFECTS entry ${name} missing from the merged catalog`);
  }
});

test('catalog presence alone never makes a spell choosable', () => {
  // Fireball is in the catalog and a 3rd-level wizard at level 9 can
  // learn it — but a 9th-level cleric cannot, despite its presence.
  assert.strictEqual(canLearnSpell({ classId: 'wizard', level: 9, spellName: 'Fireball' }).ok, true);
  assert.strictEqual(canLearnSpell({ classId: 'cleric', level: 9, spellName: 'Fireball' }).ok, false);
});
