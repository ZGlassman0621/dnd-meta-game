/**
 * Weather Configuration
 *
 * Weather types, seasonal probability tables, region modifiers,
 * temperature rules, exposure thresholds, and gear warmth ratings.
 */

// ============================================================
// WEATHER TYPES WITH MECHANICAL EFFECTS
// ============================================================

export const WEATHER_TYPES = {
  clear:        { label: 'Clear',        icon: '\u2600\uFE0F', temp_mod: 0,   visibility: 'normal',    travel_mod: 1.0,  danger: 0, comfort: 'comfortable', precipitation: 'none' },
  cloudy:       { label: 'Cloudy',       icon: '\u2601\uFE0F', temp_mod: -3,  visibility: 'normal',    travel_mod: 1.0,  danger: 0, comfort: 'comfortable', precipitation: 'none' },
  overcast:     { label: 'Overcast',     icon: '\uD83C\uDF25\uFE0F', temp_mod: -5,  visibility: 'normal',    travel_mod: 1.0,  danger: 0, comfort: 'comfortable', precipitation: 'none' },
  rain:         { label: 'Rain',         icon: '\uD83C\uDF27\uFE0F', temp_mod: -10, visibility: 'reduced',   travel_mod: 0.8,  danger: 1, comfort: 'wet',         precipitation: 'moderate' },
  heavy_rain:   { label: 'Heavy Rain',   icon: '\u26C8\uFE0F', temp_mod: -15, visibility: 'poor',      travel_mod: 0.5,  danger: 2, comfort: 'miserable',   precipitation: 'heavy' },
  thunderstorm: { label: 'Thunderstorm', icon: '\u26C8\uFE0F', temp_mod: -15, visibility: 'poor',      travel_mod: 0.3,  danger: 3, comfort: 'dangerous',   precipitation: 'heavy' },
  snow:         { label: 'Snow',         icon: '\uD83C\uDF28\uFE0F', temp_mod: -20, visibility: 'reduced',   travel_mod: 0.6,  danger: 1, comfort: 'cold',        precipitation: 'moderate' },
  blizzard:     { label: 'Blizzard',     icon: '\u2744\uFE0F', temp_mod: -30, visibility: 'near_zero', travel_mod: 0.2,  danger: 4, comfort: 'deadly',      precipitation: 'heavy' },
  hail:         { label: 'Hail',         icon: '\uD83E\uDDCA', temp_mod: -10, visibility: 'reduced',   travel_mod: 0.4,  danger: 3, comfort: 'dangerous',   precipitation: 'moderate' },
  fog:          { label: 'Fog',          icon: '\uD83C\uDF2B\uFE0F', temp_mod: -5,  visibility: 'near_zero', travel_mod: 0.5,  danger: 1, comfort: 'damp',        precipitation: 'none' },
  heat_wave:    { label: 'Heat Wave',    icon: '\uD83D\uDD25', temp_mod: +20, visibility: 'normal',    travel_mod: 0.7,  danger: 2, comfort: 'sweltering',  precipitation: 'none' },
  dust_storm:   { label: 'Dust Storm',   icon: '\uD83D\uDCA8', temp_mod: +5,  visibility: 'near_zero', travel_mod: 0.2,  danger: 3, comfort: 'choking',     precipitation: 'none' },
  sleet:        { label: 'Sleet',        icon: '\uD83C\uDF27\uFE0F', temp_mod: -15, visibility: 'reduced',   travel_mod: 0.5,  danger: 2, comfort: 'freezing',    precipitation: 'moderate' }
};

// ============================================================
// SEASON-BASED WEATHER PROBABILITY TABLES
// Values are relative weights (will be normalized to 100%)
// ============================================================

export const SEASON_WEATHER_TABLES = {
  winter: {
    clear: 15, cloudy: 20, overcast: 15, snow: 20,
    blizzard: 5, sleet: 10, fog: 10, rain: 5
  },
  spring: {
    clear: 25, cloudy: 20, rain: 20, heavy_rain: 10,
    thunderstorm: 5, fog: 10, overcast: 10
  },
  summer: {
    clear: 35, cloudy: 15, rain: 10, thunderstorm: 10,
    heat_wave: 15, overcast: 10, fog: 5
  },
  autumn: {
    clear: 20, cloudy: 20, overcast: 15, rain: 20,
    fog: 15, heavy_rain: 5, snow: 5
  }
};

// ============================================================
// REGION MODIFIERS (additive shifts to season tables)
// ============================================================

