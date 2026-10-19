/**
 * Migration 074: Unified entity schedule + world clock (Travel/Time #13).
 *
 * One authoritative clock (world_clock singleton). One timeline table
 * (entity_schedule) for ALL scheduled activities: travel, scouting,
 * crafting, training, etc. The details_json field holds extensible
 * gameplay state for future systems (away-mission checks, material
 * requirements, training outcomes, etc.)
 */
export async function up(db) {
  // Single authoritative world clock
  await db.execute(`
    CREATE TABLE IF NOT EXISTS world_clock (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_day INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`INSERT OR IGNORE INTO world_clock (id, current_day) VALUES (1, 1)`);

  // Unified entity schedule
  await db.execute(`
    CREATE TABLE IF NOT EXISTS entity_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('pc', 'companion', 'npc')),
      entity_id INTEGER,
      entity_name TEXT NOT NULL,
      activity TEXT NOT NULL,
      location TEXT,
      destination TEXT,
      start_day INTEGER NOT NULL,
      end_day INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK (end_day >= start_day)
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_schedule_entity ON entity_schedule(entity_type, entity_id, status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_schedule_days ON entity_schedule(start_day, end_day, status)`);
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_schedule_days');
  await db.execute('DROP INDEX IF EXISTS idx_schedule_entity');
  await db.execute('DROP TABLE IF EXISTS entity_schedule');
  await db.execute('DROP TABLE IF EXISTS world_clock');
}
