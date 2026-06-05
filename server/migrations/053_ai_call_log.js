/**
 * Migration 053: ai_call_log table.
 *
 * Phase 4a SC-4a.1 (v1.0.165). Comprehensive logging of every AI call the
 * production system makes — full prompts, full responses, timing, model
 * identity, captured marker results, and downstream signal-relevant
 * metadata. Append-only; the user IS the data subject (single-user system),
 * so no PII surfaces beyond what the project already stores.
 *
 * Per spec §2.4 — capture everything for now; archival is future work,
 * `archived_at` column added so a future archival job can move old rows
 * somewhere cheaper without a schema change.
 *
 * Idempotent — checks `sqlite_master` before CREATE.
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ai_call_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      -- Identity (§2.2). All optional except call_purpose because some
      -- call sites (one-shot generators run before any character exists,
      -- e.g. campaign plan creation) don't have character/session context.
      character_id INTEGER,
      campaign_id INTEGER,
      session_id INTEGER,
      turn_number INTEGER,
      prompt_builder TEXT,
      call_purpose TEXT NOT NULL,

      -- Timing (§2.2)
      request_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      response_received_at DATETIME,
      latency_ms INTEGER,

      -- Model identity + token counts (§2.2)
      model_id TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cache_read_input_tokens INTEGER,
      cache_creation_input_tokens INTEGER,

      -- Prompt content. system_prompt + user_message + conversation_history
      -- captured verbatim. SQLite TEXT has no length limit; large prompts
      -- (10-30K tokens) are routinely many tens of KB.
      system_prompt TEXT,
      user_message TEXT,
      conversation_history TEXT,  -- JSON array

      -- Response content
      response_text TEXT,
      response_status TEXT,        -- 'ok' | 'error' | 'truncated'
      response_error TEXT,         -- error message if status='error'

      -- Phase 4a SC-4a.3 — prompt-shape accounting. JSON breakdown of the
      -- system prompt by section (heuristic section-boundary inference at
      -- ship time; exact builder annotation if a future ship demands it).
      -- Shape: [{ name: 'cardinal_rules', tokens: 412, chars: 1648 }, ...]
      prompt_sections TEXT,        -- JSON array

      -- Marker pipeline + correction-loop signal hooks (§3.2)
      markers_detected TEXT,       -- JSON: { schemaKey: count, ... }
      marker_failures TEXT,        -- JSON: validation failures from the pipeline
      triggered_correction_loop INTEGER DEFAULT 0,
      rule_violations TEXT,        -- JSON: rule-verifier hits if any

      -- Free-form metadata for signals not yet promoted to columns
      metadata TEXT,               -- JSON

      -- Future archival hook (§2.4)
      archived_at DATETIME
    )
  `);

  // Indexes for the common query patterns (§2.2):
  //  - Per-character timeline ("show me Vesna's last 50 calls")
  //  - Per-session timeline ("everything in the most recent session")
  //  - Time-range scans for aggregate signals
  //  - Call-purpose grouping ("all gameplay_turn calls in the last week")
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_ai_call_log_character ON ai_call_log(character_id, request_started_at DESC)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_ai_call_log_session ON ai_call_log(session_id, request_started_at)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_ai_call_log_started_at ON ai_call_log(request_started_at DESC)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_ai_call_log_purpose ON ai_call_log(call_purpose, request_started_at DESC)`
  );
}

export async function down(db) {
  await db.execute(`DROP INDEX IF EXISTS idx_ai_call_log_purpose`);
  await db.execute(`DROP INDEX IF EXISTS idx_ai_call_log_started_at`);
  await db.execute(`DROP INDEX IF EXISTS idx_ai_call_log_session`);
  await db.execute(`DROP INDEX IF EXISTS idx_ai_call_log_character`);
  await db.execute(`DROP TABLE IF EXISTS ai_call_log`);
}
