/**
 * Meta Game Routes - Intelligent Campaign Management API
 *
 * Provides endpoints for:
 * - Campaign context aggregation
 * - Activity scheduling and queuing
 * - Time ratio management
 * - Intelligent activity suggestions
 */

import express from 'express';
import { dbAll, dbGet, dbRun } from '../database.js';
import {
  TIME_RATIOS,
  aggregateCampaignContext,
  generateActivitySuggestions,
  calculateElapsedGameTime,
  getNextEvent,
  setTimeRatio,
  advanceGameTime,
  dayToHarptosDate,
  getTimeOfDay,
  formatGameTime
} from '../services/metaGame.js';
import { processCharacterTimeAdvance, getCharacterWorldView } from '../services/livingWorldService.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

/**
 * GET /api/meta-game/context/:characterId
 * Get full campaign context for a character
 */
router.get('/context/:characterId', async (req, res) => {
  try {
    const context = await aggregateCampaignContext(req.params.characterId);
    res.json(context);
  } catch (error) {
    handleServerError(res, error, 'get campaign context');
  }
});

/**
 * GET /api/meta-game/suggestions/:characterId
 * Get AI-suggested activities based on campaign state
 */
router.get('/suggestions/:characterId', async (req, res) => {
  try {
    const suggestions = await generateActivitySuggestions(req.params.characterId);
    res.json(suggestions);
  } catch (error) {
    handleServerError(res, error, 'generate suggestions');
  }
});

/**
 * GET /api/meta-game/status/:characterId
 * Get current activity status and next event timing
 */
router.get('/status/:characterId', async (req, res) => {
  try {
    const nextEvent = await getNextEvent(req.params.characterId);
    const context = await aggregateCampaignContext(req.params.characterId);

    res.json({
      ...nextEvent,
      calendar: context.calendar,
      character: {
        name: context.character.name,
        currentLocation: context.character.currentLocation,
        healthPercent: Math.round((context.character.currentHp / context.character.maxHp) * 100),
        gold: context.character.gold.gp
      },
      companions: context.companions.length,
      timeRatio: TIME_RATIOS[context.calendar.timeRatio] || TIME_RATIOS.normal
    });
  } catch (error) {
    handleServerError(res, error, 'get status');
  }
});

/**
 * GET /api/meta-game/time-ratios
 * Get available time ratio presets
 */
router.get('/time-ratios', (req, res) => {
  res.json(TIME_RATIOS);
});

/**
 * PUT /api/meta-game/time-ratio/:characterId
 * Set the time ratio for a character's campaign
 */
router.put('/time-ratio/:characterId', async (req, res) => {
  try {
    const { ratio } = req.body;
    if (!ratio) {
      return res.status(400).json({ error: 'ratio is required' });
    }

    const result = await setTimeRatio(req.params.characterId, ratio);
    res.json(result);
  } catch (error) {
    handleServerError(res, error, 'set time ratio');
  }
});

/**
 * GET /api/meta-game/queue/:characterId
 * Get the activity queue for a character
 */
router.get('/queue/:characterId', async (req, res) => {
  try {
    const queue = await dbAll(`
      SELECT * FROM activity_queue
      WHERE character_id = ? AND status IN ('pending', 'active')
      ORDER BY queue_order ASC
    `, [req.params.characterId]);

    res.json({
      queue,
      count: queue.length
    });
  } catch (error) {
    // Table might not exist yet
    if (error.message.includes('no such table')) {
      res.json({ queue: [], count: 0 });
    } else {
      handleServerError(res, error, 'get queue');
    }
  }
});

/**
 * POST /api/meta-game/queue/:characterId
 * Add an activity to the queue
 */
