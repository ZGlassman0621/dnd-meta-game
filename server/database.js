import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { runMigrations } from './migrationRunner.js';
import { seedProgressionData } from './services/progressionSeedService.js';

dotenv.config();

// Create database client — Turso cloud if configured, local SQLite file otherwise
const db = createClient(
  process.env.TURSO_DATABASE_URL
    ? { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }
    : { url: 'file:local.db' }
);

export async function initDatabase() {
  await runMigrations(db);
  await seedProgressionData(db);

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

/**
 * Run a set of writes atomically inside a libsql write-transaction.
 *
 * The callback receives a small `tx` api whose get/all/run mirror the module's
 * dbGet/dbAll/dbRun signatures `(sql, params)` and return shapes, so migrating
 * an existing sequence of dbGet/dbRun calls is a mechanical swap. Throwing from
 * the callback (or any failing statement) rolls the whole transaction back;
 * returning resolves after commit.
 *
 * Because a 'write' transaction takes the write lock at BEGIN, wrapping a
 * read-modify-write sequence here also serializes concurrent writers — closing
 * the last-write-wins races on JSON TEXT columns (spell slots, conditions,
 * inventory) in addition to making multi-row writes all-or-nothing.
 *
 * @template T
 * @param {(tx: { get: Function, all: Function, run: Function, raw: object }) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const tx = await db.transaction('write');
  try {
    const api = {
      raw: tx,
      get: async (sql, params = []) => {
        const r = await tx.execute({ sql, args: params });
        return r.rows[0] || null;
      },
      all: async (sql, params = []) => {
        const r = await tx.execute({ sql, args: params });
        return r.rows;
      },
      run: async (sql, params = []) => {
        const r = await tx.execute({ sql, args: params });
        return { lastInsertRowid: r.lastInsertRowid, changes: r.rowsAffected };
      }
    };
    const result = await fn(api);
    await tx.commit();
    return result;
  } catch (err) {
    try { await tx.rollback(); } catch { /* transaction already closed */ }
    throw err;
  }
}

export default db;
