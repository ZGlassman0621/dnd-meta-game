/**
 * Tests for moral diversity rules in AI prompts.
 * Verifies that campaign plan generation, DM sessions, and companion backstories
 * include guidance for morally diverse NPCs and independent companions.
 *
 * Also tests the session start date randomization fix.
 *
 * Run: node tests/moral-diversity.test.js
 */

import { createDMSystemPrompt } from '../server/services/dmPromptBuilder.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// ===== Helper: Read source file =====
function readSource(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf-8');
}

// ===== 1. DM SYSTEM PROMPT - NPC MORAL DIVERSITY =====
console.log('\n=== Test 1: DM System Prompt — NPC Moral Diversity ===\n');

{
  // Create mock character and session context
  const mockCharacter = {
    id: 1, name: 'Testchar', nickname: null,
    race: 'Human', class: 'Fighter', level: 5,
    background: 'Soldier', gender: 'male',
    ability_scores: JSON.stringify({ str: 16, dex: 12, con: 14, int: 10, wis: 13, cha: 8 }),
    max_hp: 44, current_hp: 44, armor_class: 18,
    gold_gp: 50, silver_sp: 0, copper_cp: 0,
    equipment: JSON.stringify({ weapons: ['Longsword'], armor: ['Chain Mail'], other: ['Backpack'] }),
    backstory: 'A soldier from the north.'
  };

  const mockContext = {
    isContinuing: false,
    campaignModule: null,
    startingLocation: { name: 'Waterdeep' },
    era: null,
    customConcepts: '',
    contentPreferences: {},
    companions: [],
    customNpcs: [],
    previousSummaries: [],
    campaignNotes: '',
    pendingNarratives: [],
    planSummary: null,
    worldState: null,
    campaignLength: 'ongoing-saga'
  };

  const prompt = createDMSystemPrompt(mockCharacter, mockContext);

  // NPC Moral Diversity section
  assert(prompt.includes('NPC MORAL DIVERSITY - CRITICAL'), 'Contains NPC MORAL DIVERSITY section header');
  assert(prompt.includes('DO NOT default every NPC to "friendly and helpful."'), 'Instructs against defaulting to friendly NPCs');
  assert(prompt.includes('Merchants overcharge when they can'), 'Includes merchant overcharging example');
  assert(prompt.includes('Guards take bribes'), 'Includes guard bribe example');
  assert(prompt.includes('Helpful NPCs should WANT SOMETHING in return'), 'NPCs should want something in return');
  assert(prompt.includes('Shared interests ≠ shared values'), 'Allies can disagree morally');
  assert(prompt.includes('jealousy, cowardice, spite, laziness, greed'), 'Lists petty human flaws');
  assert(prompt.includes('Check the campaign plan NPC alignments'), 'References campaign plan alignments');

  // Real Stakes section expansion
  assert(prompt.includes('not every shopkeeper is honest, not every guard is just'), 'Real Stakes extends beyond villains to whole world');

  // Final Reminder reinforcement
  assert(prompt.includes('NPC MORAL DIVERSITY: Not every NPC is kind or helpful'), 'FINAL REMINDER includes moral diversity reinforcement');
}

// ===== 2. DM SYSTEM PROMPT - COMPANION INDEPENDENCE =====
console.log('\n=== Test 2: DM System Prompt — Companion Personality & Independence ===\n');

