import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { runMigrations } from './migrationRunner.js';

dotenv.config();

// Create database client — Turso cloud if configured, local SQLite file otherwise
const db = createClient(
  process.env.TURSO_DATABASE_URL
    ? { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }
    : { url: 'file:local.db' }
);

export async function initDatabase() {
  await runMigrations(db);

  const mode = process.env.TURSO_DATABASE_URL ? 'Turso cloud' : 'local SQLite';
  console.log(`Database initialized successfully (${mode})`);
}

export async function dbAll(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows;
}

export async function dbGet(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows[0] || null;
}

export async function dbRun(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return { lastInsertRowid: result.lastInsertRowid, changes: result.rowsAffected };
}

export default db;
