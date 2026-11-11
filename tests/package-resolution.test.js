// tests/package-resolution.test.js — Stage 5 (Gear & Story) starting
// packages + resolver + starting-packages route + server theme gold
// modifiers.
//
// Honest integration tests: the REAL service, the REAL package data, the
// REAL equipment chapter module (server/data/equipment2024.js), and the
// REAL route over real HTTP. Nothing is re-implemented here — expected
// values are transcribed from the PHB Core Traits photos (see
// stage5-build/per-class-packages.md), the verbatim own-book lines in
// stage5-build/gold-baselines.md, and the Blood Hunter / Warlord PDF
// notes. If any real module were deleted, the imports fail and the suite
// fails with them.
//
// Runner contract (see server/scripts/run-tests.js): standalone ES
// module, prints "=== Results: N passed, M failed ===", exits 1 on
// failure.
import assert from 'node:assert';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = process.cwd();
const fromRepo = (rel) => pathToFileURL(path.join(repoRoot, rel)).href;

const service = await import(fromRepo('server/services/packageResolutionService.js'));
const { resolvePackage, validatePackageChoice, listPackageOptions, computeGoldFork, categoryMembers, resolveItemName } = service;
const { STARTING_PACKAGES } = await import(fromRepo('server/data/startingPackages.js'));
const { THEME_GOLD_MODIFIERS, applyGoldModifier } = await import(fromRepo('server/data/themeGoldModifiers.js'));
const startingPackagesRouter = (await import(fromRepo('server/routes/startingPackages.js'))).default;

// Canonicalise resolved items for comparison: sorted by name.
const norm = (items) => [...items].sort((a, b) => a.name.localeCompare(b.name));
const byName = (items) => Object.fromEntries(items.map((i) => [i.name, i.quantity]));
function expectItems(actual, expected, label) {
  check(JSON.stringify(norm(actual)) === JSON.stringify(norm(expected)), `${label}: got ${JSON.stringify(norm(actual))}, want ${JSON.stringify(norm(expected))}`);
}
function expectFieldError(result, field, label) {
  check(!result.ok && result.errors.some((e) => e.field === field),
    `${label}: expected a field "${field}" error, got ok=${result.ok} errors=${JSON.stringify(result.errors)}`);
}

