/**
 * Stubbed-LLM harness — end-to-end turn testing without billed API calls.
 *
 * CLAUDE.md lists "no stubbed-LLM harness" as the biggest structural gap: the
 * turn handler in `routes/dmSession.js` could not be tested end to end, so
 * `tests/turn-write-ordering.test.js` had to assert on the handler's *source
 * text* rather than its behaviour. This module closes that gap.
 *
 * ─── Why the seam is `globalThis.fetch` ───────────────────────────────────
 *
 * Every Anthropic request in this codebase bottoms out in a bare `fetch(...)`
 * inside `services/claude.js`. `fetch` is a global binding resolved at call
 * time, so replacing `globalThis.fetch` intercepts those calls even though
 * `claude.js` was imported long before. That buys three things a module mock
 * would not:
 *
 *   1. **Zero production code changes.** No injectable transport, no
 *      `if (process.env.NODE_ENV === 'test')` branch in a gameplay path. The
 *      code under test is byte-identical to the code that ships.
 *   2. **The real `claude.js` runs.** `buildSystemParam`'s three-tier cache
 *      splitting, the status-class retry triage, `cleanupResponse`, the
 *      tagged-error prefixes (`OVERLOADED:` / `AUTH_FAILURE:` / …) — all of it
 *      executes. A module-level mock of `claude.chat` would skip precisely the
 *      logic most likely to break.
 *   3. **Request assertions.** Tests can inspect what was actually sent — that
 *      the CURRENT VITALS block reached the system prompt, that a marker
 *      correction was injected, that lean transforms stripped what they should.
 *
 * Cost safety is structural rather than conventional: the stub intercepts
 * *every* `api.anthropic.com` request and never forwards one, so a test cannot
 * spend money even with a live `ANTHROPIC_API_KEY` in the environment. It
 * throws on an un-stubbed Anthropic path rather than falling through.
 *
 * Ollama's `:11434` endpoint is intercepted too, reporting "running but model
 * not installed". Without that, `getLLMProvider`'s auto-fallback would probe a
 * real Ollama daemon and results would differ between developer machines.
 * Everything else — notably the test's own request to the ephemeral Express
 * server — passes straight through to the captured real `fetch`.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────
 *
 *   const llm = installLlmStub()
 *   llm.reply('The ogre swings. [HP_CHANGE: delta=-7 reason="ogre club"]')
 *   const server = await startTurnServer()
 *   const res = await server.post(`/api/dm-session/${id}/message`, { action: 'I attack' })
 *   ...
 *   await server.close(); restoreLlm()
 *
 * ─── One caveat worth knowing ─────────────────────────────────────────────
 *
 * `claude.js` retries 429/529/503/500 with real `setTimeout` backoff (up to
 * ~60s for a 529). Do not script those statuses unless the test is prepared to
 * wait. Use 401 to exercise the error path — it is classified non-retryable and
 * returns immediately.
 */

import express from 'express'
import { once } from 'node:events'

const ANTHROPIC_HOST = 'api.anthropic.com'
const OLLAMA_PORT = ':11434'

/** Captured before patching so passthrough can never recurse into the stub. */
const REAL_FETCH = globalThis.fetch

let active = null

function urlOf(input) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input?.url || String(input)
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

/**
 * Normalise `claude.js`'s `system` parameter for assertions.
 *
 * It sends either a plain string or an array of content blocks (the prompt
 * cache tiers). Tests almost always want "did this text reach the model",
 * which should not depend on which form the cache-splitting logic chose, so we
 * expose both: `system` (flattened) and `systemBlocks` (raw).
 */
function flattenSystem(system) {
  if (typeof system === 'string') return system
  if (Array.isArray(system)) return system.map(b => b?.text || '').join('\n\n')
  return ''
}

/**
 * Turn a scripted responder into an HTTP Response.
 *
 * Accepted responder return values:
 *   'narrative text'                       → 200, that text as the assistant turn
 *   { text, stopReason, usage, model }     → 200, with those fields
 *   { status: 401, error: 'message' }      → that HTTP status (error path testing)
 */
function toResponse(value, requestBody) {
  const spec = typeof value === 'string' ? { text: value } : (value || {})

  if (spec.status && spec.status !== 200) {
    return jsonResponse(
      { type: 'error', error: { type: 'stub_error', message: spec.error || `HTTP ${spec.status}` } },
      spec.status
    )
  }

  return jsonResponse({
    id: 'msg_stub',
    type: 'message',
    role: 'assistant',
    model: spec.model || requestBody?.model || 'claude-opus-4-7',
    content: [{ type: 'text', text: spec.text ?? '' }],
    stop_reason: spec.stopReason || 'end_turn',
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      ...(spec.usage || {})
    }
  })
}

