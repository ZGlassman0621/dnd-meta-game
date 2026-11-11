// tests/creator-next-stage2.test.js — creator-next Stage 2 services
// (2026-11-04, overnight Stage 2 build).
//
// Honest integration tests: every assertion calls the REAL
// cantripResolutionService / classValidationService functions.
// No logic is re-implemented here — if either service file were
// deleted, these imports fail and the suite fails with it.
// Pure services only: no database is touched, so this runs with
// plain `node tests/creator-next-stage2.test.js`.
//
// Coverage required by the Stage 2 brief: species cantrip
// resolution, dedup across sources, granted-never-count flag,
// non-caster with a cantrip source, unknown class/subclass
// rejected with the field named, valid class+subclass passes.
// Plus the two gap behaviors the services encode: a species
// `choose` entry is a pending choice (never an invented spell),
// and the Eldritch Knight example cantrip list grants nothing.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;

const {
  resolveCantrips, grantedCantripsNeverCount, GRANTED_CANTRIPS_NEVER_COUNT,
} = await import(svc('server/services/cantripResolutionService.js'));
const {
  validateClassSubclass, REGISTRY_CLASSES,
} = await import(svc('server/services/classValidationService.js'));

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}
const names = (r) => r.cantrips.map(c => c.spell);

// --- Cantrip resolution -------------------------------------------------
group('species cantrip resolution');
{
  const r = resolveCantrips({ species: 'elf', variant: 'Dark Elf (Drow)' });
  ok(names(r).includes('Dancing Lights'), 'drow elf resolves Dancing Lights');
  const drow = r.cantrips.find(c => c.spell === 'Dancing Lights');
  ok(drow?.source === 'species' && drow?.granted === true, 'drow cantrip is { source: species, granted: true }');
  ok(!names(r).includes('Faerie Fire'), 'levelled innate spells (Faerie Fire) are not cantrips');
}

group('dedup across sources');
{
  const r = resolveCantrips({
    species: 'elf', variant: 'Dark Elf (Drow)',
    featCantrips: ['Dancing Lights', 'Light'],
  });
  ok(names(r).filter(n => n === 'Dancing Lights').length === 1, 'Dancing Lights appears once across species + feat');
  ok(names(r).includes('Light'), 'feat cantrip Light also resolves');
  const first = r.cantrips.find(c => c.spell === 'Dancing Lights');
  ok(first?.source === 'species', 'first source (species) wins on a repeat');
}

group('granted-never-count flag');
{
  ok(grantedCantripsNeverCount() === true, 'grantedCantripsNeverCount() is true');
  ok(GRANTED_CANTRIPS_NEVER_COUNT === true, 'GRANTED_CANTRIPS_NEVER_COUNT is true');
  const r = resolveCantrips({ species: 'elf', variant: 'Dark Elf (Drow)' });
  ok(r.grantedNeverCount === true, 'resolve result carries grantedNeverCount: true');
  ok(r.cantrips.every(c => c.granted === true), 'every granted item has granted: true');
}

group('non-caster with a cantrip source shows it');
{
  const r = resolveCantrips({ species: 'elf', variant: 'Dark Elf (Drow)', classId: 'fighter', subclass: 'Champion' });
  ok(names(r).includes('Dancing Lights'), 'fighter (non-caster) with drow species shows Dancing Lights');
}

