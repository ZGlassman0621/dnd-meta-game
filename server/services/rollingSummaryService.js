/**
 * Rolling Session Summary Service
 *
 * Proactive, incremental compression of session message history. Replaces the
 * reactive "panic-summarize when context overflows" approach with a steady
 * background process: every few turns we roll up the oldest exchanges into a
 * prose summary while keeping the recent tail verbatim.
 *
 * Rules of the road:
 *   KEEP_TAIL_MESSAGES — never summarize the last N messages. The model
 *     needs recent turns in full to stay coherent on immediate context.
 *   ROLL_TRIGGER_THRESHOLD — only consider rolling when messages.length
 *     exceeds this number. Below the threshold the prompt is already short
 *     enough that no compression helps.
 *   ROLL_CHUNK_SIZE — when we roll, summarize this many additional messages
 *     into the existing summary (or create a fresh summary if none exists).
 *
 * Flow per turn (called from dmSession.js /message handler after the AI
 * response is saved):
 *   1. Load session.messages and session.rolling_summary fields.
 *   2. If shouldRoll() returns true, fire-and-forget rollSummary().
 *   3. rollSummary() takes the next ROLL_CHUNK_SIZE of not-yet-summarized
 *      messages, sends them + the existing summary to Sonnet, asks for an
 *      updated summary, and writes the result back to dm_sessions.
 *
 * Flow when assembling the NEXT prompt:
 *   1. Call applyToMessages(session, messages) to get { messages, summary }.
 *   2. If summary is set, prepend it to the conversation as a synthetic
 *      "[PREVIOUS SCENES — SUMMARY]" user message, then include only the
 *      kept-verbatim tail.
 *
 * Never blocks: the Sonnet summarization call runs after the player's turn
 * completes. If the call fails, the session continues unchanged and we try
 * again next turn.
 */

import { dbGet, dbRun } from '../database.js';
import * as claude from './claude.js';

// Tunable constants. Chosen conservatively — err toward keeping more context
// verbatim. Can be tightened later once we observe real session shapes.
export const KEEP_TAIL_MESSAGES = 16;       // keep last 16 messages verbatim (~8 exchanges)
export const ROLL_TRIGGER_THRESHOLD = 30;   // start rolling once we pass this
export const ROLL_CHUNK_SIZE = 8;           // summarize this many each roll
export const MIN_ROLL_AGE_MESSAGES = 4;     // don't roll the same chunk twice in quick succession

/**
 * Decide whether the session is ripe for a rolling-summary update. Pure
 * function — does not hit the database beyond the already-loaded session row.
 */
export function shouldRoll(session, messages) {
  if (!Array.isArray(messages)) return false;
  if (messages.length < ROLL_TRIGGER_THRESHOLD) return false;

  const throughIdx = Number.isInteger(session?.rolling_summary_through_index)
    ? session.rolling_summary_through_index
    : -1;

  // Number of messages after the existing summary, minus the tail we always keep.
  const summarizableCount = (messages.length - KEEP_TAIL_MESSAGES) - (throughIdx + 1);
  return summarizableCount >= MIN_ROLL_AGE_MESSAGES;
}

/**
 * Build the Sonnet prompt that produces (or updates) the rolling summary.
 * Uses a compact template — the model knows the format and we want a low-
 * cost generation call.
 *
 * Template branches on `sessionType`:
 *   - Default (adventure sessions): prioritizes plot, combat, quests, items.
 *   - 'prelude_arc': prioritizes character development, relationships,
 *     values-forming choices, emotional texture — the stuff of growing up.
 *     Plot-of-the-day beats are less important than WHO the character is
 *     becoming and WHICH relationships shifted.
 */