router.post('/queue/:characterId', async (req, res) => {
  try {
    const { activityType, durationHours, options } = req.body;

    if (!activityType || !durationHours) {
      return res.status(400).json({ error: 'activityType and durationHours are required' });
    }

    // Get current queue length for ordering
    const existing = await dbAll(`
      SELECT queue_order FROM activity_queue
      WHERE character_id = ? AND status IN ('pending', 'active')
      ORDER BY queue_order DESC
      LIMIT 1
    `, [req.params.characterId]).catch(() => []);

    const nextOrder = (existing[0]?.queue_order || 0) + 1;

    const result = await dbRun(`
      INSERT INTO activity_queue (character_id, activity_type, duration_hours, options, queue_order, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [req.params.characterId, activityType, durationHours, JSON.stringify(options || {}), nextOrder]);

    const newItem = await dbGet('SELECT * FROM activity_queue WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({
      message: 'Activity added to queue',
      item: newItem
    });
  } catch (error) {
    // Table might not exist - create it
    if (error.message.includes('no such table')) {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS activity_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          character_id INTEGER NOT NULL,
          activity_type TEXT NOT NULL,
          duration_hours INTEGER NOT NULL,
          options TEXT DEFAULT '{}',
          queue_order INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          started_at DATETIME,
          completed_at DATETIME,
          results TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (character_id) REFERENCES characters(id)
        )
      `);
      // Retry the insert
      return router.handle(req, res);
    }
    handleServerError(res, error, 'add to queue');
  }
});

/**
 * DELETE /api/meta-game/queue/:characterId/:queueId
 * Remove an activity from the queue
 */
router.delete('/queue/:characterId/:queueId', async (req, res) => {
  try {
    const item = await dbGet(`
      SELECT * FROM activity_queue
      WHERE id = ? AND character_id = ?
    `, [req.params.queueId, req.params.characterId]);

    if (!item) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    if (item.status === 'active') {
      return res.status(400).json({ error: 'Cannot remove an active activity' });
    }

    await dbRun('DELETE FROM activity_queue WHERE id = ?', [req.params.queueId]);

    res.json({ message: 'Activity removed from queue' });
  } catch (error) {
    handleServerError(res, error, 'remove from queue');
  }
});

/**
 * POST /api/meta-game/queue/:characterId/reorder
 * Reorder activities in the queue
 */
router.post('/queue/:characterId/reorder', async (req, res) => {
  try {
    const { order } = req.body; // Array of queue IDs in desired order

    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order must be an array of queue IDs' });
    }

    for (let i = 0; i < order.length; i++) {
      await dbRun(`
        UPDATE activity_queue
        SET queue_order = ?
        WHERE id = ? AND character_id = ? AND status = 'pending'
      `, [i + 1, order[i], req.params.characterId]);
    }

    const queue = await dbAll(`
      SELECT * FROM activity_queue
      WHERE character_id = ? AND status IN ('pending', 'active')
      ORDER BY queue_order ASC
    `, [req.params.characterId]);

    res.json({ queue });
  } catch (error) {
    handleServerError(res, error, 'reorder queue');
  }
});

/**
 * POST /api/meta-game/process/:characterId
 * Process elapsed time and advance any completed activities
 * This is the main "tick" function that moves time forward
 */
