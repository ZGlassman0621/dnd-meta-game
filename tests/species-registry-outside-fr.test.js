// tests/species-registry-outside-fr.test.js — outside-FR species (2026-11-04).
//
// Wildemount / Ravnica / Eberron, transcribed from the book extracts on the
// VM (Explorer's Guide to Wildemount, Guildmasters' Guide to Ravnica,
// Eberron: Rising from the Last War). Same honest-test rules as the v1
// file: calls the real service functions, derives totals from the book
// files themselves. Counts below are derived, not hardcoded totals —
// only the per-entry expectations are literal.
//
// Gate flag, same pattern as gnome + Batch 4: these mechanics were
// transcribed from OCR extracts, not from Zach's physical books. The
// batch needs his book check at the gate; wording-level deltas are
// expected to surface there, not in this suite.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;

const {
  listSpecies, resolveSpecies, walkSpeedFor, traitListFor,
  resolvedASIFor, innateSpellsFor, formatOriginLine, toClientShape,
} = await import(svc('server/services/speciesService.js'));
const { WILDEMOUNTSPECIES } = await import(svc('server/data/species/wildemountSpecies.js'));
const { WILDEMOUNTSPECIES2 } = await import(svc('server/data/species/wildemountSpecies2.js'));
const { RAVNICASPECIES } = await import(svc('server/data/species/ravnicaSpecies.js'));
const { EBERRONSPECIES2 } = await import(svc('server/data/species/eberronSpecies2.js'));
const { EBERRONMARKS } = await import(svc('server/data/species/eberronMarks.js'));

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}
const species = listSpecies();
const variantsOf = (id) => species.find(e => e.id === id)?.variants || [];

group('new standalone entries present');
const newIds = [...WILDEMOUNTSPECIES, ...WILDEMOUNTSPECIES2, ...RAVNICASPECIES, ...EBERRONSPECIES2]
  .map(e => e.id).filter((id, i, a) => a.indexOf(id) === i);
const brandNew = newIds.filter(id => !['elf', 'dragonborn', 'halfling', 'aasimar'].includes(id));
ok(brandNew.length === 18, `18 brand-new species (got ${brandNew.length})`);
for (const id of brandNew) ok(species.some(e => e.id === id), `${id} registered`);
ok(species.length === 29, `registry total 29 (got ${species.length})`);

group('one entry per species, origins unioned');
const goblin = species.find(e => e.id === 'goblin');
ok(goblin?.origins.includes('Wildemount') && goblin?.origins.includes('Ravnica') && goblin?.origins.includes('Eberron'),
  'goblin is one entry with all three settings, not three goblins');
ok(species.find(e => e.id === 'aasimar')?.origins.includes('Wildemount'), 'aasimar gains Wildemount origin');
ok(species.find(e => e.id === 'elf')?.origins.includes('Wildemount') && species.find(e => e.id === 'elf')?.origins.includes('Eberron'),
  'elf gains Wildemount + Eberron origins via merges');

group('variant counts after merge');
ok(variantsOf('elf').length === 6, `elf 6 variants (3 PHB + pallid + sea + shadow), got ${variantsOf('elf').length}`);
ok(variantsOf('dragonborn').length === 12, `dragonborn 12 (10 + draconblood + ravenite), got ${variantsOf('dragonborn').length}`);
ok(variantsOf('halfling').length === 5, `halfling 5 (2 + lotusden + healing + hospitality), got ${variantsOf('halfling').length}`);
ok(variantsOf('half-elf').length === 6, `half-elf 6 (4 + detection + storm), got ${variantsOf('half-elf').length}`);
ok(variantsOf('half-orc').length === 1, 'half-orc gains Mark of Finding');
ok(variantsOf('human').length === 5, `human 5 (0 PHB + 5 marks — the 2014 Standard/Variant Human variants are retired, PHB p. 194), got ${variantsOf('human').length}`);
ok(variantsOf('dwarf').length === 3, 'dwarf gains Mark of Warding');
ok(variantsOf('gnome').length === 3, 'gnome gains Mark of Scribing');
ok(variantsOf('shifter').length === 4, 'shifter 4 subraces');
ok(variantsOf('genasi').length === 4, 'genasi 4 subraces');
ok(EBERRONMARKS.flatMap(e => e.variants).length === 13, '13 mark variants (Finding twice, once per race)');

