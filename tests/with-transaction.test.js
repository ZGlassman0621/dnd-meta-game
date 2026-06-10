/**
 * Real-DB test for database.withTransaction().
 *
 * Proves commit persists all writes and a thrown callback rolls every write
 * back (atomicity). Uses a TEST_-prefixed temp table that is dropped at the end,
 * per the repo testing convention.
 */

import db, { withTransaction, dbAll, dbRun } from '../server/database.js';

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else { console.log(`  ✗ FAIL: ${msg}`); failed++; }
}

const TABLE = 'TEST_txn_demo';

async function main() {
  await db.execute(`CREATE TABLE IF NOT EXISTS ${TABLE} (id INTEGER PRIMARY KEY, val TEXT)`);
  await db.execute(`DELETE FROM ${TABLE}`);

  console.log('\n=== withTransaction: commit persists all writes ===\n');
  const ret = await withTransaction(async (tx) => {
    await tx.run(`INSERT INTO ${TABLE} (id, val) VALUES (?, ?)`, [1, 'a']);
    await tx.run(`INSERT INTO ${TABLE} (id, val) VALUES (?, ?)`, [2, 'b']);
    const row = await tx.get(`SELECT val FROM ${TABLE} WHERE id = ?`, [1]);
    check(row && row.val === 'a', 'tx.get sees a write made earlier in the same transaction');
    const allRows = await tx.all(`SELECT id FROM ${TABLE}`);
    check(allRows.length === 2, 'tx.all sees both in-transaction inserts');
    return 'committed-return-value';
  });
  check(ret === 'committed-return-value', 'withTransaction returns the callback value');
  const afterCommit = await dbAll(`SELECT id, val FROM ${TABLE} ORDER BY id`);
  check(afterCommit.length === 2, 'both rows present after commit');

  console.log('\n=== withTransaction: thrown callback rolls everything back ===\n');
  let threw = false;
  try {
    await withTransaction(async (tx) => {
      await tx.run(`INSERT INTO ${TABLE} (id, val) VALUES (?, ?)`, [3, 'c']);
      await tx.run(`INSERT INTO ${TABLE} (id, val) VALUES (?, ?)`, [4, 'd']);
      throw new Error('intentional failure mid-transaction');
    });
  } catch (e) {
    threw = true;
    check(e.message === 'intentional failure mid-transaction', 'original error propagates to caller');
  }
  check(threw, 'withTransaction rethrows the callback error');
  const afterRollback = await dbAll(`SELECT id FROM ${TABLE} WHERE id IN (3, 4)`);
  check(afterRollback.length === 0, 'neither row 3 nor 4 persisted (full rollback)');
  const stillTwo = await dbAll(`SELECT id FROM ${TABLE}`);
  check(stillTwo.length === 2, 'pre-existing committed rows are untouched by the rolled-back txn');

  console.log('\n=== withTransaction: concurrent read-modify-write loses no update ===\n');
  const COUNTER = 'TEST_txn_counter';
  await db.execute(`CREATE TABLE IF NOT EXISTS ${COUNTER} (id INTEGER PRIMARY KEY, n INTEGER)`);
  await db.execute(`DELETE FROM ${COUNTER}`);
  await db.execute(`INSERT INTO ${COUNTER} (id, n) VALUES (1, 0)`);
  const N = 12;
  const ops = Array.from({ length: N }, () => withTransaction(async (tx) => {
    const row = await tx.get(`SELECT n FROM ${COUNTER} WHERE id = 1`);
    await tx.run(`UPDATE ${COUNTER} SET n = ? WHERE id = 1`, [row.n + 1]);
  }));
  const settled = await Promise.allSettled(ops);
  const rejected = settled.filter(r => r.status === 'rejected').length;
  const finalN = (await dbAll(`SELECT n FROM ${COUNTER} WHERE id = 1`))[0].n;
  // Core invariant: every concurrent op either COMMITTED (incrementing n) or was
  // rejected — none silently lost. With true write-serialization, rejected===0
  // and finalN===N. (Pre-fix, plain dbGet/dbRun would lose updates: finalN < N
  // with rejected===0.)
  check(finalN + rejected === N, `no lost updates: committed(${finalN}) + rejected(${rejected}) === ${N}`);
  console.log(`    [info] concurrency outcome: finalN=${finalN}, rejected=${rejected} (rejected>0 ⇒ libsql surfaces busy rather than queueing)`);
  await db.execute(`DROP TABLE IF EXISTS ${COUNTER}`);

  // Cleanup
  await db.execute(`DROP TABLE IF EXISTS ${TABLE}`);

  console.log(`\n==================================================`);
  console.log(`withTransaction: ${passed} passed, ${failed} failed`);
  console.log(`==================================================\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('test harness error:', e); process.exit(1); });