{
  const mockCharacter = {
    id: 1, name: 'Testchar', race: 'Elf', class: 'Wizard', level: 3,
    gender: 'female', background: 'Sage',
    ability_scores: JSON.stringify({ str: 8, dex: 14, con: 12, int: 18, wis: 13, cha: 10 }),
    max_hp: 20, current_hp: 20, armor_class: 12,
    gold_gp: 30, silver_sp: 0, copper_cp: 0,
    equipment: JSON.stringify({ weapons: ['Quarterstaff'], armor: [], other: ['Spellbook'] }),
    backstory: 'A scholar seeking lost knowledge.'
  };

  const mockCompanion = {
    name: 'Gornak', nickname: null, gender: 'male',
    race: 'Half-Orc', companion_class: 'Barbarian', companion_level: 3,
    companion_subclass: null, progression_type: 'class_based',
    companion_current_hp: 35, companion_max_hp: 35,
    companion_ability_scores: JSON.stringify({ str: 18, dex: 12, con: 16, int: 8, wis: 10, cha: 10 }),
    alignment: 'chaotic_neutral',
    personality_trait_1: 'Impulsive and hot-headed',
    personality_trait_2: 'Distrusts authority figures',
    ideals: 'Freedom above all else',
    bonds: 'Owes a debt to a crime lord',
    flaws: 'Quick to anger, drinks too much',
    motivation: 'Paying off his debt',
    voice: 'Gruff, clipped sentences',
    occupation: 'Mercenary',
    relationship_to_party: 'hired_muscle',
    equipment: JSON.stringify({ weapons: ['Greataxe'], armor: ['Hide Armor'], other: [] }),
    background_notes: 'A sellsword with a dark past.'
  };

  const mockContext = {
    isContinuing: false,
    campaignModule: null,
    startingLocation: { name: 'Baldur\'s Gate' },
    era: null,
    customConcepts: '',
    contentPreferences: {},
    companions: [mockCompanion],
    customNpcs: [],
    previousSummaries: [],
    campaignNotes: '',
    pendingNarratives: [],
    planSummary: null,
    worldState: null,
    campaignLength: 'ongoing-saga'
  };

  const prompt = createDMSystemPrompt(mockCharacter, mockContext);

  // Companion independence section
  assert(prompt.includes('COMPANION PERSONALITY AND MORAL INDEPENDENCE - CRITICAL'), 'Contains companion independence section');
  assert(prompt.includes('Companions are NOT yes-men'), 'States companions are not yes-men');
  assert(prompt.includes('CHECK EACH COMPANION\'S ALIGNMENT, IDEALS, AND FLAWS'), 'Instructs to check alignment/ideals/flaws');
  assert(prompt.includes('SHOULD disagree with the player'), 'Companions should disagree');
  assert(prompt.includes('Disagreement doesn\'t mean disloyalty'), 'Disagreement is not disloyalty');

  // Emotional range
  assert(prompt.includes('FEAR:'), 'Lists fear as companion emotion');
  assert(prompt.includes('DOUBT:'), 'Lists doubt as companion emotion');
  assert(prompt.includes('AMBITION:'), 'Lists ambition as companion emotion');
  assert(prompt.includes('RESENTMENT:'), 'Lists resentment as companion emotion');
  assert(prompt.includes('FRUSTRATION:'), 'Lists frustration as companion emotion');
  assert(prompt.includes('MORAL CONFLICT:'), 'Lists moral conflict as companion emotion');

  // Alignment-specific behavior
  assert(prompt.includes('lawful good companion should object when the player steals'), 'Lawful good objects to theft');
  assert(prompt.includes('chaotic neutral companion might act impulsively'), 'Chaotic neutral acts impulsively');
  assert(prompt.includes('evil or neutral alignments may suggest morally questionable solutions'), 'Evil companions suggest questionable solutions');
  assert(prompt.includes('good alignments may insist on helping'), 'Good companions insist on helping');
  assert(prompt.includes('companion personalities CLASH with each other'), 'Inter-companion conflict');

  // Verify companion data is in the prompt
  assert(prompt.includes('Gornak'), 'Companion name appears in prompt');
  assert(prompt.includes('chaotic_neutral'), 'Companion alignment appears in prompt');
  assert(prompt.includes('Impulsive and hot-headed'), 'Companion personality trait in prompt');
  assert(prompt.includes('Quick to anger, drinks too much'), 'Companion flaws in prompt');
}

// ===== 3. CAMPAIGN PLAN SERVICE - NPC SCHEMA & RULES =====
console.log('\n=== Test 3: Campaign Plan Service — NPC Alignment & Moral Diversity Rules ===\n');

{
  const source = readSource('server/services/campaignPlanService.js');

  // NPC schema has alignment field
  assert(source.includes('"alignment": "lawful_good|neutral_good|chaotic_good|lawful_neutral|true_neutral|chaotic_neutral|lawful_evil|neutral_evil|chaotic_evil"'),
    'NPC schema includes full 9-alignment field');

  // NPC motivation guidance
  assert(source.includes('selfish, altruistic, pragmatic, fearful, ambitious'),
    'NPC motivation field asks for diverse moral drivers');

  // Moral diversity rules
  assert(source.includes('NPC MORAL DIVERSITY — CRITICAL'), 'Contains NPC moral diversity rule section');
  assert(source.includes('at most 2-3 good-aligned NPCs out of 6-8'), 'Limits good-aligned NPCs');
  assert(source.includes('Evil doesn\'t mean mustache-twirling'), 'Evil is realistic, not cartoonish');
  assert(source.includes('Lawful evil means ruthlessly self-interested'), 'Explains lawful evil as realistic');

  // Companion schema has alignment
  assert(source.includes('"alignment": "Their actual moral alignment — NOT always good'),
    'Companion schema requires non-default alignment');
  assert(source.includes('personality WITH FLAWS'), 'Companion personality asks for flaws');
  assert(source.includes('can be selfish (payment, protection, revenge, escape)'),
    'Companion motivation can be selfish');

  // Companion diversity in rules
  assert(source.includes('Companions should SPAN ALIGNMENTS'), 'Rule 7 requires alignment span');
  assert(source.includes('cowardice, greed, arrogance, distrust, impulsiveness, zealotry'),
    'Rule 7 lists companion flaws');

  // Merchant personality moral disposition
  assert(source.includes('include moral disposition, not just demeanor'),
    'Merchant personality asks for moral disposition');
  assert(source.includes('shrewd and stingy, known to shortchange'),
    'Merchant personality example shows moral flaw');
}

