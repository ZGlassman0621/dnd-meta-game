/**
 * Local LLM client — every AI call in the game goes through here, to Ollama
 * on the player's own PC. Nothing in the game calls a cloud model (Zach,
 * 2026-11-13). Which model answers is decided per ROLE in localModels.js;
 * callers name a role, never a model.
 *
 * Replaced, in the local-model-only job: the cloud-model API client,
 * llmClient.js and ollama.js (the old Ollama fallback). The function names
 * and argument order match that old client on purpose, so each call
 * site changed in one small edit: the model argument became a role.
 *
 *   chat(systemPrompt, messages, maxRetries, role, maxTokens, rawResponse, options)
 *
 * Request shape (Ollama /api/chat):
 *   - The system prompt goes first as a `system` message. The DM prompt's
 *     cache-tier markers (<!-- CACHE_BREAK:... -->) were for the old cloud model's prompt
 *     cache; they mean nothing to Ollama and are stripped.
 *   - `options.num_ctx` is ALWAYS sent (localModels.contextWindow()). Without
 *     it Ollama runs at its own small default window and silently drops the
 *     start of a long prompt — the DM rules.
 *   - `options.num_predict` is the caller's maxTokens. A reply cut off there
 *     (done_reason 'length') loses the markers at its end; that is logged.
 *   - `think` is off unless OLLAMA_THINK=true. Thinking text, if any, comes
 *     back in a separate field and is never shown to the player.
 *   - The reply is STREAMED and accumulated. A long generation can take longer
 *     than Node's 300 s wait for response headers; streaming sends headers at
 *     once. The test stub may answer with a single JSON object instead — one
 *     line of NDJSON — and that parses the same way.
 *   - `keep_alive: '30m'` keeps the model loaded between turns, so the
 *     player's thinking time does not cost a model reload.
 */

import {
  modelFor,
  roleModels,
  requiredModels,
  ollamaUrl,
  contextWindow,
  thinkingEnabled,
} from './localModels.js';

// Ceiling for an interactive DM turn (opening, continuation). A ceiling, not a
// spend; overridable for slower machines.
const GAMEPLAY_MAX_TOKENS = Number(process.env.DM_MAX_TOKENS || 4000);

const KEEP_ALIVE = '30m';

/** Always reported by checkStatus — the game has exactly one provider. */
const PROVIDER = 'Ollama (local)';

const CACHE_BREAK_RE = /\n*<!-- CACHE_BREAK:[A-Z_]+ -->\n*/g;

/** Strip the old prompt-cache markers; keep paragraph spacing. */
export function stripCacheMarkers(systemPrompt) {
  if (!systemPrompt || typeof systemPrompt !== 'string') return systemPrompt;
  return systemPrompt.replace(CACHE_BREAK_RE, '\n\n');
}

/**
 * Remove chain-of-thought blocks some models write inline, including an
 * orphan open tag (cut off mid-thought) or orphan close tag.
 */
function stripThinkingTokens(text) {
  if (!text) return text;
  let out = text
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>\s*/gi, '');
  if (/<\/think>/i.test(out) && !/<think>/i.test(out)) {
    out = out.replace(/^[\s\S]*?<\/think>\s*/i, '');
  }
  if (/<think>/i.test(out) && !/<\/think>/i.test(out)) {
    out = out.replace(/<think>[\s\S]*$/i, '');
  }
  return out;
}

/** Remove meta-commentary that should never reach the player. */
function cleanupResponse(text) {
  if (!text) return text;
  return stripThinkingTokens(text)
    .replace(/\n*\(Note:[\s\S]*?\)\.?\s*$/gi, '')
    .replace(/\n*\(This (?:scene |establishes|is the beginning)[\s\S]*?\)\.?\s*$/gi, '')
    .replace(/\n*\[Note:[\s\S]*?\]\.?\s*$/gi, '')
    .replace(/\n+Note:.*$/gi, '')
    .replace(/\n*\*+(?:Note|DM|Behind the scenes)[\s\S]*?\*+\.?\s*$/gi, '')
    .trim();
}

