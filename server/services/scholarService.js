// Scholar class service — base class + Fields of Study progression (digest-only).
//
// Source: ~/workspace/dnd-app-review/new-classes-staging/digests/scholar.md
// (Sterling Vermin Adventuring Co. 2016-2019, 2014-era; NO conversion applied).
// Build ONLY what the digest contains; UNRESOLVED items stay unresolved.
//
// Artificer-shaped, with one deliberate deviation forced by this mirror:
// server/database.js, server/utils/safeParse.js, server/services/markerPipeline.js
// and server/services/conditionService.js are ABSENT from /tmp/sp/repo, so this
// module has ZERO static imports. Pure functions are directly importable and
// testable here; load/save helpers take an optional injected db client
// ({ dbGet, dbRun }) or dynamic-import '../database.js' on the live Mac and
// degrade gracefully (default state / false) when it is unavailable; marker
// handlers register through the exported registerScholarMarkers(registerHandler,
// deps) instead of at import. The coordinator wires those two seams on the live
// Mac — the handler semantics are identical to Artificer's.
//
// State lives in class_resources_json.scholar (migration 091 column, both tables),
// parsed with its OWN full parse — never parseClassResources, which strips every
// top-level key except used/raging/bardicHeld (SURVEY §2). Maxima are computed,
// never stored, so a level-up cannot strand a stale max.
//
// Spell lists are ANOTHER agent's file (planned server/data/newClassSpellLists.js):
// Ritualist (any-list, ritual-tagged) and Theologian (cleric list) spell NAMES are
// referenced, never duplicated here. Only counts, slots, and slot/cantrip tables
// live here.

const clampLevel = (level) => Math.min(20, Math.max(1, Math.trunc(level) || 1));
const clampMod = (mod) => Math.trunc(mod) || 0;

// --- Progression tables (digest-verified) ---------------------------------------

export const ERUDITE_APPLICATIONS_KNOWN =
  [0, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8];

export function eruditeApplicationsKnownForLevel(level) {
  return ERUDITE_APPLICATIONS_KNOWN[clampLevel(level) - 1];
}

// 29 Erudite Applications, with the field prerequisite as printed (null = any field).
// Names only here — full mechanics live in the digest and the DM prompt; this list
// is the learnable-option registry the service validates against.
export const ERUDITE_APPLICATIONS = [
  { key: 'academic_expertise', name: 'Academic Expertise', field: null },
  { key: 'adventurous_appetizers', name: 'Adventurous Appetizers', field: 'Culinarian' },
  { key: 'applied_intelligence', name: 'Applied Intelligence', field: null },
  { key: 'alert_to_danger', name: 'Alert to Danger', field: 'Tactician' },
  { key: 'beast_whisperer', name: 'Beast Whisperer', field: 'Ritualist' },
  { key: 'bonus_cantrips', name: 'Bonus Cantrips', field: 'Ritualist' },
  { key: 'bonus_languages', name: 'Bonus Languages', field: null },
  { key: 'bonus_proficiencies', name: 'Bonus Proficiencies', field: null },
  { key: 'clean_plate_practice', name: 'Clean Plate Practice', field: 'Culinarian' },
  { key: 'collectors_capacity', name: "Collector's Capacity", field: 'Culinarian' },
  { key: 'counterattacker', name: 'Counterattacker', field: 'Tactician' },
  { key: 'critical_analysis', name: 'Critical Analysis', field: null },
  { key: 'cunning_linguist', name: 'Cunning Linguist', field: 'Diplomat' },
  { key: 'diehard', name: 'Diehard', field: 'Tactician' },
  { key: 'eldritch_lore', name: 'Eldritch Lore', field: 'Ritualist' },
  { key: 'expertise', name: 'Expertise', field: null },
  { key: 'first_aid', name: 'First Aid', field: 'Physician' },
  { key: 'heal_thyself', name: 'Heal Thyself', field: 'Physician' },
  { key: 'herbal_cleanse', name: 'Herbal Cleanse', field: 'Physician' },
  { key: 'intellect_fortress', name: 'Intellect Fortress', field: null },
  { key: 'jack_of_all_trades', name: 'Jack of All Trades', field: 'Diplomat' },
  { key: 'libra', name: 'Libra', field: null },
  { key: 'martyrs_magic', name: "Martyr's Magic", field: 'Theologian' },
  { key: 'seal_agreement', name: 'Seal Agreement', field: 'Diplomat' },
  { key: 'signs_of_the_supernatural', name: 'Signs of the Supernatural', field: 'Theologian' },
  { key: 'studied_defense', name: 'Studied Defense', field: null },
  { key: 'tool_expert', name: 'Tool Expert', field: null },
  { key: 'verbum_dei', name: 'Verbum Dei', field: 'Theologian' },
  { key: 'well_educated', name: 'Well Educated', field: null },
];

