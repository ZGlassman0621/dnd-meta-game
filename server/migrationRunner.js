/**
 * Database Migration Runner
 *
 * Scans server/migrations/ for numbered .js files and applies any that
 * haven't been run yet. Each migration exports an up(db) function.
 * Applied migrations are tracked in the _migrations table.
 *
 * Rollback support: migrations that export a down(db) function can be
 * rolled back via rollbackMigration() or rollbackTo().
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Apply any migrations not yet recorded in _migrations.
 *
 * @param {object} db - libSQL client
 * @param {object} [options]
 * @param {string} [options.migrationsDir] - Override the directory scanned.
 *   Exists so the atomicity behaviour can be tested against fixture
 *   migrations without touching the real schema.
 */
export async function runMigrations(db, options = {}) {
  // Ensure _migrations table exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get already-applied migration names
  const applied = await db.execute('SELECT name FROM _migrations ORDER BY id');
  const appliedNames = new Set(applied.rows.map(r => r.name));

  // Scan the migrations directory for .js files
  const migrationsDir = options.migrationsDir || path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found. Skipping.');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => /^\d{3}_.*\.js$/.test(f))
    .sort();

  let appliedCount = 0;

  for (const file of files) {
    const name = file.replace('.js', '');

    if (appliedNames.has(name)) continue;

    console.log(`Applying migration: ${name}...`);

    const migrationPath = path.join(migrationsDir, file);
    const migration = await import(`file://${migrationPath.replace(/\\/g, '/')}`);

    // Apply the migration and record it as ONE atomic unit.
    //
    // Previously these were two independent statements, so a migration that
    // half-applied and threw was never recorded — the next boot re-ran it and
    // typically died on "duplicate column", with no way forward but manual
    // surgery on _migrations. Now a failure rolls the schema change back too,
    // which makes every migration safe to retry simply by restarting.
    //
    // `tx` is handed to up() instead of `db` — writing through the outer client
    // would escape the transaction and silently defeat the whole point.
    // Migrations only ever call .execute(), which Transaction also provides.
    const tx = await db.transaction('write');
    try {
      await migration.up(tx);
      await tx.execute({
        sql: 'INSERT INTO _migrations (name) VALUES (?)',
        args: [name]
      });
      await tx.commit();
    } catch (err) {
      // rollback() can itself throw if the transaction is already dead; that
      // must not mask the real migration error.
      try {
        await tx.rollback();
      } catch {
        // already rolled back or closed — nothing to salvage
      }
      throw new Error(
        `Migration ${name} failed and was rolled back — the database is unchanged ` +
        `and this migration will be retried on next boot. Cause: ${err?.message || err}`,
        { cause: err }
      );
    }

    appliedCount++;
    console.log(`  Applied: ${name}`);
  }

  if (appliedCount === 0) {
    // Silent when everything is up to date
  } else {
    console.log(`Applied ${appliedCount} migration(s).`);
  }
}

/**
 * Roll back the last N applied migrations
 * Each migration must export a down(db) function.
 *
 * @param {object} db - Database client
 * @param {number} count - Number of migrations to roll back (default 1)
 * @returns {number} Number of migrations rolled back
 */
export async function rollbackMigration(db, count = 1) {
  const applied = await db.execute(
    'SELECT name FROM _migrations ORDER BY id DESC LIMIT ?',
    [count]
  );

  if (applied.rows.length === 0) {
    console.log('No migrations to roll back.');
    return 0;
  }

  const migrationsDir = path.join(__dirname, 'migrations');
  let rolledBack = 0;

  for (const row of applied.rows) {
    const file = `${row.name}.js`;
    const migrationPath = path.join(migrationsDir, file);

    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${file}. Skipping.`);
      continue;
    }

    console.log(`Rolling back: ${row.name}...`);
    const migration = await import(`file://${migrationPath.replace(/\\/g, '/')}`);

    if (typeof migration.down !== 'function') {
      throw new Error(`Migration ${row.name} does not export a down() function — cannot roll back.`);
    }

    await migration.down(db);
    await db.execute({ sql: 'DELETE FROM _migrations WHERE name = ?', args: [row.name] });

    rolledBack++;
    console.log(`  Rolled back: ${row.name}`);
  }

  console.log(`Rolled back ${rolledBack} migration(s).`);
  return rolledBack;
}

/**
 * Roll back all migrations applied after the named migration.
 * The target migration itself is NOT rolled back.
 *
 * @param {object} db - Database client
 * @param {string} targetName - Migration name to roll back TO (exclusive)
 * @returns {number} Number of migrations rolled back
 */
export async function rollbackTo(db, targetName) {
  const target = await db.execute(
    'SELECT id FROM _migrations WHERE name = ?',
    [targetName]
  );

  if (target.rows.length === 0) {
    throw new Error(`Target migration "${targetName}" not found in applied migrations.`);
  }

  const toRollback = await db.execute(
    'SELECT name FROM _migrations WHERE id > ? ORDER BY id DESC',
    [target.rows[0].id]
  );

  if (toRollback.rows.length === 0) {
    console.log(`No migrations to roll back after "${targetName}".`);
    return 0;
  }

  const migrationsDir = path.join(__dirname, 'migrations');
  let rolledBack = 0;

  for (const row of toRollback.rows) {
    const file = `${row.name}.js`;
    const migrationPath = path.join(migrationsDir, file);

    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${file}. Skipping.`);
      continue;
    }

    console.log(`Rolling back: ${row.name}...`);
    const migration = await import(`file://${migrationPath.replace(/\\/g, '/')}`);

    if (typeof migration.down !== 'function') {
      throw new Error(`Migration ${row.name} does not export a down() function — cannot roll back.`);
    }

    await migration.down(db);
    await db.execute({ sql: 'DELETE FROM _migrations WHERE name = ?', args: [row.name] });

    rolledBack++;
    console.log(`  Rolled back: ${row.name}`);
  }

  console.log(`Rolled back ${rolledBack} migration(s) (to "${targetName}").`);
  return rolledBack;
}
