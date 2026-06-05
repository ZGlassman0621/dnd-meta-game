/**
 * Tests for NPC mail/message system: candidate scoring, mail type selection,
 * template generation, and MAIL_TYPES constant.
 * Run: node tests/npc-mail.test.js
 */

import {
  scoreMailCandidate, MAIL_SCORE_THRESHOLD, pickMailType,
  generateFromTemplate, MAIL_TYPES
} from '../server/services/npcMailService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.error(`  \u2717 ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.error(`  \u2717 ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ===== scoreMailCandidate — high disposition NPC =====
console.log('\nscoreMailCandidate — high disposition NPC:');

{
  const rel = { disposition: 80, trust_level: 60, last_interaction_game_day: 10 };
  const currentGameDay = 25; // 15 days absent
  const score = scoreMailCandidate(rel, currentGameDay);

  assert(score > 0, 'Score is positive for high-disposition NPC');
  assert(score >= MAIL_SCORE_THRESHOLD, `Score (${score}) meets threshold (${MAIL_SCORE_THRESHOLD})`);

  // Disposition component: Math.floor(80 / 10) = 8
  const dispositionComponent = Math.floor(80 / 10);
  assertEqual(dispositionComponent, 8, 'Disposition component: Math.floor(80/10) = 8');

  // Trust component: Math.floor(60 / 20) = 3
  const trustComponent = Math.floor(60 / 20);
  assertEqual(trustComponent, 3, 'Trust component: Math.floor(60/20) = 3');

  // Absence bonus: 15 days >= 10 → +5
  // Total: 8 + 3 + 5 = 16
  assertEqual(score, 16, 'Total score: disposition(8) + trust(3) + absence(5) = 16');
}

// ===== scoreMailCandidate — hostile NPC =====
console.log('\nscoreMailCandidate — hostile NPC:');

{
  const rel = { disposition: -30, trust_level: 5, last_interaction_game_day: 10 };
  const currentGameDay = 25;
  const score = scoreMailCandidate(rel, currentGameDay);

  assert(score < MAIL_SCORE_THRESHOLD, `Hostile NPC score (${score}) is below threshold (${MAIL_SCORE_THRESHOLD})`);

  // disposition < -20 → -10 penalty
  // Disposition component: Math.max(0, Math.floor(-30/10)) = 0
  // Trust: Math.max(0, Math.floor(5/20)) = 0
  // Absence: +5 (15 days)
  // Hostile penalty: -10
  // Total: 0 + 0 + 5 - 10 = -5
  assertEqual(score, -5, 'Hostile penalty (-10) applied: 0 + 0 + 5 - 10 = -5');
  assert(score < 0, 'Hostile NPCs get negative scores and should not send mail');
}

// ===== scoreMailCandidate — recent interaction penalty =====
console.log('\nscoreMailCandidate — recent interaction penalty:');

{
  const rel = { disposition: 50, trust_level: 30, last_interaction_game_day: 23 };
  const currentGameDay = 25; // 2 days since last interaction

  const score = scoreMailCandidate(rel, currentGameDay);

  // Disposition: Math.floor(50/10) = 5
  // Trust: Math.floor(30/20) = 1
  // Recent penalty: -3 (2 days < 3)
  // Total: 5 + 1 - 3 = 3
  assertEqual(score, 3, 'Recent interaction penalty: 5 + 1 - 3 = 3');
  assert(score < MAIL_SCORE_THRESHOLD, `Recent interaction score (${score}) below threshold`);

  // Without the penalty it would be 6 — verify the -3 matters
  const daysSince = currentGameDay - rel.last_interaction_game_day;
  assert(daysSince < 3, `Days since interaction (${daysSince}) < 3 triggers -3 penalty`);
}

// ===== scoreMailCandidate — world event and promises bonuses =====
console.log('\nscoreMailCandidate — world event and promises bonuses:');

{
  const rel = { disposition: 40, trust_level: 20 };
  // Disposition: Math.floor(40/10) = 4
  // Trust: Math.floor(20/20) = 1
  // No absence (no game day info)
  const baseScore = scoreMailCandidate(rel, null);
  assertEqual(baseScore, 5, 'Base score without bonuses: 4 + 1 = 5');

  const withEvent = scoreMailCandidate(rel, null, { hasWorldEventEffect: true });
  assertEqual(withEvent, 8, 'With world event bonus (+3): 4 + 1 + 3 = 8');

  const withPromises = scoreMailCandidate(rel, null, { hasPromisesOrDebts: true });
  assertEqual(withPromises, 9, 'With promises bonus (+4): 4 + 1 + 4 = 9');
}

