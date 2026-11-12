// tests/catalog-gaps-otto-mansion-sword.test.js — 3-catalog-gaps job
// (2026-11-07, 2024 PHB Wizard spell list p. 170).
//
// What was wrong: the three spells existed in the catalog under their
// SRD 5.2 short names — "irresistible dance", "magnificent mansion",
// "arcane sword" — all mis-tagged source "PHB 2024". The 2024 PHB did
// NOT rename them: p. 170 prints "Otto's Irresistible Dance" (L6),
// "Mordenkainen's Magnificent Mansion" (L7) and "Mordenkainen's Sword"
// (L7). A lookup by PHB name failed, so the Wizard reconciliation
// recorded them as absent. The catalog's convention is PHB names
// (cf. bigby's hand, evard's black tentacles, tasha's hideous
// laughter) — these three were the odd ones out.
//
// The fix is a RENAME, not an addition: adding three new entries would
// duplicate three spells (586 entries, 3 doubles). The count stays 583.
// The SRD short names live on as aliases at the lookup boundary only.
//
// The Sword entry also held 2014 values: range 60 ft (2024: 90 ft),
// damage 3d10 (2024: 4d12 + spellcasting ability modifier — stored as
// addCastingMod, the same shape spiritual weapon uses, resolved by
// spellCastService / partyAttackService / enemySpellService), repeat
// move 20 ft (2024: 30 ft). All three corroborated by D&D Beyond 2024,
// Roll20 2024, SRD 5.2, AnyFlip 2024 PHB p. 303 (≥2 sources/field).
//
// Pure data test — no database. If spellCatalogData.js were deleted,
// the imports fail and the suite fails with it.
//
// MUTATION CHECK (2026-11-07): run against the pre-fix catalog
// (SRD keys, Sword 3d10/60 ft, no aliases) — groups (a)/(b)/(c)/(d)/
// (e)/(g) all trip. A passing run therefore proves the rename, not
// the test's shape.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// file:// URLs, not bare paths: on Windows a bare absolute path
// ('E:\...') is rejected by the ESM loader (ERR_UNSUPPORTED_ESM_URL_SCHEME).
const catalog = await import(pathToFileURL(path.join(ROOT, 'server/data/spellCatalogData.js')).href);
const logic = await import(pathToFileURL(path.join(ROOT, 'server/data/spellCatalog.js')).href);
const selection = await import(pathToFileURL(path.join(ROOT, 'server/services/spellSelectionService.js')).href);

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log(`\n== ${name}`); }

const { SPELL_DATA_ENTRIES, SPELL_DATA_EFFECTS } = catalog;
const { lookupSpell, spellEffectSpec } = logic;
const { canonicalizeSpellName } = selection;

group('(a) the three PHB names exist with correct level/school/classes/source');
const dance = SPELL_DATA_ENTRIES["otto's irresistible dance"];
check(dance && dance.level === 6, "otto's irresistible dance is 6th level");
check(dance?.school === 'Enchantment', "otto's irresistible dance is Enchantment");
check(Array.isArray(dance?.classes) && dance.classes.includes('Bard') && dance.classes.includes('Wizard'),
  "otto's irresistible dance lists Bard + Wizard");
check(dance?.source === 'PHB 2024', "otto's irresistible dance is tagged PHB 2024");
const mansion = SPELL_DATA_ENTRIES["mordenkainen's magnificent mansion"];
check(mansion && mansion.level === 7, "mordenkainen's magnificent mansion is 7th level");
check(mansion?.school === 'Conjuration', "mordenkainen's magnificent mansion is Conjuration");
check(Array.isArray(mansion?.classes) && mansion.classes.includes('Bard') && mansion.classes.includes('Wizard'),
  "mordenkainen's magnificent mansion lists Bard + Wizard");
check(mansion?.source === 'PHB 2024', "mordenkainen's magnificent mansion is tagged PHB 2024");
const sword = SPELL_DATA_ENTRIES["mordenkainen's sword"];
check(sword && sword.level === 7, "mordenkainen's sword is 7th level");
check(sword?.school === 'Evocation', "mordenkainen's sword is Evocation");
check(Array.isArray(sword?.classes) && sword.classes.includes('Bard') && sword.classes.includes('Wizard'),
  "mordenkainen's sword lists Bard + Wizard");
check(sword?.source === 'PHB 2024', "mordenkainen's sword is tagged PHB 2024");

group('(b) the SRD short names are gone as catalog keys (rename, not duplicate)');
check(!('irresistible dance' in SPELL_DATA_ENTRIES), 'no "irresistible dance" key');
check(!('magnificent mansion' in SPELL_DATA_ENTRIES), 'no "magnificent mansion" key');
check(!('arcane sword' in SPELL_DATA_ENTRIES), 'no "arcane sword" key');
check(!('arcane sword' in SPELL_DATA_EFFECTS), 'no "arcane sword" EFFECTS key');

group('(c) the catalog count stays 583');
check(Object.keys(SPELL_DATA_ENTRIES).length === 583,
  `catalog holds 583 entries (got ${Object.keys(SPELL_DATA_ENTRIES).length})`);

