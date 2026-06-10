/**
 * Phase 3 SC-6.1 — markerPipeline tests.
 *
 * Covers the public API (registerHandler, processResponseMarkers,
 * buildPendingCorrectionsNote) per spec §3.7. The pipeline composes
 * markerSchemas.js validation + ruleVerifiers.js rule violations into a
 * single dispatch surface; tests verify dispatch behavior + error
 * containment + correction-note composition.
 *
 * No DB; pipeline is pure logic over text + handler registry.
 */

import {
  registerHandler,
  processResponseMarkers,
  buildPendingCorrectionsNote,
  _resetHandlerRegistry,
  _getHandlerCount,
  _hasHandler
} from '../server/services/markerPipeline.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

// ---------------------------------------------------------------------------
// registerHandler
// ---------------------------------------------------------------------------

console.log('\n=== registerHandler: validates arguments ===\n')
{
  _resetHandlerRegistry()
  let threw

  threw = false
  try { registerHandler('', () => {}) } catch { threw = true }
  assert(threw, 'rejects empty schemaKey')

  threw = false
  try { registerHandler(null, () => {}) } catch { threw = true }
  assert(threw, 'rejects null schemaKey')

  threw = false
  try { registerHandler('CONDITION_ADD', 'not-a-function') } catch { threw = true }
  assert(threw, 'rejects non-function handler')

  // Valid registration succeeds
  registerHandler('CONDITION_ADD', () => {})
  assert(_getHandlerCount() === 1, 'registers handler')
  assert(_hasHandler('CONDITION_ADD'), 'registry reports handler present')
}

console.log('\n=== registerHandler: replacement logs warning but succeeds ===\n')
{
  _resetHandlerRegistry()
  registerHandler('LOOT_DROP', () => 'first')
  // Suppress warning during this test
  const origWarn = console.warn
  let warnCalled = false
  console.warn = () => { warnCalled = true }
  try {
    registerHandler('LOOT_DROP', () => 'second')
  } finally {
    console.warn = origWarn
  }
  assert(warnCalled, 'replacement logs warning')
  assert(_getHandlerCount() === 1, 'still only one handler (replacement)')
}

// ---------------------------------------------------------------------------
// processResponseMarkers — empty registry / no markers
// ---------------------------------------------------------------------------

console.log('\n=== processResponseMarkers: empty handler registry doesnt crash ===\n')
{
  _resetHandlerRegistry()
  // Text contains a real marker, but no handler registered
  const text = '[LOOT_DROP: Item="Gold pouch" Source="chest"]'
  const result = await processResponseMarkers(text, { characterId: 1 })
  assert(Array.isArray(result.handlerResults), 'returns handlerResults array')
  assert(result.handlerResults.length === 0, 'no dispatches when no handler registered')
  assert(Array.isArray(result.failures), 'returns failures array')
}

console.log('\n=== processResponseMarkers: no markers in text returns empty results ===\n')
{
  _resetHandlerRegistry()
  registerHandler('LOOT_DROP', async () => 'fired')
  const result = await processResponseMarkers('Just some narrative prose with no markers.', { characterId: 1 })
  assert(result.handlerResults.length === 0, 'no markers, no handlers fire')
  assert(result.failures.length === 0, 'no markers, no failures')
}

// ---------------------------------------------------------------------------
// processResponseMarkers — successful dispatch
// ---------------------------------------------------------------------------

console.log('\n=== processResponseMarkers: dispatches to registered handler ===\n')
{
  _resetHandlerRegistry()
  const fired = []
  registerHandler('LOOT_DROP', async (parsed, ctx) => {
    fired.push({ parsed, ctx })
    return { applied: true }
  })
  const text = '[LOOT_DROP: Item="Brass key" Source="goblin"]'
  const result = await processResponseMarkers(text, { characterId: 7, sessionId: 99 })
  assert(fired.length === 1, 'handler fired once')
  assert(fired[0].parsed.Item === 'Brass key', 'parsed marker passed to handler')
  assert(fired[0].parsed.Source === 'goblin', 'all parsed fields present')
  assert(fired[0].ctx.characterId === 7, 'context passed through')
  assert(fired[0].ctx.sessionId === 99, 'all context fields present')
  assert(result.handlerResults.length === 1, 'one handlerResult')
  assert(result.handlerResults[0].ok === true, 'handlerResult marked ok')
  assert(result.handlerResults[0].result.applied === true, 'handler return value carried in result')
}

console.log('\n=== processResponseMarkers: handles multiple instances of same marker ===\n')
{
  _resetHandlerRegistry()
  const fired = []
  registerHandler('LOOT_DROP', async (parsed) => { fired.push(parsed.Item) })
  const text = '[LOOT_DROP: Item="Sword"] some prose [LOOT_DROP: Item="Shield" Source="bandit"]'
  const result = await processResponseMarkers(text, {})
  assert(fired.length === 2, 'two instances fire two handler calls')
  assert(fired[0] === 'Sword' && fired[1] === 'Shield', 'both parsed correctly')
  assert(result.handlerResults.length === 2, 'two handlerResults')
  assert(result.handlerResults.every(r => r.ok), 'both marked ok')
}