router.post('/process/:characterId', async (req, res) => {
  try {
    const characterId = req.params.characterId;
    const context = await aggregateCampaignContext(characterId);
    const timeRatio = context.calendar.timeRatio || 'normal';

    const results = {
      processed: [],
      currentActivity: null,
      newGameDate: null,
      events: []
    };

    // Check for completed downtime
    const activeDowntime = await dbGet(`
      SELECT * FROM downtime
      WHERE character_id = ? AND status = 'active'
      ORDER BY start_time DESC
      LIMIT 1
    `, [characterId]);

    if (activeDowntime) {
      const now = new Date();
      const endTime = new Date(activeDowntime.end_time);

      if (now >= endTime) {
        results.processed.push({
          type: 'downtime',
          activityType: activeDowntime.activity_type,
          status: 'completed',
          message: `${activeDowntime.activity_type} activity completed. Claim your rewards!`
        });
      } else {
        results.currentActivity = {
          type: 'downtime',
          activityType: activeDowntime.activity_type,
          remainingMs: endTime - now
        };
      }
    }

    // Check for completed adventure
    const activeAdventure = await dbGet(`
      SELECT * FROM adventures
      WHERE character_id = ? AND status = 'active'
      ORDER BY start_time DESC
      LIMIT 1
    `, [characterId]);

    if (activeAdventure) {
      const now = new Date();
      const endTime = new Date(activeAdventure.end_time);

      if (now >= endTime) {
        results.processed.push({
          type: 'adventure',
          title: activeAdventure.title,
          status: 'completed',
          message: `Adventure "${activeAdventure.title}" completed. View results!`
        });
      } else {
        results.currentActivity = {
          type: 'adventure',
          title: activeAdventure.title,
          remainingMs: endTime - now
        };
      }
    }

    // Process the activity queue if nothing is active
    if (!results.currentActivity && !activeDowntime && !activeAdventure) {
      const nextInQueue = await dbGet(`
        SELECT * FROM activity_queue
        WHERE character_id = ? AND status = 'pending'
        ORDER BY queue_order ASC
        LIMIT 1
      `, [characterId]).catch(() => null);

      if (nextInQueue) {
        // Start the next queued activity
        const now = new Date();
        const durationMs = nextInQueue.duration_hours * 60 * 60 * 1000;
        const endTime = new Date(now.getTime() + durationMs);

        await dbRun(`
          UPDATE activity_queue
          SET status = 'active', started_at = ?
          WHERE id = ?
        `, [now.toISOString(), nextInQueue.id]);

        results.events.push({
          type: 'queue_started',
          message: `Started queued activity: ${nextInQueue.activity_type}`,
          endsAt: endTime.toISOString()
        });
      }
    }

    // Calculate game time advancement based on real time elapsed
    // This would typically compare to a "last processed" timestamp
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    const currentHour = character.game_hour ?? 8;
    results.newGameDate = {
      ...dayToHarptosDate(character.game_day || 1, character.game_year || 1492),
      hour: currentHour,
      timeOfDay: getTimeOfDay(currentHour),
      formattedTime: formatGameTime(currentHour)
    };

    res.json(results);
  } catch (error) {
    handleServerError(res, error, 'process meta game');
  }
});

/**
 * POST /api/meta-game/advance-time/:characterId
 * Manually advance in-game time (for montage/time skip scenarios)
 * Also triggers living world tick to advance factions and events
 */
