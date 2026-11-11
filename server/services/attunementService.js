/**
 * General magic-item attunement service (mechanics-hooks, D10 / F10).
 *
 * Scope (Amendment 1 §3.3, exactly): the Thief's Use Magic Device
 * attunement limb, generalized. One new service file, two new markers
 * (ATTUNE / UNATTUNE — schemas + dmSession import live in HANDOFF.md
 * for the markers family), zero migrations, one existing cap function
 * reused, one existing refusal shape reused, Artificer record untouched.
 *
 * Cap — computed, never stored. attunementCapFor(actor): base 3;
 * Artificer ladder via the existing attunementCapForLevel; Thief 4 at
 * Rogue level 13+ (only when the actor's subclass is Thief and the
 * Rogue level is >= 13). Cap rule, from the feature text ("attune to
 * up to four", not "+1"): the cap is the MAXIMUM of the applicable
 * grants, not their sum. Multiclass Artificer + Thief therefore caps
 * at 4 until the Artificer ladder passes it (5 at L14, 6 at L18).
 *
 * Record — attuned item names, in class_resources_json.attunement =
 * { items: [names] }, loaded/saved with this service's OWN full parse
 * (the Artificer precedent — classFeatureService.parseClassResources
 * strips unknown top-level keys, do NOT route through it). NOT the
 * inventory blob: inventory items have no attunement flag and no
 * requires-attunement source. No migration — the column already exists
 * on characters AND companions (migration 091).
 *
 * Unification with Artificer — do NOT subsume in this job. The
 * Artificer keeps its own record (createdItems[].attuned +
 * attunedExternal); the general record is for non-Artificers. The
 * ATTUNE/UNATTUNE handlers refuse actors with Artificer levels
 * (reason 'artificer_uses_own_record') so the two records can never
 * diverge or double-count. attunedCountFor(actor) is the future
 * unification seam: it counts the general record only today.
 *
 * KNOWN GAP (recorded, not fixed here): a multiclass Artificer +
 * Thief whose Thief grant (4) exceeds the Artificer ladder (3 below
 * L10) cannot reach cap 4 through ARTIFICER_ATTUNE — artificerService
 * caps by attunementCapForLevel alone and does not know the Thief
 * grant. The pure attunementCapFor() here already returns the right
 * max; the Artificer service adopting it is a follow-up.
 *
 * The other two Thief limbs are NOT in this file: (b) the charge-saving
 * 1d6 has no general magic-item-use path — it is a pending instruction
 * ("roll 1d6; on a 6, no charge spent"), recorded in the feature's
 * engine field; (c) the scroll limb is a spell-cast follow-up — exact
 * patch in HANDOFF.md for the spell-cast family. Use Magic Device
 * stays kind F (Amendment 1 §3.3.6).
 *
 * Spend surface: markers ATTUNE / UNATTUNE (schemas in markerSchemas.js,
 * owned by the markers family — see HANDOFF.md). DM writes the marker;
 * the system checks the cap, refuses over-cap with attunement_cap (the
 * same fail-closed shape as the Artificer refusal and as ammo at zero),
 * and records the name. Unattune removes it. Attunement timing (the
 * hour, etc.) stays DM-side, as it does for Artificer.
 *
 * State lives in class_resources_json.attunement (migration 091 added
 * that column to characters AND companions), so no new migration.
 * Pure functions take state and return { state, ...result }; DB
 * helpers load/save that JSON. Never mutate the caller's state.
 */

import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { attunementCapForLevel } from './artificerService.js';
import { findCompanionIdByName } from './conditionService.js';

export const BASE_ATTUNEMENT_CAP = 3;
export const THIEF_ATTUNEMENT_CAP = 4;
export const THIEF_ATTUNEMENT_MIN_ROGUE_LEVEL = 13;
export const THIEF_SUBCLASS_NAME = 'thief';