group('subclass cantrip grants (structured-field gap, handled)');
{
  const spores = resolveCantrips({ classId: 'druid', subclass: 'Circle of Spores' });
  ok(names(spores).includes('Chill Touch'), 'Circle of Spores grants Chill Touch from mechanics.cantrip');
  ok(spores.cantrips.find(c => c.spell === 'Chill Touch')?.source === 'subclass', 'Spores cantrip source is subclass');
  const grave = resolveCantrips({ classId: 'cleric', subclass: 'Grave Domain' });
  ok(names(grave).includes('Spare the Dying'), 'Grave Domain grants Spare the Dying from its sentence grant');
  const archer = resolveCantrips({
    classId: 'fighter', subclass: 'Arcane Archer',
    subclassChoices: { arcane_archer_lore_cantrip: 'Druidcraft' },
  });
  ok(names(archer).includes('Druidcraft'), 'picked Arcane Archer lore cantrip grants once chosen');
  const archerUnpicked = resolveCantrips({ classId: 'fighter', subclass: 'Arcane Archer' });
  ok(!names(archerUnpicked).includes('Druidcraft') && !names(archerUnpicked).includes('Prestidigitation'),
    'unpicked Arcane Archer lore cantrip grants nothing (choice, not grant)');
  const ek = resolveCantrips({ classId: 'fighter', subclass: 'Eldritch Knight' });
  ok(ek.cantrips.length === 0, 'Eldritch Knight example cantrip list grants nothing');
  const moon = resolveCantrips({ classId: 'bard', subclass: 'College of the Moon' });
  ok(moon.cantrips.length === 0 && moon.choicesPending.length > 0,
    'College of the Moon “one cantrip from the Druid list” is pending, not invented');
}

group('species choice is pending, never invented');
{
  const r = resolveCantrips({ species: 'elf', variant: 'High Elf' });
  ok(r.cantrips.length === 0, 'High Elf choose-1 cantrip grants no concrete spell');
  ok(r.choicesPending.some(p => p.source === 'species'), 'High Elf choice is recorded as species choicesPending');
}

group('feat cantrips are filtered to level 0');
{
  const r = resolveCantrips({ featCantrips: ['Light', 'Fireball'] });
  ok(names(r).includes('Light'), 'feat cantrip Light resolves');
  ok(!names(r).includes('Fireball'), 'levelled feat spell Fireball is not a cantrip');
  const feat = r.cantrips.find(c => c.spell === 'Light');
  ok(feat?.source === 'feat', 'feat cantrip source is feat');
}

// --- Class/subclass validation ------------------------------------------
group('class/subclass validation');
{
  ok(REGISTRY_CLASSES.length === 12, 'registry covers 12 classes');
  const valid = validateClassSubclass({ classId: 'fighter', subclassId: 'Champion' });
  ok(valid.ok === true && valid.errors.length === 0, 'valid fighter + Champion passes');
  ok(valid.entry?.name === 'Champion', 'valid result carries the registry entry');
  const validCleric = validateClassSubclass({ classId: 'cleric', subclassId: 'Life Domain' });
  ok(validCleric.ok === true, 'valid cleric + Life Domain passes');

  const badClass = validateClassSubclass({ classId: 'no-such-class', subclassId: 'Champion' });
  ok(badClass.ok === false, 'unknown class rejected');
  ok(badClass.errors.some(e => e.startsWith('classId:')), 'unknown-class error names the classId field');
  const badSub = validateClassSubclass({ classId: 'fighter', subclassId: 'No Such Subclass' });
  ok(badSub.ok === false, 'unknown subclass rejected');
  ok(badSub.errors.some(e => e.startsWith('subclassId:')), 'unknown-subclass error names the subclassId field');
  const missingSub = validateClassSubclass({ classId: 'fighter', subclassId: '' });
  ok(missingSub.ok === false && missingSub.errors.some(e => e.startsWith('subclassId:')),
    'missing subclass rejected naming subclassId');
  const artificer = validateClassSubclass({ classId: 'artificer', subclassId: 'Alchemist' });
  ok(artificer.ok === false && artificer.errors.some(e => e.startsWith('subclassId:')),
    'artificer subclass is unverifiable (no registry entry), error names subclassId');
  const crossClass = validateClassSubclass({ classId: 'fighter', subclassId: 'Life Domain' });
  ok(crossClass.ok === false, 'a cleric subclass under fighter is rejected');
}

