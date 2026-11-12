// server/services/themeService.js — theme registry lookup (Stage 3, 2026-11-06).
//
// The registry (server/data/themes.js) is the server's single source of
// truth for playable themes. This service mirrors the speciesService
// pattern: thin resolution over the data file, no DB reads. The
// /api/themes route reads the file through here, NOT the seeded
// `themes` table — the seed only carries the fields its explicit
// column list names (id, name, identity, description, signature
// skills, tags, creation choice, divergence notes), so the Stage 3
// fields below are invisible to it and cannot break seeding.
//
// Resolution rules (case-insensitive, hyphens/spaces/underscores
// equivalent): a theme id ('city_watch', 'City Watch') or name.
// Unknown input resolves to null — callers fall back, never invent.
//
// Stage 3 fields (draft §2/§3, fixed per theme — the 2024 model):
//   origin_feat — one fixed origin-feat key per theme
//   origin_feat_spell_list — ONLY on the three Magic Initiate themes
//     (acolyte → Cleric, sage → Wizard, outlander → Druid). The list
//     is FIXED by the theme, not a player pick.
//   ability_score_increase — one fixed +2/+1 split per theme
//     (snake_case keys, e.g. { wis: 2, int: 1 }).
// No origin feat grants an ASI in 2024, so nothing stacks: the most
// any theme grants in one stat at L1 is +2, from the ASI itself.
// The theme ASI is NOT written to the character row — it resolves
// from themes.js via the stored theme at Stage 4 (Scores page).
import { THEMES } from '../data/themes.js';
import { THEME_GOLD_MODIFIERS } from '../data/themeGoldModifiers.js';
import { getFeatEffect } from '../data/featRegistry.js';

export { THEMES };

export function listThemes() {
  return THEMES;
}

function normKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Resolve a theme id (or name) to its registry entry, or null when
 * unknown. Never invents an entry.
 */
export function resolveTheme(id) {
  if (!id || typeof id !== 'string') return null;
  const k = normKey(id);
  if (!k) return null;
  return THEMES.find(t => normKey(t.id) === k || normKey(t.name) === k) || null;
}

/**
 * The theme's fixed origin-feat key. Accepts an entry or an id string.
 * Returns null when the theme is unknown or carries no feat.
 */
export function originFeatFor(theme) {
  const entry = typeof theme === 'string' ? resolveTheme(theme) : theme;
  return entry?.origin_feat || null;
}

/**
 * The player's stored theme creation choices as display lines —
 * creation-solidification item 1. Reads character_themes.path_choice
 * (the single choice: Soldier rank, guild trade, region, city, ...)
 * and path_data (the Soldier's second field, { active_duty }) exactly
 * as stored. The registry option's label is used when the stored
 * value matches an option ('sergeant' -> 'Sergeant'); otherwise the
 * stored value is printed verbatim (origin-region choices carry no
 * fixed option list). Never re-asks, never rewrites, never invents:
 * a theme with no creation choice, or nothing stored, returns [].
 *
 * @returns {Array<{ key: string, label: string, value: string }>}
 */
export function themeChoiceLines(themeId, pathChoice, pathData) {
  const entry = resolveTheme(themeId);
  if (!entry) return [];
  const lines = [];
  const optionLabel = (options, value) => {
    const hit = Array.isArray(options)
      ? options.find(o => o && String(o.value).toLowerCase() === String(value).toLowerCase())
      : null;
    return hit?.label || String(value);
  };
  if (entry.creation_choice_label && pathChoice != null && String(pathChoice).trim()) {
    lines.push({
      key: 'path_choice',
      label: entry.creation_choice_label,
      value: optionLabel(entry.creation_choice_options, String(pathChoice).trim()),
    });
  }
  const second = entry.creation_choice_second_field;
  if (second?.key && pathData != null) {
    let data = pathData;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { data = null; }
    }
    const raw = data && typeof data === 'object' ? data[second.key] : null;
    if (raw != null && String(raw).trim()) {
      lines.push({
        key: second.key,
        label: second.label || second.key,
        value: optionLabel(second.options, String(raw).trim()),
      });
    }
  }
  return lines;
}

/**
 * Client shape for /api/themes and the creator shell — the registry
 * fields the Stage 3 picker renders, plus the resolved feat name +
 * effect so the client never has to look the feat up itself.
 */
export function toClientShape(entry) {
  const feat = entry.origin_feat ? getFeatEffect(entry.origin_feat) : null;
  return {
    id: entry.id,
    name: entry.name,
    identity: entry.identity || '',
    description: entry.description || '',
    signature_skill_1: entry.signature_skill_1 || null,
    signature_skill_2: entry.signature_skill_2 || null,
    tags: entry.tags || [],
    abilities: entry.abilities || [],
    creation_choice_label: entry.creation_choice_label || null,
    creation_choice_options: entry.creation_choice_options || null,
    // R2-11(g): 'origin_regions' means the location options follow
    // the character's origin setting — the client resolves regions
    // (non-FR) or the FR default list (FR) from the origin data.
    // Passed through untouched, like the options themselves.
    creation_choice_source: entry.creation_choice_source || null,
    // R2-11(e): soldier's second field (active-duty status) — a
    // { key, label, options } descriptor, or null. Stored in
    // character_themes.path_data; see persistThemeSelection.
    creation_choice_second_field: entry.creation_choice_second_field || null,
    origin_feat: entry.origin_feat || null,
    origin_feat_spell_list: entry.origin_feat_spell_list || null,
    ability_score_increase: entry.ability_score_increase || null,
    origin_feat_name: feat?.name || null,
    origin_feat_effect: feat?.effect || null,
    // Stage 5 (2026-11-07): the theme's starting-gold modifier
    // (decimal, e.g. noble +0.50, urchin −0.50, soldier 0) from the
    // server-side THEME_GOLD_MODIFIERS table. Additive only — the
    // client keeps its own copy for display, and /api/themes now
    // serves the same number the gold fork computes from at submit.
    goldModifier: THEME_GOLD_MODIFIERS[entry.id] ?? 0,
  };
}
