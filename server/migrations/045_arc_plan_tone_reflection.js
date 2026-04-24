/**
 * Migration 045: prelude_arc_plans.tone_reflection
 *
 * v1.0.81 hotfix for v1.0.79/80's tone card.
 *
 * Opus now emits a `tone_reflection` field in its arc-plan JSON (2-3
 * sentences showing how it interpreted the tone preset for THIS
 * character's arc). The client renders it as the primary content of
 * the Tone card in PreludeArcPreview.
 *
 * But the storage layer was missing a column — the arc plan is
 * persisted in NORMALIZED columns (home_world, chapter_1_arc, etc.),
 * not a single JSON blob. So the tone_reflection field was being
 * silently dropped on INSERT, and the Tone card always fell back to
 * the "was generated before tone reflection was added" note.
 *
 * This migration adds the column. Nullable — old arc plans (created
 * before this migration) simply have NULL, and the UI's fallback path
 * still handles them correctly.
 */

export async function up(db) {
  await db.execute(`ALTER TABLE prelude_arc_plans ADD COLUMN tone_reflection TEXT`);
}

export async function down(db) {
  // SQLite pre-3.35 doesn't support DROP COLUMN cleanly; no-op on down
  // per this project's convention.
}
