/**
 * Phase 2.2 — in-flight session locks.
 *
 * Guards the turn-level idempotency behaviour: one turn per session at a time,
 * a 409 for a concurrent second POST, and — the part that matters most — a
 * lock that always gets released, because a leaked lock wedges the session
 * until the process restarts.
 */

import {
  acquireSessionLock,
  releaseSessionLock,
  isSessionLocked,
  _clearAllSessionLocks,
  STALE_LOCK_MS,
} from '../server/utils/sessionLocks.js';

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

async function run() {
  _clearAllSessionLocks();

  // ============================================================
  console.log('\n=== Test 1: basic acquire / release ===\n');
  // ============================================================

  assert(!isSessionLocked('s1'), 'a fresh session is unlocked');

  const first = acquireSessionLock('s1');
  assert(first.acquired === true, 'first acquisition succeeds');
  assert(isSessionLocked('s1'), 'session now reports locked');

  const second = acquireSessionLock('s1');
  assert(second.acquired === false, 'a concurrent second acquisition is refused');
  assert(typeof second.heldForMs === 'number', 'refusal reports how long the lock has been held');

  releaseSessionLock('s1');
  assert(!isSessionLocked('s1'), 'release clears the lock');

  const third = acquireSessionLock('s1');
  assert(third.acquired === true, 'the session is usable again after release');
  releaseSessionLock('s1');

  // ============================================================
  console.log('\n=== Test 2: locks are per-session ===\n');
  // ============================================================

  acquireSessionLock('a');
  const otherSession = acquireSessionLock('b');
  assert(otherSession.acquired === true, 'locking session a does not block session b');
  assert(isSessionLocked('a') && isSessionLocked('b'), 'both sessions independently locked');
  releaseSessionLock('a');
  assert(!isSessionLocked('a') && isSessionLocked('b'), 'releasing a leaves b locked');
  releaseSessionLock('b');

  // ============================================================
  console.log('\n=== Test 3: numeric and string ids are the same lock ===\n');
  // ============================================================

  // The route passes req.params (a string); callers elsewhere may pass a number.
  // If these keyed differently the lock would silently never engage.
  acquireSessionLock(42);
  const asString = acquireSessionLock('42');
  assert(asString.acquired === false, 'id 42 and "42" resolve to the same lock');
  releaseSessionLock(42);
  assert(!isSessionLocked('42'), 'releasing by number clears the string key');

  // ============================================================
  console.log('\n=== Test 4: releasing an unheld lock is safe ===\n');
  // ============================================================

  // The route calls release() in a finally that also runs when acquisition
  // never happened, so this must not throw.
  let threw = false;
  try {
    releaseSessionLock('never-held');
    releaseSessionLock('never-held');
  } catch {
    threw = true;
  }
  assert(!threw, 'double release / release-without-acquire does not throw');

  // ============================================================
  console.log('\n=== Test 5: stale locks are reclaimed, not wedged ===\n');
  // ============================================================

  assert(STALE_LOCK_MS >= 5 * 60 * 1000, 'stale window is long enough not to expire a live turn');

  // Simulate a leaked lock by rewinding its start time past the stale window.
  // Reaching in via the module's own API rather than the Map keeps this honest:
  // acquire, then verify the reclaim path by waiting is impractical, so assert
  // the boundary condition through isSessionLocked instead.
  acquireSessionLock('stale-session');
  assert(isSessionLocked('stale-session'), 'lock is held immediately after acquisition');

  const originalNow = Date.now;
  try {
    // Jump the clock past the stale window.
    Date.now = () => originalNow() + STALE_LOCK_MS + 1000;
    assert(!isSessionLocked('stale-session'), 'a lock older than the stale window reports unlocked');
    const reclaimed = acquireSessionLock('stale-session');
    assert(reclaimed.acquired === true, 'a stale lock is reclaimed rather than wedging the session');
  } finally {
    Date.now = originalNow;
  }
  releaseSessionLock('stale-session');

  _clearAllSessionLocks();
  assert(!isSessionLocked('a') && !isSessionLocked('b'), 'clear helper drops every lock');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

await run();
