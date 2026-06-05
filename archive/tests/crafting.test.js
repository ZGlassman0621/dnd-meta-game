/**
 * Crafting System Tests — Comprehensive coverage for crafting recipes,
 * crafting-related marker detection, and recipe data integrity.
 */

import { DEFAULT_RECIPES } from '../server/data/craftingRecipes.js';
import {
  detectRecipeFound,
  detectMaterialFound,
  detectCraftProgress,
  detectRecipeGift
} from '../server/services/dmSessionService.js';
import { WEATHER_TYPES } from '../server/config/weather.js';

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
// 1. DEFAULT_RECIPES — Basic structure
// ============================================================
console.log('\n=== Test 1: DEFAULT_RECIPES — Basic Structure ===\n');

assert(Array.isArray(DEFAULT_RECIPES), 'DEFAULT_RECIPES is an array');
assert(DEFAULT_RECIPES.length >= 100, `DEFAULT_RECIPES has 100+ recipes (found ${DEFAULT_RECIPES.length})`);

// ============================================================
// 2. Required fields on every recipe
// ============================================================
console.log('\n=== Test 2: Required Fields on Every Recipe ===\n');

const REQUIRED_FIELDS = [
  'name', 'category', 'description', 'required_materials',
  'required_tools', 'craft_time_hours', 'difficulty_dc',
  'output_item', 'is_default'
];

let allHaveRequiredFields = true;
const missingFieldRecipes = [];

for (const recipe of DEFAULT_RECIPES) {
  for (const field of REQUIRED_FIELDS) {
    if (recipe[field] === undefined || recipe[field] === null) {
      // is_default can be 0 which is falsy but valid
      if (field === 'is_default' && recipe[field] === 0) continue;
      allHaveRequiredFields = false;
      missingFieldRecipes.push(`${recipe.name || 'UNNAMED'} missing ${field}`);
    }
  }
}

assert(allHaveRequiredFields, `All recipes have required fields${missingFieldRecipes.length ? ' — missing: ' + missingFieldRecipes.join(', ') : ''}`);

// Check individual field types on first recipe as a sample
const sample = DEFAULT_RECIPES[0];
assert(typeof sample.name === 'string', 'name is a string');
assert(typeof sample.category === 'string', 'category is a string');
assert(typeof sample.description === 'string', 'description is a string');
assert(typeof sample.required_materials === 'string', 'required_materials is a string (JSON)');
assert(typeof sample.required_tools === 'string', 'required_tools is a string (JSON)');
assert(typeof sample.craft_time_hours === 'number', 'craft_time_hours is a number');
assert(typeof sample.difficulty_dc === 'number', 'difficulty_dc is a number');
assert(typeof sample.output_item === 'string', 'output_item is a string (JSON)');
assert(typeof sample.is_default === 'number', 'is_default is a number');

// ============================================================
// 3. Expected categories exist
// ============================================================
console.log('\n=== Test 3: Expected Categories Exist ===\n');

const allCategories = new Set(DEFAULT_RECIPES.map(r => r.category));

const EXPECTED_CATEGORIES = ['potion', 'poison', 'weapon', 'food', 'adventuring_gear', 'scroll', 'ammunition', 'armor', 'alchemical'];

for (const cat of EXPECTED_CATEGORIES) {
  assert(allCategories.has(cat), `Category "${cat}" exists in recipes`);
}

// Additional categories may exist (armor, shelter) — that is fine
assert(allCategories.size >= EXPECTED_CATEGORIES.length, `At least ${EXPECTED_CATEGORIES.length} distinct categories (found ${allCategories.size})`);
console.log(`  (All categories found: ${[...allCategories].sort().join(', ')})`);

// ============================================================
// 4. Known recipes exist
// ============================================================
console.log('\n=== Test 4: Known Recipes Exist ===\n');

const recipeNames = new Set(DEFAULT_RECIPES.map(r => r.name));

assert(recipeNames.has('Potion of Healing'), '"Potion of Healing" recipe exists');
assert(recipeNames.has('Cook Rations (5 days)'), '"Cook Rations (5 days)" recipe exists');
assert(recipeNames.has('Craft Torch (5)'), '"Craft Torch (5)" recipe exists');
assert(recipeNames.has('Basic Poison'), '"Basic Poison" recipe exists');
assert(recipeNames.has('Antitoxin'), '"Antitoxin" recipe exists');
assert(recipeNames.has('Forge Dagger'), '"Forge Dagger" recipe exists');
assert(recipeNames.has('Craft Rope (50ft)'), '"Craft Rope (50ft)" recipe exists');