// --- Per-class level resolution (multiclass-aware, D6) ----------------------
// class_levels is a JSON array of { class, level, subclass, ... } on the
// character/companion row (see routes/character.js PUT validators and
// restTimeService.pactWarlockLevel for the same shape). A row with no
// class_levels, or no entry for the class, falls back to the primary
// class + total level when the primary class matches; otherwise null
// (the actor has no levels in that class). spellbookService.js carries
// its own warlockLevelFromClassLevels / wizardLevelFromClassLevels for
// the same shape, but it is NOT in the F10 mirror, so this file carries
// its own small copy rather than importing an unverified path.
export function levelFromClassLevels(classLevelsRaw, className, primaryClass, totalLevel) {
  const want = String(className || '').toLowerCase().trim();
  if (!want) return null;
  const parsed = typeof classLevelsRaw === 'string'
    ? safeParse(classLevelsRaw, null) : classLevelsRaw;
  if (Array.isArray(parsed)) {
    const entry = parsed.find((e) => String(e?.class ?? '').toLowerCase().trim() === want);
    if (entry && Number(entry.level)) return Number(entry.level);
  }
  if (String(primaryClass || '').toLowerCase().trim() === want) {
    return Number(totalLevel) || 1;
  }
  return null;
}

export function subclassFromClassLevels(classLevelsRaw, className, primaryClass, primarySubclass) {
  const want = String(className || '').toLowerCase().trim();
  if (!want) return primarySubclass ?? null;
  const parsed = typeof classLevelsRaw === 'string'
    ? safeParse(classLevelsRaw, null) : classLevelsRaw;
  if (Array.isArray(parsed)) {
    const entry = parsed.find((e) => String(e?.class ?? '').toLowerCase().trim() === want);
    if (entry && entry.subclass) return entry.subclass;
  }
  if (String(primaryClass || '').toLowerCase().trim() === want) return primarySubclass ?? null;
  return null;
}

// --- Cap (computed, never stored) -------------------------------------------
// actor shape: { className | class, subclassName | subclass, level,
//   classLevels | class_levels } — the DB-row shape works too, since
// resolveActor below builds exactly this.
export function attunementCapFor(actor = {}) {
  const classLevels = actor.classLevels ?? actor.class_levels ?? null;
  const primaryClass = actor.className ?? actor.class ?? null;
  const totalLevel = actor.level ?? 1;
  const artLevel = levelFromClassLevels(classLevels, 'artificer', primaryClass, totalLevel);
  const rogueLevel = levelFromClassLevels(classLevels, 'rogue', primaryClass, totalLevel);
  const rogueSubclass = subclassFromClassLevels(
    classLevels, 'rogue', primaryClass, actor.subclassName ?? actor.subclass ?? null
  );
  let cap = BASE_ATTUNEMENT_CAP;
  if (artLevel != null) cap = Math.max(cap, attunementCapForLevel(artLevel));
  const isThief = String(rogueSubclass || '').toLowerCase().trim() === THIEF_SUBCLASS_NAME;
  if (isThief && rogueLevel != null && rogueLevel >= THIEF_ATTUNEMENT_MIN_ROGUE_LEVEL) {
    cap = Math.max(cap, THIEF_ATTUNEMENT_CAP);
  }
  return cap;
}

export function defaultAttunementState() {
  return { items: [] };
}
function clone(state) {
  return JSON.parse(JSON.stringify(state || defaultAttunementState()));
}
function normName(name) {
  return String(name || '').trim().toLowerCase();
}

