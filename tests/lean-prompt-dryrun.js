/**
 * Verify applyLeanTransforms() actually strips what it claims to strip.
 * No API calls. Mirrors the dryrun pattern from prose-quality testing.
 */
import 'dotenv/config'
import { createDMSystemPrompt, applyLeanTransforms } from '../server/services/dmPromptBuilder.js'

const RIV = {
  id: 1, name: 'Riv Freeborn', first_name: 'Riv', gender: 'male',
  race: 'Human', class: 'Cleric', subclass: 'Life Domain', level: 1, alignment: 'Neutral Good',
  current_hp: 10, max_hp: 10, armor_class: 16,
  current_location: 'Thornhaven', current_quest: 'Investigate strange howls',
  experience_to_next_level: 300, gold_gp: 90, gold_sp: 0, gold_cp: 0,
  ability_scores: JSON.stringify({ str: 14, dex: 10, con: 14, int: 12, wis: 16, cha: 13 }),
  skills: JSON.stringify(['Insight', 'Religion']),
  feats: JSON.stringify([]),
  equipment: JSON.stringify({
    mainHand: { name: 'Mace', damage: '1d6', damageType: 'bludgeoning', quality: 'common' },
    offHand: { name: 'Shield', acBonus: 2 },
    armor: { name: 'Chain Mail', baseAC: 16, type: 'heavy', quality: 'common' }
  }),
  inventory: JSON.stringify([]),
  known_cantrips: JSON.stringify([]),
  known_spells: JSON.stringify([]),
  prepared_spells: JSON.stringify([]),
  backstory: 'Test cleric'
}

const CTX = {
  startingLocation: { name: 'Thornhaven', description: 'A village.', region: 'Sword Coast' },
  era: { years: '1370 DR', loreContext: 'Late Age of Humanity.' },
  arrivalHook: { name: 'Wandering Cleric', description: 'On the road.' },
  campaignLength: 'short-campaign',
  companions: [], usedNames: []
}

const full = createDMSystemPrompt(RIV, CTX)
const lean = applyLeanTransforms(full)

console.log(`Full prompt:  ${full.length} chars`)
console.log(`Lean prompt:  ${lean.length} chars`)
console.log(`Saved:        ${full.length - lean.length} chars (${Math.round((1 - lean.length/full.length) * 100)}%)\n`)

const checks = [
  { needle: 'MERCHANT SHOPPING', shouldBeIn: 'full', shouldNotBeIn: 'lean', label: '[markers] MERCHANT SHOPPING block' },
  { needle: 'PLAYER OBSERVATION = ALWAYS A CHECK', shouldBeIn: 'full', shouldNotBeIn: 'lean', label: '[markers] PLAYER OBSERVATION rule' },
  // Match the actual marker spec format ("[LOOT_DROP: Item=..."), not the
  // example reference in Cardinal Rule 5 which intentionally survives.
  { needle: '[LOOT_DROP: Item=', shouldBeIn: 'full', shouldNotBeIn: 'lean', label: '[markers] LOOT_DROP marker spec' },
  { needle: '2. HARD STOPS', shouldBeIn: 'full', shouldNotBeIn: 'lean', label: '[rules] strict Cardinal Rule 2 heading' },
  { needle: 'No atmospheric follow-up', shouldBeIn: 'full', shouldNotBeIn: 'lean', label: '[rules] strict Rule 2 prohibition' },
  { needle: '2. ROLL REQUESTS — DON\'T SPOIL OUTCOMES', shouldBeIn: 'lean', shouldNotBeIn: 'full', label: '[rules] soft Cardinal Rule 2 heading' },
  { needle: 'you may continue narrating the surrounding moment', shouldBeIn: 'lean', shouldNotBeIn: 'full', label: '[rules] soft Rule 2 permission' },
  { needle: 'MECHANICAL MARKERS — DISABLED THIS SESSION', shouldBeIn: 'lean', shouldNotBeIn: 'full', label: '[markers] disabled-stub heading' },
  { needle: 'CARDINAL RULES', shouldBeIn: 'both', label: '[rules] CARDINAL RULES heading (preserved)' },
  { needle: '3. SCENE INTEGRITY', shouldBeIn: 'both', label: '[rules] Cardinal Rule 3 (untouched)' },
  { needle: 'PLAYER SOVEREIGNTY', shouldBeIn: 'both', label: '[rules] Cardinal Rule 1 (untouched)' },
  { needle: 'CRAFT PRINCIPLES', shouldBeIn: 'both', label: '[craft] Craft Principles section (untouched)' },
  { needle: 'CONVERSATION HANDLING', shouldBeIn: 'both', label: '[craft] Conversation Handling section (untouched)' },
  { needle: 'BEFORE YOU SEND — SELF-CHECK', shouldBeIn: 'both', label: '[tail] Self-Check (untouched)' },
]

let passed = 0
let failed = 0
for (const c of checks) {
  const inFull = full.includes(c.needle)
  const inLean = lean.includes(c.needle)
  const expectFull = c.shouldBeIn === 'full' || c.shouldBeIn === 'both'
  const expectLean = c.shouldBeIn === 'lean' || c.shouldBeIn === 'both'
  const ok = inFull === expectFull && inLean === expectLean
  if (ok) {
    passed++
    console.log(`  ✓ ${c.label}`)
  } else {
    failed++
    console.log(`  ✗ ${c.label}`)
    console.log(`      expected: full=${expectFull} lean=${expectLean}`)
    console.log(`      actual:   full=${inFull} lean=${inLean}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
