import pdf from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function parseCharacterSheet(pdfBuffer) {
  try {
    // Extract text from PDF
    const data = await pdf(pdfBuffer);
    const text = data.text;

    // Use Claude to parse the character sheet text
    const prompt = `You are a D&D character sheet parser. Extract character information from this D&D Beyond character sheet text.

Character Sheet Text:
${text}

Please extract and return the following information in valid JSON format:
{
  "name": "character name",
  "class": "character class (e.g., Fighter, Wizard, Rogue)",
  "level": number,
  "max_hp": number,
  "current_hp": number (assume full HP if not specified),
  "experience": number (current XP),
  "experience_to_next_level": number (XP needed for next level),
  "gold_gp": number (gold pieces),
  "gold_sp": number (silver pieces),
  "gold_cp": number (copper pieces),
  "armor_class": number,
  "speed": number
}

Important:
- Extract exact values from the sheet
- For experience_to_next_level, use standard D&D 5e progression
- If gold is shown as total, convert to gp/sp/cp appropriately
- Return ONLY valid JSON, no other text

If you cannot find a value, use reasonable defaults:
- current_hp = max_hp
- experience = 0
- gold values = 0
- armor_class = 10
- speed = 30`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const responseText = message.content[0].text;
    const characterData = JSON.parse(responseText);

    return characterData;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse character sheet. Please ensure it is a valid D&D Beyond PDF.');
  }
}

// XP thresholds for D&D 5e levels 1-20
const XP_THRESHOLDS = [
  0,      // Level 1
  300,    // Level 2
  900,    // Level 3
  2700,   // Level 4
  6500,   // Level 5
  14000,  // Level 6
  23000,  // Level 7
  34000,  // Level 8
  48000,  // Level 9
  64000,  // Level 10
  85000,  // Level 11
  100000, // Level 12
  120000, // Level 13
  140000, // Level 14
  165000, // Level 15
  195000, // Level 16
  225000, // Level 17
  265000, // Level 18
  305000, // Level 19
  355000  // Level 20
];

export function getXPToNextLevel(currentLevel, currentXP) {
  if (currentLevel >= 20) return 0;

  const nextLevelXP = XP_THRESHOLDS[currentLevel];
  return nextLevelXP - currentXP;
}