group('Class descriptions are PHB-style, no mechanics (polish note 3)');
{
  const classes = (await import(svc('client/src/data/classes.json'), { with: { type: 'json' } })).default;
  const stage2Src = fs.readFileSync(path.join(REPO, 'client/src/components/creator-next/Stage2ClassCalling.jsx'), 'utf8');
  ok(Object.keys(classes).length === 23, `classes.json holds 23 classes (${Object.keys(classes).length})`);
  const banned = ['NOT a paladin subclass', 'mutual exclusion', 'Channel Divinity', 'wires only', 'No spellcasting is stated', 'Vice', 'Hit die', 'Saving throws', 'Primary ability', 'Cantrips known'];
  for (const [id, c] of Object.entries(classes)) {
    const desc = c.description || '';
    const sentences = desc.split(/(?<=\.)\s+/).filter(Boolean);
    ok(sentences.length === 2 && desc.endsWith('.'), `${id} description is exactly two sentences`);
    for (const b of banned) ok(!desc.includes(b), `${id} description has no mechanics/build-note text ("${b}")`);
  }
  // The facts line is gone from the card; the facts live in the tooltip.
  ok(!stage2Src.includes("{` Hit die d${cls.hitDie}.`}"), 'class card no longer renders the hit-die facts line');
  ok(!stage2Src.includes('The chassis readout'), 'class card no longer carries the chassis-readout tip');
  ok(stage2Src.includes('const factsTip'), 'class facts are built into a tooltip string');
  ok(stage2Src.includes('<Tip text={factsTip} />'), 'class card shows the description with a facts tooltip');
}

group('Subclass picker shows no sources (polish note 4)');
{
  const stage2Src = fs.readFileSync(path.join(REPO, 'client/src/components/creator-next/Stage2ClassCalling.jsx'), 'utf8');
  ok(!stage2Src.includes('— ${s.source}'), 'subclass options no longer append the source');
  ok(!stage2Src.includes('s.source ?'), 'subclass options no longer read the source field');
  // Sweep the whole creator flow: no picker renders a source suffix.
  for (const dir of ['client/src/components/creator-next', 'client/src/components/creator']) {
    for (const f of fs.readdirSync(path.join(REPO, dir)).filter(x => x.endsWith('.jsx'))) {
      const src = fs.readFileSync(path.join(REPO, dir, f), 'utf8');
      ok(!src.includes('— ${s.source}'), `${dir}/${f} renders no source suffix`);
    }
  }
}

group('"Recommended means" internal text is gone (polish note 5)');
{
  const stage2Src = fs.readFileSync(path.join(REPO, 'client/src/components/creator-next/Stage2ClassCalling.jsx'), 'utf8');
  ok(!stage2Src.includes('Recommended means'), '"Recommended means" div is gone');
  ok(!stage2Src.includes('first registry'), 'no "first registry" internal-means text remains');
  ok(!stage2Src.includes('first choice options'), 'no "first choice options" internal-means text remains');
  ok(!stage2Src.includes('Fills in recommended choices'), 'the Quick Build tip is gone with Quick Build (creator test-notes #9)');
  for (const dir of ['client/src/components/creator-next', 'client/src/components/creator']) {
    for (const f of fs.readdirSync(path.join(REPO, dir)).filter(x => x.endsWith('.jsx'))) {
      const src = fs.readFileSync(path.join(REPO, dir, f), 'utf8');
      ok(!src.includes('Recommended means') && !src.includes('first choice options'), `${dir}/${f} has no internal-means text`);
    }
  }
}

