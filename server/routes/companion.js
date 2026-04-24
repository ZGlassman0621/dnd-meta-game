import express from 'express';
import { dbAll, dbGet, dbRun } from '../database.js';
import {
  HIT_DICE,
  PROFICIENCY_BONUS,
  getClassFeatures,
  hasASI,
  SUBCLASS_LEVELS,
  getSpellSlots,
  getMulticlassSpellSlots,
  getTotalLevel
} from '../config/levelProgression.js';
import { onCompanionRecruited, onCompanionDismissed, onCompanionLoyaltyChanged } from '../services/narrativeIntegration.js';
import { safeParse } from '../utils/safeParse.js';
import * as companionBackstoryGenerator from '../services/companionBackstoryGenerator.js';
import * as companionBackstoryService from '../services/companionBackstoryService.js';
import { handleServerError } from '../utils/errorHandler.js';
import { propagateNpcDeath, canRecruit } from '../services/npcLifecycleService.js';
import { sendOnActivity, getAwayCompanions, getActivityById, recallCompanion } from '../services/companionActivityService.js';
import {
  autoAssignCompanionTheme,
  autoSeedCompanionAncestryFeatTier1,
  computeCompanionProgressionDecisions,
  ensureCompanionProgressionInitialized
} from '../services/progressionCompanionService.js';
import { CONDITION_NAMES } from '../data/conditions.js';

// Phase 10: parse `companion_class_levels` (multiclass breakdown) with a
// fallback to the legacy single-class columns. Returns an array of
// `{ class, level, subclass }`.
function parseCompanionClassLevels(companion) {
  if (companion.companion_class_levels) {
    const parsed = safeParse(companion.companion_class_levels, null);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  }
  // Legacy single-class fallback
  if (companion.companion_class) {
    return [{
      class: companion.companion_class,
      level: companion.companion_level || 1,
      subclass: companion.companion_subclass || null
    }];
  }
  return [];
}

