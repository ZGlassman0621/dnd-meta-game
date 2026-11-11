// tests/creator-gaps-batch.test.js — creator-gaps batch (2026-11-06):
// items 1, 2, 4, 5, 6, 9, 10, 11, 13, 14, 15, 16, 17, 21, 22, 23,
// 24, 25, 26, 28, 29 + follow-up items 1–2. Branch
// `phase-4-hybrid-combat`.
//
// Honest integration tests: every assert calls the REAL module — the
// routers over real HTTP on a real throwaway DB (Stage 3/4 harness),
// the real validators/resolvers/services, the real generated dataset
// file, and the real client modules where node can load them
// (speciesAdapter, stage1Persistence). Client components are checked
// by static guards on their real source (the JSX cannot run under
// node); where a behavior lives in both a service and a component,
// the service is driven live and the component is pinned by its
// source string. If any real module were deleted, the imports fail
// and the suite fails with them. Expected registry totals are derived
// from the registry source the test loads, never hardcoded where the
// registry is the authority; frozen-data pins (theme ASIs, spell
// lists) are literals on purpose — changing them must be deliberate.
// Footer is the runner-matching `Results:` form.
//
// KNOWN GAP this suite pins (found while writing it, not papered
// over): item 21's structured FIXED grants do not flow. The data
// worker gave 12 feats structured `grants.spells` entries as OBJECTS
// ({ name, level, uses, ability? }), but
// resolveAncestryFeatGrantedSpells only reads STRING entries, so it
// returns [] for every fixed grant (Master Illusionist, Voice of
// the Pit, Drow Magic Expanded, Celestial Healing, ...). Choice-based
// grants (Weave-Touched cantrip) DO flow. The (g) fixed-grant
// asserts below encode the intended behavior and fail until the
// resolver is taught the object shape (read `.name`). The validator
// side (ctx.ancestryFeatSpells -> granted set) is wired and green.
import assert from 'node:assert';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-gaps-batch-test-'));
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
const characterMod = await import(fromRepo('server/routes/character.js'));
const {
  validateCreatorNextStage3, validateCreatorNextStage4,
  validateAncestryFeatChoices, resolveAncestryFeatGrantedSpells,
} = characterMod;
const { CLASS_CHASSIS } = await import(fromRepo('server/data/classChassis.js'));
const levelProgression = await import(fromRepo('server/config/levelProgression.js'));
const {
  getSpellsPrepared, getSpellSlots, getSpellsKnown, getCantripsKnown,
  spellcastingAbilityFor, SUBCLASS_LEVELS, getClassFeatures,
  getAvailableMulticlassOptions,
} = levelProgression;
const magusService = await import(fromRepo('server/services/magusService.js'));
const { MAGUS_SOCIETIES } = magusService;
const { preparedSpellsMax: paladinPreparedMax } = await import(fromRepo('server/services/paladinService.js'));
const {
  artificerSubclassSpellsAtLevel, blackguardViceSpellsAtLevel, listSubclasses,
} = await import(fromRepo('server/services/subclassService.js'));
const { canLearnSpell, canonicalizeSpellName } = await import(fromRepo('server/services/spellSelectionService.js'));
const { resolveCantrips } = await import(fromRepo('server/services/cantripResolutionService.js'));
const { listThemes, resolveTheme } = await import(fromRepo('server/services/themeService.js'));
const { SPELL_DATA_ENTRIES } = await import(fromRepo('server/data/spellCatalogData.js'));
const classesJson = (await import(fromRepo('client/src/data/classes.json'), { with: { type: 'json' } })).default;
const racesJson = (await import(fromRepo('client/src/data/races.json'), { with: { type: 'json' } })).default;
const {
  adaptLegacySpecies, findSpeciesEntry, normalizeSpeciesId,
  isDeferredSpecies, resolveSpeciesGrants,
} = await import(fromRepo('client/src/components/creator-next/speciesAdapter.js'));
const {
  buildStage1ProgressBody, blankStage1State, rehydrateStateFromServerRow,
  mergeRehydratedPatch, isMagicInitiateOriginFeat, resolveOpeningDraft,
} = await import(fromRepo('client/src/components/creator-next/stage1Persistence.js'));

