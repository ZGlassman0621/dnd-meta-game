// tests/equipment-2024.test.js — Stage 5 Equipment data (2024 PHB Ch. 6).
// Branch `phase-4-hybrid-combat`.
//
// Honest integration tests: every assert calls the REAL module
// (server/data/equipment2024.js), the REAL combat table
// (server/services/combatStatsService.js WEAPON_DATA / ARMOR_DATA), and the
// REAL corrected client bank (client/src/data/equipment.json). If any of
// those files were deleted, the imports / reads fail and the suite fails
// with them. Nothing is re-implemented here: the expected tables below are
// literals pinned from the parent-verified chapter transcription
// (equipment-chapter-transcription.md, pp. 213–233); the module, the bank,
// and the combat table are all checked AGAINST those literals.
//
// COUNT NOTE (enumerated tables beat the header figures): the brief and the
// transcription header say "37 weapons" and "13 armor + shield", but the
// enumerated chapter tables contain 38 weapons (10 simple melee + 4 simple
// ranged + 18 martial melee + 6 martial ranged) and 12 armor (3 light +
// 5 medium + 4 heavy) + Shield. This suite pins 38 / 12 + Shield for the
// chapter tables — plus 3 setting weapons (Yklwa, Double-Bladed Scimitar,
// Hoopak, 2026-11-08 job (c)), so the module/bank/combat totals are 41.
//
// FLAG 1 (item-1 ruling, Zach 2026-10-29, wins over the book): the book's
// Ammunition half-back recovery rule is deliberately NOT encoded. The
// suite pins that the property text has no half-back sentence and that
// AMMUNITION_RECOVERY.encoded is false.
//
// Footer is the runner-matching `Results:` form.
import assert from 'node:assert';
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

// Throwaway cwd so any accidental local.db lands in tmp, never the repo
// (same pattern as creator-gaps-batch). No DB is ever opened here, but
// combatStatsService imports database.js, which creates a libsql client
// on import — keep its default file: URL pointed at tmp.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'equipment-2024-test-'));
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf-8');

const eq2024 = await import(fromRepo('server/data/equipment2024.js'));
const {
  WEAPONS, ARMOR, SHIELD, ARMOR_RULES, TOOLS, ADVENTURING_GEAR, AMMUNITION,
  FOCUSES, PACKS, MOUNTS, TACK, DRAWN_VEHICLES, SHIPS, SERVICES, CRAFTING,
  POTION_OF_HEALING, SPELL_SCROLL_PRICES, WEAPON_PROPERTY_RULES, MASTERY_RULES,
  AMMUNITION_RECOVERY, gpToCp, cpToGp, findWeapon, findArmor, findPack,
  packContents, allFocuses,
} = eq2024;
const { WEAPON_DATA, ARMOR_DATA, lookupWeaponData } = await import(
  fromRepo('server/services/combatStatsService.js'));
const bank = JSON.parse(readRepo('client/src/data/equipment.json'));
const moduleSrc = readRepo('server/data/equipment2024.js');

const byName = (list) => Object.fromEntries(list.map((e) => [e.name, e]));
const W = byName(WEAPONS);
const A = byName(ARMOR);
const G = byName(ADVENTURING_GEAR);
const T = byName(TOOLS);

// ---------------------------------------------------------------- counts
group('counts — enumerated chapter tables');
check(WEAPONS.length === 41, `41 weapons — 38 chapter + 3 setting (got ${WEAPONS.length})`);
check(WEAPONS.filter((w) => w.category === 'simple' && w.rangeType === 'melee').length === 11, '11 simple melee');
check(WEAPONS.filter((w) => w.category === 'simple' && w.rangeType === 'ranged').length === 4, '4 simple ranged');
check(WEAPONS.filter((w) => w.category === 'martial' && w.rangeType === 'melee').length === 20, '20 martial melee');
check(WEAPONS.filter((w) => w.category === 'martial' && w.rangeType === 'ranged').length === 6, '6 martial ranged');
check(ARMOR.length === 12, `12 armor (got ${ARMOR.length})`);
check(SHIELD.name === 'Shield' && SHIELD.acBonus === 2, 'Shield +2 AC');
check(ADVENTURING_GEAR.length === 71, `71 adventuring gear items (got ${ADVENTURING_GEAR.length})`);
check(AMMUNITION.length === 5, '5 ammunition types');
check(FOCUSES.arcane.length === 5 && FOCUSES.druidic.length === 3 && FOCUSES.holy.length === 3, '5 arcane + 3 druidic + 3 holy focuses');
check(allFocuses().length === 11, '11 focuses total');
check(Object.keys(PACKS).length === 7, '7 packs');
check(MOUNTS.length === 8, '8 mounts');
check(TACK.length === 5, '5 tack rows (chapter table)');
check(DRAWN_VEHICLES.length === 5, '5 drawn vehicles');
check(SHIPS.length === 7, '7 ships (incl. Airship)');
check(TOOLS.length === 37, `37 tools (got ${TOOLS.length})`);
check(TOOLS.filter((t) => t.category === 'artisan').length === 17, '17 artisan tools');
check(TOOLS.filter((t) => t.category === 'instrument').length === 10, '10 instruments');
check(SERVICES.lifestyles.length === 7, '7 lifestyles');
check(SERVICES.spellcasting.length === 7, '7 spellcasting service rows');

