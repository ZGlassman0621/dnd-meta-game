/**
 * Prelude → Primary handoff transition service.
 *
 * Phase 2 chunk 2. Triggered when [PRELUDE_END] fires during a Prelude
 * session. Aggregates the Prelude's accumulated state, generates the
 * biography seed (Opus call), persists it, and flips
 * `creation_phase` from `'prelude'` to `'ready_for_primary'`.
 *
 * What "transition" produces:
 *  1. `character_biography` seed entries (from migration 048) — Opus-
 *     generated appendable timestamped paragraphs in the voice of the
 *     adult character looking back, with allowed gentle distortion.
 *     Replaces the v1.0.73 single-blob backstory output with the living
 *     biography per Phase 1 Decision 3.
 *  2. `mentor_imprints` row (when applicable) — seeded only if
 *     `authority_figure='mentor'` AND a `prelude_canon_npcs` row with
 *     `relationship='mentor'` exists. The mentor relationship arrives
 *     at the main campaign with prior history rather than as a blank
 *     meet (per PRELUDE_IMPLEMENTATION_PLAN rule #23).
 *  3. `characters.prelude_handoff_payload` JSON — the rich pre-fill
 *     payload the existing CharacterCreationWizard reads on resume
 *     (suggested name parts, suggested class/alignment/lifestyle,
 *     emerged personality sentences, flattened biography text for the
 *     existing creator's `backstory` textarea, etc.). The new creator
 *     (chunk 5) will consume the same payload more richly; the existing
 *     creator pre-fills what it can and leaves the rest blank per A2a
 *     option (iv).
 *  4. `characters.creation_phase = 'ready_for_primary'` — signals the
 *     home page (and chunk 5 main creator) that this character is
 *     waiting for creator finalization.
 *
 * Canon NPCs / locations / threads transfer to `npcs` / `locations` /
 * `campaign_threads` when the primary campaign is created downstream of
 * the existing creator's submit. That transfer is OUT OF SCOPE for
 * chunk 2 — chunk 2 stops at making the data available; chunk 5 (or
 * chunk 6 / 7) wires it into campaign creation. The `prelude_handoff_payload`
 * carries pointers to the source rows so chunk 5 can find them.
 *
 * Resume semantics:
 *  - `executeTransition` is idempotent. Calling it on an already-
 *    transitioned character (creation_phase='ready_for_primary') refreshes
 *    the payload (in case Prelude data changed via a fix-up flow) but
 *    does NOT regenerate the biography. The biography seed is generated
 *    once at first transition; later regeneration would conflict with
 *    any player edits in the existing creator's backstory textarea.
 *  - Calling on a character with creation_phase='active' is a no-op and
 *    returns the existing payload. Caller can rely on this for resume.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { chat } from './claude.js';
import { extractLLMJson } from '../utils/llmJson.js';
import { getPreludeCharacter } from './preludeService.js';
import { getArcPlan } from './preludeArcService.js';
import { getCommittedTheme } from './preludeThemeService.js';
import { getActiveThreads } from './preludeCanonThreadService.js';
import { getActiveCanonFacts } from './preludeCanonService.js';
import { getTrajectoryWinner, getAcceptedEmergences } from './preludeEmergenceService.js';
import { findAuthorityFigure } from '../data/preludeWizardEnums.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute the Prelude → Primary handoff for a character. Idempotent.
 *
 * Returns: { status, payload, biographyEntries, mentorImprintId }
 *   status: 'transitioned' on first run; 'refreshed' if already transitioned
 *           and payload was rewritten; 'noop' if creation_phase='active'.
 */
