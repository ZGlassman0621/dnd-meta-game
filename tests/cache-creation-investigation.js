/**
 * Investigation: why does cache_creation grow in production sessions when
 * tier 1 + tier 2 cache_read is constant at 9920 tokens?
 *
 * Production session 148 showed cache_creation values 2106 → 3915 → 4780 → 6611
 * across the session, while cache_read stayed at 9920 throughout. By the
 * v1.0.96 architecture, tier 2 is supposed to be byte-stable per-character.
 *
 * This test simulates the /message route's per-turn prompt mutations:
 *   1. Read messages[0].content from "DB" (state from prior turn)
 *   2. Strip the previous ledger via regex
 *   3. Append a new (growing) ledger
 *   4. Run buildSystemParam-equivalent slicing at the CACHE_BREAK markers
 *   5. Hash and compare tier 1 + tier 2 across turns
 *
 * If tier 2 hash stays identical: cache_creation in production is Anthropic
 * accounting noise, not a real leak in our code.
 * If tier 2 hash drifts: there's a leak — find what's drifting and what to
 * do about it.
 */

import 'dotenv/config'
import crypto from 'crypto'
import { createDMSystemPrompt } from '../server/services/dmPromptBuilder.js'
import { formatRepetitionLedger } from '../server/services/repetitionLedgerService.js'

// Mirror tests/cache-tier-diff.js character template (post-v1.0.97 with
// rich backstory).
const CHARACTER = {
  id: 0, name: 'Riv (test)', first_name: 'Riv', last_name: 'Freeborn',
  nickname: 'Riv', gender: 'male',
  race: 'Human', subrace: null,
  class: 'Cleric', subclass: 'Life Domain', background: 'Acolyte',
  level: 1, current_hp: 10, max_hp: 10,
  armor_class: 16, speed: 30,
  current_location: 'Sword Coast Wilderness, between settlements',
  current_quest: '',
  gold_cp: 0, gold_sp: 0, gold_gp: 90,
  experience: 0, experience_to_next_level: 300,
  ability_scores: JSON.stringify({ str: 14, dex: 10, con: 14, int: 12, wis: 16, cha: 13 }),
  skills: JSON.stringify(['Insight', 'Religion', 'Medicine', 'Persuasion']),
  advantages: JSON.stringify([]),
  inventory: JSON.stringify([
    { name: 'Holy Symbol of Lathander', quantity: 1 },
    { name: 'Healer\'s Kit', quantity: 1 },
    { name: 'Bedroll', quantity: 1 }
  ]),
  equipment: JSON.stringify({
    mainHand: { name: 'Mace', damage: '1d6', damageType: 'bludgeoning', quality: 'common' },
    offHand: { name: 'Shield', acBonus: 2 },
    armor: { name: 'Chain Mail', baseAC: 16, type: 'heavy', quality: 'common' }
  }),
  alignment: 'Neutral Good', faith: 'Lathander', lifestyle: 'Modest',
  hair_color: 'Brown', skin_color: 'Tan', eye_color: 'Hazel',
  height: '5\'10"', weight: '170 lbs', age: 28,
  personality_traits: 'Pragmatic and ambitious.',
  ideals: 'Hope.',
  bonds: 'Temple of Lathander in Millford.',
  flaws: 'Sometimes more interested in being seen as a hero than in actually being one.',
  backstory: 'Riv was raised in the modest town of Millford on the edge of the Mere of Dead Men.',
  known_cantrips: JSON.stringify(['Light', 'Sacred Flame', 'Spare the Dying']),
  known_spells: JSON.stringify(['Cure Wounds', 'Bless']),
  prepared_spells: JSON.stringify(['Cure Wounds', 'Bless']),
  feats: JSON.stringify([]),
  languages: JSON.stringify(['Common', 'Celestial']),
  tool_proficiencies: JSON.stringify([])
}

const CTX = {
  startingLocation: { name: 'Sword Coast Wilderness', description: 'Wild lands.', region: 'Sword Coast' },
  era: { years: '1370 DR', loreContext: 'Late Age of Humanity.' },
  arrivalHook: { name: 'Wandering Cleric', description: 'On the road.' },
  campaignLength: 'short-campaign',
  companions: [], usedNames: []
}