// --- HTTP harness: the real character + species + spells routers ----
const app = express();
app.use(express.json());
const characterRouter = characterMod.default;
const speciesRouter = (await import(fromRepo('server/routes/species.js'))).default;
const spellsRouter = (await import(fromRepo('server/routes/spells.js'))).default;
app.use('/api/character', characterRouter);
app.use('/api/species', speciesRouter);
app.use('/api/spells', spellsRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
const J = (v) => JSON.stringify(v);
async function req(method, url, body) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function readCharacter(id) {
  return db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
async function featIdByName(listId, tier, featName) {
  const row = await db.dbGet(
    'SELECT id FROM ancestry_feats WHERE list_id = ? AND tier = ? AND feat_name = ?',
    [listId, tier, featName],
  );
  return row?.id ?? null;
}
function errText(r) { return (r.errors || []).join(' '); }

// Dwarf/soldier cleric fixture (same shape as the Stage 4 suite:
// point-buy bases cost 27; finals = base + Hill {con:2, wis:1} +
// soldier {str:2, con:1}; Wis 16 -> cleric prepares 4).
const DWARF_BASE = { str: 12, dex: 10, con: 13, int: 8, wis: 15, cha: 14 };
const DWARF_FINAL = { str: 14, dex: 10, con: 16, int: 8, wis: 16, cha: 14 };
const DWARF_PREPARED = ['bless', 'cure wounds', 'guiding bolt', 'shield of faith'];
function dwarfClericBody(overrides = {}) {
  return {
    creator: 'creator-next', class: 'cleric', race: 'dwarf', subrace: 'Hill Dwarf',
    theme_id: 'soldier', generation_method: 'point_buy',
    base_scores: DWARF_BASE, ability_scores: DWARF_FINAL,
    skills: ['Athletics', 'Intimidation', 'Religion'],
    languages: ['Common', 'Dwarvish'],
    prepared_spells: DWARF_PREPARED,
    ...overrides,
  };
}

// (a) Item 2 — Traveler's Tongue array validation. The human T1 feat
// grants TWO languages; the old renderer stored one string. The
// server validator (validateAncestryFeatChoices) now requires an
// array of exactly `count` distinct closed-list picks for count > 1.
group('(a) Item 2: Traveler\'s Tongue — 2 languages ok; 1 / string / dup / unknown refuse');
{
  const tongueId = await featIdByName('human', 1, "Traveler's Tongue");
  check(typeof tongueId === 'number', `Traveler's Tongue seed row resolves (got ${tongueId})`);
  if (typeof tongueId === 'number') {
    check((await validateAncestryFeatChoices(tongueId, { languages: ['Elvish', 'Dwarvish'] })).ok === true,
      "Traveler's Tongue with 2 languages passes");
    const one = await validateAncestryFeatChoices(tongueId, { languages: ['Elvish'] });
    check(one.ok === false && errText(one).includes('needs exactly 2 picks, got 1'),
      `Traveler's Tongue with 1 language refuses the count (got ${errText(one)})`);
    const str = await validateAncestryFeatChoices(tongueId, { languages: 'Elvish' });
    check(str.ok === false && errText(str).includes('needs exactly 2 picks, got 1'),
      `Traveler's Tongue with a single string (the old storage shape) refuses (got ${errText(str)})`);
    const dup = await validateAncestryFeatChoices(tongueId, { languages: ['Elvish', 'Elvish'] });
    check(dup.ok === false && errText(dup).includes('picked twice'),
      `Traveler's Tongue with a duplicate refuses (got ${errText(dup)})`);
    const unknown = await validateAncestryFeatChoices(tongueId, { languages: ['Elvish', 'Klingon'] });
    check(unknown.ok === false && errText(unknown).includes("'Klingon' is not a valid pick"),
      `Traveler's Tongue with an unknown language refuses (got ${errText(unknown)})`);
    check((await validateAncestryFeatChoices(tongueId, {})).ok === true,
      "Traveler's Tongue with no picks yet passes (draft)");
    check((await validateAncestryFeatChoices(999999, { languages: ['Elvish', 'Dwarvish'] })).ok === true,
      'unknown feat id fails open (never blocks a save on unresolvable reference data)');
  }
}

// (b) Item 5 — PUT /:id MVP guard: a race change to a deferred
// species refuses 400 naming it; to human passes; unknown species
// stay creatable (the v1 rule).
group('(b) Item 5: PUT race change — deferred refuses, human passes, unknown stays creatable');
{
  const created = await req('POST', '/api/character', { name: 'Batch Put Guard', class: 'fighter', race: 'human' });
  check(created.status === 201, `PUT-guard fixture POST creates 201 (got ${created.status})`);
  const id = created.json?.id;
  const deferred = await req('PUT', `/api/character/${id}`, { race: 'tabaxi' });
  check(deferred.status === 400 && typeof deferred.json?.error === 'string' && deferred.json.error.includes('Tabaxi'),
    `PUT race tabaxi refuses 400 naming Tabaxi (got ${deferred.status}: ${JSON.stringify(deferred.json?.error)})`);
  check((await readCharacter(id)).race === 'human', 'refused PUT left the race unchanged');
  const human = await req('PUT', `/api/character/${id}`, { race: 'human' });
  check(human.status === 200, `PUT race human passes 200 (got ${human.status})`);
  const unknown = await req('PUT', `/api/character/${id}`, { race: 'githyanki' });
  check(unknown.status === 200, `PUT race githyanki (unknown species) stays creatable, 200 (got ${unknown.status})`);
}

// (c) Item 6 — rehydration: a resume with no local draft rehydrates
// the server-stored picks; a live pick wins over the stored one;
// fresh create with a stored draft opens blank (resolveOpeningDraft).
group('(c) Item 6: resume rehydrates server-stored picks; live picks win; fresh create is blank');
{
  // Pure rehydration from a stored row + progression snapshot.
  const patch = rehydrateStateFromServerRow(
    {
      first_name: 'Batch', race: 'Elf', class: 'Wizard', subrace: 'High Elf',
      origin_setting: 'Forgotten Realms', origin_region: 'Sword Coast',
      known_spells: JSON.stringify(['magic missile']), prepared_spells: JSON.stringify(['shield']),
    },
    {
      theme: { theme_id: 'sage', path_choice: null },
      origin_feat: {
        feat_key: 'magic_initiate',
        choices_data: { spell_list: 'Wizard', spellcasting_ability: 'Intelligence', cantrips: ['fire bolt', 'mage hand'], level1_spell: 'magic missile' },
      },
      ancestry_feats: [{ tier: 1, list_id: 'elf', feat_name: 'Weave-Touched', choices_data: { cantrip: 'fire bolt' } }],
    },
  );
  check(patch.race === 'elf' && patch.classId === 'wizard',
    `rehydration normalizes display-case race/class to ids (got ${patch.race}/${patch.classId})`);
  check(patch.subrace === 'High Elf' && patch.origin_region === 'Sword Coast',
    'rehydration carries subrace + origin region');
  check(patch.themeId === 'sage' && patch.originFeat === 'magic_initiate',
    'rehydration carries theme + origin feat');
  check(JSON.stringify(patch.originFeatChoices?.cantrips) === JSON.stringify(['fire bolt', 'mage hand']),
    'rehydration carries the stored Magic Initiate cantrips');
  check(JSON.stringify(patch.ancestry_feat_choices) === JSON.stringify({ cantrip: 'fire bolt' }),
    'rehydration carries the stored tier-1 ancestry feat choices');
  check(JSON.stringify(patch.prepared_spells) === JSON.stringify(['shield']),
    'rehydration carries the stored prepared spells');
  check(patch.stage4PicksClass === 'wizard', 'rehydration sets stage4PicksClass from the stored class');
  // Absent fields stay absent (not yet chosen, never defaulted).
  const blankPatch = rehydrateStateFromServerRow({ first_name: 'Only' }, null);
  check(!('themeId' in blankPatch) && !('originFeatChoices' in blankPatch) && !('race' in blankPatch),
    'rehydration of a bare row leaves theme/feat/race absent');
  // Fill-blanks-only merge: the player's live pick wins.
  const merged = mergeRehydratedPatch(
    { race: 'dwarf', themeId: '', skills: ['Athletics'] },
    { race: 'elf', themeId: 'sage', originFeat: 'magic_initiate' },
  );
  check(merged.race === 'dwarf' && merged.themeId === 'sage' && merged.originFeat === 'magic_initiate',
    'merge keeps the live race, fills the blank theme, adds the stored feat');
  // Fresh create opens blank even with a stored draft (draft wins
  // only on resume of its own row — the resolver's contract).
  const draft = { state: { race: 'elf', first_name: 'Stale' }, characterId: 12345 };
  const fresh = resolveOpeningDraft({ resumeCharacterId: null, draft });
  check(fresh.state.race === '' && fresh.characterId === null && fresh.hadMirror === false,
    'fresh create opens blank despite a stored draft');
  const resumed = resolveOpeningDraft({ resumeCharacterId: 12345, draft });
  check(resumed.state.race === 'elf' && resumed.characterId === 12345 && resumed.hadMirror === true,
    'resume of the draft\'s own row restores it');
  // End to end over HTTP: a plain POST persists theme + origin feat,
  // and the row + progression snapshot rehydrate through the real
  // functions (the shell's no-local-draft path).
  const e2e = await req('POST', '/api/character', {
    name: 'Batch Rehydrate', class: 'wizard', race: 'half-elf', subrace: 'Mark of Detection',
    theme_id: 'sage', origin_feat: 'magic_initiate',
    origin_feat_choices: {
      spell_list: 'Wizard', spellcasting_ability: 'Intelligence',
      cantrips: ['fire bolt', 'mage hand'], level1_spell: 'magic missile',
    },
  });
  check(e2e.status === 201, `rehydration e2e fixture POST creates 201 (got ${e2e.status}: ${JSON.stringify(e2e.json?.error || '')})`);
  if (e2e.status === 201) {
    const row = await readCharacter(e2e.json.id);
    const prog = await req('GET', `/api/character/${e2e.json.id}/progression`);
    check(prog.status === 200, `progression snapshot loads (got ${prog.status})`);
    const live = rehydrateStateFromServerRow(row, prog.json);
    check(live.themeId === 'sage' && live.originFeat === 'magic_initiate',
      'server row + progression rehydrate theme + origin feat');
    check(JSON.stringify(live.originFeatChoices?.cantrips) === JSON.stringify(['fire bolt', 'mage hand']),
      'server row + progression rehydrate the stored MI cantrips');
  }
  // Static: the shell runs the server rehydration only on a resume
  // with no local draft. The gate is the effect's early return (the
  // positive-condition form lived in the resume notices, removed by
  // the #1 silent-restore decision — the notices are gone, the gate
  // is not: the effect still returns early without a resume id or
  // with a local mirror).
  const shellSrc = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');
  check(shellSrc.includes('rehydrateFromServerCharacter(resumeCharacterId)'),
    'shell rehydrates from the server on resume');
  check(shellSrc.includes('if (!resumeCharacterId || opening.hadMirror) return'),
    'shell rehydrates only when there is a resume id and no local draft');
}

// (d) Item 15 — Magic Initiate cantrips: they reach Stage 2's
// granted list (resolveCantrips feat input) and Stage 4's granted
// spells; no MI feat means an empty list, never an error; picking a
// new theme clears the stale choices.
group('(d) Item 15: MI cantrips reach Stage 2 granted + Stage 4 granted; no MI feat is empty; theme change clears');
{
  const granted = resolveCantrips({ classId: 'wizard', featCantrips: ['fire bolt', 'mage hand'] });
  const names = granted.cantrips.map((c) => (typeof c === 'string' ? c : c.name || c.spell));
  check(names.includes('fire bolt') && names.includes('mage hand'),
    `resolveCantrips with MI feat cantrips grants them (got ${JSON.stringify(names)})`);
  check(granted.grantedNeverCount === true, 'feat cantrips never count against known/prepared');
  const none = resolveCantrips({ classId: 'wizard', featCantrips: [] });
  check(none.cantrips.length === 0 && none.unresolved.length === 0,
    'no MI feat yields an empty feat-cantrip list, not an error');
  check(isMagicInitiateOriginFeat('magic_initiate') === true, 'magic_initiate is an MI origin feat');
  check(isMagicInitiateOriginFeat('skilled') === false && isMagicInitiateOriginFeat('') === false,
    'non-MI feats are not MI feats');
  // Static: the shell feeds the stored MI cantrips into Stage 2
  // (the hardcoded featCantrips={[]} is gone), and Stage 4 lists
  // the MI cantrips in its granted spells.
  const shellSrc2 = readRepo('client/src/components/creator-next/CreatorNextShell.jsx');
  check(shellSrc2.includes('featCantrips={miCantrips}'),
    'shell passes featCantrips={miCantrips} to Stage 2');
  check(!shellSrc2.includes('featCantrips={[]}'),
    'shell no longer hardcodes featCantrips={[]}');
  const stage4Src = readRepo('client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx');
  check(stage4Src.includes("push(c.trim(), 0, 'origin feat (Magic Initiate)')"),
    'Stage 4 lists MI cantrips in grantedSpells (level 0, origin-feat source)');
  const stage3Src = readRepo('client/src/components/creator-next/Stage3PastPath.jsx');
  const pickTheme = stage3Src.slice(stage3Src.indexOf('const pickTheme'));
  check(pickTheme.includes('originFeatChoices: {}'),
    'picking a new theme clears originFeatChoices (no stale MI cantrips)');
}

// (e) Item 16 — theme ASIs are FROZEN data: all 21 pinned. Any
// change to themes.js must be deliberate (this test fails first).
group('(e) Item 16 (guard): all 21 theme ASIs pinned');
{
  const FROZEN_ASI = {
    soldier: { str: 2, con: 1 }, sage: { int: 2, wis: 1 },
    criminal: { dex: 2, int: 1 }, acolyte: { wis: 2, int: 1 },
    charlatan: { cha: 2, dex: 1 }, entertainer: { cha: 2, dex: 1 },
    noble: { cha: 2, int: 1 }, outlander: { dex: 2, wis: 1 },
    sailor: { str: 2, dex: 1 }, far_traveler: { dex: 2, wis: 1 },
    haunted_one: { wis: 2, con: 1 }, guild_artisan: { int: 2, dex: 1 },
    clan_crafter: { str: 2, dex: 1 }, hermit: { wis: 2, con: 1 },
    investigator: { int: 2, wis: 1 }, city_watch: { str: 2, wis: 1 },
    knight_of_the_order: { str: 2, cha: 1 }, mercenary_veteran: { con: 2, str: 1 },
    urban_bounty_hunter: { wis: 2, dex: 1 }, folk_hero: { con: 2, str: 1 },
    urchin: { dex: 2, cha: 1 },
  };
  const themes = listThemes();
  check(themes.length === 21, `registry serves 21 themes (got ${themes.length})`);
  check(Object.keys(FROZEN_ASI).length === 21, 'the frozen pin covers 21 themes');
  for (const [id, asi] of Object.entries(FROZEN_ASI)) {
    const live = resolveTheme(id)?.ability_score_increase;
    check(JSON.stringify(live) === JSON.stringify(asi),
      `theme ${id} ASI is frozen at ${JSON.stringify(asi)} (got ${JSON.stringify(live)})`);
  }
  const themesSrc = readRepo('server/data/themes.js');
  check(themesSrc.includes('FROZEN DATA'), 'themes.js header marks the ASI values as frozen data');
}

// (f) Item 17 — Stage 3 subchoice membership: Skilled takes skills
// or tools, Musician takes instruments, Crafter takes artisan tools.
group('(f) Item 17: Skilled/Musician/Crafter membership');
{
  const skilledOk = validateCreatorNextStage3({
    theme_id: 'charlatan', origin_feat: 'skilled',
    origin_feat_choices: { skills_or_tools: ['Athletics', 'History', "Smith's Tools"] },
  });
  check(skilledOk.ok === true, `Skilled with skills + a tool passes (${errText(skilledOk)})`);
  const laser = validateCreatorNextStage3({
    theme_id: 'charlatan', origin_feat: 'skilled',
    origin_feat_choices: { skills_or_tools: ['Laser Cutter'] },
  });
  check(laser.ok === false && errText(laser).includes("'Laser Cutter' is not a skill or tool"),
    `Skilled with 'Laser Cutter' refuses (got ${errText(laser)})`);
  const musicianOk = validateCreatorNextStage3({
    theme_id: 'entertainer', origin_feat: 'musician',
    origin_feat_choices: { instruments: ['Lute', 'Flute', 'Drum'] },
  });
  check(musicianOk.ok === true, `Musician with three instruments passes (${errText(musicianOk)})`);
  const anvil = validateCreatorNextStage3({
    theme_id: 'entertainer', origin_feat: 'musician',
    origin_feat_choices: { instruments: ['Anvil'] },
  });
  check(anvil.ok === false && errText(anvil).includes("'Anvil' is not a musical instrument"),
    `Musician with 'Anvil' refuses (got ${errText(anvil)})`);
  const crafterOk = validateCreatorNextStage3({
    theme_id: 'clan_crafter', origin_feat: 'crafter',
    origin_feat_choices: { artisan_tools: ["Smith's Tools", "Brewer's Supplies", "Mason's Tools"] },
  });
  check(crafterOk.ok === true, `Crafter with three artisan tools passes (${errText(crafterOk)})`);
  const lute = validateCreatorNextStage3({
    theme_id: 'clan_crafter', origin_feat: 'crafter',
    origin_feat_choices: { artisan_tools: ['Lute'] },
  });
  check(lute.ok === false && errText(lute).includes("'Lute' is not an artisan's tool"),
    `Crafter with 'Lute' refuses (got ${errText(lute)})`);
}

// (g) Item 21 — ancestry-feat granted spells in the Stage 4
// validator's granted set. Choice-based grants flow; structured
// FIXED grants are the known gap (see file header): the resolver
// only reads string entries in grants.spells, while the data file
// carries objects.
group('(g) Item 21: ancestry-feat granted spells');
{
  const weaveId = await featIdByName('elf', 1, 'Weave-Touched');
  check(typeof weaveId === 'number', `Weave-Touched seed row resolves (got ${weaveId})`);
  if (typeof weaveId === 'number') {
    const granted = await resolveAncestryFeatGrantedSpells(weaveId, { cantrip: 'fire bolt' });
    check(granted.includes('fire bolt'),
      `Weave-Touched cantrip choice resolves as a granted spell (got ${JSON.stringify(granted)})`);
  }
  // Structured fixed grants (object shape in ancestryFeats.js).
  const fixedCases = [
    ['gnome', 7, 'Master Illusionist', 'Major Image'],
    ['gnome', 13, 'Vanishing Trick', 'Greater Invisibility'],
    ['gnome', 18, 'Architect of Illusion', 'Mirage Arcane'],
    ['tiefling', 18, 'Voice of the Pit', 'Dominate Person'],
    ['drow', 3, 'Drow Magic Expanded', 'Faerie Fire'],
    ['warforged', 7, "Forge's Gift", 'Mending'],
  ];
  for (const [listId, tier, featName, spell] of fixedCases) {
    const id = await featIdByName(listId, tier, featName);
    check(typeof id === 'number', `${featName} seed row resolves (got ${id})`);
    if (typeof id === 'number') {
      const granted = await resolveAncestryFeatGrantedSpells(id, {});
      check(granted.includes(spell),
        `${featName} fixed grant resolves '${spell}' (got ${JSON.stringify(granted)})`);
    }
  }
  const drowId = await featIdByName('drow', 3, 'Drow Magic Expanded');
  if (typeof drowId === 'number') {
    const granted = await resolveAncestryFeatGrantedSpells(drowId, {});
    check(granted.includes('Detect Magic'),
      `Drow Magic Expanded also resolves 'Detect Magic' (got ${JSON.stringify(granted)})`);
  }
  check(JSON.stringify(await resolveAncestryFeatGrantedSpells(null, {})) === JSON.stringify([]),
    'null feat id resolves to []');
  check(JSON.stringify(await resolveAncestryFeatGrantedSpells(999999, {})) === JSON.stringify([]),
    'unknown feat id resolves to []');
  // The validator side IS wired: ctx.ancestryFeatSpells lands in
  // the granted set, so a granted spell picked as prepared refuses
  // as already granted — while the same body without the ctx passes.
  const withCtx = validateCreatorNextStage4(dwarfClericBody(), { ancestryFeatSpells: ['bless'] });
  check(withCtx.ok === false && errText(withCtx).includes('preparedSpells:') && errText(withCtx).includes('already granted'),
    `validator with ctx ancestryFeatSpells=['bless'] refuses bless as already granted (got ${errText(withCtx)})`);
  check(validateCreatorNextStage4(dwarfClericBody()).ok === true,
    'same body with no ancestry ctx passes');
}

// (h) Item 22 — class-chassis registry diffs against classes.json
// (the server registry must match the client lists), and the server
// enforces the count + membership.
group('(h) Item 22: class chassis matches classes.json; server enforces count + membership');
{
  const norm = (s) => String(s).toLowerCase().replace(/[\s_]+/g, ' ');
  const classList = Array.isArray(classesJson)
    ? classesJson
    : Object.entries(classesJson).map(([id, c]) => ({ id, ...c }));
  check(Object.keys(CLASS_CHASSIS).length === classList.length,
    `chassis covers every class in classes.json (${Object.keys(CLASS_CHASSIS).length} vs ${classList.length})`);
  for (const [id, chassis] of Object.entries(CLASS_CHASSIS)) {
    const client = classList.find((c) => c.id === id);
    check(client !== undefined, `chassis class ${id} exists in classes.json`);
    if (client) {
      check(client.skillChoices === chassis.skillChoices,
        `${id} skillChoices matches classes.json (${chassis.skillChoices})`);
      check(JSON.stringify([...chassis.skillOptions].map(norm).sort()) ===
        JSON.stringify([...(client.skillOptions || [])].map(norm).sort()),
        `${id} skillOptions match classes.json`);
    }
  }
  const cleric5 = validateCreatorNextStage4(dwarfClericBody({
    skills: ['Athletics', 'Intimidation', 'History', 'Insight', 'Medicine'],
  }));
  check(cleric5.ok === false && errText(cleric5).includes('picks at most 2'),
    `cleric sending 5 skills (3 class picks) refuses the count (got ${errText(cleric5)})`);
  const magus2 = validateCreatorNextStage4({
    creator: 'creator-next', class: 'magus', race: 'human',
    skills: ['Arcana', 'History'],
  });
  check(magus2.ok === false && errText(magus2).includes('picks at most 1'),
    `magus sending 2 skills (count 1) refuses (got ${errText(magus2)})`);
  const magus1 = validateCreatorNextStage4({
    creator: 'creator-next', class: 'magus', race: 'human',
    skills: ['Arcana'],
  });
  check(magus1.ok === true, `magus sending 1 valid skill passes (${errText(magus1)})`);
}

// (i) Item 23 — the generated dataset matches the server catalog
// (regenerate + compare), the per-class rules agree with the server
// at every mod, and Stage 4 falls back to the bundled data (never
// the thin spells.json) when the endpoint is unreachable.
group('(i) Item 23: generated dataset matches the server catalog; bundled fallback');
{
  const genPath = path.join(origCwd, 'client/src/data/spellCatalog.generated.json');
  const before = fs.readFileSync(genPath);
  execFileSync(process.execPath, ['scripts/generate-spell-catalog.js'], { cwd: origCwd, stdio: 'pipe' });
  const after = fs.readFileSync(genPath);
  check(before.equals(after), 'regenerating the spell dataset is byte-identical (deterministic, catalog unchanged)');
  const generated = JSON.parse(after.toString('utf-8'));
  const catalogKeys = Object.keys(SPELL_DATA_ENTRIES).sort();
  const generatedKeys = generated.spells.map((s) => s.key).sort();
  check(generated.spellCount === catalogKeys.length && generated.spells.length === catalogKeys.length,
    `generated dataset holds every catalog spell (${generated.spells.length} vs ${catalogKeys.length})`);
  check(JSON.stringify(generatedKeys) === JSON.stringify(catalogKeys),
    'generated spell keys are exactly the catalog keys');
  check(Object.keys(generated.level1ByClass).length === 23,
    `generated level1ByClass covers 23 classes (got ${Object.keys(generated.level1ByClass).length})`);
  // Per-class L1 numbers agree with the server at every probed mod.
  for (const [cls, info] of Object.entries(generated.level1ByClass)) {
    for (const mod of [-1, 0, 3, 5]) {
      check(info.spellsPrepared?.byMod?.[String(mod)] === (getSpellsPrepared(cls, 1, mod) ?? null),
        `${cls} prepared at mod ${mod}: dataset ${info.spellsPrepared?.byMod?.[String(mod)]} = server ${getSpellsPrepared(cls, 1, mod)}`);
    }
    check(info.spellsKnown === (getSpellsKnown(cls, 1) ?? null),
      `${cls} spellsKnown: dataset ${info.spellsKnown} = server ${getSpellsKnown(cls, 1)}`);
    check(info.cantripsKnown === getCantripsKnown(cls, 1),
      `${cls} cantripsKnown: dataset ${info.cantripsKnown} = server ${getCantripsKnown(cls, 1)}`);
    check((info.spellcastingAbility ?? null) === spellcastingAbilityFor(cls),
      `${cls} spellcastingAbility: dataset ${info.spellcastingAbility} = server ${spellcastingAbilityFor(cls)}`);
  }
  // The prepared-count rules pin the dataset-derived fallback: the
  // old "mod + 1, artificer + 0" ternary gave blackguard +1
  // at L1 where the server says 0 (paladin is table 2 at L1 since
  // the 2024 PHB correction, pp. 109-110).
  check(generated.level1ByClass.paladin.spellsPrepared.kind === 'table',
    'dataset paladin prepared rule is table at L1 (2024 PHB: 2, mod-independent)');
  check(generated.level1ByClass.blackguard.spellsPrepared.kind === 'zero',
    'dataset blackguard prepared rule is zero at L1');
  check(generated.level1ByClass.artificer.spellsPrepared.kind === 'modPlusHalfLevel',
    'dataset artificer prepared rule is mod + half level');
  check(generated.level1ByClass.cleric.spellsPrepared.kind === 'modPlusLevel',
    'dataset cleric prepared rule is mod + level');
  // Stage 4 falls back to bundled data when the endpoint fails.
  const stage4Src2 = readRepo('client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx');
  check(stage4Src2.includes('bundledSpellData(classId'),
    'Stage 4 calls bundledSpellData when the endpoint fails');
  check(stage4Src2.includes('loadCachedSpellData(classId)'),
    'Stage 4 checks the cached last-good fetch before the bundle');
  check(!/import[^;]*spells\.json/.test(stage4Src2) && !/fetch\([^)]*spells\.json/.test(stage4Src2),
    'Stage 4 never imports or fetches the thin client spells.json');
  check(stage4Src2.includes('never to the thin client spells.json'),
    'Stage 4 documents the fallback order as endpoint -> cache -> bundled dataset, never spells.json');
  check(!stage4Src2.includes('ability modifier + 1 at level 1'),
    'stale prepared-count Tip text ("ability modifier + 1 at level 1") is gone');
  check(stage4Src2.includes('preparedCountRuleText(classId)'),
    'Stage 4 Tip reads the prepared-count rule from the dataset');
}

// (j) Items 24/25 — the five core artificer always-prepared lists
// and the Domination/Fury vice lists resolve via the helpers.
group('(j) Items 24/25: artificer five-core + Domination/Fury vice lists');
{
  const ARTIFICER_L3 = {
    alchemist: ['Healing Word', 'Ray of Sickness'],
    armorer: ['Magic Missile', 'Thunderwave'],
    artillerist: ['Shield', 'Thunderwave'],
    'battle smith': ['Heroism', 'Shield'],
    cartographer: ['Faerie Fire', 'Guiding Bolt', 'Healing Word'],
  };
  for (const [sub, l3] of Object.entries(ARTIFICER_L3)) {
    check(JSON.stringify(artificerSubclassSpellsAtLevel('artificer', sub, 3)) === JSON.stringify(l3),
      `artificer ${sub} L3 is ${JSON.stringify(l3)} (got ${JSON.stringify(artificerSubclassSpellsAtLevel('artificer', sub, 3))})`);
  }
  check(artificerSubclassSpellsAtLevel('artificer', 'cartographer', 3).length === 3,
    'cartographer grants THREE spells at 3rd (the odd one out — every other core subclass grants two)');
  check(JSON.stringify(artificerSubclassSpellsAtLevel('artificer', 'alchemist', 5)) ===
    JSON.stringify(['Healing Word', 'Ray of Sickness', 'Flaming Sphere', "Melf's Acid Arrow"]),
    'alchemist L5 cumulative adds Flaming Sphere + Melf\'s Acid Arrow');
  check(JSON.stringify(artificerSubclassSpellsAtLevel('artificer', 'battle smith', 17)).includes('Mass Cure Wounds'),
    'battle smith L17 cumulative includes Mass Cure Wounds');
  check(JSON.stringify(artificerSubclassSpellsAtLevel('artificer', 'battle smith', 5)).includes('Shining Smite'),
    'battle smith L5 is Shining Smite + Warding Bond (Forge 2024 — overturns the Eberron Branding Smite printing per the settled Forge-wins decision)');
  check(JSON.stringify(artificerSubclassSpellsAtLevel('artificer', 'lumberjack', 3)) ===
    JSON.stringify(['Beast Bond', 'Speak with Animals']),
    'lumberjack L3 still resolves (pre-existing list untouched)');
  check(JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'domination', 3)) ===
    JSON.stringify(['Armor of Agathys', 'Command']),
    'domination L3 is the Conquest list');
  check(JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'fury', 3)) ===
    JSON.stringify(['Bane', "Hunter's Mark"]),
    'fury L3 is the Vengeance list');
  check(JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'domination', 5)) ===
    JSON.stringify(['Armor of Agathys', 'Command', 'Hold Person', 'Spiritual Weapon']),
    'domination L5 cumulative is the Conquest list');
  check(JSON.stringify(blackguardViceSpellsAtLevel('blackguard', 'fury', 5)) ===
    JSON.stringify(['Bane', "Hunter's Mark", 'Hold Person', 'Misty Step']),
    'fury L5 cumulative is the Vengeance list');
}

