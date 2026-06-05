/**
 * Phase 3 SC-3 — faction standing prompt-output byte-identical snapshot.
 *
 * The acceptance criteria for SC-3 (per PHASE_3_REFACTOR_SPEC §5.3) is
 * that the migration from hand-rolled label/fragment composition to
 * `formatFactionStandingFragment` (which routes through
 * FACTION_STANDING_CONFIG.formatForPrompt) produces BYTE-IDENTICAL output
 * to the legacy code path for every standing value in the range.
 *
 * This test runs both code paths over a representative sample of
 * standings (label-band edges + interior values + member/non-member
 * pairs) and asserts string equality.
 *
 * Pure test — no DB. The legacy logic is inlined here as the comparator
 * (since `getStandingLabel` was deleted in this same change).
 */

import {
  FACTION_STANDING_CONFIG,
  formatFactionStandingFragment
} from '../server/services/factionService.js'
import { mapToLabel } from '../server/services/standingScalar.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

// Inlined legacy helper — the function deleted in factionService.js as
// part of this change. Kept here as the snapshot reference so future
// edits to the config can be validated against the original behavior.
function legacyGetStandingLabel(standing) {
  if (standing >= 80) return 'exalted'
  if (standing >= 60) return 'revered'
  if (standing >= 40) return 'honored'
  if (standing >= 20) return 'friendly'
  if (standing >= 0) return 'neutral'
  if (standing >= -20) return 'unfriendly'
  if (standing >= -40) return 'hostile'
  if (standing >= -60) return 'hated'
  return 'enemy'
}

// Inlined legacy line composer (the version from
// dmPromptBuilder::formatWorldStateSnapshot before SC-3 rewire).
function legacyComposeLine(s, behavior) {
  const label = (s.standing_label || 'neutral').toUpperCase()
  const memberNote = s.is_member ? ', Member' : ''
  return `- ${s.faction_name}: ${label} (${s.standing > 0 ? '+' : ''}${s.standing})${memberNote} - ${behavior}`
}

// New code path's line composer (mirrors dmPromptBuilder post-SC-3).
function newComposeLine(s, behavior) {
  const fragment = formatFactionStandingFragment(s.standing)
  const memberNote = s.is_member ? ', Member' : ''
  return `- ${s.faction_name}: ${fragment}${memberNote} - ${behavior}`
}

console.log('\n=== Label band parity: mapToLabel matches legacy getStandingLabel for full range ===\n')
{
  // Walk every integer in [-100, 100] — the entire faction standing
  // range. If any value produces a different label, the migration has
  // shifted band semantics.
  let mismatches = 0
  for (let s = -100; s <= 100; s++) {
    const legacy = legacyGetStandingLabel(s)
    const next = mapToLabel(s, FACTION_STANDING_CONFIG.labelBands)
    if (legacy !== next) {
      console.error(`  ✗ standing ${s}: legacy="${legacy}" vs new="${next}"`)
      mismatches++
    }
  }
  assert(mismatches === 0, `all 201 integer standings produce identical labels (${mismatches} mismatches)`)
}

console.log('\n=== formatFactionStandingFragment: representative outputs ===\n')
{
  const cases = [
    [100, 'EXALTED (+100)'],
    [85, 'EXALTED (+85)'],
    [80, 'EXALTED (+80)'],
    [79, 'REVERED (+79)'],
    [60, 'REVERED (+60)'],
    [45, 'HONORED (+45)'],
    [25, 'FRIENDLY (+25)'],
    [10, 'NEUTRAL (+10)'],
    [1, 'NEUTRAL (+1)'],
    [0, 'NEUTRAL (0)'],
    [-1, 'UNFRIENDLY (-1)'],
    [-20, 'UNFRIENDLY (-20)'],
    [-40, 'HOSTILE (-40)'],
    [-60, 'HATED (-60)'],
    [-61, 'ENEMY (-61)'],
    [-100, 'ENEMY (-100)']
  ]
  for (const [score, expected] of cases) {
    const out = formatFactionStandingFragment(score)
    assert(out === expected, `score ${score} → "${expected}"`)
  }
}

console.log('\n=== formatFactionStandingFragment: empty when standing is null ===\n')
{
  assert(formatFactionStandingFragment(null) === '', 'null → empty string')
  assert(formatFactionStandingFragment(undefined) === '', 'undefined → empty string')
}

console.log('\n=== Full prompt-line byte-identity: legacy vs new composer ===\n')
{
  // Representative scenarios across band edges + member states. The
  // worldState row shape (.faction_name, .standing, .standing_label,
  // .is_member) mirrors what dmSessionService's worldState loader
  // produces and what formatWorldStateSnapshot consumes.
  const scenarios = [
    { faction_name: "Lord's Alliance", standing: 85, standing_label: 'exalted', is_member: 1 },
    { faction_name: 'Harpers', standing: 60, standing_label: 'revered', is_member: 0 },
    { faction_name: 'Zhentarim', standing: -40, standing_label: 'hostile', is_member: 0 },
    { faction_name: 'Cult of the Dragon', standing: -100, standing_label: 'enemy', is_member: 0 },
    { faction_name: 'Order of the Gauntlet', standing: 0, standing_label: 'neutral', is_member: 1 },
    { faction_name: 'Emerald Enclave', standing: 1, standing_label: 'neutral', is_member: 0 },
    { faction_name: "Edge Case 79", standing: 79, standing_label: 'revered', is_member: 0 },
    { faction_name: "Edge Case -61", standing: -61, standing_label: 'enemy', is_member: 1 }
  ]
  // Behavior text comes from dmPromptBuilder's getStandingBehavior, but
  // the snapshot doesn't depend on its content — it only needs to be the
  // SAME string in both composers. Use a fixed sentinel.
  const behavior = '[behavior-string]'
  for (const s of scenarios) {
    const legacy = legacyComposeLine(s, behavior)
    const next = newComposeLine(s, behavior)
    assert(legacy === next, `"${s.faction_name}" (${s.standing}): byte-identical`)
  }
}

console.log('\n=== FACTION_STANDING_CONFIG: shape sanity ===\n')
{
  assert(FACTION_STANDING_CONFIG.name === 'faction_standing', 'config.name set')
  assert(FACTION_STANDING_CONFIG.range.min === -100, 'range.min = -100')
  assert(FACTION_STANDING_CONFIG.range.max === 100, 'range.max = 100')
  assert(FACTION_STANDING_CONFIG.defaultValue === 0, 'defaultValue = 0')
  assert(FACTION_STANDING_CONFIG.labelBands.length === 9, '9 label bands (exalted..enemy)')
  assert(FACTION_STANDING_CONFIG.auditTrail.storage === 'split_by_sign', 'audit strategy = split_by_sign')
  assert(typeof FACTION_STANDING_CONFIG.formatForPrompt === 'function', 'formatForPrompt is callable')
  assert(typeof FACTION_STANDING_CONFIG.repository.readScore === 'function', 'repository.readScore is callable')
  assert(typeof FACTION_STANDING_CONFIG.repository.writeScore === 'function', 'repository.writeScore is callable')
  assert(typeof FACTION_STANDING_CONFIG.repository.appendAuditEntry === 'function', 'repository.appendAuditEntry is callable')
  assert(typeof FACTION_STANDING_CONFIG.repository.readAuditTrail === 'function', 'repository.readAuditTrail is callable')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
