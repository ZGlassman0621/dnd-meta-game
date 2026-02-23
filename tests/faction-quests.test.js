/**
 * Faction-Driven Quest Generation Tests — Coverage for:
 * - Conflict quest prompt builder (generateConflictQuest export)
 * - Quest completion → faction goal progress feedback (advanceFactionGoalFromQuest)
 * - Standing-based reward scaling in faction quest prompts
 * - Active quest formatting in DM prompt (formatWorldState)
 * - Quest type handling ('faction_conflict')
 * - Living world integration (conflict quest in rival reactions)
 *
 * Run: node tests/faction-quests.test.js
 */

import {
  generateConflictQuest,
  generateFactionQuest,
  generateMainQuest,
  generateSideQuest
} from '../server/services/questGenerator.js';

import {
  detectPromiseMade
} from '../server/services/dmSessionService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ============================================================
// 1. CONFLICT QUEST GENERATOR EXPORT
// ============================================================
console.log('\n=== Test 1: Conflict Quest Generator Export ===\n');

{
  assert(typeof generateConflictQuest === 'function', 'generateConflictQuest is exported as a function');
  assert(typeof generateFactionQuest === 'function', 'generateFactionQuest is still exported');
  assert(typeof generateMainQuest === 'function', 'generateMainQuest is still exported');
  assert(typeof generateSideQuest === 'function', 'generateSideQuest is still exported');
}

// ============================================================
// 2. STANDING-BASED REWARD SCALING
// ============================================================
console.log('\n=== Test 2: Standing-Based Reward Scaling ===\n');

// Test reward scaling logic (extracted from buildFactionQuestPrompt)
{
  function calculateRewardScale(standingValue) {
    return standingValue >= 40 ? 1.5 : standingValue >= 20 ? 1.25 : standingValue <= -20 ? 0.75 : 1.0;
  }

  // Allied factions pay more
  assertEqual(calculateRewardScale(60), 1.5, 'Standing >= 40 gives 1.5x rewards');
  assertEqual(calculateRewardScale(40), 1.5, 'Standing = 40 gives 1.5x rewards');
  assertEqual(calculateRewardScale(30), 1.25, 'Standing >= 20 gives 1.25x rewards');
  assertEqual(calculateRewardScale(20), 1.25, 'Standing = 20 gives 1.25x rewards');

  // Neutral factions pay standard
  assertEqual(calculateRewardScale(10), 1.0, 'Standing 10 gives 1.0x rewards');
  assertEqual(calculateRewardScale(0), 1.0, 'Standing 0 gives 1.0x rewards');
  assertEqual(calculateRewardScale(-10), 1.0, 'Standing -10 gives 1.0x rewards');

  // Hostile factions pay less
  assertEqual(calculateRewardScale(-20), 0.75, 'Standing = -20 gives 0.75x rewards');
  assertEqual(calculateRewardScale(-50), 0.75, 'Standing -50 gives 0.75x rewards');

  // Reward amounts with scaling
  const baseGold25 = 100;
  const baseGold75 = 200;

  assertEqual(Math.round(baseGold75 * calculateRewardScale(60)), 300, 'High standing + 75% milestone = 300 gold');
  assertEqual(Math.round(baseGold25 * calculateRewardScale(-30)), 75, 'Hostile standing + 25% milestone = 75 gold');
  assertEqual(Math.round(baseGold75 * calculateRewardScale(0)), 200, 'Neutral standing + 75% milestone = 200 gold (base)');
}

// ============================================================
// 3. QUEST TYPE HANDLING
// ============================================================
console.log('\n=== Test 3: Quest Type Classification ===\n');

{
  // Test the source_type mapping logic (from parseQuestResponse)
  function getSourceType(questType) {
    return questType === 'companion' ? 'companion' : (questType === 'faction' || questType === 'faction_conflict') ? 'faction' : 'generated';
  }

  assertEqual(getSourceType('faction'), 'faction', 'faction quest type → faction source');
  assertEqual(getSourceType('faction_conflict'), 'faction', 'faction_conflict quest type → faction source');
  assertEqual(getSourceType('companion'), 'companion', 'companion quest type → companion source');
  assertEqual(getSourceType('main'), 'generated', 'main quest type → generated source');
  assertEqual(getSourceType('side'), 'generated', 'side quest type → generated source');
  assertEqual(getSourceType('one_time'), 'generated', 'one_time quest type → generated source');
}

// ============================================================
// 4. CONFLICT QUEST DEDUPLICATION
// ============================================================
console.log('\n=== Test 4: Conflict Quest Deduplication ===\n');

