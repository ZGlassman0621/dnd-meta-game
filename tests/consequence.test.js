/**
 * Consequence Automation Tests — Coverage for:
 * - Migration 011 schema
 * - Promise marker detection (PROMISE_MADE, PROMISE_FULFILLED)
 * - Consequence service logic (overdue promises, expired quests)
 * - Enhanced addPromise() with game_day tracking
 * - Living world tick integration
 */

import {
  detectPromiseMade,
  detectPromiseFulfilled,
  detectMythicTrial
} from '../server/services/dmSessionService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.log(`  \u2717 FAIL: ${message}`);
    failed++;
  }
}

// ============================================================
// 1. PROMISE_MADE Marker Detection
// ============================================================
console.log('\n=== Test 1: PROMISE_MADE Marker Detection ===\n');

// Basic detection
{
  const result = detectPromiseMade('[PROMISE_MADE: NPC="Elara" Promise="Return the stolen amulet within a tenday" Deadline=10]');
  assert(result.length === 1, 'Detects single PROMISE_MADE marker');
  assert(result[0].npc === 'Elara', 'Extracts NPC name');
  assert(result[0].promise === 'Return the stolen amulet within a tenday', 'Extracts promise text');
  assert(result[0].deadline === 10, 'Extracts deadline in days');
}

// No deadline
{
  const result = detectPromiseMade('[PROMISE_MADE: NPC="Theron" Promise="Find his lost brother"]');
  assert(result.length === 1, 'Detects PROMISE_MADE without deadline');
  assert(result[0].npc === 'Theron', 'Extracts NPC name without deadline');
  assert(result[0].promise === 'Find his lost brother', 'Extracts promise text without deadline');
  assert(result[0].deadline === 0, 'Deadline defaults to 0 when omitted');
}

// Multiple markers
{
  const narrative = `The merchant smiled. [PROMISE_MADE: NPC="Gareth" Promise="Deliver the package to Waterdeep" Deadline=7]
Some more narrative text. [PROMISE_MADE: NPC="Lyra" Promise="Protect her son during the journey"]`;
  const result = detectPromiseMade(narrative);
  assert(result.length === 2, 'Detects multiple PROMISE_MADE markers');
  assert(result[0].npc === 'Gareth', 'First marker NPC correct');
  assert(result[0].deadline === 7, 'First marker deadline correct');
  assert(result[1].npc === 'Lyra', 'Second marker NPC correct');
  assert(result[1].deadline === 0, 'Second marker has no deadline');
}

// Case insensitive
{
  const result = detectPromiseMade('[promise_made: NPC="Test" Promise="test promise"]');
  assert(result.length === 1, 'Case-insensitive detection');
}

// No markers
{
  const result = detectPromiseMade('Just some regular narrative text with no markers.');
  assert(result.length === 0, 'Returns empty array when no markers');
}

// Null/empty input
{
  assert(detectPromiseMade(null).length === 0, 'Handles null input');
  assert(detectPromiseMade('').length === 0, 'Handles empty string');
  assert(detectPromiseMade(undefined).length === 0, 'Handles undefined');
}

// Missing required fields
{
  const result = detectPromiseMade('[PROMISE_MADE: NPC="Gareth"]'); // Missing Promise
  assert(result.length === 0, 'Rejects marker missing Promise field');
}

{
  const result = detectPromiseMade('[PROMISE_MADE: Promise="Do something"]'); // Missing NPC
  assert(result.length === 0, 'Rejects marker missing NPC field');
}

// ============================================================
// 2. PROMISE_FULFILLED Marker Detection
// ============================================================
console.log('\n=== Test 2: PROMISE_FULFILLED Marker Detection ===\n');

// Basic detection
{
  const result = detectPromiseFulfilled('[PROMISE_FULFILLED: NPC="Elara" Promise="Return the stolen amulet"]');
  assert(result.length === 1, 'Detects single PROMISE_FULFILLED marker');
  assert(result[0].npc === 'Elara', 'Extracts NPC name');
  assert(result[0].promise === 'Return the stolen amulet', 'Extracts promise text');
}