/**
 * Is Ollama reachable, and is every model the configured roles need installed?
 *
 *   { available: true, models, role_models, required_models, url, context_window }
 *   { available: false, error_code: 'unreachable' | 'no_model', error, ... }
 *
 * `error` is written for the player: it says what to do.
 */
export async function checkStatus() {
  const url = ollamaUrl();
  const role_models = roleModels();
  const required_models = requiredModels();
  try {
    const response = await fetch(`${url}/api/tags`);
    if (!response.ok) {
      return {
        available: false,
        provider: PROVIDER,
        error_code: 'unreachable',
        error: `Ollama answered with HTTP ${response.status} at ${url}.`,
        role_models,
        required_models,
        url,
      };
    }
    const data = await response.json();
    const models = data.models || [];
    const installed = new Set(models.flatMap((m) => [m.name, m.model]).filter(Boolean));
    const missing = required_models.filter((m) => !installed.has(m));
    if (missing.length > 0) {
      return {
        available: false,
        provider: PROVIDER,
        error_code: 'no_model',
        error: `Ollama is running, but ${missing.join(', ')} is not installed. Run \`ollama pull ${missing[0]}\`.`,
        missing_models: missing,
        models,
        role_models,
        required_models,
        url,
      };
    }
    return {
      available: true,
      provider: PROVIDER,
      models,
      role_models,
      required_models,
      url,
      context_window: contextWindow(),
    };
  } catch {
    return {
      available: false,
      error_code: 'unreachable',
      error: `Can't reach Ollama at ${url}. Start Ollama, then try again.`,
      role_models,
      required_models,
      url,
      provider: PROVIDER,
    };
  }
}

/** Installed Ollama models ([] if Ollama is unreachable). */
export async function listModels() {
  try {
    const response = await fetch(`${ollamaUrl()}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.models || [];
  } catch {
    return [];
  }
}

function isConnectionError(error) {
  const code = error?.cause?.code || error?.code;
  return (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'UND_ERR_SOCKET' ||
    /fetch failed|socket|ECONNRESET|ECONNREFUSED/i.test(error?.message || '')
  );
}

/** Parse an Ollama /api/chat body: NDJSON stream, or one JSON object. */
function parseChatBody(text) {
  let content = '';
  let thinking = '';
  let final = null;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (obj.error) throw new Error(`Ollama error: ${obj.error}`);
    if (obj.message?.content) content += obj.message.content;
    if (obj.message?.thinking) thinking += obj.message.thinking;
    if (obj.done) final = obj;
  }
  return { content, thinking, final };
}

/**
 * Send messages to the local model for a role and return the reply text.
 *
 * @param {string} systemPrompt
 * @param {Array<{role,content}>} messages  history; any `system` entries are
 *        dropped (the systemPrompt argument is the system message)
 * @param {number} maxRetries  attempts on a connection error (Ollama
 *        restarting, model loading). Model errors are not retried.
 * @param {string} role  'dm' | 'summary' | 'extraction' | 'generation'
 * @param {number} maxTokens  reply ceiling (num_predict)
 * @param {boolean} rawResponse  true: return the text as-is (JSON callers);
 *        false: strip meta-commentary for the player
 * @param {object} options  { onApiMeta?: fn({model, role, usage, stop_reason}),
 *        sessionId? }
 */
export async function chat(systemPrompt, messages, maxRetries = 3, role = 'dm', maxTokens = 2000, rawResponse = false, options = {}) {
  const model = modelFor(role);
  const url = `${ollamaUrl()}/api/chat`;

  const ollamaMessages = [];
  const system = stripCacheMarkers(systemPrompt);
  if (system) ollamaMessages.push({ role: 'system', content: system });
  for (const m of messages || []) {
    if (!m || m.role === 'system') continue;
    ollamaMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }

  const body = {
    model,
    messages: ollamaMessages,
    stream: true,
    think: thinkingEnabled(),
    keep_alive: KEEP_ALIVE,
    options: {
      num_ctx: contextWindow(),
      num_predict: maxTokens,
    },
  };

  let lastError;
  const attempts = Math.max(1, maxRetries);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        if (response.status === 404) {
          throw new Error(`LOCAL_MODEL_MISSING: ${model} is not installed in Ollama. Run \`ollama pull ${model}\`.`);
        }
        throw new Error(`Ollama error (HTTP ${response.status}): ${errText.slice(0, 300)}`);
      }

      const { content, final } = parseChatBody(await response.text());

      if (typeof options?.onApiMeta === 'function') {
        try {
          options.onApiMeta({
            model: final?.model || model,
            role,
            usage: {
              input_tokens: final?.prompt_eval_count ?? null,
              output_tokens: final?.eval_count ?? null,
            },
            stop_reason: final?.done_reason ?? null,
          });
        } catch (e) {
          console.warn('[llm.chat] onApiMeta callback error:', e?.message);
        }
      }

      if (final?.done_reason === 'length') {
        console.warn(`⚠️ Local model reply TRUNCATED at num_predict=${maxTokens} (role ${role}, model ${model}). Markers at the end of the reply may be lost.`);
      }

      return rawResponse ? stripThinkingTokens(content).trim() : cleanupResponse(content);
    } catch (error) {
      lastError = error;
      if (isConnectionError(error)) {
        if (attempt < attempts) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`Ollama connection error (attempt ${attempt}/${attempts}), retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`LOCAL_MODEL_UNAVAILABLE: Can't reach Ollama at ${ollamaUrl()}. Start Ollama, then try again.`);
      }
      throw error;
    }
  }
  throw lastError;
}