/**
 * Replace `globalThis.fetch` with the Anthropic/Ollama-intercepting stub.
 *
 * Sets a placeholder `ANTHROPIC_API_KEY` when none is present, because
 * `claude.isClaudeAvailable()` gates the whole Claude branch on it. An existing
 * real key is left alone — it cannot be used, since no request escapes.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.strict=true]  throw when the queue is exhausted rather
 *                                      than serving `opts.fallback`. Keeps a
 *                                      test honest about how many calls it made.
 * @param {string}  [opts.fallback]     response used when `strict` is false.
 */
export function installLlmStub(opts = {}) {
  if (active) throw new Error('installLlmStub: a stub is already installed — call restoreLlm() first')

  const state = {
    strict: opts.strict !== false,
    fallback: opts.fallback ?? 'The scene continues.',
    /** Scripted `/v1/messages` responders, consumed in order. */
    queue: [],
    /** Every intercepted `/v1/messages` call, in order. */
    calls: [],
    /** Count of `/v1/messages/count_tokens` probes (the availability check). */
    statusProbes: 0
  }

  async function stubFetch(input, init) {
    const url = urlOf(input)

    if (url.includes(OLLAMA_PORT)) {
      // "Running, but the configured model is not installed" → available:false.
      // Deterministic regardless of whether the developer runs Ollama locally.
      return jsonResponse({ models: [] })
    }

    if (!url.includes(ANTHROPIC_HOST)) {
      return REAL_FETCH(input, init)
    }

    if (url.includes('/count_tokens')) {
      state.statusProbes++
      return jsonResponse({ input_tokens: 12 })
    }

    let body = {}
    try {
      body = JSON.parse(init?.body || '{}')
    } catch {
      // A malformed body is worth surfacing rather than swallowing — it would
      // mean claude.js built a request the real API would also reject.
      throw new Error('llmHarness: intercepted an Anthropic request with unparseable JSON body')
    }

    const call = {
      url,
      model: body.model,
      maxTokens: body.max_tokens,
      system: flattenSystem(body.system),
      systemBlocks: Array.isArray(body.system) ? body.system : null,
      messages: body.messages || [],
      /** Last user turn — the player action for a gameplay turn. */
      lastUserMessage: [...(body.messages || [])].reverse().find(m => m.role === 'user')?.content || ''
    }
    state.calls.push(call)

    const responder = state.queue.shift()
    if (responder === undefined) {
      if (state.strict) {
        throw new Error(
          `llmHarness: unscripted Anthropic call #${state.calls.length} ` +
          `(purpose looks like: "${String(call.lastUserMessage).slice(0, 80)}…"). ` +
          'Script it with llm.reply(...) or construct the stub with { strict: false }.'
        )
      }
      return toResponse(state.fallback, body)
    }

    const value = typeof responder === 'function' ? await responder(call) : responder
    return toResponse(value, body)
  }

  globalThis.fetch = stubFetch
  if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = 'test-key-not-used'

  active = {
    /** Queue one response. String, spec object, or `(call) => string|spec`. */
    reply(value) {
      state.queue.push(value)
      return this
    },
    /** Queue several responses at once. */
    replyAll(...values) {
      values.forEach(v => state.queue.push(v))
      return this
    },
    get calls() {
      return state.calls
    },
    get lastCall() {
      return state.calls[state.calls.length - 1] || null
    },
    get callCount() {
      return state.calls.length
    },
    get statusProbes() {
      return state.statusProbes
    },
    get pending() {
      return state.queue.length
    },
    /** Drop recorded calls and any unconsumed script. Between test blocks. */
    reset() {
      state.calls.length = 0
      state.queue.length = 0
      state.statusProbes = 0
      return this
    }
  }

  return active
}

/** Restore the real `fetch`. Safe to call when no stub is installed. */
export function restoreLlm() {
  globalThis.fetch = REAL_FETCH
  active = null
}

/**
 * Boot the DM-session router on an ephemeral port.
 *
 * Deliberately NOT `server/index.js`: that module calls `app.listen(3000)` at
 * import time (colliding with a running dev server) and mounts `authMiddleware`
 * over every `/api` route. This builds the minimal app the turn loop needs —
 * same router, same JSON body limit, no auth — so a test exercises the handler
 * rather than the login flow.
 *
 * `initNarrativeSystems()` is likewise not called. It registers cross-service
 * event listeners that only fire on the session-end path; leaving them out
 * keeps a turn test measuring the turn.
 *
 * The caller must have run `initDatabase()` first.
 */
