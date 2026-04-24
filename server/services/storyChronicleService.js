/**
 * Story Chronicle Service — Canon Memory & Context Management
 *
 * Provides structured, queryable story memory for DM sessions.
 * Stores everything forever on disk, retrieves only what's relevant
 * for the AI context window each session.
 *
 * Core functions:
 * - generateSessionChronicle() — Extract structured chronicle at session end
 * - getRelevantContext() — Retrieve priority-ordered canon facts for AI prompt
 * - recordCanonFact() — Store individual canonical facts
 * - searchFacts() — Text search across canon facts
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { chat } from './claude.js';
import { estimateTokens } from '../utils/contextManager.js';
import { tryExtractLLMJson } from '../utils/llmJson.js';
import { saveNpcConversation, recordInteraction } from './npcRelationshipService.js';
import { setMood } from './companionBackstoryService.js';
import { propagateNpcDeath } from './npcLifecycleService.js';

// ============================================================
// CHRONICLE GENERATION (Session End)
// ============================================================

/**
 * Generate a structured chronicle from a completed session.
 * Called at session end after existing memory extraction.
 *
 * @param {number} sessionId - The DM session ID
 * @returns {object} The generated chronicle record
 */
export async function generateSessionChronicle(sessionId) {
  // Fetch session data
  const session = await dbGet(
    'SELECT id, character_id, campaign_id, messages, summary, game_day, created_at FROM dm_sessions WHERE id = ?',
    [sessionId]
  );

  if (!session) {
    console.error(`[Chronicle] Session ${sessionId} not found`);
    return null;
  }

  // Check if chronicle already exists
  const existing = await dbGet('SELECT id FROM story_chronicles WHERE session_id = ?', [sessionId]);
  if (existing) {
    console.log(`[Chronicle] Chronicle already exists for session ${sessionId}`);
    return existing;
  }

  let messages;
  try {
    messages = JSON.parse(session.messages || '[]');
  } catch (e) {
    console.error(`[Chronicle] Failed to parse messages for session ${sessionId}`);
    return null;
  }

  // Filter to conversation only (no system messages)
  const conversation = messages.filter(m => m.role !== 'system');
  if (conversation.length < 2) {
    console.log(`[Chronicle] Session ${sessionId} too short for chronicle`);
    return null;
  }

  // Build transcript for AI analysis
  const transcript = conversation
    .map(m => `${m.role === 'user' ? 'PLAYER' : 'DM'}: ${m.content}`)
    .join('\n\n');

  // Truncate very long transcripts
  let input = transcript;
  if (input.length > 40000) {
    const third = 13000;
    input = input.substring(0, third) +
      '\n\n[...middle portion condensed...]\n\n' +
      input.substring(input.length - third * 2);
  }

  // Calculate session number for this campaign
  const sessionCount = await dbGet(
    'SELECT COUNT(*) as count FROM story_chronicles WHERE campaign_id = ? AND character_id = ?',
    [session.campaign_id, session.character_id]
  );
  const sessionNumber = (sessionCount?.count || 0) + 1;

  // Ask AI to extract structured chronicle
  const chroniclePrompt = `You are analyzing a completed D&D session transcript. Extract a structured chronicle.

Respond in EXACTLY this JSON format (no markdown, no code fences):
{
  "summary": "300-500 word narrative recap of what happened",
  "key_decisions": [
    {"decision": "what the player chose", "context": "why it mattered", "consequence": "what happened as a result"}
  ],
  "npcs_involved": [
    {"name": "NPC name", "role": "what they did in this session"}
  ],
  "locations_visited": [
    {"name": "location name", "events": "what happened there"}
  ],
  "quests_progressed": [
    {"name": "quest name", "change": "what progress was made"}
  ],
  "combat_encounters": [
    {"enemies": "who was fought", "outcome": "win/loss/fled/avoided", "casualties": "any deaths"}
  ],
  "items_gained": ["item1", "item2"],
  "items_lost": ["item1"],
  "gold_change": 0,
  "player_death": false,
  "companion_deaths": [],
  "mood": "one word: tense/triumphant/tragic/mysterious/peaceful/chaotic/desperate/hopeful",
  "cliffhanger": "what was left unresolved, or null",
  "canon_facts": [
    {"category": "npc|location|quest|item|event|lore|player_choice|death|promise|secret", "subject": "the thing this fact is about", "fact": "the canonical fact", "importance": "critical|major|minor|flavor"}
  ],
  "npc_conversations": [
    {"npc_name": "exact NPC name as it appears in dialogue", "summary": "1-3 sentence summary of what was discussed", "topics": ["topic1", "topic2"], "tone": "friendly|tense|hostile|transactional|emotional|secretive", "key_quotes": ["one memorable quote if any"], "information_exchanged": "what info was learned or shared, or null"}
  ],
  "companion_mood_changes": [
    {"companion_name": "exact companion name", "new_mood": "content|anxious|angry|sad|fearful|excited|conflicted|grateful|resentful|exhausted", "cause": "what triggered this mood change", "intensity": 3}
  ],
  "npc_deaths": [
    {"npc_name": "exact NPC name", "cause": "how they died", "killer": "who or what killed them, or null", "location": "where they died, or null"}
  ]
}

Guidelines for canon_facts:
- Extract 5-15 individual facts from this session
- Deaths are ALWAYS "critical" importance
- Promises/debts are ALWAYS "major" importance
- New NPC introductions are "major", routine interactions are "minor"
- Key player decisions that affect the story are "major"
- World-building flavor details are "flavor"
- Be specific: "Lord Varen was killed by the party" not "someone died"

Guidelines for npc_conversations:
- Include EVERY NPC the player had a meaningful dialogue exchange with (not just passing mentions)
- The summary should capture WHAT was discussed, not just "they talked"
- Topics should be specific: "stolen heirloom", "bandit attacks", "quest reward" — not generic labels
- Key quotes: Include at most 1-2 memorable or important lines said by the NPC (exact words from the transcript)
- Tone reflects the overall feel of the conversation
- If no meaningful NPC conversations occurred, return an empty array

Guidelines for companion_mood_changes:
- Only include companions whose emotional state meaningfully changed during this session
- Intensity: 1=mild, 2=noticeable, 3=significant, 4=strong, 5=overwhelming
- Common triggers: near-death experience (fearful/anxious), betrayal (angry/resentful), loss (sad), victory (excited/grateful), moral dilemma (conflicted), exhausting journey (exhausted)
- If no companion mood changes occurred, return an empty array

Guidelines for npc_deaths:
- Include ANY named NPC who died or was killed during this session
- Include deaths caused by the player, by other NPCs, by environmental hazards, by monsters, etc.
- Include deaths that were reported/discovered (e.g., "You learn that the merchant was murdered") even if not witnessed directly
- Use exact NPC names as they appear in the transcript
- If no NPCs died, return an empty array`;

  try {
    const response = await chat(
      chroniclePrompt,
      [{ role: 'user', content: input }],
      2,
      'sonnet',
      4000,
      true // raw response for JSON
    );

    const chronicle = tryExtractLLMJson(response);
    if (!chronicle) {
      console.error('[Chronicle] Failed to extract JSON from AI response');
      console.error('[Chronicle] Raw response (first 500 chars):', response.substring(0, 500));
      return null;
    }

    // Store the chronicle
    const result = await dbRun(`
      INSERT INTO story_chronicles (
        campaign_id, character_id, session_id, session_number,
        game_day_start, game_day_end,
        summary, key_decisions, npcs_involved, locations_visited,
        quests_progressed, combat_encounters, items_gained, items_lost,
        gold_change, player_death, companion_deaths, mood, cliffhanger
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      session.campaign_id,
      session.character_id,
      sessionId,
      sessionNumber,
      session.game_day || null,
      session.game_day || null,
      chronicle.summary || '',
      JSON.stringify(chronicle.key_decisions || []),
      JSON.stringify(chronicle.npcs_involved || []),
      JSON.stringify(chronicle.locations_visited || []),
      JSON.stringify(chronicle.quests_progressed || []),
      JSON.stringify(chronicle.combat_encounters || []),
      JSON.stringify(chronicle.items_gained || []),
      JSON.stringify(chronicle.items_lost || []),
      chronicle.gold_change || 0,
      chronicle.player_death ? 1 : 0,
      JSON.stringify(chronicle.companion_deaths || []),
      chronicle.mood || 'neutral',
      chronicle.cliffhanger || null
    ]);

    const chronicleId = Number(result.lastInsertRowid);

    // Extract and store individual canon facts
    if (chronicle.canon_facts && Array.isArray(chronicle.canon_facts)) {
      for (const fact of chronicle.canon_facts) {
        await recordCanonFact(
          session.campaign_id,
          session.character_id,
          fact.category || 'event',
          fact.subject || 'Unknown',
          fact.fact || '',
          sessionId,
          session.game_day || null,
          fact.importance || 'minor'
        );
      }
    }

    // Extract and store NPC conversation summaries
    let conversationsSaved = 0;
    if (chronicle.npc_conversations && Array.isArray(chronicle.npc_conversations)) {
      for (const conv of chronicle.npc_conversations) {
        if (!conv.npc_name || !conv.summary) continue;

        // Match NPC name to npcs table
        const npc = await dbGet('SELECT id FROM npcs WHERE name = ?', [conv.npc_name]);
        if (!npc) continue;

        try {
          await saveNpcConversation(
            session.character_id,
            npc.id,
            sessionId,
            session.game_day || null,
            {
              summary: conv.summary,
              topics: conv.topics || [],
              tone: conv.tone || null,
              key_quotes: conv.key_quotes || [],
              information_exchanged: conv.information_exchanged || null,
              importance: conv.importance || 'minor'
            }
          );
          // Update last_interaction_game_day for NPC aging system
          await recordInteraction(session.character_id, npc.id, null, session.game_day || null);
          conversationsSaved++;
        } catch (e) {
          console.error(`[Chronicle] Failed to save conversation with ${conv.npc_name}:`, e.message);
        }
      }
    }

    // Extract and apply companion mood changes
    let moodChanges = 0;
    if (chronicle.companion_mood_changes && Array.isArray(chronicle.companion_mood_changes)) {
      for (const moodChange of chronicle.companion_mood_changes) {
        if (!moodChange.companion_name || !moodChange.new_mood) continue;

        // Match companion name to active companions
        const companion = await dbGet(`
          SELECT c.id FROM companions c
          JOIN npcs n ON c.npc_id = n.id
          WHERE n.name = ? AND c.recruited_by_character_id = ? AND c.status = 'active'
        `, [moodChange.companion_name, session.character_id]);

        if (!companion) continue;

        try {
          await setMood(
            companion.id,
            moodChange.new_mood,
            moodChange.cause || null,
            moodChange.intensity || 3,
            session.game_day || null
          );
          moodChanges++;
        } catch (e) {
          console.error(`[Chronicle] Failed to set mood for ${moodChange.companion_name}:`, e.message);
        }
      }
    }

    // Extract and propagate NPC deaths
    let deathsPropagated = 0;
    if (chronicle.npc_deaths && Array.isArray(chronicle.npc_deaths)) {
      for (const death of chronicle.npc_deaths) {
        if (!death.npc_name) continue;

        const npc = await dbGet('SELECT id, lifecycle_status FROM npcs WHERE name = ?', [death.npc_name]);
        if (!npc || npc.lifecycle_status === 'deceased') continue;

        try {
          await propagateNpcDeath(npc.id, session.campaign_id, session.character_id, {
            cause: death.cause || 'Died during session',
            gameDay: session.game_day || null,
            location: death.location || null,
            killer: death.killer || null,
            sessionId
          });
          deathsPropagated++;
        } catch (e) {
          console.error(`[Chronicle] Failed to propagate death for ${death.npc_name}:`, e.message);
        }
      }
    }

    console.log(`[Chronicle] Generated chronicle #${sessionNumber} for session ${sessionId}: ${chronicle.canon_facts?.length || 0} facts, ${conversationsSaved} conversations, ${moodChanges} mood changes, ${deathsPropagated} deaths`);
    return { id: chronicleId, sessionNumber, factsExtracted: chronicle.canon_facts?.length || 0, conversationsSaved, moodChanges, deathsPropagated };

  } catch (error) {
    console.error('[Chronicle] Failed to generate chronicle:', error.message);
    return null;
  }
}

// ============================================================
// CANON FACT MANAGEMENT
// ============================================================

/**
 * Record a single canonical fact. Auto-supersedes conflicting older facts
 * on the same subject within the same category.
 */
export async function recordCanonFact(campaignId, characterId, category, subject, fact, sessionId, gameDay, importance) {
  if (!fact || fact.trim().length === 0) return null;

  // Check for existing active facts about the same subject in the same category
  // that might be superseded by this new fact
  if (category === 'death' || category === 'npc' || category === 'location') {
    const existingFacts = await dbAll(
      'SELECT id, fact FROM canon_facts WHERE campaign_id = ? AND character_id = ? AND subject = ? AND category = ? AND is_active = 1',
      [campaignId, characterId, subject, category]
    );

    // For death facts, supersede any "alive" facts about the same subject
    if (category === 'death') {
      const aliveFactIds = await dbAll(
        'SELECT id FROM canon_facts WHERE campaign_id = ? AND character_id = ? AND subject = ? AND category = "npc" AND is_active = 1 AND fact LIKE "%alive%"',
        [campaignId, characterId, subject]
      );
      for (const aliveFact of aliveFactIds) {
        await dbRun('UPDATE canon_facts SET is_active = 0 WHERE id = ?', [aliveFact.id]);
      }
    }

    // For contradictory facts on the same subject+category, supersede old ones
    if (existingFacts.length > 0) {
      // Don't supersede if the fact is essentially the same
      const isDuplicate = existingFacts.some(ef =>
        ef.fact.toLowerCase().trim() === fact.toLowerCase().trim()
      );
      if (isDuplicate) return null;
    }
  }

  // Build tags from category and importance
  const tags = [category, importance].filter(Boolean).join(',');

  const result = await dbRun(`
    INSERT INTO canon_facts (
      campaign_id, character_id, category, subject, fact,
      source_session_id, game_day, is_active, tags, importance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `, [
    campaignId, characterId, category, subject, fact,
    sessionId, gameDay, tags, importance
  ]);

  return Number(result.lastInsertRowid);
}

/**
 * Manually supersede a fact (mark old as inactive, optionally link to new)
 */
export async function supersedeFact(factId, newFactId = null) {
  await dbRun(
    'UPDATE canon_facts SET is_active = 0, superseded_by = ? WHERE id = ?',
    [newFactId, factId]
  );
}

// ============================================================
// CONTEXT RETRIEVAL (Session Start)
// ============================================================

/**
 * Get relevant canon facts for AI context, filling a token budget
 * in priority order.
 *
 * Priority (highest first):
 * 1. Deaths — always included
 * 2. Active promises/debts — always included
 * 3. Critical importance facts — always included
 * 4. Facts about NPCs in current location — high priority
 * 5. Active quest facts — high priority
 * 6. Recent facts (last 3 sessions) — medium priority
 * 7. Major importance facts — fill remaining budget
 * 8. Location-specific facts — fill remaining budget
 * 9. Minor/flavor facts — only if budget allows
 *
 * @param {number} characterId
 * @param {number} campaignId
 * @param {object} hints - { location, npcs, quests } for relevance filtering
 * @param {number} tokenBudget - Max tokens for chronicle context (2000-8000)
 * @returns {{ context: string, factsIncluded: number, totalFacts: number }}
 */
export async function getRelevantContext(characterId, campaignId, hints = {}, tokenBudget = 4000) {
  const sections = [];
  let tokensUsed = 0;
  let factsIncluded = 0;

  // Helper to add facts to a section if budget allows
  const addFacts = (facts, sectionName) => {
    if (!facts || facts.length === 0) return;
    const lines = [];
    for (const fact of facts) {
      const line = `- [Session ${fact.session_number || '?'}, Day ${fact.game_day || '?'}] ${fact.fact}`;
      const lineTokens = estimateTokens(line);
      if (tokensUsed + lineTokens > tokenBudget) break;
      lines.push(line);
      tokensUsed += lineTokens;
      factsIncluded++;
    }
    if (lines.length > 0) {
      sections.push({ name: sectionName, lines });
    }
  };

  // Get ALL session IDs for "recent facts" priority (no artificial limit)
  const recentSessions = await dbAll(
    'SELECT session_id FROM story_chronicles WHERE campaign_id = ? AND character_id = ? ORDER BY session_number DESC',
    [campaignId, characterId]
  );
  const recentSessionIds = recentSessions.map(s => s.session_id);

  // 1. Deaths — ALWAYS included
  const deaths = await dbAll(
    `SELECT cf.*, sc.session_number FROM canon_facts cf
     LEFT JOIN story_chronicles sc ON cf.source_session_id = sc.session_id
     WHERE cf.campaign_id = ? AND cf.character_id = ? AND cf.category = 'death' AND cf.is_active = 1
     ORDER BY cf.game_day DESC`,
    [campaignId, characterId]
  );
  addFacts(deaths, 'DEATHS (DO NOT RESURRECT WITHOUT EXPLICIT MAGIC)');

  // 2. Active promises/debts — ALWAYS included
  const promises = await dbAll(
    `SELECT cf.*, sc.session_number FROM canon_facts cf
     LEFT JOIN story_chronicles sc ON cf.source_session_id = sc.session_id
     WHERE cf.campaign_id = ? AND cf.character_id = ? AND cf.category = 'promise' AND cf.is_active = 1
     ORDER BY cf.game_day DESC`,
    [campaignId, characterId]
  );
  addFacts(promises, 'ACTIVE PROMISES & DEBTS');

  // 3. Critical importance facts — ALWAYS included
  const critical = await dbAll(
    `SELECT cf.*, sc.session_number FROM canon_facts cf
     LEFT JOIN story_chronicles sc ON cf.source_session_id = sc.session_id
     WHERE cf.campaign_id = ? AND cf.character_id = ? AND cf.importance = 'critical' AND cf.is_active = 1
     AND cf.category NOT IN ('death', 'promise')
     ORDER BY cf.game_day DESC`,
    [campaignId, characterId]
  );
  addFacts(critical, 'CRITICAL FACTS');

  // 4. NPC context for current location (if hints provided)
  if (hints.location || (hints.npcs && hints.npcs.length > 0)) {
    const npcNames = hints.npcs || [];
    const locationName = hints.location || '';

    let npcFacts = [];
    if (npcNames.length > 0) {
      const placeholders = npcNames.map(() => '?').join(',');
      npcFacts = await dbAll(
        `SELECT cf.*, sc.session_number FROM canon_facts cf
         LEFT JOIN story_chronicles sc ON cf.source_session_id = sc.session_id
         WHERE cf.campaign_id = ? AND cf.character_id = ? AND cf.is_active = 1
         AND cf.subject IN (${placeholders})
         ORDER BY cf.importance = 'critical' DESC, cf.importance = 'major' DESC, cf.game_day DESC`,
        [campaignId, characterId, ...npcNames]
      );
    }
    if (locationName) {
      const locationFacts = await dbAll(
        `SELECT cf.*, sc.session_number FROM canon_facts cf
         LEFT JOIN story_chronicles sc ON cf.source_session_id = sc.session_id
         WHERE cf.campaign_id = ? AND cf.character_id = ? AND cf.is_active = 1
         AND cf.subject LIKE ?
         ORDER BY cf.game_day DESC`,
        [campaignId, characterId, `%${locationName}%`]
      );
      npcFacts = [...npcFacts, ...locationFacts];
    }
    addFacts(npcFacts, 'NPC & LOCATION CONTEXT');
  }

  // 5. Active quest facts
  const questFacts = await dbAll(
    `SELECT cf.*, sc.session_number FROM canon_facts cf
     LEFT JOIN story_chronicles sc ON cf.source_session_id = sc.session_id
     WHERE cf.campaign_id = ? AND cf.character_id = ? AND cf.category = 'quest' AND cf.is_active = 1
     ORDER BY cf.importance = 'critical' DESC, cf.importance = 'major' DESC, cf.game_day DESC`,
    [campaignId, characterId]
  );
  addFacts(questFacts, 'QUEST PROGRESS');

  // 6. Recent facts (last 3 sessions)
  if (recentSessionIds.length > 0) {
    const placeholders = recentSessionIds.map(() => '?').join(',');
    const recentFacts = await dbAll(
      `SELECT cf.*, sc.session_number FROM canon_facts cf
       LEFT JOIN story_chronicles sc ON cf.source_session_id = sc.session_id
       WHERE cf.campaign_id = ? AND cf.character_id = ? AND cf.is_active = 1
       AND cf.source_session_id IN (${placeholders})
       AND cf.category NOT IN ('death', 'promise')
       AND cf.importance != 'critical'
       ORDER BY cf.game_day DESC, cf.id DESC`,
      [campaignId, characterId, ...recentSessionIds]
    );
    addFacts(recentFacts, 'RECENT EVENTS');
  }

  // 7. Major importance facts (fill remaining)
  if (tokensUsed < tokenBudget * 0.95) {
    const majorFacts = await dbAll(
      `SELECT cf.*, sc.session_number FROM canon_facts cf
       LEFT JOIN story_chronicles sc ON cf.source_session_id = sc.session_id
       WHERE cf.campaign_id = ? AND cf.character_id = ? AND cf.importance = 'major' AND cf.is_active = 1
       AND cf.category NOT IN ('death', 'promise')
       ORDER BY cf.game_day DESC`,
      [campaignId, characterId]
    );
    addFacts(majorFacts, 'MAJOR STORY EVENTS');
  }

  // 8. Location-specific facts (fill remaining)
  if (tokensUsed < tokenBudget * 0.98) {
    const locationFacts = await dbAll(
      `SELECT cf.*, sc.session_number FROM canon_facts cf
       LEFT JOIN story_chronicles sc ON cf.source_session_id = sc.session_id
       WHERE cf.campaign_id = ? AND cf.character_id = ? AND cf.category = 'location' AND cf.is_active = 1
       ORDER BY cf.game_day DESC`,
      [campaignId, characterId]
    );
    addFacts(locationFacts, 'KNOWN LOCATIONS');
  }

  // 9. Minor/flavor facts (fill remaining budget)
  if (tokensUsed < tokenBudget * 0.9) {
    const flavorFacts = await dbAll(
      `SELECT cf.*, sc.session_number FROM canon_facts cf
       LEFT JOIN story_chronicles sc ON cf.source_session_id = sc.session_id
       WHERE cf.campaign_id = ? AND cf.character_id = ? AND cf.importance IN ('minor', 'flavor') AND cf.is_active = 1
       AND cf.category NOT IN ('death', 'promise')
       ORDER BY cf.game_day DESC`,
      [campaignId, characterId]
    );
    addFacts(flavorFacts, 'WORLD DETAILS');
  }

  // Get total facts count for stats
  const totalFactsRow = await dbGet(
    'SELECT COUNT(*) as count FROM canon_facts WHERE campaign_id = ? AND character_id = ? AND is_active = 1',
    [campaignId, characterId]
  );

  // Build formatted context string
  if (sections.length === 0) {
    return { context: '', factsIncluded: 0, totalFacts: totalFactsRow?.count || 0 };
  }

  let context = '=== STORY CHRONICLE (Canon Facts — DO NOT CONTRADICT) ===\n\n';
  for (const section of sections) {
    context += `${section.name}:\n`;
    context += section.lines.join('\n') + '\n\n';
  }

  return {
    context: context.trim(),
    factsIncluded,
    totalFacts: totalFactsRow?.count || 0
  };
}

// ============================================================
// QUERY & SEARCH
// ============================================================

/**
 * Get ALL session chronicle summaries for injection into DM prompt.
 * These are richer (300-500 word AI-generated recaps) than dm_sessions.summary.
 */
export async function getSessionSummariesForPrompt(campaignId, characterId) {
  return await dbAll(
    `SELECT session_number, summary, mood, cliffhanger, key_decisions,
            game_day_start, game_day_end
     FROM story_chronicles
     WHERE campaign_id = ? AND character_id = ?
     ORDER BY session_number ASC`,
    [campaignId, characterId]
  );
}

/**
 * Get all session chronicles for a campaign
 */
export async function getChroniclesForCampaign(campaignId) {
  return await dbAll(
    `SELECT sc.*, ds.created_at as session_date
     FROM story_chronicles sc
     LEFT JOIN dm_sessions ds ON sc.session_id = ds.id
     WHERE sc.campaign_id = ?
     ORDER BY sc.session_number DESC`,
    [campaignId]
  );
}

/**
 * Get chronological timeline of canon facts for a character
 */
export async function getTimelineForCharacter(characterId, campaignId, filters = {}) {
  let sql = `
    SELECT cf.*, sc.session_number
    FROM canon_facts cf
    LEFT JOIN story_chronicles sc ON cf.source_session_id = sc.session_id
    WHERE cf.campaign_id = ? AND cf.character_id = ?
  `;
  const params = [campaignId, characterId];

  if (filters.category) {
    sql += ' AND cf.category = ?';
    params.push(filters.category);
  }
  if (filters.importance) {
    sql += ' AND cf.importance = ?';
    params.push(filters.importance);
  }
  if (filters.activeOnly !== false) {
    sql += ' AND cf.is_active = 1';
  }
  if (filters.sessionId) {
    sql += ' AND cf.source_session_id = ?';
    params.push(filters.sessionId);
  }

  sql += ' ORDER BY cf.game_day ASC, cf.id ASC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  return await dbAll(sql, params);
}

/**
 * Text search across canon facts
 */
export async function searchFacts(campaignId, query) {
  return await dbAll(
    `SELECT cf.*, sc.session_number
     FROM canon_facts cf
     LEFT JOIN story_chronicles sc ON cf.source_session_id = sc.session_id
     WHERE cf.campaign_id = ? AND cf.is_active = 1
     AND (cf.fact LIKE ? OR cf.subject LIKE ? OR cf.tags LIKE ?)
     ORDER BY cf.importance = 'critical' DESC, cf.importance = 'major' DESC, cf.game_day DESC
     LIMIT 50`,
    [campaignId, `%${query}%`, `%${query}%`, `%${query}%`]
  );
}

/**
 * Get chronicle stats for a campaign (for dashboard)
 */
export async function getChronicleStats(campaignId, characterId) {
  const totalFacts = await dbGet(
    'SELECT COUNT(*) as count FROM canon_facts WHERE campaign_id = ? AND character_id = ? AND is_active = 1',
    [campaignId, characterId]
  );

  const totalChronicles = await dbGet(
    'SELECT COUNT(*) as count FROM story_chronicles WHERE campaign_id = ? AND character_id = ?',
    [campaignId, characterId]
  );

  const activePromises = await dbAll(
    `SELECT subject, fact FROM canon_facts
     WHERE campaign_id = ? AND character_id = ? AND category = 'promise' AND is_active = 1
     ORDER BY game_day DESC`,
    [campaignId, characterId]
  );

  const latestChronicle = await dbGet(
    `SELECT summary, cliffhanger, mood, session_number
     FROM story_chronicles
     WHERE campaign_id = ? AND character_id = ?
     ORDER BY session_number DESC LIMIT 1`,
    [campaignId, characterId]
  );

  const deaths = await dbAll(
    `SELECT subject, fact FROM canon_facts
     WHERE campaign_id = ? AND character_id = ? AND category = 'death' AND is_active = 1
     ORDER BY game_day DESC`,
    [campaignId, characterId]
  );

  return {
    totalFacts: totalFacts?.count || 0,
    totalChronicles: totalChronicles?.count || 0,
    activePromises,
    latestChronicle,
    deaths
  };
}

export default {
  generateSessionChronicle,
  recordCanonFact,
  supersedeFact,
  getRelevantContext,
  getChroniclesForCampaign,
  getTimelineForCharacter,
  searchFacts,
  getChronicleStats
};
