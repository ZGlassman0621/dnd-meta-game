// tests/unhook-old-creators.test.js — 2026-11-05 unhook: the old
// creators (CharacterCreatorV2, CharacterCreationWizard, the Prelude
// setup wizards, CharacterManager) are gone; creator-next is the only
// creation path. Static guards on the live client files + one real
// function assert (buildStage1ProgressBody, the save-guard
// precondition). No DB, no server — fs reads and a plain-JS import.
//
// Scope: the ~170 test files not surveyed are NOT grepped here; Zach's
// full `npm test` on his Mac is the gate for the unhook.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const has = (src, s) => src.includes(s);
const lacks = (src, s) => !src.includes(s);

// The real function the shell's blank-save guard calls: a blank Stage 1
// builds an empty body (PUT with an empty body is a 400), any filled
// field builds a body. This is the guard's precondition, asserted
// against the real function — not a re-implementation.
group('Blank-save guard precondition (real buildStage1ProgressBody)');
const { buildStage1ProgressBody } = await import(svc('client/src/components/creator-next/stage1Persistence.js'));
ok(typeof buildStage1ProgressBody === 'function', 'buildStage1ProgressBody is exported from stage1Persistence.js');
const blankBody = buildStage1ProgressBody({});
ok(blankBody && Object.keys(blankBody).length === 0, 'blank state builds an empty body ({}), so the shell skips the save');
const namedBody = buildStage1ProgressBody({ first_name: 'Garrick', race: 'human' });
ok(namedBody.first_name === 'Garrick' && namedBody.name === 'Garrick' && namedBody.race === 'human', 'a filled state builds a non-empty body (save proceeds)');

group('HomeFlow routes only to the new creator');
const homeFlow = read('client/src/components/creator/HomeFlow.jsx');
for (const s of ['CharacterCreatorV2', 'PreludeCreatorV2', 'PathChoiceScreen', 'PRELUDE_ENABLED', 'creatorPersistence', 'handlePreviewNext', 'handlePickCampaign', 'handlePickPrelude', 'handlePreludeCreated', 'handleSubmitSuccess', 'resumePayload', 'resumeState', 'preludeDraftState', 'preludeDraftCharacterId', "wizard.manual", "wizard.resume", "prelude.setup", "route === 'path'", 'onPreviewNext']) {
  ok(lacks(homeFlow, s), `HomeFlow has no '${s}'`);
}
ok(has(homeFlow, "setRoute('wizard.next')"), "HomeFlow routes 'creating' cards to wizard.next");
ok(has(homeFlow, 'resumeCharacterId={resumeCharacterId}'), 'HomeFlow passes resumeCharacterId to the new creator shell');
ok(has(homeFlow, 'Prelude handoff is not built in the new creator yet'), 'ready_for_primary cards get an honest error, not a route');
ok(has(homeFlow, 'Prelude setup is not available in the new creator yet'), 'prelude_setup cards get an honest error, not a route');
ok(has(homeFlow, "setRoute('prelude.session')"), 'in-flight Prelude sessions still route to PreludeSession');
ok(has(homeFlow, "setRoute('prelude.arc')") || has(homeFlow, "'prelude.arc'"), 'Prelude arc preview route still exists');

group('HomeScreenV2 has one create card, the new creator');
const home = read('client/src/components/creator/HomeScreenV2.jsx');
ok(lacks(home, 'onPreviewNext'), 'HomeScreenV2 has no onPreviewNext prop');
ok(lacks(home, 'Preview'), 'HomeScreenV2 has no "Preview" labeling');
const createCards = (home.match(/charcard create/g) || []).length;
ok(createCards === 1, `exactly one create card (found ${createCards})`);
ok(has(home, 'aria-label="Create a new character"'), 'the create card is the new creator');

group('CreatorNextShell is the live creator, not a preview');
const shell = read('client/src/components/creator-next/CreatorNextShell.jsx');
ok(has(shell, 'resumeCharacterId'), 'shell accepts resumeCharacterId');
ok(lacks(shell, 'no saved picks found in this browser'), 'shell stays silent when a resume starts blank (no resume notice — #1 silent restore)');
ok(has(shell, "fetch('/api/species')"), 'shell still fetches the species registry');
// Seam fix (R2-11e): the blank-save guard threads the /api/themes
// list through so the Soldier second field's key resolves from the
// theme entry — the one-arg call is gone by decision.
ok(has(shell, 'buildStage1ProgressBody(state, themes)'), 'shell guards the blank save with the real body builder');
ok(lacks(shell, 'preview'), 'shell has no "preview" labeling left');
ok(lacks(shell, 'Exit preview'), 'shell exit button is "Exit", not "Exit preview"');

