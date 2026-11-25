// tests/repo-check-fixes-alignment-lifestyle.test.js — the creator's
// alignment and lifestyle descriptions say what the 2024 PHB says
// (repo-check-fixes-alignment-lifestyle, 2026-11-25).
//
// The book text is the brief's (docs/pm/repo-check-fixes-alignment-
// lifestyle/BRIEF.md), transcribed from Zach's photos of PHB pp. 39–40
// and 230–233. The file uses the typographic apostrophe (’); the brief's
// plain-text quotes use ', so apostrophes are compared normalised and
// nothing else is.
//
//   (a) the 8 rebuilt entries equal the book text, word for word;
//   (b) the entries the brief leaves alone are byte-identical to before
//       this job (True Neutral's key, label and parenthetical included);
//   (c) keys, order and costs unchanged;
//   (d) the Faith entries (deities.json None-alternatives) unchanged;
//   (e) the invented phrases the check flagged are gone.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const REPO = process.cwd();
const sc = await import(pathToFileURL(path.join(REPO, 'client/src/data/storyChoices.js')).href);
const norm = (s) => String(s ?? '').replace(/[’‘]/g, "'");

// The book's wording, exactly as the brief quotes it.
const BOOK = {
  alignment: {
    'Chaotic Good': "Chaotic Good creatures act as their conscience directs with little regard for what others expect. A rebel who waylays a cruel baron's tax collectors and uses the stolen money to help the poor is probably Chaotic Good.",
    'Neutral Evil': 'Neutral Evil is the alignment of those who are untroubled by the harm they cause as they pursue their desires. A criminal who robs and murders as they please is probably Neutral Evil.',
  },
  lifestyle: {
    Wretched: "You survive via chance and charity. You're often exposed to natural dangers as a result of sleeping outside.",
    Squalid: 'You spend the bare minimum for your necessities. You might be exposed to unhealthy conditions and opportunistic criminals.',
    Poor: 'You spend frugally for your necessities.',
    Modest: 'You support yourself at an average level.',
    Comfortable: 'You spend modestly for your necessities and enjoy a few luxuries.',
    Aristocratic: 'You pay for the best and might have a staff that supports your lifestyle. Others notice your wealth and might encourage you to share it, either legally or otherwise.',
  },
};

// The out-of-scope entries as they stood before this job (byte for byte).
const UNCHANGED_ALIGNMENTS = {
  'Lawful Good': 'You try to do the right thing as society expects it — the knight who fights injustice and protects the innocent without hesitation.',
  'Neutral Good': 'You do the best you can to help others as they need it, working within the rules without feeling bound by them.',
  'Lawful Neutral': 'You act by law, tradition, or a personal code — a disciplined way of life that neither pleas nor temptations sway.',
  'True Neutral': 'You steer clear of moral questions and take no side, doing what seems best at the time. (The 2024 rules call this alignment Neutral.)',
  'Chaotic Neutral': 'You follow your whims and value your own freedom above all else — the scoundrel who wanders the land living by their wits.',
  'Lawful Evil': 'You take what you want methodically, within the limits of a code, tradition, or loyalty — the aristocrat who exploits the people while scheming for power.',
  'Chaotic Evil': 'You act with arbitrary violence, driven by hatred or bloodlust.',
  'Unaligned': 'You claim none of the nine alignments. In the rules, a creature with no capacity for moral choice, such as a beast, has no alignment.',
};
const UNCHANGED_WEALTHY = 'A spacious home or the best rooms in town, fine food, and servants to attend you.';

group('(a) the 8 rebuilt entries are the book text');
for (const [key, text] of Object.entries(BOOK.alignment)) {
  check(norm(sc.ALIGNMENT_DESCRIPTIONS[key]) === text, `${key} is the book's wording (got ${JSON.stringify(sc.ALIGNMENT_DESCRIPTIONS[key])})`);
}
for (const [name, text] of Object.entries(BOOK.lifestyle)) {
  const entry = sc.LIFESTYLES.find((l) => l.name === name);
  check(norm(entry?.description) === text, `${name} is the book's wording (got ${JSON.stringify(entry?.description)})`);
}
check(sc.ALIGNMENT_DESCRIPTIONS['Chaotic Good'].includes('uses the stolen money to help the poor'), 'Chaotic Good keeps the clause that makes the rebel Good');
check(sc.LIFESTYLES.find((l) => l.name === 'Aristocratic').description.includes('Others notice your wealth'), 'Aristocratic keeps the book\'s second sentence');

group('(b) the entries the brief leaves alone are unchanged');
for (const [key, text] of Object.entries(UNCHANGED_ALIGNMENTS)) {
  check(sc.ALIGNMENT_DESCRIPTIONS[key] === text, `${key} is byte-identical to before`);
}
check('True Neutral' in sc.ALIGNMENT_DESCRIPTIONS && !('Neutral' in sc.ALIGNMENT_DESCRIPTIONS), "the key stays 'True Neutral' (not renamed to Neutral)");
check(sc.ALIGNMENT_DESCRIPTIONS['True Neutral'].endsWith('(The 2024 rules call this alignment Neutral.)'), 'True Neutral keeps its parenthetical');
check(sc.LIFESTYLES.find((l) => l.name === 'Wealthy')?.description === UNCHANGED_WEALTHY, 'Wealthy is byte-identical to before');

group('(c) keys, order and costs unchanged');
check(JSON.stringify(Object.keys(sc.ALIGNMENT_DESCRIPTIONS)) === JSON.stringify(['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', 'Unaligned']),
  'alignment keys and order unchanged');
check(JSON.stringify(sc.LIFESTYLES.map((l) => [l.name, l.costPerDayCp])) === JSON.stringify([['Wretched', 0], ['Squalid', 10], ['Poor', 20], ['Modest', 100], ['Comfortable', 200], ['Wealthy', 400], ['Aristocratic', 1000]]),
  'lifestyle names, order and daily costs unchanged');
check(sc.LIFESTYLES.every((l) => Object.keys(l).join() === 'name,costPerDayCp,description'), 'lifestyle entries carry the same three fields');

group('(d) the Faith entries are unchanged');
{
  const deities = JSON.parse(fs.readFileSync(path.join(REPO, 'client/src/data/deities.json'), 'utf8'));
  const list = Array.isArray(deities) ? deities : Object.values(deities);
  const atheist = list.find((d) => d?.name === 'Atheist');
  const agnostic = list.find((d) => d?.name === 'Agnostic');
  check(atheist?.description === 'Does not worship any deity', 'Faith: Atheist unchanged');
  check(agnostic?.description === 'Uncertain about the existence or nature of deities', 'Faith: Agnostic unchanged');
}

group('(e) the invented phrases are gone');
{
  const src = fs.readFileSync(path.join(REPO, 'client/src/data/storyChoices.js'), 'utf8');
  for (const phrase of ['whatever you can get away with', 'leaky stable', 'mud-floored hut', 'threadbare clothes', 'filling meals', 'private room at a good inn', 'This is the least it costs', 'scrounging for food']) {
    check(!src.includes(phrase), `"${phrase}" is gone`);
  }
  check(src.includes('UPDATE (repo-check-fixes-alignment-lifestyle, 2026-11-25)') && src.includes('NOT quotations'),
    'the header records this job and keeps the original note for the untouched entries');
}

console.log(`\n repo-check-fixes-alignment-lifestyle: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