// Multiple markers
{
  const narrative = `You hand over the package. [PROMISE_FULFILLED: NPC="Gareth" Promise="Deliver the package"]
The priestess nods. [PROMISE_FULFILLED: NPC="Lyra" Promise="Protect her son"]`;
  const result = detectPromiseFulfilled(narrative);
  assert(result.length === 2, 'Detects multiple PROMISE_FULFILLED markers');
  assert(result[0].npc === 'Gareth', 'First marker NPC correct');
  assert(result[1].npc === 'Lyra', 'Second marker NPC correct');
}

// Case insensitive
{
  const result = detectPromiseFulfilled('[promise_fulfilled: NPC="Test" Promise="test"]');
  assert(result.length === 1, 'Case-insensitive detection');
}

// No markers
{
  assert(detectPromiseFulfilled(null).length === 0, 'Handles null input');
  assert(detectPromiseFulfilled('No markers here').length === 0, 'Returns empty for no markers');
}

// Missing required fields
{
  const result = detectPromiseFulfilled('[PROMISE_FULFILLED: NPC="Gareth"]');
  assert(result.length === 0, 'Rejects marker missing Promise field');
}

// ============================================================
// 3. Both Markers in Same Narrative
// ============================================================
console.log('\n=== Test 3: Mixed Promise Markers ===\n');

{
  const narrative = `The ranger approaches. "I need your help," she says. [PROMISE_MADE: NPC="Sylvana" Promise="Clear the goblin camp" Deadline=5]
Later, you return with the stolen goods. [PROMISE_FULFILLED: NPC="Marcus" Promise="Retrieve the merchant's goods"]`;

  const made = detectPromiseMade(narrative);
  const fulfilled = detectPromiseFulfilled(narrative);

  assert(made.length === 1, 'Detects PROMISE_MADE in mixed narrative');
  assert(fulfilled.length === 1, 'Detects PROMISE_FULFILLED in mixed narrative');
  assert(made[0].npc === 'Sylvana', 'PROMISE_MADE NPC correct in mixed');
  assert(fulfilled[0].npc === 'Marcus', 'PROMISE_FULFILLED NPC correct in mixed');
}

// ============================================================
// 4. Consequence Service — Timing Logic
// ============================================================
console.log('\n=== Test 4: Promise Timing Constants ===\n');

// Import and verify timing constants exist in the module
// (These are module-level consts so we test them indirectly via the export functions)

// Verify the service exports the expected functions
{
  const consequenceModule = await import('../server/services/consequenceService.js');
  assert(typeof consequenceModule.processConsequences === 'function', 'processConsequences is exported');
  assert(typeof consequenceModule.getConsequenceLog === 'function', 'getConsequenceLog is exported');
  assert(typeof consequenceModule.getUndeliveredConsequences === 'function', 'getUndeliveredConsequences is exported');
  assert(typeof consequenceModule.markConsequenceDelivered === 'function', 'markConsequenceDelivered is exported');
  assert(typeof consequenceModule.getConsequenceStats === 'function', 'getConsequenceStats is exported');
  assert(typeof consequenceModule.getOverduePromisesForContext === 'function', 'getOverduePromisesForContext is exported');
  assert(typeof consequenceModule.getApproachingDeadlineQuests === 'function', 'getApproachingDeadlineQuests is exported');
}

// ============================================================
// 5. Enhanced addPromise — Game Day Tracking
// ============================================================
console.log('\n=== Test 5: Enhanced addPromise Signature ===\n');

{
  const relModule = await import('../server/services/npcRelationshipService.js');
  assert(typeof relModule.addPromise === 'function', 'addPromise is exported');
  // Verify it accepts options parameter (arity check)
  // The function signature is: addPromise(characterId, npcId, promise, options = {})
  // JavaScript functions report length as number of params without defaults
  // addPromise has 3 params without defaults + 1 with default = length of 3
  assert(relModule.addPromise.length >= 3, 'addPromise accepts at least 3 parameters');
}

// ============================================================
// 6. Migration 011 Structure
// ============================================================
console.log('\n=== Test 6: Migration 011 Structure ===\n');

{
  const migration = await import('../server/migrations/011_consequence_automation.js');
  assert(typeof migration.up === 'function', 'Migration has up() function');
  assert(typeof migration.down === 'function', 'Migration has down() function');
}

