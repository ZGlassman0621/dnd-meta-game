/**
 * Prelude arc plan service.
 *
 * Phase 2a of the Prelude-Forward Character Creator. Generates the Opus-
 * produced structured arc plan that Sonnet will play within during the
 * prelude sessions (Phase 2b+).
 *
 * What the arc plan is:
 *   A ~1-2k token structured JSON blob covering
 *     - home_world         brief description of the home + 5-10 named locals
 *                          beyond family + 2-3 local tensions + 1-2 threats +
 *                          a mentor possibility
 *     - chapter_1_arc      Early Childhood (ages 5-8) — theme, 2-3 beats,
 *                          chapter-end moment, seeded emergences
 *     - chapter_2_arc      Middle Childhood (9-12)    — same shape
 *     - chapter_3_arc      Adolescence (13-16)        — same shape +
 *                          chapter_promise_prompt for the opening beat
 *     - chapter_4_arc      Threshold (17-21)          — same shape +
 *                          departure_seed {reason, tone, non_tragic_alternatives}
 *     - recurring_threads  2-4 threads that weave across chapters
 *     - character_trajectory { suggested_class, suggested_theme,
 *                              suggested_ancestry_feat, notes }
 *     - seed_emergences    candidate [STAT_HINT] / [SKILL_HINT] / etc. the arc
 *                          is nudging toward — Sonnet uses these as seed
 *                          signals; actual emergences still fire from played
 *                          behavior in Phase 3.
 *
 * The arc plan is REFERENCE, not a rail. Sonnet plays within it and player
 * choices flex the beats.
 *
 * One re-roll allowed per character (hard cap), so the player can nudge Opus
 * if the plan doesn't land on the first try without shopping indefinitely.
 */

import { dbGet, dbRun } from '../database.js';
import { chat } from './claude.js';
import { getPreludeCharacter } from './preludeService.js';
import {
  BIRTH_CIRCUMSTANCES,
  HOME_SETTINGS,
  REGIONS,
  TONE_TAGS
} from './preludeSetupLabels.js';

// Re-roll cap. Keep this low to avoid "shopping" behaviour where the player
// regenerates endlessly until they get a plan they like — the randomness is
// the point.
const MAX_REGENERATIONS = 1;

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

/**
 * Race-aware chapter age ranges. Each chapter represents a life stage, not a
 * fixed Earth-year range — an elf in Chapter 1 is biologically 25, not 5.
 *
 * Opus already knows these lifespans; we surface the ranges explicitly so the
 * prompt never drifts toward "5-year-old assassination-attempt" scenarios
 * when the character is a dwarf.
 */
const RACE_CHAPTER_AGES = {
  // Human-lifespan races
  human:      { ch1: '5-8',     ch2: '9-12',    ch3: '13-16',   ch4: '17-21',   adulthood: 18 },
  halfling:   { ch1: '5-8',     ch2: '9-14',    ch3: '15-18',   ch4: '19-22',   adulthood: 20 },
  'half-elf': { ch1: '5-10',    ch2: '11-16',   ch3: '17-22',   ch4: '23-30',   adulthood: 20 },
  'half-orc': { ch1: '3-6',     ch2: '7-10',    ch3: '11-13',   ch4: '14-18',   adulthood: 14 },
  tiefling:   { ch1: '5-8',     ch2: '9-12',    ch3: '13-16',   ch4: '17-21',   adulthood: 18 },
  aasimar:    { ch1: '5-8',     ch2: '9-12',    ch3: '13-16',   ch4: '17-21',   adulthood: 18 },
  dragonborn: { ch1: '1-3',     ch2: '4-7',     ch3: '8-11',    ch4: '12-15',   adulthood: 15 },
  // Long-lived races — childhood is genuinely longer
  dwarf:      { ch1: '15-25',   ch2: '25-40',   ch3: '40-50',   ch4: '50-75',   adulthood: 50 },
  elf:        { ch1: '25-50',   ch2: '50-80',   ch3: '80-100',  ch4: '100-120', adulthood: 100 },
  gnome:      { ch1: '10-20',   ch2: '20-35',   ch3: '35-50',   ch4: '50-75',   adulthood: 40 },
  // Constructs
  warforged:  { ch1: '1-2 years post-activation', ch2: '2-4 years', ch3: '4-6 years', ch4: '6-10+ years', adulthood: 'fully self-determined' }
};