export const FIELDS_OF_STUDY = ['Culinarian', 'Diplomat', 'Physician', 'Ritualist', 'Tactician', 'Theologian'];
export const SPELLCASTING_FIELDS = ['Ritualist', 'Theologian'];

// Sage Advice uses = Intelligence modifier (min 1) per long rest; from 5th
// (Sagacious Font) all expended uses return on a short OR long rest.
export function sageAdviceUsesMax(intMod) {
  return Math.max(1, clampMod(intMod));
}

// Analyze Enemy bonus damage on the first hit each turn vs the analyzed creature:
// none before 5th, 1d10 at 5th, 2d10 at 11th, 3d10 at 17th.
export function analyzeEnemyBonusDamage(level) {
  const l = clampLevel(level);
  if (l >= 17) return '3d10';
  if (l >= 11) return '2d10';
  if (l >= 5) return '1d10';
  return '0';
}

// Physician points = scholar level, regained on a long rest.
export function physicianPointsMax(level) {
  return clampLevel(level);
}

// Brilliant Mind (10th): reroll a failed Int/Wis/Cha save, 1/short-or-long rest.
// Flash of Genius (18th): reaction to treat a die result as 20, reusable after a
// long rest (1/long rest).
export function brilliantMindUsesMax(level) {
  return clampLevel(level) >= 10 ? 1 : 0;
}
export function flashOfGeniusUsesMax(level) {
  return clampLevel(level) >= 18 ? 1 : 0;
}

// Subclass spell slots (Ritualist + Theologian share the table; casting starts 3rd).
export const SCHOLAR_SUBCLASS_SPELL_SLOTS = {
  1: {}, 2: {},
  3: { 1: 2 }, 4: { 1: 2 }, 5: { 1: 2 }, 6: { 1: 2 },
  7: { 1: 4, 2: 2 }, 8: { 1: 4, 2: 2 }, 9: { 1: 4, 2: 2 },
  10: { 1: 4, 2: 3 }, 11: { 1: 4, 2: 3 }, 12: { 1: 4, 2: 3 },
  13: { 1: 4, 2: 3, 3: 2 }, 14: { 1: 4, 2: 3, 3: 2 }, 15: { 1: 4, 2: 3, 3: 2 },
  16: { 1: 4, 2: 3, 3: 3 }, 17: { 1: 4, 2: 3, 3: 3 }, 18: { 1: 4, 2: 3, 3: 3 },
  19: { 1: 4, 2: 3, 3: 3, 4: 1 }, 20: { 1: 4, 2: 3, 3: 3, 4: 1 },
};

export function spellSlotsForSubclassLevel(field, level) {
  if (!SPELLCASTING_FIELDS.includes(field)) return {};
  return { ...(SCHOLAR_SUBCLASS_SPELL_SLOTS[clampLevel(level)] || {}) };
}

export function cantripsKnownForSubclass(field, level) {
  if (!SPELLCASTING_FIELDS.includes(field)) return 0;
  const l = clampLevel(level);
  if (l < 3) return 0;
  return l >= 9 ? 3 : 2;
}

