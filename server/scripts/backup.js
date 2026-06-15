/**
 * Database Backup CLI.
 * Run: node server/scripts/backup.js   (or: npm run backup)
 *
 * Cloud (TURSO_DATABASE_URL set) → portable, restorable .sql dump in backups/.
 * Local (file:local.db)          → byte-faithful .db copy in backups/.
 *
 * The real logic lives in server/services/backupService.js so the server's
 * in-process scheduler can share it. Restore instructions are in the dump header.
 */

import { runBackup } from '../services/backupService.js';

runBackup()
  .then(p => process.exit(p ? 0 : 1))
  .catch(e => {
    console.error('Backup failed:', e.message);
    process.exit(1);
  });
