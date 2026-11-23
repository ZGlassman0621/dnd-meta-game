/**
 * Cleric class service — prepared-spell validation ONLY (mechanics
 * hooks Family 3, 2026-11-09, staged — NOT pushed, NOT gated).
 *
 * 2024 PHB rule (H3, Zach 2026-11-12; corrected 2026-11-23): a cleric
 * prepares the number in the Cleric Features table's Prepared Spells
 * column — 4 at L1 -> 22 at L20 (BARD_CLERIC_DRUID_SPELLS_PREPARED
 * in server/config/levelProgression.js), the same at every Wisdom
 * modifier. The 2014 formula (Wis mod + cleric level) is retired.
 * This agrees with getSpellsPrepared's cleric arm at every level and
 * modifier (tests/h2-h3-2024-rules.test.js). Zach's physical-book check at the gate
 * remains the final word (the cleric domain lists are gateCheck
 * in the registry).
 *
 * Domain spells are ALWAYS PREPARED and never count against the
 * cap. The always-prepared list is NOT computed here: the caller
 * (routes/character.js PUT + level-up blocks) reads it from
 * `subclassService.clericDomainSpellsAtLevel`, exactly as the
 * paladin block reads `paladinOathSpellsAtLevel`. This service
 * only enforces the cap against a caller-supplied list.
 *
 * Signature follows the paladin/bard/blackguard validators —
 * (mod, level, preparedList, alwaysPreparedList), mod FIRST —
 * NOT the artificer order (level first, mod last). Callers must
 * not mix the two orders.
 */
import { BARD_CLERIC_DRUID_SPELLS_PREPARED } from '../config/levelProgression.js';

// 2024 PHB table: the Prepared Spells column. wisMod is accepted
// (callers pass it) and ignored — the cap is mod-independent.
export function preparedSpellsMax(wisMod, clericLevel) {
  void wisMod;
  const level = Math.min(20, Math.max(1, Math.trunc(clericLevel) || 1));
  return BARD_CLERIC_DRUID_SPELLS_PREPARED[level - 1];
}

export function validatePreparedSpells(wisMod, level, preparedList, alwaysPreparedList) {
  const max = preparedSpellsMax(wisMod, level);
  // Case-insensitive match (2026-11-06, item 13): same insurance as
  // the blackguard/paladin/artificer validators — an always-prepared
  // name typed in a different case than the data must still be
  // excluded.
  const norm = (s) => String(s || '').trim().toLowerCase();
  const always = new Set((alwaysPreparedList || []).map(norm));
  const counted = (preparedList || []).filter((sp) => !always.has(norm(sp)));
  return { max, counted: counted.length, ok: counted.length <= max, over: Math.max(0, counted.length - max) };
}

export default {
  preparedSpellsMax,
  validatePreparedSpells,
};
