/**
 * Migration 098: Condition metadata sidecar (combat item 8).
 *
 * active_conditions stays a plain string list (every existing reader
 * expects strings). Per-condition metadata lives here instead: who
 * charmed whom, who grapples whom, so the engine can enforce
 * "can't attack the charmer" and compute grapple escape DCs.
 * One row per (kind, owner, condition); removed when the condition
 * is removed. No backfill: conditions applied before this migration
 * carry no metadata, and handlers treat missing metadata as
 * "unknown source" (refuse-with-remedy where the source is required).
 */
export async function up(db) {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS condition_meta (
      kind TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      condition TEXT NOT NULL,
      meta_json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (kind, owner_id, condition)
    )`
  );
}

export function down() {
  // No-op by convention (091 pattern): tables are never dropped.
}