// New weapon recipes
assert(recipeNames.has('Forge Club'), '"Forge Club" simple weapon exists');
assert(recipeNames.has('Forge Spear'), '"Forge Spear" simple weapon exists');
assert(recipeNames.has('Forge Battleaxe'), '"Forge Battleaxe" martial weapon exists');
assert(recipeNames.has('Forge Greatsword'), '"Forge Greatsword" martial weapon exists');
assert(recipeNames.has('Craft Longbow'), '"Craft Longbow" ranged weapon exists');
assert(recipeNames.has('Craft Heavy Crossbow'), '"Craft Heavy Crossbow" ranged weapon exists');

// New armor recipes
assert(recipeNames.has('Craft Leather Armor'), '"Craft Leather Armor" exists');
assert(recipeNames.has('Craft Chain Mail'), '"Craft Chain Mail" exists');
assert(recipeNames.has('Craft Plate Armor'), '"Craft Plate Armor" exists');
assert(recipeNames.has('Craft Wooden Shield'), '"Craft Wooden Shield" exists');

// New ammunition
assert(recipeNames.has('Forge Crossbow Bolts (20)'), '"Forge Crossbow Bolts (20)" exists');

// New gear, food, alchemical
assert(recipeNames.has('Craft Grappling Hook'), '"Craft Grappling Hook" exists');
assert(recipeNames.has('Bake Hardtack'), '"Bake Hardtack" food exists');
assert(recipeNames.has('Craft Holy Water'), '"Craft Holy Water" alchemical exists');

// Verify Potion of Healing details
const healingPotion = DEFAULT_RECIPES.find(r => r.name === 'Potion of Healing');
assert(healingPotion.category === 'potion', 'Potion of Healing category is potion');
assert(healingPotion.is_default === 1, 'Potion of Healing is a default recipe');
assert(healingPotion.difficulty_dc === 10, 'Potion of Healing DC is 10');
assert(healingPotion.craft_time_hours === 4, 'Potion of Healing craft time is 4 hours');

// ============================================================
// 5. Default vs discoverable recipe counts
// ============================================================
console.log('\n=== Test 5: Default vs Discoverable Recipe Counts ===\n');

const defaultRecipes = DEFAULT_RECIPES.filter(r => r.is_default === 1);
const discoverableRecipes = DEFAULT_RECIPES.filter(r => r.is_default === 0);

assert(defaultRecipes.length >= 35, `Default recipes (is_default=1) count >= 35 (found ${defaultRecipes.length})`);
assert(defaultRecipes.length <= 55, `Default recipes (is_default=1) count <= 55 (found ${defaultRecipes.length})`);
assert(discoverableRecipes.length >= 50, `Discoverable recipes (is_default=0) count >= 50 (found ${discoverableRecipes.length})`);
assert(defaultRecipes.length + discoverableRecipes.length === DEFAULT_RECIPES.length, 'Default + discoverable = total recipes');

// ============================================================
// 6. detectRecipeFound — with marker
// ============================================================
console.log('\n=== Test 6: detectRecipeFound — Marker Detection ===\n');

let recipes = detectRecipeFound('[RECIPE_FOUND: Name="Potion of Healing" Source="ancient journal"]');
assert(recipes.length === 1, 'Detects single recipe found marker');
assert(recipes[0].name === 'Potion of Healing', 'Parses recipe name');
assert(recipes[0].source === 'ancient journal', 'Parses recipe source');

// Multiple markers
recipes = detectRecipeFound(
  'You find two recipes: [RECIPE_FOUND: Name="Antitoxin" Source="herbalist notes"] ' +
  'and [RECIPE_FOUND: Name="Basic Poison" Source="assassin manual"]'
);
assert(recipes.length === 2, 'Detects multiple recipe markers');
assert(recipes[0].name === 'Antitoxin', 'First recipe name correct');
assert(recipes[1].name === 'Basic Poison', 'Second recipe name correct');

// Default source
recipes = detectRecipeFound('[RECIPE_FOUND: Name="Craft Torch"]');
assert(recipes[0].source === 'found', 'Default source is "found"');

// No marker
recipes = detectRecipeFound('The old wizard shares his knowledge of alchemy.');
assert(recipes.length === 0, 'No marker returns empty array');

// Null/empty input
assert(detectRecipeFound(null).length === 0, 'Null input returns empty array');
assert(detectRecipeFound('').length === 0, 'Empty input returns empty array');

