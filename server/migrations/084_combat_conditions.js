/**
 * Migration 084: Combat-real state (v1.0.191, B3/B4).
 *
 * - combat_enemies.active_conditions — enemies get the same condition
 *   state the party got in 083 (combat-real B3). Encounter-scoped:
 *   conditions die with the encounter rows.
 * - companions.concentrating_on — companion concentration tracking,
 *   mirroring characters.concentrating_on (combat-real B4).
 * - combat_turn_state.party_cover_json — SET_COVER for party members
 *   (combat-real B2): cover is encounter state, stored beside the
 *   morale buff. Shape: { "<lowercased actor name>": "half" }.
 *
 * Same pattern as 077/079/081/082/083: writes go through the runner's
 * transaction via db.execute; column checks via PRAGMA table_info.
 */
export async function up(db) {
  const addIfMissing = async (table, column, ddl) => {
    const { rows } = await db.execute(`PRAGMA table_info(${table})`);
    const existing = rows.map(r => r.name);
    if (!existing.includes(column)) {
      await db.execute(ddl);
    }
  };

  await addIfMissing('combat_enemies', 'active_conditions',
    `ALTER TABLE combat_enemies ADD COLUMN active_conditions TEXT DEFAULT '[]'`);
  await addIfMissing('companions', 'concentrating_on',
    `ALTER TABLE companions ADD COLUMN concentrating_on TEXT`);
  await addIfMissing('combat_turn_state', 'party_cover_json',
    `ALTER TABLE combat_turn_state ADD COLUMN party_cover_json TEXT DEFAULT '{}'`);
}

export async function down() {
  // No-op: columns are additive and harmless to leave in place.
}
