/**
 * Prelude emergence service.
 *
 * Phase 3. Handles the lifecycle of mechanical emergence offers that Sonnet
 * fires via markers during a prelude session: [STAT_HINT], [SKILL_HINT],
 * [CLASS_HINT], [THEME_HINT], [ANCESTRY_HINT], [VALUE_HINT].
 *
 * Data model (migration 042 ships these tables):
 *   - prelude_emergences: one row per hint (offered / accepted / declined /
 *     declined_permanently). Stat, skill, class, theme, ancestry, value all
 *     share this table keyed by `kind`.
 *   - prelude_values: denormalized rolling tally per value (loyalty, honor,
 *     etc.). Upserted by [VALUE_HINT] markers.
 *
 * Caps enforced server-side (rejected hints get a [SYSTEM] cap-violation
 * message injected back to Sonnet so it knows to stop):
 *   - +2 max per stat across the whole prelude
 *   - 2 accepted skills max total
 *   - Class/theme/ancestry hints: no cap on firing; winner determined at
 *     prelude end by chapter-weighted tally (ch1-2 = 1x, ch3 = 1.5x,
 *     ch4 = 2x). Recency breaks ties.
 *   - Values: no cap; every tick accumulates on prelude_values.
 *
 * Auto-accept policy for class/theme/ancestry hints: these are TALLY
 * signals, not player-facing accept-or-decline cards. They're recorded
 * silently with status='accepted' (since the player doesn't act on them
 * mid-play). Only stat and skill hints surface as UI cards.
 */

import { dbGet, dbRun, dbAll } from '../database.js';
import { getPreludeCharacter } from './preludeService.js';

// ---------------------------------------------------------------------------
// Caps
// ---------------------------------------------------------------------------

const MAX_STAT_BONUS_TOTAL = 2;   // per stat, across the prelude
const MAX_SKILLS_TOTAL = 2;        // across the prelude
const VALUE_DELTA_CLAMP = 3;       // single-marker absolute-value clamp

// Chapter tally weights for class/theme/ancestry hints. Matches
// PRELUDE_IMPLEMENTATION_PLAN.md §5d.
const CHAPTER_WEIGHT = { 1: 1.0, 2: 1.0, 3: 1.5, 4: 2.0 };

// ---------------------------------------------------------------------------
// Record a hint (called from session service on marker detection)
// ---------------------------------------------------------------------------

/**
 * Persist a STAT_HINT. Returns one of:
 *   { status: 'offered', emergenceId, cap: { remaining } }  — cap OK, player decides
 *   { status: 'capped', reason }                            — already at +2 for this stat
 *   { status: 'capped_previously_declined', reason }        — player said "never offer"
 */
export async function recordStatHint(characterId, { stat, magnitude, reason, chapter, sessionId, messageIndex }) {
  // Reject if player has declined permanently
  const declined = await dbGet(
    `SELECT id FROM prelude_emergences
     WHERE character_id = ? AND kind = 'stat' AND target = ? AND status = 'declined_permanently'`,
    [characterId, stat]
  );
  if (declined) {
    return { status: 'capped_previously_declined', reason: `stat ${stat} was declined permanently` };
  }

  // Check the +2 cap (only ACCEPTED hints count toward it)
  const acceptedTotal = await sumAcceptedStatMagnitude(characterId, stat);
  if (acceptedTotal >= MAX_STAT_BONUS_TOTAL) {
    return { status: 'capped', reason: `stat ${stat} already at +${acceptedTotal} of max +${MAX_STAT_BONUS_TOTAL}` };
  }

  // Clamp the offered magnitude so the accept can't over-shoot the cap
  const available = MAX_STAT_BONUS_TOTAL - acceptedTotal;
  const clampedMagnitude = Math.min(magnitude, available);

  const result = await dbRun(
    `INSERT INTO prelude_emergences
       (character_id, kind, target, magnitude, reason, game_age, chapter, session_id, offered_at_message_index, status)
     VALUES (?, 'stat', ?, ?, ?, ?, ?, ?, ?, 'offered')`,
    [
      characterId, stat, clampedMagnitude, reason || null,
      (await getPreludeCharacter(characterId))?.prelude_age || null,
      chapter || null, sessionId || null, messageIndex || null
    ]
  );
  return {
    status: 'offered',
    emergenceId: Number(result.lastInsertRowid),
    stat,
    magnitude: clampedMagnitude,
    reason,
    remaining: available - clampedMagnitude
  };
}

