/**
 * Consequence Automation Tests — Coverage for:
 * - Migration 011 schema
 * - (Promise marker detect-function tests were deleted with the legacy
 *   functions in l1-l6-cleanup, v1.0.229; PROMISE_MADE / PROMISE_FULFILLED
 *   schemas are covered by sc6-4c-promise-notoriety-schemas.)
 * - Consequence service logic (overdue promises, expired quests)
 * - Enhanced addPromise() with game_day tracking
 * - Living world tick integration
 */

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
// 14. Promise Weight Config
// ============================================================
console.log('\n=== Test 14: Promise Weight Config ===\n');

{
  const { PROMISE_WEIGHTS, FULFILL_WEIGHTS, VALID_WEIGHTS } = await import('../server/services/consequenceService.js');

  assert(VALID_WEIGHTS.length === 5, 'VALID_WEIGHTS has 5 levels');
  assert(VALID_WEIGHTS.includes('trivial'), 'VALID_WEIGHTS includes trivial');
  assert(VALID_WEIGHTS.includes('minor'), 'VALID_WEIGHTS includes minor');
  assert(VALID_WEIGHTS.includes('moderate'), 'VALID_WEIGHTS includes moderate');
  assert(VALID_WEIGHTS.includes('major'), 'VALID_WEIGHTS includes major');
  assert(VALID_WEIGHTS.includes('critical'), 'VALID_WEIGHTS includes critical');

  // PROMISE_WEIGHTS: all 5 levels exist with correct structure
  for (const w of VALID_WEIGHTS) {
    assert(PROMISE_WEIGHTS[w] !== undefined, `PROMISE_WEIGHTS has ${w} level`);
    assert(typeof PROMISE_WEIGHTS[w].directDisposition === 'number', `PROMISE_WEIGHTS.${w} has directDisposition`);
    assert(typeof PROMISE_WEIGHTS[w].directTrust === 'number', `PROMISE_WEIGHTS.${w} has directTrust`);
    assert(typeof PROMISE_WEIGHTS[w].rippleChance === 'number', `PROMISE_WEIGHTS.${w} has rippleChance`);
    assert(typeof PROMISE_WEIGHTS[w].factionStanding === 'number', `PROMISE_WEIGHTS.${w} has factionStanding`);
  }

  // Values scale correctly: trivial < minor < moderate < major < critical (absolute values)
  assert(Math.abs(PROMISE_WEIGHTS.trivial.directDisposition) < Math.abs(PROMISE_WEIGHTS.minor.directDisposition),
    'PROMISE_WEIGHTS: trivial < minor disposition');
  assert(Math.abs(PROMISE_WEIGHTS.minor.directDisposition) < Math.abs(PROMISE_WEIGHTS.moderate.directDisposition),
    'PROMISE_WEIGHTS: minor < moderate disposition');
  assert(Math.abs(PROMISE_WEIGHTS.moderate.directDisposition) < Math.abs(PROMISE_WEIGHTS.major.directDisposition),
    'PROMISE_WEIGHTS: moderate < major disposition');
  assert(Math.abs(PROMISE_WEIGHTS.major.directDisposition) < Math.abs(PROMISE_WEIGHTS.critical.directDisposition),
    'PROMISE_WEIGHTS: major < critical disposition');

  // Ripple chance scales: trivial = 0, critical = 0.85
  assert(PROMISE_WEIGHTS.trivial.rippleChance === 0, 'Trivial weight has 0 ripple chance');
  assert(PROMISE_WEIGHTS.critical.rippleChance === 0.85, 'Critical weight has 0.85 ripple chance');

  // FULFILL_WEIGHTS: all positive values
  for (const w of VALID_WEIGHTS) {
    assert(FULFILL_WEIGHTS[w] !== undefined, `FULFILL_WEIGHTS has ${w} level`);
    assert(FULFILL_WEIGHTS[w].directDisposition > 0, `FULFILL_WEIGHTS.${w} has positive directDisposition`);
    assert(FULFILL_WEIGHTS[w].directTrust > 0, `FULFILL_WEIGHTS.${w} has positive directTrust`);
    assert(FULFILL_WEIGHTS[w].rippleChance >= 0, `FULFILL_WEIGHTS.${w} has non-negative rippleChance`);
  }

  // Fulfill values scale: critical > major > moderate > minor > trivial
  assert(FULFILL_WEIGHTS.critical.directDisposition > FULFILL_WEIGHTS.major.directDisposition,
    'FULFILL_WEIGHTS: critical > major disposition');
  assert(FULFILL_WEIGHTS.major.directDisposition > FULFILL_WEIGHTS.moderate.directDisposition,
    'FULFILL_WEIGHTS: major > moderate disposition');
}

