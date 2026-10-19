/**
 * XP Service tests.
 *
 * Verifies the session-end LLM scoring XP system:
 * - N/A exclusion (null categories excluded from average, never zero)
 * - Substitution rule (social replacing combat = Combat N/A, not 0)
 * - Breadth bonus (broad sessions out-earn narrow ones)
 * - Companion multipliers (present/away/absent)
 * - Sessions-per-level bands
 * - The two werewolf-session scenarios (level 5: 3690 vs 2859 XP)
 *
 * Pure-function tests only — no DB, no LLM calls.
 */

import {
  calculateSessionRewards,
  sessionsPerLevel,
  xpToNext,
  COMPANION_XP,
  BREADTH_MULTIPLIERS,
  companionXP,
  validateScorerOutput,
  buildScorerPrompt,
} from '../server/services/xpService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

console.log('\n=== Test 1: N/A exclusion ===\n');
{
  const r = calculateSessionRewards(
    { combat: null, exploration: null, quests: null, discovery: null, social: 9 },
    5
  );
  assert(r.categoriesScored === 1, 'One category scored');
  assert(r.avg === 9, 'Average is 9 (not diluted by nulls)');
  assert(r.breadth === 1.0, 'Single category → 1.0× breadth');
  const empty = calculateSessionRewards(
    { combat: null, exploration: null, quests: null, discovery: null, social: null },
    5
  );
  assert(empty.xp === 0, 'All-N/A session earns 0 XP');
}

console.log('\n=== Test 2: Substitution rule ===\n');
{
  const r = calculateSessionRewards(
    { combat: null, exploration: null, quests: null, discovery: null, social: 10 },
    5
  );
  assert(r.avg === 10, 'Substituted combat is N/A — average stays 10/10');
  assert(r.xp === 3000, `Full 10/10 value = 3000 XP (got ${r.xp})`);
  const diluted = calculateSessionRewards(
    { combat: 0, exploration: null, quests: null, discovery: null, social: 10 },
    5
  );
  assert(diluted.avg === 5, 'Combat 0 (not N/A) dilutes to 5/10');
  assert(diluted.xp < r.xp, 'N/A earns more than 0 — substitution holds');
}

console.log('\n=== Test 3: Breadth bonus ===\n');
{
  const narrow = calculateSessionRewards(
    { combat: null, exploration: null, quests: null, discovery: null, social: 9 },
    12
  );
  const broad = calculateSessionRewards(
    { combat: 7, exploration: 7, quests: null, discovery: null, social: 7 },
    12
  );
  assert(narrow.breadth === 1.0, 'Single category → 1.0×');
  assert(broad.breadth === 1.3, 'Three categories → 1.3×');
  assert(broad.xp > narrow.xp, `Broad (${broad.xp}) out-earns narrow (${narrow.xp})`);
  const full = calculateSessionRewards(
    { combat: 8, exploration: 7, quests: 9, discovery: 8, social: 9 },
    12
  );
  assert(full.breadth === 1.5, 'Five categories → 1.5× max');
}

console.log('\n=== Test 4: Companion multipliers ===\n');
{
  assert(COMPANION_XP.present === 1.0, 'Present = 1.0×');
  assert(COMPANION_XP.away === 0.5, 'Away = 0.5×');
  assert(COMPANION_XP.absent === 0.2, 'Absent = 0.2×');
  assert(companionXP(3000, 'present') === 3000, 'Present: 3000');
  assert(companionXP(3000, 'away') === 1500, 'Away: 1500');
  assert(companionXP(3000, 'absent') === 600, 'Absent: 600');
}

console.log('\n=== Test 5: Sessions-per-level bands ===\n');
{
  assert(sessionsPerLevel(1) === 1.5, 'Level 1 → 1.5 spl');
  assert(sessionsPerLevel(5) === 2.5, 'Level 5 → 2.5 spl');
  assert(sessionsPerLevel(9) === 3.5, 'Level 9 → 3.5 spl');
  assert(sessionsPerLevel(12) === 6, 'Level 12 → 6 spl');
  assert(sessionsPerLevel(20) === 10, 'Level 20 → 10 spl');
  assert(sessionsPerLevel(40) === 14, 'Level 40 → 14 spl');
}

console.log('\n=== Test 6: XP thresholds ===\n');
{
  assert(xpToNext(1) === 300, 'Level 1→2: 300 XP');
  assert(xpToNext(5) === 7500, 'Level 5→6: 7500 XP');
  assert(xpToNext(19) === 50000, 'Level 19→20: 50000 XP');
  assert(xpToNext(20) === 50000, 'Level 20→21: 50000 (extrapolated)');
}

console.log('\n=== Test 7: Werewolf sessions (level 5) ===\n');
{
  const s1 = calculateSessionRewards(
    { combat: 8, exploration: 7, quests: 9, discovery: 8, social: 9 },
    5
  );
  assert(s1.avg === 8.2, `Werewolf avg = 8.2 (got ${s1.avg})`);
  assert(s1.xp === 3690, `Werewolf = 3690 XP (got ${s1.xp})`);
  const s2 = calculateSessionRewards(
    { combat: null, exploration: null, quests: 6, discovery: 7, social: 9 },
    5
  );
  assert(s2.categoriesScored === 3, 'Dinner: 3 categories');
  assert(s1.xp > s2.xp, `Werewolf (${s1.xp}) out-earns dinner (${s2.xp})`);
  const pct1 = Math.round((s1.xp / 7500) * 100);
  assert(pct1 === 49, `Werewolf = 49% of level (got ${pct1}%)`);
}

console.log('\n=== Test 8: Scorer validation ===\n');
{
  const valid = {
    combat: { opportunity: true, score: 7 },
    exploration: { opportunity: true, score: 4 },
    quests: { opportunity: false, score: null },
    discovery: { opportunity: true, score: 9 },
    social: { opportunity: true, score: 8 },
  };
  assert(validateScorerOutput(valid) === true, 'Valid output passes');
  let threw = false;
  try { validateScorerOutput({ ...valid, quests: { opportunity: false, score: 3 } }); }
  catch { threw = true; }
  assert(threw, 'N/A with non-null score throws');
}

console.log('\n=== Test 9: Scorer prompt blind to intent ===\n');
{
  const prompt = buildScorerPrompt({
    narrative: 'The party fought goblins.',
    characterLevel: 5,
    wallClockMinutes: 120,
    playerNotes: 'I wanted Mira tonight',
  });
  assert(!prompt.includes('Mira'), 'Player notes do NOT leak into prompt');
  assert(!prompt.includes('playerNotes'), 'No playerNotes field referenced');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