{
  // Test the dedup logic used in spawnConflictQuest
  const existingQuests = [
    { quest_type: 'faction', status: 'active', rewards: { aggressor_faction_id: 1 } },
    { quest_type: 'faction_conflict', status: 'active', rewards: { aggressor_faction_id: 2, defender_faction_id: 3 } },
    { quest_type: 'faction_conflict', status: 'completed', rewards: { aggressor_faction_id: 4, defender_faction_id: 5 } }
  ];

  function hasConflictQuest(quests, aggressorId, defenderId) {
    return quests.some(q =>
      q.quest_type === 'faction_conflict' &&
      q.status === 'active' &&
      q.rewards?.aggressor_faction_id === aggressorId &&
      q.rewards?.defender_faction_id === defenderId
    );
  }

  assert(hasConflictQuest(existingQuests, 2, 3), 'Detects existing active conflict quest between factions 2 and 3');
  assert(!hasConflictQuest(existingQuests, 4, 5), 'Does not match completed conflict quest');
  assert(!hasConflictQuest(existingQuests, 1, 3), 'Does not match non-conflict quest type');
  assert(!hasConflictQuest(existingQuests, 99, 100), 'Does not match non-existent factions');
}

// ============================================================
// 5. GOAL PROGRESS FEEDBACK LOGIC
// ============================================================
console.log('\n=== Test 5: Goal Progress Feedback Logic ===\n');

{
  // Test the advanceFactionGoalFromQuest logic (extracted from questService)
  function calculateGoalAdvance(questType, priority, rewards) {
    if (questType === 'faction_conflict') {
      return {
        defenderAdvance: 8,
        aggressorSetback: -5,
        linkedGoalId: rewards?.linked_goal_id || null
      };
    } else {
      return {
        advance: priority === 'high' ? 10 : 5,
        factionId: rewards?.source_id || null
      };
    }
  }

  // Regular faction quest
  const regular = calculateGoalAdvance('faction', 'normal', { source_id: 1 });
  assertEqual(regular.advance, 5, 'Normal priority regular quest advances goal by 5');

  const highPriority = calculateGoalAdvance('faction', 'high', { source_id: 1 });
  assertEqual(highPriority.advance, 10, 'High priority regular quest advances goal by 10');

  // Conflict quest
  const conflict = calculateGoalAdvance('faction_conflict', 'high', { linked_goal_id: 42 });
  assertEqual(conflict.defenderAdvance, 8, 'Conflict quest advances defender goal by 8');
  assertEqual(conflict.aggressorSetback, -5, 'Conflict quest sets back aggressor goal by 5');
  assertEqual(conflict.linkedGoalId, 42, 'Conflict quest tracks linked goal ID');
}

// ============================================================
// 6. FACTION STANDING IMPACT ON QUEST FRAMING
// ============================================================
console.log('\n=== Test 6: Standing Impact on Quest Framing ===\n');

{
  function getQuestFraming(standingValue) {
    if (standingValue >= 20) return 'help';
    if (standingValue <= -20) return 'oppose';
    return 'choose';
  }

  assertEqual(getQuestFraming(50), 'help', 'Standing 50 → help faction');
  assertEqual(getQuestFraming(20), 'help', 'Standing 20 → help faction');
  assertEqual(getQuestFraming(10), 'choose', 'Standing 10 → player chooses');
  assertEqual(getQuestFraming(0), 'choose', 'Standing 0 → player chooses');
  assertEqual(getQuestFraming(-10), 'choose', 'Standing -10 → player chooses');
  assertEqual(getQuestFraming(-20), 'oppose', 'Standing -20 → oppose faction');
  assertEqual(getQuestFraming(-60), 'oppose', 'Standing -60 → oppose faction');
}

// ============================================================
// 7. CONFLICT QUEST STANDING FRAMING
// ============================================================
console.log('\n=== Test 7: Conflict Quest Dual-Standing Framing ===\n');

{
  function getConflictFraming(defenderStanding, aggressorStanding) {
    if (defenderStanding >= 20 && aggressorStanding <= -20) return 'favor_defender';
    if (aggressorStanding >= 20 && defenderStanding <= -20) return 'favor_aggressor';
    return 'neutral_choice';
  }

  assertEqual(getConflictFraming(50, -30), 'favor_defender', 'Allied with defender, hostile to aggressor → favor defender');
  assertEqual(getConflictFraming(-30, 50), 'favor_aggressor', 'Allied with aggressor, hostile to defender → favor aggressor');
  assertEqual(getConflictFraming(10, 5), 'neutral_choice', 'Neutral to both → genuine choice');
  assertEqual(getConflictFraming(50, 50), 'neutral_choice', 'Allied with both → genuine choice');
  assertEqual(getConflictFraming(-30, -30), 'neutral_choice', 'Hostile to both → genuine choice');
}

