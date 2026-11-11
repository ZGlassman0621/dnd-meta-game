// tests/creator-test-notes-20-snake-case-skills.test.js — creator
// test-notes item 20 (Zach, 2026-11-09): the client sends snake_case
// skill keys ('animal_handling', 'sleight_of_hand') while the server
// validator compared display names ('Animal Handling'), so a Stage 4
// save was refused with "skills: 'animal_handling' is not a known
// skill". The fix is server-side normalization (stage4NormListName in
// server/routes/character.js): every name-list comparison folds
// underscores to spaces, and POST/PUT/commit persist the canonical
// display form — a stored snake_case entry would silently lose its
// proficiency at roll time (rollRequestService compares stored entries
// against display names).
//
// Honest integration tests: the real validators and the real character
// router, driven over real HTTP against a real throwaway DB (the Stage 4
// harness). Fixtures are the verified-good dwarf/soldier bodies from
// creator-next-stage4.test.js. If the real validator were deleted, the
// imports fail and the suite fails with them. The mutation check at the
// end deletes the normalizer from a temp copy of the route and proves
// the snake_case asserts fail without it.
//
// Expected totals are derived from the fixture, not hardcoded registry
// counts: only the two multiword skills (Animal Handling, Sleight of
// Hand) can carry an underscore, so the regression sweep covers both
// as class picks plus single-word snake_case as the control.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-test-notes-20-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf-8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
// The real modules under test.
const { validateCreatorNextStage3, validateCreatorNextStage4, validateCreatorNextStage6 } = await import(fromRepo('server/routes/character.js'));