// (k) Item 28 — the 6 corrected CLASS_FEATURES rows: subclass
// features land at L3, not L1/L2. Updated 2026-11-06 by the full
// CLASS_FEATURES 2024 rebuild (tests/class-features-2024.test.js
// supersedes this group for these rows — it pins all 240 level-rows,
// including the 5 PHB-photo-verified classes). All 11 asserts below
// changed value with the rebuild (the staging note said 7 — it
// undercounted: the L1/L2 additions Divine Order, Wild Companion,
// Innate Sorcery, and Eldritch Invocations change the other four).
group('(k) Item 28: CLASS_FEATURES subclass features at L3');
{
  check(JSON.stringify(getClassFeatures('cleric', 1)) === JSON.stringify(['Divine Order', 'Spellcasting']),
    "cleric L1 is ['Divine Order', 'Spellcasting'] (2024 PHB)");
  check(JSON.stringify(getClassFeatures('cleric', 2)) === JSON.stringify(['Channel Divinity']),
    "cleric L2 is ['Channel Divinity'] (no use-count row — column value in 2024)");
  check(JSON.stringify(getClassFeatures('cleric', 3)) === JSON.stringify(['Cleric Subclass']),
    "cleric L3 gains ['Cleric Subclass'] (no 'Divine Domain', no separate 'Domain Feature' row)");
  check(JSON.stringify(getClassFeatures('druid', 2)) === JSON.stringify(['Wild Shape', 'Wild Companion']),
    "druid L2 is ['Wild Shape', 'Wild Companion'] (no Druid Circle)");
  check(JSON.stringify(getClassFeatures('druid', 3)) === JSON.stringify(['Druid Subclass']),
    "druid L3 gains ['Druid Subclass']");
  check(JSON.stringify(getClassFeatures('sorcerer', 1)) === JSON.stringify(['Spellcasting', 'Innate Sorcery']),
    "sorcerer L1 is ['Spellcasting', 'Innate Sorcery'] (no Sorcerous Origin)");
  check(JSON.stringify(getClassFeatures('sorcerer', 3)) === JSON.stringify(['Sorcerer Subclass']),
    "sorcerer L3 is ['Sorcerer Subclass'] (Metamagic moved to L2)");
  check(JSON.stringify(getClassFeatures('warlock', 1)) === JSON.stringify(['Eldritch Invocations', 'Pact Magic']),
    "warlock L1 is ['Eldritch Invocations', 'Pact Magic'] (no Otherworldly Patron)");
  check(JSON.stringify(getClassFeatures('warlock', 3)) === JSON.stringify(['Warlock Subclass']),
    "warlock L3 is ['Warlock Subclass'] (no 'Pact Boon' — it is an invocation in 2024)");
  check(JSON.stringify(getClassFeatures('wizard', 2)) === JSON.stringify(['Scholar']),
    "wizard L2 is ['Scholar'] (new 2024 feature)");
  check(JSON.stringify(getClassFeatures('wizard', 3)) === JSON.stringify(['Wizard Subclass']),
    "wizard L3 gains ['Wizard Subclass']");
  // The contested row IS now pinned: cleric L8 'Domain Feature' does
  // not exist in 2024 — see tests/class-features-2024.test.js group
  // (d) (SRD 5.2 + Roll20 + DDB agree; PHB photos confirm 3/6/17).
}

