/**
 * Migration 040: NPC voice palette
 *
 * Adds structured voice data to NPCs so the DM prompt can render
 * age-appropriate, register-specific dialogue instead of generic "NPC voice."
 *
 * voice_palette — JSON string with fields the prompt builder reads:
 *   {
 *     age_descriptor: "child (9)" | "young adult (mid-20s)" | "elder (60s)" | etc.
 *     register: "street slang, clipped" | "formal, measured" | "trade dialect"
 *     speech_patterns: ["trails off mid-thought", "uses 'and then' often"]
 *     mannerisms: ["scratches arm when nervous", "glances away before lying"]
 *     vocabulary: "limited (kid-appropriate)" | "educated (scholarly)" | etc.
 *     forbid: ["long compound sentences", "Latin phrases"]   // things this NPC would never say
 *   }
 *
 * voice_palette_generated_at — ISO timestamp of last generation; used to
 *   skip re-generation when the palette is fresh.
 *
 * interaction_count — running total of player-NPC exchanges, surfaced by
 *   `npcRelationshipService.recordInteraction`. The voice service uses this
 *   to trigger auto-generation once a "minor" NPC crosses the 3-interaction
 *   threshold.
 *
 * Important NPCs (companions, campaign-plan NPCs, quest-givers) get their
 * palette generated immediately at NPC-creation time — they don't wait for
 * the interaction threshold. The service sets this by checking
 * `relationship_to_party` and campaign-plan membership.
 */

export async function up(db) {
  const info = await db.execute(`PRAGMA table_info(npcs)`);
  const cols = new Set(info.rows.map(r => r.name));

  if (!cols.has('voice_palette')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN voice_palette TEXT`);
  }
  if (!cols.has('voice_palette_generated_at')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN voice_palette_generated_at TEXT`);
  }
  if (!cols.has('interaction_count')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN interaction_count INTEGER DEFAULT 0`);
  }

  // Index on interaction_count for efficient "NPCs near the 3-threshold" scans
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_npcs_interaction_count
    ON npcs(interaction_count)
  `);
}

export async function down(db) {
  // SQLite DROP COLUMN requires 3.35+. Leave columns in place on rollback —
  // they're nullable and harmless.
  await db.execute(`DROP INDEX IF EXISTS idx_npcs_interaction_count`);
}
