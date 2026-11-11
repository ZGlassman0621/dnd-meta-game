/**
 * Migration 080: roll_log — every resolved non-combat check, permanently.
 *
 * The [ROLL_REQUEST] system (design: roll-request-design.md, decided
 * 2026-10-20) records each roll here: who rolled, what check, the hidden
 * DC, the dice, the modifier from the actor's real sheet, and the outcome
 * (including crits). The log is fiction state — a nat-1 consequence ("the
 * lock is jammed") must survive into the next session, and the future
 * adjudication ledger (Phase 3) reads from here.
 *
 * Writes go through the migration runner's transaction (db.execute only —
 * see the 078 lesson in MEMORY.md).
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS roll_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      campaign_id INTEGER,
      character_id INTEGER,
      actor_type TEXT NOT NULL DEFAULT 'pc',
      actor_name TEXT,
      check_kind TEXT NOT NULL DEFAULT 'skill',
      check_name TEXT NOT NULL,
      dc INTEGER,
      modifier INTEGER NOT NULL DEFAULT 0,
      dice_json TEXT,
      taken_die INTEGER,
      total INTEGER,
      outcome TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'reported',
      context TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_roll_log_session ON roll_log(session_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_roll_log_character ON roll_log(character_id)`);
}

export async function down(db) {
  await db.execute(`DROP TABLE IF EXISTS roll_log`);
}
