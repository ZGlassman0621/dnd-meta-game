// Migration 117: warlock Eldritch Invocations (class-audit-severe-seven
// item 2, 2026-11-25).
//
// characters.invocations is a JSON array of { key, choice } — the keys
// are server/data/warlockInvocations.js; `choice` names the cantrip or
// Origin feat a repeatable invocation was taken for (null otherwise).
// It is the follow-up migration 113 anticipated: the Pact boons are
// invocations in 2024, so a held Pact is in this list, and
// characters.pact stays as its mirror (warlockInvocationService
// pactFromInvocations) for the code that already reads it.
//
// A JSON column, not a side table: the list is read and written whole
// (sheet, level-up, DM prompt), it is small (10 at most), and its
// shape matches the other per-character pick lists (feats,
// known_cantrips). Default '[]'.
//
// Backfill: a row that already holds a pact gets that Pact as its one
// invocation, so a pre-117 warlock's Stage 2 pick is not lost.
//
// Runner convention: up(db) + db.execute only, inside the runner's
// transaction. Idempotent through PRAGMA table_info.
export async function up(db) {
  const cols = await db.execute('PRAGMA table_info(characters)');
  const names = (cols.rows || []).map((r) => r.name ?? r[1]);
  if (!names.includes('invocations')) {
    await db.execute(`ALTER TABLE characters ADD COLUMN invocations TEXT DEFAULT '[]'`);
  }
  for (const pact of ['blade', 'chain', 'tome']) {
    await db.execute({
      sql: `UPDATE characters SET invocations = ?
            WHERE pact = ? AND (invocations IS NULL OR invocations = '' OR invocations = '[]')`,
      args: [JSON.stringify([{ key: `pact_of_the_${pact}`, choice: null }]), pact],
    });
  }
}

export async function down(db) {
  // Additive column; a rollback leaves it in place (repo convention).
}
