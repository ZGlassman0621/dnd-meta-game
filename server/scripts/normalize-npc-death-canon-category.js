#!/usr/bin/env node
/**
 * One-off repair: normalize canon_facts.category 'npc_death' → 'death'.
 *
 * Run: node server/scripts/normalize-npc-death-canon-category.js            (dry run)
 *      node server/scripts/normalize-npc-death-canon-category.js --apply    (writes)
 *
 * DELIBERATELY NOT A MIGRATION, for the same reason as
 * `backfill-character-campaign-id.js`: these rows were not produced by a
 * one-time schema event. `npcLifecycleService.propagateNpcDeath()` wrote
 * category 'npc_death' on every NPC death for the life of the feature, while
 * every reader — `storyChronicleService`'s recent-deaths query, its canon-fact
 * budget sections, and its `NOT IN ('death','promise')` exclusions — queried
 * 'death'. So the orphaned rows accumulated continuously. Migration 056
 * already normalised whatever existed at the time and was recorded as run;
 * this needs to be re-runnable on any database that took writes afterwards.
 *
 * WHAT THE ORPHANED ROWS COST: an NPC death recorded under 'npc_death' is
 * invisible to the DM prompt. The AI keeps referring to a dead NPC as alive,
 * and `syncDeathsFromCanonFacts` cannot reconcile it. The rows are not
 * corrupt — they are correct facts filed under a category nothing reads.
 *
 * SAFETY: the UPDATE is scoped to `category = 'npc_death'` and nothing else.
 * It cannot touch a row already filed as 'death'. It does not delete, and it
 * does not merge — if a subject somehow has both an 'npc_death' row and a
 * 'death' row, both survive the rename and are reported as a collision for a
 * human to look at, because picking a winner is a narrative judgement.
 *
 * Note `narrative_queue.event_type = 'npc_death'` is a DIFFERENT namespace and
 * is left strictly alone. Only `canon_facts.category` is touched.
 */

import db, { dbAll, dbGet, dbRun } from '../database.js';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');

const OLD_CATEGORY = 'npc_death';
const NEW_CATEGORY = 'death';

async function main() {
  console.log('='.repeat(72));
  console.log(
    APPLY
      ? `NORMALIZE canon_facts.category '${OLD_CATEGORY}' → '${NEW_CATEGORY}' — APPLYING`
      : `NORMALIZE canon_facts.category '${OLD_CATEGORY}' → '${NEW_CATEGORY}' — DRY RUN (no writes)`
  );
  console.log('='.repeat(72));

  const stale = await dbAll(
    `SELECT id, campaign_id, character_id, subject, fact, game_day, is_active
     FROM canon_facts
     WHERE category = ?
     ORDER BY id`,
    [OLD_CATEGORY]
  );

  if (!stale.length) {
    console.log(`\nNo canon_facts rows with category '${OLD_CATEGORY}'. Nothing to do.`);
    return;
  }

  console.log(`\nRows to normalize (${stale.length}):\n`);

  const collisions = [];

  for (const row of stale) {
    console.log(`  [${row.id}] campaign=${row.campaign_id} character=${row.character_id} subject="${row.subject}"`);
    console.log(`        active=${row.is_active} game_day=${row.game_day}`);
    console.log(`        ${row.fact}`);

    // A pre-existing 'death' row on the same subject is not an error — the
    // rename is still correct — but a human should know both will be present.
    const existing = await dbGet(
      `SELECT id FROM canon_facts
       WHERE campaign_id IS ? AND character_id IS ? AND subject = ?
         AND category = ? AND is_active = 1`,
      [row.campaign_id, row.character_id, row.subject, NEW_CATEGORY]
    );
    if (existing) {
      console.log(`        ! collision: an active '${NEW_CATEGORY}' fact (id ${existing.id}) already exists`);
      console.log(`          for this subject. Both rows will remain after the rename.`);
      collisions.push({ stale: row.id, existing: existing.id, subject: row.subject });
    }
    console.log('');
  }

  console.log('-'.repeat(72));
  console.log(`Rows to update: ${stale.length}   Subject collisions to review: ${collisions.length}`);

  if (!APPLY) {
    console.log('\nDRY RUN — no changes written. Re-run with --apply to commit.');
    return;
  }

  const res = await dbRun('UPDATE canon_facts SET category = ? WHERE category = ?', [
    NEW_CATEGORY,
    OLD_CATEGORY,
  ]);
  console.log(`\nUPDATE canon_facts SET category='${NEW_CATEGORY}' [rows=${res.changes}]`);

  // Read back — never report success from the write call alone.
  const remaining = await dbGet('SELECT COUNT(*) AS n FROM canon_facts WHERE category = ?', [
    OLD_CATEGORY,
  ]);
  const converted = await dbGet('SELECT COUNT(*) AS n FROM canon_facts WHERE category = ?', [
    NEW_CATEGORY,
  ]);

  console.log('\nVerification:');
  console.log(`  rows still under '${OLD_CATEGORY}': ${remaining?.n ?? '?'}  (expected 0)`);
  console.log(`  rows now under '${NEW_CATEGORY}':   ${converted?.n ?? '?'}`);

  if (Number(remaining?.n ?? -1) !== 0) {
    console.error('\nFAILED: stale rows remain.');
    process.exitCode = 1;
    return;
  }

  if (collisions.length) {
    console.log('\nReview these subjects — each now has more than one active death fact:');
    for (const c of collisions) {
      console.log(`  "${c.subject}": renamed row ${c.stale} alongside existing row ${c.existing}`);
    }
  }
}

main()
  .catch((err) => {
    console.error('\nFAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close?.());
