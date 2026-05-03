/**
 * Campaign canon transfer — copies Prelude-derived canon data into the
 * active-campaign tables when a character submits handoff (transitions
 * from `'ready_for_primary'` to `'active'`).
 *
 * Per PHASE_2_CREATOR_SPEC.md §8.2.2 step 5:
 *   Persist canon_npcs, canon_locations, canon_threads into the
 *   campaign's tables.
 *
 * Tables involved:
 *   prelude_canon_npcs       → npcs            (campaign-side NPC roster)
 *   prelude_canon_locations  → locations       (campaign-side location roster)
 *   prelude_canon_threads    → campaign_threads (already same table — just
 *                                                  re-flag with source='prelude')
 *
 * Mentor imprints (mentor_imprints table) are already seeded by the
 * Prelude transition service when [PRELUDE_END] fires (chunk 2 work);
 * no additional work needed at submit.
 *
 * Campaign linkage (campaign_id):
 *   Per CONSOLIDATED_TODO parking lot, primary-campaign auto-generation
 *   at handoff submit (per v4 plan §6 step 4) is deferred. Today, when
 *   a character flips to 'active' there's no associated campaign yet —
 *   the player creates/assigns a campaign manually via the existing
 *   /api/campaign endpoints.
 *
 *   So canon transfer leaves `campaign_id` NULL on the new rows. When
 *   the player later creates or assigns a campaign, a follow-up
 *   linkage step (separate sub-chunk) updates these rows. Until then
 *   the data is preserved-but-orphaned — no data loss, just no campaign
 *   binding.
 *
 * Idempotency:
 *   Submit can be retried (network failure mid-handoff) — the transfer
 *   needs to not duplicate. We tag transferred rows with a
 *   `prelude_canon_id` reference (npcs.background_notes embeds it; same
 *   for locations) so re-runs can detect prior transfers. Implementation:
 *   each row's `background_notes` (npcs) / `description` (locations) is
 *   prefixed with `[from prelude_canon_npcs#<id>]` so a second run can
 *   skip already-transferred entries.
 *
 *   This is a low-tech idempotency check that doesn't require a schema
 *   change. A future migration could add a dedicated `source_prelude_canon_id`
 *   column for cleaner detection; for Phase 2 ship the prefix-marker
 *   is sufficient.
 */

import { dbAll, dbRun, dbGet } from '../database.js'

const PRELUDE_NPC_MARKER = '[prelude_canon_npc#'
const PRELUDE_LOCATION_MARKER = '[prelude_canon_location#'

/**
 * Run the canon transfer for a character on handoff submit. Idempotent —
 * skips entries that have already been transferred (detected via the
 * marker in background_notes / description).
 *
 * Returns: { npcs_transferred, locations_transferred, threads_transferred,
 *            skipped_npcs, skipped_locations, skipped_threads }
 */
export async function transferCanonToCampaign(characterId) {
  const result = {
    npcs_transferred: 0,
    locations_transferred: 0,
    threads_transferred: 0,
    skipped_npcs: 0,
    skipped_locations: 0,
    skipped_threads: 0
  }

  // --- NPCs ---
  const canonNpcs = await dbAll(
    `SELECT id, name, relationship, age_at_prelude_end, description, status, first_appeared_age
     FROM prelude_canon_npcs WHERE character_id = ? ORDER BY id`,
    [characterId]
  )
  for (const npc of canonNpcs) {
    const marker = `${PRELUDE_NPC_MARKER}${npc.id}]`
    // Idempotency check: any npc whose background_notes contains the
    // marker has already been transferred from this canon row.
    const existing = await dbGet(
      `SELECT id FROM npcs WHERE background_notes LIKE ? LIMIT 1`,
      [`%${marker}%`]
    )
    if (existing) { result.skipped_npcs++; continue }

    const backgroundNotes = `${marker} ${npc.description || ''}`.trim()
    const ageStr = npc.age_at_prelude_end != null
      ? `${npc.age_at_prelude_end} (at character's prelude end)`
      : null

    await dbRun(
      `INSERT INTO npcs (
        name, race, age, status,
        background_notes, relationship_to_party, current_location
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        npc.name,
        'Unknown',  // npcs.race is NOT NULL; canonical race tracking is a future enrichment
        ageStr,
        npc.status || 'alive',
        backgroundNotes,
        npc.relationship,
        null  // current_location resolves later when locations transfer
      ]
    )
    result.npcs_transferred++
  }

  // --- Locations ---
  const canonLocations = await dbAll(
    `SELECT id, name, type, description, is_home FROM prelude_canon_locations
     WHERE character_id = ? ORDER BY id`,
    [characterId]
  )
  for (const loc of canonLocations) {
    const marker = `${PRELUDE_LOCATION_MARKER}${loc.id}]`
    const existing = await dbGet(
      `SELECT id FROM locations WHERE description LIKE ? LIMIT 1`,
      [`%${marker}%`]
    )
    if (existing) { result.skipped_locations++; continue }

    const description = `${marker} ${loc.description || ''}`.trim()
    // location_type defaults to 'settlement' in the npcs table; map a few
    // common Prelude types onto the closest active-table value.
    const locationType = mapLocationType(loc.type)

    await dbRun(
      `INSERT INTO locations (name, description, location_type)
       VALUES (?, ?, ?)`,
      [loc.name, description, locationType]
    )
    result.locations_transferred++
  }

  // --- Threads (campaign_threads already exists; re-tag with the
  // submitted character's id and source='prelude' if not already there) ---
  const canonThreads = await dbAll(
    `SELECT id, kind, weight, subject_npc_id, subject_location_id,
            subject_text, condition, character_id
     FROM prelude_canon_threads WHERE character_id = ? ORDER BY id`,
    [characterId]
  )
  for (const thread of canonThreads) {
    const existing = await dbGet(
      `SELECT id FROM campaign_threads
       WHERE character_id = ? AND source = 'prelude' AND source_thread_id = ?
       LIMIT 1`,
      [characterId, thread.id]
    )
    if (existing) { result.skipped_threads++; continue }

    await dbRun(
      `INSERT INTO campaign_threads (
        character_id, source, source_thread_id, kind,
        subject_npc_id, subject_location_id, subject_text,
        condition, weight, status
      ) VALUES (?, 'prelude', ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        characterId,
        thread.id,
        thread.kind,
        thread.subject_npc_id,
        thread.subject_location_id,
        thread.subject_text,
        thread.condition,
        thread.weight || 'notable'
      ]
    )
    result.threads_transferred++
  }

  return result
}

/**
 * Map Prelude location type strings to the active-table location_type
 * enum. Falls back to 'settlement' (the active-table default) for
 * anything unrecognized — keeps the transfer non-lossy at the cost of
 * some imprecision in the campaign-side categorization.
 */
function mapLocationType(preludeType) {
  if (!preludeType) return 'settlement'
  const lower = String(preludeType).toLowerCase().trim()
  if (lower.includes('village') || lower.includes('hamlet') || lower.includes('town') || lower.includes('city')) return 'settlement'
  if (lower.includes('forest') || lower.includes('mountain') || lower.includes('plain') || lower.includes('marsh')) return 'wilderness'
  if (lower.includes('ruin') || lower.includes('dungeon') || lower.includes('cave')) return 'dungeon'
  if (lower.includes('temple') || lower.includes('shrine')) return 'landmark'
  if (lower.includes('road') || lower.includes('crossing') || lower.includes('battlefield')) return 'landmark'
  return 'settlement'
}
