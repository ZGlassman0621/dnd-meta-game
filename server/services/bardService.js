// bardService.js — Bard prepared-spell cap (2024 PHB, 2026-11-06).
//
// 2024 PHB rule (H3, Zach 2026-11-12; corrected 2026-11-23): a bard
// prepares the number in the Bard Features table's Prepared Spells
// column — 4 at L1 -> 22 at L20 (BARD_CLERIC_DRUID_SPELLS_PREPARED in
// levelProgression.js), the same at every Cha modifier. The 2014
// formula (Cha mod + bard level) is retired. Bards PREPARE in 2024 —
// the 2014 known-spells row is gone from SPELLS_KNOWN, so a bard is a
// prepared caster, never both. This agrees with levelProgression.
// getSpellsPrepared (bard arm) and the Stage 4 creator validator at
// every level 1-20 and every modifier (tests/h2-h3-2024-rules.test.js,
// tests/bard-prepared-cap.test.js, tests/bard-validator-wiring.test.js).
//
// No slot gate: bards are full casters with 1st-level slots at every
// level 1-20, so the getSpellsPrepared zero-slot override never fires
// for bard — the table agrees with the arm everywhere.
//
// Always-prepared exclusion: College of the Moon, Blessing of Moonlight
// (L6) — "you always have Moonbeam prepared" — is the ONLY always-
// prepared bard spell in the registry (subclassService.
// bardSubclassSpellsAtLevel). The caller passes it as
// alwaysPreparedList; spell names are canonicalized on both sides of
// the Set match (spellSelectionService canonicalizeSpellName), so a
// player-typed 'moonbeam' cannot break the exclusion. The validator
// never trims, never silently fixes: it returns { max, counted, ok,
// over } and the route refuses with a field-named 400.
//
// Magical Secrets (L10) is NOT excluded: the 2024 text lets the bard
// choose new PREPARED spells from the Cleric/Druid/Wizard lists — the
// picks count against the cap, they are not always prepared. The same
// holds for Lore's Magical Discoveries (added-to-list picks, no stored
// always-prepared entry). Only the book's always-prepared spells are
// excluded — the general Spellcasting rule: "If another Bard feature
// gives you spells that you always have prepared, those spells don't
// count against the number of spells you can prepare."
//
// Multiclass-into-bard is never blocked on the other class's stored
// list: the route gates are primary-bard only (PUT) and leveling-up-IN-
// bard only (level-up), the same pattern as the artificer / blackguard
// / paladin / sorcerer / ranger validators.
import { BARD_CLERIC_DRUID_SPELLS_PREPARED } from '../config/levelProgression.js';
import { canonicalizeSpellName } from './spellSelectionService.js';

function clampLevel(level) {
  const l = Number(level);
  if (!Number.isFinite(l)) return 1;
  return Math.min(20, Math.max(1, Math.trunc(l)));
}

// 2024 PHB table: the Prepared Spells column. chaMod is accepted
// (callers pass it) and ignored — the cap is mod-independent.
export function preparedSpellsMax(chaMod, level) {
  void chaMod;
  return BARD_CLERIC_DRUID_SPELLS_PREPARED[clampLevel(level) - 1];
}

export function validatePreparedSpells(chaMod, level, preparedList, alwaysPreparedList) {
  const max = preparedSpellsMax(chaMod, level);
  const always = new Set((alwaysPreparedList || []).map((sp) => canonicalizeSpellName(sp)));
  const counted = (preparedList || []).filter((sp) => !always.has(canonicalizeSpellName(sp)));
  return { max, counted: counted.length, ok: counted.length <= max, over: Math.max(0, counted.length - max) };
}

export default {
  preparedSpellsMax,
  validatePreparedSpells,
};
