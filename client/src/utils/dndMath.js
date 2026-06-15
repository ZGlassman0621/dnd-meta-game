/**
 * Shared D&D 5e math for the client — single source of truth for the small
 * rules calculations that were copy-pasted across components (ability modifier
 * appeared 15+ times). Mirrors server/utils/dndMath.js for valid inputs.
 *
 * abilityModifier() reproduces the dominant client formula
 *   Math.floor((score - 10) / 2)
 * byte-for-byte, so existing `getModifier`/`mod` helpers can adopt it without
 * any behavior change. (The server copy guards missing scores as 10; for any
 * valid ability score the two agree.)
 */

/**
 * D&D 5e ability modifier from a raw score.
 * @param {number} score
 * @returns {number}
 */
export function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Format a modifier for display: 3 -> "+3", -1 -> "-1", 0 -> "+0".
 * @param {number} mod
 * @returns {string}
 */
export function formatModifier(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Authoritative 5e proficiency bonus by character level (1-20), epic via formula. */
export const PROFICIENCY_BONUS = {
  1: 2, 2: 2, 3: 2, 4: 2,
  5: 3, 6: 3, 7: 3, 8: 3,
  9: 4, 10: 4, 11: 4, 12: 4,
  13: 5, 14: 5, 15: 5, 16: 5,
  17: 6, 18: 6, 19: 6, 20: 6
};

/**
 * Proficiency bonus for a level. Matches the table for 1-20 and the classic
 * ceil(level/4)+1 elsewhere.
 * @param {number} level
 * @returns {number}
 */
export function proficiencyBonus(level) {
  const lvl = Number(level) || 1;
  return PROFICIENCY_BONUS[lvl] ?? (Math.ceil(lvl / 4) + 1);
}

export default { abilityModifier, formatModifier, proficiencyBonus, PROFICIENCY_BONUS };