// ------------------------------------------------- all 41 weapons pinned
// (38 chapter + 3 setting; name: damage, damageType, properties, range, versatile, mastery, weightLb, costCp)
group('weapons — damage / mastery / price / weight (all 41)');
const CH_WEAPONS = [
  ['Club', '1d4', 'bludgeoning', ['light'], null, null, 'slow', 2, 10],
  ['Dagger', '1d4', 'piercing', ['finesse', 'light', 'thrown'], '20/60', null, 'nick', 1, 200],
  ['Greatclub', '1d8', 'bludgeoning', ['two-handed'], null, null, 'push', 10, 20],
  ['Handaxe', '1d6', 'slashing', ['light', 'thrown'], '20/60', null, 'vex', 2, 500],
  ['Javelin', '1d6', 'piercing', ['thrown'], '30/120', null, 'slow', 2, 50],
  ['Light Hammer', '1d4', 'bludgeoning', ['light', 'thrown'], '20/60', null, 'nick', 2, 200],
  ['Mace', '1d6', 'bludgeoning', [], null, null, 'sap', 4, 500],
  ['Quarterstaff', '1d6', 'bludgeoning', ['versatile'], null, '1d8', 'topple', 4, 20],
  ['Sickle', '1d4', 'slashing', ['light'], null, null, 'nick', 2, 100],
  ['Spear', '1d6', 'piercing', ['thrown', 'versatile'], '20/60', '1d8', 'sap', 3, 100],
  ['Yklwa', '1d8', 'piercing', ['thrown'], '10/30', null, 'sap', 2, 100],
  ['Dart', '1d4', 'piercing', ['finesse', 'thrown'], '20/60', null, 'vex', 0.25, 5],
  ['Light Crossbow', '1d8', 'piercing', ['ammunition', 'loading', 'two-handed'], '80/320', null, 'slow', 5, 2500],
  ['Shortbow', '1d6', 'piercing', ['ammunition', 'two-handed'], '80/320', null, 'vex', 2, 2500],
  ['Sling', '1d4', 'bludgeoning', ['ammunition'], '30/120', null, 'slow', null, 10],
  ['Battleaxe', '1d8', 'slashing', ['versatile'], null, '1d10', 'topple', 4, 1000],
  ['Flail', '1d8', 'bludgeoning', [], null, null, 'sap', 2, 1000],
  ['Glaive', '1d10', 'slashing', ['heavy', 'reach', 'two-handed'], null, null, 'graze', 6, 2000],
  ['Greataxe', '1d12', 'slashing', ['heavy', 'two-handed'], null, null, 'cleave', 7, 3000],
  ['Greatsword', '2d6', 'slashing', ['heavy', 'two-handed'], null, null, 'graze', 6, 5000],
  ['Halberd', '1d10', 'slashing', ['heavy', 'reach', 'two-handed'], null, null, 'cleave', 6, 2000],
  ['Lance', '1d10', 'piercing', ['heavy', 'reach', 'two-handed'], null, null, 'topple', 6, 1000],
  ['Longsword', '1d8', 'slashing', ['versatile'], null, '1d10', 'sap', 3, 1500],
  ['Maul', '2d6', 'bludgeoning', ['heavy', 'two-handed'], null, null, 'topple', 10, 1000],
  ['Morningstar', '1d8', 'piercing', [], null, null, 'sap', 4, 1500],
  ['Pike', '1d10', 'piercing', ['heavy', 'reach', 'two-handed'], null, null, 'push', 18, 500],
  ['Rapier', '1d8', 'piercing', ['finesse'], null, null, 'vex', 2, 2500],
  ['Scimitar', '1d6', 'slashing', ['finesse', 'light'], null, null, 'nick', 3, 2500],
  ['Shortsword', '1d6', 'piercing', ['finesse', 'light'], null, null, 'vex', 2, 1000],
  ['Trident', '1d8', 'piercing', ['thrown', 'versatile'], '20/60', '1d10', 'topple', 4, 500],
  ['War Pick', '1d8', 'piercing', ['versatile'], null, '1d10', 'sap', 2, 500],
  ['Warhammer', '1d8', 'bludgeoning', ['versatile'], null, '1d10', 'push', 5, 1500],
  ['Whip', '1d4', 'slashing', ['finesse', 'reach'], null, null, 'slow', 3, 200],
  ['Double-Bladed Scimitar', '2d4', 'slashing', ['special', 'two-handed'], null, null, 'graze', 6, 10000],
  ['Hoopak', '1d6', 'piercing', ['ammunition', 'finesse', 'special', 'two-handed'], '40/160', null, 'topple', 2, 100],
  ['Blowgun', '1', 'piercing', ['ammunition', 'loading'], '25/100', null, 'vex', 1, 1000],
  ['Hand Crossbow', '1d6', 'piercing', ['ammunition', 'light', 'loading'], '30/120', null, 'vex', 3, 7500],
  ['Heavy Crossbow', '1d10', 'piercing', ['ammunition', 'heavy', 'loading', 'two-handed'], '100/400', null, 'push', 18, 5000],
  ['Longbow', '1d8', 'piercing', ['ammunition', 'heavy', 'two-handed'], '150/600', null, 'slow', 2, 5000],
  ['Musket', '1d12', 'piercing', ['ammunition', 'loading', 'two-handed'], '40/120', null, 'slow', 10, 50000],
  ['Pistol', '1d10', 'piercing', ['ammunition', 'loading'], '30/90', null, 'vex', 3, 25000],
];
for (const [name, dmg, dt, props, range, vers, mastery, wt, cp] of CH_WEAPONS) {
  const w = W[name];
  check(!!w, `weapon present: ${name}`);
  if (!w) continue;
  check(w.damage === dmg, `${name} damage ${w.damage} (want ${dmg})`);
  check(w.damageType === dt, `${name} damageType ${w.damageType} (want ${dt})`);
  check(JSON.stringify([...w.properties].sort()) === JSON.stringify([...props].sort()),
    `${name} properties [${w.properties}] (want [${props}])`);
  check(w.range === range, `${name} range ${w.range} (want ${range})`);
  check(w.versatile === vers, `${name} versatile ${w.versatile} (want ${vers})`);
  check(w.mastery === mastery, `${name} mastery ${w.mastery} (want ${mastery})`);
  check(w.weightLb === wt, `${name} weightLb ${w.weightLb} (want ${wt})`);
  check(w.costCp === cp, `${name} costCp ${w.costCp} (want ${cp})`);
  check(w.costGp === cp / 100, `${name} costGp consistent with costCp`);
  check(!w.properties.includes('special') || ['Double-Bladed Scimitar', 'Hoopak'].includes(name),
    `${name} has no 'special' property (2024) — only the two setting Special weapons carry it`);
}
check(!W['Net'], 'Net is NOT a weapon in the module');
// Setting-weapon source notes (job (c), D5–D7): the Special rule text
// rides in `notes`; the ranged/1d4 modes are DM-adjudicated in v1.
check(W['Double-Bladed Scimitar']?.properties.includes('special') && W['Hoopak']?.properties.includes('special'),
  'setting Special weapons carry the special property');
