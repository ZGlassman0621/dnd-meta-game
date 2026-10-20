/**
 * diag-fk.mjs — one-off diagnostic (safe to delete after use).
 *
 * Finds which tables hold rows that reference TEST_ characters / companions /
 * npcs / campaigns — i.e. exactly what blocks the LIKE 'TEST_%' cleanup
 * deletes in companion-activities.test.js and session-end.test.js with
 * SQLITE_CONSTRAINT_FOREIGNKEY.
 *
 *   node diag-fk.mjs
 */
import { initDatabase, dbAll } from './server/database.js';

await initDatabase();

const REF_ID_SETS = {
  characters: `SELECT id FROM characters WHERE name LIKE 'TEST_%'`,
  companions: `SELECT id FROM companions WHERE id IN (SELECT id FROM companions WHERE recruited_by_character_id IN (SELECT id FROM characters WHERE name LIKE 'TEST_%'))`,
  npcs: `SELECT id FROM npcs WHERE name LIKE 'TEST_%'`,
  campaigns: `SELECT id FROM campaigns WHERE name LIKE 'TEST_%'`,
};

const tables = await dbAll(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`);
let found = 0;
for (const { name } of tables) {
  const fks = await dbAll(`PRAGMA foreign_key_list(${name})`);
  for (const fk of fks) {
    const ref = fk.table;
    if (!REF_ID_SETS[ref]) continue;
    const col = fk.from;
    const rows = await dbAll(
      `SELECT COUNT(*) AS n FROM ${name} WHERE ${col} IN (${REF_ID_SETS[ref]})`
    );
    const n = rows[0]?.n || 0;
    if (n > 0) {
      found++;
      console.log(`BLOCKER: ${name}.${col} -> ${ref}.id : ${n} row(s) referencing TEST_ ${ref} (on_delete=${fk.on_delete})`);
    }
  }
}
if (!found) console.log('No FK blockers found for TEST_ rows.');
process.exit(0);
