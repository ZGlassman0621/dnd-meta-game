/**
 * Rolling-summary unit tests (no Claude API calls).
 *
 * Exercises the pure functions — shouldRoll and applyToMessages —
 * with a range of session shapes. The actual summarization is tested
 * separately (it requires a live Sonnet call and a real session).
 */

import {
  shouldRoll,
  applyToMessages,
  KEEP_TAIL_MESSAGES,
  ROLL_TRIGGER_THRESHOLD,
  MIN_ROLL_AGE_MESSAGES
} from '../server/services/rollingSummaryService.js';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ ${msg}`); }
}

function mkMessages(count, withSystem = true) {
  const out = [];
  if (withSystem) out.push({ role: 'system', content: 'SYSTEM PROMPT' });
  for (let i = out.length; i < count; i++) {
    out.push({ role: i % 2 === 1 ? 'user' : 'assistant', content: `message ${i}` });
  }
  return out;
}

console.log('\n=== shouldRoll ===\n');

// Below trigger threshold → no roll
const short = mkMessages(20);
assert(
  shouldRoll({ rolling_summary: null, rolling_summary_through_index: null }, short) === false,
  'below trigger threshold returns false'
);

// At threshold + plenty to summarize → roll
const ripe = mkMessages(40);
assert(
  shouldRoll({ rolling_summary: null, rolling_summary_through_index: null }, ripe) === true,
  `fresh session past threshold (${ripe.length} >= ${ROLL_TRIGGER_THRESHOLD}) should roll`
);

// At threshold but too close to previous summary → don't roll yet
// (e.g., we already summarized through index 35 and only have 40 total; tail is 16, only 4 messages summarizable)
const tooSoon = mkMessages(40);
const closeToTail = 40 - KEEP_TAIL_MESSAGES - 1; // leaves MIN_ROLL_AGE_MESSAGES - 1 to summarize
assert(
  shouldRoll({ rolling_summary: 'prior', rolling_summary_through_index: closeToTail }, tooSoon) === false,
  `not enough new messages since last roll (${MIN_ROLL_AGE_MESSAGES} threshold)`
);

// Messages are a lot past threshold and we have many unsummarized → roll
const bigSession = mkMessages(60);
assert(
  shouldRoll({ rolling_summary: 'prior', rolling_summary_through_index: 20 }, bigSession) === true,
  'long session with plenty of unsummarized mid-messages should roll'
);

// Empty / invalid inputs → no roll
assert(shouldRoll({}, []) === false, 'empty messages array returns false');
assert(shouldRoll({}, null) === false, 'null messages returns false');

console.log('\n=== applyToMessages ===\n');

// No summary set → messages pass through unchanged
const pristine = mkMessages(10);
const untouched = applyToMessages({ rolling_summary: null }, pristine);
assert(untouched.summaryInjected === false, 'no summary set → no injection');
assert(untouched.messages === pristine, 'returns the same messages reference');
assert(untouched.originalCount === 10 && untouched.finalCount === 10, 'counts unchanged');

// Summary set, messages past the through-index → inject + trim
const longSession = mkMessages(40);
const session = { rolling_summary: 'PRIOR SCENES SUMMARY', rolling_summary_through_index: 20 };
const applied = applyToMessages(session, longSession);
assert(applied.summaryInjected === true, 'summary injected');
// Expect: system + synthetic summary message + messages 21..39 = 1 + 1 + 19 = 21
assert(applied.messages.length === 21, `compacted length is 21 (got ${applied.messages.length})`);
assert(applied.messages[0].role === 'system', 'first message is still system');
assert(applied.messages[1].role === 'user', 'second message is the synthetic summary (user role)');
assert(applied.messages[1].content.includes('PREVIOUS SCENES'), 'synthetic message has the expected prefix');
assert(applied.messages[1].content.includes('PRIOR SCENES SUMMARY'), 'synthetic message contains the stored summary');
assert(applied.messages[2].content === 'message 21', 'tail starts at the message right after the summarized range');

// Summary set but through-index points past end → safe no-op
const drifted = applyToMessages(
  { rolling_summary: 'x', rolling_summary_through_index: 1000 },
  longSession
);
assert(drifted.summaryInjected === false, 'through-index past end → no injection');
assert(drifted.messages === longSession, 'returns messages unchanged when drifted');

// Summary with no system message (edge case — shouldn't happen in practice but defensive)
const noSys = mkMessages(40, false);
const appliedNoSys = applyToMessages(
  { rolling_summary: 'SUMMARY', rolling_summary_through_index: 20 },
  noSys
);
assert(appliedNoSys.summaryInjected === true, 'injects even without system message');
assert(appliedNoSys.messages[0].role === 'user', 'first message is the synthetic summary');
assert(appliedNoSys.messages[0].content.includes('SUMMARY'), 'synthetic contains the summary');

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));
process.exit(failed === 0 ? 0 : 1);
