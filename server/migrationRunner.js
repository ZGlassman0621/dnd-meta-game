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

export async function runMigrations(db) {
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
  const migrationsDir = path.join(__dirname, 'migrations');

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

    await migration.up(db);

    await db.execute({
      sql: 'INSERT INTO _migrations (name) VALUES (?)',
      args: [name]
    });

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