// Spells known (Ritualist) / prepared (Theologian): the digest gives ENDPOINTS
// ONLY (3 at 3rd, 13 at 20th). Intermediate levels return null = UNKNOWN, never a
// guessed number. Theologian is wired as PREPARED (digest UNRESOLVED 2: text says
// "Spells Prepared", table column reads "Spells Known" — text wins, flagged).
export function spellsKnownOrPreparedForSubclass(field, level) {
  if (!SPELLCASTING_FIELDS.includes(field)) return 0;
  const l = clampLevel(level);
  if (l < 3) return 0;
  if (l === 3) return 3;
  if (l === 20) return 13;
  return null;
}

// --- State ----------------------------------------------------------------------

export function defaultScholarState() {
  return {
    field: null,
    sageAdviceUsesLeft: 0,
    sageAdviceUsesMax: 0,
    applicationsKnown: [],
    esotericApplications: [],
    physicianPointsLeft: 0,
    brilliantMindUsed: false,
    flashOfGeniusUsed: false,
    quickStudySkill: null,
  };
}
function clone(state) {
  return JSON.parse(JSON.stringify(state || defaultScholarState()));
}

export function learnApplication(state, level, applicationKey, opts = {}) {
  const s = clone(state);
  const entry = ERUDITE_APPLICATIONS.find((a) => a.key === applicationKey);
  if (!entry) return { state: s, success: false, reason: 'application_not_found' };
  if (s.applicationsKnown.includes(applicationKey)) {
    return { state: s, success: false, reason: 'application_already_known' };
  }
  if (entry.field && s.field && entry.field !== s.field && !opts.ignorePrerequisite) {
    return { state: s, success: false, reason: 'field_prerequisite_not_met', field: entry.field };
  }
  if (s.applicationsKnown.length >= eruditeApplicationsKnownForLevel(level)) {
    return { state: s, success: false, reason: 'applications_known_cap' };
  }
  s.applicationsKnown.push(applicationKey);
  if (opts.ignorePrerequisite) s.esotericApplications.push(applicationKey);
  return { state: s, success: true, application: applicationKey };
}

export function useSageAdvice(state, intMod) {
  const s = clone(state);
  const max = sageAdviceUsesMax(intMod);
  if (!s.sageAdviceUsesMax) { s.sageAdviceUsesMax = max; s.sageAdviceUsesLeft = max; }
  if (s.sageAdviceUsesLeft > max) s.sageAdviceUsesLeft = max;
  if (s.sageAdviceUsesLeft <= 0) return { state: s, success: false, reason: 'no_uses_left' };
  s.sageAdviceUsesLeft -= 1;
  return { state: s, success: true, usesLeft: s.sageAdviceUsesLeft };
}

export function spendPhysicianPoint(state, level) {
  const s = clone(state);
  if (!s.physicianPointsLeft) s.physicianPointsLeft = physicianPointsMax(level);
  if (s.physicianPointsLeft <= 0) return { state: s, success: false, reason: 'no_points_left' };
  s.physicianPointsLeft -= 1;
  return { state: s, success: true, pointsLeft: s.physicianPointsLeft };
}

export function useBrilliantMind(state, level) {
  const s = clone(state);
  if (clampLevel(level) < 10) return { state: s, success: false, reason: 'level_too_low' };
  if (s.brilliantMindUsed) return { state: s, success: false, reason: 'already_used_this_rest' };
  s.brilliantMindUsed = true;
  return { state: s, success: true };
}

export function useFlashOfGenius(state, level) {
  const s = clone(state);
  if (clampLevel(level) < 18) return { state: s, success: false, reason: 'level_too_low' };
  if (s.flashOfGeniusUsed) return { state: s, success: false, reason: 'already_used_this_rest' };
  s.flashOfGeniusUsed = true;
  return { state: s, success: true };
}

// --- Rests ----------------------------------------------------------------------

