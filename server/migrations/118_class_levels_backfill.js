// Migration 118: class_levels backfill (level-up-off-by-one-fix,
// 2026-11-27, PM option b).
//
// Creation now writes characters.class_levels (the record of levels
// actually taken). Rows created before that have none, and once
// session end raises characters.level the level-up route can no
// longer tell which levels were applied.
//
// Conservative backfill: only the rows whose applied level is certain
// without any derivation — playable (creation_phase 'active'), a real
// class, characters.level = 1 (a playable character's applied level
// cannot be below 1). Each gets one entry { class, level: 1, subclass },
// the shape the level-up route writes. Rows above level 1 are left
// untouched: maximum hit dice were checked as a source and do not
// verify (characters.hit_dice is written only by the level-up route,
// from class_levels itself, so it is blank for exactly these rows).
// Rows whose class_levels is already set are never touched.
//
// Runner convention: up(db) + db.execute only, inside the runner's
// transaction. Idempotent: the WHERE clause skips rows already set.
export async function up(db) {
  const rows = await db.execute(
    `SELECT id, class, subclass FROM characters
      WHERE (class_levels IS NULL OR class_levels = '' OR class_levels = '[]')
        AND creation_phase = 'active'
        AND level = 1
        AND class IS NOT NULL AND TRIM(class) <> ''
        AND class NOT IN ('creating', 'prelude')`
  );
  for (const r of rows.rows || []) {
    const cls = String(r.class ?? r[1]).trim();
    const sub = (r.subclass ?? r[2]) || null;
    await db.execute({
      sql: 'UPDATE characters SET class_levels = ? WHERE id = ?',
      args: [JSON.stringify([{ class: cls, level: 1, subclass: sub }]), r.id ?? r[0]],
    });
  }
}

export async function down(db) {
  // Data backfill; a rollback leaves the records in place (repo convention).
}