// Phase 7: normalized set of condition keys we'll accept. Same casing the
// detectConditionChanges pipeline uses (lowercase_underscore).
const VALID_CONDITION_KEYS = new Set(
  CONDITION_NAMES.map(n => n.toLowerCase().replace(/\s+/g, '_'))
);
const EXHAUSTION_KEYS = new Set(
  ['exhaustion_1', 'exhaustion_2', 'exhaustion_3', 'exhaustion_4', 'exhaustion_5', 'exhaustion_6']
);
// Conditions that 5e rules clear when combat ends (not a full rest)
const COMBAT_END_CLEAR = new Set([
  'grappled', 'prone', 'restrained', 'stunned', 'charmed', 'frightened'
]);
// Conditions that persist across a long rest (not cleared by it): petrified.
// Everything else is cleared by long rest per typical table practice.

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
    handleServerError(res, error, 'fetch companions');
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
    handleServerError(res, error, 'fetch companion');
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

    // Check lifecycle status — cannot recruit deceased/missing/imprisoned NPCs
    if (!await canRecruit(npc_id)) {
      const status = npc.lifecycle_status || 'alive';
      return res.status(400).json({ error: `This NPC cannot be recruited (${status})` });
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
      const abilityScores = npc.ability_scores ? safeParse(npc.ability_scores, {
        str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
      }) : {
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

    // Phase 10: seed companion_class_levels for class-based recruits so
    // the level-up endpoint has a breakdown to work with on day 1.
    const companionClassLevels = (progression_type === 'class_based' && companion_class)
      ? JSON.stringify([{
          class: companion_class,
          level: companionLevel,
          subclass: companion_subclass || null
        }])
      : null;

    // Insert the companion
    const result = await dbRun(`
      INSERT INTO companions (
        npc_id, recruited_by_character_id, recruited_session_id,
        progression_type, original_stats_snapshot,
        companion_class, companion_subclass, companion_level, companion_max_hp, companion_current_hp,
        companion_ability_scores, companion_class_levels, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
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
      companionClassLevels,
      notes
    ]);

    // Fetch the created companion with NPC details
    const companion = await dbGet(`
      SELECT c.*, n.name, n.nickname, n.race, n.gender, n.occupation,
             n.avatar, n.personality_trait_1, n.personality_trait_2,
             n.motivation, n.background_notes, n.current_location
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [result.lastInsertRowid]);

    // Phase 5.5: auto-assign a theme + seed L1 ancestry feat. Both are
    // idempotent no-ops on re-recruit and silently skip on unmapped data
    // (e.g., Goblin race), so a failure here never blocks recruitment.
    await autoAssignCompanionTheme(
      companion.id,
      companion.companion_class,
      companion.companion_level || 1
    );
    await autoSeedCompanionAncestryFeatTier1(
      companion.id,
      companion.race,
      companion.companion_level || 1
    );

    // Generate backstory for the companion (async, non-blocking)
    // This will also emit the companion_recruited event
    onCompanionRecruited(companion, character).catch(err => {
      console.error('Error generating companion backstory:', err);
    });

    res.status(201).json({
      message: `${npc.name} has joined your party!`,
      companion
    });
  } catch (error) {
    handleServerError(res, error, 'recruit companion');
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
    handleServerError(res, error, 'update companion');
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
      ? safeParse(companion.npc_ability_scores, { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
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
    handleServerError(res, error, 'convert companion to class');
  }
});

// Level up companion (class-based only)
// Phase 10 adds multiclass support via optional `targetClass` in the body:
//  - Omit targetClass → advances the companion's primary class (back-compat)
//  - targetClass matches an existing class_levels entry → advances that class
//  - targetClass is new → adds a new class at level 1 (multiclass)
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

    // Parse class_levels (fall back to legacy single-class columns)
    let classLevels = parseCompanionClassLevels(companion);
    const currentTotalLevel = getTotalLevel(classLevels);
    const newTotalLevel = currentTotalLevel + 1;

    if (newTotalLevel > 20) {
      return res.status(400).json({ error: 'Companion is already at maximum level' });
    }

    const {
      hpRoll = 'average',
      rollValue,
      subclass,
      asiChoice,
      targetClass // Phase 10: which class is being advanced (or added)
    } = req.body;

    // Determine which class is being leveled. Default to the primary
    // (first in class_levels) when targetClass isn't provided — preserves
    // pre-Phase-10 behavior for single-class companions.
    const resolvedTargetClass = (targetClass || classLevels[0]?.class || companion.companion_class);
    if (!resolvedTargetClass) {
      return res.status(400).json({ error: 'Cannot determine class to advance' });
    }
    const targetClassKey = String(resolvedTargetClass).toLowerCase();

    // Find existing entry or prepare to add a new one (multiclass)
    const existingIdx = classLevels.findIndex(
      c => String(c.class).toLowerCase() === targetClassKey
    );
    const isMulticlassAddition = existingIdx === -1;
    const newClassLevel = isMulticlassAddition ? 1 : classLevels[existingIdx].level + 1;

    const abilityScores = companion.companion_ability_scores
      ? safeParse(companion.companion_ability_scores, { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
      : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

    // HP uses the target class's hit die
    const hitDie = HIT_DICE[targetClassKey] || 8;
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

    // ASI is keyed to the target class's level, not total level
    let newAbilityScores = { ...abilityScores };
    if (hasASI(targetClassKey, newClassLevel) && asiChoice) {
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
        if (asiChoice.increases.con) {
          const newConMod = Math.floor((newAbilityScores.con - 10) / 2);
          if (newConMod > conMod) {
            // Apply retroactively across the full total level (same math as
            // character-side level-up)
            hpGain += (newConMod - conMod) * newTotalLevel;
          }
        }
      }
    }

    // Subclass handling — scoped to the class being leveled. For a new
    // multiclass addition, require subclass at/beyond the class's subclass
    // level. For existing classes, allow selection if never chosen.
    const subclassLevel = SUBCLASS_LEVELS[targetClassKey] || 3;
    let targetSubclass = isMulticlassAddition ? null : classLevels[existingIdx].subclass;
    if (!targetSubclass && newClassLevel >= subclassLevel && subclass) {
      targetSubclass = subclass;
    }

    // Mutate classLevels in place
    if (isMulticlassAddition) {
      classLevels.push({
        class: resolvedTargetClass,
        level: 1,
        subclass: targetSubclass
      });
    } else {
      classLevels[existingIdx].level = newClassLevel;
      classLevels[existingIdx].subclass = targetSubclass;
    }

    const newMaxHp = companion.companion_max_hp + hpGain;
    const newCurrentHp = companion.companion_current_hp + hpGain;

    // Phase 5.5: make sure this companion has a theme + tier-1 feat before we
    // compute tier decisions. Tier checks key off total level, not per-class.
    await ensureCompanionProgressionInitialized(req.params.id);
    const progressionDecisions = await computeCompanionProgressionDecisions(
      req.params.id,
      newTotalLevel
    );

    // Primary class stays as class_levels[0] — matches character-side
    // semantics where `companion_class` is the "archetype" the companion
    // identifies as, and `companion_class_levels` holds the full breakdown.
    const primary = classLevels[0];

    await dbRun(`
      UPDATE companions SET
        companion_class = ?,
        companion_subclass = ?,
        companion_class_levels = ?,
        companion_level = ?,
        companion_max_hp = ?,
        companion_current_hp = ?,
        companion_ability_scores = ?
      WHERE id = ?
    `, [
      primary.class,
      primary.subclass,
      JSON.stringify(classLevels),
      newTotalLevel,
      newMaxHp,
      newCurrentHp,
      JSON.stringify(newAbilityScores),
      req.params.id
    ]);

    // Apply theme tier auto-unlock, if any
    if (progressionDecisions.theme_tier_unlock) {
      const unlock = progressionDecisions.theme_tier_unlock;
      await dbRun(
        `INSERT OR REPLACE INTO companion_theme_unlocks
         (companion_id, theme_id, tier, tier_ability_id, unlocked_at_level, narrative_delivery)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.params.id,
          unlock.theme_id,
          unlock.tier,
          unlock.tier_ability_id,
          newTotalLevel,
          `Auto-unlocked at level ${newTotalLevel} during companion level-up.`
        ]
      );
    }

    // Apply ancestry feat auto-pick, if any
    if (progressionDecisions.ancestry_feat_auto_pick) {
      const pick = progressionDecisions.ancestry_feat_auto_pick;
      await dbRun(
        `INSERT OR REPLACE INTO companion_ancestry_feats
         (companion_id, feat_id, tier, selected_at_level, narrative_delivery)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.params.id,
          pick.feat_id,
          pick.tier,
          newTotalLevel,
          `Auto-picked at level ${newTotalLevel} during companion level-up.`
        ]
      );
    }

    const updatedCompanion = await dbGet(`
      SELECT c.*, n.name, n.nickname, n.race, n.gender, n.occupation, n.avatar
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    res.json({
      message: `${companion.name} is now level ${newTotalLevel}!`,
      companion: updatedCompanion,
      levelUpSummary: {
        previousLevel: currentTotalLevel,
        newLevel: newTotalLevel,
        targetClass: resolvedTargetClass,
        newClassLevel,
        isMulticlassAddition,
        hpGained: hpGain,
        newMaxHp,
        newFeatures: getClassFeatures(targetClassKey, newClassLevel),
        proficiencyBonus: PROFICIENCY_BONUS[newTotalLevel],
        themeTierUnlocked: progressionDecisions.theme_tier_unlock,
        ancestryFeatSelected: progressionDecisions.ancestry_feat_auto_pick,
        classLevels
      }
    });
  } catch (error) {
    handleServerError(res, error, 'level up companion');
  }
});

// Get full progression snapshot for a companion (theme + unlocks + ancestry feats)
router.get('/:id/progression', async (req, res) => {
  try {
    await ensureCompanionProgressionInitialized(req.params.id);

    const companion = await dbGet(
      `SELECT c.id, c.companion_class, c.companion_level, n.name, n.race
       FROM companions c JOIN npcs n ON c.npc_id = n.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!companion) {
      return res.status(404).json({ error: 'Companion not found' });
    }

    const themeRow = await dbGet(
      `SELECT ct.theme_id, ct.path_choice, t.name as theme_name,
              t.identity, t.signature_skill_1, t.signature_skill_2, t.tags
       FROM companion_themes ct JOIN themes t ON ct.theme_id = t.id
       WHERE ct.companion_id = ?`,
      [req.params.id]
    );

    const unlocks = await dbAll(
      `SELECT ctu.tier, ctu.unlocked_at_level, ctu.narrative_delivery,
              ta.ability_name, ta.ability_description, ta.mechanics, ta.flavor_text
       FROM companion_theme_unlocks ctu
       LEFT JOIN theme_abilities ta ON ctu.tier_ability_id = ta.id
       WHERE ctu.companion_id = ?
       ORDER BY ctu.tier`,
      [req.params.id]
    );

    let themeAllTiers = [];
    if (themeRow) {
      themeAllTiers = await dbAll(
        `SELECT tier, ability_name, ability_description, mechanics, flavor_text, path_variant
         FROM theme_abilities WHERE theme_id = ?
         ORDER BY tier, path_variant`,
        [themeRow.theme_id]
      );
    }

    const ancestryFeats = await dbAll(
      `SELECT caf.tier, caf.selected_at_level, caf.narrative_delivery, af.list_id,
              af.feat_name, af.description, af.mechanics, af.flavor_text
       FROM companion_ancestry_feats caf
       JOIN ancestry_feats af ON caf.feat_id = af.id
       WHERE caf.companion_id = ?
       ORDER BY caf.tier`,
      [req.params.id]
    );

    res.json({
      companion: {
        id: companion.id,
        name: companion.name,
        race: companion.race,
        class: companion.companion_class,
        level: companion.companion_level
      },
      theme: themeRow
        ? { ...themeRow, tags: themeRow.tags ? JSON.parse(themeRow.tags) : [] }
        : null,
      theme_all_tiers: themeAllTiers,
      theme_unlocks: unlocks,
      ancestry_feats: ancestryFeats
    });
  } catch (error) {
    handleServerError(res, error, 'fetch companion progression');
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

    // Phase 10: use class_levels for multiclass-aware preview
    const classLevels = parseCompanionClassLevels(companion);
    const currentTotalLevel = getTotalLevel(classLevels);
    const newTotalLevel = currentTotalLevel + 1;

    if (newTotalLevel > 20) {
      return res.status(400).json({ error: 'Companion is already at maximum level' });
    }

    const abilityScores = companion.companion_ability_scores
      ? safeParse(companion.companion_ability_scores, { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
      : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const conMod = Math.floor((abilityScores.con - 10) / 2);

    // Preview info is keyed to the primary class by default. The UI can
    // request preview for a specific target via ?targetClass=X; for now
    // we report the primary-class numbers and expose classLevels so the
    // UI can let the user switch the target pre-submit.
    const primary = classLevels[0];
    const primaryClassKey = primary.class.toLowerCase();
    const primaryNewLevel = primary.level + 1;

    const hitDie = HIT_DICE[primaryClassKey] || 8;
    const avgHpGain = Math.floor(hitDie / 2) + 1 + conMod;

    const subclassLevel = SUBCLASS_LEVELS[primaryClassKey] || 3;
    const needsSubclass = !primary.subclass && primaryNewLevel >= subclassLevel;

    await ensureCompanionProgressionInitialized(req.params.id);
    const progressionDecisions = await computeCompanionProgressionDecisions(
      req.params.id,
      newTotalLevel
    );

    res.json({
      companionName: companion.name,
      currentLevel: currentTotalLevel,
      newLevel: newTotalLevel,
      className: primary.class,
      subclass: primary.subclass,
      classLevels,
      newFeatures: getClassFeatures(primaryClassKey, primaryNewLevel),
      choices: {
        needsSubclass,
        needsASI: hasASI(primaryClassKey, primaryNewLevel),
        canMulticlass: true
      },
      hpGain: {
        hitDie,
        conMod,
        average: avgHpGain,
        minimum: 1 + conMod,
        maximum: hitDie + conMod
      },
      proficiencyBonus: {
        current: PROFICIENCY_BONUS[currentTotalLevel],
        new: PROFICIENCY_BONUS[newTotalLevel]
      },
      subclassLevel: SUBCLASS_LEVELS[primaryClassKey],
      progression: progressionDecisions
    });
  } catch (error) {
    handleServerError(res, error, 'fetch level-up info');
  }
});

