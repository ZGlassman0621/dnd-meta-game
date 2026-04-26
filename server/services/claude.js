/**
 * Claude API Service - Cloud LLM Integration for AI Dungeon Master
 *
 * Uses Anthropic's Claude API for high-quality text adventure DM sessions.
 * Requires ANTHROPIC_API_KEY environment variable.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
// Model aliases (no date suffix) auto-resolve to the latest *build* of a
// given major.minor version, but the major.minor itself is pinned — bump these
// manually when a new Claude release ships (e.g. 4-6 → 4-7).
const SONNET_MODEL = 'claude-sonnet-4-6';
const OPUS_MODEL = 'claude-opus-4-7';
const DEFAULT_MODEL = SONNET_MODEL;

// Prompt-cache configuration. Three tiers:
//   Tier 1 (universal static): Cardinal Rules + Craft + Conversation + examples
//     + mechanical markers + CHARACTER-DEFINING MOMENTS. Never changes.
//   Tier 2 (per-character static): world setting + character sheet + progression
//     + PLAYER NAME SPELLING. Changes on level-up / equipment swaps.
//   Tier 3 (dynamic, uncached): CAMPAIGN STRUCTURE + all live formatters
//     + NAMES_ALREADY_USED list + SELF-CHECK.
//
// The DM prompt builder embeds two markers:
//   <!-- CACHE_BREAK:AFTER_CORE -->       → end of tier 1
//   <!-- CACHE_BREAK:AFTER_CHARACTER -->  → end of tier 2
// claude.chat() splits on these markers and sends the system as a 3-block array
// with cache_control on blocks 0 and 1.
//
// Back-compat paths preserved:
//   • No markers → plain string (legacy behavior).
//   • Only AFTER_CORE marker → 2-block array (tier 1 cached, tier 2+3 together).
//   • Both markers → 3-block array (tier 1 + tier 2 cached, tier 3 fresh).
//   • Any tier below 1024 tokens → fall back to a single merged string so
//     Anthropic accepts the request (the cache minimum would reject it).
const CACHE_BREAK_CORE = '<!-- CACHE_BREAK:AFTER_CORE -->';
const CACHE_BREAK_CHARACTER = '<!-- CACHE_BREAK:AFTER_CHARACTER -->';
const CACHE_MIN_TOKENS = 1024; // Anthropic's cacheable-block minimum
const CACHE_MIN_CHARS = CACHE_MIN_TOKENS * 4; // rough char→token

// Running cache telemetry — flushed to stdout once per turn via logCacheStats().
// Not persisted anywhere; just observability.
let cumulativeCacheStats = {
  turns: 0,
  cacheCreated: 0,
  cacheRead: 0,
  inputFresh: 0,
  output: 0
};

// Cache TTL — Anthropic supports '5m' (default, 1.25× write cost) and '1h'
// (2× write cost). We use 1h for tier 1 because:
//   • DM sessions often have multi-minute gaps between turns (player reads
//     the response, thinks, types). With 5m TTL, the cache evicts mid-session
//     and we pay for full rebuild every ~5–6 turns. The 2× write cost is
//     amortized over 60 minutes vs 5 minutes — net cheaper for thoughtful play.
//   • Tier 2 (per-character) uses 5m. It's smaller and only caches across
//     same-character turns; the 1h premium isn't worth it.
//   • Cumulative session log on master/main showed turn-1 cache eviction
//     happening at t5, t11, t18, t27 — exactly the 5-minute boundaries.
const TIER1_CACHE_CONTROL = { type: 'ephemeral', ttl: '1h' };
const TIER2_CACHE_CONTROL = { type: 'ephemeral' };

function buildSystemParam(systemPrompt) {
  // Backward-compat: no system prompt or non-string → pass through unchanged.
  if (!systemPrompt || typeof systemPrompt !== 'string') return systemPrompt;

  const coreIdx = systemPrompt.indexOf(CACHE_BREAK_CORE);
  if (coreIdx < 0) return systemPrompt;

  const charIdx = systemPrompt.indexOf(CACHE_BREAK_CHARACTER);
  const haveCharBreak = charIdx > coreIdx;

  // Slice out each tier and strip the boundary whitespace so the concatenated
  // form reads naturally if we fall back to a string.
  const core = systemPrompt.slice(0, coreIdx).replace(/\n+$/, '');
  const afterCore = haveCharBreak
    ? systemPrompt.slice(coreIdx + CACHE_BREAK_CORE.length, charIdx).replace(/^\n+|\n+$/g, '')
    : systemPrompt.slice(coreIdx + CACHE_BREAK_CORE.length).replace(/^\n+/, '');
  const afterChar = haveCharBreak
    ? systemPrompt.slice(charIdx + CACHE_BREAK_CHARACTER.length).replace(/^\n+/, '')
    : null;

  const coreBigEnough = core.length >= CACHE_MIN_CHARS;
  const afterCoreBigEnough = afterCore.length >= CACHE_MIN_CHARS;

  // Tier 1 too small to cache → merge everything and send as plain string.
  if (!coreBigEnough) {
    return afterChar === null
      ? `${core}\n\n${afterCore}`
      : `${core}\n\n${afterCore}\n\n${afterChar}`;
  }

  // 2-block form (only AFTER_CORE marker present)
  if (afterChar === null) {
    return [
      { type: 'text', text: core, cache_control: TIER1_CACHE_CONTROL },
      { type: 'text', text: afterCore }
    ];
  }

  // Both markers present. If tier 2 is too small to cache independently,
  // merge tiers 2+3 and only cache tier 1 (2-block form). Otherwise emit
  // the full 3-block form.
  if (!afterCoreBigEnough) {
    return [
      { type: 'text', text: core, cache_control: TIER1_CACHE_CONTROL },
      { type: 'text', text: `${afterCore}\n\n${afterChar}` }
    ];
  }

  return [
    { type: 'text', text: core, cache_control: TIER1_CACHE_CONTROL },
    { type: 'text', text: afterCore, cache_control: TIER2_CACHE_CONTROL },
    { type: 'text', text: afterChar }
  ];
}

function logCacheStats(usage, sessionId = null) {
  if (!usage) return;
  const created = usage.cache_creation_input_tokens || 0;
  const read = usage.cache_read_input_tokens || 0;
  const fresh = usage.input_tokens || 0;
  const out = usage.output_tokens || 0;

  cumulativeCacheStats.turns += 1;
  cumulativeCacheStats.cacheCreated += created;
  cumulativeCacheStats.cacheRead += read;
  cumulativeCacheStats.inputFresh += fresh;
  cumulativeCacheStats.output += out;

  const label = sessionId ? `session ${sessionId}` : 'turn';
  const hitPct = (read + created) > 0
    ? ` (${Math.round((read / (read + fresh + created)) * 100)}% cache-hit rate)`
    : '';
  console.log(
    `[cache] ${label}: created ${created} / read ${read} / fresh-input ${fresh} / output ${out}${hitPct}`
  );
}

/**
 * Read aggregate cache stats since server start. Useful for a periodic
 * summary log or an admin endpoint.
 */