/**
 * Get chapter age ranges for a race, with a human fallback for unknown races.
 */
function getChapterAges(race) {
  const key = String(race || '').toLowerCase();
  return RACE_CHAPTER_AGES[key] || RACE_CHAPTER_AGES.human;
}

/**
 * Build the Opus system prompt for arc-plan generation. Primacy block lays
 * out the rules Opus must honour; recency block at the end reinforces them.
 */
function buildArcSystemPrompt(setup, race) {
  const toneLabels = (setup.tone_tags || [])
    .map(t => TONE_TAGS.find(x => x.value === t))
    .filter(Boolean)
    .map(t => `${t.label} (${t.description})`)
    .join('\n  - ');

  const ages = getChapterAges(race);

  return `You are a master D&D storyteller designing the structured arc for one character's childhood-to-young-adulthood. The arc will span 7-10 play sessions across four age brackets (life stages, not fixed Earth-year ranges — interpret per the character's race). Another AI (Sonnet) plays within your arc, so give them a cohesive spine with beginning, middle, and end that honours the player's setup and chosen tone.

ABSOLUTE RULES:
1. NON-BINARY CHOICES. Every significant decision seeded must have real cost AND real benefit on every side. Never design "the right thing to do" vs "the wrong thing." Criminals may be surviving. Guards may abuse power. Family may disappoint. Strangers may save.
2. TONE FIDELITY. Honor the player's tone tags, combined: ${toneLabels ? '\n  - ' + toneLabels : '(none provided)'}. A "gritty + dark humor" plan should not read "epic + mystical."
3. NON-TRAGIC DEPARTURES. Chapter 4 must end with a departure, but tragedy is one option among many: pilgrimage, test, conscription, exile, political match, apprenticeship posting, call to adventure, flight, tragedy. Match the tone.
4. ANCHORED TO SETUP. Home, region, parents (by name + role), siblings, talents, values, and tone the player chose are CANON. Build on them. Use names where given — don't substitute generic placeholders.
5. AGE-APPROPRIATE PER RACE. This character is a ${race}. Chapter 1 = "early childhood for a ${race}" (${ages.ch1}). Chapter 4 = "threshold of adulthood for a ${race}" (${ages.ch4}). ${race === 'elf' ? 'An elf of 35 is still a small child by elven standards — treat them accordingly.' : race === 'dwarf' ? 'A dwarf of 20 is still pre-adolescent by dwarven standards.' : ''} Early-chapter beats scale to the character's developmental stage, not Earth-child tropes.
6. SEED BUT DON'T DECIDE. You suggest class/theme/ancestry affinities; actual stats emerge from played behaviour later. Your suggestions are signals, not verdicts.
7. WORLD RULES. This is Faerûn. Animals do not speak (unless magically enabled per 5e rules). Magic follows 5e spell logic. Gods, planes, races, and cosmology are canonical. Whimsy lives in perception and atmosphere, not in rule-breaking.
8. **BEATS ARE SITUATIONS, NOT SCRIPTED OUTCOMES.** This is the single most important rule. A beat describes a SITUATION the player will walk into — the setting, the other people, the stakes, the question. It does NOT describe what the character does, says, feels, or decides. The player decides that in play.
   - WRONG: "Cornered by toughs in an alley, Zalyere spins a lie so vivid about a watchman coming that the men flinch and leave."
   - RIGHT: "Cornered by toughs in an alley, close enough to smell the indigo on their hands. The way you get out of this — fists, lies, running, surrender, something else — will mark how Rook sees you for years."
   - WRONG: "When the Salfires fall behind, Coin-Master Veyl offers Zalyere errand work and Zalyere takes it."
   - RIGHT: "When rent comes up short, Coin-Master Veyl appears at the door with 'errands' for hands your size. Davyr forbids it; Moira won't look at you when the subject comes up."
   Describe the pressure. Leave the answer.
9. **DON'T INVENT CHARACTER TRAITS NOT IN THE SETUP.** The player's race, gender, parents, siblings, setting, talents, cares, and tone are canon. Canonical 5e race features (darkvision, breath weapons, etc.) are fair game. But do NOT invent specific physical markers (veins, birthmarks, glowing eyes, fevers, scars) or family secrets (hidden bloodlines, prophecies, royal parentage) that the player didn't establish. If the player wanted a scourge aasimar with burning veins, they'd have said so. Stay inside the lines they drew.
10. **TRAJECTORY NUDGES MUST CITE PLAYER SETUP EXPLICITLY.** Do not suggest "paladin because the character is a scourge aasimar." Suggest "paladin because you said you care about Justice and Protecting the Weak, and Chapter 3 puts Zalyere between a fallen institution (the dye-works crew) and a quiet faith (Sister Halene) — that tension pays out as paladin." Cite talents, cares, or tone tags by name.

BE CONCISE. Keep prose TIGHT. This is scaffolding, not the final story. Stay within the word/sentence limits below — long beats cause JSON truncation.

OUTPUT FORMAT. Return a SINGLE JSON object. No prose before or after. No markdown fences.

{
  "home_world": {
    "description": "2-3 sentences, physical + social",
    "locals": [ { "name": "...", "role": "...", "description": "1 short sentence" } ],
    "tensions": [ "1 short sentence" ],
    "threats": [ "1 short sentence" ],
    "mentor_possibility": { "name": "...", "role": "...", "why_they_matter": "1 sentence" }
  },
  "chapter_1_arc": {
    "theme": "1 sentence (life stage: ${ages.ch1})",
    "beats": [ { "title": "short", "description": "1-2 sentences, not 3" } ],
    "chapter_end_moment": "1 sentence",
    "seeded_emergences": [ { "kind": "stat|skill|class|theme|ancestry|value", "target": "specific", "narrative_anchor": "which beat" } ]
  },
  "chapter_2_arc": { /* same shape (life stage: ${ages.ch2}) */ },
  "chapter_3_arc": {
    /* same shape (life stage: ${ages.ch3}) */,
    "chapter_promise_prompt": "1-2 sentences Sonnet will use to open the chapter by asking the player what it's about — e.g. 'This feels like it's about deciding who you'll become, not who they raised you to be. Right?'"
  },
  "chapter_4_arc": {
    /* same shape (life stage: ${ages.ch4}) */,
    "chapter_promise_prompt": "...",
    "departure_seed": {
      "reason": "pilgrimage | test | conscription | exile | apprenticeship_posting | political_match | call_to_adventure | flight | tragedy | other",
      "tone": "1-3 words — hopeful / bitter / determined / numb / wistful / etc.",
      "non_tragic_alternatives": [ "1 short sentence" ]
    }
  },
  "recurring_threads": [
    { "name": "short", "description": "1 sentence", "spans_chapters": [1,2,3,4], "payoff_chapter": 3 }
  ],
  "character_trajectory": {
    "suggested_class": "class id (e.g. 'rogue')",
    "suggested_theme": "theme id (e.g. 'outlander')",
    "suggested_ancestry_feat": "ancestry feat list id",
    "why_class": "1 sentence — must cite at least one talent, care, or tone tag the PLAYER chose, by name",
    "why_theme": "1 sentence — same rule",
    "notes": "optional 1 sentence extra"
  }
}

QUANTITY LIMITS:
- locals: 4-6 entries
- tensions: 2 entries
- threats: 1-2 entries
- beats per chapter: exactly 2
- recurring_threads: 2-3 entries
- non_tragic_alternatives: 2 entries
- seeded_emergences per chapter: 1-2 entries

FINAL REMINDER:
- **Beats are SITUATIONS the player walks into, not scripted outcomes.** If a beat says what the character does, says, feels, or decides — rewrite it. Describe the pressure. Leave the answer.
- **No invented character traits.** Physical markers, family secrets, hidden bloodlines, prophecies — none of these unless the player put them in setup. Respect their authorship.
- **Trajectory nudges cite player setup by name.** Say "because you said you care about X" — not "because the character is aasimar."
- Tight prose. Short sentences. No flourish beyond the tone tags require.
- Every entity named in the setup (parents, siblings) appears by name in at least one beat.
- Departures are not default tragic.
- Output JSON only. No markdown. No preamble. No epilogue.`;
}

