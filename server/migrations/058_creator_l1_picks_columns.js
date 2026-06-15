/**
 * Migration 058 — Add columns for the creator's level-1 class picks.
 *
 * The V2 character creator's Step 4 "Other level-1 picks" was a placeholder;
 * wiring real pickers means persisting two choices that had no home:
 *   - fighting_style: the Fighter's level-1 Fighting Style (TEXT, e.g. 'archery')
 *   - expertise:      the Rogue's level-1 Expertise skills (TEXT JSON array)
 *
 * Cantrips/spells already have columns (known_cantrips / known_spells). Idempotent,
 * PRAGMA-guarded (mirrors migration 054); no-op down (SQLite has no clean DROP COLUMN).
 */

export async function up(db) {
  try {
    const cols = await db.execute('PRAGMA table_info(characters)');
    const have = new Set(cols.rows.map(r => r[1] ?? r.name));
    if (!have.has('fighting_style')) {
      await db.execute("ALTER TABLE characters ADD COLUMN fighting_style TEXT");
    }
    if (!have.has('expertise')) {
      await db.execute("ALTER TABLE characters ADD COLUMN expertise TEXT DEFAULT '[]'");
    }
  } catch (e) {
    console.warn('Migration 058 (creator L1 pick columns) note:', e.message);
  }
}

export async function down() {
  // No-op: SQLite has no clean DROP COLUMN; leave the columns in place on rollback.
}
