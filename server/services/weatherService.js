/**
 * Weather Service - Per-campaign weather state management
 *
 * Manages weather generation, advancement, temperature calculations,
 * gear warmth evaluation, exposure effects, and DM prompt formatting.
 * All weather state is persisted in the campaign_weather table (one row per campaign).
 */

import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import {
  WEATHER_TYPES,
  SEASON_WEATHER_TABLES,
  REGION_MODIFIERS,
  SEASON_BASE_TEMP,
  REGION_TEMP_MOD,
  TIME_TEMP_MOD,
  WIND_SPEEDS,
  WEATHER_WIND_TENDENCY,
  WEATHER_DURATION,
  WARMTH_ITEMS,
  HEAVY_ARMOR_NAMES,
  SHELTER_TYPES,
  EXPOSURE_RULES,
  WEATHER_EFFECTS
} from '../config/weather.js';
import { getSeason, getTimeOfDay } from '../config/harptos.js';

// Wind speed levels ordered for shifting up/down
const WIND_LEVELS = ['calm', 'light', 'moderate', 'strong', 'gale'];


// ============================================================
// 1. getWeather — Fetch or create default weather for a campaign
// ============================================================

/**
 * Get the current weather state for a campaign.
 * If no row exists, inserts a default (clear, 65F, calm) and returns it.
 *
 * @param {number} campaignId
 * @returns {Promise<Object>} The campaign_weather row
 */
export async function getWeather(campaignId) {
  let weather = await dbGet(
    'SELECT * FROM campaign_weather WHERE campaign_id = ?',
    [campaignId]
  );

  if (!weather) {
    // Insert default weather state
    await dbRun(`
      INSERT INTO campaign_weather (
        campaign_id, weather_type, temperature_f, wind_speed,
        visibility, precipitation, weather_duration_hours,
        weather_started_game_day, last_weather_change_day, region_type
      ) VALUES (?, 'clear', 65, 'calm', 'normal', 'none', 24, 1, 1, 'temperate')
    `, [campaignId]);

    weather = await dbGet(
      'SELECT * FROM campaign_weather WHERE campaign_id = ?',
      [campaignId]
    );
  }

  return weather;
}


// ============================================================
// 2. rollNewWeather — Generate weather from probability tables
// ============================================================

/**
 * Generate a new weather type using season + region probability tables.
 * Underground regions always return clear/55F/calm.
 *
 * @param {string} season - 'winter' | 'spring' | 'summer' | 'autumn'
 * @param {string} regionType - 'temperate' | 'coastal' | 'mountain' | 'desert' | 'arctic' | 'tropical' | 'underground'
 * @returns {Object} { weather_type, temperature_f, wind_speed, visibility, precipitation, weather_duration_hours }
 */
export function rollNewWeather(season, regionType) {
  // Underground regions: constant mild conditions
  if (regionType === 'underground') {
    return {
      weather_type: 'clear',
      temperature_f: 55,
      wind_speed: 'calm',
      visibility: 'normal',
      precipitation: 'none',
      weather_duration_hours: 24
    };
  }

  // --- Build weighted probability table ---

  // Start with a copy of the season table
  const weights = { ...(SEASON_WEATHER_TABLES[season] || SEASON_WEATHER_TABLES.summer) };

  // Apply region modifiers additively
  const regionMods = REGION_MODIFIERS[regionType] || {};
  for (const [type, shift] of Object.entries(regionMods)) {
    weights[type] = (weights[type] || 0) + shift;
  }

  // Clamp all values to minimum 0
  for (const type of Object.keys(weights)) {
    if (weights[type] < 0) weights[type] = 0;
  }

  // Remove entries with zero weight
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);

  if (totalWeight === 0) {
    // Fallback: clear weather
    return {
      weather_type: 'clear',
      temperature_f: SEASON_BASE_TEMP[season] || 65,
      wind_speed: 'calm',
      visibility: 'normal',
      precipitation: 'none',
      weather_duration_hours: 24
    };
  }

  // --- Weighted random selection ---
  let roll = Math.random() * totalWeight;
  let weatherType = 'clear';

  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      weatherType = type;
      break;
    }
  }

  // --- Determine wind speed ---
  const baseWind = WEATHER_WIND_TENDENCY[weatherType] || 'calm';
  const windSpeed = randomizeWind(baseWind);

  // --- Calculate duration ---
  const durationRange = WEATHER_DURATION[weatherType] || { min: 6, max: 24 };
  const durationHours = Math.round(
    durationRange.min + Math.random() * (durationRange.max - durationRange.min)
  );

  // --- Calculate temperature ---
  const baseSeason = SEASON_BASE_TEMP[season] || 65;
  const regionMod = REGION_TEMP_MOD[regionType] || 0;
  const weatherTempMod = WEATHER_TYPES[weatherType]?.temp_mod || 0;
  const variance = Math.round(Math.random() * 10 - 5); // -5 to +5
  const temperatureF = baseSeason + regionMod + weatherTempMod + variance;

  // --- Read weather type properties ---
  const weatherInfo = WEATHER_TYPES[weatherType] || WEATHER_TYPES.clear;

  return {
    weather_type: weatherType,
    temperature_f: temperatureF,
    wind_speed: windSpeed,
    visibility: weatherInfo.visibility,
    precipitation: weatherInfo.precipitation,
    weather_duration_hours: durationHours
  };
}