/** Open a session: the opening scene from the DM role. */
export async function startSession(systemPrompt, openingPrompt, role = 'dm', options = {}) {
  const messages = [{ role: 'user', content: openingPrompt }];
  const response = await chat(systemPrompt, messages, 3, role, GAMEPLAY_MAX_TOKENS, false, options);
  return {
    response,
    model: modelFor(role),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: openingPrompt },
      { role: 'assistant', content: response },
    ],
  };
}

/** One player action → one DM reply. */
export async function continueSession(systemPrompt, messages, playerAction, role = 'dm', options = {}) {
  const updatedMessages = [
    ...(messages || []).filter((m) => m.role !== 'system'),
    { role: 'user', content: playerAction },
  ];
  const response = await chat(systemPrompt, updatedMessages, 3, role, GAMEPLAY_MAX_TOKENS, false, options);
  return {
    response,
    messages: [
      { role: 'system', content: systemPrompt },
      ...updatedMessages,
      { role: 'assistant', content: response },
    ],
  };
}

/** End-of-session recap, written by the summary role. */
export async function generateSessionSummary(systemPrompt, messages, role = 'summary') {
  const summaryMessages = [
    ...(messages || []).filter((m) => m.role !== 'system'),
    {
      role: 'user',
      content: `The session is ending. As the DM, provide a summary of this adventure session. Include:

1. KEY EVENTS: What major things happened? (2-3 sentences)
2. CURRENT STATE: Where is the party right now? What time of day/night is it in-game?
3. NEXT PLANS: What specific plans did the party make for their next move? Include ANY timing details (e.g., "agreed to leave at dawn", "will depart before sunrise", "meeting someone at midnight"). This is CRITICAL for the next session.
4. UNRESOLVED THREADS: Any mysteries, promises, or dangers left hanging?

Write in past tense as a narrative recap. Be specific about any timing or plans the party agreed to - the next session will start from exactly where this one ended.`,
    },
  ];
  return await chat(systemPrompt, summaryMessages, 3, role);
}

export default {
  checkStatus,
  listModels,
  chat,
  startSession,
  continueSession,
  generateSessionSummary,
  stripCacheMarkers,
};
