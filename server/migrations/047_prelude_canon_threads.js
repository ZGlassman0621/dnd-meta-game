/**
 * Migration 047: Prelude canon threads + campaign threads
 *
 * Phase 2 chunk 4. Adds two tables to support long-term thread seeding from
 * Prelude play (Phase 1 Decision 6 — see DECISION_LOG 2026-04-29).
 *
 * `prelude_canon_threads` persists [CANON_THREAD] markers fired during
 * Prelude play. Each thread is an unresolved obligation the world will hold
 * across years of main-campaign time — distinct from prelude_canon_npcs
 * (entity persistence) and prelude_canon_facts (running ledger of truths).
 *
 * `campaign_threads` is the handoff target. Chunk 2 (transition service)
 * transfers active prelude threads into this table when the primary campaign
 * is created. Main campaign AI consults the table for thread-ripening
 * conditions ("PC returns to home region after 5+ years").
 *
 * Both tables ship together in this migration even though only chunk 2 will
 * write to campaign_threads — keeps migration numbering tight and lets
 * chunk 4 land its full schema in one commit.
 *
 * Thread kinds (per Phase 1 Decision 6):
 *   unresolved_loss        Parent vanished, friend never found, etc.
 *   blood_debt             PC killed someone with surviving family.
 *   unfulfilled_oath       Promise made; not kept by Prelude end.
 *   unpaid_crime           Crime committed; not yet pursued.
 *   unfinished_relationship Walked away from a bond not closed.
 *   held_object            PC has something whose owner will reclaim.
 *   held_secret            PC knows something someone else needs hidden.
 *
 * Thread weights:
 *   minor    May resurface; world doesn't actively chase it.
 *   notable  Likely to resurface at appropriate trigger.
 *   major    Should resurface; load-bearing for campaign arcs.
 *
 * Status state machine:
 *   active    → ripened (condition met) → resolved (closed in play)
 *           OR → decayed (very long inactivity, may never fire)
 */

export async function up(db) {
  // --- prelude_canon_threads ----------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prelude_canon_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      subject_npc_id INTEGER,
      subject_location_id INTEGER,
      subject_text TEXT,
      condition TEXT,
      weight TEXT NOT NULL DEFAULT 'notable',
      status TEXT NOT NULL DEFAULT 'active',
      created_at_age INTEGER,
      created_at_chapter INTEGER,
      session_id INTEGER,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_npc_id) REFERENCES prelude_canon_npcs(id) ON DELETE SET NULL,
      FOREIGN KEY (subject_location_id) REFERENCES prelude_canon_locations(id) ON DELETE SET NULL
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_prelude_canon_threads_char ON prelude_canon_threads(character_id, status)`);

  // --- campaign_threads ---------------------------------------------------
  // Handoff target for Prelude threads. Chunk 2 (transition service) writes
  // the rows; main campaign AI consults them for ripening conditions.
  // `source` is 'prelude' for transferred Prelude threads; future sources
  // (in-campaign-emerging threads) get their own values.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS campaign_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      campaign_id INTEGER,
      source TEXT NOT NULL DEFAULT 'prelude',
      source_thread_id INTEGER,
      kind TEXT NOT NULL,
      subject_npc_id INTEGER,
      subject_location_id INTEGER,
      subject_text TEXT,
      condition TEXT,
      weight TEXT NOT NULL DEFAULT 'notable',
      status TEXT NOT NULL DEFAULT 'active',
      ripened_at_game_day INTEGER,
      resolved_at_game_day INTEGER,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_campaign_threads_char ON campaign_threads(character_id, status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_campaign_threads_campaign ON campaign_threads(campaign_id, status)`);
}

export async function down(db) {
  await db.execute(`DROP TABLE IF EXISTS campaign_threads`);
  await db.execute(`DROP TABLE IF EXISTS prelude_canon_threads`);
}