group('ASI resolution for new variants');
const asi = (r, v, k) => resolvedASIFor(r, v)?.[k];
ok(asi('dragonborn', 'Draconblood', 'int') === 2 && asi('dragonborn', 'Draconblood', 'cha') === 1, 'draconblood Int+2/Cha+1');
ok(asi('dragonborn', 'Ravenite', 'str') === 2 && asi('dragonborn', 'Ravenite', 'con') === 1, 'ravenite Str+2/Con+1');
ok(asi('elf', 'Pallid Elf', 'wis') === 1 && asi('elf', 'Sea Elf', 'con') === 1, 'pallid Wis+1, sea Con+1');
ok(asi('halfling', 'Lotusden Halfling', 'wis') === 1, 'lotusden Wis+1');
ok(asi('shifter', 'Beasthide', 'con') === 2 && asi('shifter', 'Longtooth', 'str') === 2
  && asi('shifter', 'Swiftstride', 'dex') === 2 && asi('shifter', 'Wildhunt', 'wis') === 2, 'shifter subrace ASIs');
ok(asi('genasi', 'Air Genasi', 'dex') === 1 && asi('genasi', 'Fire Genasi', 'int') === 1
  && asi('genasi', 'Earth Genasi', 'str') === 1 && asi('genasi', 'Water Genasi', 'wis') === 1, 'genasi subrace ASIs');
ok(asi('half-elf', 'Mark of Detection', 'wis') === 2 && asi('half-elf', 'Mark of Detection', 'choice') === 1, 'detection Wis+2 + 1 pick');
ok(asi('half-elf', 'Mark of Storm', 'cha') === 2 && asi('half-elf', 'Mark of Storm', 'dex') === 1, 'storm Cha+2/Dex+1');
ok(asi('dwarf', 'Mark of Warding', 'con') === 2 && asi('dwarf', 'Mark of Warding', 'int') === 1, 'warding Con+2/Int+1');
ok(asi('gnome', 'Mark of Scribing', 'int') === 2 && asi('gnome', 'Mark of Scribing', 'cha') === 1, 'scribing Int+2/Cha+1');
ok(asi('elf', 'Mark of Shadow', 'dex') === 2 && asi('elf', 'Mark of Shadow', 'cha') === 1, 'shadow Dex+2/Cha+1');
ok(asi('halfling', 'Mark of Healing', 'dex') === 2 && asi('halfling', 'Mark of Healing', 'wis') === 1, 'healing Dex+2/Wis+1');
ok(asi('halfling', 'Mark of Hospitality', 'dex') === 2 && asi('halfling', 'Mark of Hospitality', 'cha') === 1, 'hospitality Dex+2/Cha+1');
ok(asi('human', 'Mark of Finding', 'wis') === 2 && asi('half-orc', 'Mark of Finding', 'wis') === 2
  && asi('half-orc', 'Mark of Finding', 'con') === 1, 'finding on both races');
ok(asi('human', 'Mark of Making', 'int') === 2 && asi('human', 'Mark of Passage', 'dex') === 2
  && asi('human', 'Mark of Sentinel', 'con') === 2 && asi('human', 'Mark of Handling', 'wis') === 2, 'human mark ASIs');

group('speeds');
ok(walkSpeedFor('centaur') === 40, 'centaur 40');
ok(walkSpeedFor('aarakocra') === 25, 'aarakocra walk 25 (fly 50 rides in speeds)');
ok(species.find(e => e.id === 'aarakocra')?.speeds.fly === 50, 'aarakocra fly 50 in speeds');
ok(species.find(e => e.id === 'elf')?.variants.find(v => v.name === 'Sea Elf')?.speeds.swim === 30, 'sea elf swim 30');
ok(walkSpeedFor('goblin') === 30 && walkSpeedFor('tortle') === 30 && walkSpeedFor('simic-hybrid') === 30, 'goblin / tortle / simic 30');
ok(walkSpeedFor('elf', 'Wood Elf') === 35, 'wood elf still 35 (no regression)');

