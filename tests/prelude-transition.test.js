/**
 * Phase 2 chunk 2 — preludeTransitionService + handoff marker detection.
 *
 * Pure-logic tests against detection. The full executeTransition() round-
 * trip touches DB + Opus and is exercised by integration runs; this file
 * locks down the cheap edges that protect against regressions.
 */

import {
  detectDeparture,
  detectPreludeEnd,
  detectPreludeMarkers,
  stripPreludeMarkers
} from '../server/services/preludeMarkerDetection.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

console.log('\n=== detectDeparture ===\n');
{
  // Field-bearing form
  const a = detectDeparture('[DEPARTURE: reason="apprenticeship in Cormyr" tone="bittersweet"]');
  assert(a !== null, 'field-bearing marker detected');
  assert(a.reason === 'apprenticeship in Cormyr', 'reason captured');
  assert(a.tone === 'bittersweet', 'tone captured');

  // Bare form (presence only)
  const bare = detectDeparture('She walks into the dawn. [DEPARTURE]');
  assert(bare !== null, 'bare marker detected');
  assert(bare.reason === null, 'bare: reason null');
  assert(bare.tone === null, 'bare: tone null');

  // Negative cases
  assert(detectDeparture('') === null, 'empty → null');
  assert(detectDeparture('the rider departures into the dusk') === null, 'word "departures" without brackets → null');
}

console.log('\n=== detectPreludeEnd ===\n');
{
  assert(detectPreludeEnd('[PRELUDE_END]')?.signaled === true, 'bare marker signals');
  assert(detectPreludeEnd('[PRELUDE_END: note="end of childhood"]')?.signaled === true, 'field-bearing variant signals');
  assert(detectPreludeEnd('[prelude_end]')?.signaled === true, 'lowercase variant signals');
  assert(detectPreludeEnd('Mid-sentence: [PRELUDE_END] then more text')?.signaled === true, 'embedded marker signals');
  assert(detectPreludeEnd('') === null, 'empty → null');
  assert(detectPreludeEnd('just narrative, no marker') === null, 'no marker → null');
  assert(detectPreludeEnd('[CHAPTER_END: summary="x"]') === null, 'unrelated marker → null');
}

console.log('\n=== detectPreludeMarkers roll-up includes new fields ===\n');
{
  const text = `She mounts the cart for the long road south. [DEPARTURE: reason="conscription" tone="numb"] [PRELUDE_END]`;
  const all = detectPreludeMarkers(text);
  assert(all.departure !== null, 'roll-up includes departure');
  assert(all.departure.reason === 'conscription', 'departure.reason in roll-up');
  assert(all.preludeEnd !== null, 'roll-up includes preludeEnd');
  assert(all.preludeEnd.signaled === true, 'preludeEnd.signaled true');

  // Empty text yields null fields
  const empty = detectPreludeMarkers('quiet morning, nothing fires');
  assert(empty.departure === null, 'empty text → departure null');
  assert(empty.preludeEnd === null, 'empty text → preludeEnd null');
}

console.log('\n=== stripPreludeMarkers strips DEPARTURE / PRELUDE_END ===\n');
{
  const raw = 'She walks east. [DEPARTURE: reason="x" tone="y"] [PRELUDE_END] Fin.';
  const stripped = stripPreludeMarkers(raw);
  assert(!stripped.includes('[DEPARTURE'), 'DEPARTURE stripped');
  assert(!stripped.includes('[PRELUDE_END'), 'PRELUDE_END stripped');
  assert(stripped.includes('She walks east.'), 'leading prose preserved');
  assert(stripped.includes('Fin.'), 'trailing prose preserved');
}

console.log('\n==================================================');
console.log(`Prelude Transition Tests: ${passed} passed, ${failed} failed`);
console.log('==================================================\n');

if (failed > 0) process.exit(1);
