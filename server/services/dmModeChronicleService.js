/**
 * DM Mode Chronicle Service
 *
 * Extracts structured memory from completed DM Mode sessions:
 * NPCs, locations, plot threads, decisions, character moments.
 * Also extracts inter-party relationship evolution (warmth, trust, attitude shifts).
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
    return { id: Number(result.lastInsertRowid), sessionNumber, data: chronicle };
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

// ============================================================
// RELATIONSHIP EVOLUTION
// ============================================================

const RELATIONSHIP_PROMPT = `You are analyzing a D&D session transcript to extract how inter-party relationships evolved. The USER was the Dungeon Master and the AI played 4 player characters.

CURRENT RELATIONSHIP STATE:
{RELATIONSHIP_STATE}

CURRENT PARTY TENSIONS:
{TENSION_STATE}

Analyze the transcript and determine how relationships changed during this session.

Respond in EXACTLY this JSON format (no markdown, no code fences):
{
  "relationship_shifts": [
    {
      "from": "Character A full name",
      "toward": "Character B full name",
      "warmth_delta": 0,
      "trust_delta": 0,
      "new_attitude": "one-word attitude or null if unchanged",
      "new_tension": "updated tension sentence or null if unchanged",
      "reason": "1 sentence explaining what caused this shift"
    }
  ],
  "tension_updates": {
    "resolved": ["exact text of any tension that was resolved this session"],
    "evolved": [
      {"old": "exact text of tension that changed", "new": "updated tension text"}
    ],
    "new": ["any new party-level tensions that emerged this session"]
  }
}

Guidelines:
- relationship_shifts: Only include relationships that ACTUALLY CHANGED this session. Most sessions will have 2-4 shifts, not 12.
- warmth_delta and trust_delta: Use integers from -2 to +2. Most shifts are -1 or +1. Reserve +/-2 for truly dramatic moments (betrayal, sacrifice, revelation of a major secret).
- new_attitude: Only provide if the attitude word should change (e.g., "respectful" -> "wary"). Use null to keep current attitude.
- new_tension: Only provide if the one-line tension description should be updated to reflect new dynamics. Use null to keep current.
- reason: Be specific. "Kael healed Lyra during the ambush without being asked" not "they bonded".
- tension_updates.resolved: Tensions that have been genuinely overcome or are no longer relevant. Use the exact text from CURRENT PARTY TENSIONS.
- tension_updates.evolved: Tensions where the core dynamic shifted but wasn't fully resolved. Include the exact old text and the new replacement text.
- tension_updates.new: Only add a new party-level tension if something genuinely new emerged. Do not manufacture drama.
- If nothing significant changed between two characters, DO NOT include a shift for them.
- Shifts are DIRECTIONAL: Character A's feelings toward B can change without B's feelings toward A changing.
- A character can gain warmth (+1) and lose trust (-1) toward someone in the same session (e.g., "I like you more but I can't trust your judgment").`;

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function fuzzyTensionMatch(stored, extracted) {
  const normalize = s => s.toLowerCase().replace(/^tension\s*\d+\s*[-—:]\s*/i, '').trim();
  const a = normalize(stored);
  const b = normalize(extracted);
  if (a === b) return true;
  // Check if one contains a significant portion of the other
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  return longer.includes(shorter) || shorter.includes(longer.substring(0, Math.min(60, longer.length)));
}

/**
 * Extract relationship evolution from a completed session and persist changes.
 * Non-blocking — failures are logged, not thrown to callers.
 *
 * @param {number} sessionId - The dm_sessions ID
 * @param {number} partyId - The dm_mode_parties ID
 * @returns {object|null} { shifts, tensionUpdates } or null on failure
 */
