/**
 * Context Window Manager
 *
 * Manages AI context budget for DM sessions. Estimates token usage,
 * determines when message compression is needed, and handles sliding
 * window compression of older messages.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { chat } from '../services/claude.js';

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
 * Get model-specific context limits
 * @param {string} model - Model identifier
 * @returns {{ contextWindow: number, safeBudget: number }}
 */
export function getModelLimits(model) {
  if (model && model.includes('gemma')) {
    return { contextWindow: 8192, safeBudget: 6000 };
  }
  if (model && (model.includes('llama') || model.includes('mistral'))) {
    return { contextWindow: 8192, safeBudget: 6000 };
  }
  // Claude Opus/Sonnet — 200K context
  return { contextWindow: 200000, safeBudget: 180000 };
}

/**
 * Calculate adaptive chronicle budget based on remaining context space
 *
 * @param {number} systemPromptTokens - Estimated tokens in system prompt
 * @param {number} conversationTokens - Estimated tokens in message history
 * @param {string} model - Model identifier
 * @returns {number} Token budget available for chronicle context (2000+, no hard cap)
 */
export function calculateChronicleBudget(systemPromptTokens, conversationTokens, model) {
  const { safeBudget } = getModelLimits(model);
  const responseBuffer = 10000; // Reserve for AI response

  const remaining = safeBudget - systemPromptTokens - conversationTokens - responseBuffer;

  if (remaining <= 0) {
    return 2000; // Minimum guaranteed budget
  }

  // Use 40% of remaining space for chronicle — no hard cap, let the context window be the limit
  const budget = Math.floor(remaining * 0.4);
  return Math.max(2000, budget);
}

/**
 * Check if message history needs compression
 *
 * @param {Array} messages - Message array
 * @param {string} model - Model identifier
 * @returns {{ needsCompression: boolean, urgency: string|null, totalTokens: number }}
 */
export function shouldCompress(messages, model) {
  const { safeBudget } = getModelLimits(model);

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
 * @param {string} model - Model being used (for API calls)
 * @returns {Array} Compressed message array
 */
export async function compressMessageHistory(messages, sessionId, model) {
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
    summaryText = await generateMessageSummary(oldMessages, model);

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
 * @param {string} model - Model to use for summarization
 * @returns {string} Compressed summary
 */
async function generateMessageSummary(messages, model) {
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

  const response = await chat(
    summaryPrompt,
    [{ role: 'user', content: input }],
    2, // fewer retries for background task
    model === 'opus' ? 'sonnet' : 'sonnet', // Always use Sonnet for compression
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
  compressMessageHistory
};
