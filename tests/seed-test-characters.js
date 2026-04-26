/**
 * Seed 4 identical test characters for the prose-quality A/B playtest.
 *
 * The user is testing 4 conditions:
 *   A — Sonnet + default prompt
 *   B — Sonnet + lean prompt
 *   C — Opus   + default prompt
 *   D — Opus   + lean prompt
 *
 * Each condition needs its own character so chronicle/canon data from one
 * run doesn't contaminate the others. All 4 are statistically identical
 * (same race/class/stats/equipment) so the only variable in the test is
 * the model + prompt mode. Each run starts cold — no prior sessions.
 *
 * Character template: Riv Freeborn — male human cleric of Lathander,
 * level 1, Life Domain, Neutral Good. Matches the original "Order of
 * Dawn's Light" PDF baseline so the playtest is directly comparable.
 *
 * Run:    node tests/seed-test-characters.js
 * Reset:  node tests/seed-test-characters.js --reset   (deletes prior test chars)
 *
 * After running, the four characters appear in the character list as
 * "Riv (A) — Sonnet/Default", etc. Pick one, set the home pill to match,
 * start a session, and play your scripted inputs.
 */

import 'dotenv/config'
import { dbRun, dbGet, dbAll } from '../server/database.js'

const CONDITIONS = [
  { tag: 'A', model: 'Sonnet', prompt: 'Default' },
  { tag: 'B', model: 'Sonnet', prompt: 'Lean' },
  { tag: 'C', model: 'Opus',   prompt: 'Default' },
  { tag: 'D', model: 'Opus',   prompt: 'Lean' }
]

