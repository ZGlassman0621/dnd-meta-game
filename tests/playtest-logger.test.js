/**
 * Tests for server/utils/playtestLogger.js — instrumentation that surfaces
 * context-drift signals during sessions. Pure formatting; we capture
 * console.log output and assert on the strings.
 */

import assert from 'node:assert/strict';
import {
  logTurn,
  logSessionEnd,
  newSessionTotals,
  accumulateTurn
} from '../server/utils/playtestLogger.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ FAIL: ${name}`); console.log(`    ${err.message}`); failed++; }
}

// Capture console.log output for assertions
function capture(fn) {
  const lines = [];
  const orig = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try { fn(); }
  finally { console.log = orig; }
  return lines.join('\n');
}

console.log('\n=== logTurn — per-turn line ===\n');

test('Minimum required fields produce a line', () => {
  const out = capture(() => logTurn({ sessionId: 1, turnNumber: 1, sessionType: 'dm' }));
  assert.match(out, /\[playtest\]/);
  assert.match(out, /s=1 t=1 type=dm/);
});

test('Prompt size renders in KB with one decimal', () => {
  const out = capture(() => logTurn({ sessionId: 1, turnNumber: 1, sessionType: 'dm', promptChars: 18432 }));
  assert.match(out, /prompt=18\.4k/);
});

test('Output tokens render with t suffix', () => {
  const out = capture(() => logTurn({ sessionId: 1, turnNumber: 1, sessionType: 'dm', outputTokens: 412 }));
  assert.match(out, /out=412t/);
});

test('Markers shown only when non-zero', () => {
  const a = capture(() => logTurn({ sessionId: 1, turnNumber: 1, sessionType: 'dm', markersValid: 0, markersMalformed: 0 }));
  const b = capture(() => logTurn({ sessionId: 1, turnNumber: 1, sessionType: 'dm', markersValid: 2, markersMalformed: 1 }));
  assert.doesNotMatch(a, /markers=/);
  assert.match(b, /markers=2\/1bad/);
});

test('Correction events flagged distinctly', () => {
  const queued = capture(() => logTurn({ sessionId: 1, turnNumber: 1, sessionType: 'dm', correctionQueued: true }));
  const consumed = capture(() => logTurn({ sessionId: 1, turnNumber: 1, sessionType: 'dm', correctionConsumed: true }));
  assert.match(queued, /will-correct/);
  assert.match(consumed, /fixed-prev/);
});

test('Canon retire fires drift signal (! suffix)', () => {
  const out = capture(() => logTurn({ sessionId: 1, turnNumber: 1, sessionType: 'prelude_arc', canonRetired: 1 }));
  assert.match(out, /canon-1!/);
});

test('Chapter advance surfaces CHAPTER+ flag', () => {
  const out = capture(() => logTurn({ sessionId: 1, turnNumber: 1, sessionType: 'prelude_arc', chapterAdvanced: true }));
  assert.match(out, /CHAPTER\+/);
});

test('Emergences surfaced with capX for rejections', () => {
  const out = capture(() => logTurn({ sessionId: 1, turnNumber: 1, sessionType: 'prelude_arc', emergencesOffered: 2, capViolations: 1 }));
  assert.match(out, /emerg=2/);
  assert.match(out, /capX=1/);
});

test('Custom tag appears in parens at end', () => {
  const out = capture(() => logTurn({ sessionId: 1, turnNumber: 1, sessionType: 'prelude_arc', tag: 'CLIFFHANGER' }));
  assert.match(out, /\(CLIFFHANGER\)/);
});

console.log('\n=== logSessionEnd — multi-line summary ===\n');

test('Banner includes session id and turn count', () => {
  const out = capture(() => logSessionEnd({
    sessionId: 99, sessionType: 'prelude_arc', totalTurns: 28
  }));
  assert.match(out, /SESSION SUMMARY · session 99 · prelude_arc · 28 turns/);
});

test('Duration computed when start timestamp provided', () => {
  const start = Date.now() - 30 * 60 * 1000;  // 30 min ago
  const out = capture(() => logSessionEnd({
    sessionId: 1, sessionType: 'dm', totalTurns: 1, startTimestamp: start
  }));
  assert.match(out, /Duration: 30 minutes/);
});