check(W['Hoopak']?.ammunition === 'Bullet', 'hoopak ammunition is Bullet (sling bullets)');
check(W['Yklwa']?.range === '10/30', 'yklwa thrown range 10/30');
check(W['Double-Bladed Scimitar']?.notes?.includes('1d4 slashing damage'), 'DBS notes carry the 1d4 bonus-action Special rule');
check(W['Hoopak']?.notes?.includes('1d4 bludgeoning'), 'hoopak notes carry the ranged-mode Special rule');
check(W['Lance']?.notes === 'Two-Handed does not apply while mounted.', 'Lance mounted exception noted');
check(WEAPONS.every((w) => typeof w.mastery === 'string' && w.mastery.length > 0), 'every weapon has a mastery');
check(WEAPONS.every((w) => Object.keys(MASTERY_RULES).includes(w.mastery)), 'every mastery is a defined mastery property');

// ------------------------------------------- all 12 armor + shield pinned
// (name: baseAC, maxDex, stealthDisadvantage, strengthRequirement, costCp, weightLb, don, doff)
group('armor — AC rule / Str / stealth / price / weight (all 12 + shield)');
const CH_ARMOR = [
  ['Padded', 11, null, false, null, 500, 8, 1, 1],
  ['Leather', 11, null, false, null, 1000, 10, 1, 1],
  ['Studded Leather', 12, null, true, null, 4500, 13, 1, 1],
  ['Hide', 12, 2, false, null, 1000, 12, 5, 1],
  ['Chain Shirt', 13, 2, false, null, 5000, 20, 5, 1],
  ['Scale Mail', 14, 2, true, null, 5000, 45, 5, 1],
  ['Breastplate', 14, 2, false, null, 40000, 20, 5, 1],
  ['Half Plate', 15, 2, true, null, 75000, 40, 5, 1],
  ['Ring Mail', 14, 0, true, null, 3000, 40, 10, 5],
  ['Chain Mail', 16, 0, true, 13, 7500, 55, 10, 5],
  ['Splint', 17, 0, true, 15, 20000, 60, 10, 5],
  ['Plate', 18, 0, true, 15, 150000, 65, 10, 5],
];
for (const [name, ac, mx, st, sr, cp, wt, don, doff] of CH_ARMOR) {
  const a = A[name];
  check(!!a, `armor present: ${name}`);
  if (!a) continue;
  check(a.baseAC === ac, `${name} baseAC ${a.baseAC} (want ${ac})`);
  check(a.maxDex === mx, `${name} maxDex ${a.maxDex} (want ${mx})`);
  check(a.stealthDisadvantage === st, `${name} stealth ${a.stealthDisadvantage} (want ${st})`);
  check(a.strengthRequirement === sr, `${name} Str req ${a.strengthRequirement} (want ${sr})`);
  check(a.costCp === cp, `${name} costCp ${a.costCp} (want ${cp})`);
  check(a.weightLb === wt, `${name} weightLb ${a.weightLb} (want ${wt})`);
  check(a.donMinutes === don && a.doffMinutes === doff, `${name} don ${a.donMinutes}/doff ${a.doffMinutes} min (want ${don}/${doff})`);
}
check(SHIELD.costCp === 1000 && SHIELD.weightLb === 6 && SHIELD.donDoff === 'Utilize action', 'Shield 10 GP / 6 lb / Utilize action');