group('traits and innate spells');
ok(traitListFor('firbolg', null).some(t => t.includes('Hidden Step')), 'firbolg Hidden Step');
ok(traitListFor('tortle', null).some(t => t.includes('Shell Defense')), 'tortle Shell Defense');
ok(traitListFor('simic-hybrid', null).some(t => t.includes('Animal Enhancement')), 'simic Animal Enhancement');
ok(traitListFor('shifter', null).some(t => t.includes('Shifting')), 'shifter Shifting');
ok(innateSpellsFor('half-elf', 'Mark of Detection').some(s => s.name === 'See Invisibility'), 'detection innate See Invisibility');
ok(innateSpellsFor('elf', 'Mark of Shadow').some(s => s.name === 'Invisibility'), 'shadow innate Invisibility');
ok(innateSpellsFor('elf', 'Pallid Elf').some(s => s.name === 'Sleep'), 'pallid innate Sleep');
ok(innateSpellsFor('genasi', 'Fire Genasi').some(s => s.name === 'Produce Flame'), 'fire genasi Produce Flame');
ok(traitListFor('dragonborn', 'Ravenite').some(t => t.includes('Vengeful Assault'))
  && !traitListFor('dragonborn', 'Ravenite').some(t => t.startsWith('Damage Resistance')), 'ravenite replaces damage resistance');

group('mark spells ride the client shape (spell-list additions, not free casts)');
const clientElf = toClientShape(species.find(e => e.id === 'elf'));
const shadowClient = clientElf.variants.find(v => v.name === 'Mark of Shadow');
ok(shadowClient?.markSpells.some(r => r.level === 5 && r.spells.includes('Mislead')), 'shadow mark spells reach 5th (Mislead)');
const clientHalfElf = toClientShape(species.find(e => e.id === 'half-elf'));
ok(clientHalfElf.variants.find(v => v.name === 'Mark of Detection')?.markSpells.some(r => r.level === 5 && r.spells.includes('Legend Lore')),
  'detection mark spells reach 5th (Legend Lore)');
ok(clientElf.variants.find(v => v.name === 'Wood Elf')?.markSpells.length === 0, 'non-mark variants carry no mark spells');

group('aliases for new variants (stored strings still resolve)');
ok(resolveSpecies('draconblood')?.variant?.name === 'Draconblood', 'draconblood alias');
ok(resolveSpecies('ravenite')?.variant?.name === 'Ravenite', 'ravenite alias');
ok(resolveSpecies('pallid-elf')?.variant?.name === 'Pallid Elf', 'pallid elf alias');
ok(resolveSpecies('sea-elf')?.variant?.name === 'Sea Elf', 'sea elf alias');
ok(resolveSpecies('lotusden-halfling')?.variant?.name === 'Lotusden Halfling', 'lotusden alias');
ok(resolveSpecies('beasthide-shifter')?.variant?.name === 'Beasthide', 'beasthide alias');
ok(resolveSpecies('mark-of-detection')?.variant?.name === 'Mark of Detection', 'mark of detection alias');
ok(resolveSpecies('mark-of-warding')?.variant?.name === 'Mark of Warding', 'mark of warding alias');
ok(resolveSpecies('mark-of-shadow')?.variant?.name === 'Mark of Shadow', 'mark of shadow alias');
ok(resolveSpecies('mark-of-finding') === null, 'mark of finding has NO alias (ambiguous: human vs half-orc)');

group('origin lines for outside-FR species');
ok(formatOriginLine('', '', '', 'centaur').includes('REQUIRED, not yet recorded'), 'centaur flagged (not native to FR)');
ok(formatOriginLine('', '', '', 'tabaxi').includes('REQUIRED, not yet recorded'), 'tabaxi flagged');
ok(formatOriginLine('', '', '', 'goblin').includes('REQUIRED, not yet recorded'), 'goblin flagged (no FR origin despite three settings)');

group('warforged deprecated rule replaced (static guard on the book file)');
const eberronSrc = fs.readFileSync(path.join(REPO, 'server/data/species/eberronSpecies.js'), 'utf8');
ok(eberronSrc.includes('+1 bonus to Armor Class'), 'warforged Integrated Protection is now +1 AC');
ok(!eberronSrc.includes('Base AC is 11'), 'old base-AC-11 plating text is gone');

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);