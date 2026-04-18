/**
 * Progression API Routes
 *
 * Read-only endpoints exposing the Theme, Ancestry Feat, Team Tactic, and
 * synergy/amplification reference data for the character creation wizard,
 * level-up wizard, and character sheet display.
 *
 * Character-specific progression state (selected themes, unlocked abilities,
 * learned tactics, arc trackers) lives on the character routes and is driven
 * by gameplay; this router only exposes the static catalog.
 */

import express from 'express';
import { dbAll, dbGet } from '../database.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

/**
 * GET /api/progression/themes
 * Returns all themes with metadata and their L1 ability (enough for the
 * character creation dropdown + preview). Excludes the internal "any" sentinel.
 */
router.get('/themes', async (req, res) => {
  try {
    const themes = await dbAll(`
      SELECT id, name, identity, description, signature_skill_1, signature_skill_2,
             tags, creation_choice_label, creation_choice_options, divergence_notes
      FROM themes
      WHERE id != 'any'
      ORDER BY name
    `);

    // Attach each theme's L1 ability for preview in the picker
    const l1Abilities = await dbAll(`
      SELECT theme_id, ability_name, ability_description, flavor_text
      FROM theme_abilities
      WHERE tier = 1
    `);
    const l1ByTheme = Object.fromEntries(l1Abilities.map(a => [a.theme_id, a]));

    const enriched = themes.map(t => ({
      ...t,
      tags: t.tags ? JSON.parse(t.tags) : [],
      creation_choice_options: t.creation_choice_options ? JSON.parse(t.creation_choice_options) : null,
      l1_ability: l1ByTheme[t.id] || null
    }));

    res.json(enriched);
  } catch (err) {
    handleServerError(res, err, 'Failed to fetch themes');
  }
});

/**
 * GET /api/progression/themes/:id
 * Returns a single theme with ALL tier abilities (L1, L5, L11, L17).
 */
router.get('/themes/:id', async (req, res) => {
  try {
    const theme = await dbGet(`
      SELECT id, name, identity, description, signature_skill_1, signature_skill_2,
             tags, creation_choice_label, creation_choice_options, divergence_notes
      FROM themes
      WHERE id = ?
    `, [req.params.id]);

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    const abilities = await dbAll(`
      SELECT tier, ability_name, ability_description, mechanics, flavor_text, path_variant
      FROM theme_abilities
      WHERE theme_id = ?
      ORDER BY tier, path_variant
    `, [req.params.id]);

    res.json({
      ...theme,
      tags: theme.tags ? JSON.parse(theme.tags) : [],
      creation_choice_options: theme.creation_choice_options ? JSON.parse(theme.creation_choice_options) : null,
      abilities
    });
  } catch (err) {
    handleServerError(res, err, 'Failed to fetch theme');
  }
});

/**
 * GET /api/progression/ancestry-feats/:listId
 * Returns all ancestry feats for a specific list, grouped by tier.
 * Optional query param ?tier=N limits to a specific tier (useful for character
 * creation which only needs L1).
 *
 * listId examples: 'dwarf', 'elf', 'drow', 'aasimar_protector', 'half_elf'
 */
router.get('/ancestry-feats/:listId', async (req, res) => {
  try {
    const tierFilter = req.query.tier ? parseInt(req.query.tier, 10) : null;
    const sql = tierFilter
      ? `SELECT id, list_id, tier, choice_index, feat_name, description, mechanics, flavor_text, choices
         FROM ancestry_feats
         WHERE list_id = ? AND tier = ?
         ORDER BY tier, choice_index`
      : `SELECT id, list_id, tier, choice_index, feat_name, description, mechanics, flavor_text, choices
         FROM ancestry_feats
         WHERE list_id = ?
         ORDER BY tier, choice_index`;
    const args = tierFilter ? [req.params.listId, tierFilter] : [req.params.listId];
    const feats = await dbAll(sql, args);

    if (feats.length === 0) {
      return res.status(404).json({ error: `No ancestry feats found for list '${req.params.listId}'` });
    }

    // Parse choices JSON for each feat so the UI doesn't have to
    const parsed = feats.map(f => ({
      ...f,
      choices: f.choices ? JSON.parse(f.choices) : null
    }));

    res.json(parsed);
  } catch (err) {
    handleServerError(res, err, 'Failed to fetch ancestry feats');
  }
});

/**
 * GET /api/progression/team-tactics
 * Returns the full catalog of 20 Team Tactics.
 */
router.get('/team-tactics', async (req, res) => {
  try {
    const tactics = await dbAll(`
      SELECT id, name, category, description, trigger, effect, requirements
      FROM team_tactics
      ORDER BY category, name
    `);
    res.json(tactics);
  } catch (err) {
    handleServerError(res, err, 'Failed to fetch team tactics');
  }
});

/**
 * GET /api/progression/subclass-theme-synergies
 * Returns all ~50 resonant subclass × theme pairings. Character sheet UI can
 * filter to show only synergies matching the character's current subclass + theme.
 */
router.get('/subclass-theme-synergies', async (req, res) => {
  try {
    const synergies = await dbAll(`
      SELECT id, class_name, subclass_name, theme_id, synergy_name,
             description, mechanics, shared_tags
      FROM subclass_theme_synergies
      ORDER BY class_name, subclass_name, theme_id
    `);
    res.json(synergies);
  } catch (err) {
    handleServerError(res, err, 'Failed to fetch subclass-theme synergies');
  }
});

/**
 * GET /api/progression/mythic-amplifications
 * Returns all path × theme amplifications (resonant + dissonant).
 */
router.get('/mythic-amplifications', async (req, res) => {
  try {
    const amps = await dbAll(`
      SELECT id, mythic_path, theme_id, combo_name, is_dissonant, shared_identity,
             t1_bonus, t2_bonus, t3_bonus, t4_bonus,
             dissonant_arc_description, required_threshold_acts
      FROM mythic_theme_amplifications
      ORDER BY mythic_path, theme_id
    `);
    res.json(amps);
  } catch (err) {
    handleServerError(res, err, 'Failed to fetch mythic amplifications');
  }
});

export default router;
