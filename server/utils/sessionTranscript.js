/**
 * Session transcript helpers.
 *
 * `dm_sessions.messages` is the LLM-facing conversation array — it gets
 * compacted when the rolling summary fires (older messages → synthetic
 * "PREVIOUS SCENES — SUMMARY" block). That's correct for LLM prompt
 * budgeting, but it's the WRONG source of truth for "what happened in
 * this session."
 *
 * `dm_sessions.transcript` (added in migration 046) is the append-only
 * full record. This module owns the read/write contract.
 *
 * USAGE PATTERN PER TURN:
 *   1. Take the current LLM-facing messages array (which may already be
 *      compacted by the rolling summary — that's fine).
 *   2. Identify the NEW user + assistant pair that just happened this
 *      turn.
 *   3. Call `appendToTranscript(sessionId, [newUserMsg, newAssistantMsg])`.
 *
 * The helper is idempotent on read failures: if `transcript` is null, it
 * initializes from the current `messages` blob as a one-time baseline
 * (better than starting empty mid-session). Going forward, only the new
 * messages are appended, regardless of compaction.
 */

import { dbGet, dbRun } from '../database.js';
import { safeParse } from './safeParse.js';

/**
 * Read the full transcript for a session. Returns the parsed array, or
 * an empty array if the session has no transcript yet.
 *
 * @param {number|string} sessionId
 * @returns {Promise<Array>}
 */
export async function getTranscript(sessionId) {
  const row = await dbGet(
    `SELECT transcript FROM dm_sessions WHERE id = ?`,
    [sessionId]
  );
  if (!row || !row.transcript) return [];
  return safeParse(row.transcript, []);
}

/**
 * Get the current transcript turn count — number of assistant turns
 * recorded. This is the AUTHORITATIVE turn counter for a session,
 * unaffected by rolling-summary compaction. Use this in the playtest
 * logger and anywhere else "what turn number is this really" matters.
 *
 * @param {number|string} sessionId
 * @returns {Promise<number>}
 */
export async function getTurnCount(sessionId) {
  const transcript = await getTranscript(sessionId);
  return transcript.filter(m => m.role === 'assistant').length;
}

/**
 * Append new messages to the session's transcript. The transcript is
 * append-only — never compacted, never overwritten. If this is the
 * first append after the migration (transcript is NULL), bootstrap from
 * the current `messages` array as the baseline so the player keeps
 * whatever fragmentary history was there pre-migration.
 *
 * @param {number|string} sessionId
 * @param {Array} newMessages — the user + assistant pair from this turn
 *                              (or any subset; usually 2)
 */
export async function appendToTranscript(sessionId, newMessages) {
  if (!Array.isArray(newMessages) || newMessages.length === 0) return;

  const row = await dbGet(
    `SELECT transcript, messages FROM dm_sessions WHERE id = ?`,
    [sessionId]
  );
  if (!row) return;

  let current;
  if (row.transcript) {
    current = safeParse(row.transcript, []);
  } else {
    // Bootstrap: copy whatever's currently in `messages` so we don't
    // start the transcript from zero mid-session. Strip system messages
    // — those rebuild per-turn and don't belong in the transcript.
    const messagesBootstrap = safeParse(row.messages, []);
    current = messagesBootstrap.filter(m => m.role !== 'system');
  }

  const filteredNew = newMessages.filter(m => m && m.role && m.role !== 'system');
  const updated = [...current, ...filteredNew];

  await dbRun(
    `UPDATE dm_sessions SET transcript = ? WHERE id = ?`,
    [JSON.stringify(updated), sessionId]
  );
}

/**
 * Initialize the transcript for a freshly-started session. Called by
 * the start-session paths so the opening assistant message is captured
 * from turn 0.
 *
 * @param {number|string} sessionId
 * @param {Array} initialMessages — typically [opening_assistant] for a
 *                                   fresh prelude, or [user, assistant]
 *                                   for a fresh main-campaign session
 */
export async function initTranscript(sessionId, initialMessages) {
  const filtered = (initialMessages || []).filter(m => m && m.role && m.role !== 'system');
  await dbRun(
    `UPDATE dm_sessions SET transcript = ? WHERE id = ?`,
    [JSON.stringify(filtered), sessionId]
  );
}
