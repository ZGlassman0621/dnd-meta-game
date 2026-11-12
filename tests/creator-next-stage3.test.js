// tests/creator-next-stage3.test.js — creator-next Stage 3 (theme-only)
// mappings build (Zach, 2026-11-06; draft approved 2026-11-06 00:48 EST).
//
// What this build wires in:
//   - the 2024 origin-feat catalog is complete (10 feats): 7 new entries
//     (Crafter, Healer, Magic Initiate, Musician, Skilled, Tavern
//     Brawler, Tough), Savage Attacker moved general -> origin with
//     2024 wording, Alert corrected (the +1 Int/Wis was not a 2024
//     benefit), Lucky untouched;
//   - every one of the 21 themes carries a FIXED origin feat + a FIXED
//     +2/+1 ASI (+ origin_feat_spell_list on the three Magic Initiate
//     themes); the ASI resolves from themes.js via the stored theme —
//     no origin feat grants an ASI, so nothing stacks to +3 at L1;
//   - POST/PUT grant the origin feat into character_origin_feats
//     (migration 107) and validate creator-next Stage 3 picks with
//     field-named 400s; GET /api/themes serves the registry.
//   - the client Stage 3 picker (Stage3PastPath.jsx) renders from the
//     served shape, with subchoice pickers for the four subchoice
//     feats and conditional pickers for the three creation-sub-choice
//     themes.
//
// Expected values below are copied from the approved draft
// (~/workspace/dnd-app-review/stage3-mappings/stage3-mappings-draft.md
// §1c effect strings, §2 feat table, §3 ASI table) — NOT from memory —
// and were cross-checked against the live themes.js / featRegistry.js
// in the mirror before this file was written: every draft row matches
// the live registry entry. The test asserts the live code against the
// draft table, so a drift in either direction fails loudly.
//
// Honest integration tests: the validator, theme service, feat
// registry, and both routers are the real modules, driven over real
// HTTP against a real throwaway DB (same harness as
// stage2-validation-wiring.test.js). If character.js, themes.js, or
// themeService.js were deleted, the imports fail and the suite fails
// with them. No registry total is hardcoded from memory: the 21-theme
// count is the draft §0 count, and the 10-feat list is the draft §1a
// exhaustive 2024 list.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-next-stage3-test-'));
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
const { getFeatEffect } = await import(fromRepo('server/data/featRegistry.js'));
const { THEMES } = await import(fromRepo('server/data/themes.js'));
const themeService = await import(fromRepo('server/services/themeService.js'));
const { listThemes, resolveTheme, originFeatFor, toClientShape } = themeService;
const { validateCreatorNextStage3 } = await import(fromRepo('server/routes/character.js'));
const { getCharacterProgression } = await import(fromRepo('server/services/progressionService.js'));
const { resolveChoiceOptions, isHeldOption } = await import(fromRepo('client/src/components/creator-next/choiceOptions.js'));