// ------------------------------------------------------------------ (a)
// PHB 12 packages, pinned item-for-item from the Core Traits photos.
group('(a) PHB 12 packages (items + quantities + gold)');
{
  const cases = [
    ['barbarian', 'A', {}, [{ name: 'Greataxe', quantity: 1 }, { name: 'Handaxe', quantity: 4 }, { name: "Explorer's Pack", quantity: 1 }], 15],
    ['bard', 'A', { instrument: ['Lute'] }, [{ name: 'Leather', quantity: 1 }, { name: 'Dagger', quantity: 2 }, { name: 'Lute', quantity: 1 }, { name: "Entertainer's Pack", quantity: 1 }], 19],
    ['cleric', 'A', { holy: { alternative: 0 } }, [{ name: 'Chain Shirt', quantity: 1 }, { name: 'Shield', quantity: 1 }, { name: 'Mace', quantity: 1 }, { name: 'Amulet', quantity: 1 }, { name: "Priest's Pack", quantity: 1 }], 7],
    ['druid', 'A', {}, [{ name: 'Leather', quantity: 1 }, { name: 'Shield', quantity: 1 }, { name: 'Sickle', quantity: 1 }, { name: 'Wooden Staff', quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }, { name: 'Herbalism Kit', quantity: 1 }], 9],
    ['fighter', 'A', {}, [{ name: 'Chain Mail', quantity: 1 }, { name: 'Greatsword', quantity: 1 }, { name: 'Flail', quantity: 1 }, { name: 'Javelin', quantity: 8 }, { name: "Dungeoneer's Pack", quantity: 1 }], 4],
    ['fighter', 'B', {}, [{ name: 'Studded Leather', quantity: 1 }, { name: 'Scimitar', quantity: 1 }, { name: 'Shortsword', quantity: 1 }, { name: 'Longbow', quantity: 1 }, { name: 'Arrows (20)', quantity: 1 }, { name: 'Quiver', quantity: 1 }, { name: "Dungeoneer's Pack", quantity: 1 }], 11],
    ['monk', 'A', { toolOrInstrument: { alternative: 0 }, tool: ["Tinker's Tools"] }, [{ name: 'Spear', quantity: 1 }, { name: 'Dagger', quantity: 5 }, { name: "Tinker's Tools", quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }], 11],
    ['paladin', 'A', { holy: { alternative: 1 } }, [{ name: 'Chain Mail', quantity: 1 }, { name: 'Shield', quantity: 1 }, { name: 'Longsword', quantity: 1 }, { name: 'Javelin', quantity: 6 }, { name: 'Emblem', quantity: 1 }, { name: "Priest's Pack", quantity: 1 }], 9],
    ['ranger', 'A', {}, [{ name: 'Studded Leather', quantity: 1 }, { name: 'Scimitar', quantity: 1 }, { name: 'Shortsword', quantity: 1 }, { name: 'Longbow', quantity: 1 }, { name: 'Arrows (20)', quantity: 1 }, { name: 'Quiver', quantity: 1 }, { name: 'Sprig of Mistletoe', quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }], 7],
    ['rogue', 'A', {}, [{ name: 'Leather', quantity: 1 }, { name: 'Dagger', quantity: 2 }, { name: 'Shortsword', quantity: 1 }, { name: 'Shortbow', quantity: 1 }, { name: 'Arrows (20)', quantity: 1 }, { name: 'Quiver', quantity: 1 }, { name: "Thieves' Tools", quantity: 1 }, { name: "Burglar's Pack", quantity: 1 }], 8],
    ['sorcerer', 'A', {}, [{ name: 'Spear', quantity: 1 }, { name: 'Dagger', quantity: 2 }, { name: 'Crystal', quantity: 1 }, { name: "Dungeoneer's Pack", quantity: 1 }], 28],
    ['warlock', 'A', {}, [{ name: 'Leather', quantity: 1 }, { name: 'Sickle', quantity: 1 }, { name: 'Dagger', quantity: 2 }, { name: 'Orb', quantity: 1 }, { name: 'Book', quantity: 1 }, { name: "Scholar's Pack", quantity: 1 }], 15],
    ['wizard', 'A', {}, [{ name: 'Dagger', quantity: 2 }, { name: 'Staff', quantity: 1 }, { name: 'Robe', quantity: 1 }, { name: 'Spellbook', quantity: 1 }, { name: "Scholar's Pack", quantity: 1 }], 5],
  ];
  for (const [cls, opt, picks, items, gold] of cases) {
    const r = resolvePackage(cls, opt, picks);
    check(r.ok, `${cls} ${opt} resolves ok (errors: ${JSON.stringify(r.errors)})`);
    expectItems(r.items, items, `${cls} ${opt} items`);
    check(r.gold === gold, `${cls} ${opt} gold ${r.gold} === ${gold}`);
  }
  // Fighter is the only class with three options; its gold option is (C).
  check(STARTING_PACKAGES.fighter.options.map((o) => o.id).join(',') === 'A,B', 'fighter has options A,B');
  check(STARTING_PACKAGES.fighter.goldOption === 155, 'fighter goldOption 155 (C)');
  // Monk instrument branch (the other side of the tool/instrument fork).
  const monkInst = resolvePackage('monk', 'A', { toolOrInstrument: { alternative: 1 }, instrument: ['Lute'] });
  check(monkInst.ok && byName(monkInst.items).Lute === 1, 'monk instrument branch grants Lute');
  // Cleric holy-symbol third alternative.
  const clericRel = resolvePackage('cleric', 'A', { holy: { alternative: 2 } });
  check(clericRel.ok && byName(clericRel.items).Reliquary === 1, 'cleric holy symbol alternative 2 grants Reliquary');
}