// ---------------------------------------------------------- packs pinned
group('packs — contents + weight + cost (all 7)');
const CH_PACKS = {
  "Burglar's Pack": [1600, 42, [['Backpack', 1], ['Ball Bearings', 1], ['Bell', 1], ['Candle', 10], ['Crowbar', 1], ['Lantern, Hooded', 1], ['Oil', 7], ['Rations', 5], ['Rope', 1], ['Tinderbox', 1], ['Waterskin', 1]]],
  "Diplomat's Pack": [3900, 39, [['Chest', 1], ['Clothes, Fine', 1], ['Ink', 1], ['Ink Pen', 5], ['Lamp', 1], ['Case, Map or Scroll', 2], ['Oil', 2], ['Paper', 5], ['Parchment', 5], ['Perfume', 1], ['Tinderbox', 1]]],
  "Dungeoneer's Pack": [1200, 55, [['Backpack', 1], ['Caltrops', 1], ['Crowbar', 1], ['Oil', 2], ['Rations', 10], ['Rope', 1], ['Tinderbox', 1], ['Torch', 10], ['Waterskin', 1]]],
  "Entertainer's Pack": [4000, 58, [['Backpack', 1], ['Bedroll', 1], ['Bell', 1], ['Lantern, Bullseye', 1], ['Costume', 3], ['Mirror', 1], ['Oil', 8], ['Rations', 9], ['Tinderbox', 1], ['Waterskin', 1]]],
  "Explorer's Pack": [1000, 55, [['Backpack', 1], ['Bedroll', 1], ['Oil', 2], ['Rations', 10], ['Rope', 1], ['Tinderbox', 1], ['Torch', 10], ['Waterskin', 1]]],
  "Priest's Pack": [3300, 29, [['Backpack', 1], ['Blanket', 1], ['Holy Water', 1], ['Lamp', 1], ['Rations', 7], ['Robe', 1], ['Tinderbox', 1]]],
  "Scholar's Pack": [4000, 22, [['Backpack', 1], ['Book', 1], ['Ink', 1], ['Ink Pen', 1], ['Lamp', 1], ['Oil', 10], ['Parchment', 10], ['Tinderbox', 1]]],
};
for (const [name, [cp, wt, contents]] of Object.entries(CH_PACKS)) {
  const p = PACKS[name];
  check(!!p, `pack present: ${name}`);
  if (!p) continue;
  check(p.costCp === cp, `${name} costCp ${p.costCp} (want ${cp})`);
  check(p.weightLb === wt, `${name} weightLb ${p.weightLb} (want ${wt})`);
  check(JSON.stringify(p.contents) === JSON.stringify(contents.map(([n, q]) => ({ name: n, quantity: q }))),
    `${name} contents match chapter`);
  // Every pack content resolves by name against the gear/weapons/tools tables.
  for (const [item] of contents) {
    check(!!(G[item] || W[item] || T[item]), `${name} content resolves by name: ${item}`);
  }
}
check(packContents("Priest's Pack").length === 7, 'packContents() returns 7 Priest items');
check(packContents('No Such Pack') === null, 'packContents() null for unknown pack');

