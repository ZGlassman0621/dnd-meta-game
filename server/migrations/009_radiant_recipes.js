/**
 * Migration 009 — Radiant Recipes + Recipe Name Uniqueness
 *
 * Adds support for AI-generated "radiant" recipes that emerge from gameplay,
 * and a unique index on recipe names for safe incremental seeding.
 */

export async function up(db) {
  const addColumn = async (table, col, sql) => {
    const columns = await db.execute(`PRAGMA table_info(${table})`);
    const exists = columns.rows.some(r => r.name === col);
    if (!exists) await db.execute(sql);
  };

  // Mark AI-generated recipes
  await addColumn('crafting_recipes', 'is_radiant',
    'ALTER TABLE crafting_recipes ADD COLUMN is_radiant INTEGER DEFAULT 0');

  // NPC attribution for gifted recipes
  await addColumn('crafting_recipes', 'gifted_by',
    'ALTER TABLE crafting_recipes ADD COLUMN gifted_by TEXT');

  // Unique name index for INSERT OR IGNORE seeding
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crafting_recipes_name
    ON crafting_recipes(name)
  `);
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_crafting_recipes_name');
}
