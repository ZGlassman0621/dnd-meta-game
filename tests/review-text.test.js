/**
 * Creator Review screen: player-facing text helpers (client/src/components/creator-next/reviewText.js).
 * Runs the real module against real data: the Cleric starting package, Aasimar's Light Bearer
 * trait, and the generated spell catalog. Also pins the other Review changes made with them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = (rel) => pathToFileURL(path.join(REPO, rel)).href;
let passed = 0;
let failed = 0;
function ok(cond, msg) { if (cond) { passed++; console.log(`  ✓ ${msg}`); } else { failed++; console.log(`  ✗ ${msg}`); } }

const { packageItemLines, grantedCantripText } = await import(url('client/src/components/creator-next/reviewText.js'));
const { listPackageOptions } = await import(url('server/services/packageResolutionService.js'));
const { resolveSpecies } = await import(url('server/services/speciesService.js'));
const catalog = JSON.parse(fs.readFileSync(path.join(REPO, 'client/src/data/spellCatalog.generated.json'), 'utf8'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

console.log('\n=== Starting equipment reads as items, never raw picks ===\n');
const cleric = listPackageOptions('cleric');
const lines = packageItemLines({ options: cleric.options }, 'A', { A: { holy: { alternative: 0 } } });
ok(lines.join('|') === 'Chain Shirt|Shield|Mace|Amulet|Priest\'s Pack|7 GP', `the cleric package lists every item with the chosen holy symbol (${lines.join(' | ')})`);
ok(!lines.some(l => /alternative|\{|\}/.test(l)), 'no raw pick JSON appears');
const lines2 = packageItemLines({ options: cleric.options }, 'A', { A: { holy: { alternative: 2 } } });
ok(lines2.includes('Reliquary') && !lines2.includes('Amulet'), 'a different holy symbol pick changes the list');
ok(packageItemLines({ options: cleric.options }, 'A', {}).some(l => /Holy Symbol: not chosen yet/.test(l)), 'an unmade choice says so in plain words');
ok(packageItemLines(null, 'A', {}).length === 0 && packageItemLines({ options: cleric.options }, 'Z', {}).length === 0, 'missing package data gives an empty list, never an error');

console.log('\n=== A granted cantrip trait shows the cantrip\'s description ===\n');
const aasimar = resolveSpecies('aasimar').entry;
const trait = (aasimar.traits || []).map(String).find(t => /Light Bearer/.test(t)) || '';
const note = trait.split(' - ')[1] || '';
ok(/You know the Light cantrip/.test(note), `Aasimar's trait text names the Light cantrip (${note})`);
const lightDesc = grantedCantripText(note, catalog.spells);
ok(/20-foot radius|bright light/.test(lightDesc), `the Light Bearer line shows what Light does (${lightDesc.slice(0, 60)}…)`);
ok(grantedCantripText('You know the Fire Bolt cantrip', catalog.spells).length > 0, 'a multi-word cantrip name resolves');
ok(grantedCantripText('Darkvision 60 feet', catalog.spells) === '' && grantedCantripText('', catalog.spells) === '', 'a trait that grants no cantrip gets no extra text');
ok(grantedCantripText('You know the Nonexistent cantrip', catalog.spells) === '', 'an unknown cantrip is never invented');

console.log('\n=== Other review changes ===\n');
const review = read('client/src/components/creator-next/Stage6ReviewCommit.jsx');
ok(!review.includes('A language already known can never be re-picked'), 'the internal languages note is gone');
ok(!review.includes('JSON.stringify(v)') && !review.includes('The server resolves these picks'), 'package picks are not dumped as JSON and no server-internals note remains');
ok(review.includes("standard_array: 'Standard Array'") && !review.includes('{state.generation_method || \'point_buy\'}.'), 'the generation method shows a readable name, not standard_array');
ok(review.includes("['Your pick']") && review.includes('breakdown.rows.some(r => r.choice)'), 'the ability table shows the pick column only when a species choice exists');
ok(review.includes('themeLocationOptions(theme, state).options.length > 0 && !state.themePathChoice'), 'Review requires the location pick whenever Stage 3 offers one (Folk Hero, Hermit)');
ok(!review.includes('Origin feats grant no ability increase in 2024'), 'the review no longer talks about a ruleset');

console.log('\n=== Stage 1 Versatile Magic Initiate no longer crashes ===\n');
// Choosing Magic Initiate as the Human Versatile feat rendered `prettify(l)`, which Stage 1 never
// defined: a ReferenceError that blanked the whole creator. Every creator stage that calls
// prettify() must define or import it.
for (const f of ['Stage1OriginIdentity', 'Stage2ClassCalling', 'Stage3PastPath', 'Stage4AbilitiesSkillsSpells', 'Stage5GearStory', 'Stage6ReviewCommit']) {
  const src = read(`client/src/components/creator-next/${f}.jsx`);
  const uses = /(?<![.\w$])prettify\(/.test(src);
  const defines = /function prettify\(|const prettify\b|import[^;\n]*\bprettify\b/.test(src);
  ok(!uses || defines, `${f}: prettify() is defined wherever it is called`);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