// ------------------------------------------- potion, scrolls, crafting
group('potion of healing / scrolls / crafting');
check(POTION_OF_HEALING.healing === '2d4+2', 'Potion of Healing heals 2d4+2');
check(POTION_OF_HEALING.costCp === 5000 && POTION_OF_HEALING.costGp === 50, 'Potion of Healing 50 GP');
check(POTION_OF_HEALING.action === 'Bonus Action', 'Potion of Healing is a Bonus Action');
check(POTION_OF_HEALING.weightLb === 0.5, 'Potion of Healing 1/2 lb');
check(G['Potion of Healing']?.costCp === 5000, 'gear table agrees: Potion of Healing 50 GP');
check(SPELL_SCROLL_PRICES.cantrip.costCp === 3000, 'Spell Scroll (Cantrip) 30 GP');
check(SPELL_SCROLL_PRICES.level1.costCp === 5000, 'Spell Scroll (Level 1) 50 GP');
check(G['Spell Scroll (Cantrip)']?.costCp === 3000, 'gear table agrees: scroll Cantrip 30 GP');
check(G['Spell Scroll (Level 1)']?.costCp === 5000, 'gear table agrees: scroll L1 50 GP');
check(CRAFTING.materialsFraction === 0.5, 'crafting materials = half cost');
check(CRAFTING.potionOfHealing.tool === 'Herbalism Kit'
  && CRAFTING.potionOfHealing.materialsCp === 2500
  && CRAFTING.potionOfHealing.days === 1, 'brewing: Herbalism Kit + 25 GP + 1 day');
const scribing = Object.fromEntries(CRAFTING.scrollScribing.map((r) => [String(r.level), r]));
check(CRAFTING.scrollScribing.length === 10, 'scroll scribing table has 10 rows');
check(scribing['Cantrip'].days === 1 && scribing['Cantrip'].costCp === 1500, 'scribing Cantrip 1 day / 15 GP');
check(scribing['1'].days === 1 && scribing['1'].costCp === 2500, 'scribing L1 1 day / 25 GP');
check(scribing['2'].days === 3 && scribing['2'].costCp === 10000, 'scribing L2 3 days / 100 GP');
check(scribing['9'].days === 120 && scribing['9'].costCp === 5000000, 'scribing L9 120 days / 50,000 GP');

// ------------------------------------------------------- the 5 corrections
group('the 5 corrections (book wins)');
check(WEAPON_PROPERTY_RULES.heavy.includes("isn't at least 13")
  && WEAPON_PROPERTY_RULES.heavy.includes('Strength score')
  && WEAPON_PROPERTY_RULES.heavy.includes('Dexterity score'),
  'Heavy rule: Str 13 (melee) / Dex 13 (ranged)');
check(!/small|tiny/i.test(WEAPON_PROPERTY_RULES.heavy), 'Heavy rule has NO Small/Tiny (2014 rule gone)');
check(MASTERY_RULES.cleave.includes("takes the weapon's damage")
  && MASTERY_RULES.cleave.includes('once per turn')
  && MASTERY_RULES.cleave.includes("don't add your ability modifier"),
  'Cleave rule: second creature takes the WEAPON\'S DAMAGE, once per turn');