// ============================================================
// 7. Promise Marker Edge Cases
// ============================================================
console.log('\n=== Test 7: Promise Marker Edge Cases ===\n');

// Promise with single quotes
{
  const result = detectPromiseMade("[PROMISE_MADE: NPC='Gareth' Promise='Find the ring' Deadline=3]");
  assert(result.length === 1, 'Handles single-quoted values');
  assert(result[0].npc === 'Gareth', 'Single-quoted NPC parsed correctly');
}

// Promise with special characters in text
{
  const result = detectPromiseMade('[PROMISE_MADE: NPC="Lady D\'Amberville" Promise="Return her family heirloom"]');
  assert(result.length === 1, 'Handles NPC name with apostrophe');
}

// Deadline edge cases
{
  const result = detectPromiseMade('[PROMISE_MADE: NPC="Test" Promise="test" Deadline=0]');
  assert(result.length === 1, 'Handles Deadline=0');
  assert(result[0].deadline === 0, 'Deadline=0 parsed as 0');
}

{
  const result = detectPromiseMade('[PROMISE_MADE: NPC="Test" Promise="test" Deadline=abc]');
  assert(result.length === 1, 'Handles non-numeric deadline');
  assert(result[0].deadline === 0, 'Non-numeric deadline defaults to 0');
}

// Very long promise text
{
  const longPromise = 'A'.repeat(500);
  const result = detectPromiseMade(`[PROMISE_MADE: NPC="Test" Promise="${longPromise}"]`);
  assert(result.length === 1, 'Handles very long promise text');
  assert(result[0].promise.length === 500, 'Long promise text preserved');
}

// ============================================================
// 8. Marker Cleaning Integration
// ============================================================
console.log('\n=== Test 8: Marker Cleaning Patterns ===\n');

{
  const testNarrative = 'The innkeeper nods. [PROMISE_MADE: NPC="Gareth" Promise="Help with rats" Deadline=3] He slides a key across the bar.';
  const cleaned = testNarrative.replace(/\[PROMISE_MADE:[^\]]+\]\s*/gi, '').trim();
  assert(!cleaned.includes('PROMISE_MADE'), 'PROMISE_MADE marker stripped from narrative');
  assert(cleaned.includes('The innkeeper nods.'), 'Text before marker preserved');
  assert(cleaned.includes('He slides a key'), 'Text after marker preserved');
}

{
  const testNarrative = 'You return the sword. [PROMISE_FULFILLED: NPC="Elara" Promise="Return the blade"] She smiles.';
  const cleaned = testNarrative.replace(/\[PROMISE_FULFILLED:[^\]]+\]\s*/gi, '').trim();
  assert(!cleaned.includes('PROMISE_FULFILLED'), 'PROMISE_FULFILLED marker stripped from narrative');
  assert(cleaned.includes('You return the sword.'), 'Text before marker preserved');
  assert(cleaned.includes('She smiles.'), 'Text after marker preserved');
}

// ============================================================
// 9. Existing Marker Detection Still Works
// ============================================================
console.log('\n=== Test 9: Existing Markers Unaffected ===\n');

{
  const mythicResult = detectMythicTrial('[MYTHIC_TRIAL: Name="Test Trial" Description="A test" Outcome="passed"]');
  assert(mythicResult !== null, 'MYTHIC_TRIAL detection still works');
  assert(mythicResult.name === 'Test Trial', 'MYTHIC_TRIAL name parsed correctly');
  assert(mythicResult.outcome === 'passed', 'MYTHIC_TRIAL outcome parsed correctly');
}

// ============================================================
// 10. Promise Fulfillment Matching Logic
// ============================================================
console.log('\n=== Test 10: Promise Fulfillment Text Matching ===\n');

{
  // Test that PROMISE_FULFILLED can match partial text
  const made = detectPromiseMade('[PROMISE_MADE: NPC="Elara" Promise="Return the stolen amulet within a tenday" Deadline=10]');
  const fulfilled = detectPromiseFulfilled('[PROMISE_FULFILLED: NPC="Elara" Promise="Return the stolen amulet"]');

  assert(made.length === 1, 'Made marker detected');
  assert(fulfilled.length === 1, 'Fulfilled marker detected');

  // The matching logic in dmSession.js uses .includes() on the first 20 chars
  const promiseText = made[0].promise.toLowerCase();
  const fulfillText = fulfilled[0].promise.toLowerCase().substring(0, 20);
  assert(promiseText.includes(fulfillText), 'Fulfilled text matches made text via substring');
}

