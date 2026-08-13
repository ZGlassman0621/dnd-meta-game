/**
 * Claude request/response shape — the Claude 5 contract (v1.0.182).
 *
 * These are the assertions that the model bump turned out to depend on, and
 * that nothing else in the suite covers. Two of them guard bugs that were live
 * for the length of one commit:
 *
 *   1. THE RESPONSE READER. Adaptive thinking is on by default on Claude 5, so
 *      the API returns `content: [{type:'thinking'}, {type:'text'}]`. `claude.js`
 *      read the narrative as `content[0].text`, which is `undefined` on a
 *      thinking block — every turn would have returned an empty narrative. The
 *      whole suite passed anyway, because the stub used to emit a text block
 *      first. It now emits the true shape (see `helpers/llmHarness.js`), and
 *      this file asserts the extraction directly.
 *
 *   2. THE REQUEST BODY. `thinking` and `output_config.effort` have to be on the
 *      request, and the model has to come from the registry rather than a
 *      literal. A silent regression here is expensive rather than loud: the call
 *      still succeeds, it just runs the wrong model or at the wrong effort.
 *
 * No billed calls — `installLlmStub()` swaps `globalThis.fetch`, so no request
 * reaches api.anthropic.com, while the real `claude.js` still runs.
 */

import { chat } from '../server/services/claude.js'
import { opusModel, sonnetModel, getPins, setPins, getDefaultPins } from '../server/services/modelRegistry.js'
import { installLlmStub, restoreLlm } from './helpers/llmHarness.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.log(`  ✗ ${message}`)
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${JSON.stringify(actual)})`)
}

const SYSTEM = 'You are a Dungeon Master.'
const MESSAGES = [{ role: 'user', content: 'I open the door.' }]

async function run() {
  // ============================================================
  console.log('\n=== Test 1: the narrative survives a thinking-first response ===\n')
  // ============================================================

  {
    const llm = installLlmStub()
    try {
      // The harness leads with a thinking block by default — the real shape.
      llm.reply({ text: 'The door swings wide.', thinking: 'internal reasoning' })
      const out = await chat(SYSTEM, MESSAGES, 1, 'opus', 4000, true)

      assertEqual(out, 'The door swings wide.', 'text is read past the leading thinking block')
      assert(!/internal reasoning/.test(out), 'thinking content never reaches the narrative')
    } finally {
      restoreLlm()
    }
  }

  // ============================================================
  console.log('\n=== Test 2: a thinking-disabled response still reads ===\n')
  // ============================================================

  {
    const llm = installLlmStub()
    try {
      llm.reply({ text: 'No thinking here.', thinking: false })
      const out = await chat(SYSTEM, MESSAGES, 1, 'opus', 4000, true)
      assertEqual(out, 'No thinking here.', 'a text-only response is unaffected by the fix')
    } finally {
      restoreLlm()
    }
  }

  // ============================================================
  console.log('\n=== Test 3: the request carries thinking, effort and a pinned model ===\n')
  // ============================================================

  {
    const llm = installLlmStub()
    try {
      llm.reply('ok')
      await chat(SYSTEM, MESSAGES, 1, 'opus', 4000, true)
      const body = llm.lastCall.body

      assertEqual(body.model, opusModel(), 'modelChoice=opus resolves through the registry')
      assertEqual(body.thinking?.type, 'adaptive', 'adaptive thinking is requested explicitly')
      assert(typeof body.output_config?.effort === 'string', 'an effort level is set')
      assert(body.max_tokens > 0, 'max_tokens is set')
    } finally {
      restoreLlm()
    }
  }

  {
    const llm = installLlmStub()
    try {
      llm.reply('ok')
      await chat(SYSTEM, MESSAGES, 1, 'sonnet', 4000, true)
      assertEqual(llm.lastCall.body.model, sonnetModel(), 'modelChoice=sonnet resolves through the registry')
    } finally {
      restoreLlm()
    }
  }

  // ============================================================
  console.log('\n=== Test 4: the registry is the single source of truth ===\n')
  // ============================================================

  {
    const original = getPins()
    const llm = installLlmStub()
    try {
      // Re-pinning must change what the next request sends. This is what makes
      // a runtime model update possible without a redeploy.
      setPins({ opus: 'claude-test-opus-99' })
      llm.reply('ok')
      await chat(SYSTEM, MESSAGES, 1, 'opus', 4000, true)
      assertEqual(llm.lastCall.body.model, 'claude-test-opus-99', 're-pinning changes the model actually sent')

      // A partial update must not blank the other pin.
      assertEqual(sonnetModel(), original.sonnet, 'a partial setPins leaves the other pin alone')

      // Empty / non-string values are ignored rather than blanking a pin — a
      // blank `model` is a 404 from the API, a long way from its cause.
      setPins({ opus: '   ' })
      assertEqual(opusModel(), 'claude-test-opus-99', 'a blank value does not blank the pin')
      setPins({ opus: null })
      assertEqual(opusModel(), 'claude-test-opus-99', 'a null value does not blank the pin')
    } finally {
      restoreLlm()
      setPins(original)
    }

    assertEqual(opusModel(), original.opus, 'pins restored after the test')
    const defaults = getDefaultPins()
    assert(
      defaults.opus.startsWith('claude-opus-') && defaults.sonnet.startsWith('claude-sonnet-'),
      `shipped defaults name an Opus and a Sonnet (got ${defaults.opus} / ${defaults.sonnet})`
    )
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

await run()
