// Migration 120: commission deadlines on the absolute day scale
// (healers-kit-stabilize Part 2, the commission year-crossing fix,
// 2026-11-27).
//
// merchant_orders stores its days on the day-of-year scale (written from
// characters.game_day) with no year. A commission ordered on day 360 with
// 10 days of work is due on "day 370", which a day-of-year clock never
// reaches; a commission made ready near year end never expires. The world
// clock already carries an absolute day counter (world_clock.current_day),
// so the order now carries its deadline and ready day on that scale too:
//   deadline_abs_day — absolute day the commission becomes ready
//   ready_abs_day    — absolute day it became ready (expiry counts from it)
// The day-of-year columns stay as they are (the commissions panel shows
// them; placement and presentation are unchanged).
//
// Backfill, per case (no order is lost; none silently changes meaning):
//   - pending / ready orders whose campaign clock has current_day equal to
//     current_day_of_year: both scales are the same number in that
//     campaign (it has not crossed a year since its counter started), so
//     the existing values ARE absolute days — copied across unchanged.
//   - pending / ready orders in a campaign whose two scales differ: no
//     year is recorded, so the absolute day cannot be known without
//     guessing. Left NULL; the sweep keeps comparing those rows on the
//     day-of-year scale exactly as before (no change of meaning).
//   - collected / cancelled / expired orders: history only, nothing times
//     them — left NULL.
//
// Runner convention: up(db) + db.execute only, inside the runner's
// transaction. Idempotent: PRAGMA-guarded columns; the backfill touches
// only rows whose absolute columns are still NULL.
async function addColumn(db, table, col, ddl) {
  const cols = await db.execute(`PRAGMA table_info(${table})`);
  const names = (cols.rows || []).map((r) => r.name ?? r[1]);
  if (!names.includes(col)) await db.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

export async function up(db) {
  await addColumn(db, 'merchant_orders', 'deadline_abs_day', 'deadline_abs_day INTEGER');
  await addColumn(db, 'merchant_orders', 'ready_abs_day', 'ready_abs_day INTEGER');

  const sameScale = `(
    SELECT 1 FROM characters ch JOIN world_clock wc ON wc.campaign_id = ch.campaign_id
     WHERE ch.id = merchant_orders.character_id
       AND wc.current_day = wc.current_day_of_year
  )`;
  await db.execute(
    `UPDATE merchant_orders SET deadline_abs_day = deadline_game_day
      WHERE status IN ('pending', 'ready') AND deadline_abs_day IS NULL
        AND deadline_game_day IS NOT NULL AND EXISTS ${sameScale}`
  );
  await db.execute(
    `UPDATE merchant_orders SET ready_abs_day = ready_game_day
      WHERE status = 'ready' AND ready_abs_day IS NULL
        AND ready_game_day IS NOT NULL AND EXISTS ${sameScale}`
  );
}

export async function down(db) {
  // Additive columns; a rollback leaves them in place (repo convention).
}