// ============================================================================
// Phase 6: Rest + Spell Slots
//
// Mirrors the character-side endpoints (/rest/:id, /spell-slots/:id,
// /spell-slots/:id/use, /spell-slots/:id/restore) but reads/writes the
// companion columns. Max spell slots are computed on demand from
// companion_class + companion_level via getSpellSlots(); only the
// `companion_spell_slots_used` map is persisted.
//
// Non-spellcasting companions (fighter, barbarian, etc.) get an empty
// `{}` max from getSpellSlots(), so /use returns 400 for them.
//
// Warlocks reset pact slots on short rest (pact magic recharges quickly);
// all other casters recover slots on long rest.
// ============================================================================

// Get companion's spell slots (max + used)
// Phase 10: use multiclass math when class_levels has more than one class;
// otherwise fall back to single-class getSpellSlots() for back-compat.
router.get('/:id/spell-slots', async (req, res) => {
  try {
    const companion = await dbGet('SELECT * FROM companions WHERE id = ?', [req.params.id]);
    if (!companion) return res.status(404).json({ error: 'Companion not found' });

    if (!companion.companion_class || companion.progression_type !== 'class_based') {
      return res.json({
        max: {},
        used: {},
        class: companion.companion_class,
        level: companion.companion_level,
        progression_type: companion.progression_type
      });
    }

    const classLevels = parseCompanionClassLevels(companion);
    let max = {};
    let pactMagic = null;

    if (classLevels.length > 1) {
      const mc = getMulticlassSpellSlots(classLevels);
      max = mc.spellSlots || {};
      pactMagic = mc.pactMagic || null;
    } else {
      max = getSpellSlots(companion.companion_class, companion.companion_level) || {};
    }

    const used = safeParse(companion.companion_spell_slots_used, {});

    res.json({
      max,
      used,
      class: companion.companion_class,
      level: companion.companion_level,
      class_levels: classLevels,
      pact_magic: pactMagic
    });
  } catch (error) {
    handleServerError(res, error, 'fetch companion spell slots');
  }
});

// Use a companion spell slot
router.post('/:id/spell-slots/use', async (req, res) => {
  try {
    const { level } = req.body;
    if (!level || level < 1 || level > 9) {
      return res.status(400).json({ error: 'Invalid spell level (1-9)' });
    }

    const companion = await dbGet('SELECT * FROM companions WHERE id = ?', [req.params.id]);
    if (!companion) return res.status(404).json({ error: 'Companion not found' });

    if (!companion.companion_class || companion.progression_type !== 'class_based') {
      return res.status(400).json({ error: 'Only class-based companions have spell slots' });
    }

    const max = getSpellSlots(companion.companion_class, companion.companion_level) || {};
    const used = safeParse(companion.companion_spell_slots_used, {});

    const maxForLevel = max[level] || 0;
    const usedForLevel = used[level] || 0;

    if (maxForLevel === 0) {
      return res.status(400).json({ error: `This companion has no level ${level} spell slots` });
    }
    if (usedForLevel >= maxForLevel) {
      return res.status(400).json({ error: `No level ${level} spell slots remaining` });
    }

    used[level] = usedForLevel + 1;
    await dbRun(
      'UPDATE companions SET companion_spell_slots_used = ? WHERE id = ?',
      [JSON.stringify(used), req.params.id]
    );

    res.json({ success: true, level, remaining: maxForLevel - used[level], max: maxForLevel });
  } catch (error) {
    handleServerError(res, error, 'use companion spell slot');
  }
});