check(W['Club']?.mastery === 'slow', 'Club mastery = Slow');
check(FOCUSES.druidic.length === 3, 'Druidic Focus has THREE entries only');
check(!FOCUSES.druidic.some((f) => f.name === 'Totem'), 'No Totem druidic focus');
check(!moduleSrc.includes("'Totem'") && !moduleSrc.includes('"Totem"'), 'No Totem data entry anywhere in the module');
check(ARMOR_RULES.strength.includes('reduces the wearer')
  && ARMOR_RULES.strength.includes('10 feet')
  && ARMOR_RULES.strength.includes('equal to or higher'),
  'Armor Strength rule: speed −10 ft unless Str meets it');
check(A['Chain Mail']?.strengthRequirement === 13 && A['Splint']?.strengthRequirement === 15 && A['Plate']?.strengthRequirement === 15,
  'Str requirements present on Chain Mail 13 / Splint 15 / Plate 15');

// ------------------------------------------------------- Flag 1: ammo
group('FLAG 1 — book half-back recovery is NOT encoded');
check(AMMUNITION_RECOVERY.encoded === false, 'AMMUNITION_RECOVERY.encoded is false');
check(AMMUNITION_RECOVERY.bookRule.includes('recover half'), 'exclusion record names the book rule');
check(AMMUNITION_RECOVERY.ruling.includes('looting scene'), 'exclusion record cites the item-1 looting-scene ruling');
check(!WEAPON_PROPERTY_RULES.ammunition.includes('recover half'), 'Ammunition property text has NO half-back sentence');
check(WEAPON_PROPERTY_RULES.ammunition.includes('expended on use'), 'Ammunition text: expended on use');
check(WEAPON_PROPERTY_RULES.ammunition.includes('free hand to load'), 'Ammunition text: loading needs a free hand');
check(WEAPON_PROPERTY_RULES.ammunition.includes('Disadvantage on attack rolls within 5 ft'), 'Ammunition text: ranged-in-melee disadvantage');
check(!WEAPONS.some((w) => (w.rules || '').includes('recover half')), 'no weapon carries a half-back rule');
check(!ADVENTURING_GEAR.some((g) => (g.rules || '').includes('recover half')), 'no gear item carries a half-back rule');

// ------------------------------------------- other chapter tables (spot)
group('mounts / ships / services / tools spot checks');
check(MOUNTS.find((m) => m.name === 'Camel')?.carryingCapacityLb === 450, 'Camel capacity 450 lb');
check(MOUNTS.find((m) => m.name === 'Elephant')?.carryingCapacityLb === 1320, 'Elephant capacity 1,320 lb');
check(MOUNTS.find((m) => m.name === 'Warhorse')?.costCp === 40000, 'Warhorse 400 GP');
check(!('speedMph' in MOUNTS[0]) && !('speed' in MOUNTS[0]), 'mounts carry NO invented speed (p. 229 table has capacity + cost only)');
check(SHIPS.find((s) => s.name === 'Airship')?.costCp === 4000000, 'Airship 40,000 GP');
check(SHIPS.find((s) => s.name === 'Airship')?.hp === 300 && SHIPS.find((s) => s.name === 'Airship')?.ac === 13, 'Airship AC 13 / HP 300');
check(SHIPS.find((s) => s.name === 'Galley')?.damageThreshold === 20, 'Galley damage threshold 20');
check(SHIPS.find((s) => s.name === 'Rowboat')?.carryWeightLb === 100, 'Rowboat can be carried, 100 lb');
check(SHIPS.find((s) => s.name === 'Keelboat')?.cargoTons === 0.5, 'Keelboat cargo 1/2 ton');
check(SERVICES.lifestyles[0].name === 'Wretched' && SERVICES.lifestyles[0].costPerDayCp === 0, 'Wretched lifestyle Free');
check(SERVICES.lifestyles[6].name === 'Aristocratic' && SERVICES.lifestyles[6].costPerDayCp === 1000, 'Aristocratic lifestyle 10 GP/day');
check(SERVICES.spellcasting[0].costCp === 3000, 'spellcasting Cantrip 30 GP');
check(SERVICES.spellcasting[6].costCp === 10000000 && SERVICES.spellcasting[6].availability === 'city', 'spellcasting L9 100,000 GP, city only');
check(T['Herbalism Kit']?.crafts?.includes('Potion of Healing'), 'Herbalism Kit crafts Potion of Healing');
check(T["Smith's Tools"]?.crafts?.includes('Heavy armor'), "Smith's Tools craft Heavy armor");
check(T["Weaver's Tools"]?.crafts?.includes('Net'), "Weaver's Tools craft Net");
check(gpToCp(1.5) === 150 && gpToCp(0.05) === 5, 'gpToCp converts');
check(cpToGp(2500) === 25 && cpToGp(4) === 0.04, 'cpToGp converts');
check(findWeapon('longsword')?.damage === '1d8', 'findWeapon is case-insensitive');
check(findArmor('PLATE')?.baseAC === 18, 'findArmor is case-insensitive');
check(findPack("priest's pack")?.weightLb === 29, 'findPack is case-insensitive');
check(moduleSrc.includes('pp. 216'), 'module documents pp. 216–218 as not photographed');

