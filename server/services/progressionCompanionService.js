/**
 * Progression Companion Service (Phase 5.5)
 *
 * Companion analog of the player-character progression logic in
 * `server/routes/character.js` (computeProgressionDecisions) and
 * `progressionService.js`. Companions progress differently:
 *
 *  - Theme is auto-assigned at recruit time based on companion_class.
 *  - Ancestry list is derived from the linked NPC's race via a normalization
 *    helper. If the race can't be mapped, the companion silently skips
 *    ancestry-feat progression.
 *  - At tier thresholds, theme abilities auto-unlock (same as players) AND
 *    ancestry feats auto-pick (unlike players, who choose) — one less prompt
 *    per companion per level-up.
 *
 * All writes here are idempotent (INSERT OR IGNORE / OR REPLACE on
 * (companion_id, tier) uniques) so it's safe to call from multiple paths.
 */

import { dbAll, dbGet, dbRun } from '../database.js';

/**
 * Default theme assignment by class. Chosen to feel thematically fitting for
 * a typical member of that class, without requiring backstory parsing.
 * Unknown/missing classes fall back to 'soldier' (the most generic theme).
 */
const CLASS_TO_THEME = {
  fighter: 'soldier',
  barbarian: 'outlander',
  ranger: 'outlander',
  rogue: 'criminal',
  wizard: 'sage',
  sorcerer: 'noble',
  warlock: 'haunted_one',
  cleric: 'acolyte',
  paladin: 'knight_of_the_order',
  monk: 'hermit',
  druid: 'hermit',
  bard: 'entertainer',
  artificer: 'guild_artisan',
  keeper: 'hermit'
};

export function mapCompanionClassToTheme(className) {
  if (!className) return 'soldier';
  const normalized = String(className).trim().toLowerCase();
  return CLASS_TO_THEME[normalized] || 'soldier';
}

/**
 * Normalize a free-text race string (from an NPC record) into one of the
 * strict list_id keys used by `ancestry_feats`. Returns null when the text
 * doesn't match any known list — callers should silently skip ancestry-feat
 * progression in that case.
 *
 * Order of checks matters: 'drow', 'half_elf', 'half_orc' must be caught
 * before the generic 'elf'/'orc' patterns.
 */
export function normalizeRaceToAncestryList(raceText) {
  if (!raceText) return null;
  const lowered = String(raceText).trim().toLowerCase();

  if (lowered.includes('drow')) return 'drow';
  if (lowered.includes('half-elf') || lowered.includes('half elf')) return 'half_elf';
  if (lowered.includes('half-orc') || lowered.includes('half orc')) return 'half_orc';

  if (lowered.includes('aasimar')) {
    if (lowered.includes('scourge')) return 'aasimar_scourge';
    if (lowered.includes('fallen')) return 'aasimar_fallen';
    return 'aasimar_protector';
  }

  if (lowered.includes('warforged')) return 'warforged';
  if (lowered.includes('dragonborn')) return 'dragonborn';
  if (lowered.includes('tiefling')) return 'tiefling';
  if (lowered.includes('halfling')) return 'halfling';
  if (lowered.includes('dwarf')) return 'dwarf';
  if (lowered.includes('elf') || lowered.includes('elven') || lowered.includes('eladrin')) return 'elf';
  if (lowered.includes('human')) return 'human';

  return null;
}

/**
 * Auto-assign a theme to a companion and unlock its L1 ability. Idempotent —
 * if the companion already has a theme row, this is a no-op (we don't
 * overwrite, since the user may have edited it later).
 *
 * Returns the theme_id that's now on record, or null on error (never throws;
 * companion recruitment should not fail on a progression side-effect).
 */
export async function autoAssignCompanionTheme(companionId, className, currentLevel = 1) {
  try {
    const existing = await dbGet(
      'SELECT theme_id FROM companion_themes WHERE companion_id = ?',
      [companionId]
    );
    if (existing) return existing.theme_id;

    const themeId = mapCompanionClassToTheme(className);

    await dbRun(
      `INSERT OR IGNORE INTO companion_themes (companion_id, theme_id, path_choice)
       VALUES (?, ?, NULL)`,
      [companionId, themeId]
    );

    const l1Ability = await dbGet(
      `SELECT id FROM theme_abilities
       WHERE theme_id = ? AND tier = 1 AND path_variant IS NULL LIMIT 1`,
      [themeId]
    );
    if (l1Ability) {
      await dbRun(
        `INSERT OR IGNORE INTO companion_theme_unlocks
         (companion_id, theme_id, tier, tier_ability_id, unlocked_at_level, narrative_delivery)
         VALUES (?, ?, 1, ?, ?, ?)`,
        [companionId, themeId, l1Ability.id, currentLevel || 1, 'Auto-assigned at recruitment.']
      );
    }

    return themeId;
  } catch (err) {
    console.error('autoAssignCompanionTheme failed:', err);
    return null;
  }
}

/**
 * If the companion has no ancestry-feat row yet (first-ever tier), seed one
 * at tier 1 based on the NPC's race. Silently skips if the race can't be
 * mapped to a list. Returns the list_id used, or null if skipped.
 */
