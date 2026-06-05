/**
 * Weather System Tests — Config tables, weather service functions, and DM marker detection.
 * Run: node tests/weather.test.js
 */

import {
  WEATHER_TYPES,
  SEASON_WEATHER_TABLES,
  REGION_MODIFIERS,
  SEASON_BASE_TEMP,
  TIME_TEMP_MOD,
  EXPOSURE_RULES,
  WARMTH_ITEMS,
  SHELTER_TYPES
} from '../server/config/weather.js';

import {
  getEffectiveTemperature,
  calculateGearWarmth,
  hasShelter,
  checkExposureEffects,
  rollNewWeather
} from '../server/services/weatherService.js';

import {
  detectWeatherChange,
  detectShelterFound,
  detectSwim
} from '../server/services/dmSessionService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// ============================================================
// 1. WEATHER_TYPES — Verify all expected types and properties
// ============================================================
console.log('\n=== Test 1: WEATHER_TYPES ===\n');

const expectedWeatherTypes = [
  'clear', 'cloudy', 'overcast', 'rain', 'heavy_rain', 'thunderstorm',
  'snow', 'blizzard', 'hail', 'fog', 'heat_wave', 'dust_storm', 'sleet'
];

for (const type of expectedWeatherTypes) {
  assert(WEATHER_TYPES[type] !== undefined, `Weather type "${type}" exists`);
}

const requiredProps = ['label', 'temp_mod', 'visibility', 'travel_mod', 'danger', 'comfort'];
for (const type of expectedWeatherTypes) {
  const wt = WEATHER_TYPES[type];
  for (const prop of requiredProps) {
    assert(wt[prop] !== undefined, `${type} has property "${prop}"`);
  }
}

assert(WEATHER_TYPES.clear.temp_mod === 0, 'Clear weather has 0 temp_mod');
assert(WEATHER_TYPES.snow.temp_mod < 0, 'Snow has negative temp_mod');
assert(WEATHER_TYPES.heat_wave.temp_mod > 0, 'Heat wave has positive temp_mod');
assert(WEATHER_TYPES.blizzard.danger > WEATHER_TYPES.clear.danger, 'Blizzard is more dangerous than clear');
assert(typeof WEATHER_TYPES.rain.label === 'string', 'Rain label is a string');

// ============================================================
// 2. SEASON_WEATHER_TABLES — 4 seasons, probabilities roughly sum to 100
// ============================================================
console.log('\n=== Test 2: SEASON_WEATHER_TABLES ===\n');

const expectedSeasons = ['winter', 'spring', 'summer', 'autumn'];

assert(Object.keys(SEASON_WEATHER_TABLES).length === 4, 'Exactly 4 seasons in weather tables');

for (const season of expectedSeasons) {
  assert(SEASON_WEATHER_TABLES[season] !== undefined, `Season "${season}" exists in weather tables`);
  const weights = Object.values(SEASON_WEATHER_TABLES[season]);
  const sum = weights.reduce((a, b) => a + b, 0);
  assert(sum >= 90 && sum <= 110, `${season} weights sum to ~100 (got ${sum})`);
}

assert(SEASON_WEATHER_TABLES.winter.snow > 0, 'Winter has snow probability');
assert(SEASON_WEATHER_TABLES.summer.heat_wave > 0, 'Summer has heat_wave probability');
assert(SEASON_WEATHER_TABLES.spring.rain > 0, 'Spring has rain probability');

// ============================================================
// 3. REGION_MODIFIERS — Verify expected regions exist
// ============================================================
console.log('\n=== Test 3: REGION_MODIFIERS ===\n');

const expectedRegions = ['temperate', 'coastal', 'mountain', 'desert', 'arctic', 'tropical', 'underground'];

for (const region of expectedRegions) {
  assert(REGION_MODIFIERS[region] !== undefined, `Region "${region}" exists`);
}

assert(Object.keys(REGION_MODIFIERS.temperate).length === 0, 'Temperate has no modifiers (baseline)');
assert(REGION_MODIFIERS.arctic.snow > 0, 'Arctic boosts snow probability');
assert(REGION_MODIFIERS.desert.clear > 0, 'Desert boosts clear probability');
assert(REGION_MODIFIERS.coastal.fog > 0, 'Coastal boosts fog probability');

