/**
 * sceneLinkService — scene layer wiring (2026-11-02).
 *
 * The scene layer already existed: encounter_scene_rooms (migration 089),
 * setEncounterRoom/getEncounterRoom in dungeonSceneStorageService.js, and
 * three consumers reading the link (SET_COVER validation, display room
 * reads, lair durability scene-room reads). Nothing in play ever called
 * the setter, so this module is ONLY the callers, plus the simple-room
 * record for non-dungeon fights.
 *
 * Approved behaviour (2026-11-02):
 *  1. AUTO-link for dungeon rooms: COMBAT_START accepts optional
 *     Scene=/Room= and links the new encounter to that dungeon room.
 *  2. DM marker SET_ROOM for non-dungeon fights: links an existing
 *     scene room (Scene=+Room=), or creates a simple room (Name=,
 *     Features=, Exits=) and links it. A simple room is a real
 *     scenes + scene_rooms row — name, features, exits — with no
 *     dungeon generation involved.
 *  3. RE-LINK on move: MOVE accepts optional Room= (and Scene=) and,
 *     after a successful move, re-links the encounter to that room in
 *     the same scene (or the named scene). Zone names are NOT room
 *     keys: a plain MOVE with no Room= never re-links, because
 *     conflating a zone with a room would write a lying link.
 *  4. AUTOMATIC reading once linked: cover/display/durability already
 *     read getEncounterRoom(); this module changes none of them.
 *  5. NO LINK = legacy: cover grants as before, display uses the
 *     DM-declared Features list. A failed link returns success:false
 *     with a reason and stores NOTHING — never a wrong room, and
 *     never a silent fallback.
 *
 * Feature string format (SET_ROOM Features=):
 *   "Toppled pillar:cover_half:half, Stalactites:flammable"
 * i.e. comma-separated name:kind[:coverTier] pairs. coverTier, when
 * given, must be half / three-quarters / full (three_quarters is
 * normalized). When omitted, the feature exists but gives no cover —
 * SET_COVER then correctly reports feature_not_cover.
 * Exits format (SET_ROOM Exits=): "North:hallway, East:kitchen" or
 * bare room keys ("hallway, kitchen"). Stored in scene_rooms.exits_json
 * (migration 100) as [{direction, roomKey}].
 */
import { dbGet, dbRun } from '../database.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { setEncounterRoom, getEncounterRoom } from './dungeonSceneStorageService.js';
import { getCurrentEncounterSeq } from './enemyCombatService.js';

const AC_BONUS_FOR_COVER_TIER = { half: 2, 'three-quarters': 5, full: null };
const COVER_TIER_FOR_KIND = { cover_half: 'half', cover_three_quarters: 'three-quarters', cover_full: 'full' };

export function slugifyRoomKey(name) {
  return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'room';
}

export function normalizeCoverTier(raw) {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (t === 'three_quarters') return 'three-quarters';
  if (t === 'half' || t === 'three-quarters' || t === 'full') return t;
  return null;
}

export function parseFeatures(raw) {
  if (raw == null || String(raw).trim() === '') return [];
  return String(raw).split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [name, kind, tierRaw] = part.split(':').map((s) => (s || '').trim());
    const feature = { name, kind: kind || null };
    let coverTier = normalizeCoverTier(tierRaw);
    if (!coverTier && kind && COVER_TIER_FOR_KIND[kind]) coverTier = COVER_TIER_FOR_KIND[kind];
    if (coverTier) {
      feature.coverTier = coverTier;
      feature.acBonus = AC_BONUS_FOR_COVER_TIER[coverTier];
      if (coverTier === 'full') feature.untargetable = true;
    }
    return feature;
  }).filter((f) => f.name);
}

export function parseExits(raw) {
  if (raw == null || String(raw).trim() === '') return [];
  return String(raw).split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [a, b] = part.split(':').map((s) => (s || '').trim());
    if (b) return { direction: a, roomKey: b };
    return { direction: null, roomKey: a };
  });
}

/**
 * Create a simple room: one scenes row (kind 'room') + one scene_rooms
 * row. campaignId is derived by the caller from the session's character
 * (characters.campaign_id, fallback 0) because dm_sessions carries no
 * campaign column. Throws only on a DB failure; callers convert that
 * to a success:false result.
 */
export async function createSimpleRoom({ campaignId = 0, name, roomKey = null, features = [], exits = [] } = {}) {
  if (!name) throw new Error('createSimpleRoom requires a name');
  const key = roomKey || slugifyRoomKey(name);
  const sceneRes = await dbRun(
    `INSERT INTO scenes (campaign_id, name, kind, seed_json, status) VALUES (?, ?, 'room', NULL, 'content')`,
    [campaignId, name]
  );
  const sceneId = Number(sceneRes.lastInsertRowid);
  await dbRun(
    `INSERT INTO scene_rooms (scene_id, room_key, role, label, features_json, state, sort_order, exits_json)
     VALUES (?, ?, 'room', ?, ?, 'discovered', 0, ?)`,
    [sceneId, key, name, JSON.stringify(features), JSON.stringify(exits)]
  );
  return { sceneId, roomKey: key };
}

