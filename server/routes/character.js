import express from 'express';
import db, { dbAll, dbGet, dbRun } from '../database.js';
import * as questService from '../services/questService.js';
import * as backstoryParserService from '../services/backstoryParserService.js';
import { getCharacterRelationshipsWithNpcs } from '../services/npcRelationshipService.js';
import { getCharacterProgression } from '../services/progressionService.js';
import { getCampaignLocations } from '../services/locationService.js';
import { getCharacterStandings, getGoalsVisibleToCharacter } from '../services/factionService.js';
import { getEventsVisibleToCharacter } from '../services/worldEventService.js';
import { resetMythicPower } from '../services/mythicService.js';
import { handleServerError, notFound, validationError } from '../utils/errorHandler.js';
import { safeParse } from '../utils/safeParse.js';
import {
  PROFICIENCY_BONUS,
  HIT_DICE,
  canLevelUp,
  getXPToNextLevel,
  getClassFeatures,
  needsSubclassSelection,
  hasASI,
  getCantripsKnown,
  getSpellsKnown,
  getSpellSlots,
  SUBCLASS_LEVELS,
  MULTICLASS_REQUIREMENTS,
  meetsMulticlassRequirements,
  getAvailableMulticlassOptions,
  getMulticlassSpellSlots,
  getTotalLevel,
  getHitDiceBreakdown
} from '../config/levelProgression.js';

const router = express.Router();

// Get all characters
router.get('/', async (req, res) => {
  try {
    const characters = await dbAll('SELECT * FROM characters ORDER BY updated_at DESC', []);
    res.json(characters);
  } catch (error) {
    handleServerError(res, error, 'fetch characters');
  }
});

// Get single character
router.get('/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return notFound(res, 'Character');
    }
    res.json(character);
  } catch (error) {
    handleServerError(res, error, 'fetch character');
  }
});

// Get character progression — theme, unlocked + upcoming abilities, ancestry feats,
// Knight moral path, and any resonant Subclass × Theme / Mythic × Theme combos.
// Delegates to progressionService so the same snapshot shape is used by both
// the Character Sheet UI and the DM session prompt builder.
router.get('/:id/progression', async (req, res) => {
  try {
    const snapshot = await getCharacterProgression(req.params.id);
    if (!snapshot) return notFound(res, 'Character');
    res.json(snapshot);
  } catch (error) {
    handleServerError(res, error, 'fetch character progression');
  }
});

// Create new character
router.post('/', async (req, res) => {
  try {
    const {
      name,
      first_name = null,
      last_name = null,
      nickname = null,
      gender = null,
      class: charClass,
      subclass = null,
      race = '',
      subrace = null,
      background = null,
      level,
      current_hp,
      max_hp,
      current_location,
      current_quest,
      gold_cp = 0,
      gold_sp = 0,
      gold_gp = 0,
      experience = 0,
      experience_to_next_level,
      armor_class = 10,
      speed = 30,
      ability_scores = '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
      skills = '[]',
      advantages = '[]',
      inventory = '[]',
      faction_standings = '{}',
      injuries = '[]',
      debuffs = '[]',
      equipment = '[]',
      avatar = null,
      alignment = null,
      faith = null,
      lifestyle = null,
      hair_color = null,
      skin_color = null,
      eye_color = null,
      height = null,
      weight = null,
      age = null,
      personality_traits = null,
      ideals = null,
      bonds = null,
      flaws = null,
      organizations = null,
      allies = null,
      enemies = null,
      backstory = null,
      other_notes = null,
      known_cantrips = '[]',
      known_spells = '[]',
      feats = '[]',
      languages = '[]',
      tool_proficiencies = '[]',
      keeper_texts = '[]',
      keeper_recitations = '[]',
      keeper_genre_domain = null,
      // Progression system — Phase 2 additions
      theme_id = null,
      theme_path_choice = null,
      ancestry_feat_id = null,
      ancestry_list_id = null,
      ancestry_feat_choices = null // object of player-resolved sub-choices, e.g. { skill: 'perception', language: 'dwarvish' }
    } = req.body;

    const sql = `
      INSERT INTO characters (
        name, first_name, last_name, nickname, gender,
        class, subclass, race, subrace, background,
        level, current_hp, max_hp, current_location, current_quest,
        gold_cp, gold_sp, gold_gp, starting_gold_cp, starting_gold_sp, starting_gold_gp,
        experience, experience_to_next_level,
        armor_class, speed, ability_scores, skills, advantages, inventory,
        faction_standings, injuries, debuffs, equipment,
        avatar, alignment, faith, lifestyle,
        hair_color, skin_color, eye_color, height, weight, age,
        personality_traits, ideals, bonds, flaws,
        organizations, allies, enemies, backstory, other_notes,
        known_cantrips, known_spells, feats, languages, tool_proficiencies,
        keeper_texts, keeper_recitations, keeper_genre_domain
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await dbRun(sql, [
      name, first_name, last_name, nickname, gender,
      charClass, subclass, race, subrace, background,
      level, current_hp, max_hp, current_location, current_quest,
      gold_cp, gold_sp, gold_gp, gold_cp, gold_sp, gold_gp, // Store starting gold same as initial gold
      experience, experience_to_next_level,
      armor_class, speed, ability_scores, skills, advantages, inventory,
      faction_standings, injuries, debuffs, equipment,
      avatar, alignment, faith, lifestyle,
      hair_color, skin_color, eye_color, height, weight, age,
      personality_traits, ideals, bonds, flaws,
      organizations, allies, enemies, backstory, other_notes,
      known_cantrips, known_spells, feats, languages, tool_proficiencies,
      keeper_texts, keeper_recitations, keeper_genre_domain
    ]);

    const characterId = result.lastInsertRowid;

    // Persist progression selections. Guards are defensive against non-wizard
    // code paths that may create characters without these fields (e.g., tests,
    // imports, or internal seed utilities).
    if (theme_id) {
      await persistThemeSelection(characterId, theme_id, theme_path_choice, level);
    }
    if (ancestry_feat_id) {
      await persistAncestryFeatSelection(characterId, ancestry_feat_id, 1, level, ancestry_feat_choices);
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    res.status(201).json(character);
  } catch (error) {
    handleServerError(res, error, 'create character');
  }
});

/**
 * Persist a theme selection for a newly-created character.
 * Inserts into character_themes + character_theme_unlocks (L1 ability).
 * Also initializes knight_moral_paths if theme is knight_of_the_order.
 */
async function persistThemeSelection(characterId, themeId, pathChoice, level) {
  // Upsert character_themes
  await dbRun(
    `INSERT OR REPLACE INTO character_themes (character_id, theme_id, path_choice)
     VALUES (?, ?, ?)`,
    [characterId, themeId, pathChoice]
  );

  // Grant the L1 theme ability automatically (no choice for L1 — it IS the
  // existing Background feature; higher tiers have choices but L1 does not)
  const l1Ability = await dbGet(
    `SELECT id FROM theme_abilities WHERE theme_id = ? AND tier = 1 LIMIT 1`,
    [themeId]
  );
  if (l1Ability) {
    await dbRun(
      `INSERT OR REPLACE INTO character_theme_unlocks
       (character_id, theme_id, tier, tier_ability_id, unlocked_at_level, narrative_delivery)
       VALUES (?, ?, 1, ?, ?, ?)`,
      [characterId, themeId, l1Ability.id, level || 1, 'Granted at character creation.']
    );
  }

  // Initialize Knight moral path tracker if applicable
  if (themeId === 'knight_of_the_order') {
    await dbRun(
      `INSERT OR REPLACE INTO knight_moral_paths (character_id, current_path)
       VALUES (?, 'true')`,
      [characterId]
    );
  }
}

/**
 * Persist an L1 ancestry feat selection for a newly-created character.
 * `choicesData` is an optional object of player-resolved sub-choices
 * (e.g. { skill: 'perception', language: 'dwarvish' }) matching the
 * feat's `choices` schema.
 */
async function persistAncestryFeatSelection(characterId, featId, tier, selectedAtLevel, choicesData) {
  const choicesJson = choicesData && typeof choicesData === 'object'
    ? JSON.stringify(choicesData)
    : null;
  await dbRun(
    `INSERT OR REPLACE INTO character_ancestry_feats
     (character_id, feat_id, tier, selected_at_level, narrative_delivery, choices_data)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [characterId, featId, tier, selectedAtLevel || 1, 'Chosen at character creation.', choicesJson]
  );
}

// Update character
router.put('/:id', async (req, res) => {
  try {
    const updates = [];
    const values = [];

    const allowedFields = [
      'name', 'first_name', 'last_name', 'nickname', 'gender',
      'class', 'subclass', 'race', 'subrace', 'background',
      'level', 'current_hp', 'max_hp', 'current_location', 'current_quest',
      'gold_cp', 'gold_sp', 'gold_gp', 'experience', 'experience_to_next_level',
      'armor_class', 'speed', 'ability_scores', 'skills', 'advantages',
      'inventory', 'faction_standings', 'injuries', 'debuffs', 'equipment',
      'avatar', 'alignment', 'faith', 'lifestyle',
      'hair_color', 'skin_color', 'eye_color', 'height', 'weight', 'age',
      'personality_traits', 'ideals', 'bonds', 'flaws',
      'organizations', 'allies', 'enemies', 'backstory', 'other_notes',
      'known_cantrips', 'known_spells', 'prepared_spells', 'feats',
      'class_levels', 'hit_dice',
      'campaign_config', 'languages', 'tool_proficiencies',
      'keeper_texts', 'keeper_recitations', 'keeper_genre_domain',
      'keeper_genre_domain_2', 'keeper_genre_mastery', 'keeper_specialization'
    ];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return validationError(res, 'No valid fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    await dbRun(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`, values);

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    res.json(character);
  } catch (error) {
    handleServerError(res, error, 'update character');
  }
});

// Delete character and all related data.
//
// Uses dynamic foreign-key discovery instead of a hand-written deletion
// list. Every table in the database is scanned via PRAGMA foreign_key_list;
// any table with a declared FK to `characters` has its matching rows
// deleted before the character row itself. This is robust against future
// schema additions — new tables with an FK to characters are picked up
// automatically, no endpoint edits required.
//
// One indirect cascade is still handled explicitly: session_message_summaries
// FKs dm_sessions (not characters directly), and has no ON DELETE CASCADE
// declared, so we have to clear it before dm_sessions gets deleted.
//
// Replaces the prior hand-written 13-step list, which missed any table
// added after it was last maintained — the reason the v1.0.50 play-test
// couldn't delete TEST_LWChar (companions.recruited_by_character_id was in
// the list but some parallel dependency wasn't, and the error surfaced
// before the companion delete reached it).
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [id]);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    // --- INDIRECT CASCADES (FK to intermediate table, not characters) ---
    // session_message_summaries → dm_sessions(id). No ON DELETE CASCADE.
    await dbRun(
      'DELETE FROM session_message_summaries WHERE session_id IN (SELECT id FROM dm_sessions WHERE character_id = ?)',
      [id]
    );

    // --- DIRECT FK HOLDERS (discovered from schema at request time) ---
    const tables = await dbAll(
      `SELECT name FROM sqlite_master
       WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'characters'`
    );
    const directRefs = [];
    for (const t of tables) {
      // Inline the table name — PRAGMA args can't be bound as parameters in
      // SQLite. Table names come from sqlite_master so they're trusted.
      const fks = await dbAll(`PRAGMA foreign_key_list(${t.name})`);
      for (const fk of fks) {
        if (fk.table === 'characters') directRefs.push({ table: t.name, column: fk.from });
      }
    }

    // Delete from every direct FK holder. Order among direct refs doesn't
    // matter — they're all at the same depth in the FK graph.
    const cleaned = [];
    for (const { table, column } of directRefs) {
      await dbRun(`DELETE FROM ${table} WHERE ${column} = ?`, [id]);
      cleaned.push(`${table}.${column}`);
    }

    // --- FINAL: the character row itself ---
    await dbRun('DELETE FROM characters WHERE id = ?', [id]);

    res.json({
      message: 'Character deleted successfully',
      cleaned_tables: cleaned.length,
      tables_scanned: tables.length
    });
  } catch (error) {
    // Foreign-key constraint errors after the dynamic sweep usually mean a
    // deeper FK chain than one hop (table B → table A → characters, where A
    // and B don't have ON DELETE CASCADE). Surface a specific message so
    // the operator can see which table is blocking.
    const msg = String(error?.message || '');
    if (msg.includes('FOREIGN KEY constraint')) {
      console.error('Character delete blocked by FK constraint. Stack:', error);
      return res.status(409).json({
        error: 'A foreign-key dependency prevented the delete. Check server logs for the specific table.',
        details: msg
      });
    }
    handleServerError(res, error, 'delete character');
  }
});