// --- Pure record functions ---------------------------------------------------
// attunedCountFor(actor) is the future unification seam: it counts the
// GENERAL record only. A future job that unifies the records adds the
// Artificer count (artificerService.attunedCount) here; until then the
// Artificer record is deliberately NOT counted, so the two records
// can never be merged by accident.
export function attunedCount(state) {
  const s = state || defaultAttunementState();
  return Array.isArray(s.items) ? s.items.length : 0;
}
export function attunedCountFor(actor) {
  if (!actor || typeof actor !== 'object') return 0;
  const s = actor.attunement ?? actor;
  if (!s || typeof s !== 'object' || !Array.isArray(s.items)) return 0;
  return s.items.length;
}
export function isAttuned(state, name) {
  const s = state || defaultAttunementState();
  const want = normName(name);
  if (!want) return false;
  return (s.items || []).some((i) => normName(i) === want);
}
export function attuneItem(state, cap, name) {
  const s = clone(state);
  if (!Array.isArray(s.items)) s.items = [];
  const clean = String(name || '').trim();
  if (!clean) return { state: s, success: false, reason: 'item_name_required' };
  if (s.items.some((i) => normName(i) === normName(clean))) {
    return { state: s, success: true, already: true };
  }
  const c = Number(cap) || BASE_ATTUNEMENT_CAP;
  if (attunedCount(s) >= c) {
    return { state: s, success: false, reason: 'attunement_cap', cap: c };
  }
  s.items.push(clean);
  return { state: s, success: true };
}
export function unattuneItem(state, name) {
  const s = clone(state);
  if (!Array.isArray(s.items)) s.items = [];
  const idx = s.items.findIndex((i) => normName(i) === normName(String(name || '').trim()));
  if (idx === -1) return { state: s, success: false, reason: 'not_attuned' };
  const removed = s.items.splice(idx, 1)[0];
  return { state: s, success: true, removed };
}

// --- Own full parse (the Artificer precedent) --------------------------------
// Pure and exported so the record-survives-load/save property is testable
// without a DB. attunementStateIntoResources spreads the existing top-level
// keys (notably .artificer and .used) untouched — saving attunement must
// never wipe the Artificer record, and resetResourcesForRest already
// promises unknown top-level keys pass through untouched.
export function attunementStateFromResources(raw) {
  const parsed = typeof raw === 'string' ? safeParse(raw, {}) : (raw || {});
  const res = parsed && typeof parsed === 'object' ? parsed : {};
  const att = res.attunement && typeof res.attunement === 'object' ? res.attunement : null;
  return {
    ...defaultAttunementState(),
    ...(att || {}),
    items: Array.isArray(att?.items) ? [...att.items] : [],
  };
}
export function attunementStateIntoResources(raw, state) {
  const parsed = typeof raw === 'string' ? safeParse(raw, {}) : (raw || {});
  const res = parsed && typeof parsed === 'object' ? { ...parsed } : {};
  res.attunement = state;
  return res;
}

// --- DM prompt section (seam for dmPromptBuilder; not wired here) ------------
export function attunementPromptSection(state, { name, cap } = {}) {
  const s = state || defaultAttunementState();
  const c = Number(cap) || BASE_ATTUNEMENT_CAP;
  const who = name ? `${name}: ` : '';
  const list = (s.items || []).length ? ` — ${(s.items || []).join(', ')}` : ' — nothing attuned';
  return `${who}Attuned ${attunedCount(s)}/${c}${list}. Attune/unattune with [ATTUNE: Target="Name" Item="Item name"] / [UNATTUNE: Target="Name" Item="Item name"]; over-cap attunement is refused.`;
}