// Missing name
recipes = detectRecipeFound('[RECIPE_FOUND: Source="old book"]');
assert(recipes.length === 0, 'Missing Name returns empty array');

// ============================================================
// 7. detectMaterialFound — with marker
// ============================================================
console.log('\n=== Test 7: detectMaterialFound — Marker Detection ===\n');

let materials = detectMaterialFound('[MATERIAL_FOUND: Name="Healing Herbs" Quantity=3 Quality="standard"]');
assert(materials.length === 1, 'Detects single material found marker');
assert(materials[0].name === 'Healing Herbs', 'Parses material name');
assert(materials[0].quantity === 3, 'Parses quantity as number');
assert(materials[0].quality === 'standard', 'Parses quality');

// Multiple materials
materials = detectMaterialFound(
  '[MATERIAL_FOUND: Name="Metal Ingot" Quantity=2 Quality="fine"] ' +
  '[MATERIAL_FOUND: Name="Leather" Quantity=1]'
);
assert(materials.length === 2, 'Detects multiple material markers');
assert(materials[0].name === 'Metal Ingot', 'First material name correct');
assert(materials[0].quality === 'fine', 'First material quality correct');
assert(materials[1].name === 'Leather', 'Second material name correct');

// Defaults
materials = detectMaterialFound('[MATERIAL_FOUND: Name="Wood"]');
assert(materials[0].quantity === 1, 'Default quantity is 1');
assert(materials[0].quality === 'standard', 'Default quality is "standard"');

// No marker
materials = detectMaterialFound('You gather some sticks and leaves from the forest floor.');
assert(materials.length === 0, 'No marker returns empty array');

// Null/empty input
assert(detectMaterialFound(null).length === 0, 'Null input returns empty array');
assert(detectMaterialFound('').length === 0, 'Empty input returns empty array');

// Missing name
materials = detectMaterialFound('[MATERIAL_FOUND: Quantity=5 Quality="fine"]');
assert(materials.length === 0, 'Missing Name returns empty array');

// ============================================================
// 8. detectCraftProgress — with marker
// ============================================================
console.log('\n=== Test 8: detectCraftProgress — Marker Detection ===\n');

let progress = detectCraftProgress('[CRAFT_PROGRESS: Hours=4]');
assert(progress !== null, 'Detects craft progress marker');
assert(progress.hours === 4, 'Parses hours as number');

// Fractional hours
progress = detectCraftProgress('[CRAFT_PROGRESS: Hours=2.5]');
assert(progress !== null, 'Detects fractional hours');
assert(progress.hours === 2.5, 'Parses fractional hours correctly');

// No marker
progress = detectCraftProgress('You spend the afternoon working on your project.');
assert(progress === null, 'No marker returns null');

// Null/empty input
assert(detectCraftProgress(null) === null, 'Null input returns null');
assert(detectCraftProgress('') === null, 'Empty input returns null');

// Invalid hours
progress = detectCraftProgress('[CRAFT_PROGRESS: Hours=0]');
assert(progress === null, 'Zero hours returns null');

progress = detectCraftProgress('[CRAFT_PROGRESS: Hours=-2]');
assert(progress === null, 'Negative hours returns null');

// Missing hours field
progress = detectCraftProgress('[CRAFT_PROGRESS: Time=4]');
assert(progress === null, 'Wrong field name returns null');

// ============================================================
// 9. WEATHER_TYPES — existence check for crafting weather requirements
// ============================================================
console.log('\n=== Test 9: WEATHER_TYPES — Weather Requirement Validation ===\n');

assert(WEATHER_TYPES !== null && WEATHER_TYPES !== undefined, 'WEATHER_TYPES exists');
assert(typeof WEATHER_TYPES === 'object', 'WEATHER_TYPES is an object');
assert(Object.keys(WEATHER_TYPES).length > 0, 'WEATHER_TYPES has entries');
assert(WEATHER_TYPES.clear !== undefined, 'WEATHER_TYPES has "clear" type');

// Verify recipes with weather_requirement reference valid weather types
const recipesWithWeather = DEFAULT_RECIPES.filter(r => r.weather_requirement !== null);
let allWeatherValid = true;
for (const recipe of recipesWithWeather) {
  if (!WEATHER_TYPES[recipe.weather_requirement]) {
    allWeatherValid = false;
    console.log(`    WARNING: Recipe "${recipe.name}" references unknown weather "${recipe.weather_requirement}"`);
  }
}
assert(allWeatherValid, 'All recipe weather_requirements reference valid WEATHER_TYPES');
assert(recipesWithWeather.length > 0, `Some recipes have weather requirements (found ${recipesWithWeather.length})`);

