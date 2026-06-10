/**
 * Shared D&D 5e math — the single source of truth for the small rules
 * calculations that were copy-pasted across the server (and mirrored on the
 * client in client/src/utils/dndMath.js).
 *
 * The authoritative TABLES (proficiency bonus, hit dice, spell slots, XP) already
 * live in server/config/levelProgression.js; this module re-exports the ones used
 * for ad-hoc math and adds the pure per-value helpers that levelProgression does
 * not provide — chiefly abilityModifier(), which had 15+ scattered copies.
 *
 * abilityModifier() reproduces the dominant server formula
 *   Math.floor(((Number(score) || 10) - 10) / 2)
 * byte-for-byte, so existing call sites can adopt it without behavior change.
 */

import { PROFICIENCY_BONUS, HIT_DICE } from '../config/levelProgression.js';

export { PROFICIENCY_BONUS, HIT_DICE };

/**
 * D&D 5e ability modifier. Defensive against missing/invalid scores exactly the
 * way the server's character/gameState helpers were: a falsy/non-numeric score
 * is treated as 10 (modifier 0).
 * @param {number|string} score
 * @returns {number}
 */
export function abilityModifier(score) {
  return Math.floor(((Number(score) || 10) - 10) / 2);
}

/**
 * Format a modifier for display, e.g. 3 -> "+3", -1 -> "-1".
 * @param {number} mod
 * @returns {string}
 */
export function formatModifier(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Proficiency bonus for a character level (1-20) via the authoritative table,
 * with the standard ceil(level/4)+1 fallback for out-of-table levels (epic).
 * Identical to the table for all valid 5e levels.
 * @param {number} level
 * @returns {number}
 */
export function proficiencyBonus(level) {
  const lvl = Number(level) || 1;
  return PROFICIENCY_BONUS[lvl] ?? (Math.ceil(lvl / 4) + 1);
}

/**
 * Hit die size for a class (defaults to 8 for unknown classes — matches the
 * `HIT_DICE[class] || 8` pattern used throughout the codebase).
 * @param {string} className
 * @returns {number}
 */
export function hitDieFor(className) {
  return HIT_DICE[String(className || '').toLowerCase()] || 8;
}

/**
 * Spell save DC = 8 + ability modifier + proficiency bonus.
 * @param {number} abilityScore
 * @param {number} level
 * @returns {number}
 */
export function spellSaveDC(abilityScore, level) {
  return 8 + abilityModifier(abilityScore) + proficiencyBonus(level);
}

/**
 * Spell attack bonus = ability modifier + proficiency bonus.
 * @param {number} abilityScore
 * @param {number} level
 * @returns {number}
 */
export function spellAttackBonus(abilityScore, level) {
  return abilityModifier(abilityScore) + proficiencyBonus(level);
}

export default {
  abilityModifier,
  formatModifier,
  proficiencyBonus,
  hitDieFor,
  spellSaveDC,
  spellAttackBonus,
  PROFICIENCY_BONUS,
  HIT_DICE
};