group('(d) the Sword holds 2024 values, not 2014');
check(sword?.range === '90 feet', `sword range is 90 feet (got ${sword?.range})`);
check(sword?.castTime === '1 action', 'sword cast time is 1 action');
check(sword?.duration === 'Concentration, up to 1 minute' && sword?.concentration === true,
  'sword duration is Concentration, up to 1 minute');
const swordFx = SPELL_DATA_EFFECTS["mordenkainen's sword"];
check(swordFx?.damage === '4d12' && swordFx?.damageType === 'force',
  `sword EFFECTS is 4d12 force (got ${swordFx?.damage} ${swordFx?.damageType})`);
check(swordFx?.addCastingMod === true, 'sword EFFECTS carries addCastingMod (spellcasting ability modifier)');
const swordSpec = spellEffectSpec("Mordenkainen's Sword", {});
check(swordSpec && swordSpec.kind === 'damage' && swordSpec.count === 4 && swordSpec.sides === 12
  && swordSpec.addCastingMod === true && swordSpec.damageType === 'force',
  'spellEffectSpec resolves the sword as 4d12 force + casting mod');

group('(e) the SRD short names resolve via the alias map at the lookup boundary');
check(canonicalizeSpellName('irresistible dance') === "otto's irresistible dance",
  'alias: irresistible dance -> otto\'s irresistible dance');
check(canonicalizeSpellName('magnificent mansion') === "mordenkainen's magnificent mansion",
  'alias: magnificent mansion -> mordenkainen\'s magnificent mansion');
check(canonicalizeSpellName('arcane sword') === "mordenkainen's sword",
  "alias: arcane sword -> mordenkainen's sword");
check(canonicalizeSpellName('Arcane Sword') === "mordenkainen's sword",
  'alias lookup is case-insensitive');
check(lookupSpell(canonicalizeSpellName('arcane sword'))?.level === 7,
  'aliased sword name resolves to the catalog entry');

group('(f) lookups by PHB name work; bare SRD names are not catalog keys');
check(lookupSpell("Otto's Irresistible Dance")?.level === 6, "lookupSpell finds Otto's Irresistible Dance");
check(lookupSpell("Mordenkainen's Magnificent Mansion")?.level === 7, "lookupSpell finds Mordenkainen's Magnificent Mansion");
check(lookupSpell("Mordenkainen's Sword")?.level === 7, "lookupSpell finds Mordenkainen's Sword");
check(lookupSpell('irresistible dance') === null, 'bare SRD name "irresistible dance" is not a catalog key');
check(lookupSpell('arcane sword') === null, 'bare SRD name "arcane sword" is not a catalog key');

group('(g) descriptions carry the 2024 mechanics, not the old false claims');
check(!/once named for Otto/i.test(dance?.description || ''),
  'dance description no longer claims the 2024 name replaced Otto\'s');
check(/Wisdom saving throw/i.test(dance?.description || '') && /Charmed condition/i.test(dance?.description || ''),
  'dance description states the Wisdom save and the Charmed condition');
check(!/older printings/i.test(sword?.description || ''),
  'sword description no longer claims Mordenkainen is an older printing');
check(/4d12 force damage plus your spellcasting ability modifier/i.test(sword?.description || ''),
  'sword description states 4d12 + spellcasting ability modifier');
check(/30 feet/i.test(sword?.description || ''), 'sword description states the 30 ft bonus-action move');
check(/fifty contiguous 10-foot cubes/i.test(mansion?.description || ''),
  'mansion description states fifty contiguous 10-foot cubes (not fifty rooms)');
check(!/fifty furnished rooms/i.test(mansion?.description || ''),
  'mansion description no longer says fifty furnished rooms');
check(/nine-course banquet/i.test(mansion?.description || ''), 'mansion description keeps the nine-course banquet');

group('(h) the regenerated dataset agrees with the catalog');
const generated = JSON.parse(fs.readFileSync(path.join(ROOT, 'client/src/data/spellCatalog.generated.json'), 'utf8'));
check(generated.spellCount === 583, `generated catalog spellCount is 583 (got ${generated.spellCount})`);
check((generated.spells || []).length === 583, `generated catalog holds 583 spells (got ${(generated.spells || []).length})`);
const byKey = Object.fromEntries((generated.spells || []).map((s) => [s.key, s]));
check(byKey["otto's irresistible dance"]?.level === 6, 'generated catalog has otto\'s irresistible dance at 6th');
check(byKey["mordenkainen's magnificent mansion"]?.level === 7, "generated catalog has mordenkainen's magnificent mansion at 7th");
check(byKey["mordenkainen's sword"]?.level === 7 && byKey["mordenkainen's sword"]?.range === '90 feet',
  "generated catalog has mordenkainen's sword at 7th with 90 ft range");
check(!byKey['irresistible dance'] && !byKey['magnificent mansion'] && !byKey['arcane sword'],
  'generated catalog has none of the SRD short names');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
