/**
 * Phase 3 SC-5 — DM Mode bond-shift tests.
 *
 * The most complex migration: dual-scalar (warmth + trust) + directional
 * pair (A→B independent of B→A) + JSON-blob storage + three application
 * paths. The wrapper `mutateRelationshipScalars` is the deterministic
 * core — clamp via standingScalar's range, push unified history entry.
 * Pure tests for that core; the read/write loop and the handler dispatch
 * are exercised end-to-end via integration suites and smoke runs.
 *
 * Coverage:
 *   1. Both configs' shape sanity (range -5..+5, default 0, NONE audit)
 *   2. formatForPrompt fragment shapes (raw signed integer, sign-aware)
 *   3. mutateRelationshipScalars applies clamp + shared history correctly
 *   4. Directional-pair semantics: A→B mutation doesn't touch B→A
 *   5. FIFO-10 history trim
 *   6. No-op shifts (warmthDelta=0 AND trustDelta=0) push no history
 *   7. Module-load registrations (BOND_SHIFT in marker pipeline)
 */

import {
  DM_MODE_BOND_WARMTH_CONFIG,
  DM_MODE_BOND_TRUST_CONFIG,
  mutateRelationshipScalars
} from '../server/services/dmModeBondShiftService.js'
import { _hasHandler } from '../server/services/markerPipeline.js'
import { MARKER_SCHEMAS } from '../server/services/markerSchemas.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

console.log('\n=== DM_MODE_BOND_WARMTH_CONFIG: shape sanity ===\n')
{
  assert(DM_MODE_BOND_WARMTH_CONFIG.name === 'dm_mode_bond_warmth', 'config.name')
  assert(DM_MODE_BOND_WARMTH_CONFIG.range.min === -5, 'range.min = -5')
  assert(DM_MODE_BOND_WARMTH_CONFIG.range.max === 5, 'range.max = +5')
  assert(DM_MODE_BOND_WARMTH_CONFIG.defaultValue === 0, 'defaultValue = 0')
  assert(Array.isArray(DM_MODE_BOND_WARMTH_CONFIG.labelBands) && DM_MODE_BOND_WARMTH_CONFIG.labelBands.length === 0, 'labelBands empty (raw integer in prompts)')
  assert(DM_MODE_BOND_WARMTH_CONFIG.auditTrail.storage === 'none', 'audit storage = none (shared history owned consumer-side)')
  assert(typeof DM_MODE_BOND_WARMTH_CONFIG.formatForPrompt === 'function', 'formatForPrompt callable')
  assert(typeof DM_MODE_BOND_WARMTH_CONFIG.repository.readScore === 'function', 'repository.readScore callable')
  assert(typeof DM_MODE_BOND_WARMTH_CONFIG.repository.writeScore === 'function', 'repository.writeScore callable')
  assert(DM_MODE_BOND_WARMTH_CONFIG.repository.appendAuditEntry === undefined, 'no appendAuditEntry (NONE strategy)')
}

console.log('\n=== DM_MODE_BOND_TRUST_CONFIG: shape sanity ===\n')
{
  assert(DM_MODE_BOND_TRUST_CONFIG.name === 'dm_mode_bond_trust', 'config.name')
  assert(DM_MODE_BOND_TRUST_CONFIG.name !== DM_MODE_BOND_WARMTH_CONFIG.name, 'distinct from warmth (independent threshold registries)')
  assert(DM_MODE_BOND_TRUST_CONFIG.range.min === -5, 'range.min = -5')
  assert(DM_MODE_BOND_TRUST_CONFIG.range.max === 5, 'range.max = +5')
  assert(DM_MODE_BOND_TRUST_CONFIG.defaultValue === 0, 'defaultValue = 0')
  assert(DM_MODE_BOND_TRUST_CONFIG.auditTrail.storage === 'none', 'audit storage = none')
}

console.log('\n=== formatForPrompt fragments ===\n')
{
  assert(DM_MODE_BOND_WARMTH_CONFIG.formatForPrompt({ score: 3 }) === 'warmth: +3', 'warmth +3')
  assert(DM_MODE_BOND_WARMTH_CONFIG.formatForPrompt({ score: 0 }) === 'warmth: +0', 'warmth 0 → "+0"')
  assert(DM_MODE_BOND_WARMTH_CONFIG.formatForPrompt({ score: -2 }) === 'warmth: -2', 'warmth -2')
  assert(DM_MODE_BOND_TRUST_CONFIG.formatForPrompt({ score: 4 }) === 'trust: +4', 'trust +4')
  assert(DM_MODE_BOND_TRUST_CONFIG.formatForPrompt({ score: -5 }) === 'trust: -5', 'trust -5 (floor)')
}

console.log('\n=== mutateRelationshipScalars: clamp at upper bound ===\n')
{
  const rel = { warmth: 4, trust: 3, history: [] }
  mutateRelationshipScalars(rel, 3, 3, 'a noble deed', 5)
  assert(rel.warmth === 5, 'warmth clamps to +5 ceiling (4+3 → 5)')
  assert(rel.trust === 5, 'trust clamps to +5 ceiling (3+3 → 5)')
  assert(rel.history.length === 1, 'one shared history entry')
  assert(rel.history[0].shift === 'warmth+3, trust+3', 'shift string combines both deltas')
  assert(rel.history[0].reason === 'a noble deed', 'reason preserved')
  assert(rel.history[0].session === 5, 'sessionLabel preserved')
}

