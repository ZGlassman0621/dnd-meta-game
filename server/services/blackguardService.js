// Blackguard class service — base class + Vice progression (digest-only).
//
// Source: ~/workspace/dnd-app-review/new-classes-staging/digests/blackguard.md
// (Libris Mortis 5e Conversion, Ch. 5; NO conversion applied).
// STANDALONE FULL CLASS — NOT a paladin subclass, NOT prestige. The paladin
// relationship is two rules only: (1) DM-directed level replacement on a fall or
// an atonement quest, and (2) NO character may hold blackguard AND paladin levels
// at the same time — enforced here as validateNoPaladinBlackguardOverlap, a
// validator + service check, never as subclass wiring.
//
// Artificer-shaped, with one deliberate deviation forced by this mirror:
// server/database.js, server/utils/safeParse.js, server/services/markerPipeline.js
// and server/services/conditionService.js are ABSENT from /tmp/sp/repo, so this
// module has ZERO static imports. Pure functions are directly importable and
// testable here; load/save helpers take an optional injected db client or
// dynamic-import '../database.js' on the live Mac and degrade gracefully when it
// is unavailable; marker handlers register through registerBlackguardMarkers.
// The coordinator wires those seams on the live Mac.
//
// State lives in class_resources_json.blackguard (migration 091 column, both
// tables), parsed with its OWN full parse — never parseClassResources, which
// strips every top-level key except used/raging/bardicHeld (SURVEY §2). Maxima
// are computed, never stored.
//
// Spell NAMES (80 unique, another agent's catalog work) are referenced by class
// key "Blackguard", never duplicated here. Only slots, prepared counts, and
// feature math live here.
//
// NAME-COLLISION GUARD: the Vice of Despair 20th feature "Dread Lord" is NOT the
// Chapter 6 warlock patron "The Dread Lord". Every key for the vice feature uses
// the prefix despair_dread_lord — never a bare dread_lord key.

const clampLevel = (level) => Math.min(20, Math.max(1, Math.trunc(level) || 1));
const clampMod = (mod) => Math.trunc(mod) || 0;

export const BLACKGUARD_VICES = ['Despair', 'Domination', 'Fury', 'Pride', 'Treachery'];

// Dread Smite damage type by Vice (chosen at 3rd; before a Vice is chosen the
// damage type is necrotic, as printed for the pre-Vice feature).
export const DREAD_SMITE_TYPE_BY_VICE = {
  Despair: 'cold',
  Domination: 'psychic',
  Fury: 'thunder',
  Pride: 'radiant',
  Treachery: 'poison',
};

export function dreadSmiteTypeForVice(vice) {
  return DREAD_SMITE_TYPE_BY_VICE[vice] || 'necrotic';
}

export const FIGHTING_STYLES = ['Defense', 'Dueling', 'Great Weapon Fighting', 'Protection'];

