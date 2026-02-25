/**
 * Migration 013: User Accounts
 *
 * Adds users table for authentication and user_id column to campaigns
 * for ownership scoping. Also adds _app_settings table for auto-generated
 * JWT secret storage.
 */

export async function up(db) {
  // Users table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // App-level settings (JWT secret, etc.)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Add user_id to campaigns
  try {
    await db.execute('ALTER TABLE campaigns ADD COLUMN user_id INTEGER REFERENCES users(id)');
  } catch (e) {
    if (!e.message?.includes('duplicate column')) throw e;
  }

  await db.execute('CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id)');
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_campaigns_user');
  await db.execute('DROP TABLE IF EXISTS _app_settings');
  await db.execute('DROP TABLE IF EXISTS users');
}
