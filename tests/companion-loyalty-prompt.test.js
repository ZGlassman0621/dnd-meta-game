/**
 * Phase 3 SC-2 — companion loyalty prompt-injection tests.
 *
 * Covers `formatLoyaltyForPrompt` (the sync helper used by
 * dmPromptBuilder.js::formatCompanions for in-prompt loyalty surfacing —
 * the gap fix). The fragment shape:
 *
 *   No backstory yet:     ""  (empty; .filter(Boolean) drops the line)
 *   No recent events:     "Loyalty: LABEL (N/100)"
 *   With recent event:    "Loyalty: LABEL (N/100). Recent: <reason> (<sign><change>)"
 *
 * Pure function tests — no DB. The repository-callback path that writes
 * loyalty + audit entries is exercised end-to-end by the abstraction's
 * own tests (tests/standing-scalar.test.js) — no need to retest here.
 */

import { formatLoyaltyForPrompt, COMPANION_LOYALTY_CONFIG } from '../server/services/companionBackstoryService.js'
import { mapToLabel } from '../server/services/standingScalar.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

console.log('\n=== COMPANION_LOYALTY_CONFIG: 6 label bands match legacy getLoyaltyLabel ===\n')
{
  // Verifies the migration preserved the exact band cuts. These were
  // hardcoded in the legacy getLoyaltyLabel; if the abstraction's
  // mapToLabel behaves differently the migration is broken.
  const cases = [
    [100, 'devoted'], [95, 'devoted'], [90, 'devoted'],
    [89, 'loyal'], [80, 'loyal'], [75, 'loyal'],
    [74, 'trusted'], [60, 'trusted'], [50, 'trusted'],
    [49, 'uncertain'], [30, 'uncertain'], [25, 'uncertain'],
    [24, 'distrustful'], [15, 'distrustful'], [10, 'distrustful'],
    [9, 'hostile'], [5, 'hostile'], [0, 'hostile']
  ]
  for (const [score, expected] of cases) {
    const label = mapToLabel(score, COMPANION_LOYALTY_CONFIG.labelBands)
    assert(label === expected, `loyalty ${score} → ${expected}`)
  }
}

console.log('\n=== formatLoyaltyForPrompt: returns empty when loyalty is null ===\n')
{
  assert(formatLoyaltyForPrompt(null, null) === '', 'null score → empty string')
  assert(formatLoyaltyForPrompt(null, '[]') === '', 'null score with empty events → empty string')
  assert(formatLoyaltyForPrompt(undefined, null) === '', 'undefined score → empty string')
}

console.log('\n=== formatLoyaltyForPrompt: no audit, just label + score ===\n')
{
  assert(formatLoyaltyForPrompt(50, null) === 'Loyalty: TRUSTED (50/100)', 'score 50 with no audit')
  assert(formatLoyaltyForPrompt(50, '[]') === 'Loyalty: TRUSTED (50/100)', 'score 50 with empty audit')
  assert(formatLoyaltyForPrompt(95, null) === 'Loyalty: DEVOTED (95/100)', 'devoted band')
  assert(formatLoyaltyForPrompt(0, null) === 'Loyalty: HOSTILE (0/100)', 'hostile floor')
}

console.log('\n=== formatLoyaltyForPrompt: with one recent event ===\n')
{
  const events = JSON.stringify([
    { event: 'defended in tavern brawl', change: 5, new_total: 80, date: '2026-05-04' }
  ])
  const out = formatLoyaltyForPrompt(80, events)
  assert(out === 'Loyalty: LOYAL (80/100). Recent: defended in tavern brawl (+5)', 'positive change shows + sign')
}

console.log('\n=== formatLoyaltyForPrompt: negative recent change shows minus, not double minus ===\n')
{
  const events = JSON.stringify([
    { event: 'lied about the gold', change: -10, new_total: 40, date: '2026-05-04' }
  ])
  const out = formatLoyaltyForPrompt(40, events)
  assert(out === 'Loyalty: UNCERTAIN (40/100). Recent: lied about the gold (-10)', 'negative change rendered correctly')
}

console.log('\n=== formatLoyaltyForPrompt: shows MOST recent event (last in array) ===\n')
{
  const events = JSON.stringify([
    { event: 'old thing', change: 3, new_total: 65, date: '2026-04-01' },
    { event: 'middle thing', change: -2, new_total: 63, date: '2026-04-15' },
    { event: 'most recent', change: 7, new_total: 70, date: '2026-05-04' }
  ])
  const out = formatLoyaltyForPrompt(70, events)
  assert(out.includes('most recent'), 'newest event surfaced')
  assert(!out.includes('old thing'), 'older events not surfaced')
  assert(!out.includes('middle thing'), 'middle events not surfaced')
}

console.log('\n=== formatLoyaltyForPrompt: handles malformed JSON gracefully ===\n')
{
  // Empty fallback when JSON parse fails — should NOT throw
  const out = formatLoyaltyForPrompt(60, 'not-json-at-all')
  assert(out === 'Loyalty: TRUSTED (60/100)', 'malformed JSON falls back to no-recent-event format')
}

console.log('\n=== formatLoyaltyForPrompt: handles event without reason field ===\n')
{
  // Edge: event missing the `event` field (corrupted entry from external write)
  const events = JSON.stringify([{ change: 5, new_total: 60, date: '2026-05-04' }])
  const out = formatLoyaltyForPrompt(60, events)
  // Should fall back to label-only (the formatForPrompt's recent-event
  // branch checks `recent.reason`, which would be undefined here)
  assert(out === 'Loyalty: TRUSTED (60/100)', 'event without reason → label-only')
}

console.log('\n=== COMPANION_LOYALTY_CONFIG.formatForPrompt: standalone callable ===\n')
{
  // Verify the config's formatForPrompt is a function that can be called
  // directly (e.g., by tests, or from the abstraction's
  // formatStandingForPrompt path). Same output as the legacy spec example.
  const out = COMPANION_LOYALTY_CONFIG.formatForPrompt({
    score: 62,
    label: 'trusted',
    recentAuditEntries: [{ reason: 'defended in tavern brawl', change: 5, newScore: 62, date: '2026-05-04' }]
  })
  assert(out === 'Loyalty: TRUSTED (62/100). Recent: defended in tavern brawl (+5)', 'matches spec §2.4 example output')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