export function getCumulativeCacheStats() {
  return { ...cumulativeCacheStats };
}

/**
 * Get the model ID based on selection
 * @param {string} modelChoice - 'opus', 'sonnet', or undefined for default
 */
function getModelId(modelChoice) {
  if (modelChoice === 'opus') return OPUS_MODEL;
  if (modelChoice === 'sonnet') return SONNET_MODEL;
  return DEFAULT_MODEL;
}

/**
 * Check if Claude API is available (API key is set)
 */
export function isClaudeAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Check Claude API status
 */
export async function checkClaudeStatus() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      available: false,
      error: 'ANTHROPIC_API_KEY not set in environment'
    };
  }

  // API key is configured — report available without making a live API call.
  // Actual API errors (invalid key, rate limit) will surface when the session starts.
  return {
    available: true,
    model: DEFAULT_MODEL,
    models: {
      opus: OPUS_MODEL,
      sonnet: SONNET_MODEL
    },
    provider: 'Anthropic Claude'
  };
}

/**
 * Clean up AI response by removing meta-commentary that shouldn't be shown to players
 */
function cleanupResponse(text) {
  if (!text) return text;

  let cleaned = text
    .replace(/\n*\(Note:[\s\S]*?\)\.?\s*$/gi, '')
    .replace(/\n*\(This (?:scene |establishes|is the beginning)[\s\S]*?\)\.?\s*$/gi, '')
    .replace(/\n*\[Note:[\s\S]*?\]\.?\s*$/gi, '')
    .replace(/\n+Note:.*$/gi, '')
    .replace(/\n*\*+(?:Note|DM|Behind the scenes)[\s\S]*?\*+\.?\s*$/gi, '');

  return cleaned.trim();
}

