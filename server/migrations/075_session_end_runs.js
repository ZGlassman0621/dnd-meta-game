/**
 * Migration 075: session_end_runs — idempotency + audit for the session-end flow.
 *
 * Each stage of endSession() checks this table before running and writes
 * its result after. UNIQUE(session_id, stage) makes double-invocation safe.
 */
export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS session_end_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      stage TEXT NOT NULL CHECK (stage IN ('xp', 'downtime', 'domains', 'digest', 'sweep')),
      status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'complete', 'failed', 'pending_llm')),
      detail_json TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      UNIQUE(session_id, stage)
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_session_end_runs_session ON session_end_runs(session_id)`);
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_session_end_runs_session');
  await db.execute('DROP TABLE IF EXISTS session_end_runs');
}
