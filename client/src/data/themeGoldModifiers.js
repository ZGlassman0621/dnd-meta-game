/**
 * Per-theme starting gold modifiers — applied to class baseline.
 *
 * Stored as decimal multipliers (e.g., +0.50 = +50%). Range: −0.50 (Urchin)
 * to +0.50 (Noble). Per PHASE_2_CREATOR_SPEC.md §7.1.3.
 *
 * Calculation (per §7.1.4):
 *   final_gold = round(class_baseline_gp × (1 + theme_modifier))
 *
 * Round to nearest integer gp; ties round up (standard half-up rounding).
 * The display layer (Step 6, §5.6.5) is responsible for the parenthetical
 * format and minus-glyph rendering.
 */

export const THEME_GOLD_MODIFIERS = {
  // Wealthy / well-supported on departure
  noble: 0.50,
  charlatan: 0.30,
  guild_artisan: 0.25,

  // Modestly resourced
  knight_of_the_order: 0.15,
  sage: 0.10,
  investigator: 0.10,
  clan_crafter: 0.10,
  entertainer: 0.05,

  // Baseline (departing with what's owed and nothing more)
  folk_hero: 0.00,
  soldier: 0.00,
  sailor: 0.00,
  city_watch: 0.00,
  mercenary_veteran: 0.00,
  far_traveler: 0.00,

  // Departing with less than baseline
  acolyte: -0.05,
  urban_bounty_hunter: -0.10,
  outlander: -0.15,
  haunted_one: -0.20,
  criminal: -0.25,
  hermit: -0.35,
  urchin: -0.50
};

/**
 * Apply a theme's modifier to a class baseline. Returns the integer gp.
 * Uses standard half-up rounding (Math.round in JS rounds half toward
 * +Infinity for positive numbers, which matches the spec's ties-up rule).
 */
export function applyGoldModifier(baselineGp, themeId) {
  const modifier = THEME_GOLD_MODIFIERS[themeId] ?? 0;
  return Math.round(baselineGp * (1 + modifier));
}