/**
 * Persist a SKILL_HINT. Returns similar status shapes.
 */
export async function recordSkillHint(characterId, { skill, reason, chapter, sessionId, messageIndex }) {
  const normalized = normalizeSkill(skill);

  const declined = await dbGet(
    `SELECT id FROM prelude_emergences
     WHERE character_id = ? AND kind = 'skill' AND target = ? AND status = 'declined_permanently'`,
    [characterId, normalized]
  );
  if (declined) {
    return { status: 'capped_previously_declined', reason: `skill ${normalized} was declined permanently` };
  }

  const acceptedCount = await countAcceptedSkills(characterId);
  if (acceptedCount >= MAX_SKILLS_TOTAL) {
    return { status: 'capped', reason: `already have ${acceptedCount} of max ${MAX_SKILLS_TOTAL} emerged skills` };
  }

  // Also reject if this specific skill is already accepted (no point)
  const alreadyHave = await dbGet(
    `SELECT id FROM prelude_emergences
     WHERE character_id = ? AND kind = 'skill' AND target = ? AND status = 'accepted'`,
    [characterId, normalized]
  );
  if (alreadyHave) {
    return { status: 'capped', reason: `skill ${normalized} already accepted` };
  }

  const result = await dbRun(
    `INSERT INTO prelude_emergences
       (character_id, kind, target, magnitude, reason, game_age, chapter, session_id, offered_at_message_index, status)
     VALUES (?, 'skill', ?, 1, ?, ?, ?, ?, ?, 'offered')`,
    [
      characterId, normalized, reason || null,
      (await getPreludeCharacter(characterId))?.prelude_age || null,
      chapter || null, sessionId || null, messageIndex || null
    ]
  );
  return {
    status: 'offered',
    emergenceId: Number(result.lastInsertRowid),
    skill: normalized,
    reason,
    remaining: MAX_SKILLS_TOTAL - acceptedCount - 1
  };
}

/**
 * Persist a CLASS_HINT. Auto-accepted — these are tally signals, not
 * player-facing cards. The winning class is computed at prelude end.
 */
export async function recordClassHint(characterId, { class: cls, reason, chapter, sessionId, messageIndex }) {
  await dbRun(
    `INSERT INTO prelude_emergences
       (character_id, kind, target, magnitude, reason, game_age, chapter, session_id, offered_at_message_index, status)
     VALUES (?, 'class', ?, 1, ?, ?, ?, ?, ?, 'accepted')`,
    [
      characterId, String(cls).toLowerCase(), reason || null,
      (await getPreludeCharacter(characterId))?.prelude_age || null,
      chapter || null, sessionId || null, messageIndex || null
    ]
  );
  return { status: 'tallied', class: String(cls).toLowerCase() };
}

/** Persist a THEME_HINT (same auto-accept tally pattern). */
export async function recordThemeHint(characterId, { theme, reason, chapter, sessionId, messageIndex }) {
  await dbRun(
    `INSERT INTO prelude_emergences
       (character_id, kind, target, magnitude, reason, game_age, chapter, session_id, offered_at_message_index, status)
     VALUES (?, 'theme', ?, 1, ?, ?, ?, ?, ?, 'accepted')`,
    [
      characterId, String(theme).toLowerCase(), reason || null,
      (await getPreludeCharacter(characterId))?.prelude_age || null,
      chapter || null, sessionId || null, messageIndex || null
    ]
  );
  return { status: 'tallied', theme: String(theme).toLowerCase() };
}

/** Persist an ANCESTRY_HINT (same auto-accept tally pattern). */
export async function recordAncestryHint(characterId, { feat_id, reason, chapter, sessionId, messageIndex }) {
  await dbRun(
    `INSERT INTO prelude_emergences
       (character_id, kind, target, magnitude, reason, game_age, chapter, session_id, offered_at_message_index, status)
     VALUES (?, 'ancestry', ?, 1, ?, ?, ?, ?, ?, 'accepted')`,
    [
      characterId, feat_id, reason || null,
      (await getPreludeCharacter(characterId))?.prelude_age || null,
      chapter || null, sessionId || null, messageIndex || null
    ]
  );
  return { status: 'tallied', feat_id };
}

/**
 * Persist a VALUE_HINT. Clamped and summed into the prelude_values table
 * immediately (no player-facing decision).
 */
