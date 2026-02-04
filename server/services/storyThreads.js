/**
 * Story Thread System
 *
 * Manages persistent story consequences from meta adventures that carry over
 * into AI DM sessions and future adventures.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { generateStoryConsequences } from '../config/rewards.js';

// Thread types that can be created from adventures
export const THREAD_TYPES = {
  new_enemy: {
    name: 'New Enemy',
    description: 'A new antagonist or hostile faction that may appear in future adventures',
    priority: 'high',
    aiPromptWeight: 1.5
  },
  new_ally: {
    name: 'New Ally',
    description: 'A potential ally or friendly contact gained through adventure',
    priority: 'normal',
    aiPromptWeight: 1.0
  },
  intel: {
    name: 'Intelligence',
    description: 'Valuable information discovered that could affect future decisions',
    priority: 'normal',
    aiPromptWeight: 1.0
  },
  reputation: {
    name: 'Reputation Change',
    description: 'Your actions have affected how others perceive you',
    priority: 'normal',
    aiPromptWeight: 0.8
  },
  resource: {
    name: 'Resource',
    description: 'Access to new resources, locations, or opportunities',
    priority: 'low',
    aiPromptWeight: 0.6
  },
  mystery: {
    name: 'Mystery',
    description: 'An unanswered question or unexplained event',
    priority: 'normal',
    aiPromptWeight: 1.2
  },
  opportunity: {
    name: 'Opportunity',
    description: 'A time-limited chance to gain something valuable',
    priority: 'high',
    aiPromptWeight: 1.3
  },
  threat: {
    name: 'Looming Threat',
    description: 'A danger that will manifest if not addressed',
    priority: 'high',
    aiPromptWeight: 1.4
  },
  relationship: {
    name: 'Relationship Change',
    description: 'A shift in relationship with an NPC or faction',
    priority: 'normal',
    aiPromptWeight: 0.9
  }
};

// Quest relevance categories
export const QUEST_RELEVANCE = {
  side_quest: {
    name: 'Side Quest',
    description: 'Unrelated to the main quest but interesting in its own right',
    xpMultiplier: 1.0
  },
  quest_adjacent: {
    name: 'Quest Adjacent',
    description: 'Tangentially related to the main quest, may provide useful context',
    xpMultiplier: 1.1
  },
  quest_advancing: {
    name: 'Quest Advancing',
    description: 'Directly advances or resolves part of the main quest',
    xpMultiplier: 1.25
  }
};

/**
 * Create a new story thread from an adventure outcome
 */