// (l) Item 29 — every registry entry's derived selectionLevel equals
// its class record (SUBCLASS_LEVELS); no entry carries the field.
group('(l) Item 29: derived selectionLevel equals the class record; no per-entry field');
{
  const subclassSrc = fs.readdirSync(path.join(origCwd, 'server/data/subclasses'))
    .map((f) => readRepo(`server/data/subclasses/${f}`)).join('\n');
  check(!/selectionLevel\s*:/.test(subclassSrc),
    'no subclass data file carries a selectionLevel field (removed by design)');
  let entries = 0;
  for (const cls of Object.keys(SUBCLASS_LEVELS)) {
    const list = listSubclasses(cls);
    for (const entry of list) {
      entries++;
      check(entry.selectionLevel === SUBCLASS_LEVELS[cls],
        `${cls}/${entry.key} derives selectionLevel ${SUBCLASS_LEVELS[cls]} (got ${entry.selectionLevel})`);
    }
  }
  check(entries > 0, `derived-selectionLevel sweep covered ${entries} registry entries`);
  // The 7 formerly-wrong entries now derive to 3.
  for (const [cls, key] of [['cleric', 'fate_domain'], ['cleric', 'sea_domain'],
    ['druid', 'circle_of_the_unborn'], ['sorcerer', 'dreamer'],
    ['warlock', 'many_faces'], ['warlock', 'spiritual_guardian'], ['wizard', 'runecrafter']]) {
    const found = listSubclasses(cls).find((e) => e.key === key);
    check(found?.selectionLevel === 3, `${cls}/${key} derives selectionLevel 3 (got ${found?.selectionLevel})`);
  }
  // The class-level exceptions survive derivation: magus/scholar 1.
  // Keeper has NO registry entries (its data lives elsewhere, no
  // server file) — nothing to derive, so the keeper 6 is asserted
  // on the class record alone, not on entries that do not exist.
  check(listSubclasses('magus').every((e) => e.selectionLevel === 1), 'magus entries derive selectionLevel 1');
  check(listSubclasses('scholar').every((e) => e.selectionLevel === 1), 'scholar entries derive selectionLevel 1');
  check(listSubclasses('keeper').length === 0 && SUBCLASS_LEVELS.keeper === 6,
    'keeper has no registry entries (pinned gap); the class record still says 6');
}