console.log('\n=== processResponseMarkers: dispatches multiple different schemas ===\n')
{
  _resetHandlerRegistry()
  const fired = []
  registerHandler('LOOT_DROP', async (parsed) => { fired.push(['LOOT_DROP', parsed.Item]) })
  registerHandler('CONDITION_ADD', async (parsed) => { fired.push(['CONDITION_ADD', parsed.Target]) })
  const text = `
    Some prose. [LOOT_DROP: Item="Coin"]
    More prose. [CONDITION_ADD: Target="Elara" Condition="poisoned"]
  `
  const result = await processResponseMarkers(text, {})
  assert(fired.length === 2, 'both schemas dispatched')
  assert(result.handlerResults.length === 2, 'both in result')
}

// ---------------------------------------------------------------------------
// processResponseMarkers — handler error containment
// ---------------------------------------------------------------------------

console.log('\n=== processResponseMarkers: handler error contained, doesnt block other markers ===\n')
{
  _resetHandlerRegistry()
  let secondFired = false
  registerHandler('LOOT_DROP', async () => { throw new Error('intentional handler failure') })
  registerHandler('CONDITION_ADD', async () => { secondFired = true })
  const text = `
    [LOOT_DROP: Item="Boom"]
    [CONDITION_ADD: Target="Mara" Condition="charmed"]
  `
  const origError = console.error
  console.error = () => {}
  let result
  try {
    result = await processResponseMarkers(text, {})
  } finally {
    console.error = origError
  }
  assert(secondFired, 'second handler fires despite first throwing')
  assert(result.handlerResults.length === 2, 'both in handlerResults')
  const failed = result.handlerResults.find(r => !r.ok)
  const succeeded = result.handlerResults.find(r => r.ok)
  assert(failed && failed.schemaKey === 'LOOT_DROP', 'failed handlerResult has schemaKey')
  assert(failed.error === 'intentional handler failure', 'failed handlerResult carries error message')
  assert(succeeded && succeeded.schemaKey === 'CONDITION_ADD', 'successful handlerResult also present')
}

// ---------------------------------------------------------------------------
// processResponseMarkers — schema validation failures pass through
// ---------------------------------------------------------------------------

console.log('\n=== processResponseMarkers: malformed markers surface in failures, not handlerResults ===\n')
{
  _resetHandlerRegistry()
  let fired = false
  registerHandler('CONDITION_ADD', async () => { fired = true })
  // CONDITION_ADD.Condition is an enum; "huge" is invalid → validation fails →
  // handler should NOT fire and the failure must surface.
  const text = '[CONDITION_ADD: Target="Player" Condition="huge"]'
  const result = await processResponseMarkers(text, {})
  assert(!fired, 'malformed marker does NOT trigger handler')
  assert(result.failures.length > 0, 'failure surfaced')
  assert(result.failures[0].schemaKey === 'CONDITION_ADD', 'failure carries schemaKey')
}

// ---------------------------------------------------------------------------
// buildPendingCorrectionsNote
// ---------------------------------------------------------------------------

console.log('\n=== buildPendingCorrectionsNote: returns null when both empty ===\n')
{
  assert(buildPendingCorrectionsNote({ markerFailures: [], ruleViolations: [] }) === null, 'empty inputs → null')
  assert(buildPendingCorrectionsNote({}) === null, 'no inputs → null')
  assert(buildPendingCorrectionsNote() === null, 'undefined → null')
}

console.log('\n=== buildPendingCorrectionsNote: composes marker-only failures ===\n')
{
  const note = buildPendingCorrectionsNote({
    markerFailures: [
      { schemaKey: 'CONDITION_ADD', errors: [{ field: 'Condition', reason: 'expected one of {blinded|charmed|...}, got "huge"' }] }
    ],
    ruleViolations: []
  })
  assert(typeof note === 'string' && note.length > 0, 'returns non-empty string')
  assert(note.includes('CONDITION_ADD'), 'note mentions schema key')
  assert(note.includes('Condition'), 'note mentions field')
}

console.log('\n=== buildPendingCorrectionsNote: composes rule-violation only ===\n')
{
  const note = buildPendingCorrectionsNote({
    markerFailures: [],
    ruleViolations: [
      { rule: 'mechanical_roll_leak', description: 'roll-number recited', snippet: 'you rolled an 11' }
    ]
  })
  assert(typeof note === 'string' && note.length > 0, 'returns non-empty string')
  assert(note.includes('mechanical') || note.includes('roll'), 'note covers the rule violation')
}

console.log('\n=== buildPendingCorrectionsNote: combines both inputs ===\n')
{
  const note = buildPendingCorrectionsNote({
    markerFailures: [
      { schemaKey: 'HP_CHANGE', errors: [{ field: 'Delta', reason: 'expected integer, got "lots"' }] }
    ],
    ruleViolations: [
      { rule: 'meta_parenthetical', description: 'parenthetical DM commentary', snippet: '(Note: this sets up Act 2)' }
    ]
  })
  assert(note.includes('HP_CHANGE'), 'note covers marker failure')
  assert(note.includes('parenthetical') || note.includes('STAY IN THE WORLD'), 'note covers rule violation')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