export async function autoSeedCompanionAncestryFeatTier1(companionId, raceText, currentLevel = 1) {
  try {
    const existing = await dbGet(
      'SELECT id FROM companion_ancestry_feats WHERE companion_id = ? AND tier = 1',
      [companionId]
    );
    if (existing) {
      const row = await dbGet(
        `SELECT af.list_id FROM companion_ancestry_feats caf
         JOIN ancestry_feats af ON caf.feat_id = af.id
         WHERE caf.companion_id = ? AND caf.tier = 1 LIMIT 1`,
        [companionId]
      );
      return row ? row.list_id : null;
    }

    const listId = normalizeRaceToAncestryList(raceText);
    if (!listId) return null;

    const options = await dbAll(
      `SELECT id, choice_index FROM ancestry_feats
       WHERE list_id = ? AND tier = 1 ORDER BY choice_index`,
      [listId]
    );
    if (options.length === 0) return null;

    const picked = options[0];
    await dbRun(
      `INSERT OR IGNORE INTO companion_ancestry_feats
       (companion_id, feat_id, tier, selected_at_level, narrative_delivery)
       VALUES (?, ?, 1, ?, ?)`,
      [companionId, picked.id, currentLevel || 1, 'Auto-picked at recruitment.']
    );
    return listId;
  } catch (err) {
    console.error('autoSeedCompanionAncestryFeatTier1 failed:', err);
    return null;
  }
}

/**
 * Compute progression decisions for a companion crossing into `newLevel`.
 * Mirrors `computeProgressionDecisions` from character.js, but reads the
 * companion_* tables and always returns a single auto-pick for ancestry
 * feats (since companions don't choose).
 *
 * Returns:
 *   {
 *     theme_tier_unlock: { tier, theme_id, theme_name, tier_ability_id, ability_name, ability_description, mechanics, flavor_text } | null,
 *     ancestry_feat_auto_pick: { tier, list_id, feat_id, feat_name, description, mechanics, flavor_text } | null
 *   }
 */
export async function computeCompanionProgressionDecisions(companionId, newLevel) {
  const themeTierThresholds = { 5: 5, 11: 11, 17: 17 };
  const ancestryFeatThresholds = { 3: 3, 7: 7, 13: 13, 18: 18 };

  const result = {
    theme_tier_unlock: null,
    ancestry_feat_auto_pick: null
  };

  // Theme tier auto-unlock
  if (themeTierThresholds[newLevel]) {
    const tier = newLevel;
    const companionTheme = await dbGet(
      'SELECT theme_id FROM companion_themes WHERE companion_id = ?',
      [companionId]
    );
    if (companionTheme) {
      const existing = await dbGet(
        'SELECT id FROM companion_theme_unlocks WHERE companion_id = ? AND tier = ?',
        [companionId, tier]
      );
      if (!existing) {
        const ability = await dbGet(
          `SELECT ta.id, ta.ability_name, ta.ability_description, ta.mechanics, ta.flavor_text, t.name as theme_name
           FROM theme_abilities ta JOIN themes t ON ta.theme_id = t.id
           WHERE ta.theme_id = ? AND ta.tier = ? AND ta.path_variant IS NULL
           LIMIT 1`,
          [companionTheme.theme_id, tier]
        );
        if (ability) {
          result.theme_tier_unlock = {
            tier,
            theme_id: companionTheme.theme_id,
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

  // Ancestry feat auto-pick
  if (ancestryFeatThresholds[newLevel]) {
    const tier = newLevel;
    const existingAnyFeat = await dbGet(
      `SELECT af.list_id FROM companion_ancestry_feats caf
       JOIN ancestry_feats af ON caf.feat_id = af.id
       WHERE caf.companion_id = ? LIMIT 1`,
      [companionId]
    );
    if (existingAnyFeat) {
      const listId = existingAnyFeat.list_id;
      const tierExisting = await dbGet(
        'SELECT id FROM companion_ancestry_feats WHERE companion_id = ? AND tier = ?',
        [companionId, tier]
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
          const picked = options[0];
          result.ancestry_feat_auto_pick = {
            tier,
            list_id: listId,
            feat_id: picked.id,
            feat_name: picked.feat_name,
            description: picked.description,
            mechanics: picked.mechanics,
            flavor_text: picked.flavor_text
          };
        }
      }
    }
  }

  return result;
}

/**
 * Lazy backfill: make sure an existing companion has a theme + tier-1 feat
 * before we compute progression decisions for it. Returns true if anything
 * was seeded, false if the companion was already set up.
 */
export async function ensureCompanionProgressionInitialized(companionId) {
  const companion = await dbGet(
    `SELECT c.id, c.companion_class, c.companion_level, n.race
     FROM companions c JOIN npcs n ON c.npc_id = n.id
     WHERE c.id = ?`,
    [companionId]
  );
  if (!companion) return false;

  let seeded = false;
  const hadTheme = await dbGet(
    'SELECT theme_id FROM companion_themes WHERE companion_id = ?',
    [companionId]
  );
  if (!hadTheme) {
    await autoAssignCompanionTheme(companionId, companion.companion_class, companion.companion_level || 1);
    seeded = true;
  }

  const hadFeat = await dbGet(
    'SELECT id FROM companion_ancestry_feats WHERE companion_id = ? LIMIT 1',
    [companionId]
  );
  if (!hadFeat) {
    const listId = await autoSeedCompanionAncestryFeatTier1(
      companionId,
      companion.race,
      companion.companion_level || 1
    );
    if (listId) seeded = true;
  }

  return seeded;
}