// ============================================================
// 4. SEASON_BASE_TEMP — 4 seasons with reasonable temps
// ============================================================
console.log('\n=== Test 4: SEASON_BASE_TEMP ===\n');

for (const season of expectedSeasons) {
  assert(SEASON_BASE_TEMP[season] !== undefined, `Season "${season}" has a base temp`);
  assert(typeof SEASON_BASE_TEMP[season] === 'number', `${season} base temp is a number`);
}

assert(SEASON_BASE_TEMP.winter < SEASON_BASE_TEMP.summer, 'Winter is colder than summer');
assert(SEASON_BASE_TEMP.summer > SEASON_BASE_TEMP.spring, 'Summer is warmer than spring');
assert(SEASON_BASE_TEMP.winter >= -20 && SEASON_BASE_TEMP.winter <= 40, 'Winter temp is reasonable (got ' + SEASON_BASE_TEMP.winter + ')');
assert(SEASON_BASE_TEMP.summer >= 60 && SEASON_BASE_TEMP.summer <= 100, 'Summer temp is reasonable (got ' + SEASON_BASE_TEMP.summer + ')');

// ============================================================
// 5. TIME_TEMP_MOD — All time periods exist
// ============================================================
console.log('\n=== Test 5: TIME_TEMP_MOD ===\n');

const expectedTimes = ['night', 'dawn', 'morning', 'midday', 'afternoon', 'evening', 'dusk'];

for (const time of expectedTimes) {
  assert(TIME_TEMP_MOD[time] !== undefined, `Time period "${time}" exists`);
  assert(typeof TIME_TEMP_MOD[time] === 'number', `${time} temp mod is a number`);
}

assert(TIME_TEMP_MOD.midday === 0, 'Midday has 0 temp mod (baseline)');
assert(TIME_TEMP_MOD.night < 0, 'Night is colder than midday');
assert(TIME_TEMP_MOD.afternoon > TIME_TEMP_MOD.night, 'Afternoon is warmer than night');

// ============================================================
// 6. EXPOSURE_RULES — extreme_cold, cold, extreme_heat, hot
// ============================================================
console.log('\n=== Test 6: EXPOSURE_RULES ===\n');

const expectedExposure = ['extreme_cold', 'cold', 'extreme_heat', 'hot'];

for (const key of expectedExposure) {
  assert(EXPOSURE_RULES[key] !== undefined, `Exposure rule "${key}" exists`);
  assert(EXPOSURE_RULES[key].label !== undefined, `${key} has a label`);
  assert(EXPOSURE_RULES[key].effect !== undefined, `${key} has an effect`);
  assert(EXPOSURE_RULES[key].mitigation !== undefined, `${key} has mitigation info`);
}

assert(EXPOSURE_RULES.extreme_cold.threshold_below === 0, 'Extreme cold threshold is 0F');
assert(EXPOSURE_RULES.cold.threshold_below === 32, 'Cold threshold is 32F');
assert(EXPOSURE_RULES.extreme_heat.threshold_above === 100, 'Extreme heat threshold is 100F');
assert(EXPOSURE_RULES.hot.threshold_above === 85, 'Hot threshold is 85F');
assert(EXPOSURE_RULES.extreme_cold.save_dc === 10, 'Extreme cold save DC is 10');
assert(EXPOSURE_RULES.extreme_cold.warmth_needed === 3, 'Extreme cold requires warmth 3');

// ============================================================
// 7. WARMTH_ITEMS — Verify some known items exist
// ============================================================
console.log('\n=== Test 7: WARMTH_ITEMS ===\n');