group('App.jsx has no CharacterManager / edit-in-wizard path');
const app = read('client/src/App.jsx');
ok(lacks(app, "from './components/CharacterManager'"), 'App.jsx does not import CharacterManager');
ok(lacks(app, '<CharacterManager'), 'App.jsx renders no <CharacterManager>');
for (const s of ['showCreationForm', 'editCharacterInWizard', 'handleEditInWizard', 'onEditInWizard', 'setShowCreationForm', 'setEditCharacterInWizard']) {
  ok(lacks(app, s), `App.jsx has no '${s}'`);
}

group('CharacterSheet has no Edit-in-Wizard buttons');
const sheet = read('client/src/components/CharacterSheet.jsx');
ok(lacks(sheet, 'onEditInWizard'), 'CharacterSheet has no onEditInWizard prop');
ok(lacks(sheet, 'Edit in Wizard'), 'CharacterSheet has no "Edit in Wizard" button');
ok(has(sheet, 'Equipment editing arrives with the new creator'), 'empty-inventory notice points at edit mode');

group('Dead files are deleted; kept files exist');
const deleted = [
  'client/src/components/creator/CharacterCreatorV2.jsx',
  'client/src/components/creator/Step1Identity.jsx',
  'client/src/components/creator/Step2Ancestry.jsx',
  'client/src/components/creator/Step3Theme.jsx',
  'client/src/components/creator/Step4ClassCalling.jsx',
  'client/src/components/creator/Step5AbilityScores.jsx',
  'client/src/components/creator/Step6Equipment.jsx',
  'client/src/components/creator/Step7IdentityDetails.jsx',
  'client/src/components/creator/Step8Review.jsx',
  'client/src/components/creator/PreludeCreatorV2.jsx',
  'client/src/components/creator/PreludeStep1Identity.jsx',
  'client/src/components/creator/PreludeStep2Ancestry.jsx',
  'client/src/components/creator/PreludeStep3Origin.jsx',
  'client/src/components/creator/PreludeStep4Family.jsx',
  'client/src/components/creator/PreludeStep5Appearance.jsx',
  'client/src/components/creator/PreludeStep6Review.jsx',
  'client/src/components/creator/creatorPersistence.js',
  'client/src/components/creator/preludePersistence.js',
  'client/src/components/creator/PathChoiceScreen.jsx',
  'client/src/components/creator/AlignmentChip.jsx',
  'client/src/components/creator/BumpCelebrationCard.jsx',
  'client/src/components/creator/ExpansionSection.jsx',
  'client/src/components/creator/MomentList.jsx',
  'client/src/components/creator/PromptList.jsx',
  'client/src/components/creator/RaceAwareColorPicker.jsx',
  'client/src/components/creator/RaceAwareDimensionPicker.jsx',
  'client/src/components/creator/equipmentResolver.js',
  'client/src/components/CharacterCreationWizard.jsx',
  'client/src/components/CharacterManager.jsx',
  'client/src/components/PreludeSetupWizard.jsx',
  'client/src/components/PreludeTransitionScreen.jsx',
];
for (const f of deleted) {
  ok(!fs.existsSync(path.join(REPO, f)), `deleted: ${f}`);
}
const kept = [
  'client/src/components/creator/HomeFlow.jsx',
  'client/src/components/creator/HomeScreenV2.jsx',
  'client/src/components/creator/creatorPrimitives.jsx',
  'client/src/components/creator/CelebrationCard.jsx',
  'client/src/components/creator-next/CreatorNextShell.jsx',
  'client/src/components/creator-next/Stage1OriginIdentity.jsx',
  'client/src/data/races.json',
  'client/src/styles/creator-theme.css',
];
for (const f of kept) {
  ok(fs.existsSync(path.join(REPO, f)), `kept: ${f}`);
}

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