function buildSummaryPrompt(existingSummary, newMessages, sessionType = 'player') {
  const transcript = newMessages
    .map(m => {
      if (m.role === 'system') return null;
      const speaker = m.role === 'assistant' ? 'DM' : 'Player';
      const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return `${speaker}: ${text}`;
    })
    .filter(Boolean)
    .join('\n\n');

  const priorBlock = existingSummary
    ? `SUMMARY SO FAR:\n${existingSummary}\n\n`
    : '';

  if (sessionType === 'prelude_arc') {
    return `You are maintaining a rolling summary for a D&D prelude arc — a character's childhood played across 5 sessions (Ch1: 1, Ch2: 1, Ch3: 2, Ch4: 1). Your output is read ONLY by the AI DM (Sonnet), never by the player. Be dense, factual, and weighted toward what matters for CHARACTER DEVELOPMENT.

${priorBlock}NEW EXCHANGES TO INTEGRATE:
${transcript}

Produce an updated SUMMARY SO FAR that prioritizes, in order:
1. **Character development moments** — what the character learned, how they reacted under pressure, what they've started to believe or reject.
2. **Relationship shifts** — changes in how the character relates to family, mentors, rivals, friends. Name NPCs explicitly.
3. **Values-forming choices** — non-binary decisions the character made and what they revealed. (E.g., "Lied to protect Rook despite Halda's warnings" — values the character is accruing: loyalty, defiance.)
4. **Emotional texture** — what carries forward emotionally: grief unhealed, a secret held, a friendship cooling, a resentment growing.
5. **Plot beats** only to the extent they shaped the above. Don't enumerate "each errand run."
6. **Time elapsed** — if [AGE_ADVANCE] fired, note the current age.

Style:
• Past tense, second person matches the session voice but is NOT required here — concise third-person fragments work ("Bought the half-loaf. Moira's hands trembled for the first time.").
• Under 600 words total — condense older material if the summary grows.
• Preserve every named NPC the character has actually interacted with.
• Drop purely atmospheric description unless it signaled emotional weight.
• Do NOT restate rules, DC values, marker schemas, or arc-plan content.

Write only the updated summary. No preamble, no commentary.`;
  }

  // Default (adventure / player) template
  return `You are maintaining a rolling session summary for an ongoing D&D text adventure. Your output is read ONLY by the AI DM, never by the player — be dense and factual rather than narrative.

${priorBlock}NEW EXCHANGES TO INTEGRATE:
${transcript}

Produce an updated SUMMARY SO FAR that:
• Incorporates the new exchanges above
• Preserves every concrete fact: named NPCs, locations, items gained/lost, promises made/kept, combat outcomes, deaths, key decisions, discovered clues
• Drops purely atmospheric description (weather, scene dressing) unless it signalled a plot beat
• Uses past tense, third person (the party did X, the blacksmith said Y)
• Keeps length under 600 words total — condense older material if the summary grows too long
• Does NOT restate the DM's rules, NPC voice palettes, or marker schemas — those live in the system prompt

Write only the updated summary. No preamble, no commentary.`;
}

/**
 * Roll the summary forward by one chunk. Fire-and-forget from the caller's
 * perspective — errors are logged but never thrown. Idempotent when the
 * same session state is passed in (but normally called once per turn).
 *
 * @param {number} sessionId
 * @param {object} session — the dm_sessions row (needs rolling_summary + rolling_summary_through_index)
 * @param {Array}  messages — the full messages array (including system at index 0)
 */