// Discard an item from inventory
router.post('/:id/discard-item', async (req, res) => {
  try {
    const { itemName } = req.body;
    if (!itemName) return res.status(400).json({ error: 'itemName is required' });

    const character = await dbGet('SELECT id, inventory FROM characters WHERE id = ?', [req.params.id]);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    let inventory = safeParse(character.inventory, []);
    const idx = inventory.findIndex(i => (i.name || i).toLowerCase() === itemName.toLowerCase());

    if (idx === -1) return res.status(404).json({ error: 'Item not found in inventory' });

    if (inventory[idx].quantity > 1) {
      inventory[idx].quantity -= 1;
    } else {
      inventory.splice(idx, 1);
    }

    await dbRun('UPDATE characters SET inventory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(inventory), req.params.id]);

    const updated = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    handleServerError(res, error, 'discard item');
  }
});

// Rest to restore HP (and spell slots on long rest)
router.post('/rest/:id', async (req, res) => {
  try {
    const { restType = 'long' } = req.body; // 'short' or 'long'
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    let healAmount = 0;
    let newHp = character.current_hp;
    let spellSlotsRestored = false;

    if (restType === 'long') {
      // Long rest: restore all HP and all spell slots
      healAmount = character.max_hp - character.current_hp;
      newHp = character.max_hp;

      // Reset spell slots used to empty (restores all slots)
      await dbRun(`
        UPDATE characters
        SET current_hp = ?, spell_slots_used = '{}', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newHp, req.params.id]);
      spellSlotsRestored = true;

      // Reset mythic power on long rest
      try { await resetMythicPower(parseInt(req.params.id)); } catch (_) { /* no mythic record is fine */ }
    } else {
      // Short rest: restore 50% of missing HP, partial spell slot recovery for some classes
      const missingHp = character.max_hp - character.current_hp;
      healAmount = Math.max(1, Math.floor(missingHp * 0.5));
      newHp = Math.min(character.max_hp, character.current_hp + healAmount);

      // Warlocks recover spell slots on short rest
      const characterClass = character.class?.toLowerCase();
      if (characterClass === 'warlock') {
        await dbRun(`
          UPDATE characters
          SET current_hp = ?, spell_slots_used = '{}', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [newHp, req.params.id]);
        spellSlotsRestored = true;
      } else {
        await dbRun('UPDATE characters SET current_hp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHp, req.params.id]);
      }
    }

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      message: restType === 'long'
        ? `Long rest complete. Restored ${healAmount} HP and all spell slots.`
        : `Short rest complete. Restored ${healAmount} HP.${spellSlotsRestored ? ' Spell slots restored.' : ''}`,
      character: updatedCharacter,
      newHp: newHp,
      hp_restored: healAmount,
      spell_slots_restored: spellSlotsRestored
    });
  } catch (error) {
    handleServerError(res, error, 'rest character');
  }
});

