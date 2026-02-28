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
import { generateDMModeChronicle, getChroniclesForParty, extractRelationshipEvolution } from '../services/dmModeChronicleService.js';
import { syncNpcsFromChronicle, syncPlotThreadsFromChronicle, extractNpcVoiceNotes, getNpcsForParty, getPlotThreadsForParty, updatePlotThreadStatus, updatePlotThreadTags, createManualPlotThread } from '../services/dmModeNpcService.js';
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

    // Load structured chronicles (preferred) and plain summaries (fallback for pre-chronicle sessions)
    let chronicles = [];
    try {
      chronicles = await getChroniclesForParty(partyId);
    } catch (e) {
      console.error('[DM Mode] Failed to load chronicles:', e.message);
    }

    const previousSessions = await dbAll(
      "SELECT id, title, summary FROM dm_sessions WHERE dm_mode_party_id = ? AND status = 'completed' AND summary IS NOT NULL ORDER BY created_at ASC",
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
      sessionCount: previousSessions.length,
      chronicles
    });

    // Build opening prompt
    const isFirstSession = chronicles.length === 0 && previousSessions.length === 0;
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

    // Detect OOC (Out of Character) messages
    // Formats: "OOC: ...", "OOC Vask: ...", "ooc to Fidget: ...", "(OOC) ..."
    const oocMatch = action.match(/^(?:\(?\s*OOC\s*\)?\s*(?:to\s+)?(\w+)?\s*[:—-]\s*)(.*)/is);
    const isOOC = !!oocMatch;
    let aiInput = action;

    if (isOOC) {
      const targetName = oocMatch[1] || null;
      const oocContent = oocMatch[2].trim();

      // Build OOC wrapper for the AI
      const targetClause = targetName
        ? `the player behind ${targetName}. Only ${targetName}'s player should respond`
        : `the players at the table. Any or all players may respond`;
      aiInput = `[OOC — The DM is speaking OUT OF CHARACTER to ${targetClause}. ` +
        `Respond as the PLAYER(S), not the characters. Players have full knowledge of their character's backstory, secrets, motivations, fears, and inner thoughts. ` +
        `Speak honestly and reflectively about the character — their psychology, why they made certain choices, what they're feeling underneath the surface, what the player's intent is. ` +
        `Use a casual, conversational player voice — not the character's in-game voice. ` +
        `Format: **PlayerName (OOC):** response. Keep the game paused — no in-character actions or world progression.]\n\n` +
        `DM (OOC${targetName ? ` to ${targetName}'s player` : ''}): ${oocContent}`;
    }

    // Call AI
    let narrative;
    if (claude.isClaudeAvailable()) {
      const result = await claude.continueSession(systemPrompt, messages, aiInput, 'sonnet');
      narrative = result.response;
    } else {
      return res.status(503).json({ error: 'No AI provider available' });
    }

    // Detect markers (skip for OOC — no game actions)
    const skillChecks = isOOC ? [] : detectSkillChecks(narrative);
    const attacks = isOOC ? [] : detectAttacks(narrative);
    const spellCasts = isOOC ? [] : detectSpellCasts(narrative);

    // Clean narrative
    const cleanedNarrative = cleanDMModeNarrative(narrative);

    // Parse character segments for client rendering
    const segments = parseCharacterSegments(cleanedNarrative);

    // Update session messages — store original action (not wrapped) for transcript readability
    messages.push({ role: 'user', content: isOOC ? `[OOC] ${action}` : action });
    messages.push({ role: 'assistant', content: narrative });
    await dbRun(
      'UPDATE dm_sessions SET messages = ? WHERE id = ?',
      [JSON.stringify(messages), sessionId]
    );

    res.json({
      narrative: cleanedNarrative,
      segments,
      ooc: isOOC,
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

    // Generate structured chronicle (non-blocking — don't fail session end)
    let chronicleResult = null;
    if (claude.isClaudeAvailable() && userMessages.length > 1) {
      try {
        chronicleResult = await generateDMModeChronicle(parseInt(sessionId), session.dm_mode_party_id);
        if (chronicleResult) {
          console.log(`[DM Mode] Generated chronicle #${chronicleResult.sessionNumber} for session ${sessionId}`);
        }
      } catch (e) {
        console.error('[DM Mode] Chronicle generation failed:', e.message);
      }

      // Extract relationship evolution (non-blocking)
      try {
        const evolution = await extractRelationshipEvolution(parseInt(sessionId), session.dm_mode_party_id);
        if (evolution) {
          console.log(`[DM Mode] Extracted ${evolution.shifts?.length || 0} relationship shifts for session ${sessionId}`);
        }
      } catch (e) {
        console.error('[DM Mode] Relationship extraction failed:', e.message);
      }

      // Sync NPCs and plot threads from chronicle (non-blocking)
      if (chronicleResult?.data) {
        try {
          await syncNpcsFromChronicle(session.dm_mode_party_id, chronicleResult.data, chronicleResult.sessionNumber);
          await syncPlotThreadsFromChronicle(session.dm_mode_party_id, chronicleResult.data, chronicleResult.sessionNumber);
        } catch (e) {
          console.error('[DM Mode] NPC/thread sync failed:', e.message);
        }
      }

      // Extract NPC voice notes (non-blocking)
      try {
        await extractNpcVoiceNotes(parseInt(sessionId), session.dm_mode_party_id);
      } catch (e) {
        console.error('[DM Mode] Voice extraction failed:', e.message);
      }
    }

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

// ============================================================
// NPC CODEX
// ============================================================

// GET /api/dm-mode/npcs/:partyId — List NPCs for a party
router.get('/npcs/:partyId', async (req, res) => {
  try {
    const { search, sort } = req.query;
    const npcs = await getNpcsForParty(parseInt(req.params.partyId), { search, sort });
    res.json(npcs);
  } catch (error) {
    console.error('Error getting NPCs:', error);
    res.status(500).json({ error: 'Failed to get NPCs' });
  }
});

// ============================================================
// PLOT THREADS
// ============================================================

// GET /api/dm-mode/plot-threads/:partyId — List plot threads
router.get('/plot-threads/:partyId', async (req, res) => {
  try {
    const { status } = req.query;
    const threads = await getPlotThreadsForParty(parseInt(req.params.partyId), { status });
    res.json(threads);
  } catch (error) {
    console.error('Error getting plot threads:', error);
    res.status(500).json({ error: 'Failed to get plot threads' });
  }
});

// POST /api/dm-mode/plot-threads/:partyId — Create a manual plot thread
router.post('/plot-threads/:partyId', async (req, res) => {
  try {
    const { threadName, status, details, tags } = req.body;
    if (!threadName?.trim()) return res.status(400).json({ error: 'threadName is required' });

    const thread = await createManualPlotThread(parseInt(req.params.partyId), {
      threadName: threadName.trim(), status, details, tags
    });
    res.json(thread);
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'A thread with this name already exists' });
    }
    console.error('Error creating plot thread:', error);
    res.status(500).json({ error: 'Failed to create plot thread' });
  }
});

