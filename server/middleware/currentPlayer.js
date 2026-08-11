/**
 * Current-player resolver.
 *
 * This is a solo game that runs on the player's own machine. It used to ship a
 * full account system — register, bcrypt password, JWT login, a Bearer token on
 * every request — an artifact of a build that anticipated multiple users. That
 * came out in v1.0.173; git history is the archive.
 *
 * What could NOT come out with it is the ownership plumbing underneath.
 * `campaigns.user_id` exists (migration 013), and `campaignService` is
 * deliberately written so a caller with no user context leaks nothing:
 *
 *     export async function getAllCampaigns(userId = null) {
 *       if (!userId) return [];              // <-- silent empty list
 *       ...
 *     }
 *
 * `getActiveCampaigns` does the same. So simply deleting `req.user` would not
 * have "removed authentication" — it would have made every campaign vanish from
 * the UI while every request still returned a cheerful 200. That is the exact
 * shape of failure this codebase keeps getting bitten by, so the fix is not to
 * unpick the scoping but to keep feeding it.
 *
 * This middleware therefore still populates `req.user`; it just stops asking
 * anyone to log in. Routes reading `req.user?.id` are untouched.
 */

import { dbGet, dbRun } from '../database.js';

/** Used only when the users table is empty (a freshly built database). */
const DEFAULT_PLAYER_NAME = 'player';

/**
 * Resolved once per process. This runs on EVERY /api request, and the row it
 * reads cannot change while the server is up — there is no longer any code
 * path that creates a second player.
 */
let cachedPlayer = null;

/**
 * Lowest id wins, so the resolution is stable if an old multi-user database
 * still carries more than one row. Creates a default only when there is
 * genuinely nobody, which is the fresh-install case.
 */
async function resolvePlayer() {
  const existing = await dbGet('SELECT id, username FROM users ORDER BY id ASC LIMIT 1');
  if (existing) return existing;

  try {
    const created = await dbRun(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [DEFAULT_PLAYER_NAME, '']
    );
    return { id: Number(created.lastInsertRowid), username: DEFAULT_PLAYER_NAME };
  } catch {
    // `users.username` is UNIQUE, so two first-requests racing here means the
    // other one won. Re-read rather than failing the request.
    return await dbGet('SELECT id, username FROM users ORDER BY id ASC LIMIT 1');
  }
}

export default async function currentPlayer(req, res, next) {
  if (cachedPlayer) {
    req.user = cachedPlayer;
    return next();
  }

  try {
    const player = await resolvePlayer();
    if (player) {
      cachedPlayer = player;
      req.user = player;
    } else {
      // Not reachable via resolvePlayer's own logic, but worth shouting about
      // rather than continuing into the silent-empty-campaign-list failure.
      console.error('[current-player] no player row could be resolved — campaign lists will be empty');
    }
  } catch (err) {
    // Deliberately non-fatal. If the database is unreachable, every route is
    // already going to fail on its own query; 500-ing here as well would just
    // replace a specific error with a confusing generic one. Loud, not silent.
    console.error('[current-player] resolution failed — campaign lists will be empty:', err.message);
  }

  next();
}
