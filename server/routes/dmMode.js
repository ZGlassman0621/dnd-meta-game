/**
 * DM Mode Routes — Party generation, session management, dice resolution, coaching.
 * Base path: /api/dm-mode
 */

import express from 'express';
import { dbAll, dbGet, dbRun } from '../database.js';
import { generateParty } from '../services/partyGeneratorService.js';
import { createDMModeSystemPrompt } from '../services/dmModePromptBuilder.js';
import { detectSkillChecks, detectAttacks, detectSpellCasts, cleanDMModeNarrative, parseCharacterSegments } from '../services/dmModeService.js';
import { generateCoachingTip, DC_REFERENCE } from '../services/dmCoachingService.js';
import * as claude from '../services/claude.js';

const router = express.Router();

// ============================================================
// PARTY MANAGEMENT
// ============================================================

// POST /api/dm-mode/generate-party — Generate a new 4-character party
router.post('/generate-party', async (req, res) => {
  try {
    const { setting, tone, level } = req.body;
    const config = {
      setting: setting || 'Forgotten Realms',
      tone: tone || 'heroic fantasy',
      level: level || 3
    };

    const partyResult = await generateParty(config);

    // Save to database
    const result = await dbRun(
      `INSERT INTO dm_mode_parties (name, setting, tone, level, party_data, party_dynamics, party_concept, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        partyResult.party_name,
        config.setting,
        config.tone,
        config.level,
        JSON.stringify(partyResult.characters),
        JSON.stringify(partyResult.tensions),
        partyResult.party_concept || ''
      ]
    );

    res.json({
      id: Number(result.lastInsertRowid),
      name: partyResult.party_name,
      party_concept: partyResult.party_concept,
      setting: config.setting,
      tone: config.tone,
      level: config.level,
      characters: partyResult.characters,
      tensions: partyResult.tensions,
      status: 'active'
    });
  } catch (error) {
    console.error('Error generating party:', error);
    res.status(500).json({ error: 'Failed to generate party: ' + error.message });
  }
});

// GET /api/dm-mode/parties — List all parties
router.get('/parties', async (req, res) => {
  try {
    const parties = await dbAll(
      'SELECT id, name, setting, tone, level, party_data, party_dynamics, party_concept, status, created_at FROM dm_mode_parties ORDER BY created_at DESC'
    );
    const parsed = parties.map(p => ({
      ...p,
      characters: JSON.parse(p.party_data || '[]'),
      tensions: JSON.parse(p.party_dynamics || '[]'),
    }));
    res.json(parsed);
  } catch (error) {
    console.error('Error listing parties:', error);
    res.status(500).json({ error: 'Failed to list parties' });
  }
});

// GET /api/dm-mode/party/:id — Get party details
router.get('/party/:id', async (req, res) => {
  try {
    const party = await dbGet('SELECT * FROM dm_mode_parties WHERE id = ?', [req.params.id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    res.json({
      ...party,
      characters: JSON.parse(party.party_data || '[]'),
      tensions: JSON.parse(party.party_dynamics || '[]'),
    });
  } catch (error) {
    console.error('Error getting party:', error);
    res.status(500).json({ error: 'Failed to get party' });
  }
});

// DELETE /api/dm-mode/party/:id — Retire a party
router.delete('/party/:id', async (req, res) => {
  try {
    // Complete any active sessions for this party
    await dbRun(
      "UPDATE dm_sessions SET status = 'completed' WHERE dm_mode_party_id = ? AND status IN ('active', 'paused')",
      [req.params.id]
    );
    const result = await dbRun(
      "UPDATE dm_mode_parties SET status = 'retired', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Party not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error retiring party:', error);
    res.status(500).json({ error: 'Failed to retire party' });
  }
});

// ============================================================
// SESSION MANAGEMENT
// ============================================================

// POST /api/dm-mode/start — Start a new DM mode session
router.post('/start', async (req, res) => {
  try {
    const { partyId, openingScene } = req.body;
    if (!partyId) return res.status(400).json({ error: 'partyId is required' });

    // Load party
    const party = await dbGet('SELECT * FROM dm_mode_parties WHERE id = ?', [partyId]);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    // Check for existing active session
    const existingSession = await dbGet(
      "SELECT id FROM dm_sessions WHERE dm_mode_party_id = ? AND status IN ('active', 'paused')",
      [partyId]
    );
    if (existingSession) {
      return res.status(409).json({
        error: 'Party already has an active session',
        sessionId: existingSession.id
      });
    }

    const characters = JSON.parse(party.party_data || '[]');
    const tensions = JSON.parse(party.party_dynamics || '[]');

    // Get previous session summaries for continuity
    const previousSessions = await dbAll(
      "SELECT title, summary FROM dm_sessions WHERE dm_mode_party_id = ? AND status = 'completed' AND summary IS NOT NULL ORDER BY created_at DESC LIMIT 3",
      [partyId]
    );

    // Build system prompt
    const partyForPrompt = {
      party_name: party.name,
      party_concept: party.party_concept || '',
      characters,
      tensions,
      party_dynamics: party.party_dynamics
    };

    const systemPrompt = createDMModeSystemPrompt(partyForPrompt, {
      previousSummaries: previousSessions,
      sessionCount: previousSessions.length
    });

    // Build opening prompt
    const isFirstSession = previousSessions.length === 0;
    let openingPrompt;
    if (openingScene) {
      openingPrompt = openingScene;
    } else if (isFirstSession) {
      openingPrompt = `The party gathers for the first time. Introduce yourselves — each of you, state your name, what you do, and why you're here. React to each other naturally.`;
    } else {
      openingPrompt = `The party reconvenes after their last adventure. What is everyone doing? React to your current situation.`;
    }

    // Call AI — Opus for first session, Sonnet for continuations
    const modelChoice = isFirstSession ? 'opus' : 'sonnet';
    let openingNarrative;

    if (claude.isClaudeAvailable()) {
      const result = await claude.startSession(systemPrompt, openingPrompt, modelChoice);
      openingNarrative = result.response;
    } else {
      openingNarrative = `**${characters[0]?.name || 'Character 1'}:** *looks around at the group* "So. We're really doing this."\n\n**${characters[1]?.name || 'Character 2'}:** "Apparently. Try not to get us killed."\n\n*The party waits for the DM to set the scene.*`;
    }

    // Clean markers from opening
    const cleanedNarrative = cleanDMModeNarrative(openingNarrative);

    // Save session
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: openingPrompt },
      { role: 'assistant', content: openingNarrative }
    ];

    const sessionTitle = `${party.name} — Session ${previousSessions.length + 1}`;

    const insertResult = await dbRun(
      `INSERT INTO dm_sessions (character_id, title, setting, tone, model, status, messages, session_type, dm_mode_party_id, session_config)
       VALUES (NULL, ?, ?, ?, ?, 'active', ?, 'dm_mode', ?, ?)`,
      [
        sessionTitle,
        party.setting,
        party.tone,
        modelChoice,
        JSON.stringify(messages),
        partyId,
        JSON.stringify({ partyId, level: party.level, isFirstSession })
      ]
    );

    res.json({
      sessionId: Number(insertResult.lastInsertRowid),
      title: sessionTitle,
      openingNarrative: cleanedNarrative,
      partyName: party.name,
      characters,
      tensions
    });
  } catch (error) {
    console.error('Error starting DM mode session:', error);
    res.status(500).json({ error: 'Failed to start session: ' + error.message });
  }
});

