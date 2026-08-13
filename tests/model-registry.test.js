/**
 * Model registry — pin resolution, staleness comparison, persistence (v1.0.183).
 *
 * The registry is the one place that knows which Claude model this install runs.
 * Before it existed, five call sites hardcoded their own copies and two of them
 * were a generation out of date. These tests cover the three behaviours that
 * make it trustworthy as a single source of truth:
 *
 *   1. `newestFor` reads the catalog's ORDER, never the string. `claude-opus-5`
 *      sorts before `claude-opus-4-8` alphabetically while being newer, so any
 *      implementation that sorted locally would pick the wrong model — and would
 *      do it silently, on a real upgrade.
 *   2. `comparePins` reports rather than enforces. Nothing in the registry may
 *      adopt a model on its own: a new generation can change request semantics,
 *      which is a decision for a human with the release notes open.
 *   3. Persistence round-trips through `_app_settings`, and hydration is
 *      failure-tolerant — a model pin is a preference, not a prerequisite.
 *
 * No network and no billed calls: the catalog is passed in as a fixture. The
 * persistence tests run against the throwaway DB `run-tests.js` provides.
 */

import { initDatabase, dbGet, dbRun } from '../server/database.js'
import {
  opusModel,
  sonnetModel,
  getPins,
  setPins,
  getDefaultPins,
  newestFor,
  comparePins,
  hydratePins,
  persistPins,
  resetPins
} from '../server/services/modelRegistry.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.log(`  ✗ ${message}`)
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${JSON.stringify(actual)})`)
}

// A catalog in the order the API actually returns: newest first. Deliberately
// includes Fable (a family we never pin) and a date-suffixed Haiku.
const CATALOG = [
  { id: 'claude-opus-5', displayName: 'Claude Opus 5' },
  { id: 'claude-sonnet-5', displayName: 'Claude Sonnet 5' },
  { id: 'claude-fable-5', displayName: 'Claude Fable 5' },
  { id: 'claude-opus-4-8', displayName: 'Claude Opus 4.8' },
  { id: 'claude-opus-4-7', displayName: 'Claude Opus 4.7' },
  { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5' }
]

async function run() {
  const original = getPins()

  // ============================================================
  console.log('\n=== Test 1: newestFor reads catalog order, not string order ===\n')
  // ============================================================

  assertEqual(newestFor('opus', CATALOG), 'claude-opus-5', 'newest opus is the first opus in the list')
  assertEqual(newestFor('sonnet', CATALOG), 'claude-sonnet-5', 'newest sonnet is the first sonnet in the list')

  // The load-bearing case. Alphabetically 'claude-opus-4-8' < 'claude-opus-5',
  // so a sort-based implementation would return 4.8 as "newest".
  assert(
    'claude-opus-4-8' < 'claude-opus-5' && newestFor('opus', CATALOG) === 'claude-opus-5',
    'order beats string comparison — 4-8 sorts before 5 yet 5 is returned'
  )

  assertEqual(newestFor('opus', []), null, 'an empty catalog yields no newest')
  assertEqual(newestFor('haiku', [{ id: 'claude-fable-5' }]), null, 'a family absent from the catalog yields null')
  assert(
    newestFor('opus', [{ id: 'claude-fable-5' }, { id: 'claude-sonnet-5' }]) === null,
    'Fable and Sonnet are not mistaken for Opus'
  )

  // ============================================================
  console.log('\n=== Test 2: comparePins reports staleness ===\n')
  // ============================================================

  setPins({ opus: 'claude-opus-5', sonnet: 'claude-sonnet-5' })
  let cmp = comparePins(CATALOG)
  assertEqual(cmp.anyStale, false, 'current pins are not stale')
  assertEqual(cmp.opus.stale, false, 'opus not stale')

  setPins({ opus: 'claude-opus-4-7' })
  cmp = comparePins(CATALOG)
  assertEqual(cmp.anyStale, true, 'an old opus pin is detected as stale')
  assertEqual(cmp.opus.pinned, 'claude-opus-4-7', 'comparison reports what is pinned')
  assertEqual(cmp.opus.newest, 'claude-opus-5', 'comparison reports what is newest')
  assertEqual(cmp.sonnet.stale, false, 'the other family is unaffected')

  // Reporting must not mutate. This is the whole safety property: a staleness
  // check that quietly re-pinned would adopt a new generation with no review.
  assertEqual(opusModel(), 'claude-opus-4-7', 'comparePins did not adopt the newer model')

  // ============================================================
  console.log('\n=== Test 3: setPins guards against blanking a pin ===\n')
  // ============================================================

  setPins({ opus: 'claude-opus-5', sonnet: 'claude-sonnet-5' })
  setPins({ opus: '' })
  assertEqual(opusModel(), 'claude-opus-5', 'an empty string is ignored')
  setPins({ opus: undefined, sonnet: undefined })
  assertEqual(sonnetModel(), 'claude-sonnet-5', 'undefined values are ignored')
  setPins({})
  assertEqual(opusModel(), 'claude-opus-5', 'an empty object is a no-op')

  // ============================================================
  console.log('\n=== Test 4: persistence round-trips through _app_settings ===\n')
  // ============================================================

  await initDatabase()

  await resetPins()
  assertEqual(opusModel(), getDefaultPins().opus, 'reset restores the shipped opus default')

  await persistPins({ opus: 'claude-opus-4-8' })
  const row = await dbGet('SELECT value FROM _app_settings WHERE key = ?', ['model_pin_opus'])
  assertEqual(row?.value, 'claude-opus-4-8', 'the pin reached the settings table')

  // Simulate a restart: clobber the cache, then hydrate from storage.
  setPins({ opus: 'claude-opus-CACHE-ONLY' })
  await hydratePins()
  assertEqual(opusModel(), 'claude-opus-4-8', 'hydration overwrites the cache from storage')

  // A pin written twice must update, not duplicate — the ON CONFLICT clause.
  await persistPins({ opus: 'claude-opus-4-7' })
  const count = await dbGet("SELECT COUNT(*) AS n FROM _app_settings WHERE key = 'model_pin_opus'")
  assertEqual(Number(count.n), 1, 'a second write updates rather than inserting a duplicate')

  await resetPins()
  const gone = await dbGet('SELECT value FROM _app_settings WHERE key = ?', ['model_pin_opus'])
  assert(gone == null, `reset clears the persisted row (got ${JSON.stringify(gone)})`)
  assertEqual(opusModel(), getDefaultPins().opus, 'reset falls back to the shipped default')

  // ============================================================
  console.log('\n=== Test 5: hydration tolerates a missing table ===\n')
  // ============================================================

  // A model pin is a preference, not a prerequisite. If settings are
  // unreachable, hydration must log and carry on rather than take the boot down.
  await dbRun('DROP TABLE IF EXISTS _app_settings')
  let threw = false
  try {
    await hydratePins()
  } catch {
    threw = true
  }
  assert(!threw, 'hydration does not throw when the settings table is missing')
  assertEqual(opusModel(), getDefaultPins().opus, 'defaults still resolve without storage')

  // Put the table back so a later test in the same DB is not surprised by it.
  await dbRun('CREATE TABLE IF NOT EXISTS _app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')

  setPins(original)
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

await run()
