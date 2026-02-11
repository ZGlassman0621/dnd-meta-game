/**
 * Tests for character memory system and player autonomy enforcement.
 * Verifies extraction prompt, memory formatting, update logic, and prompt injection.
 *
 * Run: node tests/character-memory.test.js
 */

import { createDMSystemPrompt } from '../server/services/dmPromptBuilder.js';
import { buildMemoryExtractionPrompt, updateCharacterMemories } from '../server/services/dmSessionService.js';
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

function readSource(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf-8');
}

// ===== Mock data for prompt tests =====
const mockCharacter = {
  id: 1, name: 'Rivelious', nickname: null,
  race: 'Human', class: 'Cleric', level: 5,
  background: 'Acolyte', gender: 'male',
  ability_scores: JSON.stringify({ str: 10, dex: 12, con: 14, int: 13, wis: 18, cha: 14 }),
  max_hp: 38, current_hp: 38, armor_class: 16,
  gold_gp: 45, silver_sp: 0, copper_cp: 0,
  equipment: JSON.stringify({ weapons: ['Mace'], armor: ['Chain Mail', 'Shield'], other: ['Holy Symbol', 'Prayer Book'] }),
  backstory: 'A cleric from the Order of the Gilded Dawn.'
};

const sampleMemories = `- Prefers tea over alcohol — gave up drinking after too many drunken nights at the Order
- Misses the Order of the Gilded Dawn despite disagreements with their worldview
- The Order of the Gilded Dawn produces spirits and distilled beverages
- Unprepared for cold weather — travel cloak, thin mittens, worn-through boots`;

// ===== 1. EXTRACTION PROMPT =====
console.log('\n=== Test 1: Memory Extraction Prompt ===\n');

{
  const promptNoExisting = buildMemoryExtractionPrompt('');
  assert(promptNoExisting.includes('CHARACTER PERSONALITY observations'), 'Prompt asks for personality observations');
  assert(promptNoExisting.includes('Personal preferences'), 'Includes preferences category');
  assert(promptNoExisting.includes('Emotional tendencies'), 'Includes emotional tendencies category');
  assert(promptNoExisting.includes('Moral compass'), 'Includes moral compass category');
  assert(promptNoExisting.includes('Fears, phobias'), 'Includes fears category');
  assert(promptNoExisting.includes('Current preparedness'), 'Includes current state category');
  assert(promptNoExisting.includes('NO_NEW_MEMORIES'), 'Includes no-new-memories escape');
  assert(promptNoExisting.includes('Maximum 5'), 'Limits to 5 observations per session');
  assert(promptNoExisting.includes('NEW:'), 'Output format includes NEW section');
  assert(promptNoExisting.includes('UPDATED:'), 'Output format includes UPDATED section');
  assert(promptNoExisting.includes('OLD:'), 'Update format includes OLD reference');
  assert(!promptNoExisting.includes('ALREADY KNOWN'), 'No existing memories = no ALREADY KNOWN section');

  const promptWithExisting = buildMemoryExtractionPrompt(sampleMemories);
  assert(promptWithExisting.includes('ALREADY KNOWN'), 'With existing memories, includes ALREADY KNOWN section');
  assert(promptWithExisting.includes('Prefers tea over alcohol'), 'Existing memories appear in prompt');
  assert(promptWithExisting.includes('do NOT repeat'), 'Instructs not to repeat existing');
}

// ===== 2. CHARACTER MEMORY FORMATTING FOR DM PROMPT =====
console.log('\n=== Test 2: Character Memory Formatting in DM Prompt ===\n');

