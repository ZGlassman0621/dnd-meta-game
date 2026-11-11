// wizardService.js — Wizard prepared-spell cap (2024 PHB, 2026-11-07).
//
// 2024 PHB rule: a wizard prepares Int mod + wizard level spells, min 1
// (PHB prepared column 4-22; L1 = 4 at Int +3, L5 = 9 at Int +4,
// L20 = 25 at Int +5). No fixed table is stored anywhere — the printed
// column is reproduced at the book's implied ASI progression, the same
// rule-vs-table treatment as cleric/druid/bard. This agrees with
// levelProgression.getSpellsPrepared (wizard arm: the shared
// fall-through max(1, mod + level), reached via the PREPARED_CASTERS
// set; wizards are full casters with 1st-level slots at every level
// 1-20, so the arm's slot gate never fires for wizard — see
// tests/wizard-validator-wiring.test.js group (d)).
//
// No slot gate: see above — the plain formula agrees with the arm
// everywhere.
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
import { canonicalizeSpellName } from './spellSelectionService.js';

function clampLevel(level) {
  const l = Number(level);
  if (!Number.isFinite(l)) return 1;
  return Math.min(20, Math.max(1, Math.trunc(l)));
}

function clampMod(mod) {
  const m = Number(mod);
  if (!Number.isFinite(m)) return 0;
  return Math.trunc(m);
}

// 2024 PHB formula: Int mod + wizard level, min 1.
export function preparedSpellsMax(intMod, level) {
  return Math.max(1, clampMod(intMod) + clampLevel(level));
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
