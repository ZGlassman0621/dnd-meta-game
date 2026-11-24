// tests/creator-round-3.test.js — creator round 3 (docs/pm/creator-round-3/BRIEF.md).
// Pure helpers are run for real; JSX wiring is pinned by source checks.
// The on-screen layout results (item 1, and items 4 and 9) come from the
// builder's headless-Chrome run at :5173 recorded in the report — a source
// pin is not a screen check, and this file does not pretend to be one.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const imp = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

let passed = 0, failed = 0;
function group(n) { console.log('== ' + n + ' =='); }
function ok(c, m) { try { assert(c, m); passed++; console.log('  ✓ ' + m); } catch (e) { failed++; console.error('FAIL:', m); } }

const stage1 = read('client/src/components/creator-next/Stage1OriginIdentity.jsx');
const stage3 = read('client/src/components/creator-next/Stage3PastPath.jsx');
const stage4 = read('client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx');
const stage5 = read('client/src/components/creator-next/Stage5GearStory.jsx');
const rowSrc = read('client/src/components/creator-next/SpellPickRow.jsx');

// ---------------------------------------------------------------------------
group('Item 1 — picker rows: checkbox beside the name (source side)');
{
  ok(/display: 'flex', alignItems: 'center'/.test(rowSrc) && /<input type="checkbox" style=\{inputStyle\}/.test(rowSrc), 'the shared spell row keeps the checkbox on the flex row beside the name');
  // Sibling fixed in this job: Stage 1 Versatile Musician / Skilled / Crafter
  // lists used display:block labels with an unstyled checkbox.
  const vBlock = stage1.slice(stage1.indexOf("versatileFeatKey === 'musician'"), stage1.indexOf("versatileFeatKey === 'crafter'") + 1600);
  ok(!/<label key=\{o\.value\} style=\{\{ display: 'block'/.test(vBlock), 'no Versatile feat list renders a display:block checkbox label any more');
  ok((vBlock.match(/<input type="checkbox" style=\{\{ width: 'auto', flex: '0 0 auto', margin: 0 \}\}/g) || []).length === 3, 'all three Versatile lists (instruments, skills or tools, artisan tools) keep the checkbox from stretching');
}

// ---------------------------------------------------------------------------
group('Item 2 — dragonmarks explained before any pick');
{
  const { dragonmarkHouses } = await imp('client/src/components/creator-next/speciesAdapter.js');
  const { EBERRONMARKS } = await imp('server/data/species/eberronMarks.js');
  const all = EBERRONMARKS.flatMap((sp) => dragonmarkHouses(sp.variants));
  ok(EBERRONMARKS.length === 7 && all.length === 13, `13 mark entries on 7 species (12 marks, Finding on two) — got ${all.length}`);
  ok(all.every((m) => m.house), 'every mark names its house from its own description');
  ok(all.find((m) => m.mark === 'Mark of Shadow').house === 'Phiarlan and House Thuranni', 'Mark of Shadow names both houses (Phiarlan and Thuranni)');
  ok(dragonmarkHouses([{ name: 'High Elf', description: 'x' }, { name: 'Mark of X', description: 'no house here' }]).length === 1
    && dragonmarkHouses([{ name: 'Mark of X', description: 'no house here' }])[0].house === null, 'non-mark variants are skipped; a mark with no house in its text keeps house null (nothing invented)');
  ok(/dragonmarkHouses\(sortedVariants\)\.length > 0 &&/.test(stage1) && /are dragonmarks, from Eberron/.test(stage1), 'Stage 1 shows the dragonmark help line under the Variant picker whenever the species carries marks');
  ok(/\{selectedVariant && \(/.test(stage1) && /selectedVariant\.description/.test(stage1), 'the selected variant\'s description and traits still show below the picker');
}

// ---------------------------------------------------------------------------
group('Item 3 — artisan-tool descriptions under Clan\'s Craft and Crafter');
{
  const { resolveChoiceOptions } = await imp('client/src/components/creator-next/choiceOptions.js');
  const { TOOLS } = await imp('client/src/data/references.js');
  const tools = resolveChoiceOptions({ options: 'any_artisan_tool' });
  ok(tools.length === 17 && tools.every((t) => t.description && t.description === TOOLS[t.value]), 'all 17 artisan tools resolve with their references.js description');
  ok(tools.every((t) => t.value === t.label), 'value and label are unchanged');
  ok(resolveChoiceOptions({ options: 'any_skill' }).every((o) => !o.description), 'skills (no TOOLS entry) carry no description');
  ok(resolveChoiceOptions({ options: ['Foo', 'Bar'] }).every((o) => !o.description), 'a fixed list with no tool names carries none');
  ok(/values\.filter\(Boolean\)\.map\(v => \{[\s\S]{0,200}o\?\.description/.test(stage1), 'Stage 1 ancestry-feat choices show the chosen option\'s description under the picker (Clan\'s Craft)');
  ok(/'any_artisan_tool'[\s\S]{0,900}o\.description &&/.test(stage1), 'the Stage 1 Versatile Crafter list shows each tool\'s description');
  ok(/'any_artisan_tool'[\s\S]{0,900}o\.description &&/.test(stage3), 'the Stage 3 theme Crafter list shows each tool\'s description');
}

// ---------------------------------------------------------------------------
group('Item 4 — the level-1 wizard spellbook reads as a bounded choice');
{
  const { groupSpellsBySchool } = await imp('client/src/components/creator-next/spellBlurb.js');
  const { SPELL_DATA_ENTRIES } = await imp('server/data/spellCatalogData.js');
  const wiz = Object.entries(SPELL_DATA_ENTRIES).filter(([, s]) => s && s.level === 1 && Array.isArray(s.classes) && s.classes.includes('Wizard')).map(([name, s]) => ({ name, school: s.school }));
  const groups = groupSpellsBySchool(wiz);
  ok(wiz.length === 44, `the catalog offers 44 first-level wizard spells (got ${wiz.length})`);
  ok(groups.length === 8 && groups.reduce((n, g) => n + g.spells.length, 0) === 44, '8 school groups that together hold all 44');
  ok(groups.map((g) => g.school).join() === [...groups.map((g) => g.school)].sort().join(), 'schools are in alphabetical order');
  ok(groupSpellsBySchool([{ name: 'a' }, { name: 'b', school: 'Abjuration' }]).map((g) => g.school).join() === 'Abjuration,Other', 'a spell with no school goes in a final Other group');
  ok(/groupSpellsBySchool\(spellOptions\)/.test(stage4) && /<details key=\{school\}/.test(stage4) && /first-level wizard spells, grouped by school of magic/.test(stage4), 'Stage 4 renders the spellbook as school groups with a count line');
  ok(/\.filter\(s => s\.level === 1\)|level === 1/.test(stage4), 'the list stays first-level only (scope unchanged)');
}

// ---------------------------------------------------------------------------
group('Items 5–6 — alignment, faith and lifestyle descriptions');
{
  const sc = await imp('client/src/data/storyChoices.js');
  const { SERVICES } = await imp('server/data/equipment2024.js');
  const alignList = (stage5.match(/const ALIGNMENTS = \[([^\]]+)\]/) || [])[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  ok(alignList.length === 10 && alignList.every((a) => sc.ALIGNMENT_DESCRIPTIONS[a]), 'every one of the 10 alignment choices (Unaligned included) has a description');
  const lifeList = (stage5.match(/const LIFESTYLES = \[([^\]]+)\]/) || [])[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  ok(lifeList.length === 7 && lifeList.every((l) => sc.LIFESTYLES.find((x) => x.name === l && x.description)), 'every one of the 7 lifestyles has a description');
  ok(JSON.stringify(sc.LIFESTYLES.map((l) => [l.name, l.costPerDayCp])) === JSON.stringify(SERVICES.lifestyles.map((l) => [l.name, l.costPerDayCp])), 'lifestyle daily costs match the server table exactly');
  ok(['Free', '1 sp a day', '2 sp a day', '1 gp a day', '2 gp a day', '4 gp a day', '10 gp a day'].join() === sc.LIFESTYLES.map((l) => sc.formatDailyCost(l.costPerDayCp)).join(), 'costs read Free / 1 sp / 2 sp / 1 gp / 2 gp / 4 gp / 10 gp a day');
  const deities = Object.values(JSON.parse(read('client/src/data/deities.json')));
  ok(deities.length === 55 && deities.every((d) => d.description), 'all 55 faith entries have a description to show');
  ok(/const selectField = \(key, label, tip, options, describe = null\)/.test(stage5) && /data-choice-description=\{key\}/.test(stage5), 'the select shows the chosen option\'s description under it');
  ok(/'faith'[\s\S]{0,400}deitiesData\)\.find\(d => d\.name === v\)\?\.description/.test(stage5), 'Faith shows the chosen deity\'s description');
  ok(/'lifestyle'[\s\S]{0,500}formatDailyCost\(l\.costPerDayCp\)/.test(stage5), 'Lifestyle shows the description and the daily cost');
  ok(/'None', \.\.\.Object\.values\(deitiesData\)/.test(stage5) && deities.some((d) => d.name === 'Atheist') && deities.some((d) => d.name === 'Agnostic'), 'observed (reported, not fixed): None plus Atheist plus Agnostic in the Faith list');
}

// ---------------------------------------------------------------------------
group('Items 7–8 — Story & Appearance copy');
{
  const storyStart = stage5.indexOf("{selectField('alignment'");
  const story = stage5.slice(storyStart, stage5.indexOf('</div>\n    </div>\n  )', storyStart) + 10);
  ok(!/Flavor for the DM/.test(stage5), 'the "Flavor for the DM" sentence is gone from all seven appearance helpers');
  ok(story.includes('How you act: your habits, mannerisms, and the things people notice first. The DM uses this to shape how the world reacts to you.'), 'the "How you act" helper reads as intended');
  ok(!/never a mechanic|nothing in the rules reads it|edit mode|Required at Review|Free text/.test(story), 'no system wording (mechanic / edit mode / Required at Review / Free text) left in the story helpers');
  ok((story.match(/Optional; you can change it later\./g) || []).length === 16, 'every optional field says it plainly (7 appearance + 9 story fields)');
  ok((story.match(/Choose one before you finish\. You can change it later\./g) || []).length === 3, 'Alignment, Faith and Lifestyle say they are needed before finishing');
  ok(/describe who your character is/.test(stage5) && !/pre-picked: the fork starts empty/.test(stage5), 'the page lede is rewritten');
  ok(/Your equipment choice is final once you create your character\. Everything else on this page/.test(stage5), 'the footer help is rewritten');
  ok(/What do people notice about you first\?/.test(story), 'the three personality prompt questions are kept');
  ok(/<Tip text="Who this person is, for the DM to play with\./.test(stage5), 'no <Tip> was changed (out of scope)');
}

// ---------------------------------------------------------------------------
group('Item 9 — Magic Initiate pickers use the shared row');
{
  const { catalogSpellRow } = await imp('client/src/components/creator-next/spellBlurb.js');
  const spellsData = JSON.parse(read('client/src/data/spells.json'));
  const row = catalogSpellRow(spellsData, 'Fire Bolt');
  ok(row.name === 'Fire Bolt' && row.school && row.description && row.castTime && row.range, 'catalogSpellRow maps the client catalog entry to the row (castingTime → castTime)');
  ok(JSON.stringify(catalogSpellRow(spellsData, 'Not A Spell')) === JSON.stringify({ name: 'Not A Spell' }), 'an unknown name gets no invented fields');
  ok(/<SpellPickRow key=\{c\} spell=\{catalogSpellRow\(spellsData, c\)\}/.test(stage1), 'Stage 1 Versatile Magic Initiate cantrips use the shared row');
  ok(/<SpellPickRow key=\{c\} spell=\{catalogSpellRow\(spellsData, c\)\}/.test(stage3), 'Stage 3 theme Magic Initiate cantrips use the shared row');
  ok(/versatileChoices\.level1_spell && catalogSpellRow\(spellsData, versatileChoices\.level1_spell\)\.description/.test(stage1), 'Stage 1 shows the chosen level-1 spell\'s description, as Stage 3 does');
  ok(/import SpellPickRow from '\.\/SpellPickRow\.jsx'/.test(stage4) && !/function SpellPickRow/.test(stage4), 'Stage 4 uses the same shared row file');
}

console.log(`\ncreator-round-3: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
