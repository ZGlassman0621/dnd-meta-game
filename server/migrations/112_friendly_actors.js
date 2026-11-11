// Migration 112: friendly-actor rows (mechanics-hooks Family 8, kind H).
//
// The `combat_allies` table is the friendly-side answer to
// `combat_enemies`: one row shape for every kind-H separate actor (Ox,
// Eldritch Cannon, Steel Defender, Servant of the Desert spirit,
// Stilled Summons spirit, Echo(es), Primal Companion, Extraneous Ego
// clone) and for the kind-C creatures that ride it (Hound of Ill Omen,
// Accursed Specter, Faithful Summons beasts) and the Wild Magic
// Friendly Creature row (Amendment 1 §2, 05–08).
//
// Why a new table, not a side flag on combat_enemies (Amendment 2 §3,
// §5.2 #7): combat_enemies is enemy-side only in EVERY consumer —
// findActiveEnemy, applyDamageToEnemy, enemy economy, legendary/lair
// hooks, turn-order sideOf, COMBAT_START encounter-seq counting. A
// side flag would need every consumer taught to exclude friendly rows,
// and one missed consumer turns an ally into a valid enemy target.
// A dedicated table keeps the invariant "combat_enemies = hostile"
// intact; only entityService (and, later, the DM prompt + the Hound
// save-disadvantage hook) reads combat_allies.
//
// Columns mirror combat_enemies where the shape is shared (session /
// encounter / name / HP / AC / attack bonus / damage dice / dex mod /
// status / stats_json snapshot) and add the friendly-side fields:
// owner (kind + id + name), temp HP, zone, a flags JSON blob for the
// per-kind rules that have no column (untargetable, immune-all,
// necrotic-heals, save-disadvantage target, condition immunity...),
// and an expiry (kind + value: turns / minutes / hour / long_rest /
// owner_death / never).
//
// No backfill: no friendly rows exist anywhere today (the registry
// entries all say modeled-not-ready), so there is nothing to migrate.
//
// Follows the runner convention (up(db) + db.execute only, inside the
// runner's transaction — never import dbAll/dbRun here) and the 104
// rollback convention (additive table stays in place on rollback).
//
// STAGED from cached mirror copies — no migrations were in the mirror,
// so this file was drafted from the combat_enemies INSERT shape in
// enemyCombatService.js (verified live in the mirror) and is FLAGGED
// for Mac-side verification at merge/push time: confirm no column
// collides with a live migration 112 already on the Mac, and confirm
// the combat_enemies column list above matches live bytes.

export async function up(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS combat_allies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    encounter_seq INTEGER NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    owner_kind TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    owner_name TEXT NOT NULL,
    max_hp INTEGER NOT NULL,
    current_hp INTEGER NOT NULL,
    temp_hp INTEGER NOT NULL DEFAULT 0,
    armor_class INTEGER NOT NULL,
    attack_bonus INTEGER NOT NULL DEFAULT 0,
    damage_dice TEXT,
    dex_mod INTEGER NOT NULL DEFAULT 0,
    zone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    stats_json TEXT,
    flags_json TEXT NOT NULL DEFAULT '{}',
    expires_kind TEXT NOT NULL DEFAULT 'never',
    expires_value INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_combat_allies_session
    ON combat_allies (session_id, encounter_seq)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_combat_allies_owner
    ON combat_allies (session_id, owner_kind, owner_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_combat_allies_kind
    ON combat_allies (session_id, kind, status)`);
}

export async function down(db) {
  // Additive table; inert when unused, so a rollback leaves it in place
  // (same convention as other additive migrations in this repo).
}
