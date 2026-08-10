// Fixture: a migration that half-applies and THEN throws.
// This is the exact failure the transactional runner exists to contain:
// without a transaction, _mig_fixture_b survives but the migration is never
// recorded, so the next boot re-runs it and dies on "table already exists".
export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _mig_fixture_b (
      id INTEGER PRIMARY KEY AUTOINCREMENT
    )
  `);
  throw new Error('deliberate fixture failure after a partial schema change');
}
