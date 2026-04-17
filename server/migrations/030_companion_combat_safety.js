/**
 * Migration 030: Companion Combat Safety (Phase 7)
 *
 * Gives companions persistent condition tracking (previously session-only
 * client state — lost when a session ended) and full death save tracking
 * (previously nonexistent).
 *
 * Columns on `companions`:
 *  - active_conditions: JSON array of condition keys (e.g. ["poisoned",
 *    "prone"]) plus at most one exhaustion key ("exhaustion_1" ..
 *    "exhaustion_6"). Cleared selectively by rest/combat per 5e rules.
 *  - death_save_successes: INTEGER 0..3. Auto-reset when HP goes above 0.
 *  - death_save_failures:  INTEGER 0..3. Auto-reset when HP goes above 0
 *    or a long rest is taken.
 */

export async function up(db) {
  const cols = [
    { col: 'active_conditions', sql: "ALTER TABLE companions ADD COLUMN active_conditions TEXT DEFAULT '[]'" },
    { col: 'death_save_successes', sql: "ALTER TABLE companions ADD COLUMN death_save_successes INTEGER DEFAULT 0" },
    { col: 'death_save_failures', sql: "ALTER TABLE companions ADD COLUMN death_save_failures INTEGER DEFAULT 0" }
  ];

  const existing = await db.execute(`PRAGMA table_info(companions)`);
  const existingNames = new Set(existing.rows.map(r => r.name));

  for (const { col, sql } of cols) {
    if (!existingNames.has(col)) {
      await db.execute(sql);
    }
  }
}

export async function down(db) {
  // SQLite can't drop columns without rebuilding the table. No-op.
}