const CACHE_BREAK_CORE = '<!-- CACHE_BREAK:AFTER_CORE -->'
const CACHE_BREAK_CHARACTER = '<!-- CACHE_BREAK:AFTER_CHARACTER -->'

function splitTiers(prompt) {
  const coreIdx = prompt.indexOf(CACHE_BREAK_CORE)
  if (coreIdx < 0) return { tier1: prompt, tier2: '', tier3: '' }
  const charIdx = prompt.indexOf(CACHE_BREAK_CHARACTER)
  const tier1 = prompt.slice(0, coreIdx)
  const tier2 = charIdx > coreIdx
    ? prompt.slice(coreIdx + CACHE_BREAK_CORE.length, charIdx)
    : prompt.slice(coreIdx + CACHE_BREAK_CORE.length)
  const tier3 = charIdx > coreIdx ? prompt.slice(charIdx + CACHE_BREAK_CHARACTER.length) : ''
  return { tier1, tier2, tier3 }
}

function hash(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 12)
}

// Mimics the /message route's repetition-ledger strip + re-append.
const LEDGER_REGEX = /\n*══════════════════════════════════════════════════════════════\nRECENTLY USED IMAGERY[\s\S]*/

function applyLedger(content, similes) {
  const cleaned = content.replace(LEDGER_REGEX, '')
  const ledgerBlock = formatRepetitionLedger({ similes })
  return cleaned + ledgerBlock
}

// ---------------------------------------------------------------------------

console.log('Investigating cache_creation drift in tier 1 / tier 2...\n')

// Build the initial system prompt.
const initialPrompt = createDMSystemPrompt(CHARACTER, CTX)
console.log(`Initial prompt: ${initialPrompt.length} chars`)

// Simulate 12 turns. Each turn the ledger grows by a few similes.
const SIMILES_PER_TURN = [
  ['skinny as a pulled thread'],
  ['skinny as a pulled thread', 'like a coin at the bottom of a well'],
  ['skinny as a pulled thread', 'like a coin at the bottom of a well', 'cold as iron in winter'],
  ['skinny as a pulled thread', 'like a coin at the bottom of a well', 'cold as iron in winter', 'sharp as a fox'],
  ['skinny as a pulled thread', 'like a coin at the bottom of a well', 'cold as iron in winter', 'sharp as a fox', 'quiet as held breath'],
  ['skinny as a pulled thread', 'like a coin at the bottom of a well', 'cold as iron in winter', 'sharp as a fox', 'quiet as held breath', 'dark as wet stone'],
  ['skinny as a pulled thread', 'like a coin at the bottom of a well', 'cold as iron in winter', 'sharp as a fox', 'quiet as held breath', 'dark as wet stone', 'thin as smoke'],
  ['skinny as a pulled thread', 'like a coin at the bottom of a well', 'cold as iron in winter', 'sharp as a fox', 'quiet as held breath', 'dark as wet stone', 'thin as smoke', 'heavy as a vow'],
  ['skinny as a pulled thread', 'like a coin at the bottom of a well', 'cold as iron in winter', 'sharp as a fox', 'quiet as held breath', 'dark as wet stone', 'thin as smoke', 'heavy as a vow', 'bright as struck flint'],
  ['skinny as a pulled thread', 'like a coin at the bottom of a well', 'cold as iron in winter', 'sharp as a fox', 'quiet as held breath', 'dark as wet stone', 'thin as smoke', 'heavy as a vow', 'bright as struck flint', 'slow as honey'],
  ['skinny as a pulled thread', 'like a coin at the bottom of a well', 'cold as iron in winter', 'sharp as a fox', 'quiet as held breath', 'dark as wet stone', 'thin as smoke', 'heavy as a vow', 'bright as struck flint', 'slow as honey', 'wet as a held tear'],
  ['skinny as a pulled thread', 'like a coin at the bottom of a well', 'cold as iron in winter', 'sharp as a fox', 'quiet as held breath', 'dark as wet stone', 'thin as smoke', 'heavy as a vow', 'bright as struck flint', 'slow as honey', 'wet as a held tear', 'quick as a held grudge']
]