export async function startTurnServer() {
  const { default: dmSessionRoutes } = await import('../../server/routes/dmSession.js')

  const app = express()
  app.use(express.json({ limit: '2mb' }))
  app.use('/api/dm-session', dmSessionRoutes)

  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  const base = `http://127.0.0.1:${port}`

  /** Uses REAL_FETCH directly so test traffic never appears in `llm.calls`. */
  async function request(method, path, body) {
    const res = await REAL_FETCH(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    let json = null
    try {
      json = await res.json()
    } catch {
      // Non-JSON bodies are a legitimate outcome to assert on (e.g. a crash
      // page), so surface the status rather than throwing here.
    }
    return { status: res.status, ok: res.ok, body: json }
  }

  return {
    url: base,
    post: (path, body) => request('POST', path, body),
    get: (path) => request('GET', path),
    close: () => new Promise(resolve => server.close(resolve))
  }
}

/**
 * Seed a campaign + character + active DM session ready to receive a turn.
 *
 * The session's `messages[0]` is a system message, because the turn handler
 * rebuilds its per-turn suffix by rewriting `messages[0].content` and skips the
 * work entirely when the first message is not a system turn.
 *
 * Every row is TEST_-prefixed, matching the suite's cleanup convention.
 */
export async function seedTurnFixture(dbRun, opts = {}) {
  const prefix = opts.prefix || 'TEST_HARNESS'
  const hp = opts.hp ?? 30
  const maxHp = opts.maxHp ?? 30

  const campaign = await dbRun(
    'INSERT INTO campaigns (name, setting, status) VALUES (?, ?, ?)',
    [`${prefix} Campaign`, 'Forgotten Realms', 'active']
  )
  const campaignId = Number(campaign.lastInsertRowid)

  const character = await dbRun(
    `INSERT INTO characters
       (name, class, race, level, current_hp, max_hp, current_location,
        experience_to_next_level, campaign_id, game_day, game_year)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [`${prefix} Hero`, 'Fighter', 'Human', 3, hp, maxHp, `${prefix}_Keep`, 900, campaignId, 100, 1492]
  )
  const characterId = Number(character.lastInsertRowid)

  const systemPrompt =
    opts.systemPrompt ||
    `You are the Dungeon Master for ${prefix} Hero, a level 3 Fighter.\n` +
    'Narrate the scene and emit mechanical markers where appropriate.'

  // Opening exchange, then `playerTurns` played rounds on top.
  //
  // Session end counts player actions as user messages at index > 1, so the
  // opening prompt does not count as one. A fixture left at zero played turns
  // takes the "the adventure ended before it truly began" early return, which
  // skips rewards, the game-date advance, the chronicle and the world tick
  // entirely — pass `playerTurns: 1` for any test that ends a session.
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Begin the adventure.' },
    { role: 'assistant', content: 'You stand at the gates of a ruined keep.' }
  ]
  for (let i = 0; i < (opts.playerTurns ?? 0); i++) {
    messages.push({ role: 'user', content: `I press deeper into the keep. (turn ${i + 1})` })
    messages.push({ role: 'assistant', content: `The corridor opens ahead. (turn ${i + 1})` })
  }

  // NOTE: dm_sessions has no campaign_id column — the campaign is reached
  // through characters.campaign_id. (routes/dmSession.js passes
  // `session.campaign_id` into the ai_call_log payload, where it is always
  // undefined; harmless, but do not mirror it here.)
  const session = await dbRun(
    `INSERT INTO dm_sessions
       (character_id, title, status, messages, model,
        game_start_day, game_start_year)
     VALUES (?, ?, 'active', ?, 'claude-opus-4-7', ?, ?)`,
    [
      characterId,
      `${prefix} Session`,
      JSON.stringify(messages),
      100,
      1492
    ]
  )

  return { campaignId, characterId, sessionId: Number(session.lastInsertRowid), systemPrompt }
}

/** Remove everything `seedTurnFixture` created, children first. */
export async function cleanupTurnFixture(dbRun, { campaignId, characterId, sessionId }) {
  if (sessionId) {
    await dbRun('DELETE FROM ai_call_log WHERE session_id = ?', [sessionId]).catch(() => {})
    await dbRun('DELETE FROM dm_sessions WHERE id = ?', [sessionId])
  }
  if (characterId) await dbRun('DELETE FROM characters WHERE id = ?', [characterId])
  if (campaignId) await dbRun('DELETE FROM campaigns WHERE id = ?', [campaignId])
}
