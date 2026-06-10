/**
 * In-process integration harness for the DM-session routes.
 *
 * Mounts the REAL server/routes/dmSession.js router on an ephemeral localhost
 * port (no full server boot, no port 3000), so tests can exercise /message,
 * /claim, etc. end-to-end against the real DB and marker pipeline. Pair with
 * installMockAnthropic() (helpers/mockAnthropic.js) so no real Anthropic calls
 * are made.
 *
 * The handlers under test resolve the character from the session row, so no auth
 * user is required (MVP auth is a no-op single-local-user resolver anyway).
 *
 * Conventions: seeds TEST_-prefixed rows and cleans them up per run, per the
 * repo testing discipline. Real Turso/SQLite DB (whatever the env configures).
 */

import http from 'node:http';
import express from 'express';
import dmRouter from '../../server/routes/dmSession.js';
import { dbRun, dbGet } from '../../server/database.js';

/** Start an ephemeral HTTP server mounting the dm-session router. */
export async function startTestApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/dm-session', dmRouter);

  const server = await new Promise((resolve) => {
    const s = http.createServer(app).listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    async request(method, path, body) {
      const res = await globalThis.fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      let json = null;
      try { json = await res.json(); } catch { /* non-JSON / empty */ }
      return { status: res.status, body: json };
    },
    close() { return new Promise((r) => server.close(r)); }
  };
}

/** Insert a minimal valid TEST_ character. Returns its numeric id. */
export async function seedCharacter(overrides = {}) {
  const c = {
    name: 'TEST_Hero',
    class: 'Fighter',
    level: 5,
    current_hp: 40,
    max_hp: 40,
    current_location: 'TEST_Town',
    experience_to_next_level: 14000,
    experience: 0,
    gold_cp: 0,
    gold_sp: 0,
    gold_gp: 0,
    inventory: '[]',
    ...overrides
  };
  const r = await dbRun(
    `INSERT INTO characters
       (name, class, level, current_hp, max_hp, current_location,
        experience_to_next_level, experience, gold_cp, gold_sp, gold_gp, inventory)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [c.name, c.class, c.level, c.current_hp, c.max_hp, c.current_location,
     c.experience_to_next_level, c.experience, c.gold_cp, c.gold_sp, c.gold_gp, c.inventory]
  );
  return Number(r.lastInsertRowid);
}

/** Insert a TEST_ dm_session for a character. Returns its numeric id. */
export async function seedSession(characterId, overrides = {}) {
  const s = {
    status: 'active',
    messages: '[]',
    session_config: '{}',
    rewards: null,
    rewards_claimed: 0,
    hp_change: 0,
    model: 'opus',
    session_type: 'player',
    rolling_summary: null,
    rolling_summary_through_index: null,
    transcript: null,
    title: 'TEST_Session',
    ...overrides
  };
  const r = await dbRun(
    `INSERT INTO dm_sessions
       (character_id, status, messages, session_config, rewards, rewards_claimed,
        hp_change, model, session_type, rolling_summary, rolling_summary_through_index,
        transcript, title)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [characterId, s.status, s.messages, s.session_config, s.rewards, s.rewards_claimed,
     s.hp_change, s.model, s.session_type, s.rolling_summary, s.rolling_summary_through_index,
     s.transcript, s.title]
  );
  return Number(r.lastInsertRowid);
}

export async function getSessionRow(sessionId) {
  return dbGet('SELECT * FROM dm_sessions WHERE id = ?', [sessionId]);
}

export async function getCharacterRow(characterId) {
  return dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
}

/** Best-effort teardown of seeded TEST_ rows + their aux rows. */
export async function cleanup({ characterIds = [], sessionIds = [] }) {
  const swallow = (p) => p.catch(() => {});
  for (const id of sessionIds) {
    await swallow(dbRun('DELETE FROM ai_call_log WHERE session_id = ?', [id]));
    await swallow(dbRun('DELETE FROM session_message_summaries WHERE session_id = ?', [id]));
    await swallow(dbRun('DELETE FROM dm_sessions WHERE id = ?', [id]));
  }
  for (const id of characterIds) {
    await swallow(dbRun('DELETE FROM companions WHERE recruited_by_character_id = ?', [id]));
    await swallow(dbRun('DELETE FROM characters WHERE id = ?', [id]));
  }
}

/** Poll `fn` until it returns truthy or `timeoutMs` elapses. Returns last value. */
export async function pollUntil(fn, { timeoutMs = 6000, intervalMs = 120 } = {}) {
  const start = Date.now();
  let last;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    last = await fn();
    if (last) return last;
    if (Date.now() - start >= timeoutMs) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
