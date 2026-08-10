/**
 * Phase 2.3c — migrations are atomic with their _migrations record.
 *
 * The failure this guards against: a migration half-applies and throws. Before
 * this change, up() and the _migrations INSERT were two independent statements,
 * so the schema change survived but was never recorded — the next boot re-ran
 * the migration and died on "duplicate column"/"table already exists", with no
 * way forward except hand-editing _migrations.
 *
 * Runs against its own throwaway database file so it cannot touch real schema,
 * and against fixture migrations in tests/fixtures/migrations rather than the
 * real 53.
 */

import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { runMigrations } from '../server/migrationRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures', 'migrations');
const TMP_DIR = join(HERE, '..', '.test-tmp');
const DB_FILE = join(TMP_DIR, 'migration-atomicity.db');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

async function tableExists(db, name) {
  const r = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    args: [name],
  });
  return r.rows.length > 0;
}

async function appliedNames(db) {
  const r = await db.execute('SELECT name FROM _migrations ORDER BY id');
  return r.rows.map((x) => x.name);
}

async function run() {
  rmSync(DB_FILE, { force: true });
  mkdirSync(TMP_DIR, { recursive: true });
  const db = createClient({ url: `file:${DB_FILE}` });

  // ============================================================
  console.log('\n=== Test 1: a failing migration rolls back completely ===\n');
  // ============================================================

  let threw = null;
  try {
    await runMigrations(db, { migrationsDir: FIXTURES });
  } catch (e) {
    threw = e;
  }

  assert(threw !== null, 'the failing migration propagates an error rather than continuing');
  assert(
    threw && /002_partial_then_throws/.test(threw.message),
    'the error names the migration that failed'
  );
  assert(
    threw && /rolled back/i.test(threw.message),
    'the error states the database was rolled back'
  );
  assert(threw?.cause instanceof Error, 'the original cause is preserved for debugging');

  // The good migration before it must still be committed.
  assert(await tableExists(db, '_mig_fixture_a'), 'the preceding good migration stayed committed');
  const names = await appliedNames(db);
  assert(names.includes('001_creates_table'), 'the good migration is recorded in _migrations');

  // The heart of it: the partial schema change must NOT survive.
  assert(
    !(await tableExists(db, '_mig_fixture_b')),
    'the failed migration left NO partial schema behind'
  );
  assert(
    !names.includes('002_partial_then_throws'),
    'the failed migration was not recorded as applied'
  );

  // ============================================================
  console.log('\n=== Test 2: the failure is retryable, not wedged ===\n');
  // ============================================================

  // Re-running must fail the same way — not with a *different* error such as
  // "table already exists", which is the symptom of the old non-atomic runner.
  let second = null;
  try {
    await runMigrations(db, { migrationsDir: FIXTURES });
  } catch (e) {
    second = e;
  }

  assert(second !== null, 'a retry still surfaces the underlying failure');
  assert(
    second && /deliberate fixture failure/.test(second.cause?.message || ''),
    'the retry fails on the ORIGINAL cause, not on leftover partial state'
  );
  assert(
    !/already exists/i.test(second?.cause?.message || ''),
    'the retry does NOT fail with "already exists" — the old non-atomic symptom'
  );

  const namesAfter = await appliedNames(db);
  assert(namesAfter.length === 1, 'still exactly one migration recorded after the retry');

  // ============================================================
  console.log('\n=== Test 3: good migrations commit their writes ===\n');
  // ============================================================

  const rows = await db.execute('SELECT label FROM _mig_fixture_a');
  assert(rows.rows.length === 1 && rows.rows[0].label === 'ok', 'committed migration data is readable');

  // ============================================================
  console.log('\n=== Cleanup ===\n');
  // ============================================================
  db.close?.();
  rmSync(DB_FILE, { force: true });
  assert(true, 'throwaway database removed');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

await run();