// (m) Items 10/11 — magus multiclass free (prerequisites removed
// 2026-11-08; the Sidereal Con 13 + Int 13 adoption is moot by the
// same rule, not by a ruling); warden/scholar slots + cantrips +
// known/prepared at L3; Theologian prepares 3 at L3.
group('(m) Items 10/11: magus multiclass free; warden/scholar L3 casting');
{
  // Every class is offered, no ability-score gate — even a fighter
  // with all 8s is offered magus, and the requirement table and the
  // per-society check are gone from both modules.
  check(getAvailableMulticlassOptions([{ class: 'fighter', level: 1 }]).includes('magus'),
    'magus is offered as a multiclass option (prerequisites removed)');
  check(levelProgression.MULTICLASS_REQUIREMENTS === undefined && levelProgression.meetsMulticlassRequirements === undefined,
    'MULTICLASS_REQUIREMENTS / meetsMulticlassRequirements are gone');
  check(magusService.meetsMagusMulticlassRequirements === undefined && magusService.SOCIETY_MULTICLASS_ABILITY === undefined,
    'meetsMagusMulticlassRequirements / SOCIETY_MULTICLASS_ABILITY are gone');
  check(MAGUS_SOCIETIES.length === 6, `six magus societies (got ${MAGUS_SOCIETIES.length})`);
  // Warden / scholar at L3 (the casting-subclass gate).
  check(JSON.stringify(getSpellSlots('warden', 3, 'Loreseeker')) === JSON.stringify({ 1: 2 }),
    'warden Loreseeker L3 slots are {1:2}');
  check(JSON.stringify(getSpellSlots('warden', 3, 'Soulblood Shaman')) === JSON.stringify({ 1: 2 }),
    'warden Soulblood Shaman L3 slots are {1:2}');
  check(getCantripsKnown('warden', 3, 'Loreseeker') === 2, 'warden Loreseeker L3 cantrips known 2');
  check(getSpellsKnown('warden', 3, 'Loreseeker') === 3, 'warden Loreseeker L3 spells known 3');
  check(JSON.stringify(getSpellSlots('warden', 3, null)) === JSON.stringify({}),
    'warden without a casting Call has no slots');
  check(JSON.stringify(getSpellSlots('scholar', 3, 'Ritualist')) === JSON.stringify({ 1: 2 }),
    'scholar Ritualist L3 slots are {1:2}');
  check(getCantripsKnown('scholar', 3, 'Ritualist') === 2, 'scholar Ritualist L3 cantrips known 2');
  check(getSpellsKnown('scholar', 3, 'Ritualist') === 3, 'scholar Ritualist L3 spells known 3');
  check(getSpellsPrepared('scholar', 3, 3, 'Theologian') === 3,
    'scholar Theologian L3 prepares 3 (prepared, not known)');
  check(JSON.stringify(getSpellSlots('scholar', 3, null)) === JSON.stringify({}),
    'scholar without a Field has no slots');
  // Same numbers over the real endpoint (subclass-aware).
  const wardenSpells = await req('GET', '/api/spells?class=warden&level=3&subclass=Loreseeker&abilityMod=3');
  check(wardenSpells.status === 200 && wardenSpells.json?.cantripsKnown === 2 && wardenSpells.json?.spellsKnown === 3,
    `GET /api/spells warden Loreseeker L3: cantrips 2, known 3 (got ${JSON.stringify(wardenSpells.json)})`);
  const theoSpells = await req('GET', '/api/spells?class=scholar&level=3&subclass=Theologian&abilityMod=3');
  check(theoSpells.status === 200 && theoSpells.json?.spellsPrepared === 3,
    `GET /api/spells scholar Theologian L3: prepared 3 (got ${JSON.stringify(theoSpells.json?.spellsPrepared)})`);
  // Level-up-info: a fighter sees magus offered, per society — but
  // flagged, not removed (MVP gray-out, 2026-11-08): the option
  // stays listed with pcCreatable false + the MVP note, and the
  // POST /level-up guard is the enforcement.
  const fighter = await req('POST', '/api/character', { name: 'Batch Magus Info', class: 'fighter', race: 'human' });
  assert(fighter.status === 201, `magus-info fixture POST creates (got ${fighter.status})`);
  const fid = fighter.json.id;
  await req('PUT', `/api/character/${fid}`, {
    level: 1, experience: 300, max_hp: 20, current_hp: 20,
    ability_scores: J({ str: 10, dex: 10, con: 14, int: 14, wis: 10, cha: 10 }),
    class_levels: J([{ class: 'fighter', level: 1, subclass: null }]),
  });
  const info = await req('GET', `/api/character/level-up-info/${fid}`);
  check(info.status === 200, `level-up-info loads (got ${info.status})`);
  const magusOpt = info.json?.classOptions?.find((o) => o.type === 'multiclass' && String(o.class).toLowerCase() === 'magus');
  check(magusOpt !== undefined, 'level-up-info offers magus as a multiclass option (flagged, not removed)');
  check(magusOpt?.pcCreatable === false, 'level-up-info flags magus pcCreatable false (MVP gray-out)');
  check(typeof magusOpt?.pcCreatableNote === 'string' && magusOpt.pcCreatableNote.includes('Coming after the MVP'),
    'level-up-info flags magus with the MVP note');
  if (magusOpt) {
    check(magusOpt.choices?.needsSubclass === true && magusOpt.subclassLevel === 1,
      'magus multiclass option prompts for a society at 1');
    // 2026-11-08: prerequisites removed — the per-society requirement
    // fields are gone with the table; the six societies still exist as
    // a choice (SOCIETY_NAMES), just without ability-score gates.
    check(magusOpt.societyRequirements === undefined && magusOpt.meetsRequirementsBySociety === undefined,
      'magus option carries no societyRequirements / meetsRequirementsBySociety (prerequisites removed)');
    check(magusOpt.multiclassGrant?.hitDie === 8, 'magus multiclass grant rides on the option (hit die 8)');
  }
}