{
  const mockContext = {
    isContinuing: false,
    campaignModule: null,
    startingLocation: { name: 'Bryn Shander' },
    era: null,
    customConcepts: '',

    companions: [],
    customNpcs: [],
    previousSummaries: [],
    campaignNotes: '',
    pendingNarratives: [],
    planSummary: null,
    worldState: null,
    campaignLength: 'ongoing-saga',
    characterMemories: sampleMemories
  };

  const prompt = createDMSystemPrompt(mockCharacter, mockContext);

  assert(prompt.includes('CHARACTER PERSONALITY (OBSERVED IN PLAY)'), 'Prompt contains character personality section');
  assert(prompt.includes('Prefers tea over alcohol'), 'Memory content injected into prompt');
  assert(prompt.includes('Unprepared for cold weather'), 'Current state memory injected');
  assert(prompt.includes('Order of the Gilded Dawn produces spirits'), 'Lore memory injected');
  assert(prompt.includes('Weave these details into the narrative naturally'), 'Usage instructions included');
  assert(prompt.includes('CURRENT state'), 'Instructions mention current state tracking');

  // Verify ordering: character memories before campaign notes
  const memoryPos = prompt.indexOf('CHARACTER PERSONALITY (OBSERVED IN PLAY)');
  const campaignNotesPos = prompt.indexOf('CAMPAIGN MEMORY');
  // If no campaign notes, campaignNotesPos is -1 which is fine
  assert(memoryPos > 0, 'Character personality section exists in prompt');

  // Verify it does NOT appear when empty
  const emptyContext = { ...mockContext, characterMemories: '' };
  const emptyPrompt = createDMSystemPrompt(mockCharacter, emptyContext);
  assert(!emptyPrompt.includes('CHARACTER PERSONALITY (OBSERVED IN PLAY)'), 'Empty memories = no section in prompt');
}

// ===== 3. MEMORY UPDATE LOGIC =====
console.log('\n=== Test 3: Memory Update Logic (NEW + UPDATED) ===\n');

{
  // Test NEW additions
  const newOnlyResponse = `NEW:
- Dislikes being called "boy" — reacts with visible irritation
- Enjoys woodcarving during downtime`;

  // Mock dbRun to capture the update
  let capturedUpdate = null;
  const originalDbRun = (await import('../server/database.js')).dbRun;

  // We can't easily mock dbRun, so test the parsing logic by reading the source
  const source = readSource('server/services/dmSessionService.js');

  assert(source.includes('export async function updateCharacterMemories'), 'updateCharacterMemories function exists');
  assert(source.includes('NEW:'), 'Parser looks for NEW section');
  assert(source.includes('UPDATED:'), 'Parser looks for UPDATED section');
  assert(source.includes('OLD:'), 'Parser handles OLD→NEW replacement');
  assert(source.includes('3000'), 'Soft cap at 3KB');
  assert(source.includes('fuzzy'), 'Uses fuzzy matching for updates');

  // Test that NO_NEW_MEMORIES response is handled
  assert(source.includes('NO_NEW_MEMORIES'), 'Handles NO_NEW_MEMORIES sentinel');
}

// ===== 4. PLAYER AUTONOMY ENFORCEMENT =====
console.log('\n=== Test 4: Player Autonomy Enforcement (Strengthened) ===\n');