export async function executeTransition(characterId) {
  const character = await loadCharacter(characterId);
  if (!character) {
    throw new Error(`Character ${characterId} not found`);
  }

  if (character.creation_phase === 'active') {
    return {
      status: 'noop',
      payload: parsePayload(character.prelude_handoff_payload),
      biographyEntries: [],
      mentorImprintId: null
    };
  }

  const isFirstTransition = character.creation_phase === 'prelude';

  // --- aggregate prelude state ----------------------------------------------
  const setup = parseSetup(character.prelude_setup_data);
  const arcPlan = await getArcPlan(characterId);
  const committedTheme = await getCommittedTheme(characterId);
  const acceptedEmergences = await getAcceptedEmergences(characterId);
  const classWinner = await getTrajectoryWinner(characterId, 'class');
  const ancestryWinner = await getTrajectoryWinner(characterId, 'ancestry');
  const canonNpcs = await dbAll(
    `SELECT id, name, relationship, age_at_prelude_end, description, status, first_appeared_age
     FROM prelude_canon_npcs WHERE character_id = ? ORDER BY id`,
    [characterId]
  );
  const canonLocations = await dbAll(
    `SELECT id, name, type, description, is_home FROM prelude_canon_locations
     WHERE character_id = ? ORDER BY id`,
    [characterId]
  );
  const canonThreads = await getActiveThreads(characterId);
  const canonFacts = await getActiveCanonFacts(characterId);

  // --- biography seed (only on first transition) ----------------------------
  let biographyEntries = [];
  if (isFirstTransition) {
    biographyEntries = await generateBiographyEntries(character, setup, {
      arcPlan, canonNpcs, canonLocations, canonFacts, acceptedEmergences,
      committedTheme, classWinner, ancestryWinner
    });
    for (const entry of biographyEntries) {
      await dbRun(
        `INSERT INTO character_biography
           (character_id, entry_type, origin_age, origin_chapter, body)
         VALUES (?, 'seeded_from_prelude', ?, ?, ?)`,
        [characterId, entry.age || null, entry.chapter || null, entry.body]
      );
    }
  } else {
    biographyEntries = await dbAll(
      `SELECT id, entry_type, origin_age, origin_chapter, body, created_at
       FROM character_biography
       WHERE character_id = ? AND entry_type = 'seeded_from_prelude'
       ORDER BY id`,
      [characterId]
    );
  }

  // --- mentor imprint (only when authority_figure='mentor' AND a matching
  // prelude_canon_npcs row exists) -------------------------------------------
  let mentorImprintId = null;
  if (isFirstTransition && setup.authority_figure === 'mentor') {
    const mentorNpc = canonNpcs.find(
      n => String(n.relationship || '').toLowerCase() === 'mentor'
    );
    if (mentorNpc) {
      const result = await dbRun(
        `INSERT INTO mentor_imprints
           (character_id, source, mentor_name, mentor_role, mentor_status,
            first_met_at_age, relationship_summary, formative_beats)
         VALUES (?, 'prelude', ?, ?, ?, ?, ?, ?)`,
        [
          characterId,
          mentorNpc.name,
          mentorNpc.relationship || 'mentor',
          mentorNpc.status || 'alive',
          mentorNpc.first_appeared_age || null,
          mentorNpc.description || null,
          buildMentorFormativeBeats(canonFacts, mentorNpc)
        ]
      );
      mentorImprintId = Number(result.lastInsertRowid);
    }
  }

  // --- handoff payload + creation_phase flip --------------------------------
  const payload = buildHandoffPayload({
    character, setup, arcPlan, committedTheme,
    classWinner, ancestryWinner, acceptedEmergences,
    canonNpcs, canonLocations, canonThreads, canonFacts,
    biographyEntries, mentorImprintId
  });

  await dbRun(
    `UPDATE characters
     SET creation_phase = 'ready_for_primary',
         prelude_handoff_payload = ?
     WHERE id = ?`,
    [JSON.stringify(payload), characterId]
  );

  return {
    status: isFirstTransition ? 'transitioned' : 'refreshed',
    payload,
    biographyEntries,
    mentorImprintId
  };
}

/**
 * Read the persisted handoff payload for a character. Returns null if
 * the character isn't in 'ready_for_primary' or 'active' state, or if
 * the payload column is empty.
 */