/**
 * Build the user-role prompt describing THIS character's setup.
 */
function buildArcUserPrompt(character, setup) {
  const playerRace = character.race;
  const parentsDesc = (setup.parents || []).map(p => {
    const role = p.role || 'parent';
    const nm = p.name || '(unnamed)';
    const race = p.race || playerRace;
    return `${role}: ${nm} (${race}) — ${p.status}`;
  }).join('; ');

  const siblingsDesc = (setup.siblings || []).length > 0
    ? setup.siblings.map(s => {
        const rel = s.relative_age || 'unspecified age';
        const gender = s.gender || 'sibling';
        const race = s.race || playerRace;
        return `${s.name} (${race} ${gender}, ${rel})`;
      }).join('; ')
    : 'only child';

  const birth = BIRTH_CIRCUMSTANCES.find(c => c.value === setup.birth_circumstance);
  const home = HOME_SETTINGS.find(c => c.value === setup.home_setting);
  const region = REGIONS.find(c => c.value === setup.region);

  const ages = getChapterAges(character.race);

  return `Generate the arc plan for this character. Respect every field as canonical.

NAME: ${character.name}${character.nickname ? ` ("${character.nickname}")` : ''}
RACE: ${character.race}${character.subrace ? ` (${character.subrace})` : ''}
GENDER: ${setup.gender}

CHAPTER AGES (this race's life stages):
  Ch1 (Early Childhood): ${ages.ch1}
  Ch2 (Middle Childhood): ${ages.ch2}
  Ch3 (Adolescence): ${ages.ch3}
  Ch4 (Threshold): ${ages.ch4}

BIRTH CIRCUMSTANCE: ${birth ? birth.label : setup.birth_circumstance}
  ${birth ? birth.description : '(free-text — interpret literally)'}

HOME SETTING: ${home ? home.label : setup.home_setting}
  ${home ? home.description : '(free-text — interpret literally)'}

REGION: ${region ? region.label : setup.region}
  ${region ? region.description : '(free-text — interpret literally)'}

PARENTS: ${parentsDesc || 'unknown'}
SIBLINGS: ${siblingsDesc}

THREE THINGS YOU'RE GOOD AT: ${(setup.talents || []).join(', ')}
THREE THINGS YOU CARE ABOUT: ${(setup.cares || []).join(', ')}

TONE TAGS (combined): ${(setup.tone_tags || []).join(', ')}

Output the JSON arc plan now. No preamble, no epilogue — just the JSON object.`;
}

