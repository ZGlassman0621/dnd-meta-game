// thirdCasterService.js — Eldritch Knight / Arcane Trickster prepared-spell cap (2026-11-07).
//
// One shared service for both third-caster subclasses: the prepared
// table is ONE table (2024 PHB Eldritch Knight / Arcane Trickster
// Spellcasting tables — 3 at 3rd -> 13 at 20th), the logic is
// identical, and two files would duplicate it. Route blocks import
// from here and carry the class-specific refusal messages.
//
// Mirrors sorcererService.js in shape (same { max, counted, ok, over }
// return, same canonicalized always-prepared exclusion), but the CAP
// differs: EK/AT PREPARE a fixed table, not a formula — the 2024 PHB
// Prepared Spells column governs, so there is NO ability mod in this
// service's signature — preparedSpellsMax(level) is a table lookup in
// ELDRITCH_KNIGHT_ARCANE_TRICKSTER_SPELLS_PREPARED
// (levelProgression.js), agreeing with
// levelProgression.getSpellsPrepared at every level 3-20. Do NOT
// "simplify" it into Int mod + level: no consistent mod fits
// (L3 = 3, L20 = 13).
//
// EK/AT cast from 3rd level only, so below L3 the cap is 0
// (fail-closed), following the paladin/blackguard slot-gate style —
// unlike sorcerer, which has slots at every level. An out-of-range
// level returns 0.
//
// Neither subclass has always-prepared LEVELLED spells: there is no
// alwaysPreparedByLevel data on either kind-'D' feature (verified in
// the recon — the validator's exclusion list is []), so callers pass
// eldritchKnightSpellsAtLevel / arcaneTricksterSpellsAtLevel
// (subclassService — both return [] today) or [] directly, and the
// parameter stays for symmetry with the other validators. Mage Hand
// (Arcane Trickster) is a CANTRIP, not a prepared spell, and Spell
// Thief's stolen spell is transient (prepared for 8 hours) — neither
// is excluded here.
//
// Cantrip counts are per-subclass (PHB via the verified registry
// notes): Eldritch Knight 2 at 3rd, 3rd at 10th; Arcane Trickster
// Mage Hand + 2 Wizard cantrips at 3rd (= 3 total), 4th at 10th —
// Mage Hand counts toward the total. cantripsKnownForSubclass
// agrees with levelProgression.getCantripsKnown at every level.
//
// Multiclass-into-EK/AT is never blocked on the other class's stored
// list: the route gates are primary-fighter/rogue only (PUT) and
// leveling-up-IN-fighter/rogue only (level-up), the same pattern as
// the artificer / blackguard / paladin / sorcerer / ranger validators.
import { ELDRITCH_KNIGHT_ARCANE_TRICKSTER_SPELLS_PREPARED } from '../config/levelProgression.js';
import { canonicalizeSpellName } from './spellSelectionService.js';

function clampLevel(level) {
  const l = Number(level);
  if (!Number.isFinite(l)) return 0;
  return Math.trunc(l);
}

// Table rule: the 2024 PHB Prepared Spells column governs — 3 at 3rd
// -> 13 at 20th. Below 3rd (no casting yet) and out-of-range levels
// prepare 0 (fail-closed).
export function preparedSpellsMax(level) {
  const l = clampLevel(level);
  if (l < 3 || l > 20) return 0;
  return ELDRITCH_KNIGHT_ARCANE_TRICKSTER_SPELLS_PREPARED[l - 1];
}

export function validatePreparedSpells(level, preparedList, alwaysPreparedList) {
  const max = preparedSpellsMax(level);
  const always = new Set((alwaysPreparedList || []).map((sp) => canonicalizeSpellName(sp)));
  const counted = (preparedList || []).filter((sp) => !always.has(canonicalizeSpellName(sp)));
  return { max, counted: counted.length, ok: counted.length <= max, over: Math.max(0, counted.length - max) };
}

// Per-subclass cantrip counts, agreeing with
// levelProgression.getCantripsKnown. subclass is the display name
// ('Eldritch Knight' / 'Arcane Trickster'); anything else is 0.
export function cantripsKnownForSubclass(subclass, level) {
  const l = clampLevel(level);
  if (l < 3 || l > 20) return 0;
  const norm = String(subclass || '').trim().toLowerCase();
  if (norm === 'eldritch knight') return l >= 10 ? 3 : 2;
  if (norm === 'arcane trickster') return l >= 10 ? 4 : 3;
  return 0;
}

export function eldritchKnightCantripsKnown(level) {
  return cantripsKnownForSubclass('Eldritch Knight', level);
}

export function arcaneTricksterCantripsKnown(level) {
  return cantripsKnownForSubclass('Arcane Trickster', level);
}

export default {
  preparedSpellsMax,
  validatePreparedSpells,
  cantripsKnownForSubclass,
  eldritchKnightCantripsKnown,
  arcaneTricksterCantripsKnown,
};
