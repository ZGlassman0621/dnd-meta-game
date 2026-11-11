// sorcererService.js — Sorcerer prepared-spell cap (2026-11-06).
//
// Mirrors paladinService.validatePreparedSpells in shape (same
// { max, counted, ok, over } return, same canonicalized
// always-prepared exclusion), but the CAP is different in kind:
// sorcerers PREPARE in 2024 — the 2024 PHB Sorcerer Features table
// carries a fixed "Prepared Spells" column, 2 at 1st -> 22 at 20th,
// and the L1 Spellcasting text states NO formula ("The number of
// spells on your list increases as you gain Sorcerer levels, as
// shown in the Prepared Spells column of the Sorcerer Features
// table"). So there is NO ability mod in this service's signature —
// preparedSpellsMax(level) is a table lookup in
// SORCERER_SPELLS_PREPARED (levelProgression.js), agreeing with
// levelProgression.getSpellsPrepared at every level 1-20. Do NOT
// "simplify" it into Cha mod + level: no consistent mod fits
// (L1 = 2, L20 = 22).
//
// Sorcerers have full-caster spell slots at every level 1-20, so
// there is no slot gate here (unlike paladin/blackguard, whose L1
// prepares 0 for want of 1st-level slots). An out-of-range level
// returns 0 (fail-closed), following paladin's guard style.
//
// Subclass spells (sorcererSubclassSpellsAtLevel, subclassService)
// are always prepared and never count against the cap — the caller
// passes them as alwaysPreparedList. Spell names are canonicalized
// on both sides of the Set match (spellSelectionService
// canonicalizeSpellName), so a print spelling cannot break the
// exclusion. The validator never trims, never silently fixes: it
// returns { max, counted, ok, over } and the route refuses with a
// field-named 400.
//
// Multiclass-into-sorcerer is never blocked on the other class's
// stored list: the route gates are primary-sorcerer only (PUT) and
// leveling-up-IN-sorcerer only (level-up), the same pattern as the
// artificer / blackguard / paladin validators.
import { SORCERER_SPELLS_PREPARED } from '../config/levelProgression.js';
import { canonicalizeSpellName } from './spellSelectionService.js';

function clampLevel(level) {
  const l = Number(level);
  if (!Number.isFinite(l)) return 0;
  return Math.trunc(l);
}

// Table rule: the 2024 PHB Prepared Spells column governs — 2 at 1st
// -> 22 at 20th. Out-of-range level (not an integer 1-20) prepares 0.
export function preparedSpellsMax(level) {
  const l = clampLevel(level);
  if (l < 1 || l > 20) return 0;
  return SORCERER_SPELLS_PREPARED[l - 1];
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