// PUT /api/dm-mode/plot-thread/:threadId/status — Update thread status
router.put('/plot-thread/:threadId/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ongoing', 'resolved', 'abandoned', 'new'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const thread = await updatePlotThreadStatus(parseInt(req.params.threadId), status);
    res.json({ ...thread, tags: JSON.parse(thread.tags || '[]') });
  } catch (error) {
    console.error('Error updating plot thread status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// PUT /api/dm-mode/plot-thread/:threadId/tags — Update thread tags
router.put('/plot-thread/:threadId/tags', async (req, res) => {
  try {
    const { tags } = req.body;
    if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be an array' });
    const thread = await updatePlotThreadTags(parseInt(req.params.threadId), tags);
    res.json({ ...thread, tags: JSON.parse(thread.tags || '[]') });
  } catch (error) {
    console.error('Error updating plot thread tags:', error);
    res.status(500).json({ error: 'Failed to update tags' });
  }
});

// ============================================================
// SPELL SLOTS & LONG REST
// ============================================================

// POST /api/dm-mode/:sessionId/update-spell-slots — Update spell slot usage
router.post('/:sessionId/update-spell-slots', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { characterName, level, used } = req.body;

    const session = await dbGet('SELECT dm_mode_party_id FROM dm_sessions WHERE id = ? AND session_type = ?', [sessionId, 'dm_mode']);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const party = await dbGet('SELECT * FROM dm_mode_parties WHERE id = ?', [session.dm_mode_party_id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    const characters = JSON.parse(party.party_data || '[]');
    const char = characters.find(c => c.name === characterName);
    if (!char) return res.status(404).json({ error: 'Character not found' });

    const slots = char.spell_slots || {};
    const maxForLevel = slots[String(level)] || 0;
    if (!char.spell_slots_used) char.spell_slots_used = {};
    char.spell_slots_used[String(level)] = Math.max(0, Math.min(maxForLevel, used));

    await dbRun(
      'UPDATE dm_mode_parties SET party_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(characters), session.dm_mode_party_id]
    );

    res.json({ characterName, spell_slots: char.spell_slots, spell_slots_used: char.spell_slots_used });
  } catch (error) {
    console.error('Error updating spell slots:', error);
    res.status(500).json({ error: 'Failed to update spell slots' });
  }
});

// POST /api/dm-mode/:sessionId/long-rest — Reset spell slots and restore HP
router.post('/:sessionId/long-rest', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await dbGet('SELECT dm_mode_party_id FROM dm_sessions WHERE id = ? AND session_type = ?', [sessionId, 'dm_mode']);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const party = await dbGet('SELECT * FROM dm_mode_parties WHERE id = ?', [session.dm_mode_party_id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    const characters = JSON.parse(party.party_data || '[]');
    for (const char of characters) {
      // Restore HP to max
      char.current_hp = char.max_hp;
      // Reset all spell slots
      if (char.spell_slots_used) {
        for (const level of Object.keys(char.spell_slots_used)) {
          char.spell_slots_used[level] = 0;
        }
      }
    }

    await dbRun(
      'UPDATE dm_mode_parties SET party_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(characters), session.dm_mode_party_id]
    );

    res.json({ characters });
  } catch (error) {
    console.error('Error processing long rest:', error);
    res.status(500).json({ error: 'Failed to process long rest' });
  }
});

// ============================================================
// GAME DAY
// ============================================================

// POST /api/dm-mode/party/:partyId/game-day — Update game day
router.post('/party/:partyId/game-day', async (req, res) => {
  try {
    const { delta, day } = req.body;
    const partyId = parseInt(req.params.partyId);

    const party = await dbGet('SELECT current_game_day FROM dm_mode_parties WHERE id = ?', [partyId]);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    let newDay;
    if (day !== undefined) {
      newDay = Math.max(1, day);
    } else if (delta !== undefined) {
      newDay = Math.max(1, (party.current_game_day || 1) + delta);
    } else {
      return res.status(400).json({ error: 'Provide delta or day' });
    }

    await dbRun(
      'UPDATE dm_mode_parties SET current_game_day = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newDay, partyId]
    );

    res.json({ current_game_day: newDay });
  } catch (error) {
    console.error('Error updating game day:', error);
    res.status(500).json({ error: 'Failed to update game day' });
  }
});

export default router;