export function onLongRest(state, { level, intMod }) {
  const s = clone(state);
  const max = sageAdviceUsesMax(intMod);
  s.sageAdviceUsesMax = max; s.sageAdviceUsesLeft = max;
  s.physicianPointsLeft = physicianPointsMax(level);
  s.brilliantMindUsed = false;
  s.flashOfGeniusUsed = false;
  return { state: s, success: true };
}

export function onShortRest(state, { level, intMod }) {
  const s = clone(state);
  // Sagacious Font (5th): regain ALL expended Sage Advice uses on a short rest.
  // Brilliant Mind (10th) also refreshes on a short rest. Physician points and
  // Flash of Genius do NOT refresh on a short rest (long rest only, as printed).
  if (clampLevel(level) >= 5) {
    const max = sageAdviceUsesMax(intMod);
    s.sageAdviceUsesMax = max; s.sageAdviceUsesLeft = max;
  }
  if (clampLevel(level) >= 10) s.brilliantMindUsed = false;
  return { state: s, success: true };
}

// --- DM prompt section ----------------------------------------------------------

export function scholarPromptSection(state, { level, intMod, name }) {
  const s = state || defaultScholarState();
  const max = s.sageAdviceUsesMax || sageAdviceUsesMax(intMod);
  const left = s.sageAdviceUsesMax ? s.sageAdviceUsesLeft : max;
  const lines = [`Scholar (level ${level}, Int mod ${intMod}${s.field ? `, Field: ${s.field}` : ''}):`];
  lines.push(`- Sage Advice uses left: ${left}/${max} (reaction: add proficiency bonus to a check/attack/save within 60 ft, decided after the roll, before success is declared)`);
  lines.push(`- Erudite Applications known (${s.applicationsKnown.length}/${eruditeApplicationsKnownForLevel(level)}): ${s.applicationsKnown.join(', ') || 'none'}`);
  lines.push(`- Analyze Enemy bonus damage: ${analyzeEnemyBonusDamage(level)} (first hit each turn vs analyzed creature, from 5th)`);
  if (s.field === 'Physician') lines.push(`- Physician points left: ${s.physicianPointsLeft}/${physicianPointsMax(level)} (regain all on long rest)`);
  if (SPELLCASTING_FIELDS.includes(s.field)) {
    lines.push(`- ${s.field} spellcasting (Int): slots ${JSON.stringify(spellSlotsForSubclassLevel(s.field, level))}; cantrips known ${cantripsKnownForSubclass(s.field, level)}; spells ${s.field === 'Theologian' ? 'prepared' : 'known'} ${spellsKnownOrPreparedForSubclass(s.field, level) ?? 'UNRESOLVED (intermediate count not in digest — read PDF table before merge)'}`);
    lines.push(`- Spell NAMES live in newClassSpellLists.js (another agent's file) — never duplicated here.`);
  }
  if (clampLevel(level) >= 10) lines.push(`- Brilliant Mind: ${s.brilliantMindUsed ? 'used' : 'available'} (reroll a failed Int/Wis/Cha save, 1/short-or-long rest)`);
  if (clampLevel(level) >= 18) lines.push(`- Flash of Genius: ${s.flashOfGeniusUsed ? 'used' : 'available'} (reaction: treat a die result as 20, 1/long rest)`);
  if (name) lines.unshift(`Scholar: ${name}`);
  return lines.join('\n');
}

// --- Multiclass grant (as printed: light armor + one class skill) -----------------
export const MULTICLASS_GRANT = {
  hitDie: 6,
  armor: ['light'],
  skillChoices: 1,
  skillOptions: ['Animal Handling', 'Arcana', 'History', 'Insight', 'Investigation',
    'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Survival'],
};