// ------------------------------------------------------------------ (b)
// All 11 non-PHB options present, resolved end to end.
group('(b) Non-PHB 11 options present');
{
  const cases = [
    ['artificer', { c1: { alternative: 0 }, c2: { alternative: 1 }, c3: { alternative: 0 } },
      [{ name: 'Light Crossbow', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 1 }, { name: 'Scale Mail', quantity: 1 }, { name: "Dungeoneer's Pack", quantity: 1 }, { name: "Thieves' Tools", quantity: 1 }, { name: "Tinker's Tools", quantity: 1 }], 0],
    ['artificer', { c1: { alternative: 1 }, c1b: ['Mace'], c2: { alternative: 0 }, c3: { alternative: 1 } },
      [{ name: 'Mace', quantity: 1 }, { name: 'Studded Leather', quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }, { name: "Thieves' Tools", quantity: 1 }, { name: "Tinker's Tools", quantity: 1 }], 0],
    ['blackguard', { c1: { alternative: 0 }, c1a: ['Longsword'], c2: { alternative: 0 }, c3: { alternative: 1 }, holy: { alternative: 2 } },
      [{ name: 'Longsword', quantity: 1 }, { name: 'Shield', quantity: 1 }, { name: 'Javelin', quantity: 5 }, { name: "Explorer's Pack", quantity: 1 }, { name: 'Chain Mail', quantity: 1 }, { name: 'Reliquary', quantity: 1 }], 0],
    ['blackguard', { c1: { alternative: 1 }, c1b: ['Battleaxe', 'Warhammer'], c2: { alternative: 1 }, c2b: ['Mace'], c3: { alternative: 0 }, holy: { alternative: 0 } },
      [{ name: 'Battleaxe', quantity: 1 }, { name: 'Warhammer', quantity: 1 }, { name: 'Mace', quantity: 1 }, { name: "Priest's Pack", quantity: 1 }, { name: 'Chain Mail', quantity: 1 }, { name: 'Amulet', quantity: 1 }], 0],
    ['blood_hunter', { weapons: ['Longsword', 'Battleaxe'] },
      [{ name: 'Studded Leather', quantity: 1 }, { name: 'Longsword', quantity: 1 }, { name: 'Battleaxe', quantity: 1 }, { name: 'Light Crossbow', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 1 }, { name: "Alchemist's Supplies", quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }], 8],
    ['duelist', { c1: { alternative: 2 }, c2: { alternative: 0 }, c3: { alternative: 1 }, gamingSet: ['Dragonchess'] },
      [{ name: 'Sabre', quantity: 1 }, { name: 'Chain Shirt', quantity: 1 }, { name: "Dungeoneer's Pack", quantity: 1 }, { name: 'Dagger', quantity: 5 }, { name: 'Dragonchess', quantity: 1 }], 0],
    ['keeper', { c1: { alternative: 0 }, c2: { alternative: 1 } },
      [{ name: 'Shortsword', quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }, { name: 'Leather', quantity: 1 }, { name: "Calligrapher's Supplies", quantity: 1 }, { name: 'A Worn Leather-Bound Journal', quantity: 1 }, { name: 'Dagger', quantity: 2 }], 0],
    ['magus', { c1: { alternative: 2 }, c2: { alternative: 1 }, c3: { alternative: 0 }, c3a: { alternative: 3 } },
      [{ name: 'Longbow', quantity: 1 }, { name: 'Arrows (20)', quantity: 1 }, { name: 'Scale Mail', quantity: 1 }, { name: 'Staff', quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }], 0],
    ['magus', { c1: { alternative: 0 }, c1a: ['Spear'], c2: { alternative: 0 }, c3: { alternative: 1 }, c3b: { alternative: 1 } },
      [{ name: 'Spear', quantity: 1 }, { name: 'Shield', quantity: 1 }, { name: 'Leather', quantity: 1 }, { name: 'Wooden Staff', quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }], 0],
    ['magus', { c1: { alternative: 1 }, c1b: ['Rapier'], c2: { alternative: 0 }, c3: { alternative: 2 } },
      [{ name: 'Rapier', quantity: 1 }, { name: 'Leather', quantity: 1 }, { name: 'Component Pouch', quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }], 0],
    ['pugilist', { c1: { alternative: 1 }, c1b: ['Club'], c2: { alternative: 0 }, c3: { alternative: 2 } },
      [{ name: 'Club', quantity: 1 }, { name: "Dungeoneer's Pack", quantity: 1 }, { name: "Thieves' Tools", quantity: 1 }], 0],
    ['pugilist', { c1: { alternative: 0 }, c2: { alternative: 1 }, c3: { alternative: 0 }, c3a: ["Smith's Tools"] },
      [{ name: 'Leather', quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }, { name: "Smith's Tools", quantity: 1 }], 0],
    ['scholar', { c1: { alternative: 0 }, c1a: ['Mace'], c2: { alternative: 1 }, tools: ["Thieves' Tools", 'Herbalism Kit'] },
      [{ name: 'Leather', quantity: 1 }, { name: 'Mace', quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }, { name: 'Book', quantity: 1 }, { name: "Scholar's Pack", quantity: 1 }, { name: "Thieves' Tools", quantity: 1 }, { name: 'Herbalism Kit', quantity: 1 }], 0],
    ['scholar', { c1: { alternative: 2 }, c2: { alternative: 0 }, tools: ['Dice', 'Playing Cards'] },
      [{ name: 'Heavy Crossbow', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 1 }, { name: "Diplomat's Pack", quantity: 1 }, { name: 'Book', quantity: 1 }, { name: "Scholar's Pack", quantity: 1 }, { name: 'Dice', quantity: 1 }, { name: 'Playing Cards', quantity: 1 }], 0],
    ['spellshot', { c1: { alternative: 0 }, c2: { alternative: 1 } },
      [{ name: 'Dagger', quantity: 1 }, { name: "Dungeoneer's Pack", quantity: 1 }, { name: 'Pistol', quantity: 1 }, { name: 'Leather', quantity: 1 }, { name: "Alchemist's Supplies", quantity: 1 }, { name: "Tinker's Tools", quantity: 1 }, { name: 'Ball Bearings', quantity: 1 }], 5],
    ['spellshot', { c1: { alternative: 1 }, c1b: ['Spear'], c2: { alternative: 0 } },
      [{ name: 'Spear', quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }, { name: 'Pistol', quantity: 1 }, { name: 'Leather', quantity: 1 }, { name: "Alchemist's Supplies", quantity: 1 }, { name: "Tinker's Tools", quantity: 1 }, { name: 'Ball Bearings', quantity: 1 }], 5],
    ['warden', { c1: { alternative: 1 }, c2: { alternative: 0 }, c3: { alternative: 0 }, weapon: ['Longsword'] },
      [{ name: 'Leather', quantity: 1 }, { name: 'Spear', quantity: 1 }, { name: 'Light Hammer', quantity: 2 }, { name: "Dungeoneer's Pack", quantity: 1 }, { name: 'Shield', quantity: 1 }, { name: 'Longsword', quantity: 1 }], 0],
    ['warden', { c1: { alternative: 2 }, c2: { alternative: 1 }, c2b: ['Handaxe'], c3: { alternative: 1 }, weapon: ['Greataxe'] },
      [{ name: 'Chain Mail', quantity: 1 }, { name: 'Handaxe', quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }, { name: 'Shield', quantity: 1 }, { name: 'Greataxe', quantity: 1 }], 0],
    ['warlord', { c1: { alternative: 0 }, c1a: ['Spear'], c2: { alternative: 0 }, c3: { alternative: 2 }, c4: { alternative: 1 } },
      [{ name: 'Spear', quantity: 1 }, { name: 'Light Crossbow', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 1 }, { name: 'Chain Mail', quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }], 0],
    ['warlord', { c1: { alternative: 1 }, c1b: ['Longsword'], c2: { alternative: 1 }, c3: { alternative: 1 }, c4: { alternative: 0 } },
      [{ name: 'Longsword', quantity: 1 }, { name: 'Shield', quantity: 1 }, { name: 'Scale Mail', quantity: 1 }, { name: "Scholar's Pack", quantity: 1 }], 0],
  ];
  for (const [cls, picks, items, gold] of cases) {
    const r = resolvePackage(cls, 'A', picks);
    check(r.ok, `${cls} A resolves ok (errors: ${JSON.stringify(r.errors)})`);
    expectItems(r.items, items, `${cls} A items`);
    check(r.gold === gold, `${cls} A gold ${r.gold} === ${gold}`);
  }
  // Every class has at least one option; 23 classes total.
  check(Object.keys(STARTING_PACKAGES).length === 23, `23 classes in STARTING_PACKAGES (got ${Object.keys(STARTING_PACKAGES).length})`);
  for (const [cls, pkg] of Object.entries(STARTING_PACKAGES)) {
    check(pkg.options.length >= 1, `${cls} has >= 1 option`);
    check(pkg.options.every((o) => typeof o.gold === 'number'), `${cls} options all carry a gold number`);
  }
}