/**
 * Randomize wind speed with a 10% chance to shift up or down one level
 * from the base tendency.
 *
 * @param {string} baseWind - The base wind level from WEATHER_WIND_TENDENCY
 * @returns {string} Final wind speed key
 */
function randomizeWind(baseWind) {
  const idx = WIND_LEVELS.indexOf(baseWind);
  if (idx === -1) return baseWind;

  const shiftRoll = Math.random();
  if (shiftRoll < 0.1 && idx > 0) {
    // 10% chance: one level calmer
    return WIND_LEVELS[idx - 1];
  } else if (shiftRoll > 0.9 && idx < WIND_LEVELS.length - 1) {
    // 10% chance: one level stronger
    return WIND_LEVELS[idx + 1];
  }
  return baseWind;
}


// ============================================================
// 3. advanceWeather — Called when game time advances
// ============================================================

/**
 * Check whether weather should change after time advances, and update if so.
 *
 * @param {number} campaignId
 * @param {number} hoursAdvanced - Number of in-game hours that passed
 * @param {number} currentGameDay - Current game day-of-year after advancement
 * @param {string} season - Current season string
 * @returns {Promise<Object>} { changed: boolean, previous?, current }
 */
export async function advanceWeather(campaignId, hoursAdvanced, currentGameDay, season) {
  const weather = await getWeather(campaignId);

  // Calculate elapsed hours since weather started
  const daysSinceWeatherStart = currentGameDay - (weather.weather_started_game_day || currentGameDay);
  const hoursSinceStart = daysSinceWeatherStart * 24;

  // Check if duration has been exceeded
  if (hoursSinceStart >= (weather.weather_duration_hours || 24)) {
    const previous = { ...weather };
    const regionType = weather.region_type || 'temperate';

    // Roll new weather
    const newWeather = rollNewWeather(season, regionType);

    // Update the database row
    await dbRun(`
      UPDATE campaign_weather SET
        weather_type = ?,
        temperature_f = ?,
        wind_speed = ?,
        visibility = ?,
        precipitation = ?,
        weather_duration_hours = ?,
        weather_started_game_day = ?,
        last_weather_change_day = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE campaign_id = ?
    `, [
      newWeather.weather_type,
      newWeather.temperature_f,
      newWeather.wind_speed,
      newWeather.visibility,
      newWeather.precipitation,
      newWeather.weather_duration_hours,
      currentGameDay,
      currentGameDay,
      campaignId
    ]);

    const current = await getWeather(campaignId);
    return { changed: true, previous, current };
  }

  // No change needed
  return { changed: false, current: weather };
}


// ============================================================
// 4. getEffectiveTemperature — Stored temp + time-of-day modifier
// ============================================================

/**
 * Calculate the effective temperature factoring in time of day.
 * Uses the stored DB temperature (which already includes season, region, and weather mods)
 * and adds the time-of-day modifier.
 *
 * @param {number} baseTemp - Stored temperature_f from campaign_weather
 * @param {string} weatherType - Current weather type key (unused here but available for extensions)
 * @param {string} timeOfDay - 'night' | 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'dusk'
 * @returns {number} Effective temperature in Fahrenheit (integer)
 */
export function getEffectiveTemperature(baseTemp, weatherType, timeOfDay) {
  const timeMod = TIME_TEMP_MOD[timeOfDay] || 0;
  return Math.round(baseTemp + timeMod);
}