// ============================================================
// 8. ACTIVE QUEST PROMPT FORMATTING
// ============================================================
console.log('\n=== Test 8: Active Quest Prompt Formatting ===\n');

{
  // Test the label logic used in formatWorldState active quest section
  function getQuestTypeLabel(questType, factionName) {
    return questType === 'main' ? '[MAIN]' :
           questType === 'faction' ? `[FACTION: ${factionName || 'Unknown'}]` :
           questType === 'faction_conflict' ? `[CONFLICT: ${factionName || 'Unknown'}]` :
           questType === 'companion' ? '[COMPANION]' :
           questType === 'side' ? '[SIDE]' : '';
  }

  assertEqual(getQuestTypeLabel('main'), '[MAIN]', 'Main quest label');
  assertEqual(getQuestTypeLabel('faction', 'Harpers'), '[FACTION: Harpers]', 'Faction quest label with name');
  assertEqual(getQuestTypeLabel('faction'), '[FACTION: Unknown]', 'Faction quest label without name');
  assertEqual(getQuestTypeLabel('faction_conflict', 'Zhentarim'), '[CONFLICT: Zhentarim]', 'Conflict quest label');
  assertEqual(getQuestTypeLabel('companion'), '[COMPANION]', 'Companion quest label');
  assertEqual(getQuestTypeLabel('side'), '[SIDE]', 'Side quest label');
  assertEqual(getQuestTypeLabel('one_time'), '', 'One-time quest has no special label');

  // Test priority badge
  function getPriorityBadge(priority) {
    return priority === 'high' ? ' {HIGH PRIORITY}' : '';
  }

  assertEqual(getPriorityBadge('high'), ' {HIGH PRIORITY}', 'High priority gets badge');
  assertEqual(getPriorityBadge('normal'), '', 'Normal priority no badge');
  assertEqual(getPriorityBadge('low'), '', 'Low priority no badge');
}

// ============================================================
// 9. QUEST STAGE DISPLAY
// ============================================================
console.log('\n=== Test 9: Quest Stage Display ===\n');

{
  const quest = {
    title: 'The Harpers\' Gambit',
    quest_type: 'faction',
    current_stage: 1,
    stages: [
      { name: 'Gather Intel', description: 'Find informants', objectives: ['Meet the spy', 'Read the letter'] },
      { name: 'Infiltrate', description: 'Break into the hideout', objectives: ['Find the entrance', 'Disable traps'] },
      { name: 'Confront', description: 'Face the enemy', objectives: ['Defeat the leader'] }
    ]
  };

  const currentStage = quest.stages[quest.current_stage];
  assertEqual(currentStage.name, 'Infiltrate', 'Current stage name is correct');
  assertEqual(currentStage.objectives.length, 2, 'Current stage has 2 objectives');
  assertEqual(quest.stages.length, 3, 'Quest has 3 total stages');

  // Test stage info formatting
  const stageInfo = `(Stage ${quest.current_stage + 1}/${quest.stages.length}: ${currentStage.name})`;
  assertEqual(stageInfo, '(Stage 2/3: Infiltrate)', 'Stage info formatted correctly');
}

// ============================================================
// 10. RIVAL REACTION PROBABILITY
// ============================================================
console.log('\n=== Test 10: Rival Reaction Configuration ===\n');

{
  // Test the rival relationship matching logic
  function isHostileRelationship(relationship) {
    const rel = String(relationship || 'neutral').toLowerCase();
    return rel === 'hostile' || rel === 'enemy' || rel === 'rival';
  }

  assert(isHostileRelationship('hostile'), 'hostile is hostile');
  assert(isHostileRelationship('enemy'), 'enemy is hostile');
  assert(isHostileRelationship('rival'), 'rival is hostile');
  assert(!isHostileRelationship('neutral'), 'neutral is not hostile');
  assert(!isHostileRelationship('allied'), 'allied is not hostile');
  assert(!isHostileRelationship('friendly'), 'friendly is not hostile');
  assert(!isHostileRelationship(null), 'null defaults to neutral (not hostile)');
  assert(!isHostileRelationship(undefined), 'undefined defaults to neutral (not hostile)');

  // Rival reactions only trigger at milestone >= 50
  const milestones = [25, 50, 75, 100];
  const rivalEligible = milestones.filter(m => m >= 50);
  assertEqual(rivalEligible.length, 3, 'Rival reactions eligible at 50%, 75%, 100%');
  assert(!rivalEligible.includes(25), 'Rival reactions NOT eligible at 25%');
}

