/**
 * Migration 097: Enemy concentration + spell effects table (combat item 6,
 * enemy spellcasting resolution + spell fine print).
 *
 * combat_enemies gains concentrating_on (mirrors companions, migration
 * 084): the spell the enemy is concentrating on, or NULL. Enemy
 * concentration saves, breaks, and replacement mirror the PC/companion
 * functions in concentrationService.
 *
 * New table spell_effects: one row per creature under a spell effect
 * that outlives the cast — a condition from a failed save, with its
 * save DC/ability for repeat saves, its concentration link (so breaking
 * the caster's concentration ends it), and its remaining rounds for
 * minute-scale non-concentration durations (NULL = until concentration
 * breaks, dispelled, or the DM ends it). Repeat-save counting (Flesh to
 * Stone's three successes / three failures) rides repeat_successes /
 * repeat_failures; single-save spells clear on the first success.
 */
export async function up(db) {
  const info = await db.execute(`PRAGMA table_info(combat_enemies)`);
  const cols = info.rows.map((c) => c.name);
  if (!cols.includes('concentrating_on')) {
    await db.execute(
      `ALTER TABLE combat_enemies ADD COLUMN concentrating_on TEXT`
    );
  }
  await db.execute(
    `CREATE TABLE IF NOT EXISTS spell_effects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      encounter_seq INTEGER NOT NULL,
      target_kind TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      target_name TEXT,
      spell TEXT NOT NULL,
      caster_kind TEXT,
      caster_key TEXT,
      caster_name TEXT,
      condition_name TEXT,
      save_ability TEXT,
      save_dc INTEGER,
      repeat_save TEXT NOT NULL DEFAULT 'none',
      repeat_successes INTEGER NOT NULL DEFAULT 0,
      repeat_failures INTEGER NOT NULL DEFAULT 0,
      rounds_remaining INTEGER,
      concentration INTEGER NOT NULL DEFAULT 0
    )`
  );
}

export function down() {
  // No-op by convention (091 pattern): columns and tables are never dropped.
}
