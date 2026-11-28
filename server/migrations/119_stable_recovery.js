// Migration 119: stabilised-creature recovery clock (healers-kit-stabilize,
// 2026-11-27).
//
// 2024 PHB, Healer's Kit: a creature stabilised with the kit regains 1 Hit
// Point after 1d4 hours. Source tag: 2024 book (not homebrew).
//
// stable_recover_at holds the absolute game hour at which a stable creature
// at 0 HP regains 1 HP (healersKitService.absoluteHour). NULL means no
// recovery is scheduled. Set when a Healer's Kit use stabilises the
// creature (for the player character, once the player reports the 1d4);
// cleared when the creature drops to 0 again or takes damage at 0 HP, and
// when the recovery fires. Existing rows start NULL: nobody is mid-recovery.
//
// Runner convention: up(db) + db.execute only, inside the runner's
// transaction. Idempotent through PRAGMA table_info.
async function addColumn(db, table, col, ddl) {
  const cols = await db.execute(`PRAGMA table_info(${table})`);
  const names = (cols.rows || []).map((r) => r.name ?? r[1]);
  if (!names.includes(col)) await db.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

export async function up(db) {
  await addColumn(db, 'characters', 'stable_recover_at', 'stable_recover_at INTEGER');
  await addColumn(db, 'companions', 'stable_recover_at', 'stable_recover_at INTEGER');
}

export async function down(db) {
  // Additive columns; a rollback leaves them in place (repo convention).
}