// Restore a companion spell slot (e.g., Arcane Recovery narrative)
router.post('/:id/spell-slots/restore', async (req, res) => {
  try {
    const { level } = req.body;
    if (!level || level < 1 || level > 9) {
      return res.status(400).json({ error: 'Invalid spell level (1-9)' });
    }

    const companion = await dbGet('SELECT * FROM companions WHERE id = ?', [req.params.id]);
    if (!companion) return res.status(404).json({ error: 'Companion not found' });

    const max = getSpellSlots(companion.companion_class, companion.companion_level) || {};
    const used = safeParse(companion.companion_spell_slots_used, {});

    const maxForLevel = max[level] || 0;
    const usedForLevel = used[level] || 0;

    if (usedForLevel <= 0) {
      return res.status(400).json({ error: `No used level ${level} slots to restore` });
    }

    used[level] = usedForLevel - 1;
    await dbRun(
      'UPDATE companions SET companion_spell_slots_used = ? WHERE id = ?',
      [JSON.stringify(used), req.params.id]
    );

    res.json({ success: true, level, remaining: maxForLevel - used[level], max: maxForLevel });
  } catch (error) {
    handleServerError(res, error, 'restore companion spell slot');
  }
});

// Rest a companion (long or short)
router.post('/:id/rest', async (req, res) => {
  try {
    const { restType = 'long' } = req.body;
    const companion = await dbGet('SELECT * FROM companions WHERE id = ?', [req.params.id]);
    if (!companion) return res.status(404).json({ error: 'Companion not found' });

    let healAmount = 0;
    let newHp = companion.companion_current_hp;
    let spellSlotsRestored = false;

    if (restType === 'long') {
      healAmount = (companion.companion_max_hp || 0) - (companion.companion_current_hp || 0);
      newHp = companion.companion_max_hp;

      // Phase 7: long rest clears most conditions (petrified persists) and
      // decrements exhaustion by 1 per 5e rules; also resets death saves.
      const currentConditions = safeParse(companion.active_conditions, []);
      const newConditions = [];
      for (const c of currentConditions) {
        if (c === 'petrified') {
          newConditions.push(c); // persists across rest
        } else if (EXHAUSTION_KEYS.has(c)) {
          const level = parseInt(c.split('_')[1], 10);
          if (level > 1) newConditions.push(`exhaustion_${level - 1}`);
          // exhaustion_1 → cleared
        }
        // all other conditions cleared
      }

      await dbRun(
        `UPDATE companions
         SET companion_current_hp = ?,
             companion_spell_slots_used = '{}',
             active_conditions = ?,
             death_save_successes = 0,
             death_save_failures = 0
         WHERE id = ?`,
        [newHp, JSON.stringify(newConditions), req.params.id]
      );
      spellSlotsRestored = true;
    } else {
      const missing = (companion.companion_max_hp || 0) - (companion.companion_current_hp || 0);
      healAmount = Math.max(1, Math.floor(missing * 0.5));
      newHp = Math.min(companion.companion_max_hp, (companion.companion_current_hp || 0) + healAmount);

      // Phase 7: any HP gain above 0 resets death saves (5e rules)
      const wasDown = (companion.companion_current_hp || 0) <= 0;
      const savesReset = wasDown && newHp > 0;

      const classKey = companion.companion_class?.toLowerCase();
      if (classKey === 'warlock') {
        await dbRun(
          `UPDATE companions
           SET companion_current_hp = ?,
               companion_spell_slots_used = '{}',
               death_save_successes = ${savesReset ? 0 : 'death_save_successes'},
               death_save_failures  = ${savesReset ? 0 : 'death_save_failures'}
           WHERE id = ?`,
          [newHp, req.params.id]
        );
        spellSlotsRestored = true;
      } else {
        await dbRun(
          `UPDATE companions
           SET companion_current_hp = ?,
               death_save_successes = ${savesReset ? 0 : 'death_save_successes'},
               death_save_failures  = ${savesReset ? 0 : 'death_save_failures'}
           WHERE id = ?`,
          [newHp, req.params.id]
        );
      }
    }

    const updated = await dbGet(`
      SELECT c.*, n.name, n.race, n.gender, n.avatar
      FROM companions c JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    res.json({
      success: true,
      message: restType === 'long'
        ? `${updated.name} completes a long rest. Restored ${healAmount} HP and all spell slots.`
        : `${updated.name} completes a short rest. Restored ${healAmount} HP.${spellSlotsRestored ? ' Pact slots restored.' : ''}`,
      companion: updated,
      newHp,
      hp_restored: healAmount,
      spell_slots_restored: spellSlotsRestored
    });
  } catch (error) {
    handleServerError(res, error, 'rest companion');
  }
});

// ============================================================================
// Phase 7: Combat Safety — Conditions + Death Saves
//
// Persistent condition tracking (previously session-only client state) and
// full death save tracking (previously nonexistent). Conditions use the same
// lowercase_underscore keys as the session ConditionPanel, stored as a JSON
// array on `companions.active_conditions`. Exhaustion is mutually exclusive
// (at most one `exhaustion_N` key at a time) — adding exhaustion_N strips
// other exhaustion levels automatically.
//
// Death saves: classic 5e rules. Three successes → stabilized. Three failures
// → dead. A d20 roll of 20 revives the companion at 1 HP. A roll of 1 counts
// as two failures. Any positive HP change resets the save tallies.
// ============================================================================

// Get the companion's active conditions
router.get('/:id/conditions', async (req, res) => {
  try {
    const companion = await dbGet('SELECT active_conditions FROM companions WHERE id = ?', [req.params.id]);
    if (!companion) return res.status(404).json({ error: 'Companion not found' });
    const conditions = safeParse(companion.active_conditions, []);
    res.json({ conditions });
  } catch (error) {
    handleServerError(res, error, 'fetch companion conditions');
  }
});

// Add a condition
router.post('/:id/conditions/add', async (req, res) => {
  try {
    const { condition } = req.body || {};
    if (!condition || typeof condition !== 'string') {
      return res.status(400).json({ error: 'condition is required' });
    }
    const key = condition.toLowerCase().replace(/\s+/g, '_');
    if (!VALID_CONDITION_KEYS.has(key)) {
      return res.status(400).json({ error: `Unknown condition: ${condition}` });
    }

    const companion = await dbGet('SELECT active_conditions FROM companions WHERE id = ?', [req.params.id]);
    if (!companion) return res.status(404).json({ error: 'Companion not found' });

    let conditions = safeParse(companion.active_conditions, []);
    if (EXHAUSTION_KEYS.has(key)) {
      // Exhaustion is mutually exclusive — strip other exhaustion levels
      conditions = conditions.filter(c => !EXHAUSTION_KEYS.has(c));
    }
    if (!conditions.includes(key)) conditions.push(key);

    await dbRun(
      'UPDATE companions SET active_conditions = ? WHERE id = ?',
      [JSON.stringify(conditions), req.params.id]
    );
    res.json({ conditions });
  } catch (error) {
    handleServerError(res, error, 'add companion condition');
  }
});

// Remove a condition
router.post('/:id/conditions/remove', async (req, res) => {
  try {
    const { condition } = req.body || {};
    if (!condition || typeof condition !== 'string') {
      return res.status(400).json({ error: 'condition is required' });
    }
    const key = condition.toLowerCase().replace(/\s+/g, '_');

    const companion = await dbGet('SELECT active_conditions FROM companions WHERE id = ?', [req.params.id]);
    if (!companion) return res.status(404).json({ error: 'Companion not found' });

    const conditions = safeParse(companion.active_conditions, []).filter(c => c !== key);
    await dbRun(
      'UPDATE companions SET active_conditions = ? WHERE id = ?',
      [JSON.stringify(conditions), req.params.id]
    );
    res.json({ conditions });
  } catch (error) {
    handleServerError(res, error, 'remove companion condition');
  }
});

// Get death save state
router.get('/:id/death-saves', async (req, res) => {
  try {
    const companion = await dbGet(
      'SELECT death_save_successes, death_save_failures, companion_current_hp FROM companions WHERE id = ?',
      [req.params.id]
    );
    if (!companion) return res.status(404).json({ error: 'Companion not found' });
    res.json({
      successes: companion.death_save_successes || 0,
      failures: companion.death_save_failures || 0,
      at_zero_hp: (companion.companion_current_hp || 0) <= 0
    });
  } catch (error) {
    handleServerError(res, error, 'fetch companion death saves');
  }
});

// Roll / record a death save.
//   Body options:
//     { roll: <1..20> }                — server interprets roll per 5e rules
//     { outcome: 'success'|'failure'|'crit_success'|'crit_failure' }
//                                      — caller resolved the dice already
//   Response: { successes, failures, stabilized, dead, hp, message }
router.post('/:id/death-save', async (req, res) => {
  try {
    const { roll, outcome } = req.body || {};
    const companion = await dbGet('SELECT * FROM companions WHERE id = ?', [req.params.id]);
    if (!companion) return res.status(404).json({ error: 'Companion not found' });

    if ((companion.companion_current_hp || 0) > 0) {
      return res.status(400).json({ error: 'Companion is not at 0 HP — no death save needed' });
    }

    let resolved = outcome;
    let rolledValue = null;
    if (!resolved) {
      rolledValue = (typeof roll === 'number') ? roll : (1 + Math.floor(Math.random() * 20));
      if (rolledValue < 1 || rolledValue > 20) {
        return res.status(400).json({ error: 'roll must be between 1 and 20' });
      }
      if (rolledValue === 20) resolved = 'crit_success';
      else if (rolledValue === 1) resolved = 'crit_failure';
      else if (rolledValue >= 10) resolved = 'success';
      else resolved = 'failure';
    }

    let successes = companion.death_save_successes || 0;
    let failures = companion.death_save_failures || 0;
    let hp = companion.companion_current_hp || 0;
    let stabilized = false;
    let dead = false;
    let message = '';

    if (resolved === 'crit_success') {
      // Natural 20: regain 1 HP and wake up
      hp = 1;
      successes = 0;
      failures = 0;
      message = `${companion.id} regains consciousness at 1 HP (natural 20).`;
    } else if (resolved === 'success') {
      successes = Math.min(3, successes + 1);
      if (successes >= 3) {
        stabilized = true;
        successes = 0;
        failures = 0;
        message = 'Stabilized after three successful death saves.';
      } else {
        message = `Death save succeeded (${successes}/3).`;
      }
    } else if (resolved === 'crit_failure') {
      failures = Math.min(3, failures + 2);
      if (failures >= 3) {
        dead = true;
        message = 'Companion has died (critical failure → 3 failures).';
      } else {
        message = `Critical failure — 2 failures counted (${failures}/3).`;
      }
    } else if (resolved === 'failure') {
      failures = Math.min(3, failures + 1);
      if (failures >= 3) {
        dead = true;
        message = 'Companion has died (3 failed death saves).';
      } else {
        message = `Death save failed (${failures}/3).`;
      }
    } else {
      return res.status(400).json({ error: 'Unknown outcome (expected success/failure/crit_success/crit_failure)' });
    }

    await dbRun(
      `UPDATE companions
       SET death_save_successes = ?, death_save_failures = ?, companion_current_hp = ?
       WHERE id = ?`,
      [successes, failures, hp, req.params.id]
    );

    res.json({
      successes,
      failures,
      stabilized,
      dead,
      hp,
      roll: rolledValue,
      outcome: resolved,
      message
    });
  } catch (error) {
    handleServerError(res, error, 'record companion death save');
  }
});

// Stabilize a dying companion (e.g., Medicine DC 10 check succeeds)
router.post('/:id/stabilize', async (req, res) => {
  try {
    const companion = await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [req.params.id]);
    if (!companion) return res.status(404).json({ error: 'Companion not found' });
    if ((companion.companion_current_hp || 0) > 0) {
      return res.status(400).json({ error: 'Companion is not at 0 HP — nothing to stabilize' });
    }
    await dbRun(
      `UPDATE companions
       SET death_save_successes = 0, death_save_failures = 0
       WHERE id = ?`,
      [req.params.id]
    );
    res.json({ stabilized: true, successes: 0, failures: 0 });
  } catch (error) {
    handleServerError(res, error, 'stabilize companion');
  }
});

// ============================================================================
// Phase 8: Item Transfer (Character ↔ Companion)
//
// Characters and companions both store their `inventory` as a JSON array of
// `{ name, quantity }` objects (matching the merchant-transaction pattern in
// dmSession.js). These endpoints move items between the two without opening
// the full CompanionEditor.
//
// `quantity` is optional on transfer — defaults to all available. Partial
// quantities are supported: give/take N of the M total, split stacks.
// ============================================================================

// Shared helper — add an item (name + quantity) to an inventory array,
// merging with an existing stack if present.
function inventoryAddItem(inventory, item, quantity) {
  const existing = inventory.find(i => (i.name || '').toLowerCase() === item.name.toLowerCase());
  if (existing) {
    existing.quantity = (existing.quantity || 1) + quantity;
  } else {
    inventory.push({ ...item, quantity });
  }
  return inventory;
}

// Shared helper — remove `quantity` of itemName from an inventory array.
// Returns { ok, removed, remainingStack } or { ok:false, error }.
function inventoryRemoveItem(inventory, itemName, quantity) {
  const idx = inventory.findIndex(i => (i.name || '').toLowerCase() === itemName.toLowerCase());
  if (idx === -1) return { ok: false, error: `Item '${itemName}' not found in source inventory` };

  const item = inventory[idx];
  const have = item.quantity || 1;
  if (quantity > have) return { ok: false, error: `Only ${have} of '${itemName}' available (asked for ${quantity})` };

  if (quantity === have) {
    inventory.splice(idx, 1);
    return { ok: true, removed: { ...item }, remainingStack: null };
  } else {
    item.quantity = have - quantity;
    return { ok: true, removed: { ...item, quantity }, remainingStack: item };
  }
}

const VALID_EQUIP_SLOTS = new Set(['mainHand', 'offHand', 'armor']);

// Equip an item from the party pool onto this companion
router.post('/:id/equip', async (req, res) => {
  try {
    const { slot, itemName } = req.body || {};
    if (!slot || !VALID_EQUIP_SLOTS.has(slot)) {
      return res.status(400).json({ error: `slot must be one of: ${[...VALID_EQUIP_SLOTS].join(', ')}` });
    }
    if (!itemName) return res.status(400).json({ error: 'itemName is required' });

    const companion = await dbGet(
      'SELECT id, recruited_by_character_id, equipment FROM companions WHERE id = ?',
      [req.params.id]
    );
    if (!companion) return res.status(404).json({ error: 'Companion not found' });

    const character = await dbGet(
      'SELECT id, inventory FROM characters WHERE id = ?',
      [companion.recruited_by_character_id]
    );
    if (!character) return res.status(404).json({ error: 'Recruiting character not found' });

    const partyInv = safeParse(character.inventory, []);
    const equipment = safeParse(companion.equipment, {});

    const remove = inventoryRemoveItem(partyInv, itemName, 1);
    if (!remove.ok) return res.status(400).json({ error: remove.error });

    // If something was already in that slot, return it to the party pool
    const previous = equipment[slot];
    if (previous && previous.name) {
      inventoryAddItem(partyInv, { name: previous.name }, 1);
    }

    // Equipment shape stays minimal (just { name }). Callers that need
    // mechanical detail (damage, AC bonus) update via PUT /companion/:id.
    equipment[slot] = { name: remove.removed.name };

    await dbRun(
      'UPDATE characters SET inventory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(partyInv), character.id]
    );
    await dbRun(
      'UPDATE companions SET equipment = ? WHERE id = ?',
      [JSON.stringify(equipment), req.params.id]
    );

    res.json({
      success: true,
      slot,
      equipped: equipment[slot],
      returned_to_pool: previous || null,
      party_inventory: partyInv
    });
  } catch (error) {
    handleServerError(res, error, 'equip companion item');
  }
});

// Unequip an item from this companion back to the party pool
router.post('/:id/unequip', async (req, res) => {
  try {
    const { slot } = req.body || {};
    if (!slot || !VALID_EQUIP_SLOTS.has(slot)) {
      return res.status(400).json({ error: `slot must be one of: ${[...VALID_EQUIP_SLOTS].join(', ')}` });
    }

    const companion = await dbGet(
      'SELECT id, recruited_by_character_id, equipment FROM companions WHERE id = ?',
      [req.params.id]
    );
    if (!companion) return res.status(404).json({ error: 'Companion not found' });

    const equipment = safeParse(companion.equipment, {});
    const current = equipment[slot];
    if (!current || !current.name) {
      return res.status(400).json({ error: `No item equipped in ${slot}` });
    }

    const character = await dbGet(
      'SELECT id, inventory FROM characters WHERE id = ?',
      [companion.recruited_by_character_id]
    );
    if (!character) return res.status(404).json({ error: 'Recruiting character not found' });

    const partyInv = safeParse(character.inventory, []);
    inventoryAddItem(partyInv, { name: current.name }, 1);
    equipment[slot] = null;

    await dbRun(
      'UPDATE characters SET inventory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(partyInv), character.id]
    );
    await dbRun(
      'UPDATE companions SET equipment = ? WHERE id = ?',
      [JSON.stringify(equipment), req.params.id]
    );

    res.json({
      success: true,
      slot,
      returned_to_pool: current,
      party_inventory: partyInv
    });
  } catch (error) {
    handleServerError(res, error, 'unequip companion item');
  }
});

// Dismiss companion - removes from party and makes NPC available for re-recruitment
router.post('/:id/dismiss', async (req, res) => {
  try {
    const companion = await dbGet(`
      SELECT c.*, n.name, c.npc_id, c.recruited_by_character_id
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!companion) {
      return res.status(404).json({ error: 'Companion not found' });
    }

    // Get the character for the event
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [companion.recruited_by_character_id]);

    // Soft-delete: mark dismissed instead of deleting, preserving history
    await dbRun(`
      UPDATE companions SET status = 'dismissed', dismissed_at = CURRENT_TIMESTAMP, dismissed_reason = ?
      WHERE id = ?
    `, [req.body.reason || 'Player dismissed', req.params.id]);

    // Update NPC to be available for recruitment again
    await dbRun(`
      UPDATE npcs SET campaign_availability = 'companion'
      WHERE id = ?
    `, [companion.npc_id]);

    // Emit companion dismissed event
    if (character) {
      onCompanionDismissed(companion, character).catch(err => {
        console.error('Error emitting companion dismissed event:', err);
      });
    }

    res.json({
      message: `${companion.name} has left your party and is available for re-recruitment.`,
      npcId: companion.npc_id
    });
  } catch (error) {
    handleServerError(res, error, 'dismiss companion');
  }
});

