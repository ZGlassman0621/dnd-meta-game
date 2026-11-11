// Duelist class service — base class + Dueling Archetypes progression (Overview-only).
//
// Source: ~/workspace/dnd-app-review/new-classes-staging/digests/duelist.md
// (GM Binder "Duelist Class Overview", Fan Content; NO author/date/edition printed).
// Build ONLY what the Overview states; its gaps stay gaps (see PARTIAL COVERAGE
// below) — nothing is filled from general D&D knowledge.
//
// Artificer-shaped, with one deliberate deviation forced by this mirror:
// server/database.js, server/utils/safeParse.js, server/services/markerPipeline.js
// and server/services/conditionService.js are ABSENT from /tmp/sp/repo, so this
// module has ZERO static imports. Pure functions are directly importable and
// testable here; load/save helpers take an optional injected db client or
// dynamic-import '../database.js' on the live Mac and degrade gracefully when it
// is unavailable; marker handlers register through registerDuelistMarkers.
// The coordinator wires those seams on the live Mac.
//
// State lives in class_resources_json.duelist (migration 091 column, both tables),
// parsed with its OWN full parse — never parseClassResources, which strips every
// top-level key except used/raging/bardicHeld (SURVEY §2). Maxima are computed,
// never stored.
//
// PARTIAL COVERAGE (digest "Missing from this Overview"): NO multiclass rules,
// NO expanded archetype text beyond the feature blocks, NO feats/variants/optional
// rules, NO NPC/DM guidance. No MULTICLASS_GRANT is exported (the source gives
// none). (2026-11-08: multiclass prerequisites removed — there is no
// requirements table for duelist to be missing from anymore.)

const clampLevel = (level) => Math.min(20, Math.max(1, Math.trunc(level) || 1));

export const DUELING_ARCHETYPES = ['Blade', 'Mask', 'Acrobat'];

export const FIGHTING_STYLES = ['Defense', 'Dueling', 'Protection', 'Two-weapon Fighting'];

export const CRITICAL_STRIKE_OPTIONS = [
  'Bleeding Strike', 'Blinding Strike', 'Stunning Strike', 'Menacing Strike', 'Sweeping Strike',
];

// Martial Advantage dice count by level: 2 (1st-4th), 3 (5th-9th), 4 (10th-14th),
// 5 (15th-19th), 6 (20th). PER-TURN, NOT EXPENDED — there is no pool to spend.
export const MARTIAL_ADVANTAGE_DICE_COUNT =
  [2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6];

export function martialAdvantageDiceForLevel(level) {
  return MARTIAL_ADVANTAGE_DICE_COUNT[clampLevel(level) - 1];
}
export function martialAdvantageDiceString(level) {
  return `${martialAdvantageDiceForLevel(level)}d6`;
}

// Determined uses per long rest: 1 at 7th, 2 at 11th, 3 at 15th, 4 at 18th; 0 before 7th.
export const DETERMINED_USES =
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4];

export function determinedUsesMaxForLevel(level) {
  return DETERMINED_USES[clampLevel(level) - 1];
}

// Critical Strikes known: pick 2 at 5th, +1 at 9th, +1 at 14th (4 total).
export const CRITICAL_STRIKES_KNOWN =
  [0, 0, 0, 0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4];

export function criticalStrikesKnownForLevel(level) {
  return CRITICAL_STRIKES_KNOWN[clampLevel(level) - 1];
}

// Blade archetype crit thresholds: 19-20 at 3rd (Pinpoint Strikes), 18-20 at 17th
// (Perfect Strikes). Other archetypes / base class: 20 only (no threshold change
// stated for them — do NOT extend Blade's thresholds to the whole class).
export function critThresholdFor(archetype, level) {
  if (archetype !== 'Blade') return 20;
  if (clampLevel(level) >= 17) return 18;
  if (clampLevel(level) >= 3) return 19;
  return 20;
}

// --- State ----------------------------------------------------------------------

export function defaultDuelistState() {
  return {
    archetype: null,
    fightingStyle: null,
    additionalFightingStyle: null,
    criticalStrikes: [],
    determinedUsesLeft: 0,
    determinedUsesMax: 0,
  };
}
function clone(state) {
  return JSON.parse(JSON.stringify(state || defaultDuelistState()));
}

export function learnCriticalStrike(state, level, strikeName) {
  const s = clone(state);
  if (!CRITICAL_STRIKE_OPTIONS.includes(strikeName)) {
    return { state: s, success: false, reason: 'critical_strike_not_found' };
  }
  if (s.criticalStrikes.includes(strikeName)) {
    return { state: s, success: false, reason: 'critical_strike_already_known' };
  }
  if (s.criticalStrikes.length >= criticalStrikesKnownForLevel(level)) {
    return { state: s, success: false, reason: 'critical_strikes_known_cap' };
  }
  s.criticalStrikes.push(strikeName);
  return { state: s, success: true, strike: strikeName };
}

export function useDetermined(state, level) {
  const s = clone(state);
  const max = determinedUsesMaxForLevel(level);
  if (!s.determinedUsesMax) { s.determinedUsesMax = max; s.determinedUsesLeft = max; }
  if (s.determinedUsesLeft > max) s.determinedUsesLeft = max;
  if (s.determinedUsesLeft <= 0) return { state: s, success: false, reason: 'no_uses_left' };
  s.determinedUsesLeft -= 1;
  return { state: s, success: true, usesLeft: s.determinedUsesLeft };
}