console.log('\n=== mutateRelationshipScalars: clamp at lower bound ===\n')
{
  const rel = { warmth: -3, trust: -4 }
  mutateRelationshipScalars(rel, -5, -3, 'betrayal', 7)
  assert(rel.warmth === -5, 'warmth clamps to -5 floor (-3 + -5 → -5)')
  assert(rel.trust === -5, 'trust clamps to -5 floor (-4 + -3 → -5)')
  assert(rel.history.length === 1, 'one shared history entry')
  assert(rel.history[0].shift === 'warmth-5, trust-3', 'negative deltas formatted with single minus')
}

console.log('\n=== mutateRelationshipScalars: warmth-only and trust-only ===\n')
{
  const rel = { warmth: 0, trust: 0 }
  mutateRelationshipScalars(rel, 2, 0, 'shared a laugh', 1)
  assert(rel.warmth === 2 && rel.trust === 0, 'warmth-only delta applied')
  assert(rel.history.length === 1 && rel.history[0].shift === 'warmth+2', 'shift string omits trust when delta=0')

  const rel2 = { warmth: 0, trust: 0 }
  mutateRelationshipScalars(rel2, 0, -1, 'caught lying', 2)
  assert(rel2.trust === -1 && rel2.warmth === 0, 'trust-only delta applied')
  assert(rel2.history[0].shift === 'trust-1', 'shift string omits warmth when delta=0')
}

console.log('\n=== mutateRelationshipScalars: no-op (both deltas 0) skips history push ===\n')
{
  const rel = { warmth: 1, trust: 1, history: [{ session: 0, shift: 'warmth+1', reason: 'old' }] }
  mutateRelationshipScalars(rel, 0, 0, 'no change', 3)
  assert(rel.warmth === 1, 'warmth unchanged')
  assert(rel.trust === 1, 'trust unchanged')
  assert(rel.history.length === 1, 'no new history entry pushed when both deltas zero')
}

console.log('\n=== mutateRelationshipScalars: missing rel.warmth/trust defaults to 0 ===\n')
{
  // Newly created relationships may lack warmth/trust fields entirely.
  const rel = {}  // no warmth, trust, or history
  mutateRelationshipScalars(rel, 2, -1, 'first contact', 1)
  assert(rel.warmth === 2, '0 + 2 → 2 (missing field treated as 0)')
  assert(rel.trust === -1, '0 + -1 → -1 (missing field treated as 0)')
  assert(rel.history.length === 1, 'history initialized')
}

console.log('\n=== mutateRelationshipScalars: FIFO max 10 ===\n')
{
  const rel = { warmth: 0, trust: 0, history: [] }
  for (let i = 1; i <= 12; i++) {
    mutateRelationshipScalars(rel, 1, 0, `event ${i}`, i)
    // Reset warmth so we don't hit ceiling
    if (rel.warmth >= 5) rel.warmth = 0
  }
  assert(rel.history.length === 10, 'history trimmed to FIFO max 10')
  assert(rel.history[0].reason === 'event 3', 'oldest 2 events dropped')
  assert(rel.history[9].reason === 'event 12', 'newest event retained')
}

console.log('\n=== Directional pair semantics: A→B independent of B→A ===\n')
{
  // Simulates the JSON-blob shape: each character has a party_relationships
  // map keyed by the OTHER character's name. A→B and B→A are stored
  // under different parents, so mutating one shouldn't touch the other.
  const aliceToBob = { warmth: 0, trust: 0, history: [] }
  const bobToAlice = { warmth: 2, trust: 2, history: [] }
  mutateRelationshipScalars(aliceToBob, 3, -1, 'Alice grew warmer toward Bob', 5)
  assert(aliceToBob.warmth === 3, 'A→B warmth shifted')
  assert(bobToAlice.warmth === 2, 'B→A warmth UNCHANGED (independent pair)')
  assert(bobToAlice.trust === 2, 'B→A trust UNCHANGED')
  assert(bobToAlice.history.length === 0, 'B→A history UNCHANGED')
}

console.log('\n=== BOND_SHIFT marker schema registered ===\n')
{
  assert(MARKER_SCHEMAS.BOND_SHIFT !== undefined, 'BOND_SHIFT in MARKER_SCHEMAS')
  assert(MARKER_SCHEMAS.BOND_SHIFT.fields.From.required === true, 'From required')
  assert(MARKER_SCHEMAS.BOND_SHIFT.fields.To.required === true, 'To required')
  assert(MARKER_SCHEMAS.BOND_SHIFT.fields.Warmth.required === false, 'Warmth optional')
  assert(MARKER_SCHEMAS.BOND_SHIFT.fields.Trust.required === false, 'Trust optional')
  assert(MARKER_SCHEMAS.BOND_SHIFT.fields.Reason.required === false, 'Reason optional')
  assert(MARKER_SCHEMAS.BOND_SHIFT.fields.Warmth.min === -5, 'Warmth min = -5')
  assert(MARKER_SCHEMAS.BOND_SHIFT.fields.Warmth.max === 5, 'Warmth max = +5')
  assert(MARKER_SCHEMAS.BOND_SHIFT.fields.Trust.min === -5, 'Trust min = -5')
  assert(MARKER_SCHEMAS.BOND_SHIFT.fields.Trust.max === 5, 'Trust max = +5')
}

console.log('\n=== Module-load registrations ===\n')
{
  assert(_hasHandler('BOND_SHIFT'), 'markerPipeline has BOND_SHIFT handler')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
