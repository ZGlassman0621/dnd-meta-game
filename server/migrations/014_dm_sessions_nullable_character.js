/**
 * Migration 014: Make dm_sessions.character_id nullable
 *
 * DM Mode sessions don't have a character (they use dm_mode_party_id instead),
 * but the original schema defined character_id as NOT NULL.
 * SQLite doesn't support ALTER COLUMN, so we recreate the table.
 */

export async function up(db) {
  // 1. Create new table with nullable character_id
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dm_sessions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER,
      title TEXT,
      setting TEXT,
      tone TEXT,
      model TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      messages TEXT DEFAULT '[]',
      summary TEXT,
      rewards TEXT,
      rewards_claimed INTEGER DEFAULT 0,
      hp_change INTEGER DEFAULT 0,
      new_location TEXT,
      new_quest TEXT,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      second_character_id INTEGER,
      session_config TEXT,
      recap TEXT,
      game_start_day INTEGER,
      game_start_year INTEGER,
      game_end_day INTEGER,
      game_end_year INTEGER,
      session_type TEXT DEFAULT 'player',
      dm_mode_party_id INTEGER,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  // 2. Copy all data from old table
  await db.execute(`
    INSERT INTO dm_sessions_new (
      id, character_id, title, setting, tone, model, status, messages, summary,
      rewards, rewards_claimed, hp_change, new_location, new_quest,
      start_time, end_time, created_at,
      second_character_id, session_config, recap,
      game_start_day, game_start_year, game_end_day, game_end_year,
      session_type, dm_mode_party_id
    )
    SELECT
      id, character_id, title, setting, tone, model, status, messages, summary,
      rewards, rewards_claimed, hp_change, new_location, new_quest,
      start_time, end_time, created_at,
      second_character_id, session_config, recap,
      game_start_day, game_start_year, game_end_day, game_end_year,
      session_type, dm_mode_party_id
    FROM dm_sessions
  `);

  // 3. Drop old table
  await db.execute('DROP TABLE dm_sessions');

  // 4. Rename new table
  await db.execute('ALTER TABLE dm_sessions_new RENAME TO dm_sessions');

  // 5. Recreate indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dm_sessions_character ON dm_sessions(character_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dm_sessions_party ON dm_sessions(dm_mode_party_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dm_sessions_status ON dm_sessions(status)');
}

export async function down(db) {
  // Reverse: recreate with NOT NULL (would fail if any NULL character_id rows exist)
  console.warn('Rolling back 014: any DM mode sessions with NULL character_id will be lost');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dm_sessions_old (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      title TEXT,
      setting TEXT,
      tone TEXT,
      model TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      messages TEXT DEFAULT '[]',
      summary TEXT,
      rewards TEXT,
      rewards_claimed INTEGER DEFAULT 0,
      hp_change INTEGER DEFAULT 0,
      new_location TEXT,
      new_quest TEXT,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      second_character_id INTEGER,
      session_config TEXT,
      recap TEXT,
      game_start_day INTEGER,
      game_start_year INTEGER,
      game_end_day INTEGER,
      game_end_year INTEGER,
      session_type TEXT DEFAULT 'player',
      dm_mode_party_id INTEGER,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  await db.execute(`
    INSERT INTO dm_sessions_old
    SELECT * FROM dm_sessions WHERE character_id IS NOT NULL
  `);

  await db.execute('DROP TABLE dm_sessions');
  await db.execute('ALTER TABLE dm_sessions_old RENAME TO dm_sessions');
}
