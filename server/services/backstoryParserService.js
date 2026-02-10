/**
 * Backstory Parser Service
 *
 * Parses player character backstories into structured elements using AI.
 * Extracts characters, locations, factions, events, and story hooks.
 */

import { isClaudeAvailable, chat as claudeChat } from './claude.js';
import { checkOllamaStatus, chat as ollamaChat } from './ollama.js';
import { dbGet, dbRun } from '../database.js';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

/**
 * Parse a character's backstory into structured elements
 * @param {number} characterId - The character ID
 * @returns {object} Parsed backstory data
 */
export async function parseBackstory(characterId) {
  const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
  if (!character) {
    throw new Error('Character not found');
  }

  if (!character.backstory || character.backstory.trim().length === 0) {
    throw new Error('Character has no backstory to parse');
  }

  const prompt = buildParsingPrompt(character.backstory, character);
  const result = await generateWithAI(prompt);
  const parsed = parseAIResponse(result, character);

  // Store the parsed backstory
  await dbRun(
    'UPDATE characters SET parsed_backstory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(parsed), characterId]
  );

  return parsed;
}

/**
 * Get the current parsed backstory for a character
 * @param {number} characterId - The character ID
 * @returns {object|null} Parsed backstory or null
 */
export async function getParsedBackstory(characterId) {
  const character = await dbGet('SELECT backstory, parsed_backstory FROM characters WHERE id = ?', [characterId]);
  if (!character) {
    throw new Error('Character not found');
  }

  if (!character.parsed_backstory) {
    return null;
  }

  const parsed = JSON.parse(character.parsed_backstory);

  // Check if backstory has changed since parsing
  const currentHash = hashBackstory(character.backstory || '');
  parsed.backstory_changed = parsed.source_hash !== currentHash;

  return parsed;
}

/**
 * Re-parse backstory with option to preserve manual edits
 * @param {number} characterId - The character ID
 * @param {boolean} preserveManualEdits - Keep manually added/edited elements
 * @returns {object} Updated parsed backstory
 */
export async function reparseBackstory(characterId, preserveManualEdits = false) {
  const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
  if (!character) {
    throw new Error('Character not found');
  }

  if (!character.backstory || character.backstory.trim().length === 0) {
    throw new Error('Character has no backstory to parse');
  }

  // Get existing parsed data for preservation
  const existing = character.parsed_backstory ? JSON.parse(character.parsed_backstory) : null;

  // Parse the backstory fresh
  const prompt = buildParsingPrompt(character.backstory, character);
  const result = await generateWithAI(prompt);
  const newParsed = parseAIResponse(result, character);

  // If preserving manual edits, merge
  if (preserveManualEdits && existing) {
    const elementTypes = ['characters', 'locations', 'factions', 'events', 'story_hooks'];

    for (const type of elementTypes) {
      const manualElements = (existing.elements[type] || []).filter(el => !el.ai_generated);
      const editedElements = (existing.elements[type] || []).filter(el => el.ai_generated && el.notes);

      // Add manual elements back
      newParsed.elements[type] = [...newParsed.elements[type], ...manualElements];

      // Preserve notes on edited elements by matching names
      for (const edited of editedElements) {
        const match = newParsed.elements[type].find(el =>
          el.name?.toLowerCase() === edited.name?.toLowerCase() ||
          el.title?.toLowerCase() === edited.title?.toLowerCase()
        );
        if (match) {
          match.notes = edited.notes;
        }
      }
    }

    newParsed.manual_additions = true;
  }

  // Store updated parsed backstory
  await dbRun(
    'UPDATE characters SET parsed_backstory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(newParsed), characterId]
  );

  return newParsed;
}

/**
 * Update a specific element in the parsed backstory
 * @param {number} characterId - The character ID
 * @param {string} elementType - Type of element (characters, locations, etc.)
 * @param {string} elementId - The element's unique ID
 * @param {object} updates - Fields to update
 * @returns {object} Updated parsed backstory
 */
export async function updateElement(characterId, elementType, elementId, updates) {
  const character = await dbGet('SELECT parsed_backstory FROM characters WHERE id = ?', [characterId]);
  if (!character || !character.parsed_backstory) {
    throw new Error('No parsed backstory found');
  }

  const parsed = JSON.parse(character.parsed_backstory);
  const elements = parsed.elements[elementType];

  if (!elements) {
    throw new Error(`Invalid element type: ${elementType}`);
  }

  const index = elements.findIndex(el => el.id === elementId);
  if (index === -1) {
    throw new Error('Element not found');
  }

  // Update the element
  elements[index] = { ...elements[index], ...updates };

  // Mark that we have manual modifications
  parsed.manual_additions = true;

  // Save back
  await dbRun(
    'UPDATE characters SET parsed_backstory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(parsed), characterId]
  );

  return parsed;
}

/**
 * Add a new element to the parsed backstory
 * @param {number} characterId - The character ID
 * @param {string} elementType - Type of element
 * @param {object} element - The element data
 * @returns {object} Updated parsed backstory
 */
export async function addElement(characterId, elementType, element) {
  const character = await dbGet('SELECT parsed_backstory FROM characters WHERE id = ?', [characterId]);
  if (!character) {
    throw new Error('Character not found');
  }

  let parsed = character.parsed_backstory ? JSON.parse(character.parsed_backstory) : createEmptyParsedBackstory();

  if (!parsed.elements[elementType]) {
    throw new Error(`Invalid element type: ${elementType}`);
  }

  // Add the new element with a unique ID and mark as manually added
  const newElement = {
    ...element,
    id: element.id || randomUUID(),
    ai_generated: false
  };

  parsed.elements[elementType].push(newElement);
  parsed.manual_additions = true;

  // Save back
  await dbRun(
    'UPDATE characters SET parsed_backstory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(parsed), characterId]
  );

  return parsed;
}