// ============================================================
// 10. Data integrity — JSON strings are valid
// ============================================================
console.log('\n=== Test 10: Data Integrity — JSON Validity ===\n');

let allMaterialsValid = true;
let allToolsValid = true;
let allOutputValid = true;
const jsonErrors = [];

for (const recipe of DEFAULT_RECIPES) {
  // required_materials must be valid JSON array
  try {
    const mats = JSON.parse(recipe.required_materials);
    if (!Array.isArray(mats)) {
      allMaterialsValid = false;
      jsonErrors.push(`${recipe.name}: required_materials is not an array`);
    }
  } catch (e) {
    allMaterialsValid = false;
    jsonErrors.push(`${recipe.name}: required_materials invalid JSON — ${e.message}`);
  }

  // required_tools must be valid JSON array
  try {
    const tools = JSON.parse(recipe.required_tools);
    if (!Array.isArray(tools)) {
      allToolsValid = false;
      jsonErrors.push(`${recipe.name}: required_tools is not an array`);
    }
  } catch (e) {
    allToolsValid = false;
    jsonErrors.push(`${recipe.name}: required_tools invalid JSON — ${e.message}`);
  }

  // output_item must be valid JSON object
  try {
    const output = JSON.parse(recipe.output_item);
    if (typeof output !== 'object' || Array.isArray(output) || output === null) {
      allOutputValid = false;
      jsonErrors.push(`${recipe.name}: output_item is not an object`);
    }
  } catch (e) {
    allOutputValid = false;
    jsonErrors.push(`${recipe.name}: output_item invalid JSON — ${e.message}`);
  }
}

assert(allMaterialsValid, `All required_materials are valid JSON arrays${jsonErrors.length ? ' — errors: ' + jsonErrors.filter(e => e.includes('required_materials')).join('; ') : ''}`);
assert(allToolsValid, `All required_tools are valid JSON arrays${jsonErrors.length ? ' — errors: ' + jsonErrors.filter(e => e.includes('required_tools')).join('; ') : ''}`);
assert(allOutputValid, `All output_item are valid JSON objects${jsonErrors.length ? ' — errors: ' + jsonErrors.filter(e => e.includes('output_item')).join('; ') : ''}`);

// ============================================================
// 11. Data integrity — numeric field constraints
// ============================================================
console.log('\n=== Test 11: Data Integrity — Numeric Constraints ===\n');

let allCraftTimeValid = true;
let allDcValid = true;
const numericErrors = [];

for (const recipe of DEFAULT_RECIPES) {
  if (typeof recipe.craft_time_hours !== 'number' || recipe.craft_time_hours <= 0) {
    allCraftTimeValid = false;
    numericErrors.push(`${recipe.name}: craft_time_hours=${recipe.craft_time_hours}`);
  }
  if (typeof recipe.difficulty_dc !== 'number' || recipe.difficulty_dc < 1) {
    allDcValid = false;
    numericErrors.push(`${recipe.name}: difficulty_dc=${recipe.difficulty_dc}`);
  }
}

assert(allCraftTimeValid, `All craft_time_hours > 0${numericErrors.length ? ' — errors: ' + numericErrors.filter(e => e.includes('craft_time')).join('; ') : ''}`);
assert(allDcValid, `All difficulty_dc >= 1${numericErrors.length ? ' — errors: ' + numericErrors.filter(e => e.includes('difficulty_dc')).join('; ') : ''}`);

// ============================================================
// 12. Data integrity — all categories from expected set
// ============================================================
console.log('\n=== Test 12: Data Integrity — Category Validation ===\n');

const VALID_CATEGORIES = new Set([
  'potion', 'poison', 'weapon', 'armor', 'food',
  'adventuring_gear', 'scroll', 'ammunition', 'shelter', 'alchemical'
]);

let allCategoriesValid = true;
const invalidCategories = [];

for (const recipe of DEFAULT_RECIPES) {
  if (!VALID_CATEGORIES.has(recipe.category)) {
    allCategoriesValid = false;
    invalidCategories.push(`${recipe.name}: category="${recipe.category}"`);
  }
}

assert(allCategoriesValid, `All categories are from the valid set${invalidCategories.length ? ' — invalid: ' + invalidCategories.join('; ') : ''}`);

