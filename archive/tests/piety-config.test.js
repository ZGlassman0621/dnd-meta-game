/**
 * Phase 3 SC-4 — Mythic piety configuration + prompt-injection tests.
 *
 * Pure-function coverage for `MYTHIC_PIETY_CONFIG.formatForPrompt`,
 * `formatPietyForPrompt` (the sync helper used by dmSession.js prompt
 * assembly), and the threshold-up dispatch wiring. The repository-callback
 * path that hits the `character_piety` / `piety_history` tables is
 * exercised end-to-end by the abstraction's own tests
 * (tests/standing-scalar.test.js); no need to retest here.
 *
 * Skipped: the actual `[PIETY_CHANGE]` marker → handler dispatch path,
 * because that requires a real character row + DB. The handler
 * registration itself is verified via markerPipeline._hasHandler.
 */

import {
  MYTHIC_PIETY_CONFIG,
  formatPietyForPrompt
} from '../server/services/pietyService.js'
import { _hasHandler } from '../server/services/markerPipeline.js'
import { _getThresholdHandlerCount } from '../server/services/standingScalar.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

console.log('\n=== MYTHIC_PIETY_CONFIG: shape sanity ===\n')
{
  assert(MYTHIC_PIETY_CONFIG.name === 'mythic_piety', 'config.name')
  assert(MYTHIC_PIETY_CONFIG.range.min === 0, 'range.min = 0 (piety floor)')
  assert(MYTHIC_PIETY_CONFIG.range.max === Infinity, 'range.max = Infinity (no cap)')
  assert(MYTHIC_PIETY_CONFIG.defaultValue === 1, 'defaultValue = 1 (initial piety)')
  assert(Array.isArray(MYTHIC_PIETY_CONFIG.labelBands) && MYTHIC_PIETY_CONFIG.labelBands.length === 0, 'labelBands empty (piety uses thresholds, not bands)')
  assert(MYTHIC_PIETY_CONFIG.auditTrail.storage === 'separate_table', 'audit storage = separate_table (piety_history)')
  const thresholdValues = MYTHIC_PIETY_CONFIG.thresholds.map(t => t.value)
  assert(JSON.stringify(thresholdValues) === '[3,10,25,50]', 'thresholds = [3,10,25,50]')
  assert(MYTHIC_PIETY_CONFIG.thresholds.every(t => t.direction === 'up'), 'all thresholds direction=up (legacy: cross-up only)')
  assert(typeof MYTHIC_PIETY_CONFIG.formatForPrompt === 'function', 'formatForPrompt is callable')
  assert(typeof MYTHIC_PIETY_CONFIG.repository.readScore === 'function', 'repository.readScore callable')
  assert(typeof MYTHIC_PIETY_CONFIG.repository.writeScore === 'function', 'repository.writeScore callable')
  assert(typeof MYTHIC_PIETY_CONFIG.repository.readAuditTrail === 'function', 'repository.readAuditTrail callable')
  assert(typeof MYTHIC_PIETY_CONFIG.repository.appendAuditEntry === 'function', 'repository.appendAuditEntry callable')
}

console.log('\n=== MYTHIC_PIETY_CONFIG.formatForPrompt: standalone fragment shape ===\n')
{
  // No recent event → just "Piety N"
  const out1 = MYTHIC_PIETY_CONFIG.formatForPrompt({
    score: 12, label: null, recentAuditEntries: []
  })
  assert(out1 === 'Piety 12', 'no audit → "Piety N"')

  const out2 = MYTHIC_PIETY_CONFIG.formatForPrompt({
    score: 27, label: null,
    recentAuditEntries: [{ reason: 'protected the innocent', change: 2 }]
  })
  assert(out2 === 'Piety 27. Recent: protected the innocent (+2)', 'positive recent change shows + sign')

  const out3 = MYTHIC_PIETY_CONFIG.formatForPrompt({
    score: 5, label: null,
    recentAuditEntries: [{ reason: 'lied at the altar', change: -3 }]
  })
  assert(out3 === 'Piety 5. Recent: lied at the altar (-3)', 'negative recent change shows minus once')

  const out4 = MYTHIC_PIETY_CONFIG.formatForPrompt({
    score: 8, label: null,
    recentAuditEntries: [{ change: 1 }]  // missing reason
  })
  assert(out4 === 'Piety 8', 'audit entry without reason → fragment without recent suffix')
}

console.log('\n=== formatPietyForPrompt: empty when no piety rows ===\n')
{
  assert(formatPietyForPrompt([]) === '', 'empty array → empty string')
  assert(formatPietyForPrompt(null) === '', 'null → empty string')
  assert(formatPietyForPrompt(undefined) === '', 'undefined → empty string')
}

console.log('\n=== formatPietyForPrompt: single deity ===\n')
{
  const out = formatPietyForPrompt([
    { deity_name: 'Lathander', piety_score: 12, highest_threshold_unlocked: 10 }
  ])
  assert(out === '- Lathander: 12 piety (unlocked 10, next at 25)', 'single deity, mid-tier')

  const out2 = formatPietyForPrompt([
    { deity_name: 'Selune', piety_score: 2, highest_threshold_unlocked: 0 }
  ])
  assert(out2 === '- Selune: 2 piety (unlocked none, next at 3)', 'no unlocks → "unlocked none"')

  const out3 = formatPietyForPrompt([
    { deity_name: 'Tymora', piety_score: 75, highest_threshold_unlocked: 50 }
  ])
  assert(out3 === '- Tymora: 75 piety (unlocked 50, max tier reached)', 'highest threshold reached → "max tier reached"')
}

console.log('\n=== formatPietyForPrompt: multiple deities (per-deity scoping) ===\n')
{
  // Per spec §2.6 acceptance criteria: per-deity scoping for piety works
  // (a character with piety to multiple deities sees all of them in prompts).
  const out = formatPietyForPrompt([
    { deity_name: 'Lathander', piety_score: 28, highest_threshold_unlocked: 25 },
    { deity_name: 'Helm', piety_score: 5, highest_threshold_unlocked: 3 }
  ])
  const lines = out.split('\n')
  assert(lines.length === 2, 'two-deity output has two lines')
  assert(lines[0].includes('Lathander'), 'first line has Lathander')
  assert(lines[1].includes('Helm'), 'second line has Helm')
  assert(lines[0].includes('next at 50'), 'Lathander next at 50')
  assert(lines[1].includes('next at 10'), 'Helm next at 10')
}

console.log('\n=== formatPietyForPrompt: handles defaults gracefully ===\n')
{
  // piety_score / highest_threshold_unlocked may be undefined or null
  // depending on caller — formatter should default to 0.
  const out = formatPietyForPrompt([
    { deity_name: 'NewDeity', piety_score: undefined, highest_threshold_unlocked: undefined }
  ])
  assert(out === '- NewDeity: 0 piety (unlocked none, next at 3)', 'undefined fields default to 0')
}

console.log('\n=== Module-load registrations: thresholds + marker handler ===\n')
{
  // Module load (via the import at top of file) should have fired:
  // - 4 threshold-up handler registrations (for 3, 10, 25, 50)
  // - 1 marker-pipeline handler registration (for PIETY_CHANGE)
  // Counts include any prior tests' registrations, so we use >= checks.
  assert(_getThresholdHandlerCount() >= 4, `>= 4 threshold handlers registered (got ${_getThresholdHandlerCount()})`)
  assert(_hasHandler('PIETY_CHANGE'), 'markerPipeline has PIETY_CHANGE handler')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
