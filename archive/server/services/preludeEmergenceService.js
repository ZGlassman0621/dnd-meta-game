/**
 * Prelude emergence service.
 *
 * Handles the lifecycle of mechanical emergence offers that Sonnet
 * fires via markers during a prelude session: [STAT_HINT], [SKILL_HINT],
 * [CLASS_HINT], [THEME_HINT], [ANCESTRY_HINT].
 *
 * [VALUE_HINT] dropped in Phase 2 chunk 4 (values tracker cut per
 * DECISION_LOG 2026-04-29 Phase 1 Decision 3). The prelude_values table
 * stays in the schema but is no longer written.
 *
 * Data model (migration 042 ships the tables):
 *   - prelude_emergences: one row per hint (offered / accepted / declined /
 *     declined_permanently). Stat, skill, class, theme, ancestry all
 *     share this table keyed by `kind`.
 *
 * Caps enforced server-side (rejected hints get a [SYSTEM] cap-violation
 * message injected back to Sonnet so it knows to stop):
 *   - +2 max per stat across the whole prelude
 *   - 2 accepted skills max total
 *   - Class/theme/ancestry hints: no cap on firing; winner determined at
 *     prelude end by chapter-weighted tally. Recency breaks ties.
 *   - Ancestry hints additionally validated against the player's race's
 *     allowed feat list (Phase 2 chunk 4 — DECISION_LOG 2026-04-30
 *     Decision A); invalid feats rejected and surfaced as cap violations.
 *
 * Chapter tally weights (Phase 2 — Phase 1 Decision 5: three-chapter
 * structure, Ch1=1×, Ch2=1.5×, Ch3=2×). Ch4 stays mapped to 2× for any
 * legacy hints that fired against the old 4-chapter shape — they tally
 * the same as Ch3 hints, which is the closest-living-stage match.
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

// Chapter tally weights for class/theme/ancestry hints. Phase 2 — Phase 1
// Decision 5 (three-chapter structure: Ch1=1×, Ch2=1.5×, Ch3=2×). Ch4
// kept at 2× for legacy hints that fired against the 4-chapter shape.
const CHAPTER_WEIGHT = { 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.0 };

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

/**
 * Map a character's race (and subrace where relevant) to the ancestry
 * feat list_id(s) that count as "in the player's race's allowed feat list."
 * Phase 2 chunk 4.
 *
 * Most races map 1:1. Half-races normalize hyphen→underscore. Aasimar's
 * three paths are kept open until path commitment lands at handoff —
 * during Prelude play any aasimar feat from any of the three paths is
 * accepted. Drow is its own list_id even though it's modeled as a subrace
 * in some setups; we accept either 'drow' (as race) or 'elf' with subrace
 * containing "drow".
 */
function allowedAncestryListIds({ race, subrace }) {
  const r = String(race || '').toLowerCase().trim();
  const sub = String(subrace || '').toLowerCase().trim();
  // Aasimar: accept all three paths until commitment.
  if (r === 'aasimar') return ['aasimar_protector', 'aasimar_scourge', 'aasimar_fallen'];
  // Drow: accept whether stored as race or as elf subrace.
  if (r === 'drow' || (r === 'elf' && sub.includes('drow'))) return ['drow'];
  // Hyphenated races: normalize.
  if (r === 'half-elf') return ['half_elf'];
  if (r === 'half-orc') return ['half_orc'];
  // Default 1:1 mapping. Unknown races yield empty array → all hints reject.
  const direct = ['dwarf', 'elf', 'human', 'halfling', 'dragonborn', 'tiefling', 'warforged'];
  if (direct.includes(r)) return [r];
  // Underscore variants of half-* if they came in pre-normalized.
  if (r === 'half_elf' || r === 'half_orc') return [r];
  return [];
}

/**
 * Validate an ANCESTRY_HINT feat_id against a character's race. Returns
 * one of:
 *   { ok: true, feat: { id, list_id, tier, choice_index, feat_name } }
 *   { ok: false, reason }
 *
 * feat_id is expected as a slug `${list_id}_t${tier}_c${choice_index}`
 * (e.g. "dwarf_t1_c2"). Phase 2 chunk 3 instructs the AI on this
 * convention; until that ships, hints emitted in other shapes will
 * reject and the AI gets [SYSTEM] feedback. Tally degrades gracefully
 * (just nothing tallied for that hint).
 */
export async function validateAncestryFeat(characterId, featIdRaw) {
  const character = await getPreludeCharacter(characterId);
  if (!character) return { ok: false, reason: 'character not found' };

  const allowedLists = allowedAncestryListIds(character);
  if (allowedLists.length === 0) {
    return { ok: false, reason: `no ancestry feat list for race "${character.race}"` };
  }

  const featId = String(featIdRaw || '').toLowerCase().trim();
  // Slug form: ${list_id}_t${tier}_c${choice_index}
  const slugMatch = /^([a-z_]+)_t(\d+)_c(\d+)$/.exec(featId);
  if (!slugMatch) {
    return { ok: false, reason: `feat_id "${featIdRaw}" is not in the expected ${listIdHint(allowedLists)}_tN_cN slug format` };
  }
  const [, listId, tierStr, choiceStr] = slugMatch;
  const tier = parseInt(tierStr, 10);
  const choice = parseInt(choiceStr, 10);

  if (!allowedLists.includes(listId)) {
    return { ok: false, reason: `feat_id "${featIdRaw}" belongs to ancestry list "${listId}", which is not allowed for race "${character.race}" (allowed: ${allowedLists.join('/')})` };
  }
  if (![1, 3, 7, 13, 18].includes(tier)) {
    return { ok: false, reason: `feat_id "${featIdRaw}" has tier ${tier}, expected one of 1/3/7/13/18` };
  }
  if (![1, 2, 3].includes(choice)) {
    return { ok: false, reason: `feat_id "${featIdRaw}" has choice_index ${choice}, expected one of 1/2/3` };
  }

  // Confirm the row exists in the catalog
  const row = await dbGet(
    `SELECT id, list_id, tier, choice_index, feat_name
     FROM ancestry_feats
     WHERE list_id = ? AND tier = ? AND choice_index = ?`,
    [listId, tier, choice]
  );
  if (!row) {
    return { ok: false, reason: `feat_id "${featIdRaw}" does not match any catalog row` };
  }
  return { ok: true, feat: row };
}

