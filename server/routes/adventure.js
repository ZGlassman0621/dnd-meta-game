import express from 'express';
import db from '../database.js';
import { generateAdventureOptions, generateAdventureNarrative } from '../services/adventureGenerator.js';
import {
  getTimeMultiplier,
  calculateXPReward,
  calculateGoldReward,
  determineSuccess,
  generateConsequences,
  generateLoot
} from '../config/rewards.js';

const router = express.Router();

// Get adventure options for a character
router.post('/options', async (req, res) => {
  try {
    const { character_id, risk_level } = req.body;

    if (!['low', 'medium', 'high'].includes(risk_level)) {
      return res.status(400).json({ error: 'Invalid risk level' });
    }

    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Generate adventure options using LLM
    const options = await generateAdventureOptions(character, risk_level);

    res.json({ options, risk_level });
  } catch (error) {
    console.error('Error generating adventure options:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start an adventure
router.post('/start', async (req, res) => {
  try {
    const { character_id, adventure, duration_hours, risk_level } = req.body;

    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Check if character already has an active adventure
    const activeAdventure = db.prepare(
      'SELECT * FROM adventures WHERE character_id = ? AND status = ?'
    ).get(character_id, 'active');

    if (activeAdventure) {
      return res.status(400).json({ error: 'Character already on an adventure' });
    }

    // Check if character has an active DM session
    const activeDMSession = db.prepare(
      'SELECT id FROM dm_sessions WHERE character_id = ? AND (status = ? OR (status = ? AND rewards_claimed = 0))'
    ).get(character_id, 'active', 'completed');

    if (activeDMSession) {
      return res.status(400).json({
        error: 'Character is in an AI DM session. End and claim rewards first.',
        sessionId: activeDMSession.id
      });
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration_hours * 60 * 60 * 1000);

    const stmt = db.prepare(`
      INSERT INTO adventures (
        character_id, title, description, location, risk_level,
        duration_hours, start_time, end_time, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      character_id,
      adventure.title,
      adventure.description,
      character.current_location,
      risk_level,
      duration_hours,
      startTime.toISOString(),
      endTime.toISOString(),
      'active'
    );

    const newAdventure = db.prepare('SELECT * FROM adventures WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newAdventure);
  } catch (error) {
    console.error('Error starting adventure:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check adventure status and complete if time is up
router.get('/status/:character_id', async (req, res) => {
  try {
    const character_id = req.params.character_id;

    // First check for completed adventures
    const completedAdventure = db.prepare(
      'SELECT * FROM adventures WHERE character_id = ? AND status = ? ORDER BY start_time DESC LIMIT 1'
    ).get(character_id, 'completed');

    if (completedAdventure) {
      return res.json({
        status: 'completed',
        adventure: completedAdventure
      });
    }

    // Then check for active adventures
    const adventure = db.prepare(
      'SELECT * FROM adventures WHERE character_id = ? AND status = ? ORDER BY start_time DESC LIMIT 1'
    ).get(character_id, 'active');

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
    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id);
    const results = await processAdventureCompletion(adventure, character);

    res.json({
      status: 'completed',
      adventure,
      results
    });
  } catch (error) {
    console.error('Error checking adventure status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Claim completed adventure rewards
router.post('/claim/:adventure_id', async (req, res) => {
  try {
    const adventure_id = req.params.adventure_id;

    const adventure = db.prepare('SELECT * FROM adventures WHERE id = ?').get(adventure_id);
    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    if (adventure.status !== 'completed') {
      return res.status(400).json({ error: 'Adventure not completed yet' });
    }

    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(adventure.character_id);
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

    // Update character
    const updateStmt = db.prepare(`
      UPDATE characters
      SET experience = ?, gold_cp = ?, gold_sp = ?, gold_gp = ?,
          current_hp = ?, debuffs = COALESCE(?, debuffs),
          inventory = COALESCE(?, inventory), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(
      updates.experience,
      updates.gold_cp,
      updates.gold_sp,
      updates.gold_gp,
      updates.current_hp,
      updates.debuffs,
      updates.inventory,
      adventure.character_id
    );

    // Mark adventure as claimed
    db.prepare('UPDATE adventures SET status = ? WHERE id = ?').run('claimed', adventure_id);

    const updatedCharacter = db.prepare('SELECT * FROM characters WHERE id = ?').get(adventure.character_id);

    res.json({
      message: 'Adventure rewards claimed',
      character: updatedCharacter,
      results
    });
  } catch (error) {
    console.error('Error claiming adventure:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel/Clear an active adventure
router.delete('/cancel/:character_id', (req, res) => {
  try {
    const character_id = req.params.character_id;

    // Find active or completed adventure
    const adventure = db.prepare(
      'SELECT * FROM adventures WHERE character_id = ? AND (status = ? OR status = ?) ORDER BY start_time DESC LIMIT 1'
    ).get(character_id, 'active', 'completed');

    if (!adventure) {
      return res.status(404).json({ error: 'No active adventure to cancel' });
    }

    // Mark adventure as cancelled
    db.prepare('UPDATE adventures SET status = ? WHERE id = ?').run('cancelled', adventure.id);

    res.json({ message: 'Adventure cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling adventure:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get adventure history for a character
router.get('/history/:character_id', (req, res) => {
  try {
    const adventures = db.prepare(
      'SELECT * FROM adventures WHERE character_id = ? ORDER BY start_time DESC LIMIT 20'
    ).all(req.params.character_id);

    res.json(adventures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear adventure history for a character
router.delete('/clear-history/:character_id', (req, res) => {
  try {
    const character_id = req.params.character_id;

    // Delete all adventures for this character
    const result = db.prepare('DELETE FROM adventures WHERE character_id = ?').run(character_id);

    res.json({
      message: 'Adventure history cleared successfully',
      deleted_count: result.changes
    });
  } catch (error) {
    console.error('Error clearing adventure history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to process adventure completion
async function processAdventureCompletion(adventure, character) {
  const timeMultiplier = getTimeMultiplier(adventure.duration_hours);
  const success = determineSuccess(adventure.risk_level);

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

  // Generate narrative
  const narrative = await generateAdventureNarrative(
    adventure,
    character,
    success,
    rewards,
    consequences
  );

  const results = {
    success,
    rewards,
    consequences,
    narrative
  };

  // Update adventure with results
  db.prepare(`
    UPDATE adventures
    SET status = ?, results = ?, rewards = ?, consequences = ?
    WHERE id = ?
  `).run(
    'completed',
    JSON.stringify(results),
    JSON.stringify(rewards),
    JSON.stringify(consequences),
    adventure.id
  );

  return results;
}

export default router;