// ------------------------------------------- equipment.json agreement
group('equipment.json agrees with the server module (overlapping fields)');
const bankWeapons = {};
for (const sec of ['simpleWeapons', 'martialWeapons']) {
  for (const cat of Object.values(bank[sec])) for (const w of cat) bankWeapons[w.name] = w;
}
check(Object.keys(bankWeapons).length === 41, `bank has 41 weapons — 38 chapter + 3 setting (got ${Object.keys(bankWeapons).length})`);
for (const [name, dmg, dt, props, range, vers, mastery, wt, cp] of CH_WEAPONS) {
  const j = bankWeapons[name];
  check(!!j, `bank weapon present: ${name}`);
  if (!j) continue;
  check(j.damage === dmg, `bank ${name} damage`);
  check(j.damageType === dt, `bank ${name} damageType`);
  check(JSON.stringify([...j.properties].sort()) === JSON.stringify([...props].sort()), `bank ${name} properties`);
  check(j.mastery === mastery, `bank ${name} mastery ${j.mastery} (want ${mastery})`);
  check(j.costCp === cp, `bank ${name} costCp ${j.costCp} (want ${cp})`);
  check((j.weight || 0) === (wt || 0), `bank ${name} weight ${j.weight} (want ${wt})`);
  if (vers) check(j.versatileDamage === vers, `bank ${name} versatileDamage`);
  if (range) check(j.range === range, `bank ${name} range`);
}
check(!bankWeapons['Net'], 'bank: Net is NOT a weapon');
check(!bank.druidicFocus.includes('Totem'), 'bank: no Totem druidic focus');
check(bank.druidicFocus.length === 3, 'bank: 3 druidic focuses');
const bankArmor = {};
for (const cat of ['light', 'medium', 'heavy']) for (const a of bank.armor[cat]) bankArmor[a.name] = a;
check(Object.keys(bankArmor).length === 12, 'bank has 12 armor');
for (const [name, ac, mx, st, sr, cp, wt] of CH_ARMOR) {
  const j = bankArmor[name];
  check(!!j, `bank armor present: ${name}`);
  if (!j) continue;
  check(j.baseAC === ac, `bank ${name} baseAC`);
  check(j.stealthDisadvantage === st, `bank ${name} stealth (Padded false / Studded true)`);
  check(j.costCp === cp, `bank ${name} costCp`);
  check(j.weight === wt, `bank ${name} weight`);
  check((j.strReq ?? null) === sr, `bank ${name} strReq`);
}
check(bank.armor.shields[0].name === 'Shield' && bank.armor.shields[0].acBonus === 2, 'bank Shield +2');
check(bank._meta.extras_2014.includes('Wooden Shield'), 'bank: Wooden Shield labeled a 2014 extra, not a chapter item');
check(bank._meta.extras_2014.includes('Abacus'), 'bank: Abacus labeled a 2014 extra');
check(bank.packs["Priest's Pack"].costCp === 3300, 'bank Priest\'s Pack 33 GP');
for (const [name, [cp, wt]] of Object.entries(CH_PACKS)) {
  const p = bank.packs[name];
  check(!!p, `bank pack present: ${name}`);
  if (!p) continue;
  check(p.costCp === cp, `bank ${name} costCp`);
  check(p.weight === wt, `bank ${name} weight ${p.weight} (want ${wt})`);
  // Every structured pack content name appears in the bank's contents strings.
  for (const [item] of CH_PACKS[name][2]) {
    check(p.contents.some((c) => String(c).toLowerCase().includes(item.toLowerCase().split(',')[0].trim())),
      `bank ${name} contents mention ${item}`);
  }
}
const bankGear = Object.fromEntries(bank.adventuringGear.map((g) => [g.name, g]));
check(bankGear['Net']?.costCp === 100 && bankGear['Net']?.weightLb === 3, 'bank gear: Net 1 GP / 3 lb');
check(bankGear['Map']?.costCp === 100, 'bank gear: Map 1 GP');
check(bankGear['String']?.costCp === 10, 'bank gear: String 1 SP');
check(bankGear['Rope']?.weightLb === 5, 'bank gear: Rope 5 lb');
check(bankGear['Spell Scroll (Cantrip)']?.costCp === 3000, 'bank gear: scroll Cantrip 30 GP');
check(bankGear['Spell Scroll (Level 1)']?.costCp === 5000, 'bank gear: scroll L1 50 GP');
check(bank.ammunition.find((a) => a.name === 'Firearm Bullets (10)')?.costCp === 300, 'bank ammo: Firearm Bullets 3 GP');
check(bank.mounts.find((m) => m.name === 'Camel')?.capacityLb === 450, 'bank mount: Camel 450 lb');
check(bank.mounts.find((m) => m.name === 'Mule')?.costCp === 800, 'bank mount: Mule 8 GP (was Donkey or Mule)');
check(bank.waterVehicles.find((s) => s.name === 'Airship')?.costCp === 4000000, 'bank ship: Airship 40,000 GP');
check(bank.musicalInstrumentDetails.find((i) => i.name === 'Lute')?.costCp === 3500, 'bank instrument: Lute 35 GP');
check(bank.arcaneFocusDetails.find((f) => f.name === 'Orb')?.costCp === 2000, 'bank focus: Orb 20 GP');
check(bank.holySymbolDetails.find((f) => f.name === 'Reliquary')?.costCp === 500, 'bank focus: Reliquary 5 GP');
check(bank.tack.find((t) => t.name === 'Feed (per day)')?.costCp === 5, 'bank tack: Feed 5 CP/day');
check(bank.tack.find((t) => t.name === 'Stabling (per day)')?.costCp === 50, 'bank tack: Stabling 5 SP/day');
check(Array.isArray(bank.musicalInstruments) && typeof bank.musicalInstruments[0] === 'string',
  'bank musicalInstruments stay a string array (choiceOptions.js any_instrument)');
