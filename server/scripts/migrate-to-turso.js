#!/usr/bin/env node
/**
 * Migration script to export local SQLite data to Turso cloud database
 * Run this ONCE after setting up Turso credentials in .env
 *
 * Usage: node server/scripts/migrate-to-turso.js
 */

import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const LOCAL_DB_PATH = join(__dirname, '..', 'data', 'game.db');

async function migrate() {
  console.log('🚀 Starting migration to Turso cloud database...\n');

  // Check if local database exists
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    console.log('⚠️  No local database found at:', LOCAL_DB_PATH);
    console.log('   Nothing to migrate. The cloud database will start fresh.');
    return;
  }

  // Check Turso credentials
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('❌ Missing Turso credentials in .env file');
    console.error('   Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
    process.exit(1);
  }

  // Connect to local SQLite
  const localDb = new Database(LOCAL_DB_PATH, { readonly: true });
  console.log('📂 Connected to local database:', LOCAL_DB_PATH);

  // Connect to Turso
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  console.log('☁️  Connected to Turso:', process.env.TURSO_DATABASE_URL);
  console.log('');

  // Tables to migrate in order (respecting foreign key dependencies)
  const tables = [
    'characters',
    'npcs',
    'adventures',
    'adventure_options',
    'dm_sessions',
    'downtime',
    'companions'
  ];

  let totalMigrated = 0;

  for (const table of tables) {
    try {
      // Check if table exists in local db
      const tableExists = localDb.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      ).get(table);

      if (!tableExists) {
        console.log(`⏭️  Skipping ${table} (table doesn't exist locally)`);
        continue;
      }

      // Get all rows from local table
      const rows = localDb.prepare(`SELECT * FROM ${table}`).all();

      if (rows.length === 0) {
        console.log(`⏭️  Skipping ${table} (no data)`);
        continue;
      }

      console.log(`📤 Migrating ${table}: ${rows.length} row(s)...`);

      // Get column names from first row
      const columns = Object.keys(rows[0]);

      // Build INSERT statement
      const placeholders = columns.map(() => '?').join(', ');
      const insertSql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

      // Insert each row
      let inserted = 0;
      for (const row of rows) {
        const values = columns.map(col => row[col]);
        try {
          await turso.execute({ sql: insertSql, args: values });
          inserted++;
        } catch (err) {
          console.error(`   ⚠️  Error inserting row in ${table}:`, err.message);
        }
      }

      console.log(`   ✅ Migrated ${inserted}/${rows.length} rows`);
      totalMigrated += inserted;

    } catch (error) {
      console.error(`❌ Error migrating ${table}:`, error.message);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`✨ Migration complete! ${totalMigrated} total rows migrated.`);
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('Next steps:');
  console.log('1. Start your server: npm run dev');
  console.log('2. Your app now uses Turso cloud database');
  console.log('3. Data syncs automatically across all devices');
  console.log('');
  console.log('💡 Tip: Keep the local database file as a backup,');
  console.log('   or delete server/data/game.db if no longer needed.');

  localDb.close();
}

migrate().catch(console.error);