export async function getHandoffPayload(characterId) {
  const row = await dbGet(
    `SELECT creation_phase, prelude_handoff_payload FROM characters WHERE id = ?`,
    [characterId]
  );
  if (!row) return null;
  if (!['ready_for_primary', 'active'].includes(row.creation_phase)) return null;
  return parsePayload(row.prelude_handoff_payload);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function loadCharacter(characterId) {
  // getPreludeCharacter only returns rows in `creation_phase='prelude'`.
  // For idempotency we also need to read characters in `'ready_for_primary'`
  // and `'active'`, so we read directly here.
  const row = await dbGet(
    `SELECT id, name, first_name, last_name, nickname, gender, race, subrace,
            creation_phase, prelude_age, prelude_chapter, prelude_setup_data,
            prelude_committed_theme, prelude_handoff_payload
     FROM characters WHERE id = ?`,
    [characterId]
  );
  return row;
}

function parseSetup(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function parsePayload(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * Aggregate accepted stat emergences into a `{ str, dex, con, int, wis, cha }`
 * map of bonuses. Caps at +2 per stat (the cap is also enforced server-side
 * at recordStatHint, but we re-clamp here for safety).
 */
function aggregateStatBonuses(acceptedEmergences) {
  const bonuses = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  for (const e of acceptedEmergences) {
    if (e.kind !== 'stat') continue;
    const target = String(e.target || '').toLowerCase();
    if (!(target in bonuses)) continue;
    bonuses[target] = Math.min(2, bonuses[target] + (e.magnitude || 0));
  }
  return bonuses;
}

/**
 * Aggregate accepted skill emergences into an array of skill names. Caps
 * at 2 (also enforced at marker-record time).
 */
function aggregateSkills(acceptedEmergences) {
  const skills = [];
  for (const e of acceptedEmergences) {
    if (e.kind !== 'skill') continue;
    if (skills.length >= 2) break;
    skills.push(e.target);
  }
  return skills;
}

/**
 * Build the formative-beats summary string for a mentor imprint. Pulls
 * any canon facts whose subject matches the mentor's name and
 * concatenates the fact bodies. Falls back to a single-line summary if
 * no facts mention them.
 */
function buildMentorFormativeBeats(canonFacts, mentorNpc) {
  const matching = canonFacts.filter(f =>
    String(f.subject || '').toLowerCase() === String(mentorNpc.name || '').toLowerCase()
  );
  if (matching.length === 0) {
    return `${mentorNpc.name} was ${mentorNpc.relationship || 'a mentor'} during the Prelude.`;
  }
  return matching.map(f => `[${f.category}] ${f.fact}`).join('\n');
}

/**
 * Build the rich handoff payload. The existing CharacterCreationWizard
 * reads selected fields via its `preludePayload` prop (Phase 2 chunk 2
 * (iv) wiring); the new chunk-5 creator will consume more of the
 * payload. Schema is intentionally generous — easier to ignore unused
 * fields than to extend the table later.
 */
function buildHandoffPayload({
  character, setup, arcPlan, committedTheme,
  classWinner, ancestryWinner, acceptedEmergences,
  canonNpcs, canonLocations, canonThreads, canonFacts,
  biographyEntries, mentorImprintId
}) {
  const authority = findAuthorityFigure(setup.authority_figure);
  const statBonuses = aggregateStatBonuses(acceptedEmergences);
  const skills = aggregateSkills(acceptedEmergences);

  // Flatten biography seed entries into a single string for the existing
  // creator's `backstory` textarea. Chunk 5's new creator reads the
  // entries directly from `character_biography` and renders them
  // appendable; this projection is a temporary surface for the gap
  // window. Edits to the textarea in the existing creator do not
  // round-trip back to `character_biography` — the table is canonical;
  // the textarea is a one-way mirror. (See chunk 1 caveat in CHANGELOG
  // 1.0.104 for the institutional-memory note.)
  const flattenedBackstory = biographyEntries
    .map(e => {
      const tag = e.origin_age != null ? `Age ${e.origin_age}` : (e.age != null ? `Age ${e.age}` : null);
      return tag ? `${tag} — ${e.body || e.content || ''}` : (e.body || e.content || '');
    })
    .filter(s => s.trim())
    .join('\n\n');

  return {
    schema_version: 1,
    character_id: character.id,

    // Locked from setup + emergence
    locked: {
      first_name: character.first_name || null,
      last_name: character.last_name || null,
      nickname: character.nickname || null,
      gender: character.gender,
      race: character.race,
      subrace: character.subrace,
      committed_theme: committedTheme?.theme || setup.prelude_committed_theme || null,
      ancestry_feat_id: ancestryWinner?.winner || null,
      home_region: setup.region || null,
      home_setting: setup.home_setting || null,
      authority_figure: setup.authority_figure || null
    },

    // Suggestions — pre-filled but editable in the new creator (chunk 5).
    // Existing creator (chunk 2 (iv) stop-gap) consumes the subset it can.
    suggested: {
      class: classWinner?.winner || null,
      stat_bonuses: statBonuses,
      skills,
      // Class/ancestry-feat were derived from chapter-weighted tallies;
      // surface their scores so chunk 5 can render confidence badges.
      class_score: classWinner?.score ?? null,
      ancestry_score: ancestryWinner?.score ?? null,
      // alignment / lifestyle / personality / physical fields are not
      // currently emerged from Prelude play — placeholders for chunk 5.
      alignment: null,
      lifestyle: null,
      personality_traits: null,
      ideals: null,
      bonds: null,
      flaws: null,
      hair_color: null,
      skin_color: null,
      eye_color: null,
      height: null,
      weight: null
    },

    // Free choice in the creator (informational only here)
    free_choice_fields: ['ability_scores', 'skills_remaining', 'spellcasting', 'faith', 'equipment'],

    // Pointers — the canonical rows live in the prelude_canon_* tables.
    // chunk 5 (and downstream campaign creation) read them directly via
    // these IDs.
    canon: {
      npcs: canonNpcs.map(n => ({
        id: n.id, name: n.name, relationship: n.relationship,
        status: n.status, age_at_prelude_end: n.age_at_prelude_end
      })),
      locations: canonLocations.map(l => ({
        id: l.id, name: l.name, type: l.type, is_home: !!l.is_home
      })),
      threads: canonThreads.map(t => ({
        id: t.id, kind: t.kind, weight: t.weight,
        subject_npc_id: t.subject_npc_id, subject_location_id: t.subject_location_id,
        subject_text: t.subject_text, condition: t.condition
      })),
      fact_count: canonFacts.length
    },

    biography: {
      entry_count: biographyEntries.length,
      flattened_backstory: flattenedBackstory
    },

    mentor_imprint_id: mentorImprintId,

    // Departure context — used by chunk 5's main-creator to seed the
    // primary campaign opener ("you have traveled from..."). Read-only
    // pointer to the arc plan's departure_seed so the campaign generator
    // gets the same input the player saw.
    departure_summary: arcPlan?.chapter_3_arc?.departure_seed || arcPlan?.departure_seed || null,

    // Authority-figure label, for surfacing in the transition screen.
    authority_label: authority?.label || null,

    transitioned_at: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// Biography seed generation (Opus call)
// ---------------------------------------------------------------------------

/**
 * Generate 4-6 appendable biography entries from the Prelude state.
 * Opus call; output is timestamped paragraphs in the voice of the adult
 * character looking back, with allowed gentle distortion.
 *
 * Entries are appendable across the main campaign (later phases append
 * narrative_milestone entries). Phase 2 only seeds the Prelude entries.
 */
async function generateBiographyEntries(character, setup, ctx) {
  const sysPrompt = buildBiographySystemPrompt();
  const userPrompt = buildBiographyUserPrompt(character, setup, ctx);

  const raw = await chat(sysPrompt, [{ role: 'user', content: userPrompt }], 3, 'opus', 4096, true);
  const parsed = extractLLMJson(raw);

  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error('Biography generation produced no entries (expected { entries: [...] })');
  }

  // Defensive shape check — entries should each have age + body
  return parsed.entries
    .filter(e => e && typeof e === 'object' && (e.body || e.content))
    .map(e => ({
      age: Number.isFinite(e.age) ? e.age : null,
      chapter: Number.isFinite(e.chapter) ? e.chapter : null,
      body: String(e.body || e.content || '').trim()
    }))
    .filter(e => e.body.length > 0);
}

function buildBiographySystemPrompt() {
  return `You are writing the seed entries of a living biography for a D&D character who just finished the Prelude — the formative-years play (childhood, adolescence, threshold of adulthood) that shapes who they become.

Voice: SECOND-PERSON, written as the adult character looking back at the moments that mattered. Allowed gentle distortion — memory isn't documentary; specifics may have softened or sharpened ("you remember her as taller than she was; she was not"). The narrator is the character themselves, in the first weeks after departure, reflecting.

Tone: epic fantasy in a lived-in world. The grand and the granular share every entry. Concrete observed detail beats abstract metaphor. Don't soften consequences just because the protagonist was young; this is the same person, looking back, who LIVED those years.

Format: 4-6 timestamped entries. Each entry covers ONE formative moment from the Prelude — not a chapter summary, not a survey of the character's whole arc. Prefer specifics over montages: a single argument with a parent, a single afternoon at the river, a single decision that mattered. Each entry is 2-4 sentences. Do not pad.

Entries should COVER the major Prelude beats provided (parents, siblings, authority figure, irreversible act, departure) but NOT mechanically — pick the moments that earned weight, not the ones that were merely present.

Output FORMAT — return a SINGLE JSON object, no markdown fences:
{
  "entries": [
    { "age": <number>, "chapter": <1 | 2 | 3>, "body": "<2-4 sentences>" },
    ...
  ]
}

NO preamble, no epilogue, no markdown. JSON object only. Each entry's "body" is the prose; "age" is the in-fiction age the moment occurred at; "chapter" is 1, 2, or 3.`;
}

function buildBiographyUserPrompt(character, setup, ctx) {
  const { arcPlan, canonNpcs, canonLocations, canonFacts, acceptedEmergences,
          committedTheme, classWinner } = ctx;
  const authority = findAuthorityFigure(setup.authority_figure);

  const npcLines = canonNpcs.map(n =>
    `  • ${n.name} (${n.relationship || 'role unspecified'}, ${n.status || 'alive'})`
  ).join('\n') || '  (none recorded)';

  const locationLines = canonLocations.map(l =>
    `  • ${l.name}${l.is_home ? ' [home]' : ''} — ${l.type || 'place'}`
  ).join('\n') || '  (none recorded)';

  // Only include the most concrete facts to keep token cost down.
  const factLines = canonFacts
    .slice(0, 30)
    .map(f => `  • [${f.category}] ${f.subject}: ${f.fact}`)
    .join('\n') || '  (none recorded)';

  const emergenceLines = acceptedEmergences
    .filter(e => e.kind === 'stat' || e.kind === 'skill')
    .map(e => `  • ${e.kind === 'stat' ? `+${e.magnitude} ${e.target.toUpperCase()}` : e.target}${e.reason ? ` — "${e.reason}"` : ''}`)
    .join('\n') || '  (none)';

  return `Write the seed biography entries for this character. They have just finished the Prelude.

CHARACTER: ${character.name}, ${character.race}${character.subrace ? ` (${character.subrace})` : ''}, ${setup.gender}
HOME: ${setup.home_setting || 'unspecified'} in ${setup.region || 'unspecified region'}
AUTHORITY FIGURE: ${authority?.label || 'unspecified'}
COMMITTED THEME: ${committedTheme?.theme || '(none yet committed)'}
SUGGESTED CLASS (from played behavior): ${classWinner?.winner || 'undecided'}

CANONICAL NPCs FROM THE PRELUDE:
${npcLines}

CANONICAL PLACES:
${locationLines}

ACCEPTED EMERGENCES (the player ratified these):
${emergenceLines}

CANON FACTS (most-specific first; cite where the prose calls for them):
${factLines}

DEPARTURE: ${arcPlan?.chapter_3_arc?.departure_seed?.primary_thread || arcPlan?.departure_seed?.primary_thread || '(not yet detailed)'}

Write 4-6 entries. JSON only.`;
}
