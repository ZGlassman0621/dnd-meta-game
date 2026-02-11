/**
 * D&D 5e Conditions - Server-side reference for prompt building and marker detection
 */

export const CONDITION_NAMES = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled',
  'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned',
  'Prone', 'Restrained', 'Stunned', 'Unconscious',
  'Exhaustion 1', 'Exhaustion 2', 'Exhaustion 3', 'Exhaustion 4', 'Exhaustion 5', 'Exhaustion 6'
];

/**
 * Detect condition change markers in AI response text.
 * Markers: [CONDITION_ADD: Target="Player" Condition="poisoned"]
 *          [CONDITION_REMOVE: Target="Player" Condition="poisoned"]
 */
export function detectConditionChanges(text) {
  if (!text) return { applied: [], removed: [] };

  const applied = [];
  const removed = [];

  // Match [CONDITION_ADD: Target="..." Condition="..."]
  const addPattern = /\[CONDITION_ADD:\s*Target="([^"]+)"\s*Condition="([^"]+)"\]/gi;
  let match;
  while ((match = addPattern.exec(text)) !== null) {
    applied.push({ target: match[1], condition: match[2].toLowerCase().replace(/\s+/g, '_') });
  }

  // Match [CONDITION_REMOVE: Target="..." Condition="..."]
  const removePattern = /\[CONDITION_REMOVE:\s*Target="([^"]+)"\s*Condition="([^"]+)"\]/gi;
  while ((match = removePattern.exec(text)) !== null) {
    removed.push({ target: match[1], condition: match[2].toLowerCase().replace(/\s+/g, '_') });
  }

  return { applied, removed };
}

/**
 * Format active conditions into a system note for AI context injection
 */
export function formatConditionsForAI(playerConditions, companionConditions) {
  const parts = [];

  if (playerConditions && playerConditions.length > 0) {
    const condNames = playerConditions.map(c => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    parts.push(`Player is currently: ${condNames.join(', ')}`);
  }

  if (companionConditions) {
    for (const [name, conditions] of Object.entries(companionConditions)) {
      if (conditions && conditions.length > 0) {
        const condNames = conditions.map(c => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
        parts.push(`${name} is currently: ${condNames.join(', ')}`);
      }
    }
  }

  if (parts.length === 0) return null;

  return `[SYSTEM NOTE — Active conditions]: ${parts.join('. ')}. Reference these conditions mechanically (disadvantage, etc.) and narratively. Do not announce them — weave into the story.`;
}
