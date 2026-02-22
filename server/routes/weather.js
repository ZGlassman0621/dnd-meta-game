/**
 * Weather Routes
 *
 * API endpoints for weather state management.
 */

import express from 'express';
import * as weatherService from '../services/weatherService.js';
import { getSeason, getTimeOfDay } from '../config/harptos.js';
import { SEASON_BASE_TEMP, REGION_TEMP_MOD } from '../config/weather.js';
import { dbGet } from '../database.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

/**
 * Get current weather for a campaign
 * GET /api/weather/:campaignId
 */
router.get('/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const weather = await weatherService.getWeather(parseInt(campaignId));

    // Get character for time context
    const character = await dbGet(
      'SELECT game_day, game_year, game_hour FROM characters WHERE campaign_id = ? LIMIT 1',
      [campaignId]
    );

    let effectiveTemp = weather.temperature_f;
    let timeOfDay = 'midday';
    let season = 'summer';

    if (character) {
      season = getSeason(character.game_day);
      timeOfDay = getTimeOfDay(character.game_hour);
      effectiveTemp = weatherService.getEffectiveTemperature(
        weather.temperature_f, weather.weather_type, timeOfDay
      );
    }

    res.json({
      ...weather,
      effective_temperature: effectiveTemp,
      time_of_day: timeOfDay,
      season
    });
  } catch (err) {
    handleServerError(res, err, 'fetch weather');
  }
});

/**
 * Get weather with full context (gear warmth, shelter, exposure)
 * GET /api/weather/:campaignId/full/:characterId
 */
router.get('/:campaignId/full/:characterId', async (req, res) => {
  try {
    const { campaignId, characterId } = req.params;

    const weather = await weatherService.getWeather(parseInt(campaignId));
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const season = getSeason(character.game_day);
    const timeOfDay = getTimeOfDay(character.game_hour);
    const effectiveTemp = weatherService.getEffectiveTemperature(
      weather.temperature_f, weather.weather_type, timeOfDay
    );
    const gearWarmth = weatherService.calculateGearWarmth(character.inventory, character.equipment);
    const shelterType = weatherService.hasShelter(character.current_location, character.inventory);
    const exposure = weatherService.checkExposureEffects(effectiveTemp, gearWarmth.totalWarmth, shelterType !== 'none');

    res.json({
      weather: {
        ...weather,
        effective_temperature: effectiveTemp,
        time_of_day: timeOfDay,
        season
      },
      gear_warmth: gearWarmth,
      shelter_type: shelterType,
      exposure
    });
  } catch (err) {
    handleServerError(res, err, 'fetch full weather context');
  }
});

/**
 * Force a weather change (for testing or DM override)
 * POST /api/weather/:campaignId/set
 */
router.post('/:campaignId/set', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { weather_type, duration_hours, game_day } = req.body;

    if (!weather_type) {
      return res.status(400).json({ error: 'weather_type is required' });
    }

    const character = await dbGet(
      'SELECT game_day FROM characters WHERE campaign_id = ? LIMIT 1',
      [campaignId]
    );
    const currentGameDay = game_day || character?.game_day || 1;
    const season = getSeason(currentGameDay);

    const updated = await weatherService.setWeather(
      parseInt(campaignId), weather_type, duration_hours || 24, currentGameDay, season
    );

    res.json(updated);
  } catch (err) {
    handleServerError(res, err, 'set weather');
  }
});

/**
 * Roll new random weather
 * POST /api/weather/:campaignId/roll
 */
router.post('/:campaignId/roll', async (req, res) => {
  try {
    const { campaignId } = req.params;

    const weather = await weatherService.getWeather(parseInt(campaignId));
    const character = await dbGet(
      'SELECT game_day FROM characters WHERE campaign_id = ? LIMIT 1',
      [campaignId]
    );

    const season = getSeason(character?.game_day || 1);
    const newWeather = weatherService.rollNewWeather(season, weather.region_type || 'temperate');

    const updated = await weatherService.setWeather(
      parseInt(campaignId), newWeather.weather_type,
      newWeather.weather_duration_hours,
      character?.game_day || 1, season
    );

    res.json({ previous: weather, current: updated });
  } catch (err) {
    handleServerError(res, err, 'roll weather');
  }
});

export default router;