// Single source of truth for the character template. All 4 use this.
// `creation_phase = 'active'` skips the prelude flow and drops them
// straight into the main DM session.
const TEMPLATE = {
  first_name: 'Riv',
  last_name: 'Freeborn',
  gender: 'male',
  race: 'Human',
  subrace: null,
  class: 'Cleric',
  subclass: 'Life Domain',
  background: 'Acolyte',
  level: 1,
  current_hp: 10,
  max_hp: 10,
  // Neutral start — no werewolf priming. Original seed put "strange howls
  // and missing livestock in Darkwood Forest" here, which is a textbook
  // werewolf-mystery setup that locked every test run into the same plot.
  // Leaving location vague + no quest lets the AI generate fresh story arcs
  // per condition, isolating prose differences from plot differences.
  current_location: 'Sword Coast Wilderness, between settlements',
  current_quest: '',
  gold_cp: 0, gold_sp: 0, gold_gp: 90,
  experience: 0, experience_to_next_level: 300,
  armor_class: 16, speed: 30,
  ability_scores: JSON.stringify({ str: 14, dex: 10, con: 14, int: 12, wis: 16, cha: 13 }),
  skills: JSON.stringify(['Insight', 'Religion', 'Medicine', 'Persuasion']),
  advantages: JSON.stringify([]),
  inventory: JSON.stringify([
    { name: 'Holy Symbol of Lathander', quantity: 1, description: 'A sunrise medallion on a leather thong' },
    { name: 'Healer\'s Kit', quantity: 1 },
    { name: 'Bedroll', quantity: 1 },
    { name: 'Rations (1 day)', quantity: 7 },
    { name: 'Waterskin', quantity: 1 },
    { name: 'Traveling Cloak', quantity: 1 },
    { name: 'Tinderbox', quantity: 1 },
    { name: 'Torch', quantity: 5 },
    { name: 'Common Clothes', quantity: 1 },
    { name: 'Belt Pouch', quantity: 1 }
  ]),
  faction_standings: JSON.stringify({}),
  injuries: JSON.stringify([]),
  debuffs: JSON.stringify([]),
  equipment: JSON.stringify({
    mainHand: { name: 'Mace', damage: '1d6', damageType: 'bludgeoning', quality: 'common', properties: [] },
    offHand: { name: 'Shield', acBonus: 2 },
    armor: { name: 'Chain Mail', baseAC: 16, type: 'heavy', quality: 'common' }
  }),
  avatar: null,
  alignment: 'Neutral Good',
  faith: 'Lathander',
  lifestyle: 'Modest',
  hair_color: 'Brown',
  skin_color: 'Tan',
  eye_color: 'Hazel',
  height: '5\'10"',
  weight: '170 lbs',
  age: 28,
  personality_traits: 'Pragmatic and ambitious. Genuinely wants to help people but is honest about his hunger for greatness — he wants to be remembered as a great healer and hero, and that ambition sometimes shapes his choices.',
  ideals: 'Hope. Lathander brings the dawn; I bring it to the people who need it most.',
  bonds: 'I owe my training to the temple of Lathander in Millford and will not bring shame to it.',
  flaws: 'I am sometimes more interested in being seen as a hero than in actually being one.',
  organizations: 'Temple of Lathander (Millford)',
  allies: '',
  enemies: '',
  // Richer backstory (~1100 chars) — populates tier 2 of the prompt cache
  // above the 1024-token threshold so per-character cache hits work across
  // every turn of a session. Short backstories leave tier 2 below threshold
  // and force a merge-with-tier-3, killing per-character cache benefit.
  // The content here is generic enough to not pre-determine plot direction.
  backstory: 'Riv was raised in the modest town of Millford on the edge of the Mere of Dead Men, the third son of a fletcher and a midwife. The morning sun, his mother used to say, was the only thing that came to their house without expecting payment. Riv took that to heart in his own way — he loved the dawn, but he also wanted, badly, to be SOMEONE the dawn shone on. The temple of Lathander accepted him as a postulant when he was fourteen; by twenty-two he had taken his vows and earned a copper sun-disc, modest as such things go but his own. The temple sent him north to learn what people in the wider world prayed for, and he traveled for a season among logging camps and farming villages, treating fevers, blessing fields, marrying the occasional hopeful couple. He reached the Sword Coast wilderness a week ago, on foot, traveling cloak road-worn and boots in worse shape than when he left. He has done good work, and he has been seen doing it, and both matter to him in proportions he is still trying to sort out. Lathander\'s creed is "be the dawn for others"; Riv\'s private revision is "be the dawn, and be remembered for it."',
  other_notes: '',
  known_cantrips: JSON.stringify(['Light', 'Sacred Flame', 'Spare the Dying']),
  known_spells: JSON.stringify(['Cure Wounds', 'Bless', 'Healing Word', 'Guiding Bolt', 'Shield of Faith', 'Detect Magic', 'Protection from Evil and Good', 'Sanctuary', 'Ceremony']),
  prepared_spells: JSON.stringify(['Cure Wounds', 'Bless', 'Healing Word', 'Guiding Bolt', 'Protection from Evil and Good', 'Sanctuary']),
  feats: JSON.stringify([]),
  languages: JSON.stringify(['Common', 'Celestial']),
  tool_proficiencies: JSON.stringify([]),
  // Critical: skip the prelude wizard and go straight to active play.
  creation_phase: 'active'
}

const COLUMNS = [
  'name', 'first_name', 'last_name', 'nickname', 'gender',
  'class', 'subclass', 'race', 'subrace', 'background',
  'level', 'current_hp', 'max_hp', 'current_location', 'current_quest',
  'gold_cp', 'gold_sp', 'gold_gp', 'starting_gold_cp', 'starting_gold_sp', 'starting_gold_gp',
  'experience', 'experience_to_next_level',
  'armor_class', 'speed', 'ability_scores', 'skills', 'advantages', 'inventory',
  'faction_standings', 'injuries', 'debuffs', 'equipment',
  'avatar', 'alignment', 'faith', 'lifestyle',
  'hair_color', 'skin_color', 'eye_color', 'height', 'weight', 'age',
  'personality_traits', 'ideals', 'bonds', 'flaws',
  'organizations', 'allies', 'enemies', 'backstory', 'other_notes',
  'known_cantrips', 'known_spells', 'prepared_spells', 'feats', 'languages', 'tool_proficiencies',
  'creation_phase'
]