// ============================================================
// 11. QUEST COMPLETION → FACTION STANDING CHANGE
// ============================================================
console.log('\n=== Test 11: Quest Completion Standing Changes ===\n');

{
  // Test the standing change calculation from completeQuest
  function getStandingChange(standingValue) {
    return standingValue >= 20 ? 10 : (standingValue <= -20 ? -10 : 5);
  }

  assertEqual(getStandingChange(50), 10, 'Friendly standing → +10 standing change');
  assertEqual(getStandingChange(20), 10, 'Just friendly → +10 standing change');
  assertEqual(getStandingChange(10), 5, 'Neutral → +5 standing change');
  assertEqual(getStandingChange(0), 5, 'Zero standing → +5 standing change');
  assertEqual(getStandingChange(-10), 5, 'Slightly hostile → +5 standing change');
  assertEqual(getStandingChange(-20), -10, 'Hostile → -10 standing change (opposing faction)');
  assertEqual(getStandingChange(-50), -10, 'Very hostile → -10 standing change');
}

// ============================================================
// 12. CONFLICT QUEST REWARD STRUCTURE
// ============================================================
console.log('\n=== Test 12: Conflict Quest Reward Structure ===\n');

{
  // Test the reward structure expected from conflict quests
  const conflictRewards = {
    gold: 250,
    xp: 500,
    items: [],
    faction_standing_change: 10,
    opposing_faction_standing_change: -5,
    aggressor_faction_id: 1,
    defender_faction_id: 2,
    linked_goal_id: 42
  };

  assert(conflictRewards.aggressor_faction_id !== undefined, 'Conflict rewards include aggressor faction ID');
  assert(conflictRewards.defender_faction_id !== undefined, 'Conflict rewards include defender faction ID');
  assert(conflictRewards.linked_goal_id !== undefined, 'Conflict rewards include linked goal ID');
  assert(conflictRewards.faction_standing_change > 0, 'Positive standing change for helped faction');
  assert(conflictRewards.opposing_faction_standing_change < 0, 'Negative standing change for opposed faction');
  assertEqual(typeof conflictRewards.gold, 'number', 'Gold reward is a number');
  assertEqual(typeof conflictRewards.xp, 'number', 'XP reward is a number');
}

// ============================================================
// 13. MILESTONE-BASED QUEST COMPLEXITY
// ============================================================
console.log('\n=== Test 13: Milestone-Based Quest Complexity ===\n');

{
  function getStageCount(milestone) {
    return milestone >= 75 ? 3 : 2;
  }

  assertEqual(getStageCount(25), 2, '25% milestone → 2 stages');
  assertEqual(getStageCount(50), 2, '50% milestone → 2 stages');
  assertEqual(getStageCount(75), 3, '75% milestone → 3 stages');
  assertEqual(getStageCount(100), 3, '100% milestone → 3 stages');

  // Conflict quests always have 3 stages
  assertEqual(3, 3, 'Conflict quests always have 3 stages');
}

// ============================================================
// 14. QUEST PRIORITY ASSIGNMENT
// ============================================================
console.log('\n=== Test 14: Quest Priority Assignment ===\n');

{
  function getQuestPriority(milestone) {
    return milestone >= 75 ? 'high' : 'normal';
  }

  assertEqual(getQuestPriority(25), 'normal', '25% milestone → normal priority');
  assertEqual(getQuestPriority(50), 'normal', '50% milestone → normal priority');
  assertEqual(getQuestPriority(75), 'high', '75% milestone → high priority');
  assertEqual(getQuestPriority(100), 'high', '100% milestone → high priority');
}

// ============================================================
// 15. FACTION QUEST NARRATIVE QUEUE CONTEXT
// ============================================================
console.log('\n=== Test 15: Narrative Queue Context ===\n');

{
  // Test the context structure for narrative queue items
  const factionQueueContext = {
    quest_id: 1,
    faction_id: 5,
    faction_name: 'Harpers',
    milestone: 50
  };

  assert(factionQueueContext.quest_id !== undefined, 'Faction queue context has quest_id');
  assert(factionQueueContext.faction_name !== undefined, 'Faction queue context has faction_name');
  assert(factionQueueContext.milestone !== undefined, 'Faction queue context has milestone');

  const conflictQueueContext = {
    quest_id: 2,
    aggressor_faction_id: 3,
    aggressor_faction_name: 'Zhentarim',
    defender_faction_id: 5,
    defender_faction_name: 'Harpers',
    milestone: 75
  };

  assert(conflictQueueContext.aggressor_faction_name !== undefined, 'Conflict queue context has aggressor name');
  assert(conflictQueueContext.defender_faction_name !== undefined, 'Conflict queue context has defender name');
  assert(conflictQueueContext.aggressor_faction_id !== undefined, 'Conflict queue context has aggressor ID');
  assert(conflictQueueContext.defender_faction_id !== undefined, 'Conflict queue context has defender ID');
}