// ============================================================
// 5. calculateGearWarmth — Scan inventory + equipment for warmth
// ============================================================

/**
 * Scan a character's inventory and equipment for warmth-rated items.
 *
 * @param {string|Array} inventoryJson - Inventory JSON string or parsed array (items with `name` field)
 * @param {string|Object} equipmentJson - Equipment JSON string or parsed object (slot -> { name })
 * @returns {Object} { totalWarmth: number (capped at 5), hasShelterGear: boolean, items: string[] }
 */
export function calculateGearWarmth(inventoryJson, equipmentJson) {
  const inventory = Array.isArray(inventoryJson)
    ? inventoryJson
    : safeParse(inventoryJson, []);
  const equipment = typeof equipmentJson === 'object' && equipmentJson !== null && !Array.isArray(equipmentJson)
    ? equipmentJson
    : safeParse(equipmentJson, {});

  let totalWarmth = 0;
  let hasShelterGear = false;
  const matchedItems = [];

  // Build a combined list of item names to check
  const allItemNames = [];

  // From inventory (array of items with name field)
  if (Array.isArray(inventory)) {
    for (const item of inventory) {
      if (item && item.name) {
        allItemNames.push({ name: item.name, source: 'inventory' });
      }
    }
  }

  // From equipment (object with slot keys, each value has name)
  if (equipment && typeof equipment === 'object') {
    for (const [slot, item] of Object.entries(equipment)) {
      if (item && item.name) {
        allItemNames.push({ name: item.name, source: 'equipment', slot });
      }
    }
  }

  // Check each item against WARMTH_ITEMS (case-insensitive partial match)
  const alreadyCounted = new Set();
  for (const { name, source, slot } of allItemNames) {
    const nameLower = name.toLowerCase();

    for (const [warmthItemName, warmthData] of Object.entries(WARMTH_ITEMS)) {
      const warmthNameLower = warmthItemName.toLowerCase();

      // Partial match: either the item contains the warmth item name, or vice versa
      if (nameLower.includes(warmthNameLower) || warmthNameLower.includes(nameLower)) {
        // Avoid double-counting the same warmth item name
        if (!alreadyCounted.has(warmthNameLower)) {
          alreadyCounted.add(warmthNameLower);
          totalWarmth += warmthData.warmth;
          matchedItems.push(`${warmthItemName} (${warmthData.warmth})`);

          if (warmthData.shelter) {
            hasShelterGear = true;
          }
        }
        break; // Move on to next item
      }
    }

    // Check heavy armor for +1 inherent warmth (only equipped armor counts)
    if (source === 'equipment') {
      for (const armorName of HEAVY_ARMOR_NAMES) {
        if (nameLower.includes(armorName.toLowerCase())) {
          if (!alreadyCounted.has('heavy_armor_bonus')) {
            alreadyCounted.add('heavy_armor_bonus');
            totalWarmth += 1;
            matchedItems.push(`${armorName} (heavy armor +1)`);
          }
          break;
        }
      }
    }
  }

  return {
    totalWarmth: Math.min(totalWarmth, 5),
    hasShelterGear,
    items: matchedItems
  };
}


// ============================================================
// 6. checkExposureEffects — Determine exposure danger
// ============================================================

/**
 * Check temperature against exposure thresholds and gear warmth.
 *
 * @param {number} temperature - Effective temperature in Fahrenheit
 * @param {number} gearWarmth - Total warmth rating from calculateGearWarmth
 * @param {boolean} hasShelterFlag - Whether the character has shelter
 * @returns {Object} { severity, save_dc?, effect, mitigated }
 */
