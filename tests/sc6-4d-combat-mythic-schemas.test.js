/**
 * Phase 3 SC-6.4d — Combat / mythic / base defense cluster schema tests.
 *
 * Final SC-6.4 cluster ship. Closes out the four-ship sweep.
 *
 * 6 markers in this cluster:
 *   COMBAT_START          — schema + handler (heaviest single-marker
 *                           handler in SC-6.4 — rolls initiative for
 *                           player/companions/enemies, sorts turn order,
 *                           returns combatStart payload + systemNote)
 *   COMBAT_END            — schema + handler (presence-only, returns
 *                           truthy event for the route's combatEnd flag)
 *   BASE_DEFENSE_RESULT   — schema + handler (multi-instance; flips
 *                           threat status, returns systemNote)
 *   MYTHIC_TRIAL          — schema + handler (NEW schema; calls
 *                           recordTrial + optional advanceTier)
 *   ITEM_AWAKEN           — schema + handler (NEW schema; advances
 *                           legendary item state)
 *   MYTHIC_SURGE          — schema + handler (NEW schema; tracks
 *                           mythic-power consumption)
 *
 * Validates:
 *   1. All 6 schemas registered, all 6 handlers wired
 *   2. Per-schema field validation incl. the three NEW schemas
 *   3. Legacy detect-functions still exported
 *   4. End-to-end realistic narrative extraction
 *   5. Cross-pipeline isolation with prior SC-6.4 markers
 */

import {
  MARKER_SCHEMAS,
  parseMarkerBody,
  validateDmMarkers
} from '../server/services/markerSchemas.js'
import { _hasHandler } from '../server/services/markerPipeline.js'

// Force module-load side effects.
import '../server/services/mythicService.js'
import '../server/services/baseThreatService.js'
import '../server/services/combatMarkerService.js'

import * as dmSessionService from '../server/services/dmSessionService.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

const CLUSTER_KEYS = [
  'COMBAT_START', 'COMBAT_END', 'BASE_DEFENSE_RESULT',
  'MYTHIC_TRIAL', 'ITEM_AWAKEN', 'MYTHIC_SURGE'
]

console.log('\n=== All 6 cluster-5 schemas registered + handlers wired ===\n')
{
  for (const key of CLUSTER_KEYS) {
    assert(MARKER_SCHEMAS[key] !== undefined, `MARKER_SCHEMAS.${key} present`)
    assert(_hasHandler(key), `markerPipeline has handler for ${key}`)
  }
}

console.log('\n=== Legacy detect-functions still exported (deprecate by hiding) ===\n')
{
  for (const fn of [
    'detectCombatStart', 'detectCombatEnd', 'detectBaseDefenseResult',
    'detectMythicTrial', 'detectItemAwaken', 'detectMythicSurge',
    'estimateEnemyDexMod'
  ]) {
    assert(typeof dmSessionService[fn] === 'function', `${fn} still exported`)
  }
}

console.log('\n=== COMBAT_START / COMBAT_END (existing schemas pre-Phase-3) ===\n')
{
  const ok = parseMarkerBody('Enemies="goblin scout, dire wolf, bandit captain"', 'COMBAT_START')
  assert(ok.ok && ok.data.Enemies.includes('goblin scout'), 'enemies parses')
  const noEnemies = parseMarkerBody('', 'COMBAT_START')
  assert(!noEnemies.ok && noEnemies.errors.some(e => e.field === 'Enemies'), 'missing Enemies → error')
  const end = parseMarkerBody('', 'COMBAT_END')
  assert(end.ok, 'COMBAT_END (presence-only) parses with empty body')
}

console.log('\n=== BASE_DEFENSE_RESULT (existing schema pre-Phase-3) ===\n')
{
  const ok = parseMarkerBody(
    'Threat=42 Outcome=repelled Narrative="The watch held the wall"',
    'BASE_DEFENSE_RESULT'
  )
  assert(ok.ok && ok.data.Threat === 42 && ok.data.Outcome === 'repelled', 'canonical parses')
  const badOutcome = parseMarkerBody('Threat=1 Outcome=triumphant Narrative="X"', 'BASE_DEFENSE_RESULT')
  assert(!badOutcome.ok && badOutcome.errors.some(e => e.field === 'Outcome'), 'invalid Outcome enum → error')
}

