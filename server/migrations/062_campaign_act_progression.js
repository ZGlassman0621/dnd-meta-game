/**
 * Migration 062: Campaign act progression (Phase 4)
 *
 * Renumbered from 055 on 2026-08-10 — see migration 061's header.
 *
 * `campaignPlanService.getPlanSummaryForSession` hardcoded
 * `plan.main_quest.acts[0]`, so however many acts a campaign plan defined, the
 * DM prompt described Act 1 forever. The main arc could not advance — a
 * campaign generated with a three-act structure ran act one indefinitely.
 *
 * The act list itself lives inside the `campaign_plan` JSON blob, which is
 * regenerated wholesale by the plan generator. Storing the *pointer* as a
 * separate scalar column keeps progress from being clobbered by a plan rewrite
 * and makes "which act are we in" queryable without parsing JSON.
 *
 *  - current_act_index: 0-based index into main_quest.acts. Defaults to 0, so
 *    every existing campaign keeps exactly the behaviour it has today.
 *
 * Reads are clamped to the acts array at call time rather than constrained
 * here: the column outlives any particular plan, and a plan regenerated with
 * fewer acts would otherwise leave the pointer dangling.
 *
 * Additive and idempotent via PRAGMA table_info, matching migration 061.
 */

export async function up(db) {
  const cols = [
    {
      col: 'current_act_index',
      sql: 'ALTER TABLE campaigns ADD COLUMN current_act_index INTEGER DEFAULT 0'
    }
  ];

  const existing = await db.execute('PRAGMA table_info(campaigns)');
  const existingNames = new Set(existing.rows.map(r => r.name));

  for (const { col, sql } of cols) {
    if (!existingNames.has(col)) {
      await db.execute(sql);
    }
  }
}

export async function down(db) {
  // SQLite can't drop columns without rebuilding the table. No-op, matching
  // the convention established by migration 030.
}
