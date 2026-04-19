/**
 * Progression Seed Runner
 *
 * Loads all static progression reference data into the database on startup:
 * - themes + theme_abilities (21 themes × 4 tier abilities each)
 * - ancestry_feats (195 feats across 13 lists)
 * - team_tactics (20 tactics)
 * - subclass_theme_synergies (50 resonant pairings)
 * - mythic_theme_amplifications (11 resonant + 7 dissonant arcs)
 *
 * Strategy: idempotent upsert — safe to run on every startup. Uses INSERT OR
 * REPLACE for tables with unique constraints and row identity we control.
 * Character-owned tables (character_themes, character_ancestry_feats, etc.)
 * are NOT touched by this seeder — they're player data.
 *
 * Logging: prints seed counts only when rows are inserted for the first time;
 * silent on subsequent startups unless verbose.
 */

import { THEMES } from '../data/themes.js';
import { ANCESTRY_FEATS } from '../data/ancestryFeats.js';
import { TEAM_TACTICS } from '../data/teamTactics.js';
import { SUBCLASS_THEME_SYNERGIES } from '../data/subclassThemeSynergies.js';
import { MYTHIC_THEME_AMPLIFICATIONS } from '../data/mythicThemeAmplifications.js';

/**
 * Run all seeders. Call after migrations have been applied.
 * Returns an object summarizing what was inserted/updated.
 */
export async function seedProgressionData(db) {
  const results = {};
  results.themes = await seedThemes(db);
  results.theme_abilities = await seedThemeAbilities(db);
  results.ancestry_feats = await seedAncestryFeats(db);
  results.team_tactics = await seedTeamTactics(db);
  results.subclass_theme_synergies = await seedSubclassThemeSynergies(db);
  results.mythic_theme_amplifications = await seedMythicThemeAmplifications(db);

  const totalInserted = Object.values(results).reduce((acc, r) => acc + (r.inserted || 0), 0);
  if (totalInserted > 0) {
    console.log('Progression seed data loaded:');
    for (const [key, res] of Object.entries(results)) {
      if (res.inserted > 0 || res.updated > 0) {
        console.log(`  ${key}: ${res.inserted} inserted${res.updated ? `, ${res.updated} updated` : ''}`);
      }
    }
  }

  return results;
}

/**
 * Seed themes reference table.
 */
async function seedThemes(db) {
  let inserted = 0;

  // Sentinel "any" theme — used as a special theme_id marker for mythic
  // amplifications that apply regardless of theme (e.g., Legend Path).
  const anyExists = await db.execute({
    sql: 'SELECT id FROM themes WHERE id = ?',
    args: ['any']
  });
  if (anyExists.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO themes (id, name, identity, tags, divergence_notes)
            VALUES (?, ?, ?, ?, ?)`,
      args: ['any', '(Any Theme)', 'Sentinel theme used by path amplifications that apply regardless of theme.', '[]', 'Not a playable theme — internal only.']
    });
    inserted++;
  }

  let updated = 0;
  for (const theme of THEMES) {
    const existing = await db.execute({
      sql: `SELECT id, description, identity, creation_choice_label, creation_choice_options
            FROM themes WHERE id = ?`,
      args: [theme.id]
    });

    if (existing.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO themes (
          id, name, identity, description, signature_skill_1, signature_skill_2,
          tags, creation_choice_label, creation_choice_options, divergence_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          theme.id,
          theme.name,
          theme.identity,
          theme.description || null,
          theme.signature_skill_1,
          theme.signature_skill_2,
          JSON.stringify(theme.tags),
          theme.creation_choice_label || null,
          theme.creation_choice_options ? JSON.stringify(theme.creation_choice_options) : null,
          theme.divergence_notes
        ]
      });
      inserted++;
    } else {
      // Refresh static fields on existing rows so changes to seed data (e.g.
      // adding missing creation_choice_options for City Watch) propagate
      // without a DB reset. Only write when at least one field differs.
      const row = existing.rows[0];
      const nextOptions = theme.creation_choice_options
        ? JSON.stringify(theme.creation_choice_options)
        : null;
      const needsUpdate =
        (theme.description && row.description !== theme.description) ||
        (theme.creation_choice_label && row.creation_choice_label !== theme.creation_choice_label) ||
        (nextOptions !== (row.creation_choice_options || null)) ||
        (theme.identity && row.identity !== theme.identity);

      if (needsUpdate) {
        // Coalesce to null (not undefined) so libsql doesn't reject the args.
        const nz = v => (v === undefined ? null : v);
        await db.execute({
          sql: `UPDATE themes SET
                  description = ?,
                  identity = ?,
                  creation_choice_label = ?,
                  creation_choice_options = ?
                WHERE id = ?`,
          args: [
            nz(theme.description || row.description),
            nz(theme.identity || row.identity),
            nz(theme.creation_choice_label || row.creation_choice_label),
            nextOptions, // already null when no options
            theme.id
          ]
        });
        updated++;
      }
    }
  }
  return { inserted, updated, total: THEMES.length };
}

/**
 * Seed theme abilities (per-tier). Depends on themes being seeded first.
 */
async function seedThemeAbilities(db) {
  let inserted = 0;
  for (const theme of THEMES) {
    for (const ability of theme.abilities) {
      const pathVariant = ability.path_variant || null;
      // Check if this (theme, tier, path_variant) combo already exists
      const existing = await db.execute({
        sql: `SELECT id FROM theme_abilities
              WHERE theme_id = ? AND tier = ? AND (path_variant IS ? OR path_variant = ?)`,
        args: [theme.id, ability.tier, pathVariant, pathVariant || '']
      });

      if (existing.rows.length === 0) {
        await db.execute({
          sql: `INSERT INTO theme_abilities (
            theme_id, tier, ability_name, ability_description,
            mechanics, flavor_text, path_variant
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            theme.id,
            ability.tier,
            ability.name,
            ability.description,
            ability.mechanics || null,
            ability.flavor || null,
            pathVariant
          ]
        });
        inserted++;
      }
    }
  }
  return { inserted };
}