console.log('\n=== MYTHIC_TRIAL (new SC-6.4d schema) ===\n')
{
  const ok = parseMarkerBody(
    'Name="The Bridge of Dawn" Description="Held the bridge alone" Outcome=passed',
    'MYTHIC_TRIAL'
  )
  assert(ok.ok && ok.data.Name === 'The Bridge of Dawn' && ok.data.Outcome === 'passed', 'canonical parses')
  const noName = parseMarkerBody('Outcome=failed', 'MYTHIC_TRIAL')
  assert(!noName.ok && noName.errors.some(e => e.field === 'Name'), 'missing Name → error')
  const badOutcome = parseMarkerBody('Name="X" Outcome=heroic', 'MYTHIC_TRIAL')
  assert(!badOutcome.ok && badOutcome.errors.some(e => e.field === 'Outcome'), 'invalid Outcome → error')
  const optionalDesc = parseMarkerBody('Name="X"', 'MYTHIC_TRIAL')
  assert(optionalDesc.ok, 'Description + Outcome both optional')
}

console.log('\n=== ITEM_AWAKEN (new SC-6.4d schema) ===\n')
{
  const ok = parseMarkerBody(
    'Item="Dawn\'s Light" NewState=awakened Deed="Struck down the shadow demon"',
    'ITEM_AWAKEN'
  )
  assert(ok.ok && ok.data.NewState === 'awakened', 'canonical parses')
  const exalted = parseMarkerBody('Item="X" NewState=exalted', 'ITEM_AWAKEN')
  assert(exalted.ok, 'exalted state parses')
  const mythic = parseMarkerBody('Item="X" NewState=mythic', 'ITEM_AWAKEN')
  assert(mythic.ok, 'mythic state parses')
  const badState = parseMarkerBody('Item="X" NewState=eternal', 'ITEM_AWAKEN')
  assert(!badState.ok && badState.errors.some(e => e.field === 'NewState'), 'invalid NewState → error')
  const noItem = parseMarkerBody('NewState=awakened', 'ITEM_AWAKEN')
  assert(!noItem.ok && noItem.errors.some(e => e.field === 'Item'), 'missing Item → error')
}

console.log('\n=== MYTHIC_SURGE (new SC-6.4d schema) ===\n')
{
  const ok = parseMarkerBody('Ability="divine_surge" Cost=2', 'MYTHIC_SURGE')
  assert(ok.ok && ok.data.Ability === 'divine_surge' && ok.data.Cost === 2, 'canonical parses')
  const defaultCost = parseMarkerBody('Ability="X"', 'MYTHIC_SURGE')
  assert(defaultCost.ok, 'Cost optional (handler defaults to 1)')
  const zeroCost = parseMarkerBody('Ability="X" Cost=0', 'MYTHIC_SURGE')
  assert(!zeroCost.ok && zeroCost.errors.some(e => e.field === 'Cost'), 'Cost=0 → min violation')
  const noAbility = parseMarkerBody('Cost=1', 'MYTHIC_SURGE')
  assert(!noAbility.ok && noAbility.errors.some(e => e.field === 'Ability'), 'missing Ability → error')
}

console.log('\n=== End-to-end: realistic combat/mythic turn extracts cleanly ===\n')
{
  const narrative = `
    The bandits pour out of the ruin. [COMBAT_START: Enemies="bandit captain, two thugs, one cultist"]
    You strike. They fall. [COMBAT_END]
    The trial held — you stood when the others ran. [MYTHIC_TRIAL: Name="The Bridge of Dawn" Outcome=passed]
    Dawn's Light hums in your hand. [ITEM_AWAKEN: Item="Dawn's Light" NewState=awakened Deed="Struck down the shadow demon"]
    You burn a surge to shape the strike. [MYTHIC_SURGE: Ability="divine_surge" Cost=1]
    The watchtower holds. [BASE_DEFENSE_RESULT: Threat=42 Outcome=repelled Narrative="The watch held the wall"]
  `
  const { validByKey, failures } = validateDmMarkers(narrative)
  for (const key of CLUSTER_KEYS) {
    assert(validByKey[key]?.length === 1, `${key} extracted`)
  }
  assert(failures.length === 0, 'all six markers valid; no failures')
}

console.log('\n=== Cross-pipeline isolation: prior SC-6.4 markers still validate ===\n')
{
  const narrative = `[PIETY_CHANGE: Deity="Lathander" Amount=1] [SHELTER_FOUND: Type=cave] [LOOT_DROP: Item="Gold"]`
  const { validByKey, failures } = validateDmMarkers(narrative)
  assert(validByKey.PIETY_CHANGE?.length === 1, 'SC-4 PIETY_CHANGE still validates')
  assert(validByKey.SHELTER_FOUND?.length === 1, 'SC-6.4a SHELTER_FOUND still validates')
  assert(validByKey.LOOT_DROP?.length === 1, 'SC-6.4b LOOT_DROP still validates')
  assert(failures.length === 0, 'no false failures from cluster-5 additions')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
