/**
 * Migration 058: creator level-1 pick columns on characters
 *
 * RECONSTRUCTED from the live database schema (2026-08-10). See migration
 * 054's header for why these files had to be rebuilt.
 *
 * Adds the two level-1 class choices the rebuilt creator captures but that
 * had no home in the schema:
 *   - fighting_style: TEXT, nullable. The Fighter/Paladin/Ranger style pick.
 *     Set by Step 4 (Class & Calling) — see `Step4ClassCalling.jsx`, which
 *     clears it whenever the class changes.
 *   - expertise: TEXT DEFAULT '[]'. JSON array of skill keys (Rogue/Bard).
 *     Defaults to an empty array rather than NULL so consumers can parse it
 *     unconditionally through `safeParse` without a null branch.
 *
 * Column types and the '[]' default are taken from the live schema exactly;
 * all three live character rows carry the default and none has a
 * fighting_style set.
 *
 * Additive and idempotent, one PRAGMA read reused for both columns.
 */

export async function up(db) {
  const cols = await db.execute(`PRAGMA table_info(characters)`);
  const existing = new Set(cols.rows.map((c) => c.name));

  if (!existing.has('fighting_style')) {
    await db.execute(`ALTER TABLE characters ADD COLUMN fighting_style TEXT`);
  }
  if (!existing.has('expertise')) {
    await db.execute(`ALTER TABLE characters ADD COLUMN expertise TEXT DEFAULT '[]'`);
  }
}

export async function down(db) {
  // SQLite < 3.35 doesn't support DROP COLUMN portably; both columns are
  // nullable/defaulted and harmless if unused.
}
