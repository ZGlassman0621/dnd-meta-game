/**
 * Context Window Manager
 *
 * Manages AI context budget for DM sessions. Estimates token usage,
 * determines when message compression is needed, and handles sliding
 * window compression of older messages.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { loggedChat } from '../services/aiCallLogger.js';
import { contextWindow } from '../services/localModels.js';

/**
 * Rough token estimation (chars / 4)
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Share of the context window the prompt + history may use. The rest is
 * headroom for the reply (the DM turn ceiling is 4,000 tokens) and for the
 * chars/4 estimate running low on some text.
 */
export const SAFE_BUDGET_SHARE = 0.85;

/**
 * Context limits for the local model, from the window actually sent to Ollama
 * (localModels.contextWindow(): OLLAMA_NUM_CTX, default 65,536 — measured to
 * fit the default model fully on the GPU of the builder PC, 2026-11-13).
 *
 * Re-based in the local-model-only job. The old numbers assumed a 1M-token
 * cloud window (900,000 safe) and treated any "gemma" model as an 8,192 window —
 * both wrong for the default local model, whose limit is 262,144 and whose working
 * window is whatever num_ctx says. Every role runs at the same window, so this
 * takes no model argument.
 * @returns {{ contextWindow: number, safeBudget: number }}
 */
export function getModelLimits() {
  const window = contextWindow();
  return { contextWindow: window, safeBudget: Math.floor(window * SAFE_BUDGET_SHARE) };
}

/**
 * Hard ceiling on canon-fact context, regardless of how much room appears free.
 *
 * Without this the function is fed only a few hundred tokens of input (world
 * state + notes + memories) and so could hand back a budget large enough that
 * canon facts alone crowd out the rest of the prompt. The caller's estimate being incomplete stops
 * mattering once the output itself is bounded, which is why this cap exists
 * rather than a more precise input measurement.
 */
export const MAX_CHRONICLE_BUDGET = 20000;

/**
 * Render-time caps for append-only character text. campaign_notes and
 * character_memories grow without bound on disk (by design — full history
 * is kept); these bound only what the AI sees per session. Both logs
 * append newest-last, so the tail is the highest-value slice.
 */
export const MAX_NOTES_TOKENS = 4000;
export const MAX_MEMORIES_TOKENS = 2000;

/**
 * Slice the tail of a long text to a token budget, cutting at a line
 * boundary so we never start mid-line. Prepends an omission marker when
 * truncation occurs so the reader knows older entries exist but aren't shown.
 */
export function sliceTailByTokens(text, tokenBudget) {
  if (!text) return '';
  if (estimateTokens(text) <= tokenBudget) return text;
  const maxChars = tokenBudget * 4;
  let start = text.length - maxChars;
  const newlineIdx = text.indexOf('\n', start);
  if (newlineIdx !== -1) start = newlineIdx + 1;
  return `[earlier entries omitted \u2014 showing the most recent ~${tokenBudget} tokens]\n` + text.slice(start);
}

/**
 * Calculate adaptive chronicle budget based on remaining context space
 *
 * @param {number} systemPromptTokens - Estimated tokens in system prompt
 * @param {number} conversationTokens - Estimated tokens in message history
 * @returns {number} Token budget for chronicle context, between 2000 and MAX_CHRONICLE_BUDGET
 */
export function calculateChronicleBudget(systemPromptTokens, conversationTokens) {
  const { safeBudget } = getModelLimits();
  const responseBuffer = 10000; // Reserve for AI response

  const remaining = safeBudget - systemPromptTokens - conversationTokens - responseBuffer;

  if (remaining <= 0) {
    return 2000; // Minimum guaranteed budget
  }

  // Use 40% of remaining space, then clamp. At the default 65,536 window and a
  // ~13k-token DM prompt this lands around 13k — under the 20k cap.
  const budget = Math.floor(remaining * 0.4);
  return Math.min(MAX_CHRONICLE_BUDGET, Math.max(2000, budget));
}

/**
 * Check if message history needs compression
 *
 * @param {Array} messages - Message array
 * @returns {{ needsCompression: boolean, urgency: string|null, totalTokens: number }}
 */