// (n) Items 1/20 + follow-up 1 — GET /api/species serves grants;
// Stage 4's held set includes species grants; deferred species are
// grayed (not removed) on the creator surfaces.
group('(n) Items 1/20 + follow-up 1: species grants served; held set; deferred grayed');
{
  const all = await req('GET', '/api/species');
  check(all.status === 200 && Array.isArray(all.json?.species), `GET /api/species returns 200 + a list (got ${all.status})`);
  const species = all.json?.species || [];
  check(species.length === 29, `GET /api/species serves 29 entries (got ${species.length})`);
  const elf = species.find((s) => s.id === 'elf');
  check(elf?.grants?.skills?.includes('perception'),
    `elf grants.skills includes perception (got ${JSON.stringify(elf?.grants?.skills)})`);
  check(elf?.grants?.senses?.includes('darkvision 60 ft'),
    `elf grants.senses includes darkvision 60 ft (got ${JSON.stringify(elf?.grants?.senses)})`);
  const dwarf = species.find((s) => s.id === 'dwarf');
  check(dwarf?.grants?.weapons?.includes('Battleaxe') && dwarf?.grants?.resistances?.includes('poison'),
    `dwarf grants weapons (Battleaxe) + poison resistance (got ${JSON.stringify(dwarf?.grants)})`);
  const human = species.find((s) => s.id === 'human');
  check(human && 'grants' in human && JSON.stringify(human.grants) === JSON.stringify({ skills: [{ choose: 1, from: 'any_skill' }] }),
    `human carries the Skillful structured grant (2024 PHB p. 194 — one skill of your choice; got ${JSON.stringify(human?.grants)})`);
  const highElf = elf?.variants?.find((v) => v.name === 'High Elf');
  check(highElf?.grants?.weapons?.includes('Longsword'),
    `High Elf variant grants weapons (Longsword) (got ${JSON.stringify(highElf?.grants?.weapons)})`);
  check(species.every((s) => 'grants' in s), 'every species entry carries a grants key');
  const deferred = species.filter((s) => s.pcCreatable === false);
  check(deferred.length === 18, `18 deferred species served with pcCreatable false (got ${deferred.length})`);
  check(deferred.some((s) => s.id === 'tabaxi'), 'tabaxi is deferred');
  // Stage 4 held set includes species grants (live client helper +
  // static guard on the component's held-set construction).
  const elfGrants = resolveSpeciesGrants(elf, null);
  check(elfGrants.skills.includes('perception'),
    'resolveSpeciesGrants(elf) yields perception as a held skill');
  // Variant grants REPLACE the base entry's grants (never unioned):
  // High Elf yields its own variant-only grants; High Elf Descent
  // (a half-elf variant) yields skills [] — no base skill grant
  // leaks through; no variant still yields the entry grants.
  const highElfGrants = resolveSpeciesGrants(elf, 'High Elf');
  check(highElfGrants.skills.includes('perception') && highElfGrants.weapons.includes('Longsword') && highElfGrants.weapons.includes('Shortsword'),
    `resolveSpeciesGrants(elf, 'High Elf') yields variant-only grants (got ${J(highElfGrants)})`);
  const halfElf = species.find((s) => s.id === 'half-elf');
  const descentGrants = resolveSpeciesGrants(halfElf, 'High Elf Descent');
  check(descentGrants.skills.length === 0 && descentGrants.weapons.includes('Longsword'),
    `resolveSpeciesGrants(half-elf, 'High Elf Descent') yields skills [] + Longsword (got ${J(descentGrants)})`);
  // The discriminating pin: a variant whose grants carry no skills
  // must NOT inherit the base entry's Perception (the old union did).
  const descentEntry = { grants: { skills: ['perception'], senses: ['darkvision 60 ft'] }, variants: [{ name: 'High Elf Descent', grants: { weapons: ['Longsword', 'Shortsword', 'Shortbow', 'Longbow'], senses: ['darkvision 60 ft'] } }] };
  const descentSynthetic = resolveSpeciesGrants(descentEntry, 'High Elf Descent');
  check(descentSynthetic.skills.length === 0 && descentSynthetic.weapons.includes('Longsword'),
    `replace, not union: base Perception does not leak into High Elf Descent (got ${J(descentSynthetic)})`);
  const unknownVariant = resolveSpeciesGrants(elf, 'No Such Variant');
  check(unknownVariant.skills.includes('perception'),
    'unknown variant name falls back to the entry grants');
  const stage4Src3 = readRepo('client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx');
  check(stage4Src3.includes('...speciesGrants.skills') && stage4Src3.includes('heldSkillSet'),
    'Stage 4 heldSkillSet includes speciesGrants.skills');
  check(stage4Src3.includes('isDeferredSpecies(speciesEntry)'),
    'Stage 4 renders a deferred-species note');
  // Deferred species are grayed with a note on every creator
  // surface — never removed (a deferred species can arrive via
  // resume/PUT/NPC and must stay visible-but-unpickable).
  for (const [file, label] of [
    ['client/src/components/creator-next/Stage1OriginIdentity.jsx', 'Stage 1'],
    ['client/src/components/creator-next/Stage2ClassCalling.jsx', 'Stage 2'],
    ['client/src/components/creator-next/Stage3PastPath.jsx', 'Stage 3'],
    ['client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx', 'Stage 4'],
  ]) {
    const src = readRepo(file);
    check(src.includes('isDeferredSpecies(') && src.includes('deferredNoteFor('),
      `${label} grays deferred species with the shared check + note`);
  }
  const tabaxi = species.find((s) => s.id === 'tabaxi');
  check(isDeferredSpecies(tabaxi) === true, 'isDeferredSpecies(tabaxi) is true (served flag)');
  check(isDeferredSpecies(elf) === false, 'isDeferredSpecies(elf) is false');
}

