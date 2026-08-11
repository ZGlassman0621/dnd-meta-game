#!/usr/bin/env node
/**
 * MVP blank slate: delete all gameplay state, keep schema, seed data and the
 * primary user.
 *
 * Run: node server/scripts/purge-gameplay-state.js            (dry run)
 *      node server/scripts/purge-gameplay-state.js --apply    (DESTRUCTIVE)
 *
 * DELIBERATELY NOT A MIGRATION. A migration runs once per database and is then
 * recorded forever; this is an operator action taken at a specific moment for a
 * specific reason (starting the MVP playtest from zero). Recording it in the
 * ledger would mean a rebuilt database silently wipes itself, and it must stay
 * re-runnable besides.
 *
 * WHAT IS PRESERVED, and why each one:
 *
 *   _migrations        the ledger. Deleting it would make every migration
 *                      re-run on next boot — the single most destructive thing
 *                      this script could do by accident.
 *   _app_settings      installation config, not campaign state.
 *   users              accounts. TEST_SCENARIOS is removed by name (a test
 *                      artifact); every real account survives.
 *   themes, theme_abilities, ancestry_feats, team_tactics,
 *   subclass_theme_synergies, mythic_theme_amplifications, achievements
 *                      seed/reference data loaded at boot. Character creation
 *                      and progression read these; wiping them yields a
 *                      database that boots but cannot make a character.
 *
 * EVERYTHING ELSE IS DELETED. That is deliberate and includes npcs,
 * ai_call_log, consequence_log and the dm_mode_* tables — all of which are
 * campaign state or instrumentation, none of which a fresh playtest wants
 * inherited from the previous world.
 *
 * FK ORDERING is resolved by fixpoint rather than by a hand-maintained
 * dependency list: delete every target table, retry the ones that fail, and
 * stop when a full pass makes no progress. Sixteen tables reference
 * `campaigns` alone, and a hand-written order would rot the first time someone
 * adds a table. If the loop stalls it reports exactly which tables are still
 * blocked instead of forcing them.
 */

import db, { dbAll, dbGet, dbRun } from '../database.js';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');

/** Tables that survive the purge untouched. */
const PRESERVE = new Set([
  '_migrations',
  '_app_settings',
  'users',
  'themes',
  'theme_abilities',
  'ancestry_feats',
  'team_tactics',
  'subclass_theme_synergies',
  'mythic_theme_amplifications',
  'achievements',
]);

/** Users deleted by name — test artifacts, not real accounts. */
const PURGE_USERNAMES = ['TEST_SCENARIOS'];

async function tableCounts(tables) {
  const counts = {};
  for (const t of tables) {
    const r = await dbGet(`SELECT COUNT(*) AS n FROM ${t}`).catch(() => ({ n: null }));
    counts[t] = r?.n == null ? null : Number(r.n);
  }
  return counts;
}

async function main() {
  console.log('='.repeat(72));
  console.log(APPLY ? 'PURGE GAMEPLAY STATE — APPLYING (DESTRUCTIVE)' : 'PURGE GAMEPLAY STATE — DRY RUN (no writes)');
  console.log('='.repeat(72));

  const allTables = (
    await dbAll("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  ).map((r) => r.name);

  const targets = allTables.filter((t) => !PRESERVE.has(t));
  const before = await tableCounts(allTables);

  const nonEmptyTargets = targets.filter((t) => before[t] > 0);
  const preservedNonEmpty = [...PRESERVE].filter((t) => before[t] > 0);

  console.log(`\nTables: ${allTables.length} total, ${targets.length} purge targets, ${PRESERVE.size} preserved.`);

  console.log(`\nWill DELETE all rows from ${nonEmptyTargets.length} non-empty table(s):`);
  for (const t of nonEmptyTargets) console.log(`  ${t.padEnd(34)} ${before[t]} row(s)`);
  if (!nonEmptyTargets.length) console.log('  (none — all target tables are already empty)');

  console.log('\nWill PRESERVE:');
  for (const t of preservedNonEmpty) console.log(`  ${t.padEnd(34)} ${before[t]} row(s)`);

  const doomedUsers = await dbAll(
    `SELECT id, username FROM users WHERE username IN (${PURGE_USERNAMES.map(() => '?').join(',')})`,
    PURGE_USERNAMES
  );
  const survivingUsers = await dbAll(
    `SELECT id, username FROM users WHERE username NOT IN (${PURGE_USERNAMES.map(() => '?').join(',')})`,
    PURGE_USERNAMES
  );
  console.log('\nUsers:');
  for (const u of doomedUsers) console.log(`  DELETE  [${u.id}] ${u.username}`);
  for (const u of survivingUsers) console.log(`  KEEP    [${u.id}] ${u.username}`);

  if (!survivingUsers.length) {
    console.error('\nABORT: the purge would leave zero user accounts. Nothing was written.');
    process.exitCode = 1;
    return;
  }

  if (!APPLY) {
    console.log('\nDRY RUN — no changes written. Re-run with --apply to commit.');
    console.log('Take a verified snapshot first: npm run backup');
    return;
  }

  // ---- Fixpoint delete. FK failures are retried, never forced. ----
  console.log('\nDeleting…');
  let remaining = new Set(targets);
  let pass = 0;
  let lastBlocked = [];

  while (remaining.size > 0) {
    pass++;
    const blocked = [];
    let progressed = false;

    for (const t of [...remaining]) {
      try {
        await dbRun(`DELETE FROM ${t}`);
        remaining.delete(t);
        progressed = true;
      } catch (e) {
        blocked.push({ table: t, error: e.message });
      }
    }

    console.log(`  pass ${pass}: ${targets.length - remaining.size}/${targets.length} cleared, ${blocked.length} blocked`);
    lastBlocked = blocked;

    if (!progressed) break;
  }

  if (remaining.size > 0) {
    console.error(`\nSTALLED: ${remaining.size} table(s) could not be emptied. Nothing was forced.`);
    for (const b of lastBlocked) console.error(`  ${b.table}: ${b.error}`);
    process.exitCode = 1;
    return;
  }

  for (const u of doomedUsers) {
    const r = await dbRun('DELETE FROM users WHERE id = ?', [u.id]);
    console.log(`  users: removed [${u.id}] ${u.username} [rows=${r.changes}]`);
  }

  // ---- Read back. Never report success from the write calls alone. ----
  console.log('\nVerification:');
  const after = await tableCounts(allTables);

  const dirty = targets.filter((t) => after[t] > 0);
  if (dirty.length) {
    console.error('  FAILED — these target tables still hold rows:');
    for (const t of dirty) console.error(`    ${t}: ${after[t]}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  all ${targets.length} target table(s) are empty`);

  let preserveOk = true;
  for (const t of PRESERVE) {
    if (t === 'users') continue;
    if (before[t] !== after[t]) {
      console.error(`  FAILED — preserved table ${t} changed: ${before[t]} → ${after[t]}`);
      preserveOk = false;
    }
  }
  if (preserveOk) console.log('  every preserved table is byte-for-byte unchanged');
  else { process.exitCode = 1; return; }

  const users = await dbAll('SELECT id, username FROM users ORDER BY id');
  console.log(`  users remaining: ${users.map((u) => `[${u.id}] ${u.username}`).join(', ')}`);

  console.log('\nBlank slate ready.');
}

main()
  .catch((err) => {
    console.error('\nFAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close?.());