// ------------------------------------------------------------------ (c)
// The six gold-silent classes have null goldOptions; the other 17 have values.
group('(c) Gold options: six null, seventeen valued');
{
  const nulls = ['blackguard', 'magus', 'pugilist', 'scholar', 'spellshot', 'warden'];
  for (const cls of nulls) {
    check(STARTING_PACKAGES[cls].goldOption === null, `${cls} goldOption is null`);
  }
  const valued = {
    barbarian: 75, bard: 90, cleric: 110, druid: 50, fighter: 155, monk: 50,
    paladin: 150, ranger: 150, rogue: 100, sorcerer: 50, warlock: 100, wizard: 55,
    artificer: 125, blood_hunter: 100, duelist: 125, keeper: 100, warlord: 125,
  };
  for (const [cls, gold] of Object.entries(valued)) {
    check(STARTING_PACKAGES[cls].goldOption === gold, `${cls} goldOption ${STARTING_PACKAGES[cls].goldOption} === ${gold}`);
  }
  // Package gold and goldOption never stack: the resolver returns the
  // package gold; the fork is a separate call.
  const ranger = resolvePackage('ranger', 'A', {});
  check(ranger.gold === 7 && STARTING_PACKAGES.ranger.goldOption === 150, 'ranger package gold 7 is separate from goldOption 150');
  const spellshot = resolvePackage('spellshot', 'A', { c1: { alternative: 0 }, c2: { alternative: 0 } });
  check(spellshot.gold === 5 && STARTING_PACKAGES.spellshot.goldOption === null, 'spellshot package gold 5 is separate from null goldOption');
}