/**
 * Send a message to Claude and get a response
 * Includes retry logic for transient network errors
 * @param {string} systemPrompt - The system prompt
 * @param {Array} messages - Message history
 * @param {number} maxRetries - Max retry attempts for network errors
 * @param {string} modelChoice - 'opus', 'sonnet', or undefined for default
 * @param {number} maxTokens - Max tokens for response (default 2000)
 * @param {boolean} rawResponse - If true, skip cleanup (for JSON responses)
 */
export async function chat(systemPrompt, messages, maxRetries = 3, modelChoice = null, maxTokens = 2000, rawResponse = false, options = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  const selectedModel = getModelId(modelChoice);

  // Convert messages to Claude format (separate system prompt)
  const claudeMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

  // Pillar 6: wrap system prompt for caching if a CACHE_BREAK marker is present.
  // buildSystemParam returns either a plain string (back-compat) or an array
  // of content blocks with cache_control on the cacheable portion.
  const systemParam = buildSystemParam(systemPrompt);

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: maxTokens,
          system: systemParam,
          messages: claudeMessages
        })
      });

      if (!response.ok) {
        // 529 (Overloaded) gets its own, more patient retry budget — Anthropic's
        // docs explicitly recommend longer backoff for this status because it
        // signals server-side load that may take tens of seconds to clear.
        // Other retryable errors (503/500) use the caller's maxRetries.
        const isOverloaded = response.status === 529;
        const isOtherRetryable = response.status === 503 || response.status === 500;
        const isRetryableStatus = isOverloaded || isOtherRetryable;

        // Effective max attempts: bump the budget for 529 specifically so we
        // ride out short Anthropic overloads. 5 attempts × backoff 4s/8s/16s/32s
        // = up to ~60s total wait. Players are happier waiting than retyping
        // and clicking Send again. Other errors keep the caller's policy.
        const effectiveMax = isOverloaded ? Math.max(maxRetries, 5) : maxRetries;

        if (isRetryableStatus && attempt < effectiveMax) {
          // Overloaded uses 4s/8s/16s/32s; other retryables keep 2s/4s/8s.
          const baseMs = isOverloaded ? 4000 : 2000;
          const delay = Math.pow(2, attempt - 1) * baseMs;
          const tag = isOverloaded ? 'overloaded' : 'error';
          console.log(`Claude API ${tag} (${response.status}, attempt ${attempt}/${effectiveMax}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        let errorBody;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = { error: { message: `HTTP ${response.status}` } };
        }
        // Tag the error message with OVERLOADED so the route layer can map it
        // to a clean user-facing string ("AI temporarily overloaded — please
        // retry in a moment") instead of leaking the raw Anthropic error.
        const tag = isOverloaded ? 'OVERLOADED: ' : '';
        throw new Error(`${tag}Claude API error: ${errorBody.error?.message || `HTTP ${response.status}`}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';

      // Pillar 6: log cache stats for this turn. Only interesting when
      // caching is active (i.e. system prompt had the CACHE_BREAK marker).
      if (Array.isArray(systemParam)) {
        logCacheStats(data.usage, options.sessionId);
      } else if (rawResponse) {
        // Fallback logging for non-cached raw-response calls.
        console.log(`Claude API response - model: ${data.model}, stop_reason: ${data.stop_reason}, content_length: ${content.length}, usage: input=${data.usage?.input_tokens} output=${data.usage?.output_tokens}`);
      }

      // Warn if response was truncated — markers at the end may have been lost
      if (data.stop_reason === 'max_tokens') {
        console.warn(`⚠️ Claude response TRUNCATED (hit max_tokens=${maxTokens}). Output: ${data.usage?.output_tokens} tokens. System markers at end of response may be lost.`);
      }

      return rawResponse ? content : cleanupResponse(content);
    } catch (error) {
      lastError = error;

      // Check if it's a retryable network error
      const isNetworkError = error.cause?.code === 'UND_ERR_SOCKET' ||
                             error.message?.includes('fetch failed') ||
                             error.message?.includes('socket') ||
                             error.message?.includes('ECONNRESET');

      if (isNetworkError && attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`Claude API network error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Start a new DM session with Claude
 * @param {string} systemPrompt - The DM system prompt
 * @param {string} openingPrompt - The opening scene prompt
 * @param {string} modelChoice - 'opus' for first campaign session, 'sonnet' for regular
 * @param {object} [options]
 * @param {number|string} [options.sessionId] - session id for cache-stat logging
 */
export async function startSession(systemPrompt, openingPrompt, modelChoice = null, options = {}) {
  const messages = [{ role: 'user', content: openingPrompt }];
  const response = await chat(systemPrompt, messages, 3, modelChoice, 4000, false, options);

  const selectedModel = getModelId(modelChoice);
  console.log(`Starting DM session with model: ${selectedModel}`);

  return {
    response,
    model: selectedModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: openingPrompt },
      { role: 'assistant', content: response }
    ]
  };
}

/**
 * Continue a session with Claude
 * @param {string} systemPrompt - The DM system prompt
 * @param {Array} messages - Message history
 * @param {string} playerAction - The player's action
 * @param {string} modelChoice - 'opus' or 'sonnet' (defaults to sonnet for continuations)
 * @param {object} [options]
 * @param {number|string} [options.sessionId] - session id for cache-stat logging
 */
export async function continueSession(systemPrompt, messages, playerAction, modelChoice = 'sonnet', options = {}) {
  const updatedMessages = [
    ...messages.filter(m => m.role !== 'system'),
    { role: 'user', content: playerAction }
  ];

  const response = await chat(systemPrompt, updatedMessages, 3, modelChoice, 4000, false, options);

  return {
    response,
    messages: [
      { role: 'system', content: systemPrompt },
      ...updatedMessages,
      { role: 'assistant', content: response }
    ]
  };
}

/**
 * Generate a session summary with Claude
 * @param {string} systemPrompt - The DM system prompt
 * @param {Array} messages - Message history
 * @param {string} modelChoice - 'opus' or 'sonnet' (defaults to sonnet for summaries)
 */
export async function generateSessionSummary(systemPrompt, messages, modelChoice = 'sonnet') {
  const summaryMessages = [
    ...messages.filter(m => m.role !== 'system'),
    {
      role: 'user',
      content: `The session is ending. As the DM, provide a summary of this adventure session. Include:

1. KEY EVENTS: What major things happened? (2-3 sentences)
2. CURRENT STATE: Where is the party right now? What time of day/night is it in-game?
3. NEXT PLANS: What specific plans did the party make for their next move? Include ANY timing details (e.g., "agreed to leave at dawn", "will depart before sunrise", "meeting someone at midnight"). This is CRITICAL for the next session.
4. UNRESOLVED THREADS: Any mysteries, promises, or dangers left hanging?

Write in past tense as a narrative recap. Be specific about any timing or plans the party agreed to - the next session will start from exactly where this one ended.`
    }
  ];

  return await chat(systemPrompt, summaryMessages, 3, modelChoice);
}

export default {
  isClaudeAvailable,
  checkClaudeStatus,
  chat,
  startSession,
  continueSession,
  generateSessionSummary
};
