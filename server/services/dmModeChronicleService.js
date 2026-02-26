/**
 * DM Mode Chronicle Service
 *
 * Extracts structured memory from completed DM Mode sessions:
 * NPCs, locations, plot threads, decisions, character moments.
 * All chronicles are injected into the next session's system prompt
 * so the AI remembers the full campaign history.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { chat } from './claude.js';

const CHRONICLE_PROMPT = `You are analyzing a completed D&D session transcript. The USER was the Dungeon Master and the AI played 4 player characters. In the transcript, "DM" lines are the human Dungeon Master's narration and world description. "PARTY" lines are the AI characters' dialogue and actions.

Extract a structured chronicle from this session.

Respond in EXACTLY this JSON format (no markdown, no code fences):
{
  "summary": "300-500 word narrative recap of what happened this session",
  "key_decisions": [
    {"decision": "what was decided", "who_decided": "character name or 'the party'", "context": "why it mattered", "consequence": "what happened as a result"}
  ],
  "npcs_involved": [
    {"name": "NPC name", "role": "their role in this session", "description": "brief physical or personality description if first appearance, or null"}
  ],
  "locations_visited": [
    {"name": "location name", "events": "what happened there"}
  ],
  "plot_threads": [
    {"thread": "plot thread name", "status": "new|ongoing|resolved", "details": "current state of this thread"}
  ],
  "combat_encounters": [
    {"enemies": "who was fought", "outcome": "win/loss/fled/avoided", "notable_moments": "any standout character actions"}
  ],
  "items_gained": ["item1", "item2"],
  "character_moments": [
    {"character": "character name", "moment": "what happened", "development_type": "growth|conflict|revelation|bonding|setback"}
  ],
  "mood": "one word: tense/triumphant/tragic/mysterious/peaceful/chaotic/desperate/hopeful",
  "cliffhanger": "what was left unresolved at session end, or null"
}

Guidelines:
- npcs_involved: ONLY include NPCs controlled by the DM — NOT the 4 player characters. Include every named NPC who appeared, spoke, or was mentioned significantly.
- plot_threads: "new" = introduced this session, "ongoing" = was already active and continued, "resolved" = concluded this session. Extract 0-5 threads focusing on named storylines, not individual actions.
- key_decisions: Note WHICH character(s) drove the decision. Include 2-5 major choices.
- character_moments: Track moments where individual party members showed growth, revealed something about themselves, clashed with others, or had a significant personal moment. Include 1-4 moments.
- items_gained: Only include significant or named items, not routine supplies.
- summary: Write a narrative recap that captures the story arc of this session. Include NPC names, location names, and specific events.
- Be specific with names: "Tormund the blacksmith" not "a blacksmith", "the Crimson Mines" not "a mine".`;

/**
 * Generate a structured chronicle from a completed DM Mode session.
 * Non-blocking — failures are logged, not thrown to callers.
 *
 * @param {number} sessionId - The dm_sessions ID
 * @param {number} partyId - The dm_mode_parties ID
 * @returns {object|null} The generated chronicle record, or null on failure
 */
export async function generateDMModeChronicle(sessionId, partyId) {
  // Fetch session data
  const session = await dbGet(
    'SELECT id, messages, dm_mode_party_id FROM dm_sessions WHERE id = ?',
    [sessionId]
  );

  if (!session) {
    console.error(`[DM Chronicle] Session ${sessionId} not found`);
    return null;
  }

  // Idempotency guard
  const existing = await dbGet('SELECT id FROM dm_mode_chronicles WHERE session_id = ?', [sessionId]);
  if (existing) {
    console.log(`[DM Chronicle] Chronicle already exists for session ${sessionId}`);
    return existing;
  }

  let messages;
  try {
    messages = JSON.parse(session.messages || '[]');
  } catch (e) {
    console.error(`[DM Chronicle] Failed to parse messages for session ${sessionId}`);
    return null;
  }

  // Filter to conversation only (no system messages)
  const conversation = messages.filter(m => m.role !== 'system');
  if (conversation.length < 2) {
    console.log(`[DM Chronicle] Session ${sessionId} too short for chronicle`);
    return null;
  }

  // Build transcript — in DM Mode, user=DM and assistant=Party
  const transcript = conversation
    .map(m => `${m.role === 'user' ? 'DM' : 'PARTY'}: ${m.content}`)
    .join('\n\n');

  // Truncate very long transcripts
  let input = transcript;
  if (input.length > 40000) {
    const third = 13000;
    input = input.substring(0, third) +
      '\n\n[...middle portion condensed...]\n\n' +
      input.substring(input.length - third * 2);
  }

  // Calculate session number for this party
  const sessionCount = await dbGet(
    'SELECT COUNT(*) as count FROM dm_mode_chronicles WHERE dm_mode_party_id = ?',
    [partyId]
  );
  const sessionNumber = (sessionCount?.count || 0) + 1;

  try {
    const response = await chat(
      CHRONICLE_PROMPT,
      [{ role: 'user', content: input }],
      2,
      'sonnet',
      4000,
      true // raw response for JSON
    );

    // Parse JSON response
    let chronicle;
    try {
      const cleaned = response.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      chronicle = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('[DM Chronicle] Failed to parse AI response as JSON:', parseError.message);
      console.error('[DM Chronicle] Raw response (first 500 chars):', response.substring(0, 500));
      return null;
    }

    // Store the chronicle
    const result = await dbRun(
      `INSERT INTO dm_mode_chronicles (
        dm_mode_party_id, session_id, session_number, summary,
        key_decisions, npcs_involved, locations_visited, plot_threads,
        combat_encounters, items_gained, character_moments, mood, cliffhanger
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        partyId,
        sessionId,
        sessionNumber,
        chronicle.summary || null,
        JSON.stringify(chronicle.key_decisions || []),
        JSON.stringify(chronicle.npcs_involved || []),
        JSON.stringify(chronicle.locations_visited || []),
        JSON.stringify(chronicle.plot_threads || []),
        JSON.stringify(chronicle.combat_encounters || []),
        JSON.stringify(chronicle.items_gained || []),
        JSON.stringify(chronicle.character_moments || []),
        chronicle.mood || null,
        chronicle.cliffhanger || null
      ]
    );

    console.log(`[DM Chronicle] Generated chronicle #${sessionNumber} for session ${sessionId}`);
    return { id: Number(result.lastInsertRowid), sessionNumber };
  } catch (error) {
    console.error('[DM Chronicle] AI extraction failed:', error.message);
    return null;
  }
}

/**
 * Load all chronicles for a party, for prompt injection.
 * @param {number} partyId
 * @returns {Array} Chronicles ordered by session_number ASC
 */
export async function getChroniclesForParty(partyId) {
  return await dbAll(
    'SELECT * FROM dm_mode_chronicles WHERE dm_mode_party_id = ? ORDER BY session_number ASC',
    [partyId]
  );
}