// ------------------------------------------------------------------ (d)
// Dedup: an item in both a choice and the given list is granted once.
group('(d) Dedup (choice + given granted once)');
{
  // Keeper is given two daggers; picking Dagger as the simple weapon
  // must not add a second Dagger row — one row, greater quantity wins.
  const r = resolvePackage('keeper', 'A', { c1: { alternative: 1 }, c1b: ['Dagger'], c2: { alternative: 0 } });
  check(r.ok, `keeper dagger-pick resolves ok (errors: ${JSON.stringify(r.errors)})`);
  const daggers = r.items.filter((i) => i.name === 'Dagger');
  check(daggers.length === 1, `keeper Dagger appears once (got ${daggers.length} rows)`);
  check(daggers[0]?.quantity === 2, `keeper Dagger quantity is 2, not 2+1 (got ${daggers[0]?.quantity})`);
  // Same for a fixed-item overlap: warlock has no overlap, so pin the
  // rule a second way — blood hunter picking a weapon twice in one
  // count-2 pick still yields one row with quantity 2.
  const bh = resolvePackage('blood_hunter', 'A', { weapons: ['Longsword', 'Longsword'] });
  check(bh.ok, 'blood hunter double-longsword pick resolves');
  const ls = bh.items.filter((i) => i.name === 'Longsword');
  check(ls.length === 1 && ls[0].quantity === 2, `blood hunter Longsword is one row of 2 (got ${JSON.stringify(ls)})`);
}

// ------------------------------------------------------------------ (e)
// Category-pick validation: valid passes, out-of-category fails field-named.
group('(e) Category-pick validation');
{
  // Valid picks pass.
  check(resolvePackage('bard', 'A', { instrument: ['Viol'] }).ok, 'bard Viol (instrument) passes');
  check(resolvePackage('blood_hunter', 'A', { weapons: ['Rapier', 'Whip'] }).ok, 'blood hunter Rapier+Whip (martial) pass');
  check(resolvePackage('scholar', 'A', { c1: { alternative: 1 }, c2: { alternative: 0 }, tools: ['Dice', 'Lute'] }).ok, 'scholar tools Dice+Lute pass (any_tool)');
  // Out-of-category picks fail with the pick's field named.
  expectFieldError(resolvePackage('bard', 'A', { instrument: ['Longsword'] }), 'picks.instrument', 'bard Longsword is not an instrument');
  expectFieldError(resolvePackage('blood_hunter', 'A', { weapons: ['Longsword', 'Dagger'] }), 'picks.weapons', 'blood hunter Dagger is not martial');
  expectFieldError(resolvePackage('monk', 'A', { toolOrInstrument: { alternative: 0 }, tool: ['Lute'] }), 'picks.tool', 'monk Lute is not an artisan tool');
  expectFieldError(resolvePackage('warden', 'A', { c1: { alternative: 0 }, c2: { alternative: 1 }, c2b: ['Longsword'], c3: { alternative: 0 }, weapon: ['Mace'] }), 'picks.c2b', 'warden Longsword is not a simple melee weapon');
  expectFieldError(resolvePackage('warden', 'A', { c1: { alternative: 0 }, c2: { alternative: 0 }, c3: { alternative: 0 }, weapon: ['Dagger'] }), 'picks.weapon', 'warden Dagger is not a martial weapon');
  // Missing / mistyped / wrong-count picks fail field-named.
  expectFieldError(resolvePackage('bard', 'A', {}), 'picks.instrument', 'bard missing instrument pick');
  expectFieldError(resolvePackage('bard', 'A', { instrument: 'Lute' }), 'picks.instrument', 'bard instrument pick must be a list');
  expectFieldError(resolvePackage('blood_hunter', 'A', { weapons: ['Longsword'] }), 'picks.weapons', 'blood hunter needs 2 martial weapons, got 1');
  expectFieldError(resolvePackage('blood_hunter', 'A', { weapons: ['Longsword', 'Battleaxe', 'Rapier'] }), 'picks.weapons', 'blood hunter needs 2 martial weapons, got 3');
  // Unknown class / option / pick key fail field-named, never silently.
  expectFieldError(resolvePackage('nope', 'A', {}), 'classId', 'unknown class');
  expectFieldError(resolvePackage('fighter', 'Z', {}), 'optionId', 'unknown option');
  expectFieldError(resolvePackage('bard', 'A', { instrument: ['Lute'], bogus: ['X'] }), 'picks.bogus', 'unknown pick key');
  // A pick for an unselected branch is stale, not silently dropped.
  expectFieldError(resolvePackage('monk', 'A', { toolOrInstrument: { alternative: 0 }, tool: ["Tinker's Tools"], instrument: ['Lute'] }), 'picks.instrument', 'monk stale instrument pick');
  // Out-of-range alternative index.
  expectFieldError(resolvePackage('cleric', 'A', { holy: { alternative: 5 } }), 'picks.holy', 'cleric holy alternative out of range');
  expectFieldError(resolvePackage('cleric', 'A', { holy: 'Amulet' }), 'picks.holy', 'cleric holy pick must be { alternative }');
  // validatePackageChoice mirrors resolvePackage's verdict.
  check(validatePackageChoice('bard', 'A', { instrument: ['Lute'] }).ok, 'validatePackageChoice valid passes');
  check(!validatePackageChoice('bard', 'A', { instrument: ['Longsword'] }).ok, 'validatePackageChoice invalid fails');
  // Category membership comes from the real equipment data (41 weapons: 38 chapter + 3 setting).
  const simple = categoryMembers('any_simple_weapon');
  check(simple && simple.length === 15, `any_simple_weapon has 15 members (got ${simple?.length})`);
  const martial = categoryMembers('any_martial_weapon');
  check(martial && martial.length === 26, `any_martial_weapon has 26 members (got ${martial?.length})`);
  // Setting weapons land in their categories (job (c)).
  check(simple.includes('Yklwa'), 'Yklwa is a member of any_simple_weapon');
  check(martial.includes('Double-Bladed Scimitar') && martial.includes('Hoopak'),
    'Double-Bladed Scimitar + Hoopak are members of any_martial_weapon');
  const simpleMelee = categoryMembers('any_simple_melee_weapon');
  check(simpleMelee && simpleMelee.length === 11 && simpleMelee.includes('Yklwa'),
    `any_simple_melee_weapon has 11 members incl. Yklwa (got ${simpleMelee?.length})`);
  const martialMelee = categoryMembers('any_martial_melee_weapon');
  check(martialMelee && martialMelee.length === 20 && martialMelee.includes('Double-Bladed Scimitar')
    && martialMelee.includes('Hoopak'),
    `any_martial_melee_weapon has 20 members incl. DBS + Hoopak (got ${martialMelee?.length})`);
  const instruments = categoryMembers('any_musical_instrument');
  check(instruments && instruments.length === 10, `any_musical_instrument has 10 members (got ${instruments?.length})`);
  const gaming = categoryMembers('any_gaming_set');
  check(gaming && gaming.length === 4, `any_gaming_set has 4 members (got ${gaming?.length})`);
  check(categoryMembers('nope') === null, 'unknown sentinel returns null');
  // Name resolution: canonical names + the classes.json free-text aliases.
  check(resolveItemName('Leather') === 'Leather', 'resolveItemName Leather');
  check(resolveItemName('Leather Armor') === 'Leather', 'resolveItemName aliases "Leather Armor" to Leather');
  check(resolveItemName('Studded Leather Armor') === 'Studded Leather', 'resolveItemName aliases "Studded Leather Armor"');
  check(resolveItemName('20 Arrows') === 'Arrows (20)', 'resolveItemName aliases "20 Arrows"');
  check(resolveItemName('20 Bolts') === 'Crossbow Bolts (20)', 'resolveItemName aliases "20 Bolts"');
  check(resolveItemName('No Such Item') === null, 'resolveItemName unknown returns null');
  check(resolveItemName('Spellbook') === 'Spellbook', 'resolveItemName Spellbook (package-only item)');
  check(resolveItemName('Sabre') === 'Sabre', 'resolveItemName Sabre (package-only item)');
}

