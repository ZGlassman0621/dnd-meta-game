// bardService.js — Bard prepared-spell cap (2024 PHB, 2026-11-06).
//
// 2024 PHB rule: a bard prepares Cha mod + bard level spells, min 1
// (PHB prepared column 4-22; L1 = 4 at Cha +3). Bards PREPARE in 2024 —
// the 2014 known-spells row is gone from SPELLS_KNOWN, so a bard is a
// prepared caster, never both. This agrees with levelProgression.
// getSpellsPrepared (bard arm: max(1, mod + level)) and the Stage 4
// creator validator at every level 1-20 (see tests/bard-prepared-cap
// .test.js groups (a)/(b) and tests/bard-validator-wiring.test.js
// group (d)).
//
// No slot gate: bards are full casters with 1st-level slots at every
// level 1-20, so the getSpellsPrepared zero-slot override never fires
// for bard — the plain formula agrees with the arm everywhere.
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

// 2024 PHB formula: Cha mod + bard level, min 1.
export function preparedSpellsMax(chaMod, level) {
  return Math.max(1, clampMod(chaMod) + clampLevel(level));
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