assert(WARMTH_ITEMS['Cold Weather Gear'] !== undefined, 'Cold Weather Gear exists');
assert(WARMTH_ITEMS['Cold Weather Gear'].warmth === 3, 'Cold Weather Gear gives warmth 3');
assert(WARMTH_ITEMS['Fur Cloak'] !== undefined, 'Fur Cloak exists');
assert(WARMTH_ITEMS['Fur Cloak'].warmth === 2, 'Fur Cloak gives warmth 2');
assert(WARMTH_ITEMS['Bedroll'] !== undefined, 'Bedroll exists');
assert(WARMTH_ITEMS['Bedroll'].warmth === 1, 'Bedroll gives warmth 1');
assert(WARMTH_ITEMS['Boots of Winterlands'] !== undefined, 'Boots of Winterlands exists');
assert(WARMTH_ITEMS['Boots of Winterlands'].warmth === 3, 'Boots of Winterlands gives warmth 3');

// Tent has shelter flag
assert(WARMTH_ITEMS['Tent, two-person'] !== undefined, 'Tent, two-person exists');
assert(WARMTH_ITEMS['Tent, two-person'].shelter === true, 'Tent provides shelter');

// ============================================================
// 8. SHELTER_TYPES — Verify known shelter types
// ============================================================
console.log('\n=== Test 8: SHELTER_TYPES ===\n');

const expectedShelters = ['none', 'bedroll', 'tent', 'cave', 'building'];

for (const shelter of expectedShelters) {
  assert(SHELTER_TYPES[shelter] !== undefined, `Shelter type "${shelter}" exists`);
  assert(typeof SHELTER_TYPES[shelter].protection === 'number', `${shelter} has numeric protection`);
  assert(typeof SHELTER_TYPES[shelter].label === 'string', `${shelter} has string label`);
  assert(typeof SHELTER_TYPES[shelter].rest_mod === 'number', `${shelter} has numeric rest_mod`);
}

assert(SHELTER_TYPES.building.protection > SHELTER_TYPES.tent.protection, 'Building gives more protection than tent');
assert(SHELTER_TYPES.none.protection === 0, 'No shelter gives 0 protection');
assert(SHELTER_TYPES.building.rest_mod === 1.0, 'Building gives full rest quality');
assert(SHELTER_TYPES.none.rest_mod < 1.0, 'No shelter reduces rest quality');

// ============================================================
// 9. getEffectiveTemperature — Various combos
// ============================================================
console.log('\n=== Test 9: getEffectiveTemperature ===\n');

// Clear + midday = base temp (no mod from weather type in this function, midday mod is 0)
let effTemp = getEffectiveTemperature(65, 'clear', 'midday');
assert(effTemp === 65, 'Clear + midday: base temp unchanged (65)');

// Snow + night: base temp + night mod (-15)
effTemp = getEffectiveTemperature(25, 'snow', 'night');
assert(effTemp === 10, 'Snow + night: 25 + (-15) = 10');

// Heat_wave + afternoon: base temp + afternoon mod (+5)
effTemp = getEffectiveTemperature(100, 'heat_wave', 'afternoon');
assert(effTemp === 105, 'Heat_wave + afternoon: 100 + 5 = 105');

// Dawn modifier
effTemp = getEffectiveTemperature(50, 'cloudy', 'dawn');
assert(effTemp === 40, 'Cloudy + dawn: 50 + (-10) = 40');

// Evening modifier
effTemp = getEffectiveTemperature(70, 'clear', 'evening');
assert(effTemp === 65, 'Clear + evening: 70 + (-5) = 65');

// Unknown time of day defaults to 0 mod
effTemp = getEffectiveTemperature(60, 'clear', 'unknown_time');
assert(effTemp === 60, 'Unknown time of day: no modifier applied');

// ============================================================
// 10. calculateGearWarmth — Inventory and equipment checks
// ============================================================
console.log('\n=== Test 10: calculateGearWarmth ===\n');

// Empty inventory => 0 warmth
let gear = calculateGearWarmth([], {});
assert(gear.totalWarmth === 0, 'Empty inventory gives 0 warmth');
assert(gear.hasShelterGear === false, 'Empty inventory has no shelter gear');
assert(gear.items.length === 0, 'Empty inventory has no matched items');

// Inventory with Cold Weather Gear => warmth 3
gear = calculateGearWarmth([{ name: 'Cold Weather Gear' }], {});
assert(gear.totalWarmth === 3, 'Cold Weather Gear gives warmth 3');
assert(gear.items.length >= 1, 'Cold Weather Gear matched');