// Get character's spell slots (max and used)
router.get('/spell-slots/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get max spell slots based on class and level
    const spellSlots = getSpellSlots(character.class, character.level);
    const spellSlotsUsed = safeParse(character.spell_slots_used, {});

    res.json({
      max: spellSlots,
      used: spellSlotsUsed,
      class: character.class,
      level: character.level
    });
  } catch (error) {
    handleServerError(res, error, 'fetch spell slots');
  }
});

// Use a spell slot
router.post('/spell-slots/:id/use', async (req, res) => {
  try {
    const { level } = req.body;
    if (!level || level < 1 || level > 9) {
      return res.status(400).json({ error: 'Invalid spell level (1-9)' });
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const maxSlots = getSpellSlots(character.class, character.level);
    const usedSlots = safeParse(character.spell_slots_used, {});

    const maxForLevel = maxSlots[level] || 0;
    const usedForLevel = usedSlots[level] || 0;

    if (maxForLevel === 0) {
      return res.status(400).json({ error: `You don't have level ${level} spell slots` });
    }

    if (usedForLevel >= maxForLevel) {
      return res.status(400).json({ error: `No level ${level} spell slots remaining` });
    }

    usedSlots[level] = usedForLevel + 1;

    await dbRun('UPDATE characters SET spell_slots_used = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(usedSlots), req.params.id]);

    res.json({
      success: true,
      level,
      remaining: maxForLevel - usedSlots[level],
      max: maxForLevel
    });
  } catch (error) {
    handleServerError(res, error, 'use spell slot');
  }
});

// Restore a spell slot (for abilities like Arcane Recovery)
router.post('/spell-slots/:id/restore', async (req, res) => {
  try {
    const { level } = req.body;
    if (!level || level < 1 || level > 9) {
      return res.status(400).json({ error: 'Invalid spell level (1-9)' });
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const maxSlots = getSpellSlots(character.class, character.level);
    const usedSlots = safeParse(character.spell_slots_used, {});

    const maxForLevel = maxSlots[level] || 0;
    const usedForLevel = usedSlots[level] || 0;

    if (usedForLevel <= 0) {
      return res.status(400).json({ error: `No used level ${level} slots to restore` });
    }

    usedSlots[level] = usedForLevel - 1;

    await dbRun('UPDATE characters SET spell_slots_used = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(usedSlots), req.params.id]);

    res.json({
      success: true,
      level,
      remaining: maxForLevel - usedSlots[level],
      max: maxForLevel
    });
  } catch (error) {
    handleServerError(res, error, 'restore spell slot');
  }
});

// Reset character XP to 0
router.post('/reset-xp/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    await dbRun('UPDATE characters SET experience = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    res.json({
      message: 'XP reset to 0',
      character: updatedCharacter
    });
  } catch (error) {
    handleServerError(res, error, 'reset XP');
  }
});

// Grant XP to a character
router.post('/grant-xp/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return notFound(res, 'Character');
    }

    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return validationError(res, 'Amount must be a positive number');
    }

    const newExperience = character.experience + amount;
    await dbRun('UPDATE characters SET experience = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newExperience, req.params.id]);

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    const canLevel = canLevelUp(updatedCharacter.level, newExperience);

    res.json({
      character: updatedCharacter,
      xpGranted: amount,
      newTotal: newExperience,
      canLevelUp: canLevel
    });
  } catch (error) {
    handleServerError(res, error, 'grant XP');
  }
});

