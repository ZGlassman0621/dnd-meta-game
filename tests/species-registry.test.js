// tests/species-registry.test.js — server species registry (2026-11-04).
//
// The registry is the server's single source of truth for playable
// species: 29 entries (11 PHB/Volo/Eberron v1 + 18 Wildemount / Ravnica /
// Eberron) across 9 book files, merged by species id. Tests call the
// real service functions — never a re-implementation — and derive the
// expected total from the book files themselves, so the next book file
// updates one place. Outside-FR entries get their own test file;
// this file keeps the v1 assertions, updated where the new books
// changed the truth (goblin is now registered, so it resolves).
//
// What this does NOT test (honest scope): the DB-backed speedFor
// path in movementService (needs a combat row; the pure
// speedForSpecies logic is covered through walkSpeedFor plus static
// guards below, and Zach's full run covers the DB path), the HTTP
// route end-to-end (no route harness in this suite — static guards
// cover the mount), or the client shell (import audit + preview).
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;

const {
  listSpecies, resolveSpecies, walkSpeedFor, traitListFor,
  resolvedASIFor, innateSpellsFor, formatSpeciesLine, formatOriginLine,
  toClientShape,
} = await import(svc('server/services/speciesService.js'));
const { PHBSPECIES } = await import(svc('server/data/species/phbSpecies.js'));
const { PHBSPECIES2 } = await import(svc('server/data/species/phbSpecies2.js'));
const { VOLOSPECIES } = await import(svc('server/data/species/voloSpecies.js'));
const { EBERRONSPECIES } = await import(svc('server/data/species/eberronSpecies.js'));
const { WILDEMOUNTSPECIES } = await import(svc('server/data/species/wildemountSpecies.js'));
const { WILDEMOUNTSPECIES2 } = await import(svc('server/data/species/wildemountSpecies2.js'));
const { RAVNICASPECIES } = await import(svc('server/data/species/ravnicaSpecies.js'));
const { EBERRONSPECIES2 } = await import(svc('server/data/species/eberronSpecies2.js'));
const { EBERRONMARKS } = await import(svc('server/data/species/eberronMarks.js'));
const ALL_BOOK_FILES = [PHBSPECIES, PHBSPECIES2, VOLOSPECIES, EBERRONSPECIES, WILDEMOUNTSPECIES, WILDEMOUNTSPECIES2, RAVNICASPECIES, EBERRONSPECIES2, EBERRONMARKS];

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

group('registry completeness (totals derived from the book files)');
const bookIds = new Set(ALL_BOOK_FILES.flatMap(f => f.map(e => e.id)));
const species = listSpecies();
ok(species.length === bookIds.size, `registry length ${species.length} equals unique book-file ids ${bookIds.size}`);
ok(new Set(species.map(e => e.id)).size === species.length, 'species ids unique');
ok(species.every(e => e.id && e.name && e.description && e.size && e.speeds?.walk
  && Array.isArray(e.languages) && e.languages.length && e.source && e.origins?.length),
  'every entry has id, name, description, size, walk speed, languages, source, origins');
ok(species.every(e => (e.variants || []).every(v => v.name && v.description
  && Array.isArray(v.traits) && v.traits.length && v.resolvedASI)),
  'every variant has name, description, traits, resolvedASI');
ok(species.find(e => e.id === 'gnome')?.variants.some(v => v.name === 'Forest Gnome')
  && species.find(e => e.id === 'gnome')?.variants.some(v => v.name === 'Rock Gnome'), 'gnome in properly (Forest + Rock)');
ok(species.find(e => e.id === 'warforged')?.origins.includes('Eberron'), 'warforged origin is Eberron, not FR');

group('ASI resolution — never base + variant summed');
const db = resolvedASIFor('dragonborn', 'Black Dragonborn');
ok(db.str === 2 && db.cha === 1, 'dragonborn ancestry resolves Str+2/Cha+1, not the old +4/+2');
ok(resolvedASIFor('half-elf', 'Standard Half-Elf').choice === 2, 'standard half-elf: Cha+2 plus 2 picks');
ok(Object.keys(resolvedASIFor('human', 'Variant Human')).length === 0, 'variant human is retired — the 2024 entry has no ASI (PHB p. 194)');
ok(Object.keys(resolvedASIFor('human', null)).length === 0, 'human base ASI is empty — nothing shared to double-count');
ok(resolvedASIFor('dwarf', 'Mountain Dwarf').con === 2 && resolvedASIFor('dwarf', 'Mountain Dwarf').str === 2,
  'mountain dwarf resolves Con+2/Str+2');

group('speeds — variant speeds beat the species speed');
ok(walkSpeedFor('elf', 'Wood Elf') === 35, 'wood elf 35');
ok(walkSpeedFor('Wood Elf') === 35, 'wood elf stored as the species string still 35');
ok(walkSpeedFor('half-elf', 'Wood Elf Descent') === 35, 'wood elf descent 35');
ok(walkSpeedFor('dwarf') === 25 && walkSpeedFor('halfling') === 25 && walkSpeedFor('gnome') === 25,
  'dwarf / halfling / gnome 25');
