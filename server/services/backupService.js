/**
 * Backup service — produces a restorable backup of the campaign database.
 *
 * Two modes, chosen by the same env config the app uses:
 *   - Turso cloud (TURSO_DATABASE_URL set) → a portable, restorable .sql dump
 *     (CREATE TABLE + INSERT + indexes/triggers/views) written to backups/.
 *   - Local SQLite (file:local.db)         → a byte-faithful file copy to backups/.
 *
 * The cloud path deliberately uses only @libsql/client (already a dependency) and
 * the plain HTTP query path the whole app runs on — no Turso CLI, no embedded-replica
 * native bindings — so a backup works on any machine that can run the app. That fits
 * the project's "runs in the bunker, no dependency that can disappear" framing.
 *
 * Restore a .sql dump with:  sqlite3 restored.db < backups/turso-<stamp>.sql
 *                      or:    turso db shell <name> < backups/turso-<stamp>.sql
 *
 * Consumers: server/scripts/backup.js (CLI / `npm run backup`) and the in-process
 * scheduler started from server/index.js (startBackupScheduler).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

// Load env the same way the server does. Idempotent — dotenv won't override vars
// the caller already set, so importing this after index.js's dotenv.config() is safe.
dotenv.config({ path: path.join(ROOT, '.env') });

const BACKUPS_DIR = path.join(ROOT, 'backups');
const LOCAL_DB_PATH = path.join(ROOT, 'local.db');
const DEFAULT_RETAIN = Number(process.env.BACKUP_RETAIN) || 30;

function isoStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

/**
 * Serialize a single value to a SQLite SQL literal. Exported for unit testing.
 */
export function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    let hex = '';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return `X'${hex}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

// Awaitable write that respects backpressure, so a multi-MB dump streams to disk
// instead of buffering the whole thing in memory.
function makeWriter(stream) {
  return (chunk) => (stream.write(chunk) ? Promise.resolve() : new Promise(res => stream.once('drain', res)));
}

/**
 * Write a portable, restorable SQL dump of every user table in `db` to `outPath`.
 * @returns {Promise<{ tableCount: number, rowCount: number }>}
 */
export async function dumpToSql(db, outPath) {
  const out = fs.createWriteStream(outPath, { encoding: 'utf8' });
  const w = makeWriter(out);

  await w(`-- D&D Meta Game database backup\n`);
  await w(`-- Created: ${new Date().toISOString()}\n`);
  await w(`-- Restore: sqlite3 restored.db < ${path.basename(outPath)}  (or: turso db shell <name> < ${path.basename(outPath)})\n`);
  await w(`PRAGMA foreign_keys=OFF;\n`);
  await w(`BEGIN TRANSACTION;\n`);

  const tables = await db.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );

  let tableCount = 0;
  let rowCount = 0;
  for (const t of tables.rows) {
    const tableName = t.name;
    if (t.sql) await w(`${t.sql};\n`);
    const res = await db.execute(`SELECT * FROM ${quoteIdent(tableName)}`);
    const cols = res.columns;
    if (res.rows.length > 0) {
      const colList = cols.map(quoteIdent).join(', ');
      for (const row of res.rows) {
        const vals = cols.map(c => sqlLiteral(row[c])).join(', ');
        await w(`INSERT INTO ${quoteIdent(tableName)} (${colList}) VALUES (${vals});\n`);
        rowCount++;
      }
    }
    tableCount++;
  }

  // Indexes, triggers, views (skip auto-created objects whose sql is NULL).
  const others = await db.execute(
    "SELECT sql FROM sqlite_master WHERE type IN ('index','trigger','view') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type, name"
  );
  for (const o of others.rows) {
    if (o.sql) await w(`${o.sql};\n`);
  }

  await w(`COMMIT;\n`);
  await w(`PRAGMA foreign_keys=ON;\n`);
  await new Promise((resolve, reject) => out.end(err => (err ? reject(err) : resolve())));
  return { tableCount, rowCount };
}

// Keep only the newest `retain` backups for a given filename prefix. ISO timestamps
// in the filenames sort chronologically, so a lexical sort is a chronological sort.
function pruneOld(prefix, retain) {
  try {
    const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith(prefix)).sort();
    const excess = files.length - retain;
    for (let i = 0; i < excess; i++) {
      fs.unlinkSync(path.join(BACKUPS_DIR, files[i]));
    }
    if (excess > 0) console.log(`[backup] Pruned ${excess} old backup(s) (retain=${retain}).`);
  } catch (e) {
    console.warn('[backup] prune skipped:', e.message);
  }
}

/**
 * Run one backup. Returns the backup file path, or null if there was nothing to
 * back up (local mode with no local.db and no Turso configured).
 */
export async function runBackup({ retain = DEFAULT_RETAIN } = {}) {
  ensureBackupsDir();
  const stamp = isoStamp();

  if (process.env.TURSO_DATABASE_URL) {
    const db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });
    const outPath = path.join(BACKUPS_DIR, `turso-${stamp}.sql`);
    try {
      const { tableCount, rowCount } = await dumpToSql(db, outPath);
      const sizeMB = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);
      console.log(`[backup] Cloud backup created: backups/turso-${stamp}.sql (${tableCount} tables, ${rowCount} rows, ${sizeMB} MB)`);
    } finally {
      if (typeof db.close === 'function') db.close();
    }
    pruneOld('turso-', retain);
    return outPath;
  }

  // Local SQLite file → exact byte-faithful copy.
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    console.error('[backup] No local.db found and TURSO_DATABASE_URL not set — nothing to back up.');
    return null;
  }
  const outPath = path.join(BACKUPS_DIR, `local-${stamp}.db`);
  fs.copyFileSync(LOCAL_DB_PATH, outPath);
  const sizeMB = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);
  console.log(`[backup] Local backup created: backups/local-${stamp}.db (${sizeMB} MB)`);
  pruneOld('local-', retain);
  return outPath;
}

/**
 * Start the in-process backup scheduler. Safe to call once at boot; it never throws
 * into the caller and a backup failure can never crash the server. Controls (env):
 *   BACKUP_DISABLE=1          → off entirely
 *   BACKUP_INTERVAL_HOURS=24  → cadence (default 24h)
 *   BACKUP_FIRST_DELAY_MS     → delay before the first run (default 30s, so it
 *                               doesn't compete with boot)
 *   BACKUP_RETAIN=30          → how many backups to keep
 * The timers are unref'd, so they never keep the process alive on their own.
 */
export function startBackupScheduler() {
  if (process.env.BACKUP_DISABLE === '1') {
    console.log('[backup] Scheduler disabled (BACKUP_DISABLE=1).');
    return;
  }
  const hours = Number(process.env.BACKUP_INTERVAL_HOURS) || 24;
  const firstDelay = Number(process.env.BACKUP_FIRST_DELAY_MS) || 30_000;
  const safe = () => runBackup().catch(e => console.error('[backup] scheduled backup failed:', e.message));

  const first = setTimeout(safe, firstDelay);
  if (typeof first.unref === 'function') first.unref();
  const interval = setInterval(safe, hours * 60 * 60 * 1000);
  if (typeof interval.unref === 'function') interval.unref();

  console.log(`[backup] Scheduler armed: first run in ${Math.round(firstDelay / 1000)}s, then every ${hours}h (retain ${DEFAULT_RETAIN}).`);
}
