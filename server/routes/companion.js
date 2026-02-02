import express from 'express';
import { dbAll, dbGet, dbRun } from '../database.js';
import {
  HIT_DICE,
  PROFICIENCY_BONUS,
  getClassFeatures,
  hasASI,
  SUBCLASS_LEVELS
} from '../config/levelProgression.js';

const router = express.Router();

// Get all companions for a character
router.get('/character/:characterId', async (req, res) => {
  try {
    const companions = await dbAll(`
      SELECT c.*, c.inventory as companion_inventory, c.gold_gp, c.gold_sp, c.gold_cp, c.equipment,
             c.skill_proficiencies,
             n.name, n.nickname, n.race, n.gender, n.age, n.occupation,
             n.stat_block, n.cr, n.ac, n.hp, n.speed, n.ability_scores as npc_ability_scores,
             n.skills as npc_skills, n.avatar, n.personality_trait_1, n.personality_trait_2,
             n.voice, n.mannerism, n.motivation, n.current_location,
             n.height, n.build, n.hair_color, n.hair_style, n.eye_color, n.skin_tone,
             n.distinguishing_marks, n.background_notes, n.relationship_to_party
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.recruited_by_character_id = ? AND c.status = 'active'
      ORDER BY c.recruited_at DESC
    `, [req.params.characterId]);

    res.json(companions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single companion with full details
router.get('/:id', async (req, res) => {
  try {
    const companion = await dbGet(`
      SELECT c.*, c.inventory as companion_inventory, c.gold_gp, c.gold_sp, c.gold_cp, c.equipment,
             c.skill_proficiencies,
             n.name, n.nickname, n.race, n.gender, n.age, n.occupation,
             n.stat_block, n.cr, n.ac, n.hp, n.speed, n.ability_scores as npc_ability_scores,
             n.skills as npc_skills, n.avatar, n.personality_trait_1, n.personality_trait_2,
             n.voice, n.mannerism, n.motivation, n.fear, n.secret, n.current_location,
             n.height, n.build, n.hair_color, n.hair_style, n.eye_color, n.skin_tone,
             n.distinguishing_marks, n.background_notes, n.relationship_to_party
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!companion) {
      return res.status(404).json({ error: 'Companion not found' });
    }

    res.json(companion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recruit an NPC as a companion
router.post('/recruit', async (req, res) => {
  try {
    const {
      npc_id,
      recruited_by_character_id,
      recruited_session_id,
      progression_type = 'npc_stats', // 'npc_stats' or 'class_based'
      companion_class = null,
      companion_subclass = null,
      starting_level = null,
      notes = null
    } = req.body;

    // Verify NPC exists and is available as companion
    const npc = await dbGet('SELECT * FROM npcs WHERE id = ?', [npc_id]);
    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    // Check if this NPC is already a companion for this character
    const existingCompanion = await dbGet(`
      SELECT * FROM companions
      WHERE npc_id = ? AND recruited_by_character_id = ? AND status = 'active'
    `, [npc_id, recruited_by_character_id]);

    if (existingCompanion) {
      return res.status(400).json({ error: 'This NPC is already a companion' });
    }

    // Get recruiting character's level for class-based companions
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [recruited_by_character_id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Snapshot the NPC's current stats
    const originalStatsSnapshot = JSON.stringify({
      name: npc.name,
      stat_block: npc.stat_block,
      cr: npc.cr,
      ac: npc.ac,
      hp: npc.hp,
      speed: npc.speed,
      ability_scores: npc.ability_scores,
      skills: npc.skills
    });

    // Calculate companion stats based on progression type
    let companionLevel = null;
    let companionMaxHp = null;
    let companionCurrentHp = null;
    let companionAbilityScores = null;

    if (progression_type === 'class_based' && companion_class) {
      // Start at character's level or specified level
      companionLevel = starting_level || character.level;

      // Parse NPC ability scores or use defaults
      const abilityScores = npc.ability_scores ? JSON.parse(npc.ability_scores) : {
        str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
      };
      companionAbilityScores = JSON.stringify(abilityScores);

      // Calculate HP based on class and level
      const hitDie = HIT_DICE[companion_class.toLowerCase()] || 8;
      const conMod = Math.floor((abilityScores.con - 10) / 2);

      // Level 1: max hit die + con mod
      // Levels 2+: average + con mod
      companionMaxHp = hitDie + conMod; // Level 1
      for (let lvl = 2; lvl <= companionLevel; lvl++) {
        companionMaxHp += Math.floor(hitDie / 2) + 1 + conMod;
      }
      companionMaxHp = Math.max(companionMaxHp, 1); // Minimum 1 HP
      companionCurrentHp = companionMaxHp;
    }

    // Insert the companion
    const result = await dbRun(`
      INSERT INTO companions (
        npc_id, recruited_by_character_id, recruited_session_id,
        progression_type, original_stats_snapshot,
        companion_class, companion_subclass, companion_level, companion_max_hp, companion_current_hp,
        companion_ability_scores, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [
      npc_id,
      recruited_by_character_id,
      recruited_session_id || null,
      progression_type,
      originalStatsSnapshot,
      companion_class,
      companion_subclass,
      companionLevel,
      companionMaxHp,
      companionCurrentHp,
      companionAbilityScores,
      notes
    ]);

    // Fetch the created companion with NPC details
    const companion = await dbGet(`
      SELECT c.*, n.name, n.nickname, n.race, n.gender, n.occupation,
             n.avatar, n.personality_trait_1, n.personality_trait_2
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({
      message: `${npc.name} has joined your party!`,
      companion
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update companion
router.put('/:id', async (req, res) => {
  try {
    const updates = [];
    const values = [];

    const allowedFields = [
      'companion_class', 'companion_level', 'companion_subclass',
      'companion_max_hp', 'companion_current_hp', 'companion_ability_scores',
      'progression_type', 'status', 'notes', 'skill_proficiencies',
      'inventory', 'gold_gp', 'gold_sp', 'gold_cp', 'equipment',
      // Character-like fields
      'alignment', 'faith', 'lifestyle', 'ideals', 'bonds', 'flaws',
      'armor_class', 'speed', 'subrace', 'background'
    ];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(req.params.id);

    await dbRun(`UPDATE companions SET ${updates.join(', ')} WHERE id = ?`, values);

    const companion = await dbGet(`
      SELECT c.*, c.inventory as companion_inventory, c.gold_gp, c.gold_sp, c.gold_cp, c.equipment,
             n.name, n.nickname, n.race, n.gender, n.occupation, n.avatar
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    res.json(companion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Convert NPC-stats companion to class-based
router.post('/:id/convert-to-class', async (req, res) => {
  try {
    const { companion_class, starting_level } = req.body;

    if (!companion_class) {
      return res.status(400).json({ error: 'companion_class is required' });
    }

    const companion = await dbGet(`
      SELECT c.*, n.ability_scores as npc_ability_scores
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!companion) {
      return res.status(404).json({ error: 'Companion not found' });
    }

    if (companion.progression_type === 'class_based') {
      return res.status(400).json({ error: 'Companion is already class-based' });
    }

    // Get recruiting character's level
    const character = await dbGet('SELECT level FROM characters WHERE id = ?', [companion.recruited_by_character_id]);

    const companionLevel = starting_level || character?.level || 1;

    // Parse ability scores
    const abilityScores = companion.npc_ability_scores
      ? JSON.parse(companion.npc_ability_scores)
      : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

    // Calculate HP
    const hitDie = HIT_DICE[companion_class.toLowerCase()] || 8;
    const conMod = Math.floor((abilityScores.con - 10) / 2);

    let companionMaxHp = hitDie + conMod; // Level 1
    for (let lvl = 2; lvl <= companionLevel; lvl++) {
      companionMaxHp += Math.floor(hitDie / 2) + 1 + conMod;
    }
    companionMaxHp = Math.max(companionMaxHp, 1);

    await dbRun(`
      UPDATE companions SET
        progression_type = 'class_based',
        companion_class = ?,
        companion_level = ?,
        companion_max_hp = ?,
        companion_current_hp = ?,
        companion_ability_scores = ?
      WHERE id = ?
    `, [
      companion_class,
      companionLevel,
      companionMaxHp,
      companionMaxHp,
      JSON.stringify(abilityScores),
      req.params.id
    ]);

    const updatedCompanion = await dbGet(`
      SELECT c.*, n.name, n.nickname, n.race, n.gender, n.occupation, n.avatar
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    res.json({
      message: 'Companion converted to class-based progression',
      companion: updatedCompanion
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Level up companion (class-based only)
router.post('/:id/level-up', async (req, res) => {
  try {
    const companion = await dbGet(`
      SELECT c.*, n.name
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!companion) {
      return res.status(404).json({ error: 'Companion not found' });
    }

    if (companion.progression_type !== 'class_based') {
      return res.status(400).json({
        error: 'Only class-based companions can level up. Convert to class-based first.'
      });
    }

    const currentLevel = companion.companion_level;
    const newLevel = currentLevel + 1;

    if (newLevel > 20) {
      return res.status(400).json({ error: 'Companion is already at maximum level' });
    }

    const {
      hpRoll = 'average',
      rollValue,
      subclass,
      asiChoice
    } = req.body;

    const className = companion.companion_class.toLowerCase();
    const abilityScores = companion.companion_ability_scores
      ? JSON.parse(companion.companion_ability_scores)
      : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

    // Calculate HP gain
    const hitDie = HIT_DICE[className] || 8;
    let conMod = Math.floor((abilityScores.con - 10) / 2);

    let hpGain;
    if (hpRoll === 'roll' && rollValue !== undefined) {
      if (rollValue < 1 || rollValue > hitDie) {
        return res.status(400).json({ error: `Invalid HP roll. Must be between 1 and ${hitDie}` });
      }
      hpGain = Math.max(1, rollValue + conMod);
    } else {
      hpGain = Math.floor(hitDie / 2) + 1 + conMod;
    }

    // Handle ASI
    let newAbilityScores = { ...abilityScores };
    if (hasASI(className, newLevel) && asiChoice) {
      if (asiChoice.type === 'asi' && asiChoice.increases) {
        let totalIncrease = 0;
        for (const [ability, increase] of Object.entries(asiChoice.increases)) {
          if (increase > 0 && newAbilityScores[ability] !== undefined) {
            const newValue = Math.min(20, newAbilityScores[ability] + increase);
            const actualIncrease = newValue - newAbilityScores[ability];
            newAbilityScores[ability] = newValue;
            totalIncrease += actualIncrease;
          }
        }
        if (totalIncrease > 2) {
          return res.status(400).json({ error: 'ASI increases cannot exceed 2 total points' });
        }
        // Retroactive HP for CON increase
        if (asiChoice.increases.con) {
          const newConMod = Math.floor((newAbilityScores.con - 10) / 2);
          if (newConMod > conMod) {
            hpGain += (newConMod - conMod) * newLevel;
          }
        }
      }
    }

    // Handle subclass - allow selection if:
    // 1. At the exact subclass level, OR
    // 2. Past subclass level but never selected one (e.g., created at higher level)
    let newSubclass = companion.companion_subclass;
    const subclassLevel = SUBCLASS_LEVELS[className] || 3;
    if (!companion.companion_subclass && currentLevel >= subclassLevel && subclass) {
      newSubclass = subclass;
    }

    const newMaxHp = companion.companion_max_hp + hpGain;
    const newCurrentHp = companion.companion_current_hp + hpGain;

    await dbRun(`
      UPDATE companions SET
        companion_level = ?,
        companion_max_hp = ?,
        companion_current_hp = ?,
        companion_ability_scores = ?,
        companion_subclass = ?
      WHERE id = ?
    `, [
      newLevel,
      newMaxHp,
      newCurrentHp,
      JSON.stringify(newAbilityScores),
      newSubclass,
      req.params.id
    ]);

    const updatedCompanion = await dbGet(`
      SELECT c.*, n.name, n.nickname, n.race, n.gender, n.occupation, n.avatar
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    res.json({
      message: `${companion.name} is now level ${newLevel}!`,
      companion: updatedCompanion,
      levelUpSummary: {
        previousLevel: currentLevel,
        newLevel,
        hpGained: hpGain,
        newMaxHp,
        newFeatures: getClassFeatures(className, newLevel),
        proficiencyBonus: PROFICIENCY_BONUS[newLevel]
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get level-up info for companion
router.get('/:id/level-up-info', async (req, res) => {
  try {
    const companion = await dbGet(`
      SELECT c.*, n.name
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!companion) {
      return res.status(404).json({ error: 'Companion not found' });
    }

    if (companion.progression_type !== 'class_based') {
      return res.status(400).json({
        error: 'Only class-based companions can level up'
      });
    }

    const currentLevel = companion.companion_level;
    const newLevel = currentLevel + 1;
    const className = companion.companion_class.toLowerCase();

    if (newLevel > 20) {
      return res.status(400).json({ error: 'Companion is already at maximum level' });
    }

    const abilityScores = companion.companion_ability_scores
      ? JSON.parse(companion.companion_ability_scores)
      : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

    const hitDie = HIT_DICE[className] || 8;
    const conMod = Math.floor((abilityScores.con - 10) / 2);
    const avgHpGain = Math.floor(hitDie / 2) + 1 + conMod;

    // Check if subclass is needed:
    // 1. Normally needed at the exact subclass level
    // 2. Also needed if past subclass level but never selected one (e.g., created at higher level)
    const subclassLevel = SUBCLASS_LEVELS[className] || 3;
    const needsSubclass = !companion.companion_subclass && currentLevel >= subclassLevel;

    res.json({
      companionName: companion.name,
      currentLevel,
      newLevel,
      className: companion.companion_class,
      subclass: companion.companion_subclass,
      newFeatures: getClassFeatures(className, newLevel),
      choices: {
        needsSubclass,
        needsASI: hasASI(className, newLevel)
      },
      hpGain: {
        hitDie,
        conMod,
        average: avgHpGain,
        minimum: 1 + conMod,
        maximum: hitDie + conMod
      },
      proficiencyBonus: {
        current: PROFICIENCY_BONUS[currentLevel],
        new: PROFICIENCY_BONUS[newLevel]
      },
      subclassLevel: SUBCLASS_LEVELS[className]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dismiss companion - removes from party and makes NPC available for re-recruitment
router.post('/:id/dismiss', async (req, res) => {
  try {
    const companion = await dbGet(`
      SELECT c.*, n.name, c.npc_id
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!companion) {
      return res.status(404).json({ error: 'Companion not found' });
    }

    // Delete the companion record entirely so they can be re-recruited fresh
    await dbRun('DELETE FROM companions WHERE id = ?', [req.params.id]);

    // Update NPC to be available for recruitment again
    await dbRun(`
      UPDATE npcs SET campaign_availability = 'companion'
      WHERE id = ?
    `, [companion.npc_id]);

    res.json({
      message: `${companion.name} has left your party and is available for re-recruitment.`,
      npcId: companion.npc_id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark companion as deceased
router.post('/:id/deceased', async (req, res) => {
  try {
    const companion = await dbGet(`
      SELECT c.*, n.name
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!companion) {
      return res.status(404).json({ error: 'Companion not found' });
    }

    await dbRun(`
      UPDATE companions SET
        status = 'deceased',
        dismissed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.params.id]);

    res.json({
      message: `${companion.name} has fallen.`,
      companion: { ...companion, status: 'deceased' }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new party member from scratch (creates NPC + companion in one go)
// If npc_id is provided, uses the existing NPC instead of creating a new one
router.post('/create-party-member', async (req, res) => {
  try {
    const {
      recruited_by_character_id,
      npc_id, // Optional: if provided, use existing NPC instead of creating new one
      name,
      nickname,
      race,
      subrace,
      gender,
      age,
      companion_class,
      companion_subclass,
      level,
      background,
      // Appearance
      height,
      build,
      hair_color,
      hair_style,
      eye_color,
      skin_tone,
      distinguishing_marks,
      // Personality
      personality_trait_1,
      personality_trait_2,
      voice,
      mannerism,
      motivation,
      // Character details (like PC creation)
      alignment,
      faith,
      lifestyle,
      ideals,
      bonds,
      flaws,
      // Ability scores
      ability_scores,
      // Skills
      skill_proficiencies,
      // Spells
      cantrips,
      spells_known,
      // Origin
      backstory,
      relationship_to_party,
      // Starting equipment and gold
      starting_equipment,
      starting_gold_gp,
      starting_gold_sp,
      starting_gold_cp,
      // Combat stats
      armor_class,
      speed
    } = req.body;

    // Validate required fields
    if (!recruited_by_character_id || !name || !race || !companion_class) {
      return res.status(400).json({
        error: 'Required fields: recruited_by_character_id, name, race, companion_class'
      });
    }

    // Get recruiting character for default level
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [recruited_by_character_id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const companionLevel = level || character.level;

    // Format ability scores
    const abilityScoresJson = JSON.stringify(ability_scores || {
      str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
    });

    let npcId;

    // Check if we're using an existing NPC or creating a new one
    if (npc_id) {
      // Using existing NPC - verify it exists
      const existingNpc = await dbGet('SELECT id FROM npcs WHERE id = ?', [npc_id]);
      if (!existingNpc) {
        return res.status(404).json({ error: 'NPC not found' });
      }
      npcId = npc_id;

      // Update the NPC's campaign availability to indicate they're now a party member
      await dbRun(
        'UPDATE npcs SET campaign_availability = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['party_member', npcId]
      );
    } else {
      // Create a new NPC
      const npcResult = await dbRun(`
        INSERT INTO npcs (
          name, nickname, race, gender, age, occupation,
          height, build, hair_color, hair_style, eye_color, skin_tone,
          distinguishing_marks, personality_trait_1, personality_trait_2,
          voice, mannerism, motivation, ability_scores, background_notes,
          relationship_to_party, campaign_availability
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'party_member')
      `, [
        name,
        nickname || null,
        subrace ? `${subrace} ${race}` : race,
        gender || null,
        age || null,
        background || null, // Using background as occupation
        height || null,
        build || null,
        hair_color || null,
        hair_style || null,
        eye_color || null,
        skin_tone || null,
        distinguishing_marks || null,
        personality_trait_1 || null,
        personality_trait_2 || null,
        voice || null,
        mannerism || null,
        motivation || null,
        abilityScoresJson,
        backstory || null,
        relationship_to_party || null
      ]);

      npcId = npcResult.lastInsertRowid;
    }

    // Calculate HP based on class and level
    const hitDie = HIT_DICE[companion_class.toLowerCase()] || 8;
    const conMod = Math.floor(((ability_scores?.con || 10) - 10) / 2);

    // Level 1: max hit die + con mod
    // Levels 2+: average + con mod
    let companionMaxHp = hitDie + conMod; // Level 1
    for (let lvl = 2; lvl <= companionLevel; lvl++) {
      companionMaxHp += Math.floor(hitDie / 2) + 1 + conMod;
    }
    companionMaxHp = Math.max(companionMaxHp, 1); // Minimum 1 HP

    // Snapshot the "original" stats (for party members, this is what we created)
    const originalStatsSnapshot = JSON.stringify({
      name,
      ability_scores: ability_scores || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    });

    // Format skill proficiencies as JSON
    const skillProficienciesJson = JSON.stringify(skill_proficiencies || []);

    // Format spells as JSON
    const cantripsJson = JSON.stringify(cantrips || []);
    const spellsKnownJson = JSON.stringify(spells_known || []);

    // Format starting equipment as JSON
    const equipmentJson = JSON.stringify(starting_equipment || {});
    const inventoryJson = JSON.stringify([]);

    // Calculate default AC if not provided (10 + DEX mod)
    const dexMod = Math.floor(((ability_scores?.dex || 10) - 10) / 2);
    const calculatedAC = armor_class || (10 + dexMod);

    // Default speed is 30, but some races have different speeds
    const calculatedSpeed = speed || 30;

    // Now create the companion record
    const companionResult = await dbRun(`
      INSERT INTO companions (
        npc_id, recruited_by_character_id, progression_type,
        original_stats_snapshot, companion_class, companion_subclass, companion_level,
        companion_max_hp, companion_current_hp, companion_ability_scores,
        skill_proficiencies, cantrips, spells_known, notes, status,
        alignment, faith, lifestyle, ideals, bonds, flaws,
        armor_class, speed, subrace, background,
        equipment, inventory, gold_gp, gold_sp, gold_cp
      ) VALUES (?, ?, 'class_based', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active',
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?)
    `, [
      npcId,
      recruited_by_character_id,
      originalStatsSnapshot,
      companion_class,
      companion_subclass || null,
      companionLevel,
      companionMaxHp,
      companionMaxHp, // Start at full HP
      abilityScoresJson,
      skillProficienciesJson,
      cantripsJson,
      spellsKnownJson,
      relationship_to_party || null,
      // New character-like fields
      alignment || null,
      faith || null,
      lifestyle || null,
      ideals || null,
      bonds || null,
      flaws || null,
      calculatedAC,
      calculatedSpeed,
      subrace || null,
      background || null,
      // Equipment and gold
      equipmentJson,
      inventoryJson,
      starting_gold_gp || 0,
      starting_gold_sp || 0,
      starting_gold_cp || 0
    ]);

    // Fetch the created companion with NPC details
    const companion = await dbGet(`
      SELECT c.*, c.inventory as companion_inventory, c.gold_gp, c.gold_sp, c.gold_cp, c.equipment,
             c.alignment, c.faith, c.lifestyle, c.ideals, c.bonds, c.flaws,
             c.armor_class, c.speed, c.subrace as companion_subrace, c.background as companion_background,
             n.name, n.nickname, n.race, n.gender, n.occupation,
             n.avatar, n.personality_trait_1, n.personality_trait_2, n.voice,
             n.height, n.build, n.hair_color, n.eye_color, n.skin_tone,
             n.distinguishing_marks, n.background_notes, n.motivation
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [companionResult.lastInsertRowid]);

    res.status(201).json({
      message: `${name} has joined your party!`,
      companion
    });
  } catch (error) {
    console.error('Error creating party member:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get NPCs available for recruitment (campaign_availability = 'companion')
router.get('/available/:characterId', async (req, res) => {
  try {
    // Get NPCs marked as available companions that aren't already recruited
    const availableNpcs = await dbAll(`
      SELECT n.* FROM npcs n
      WHERE n.campaign_availability = 'companion'
      AND n.id NOT IN (
        SELECT npc_id FROM companions
        WHERE recruited_by_character_id = ? AND status = 'active'
      )
      ORDER BY n.name
    `, [req.params.characterId]);

    res.json(availableNpcs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
