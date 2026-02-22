/**
 * Achievement Routes
 *
 * API endpoints for querying character achievements and progress.
 */

import express from 'express';
import * as achievementService from '../services/achievementService.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

// GET /api/achievement/character/:characterId - earned achievements
router.get('/character/:characterId', async (req, res) => {
  try {
    const achievements = await achievementService.getCharacterAchievements(req.params.characterId);
    res.json(achievements);
  } catch (error) {
    handleServerError(res, error, 'fetch character achievements');
  }
});

// GET /api/achievement/character/:characterId/progress - all with progress
router.get('/character/:characterId/progress', async (req, res) => {
  try {
    const achievements = await achievementService.getAchievementsWithProgress(req.params.characterId);
    res.json(achievements);
  } catch (error) {
    handleServerError(res, error, 'fetch achievement progress');
  }
});

// GET /api/achievement/recent/:characterId - recently earned unnotified
router.get('/recent/:characterId', async (req, res) => {
  try {
    const achievements = await achievementService.getRecentAchievements(req.params.characterId);
    res.json(achievements);
  } catch (error) {
    handleServerError(res, error, 'fetch recent achievements');
  }
});

// POST /api/achievement/:characterId/acknowledge - mark as notified
router.post('/:characterId/acknowledge', async (req, res) => {
  try {
    const count = await achievementService.acknowledgeAchievements(req.params.characterId);
    res.json({ success: true, acknowledged: count });
  } catch (error) {
    handleServerError(res, error, 'acknowledge achievements');
  }
});

export default router;
