/**
 * Migration 089: Encounter scene rooms (Dungeon generation + scene layer, Phase B).
 *
 * SET_COVER Feature= validation needs to know "the room where the fight
 * is happening" for an encounter. No session -> scene pointer existed
 * anywhere in the repo (confirmed 2026-10-29), so this table is that
 * pointer, one row per encounter: which stored scene room the encounter
 * is taking place in. Scene entry / combat-start-in-a-scene code calls
 * setEncounterRoom() (dungeonSceneStorageService.js) to link it; the
 * SET_COVER handler reads it to validate a named feature against the
 * room's stored features_json. No link = no room list to check against,
 * and SET_COVER keeps its pre-Phase-B grant (see combatMarkerService).
 *
 * Writes only through the runner's transaction (up(db) +
 * db.execute(...)), like migrations 087/088. Never import dbAll/dbRun
 * from database.js inside a migration.
 */
export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS encounter_scene_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      encounter_seq INTEGER NOT NULL DEFAULT 1,
      scene_id INTEGER NOT NULL,
      room_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, encounter_seq)
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_encounter_scene_rooms_session
    ON encounter_scene_rooms(session_id, encounter_seq)
  `);
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_encounter_scene_rooms_session');
  await db.execute('DROP TABLE IF EXISTS encounter_scene_rooms');
}
