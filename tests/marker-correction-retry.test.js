/**
 * Marker/rule correction retry (P1-G).
 *
 * Previously a pending marker correction was consumed unconditionally after
 * a single turn — if the AI ignored it, the correction was lost. Now
 * corrections are entries { kind, text, keys, attempts } that retry for up
 * to MAX_CORRECTION_ATTEMPTS turns, clear when the failure stops recurring,
 * and stop nagging (via correctionExhaustedKeys) once exhausted.
 *
 * Covers: queue-new, carry-forward with attempt counting, fixed-drops,
 * exhaustion + no-nag-while-persisting, clean-turn slate wipe, later
 * recurrence treated as new, rule-violation parity, legacy string format,
 * and renderCorrectionText.
 */

import {
  nextCorrectionEntries,
  renderCorrectionText,
  normalizeCorrectionEntries,
  MAX_CORRECTION_ATTEMPTS
} from '../server/services/markerCorrectionRetry.js';

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

const F = (key) => [{ schemaKey: key, errors: [{ field: 'Weight', reason: 'bad test failure' }] }];
const V = (rule) => [{ rule, description: 'test violation' }];

async function run() {
  console.log('\n=== Test: marker correction retry ===\n');

  // 1. New failure queued fresh.
  let r = nextCorrectionEntries(undefined, F('PROMISE_MADE'), []);
  assert(r.entries.length === 1, 'new marker failure queued');
  assert(r.entries[0].kind === 'marker' && r.entries[0].attempts === 0, 'new entry starts at attempts 0');
  assert(r.entries[0].keys.includes('PROMISE_MADE'), 'entry keys include the schema key');
  assert(r.entries[0].text.includes('PROMISE_MADE'), 'entry text names the schema');

  // 2. Recurring failure carried with attempts + 1.
  r = nextCorrectionEntries(r.entries, F('PROMISE_MADE'), []);
  assert(r.entries.length === 1 && r.entries[0].attempts === 1, 'recurring failure carried (attempts 1)');

  // 3. Fixed failure dropped.
  r = nextCorrectionEntries(r.entries, [], []);
  assert(r.entries.length === 0, 'failure that stops recurring is dropped');

  // 4. Exhaustion: surfaced MAX times, then dropped + remembered, no nagging
  // while the failure persists, slate wiped by a clean turn.
  let e = nextCorrectionEntries(undefined, F('K'), []);
  for (let i = 1; i < MAX_CORRECTION_ATTEMPTS; i++) {
    e = nextCorrectionEntries(e.entries, F('K'), []);
  }
  assert(e.entries.length === 1 && e.entries[0].attempts === MAX_CORRECTION_ATTEMPTS - 1,
    `entry reaches attempts ${MAX_CORRECTION_ATTEMPTS - 1} after ${MAX_CORRECTION_ATTEMPTS} surfacings`);
  e = nextCorrectionEntries(e.entries, F('K'), []);
  assert(e.entries.length === 0, 'exhausted entry dropped');
  assert(e.exhaustedKeys.includes('K'), 'exhausted key remembered');
  e = nextCorrectionEntries(e.entries, F('K'), [], { exhaustedKeys: e.exhaustedKeys });
  assert(e.entries.length === 0 && e.exhaustedKeys.includes('K'), 'no nagging while the failure persists');
  e = nextCorrectionEntries(e.entries, [], [], { exhaustedKeys: e.exhaustedKeys });
  assert(e.exhaustedKeys.length === 0, 'clean turn wipes the exhausted key');
  e = nextCorrectionEntries(e.entries, F('K'), [], { exhaustedKeys: e.exhaustedKeys });
  assert(e.entries.length === 1 && e.entries[0].attempts === 0, 'later recurrence queued as a new correction');

  // 5. Carried + new coexist; already-covered failures are not duplicated.
  const priorA = [{ kind: 'marker', text: 'tA', keys: ['A'], attempts: 0 }];
  r = nextCorrectionEntries(priorA, F('A').concat(F('B')), []);
  assert(r.entries.length === 2, 'carried A + new B = 2 entries (no duplicate for A)');
  assert(r.entries.find(x => x.keys.includes('A')).attempts === 1, 'A carried with attempts + 1');
  assert(r.entries.find(x => x.keys.includes('B')).attempts === 0, 'B queued fresh');

  // 6. Rule violations get the same retry semantics, keyed by rule name.
  r = nextCorrectionEntries(undefined, [], V('hard_stop_after_roll'));
  assert(r.entries.length === 1 && r.entries[0].kind === 'rule', 'rule violation queued');
  assert(r.entries[0].keys.includes('hard_stop_after_roll'), 'rule entry keyed by rule name');
  for (let i = 0; i < MAX_CORRECTION_ATTEMPTS; i++) {
    r = nextCorrectionEntries(r.entries, [], V('hard_stop_after_roll'), { exhaustedKeys: r.exhaustedKeys });
  }
  assert(r.entries.length === 0 && r.exhaustedKeys.includes('hard_stop_after_roll'), 'rule violation exhausts like markers');

  // 7. Legacy plain-string format is dropped (was already surfaced once).
  r = nextCorrectionEntries('legacy string', F('PROMISE_MADE'), []);
  assert(r.entries.length === 1 && r.entries[0].attempts === 0, 'legacy string not carried; current failure queued fresh');
  assert(normalizeCorrectionEntries('legacy').length === 0, 'normalize drops legacy strings');
  assert(normalizeCorrectionEntries(undefined).length === 0, 'normalize handles undefined');

  // 8. renderCorrectionText.
  assert(renderCorrectionText([{ text: 'a' }, { text: 'b' }]) === 'a\nb', 'render joins entry texts');
  assert(renderCorrectionText('legacy') === 'legacy', 'render passes legacy strings through');
  assert(renderCorrectionText(undefined) === undefined, 'render passes undefined through');

  // 9. No failures, no prior → nothing.
  r = nextCorrectionEntries(undefined, [], []);
  assert(r.entries.length === 0 && r.exhaustedKeys.length === 0, 'quiet turn produces nothing');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

await run();
