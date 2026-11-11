// Additional Subclasses batch (Myths and Folklore Collection) — honest
// integration tests. Every assertion below goes through the REAL
// subclassService functions (listSubclasses / getSubclass / featuresAtLevel /
// clericDomainSpellsAtLevel / warlockPatronSpellsAtLevel /
// paladinOathSpellsAtLevel / sorcererSubclassSpellsAtLevel /
// druidCircleSpellsAtLevel / rangerSubclassSpellsAtLevel / validateChoice /
// validateChoiceList). No logic is re-implemented here: delete the service
// and every one of these tests fails at import or at lookup.
// Pre-existing-entry preservation is asserted by name (the named entries
// below must still resolve); pure-append proof is the diff of each edited
// file against its pre-edit backup, not this file — total counts below are
// the post-batch totals, not a substitute for that diff.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listSubclasses,
  getSubclass,
  featuresAtLevel,
  clericDomainSpellsAtLevel,
  warlockPatronSpellsAtLevel,
  paladinOathSpellsAtLevel,
  sorcererSubclassSpellsAtLevel,
  druidCircleSpellsAtLevel,
  rangerSubclassSpellsAtLevel,
  validateChoice,
  validateChoiceList,
} from '../server/services/subclassService.js';

const NEW_ENTRIES = [
  ['artificer', 'Lumberjack'],
  ['barbarian', 'Path of Adoration'],
  ['barbarian', 'Path of Giants'],
  ['bard', 'College of the Departed'],
  ['bard', 'College of the Weaver'],
  ['cleric', 'Fate Domain'],
  ['cleric', 'Sea Domain'],
  ['druid', 'Circle of the Unborn'],
  ['fighter', 'Islander'],
  ['monk', 'Way of Zhenren'],
  ['paladin', 'Oath of Charity'],
  ['ranger', 'Ferryman'],
  ['rogue', 'Fear'],
  ['sorcerer', 'Dreamer'],
  ['warlock', 'Many Faces'],
  ['warlock', 'Spiritual Guardian'],
  ['wizard', 'Runecrafter'],
];

// Post-batch totals: pre-batch counts (barbarian 7, bard 9, cleric 9,
// druid 8, fighter 10, monk 8, paladin 8, ranger 8, rogue 10, sorcerer 9,
// warlock 7, wizard 9, artificer 0) plus this batch's appends — and
// the creator-gaps batch (2026-11-06, item 24) added the five core
// artificer subclasses, so artificer is 6, not 1.
const POST_BATCH_TOTALS = {
  artificer: 6,
  barbarian: 9,
  bard: 11,
  cleric: 11,
  druid: 9,
  fighter: 11,
  monk: 9,
  paladin: 9,
  ranger: 9,
  rogue: 11,
  sorcerer: 10,
  warlock: 9,
  wizard: 10,
};

const PRE_EXISTING_SPOT_CHECKS = [
  ['barbarian', 'Path of the Berserker'],
  ['bard', 'College of Lore'],
  ['cleric', 'Life Domain'],
  ['druid', 'Circle of the Moon'],
  ['fighter', 'Champion'],
  ['monk', 'Warrior of the Open Hand'],
  ['paladin', 'Oath of Devotion'],
  ['ranger', 'Beast Master'],
  ['rogue', 'Thief'],
  ['sorcerer', 'Draconic Sorcery'],
  ['warlock', 'Fiend Patron'],
  ['wizard', 'Abjurer'],
];

test('all 17 new entries are listable under their parent class', () => {
  assert.equal(NEW_ENTRIES.length, 17);
  for (const [className, name] of NEW_ENTRIES) {
    const entry = getSubclass(className, name);
    assert.ok(entry, `${name} should resolve under ${className}`);
    assert.equal(entry.class, className);
    assert.equal(entry.name, name);
    assert.equal(entry.gateCheckRequired, true, `${name} must be gateCheckRequired`);
    assert.ok(Array.isArray(entry.features) && entry.features.length > 0);
    for (const f of entry.features) {
      for (const field of ['key', 'name', 'level', 'kind', 'mechanics', 'prompt', 'engine', 'gateCheck']) {
        assert.ok(f[field] !== undefined, `${name} feature ${f.key} missing ${field}`);
      }
      assert.equal(f.gateCheck, true);
    }
  }
});

test('post-batch totals per class, and no duplicate keys within a class', () => {
  for (const [className, total] of Object.entries(POST_BATCH_TOTALS)) {
    const list = listSubclasses(className);
    assert.equal(list.length, total, `${className} should list ${total} entries`);
    const keys = list.map((e) => e.key);
    assert.equal(new Set(keys).size, keys.length, `${className} has a duplicate subclass key`);
  }
});

test('pre-existing entries are still present', () => {
  for (const [className, name] of PRE_EXISTING_SPOT_CHECKS) {
    assert.ok(getSubclass(className, name), `${name} must still resolve under ${className}`);
  }
});

test('artificer lists Lumberjack + the five core subclasses (item 24 closed the [] gap)', () => {
  const list = listSubclasses('artificer');
  assert.equal(list.length, 6);
  assert.deepEqual(list.map((e) => e.name), ['Lumberjack', 'Alchemist', 'Armorer', 'Artillerist', 'Battle Smith', 'Cartographer']);
  assert.ok(list.every((e) => e.selectionLevel === 3));
});

