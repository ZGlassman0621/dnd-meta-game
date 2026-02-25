/**
 * Auth Service — User registration, login, and JWT token management.
 * Passwords hashed with bcryptjs, tokens signed with auto-generated JWT secret.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { dbGet, dbRun, dbAll } from '../database.js';

const TOKEN_EXPIRY = '30d'; // Long-lived for personal use

/**
 * Get or create the JWT secret. Stored in _app_settings table so it
 * persists across restarts without requiring manual .env configuration.
 */
async function getJwtSecret() {
  // Prefer env var if explicitly set
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  // Check DB for stored secret
  const row = await dbGet("SELECT value FROM _app_settings WHERE key = 'jwt_secret'");
  if (row) return row.value;

  // Generate and store a new secret
  const secret = crypto.randomBytes(64).toString('hex');
  await dbRun(
    "INSERT INTO _app_settings (key, value) VALUES ('jwt_secret', ?)",
    [secret]
  );
  return secret;
}

// Cache the secret after first load
let _cachedSecret = null;
async function secret() {
  if (!_cachedSecret) _cachedSecret = await getJwtSecret();
  return _cachedSecret;
}

/**
 * Register a new user. Auto-claims all existing campaigns with user_id IS NULL.
 */
export async function register(username, password, displayName) {
  if (!username || username.length < 3) {
    throw Object.assign(new Error('Username must be at least 3 characters'), { status: 400 });
  }
  if (!password || password.length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });
  }

  // Check uniqueness
  const existing = await dbGet('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);
  if (existing) {
    throw Object.assign(new Error('Username already taken'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await dbRun(
    'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
    [username, passwordHash, displayName || null]
  );
  const userId = Number(result.lastInsertRowid);

  // Auto-claim unclaimed campaigns
  await dbRun('UPDATE campaigns SET user_id = ? WHERE user_id IS NULL', [userId]);
  const claimed = await dbAll('SELECT id FROM campaigns WHERE user_id = ?', [userId]);

  const user = { id: userId, username, display_name: displayName || null };
  const token = jwt.sign({ userId, username }, await secret(), { expiresIn: TOKEN_EXPIRY });

  return { user, token, claimedCampaigns: claimed.length };
}

/**
 * Log in an existing user.
 */
export async function login(username, password) {
  if (!username || !password) {
    throw Object.assign(new Error('Username and password are required'), { status: 400 });
  }

  const user = await dbGet('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
  if (!user) {
    throw Object.assign(new Error('Invalid username or password'), { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid username or password'), { status: 401 });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    await secret(),
    { expiresIn: TOKEN_EXPIRY }
  );

  return {
    user: { id: user.id, username: user.username, display_name: user.display_name },
    token
  };
}

/**
 * Verify a JWT token. Returns decoded payload or throws.
 */
export async function verifyToken(token) {
  return jwt.verify(token, await secret());
}

/**
 * Look up a user by ID (for middleware).
 */
export async function getUserById(id) {
  const user = await dbGet('SELECT id, username, display_name, created_at FROM users WHERE id = ?', [id]);
  return user;
}
