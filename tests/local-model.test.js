/**
 * Local model — the registry (localModels.js) and the request/response contract
 * of the one client every AI call goes through (llm.js).
 *
 * Replaced the old cloud-model request-shape and model-registry tests in the
 * local-model-only job. What is pinned here, and why each matters:
 *
 *   - Every role resolves to a model in ONE place; defaults are gemma4:12b and
 *     .env overrides work per role. An unknown role throws rather than
 *     silently picking a model.
 *   - `num_ctx` is sent on EVERY call. Without it Ollama runs at its own small
 *     default window and silently drops the start of a long prompt — which is
 *     where the DM rules live.
 *   - The system prompt goes first, once, with the old prompt-cache markers
 *     stripped; earlier `system` entries in the history are not re-sent.
 *   - A streamed (NDJSON) reply is accumulated across chunks; thinking blocks
 *     never reach the player; tagged errors name the fix.
 *
 * No network: the harness stub (and two hand-rolled fetch stubs) answer every
 * request. The test runner also points OLLAMA_URL at a dead port.
 */

import {
  DEFAULT_LOCAL_MODEL,
  DEFAULT_CONTEXT_WINDOW,
  ROLES,
  modelFor,
  roleModels,
  requiredModels,
  contextWindow,
  thinkingEnabled,
} from '../server/services/localModels.js';
import llm, { stripCacheMarkers } from '../server/services/llm.js';
import { installLlmStub, restoreLlm } from './helpers/llmHarness.js';

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ ${msg}`); }
}
function eq(actual, expected, msg) {
  check(actual === expected, `${msg} (got ${JSON.stringify(actual)})`);
}

// Settings this file changes; restored at the end so nothing leaks.
const ENV_KEYS = ['OLLAMA_MODEL', 'OLLAMA_MODEL_DM', 'OLLAMA_MODEL_SUMMARY', 'OLLAMA_MODEL_EXTRACTION', 'OLLAMA_MODEL_GENERATION', 'OLLAMA_NUM_CTX', 'OLLAMA_THINK'];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
for (const k of ENV_KEYS) delete process.env[k];

async function run() {
  console.log('\n=== 1. Registry: one place names the models ===\n');
  eq(DEFAULT_LOCAL_MODEL, 'gemma4:12b', 'the default local model is gemma4:12b (Zach, 2026-11-10)');
  check(ROLES.join(',') === 'dm,summary,extraction,generation', 'the four roles are dm, summary, extraction, generation');
  for (const r of ROLES) eq(modelFor(r), DEFAULT_LOCAL_MODEL, `role ${r} defaults to gemma4:12b`);
  eq(requiredModels().length, 1, 'with no overrides, one model covers every role');
  let threw = false;
  try { modelFor('opus'); } catch { threw = true; }
  check(threw, 'an unknown role throws instead of picking a model');

  process.env.OLLAMA_MODEL = 'TEST_all_roles';
  eq(modelFor('summary'), 'TEST_all_roles', 'OLLAMA_MODEL overrides every role');
  process.env.OLLAMA_MODEL_SUMMARY = 'TEST_summary_only';
  eq(modelFor('summary'), 'TEST_summary_only', 'a per-role setting beats OLLAMA_MODEL');
  eq(modelFor('dm'), 'TEST_all_roles', 'other roles keep the general override');
  eq(roleModels().summary, 'TEST_summary_only', 'roleModels() reports the per-role model');
  eq(requiredModels().length, 2, 'requiredModels() lists each distinct model once');
  delete process.env.OLLAMA_MODEL;
  delete process.env.OLLAMA_MODEL_SUMMARY;

  eq(contextWindow(), DEFAULT_CONTEXT_WINDOW, 'context window defaults to 65,536');
  eq(DEFAULT_CONTEXT_WINDOW, 65536, 'the default window is the measured 65,536');
  process.env.OLLAMA_NUM_CTX = '32768';
  eq(contextWindow(), 32768, 'OLLAMA_NUM_CTX overrides the window');
  process.env.OLLAMA_NUM_CTX = 'not-a-number';
  eq(contextWindow(), DEFAULT_CONTEXT_WINDOW, 'a malformed OLLAMA_NUM_CTX falls back to the default');
  delete process.env.OLLAMA_NUM_CTX;
  eq(thinkingEnabled(), false, 'thinking is off by default');
  process.env.OLLAMA_THINK = 'true';
  eq(thinkingEnabled(), true, 'OLLAMA_THINK=true turns it on');
  delete process.env.OLLAMA_THINK;

  console.log('\n=== 2. Request shape ===\n');
  const stub = installLlmStub();
  try {
    stub.reply('The torch gutters.');
    const sys = 'RULES\n\n<!-- CACHE_BREAK:AFTER_CORE -->\n\nCHARACTER\n\n<!-- CACHE_BREAK:AFTER_CHARACTER -->\n\nSTATE';
    const history = [
      { role: 'system', content: 'an old system entry that must not be re-sent' },
      { role: 'user', content: 'I enter.' },
      { role: 'assistant', content: 'A cold hall.' },
      { role: 'user', content: 'I listen.' },
    ];
    const reply = await llm.chat(sys, history, 1, 'extraction', 1234, false);
    const call = stub.lastCall;
    eq(reply, 'The torch gutters.', 'the reply text comes back');
    eq(call.model, modelFor('extraction'), 'the request names the role\'s model');
    eq(call.numCtx, contextWindow(), 'num_ctx is sent on every call');
    eq(call.maxTokens, 1234, 'maxTokens becomes num_predict');
    eq(call.body.stream, true, 'the reply is requested as a stream');
    eq(call.body.think, false, 'thinking is off unless OLLAMA_THINK=true');
    eq(call.body.keep_alive, '30m', 'the model stays loaded between turns');
    eq(call.body.messages[0].role, 'system', 'the system prompt leads');
    eq(call.body.messages.filter((m) => m.role === 'system').length, 1, 'exactly one system message is sent');
    check(!/CACHE_BREAK/.test(call.system), 'cache markers are stripped from the system prompt');
    check(/RULES[\s\S]*CHARACTER[\s\S]*STATE/.test(call.system), 'all three prompt tiers survive, in order');
    eq(call.lastUserMessage, 'I listen.', 'the last user turn is the player action');
    eq(stripCacheMarkers('a\n<!-- CACHE_BREAK:AFTER_CORE -->\nb'), 'a\n\nb', 'stripCacheMarkers keeps a paragraph break');

    console.log('\n=== 3. Session helpers ===\n');
    stub.reply('You stand at the gate.');
    const started = await llm.startSession('SYS', 'Begin.');
    eq(started.response, 'You stand at the gate.', 'startSession returns the opening');
    eq(started.model, modelFor('dm'), 'startSession reports the DM role model');
    eq(started.messages[0].role, 'system', 'the stored history starts with the system prompt');
    eq(stub.lastCall.model, modelFor('dm'), 'a session turn runs on the DM role');
    stub.reply('The gate creaks.');
    const cont = await llm.continueSession('SYS', started.messages, 'I push the gate.');
    eq(cont.response, 'The gate creaks.', 'continueSession returns the reply');
    eq(cont.messages.filter((m) => m.role === 'system').length, 1, 'continueSession does not duplicate the system prompt');

    console.log('\n=== 4. Reply cleanup and meta ===\n');
    stub.reply({ text: '<think>secret plan</think>The door opens.\n\n(Note: this is a test.)', stopReason: 'stop', usage: { input_tokens: 900, output_tokens: 12 } });
    let meta = null;
    const cleaned = await llm.chat('SYS', [{ role: 'user', content: 'go' }], 1, 'dm', 500, false, { onApiMeta: (m) => { meta = m; } });
    eq(cleaned, 'The door opens.', 'thinking blocks and trailing meta-notes never reach the player');
    eq(meta?.role, 'dm', 'onApiMeta reports the role');
    eq(meta?.model, modelFor('dm'), 'onApiMeta reports the model');
    eq(meta?.usage?.input_tokens, 900, 'onApiMeta reports prompt tokens (prompt_eval_count)');
    eq(meta?.usage?.output_tokens, 12, 'onApiMeta reports reply tokens (eval_count)');
    eq(meta?.stop_reason, 'stop', 'onApiMeta reports the stop reason');
    stub.reply('{"a": 1} (Note: keep me)');
    const raw = await llm.chat('SYS', [{ role: 'user', content: 'json' }], 1, 'extraction', 500, true);
    eq(raw, '{"a": 1} (Note: keep me)', 'rawResponse=true returns the text untouched (JSON callers)');

    console.log('\n=== 5. Errors name the fix ===\n');
    stub.reply({ status: 404, error: 'model not found' });
    let err404 = null;
    try { await llm.chat('SYS', [{ role: 'user', content: 'x' }], 3, 'dm'); } catch (e) { err404 = e; }
    check(/^LOCAL_MODEL_MISSING: .*ollama pull/.test(err404?.message || ''), `a 404 is tagged LOCAL_MODEL_MISSING with the pull command (got ${err404?.message})`);
    const callsBefore = stub.callCount;
    stub.reply({ status: 500, error: 'boom' });
    let err500 = null;
    try { await llm.chat('SYS', [{ role: 'user', content: 'x' }], 3, 'dm'); } catch (e) { err500 = e; }
    check(/Ollama error \(HTTP 500\)/.test(err500?.message || ''), 'a model error surfaces');
    eq(stub.callCount - callsBefore, 1, 'model errors are not retried');
  } finally {
    restoreLlm();
  }

  const down = installLlmStub({ ollamaDown: true });
  try {
    let errDown = null;
    try { await llm.chat('SYS', [{ role: 'user', content: 'x' }], 1, 'dm'); } catch (e) { errDown = e; }
    check(/^LOCAL_MODEL_UNAVAILABLE: .*Start Ollama/.test(errDown?.message || ''), `Ollama not running is tagged LOCAL_MODEL_UNAVAILABLE (got ${errDown?.message})`);
    const status = await llm.checkStatus();
    eq(status.available, false, 'checkStatus reports unavailable when Ollama is down');
    eq(status.error_code, 'unreachable', 'and says why');
    eq(status.provider, 'Ollama (local)', 'the status always names the provider, even when down (the client and integration test read it)');
    eq(down.callCount, 0, 'no chat call was recorded');
  } finally {
    restoreLlm();
  }

  console.log('\n=== 6. Status and streaming (hand-rolled Ollama) ===\n');
  const realFetch = globalThis.fetch;
  try {
    const ok = installLlmStub();
    const status = await llm.checkStatus();
    eq(status.available, true, 'checkStatus reports available when every role model is installed');
    eq(status.role_models.dm, modelFor('dm'), 'checkStatus lists the role models');
    eq(status.context_window, contextWindow(), 'checkStatus reports the context window');
    check(ok.statusProbes >= 1, 'availability is read from /api/tags');
    restoreLlm();

    globalThis.fetch = async (url) => {
      if (String(url).includes('/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'some-other:7b' }] }), { status: 200 });
      }
      throw new Error('unexpected');
    };
    const missing = await llm.checkStatus();
    eq(missing.available, false, 'a missing model makes the local AI unavailable');
    eq(missing.error_code, 'no_model', 'with error_code no_model');
    check(/ollama pull/.test(missing.error || ''), 'and the error names the pull command');

    // A real Ollama stream: several NDJSON chunks, the last one done:true.
    globalThis.fetch = async (url) => {
      if (!String(url).includes('/api/chat')) throw new Error('unexpected');
      const chunks = [
        { message: { role: 'assistant', content: 'The ' }, done: false },
        { message: { role: 'assistant', content: 'ogre ' }, done: false },
        { message: { role: 'assistant', content: 'roars.' }, done: false },
        { model: 'TEST_stream', message: { role: 'assistant', content: '' }, done: true, done_reason: 'length', prompt_eval_count: 40, eval_count: 3 },
      ];
      return new Response(chunks.map((c) => JSON.stringify(c)).join('\n') + '\n', { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
    };
    let streamMeta = null;
    const streamed = await llm.chat('SYS', [{ role: 'user', content: 'go' }], 1, 'dm', 3, false, { onApiMeta: (m) => { streamMeta = m; } });
    eq(streamed, 'The ogre roars.', 'streamed chunks are joined into one reply');
    eq(streamMeta?.stop_reason, 'length', 'a cut-off reply reports done_reason length');
    eq(streamMeta?.model, 'TEST_stream', 'the model Ollama reports is the one logged');
  } finally {
    globalThis.fetch = realFetch;
    restoreLlm();
  }
}

try {
  await run();
} finally {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