// Spell slots — identical to HALF_CASTER_SPELL_SLOTS at every level 1-20
// (verified row-by-row in the fragment). Kept explicit here so the service does
// not depend on the live levelProgression file gaining the blackguard branch.
export const BLACKGUARD_SPELL_SLOTS = {
  1: {},
  2: { 1: 2 }, 3: { 1: 3 }, 4: { 1: 3 },
  5: { 1: 4, 2: 2 }, 6: { 1: 4, 2: 2 },
  7: { 1: 4, 2: 3 }, 8: { 1: 4, 2: 3 },
  9: { 1: 4, 2: 3, 3: 2 }, 10: { 1: 4, 2: 3, 3: 2 },
  11: { 1: 4, 2: 3, 3: 3 }, 12: { 1: 4, 2: 3, 3: 3 },
  13: { 1: 4, 2: 3, 3: 3, 4: 1 }, 14: { 1: 4, 2: 3, 3: 3, 4: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 2 }, 16: { 1: 4, 2: 3, 3: 3, 4: 2 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, 18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, 20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
};

export function spellSlotsForLevel(level) {
  return { ...(BLACKGUARD_SPELL_SLOTS[clampLevel(level)] || {}) };
}

// Spells prepared = Charisma modifier + half blackguard level, rounded down
// (minimum one), of a level you have slots for. Vice spells are always prepared
// and do NOT count against this number — callers must subtract them before
// comparing (see validatePreparedSpells).
// Slot rule (2026-11-06 reconciliation): a prepared caster with no spell slots
// at that level prepares 0 — blackguard has no 1st-level slots
// (BLACKGUARD_SPELL_SLOTS[1] = {}), so L1 prepares 0 even though the formula
// alone would give >= 1. This agrees with levelProgression.getSpellsPrepared
// (zero-slot override) and the Stage 4 creator validator at every level 1-20.
export function preparedSpellsMax(chaMod, level) {
  const slots = spellSlotsForLevel(level);
  const hasSlots = Object.values(slots).some((n) => Number(n) > 0);
  if (!hasSlots) return 0;
  return Math.max(1, clampMod(chaMod) + Math.floor(clampLevel(level) / 2));
}

export function validatePreparedSpells(chaMod, level, preparedList, alwaysPreparedList) {
  const max = preparedSpellsMax(chaMod, level);
  // Case-insensitive match (2026-11-06, item 13): the vice data is
  // mixed case — Despair/Pride/Treachery lowercase, Domination/Fury
  // Title Case (coordinator ruling item 25) — and a player-typed
  // name may differ in case from either. Exact matching silently
  // counted a vice spell when the cases disagreed.
  const norm = (s) => String(s || '').trim().toLowerCase();
  const always = new Set((alwaysPreparedList || []).map(norm));
  const counted = (preparedList || []).filter((sp) => !always.has(norm(sp)));
  return { max, counted: counted.length, ok: counted.length <= max, over: Math.max(0, counted.length - max) };
}

// Dread Smite (2nd): on a melee weapon hit, expend a slot for +2d8, +1d8 per slot
// level above 1st (max 5d8), +1d8 vs celestials (max 6d8). Dice count = 1 + slot
// level, capped at 5 (6 vs celestials).
export function dreadSmiteDiceCount(slotLevel, { vsCelestial = false } = {}) {
  const base = Math.min(5, 1 + Math.max(1, Math.trunc(slotLevel) || 1));
  return vsCelestial ? Math.min(6, base + 1) : base;
}
export function dreadSmiteDice(slotLevel, opts) {
  return `${dreadSmiteDiceCount(slotLevel, opts)}d8`;
}

// Improved Dread Smite (11th): +1d8 on every melee weapon hit (necrotic or Vice type).
export function improvedDreadSmiteDice(level) {
  return clampLevel(level) >= 11 ? '1d8' : '0';
}

// Unholy Vigor (1st): bonus action, temp HP = Charisma modifier + blackguard
// level, lasting 1 minute; 1/short-or-long rest. No minimum is stated as printed;
// the sum is returned as printed (temp-HP granting clamps at 0 downstream).
export function unholyVigorTempHp(chaMod, level) {
  return clampMod(chaMod) + clampLevel(level);
}

// Channel Divinity (general rule): vice grants the options; 1/short-or-long rest.
export function channelDivinityUsesMax() {
  return 1;
}

// Vile Touch (14th): uses = Charisma modifier (min 1) per long rest.
export function vileTouchUsesMax(chaMod, level) {
  if (clampLevel(level) < 14) return 0;
  return Math.max(1, clampMod(chaMod));
}

// Aura of Hate (10th): allies (fiends + undead) within range gain Cha mod (min +1)
// to melee weapon damage rolls. Range 10 ft, 30 ft at 18th.
export function auraOfHateBonus(chaMod, level) {
  if (clampLevel(level) < 10) return 0;
  return Math.max(1, clampMod(chaMod));
}
export function auraOfHateRange(level) {
  if (clampLevel(level) < 10) return 0;
  return clampLevel(level) >= 18 ? 30 : 10;
}

// --- Paladin mutual exclusion ---------------------------------------------------
// "Characters aren't allowed to have levels in the blackguard class and the
// paladin class at the same time." classLevels entries look like
// { class: 'paladin', level: 3 } (character.js class_levels shape). Both classes
// present at level >= 1 = violation. This is a VALIDATOR, not a table row.
export function validateNoPaladinBlackguardOverlap(classLevels) {
  const names = new Set((classLevels || []).map((c) =>
    String(c.class || c.className || '').toLowerCase().trim()));
  const hasBlackguard = names.has('blackguard');
  const hasPaladin = names.has('paladin');
  if (hasBlackguard && hasPaladin) {
    return { ok: false, reason: 'paladin_blackguard_exclusion',
      message: 'A character may not hold blackguard and paladin levels at the same time (Libris Mortis, Blackguards and Paladins).' };
  }
  return { ok: true };
}
export function hasPaladinAndBlackguard(classNames) {
  const names = new Set((classNames || []).map((n) => String(n).toLowerCase().trim()));
  return names.has('blackguard') && names.has('paladin');
}

// Dark Blessing (6th): feature NAME and LEVEL are confirmed in the class table;
// the feature TEXT was NOT located in the passages read for the digest (digest
// UNRESOLVED 1). This function exists only to mark that boundary: it returns the
// gate-check flag, never paladin Aura of Protection text. Do NOT substitute.
export function darkBlessingStatus() {
  return { name: 'Dark Blessing', level: 6, textLocated: false, gateCheckRequired: true,
    note: 'Do not substitute paladin Aura of Protection text.' };
}

// --- State ----------------------------------------------------------------------

export function defaultBlackguardState() {
  return {
    vice: null,
    unholyVigorUsed: false,
    channelDivinityUsed: false,
    vileTouchUsesLeft: 0,
    vileTouchUsesMax: 0,
  };
}
function clone(state) {
  return JSON.parse(JSON.stringify(state || defaultBlackguardState()));
}

export function useUnholyVigor(state) {
  const s = clone(state);
  if (s.unholyVigorUsed) return { state: s, success: false, reason: 'already_used_this_rest' };
  s.unholyVigorUsed = true;
  return { state: s, success: true };
}

export function useChannelDivinity(state) {
  const s = clone(state);
  if (s.channelDivinityUsed) return { state: s, success: false, reason: 'already_used_this_rest' };
  s.channelDivinityUsed = true;
  return { state: s, success: true };
}

export function useVileTouch(state, chaMod, level) {
  const s = clone(state);
  const max = vileTouchUsesMax(chaMod, level);
  if (max === 0) return { state: s, success: false, reason: 'level_too_low' };
  if (!s.vileTouchUsesMax) { s.vileTouchUsesMax = max; s.vileTouchUsesLeft = max; }
  if (s.vileTouchUsesLeft > max) s.vileTouchUsesLeft = max;
  if (s.vileTouchUsesLeft <= 0) return { state: s, success: false, reason: 'no_uses_left' };
  s.vileTouchUsesLeft -= 1;
  return { state: s, success: true, usesLeft: s.vileTouchUsesLeft };
}

// --- Rests ----------------------------------------------------------------------
export function onLongRest(state, { chaMod, level }) {
  const s = clone(state);
  s.unholyVigorUsed = false;
  s.channelDivinityUsed = false;
  const max = vileTouchUsesMax(chaMod, level);
  s.vileTouchUsesMax = max; s.vileTouchUsesLeft = max;
  return { state: s, success: true };
}
export function onShortRest(state) {
  const s = clone(state);
  // Unholy Vigor and Channel Divinity are 1/short-or-long rest — both refresh.
  // Vile Touch does NOT (long rest only, as printed).
  s.unholyVigorUsed = false;
  s.channelDivinityUsed = false;
  return { state: s, success: true };
}

// --- DM prompt section ----------------------------------------------------------
export function blackguardPromptSection(state, { level, chaMod }) {
  const s = state || defaultBlackguardState();
  const smiteType = dreadSmiteTypeForVice(s.vice);
  const vtMax = s.vileTouchUsesMax || vileTouchUsesMax(chaMod, level);
  const vtLeft = s.vileTouchUsesMax ? s.vileTouchUsesLeft : vtMax;
  const lines = [`Blackguard (level ${level}, Cha mod ${chaMod}${s.vice ? `, Vice: ${s.vice}` : ''}):`];
  lines.push(`- Dread Smite: ${dreadSmiteDice(1)} necrotic at 1st-level slot (${smiteType} once a Vice is chosen), +1d8 per slot level above 1st (max 5d8, 6d8 vs celestials); Improved Dread Smite ${improvedDreadSmiteDice(level)} on every melee hit from 11th`);
  lines.push(`- Unholy Vigor: ${s.unholyVigorUsed ? 'used' : 'available'} (bonus action, ${unholyVigorTempHp(chaMod, level)} temp HP for 1 minute, 1/short-or-long rest)`);
  lines.push(`- Channel Divinity: ${s.channelDivinityUsed ? 'used' : 'available'} (1/short-or-long rest; options granted by the Vice)`);
  lines.push(`- Spells prepared max: ${preparedSpellsMax(chaMod, level)} (Cha mod + half level, min 1; Vice spells always prepared and not counted); slots ${JSON.stringify(spellSlotsForLevel(level))}; no cantrips listed`);
  if (clampLevel(level) >= 10) lines.push(`- Aura of Hate: +${auraOfHateBonus(chaMod, level)} melee damage to you and allied fiends/undead within ${auraOfHateRange(level)} ft`);
  if (clampLevel(level) >= 14) lines.push(`- Vile Touch uses left: ${vtLeft}/${vtMax} (long rest only)`);
  if (clampLevel(level) >= 6) lines.push(`- Dark Blessing (6th): GATE CHECK — feature text not located in the digest passages; do NOT substitute paladin text`);
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
export async function loadBlackguardState(kind, id, dbClient) {
  try {
    const db = await resolveDb(dbClient);
    if (!db) return defaultBlackguardState();
    const row = await db.dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
    if (!row) return defaultBlackguardState();
    const resources = parseAllResources(row.class_resources_json);
    return resources.blackguard ? { ...defaultBlackguardState(), ...resources.blackguard } : defaultBlackguardState();
  } catch {
    return defaultBlackguardState();
  }
}
export async function saveBlackguardState(kind, id, blackguardState, dbClient) {
  const db = await resolveDb(dbClient);
  if (!db) return false;
  const row = await db.dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
  const resources = parseAllResources(row ? row.class_resources_json : null);
  resources.blackguard = blackguardState;
  await db.dbRun(`UPDATE ${tableFor(kind)} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(resources), id]);
  return true;
}

// --- Marker handlers (coordinator-registered; see header) ------------------------
export function registerBlackguardMarkers(registerHandler, deps = {}) {
  const load = deps.loadState || loadBlackguardState;
  const save = deps.saveState || saveBlackguardState;
  const resolveActor = deps.resolveActor || null;
  async function withBlackguard(parsed, context, type, fn) {
    if (!context?.characterId || !resolveActor) return null;
    try {
      const actor = await resolveActor(context, parsed?.Target);
      if (!actor) return { type, success: false, reason: 'unknown target' };
      if (String(actor.className || '').toLowerCase() !== 'blackguard') {
        return { type, success: false, reason: `${actor.name} is not a blackguard` };
      }
      const state = await load(actor.kind, actor.id);
      const res = await fn(state, actor);
      if (res && res.success) await save(actor.kind, actor.id, res.state);
      if (!res) return null;
      const { state: _saved, ...out } = res;
      return { type, actor: actor.name, ...out };
    } catch (e) {
      console.error('[blackguardService] marker handler failed:', e.message);
      return null;
    }
  }
  registerHandler('BLACKGUARD_UNHOLY_VIGOR', async (parsed, context) =>
    withBlackguard(parsed, context, 'blackguard_unholy_vigor', (s) => useUnholyVigor(s)));
  registerHandler('BLACKGUARD_CHANNEL_DIVINITY', async (parsed, context) =>
    withBlackguard(parsed, context, 'blackguard_channel_divinity', (s) => useChannelDivinity(s)));
  registerHandler('BLACKGUARD_VILE_TOUCH', async (parsed, context) =>
    withBlackguard(parsed, context, 'blackguard_vile_touch', (s, a) => useVileTouch(s, a.chaMod, a.level)));
}

export default {
  BLACKGUARD_VICES, DREAD_SMITE_TYPE_BY_VICE, dreadSmiteTypeForVice, FIGHTING_STYLES,
  BLACKGUARD_SPELL_SLOTS, spellSlotsForLevel, preparedSpellsMax, validatePreparedSpells,
  dreadSmiteDiceCount, dreadSmiteDice, improvedDreadSmiteDice, unholyVigorTempHp,
  channelDivinityUsesMax, vileTouchUsesMax, auraOfHateBonus, auraOfHateRange,
  validateNoPaladinBlackguardOverlap, hasPaladinAndBlackguard, darkBlessingStatus,
  defaultBlackguardState, useUnholyVigor, useChannelDivinity, useVileTouch,
  onLongRest, onShortRest, blackguardPromptSection, loadBlackguardState,
  saveBlackguardState, registerBlackguardMarkers,
};
