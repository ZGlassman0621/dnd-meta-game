/**
 * Prelude canon thread service.
 *
 * Phase 2 chunk 4. Persists [CANON_THREAD] markers fired during Prelude
 * play into the `prelude_canon_threads` table. Threads are unresolved
 * narrative obligations the world will hold across years of main-campaign
 * time; chunk 2 (transition service) transfers active threads into
 * `campaign_threads` at handoff.
 *
 * See Phase 1 Decision 6 (DECISION_LOG 2026-04-29) for the design and
 * PRELUDE_IMPLEMENTATION_PLAN.md §3d / §5h for the marker semantics.
 *
 * Subject resolution: when a [CANON_THREAD] arrives, we attempt to bind
 * its subject string to an existing prelude_canon_npcs or
 * prelude_canon_locations row. If neither matches, the subject is stored
 * as free text in `subject_text`. This keeps the thread record useful
 * even when the AI references an entity that was never explicitly
 * established with [NPC_CANON] / [LOCATION_CANON].
 */

import { dbAll, dbGet, dbRun } from '../database.js';

const VALID_KINDS = [
  'unresolved_loss',
  'blood_debt',
  'unfulfilled_oath',
  'unpaid_crime',
  'unfinished_relationship',
  'held_object',
  'held_secret'
];

const VALID_WEIGHTS = ['minor', 'notable', 'major'];

const VALID_STATUSES = ['active', 'ripened', 'resolved', 'decayed'];

/**
 * Look up an NPC by case-insensitive name match for the given character.
 * Returns the row or null.
 */
async function findNpcByName(characterId, name) {
  if (!name) return null;
  return dbGet(
    `SELECT id, name FROM prelude_canon_npcs
     WHERE character_id = ? AND LOWER(name) = LOWER(?)`,
    [characterId, name]
  );
}

/**
 * Look up a location by case-insensitive name match for the given
 * character. Returns the row or null.
 */
async function findLocationByName(characterId, name) {
  if (!name) return null;
  return dbGet(
    `SELECT id, name FROM prelude_canon_locations
     WHERE character_id = ? AND LOWER(name) = LOWER(?)`,
    [characterId, name]
  );
}

/**
 * Persist a [CANON_THREAD]. Returns one of:
 *   { status: 'inserted', id, kind, weight, subject_kind: 'npc'|'location'|'text' }
 *   { status: 'invalid_kind', reason }      — kind not in enum
 *   { status: 'invalid_weight', reason }    — weight not in enum
 *
 * The session service surfaces invalid_* statuses as cap violations so
 * the AI gets [SYSTEM] feedback.
 *
 * Subject resolution: tries NPC name → location name → falls back to
 * subject_text. The thread is bound to whichever entity matched, or just
 * stored as free text.
 */
export async function recordCanonThread(characterId, { kind, subject, condition, weight, sessionId, age, chapter, description }) {
  const normKind = String(kind || '').toLowerCase();
  if (!VALID_KINDS.includes(normKind)) {
    return { status: 'invalid_kind', reason: `Unknown thread kind "${kind}"; expected one of ${VALID_KINDS.join('/')}` };
  }
  const normWeight = String(weight || 'notable').toLowerCase();
  if (!VALID_WEIGHTS.includes(normWeight)) {
    return { status: 'invalid_weight', reason: `Unknown thread weight "${weight}"; expected minor/notable/major` };
  }

  // Subject resolution — try NPC, then location, then fall back to text.
  const npc = await findNpcByName(characterId, subject);
  const location = npc ? null : await findLocationByName(characterId, subject);
  const subjectText = (npc || location) ? null : (subject ? String(subject).trim() : null);

  const result = await dbRun(
    `INSERT INTO prelude_canon_threads
       (character_id, kind, subject_npc_id, subject_location_id, subject_text,
        condition, weight, status, created_at_age, created_at_chapter,
        session_id, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    [
      characterId,
      normKind,
      npc?.id || null,
      location?.id || null,
      subjectText,
      condition ? String(condition).trim() : null,
      normWeight,
      age ?? null,
      chapter ?? null,
      sessionId ?? null,
      description ? String(description).trim() : null
    ]
  );

  const subjectKind = npc ? 'npc' : (location ? 'location' : 'text');
  return {
    status: 'inserted',
    id: Number(result.lastInsertRowid),
    kind: normKind,
    weight: normWeight,
    subject_kind: subjectKind,
    subject: npc?.name || location?.name || subjectText
  };
}

/**
 * List active threads for a character. Used by chunk 2's transition
 * service to know which threads to transfer to campaign_threads at
 * handoff.
 */
export async function getActiveThreads(characterId) {
  return dbAll(
    `SELECT id, kind, subject_npc_id, subject_location_id, subject_text,
            condition, weight, status, created_at_age, created_at_chapter,
            description, created_at
     FROM prelude_canon_threads
     WHERE character_id = ? AND status = 'active'
     ORDER BY id ASC`,
    [characterId]
  );
}

/**
 * List ALL threads for a character (any status). Used by debug surfaces
 * and the transition screen summary.
 */
export async function getAllThreads(characterId) {
  return dbAll(
    `SELECT id, kind, subject_npc_id, subject_location_id, subject_text,
            condition, weight, status, created_at_age, created_at_chapter,
            description, created_at
     FROM prelude_canon_threads
     WHERE character_id = ?
     ORDER BY id ASC`,
    [characterId]
  );
}

/**
 * Update a thread's status. Used by the same Prelude session if the
 * arc resolves a thread mid-play (rare; usually threads carry into the
 * main campaign).
 */
export async function setThreadStatus(threadId, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid thread status "${status}"; expected one of ${VALID_STATUSES.join('/')}`);
  }
  await dbRun(
    `UPDATE prelude_canon_threads SET status = ? WHERE id = ?`,
    [status, threadId]
  );
}

export const _internals = {
  VALID_KINDS,
  VALID_WEIGHTS,
  VALID_STATUSES
};
