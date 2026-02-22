/**
 * Crafting Service — Manages recipes, materials, and crafting projects for D&D 5e.
 *
 * Handles the full crafting lifecycle: recipe discovery, material management,
 * project creation, progress tracking, completion with ability checks, and
 * foraging results. Integrates with the DM prompt builder for session context.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { DEFAULT_RECIPES } from '../data/craftingRecipes.js';

// ============================================================
// HELPERS
// ============================================================

/**
 * Map long ability names to short DB keys.
 * Recipes use 'strength', 'dexterity', etc. but DB stores { str, dex, con, int, wis, cha }.
 */
const ABILITY_SHORT_KEYS = {
  strength: 'str', dexterity: 'dex', constitution: 'con',
  intelligence: 'int', wisdom: 'wis', charisma: 'cha'
};

/**
 * Compute ability modifier from an ability score.
 * @param {object} abilityScores - e.g. { str: 16, dex: 14, ... }
 * @param {string} ability - Ability name: 'strength' or 'str' (both supported)
 * @returns {number} The modifier (e.g. 16 -> +3)
 */
function getAbilityMod(abilityScores, ability) {
  const key = ABILITY_SHORT_KEYS[ability] || ability;
  const score = abilityScores?.[key] ?? 10;
  return Math.floor((score - 10) / 2);
}

/**
 * Calculate proficiency bonus from character level.
 * D&D 5e: levels 1-4 = +2, 5-8 = +3, 9-12 = +4, 13-16 = +5, 17-20 = +6
 * @param {number} level
 * @returns {number}
 */
function getProficiencyBonus(level) {
  return Math.ceil((level || 1) / 4) + 1;
}

/**
 * Simulate a d20 roll.
 * @returns {number} 1-20
 */
function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

/**
 * Return half of a materials array (rounded down per item), for partial refunds.
 * @param {Array} materials - Array of { name, quantity } objects
 * @returns {Array} Materials with halved quantities (items with 0 excluded)
 */
function halfMaterials(materials) {
  if (!Array.isArray(materials)) return [];
  return materials
    .map(m => ({ name: m.name, quantity: Math.floor((m.quantity || 0) / 2) }))
    .filter(m => m.quantity > 0);
}

// ============================================================
// 1. ENSURE DEFAULT RECIPES
// ============================================================

/**
 * Seed the crafting_recipes table with default recipes.
 * Uses INSERT OR IGNORE with the unique name index so new recipes
 * are added incrementally without duplicating existing ones.
 */
