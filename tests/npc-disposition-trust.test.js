/**
 * Phase 3 SC-4 — NPC disposition + trust dual-scalar tests.
 *
 * Pure-function coverage for the dual-scalar shape: two configs
 * (NPC_DISPOSITION_CONFIG and NPC_TRUST_CONFIG) both pointing at the
 * same `npc_relationships` row, each managing its own column. Validates:
 *
 *   1. Label-band parity (mapToLabel matches legacy getDispositionLabel
 *      across the full -100..+100 range)
 *   2. formatForPrompt fragment shapes for both configs
 *   3. Audit-strategy divergence (disposition uses INLINE_JSON,
 *      trust uses NONE — trust config has no audit callbacks)
 *   4. Configs are isolated (writing one doesn't affect the other's API)
 *
 * The end-to-end DB path is covered by tests/standing-scalar.test.js
 * (the abstraction's own tests). Prompt-output snapshot — the existing
 * NPC line composer in dmPromptBuilder reads `disposition_label` and
 * `trust_level` directly, so the snapshot test confirms the migration
 * keeps writing those columns identically.
 */

import {
  NPC_DISPOSITION_CONFIG,
  NPC_TRUST_CONFIG
} from '../server/services/npcRelationshipService.js'
import { mapToLabel } from '../server/services/standingScalar.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

// Inlined legacy helper — the function deleted in npcRelationshipService.js
// as part of this change. Kept as snapshot reference.
function legacyGetDispositionLabel(disposition) {
  if (disposition >= 75) return 'devoted'
  if (disposition >= 50) return 'allied'
  if (disposition >= 25) return 'friendly'
  if (disposition >= -24) return 'neutral'
  if (disposition >= -49) return 'unfriendly'
  if (disposition >= -74) return 'hostile'
  return 'nemesis'
}

console.log('\n=== Label band parity: mapToLabel matches legacy getDispositionLabel for full range ===\n')
{
  let mismatches = 0
  for (let s = -100; s <= 100; s++) {
    const legacy = legacyGetDispositionLabel(s)
    const next = mapToLabel(s, NPC_DISPOSITION_CONFIG.labelBands)
    if (legacy !== next) {
      console.error(`  ✗ disposition ${s}: legacy="${legacy}" vs new="${next}"`)
      mismatches++
    }
  }
  assert(mismatches === 0, `all 201 integer dispositions produce identical labels (${mismatches} mismatches)`)
}

console.log('\n=== Band edge spot checks ===\n')
{
  const cases = [
    [100, 'devoted'], [75, 'devoted'],
    [74, 'allied'], [50, 'allied'],
    [49, 'friendly'], [25, 'friendly'],
    [24, 'neutral'], [0, 'neutral'], [-24, 'neutral'],
    [-25, 'unfriendly'], [-49, 'unfriendly'],
    [-50, 'hostile'], [-74, 'hostile'],
    [-75, 'nemesis'], [-100, 'nemesis']
  ]
  for (const [score, expected] of cases) {
    const out = mapToLabel(score, NPC_DISPOSITION_CONFIG.labelBands)
    assert(out === expected, `disposition ${score} → ${expected}`)
  }
}

console.log('\n=== NPC_DISPOSITION_CONFIG: shape sanity ===\n')
{
  assert(NPC_DISPOSITION_CONFIG.name === 'npc_disposition', 'config.name')
  assert(NPC_DISPOSITION_CONFIG.range.min === -100, 'range.min = -100')
  assert(NPC_DISPOSITION_CONFIG.range.max === 100, 'range.max = 100')
  assert(NPC_DISPOSITION_CONFIG.defaultValue === 0, 'defaultValue = 0')
  assert(NPC_DISPOSITION_CONFIG.labelBands.length === 7, '7 label bands (devoted..nemesis)')
  assert(NPC_DISPOSITION_CONFIG.auditTrail.storage === 'inline_json', 'audit storage = inline_json (witnessed_deeds)')
  assert(typeof NPC_DISPOSITION_CONFIG.repository.readScore === 'function', 'readScore callable')
  assert(typeof NPC_DISPOSITION_CONFIG.repository.writeScore === 'function', 'writeScore callable')
  assert(typeof NPC_DISPOSITION_CONFIG.repository.readAuditTrail === 'function', 'readAuditTrail callable')
  assert(typeof NPC_DISPOSITION_CONFIG.repository.appendAuditEntry === 'function', 'appendAuditEntry callable')
}

