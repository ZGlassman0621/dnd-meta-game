/**
 * Survival Routes
 *
 * API endpoints for survival mechanics: hunger, thirst, exposure, foraging.
 */

import express from 'express';
import * as survivalService from '../services/survivalService.js';
import * as weatherService from '../services/weatherService.js';
import { getSeason, getTimeOfDay } from '../config/harptos.js';
import { dbGet } from '../database.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

/**
 * Get survival status for a character
 * GET /api/survival/:characterId
 */
router.get('/:characterId', async (req, res) => {
  try {
    const { characterId } = req.params;
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get weather for context
    let weather = null;
    if (character.campaign_id) {
      weather = await weatherService.getWeather(character.campaign_id);
    }

    const status = survivalService.getSurvivalStatus(character, weather);
    res.json(status);
  } catch (err) {
    handleServerError(res, err, 'fetch survival status');
  }
});

/**
 * Manually consume food
 * POST /api/survival/:characterId/eat
 */
router.post('/:characterId/eat', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { item_name } = req.body;

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    if (!item_name) {
      return res.status(400).json({ error: 'item_name is required' });
    }

    const result = await survivalService.consumeFood(
      parseInt(characterId), item_name, character.game_day
    );

    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'consume food');
  }
});

/**
 * Manually consume water
 * POST /api/survival/:characterId/drink
 */
router.post('/:characterId/drink', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { item_name } = req.body;

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    if (!item_name) {
      return res.status(400).json({ error: 'item_name is required' });
    }

    const result = await survivalService.consumeWater(
      parseInt(characterId), item_name, character.game_day
    );

    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'consume water');
  }
});

/**
 * Auto-consume rations (called during rest)
 * POST /api/survival/:characterId/auto-consume
 */
router.post('/:characterId/auto-consume', async (req, res) => {
  try {
    const { characterId } = req.params;
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const result = await survivalService.autoConsumeRations(
      parseInt(characterId), character.game_day
    );

    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'auto-consume rations');
  }
});

/**
 * Get foraging difficulty for character's current location
 * GET /api/survival/:characterId/forage-dc
 */
router.get('/:characterId/forage-dc', async (req, res) => {
  try {
    const { characterId } = req.params;
    const character = await dbGet(
      'SELECT current_location, game_day FROM characters WHERE id = ?',
      [characterId]
    );

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const dc = survivalService.getForageDC(character.current_location);
    const season = getSeason(character.game_day);

    res.json({
      location: character.current_location,
      base_dc: dc,
      season,
      season_note: season === 'winter' ? 'Foraging is much harder in winter (+5 DC)' : null
    });
  } catch (err) {
    handleServerError(res, err, 'get forage DC');
  }
});

/**
 * Process day change survival check (usually called internally)
 * POST /api/survival/:characterId/day-change
 */
router.post('/:characterId/day-change', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { game_day } = req.body;

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const currentGameDay = game_day || character.game_day;

    let weather = null;
    if (character.campaign_id) {
      weather = await weatherService.getWeather(character.campaign_id);
    }

    const result = await survivalService.processDayChange(
      parseInt(characterId), currentGameDay, weather
    );

    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'process survival day change');
  }
});

export default router;
