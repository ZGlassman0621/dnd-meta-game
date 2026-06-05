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
import { loggedChat } from './aiCallLogger.js';
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

  // Phase 2 follow-up — pull chapter beats for the winning ancestry feat.
  // The chunk-5 creator's locked-feat celebration card renders these as
  // bullets justifying why play pointed at this feat. Reasons captured
  // verbatim from [ANCESTRY_HINT] emissions; chapter context preserved.
  const ancestryChapterBeats = ancestryWinner
    ? await pickAncestryChapterBeats(characterId, ancestryWinner.winner)
    : [];

  // Mirror for theme — the Step 3 celebration card renders these as
  // bullets that justify why play settled on this theme. Picked from
  // [THEME_HINT] emissions of the committed theme; same selection rule
  // (one beat per chapter, last fire wins, max 3, chronological).
  const themeChapterBeats = committedTheme?.theme
    ? await pickThemeChapterBeats(characterId, committedTheme.theme)
    : [];

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

  // --- heirloom candidates (Phase 2 chunk 5.A) ------------------------------
  // Producer-side wiring is DEFERRED — no [OBJECT_HINT] marker, no
  // extraction pass. The query returns [] today. Future producer work will
  // populate prelude_canon_heirlooms with status='candidate' rows; this
  // line will surface them automatically. Zero candidates is a legitimate
  // empty state (per spec §8.1.2). See PHASE_2_CREATOR_SPEC.md §8.1.2 +
  // §5.6.3 annotations for context.
  const heirloomCandidates = await dbAll(
    `SELECT id, name, type, specific_item_ref, description, awakening_hook,
            acquired_at_age, acquired_at_chapter
       FROM prelude_canon_heirlooms
      WHERE character_id = ? AND status = 'candidate'
      ORDER BY id`,
    [characterId]
  );

  // --- handoff payload + creation_phase flip --------------------------------
  const payload = buildHandoffPayload({
    character, setup, arcPlan, committedTheme,
    classWinner, ancestryWinner, ancestryChapterBeats, themeChapterBeats,
    acceptedEmergences,
    canonNpcs, canonLocations, canonThreads, canonFacts,
    biographyEntries, mentorImprintId, heirloomCandidates
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
 * Pick the top chapter beats for the winning ancestry feat. Reads
 * [ANCESTRY_HINT] rows from prelude_emergences whose target matches
 * the winner slug, picks up to one per chapter weighted by chapter
 * weight (Ch1=1×, Ch2=1.5×, Ch3=2×) — preserving chronological order
 * so the bullets tell a small arc.
 *
 * Returns array of `{ chapter, reason }`, max 3 entries, ordered
 * chronologically (Ch1 → Ch2 → Ch3). Empty array if no rows match
 * (e.g., the winning slug came from a single fire and the user is
 * looking at Ch1 only).
 *
 * Selection rule (per design call from PM):
 *   • One beat per chapter MAX (so the arc reads chronologically rather
 *     than getting dominated by repeated Ch3 fires of the same feat).
 *   • If a chapter has multiple fires of the winner slug, take the
 *     LAST one (most recent fire within that chapter — usually the
 *     most concrete beat, since earlier fires often happen as the
 *     player is still feeling out the affinity).
 *   • Drop any beat where reason is null/empty.
 *   • Cap at 3 (Ch1 + Ch2 + Ch3 = 3 beats max).
 */
async function pickAncestryChapterBeats(characterId, winnerFeatId) {
  return pickChapterBeatsByKind(characterId, 'ancestry', winnerFeatId);
}

/**
 * Mirror of pickAncestryChapterBeats for [THEME_HINT] emissions of the
 * committed theme. Same selection rule (one beat per chapter, last fire
 * wins, max 3, chronological). Used by the chunk-5 Step 3 celebration
 * card.
 */
async function pickThemeChapterBeats(characterId, committedThemeId) {
  return pickChapterBeatsByKind(characterId, 'theme', committedThemeId);
}

async function pickChapterBeatsByKind(characterId, kind, winnerTarget) {
  if (!winnerTarget) return [];
  const rows = await dbAll(
    `SELECT chapter, reason, id FROM prelude_emergences
     WHERE character_id = ?
       AND kind = ?
       AND target = ?
       AND reason IS NOT NULL
       AND TRIM(reason) <> ''
     ORDER BY chapter ASC, id ASC`,
    [characterId, kind, winnerTarget]
  );
  const byChapter = new Map();
  for (const row of rows) {
    if (row.chapter == null) continue;
    byChapter.set(row.chapter, row);
  }
  return [...byChapter.values()]
    .sort((a, b) => a.chapter - b.chapter)
    .slice(0, 3)
    .map(r => ({ chapter: r.chapter, reason: r.reason }));
}

/**
 * Project accepted [STAT_HINT] emergences into the chunk-5-shaped array
 * `[ { stat, magnitude, chapter_beat } ]` per spec §8.2.1. The Step 5
 * bump celebration card renders one entry per accepted bump with the
 * chapter beat as the in-fiction justification ("Across your Prelude, your
 * STR was shaped: ...").
 *
 * `chapter_beat` is the `reason` field from the [STAT_HINT] emission. When
 * a stat received multiple accepted bumps, the array contains multiple
 * entries — preserving each fire's context rather than collapsing to a
 * total. The +2-per-stat creator cap is the consumer's responsibility
 * (spec §5.5.5); this projection is faithful to whatever the player
 * accepted during play.
 */
function buildAcceptedStatBumps(acceptedEmergences) {
  return acceptedEmergences
    .filter(e => e.kind === 'stat' && e.target)
    .map(e => ({
      stat: String(e.target).toLowerCase(),
      magnitude: Number(e.magnitude) || 1,
      chapter: e.chapter ?? null,
      chapter_beat: e.reason || null
    }));
}

/**
 * Project accepted [SKILL_HINT] emergences into the chunk-5-shaped array
 * `[ { skill, chapter_beat } ]` per spec §8.2.1. The Step 5 skills picker
 * renders these as pre-confirmed, justification-tagged picks (which the
 * player can still re-pick the equivalent of).
 */
function buildAcceptedSkillBumps(acceptedEmergences) {
  return acceptedEmergences
    .filter(e => e.kind === 'skill' && e.target)
    .map(e => ({
      skill: e.target,
      chapter: e.chapter ?? null,
      chapter_beat: e.reason || null
    }));
}

/**
 * Build the rich handoff payload (schema_version=2 — Phase 2 chunk 5.B).
 *
 * Shape follows PHASE_2_CREATOR_SPEC.md §8.2.1 — the chunk-5 creator's
 * contract. Top-level fields are flat per spec; a small additional set of
 * helper fields (departure_summary, authority_label, home_region/setting,
 * authority_figure, name_parts, mentor_imprint_id) is included as context
 * the new creator and the gap-window transition screen need but the spec
 * doesn't enumerate.
 *
 * Schema versioning: bumping from 1 → 2 marks the §8.2.1 reshape. The
 * version field is the only safe way for downstream consumers to detect
 * shape; consumers that read this payload should switch on it if they
 * care.
 *
 * Heirloom candidates: the field is wired (`heirloom_candidates`) but the
 * producer is deferred — see the heirloom note in §8.1.2 + §5.6.3 for
 * what's intentionally open. Empty array is the legitimate empty state.
 *
 * USE_NAME marker: spec §8.2.1 references a `[USE_NAME]` marker for an
 * effective-name override (latest USE_NAME target, or setup_name if
 * none). The marker isn't implemented in v4 / chunk 4; until it is, the
 * effective `name` field falls back to the character's persisted
 * first/last name (which equals the setup name for handoff characters
 * since the prelude doesn't currently mutate it). The fallback is
 * spec-compliant.
 */
function buildHandoffPayload({
  character, setup, arcPlan, committedTheme,
  classWinner, ancestryWinner, ancestryChapterBeats = [], themeChapterBeats = [],
  acceptedEmergences,
  canonNpcs, canonLocations, canonThreads, canonFacts,
  biographyEntries, mentorImprintId, heirloomCandidates = []
}) {
  const authority = findAuthorityFigure(setup.authority_figure);
  const setupName = composeName(setup.first_name, setup.last_name) || setup.name || null;
  const characterName = composeName(character.first_name, character.last_name);
  const effectiveName = characterName || setupName;

  // Mentor imprint eligibility — true only if the player committed to
  // 'mentor' as authority figure AND the Prelude actually established a
  // canonical mentor NPC (relationship='mentor'). The mentor_imprint_id
  // below records whether seeding actually happened (it can be null if
  // ineligible OR if eligible but the imprint row INSERT was skipped on
  // a refresh run). The eligibility flag is independent of seeding state.
  const mentorImprintEligible =
    String(setup.authority_figure || '').toLowerCase() === 'mentor' &&
    canonNpcs.some(n => String(n.relationship || '').toLowerCase() === 'mentor');

  return {
    schema_version: 2,
    character_id: character.id,
    transitioned_at: new Date().toISOString(),

    // --- §8.2.1 required fields -------------------------------------------
    setup_name: setupName,
    name: effectiveName,
    gender: character.gender || setup.gender || null,
    race: character.race || setup.race || null,
    subrace: character.subrace || setup.subrace || null,

    committed_theme: committedTheme?.theme || setup.prelude_committed_theme || null,
    theme_chapter_beats: themeChapterBeats,

    ancestry_feat_id: ancestryWinner?.winner || null,
    ancestry_chapter_beats: ancestryChapterBeats,

    class_suggestion: classWinner?.winner || null,

    accepted_stat_bumps: buildAcceptedStatBumps(acceptedEmergences),
    accepted_skill_bumps: buildAcceptedSkillBumps(acceptedEmergences),

    heirloom_candidates: heirloomCandidates.map(h => ({
      id: h.id,
      name: h.name,
      type: h.type,
      specific_item_ref: h.specific_item_ref,
      description: h.description,
      awakening_hook: h.awakening_hook,
      acquired_at_age: h.acquired_at_age,
      acquired_at_chapter: h.acquired_at_chapter
    })),

    biography_seed: biographyEntries.map(e => ({
      age: e.origin_age ?? e.age ?? null,
      chapter: e.origin_chapter ?? e.chapter ?? null,
      text: e.body || e.content || ''
    })).filter(e => e.text && e.text.trim()),

    canon_npcs: canonNpcs.map(n => ({
      id: n.id, name: n.name, relationship: n.relationship,
      status: n.status, age_at_prelude_end: n.age_at_prelude_end,
      description: n.description, first_appeared_age: n.first_appeared_age
    })),
    canon_locations: canonLocations.map(l => ({
      id: l.id, name: l.name, type: l.type,
      description: l.description, is_home: !!l.is_home
    })),
    canon_threads: canonThreads.map(t => ({
      id: t.id, kind: t.kind, weight: t.weight,
      subject_npc_id: t.subject_npc_id, subject_location_id: t.subject_location_id,
      subject_text: t.subject_text, condition: t.condition
    })),

    mentor_imprint_eligible: mentorImprintEligible,

    // --- additional helper fields chunk 5 + transition screen consume ----
    // Confidence scores derived from chapter-weighted tallies — chunk 5's
    // celebration cards use these to render "we're sure" / "soft suggestion"
    // visual weight.
    class_score: classWinner?.score ?? null,
    ancestry_score: ancestryWinner?.score ?? null,
    // Departure context — chunk 5 surfaces this in Step 8 and the
    // primary-campaign generator reads it for the campaign opener.
    departure_summary: arcPlan?.chapter_3_arc?.departure_seed || arcPlan?.departure_seed || null,
    // Authority-figure label, for surfacing in the transition screen + Step 1.
    authority_label: authority?.label || null,
    authority_figure: setup.authority_figure || null,
    // Setup context — chunk 5 Step 1 / Step 7 surface these as inert
    // background ("born in X").
    home_region: setup.region || null,
    home_setting: setup.home_setting || null,
    // Mentor imprint id — null when ineligible OR when seeding was a no-op
    // on a refresh run. Eligibility above is the boolean; this is the
    // pointer to the row when seeded.
    mentor_imprint_id: mentorImprintId,
    // Canonical fact count — chunk 5 doesn't render facts directly (they
    // flow through canon_npcs / canon_locations), but the count is useful
    // for "X facts the world remembers" type surfacing.
    canon_fact_count: canonFacts.length,
    // Name parts — characters table stores first/last/nickname separately.
    // Surfaced for the Step 1 form fields; `name` above is the effective
    // joined string per §8.2.1.
    name_parts: {
      first_name: character.first_name || setup.first_name || null,
      last_name: character.last_name || setup.last_name || null,
      nickname: character.nickname || null
    }
  };
}

function composeName(first, last) {
  const a = (first || '').trim();
  const b = (last || '').trim();
  if (a && b) return `${a} ${b}`;
  return a || b || null;
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

  const raw = await loggedChat(
    { call_purpose: 'prelude_handoff_biography_gen', prompt_builder: 'preludeTransitionService',
      character_id: character?.id, campaign_id: character?.campaign_id },
    sysPrompt, [{ role: 'user', content: userPrompt }], 3, 'opus', 4096, true
  );
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

// ---------------------------------------------------------------------------
// Test-only exports — internal helpers exposed for unit testing without
// requiring DB + Opus round-trip. Not part of the public API.
// ---------------------------------------------------------------------------

export const __testkit__buildHandoffPayload = buildHandoffPayload;
export const __testkit__pickChapterBeatsByKind = pickChapterBeatsByKind;
export const __testkit__buildAcceptedStatBumps = buildAcceptedStatBumps;
export const __testkit__buildAcceptedSkillBumps = buildAcceptedSkillBumps;