// Steely Determination (20th): if you have no uses of Determined when you roll
// initiative, regain 1 use. This is an INITIATIVE event, not a rest effect.
export function regainDeterminedAtInitiative(state, level) {
  const s = clone(state);
  if (clampLevel(level) < 20) return { state: s, success: false, reason: 'level_too_low' };
  const max = determinedUsesMaxForLevel(level);
  if (!s.determinedUsesMax) { s.determinedUsesMax = max; s.determinedUsesLeft = max; }
  if (s.determinedUsesLeft > 0) return { state: s, success: false, reason: 'uses_remaining', usesLeft: s.determinedUsesLeft };
  s.determinedUsesLeft = 1;
  return { state: s, success: true, usesLeft: 1 };
}

// --- Rests ----------------------------------------------------------------------
// Long rest refills Determined. Short rest refreshes NOTHING stated for the
// duelist (no short-rest recovery is printed; Perfect Strikes' 1/short-or-long
// rest reroll is tracked by the DM prompt, not a pool here — it is not given a
// fabricated counter).
export function onLongRest(state, { level }) {
  const s = clone(state);
  const max = determinedUsesMaxForLevel(level);
  s.determinedUsesMax = max; s.determinedUsesLeft = max;
  return { state: s, success: true };
}
export function onShortRest(state) {
  const s = clone(state);
  return { state: s, success: true };
}

// --- DM prompt section ----------------------------------------------------------

export function duelistPromptSection(state, { level }) {
  const s = state || defaultDuelistState();
  const max = s.determinedUsesMax || determinedUsesMaxForLevel(level);
  const left = s.determinedUsesMax ? s.determinedUsesLeft : max;
  const lines = [`Duelist (level ${level}${s.archetype ? `, Archetype: ${s.archetype}` : ''}):`];
  lines.push(`- Martial Advantage: ${martialAdvantageDiceString(level)} per turn (NOT expended; needs another enemy of the target within 5 ft of it and not incapacitated, OR you within 5 ft of the target with no other creatures within 5 ft of you; no heavy weapon; no disadvantage on the attack)`);
  lines.push(`- Determined uses left: ${left}/${max} (reroll any failed attack, skill check, or saving throw; must use the new roll)`);
  lines.push(`- Critical Strikes known (${s.criticalStrikes.length}/${criticalStrikesKnownForLevel(level)}): ${s.criticalStrikes.join(', ') || 'none'} (apply one on a critical hit with a melee weapon attack)`);
  if (s.archetype === 'Blade') lines.push(`- Blade crit threshold: ${critThresholdFor('Blade', level)}-20 (longsword, rapier, dagger, shortsword, scimitar, saber only)`);
  if (clampLevel(level) >= 20) lines.push(`- Steely Determination: if no Determined uses remain when rolling initiative, regain 1 use`);
  return lines.join('\n');
}

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
export async function loadDuelistState(kind, id, dbClient) {
  try {
    const db = await resolveDb(dbClient);
    if (!db) return defaultDuelistState();
    const row = await db.dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
    if (!row) return defaultDuelistState();
    const resources = parseAllResources(row.class_resources_json);
    return resources.duelist ? { ...defaultDuelistState(), ...resources.duelist } : defaultDuelistState();
  } catch {
    return defaultDuelistState();
  }
}
export async function saveDuelistState(kind, id, duelistState, dbClient) {
  const db = await resolveDb(dbClient);
  if (!db) return false;
  const row = await db.dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
  const resources = parseAllResources(row ? row.class_resources_json : null);
  resources.duelist = duelistState;
  await db.dbRun(`UPDATE ${tableFor(kind)} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(resources), id]);
  return true;
}

// --- Marker handlers (coordinator-registered; see header) ------------------------
export function registerDuelistMarkers(registerHandler, deps = {}) {
  const load = deps.loadState || loadDuelistState;
  const save = deps.saveState || saveDuelistState;
  const resolveActor = deps.resolveActor || null;
  async function withDuelist(parsed, context, type, fn) {
    if (!context?.characterId || !resolveActor) return null;
    try {
      const actor = await resolveActor(context, parsed?.Target);
      if (!actor) return { type, success: false, reason: 'unknown target' };
      if (String(actor.className || '').toLowerCase() !== 'duelist') {
        return { type, success: false, reason: `${actor.name} is not a duelist` };
      }
      const state = await load(actor.kind, actor.id);
      const res = await fn(state, actor);
      if (res && res.success) await save(actor.kind, actor.id, res.state);
      if (!res) return null;
      const { state: _saved, ...out } = res;
      return { type, actor: actor.name, ...out };
    } catch (e) {
      console.error('[duelistService] marker handler failed:', e.message);
      return null;
    }
  }
  registerHandler('DUELIST_DETERMINED', async (parsed, context) =>
    withDuelist(parsed, context, 'duelist_determined', (s, a) => useDetermined(s, a.level)));
  registerHandler('DUELIST_STEELY', async (parsed, context) =>
    withDuelist(parsed, context, 'duelist_steely', (s, a) => regainDeterminedAtInitiative(s, a.level)));
  registerHandler('DUELIST_CRITICAL_STRIKE', async (parsed, context) =>
    withDuelist(parsed, context, 'duelist_critical_strike', (s, a) =>
      learnCriticalStrike(s, a.level, String(parsed?.Strike || '').trim())));
}

export default {
  DUELING_ARCHETYPES, FIGHTING_STYLES, CRITICAL_STRIKE_OPTIONS,
  MARTIAL_ADVANTAGE_DICE_COUNT, martialAdvantageDiceForLevel, martialAdvantageDiceString,
  DETERMINED_USES, determinedUsesMaxForLevel, CRITICAL_STRIKES_KNOWN,
  criticalStrikesKnownForLevel, critThresholdFor, defaultDuelistState,
  learnCriticalStrike, useDetermined, regainDeterminedAtInitiative, onLongRest,
  onShortRest, duelistPromptSection, loadDuelistState, saveDuelistState,
  registerDuelistMarkers,
};