// ============================================================
// 13. Data integrity — unique recipe names
// ============================================================
console.log('\n=== Test 13: Data Integrity — Unique Recipe Names ===\n');

const nameCount = {};
for (const recipe of DEFAULT_RECIPES) {
  nameCount[recipe.name] = (nameCount[recipe.name] || 0) + 1;
}

const duplicates = Object.entries(nameCount).filter(([, count]) => count > 1);
assert(duplicates.length === 0, `All recipe names are unique${duplicates.length ? ' — duplicates: ' + duplicates.map(([n, c]) => `${n} (${c}x)`).join(', ') : ''}`);

// ============================================================
// 14. Data integrity — output_item has name field
// ============================================================
console.log('\n=== Test 14: Data Integrity — Output Items Have Names ===\n');

let allOutputsHaveName = true;
const missingOutputNames = [];

for (const recipe of DEFAULT_RECIPES) {
  try {
    const output = JSON.parse(recipe.output_item);
    if (!output.name || typeof output.name !== 'string') {
      allOutputsHaveName = false;
      missingOutputNames.push(recipe.name);
    }
  } catch {
    // JSON errors already caught in test 10
  }
}

assert(allOutputsHaveName, `All output_item objects have a name field${missingOutputNames.length ? ' — missing: ' + missingOutputNames.join(', ') : ''}`);

// ============================================================
// 15. detectRecipeGift — radiant recipe marker parsing
// ============================================================
console.log('\n=== Test 15: detectRecipeGift — Radiant Recipe Marker Parsing ===\n');

// Full marker
let gifts = detectRecipeGift('[RECIPE_GIFT: Name="Gerda\'s Mutton Stew" Category="food" Description="A hearty stew" Materials="Raw Meat:1,Herbs:1,Vegetables:1" Tools="Cook\'s Utensils" DC=10 Hours=2 Ability="wisdom" OutputName="Gerda\'s Mutton Stew" OutputDesc="A filling savory stew" GiftedBy="Gerda the Innkeeper"]');
assert(gifts.length === 1, 'Detects single recipe gift marker');
assert(gifts[0].name === "Gerda's Mutton Stew", 'Parses recipe name');
assert(gifts[0].category === 'food', 'Parses recipe category');
assert(gifts[0].materials.length === 3, 'Parses 3 materials from compact format');
assert(gifts[0].materials[0].name === 'Raw Meat', 'First material name correct');
assert(gifts[0].materials[0].quantity === 1, 'First material quantity correct');
assert(gifts[0].materials[2].name === 'Vegetables', 'Third material name correct');
assert(gifts[0].tools.length === 1, 'Parses tools array');
assert(gifts[0].tools[0] === "Cook's Utensils", 'Tool name correct');
assert(gifts[0].dc === 10, 'Parses DC as number');
assert(gifts[0].hours === 2, 'Parses hours as number');
assert(gifts[0].ability === 'wisdom', 'Parses ability');
assert(gifts[0].giftedBy === 'Gerda the Innkeeper', 'Parses gifted_by');

// Minimal marker (only required fields)
gifts = detectRecipeGift('[RECIPE_GIFT: Name="Simple Bread" Category="food"]');
assert(gifts.length === 1, 'Detects minimal marker with only name+category');
assert(gifts[0].name === 'Simple Bread', 'Minimal marker name correct');
assert(gifts[0].dc === 10, 'Default DC is 10');
assert(gifts[0].hours === 4, 'Default hours is 4');
assert(gifts[0].ability === 'intelligence', 'Default ability is intelligence');
assert(gifts[0].giftedBy === 'Unknown', 'Default giftedBy is Unknown');

// Tools="none" should be empty array
gifts = detectRecipeGift('[RECIPE_GIFT: Name="Herbal Salve" Category="alchemical" Tools="none" DC=8]');
assert(gifts[0].tools.length === 0, 'Tools="none" produces empty array');

// No marker
gifts = detectRecipeGift('The old chef teaches you a family recipe with a smile.');
assert(gifts.length === 0, 'No marker returns empty array');

// Null/empty input
assert(detectRecipeGift(null).length === 0, 'Null input returns empty array');
assert(detectRecipeGift('').length === 0, 'Empty input returns empty array');

// Missing required fields (name or category)
gifts = detectRecipeGift('[RECIPE_GIFT: Name="Unnamed"]');
assert(gifts.length === 0, 'Missing category returns empty array');

gifts = detectRecipeGift('[RECIPE_GIFT: Category="food"]');
assert(gifts.length === 0, 'Missing name returns empty array');