// ------------------------------------------------------------------ (f)
// Gold fork arithmetic: baseline x (1 + mod), half-up rounding.
group('(f) Gold fork arithmetic');
{
  const cases = [
    ['fighter', 'noble', 0.5, 233], // 155 x 1.5 = 232.5 -> 233
    ['fighter', 'urchin', -0.5, 78], // 155 x 0.5 = 77.5 -> 78
    ['ranger', 'noble', 0.5, 225],
    ['wizard', 'urchin', -0.5, 28], // 55 x 0.5 = 27.5 -> 28
    ['monk', 'soldier', 0, 50],
    ['monk', 'hermit', -0.35, 33], // 50 x 0.65 = 32.5 -> 33
    ['rogue', 'charlatan', 0.3, 130],
    ['blood_hunter', 'acolyte', -0.05, 95],
    ['warlord', 'guild_artisan', 0.25, 156], // 125 x 1.25 = 156.25 -> 156
  ];
  for (const [cls, themeId, mod, gold] of cases) {
    const r = computeGoldFork(cls, themeId, mod);
    check(r.ok && r.gold === gold, `gold fork ${cls}/${themeId} (${mod}): ${r.gold} === ${gold}`);
    check(r.baseline === STARTING_PACKAGES[cls].goldOption, `gold fork ${cls} baseline is its goldOption`);
  }
  // Null goldOption + fork requested -> error naming the class + source.
  for (const cls of ['blackguard', 'magus', 'pugilist', 'scholar', 'spellshot', 'warden']) {
    const r = computeGoldFork(cls, 'noble', 0.5);
    check(!r.ok && r.errors.some((e) => e.field === 'goldOption' && e.message.includes(cls)),
      `${cls} gold fork fails naming the class (got ${JSON.stringify(r.errors)})`);
  }
  const bg = computeGoldFork('blackguard', 'noble', 0.5);
  check(bg.errors[0]?.message.includes('Libris Mortis'), 'blackguard gold fork names its source (Libris Mortis)');
  expectFieldError(computeGoldFork('nope', 'noble', 0.5), 'classId', 'gold fork unknown class');
  expectFieldError(computeGoldFork('fighter', 'noble', 'half'), 'themeMod', 'gold fork non-number themeMod');
  expectFieldError(computeGoldFork('fighter', 'noble', -1.5), 'themeMod', 'gold fork negative-result themeMod');
}

