/**
 * Migration 079: Clock unification (Phase 0) — world_clock wins (Q0).
 *
 * Before: three clocks. characters.game_day (a Harptos DAY-OF-YEAR paired
 * with game_year) drove the live game; world_clock was a singleton with an
 * ABSOLUTE day counter that almost nothing advanced; dm_mode_parties has
 * its own current_game_day (separate mode — deliberately untouched here).
 *
 * After: world_clock is the single authoritative clock, one row per
 * campaign plus the legacy singleton row (campaign_id NULL) as fallback.
 * Each row carries BOTH scales, always in sync:
 *   current_day         — absolute day counter (monotonic; the scale
 *                         entity_schedule start/end days live on)
 *   current_day_of_year — Harptos day-of-year 1..365/366 (the scale
 *                         characters.game_day and all deadline columns use)
 *   current_year        — Harptos year (DR)
 *   current_hour        — 0..23 (24-hour clock, Zach 2026-10-17)
 *
 * Backfill (option A — pick up where the game left off): each campaign's
 * clock is seeded from its most advanced character (game_year major,
 * game_day minor). The absolute counter anchors at that character's
 * day-of-year value; from migration on, advanceDays() keeps the two
 * scales in lockstep, so the anchor choice never needs revisiting.
 * Pre-unification entity_schedule rows keep their old absolute values
 * (they resolve as due/past against the new clock — benign).
 *
 * Writes go through db.execute ONLY (the migration runner's transaction);
 * importing db helpers from database.js here deadlocks (078 incident).
 */
export async function up(db) {
  const cols = await db.execute(`PRAGMA table_info(world_clock)`);
  const names = cols.rows.map(r => r.name);
  if (names.includes('campaign_id')) return; // already unified

  await db.execute(`
    CREATE TABLE world_clock_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER UNIQUE,
      current_day INTEGER NOT NULL DEFAULT 1,
      current_day_of_year INTEGER NOT NULL DEFAULT 1,
      current_year INTEGER NOT NULL DEFAULT 1492,
      current_hour INTEGER NOT NULL DEFAULT 8,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Legacy singleton values (usually day 1 — the old clock barely moved).
  const old = await db.execute(`SELECT current_day FROM world_clock WHERE id = 1`);
  const oldDay = old.rows?.[0]?.current_day ?? 1;

  // Most advanced character overall -> singleton fallback row.
  const topOverall = await db.execute(`
    SELECT game_day, game_year FROM characters
    WHERE game_day IS NOT NULL
    ORDER BY (game_year IS NULL) ASC, game_year DESC, game_day DESC
    LIMIT 1
  `);
  const top = topOverall.rows?.[0];
  const singletonDay = top?.game_day ?? oldDay;
  const singletonYear = top?.game_year ?? 1492;
  await db.execute({ sql: `INSERT INTO world_clock_new (campaign_id, current_day, current_day_of_year, current_year, current_hour)
     VALUES (NULL, ?, ?, ?, 8)`, args: [singletonDay, Math.min(singletonDay, 366), singletonYear] });

  // Per-campaign rows, seeded from each campaign's most advanced character.
  const campaigns = await db.execute(`SELECT id FROM campaigns`);
  for (const c of campaigns.rows || []) {
    const best = await db.execute({ sql: `
      SELECT game_day, game_year FROM characters
      WHERE campaign_id = ? AND game_day IS NOT NULL
      ORDER BY (game_year IS NULL) ASC, game_year DESC, game_day DESC
      LIMIT 1
    `, args: [c.id] });
    const b = best.rows?.[0];
    if (!b) continue; // campaign with no dated characters gets a row lazily
    await db.execute({ sql: `INSERT OR IGNORE INTO world_clock_new (campaign_id, current_day, current_day_of_year, current_year, current_hour)
       VALUES (?, ?, ?, ?, 8)`, args: [c.id, b.game_day, Math.min(b.game_day, 366), b.game_year ?? 1492] });
  }

  await db.execute(`DROP TABLE world_clock`);
  await db.execute(`ALTER TABLE world_clock_new RENAME TO world_clock`);
}

export async function down(db) {
  // Collapse back to the singleton shape, preserving the fallback row.
  const cols = await db.execute(`PRAGMA table_info(world_clock)`);
  if (!cols.rows.map(r => r.name).includes('campaign_id')) return;
  const keep = await db.execute(
    `SELECT current_day FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1`
  );
  const day = keep.rows?.[0]?.current_day ?? 1;
  await db.execute(`DROP TABLE world_clock`);
  await db.execute(`
    CREATE TABLE world_clock (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_day INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute({ sql: `INSERT INTO world_clock (id, current_day) VALUES (1, ?)`, args: [day] });
}