// POST /api/dm-mode/:sessionId/message — Send DM narration, get character responses
router.post('/:sessionId/message', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { action } = req.body;
    if (!action) return res.status(400).json({ error: 'action is required' });

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ? AND session_type = ?', [sessionId, 'dm_mode']);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Session is not active' });

    const messages = JSON.parse(session.messages || '[]');
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';

    // Call AI
    let narrative;
    if (claude.isClaudeAvailable()) {
      const result = await claude.continueSession(systemPrompt, messages, action, 'sonnet');
      narrative = result.response;
    } else {
      return res.status(503).json({ error: 'No AI provider available' });
    }

    // Detect markers
    const skillChecks = detectSkillChecks(narrative);
    const attacks = detectAttacks(narrative);
    const spellCasts = detectSpellCasts(narrative);

    // Clean narrative
    const cleanedNarrative = cleanDMModeNarrative(narrative);

    // Parse character segments for client rendering
    const segments = parseCharacterSegments(cleanedNarrative);

    // Update session messages
    messages.push({ role: 'user', content: action });
    messages.push({ role: 'assistant', content: narrative });
    await dbRun(
      'UPDATE dm_sessions SET messages = ? WHERE id = ?',
      [JSON.stringify(messages), sessionId]
    );

    res.json({
      narrative: cleanedNarrative,
      segments,
      pendingRolls: {
        skillChecks,
        attacks,
        spellCasts
      }
    });
  } catch (error) {
    console.error('Error in DM mode message:', error);
    res.status(500).json({ error: 'Failed to process message: ' + error.message });
  }
});

