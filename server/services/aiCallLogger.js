/**
 * AI Call Logger (Phase 4a SC-4a.1)
 *
 * Wrapping helper that captures every AI call's metadata + content +
 * timing + response into the `ai_call_log` table. Per spec §2.5 callers
 * delegate their AI invocation through `logAiCall(opts, callFn)`; the
 * helper records request metadata, runs callFn, records response + timing,
 * returns the result transparently. Caller behavior is byte-identical
 * with or without logging.
 *
 * Per spec §2.6 — no prompt-content or response-content changes. Phase 4a
 * is read-only on the AI's actual behavior.
 *
 * Failure semantics: logging failures NEVER propagate to the caller.
 * If the DB insert fails, the AI call still returns its result; the
 * logging error is console-warned and dropped. Phase 4a's instrumentation
 * is best-effort; it must never break gameplay.
 */

import { dbRun } from '../database.js';
import { computePromptSections, estimateTokens } from './promptShapeAccounting.js';
import { contextWindow } from './localModels.js';

// ============================================================
// System-prompt size guard
// ============================================================

/**
 * Thresholds for the assembled system prompt, in estimated tokens.
 *
 * These live here rather than at session start because every AI call — session
 * start, each gameplay turn — funnels through this module with the full prompt
 * already in hand. A check at session start alone would miss the per-turn
 * growth from the repetition ledger and the marker-correction block, which
 * append to the prompt as a session runs.
 *
 * Re-based on the local model's real context window (localModels.js
 * contextWindow(), default 65,536) in the local-model-only job: WARN at half
 * the window, ERROR at three quarters — past that, the system prompt is
 * crowding out the conversation and the reply. (The old 60k / 100k defaults
 * were sized for a 1M-token cloud window and sat at or past the local window.)
 * Override with DM_PROMPT_WARN_TOKENS / DM_PROMPT_ERROR_TOKENS.
 */
function promptWarnTokens() {
  return Number(process.env.DM_PROMPT_WARN_TOKENS) || Math.floor(contextWindow() * 0.5);
}
function promptErrorTokens() {
  return Number(process.env.DM_PROMPT_ERROR_TOKENS) || Math.floor(contextWindow() * 0.75);
}

/**
 * Log loudly when the assembled system prompt crosses a size threshold.
 *
 * Deliberately never throws. This module's contract is that instrumentation
 * failures never affect gameplay, and a prompt that is merely large still
 * produces a perfectly good turn — refusing the call would convert a
 * degradation into an outage. The point is that unbounded growth becomes
 * observable before it becomes fatal, not that it gets blocked.
 *
 * @param {string} systemPrompt
 * @param {string} callPurpose
 * @returns {{ tokens: number, level: 'ok'|'warn'|'error' }}
 */
export function checkPromptSize(systemPrompt, callPurpose = 'unknown') {
  const tokens = estimateTokens(systemPrompt);
  let level = 'ok';

  if (tokens >= promptErrorTokens()) {
    level = 'error';
    console.error(
      `[promptSize] ERROR: system prompt for "${callPurpose}" is ~${tokens} tokens, ` +
        `over the ${promptErrorTokens()} ceiling. Context growth is no longer bounded — ` +
        `check chronicle summary count, canon-fact budget, and per-turn prompt appends.`
    );
  } else if (tokens >= promptWarnTokens()) {
    level = 'warn';
    console.warn(
      `[promptSize] WARN: system prompt for "${callPurpose}" is ~${tokens} tokens ` +
        `(warn at ${promptWarnTokens()}, error at ${promptErrorTokens()}).`
    );
  }

  return { tokens, level };
}

// ============================================================
// Public API
// ============================================================

/**
 * Wrap an AI call with logging instrumentation.
 *
 * @param {object} opts                       — capture context per spec §2.2
 * @param {number} [opts.character_id]        — optional; some call sites have no character
 * @param {number} [opts.campaign_id]
 * @param {number} [opts.session_id]
 * @param {number} [opts.turn_number]
 * @param {string} [opts.prompt_builder]      — name of the builder that produced the prompt
 *                                              (e.g. 'dmPromptBuilder', 'preludeArcPromptBuilder')
 * @param {string}  opts.call_purpose         — REQUIRED. Tag describing what this call is for
 *                                              ('gameplay_turn', 'prelude_turn', 'campaign_plan_gen', etc.)
 * @param {string}  opts.system_prompt        — full system prompt sent to the AI
 * @param {string}  opts.user_message         — current-turn user content
 * @param {Array}   [opts.conversation_history] — message history if relevant (excluding the system prompt)
 * @param {object}  [opts.metadata]           — free-form JSON-serializable extras
 * @param {function} callFn                   — async () => string|object — the actual AI call
 * @returns whatever callFn returns
 */