// Full character reset (XP, HP, inventory, clear adventures)
router.post('/full-reset/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Reset character stats to starting values
    await dbRun(`
      UPDATE characters
      SET experience = 0,
          current_hp = max_hp,
          gold_cp = starting_gold_cp,
          gold_sp = starting_gold_sp,
          gold_gp = starting_gold_gp,
          inventory = '[]',
          debuffs = '[]',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.params.id]);

    // Clear all adventures for this character
    await dbRun('DELETE FROM adventures WHERE character_id = ?', [req.params.id]);

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    res.json({
      message: 'Character fully reset',
      character: updatedCharacter
    });
  } catch (error) {
    handleServerError(res, error, 'full reset character');
  }
});

// Check if character can level up
router.get('/can-level-up/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const currentLevel = character.level;
    const currentXP = character.experience;
    const canLevel = canLevelUp(currentLevel, currentXP);
    const xpNeeded = getXPToNextLevel(currentLevel);

    res.json({
      canLevelUp: canLevel,
      currentLevel,
      currentXP,
      xpNeeded,
      xpRemaining: xpNeeded ? xpNeeded - currentXP : 0
    });
  } catch (error) {
    handleServerError(res, error, 'check level up');
  }
});

// Get level-up information (what choices need to be made)
router.get('/level-up-info/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Parse class_levels for multiclass support
    let classLevels = character.class_levels ? safeParse(character.class_levels, null) : null;

    // If no class_levels, create from legacy single-class data
    if (!classLevels) {
      classLevels = [{
        class: character.class,
        level: character.level,
        subclass: character.subclass
      }];
    }

    const totalLevel = getTotalLevel(classLevels);
    const newTotalLevel = totalLevel + 1;

    if (newTotalLevel > 20) {
      return res.status(400).json({ error: 'Character is already at maximum level' });
    }

    if (!canLevelUp(totalLevel, character.experience)) {
      return res.status(400).json({
        error: 'Character does not have enough XP to level up',
        currentXP: character.experience,
        xpNeeded: getXPToNextLevel(totalLevel)
      });
    }

    const abilityScores = safeParse(character.ability_scores, {});

    // Build class options for level up
    const classOptions = [];

    // Option 1: Continue with existing classes
    for (const classInfo of classLevels) {
      const className = classInfo.class.toLowerCase();
      const currentClassLevel = classInfo.level;
      const newClassLevel = currentClassLevel + 1;

      if (newClassLevel <= 20) {
        const newFeatures = getClassFeatures(className, newClassLevel);
        const hitDie = HIT_DICE[className] || 8;
        const conMod = Math.floor((abilityScores.con - 10) / 2);

        classOptions.push({
          type: 'existing',
          class: classInfo.class.charAt(0).toUpperCase() + classInfo.class.slice(1),
          currentLevel: currentClassLevel,
          newLevel: newClassLevel,
          subclass: classInfo.subclass,
          newFeatures,
          choices: {
            needsSubclass: needsSubclassSelection(className, newClassLevel) && !classInfo.subclass,
            needsASI: hasASI(className, newClassLevel),
            newCantrips: Math.max(0, getCantripsKnown(className, newClassLevel) - getCantripsKnown(className, currentClassLevel)),
            newSpellsKnown: (() => {
              const current = getSpellsKnown(className, currentClassLevel);
              const next = getSpellsKnown(className, newClassLevel);
              return (current !== null && next !== null) ? Math.max(0, next - current) : 0;
            })()
          },
          hpGain: {
            hitDie,
            conMod,
            average: Math.floor(hitDie / 2) + 1 + conMod,
            minimum: 1 + conMod,
            maximum: hitDie + conMod
          },
          subclassLevel: SUBCLASS_LEVELS[className]
        });
      }
    }

    // Option 2: Multiclass into new classes (all available - prerequisites shown but not enforced)
    const availableMulticlasses = getAvailableMulticlassOptions(abilityScores, classLevels);

    // Always show multiclass options - prerequisites are informational only
    for (const newClass of availableMulticlasses) {
      const newFeatures = getClassFeatures(newClass, 1);
      const hitDie = HIT_DICE[newClass] || 8;
      const conMod = Math.floor((abilityScores.con - 10) / 2);

      classOptions.push({
        type: 'multiclass',
        class: newClass.charAt(0).toUpperCase() + newClass.slice(1),
        currentLevel: 0,
        newLevel: 1,
        subclass: null,
        newFeatures,
        requirements: MULTICLASS_REQUIREMENTS[newClass],
        meetsRequirements: meetsMulticlassRequirements(abilityScores, newClass),
        choices: {
          needsSubclass: needsSubclassSelection(newClass, 1),
          needsASI: hasASI(newClass, 1),
          newCantrips: getCantripsKnown(newClass, 1),
          newSpellsKnown: getSpellsKnown(newClass, 1) || 0
        },
        hpGain: {
          hitDie,
          conMod,
          average: Math.floor(hitDie / 2) + 1 + conMod,
          minimum: 1 + conMod,
          maximum: hitDie + conMod
        },
        subclassLevel: SUBCLASS_LEVELS[newClass]
      });
    }

    // Get proficiency bonus change (based on total level)
    const currentProficiency = PROFICIENCY_BONUS[totalLevel];
    const newProficiency = PROFICIENCY_BONUS[newTotalLevel];
    const proficiencyIncreased = newProficiency > currentProficiency;

    // Calculate multiclass spell slots if applicable
    const multiclassSpellSlots = getMulticlassSpellSlots(classLevels);

    // Progression decisions (Phase 5): theme tier auto-unlocks + ancestry feat choices
    // gated on TOTAL character level (not per-class level).
    const progressionDecisions = await computeProgressionDecisions(req.params.id, newTotalLevel);

    res.json({
      currentLevel: totalLevel,
      newLevel: newTotalLevel,
      classLevels,
      classOptions,
      canMulticlass: true, // Always allow multiclass selection - prerequisites shown but not enforced
      multiclassSpellSlots,
      proficiencyBonus: {
        current: currentProficiency,
        new: newProficiency,
        increased: proficiencyIncreased
      },
      progression: progressionDecisions,
      // Legacy fields for backward compatibility
      className: character.class,
      subclass: character.subclass,
      newFeatures: classOptions.length > 0 ? classOptions[0].newFeatures : [],
      choices: classOptions.length > 0 ? classOptions[0].choices : {},
      hpGain: classOptions.length > 0 ? classOptions[0].hpGain : {},
      subclassLevel: SUBCLASS_LEVELS[character.class.toLowerCase()]
    });
  } catch (error) {
    handleServerError(res, error, 'get level-up info');
  }
});

/**
 * Helper for /level-up-info — returns the progression decisions that need to
 * happen (or auto-apply) when the character crosses to `newTotalLevel`.
 *
 * Theme tier thresholds: L5, L11, L17 — auto-unlock (1 ability per tier per
 * theme, no player choice). Returned as { tier, ability } for UI display.
 *
 * Ancestry feat thresholds: L3, L7, L13, L18 — require a player pick from
 * 3 options. Returned as { tier, options[] } so the UI can render a picker.
 *
 * Returns null-valued fields if the character has no theme/ancestry set,
 * or if the threshold isn't crossed / an unlock already exists at that tier.
 */
async function computeProgressionDecisions(characterId, newTotalLevel) {
  const themeTierThresholds = { 5: 5, 11: 11, 17: 17 };
  const ancestryFeatThresholds = { 3: 3, 7: 7, 13: 13, 18: 18 };

  const result = {
    theme_tier_unlock: null,
    ancestry_feat_tier: null
  };

  // Theme tier (auto-unlock): only fires at exactly L5, L11, or L17.
  if (themeTierThresholds[newTotalLevel]) {
    const tier = newTotalLevel;
    const charTheme = await dbGet(
      'SELECT theme_id FROM character_themes WHERE character_id = ?',
      [characterId]
    );
    if (charTheme) {
      // Already unlocked at this tier? Skip.
      const existing = await dbGet(
        'SELECT id FROM character_theme_unlocks WHERE character_id = ? AND tier = ?',
        [characterId, tier]
      );
      if (!existing) {
        const ability = await dbGet(
          `SELECT ta.id, ta.ability_name, ta.ability_description, ta.mechanics, ta.flavor_text, t.name as theme_name
           FROM theme_abilities ta JOIN themes t ON ta.theme_id = t.id
           WHERE ta.theme_id = ? AND ta.tier = ? AND ta.path_variant IS NULL
           LIMIT 1`,
          [charTheme.theme_id, tier]
        );
        if (ability) {
          result.theme_tier_unlock = {
            tier,
            theme_id: charTheme.theme_id,
            theme_name: ability.theme_name,
            tier_ability_id: ability.id,
            ability_name: ability.ability_name,
            ability_description: ability.ability_description,
            mechanics: ability.mechanics,
            flavor_text: ability.flavor_text
          };
        }
      }
    }
  }

  // Ancestry feat (player choice of 3): fires at L3, L7, L13, L18.
  if (ancestryFeatThresholds[newTotalLevel]) {
    const tier = newTotalLevel;
    // Find the character's ancestry list from their existing L1 feat (set at creation)
    const existingAnyFeat = await dbGet(
      `SELECT af.list_id FROM character_ancestry_feats caf
       JOIN ancestry_feats af ON caf.feat_id = af.id
       WHERE caf.character_id = ? LIMIT 1`,
      [characterId]
    );
    if (existingAnyFeat) {
      const listId = existingAnyFeat.list_id;
      const tierExisting = await dbGet(
        'SELECT id FROM character_ancestry_feats WHERE character_id = ? AND tier = ?',
        [characterId, tier]
      );
      if (!tierExisting) {
        const options = await dbAll(
          `SELECT id, choice_index, feat_name, description, mechanics, flavor_text
           FROM ancestry_feats
           WHERE list_id = ? AND tier = ?
           ORDER BY choice_index`,
          [listId, tier]
        );
        if (options.length > 0) {
          result.ancestry_feat_tier = {
            tier,
            list_id: listId,
            options
          };
        }
      }
    }
  }

  return result;
}

// Execute level up with choices
router.post('/level-up/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Parse existing class_levels or create from legacy data
    let classLevels = character.class_levels ? safeParse(character.class_levels, null) : null;
    if (!classLevels) {
      classLevels = [{
        class: character.class,
        level: character.level,
        subclass: character.subclass
      }];
    }

    const totalLevel = getTotalLevel(classLevels);
    const newTotalLevel = totalLevel + 1;

    // Validate level up is possible
    if (newTotalLevel > 20) {
      return res.status(400).json({ error: 'Character is already at maximum level' });
    }

    if (!canLevelUp(totalLevel, character.experience)) {
      return res.status(400).json({
        error: 'Character does not have enough XP to level up',
        currentXP: character.experience,
        xpNeeded: getXPToNextLevel(totalLevel)
      });
    }

    // Get choices from request body
    const {
      selectedClass, // Which class to level up in (for multiclassing)
      hpRoll, // 'average' or 'roll' with rollValue
      rollValue,
      subclass,
      asiChoice, // { type: 'asi', increases: { str: 1, dex: 1 } } or { type: 'feat', feat: 'Alert' }
      newCantrips, // array of cantrip names to learn
      newSpells, // array of spell names to learn
      swapSpell, // { old: string, new: string } - swap one known spell (Bard, Sorcerer, Warlock, Ranger)
      // Phase 5: progression choices at level-up
      ancestryFeatId // L3/L7/L13/L18 — the feat.id chosen from the 3 options
    } = req.body;

    // Determine which class we're leveling up
    const targetClass = selectedClass || character.class;
    const targetClassName = targetClass.toLowerCase();

    // Check if this is a multiclass (new class) or existing class
    const existingClassIndex = classLevels.findIndex(c => c.class.toLowerCase() === targetClassName);
    const isMulticlass = existingClassIndex === -1;

    // Parse ability scores for HP calculations
    const abilityScores = safeParse(character.ability_scores, {});

    // Note: Multiclass prerequisites are NOT enforced - player can choose any class
    // This is a deliberate design decision to allow player freedom

    // Determine the new class level (used for subclass-required validation below
    // — mutations to classLevels happen only AFTER validation passes)
    const newClassLevel = isMulticlass ? 1 : classLevels[existingClassIndex].level + 1;

    // Validate subclass is provided when the target class requires one at this
    // level AND the character doesn't already have one for this class. This
    // catches the multiclass case (e.g., multiclassing into Cleric at L1
    // requires picking a domain) without spuriously firing when a Fighter
    // at L2 levels to L3 — they already picked Champion at character creation.
    const existingSubclass = isMulticlass ? null : classLevels[existingClassIndex].subclass;
    if (needsSubclassSelection(targetClassName, newClassLevel) && !subclass && !existingSubclass) {
      return res.status(422).json({
        error: `Subclass selection required: ${targetClass} must choose a subclass at level ${newClassLevel}`,
        targetClass,
        newClassLevel
      });
    }

    // Progression decisions at this level-up (Phase 5):
    //   - Theme tier auto-unlock at L5/L11/L17 (no choice, just inserts a row)
    //   - Ancestry feat pick at L3/L7/L13/L18 (requires ancestryFeatId from payload)
    // If the character has no theme (shouldn't happen for post-v1.0.4 characters)
    // or no prior ancestry feat, these decisions silently skip.
    const progressionDecisions = await computeProgressionDecisions(req.params.id, newTotalLevel);

    // Validate that ancestryFeatId was provided when a tier crossing demands one,
    // AND that the provided feat ID is actually one of the offered options.
    if (progressionDecisions.ancestry_feat_tier) {
      if (!ancestryFeatId) {
        return res.status(422).json({
          error: `Ancestry feat selection required at level ${newTotalLevel}`,
          ancestryFeatTier: progressionDecisions.ancestry_feat_tier
        });
      }
      const validIds = new Set(progressionDecisions.ancestry_feat_tier.options.map(o => o.id));
      if (!validIds.has(ancestryFeatId)) {
        return res.status(400).json({
          error: 'Provided ancestryFeatId is not a valid option for this tier',
          validOptions: progressionDecisions.ancestry_feat_tier.options.map(o => o.id)
        });
      }
    }

    // Apply class level / subclass mutations now that validation has passed
    if (isMulticlass) {
      classLevels.push({
        class: targetClass,
        level: 1,
        subclass: subclass || null
      });
    } else {
      classLevels[existingClassIndex].level = newClassLevel;
      if (subclass && !classLevels[existingClassIndex].subclass) {
        classLevels[existingClassIndex].subclass = subclass;
      }
    }

    // Calculate HP gain based on the class being leveled
    const hitDie = HIT_DICE[targetClassName] || 8;
    let conMod = Math.floor((abilityScores.con - 10) / 2);

    let hpGain;
    if (hpRoll === 'roll' && rollValue !== undefined) {
      // Validate roll value
      if (rollValue < 1 || rollValue > hitDie) {
        return res.status(400).json({ error: `Invalid HP roll. Must be between 1 and ${hitDie}` });
      }
      hpGain = Math.max(1, rollValue + conMod); // Minimum 1 HP
    } else {
      // Use average (rounded up)
      hpGain = Math.floor(hitDie / 2) + 1 + conMod;
    }

    // Handle ASI if applicable (based on the class being leveled)
    let newAbilityScores = { ...abilityScores };
    let pendingFeatsJson = null; // Set when feat-instead-of-ASI path is taken
    if (hasASI(targetClassName, newClassLevel) && asiChoice) {
      if (asiChoice.type === 'asi' && asiChoice.increases) {
        // Apply ability score increases (max 20 per ability)
        let totalIncrease = 0;
        for (const [ability, increase] of Object.entries(asiChoice.increases)) {
          if (increase > 0 && newAbilityScores[ability] !== undefined) {
            const newValue = Math.min(20, newAbilityScores[ability] + increase);
            const actualIncrease = newValue - newAbilityScores[ability];
            newAbilityScores[ability] = newValue;
            totalIncrease += actualIncrease;
          }
        }
        // Validate total increase is 2 or less
        if (totalIncrease > 2) {
          return res.status(400).json({ error: 'ASI increases cannot exceed 2 total points' });
        }

        // When CON increases via ASI, apply its HP impact across all levels:
        //   • THIS level's hpGain was computed above with the OLD conMod, so it
        //     needs +modDiff to reflect the new mod at this level.
        //   • All PRIOR levels (newTotalLevel - 1 of them) each need +modDiff
        //     retroactively — per 5e PHB rules, CON increases boost HP for
        //     every level already taken, not just future ones.
        // Combined: +(modDiff × newTotalLevel) HP added to hpGain, which is
        // added to max_hp below.
        if (asiChoice.increases.con) {
          const newConMod = Math.floor((newAbilityScores.con - 10) / 2);
          if (newConMod > conMod) {
            hpGain += (newConMod - conMod) * newTotalLevel;
          }
        }
      } else if (asiChoice.type === 'feat' && asiChoice.feat) {
        // Feat-instead-of-ASI: append the chosen feat to the character's feats
        // JSON array using the same shape as the character creation wizard
        // (so downstream consumers — character sheet, DM prompt — see a unified list).
        const existingFeats = safeParse(character.feats, []);
        existingFeats.push({
          key: asiChoice.feat,
          name: asiChoice.featName || asiChoice.feat,
          abilityChoice: asiChoice.featAbilityChoice || null,
          choices: asiChoice.featChoices || null,
          acquiredAtLevel: newTotalLevel
        });

        // Some feats grant +1 to a chosen ability score (half-ASI feats like
        // Resilient/Actor/Observant). If the feat provides one, apply it now.
        if (asiChoice.featAbilityChoice && newAbilityScores[asiChoice.featAbilityChoice] !== undefined) {
          const ab = asiChoice.featAbilityChoice;
          newAbilityScores[ab] = Math.min(20, newAbilityScores[ab] + 1);
          // Same CON retroactivity rule as the ASI path
          if (ab === 'con') {
            const newConMod = Math.floor((newAbilityScores.con - 10) / 2);
            if (newConMod > conMod) {
              hpGain += (newConMod - conMod) * newTotalLevel;
            }
          }
        }

        // Stash for the transactional write phase below
        pendingFeatsJson = JSON.stringify(existingFeats);
      }
    }

    // Handle subclass selection for the target class
    let newSubclass = character.subclass;
    if (needsSubclassSelection(targetClassName, newClassLevel) && subclass) {
      // classLevels was already updated with the subclass above; just set the
      // legacy top-level subclass field if this is the primary class
      if (targetClassName === character.class.toLowerCase()) {
        newSubclass = subclass;
      }
    }

    // Pre-compute cantrip / spell updates (no DB writes yet — transactional phase below)
    let pendingCantripsJson = null;
    let pendingSpellsJson = null;

    if (newCantrips && Array.isArray(newCantrips) && newCantrips.length > 0) {
      const existingCantrips = safeParse(character.known_cantrips, []);
      pendingCantripsJson = JSON.stringify([...new Set([...existingCantrips, ...newCantrips])]);
    }

    if (newSpells && Array.isArray(newSpells) && newSpells.length > 0) {
      const existingSpells = safeParse(character.known_spells, []);
      let updatedSpells = [...existingSpells];
      if (swapSpell && swapSpell.old && swapSpell.new) {
        updatedSpells = updatedSpells.filter(s => s !== swapSpell.old);
      }
      updatedSpells = [...new Set([...updatedSpells, ...newSpells])];
      pendingSpellsJson = JSON.stringify(updatedSpells);
    } else if (swapSpell && swapSpell.old && swapSpell.new) {
      const existingSpells = safeParse(character.known_spells, []);
      const updatedSpells = existingSpells.filter(s => s !== swapSpell.old);
      updatedSpells.push(swapSpell.new);
      pendingSpellsJson = JSON.stringify(updatedSpells);
    }

    // Keeper-specific pending writes
    const keeperWrites = {};
    if (targetClassName === 'keeper') {
      const { keeperGenreDomain, keeperNewTexts, keeperNewRecitations, keeperSpecialization,
              keeperSecondGenre, keeperGenreMastery, keeperSubclassText } = req.body;

      if (keeperGenreDomain) keeperWrites.genre_domain = keeperGenreDomain;
      if (keeperSecondGenre) keeperWrites.genre_domain_2 = keeperSecondGenre;
      if (keeperGenreMastery) keeperWrites.genre_mastery = 1;

      const allNewTexts = [...(keeperNewTexts || [])];
      if (keeperSubclassText) allNewTexts.push(keeperSubclassText);
      if (allNewTexts.length > 0) {
        const existingTexts = safeParse(character.keeper_texts, []);
        keeperWrites.texts = JSON.stringify([...new Set([...existingTexts, ...allNewTexts])]);
      }

      if (keeperNewRecitations && Array.isArray(keeperNewRecitations) && keeperNewRecitations.length > 0) {
        const existingRec = safeParse(character.keeper_recitations, []);
        keeperWrites.recitations = JSON.stringify([...new Set([...existingRec, ...keeperNewRecitations])]);
      }

      if (keeperSpecialization) keeperWrites.specialization = keeperSpecialization;
    }

    // Compute final character fields
    const newXPToNextLevel = getXPToNextLevel(newTotalLevel);
    const hitDiceBreakdown = getHitDiceBreakdown(classLevels);
    const newMaxHp = character.max_hp + hpGain;
    const newCurrentHp = character.current_hp + hpGain;
    const primaryClass = classLevels.reduce((a, b) => a.level >= b.level ? a : b);

    // ==== Transactional write phase ====
    // All writes happen inside a single transaction. If any write fails, all are
    // rolled back — no more orphaned state where cantrips got added but the level
    // didn't, or Keeper specialization changed but the HP didn't update.
    const tx = await db.transaction('write');
    try {
      if (pendingFeatsJson !== null) {
        await tx.execute({
          sql: 'UPDATE characters SET feats = ? WHERE id = ?',
          args: [pendingFeatsJson, req.params.id]
        });
      }
      if (pendingCantripsJson !== null) {
        await tx.execute({
          sql: 'UPDATE characters SET known_cantrips = ? WHERE id = ?',
          args: [pendingCantripsJson, req.params.id]
        });
      }
      if (pendingSpellsJson !== null) {
        await tx.execute({
          sql: 'UPDATE characters SET known_spells = ? WHERE id = ?',
          args: [pendingSpellsJson, req.params.id]
        });
      }
      if (keeperWrites.genre_domain) {
        await tx.execute({
          sql: 'UPDATE characters SET keeper_genre_domain = ? WHERE id = ?',
          args: [keeperWrites.genre_domain, req.params.id]
        });
      }
      if (keeperWrites.genre_domain_2) {
        await tx.execute({
          sql: 'UPDATE characters SET keeper_genre_domain_2 = ? WHERE id = ?',
          args: [keeperWrites.genre_domain_2, req.params.id]
        });
      }
      if (keeperWrites.genre_mastery) {
        await tx.execute({
          sql: 'UPDATE characters SET keeper_genre_mastery = 1 WHERE id = ?',
          args: [req.params.id]
        });
      }
      if (keeperWrites.texts) {
        await tx.execute({
          sql: 'UPDATE characters SET keeper_texts = ? WHERE id = ?',
          args: [keeperWrites.texts, req.params.id]
        });
      }
      if (keeperWrites.recitations) {
        await tx.execute({
          sql: 'UPDATE characters SET keeper_recitations = ? WHERE id = ?',
          args: [keeperWrites.recitations, req.params.id]
        });
      }
      if (keeperWrites.specialization) {
        await tx.execute({
          sql: 'UPDATE characters SET keeper_specialization = ? WHERE id = ?',
          args: [keeperWrites.specialization, req.params.id]
        });
      }

      // Main character update (level, HP, class_levels, etc.)
      await tx.execute({
        sql: `UPDATE characters
              SET level = ?, class = ?, max_hp = ?, current_hp = ?,
                  ability_scores = ?, subclass = ?, class_levels = ?,
                  hit_dice = ?, experience_to_next_level = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [
          newTotalLevel,
          primaryClass.class,
          newMaxHp,
          newCurrentHp,
          JSON.stringify(newAbilityScores),
          primaryClass.subclass || newSubclass,
          JSON.stringify(classLevels),
          JSON.stringify(hitDiceBreakdown),
          newXPToNextLevel,
          req.params.id
        ]
      });

      // Phase 5: progression unlocks (theme tier + ancestry feat)
      if (progressionDecisions.theme_tier_unlock) {
        const unlock = progressionDecisions.theme_tier_unlock;
        await tx.execute({
          sql: `INSERT OR REPLACE INTO character_theme_unlocks
                (character_id, theme_id, tier, tier_ability_id, unlocked_at_level, narrative_delivery)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            req.params.id,
            unlock.theme_id,
            unlock.tier,
            unlock.tier_ability_id,
            newTotalLevel,
            `Unlocked at level ${newTotalLevel} during level-up.`
          ]
        });
      }
      if (progressionDecisions.ancestry_feat_tier && ancestryFeatId) {
        await tx.execute({
          sql: `INSERT OR REPLACE INTO character_ancestry_feats
                (character_id, feat_id, tier, selected_at_level, narrative_delivery)
                VALUES (?, ?, ?, ?, ?)`,
          args: [
            req.params.id,
            ancestryFeatId,
            progressionDecisions.ancestry_feat_tier.tier,
            newTotalLevel,
            `Selected during level-up at level ${newTotalLevel}.`
          ]
        });
      }

      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);

    // Get features gained
    const newFeatures = getClassFeatures(targetClassName, newClassLevel);

    // Build class display string (e.g., "Fighter 5 / Rogue 2")
    const classDisplay = classLevels.map(c => `${c.class} ${c.level}`).join(' / ');

    res.json({
      message: `Congratulations! ${character.name} is now ${classDisplay}!`,
      character: updatedCharacter,
      levelUpSummary: {
        previousLevel: totalLevel,
        newLevel: newTotalLevel,
        leveledClass: targetClass,
        newClassLevel,
        isMulticlass,
        classLevels,
        classDisplay,
        hpGained: hpGain,
        newMaxHp,
        hitDice: hitDiceBreakdown,
        newFeatures,
        proficiencyBonus: PROFICIENCY_BONUS[newTotalLevel],
        abilityScoreChanges: asiChoice?.type === 'asi' ? asiChoice.increases : null,
        newSubclass: subclass || null,
        themeTierUnlocked: progressionDecisions.theme_tier_unlock || null,
        ancestryFeatSelected: (progressionDecisions.ancestry_feat_tier && ancestryFeatId)
          ? progressionDecisions.ancestry_feat_tier.options.find(o => o.id === ancestryFeatId) || null
          : null
      }
    });
  } catch (error) {
    handleServerError(res, error, 'level up character');
  }
});

// Get the character's current campaign
router.get('/:id/campaign', async (req, res) => {
  try {
    const character = await dbGet('SELECT id, name, campaign_id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    if (!character.campaign_id) {
      return res.json({ campaign: null });
    }

    const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [character.campaign_id]);
    res.json({ campaign });
  } catch (error) {
    handleServerError(res, error, 'fetch character campaign');
  }
});

// Assign character to a campaign
router.put('/:id/campaign', async (req, res) => {
  try {
    const { campaign_id } = req.body;

    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    if (campaign_id) {
      const campaign = await dbGet('SELECT id FROM campaigns WHERE id = ?', [campaign_id]);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
    }

    await dbRun(`
      UPDATE characters
      SET campaign_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [campaign_id || null, req.params.id]);

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    res.json(updatedCharacter);
  } catch (error) {
    handleServerError(res, error, 'assign character to campaign');
  }
});

