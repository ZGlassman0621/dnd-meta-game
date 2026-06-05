/**
 * Prelude auto-model picker tests (v1.0.66).
 *
 * Covers pickAutoModel() — the pure function that decides Sonnet vs Opus
 * on each turn when the player has mode='auto'. Focus areas:
 *
 *   • Hard triggers (chapter 4, session wrap) — always Opus, cap bypassed
 *   • Soft triggers (heavy weight, HP drop ≤ -3, chapter promise) — Opus,
 *     subject to the AUTO_SOFT_OPUS_MAX consecutive-turn cap
 *   • Light weight — explicit AI downshift to Sonnet
 *   • Consecutive-Opus cap — after N soft-triggered turns, force Sonnet
 *   • Defaults — no triggers means Sonnet
 *
 * The cap exists because Opus, once running, tends to re-tag 'heavy' on
 * its own emotionally loaded output, creating a feedback loop where the
 * system never returns to Sonnet for ordinary texture. v1.0.66 breaks
 * the loop server-side.
 */

import { pickAutoModel } from '../server/services/preludeSessionService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}
function assertEqual(actual, expected, message) {
  if (actual === expected) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message} — expected "${expected}", got "${actual}"`); failed++; }
}

// ---------------------------------------------------------------------------

console.log('\n=== HARD triggers — always Opus, cap bypassed ===\n');
{
  // Chapter 4 forces Opus regardless of consecutive turns
  const ch4 = pickAutoModel({ consecutiveSoftOpusTurns: 99 }, { chapter: 4 }, 0);
  assertEqual(ch4.model, 'opus', 'chapter-4 → opus');
  assertEqual(ch4.reason, 'chapter-4', 'chapter-4 reason');
  assertEqual(ch4.hard, true, 'chapter-4 marked hard (bypasses cap)');

  // Session-wrap forces Opus regardless of consecutive turns
  const wrap = pickAutoModel({ consecutiveSoftOpusTurns: 99 }, { chapter: 2 }, 140);
  assertEqual(wrap.model, 'opus', 'session-wrap → opus');
  assertEqual(wrap.reason, 'session-wrap', 'session-wrap reason');
  assertEqual(wrap.hard, true, 'session-wrap marked hard');

  // Ch4 beats everything else
  const ch4heavy = pickAutoModel({ lastSceneWeight: 'light' }, { chapter: 4 }, 0);
  assertEqual(ch4heavy.model, 'opus', 'chapter-4 overrides light tag');
}

console.log('\n=== AI-downshift to Sonnet ===\n');
{
  // Light weight always drops to Sonnet (explicit AI release)
  const light = pickAutoModel({ lastSceneWeight: 'light' }, { chapter: 2 }, 0);
  assertEqual(light.model, 'sonnet', 'light-weight → sonnet');
  assertEqual(light.reason, 'light-weight', 'light-weight reason');

  // Even with HP drop, a light tag wins (AI explicitly flagging texture)
  const lightOverHp = pickAutoModel(
    { lastSceneWeight: 'light', lastHpDelta: -5 },
    { chapter: 2 },
    0
  );
  assertEqual(lightOverHp.model, 'sonnet', 'light beats hp-drop');
}

console.log('\n=== SOFT triggers — Opus, cap applies ===\n');
{
  // First soft-triggered Opus turn (counter=0) fires normally
  const heavy1 = pickAutoModel(
    { lastSceneWeight: 'heavy', consecutiveSoftOpusTurns: 0 },
    { chapter: 2 },
    0
  );
  assertEqual(heavy1.model, 'opus', 'first soft-heavy turn → opus');
  assertEqual(heavy1.reason, 'heavy-weight', 'reason tracked');
  assertEqual(heavy1.hard, false, 'soft trigger not marked hard');

  // Second soft-triggered Opus turn (counter=1) still fires
  const heavy2 = pickAutoModel(
    { lastSceneWeight: 'heavy', consecutiveSoftOpusTurns: 1 },
    { chapter: 2 },
    0
  );
  assertEqual(heavy2.model, 'opus', 'second soft-heavy turn → opus');

  // Third consecutive (counter=2) hits the cap → Sonnet cooldown
  const heavy3 = pickAutoModel(
    { lastSceneWeight: 'heavy', consecutiveSoftOpusTurns: 2 },
    { chapter: 2 },
    0
  );
  assertEqual(heavy3.model, 'sonnet', 'third consecutive soft-opus → Sonnet (cap)');
  assertEqual(heavy3.reason, 'soft-opus-cap', 'soft-opus-cap reason exposed');

  // Cap also trips on consecutiveSoftOpusTurns > MAX
  const heavyMany = pickAutoModel(
    { lastSceneWeight: 'heavy', consecutiveSoftOpusTurns: 9 },
    { chapter: 2 },
    0
  );
  assertEqual(heavyMany.model, 'sonnet', 'counter >> MAX still caps to Sonnet');
}

console.log('\n=== HP drop as soft trigger ===\n');
{
  const hpDrop = pickAutoModel(
    { lastHpDelta: -5, consecutiveSoftOpusTurns: 0 },
    { chapter: 2 },
    0
  );
  assertEqual(hpDrop.model, 'opus', 'HP drop ≤ -3 → opus');
  assertEqual(hpDrop.reason, 'hp-drop', 'hp-drop reason');

  // Small HP drop doesn't escalate
  const minorHp = pickAutoModel(
    { lastHpDelta: -2 },
    { chapter: 2 },
    0
  );
  assertEqual(minorHp.model, 'sonnet', 'HP drop -2 stays on sonnet');

  // Healing positive delta doesn't escalate
  const healed = pickAutoModel(
    { lastHpDelta: 5 },
    { chapter: 2 },
    0
  );
  assertEqual(healed.model, 'sonnet', 'HP gain doesn\'t escalate');

  // HP drop also capped
  const hpCapped = pickAutoModel(
    { lastHpDelta: -8, consecutiveSoftOpusTurns: 2 },
    { chapter: 2 },
    0
  );
  assertEqual(hpCapped.model, 'sonnet', 'HP drop cap applies too');
  assertEqual(hpCapped.reason, 'soft-opus-cap', 'HP drop cap reason');
}

console.log('\n=== Chapter promise as soft trigger ===\n');
{
  const promise = pickAutoModel(
    { lastChapterPromiseTurn: true, consecutiveSoftOpusTurns: 0 },
    { chapter: 3 },
    0
  );
  assertEqual(promise.model, 'opus', 'chapter-promise last turn → opus');
  assertEqual(promise.reason, 'chapter-promise', 'chapter-promise reason');

  // Also capped
  const promiseCap = pickAutoModel(
    { lastChapterPromiseTurn: true, consecutiveSoftOpusTurns: 2 },
    { chapter: 3 },
    0
  );
  assertEqual(promiseCap.model, 'sonnet', 'chapter-promise soft cap applies');
}

console.log('\n=== Default — no triggers, Sonnet ===\n');
{
  const dflt = pickAutoModel({}, { chapter: 1 }, 0);
  assertEqual(dflt.model, 'sonnet', 'no triggers → sonnet');
  assertEqual(dflt.reason, null, 'no reason');
  assertEqual(dflt.hard, false, 'default not hard');

  // Zero HP delta doesn't count as a trigger
  const zeroHp = pickAutoModel({ lastHpDelta: 0 }, { chapter: 1 }, 0);
  assertEqual(zeroHp.model, 'sonnet', 'lastHpDelta=0 doesn\'t escalate');
}

console.log('\n=== Precedence — hard triggers beat cap ===\n');
{
  // Even with cap hit, chapter 4 still forces Opus
  const ch4OverCap = pickAutoModel(
    {
      lastSceneWeight: 'heavy',
      consecutiveSoftOpusTurns: 99  // cap definitely hit
    },
    { chapter: 4 },
    0
  );
  assertEqual(ch4OverCap.model, 'opus', 'chapter-4 overrides cap');
  assertEqual(ch4OverCap.reason, 'chapter-4', 'chapter-4 wins precedence');

  // Same for session-wrap
  const wrapOverCap = pickAutoModel(
    {
      lastSceneWeight: 'heavy',
      consecutiveSoftOpusTurns: 99
    },
    { chapter: 2 },
    140
  );
  assertEqual(wrapOverCap.model, 'opus', 'session-wrap overrides cap');
}

console.log('\n==================================================');
console.log(`Prelude Auto-Model Tests: ${passed} passed, ${failed} failed`);
console.log('==================================================\n');

if (failed > 0) process.exit(1);
