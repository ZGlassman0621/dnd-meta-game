/**
 * Migration 038: Theme descriptions
 *
 * Adds a `description` column to the `themes` table. The existing `identity`
 * column captures the theme's *mechanical* identity (signature skills, tags,
 * etc.) in a terse form. `description` is the player-facing 2-3 sentence
 * narrative blurb — what life was like, what the theme means for the
 * character — in the PHB-background voice.
 *
 * Also adds a `choices` column to `ancestry_feats` so the seeder can persist
 * the sub-choice schema (skill picks, language picks, damage type picks, etc.)
 * alongside each feat. Storing as JSON; NULL for feats without sub-choices.
 */

export async function up(db) {
  // themes.description
  const themesInfo = await db.execute(`PRAGMA table_info(themes)`);
  const hasDescription = themesInfo.rows.some(col => col.name === 'description');
  if (!hasDescription) {
    await db.execute(`ALTER TABLE themes ADD COLUMN description TEXT`);
  }

  // ancestry_feats.choices
  const featsInfo = await db.execute(`PRAGMA table_info(ancestry_feats)`);
  const hasChoices = featsInfo.rows.some(col => col.name === 'choices');
  if (!hasChoices) {
    await db.execute(`ALTER TABLE ancestry_feats ADD COLUMN choices TEXT`);
  }

  // character_ancestry_feats.choices_data — JSON of player resolutions
  // e.g. { "skill": "perception", "language": "dwarvish" }
  const charFeatsInfo = await db.execute(`PRAGMA table_info(character_ancestry_feats)`);
  const hasChoicesData = charFeatsInfo.rows.some(col => col.name === 'choices_data');
  if (!hasChoicesData) {
    await db.execute(`ALTER TABLE character_ancestry_feats ADD COLUMN choices_data TEXT`);
  }
}

export async function down(db) {
  // SQLite doesn't support DROP COLUMN pre-3.35 in a portable way; we leave
  // the columns in place on rollback. They're nullable and harmless.
}