export async function logAiCall(opts, callFn) {
  if (!opts || typeof opts !== 'object') {
    // Defensive — caller misuse shouldn't break the call.
    return callFn();
  }
  if (typeof callFn !== 'function') {
    throw new Error('logAiCall: callFn must be a function');
  }
  if (!opts.call_purpose || typeof opts.call_purpose !== 'string') {
    // call_purpose is the one mandatory tag; without it the log is useless
    // for behavior diagnostics. Treat absence as a programmer error rather
    // than silently logging without context.
    throw new Error('logAiCall: opts.call_purpose (string) is required');
  }

  const startedAt = Date.now();
  const startedIso = new Date(startedAt).toISOString().slice(0, 19).replace('T', ' ');

  // Size guard runs before the call, so an oversized prompt is visible in the
  // logs even if the API then rejects it.
  if (opts.system_prompt) {
    checkPromptSize(opts.system_prompt, opts.call_purpose);
  }

  let result;
  let response_text = null;
  let response_status = 'ok';
  let response_error = null;
  let response_data = null;
  let thrownError = null;

  try {
    result = await callFn();
    // Normalize for capture: result may be a string (the cleaned text) or
    // an object that includes raw data (rawApiResponse with usage, etc.)
    if (typeof result === 'string') {
      response_text = result;
    } else if (result && typeof result === 'object') {
      response_data = result;
      response_text = result.response || result.content || result.text || JSON.stringify(result);
    }
  } catch (err) {
    thrownError = err;
    response_status = 'error';
    response_error = err?.message || String(err);
    if (typeof err?.message === 'string' && err.message.includes('TRUNCATED')) {
      response_status = 'truncated';
    }
  }

  const finishedAt = Date.now();
  const finishedIso = new Date(finishedAt).toISOString().slice(0, 19).replace('T', ' ');
  const latency_ms = finishedAt - startedAt;

  // Caller may pass usage/model details in opts.api_response_meta to
  // capture token counts when known. Alternately the caller's callFn may
  // have populated opts.__capturedMeta via the onApiMeta hook in llm.chat
  // — see `wrapLlmCall` below for the standard wiring helper. The model
  // goes in model_id; the role (dm / summary / extraction / generation)
  // goes in metadata.role.
  const meta = opts.api_response_meta || opts.__capturedMeta;
  const apiMeta = meta?.usage ? {
    model: meta.model,
    input_tokens: meta.usage.input_tokens,
    output_tokens: meta.usage.output_tokens,
    cache_read_input_tokens: meta.usage.cache_read_input_tokens,
    cache_creation_input_tokens: meta.usage.cache_creation_input_tokens
  } : (meta || {});
  const metadataOut = withRole(opts.metadata, meta);

  // Compute prompt-shape breakdown synchronously — heuristic regex on the
  // system prompt; cheap relative to the AI call we just made. Stored as
  // JSON in `prompt_sections`.
  let prompt_sections = null;
  try {
    if (opts.system_prompt) {
      const sections = computePromptSections(opts.system_prompt, opts.prompt_builder);
      prompt_sections = JSON.stringify(sections);
    }
  } catch (e) {
    // Section computation failures must not block logging.
    console.warn('[aiCallLogger] prompt-section accounting failed:', e?.message);
  }

  // Persist. All fields nullable except call_purpose; bind-time JSON
  // stringification for object columns.
  try {
    await dbRun(
      `INSERT INTO ai_call_log (
         character_id, campaign_id, session_id, turn_number,
         prompt_builder, call_purpose,
         request_started_at, response_received_at, latency_ms,
         model_id, input_tokens, output_tokens,
         cache_read_input_tokens, cache_creation_input_tokens,
         system_prompt, user_message, conversation_history,
         response_text, response_status, response_error,
         prompt_sections, markers_detected, marker_failures,
         triggered_correction_loop, rule_violations,
         metadata
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        opts.character_id ?? null,
        opts.campaign_id ?? null,
        opts.session_id ?? null,
        opts.turn_number ?? null,
        opts.prompt_builder ?? null,
        opts.call_purpose,
        startedIso,
        finishedIso,
        latency_ms,
        apiMeta.model ?? null,
        apiMeta.input_tokens ?? null,
        apiMeta.output_tokens ?? null,
        apiMeta.cache_read_input_tokens ?? null,
        apiMeta.cache_creation_input_tokens ?? null,
        opts.system_prompt ?? null,
        opts.user_message ?? null,
        opts.conversation_history ? JSON.stringify(opts.conversation_history) : null,
        response_text,
        response_status,
        response_error,
        prompt_sections,
        opts.markers_detected ? JSON.stringify(opts.markers_detected) : null,
        opts.marker_failures ? JSON.stringify(opts.marker_failures) : null,
        opts.triggered_correction_loop ? 1 : 0,
        opts.rule_violations ? JSON.stringify(opts.rule_violations) : null,
        metadataOut ? JSON.stringify(metadataOut) : null
      ]
    );
  } catch (logErr) {
    // Logging is best-effort; never break the caller.
    console.warn(`[aiCallLogger] persist failed for ${opts.call_purpose}:`, logErr?.message);
  }

  if (thrownError) throw thrownError;
  return result;
}

/**
 * Update an existing log row with marker pipeline + correction-loop
 * outcomes after the route handler has processed the AI response. Allows
 * the marker dispatch pass to amend the row that `logAiCall` created.
 *
 * Returns void; lookup-by-id strategy: caller passes the log row id (set
 * via the optional 3rd return shape from `logAiCallWithId` below) and the
 * fields to update. Failures are swallowed (best-effort).
 */
export async function annotateAiCallLog(logId, updates) {
  if (!logId || !updates) return;
  const allowed = {
    markers_detected: 'json',
    marker_failures: 'json',
    triggered_correction_loop: 'bool',
    rule_violations: 'json',
    metadata: 'json'
  };
  const sets = [];
  const values = [];
  for (const [key, kind] of Object.entries(allowed)) {
    if (key in updates) {
      sets.push(`${key} = ?`);
      const v = updates[key];
      if (kind === 'json') values.push(v == null ? null : JSON.stringify(v));
      else if (kind === 'bool') values.push(v ? 1 : 0);
      else values.push(v);
    }
  }
  if (sets.length === 0) return;
  values.push(logId);
  try {
    await dbRun(`UPDATE ai_call_log SET ${sets.join(', ')} WHERE id = ?`, values);
  } catch (e) {
    console.warn('[aiCallLogger] annotate failed:', e?.message);
  }
}

// ============================================================
// Retention / pruning (migration 053 §2.4 — the "future work" archival job)
// ============================================================

/**
 * Default retention window for full AI-call content, in days.
 * Override with AI_CALL_LOG_RETENTION_DAYS (0 disables pruning).
 */
const AI_CALL_LOG_RETENTION_DAYS = Number(process.env.AI_CALL_LOG_RETENTION_DAYS || 30);

/**
 * Prune old ai_call_log rows' heavy content columns.
 *
 * The log stores full prompts + full conversation history per call, so it
 * grows quadratically within a session and makes backups progressively more
 * expensive. This keeps every row — timing, token counts, model identity,
 * markers, purposes, the signal columns — but NULLs the bulky TEXT content
 * for rows older than the retention window and stamps archived_at, which is
 * what migration 053 added the column for.
 *
 * Never throws: like the rest of this module, pruning is best-effort
 * instrumentation hygiene and must never break gameplay.
 *
 * @param {number} olderThanDays - prune rows older than this many days
 * @returns {Promise<number>} number of rows pruned
 */
export async function pruneAiCallLog(olderThanDays = AI_CALL_LOG_RETENTION_DAYS) {
  if (!olderThanDays || olderThanDays <= 0) return 0;
  try {
    const result = await dbRun(
      `UPDATE ai_call_log
       SET system_prompt = NULL,
           user_message = NULL,
           conversation_history = NULL,
           response_text = NULL,
           prompt_sections = NULL,
           archived_at = CURRENT_TIMESTAMP
       WHERE archived_at IS NULL
         AND request_started_at < datetime('now', '-' || ? || ' days')`,
      [olderThanDays]
    );
    const pruned = result.changes || 0;
    if (pruned > 0) {
      console.log(`[aiCallLogger] pruned content for ${pruned} ai_call_log row(s) older than ${olderThanDays}d`);
    }
    return pruned;
  } catch (err) {
    console.warn('[aiCallLogger] prune failed (non-fatal):', err?.message);
    return 0;
  }
}

/**
 * Variant of logAiCall that also returns the inserted log row id so
 * downstream marker-dispatch passes can amend the row via
 * `annotateAiCallLog`. Returns { result, logId }.
 *
 * Most call sites don't need this; use `logAiCall` directly. Use this
 * variant when the caller has access to marker-detection results that
 * weren't available at AI-call time (the route handler wrapping
 * dmSession turns is the canonical example).
 */
export async function logAiCallWithId(opts, callFn) {
  // We can't know the inserted id without a separate INSERT path that
  // captures `lastInsertRowid`. Refactor: do the insert in two steps —
  // pre-insert the row with the data we have at call start; UPDATE after
  // the call completes. Slight cost (two writes vs. one) but only for the
  // call sites that ask for it.
  const startedAt = Date.now();
  const startedIso = new Date(startedAt).toISOString().slice(0, 19).replace('T', ' ');

  // Pre-insert row with what we know now.
  let logId = null;
  let prompt_sections = null;
  try {
    if (opts.system_prompt) {
      checkPromptSize(opts.system_prompt, opts.call_purpose);
      prompt_sections = JSON.stringify(computePromptSections(opts.system_prompt, opts.prompt_builder));
    }
  } catch (e) {
    console.warn('[aiCallLogger] section pre-compute failed:', e?.message);
  }
  try {
    const ins = await dbRun(
      `INSERT INTO ai_call_log (
         character_id, campaign_id, session_id, turn_number,
         prompt_builder, call_purpose,
         request_started_at,
         system_prompt, user_message, conversation_history,
         prompt_sections,
         response_status,
         metadata
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        opts.character_id ?? null,
        opts.campaign_id ?? null,
        opts.session_id ?? null,
        opts.turn_number ?? null,
        opts.prompt_builder ?? null,
        opts.call_purpose,
        startedIso,
        opts.system_prompt ?? null,
        opts.user_message ?? null,
        opts.conversation_history ? JSON.stringify(opts.conversation_history) : null,
        prompt_sections,
        opts.metadata ? JSON.stringify(opts.metadata) : null
      ]
    );
    logId = Number(ins.lastInsertRowid);
  } catch (e) {
    console.warn(`[aiCallLogger] pre-insert failed for ${opts.call_purpose}:`, e?.message);
  }

  let result;
  let thrownError = null;
  let response_text = null;
  let response_status = 'ok';
  let response_error = null;
  let response_data = null;

  try {
    result = await callFn();
    if (typeof result === 'string') {
      response_text = result;
    } else if (result && typeof result === 'object') {
      response_data = result;
      response_text = result.response || result.content || result.text || JSON.stringify(result);
    }
  } catch (err) {
    thrownError = err;
    response_status = 'error';
    response_error = err?.message || String(err);
    if (typeof err?.message === 'string' && err.message.includes('TRUNCATED')) {
      response_status = 'truncated';
    }
  }

  const finishedAt = Date.now();
  const finishedIso = new Date(finishedAt).toISOString().slice(0, 19).replace('T', ' ');
  const latency_ms = finishedAt - startedAt;
  const meta = opts.api_response_meta || opts.__capturedMeta;
  const apiMeta = meta?.usage ? {
    model: meta.model,
    input_tokens: meta.usage.input_tokens,
    output_tokens: meta.usage.output_tokens,
    cache_read_input_tokens: meta.usage.cache_read_input_tokens,
    cache_creation_input_tokens: meta.usage.cache_creation_input_tokens
  } : (meta || {});
  const metadataOut = withRole(opts.metadata, meta);

  if (logId != null) {
    try {
      await dbRun(
        `UPDATE ai_call_log
         SET response_received_at = ?, latency_ms = ?,
             model_id = ?, input_tokens = ?, output_tokens = ?,
             cache_read_input_tokens = ?, cache_creation_input_tokens = ?,
             response_text = ?, response_status = ?, response_error = ?,
             metadata = ?
         WHERE id = ?`,
        [
          finishedIso,
          latency_ms,
          apiMeta.model ?? null,
          apiMeta.input_tokens ?? null,
          apiMeta.output_tokens ?? null,
          apiMeta.cache_read_input_tokens ?? null,
          apiMeta.cache_creation_input_tokens ?? null,
          response_text,
          response_status,
          response_error,
          metadataOut ? JSON.stringify(metadataOut) : null,
          logId
        ]
      );
    } catch (e) {
      console.warn('[aiCallLogger] post-update failed:', e?.message);
    }
  }

  if (thrownError) throw thrownError;
  return { result, logId };
}

