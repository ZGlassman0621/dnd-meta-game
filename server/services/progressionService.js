/**
 * Progression Service
 *
 * Reusable logic for fetching a character's full progression snapshot —
 * theme, tier abilities (unlocked + upcoming), ancestry feats, Knight moral
 * path, and any resonant Subclass × Theme / Mythic × Theme combos.
 *
 * Consumed by:
 * - GET /api/character/:id/progression (Character Sheet Progression tab)
 * - DM session start (feeds progression into the AI DM system prompt)
 * - Any future consumer that needs progression state (level-up wizard, etc.)
 *
 * This is the single source of truth for assembling a progression snapshot.
 * Do not duplicate the SQL queries elsewhere.
 */

import { dbAll, dbGet } from '../database.js';

function safeJsonParse(v) {
  if (v == null) return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
}

/**
 * Fetch the full progression snapshot for a character. Returns null if the
 * character doesn't exist. Returns a complete object shape (with null fields
 * where data is missing) if the character exists but hasn't selected a theme
 * or feats yet.
 */
export async function getCharacterProgression(characterId) {
  const character = await dbGet(
    'SELECT id, class, subclass, level FROM characters WHERE id = ?',
    [characterId]
  );
  if (!character) return null;

  const themeRow = await dbGet(
    `SELECT ct.theme_id, ct.path_choice, ct.path_data, t.name as theme_name,
            t.identity, t.signature_skill_1, t.signature_skill_2, t.tags
     FROM character_themes ct JOIN themes t ON ct.theme_id = t.id
     WHERE ct.character_id = ?`,
    [characterId]
  );

  const unlocks = await dbAll(
    `SELECT ctu.tier, ctu.unlocked_at_level, ctu.narrative_delivery,
            ta.ability_name, ta.ability_description, ta.mechanics, ta.flavor_text
     FROM character_theme_unlocks ctu
     LEFT JOIN theme_abilities ta ON ctu.tier_ability_id = ta.id
     WHERE ctu.character_id = ?
     ORDER BY ctu.tier`,
    [characterId]
  );

  let themeAllTiers = [];
  if (themeRow) {
    themeAllTiers = await dbAll(
      `SELECT tier, ability_name, ability_description, mechanics, flavor_text, path_variant
       FROM theme_abilities
       WHERE theme_id = ?
       ORDER BY tier, path_variant`,
      [themeRow.theme_id]
    );
  }

  const ancestryFeatRows = await dbAll(
    `SELECT caf.tier, caf.selected_at_level, caf.narrative_delivery, caf.choices_data,
            af.list_id, af.feat_name, af.description, af.mechanics, af.flavor_text, af.choices
     FROM character_ancestry_feats caf
     JOIN ancestry_feats af ON caf.feat_id = af.id
     WHERE caf.character_id = ?
     ORDER BY caf.tier`,
    [characterId]
  );
  const ancestryFeats = ancestryFeatRows.map(row => ({
    ...row,
    choices: row.choices ? safeJsonParse(row.choices) : null,
    choices_data: row.choices_data ? safeJsonParse(row.choices_data) : null
  }));

  const knightPath = await dbGet(
    `SELECT current_path, last_path_change_reason
     FROM knight_moral_paths WHERE character_id = ?`,
    [characterId]
  );

  let subclassThemeSynergy = null;
  if (themeRow && character.class && character.subclass) {
    subclassThemeSynergy = await dbGet(
      `SELECT class_name, subclass_name, theme_id, synergy_name,
              description, mechanics, shared_tags
       FROM subclass_theme_synergies
       WHERE class_name = ? AND subclass_name = ? AND theme_id = ?`,
      [character.class, character.subclass, themeRow.theme_id]
    );
  }

  let mythicThemeAmplification = null;
  try {
    const mythic = await dbGet(
      `SELECT mythic_path FROM mythic_characters WHERE character_id = ?`,
      [characterId]
    );
    if (mythic && mythic.mythic_path && themeRow) {
      mythicThemeAmplification = await dbGet(
        `SELECT mythic_path, theme_id, combo_name, is_dissonant, shared_identity,
                t1_bonus, t2_bonus, t3_bonus, t4_bonus,
                dissonant_arc_description, required_threshold_acts
         FROM mythic_theme_amplifications
         WHERE mythic_path = ? AND (theme_id = ? OR theme_id = 'any')
         ORDER BY CASE WHEN theme_id = 'any' THEN 1 ELSE 0 END
         LIMIT 1`,
        [mythic.mythic_path, themeRow.theme_id]
      );
    }
  } catch (e) {
    // Mythic tables may not exist for this character — safe to skip
  }

  return {
    character: {
      id: character.id,
      class: character.class,
      subclass: character.subclass,
      level: character.level
    },
    theme: themeRow
      ? {
          ...themeRow,
          tags: themeRow.tags ? JSON.parse(themeRow.tags) : []
        }
      : null,
    theme_all_tiers: themeAllTiers,
    theme_unlocks: unlocks,
    ancestry_feats: ancestryFeats,
    knight_moral_path: knightPath || null,
    subclass_theme_synergy: subclassThemeSynergy,
    mythic_theme_amplification: mythicThemeAmplification
  };
}
