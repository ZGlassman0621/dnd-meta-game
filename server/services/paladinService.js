// paladinService.js — Paladin prepared-spell cap (2024 PHB, pp.
// 109-110, verified from the book 2026-11-06).
//
// PHB CORRECTION (2026-11-06): the old rule — Cha mod + half paladin
// level, min 1, gated to 0 at level 1 for having no 1st-level slots —
// was the 2014 rule and is retired. The 2024 table reads Prepared
// Spells 2 at L1, the L1 Spellcasting text says "To start, choose
// two level 1 Paladin spells", and the count increases "as shown in
// the Prepared Spells column of the Paladin Features table" — the
// book states NO Cha-mod formula. The honest implementation follows
// the printed rule: the table column (PALADIN_SPELLS_PREPARED in
// levelProgression.js — 2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10, 11, 11,
// 12, 12, 14, 14, 14, 15, 15 for levels 1-20; the book's own
// example: a level 5 Paladin prepares six spells). A 2024 L1 paladin
// HAS two 1st-level slots (PALADIN_SPELL_SLOTS), so the slot gate is
// gone for paladin. preparedSpellsMax KEEPS its (chaMod, level)
// signature — callers pass chaMod — but the value is table-driven
// and mod-independent. This agrees with levelProgression.
// getSpellsPrepared (fixed-table arm, before the slot gate) and the
// Stage 4 creator validator at every level 1-20 (see
// tests/paladin-l1-cap.test.js groups (a)/(b)).
//
// Oath spells (paladinOathSpellsAtLevel, subclassService) are
// always prepared and never count against the cap — the caller
// passes them as alwaysPreparedList. Spell names are canonicalized
// on both sides of the Set match (spellSelectionService
// canonicalizeSpellName), so a print spelling ('Create Food or
// Water' vs catalog 'Create Food and Water') cannot break the
// exclusion. The validator never trims, never silently fixes: it
// returns { max, counted, ok, over } and the route refuses with a
// field-named 400.
//
// Multiclass-into-paladin is never blocked on the other class's
// stored list: the route gates are primary-paladin only (PUT) and
// leveling-up-IN-paladin only (level-up), the same pattern as the
// artificer / blackguard validators.
import { PALADIN_SPELL_SLOTS, PALADIN_SPELLS_PREPARED } from '../config/levelProgression.js';
import { canonicalizeSpellName } from './spellSelectionService.js';

function clampLevel(level) {
  const l = Number(level);
  if (!Number.isFinite(l)) return 1;
  return Math.min(20, Math.max(1, Math.trunc(l)));
}

export function spellSlotsForLevel(level) {
  return PALADIN_SPELL_SLOTS[clampLevel(level)] || {};
}

// Table rule (2024 PHB, pp. 109-110): the prepared cap is the
// Prepared Spells column — 2 at L1, 6 at L5 — at every level, and
// does not depend on the Cha modifier. chaMod is accepted (callers
// pass it) and ignored. The old slot gate is gone for paladin: a
// 2024 L1 paladin HAS two 1st-level slots.
export function preparedSpellsMax(chaMod, level) {
  void chaMod;
  return PALADIN_SPELLS_PREPARED[clampLevel(level) - 1];
}

export function validatePreparedSpells(chaMod, level, preparedList, alwaysPreparedList) {
  const max = preparedSpellsMax(chaMod, level);
  const always = new Set((alwaysPreparedList || []).map((sp) => canonicalizeSpellName(sp)));
  const counted = (preparedList || []).filter((sp) => !always.has(canonicalizeSpellName(sp)));
  return { max, counted: counted.length, ok: counted.length <= max, over: Math.max(0, counted.length - max) };
}

export default {
  spellSlotsForLevel,
  preparedSpellsMax,
  validatePreparedSpells,
};