// ============================================================
// 16. Ability key mapping — recipes use long keys, DB uses short
// ============================================================
console.log('\n=== Test 16: Ability Key Mapping Validation ===\n');

const VALID_ABILITIES = new Set(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']);
const SHORT_ABILITIES = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);

let allAbilitiesValid = true;
const invalidAbilities = [];

for (const recipe of DEFAULT_RECIPES) {
  const ability = recipe.ability_check;
  if (ability && !VALID_ABILITIES.has(ability) && !SHORT_ABILITIES.has(ability)) {
    allAbilitiesValid = false;
    invalidAbilities.push(`${recipe.name}: ability_check="${ability}"`);
  }
}

assert(allAbilitiesValid, `All ability_check values are valid ability names${invalidAbilities.length ? ' — invalid: ' + invalidAbilities.join('; ') : ''}`);

// Verify the ability key mapping constant works correctly
const ABILITY_SHORT_KEYS = {
  strength: 'str', dexterity: 'dex', constitution: 'con',
  intelligence: 'int', wisdom: 'wis', charisma: 'cha'
};

function testGetAbilityMod(abilityScores, ability) {
  const key = ABILITY_SHORT_KEYS[ability] || ability;
  const score = abilityScores?.[key] ?? 10;
  return Math.floor((score - 10) / 2);
}

const testScores = { str: 16, dex: 14, con: 12, int: 18, wis: 8, cha: 10 };

assert(testGetAbilityMod(testScores, 'strength') === 3, 'Long key "strength" maps to str=16 → +3');
assert(testGetAbilityMod(testScores, 'dexterity') === 2, 'Long key "dexterity" maps to dex=14 → +2');
assert(testGetAbilityMod(testScores, 'intelligence') === 4, 'Long key "intelligence" maps to int=18 → +4');
assert(testGetAbilityMod(testScores, 'wisdom') === -1, 'Long key "wisdom" maps to wis=8 → -1');
assert(testGetAbilityMod(testScores, 'str') === 3, 'Short key "str" still works → +3');
assert(testGetAbilityMod(testScores, 'charisma') === 0, 'Long key "charisma" maps to cha=10 → +0');
assert(testGetAbilityMod(null, 'strength') === 0, 'Null scores defaults to 10 → +0');

// ============================================================
// 17. New recipe category coverage
// ============================================================
console.log('\n=== Test 17: New Recipe Category Coverage ===\n');

const weaponRecipes = DEFAULT_RECIPES.filter(r => r.category === 'weapon');
const armorRecipes = DEFAULT_RECIPES.filter(r => r.category === 'armor');
const ammoRecipes = DEFAULT_RECIPES.filter(r => r.category === 'ammunition');
const foodRecipes = DEFAULT_RECIPES.filter(r => r.category === 'food');
const gearRecipes = DEFAULT_RECIPES.filter(r => r.category === 'adventuring_gear');

assert(weaponRecipes.length >= 30, `Weapon recipes >= 30 (found ${weaponRecipes.length})`);
assert(armorRecipes.length >= 14, `Armor recipes >= 14 (found ${armorRecipes.length})`);
assert(ammoRecipes.length >= 3, `Ammunition recipes >= 3 (found ${ammoRecipes.length})`);
assert(foodRecipes.length >= 10, `Food recipes >= 10 (found ${foodRecipes.length})`);
assert(gearRecipes.length >= 20, `Adventuring gear recipes >= 20 (found ${gearRecipes.length})`);

// Verify PHB weapon coverage — simple weapons
const simpleWeapons = ['Club', 'Greatclub', 'Handaxe', 'Javelin', 'Light Hammer', 'Mace', 'Quarterstaff', 'Sickle', 'Spear'];
for (const wep of simpleWeapons) {
  const found = weaponRecipes.some(r => {
    try {
      const output = JSON.parse(r.output_item);
      return output.name === wep;
    } catch { return false; }
  });
  assert(found, `Simple weapon "${wep}" has a crafting recipe`);
}

// Verify PHB armor coverage
const armorTypes = ['Padded Armor', 'Leather Armor', 'Chain Mail', 'Plate Armor'];
for (const arm of armorTypes) {
  const found = armorRecipes.some(r => {
    try {
      const output = JSON.parse(r.output_item);
      return output.name === arm;
    } catch { return false; }
  });
  assert(found, `Armor type "${arm}" has a crafting recipe`);
}

// ============================================================
// Results
// ============================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