// ===== 4. COMPANION BACKSTORY GENERATOR - MORAL COMPLEXITY =====
console.log('\n=== Test 4: Companion Backstory Generator — Moral Complexity ===\n');

{
  const source = readSource('server/services/companionBackstoryGenerator.js');

  // Fixed framing — companion is not a servant
  assert(source.includes('THE PLAYER CHARACTER (their traveling companion, NOT their master)'),
    'Fixed "MASTER/ALLY" to "traveling companion, NOT their master"');
  assert(!source.includes('THEIR MASTER/ALLY'),
    'Old "MASTER/ALLY" framing removed');

  // Personal goal can be selfish
  assert(source.includes('can be selfish: wealth, revenge, escape, power, proving themselves'),
    'Personal goal allows selfish motivations');

  // Secrets can be morally compromising
  assert(source.includes('can be morally compromising'),
    'Secrets can be morally compromising');

  // Moral complexity section
  assert(source.includes('MORAL COMPLEXITY — CRITICAL'), 'Contains moral complexity section');
  assert(source.includes('NOT a loyal sidekick'), 'States companion is not a loyal sidekick');
  assert(source.includes('independent person with their own moral compass'), 'Companion has own moral compass');
  assert(source.includes('FRICTION and interesting dynamics'), 'Backstory should create friction');
  assert(source.includes('REAL flaws that affect behavior'), 'Real behavioral flaws required');
  assert(source.includes('mercenary\'s loyalty drops if underpaid'), 'Value-based loyalty example');
}

// ===== 5. SESSION START DATE RANDOMIZATION =====
console.log('\n=== Test 5: Session Start Date Randomization Fix ===\n');

{
  const source = readSource('server/routes/dmSession.js');

  // Verify the fix is in place
  assert(source.includes('SELECT COUNT(*) as count FROM dm_sessions WHERE character_id'),
    'Checks for prior sessions before picking start day');
  assert(source.includes('isFirstSession'),
    'Uses isFirstSession flag');
  assert(source.includes('(isFirstSession || !character.game_day)'),
    'First session OR no game_day triggers randomization');
  assert(source.includes('Math.floor(Math.random() * 365) + 1'),
    'Randomizes to day 1-365 for new characters');

  // Verify old bug pattern is gone
  assert(!source.includes('const gameStartDay = character.game_day || (Math.floor'),
    'Old fallback pattern (game_day || random) is removed');
}

// ===== 6. PROMPT REINFORCEMENT PATTERN =====
console.log('\n=== Test 6: Moral Diversity Prompt Reinforcement (Primacy/Recency) ===\n');

{
  const mockCharacter = {
    id: 1, name: 'Test', race: 'Human', class: 'Rogue', level: 1,
    gender: 'male', background: 'Criminal',
    ability_scores: JSON.stringify({ str: 10, dex: 16, con: 12, int: 14, wis: 10, cha: 14 }),
    max_hp: 10, current_hp: 10, armor_class: 14,
    gold_gp: 15, silver_sp: 0, copper_cp: 0,
    equipment: JSON.stringify({ weapons: ['Dagger'], armor: ['Leather Armor'], other: [] }),
    backstory: ''
  };

  const mockContext = {
    isContinuing: false, campaignModule: null,
    startingLocation: { name: 'Neverwinter' }, era: null,
    customConcepts: '', contentPreferences: {},
    companions: [], customNpcs: [],
    previousSummaries: [], campaignNotes: '',
    pendingNarratives: [], planSummary: null,
    worldState: null, campaignLength: 'ongoing-saga'
  };

  const prompt = createDMSystemPrompt(mockCharacter, mockContext);

  // Find positions of key sections to verify ordering
  const npcDiversityPos = prompt.indexOf('NPC MORAL DIVERSITY - CRITICAL');
  const finalReminderPos = prompt.indexOf('FINAL REMINDER');
  const finalDiversityPos = prompt.indexOf('NPC MORAL DIVERSITY: Not every NPC is kind');
  const realStakesPos = prompt.indexOf('REAL STAKES AND GENUINE VILLAINS');

  assert(npcDiversityPos > 0, 'NPC MORAL DIVERSITY section exists in prompt body');
  assert(realStakesPos > 0, 'REAL STAKES section exists in prompt body');
  assert(finalReminderPos > 0, 'FINAL REMINDER section exists');
  assert(finalDiversityPos > finalReminderPos, 'Moral diversity reinforcement appears after FINAL REMINDER (recency)');
  assert(npcDiversityPos < finalReminderPos, 'NPC MORAL DIVERSITY body section appears before FINAL REMINDER (primacy)');

  // Verify the prompt has BOTH the detailed section AND the final reminder version
  const detailedCount = (prompt.match(/NPC MORAL DIVERSITY/g) || []).length;
  assert(detailedCount >= 2, `Moral diversity mentioned ${detailedCount} times (primacy + recency)`);
}

// ===== RESULTS =====
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
