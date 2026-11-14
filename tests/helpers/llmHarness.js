/**
 * Stubbed-LLM harness — end-to-end testing of AI paths with no live model.
 *
 * The game's AI runs on a local model through Ollama (server/services/llm.js).
 * This harness lets the turn loop, chronicles and extraction be tested end to
 * end without Ollama running, without a network, and with deterministic
 * replies.
 *
 * ─── Why the seam is `globalThis.fetch` ───────────────────────────────────
 *
 * Every model request in this codebase bottoms out in a bare `fetch(...)`
 * inside `services/llm.js`. `fetch` is a global binding resolved at call
 * time, so replacing `globalThis.fetch` intercepts those calls even though
 * `llm.js` was imported long before. That buys three things a module mock
 * would not:
 *
 *   1. **Zero production code changes.** No injectable transport, no
 *      `if (process.env.NODE_ENV === 'test')` branch in a gameplay path. The
 *      code under test is byte-identical to the code that ships.
 *   2. **The real `llm.js` runs.** Request building (system message first,
 *      cache markers stripped, `num_ctx` always sent), the streamed-reply
 *      parser, `cleanupResponse`, the tagged errors — all of it executes. A
 *      module-level mock of `llm.chat` would skip precisely the logic most
 *      likely to break.
 *   3. **Request assertions.** Tests can inspect what was actually sent — that
 *      the CURRENT VITALS block reached the system prompt, that a marker
 *      correction was injected, that lean transforms stripped what they should.
 *
 * What is intercepted: any request to the configured Ollama address
 * (`OLLAMA_URL` — the test runner points it at a dead loopback port) or to
 * Ollama's default `:11434`:
 *   - `GET  /api/tags` → every model the configured roles need, so
 *     `llm.checkStatus()` reports available. Pass `{ ollamaDown: true }` to
 *     simulate Ollama not running.
 *   - `POST /api/chat` → the next scripted reply, as one line of Ollama NDJSON.
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
 * Error path: `llm.reply({ status: 500, error: 'boom' })` makes Ollama answer
 * HTTP 500; `llm.js` does not retry model errors, so the failure surfaces at
 * once.
 */

import express from 'express'
import { once } from 'node:events'
import { requiredModels, modelFor } from '../../server/services/localModels.js'

const OLLAMA_DEFAULT_PORT = ':11434'

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

function isOllamaUrl(url) {
  const configured = process.env.OLLAMA_URL
  return (configured && url.startsWith(configured)) || url.includes(OLLAMA_DEFAULT_PORT)
}

/**
 * Turn a scripted responder into an Ollama /api/chat HTTP Response.
 *
 * Accepted responder return values:
 *   'narrative text'                         → 200, that text as the reply
 *   { text, stopReason, usage, model }       → 200, with those fields
 *                                              (stopReason 'length' = cut off)
 *   { status: 500, error: 'message' }        → that HTTP status (error path)
 */
function toResponse(value, requestBody) {
  const spec = typeof value === 'string' ? { text: value } : (value || {})

  if (spec.status && spec.status !== 200) {
    return jsonResponse({ error: spec.error || `HTTP ${spec.status}` }, spec.status)
  }

  const line = {
    model: spec.model || requestBody?.model || modelFor('dm'),
    created_at: new Date(0).toISOString(),
    message: { role: 'assistant', content: spec.text ?? '' },
    done: true,
    done_reason: spec.stopReason || 'stop',
    prompt_eval_count: spec.usage?.input_tokens ?? 100,
    eval_count: spec.usage?.output_tokens ?? 50
  }
  return new Response(JSON.stringify(line) + '\n', {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson' }
  })
}

/**
 * Replace `globalThis.fetch` with the Ollama-intercepting stub.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.strict=true]  throw when the queue is exhausted rather
 *                                      than serving `opts.fallback`. Keeps a
 *                                      test honest about how many calls it made.
 * @param {string}  [opts.fallback]     response used when `strict` is false.
 * @param {boolean} [opts.ollamaDown]   /api/tags and /api/chat refuse, as if
 *                                      Ollama were not running.
 */
export function installLlmStub(opts = {}) {
  if (active) throw new Error('installLlmStub: a stub is already installed — call restoreLlm() first')

  const state = {
    strict: opts.strict !== false,
    fallback: opts.fallback ?? 'The scene continues.',
    ollamaDown: !!opts.ollamaDown,
    /** Scripted `/api/chat` responders, consumed in order. */
    queue: [],
    /** Every intercepted `/api/chat` call, in order. */
    calls: [],
    /** Count of `/api/tags` probes (the availability check). */
    statusProbes: 0
  }

  async function stubFetch(input, init) {
    const url = urlOf(input)

    if (!isOllamaUrl(url)) {
      return REAL_FETCH(input, init)
    }

    if (state.ollamaDown) {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } })
    }

    if (url.includes('/api/tags')) {
      state.statusProbes++
      return jsonResponse({ models: requiredModels().map((name) => ({ name, model: name })) })
    }

    if (!url.includes('/api/chat')) {
      throw new Error(`llmHarness: unexpected Ollama endpoint ${url}`)
    }

    let body = {}
    try {
      body = JSON.parse(init?.body || '{}')
    } catch {
      // A malformed body is worth surfacing rather than swallowing — it would
      // mean llm.js built a request Ollama would also reject.
      throw new Error('llmHarness: intercepted an Ollama request with unparseable JSON body')
    }

    const all = body.messages || []
    const messages = all.filter((m) => m.role !== 'system')
    const call = {
      url,
      /** The raw parsed request body — options, think, keep_alive, etc. */
      body,
      model: body.model,
      maxTokens: body.options?.num_predict,
      numCtx: body.options?.num_ctx,
      /** The system message's text (the DM prompt). */
      system: all.find((m) => m.role === 'system')?.content || '',
      messages,
      /** Last user turn — the player action for a gameplay turn. */
      lastUserMessage: [...messages].reverse().find((m) => m.role === 'user')?.content || ''
    }
    state.calls.push(call)

    const responder = state.queue.shift()
    if (responder === undefined) {
      if (state.strict) {
        throw new Error(
          `llmHarness: unscripted model call #${state.calls.length} ` +
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
 * import time (colliding with a running dev server). This builds the minimal
 * app the turn loop needs — same router, same JSON body limit — so a test
 * exercises the handler.
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
     VALUES (?, ?, 'active', ?, ?, ?, ?)`,
    [
      characterId,
      `${prefix} Session`,
      JSON.stringify(messages),
      modelFor('dm'),
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
