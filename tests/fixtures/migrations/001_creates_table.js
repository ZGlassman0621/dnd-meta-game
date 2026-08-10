// Fixture: a well-formed migration that should apply and commit.
export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _mig_fixture_a (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT
    )
  `);
  await db.execute({ sql: 'INSERT INTO _mig_fixture_a (label) VALUES (?)', args: ['ok'] });
}