// ------------------------------------------------------------------ (g)
// Focus mappings from the brief.
group('(g) Focus mappings');
{
  // Arcane Focus (orb) -> Orb; (crystal) -> Crystal; (Quarterstaff) -> Staff.
  check(byName(resolvePackage('warlock', 'A', {}).items).Orb === 1, 'warlock Arcane Focus (orb) -> Orb');
  check(byName(resolvePackage('sorcerer', 'A', {}).items).Crystal === 1, 'sorcerer Arcane Focus (crystal) -> Crystal');
  check(byName(resolvePackage('wizard', 'A', {}).items).Staff === 1, 'wizard Arcane Focus (Quarterstaff) -> Staff');
  // Druidic Focus (Quarterstaff) -> Wooden Staff; (sprig of mistletoe) -> Sprig.
  check(byName(resolvePackage('druid', 'A', {}).items)['Wooden Staff'] === 1, 'druid Druidic Focus (Quarterstaff) -> Wooden Staff');
  check(byName(resolvePackage('ranger', 'A', {}).items)['Sprig of Mistletoe'] === 1, 'ranger Druidic Focus (sprig of mistletoe) -> Sprig of Mistletoe');
  // Bare Holy Symbol -> choice among Amulet/Emblem/Reliquary.
  const holy = STARTING_PACKAGES.cleric.options[0].items.find((i) => i.key === 'holy');
  check(holy && holy.from.map((f) => f.name).join(',') === 'Amulet,Emblem,Reliquary', 'cleric Holy Symbol is a choice among Amulet/Emblem/Reliquary');
  // Musical Instrument of your choice -> the 10 instruments.
  check(categoryMembers('any_musical_instrument').length === 10, 'bard instrument choice spans the 10 instruments');
  // Artisan's Tools or Musical Instrument -> artisan tools + instruments.
  const monkChoice = STARTING_PACKAGES.monk.options[0].items.find((i) => i.key === 'toolOrInstrument');
  check(monkChoice && monkChoice.from.length === 2, 'monk tool/instrument fork has 2 alternatives');
  check(categoryMembers('any_artisan_tool').length === 17, `any_artisan_tool has 17 members (got ${categoryMembers('any_artisan_tool')?.length})`);
  // Book (occult lore) -> the Book gear item.
  check(byName(resolvePackage('warlock', 'A', {}).items).Book === 1, 'warlock Book (occult lore) -> Book');
  // Magus generic focus picks resolve through the same focus lists.
  const magusArcane = resolvePackage('magus', 'A', { c1: { alternative: 1 }, c1b: ['Rapier'], c2: { alternative: 0 }, c3: { alternative: 0 }, c3a: { alternative: 4 } });
  check(magusArcane.ok && byName(magusArcane.items).Wand === 1, 'magus arcane focus alternative 4 -> Wand');
  const magusDruidic = resolvePackage('magus', 'A', { c1: { alternative: 1 }, c1b: ['Rapier'], c2: { alternative: 0 }, c3: { alternative: 1 }, c3b: { alternative: 2 } });
  check(magusDruidic.ok && byName(magusDruidic.items)['Yew Wand'] === 1, 'magus druidic focus alternative 2 -> Yew Wand');
}

