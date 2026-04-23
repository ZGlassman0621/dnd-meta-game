/**
 * Migration 044: Prelude committed theme
 *
 * v1.0.77. Stores the theme the player COMMITS to at Chapter 3 wrap-up,
 * shaping the Chapter 4 departure and carrying forward as the primary
 * campaign's theme at phase-5 transition.
 *
 * Flow:
 *   1. Throughout Ch1-2, character-shaping choices fire [THEME_HINT]
 *      markers (existing system — prelude_emergences rows, chapter-weighted
 *      tally in preludeEmergenceService).
 *   2. Ch3 opens with chapter_promise, plays out with real decisions /
 *      real combat, and ends with an irreversible-act chapter_end_moment.
 *   3. AT THAT WRAP-UP, the AI emits [THEME_COMMITMENT_OFFERED: ...] with
 *      the leading trajectory winner plus 3 alternatives plus a wildcard
 *      plus "Other" (full list). UI renders a Choose Your Path card.
 *   4. Player picks → `POST /api/prelude/:id/commit-theme` writes these
 *      two columns.
 *   5. Ch4's engagement-mode block reads `prelude_committed_theme` and
 *      uses the theme→departure map (soldier→enlistment, acolyte→
 *      pilgrimage, etc.). Tone preset modulates register, theme drives
 *      departure type.
 *
 * Nullable because (a) characters pre-Ch3 haven't had the commitment
 * moment yet, (b) the player may defer commitment ("See where it goes")
 * in which case the emergence system's trajectory winner serves as
 * fallback at prelude end.
 *
 * Indexed on character_id for fast joins to the characters table.
 */

export async function up(db) {
  // Columns live on the `characters` table (same pattern as
  // prelude_age/prelude_chapter/prelude_setup_data). Nullable.
  await db.execute(`ALTER TABLE characters ADD COLUMN prelude_committed_theme TEXT`);
  await db.execute(`ALTER TABLE characters ADD COLUMN prelude_committed_theme_at TEXT`);
}

export async function down(db) {
  // SQLite pre-3.35 doesn't support DROP COLUMN cleanly; we take the
  // no-op-on-down approach used elsewhere in this project since we're not
  // doing production rollbacks at this stage.
}
