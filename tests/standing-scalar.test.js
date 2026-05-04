/**
 * Phase 3 SC-1 — standingScalar abstraction tests.
 *
 * Covers the public API (adjustStanding, getStanding, formatStandingForPrompt,
 * registerThresholdHandler) and the internal helpers (clampToRange, mapToLabel,
 * detectThresholdCrossings) per spec §2.3.
 *
 * Repository callbacks are in-memory stubs — the abstraction never builds SQL
 * itself, so a Map-backed stub fully exercises the abstraction's behavior.
 * This is closer to a pure-unit test than canon-transfer.test.js's in-memory
 * libsql pattern, because the abstraction's contract is "consumer owns
 * storage"; verifying that the abstraction calls the repository correctly is
 * the contract.
 */

import {
  adjustStanding,
  getStanding,
  formatStandingForPrompt,
  registerThresholdHandler,
  clampToRange,
  mapToLabel,
  detectThresholdCrossings,
  AUDIT_STRATEGIES,
  _resetThresholdHandlers,
  _getThresholdHandlerCount
} from '../server/services/standingScalar.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

/**
 * Build an in-memory repository stub. Storage is a Map keyed by
 * JSON.stringify(contextKey). Audit entries accumulate in a parallel Map.
 */
function makeRepo() {
  const scores = new Map()
  const trails = new Map()
  return {
    scores, trails,
    repository: {
      async readScore(ctx) {
        return scores.has(JSON.stringify(ctx)) ? scores.get(JSON.stringify(ctx)) : null
      },
      async writeScore(ctx, newScore) {
        scores.set(JSON.stringify(ctx), newScore)
      },
      async readAuditTrail(ctx, limit) {
        const all = trails.get(JSON.stringify(ctx)) || []
        return all.slice(-limit)
      },
      async appendAuditEntry(ctx, entry) {
        const key = JSON.stringify(ctx)
        if (!trails.has(key)) trails.set(key, [])
        trails.get(key).push(entry)
      }
    }
  }
}

// Reusable label-band fixture matching companion loyalty's bands.
const LOYALTY_BANDS = [
  { atOrAbove: 90, label: 'devoted' },
  { atOrAbove: 75, label: 'loyal' },
  { atOrAbove: 50, label: 'trusted' },
  { atOrAbove: 25, label: 'uncertain' },
  { atOrAbove: 10, label: 'distrustful' },
  { atOrAbove: 0,  label: 'hostile' }
]

// ---------------------------------------------------------------------------
// Internal helpers — pure functions, no repository
// ---------------------------------------------------------------------------

console.log('\n=== clampToRange ===\n')
{
  assert(clampToRange(50, { min: 0, max: 100 }) === 50, 'in-range value passes through')
  assert(clampToRange(-10, { min: 0, max: 100 }) === 0, 'below min clamps to min')
  assert(clampToRange(150, { min: 0, max: 100 }) === 100, 'above max clamps to max')
  assert(clampToRange(50, { min: -100, max: 100 }) === 50, 'symmetric range')
  assert(clampToRange(-150, { min: -100, max: 100 }) === -100, 'negative below clamps')
  assert(clampToRange(999, { min: 0, max: Infinity }) === 999, 'Infinity max preserves value (piety)')
  assert(clampToRange(-5, { min: 0, max: Infinity }) === 0, 'piety-shape negatives clamp to 0 floor')
  assert(clampToRange(50) === 50, 'no range returns value untouched')
}

console.log('\n=== mapToLabel ===\n')
{
  assert(mapToLabel(95, LOYALTY_BANDS) === 'devoted', '95 → devoted (top band)')
  assert(mapToLabel(80, LOYALTY_BANDS) === 'loyal', '80 → loyal')
  assert(mapToLabel(50, LOYALTY_BANDS) === 'trusted', '50 → trusted (boundary)')
  assert(mapToLabel(49, LOYALTY_BANDS) === 'uncertain', '49 → uncertain (just below boundary)')
  assert(mapToLabel(0, LOYALTY_BANDS) === 'hostile', '0 → hostile (bottom band atOrAbove=0)')
  assert(mapToLabel(-10, LOYALTY_BANDS) === 'hostile', 'below floor returns lowest band')
  assert(mapToLabel(50, []) === null, 'empty bands array returns null')
  assert(mapToLabel(50, null) === null, 'null bands returns null')
}