export const REGION_MODIFIERS = {
  temperate:   {},
  coastal:     { fog: 10, rain: 10, clear: -10, snow: -5 },
  mountain:    { snow: 15, blizzard: 5, clear: -10, heat_wave: -10, hail: 5 },
  desert:      { clear: 20, heat_wave: 15, dust_storm: 10, rain: -20, snow: -15 },
  arctic:      { snow: 20, blizzard: 15, clear: -15, heat_wave: -15, rain: -10 },
  tropical:    { rain: 15, heavy_rain: 10, thunderstorm: 10, heat_wave: 10, snow: -20, blizzard: -5 },
  underground: {}
};

// ============================================================
// BASE TEMPERATURES BY SEASON (Fahrenheit)
// ============================================================

export const SEASON_BASE_TEMP = {
  winter: 25,
  spring: 55,
  summer: 80,
  autumn: 50
};

// Region temperature adjustments
export const REGION_TEMP_MOD = {
  temperate: 0,
  coastal: 5,       // Moderated by ocean
  mountain: -15,     // Higher altitude = colder
  desert: 15,        // Hot baseline
  arctic: -25,       // Very cold
  tropical: 20,      // Hot and humid
  underground: 0     // Stable underground temp (~55F), handled specially
};

// ============================================================
// TIME OF DAY TEMPERATURE MODIFIERS
// ============================================================

export const TIME_TEMP_MOD = {
  night: -15,
  dawn: -10,
  morning: -5,
  midday: 0,
  afternoon: 5,
  evening: -5,
  dusk: -10
};

// ============================================================
// WIND SPEED LEVELS
// ============================================================

export const WIND_SPEEDS = {
  calm:     { label: 'Calm',     ranged_mod: 0,  travel_mod: 1.0 },
  light:    { label: 'Light',    ranged_mod: 0,  travel_mod: 1.0 },
  moderate: { label: 'Moderate', ranged_mod: -2, travel_mod: 0.9 },
  strong:   { label: 'Strong',   ranged_mod: -5, travel_mod: 0.7 },
  gale:     { label: 'Gale',     ranged_mod: -10, travel_mod: 0.3 }
};

// Weather types that tend to bring wind
export const WEATHER_WIND_TENDENCY = {
  clear: 'calm',
  cloudy: 'light',
  overcast: 'light',
  rain: 'moderate',
  heavy_rain: 'strong',
  thunderstorm: 'strong',
  snow: 'moderate',
  blizzard: 'gale',
  hail: 'strong',
  fog: 'calm',
  heat_wave: 'light',
  dust_storm: 'gale',
  sleet: 'moderate'
};

// ============================================================
// WEATHER DURATION RANGES (hours)
// ============================================================

export const WEATHER_DURATION = {
  clear:        { min: 12, max: 72 },
  cloudy:       { min: 6,  max: 48 },
  overcast:     { min: 8,  max: 36 },
  rain:         { min: 2,  max: 24 },
  heavy_rain:   { min: 1,  max: 12 },
  thunderstorm: { min: 1,  max: 6 },
  snow:         { min: 4,  max: 36 },
  blizzard:     { min: 2,  max: 18 },
  hail:         { min: 0.5, max: 3 },
  fog:          { min: 4,  max: 24 },
  heat_wave:    { min: 24, max: 96 },
  dust_storm:   { min: 2,  max: 12 },
  sleet:        { min: 2,  max: 12 }
};

// ============================================================
// GEAR WARMTH RATINGS
// ============================================================

export const WARMTH_ITEMS = {
  'Cold Weather Gear':        { warmth: 3 },
  'Cold-Weather Gear':        { warmth: 3 },
  'Fur Cloak':                { warmth: 2 },
  'Winter Cloak':             { warmth: 2 },
  'Cloak of Protection':      { warmth: 1 },
  'Winter Blanket':           { warmth: 2 },
  "Traveler's Clothes":       { warmth: 1 },
  "Explorer's Pack":          { warmth: 1 },
  'Bedroll':                  { warmth: 1 },
  'Tent, two-person':         { warmth: 2, shelter: true },
  'Tent (two-person)':        { warmth: 2, shelter: true },
  'Fur-Lined Armor':          { warmth: 2 },
  'Boots of Winterlands':     { warmth: 3 }
};

// Heavy armor inherently provides +1 warmth but -1 comfort in heat
export const HEAVY_ARMOR_NAMES = [
  'Ring Mail', 'Chain Mail', 'Splint', 'Plate',
  'Half Plate', 'Scale Mail'
];

// ============================================================
// SHELTER TYPES
// ============================================================

export const SHELTER_TYPES = {
  none:     { protection: 0, label: 'No shelter', rest_mod: 0.5 },
  bedroll:  { protection: 1, label: 'Bedroll only', rest_mod: 0.6 },
  tent:     { protection: 3, label: 'Tent', rest_mod: 0.8 },
  cave:     { protection: 4, label: 'Cave/Natural shelter', rest_mod: 0.85 },
  building: { protection: 5, label: 'Building/Inn', rest_mod: 1.0 }
};