router.post('/advance-time/:characterId', async (req, res) => {
  try {
    const { hours, days } = req.body;

    if (!hours && !days) {
      return res.status(400).json({ error: 'hours or days required' });
    }

    const totalHours = (hours || 0) + (days || 0) * 24;

    const character = await dbGet('SELECT game_day, game_year, game_hour FROM characters WHERE id = ?', [req.params.characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const currentDay = character.game_day || 1;
    const currentYear = character.game_year || 1492;
    const currentHour = character.game_hour ?? 8;

    const newTime = advanceGameTime(currentDay, currentYear, currentHour, totalHours);

    await dbRun(`
      UPDATE characters
      SET game_day = ?, game_year = ?, game_hour = ?
      WHERE id = ?
    `, [newTime.day, newTime.year, newTime.hour, req.params.characterId]);

    const newDate = dayToHarptosDate(newTime.day, newTime.year);

    // Process living world tick (faction goals, world events)
    let livingWorldResults = null;
    try {
      livingWorldResults = await processCharacterTimeAdvance(req.params.characterId, totalHours);
    } catch (worldError) {
      console.error('Living world tick error (non-fatal):', worldError);
      // Continue even if living world tick fails
    }

    res.json({
      advanced: {
        hours: totalHours,
        days: Math.floor(totalHours / 24)
      },
      newDate: {
        ...newDate,
        hour: newTime.hour,
        timeOfDay: getTimeOfDay(newTime.hour),
        formattedTime: formatGameTime(newTime.hour)
      },
      livingWorld: livingWorldResults
    });
  } catch (error) {
    handleServerError(res, error, 'advance time');
  }
});

/**
 * GET /api/meta-game/calendar/:characterId
 * Get current in-game date and calendar info
 */
router.get('/calendar/:characterId', async (req, res) => {
  try {
    const character = await dbGet('SELECT game_day, game_year, game_hour, campaign_config FROM characters WHERE id = ?', [req.params.characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    let campaignConfig = {};
    try {
      campaignConfig = JSON.parse(character.campaign_config || '{}');
    } catch (e) {
      campaignConfig = {};
    }

    const currentDate = dayToHarptosDate(character.game_day || 1, character.game_year || 1492);
    const timeRatio = TIME_RATIOS[campaignConfig.timeRatio || 'normal'];
    const currentHour = character.game_hour ?? 8;

    res.json({
      currentDay: character.game_day || 1,
      currentYear: character.game_year || 1492,
      currentHour,
      timeOfDay: getTimeOfDay(currentHour),
      formattedTime: formatGameTime(currentHour),
      ...currentDate,
      timeRatio: {
        key: campaignConfig.timeRatio || 'normal',
        ...timeRatio
      }
    });
  } catch (error) {
    handleServerError(res, error, 'get calendar');
  }
});

/**
 * POST /api/meta-game/quick-activities/:characterId
 * Start a batch of activities in sequence (convenience endpoint)
 * Example: "rest for 8 hours, then work for 4 hours"
 */
router.post('/quick-activities/:characterId', async (req, res) => {
  try {
    const { activities } = req.body;

    if (!Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({ error: 'activities array is required' });
    }

    // Validate all activities first
    const validTypes = ['rest', 'pray', 'train', 'study', 'craft', 'work', 'socialize', 'carouse', 'maintain', 'adventure'];
    for (const activity of activities) {
      if (!validTypes.includes(activity.type)) {
        return res.status(400).json({ error: `Invalid activity type: ${activity.type}` });
      }
      if (!activity.hours || activity.hours < 1) {
        return res.status(400).json({ error: 'Each activity requires hours >= 1' });
      }
    }

    // Ensure queue table exists
    await dbRun(`
      CREATE TABLE IF NOT EXISTS activity_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        activity_type TEXT NOT NULL,
        duration_hours INTEGER NOT NULL,
        options TEXT DEFAULT '{}',
        queue_order INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        started_at DATETIME,
        completed_at DATETIME,
        results TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(id)
      )
    `);

    // Get current max queue order
    const existing = await dbAll(`
      SELECT queue_order FROM activity_queue
      WHERE character_id = ? AND status IN ('pending', 'active')
      ORDER BY queue_order DESC
      LIMIT 1
    `, [req.params.characterId]).catch(() => []);

    let nextOrder = (existing[0]?.queue_order || 0) + 1;

    // Add all activities to queue
    const added = [];
    for (const activity of activities) {
      const result = await dbRun(`
        INSERT INTO activity_queue (character_id, activity_type, duration_hours, options, queue_order, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `, [req.params.characterId, activity.type, activity.hours, JSON.stringify(activity.options || {}), nextOrder]);

      added.push({
        id: result.lastInsertRowid,
        type: activity.type,
        hours: activity.hours,
        order: nextOrder
      });

      nextOrder++;
    }

    res.status(201).json({
      message: `Added ${added.length} activities to queue`,
      activities: added,
      totalHours: activities.reduce((sum, a) => sum + a.hours, 0)
    });
  } catch (error) {
    handleServerError(res, error, 'add quick activities');
  }
});

/**
 * GET /api/meta-game/world-view/:characterId
 * Get the living world state visible to a character
 * Includes visible events, faction standings, and known faction goals
 */
router.get('/world-view/:characterId', async (req, res) => {
  try {
    const worldView = await getCharacterWorldView(req.params.characterId);
    if (!worldView) {
      return res.status(404).json({ error: 'Character not found or has no campaign' });
    }
    res.json(worldView);
  } catch (error) {
    handleServerError(res, error, 'get world view');
  }
});

export default router;
