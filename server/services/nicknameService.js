/**
 * Nickname Service
 *
 * Handles per-character multi-nickname tracking with audience rules.
 * Each row in `character_nicknames` represents one name (title, nickname,
 * epithet, etc.) with a rule describing who is allowed to use it.
 *
 * Audience types:
 *   default        — fallback when no other rule matches (strangers, etc.)
 *   friends        — NPC disposition >= 25 (friendly tier or higher)
 *   allied         — NPC disposition >= 50 (allied tier or higher)
 *   devoted        — NPC disposition >= 75 (devoted tier)
 *   specific_npc   — audience_value = npc id; only this NPC uses it
 *   role           — audience_value matches NPC occupation (case-insensitive
 *                    substring); e.g. 'apprentice' matches any NPC whose
 *                    occupation contains "apprentice"
 *
 * Bard override: any NPC whose `occupation` contains "bard" may use ANY
 * nickname on the character's list regardless of the rules — this is
 * enforced in resolveForNpc(), not in the schema.
 *
 * The resolver returns names ranked by priority so the DM prompt can
 * pick the most specific available form while knowing the alternatives.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { getRelationship } from './npcRelationshipService.js';

const VALID_AUDIENCE_TYPES = new Set([
  'default', 'friends', 'allied', 'devoted', 'specific_npc', 'role'
]);

const AUDIENCE_PRIORITY = {
  specific_npc: 5,
  devoted: 4,
  allied: 3,
  role: 3,
  friends: 2,
  default: 0
};

/**
 * Lists all nicknames for a character, ordered by audience priority (highest first).
 */
export async function listNicknames(characterId) {
  const rows = await dbAll(
    `SELECT id, character_id, nickname, audience_type, audience_value, notes, created_at
     FROM character_nicknames
     WHERE character_id = ?
     ORDER BY created_at ASC`,
    [characterId]
  );
  return rows;
}

/**
 * Fetch a single nickname row (for edit/delete flow).
 */
export async function getNicknameById(id) {
  return dbGet(
    `SELECT id, character_id, nickname, audience_type, audience_value, notes, created_at
     FROM character_nicknames
     WHERE id = ?`,
    [id]
  );
}

/**
 * Create a new nickname row.
 */
