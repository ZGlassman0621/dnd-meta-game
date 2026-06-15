/**
 * Tests for the cloud-backup SQL dumper (server/services/backupService.js).
 * Run: node tests/backup-dump.test.js
 *
 * The cloud path was previously a no-op (the old script only copied a local file),
 * so a Turso save had NO backup. These tests pin the new dumper by (1) unit-testing
 * the value serializer and (2) doing a full dump -> restore round-trip through two
 * independent in-memory libsql databases and asserting the data survives intact —
 * including the tricky cases (single quotes, NULLs, unicode, embedded newlines,
 * negative integers, BLOBs) and that indexes are recreated.
 *
 * No Turso/network needed — uses ':memory:' clients.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@libsql/client';
import { dumpToSql, sqlLiteral } from '../server/services/backupService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}
function assertEqual(actual, expected, message) {
  if (actual === expected) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); failed++; }
}

function testSerializer() {
  console.log('=== Test 1: sqlLiteral serializer ===\n');
  assertEqual(sqlLiteral(null), 'NULL', 'null -> NULL');
  assertEqual(sqlLiteral(undefined), 'NULL', 'undefined -> NULL');
  assertEqual(sqlLiteral(42), '42', 'integer -> bare number');
  assertEqual(sqlLiteral(-5), '-5', 'negative integer');
  assertEqual(sqlLiteral(3.5), '3.5', 'real');
  assertEqual(sqlLiteral('plain'), "'plain'", 'plain string is quoted');
  assertEqual(sqlLiteral("O'Brien"), "'O''Brien'", "single quote is doubled");
  assertEqual(sqlLiteral(10n), '10', 'bigint -> number');
  assertEqual(sqlLiteral(new Uint8Array([0xde, 0xad, 0xbe, 0xef])), "X'deadbeef'", 'blob -> X\'hex\'');
}

async function testRoundTrip() {
  console.log('\n=== Test 2: dump -> restore round-trip ===\n');

  const src = createClient({ url: ':memory:' });
  await src.execute(`CREATE TABLE canon_facts (
    id INTEGER PRIMARY KEY,
    subject TEXT NOT NULL,
    fact TEXT,
    category TEXT,
    importance TEXT,
    game_day INTEGER
  )`);
  await src.execute(`CREATE INDEX idx_canon_subject ON canon_facts(subject)`);

  const seed = [
    [1, 'Gareth', "He's dead; do not resurrect.", 'death', 'critical', 12],
    [2, "Maël O'Brien", null, 'npc', 'flavor', null],
    [3, 'Æthel — the dragon', 'líne\nbreak survives', 'lore', 'major', -5],
  ];
  for (const r of seed) {
    await src.execute({
      sql: `INSERT INTO canon_facts (id, subject, fact, category, importance, game_day) VALUES (?,?,?,?,?,?)`,
      args: r,
    });
  }

  const tmp = path.join(os.tmpdir(), `dnd-backup-roundtrip-${process.pid}.sql`);
  const stats = await dumpToSql(src, tmp);
  assertEqual(stats.tableCount, 1, 'dumped 1 table');
  assertEqual(stats.rowCount, 3, 'dumped 3 rows');

  const sql = fs.readFileSync(tmp, 'utf8');
  assert(sql.includes('CREATE TABLE'), 'dump contains CREATE TABLE');
  assert(sql.includes('CREATE INDEX'), 'dump recreates the index');
  assert(sql.includes("''"), 'single quotes are escaped in the dump');
  assert(sql.startsWith('-- D&D Meta Game database backup'), 'dump has a restore-instructions header');

  // Restore into a SECOND, independent in-memory DB.
  const dst = createClient({ url: ':memory:' });
  await dst.executeMultiple(sql);

  const rows = (await dst.execute('SELECT id, subject, fact, category, importance, game_day FROM canon_facts ORDER BY id')).rows;
  assertEqual(rows.length, 3, 'restored row count matches');
  assertEqual(rows[0].subject, 'Gareth', 'row 1 subject round-trips');
  assertEqual(rows[0].fact, "He's dead; do not resurrect.", 'row 1 fact with apostrophe round-trips');
  assertEqual(rows[0].category, 'death', 'row 1 category round-trips');
  assertEqual(rows[1].subject, "Maël O'Brien", 'row 2 unicode + apostrophe round-trips');
  assertEqual(rows[1].fact, null, 'row 2 NULL round-trips');
  assertEqual(rows[2].fact, 'líne\nbreak survives', 'row 3 embedded newline + unicode round-trips');
  assertEqual(Number(rows[2].game_day), -5, 'row 3 negative integer round-trips');

  const idx = (await dst.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_canon_subject'")).rows;
  assertEqual(idx.length, 1, 'index exists after restore');

  if (typeof src.close === 'function') src.close();
  if (typeof dst.close === 'function') dst.close();
  try { fs.unlinkSync(tmp); } catch { /* best effort */ }
}

async function run() {
  try {
    testSerializer();
    await testRoundTrip();
  } catch (e) {
    console.error('FATAL:', e);
    failed++;
  } finally {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