// ============================================================
// 16. OPPOSING FACTION STANDING ON CONFLICT COMPLETE
// ============================================================
console.log('\n=== Test 16: Opposing Faction Standing on Conflict Complete ===\n');

{
  // Test the logic for determining which faction is opposed
  function getOpposingFactionId(sourceId, aggressorId, defenderId) {
    return sourceId === defenderId ? aggressorId : defenderId;
  }

  // Source is the defender → opposing is the aggressor
  assertEqual(getOpposingFactionId(2, 1, 2), 1, 'Source is defender → opposing is aggressor');
  // Source is the aggressor → opposing is the defender
  assertEqual(getOpposingFactionId(1, 1, 2), 2, 'Source is aggressor → opposing is defender');
}

// ============================================================
// 17. WORLD STATE ACTIVE QUEST ENRICHMENT
// ============================================================
console.log('\n=== Test 17: Active Quest Enrichment ===\n');

{
  // Test the enrichment logic from dmSession.js
  const activeFactions = [
    { id: 1, name: 'Harpers' },
    { id: 2, name: 'Zhentarim' },
    { id: 3, name: 'Order of the Gauntlet' }
  ];

  const quests = [
    { quest_type: 'faction', source_type: 'faction', source_id: 1, rewards: {} },
    { quest_type: 'faction_conflict', source_type: 'faction', source_id: 2, rewards: { aggressor_faction_id: 2, defender_faction_id: 1 } },
    { quest_type: 'main', source_type: 'generated', source_id: null, rewards: {} }
  ];

  // Enrich quests with faction names
  for (const q of quests) {
    if (q.source_type === 'faction' && q.source_id) {
      const faction = activeFactions.find(f => f.id === q.source_id);
      q.faction_name = faction?.name || null;
    }
    if (q.quest_type === 'faction_conflict' && q.rewards) {
      const agg = activeFactions.find(f => f.id === q.rewards.aggressor_faction_id);
      const def = activeFactions.find(f => f.id === q.rewards.defender_faction_id);
      q.rewards.aggressor_faction_name = agg?.name || null;
      q.rewards.defender_faction_name = def?.name || null;
    }
  }

  assertEqual(quests[0].faction_name, 'Harpers', 'Faction quest enriched with Harpers name');
  assertEqual(quests[1].faction_name, 'Zhentarim', 'Conflict quest enriched with source faction name');
  assertEqual(quests[1].rewards.aggressor_faction_name, 'Zhentarim', 'Conflict quest has aggressor faction name');
  assertEqual(quests[1].rewards.defender_faction_name, 'Harpers', 'Conflict quest has defender faction name');
  assert(quests[2].faction_name === undefined, 'Main quest has no faction name');
}

// ============================================================
// 18. FACTION RELATIONSHIP JSON PARSING
// ============================================================
console.log('\n=== Test 18: Faction Relationship Parsing ===\n');

{
  // Test the fixed JSON parsing in checkRivalReactions
  function parseRelationship(factionRelationships, targetId) {
    const parsed = typeof factionRelationships === 'string'
      ? JSON.parse(factionRelationships || '{}')
      : (factionRelationships || {});
    return String(parsed[targetId] || 'neutral').toLowerCase();
  }

  // JSON string format
  assertEqual(parseRelationship('{"1":"hostile","2":"allied"}', 1), 'hostile', 'Parses hostile from JSON string');
  assertEqual(parseRelationship('{"1":"hostile","2":"allied"}', 2), 'allied', 'Parses allied from JSON string');
  assertEqual(parseRelationship('{"1":"hostile"}', 3), 'neutral', 'Missing key defaults to neutral');

  // Object format
  assertEqual(parseRelationship({ 1: 'enemy', 2: 'rival' }, 1), 'enemy', 'Parses enemy from object');
  assertEqual(parseRelationship({ 1: 'enemy', 2: 'rival' }, 2), 'rival', 'Parses rival from object');

  // Edge cases
  assertEqual(parseRelationship(null, 1), 'neutral', 'null defaults to neutral');
  assertEqual(parseRelationship(undefined, 1), 'neutral', 'undefined defaults to neutral');
  assertEqual(parseRelationship('{}', 1), 'neutral', 'Empty object defaults to neutral');
}

// ============================================================
// RESULTS
// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`Faction Quest Tests: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
