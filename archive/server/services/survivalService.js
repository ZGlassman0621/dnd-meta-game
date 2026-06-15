/**
 * Survival Mechanics Service
 *
 * Manages hunger, thirst, food spoilage, and exposure effects
 * following D&D 5e rules (PHB pp. 185-186).
 *
 * Rules summary:
 * - 1 lb food + 1 gallon water per day
 * - Starvation: survive 3 + CON mod days (min 1) without food, then 1 exhaustion/day
 * - Dehydration: 1 exhaustion/day without water; 2 if already dehydrated
 * - Half water: CON DC 15 save or 1 exhaustion
 * - Hot weather doubles water needs
 * - Foraging: Wisdom (Survival) check, DC varies by terrain
 */

import { dbGet, dbRun } from '../database.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { registerThresholdConsumer, daysSince } from './timeBoundedState.js';
// safeParse is defined locally below (line ~41); no import needed.

/**
 * Phase 3 SC-6.4 — survival cluster marker handlers register at module
 * load (this file is imported by routes/dmSession.js + routes/character.js,
 * so handlers wire up on server boot regardless of load order).
 *
 * Handlers do their side effect AND return the event object the route
 * handler used to push into `survivalEvents` — preserves the existing
 * response shape (client uses `survivalEvents.length > 0` as a refresh
 * trigger via DMSession.jsx:869). Route handler reads handlerResults
 * after `processResponseMarkers` and assembles survivalEvents from the
 * returned event objects.
 */

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Safely parse a JSON string with fallback.
 * Prevents crashes from corrupted or missing DB data.
 */
function safeParse(json, defaultVal) {
  if (json === null || json === undefined) return defaultVal;
  try {
    return JSON.parse(json);
  } catch {
    return defaultVal;
  }
}

/**
 * Extract CON modifier from character's ability_scores JSON.
 * Standard D&D formula: floor((score - 10) / 2)
 */