/**
 * Remove an element from the parsed backstory
 * @param {number} characterId - The character ID
 * @param {string} elementType - Type of element
 * @param {string} elementId - The element's unique ID
 * @returns {object} Updated parsed backstory
 */
export async function removeElement(characterId, elementType, elementId) {
  const character = await dbGet('SELECT parsed_backstory FROM characters WHERE id = ?', [characterId]);
  if (!character || !character.parsed_backstory) {
    throw new Error('No parsed backstory found');
  }

  const parsed = JSON.parse(character.parsed_backstory);

  if (!parsed.elements[elementType]) {
    throw new Error(`Invalid element type: ${elementType}`);
  }

  const index = parsed.elements[elementType].findIndex(el => el.id === elementId);
  if (index === -1) {
    throw new Error('Element not found');
  }

  // Remove the element
  parsed.elements[elementType].splice(index, 1);

  // Save back
  await dbRun(
    'UPDATE characters SET parsed_backstory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(parsed), characterId]
  );

  return parsed;
}

// ============================================================
// PROMPT BUILDER
// ============================================================

function buildParsingPrompt(backstoryText, character) {
  return `You are a D&D backstory analyst. Parse this character backstory and extract structured elements.

CHARACTER CONTEXT:
- Name: ${character.name || 'Unknown'}
- Class: ${character.class || 'Unknown'}
- Race: ${character.race || 'Unknown'}
- Background: ${character.background || 'Unknown'}

BACKSTORY TEXT:
${backstoryText}

Extract the following categories of information. Only include elements that are explicitly mentioned or strongly implied in the backstory. If a category has no relevant information, return an empty array for that category.

Return ONLY valid JSON with this exact structure:
{
  "characters": [
    {
      "name": "Character's full name",
      "relationship": "mentor|family|friend|enemy|rival|acquaintance|romantic|employer|servant|other",
      "description": "1-2 sentences about this character and their connection to the protagonist",
      "status": "alive|dead|unknown"
    }
  ],
  "locations": [
    {
      "name": "Location name",
      "type": "hometown|birthplace|workplace|visited|significant|current",
      "description": "1-2 sentences about this place's significance to the character"
    }
  ],
  "factions": [
    {
      "name": "Organization or faction name",
      "relationship": "member|former_member|ally|enemy|neutral|wanted_by",
      "description": "1-2 sentences about the character's connection to this group"
    }
  ],
  "events": [
    {
      "title": "Short descriptive title for the event",
      "description": "What happened and why it matters to the character",
      "timeframe": "before_birth|early_life|formative_years|coming_of_age|established|recent|unknown"
    }
  ],
  "story_hooks": [
    {
      "title": "Short title for this story hook",
      "description": "Unresolved thread, goal, or potential story element",
      "category": "revenge|mystery|debt|promise|quest|goal|relationship|secret|other"
    }
  ],
  "summary": "2-3 sentence summary capturing the essence of this character's backstory"
}

IMPORTANT:
- Only extract what is actually in the backstory text
- Do not invent or assume information not present
- Use "unknown" status/timeframe when not specified
- Keep descriptions concise but informative`;
}

// ============================================================
// AI GENERATION
// ============================================================

async function generateWithAI(prompt) {
  // Try Claude first
  if (isClaudeAvailable()) {
    try {
      const response = await claudeChat(
        'You are a D&D backstory analyst. Return ONLY valid JSON, no explanation or markdown code fences.',
        [{ role: 'user', content: prompt }],
        3, 'opus'
      );
      return response;
    } catch (error) {
      console.error('Claude backstory parsing failed:', error.message);
    }
  }

  // Try Ollama as fallback
  const ollamaStatus = await checkOllamaStatus();
  if (ollamaStatus.available) {
    try {
      const response = await ollamaChat([
        { role: 'system', content: 'You are a D&D backstory analyst. Return ONLY valid JSON, no explanation or markdown code fences.' },
        { role: 'user', content: prompt }
      ]);
      return response;
    } catch (error) {
      console.error('Ollama backstory parsing failed:', error.message);
    }
  }

  throw new Error('No AI provider available for backstory parsing');
}

// ============================================================
// RESPONSE PARSER
// ============================================================

function parseAIResponse(response, character) {
  let jsonStr = response;

  // Handle markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Find JSON object
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Process each element type to add IDs and ai_generated flag
    const processElements = (elements) => {
      return (elements || []).map(el => ({
        ...el,
        id: randomUUID(),
        ai_generated: true,
        notes: null
      }));
    };

    return {
      version: 1,
      parsed_at: new Date().toISOString(),
      source_hash: hashBackstory(character.backstory || ''),
      elements: {
        characters: processElements(parsed.characters),
        locations: processElements(parsed.locations),
        factions: processElements(parsed.factions),
        events: processElements(parsed.events),
        story_hooks: processElements(parsed.story_hooks)
      },
      summary: parsed.summary || '',
      manual_additions: false
    };
  } catch (error) {
    console.error('Failed to parse backstory response:', error);
    console.error('Response was:', response);
    throw new Error('Failed to parse AI-generated backstory analysis');
  }
}

// ============================================================
// HELPERS
// ============================================================

function hashBackstory(text) {
  return createHash('md5').update(text || '').digest('hex');
}

function createEmptyParsedBackstory() {
  return {
    version: 1,
    parsed_at: new Date().toISOString(),
    source_hash: '',
    elements: {
      characters: [],
      locations: [],
      factions: [],
      events: [],
      story_hooks: []
    },
    summary: '',
    manual_additions: false
  };
}

export default {
  parseBackstory,
  getParsedBackstory,
  reparseBackstory,
  updateElement,
  addElement,
  removeElement
};
