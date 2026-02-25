#!/usr/bin/env node
/**
 * Migration script to copy all local SQLite data to Turso cloud database.
 * Uses @libsql/client for both source (local) and destination (cloud).
 * Run ONCE after setting up Turso credentials in .env.
 *
 * Usage: npm run migrate-to-cloud
 */

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const LOCAL_DB_PATH = join(__dirname, '..', '..', 'local.db');

async function migrate() {
  console.log('Starting migration to Turso cloud database...\n');

  // Check if local database exists
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    console.log('No local database found at:', LOCAL_DB_PATH);
    console.log('Nothing to migrate. The cloud database will start fresh when you run the server.');
    return;
  }

  // Check Turso credentials
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('Missing Turso credentials in .env file');
    console.error('Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
    process.exit(1);
  }

  // Connect to local SQLite
  const localDb = createClient({ url: `file:${LOCAL_DB_PATH}` });
  console.log('Connected to local database:', LOCAL_DB_PATH);

  // Connect to Turso cloud
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  console.log('Connected to Turso:', process.env.TURSO_DATABASE_URL);
  console.log('');

  // Step 1: Run migrations on cloud to create all tables
  console.log('Running migrations on cloud database...');
  const { runMigrations } = await import('../migrationRunner.js');
  await runMigrations(turso);
  console.log('Cloud schema ready.\n');

  // Step 2: Get all user tables from local DB
  const tablesResult = await localDb.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations' ORDER BY name"
  );
  const allTables = tablesResult.rows.map(r => r.name);

  // Order tables to respect foreign key dependencies
  // Parent tables first, then dependent tables
  const priorityOrder = [
    '_app_settings',
    'users',
    'campaigns',
    'characters',
    'npcs',
    'locations',
    'factions',
    'companions',
  ];

  const orderedTables = [
    ...priorityOrder.filter(t => allTables.includes(t)),
    ...allTables.filter(t => !priorityOrder.includes(t))
  ];

  let totalMigrated = 0;

  for (const table of orderedTables) {
    try {
      // Get row count
      const countResult = await localDb.execute(`SELECT COUNT(*) as cnt FROM "${table}"`);
      const rowCount = Number(countResult.rows[0].cnt);

      if (rowCount === 0) {
        console.log(`  Skipping ${table} (no data)`);
        continue;
      }

      console.log(`  Migrating ${table}: ${rowCount} row(s)...`);

      // Get all rows
      const rows = await localDb.execute(`SELECT * FROM "${table}"`);

      if (rows.rows.length === 0) continue;

      // Get column names
      const columns = rows.columns;

      // Insert each row using INSERT OR REPLACE
      let inserted = 0;
      for (const row of rows.rows) {
        const values = columns.map(col => row[col] ?? null);
        const placeholders = columns.map(() => '?').join(', ');
        const quotedCols = columns.map(c => `"${c}"`).join(', ');

        try {
          await turso.execute({
            sql: `INSERT OR REPLACE INTO "${table}" (${quotedCols}) VALUES (${placeholders})`,
            args: values
          });
          inserted++;
        } catch (err) {
          // Skip duplicate key errors silently, log others
          if (!err.message?.includes('UNIQUE constraint')) {
            console.error(`    Error in ${table}:`, err.message);
          }
        }
      }

      console.log(`    ${inserted}/${rowCount} rows migrated`);
      totalMigrated += inserted;

    } catch (error) {
      console.error(`  Error migrating ${table}:`, error.message);
    }
  }

  console.log('');
  console.log('='.repeat(45));
  console.log(`Migration complete! ${totalMigrated} total rows migrated.`);
  console.log('='.repeat(45));
  console.log('');
  console.log('Next steps:');
  console.log('1. Start your server: npm run dev');
  console.log('2. Your app now uses Turso cloud database');
  console.log('3. Register/login — your campaigns will be there');
  console.log('');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