// --- DB helpers (own full parse; never parseClassResources) ----------------------
function tableFor(kind) {
  return kind === 'companion' ? 'companions' : 'characters';
}
function parseAllResources(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
async function resolveDb(dbClient) {
  if (dbClient && dbClient.dbGet && dbClient.dbRun) return dbClient;
  try {
    const db = await import('../database.js');
    return { dbGet: db.dbGet, dbRun: db.dbRun };
  } catch {
    return null;
  }
}
export async function loadScholarState(kind, id, dbClient) {
  try {
    const db = await resolveDb(dbClient);
    if (!db) return defaultScholarState();
    const row = await db.dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
    if (!row) return defaultScholarState();
    const resources = parseAllResources(row.class_resources_json);
    return resources.scholar ? { ...defaultScholarState(), ...resources.scholar } : defaultScholarState();
  } catch {
    return defaultScholarState();
  }
}
export async function saveScholarState(kind, id, scholarState, dbClient) {
  const db = await resolveDb(dbClient);
  if (!db) return false;
  const row = await db.dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
  const resources = parseAllResources(row ? row.class_resources_json : null);
  resources.scholar = scholarState;
  await db.dbRun(`UPDATE ${tableFor(kind)} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(resources), id]);
  return true;
}

// --- Marker handlers -------------------------------------------------------------
// Registered by the coordinator via registerScholarMarkers(registerHandler, deps)
// because markerPipeline.js is absent from this mirror (see header). deps:
// { resolveActor(context, targetRaw) -> actor|null, loadState, saveState } —
// resolveActor/loadState/saveState default to the DB helpers above when omitted
// and a live database.js is importable; in this mirror they degrade to null/false.
export function registerScholarMarkers(registerHandler, deps = {}) {
  const load = deps.loadState || loadScholarState;
  const save = deps.saveState || saveScholarState;
  const resolveActor = deps.resolveActor || null;
  async function withScholar(parsed, context, type, fn) {
    if (!context?.characterId || !resolveActor) return null;
    try {
      const actor = await resolveActor(context, parsed?.Target);
      if (!actor) return { type, success: false, reason: 'unknown target' };
      if (String(actor.className || '').toLowerCase() !== 'scholar') {
        return { type, success: false, reason: `${actor.name} is not a scholar` };
      }
      const state = await load(actor.kind, actor.id);
      const res = await fn(state, actor);
      if (res && res.success) await save(actor.kind, actor.id, res.state);
      if (!res) return null;
      const { state: _saved, ...out } = res;
      return { type, actor: actor.name, ...out };
    } catch (e) {
      console.error('[scholarService] marker handler failed:', e.message);
      return null;
    }
  }
  registerHandler('SCHOLAR_SAGE_ADVICE', async (parsed, context) =>
    withScholar(parsed, context, 'scholar_sage_advice', (s, a) => useSageAdvice(s, a.intMod)));
  registerHandler('SCHOLAR_PHYSICIAN_POINT', async (parsed, context) =>
    withScholar(parsed, context, 'scholar_physician_point', (s, a) => spendPhysicianPoint(s, a.level)));
  registerHandler('SCHOLAR_BRILLIANT_MIND', async (parsed, context) =>
    withScholar(parsed, context, 'scholar_brilliant_mind', (s, a) => useBrilliantMind(s, a.level)));
  registerHandler('SCHOLAR_FLASH_OF_GENIUS', async (parsed, context) =>
    withScholar(parsed, context, 'scholar_flash_of_genius', (s, a) => useFlashOfGenius(s, a.level)));
}

export default {
  ERUDITE_APPLICATIONS_KNOWN, eruditeApplicationsKnownForLevel, ERUDITE_APPLICATIONS,
  FIELDS_OF_STUDY, SPELLCASTING_FIELDS, sageAdviceUsesMax, analyzeEnemyBonusDamage,
  physicianPointsMax, brilliantMindUsesMax, flashOfGeniusUsesMax,
  SCHOLAR_SUBCLASS_SPELL_SLOTS, spellSlotsForSubclassLevel, cantripsKnownForSubclass,
  spellsKnownOrPreparedForSubclass, defaultScholarState, learnApplication, useSageAdvice,
  spendPhysicianPoint, useBrilliantMind, useFlashOfGenius, onLongRest, onShortRest,
  scholarPromptSection, MULTICLASS_GRANT, loadScholarState, saveScholarState,
  registerScholarMarkers,
};