console.log('\n=== NPC_DISPOSITION_CONFIG.formatForPrompt: fragment shape ===\n')
{
  const cases = [
    [{ score: 50, label: 'allied' }, 'ALLIED (+50)'],
    [{ score: 75, label: 'devoted' }, 'DEVOTED (+75)'],
    [{ score: 0, label: 'neutral' }, 'NEUTRAL (0)'],
    [{ score: -25, label: 'unfriendly' }, 'UNFRIENDLY (-25)'],
    [{ score: -100, label: 'nemesis' }, 'NEMESIS (-100)']
  ]
  for (const [current, expected] of cases) {
    const out = NPC_DISPOSITION_CONFIG.formatForPrompt(current)
    assert(out === expected, `${current.label}/${current.score} → "${expected}"`)
  }
}

console.log('\n=== NPC_TRUST_CONFIG: shape sanity (dual-scalar second config) ===\n')
{
  assert(NPC_TRUST_CONFIG.name === 'npc_trust', 'config.name')
  assert(NPC_TRUST_CONFIG.name !== NPC_DISPOSITION_CONFIG.name, 'distinct from disposition config (independent threshold registries)')
  assert(NPC_TRUST_CONFIG.range.min === -100, 'range.min = -100')
  assert(NPC_TRUST_CONFIG.range.max === 100, 'range.max = 100')
  assert(NPC_TRUST_CONFIG.defaultValue === 0, 'defaultValue = 0')
  assert(Array.isArray(NPC_TRUST_CONFIG.labelBands) && NPC_TRUST_CONFIG.labelBands.length === 0, 'labelBands empty (trust has no game-state labels)')
  assert(NPC_TRUST_CONFIG.auditTrail.storage === 'none', 'audit storage = none (no trust audit column)')
  assert(typeof NPC_TRUST_CONFIG.repository.readScore === 'function', 'readScore callable')
  assert(typeof NPC_TRUST_CONFIG.repository.writeScore === 'function', 'writeScore callable')
  assert(NPC_TRUST_CONFIG.repository.appendAuditEntry === undefined, 'no appendAuditEntry (NONE strategy skips audit step)')
  assert(NPC_TRUST_CONFIG.repository.readAuditTrail === undefined, 'no readAuditTrail (NONE strategy)')
}

console.log('\n=== NPC_TRUST_CONFIG.formatForPrompt: raw integer fragment ===\n')
{
  assert(NPC_TRUST_CONFIG.formatForPrompt({ score: 0 }) === 'Trust 0', 'zero trust')
  assert(NPC_TRUST_CONFIG.formatForPrompt({ score: 50 }) === 'Trust 50', 'positive trust')
  assert(NPC_TRUST_CONFIG.formatForPrompt({ score: -30 }) === 'Trust -30', 'negative trust')
}

console.log('\n=== Dual-scalar isolation: configs share row but not API state ===\n')
{
  // The two configs must have distinct names so the abstraction's
  // threshold-handler registry doesn't collide them. Each config
  // independently routes via its own `name` key in the registry.
  assert(NPC_DISPOSITION_CONFIG.name !== NPC_TRUST_CONFIG.name, 'configs have distinct names')

  // Both repositories use the same composite contextKey shape — confirms
  // they can share a row lookup without conflict.
  // (We can't test the actual SQL execution here without a DB; just
  //  verify the API surface matches.)
  assert(typeof NPC_DISPOSITION_CONFIG.repository.readScore === typeof NPC_TRUST_CONFIG.repository.readScore,
    'both readScore are functions (shape-compatible)')
  assert(typeof NPC_DISPOSITION_CONFIG.repository.writeScore === typeof NPC_TRUST_CONFIG.repository.writeScore,
    'both writeScore are functions (shape-compatible)')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
