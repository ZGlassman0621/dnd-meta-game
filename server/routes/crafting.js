/**
 * Crafting Routes
 *
 * API endpoints for the crafting system: recipes, materials, projects.
 */

import express from 'express';
import * as craftingService from '../services/craftingService.js';
import { dbGet } from '../database.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

// ============================================================
// RECIPES
// ============================================================

/**
 * Get available recipes for a character (default + discovered)
 * GET /api/crafting/:characterId/recipes
 */
router.get('/:characterId/recipes', async (req, res) => {
  try {
    await craftingService.ensureDefaultRecipes();

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const recipes = await craftingService.getAvailableRecipes(parseInt(req.params.characterId));
    res.json(recipes);
  } catch (err) {
    handleServerError(res, err, 'fetch recipes');
  }
});

/**
 * Get a single recipe by ID
 * GET /api/crafting/recipes/:recipeId
 */
router.get('/recipes/:recipeId', async (req, res) => {
  try {
    const recipe = await craftingService.getRecipeById(parseInt(req.params.recipeId));
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json(recipe);
  } catch (err) {
    handleServerError(res, err, 'fetch recipe');
  }
});

/**
 * Discover a recipe
 * POST /api/crafting/:characterId/discover-recipe
 */
router.post('/:characterId/discover-recipe', async (req, res) => {
  try {
    const { recipe_name, method, game_day } = req.body;

    if (!recipe_name) {
      return res.status(400).json({ error: 'recipe_name is required' });
    }

    const result = await craftingService.discoverRecipe(
      parseInt(req.params.characterId),
      recipe_name,
      method || 'found',
      game_day
    );

    if (result.error) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (err) {
    handleServerError(res, err, 'discover recipe');
  }
});

// ============================================================
// MATERIALS
// ============================================================

/**
 * Get all materials for a character
 * GET /api/crafting/:characterId/materials
 */
router.get('/:characterId/materials', async (req, res) => {
  try {
    const materials = await craftingService.getMaterials(parseInt(req.params.characterId));
    res.json(materials);
  } catch (err) {
    handleServerError(res, err, 'fetch materials');
  }
});

/**
 * Add material to character's inventory
 * POST /api/crafting/:characterId/materials/add
 */
router.post('/:characterId/materials/add', async (req, res) => {
  try {
    const { name, quantity, quality, source, game_day, value_gp } = req.body;

    if (!name || !quantity) {
      return res.status(400).json({ error: 'name and quantity are required' });
    }

    const result = await craftingService.addMaterial(
      parseInt(req.params.characterId),
      name,
      parseInt(quantity),
      quality || 'standard',
      source || 'found',
      game_day,
      value_gp || 0
    );

    res.status(201).json(result);
  } catch (err) {
    handleServerError(res, err, 'add material');
  }
});

/**
 * Remove material from character's inventory
 * POST /api/crafting/:characterId/materials/remove
 */
router.post('/:characterId/materials/remove', async (req, res) => {
  try {
    const { name, quantity } = req.body;

    if (!name || !quantity) {
      return res.status(400).json({ error: 'name and quantity are required' });
    }

    const result = await craftingService.removeMaterial(
      parseInt(req.params.characterId),
      name,
      parseInt(quantity)
    );

    if (result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'remove material');
  }
});

// ============================================================
// PROJECTS
// ============================================================

/**
 * Get crafting projects for a character
 * GET /api/crafting/:characterId/projects
 */
router.get('/:characterId/projects', async (req, res) => {
  try {
    const { status } = req.query;
    const projects = await craftingService.getProjectStatus(
      parseInt(req.params.characterId), status
    );
    res.json(projects);
  } catch (err) {
    handleServerError(res, err, 'fetch projects');
  }
});

/**
 * Start a new crafting project
 * POST /api/crafting/:characterId/start
 */
router.post('/:characterId/start', async (req, res) => {
  try {
    const { recipe_id, campaign_id, game_day } = req.body;

    if (!recipe_id) {
      return res.status(400).json({ error: 'recipe_id is required' });
    }

    const result = await craftingService.startProject(
      parseInt(req.params.characterId),
      parseInt(recipe_id),
      campaign_id,
      game_day
    );

    if (result.error) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (err) {
    handleServerError(res, err, 'start crafting project');
  }
});

/**
 * Advance a crafting project (add hours)
 * POST /api/crafting/projects/:projectId/advance
 */
router.post('/projects/:projectId/advance', async (req, res) => {
  try {
    const { hours } = req.body;

    if (!hours || hours <= 0) {
      return res.status(400).json({ error: 'hours must be a positive number' });
    }

    const result = await craftingService.advanceProject(
      parseInt(req.params.projectId),
      parseFloat(hours)
    );

    if (result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'advance project');
  }
});

/**
 * Complete a crafting project (attempt final check)
 * POST /api/crafting/projects/:projectId/complete
 */
router.post('/projects/:projectId/complete', async (req, res) => {
  try {
    const { game_day } = req.body;

    const result = await craftingService.completeProject(
      parseInt(req.params.projectId),
      game_day
    );

    if (result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'complete project');
  }
});

/**
 * Abandon a crafting project
 * POST /api/crafting/projects/:projectId/abandon
 */
router.post('/projects/:projectId/abandon', async (req, res) => {
  try {
    const result = await craftingService.abandonProject(
      parseInt(req.params.projectId)
    );

    if (result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'abandon project');
  }
});

/**
 * Get foraging possibilities for current location/conditions
 * GET /api/crafting/:characterId/foraging
 */
router.get('/:characterId/foraging', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.characterId]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const { getSeason } = await import('../config/harptos.js');
    const season = getSeason(character.game_day);

    let weatherType = 'clear';
    if (character.campaign_id) {
      const { getWeather } = await import('../services/weatherService.js');
      const weather = await getWeather(character.campaign_id);
      weatherType = weather.weather_type;
    }

    const results = craftingService.checkForagingResults(
      character.level, character.current_location, season, weatherType
    );

    res.json(results);
  } catch (err) {
    handleServerError(res, err, 'check foraging');
  }
});

export default router;