// Remove character from campaign
router.delete('/:id/campaign', async (req, res) => {
  try {
    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    await dbRun(`
      UPDATE characters
      SET campaign_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.params.id]);

    res.json({ success: true, message: 'Character removed from campaign' });
  } catch (error) {
    handleServerError(res, error, 'remove character from campaign');
  }
});

// ============================================================
// CHARACTER QUEST TRACKING
// ============================================================

// Get all quests for a character
router.get('/:id/quests', async (req, res) => {
  try {
    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const { type, status } = req.query;
    let quests;

    if (type) {
      quests = await questService.getQuestsByType(req.params.id, type);
    } else if (status === 'active') {
      quests = await questService.getActiveQuests(req.params.id);
    } else {
      quests = await questService.getCharacterQuests(req.params.id);
    }

    res.json(quests);
  } catch (error) {
    handleServerError(res, error, 'fetch quests');
  }
});

// Get only active quests for a character
router.get('/:id/quests/active', async (req, res) => {
  try {
    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const quests = await questService.getActiveQuests(req.params.id);
    res.json(quests);
  } catch (error) {
    handleServerError(res, error, 'fetch active quests');
  }
});

// Get the character's main quest
router.get('/:id/quests/main', async (req, res) => {
  try {
    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const quest = await questService.getMainQuest(req.params.id);
    res.json(quest);
  } catch (error) {
    handleServerError(res, error, 'fetch main quest');
  }
});

// Get quest summary for a character (counts by type and status)
router.get('/:id/quests/summary', async (req, res) => {
  try {
    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const allQuests = await questService.getCharacterQuests(req.params.id);

    const summary = {
      total: allQuests.length,
      byStatus: {
        active: allQuests.filter(q => q.status === 'active').length,
        completed: allQuests.filter(q => q.status === 'completed').length,
        failed: allQuests.filter(q => q.status === 'failed').length,
        abandoned: allQuests.filter(q => q.status === 'abandoned').length
      },
      byType: {
        main: allQuests.filter(q => q.quest_type === 'main').length,
        side: allQuests.filter(q => q.quest_type === 'side').length,
        companion: allQuests.filter(q => q.quest_type === 'companion').length,
        one_time: allQuests.filter(q => q.quest_type === 'one_time').length
      },
      hasMainQuest: allQuests.some(q => q.quest_type === 'main' && q.status === 'active')
    };

    res.json(summary);
  } catch (error) {
    handleServerError(res, error, 'fetch quest summary');
  }
});

// Get campaign notes for a character
router.get('/:id/campaign-notes', async (req, res) => {
  try {
    const character = await dbGet('SELECT id, name, campaign_notes, character_memories FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    res.json({
      characterId: character.id,
      characterName: character.name,
      notes: character.campaign_notes || '',
      characterMemories: character.character_memories || ''
    });
  } catch (error) {
    handleServerError(res, error, 'fetch campaign notes');
  }
});

// Update campaign notes for a character
router.put('/:id/campaign-notes', async (req, res) => {
  try {
    const { notes } = req.body;
    if (typeof notes !== 'string') {
      return res.status(400).json({ error: 'Notes must be a string' });
    }

    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    await dbRun(`
      UPDATE characters
      SET campaign_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [notes, req.params.id]);

    res.json({
      success: true,
      message: 'Campaign notes updated'
    });
  } catch (error) {
    handleServerError(res, error, 'update campaign notes');
  }
});