// Multiple warmth items => cumulative warmth
gear = calculateGearWarmth([
  { name: 'Cold Weather Gear' },
  { name: 'Fur Cloak' },
  { name: 'Bedroll' }
], {});
// Cold Weather Gear (3) + Fur Cloak (2) + Bedroll (1) = 6, capped at 5
assert(gear.totalWarmth === 5, 'Multiple items cumulative, capped at 5');
assert(gear.items.length === 3, 'Three items matched');

// Tent provides shelter gear flag
gear = calculateGearWarmth([{ name: 'Tent, two-person' }], {});
assert(gear.hasShelterGear === true, 'Tent sets hasShelterGear');

// JSON string input (inventory as string)
gear = calculateGearWarmth(JSON.stringify([{ name: 'Fur Cloak' }]), '{}');
assert(gear.totalWarmth === 2, 'JSON string inventory: Fur Cloak gives warmth 2');

// Equipment with heavy armor gives +1
gear = calculateGearWarmth([], { armor: { name: 'Plate' } });
assert(gear.totalWarmth === 1, 'Heavy armor (Plate) gives +1 warmth');

// Null/undefined inventory
gear = calculateGearWarmth(null, null);
assert(gear.totalWarmth === 0, 'Null inputs give 0 warmth');

// ============================================================
// 11. hasShelter — Location and inventory checks
// ============================================================
console.log('\n=== Test 11: hasShelter ===\n');

// Location with "inn"
let shelter = hasShelter('The Prancing Pony Inn', []);
assert(shelter === 'building', 'Location with "inn" returns "building"');

// Location with "tavern"
shelter = hasShelter('Ye Olde Tavern', []);
assert(shelter === 'building', 'Location with "tavern" returns "building"');

// Location with "temple"
shelter = hasShelter('Temple of Lathander', []);
assert(shelter === 'building', 'Location with "temple" returns "building"');

// Location with "cave"
shelter = hasShelter('A dark cave entrance', []);
assert(shelter === 'cave', 'Location with "cave" returns "cave"');

// Location with "cavern"
shelter = hasShelter('The Great Cavern', []);
assert(shelter === 'cave', 'Location with "cavern" returns "cave"');

// Inventory with tent
shelter = hasShelter('Open plains', [{ name: 'Tent, two-person' }]);
assert(shelter === 'tent', 'Inventory with tent returns "tent"');

// Inventory with bedroll (no tent)
shelter = hasShelter('Open plains', [{ name: 'Bedroll' }]);
assert(shelter === 'bedroll', 'Inventory with bedroll returns "bedroll"');

// No shelter at all
shelter = hasShelter('Open road', []);
assert(shelter === 'none', 'No shelter cues returns "none"');

// Null location
shelter = hasShelter(null, []);
assert(shelter === 'none', 'Null location returns "none"');

// Case insensitive location check
shelter = hasShelter('THE TOWN SQUARE', []);
assert(shelter === 'building', 'Case-insensitive: "TOWN" detected as building');

// JSON string inventory
shelter = hasShelter('wilderness', JSON.stringify([{ name: 'Tent' }]));
assert(shelter === 'tent', 'JSON string inventory with tent returns "tent"');

// ============================================================
// 12. checkExposureEffects — Temperature thresholds
// ============================================================
console.log('\n=== Test 12: checkExposureEffects ===\n');

// Mild temp (65F) => no exposure
let exposure = checkExposureEffects(65, 0, false);
assert(exposure.severity === 'none', 'Mild temp (65F): no exposure');
assert(exposure.effect === null, 'Mild temp: no effect');

// Below 0F with no warmth => extreme cold, not mitigated
exposure = checkExposureEffects(-10, 0, false);
assert(exposure.severity === 'extreme_cold', 'Below 0F: extreme cold');
assert(exposure.save_dc === 10, 'Extreme cold save DC is 10');
assert(exposure.mitigated === false, 'No warmth: not mitigated');

// Below 0F with warmth >= 3 => extreme cold, mitigated
exposure = checkExposureEffects(-10, 3, false);
assert(exposure.severity === 'extreme_cold', 'Below 0F with warmth 3: still extreme cold');
assert(exposure.mitigated === true, 'Warmth 3 mitigates extreme cold');