export async function recordValueHint(characterId, { value, delta, reason, chapter, sessionId, messageIndex }) {
  const clamped = Math.max(-VALUE_DELTA_CLAMP, Math.min(VALUE_DELTA_CLAMP, delta));
  const normalized = String(value).toLowerCase().replace(/\s+/g, '_');
  const character = await getPreludeCharacter(characterId);
  const age = character?.prelude_age || null;

  // Also insert into prelude_emergences for audit trail
  await dbRun(
    `INSERT INTO prelude_emergences
       (character_id, kind, target, magnitude, reason, game_age, chapter, session_id, offered_at_message_index, status)
     VALUES (?, 'value', ?, ?, ?, ?, ?, ?, ?, 'accepted')`,
    [
      characterId, normalized, clamped, reason || null,
      age, chapter || null, sessionId || null, messageIndex || null
    ]
  );

  // Upsert the denormalized rolling tally
  await dbRun(
    `INSERT INTO prelude_values (character_id, value, score, last_changed_age)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (character_id, value) DO UPDATE SET
       score = score + excluded.score,
       last_changed_age = excluded.last_changed_age,
       last_changed_at = CURRENT_TIMESTAMP`,
    [characterId, normalized, clamped, age]
  );

  return { status: 'accumulated', value: normalized, delta: clamped };
}

// ---------------------------------------------------------------------------
// Player decisions (accept / decline / never-offer) — only stats + skills
// ---------------------------------------------------------------------------

export async function acceptEmergence(characterId, emergenceId) {
  const row = await dbGet(
    `SELECT id, kind, target, magnitude, status FROM prelude_emergences
     WHERE id = ? AND character_id = ?`,
    [emergenceId, characterId]
  );
  if (!row) throw new Error('Emergence not found');
  if (row.status !== 'offered') throw new Error(`Cannot accept — status is ${row.status}`);

  await dbRun(
    `UPDATE prelude_emergences SET status = 'accepted' WHERE id = ?`,
    [emergenceId]
  );
  return { id: emergenceId, status: 'accepted', kind: row.kind, target: row.target, magnitude: row.magnitude };
}

export async function declineEmergence(characterId, emergenceId, { permanent = false } = {}) {
  const row = await dbGet(
    `SELECT id, status FROM prelude_emergences WHERE id = ? AND character_id = ?`,
    [emergenceId, characterId]
  );
  if (!row) throw new Error('Emergence not found');
  if (row.status !== 'offered') throw new Error(`Cannot decline — status is ${row.status}`);

  const newStatus = permanent ? 'declined_permanently' : 'declined';
  await dbRun(
    `UPDATE prelude_emergences SET status = ? WHERE id = ?`,
    [newStatus, emergenceId]
  );
  return { id: emergenceId, status: newStatus };
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getOfferedEmergences(characterId) {
  return dbAll(
    `SELECT * FROM prelude_emergences
     WHERE character_id = ? AND status = 'offered'
     ORDER BY id ASC`,
    [characterId]
  );
}

export async function getAcceptedEmergences(characterId, sinceSessionId = null) {
  if (sinceSessionId) {
    return dbAll(
      `SELECT * FROM prelude_emergences
       WHERE character_id = ? AND status = 'accepted' AND session_id = ?
       ORDER BY id ASC`,
      [characterId, sinceSessionId]
    );
  }
  return dbAll(
    `SELECT * FROM prelude_emergences
     WHERE character_id = ? AND status = 'accepted'
     ORDER BY id ASC`,
    [characterId]
  );
}

export async function getValues(characterId) {
  return dbAll(
    `SELECT value, score, last_changed_age, last_changed_at
     FROM prelude_values
     WHERE character_id = ?
     ORDER BY score DESC`,
    [characterId]
  );
}

/**
 * Build a compact EMERGENCE SO FAR block for injection into the Sonnet/Opus
 * system prompt. Shows accepted stats/skills + leading class/theme/ancestry
 * trajectories + top values — the AI consults it when composing upcoming
 * scenes so it can lean toward emerging strengths. Runs on every turn so
 * the snapshot stays current as hints accept and values shift.
 *
 * Always returns a non-empty block so the prompt structure stays stable
 * for caching — uses "none yet" / "undecided" placeholders for unfilled
 * slots.
 */
export async function buildEmergenceSnapshotBlock(characterId) {
  const [accepted, values, classWinner, themeWinner, ancestryWinner] = await Promise.all([
    getAcceptedEmergences(characterId),
    getValues(characterId),
    getTrajectoryWinner(characterId, 'class'),
    getTrajectoryWinner(characterId, 'theme'),
    getTrajectoryWinner(characterId, 'ancestry')
  ]);

  // Sum accepted stat magnitudes per stat
  const statMap = new Map();
  for (const row of accepted) {
    if (row.kind !== 'stat') continue;
    statMap.set(row.target, (statMap.get(row.target) || 0) + (row.magnitude || 0));
  }
  const statLine = statMap.size > 0
    ? [...statMap.entries()].map(([s, m]) => `${s.toUpperCase()} +${m}`).join(', ')
    : 'none yet';

  const skills = accepted.filter(r => r.kind === 'skill').map(r => r.target);
  const skillLine = skills.length > 0 ? skills.join(', ') : 'none yet';

  const classLine = classWinner
    ? `${classWinner.winner} (leading, ${classWinner.score.toFixed(1)} pts)`
    : 'undecided';
  const themeLine = themeWinner
    ? `${themeWinner.winner} (leading, ${themeWinner.score.toFixed(1)} pts)`
    : 'undecided';
  const ancestryLine = ancestryWinner
    ? `${ancestryWinner.winner} (leading)`
    : 'undecided';

  // Top values by absolute score — include negatives so the AI sees
  // what the character has acted AGAINST, not just what they embrace.
  const topValues = values
    .filter(v => v.score !== 0)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 5)
    .map(v => `${v.value} (${v.score > 0 ? '+' : ''}${v.score})`);
  const valueLine = topValues.length > 0 ? topValues.join(', ') : 'none yet';

  return `EMERGENCE SO FAR (what the character is becoming — lean upcoming scenes toward these strengths, don't force):
  Stats emerged:          ${statLine}
  Skills emerged:         ${skillLine}
  Class trajectory:       ${classLine}
  Theme trajectory:       ${themeLine}
  Ancestry-feat leaning:  ${ancestryLine}
  Top values so far:      ${valueLine}`;
}