// ===== pickMailType =====
console.log('\npickMailType:');

{
  // World event effect takes priority
  const result = pickMailType({ disposition: 10, trust_level: 10 }, { hasWorldEventEffect: true });
  assertEqual(result, 'npc_warning', 'World event effect → npc_warning');
}

{
  // Promises/debts second priority
  const result = pickMailType({ disposition: 10, trust_level: 10 }, { hasPromisesOrDebts: true });
  assertEqual(result, 'npc_request', 'Promises/debts → npc_request');
}

{
  // High disposition + high trust → gift
  const result = pickMailType({ disposition: 60, trust_level: 40 });
  assertEqual(result, 'npc_gift', 'High disposition (60) + high trust (40) → npc_gift');
}

{
  // Moderate trust → rumor
  const result = pickMailType({ disposition: 20, trust_level: 30 });
  assertEqual(result, 'npc_rumor', 'Moderate trust (30+) → npc_rumor');
}

{
  // Low everything → letter
  const result = pickMailType({ disposition: 10, trust_level: 10 });
  assertEqual(result, 'npc_letter', 'Low everything → npc_letter');
}

// ===== generateFromTemplate =====
console.log('\ngenerateFromTemplate:');

{
  const npc = { name: 'TEST_Elara', current_location: 'Silverkeep' };
  const rel = { disposition: 50, trust_level: 30 };

  const letter = generateFromTemplate(npc, rel, 'npc_letter');
  assert(letter.body && letter.body.length > 0, 'npc_letter template produces non-empty body');
  assert(letter.subject.includes('TEST_Elara'), 'npc_letter subject includes NPC name');
}

{
  const npc = { name: 'TEST_Grimjaw', current_location: 'Darkhollow' };
  const rel = { disposition: 30, trust_level: 20 };

  const warning = generateFromTemplate(npc, rel, 'npc_warning');
  assertEqual(warning.tone, 'urgent', 'npc_warning template has urgent tone');
}

{
  const npc = { name: 'TEST_Lyra', current_location: 'Moonwell' };
  const rel = { disposition: 70, trust_level: 50 };

  const gift = generateFromTemplate(npc, rel, 'npc_gift');
  assert(gift.gift_item !== null, 'npc_gift template has non-null gift_item');
}

{
  const npc = { name: 'TEST_Orin', current_location: 'Ironforge' };
  const rel = { disposition: 40, trust_level: 25 };

  const request = generateFromTemplate(npc, rel, 'npc_request');
  assertEqual(request.requires_response, true, 'npc_request template has requires_response=true');
}

{
  // All mail types produce non-empty body strings
  const npc = { name: 'TEST_Generic', current_location: 'Somewhere' };
  const rel = { disposition: 50, trust_level: 30 };
  const types = ['npc_letter', 'npc_warning', 'npc_request', 'npc_gift', 'npc_rumor'];
  const allHaveBody = types.every(t => {
    const result = generateFromTemplate(npc, rel, t);
    return typeof result.body === 'string' && result.body.length > 0;
  });
  assert(allHaveBody, 'All 5 mail types produce non-empty body strings');
}

// ===== MAIL_TYPES constant =====
console.log('\nMAIL_TYPES constant:');

{
  const expectedTypes = ['npc_letter', 'npc_warning', 'npc_request', 'npc_gift', 'npc_rumor'];
  const actualTypes = Object.keys(MAIL_TYPES);
  const hasAll = expectedTypes.every(t => actualTypes.includes(t));
  assert(hasAll, 'MAIL_TYPES has all 5 types: npc_letter, npc_warning, npc_request, npc_gift, npc_rumor');

  const allDescriptions = Object.values(MAIL_TYPES).every(v => typeof v === 'string' && v.length > 0);
  assert(allDescriptions, 'Each MAIL_TYPE has a non-empty description string');
}

// ===== Summary =====
console.log(`\n${'='.repeat(40)}`);
console.log(`NPC Mail System: ${passed} passed, ${failed} failed`);
console.log('='.repeat(40));

if (failed > 0) process.exit(1);
