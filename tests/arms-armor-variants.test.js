/**
 * tests/arms-armor-variants.test.js — Arms & Armor (Troll Lord, 2018)
 * brought into the 2024 system, delineated.
 *
 * Pins:
 *   - WEAPON_DATA holds 41 weapons (38 chapter + 3 setting: Yklwa,
 *     Double-Bladed Scimitar, Hoopak — 2026-11-08 job (c)) + Unarmed
 *     Strike (42 keys). This import adds aliases, not weapons.
 *   - A variant name resolves to its canonical weapon's stats:
 *     Shamshir / Katana -> Scimitar, Bastard Sword -> Longsword
 *     (versatile die when the off hand is empty).
 *   - An item's own damage field still wins over the alias table.
 *   - An armor variant resolves to its canonical armor's AC:
 *     Brigandine -> Scale Mail, Plate, gothic -> Plate.
 *   - A name-only shield in the off hand gives +2 (Buckler +1);
 *     an explicit acBonus wins; a non-shield off hand gives nothing.
 *   - Proposed weapons are NOT live: lookupWeaponData returns null
 *     for Hooked Polearm, Brass Knuckles, Bolas, and the rest.
 *   - Ammunition variants exist as data and are NOT weapons.
 *
 * Isolated throwaway DB (clock-unification / weapons-mastery pattern).
 * calculateCombatStats itself is pure, but combatStatsService imports
 * the DB module, so init first like the weapons-mastery test does.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-arms-armor-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
await dbModule.initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const stats = await import(svc('server/services/combatStatsService.js'));
const variants = await import(svc('server/data/armsArmorVariants.js'));

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; } else { failed++; console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n== ${name}`); }

function actor(equipment, abilities = { str: 16, dex: 14 }) {
  return { ability_scores: abilities, equipment, level: 1 };
}

group('WEAPON_DATA untouched');
assert(Object.keys(stats.WEAPON_DATA).length === 42,
  `WEAPON_DATA has 42 keys (41 weapons + Unarmed), got ${Object.keys(stats.WEAPON_DATA).length}`);
assert(stats.WEAPON_DATA.Longsword.damage === '1d8' && stats.WEAPON_DATA.Longsword.mastery === 'sap',
  'Longsword still 1d8 / sap');
assert(stats.lookupWeaponData('Longsword')?.name === 'Longsword',
  'canonical lookup still returns the canonical name');

group('Setting weapons resolve (not aliases, not proposed)');
assert(stats.lookupWeaponData('Yklwa')?.damage === '1d8' && stats.lookupWeaponData('Yklwa')?.mastery === 'sap',
  'Yklwa resolves in WEAPON_DATA (1d8 / sap)');
assert(stats.lookupWeaponData('Double-Bladed Scimitar')?.damage === '2d4' && stats.lookupWeaponData('Double-Bladed Scimitar')?.mastery === 'graze',
  'Double-Bladed Scimitar resolves in WEAPON_DATA (2d4 / graze)');
assert(stats.lookupWeaponData('Hoopak')?.damage === '1d6' && stats.lookupWeaponData('Hoopak')?.mastery === 'topple',
  'Hoopak resolves in WEAPON_DATA (1d6 / topple)');
assert(stats.lookupWeaponData('Yklwa')?.canonical === undefined && stats.lookupWeaponData('Hoopak')?.canonical === undefined,
  'setting weapons resolve directly, not via an alias');
assert(variants.PROPOSED_WEAPONS['Yklwa'] == null && variants.PROPOSED_WEAPONS['Double-Bladed Scimitar'] == null
  && variants.PROPOSED_WEAPONS['Hoopak'] == null,
  'setting weapons are not in PROPOSED_WEAPONS');

group('Weapon aliases resolve to canonical stats');
const shamshir = stats.lookupWeaponData('Shamshir');
assert(shamshir && shamshir.canonical === 'Scimitar' && shamshir.damage === '1d6' && shamshir.mastery === 'nick',
  'Shamshir resolves to Scimitar 1d6 / nick');
assert(shamshir.name === 'Shamshir',
  'alias lookup keeps the variant name, so Nick main/off comparisons still work');
assert(stats.lookupWeaponData('Katana')?.canonical === 'Scimitar', 'Katana resolves to Scimitar');
assert(stats.lookupWeaponData('  SHAMSHIR ')?.canonical === 'Scimitar',
  'alias lookup is case- and whitespace-insensitive');
assert(stats.lookupWeaponData('Mace, large flanged')?.canonical === 'Mace',
  'comma form resolves (Mace, large flanged -> Mace)');
assert(stats.lookupWeaponData('No Such Weapon') === null, 'unknown name still returns null');

group('Aliases flow through calculateCombatStats');
const s1 = stats.calculateCombatStats(actor({ mainHand: { name: 'Shamshir' } }));
assert(s1.weapon && s1.weapon.damageDice === '1d6' && s1.weapon.damageType === 'slashing' && s1.weapon.mastery === 'nick',
  'name-only Shamshir deals Scimitar dice in combat stats');
assert(s1.weapon.name === 'Shamshir', 'display name stays Shamshir, stats come from Scimitar');
const bastard = stats.calculateCombatStats(actor({ mainHand: { name: 'Bastard Sword' } }));
assert(bastard.weapon && bastard.weapon.damageDice === '1d10',
  'Bastard Sword with an empty off hand deals the Longsword versatile die');
const bastardShield = stats.calculateCombatStats(actor({
  mainHand: { name: 'Bastard Sword' },
  offHand: { name: 'Kite Shield' }
}));
assert(bastardShield.weapon && bastardShield.weapon.damageDice === '1d8',
  'Bastard Sword with a shield drops back to the one-handed die');
const own = stats.calculateCombatStats(actor({ mainHand: { name: 'Shamshir', damage: '2d6' } }));
assert(own.weapon && own.weapon.damageDice === '2d6',
  "an item's own damage field still wins over the alias table");

group('Armor variants resolve to canonical AC');
const brig = stats.calculateCombatStats(actor({ armor: { name: 'Brigandine' } }));
assert(brig.ac === 16, `Brigandine (Scale Mail, Dex +2) gives AC 16, got ${brig.ac}`);
const gothic = stats.calculateCombatStats(actor({ armor: { name: 'Plate, gothic' } }, { str: 16, dex: 10 }));
assert(gothic.ac === 18, `Plate, gothic gives AC 18, got ${gothic.ac}`);
const aketon = stats.calculateCombatStats(actor({ armor: { name: 'Aketon suit' } }));
assert(aketon.ac === 13, `Aketon suit (Padded, Dex +2) gives AC 13, got ${aketon.ac}`);
assert(variants.resolveArmorVariant('Plate, gothic') === 'Plate',
  'resolveArmorVariant maps Plate, gothic -> Plate');
// PHB display names (2026-10-31 fix): full display names resolve to
// their ARMOR_DATA short keys instead of silently counting as unarmored.
assert(variants.resolveArmorVariant('Leather Armor') === 'Leather',
  'resolveArmorVariant maps Leather Armor -> Leather');
assert(variants.resolveArmorVariant('Padded Armor') === 'Padded',
  'resolveArmorVariant maps Padded Armor -> Padded');
assert(variants.resolveArmorVariant('Studded Leather Armor') === 'Studded Leather',
  'resolveArmorVariant maps Studded Leather Armor -> Studded Leather');
assert(variants.resolveArmorVariant('Hide Armor') === 'Hide',
  'resolveArmorVariant maps Hide Armor -> Hide');
const leatherDisplay = stats.calculateCombatStats(actor({ armor: { name: 'Leather Armor' } }));
assert(leatherDisplay.ac === 13, `Leather Armor (11 + Dex +2) gives AC 13, got ${leatherDisplay.ac}`);
const paddedDisplay = stats.calculateCombatStats(actor({ armor: { name: 'Padded Armor' } }));
assert(paddedDisplay.ac === 13, `Padded Armor (11 + Dex +2) gives AC 13, got ${paddedDisplay.ac}`);
const studdedDisplay = stats.calculateCombatStats(actor({ armor: { name: 'Studded Leather Armor' } }));
assert(studdedDisplay.ac === 14, `Studded Leather Armor (12 + Dex +2) gives AC 14, got ${studdedDisplay.ac}`);
const hideDisplay = stats.calculateCombatStats(actor({ armor: { name: 'Hide Armor' } }));
assert(hideDisplay.ac === 14, `Hide Armor (12 + Dex +2 capped) gives AC 14, got ${hideDisplay.ac}`);

group('Name-only shields');
const kite = stats.calculateCombatStats(actor({
  armor: { name: 'Leather' },
  offHand: { name: 'Kite Shield' }
}));
assert(kite.ac === 15, `Leather (13) + Kite Shield gives AC 15, got ${kite.ac}`);
const buckler = stats.calculateCombatStats(actor({
  armor: { name: 'Leather' },
  offHand: { name: 'Buckler' }
}));
assert(buckler.ac === 14, `Leather (13) + Buckler gives AC 14, got ${buckler.ac}`);
const explicit = stats.calculateCombatStats(actor({
  armor: { name: 'Leather' },
  offHand: { name: 'Kite Shield', acBonus: 3 }
}));
assert(explicit.ac === 16, `explicit acBonus 3 wins over the name-only +2, got ${explicit.ac}`);
const notShield = stats.calculateCombatStats(actor({
  armor: { name: 'Leather' },
  offHand: { name: 'Scimitar' }
}));
assert(notShield.ac === 13, `a non-shield off hand adds nothing, got ${notShield.ac}`);
assert(variants.shieldBonusForOffHand('Pavis') === 0,
  'Pavis is cover, not a worn shield — no shield bonus');

group('Proposed weapons and ammunition are not live');
for (const name of ['Hooked Polearm', 'Brass Knuckles', 'Bolas', 'Meteor Hammer', 'Estoc', 'Repeating Crossbow', 'Man Catcher', 'Parrying Dagger']) {
  assert(stats.lookupWeaponData(name) === null, `${name} is proposed only, not in WEAPON_DATA`);
}
assert(variants.PROPOSED_WEAPONS['Hooked Polearm']?.status === 'proposed',
  'Hooked Polearm exists in PROPOSED_WEAPONS as data');
assert(variants.AMMUNITION_VARIANTS['Flight Arrow']?.damageModifier === -1,
  'Flight Arrow data exists with a -1 damage modifier');
assert(stats.lookupWeaponData('Flight Arrow') === null,
  'Flight Arrow is ammunition data, not a weapon');
assert(variants.HELMET_NAMES.includes('Great Helm'),
  'helmet vocabulary includes Great Helm');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
