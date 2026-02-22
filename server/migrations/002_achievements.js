/**
 * Migration 002: Achievement System
 *
 * Creates tables for tracking achievement definitions and per-character progress.
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'story',
      icon TEXT,
      hidden INTEGER DEFAULT 0,
      rewards TEXT DEFAULT '{}',
      criteria TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      achievement_key TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      earned_at DATETIME,
      notified INTEGER DEFAULT 0,
      reward_claimed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id),
      UNIQUE(character_id, achievement_key)
    )
  `);

  await db.execute('CREATE INDEX IF NOT EXISTS idx_char_achievements_char ON character_achievements(character_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_char_achievements_key ON character_achievements(achievement_key)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_char_achievements_notified ON character_achievements(character_id, notified)');
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS character_achievements');
  await db.execute('DROP TABLE IF EXISTS achievements');
}