// POST /api/dm-mode/:sessionId/roll-result — Inject a dice roll result and get AI reaction
router.post('/:sessionId/roll-result', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { character, rollType, skill, result: rollResult, dc, success, description } = req.body;

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ? AND session_type = ?', [sessionId, 'dm_mode']);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const messages = JSON.parse(session.messages || '[]');
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';

    // Build system note about the roll
    let rollNote;
    if (rollType === 'skill_check') {
      rollNote = `[SYSTEM: ${character} rolled ${rollResult} on ${skill} check. DC was ${dc} — ${success ? 'SUCCESS' : 'FAILURE'}.${description ? ' ' + description : ''}]`;
    } else if (rollType === 'attack') {
      rollNote = `[SYSTEM: ${character}'s attack roll: ${rollResult}.${description ? ' ' + description : ''}]`;
    } else {
      rollNote = `[SYSTEM: ${description || `${character} rolled ${rollResult}`}]`;
    }

    // Get AI reaction to the resolved roll
    let narrative;
    if (claude.isClaudeAvailable()) {
      const result = await claude.continueSession(systemPrompt, messages, rollNote, 'sonnet');
      narrative = result.response;
    } else {
      return res.status(503).json({ error: 'No AI provider available' });
    }

    const cleanedNarrative = cleanDMModeNarrative(narrative);
    const segments = parseCharacterSegments(cleanedNarrative);

    // Update messages
    messages.push({ role: 'user', content: rollNote });
    messages.push({ role: 'assistant', content: narrative });
    await dbRun('UPDATE dm_sessions SET messages = ? WHERE id = ?', [JSON.stringify(messages), sessionId]);

    res.json({ narrative: cleanedNarrative, segments });
  } catch (error) {
    console.error('Error processing roll result:', error);
    res.status(500).json({ error: 'Failed to process roll result' });
  }
});

// POST /api/dm-mode/:sessionId/update-hp — Update a character's HP
router.post('/:sessionId/update-hp', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { characterName, hpChange, newHp } = req.body;

    const session = await dbGet('SELECT dm_mode_party_id FROM dm_sessions WHERE id = ? AND session_type = ?', [sessionId, 'dm_mode']);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const party = await dbGet('SELECT * FROM dm_mode_parties WHERE id = ?', [session.dm_mode_party_id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    const characters = JSON.parse(party.party_data || '[]');
    const char = characters.find(c => c.name === characterName);
    if (!char) return res.status(404).json({ error: 'Character not found in party' });

    if (newHp !== undefined) {
      char.current_hp = Math.max(0, Math.min(char.max_hp, newHp));
    } else if (hpChange !== undefined) {
      char.current_hp = Math.max(0, Math.min(char.max_hp, char.current_hp + hpChange));
    }

    await dbRun(
      'UPDATE dm_mode_parties SET party_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(characters), session.dm_mode_party_id]
    );

    res.json({ characterName, current_hp: char.current_hp, max_hp: char.max_hp });
  } catch (error) {
    console.error('Error updating HP:', error);
    res.status(500).json({ error: 'Failed to update HP' });
  }
});

// D&D 5e XP thresholds per level
const XP_THRESHOLDS = {
  1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
  6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
  11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
  16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000
};

function xpForNextLevel(level) {
  return XP_THRESHOLDS[level + 1] || null; // null means max level
}

// POST /api/dm-mode/:sessionId/award-xp — Award XP to party or individual
router.post('/:sessionId/award-xp', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { amount, characterName, splitEvenly } = req.body;
    // amount: total XP to award
    // characterName: optional, if set only that character gets XP
    // splitEvenly: if true, split amount evenly among party (default)

    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

    const session = await dbGet('SELECT dm_mode_party_id FROM dm_sessions WHERE id = ? AND session_type = ?', [sessionId, 'dm_mode']);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const party = await dbGet('SELECT * FROM dm_mode_parties WHERE id = ?', [session.dm_mode_party_id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    const characters = JSON.parse(party.party_data || '[]');
    const results = [];

    if (characterName) {
      // Award to single character
      const char = characters.find(c => c.name === characterName);
      if (!char) return res.status(404).json({ error: 'Character not found' });
      char.xp = (char.xp || 0) + amount;
      const nextLevelXp = xpForNextLevel(char.level || 1);
      results.push({ name: char.name, xp: char.xp, level: char.level, canLevelUp: nextLevelXp && char.xp >= nextLevelXp });
    } else {
      // Award to all (split evenly by default)
      const perChar = splitEvenly !== false ? Math.floor(amount / characters.length) : amount;
      for (const char of characters) {
        char.xp = (char.xp || 0) + perChar;
        const nextLevelXp = xpForNextLevel(char.level || 1);
        results.push({ name: char.name, xp: char.xp, level: char.level, canLevelUp: nextLevelXp && char.xp >= nextLevelXp });
      }
    }

    await dbRun(
      'UPDATE dm_mode_parties SET party_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(characters), session.dm_mode_party_id]
    );

    res.json({ characters: results });
  } catch (error) {
    console.error('Error awarding XP:', error);
    res.status(500).json({ error: 'Failed to award XP' });
  }
});