let currentContent = initialPrompt
const turnLog = []

console.log('\nTurn-by-turn simulation:\n')
console.log('Turn  T1 chars  T1 hash       T2 chars  T2 hash       T3 chars  Total')
console.log('────  ────────  ────────────  ────────  ────────────  ────────  ─────')

for (let i = 0; i < SIMILES_PER_TURN.length; i++) {
  // Apply the per-turn ledger mutation (strip old + re-append new).
  currentContent = applyLedger(currentContent, SIMILES_PER_TURN[i])
  const tiers = splitTiers(currentContent)
  const t1Hash = hash(tiers.tier1)
  const t2Hash = hash(tiers.tier2)
  turnLog.push({ turn: i + 1, t1Hash, t2Hash, t1Len: tiers.tier1.length, t2Len: tiers.tier2.length, t3Len: tiers.tier3.length })
  console.log(
    `t${(i + 1).toString().padStart(2)}   ` +
    `${tiers.tier1.length.toString().padStart(8)}  ${t1Hash}  ` +
    `${tiers.tier2.length.toString().padStart(8)}  ${t2Hash}  ` +
    `${tiers.tier3.length.toString().padStart(8)}  ${currentContent.length}`
  )
}

// Verdict
console.log()
const t1Hashes = new Set(turnLog.map(t => t.t1Hash))
const t2Hashes = new Set(turnLog.map(t => t.t2Hash))
const t3Hashes = new Set(turnLog.map(t => `${t.t3Len}`))  // t3 expected to grow

console.log(`Tier 1 unique hashes across ${turnLog.length} turns: ${t1Hashes.size}`)
console.log(`Tier 2 unique hashes across ${turnLog.length} turns: ${t2Hashes.size}`)
console.log(`Tier 3 unique sizes across ${turnLog.length} turns: ${t3Hashes.size} (expected: many — ledger grows)`)

if (t1Hashes.size === 1 && t2Hashes.size === 1) {
  console.log('\n✓ Tier 1 and Tier 2 are BYTE-STABLE under the ledger-mutation pattern.')
  console.log('  → If production cache_creation is non-zero with stable cache_read,')
  console.log('    the cause is on Anthropic\'s side, not ours.')
} else {
  console.log('\n✗ Tier 1 or Tier 2 content is DRIFTING — there\'s a real leak.')
  if (t1Hashes.size > 1) {
    console.log('  Tier 1 changed across turns — investigate what\'s above CACHE_BREAK:AFTER_CORE.')
  }
  if (t2Hashes.size > 1) {
    console.log('  Tier 2 changed across turns — investigate what\'s between CACHE_BREAK markers.')
    // Find where it changed
    for (let i = 1; i < turnLog.length; i++) {
      if (turnLog[i].t2Hash !== turnLog[i - 1].t2Hash) {
        console.log(`    First drift between t${i} (${turnLog[i - 1].t2Hash}) and t${i + 1} (${turnLog[i].t2Hash})`)
      }
    }
  }
}

// Also test: what if a marker correction is appended too? The route does this.
console.log('\n--- Bonus test: with marker correction injected ---')
const withCorrection = currentContent + '\n\n══════════════ MARKER CORRECTION NEEDED (from last turn) ══════════════\nMalformed [LOOT_DROP] marker — reformat per schema.\n═══════════════════════════════════════════════════════════════════════\n'
const tiersWithCorrection = splitTiers(withCorrection)
console.log(`After correction injection: T1 hash ${hash(tiersWithCorrection.tier1)} (was ${turnLog[turnLog.length - 1].t1Hash}), T2 hash ${hash(tiersWithCorrection.tier2)} (was ${turnLog[turnLog.length - 1].t2Hash})`)

// And: what if the ledger strip regex misfires?
console.log('\n--- Bonus test: ledger strip regex applied to a prompt without a ledger ---')
const stripped = initialPrompt.replace(LEDGER_REGEX, '')
console.log(`Initial prompt unchanged by strip? ${stripped === initialPrompt} (length ${initialPrompt.length} → ${stripped.length})`)