/** Merge the call's role (from llm.chat's onApiMeta) into the metadata JSON. */
function withRole(metadata, meta) {
  if (!meta?.role) return metadata;
  return { ...(metadata && typeof metadata === 'object' ? metadata : {}), role: meta.role };
}

/**
 * Convenience wrapper for the most common pattern: caller wants to invoke
 * an `llm.*` function (chat / continueSession / startSession) AND have
 * the call logged with onApiMeta token capture wired automatically.
 *
 * Usage:
 *
 *   const result = await wrapLlmCall(
 *     { character_id, session_id, call_purpose: 'gameplay_turn',
 *       prompt_builder: 'dmPromptBuilder',
 *       system_prompt, user_message, conversation_history },
 *     (chatOptions) => llm.continueSession(systemPrompt, messages, action,
 *                                          'dm', chatOptions)
 *   );
 *
 * The caller's fn receives a `chatOptions` argument that already has
 * `onApiMeta` set; the caller passes it through to `chat()`. That is how
 * the model, role and token counts reach the log row.
 *
 * Returns whatever fn returns. Logging is best-effort and never propagates
 * errors from the persistence layer to the caller.
 */
export async function wrapLlmCall(opts, fn) {
  const wrappedOpts = { ...opts };
  const chatOptions = {
    onApiMeta: (meta) => { wrappedOpts.__capturedMeta = meta; }
  };
  return logAiCall(wrappedOpts, () => fn(chatOptions));
}

