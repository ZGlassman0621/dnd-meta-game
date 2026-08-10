/**
 * Database Backup
 *
 * Run: npm run backup   (or: node server/scripts/backup.js)
 *
 * Replaces the previous `fs.copyFileSync` of local.db, which had three
 * problems: it copied a file that may be mid-write (no WAL checkpoint, so the
 * copy could be torn), it kept every copy forever, and it never checked that
 * the result was readable. It also backed up the wrong database entirely when
 * TURSO_DATABASE_URL is set — which is the normal configuration here.
 *
 * Two paths, chosen by config:
 *
 *  - Turso configured → pull the remote database down into a local file using
 *    an embedded replica sync. VACUUM INTO cannot be used here: it executes on
 *    the Turso server and writes to the server's filesystem, so it produces
 *    nothing on this machine.
 *
 *  - Local file → `VACUUM INTO`, which SQLite guarantees is a consistent
 *    snapshot of a live database, unlike a file copy.
 *
 * Every backup is verified by reopening it and reading its schema before older
 * backups are pruned, so a failed backup can never evict a good one.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const BACKUPS_DIR = path.join(ROOT, 'backups');
const LOCAL_DB = path.join(ROOT, 'local.db');

/** How many backups to keep. Older ones are pruned newest-first. */
const RETAIN = Number(process.env.BACKUP_RETAIN || 10);

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Reopen a backup and confirm it parses and has content.
 * @returns {Promise<{ ok: boolean, tables?: number, error?: string }>}
 */
async function verifyBackup(file) {
  let client;
  try {
    client = createClient({ url: `file:${file}` });
    const r = await client.execute(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'"
    );
    const tables = Number(r.rows[0]?.n || 0);
    if (tables === 0) return { ok: false, error: 'backup contains no tables' };
    // Touch a table that must exist in any real database of this app.
    await client.execute('SELECT COUNT(*) FROM _migrations');
    return { ok: true, tables };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    client?.close?.();
  }
}

/**
 * Delete all but the newest `RETAIN` backups. Only runs after a verified
 * success, so a broken run never prunes a good backup.
 */
function prune() {
  const files = fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ f, mtime: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const stale = files.slice(RETAIN);
  for (const { f } of stale) {
    fs.rmSync(path.join(BACKUPS_DIR, f), { force: true });
    // Embedded replica sync leaves sidecar files alongside the database.
    for (const suffix of ['-wal', '-shm', '-client_wal_index', '-info']) {
      fs.rmSync(path.join(BACKUPS_DIR, f + suffix), { force: true });
    }
    console.log(`  pruned old backup: ${f}`);
  }
  return stale.length;
}

async function backupTurso(target) {
  console.log('Backing up Turso cloud database via embedded replica sync…');
  const client = createClient({
    url: `file:${target}`,
    syncUrl: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  try {
    await client.sync();
  } finally {
    client.close?.();
  }
}

async function backupLocal(target) {
  console.log('Backing up local SQLite database via VACUUM INTO…');
  if (!fs.existsSync(LOCAL_DB)) {
    throw new Error(`No local.db found at ${LOCAL_DB} — nothing to back up.`);
  }
  const client = createClient({ url: `file:${LOCAL_DB}` });
  try {
    // VACUUM INTO refuses to overwrite, which is what we want — the timestamped
    // name should always be fresh.
    await client.execute({ sql: `VACUUM INTO '${target.replace(/'/g, "''")}'`, args: [] });
  } finally {
    client.close?.();
  }
}

async function main() {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  const isTurso = Boolean(process.env.TURSO_DATABASE_URL);
  const name = `${isTurso ? 'turso' : 'local'}-${timestamp()}.db`;
  const target = path.join(BACKUPS_DIR, name);

  try {
    if (isTurso) {
      await backupTurso(target);
    } else {
      await backupLocal(target);
    }
  } catch (e) {
    console.error(`Backup FAILED: ${e.message}`);
    fs.rmSync(target, { force: true });
    process.exit(1);
  }

  const verified = await verifyBackup(target);
  if (!verified.ok) {
    console.error(`Backup verification FAILED: ${verified.error}`);
    console.error('The unusable backup has been removed; older backups are untouched.');
    fs.rmSync(target, { force: true });
    process.exit(1);
  }

  const sizeMB = (fs.statSync(target).size / (1024 * 1024)).toFixed(2);
  console.log(`Backup created: backups/${name} (${sizeMB} MB, ${verified.tables} tables, verified)`);

  const pruned = prune();
  if (pruned > 0) console.log(`Retention: kept ${RETAIN}, pruned ${pruned}.`);
}

// Only run when invoked directly, so the functions can be imported by tests.
// pathToFileURL rather than string interpolation: import.meta.url percent-encodes
// the path, so a repo directory containing a space ("DnD Meta Game") would never
// match a raw argv[1] and the script would exit silently having done nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export { verifyBackup, prune, main };
