/**
 * Model registry — the one place that knows which Claude model this install runs.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * Before v1.0.182 the model IDs were a pair of consts in `claude.js`, and three
 * other call sites had drifted into hardcoding their own copies:
 * `dmSession.js` twice (chronicle budget, history compression) and
 * `preludeArcService.js` once (provenance stamp on a generated arc). Two of
 * those were still naming Sonnet 4.6 long after the gameplay path had moved on,
 * so a "bump the model" change silently missed them.
 *
 * Every model ID in the server now resolves through `opusModel()` /
 * `sonnetModel()`. Adding a fourth caller costs one import instead of one more
 * string to forget.
 *
 * ── Sync on purpose ──────────────────────────────────────────────────────
 * The accessors are synchronous because `claude.chat()` is on the per-turn hot
 * path and should not await a database read to find out what to call. Pins live
 * in a module-level cache; v1.0.183 hydrates that cache from `_app_settings` at
 * startup and refreshes it on write. Until hydration runs — and in tests, which
 * never run it — the accessors return the compiled-in defaults, so nothing here
 * depends on a database being reachable.
 */

// The shipped defaults live HERE rather than in `claude.js`, and `claude.js`
// imports them back. The other direction would be a cycle — claude.js needs the
// registry on its hot path, so the registry must not need claude.js.
//
// Model aliases (no date suffix) auto-resolve to the latest *build* of a given
// generation, but the generation itself is pinned: an alias never crosses from
// 4-7 to 4-8 to 5 on its own. That is deliberate — a new generation can change
// request semantics (Claude 5 turned adaptive thinking on by default), so
// crossing one is a decision, not a dependency update.
export const DEFAULT_OPUS_MODEL = 'claude-opus-5';
export const DEFAULT_SONNET_MODEL = 'claude-sonnet-5';

// Mutable module-level cache. Writes go through `setPins`, never direct
// assignment, so there is a single place to add persistence and invalidation.
const pins = {
  opus: DEFAULT_OPUS_MODEL,
  sonnet: DEFAULT_SONNET_MODEL
};

/** The model ID used for gameplay turns and any other Opus-tier work. */
export function opusModel() {
  return pins.opus;
}

/** The model ID used for the cost opt-down and for extraction / summary work. */
export function sonnetModel() {
  return pins.sonnet;
}

/** Both pins, for status endpoints and the update UI. */
export function getPins() {
  return { ...pins };
}

/** The compiled-in defaults, for "reset to shipped values". */
export function getDefaultPins() {
  return { opus: DEFAULT_OPUS_MODEL, sonnet: DEFAULT_SONNET_MODEL };
}

/**
 * Update one or both pins in memory.
 *
 * Accepts a partial — `setPins({ opus })` leaves sonnet alone. Ignores empty
 * values rather than letting a blank form field blank out a pin, because an
 * empty `model` field on a request is a 404 from the Anthropic API and the
 * failure would surface a long way from its cause.
 */
export function setPins(next = {}) {
  if (typeof next.opus === 'string' && next.opus.trim()) {
    pins.opus = next.opus.trim();
  }
  if (typeof next.sonnet === 'string' && next.sonnet.trim()) {
    pins.sonnet = next.sonnet.trim();
  }
  return getPins();
}