export function checkExposureEffects(temperature, gearWarmth, hasShelterFlag) {
  // Extreme cold: below 0F
  if (temperature < EXPOSURE_RULES.extreme_cold.threshold_below) {
    const mitigated = gearWarmth >= EXPOSURE_RULES.extreme_cold.warmth_needed || hasShelterFlag;
    return {
      severity: 'extreme_cold',
      save_dc: EXPOSURE_RULES.extreme_cold.save_dc,
      effect: 'exhaustion',
      mitigated
    };
  }

  // Cold: below 32F
  if (temperature < EXPOSURE_RULES.cold.threshold_below) {
    const mitigated = gearWarmth >= EXPOSURE_RULES.cold.warmth_needed;
    return {
      severity: 'cold',
      effect: 'discomfort',
      mitigated
    };
  }

  // Extreme heat: above 100F
  if (temperature > EXPOSURE_RULES.extreme_heat.threshold_above) {
    return {
      severity: 'extreme_heat',
      save_dc: EXPOSURE_RULES.extreme_heat.save_dc,
      effect: 'exhaustion',
      mitigated: hasShelterFlag
    };
  }

  // Hot: above 85F
  if (temperature > EXPOSURE_RULES.hot.threshold_above) {
    return {
      severity: 'hot',
      effect: 'water_doubled',
      mitigated: false
    };
  }

  // Comfortable
  return {
    severity: 'none',
    effect: null,
    mitigated: true
  };
}


// ============================================================
// 7. hasShelter — Determine shelter type from location + inventory
// ============================================================

// Keywords for building-type shelter
const BUILDING_KEYWORDS = [
  'inn', 'tavern', 'house', 'temple', 'castle', 'manor', 'tower',
  'home', 'city', 'town', 'village', 'shop', 'store', 'barracks'
];

// Keywords for cave-type shelter
const CAVE_KEYWORDS = ['cave', 'cavern', 'grotto', 'mine', 'underground'];

/**
 * Determine the best shelter type based on location and inventory.
 *
 * @param {string} locationString - Current location description or name
 * @param {string|Array} inventoryJson - Inventory JSON string or parsed array
 * @returns {string} 'building' | 'cave' | 'tent' | 'bedroll' | 'none'
 */
export function hasShelter(locationString, inventoryJson) {
  const locLower = (locationString || '').toLowerCase();
  const inventory = Array.isArray(inventoryJson)
    ? inventoryJson
    : safeParse(inventoryJson, []);

  // Check for building shelter (best)
  for (const keyword of BUILDING_KEYWORDS) {
    if (locLower.includes(keyword)) {
      return 'building';
    }
  }

  // Check for cave shelter
  for (const keyword of CAVE_KEYWORDS) {
    if (locLower.includes(keyword)) {
      return 'cave';
    }
  }

  // Check inventory for tent
  if (Array.isArray(inventory)) {
    for (const item of inventory) {
      const itemName = (item?.name || '').toLowerCase();
      if (itemName.includes('tent')) {
        return 'tent';
      }
    }

    // Check inventory for bedroll
    for (const item of inventory) {
      const itemName = (item?.name || '').toLowerCase();
      if (itemName.includes('bedroll')) {
        return 'bedroll';
      }
    }
  }

  return 'none';
}


// ============================================================
// 8. formatWeatherForPrompt — Multi-line DM prompt injection
// ============================================================

/**
 * Get a human-readable temperature descriptor.
 *
 * @param {number} temp - Temperature in Fahrenheit
 * @returns {string} Descriptor word
 */
function getTemperatureDescriptor(temp) {
  if (temp <= 0)   return 'Freezing';
  if (temp <= 32)  return 'Cold';
  if (temp <= 50)  return 'Cool';
  if (temp <= 65)  return 'Mild';
  if (temp <= 80)  return 'Warm';
  if (temp <= 100) return 'Hot';
  return 'Sweltering';
}

/**
 * Format weather state into a multi-line string for DM prompt injection.
 *
 * @param {Object} weather - campaign_weather row
 * @param {number} effectiveTemp - Effective temperature after time-of-day mod
 * @param {string} timeOfDay - Current time of day
 * @param {Object} gearSummary - Result from calculateGearWarmth
 * @param {string} shelterType - Result from hasShelter
 * @param {string} locationString - Current location description
 * @returns {string} Formatted weather block for prompt
 */
