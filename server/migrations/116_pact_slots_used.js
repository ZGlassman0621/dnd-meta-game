// Migration 116: pact slots spent, tracked apart from the shared used map
// (class-audit gap 7, the D3 split; docs/pm/class-audit-severe-seven).
//
// spell_slots_used is one map keyed by slot level; it cannot tell a spent
// Pact Magic slot from a spent Spellcasting slot at the same level, so a
// short-rest pact reset used to subtract the whole pact count and could
// erase a spent wizard slot. pact_slots_used ({ "<level>": count }) records
// which spends were pact slots; the reset subtracts exactly those. NULL
// means "no record yet" (a row from before this migration) — the reset then
// keeps the old whole-pact-count behaviour, so no warlock is stranded.
//
// Runner convention: up(db) + db.execute only, inside the runner's
// transaction. Idempotent through PRAGMA table_info.
export async function up(db) {
  for (const table of ['characters', 'companions']) {
    const cols = await db.execute(`PRAGMA table_info(${table})`);
    const names = (cols.rows || []).map((r) => r.name ?? r[1]);
    if (!names.includes('pact_slots_used')) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN pact_slots_used TEXT`);
    }
  }
}

export async function down(db) {
  // Additive column; a rollback leaves it in place (repo convention).
}
