#!/usr/bin/env node
/**
 * One-off repair: assign campaign_id to orphaned character rows.
 *
 * Run: node server/scripts/backfill-character-campaign-id.js            (dry run)
 *      node server/scripts/backfill-character-campaign-id.js --apply    (writes)
 *
 * DELIBERATELY NOT A MIGRATION. `characters.campaign_id` is not set on the
 * default creation path (see CLAUDE.md, "Known structural debt"), so orphans
 * are an ongoing production of a live bug, not a one-time schema event. A
 * migration runs once per database and is then recorded forever; this needs to
 * be re-runnable on demand, and it needs a human reading its dry run before it
 * writes. It is idempotent and safe to run repeatedly.
 *
 * WHY THE DRAFT DISTINCTION MATTERS (the reason this script is not a one-line
 * UPDATE): `campaign_id` is not a label, it is enrolment in the living world.
 * `livingWorldService.js` picks the character it attributes world events,
 * faction quests, NPC mail, base threats and consequences to with:
 *
 *     SELECT id FROM characters WHERE campaign_id = ? LIMIT 1
 *
 * There is no ORDER BY and no creation_phase filter. Enrolling an abandoned
 * half-finished creator draft therefore makes that draft eligible to receive
 * the campaign's world state on an arbitrary row pick — a corruption that
 * surfaces much later as world events attributed to a character the player
 * never finished making, and one that would be very hard to trace back here.
 *
 * So the policy is:
 *   - PLAY CHARACTERS (finished, or carrying any play history) get enrolled.
 *   - ABANDONED DRAFTS (creation_phase 'creating'/'prelude_setup' with zero
 *     play history) are reported and SKIPPED. They are inert while orphaned;
 *     enrolling them is what would cause harm. Override with --include-drafts
 *     only if you have decided a specific draft is genuinely a real character.
 *
 * Target campaign resolution, in order:
 *   1. --campaign <id>            explicit, verified to exist
 *   2. the character's user has exactly one campaign  → use it
 *   3. --create-legacy            create/reuse a "Legacy Campaign" bucket
 * If none applies the character is reported and skipped rather than guessed at.
 */

import db, { dbAll, dbGet, dbRun } from '../database.js';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => {
  const i = argv.indexOf(f);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
};

const APPLY = has('--apply');
const INCLUDE_DRAFTS = has('--include-drafts');
const CREATE_LEGACY = has('--create-legacy');
const FORCE_CAMPAIGN = valueOf('--campaign');

// creation_phase values that mean "the wizard never finished this row".
const DRAFT_PHASES = new Set(['creating', 'prelude_setup']);

