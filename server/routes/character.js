import express from 'express';
import { dbAll, dbGet, dbRun } from '../database.js';
import * as questService from '../services/questService.js';
import * as backstoryParserService from '../services/backstoryParserService.js';
import { handleServerError, notFound, validationError } from '../utils/errorHandler.js';
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
      tool_proficiencies = '[]'
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
        known_cantrips, known_spells, feats, languages, tool_proficiencies
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      known_cantrips, known_spells, feats, languages, tool_proficiencies
    ]);

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(character);
  } catch (error) {
    handleServerError(res, error, 'create character');
  }
});

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
      'campaign_config', 'languages', 'tool_proficiencies'
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

// Delete character
router.delete('/:id', async (req, res) => {
  try {
    // Delete all related records first (to satisfy foreign key constraints)
    await dbRun('DELETE FROM dm_sessions WHERE character_id = ?', [req.params.id]);
    await dbRun('DELETE FROM adventures WHERE character_id = ?', [req.params.id]);

    // Then delete the character
    await dbRun('DELETE FROM characters WHERE id = ?', [req.params.id]);

    res.json({ message: 'Character deleted successfully' });
  } catch (error) {
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

    let inventory = JSON.parse(character.inventory || '[]');
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
    res.status(500).json({ error: error.message });
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
    const spellSlotsUsed = JSON.parse(character.spell_slots_used || '{}');

    res.json({
      max: spellSlots,
      used: spellSlotsUsed,
      class: character.class,
      level: character.level
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const usedSlots = JSON.parse(character.spell_slots_used || '{}');

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
    res.status(500).json({ error: error.message });
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
    const usedSlots = JSON.parse(character.spell_slots_used || '{}');

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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    let classLevels = character.class_levels ? JSON.parse(character.class_levels) : null;

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

    const abilityScores = JSON.parse(character.ability_scores || '{}');

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
      // Legacy fields for backward compatibility
      className: character.class,
      subclass: character.subclass,
      newFeatures: classOptions.length > 0 ? classOptions[0].newFeatures : [],
      choices: classOptions.length > 0 ? classOptions[0].choices : {},
      hpGain: classOptions.length > 0 ? classOptions[0].hpGain : {},
      subclassLevel: SUBCLASS_LEVELS[character.class.toLowerCase()]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute level up with choices
router.post('/level-up/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Parse existing class_levels or create from legacy data
    let classLevels = character.class_levels ? JSON.parse(character.class_levels) : null;
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
      cantrips: _cantrips, // array of cantrip names (TODO: implement spell tracking)
      spells: _spells // array of spell names (TODO: implement spell tracking)
    } = req.body;

    // Note: cantrips and spells are received but spell tracking is not yet implemented
    void _cantrips;
    void _spells;

    // Determine which class we're leveling up
    const targetClass = selectedClass || character.class;
    const targetClassName = targetClass.toLowerCase();

    // Check if this is a multiclass (new class) or existing class
    const existingClassIndex = classLevels.findIndex(c => c.class.toLowerCase() === targetClassName);
    const isMulticlass = existingClassIndex === -1;

    // Parse ability scores for HP calculations
    const abilityScores = JSON.parse(character.ability_scores || '{}');

    // Note: Multiclass prerequisites are NOT enforced - player can choose any class
    // This is a deliberate design decision to allow player freedom

    // Determine the new class level
    let newClassLevel;
    if (isMulticlass) {
      newClassLevel = 1;
      classLevels.push({
        class: targetClass,
        level: 1,
        subclass: subclass || null
      });
    } else {
      newClassLevel = classLevels[existingClassIndex].level + 1;
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

        // Recalculate CON modifier if CON was increased (affects HP)
        if (asiChoice.increases.con) {
          const newConMod = Math.floor((newAbilityScores.con - 10) / 2);
          // If CON mod increased, we get retroactive HP for all levels
          if (newConMod > conMod) {
            hpGain += (newConMod - conMod) * newTotalLevel; // Retroactive HP for CON increase
          }
        }
      }
      // Note: Feat handling would go here - for now we just store the choice
    }

    // Handle subclass selection for the target class
    let newSubclass = character.subclass;
    if (needsSubclassSelection(targetClassName, newClassLevel) && subclass) {
      if (isMulticlass) {
        // For multiclass, subclass is already set above
      } else if (!classLevels[existingClassIndex].subclass) {
        classLevels[existingClassIndex].subclass = subclass;
      }
      // Update legacy subclass field if this is the primary class
      if (targetClassName === character.class.toLowerCase()) {
        newSubclass = subclass;
      }
    }

    // Calculate new XP to next level (based on total level)
    const newXPToNextLevel = getXPToNextLevel(newTotalLevel);

    // Calculate hit dice breakdown
    const hitDiceBreakdown = getHitDiceBreakdown(classLevels);

    // Update the character
    const newMaxHp = character.max_hp + hpGain;
    const newCurrentHp = character.current_hp + hpGain; // Heal the HP gained

    // Determine the "primary" class for legacy field (highest level class)
    const primaryClass = classLevels.reduce((a, b) => a.level >= b.level ? a : b);

    await dbRun(`
      UPDATE characters
      SET level = ?,
          class = ?,
          max_hp = ?,
          current_hp = ?,
          ability_scores = ?,
          subclass = ?,
          class_levels = ?,
          hit_dice = ?,
          experience_to_next_level = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
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
    ]);

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
        newSubclass: subclass || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Get campaign notes for a character
router.get('/:id/campaign-notes', async (req, res) => {
  try {
    const character = await dbGet('SELECT id, name, campaign_notes FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    res.json({
      characterId: character.id,
      characterName: character.name,
      notes: character.campaign_notes || ''
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
      ], 'llama3.1:8b');
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
    console.error('Error generating campaign notes:', error);
    res.status(500).json({ error: error.message });
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

export default router;