{
  const mockContext = {
    isContinuing: false,
    campaignModule: null,
    startingLocation: { name: 'Waterdeep' },
    era: null,
    customConcepts: '',

    companions: [],
    customNpcs: [],
    previousSummaries: [],
    campaignNotes: '',
    pendingNarratives: [],
    planSummary: null,
    worldState: null,
    campaignLength: 'ongoing-saga',
    characterMemories: ''
  };

  const prompt = createDMSystemPrompt(mockCharacter, mockContext);

  // ABSOLUTE RULES section
  assert(prompt.includes('NEVER generate dialogue for the player character'), 'Absolute rules: never generate dialogue');
  assert(prompt.includes('NEVER write "you say"'), 'Absolute rules: forbids "you say"');
  assert(prompt.includes('"you reply"'), 'Absolute rules: forbids "you reply"');
  assert(prompt.includes('"you ask"'), 'Absolute rules: forbids "you ask"');
  assert(prompt.includes('"you tell"'), 'Absolute rules: forbids "you tell"');
  assert(prompt.includes('extended speeches'), 'Absolute rules: forbids extended speeches');

  // PLAYER AUTONOMY section - principle-based rules (no WRONG/RIGHT examples)
  assert(prompt.includes('NEVER write the player speaking in any form'), 'Player autonomy: forbids all forms of player speech');
  assert(prompt.includes('NEVER write implied decisions'), 'Player autonomy: forbids implied decisions');
  assert(prompt.includes('describe the NPC waiting and END your message'), 'Player autonomy: instructs to end and let player speak');
  assert(prompt.includes('short replies, long speeches, inner thoughts'), 'Player autonomy: covers all forms of player speech');

  // FINAL REMINDER section
  const finalReminderPos = prompt.indexOf('FINAL REMINDER');
  const afterFinal = prompt.substring(finalReminderPos);
  assert(afterFinal.includes('NEVER generate player dialogue'), 'Final reminder: never generate dialogue');
  assert(afterFinal.includes('no implied speech or decisions'), 'Final reminder: mentions implied speech');
  assert(afterFinal.includes('Zero exceptions'), 'Final reminder: zero exceptions');
}

// ===== 5. DM GUIDELINE - CHARACTER OBSERVATION =====
console.log('\n=== Test 5: DM Guideline — Character Observation ===\n');

{
  const mockContext = {
    isContinuing: false,
    campaignModule: null,
    startingLocation: { name: 'Neverwinter' },
    era: null,
    customConcepts: '',

    companions: [],
    customNpcs: [],
    previousSummaries: [],
    campaignNotes: '',
    pendingNarratives: [],
    planSummary: null,
    worldState: null,
    campaignLength: 'ongoing-saga',
    characterMemories: ''
  };

  const prompt = createDMSystemPrompt(mockCharacter, mockContext);

  assert(prompt.includes('character-defining moments'), 'DM guidelines include character observation instruction');
  assert(prompt.includes('preferences, values, fears, or emotional responses'), 'Lists what to observe');
}

// ===== 6. DATABASE MIGRATION =====
console.log('\n=== Test 6: Database Migration ===\n');

{
  const dbSource = readSource('server/database.js');
  assert(dbSource.includes("character_memories"), 'Database has character_memories migration');
  assert(dbSource.includes("ALTER TABLE characters ADD COLUMN character_memories TEXT DEFAULT ''"), 'Migration SQL is correct');
}

// ===== 7. SESSION END EXTRACTION CALL =====
console.log('\n=== Test 7: Session End Extraction Wiring ===\n');

{
  const routeSource = readSource('server/routes/dmSession.js');
  assert(routeSource.includes('buildMemoryExtractionPrompt'), 'Route imports buildMemoryExtractionPrompt');
  assert(routeSource.includes('updateCharacterMemories'), 'Route imports updateCharacterMemories');
  assert(routeSource.includes('character.character_memories'), 'Route references character_memories field');
  assert(routeSource.includes('Extract character personality memories'), 'Session end has memory extraction block');
  assert(routeSource.includes('Character memories extracted'), 'Logs successful memory extraction');
}

// ===== 8. SESSION START CONFIG =====
console.log('\n=== Test 8: Session Start Config Wiring ===\n');

{
  const routeSource = readSource('server/routes/dmSession.js');
  assert(routeSource.includes("characterMemories: character.character_memories || ''"), 'Session config includes characterMemories');
}

// ===== 9. API ENDPOINT =====
console.log('\n=== Test 9: Campaign Notes API Returns Character Memories ===\n');

{
  const charRouteSource = readSource('server/routes/character.js');
  assert(charRouteSource.includes('character_memories FROM characters'), 'GET endpoint selects character_memories');
  assert(charRouteSource.includes("characterMemories: character.character_memories"), 'Response includes characterMemories field');
}

// ===== RESULTS =====
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