export async function extractRelationshipEvolution(sessionId, partyId) {
  // Load fresh party data
  const party = await dbGet('SELECT party_data, party_dynamics FROM dm_mode_parties WHERE id = ?', [partyId]);
  if (!party) {
    console.error(`[DM Relationships] Party ${partyId} not found`);
    return null;
  }

  let characters;
  try {
    const parsed = JSON.parse(party.party_data || '[]');
    characters = Array.isArray(parsed) ? parsed : Object.values(parsed);
  } catch (e) {
    console.error('[DM Relationships] Failed to parse party_data');
    return null;
  }

  let tensions;
  try {
    tensions = JSON.parse(party.party_dynamics || '[]');
  } catch (e) {
    tensions = [];
  }

  // Load session transcript
  const session = await dbGet('SELECT messages FROM dm_sessions WHERE id = ?', [sessionId]);
  if (!session) return null;

  let messages;
  try {
    messages = JSON.parse(session.messages || '[]');
  } catch (e) {
    return null;
  }

  const conversation = messages.filter(m => m.role !== 'system');
  if (conversation.length < 4) {
    console.log(`[DM Relationships] Session ${sessionId} too short for relationship extraction`);
    return null;
  }

  // Build current relationship map for prompt context
  const currentRelationships = {};
  for (const char of characters) {
    currentRelationships[char.name] = {};
    for (const [targetName, rel] of Object.entries(char.party_relationships || {})) {
      currentRelationships[char.name][targetName] = {
        attitude: rel.attitude,
        tension: rel.tension,
        warmth: rel.warmth || 0,
        trust: rel.trust || 0
      };
    }
  }

  // Build transcript (same pattern as chronicle extraction)
  const transcript = conversation
    .map(m => `${m.role === 'user' ? 'DM' : 'PARTY'}: ${m.content}`)
    .join('\n\n');

  let input = transcript;
  if (input.length > 40000) {
    const third = 13000;
    input = input.substring(0, third) +
      '\n\n[...middle portion condensed...]\n\n' +
      input.substring(input.length - third * 2);
  }

  // Build prompt with current state injected
  const prompt = RELATIONSHIP_PROMPT
    .replace('{RELATIONSHIP_STATE}', JSON.stringify(currentRelationships, null, 2))
    .replace('{TENSION_STATE}', JSON.stringify(tensions, null, 2));

  try {
    const response = await chat(
      prompt,
      [{ role: 'user', content: input }],
      2,
      'sonnet',
      2000,
      true
    );

    let result;
    try {
      const cleaned = response.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('[DM Relationships] Failed to parse AI response:', parseError.message);
      console.error('[DM Relationships] Raw (first 500):', response.substring(0, 500));
      return null;
    }

    // Get session number for history entries
    const chronicle = await dbGet(
      'SELECT session_number FROM dm_mode_chronicles WHERE session_id = ?',
      [sessionId]
    );
    const sessionNumber = chronicle?.session_number || '?';

    // Apply relationship shifts
    let shiftCount = 0;
    for (const shift of (result.relationship_shifts || [])) {
      const fromChar = characters.find(c => c.name === shift.from);
      if (!fromChar?.party_relationships) continue;
      const rel = fromChar.party_relationships[shift.toward];
      if (!rel) continue;

      const warmthDelta = clamp(shift.warmth_delta || 0, -2, 2);
      const trustDelta = clamp(shift.trust_delta || 0, -2, 2);

      if (warmthDelta === 0 && trustDelta === 0 && !shift.new_attitude && !shift.new_tension) continue;

      rel.warmth = clamp((rel.warmth || 0) + warmthDelta, -5, 5);
      rel.trust = clamp((rel.trust || 0) + trustDelta, -5, 5);

      if (shift.new_attitude) rel.attitude = shift.new_attitude;
      if (shift.new_tension) rel.tension = shift.new_tension;

      // Append to history (FIFO, max 10)
      if (!rel.history) rel.history = [];
      const deltas = [];
      if (warmthDelta) deltas.push(`warmth${warmthDelta > 0 ? '+' : ''}${warmthDelta}`);
      if (trustDelta) deltas.push(`trust${trustDelta > 0 ? '+' : ''}${trustDelta}`);
      if (deltas.length > 0 || shift.new_attitude) {
        rel.history.push({
          session: sessionNumber,
          shift: deltas.length > 0 ? deltas.join(', ') : `attitude→${shift.new_attitude}`,
          reason: shift.reason || 'Relationship evolved'
        });
        if (rel.history.length > 10) rel.history = rel.history.slice(-10);
      }
      shiftCount++;
    }

    // Apply tension updates
    let updatedTensions = [...tensions];
    for (const resolvedText of (result.tension_updates?.resolved || [])) {
      updatedTensions = updatedTensions.filter(t => !fuzzyTensionMatch(t, resolvedText));
    }
    for (const evolved of (result.tension_updates?.evolved || [])) {
      const idx = updatedTensions.findIndex(t => fuzzyTensionMatch(t, evolved.old));
      if (idx >= 0) updatedTensions[idx] = evolved.new;
    }
    for (const newTension of (result.tension_updates?.new || [])) {
      updatedTensions.push(newTension);
    }

    // Persist changes
    // Re-build party_data preserving the original structure (array or object)
    const originalParsed = JSON.parse(party.party_data);
    if (Array.isArray(originalParsed)) {
      for (let i = 0; i < originalParsed.length; i++) {
        originalParsed[i] = characters[i];
      }
    } else {
      const keys = Object.keys(originalParsed);
      for (let i = 0; i < keys.length; i++) {
        originalParsed[keys[i]] = characters[i];
      }
    }

    await dbRun(
      'UPDATE dm_mode_parties SET party_data = ?, party_dynamics = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(originalParsed), JSON.stringify(updatedTensions), partyId]
    );

    console.log(`[DM Relationships] Extracted ${shiftCount} relationship shifts for session ${sessionId}`);
    return { shifts: result.relationship_shifts, tensionUpdates: result.tension_updates };
  } catch (error) {
    console.error('[DM Relationships] Extraction failed:', error.message);
    return null;
  }
}