console.log('\n=== detectThresholdCrossings ===\n')
{
  const pietyThresholds = [
    { value: 3, direction: 'up' },
    { value: 10, direction: 'up' },
    { value: 25, direction: 'up' },
    { value: 50, direction: 'up' }
  ]
  // Cross-up: 1 → 5 crosses 3 only
  let r = detectThresholdCrossings(1, 5, pietyThresholds)
  assert(r.length === 1 && r[0].threshold === 3 && r[0].direction === 'up', 'cross 1→5 fires threshold 3 up')
  // Cross-up: 0 → 30 crosses 3, 10, 25
  r = detectThresholdCrossings(0, 30, pietyThresholds)
  assert(r.length === 3, 'cross 0→30 fires three crossings')
  assert(r.map(x => x.threshold).join(',') === '3,10,25', 'crossings in spec order')
  // Cross-down on a direction='up' threshold: no fire
  r = detectThresholdCrossings(20, 5, pietyThresholds)
  assert(r.length === 0, 'cross-down on direction=up does not fire')
  // direction='down' fires on cross-down
  r = detectThresholdCrossings(20, 5, [{ value: 10, direction: 'down' }])
  assert(r.length === 1 && r[0].direction === 'down', 'direction=down fires on cross-down')
  // direction='both' fires either way
  r = detectThresholdCrossings(5, 20, [{ value: 10, direction: 'both' }])
  assert(r.length === 1 && r[0].direction === 'up', 'direction=both fires up')
  r = detectThresholdCrossings(20, 5, [{ value: 10, direction: 'both' }])
  assert(r.length === 1 && r[0].direction === 'down', 'direction=both fires down')
  // Empty thresholds: no crossings
  assert(detectThresholdCrossings(0, 100, []).length === 0, 'empty thresholds = no crossings')
  // No actual crossing: 5 → 8 (both below threshold 10)
  assert(detectThresholdCrossings(5, 8, [{ value: 10, direction: 'up' }]).length === 0, '5→8 doesnt cross 10')
  // Score equals threshold but doesn't move: not a crossing
  assert(detectThresholdCrossings(10, 12, [{ value: 10, direction: 'up' }]).length === 0, 'starting AT threshold, going up, no crossing')
}

// ---------------------------------------------------------------------------
// adjustStanding — full lifecycle
// ---------------------------------------------------------------------------

console.log('\n=== adjustStanding: clamps to range + writes to repository ===\n')
{
  const repo = makeRepo()
  const config = {
    name: 'test_loyalty',
    range: { min: 0, max: 100 },
    defaultValue: 50,
    labelBands: LOYALTY_BANDS,
    auditTrail: { storage: AUDIT_STRATEGIES.INLINE_JSON },
    repository: repo.repository
  }
  // Companion has no row yet — uses defaultValue (50)
  const r1 = await adjustStanding(config, { companionId: 7 }, +30)
  assert(r1.oldScore === 50, 'oldScore from defaultValue when no row')
  assert(r1.newScore === 80, '50 + 30 = 80')
  assert(r1.label === 'loyal', 'label maps correctly')
  assert(repo.scores.get(JSON.stringify({ companionId: 7 })) === 80, 'writeScore called with new value')

  // Add to existing
  const r2 = await adjustStanding(config, { companionId: 7 }, +50)
  assert(r2.oldScore === 80, 'oldScore reads from prior write')
  assert(r2.newScore === 100, '80 + 50 clamps to 100 (range max)')
  assert(r2.label === 'devoted', '100 → devoted')

  // Subtract clamps to min
  const r3 = await adjustStanding(config, { companionId: 7 }, -200)
  assert(r3.newScore === 0, 'subtraction clamps to range.min')
  assert(r3.label === 'hostile', '0 → hostile')
}

console.log('\n=== adjustStanding: audit entry written when reason supplied ===\n')
{
  const repo = makeRepo()
  const config = {
    name: 'test_audit',
    range: { min: 0, max: 100 },
    defaultValue: 50,
    labelBands: LOYALTY_BANDS,
    auditTrail: { storage: AUDIT_STRATEGIES.INLINE_JSON },
    repository: repo.repository
  }
  await adjustStanding(config, { companionId: 1 }, +10, { reason: 'defended in tavern' })
  const trail = repo.trails.get(JSON.stringify({ companionId: 1 }))
  assert(Array.isArray(trail) && trail.length === 1, 'one audit entry recorded')
  assert(trail[0].reason === 'defended in tavern', 'reason captured')
  assert(trail[0].change === 10 && trail[0].newScore === 60, 'change + newScore captured')
  assert(trail[0].strategy === AUDIT_STRATEGIES.INLINE_JSON, 'strategy passed through to repository')
  assert(typeof trail[0].date === 'string', 'date is ISO string')

  // No reason → no audit entry (silent adjustment)
  await adjustStanding(config, { companionId: 1 }, +5)
  assert(repo.trails.get(JSON.stringify({ companionId: 1 })).length === 1, 'no reason → no audit entry added')
}

