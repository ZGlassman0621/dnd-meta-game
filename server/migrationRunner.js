/**
 * Database Migration Runner
 *
 * Scans server/migrations/ for numbered .js files and applies any that
 * haven't been run yet. Each migration exports an up(db) function.
 * Applied migrations are tracked in the _migrations table.
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
