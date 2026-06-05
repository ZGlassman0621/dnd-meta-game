import express from 'express';
import { dbAll, dbGet, dbRun } from '../database.js';
import { generateAdventureOptions, generateAdventureNarrative, generateContextualAdventures, generateAllRiskLevelAdventures } from '../services/adventureGenerator.js';
import {
  getTimeMultiplier,
  calculateXPReward,
  calculateGoldReward,
  determineSuccess,
  determineSuccessWithOdds,
  previewOdds,
  generateConsequences,
  generateLoot,
  generateStoryConsequences
} from '../config/rewards.js';
import { advanceGameTime, TIME_RATIOS } from '../services/metaGame.js';
import { createThreadsFromAdventure } from '../services/storyThreads.js';
import { onAdventureComplete, onStoryThreadCreated } from '../services/narrativeIntegration.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

// Get adventure options for a character
router.post('/options', async (req, res) => {
  try {
    const { character_id, risk_level, use_context } = req.body;

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [character_id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    let options;

    // If risk_level is 'all' or not provided, generate one adventure per risk level
    if (risk_level === 'all' || !risk_level) {
      options = await generateAllRiskLevelAdventures(character_id);
      return res.json({ options, multi_risk: true, contextual: true });
    }

    // Single risk level mode (backward compatible)
    if (!['low', 'medium', 'high'].includes(risk_level)) {
      return res.status(400).json({ error: 'Invalid risk level' });
    }

    // Generate adventure options using LLM
    // use_context=true uses the full campaign context for more intelligent generation
    options = use_context
      ? await generateContextualAdventures(character_id, risk_level)
      : await generateAdventureOptions(character, risk_level);

    res.json({ options, risk_level, contextual: !!use_context });
  } catch (error) {
    handleServerError(res, error, 'generate adventure options');
  }
});

// Preview odds for an adventure (before starting)
router.post('/preview-odds', async (req, res) => {
  try {
    const { character_id, risk_level, activity_type, participating_companions } = req.body;

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [character_id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Build party members array starting with the main character
    const partyMembers = [{
      name: character.first_name || character.name?.split(' ')[0] || character.name,
      class: character.class,
      level: character.level
    }];

    // Get companion details if participating
    if (participating_companions && participating_companions.length > 0) {
      const companions = await dbAll(`
        SELECT c.*, n.name as npc_name, n.occupation
        FROM companions c
        JOIN npcs n ON c.npc_id = n.id
        WHERE c.id IN (${participating_companions.map(() => '?').join(',')})
      `, participating_companions);

      for (const companion of companions) {
        partyMembers.push({
          name: companion.npc_name?.split(' ')[0] || 'Companion',
          class: companion.companion_class || companion.occupation || 'adventurer',
          level: companion.companion_level || 1
        });
      }
    }

    const odds = previewOdds(risk_level, partyMembers, activity_type);

    res.json({
      odds,
      partyMembers: partyMembers.map(m => ({ name: m.name, class: m.class }))
    });
  } catch (error) {
    handleServerError(res, error, 'preview odds');
  }
});

// Start an adventure
router.post('/start', async (req, res) => {
  try {
    const { character_id, adventure, duration_hours, risk_level, participating_companions } = req.body;

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [character_id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Check if character already has an active adventure
    const activeAdventure = await dbGet(
      'SELECT * FROM adventures WHERE character_id = ? AND status = ?',
      [character_id, 'active']
    );

    if (activeAdventure) {
      return res.status(400).json({ error: 'Character already on an adventure' });
    }

    // Check if character has an active DM session
    const activeDMSession = await dbGet(
      'SELECT id FROM dm_sessions WHERE character_id = ? AND (status = ? OR (status = ? AND rewards_claimed = 0))',
      [character_id, 'active', 'completed']
    );

    if (activeDMSession) {
      return res.status(400).json({
        error: 'Character is in an AI DM session. End and claim rewards first.',
        sessionId: activeDMSession.id
      });
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration_hours * 60 * 60 * 1000);

    // Store participating companions (array of companion IDs)
    const companionsJson = JSON.stringify(participating_companions || []);

    const result = await dbRun(`
      INSERT INTO adventures (
        character_id, title, description, location, risk_level,
        duration_hours, start_time, end_time, status, participating_companions,
        estimated_game_hours, activity_type, quest_relevance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      character_id,
      adventure.title,
      adventure.description,
      character.current_location,
      risk_level,
      duration_hours,
      startTime.toISOString(),
      endTime.toISOString(),
      'active',
      companionsJson,
      adventure.estimated_game_hours || 8,
      adventure.activity_type || 'combat',
      adventure.quest_relevance || 'side_quest'
    ]);

    const newAdventure = await dbGet('SELECT * FROM adventures WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(newAdventure);
  } catch (error) {
    handleServerError(res, error, 'start adventure');
  }
});

// Check adventure status and complete if time is up
router.get('/status/:character_id', async (req, res) => {
  try {
    const character_id = req.params.character_id;

    // First check for completed adventures
    const completedAdventure = await dbGet(
      'SELECT * FROM adventures WHERE character_id = ? AND status = ? ORDER BY start_time DESC LIMIT 1',
      [character_id, 'completed']
    );

    if (completedAdventure) {
      return res.json({
        status: 'completed',
        adventure: completedAdventure
      });
    }

    // Then check for active adventures
    const adventure = await dbGet(
      'SELECT * FROM adventures WHERE character_id = ? AND status = ? ORDER BY start_time DESC LIMIT 1',
      [character_id, 'active']
    );

    if (!adventure) {
      return res.json({ status: 'none', adventure: null });
    }

    const now = new Date();
    const endTime = new Date(adventure.end_time);

    if (now < endTime) {
      // Adventure still in progress
      const remainingMs = endTime - now;
      const remainingMinutes = Math.ceil(remainingMs / 60000);

      return res.json({
        status: 'active',
        adventure,
        remaining_minutes: remainingMinutes,
        progress: Math.min(100, ((now - new Date(adventure.start_time)) / (endTime - new Date(adventure.start_time))) * 100)
      });
    }

    // Adventure is complete - process results
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [character_id]);
    const results = await processAdventureCompletion(adventure, character);

    res.json({
      status: 'completed',
      adventure,
      results
    });
  } catch (error) {
    handleServerError(res, error, 'check adventure status');
  }
});

// Claim completed adventure rewards
router.post('/claim/:adventure_id', async (req, res) => {
  try {
    const adventure_id = req.params.adventure_id;

    const adventure = await dbGet('SELECT * FROM adventures WHERE id = ?', [adventure_id]);
    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    if (adventure.status !== 'completed') {
      return res.status(400).json({ error: 'Adventure not completed yet' });
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [adventure.character_id]);
    const results = JSON.parse(adventure.results);
    const rewards = results.rewards;
    const consequences = results.consequences;

    // Apply rewards and consequences to character
    const updates = {
      experience: character.experience + (rewards?.xp || 0),
      gold_cp: character.gold_cp + (rewards?.gold?.cp || 0),
      gold_sp: character.gold_sp + (rewards?.gold?.sp || 0),
      gold_gp: character.gold_gp + (rewards?.gold?.gp || 0),
      current_hp: character.current_hp
    };

    // Apply HP restoration from successful adventure
    if (rewards?.hp_restored) {
      updates.current_hp = Math.min(character.max_hp, character.current_hp + rewards.hp_restored);
    }

    // Add loot to inventory
    if (rewards?.loot) {
      const inventory = JSON.parse(character.inventory || '[]');
      inventory.push(rewards.loot);
      updates.inventory = JSON.stringify(inventory);
    }

    // Apply consequences
    if (consequences) {
      for (const consequence of consequences) {
        if (consequence.type === 'hp_loss') {
          updates.current_hp = Math.max(1, character.current_hp - consequence.value);
        }
        if (consequence.type === 'gold_loss') {
          const lossPercent = consequence.value;
          // Ensure gold never goes below 0
          updates.gold_cp = Math.max(0, Math.floor(updates.gold_cp * (1 - lossPercent)));
          updates.gold_sp = Math.max(0, Math.floor(updates.gold_sp * (1 - lossPercent)));
          updates.gold_gp = Math.max(0, Math.floor(updates.gold_gp * (1 - lossPercent)));
        }
        if (consequence.type === 'debuff') {
          const debuffs = JSON.parse(character.debuffs || '[]');
          debuffs.push({ description: consequence.description, duration: consequence.duration });
          updates.debuffs = JSON.stringify(debuffs);
        }
      }
    }

    // Calculate in-game time elapsed and advance game clock
    const campaignConfig = JSON.parse(character.campaign_config || '{}');
    const timeRatioKey = campaignConfig.timeRatio || 'normal';
    const timeRatio = TIME_RATIOS[timeRatioKey]?.ratio || 6;
    const inGameHours = Math.round(adventure.duration_hours * timeRatio);

    const currentDay = character.game_day || 1;
    const currentYear = character.game_year || 1492;
    const currentHour = character.game_hour ?? 8;

    const newTime = advanceGameTime(currentDay, currentYear, currentHour, inGameHours);

    // Add adventure narrative to pending_downtime_narratives for AI DM context
    let pendingNarratives = [];
    try {
      pendingNarratives = JSON.parse(character.pending_downtime_narratives || '[]');
    } catch (e) {
      pendingNarratives = [];
    }

    // Add adventure summary to pending narratives
    pendingNarratives.push({
      type: 'meta_adventure',
      title: adventure.title,
      success: results.success,
      summary: results.narrative,
      rewards: rewards ? {
        xp: rewards.xp,
        gold: rewards.gold,
        loot: rewards.loot
      } : null,
      consequences: consequences,
      inGameHours,
      timestamp: new Date().toISOString()
    });

    // Update character with rewards, time advancement, and narrative
    // Note: Must use null instead of undefined for database binding
    await dbRun(`
      UPDATE characters
      SET experience = ?, gold_cp = ?, gold_sp = ?, gold_gp = ?,
          current_hp = ?, debuffs = COALESCE(?, debuffs),
          inventory = COALESCE(?, inventory),
          game_day = ?, game_year = ?, game_hour = ?,
          pending_downtime_narratives = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      updates.experience,
      updates.gold_cp,
      updates.gold_sp,
      updates.gold_gp,
      updates.current_hp,
      updates.debuffs ?? null,
      updates.inventory ?? null,
      newTime.day,
      newTime.year,
      newTime.hour,
      JSON.stringify(pendingNarratives),
      adventure.character_id
    ]);

    // Distribute XP to companions
    const xpGained = rewards?.xp || 0;
    const companionXpResults = [];

    if (xpGained > 0) {
      // Get all active companions for this character
      const allCompanions = await dbAll(`
        SELECT c.*, n.name as npc_name
        FROM companions c
        JOIN npcs n ON c.npc_id = n.id
        WHERE c.recruited_by_character_id = ? AND c.status = 'active'
      `, [adventure.character_id]);

      // Get participating companion IDs from the adventure
      let participatingIds = [];
      try {
        participatingIds = JSON.parse(adventure.participating_companions || '[]');
      } catch (e) {
        participatingIds = [];
      }

      // Distribute XP to each companion
      for (const companion of allCompanions) {
        const isParticipating = participatingIds.includes(companion.id);
        // Participating companions get full XP, others get 50%
        const companionXp = isParticipating ? xpGained : Math.floor(xpGained * 0.5);

        const currentXp = companion.companion_experience || 0;
        const newXp = currentXp + companionXp;

        await dbRun(`
          UPDATE companions
          SET companion_experience = ?
          WHERE id = ?
        `, [newXp, companion.id]);

        companionXpResults.push({
          id: companion.id,
          name: companion.npc_name,
          xpGained: companionXp,
          participated: isParticipating,
          totalXp: newXp
        });
      }
    }

    // Mark adventure as claimed
    await dbRun('UPDATE adventures SET status = ? WHERE id = ?', ['claimed', adventure_id]);

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [adventure.character_id]);

    res.json({
      message: 'Adventure rewards claimed',
      character: updatedCharacter,
      results,
      companionXp: companionXpResults
    });
  } catch (error) {
    handleServerError(res, error, 'claim adventure');
  }
});

// Cancel/Clear an active adventure
router.delete('/cancel/:character_id', async (req, res) => {
  try {
    const character_id = req.params.character_id;

    // Find active or completed adventure
    const adventure = await dbGet(
      'SELECT * FROM adventures WHERE character_id = ? AND (status = ? OR status = ?) ORDER BY start_time DESC LIMIT 1',
      [character_id, 'active', 'completed']
    );

    if (!adventure) {
      return res.status(404).json({ error: 'No active adventure to cancel' });
    }

    // Mark adventure as cancelled
    await dbRun('UPDATE adventures SET status = ? WHERE id = ?', ['cancelled', adventure.id]);

    res.json({ message: 'Adventure cancelled successfully' });
  } catch (error) {
    handleServerError(res, error, 'cancel adventure');
  }
});

// Get adventure history for a character
router.get('/history/:character_id', async (req, res) => {
  try {
    const adventures = await dbAll(
      'SELECT * FROM adventures WHERE character_id = ? ORDER BY start_time DESC LIMIT 20',
      [req.params.character_id]
    );

    res.json(adventures);
  } catch (error) {
    handleServerError(res, error, 'fetch adventure history');
  }
});

// Clear adventure history for a character
router.delete('/clear-history/:character_id', async (req, res) => {
  try {
    const character_id = req.params.character_id;

    // Delete all adventures for this character
    const result = await dbRun('DELETE FROM adventures WHERE character_id = ?', [character_id]);

    res.json({
      message: 'Adventure history cleared successfully',
      deleted_count: result.changes
    });
  } catch (error) {
    handleServerError(res, error, 'clear adventure history');
  }
});

// Helper function to process adventure completion
async function processAdventureCompletion(adventure, character) {
  const timeMultiplier = getTimeMultiplier(adventure.duration_hours);

  // Build party members array for synergy calculation
  const partyMembers = [{
    name: character.first_name || character.name?.split(' ')[0] || character.name,
    class: character.class,
    level: character.level
  }];

  // Get participating companions for synergy calculation
  let participatingIds = [];
  try {
    participatingIds = JSON.parse(adventure.participating_companions || '[]');
  } catch (e) {
    participatingIds = [];
  }

  if (participatingIds.length > 0) {
    const companions = await dbAll(`
      SELECT c.*, n.name as npc_name, n.occupation
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id IN (${participatingIds.map(() => '?').join(',')})
    `, participatingIds);

    for (const companion of companions) {
      partyMembers.push({
        name: companion.npc_name?.split(' ')[0] || 'Companion',
        class: companion.companion_class || companion.occupation || 'adventurer',
        level: companion.companion_level || 1
      });
    }
  }

  // Get activity type from adventure (if stored) or default to combat
  const activityType = adventure.activity_type || 'combat';

  // Determine success with party synergy
  const successResult = determineSuccessWithOdds(adventure.risk_level, partyMembers, activityType);
  const success = successResult.success;

  let rewards = null;
  let consequences = null;

  if (success) {
    rewards = {
      xp: calculateXPReward(character.experience, character.experience_to_next_level, adventure.risk_level, timeMultiplier, character.level),
      gold: calculateGoldReward(character.level, adventure.risk_level, timeMultiplier)
    };

    // HP regeneration on successful adventures
    // Characters heal 10-25% of missing HP on success
    const missingHp = character.max_hp - character.current_hp;
    if (missingHp > 0) {
      const healAmount = Math.floor(missingHp * (0.1 + Math.random() * 0.15));
      rewards.hp_restored = healAmount;
    }

    // Loot generation (20% chance on high-risk adventures)
    const loot = generateLoot(character.level, adventure.risk_level);
    if (loot) {
      rewards.loot = loot;
    }
  } else {
    consequences = generateConsequences(character, adventure.risk_level);
  }

  // Generate narrative with party members
  const narrative = await generateAdventureNarrative(
    adventure,
    character,
    success,
    rewards,
    consequences,
    partyMembers
  );

  const results = {
    success,
    rewards,
    consequences,
    narrative,
    odds: successResult.odds
  };

  // Update adventure with results
  await dbRun(`
    UPDATE adventures
    SET status = ?, results = ?, rewards = ?, consequences = ?
    WHERE id = ?
  `, [
    'completed',
    JSON.stringify(results),
    JSON.stringify(rewards),
    JSON.stringify(consequences),
    adventure.id
  ]);

  // Create story threads from the adventure outcome
  try {
    const storyThreads = await createThreadsFromAdventure(adventure, results, character);
    results.storyThreads = storyThreads;

    // Emit story thread created events for narrative system
    for (const thread of storyThreads) {
      await onStoryThreadCreated(thread, character.id);
    }
  } catch (err) {
    console.error('Error creating story threads:', err);
    // Don't fail the adventure completion if thread creation fails
  }

  // Emit adventure complete event for narrative system
  // This triggers quest progress checker and companion trigger checker
  try {
    await onAdventureComplete(adventure, results, character);
  } catch (err) {
    console.error('Error emitting adventure complete event:', err);
  }

  return results;
}

export default router;
