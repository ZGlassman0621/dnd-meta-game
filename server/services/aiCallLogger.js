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
import { computePromptSections } from './promptShapeAccounting.js';

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
  // capture token counts when known (some callers receive raw API responses).
  // Alternately the caller's callFn may have populated opts.__capturedMeta
  // via the onApiMeta hook in claude.chat. Phase 4a SC-4a.1 — see
  // `wrapClaudeCall` below for the standard wiring helper.
  const meta = opts.api_response_meta || opts.__capturedMeta;
  const apiMeta = meta?.usage ? {
    model: meta.model,
    input_tokens: meta.usage.input_tokens,
    output_tokens: meta.usage.output_tokens,
    cache_read_input_tokens: meta.usage.cache_read_input_tokens,
    cache_creation_input_tokens: meta.usage.cache_creation_input_tokens
  } : (meta || {});

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
        opts.metadata ? JSON.stringify(opts.metadata) : null
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

  if (logId != null) {
    try {
      await dbRun(
        `UPDATE ai_call_log
         SET response_received_at = ?, latency_ms = ?,
             model_id = ?, input_tokens = ?, output_tokens = ?,
             cache_read_input_tokens = ?, cache_creation_input_tokens = ?,
             response_text = ?, response_status = ?, response_error = ?
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

/**
 * Convenience wrapper for the most common pattern: caller wants to invoke
 * a `claude.*` function (chat / continueSession / startSession) AND have
 * the call logged with onApiMeta token capture wired automatically.
 *
 * Usage:
 *
 *   const result = await wrapClaudeCall(
 *     { character_id, session_id, call_purpose: 'gameplay_turn',
 *       prompt_builder: 'dmPromptBuilder',
 *       system_prompt, user_message, conversation_history },
 *     (chatOptions) => claude.continueSession(systemPrompt, messages, action,
 *                                             modelChoice, chatOptions)
 *   );
 *
 * The caller's claudeFn receives a `chatOptions` argument that already
 * has `onApiMeta` set; the caller spreads it through to `chat()`. This
 * is the only way to capture token counts (the API meta isn't returned
 * to the caller through `continueSession`/`startSession`'s public shape).
 *
 * Returns whatever the claudeFn returns. Logging is best-effort and
 * never propagates errors from the persistence layer to the caller.
 */
export async function wrapClaudeCall(opts, claudeFn) {
  // Provide an onApiMeta callback that captures into opts so logAiCall
  // can read it after the call completes.
  const wrappedOpts = { ...opts };
  const chatOptions = {
    onApiMeta: (meta) => { wrappedOpts.__capturedMeta = meta; }
    // Caller may add sessionId / etc. by merging this into their own opts
  };
  return logAiCall(wrappedOpts, () => claudeFn(chatOptions));
}

/**
 * Variant of wrapClaudeCall that also returns the inserted log row id.
 * Callers thread the id to a downstream `annotateAiCallLog(logId, ...)`
 * after marker-pipeline / rule-verifier work completes.
 */
export async function wrapClaudeCallWithId(opts, claudeFn) {
  const wrappedOpts = { ...opts };
  const chatOptions = {
    onApiMeta: (meta) => { wrappedOpts.__capturedMeta = meta; }
  };
  return logAiCallWithId(wrappedOpts, () => claudeFn(chatOptions));
}

/**
 * Drop-in replacement for `chat(...)` that records the call to
 * `ai_call_log`. Generator-style call sites (campaign plan, NPC voice,
 * quest generation, etc.) pass a small `callContext` object as the first
 * argument; the rest of the args are forwarded to `chat()` unchanged.
 *
 * Signature mirrors `chat()`:
 *   chat(systemPrompt, messages, maxRetries, modelChoice, maxTokens, rawResponse, options)
 *
 *   loggedChat(callContext, systemPrompt, messages, maxRetries, modelChoice, maxTokens, rawResponse, options)
 *
 * `callContext` shape:
 *   { call_purpose, character_id?, campaign_id?, session_id?, turn_number?,
 *     prompt_builder?, metadata? }
 *
 * The helper extracts the last user message from `messages` for the
 * `user_message` column, persists the full message array to
 * `conversation_history`, and wires `onApiMeta` into `options` so
 * token counts are captured automatically. Callers that need the inserted
 * row id can use `wrapClaudeCallWithId` directly.
 */
export async function loggedChat(callContext, systemPrompt, messages, maxRetries = 3, modelChoice = null, maxTokens = 2000, rawResponse = false, options = {}) {
  // Defensive — caller may have omitted callContext (treat as raw chat call).
  // Imported lazily to avoid circular import (aiCallLogger ← claude ← aiCallLogger).
  const { chat } = await import('./claude.js');
  if (!callContext || typeof callContext !== 'object' || !callContext.call_purpose) {
    return chat(systemPrompt, messages, maxRetries, modelChoice, maxTokens, rawResponse, options);
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

  return logAiCall(wrappedOpts, () => chat(systemPrompt, messages, maxRetries, modelChoice, maxTokens, rawResponse, mergedOptions));
}