ok(walkSpeedFor('goblin') === 30, 'goblin now registered at 30 (outside-FR build)');

group('aliases — old stored strings still resolve');
const drow = resolveSpecies('drow');
ok(drow?.entry.id === 'elf' && drow?.variant?.name === 'Dark Elf (Drow)', 'drow resolves to elf + Dark Elf (Drow)');
ok(drow.variant.replaces.includes('Darkvision (60 ft)'), 'drow replaces base darkvision with superior darkvision');
ok(resolveSpecies('Human')?.entry.id === 'human', 'Human (bank NPC spelling) resolves');
ok(resolveSpecies('dragonborn', 'Black Dragonborn')?.variant?.name === 'Black Dragonborn', 'species + variant resolve');
ok(resolveSpecies('goblin')?.entry.id === 'goblin', 'goblin now registered (outside-FR build)');
ok(resolveSpecies('kobold') === null && resolveSpecies('') === null && resolveSpecies(null) === null,
  'unknown / empty species -> null, never invented');

group('traits and innate spells');
ok(traitListFor('elf', 'Wood Elf').some(t => t.includes('Fleet of Foot')), 'wood elf traits carry Fleet of Foot');
ok(traitListFor('elf', null).some(t => t.includes('Trance')), 'base elf traits carry Trance');
ok(innateSpellsFor('elf', 'Dark Elf (Drow)').some(s => s.name === 'Darkness'), 'drow innate Darkness');
ok(innateSpellsFor('tiefling', null).some(s => s.name === 'Thaumaturgy'), 'tiefling innate Thaumaturgy');
ok(innateSpellsFor('aasimar', null).some(s => s.name === 'Light'), 'aasimar innate Light');
const line = formatSpeciesLine('elf', 'Wood Elf');
ok(line.includes('Speed 35 ft') && line.includes('Mask of the Wild'), 'species line carries speed + traits');

group('origin lines — shown as written, flagged when missing, never invented');
ok(formatOriginLine('Eberron', 'Khorvaire', 'Storm threw my airship through a gate.', 'warforged')
  .includes('Storm threw my airship'), 'stored explanation shown as written');
ok(formatOriginLine('Eberron', 'Khorvaire', '', 'warforged').includes('REQUIRED, not yet recorded'),
  'outside-FR origin without explanation is flagged');
ok(formatOriginLine('', '', '', 'warforged').includes('REQUIRED, not yet recorded'),
  'warforged with no origin stored is flagged (not native to FR)');
ok(formatOriginLine('', '', '', 'elf') === '', 'FR species with no origin stored gets no line (silence, not invention)');
ok(formatOriginLine('Forgotten Realms', 'Sword Coast', '', 'elf') === 'Origin: Forgotten Realms — Sword Coast',
  'plain FR origin line');

group('client shape for /api/species and the creator shell');
const client = toClientShape(species.find(e => e.id === 'elf'));
ok(client.speed === 30 && client.variants.find(v => v.name === 'Wood Elf')?.speed === 35,
  'client shape carries base + variant speeds');
ok(client.origins.some(o => o.setting === '__other__' && o.outsideFR),
  'client shape appends the __other__ origin picker option');
ok(client.variants.every(v => v.resolvedASI && Array.isArray(v.replaces)),
  'client variants carry resolvedASI + replaces');

group('wiring static guards (live call paths)');
const movementSrc = fs.readFileSync(path.join(REPO, 'server/services/movementService.js'), 'utf8');
ok(movementSrc.includes('walkSpeedFor'), 'movement imports the registry speed lookup');
ok(movementSrc.includes('row?.subrace'), 'movement passes the player subrace to the lookup');
ok(movementSrc.includes('companion_subrace'), 'movement passes the companion subrace to the lookup');
const promptSrc = fs.readFileSync(path.join(REPO, 'server/services/dmPromptBuilder.js'), 'utf8');
ok(promptSrc.includes("from './speciesService.js'"), 'DM prompt imports the species service');
ok((promptSrc.match(/formatSpeciesLine\(/g) || []).length >= 3, 'DM prompt reads species lines (PC + NPC + companion)');
ok((promptSrc.match(/formatOriginLine\(/g) || []).length >= 2, 'DM prompt reads origin lines (PC + NPC)');
const indexSrc = fs.readFileSync(path.join(REPO, 'server/index.js'), 'utf8');
ok(indexSrc.includes("app.use('/api/species', speciesRoutes)"), 'server mounts /api/species');
const routeSrc = fs.readFileSync(path.join(REPO, 'server/routes/species.js'), 'utf8');
ok(routeSrc.includes("router.get('/',") && routeSrc.includes("router.get('/:id',"), 'species route serves list + single');
const shellSrc = fs.readFileSync(path.join(REPO, 'client/src/components/creator-next/CreatorNextShell.jsx'), 'utf8');
ok(shellSrc.includes("fetch('/api/species')"), 'creator shell fetches the registry');

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