// ------------------------------------------------------------------ (h)
// Route: GET /api/starting-packages/:classId over real HTTP.
group('(h) Starting-packages route');
{
  const app = express();
  app.use(express.json());
  app.use('/api/starting-packages', startingPackagesRouter);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const fighterRes = await fetch(`${base}/api/starting-packages/fighter`);
    const fighter = await fighterRes.json();
    check(fighterRes.status === 200, 'GET fighter returns 200');
    check(fighter.classId === 'fighter', 'GET fighter classId echoes');
    check(fighter.options.length === 2 && fighter.options.map((o) => o.id).join(',') === 'A,B', 'GET fighter returns options A,B');
    check(fighter.goldOption === 155, 'GET fighter goldOption 155');
    check(fighter.options[0].items.some((i) => i.name === 'Greatsword'), 'GET fighter option A lists Greatsword');

    const wizardRes = await fetch(`${base}/api/starting-packages/wizard`);
    const wizard = await wizardRes.json();
    check(wizardRes.status === 200 && wizard.goldOption === 55, 'GET wizard returns 200 + goldOption 55');

    const bgRes = await fetch(`${base}/api/starting-packages/blackguard`);
    const bg = await bgRes.json();
    check(bgRes.status === 200 && bg.goldOption === null, 'GET blackguard returns 200 + null goldOption');

    const nopeRes = await fetch(`${base}/api/starting-packages/nope`);
    const nope = await nopeRes.json();
    check(nopeRes.status === 404, 'GET unknown class returns 404');
    check(nope.field === 'classId', `GET unknown class 404 names field classId (got ${JSON.stringify(nope)})`);
    check(typeof nope.error === 'string' && nope.error.includes('nope'), 'GET unknown class 404 error names the class');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  // listPackageOptions is the route's data source; unknown class fails there too.
  const unknown = listPackageOptions('nope');
  check(!unknown.ok && unknown.errors[0]?.field === 'classId', 'listPackageOptions unknown class fails field classId');
  const fighterList = listPackageOptions('fighter');
  check(fighterList.ok && fighterList.goldOption === 155 && fighterList.options.length === 2, 'listPackageOptions fighter ok');
  // The returned options are a copy: mutating them must not corrupt the data.
  fighterList.options[0].items.push({ name: 'Fake Item', quantity: 1 });
  check(!JSON.stringify(listPackageOptions('fighter')).includes('Fake Item'), 'listPackageOptions returns a deep copy');
}

// ------------------------------------------------------------------ (i)
// Server themeGoldModifiers.js is a verbatim copy of the client file.
group('(i) Server themeGoldModifiers.js (verbatim client copy)');
{
  const serverPath = path.join(repoRoot, 'server/data/themeGoldModifiers.js');
  const clientPath = path.join(repoRoot, 'client/src/data/themeGoldModifiers.js');
  const serverBytes = fs.readFileSync(serverPath);
  const clientBytes = fs.readFileSync(clientPath);
  check(serverBytes.equals(clientBytes), 'server/data/themeGoldModifiers.js is byte-identical to client/src/data/themeGoldModifiers.js');
  check(Object.keys(THEME_GOLD_MODIFIERS).length === 21, `THEME_GOLD_MODIFIERS has 21 themes (got ${Object.keys(THEME_GOLD_MODIFIERS).length})`);
  check(applyGoldModifier(100, 'noble') === 150, 'applyGoldModifier noble +50%: 100 -> 150');
  check(applyGoldModifier(100, 'urchin') === 50, 'applyGoldModifier urchin -50%: 100 -> 50');
  check(applyGoldModifier(125, 'charlatan') === 163, 'applyGoldModifier charlatan +30%: 125 -> 163 (162.5 half-up)');
  check(applyGoldModifier(100, 'soldier') === 100, 'applyGoldModifier soldier 0%: 100 -> 100');
  check(applyGoldModifier(100, 'no-such-theme') === 100, 'applyGoldModifier unknown theme defaults to mod 0');
  check(applyGoldModifier(155, 'hermit') === 101, 'applyGoldModifier hermit -35%: 155 -> 101 (100.75 -> 101)');
}

// ------------------------------------------------------------------ (j)
// Structural pins: every package item resolves to a known name.
group('(j) Structural pins');
{
  // Every fixed item in every package resolves to a canonical name, and
  // every sentinel is one the resolver knows.
  let fixed = 0;
  let choices = 0;
  for (const [cls, pkg] of Object.entries(STARTING_PACKAGES)) {
    const walk = (entries) => {
      for (const entry of entries || []) {
        if (entry && typeof entry.name === 'string') {
          fixed++;
          check(resolveItemName(entry.name) !== null, `${cls} fixed item "${entry.name}" resolves to a known name`);
        } else if (entry && typeof entry.key === 'string') {
          choices++;
          if (typeof entry.from === 'string') {
            check(categoryMembers(entry.from) !== null, `${cls} choice "${entry.key}" uses a known sentinel "${entry.from}"`);
          } else if (Array.isArray(entry.from)) {
            for (const alt of entry.from) {
              const alts = Array.isArray(alt) ? alt : (alt.items || [alt]);
              walk(alts);
            }
          } else {
            check(false, `${cls} choice "${entry.key}" has a usable "from"`);
          }
        } else if (entry && Array.isArray(entry.items)) {
          walk(entry.items);
        } else if (Array.isArray(entry)) {
          walk(entry);
        } else {
          check(false, `${cls} has an unrecognised package entry: ${JSON.stringify(entry)}`);
        }
      }
    };
    for (const option of pkg.options) walk(option.items);
  }
  check(fixed > 100, `packages carry >100 fixed items (got ${fixed})`);
  check(choices > 20, `packages carry >20 choice entries (got ${choices})`);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
