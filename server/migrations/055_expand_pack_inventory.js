/**
 * Migration 055: expand pack inventory (data-only)
 *
 * RECONSTRUCTED from the live database schema (2026-08-10). See migration
 * 054's header for why these files had to be rebuilt.
 *
 * DELIBERATELY EMPTY, and that is the faithful reconstruction — not a stub
 * left to be filled in later.
 *
 * The reasoning: this migration is recorded as applied on live, and a full
 * column-by-column and index-by-index diff of the live schema against a
 * database built from 001-053 shows it left NO schema footprint. It was
 * therefore a one-time data migration — by its name, expanding equipment
 * "pack" entries (Explorer's Pack and friends) into individual inventory
 * items on rows that already existed at the time.
 *
 * A one-time backfill is unreproducible and, more importantly, unreachable:
 *   - Against live, the runner skips it — already in `_migrations`.
 *   - Against a fresh database, there are no pre-existing rows to expand.
 * There is no execution path in which a body here could run against the data
 * it was written for.
 *
 * Inventing a plausible-looking UPDATE would be strictly worse than nothing:
 * it would be a guess at logic no one can verify, and it would fire against
 * real inventories if an older backup were ever restored and migrated
 * forward. An honest empty body is the safe and accurate choice.
 *
 * The file exists so the migration name is reserved and the numbering stays
 * strictly sequential — the runner tracks applied migrations by NAME, so
 * this name must exist locally or a fresh build silently diverges from the
 * live ledger.
 */

export async function up(db) {
  // Intentionally no-op. See header — one-time backfill, no schema effect,
  // and no reachable execution path. Do not add speculative logic here.
}

export async function down(db) {
  // Nothing to roll back.
}