// Generate campaign notes from session history (for retroactive population)
router.post('/:id/generate-campaign-notes', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get all completed sessions with their messages
    const sessions = await dbAll(`
      SELECT id, title, summary, messages, setting, start_time, end_time,
             game_start_day, game_start_year, game_end_day, game_end_year
      FROM dm_sessions
      WHERE character_id = ? AND status = 'completed' AND rewards_claimed = 1
      ORDER BY created_at ASC
      LIMIT 10
    `, [req.params.id]);

    if (sessions.length === 0) {
      return res.json({
        success: true,
        notes: '',
        message: 'No completed sessions found to generate notes from'
      });
    }

    // Import LLM services dynamically to avoid circular dependencies
    const claude = (await import('../services/claude.js')).default;
    const ollama = (await import('../services/ollama.js')).default;

    // Determine which LLM provider to use
    let provider = null;
    if (claude.isClaudeAvailable()) {
      const status = await claude.checkClaudeStatus();
      if (status.available) provider = 'claude';
    }
    if (!provider) {
      const ollamaStatus = await ollama.checkOllamaStatus();
      if (ollamaStatus.available) provider = 'ollama';
    }

    if (!provider) {
      return res.status(503).json({ error: 'No LLM provider available' });
    }

    // Build context from session summaries and key messages
    let sessionContext = '';
    for (const session of sessions) {
      sessionContext += `\n=== Session: ${session.title} ===\n`;
      if (session.summary) {
        sessionContext += `Summary: ${session.summary}\n`;
      }

      // Parse messages to extract key narrative moments
      try {
        const messages = JSON.parse(session.messages || '[]');
        // Get the last few assistant messages (narrative) for context
        const narrativeMessages = messages
          .filter(m => m.role === 'assistant')
          .slice(-3)
          .map(m => m.content)
          .join('\n---\n');
        if (narrativeMessages) {
          sessionContext += `Key moments:\n${narrativeMessages.substring(0, 2000)}\n`;
        }
      } catch (e) {
        // Skip if messages can't be parsed
      }
    }

    const extractionPrompt = `Based on these adventure sessions for the character "${character.nickname || character.name}", extract and organize the important campaign details that should be remembered.

${sessionContext}

Format your response as organized notes under these categories (skip empty categories):

## NPCs Met
- [Name]: [Brief description, relationship, any deals or promises]

## Items Given or Received
- [What was exchanged, with whom, why it matters]

## Promises & Obligations
- [What was promised, to whom, current status]

## Key Relationships
- [Person/Faction]: [Nature of relationship - ally, enemy, employer, etc.]

## Important Locations
- [Place]: [Why it matters to this character]

## Ongoing Quests & Threads
- [Plot hooks, mysteries, or tasks in progress]

## Key Events
- [Major things that happened that shape the story]

Be concise but specific. Use names and details from the sessions. Only include things that actually happened.`;

    let generatedNotes = '';
    if (provider === 'claude') {
      generatedNotes = await claude.chat('You are a helpful assistant organizing campaign notes for a D&D character.', [
        { role: 'user', content: extractionPrompt }
      ]);
    } else {
      generatedNotes = await ollama.chat([
        { role: 'system', content: 'You are a helpful assistant organizing campaign notes for a D&D character.' },
        { role: 'user', content: extractionPrompt }
      ]);
    }

    // Prepend with a header indicating this was auto-generated
    const existingNotes = character.campaign_notes || '';
    const header = `# Campaign Memory for ${character.nickname || character.name}\n*Auto-generated from ${sessions.length} session(s)*\n\n`;

    // Extract any "My Notes" section from existing notes to preserve player edits
    // Look for ## My Notes, ## Player Notes, or ---\n## My Notes patterns
    let playerNotes = '';
    const playerNotesPatterns = [
      /\n---\n## My Notes\n([\s\S]*)$/i,
      /\n## My Notes\n([\s\S]*)$/i,
      /\n---\n## Player Notes\n([\s\S]*)$/i,
      /\n## Player Notes\n([\s\S]*)$/i
    ];

    for (const pattern of playerNotesPatterns) {
      const match = existingNotes.match(pattern);
      if (match) {
        playerNotes = match[1].trim();
        break;
      }
    }

    // Build final notes: auto-generated + player notes section
    let finalNotes = header + generatedNotes.trim();

    // Always include a player notes section (empty or with existing content)
    finalNotes += '\n\n---\n## My Notes\n*Your personal additions - this section is preserved when regenerating*\n\n';
    if (playerNotes) {
      // Remove the italicized instruction if it was already there
      const cleanedPlayerNotes = playerNotes.replace(/^\*Your personal additions.*\*\n*/i, '').trim();
      if (cleanedPlayerNotes) {
        finalNotes += cleanedPlayerNotes;
      }
    }

    // Save the generated notes
    await dbRun(`
      UPDATE characters
      SET campaign_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [finalNotes, req.params.id]);

    res.json({
      success: true,
      notes: finalNotes,
      sessionsProcessed: sessions.length,
      message: `Generated campaign notes from ${sessions.length} session(s)`
    });
  } catch (error) {
    handleServerError(res, error, 'generate campaign notes');
  }
});

// ============================================================
// PARSED BACKSTORY ROUTES
// ============================================================

// GET /api/character/:id/parsed-backstory - Get the parsed backstory
router.get('/:id/parsed-backstory', async (req, res) => {
  try {
    const parsed = await backstoryParserService.getParsedBackstory(req.params.id);
    res.json(parsed);
  } catch (error) {
    handleServerError(res, error, 'fetch parsed backstory');
  }
});

// POST /api/character/:id/parsed-backstory/parse - Parse or re-parse the backstory
router.post('/:id/parsed-backstory/parse', async (req, res) => {
  try {
    const { preserveManualEdits = false } = req.body;

    let parsed;
    if (preserveManualEdits) {
      parsed = await backstoryParserService.reparseBackstory(req.params.id, true);
    } else {
      parsed = await backstoryParserService.parseBackstory(req.params.id);
    }

    res.json(parsed);
  } catch (error) {
    handleServerError(res, error, 'parse backstory');
  }
});

// PUT /api/character/:id/parsed-backstory/:elementType/:elementId - Update a specific element
router.put('/:id/parsed-backstory/:elementType/:elementId', async (req, res) => {
  try {
    const { elementType, elementId } = req.params;
    const updates = req.body;

    const parsed = await backstoryParserService.updateElement(
      req.params.id,
      elementType,
      elementId,
      updates
    );
    res.json(parsed);
  } catch (error) {
    handleServerError(res, error, 'update backstory element');
  }
});

// POST /api/character/:id/parsed-backstory/:elementType - Add a new element
router.post('/:id/parsed-backstory/:elementType', async (req, res) => {
  try {
    const { elementType } = req.params;
    const element = req.body;

    const parsed = await backstoryParserService.addElement(
      req.params.id,
      elementType,
      element
    );
    res.json(parsed);
  } catch (error) {
    handleServerError(res, error, 'add backstory element');
  }
});

// DELETE /api/character/:id/parsed-backstory/:elementType/:elementId - Remove an element
router.delete('/:id/parsed-backstory/:elementType/:elementId', async (req, res) => {
  try {
    const { elementType, elementId } = req.params;

    const parsed = await backstoryParserService.removeElement(
      req.params.id,
      elementType,
      elementId
    );
    res.json(parsed);
  } catch (error) {
    handleServerError(res, error, 'remove backstory element');
  }
});

// Get player journal - aggregates discovered world knowledge
router.get('/:id/journal', async (req, res) => {
  try {
    const character = await dbGet(
      'SELECT id, name, campaign_id, campaign_notes FROM characters WHERE id = ?',
      [req.params.id]
    );
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const campaignId = character.campaign_id;

    // Fetch all data sources in parallel
    const [relationships, allLocations, standings, visibleGoals, quests, visibleEvents] = await Promise.all([
      getCharacterRelationshipsWithNpcs(character.id).catch(() => []),
      campaignId ? getCampaignLocations(campaignId).catch(() => []) : [],
      getCharacterStandings(character.id).catch(() => []),
      getGoalsVisibleToCharacter(character.id).catch(() => []),
      questService.getCharacterQuests(character.id).catch(() => []),
      getEventsVisibleToCharacter(character.id).catch(() => [])
    ]);

    // Get campaign plan for unknown counts
    let campaignPlan = null;
    if (campaignId) {
      const campaign = await dbGet('SELECT campaign_plan FROM campaigns WHERE id = ?', [campaignId]);
      if (campaign?.campaign_plan) {
        try {
          campaignPlan = typeof campaign.campaign_plan === 'string'
            ? JSON.parse(campaign.campaign_plan)
            : campaign.campaign_plan;
        } catch (e) { /* ignore parse errors */ }
      }
    }

    // NPCs: met (have relationships) vs total in campaign plan
    const metNpcs = relationships.map(r => ({
      name: r.npc_name,
      race: r.npc_race,
      occupation: r.npc_occupation,
      location: r.npc_location,
      avatar: r.npc_avatar,
      disposition: r.disposition_label,
      lifecycleStatus: r.npc_lifecycle_status || 'alive',
      timesMet: r.times_met,
      knownFacts: r.player_known_facts || [],
      discoveredSecrets: r.discovered_secrets || [],
      promises: r.promises_made || [],
      debts: r.debts_owed || []
    }));
    const totalPlanNpcs = campaignPlan?.npcs?.length || 0;

    // Locations: group by discovery status
    const discoveredLocations = allLocations.filter(l => l.discovery_status !== 'unknown');
    const locations = {
      visited: allLocations.filter(l => ['visited', 'familiar', 'home_base'].includes(l.discovery_status)).map(l => ({
        name: l.name,
        type: l.location_type,
        region: l.region,
        description: l.description,
        status: l.discovery_status,
        timesVisited: l.times_visited,
        services: l.services || [],
        tags: l.tags || []
      })),
      rumored: allLocations.filter(l => l.discovery_status === 'rumored').map(l => ({
        name: l.name,
        type: l.location_type,
        region: l.region
      })),
      unknownCount: allLocations.filter(l => l.discovery_status === 'unknown').length
    };

    // Factions
    const factions = standings.map(s => ({
      name: s.faction_name,
      symbol: s.symbol,
      standing: s.standing,
      standingLabel: s.standing_label,
      isMember: s.is_member,
      rank: s.rank,
      knownMembers: s.known_members || [],
      knownGoals: s.known_goals || [],
      knownSecrets: s.known_secrets || [],
      goals: visibleGoals.filter(g => g.faction_id === s.faction_id).map(g => ({
        title: g.title,
        description: g.description,
        progress: g.progress,
        progressMax: g.progress_max,
        status: g.status,
        visibility: g.visibility
      }))
    }));

    // Quests
    const activeQuests = quests.filter(q => q.status === 'active').map(q => ({
      title: q.title,
      premise: q.premise,
      type: q.quest_type,
      priority: q.priority,
      currentStage: q.current_stage,
      stages: q.stages || [],
      timeSensitive: q.time_sensitive,
      rewards: q.rewards
    }));
    const completedQuests = quests.filter(q => q.status === 'completed').map(q => ({
      title: q.title,
      premise: q.premise,
      type: q.quest_type,
      completedAt: q.completed_at
    }));

    // World Events
    const events = visibleEvents.map(e => ({
      title: e.title,
      description: e.description,
      type: e.event_type,
      scope: e.scope,
      status: e.status,
      visibility: e.visibility,
      affectedLocations: e.affected_locations || [],
      affectedFactions: e.affected_factions || []
    }));

    // Parse campaign_notes into sections
    const notes = character.campaign_notes || '';

    res.json({
      npcs: { met: metNpcs, unknownCount: Math.max(0, totalPlanNpcs - metNpcs.length) },
      locations,
      factions,
      quests: { active: activeQuests, completed: completedQuests },
      events,
      notes
    });
  } catch (error) {
    handleServerError(res, error, 'get player journal');
  }
});

export default router;
