/**
 * Prose Quality A/B Test Harness
 *
 * Tests four hypotheses about why current DM sessions read thinner than the
 * original Opus 4.5 baseline (see "Order of Dawn's Light" PDF in repo root):
 *
 *   V2 — Word-count caps in CONVERSATION HANDLING modes are squeezing
 *        prose. We strip the SPOTLIGHT/COUNCIL/CROSSTALK/WAIT word ranges
 *        and run again to see if Sonnet writes denser scenes when freed.
 *
 *   V3 — The SELF-CHECK at the prompt tail pushes toward defensive,
 *        thinner output. We strip the BEFORE YOU SEND block.
 *
 *   V4 — The MECHANICAL MARKERS section (every-turn marker scanning)
 *        taxes every response. We strip it and keep only the brief
 *        Cardinal Rule 5 mention.
 *
 *   V5 — Memory plumbing flattens NPCs into facts. We replace the full
 *        structured prompt with a one-sentence DM brief, mirroring the
 *        original's bare prompt. Tests how much scaffolding helps vs hurts.
 *
 * Each scenario × variant runs against Sonnet (the model that actually
 * runs sessions in production). Outputs land in
 * tests/output/prose-quality-results.md for human read-and-rank.
 *
 * Run: node tests/prose-quality.test.js
 * Requires ANTHROPIC_API_KEY in .env.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDMSystemPrompt } from '../server/services/dmPromptBuilder.js';
import * as claude from '../server/services/claude.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, 'output', 'prose-quality-results.md');

// ---------------------------------------------------------------------------
// Character fixture — Riv Freeborn, matching the original campaign baseline.
// Human male cleric of Lathander, Neutral Good, level 1. Starting kit per the
// original PDF. Stored as the DB would store it: JSON-stringified fields where
// the schema uses TEXT columns.
// ---------------------------------------------------------------------------

const RIV = {
  id: 1,
  name: 'Riv Freeborn',
  first_name: 'Riv',
  nickname: null,
  gender: 'male',
  race: 'Human',
  class: 'Cleric',
  subclass: 'Life Domain',
  level: 1,
  alignment: 'Neutral Good',
  current_hp: 10,
  max_hp: 10,
  armor_class: 16,
  current_location: 'Thornhaven, a small village on the edge of Darkwood Forest',
  current_quest: 'Investigate strange howls and missing livestock around Thornhaven',
  experience_to_next_level: 300,
  gold_gp: 90,
  gold_sp: 0,
  gold_cp: 0,
  ability_scores: JSON.stringify({ str: 14, dex: 10, con: 14, int: 12, wis: 16, cha: 13 }),
  skills: JSON.stringify(['Insight', 'Religion', 'Medicine', 'Persuasion']),
  feats: JSON.stringify([]),
  equipment: JSON.stringify({
    mainHand: { name: 'Mace', damage: '1d6', damageType: 'bludgeoning', quality: 'common', properties: [] },
    offHand: { name: 'Shield', acBonus: 2 },
    armor: { name: 'Chain Mail', baseAC: 16, type: 'heavy', quality: 'common' }
  }),
  inventory: JSON.stringify([
    { name: 'Holy Symbol of Lathander', quantity: 1, description: 'Sunrise medallion on a leather thong' },
    { name: 'Healer\'s Kit', quantity: 1 },
    { name: 'Bedroll', quantity: 1 },
    { name: 'Rations (1 day)', quantity: 7 },
    { name: 'Waterskin', quantity: 1 },
    { name: 'Traveling Cloak', quantity: 1 },
    { name: 'Tinderbox', quantity: 1 },
    { name: 'Torch', quantity: 5 }
  ]),
  known_cantrips: JSON.stringify(['Light', 'Sacred Flame', 'Spare the Dying']),
  known_spells: JSON.stringify(['Cure Wounds', 'Bless', 'Healing Word', 'Guiding Bolt', 'Shield of Faith', 'Detect Magic', 'Protection from Evil and Good', 'Sanctuary', 'Ceremony']),
  prepared_spells: JSON.stringify(['Cure Wounds', 'Bless', 'Healing Word', 'Guiding Bolt', 'Protection from Evil and Good', 'Sanctuary']),
  backstory: 'A traveling cleric of Lathander seeking knowledge and chances to prove himself. Driven by both genuine compassion and a hunger for greatness — he wants to be remembered as a great healer and hero, and that ambition sometimes overshadows the good he does.',
  personality_traits: 'Pragmatic, ambitious, devoted to Lathander but not naive about people'
};

// ---------------------------------------------------------------------------
// Session context — minimal but realistic. We don't load chronicles/memory
// from a real campaign because we want the prompt to be reproducible, but
// we DO build the same context shape the runtime uses.
// ---------------------------------------------------------------------------

const SESSION_CTX = {
  startingLocation: {
    name: 'Thornhaven',
    description: 'A small village on the edge of Darkwood Forest, beset by strange howls and disappearing livestock.',
    region: 'Sword Coast Wilderness'
  },
  era: {
    years: '1370 DR',
    loreContext: 'Late in the Age of Humanity, a generation after the Time of Troubles. The Sword Coast is in a relatively stable period — Waterdeep is prosperous, Baldur\'s Gate dominates trade — but the wilderness between the great cities remains dangerous.'
  },
  arrivalHook: {
    name: 'Wandering Cleric',
    description: 'Riv has been on the road for about a week, traveling north from Millford. Boots dusty, traveling cloak road-worn, looking for both a meal and a chance to do good.'
  },
  campaignLength: 'short-campaign',
  customConcepts: null,
  customNpcs: null,
  campaignModule: null,
  companions: [],
  awayCompanions: [],
  pendingDowntimeNarratives: null,
  previousSessionSummaries: null,
  continueCampaign: false,
  chronicleSummaries: null,
  characterMemories: null,
  campaignNotes: null,
  campaignPlanSummary: null,
  worldState: null,
  storyThreadsContext: null,
  narrativeQueueContext: null,
  chronicleContext: null,
  weatherContext: null,
  survivalContext: null,
  craftingContext: null,
  mythicContext: null,
  partyBaseContext: null,
  notorietyContext: null,
  projectsContext: null,
  progression: null,
  usedNames: [],
  pendingMarkerCorrections: null
};

// ---------------------------------------------------------------------------
// Scenarios — each a "moment" the original PDF handled with notable craft.
// Conversation history reconstructs the lead-up using the same exchanges that
// appeared in the original campaign log, so we're testing the AI's response
// to the same prompt the original Claude faced.
// ---------------------------------------------------------------------------

const SCENARIOS = [
  {
    id: 'A',
    name: 'Tavern Entry — atmospheric scene-setting',
    description: 'Tests opening prose density: sensory layering, NPC introduction, ambient detail. The original gave a 3-paragraph tavern interior with named patrons, smell, sound, and a quest hook on a notice board.',
    history: [],
    playerInput: 'I push open the heavy wooden door of the village\'s only tavern and look around inside.'
  },
  {
    id: 'B',
    name: 'Elder Reveal — NPC voice under pressure',
    description: 'Tests dialogue density and character voice. The original had Elder Wren explain the lycanthrope situation in 200+ words across multiple beats — physical description, weighted dialogue, "I fear we\'re dealing with a werewolf, Riv."',
    history: [
      {
        role: 'user',
        content: 'I push open the heavy wooden door of the village\'s only tavern and look around inside.'
      },
      {
        role: 'assistant',
        content: 'The warmth hits you immediately — a crackling fireplace, the smell of roasted meat and ale, and the low murmur of conversation. A few locals sit at tables, speaking in hushed tones. Behind the bar stands a burly woman with her hair tied back, wiping down mugs.\n\nShe looks up as you enter. "Welcome, traveler. Name\'s Gerda. You look like you could use a meal and a bed."\n\nA weathered notice is pinned to a board near the bar — the reward posting about missing livestock and strange occurrences in Darkwood Forest. Fifty gold pieces for solving the problem.\n\nYou also spot a nervous-looking farmer alone with his ale, two hunters sharing a table, and an older man in the corner who looks like he might be the village elder.\n\nWhat do you do?'
      },
      {
        role: 'user',
        content: 'I greet Gerda warmly, take the room and a meal, and ask her what she knows about the trouble. Then I bring two mugs of mead over to the elder\'s table.'
      },
      {
        role: 'assistant',
        content: 'Gerda nods approvingly and tells you what she knows — the trouble started two weeks ago. First old Brennan\'s chickens vanished, then Tomás lost three sheep, and last night two more. The howling, she says, is wrong-pitched for wolves, and growing bolder. The elder, Wren, posted the reward; the hunters Dagmar and Finn tried tracking whatever it is and came back empty-handed and spooked.\n\nYou pick up your stew, your bread, and two mugs of spiced mead, and make your way across the common room to Elder Wren\'s table.\n\nAs you approach, the old man looks up. He\'s perhaps seventy, with a weathered face, sharp gray eyes, and hands gnarled from decades of work. He\'s dressed simply but with a silver chain of office around his neck marking his position.\n\nHe studies you for a moment, taking in your travel-worn clothes and the holy symbol of Lathander hanging at your chest.\n\n"A cleric, unless my eyes deceive me," he says, his voice gravelly but strong. "And bearing gifts, no less. Please, sit."'
      }
    ],
    playerInput: 'I sit, slide one mug across to him, and introduce myself. "Yes, Honored Elder, a cleric of Lathander. I understand your village is under siege. As I\'ve just arrived, I would like to know more — about your current troubles and about your village\'s history. Is this an isolated incident?"'
  },
  {
    id: 'C',
    name: 'Body Approach — cinematic build with stakes',
    description: 'Tests slow-build sensory horror. The original gave ~250 words layering 30→20→10 yard approach, smell of blood and fear-sweat, the carved horse in the dead man\'s hand, "He never had a chance." Exactly the kind of sustained moment the WAIT/SPOTLIGHT word caps would compress.',
    history: [
      {
        role: 'user',
        content: 'After speaking with the hunters and Elder Wren, I plan to perform a warding ritual at the village center tonight, then approach the lycanthrope tomorrow morning with Dagmar and Finn covering me.'
      },
      {
        role: 'assistant',
        content: 'The ritual works. Through the night the wards hold; the howling circles the village but never crosses your blessed perimeter. Mother Nelle prays at the center, you hold the line at the north point, and Dagmar\'s arrows stay nocked but never fly.\n\nDawn breaks pale and cold. As Lathander\'s light spills across Thornhaven\'s rooftops, a runner arrives from the Harrow farm — half a mile beyond the southernmost fields. He says the door is broken and no one answered his call.'
      },
      {
        role: 'user',
        content: 'I gather Dagmar, Finn, and a town guard named Voss who has come to help. We move out toward the Harrow farm.'
      },
      {
        role: 'assistant',
        content: 'The four of you set out in tactical formation — Voss taking the left flank, moving tree to tree with military precision; Dagmar on the right, her hunter\'s instincts guiding her through cover; Finn behind you with arrows nocked. You advance carefully between them, mace at your belt, holy symbol catching the morning light.\n\nThe forest thins as you approach Harrow land. Through the trees, you begin to see the farm — one modest farmhouse, a barn, a chicken coop, a goat pen. Simple, well-maintained.\n\nBut something is wrong. The goats are scattered and bleating nervously. The front door of the farmhouse is closed but you can see scratch marks on it. One of the barn doors hangs crooked, partially broken. No smoke from the chimney. No movement.\n\nMost concerning: you smell smoke, but not cooking smoke — burning wood, like something was set ablaze recently and has since burned out.\n\nVoss signals a halt about a hundred yards out. He\'s spotted something. "There. By the barn. See it?"\n\nYou follow his gaze and your blood runs cold. A body. Lying face-down in the dirt between the house and barn. Adult male, wearing farmer\'s clothes. Not moving.\n\nWhat do you do?'
      }
    ],
    playerInput: 'I\'m going to circle around and check the body. Doesn\'t look promising, but worth checking out. Dag, cover me. Voss, take a closer look at the barn if you can. If there\'s more to know, I want to know it as soon as possible.'
  }
];

// ---------------------------------------------------------------------------
// Variants — each takes the canonical full prompt and returns a mutated copy.
// V1 is the baseline (no mutation). V5 throws out the structured prompt
// entirely in favor of a one-sentence brief, mirroring the original's bare
// "can you be a DM" prompt.
// ---------------------------------------------------------------------------

const VARIANTS = [
  {
    id: 'V1',
    name: 'Baseline (current production prompt)',
    description: 'Full canonical prompt as it ships today. Sets the floor.',
    transform: (prompt) => prompt
  },
  {
    id: 'V2',
    name: 'No word-count caps in CONVERSATION HANDLING',
    description: 'Strips the SPOTLIGHT 30-120 / COUNCIL 120-250 / CROSSTALK 60-150 / WAIT 1-30 word ranges. Tests whether removing the length tax lets prose breathe.',
    transform: (prompt) => {
      // Remove the four "Length: N-M words" lines and any "Length: ..." inside MODE blocks.
      return prompt
        .replace(/  Length: \d+-\d+ words.*\n/g, '')
        .replace(/  Length: \d+-\d+ words total.*\n/g, '');
    }
  },
  {
    id: 'V3',
    name: 'No SELF-CHECK at prompt tail',
    description: 'Strips "BEFORE YOU SEND — SELF-CHECK" and its 5 revision questions. Tests whether the revise-pressure produces defensive prose.',
    transform: (prompt) => {
      // The self-check is a fenced section starting with the heading line.
      // Cut from the leading divider to the closing "If all five clean, send."
      return prompt.replace(
        /═══+\s*\nBEFORE YOU SEND — SELF-CHECK[\s\S]*?If all five clean, send\.\s*$/m,
        ''
      ).trimEnd();
    }
  },
  {
    id: 'V4',
    name: 'No MECHANICAL MARKERS section',
    description: 'Strips the entire mechanical-markers spec (merchant/combat/loot/promise/conditions/etc) and the "every response carries marker overhead" tax. Cardinal Rule 5 still mentions markers exist.',
    transform: (prompt) => {
      // The mechanical markers block sits between two of the divider banners.
      // Cut from "MECHANICAL MARKERS" heading to just before the next === heading.
      return prompt.replace(
        /═══+\s*\nMECHANICAL MARKERS\s*\n═══+[\s\S]*?(?=\n═══+\s*\nEND OF CORE RULES|\n──────────── STORY MEMORY)/,
        ''
      );
    }
  },
  {
    id: 'V5',
    name: 'Bare prompt — original-style one-sentence brief',
    description: 'Replaces the entire ~10K-token system prompt with: "You are an expert Dungeon Master running a D&D 5e text adventure. The player is Riv Freeborn, male human cleric of Lathander, level 1." This mirrors the original PDF\'s opening — Claude with no structure. Diagnostic: how much of the prompt is helping vs hurting?',
    transform: (_prompt) => {
      return `You are an expert Dungeon Master running a D&D 5th Edition text adventure. The player is Riv Freeborn — male human cleric of Lathander, level 1, neutral good, 90 gp, mace + shield + chain mail. The setting is the Forgotten Realms (1370 DR), Sword Coast wilderness. The player has just arrived in Thornhaven, a small village beset by strange howls and missing livestock from the nearby Darkwood Forest. Voice the world. Never speak, think, or roll dice for the player.`;
    }
  }
];

// ---------------------------------------------------------------------------
// Metric helpers — fast surface-level signals so we can sort outputs at a
// glance. These do NOT rank quality (that's a human read), they just give
// quick feel for length/density/dialogue ratio.
// ---------------------------------------------------------------------------

function wordCount(s) {
  return (s.trim().match(/\S+/g) || []).length;
}
function sentenceCount(s) {
  return (s.match(/[.!?]+(?=\s|$)/g) || []).length;
}
function dialoguePercent(s) {
  const total = s.length || 1;
  const inQuotes = (s.match(/"[^"]*"/g) || []).join('').length;
  return Math.round((inQuotes / total) * 100);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runOne(scenario, variant, baselinePrompt) {
  const systemPrompt = variant.transform(baselinePrompt);
  // Build the chat history. createDMSystemPrompt returns the system prompt
  // string; claude.chat takes (system, messages, retries, modelChoice, maxTokens).
  // We always run against Sonnet — the model that ships in production —
  // because the question is "does Sonnet improve under each mutation?"
  const messages = [
    ...scenario.history,
    { role: 'user', content: scenario.playerInput }
  ];
  const t0 = Date.now();
  let response;
  let error = null;
  try {
    response = await claude.chat(systemPrompt, messages, 2, 'sonnet', 2500);
  } catch (e) {
    error = e.message || String(e);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  return {
    scenario,
    variant,
    systemPromptChars: systemPrompt.length,
    response: response || '',
    error,
    elapsed,
    metrics: response ? {
      words: wordCount(response),
      sentences: sentenceCount(response),
      dialoguePct: dialoguePercent(response),
      avgSentenceLen: Math.round(wordCount(response) / Math.max(1, sentenceCount(response)))
    } : null
  };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set. Aborting.');
    process.exit(1);
  }

  console.log('Building canonical system prompt...');
  const baselinePrompt = createDMSystemPrompt(RIV, SESSION_CTX);
  console.log(`Baseline prompt: ${baselinePrompt.length} chars (~${Math.round(baselinePrompt.length / 4)} tokens)\n`);

  const results = [];
  let runIndex = 0;
  const total = SCENARIOS.length * VARIANTS.length;

  for (const scenario of SCENARIOS) {
    for (const variant of VARIANTS) {
      runIndex++;
      const tag = `[${runIndex}/${total}] ${scenario.id}/${variant.id}`;
      console.log(`${tag} ${scenario.name} × ${variant.name}`);
      const r = await runOne(scenario, variant, baselinePrompt);
      results.push(r);
      if (r.error) {
        console.log(`  ✗ ${r.error}`);
      } else {
        console.log(`  ✓ ${r.metrics.words}w  ${r.metrics.sentences}s  ${r.metrics.avgSentenceLen}w/s  ${r.metrics.dialoguePct}% dialogue  (${r.elapsed}s, ${r.systemPromptChars} prompt chars)`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Write report
  // ---------------------------------------------------------------------------

  const lines = [];
  lines.push('# Prose Quality A/B Results');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Model under test: **Sonnet 4.6** (the model that runs continuations in production).`);
  lines.push(`Baseline prompt size: **${baselinePrompt.length} chars** (~${Math.round(baselinePrompt.length / 4)} tokens).`);
  lines.push('');
  lines.push('## How to read this');
  lines.push('');
  lines.push('Each scenario was run against five prompt variants. Word count and dialogue % are surface signals only — the real test is reading the prose.');
  lines.push('Compare V1 (baseline) to each Vn to isolate the contribution of that constraint.');
  lines.push('Scenario A is the original test the original Claude crushed (rich tavern intro with named NPCs and quest hook). Scenario B tests dialogue density. Scenario C tests sustained cinematic build — the moment the original gave 250+ words of layered horror.');
  lines.push('');

  // Summary table
  lines.push('## Summary metrics');
  lines.push('');
  lines.push('| Scenario | Variant | Words | Sentences | Avg w/s | Dialogue % | Prompt chars | Time |');
  lines.push('|----------|---------|-------|-----------|---------|------------|--------------|------|');
  for (const r of results) {
    if (r.error) {
      lines.push(`| ${r.scenario.id} | ${r.variant.id} | ERROR | — | — | — | ${r.systemPromptChars} | ${r.elapsed}s |`);
    } else {
      lines.push(`| ${r.scenario.id} | ${r.variant.id} | ${r.metrics.words} | ${r.metrics.sentences} | ${r.metrics.avgSentenceLen} | ${r.metrics.dialoguePct}% | ${r.systemPromptChars} | ${r.elapsed}s |`);
    }
  }
  lines.push('');

  // Variant legend
  lines.push('## Variants');
  lines.push('');
  for (const v of VARIANTS) {
    lines.push(`- **${v.id} — ${v.name}**: ${v.description}`);
  }
  lines.push('');

  // Detailed outputs per scenario
  for (const scenario of SCENARIOS) {
    lines.push(`---`);
    lines.push('');
    lines.push(`## Scenario ${scenario.id} — ${scenario.name}`);
    lines.push('');
    lines.push(`**What it tests:** ${scenario.description}`);
    lines.push('');
    lines.push(`**Player input:**`);
    lines.push('');
    lines.push('> ' + scenario.playerInput.split('\n').join('\n> '));
    lines.push('');
    if (scenario.history.length > 0) {
      lines.push(`<details><summary>Conversation history (${scenario.history.length} turns)</summary>`);
      lines.push('');
      for (const m of scenario.history) {
        lines.push(`**${m.role.toUpperCase()}:**`);
        lines.push('');
        lines.push(m.content);
        lines.push('');
      }
      lines.push('</details>');
      lines.push('');
    }

    for (const variant of VARIANTS) {
      const r = results.find(r => r.scenario.id === scenario.id && r.variant.id === variant.id);
      lines.push(`### ${variant.id} — ${variant.name}`);
      lines.push('');
      if (r.error) {
        lines.push(`*ERROR: ${r.error}*`);
      } else {
        lines.push(`*${r.metrics.words} words, ${r.metrics.sentences} sentences, ${r.metrics.avgSentenceLen} avg w/s, ${r.metrics.dialoguePct}% dialogue, ${r.elapsed}s, ${r.systemPromptChars} prompt chars*`);
        lines.push('');
        lines.push(r.response);
      }
      lines.push('');
    }
  }

  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'));
  console.log(`\nResults written to ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
