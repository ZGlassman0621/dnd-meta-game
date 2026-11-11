// rangerService.js — Ranger prepared-spell cap + Favored Enemy (2026-11-06,
// 2024 PHB photos pp. 119-120).
//
// Mirrors paladinService.js in shape (same slot-gate, same
// { max, counted, ok, over } validator, never trims, never silently
// fixes) with two deliberate deviations, both from the book:
//
// 1. The prepared count is TABLE-DRIVEN, not a formula: the L1
//    Spellcasting text states no Wis-mod formula ("as shown in the
//    Prepared Spells column"): [2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10,
//    11, 11, 12, 12, 14, 14, 14, 15, 15] — the same column as
//    paladin. preparedSpellsMax still takes wisMod first, for
//    signature parity with the paladin/blackguard validators, but
//    the mod does not change the count. The slot gate uses the
//    separate RANGER_SPELL_SLOTS table (levelProgression.js): the
//    shared HALF_CASTER table is the paladin table and ranger
//    differs at L1, L8, L10, L12, L14, L16. L1 HAS slots ({1: 2}),
//    so L1 max is 2 — unlike paladin's 0.
//
// 2. Hunter's Mark is always prepared (Favored Enemy) and NEVER
//    counts against the cap. The validator hard-excludes it, in
//    addition to whatever the caller passes as alwaysPreparedList
//    (Fey Wanderer / Gloom Stalker subclass spells). Spell names
//    are canonicalized on both sides of the Set match
//    (spellSelectionService canonicalizeSpellName), so a print
//    spelling cannot break the exclusion.
//
// Favored Enemy free casts: Hunter's Mark can be cast without
// expending a spell slot favoredEnemyFreeCasts(level) times — 2 at
// L1-4, 3 at L5-8, 4 at L9-12, 5 at L13-16, 6 at L17-20 — and all
// expended uses regain on a Long Rest. The free-cast USES are
// tracked nowhere yet: there is no rest/resource row for them in
// the app (see the NOTE on favoredEnemyFreeCasts below), so this
// module exposes the table + the grant and the count surfacing
// only; spending/regaining uses is a flagged follow-up, not faked
// here.
//
// Multiclass-into-ranger is never blocked on the other class's
// stored list: the route gates are primary-ranger only (PUT) and
// leveling-up-IN-ranger only (level-up), the same pattern as the
// artificer / blackguard / paladin validators.
import {
  RANGER_SPELL_SLOTS,
  RANGER_SPELLS_PREPARED,
  FAVORED_ENEMY_FREE_CASTS,
} from '../config/levelProgression.js';
import { canonicalizeSpellName } from './spellSelectionService.js';
import { rangerSubclassSpellsAtLevel } from './subclassService.js';

// The Favored Enemy grant: always prepared at every ranger level.
export const HUNTERS_MARK = "Hunter's Mark";

function clampLevel(level) {
  const l = Number(level);
  if (!Number.isFinite(l)) return 1;
  return Math.min(20, Math.max(1, Math.trunc(l)));
}

export function spellSlotsForLevel(level) {
  return RANGER_SPELL_SLOTS[clampLevel(level)] || {};
}

// Slot rule: a prepared caster with no spell slots at that level
// prepares 0. Ranger HAS 1st-level slots, so this never zeroes a
// ranger level — the gate is kept for parity with
// paladinService.preparedSpellsMax (a future table edit that
// removed a level's slots would surface here, not as a silent
// over-cap). The count itself is the table column, not the mod.
export function preparedSpellsMax(wisMod, level) {
  const slots = spellSlotsForLevel(level);
  const hasSlots = Object.values(slots).some((n) => Number(n) > 0);
  if (!hasSlots) return 0;
  return RANGER_SPELLS_PREPARED[clampLevel(level) - 1];
}

export function validatePreparedSpells(wisMod, level, preparedList, alwaysPreparedList) {
  const max = preparedSpellsMax(wisMod, level);
  const always = new Set((alwaysPreparedList || []).map((sp) => canonicalizeSpellName(sp)));
  // Class-level grant: Hunter's Mark never counts, even if the
  // caller passed no alwaysPreparedList at all.
  always.add(canonicalizeSpellName(HUNTERS_MARK));
  const counted = (preparedList || []).filter((sp) => !always.has(canonicalizeSpellName(sp)));
  return { max, counted: counted.length, ok: counted.length <= max, over: Math.max(0, counted.length - max) };
}

// Favored Enemy (2024 PHB p. 120): free castings of Hunter's Mark
// without expending a spell slot. NOTE — honest gap: the app has
// no rest/resource row for these uses (no per-feature use counter
// in class_resources_json, no Long Rest reset hook for it), so this
// returns the TABLE only. The count is surfaced to the sheet via
// rangerAlwaysPreparedSpells / the DM prompt; spending a free cast
// and regaining uses on a Long Rest is a named follow-up —
// deliberately not faked with a counter that nothing reads.
export function favoredEnemyFreeCasts(level) {
  return FAVORED_ENEMY_FREE_CASTS[clampLevel(level) - 1];
}

// Single source for PUT / level-up callers: every spell a ranger
// always has prepared at this level — Hunter's Mark (class) plus
// the subclass list (Fey Wanderer / Gloom Stalker; [] for Hunter /
// Beast Master). The validator excludes all of these from the cap.
export function rangerAlwaysPreparedSpells(subclass, level) {
  const subclassSpells = rangerSubclassSpellsAtLevel('ranger', subclass, clampLevel(level));
  return [HUNTERS_MARK, ...(Array.isArray(subclassSpells) ? subclassSpells : [])];
}

export default {
  HUNTERS_MARK,
  spellSlotsForLevel,
  preparedSpellsMax,
  validatePreparedSpells,
  favoredEnemyFreeCasts,
  rangerAlwaysPreparedSpells,
};