function listIdHint(allowed) {
  return allowed.length === 1 ? allowed[0] : `(${allowed.join('|')})`;
}

/**
 * Persist an ANCESTRY_HINT. Phase 2 chunk 4 adds server-side validation:
 * feat_id must resolve to a real ancestry_feats row whose list_id matches
 * the character's race. Invalid hints are rejected and surfaced as cap
 * violations so the AI gets [SYSTEM] feedback.
 *
 * Returns:
 *   { status: 'tallied', feat_id, feat: { ... } }   on success
 *   { status: 'invalid_feat', reason }              on validation failure
 */
export async function recordAncestryHint(characterId, { feat_id, reason, chapter, sessionId, messageIndex }) {
  const validation = await validateAncestryFeat(characterId, feat_id);
  if (!validation.ok) {
    return { status: 'invalid_feat', reason: validation.reason, feat_id };
  }

  // Store the slug form (lower-cased + trimmed) so the trajectory tally
  // groups duplicates correctly even when AI emits inconsistent casing.
  const normalizedFeatId = String(feat_id).toLowerCase().trim();
  await dbRun(
    `INSERT INTO prelude_emergences
       (character_id, kind, target, magnitude, reason, game_age, chapter, session_id, offered_at_message_index, status)
     VALUES (?, 'ancestry', ?, 1, ?, ?, ?, ?, ?, 'accepted')`,
    [
      characterId, normalizedFeatId, reason || null,
      (await getPreludeCharacter(characterId))?.prelude_age || null,
      chapter || null, sessionId || null, messageIndex || null
    ]
  );
  return { status: 'tallied', feat_id: normalizedFeatId, feat: validation.feat };
}

// recordValueHint removed in Phase 2 chunk 4 — values tracker cut per
// DECISION_LOG 2026-04-29 Phase 1 Decision 3. Session service no longer
// calls it; old prelude_values rows remain in DB untouched.

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
 *
 * Query strategy (2 sequential reads, not 5 parallel): one pass over
 * `prelude_emergences` pulls every row for the character, and we compute
 * accepted-stat totals + accepted-skill names + chapter-weighted class/
 * theme/ancestry winners all in JS. A second read pulls `prelude_values`.
 * Earlier versions ran 5 queries via Promise.all which saturated Turso's
 * per-request compute budget and produced SQLITE_NOMEM on session send.
 */
export async function buildEmergenceSnapshotBlock(characterId) {
  const allEmergences = await dbAll(
    `SELECT kind, target, magnitude, chapter, status
     FROM prelude_emergences
     WHERE character_id = ?`,
    [characterId]
  );
  const values = await dbAll(
    `SELECT value, score
     FROM prelude_values
     WHERE character_id = ?`,
    [characterId]
  );

  // Accepted stat totals — sum magnitudes per stat for rows with kind='stat'
  // and status='accepted'. Capped by recordStatHint server-side at +2, but
  // we just sum what's there.
  const statMap = new Map();
  const acceptedSkills = [];
  for (const row of allEmergences) {
    if (row.status !== 'accepted') continue;
    if (row.kind === 'stat') {
      statMap.set(row.target, (statMap.get(row.target) || 0) + (row.magnitude || 0));
    } else if (row.kind === 'skill') {
      acceptedSkills.push(row.target);
    }
  }
  const statLine = statMap.size > 0
    ? [...statMap.entries()].map(([s, m]) => `${s.toUpperCase()} +${m}`).join(', ')
    : 'none yet';
  const skillLine = acceptedSkills.length > 0 ? acceptedSkills.join(', ') : 'none yet';

  // Chapter-weighted trajectory winners for class / theme / ancestry. All
  // hint rows count regardless of status (they're auto-tallied, no player
  // accept/decline). Weight: ch1-2 = 1.0x, ch3 = 1.5x, ch4 = 2.0x. Tiebreak
  // by most recent chapter.
  const trajectoryWinner = (kind) => {
    const tally = new Map(); // target → { score, lastChapter }
    for (const row of allEmergences) {
      if (row.kind !== kind) continue;
      const weight = CHAPTER_WEIGHT[row.chapter] || 1.0;
      const current = tally.get(row.target) || { score: 0, lastChapter: 0 };
      current.score += weight;
      current.lastChapter = Math.max(current.lastChapter, row.chapter || 0);
      tally.set(row.target, current);
    }
    let winner = null;
    for (const [target, data] of tally.entries()) {
      if (!winner) { winner = { target, ...data }; continue; }
      if (data.score > winner.score) { winner = { target, ...data }; continue; }
      if (data.score === winner.score && data.lastChapter > winner.lastChapter) {
        winner = { target, ...data };
      }
    }
    return winner ? { winner: winner.target, score: winner.score } : null;
  };

  const classWinner = trajectoryWinner('class');
  const themeWinner = trajectoryWinner('theme');
  const ancestryWinner = trajectoryWinner('ancestry');

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
