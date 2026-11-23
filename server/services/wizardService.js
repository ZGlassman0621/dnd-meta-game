// wizardService.js — Wizard prepared-spell cap (2024 PHB, 2026-11-07).
//
// 2024 PHB rule (H3, Zach 2026-11-12; corrected 2026-11-23): a wizard
// prepares the number in the Wizard Features table's Prepared Spells
// column — 4 at L1 -> 25 at L20 (WIZARD_SPELLS_PREPARED in
// levelProgression.js), the same at every Int modifier. The 2014
// formula (Int mod + wizard level) is retired; it matched the column
// only at the standard ASI progression. This agrees with
// levelProgression.getSpellsPrepared (wizard arm) at every level and
// modifier (tests/h2-h3-2024-rules.test.js,
// tests/wizard-validator-wiring.test.js group (d)).
//
// No slot gate: wizards are full casters with 1st-level slots at
// every level 1-20.
//
// Always-prepared exclusion: LIVE since the spellbook system
// (2026-11-07). Spell Mastery (L18) and Signature Spells (L20)
// picks are stored in spellbook_json (server/services/
// spellbookService.js) and the routes pass that list here instead
// of [] — see spellbookService.alwaysPreparedSpells. Wizard schools
// grant no always-prepared spells either: a Savant spell goes INTO
// the spellbook, it is not always prepared — so a prepared Savant
// spell counts against the cap like any other.
//
// Membership (prepared ⊆ book) is NOT checked here: the validator
// is count-only by design, and the routes enforce membership
// through spellbookService.validateBookMembership against the book
// (known_spells) before they call this validator.
//
// Multiclass-into-wizard is never blocked on the other class's stored
// list: the route gates are primary-wizard only (PUT) and leveling-
// up-IN-wizard only (level-up), the same pattern as the artificer /
// blackguard / paladin / sorcerer / ranger / bard validators.
//
// The validator never trims, never silently fixes: it returns
// { max, counted, ok, over } and the route refuses with a field-named
// 400.
import { WIZARD_SPELLS_PREPARED } from '../config/levelProgression.js';
import { canonicalizeSpellName } from './spellSelectionService.js';

function clampLevel(level) {
  const l = Number(level);
  if (!Number.isFinite(l)) return 1;
  return Math.min(20, Math.max(1, Math.trunc(l)));
}

// 2024 PHB table: the Prepared Spells column. intMod is accepted
// (callers pass it) and ignored — the cap is mod-independent.
export function preparedSpellsMax(intMod, level) {
  void intMod;
  return WIZARD_SPELLS_PREPARED[clampLevel(level) - 1];
}

export function validatePreparedSpells(intMod, level, preparedList, alwaysPreparedList) {
  const max = preparedSpellsMax(intMod, level);
  const always = new Set((alwaysPreparedList || []).map((sp) => canonicalizeSpellName(sp)));
  const counted = (preparedList || []).filter((sp) => !always.has(canonicalizeSpellName(sp)));
  return { max, counted: counted.length, ok: counted.length <= max, over: Math.max(0, counted.length - max) };
}

export default {
  preparedSpellsMax,
  validatePreparedSpells,
};
