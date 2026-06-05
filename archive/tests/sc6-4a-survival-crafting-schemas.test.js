/**
 * Phase 3 SC-6.4a — Survival + crafting cluster schema validation tests.
 *
 * Covers the 10 markers migrated to the pipeline in v1.0.150:
 *   SHELTER_FOUND, EAT, DRINK, FORAGE, SWIM (schema-only — no handler;
 *   the legacy detectSwim was exported but never invoked)
 *   WEATHER_CHANGE, CRAFT_PROGRESS, RECIPE_FOUND, MATERIAL_FOUND, RECIPE_GIFT
 *
 * Validates:
 *   1. All 10 schemas registered in MARKER_SCHEMAS
 *   2. Each schema parses canonical form correctly
 *   3. Each schema rejects malformed shapes with field-targeted errors
 *   4. 9 handlers registered (SWIM excluded by design)
 *   5. Legacy detect-functions still exported (back-compat per
 *      "deprecate by hiding")
 *   6. End-to-end: realistic narrative produces expected handlerResults
 *      shape via processResponseMarkers
 */

import {
  MARKER_SCHEMAS,
  parseMarkerBody,
  validateDmMarkers
} from '../server/services/markerSchemas.js'
import { _hasHandler } from '../server/services/markerPipeline.js'

// Force module-load side effects (handler registrations).
import '../server/services/survivalService.js'
import '../server/services/weatherService.js'
import '../server/services/craftingService.js'

import * as dmSessionService from '../server/services/dmSessionService.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

const NEW_SCHEMA_KEYS = [
  'SHELTER_FOUND', 'EAT', 'DRINK', 'FORAGE', 'SWIM',
  'WEATHER_CHANGE', 'CRAFT_PROGRESS', 'RECIPE_FOUND', 'MATERIAL_FOUND', 'RECIPE_GIFT'
]

const HANDLER_KEYS = [
  'SHELTER_FOUND', 'EAT', 'DRINK', 'FORAGE',
  'WEATHER_CHANGE', 'CRAFT_PROGRESS', 'RECIPE_FOUND', 'MATERIAL_FOUND', 'RECIPE_GIFT'
]

console.log('\n=== All 10 cluster-1a schemas registered ===\n')
{
  for (const key of NEW_SCHEMA_KEYS) {
    assert(MARKER_SCHEMAS[key] !== undefined, `MARKER_SCHEMAS.${key} present`)
  }
}

console.log('\n=== 9 handlers registered (SWIM is schema-only by design) ===\n')
{
  for (const key of HANDLER_KEYS) {
    assert(_hasHandler(key), `markerPipeline has handler for ${key}`)
  }
  assert(!_hasHandler('SWIM'), 'no handler for SWIM (schema-only — legacy detect was never invoked)')
}

console.log('\n=== Legacy detect-functions still exported (deprecate by hiding) ===\n')
{
  for (const fn of [
    'detectShelterFound', 'detectEat', 'detectDrink', 'detectForage', 'detectSwim',
    'detectWeatherChange', 'detectCraftProgress', 'detectRecipeFound',
    'detectMaterialFound', 'detectRecipeGift'
  ]) {
    assert(typeof dmSessionService[fn] === 'function', `${fn} still exported`)
  }
}

console.log('\n=== SHELTER_FOUND: Type enum required, Quality enum optional ===\n')
{
  const ok = parseMarkerBody('Type="cave"', 'SHELTER_FOUND')
  assert(ok.ok && ok.data.Type === 'cave', 'cave parses')
  const withQual = parseMarkerBody('Type=tent Quality=good', 'SHELTER_FOUND')
  assert(withQual.ok && withQual.data.Quality === 'good', 'optional Quality parses')
  const badType = parseMarkerBody('Type=igloo', 'SHELTER_FOUND')
  assert(!badType.ok && badType.errors.some(e => e.field === 'Type'), 'invalid Type → error')
  const noType = parseMarkerBody('Quality=adequate', 'SHELTER_FOUND')
  assert(!noType.ok && noType.errors.some(e => e.field === 'Type'), 'missing Type → error')
}

console.log('\n=== WEATHER_CHANGE: Type required, Duration_Hours optional positive int ===\n')
{
  const ok = parseMarkerBody('Type="heat_wave" Duration_Hours=12', 'WEATHER_CHANGE')
  assert(ok.ok && ok.data.Type === 'heat_wave' && ok.data.Duration_Hours === 12, 'full form parses')
  const noDuration = parseMarkerBody('Type="rain"', 'WEATHER_CHANGE')
  assert(noDuration.ok, 'duration optional')
  const badDuration = parseMarkerBody('Type="rain" Duration_Hours=0', 'WEATHER_CHANGE')
  assert(!badDuration.ok && badDuration.errors.some(e => e.field === 'Duration_Hours'), 'duration=0 → min violation')
}

console.log('\n=== EAT / DRINK: Item required ===\n')
{
  const ok = parseMarkerBody('Item="Trail Rations"', 'EAT')
  assert(ok.ok && ok.data.Item === 'Trail Rations', 'EAT canonical parses')
  const drink = parseMarkerBody('Item=Waterskin', 'DRINK')
  assert(drink.ok && drink.data.Item === 'Waterskin', 'DRINK with bareword parses')
  const noItem = parseMarkerBody('', 'EAT')
  assert(!noItem.ok && noItem.errors.some(e => e.field === 'Item'), 'missing Item → error')
}

