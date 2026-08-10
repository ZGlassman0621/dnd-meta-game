import { dbGet } from '../database.js';

/**
 * Primary-character resolution for campaign-scoped world state.
 *
 * The living world attributes what it produces — world events, faction
 * quests, NPC mail, consequences, merchant orders, base threats — to *a*
 * character in the campaign. Every one of those call sites used to resolve
 * that character with:
 *
 *     SELECT id FROM characters WHERE campaign_id = ? LIMIT 1
 *
 * which is wrong in three separate ways:
 *
 *   1. No ORDER BY. SQLite's row order without one is an implementation
 *      detail, so which character receives the campaign's world state can
 *      change between two runs of the same tick, and can differ between the
 *      six call sites *inside a single tick* — one step queues mail to
 *      character A while the next queues a threat warning to character B.
 *   2. No creation_phase filter. An abandoned creator draft or an in-flight
 *      prelude row is a `characters` row like any other, so a half-finished
 *      character can be handed the campaign's world state. That surfaces much
 *      later as narrative-queue entries the player never sees, on a character
 *      they never finished making.
 *   3. No is_dead filter. A dead PC keeps collecting mail and quest offers.
 *
 * The fix is a single predicate applied everywhere. `ORDER BY id ASC` makes
 * the pick deterministic and stable — the campaign's oldest still-playable
 * character. There is no `last_played` column on `characters` to order by;
 * `id` is the only monotonic thing available, and for a solo game (one
 * playable character per campaign) it resolves the same row every time.
 *
 * COALESCE guards both columns because both were added by later migrations
 * (`creation_phase` in 042, `is_dead` in 061) and NULL fails a bare `= 0`
 * comparison in SQL — a NULL means "predates the column", i.e. active/alive.
 *
 * Related: `server/scripts/backfill-character-campaign-id.js`, which refuses
 * to enrol abandoned drafts into a campaign for exactly this reason.
 */
export const PLAYABLE_CHARACTER_PREDICATE =
  `COALESCE(creation_phase, 'active') = 'active' AND COALESCE(is_dead, 0) = 0`;

/**
 * The character that owns a campaign's world state, or null if the campaign
 * has no playable character (all drafts, all dead, or empty).
 *
 * Callers must handle null — a campaign with nothing but drafts is a real
 * state, and skipping a tick step is the correct response to it.
 *
 * @param {number} campaignId
 * @returns {Promise<object|null>} full character row
 */
export async function getPrimaryCharacter(campaignId) {
  if (!campaignId) return null;
  return dbGet(
    `SELECT * FROM characters
     WHERE campaign_id = ? AND ${PLAYABLE_CHARACTER_PREDICATE}
     ORDER BY id ASC
     LIMIT 1`,
    [campaignId]
  );
}

/**
 * Convenience wrapper for the common case: just the id.
 *
 * @param {number} campaignId
 * @returns {Promise<number|null>}
 */
export async function getPrimaryCharacterId(campaignId) {
  const row = await getPrimaryCharacter(campaignId);
  return row ? row.id : null;
}