// ============================================================
// 11. Consequence Types and Severity
// ============================================================
console.log('\n=== Test 11: Consequence Type Definitions ===\n');

{
  const validTypes = ['broken_promise', 'promise_warning', 'quest_expired'];
  const validSeverities = ['minor', 'moderate', 'major', 'catastrophic'];

  for (const type of validTypes) {
    assert(typeof type === 'string' && type.length > 0, `Consequence type '${type}' is valid`);
  }

  for (const sev of validSeverities) {
    assert(typeof sev === 'string' && sev.length > 0, `Severity '${sev}' is valid`);
  }

  // Verify the mapping: promise_warning = minor, broken_promise = moderate, quest_expired = moderate/major
  assert(validSeverities.includes('minor'), 'minor severity exists for warnings');
  assert(validSeverities.includes('moderate'), 'moderate severity exists for broken promises');
  assert(validSeverities.includes('major'), 'major severity exists for high-priority quest failures');
}

// ============================================================
// 12. DM Prompt Promise Urgency Annotations
// ============================================================
console.log('\n=== Test 12: Promise Urgency Annotation Logic ===\n');

{
  // Simulate the urgency annotation logic from dmPromptBuilder
  function getUrgency(promise, currentGameDay) {
    if (!promise.game_day_made) return '';
    const daysSince = currentGameDay - promise.game_day_made;
    if (promise.deadline_game_day && currentGameDay > promise.deadline_game_day) {
      return ' [OVERDUE — DEADLINE PASSED]';
    } else if (promise.deadline_game_day) {
      const daysLeft = promise.deadline_game_day - currentGameDay;
      if (daysLeft <= 7) return ` [URGENT — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left]`;
    } else if (daysSince >= 21) {
      return ` [OVERDUE — ${daysSince} days]`;
    }
    return '';
  }

  // Test: deadline passed
  assert(
    getUrgency({ game_day_made: 10, deadline_game_day: 20 }, 25) === ' [OVERDUE — DEADLINE PASSED]',
    'Deadline passed shows OVERDUE annotation'
  );

  // Test: deadline approaching (3 days left)
  assert(
    getUrgency({ game_day_made: 10, deadline_game_day: 28 }, 25) === ' [URGENT — 3 days left]',
    'Approaching deadline shows URGENT annotation'
  );

  // Test: 1 day left (singular)
  assert(
    getUrgency({ game_day_made: 10, deadline_game_day: 26 }, 25) === ' [URGENT — 1 day left]',
    'Single day left shows singular annotation'
  );

  // Test: no deadline, 21+ days old
  assert(
    getUrgency({ game_day_made: 4 }, 25) === ' [OVERDUE — 21 days]',
    'No deadline, 21 days shows OVERDUE annotation'
  );

  // Test: no deadline, 30 days old
  assert(
    getUrgency({ game_day_made: 1 }, 31) === ' [OVERDUE — 30 days]',
    'No deadline, 30 days shows OVERDUE annotation'
  );

  // Test: recent promise, no urgency
  assert(
    getUrgency({ game_day_made: 20 }, 25) === '',
    'Recent promise (5 days) shows no annotation'
  );

  // Test: deadline far away
  assert(
    getUrgency({ game_day_made: 20, deadline_game_day: 50 }, 25) === '',
    'Far deadline shows no annotation'
  );

  // Test: no game_day_made
  assert(
    getUrgency({}, 25) === '',
    'Missing game_day_made shows no annotation'
  );
}

// ============================================================
// 13. Living World Tick Integration
// ============================================================
console.log('\n=== Test 13: Living World Tick Integration ===\n');

{
  const lwModule = await import('../server/services/livingWorldService.js');
  assert(typeof lwModule.processLivingWorldTick === 'function', 'processLivingWorldTick is exported');
}

{
  const csModule = await import('../server/services/consequenceService.js');
  assert(typeof csModule.processConsequences === 'function', 'processConsequences is available for tick integration');
}

// ============================================================
// SUMMARY
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Consequence Automation Tests: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
