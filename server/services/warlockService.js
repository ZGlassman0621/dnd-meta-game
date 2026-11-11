// warlockService.js — Warlock prepared-spell cap (2026-11-07).
//
// 2024 PHB rule (Warlock Features table, "Prepared Spells" column,
// PHB-photo-verified 2026-11-06): warlocks PREPARE in 2024 —
// table-driven, mod-independent: 2 at 1st -> 15 at 20th
// (WARLOCK_SPELLS_PREPARED in levelProgression.js). The book states
// no formula, so no mod is consulted; the table governs at every
// level. Warlocks have Pact Magic slots at every level, so no slot
// gate applies. preparedSpellsMax KEEPS its (chaMod, level)
// signature — callers pass chaMod — but the value is table-driven
// and mod-independent, the same parity choice as paladinService.
// This agrees with levelProgression.getSpellsPrepared (warlock arm)
// and the Stage 4 creator validator at every level 1-20 (see
// tests/warlock-validator-wiring.test.js groups (a)/(b)).
//
// Patron spells are ADDED TO THE WARLOCK SPELL LIST, not always
// prepared (server/data/subclasses/warlock.js header + every patron
// prompt; the sheet prints the same). A patron spell the player
// prepares COUNTS against the cap like any other prepared spell —
// there is NO patron-spell exclusion on the warlock path. Do not
// add one.
//
// Contact Patron (warlock L9): the warlock always has Contact Other
// Plane prepared — it never counts against the cap. The feature is
// modeled nowhere else (name only in the levelProgression feature
// table), so the exclusion here is the fixed single spell, gated to
// warlock level 9+. Mirrors ranger's Hunter's Mark treatment: the
// validator adds it defensively AND the route passes it via
// warlockAlwaysPreparedSpells. Spell names are canonicalized on
// both sides of the Set match (spellSelectionService
// canonicalizeSpellName), so a print spelling cannot break the
// exclusion.
//
// Mystic Arcanum (L11 6th, L13 7th, L15 8th, L17 9th): Arcanum
// spells are separate from the prepared count and must NOT be
// counted. There is NO Arcanum storage anywhere in the build — no
// column, no field, no picker, no service (only the feature names
// in the levelProgression feature table) — so an Arcanum pick
// recorded anywhere can only ride in the prepared_spells column,
// and the validator excludes it BY CATALOG SPELL LEVEL, not by
// name-guessing: a 6th/7th/8th/9th-level spell in the list is
// excluded, at most one per unlocked tier. This is deterministic:
// warlock pact slots cap at 5th level (WARLOCK_SPELL_SLOTS, max
// level 5), so a 6th+ spell in a warlock's prepared list is
// definitionally an Arcanum spell (or invalid data). Fail-closed:
// a 6th+ spell BEFORE its tier unlocks counts; a second spell of
// the same Arcanum tier counts; a spell missing from the catalog
// (unknown level) counts. When Arcanum storage is eventually built,
// this exclusion still holds for lists that include the picks.
//
// Multiclass-into-warlock is never blocked on the other class's
// stored list: the route gates are primary-warlock only (PUT) and
// leveling-up-IN-warlock only (level-up), the same pattern as the
// artificer / blackguard / paladin / sorcerer / ranger validators.
//
// The validator never trims, never silently fixes: it returns
// { max, counted, ok, over } and the route refuses with a
// field-named 400.
import {
  WARLOCK_SPELL_SLOTS,
  WARLOCK_SPELLS_PREPARED,
} from '../config/levelProgression.js';
import { canonicalizeSpellName } from './spellSelectionService.js';
import { SPELL_DATA_ENTRIES } from '../data/spellCatalogData.js';

// Contact Patron (warlock L9): always have Contact Other Plane
// prepared. Class feature, not subclass — every patron.
export const CONTACT_OTHER_PLANE = 'Contact Other Plane';

// Mystic Arcanum tiers: the spell level granted at each warlock
// level. One Arcanum spell per tier, chosen when the tier unlocks.
const MYSTIC_ARCANUM_TIERS = [
  { minLevel: 11, spellLevel: 6 },
  { minLevel: 13, spellLevel: 7 },
  { minLevel: 15, spellLevel: 8 },
  { minLevel: 17, spellLevel: 9 },
];

function clampLevel(level) {
  const l = Number(level);
  if (!Number.isFinite(l)) return 1;
  return Math.min(20, Math.max(1, Math.trunc(l)));
}

export function spellSlotsForLevel(level) {
  return WARLOCK_SPELL_SLOTS[clampLevel(level)] || {};
}

// Table rule (2024 PHB, Warlock Features table): the prepared cap
// is the Prepared Spells column — 2 at L1, 6 at L5, 15 at L20 — at
// every level, and does not depend on the Cha modifier. chaMod is
// accepted (callers pass it) and ignored. Warlocks have pact slots
// at every level 1-20, so there is no slot gate here.
export function preparedSpellsMax(chaMod, level) {
  void chaMod;
  return WARLOCK_SPELLS_PREPARED[clampLevel(level) - 1];
}

// Single source for PUT / level-up callers: every spell a warlock
// always has prepared at this level — Contact Other Plane from
// Contact Patron (L9+), nothing before that. Patron spells are
// added-to-list, NOT always prepared, so they are never in this list.
export function warlockAlwaysPreparedSpells(level) {
  return clampLevel(level) >= 9 ? [CONTACT_OTHER_PLANE] : [];
}

// Catalog level of a spell name, or null when the catalog does not
// know the name. Names are canonicalized first (aliases + casing),
// the same normalization the always-prepared Set match uses.
function catalogSpellLevel(spellName) {
  const entry = SPELL_DATA_ENTRIES[canonicalizeSpellName(spellName)];
  const level = entry?.level;
  return typeof level === 'number' ? level : null;
}

export function validatePreparedSpells(chaMod, level, preparedList, alwaysPreparedList) {
  const max = preparedSpellsMax(chaMod, level);
  const lvl = clampLevel(level);
  const always = new Set((alwaysPreparedList || []).map((sp) => canonicalizeSpellName(sp)));
  // Class-level grant: Contact Other Plane never counts at L9+,
  // even if the caller passed no alwaysPreparedList at all.
  if (lvl >= 9) always.add(canonicalizeSpellName(CONTACT_OTHER_PLANE));
  // Mystic Arcanum: one spell per unlocked tier is excluded, by
  // catalog spell level. A 6th+ spell whose tier has NOT unlocked
  // yet is not an Arcanum spell — it counts (fail-closed).
  const arcanumUsed = new Set();
  const counted = (preparedList || []).filter((sp) => {
    if (always.has(canonicalizeSpellName(sp))) return false;
    const spellLevel = catalogSpellLevel(sp);
    if (spellLevel !== null && spellLevel >= 6 && spellLevel <= 9) {
      const tier = MYSTIC_ARCANUM_TIERS.find((t) => t.spellLevel === spellLevel);
      if (tier && lvl >= tier.minLevel && !arcanumUsed.has(spellLevel)) {
        arcanumUsed.add(spellLevel);
        return false;
      }
    }
    return true;
  });
  return { max, counted: counted.length, ok: counted.length <= max, over: Math.max(0, counted.length - max) };
}

export default {
  CONTACT_OTHER_PLANE,
  spellSlotsForLevel,
  preparedSpellsMax,
  validatePreparedSpells,
  warlockAlwaysPreparedSpells,
};