export async function ensureDefaultRecipes() {
  const existing = await dbGet('SELECT COUNT(*) as count FROM crafting_recipes WHERE is_default = 1');
  if (existing && existing.count >= DEFAULT_RECIPES.length) return;

  console.log(`[CraftingService] Seeding ${DEFAULT_RECIPES.length} default recipes...`);

  for (const recipe of DEFAULT_RECIPES) {
    await dbRun(`
      INSERT OR IGNORE INTO crafting_recipes
        (name, category, description, required_materials, required_tools,
         required_proficiency, craft_time_hours, difficulty_dc, ability_check,
         output_item, output_quantity, level_requirement, gold_cost,
         is_default, rarity, source_hint, weather_requirement, season_requirement)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      recipe.name,
      recipe.category,
      recipe.description,
      recipe.required_materials,
      recipe.required_tools,
      recipe.required_proficiency,
      recipe.craft_time_hours,
      recipe.difficulty_dc,
      recipe.ability_check,
      recipe.output_item,
      recipe.output_quantity ?? 1,
      recipe.level_requirement ?? 1,
      recipe.gold_cost ?? 0,
      recipe.is_default ?? 1,
      recipe.rarity ?? 'common',
      recipe.source_hint ?? null,
      recipe.weather_requirement ?? null,
      recipe.season_requirement ?? null
    ]);
  }

  console.log(`[CraftingService] Seeded ${DEFAULT_RECIPES.length} default recipe(s).`);
}

// ============================================================
// 2. GET AVAILABLE RECIPES
// ============================================================

/**
 * Get all recipes a character can potentially use.
 * Merges default recipes with character-discovered recipes, deduplicates,
 * and checks material/tool availability for each.
 *
 * @param {number} characterId
 * @returns {Promise<Array>} Enriched recipe objects with canCraft, missingMaterials, missingTools
 */
export async function getAvailableRecipes(characterId) {
  // Ensure defaults are loaded
  await ensureDefaultRecipes();

  // Get all default recipes
  const defaultRecipes = await dbAll(
    'SELECT * FROM crafting_recipes WHERE is_default = 1'
  );

  // Get character's discovered recipes (non-default)
  const discoveredRecipes = await dbAll(`
    SELECT cr.*
    FROM character_recipes chr
    JOIN crafting_recipes cr ON chr.recipe_id = cr.id
    WHERE chr.character_id = ?
  `, [characterId]);

  // Merge and deduplicate by recipe id
  const recipeMap = new Map();
  for (const r of defaultRecipes) recipeMap.set(r.id, r);
  for (const r of discoveredRecipes) recipeMap.set(r.id, r);
  const allRecipes = Array.from(recipeMap.values());

  // Get character's materials and tool proficiencies for availability check
  const materials = await dbAll(
    'SELECT material_name, SUM(quantity) as total FROM character_materials WHERE character_id = ? GROUP BY material_name',
    [characterId]
  );
  const materialMap = new Map(materials.map(m => [m.material_name, m.total]));

  const character = await dbGet(
    'SELECT tool_proficiencies FROM characters WHERE id = ?',
    [characterId]
  );
  const toolProfs = safeParse(character?.tool_proficiencies, []);

  // Enrich each recipe
  return allRecipes.map(recipe => {
    const reqMaterials = safeParse(recipe.required_materials, []);
    const reqTools = safeParse(recipe.required_tools, []);

    // Check which materials are missing
    const missingMaterials = [];
    for (const mat of reqMaterials) {
      const have = materialMap.get(mat.name) || 0;
      if (have < mat.quantity) {
        missingMaterials.push({ name: mat.name, need: mat.quantity, have });
      }
    }

    // Check which tools are missing from proficiencies
    const missingTools = [];
    for (const tool of reqTools) {
      if (!toolProfs.includes(tool)) {
        missingTools.push(tool);
      }
    }

    const canCraft = missingMaterials.length === 0 && missingTools.length === 0;

    return {
      ...recipe,
      required_materials: reqMaterials,
      required_tools: reqTools,
      output_item: safeParse(recipe.output_item, {}),
      canCraft,
      missingMaterials,
      missingTools
    };
  });
}

// ============================================================
// 3. GET RECIPE BY ID
// ============================================================

/**
 * Look up a single recipe by its database ID.
 * @param {number} recipeId
 * @returns {Promise<object|null>}
 */
export async function getRecipeById(recipeId) {
  const recipe = await dbGet('SELECT * FROM crafting_recipes WHERE id = ?', [recipeId]);
  if (!recipe) return null;

  return {
    ...recipe,
    required_materials: safeParse(recipe.required_materials, []),
    required_tools: safeParse(recipe.required_tools, []),
    output_item: safeParse(recipe.output_item, {})
  };
}

// ============================================================
// 4. START PROJECT
// ============================================================

/**
 * Start a crafting project. Validates prerequisites, consumes materials
 * and gold, then creates the project row.
 *
 * @param {number} characterId
 * @param {number} recipeId
 * @param {number} campaignId
 * @param {number} gameDay - Current in-game day
 * @returns {Promise<object>} The project row or { error: string }
 */
export async function startProject(characterId, recipeId, campaignId, gameDay) {
  // Validate recipe exists
  const recipe = await getRecipeById(recipeId);
  if (!recipe) return { error: 'Recipe not found' };

  // Get character data
  const character = await dbGet(
    'SELECT id, level, tool_proficiencies, gold_gp FROM characters WHERE id = ?',
    [characterId]
  );
  if (!character) return { error: 'Character not found' };

  const toolProfs = safeParse(character.tool_proficiencies, []);

  // Check required proficiency
  if (recipe.required_proficiency && !toolProfs.includes(recipe.required_proficiency)) {
    return { error: `Requires proficiency with ${recipe.required_proficiency}` };
  }

  // Check level requirement
  if ((character.level || 1) < (recipe.level_requirement || 1)) {
    return { error: `Requires character level ${recipe.level_requirement} (you are level ${character.level || 1})` };
  }

  // Check gold
  const charGold = character.gold_gp || 0;
  const goldCost = recipe.gold_cost || 0;
  if (charGold < goldCost) {
    return { error: `Requires ${goldCost} gp (you have ${charGold} gp)` };
  }

  // Check materials
  const reqMaterials = recipe.required_materials; // already parsed by getRecipeById
  for (const mat of reqMaterials) {
    const available = await dbGet(
      'SELECT COALESCE(SUM(quantity), 0) as total FROM character_materials WHERE character_id = ? AND material_name = ?',
      [characterId, mat.name]
    );
    if ((available?.total || 0) < mat.quantity) {
      return { error: `Insufficient ${mat.name}: need ${mat.quantity}, have ${available?.total || 0}` };
    }
  }

  // --- All checks passed — consume resources ---

  // Consume materials (deplete from rows, delete if quantity reaches 0)
  for (const mat of reqMaterials) {
    let remaining = mat.quantity;

    // Get all rows for this material, ordered by oldest first (FIFO)
    const rows = await dbAll(
      'SELECT id, quantity FROM character_materials WHERE character_id = ? AND material_name = ? ORDER BY acquired_game_day ASC, id ASC',
      [characterId, mat.name]
    );

    for (const row of rows) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, row.quantity);
      const newQty = row.quantity - deduct;

      if (newQty <= 0) {
        await dbRun('DELETE FROM character_materials WHERE id = ?', [row.id]);
      } else {
        await dbRun('UPDATE character_materials SET quantity = ? WHERE id = ?', [newQty, row.id]);
      }
      remaining -= deduct;
    }
  }

  // Deduct gold
  if (goldCost > 0) {
    await dbRun(
      'UPDATE characters SET gold_gp = gold_gp - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [goldCost, characterId]
    );
  }

  // Create project
  const result = await dbRun(`
    INSERT INTO crafting_projects
      (character_id, recipe_id, campaign_id, status, hours_invested, hours_required,
       materials_consumed, gold_spent, started_game_day)
    VALUES (?, ?, ?, 'in_progress', 0, ?, ?, ?, ?)
  `, [
    characterId,
    recipeId,
    campaignId,
    recipe.craft_time_hours,
    JSON.stringify(reqMaterials),
    goldCost,
    gameDay
  ]);

  // Return the new project
  const project = await dbGet('SELECT * FROM crafting_projects WHERE id = ?', [result.lastInsertRowid]);
  return {
    ...project,
    materials_consumed: safeParse(project.materials_consumed, []),
    recipe_name: recipe.name
  };
}

// ============================================================
// 5. ADVANCE PROJECT
// ============================================================

/**
 * Add crafting hours to a project. Does not auto-complete; the player
 * must call completeProject() when ready.
 *
 * @param {number} projectId
 * @param {number} hours - Hours to add
 * @returns {Promise<object>} Project with ready_to_complete and progress_pct
 */
export async function advanceProject(projectId, hours) {
  const project = await dbGet('SELECT * FROM crafting_projects WHERE id = ?', [projectId]);
  if (!project) return { error: 'Project not found' };
  if (project.status !== 'in_progress') return { error: `Project is ${project.status}, cannot advance` };

  const newHours = (project.hours_invested || 0) + hours;

  await dbRun(
    'UPDATE crafting_projects SET hours_invested = ? WHERE id = ?',
    [newHours, projectId]
  );

  const readyToComplete = newHours >= project.hours_required;
  const progressPct = Math.min(100, Math.round((newHours / project.hours_required) * 100));

  return {
    id: project.id,
    recipe_id: project.recipe_id,
    hours_invested: newHours,
    hours_required: project.hours_required,
    ready_to_complete: readyToComplete,
    progress_pct: progressPct,
    status: project.status
  };
}

// ============================================================
// 6. COMPLETE PROJECT
// ============================================================

/**
 * Attempt to finish a crafting project via ability check.
 * Rolls d20 + ability mod + proficiency bonus (if proficient) vs DC.
 * On success: creates the output item with quality tier.
 * On failure: returns 50% of consumed materials.
 *
 * @param {number} projectId
 * @param {number} gameDay - Current in-game day
 * @returns {Promise<object>} Result with success, item/quality or materials_returned
 */
export async function completeProject(projectId, gameDay) {
  const project = await dbGet('SELECT * FROM crafting_projects WHERE id = ?', [projectId]);
  if (!project) return { error: 'Project not found' };
  if (project.status !== 'in_progress') return { error: `Project is ${project.status}, cannot complete` };
  if (project.hours_invested < project.hours_required) {
    return { error: `Not enough hours invested: ${project.hours_invested}/${project.hours_required}` };
  }

  // Load recipe and character
  const recipe = await getRecipeById(project.recipe_id);
  if (!recipe) return { error: 'Recipe no longer exists' };

  const character = await dbGet(
    'SELECT id, level, ability_scores, tool_proficiencies FROM characters WHERE id = ?',
    [project.character_id]
  );
  if (!character) return { error: 'Character not found' };

  const abilityScores = safeParse(character.ability_scores, {});
  const toolProfs = safeParse(character.tool_proficiencies, []);
  const level = character.level || 1;

  // Calculate the roll
  const d20 = rollD20();
  const abilityMod = getAbilityMod(abilityScores, recipe.ability_check || 'intelligence');
  const isProficient = recipe.required_proficiency && toolProfs.includes(recipe.required_proficiency);
  const profBonus = isProficient ? getProficiencyBonus(level) : 0;
  const totalRoll = d20 + abilityMod + profBonus;
  const dc = recipe.difficulty_dc || 10;

  if (totalRoll >= dc) {
    // --- SUCCESS ---
    const margin = totalRoll - dc;

    // Determine quality from margin
    let quality;
    if (margin >= 15) quality = 'masterwork';
    else if (margin >= 10) quality = 'superior';
    else if (margin >= 5) quality = 'fine';
    else quality = 'standard';

    // Build output item with quality applied
    const outputItem = { ...recipe.output_item };
    outputItem.quality = quality;
    if (quality === 'masterwork') {
      outputItem.name = `Masterwork ${outputItem.name}`;
    } else if (quality === 'superior') {
      outputItem.name = `Superior ${outputItem.name}`;
    } else if (quality === 'fine') {
      outputItem.name = `Fine ${outputItem.name}`;
    }

    // Mark project completed
    await dbRun(`
      UPDATE crafting_projects
      SET status = 'completed', quality_result = ?, completed_game_day = ?
      WHERE id = ?
    `, [quality, gameDay, projectId]);

    return {
      success: true,
      item: outputItem,
      quantity: recipe.output_quantity || 1,
      quality,
      roll: { d20, ability_mod: abilityMod, proficiency_bonus: profBonus, total: totalRoll },
      dc,
      project_id: projectId
    };
  } else {
    // --- FAILURE ---
    await dbRun(
      "UPDATE crafting_projects SET status = 'failed', completed_game_day = ? WHERE id = ?",
      [gameDay, projectId]
    );

    // Return 50% of consumed materials
    const consumed = safeParse(project.materials_consumed, []);
    const returned = halfMaterials(consumed);

    // Add returned materials back to character inventory
    for (const mat of returned) {
      await addMaterial(project.character_id, mat.name, mat.quantity, 'standard', 'crafting refund', gameDay, 0);
    }

    return {
      success: false,
      roll: { d20, ability_mod: abilityMod, proficiency_bonus: profBonus, total: totalRoll },
      dc,
      materials_returned: returned,
      project_id: projectId
    };
  }
}

// ============================================================
// 7. ABANDON PROJECT
// ============================================================

/**
 * Abandon an in-progress crafting project and refund 50% of materials.
 *
 * @param {number} projectId
 * @returns {Promise<object>} { abandoned: true, materials_returned: [...] }
 */
export async function abandonProject(projectId) {
  const project = await dbGet('SELECT * FROM crafting_projects WHERE id = ?', [projectId]);
  if (!project) return { error: 'Project not found' };
  if (project.status !== 'in_progress') return { error: `Project is ${project.status}, cannot abandon` };

  // Mark abandoned
  await dbRun("UPDATE crafting_projects SET status = 'abandoned' WHERE id = ?", [projectId]);

  // Return 50% of consumed materials
  const consumed = safeParse(project.materials_consumed, []);
  const returned = halfMaterials(consumed);

  // Add returned materials back to character inventory
  for (const mat of returned) {
    await addMaterial(project.character_id, mat.name, mat.quantity, 'standard', 'abandoned project refund', null, 0);
  }

  return {
    abandoned: true,
    materials_returned: returned,
    project_id: projectId
  };
}

// ============================================================
// 8. DISCOVER RECIPE
// ============================================================

/**
 * Discover a new recipe by name. Uses case-insensitive LIKE matching.
 * Adds the recipe to the character's known recipes if not already known.
 *
 * @param {number} characterId
 * @param {string} recipeName - Name to search for
 * @param {string} method - How it was discovered (e.g. 'found_scroll', 'taught_by_npc', 'experimentation')
 * @param {number} gameDay - Current in-game day
 * @returns {Promise<object>} { discovered: true, recipe } or { discovered: false, already_known: true } or error
 */
export async function discoverRecipe(characterId, recipeName, method, gameDay) {
  // Find recipe by name (case-insensitive)
  const recipe = await dbGet(
    'SELECT * FROM crafting_recipes WHERE LOWER(name) LIKE LOWER(?)',
    [`%${recipeName}%`]
  );
  if (!recipe) return { error: 'Recipe not found' };

  // Check if already discovered
  const existing = await dbGet(
    'SELECT id FROM character_recipes WHERE character_id = ? AND recipe_id = ?',
    [characterId, recipe.id]
  );
  if (existing) {
    return {
      discovered: false,
      already_known: true,
      recipe: {
        ...recipe,
        required_materials: safeParse(recipe.required_materials, []),
        required_tools: safeParse(recipe.required_tools, []),
        output_item: safeParse(recipe.output_item, {})
      }
    };
  }

  // Insert discovery
  await dbRun(`
    INSERT INTO character_recipes (character_id, recipe_id, discovered_method, discovered_game_day)
    VALUES (?, ?, ?, ?)
  `, [characterId, recipe.id, method, gameDay]);

  return {
    discovered: true,
    recipe: {
      ...recipe,
      required_materials: safeParse(recipe.required_materials, []),
      required_tools: safeParse(recipe.required_tools, []),
      output_item: safeParse(recipe.output_item, {})
    }
  };
}

// ============================================================
// 8b. CREATE RADIANT RECIPE (AI-generated)
// ============================================================

/**
 * Create a new "radiant" recipe from AI-generated data and link it to the character.
 * Radiant recipes emerge from gameplay (e.g., an NPC gifting their secret recipe).
 *
 * @param {number} characterId
 * @param {object} recipeData - Parsed data from [RECIPE_GIFT] marker
 * @param {number} gameDay - Current game day
 * @returns {Promise<object>} { created, recipe } or { already_known }
 */
export async function createRadiantRecipe(characterId, recipeData, gameDay) {
  // Check if recipe with this exact name already exists
  const existing = await dbGet(
    'SELECT id FROM crafting_recipes WHERE LOWER(name) = LOWER(?)',
    [recipeData.name]
  );

  let recipeId;

  if (existing) {
    recipeId = existing.id;
  } else {
    // Create the new recipe in the catalog
    const result = await dbRun(`
      INSERT INTO crafting_recipes
        (name, category, description, required_materials, required_tools,
         required_proficiency, craft_time_hours, difficulty_dc, ability_check,
         output_item, output_quantity, level_requirement, gold_cost,
         is_default, rarity, source_hint, is_radiant, gifted_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 0, 'common', ?, 1, ?)
    `, [
      recipeData.name,
      recipeData.category || 'food',
      recipeData.description || '',
      JSON.stringify(recipeData.materials || []),
      JSON.stringify(recipeData.tools || []),
      null,
      recipeData.hours || 4,
      recipeData.dc || 10,
      recipeData.ability || 'intelligence',
      JSON.stringify({
        name: recipeData.outputName || recipeData.name,
        category: recipeData.outputCategory || recipeData.category || 'food',
        description: recipeData.outputDesc || recipeData.description || '',
        rarity: recipeData.outputRarity || 'common',
        price_gp: recipeData.outputPrice || 1
      }),
      `Gift from ${recipeData.giftedBy || 'Unknown'}`,
      recipeData.giftedBy || 'Unknown'
    ]);
    recipeId = result.lastInsertRowid;
    console.log(`[CraftingService] Created radiant recipe: "${recipeData.name}" (gifted by ${recipeData.giftedBy})`);
  }

  // Check if character already knows this recipe
  const alreadyKnown = await dbGet(
    'SELECT id FROM character_recipes WHERE character_id = ? AND recipe_id = ?',
    [characterId, recipeId]
  );

  if (alreadyKnown) {
    return { already_known: true, recipe_id: recipeId };
  }

  // Link to character
  await dbRun(`
    INSERT INTO character_recipes (character_id, recipe_id, discovered_method, discovered_game_day, notes)
    VALUES (?, ?, 'gift', ?, ?)
  `, [characterId, recipeId, gameDay, `Gift from ${recipeData.giftedBy || 'Unknown'}`]);

  const recipe = await getRecipeById(recipeId);
  return { created: true, recipe };
}

// ============================================================
// 9. GET PROJECT STATUS
// ============================================================

/**
 * Get all crafting projects for a character with recipe names and progress.
 *
 * @param {number} characterId
 * @returns {Promise<Array>} Projects with progress_pct and recipe name
 */
export async function getProjectStatus(characterId) {
  const projects = await dbAll(`
    SELECT cp.*, cr.name as recipe_name, cr.category as recipe_category,
           cr.output_item as recipe_output_item
    FROM crafting_projects cp
    JOIN crafting_recipes cr ON cp.recipe_id = cr.id
    WHERE cp.character_id = ?
    ORDER BY cp.created_at DESC
  `, [characterId]);

  return projects.map(p => ({
    ...p,
    materials_consumed: safeParse(p.materials_consumed, []),
    recipe_output_item: safeParse(p.recipe_output_item, {}),
    progress_pct: p.hours_required > 0
      ? Math.min(100, Math.round((p.hours_invested / p.hours_required) * 100))
      : 100,
    ready_to_complete: p.status === 'in_progress' && p.hours_invested >= p.hours_required
  }));
}

// ============================================================
// 10. ADD MATERIAL
// ============================================================

/**
 * Add crafting materials to a character's inventory.
 * If the character already has this material at the same quality, increment quantity.
 * Otherwise, insert a new row.
 *
 * @param {number} characterId
 * @param {string} materialName
 * @param {number} quantity
 * @param {string} quality - 'standard' | 'fine' | 'superior'
 * @param {string} source - Where it came from (e.g. 'foraged', 'purchased', 'looted')
 * @param {number} gameDay - In-game day acquired
 * @param {number} valueGp - Gold piece value per unit
 * @returns {Promise<object>} The updated material row
 */
export async function addMaterial(characterId, materialName, quantity, quality = 'standard', source = null, gameDay = null, valueGp = 0) {
  // Check if character already has this material at this quality level
  const existing = await dbGet(
    'SELECT * FROM character_materials WHERE character_id = ? AND material_name = ? AND quality = ?',
    [characterId, materialName, quality]
  );

  if (existing) {
    const newQty = existing.quantity + quantity;
    await dbRun(
      'UPDATE character_materials SET quantity = ? WHERE id = ?',
      [newQty, existing.id]
    );
    return { ...existing, quantity: newQty };
  }

  // Insert new row
  const result = await dbRun(`
    INSERT INTO character_materials
      (character_id, material_name, quantity, quality, source, acquired_game_day, value_gp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [characterId, materialName, quantity, quality, source, gameDay, valueGp]);

  return await dbGet('SELECT * FROM character_materials WHERE id = ?', [result.lastInsertRowid]);
}

// ============================================================
// 11. REMOVE MATERIAL
// ============================================================

/**
 * Remove (consume) materials from a character's inventory.
 * Reduces quantity and deletes the row if it reaches 0.
 *
 * @param {number} characterId
 * @param {string} materialName
 * @param {number} quantity - Amount to remove
 * @returns {Promise<object>} { removed: true, remaining } or { removed: false, error }
 */
export async function removeMaterial(characterId, materialName, quantity) {
  // Sum total across all quality levels
  const total = await dbGet(
    'SELECT COALESCE(SUM(quantity), 0) as total FROM character_materials WHERE character_id = ? AND material_name = ?',
    [characterId, materialName]
  );

  if ((total?.total || 0) < quantity) {
    return { removed: false, error: `Insufficient ${materialName}: have ${total?.total || 0}, need ${quantity}` };
  }

  // Consume from rows FIFO (oldest first)
  let remaining = quantity;
  const rows = await dbAll(
    'SELECT id, quantity FROM character_materials WHERE character_id = ? AND material_name = ? ORDER BY acquired_game_day ASC, id ASC',
    [characterId, materialName]
  );

  for (const row of rows) {
    if (remaining <= 0) break;
    const deduct = Math.min(remaining, row.quantity);
    const newQty = row.quantity - deduct;

    if (newQty <= 0) {
      await dbRun('DELETE FROM character_materials WHERE id = ?', [row.id]);
    } else {
      await dbRun('UPDATE character_materials SET quantity = ? WHERE id = ?', [newQty, row.id]);
    }
    remaining -= deduct;
  }

  // Calculate remaining total
  const afterTotal = await dbGet(
    'SELECT COALESCE(SUM(quantity), 0) as total FROM character_materials WHERE character_id = ? AND material_name = ?',
    [characterId, materialName]
  );

  return { removed: true, remaining: afterTotal?.total || 0 };
}

// ============================================================
// 12. GET MATERIALS
// ============================================================

/**
 * List all crafting materials for a character.
 *
 * @param {number} characterId
 * @returns {Promise<Array>} Array of material rows
 */
export async function getMaterials(characterId) {
  return await dbAll(
    'SELECT * FROM character_materials WHERE character_id = ? ORDER BY material_name ASC, quality ASC',
    [characterId]
  );
}

// ============================================================
// 13. CHECK FORAGING RESULTS
// ============================================================

/**
 * Determine what materials foraging might yield based on location, season, and weather.
 * Returns possible materials with quantities and DC modifiers for the DM to use
 * when a character attempts to forage.
 *
 * @param {number} characterLevel - Character level (affects base DC)
 * @param {string} locationString - Location description (checked for keywords)
 * @param {string} season - 'spring' | 'summer' | 'autumn' | 'winter'
 * @param {string} weatherType - 'clear' | 'rain' | 'storm' | 'snow' | 'fog' etc.
 * @returns {object} { possible_materials: [...], base_dc }
 */
export function checkForagingResults(characterLevel, locationString, season, weatherType) {
  const loc = (locationString || '').toLowerCase();
  const szn = (season || 'summer').toLowerCase();
  const weather = (weatherType || 'clear').toLowerCase();

  // Base DC scales slightly with level to remain challenging
  let baseDc = 12;

  // Build possible materials based on location keywords
  let possible = [];

  if (loc.includes('forest') || loc.includes('wood') || loc.includes('grove') || loc.includes('jungle')) {
    possible.push(
      { name: 'Healing Herbs', max_quantity: 3, dc_modifier: 0 },
      { name: 'Wood', max_quantity: 5, dc_modifier: -2 },
      { name: 'Plant Fiber', max_quantity: 4, dc_modifier: -2 },
      { name: 'Mushrooms', max_quantity: 3, dc_modifier: 0 }
    );
  }

  if (loc.includes('mountain') || loc.includes('peak') || loc.includes('cliff') || loc.includes('highland')) {
    possible.push(
      { name: 'Metal Ore', max_quantity: 3, dc_modifier: 2 },
      { name: 'Stone', max_quantity: 4, dc_modifier: 0 },
      { name: 'Crystal', max_quantity: 1, dc_modifier: 4 }
    );
  }

  if (loc.includes('coast') || loc.includes('beach') || loc.includes('shore') || loc.includes('sea') || loc.includes('ocean')) {
    possible.push(
      { name: 'Salt', max_quantity: 3, dc_modifier: -2 },
      { name: 'Shells', max_quantity: 4, dc_modifier: -2 },
      { name: 'Seaweed', max_quantity: 3, dc_modifier: -1 },
      { name: 'Fish', max_quantity: 2, dc_modifier: 2 }
    );
  }

  if (loc.includes('desert') || loc.includes('dune') || loc.includes('waste') || loc.includes('arid')) {
    possible.push(
      { name: 'Cactus Extract', max_quantity: 2, dc_modifier: 2 },
      { name: 'Sand Glass', max_quantity: 2, dc_modifier: 3 },
      { name: 'Scorpion Venom', max_quantity: 1, dc_modifier: 5 }
    );
    baseDc += 2; // Desert foraging is harder
  }

  if (loc.includes('plain') || loc.includes('meadow') || loc.includes('field') || loc.includes('grassland') || loc.includes('prairie')) {
    possible.push(
      { name: 'Grain', max_quantity: 4, dc_modifier: -2 },
      { name: 'Plant Fiber', max_quantity: 5, dc_modifier: -3 },
      { name: 'Raw Meat', max_quantity: 2, dc_modifier: 3 }
    );
  }

  if (loc.includes('swamp') || loc.includes('marsh') || loc.includes('bog') || loc.includes('fen')) {
    possible.push(
      { name: 'Nightshade', max_quantity: 2, dc_modifier: 2 },
      { name: 'Fungus', max_quantity: 3, dc_modifier: 0 },
      { name: 'Peat', max_quantity: 3, dc_modifier: -1 }
    );
  }

  if (loc.includes('underground') || loc.includes('cave') || loc.includes('dungeon') || loc.includes('mine') || loc.includes('cavern')) {
    possible.push(
      { name: 'Mushrooms', max_quantity: 3, dc_modifier: 0 },
      { name: 'Crystal', max_quantity: 2, dc_modifier: 3 },
      { name: 'Raw Ore', max_quantity: 3, dc_modifier: 2 }
    );
  }

  // If no location matched, provide generic wilderness materials
  if (possible.length === 0) {
    possible.push(
      { name: 'Plant Fiber', max_quantity: 2, dc_modifier: 0 },
      { name: 'Wood', max_quantity: 2, dc_modifier: 0 }
    );
  }

  // --- Seasonal modifiers ---
  if (szn === 'spring' || szn === 'summer') {
    // Boost herb and plant yields
    for (const mat of possible) {
      if (['Healing Herbs', 'Plant Fiber', 'Nightshade', 'Mushrooms', 'Grain'].includes(mat.name)) {
        mat.max_quantity = Math.ceil(mat.max_quantity * 1.5);
        mat.dc_modifier -= 1;
      }
    }
  } else if (szn === 'autumn') {
    // Boost food yields
    for (const mat of possible) {
      if (['Raw Meat', 'Mushrooms', 'Grain', 'Fish'].includes(mat.name)) {
        mat.max_quantity = Math.ceil(mat.max_quantity * 1.5);
        mat.dc_modifier -= 1;
      }
    }
  } else if (szn === 'winter') {
    // Reduce everything
    for (const mat of possible) {
      mat.max_quantity = Math.max(1, Math.floor(mat.max_quantity * 0.5));
      mat.dc_modifier += 2;
    }
    baseDc += 2;
  }

  // --- Weather modifiers ---
  if (weather.includes('rain') || weather.includes('drizzle')) {
    baseDc += 1;
  } else if (weather.includes('storm') || weather.includes('blizzard') || weather.includes('hurricane')) {
    baseDc += 4;
    for (const mat of possible) {
      mat.max_quantity = Math.max(1, mat.max_quantity - 1);
    }
  } else if (weather.includes('snow')) {
    baseDc += 2;
  } else if (weather.includes('fog') || weather.includes('mist')) {
    baseDc += 1;
  }

  return {
    possible_materials: possible,
    base_dc: baseDc
  };
}

// ============================================================
// 14. FORMAT CRAFTING FOR PROMPT
// ============================================================

/**
 * Format a crafting status section for inclusion in the DM system prompt.
 * Provides active projects, material counts, known recipe counts, and tool proficiencies.
 *
 * @param {number} characterId
 * @returns {Promise<string>} Multi-line formatted string for DM context
 */
export async function formatCraftingForPrompt(characterId) {
  // Active (in-progress) projects
  const activeProjects = await dbAll(`
    SELECT cp.hours_invested, cp.hours_required, cr.name as recipe_name, cr.category
    FROM crafting_projects cp
    JOIN crafting_recipes cr ON cp.recipe_id = cr.id
    WHERE cp.character_id = ? AND cp.status = 'in_progress'
  `, [characterId]);

  // Material counts
  const materials = await dbAll(
    'SELECT material_name, SUM(quantity) as total FROM character_materials WHERE character_id = ? GROUP BY material_name ORDER BY material_name',
    [characterId]
  );

  // Known recipe count (default + discovered)
  const defaultCount = await dbGet('SELECT COUNT(*) as count FROM crafting_recipes WHERE is_default = 1');
  const discoveredCount = await dbGet(
    'SELECT COUNT(*) as count FROM character_recipes WHERE character_id = ?',
    [characterId]
  );

  // Tool proficiencies
  const character = await dbGet('SELECT tool_proficiencies FROM characters WHERE id = ?', [characterId]);
  const toolProfs = safeParse(character?.tool_proficiencies, []);

  // Build the formatted string
  const lines = ['--- CRAFTING STATUS ---'];

  // Tool proficiencies
  if (toolProfs.length > 0) {
    lines.push(`Tool proficiencies: ${toolProfs.join(', ')}`);
  } else {
    lines.push('Tool proficiencies: None');
  }

  // Known recipes
  const totalRecipes = (defaultCount?.count || 0) + (discoveredCount?.count || 0);
  lines.push(`Known recipes: ${totalRecipes} (${defaultCount?.count || 0} default, ${discoveredCount?.count || 0} discovered)`);

  // Active projects
  if (activeProjects.length > 0) {
    lines.push(`Active projects (${activeProjects.length}):`);
    for (const proj of activeProjects) {
      const pct = proj.hours_required > 0
        ? Math.min(100, Math.round((proj.hours_invested / proj.hours_required) * 100))
        : 100;
      const readyTag = pct >= 100 ? ' [READY TO COMPLETE]' : '';
      lines.push(`  - ${proj.recipe_name} (${proj.category}): ${proj.hours_invested}/${proj.hours_required} hours (${pct}%)${readyTag}`);
    }
  } else {
    lines.push('Active projects: None');
  }

  // Materials on hand
  if (materials.length > 0) {
    lines.push(`Materials on hand (${materials.length} types):`);
    for (const mat of materials) {
      lines.push(`  - ${mat.material_name}: ${mat.total}`);
    }
  } else {
    lines.push('Materials on hand: None');
  }

  return lines.join('\n');
}
