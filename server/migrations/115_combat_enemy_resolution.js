// Migration 115: enemy resolution statuses (combat-resolution job,
// 2026-11-23).
//
// Zach (2026-11-23): "Fights need some sort of resolution. If both thugs
// are still standing, there has to be a reason for it — they ran off, we
// ended up talking things out." combat_enemies.status allowed only
// 'active', 'dead' and 'fled' (migration 064). A fight can now also end
// with an enemy that yielded ('surrendered') or stood down by agreement
// ('settled'), so the CHECK widens to five values.
//
// SQLite cannot alter a CHECK constraint in place, so the table is
// rebuilt: its CURRENT definition is read from sqlite_master (so every
// column a later migration added — cover 069, active_conditions 084,
// stats_json 085, enemy_spell_slots_json 096, concentrating_on 097 —
// carries over untouched), only the status CHECK is rewritten, the rows
// are copied, and the two indexes are recreated. No table holds a
// foreign key to combat_enemies, so the drop is safe.
//
// Idempotent: a table whose CHECK already lists 'surrendered' is left
// alone. Runner convention: up(db) + db.execute only, inside the
// runner's transaction — never import dbAll/dbRun here.
const OLD_CHECK = /CHECK\s*\(\s*status\s+IN\s*\(\s*'active'\s*,\s*'dead'\s*,\s*'fled'\s*\)\s*\)/i;
const NEW_CHECK = "CHECK(status IN ('active', 'dead', 'fled', 'surrendered', 'settled'))";

export async function up(db) {
  const t = await db.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'combat_enemies'");
  const sql = t.rows?.[0]?.sql;
  if (!sql) return; // no table (fresh DB before 064 cannot reach here; defensive)
  if (/'surrendered'/.test(sql)) return; // already widened
  if (!OLD_CHECK.test(sql)) {
    throw new Error('migration 115: combat_enemies status CHECK not in the expected form — refusing to rebuild blind');
  }
  const idx = await db.execute("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'combat_enemies' AND sql IS NOT NULL");
  const indexSql = (idx.rows || []).map((r) => r.sql);
  const newSql = sql
    .replace(OLD_CHECK, NEW_CHECK)
    .replace(/CREATE TABLE\s+(IF NOT EXISTS\s+)?("?)combat_enemies\2/i, 'CREATE TABLE combat_enemies_new');
  await db.execute(newSql);
  await db.execute('INSERT INTO combat_enemies_new SELECT * FROM combat_enemies');
  await db.execute('DROP TABLE combat_enemies');
  await db.execute('ALTER TABLE combat_enemies_new RENAME TO combat_enemies');
  for (const s of indexSql) await db.execute(s);
}

export async function down(db) {
  // Widening a CHECK is inert for existing rows; a rollback leaves it.
}