// POST /api/dm-mode/:sessionId/award-loot — Add items or gold to characters
router.post('/:sessionId/award-loot', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { characterName, items, gold } = req.body;
    // characterName: which character gets the loot (required)
    // items: array of item names to add to inventory
    // gold: number of gold pieces to add

    if (!characterName) return res.status(400).json({ error: 'characterName is required' });

    const session = await dbGet('SELECT dm_mode_party_id FROM dm_sessions WHERE id = ? AND session_type = ?', [sessionId, 'dm_mode']);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const party = await dbGet('SELECT * FROM dm_mode_parties WHERE id = ?', [session.dm_mode_party_id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    const characters = JSON.parse(party.party_data || '[]');
    const char = characters.find(c => c.name === characterName);
    if (!char) return res.status(404).json({ error: 'Character not found' });

    if (items && Array.isArray(items)) {
      if (!char.inventory) char.inventory = [];
      char.inventory.push(...items);
    }

    if (gold && typeof gold === 'number') {
      char.gold_gp = (char.gold_gp || 0) + gold;
    }

    await dbRun(
      'UPDATE dm_mode_parties SET party_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(characters), session.dm_mode_party_id]
    );

    res.json({ characterName, inventory: char.inventory, gold_gp: char.gold_gp });
  } catch (error) {
    console.error('Error awarding loot:', error);
    res.status(500).json({ error: 'Failed to award loot' });
  }
});

// POST /api/dm-mode/:sessionId/level-up — Level up a character
router.post('/:sessionId/level-up', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { characterName, hpIncrease } = req.body;
    // characterName: which character to level up
    // hpIncrease: how much to increase max HP (DM decides: roll or average)

    if (!characterName) return res.status(400).json({ error: 'characterName is required' });
    if (!hpIncrease || hpIncrease <= 0) return res.status(400).json({ error: 'hpIncrease must be positive' });

    const session = await dbGet('SELECT dm_mode_party_id FROM dm_sessions WHERE id = ? AND session_type = ?', [sessionId, 'dm_mode']);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const party = await dbGet('SELECT * FROM dm_mode_parties WHERE id = ?', [session.dm_mode_party_id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    const characters = JSON.parse(party.party_data || '[]');
    const char = characters.find(c => c.name === characterName);
    if (!char) return res.status(404).json({ error: 'Character not found' });

    const currentLevel = char.level || 1;
    if (currentLevel >= 20) return res.status(400).json({ error: 'Character is already level 20' });

    const nextLevelXp = xpForNextLevel(currentLevel);
    if (nextLevelXp && (char.xp || 0) < nextLevelXp) {
      return res.status(400).json({ error: `Not enough XP. Need ${nextLevelXp}, have ${char.xp || 0}` });
    }

    char.level = currentLevel + 1;
    char.max_hp = (char.max_hp || 0) + hpIncrease;
    char.current_hp = (char.current_hp || 0) + hpIncrease;

    // Update party level to match highest character level
    const maxLevel = Math.max(...characters.map(c => c.level || 1));

    await dbRun(
      'UPDATE dm_mode_parties SET party_data = ?, level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(characters), maxLevel, session.dm_mode_party_id]
    );

    res.json({
      characterName,
      newLevel: char.level,
      max_hp: char.max_hp,
      current_hp: char.current_hp,
      xp: char.xp,
      nextLevelXp: xpForNextLevel(char.level)
    });
  } catch (error) {
    console.error('Error leveling up:', error);
    res.status(500).json({ error: 'Failed to level up' });
  }
});