export async function createNickname({ character_id, nickname, audience_type, audience_value = null, notes = null }) {
  if (!character_id) throw new Error('character_id is required');
  if (!nickname || !nickname.trim()) throw new Error('nickname is required');
  if (!VALID_AUDIENCE_TYPES.has(audience_type)) {
    throw new Error(`Invalid audience_type: ${audience_type}`);
  }
  if (audience_type === 'specific_npc' && !audience_value) {
    throw new Error('audience_value (npc id) is required for specific_npc rule');
  }
  if (audience_type === 'role' && (!audience_value || !audience_value.trim())) {
    throw new Error('audience_value (role string) is required for role rule');
  }

  const result = await dbRun(
    `INSERT INTO character_nicknames
     (character_id, nickname, audience_type, audience_value, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [character_id, nickname.trim(), audience_type, audience_value, notes]
  );
  return getNicknameById(result.lastInsertRowid);
}

/**
 * Update an existing nickname row (any subset of fields except id/character_id).
 */
export async function updateNickname(id, updates) {
  const allowed = ['nickname', 'audience_type', 'audience_value', 'notes'];
  const sets = [];
  const args = [];
  for (const key of allowed) {
    if (key in updates) {
      if (key === 'audience_type' && !VALID_AUDIENCE_TYPES.has(updates[key])) {
        throw new Error(`Invalid audience_type: ${updates[key]}`);
      }
      sets.push(`${key} = ?`);
      args.push(updates[key]);
    }
  }
  if (sets.length === 0) return getNicknameById(id);
  args.push(id);
  await dbRun(
    `UPDATE character_nicknames SET ${sets.join(', ')} WHERE id = ?`,
    args
  );
  return getNicknameById(id);
}

/**
 * Delete a nickname row.
 */
export async function deleteNickname(id) {
  const result = await dbRun(`DELETE FROM character_nicknames WHERE id = ?`, [id]);
  return result.rowsAffected > 0;
}

/**
 * Resolve which names a given NPC may use for a character, ranked by
 * priority. Always returns at least one option (the default name or the
 * character's legal name if no rows exist).
 *
 * Bard override: any NPC with occupation containing "bard" gets the
 * full list regardless of audience rules, with a `bard_override` flag
 * so the caller can render that as "may use any familiar name."
 *
 * @returns {{
 *   primary: string,              // the recommended name
 *   primary_row: object|null,     // the matching nickname row (or null if fallback)
 *   allowed: Array<object>,       // all matching rows, sorted priority desc
 *   bard_override: boolean,       // true if all names are allowed due to bard occupation
 *   fallback_legal_name: string   // character's legal name (first + last or name)
 * }}
 */
export async function resolveForNpc(characterId, npcId) {
  const [allNicknames, relationship, character, npc] = await Promise.all([
    listNicknames(characterId),
    getRelationship(characterId, npcId),
    dbGet(
      `SELECT id, name, first_name, last_name, nickname
       FROM characters WHERE id = ?`,
      [characterId]
    ),
    dbGet(
      `SELECT id, name, occupation FROM npcs WHERE id = ?`,
      [npcId]
    )
  ]);

  const legalName =
    [character?.first_name, character?.last_name].filter(Boolean).join(' ').trim() ||
    character?.name ||
    'the traveler';

  const occupation = (npc?.occupation || '').toLowerCase();
  const isBard = occupation.includes('bard');

  if (isBard) {
    const sorted = [...allNicknames].sort((a, b) =>
      (AUDIENCE_PRIORITY[b.audience_type] || 0) - (AUDIENCE_PRIORITY[a.audience_type] || 0)
    );
    const primaryRow = sorted[0] || null;
    return {
      primary: primaryRow ? primaryRow.nickname : legalName,
      primary_row: primaryRow,
      allowed: sorted,
      bard_override: true,
      fallback_legal_name: legalName
    };
  }

  const disposition = relationship?.disposition ?? 0;
  const matches = [];
  for (const row of allNicknames) {
    const priority = AUDIENCE_PRIORITY[row.audience_type] || 0;
    switch (row.audience_type) {
      case 'default':
        matches.push({ ...row, priority });
        break;
      case 'friends':
        if (disposition >= 25) matches.push({ ...row, priority });
        break;
      case 'allied':
        if (disposition >= 50) matches.push({ ...row, priority });
        break;
      case 'devoted':
        if (disposition >= 75) matches.push({ ...row, priority });
        break;
      case 'specific_npc':
        if (String(row.audience_value) === String(npcId)) matches.push({ ...row, priority });
        break;
      case 'role': {
        const needle = String(row.audience_value || '').toLowerCase().trim();
        if (needle && occupation.includes(needle)) matches.push({ ...row, priority });
        break;
      }
    }
  }

  matches.sort((a, b) => b.priority - a.priority);
  const primaryRow = matches[0] || null;
  return {
    primary: primaryRow ? primaryRow.nickname : legalName,
    primary_row: primaryRow,
    allowed: matches,
    bard_override: false,
    fallback_legal_name: legalName
  };
}

/**
 * Bulk resolver: for a list of npc ids, return a map of npcId → resolution.
 * Used by the DM prompt builder to compute naming protocol for every active NPC.
 */
export async function resolveForNpcBatch(characterId, npcIds) {
  const out = {};
  for (const id of npcIds) {
    try {
      out[id] = await resolveForNpc(characterId, id);
    } catch (err) {
      // Defensive: never let one bad NPC crash the whole prompt.
      out[id] = null;
    }
  }
  return out;
}

/**
 * Human-readable one-liner for the DM prompt's NPC block.
 * Examples:
 *   "Calls the PC: Riv (friends)."
 *   "Calls the PC: Master (role: apprentice)."
 *   "Calls the PC: any familiar name (bard — rule of cool)."
 *   "Calls the PC: Sir Rivelious (no rule — defaults to their legal name / title)."
 */
export function formatResolutionForPrompt(resolution) {
  if (!resolution) return null;
  if (resolution.bard_override) {
    const names = resolution.allowed.map(a => a.nickname).join(', ');
    return names
      ? `Calls the PC: any familiar form (bard — rule of cool). Known forms: ${names}.`
      : `Calls the PC: any familiar form (bard — rule of cool).`;
  }
  const row = resolution.primary_row;
  if (!row) {
    return `Calls the PC: ${resolution.fallback_legal_name} (no relationship-specific name applies).`;
  }
  const ruleLabel = audienceLabel(row);
  return `Calls the PC: ${row.nickname} (${ruleLabel}).`;
}

function audienceLabel(row) {
  switch (row.audience_type) {
    case 'default': return 'default';
    case 'friends': return 'friends';
    case 'allied': return 'allied or closer';
    case 'devoted': return 'devoted';
    case 'specific_npc': return 'specific NPC';
    case 'role': return `role: ${row.audience_value}`;
    default: return row.audience_type;
  }
}
