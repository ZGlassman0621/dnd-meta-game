// Migration 106: perception pre-roll store (2026-11-05).
//
// One banked Perception number per character, per dungeon: rolled once at
// the dungeon door, read in secret at a hidden-layer check (trap, secret
// door, stealthed enemy), replaced with a fresh roll when used. The DM
// never asks for a mid-dungeon Perception roll — the ask itself is the
// tell this removes.
//
//   session_id   — the dm_sessions row the bank belongs to
//   dungeon_key  — the dungeon's name as the DM gave it in
//                  [PERCEPTION_PREROLL: Dungeon="..."]; the active one
//                  lives on session_config.activePerceptionDungeon
//   actor_type   — 'pc' | 'companion'
//   actor_name   — the character/companion name (matched case-insensitively)
//   banked_die   — the stored d20 (1-20); the modifier is the EFFECTIVE
//                  modifier at the door (sheet + exhaustion/condition
//                  penalty folded in, mirroring requestPcRoll)
//   modifier     — the effective Perception modifier; total = die + modifier,
//                  passive = 10 + modifier (same formula as getPcPassive)
//
// One row per (session, dungeon, actor) — the unique index enforces it;
// the service deletes-then-inserts on re-bank, so the index never fires
// in normal operation.
//
// Follows the runner convention (up(db) + db.execute only, inside the
// runner's transaction — never import dbAll/dbRun here) and the 104
// rollback convention (additive table stays in place on rollback).

export async function up(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS perception_pre_rolls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    dungeon_key TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    banked_die INTEGER NOT NULL,
    modifier INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pre_rolls_session_dungeon_actor
    ON perception_pre_rolls (session_id, dungeon_key, actor_type, actor_name)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_pre_rolls_session
    ON perception_pre_rolls (session_id, dungeon_key)`);
}

export async function down(db) {
  // Additive table; inert when unused, so a rollback leaves it in place
  // (same convention as other additive migrations in this repo).
}