// ============================================================
// EXPOSURE RULES (D&D 5e DMG pp. 110-111)
// ============================================================

export const EXPOSURE_RULES = {
  extreme_cold: {
    label: 'Extreme Cold',
    threshold_below: 0,
    save_dc: 10,
    save_type: 'con',
    effect: 'exhaustion_1',
    frequency: 'per_hour',
    mitigation: 'Cold weather gear (warmth >= 3) or natural cold resistance = auto-pass',
    warmth_needed: 3
  },
  cold: {
    label: 'Cold',
    threshold_below: 32,
    effect: 'discomfort',
    mitigation: 'Warmth >= 2 negates discomfort',
    warmth_needed: 2
  },
  extreme_heat: {
    label: 'Extreme Heat',
    threshold_above: 100,
    save_dc: 5,
    save_increment: 1,
    save_type: 'con',
    effect: 'exhaustion_1',
    frequency: 'per_hour',
    mitigation: 'Access to water + shade negates. Heavy armor = disadvantage on save.'
  },
  hot: {
    label: 'Hot',
    threshold_above: 85,
    effect: 'water_consumption_doubled',
    mitigation: 'Light clothing, shade, swimming'
  }
};

// ============================================================
// WEATHER EFFECT DESCRIPTIONS FOR DM PROMPT
// ============================================================

export const WEATHER_EFFECTS = {
  rain: [
    'Ranged attacks at disadvantage beyond normal range',
    'Perception checks relying on hearing at disadvantage',
    'Outdoor fires difficult to light (DC 15 Survival)',
    'Tracks easier to follow (advantage on Survival to track)'
  ],
  heavy_rain: [
    'Ranged attacks at disadvantage beyond 30ft',
    'Perception checks relying on sight or hearing at disadvantage',
    'Outdoor fires nearly impossible (DC 20 Survival)',
    'Travel speed reduced to 50%'
  ],
  thunderstorm: [
    'All effects of heavy rain',
    'Lightning strikes possible (DM discretion, rare)',
    'Loud thunder masks other sounds — stealth easier',
    'Metal armor wearers at slight risk from lightning'
  ],
  snow: [
    'Difficult terrain in heavy accumulation',
    'Tracks very easy to follow',
    'Bright snow can cause snow blindness (disadvantage on Perception after 4+ hours without protection)'
  ],
  blizzard: [
    'Heavily obscured beyond 30ft — effectively blind',
    'Difficult terrain everywhere',
    'Travel nearly impossible — getting lost likely (DC 15 Survival to navigate)',
    'Extreme cold exposure rules apply'
  ],
  hail: [
    'Unsheltered creatures take 1d4 bludgeoning damage per round in severe hail',
    'Concentration checks for spellcasters',
    'Seek shelter immediately'
  ],
  fog: [
    'Heavily obscured beyond 30ft',
    'Ranged attacks at disadvantage beyond 30ft',
    'Easy to get separated from party',
    'Ambushes more likely'
  ],
  heat_wave: [
    'Water consumption doubled',
    'Heavy armor wearers: disadvantage on CON saves vs heat',
    'Forced march more dangerous',
    'Metal surfaces uncomfortably hot'
  ],
  dust_storm: [
    'Heavily obscured — effectively blind',
    'Difficult to breathe without covering',
    'All checks relying on sight at disadvantage',
    'Seek shelter immediately'
  ],
  sleet: [
    'Surfaces become slippery (DC 10 DEX save or fall prone)',
    'Difficult terrain',
    'Outdoor fires impossible',
    'Cold exposure rules may apply'
  ]
};

// ============================================================
// FORAGING MODIFIERS BY WEATHER
// ============================================================

export const FORAGING_WEATHER_MOD = {
  clear: 0,
  cloudy: 0,
  overcast: 0,
  rain: -2,          // Harder to forage in rain
  heavy_rain: -5,    // Very difficult
  thunderstorm: -10, // Dangerous to be outside
  snow: -5,          // Snow covers plants
  blizzard: -15,     // Nearly impossible
  hail: -10,         // Dangerous
  fog: -3,           // Hard to see
  heat_wave: -2,     // Plants wilted
  dust_storm: -15,   // Impossible
  sleet: -5          // Cold and slippery
};

// ============================================================
// SEASONAL FORAGING MODIFIERS
// ============================================================

export const FORAGING_SEASON_MOD = {
  spring: 2,    // Growth season — more herbs and plants
  summer: 0,    // Normal
  autumn: 1,    // Harvest season — berries, nuts
  winter: -5    // Very little grows
};

export default {
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
  WEATHER_EFFECTS,
  FORAGING_WEATHER_MOD,
  FORAGING_SEASON_MOD
};
