/**
 * Diagnose tier 2 cache leak.
 *
 * The user's production logs show tier 2 (per-character) cache being
 * recreated almost every turn while tier 1 holds. That means SOMETHING
 * in the tier 2 content block is changing between identical-character
 * turns. Hypotheses:
 *
 *   H1: Tier 2 size hovers around the 4096-char cache minimum and
 *       flip-flops between "cacheable" and "merged into tier 3".
 *   H2: Some dynamic value (HP, gold, equipped item, NAMES_ALREADY_USED,
 *       progression snapshot) leaks into tier 2 instead of tier 3.
 *   H3: Tier 2 content is genuinely identical but the cache is being
 *       evicted by TTL during slow play (already known from logs).
 *
 * This script builds the prompt twice with the SAME character + session
 * context, splits at the cache breaks, and tells us:
 *   - Tier 1, 2, 3 sizes (chars + tokens)
 *   - Whether tier 2 is over the cache minimum
 *   - If the two builds differ, where the diff is
 */

import 'dotenv/config'
import { dbGet } from '../server/database.js'
import { createDMSystemPrompt } from '../server/services/dmPromptBuilder.js'

const CACHE_BREAK_CORE = '<!-- CACHE_BREAK:AFTER_CORE -->'
const CACHE_BREAK_CHARACTER = '<!-- CACHE_BREAK:AFTER_CHARACTER -->'
const CACHE_MIN_TOKENS = 1024
const CACHE_MIN_CHARS = CACHE_MIN_TOKENS * 4

function splitTiers(prompt) {
  const coreIdx = prompt.indexOf(CACHE_BREAK_CORE)
  const charIdx = prompt.indexOf(CACHE_BREAK_CHARACTER)
  if (coreIdx < 0) return { tier1: prompt, tier2: '', tier3: '' }
  const tier1 = prompt.slice(0, coreIdx)
  const tier2 = charIdx > coreIdx
    ? prompt.slice(coreIdx + CACHE_BREAK_CORE.length, charIdx)
    : prompt.slice(coreIdx + CACHE_BREAK_CORE.length)
  const tier3 = charIdx > coreIdx
    ? prompt.slice(charIdx + CACHE_BREAK_CHARACTER.length)
    : ''
  return { tier1, tier2, tier3 }
}

function fmt(label, n) {
  return `${label.padEnd(20)} ${n.toString().padStart(7)} chars / ~${Math.round(n/4).toString().padStart(5)} tokens`
}

// Find the FIRST place two strings diverge. Returns null if identical.
function firstDiff(a, b) {
  if (a === b) return null
  const min = Math.min(a.length, b.length)
  let i = 0
  while (i < min && a[i] === b[i]) i++
  // Show 80 chars before and after the divergence point
  const before = a.slice(Math.max(0, i - 80), i)
  const aAfter = a.slice(i, Math.min(a.length, i + 80))
  const bAfter = b.slice(i, Math.min(b.length, i + 80))
  return { offset: i, before, aAfter, bAfter }
}

