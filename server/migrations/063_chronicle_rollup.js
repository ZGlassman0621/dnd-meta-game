/**
 * Migration 056: Campaign chronicle rollup (Phase 4)
 *
 * `getSessionSummariesForPrompt` caps the DM prompt at the newest 10 session
 * chronicles (Phase 1.1). That bounded the prompt, but it bounded it by
 * FORGETTING: at session 30, sessions 1-20 simply stopped reaching the DM. For
 * an open-ended campaign that is the wrong trade — the early sessions are where
 * the character's formative history lives.
 *
 * The fix is compression rather than truncation. Chronicles older than the
 * verbatim tail are rolled into one running "campaign so far" paragraph, which
 * is re-compressed each time the window advances, so prompt cost stays flat
 * while the campaign's whole history stays present in summary form.
 *
 * One row per (campaign_id, character_id) — the rollup is rewritten in place,
 * not appended to. Columns:
 *
 *  - summary:               the running compressed narrative.
 *  - through_session_number: the highest session_number folded in. This is the
 *    resume point: the next rollup only needs the chronicles after it, so the
 *    LLM never re-reads material it already compressed.
 *  - sessions_rolled:       how many chronicles the summary represents. Used
 *    for the prompt header ("sessions 1-20, compressed") and to spot a rollup
 *    that silently stopped keeping up.
 *
 * UNIQUE on (campaign_id, character_id) so a concurrent double-roll collides
 * rather than quietly forking the campaign's memory into two rows.
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS campaign_chronicle_rollups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      summary TEXT NOT NULL,
      through_session_number INTEGER NOT NULL DEFAULT 0,
      sessions_rolled INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (campaign_id, character_id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);

  await db.execute(
    'CREATE INDEX IF NOT EXISTS idx_chronicle_rollups_campaign ON campaign_chronicle_rollups(campaign_id, character_id)'
  );
}

export async function down(db) {
  await db.execute('DROP TABLE IF EXISTS campaign_chronicle_rollups');
}
