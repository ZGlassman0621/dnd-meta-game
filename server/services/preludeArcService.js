/**
 * Prelude arc plan service.
 *
 * Generates the Opus-produced structured arc plan that Sonnet will play
 * within during the prelude sessions. Phase 2 chunk 3 reframe: 3-chapter
 * structure (Phase 1 Decision 2), locked tone description (Decision 3
 * sub-deliverable), authority_figure + origin_freeform setup fields
 * (Decision A), Ch3 carries the departure_seed (Decision 4).
 *
 * Arc plan shape (post-Phase-2):
 *   - home_world         brief home description + 4-6 named locals + 2-3
 *                        tensions + 1-2 threats. Mentor possibility is
 *                        emitted only when authority_figure='mentor';
 *                        for other authority_figure values, the
 *                        corresponding NPC kind is seeded.
 *   - chapter_1_arc      Childhood (OBSERVE) — theme, 2 beats, chapter-end
 *                        moment, seeded emergences. No combat.
 *   - chapter_2_arc      Adolescence (LEARN) — same shape +
 *                        chapter_promise_prompt + intra-Ch2 age-jump
 *                        seed (per Phase 1 Decision 5).
 *   - chapter_3_arc      Threshold (DECIDE/COMMIT) — same shape +
 *                        chapter_promise_prompt + irreversible_act_shape
 *                        (described WITHOUT naming a theme; the act
 *                        lands before the theme commitment ceremony) +
 *                        theme_commitment_handoff +
 *                        departure_seed { primary_thread, plausible_shapes,
 *                        tone }.
 *   - recurring_threads  2-3 threads that weave across chapters
 *   - character_trajectory { suggested_class, suggested_theme,
 *                            suggested_ancestry_feat, notes }
 *   - seed_emergences    candidate hints the arc is nudging toward
 *
 * The chapter_4_arc column on prelude_arc_plans stays in schema but is
 * no longer populated for new preludes (additive-only schema; harmless
 * to leave). Same for tone_tags / tone_reflection columns.
 *
 * The arc plan is REFERENCE, not a rail. Sonnet plays within it and
 * player choices flex the beats.
 *
 * One re-roll allowed per character (hard cap).
 */

import { dbGet, dbRun } from '../database.js';
import { chat } from './claude.js';
import { extractLLMJson } from '../utils/llmJson.js';
import { getPreludeCharacter } from './preludeService.js';
import {
  BIRTH_CIRCUMSTANCES,
  HOME_SETTINGS,
  REGIONS
} from './preludeSetupLabels.js';
import { buildLockedToneBlock } from '../data/preludeToneDescription.js';
import { findSiblingOption, findAuthorityFigure } from '../data/preludeWizardEnums.js';

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
 *
 * Phase 2 chunk 3: 3-chapter shape, locked tone description, authority_figure
 * shapes the home world, origin_freeform overrides curated answers when present.
 */