/**
 * Compute the chapter-weighted winner for class/theme/ancestry tallies.
 * Returns { winner: target, score: number } or null if no hints recorded.
 */
export async function getTrajectoryWinner(characterId, kind /* 'class' | 'theme' | 'ancestry' */) {
  const rows = await dbAll(
    `SELECT target, chapter FROM prelude_emergences
     WHERE character_id = ? AND kind = ?`,
    [characterId, kind]
  );
  if (rows.length === 0) return null;

  const tally = new Map(); // target -> { score, lastChapter }
  for (const r of rows) {
    const weight = CHAPTER_WEIGHT[r.chapter] || 1.0;
    const existing = tally.get(r.target) || { score: 0, lastChapter: 0 };
    existing.score += weight;
    existing.lastChapter = Math.max(existing.lastChapter, r.chapter || 0);
    tally.set(r.target, existing);
  }

  // Pick highest score; tiebreak by most recent chapter
  let winner = null;
  for (const [target, data] of tally.entries()) {
    if (!winner) { winner = { target, ...data }; continue; }
    if (data.score > winner.score) { winner = { target, ...data }; continue; }
    if (data.score === winner.score && data.lastChapter > winner.lastChapter) {
      winner = { target, ...data };
    }
  }
  return winner ? { winner: winner.target, score: winner.score } : null;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function sumAcceptedStatMagnitude(characterId, stat) {
  const row = await dbGet(
    `SELECT COALESCE(SUM(magnitude), 0) as total
     FROM prelude_emergences
     WHERE character_id = ? AND kind = 'stat' AND target = ? AND status = 'accepted'`,
    [characterId, stat]
  );
  return Number(row?.total || 0);
}

async function countAcceptedSkills(characterId) {
  const row = await dbGet(
    `SELECT COUNT(*) as c FROM prelude_emergences
     WHERE character_id = ? AND kind = 'skill' AND status = 'accepted'`,
    [characterId]
  );
  return Number(row?.c || 0);
}

function normalizeSkill(raw) {
  // Normalize "Sleight of Hand" → "sleight_of_hand", "insight" → "insight"
  return String(raw || '').toLowerCase().trim().replace(/['']/g, '').replace(/\s+/g, '_');
}