test('Marker malformed rate computed as percentage', () => {
  const out = capture(() => logSessionEnd({
    sessionId: 1, sessionType: 'dm', totalTurns: 10,
    totals: { markers_emitted: 50, markers_malformed: 5 }
  }));
  assert.match(out, /50 emitted, 5 malformed \(10\.0%\)/);
});

test('Correction self-correction rate computed', () => {
  const out = capture(() => logSessionEnd({
    sessionId: 1, sessionType: 'dm', totalTurns: 10,
    totals: { corrections_queued: 6, corrections_consumed: 5 }
  }));
  assert.match(out, /Corrections: 6 queued, 5 acted on \(83% self-corrected next turn\)/);
});

test('Canon retire surfaces drift warning emoji', () => {
  const out = capture(() => logSessionEnd({
    sessionId: 1, sessionType: 'prelude_arc', totalTurns: 10,
    totals: { canon_added: 5, canon_retired: 1 }
  }));
  assert.match(out, /Canon: \+5 added, -1 retired ⚠ retire = potential drift/);
});

test('Canon with no retires omits drift warning', () => {
  const out = capture(() => logSessionEnd({
    sessionId: 1, sessionType: 'prelude_arc', totalTurns: 10,
    totals: { canon_added: 5, canon_retired: 0 }
  }));
  assert.doesNotMatch(out, /drift/);
});

test('Prompt-size growth shows arrow + delta', () => {
  const grew = capture(() => logSessionEnd({
    sessionId: 1, sessionType: 'dm', totalTurns: 10,
    firstPromptChars: 10000, lastPromptChars: 18000
  }));
  const shrank = capture(() => logSessionEnd({
    sessionId: 1, sessionType: 'dm', totalTurns: 10,
    firstPromptChars: 18000, lastPromptChars: 12000
  }));
  assert.match(grew, /↑8\.0k drift/);
  assert.match(shrank, /↓6\.0k drift/);
});

test('NPC re-entries listed', () => {
  const out = capture(() => logSessionEnd({
    sessionId: 1, sessionType: 'prelude_arc', totalTurns: 10,
    npcReentries: ['Moss(t4→t14)', 'Vask(t1→t9)']
  }));
  assert.match(out, /NPC re-entries: Moss\(t4→t14\), Vask\(t1→t9\)/);
});

test('Notes rendered as separate Note: lines', () => {
  const out = capture(() => logSessionEnd({
    sessionId: 1, sessionType: 'dm', totalTurns: 5,
    notes: ['Theme committed: Acolyte', 'Player ended early']
  }));
  assert.match(out, /Note: Theme committed: Acolyte/);
  assert.match(out, /Note: Player ended early/);
});

console.log('\n=== accumulateTurn — totals helper ===\n');

test('newSessionTotals returns zeros for all known fields', () => {
  const t = newSessionTotals();
  assert.equal(t.markers_emitted, 0);
  assert.equal(t.canon_retired, 0);
  assert.equal(t.emergences_offered, 0);
  assert.equal(t.chapter_advances, 0);
});

test('accumulateTurn adds marker counts correctly', () => {
  const t = newSessionTotals();
  accumulateTurn(t, { markersValid: 3, markersMalformed: 1 });
  accumulateTurn(t, { markersValid: 2, markersMalformed: 0 });
  assert.equal(t.markers_emitted, 6);
  assert.equal(t.markers_malformed, 1);
});

test('accumulateTurn increments correction counters from booleans', () => {
  const t = newSessionTotals();
  accumulateTurn(t, { correctionQueued: true });
  accumulateTurn(t, { correctionConsumed: true });
  accumulateTurn(t, { correctionQueued: true, correctionConsumed: true });
  assert.equal(t.corrections_queued, 2);
  assert.equal(t.corrections_consumed, 2);
});

test('accumulateTurn handles missing fields gracefully', () => {
  const t = newSessionTotals();
  accumulateTurn(t, {});  // all fields absent
  assert.equal(t.markers_emitted, 0);
  assert.equal(t.canon_added, 0);
});

test('accumulateTurn no-ops on null totals', () => {
  // Should not throw
  accumulateTurn(null, { markersValid: 5 });
});

console.log(`\n==================================================`);
console.log(`Playtest Logger Tests: ${passed} passed, ${failed} failed`);
console.log(`==================================================\n`);
process.exit(failed === 0 ? 0 : 1);