console.log('\n=== adjustStanding: audit skipped when strategy=none ===\n')
{
  const repo = makeRepo()
  const config = {
    name: 'test_none_audit',
    range: { min: 0, max: 100 },
    defaultValue: 50,
    labelBands: LOYALTY_BANDS,
    auditTrail: { storage: AUDIT_STRATEGIES.NONE },
    repository: repo.repository
  }
  await adjustStanding(config, { id: 1 }, +10, { reason: 'something' })
  assert(!repo.trails.get(JSON.stringify({ id: 1 })), 'strategy=none never appends audit entry')
}

console.log('\n=== adjustStanding: threshold dispatch fires registered handlers ===\n')
{
  _resetThresholdHandlers()
  const repo = makeRepo()
  const config = {
    name: 'test_piety',
    range: { min: 0, max: Infinity },
    defaultValue: 1,
    labelBands: [],
    thresholds: [
      { value: 3, direction: 'up' },
      { value: 10, direction: 'up' },
      { value: 25, direction: 'up' },
      { value: 50, direction: 'up' }
    ],
    auditTrail: { storage: AUDIT_STRATEGIES.SEPARATE_TABLE },
    repository: repo.repository
  }
  const fired = []
  registerThresholdHandler(config, 3, async (event) => fired.push(event))
  registerThresholdHandler(config, 10, async (event) => fired.push(event))
  registerThresholdHandler(config, 25, async (event) => fired.push(event))

  // Cross 3 and 10 in one adjust (1 → 12)
  const result = await adjustStanding(config, { characterId: 1, deity: 'Lathander' }, +11, { reason: 'devoted offering' })
  assert(result.thresholdsCrossed.length === 2, 'two thresholds in result.thresholdsCrossed')
  assert(fired.length === 2, 'two handlers fired')
  assert(fired[0].threshold === 3 && fired[1].threshold === 10, 'fires in spec order')
  assert(fired[0].oldScore === 1 && fired[0].newScore === 12, 'crossing event has old + new score')
  assert(fired[0].contextKey.deity === 'Lathander', 'contextKey passed through')
  assert(fired[0].reason === 'devoted offering', 'options passed through')

  // Threshold without registered handler — still in result, just no dispatch.
  // 12 → 52 crosses BOTH 25 and 50. Handler at 25 fires; no handler at 50.
  const r2 = await adjustStanding(config, { characterId: 1, deity: 'Lathander' }, +40, { reason: 'big offering' })
  assert(r2.thresholdsCrossed.length === 2, '12→52 crosses both 25 and 50')
  assert(r2.thresholdsCrossed.map(c => c.threshold).join(',') === '25,50', 'crossings in spec order')
  assert(fired.length === 3, '25 handler fires (registered); 50 does not (unregistered)')
  assert(fired[2].threshold === 25, 'newest fired event is the 25-crossing')
}

console.log('\n=== adjustStanding: handler error contained, adjust still returns ===\n')
{
  _resetThresholdHandlers()
  const repo = makeRepo()
  const config = {
    name: 'test_error_containment',
    range: { min: 0, max: 100 },
    defaultValue: 0,
    labelBands: LOYALTY_BANDS,
    thresholds: [{ value: 50, direction: 'up' }],
    auditTrail: { storage: AUDIT_STRATEGIES.NONE },
    repository: repo.repository
  }
  registerThresholdHandler(config, 50, async () => {
    throw new Error('intentional handler failure')
  })
  // Suppress error output during this assertion
  const origError = console.error
  console.error = () => {}
  let result
  try {
    result = await adjustStanding(config, { id: 1 }, +60)
  } finally {
    console.error = origError
  }
  assert(result.newScore === 60, 'adjust still returns despite handler error')
  assert(result.thresholdsCrossed.length === 1, 'crossing still in result')
  assert(repo.scores.get(JSON.stringify({ id: 1 })) === 60, 'score still written despite handler error')
}

// ---------------------------------------------------------------------------
// getStanding
// ---------------------------------------------------------------------------