async function reset() {
  // Some FK references prevent direct DELETE on characters that have
  // already played a session (dm_sessions, chronicles, npc_relationships,
  // canon_facts, etc.). Rather than cascade-delete a long list of tables
  // and risk corrupting a real character by accident, we surface the
  // existing test rows and let the user delete them through the app's
  // character manager (which already handles cascades correctly).
  const rows = await dbAll('SELECT id, name FROM characters WHERE name LIKE ?', ['Riv (%) — %'])
  if (rows.length === 0) {
    console.log('  (no prior test characters found)')
    return
  }
  console.log('  Existing test characters in DB:')
  for (const r of rows) {
    console.log(`    #${r.id} — ${r.name}`)
  }
  console.log('')
  console.log('  Manual cleanup: open the app, delete these from the character manager, then re-run.')
  console.log('  Or just continue — new test characters will get new IDs and coexist with the old ones.')
  console.log('')
}

async function seedOne(condition) {
  const name = `Riv (${condition.tag}) — ${condition.model}/${condition.prompt}`
  const nickname = `Riv ${condition.tag}`

  // Build the value list in the same order as COLUMNS.
  const values = [
    name, TEMPLATE.first_name, TEMPLATE.last_name, nickname, TEMPLATE.gender,
    TEMPLATE.class, TEMPLATE.subclass, TEMPLATE.race, TEMPLATE.subrace, TEMPLATE.background,
    TEMPLATE.level, TEMPLATE.current_hp, TEMPLATE.max_hp, TEMPLATE.current_location, TEMPLATE.current_quest,
    TEMPLATE.gold_cp, TEMPLATE.gold_sp, TEMPLATE.gold_gp,
    TEMPLATE.gold_cp, TEMPLATE.gold_sp, TEMPLATE.gold_gp, // starting_* matches initial gold
    TEMPLATE.experience, TEMPLATE.experience_to_next_level,
    TEMPLATE.armor_class, TEMPLATE.speed, TEMPLATE.ability_scores, TEMPLATE.skills, TEMPLATE.advantages, TEMPLATE.inventory,
    TEMPLATE.faction_standings, TEMPLATE.injuries, TEMPLATE.debuffs, TEMPLATE.equipment,
    TEMPLATE.avatar, TEMPLATE.alignment, TEMPLATE.faith, TEMPLATE.lifestyle,
    TEMPLATE.hair_color, TEMPLATE.skin_color, TEMPLATE.eye_color, TEMPLATE.height, TEMPLATE.weight, TEMPLATE.age,
    TEMPLATE.personality_traits, TEMPLATE.ideals, TEMPLATE.bonds, TEMPLATE.flaws,
    TEMPLATE.organizations, TEMPLATE.allies, TEMPLATE.enemies, TEMPLATE.backstory, TEMPLATE.other_notes,
    TEMPLATE.known_cantrips, TEMPLATE.known_spells, TEMPLATE.prepared_spells, TEMPLATE.feats, TEMPLATE.languages, TEMPLATE.tool_proficiencies,
    TEMPLATE.creation_phase
  ]
  const placeholders = COLUMNS.map(() => '?').join(', ')
  const sql = `INSERT INTO characters (${COLUMNS.join(', ')}) VALUES (${placeholders})`
  const result = await dbRun(sql, values)
  return { id: result.lastInsertRowid, name, condition }
}

async function main() {
  const args = process.argv.slice(2)
  const doReset = args.includes('--reset')

  if (doReset) {
    console.log('Resetting prior test characters...')
    await reset()
    console.log('')
  }

  console.log('Seeding 4 test characters...')
  const created = []
  for (const c of CONDITIONS) {
    const r = await seedOne(c)
    created.push(r)
    console.log(`  ✓ #${r.id}  ${r.name}`)
  }

  console.log('')
  console.log('Done. Open the app, refresh your character list, and you should see all 4.')
  console.log('')
  console.log('Test mapping:')
  console.log('  Riv (A) — Sonnet/Default → Home pill: Sonnet, Lean OFF')
  console.log('  Riv (B) — Sonnet/Lean    → Home pill: Sonnet, Lean ON')
  console.log('  Riv (C) — Opus/Default   → Home pill: Opus,   Lean OFF')
  console.log('  Riv (D) — Opus/Lean      → Home pill: Opus,   Lean ON')
  console.log('')
  console.log('To clear and re-seed: node tests/seed-test-characters.js --reset')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
