/**
 * Phase 2 chunk 5.B — handoff payload contract (§8.2.1) shape verification.
 *
 * Pure-shape tests against `buildHandoffPayload` via a thin re-export.
 * Avoids end-to-end Opus + DB round trip; exercises projection logic only.
 *
 * The producer is internal to preludeTransitionService.js; we test it by
 * importing the module and invoking the (default exported testkit). For
 * isolation we synthesize the expected upstream values by hand.
 */

import {
  __testkit__buildHandoffPayload as buildHandoffPayload
} from '../server/services/preludeTransitionService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

function makeFixture(overrides = {}) {
  const character = {
    id: 42, name: 'Rell Marrowwind',
    first_name: 'Rell', last_name: 'Marrowwind', nickname: null,
    gender: 'Female', race: 'half_elf', subrace: 'wood'
  };
  const setup = {
    first_name: 'Rell', last_name: 'Marrowwind',
    gender: 'Female', race: 'half_elf', subrace: 'wood',
    region: 'Cormyr', home_setting: 'forest hamlet',
    authority_figure: 'mentor'
  };
  const arcPlan = {
    chapter_3_arc: { departure_seed: { primary_thread: 'apprenticeship in Suzail' } }
  };
  const committedTheme = { theme: 'outlander' };
  const classWinner = { winner: 'ranger', score: 7.5 };
  const ancestryWinner = { winner: 'half_elf_t1_c2', score: 9.0 };
  const ancestryChapterBeats = [
    { chapter: 1, reason: 'Tracked the lost sheep through the spring rain.' },
    { chapter: 3, reason: 'Read the bend of the bowyer\'s wood and named the tree.' }
  ];
  const themeChapterBeats = [
    { chapter: 2, reason: 'Slept in the deer-bower and woke easier than at home.' }
  ];
  const acceptedEmergences = [
    { kind: 'stat', target: 'wis', magnitude: 1, chapter: 1, reason: 'Read the storm before it broke.' },
    { kind: 'stat', target: 'wis', magnitude: 1, chapter: 3, reason: 'Knew the captain was lying about the road.' },
    { kind: 'skill', target: 'Survival', chapter: 2, reason: 'Brought the family through the bad winter.' }
  ];
  const canonNpcs = [
    { id: 1, name: 'Ulric Bowyer', relationship: 'mentor', status: 'alive',
      age_at_prelude_end: 58, description: 'The old bowyer', first_appeared_age: 12 },
    { id: 2, name: 'Brella', relationship: 'sister', status: 'alive', age_at_prelude_end: 19 }
  ];
  const canonLocations = [
    { id: 10, name: 'Hare\'s End', type: 'hamlet', description: 'Home', is_home: 1 }
  ];
  const canonThreads = [
    { id: 100, kind: 'unfulfilled_promise', weight: 'medium',
      subject_npc_id: 2, subject_text: 'Brella\'s wedding next spring', condition: 'one year passes' }
  ];
  const canonFacts = new Array(7).fill({ category: 'place', subject: 'x', fact: 'y' });
  const biographyEntries = [
    { origin_age: 8, origin_chapter: 1, body: 'You first set traps with your father.' },
    { origin_age: 14, origin_chapter: 2, body: 'The winter Brella nearly died of fever.' }
  ];
  return {
    character, setup, arcPlan, committedTheme,
    classWinner, ancestryWinner, ancestryChapterBeats, themeChapterBeats,
    acceptedEmergences, canonNpcs, canonLocations, canonThreads, canonFacts,
    biographyEntries, mentorImprintId: 555, heirloomCandidates: [],
    ...overrides
  };
}

console.log('\n=== Schema version + identity ===\n');
{
  const p = buildHandoffPayload(makeFixture());
  assert(p.schema_version === 2, 'schema_version === 2');
  assert(p.character_id === 42, 'character_id passed through');
  assert(typeof p.transitioned_at === 'string' && p.transitioned_at.length > 0, 'transitioned_at is a non-empty string');
}

console.log('\n=== §8.2.1 required fields present ===\n');
{
  const p = buildHandoffPayload(makeFixture());
  for (const f of [
    'setup_name', 'name', 'gender', 'race', 'subrace',
    'committed_theme', 'theme_chapter_beats',
    'ancestry_feat_id', 'ancestry_chapter_beats',
    'class_suggestion',
    'accepted_stat_bumps', 'accepted_skill_bumps',
    'heirloom_candidates', 'biography_seed',
    'canon_npcs', 'canon_locations', 'canon_threads',
    'mentor_imprint_eligible'
  ]) {
    assert(f in p, `field present: ${f}`);
  }
}

console.log('\n=== Name composition + USE_NAME fallback ===\n');
{
  const p = buildHandoffPayload(makeFixture());
  assert(p.setup_name === 'Rell Marrowwind', 'setup_name composes from setup first+last');
  assert(p.name === 'Rell Marrowwind', 'name (effective) falls back to character first+last when no USE_NAME');
  assert(p.name_parts.first_name === 'Rell', 'name_parts.first_name surfaced');
  assert(p.name_parts.last_name === 'Marrowwind', 'name_parts.last_name surfaced');
  assert(p.name_parts.nickname === null, 'name_parts.nickname null when not set');
}

console.log('\n=== Chapter beats pass through unchanged ===\n');
{
  const p = buildHandoffPayload(makeFixture());
  assert(p.ancestry_chapter_beats.length === 2, '2 ancestry chapter beats');
  assert(p.ancestry_chapter_beats[0].chapter === 1, 'ancestry beat 0: chapter 1');
  assert(p.theme_chapter_beats.length === 1, '1 theme chapter beat');
  assert(p.theme_chapter_beats[0].chapter === 2, 'theme beat 0: chapter 2');
}

