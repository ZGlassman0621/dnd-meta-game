/**
 * Migration 077: NPC complexity tiers (anti-shelter)
 *
 * Adds the DM-system complexity layer to NPCs. The problem this solves:
 * shelter behavior. The AI defaults to harmony — guards are just guards,
 * every redeemed cultist is genuinely redeemed — and it will not generate
 * suspicion, betrayal, or hidden agendas on its own, even when the player
 * probes for it.
 *
 * The fix: the SYSTEM rolls for complexity at generation time
 * (npcComplexityService.rollComplexityTier, d100 → 20% significant /
 * 60% minor / 20% surface). The AI never decides whether an NPC has a
 * secret. The roll does. The AI only invents the content for the tier it
 * was given, and plays what was rolled.
 *
 * complexity_tier — 'significant' | 'minor' | 'surface'. NULL means the
 *   NPC predates this system; the tier is rolled lazily the next time the
 *   NPC appears (backfill-on-appearance, per Zach 2026-10-19). Once set,
 *   it is permanent — no re-rolls.
 *
 * hidden_agenda — JSON string:
 *   { type, description, stakes, who_else_knows, tells: [] }
 *   For 'surface' tier NPCs this holds an explicit { type: 'none',
 *   description: 'none' } — written, not left blank, so 'nothing here' is
 *   an honest system answer rather than a missing value.
 *
 * agenda_status — 'hidden' | 'hinted' | 'revealed' | 'resolved'. Moves
 *   hidden → hinted on a successful Insight check (the player gets a tell,
 *   never the secret), hinted → revealed only on confrontation/confession,
 *   and to resolved when the agenda plays out — including when the NPC is
 *   killed, in which case the secret surfaces through world consequences
 *   (who_else_knows reacts) rather than dying with them.
 *
 * what_they_want_from_pc — the NPC's goal regarding the player
 *   specifically. The AI plays toward it; it never narrates it.
 *
 * disposition_json — JSON string: { character_id: -100..100 }. Per-
 *   character disposition, replacing reliance on the single flat
 *   relationship_to_party label for attitude. Shifts from actions
 *   (helped them: +, threatened them: −, caught lying: −) — the system
 *   owns the number, the AI plays the attitude.
 *
 * verifier_nudge_count — interaction_count snapshot at the last time the
 *   anti-shelter surfacing verifier fired, so it nudges at most once per
 *   3 interactions for a significant-tier NPC whose agenda is still
 *   'hidden' after 5+ interactions.
 *
 * Player visibility: NONE of these columns is ever shown to the player.
 * complexity_tier in particular must never surface — even 'this NPC seems
 * straightforward' is information.
 */

export async function up(db) {
  const info = await db.execute(`PRAGMA table_info(npcs)`);
  const cols = new Set(info.rows.map(r => r.name));

  if (!cols.has('complexity_tier')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN complexity_tier TEXT`);
  }
  if (!cols.has('hidden_agenda')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN hidden_agenda TEXT`);
  }
  if (!cols.has('agenda_status')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN agenda_status TEXT DEFAULT 'hidden'`);
  }
  if (!cols.has('what_they_want_from_pc')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN what_they_want_from_pc TEXT`);
  }
  if (!cols.has('disposition_json')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN disposition_json TEXT`);
  }
  if (!cols.has('verifier_nudge_count')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN verifier_nudge_count INTEGER DEFAULT 0`);
  }

  // Index for the surfacing verifier scan (significant + hidden + high interactions)
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_npcs_complexity_status
    ON npcs(complexity_tier, agenda_status)
  `);
}

export async function down(db) {
  // SQLite DROP COLUMN requires 3.35+. Leave columns in place on rollback —
  // they're nullable and harmless.
  await db.execute(`DROP INDEX IF EXISTS idx_npcs_complexity_status`);
}