// --- DB helpers (class_resources_json.attunement; no new migration) ----------
function tableFor(kind) {
  return kind === 'companion' ? 'companions' : 'characters';
}
export async function loadAttunementState(kind, id) {
  try {
    const row = await dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
    if (!row) return defaultAttunementState();
    return attunementStateFromResources(row.class_resources_json);
  } catch {
    return defaultAttunementState();
  }
}
export async function saveAttunementState(kind, id, attunementState) {
  const row = await dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
  const resources = attunementStateIntoResources(row ? row.class_resources_json : null, attunementState);
  await dbRun(`UPDATE ${tableFor(kind)} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(resources), id]);
  return true;
}

// --- Marker handlers (the DM's call sites) -----------------------------------
// Actor resolution mirrors artificerService.resolveArtificer exactly:
// Target names the PC (blank / Player / PC / the PC's name) or a
// companion by name (findCompanionIdByName). The marker handlers are
// registered at import; routes/dmSession.js must import this module
// for side effect (see HANDOFF.md) or they silently never run.
async function resolveActor(context, targetRaw) {
  const character = await dbGet(
    'SELECT id, name, class, subclass, level, class_levels FROM characters WHERE id = ?',
    [context.characterId]
  );
  const raw = String(targetRaw || '').trim();
  const isPc = !raw || /^(player|pc|character)$/i.test(raw)
    || (character && raw.toLowerCase() === String(character.name).toLowerCase());
  if (isPc) {
    return {
      kind: 'player', id: context.characterId, name: character?.name || 'Player',
      className: character?.class || null, subclassName: character?.subclass || null,
      level: character?.level || 1, classLevels: character?.class_levels ?? null,
    };
  }
  const compId = await findCompanionIdByName(context.characterId, raw);
  if (!compId) return null;
  const comp = await dbGet(
    'SELECT id, name, companion_class, companion_subclass, companion_level, companion_class_levels FROM companions WHERE id = ?',
    [compId]
  );
  if (!comp) return null;
  return {
    kind: 'companion', id: compId, name: comp.name || raw,
    className: comp.companion_class || null, subclassName: comp.companion_subclass || null,
    level: comp.companion_level || 1, classLevels: comp.companion_class_levels ?? null,
  };
}
function hasArtificerLevels(actor) {
  return levelFromClassLevels(actor.classLevels, 'artificer', actor.className, actor.level) != null;
}
async function withAttunement(parsed, context, type, fn) {
  if (!context?.characterId) return null;
  try {
    const actor = await resolveActor(context, parsed?.Target);
    if (!actor) return { type, success: false, reason: 'unknown target' };
    if (hasArtificerLevels(actor)) {
      return {
        type, success: false, reason: 'artificer_uses_own_record',
        note: `${actor.name} has Artificer levels — attune with ARTIFICER_ATTUNE / ARTIFICER_UNATTUNE; the general record is for non-Artificers.`,
      };
    }
    const state = await loadAttunementState(actor.kind, actor.id);
    const res = await fn(state, actor);
    if (!res) return null;
    if (res.success) await saveAttunementState(actor.kind, actor.id, res.state);
    const { state: _saved, ...out } = res;
    return { type, actor: actor.name, cap: attunementCapFor(actor), ...out };
  } catch (e) {
    console.error('[attunementService] marker handler failed:', e.message);
    return null;
  }
}

registerMarkerHandler('ATTUNE', async (parsed, context) =>
  withAttunement(parsed, context, 'attune', (s, a) => {
    const item = String(parsed?.Item || '').trim();
    if (!item) return { state: s, success: false, reason: 'ATTUNE needs Item=' };
    return attuneItem(s, attunementCapFor(a), item);
  }));

registerMarkerHandler('UNATTUNE', async (parsed, context) =>
  withAttunement(parsed, context, 'unattune', (s) => {
    const item = String(parsed?.Item || '').trim();
    if (!item) return { state: s, success: false, reason: 'UNATTUNE needs Item=' };
    return unattuneItem(s, item);
  }));

export default {
  BASE_ATTUNEMENT_CAP, THIEF_ATTUNEMENT_CAP, THIEF_ATTUNEMENT_MIN_ROGUE_LEVEL,
  levelFromClassLevels, subclassFromClassLevels, attunementCapFor,
  defaultAttunementState, attunedCount, attunedCountFor, isAttuned,
  attuneItem, unattuneItem, attunementStateFromResources,
  attunementStateIntoResources, attunementPromptSection,
  loadAttunementState, saveAttunementState,
};