/**
 * Variant of wrapLlmCall that also returns the inserted log row id.
 * Callers thread the id to a downstream `annotateAiCallLog(logId, ...)`
 * after marker-pipeline / rule-verifier work completes.
 */
export async function wrapLlmCallWithId(opts, fn) {
  const wrappedOpts = { ...opts };
  const chatOptions = {
    onApiMeta: (meta) => { wrappedOpts.__capturedMeta = meta; }
  };
  return logAiCallWithId(wrappedOpts, () => fn(chatOptions));
}

/**
 * Drop-in replacement for `llm.chat(...)` that records the call to
 * `ai_call_log`. Generator-style call sites (campaign plan, NPC voice,
 * quest generation, etc.) pass a small `callContext` object as the first
 * argument; the rest of the args are forwarded to `chat()` unchanged.
 *
 *   chat(systemPrompt, messages, maxRetries, role, maxTokens, rawResponse, options)
 *   loggedChat(callContext, systemPrompt, messages, maxRetries, role, maxTokens, rawResponse, options)
 *
 * `role` is 'dm' | 'summary' | 'extraction' | 'generation' (localModels.js).
 *
 * `callContext` shape:
 *   { call_purpose, character_id?, campaign_id?, session_id?, turn_number?,
 *     prompt_builder?, metadata? }
 *
 * The helper extracts the last user message from `messages` for the
 * `user_message` column, persists the full message array to
 * `conversation_history`, and wires `onApiMeta` into `options` so the
 * model, role and token counts are captured. Callers that need the inserted
 * row id can use `wrapLlmCallWithId` directly.
 */
