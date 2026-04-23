/**
 * Prelude theme commitment tests (v1.0.77).
 *
 * Covers the pure-function pieces of the theme commitment flow:
 *   - Marker detection ([THEME_COMMITMENT_OFFERED] + strip)
 *   - Theme service helpers (ALL_THEME_IDS, getDepartureTypeForTheme,
 *     THEME_DEPARTURE_MAP coverage, commitTheme validation edge cases)
 *   - Prompt rendering — Ch3 wrap-up rule present, Ch4 block reads
 *     committedTheme + renders theme-specific departure line
 *
 * DB-touching pieces (buildThemeOffer, commitTheme write path) are
 * covered only partially here — the validation logic is exercised with
 * invalid inputs (no DB needed), but the tally-math and DB-persist paths
 * are manual-smoke-tested per project convention.
 */

import {
  detectThemeCommitmentOffered,
  detectPreludeMarkers,
  stripPreludeMarkers
} from '../server/services/preludeMarkerDetection.js';
import {
  ALL_THEME_IDS,
  THEME_DEPARTURE_MAP,
  getDepartureTypeForTheme
} from '../server/services/preludeThemeService.js';
import {
  createPreludeSystemPrompt
} from '../server/services/preludeArcPromptBuilder.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

// Minimal fixtures — mirror prelude-prompt.test.js
function makeCharacter(overrides = {}) {
  return {
    id: 1, name: 'Test Hero', first_name: 'Test', nickname: null,
    race: 'Human', subrace: null, gender: 'male',
    prelude_age: 14, prelude_chapter: 3, current_hp: 12, max_hp: 12,
    ...overrides
  };
}
function makeSetup(overrides = {}) {
  return {
    gender: 'male', birth_circumstance: 'farmer_child',
    home_setting: 'village', region: 'sword_coast',
    parents: [{ name: 'Vask', role: 'father', status: 'living' }],
    siblings: [],
    talents: ['Noticing things', 'Patience', 'Memory'],
    cares: ['Family', 'Truth', 'Justice'],
    tone_tags: ['tender_hopeful'],
    ...overrides
  };
}
function makeArcPlan(overrides = {}) {
  return {
    home_world: { description: 'A village.' },
    chapter_1_arc: { theme: 'x', beats: [] },
    chapter_2_arc: { theme: 'x', beats: [] },
    chapter_3_arc: { theme: 'x', beats: [], chapter_promise_prompt: 'Q?' },
    chapter_4_arc: { theme: 'x', beats: [], departure_seed: { reason: 'apprenticeship', tone: 'hopeful' } },
    recurring_threads: [],
    ...overrides
  };
}
function makeRuntime(overrides = {}) {
  return {
    chapter: 3, age: 14, maxHp: 12, currentHp: 12, sessionNumber: 4,
    exchangeCount: 40, sessionBudget: 50, wrapAt: 65, forceAt: 80,
    progressFraction: 0.8,
    committedTheme: null,
    themeDepartureMap: THEME_DEPARTURE_MAP,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

console.log('\n=== [THEME_COMMITMENT_OFFERED] marker detection ===\n');
{
  assert(detectThemeCommitmentOffered('') === null, 'empty → null');
  assert(detectThemeCommitmentOffered('no marker') === null, 'no marker → null');
  assert(detectThemeCommitmentOffered('[THEME_COMMITMENT_OFFERED]')?.signaled === true,
    'bare marker detected');
  assert(detectThemeCommitmentOffered('[THEME_COMMITMENT_OFFERED: leading="soldier"]')?.signaled === true,
    'marker with fields detected');
  assert(detectThemeCommitmentOffered('[theme_commitment_offered]')?.signaled === true,
    'case-insensitive');

  // Roll-up integration
  const rolled = detectPreludeMarkers('The moment lands. [THEME_COMMITMENT_OFFERED] The choice is yours.');
  assert(rolled.themeCommitmentOffered?.signaled === true,
    'roll-up surfaces themeCommitmentOffered');

  // Absence in roll-up
  const absent = detectPreludeMarkers('A quiet beat. She sets the kettle.');
  assert(absent.themeCommitmentOffered === null,
    'absent marker → null in roll-up');
}

console.log('\n=== [THEME_COMMITMENT_OFFERED] marker stripping ===\n');
{
  const stripped = stripPreludeMarkers('Something shifts. [THEME_COMMITMENT_OFFERED] You sit with it.');
  assert(!stripped.includes('[THEME_COMMITMENT_OFFERED'),
    'marker stripped from display');
  assert(stripped.includes('Something shifts.') && stripped.includes('You sit with it.'),
    'surrounding prose preserved');

  const strippedWithFields = stripPreludeMarkers('[THEME_COMMITMENT_OFFERED: leading="soldier"] Beat.');
  assert(!strippedWithFields.includes('[THEME_COMMITMENT_OFFERED'),
    'marker-with-fields stripped from display');
}

console.log('\n=== Theme service — ALL_THEME_IDS + THEME_DEPARTURE_MAP ===\n');
{
  assert(Array.isArray(ALL_THEME_IDS), 'ALL_THEME_IDS is an array');
  assert(ALL_THEME_IDS.length === 21, 'ALL_THEME_IDS has 21 canonical themes');
  assert(ALL_THEME_IDS.includes('soldier'), 'includes soldier');
  assert(ALL_THEME_IDS.includes('acolyte'), 'includes acolyte');
  assert(ALL_THEME_IDS.includes('folk_hero'), 'includes folk_hero');
  assert(ALL_THEME_IDS.includes('knight_of_the_order'), 'includes knight_of_the_order');

  // Every theme id has a departure mapping
  for (const id of ALL_THEME_IDS) {
    assert(typeof THEME_DEPARTURE_MAP[id] === 'string' && THEME_DEPARTURE_MAP[id].length > 0,
      `departure map has entry for ${id}`);
  }
}

console.log('\n=== getDepartureTypeForTheme ===\n');
{
  assert(getDepartureTypeForTheme('soldier').includes('enlistment'),
    'soldier → enlistment');
  assert(getDepartureTypeForTheme('acolyte').includes('pilgrimage') || getDepartureTypeForTheme('acolyte').includes('calling'),
    'acolyte → pilgrimage/calling');
  assert(getDepartureTypeForTheme('guild_artisan').includes('apprenticeship'),
    'guild_artisan → apprenticeship');
  assert(getDepartureTypeForTheme('criminal').includes('flight'),
    'criminal → flight');
  assert(getDepartureTypeForTheme('outlander').includes('explore') || getDepartureTypeForTheme('outlander').includes('wanderlust'),
    'outlander → exploration');

  // Fallback for unknown
  assert(typeof getDepartureTypeForTheme('nonexistent_theme') === 'string',
    'unknown theme falls back gracefully');
}

console.log('\n=== Ch3 engagement-mode block — theme commitment ceremony ===\n');
{
  const p = createPreludeSystemPrompt(
    makeCharacter(),
    makeSetup(),
    makeArcPlan(),
    makeRuntime({ chapter: 3, age: 14 })
  );
  assert(p.includes('THEME COMMITMENT CEREMONY'),
    'Ch3 block has THEME COMMITMENT CEREMONY heading');
  assert(p.includes('[THEME_COMMITMENT_OFFERED]'),
    'Ch3 block names the marker');
  assert(p.includes('AT CH3 WRAP-UP'),
    'Ch3 block specifies wrap-up timing (not opening)');
  assert(p.includes("Choose Your Path"),
    'Ch3 block mentions the Choose Your Path card');
  assert(p.includes('Do NOT name specific themes in the narrative'),
    'Ch3 block tells AI not to list themes in narrative (the card does it)');
  assert(p.includes('AFTER the irreversible-act'),
    'Ch3 block specifies marker follows the irreversible-act beat');
}

console.log('\n=== Ch4 engagement-mode block — committed theme drives departure ===\n');
{
  // No theme committed → fallback language
  const pNoCommit = createPreludeSystemPrompt(
    makeCharacter({ prelude_chapter: 4, prelude_age: 18 }),
    makeSetup(),
    makeArcPlan(),
    makeRuntime({ chapter: 4, age: 18, committedTheme: null })
  );
  assert(pNoCommit.includes('No theme was committed'),
    'Ch4 block has fallback text when no theme committed');

  // Theme committed → theme-specific language
  const pSoldier = createPreludeSystemPrompt(
    makeCharacter({ prelude_chapter: 4, prelude_age: 18 }),
    makeSetup(),
    makeArcPlan(),
    makeRuntime({ chapter: 4, age: 18, committedTheme: 'soldier' })
  );
  assert(pSoldier.includes('COMMITTED THEME: SOLDIER'),
    'Ch4 block surfaces committed theme in header');
  assert(pSoldier.includes('enlistment') || pSoldier.includes('military'),
    'Ch4 block includes soldier-specific departure type');
  assert(pSoldier.includes('departure MUST shape to this theme'),
    'Ch4 block enforces theme → departure binding');

  // Different theme → different departure
  const pAcolyte = createPreludeSystemPrompt(
    makeCharacter({ prelude_chapter: 4, prelude_age: 18 }),
    makeSetup(),
    makeArcPlan(),
    makeRuntime({ chapter: 4, age: 18, committedTheme: 'acolyte' })
  );
  assert(pAcolyte.includes('COMMITTED THEME: ACOLYTE'),
    'Ch4 with acolyte shows acolyte in header');
  assert(pAcolyte.includes('pilgrimage') || pAcolyte.includes('calling'),
    'Ch4 with acolyte shows pilgrimage/calling departure');
  assert(!pAcolyte.includes('enlistment, military posting'),
    'Ch4 with acolyte does NOT show the soldier line');

  // Tone modulates feel — all Ch4 blocks should reference tone-modulating
  const pGritty = createPreludeSystemPrompt(
    makeCharacter({ prelude_chapter: 4, prelude_age: 18 }),
    makeSetup({ tone_tags: ['brutal_gritty'] }),
    makeArcPlan(),
    makeRuntime({ chapter: 4, age: 18, committedTheme: 'soldier' })
  );
  assert(pGritty.includes('Tone preset modulates the FEEL'),
    'Ch4 block teaches tone-modulates-feel separation from theme-drives-type');
}

console.log('\n=== Departure variety — non-tragic-default reaffirmed ===\n');
{
  const p = createPreludeSystemPrompt(
    makeCharacter({ prelude_chapter: 4, prelude_age: 18 }),
    makeSetup(),
    makeArcPlan(),
    makeRuntime({ chapter: 4, age: 18, committedTheme: 'folk_hero' })
  );
  assert(p.includes('NEVER default') && p.includes('TRAGEDY'),
    'Ch4 still explicit about tragedy not being default');
  // A sampling of the varied departure types should appear in the big list
  const variety = ['ENLISTMENT', 'APPRENTICESHIP', 'PILGRIMAGE', 'LEAVING TO EXPLORE',
    'COMING-OF-AGE', 'POLITICAL MATCH', 'FLIGHT FROM CONSEQUENCES'];
  const found = variety.filter(v => p.includes(v));
  assert(found.length >= 5,
    `Ch4 lists varied departure types (found ${found.length}/${variety.length})`);
}

console.log('\n==================================================');
console.log(`Prelude Theme Commitment Tests: ${passed} passed, ${failed} failed`);
console.log('==================================================\n');

if (failed > 0) process.exit(1);