// Mark companion as deceased — propagates death across all systems
router.post('/:id/deceased', async (req, res) => {
  try {
    const companion = await dbGet(`
      SELECT c.*, n.name, c.recruited_by_character_id
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!companion) {
      return res.status(404).json({ error: 'Companion not found' });
    }

    // Get campaign_id from the recruiting character
    const character = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [companion.recruited_by_character_id]);
    const campaignId = character?.campaign_id;

    // Propagate death across all systems (NPC lifecycle, canon facts, promises, narrative queue)
    await propagateNpcDeath(companion.npc_id, campaignId, companion.recruited_by_character_id, {
      cause: req.body.cause || 'Killed in combat',
      gameDay: req.body.game_day || null,
      location: req.body.location || null,
      killer: req.body.killer || null,
      sessionId: req.body.session_id || null
    });

    res.json({
      message: `${companion.name} has fallen.`,
      companion: { ...companion, status: 'deceased' }
    });
  } catch (error) {
    handleServerError(res, error, 'mark companion as deceased');
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
      starting_inventory, // M1: merges into party bucket (character) on create
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

    // Phase 10: seed class_levels for class-based party members too
    const companionClassLevelsJson = JSON.stringify([{
      class: companion_class,
      level: companionLevel,
      subclass: companion_subclass || null
    }]);

    // Now create the companion record
    const companionResult = await dbRun(`
      INSERT INTO companions (
        npc_id, recruited_by_character_id, progression_type,
        original_stats_snapshot, companion_class, companion_subclass, companion_level,
        companion_max_hp, companion_current_hp, companion_ability_scores,
        companion_class_levels,
        skill_proficiencies, cantrips, spells_known, notes, status,
        alignment, faith, lifestyle, ideals, bonds, flaws,
        armor_class, speed, subrace, background,
        equipment, inventory, gold_gp, gold_sp, gold_cp
      ) VALUES (?, ?, 'class_based', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active',
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
      companionClassLevelsJson,
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
      // Equipment stays per-entity; carried inventory + gold go to party bucket (M1)
      equipmentJson,
      '[]', // companion.inventory stays empty — party bucket is on the recruiting character
      0, 0, 0 // companion gold stays zero — gold pooled on the character
    ]);

    // M1: merge the party member's "starting" inventory + gold into the
    // recruiting character's bucket (carried items + purse are now party-wide)
    const startingItems = Array.isArray(starting_inventory) ? starting_inventory : [];
    if (startingItems.length > 0 || (starting_gold_gp || 0) + (starting_gold_sp || 0) + (starting_gold_cp || 0) > 0) {
      const charRow = await dbGet(
        'SELECT inventory, gold_gp, gold_sp, gold_cp FROM characters WHERE id = ?',
        [recruited_by_character_id]
      );
      const charInv = safeParse(charRow?.inventory, []);
      for (const it of startingItems) {
        if (!it || !it.name) continue;
        const existing = charInv.find(i => (i.name || '').toLowerCase() === it.name.toLowerCase());
        if (existing) existing.quantity = (existing.quantity || 1) + (it.quantity || 1);
        else charInv.push({ name: it.name, quantity: it.quantity || 1 });
      }
      await dbRun(
        `UPDATE characters SET
           inventory = ?,
           gold_gp = ?, gold_sp = ?, gold_cp = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          JSON.stringify(charInv),
          (charRow?.gold_gp || 0) + (starting_gold_gp || 0),
          (charRow?.gold_sp || 0) + (starting_gold_sp || 0),
          (charRow?.gold_cp || 0) + (starting_gold_cp || 0),
          recruited_by_character_id
        ]
      );
    }

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

    // Phase 5.5: auto-assign theme + seed L1 ancestry feat for new party member
    await autoAssignCompanionTheme(companion.id, companion.companion_class, companion.companion_level || 1);
    await autoSeedCompanionAncestryFeatTier1(companion.id, companion.race, companion.companion_level || 1);

    res.status(201).json({
      message: `${name} has joined your party!`,
      companion
    });
  } catch (error) {
    handleServerError(res, error, 'create party member');
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
    handleServerError(res, error, 'fetch available companions');
  }
});

// ============================================================
// COMPANION BACKSTORY ROUTES
// ============================================================

// GET /api/companion/:id/backstory - Get companion's backstory
router.get('/:id/backstory', async (req, res) => {
  try {
    const backstory = await companionBackstoryService.getBackstoryByCompanionId(req.params.id);

    if (!backstory) {
      return res.status(404).json({ error: 'Backstory not found for this companion' });
    }

    res.json(backstory);
  } catch (error) {
    handleServerError(res, error, 'fetch backstory');
  }
});

// POST /api/companion/:id/backstory/generate - Generate or regenerate backstory
router.post('/:id/backstory/generate', async (req, res) => {
  try {
    const { regenerate = false } = req.body;

    // Get companion with NPC details
    const companion = await dbGet(`
      SELECT c.*, n.name, n.race, n.gender, n.occupation, n.personality_trait_1,
             n.personality_trait_2, n.motivation, n.background_notes
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!companion) {
      return res.status(404).json({ error: 'Companion not found' });
    }

    // Check for existing backstory
    const existingBackstory = await companionBackstoryService.getBackstoryByCompanionId(req.params.id);

    if (existingBackstory && !regenerate) {
      return res.json({
        message: 'Backstory already exists. Set regenerate=true to overwrite.',
        backstory: existingBackstory
      });
    }

    // Get character for context
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [companion.recruited_by_character_id]);

    // Get campaign if available
    const campaign = character?.campaign_id
      ? await dbGet('SELECT * FROM campaigns WHERE id = ?', [character.campaign_id])
      : null;

    // Generate the backstory
    const generated = await companionBackstoryGenerator.generateBackstory({
      companion,
      character,
      campaign
    });

    let backstory;
    if (existingBackstory) {
      // Update existing
      backstory = await companionBackstoryService.updateBackstory(existingBackstory.id, generated);
    } else {
      // Create new
      backstory = await companionBackstoryService.createBackstory({
        companion_id: req.params.id,
        ...generated
      });
    }

    res.status(201).json({
      message: existingBackstory ? 'Backstory regenerated' : 'Backstory generated',
      backstory
    });
  } catch (error) {
    handleServerError(res, error, 'generate backstory');
  }
});