export async function loggedChat(callContext, systemPrompt, messages, maxRetries = 3, role = 'dm', maxTokens = 2000, rawResponse = false, options = {}) {
  // Imported lazily so this logger stays importable without the client.
  const { chat } = await import('./llm.js');
  if (!callContext || typeof callContext !== 'object' || !callContext.call_purpose) {
    return chat(systemPrompt, messages, maxRetries, role, maxTokens, rawResponse, options);
  }

  const lastUserMsg = Array.isArray(messages)
    ? [...messages].reverse().find(m => m?.role === 'user')?.content
    : null;

  const wrappedOpts = {
    character_id: callContext.character_id,
    campaign_id: callContext.campaign_id,
    session_id: callContext.session_id,
    turn_number: callContext.turn_number,
    prompt_builder: callContext.prompt_builder || null,
    call_purpose: callContext.call_purpose,
    system_prompt: systemPrompt,
    user_message: typeof lastUserMsg === 'string' ? lastUserMsg : null,
    conversation_history: Array.isArray(messages) ? messages : null,
    metadata: callContext.metadata
  };

  const mergedOptions = {
    ...options,
    onApiMeta: (meta) => { wrappedOpts.__capturedMeta = meta; }
  };

  return logAiCall(wrappedOpts, () => chat(systemPrompt, messages, maxRetries, role, maxTokens, rawResponse, mergedOptions));
}