function buildArcSystemPrompt(setup, race) {
  const ages = getChapterAges(race);
  const authority = findAuthorityFigure(setup.authority_figure);
  const authorityLabel = authority ? authority.label : '(unspecified)';
  const isMentor = setup.authority_figure === 'mentor';
  const isCaptor = setup.authority_figure === 'captor';

  return `You are a master D&D storyteller designing the structured arc for one character's childhood through young-adulthood. The arc spans 4 play sessions across THREE age brackets — Ch1: 1 session, Ch2: 1 session (with one intra-session age jump), Ch3: 2 sessions (DECIDE + COMMIT in one chapter). Life stages, not fixed Earth-year ranges — interpret per the character's race. Another AI (Sonnet) plays within your arc, so give them a cohesive spine with beginning, middle, and end that honours the player's setup.

${buildLockedToneBlock()}

ABSOLUTE RULES:
1. NON-BINARY CHOICES. Every significant decision seeded must have real cost AND real benefit on every side. Never design "the right thing to do" vs "the wrong thing." Criminals may be surviving. Guards may abuse power. Family may disappoint. Strangers may save.

2. TONE FIDELITY. The TONE block above is authoritative. Shape the arc plan in that register — epic fantasy in a lived-in world, the grand and the granular sharing every scene. Don't drift toward generic literary fantasy. Don't soften consequences because the protagonist is young.

3. NON-TRAGIC DEPARTURES. The Ch3 chapter ends with a departure (driven by theme commitment in play). Tragedy is one option among many: pilgrimage, test, conscription, exile, political match, apprenticeship posting, call to adventure, flight, tragedy. Match the tone, NOT a default to dark.

4. ANCHORED TO SETUP. Home, region, parents (by name + role), siblings (the chosen configuration), authority figure, and the player's free-text origin (Q10) when present are CANON. Build on them. Use names where given — don't substitute generic placeholders.

   AUTHORITY FIGURE — this character's "looms largest in early life" is: **${authorityLabel}**. Shape Ch1 / Ch2 home-world and beat selection accordingly. ${isMentor ? '⚠ For mentor: emit a mentor figure in home_world.locals with role naming the teaching, and seed at least one Ch1 or Ch2 beat that establishes the mentor relationship. The mentor will become the seeded mentor_imprint at handoff.' : ''} ${isCaptor ? '⚠ For captor: Ch1 and Ch2 unfold under captivity. The captor is canonical home_world content (not a mentor). The PC has limited freedom; "home" is the captor\'s domain. Departure in Ch3 likely flows from the captivity ending — escape, ransom, captor\'s death, freed by another, or chosen choice to remain.' : ''} ${authority?.value === 'sibling' ? '⚠ For older sibling-as-authority: the sibling raised the PC in everything but name. Make the sibling load-bearing in Ch1, with their own pressures (working young, taking on adult roles).' : ''} ${authority?.value === 'rival' ? '⚠ For rival: another child or adolescent\'s presence defined the PC\'s. Seed the rival prominently in Ch1-2; their actions are formative.' : ''} ${authority?.value === 'employer' ? '⚠ For employer: the PC worked young, and the work shaped them. Home is partly the workplace; the employer\'s judgments matter.' : ''} ${authority?.value === 'none' ? '⚠ For "no one": the PC raised themselves. Home is more chaos than structure; no single adult shapes the PC consistently.' : ''}

${(setup.origin_freeform || '').trim() ? `   ⚠ Q10 ORIGIN FREE-TEXT — HONOR THIS OVER CONFLICTING CURATED ANSWERS:
   "${setup.origin_freeform.trim()}"
   The player wrote this to capture an origin specific the curated answers couldn't. When this conflicts with a curated answer (different family configuration, different home, different formative event), the FREE TEXT WINS. Build the arc around it. Do not generic-ify it; do not paraphrase it away.` : ''}

5. AGE-APPROPRIATE PER RACE. This character is a ${race}. Chapter 1 = "childhood for a ${race}" (${ages.ch1}). Chapter 3 = "threshold for a ${race}" (${ages.ch3}). ${race === 'elf' ? 'An elf of 35 is still a small child by elven standards — treat them accordingly.' : race === 'dwarf' ? 'A dwarf of 20 is still pre-adolescent by dwarven standards.' : ''} Early-chapter beats scale to the character's developmental stage, not Earth-child tropes.

6. SEED BUT DON'T DECIDE. You suggest class/theme/ancestry affinities; actual stats emerge from played behaviour later. Your suggestions are signals, not verdicts.

7. WORLD RULES. This is Faerûn. Animals do not speak (unless magically enabled per 5e rules). Magic follows 5e spell logic. Gods, planes, races, and cosmology are canonical. Whimsy lives in perception and atmosphere, not in rule-breaking.

8. **BEATS ARE SITUATIONS, NOT SCRIPTED OUTCOMES.** This is the single most important rule. A beat describes a SITUATION the player will walk into — the setting, the other people, the stakes, the question. It does NOT describe what the character does, says, feels, or decides. The player decides that in play.
   - WRONG: "Cornered by toughs in an alley, Zalyere spins a lie so vivid about a watchman coming that the men flinch and leave."
   - RIGHT: "Cornered by toughs in an alley, close enough to smell the indigo on their hands. The way you get out of this — fists, lies, running, surrender, something else — will mark how Rook sees you for years."
   Describe the pressure. Leave the answer.

9. **DON'T INVENT CHARACTER TRAITS NOT IN THE SETUP.** The player's race, gender, parents, siblings, home, region, birth circumstance, authority figure, and Q10 free-text are canon. Canonical 5e race features (darkvision, breath weapons, etc.) are fair game. But do NOT invent specific physical markers (veins, birthmarks, glowing eyes, fevers, scars) or family secrets (hidden bloodlines, prophecies, royal parentage) that the player didn't establish. Stay inside the lines they drew.

10. **TRAJECTORY NUDGES MUST CITE PLAYER SETUP EXPLICITLY.** Do not suggest "paladin because the character is a scourge aasimar." Suggest "paladin because the home is a frontier outpost with a faltering chapel and your authority figure is a guardian who used to wear armor." Cite home / region / parents / siblings / authority / origin-freeform / birth-circumstance by name where applicable.

11. **PER-CHAPTER ENGAGEMENT MODES.** Each chapter has a PRIMARY MODE that dictates what kinds of beats belong in it. Beats that violate a chapter's mode are bad beats — rewrite them.

   **Chapter 1 — OBSERVE (+ character-shaping choices). Target: 1 session.**
     The PC is in childhood (${ages.ch1}). Primary engagement is WITNESSING and RELATIONSHIP-FORMING — not adventuring.
     YES beats: atmospheric grounding, NPC-revealed-in-unguarded-moment, world-hint (a stranger passes, a letter arrives), character-shaping choice (hide-and-listen vs. run-back-to-safety; obey-the-rule or slip-around-it; speak-up or stay-silent; share or hoard).
     NO story-shaping choices (picking factions, committing to quests, making enemies). NO COMBAT — the PC is too small. Fights happen AROUND them, not with them.
     chapter_end_moment: a "first-crack" — a small disruption in the routine that opens the door to Ch2. Not a crisis. A letter, a relative's visit with news, an overheard adult secret, a stranger at the gate.

   **Chapter 2 — LEARN (+ training combat enters). Target: 1 session, with one intra-session [AGE_ADVANCE].**
     The PC is in adolescence (${ages.ch2}). The world widens beyond the home.
     ⚠ Sonnet will fire one [AGE_ADVANCE] mid-session to split Ch2 into two halves with different ages and emotional registers (e.g., 11-13 then 13-15). Your Ch2 arc should provide texture for BOTH halves — early-Ch2 beats (just-after-childhood) and late-Ch2 beats (almost-adolescent). The intra-session jump lets consequences from the first half land in the second.
     YES beats: injustice-seen, first-friend-made-outside-family, skill-learned-from-elder, opinion-formed, loyalty-tested (small-scale), first SCHOOLYARD / TRAINING-SWORD COMBAT (survivable, bruises-not-scars). First secret kept or told. First lie attempted.
     Choices get more consequential within relationships and personal code — not yet plot-shaping.
     intra_age_jump_seed: 1 sentence — what changes between the early and late Ch2 halves. Required.
     chapter_end_moment: a "first-rupture" — a bigger event the PC can't fix but has to understand.

   **Chapter 3 — THRESHOLD (DECIDE → COMMIT, three weight-bearing beats). Target: 2 sessions (Ch3a + Ch3b).**
     The PC is at threshold (${ages.ch3}). Real agency, real consequences. THREE distinct beats land in Ch3, each with its own scene weight — Sonnet must NOT compress them into one paragraph or one scene:
       (i)   IRREVERSIBLE ACT — Ch3a builds toward this. A choice with real cost that the PC cannot undo. Bodies matter; wounds leave marks; the PC can hurt others, the PC can be hurt. Describe the SHAPE of the act (the SITUATION the PC walks into) without naming the theme — the act has to land BEFORE the theme commitment ceremony, so the player ratifies their identity by what they just did, not by an abstract list pick.
       (ii)  THEME COMMITMENT CEREMONY — surfaces in the AFTERMATH of the irreversible act. The server emits [THEME_COMMITMENT_OFFERED] and the UI renders a lightweight in-line commitment card (leading theme + 3 alternatives + "choose your own"). No wildcard slot, no defer.
       (iii) DEPARTURE — flows from the committed theme. Sonnet writes the departure tone and reason driven by the player's commit, picking from your departure_seed.plausible_shapes (or honoring an "Other" choice).
     REAL COMBAT in this chapter. Real stakes.
     chapter_promise_prompt: 1-2 sentences Sonnet will use to open Ch3 and invite the player to confirm/redirect.
     irreversible_act_shape: 1-2 sentences describing the SITUATION the PC walks into for the act. Describe pressure, not answer. Do NOT name a theme; the act lands before the lens is chosen.
     theme_commitment_handoff: 1 sentence describing the AFTERMATH state the [THEME_COMMITMENT_OFFERED] will surface in.
     departure_seed: see below.
     chapter_end_moment: the DEPARTURE itself — phrase it neutrally ("the PC leaves"). The DM fills that in at play-time using the committed theme.

     ⚠ DEPARTURE SEED — possibility space, not verdict.
     primary_thread: 1 sentence — the recurring-thread or circumstance that MOST likely pulls the PC out (no theme-lock).
     plausible_shapes: 3-4 short one-liners — how the PC might leave, each theme-compatible with at least one part of the setup. Never all the same type. NEVER default to tragedy.
     tone: 1-3 words — hopeful / bitter / determined / numb / wistful / etc.

BE CONCISE. Keep prose TIGHT. This is scaffolding, not the final story. Stay within the limits below — long beats cause JSON truncation.

OUTPUT FORMAT. Return a SINGLE JSON object. No prose before or after. No markdown fences.

{
  "home_world": {
    "description": "2-3 sentences, physical + social",
    "locals": [ { "name": "...", "role": "...", "description": "1 short sentence" } ],
    "tensions": [ "1 short sentence" ],
    "threats": [ "1 short sentence" ]${isMentor ? `,
    "mentor_possibility": { "name": "...", "role": "...", "why_they_matter": "1 sentence" }` : ''}
  },
  "chapter_1_arc": {
    "theme": "1 sentence (life stage: ${ages.ch1})",
    "beats": [ { "title": "short", "description": "1-2 sentences, not 3" } ],
    "chapter_end_moment": "1 sentence (a first-crack)",
    "seeded_emergences": [ { "kind": "stat|skill|class|theme|ancestry", "target": "specific", "narrative_anchor": "which beat" } ]
  },
  "chapter_2_arc": {
    "theme": "1 sentence (life stage: ${ages.ch2})",
    "beats": [ { "title": "short", "description": "1-2 sentences" } ],
    "intra_age_jump_seed": "1 sentence — what changes between early-Ch2 and late-Ch2 halves",
    "chapter_promise_prompt": "1-2 sentences Sonnet uses to open Ch2",
    "chapter_end_moment": "1 sentence (a first-rupture)",
    "seeded_emergences": [ { "kind": "stat|skill|class|theme|ancestry", "target": "specific", "narrative_anchor": "which beat" } ]
  },
  "chapter_3_arc": {
    "theme": "1 sentence (life stage: ${ages.ch3})",
    "beats": [ { "title": "short", "description": "1-2 sentences" } ],
    "chapter_promise_prompt": "1-2 sentences Sonnet uses to open Ch3",
    "irreversible_act_shape": "1-2 sentences — the SITUATION (no theme-naming)",
    "theme_commitment_handoff": "1 sentence — the aftermath state",
    "departure_seed": {
      "primary_thread": "1 sentence — what pulls the PC out, no theme-lock",
      "plausible_shapes": [ "1 short sentence per entry. 3-4 entries. Never all the same type. NEVER default to tragedy." ],
      "tone": "1-3 words — hopeful / bitter / determined / numb / wistful / etc."
    },
    "chapter_end_moment": "1 sentence — the departure itself, neutrally phrased",
    "seeded_emergences": [ { "kind": "stat|skill|class|theme|ancestry", "target": "specific", "narrative_anchor": "which beat" } ]
  },
  "recurring_threads": [
    { "name": "short", "description": "1 sentence", "spans_chapters": [1,2,3], "payoff_chapter": 3 }
  ],
  "character_trajectory": {
    "suggested_class": "class id (e.g. 'rogue')",
    "suggested_theme": "theme id (e.g. 'outlander')",
    "suggested_ancestry_feat": "ancestry feat list id",
    "why_class": "1 sentence — must cite at least one setup field (home, region, authority, parent, sibling, birth_circumstance, or Q10 origin) by name",
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
- plausible_shapes: 3-4 entries (departure seed — theme commitment at Ch3 picks from these or overrides)
- seeded_emergences per chapter: 1-2 entries

FINAL REMINDER:
- **Beats are SITUATIONS the player walks into, not scripted outcomes.** If a beat says what the character does, says, feels, or decides — rewrite it. Describe the pressure. Leave the answer.
- **No invented character traits.** Physical markers, family secrets, hidden bloodlines, prophecies — none of these unless the player put them in setup.
- **Trajectory nudges cite player setup by name.** Say "because your home is X and your authority figure was Y" — not "because the character is aasimar."
- **Authority figure shapes Ch1-2 NPCs.** Mentor → seeded mentor_possibility + at least one establishing beat. Captor → captivity arc. Etc.
- **Q10 free-text origin overrides curated answers when conflicting.** Honor it.
- **Departure is a SEED, not a verdict.** plausible_shapes = 3-4 varied options; the player's committed theme drives the final type.
- **Three Ch3 beats (irreversible_act → theme_commitment → departure) get distinct scene weight.** The arc plan describes their shape; Sonnet plays them as separate beats.
- Tight prose. Short sentences.
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

  // Phase 2 — siblings is now a single enum value (Decision A); old array
  // form is preserved as legacy fallback for prelude characters created
  // before the wizard rebuild.
  const siblingsDesc = (() => {
    if (Array.isArray(setup.siblings)) {
      // Legacy v1.0.73 sub-form
      if (setup.siblings.length === 0) return 'only child';
      return setup.siblings.map(s => {
        const rel = s.relative_age || 'unspecified age';
        const gender = s.gender || 'sibling';
        const race = s.race || playerRace;
        return `${s.name} (${race} ${gender}, ${rel})`;
      }).join('; ');
    }
    const sib = findSiblingOption(setup.siblings);
    return sib ? sib.label : '(unspecified)';
  })();

  const authority = findAuthorityFigure(setup.authority_figure);
  const authorityDesc = authority
    ? `${authority.label} — ${authority.description}`
    : '(unspecified)';

  const birth = BIRTH_CIRCUMSTANCES.find(c => c.value === setup.birth_circumstance);
  const home = HOME_SETTINGS.find(c => c.value === setup.home_setting);
  const region = REGIONS.find(c => c.value === setup.region);

  const ages = getChapterAges(character.race);
  const originFreeform = (setup.origin_freeform || '').trim();

  return `Generate the arc plan for this character. Respect every field as canonical.

NAME: ${character.name}${character.nickname ? ` ("${character.nickname}")` : ''}
RACE: ${character.race}${character.subrace ? ` (${character.subrace})` : ''}
GENDER: ${setup.gender}

CHAPTER AGES (this race's life stages):
  Ch1 (Childhood): ${ages.ch1}
  Ch2 (Adolescence): ${ages.ch2}
  Ch3 (Threshold): ${ages.ch3}

BIRTH CIRCUMSTANCE: ${birth ? birth.label : setup.birth_circumstance}
  ${birth ? birth.description : '(free-text — interpret literally)'}

HOME SETTING: ${home ? home.label : setup.home_setting}
  ${home ? home.description : '(free-text — interpret literally)'}

REGION: ${region ? region.label : setup.region}
  ${region ? region.description : '(free-text — interpret literally)'}

PARENTS: ${parentsDesc || 'unknown'}
SIBLINGS: ${siblingsDesc}

AUTHORITY FIGURE (Q9 — looms largest in early life): ${authorityDesc}
${originFreeform ? `
ANYTHING ELSE (Q10 — player free-text origin): "${originFreeform}"
  ⚠ Honor this over conflicting curated answers when applicable.` : ''}

Output the JSON arc plan now. No preamble, no epilogue — just the JSON object.`;
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
    tone_reflection: row.tone_reflection || null,
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
 *
 * Phase 2 chunk 3: validates the 3-chapter shape. departure_seed lives on
 * chapter_3_arc (not chapter_4_arc — Ch4 collapsed into Ch3 per Phase 1
 * Decision 2). Legacy 4-chapter plans are still readable via getArcPlan
 * but new generation must produce the 3-chapter shape.
 */
function validateParsedPlan(plan) {
  if (!plan || typeof plan !== 'object') throw new Error('Arc plan is not an object');
  const required = ['home_world', 'chapter_1_arc', 'chapter_2_arc', 'chapter_3_arc'];
  for (const f of required) {
    if (!plan[f] || typeof plan[f] !== 'object') {
      throw new Error(`Arc plan missing required field: ${f}`);
    }
  }
  if (!plan.chapter_3_arc.departure_seed || typeof plan.chapter_3_arc.departure_seed !== 'object') {
    throw new Error('Chapter 3 arc is missing departure_seed');
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

  // 8192 tokens ≈ ~30KB of JSON — comfortable headroom for the structured
  // arc plan. Previous 4096 cap was truncating mid-array on wordier tones
  // like "political + mystical + tragic".
  //
  // Retry policy: if the first response fails JSON extract or shape
  // validation, send one corrective follow-up that quotes the offending
  // response back at Opus and asks for a clean re-emission. This catches
  // the common failure modes (multi-block output, mid-string newlines,
  // shape drift on tough tone combos) without shopping indefinitely.
  const MAX_PARSE_ATTEMPTS = 2;
  const messages = [{ role: 'user', content: userPrompt }];
  let parsed;
  let lastRaw = '';
  let lastErr;
  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt++) {
    const raw = await chat(systemPrompt, messages, 3, 'opus', 8192, true);
    lastRaw = raw;
    try {
      parsed = extractLLMJson(raw);
      validateParsedPlan(parsed);
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_PARSE_ATTEMPTS) {
        console.warn(`[preludeArc] Parse attempt ${attempt} failed: ${err.message} — retrying with correction`);
        messages.push({ role: 'assistant', content: raw });
        messages.push({
          role: 'user',
          content: `Your previous response couldn't be parsed: ${err.message}\n\nPlease re-emit the arc plan as a SINGLE well-formed JSON object. No markdown fences, no preamble, no standalone sub-objects before or after. Every string must be on one line (no literal newlines inside strings). Start with { and end with }. All fields from the schema must be present.`
        });
      }
    }
  }
  if (lastErr) {
    const preview = (lastRaw || '').slice(0, 1500);
    throw new Error(`Arc plan parse failed after ${MAX_PARSE_ATTEMPTS} attempts: ${lastErr.message}. First 1500 chars of last response: ${preview}`);
  }

  const serializeField = (v) => v == null ? null : JSON.stringify(v);

  // INSERT OR REPLACE (UNIQUE on character_id). Increment regenerate_count
  // only when this is explicitly a re-roll; initial generation leaves it at 0.
  const nextRegenCount = isRegeneration ? ((existing?.regenerate_count || 0) + 1) : 0;

  // Phase 2 chunk 3: tone_tags / tone_reflection / chapter_4_arc are no
  // longer populated for new preludes (locked tone description; 3-chapter
  // shape). Columns stay in schema for legacy plans (additive-only).
  // departure_seed lives on chapter_3_arc now.
  await dbRun(
    `INSERT INTO prelude_arc_plans (
      character_id, generated_at, model, tone_tags, tone_reflection,
      home_world, chapter_1_arc, chapter_2_arc, chapter_3_arc, chapter_4_arc,
      recurring_threads, character_trajectory, seed_emergences, departure_seed,
      regenerate_count
    ) VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(character_id) DO UPDATE SET
      generated_at = CURRENT_TIMESTAMP,
      model = excluded.model,
      tone_tags = excluded.tone_tags,
      tone_reflection = excluded.tone_reflection,
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
      null,                // tone_tags (legacy)
      null,                // tone_reflection (legacy)
      serializeField(parsed.home_world),
      serializeField(parsed.chapter_1_arc),
      serializeField(parsed.chapter_2_arc),
      serializeField(parsed.chapter_3_arc),
      null,                // chapter_4_arc (collapsed into Ch3 per Phase 1 Decision 2)
      serializeField(parsed.recurring_threads),
      serializeField(parsed.character_trajectory),
      serializeField(parsed.seed_emergences),
      serializeField(parsed.chapter_3_arc.departure_seed),
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