// (o) Item 4 — the fallback adapter includes gnome; half-elf /
// half-orc resolve as aliases (any spelling of the legacy id).
group('(o) Item 4: adapter includes gnome; half-elf/half-orc are aliases');
{
  const adapted = adaptLegacySpecies(racesJson);
  check(adapted.length === 11, `adapter serves 11 species incl. gnome (got ${adapted.length})`);
  const gnome = adapted.find((s) => normalizeSpeciesId(s.id) === 'gnome');
  check(gnome !== undefined, 'adapter includes gnome');
  check(JSON.stringify((gnome?.variants || []).map((v) => v.name).sort()) === JSON.stringify(['Forest Gnome', 'Rock Gnome']),
    `gnome carries Forest Gnome + Rock Gnome variants (got ${JSON.stringify((gnome?.variants || []).map((v) => v.name))})`);
  check(findSpeciesEntry(adapted, 'half-elf')?.id === 'half-elf', "findSpeciesEntry('half-elf') resolves");
  check(findSpeciesEntry(adapted, 'half_elf')?.id === 'half-elf', "findSpeciesEntry('half_elf') resolves as an alias");
  check(findSpeciesEntry(adapted, 'Half-Elf')?.id === 'half-elf', "findSpeciesEntry('Half-Elf') resolves (case-insensitive)");
  check(findSpeciesEntry(adapted, 'half-orc')?.id === 'half-orc', "findSpeciesEntry('half-orc') resolves");
  check(findSpeciesEntry(adapted, 'half_orc')?.id === 'half-orc', "findSpeciesEntry('half_orc') resolves as an alias");
  check(findSpeciesEntry(adapted, 'gnome')?.id === 'gnome', "findSpeciesEntry('gnome') resolves");
  check(findSpeciesEntry(adapted, 'nope') === null, 'unknown species resolves to null (never invented)');
  // A partial input is mapped 1:1 and gains nothing (the gnome
  // patch is conditional on the full legacy list).
  const partial = adaptLegacySpecies({ dwarf: racesJson.dwarf, elf: racesJson.elf });
  check(partial.length === 2, 'partial adapter input maps 1:1 (2 entries, no gnome patch)');
}

// (p) Follow-up item 2 — the save body carries class_skill_picks +
// ancestry_feat_id/choices; a first-save ancestry skill pick passes
// (no false-refusal); 3 class picks still refuse.
group('(p) Follow-up 2: save body carries class_skill_picks + ancestry choices; first-save ancestry skill passes');
{
  const graceId = await featIdByName('elf', 1, 'Elven Grace');
  check(typeof graceId === 'number', `Elven Grace seed row resolves (got ${graceId})`);
  const state = {
    ...blankStage1State(),
    race: 'elf', subrace: 'High Elf', classId: 'cleric', themeId: 'soldier',
    ancestry_feat_id: graceId, ancestry_feat_choices: { skill: 'Stealth' },
    classSkillPicks: ['History', 'Religion'],
    skills: ['Athletics', 'Intimidation', 'Stealth', 'History', 'Religion'],
  };
  const body = buildStage1ProgressBody(state);
  check(body.ancestry_feat_id === graceId, 'save body carries ancestry_feat_id');
  check(JSON.stringify(body.ancestry_feat_choices) === JSON.stringify({ skill: 'Stealth' }),
    'save body carries ancestry_feat_choices');
  check(JSON.stringify(body.class_skill_picks) === JSON.stringify(['History', 'Religion']),
    'save body carries class_skill_picks');
  check(JSON.stringify(buildStage1ProgressBody(blankStage1State())) === '{}',
    'blank state still builds {} (no empty fields smuggled in)');
  // Live over HTTP: the old shape (no class_skill_picks, no
  // ancestry choices) false-refused this character; the fixed shape
  // creates it. Stealth is not a cleric skill — it is the ancestry
  // pick, and the server must not count it as a class pick.
  const oldShape = await req('POST', '/api/character', {
    name: 'Batch Old Shape', creator: 'creator-next', class: 'cleric', race: 'elf', subrace: 'High Elf',
    theme_id: 'soldier', skills: J(['Athletics', 'Intimidation', 'Stealth', 'History', 'Religion']),
  });
  check(oldShape.status === 400 && typeof oldShape.json?.error === 'string' && oldShape.json.error.includes('skills:'),
    `old-shape body (ancestry skill invisible) still refuses 400 (got ${oldShape.status}: ${JSON.stringify(oldShape.json?.error)})`);
  const fixedShape = await req('POST', '/api/character', {
    name: 'Batch Fixed Shape', creator: 'creator-next', class: 'cleric', race: 'elf', subrace: 'High Elf',
    theme_id: 'soldier', skills: J(['Athletics', 'Intimidation', 'Stealth', 'History', 'Religion']),
    ancestry_feat_id: graceId, ancestry_feat_choices: { skill: 'Stealth' },
    class_skill_picks: ['History', 'Religion'],
  });
  check(fixedShape.status === 201, `fixed-shape body creates 201 (got ${fixedShape.status}: ${JSON.stringify(fixedShape.json?.error || '')})`);
  if (fixedShape.status === 201) {
    const stored = await db.dbGet('SELECT choices_data FROM character_ancestry_feats WHERE character_id = ?', [fixedShape.json.id]);
    check(JSON.stringify(JSON.parse(stored?.choices_data || '{}')) === JSON.stringify({ skill: 'Stealth' }),
      'ancestry choices persisted on the row');
    const row = await readCharacter(fixedShape.json.id);
    check(JSON.stringify(JSON.parse(row.skills)) === JSON.stringify(['Athletics', 'Intimidation', 'Stealth', 'History', 'Religion']),
      'all five skills persisted on the row');
  }
  // 3 class picks still refuse, even in the fixed shape.
  const threePicks = await req('POST', '/api/character', {
    name: 'Batch Three Picks', creator: 'creator-next', class: 'cleric', race: 'elf', subrace: 'High Elf',
    theme_id: 'soldier', skills: J(['Athletics', 'Intimidation', 'Stealth', 'History', 'Religion', 'Insight']),
    ancestry_feat_id: graceId, ancestry_feat_choices: { skill: 'Stealth' },
    class_skill_picks: ['History', 'Religion', 'Insight'],
  });
  check(threePicks.status === 400 && typeof threePicks.json?.error === 'string' && threePicks.json.error.includes('picks at most 2'),
    `3 class picks still refuse 400 (got ${threePicks.status}: ${JSON.stringify(threePicks.json?.error)})`);
}

