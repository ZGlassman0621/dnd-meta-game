/**
 * Mock-Anthropic integration harness primitive.
 *
 * Monkeypatches globalThis.fetch to intercept calls to api.anthropic.com and
 * return deterministic, canned Messages-API responses — so integration tests
 * can drive the REAL /start, /message and /claim handlers (real Express router,
 * real DB, real marker pipeline) WITHOUT a network call to Anthropic, latency,
 * or token spend.
 *
 * Crucially it PASSES THROUGH every non-Anthropic URL to the real fetch, so the
 * @libsql/client Turso HTTP client (which also uses fetch) and the test's own
 * localhost HTTP requests keep working untouched.
 *
 * Usage:
 *   const mock = installMockAnthropic({ reply: (body, i) => `Narrative ${i}` });
 *   ... drive handlers over HTTP ...
 *   mock.uninstall();
 *   // mock.calls -> [{ url, model, system, messages }, ...]  (/v1/messages only)
 *
 * `reply(body, callIndex, calls)` returns the assistant text for a /v1/messages
 * call. The default returns a >=30-char sentinel — the rolling-summary service
 * rejects summaries under 30 chars, so any default must clear that bar.
 */

const ANTHROPIC_HOST = 'api.anthropic.com';

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

export function installMockAnthropic(opts = {}) {
  const realFetch = globalThis.fetch;
  const calls = [];
  let messageCallIndex = 0;

  const reply = typeof opts.reply === 'function'
    ? opts.reply
    : (_body, i) => `MOCK DM NARRATIVE for call ${i}. The scene unfolds deterministically.`;

  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (!u.includes(ANTHROPIC_HOST)) {
      return realFetch(url, init);
    }

    // count_tokens probe (getLLMProvider -> checkClaudeStatus) -> 200 OK.
    if (u.includes('count_tokens')) {
      return jsonResponse({ input_tokens: 10 });
    }

    // /v1/messages — return a canned assistant turn.
    let body = {};
    try { body = JSON.parse(init?.body || '{}'); } catch { /* ignore */ }
    const i = messageCallIndex++;
    calls.push({ url: u, model: body.model, system: body.system, messages: body.messages });

    const text = String(reply(body, i, calls));
    return jsonResponse({
      id: `msg_mock_${i}`,
      type: 'message',
      role: 'assistant',
      model: body.model || 'claude-opus-4-8',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text }],
      usage: { input_tokens: 100, output_tokens: 50 }
    });
  };

  return {
    calls,
    uninstall() { globalThis.fetch = realFetch; }
  };
}

/**
 * Convenience: pull the most recent user-role message text out of a captured
 * /v1/messages request body (the player's action for a gameplay turn).
 */
export function lastUserContent(body) {
  const msgs = Array.isArray(body?.messages) ? body.messages : [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.role === 'user') return String(msgs[i].content ?? '');
  }
  return '';
}

/**
 * Convenience: is this /v1/messages call the rolling-summary / context-compression
 * summarizer call (vs a gameplay turn)? Both go through the same mock; the
 * summarizer system prompt says "summarizer".
 */
export function isSummarizerCall(body) {
  const sys = body?.system;
  const s = typeof sys === 'string' ? sys : JSON.stringify(sys || '');
  return s.includes('summarizer') || s.includes('Summarize this');
}
