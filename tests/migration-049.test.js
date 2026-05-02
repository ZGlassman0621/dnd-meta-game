/**
 * Migration 049 — 'creating' phase + prelude_canon_heirlooms table.
 *
 * Phase 2 chunk 5.A. Pure-DDL test against an in-memory libsql client.
 * Verifies: clean apply, expected schema, idempotent re-apply, FK behavior,
 * status default, index presence.
 */

import { createClient } from '@libsql/client';
import { up, down } from '../server/migrations/049_creator_creating_phase_and_heirlooms.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function withFreshDb(fn) {
  const db = createClient({ url: ':memory:' });
  // Minimal `characters` table so the FK reference resolves.
  await db.execute(`
    CREATE TABLE characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
    )
  `);
  try {
    await fn(db);
  } finally {
    db.close();
  }
}

console.log('\n=== Migration 049: clean apply ===\n');
await withFreshDb(async (db) => {
  await up(db);
  const tables = await db.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='prelude_canon_heirlooms'`
  );
  assert(tables.rows.length === 1, 'prelude_canon_heirlooms table created');

  const cols = await db.execute(`PRAGMA table_info(prelude_canon_heirlooms)`);
  const colNames = new Set(cols.rows.map(r => r.name));
  for (const expected of [
    'id', 'character_id', 'name', 'type', 'specific_item_ref',
    'description', 'awakening_hook', 'acquired_at_age',
    'acquired_at_chapter', 'status', 'created_at'
  ]) {
    assert(colNames.has(expected), `column present: ${expected}`);
  }

  const idx = await db.execute(
    `SELECT name FROM sqlite_master WHERE type='index'
       AND name='idx_prelude_canon_heirlooms_char'`
  );
  assert(idx.rows.length === 1, 'index idx_prelude_canon_heirlooms_char created');
});

console.log('\n=== Migration 049: idempotent re-apply ===\n');
await withFreshDb(async (db) => {
  await up(db);
  let threw = false;
  try { await up(db); } catch (e) { threw = true; }
  assert(!threw, 'second up() does not throw (CREATE IF NOT EXISTS)');
});

console.log('\n=== Migration 049: status default + insert + FK cascade ===\n');
await withFreshDb(async (db) => {
  await up(db);
  // Need FKs on for ON DELETE CASCADE in libsql memory; enable per-connection.
  await db.execute(`PRAGMA foreign_keys = ON`);

  const charRes = await db.execute({
    sql: `INSERT INTO characters (name) VALUES (?)`,
    args: ['Test Character']
  });
  const charId = Number(charRes.lastInsertRowid);

  await db.execute({
    sql: `INSERT INTO prelude_canon_heirlooms (character_id, name, type, description)
          VALUES (?, ?, ?, ?)`,
    args: [charId, "Arven's Blade", 'weapon', 'Pressed into your hands by your dying mentor']
  });

  const row = await db.execute({
    sql: `SELECT status, name FROM prelude_canon_heirlooms WHERE character_id = ?`,
    args: [charId]
  });
  assert(row.rows.length === 1, 'inserted heirloom row');
  assert(row.rows[0].status === 'candidate', 'status defaults to "candidate"');
  assert(row.rows[0].name === "Arven's Blade", 'name persists');

  // FK cascade: delete the character, heirloom row should vanish
  await db.execute({ sql: `DELETE FROM characters WHERE id = ?`, args: [charId] });
  const afterDelete = await db.execute({
    sql: `SELECT id FROM prelude_canon_heirlooms WHERE character_id = ?`,
    args: [charId]
  });
  assert(afterDelete.rows.length === 0, 'FK ON DELETE CASCADE removes heirloom row');
});

console.log('\n=== Migration 049: down() rollback ===\n');
await withFreshDb(async (db) => {
  await up(db);
  await down(db);
  const tables = await db.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='prelude_canon_heirlooms'`
  );
  assert(tables.rows.length === 0, 'down() drops the table');
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
