/**
 * Migration 086: Scene layer (Dungeon generation + scene layer, Phase A).
 *
 * The worldbuilding audit found the world at campaign scale only: a
 * "dungeon" in the locations registry is one node with a description.
 * Nothing under it — no rooms, no connections, no per-room features —
 * which is why cover had nowhere to live and travel had no geometry.
 *
 * Phase A creates the deterministic core only: the schema. Content
 * assignment (Phase B) and AI dressing (Phase C) fill these tables
 * later; nothing here depends on a live provider.
 *
 *   scenes
 *     One scene under a location (kind: dungeon/site). location_id is
 *     nullable so a scene can be sketched before it is attached to a
 *     registry node. seed_json holds the system-rolled seed packet
 *     (see sceneSeedService) so a skeleton can be regenerated and
 *     audited against the same packet.
 *
 *   scene_rooms
 *     Rooms of a scene. role is the skeleton's structural role
 *     (entrance, corridor, chamber, boss, treasure, secret, ...).
 *     label is the DESIGNER label (N10): the system/DM-digest name,
 *     never narrated to the player before they perceive the room.
 *     features_json is the Phase B feature list (cover/terrain/
 *     darkness/hazard objects); Phase A skeletons leave it [].
 *     encounter_json is the Phase B encounter assignment; Phase A
 *     leaves it NULL and reserves the room's XP budget in
 *     encounter_budget_xp instead.
 *
 *   scene_connections
 *     Edges between rooms. distance_ft and elevation_ft carry the
 *     geometry N3/N9 demand (rough distances, explicit drops/climbs);
 *     direction is the compass bearing of the edge (N3).
 */
export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS scenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      location_id INTEGER,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'dungeon',
      seed_json TEXT,
      status TEXT NOT NULL DEFAULT 'skeleton',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS scene_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scene_id INTEGER NOT NULL,
      room_key TEXT NOT NULL,
      role TEXT NOT NULL,
      label TEXT NOT NULL,
      features_json TEXT NOT NULL DEFAULT '[]',
      encounter_json TEXT,
      encounter_budget_xp INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL DEFAULT 'undiscovered',
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS scene_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scene_id INTEGER NOT NULL,
      from_room_id INTEGER NOT NULL,
      to_room_id INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'passage',
      locked INTEGER NOT NULL DEFAULT 0,
      trapped INTEGER NOT NULL DEFAULT 0,
      distance_ft INTEGER NOT NULL DEFAULT 30,
      elevation_ft INTEGER NOT NULL DEFAULT 0,
      direction TEXT
    )
  `);
}

export async function down(db) {
  // SQLite can't drop tables without rebuilding dependents. No-op.
}