// Below 0F with shelter => mitigated
exposure = checkExposureEffects(-10, 0, true);
assert(exposure.mitigated === true, 'Shelter mitigates extreme cold');

// Between 0F and 32F => cold
exposure = checkExposureEffects(20, 0, false);
assert(exposure.severity === 'cold', '20F: cold severity');
assert(exposure.effect === 'discomfort', 'Cold causes discomfort');

// Cold with warmth >= 2 => mitigated
exposure = checkExposureEffects(20, 2, false);
assert(exposure.mitigated === true, 'Warmth 2 mitigates cold');

// Above 100F => extreme heat
exposure = checkExposureEffects(110, 0, false);
assert(exposure.severity === 'extreme_heat', 'Above 100F: extreme heat');
assert(exposure.effect === 'exhaustion', 'Extreme heat causes exhaustion');
assert(exposure.mitigated === false, 'No shelter: extreme heat not mitigated');

// Extreme heat with shelter => mitigated
exposure = checkExposureEffects(110, 0, true);
assert(exposure.mitigated === true, 'Shelter mitigates extreme heat');

// Between 85F and 100F => hot
exposure = checkExposureEffects(90, 0, false);
assert(exposure.severity === 'hot', '90F: hot severity');
assert(exposure.effect === 'water_doubled', 'Hot doubles water consumption');

// Exactly at thresholds
exposure = checkExposureEffects(0, 0, false);
assert(exposure.severity === 'cold', '0F: cold (not extreme cold since not below 0)');

exposure = checkExposureEffects(32, 0, false);
assert(exposure.severity === 'none', '32F: no exposure (not below 32)');

exposure = checkExposureEffects(85, 0, false);
assert(exposure.severity === 'none', '85F: no exposure (not above 85)');

exposure = checkExposureEffects(100, 0, false);
assert(exposure.severity === 'hot', '100F: hot (above 85, not above 100)');

// ============================================================
// 13. rollNewWeather — Generates valid weather objects
// ============================================================
console.log('\n=== Test 13: rollNewWeather ===\n');

// Basic call — returns expected shape
let weather = rollNewWeather('summer', 'temperate');
assert(weather !== null && typeof weather === 'object', 'Returns an object');
assert(typeof weather.weather_type === 'string', 'Has weather_type string');
assert(typeof weather.weather_duration_hours === 'number', 'Has weather_duration_hours number');
assert(weather.weather_duration_hours > 0, 'Duration is positive');
assert(WEATHER_TYPES[weather.weather_type] !== undefined, 'weather_type is a valid WEATHER_TYPES key');
assert(typeof weather.temperature_f === 'number', 'Has temperature_f number');
assert(typeof weather.wind_speed === 'string', 'Has wind_speed string');
assert(typeof weather.visibility === 'string', 'Has visibility string');
assert(typeof weather.precipitation === 'string', 'Has precipitation string');

// Winter roll
weather = rollNewWeather('winter', 'arctic');
assert(WEATHER_TYPES[weather.weather_type] !== undefined, 'Winter/arctic: valid weather type');
assert(weather.temperature_f < 80, 'Winter/arctic: temperature is cold');

// Underground always returns clear/calm
weather = rollNewWeather('winter', 'underground');
assert(weather.weather_type === 'clear', 'Underground: always clear');
assert(weather.temperature_f === 55, 'Underground: always 55F');
assert(weather.wind_speed === 'calm', 'Underground: always calm wind');
assert(weather.weather_duration_hours === 24, 'Underground: 24hr duration');

// Multiple rolls all produce valid types (stochastic check)
let allValid = true;
for (let i = 0; i < 50; i++) {
  const w = rollNewWeather('spring', 'coastal');
  if (!WEATHER_TYPES[w.weather_type]) {
    allValid = false;
    break;
  }
}
assert(allValid, '50 consecutive spring/coastal rolls all produce valid weather types');