console.log('\n=== Accepted bumps preserve chapter context ===\n');
{
  const p = buildHandoffPayload(makeFixture());
  assert(p.accepted_stat_bumps.length === 2, '2 stat bumps (one per fire, not aggregated)');
  assert(p.accepted_stat_bumps[0].stat === 'wis', 'stat lowercased');
  assert(p.accepted_stat_bumps[0].magnitude === 1, 'magnitude preserved');
  assert(p.accepted_stat_bumps[0].chapter === 1, 'chapter preserved');
  assert(p.accepted_stat_bumps[0].chapter_beat === 'Read the storm before it broke.', 'chapter_beat is the reason text');
  assert(p.accepted_skill_bumps.length === 1, '1 skill bump');
  assert(p.accepted_skill_bumps[0].skill === 'Survival', 'skill name preserved');
  assert(p.accepted_skill_bumps[0].chapter_beat?.includes('bad winter'), 'skill chapter_beat preserved');
}

console.log('\n=== biography_seed is structured array ===\n');
{
  const p = buildHandoffPayload(makeFixture());
  assert(Array.isArray(p.biography_seed), 'biography_seed is an array');
  assert(p.biography_seed.length === 2, '2 biography entries');
  assert(p.biography_seed[0].age === 8, 'age mapped from origin_age');
  assert(p.biography_seed[0].chapter === 1, 'chapter mapped from origin_chapter');
  assert(p.biography_seed[0].text === 'You first set traps with your father.', 'text mapped from body');
  assert(!('flattened_backstory' in p), 'flattened_backstory NOT in v2 payload (consumer flattens inline)');
  assert(!('biography' in p), 'biography object wrapper NOT in v2 payload');
}

console.log('\n=== heirloom_candidates is empty array (Option A — producer deferred) ===\n');
{
  const p = buildHandoffPayload(makeFixture());
  assert(Array.isArray(p.heirloom_candidates), 'heirloom_candidates is an array');
  assert(p.heirloom_candidates.length === 0, 'empty when no candidates passed in');

  const withHeirlooms = buildHandoffPayload(makeFixture({
    heirloomCandidates: [{
      id: 1, name: "Arven's Blade", type: 'weapon', specific_item_ref: 'longsword',
      description: 'pressed into your hands', awakening_hook: 'when wielded against the Iron Order',
      acquired_at_age: 16, acquired_at_chapter: 2
    }]
  }));
  assert(withHeirlooms.heirloom_candidates.length === 1, 'projects candidate row when present');
  assert(withHeirlooms.heirloom_candidates[0].name === "Arven's Blade", 'name passes through');
  assert(withHeirlooms.heirloom_candidates[0].awakening_hook === 'when wielded against the Iron Order',
    'awakening_hook passes through');
}

console.log('\n=== Canon collections are flat arrays at top level ===\n');
{
  const p = buildHandoffPayload(makeFixture());
  assert(Array.isArray(p.canon_npcs) && p.canon_npcs.length === 2, 'canon_npcs flat array');
  assert(Array.isArray(p.canon_locations) && p.canon_locations.length === 1, 'canon_locations flat array');
  assert(Array.isArray(p.canon_threads) && p.canon_threads.length === 1, 'canon_threads flat array');
  assert(p.canon_fact_count === 7, 'canon_fact_count surfaced (helper field)');
  assert(!('canon' in p), 'old canon{} wrapper NOT in v2 payload');
}

console.log('\n=== mentor_imprint_eligible flag ===\n');
{
  const eligible = buildHandoffPayload(makeFixture());
  assert(eligible.mentor_imprint_eligible === true,
    'eligible: mentor authority + canon mentor NPC present');

  const noMentorAuth = buildHandoffPayload(makeFixture({
    setup: { ...makeFixture().setup, authority_figure: 'parent' }
  }));
  assert(noMentorAuth.mentor_imprint_eligible === false,
    'ineligible: authority is not mentor');

  const mentorAuthNoNpc = buildHandoffPayload(makeFixture({
    canonNpcs: [{ id: 2, name: 'Brella', relationship: 'sister', status: 'alive' }]
  }));
  assert(mentorAuthNoNpc.mentor_imprint_eligible === false,
    'ineligible: no canon NPC with relationship=mentor');
}

console.log('\n=== Old shape fields removed ===\n');
{
  const p = buildHandoffPayload(makeFixture());
  assert(!('locked' in p), 'locked{} removed');
  assert(!('suggested' in p), 'suggested{} removed');
  assert(!('biography' in p), 'biography{} wrapper removed (replaced by biography_seed array)');
  assert(!('canon' in p), 'canon{} removed (collections are top-level)');
  assert(!('free_choice_fields' in p), 'free_choice_fields removed (informational only, never consumed)');
}

console.log('\n=== Helper fields chunk 5 needs are present ===\n');
{
  const p = buildHandoffPayload(makeFixture());
  assert(p.class_score === 7.5, 'class_score helper passed through');
  assert(p.ancestry_score === 9.0, 'ancestry_score helper passed through');
  assert(p.departure_summary?.primary_thread === 'apprenticeship in Suzail', 'departure_summary surfaced');
  assert(p.home_region === 'Cormyr', 'home_region surfaced');
  assert(p.home_setting === 'forest hamlet', 'home_setting surfaced');
  assert(p.authority_figure === 'mentor', 'authority_figure surfaced');
  assert(p.mentor_imprint_id === 555, 'mentor_imprint_id (when seeded) surfaced');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