export function formatWeatherForPrompt(weather, effectiveTemp, timeOfDay, gearSummary, shelterType, locationString) {
  const weatherInfo = WEATHER_TYPES[weather.weather_type] || WEATHER_TYPES.clear;
  const windInfo = WIND_SPEEDS[weather.wind_speed] || WIND_SPEEDS.calm;
  const shelterInfo = SHELTER_TYPES[shelterType] || SHELTER_TYPES.none;
  const tempDescriptor = getTemperatureDescriptor(effectiveTemp);

  const lines = [];

  // Header: weather type with icon, temperature, wind, visibility
  lines.push(`CURRENT WEATHER: ${weatherInfo.icon} ${weatherInfo.label}`);
  lines.push(`Temperature: ${effectiveTemp}F (${tempDescriptor}) | Wind: ${windInfo.label} | Visibility: ${weatherInfo.visibility}`);
  lines.push(`Time: ${timeOfDay} | Comfort: ${weatherInfo.comfort}`);

  // Gear warmth summary
  if (gearSummary && gearSummary.items.length > 0) {
    lines.push(`Gear Warmth: ${gearSummary.totalWarmth}/5 — ${gearSummary.items.join(', ')}`);
  } else {
    lines.push(`Gear Warmth: 0/5 — No cold-weather gear`);
  }

  // Shelter status
  lines.push(`Shelter: ${shelterInfo.label}`);

  // Weather-specific effects from WEATHER_EFFECTS
  const effects = WEATHER_EFFECTS[weather.weather_type];
  if (effects && effects.length > 0) {
    lines.push('Weather Effects:');
    for (const effect of effects) {
      lines.push(`  - ${effect}`);
    }
  }

  // Exposure warnings
  const exposure = checkExposureEffects(
    effectiveTemp,
    gearSummary?.totalWarmth || 0,
    shelterType === 'building' || shelterType === 'cave'
  );
  if (exposure.severity !== 'none' && !exposure.mitigated) {
    lines.push('EXPOSURE WARNING:');
    if (exposure.severity === 'extreme_cold') {
      lines.push(`  Extreme Cold — CON save DC ${exposure.save_dc} each hour or gain 1 level of exhaustion.`);
      lines.push(`  Needs warmth >= 3 or shelter to mitigate.`);
    } else if (exposure.severity === 'cold') {
      lines.push(`  Cold — Character is uncomfortable. Needs warmth >= 2 to mitigate.`);
    } else if (exposure.severity === 'extreme_heat') {
      lines.push(`  Extreme Heat — CON save DC ${exposure.save_dc}+ each hour or gain 1 level of exhaustion.`);
      lines.push(`  Shade/shelter mitigates. Heavy armor = disadvantage on save.`);
    } else if (exposure.severity === 'hot') {
      lines.push(`  Hot — Water consumption doubled. Light clothing and shade recommended.`);
    }
  }

  return lines.join('\n');
}


// ============================================================
// 9. setWeather — Manually set weather (DM marker processing)
// ============================================================

/**
 * Manually set the weather for a campaign (e.g., from a DM marker or event).
 * Rolls an appropriate temperature for the weather type based on the current season.
 *
 * @param {number} campaignId
 * @param {string} weatherType - A key from WEATHER_TYPES
 * @param {number} durationHours - How long this weather should last
 * @param {number} gameDay - Current game day
 * @returns {Promise<Object>} Updated weather row
 */
export async function setWeather(campaignId, weatherType, durationHours, gameDay) {
  // Ensure the weather type is valid; fall back to 'clear'
  const validType = WEATHER_TYPES[weatherType] ? weatherType : 'clear';
  const weatherInfo = WEATHER_TYPES[validType];

  // Determine season from the game day to calculate temperature
  const season = getSeason(gameDay);
  const weather = await getWeather(campaignId);
  const regionType = weather.region_type || 'temperate';

  // Calculate temperature for this weather type
  const baseSeason = SEASON_BASE_TEMP[season] || 65;
  const regionMod = REGION_TEMP_MOD[regionType] || 0;
  const weatherTempMod = weatherInfo.temp_mod || 0;
  const variance = Math.round(Math.random() * 10 - 5); // -5 to +5
  const temperatureF = baseSeason + regionMod + weatherTempMod + variance;

  // Determine wind from weather tendency
  const windSpeed = randomizeWind(WEATHER_WIND_TENDENCY[validType] || 'calm');

  // Update the database row
  await dbRun(`
    UPDATE campaign_weather SET
      weather_type = ?,
      temperature_f = ?,
      wind_speed = ?,
      visibility = ?,
      precipitation = ?,
      weather_duration_hours = ?,
      weather_started_game_day = ?,
      last_weather_change_day = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE campaign_id = ?
  `, [
    validType,
    temperatureF,
    windSpeed,
    weatherInfo.visibility,
    weatherInfo.precipitation,
    durationHours,
    gameDay,
    gameDay,
    campaignId
  ]);

  return getWeather(campaignId);
}