// ---------------------------------------------------------------------------
// JSON extraction
// ---------------------------------------------------------------------------

/**
 * Strip common wrappers (```json fences, trailing prose) and parse.
 * Returns parsed object or throws with a descriptive error.
 */
function extractJson(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('Empty model response');
  let text = raw.trim();

  // Remove common fence wrappers
  if (text.startsWith('```')) {
    const firstNl = text.indexOf('\n');
    if (firstNl > 0) text = text.slice(firstNl + 1);
    if (text.endsWith('```')) text = text.slice(0, -3);
    text = text.trim();
  }

  // Find the outermost JSON object — first `{` to matching `}`
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in response');
  }
  text = text.slice(start, end + 1);

  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Read the stored arc plan for a character, or null if not yet generated.
 * JSON fields are parsed for convenience; raw serialized form stays on the row.
 */
export async function getArcPlan(characterId) {
  const row = await dbGet(
    `SELECT * FROM prelude_arc_plans WHERE character_id = ?`,
    [characterId]
  );
  if (!row) return null;

  const parse = (field) => {
    if (!field) return null;
    try { return JSON.parse(field); } catch { return null; }
  };

  return {
    ...row,
    tone_tags: (row.tone_tags || '').split(',').filter(Boolean),
    home_world: parse(row.home_world),
    chapter_1_arc: parse(row.chapter_1_arc),
    chapter_2_arc: parse(row.chapter_2_arc),
    chapter_3_arc: parse(row.chapter_3_arc),
    chapter_4_arc: parse(row.chapter_4_arc),
    recurring_threads: parse(row.recurring_threads),
    character_trajectory: parse(row.character_trajectory),
    seed_emergences: parse(row.seed_emergences),
    departure_seed: parse(row.departure_seed)
  };
}

/**
 * Validate that a parsed plan has the shape we need. Opus usually complies
 * with the format prompt but we defend against shape drift.
 */
function validateParsedPlan(plan) {
  if (!plan || typeof plan !== 'object') throw new Error('Arc plan is not an object');
  const required = ['home_world', 'chapter_1_arc', 'chapter_2_arc', 'chapter_3_arc', 'chapter_4_arc'];
  for (const f of required) {
    if (!plan[f] || typeof plan[f] !== 'object') {
      throw new Error(`Arc plan missing required field: ${f}`);
    }
  }
  if (!plan.chapter_4_arc.departure_seed || typeof plan.chapter_4_arc.departure_seed !== 'object') {
    throw new Error('Chapter 4 arc is missing departure_seed');
  }
}

