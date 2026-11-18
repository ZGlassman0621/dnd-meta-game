/**
 * S1 campaign gate (2026-11-17, brief docs/pm/s1-campaign-at-creation/BRIEF.md).
 *
 * Play requires a campaign. A character with no campaign (characters.campaign_id
 * is NULL, or points at a campaign row that no longer exists) cannot start or
 * drive a DM session: without a campaign there is no session memory (the
 * chronicle refuses to write), no shop (merchants are per campaign), and the
 * clock falls back to the shared world row. The client closes Play for such a
 * character; these helpers make the server refuse too, because routes are
 * callable directly.
 *
 * Gate, don't invent: nothing here creates or attaches a campaign. Character
 * creation is unchanged and still does not set campaign_id; the player joins
 * through the existing New Campaign / attach flow.
 *
 * The Prelude (post-MVP) is exempt by construction, not by a flag: its sessions
 * run through server/routes/prelude.js, a separate router that never touches the
 * clock, the chronicle or the shop. A Prelude session id sent to these DM
 * routes is refused like any other campaign-less session.
 */
import { dbGet } from '../database.js';

export const CAMPAIGN_REQUIRED_CODE = 'CAMPAIGN_REQUIRED';
export const CAMPAIGN_REQUIRED_MESSAGE = 'This character is not in a campaign. Create or join a campaign to play.';

/**
 * The character's campaign, if it really exists.
 * @returns {Promise<{found: boolean, campaignId: number|null}>}
 */
export async function campaignForCharacter(characterId) {
  const row = await dbGet(
    `SELECT c.campaign_id, cp.id AS campaign_row
       FROM characters c LEFT JOIN campaigns cp ON cp.id = c.campaign_id
      WHERE c.id = ?`,
    [characterId]
  );
  if (!row) return { found: false, campaignId: null };
  return { found: true, campaignId: row.campaign_row != null ? row.campaign_id : null };
}

/** The 409 body every refusal sends: plain words, plus a code the client can key on. */
export function campaignRequiredBody(characterId) {
  return { error: CAMPAIGN_REQUIRED_MESSAGE, code: CAMPAIGN_REQUIRED_CODE, characterId: characterId ?? null };
}

/**
 * Express middleware for `/:sessionId/...` DM routes that play, shop, move time
 * or record memory. An unknown session falls through to the route's own 404.
 */
export async function requireSessionCampaign(req, res, next) {
  try {
    const session = await dbGet('SELECT character_id FROM dm_sessions WHERE id = ?', [req.params.sessionId]);
    if (!session) return next();
    const { campaignId } = await campaignForCharacter(session.character_id);
    if (campaignId == null) return res.status(409).json(campaignRequiredBody(session.character_id));
    return next();
  } catch (error) {
    console.error('[campaign gate] check failed:', error.message);
    return res.status(500).json({ error: 'Could not check whether this character is in a campaign' });
  }
}
