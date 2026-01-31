/**
 * Quick test script to verify multi-NPC conversation behavior
 * Run with: node server/test-prompt.js
 */

import dotenv from 'dotenv';
dotenv.config();

import claude from './services/claude.js';
import ollama, { createDMSystemPrompt } from './services/ollama.js';

// Minimal test character with all required fields
const testCharacter = {
  id: 999,
  name: 'Test Hero',
  first_name: 'Test',
  nickname: 'Testy',
  gender: 'male',
  race: 'human',
  class: 'fighter',
  subclass: null,
  level: 3,
  background: 'soldier',
  current_hp: 25,
  max_hp: 25,
  armor_class: 16,
  abilities: JSON.stringify({ str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }),
  skills: JSON.stringify(['Athletics', 'Intimidation']),
  inventory: JSON.stringify([{ name: 'longsword' }, { name: 'shield' }, { name: 'chain mail' }]),
  gold: 50
};

// Test session context that creates a multi-NPC scenario
const testSessionContext = {
  startingLocation: { id: 'waterdeep', name: 'Waterdeep' },
  era: { id: 'present', name: '1492 DR' },
  campaignLength: 'oneshot',
  arrivalHook: 'custom',
  customArrivalHook: 'You enter a busy tavern where three people immediately notice you.',
  contentPrefs: {},
  customConcepts: '',
  customNpcs: [],
  companions: []
};

async function runTest() {
  console.log('\n=== MULTI-NPC PROMPT TEST ===\n');

  // Build the system prompt (character, sessionContext, secondCharacter)
  const systemPrompt = createDMSystemPrompt(testCharacter, testSessionContext, null);

  // Determine which provider to use
  const usesClaude = claude.isClaudeAvailable();
  console.log(`Using provider: ${usesClaude ? 'Claude' : 'Ollama'}\n`);

  // Test scenario: Player enters a room with multiple NPCs who might all want to talk
  const testScenarios = [
    {
      name: 'Tavern Entry (Multi-NPC greeting)',
      setup: 'You enter the Yawning Portal tavern. Behind the bar stands Durnan, the famous retired adventurer who owns this establishment. He looks up as you enter. A serving girl named Mira pauses with a tray of drinks. At the bar sits Elminster, the old wizard, who turns to study you.',
      playerAction: 'I walk up to the bar and sit down.'
    },
    {
      name: 'Group Conversation (Multiple questions)',
      setup: 'You sit at a private table with exactly three adventurers: Kira the ranger (a human woman with short brown hair), Brom the dwarf (red-bearded and jovial), and Selene the mage (an elven woman in blue robes). Only the four of you are at this table.',
      playerAction: 'I tell them about my journey here.'
    },
    {
      name: 'Stress Test (Emotional scene with many NPCs)',
      setup: 'You stand in the town square of Triboar. Mayor Harburk waits with arms crossed. Captain Shella of the guard stands beside him. The merchant Ander wrings his hands nervously. Priestess Imani watches from the temple steps.',
      playerAction: 'I announce that I have found the missing children.'
    }
  ];

  for (const scenario of testScenarios) {
    console.log(`\n--- Test: ${scenario.name} ---`);
    console.log(`Setup: ${scenario.setup}`);
    console.log(`Player: "${scenario.playerAction}"`);
    console.log('\nAI Response:');
    console.log('-'.repeat(50));

    // Embed the scene directly in the system prompt to ensure the model follows it
    const sceneSystemPrompt = systemPrompt + `

CURRENT SCENE - CRITICAL:
${scenario.setup}
These are the ONLY NPCs present. Use their exact names. Do NOT invent other characters.`;

    const messages = [
      { role: 'user', content: scenario.playerAction }
    ];

    try {
      let response;
      if (usesClaude) {
        response = await claude.chat(sceneSystemPrompt, messages);
      } else {
        const ollamaMessages = [
          { role: 'system', content: sceneSystemPrompt },
          ...messages
        ];
        response = await ollama.chat(ollamaMessages);
      }

      console.log(response);
      console.log('-'.repeat(50));

      // Basic analysis
      const questionMarks = (response.match(/\?"/g) || []).length + (response.match(/\?'/g) || []).length;
      const quotedSections = response.match(/"[^"]+"/g) || [];

      console.log(`\nAnalysis:`);
      console.log(`  - Questions asked (?" or ?'): ${questionMarks}`);
      console.log(`  - Quoted dialogue sections: ${quotedSections.length}`);

      if (questionMarks > 1) {
        console.log(`  ⚠️  WARNING: Multiple questions detected - may violate one-question rule`);
      }
      if (quotedSections.length > 2) {
        console.log(`  ⚠️  WARNING: Multiple dialogue sections - may have multiple NPCs speaking`);
      }
      if (questionMarks <= 1 && quotedSections.length <= 2) {
        console.log(`  ✓ Response appears to follow the rules`);
      }

    } catch (error) {
      console.log(`ERROR: ${error.message}`);
    }

    console.log('\n');
  }

  console.log('=== TEST COMPLETE ===\n');
}

runTest().catch(console.error);