export function shouldCompress(messages) {
  const { safeBudget } = getModelLimits();

  let totalTokens = 0;
  for (const msg of messages) {
    totalTokens += estimateTokens(msg.content);
  }

  const ratio = totalTokens / safeBudget;

  if (ratio >= 0.85) {
    return { needsCompression: true, urgency: 'critical', totalTokens };
  }
  if (ratio >= 0.70) {
    return { needsCompression: true, urgency: 'warning', totalTokens };
  }

  return { needsCompression: false, urgency: null, totalTokens };
}

/**
 * Compress message history using sliding window + AI summarization
 *
 * Keeps:
 * - System prompt (always)
 * - Last 20 messages verbatim
 * - Older messages compressed into summaries
 *
 * @param {Array} messages - Full message array
 * @param {number} sessionId - Session ID for storing summaries
 * @returns {Array} Compressed message array
 */
export async function compressMessageHistory(messages, sessionId) {
  // Separate system messages and conversation messages
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  // If 20 or fewer conversation messages, no compression needed
  if (conversationMessages.length <= 20) {
    return messages;
  }

  // Keep last 20 messages verbatim
  const keepCount = 20;
  const oldMessages = conversationMessages.slice(0, -keepCount);
  const recentMessages = conversationMessages.slice(-keepCount);

  // Check if we already have a summary for this range
  const rangeEnd = oldMessages.length;
  const existingSummary = await dbGet(
    'SELECT summary, message_range_end FROM session_message_summaries WHERE session_id = ? AND message_range_end >= ? ORDER BY message_range_end DESC LIMIT 1',
    [sessionId, rangeEnd - 5] // Allow some overlap
  );

  let summaryText;

  if (existingSummary && existingSummary.message_range_end >= rangeEnd - 2) {
    // Reuse existing summary if it covers most of the range
    summaryText = existingSummary.summary;
  } else {
    // Generate new summary via AI
    summaryText = await generateMessageSummary(oldMessages);

    // Store for future reuse
    const tokenEstimate = estimateTokens(summaryText);
    await dbRun(
      'INSERT INTO session_message_summaries (session_id, message_range_start, message_range_end, summary, token_estimate) VALUES (?, ?, ?, ?, ?)',
      [sessionId, 0, rangeEnd, summaryText, tokenEstimate]
    );
  }

  // Build compressed message array
  const compressed = [
    ...systemMessages,
    {
      role: 'user',
      content: `[CONTEXT: Summary of earlier conversation]\n${summaryText}\n[END CONTEXT — conversation continues below]`
    },
    {
      role: 'assistant',
      content: 'I understand the context from our earlier conversation. Let me continue from where we left off.'
    },
    ...recentMessages
  ];

  return compressed;
}

/**
 * Generate a compressed summary of older messages
 * @param {Array} messages - Messages to summarize
 * @returns {string} Compressed summary
 */
async function generateMessageSummary(messages) {
  const transcript = messages
    .map(m => `${m.role === 'user' ? 'PLAYER' : 'DM'}: ${m.content}`)
    .join('\n\n');

  // Truncate if extremely long (focus on beginning and end)
  let input = transcript;
  if (input.length > 30000) {
    const half = 14000;
    input = input.substring(0, half) + '\n\n[...middle portion omitted for brevity...]\n\n' + input.substring(input.length - half);
  }

  const summaryPrompt = `Summarize this D&D session conversation into a concise recap (300-500 words). Include:
- Key events and decisions the player made
- Important NPCs encountered and what happened with them
- Combat outcomes
- Items gained, lost, or used
- Current situation and location
- Any promises made or quests accepted/progressed
- Emotional tone and mood of the session

Write as a factual recap, not as narrative. Focus on information the DM needs to maintain continuity.`;

  const response = await loggedChat(
    { call_purpose: 'context_compression', prompt_builder: 'contextManager' },
    summaryPrompt,
    [{ role: 'user', content: input }],
    2, // fewer retries for background task
    'summary',
    1500,
    true // raw response
  );

  return response;
}

export default {
  estimateTokens,
  getModelLimits,
  calculateChronicleBudget,
  shouldCompress,
  compressMessageHistory,
  sliceTailByTokens,
  SAFE_BUDGET_SHARE,
  MAX_CHRONICLE_BUDGET,
  MAX_NOTES_TOKENS,
  MAX_MEMORIES_TOKENS
};