// Desert roll — should never produce snow or blizzard (weights would be 0)
let noSnowInDesert = true;
for (let i = 0; i < 100; i++) {
  const w = rollNewWeather('summer', 'desert');
  if (w.weather_type === 'snow' || w.weather_type === 'blizzard') {
    noSnowInDesert = false;
    break;
  }
}
assert(noSnowInDesert, '100 desert/summer rolls never produce snow or blizzard');

// ============================================================
// 14. detectWeatherChange — Marker present and absent
// ============================================================
console.log('\n=== Test 14: detectWeatherChange ===\n');

let wc = detectWeatherChange('[WEATHER_CHANGE: Type="thunderstorm" Duration_Hours=6]');
assert(wc !== null, 'Detects weather change marker');
assert(wc.type === 'thunderstorm', 'Parses weather type');
assert(wc.duration_hours === 6, 'Parses duration hours');

// Default duration
wc = detectWeatherChange('[WEATHER_CHANGE: Type="rain"]');
assert(wc !== null, 'Detects marker without duration');
assert(wc.duration_hours === 24, 'Default duration is 24 hours');

// No marker
wc = detectWeatherChange('The sky darkens but no marker here.');
assert(wc === null, 'No marker returns null');

// Missing type field
wc = detectWeatherChange('[WEATHER_CHANGE: Duration_Hours=12]');
assert(wc === null, 'Missing Type returns null');

// Null input
wc = detectWeatherChange(null);
assert(wc === null, 'Null input returns null');

// Empty input
wc = detectWeatherChange('');
assert(wc === null, 'Empty input returns null');

// Case insensitive
wc = detectWeatherChange('[weather_change: Type="snow" Duration_Hours=12]');
assert(wc !== null, 'Case-insensitive detection');
assert(wc.type === 'snow', 'Parses type case-insensitively');

// ============================================================
// 15. detectShelterFound — Marker present and absent
// ============================================================
console.log('\n=== Test 15: detectShelterFound ===\n');

let sf = detectShelterFound('[SHELTER_FOUND: Type="cave" Quality="adequate"]');
assert(sf !== null, 'Detects shelter found marker');
assert(sf.type === 'cave', 'Parses shelter type');
assert(sf.quality === 'adequate', 'Parses quality');

// Default quality
sf = detectShelterFound('[SHELTER_FOUND: Type="building"]');
assert(sf !== null, 'Detects marker without quality');
assert(sf.quality === 'adequate', 'Default quality is adequate');

// No marker
sf = detectShelterFound('You find nothing of interest.');
assert(sf === null, 'No marker returns null');

// Missing type
sf = detectShelterFound('[SHELTER_FOUND: Quality="good"]');
assert(sf === null, 'Missing Type returns null');

// Null input
sf = detectShelterFound(null);
assert(sf === null, 'Null input returns null');

// Empty input
sf = detectShelterFound('');
assert(sf === null, 'Empty input returns null');

// Case insensitive
sf = detectShelterFound('[shelter_found: Type="tent"]');
assert(sf !== null, 'Case-insensitive detection');

// ============================================================
// 16. detectSwim — Marker present and absent
// ============================================================
console.log('\n=== Test 16: detectSwim ===\n');

let swim = detectSwim('[SWIM: Duration="brief"]');
assert(swim !== null, 'Detects swim marker');
assert(swim.duration === 'brief', 'Parses duration');

// Extended duration
swim = detectSwim('[SWIM: Duration="extended"]');
assert(swim !== null, 'Detects extended swim');
assert(swim.duration === 'extended', 'Parses extended duration');

// Default duration
swim = detectSwim('[SWIM: SomeOtherField="value"]');
assert(swim !== null, 'Detects marker without duration field');
assert(swim.duration === 'brief', 'Default duration is brief');

// No marker
swim = detectSwim('The party crosses the bridge over the river.');
assert(swim === null, 'No marker returns null');

// Null input
swim = detectSwim(null);
assert(swim === null, 'Null input returns null');

// Empty input
swim = detectSwim('');
assert(swim === null, 'Empty input returns null');

// Case insensitive
swim = detectSwim('[swim: Duration="prolonged"]');
assert(swim !== null, 'Case-insensitive detection');
assert(swim.duration === 'prolonged', 'Parses duration case-insensitively');

// ============================================================
// Results
// ============================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
