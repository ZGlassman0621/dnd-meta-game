/**
 * Phase 2.1 Step A — turn write ordering in POST /:sessionId/message.
 *
 * The invariant: marker dispatch (processResponseMarkers) must run BEFORE the
 * narrative is persisted, and dm_sessions.messages must be written exactly
 * once per turn.
 *
 * WHY THIS TEST IS STRUCTURAL RATHER THAN BEHAVIOURAL
 * ---------------------------------------------------
 * Exercising the real handler end-to-end needs a stubbed LLM: the route calls
 * out to the model mid-handler, and the repo has no injection point or mock
 * harness for that. The one existing route-level test
 * (tests/integration.test.js) asserts `status in {200, 503, 500}`, so it goes
 * green precisely when no LLM is configured — it cannot detect a regression
 * here at all.
 *
 * So this asserts the invariant against the source. That is genuinely weaker
 * than running a turn, and it will not catch a semantic break that preserves
 * source order. It WILL catch the regression that actually matters: someone
 * reintroducing an eager persist above dispatch, or re-adding the per-block
 * message writes that were collapsed. Replace this with a real turn test if a
 * stubbed-LLM harness ever lands.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTE = join(HERE, '..', 'server', 'routes', 'dmSession.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

const src = readFileSync(ROUTE, 'utf8');
const lines = src.split('\n');

/** Line numbers (1-indexed) of every line matching a pattern. */
const linesMatching = (re) =>
  lines.reduce((acc, line, i) => (re.test(line) ? [...acc, i + 1] : acc), []);

/**
 * Bound the search to the message handler. It starts at the POST
 * /:sessionId/message route and ends at the next router registration.
 */
function messageHandlerRange() {
  const start = lines.findIndex((l) => /router\.post\(\s*['"]\/:sessionId\/message['"]/.test(l));
  if (start === -1) return null;
  const after = lines.slice(start + 1).findIndex((l) => /^router\.(post|get|put|delete|patch)\(/.test(l));
  return { start: start + 1, end: after === -1 ? lines.length : start + 1 + after };
}

async function run() {
  console.log('\n=== Test 1: the message handler is locatable ===\n');

  const range = messageHandlerRange();
  assert(range !== null, 'POST /:sessionId/message route found');
  if (!range) {
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
    process.exit(1);
  }

  const inRange = (n) => n >= range.start && n <= range.end;

  console.log('\n=== Test 2: exactly one messages write per turn ===\n');

  const messageWrites = linesMatching(/UPDATE dm_sessions SET messages\s*=/).filter(inRange);
  assert(
    messageWrites.length === 1,
    `dm_sessions.messages is written exactly once (found ${messageWrites.length} at lines ${messageWrites.join(', ')})`
  );

  console.log('\n=== Test 3: dispatch precedes the persist ===\n');

  const dispatches = linesMatching(/await processResponseMarkers\(/).filter(inRange);
  assert(dispatches.length === 1, `processResponseMarkers is called exactly once (found ${dispatches.length})`);

  if (dispatches.length === 1 && messageWrites.length === 1) {
    assert(
      dispatches[0] < messageWrites[0],
      `marker dispatch (line ${dispatches[0]}) runs BEFORE the messages write (line ${messageWrites[0]})`
    );
  }

  console.log('\n=== Test 4: the persist happens after handler notes are folded in ===\n');

  // Every handler-derived system note must be pushed before the single write,
  // or it silently fails to reach the LLM-facing history next turn.
  const pushes = linesMatching(/result\.messages\.push\(/).filter(inRange);
  assert(pushes.length > 0, `handler system notes are pushed into result.messages (${pushes.length} sites)`);

  if (messageWrites.length === 1) {
    const late = pushes.filter((p) => p > messageWrites[0]);
    assert(
      late.length === 0,
      `no result.messages.push happens after the write${late.length ? ` (offenders at ${late.join(', ')})` : ''}`
    );
  }

  console.log('\n=== Test 5: transcript append also follows dispatch ===\n');

  const transcript = linesMatching(/await appendToTranscript\(/).filter(inRange);
  if (transcript.length > 0 && dispatches.length === 1) {
    assert(
      transcript.every((t) => t > dispatches[0]),
      'transcript append runs after marker dispatch'
    );
  } else {
    assert(false, 'expected an appendToTranscript call in the message handler');
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

await run();