export async function rollSummary(sessionId, session, messages) {
  if (!sessionId || !Array.isArray(messages)) return null;
  if (!shouldRoll(session, messages)) return null;
  if (!claude.isClaudeAvailable()) return null; // Ollama fallback is too noisy for summarization

  try {
    const prevThroughIdx = Number.isInteger(session?.rolling_summary_through_index)
      ? session.rolling_summary_through_index
      : -1;
    const startIdx = prevThroughIdx + 1;
    // Never touch the first message (system prompt) or the tail
    const firstSummarizable = Math.max(startIdx, 1);
    const tailStart = messages.length - KEEP_TAIL_MESSAGES;
    const endIdxExclusive = Math.min(firstSummarizable + ROLL_CHUNK_SIZE, tailStart);
    if (endIdxExclusive <= firstSummarizable) return null;

    const chunk = messages.slice(firstSummarizable, endIdxExclusive);
    if (chunk.length === 0) return null;

    const existing = session?.rolling_summary || null;
    const sessionType = session?.session_type || 'player';
    const systemPrompt = 'You are a concise, factual summarizer. Output only the requested summary with no preamble or commentary.';
    const userPrompt = buildSummaryPrompt(existing, chunk, sessionType);

    const updated = await claude.chat(
      systemPrompt,
      [{ role: 'user', content: userPrompt }],
      2,       // retries — summarization isn't critical, keep retry budget small
      'sonnet',
      1500     // max_tokens — plenty for a ~600-word summary
    );

    if (!updated || typeof updated !== 'string' || updated.trim().length < 30) {
      // Something went wrong — don't save a degenerate summary
      console.warn(`[rolling-summary] session ${sessionId}: degenerate summary, skipping save`);
      return null;
    }

    const newThroughIdx = endIdxExclusive - 1;
    await dbRun(
      `UPDATE dm_sessions
       SET rolling_summary = ?,
           rolling_summary_through_index = ?,
           rolling_summary_updated_at = datetime('now')
       WHERE id = ?`,
      [updated.trim(), newThroughIdx, sessionId]
    );

    console.log(
      `[rolling-summary] session ${sessionId}: rolled ${chunk.length} messages (through index ${newThroughIdx}), summary now ${updated.length} chars`
    );
    return { summary: updated.trim(), throughIndex: newThroughIdx };
  } catch (err) {
    console.warn(`[rolling-summary] session ${sessionId}: roll failed — ${err.message}`);
    return null;
  }
}

/**
 * Produce a compacted messages array for the next LLM call, using the
 * session's stored rolling summary (if any). The returned array replaces
 * the summarized prefix with a synthetic "PREVIOUS SCENES — SUMMARY" user
 * message immediately after the system prompt.
 *
 * Shape of return value:
 *   {
 *     messages: Array,          // compacted messages to send to the LLM
 *     summaryInjected: boolean, // true if a summary was prepended
 *     originalCount: number,    // the length of the input messages
 *     finalCount: number        // the length of the returned messages
 *   }
 *
 * Pure — never touches the DB.
 */
export function applyToMessages(session, messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { messages, summaryInjected: false, originalCount: messages?.length || 0, finalCount: messages?.length || 0 };
  }
  const summary = session?.rolling_summary;
  const throughIdx = Number.isInteger(session?.rolling_summary_through_index)
    ? session.rolling_summary_through_index
    : -1;
  if (!summary || throughIdx < 1) {
    return { messages, summaryInjected: false, originalCount: messages.length, finalCount: messages.length };
  }

  // Safety: if the stored throughIdx somehow points past the end of the
  // current messages (shouldn't happen but sessions can drift), fall back
  // to skipping the summary injection entirely.
  if (throughIdx >= messages.length - 1) {
    return { messages, summaryInjected: false, originalCount: messages.length, finalCount: messages.length };
  }

  const systemMsg = messages[0].role === 'system' ? messages[0] : null;
  const tail = messages.slice(throughIdx + 1);
  const synthetic = {
    role: 'user',
    content: `[PREVIOUS SCENES — SUMMARY OF EARLIER IN THIS SESSION]\n\n${summary}\n\n(The scenes above have already happened. Below are the most recent exchanges, continued from where that summary ends.)`
  };

  const compacted = systemMsg
    ? [systemMsg, synthetic, ...tail.filter(m => m.role !== 'system')]
    : [synthetic, ...tail];

  return {
    messages: compacted,
    summaryInjected: true,
    originalCount: messages.length,
    finalCount: compacted.length
  };
}

/**
 * Read-only fetch of the stored summary. Convenience for tests / admin views.
 */
export async function getSummary(sessionId) {
  try {
    const row = await dbGet(
      `SELECT rolling_summary, rolling_summary_through_index, rolling_summary_updated_at
       FROM dm_sessions WHERE id = ?`,
      [sessionId]
    );
    return row || null;
  } catch (err) {
    return null;
  }
}
