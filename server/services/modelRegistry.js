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

// ============================================================
// Persistence — `_app_settings`
// ============================================================

const SETTING_KEYS = { opus: 'model_pin_opus', sonnet: 'model_pin_sonnet' };

/**
 * Load persisted pins into the in-memory cache. Called once at server start.
 *
 * Deliberately swallows its own failures. A model pin is a preference, not a
 * prerequisite: if the settings table is unreachable the compiled-in defaults
 * are a perfectly good answer, and taking the whole server down over it would
 * turn a cosmetic problem into an outage.
 */
export async function hydratePins() {
  try {
    const { dbAll } = await import('../database.js');
    const rows = await dbAll(
      'SELECT key, value FROM _app_settings WHERE key IN (?, ?)',
      [SETTING_KEYS.opus, SETTING_KEYS.sonnet]
    );
    const found = {};
    for (const row of rows || []) {
      if (row.key === SETTING_KEYS.opus) found.opus = row.value;
      if (row.key === SETTING_KEYS.sonnet) found.sonnet = row.value;
    }
    setPins(found);
    if (found.opus || found.sonnet) {
      console.log(`[modelRegistry] pins loaded from settings: opus=${pins.opus} sonnet=${pins.sonnet}`);
    }
    return getPins();
  } catch (err) {
    console.warn(`[modelRegistry] could not load persisted pins, using defaults: ${err.message}`);
    return getPins();
  }
}

/**
 * Persist pins and update the cache. Unlike `hydratePins`, failures here DO
 * throw — the caller is a user clicking "update", and silently not saving a
 * change they asked for is worse than an error message.
 */
export async function persistPins(next = {}) {
  const { dbRun } = await import('../database.js');
  const applied = setPins(next);
  for (const family of ['opus', 'sonnet']) {
    await dbRun(
      `INSERT INTO _app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [SETTING_KEYS[family], applied[family]]
    );
  }
  return applied;
}

/** Clear persisted pins and fall back to the shipped defaults. */
export async function resetPins() {
  const { dbRun } = await import('../database.js');
  await dbRun('DELETE FROM _app_settings WHERE key IN (?, ?)', [SETTING_KEYS.opus, SETTING_KEYS.sonnet]);
  pins.opus = DEFAULT_OPUS_MODEL;
  pins.sonnet = DEFAULT_SONNET_MODEL;
  return getPins();
}

// ============================================================
// Catalog — what this API key can actually reach
// ============================================================

const MODELS_URL = 'https://api.anthropic.com/v1/models?limit=40';

/**
 * Ask Anthropic which models this key can use.
 *
 * `/v1/models` is a metadata endpoint — no tokens, no per-call charge — which is
 * what makes a staleness check affordable on every boot.
 *
 * Returns models newest-first, which is the order the API documents and which
 * `newestFor` depends on. Sorting locally by ID would be wrong: string order
 * does not know that `claude-opus-5` is newer than `claude-opus-4-8`.
 */
export async function fetchCatalog() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set — cannot check for model updates');
  }
  const res = await fetch(MODELS_URL, {
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    }
  });
  const body = await res.json();
  if (!res.ok || body?.error) {
    throw new Error(body?.error?.message || `models endpoint returned HTTP ${res.status}`);
  }
  return (body.data || []).map(m => ({ id: m.id, displayName: m.display_name || m.id }));
}

/**
 * The newest model of a family, given a newest-first catalog.
 *
 * Matches on a hyphen-delimited segment (`-opus-`, `-sonnet-`) rather than a
 * bare substring, so a future family whose name happens to contain "opus" is
 * not mistaken for one. Families outside the two we pin — Fable, Haiku — are
 * simply never returned, which is why selecting one is a deliberate act rather
 * than something an update button can do by accident.
 */
export function newestFor(family, catalog = []) {
  const needle = `-${family}-`;
  return catalog.find(m => `${m.id}-`.includes(needle))?.id || null;
}

/**
 * Compare the live pins against a catalog.
 *
 * Shape: `{ opus: {pinned, newest, stale}, sonnet: {…}, anyStale }`.
 *
 * `stale` means "the pin is not the newest of its family" — it says nothing
 * about whether updating is safe. Adopting a new generation can change request
 * semantics (Claude 5 turned adaptive thinking on by default and that alone
 * would have emptied every narrative), which is exactly why this reports and
 * never applies. The decision stays with a human reading the release notes.
 */
export function comparePins(catalog = []) {
  const current = getPins();
  const out = { anyStale: false };
  for (const family of ['opus', 'sonnet']) {
    const newest = newestFor(family, catalog);
    const stale = Boolean(newest) && newest !== current[family];
    out[family] = { pinned: current[family], newest, stale };
    if (stale) out.anyStale = true;
  }
  return out;
}

/**
 * Boot-time staleness check. Logs; never applies, never throws.
 *
 * Fire-and-forget from `server/index.js` — it makes a network call, and the
 * server must not wait on Anthropic being reachable in order to start.
 */
export async function logStalenessCheck() {
  try {
    const comparison = comparePins(await fetchCatalog());
    if (!comparison.anyStale) {
      console.log(`[modelRegistry] pins are current: opus=${comparison.opus.pinned} sonnet=${comparison.sonnet.pinned}`);
      return comparison;
    }
    for (const family of ['opus', 'sonnet']) {
      const f = comparison[family];
      if (f.stale) {
        console.warn(
          `[modelRegistry] a newer ${family} is available: pinned ${f.pinned}, newest ${f.newest}. ` +
          'Review the migration notes before adopting it — a new generation can change request semantics. ' +
          'Update from the AI provider strip on the session setup screen.'
        );
      }
    }
    return comparison;
  } catch (err) {
    console.warn(`[modelRegistry] staleness check skipped: ${err.message}`);
    return null;
  }
}

// FUTURE_FEATURE — play on a previous model.
//
// The pieces are already here: `fetchCatalog()` returns every model the key can
// reach (not just the newest), `setPins`/`persistPins` accept any ID, and
// `comparePins` reports rather than enforces. What is missing is deliberate
// product design, not plumbing:
//
//   • Pin scope. Today a pin is installation-wide. "Play this character on
//     Opus 4.7" wants it per-campaign or per-session, which means a column
//     rather than an `_app_settings` row, and a decision about what happens to
//     an in-flight session when the pin changes.
//   • Prompt-cache cost. Caches are per-model, so alternating models between
//     turns pays a cold cache write every time it switches.
//   • Request-shape drift in the other direction. Pre-4.7 models need
//     `budget_tokens` rather than adaptive thinking, and `temperature` is
//     accepted there and rejected on Claude 5. Supporting older generations
//     means `claude.js` branching on the pinned generation, which is a real
//     compatibility layer rather than a config value.
