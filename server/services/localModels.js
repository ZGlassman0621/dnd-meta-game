/**
 * Local model registry — the ONE place that names the models the game runs.
 *
 * The game runs entirely on a local model served by Ollama on the player's
 * own PC (Zach, 2026-11-10: gemma4:12b). No part of the game calls a cloud
 * model (Zach, 2026-11-13: "The only Claude on the system is you building
 * it"). This file replaced the cloud-model registry (modelRegistry.js) in
 * the local-model-only job.
 *
 * ── Roles ────────────────────────────────────────────────────────────────
 * Every AI call names the ROLE it plays, never a model. Each role resolves to
 * a model here, so a later "summaries on a smaller model" decision is one
 * `.env` line, not a code change. All roles default to gemma4:12b.
 *
 *   dm          — narrative turns: DM sessions, DM Mode, Prelude sessions
 *   summary     — summaries and compression: session summaries, recaps,
 *                 rolling summaries, context compression
 *   extraction  — structured reads of what happened: chronicles, notes,
 *                 NPCs, memories, relationship and transition extraction
 *   generation  — making new content: campaign plans, quests, locations,
 *                 companions, parties, NPC voices, letters, arcs
 *
 * ── Settings (all optional, read from .env at call time) ─────────────────
 *   OLLAMA_URL                 Ollama address (default http://localhost:11434)
 *   OLLAMA_MODEL               default model for every role
 *   OLLAMA_MODEL_DM / _SUMMARY / _EXTRACTION / _GENERATION
 *                              per-role override
 *   OLLAMA_NUM_CTX             context window sent to Ollama on every call.
 *                              Ollama otherwise runs a model at a small
 *                              default window and silently drops the start
 *                              of a longer prompt.
 *   OLLAMA_THINK               'true' turns gemma's thinking on (default off:
 *                              thinking adds latency to every turn, and the
 *                              reply text is what the game reads)
 *
 * Accessors read process.env on every call (like featureFlags.js), so a test
 * can set a variable after imports are hoisted.
 */

/** The only model ID written anywhere in server/. */
export const DEFAULT_LOCAL_MODEL = 'gemma4:12b';

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/**
 * Context window, in tokens, sent to Ollama as `num_ctx`. Measured on the
 * builder PC (RTX 5070 Ti, 16 GB) on 2026-11-13: gemma4:12b at 65,536 runs
 * 100% on the GPU (10.9 GB of 16.3 GB used); 131,072 also fits (11.6 GB).
 * 65,536 leaves headroom while holding the ~12,900-token DM system prompt,
 * chronicles, and a long session. The model itself supports 262,144.
 */
export const DEFAULT_CONTEXT_WINDOW = 65536;

export const ROLES = Object.freeze(['dm', 'summary', 'extraction', 'generation']);

const ROLE_ENV = {
  dm: 'OLLAMA_MODEL_DM',
  summary: 'OLLAMA_MODEL_SUMMARY',
  extraction: 'OLLAMA_MODEL_EXTRACTION',
  generation: 'OLLAMA_MODEL_GENERATION',
};

/**
 * The model for a role. An unknown role is a programming error — it throws
 * rather than silently picking a model.
 */
export function modelFor(role = 'dm') {
  if (!ROLES.includes(role)) {
    throw new Error(`Unknown local-model role "${role}" (expected one of: ${ROLES.join(', ')})`);
  }
  return process.env[ROLE_ENV[role]] || process.env.OLLAMA_MODEL || DEFAULT_LOCAL_MODEL;
}

/** Every role with its resolved model, for the status endpoint and the UI. */
export function roleModels() {
  return Object.fromEntries(ROLES.map((r) => [r, modelFor(r)]));
}

/** The distinct models the configured roles need installed. */
export function requiredModels() {
  return [...new Set(ROLES.map((r) => modelFor(r)))];
}

export function ollamaUrl() {
  return process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL;
}

export function contextWindow() {
  const n = Number(process.env.OLLAMA_NUM_CTX);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_CONTEXT_WINDOW;
}

export function thinkingEnabled() {
  return process.env.OLLAMA_THINK === 'true';
}

export default {
  DEFAULT_LOCAL_MODEL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_CONTEXT_WINDOW,
  ROLES,
  modelFor,
  roleModels,
  requiredModels,
  ollamaUrl,
  contextWindow,
  thinkingEnabled,
};
