/**
 * 078_companion_engine.js — Companion Engine (DM System Part 2)
 *
 * Companions are characters, not tools. Adds the state columns the companion
 * initiative service needs:
 *  - personal_goals    JSON [{ goal, priority, keywords }]
 *  - what_they_know    JSON [{ id, fact, known_to_pc, keywords }]
 *  - relationship_to_pc JSON { trust, respect, friction } (0-100, tracked never narrated)
 *  - current_task      JSON { description, assigned_by, assigned_day, status } | null
 *
 * Additive only. Hidden agendas live on the companion's npcs row (migration 077).
 */
/**
 * NOTE: up() MUST write through the `db` argument — that is the migration
 * runner's write transaction. Importing dbAll/dbRun from ../database.js
 * escapes the transaction onto a different connection, which deadlocks
 * against the transaction's own write lock: SQLITE_BUSY on every boot
 * (hit 2026-10-20, ~21 test files). Same pattern as 077.
 */
const COLUMNS = [
  ['personal_goals', 'TEXT'],
  ['what_they_know', 'TEXT'],
  ['relationship_to_pc', 'TEXT'],
  ['current_task', 'TEXT'],
];

export async function up(db) {
  const info = await db.execute(`PRAGMA table_info(companions)`);
  const names = new Set(info.rows.map((c) => c.name));
  for (const [col, type] of COLUMNS) {
    if (!names.has(col)) {
      await db.execute(`ALTER TABLE companions ADD COLUMN ${col} ${type}`);
    }
  }
}

// Migrations in this project are additive; no down migration.
export async function down() {}
