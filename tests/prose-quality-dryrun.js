/**
 * Dry-run: build the canonical prompt and verify each variant's transform
 * actually strips what it claims to strip. No API calls. Run before the
 * full harness to catch regex bugs.
 */
import 'dotenv/config';
import { createDMSystemPrompt } from '../server/services/dmPromptBuilder.js';

// Reuse fixtures from the main harness — duplicated here to keep the
// dry-run independent (no top-level await imports needed).
const RIV = {
  id: 1, name: 'Riv Freeborn', first_name: 'Riv', gender: 'male',
  race: 'Human', class: 'Cleric', subclass: 'Life Domain', level: 1, alignment: 'Neutral Good',
  current_hp: 10, max_hp: 10, armor_class: 16,
  current_location: 'Thornhaven', current_quest: 'Investigate strange howls',
  experience_to_next_level: 300, gold_gp: 90, gold_sp: 0, gold_cp: 0,
  ability_scores: JSON.stringify({ str: 14, dex: 10, con: 14, int: 12, wis: 16, cha: 13 }),
  skills: JSON.stringify(['Insight', 'Religion', 'Medicine', 'Persuasion']),
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
};

const SESSION_CTX = {
  startingLocation: { name: 'Thornhaven', description: 'A village.', region: 'Sword Coast' },
  era: { years: '1370 DR', loreContext: 'Late Age of Humanity.' },
  arrivalHook: { name: 'Wandering Cleric', description: 'On the road.' },
  campaignLength: 'short-campaign',
  companions: [], usedNames: []
};

const baseline = createDMSystemPrompt(RIV, SESSION_CTX);

console.log(`Baseline prompt: ${baseline.length} chars\n`);

// Sanity checks: do the markers we plan to strip actually appear?
const checks = [
  { needle: 'Length: 30-120 words', label: 'V2 target (SPOTLIGHT word range)' },
  { needle: 'Length: 120-250 words total', label: 'V2 target (COUNCIL word range)' },
  { needle: 'BEFORE YOU SEND — SELF-CHECK', label: 'V3 target (self-check heading)' },
  { needle: 'If all five clean, send.', label: 'V3 target (self-check tail)' },
  { needle: 'MECHANICAL MARKERS', label: 'V4 target (mechanical markers heading)' },
  { needle: 'END OF CORE RULES', label: 'V4 boundary (end-of-core anchor)' }
];
for (const c of checks) {
  const found = baseline.includes(c.needle);
  console.log(`${found ? '✓' : '✗'} ${c.label}: "${c.needle}"`);
}

console.log('');

// Apply each transform and report char delta.
const transforms = {
  V2: (p) => p
    .replace(/  Length: \d+-\d+ words.*\n/g, '')
    .replace(/  Length: \d+-\d+ words total.*\n/g, ''),
  V3: (p) => p.replace(
    /═══+\s*\nBEFORE YOU SEND — SELF-CHECK[\s\S]*?If all five clean, send\.\s*$/m,
    ''
  ).trimEnd(),
  V4: (p) => p.replace(
    /═══+\s*\nMECHANICAL MARKERS\s*\n═══+[\s\S]*?(?=\n═══+\s*\nEND OF CORE RULES|\n──────────── STORY MEMORY)/,
    ''
  )
};

for (const [id, fn] of Object.entries(transforms)) {
  const out = fn(baseline);
  const delta = baseline.length - out.length;
  console.log(`${id}: ${out.length} chars (Δ ${delta < 0 ? '+' : '-'}${Math.abs(delta)})`);
  // Confirm the targets are gone
  if (id === 'V2') {
    const stillThere = (out.match(/Length: \d+-\d+ words/g) || []).length;
    console.log(`  Length: word ranges remaining: ${stillThere} (want 0)`);
  }
  if (id === 'V3') {
    console.log(`  Self-check heading gone? ${!out.includes('BEFORE YOU SEND')}`);
  }
  if (id === 'V4') {
    console.log(`  Mechanical Markers heading gone? ${!out.includes('═══════════════════════════════════════════════════════════════\nMECHANICAL MARKERS')}`);
    console.log(`  Self-check still present? ${out.includes('BEFORE YOU SEND')}`);
    console.log(`  Cardinal Rule 5 still present? ${out.includes('MARKERS = MECHANICS')}`);
  }
}