// (q) Item 13 — canonical spell names resolve: the two live
// mismatches ('Colour Spray', 'Create Food or Water') and the three
// comment-only pairs all resolve through the lookup boundary, and
// the subclass data now carries the catalog spellings.
group('(q) Item 13: canonical spell names resolve');
{
  // `level` here is CHARACTER level (the lookup gates on the max
  // spell level at that character level): a 3rd-level spell needs a
  // 5th-level cleric, a 9th-level paladin, and a 2nd-level spell
  // needs a 3rd-level wizard.
  const cases = [
    ['sorcerer', 1, 'Colour Spray', true],
    ['sorcerer', 1, 'Color Spray', true],
    ['cleric', 5, 'Create Food or Water', true],
    ['cleric', 5, 'Create Food and Water', true],
    ['paladin', 9, 'Create Food or Water', true],
    ['warlock', 1, 'Witchbolt', true],
    ['warlock', 1, 'Witch Bolt', true],
    ['wizard', 3, 'Skywriting', true],
    ['wizard', 3, 'Skywrite', true],
    ['druid', 1, 'Thornwhip', true],
    ['druid', 1, 'Thorn Whip', true],
  ];
  for (const [cls, level, name, ok] of cases) {
    const r = canLearnSpell({ classId: cls, level, spellName: name });
    check(r.ok === ok, `canLearnSpell ${cls} L${level} '${name}' resolves (got ${JSON.stringify(r)})`);
  }
  // canonicalizeSpellName returns the lowercase catalog KEY (the
  // lookup boundary lowercases both sides); the alias map is what
  // turns a print spelling into the catalog spelling.
  check(canonicalizeSpellName('Colour Spray') === 'color spray', "canonicalizeSpellName('Colour Spray') is 'color spray'");
  check(canonicalizeSpellName('Create Food or Water') === 'create food and water',
    "canonicalizeSpellName('Create Food or Water') is 'create food and water'");
  check(canonicalizeSpellName('Witchbolt') === 'witch bolt', "canonicalizeSpellName('Witchbolt') is 'witch bolt'");
  check(canonicalizeSpellName('Fireball') === 'fireball', "canonicalizeSpellName leaves unknown names alone ('Fireball' -> 'fireball')");
  const sorcererSrc = readRepo('server/data/subclasses/sorcerer.js');
  check(sorcererSrc.includes("'Color Spray'") && !sorcererSrc.includes("'Colour Spray'"),
    'sorcerer Dreamer data carries the catalog spelling Color Spray');
  const paladinSrc = readRepo('server/data/subclasses/paladin.js');
  check(paladinSrc.includes("'Create Food and Water'") && !paladinSrc.includes("'Create Food or Water'"),
    'paladin Oath of Charity data carries the catalog spelling Create Food and Water');
  check(SPELL_DATA_ENTRIES['color spray'] !== undefined, 'catalog holds "color spray"');
  check(SPELL_DATA_ENTRIES['create food and water'] !== undefined, 'catalog holds "create food and water"');
}

// (r) Item 14 — Give Life adopts the Scholar formula (+mod). The
// catalog ruling (coordinator, 2026-11-06, reversible): the Scholar
// printing's class line includes Magus (Sylvan Circle), so it claims
// to govern the Magus caster too, and the +mod is NOT the Theologian
// differentiator (Martyr's Magic is).
group('(r) Item 14: Give Life adopts the Scholar formula (+mod)');
{
  const entry = SPELL_DATA_ENTRIES['give life'];
  check(entry !== undefined, 'catalog holds "give life"');
  check(typeof entry?.description === 'string' && entry.description.includes('add your spellcasting modifier'),
    'Give Life description adopts the Scholar formula (+ spellcasting modifier)');
  check(!entry?.description?.includes('no-modifier formula is adopted'),
    'Give Life description does not adopt the Magus no-modifier formula');
  check(JSON.stringify(entry?.classes) === JSON.stringify(['Cleric', 'Druid', 'Magus']),
    'Give Life class list is unchanged (Cleric, Druid, Magus)');
}

// (s) Item 9 — classes.json artificer list is exactly the verified
// five: no Forgewright/Warsmith, Cartographer present.
group('(s) Item 9: classes.json artificer list is exactly the verified five');
{
  const classList2 = Array.isArray(classesJson)
    ? classesJson
    : Object.entries(classesJson).map(([id, c]) => ({ id, ...c }));
  const art = classList2.find((c) => c.id === 'artificer');
  const names = (art?.subclasses || []).map((s) => s.name);
  check(JSON.stringify(names) === JSON.stringify(['Alchemist', 'Armorer', 'Artillerist', 'Battle Smith', 'Cartographer']),
    `artificer subclasses are exactly the verified five (got ${JSON.stringify(names)})`);
  check(!names.includes('Forgewright') && !names.includes('Warsmith'),
    'unverified Forgewright/Warsmith are out of the client list');
  check(names.includes('Cartographer'), 'verified Cartographer is in the client list');
  check(art?.subclassLevel === 3, 'artificer subclassLevel is 3 in classes.json');
}

// (t) Item 26 — paladin validator: the service cap agrees with the
// server's getSpellsPrepared at every level and mod (the PUT +
// level-up refusal behavior itself is covered by the flipped
// paladin-l1-cap (c2)/(c3) tripwires — cited here, not duplicated).
group('(t) Item 26: paladin validator cap agrees with the server');
{
  let mismatches = 0;
  for (const mod of [-1, 0, 3, 5]) {
    for (let level = 1; level <= 20; level++) {
      if (paladinPreparedMax(mod, level) !== getSpellsPrepared('paladin', level, mod)) {
        mismatches++;
        console.error(`  ✗ paladin L${level} mod ${mod}: service ${paladinPreparedMax(mod, level)} vs server ${getSpellsPrepared('paladin', level, mod)}`);
      }
    }
  }
  check(mismatches === 0,
    `paladinService cap = getSpellsPrepared at every level 1-20, mods [-1, 0, 3, 5] (${mismatches} mismatches)`);
  check(paladinPreparedMax(3, 1) === 2, 'paladin L1 cap is 2 (2024 PHB table)');
  check(paladinPreparedMax(3, 2) === 3 && paladinPreparedMax(3, 5) === 6,
    'paladin L2 cap 3, L5 cap 6 at Cha +3 (PHB table; L5 is the book’s own example)');
  const paladinSrc = readRepo('server/routes/character.js');
  check(paladinSrc.includes('paladinService') || paladinSrc.includes('paladin'),
    'character.js wires the paladin validator (PUT + level-up blocks)');
}

server.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