/**
 * Seed ancestry feats reference table.
 */
async function seedAncestryFeats(db) {
  let inserted = 0;
  let updated = 0;
  for (const feat of ANCESTRY_FEATS) {
    const existing = await db.execute({
      sql: 'SELECT id, description, choices FROM ancestry_feats WHERE list_id = ? AND tier = ? AND choice_index = ?',
      args: [feat.list_id, feat.tier, feat.choice_index]
    });

    const choicesJson = feat.choices ? JSON.stringify(feat.choices) : null;

    if (existing.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO ancestry_feats (
          list_id, tier, choice_index, feat_name, description, mechanics, flavor_text, choices
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          feat.list_id,
          feat.tier,
          feat.choice_index,
          feat.feat_name,
          feat.description,
          feat.mechanics || null,
          feat.flavor || null,
          choicesJson
        ]
      });
      inserted++;
    } else {
      // Refresh description + choices so seed rewrite propagates to existing DBs
      const row = existing.rows[0];
      if (row.description !== feat.description || (row.choices || null) !== choicesJson) {
        await db.execute({
          sql: 'UPDATE ancestry_feats SET description = ?, choices = ? WHERE id = ?',
          args: [feat.description, choicesJson, row.id]
        });
        updated++;
      }
    }
  }
  return { inserted, updated, total: ANCESTRY_FEATS.length };
}

/**
 * Seed team tactics reference table.
 */
async function seedTeamTactics(db) {
  let inserted = 0;
  for (const tactic of TEAM_TACTICS) {
    const existing = await db.execute({
      sql: 'SELECT id FROM team_tactics WHERE id = ?',
      args: [tactic.id]
    });

    if (existing.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO team_tactics (
          id, name, category, description, trigger, effect, requirements
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          tactic.id,
          tactic.name,
          tactic.category,
          tactic.description,
          tactic.trigger,
          tactic.effect,
          tactic.requirements || null
        ]
      });
      inserted++;
    }
  }
  return { inserted, total: TEAM_TACTICS.length };
}

/**
 * Seed subclass × theme synergies reference table.
 */
async function seedSubclassThemeSynergies(db) {
  let inserted = 0;
  for (const syn of SUBCLASS_THEME_SYNERGIES) {
    const existing = await db.execute({
      sql: `SELECT id FROM subclass_theme_synergies
            WHERE class_name = ? AND subclass_name = ? AND theme_id = ?`,
      args: [syn.class_name, syn.subclass_name, syn.theme_id]
    });

    if (existing.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO subclass_theme_synergies (
          class_name, subclass_name, theme_id, synergy_name,
          description, mechanics, shared_tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          syn.class_name,
          syn.subclass_name,
          syn.theme_id,
          syn.synergy_name,
          syn.description,
          syn.mechanics || null,
          syn.shared_tags || null
        ]
      });
      inserted++;
    }
  }
  return { inserted, total: SUBCLASS_THEME_SYNERGIES.length };
}

/**
 * Seed mythic × theme amplifications reference table.
 */
async function seedMythicThemeAmplifications(db) {
  let inserted = 0;
  for (const amp of MYTHIC_THEME_AMPLIFICATIONS) {
    const existing = await db.execute({
      sql: `SELECT id FROM mythic_theme_amplifications
            WHERE mythic_path = ? AND theme_id = ?`,
      args: [amp.mythic_path, amp.theme_id]
    });

    if (existing.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO mythic_theme_amplifications (
          mythic_path, theme_id, combo_name, is_dissonant, shared_identity,
          t1_bonus, t2_bonus, t3_bonus, t4_bonus,
          dissonant_arc_description, required_threshold_acts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          amp.mythic_path,
          amp.theme_id,
          amp.combo_name,
          amp.is_dissonant ? 1 : 0,
          amp.shared_identity || null,
          amp.t1_bonus || null,
          amp.t2_bonus || null,
          amp.t3_bonus || null,
          amp.t4_bonus || null,
          amp.dissonant_arc_description || null,
          amp.required_threshold_acts || null
        ]
      });
      inserted++;
    }
  }
  return { inserted, total: MYTHIC_THEME_AMPLIFICATIONS.length };
}
