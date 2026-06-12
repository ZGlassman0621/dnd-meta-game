/**
 * Context Window Manager
 *
 * Manages AI context budget for DM sessions. Estimates token usage,
 * determines when message compression is needed, and handles sliding
 * window compression of older messages.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { chat } from '../services/claude.js';
import { loggedChat } from '../services/aiCallLogger.js';

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

// Above this many chars we MAP-REDUCE instead of single-shotting — and we never
// delete the middle. The prior implementation spliced head (first 14k) + tail
// (last 14k) and dropped everything between, silently losing any death, promise,
// or item that lived only in the middle of a long session.
const SUMMARY_SINGLE_SHOT_CHARS = 30000;
const SUMMARY_CHUNK_CHARS = 24000;   // target transcript chars per map chunk
const SUMMARY_MAX_CHUNKS = 8;        // cap LLM map calls; grow chunk size past this

const MESSAGE_SUMMARY_PROMPT = `Summarize this D&D session conversation into a concise recap (300-500 words). Include:
- Key events and decisions the player made
- Important NPCs encountered and what happened with them
- Combat outcomes
- Items gained, lost, or used
- Current situation and location
- Any promises made or quests accepted/progressed
- Emotional tone and mood of the session

Write as a factual recap, not as narrative. Focus on information the DM needs to maintain continuity.`;

/**
 * Split messages into contiguous chunks whose joined transcript stays under
 * maxChars, breaking ONLY on message boundaries. Pure + deterministic — exported
 * for unit testing. A single message longer than maxChars becomes its own chunk.
 *
 * @param {Array} messages
 * @param {number} maxChars
 * @returns {Array<Array>} array of message-array chunks
 */
export function chunkMessagesByChars(messages, maxChars) {
  const chunks = [];
  let cur = [];
  let curLen = 0;
  for (const m of (messages || [])) {
    const lineLen = String(m?.content ?? '').length + 8; // + role label + separators
    if (cur.length > 0 && curLen + lineLen > maxChars) {
      chunks.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(m);
    curLen += lineLen;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks;
}

function messagesToTranscript(messages) {
  return messages
    .map(m => `${m.role === 'user' ? 'PLAYER' : 'DM'}: ${m.content}`)
    .join('\n\n');
}

async function summarizeText(input) {
  return loggedChat(
    { call_purpose: 'context_compression', prompt_builder: 'contextManager' },
    MESSAGE_SUMMARY_PROMPT,
    [{ role: 'user', content: input }],
    2,         // fewer retries for background task
    'sonnet',  // always Sonnet for compression
    1500,
    true       // raw response
  );
}

/**
 * Generate a compressed summary of older messages.
 *
 * Short transcript → one summarization call. Long transcript → MAP-REDUCE: chunk
 * the messages on their boundaries, summarize each chunk, then fold the partial
 * recaps into one. This preserves the MIDDLE of a long session rather than
 * splicing it out (the old head+tail truncation dropped load-bearing canon).
 *
 * @param {Array} messages - Messages to summarize
 * @param {string} model - retained for signature compatibility (compression is always Sonnet)
 * @returns {Promise<string>} Compressed summary
 */
async function generateMessageSummary(messages, model) {
  const full = messagesToTranscript(messages);
  if (full.length <= SUMMARY_SINGLE_SHOT_CHARS) {
    return summarizeText(full);
  }

  // Map: chunk on message boundaries (nothing deleted). Cap the number of map
  // calls by growing the chunk size if the session is enormous.
  let chunkChars = SUMMARY_CHUNK_CHARS;
  let chunks = chunkMessagesByChars(messages, chunkChars);
  while (chunks.length > SUMMARY_MAX_CHUNKS) {
    chunkChars = Math.ceil(chunkChars * 1.5);
    chunks = chunkMessagesByChars(messages, chunkChars);
  }

  const partials = [];
  for (let i = 0; i < chunks.length; i++) {
    const part = await summarizeText(messagesToTranscript(chunks[i]));
    if (part && part.trim()) partials.push(`Part ${i + 1} of ${chunks.length}:\n${part.trim()}`);
  }
  if (partials.length === 0) return '';
  if (partials.length === 1) return partials[0].replace(/^Part \d+ of \d+:\n/, '');

  // Reduce: fold the partial recaps into one cohesive recap. If the partials are
  // somehow still huge, return them concatenated rather than dropping anything —
  // completeness beats brevity for a continuity recap.
  const combined = partials.join('\n\n');
  if (combined.length <= SUMMARY_SINGLE_SHOT_CHARS) {
    return summarizeText(combined);
  }
  return combined;
}

export default {
  estimateTokens,
  getModelLimits,
  calculateChronicleBudget,
  shouldCompress,
  compressMessageHistory
};