group('Subclass picker only for level-1 classes (polish note 6 + 2024 audit)');
{
  const classes = (await import(svc('client/src/data/classes.json'), { with: { type: 'json' } })).default;
  const { SUBCLASS_LEVELS } = await import(svc('server/config/levelProgression.js'));
  const stage2Src = fs.readFileSync(path.join(REPO, 'client/src/components/creator-next/Stage2ClassCalling.jsx'), 'utf8');
  // 2024-accuracy audit (2026-11-05, all 23 classes): the 2024 PHB puts
  // EVERY PHB class's subclass choice at 3rd level — including druid
  // (the "druid at 2nd" line was the 2014 rule, not 2024) — and the
  // registry's own PHB entries/headers agree. Magus/scholar stay 1st
  // (their own books print the choice at 1st); keeper stays 6th (its
  // class table prints Specialization at 6th); warlord is 1st
  // (KibblesTasty Warlord v1.5 prints the Presence choice at 1st —
  // corrected 2026-11-06, gaps-batch item 8b, from the old
  // display-only 3). This map is the
  // regression guard for every class whose level did NOT change.
  const EXPECTED_2024 = {
    artificer: 3, barbarian: 3, bard: 3, blackguard: 3, blood_hunter: 3,
    cleric: 3, druid: 3, duelist: 3, fighter: 3, keeper: 6, magus: 1,
    monk: 3, paladin: 3, pugilist: 3, ranger: 3, rogue: 3, scholar: 1,
    sorcerer: 3, spellshot: 3, warden: 3, warlock: 3, warlord: 1,
    wizard: 3,
  };
  for (const [id, level] of Object.entries(EXPECTED_2024)) {
    ok(classes[id]?.subclassLevel === level, `${id} subclassLevel is ${level} (2024-corrected, got ${classes[id]?.subclassLevel})`);
  }
  // The five corrected classes, named: cleric/sorcerer/warlock were 1,
  // druid/wizard were 2 — all 2014-era values, all now 3.
  for (const [id, oldLevel] of Object.entries({ cleric: 1, sorcerer: 1, warlock: 1, wizard: 2, druid: 2 })) {
    ok(classes[id]?.subclassLevel === 3 && classes[id]?.subclassLevel !== oldLevel,
      `${id} corrected from ${oldLevel} to 3`);
  }
  // SUBCLASS_LEVELS now matches the corrected map — the level-up
  // follow-up (2026-11-05) corrected the table itself to the 2024
  // levels, so the divergence the audit left behind is gone and the
  // creator-local override was removed. If this set changes, either
  // the table or classes.json drifted — check both.
  for (const [id, level] of Object.entries(SUBCLASS_LEVELS)) {
    ok(level === EXPECTED_2024[id], `SUBCLASS_LEVELS says ${level} for ${id} (2024 map: ${EXPECTED_2024[id]})`);
  }
  for (const [id, oldLevel] of Object.entries({ cleric: 1, sorcerer: 1, warlock: 1, wizard: 2, druid: 2 })) {
    ok(SUBCLASS_LEVELS[id] === 3 && SUBCLASS_LEVELS[id] !== oldLevel,
      `SUBCLASS_LEVELS corrected from ${oldLevel} to 3 for ${id}`);
  }
  // Classes outside the progression table derive from their own
  // classes.json first subclass feature (the class source's table);
  // keeper cross-checks both sources at once (6 in each). Warlord
  // left this list with the staged patch (SUBCLASS_LEVELS warlord: 1).
  for (const id of ['blood_hunter', 'keeper']) {
    const firstLevels = classes[id].subclasses.map(s => Math.min(...Object.keys(s.featuresByLevel || {}).map(Number)));
    const level = Math.min(...firstLevels);
    ok(classes[id].subclassLevel === level, `${id} subclassLevel ${classes[id].subclassLevel} matches its first subclass feature (level ${level})`);
  }
  const l1FromClasses = Object.entries(classes).filter(([, c]) => c.subclassLevel === 1).map(([id]) => id).sort();
  ok(JSON.stringify(l1FromClasses) === JSON.stringify(['magus', 'scholar', 'warlord']),
    `only magus + scholar + warlord show the subclass picker (${l1FromClasses.join(', ')})`);
  ok(l1FromClasses.length === 3, `exactly 3 classes show the subclass picker (${l1FromClasses.length})`);
  // The component gates on the class record, not the registry entry.
  ok(stage2Src.includes('subclassLevel === 1'), 'picker is gated on subclassLevel === 1');
  ok(stage2Src.includes('showSubclassPicker'), 'gate is a named showSubclassPicker flag');
  ok(stage2Src.includes('You choose your subclass at level ${subclassLevel}'), 'later-subclass classes get a plain level note');
  ok(!stage2Src.includes('subclassEntry.selectionLevel'), 'display no longer reads the registry entry selectionLevel');
  ok(stage2Src.includes('takes effect at level {cls?.subclassLevel'), 'display reads the class record level');
  ok(!stage2Src.includes('quickBuild'), 'no Quick Build auto-fill remains in Stage 2 (creator test-notes #9)');
}

console.log(`\ncreator-next-stage2: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