/** Count rows that prove a character has actually been played. */
async function playHistory(characterId) {
  const tables = [
    ['dm_sessions', 'character_id'],
    ['story_chronicles', 'character_id'],
    ['quests', 'character_id'],
    ['canon_facts', 'character_id'],
    ['npc_relationships', 'character_id'],
    ['narrative_queue', 'character_id'],
  ];
  const counts = {};
  let total = 0;
  for (const [table, col] of tables) {
    try {
      const row = await dbGet(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`, [characterId]);
      const n = Number(row?.n || 0);
      if (n) counts[table] = n;
      total += n;
    } catch {
      // Table may not exist on an older database — absence is not history.
    }
  }
  return { total, counts };
}

async function resolveLegacyCampaign(userId, apply) {
  const existing = await dbGet(
    "SELECT id, name FROM campaigns WHERE name = 'Legacy Campaign' AND user_id = ?",
    [userId]
  );
  if (existing) return existing.id;
  if (!apply) return null; // dry run: nothing created yet
  const res = await dbRun(
    `INSERT INTO campaigns (name, description, user_id, status, setting, tone)
     VALUES (?, ?, ?, 'active', ?, ?)`,
    [
      'Legacy Campaign',
      'Holding campaign for characters created before campaign_id was assigned at creation.',
      userId,
      'Unspecified',
      'Unspecified',
    ]
  );
  return Number(res.lastInsertRowid);
}

async function main() {
  console.log('='.repeat(72));
  console.log(APPLY ? 'BACKFILL character.campaign_id — APPLYING' : 'BACKFILL character.campaign_id — DRY RUN (no writes)');
  console.log('='.repeat(72));

  const campaigns = await dbAll('SELECT id, name, user_id, status FROM campaigns ORDER BY id');
  console.log(`\nCampaigns (${campaigns.length}):`);
  for (const c of campaigns) {
    console.log(`  [${c.id}] ${c.name}  user_id=${c.user_id}  status=${c.status}`);
  }

  if (FORCE_CAMPAIGN && !campaigns.some((c) => String(c.id) === String(FORCE_CAMPAIGN))) {
    console.error(`\nERROR: --campaign ${FORCE_CAMPAIGN} does not exist. Aborting.`);
    process.exitCode = 1;
    return;
  }

  const orphans = await dbAll(
    `SELECT id, name, level, race, class, creation_phase, prelude_completed, game_day,
            created_at, updated_at
     FROM characters
     WHERE campaign_id IS NULL
     ORDER BY id`
  );

  if (!orphans.length) {
    console.log('\nNo characters with a NULL campaign_id. Nothing to do.');
    return;
  }

  console.log(`\nOrphaned characters (${orphans.length}):\n`);

  const planned = [];
  const skipped = [];

  for (const ch of orphans) {
    const hist = await playHistory(ch.id);
    const isDraft = DRAFT_PHASES.has(ch.creation_phase) && hist.total === 0;
    const histText = hist.total
      ? Object.entries(hist.counts).map(([t, n]) => `${t}=${n}`).join(', ')
      : 'none';

    console.log(`  [${ch.id}] ${ch.name} — ${ch.race}/${ch.class} L${ch.level}`);
    console.log(`        creation_phase=${ch.creation_phase}  game_day=${ch.game_day}  created=${ch.created_at}`);
    console.log(`        play history: ${histText}`);

    if (isDraft && !INCLUDE_DRAFTS) {
      console.log('        → SKIP: abandoned creator draft, no play history.');
      console.log('          Enrolling it would make it eligible for world-event attribution');
      console.log('          via livingWorldService\'s unordered "LIMIT 1" character pick.');
      console.log('          Use --include-drafts to override, or delete the row.\n');
      skipped.push({ ch, reason: 'abandoned draft' });
      continue;
    }

    // Resolve a target campaign for this character.
    let target = FORCE_CAMPAIGN ? Number(FORCE_CAMPAIGN) : null;
    let how = target ? '--campaign' : null;

    if (!target) {
      // A character row has no user_id column; infer via the sole campaign
      // owner when the installation is unambiguous.
      const candidates = campaigns.filter((c) => c.status === 'active');
      if (candidates.length === 1) {
        target = candidates[0].id;
        how = 'sole active campaign';
      }
    }

    if (!target && CREATE_LEGACY) {
      const userId = campaigns[0]?.user_id ?? 1;
      target = await resolveLegacyCampaign(userId, APPLY);
      how = target ? 'Legacy Campaign' : 'Legacy Campaign (would be created)';
    }

    if (!target) {
      console.log('        → SKIP: could not resolve a target campaign unambiguously.');
      console.log('          Re-run with --campaign <id> or --create-legacy.\n');
      skipped.push({ ch, reason: 'no unambiguous campaign' });
      continue;
    }

    console.log(`        → ASSIGN campaign_id=${target} (${how})\n`);
    planned.push({ ch, target });
  }

  console.log('-'.repeat(72));
  console.log(`Planned assignments: ${planned.length}   Skipped: ${skipped.length}`);

  if (!planned.length) {
    console.log('\nNothing to write.');
    return;
  }

  if (!APPLY) {
    console.log('\nDRY RUN — no changes written. Re-run with --apply to commit.');
    return;
  }

  for (const { ch, target } of planned) {
    const res = await dbRun(
      'UPDATE characters SET campaign_id = ? WHERE id = ? AND campaign_id IS NULL',
      [target, ch.id]
    );
    console.log(`  updated character ${ch.id} (${ch.name}) → campaign_id=${target} [rows=${res.changes}]`);
  }

  // Read back — never report success from the write call alone.
  console.log('\nVerification:');
  for (const { ch, target } of planned) {
    const row = await dbGet('SELECT id, name, campaign_id FROM characters WHERE id = ?', [ch.id]);
    const ok = Number(row?.campaign_id) === Number(target);
    console.log(`  [${row.id}] ${row.name} campaign_id=${row.campaign_id} ${ok ? 'OK' : 'MISMATCH'}`);
    if (!ok) process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('\nFAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close?.());