// POST /api/dm-mode/:sessionId/end — End session, generate summary
router.post('/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ? AND session_type = ?', [sessionId, 'dm_mode']);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const messages = JSON.parse(session.messages || '[]');
    const userMessages = messages.filter(m => m.role === 'user' && !m.content.startsWith('[SYSTEM'));

    let summary = 'Session ended with no summary.';

    // Generate summary if there was meaningful activity
    if (userMessages.length > 1 && claude.isClaudeAvailable()) {
      try {
        const summaryPrompt = `Summarize this D&D session from the players' perspective in 3-5 sentences. Focus on key events, decisions made, conflicts encountered, and any character development moments. Write in past tense.`;

        const recentMessages = messages.filter(m => m.role !== 'system').slice(-20);
        const contextStr = recentMessages.map(m => `${m.role === 'user' ? 'DM' : 'Players'}: ${m.content.substring(0, 300)}`).join('\n');

        summary = await claude.chat(
          'You summarize D&D sessions concisely. Return only the summary text, no formatting.',
          [{ role: 'user', content: `${summaryPrompt}\n\nSession transcript:\n${contextStr}` }],
          2, 'sonnet', 500
        );
      } catch (e) {
        console.error('Summary generation failed:', e.message);
      }
    }

    // Persist updated party data (HP changes, etc.) — already handled by update-hp calls during session
    await dbRun(
      "UPDATE dm_sessions SET status = 'completed', summary = ?, end_time = CURRENT_TIMESTAMP WHERE id = ?",
      [summary, sessionId]
    );

    res.json({ summary });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// PUT /api/dm-mode/session/:sessionId/summary — Edit a session summary
router.put('/session/:sessionId/summary', async (req, res) => {
  try {
    const { summary } = req.body;
    if (!summary || !summary.trim()) return res.status(400).json({ error: 'summary is required' });

    const result = await dbRun(
      'UPDATE dm_sessions SET summary = ? WHERE id = ? AND session_type = ?',
      [summary.trim(), req.params.sessionId, 'dm_mode']
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Session not found' });

    res.json({ success: true, summary: summary.trim() });
  } catch (error) {
    console.error('Error updating summary:', error);
    res.status(500).json({ error: 'Failed to update summary' });
  }
});

// GET /api/dm-mode/active/:partyId — Get active session for a party
router.get('/active/:partyId', async (req, res) => {
  try {
    const session = await dbGet(
      "SELECT id, title, status, messages FROM dm_sessions WHERE dm_mode_party_id = ? AND status IN ('active', 'paused') LIMIT 1",
      [req.params.partyId]
    );
    if (!session) return res.json(null);

    const allMessages = JSON.parse(session.messages || '[]');
    // Return non-system messages so client can rebuild conversation display
    const displayMessages = allMessages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'user' ? 'dm' : 'party',
        content: m.content
      }));

    res.json({
      id: session.id,
      title: session.title,
      status: session.status,
      messageCount: allMessages.filter(m => m.role === 'user').length,
      messages: displayMessages
    });
  } catch (error) {
    console.error('Error getting active session:', error);
    res.status(500).json({ error: 'Failed to get active session' });
  }
});

// GET /api/dm-mode/history/:partyId — Get session history for a party
router.get('/history/:partyId', async (req, res) => {
  try {
    const sessions = await dbAll(
      "SELECT id, title, summary, status, created_at, end_time FROM dm_sessions WHERE dm_mode_party_id = ? ORDER BY created_at DESC",
      [req.params.partyId]
    );
    res.json(sessions);
  } catch (error) {
    console.error('Error getting session history:', error);
    res.status(500).json({ error: 'Failed to get session history' });
  }
});

// ============================================================
// COACHING
// ============================================================

// POST /api/dm-mode/:sessionId/coaching-tip — Get a coaching tip
router.post('/:sessionId/coaching-tip', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await dbGet('SELECT * FROM dm_sessions WHERE id = ? AND session_type = ?', [sessionId, 'dm_mode']);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const party = await dbGet('SELECT party_data FROM dm_mode_parties WHERE id = ?', [session.dm_mode_party_id]);
    const characters = JSON.parse(party?.party_data || '[]');
    const messages = JSON.parse(session.messages || '[]').filter(m => m.role !== 'system');

    const tip = await generateCoachingTip(messages, characters);
    res.json({ ...tip, dcReference: DC_REFERENCE });
  } catch (error) {
    console.error('Error generating coaching tip:', error);
    res.status(500).json({ error: 'Failed to generate tip' });
  }
});

export default router;