console.log('\n=== FORAGE: Result enum optional, Food/Water non-negative ints ===\n')
{
  const ok = parseMarkerBody('Terrain=forest Result=success Food=2 Water=1', 'FORAGE')
  assert(ok.ok && ok.data.Food === 2 && ok.data.Water === 1, 'full form parses')
  const partial = parseMarkerBody('Terrain=desert Result=partial', 'FORAGE')
  assert(partial.ok && partial.data.Result === 'partial', 'partial result enum value')
  const badResult = parseMarkerBody('Result=bonanza', 'FORAGE')
  assert(!badResult.ok && badResult.errors.some(e => e.field === 'Result'), 'invalid Result → error')
  const negFood = parseMarkerBody('Food=-1', 'FORAGE')
  assert(!negFood.ok && negFood.errors.some(e => e.field === 'Food'), 'negative Food → min violation')
}

console.log('\n=== CRAFT_PROGRESS: Hours required positive int ===\n')
{
  const ok = parseMarkerBody('Hours=4', 'CRAFT_PROGRESS')
  assert(ok.ok && ok.data.Hours === 4, 'Hours=4 parses')
  const zero = parseMarkerBody('Hours=0', 'CRAFT_PROGRESS')
  assert(!zero.ok && zero.errors.some(e => e.field === 'Hours'), 'Hours=0 → min violation')
  const missing = parseMarkerBody('', 'CRAFT_PROGRESS')
  assert(!missing.ok && missing.errors.some(e => e.field === 'Hours'), 'missing Hours → error')
}

console.log('\n=== RECIPE_FOUND / MATERIAL_FOUND ===\n')
{
  const recipe = parseMarkerBody('Name="Potion of Healing" Source="ancient journal"', 'RECIPE_FOUND')
  assert(recipe.ok && recipe.data.Name === 'Potion of Healing', 'recipe canonical parses')
  const material = parseMarkerBody('Name="Healing Herbs" Quantity=3 Quality=fine', 'MATERIAL_FOUND')
  assert(material.ok && material.data.Quantity === 3 && material.data.Quality === 'fine', 'material with quality')
  const badQuality = parseMarkerBody('Name="Iron" Quality=legendary', 'MATERIAL_FOUND')
  assert(!badQuality.ok && badQuality.errors.some(e => e.field === 'Quality'), 'invalid Quality → error')
}

console.log('\n=== RECIPE_GIFT: Name + Category required, many optional fields ===\n')
{
  const ok = parseMarkerBody(
    'Name="Gerda\'s Stew" Category=food Description="Hearty stew" DC=10 Hours=2 GiftedBy="Gerda"',
    'RECIPE_GIFT'
  )
  assert(ok.ok && ok.data.Category === 'food' && ok.data.DC === 10, 'multi-field gift parses')
  const noCategory = parseMarkerBody('Name="X"', 'RECIPE_GIFT')
  assert(!noCategory.ok && noCategory.errors.some(e => e.field === 'Category'), 'missing Category → error')
  const badCategory = parseMarkerBody('Name="X" Category=trinket', 'RECIPE_GIFT')
  assert(!badCategory.ok && badCategory.errors.some(e => e.field === 'Category'), 'invalid Category → error')
}

console.log('\n=== End-to-end: validateDmMarkers extracts cluster-1 markers from realistic narrative ===\n')
{
  const narrative = `
    You crouch in the shelter. [SHELTER_FOUND: Type="cave" Quality="adequate"]
    The clouds break and the rain comes down hard. [WEATHER_CHANGE: Type="storm" Duration_Hours=6]
    You eat. [EAT: Item="Trail Rations"]
    You drink. [DRINK: Item="Waterskin"]
    You search the brush — handfuls of berries. [FORAGE: Terrain=forest Result=success Food=2]
  `
  const { validByKey, failures } = validateDmMarkers(narrative)
  assert(validByKey.SHELTER_FOUND?.length === 1, 'SHELTER_FOUND extracted')
  assert(validByKey.WEATHER_CHANGE?.length === 1, 'WEATHER_CHANGE extracted')
  assert(validByKey.EAT?.length === 1, 'EAT extracted')
  assert(validByKey.DRINK?.length === 1, 'DRINK extracted')
  assert(validByKey.FORAGE?.length === 1, 'FORAGE extracted')
  assert(failures.length === 0, 'all five markers valid; no failures')
}

console.log('\n=== Cross-pipeline isolation: cluster-1 markers don\'t collide with prior schemas ===\n')
{
  // Sanity check: introducing cluster-1 schemas didn't break prior pipelines.
  // PIETY_CHANGE (SC-4) and BOND_SHIFT (SC-5) still validate.
  const narrative = `[PIETY_CHANGE: Deity="Lathander" Amount=1] [BOND_SHIFT: From="Alice" To="Bob" Warmth=1]`
  const { validByKey, failures } = validateDmMarkers(narrative)
  assert(validByKey.PIETY_CHANGE?.length === 1, 'SC-4 PIETY_CHANGE still validates')
  assert(validByKey.BOND_SHIFT?.length === 1, 'SC-5 BOND_SHIFT still validates')
  assert(failures.length === 0, 'no false failures introduced by cluster-1 schemas')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