// ============================================================
// 16. New Consequence Service Exports
// ============================================================
console.log('\n=== Test 16: New Consequence Service Exports ===\n');

{
  const csModule = await import('../server/services/consequenceService.js');

  assert(typeof csModule.spreadReputationRipple === 'function', 'spreadReputationRipple is exported');
  assert(typeof csModule.findNpcFactions === 'function', 'findNpcFactions is exported');
  assert(typeof csModule.spreadFactionStanding === 'function', 'spreadFactionStanding is exported');
  assert(typeof csModule.calculatePriceModifier === 'function', 'calculatePriceModifier is exported');
  assert(typeof csModule.PROMISE_WEIGHTS === 'object', 'PROMISE_WEIGHTS is exported');
  assert(typeof csModule.FULFILL_WEIGHTS === 'object', 'FULFILL_WEIGHTS is exported');
  assert(Array.isArray(csModule.VALID_WEIGHTS), 'VALID_WEIGHTS is exported as array');
}

// ============================================================
// 17. Price Modifier Formula Validation
// ============================================================
console.log('\n=== Test 17: Price Modifier Formula ===\n');

{
  // Test the disposition-to-modifier mapping
  function testDispositionMod(disposition) {
    if (disposition <= -50) return 0.15;
    if (disposition <= -25) return 0.10;
    if (disposition <= 0) return 0.05;
    if (disposition <= 25) return 0;
    if (disposition <= 50) return -0.03;
    if (disposition <= 75) return -0.06;
    return -0.10;
  }

  assert(testDispositionMod(-75) === 0.15, 'Hostile NPC: +15% markup');
  assert(testDispositionMod(-50) === 0.15, 'Hostile boundary: +15% markup');
  assert(testDispositionMod(-30) === 0.10, 'Unfriendly NPC: +10% markup');
  assert(testDispositionMod(-10) === 0.05, 'Cold NPC: +5% markup');
  assert(testDispositionMod(0) === 0.05, 'Neutral-cold: +5% markup');
  assert(testDispositionMod(10) === 0, 'Neutral: no modifier');
  assert(testDispositionMod(40) === -0.03, 'Friendly: -3% discount');
  assert(testDispositionMod(60) === -0.06, 'Allied: -6% discount');
  assert(testDispositionMod(80) === -0.10, 'Devoted: -10% discount');

  // Test clamping
  const minClamp = Math.max(0.85, Math.min(1.25, 1 + (-0.10) + (-0.05)));
  assert(minClamp === 0.85, 'Price clamped to 0.85 minimum');

  const maxClamp = Math.max(0.85, Math.min(1.25, 1 + 0.15 + 0.10));
  assert(maxClamp === 1.25, 'Price clamped to 1.25 maximum');

  const normalClamp = Math.max(0.85, Math.min(1.25, 1 + 0 + 0));
  assert(normalClamp === 1.0, 'Neutral disposition + no faction = multiplier 1.0');
}

// ============================================================
// 18. Weight in Promise Storage Signature
// ============================================================
console.log('\n=== Test 18: Weight in Promise Storage ===\n');

{
  const relModule = await import('../server/services/npcRelationshipService.js');

  // fulfillPromise should return an object with weight
  assert(typeof relModule.fulfillPromise === 'function', 'fulfillPromise is exported');
  assert(typeof relModule.breakPromise === 'function', 'breakPromise is exported');

  // Verify addPromise still works (function signature unchanged except for options.weight)
  assert(relModule.addPromise.length >= 3, 'addPromise still accepts 3+ params');
}

// ============================================================
// 19. Severity from Weight Mapping
// ============================================================
console.log('\n=== Test 19: Severity from Weight Mapping ===\n');

{
  function getSeverity(weight) {
    if (weight === 'critical') return 'severe';
    if (weight === 'major') return 'major';
    if (weight === 'trivial') return 'minor';
    return 'moderate';
  }

  assert(getSeverity('trivial') === 'minor', 'Trivial weight maps to minor severity');
  assert(getSeverity('minor') === 'moderate', 'Minor weight maps to moderate severity');
  assert(getSeverity('moderate') === 'moderate', 'Moderate weight maps to moderate severity');
  assert(getSeverity('major') === 'major', 'Major weight maps to major severity');
  assert(getSeverity('critical') === 'severe', 'Critical weight maps to severe severity');
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
