// tests/creation-solidification.test.js — the creation-solidification
// job (brief docs/pm/creation-solidification/BRIEF.md, 2026-11-12):
// make creation choices stick.
//
//   (1) Theme choices read downstream — themeChoiceLines, the
//       progression snapshot's theme.choices, the DM prompt line, and
//       the stale location-pick clear (themeLocation.js).
//   (2) Draft #1203 re-pick — covered in
//       creator-test-notes-5-ancestry-feat-resume.test.js group (e).
//   (3) R2-15 — a species' promised extra language is forced at
//       Review (client validateStage1 'needed') and at commit (server).
//   (4) Gold-fork physical Spellbook — a wizard on the gold fork gets a
//       Spellbook row; switching package -> gold drops package gear.
//   (5) validateSelection wired at commit — the selection level uses
//       the stored row's level. No subclass needs an origin explanation
//       (Zach's ruling 2026-11-12, "a class is a class"); migration 114's
//       column is kept, inert, and its save/resume plumbing still works.
//       Plus the sibling fix: the warlock pact now persists (`pact`).
//   (6) Fighting Style -> feats at commit: Defense +1 AC (stored and
//       in play), Archery +2, listed in the DM prompt's feat block;
//       an edit re-commit replaces the creator's style.
//
// Honest integration tests: the real character + progression routers
// over real HTTP against a real throwaway DB, real services, and the
// real client modules (plain .js — no bundling needed).
import assert from 'node:assert';
import express from 'express';
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'creation-solidification-test-'));
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();

const characterModule = await import(fromRepo('server/routes/character.js'));
const { deriveCreatorNextStage5, validateCreatorNextStage6 } = characterModule;
const { themeChoiceLines, toClientShape, resolveTheme } = await import(fromRepo('server/services/themeService.js'));
const { formatProgression } = await import(fromRepo('server/services/dmPromptBuilder.js'));
const { SPECIES } = await import(fromRepo('server/services/speciesService.js'));
const { calculateCombatStats } = await import(fromRepo('server/services/combatStatsService.js'));
const { fightingStyleAdjustments, parseFeatList } = await import(fromRepo('server/services/classFeatureService.js'));
const { renderFeatEffectsForPrompt } = await import(fromRepo('server/data/featRegistry.js'));
const { getSubclass } = await import(fromRepo('server/services/subclassService.js'));
// Real client modules.
const { validateStage1 } = await import(fromRepo('client/src/components/creator-next/stage1Validation.js'));
const { themeLocationOptions, isStaleThemePathChoice } = await import(fromRepo('client/src/components/creator-next/themeLocation.js'));
const { buildStage1ProgressBody, rehydrateStateFromServerRow, pactKeyFromName, pactNameFromKey } =
  await import(fromRepo('client/src/components/creator-next/stage1Persistence.js'));