export async function linkEncounterRoom({ sessionId, encounterSeq, sceneId, roomKey } = {}) {
  try {
    const linked = await setEncounterRoom({ sessionId, encounterSeq, sceneId, roomKey });
    return { success: true, ...linked };
  } catch (e) {
    return { success: false, reason: e.message };
  }
}

/**
 * Create a simple room and link the current encounter to it.
 * campaignId: the session character's campaign_id, or 0 when unset.
 */
export async function linkSimpleRoom({ sessionId, encounterSeq, characterId, name, roomKey, features, exits } = {}) {
  try {
    let campaignId = 0;
    if (characterId) {
      const row = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [characterId]).catch(() => null);
      if (row && row.campaign_id != null) campaignId = row.campaign_id;
    }
    const created = await createSimpleRoom({ campaignId, name, roomKey, features, exits });
    const linked = await linkEncounterRoom({ sessionId, encounterSeq, sceneId: created.sceneId, roomKey: created.roomKey });
    if (!linked.success) return { success: false, reason: linked.reason };
    return { success: true, sceneId: created.sceneId, roomKey: created.roomKey, created: true };
  } catch (e) {
    return { success: false, reason: e.message };
  }
}

/**
 * Re-link after a room move. sceneId, when given, wins; otherwise the
 * current link's scene is reused. With neither, this fails rather than
 * guessing a scene — a move with no room context is not a room move.
 */
export async function relinkOnMove({ sessionId, encounterSeq, roomKey, sceneId = null } = {}) {
  try {
    let sid = sceneId;
    if (!sid) {
      const current = await getEncounterRoom(sessionId, encounterSeq);
      if (!current) return { success: false, reason: 'no linked room to move from — use SET_ROOM with Scene= first' };
      sid = current.sceneId;
    }
    return await linkEncounterRoom({ sessionId, encounterSeq, sceneId: sid, roomKey });
  } catch (e) {
    return { success: false, reason: e.message };
  }
}

function systemNoteFor(text) {
  return `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: ${text}`;
}

/**
 * SET_ROOM marker.
 *   [SET_ROOM: Scene=12 Room="r1"] — link an existing scene room.
 *   [SET_ROOM: Name="Tavern common room" Features="Bar:cover_half:half, Fireplace:flammable" Exits="North:street"]
 *     — create a simple room and link it (roomKey defaults to the slug of Name).
 * Requires an active encounter (link after COMBAT_START); a failure
 * stores nothing and surfaces its reason, never a wrong room.
 */
registerMarkerHandler('SET_ROOM', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) {
      return { type: 'set_room', success: false, reason: 'no active encounter — link after COMBAT_START',
        systemNote: systemNoteFor('No room was linked: there is no active encounter yet. Link the room after COMBAT_START.') };
    }
    const sceneRaw = parsed?.Scene;
    const sceneId = sceneRaw != null && String(sceneRaw).trim() !== '' ? Number(sceneRaw) : null;
    const roomRaw = parsed?.Room ? String(parsed.Room).trim() : '';
    if (sceneId != null && !Number.isNaN(sceneId)) {
      if (!roomRaw) {
        return { type: 'set_room', success: false, reason: 'SET_ROOM with Scene= also needs Room=',
          systemNote: systemNoteFor('No room was linked: SET_ROOM named a scene but no room key.') };
      }
      const linked = await linkEncounterRoom({ sessionId: context.sessionId, encounterSeq, sceneId, roomKey: roomRaw });
      if (!linked.success) {
        return { type: 'set_room', success: false, reason: linked.reason,
          systemNote: systemNoteFor(`No room was linked: ${linked.reason}`) };
      }
      return { type: 'set_room', success: true, sceneId, roomKey: roomRaw };
    }
    const name = parsed?.Name ? String(parsed.Name).trim() : roomRaw;
    if (!name) {
      return { type: 'set_room', success: false, reason: 'SET_ROOM needs Scene=+Room=, or Name= for a simple room',
        systemNote: systemNoteFor('No room was linked: SET_ROOM needs Scene=+Room=, or Name= for a simple room.') };
    }
    const features = parseFeatures(parsed?.Features);
    const exits = parseExits(parsed?.Exits);
    const linked = await linkSimpleRoom({
      sessionId: context.sessionId, encounterSeq, characterId: context.characterId,
      name, roomKey: roomRaw || null, features, exits,
    });
    if (!linked.success) {
      return { type: 'set_room', success: false, reason: linked.reason,
        systemNote: systemNoteFor(`No room was linked: ${linked.reason}`) };
    }
    return { type: 'set_room', success: true, sceneId: linked.sceneId, roomKey: linked.roomKey, created: true };
  } catch (e) {
    console.error('[sceneLinkService] SET_ROOM handler failed:', e.message);
    return null;
  }
});

export default { slugifyRoomKey, normalizeCoverTier, parseFeatures, parseExits, createSimpleRoom, linkEncounterRoom, linkSimpleRoom, relinkOnMove };