check(Array.isArray(bank.arcaneFocus) && typeof bank.arcaneFocus[0] === 'string', 'bank arcaneFocus stays a string array');

// ------------------------------------------- combatStatsService agreement
group('combatStatsService WEAPON_DATA / ARMOR_DATA agree (damage + mastery)');
const combatWeaponNames = Object.keys(WEAPON_DATA).filter((n) => n !== 'Unarmed Strike');
check(combatWeaponNames.length === 41, `WEAPON_DATA has 41 weapons — 38 chapter + 3 setting (got ${combatWeaponNames.length})`);
for (const [name, dmg, dt, props, range, vers, mastery] of CH_WEAPONS) {
  const c = WEAPON_DATA[name];
  check(!!c, `WEAPON_DATA present: ${name}`);
  if (!c) continue;
  check(c.damage === dmg, `WEAPON_DATA ${name} damage ${c.damage} (want ${dmg})`);
  check(c.damageType === dt, `WEAPON_DATA ${name} damageType`);
  check(JSON.stringify([...c.properties].sort()) === JSON.stringify([...props].sort()), `WEAPON_DATA ${name} properties`);
  check(c.mastery === mastery, `WEAPON_DATA ${name} mastery ${c.mastery} (want ${mastery})`);
  check((c.range || null) === (range || null), `WEAPON_DATA ${name} range`);
  check((c.versatile || null) === (vers || null), `WEAPON_DATA ${name} versatile`);
}
check(WEAPON_DATA['Net'] === undefined, 'WEAPON_DATA has no Net');
check(lookupWeaponData('Net') === null, 'lookupWeaponData(Net) is null');
for (const [name, ac] of CH_ARMOR.map(([n, a]) => [n, a])) {
  const c = ARMOR_DATA[name];
  check(!!c, `ARMOR_DATA present: ${name}`);
  if (!c) continue;
  check(c.baseAC === ac, `ARMOR_DATA ${name} baseAC ${c.baseAC} (want ${ac})`);
}
check(ARMOR_DATA['Leather'].baseAC === 11, 'ARMOR_DATA uses canonical name Leather (not Leather Armor)');

// ---------------------------------------------------------------- footer
process.chdir(origCwd);
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