// --- HTTP harness -------------------------------------------------------
const app = express();
app.use(express.json());
app.use('/api/character', characterModule.default);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
async function call(method, url, body) {
  const res = await fetch(`${base}${url}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const errOf = (r) => (typeof r.json?.error === 'string' ? r.json.error : JSON.stringify(r.json));
const readRow = (id) => db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
const J = (v) => JSON.stringify(v);
const MARKER = 'creator-next';

// --- Fixtures (the verified human fighter of creator-next-stage6-commit (f)) ---
const tt = await db.dbGet("SELECT id FROM ancestry_feats WHERE list_id = 'human' AND tier = 1 AND feat_name = ?", ["Traveler's Tongue"]);
assert(tt?.id != null, "Traveler's Tongue resolves");
const STORY = {
  alignment: 'Lawful Good', faith: 'Tyr', lifestyle: 'Modest', age: '24', height: `5'9"`, weight: '170 lb',
  eye_color: 'Brown', hair_color: 'Black', skin_color: 'Tan', physical_build: 'Sturdy',
};
const ORIGIN_FR = { origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast', origin_explanation: 'Born in the Sword Coast.' };
const FIGHTER_BASE = { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 };
const FIGHTER_FINAL = { str: 17, dex: 13, con: 15, int: 10, wis: 12, cha: 8 };
function fighterDraft(overrides = {}) {
  return {
    creator: MARKER,
    name: 'Hana Strong', first_name: 'Hana', gender: 'Female',
    race: 'human', size: 'Medium',
    ...ORIGIN_FR,
    class: 'fighter', theme_id: 'soldier', origin_feat: 'savage_attacker',
    theme_path_choice: 'sergeant', theme_path_data: J({ active_duty: 'active' }),
    generation_method: 'point_buy', base_scores: FIGHTER_BASE, ability_scores: J(FIGHTER_FINAL),
    skills: J(['Athletics', 'Intimidation', 'Perception', 'Survival']),
    languages: J(['Common', 'Elvish', 'Dwarvish', 'Giant']),
    known_cantrips: J([]),
    ancestry_feat_id: tt.id,
    ancestry_feat_choices: { languages: ['Elvish', 'Dwarvish'] },
    ...STORY,
    gear_choice: 'packages', package_id: 'A', package_picks: J({}),
    ...overrides,
  };
}

// ===========================================================================
// (1) Theme choices read downstream
// ===========================================================================
group('(1) theme choices: labelled lines, snapshot, DM prompt, stale clear');
{
  const soldier = themeChoiceLines('soldier', 'sergeant', { active_duty: 'veteran' });
  check(soldier.length === 2, `soldier carries two choice lines (got ${JSON.stringify(soldier)})`);
  check(soldier[0]?.label === 'Military Rank' && soldier[0]?.value === 'Sergeant',
    `rank prints labelled from the registry option (got ${JSON.stringify(soldier[0])})`);
  check(soldier[1]?.label === 'Active Duty' && soldier[1]?.value === 'No longer in active duty',
    `active duty prints labelled from path_data (got ${JSON.stringify(soldier[1])})`);
  check(themeChoiceLines('soldier', 'sergeant', '{"active_duty":"active"}')[1]?.value === 'Still in active duty',
    'path_data stored as a JSON string is read too');
  // An origin-region pick has no fixed option list: printed verbatim.
  const regionTheme = (await import(fromRepo('server/data/themes.js'))).THEMES.find((t) => t.creation_choice_source === 'origin_regions' && !t.creation_choice_options);
  check(!!regionTheme, 'a region-sourced theme exists in the registry');
  const regionLines = themeChoiceLines(regionTheme.id, 'Breland', null);
  check(regionLines.length === 1 && regionLines[0].value === 'Breland' && regionLines[0].label === regionTheme.creation_choice_label,
    `a region choice prints as stored (got ${JSON.stringify(regionLines)})`);
  const noChoice = (await import(fromRepo('server/data/themes.js'))).THEMES.find((t) => !t.creation_choice_label);
  check(themeChoiceLines(noChoice.id, null, null).length === 0, 'a theme with no creation choice prints nothing');
  check(themeChoiceLines('soldier', null, null).length === 0, 'nothing stored prints nothing (never invented)');
  check(themeChoiceLines('not_a_theme', 'x', null).length === 0, 'an unknown theme prints nothing');

  // Through the real routes: draft POST, progression snapshot.
  const created = await call('POST', '/api/character', fighterDraft({ name: 'Theme Choices' }));
  check(created.status === 201, `fighter draft POST is 201 (got ${created.status}: ${errOf(created)})`);
  const prog = await call('GET', `/api/character/${created.json?.id}/progression`);
  const choices = prog.json?.theme?.choices;
  check(Array.isArray(choices) && choices.some((c) => c.label === 'Military Rank' && c.value === 'Sergeant')
    && choices.some((c) => c.label === 'Active Duty' && c.value === 'Still in active duty'),
    `progression snapshot carries the labelled choices (got ${JSON.stringify(choices)})`);
  const promptText = formatProgression(prog.json);
  check(promptText.includes('Military Rank: Sergeant') && promptText.includes('Active Duty: Still in active duty'),
    'the DM prompt prints both labelled theme choices');
  check(!promptText.includes('(sergeant)'), 'the DM prompt no longer prints the raw slug in parentheses');
  // Sheet wiring (static guard — the sheet is .jsx).
  const sheet = readRepo('client/src/components/CharacterSheet.jsx');
  check(sheet.includes('progression.theme.choices.map'), 'the character sheet renders progression.theme.choices');

  // Stale location pick: a FR city stops being legal after the origin
  // moves outside the Realms.
  const cityTheme = toClientShape(resolveTheme('city_watch') || (await import(fromRepo('server/data/themes.js'))).THEMES.find((t) => t.creation_choice_source === 'origin_regions' && Array.isArray(t.creation_choice_options)));
  check(!!cityTheme, 'a city theme resolves to its client shape');
  const frState = { origin_setting: 'Forgotten Realms', themePathChoice: 'Waterdeep' };
  check(themeLocationOptions(cityTheme, frState).options.some((o) => o.value === 'Waterdeep'), 'an FR origin offers the FR city list');
  check(isStaleThemePathChoice(cityTheme, frState) === false, 'Waterdeep under an FR origin is not stale');
  const eberronState = { origin_setting: 'Eberron', themePathChoice: 'Waterdeep' };
  check(themeLocationOptions(cityTheme, eberronState).label === 'Home Region', 'an Eberron origin switches to Home Region');
  check(isStaleThemePathChoice(cityTheme, eberronState) === true, 'Waterdeep under an Eberron origin IS stale (to clear)');
  check(isStaleThemePathChoice(cityTheme, { origin_setting: 'Eberron', themePathChoice: '' }) === false, 'an empty pick is never stale');
  const shell = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');
  check(shell.includes('isStaleThemePathChoice(theme, state)') && shell.includes("themePathChoice: ''"),
    'the shell clears a stale pick with the shared rule');
}

// ===========================================================================
// (3) R2-15: the species extra-language pick is forced
// ===========================================================================
group('(3) extra language forced at Review and at commit');
{
  const human = SPECIES.find((s) => s.id === 'human');
  const halfElf = SPECIES.find((s) => s.id === 'half-elf');
  check(human && halfElf, 'human and half-elf species entries resolve');
  const v0 = validateStage1({ race: 'human', ancestry_feat_id: 1, languageChoices: [] }, { featListAvailable: true, speciesEntry: human });
  check(v0.needed.includes('Extra language'), `Stage 1 lists 'Extra language' for a human with no pick (needed: ${v0.needed.join(', ')})`);
  check(v0.canAdvance === true, 'the missing pick is NEEDED, not blocking — Stage 1 still advances (Review enforces)');
  const v1 = validateStage1({ race: 'human', ancestry_feat_id: 1, languageChoices: ['Giant'] }, { featListAvailable: true, speciesEntry: human });
  check(!v1.needed.includes('Extra language'), 'a made pick clears the line');
  const vh = validateStage1({ race: 'half-elf', ancestry_feat_id: 1, languageChoices: [] }, { featListAvailable: true, speciesEntry: halfElf });
  check(vh.needed.includes('Extra language'), 'half-elf carries the same promise');
  const dwarf = SPECIES.find((s) => s.id === 'dwarf');
  const vd = validateStage1({ race: 'dwarf', ancestry_feat_id: 1, languageChoices: [] }, { featListAvailable: true, speciesEntry: dwarf });
  check(!vd.needed.includes('Extra language'), 'a species with no extra-language promise is never asked');
  const review = readRepo('client/src/components/creator-next/Stage6ReviewCommit.jsx');
  check(review.includes('validateStage1(state, { featListAvailable: true, mixedTables, speciesEntries, speciesEntry })'),
    'Review reuses validateStage1 (so the needed line blocks the commit)');
  check(review.includes('/extra language/.test(m)) return 0'), 'a server extra-language refusal jumps to Stage 1');

  // Server: Traveler's Tongue's two picks do NOT count toward the
  // species slot; the fourth language does.
  const created = await call('POST', '/api/character', fighterDraft({ name: 'Language Rule', languages: J(['Common', 'Elvish', 'Dwarvish']) }));
  check(created.status === 201, `draft without the extra language still saves (draft — got ${created.status})`);
  const id = created.json?.id;
  const refused = await call('POST', `/api/character/${id}/commit`, fighterDraft({ fighting_style: 'Defense', languages: J(['Common', 'Elvish', 'Dwarvish']) }));
  check(refused.status === 400 && errOf(refused).includes('Human grants one extra language') && errOf(refused).includes('Stage 1'),
    `commit without the pick is refused, named, with where to fix it (got ${refused.status}: ${errOf(refused)})`);
  const ok = await call('POST', `/api/character/${id}/commit`, fighterDraft({ fighting_style: 'Defense' }));
  check(ok.status === 200, `commit with the pick is 200 (got ${ok.status}: ${errOf(ok)})`);
}

// ===========================================================================
// (4) Gold-fork physical Spellbook (+ package gear cleared on gold)
// ===========================================================================
group('(4) gold-fork wizard owns a Spellbook');
{
  const wizBody = (gear) => ({
    class: 'wizard', race: 'human', size: 'Medium', theme_id: 'sage',
    ability_scores: { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 },
    ...gear,
  });
  const gold = deriveCreatorNextStage5(wizBody({ gear_choice: 'gold' }), {}, { isPost: true });
  const goldInv = JSON.parse(gold.inventory || '[]');
  check(goldInv.filter((i) => i.name === 'Spellbook').length === 1, `gold-fork wizard inventory has exactly one Spellbook (got ${gold.inventory})`);
  check(goldInv.every((i) => i.name === 'Spellbook'), 'the gold fork grants no other gear');
  const pkg = deriveCreatorNextStage5(wizBody({ gear_choice: 'packages', package_id: 'A', package_picks: '{}' }), {}, { isPost: true });
  const pkgInv = JSON.parse(pkg.inventory || '[]');
  check(pkgInv.filter((i) => i.name === 'Spellbook').length === 1, `package wizard still has exactly one Spellbook (got ${pkg.inventory})`);
  // Re-saving gold over the gold row does not duplicate the book.
  const again = deriveCreatorNextStage5(wizBody({ gear_choice: 'gold' }), { row: { inventory: gold.inventory } }, {});
  check(JSON.parse(again.inventory).filter((i) => i.name === 'Spellbook').length === 1, 'a repeat gold save keeps one Spellbook');
  // A non-wizard on gold gets no Spellbook.
  const fGold = deriveCreatorNextStage5({ ...wizBody({ gear_choice: 'gold' }), class: 'fighter' }, {}, { isPost: true });
  check(!JSON.parse(fGold.inventory || '[]').some((i) => i.name === 'Spellbook'), 'a gold-fork fighter gets no Spellbook');
  // Sibling: package gear saved earlier is dropped on switching to gold;
  // a non-package item is kept; package armor leaves the slot; AC 10+Dex.
  const fPkg = deriveCreatorNextStage5({ ...wizBody({ gear_choice: 'packages', package_id: 'A', package_picks: '{}' }), class: 'fighter', ability_scores: FIGHTER_FINAL }, {}, { isPost: true });
  const storedInv = JSON.stringify([...JSON.parse(fPkg.inventory), { name: 'Lucky Coin', quantity: 1 }]);
  const toGold = deriveCreatorNextStage5({ ...wizBody({ gear_choice: 'gold' }), class: 'fighter', ability_scores: FIGHTER_FINAL },
    { row: { inventory: storedInv, equipment: fPkg.equipment } }, {});
  const toGoldInv = JSON.parse(toGold.inventory);
  check(toGoldInv.length === 1 && toGoldInv[0].name === 'Lucky Coin', `package gear is dropped on the gold fork, other items kept (got ${toGold.inventory})`);
  check(!JSON.parse(toGold.equipment).armor, `package armor leaves the slot on the gold fork (got ${toGold.equipment})`);
  check(toGold.armorClass === 10 + 1, `AC falls back to 10 + Dex with no armor (got ${toGold.armorClass})`);

  // Through the real POST: the row carries the Spellbook.
  const created = await call('POST', '/api/character', {
    creator: MARKER, name: 'Gold Wizard', first_name: 'Gold', gender: 'Female', race: 'human', size: 'Medium',
    class: 'wizard', theme_id: 'sage', generation_method: 'point_buy',
    ability_scores: J({ str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 }), gear_choice: 'gold',
  });
  check(created.status === 201, `gold wizard draft POST is 201 (got ${created.status}: ${errOf(created)})`);
  const row = await readRow(created.json?.id);
  check(JSON.parse(row?.inventory || '[]').some((i) => i.name === 'Spellbook'), `the created wizard row holds a Spellbook (got ${row?.inventory})`);
}

// ===========================================================================
// (5) validateSelection at commit + subclass origin + pact persistence
// ===========================================================================
group('(5) subclass selection rules at commit; pact persists');
{
  // Level: an edit-mode level-5 row keeps a level-3 subclass legal.
  const champion = getSubclass('fighter', 'Champion');
  check(champion && champion.origin_setting === 'Forgotten Realms', 'Champion is a Forgotten Realms subclass (fixture premise)');
  const l5 = await validateCreatorNextStage6({ class: 'fighter', subclass: 'Champion' }, { row: { level: 5 } });
  check(!l5.errors.some((e) => e.includes('is chosen at')), `a level-5 row may hold a level-3 subclass (errors: ${l5.errors.filter((e) => e.startsWith('subclass')).join(' | ')})`);
  const l1 = await validateCreatorNextStage6({ class: 'fighter', subclass: 'Champion' }, { row: { level: 1 } });
  const subLines = l1.errors.filter((e) => e.startsWith('subclassId'));
  check(subLines.length === 1, `a level-1 fighter with a subclass gets ONE subclass line, not two (got ${JSON.stringify(subLines)})`);
  // Outside-FR at a legal level, no explanation -> commits (Zach's ruling 2026-11-12).
  const subService = await import(fromRepo('server/services/subclassService.js'));
  const outsideFr = subService.listSubclasses('fighter').find((s) => s.origin_setting !== 'Forgotten Realms' && Number(s.selectionLevel) === 3
    && subService.isSubclassPcCreatable('fighter', s.name));
  check(!!outsideFr, 'a creatable outside-FR level-3 fighter subclass exists (fixture premise)');
  const noExp = await validateCreatorNextStage6({ class: 'fighter', subclass: outsideFr.name }, { row: { level: 5 } });
  const originErrs = noExp.errors.filter((e) => /subclassOriginExplanation|origin explanation|Forgotten Realms subclass/i.test(e));
  check(originErrs.length === 0,
    `an outside-FR subclass with no explanation raises no origin error (got ${originErrs.join(' | ')})`);

  // Client: save + resume still carry the (now optional, inert) field.
  const body = buildStage1ProgressBody({ subclassOriginExplanation: '  Taught by a traveller.  ', pactBoon: 'Pact of the Tome' });
  check(body.subclass_origin_explanation === 'Taught by a traveller.', `the save body carries the trimmed explanation (got ${JSON.stringify(body.subclass_origin_explanation)})`);
  check(body.pact === 'tome' && body.pact_boon === undefined, `the save body sends the pact KEY under 'pact' (got pact=${body.pact}, pact_boon=${body.pact_boon})`);
  check(pactKeyFromName('Pact of the Blade') === 'blade' && pactKeyFromName('Pact of the Talisman') === null && pactKeyFromName('') === null,
    'pactKeyFromName maps the three 2024 pacts only');
  check(pactNameFromKey('chain') === 'Pact of the Chain' && pactNameFromKey('talisman') === null, 'pactNameFromKey maps back');
  const rehydrated = rehydrateStateFromServerRow({ id: 1, pact: 'blade', subclass_origin_explanation: 'From afar.' }, null);
  const patch = rehydrated?.patch ?? rehydrated;
  check(patch?.pactBoon === 'Pact of the Blade', `resume restores the pact display name (got ${JSON.stringify(patch?.pactBoon)})`);
  check(patch?.subclassOriginExplanation === 'From afar.', 'resume restores the subclass origin explanation');
  // Pact round trip through the real PUT.
  const wl = await call('POST', '/api/character', { creator: MARKER, name: 'Pact Warlock', first_name: 'Pact', class: 'warlock', race: 'human' });
  check(wl.status === 201, `warlock draft POST is 201 (got ${wl.status}: ${errOf(wl)})`);
  const put = await call('PUT', `/api/character/${wl.json?.id}`, { ...buildStage1ProgressBody({ pactBoon: 'Pact of the Chain' }), class: 'warlock' });
  check(put.status === 200, `the client save body PUT is 200 (got ${put.status}: ${errOf(put)})`);
  check((await readRow(wl.json?.id))?.pact === 'chain', 'the warlock pact persists from the creator save body');
  // The requirement is gone from Review and Stage 2 (static guards — .jsx).
  const review = readRepo('client/src/components/creator-next/Stage6ReviewCommit.jsx');
  check(!review.includes("'subclassOriginExplanation'") && !review.includes('subclassNeedsOriginExplanation'),
    'Review no longer asks for a subclass origin');
  const stage2 = readRepo('client/src/components/creator-next/Stage2ClassCalling.jsx');
  check(!stage2.includes('stage2-subclass-origin') && !stage2.includes('subclassNeedsOriginExplanation'),
    'Stage 2 no longer shows a subclass origin box');
  const { subclassOriginSuffix } = await import(fromRepo('client/src/components/creator-next/subclassOrigin.js'));
  check(subclassOriginSuffix(outsideFr) === ` · origin ${outsideFr.origin_setting}${outsideFr.origin_region && outsideFr.origin_region !== outsideFr.origin_setting ? ` (${outsideFr.origin_region})` : ''}`,
    `the Stage 2 origin note is informational, no "required" claim (got ${JSON.stringify(subclassOriginSuffix(outsideFr))})`);
}

// ===========================================================================
// (6) Fighting Style picked in the creator works
// ===========================================================================
group('(6) fighting style: feats, AC, attack, prompt, replace on re-commit');
{
  const created = await call('POST', '/api/character', fighterDraft({ name: 'Defense Fighter' }));
  check(created.status === 201, `fighter draft POST is 201 (got ${created.status}: ${errOf(created)})`);
  const id = created.json?.id;
  const committed = await call('POST', `/api/character/${id}/commit`, fighterDraft({ fighting_style: 'Defense' }));
  check(committed.status === 200, `fighter commit with Defense is 200 (got ${committed.status}: ${errOf(committed)})`);
  const row = await readRow(id);
  const feats = JSON.parse(row?.feats || '[]');
  const styleEntries = feats.filter((f) => f && f.category === 'fighting_style');
  check(styleEntries.length === 1 && styleEntries[0].name === 'Defense' && styleEntries[0].source === 'creator-fighting-style',
    `the commit writes Defense into feats once (got ${row?.feats})`);
  // Chain Mail (package A) is AC 16 flat; Defense +1 while wearing armor.
  check(JSON.parse(row.equipment || '{}')?.armor?.name === 'Chain Mail', 'package A puts Chain Mail in the armor slot');
  check(row.armor_class === 17, `stored AC is Chain Mail 16 + Defense 1 = 17 (got ${row.armor_class})`);
  const inPlay = calculateCombatStats(row);
  check(inPlay.ac === 17, `in-play AC agrees, no double count (got ${inPlay.ac})`);
  const promptFeats = renderFeatEffectsForPrompt(parseFeatList(row.feats));
  check(typeof promptFeats === 'string' && promptFeats.includes('Defense'), `the DM prompt feat block names Defense (got ${promptFeats})`);

  // Edit re-commit with Archery: replaces, never stacks.
  const recommit = await call('POST', `/api/character/${id}/commit`, fighterDraft({ fighting_style: 'Archery' }));
  check(recommit.status === 200, `re-commit with Archery is 200 (got ${recommit.status}: ${errOf(recommit)})`);
  const row2 = await readRow(id);
  const styles2 = JSON.parse(row2.feats || '[]').filter((f) => f && f.category === 'fighting_style').map((f) => f.name);
  check(styles2.length === 1 && styles2[0] === 'Archery', `the creator style is replaced, not stacked (got ${JSON.stringify(styles2)})`);
  const archery = fightingStyleAdjustments({ feats: parseFeatList(row2.feats), profile: { rangeType: 'ranged' } });
  check(archery.attackBonusDelta === 2, `Archery gives +2 to a ranged attack (got ${archery.attackBonusDelta})`);
  const melee = fightingStyleAdjustments({ feats: parseFeatList(row2.feats), profile: { rangeType: 'melee' } });
  check(melee.attackBonusDelta === 0, 'Archery gives nothing to a melee attack');
  // A style from another source survives the creator replace.
  await db.dbRun('UPDATE characters SET feats = ? WHERE id = ?', [J([...JSON.parse(row2.feats), { key: 'protection', name: 'Protection', category: 'fighting_style', source: 'level-up' }]), id]);
  await call('POST', `/api/character/${id}/commit`, fighterDraft({ fighting_style: 'Defense' }));
  const styles3 = JSON.parse((await readRow(id)).feats || '[]').filter((f) => f && f.category === 'fighting_style').map((f) => f.name).sort();
  check(JSON.stringify(styles3) === JSON.stringify(['Defense', 'Protection']), `a non-creator style is never touched (got ${JSON.stringify(styles3)})`);
  const sheet = readRepo('client/src/components/CharacterSheet.jsx');
  check(sheet.includes("<h3>Fighting Style</h3>") && sheet.includes("f.category === 'fighting_style'"), 'the character sheet lists the fighting style');
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