/**
 * Generate and persist an arc plan for a prelude character. Enforces the
 * `MAX_REGENERATIONS` re-roll cap when `isRegeneration=true`.
 *
 * Returns the parsed arc plan row.
 */
export async function generateArcPlan(characterId, { isRegeneration = false } = {}) {
  const character = await getPreludeCharacter(characterId);
  if (!character) throw new Error('Prelude character not found');
  const setup = character.prelude_setup_data;
  if (!setup || typeof setup !== 'object') {
    throw new Error('Prelude character has no setup data');
  }

  // Check regeneration cap
  const existing = await dbGet(
    `SELECT regenerate_count FROM prelude_arc_plans WHERE character_id = ?`,
    [characterId]
  );
  if (existing && isRegeneration) {
    const count = existing.regenerate_count || 0;
    if (count >= MAX_REGENERATIONS) {
      throw new Error(`Arc plan re-roll limit reached (${MAX_REGENERATIONS})`);
    }
  }

  // Build prompts + call Opus
  const systemPrompt = buildArcSystemPrompt(setup, character.race);
  const userPrompt = buildArcUserPrompt(character, setup);
  const messages = [{ role: 'user', content: userPrompt }];

  // 8192 tokens ≈ ~30KB of JSON — comfortable headroom for the structured
  // arc plan. Previous 4096 cap was truncating mid-array on wordier tones
  // like "political + mystical + tragic".
  const raw = await chat(systemPrompt, messages, 3, 'opus', 8192, true);
  let parsed;
  try {
    parsed = extractJson(raw);
    validateParsedPlan(parsed);
  } catch (err) {
    throw new Error(`Arc plan parse failed: ${err.message}. First 300 chars of response: ${(raw || '').slice(0, 300)}`);
  }

  const toneCsv = Array.isArray(setup.tone_tags) ? setup.tone_tags.join(',') : '';
  const serializeField = (v) => v == null ? null : JSON.stringify(v);

  // INSERT OR REPLACE (UNIQUE on character_id). Increment regenerate_count
  // only when this is explicitly a re-roll; initial generation leaves it at 0.
  const nextRegenCount = isRegeneration ? ((existing?.regenerate_count || 0) + 1) : 0;

  await dbRun(
    `INSERT INTO prelude_arc_plans (
      character_id, generated_at, model, tone_tags,
      home_world, chapter_1_arc, chapter_2_arc, chapter_3_arc, chapter_4_arc,
      recurring_threads, character_trajectory, seed_emergences, departure_seed,
      regenerate_count
    ) VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(character_id) DO UPDATE SET
      generated_at = CURRENT_TIMESTAMP,
      model = excluded.model,
      tone_tags = excluded.tone_tags,
      home_world = excluded.home_world,
      chapter_1_arc = excluded.chapter_1_arc,
      chapter_2_arc = excluded.chapter_2_arc,
      chapter_3_arc = excluded.chapter_3_arc,
      chapter_4_arc = excluded.chapter_4_arc,
      recurring_threads = excluded.recurring_threads,
      character_trajectory = excluded.character_trajectory,
      seed_emergences = excluded.seed_emergences,
      departure_seed = excluded.departure_seed,
      regenerate_count = ?`,
    [
      characterId,
      'claude-opus-4-7',
      toneCsv,
      serializeField(parsed.home_world),
      serializeField(parsed.chapter_1_arc),
      serializeField(parsed.chapter_2_arc),
      serializeField(parsed.chapter_3_arc),
      serializeField(parsed.chapter_4_arc),
      serializeField(parsed.recurring_threads),
      serializeField(parsed.character_trajectory),
      serializeField(parsed.seed_emergences),
      serializeField(parsed.chapter_4_arc.departure_seed),
      nextRegenCount,
      nextRegenCount
    ]
  );

  return getArcPlan(characterId);
}

/**
 * Check whether a character is eligible to request a re-roll.
 * Exposed so the UI can show/hide the re-roll button accurately.
 */
export async function canRegenerate(characterId) {
  const row = await dbGet(
    `SELECT regenerate_count FROM prelude_arc_plans WHERE character_id = ?`,
    [characterId]
  );
  if (!row) return true; // no plan yet → regen means "generate first time"
  return (row.regenerate_count || 0) < MAX_REGENERATIONS;
}