// POST /api/companion/:id/backstory/threads - Add new threads to backstory
router.post('/:id/backstory/threads', async (req, res) => {
  try {
    const { count = 1, theme } = req.body;

    const backstory = await companionBackstoryService.getBackstoryByCompanionId(req.params.id);

    if (!backstory) {
      return res.status(404).json({ error: 'Backstory not found. Generate one first.' });
    }

    // Get companion for context
    const companion = await dbGet(`
      SELECT c.*, n.name, n.race, n.gender, n.occupation
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    // Generate additional threads
    const newThreads = await companionBackstoryGenerator.generateAdditionalThreads({
      companion,
      existingBackstory: backstory,
      count,
      theme
    });

    // Merge with existing threads
    const existingThreads = backstory.unresolved_threads || [];
    const allThreads = [...existingThreads, ...newThreads];

    // Update backstory
    const updated = await companionBackstoryService.updateBackstory(backstory.id, {
      unresolved_threads: allThreads
    });

    res.json({
      message: `Added ${newThreads.length} new thread(s)`,
      newThreads,
      backstory: updated
    });
  } catch (error) {
    handleServerError(res, error, 'add threads');
  }
});

// POST /api/companion/:id/backstory/secret - Generate a new secret
router.post('/:id/backstory/secret', async (req, res) => {
  try {
    const { category } = req.body;

    const backstory = await companionBackstoryService.getBackstoryByCompanionId(req.params.id);

    if (!backstory) {
      return res.status(404).json({ error: 'Backstory not found. Generate one first.' });
    }

    // Get companion for context
    const companion = await dbGet(`
      SELECT c.*, n.name, n.race, n.gender, n.occupation
      FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ?
    `, [req.params.id]);

    // Generate new secret
    const newSecret = await companionBackstoryGenerator.generateSecret({
      companion,
      existingBackstory: backstory,
      category
    });

    if (!newSecret) {
      return res.status(500).json({ error: 'Failed to generate secret' });
    }

    // Add to existing secrets
    const existingSecrets = backstory.secrets || [];
    const allSecrets = [...existingSecrets, newSecret];

    // Update backstory
    const updated = await companionBackstoryService.updateBackstory(backstory.id, {
      secrets: allSecrets
    });

    res.json({
      message: 'New secret generated',
      secret: newSecret,
      backstory: updated
    });
  } catch (error) {
    handleServerError(res, error, 'generate secret');
  }
});

// PUT /api/companion/:id/backstory/thread/:threadId - Update a thread's status
router.put('/:id/backstory/thread/:threadId', async (req, res) => {
  try {
    const { status, resolution } = req.body;

    const backstory = await companionBackstoryService.getBackstoryByCompanionId(req.params.id);

    if (!backstory) {
      return res.status(404).json({ error: 'Backstory not found' });
    }

    const threads = backstory.unresolved_threads || [];
    const threadIndex = threads.findIndex(t => t.id === req.params.threadId);

    if (threadIndex === -1) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Update thread
    threads[threadIndex] = {
      ...threads[threadIndex],
      status: status || threads[threadIndex].status,
      resolution: resolution || threads[threadIndex].resolution
    };

    const updated = await companionBackstoryService.updateBackstory(backstory.id, {
      unresolved_threads: threads
    });

    res.json({
      message: 'Thread updated',
      thread: threads[threadIndex],
      backstory: updated
    });
  } catch (error) {
    handleServerError(res, error, 'update thread');
  }
});

// POST /api/companion/:id/backstory/secret/:secretId/reveal - Reveal a secret
router.post('/:id/backstory/secret/:secretId/reveal', async (req, res) => {
  try {
    const backstory = await companionBackstoryService.getBackstoryByCompanionId(req.params.id);

    if (!backstory) {
      return res.status(404).json({ error: 'Backstory not found' });
    }

    const secrets = backstory.secrets || [];
    const secretIndex = secrets.findIndex(s => s.id === req.params.secretId);

    if (secretIndex === -1) {
      return res.status(404).json({ error: 'Secret not found' });
    }

    // Mark as revealed
    secrets[secretIndex].revealed = true;

    const updated = await companionBackstoryService.updateBackstory(backstory.id, {
      secrets
    });

    res.json({
      message: 'Secret revealed',
      secret: secrets[secretIndex],
      backstory: updated
    });
  } catch (error) {
    handleServerError(res, error, 'reveal secret');
  }
});

// ============================================================
// COMPANION ACTIVITY ROUTES
// ============================================================

// Send companion on independent activity
router.post('/:id/send-activity', async (req, res) => {
  try {
    const companion = await dbGet(`
      SELECT c.*, n.name FROM companions c
      JOIN npcs n ON c.npc_id = n.id
      WHERE c.id = ? AND c.status = 'active'
    `, [req.params.id]);

    if (!companion) {
      return res.status(404).json({ error: 'Companion not found or not active' });
    }

    const character = await dbGet('SELECT campaign_id, game_day FROM characters WHERE id = ?', [companion.recruited_by_character_id]);

    const activity = await sendOnActivity(companion.id, {
      activity_type: req.body.activity_type,
      description: req.body.description,
      location: req.body.location,
      objectives: req.body.objectives || [],
      duration_days: req.body.duration_days || 3,
      campaign_id: character?.campaign_id,
      current_game_day: character?.game_day || 1
    });

    res.json({
      message: `${companion.name} has been sent on a ${req.body.activity_type} activity.`,
      activity
    });
  } catch (error) {
    handleServerError(res, error, 'send companion on activity');
  }
});

// Get away companions for a character
router.get('/character/:characterId/away', async (req, res) => {
  try {
    const companions = await getAwayCompanions(parseInt(req.params.characterId));
    res.json(companions);
  } catch (error) {
    handleServerError(res, error, 'fetch away companions');
  }
});

// Recall companion from activity early
router.post('/activity/:activityId/recall', async (req, res) => {
  try {
    const activity = await getActivityById(parseInt(req.params.activityId));
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const character = await dbGet('SELECT game_day FROM characters WHERE id = ?', [activity.character_id]);
    const result = await recallCompanion(parseInt(req.params.activityId), character?.game_day || 1);

    res.json(result);
  } catch (error) {
    handleServerError(res, error, 'recall companion');
  }
});

// Get activity status
router.get('/activity/:activityId', async (req, res) => {
  try {
    const activity = await getActivityById(parseInt(req.params.activityId));
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    res.json(activity);
  } catch (error) {
    handleServerError(res, error, 'fetch activity status');
  }
});

export default router;