// --- HTTP harness: the real character router on one app ---------------
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
app.use('/api/character', characterRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
async function postCharacter(body) {
  const res = await fetch(`${base}/api/character`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function putCharacter(id, body) {
  const res = await fetch(`${base}/api/character/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function readCharacter(id) {
  return db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}

const MARKER = 'creator-next';
const J = (v) => JSON.stringify(v); // the wire format for JSON columns: strings, not raw arrays
function errText(r) { return (r.errors || []).join(' '); }

// --- Verified-good fixtures (creator-next-stage4.test.js) -------------
// Dwarf (Hill) / soldier. Point-buy bases cost exactly 27. Finals =
// base + Hill variant {con:2, wis:1} + soldier theme {str:2, con:1}.
const DWARF_BASE = { str: 12, dex: 10, con: 13, int: 8, wis: 15, cha: 14 };
const DWARF_FINAL = { str: 14, dex: 10, con: 16, int: 8, wis: 16, cha: 14 };
// Charlatan finals: base + Hill {con:2, wis:1} + charlatan {cha:2, dex:1}.
const CHARLATAN_FINAL = { str: 12, dex: 11, con: 15, int: 8, wis: 16, cha: 16 };
const DWARF_PREPARED = ['bless', 'cure wounds', 'guiding bolt', 'shield of faith'];
function dwarfClericBody(overrides = {}) {
  return {
    creator: MARKER, class: 'cleric', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    languages: ['Common', 'Dwarvish'],
    prepared_spells: DWARF_PREPARED,
    ...overrides,
  };
}
function dwarfBarbarianBody(overrides = {}) {
  return {
    creator: MARKER, class: 'barbarian', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Animal Handling'],
    languages: ['Common', 'Dwarvish'],
    ...overrides,
  };
}
function dwarfRogueBody(overrides = {}) {
  return {
    creator: MARKER, class: 'rogue', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Sleight of Hand', 'Stealth'],
    languages: ['Common', 'Dwarvish'],
    ...overrides,
  };
}

// (a) Stage 4 validator: snake_case skills pass, display names still
// pass, unknown skills and cross-form duplicates still refuse.
group('(a) Stage 4 validator accepts snake_case skills');
{
  // The exact shape Zach hit: multiword snake_case as the class pick.
  const snakeCleric = validateCreatorNextStage4(dwarfClericBody({ skills: ['athletics', 'intimidation', 'religion'] }));
  check(snakeCleric.ok === true,
    `single-word snake_case skills pass (got ${errText(snakeCleric)})`);
  const snakeBarbarian = validateCreatorNextStage4(dwarfBarbarianBody({ skills: ['athletics', 'intimidation', 'animal_handling'] }));
  check(snakeBarbarian.ok === true,
    `animal_handling passes as a barbarian class pick (got ${errText(snakeBarbarian)})`);
  const snakeRogue = validateCreatorNextStage4(dwarfRogueBody({ skills: ['athletics', 'intimidation', 'sleight_of_hand', 'stealth'] }));
  check(snakeRogue.ok === true,
    `sleight_of_hand passes as a rogue class pick (got ${errText(snakeRogue)})`);
  const mixed = validateCreatorNextStage4(dwarfBarbarianBody({ skills: ['Athletics', 'intimidation', 'Animal Handling'] }));
  check(mixed.ok === true,
    `mixed snake_case + display names pass (got ${errText(mixed)})`);
  const display = validateCreatorNextStage4(dwarfClericBody());
  check(display.ok === true,
    `display names still pass (got ${errText(display)})`);
  const unknown = validateCreatorNextStage4(dwarfClericBody({ skills: ['athletics', 'intimidation', 'swordsmanship'] }));
  check(unknown.ok === false && errText(unknown).includes('skills:') && errText(unknown).includes('not a known skill'),
    `a genuinely unknown skill still refuses (got ${errText(unknown)})`);
  const crossDup = validateCreatorNextStage4(dwarfBarbarianBody({ skills: ['athletics', 'intimidation', 'animal_handling', 'Animal Handling'] }));
  check(crossDup.ok === false && errText(crossDup).includes('skills:') && errText(crossDup).includes('picked twice'),
    `animal_handling + Animal Handling still dedups (got ${errText(crossDup)})`);
  const snakeLang = validateCreatorNextStage4(dwarfClericBody({ languages: ['common', 'dwarvish'] }));
  check(snakeLang.ok === true,
    `snake_case languages pass (got ${errText(snakeLang)})`);
  // Explicit class_skill_picks ride the same normalization.
  const explicitOk = validateCreatorNextStage4(dwarfClericBody({ class_skill_picks: ['religion'] }));
  check(explicitOk.ok === true,
    `explicit snake_case class_skill_picks pass (got ${errText(explicitOk)})`);
  const explicitBad = validateCreatorNextStage4(dwarfClericBody({ class_skill_picks: ['sleight_of_hand'] }));
  check(explicitBad.ok === false && errText(explicitBad).includes("'Sleight of Hand' is not a cleric class skill"),
    `an explicit snake_case pick outside the class list still refuses with the display name (got ${errText(explicitBad)})`);
}

// (b) Stage 3: Skilled subchoice picks ride the same normalization.
group('(b) Stage 3 Skilled subchoices accept snake_case');
{
  const snake = validateCreatorNextStage3({ theme_id: 'noble', origin_feat: 'skilled', origin_feat_choices: ['animal_handling', 'deception', 'stealth'] });
  check(snake.ok === true,
    `snake_case Skilled picks pass (got ${errText(snake)})`);
  const display = validateCreatorNextStage3({ theme_id: 'noble', origin_feat: 'skilled', origin_feat_choices: ['Animal Handling', 'Deception', 'Stealth'] });
  check(display.ok === true,
    `display-name Skilled picks still pass (got ${errText(display)})`);
  const unknown = validateCreatorNextStage3({ theme_id: 'noble', origin_feat: 'skilled', origin_feat_choices: ['swordsmanship'] });
  check(unknown.ok === false && errText(unknown).includes('not a skill or tool'),
    `a genuinely unknown Skilled pick still refuses (got ${errText(unknown)})`);
}

// (c) Stage 6: expertise + feat-granted picks in the final lists,
// all snake_case, on one merged body.
group('(c) Stage 6 expertise + Review feat picks accept snake_case');
{
  const stoutRow = await db.dbGet(
    "SELECT id FROM ancestry_feats WHERE list_id = 'dwarf' AND tier = 1 AND feat_name = 'Stout-Hearted'"
  );
  check(stoutRow?.id != null, 'Stout-Hearted tier-1 dwarf feat resolves from the seed table');
  const stoutId = stoutRow?.id;
  // Fighter / charlatan: every skill is a theme signature or a Skilled
  // pick, so the class-pick count is 0 — the body exercises the
  // signature check, the feat subtraction, the Review needSkill check,
  // and the expertise check, all in snake_case.
  const merged = {
    creator: MARKER, name: 'T20 Fighter', first_name: 'T20', last_name: 'Fighter', gender: 'Female',
    class: 'fighter', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'charlatan', origin_feat: 'skilled',
    origin_feat_choices: ['animal_handling', 'deception', 'stealth'],
    ancestry_feat_id: stoutId, ancestry_feat_choices: {},
    fighting_style: 'Defense',
    generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: CHARLATAN_FINAL,
    skills: ['deception', 'sleight_of_hand', 'animal_handling', 'stealth'],
    languages: ['common', 'dwarvish'],
    tool_proficiencies: ["Smith's Tools"],
    known_spells: [], prepared_spells: [], known_cantrips: [],
    expertise: ['animal_handling'],
    gear_choice: 'packages', package_id: 'A',
    alignment: 'Lawful Good', faith: 'Moradin', lifestyle: 'Modest',
    age: '27', height: "5'9\"", weight: '180 lb',
    eye_color: 'Brown', hair_color: 'Black', skin_color: 'Tan', physical_build: 'Wiry',
    personality_traits: 'Laughs at danger.', ideals: 'Freedom.',
    bonds: 'My sister.', flaws: 'Too trusting.',
    origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast',
  };
  const result = await validateCreatorNextStage6(merged, {});
  check(result.ok === true && result.errors.length === 0,
    `all-snake_case Review body validates clean (got ${JSON.stringify(result.errors)})`);
  const unknownExpertise = await validateCreatorNextStage6({ ...merged, expertise: ['swordsmanship'] }, {});
  check(unknownExpertise.ok === false && errText(unknownExpertise).includes('expertise:') && errText(unknownExpertise).includes('not a known skill'),
    `an unknown expertise pick still refuses (got ${errText(unknownExpertise)})`);
  const notHeldExpertise = await validateCreatorNextStage6({ ...merged, expertise: ['perception'] }, {});
  check(notHeldExpertise.ok === false && errText(notHeldExpertise).includes('expertise:') && errText(notHeldExpertise).includes("not one of the character's skills"),
    `expertise on a skill the character lacks still refuses (got ${errText(notHeldExpertise)})`);
}

// (d) HTTP: a full Stage 4 save with snake_case skills creates the
// row, and the row stores the canonical display form.
group('(d) HTTP save persists the canonical display form');
{
  const created = await postCharacter({
    name: 'T20 Barbarian', ...dwarfBarbarianBody(),
    base_scores: DWARF_BASE, ability_scores: J(DWARF_FINAL),
    skills: J(['athletics', 'intimidation', 'animal_handling']),
    languages: J(['common', 'dwarvish']),
  });
  check(created.status === 201, `snake_case Stage 4 POST creates 201 (got ${created.status}: ${JSON.stringify(created.json?.error || '')})`);
  const barbId = created.json?.id;
  check(typeof barbId === 'number', `created barbarian row has an id (got ${JSON.stringify(created.json?.id)})`);
  if (typeof barbId === 'number') {
    const row = await readCharacter(barbId);
    check(JSON.stringify(JSON.parse(row.skills)) === JSON.stringify(['Athletics', 'Intimidation', 'Animal Handling']),
      `row stores the display form, not the sent snake_case (got ${row.skills})`);
    check(JSON.stringify(JSON.parse(row.languages)) === JSON.stringify(['Common', 'Dwarvish']),
      `row stores display-form languages (got ${row.languages})`);
    // PUT the same row with a snake_case gain: the stored form stays canonical.
    // (The gain is Survival — a barbarian class skill per the 2024 PHB
    // list in classes.json; Stealth is not a barbarian skill, so the
    // route rightly 400s it. The fixture originally sent Stealth.)
    const putGood = await putCharacter(barbId, {
      creator: MARKER, skills: J(['athletics', 'intimidation', 'animal_handling', 'survival']),
    });
    check(putGood.status === 200, `snake_case PUT persists 200 (got ${putGood.status}: ${JSON.stringify(putGood.json?.error || '')})`);
    check(JSON.stringify(JSON.parse((await readCharacter(barbId)).skills)) === JSON.stringify(['Athletics', 'Intimidation', 'Animal Handling', 'Survival']),
      `PUT row stores the display form (got ${(await readCharacter(barbId)).skills})`);
  }
  // Negative control over HTTP: an unknown skill still 400s.
  const refused = await postCharacter({
    name: 'T20 Refused', ...dwarfBarbarianBody(),
    base_scores: DWARF_BASE, ability_scores: J(DWARF_FINAL),
    skills: J(['athletics', 'intimidation', 'swordsmanship']),
    languages: J(['common', 'dwarvish']),
  });
  check(refused.status === 400 && typeof refused.json?.error === 'string' && refused.json.error.includes('not a known skill'),
    `unknown skill still 400s over HTTP (got ${refused.status}: ${JSON.stringify(refused.json?.error || '')})`);
}

// (e) Mutation check: with the normalizer deleted from a temp copy of
// the route, the snake_case asserts must fail — proving the test is
// sensitive to the fix itself and not to a comment or a stale string.
// The temp copy lives beside the real file (same directory, so its
// relative imports resolve) and is unlinked in the finally.
group('(e) Mutation check: no normalizer, no pass');
{
  const routeSrc = readRepo('server/routes/character.js');
  const mutatedSrc = routeSrc.replace(
    "return String(value || '').trim().toLowerCase().replace(/_/g, ' ');",
    "return String(value || '').trim().toLowerCase();",
  );
  check(mutatedSrc !== routeSrc, 'mutation check: the normalizer line exists to mutate');
  if (mutatedSrc !== routeSrc) {
    const mutatedPath = path.join(origCwd, 'server/routes/character.mutated.js');
    fs.writeFileSync(mutatedPath, mutatedSrc);
    let mutatedValidators = null;
    try {
      mutatedValidators = await import(pathToFileURL(mutatedPath).href);
    } catch (e) {
      check(false, `mutated route failed to import: ${e.message}`);
    } finally {
      try { fs.unlinkSync(mutatedPath); } catch {}
    }
    if (mutatedValidators) {
      const mutatedSnake = mutatedValidators.validateCreatorNextStage4(dwarfBarbarianBody({ skills: ['athletics', 'intimidation', 'animal_handling'] }));
      check(mutatedSnake.ok === false && errText(mutatedSnake).includes('not a known skill'),
        `without the normalizer, animal_handling refuses again (got ${errText(mutatedSnake)})`);
      const mutatedDisplay = mutatedValidators.validateCreatorNextStage4(dwarfClericBody());
      check(mutatedDisplay.ok === true,
        'without the normalizer, display names still pass (only the snake_case path went)');
    }
  }
}

server.close();
console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
