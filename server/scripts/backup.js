/**
 * Database Backup Script
 * Creates a timestamped copy of local.db in the backups/ directory.
 * Run: node server/scripts/backup.js  (or: npm run backup)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'local.db');
const BACKUPS_DIR = path.join(__dirname, '..', '..', 'backups');

if (!fs.existsSync(DB_PATH)) {
  console.error('No local.db found — nothing to back up.');
  process.exit(1);
}

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupName = `local-${timestamp}.db`;
const backupPath = path.join(BACKUPS_DIR, backupName);

fs.copyFileSync(DB_PATH, backupPath);
const sizeMB = (fs.statSync(backupPath).size / (1024 * 1024)).toFixed(2);
console.log(`Backup created: backups/${backupName} (${sizeMB} MB)`);
