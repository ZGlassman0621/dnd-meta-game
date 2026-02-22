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
// STARVATION CHECK (D&D 5e PHB p.185)
// ============================================================

/**
 * Evaluate starvation status per D&D 5e rules.
 *
 * A character can go without food for 3 + CON modifier days (minimum 1).
 * After that, they gain 1 level of exhaustion per additional day.
 * A normal day of eating resets the counter.
 *
 * @param {object} character - Character row from DB
 * @returns {{ starving: boolean, hungry: boolean, exhaustion_level?: number, days_remaining?: number, message: string }}
 */
export function checkStarvation(character) {
  const conMod = getConMod(character);
  const threshold = Math.max(3 + conMod, 1);
  const daysWithout = character.days_without_food || 0;

  if (daysWithout > threshold) {
    const overDays = daysWithout - threshold;
    return {
      starving: true,
      hungry: true,
      exhaustion_level: 1,
      message: `Going without food for ${daysWithout} days (threshold: ${threshold}). Gaining 1 level of exhaustion. (${overDays} day${overDays > 1 ? 's' : ''} past limit)`
    };
  }

  if (daysWithout > 0) {
    const remaining = threshold - daysWithout;
    return {
      starving: false,
      hungry: true,
      days_remaining: remaining,
      message: `Hungry for ${daysWithout} day${daysWithout > 1 ? 's' : ''}. Can endure ${remaining} more day${remaining > 1 ? 's' : ''} before exhaustion sets in.`
    };
  }

  return { starving: false, hungry: false, message: '' };
}

// ============================================================
// DEHYDRATION CHECK (D&D 5e PHB p.185)
// ============================================================

/**
 * Evaluate dehydration status per D&D 5e rules.
 *
 * Without water: 1 level of exhaustion per day.
 * If already dehydrated (days_without_water >= 2): gain 2 levels instead.
 * Hot weather (heat_wave or temp > 85) doubles water needs — 0.5 days
 * without water counts as a full day.
 *
 * @param {object} character - Character row from DB
 * @param {object} weather - Weather object with type and temperature_f
 * @returns {{ dehydrated: boolean, exhaustion_levels: number, message: string }}
 */
export function checkDehydration(character, weather) {
  const daysWithout = character.days_without_water || 0;

  if (daysWithout < 1) {
    return { dehydrated: false, exhaustion_levels: 0, message: '' };
  }

  // Determine if hot conditions apply
  const isHot = weather &&
    (weather.type === 'heat_wave' || weather.weather_type === 'heat_wave' ||
     (weather.temperature_f && weather.temperature_f > 85));

  // Already dehydrated from prior days — gain 2 levels
  const exhaustionLevels = daysWithout >= 2 ? 2 : 1;

  let message = `No water for ${daysWithout} day${daysWithout > 1 ? 's' : ''}. Gaining ${exhaustionLevels} level${exhaustionLevels > 1 ? 's' : ''} of exhaustion.`;

  if (isHot) {
    message += ' Hot conditions double water needs — situation is critical.';
  }

  return {
    dehydrated: true,
    exhaustion_levels: exhaustionLevels,
    message
  };
}

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
    // Persist updated inventory with spoiled items
    await dbRun(
      'UPDATE characters SET inventory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(spoilageResult.updated_inventory), characterId]
    );
  }

  // --- Hunger tracking ---
  let daysWithoutFood = character.days_without_food || 0;
  const lastMealDay = character.last_meal_game_day;
  if (lastMealDay == null || lastMealDay < currentGameDay) {
    daysWithoutFood += 1;
  }

  // --- Thirst tracking ---
  let daysWithoutWater = character.days_without_water || 0;
  const lastDrinkDay = character.last_drink_game_day;
  if (lastDrinkDay == null || lastDrinkDay < currentGameDay) {
    daysWithoutWater += 1;
  }

  // Update character with new counters for starvation/dehydration checks
  const updatedChar = { ...character, days_without_food: daysWithoutFood, days_without_water: daysWithoutWater };

  // --- Starvation effects ---
  const hungerStatus = checkStarvation(updatedChar);
  if (hungerStatus.starving) {
    effectsApplied.push(`Starvation: +1 exhaustion (day ${daysWithoutFood})`);
  } else if (hungerStatus.hungry) {
    warnings.push(hungerStatus.message);
  }

  // --- Dehydration effects ---
  const thirstStatus = checkDehydration(updatedChar, weather);
  if (thirstStatus.dehydrated) {
    effectsApplied.push(`Dehydration: +${thirstStatus.exhaustion_levels} exhaustion (day ${daysWithoutWater})`);
  }

  // --- Persist hunger/thirst counters ---
  await dbRun(
    'UPDATE characters SET days_without_food = ?, days_without_water = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [daysWithoutFood, daysWithoutWater, characterId]
  );

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
  const threshold = Math.max(3 + conMod, 1);
  const daysWithoutFood = character.days_without_food || 0;
  const daysWithoutWater = character.days_without_water || 0;
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

  // --- Perishable food warnings ---
  const currentDay = character.game_day || 0;
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