export async function createStoryThread(characterId, threadData) {
  const {
    sourceType,
    sourceId,
    threadType,
    title,
    description,
    questRelevance = 'side_quest',
    relatedNpcs = [],
    relatedLocations = [],
    potentialOutcomes = [],
    consequenceCategory = 'intel',
    canResolveQuest = false,
    expiresAt = null
  } = threadData;

  const result = await dbRun(`
    INSERT INTO story_threads (
      character_id, source_type, source_id, thread_type, title, description,
      quest_relevance, related_npcs, related_locations, potential_outcomes,
      consequence_category, can_resolve_quest, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    characterId,
    sourceType,
    sourceId,
    threadType,
    title,
    description,
    questRelevance,
    JSON.stringify(relatedNpcs),
    JSON.stringify(relatedLocations),
    JSON.stringify(potentialOutcomes),
    consequenceCategory,
    canResolveQuest ? 1 : 0,
    expiresAt
  ]);

  return await dbGet('SELECT * FROM story_threads WHERE id = ?', [result.lastInsertRowid]);
}

/**
 * Get active story threads for a character
 */
export async function getActiveThreads(characterId, options = {}) {
  const { limit = 20, type = null, relevance = null, includeExpired = false } = options;

  let query = `
    SELECT * FROM story_threads
    WHERE character_id = ? AND status = 'active'
  `;
  const params = [characterId];

  if (!includeExpired) {
    query += ` AND (expires_at IS NULL OR expires_at > datetime('now'))`;
  }

  if (type) {
    query += ` AND thread_type = ?`;
    params.push(type);
  }

  if (relevance) {
    query += ` AND quest_relevance = ?`;
    params.push(relevance);
  }

  query += ` ORDER BY
    CASE priority
      WHEN 'high' THEN 1
      WHEN 'normal' THEN 2
      WHEN 'low' THEN 3
    END,
    created_at DESC
  LIMIT ?`;
  params.push(limit);

  const threads = await dbAll(query, params);

  // Parse JSON fields
  return threads.map(t => ({
    ...t,
    relatedNpcs: JSON.parse(t.related_npcs || '[]'),
    relatedLocations: JSON.parse(t.related_locations || '[]'),
    potentialOutcomes: JSON.parse(t.potential_outcomes || '[]')
  }));
}

/**
 * Get threads that can resolve the current quest
 */
export async function getQuestResolvingThreads(characterId) {
  const threads = await dbAll(`
    SELECT * FROM story_threads
    WHERE character_id = ? AND status = 'active' AND can_resolve_quest = 1
    ORDER BY created_at DESC
  `, [characterId]);

  return threads.map(t => ({
    ...t,
    relatedNpcs: JSON.parse(t.related_npcs || '[]'),
    relatedLocations: JSON.parse(t.related_locations || '[]'),
    potentialOutcomes: JSON.parse(t.potential_outcomes || '[]')
  }));
}

/**
 * Resolve a story thread
 */
export async function resolveThread(threadId, resolution) {
  await dbRun(`
    UPDATE story_threads
    SET status = 'resolved', resolution = ?, resolved_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `, [resolution, threadId]);

  return await dbGet('SELECT * FROM story_threads WHERE id = ?', [threadId]);
}

/**
 * Format threads for AI DM context
 * Returns a string suitable for inclusion in the system prompt
 */
export async function formatThreadsForAI(characterId, maxThreads = 5) {
  const threads = await getActiveThreads(characterId, { limit: maxThreads });

  if (threads.length === 0) {
    return null;
  }

  let context = `ACTIVE STORY THREADS (events from recent adventures that should influence the narrative):\n\n`;

  for (const thread of threads) {
    const typeInfo = THREAD_TYPES[thread.thread_type] || { name: thread.thread_type };
    const relevanceInfo = QUEST_RELEVANCE[thread.quest_relevance] || { name: 'Side Quest' };

    context += `[${typeInfo.name.toUpperCase()}] ${thread.title}\n`;
    context += `  Relevance: ${relevanceInfo.name}\n`;
    context += `  ${thread.description}\n`;

    if (thread.relatedNpcs && thread.relatedNpcs.length > 0) {
      context += `  Related NPCs: ${thread.relatedNpcs.join(', ')}\n`;
    }

    if (thread.relatedLocations && thread.relatedLocations.length > 0) {
      context += `  Related Locations: ${thread.relatedLocations.join(', ')}\n`;
    }

    if (thread.potentialOutcomes && thread.potentialOutcomes.length > 0) {
      context += `  Possible developments: ${thread.potentialOutcomes.join('; ')}\n`;
    }

    context += '\n';
  }

  context += `When appropriate, weave these threads into the narrative. They represent ongoing consequences from the party's actions.\n`;

  return context;
}

/**
 * Extract story threads from adventure narrative using pattern matching
 * This is a fallback when the LLM doesn't generate explicit threads
 */
export function extractThreadsFromNarrative(narrative, adventureTitle, success) {
  const threads = [];

  // Common patterns that suggest story hooks
  const patterns = [
    { regex: /(?:now knows?|discover(?:ed)?|learn(?:ed)?|found out).{0,100}(?:about|that|who|where)/i, type: 'intel' },
    { regex: /(?:enemy|foe|rival|antagonist|threat).{0,50}(?:escaped|fled|survived|vowed)/i, type: 'new_enemy' },
    { regex: /(?:ally|friend|contact|informant).{0,50}(?:made|gained|met|recruited)/i, type: 'new_ally' },
    { regex: /(?:reputation|standing|fame|infamy).{0,50}(?:grew|spread|increased|decreased)/i, type: 'reputation' },
    { regex: /(?:mysterious|strange|unexplained|curious).{0,100}(?:event|occurrence|phenomenon)/i, type: 'mystery' },
    { regex: /(?:opportunity|chance|opening).{0,50}(?:arose|presented|appeared)/i, type: 'opportunity' },
    { regex: /(?:threat|danger|warning).{0,50}(?:looms?|approaches?|grows?)/i, type: 'threat' }
  ];

  for (const pattern of patterns) {
    const match = narrative.match(pattern.regex);
    if (match) {
      threads.push({
        type: pattern.type,
        excerpt: match[0]
      });
    }
  }

  return threads;
}

/**
 * Create story threads from adventure completion
 * Called when an adventure finishes to generate persistent consequences
 */
export async function createThreadsFromAdventure(adventure, results, character) {
  const threads = [];
  const narrative = results.narrative || '';

  // Determine quest relevance based on adventure context
  let questRelevance = adventure.quest_relevance || 'side_quest';

  // If the adventure title/description mentions the quest, upgrade relevance
  if (character.current_quest) {
    const questWords = character.current_quest.toLowerCase().split(/\s+/);
    const adventureText = `${adventure.title} ${adventure.description}`.toLowerCase();

    const relevantWords = questWords.filter(w =>
      w.length > 3 && adventureText.includes(w)
    );

    if (relevantWords.length >= 2) {
      questRelevance = 'quest_advancing';
    } else if (relevantWords.length >= 1) {
      questRelevance = 'quest_adjacent';
    }
  }

  // Generate categorized story consequences
  const storyConsequences = generateStoryConsequences(adventure, results.success, questRelevance);

  // Create story threads for each consequence
  for (const consequence of storyConsequences) {
    const threadType = consequence.category;
    const typeInfo = THREAD_TYPES[threadType] || THREAD_TYPES.intel;

    // Build thread title based on category
    const titlePrefixes = {
      new_enemy: 'New Threat',
      new_ally: 'Potential Ally',
      intel: 'Discovery',
      reputation: 'Reputation Change',
      resource: 'Opportunity'
    };
    const titlePrefix = titlePrefixes[consequence.category] || 'Consequence';

    // Build description based on category and success
    let description = '';
    if (results.success) {
      const successDescriptions = {
        new_enemy: `Your success at "${adventure.title}" has drawn unwanted attention. Someone now views you as a threat or obstacle.`,
        new_ally: `Your actions during "${adventure.title}" impressed someone. A potential ally has taken notice of your capabilities.`,
        intel: `You've uncovered valuable information during "${adventure.title}". ${narrative.substring(0, 150)}...`,
        reputation: `Word of your deeds at "${adventure.title}" is spreading. Your reputation in the area has grown.`,
        resource: `Your success at "${adventure.title}" has opened new opportunities. You now have access to resources or contacts you didn't before.`
      };
      description = successDescriptions[consequence.category] || consequence.description;
    } else {
      const failureDescriptions = {
        new_enemy: `Your failed attempt at "${adventure.title}" has made enemies. They know you were involved and won't forget.`,
        new_ally: `Despite failing "${adventure.title}", someone was impressed by your courage and approach.`,
        intel: `Even in failure, you learned something from "${adventure.title}". ${narrative.substring(0, 150)}...`,
        reputation: `News of your failure at "${adventure.title}" is spreading. Your reputation has taken a hit.`,
        resource: `Though you failed, your attempt at "${adventure.title}" revealed an opportunity you hadn't considered.`
      };
      description = failureDescriptions[consequence.category] || consequence.description;
    }

    // Generate potential outcomes based on category
    const potentialOutcomesByCategory = {
      new_enemy: [
        'They may seek revenge or sabotage your future efforts',
        'They could warn others about your activities',
        'A confrontation may be inevitable'
      ],
      new_ally: [
        'They may offer assistance in future endeavors',
        'They could provide information or resources',
        'A lasting partnership could form'
      ],
      intel: [
        'This knowledge could be leveraged in negotiations',
        'It may reveal weaknesses in your enemies',
        'Others might pay well for this information'
      ],
      reputation: [
        'NPCs may treat you differently based on what they\'ve heard',
        'New opportunities or obstacles may arise',
        'Factions may take notice of your growing influence'
      ],
      resource: [
        'New markets or suppliers may become available',
        'Shortcuts or safe passages may open up',
        'Financial opportunities could present themselves'
      ]
    };

    const threadData = {
      sourceType: 'adventure',
      sourceId: adventure.id,
      threadType,
      title: `${titlePrefix}: ${adventure.title}`,
      description,
      questRelevance,
      consequenceCategory: consequence.category,
      canResolveQuest: consequence.canResolveQuest || false,
      priority: consequence.canResolveQuest ? 'high' : (questRelevance === 'quest_advancing' ? 'high' : 'normal'),
      relatedLocations: [adventure.location],
      potentialOutcomes: potentialOutcomesByCategory[consequence.category] || ['Unknown consequences await']
    };

    const thread = await createStoryThread(character.id, threadData);
    threads.push(thread);
  }

  // If no story consequences were generated but there's a narrative, create a basic thread
  if (threads.length === 0 && narrative.length > 100) {
    const threadData = {
      sourceType: 'adventure',
      sourceId: adventure.id,
      threadType: results.success ? 'intel' : 'threat',
      title: `${adventure.title} - Aftermath`,
      description: narrative.length > 200 ? narrative.substring(0, 200) + '...' : narrative,
      questRelevance,
      consequenceCategory: results.success ? 'intel' : 'new_enemy',
      relatedLocations: [adventure.location],
      potentialOutcomes: results.success
        ? ['This experience may prove useful', 'Your reputation has been affected']
        : ['Enemies may be aware of your interest', 'The situation could worsen']
    };

    const thread = await createStoryThread(character.id, threadData);
    threads.push(thread);
  }

  return threads;
}

export default {
  THREAD_TYPES,
  QUEST_RELEVANCE,
  createStoryThread,
  getActiveThreads,
  getQuestResolvingThreads,
  resolveThread,
  formatThreadsForAI,
  extractThreadsFromNarrative,
  createThreadsFromAdventure
};