// --- HTTP harness: the real character + themes routers on one app ----
const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
const themesRouter = (await import(fromRepo('server/routes/themes.js'))).default;
app.use('/api/character', characterRouter);
app.use('/api/themes', themesRouter);
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
async function getThemes(pathSuffix = '') {
  const res = await fetch(`${base}/api/themes${pathSuffix}`);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function characterCountByName(name) {
  const row = await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', [name]);
  return row?.n ?? 0;
}

const MARKER = 'creator-next';

// Draft §1c — the exact registry effect strings (7 new + Alert
// corrected + Savage Attacker 2024 wording). Lucky's text is the live
// entry, confirmed unchanged by the draft.
const ORIGIN_FEAT_EFFECTS = {
  alert: "Add your proficiency bonus to Initiative; immediately after rolling Initiative, you may swap your Initiative with a willing ally in the same combat (neither can have the Incapacitated condition)",
  crafter: "Proficiency with three Artisan's Tools of your choice from the Fast Crafting table; 20% discount on nonmagical items; at the end of a Long Rest, craft one piece of gear from the Fast Crafting table (requires the associated tools and proficiency with them); the crafted item lasts until you finish another Long Rest, then falls apart",
  healer: "With a Healer's Kit, expend one use as a Utilize action to tend a creature within 5 ft; that creature expends one of its Hit Point Dice and regains HP equal to the roll + your proficiency bonus; when you roll dice to restore HP with a spell or this feat's Battle Medic benefit, reroll any 1s (must use the new roll)",
  lucky: "After a long rest, Luck Points equal to your proficiency bonus; spend one to gain advantage on a d20 test, or to impose disadvantage on an attack roll against you",
  magic_initiate: "Choose one spell list — Cleric, Druid, or Wizard; learn two cantrips and one level 1 spell from it (Intelligence, Wisdom, or Charisma is your spellcasting ability, chosen when you take the feat); the level 1 spell is always prepared, castable once per Long Rest without a slot and with spell slots thereafter; on gaining a level, replace one feat spell with another of the same level from the list; repeatable with a different list",
  musician: "Proficiency with three musical instruments of your choice; as you finish a Short or Long Rest, play a song on an instrument you are proficient with to give Heroic Inspiration to allies who hear it, up to your proficiency bonus in allies",
  skilled: "Proficiency in any combination of three skills or tools of your choice; repeatable",
  savage_attacker: "Once per turn, when you hit a target with a weapon, roll the weapon's damage dice twice and use either roll against the target",
  tavern_brawler: "When you hit with an Unarmed Strike and deal damage, deal 1d4 + Strength bludgeoning instead of the normal damage; reroll any 1 on an Unarmed Strike damage die (must use the new roll); proficiency with improvised weapons; once per turn, when you hit a creature with an Unarmed Strike as part of the Attack action, push it 5 ft away in addition to dealing damage",
  tough: "Your Hit Point maximum increases by twice your character level when you gain this feat; thereafter it increases by 2 each time you level up",
};

// Draft §2 (feat) + §3 (ASI), one row per theme. Spell list is the
// theme's FIXED Magic Initiate list (draft §2); null otherwise.
const EXPECTED_THEMES = {
  acolyte: { feat: 'magic_initiate', list: 'Cleric', asi: { wis: 2, int: 1 } },
  charlatan: { feat: 'skilled', list: null, asi: { cha: 2, dex: 1 } },
  criminal: { feat: 'alert', list: null, asi: { dex: 2, int: 1 } },
  entertainer: { feat: 'musician', list: null, asi: { cha: 2, dex: 1 } },
  hermit: { feat: 'healer', list: null, asi: { wis: 2, con: 1 } },
  noble: { feat: 'skilled', list: null, asi: { cha: 2, int: 1 } },
  sage: { feat: 'magic_initiate', list: 'Wizard', asi: { int: 2, wis: 1 } },
  sailor: { feat: 'tavern_brawler', list: null, asi: { str: 2, dex: 1 } },
  soldier: { feat: 'savage_attacker', list: null, asi: { str: 2, con: 1 } },
  city_watch: { feat: 'alert', list: null, asi: { str: 2, wis: 1 } },
  clan_crafter: { feat: 'crafter', list: null, asi: { str: 2, dex: 1 } },
  far_traveler: { feat: 'lucky', list: null, asi: { dex: 2, wis: 1 } },
  folk_hero: { feat: 'tough', list: null, asi: { con: 2, str: 1 } },
  guild_artisan: { feat: 'crafter', list: null, asi: { int: 2, dex: 1 } },
  haunted_one: { feat: 'alert', list: null, asi: { wis: 2, con: 1 } },
  investigator: { feat: 'alert', list: null, asi: { int: 2, wis: 1 } },
  knight_of_the_order: { feat: 'tough', list: null, asi: { str: 2, cha: 1 } },
  mercenary_veteran: { feat: 'savage_attacker', list: null, asi: { con: 2, str: 1 } },
  outlander: { feat: 'magic_initiate', list: 'Druid', asi: { dex: 2, wis: 1 } },
  urban_bounty_hunter: { feat: 'alert', list: null, asi: { wis: 2, dex: 1 } },
  urchin: { feat: 'lucky', list: null, asi: { dex: 2, cha: 1 } },
};

// ===========================================================================
// (a) The 10 origin feats resolve from the real registry
// ===========================================================================
group('(a) origin-feat catalog — 10 feats, draft §1c text, no duplicates');
{
  const keys = Object.keys(ORIGIN_FEAT_EFFECTS);
  check(keys.length === 10, `draft §1a exhaustive 2024 origin list is 10 feats (got ${keys.length})`);
  for (const key of keys) {
    const entry = getFeatEffect(key);
    check(entry !== null, `${key} resolves from the registry`);
    check(entry?.category === 'origin', `${key} is category 'origin' (got ${entry?.category})`);
    check(entry?.source === 'core', `${key} resolves from core, not homebrew (got ${entry?.source})`);
    check(entry?.effect === ORIGIN_FEAT_EFFECTS[key],
      `${key} effect matches draft §1c exactly (got ${JSON.stringify(entry?.effect)})`);
    // Name-form lookup must find the same entry (the validator and the
    // client both accept names as well as keys).
    const byName = getFeatEffect(entry?.name);
    check(byName?.key === key, `${key} also resolves by name '${entry?.name}'`);
  }
  // The two corrections, spelled out: Alert carries no ASI, Savage
  // Attacker carries the 2024 "twice" wording, not the 2014 reroll.
  check(!getFeatEffect('alert').effect.includes('+1 Intelligence'),
    'Alert no longer carries the +1 Int/Wis (draft §1b correction)');
  check(!getFeatEffect('alert').effect.includes('+1 Wisdom'),
    'Alert no longer carries +1 Wisdom either');
  check(getFeatEffect('alert').effect.includes('Incapacitated'),
    'Alert carries the Incapacitated clause on the swap');
  check(getFeatEffect('savage_attacker').effect.includes('twice'),
    'Savage Attacker uses the 2024 "roll twice" wording');
  check(!getFeatEffect('savage_attacker').effect.includes('reroll one damage die'),
    'Savage Attacker no longer carries the 2014 wording');
  // Draft §1a: Lightly Armored is a General feat, NOT an origin feat.
  const lightly = getFeatEffect('lightly_armored');
  check(!lightly || lightly.category !== 'origin',
    `Lightly Armored is not an origin feat (got ${lightly?.category ?? 'absent'})`);
  // Savage Attacker was updated in place, not duplicated: the name-keyed
  // lookup is first-wins, so a duplicate would be silently ignored.
  const registrySrc = readRepo('server/data/featRegistry.js');
  const savageCount = (registrySrc.match(/key: 'savage_attacker'/g) || []).length;
  check(savageCount === 1, `exactly one Savage Attacker entry in featRegistry.js (found ${savageCount})`);
  const alertCount = (registrySrc.match(/key: 'alert'/g) || []).length;
  check(alertCount === 1, `exactly one Alert entry in featRegistry.js (found ${alertCount})`);
}

// ===========================================================================
// (b) All 21 themes carry their drafted feat + ASI (+ fixed MI list)
// ===========================================================================
group('(b) theme mappings — all 21 themes, draft §2/§3');
{
  check(THEMES.length === 21, `registry holds 21 playable themes (draft §0, got ${THEMES.length})`);
  check(Object.keys(EXPECTED_THEMES).length === 21, 'expected table covers 21 themes');
  const seenFeats = new Set();
  for (const [id, expected] of Object.entries(EXPECTED_THEMES)) {
    const entry = THEMES.find((t) => t.id === id);
    check(entry !== undefined, `theme '${id}' exists in themes.js`);
    if (!entry) continue;
    check(entry.origin_feat === expected.feat,
      `${id}: origin_feat is ${expected.feat} (got ${entry.origin_feat})`);
    try {
      assert.deepStrictEqual(entry.ability_score_increase, expected.asi);
      check(true, `${id}: ASI is ${JSON.stringify(expected.asi)}`);
    } catch {
      check(false, `${id}: ASI is ${JSON.stringify(expected.asi)} (got ${JSON.stringify(entry.ability_score_increase)})`);
    }
    const asiValues = Object.values(entry.ability_score_increase || {});
    check(asiValues.reduce((a, b) => a + b, 0) === 3,
      `${id}: ASI sums to +3 (got ${JSON.stringify(entry.ability_score_increase)})`);
    check(Math.max(...asiValues) === 2,
      `${id}: no stat above +2 — no +3 stacking (draft §1b/§3)`);
    check((entry.origin_feat_spell_list || null) === expected.list,
      `${id}: Magic Initiate list is ${expected.list ?? 'none'} (got ${entry.origin_feat_spell_list ?? 'none'})`);
    check(originFeatFor(id) === expected.feat,
      `${id}: originFeatFor(id) returns ${expected.feat}`);
    check(originFeatFor(entry) === expected.feat,
      `${id}: originFeatFor(entry) returns ${expected.feat}`);
    check(resolveTheme(id)?.id === id, `${id}: resolveTheme finds it by id`);
    const shape = toClientShape(entry);
    check(shape.origin_feat === expected.feat, `${id}: client shape carries origin_feat ${expected.feat}`);
    check(shape.origin_feat_name === getFeatEffect(expected.feat)?.name,
      `${id}: client shape carries the resolved feat name (${shape.origin_feat_name})`);
    check(shape.origin_feat_effect === ORIGIN_FEAT_EFFECTS[expected.feat],
      `${id}: client shape carries the feat effect text`);
    try {
      assert.deepStrictEqual(shape.ability_score_increase, expected.asi);
      check(true, `${id}: client shape carries the ASI`);
    } catch {
      check(false, `${id}: client shape carries the ASI (got ${JSON.stringify(shape.ability_score_increase)})`);
    }
    check(shape.origin_feat_spell_list === expected.list || (shape.origin_feat_spell_list === null && expected.list === null),
      `${id}: client shape carries the spell list (${shape.origin_feat_spell_list ?? 'none'})`);
    seenFeats.add(expected.feat);
  }
  // Draft §2 coverage: all 10 origin feats are used by at least one theme.
  check(seenFeats.size === 10, `all 10 origin feats are used across themes (got ${seenFeats.size})`);
  for (const key of Object.keys(ORIGIN_FEAT_EFFECTS)) {
    check(seenFeats.has(key), `origin feat ${key} is used by at least one theme`);
  }
  check(listThemes().length === 21, 'listThemes() returns 21 entries');
  check(resolveTheme('not-a-theme') === null, 'resolveTheme returns null for an unknown id');
  check(originFeatFor('not-a-theme') === null, 'originFeatFor returns null for an unknown id');
  check(resolveTheme('CITY_WATCH')?.id === 'city_watch', 'resolveTheme is case-insensitive');
}

// ===========================================================================
// (c) Grant at submit persists — POST + PUT, rows + progression snapshot
// ===========================================================================
group('(c) grant at submit — POST/PUT persist theme + origin feat rows');
{
  // Acolyte: Magic Initiate with real sub-choices. Cantrips/spell are
  // verified against the server catalog (582 entries) by the validator:
  // Guidance + Sacred Flame are Cleric cantrips, Cure Wounds is L1 Cleric.
  const miChoices = {
    spell_list: 'Cleric',
    spellcasting_ability: 'Wisdom',
    cantrips: ['Guidance', 'Sacred Flame'],
    level1_spell: 'Cure Wounds',
  };
  const acolyte = await postCharacter({
    name: 'S3 Acolyte', race: 'human', creator: MARKER,
    theme_id: 'acolyte', origin_feat: 'magic_initiate', origin_feat_choices: miChoices,
  });
  check(acolyte.status === 201, `acolyte + Magic Initiate POST accepted with 201 (got ${acolyte.status}: ${JSON.stringify(acolyte.json)})`);
  const acolyteId = acolyte.json?.id;
  check(typeof acolyteId === 'number', `acolyte row has an id (got ${JSON.stringify(acolyte.json?.id)})`);
  const themeRow = await db.dbGet('SELECT theme_id, path_choice FROM character_themes WHERE character_id = ?', [acolyteId]);
  check(themeRow?.theme_id === 'acolyte', `character_themes row stores acolyte (got ${themeRow?.theme_id})`);
  const featRow = await db.dbGet('SELECT feat_key, choices_json, selected_at_level FROM character_origin_feats WHERE character_id = ?', [acolyteId]);
  check(featRow?.feat_key === 'magic_initiate', `character_origin_feats row stores magic_initiate (got ${featRow?.feat_key})`);
  check(featRow?.selected_at_level === 1, `origin feat selected at level 1 (got ${featRow?.selected_at_level})`);
  const storedChoices = featRow?.choices_json ? JSON.parse(featRow.choices_json) : null;
  try {
    assert.deepStrictEqual(storedChoices, miChoices);
    check(true, 'stored Magic Initiate choices round-trip exactly');
  } catch {
    check(false, `stored Magic Initiate choices round-trip exactly (got ${featRow?.choices_json})`);
  }
  // The stored theme resolves back to the drafted feat + ASI — the ASI
  // itself lives in themes.js, not on the character row (there is no
  // character-row ASI column, by design).
  const resolved = resolveTheme(themeRow?.theme_id);
  check(resolved?.origin_feat === 'magic_initiate', 'stored theme resolves to magic_initiate');
  try {
    assert.deepStrictEqual(resolved?.ability_score_increase, { wis: 2, int: 1 });
    check(true, 'stored theme resolves to the drafted ASI { wis: 2, int: 1 }');
  } catch {
    check(false, `stored theme resolves to the drafted ASI (got ${JSON.stringify(resolved?.ability_score_increase)})`);
  }
  check(originFeatFor(resolved) === 'magic_initiate', 'originFeatFor(stored theme) is magic_initiate');
  // Progression snapshot: the single source of truth for the DM prompt.
  const prog = await getCharacterProgression(acolyteId);
  check(prog?.origin_feat?.feat_key === 'magic_initiate',
    `progression origin_feat block carries magic_initiate (got ${JSON.stringify(prog?.origin_feat)})`);
  check(prog?.origin_feat?.feat_name === 'Magic Initiate',
    `progression origin_feat block names the feat (got ${prog?.origin_feat?.feat_name})`);
  check(prog?.origin_feat?.effect === ORIGIN_FEAT_EFFECTS.magic_initiate,
    'progression origin_feat block carries the draft effect text');
  try {
    assert.deepStrictEqual(prog?.origin_feat?.choices_data, miChoices);
    check(true, 'progression origin_feat block carries the parsed choices');
  } catch {
    check(false, `progression origin_feat block carries the parsed choices (got ${JSON.stringify(prog?.origin_feat?.choices_data)})`);
  }

  // A no-pick feat: soldier + Savage Attacker, no choices at all.
  const soldier = await postCharacter({
    name: 'S3 Soldier', race: 'human', creator: MARKER,
    theme_id: 'soldier', origin_feat: 'savage_attacker',
  });
  check(soldier.status === 201, `soldier + Savage Attacker POST accepted with 201 (got ${soldier.status})`);
  const soldierFeat = await db.dbGet('SELECT feat_key, choices_json FROM character_origin_feats WHERE character_id = ?', [soldier.json?.id]);
  check(soldierFeat?.feat_key === 'savage_attacker', `soldier origin row stores savage_attacker (got ${soldierFeat?.feat_key})`);
  check(soldierFeat?.choices_json === null, `no-pick feat stores null choices (got ${soldierFeat?.choices_json})`);
  const soldierTheme = await db.dbGet('SELECT theme_id FROM character_themes WHERE character_id = ?', [soldier.json?.id]);
  check(soldierTheme?.theme_id === 'soldier', `soldier theme row stores soldier (got ${soldierTheme?.theme_id})`);

  // PUT: a draft PUT carrying only a theme + origin feat persists both
  // (PUT never persisted themes before this build), and a re-pick
  // overwrites the single origin row (INSERT OR REPLACE, one row per
  // character) instead of adding a second.
  const draft = await postCharacter({ name: 'S3 Put Row', race: 'human', creator: MARKER });
  check(draft.status === 201, `PUT fixture row created (got ${draft.status})`);
  const draftId = draft.json?.id;
  const put1 = await putCharacter(draftId, {
    creator: MARKER, theme_id: 'entertainer', origin_feat: 'musician',
    origin_feat_choices: { instruments: ['Lute', 'Flute', 'Drum'] },
  });
  check(put1.status === 200, `PUT entertainer + Musician accepted with 200 (got ${put1.status}: ${JSON.stringify(put1.json)})`);
  const putTheme = await db.dbGet('SELECT theme_id FROM character_themes WHERE character_id = ?', [draftId]);
  check(putTheme?.theme_id === 'entertainer', `PUT persisted the theme row (got ${putTheme?.theme_id})`);
  const putFeat = await db.dbGet('SELECT feat_key, choices_json FROM character_origin_feats WHERE character_id = ?', [draftId]);
  check(putFeat?.feat_key === 'musician', `PUT persisted the origin feat row (got ${putFeat?.feat_key})`);
  const putChoices = putFeat?.choices_json ? JSON.parse(putFeat.choices_json) : null;
  try {
    assert.deepStrictEqual(putChoices, { instruments: ['Lute', 'Flute', 'Drum'] });
    check(true, 'PUT persisted the Musician instrument picks');
  } catch {
    check(false, `PUT persisted the Musician instrument picks (got ${putFeat?.choices_json})`);
  }
  const put2 = await putCharacter(draftId, {
    creator: MARKER, theme_id: 'noble', origin_feat: 'skilled',
    origin_feat_choices: ['Perception', 'Stealth', 'Athletics'],
  });
  check(put2.status === 200, `PUT re-pick to noble + Skilled accepted with 200 (got ${put2.status})`);
  const featRows = await db.dbAll('SELECT feat_key FROM character_origin_feats WHERE character_id = ?', [draftId]);
  check(featRows.length === 1 && featRows[0].feat_key === 'skilled',
    `re-pick overwrote the single origin row (now ${featRows.map((r) => r.feat_key).join(',')})`);
  const themeRows = await db.dbAll('SELECT theme_id FROM character_themes WHERE character_id = ?', [draftId]);
  check(themeRows.length === 1 && themeRows[0].theme_id === 'noble',
    `re-pick overwrote the single theme row (now ${themeRows.map((r) => r.theme_id).join(',')})`);
}

// ===========================================================================
// (d) Validation — unit + HTTP, field-named refusals, draft-tolerant
// ===========================================================================
group('(d) validateCreatorNextStage3 — unit + HTTP refusals');
{
  // Draft-tolerant: absent picks pass; the hard gate is Review (Stage 6).
  check(validateCreatorNextStage3({}).ok === true, 'empty body is a draft, not invalid');
  check(validateCreatorNextStage3({ theme_id: 'acolyte' }).ok === true, 'theme present + feat absent passes');
  check(validateCreatorNextStage3({ theme_id: 'acolyte', origin_feat: '' }).ok === true, 'empty feat string passes as a draft');
  check(validateCreatorNextStage3({ creator: MARKER }).ok === true, 'marker-only body passes');

  const unknownFeat = validateCreatorNextStage3({ theme_id: 'acolyte', origin_feat: 'not-a-feat' });
  check(unknownFeat.ok === false, 'unknown origin feat is refused');
  check(unknownFeat.errors.join(' ').includes('originFeat:'), `unknown-feat refusal names originFeat (got ${unknownFeat.errors.join('; ')})`);

  const nonOrigin = validateCreatorNextStage3({ theme_id: 'soldier', origin_feat: 'sharpshooter' });
  check(nonOrigin.ok === false, 'a non-origin feat (Sharpshooter) is refused');
  check(nonOrigin.errors.join(' ').includes('originFeat:'), `non-origin refusal names originFeat (got ${nonOrigin.errors.join('; ')})`);

  const mismatch = validateCreatorNextStage3({ theme_id: 'acolyte', origin_feat: 'tough' });
  check(mismatch.ok === false, 'a feat that is not the theme fixed feat is refused');
  check(mismatch.errors.join(' ').includes('originFeat:'), `mismatch refusal names originFeat (got ${mismatch.errors.join('; ')})`);
  check(mismatch.errors.join(' ').includes('Magic Initiate'), `mismatch refusal names the expected feat (got ${mismatch.errors.join('; ')})`);

  const byName = validateCreatorNextStage3({ theme_id: 'acolyte', origin_feat: 'Magic Initiate' });
  check(byName.ok === true, 'the feat may be sent by name as well as by key');

  const unknownTheme = validateCreatorNextStage3({ theme_id: 'not-a-theme', origin_feat: 'alert' });
  check(unknownTheme.ok === false, 'unknown theme id is refused');
  check(unknownTheme.errors.join(' ').includes('themeId:'), `unknown-theme refusal names themeId (got ${unknownTheme.errors.join('; ')})`);

  const featNoTheme = validateCreatorNextStage3({ origin_feat: 'alert' });
  check(featNoTheme.ok === false, 'feat present without a theme is refused');
  check(featNoTheme.errors.join(' ').includes('originFeat:'), `feat-without-theme refusal names originFeat (got ${featNoTheme.errors.join('; ')})`);

  // Magic Initiate choices (validated when present, not required yet).
  const goodMI = validateCreatorNextStage3({
    theme_id: 'acolyte', origin_feat: 'magic_initiate',
    origin_feat_choices: { spell_list: 'Cleric', spellcasting_ability: 'Wisdom', cantrips: ['Guidance', 'Sacred Flame'], level1_spell: 'Cure Wounds' },
  });
  check(goodMI.ok === true, `valid Magic Initiate choices pass (got ${goodMI.errors.join('; ')})`);
  const wrongList = validateCreatorNextStage3({
    theme_id: 'acolyte', origin_feat: 'magic_initiate',
    origin_feat_choices: { spell_list: 'Wizard', cantrips: ['Guidance', 'Sacred Flame'], level1_spell: 'Cure Wounds' },
  });
  check(wrongList.ok === false && wrongList.errors.join(' ').includes('originFeatChoices:'),
    `wrong MI spell list refused naming originFeatChoices (got ${wrongList.errors.join('; ')})`);
  const wrongAbility = validateCreatorNextStage3({
    theme_id: 'acolyte', origin_feat: 'magic_initiate',
    origin_feat_choices: { spellcasting_ability: 'Strength', cantrips: ['Guidance', 'Sacred Flame'], level1_spell: 'Cure Wounds' },
  });
  check(wrongAbility.ok === false && wrongAbility.errors.join(' ').includes('originFeatChoices:'),
    `bad MI ability refused naming originFeatChoices (got ${wrongAbility.errors.join('; ')})`);
  const oneCantrip = validateCreatorNextStage3({
    theme_id: 'acolyte', origin_feat: 'magic_initiate',
    origin_feat_choices: { cantrips: ['Guidance'], level1_spell: 'Cure Wounds' },
  });
  check(oneCantrip.ok === false && oneCantrip.errors.join(' ').includes('originFeatChoices:'),
    `one cantrip refused naming originFeatChoices (got ${oneCantrip.errors.join('; ')})`);
  const offList = validateCreatorNextStage3({
    theme_id: 'acolyte', origin_feat: 'magic_initiate',
    origin_feat_choices: { cantrips: ['Guidance', 'Fire Bolt'], level1_spell: 'Cure Wounds' },
  });
  check(offList.ok === false && offList.errors.join(' ').includes('originFeatChoices:'),
    `off-list cantrip (Fire Bolt is not Cleric) refused (got ${offList.errors.join('; ')})`);
  const partialMI = validateCreatorNextStage3({
    theme_id: 'acolyte', origin_feat: 'magic_initiate',
    origin_feat_choices: { spell_list: 'Cleric' },
  });
  check(partialMI.ok === true, 'partial Magic Initiate choices pass (draft-tolerant)');

  // Skilled shape: at most 3 distinct picks.
  const tooMany = validateCreatorNextStage3({
    theme_id: 'charlatan', origin_feat: 'skilled',
    origin_feat_choices: ['Perception', 'Stealth', 'Athletics', 'Arcana'],
  });
  check(tooMany.ok === false && tooMany.errors.join(' ').includes('originFeatChoices:'),
    `4 Skilled picks refused naming originFeatChoices (got ${tooMany.errors.join('; ')})`);
  const dupPick = validateCreatorNextStage3({
    theme_id: 'charlatan', origin_feat: 'skilled',
    origin_feat_choices: ['Perception', 'Perception'],
  });
  check(dupPick.ok === false && dupPick.errors.join(' ').includes('originFeatChoices:'),
    `duplicate Skilled pick refused (got ${dupPick.errors.join('; ')})`);

  // --- HTTP: the same refusals over the real route, marker-gated -------
  const badMismatch = await postCharacter({ name: 'S3 Bad Mismatch', race: 'human', creator: MARKER, theme_id: 'acolyte', origin_feat: 'tough' });
  check(badMismatch.status === 400, `marker + acolyte/Tough refused with 400 (got ${badMismatch.status})`);
  check(typeof badMismatch.json?.error === 'string' && badMismatch.json.error.includes('originFeat:'),
    `mismatch refusal names originFeat (got ${JSON.stringify(badMismatch.json)})`);
  check(await characterCountByName('S3 Bad Mismatch') === 0, 'refused mismatch created no row');

  const badUnknownFeat = await postCharacter({ name: 'S3 Bad Feat', race: 'human', creator: MARKER, theme_id: 'acolyte', origin_feat: 'not-a-feat' });
  check(badUnknownFeat.status === 400, `marker + unknown feat refused with 400 (got ${badUnknownFeat.status})`);
  check(typeof badUnknownFeat.json?.error === 'string' && badUnknownFeat.json.error.includes('originFeat:'),
    `unknown-feat refusal names originFeat (got ${JSON.stringify(badUnknownFeat.json)})`);
  check(await characterCountByName('S3 Bad Feat') === 0, 'refused unknown feat created no row');

  const badTheme = await postCharacter({ name: 'S3 Bad Theme', race: 'human', creator: MARKER, theme_id: 'not-a-theme', origin_feat: 'alert' });
  check(badTheme.status === 400, `marker + unknown theme refused with 400 (got ${badTheme.status})`);
  check(typeof badTheme.json?.error === 'string' && badTheme.json.error.includes('themeId:'),
    `unknown-theme refusal names themeId (got ${JSON.stringify(badTheme.json)})`);
  check(await characterCountByName('S3 Bad Theme') === 0, 'refused unknown theme created no row');

  const badNoTheme = await postCharacter({ name: 'S3 Feat No Theme', race: 'human', creator: MARKER, origin_feat: 'alert' });
  check(badNoTheme.status === 400, `marker + feat without theme refused with 400 (got ${badNoTheme.status})`);
  check(typeof badNoTheme.json?.error === 'string' && badNoTheme.json.error.includes('originFeat:'),
    `feat-without-theme refusal names originFeat (got ${JSON.stringify(badNoTheme.json)})`);
  check(await characterCountByName('S3 Feat No Theme') === 0, 'refused feat-without-theme created no row');

  const badMI = await postCharacter({
    name: 'S3 Bad MI', race: 'human', creator: MARKER, theme_id: 'acolyte', origin_feat: 'magic_initiate',
    origin_feat_choices: { spell_list: 'Wizard', cantrips: ['Guidance', 'Sacred Flame'], level1_spell: 'Cure Wounds' },
  });
  check(badMI.status === 400, `marker + wrong MI list refused with 400 (got ${badMI.status})`);
  check(typeof badMI.json?.error === 'string' && badMI.json.error.includes('originFeatChoices:'),
    `wrong-list refusal names originFeatChoices (got ${JSON.stringify(badMI.json)})`);
  check(await characterCountByName('S3 Bad MI') === 0, 'refused wrong-list MI created no row');

  // Draft-tolerant over HTTP: theme alone, and theme + feat with no
  // choices yet, both pass.
  const themeOnly = await postCharacter({ name: 'S3 Theme Only', race: 'human', creator: MARKER, theme_id: 'acolyte' });
  check(themeOnly.status === 201, `marker + theme-only draft accepted with 201 (got ${themeOnly.status})`);
  const featNoChoices = await postCharacter({ name: 'S3 Feat No Choices', race: 'human', creator: MARKER, theme_id: 'sage', origin_feat: 'magic_initiate' });
  check(featNoChoices.status === 201, `marker + feat without choices yet accepted with 201 (got ${featNoChoices.status})`);

  // The gate: no marker, no Stage 3 validation (old-path behavior).
  const noMarker = await postCharacter({ name: 'S3 No Marker', race: 'human', theme_id: 'acolyte', origin_feat: 'tough' });
  check(noMarker.status === 201, `no marker + acolyte/Tough still accepted with 201 (got ${noMarker.status})`);

  // PUT refusal leaves the row alone.
  const putTarget = await postCharacter({ name: 'S3 Put Refusal', race: 'human', creator: MARKER, theme_id: 'soldier', origin_feat: 'savage_attacker' });
  check(putTarget.status === 201, `PUT-refusal fixture created (got ${putTarget.status})`);
  const badPut = await putCharacter(putTarget.json?.id, { creator: MARKER, theme_id: 'acolyte', origin_feat: 'tough' });
  check(badPut.status === 400, `PUT marker + acolyte/Tough refused with 400 (got ${badPut.status})`);
  check(typeof badPut.json?.error === 'string' && badPut.json.error.includes('originFeat:'),
    `PUT mismatch refusal names originFeat (got ${JSON.stringify(badPut.json)})`);
  const afterBadPut = await db.dbGet('SELECT feat_key FROM character_origin_feats WHERE character_id = ?', [putTarget.json?.id]);
  check(afterBadPut?.feat_key === 'savage_attacker',
    `refused PUT left the origin row unchanged (got ${afterBadPut?.feat_key})`);
}

// ===========================================================================
// (e) GET /api/themes — real HTTP, 21 themes, 404 on unknown id
// ===========================================================================
group('(e) /api/themes route — real HTTP');
{
  const all = await getThemes();
  check(all.status === 200, `GET /api/themes returns 200 (got ${all.status})`);
  check(Array.isArray(all.json?.themes), 'GET /api/themes returns a themes array');
  check(all.json?.themes?.length === 21, `GET /api/themes serves 21 themes (got ${all.json?.themes?.length})`);
  for (const t of (all.json?.themes || [])) {
    const expected = EXPECTED_THEMES[t.id];
    check(expected !== undefined, `served theme '${t.id}' is one of the 21 drafted themes`);
    if (!expected) continue;
    check(t.origin_feat === expected.feat, `served ${t.id} origin_feat is ${expected.feat} (got ${t.origin_feat})`);
    check(t.origin_feat_name === getFeatEffect(expected.feat)?.name, `served ${t.id} carries the feat name`);
    check(t.origin_feat_effect === ORIGIN_FEAT_EFFECTS[expected.feat], `served ${t.id} carries the feat effect`);
    try {
      assert.deepStrictEqual(t.ability_score_increase, expected.asi);
      check(true, `served ${t.id} carries the ASI`);
    } catch {
      check(false, `served ${t.id} carries the ASI (got ${JSON.stringify(t.ability_score_increase)})`);
    }
    check(typeof t.id === 'string' && typeof t.name === 'string' && typeof t.description === 'string',
      `served ${t.id} carries id/name/description`);
  }
  const sage = await getThemes('/sage');
  check(sage.status === 200, `GET /api/themes/sage returns 200 (got ${sage.status})`);
  check(sage.json?.theme?.origin_feat === 'magic_initiate' && sage.json?.theme?.origin_feat_spell_list === 'Wizard',
    `sage serves magic_initiate / Wizard (got ${sage.json?.theme?.origin_feat}/${sage.json?.theme?.origin_feat_spell_list})`);
  try {
    assert.deepStrictEqual(sage.json?.theme?.ability_score_increase, { int: 2, wis: 1 });
    check(true, 'sage serves the drafted ASI { int: 2, wis: 1 }');
  } catch {
    check(false, `sage serves the drafted ASI (got ${JSON.stringify(sage.json?.theme?.ability_score_increase)})`);
  }
  const cityWatch = await getThemes('/CITY_WATCH');
  check(cityWatch.status === 200, `GET /api/themes/CITY_WATCH returns 200 (case-insensitive, got ${cityWatch.status})`);
  check(cityWatch.json?.theme?.id === 'city_watch', 'CITY_WATCH resolves to city_watch');
  const unknown = await getThemes('/not-a-theme');
  check(unknown.status === 404, `GET /api/themes/not-a-theme returns 404 (got ${unknown.status})`);
  check(typeof unknown.json?.error === 'string' && unknown.json.error.includes('not-a-theme'),
    `404 names the unknown id (got ${JSON.stringify(unknown.json)})`);
}

// ===========================================================================
// (f) Subchoice pickers — real choiceOptions + real client spells data
// ===========================================================================
group('(f) subchoice pickers — sentinels resolve, MI options from spells.json');
{
  const stage3 = readRepo('client/src/components/creator-next/Stage3PastPath.jsx');
  check(stage3.includes("resolveChoiceOptions({ options: 'any_instrument' })"),
    'Stage 3 renders the Musician picker via the any_instrument sentinel');
  check(stage3.includes("resolveChoiceOptions({ options: 'any_skill_or_tool' })"),
    'Stage 3 renders the Skilled picker via the any_skill_or_tool sentinel');
  check(stage3.includes("resolveChoiceOptions({ options: 'any_artisan_tool' })"),
    'Stage 3 renders the Crafter picker via the any_artisan_tool sentinel');
  check(stage3.includes("featKey === 'magic_initiate'"), 'Stage 3 branches on the magic_initiate feat key');
  check(stage3.includes("featKey === 'musician'"), 'Stage 3 branches on the musician feat key');
  check(stage3.includes("featKey === 'skilled'"), 'Stage 3 branches on the skilled feat key');
  check(stage3.includes("featKey === 'crafter'"), 'Stage 3 branches on the crafter feat key');
  check(stage3.includes("origin_feat_spell_list"), 'Stage 3 reads the theme-fixed origin_feat_spell_list');
  check(stage3.includes('spellsData.cantrips'), 'Stage 3 reads cantrips from the client spells data');
  check(stage3.includes("spellsData.spells") && stage3.includes("'1st'"),
    'Stage 3 reads 1st-level spells from the client spells data');
  check(stage3.includes('already granted'), 'Stage 3 grays out held spells as "already granted"');
  check(!stage3.includes('Quick Build') && !stage3.includes('quickBuild'),
    'Stage 3 has no Quick Build (creator test-notes #9) — every sub-pick is player-made');

  // The real sentinel resolver (client module, imported live).
  const instruments = resolveChoiceOptions({ options: 'any_instrument' });
  check(Array.isArray(instruments) && instruments.length === 10,
    `any_instrument resolves to 10 instruments (got ${instruments?.length})`);
  check(instruments?.some((o) => o.value === 'Lute') && instruments?.some((o) => o.value === 'Bagpipes'),
    'any_instrument includes Lute and Bagpipes');
  const skillsOrTools = resolveChoiceOptions({ options: 'any_skill_or_tool' });
  check(Array.isArray(skillsOrTools) && skillsOrTools.length === 43,
    `any_skill_or_tool resolves to 43 options (18 skills + 25 tools, got ${skillsOrTools?.length})`);
  check(skillsOrTools?.some((o) => o.value === 'Perception') && skillsOrTools?.some((o) => o.value === 'Arcana'),
    'any_skill_or_tool includes skills (Perception, Arcana)');
  const artisanTools = resolveChoiceOptions({ options: 'any_artisan_tool' });
  check(Array.isArray(artisanTools) && artisanTools.length === 17,
    `any_artisan_tool resolves to 17 tools (got ${artisanTools?.length})`);
  check(isHeldOption('Sacred Flame', ['sacred flame']) === true, 'isHeldOption is case-insensitive');
  check(isHeldOption('Sacred Flame', ['Guidance']) === false, 'isHeldOption does not false-positive');

  // The client spells data, read as the picker reads it: cantrips keyed
  // by lowercase list name; 1st-level spells filtered by `classes`.
  const spellsData = JSON.parse(readRepo('client/src/data/spells.json'));
  for (const [list, cantripCount, spellCount, cantripSample, spellSample] of [
    ['cleric', 9, 15, 'Sacred Flame', 'Cure Wounds'],
    ['druid', 8, 16, 'Druidcraft', 'Cure Wounds'],
    ['wizard', 16, 28, 'Fire Bolt', 'Magic Missile'],
  ]) {
    const cantrips = (spellsData.cantrips?.[list] || []).map((s) => s?.name).filter(Boolean);
    check(cantrips.length === cantripCount,
      `${list} cantrip options: ${cantripCount} (got ${cantrips.length})`);
    check(cantrips.includes(cantripSample), `${list} cantrips include ${cantripSample}`);
    const display = list.charAt(0).toUpperCase() + list.slice(1);
    const level1 = (spellsData.spells?.['1st'] || [])
      .filter((s) => Array.isArray(s.classes) && s.classes.includes(list))
      .map((s) => s.name);
    check(level1.length === spellCount,
      `${list} 1st-level options: ${spellCount} (got ${level1.length})`);
    check(level1.includes(spellSample), `${list} 1st-level spells include ${spellSample}`);
    void display;
  }
  const clericCantrips = (spellsData.cantrips?.cleric || []).map((s) => s.name);
  check(!clericCantrips.includes('Acid Splash'), 'Acid Splash is not a Cleric cantrip option');
  check(!clericCantrips.includes('Fire Bolt'), 'Fire Bolt is not a Cleric cantrip option');
  const clericL1 = (spellsData.spells?.['1st'] || []).filter((s) => (s.classes || []).includes('cleric')).map((s) => s.name);
  check(!clericL1.includes('Magic Missile'), 'Magic Missile is not a Cleric 1st-level option');
}

// ===========================================================================
// (g) The three creation-sub-choice themes show conditional pickers
// ===========================================================================
group('(g) creation sub-choice themes — outlander / city_watch / knight');
{
  const subChoiceThemes = {
    outlander: { label: 'Chosen Biome', options: 9 },
    city_watch: { label: 'Home City', options: 10 },
    knight_of_the_order: { label: 'Order Type', options: 4 },
    // Round 2 (creator test-notes 2): Soldier rank (8) + Guild Artisan
    // trade (6) are static option lists. Folk Hero / Hermit carry NO
    // server options — creation_choice_source 'origin_regions' means
    // the client resolves options from the character's origin setting,
    // so the served list is null and the count below is 0 by design.
    soldier: { label: 'Military Rank', options: 8 },
    guild_artisan: { label: 'Guild Trade', options: 6 },
    folk_hero: { label: 'Home Region', options: 0 },
    hermit: { label: 'Region of Seclusion', options: 0 },
    urchin: { label: 'Home City', options: 10 },
  };
  for (const [id, expected] of Object.entries(subChoiceThemes)) {
    const entry = THEMES.find((t) => t.id === id);
    check(entry?.creation_choice_label === expected.label,
      `${id} creation_choice_label is '${expected.label}' (got ${entry?.creation_choice_label})`);
    check((entry?.creation_choice_options || []).length === expected.options,
      `${id} has ${expected.options} creation options (got ${(entry?.creation_choice_options || []).length})`);
    check((entry?.creation_choice_options || []).every((o) => o.label && (o.value ?? o.label)),
      `${id} creation options all carry a label/value`);
    const served = await getThemes(`/${id}`);
    check(served.status === 200 && served.json?.theme?.creation_choice_label === expected.label,
      `GET /api/themes/${id} serves the creation_choice_label`);
    check((served.json?.theme?.creation_choice_options || []).length === expected.options,
      `GET /api/themes/${id} serves ${expected.options} creation options`);
    // Feat/ASI attach to the theme, never the sub-choice (draft §0).
    check(served.json?.theme?.origin_feat === EXPECTED_THEMES[id].feat,
      `${id} served feat is still ${EXPECTED_THEMES[id].feat} regardless of sub-choice`);
  }
  const others = THEMES.filter((t) => !subChoiceThemes[t.id]);
  check(others.every((t) => !t.creation_choice_label && !(t.creation_choice_options || []).length),
    'the other 13 themes carry no creation sub-choice');
  const stage3 = readRepo('client/src/components/creator-next/Stage3PastPath.jsx');
  // R2-11(g): the label accessor is optional-chained and the picker
  // guard is the resolved locationOptions (origin regions when they
  // apply, else creationOptions) — same behavior, renamed render
  // variables. The pinned pre-R2-11g spellings are gone.
  // Creation-solidification (2026-11-12): the label + options resolve
  // in the shared themeLocation.js helper (also used by the shell's
  // stale-pick clear); Stage 3 renders what it returns.
  const themeLocation = readRepo('client/src/components/creator-next/themeLocation.js');
  check(stage3.includes('themeLocationOptions(theme, state)') && themeLocation.includes('theme?.creation_choice_label'),
    'Stage 3 renders the creation_choice_label (via themeLocationOptions)');
  check(themeLocation.includes('theme?.creation_choice_options'),
    'Stage 3 reads creation_choice_options (via themeLocationOptions)');
  check(stage3.includes('locationOptions.length > 0'), 'Stage 3 shows the sub-choice picker only when options exist');
  check(stage3.includes('stage3-path-choice'), 'Stage 3 sub-choice select has its own id');
}

// ===========================================================================
// (h) Stage 4 rename + shell wiring
// ===========================================================================
group('(h) Stage 4 rename + shell wiring');
{
  const shell = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');
  check(shell.includes("'Abilities, Skills, & Spells'"), "STAGE_LABELS[3] is 'Abilities, Skills, & Spells'");
  const labelLines = shell.split('\n').filter((l) => l.trim().startsWith("'") && l.includes('Abilities'));
  check(labelLines.length === 1 && labelLines[0].includes("'Abilities, Skills, & Spells'"),
    `exactly one Abilities stage label, the renamed one (got ${JSON.stringify(labelLines)})`);
  check(shell.includes('Stages 1–6 built'),
    'shell crumbs say Stages 1–6 built');
  check(shell.includes("fetch('/api/themes')"), 'shell fetches /api/themes on mount');
  check(shell.includes('Stage3PastPath'), 'shell renders Stage3PastPath');
  check(shell.includes('step === 2') && shell.includes('<Stage3PastPath'),
    'Stage 3 renders at step 2');
  check(shell.includes('if (step === 5)'), 'the step-5 advance is the commit, not a stub bounce');
  const persistence = readRepo('client/src/components/creator-next/stage1Persistence.js');
  check(persistence.includes('theme_id') && persistence.includes('origin_feat'),
    'stage1Persistence sends theme_id / origin_feat on save');
  check(persistence.includes('theme_path_choice'), 'stage1Persistence sends theme_path_choice on save');
  check(persistence.includes('origin_feat_choices'), 'stage1Persistence sends origin_feat_choices on save');
  check(persistence.includes("body.creator = 'creator-next'") || persistence.includes('creator-next'),
    'stage1Persistence still sends the creator-next marker');
  const stage3 = readRepo('client/src/components/creator-next/Stage3PastPath.jsx');
  check(stage3.includes('THEME ONLY') || stage3.includes('Theme-only') || stage3.includes('theme-only'),
    'Stage 3 is documented theme-only (no background picker)');
}

// ---------------------------------------------------------------------------
server.close();
console.log(`\n creator-next-stage3: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
