/**
 * Migration 004 — NPC Conversation Memory & Companion Emotional State
 *
 * New table: npc_conversations — stores summaries of player-NPC dialogue exchanges
 * New columns on companion_backstories: mood, mood_cause, mood_intensity, mood_set_game_day
 */

export async function up(db) {
  // ============================================================
  // NPC CONVERSATIONS
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS npc_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      npc_id INTEGER NOT NULL,
      session_id INTEGER NOT NULL,
      game_day INTEGER,
      summary TEXT NOT NULL,
      topics TEXT DEFAULT '[]',
      tone TEXT,
      key_quotes TEXT DEFAULT '[]',
      information_exchanged TEXT,
      importance TEXT DEFAULT 'minor',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (npc_id) REFERENCES npcs(id),
      FOREIGN KEY (session_id) REFERENCES dm_sessions(id)
    )
  `);

  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_npc_conv_character ON npc_conversations(character_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_npc_conv_npc ON npc_conversations(npc_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_npc_conv_session ON npc_conversations(session_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_npc_conv_char_npc ON npc_conversations(character_id, npc_id)');
  } catch (e) { /* indexes may already exist */ }

  // ============================================================
  // COMPANION MOOD COLUMNS
  // ============================================================

  const addColumn = async (table, col, sql) => {
    try {
      const columns = await db.execute(`PRAGMA table_info(${table})`);
      const exists = columns.rows.some(r => r[1] === col || r.name === col);
      if (!exists) {
        await db.execute(sql);
      }
    } catch (e) {
      // Column may already exist
    }
  };

  await addColumn('companion_backstories', 'mood', "ALTER TABLE companion_backstories ADD COLUMN mood TEXT DEFAULT 'content'");
  await addColumn('companion_backstories', 'mood_cause', 'ALTER TABLE companion_backstories ADD COLUMN mood_cause TEXT');
  await addColumn('companion_backstories', 'mood_intensity', 'ALTER TABLE companion_backstories ADD COLUMN mood_intensity INTEGER DEFAULT 1');
  await addColumn('companion_backstories', 'mood_set_game_day', 'ALTER TABLE companion_backstories ADD COLUMN mood_set_game_day INTEGER');
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS npc_conversations');
  // Note: SQLite doesn't support DROP COLUMN — mood columns will remain
}
