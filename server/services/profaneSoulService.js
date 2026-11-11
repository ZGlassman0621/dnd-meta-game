// profaneSoulService.js — Order of the Profane Soul (Blood Hunter)
// prepared-spell cap (2026-11-07).
//
// Mirrors sorcererService.validatePreparedSpells in shape (same
// { max, counted, ok, over } return, same canonicalized
// always-prepared exclusion), but the CAP is the Profane Soul table:
// the Blood Hunter (2024 Rules) Pact Magic feature prepares from the
// Warlock list on a FIXED table — 2 at 3rd -> 11 at 20th
// (PROFANE_SOUL_SPELLS_PREPARED in levelProgression.js, agreeing with
// levelProgression.getSpellsPrepared at every level 3-20). The book
// states NO formula, so there is NO ability mod in this service's
// signature — preparedSpellsMax(level) is a table lookup. Do NOT
// "simplify" it into Int mod + level: Profane Soul casts with
// Intelligence, but the prepared count does not depend on it.
//
// The Warlock one-third rule ("Multiclassing with Warlock": add
// one-third of Blood Hunter levels, rounded down, to the Warlock
// level, capped at 20) governs PACT SLOTS only
// (levelProgression.getMulticlassSpellSlots) — it does NOT change
// the prepared count, which stays on the Profane Soul table by Blood
// Hunter level. Before 3rd there is no casting (the subclass is
// chosen at 3rd): the table reads 0 at levels 1-2 and
// getSpellsPrepared returns null there, like any non-caster.
//
// ARG ORDER (2026-11-07 — record it, the blackguard trap):
// validatePreparedSpells(level, preparedList, alwaysPreparedList) —
// LEVEL FIRST, no mod — like the artificer/sorcerer validators, NOT
// like blackguard's (chaMod, level, ...) chaMod-first order. Route
// callers must pass the level first.
//
// Revealed Arcana (7th) and Unsealed Arcana (15th) spells are always
// prepared and never count against the cap — the caller passes them
// as alwaysPreparedList (subclassService.
// profaneSoulArcanaSpellsAtLevel, patron-aware). Spell names are
// canonicalized on both sides of the Set match (spellSelectionService
// canonicalizeSpellName), so a print spelling cannot break the
// exclusion. The validator never trims, never silently fixes: it
// returns { max, counted, ok, over } and the route refuses with a
// field-named 400.
//
// Multiclass-into-Blood-Hunter is never blocked on the other class's
// stored list: the route gates are primary-blood_hunter + Profane
// Soul only (PUT) and leveling-up-IN-blood_hunter while ALREADY
// Profane Soul only (level-up), the same pattern as the artificer /
// blackguard / paladin / sorcerer / ranger validators. Leveling INTO
// Profane Soul at 3rd is never blocked — the stored list had no
// prepared cap before the subclass existed.
import { PROFANE_SOUL_SPELLS_PREPARED } from '../config/levelProgression.js';
import { canonicalizeSpellName } from './spellSelectionService.js';

function clampLevel(level) {
  const l = Number(level);
  if (!Number.isFinite(l)) return 0;
  return Math.trunc(l);
}

// Table rule: the Profane Soul Prepared Spells table governs — 2 at
// 3rd -> 11 at 20th. Out-of-range level (not an integer 1-20)
// prepares 0. Levels 1-2 read 0 from the table (no casting before
// the subclass is chosen at 3rd).
export function preparedSpellsMax(level) {
  const l = clampLevel(level);
  if (l < 1 || l > 20) return 0;
  return PROFANE_SOUL_SPELLS_PREPARED[l - 1];
}

export function validatePreparedSpells(level, preparedList, alwaysPreparedList) {
  const max = preparedSpellsMax(level);
  const always = new Set((alwaysPreparedList || []).map((sp) => canonicalizeSpellName(sp)));
  const counted = (preparedList || []).filter((sp) => !always.has(canonicalizeSpellName(sp)));
  return { max, counted: counted.length, ok: counted.length <= max, over: Math.max(0, counted.length - max) };
}

export default {
  preparedSpellsMax,
  validatePreparedSpells,
};