function getConMod(character) {
  const scores = safeParse(character.ability_scores, { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const con = scores.con || 10;
  return Math.floor((con - 10) / 2);
}

/**
 * Food-keyword matching for inventory items.
 * Matches by category or common food name patterns.
 */
const FOOD_KEYWORDS = ['rations', 'bread', 'meat', 'cheese', 'fruit', 'jerky', 'dried', 'preserved'];

function isFoodItem(item) {
  if (item.category === 'food') return true;
  const name = (item.name || '').toLowerCase();
  return FOOD_KEYWORDS.some(kw => name.includes(kw));
}

/**
 * Water-keyword matching for inventory items.
 */
const WATER_KEYWORDS = ['waterskin', 'water', 'flask of water'];

function isWaterItem(item) {
  if (item.category === 'water') return true;
  const name = (item.name || '').toLowerCase();
  return WATER_KEYWORDS.some(kw => name.includes(kw));
}

/**
 * Count total food-item servings in inventory.
 * Each item's quantity represents days of food.
 */
function countFoodItems(inventory) {
  return inventory
    .filter(i => isFoodItem(i) && !i.name.toLowerCase().startsWith('spoiled'))
    .reduce((sum, i) => sum + (i.quantity || 1), 0);
}

/**
 * Count total water-item servings in inventory.
 */
function countWaterItems(inventory) {
  return inventory
    .filter(i => isWaterItem(i))
    .reduce((sum, i) => sum + (i.quantity || 1), 0);
}

// ============================================================
// FOOD SPOILAGE
// ============================================================

/**
 * Check perishable food items for spoilage.
 *
 * Items with `perishable: true` and `acquired_game_day` set are evaluated
 * against their `spoils_in_days` threshold (default 3). Heat waves halve
 * the spoilage window.
 *
 * @param {Array} inventory - Character's inventory array
 * @param {number} currentGameDay - Current in-game day number
 * @param {string} weatherType - Current weather type key (e.g., 'heat_wave')
 * @returns {{ spoiled: string[], updated_inventory: Array }}
 */
export function checkFoodSpoilage(inventory, currentGameDay, weatherType) {
  const spoiled = [];
  const updated = inventory.map(item => {
    // Only check perishable items with a known acquisition day
    if (!item.perishable || item.acquired_game_day == null) return item;

    // Already spoiled — skip
    if ((item.name || '').toLowerCase().startsWith('spoiled')) return item;

    let threshold = item.spoils_in_days || 3;

    // Heat wave halves spoilage time
    if (weatherType === 'heat_wave') {
      threshold = Math.floor(threshold / 2);
    }
    // Minimum 1 day before spoiling
    threshold = Math.max(threshold, 1);

    const daysSinceAcquired = currentGameDay - item.acquired_game_day;
    if (daysSinceAcquired >= threshold) {
      spoiled.push(item.name);
      return {
        ...item,
        name: `Spoiled ${item.name}`,
        category: 'junk'
      };
    }

    return item;
  });

  return { spoiled, updated_inventory: updated };
}

// ============================================================
// SURVIVAL INTENSITY (Phase 3.3 SC-7.6.5 — player-tunable difficulty)
// ============================================================
//
// Per spec §3.3.10. Four-position character-level setting:
//   'off'      — survival mechanics disabled; consumers short-circuit
//   'lenient'  — extended thresholds, lighter weather modulation
//   'standard' — SC-7.6 baseline (default for all existing characters)
//   'strict'   — tighter thresholds, harsher weather modulation
//
// Read at decay/threshold evaluation time (not at consumer registration);
// player can change setting mid-campaign without rebuilding consumers.
//
// Off short-circuits via null anchor in `repository.readAnchor` —
// threshold consumer's null-anchor branch returns `{fired: false,
// reason: 'no_anchor'}`. No special-casing inside handlers is needed.

const VALID_INTENSITIES = Object.freeze(['off', 'lenient', 'standard', 'strict']);

// Per-mechanic threshold offsets per intensity. Hunger value is added to
// CON modifier (e.g., Standard at 3 + CON mod). Dehydration value is
// the kick-in day count (e.g., Standard at 1 day without water).
const INTENSITY_THRESHOLDS = Object.freeze({
  starvation: Object.freeze({
    off: null,
    lenient: 6,
    standard: 3,
    strict: 2
  }),
  dehydration: Object.freeze({
    off: null,
    lenient: 3,
    standard: 1,
    strict: 1
  })
});

// Hot-weather multiplier — applied to raw days for the dehydration
// effective-elapsed calculation. Off is unused (consumer short-circuits).
const INTENSITY_HOT_MULTIPLIERS = Object.freeze({
  off: 1.0,
  lenient: 1.5,
  standard: 2.0,
  strict: 3.0
});

// Cold-weather multiplier — Strict-only addition per spec §3.3.10.
// All other intensities pass cold weather through at 1.0×.
const INTENSITY_COLD_MULTIPLIERS = Object.freeze({
  off: 1.0,
  lenient: 1.0,
  standard: 1.0,
  strict: 1.5
});

// Per-tier exhaustion magnitude for dehydration. SC-7.6 baseline
// (Standard) was: tier 1 = 1 level, tier 2 (effective_days >= 2) = 2
// levels. SC-7.6.5 extends per intensity:
//   - Lenient: tier 1 = 1, tier 2 = 1 (capped — Lenient shouldn't escalate)
//   - Standard: tier 1 = 1, tier 2 = 2 (preserves SC-7.6 behavior exactly)
//   - Strict: tier 1 = 2, tier 2 = 2 (immediate severe-tier on day 1)
//
// Strict's "kick into severe immediately" combined with its 3.0× hot
// multiplier means a single hot day without water = 2 raw effective ×
// 3.0 = 6 effective days = severe tier with magnitude 2. Lenient with
// 1.5× hot means 1 raw day in hot = 1.5 effective < 2, magnitude 1.
//
// PM call open: spec §3.3.10 says "Strict raises rate from 1 level/day
// to 2 levels/day past threshold." This binary-tier model interpretation
// keeps magnitudes reasonable. If a different magnitude curve is wanted,
// surface back to PM.
const INTENSITY_DEHYDRATION_MAGNITUDE = Object.freeze({
  off: Object.freeze({ tier1: 0, tier2: 0 }),  // unused; consumer short-circuits
  lenient: Object.freeze({ tier1: 1, tier2: 1 }),
  standard: Object.freeze({ tier1: 1, tier2: 2 }),
  strict: Object.freeze({ tier1: 2, tier2: 2 })
});

function getSurvivalIntensity(character) {
  const v = character?.survival_intensity || 'standard';
  return VALID_INTENSITIES.includes(v) ? v : 'standard';
}

// ============================================================
// PATTERN D HELPERS (Phase 3.3 SC-7.6 — anchor-based + column fallback)
// ============================================================
//
// Pre-SC-7.6: `days_without_food` and `days_without_water` columns were
// the source of truth, incremented by processDayChange daily. Anchor
// columns (`last_meal_game_day`, `last_drink_game_day`) were set on eat
// /drink events but not the source of truth for elapsed-time queries.
//
// Post-SC-7.6: anchors are the source of truth. Counter columns become
// vestigial (still written by eat/drink as a denormalized cache; no
// longer written by processDayChange). Helpers compute elapsed time from
// the anchor when set, falling back to the column for legacy data.
//
// The fallback chain bridges existing characters with `anchor=null` and
// `column=N` (legacy never-eaten state). Synthetic anchor =
// `game_day - column_value` reproduces legacy elapsed-time semantics
// without touching schema.

function daysSinceLastMeal(character, currentGameDay) {
  if (character.last_meal_game_day != null) {
    return daysSince(character.last_meal_game_day, currentGameDay) ?? 0;
  }
  // Legacy fallback: anchor null, use the counter column directly.
  return character.days_without_food || 0;
}

function daysSinceLastDrink(character, currentGameDay) {
  if (character.last_drink_game_day != null) {
    return daysSince(character.last_drink_game_day, currentGameDay) ?? 0;
  }
  return character.days_without_water || 0;
}

function isHotWeather(weather) {
  if (!weather) return false;
  return weather.type === 'heat_wave'
    || weather.weather_type === 'heat_wave'
    || (typeof weather.temperature_f === 'number' && weather.temperature_f > 85);
}

// Phase 3.3 SC-7.6.5 — cold-weather detection for Strict-only multiplier.
// Detects via weather_type ('blizzard', 'snow') OR temperature_f < 32.
function isColdWeather(weather) {
  if (!weather) return false;
  return weather.type === 'blizzard'
    || weather.weather_type === 'blizzard'
    || weather.type === 'snow'
    || weather.weather_type === 'snow'
    || (typeof weather.temperature_f === 'number' && weather.temperature_f < 32);
}

// Synthetic anchor used by readAnchor callbacks below. Returns the
// effective last-meal/drink day for either anchored OR legacy-column
// data. Returns null only when both are absent.
function effectiveLastMealAnchor(character) {
  if (character.last_meal_game_day != null) return character.last_meal_game_day;
  const col = character.days_without_food;
  if (col != null && col > 0 && character.game_day != null) {
    return character.game_day - col;
  }
  return null;
}

function effectiveLastDrinkAnchor(character) {
  if (character.last_drink_game_day != null) return character.last_drink_game_day;
  const col = character.days_without_water;
  if (col != null && col > 0 && character.game_day != null) {
    return character.game_day - col;
  }
  return null;
}

// ============================================================
// STARVATION CHECK (D&D 5e PHB p.185)
// ============================================================
//
// **Phase 3.3 SC-7.6 migration**: `STARVATION_THRESHOLD_CONSUMER` below
// owns the elapsed-vs-threshold check; `checkStarvation` becomes a thin
// pure-function wrapper that invokes the consumer and translates its
// status report into the legacy return shape (back-compat for
// processDayChange + tests).
//
// Variable threshold (per-character: 3 + CON mod, min 1) absorbed into
// the consumer's `repository.readAnchor` derivation: anchor =
// last_meal_game_day + threshold_days. The consumer's `threshold: 1`
// fires one day past the effective starvation day.

const STARVATION_THRESHOLD_CONSUMER = registerThresholdConsumer({
  name: 'starvation',
  threshold: 1,
  handler: async (contextKey, daysElapsed) => {
    return {
      starving: true,
      hungry: true,
      exhaustion_level: 1,
      overDays: daysElapsed,
      daysWithout: contextKey.daysWithout,
      thresholdDays: contextKey.thresholdDays,
      message: `Going without food for ${contextKey.daysWithout} days (threshold: ${contextKey.thresholdDays}). Gaining 1 level of exhaustion. (${daysElapsed} day${daysElapsed > 1 ? 's' : ''} past limit)`
    };
  },
  idempotency: {
    // Re-emit every tick — no fired-once semantics. Each day past the
    // threshold the DM/UI gets a fresh status report. No DB state mutated
    // by the handler (status is reported, not persisted).
    async hasFiredRecently() { return false; },
    async recordFired() {}
  },
  repository: {
    async readAnchor(contextKey) {
      const c = contextKey.character;
      // Phase 3.3 SC-7.6.5: intensity read at evaluation time. Off
      // short-circuits via null anchor (per spec §3.3.10).
      const intensity = getSurvivalIntensity(c);
      if (intensity === 'off') return null;
      const lastMeal = effectiveLastMealAnchor(c);
      if (lastMeal == null) return null;
      const conMod = getConMod(c);
      const baseThreshold = INTENSITY_THRESHOLDS.starvation[intensity];
      // baseThreshold is non-null for non-Off (guarded above).
      const thresholdDays = Math.max(baseThreshold + conMod, 1);
      return lastMeal + thresholdDays;
    }
  }
});

/**
 * Evaluate starvation status per D&D 5e rules.
 *
 * A character can go without food for 3 + CON modifier days (minimum 1).
 * After that, they gain 1 level of exhaustion per additional day.
 * A normal day of eating resets the counter.
 *
 * Phase 3.3 SC-7.6: delegates to STARVATION_THRESHOLD_CONSUMER for the
 * elapsed-vs-threshold check. Pure async wrapper around the consumer
 * for back-compat with existing callers (processDayChange, tests).
 *
 * @param {object} character - Character row from DB
 * @param {number} [currentGameDay] - Current game day (defaults to character.game_day)
 * @returns {{ starving: boolean, hungry: boolean, exhaustion_level?: number, days_remaining?: number, daysWithout?: number, thresholdDays?: number, message: string }}
 */
export async function checkStarvation(character, currentGameDay) {
  const intensity = getSurvivalIntensity(character);
  // Phase 3.3 SC-7.6.5: 'off' disables starvation entirely (consumer also
  // short-circuits via null anchor; wrapper short-circuit gives the
  // no-effect status without traversing the consumer at all).
  if (intensity === 'off') {
    return { starving: false, hungry: false, daysWithout: 0, thresholdDays: 0, intensity, message: '' };
  }

  const day = currentGameDay ?? character.game_day ?? 0;
  const conMod = getConMod(character);
  const baseThreshold = INTENSITY_THRESHOLDS.starvation[intensity];
  const thresholdDays = Math.max(baseThreshold + conMod, 1);
  const daysWithout = daysSinceLastMeal(character, day);

  // Hungry-but-not-starving status — returned without invoking the
  // threshold consumer because there's no fire condition yet.
  if (daysWithout > 0 && daysWithout <= thresholdDays) {
    const remaining = thresholdDays - daysWithout;
    return {
      starving: false,
      hungry: true,
      days_remaining: remaining,
      daysWithout,
      thresholdDays,
      intensity,
      message: `Hungry for ${daysWithout} day${daysWithout > 1 ? 's' : ''}. Can endure ${remaining} more day${remaining > 1 ? 's' : ''} before exhaustion sets in.`
    };
  }

  if (daysWithout === 0) {
    return { starving: false, hungry: false, daysWithout: 0, thresholdDays, intensity, message: '' };
  }

  // Past threshold — delegate to the threshold consumer for the fire path.
  const result = await STARVATION_THRESHOLD_CONSUMER.checkAndFire(
    { character, daysWithout, thresholdDays },
    day
  );
  if (result.fired && result.handlerResult) {
    return { ...result.handlerResult, intensity };
  }
  // Threshold consumer didn't fire (defensive — shouldn't happen given the
  // daysWithout > thresholdDays gate above). Return safe default.
  return { starving: false, hungry: true, daysWithout, thresholdDays, intensity, message: '' };
}

// ============================================================
// DEHYDRATION CHECK (D&D 5e PHB p.185)
// ============================================================
//
// **Phase 3.3 SC-7.6 migration + weather-modulation bug fix
// (fix-along-the-way #4)**:
//
// Pre-SC-7.6, the legacy `checkDehydration` had a documented behavior
// "Hot weather doubles water needs — 0.5 days without water counts as
// a full day" but the actual implementation only added a string to the
// message — exhaustion levels didn't accelerate. Discovered in Pattern D
// survey (§1.6.1, 2026-05-04). PM ruling 2026-05-05: implement the
// doubling.
//
// Post-SC-7.6: `DEHYDRATION_THRESHOLD_CONSUMER` fires from day 1 onward
// (raw days). Handler reads `hint.weather` to compute effective elapsed:
// `effective = raw * (hot ? 2 : 1)`. Exhaustion levels:
//   effective < 2: 1 level
//   effective >= 2: 2 levels (already-dehydrated tier)
// Hot weather skips the 1-level tier on day 1 → 2 levels immediately
// (1 raw day × 2 = 2 effective days = severe dehydration).
//
// This is fix-along-the-way #4 in Phase 3 (after SC-6.4 notoriety silent-
// drop + SC-7.3 NPC absence ×2). Documented in DECISION_LOG.

const DEHYDRATION_THRESHOLD_CONSUMER = registerThresholdConsumer({
  name: 'dehydration',
  threshold: 1,  // 1 day past intensity-adjusted anchor → fire
  handler: async (contextKey, daysElapsed, hints) => {
    const intensity = getSurvivalIntensity(contextKey.character);
    const hot = isHotWeather(hints?.weather);
    const cold = isColdWeather(hints?.weather);
    const hotMult = INTENSITY_HOT_MULTIPLIERS[intensity];
    const coldMult = INTENSITY_COLD_MULTIPLIERS[intensity];
    // Hot and cold are mutually exclusive (hot = heat_wave/>85F; cold =
    // blizzard/snow/<32F). Apply whichever applies; default 1.0×.
    const weatherMult = hot ? hotMult : (cold ? coldMult : 1.0);
    const effectiveDays = daysElapsed * weatherMult;
    const tier = effectiveDays >= 2 ? 'tier2' : 'tier1';
    const exhaustionLevels = INTENSITY_DEHYDRATION_MAGNITUDE[intensity][tier];

    const baseMsg = `No water for ${daysElapsed} day${daysElapsed > 1 ? 's' : ''}. Gaining ${exhaustionLevels} level${exhaustionLevels > 1 ? 's' : ''} of exhaustion.`;
    let weatherMsg = '';
    if (hot && hotMult > 1.0) {
      // Standard preserves SC-7.6's exact phrasing (byte-identity).
      weatherMsg = intensity === 'standard'
        ? ' Hot conditions DOUBLE water needs — effective rate is 2x.'
        : ` Hot conditions multiply water needs (${hotMult}x).`;
    } else if (cold && coldMult > 1.0) {
      weatherMsg = ` Cold conditions multiply water needs (${coldMult}x).`;
    }

    // `cold` reported only when it actually modulates (Strict-only currently)
    // — preserves SC-7.6 response shape for Standard (cold field stays false).
    return {
      dehydrated: true,
      exhaustion_levels: exhaustionLevels,
      raw_days: daysElapsed,
      effective_days: effectiveDays,
      hot,
      cold: cold && coldMult > 1.0,
      intensity,
      message: baseMsg + weatherMsg
    };
  },
  idempotency: {
    async hasFiredRecently() { return false; },  // re-emit every tick
    async recordFired() {}
  },
  repository: {
    async readAnchor(contextKey) {
      const c = contextKey.character;
      // Phase 3.3 SC-7.6.5: intensity read at evaluation time.
      // Off short-circuits via null anchor.
      const intensity = getSurvivalIntensity(c);
      if (intensity === 'off') return null;
      const lastDrink = effectiveLastDrinkAnchor(c);
      if (lastDrink == null) return null;
      // Kick-in days vary by intensity (Lenient: 3, Standard/Strict: 1).
      // Threshold is fixed at 1; we shift the anchor so the consumer
      // fires on day (lastDrink + kick_in_days).
      const kickInDays = INTENSITY_THRESHOLDS.dehydration[intensity];
      return lastDrink + (kickInDays - 1);
    }
  }
});

/**
 * Evaluate dehydration status per D&D 5e rules.
 *
 * Without water: 1 level of exhaustion per day.
 * If already dehydrated (days_without_water >= 2): gain 2 levels instead.
 * Hot weather (heat_wave or temp > 85) doubles water needs — 1 raw day
 * in hot conditions = 2 effective days = severe-tier exhaustion immediately.
 *
 * Phase 3.3 SC-7.6: delegates to DEHYDRATION_THRESHOLD_CONSUMER. Weather
 * modulation now actually accelerates exhaustion (was just a message
 * string pre-fix-along-the-way #4).
 *
 * @param {object} character - Character row from DB
 * @param {object} weather - Weather object with type and temperature_f
 * @param {number} [currentGameDay] - Current game day (defaults to character.game_day)
 * @returns {{ dehydrated: boolean, exhaustion_levels: number, raw_days?: number, effective_days?: number, hot?: boolean, message: string }}
 */
export async function checkDehydration(character, weather, currentGameDay) {
  const intensity = getSurvivalIntensity(character);
  // Phase 3.3 SC-7.6.5: 'off' disables dehydration entirely.
  if (intensity === 'off') {
    return { dehydrated: false, exhaustion_levels: 0, intensity, message: '' };
  }

  const day = currentGameDay ?? character.game_day ?? 0;
  const daysWithout = daysSinceLastDrink(character, day);

  if (daysWithout < 1) {
    return { dehydrated: false, exhaustion_levels: 0, intensity, message: '' };
  }

  const result = await DEHYDRATION_THRESHOLD_CONSUMER.checkAndFire(
    { character },
    day,
    { weather }
  );
  if (result.fired && result.handlerResult) {
    return result.handlerResult;
  }
  // Below intensity-adjusted kick-in (e.g., Lenient day 1-2). Not yet
  // dehydrated mechanically; return non-effect with intensity for callers.
  return { dehydrated: false, exhaustion_levels: 0, intensity, message: '' };
}

// Exports for direct test access.
export { STARVATION_THRESHOLD_CONSUMER, DEHYDRATION_THRESHOLD_CONSUMER };

// ============================================================
// CORE DAY CHANGE PROCESSOR
// ============================================================

/**
 * Core survival tick — called when a game day advances.
 *
 * Checks food spoilage, increments hunger/thirst counters if the
 * character hasn't eaten or drunk today, evaluates starvation and
 * dehydration effects, and persists updates to the database.
 *
 * @param {number} characterId - Character's DB id
 * @param {number} currentGameDay - The new game day number
 * @param {object} weather - Weather object with type and temperature_f
 * @returns {{ food_spoiled: string[], hunger_status: object, thirst_status: object, effects_applied: string[], warnings: string[] }}
 */
export async function processDayChange(characterId, currentGameDay, weather) {
  const character = await dbGet(
    'SELECT * FROM characters WHERE id = ?', [characterId]
  );
  if (!character) {
    return { food_spoiled: [], hunger_status: {}, thirst_status: {}, effects_applied: [], warnings: ['Character not found'] };
  }

  const inventory = safeParse(character.inventory, []);
  const weatherType = weather?.type || weather?.weather_type || 'clear';
  const effectsApplied = [];
  const warnings = [];

  // --- Food spoilage ---
  const spoilageResult = checkFoodSpoilage(inventory, currentGameDay, weatherType);
  if (spoilageResult.spoiled.length > 0) {
    warnings.push(`Food spoiled: ${spoilageResult.spoiled.join(', ')}`);
    await dbRun(
      'UPDATE characters SET inventory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(spoilageResult.updated_inventory), characterId]
    );
  }

  // Phase 3.3 SC-7.6: hunger + thirst elapsed time computed from anchor
  // columns (last_meal_game_day, last_drink_game_day) via the
  // daysSinceLastMeal / daysSinceLastDrink helpers. Counter columns are
  // no longer incremented here — they remain as vestigial cache (still
  // reset by eat/drink) for back-compat with code that hasn't migrated yet.
  const daysWithoutFood = daysSinceLastMeal(character, currentGameDay);
  const daysWithoutWater = daysSinceLastDrink(character, currentGameDay);

  // --- Starvation effects ---
  const hungerStatus = await checkStarvation(character, currentGameDay);
  if (hungerStatus.starving) {
    effectsApplied.push(`Starvation: +1 exhaustion (day ${daysWithoutFood})`);
  } else if (hungerStatus.hungry) {
    warnings.push(hungerStatus.message);
  }

  // --- Dehydration effects (with weather modulation per SC-7.6 fix-along-the-way #4) ---
  const thirstStatus = await checkDehydration(character, weather, currentGameDay);
  if (thirstStatus.dehydrated) {
    effectsApplied.push(`Dehydration: +${thirstStatus.exhaustion_levels} exhaustion (day ${daysWithoutWater}${thirstStatus.hot ? ', hot' : ''})`);
  }

  // **No counter-column writes here** (was: UPDATE days_without_food/water).
  // Anchor columns are the source of truth post-SC-7.6; counter columns
  // are vestigial. processDayChange's contribution is now: spoilage,
  // status reporting (effectsApplied), warnings.

  return {
    food_spoiled: spoilageResult.spoiled,
    hunger_status: hungerStatus,
    thirst_status: thirstStatus,
    effects_applied: effectsApplied,
    warnings
  };
}

// ============================================================
// AUTO-CONSUME RATIONS (LONG REST)
// ============================================================

/**
 * Automatically consume food and water during a long rest.
 *
 * Prioritizes perishable food first (eat what spoils soonest), then
 * falls back to non-perishable rations. Decrements quantity and removes
 * empty stacks. Resets hunger/thirst counters on success.
 *
 * @param {number} characterId - Character's DB id
 * @param {number} currentGameDay - Current in-game day number
 * @returns {{ food_consumed: string|null, water_consumed: string|null, no_food: boolean, no_water: boolean }}
 */
export async function autoConsumeRations(characterId, currentGameDay) {
  const character = await dbGet(
    'SELECT inventory, days_without_food, days_without_water FROM characters WHERE id = ?',
    [characterId]
  );
  if (!character) {
    return { food_consumed: null, water_consumed: null, no_food: true, no_water: true };
  }

  let inventory = safeParse(character.inventory, []);
  let foodConsumed = null;
  let waterConsumed = null;

  // --- Consume food ---
  // Filter edible food (not spoiled)
  const foodItems = inventory.filter(i => isFoodItem(i) && !i.name.toLowerCase().startsWith('spoiled'));

  if (foodItems.length > 0) {
    // Prioritize perishable food — eat what spoils soonest
    foodItems.sort((a, b) => {
      const aPerish = a.perishable ? (a.spoils_in_days || 3) - ((currentGameDay - (a.acquired_game_day || 0))) : 9999;
      const bPerish = b.perishable ? (b.spoils_in_days || 3) - ((currentGameDay - (b.acquired_game_day || 0))) : 9999;
      return aPerish - bPerish;
    });

    const chosen = foodItems[0];
    foodConsumed = chosen.name;

    // Decrement quantity in original inventory
    const invItem = inventory.find(i => i.name === chosen.name);
    if (invItem) {
      invItem.quantity = (invItem.quantity || 1) - 1;
      if (invItem.quantity <= 0) {
        inventory = inventory.filter(i => i !== invItem);
      }
    }
  }

  // --- Consume water ---
  const waterItems = inventory.filter(i => isWaterItem(i));

  if (waterItems.length > 0) {
    const chosen = waterItems[0];
    waterConsumed = chosen.name;

    const invItem = inventory.find(i => i.name === chosen.name);
    if (invItem) {
      invItem.quantity = (invItem.quantity || 1) - 1;
      if (invItem.quantity <= 0) {
        inventory = inventory.filter(i => i !== invItem);
      }
    }
  }

  // --- Persist changes ---
  const updates = ['inventory = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [JSON.stringify(inventory)];

  if (foodConsumed) {
    updates.push('days_without_food = 0', 'last_meal_game_day = ?');
    params.push(currentGameDay);
  }

  if (waterConsumed) {
    updates.push('days_without_water = 0', 'last_drink_game_day = ?');
    params.push(currentGameDay);
  }

  params.push(characterId);
  await dbRun(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`, params);

  return {
    food_consumed: foodConsumed,
    water_consumed: waterConsumed,
    no_food: !foodConsumed,
    no_water: !waterConsumed
  };
}

// ============================================================
// MANUAL CONSUME: FOOD
// ============================================================

/**
 * Player manually eats a specific item from inventory.
 *
 * @param {number} characterId - Character's DB id
 * @param {string} itemName - Name of the item to consume (case-insensitive)
 * @param {number} currentGameDay - Current in-game day number
 * @returns {{ consumed: boolean, item?: string, error?: string }}
 */
export async function consumeFood(characterId, itemName, currentGameDay) {
  const character = await dbGet(
    'SELECT inventory FROM characters WHERE id = ?', [characterId]
  );
  if (!character) {
    return { consumed: false, error: 'Character not found' };
  }

  let inventory = safeParse(character.inventory, []);
  const target = inventory.find(i => (i.name || '').toLowerCase() === itemName.toLowerCase());

  if (!target) {
    return { consumed: false, error: 'Item not found' };
  }

  // Decrement quantity
  target.quantity = (target.quantity || 1) - 1;
  if (target.quantity <= 0) {
    inventory = inventory.filter(i => i !== target);
  }

  // Persist inventory + reset hunger
  await dbRun(
    'UPDATE characters SET inventory = ?, days_without_food = 0, last_meal_game_day = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(inventory), currentGameDay, characterId]
  );

  return { consumed: true, item: itemName };
}

// ============================================================
// MANUAL CONSUME: WATER
// ============================================================

/**
 * Player manually drinks a specific item from inventory.
 *
 * @param {number} characterId - Character's DB id
 * @param {string} itemName - Name of the item to consume (case-insensitive)
 * @param {number} currentGameDay - Current in-game day number
 * @returns {{ consumed: boolean, item?: string, error?: string }}
 */
export async function consumeWater(characterId, itemName, currentGameDay) {
  const character = await dbGet(
    'SELECT inventory FROM characters WHERE id = ?', [characterId]
  );
  if (!character) {
    return { consumed: false, error: 'Character not found' };
  }

  let inventory = safeParse(character.inventory, []);
  const target = inventory.find(i => (i.name || '').toLowerCase() === itemName.toLowerCase());

  if (!target) {
    return { consumed: false, error: 'Item not found' };
  }

  // Decrement quantity
  target.quantity = (target.quantity || 1) - 1;
  if (target.quantity <= 0) {
    inventory = inventory.filter(i => i !== target);
  }

  // Persist inventory + reset thirst
  await dbRun(
    'UPDATE characters SET inventory = ?, days_without_water = 0, last_drink_game_day = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(inventory), currentGameDay, characterId]
  );

  return { consumed: true, item: itemName };
}

// ============================================================
// SURVIVAL STATUS SUMMARY
// ============================================================

/**
 * Build a survival status summary for DM prompt injection or UI display.
 *
 * @param {object} character - Character row from DB
 * @param {object} weather - Weather object with type and temperature_f
 * @returns {{ hunger_level: string, thirst_level: string, days_without_food: number, days_without_water: number, food_in_pack: object, water_in_pack: object, starvation_threshold: number, warnings: string[] }}
 */
export function getSurvivalStatus(character, weather) {
  const inventory = safeParse(character.inventory, []);
  const conMod = getConMod(character);
  // Phase 3.3 SC-7.6.5: status threshold reflects per-character intensity.
  // Off → use Standard threshold for display purposes (mechanics are
  // gated separately by checkStarvation/checkDehydration's off branch).
  const intensity = getSurvivalIntensity(character);
  const baseThreshold = INTENSITY_THRESHOLDS.starvation[intensity] ?? INTENSITY_THRESHOLDS.starvation.standard;
  const threshold = Math.max(baseThreshold + conMod, 1);
  // Phase 3.3 SC-7.6: compute from anchor (with column fallback for
  // legacy data). Counter columns are vestigial; helper picks the right
  // source.
  const currentDay = character.game_day || 0;
  const daysWithoutFood = daysSinceLastMeal(character, currentDay);
  const daysWithoutWater = daysSinceLastDrink(character, currentDay);
  const warnings = [];

  // --- Hunger level ---
  let hungerLevel;
  if (daysWithoutFood === 0) {
    hungerLevel = 'fed';
  } else if (daysWithoutFood <= Math.floor(threshold / 2)) {
    hungerLevel = 'hungry';
  } else if (daysWithoutFood <= threshold) {
    hungerLevel = 'starving';
  } else {
    hungerLevel = 'critical';
  }

  // --- Thirst level ---
  let thirstLevel;
  if (daysWithoutWater === 0) {
    thirstLevel = 'hydrated';
  } else if (daysWithoutWater === 1) {
    thirstLevel = 'thirsty';
  } else if (daysWithoutWater === 2) {
    thirstLevel = 'dehydrated';
  } else {
    thirstLevel = 'critical';
  }

  // --- Inventory counts ---
  const foodCount = countFoodItems(inventory);
  const waterCount = countWaterItems(inventory);

  // --- Perishable food warnings (currentDay declared above) ---
  const perishables = inventory
    .filter(i => i.perishable && isFoodItem(i) && !i.name.toLowerCase().startsWith('spoiled'))
    .map(i => {
      const spoilsIn = (i.spoils_in_days || 3) - (currentDay - (i.acquired_game_day || 0));
      return { name: i.name, quantity: i.quantity || 1, days_until_spoiled: Math.max(spoilsIn, 0) };
    })
    .sort((a, b) => a.days_until_spoiled - b.days_until_spoiled);

  // Warnings
  if (foodCount === 0) warnings.push('No food remaining in inventory.');
  else if (foodCount <= 2) warnings.push(`Low food: only ${foodCount} day${foodCount > 1 ? 's' : ''} of rations left.`);

  if (waterCount === 0) warnings.push('No water remaining in inventory.');
  else if (waterCount <= 2) warnings.push(`Low water: only ${waterCount} day${waterCount > 1 ? 's' : ''} of water left.`);

  for (const p of perishables) {
    if (p.days_until_spoiled <= 1) {
      warnings.push(`${p.name} will spoil ${p.days_until_spoiled === 0 ? 'TODAY' : 'tomorrow'}!`);
    }
  }

  if (hungerLevel === 'critical') warnings.push('CRITICAL: Starvation exhaustion is accumulating!');
  if (thirstLevel === 'critical') warnings.push('CRITICAL: Dehydration exhaustion is accumulating!');

  return {
    hunger_level: hungerLevel,
    thirst_level: thirstLevel,
    days_without_food: daysWithoutFood,
    days_without_water: daysWithoutWater,
    food_in_pack: {
      total_days: foodCount,
      perishable: perishables
    },
    water_in_pack: {
      total_days: waterCount
    },
    starvation_threshold: threshold,
    survival_intensity: intensity,
    warnings
  };
}

// ============================================================
// FORAGING DC BY TERRAIN
// ============================================================

/**
 * Determine the foraging DC based on location terrain keywords.
 * D&D 5e DMG p.111 — Wilderness Survival foraging DCs.
 *
 * @param {string} locationString - Free-text location description
 * @returns {number} DC for a Wisdom (Survival) check
 */
export function getForageDC(locationString) {
  if (!locationString) return 15;
  const loc = locationString.toLowerCase();

  // Easy terrain (DC 10)
  if (/\b(forest|woods|woodland|grove|thicket)\b/.test(loc)) return 10;
  if (/\b(coast|river|lake|stream|shore|beach|creek)\b/.test(loc)) return 10;

  // Moderate terrain (DC 12)
  if (/\b(plains?|grassland|meadow|farmland|field|prairie)\b/.test(loc)) return 12;
  if (/\b(swamp|marsh|bog|fen|wetland)\b/.test(loc)) return 12;

  // Hard terrain (DC 15)
  if (/\b(hills?|scrubland|badlands|highlands?|moor)\b/.test(loc)) return 15;
  if (/\b(mountain|peak|summit|alpine|cliff)\b/.test(loc)) return 15;

  // Very hard terrain (DC 20)
  if (/\b(desert|wasteland|dunes?|arid)\b/.test(loc)) return 20;
  if (/\b(arctic|tundra|glacier|frozen|ice)\b/.test(loc)) return 20;

  // Nearly impossible (DC 25)
  if (/\b(underground|dungeon|cave|underdark|cavern|sewer)\b/.test(loc)) return 25;

  // Default — unfamiliar or ambiguous terrain
  return 15;
}

// ============================================================
// FORMAT FOR DM PROMPT
// ============================================================

/**
 * Format the survival section for injection into the DM system prompt.
 *
 * Produces a multi-line string covering hunger, thirst, exposure,
 * shelter, foraging, and any active survival rules the DM should enforce.
 *
 * @param {object} character - Character row from DB
 * @param {object} weather - Weather object with type and temperature_f
 * @param {number} effectiveTemp - Effective temperature in Fahrenheit after modifiers
 * @returns {string} Formatted survival block for the DM prompt
 */
export function formatSurvivalForPrompt(character, weather, effectiveTemp) {
  const status = getSurvivalStatus(character, weather);
  const inventory = safeParse(character.inventory, []);
  const shelterType = character.shelter_type || 'none';
  const location = character.current_location || '';
  const forageDC = getForageDC(location);

  const lines = [];
  lines.push('=== SURVIVAL STATUS ===');

  // Phase 3.3 SC-7.6.5: surface non-Standard intensity to the DM so
  // narrative weight matches mechanical effect. Standard is silent
  // (preserves SC-7.6 prompt byte-identity).
  if (status.survival_intensity && status.survival_intensity !== 'standard') {
    if (status.survival_intensity === 'off') {
      lines.push('Survival mode: OFF (no mechanical hunger/thirst effects — narrate sparingly).');
    } else {
      lines.push(`Survival mode: ${status.survival_intensity.toUpperCase()}`);
    }
  }

  // --- Hunger ---
  const hungerLabels = { fed: 'Well-fed', hungry: 'Hungry', starving: 'Starving', critical: 'CRITICALLY STARVING' };
  lines.push(`Hunger: ${hungerLabels[status.hunger_level] || status.hunger_level}`);
  if (status.days_without_food > 0) {
    lines.push(`  Days without food: ${status.days_without_food} / ${status.starvation_threshold} before exhaustion`);
  }
  lines.push(`  Food in pack: ${status.food_in_pack.total_days} day${status.food_in_pack.total_days !== 1 ? 's' : ''} of rations`);

  // Perishable warnings
  for (const p of status.food_in_pack.perishable) {
    if (p.days_until_spoiled <= 2) {
      lines.push(`  WARNING: ${p.name} (x${p.quantity}) spoils in ${p.days_until_spoiled} day${p.days_until_spoiled !== 1 ? 's' : ''}`);
    }
  }

  // --- Thirst ---
  const thirstLabels = { hydrated: 'Hydrated', thirsty: 'Thirsty', dehydrated: 'Dehydrated', critical: 'CRITICALLY DEHYDRATED' };
  lines.push(`Thirst: ${thirstLabels[status.thirst_level] || status.thirst_level}`);
  if (status.days_without_water > 0) {
    lines.push(`  Days without water: ${status.days_without_water}`);
  }
  lines.push(`  Water in pack: ${status.water_in_pack.total_days} day${status.water_in_pack.total_days !== 1 ? 's' : ''} supply`);

  // --- Exposure / Temperature ---
  if (effectiveTemp != null) {
    let exposureRisk = 'none';
    if (effectiveTemp <= 0) exposureRisk = 'EXTREME COLD — CON save DC 10 every hour or gain exhaustion';
    else if (effectiveTemp <= 32) exposureRisk = 'Freezing — risk of frostbite, fire or shelter needed';
    else if (effectiveTemp <= 45) exposureRisk = 'Cold — warm clothing or shelter recommended';
    else if (effectiveTemp >= 100) exposureRisk = 'EXTREME HEAT — CON save DC 5 + 1/hour, doubled water needs';
    else if (effectiveTemp >= 85) exposureRisk = 'Hot — water consumption doubled';

    if (exposureRisk !== 'none') {
      lines.push(`Exposure: ${exposureRisk} (${effectiveTemp}F)`);
    }
  }

  // --- Shelter ---
  const shelterLabels = {
    none: 'None (exposed to elements)',
    tent: 'Tent (basic protection)',
    cave: 'Cave (good shelter)',
    building: 'Building (full shelter)',
    inn: 'Inn (comfortable)',
    magical: 'Magical shelter'
  };
  lines.push(`Shelter: ${shelterLabels[shelterType] || shelterType}`);

  // --- Foraging ---
  lines.push(`Foraging DC at ${location || 'current location'}: DC ${forageDC} (Wisdom/Survival)`);

  // --- Active rules the DM should enforce ---
  const rules = [];

  if (status.hunger_level === 'starving' || status.hunger_level === 'critical') {
    rules.push('Character is starving — apply exhaustion level when resting without food.');
  }
  if (status.thirst_level === 'dehydrated' || status.thirst_level === 'critical') {
    rules.push('Character is dehydrated — apply exhaustion levels. Water is urgent.');
  }
  if (status.food_in_pack.total_days === 0 && status.water_in_pack.total_days === 0) {
    rules.push('No supplies remaining. Character must forage, hunt, find water, or reach civilization.');
  } else if (status.food_in_pack.total_days <= 1 || status.water_in_pack.total_days <= 1) {
    rules.push('Supplies critically low. The DM should mention scarcity and create opportunities to resupply.');
  }

  const isHot = weather && (weather.type === 'heat_wave' || weather.weather_type === 'heat_wave' || (effectiveTemp && effectiveTemp >= 85));
  if (isHot) {
    rules.push('Hot conditions: water consumption is doubled. Enforce CON saves for prolonged exertion.');
  }

  if (rules.length > 0) {
    lines.push('');
    lines.push('SURVIVAL RULES IN EFFECT:');
    for (const rule of rules) {
      lines.push(`- ${rule}`);
    }
  }

  return lines.join('\n');
}

// ============================================================
// SC-6.4 — Shelter helper + marker handlers
// ============================================================

/**
 * Persist the character's current shelter type. Called by the SHELTER_FOUND
 * marker handler; also available for direct service calls if a future
 * non-marker path needs to set shelter (e.g., manual UI toggle).
 */
export async function setCharacterShelter(characterId, shelterType) {
  await dbRun(
    'UPDATE characters SET shelter_type = ? WHERE id = ?',
    [shelterType, characterId]
  );
}

// SHELTER_FOUND handler. Replaces the inline detect-call dispatch at the
// pre-SC-6.4 routes/dmSession.js:1875-1880 site. Returns the event object
// the route used to push into survivalEvents — route handler reads
// handlerResults to preserve the response shape.
//
// Per the Phase 4 prep flag in the Q6 survey: this is the first marker
// migrated in SC-6.4 because Phase 4's AI-behavior diagnostic work will
// instrument shelter-fixation through this exact marker, and pipeline-
// driven dispatch makes the diagnostic hook clean.
registerMarkerHandler('SHELTER_FOUND', async (parsed, context) => {
  if (!context?.characterId) {
    console.warn('[survivalService] SHELTER_FOUND handler invoked without characterId');
    return null;
  }
  await setCharacterShelter(context.characterId, parsed.Type);
  return { type: 'shelter_found', shelter: parsed.Type };
});

// EAT / DRINK handlers — multi-instance markers; pipeline dispatches the
// handler once per emitted marker (same shape as SC-5's BOND_SHIFT). Each
// handler reads game_day fresh because the route handler doesn't pass it
// in context (matches the SC-4 piety pattern).
registerMarkerHandler('EAT', async (parsed, context) => {
  if (!context?.characterId) return null;
  const row = await dbGet('SELECT game_day FROM characters WHERE id = ?', [context.characterId]);
  const gameDay = row?.game_day || 1;
  try {
    await consumeFood(context.characterId, parsed.Item, gameDay);
    return { type: 'ate', item: parsed.Item };
  } catch (e) {
    console.error(`[survivalService] EAT handler failed for ${parsed.Item}:`, e.message);
    return null;
  }
});

registerMarkerHandler('DRINK', async (parsed, context) => {
  if (!context?.characterId) return null;
  const row = await dbGet('SELECT game_day FROM characters WHERE id = ?', [context.characterId]);
  const gameDay = row?.game_day || 1;
  try {
    await consumeWater(context.characterId, parsed.Item, gameDay);
    return { type: 'drank', item: parsed.Item };
  } catch (e) {
    console.error(`[survivalService] DRINK handler failed for ${parsed.Item}:`, e.message);
    return null;
  }
});

// FORAGE handler — single-instance, may add Foraged Food and/or Collected
// Water to inventory. Result enum guards against partial/failure forages
// (only success forages mutate inventory). Quantity defaults to 0 if the
// AI omits the Food/Water fields (matches the legacy detect default).
registerMarkerHandler('FORAGE', async (parsed, context) => {
  if (!context?.characterId) return null;
  const result = (parsed.Result || 'success').toLowerCase();
  if (result !== 'success') {
    return { type: 'foraged', terrain: parsed.Terrain || 'unknown', food: 0, water: 0 };
  }
  const food = parsed.Food || 0;
  const water = parsed.Water || 0;
  if (food === 0 && water === 0) {
    return { type: 'foraged', terrain: parsed.Terrain || 'unknown', food: 0, water: 0 };
  }
  const row = await dbGet('SELECT inventory, game_day FROM characters WHERE id = ?', [context.characterId]);
  if (!row) return null;
  const inv = safeParse(row.inventory, []);
  const gameDay = row.game_day || 1;
  if (food > 0) {
    const existing = inv.find(i => i.name === 'Foraged Food');
    if (existing) existing.quantity = (existing.quantity || 1) + food;
    else inv.push({ name: 'Foraged Food', quantity: food, category: 'food', nutrition_days: 1, perishable: true, spoils_in_days: 2, acquired_game_day: gameDay });
  }
  if (water > 0) {
    const existing = inv.find(i => i.name === 'Collected Water');
    if (existing) existing.quantity = (existing.quantity || 1) + water;
    else inv.push({ name: 'Collected Water', quantity: water, category: 'water', hydration_days: 1 });
  }
  await dbRun('UPDATE characters SET inventory = ? WHERE id = ?', [JSON.stringify(inv), context.characterId]);
  return { type: 'foraged', terrain: parsed.Terrain || 'unknown', food, water };
});