console.log('\n=== getStanding: returns null when no row ===\n')
{
  const repo = makeRepo()
  const config = {
    name: 'test_getstanding',
    range: { min: 0, max: 100 },
    defaultValue: 50,
    labelBands: LOYALTY_BANDS,
    auditTrail: { storage: AUDIT_STRATEGIES.INLINE_JSON },
    repository: repo.repository
  }
  const result = await getStanding(config, { companionId: 999 })
  assert(result === null, 'returns null when no row exists')
}

console.log('\n=== getStanding: returns score + label + recent audit ===\n')
{
  const repo = makeRepo()
  const config = {
    name: 'test_getstanding_full',
    range: { min: 0, max: 100 },
    defaultValue: 50,
    labelBands: LOYALTY_BANDS,
    auditTrail: { storage: AUDIT_STRATEGIES.INLINE_JSON },
    repository: repo.repository
  }
  await adjustStanding(config, { id: 1 }, +30, { reason: 'first' })
  await adjustStanding(config, { id: 1 }, +5, { reason: 'second' })
  const result = await getStanding(config, { id: 1 })
  assert(result.score === 85, 'score correct after two adjusts')
  assert(result.label === 'loyal', 'label correct (85 → loyal)')
  assert(result.recentAuditEntries.length === 2, 'two audit entries returned')
}

// ---------------------------------------------------------------------------
// formatStandingForPrompt
// ---------------------------------------------------------------------------

console.log('\n=== formatStandingForPrompt: empty when no row, formatted when present ===\n')
{
  const repo = makeRepo()
  const config = {
    name: 'test_format',
    range: { min: 0, max: 100 },
    defaultValue: 50,
    labelBands: LOYALTY_BANDS,
    auditTrail: { storage: AUDIT_STRATEGIES.INLINE_JSON },
    formatForPrompt: (current) => `Loyalty: ${current.label.toUpperCase()} (${current.score}/100)`,
    repository: repo.repository
  }
  // No row yet — empty string
  assert((await formatStandingForPrompt(config, { id: 1 })) === '', 'empty when no row')
  // After adjust — formatted string
  await adjustStanding(config, { id: 1 }, +30)
  assert((await formatStandingForPrompt(config, { id: 1 })) === 'Loyalty: LOYAL (80/100)', 'formatted output')
}

// ---------------------------------------------------------------------------
// registerThresholdHandler — argument validation
// ---------------------------------------------------------------------------

console.log('\n=== registerThresholdHandler: validates arguments ===\n')
{
  _resetThresholdHandlers()
  const config = { name: 'test_register' }
  let threw

  threw = false
  try { registerThresholdHandler({}, 5, () => {}) } catch { threw = true }
  assert(threw, 'rejects config without name')

  threw = false
  try { registerThresholdHandler(config, 'five', () => {}) } catch { threw = true }
  assert(threw, 'rejects non-numeric threshold')

  threw = false
  try { registerThresholdHandler(config, 5, 'not-a-function') } catch { threw = true }
  assert(threw, 'rejects non-function handler')

  threw = false
  try { registerThresholdHandler(config, 5, () => {}, 'sideways') } catch { threw = true }
  assert(threw, 'rejects invalid direction')

  // Valid registration succeeds
  registerThresholdHandler(config, 5, () => {})
  assert(_getThresholdHandlerCount() === 1, 'valid registration increments count')
}

// ---------------------------------------------------------------------------
// validateConfig — defensive errors at call time
// ---------------------------------------------------------------------------

console.log('\n=== validateConfig: defensive errors when called with bad config ===\n')
{
  let threw

  threw = false
  try { await adjustStanding(null, {}, +1) } catch { threw = true }
  assert(threw, 'rejects null config')

  threw = false
  try { await adjustStanding({}, {}, +1) } catch { threw = true }
  assert(threw, 'rejects config without name')

  threw = false
  try {
    await adjustStanding({ name: 'x' }, {}, +1)
  } catch { threw = true }
  assert(threw, 'rejects config without range')

  threw = false
  try {
    await adjustStanding({ name: 'x', range: { min: 0, max: 100 } }, {}, +1)
  } catch { threw = true }
  assert(threw, 'rejects config without repository')

  threw = false
  try {
    await adjustStanding({
      name: 'x',
      range: { min: 0, max: 100 },
      repository: { writeScore: () => {} }  // missing readScore
    }, {}, +1)
  } catch { threw = true }
  assert(threw, 'rejects repository without readScore')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