test('selection levels are derived from the class record (item 29), not the as-printed first feature levels', () => {
  // Item 29 (2026-11-06): the per-entry selectionLevel field was
  // removed by design and the server derives it from SUBCLASS_LEVELS
  // (the class record) — so every entry here derives 3, including
  // the seven whose as-printed first features sat at 1st/2nd (Fate
  // Domain 1, Sea Domain 1, Circle of the Unborn 2, Dreamer 1, Many
  // Faces 1, Spiritual Guardian 1, Runecrafter 2). The as-printed
  // levels are history, not the rule.
  for (const [className, name] of NEW_ENTRIES) {
    assert.equal(getSubclass(className, name).selectionLevel, 3, name);
  }
});

test('spell-list accessors return the 2024-cadence tables through the real service', () => {
  assert.ok(clericDomainSpellsAtLevel('cleric', 'Fate Domain', 9).includes('Legend Lore'));
  // Item 29 re-pointed the 1st/2nd-level domain spells onto the 2024
  // 3rd-level cadence (1st+3rd tiers collapsed into the 3rd tier), so
  // Guiding Bolt / Fog Cloud arrive at 3rd, not 1st.
  assert.ok(clericDomainSpellsAtLevel('cleric', 'Fate Domain', 3).includes('Guiding Bolt'));
  assert.ok(clericDomainSpellsAtLevel('cleric', 'Sea Domain', 3).includes('Fog Cloud'));
  assert.ok(clericDomainSpellsAtLevel('cleric', 'Sea Domain', 9).includes('Maelstrom'));
  assert.ok(paladinOathSpellsAtLevel('paladin', 'Oath of Charity', 17).includes('Greater Restoration'));
  assert.ok(druidCircleSpellsAtLevel('druid', 'Circle of the Unborn', 9).includes('Reincarnate'));
  assert.ok(rangerSubclassSpellsAtLevel('ranger', 'Ferryman', 17).includes('Holy Weapon'));
  assert.ok(sorcererSubclassSpellsAtLevel('sorcerer', 'Dreamer', 15).includes('Demiplane'));
  assert.ok(warlockPatronSpellsAtLevel('warlock', 'Many Faces', 9).includes('Dominate Person'));
  assert.ok(warlockPatronSpellsAtLevel('warlock', 'Spiritual Guardian', 9).includes('Raise Dead'));
});

test('partial coverage: Sea Domain wires only spells + Potent Spellcasting', () => {
  const entry = getSubclass('cleric', 'Sea Domain');
  assert.ok(Array.isArray(entry.unresolved) && entry.unresolved.length === 4);
  const names = featuresAtLevel('cleric', 'Sea Domain', 20).map((f) => f.name);
  assert.deepEqual(names, ['Sea Domain Spells', 'Potent Spellcasting']);
});

test('partial coverage: Oath of Charity wires confirmed levels only, 15th/20th flagged', () => {
  const entry = getSubclass('paladin', 'Oath of Charity');
  assert.ok(Array.isArray(entry.unresolved) && entry.unresolved.length === 2);
  assert.equal(featuresAtLevel('paladin', 'Oath of Charity', 20).length, 4);
  assert.ok(!featuresAtLevel('paladin', 'Oath of Charity', 20).some((f) => f.level === 15 || f.level === 20));
});

test('partial coverage: Ferryman wires confirmed 3rd-level features only, rider flagged', () => {
  const entry = getSubclass('ranger', 'Ferryman');
  assert.ok(Array.isArray(entry.unresolved) && entry.unresolved.length === 4);
  assert.equal(featuresAtLevel('ranger', 'Ferryman', 20).length, 3);
  const soulCutter = featuresAtLevel('ranger', 'Ferryman', 3).find((f) => f.key === 'soul_cutter');
  assert.ok(String(soulCutter.mechanics.rider).startsWith('UNRESOLVED'));
  assert.equal(soulCutter.mechanics.extraDamage, '1d6 psychic or radiant, your choice');
  assert.equal(soulCutter.mechanics.at11th, '1d8');
});

test('partial coverage: Dreamer spells are wired as printed, with the 9th-to-15th jump', () => {
  const entry = getSubclass('sorcerer', 'Dreamer');
  assert.ok(Array.isArray(entry.unresolved) && entry.unresolved.length === 1);
  // No 11th/13th rows exist, so the cumulative list at 13th equals that at 9th.
  assert.deepEqual(
    sorcererSubclassSpellsAtLevel('sorcerer', 'Dreamer', 13),
    sorcererSubclassSpellsAtLevel('sorcerer', 'Dreamer', 9),
  );
  assert.ok(sorcererSubclassSpellsAtLevel('sorcerer', 'Dreamer', 15).includes('Demiplane'));
});

test('stored choices validate through the real service', () => {
  assert.equal(validateChoice('barbarian', 'Path of Giants', 'giant_type', 'Storm').valid, true);
  assert.equal(validateChoice('barbarian', 'Path of Giants', 'giant_type', 'Titan').valid, false);
  assert.equal(validateChoice('bard', 'College of the Weaver', 'weavers_attire_costume', 'Silky').valid, true);
  assert.equal(validateChoice('fighter', 'Islander', 'island_dweller_tool', "cook's utensils").valid, true);
  assert.equal(
    validateChoiceList('wizard', 'Runecrafter', 'runic_empowerment_runes', ['Alerune', 'Limrune']).valid,
    true,
  );
  assert.equal(
    validateChoiceList('wizard', 'Runecrafter', 'runic_empowerment_runes', ['Alerune', 'Alerune']).valid,
    false,
  );
});

test('new classes are indexed after the coordinator merge (no longer [])', () => {
  const expected = { spellshot: 4, warden: 15, magus: 6, pugilist: 6, scholar: 6, duelist: 3, blackguard: 5 };
  for (const [cls, n] of Object.entries(expected)) {
    assert.equal(listSubclasses(cls).length, n, `${cls} lists ${n} subclasses after the merge`);
  }
});
