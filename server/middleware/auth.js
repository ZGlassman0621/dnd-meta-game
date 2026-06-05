/**
 * Auth Middleware — DISABLED for the single-player local MVP.
 *
 * Login was removed in the MVP reduction. Instead of verifying a JWT, this
 * middleware resolves the single local user (the first row in `users`, creating
 * one if the table is empty) and attaches it as req.user on every request, so
 * all existing user-scoped data (campaigns, characters) continues to resolve.
 *
 * To restore real authentication, revert this file to the JWT version preserved
 * in the "Safety snapshot" git commit and re-enable the LoginPage gate in the
 * client.
 */

import { dbGet, dbRun } from '../database.js';

let cachedUser = null;

async function getOrCreateLocalUser() {
  if (cachedUser) return cachedUser;
  let user = await dbGet('SELECT id, username FROM users ORDER BY id ASC LIMIT 1');
  if (!user) {
    const result = await dbRun(
      'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
      ['local', '', 'Local Player']
    );
    const id = Number(result.lastInsertRowid);
    // Claim any unowned campaigns for the local user.
    await dbRun('UPDATE campaigns SET user_id = ? WHERE user_id IS NULL', [id]);
    user = { id, username: 'local' };
  }
  cachedUser = { id: user.id, username: user.username };
  return cachedUser;
}

export default async function authMiddleware(req, res, next) {
  try {
    req.user = await getOrCreateLocalUser();
    next();
  } catch (err) {
    next(err);
  }
}