async function main() {
  // Use a synthesized character matching the latest seed template directly.
  // Reading from DB would tie the test to whatever's currently seeded, which
  // can drift from the template. The synthesized version always reflects the
  // current intended character shape. Mirrors tests/seed-test-characters.js
  // TEMPLATE — keep them in sync if either changes.
  const character = {
    id: 0, name: 'Riv (test) — synthesized', first_name: 'Riv', last_name: 'Freeborn',
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
      { name: 'Holy Symbol of Lathander', quantity: 1, description: 'A sunrise medallion on a leather thong' },
      { name: 'Healer\'s Kit', quantity: 1 },
      { name: 'Bedroll', quantity: 1 },
      { name: 'Rations (1 day)', quantity: 7 },
      { name: 'Waterskin', quantity: 1 }
    ]),
    equipment: JSON.stringify({
      mainHand: { name: 'Mace', damage: '1d6', damageType: 'bludgeoning', quality: 'common' },
      offHand: { name: 'Shield', acBonus: 2 },
      armor: { name: 'Chain Mail', baseAC: 16, type: 'heavy', quality: 'common' }
    }),
    alignment: 'Neutral Good', faith: 'Lathander', lifestyle: 'Modest',
    hair_color: 'Brown', skin_color: 'Tan', eye_color: 'Hazel',
    height: '5\'10"', weight: '170 lbs', age: 28,
    personality_traits: 'Pragmatic and ambitious. Genuinely wants to help people but is honest about his hunger for greatness — he wants to be remembered as a great healer and hero, and that ambition sometimes shapes his choices.',
    ideals: 'Hope. Lathander brings the dawn; I bring it to the people who need it most.',
    bonds: 'I owe my training to the temple of Lathander in Millford and will not bring shame to it.',
    flaws: 'I am sometimes more interested in being seen as a hero than in actually being one.',
    backstory: 'Riv was raised in the modest town of Millford on the edge of the Mere of Dead Men, the third son of a fletcher and a midwife. The morning sun, his mother used to say, was the only thing that came to their house without expecting payment. Riv took that to heart in his own way — he loved the dawn, but he also wanted, badly, to be SOMEONE the dawn shone on. The temple of Lathander accepted him as a postulant when he was fourteen; by twenty-two he had taken his vows and earned a copper sun-disc, modest as such things go but his own. The temple sent him north to learn what people in the wider world prayed for, and he traveled for a season among logging camps and farming villages, treating fevers, blessing fields, marrying the occasional hopeful couple. He reached the Sword Coast wilderness a week ago, on foot, traveling cloak road-worn and boots in worse shape than when he left. He has done good work, and he has been seen doing it, and both matter to him in proportions he is still trying to sort out. Lathander\'s creed is "be the dawn for others"; Riv\'s private revision is "be the dawn, and be remembered for it."',
    known_cantrips: JSON.stringify(['Light', 'Sacred Flame', 'Spare the Dying']),
    known_spells: JSON.stringify(['Cure Wounds', 'Bless', 'Healing Word', 'Guiding Bolt', 'Shield of Faith', 'Detect Magic', 'Protection from Evil and Good', 'Sanctuary', 'Ceremony']),
    prepared_spells: JSON.stringify(['Cure Wounds', 'Bless', 'Healing Word', 'Guiding Bolt', 'Protection from Evil and Good', 'Sanctuary']),
    feats: JSON.stringify([]),
    languages: JSON.stringify(['Common', 'Celestial']),
    tool_proficiencies: JSON.stringify([])
  }

  console.log(`Character: synthesized from current seed template\n`)

  const sessionContext = {
    startingLocation: { name: 'Sword Coast Wilderness', description: 'Wild lands.', region: 'Sword Coast' },
    era: { years: '1370 DR', loreContext: 'Late Age of Humanity.' },
    arrivalHook: { name: 'Wandering Cleric', description: 'On the road.' },
    campaignLength: 'short-campaign',
    companions: [],
    usedNames: []
  }

  // Build the prompt twice with identical inputs (sanity check) AND with a
  // simulated state change (HP drops, gold spent, item gained, location moved)
  // — which is the production scenario. The post-v1.0.95 architecture must
  // keep tier 2 byte-identical regardless of these state changes.
  const p1 = createDMSystemPrompt(character, sessionContext)
  const characterAfterTurn = {
    ...character,
    current_hp: Math.max(1, character.current_hp - 4),
    gold_gp: (character.gold_gp || 0) - 25,
    current_location: 'On the road, half a day east of Thornhaven',
    current_quest: 'Find the source of the howling',
    inventory: typeof character.inventory === 'string'
      ? JSON.stringify([...JSON.parse(character.inventory), { name: 'Silvered Arrow', quantity: 3 }])
      : [...(character.inventory || []), { name: 'Silvered Arrow', quantity: 3 }]
  }
  const p2 = createDMSystemPrompt(characterAfterTurn, sessionContext)

  const t1 = splitTiers(p1)
  const t2 = splitTiers(p2)

  console.log('=== PROMPT TIERS (run 1) ===')
  console.log(fmt('Tier 1 (universal)', t1.tier1.length))
  console.log(fmt('Tier 2 (character)', t1.tier2.length))
  console.log(fmt('Tier 3 (dynamic)',  t1.tier3.length))
  console.log(`Tier 2 cacheable? ${t1.tier2.length >= CACHE_MIN_CHARS ? 'YES' : `NO (need ${CACHE_MIN_CHARS}, have ${t1.tier2.length}, short by ${CACHE_MIN_CHARS - t1.tier2.length})`}`)
  console.log()

  console.log('=== IDENTICAL-INPUT REBUILD (run 2 vs run 1) ===')
  let allMatch = true
  for (const tier of ['tier1', 'tier2', 'tier3']) {
    const diff = firstDiff(t1[tier], t2[tier])
    if (!diff) {
      console.log(`  ✓ ${tier} byte-identical`)
    } else {
      allMatch = false
      console.log(`  ✗ ${tier} differs at offset ${diff.offset}`)
      console.log(`    before: …${JSON.stringify(diff.before).slice(-80)}`)
      console.log(`    run 1:  ${JSON.stringify(diff.aAfter).slice(0, 80)}…`)
      console.log(`    run 2:  ${JSON.stringify(diff.bAfter).slice(0, 80)}…`)
    }
  }
  if (allMatch) console.log('  All three tiers byte-identical for identical inputs.')
  console.log()

  // Simulate what happens between turns. The system prompt is built ONCE at
  // session start, then stored. What can change at /message time?
  //
  //   1. The repetition-ledger injection appends a tail block to messages[0]
  //      (after the SELF-CHECK section) — that's tier 3, not tier 2.
  //   2. The marker-correction injection appends another tail block — tier 3.
  //   3. The rolling-summary compaction edits the message *history*, not
  //      the system prompt.
  //
  // So in theory the system prompt — and therefore tier 2 — should stay the
  // same across turns. If it's not, the bug is in one of those injection paths.
  console.log('=== TIER 2 CONTENT (first 500 chars) ===')
  console.log(t1.tier2.slice(0, 500))
  console.log('…')
  console.log()
  console.log('=== TIER 2 CONTENT (last 300 chars) ===')
  console.log(t1.tier2.slice(-300))
  console.log()

  // Diagnostic: is tier 2 borderline?
  console.log('=== HYPOTHESIS H1: tier 2 size flip-flop around cache minimum ===')
  if (t1.tier2.length >= CACHE_MIN_CHARS && t1.tier2.length < CACHE_MIN_CHARS + 1000) {
    console.log(`  ⚠ Tier 2 is ${t1.tier2.length} chars — within 1000 chars of the ${CACHE_MIN_CHARS} minimum.`)
    console.log(`  Small variations (HP change, gold change, item add/remove) could push tier 2 below`)
    console.log(`  the cache threshold and force buildSystemParam to merge it with tier 3.`)
  } else if (t1.tier2.length < CACHE_MIN_CHARS) {
    console.log(`  ⚠ Tier 2 is ${t1.tier2.length} chars — BELOW the ${CACHE_MIN_CHARS} minimum.`)
    console.log(`  Tier 2 is being merged with tier 3 and never cached on its own.`)
    console.log(`  Need to push tier 2 above ${CACHE_MIN_CHARS} chars to enable independent caching.`)
  } else {
    console.log(`  ✓ Tier 2 is ${t1.tier2.length} chars — comfortably above ${CACHE_MIN_CHARS} minimum.`)
  }

  // Production logs showed tier 2 oscillating between ~1800 and ~5000 chars
  // across turns. Print a summary.
  console.log()
  console.log('=== EXPECTED FROM PRODUCTION LOGS ===')
  console.log('  Session 144 (Sonnet/Default): tier 2 created at 2278, 3460, 3898, 4648 across different turns')
  console.log('  Session 145 (Sonnet/Lean):    tier 2 created at 1831, 5012, 5927 across different turns')
  console.log('  → tier 2 size is NOT stable turn-to-turn in production')
  console.log('  → either content varies (find what), or it never crosses cache threshold (raise it)')
}

main().catch(err => { console.error(err); process.exit(1) })
