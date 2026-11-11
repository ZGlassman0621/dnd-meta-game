/**
 * dungeonSceneStorageService — Dungeon generation + scene layer, Phase B.
 *
 * Stores a Phase A skeleton + Phase B content into the migration 086
 * tables (plus migration 088 geometry/trap/treasure/era columns) and
 * builds the DM digest (N1) from stored rows.
 *
 * Key translation (Phase A design): skeletons reference rooms by KEY
 * (r1, r2, ...); stored scene_connections reference rooms by DB id.
 * This module translates keys -> ids at insert time and nowhere else.
 *
 * Digest visibility (N1, N10): the digest is DM-facing, not player
 * narration. The current room is given in full — including its hidden
 * traps and treasure, marked dmOnly — because the DM adjudicates
 * discovery. Adjacent rooms appear as exits ONLY (direction, distance,
 * elevation, connection kind, locked/trapped): no role, label,
 * features, encounter or treasure. Secret connections are NOT exits:
 * they appear in the current room's hiddenExits (DM-only). Rooms that
 * are neither current nor adjacent are not listed at all — only a
 * count — so their keys, roles and labels never leak. The designer
 * label is included for the DM with designerLabelDmOnly: true; it
 * must never be narrated to the player before they perceive the room.
 *
 * SET_COVER Feature= validation (ruled 2026-10-29: cover must actually
 * exist in the room where the fight is happening, and a failed check
 * must surface, never fail silently). validateCoverFeature is the pure
 * check against a room's features_json list; setEncounterRoom /
 * getEncounterRoom are the encounter -> room link (migration 089) the
 * SET_COVER handler reads. No link means no room list to check against.
 */

import { dbGet, dbRun, dbAll } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { BESTIARY_ENTRIES } from '../data/bestiaryData.js';
import { validateSkeleton } from './dungeonSkeletonService.js';
import {
  assignDungeonContent, validateContent, catalogFromEntries, invertDirection,
} from './dungeonContentService.js';

const DEFAULT_CATALOG = catalogFromEntries(BESTIARY_ENTRIES);

/**
 * Store a skeleton + content as one scene. content may be omitted:
 * it is assigned here from the skeleton (default bestiary catalog,
 * siteEra 'sealed' unless overridden). Throws on an invalid skeleton
 * or invalid content — storage never persists content that fails
 * validation.
 */
export async function storeScene({
  campaignId, locationId = null, name, kind = 'dungeon',
  seedPacket, skeleton, content = null, siteEra = 'sealed', catalog = null,
} = {}) {
  if (!skeleton || !seedPacket) throw new Error('storeScene requires a skeleton and its seed packet');
  const sk = validateSkeleton(skeleton, seedPacket);
  if (!sk.valid) throw new Error(`invalid skeleton: ${sk.errors.join('; ')}`);
  const assigned = content || assignDungeonContent(skeleton, {
    siteEra, catalog: catalog || DEFAULT_CATALOG,
    partyLevel: seedPacket.party?.level,
    hazardFamily: seedPacket.siteDice?.hazardFamily,
  });
  const cv = validateContent(assigned);
  if (!cv.valid) throw new Error(`invalid content: ${cv.errors.join('; ')}`);

  const sceneRes = await dbRun(
    `INSERT INTO scenes (campaign_id, location_id, name, kind, seed_json, era, status)
     VALUES (?, ?, ?, ?, ?, ?, 'content')`,
    [campaignId, locationId, name, kind, JSON.stringify(seedPacket), assigned.sceneEra]
  );
  const sceneId = Number(sceneRes.lastInsertRowid);

  const roomIdByKey = new Map();
  for (let i = 0; i < assigned.rooms.length; i++) {
    const r = assigned.rooms[i];
    const res = await dbRun(
      `INSERT INTO scene_rooms
       (scene_id, room_key, role, label, features_json, encounter_json,
        encounter_budget_xp, state, sort_order,
        width_ft, length_ft, ceiling_ft, light_level, traps_json, treasure_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sceneId, r.key, r.role, r.label,
        JSON.stringify(r.features || []),
        r.encounter ? JSON.stringify(r.encounter) : null,
        r.encounterBudgetXp || 0, r.state || 'undiscovered', i,
        r.widthFt || null, r.lengthFt || null, r.ceilingFt || null, r.lightLevel || 'dark',
        JSON.stringify(r.traps || []),
        r.treasure ? JSON.stringify(r.treasure) : null,
      ]
    );
    roomIdByKey.set(r.key, Number(res.lastInsertRowid));
  }

  for (const c of assigned.connections) {
    const fromId = roomIdByKey.get(c.fromKey);
    const toId = roomIdByKey.get(c.toKey);
    if (!fromId || !toId) throw new Error(`connection references unstored room: ${c.fromKey}->${c.toKey}`);
    await dbRun(
      `INSERT INTO scene_connections
       (scene_id, from_room_id, to_room_id, kind, locked, trapped,
        distance_ft, elevation_ft, direction, trap_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sceneId, fromId, toId, c.kind, c.locked ? 1 : 0, c.trapped ? 1 : 0,
        c.distanceFt, c.elevationFt, c.direction,
        c.trap ? JSON.stringify(c.trap) : null,
      ]
    );
  }

  return { sceneId, roomIdByKey: Object.fromEntries(roomIdByKey), roomCount: assigned.rooms.length, connectionCount: assigned.connections.length, sceneEra: assigned.sceneEra };
}

/** Load a stored scene, with JSON columns parsed and geometry in camelCase (matching content objects). */
export async function loadScene(sceneId) {
  const scene = await dbGet('SELECT * FROM scenes WHERE id = ?', [sceneId]);
  if (!scene) return null;
  const roomRows = await dbAll('SELECT * FROM scene_rooms WHERE scene_id = ? ORDER BY sort_order ASC', [sceneId]);
  const connRows = await dbAll('SELECT * FROM scene_connections WHERE scene_id = ?', [sceneId]);
  const idToKey = new Map(roomRows.map(r => [r.id, r.room_key]));
  const rooms = roomRows.map(r => ({
    id: r.id, roomKey: r.room_key, key: r.room_key, role: r.role, label: r.label,
    features: safeParse(r.features_json, []),
    encounter: safeParse(r.encounter_json, null),
    encounterBudgetXp: r.encounter_budget_xp, state: r.state,
    widthFt: r.width_ft, lengthFt: r.length_ft, ceilingFt: r.ceiling_ft, lightLevel: r.light_level,
    traps: safeParse(r.traps_json, []),
    treasure: safeParse(r.treasure_json, null),
  }));
  const connections = connRows.map(c => ({
    id: c.id,
    fromKey: idToKey.get(c.from_room_id) || null,
    toKey: idToKey.get(c.to_room_id) || null,
    kind: c.kind, locked: !!c.locked, trapped: !!c.trapped,
    distanceFt: c.distance_ft, elevationFt: c.elevation_ft, direction: c.direction,
    trap: safeParse(c.trap_json, null),
  }));
  return {
    scene: {
      id: scene.id, campaignId: scene.campaign_id, locationId: scene.location_id,
      name: scene.name, kind: scene.kind, era: scene.era, status: scene.status,
      seedPacket: safeParse(scene.seed_json, null),
    },
    rooms, connections,
  };
}

/**
 * Pure DM digest over a loaded scene (loadScene shape). Throws for an
 * unknown current room — a digest for a room that does not exist is
 * worse than no digest.
 */
export function buildDmDigest(stored, currentRoomKey) {
  const rooms = stored.rooms || [];
  const connections = stored.connections || [];
  const current = rooms.find(r => (r.roomKey || r.key) === currentRoomKey);
  if (!current) throw new Error(`unknown room: ${currentRoomKey}`);
  const currentKey = current.roomKey || current.key;

  const exits = [];
  const hiddenExits = [];
  const adjacentKeys = new Set();
  const secretKeys = new Set();
  for (const c of connections) {
    const isFrom = c.fromKey === currentKey;
    const isTo = c.toKey === currentKey;
    if (!isFrom && !isTo) continue;
    const otherKey = isFrom ? c.toKey : c.fromKey;
    const direction = isFrom ? c.direction : invertDirection(c.direction);
    const exit = {
      roomKey: otherKey, direction, distanceFt: c.distanceFt,
      elevationFt: c.elevationFt, connectionKind: c.kind,
      locked: !!c.locked, trapped: !!c.trapped,
    };
    if (c.kind === 'secret') {
      hiddenExits.push({ ...exit, hidden: true, dmOnly: true });
      secretKeys.add(otherKey);
    } else {
      exits.push(exit);
      adjacentKeys.add(otherKey);
    }
  }

  const otherCount = rooms.filter(r => {
    const k = r.roomKey || r.key;
    return k !== currentKey && !adjacentKeys.has(k) && !secretKeys.has(k);
  }).length;

  return {
    sceneId: stored.scene?.id ?? null,
    sceneEra: stored.scene?.era ?? null,
    totalRooms: rooms.length,
    currentRoom: {
      roomKey: currentKey, role: current.role,
      designerLabel: current.label, designerLabelDmOnly: true,
      dimensions: { widthFt: current.widthFt, lengthFt: current.lengthFt, ceilingFt: current.ceilingFt },
      lightLevel: current.lightLevel, state: current.state,
      features: current.features || [],
      encounter: current.encounter || null,
      traps: current.traps || [],
      treasure: current.treasure || null,
      exits, hiddenExits,
    },
    adjacentRooms: exits,
    otherRooms: { count: otherCount },
  };
}

/** DB-backed digest: load the scene, then build the digest. */
export async function getDmDigest(sceneId, currentRoomKey) {
  const stored = await loadScene(sceneId);
  if (!stored) throw new Error(`unknown scene: ${sceneId}`);
  return buildDmDigest(stored, currentRoomKey);
}

/**
 * Pure SET_COVER feature check against a room's feature list.
 * Cover tier spelling is normalized ('three_quarters' -> 'three-quarters')
 * for comparison only; the stored cover string is the handler's business.
 * Returns { valid, reason, feature, coverTier } where reason is null on
 * success and one of 'feature_required' | 'feature_not_found' |
 * 'feature_not_cover' | 'feature_tier_mismatch' on failure. Never throws
 * for a bad name — a named feature that is not in the room is a failed
 * validation, not an exception, because the handler must surface it.
 */
export function validateCoverFeature(features, { feature, cover } = {}) {
  const wanted = String(feature || '').trim().toLowerCase();
  if (!wanted) return { valid: false, reason: 'feature_required', feature: null, coverTier: null };
  const list = Array.isArray(features) ? features : [];
  const match = list.find(f => String(f?.name || '').trim().toLowerCase() === wanted) || null;
  if (!match) return { valid: false, reason: 'feature_not_found', feature: null, coverTier: null };
  if (!match.coverTier) return { valid: false, reason: 'feature_not_cover', feature: match, coverTier: null };
  const requested = String(cover || '').toLowerCase() === 'three_quarters' ? 'three-quarters' : String(cover || '').toLowerCase();
  if (match.coverTier !== requested) {
    return { valid: false, reason: 'feature_tier_mismatch', feature: match, coverTier: match.coverTier };
  }
  return { valid: true, reason: null, feature: match, coverTier: match.coverTier };
}

/** Names of the cover features in a room's feature list (for failure notes). */
export function coverFeatureNames(features) {
  return (Array.isArray(features) ? features : [])
    .filter(f => f?.coverTier)
    .map(f => f.name);
}

/**
 * Link an encounter to the scene room it is fought in. Throws for an
 * unknown scene or a room key that is not in that scene — a link to a
 * room that does not exist would make validation lie. Re-linking the
 * same encounter replaces the previous room (the party moved).
 */
export async function setEncounterRoom({ sessionId, encounterSeq, sceneId, roomKey } = {}) {
  if (!sessionId || !encounterSeq || !sceneId || !roomKey) {
    throw new Error('setEncounterRoom requires sessionId, encounterSeq, sceneId and roomKey');
  }
  const scene = await dbGet('SELECT id FROM scenes WHERE id = ?', [sceneId]);
  if (!scene) throw new Error(`unknown scene: ${sceneId}`);
  const room = await dbGet(
    'SELECT id FROM scene_rooms WHERE scene_id = ? AND room_key = ?',
    [sceneId, roomKey]
  );
  if (!room) throw new Error(`unknown room in scene ${sceneId}: ${roomKey}`);
  const existing = await dbGet(
    'SELECT id FROM encounter_scene_rooms WHERE session_id = ? AND encounter_seq = ?',
    [sessionId, encounterSeq]
  );
  if (existing) {
    await dbRun(
      'UPDATE encounter_scene_rooms SET scene_id = ?, room_key = ? WHERE id = ?',
      [sceneId, roomKey, existing.id]
    );
  } else {
    await dbRun(
      'INSERT INTO encounter_scene_rooms (session_id, encounter_seq, scene_id, room_key) VALUES (?, ?, ?, ?)',
      [sessionId, encounterSeq, sceneId, roomKey]
    );
  }
  return { sessionId, encounterSeq, sceneId, roomKey };
}

/**
 * The linked room for an encounter, with its stored features parsed, or
 * null when nothing is linked. A null here is not an error — it means
 * the fight is not in a scene room, so there is no feature list to
 * validate against (SET_COVER then keeps its pre-Phase-B grant).
 */
export async function getEncounterRoom(sessionId, encounterSeq) {
  if (!sessionId || !encounterSeq) return null;
  const link = await dbGet(
    'SELECT * FROM encounter_scene_rooms WHERE session_id = ? AND encounter_seq = ?',
    [sessionId, encounterSeq]
  );
  if (!link) return null;
  const room = await dbGet(
    'SELECT * FROM scene_rooms WHERE scene_id = ? AND room_key = ?',
    [link.scene_id, link.room_key]
  );
  if (!room) return null;
  return {
    sessionId, encounterSeq, sceneId: link.scene_id, roomKey: link.room_key,
    features: safeParse(room.features_json, []),
  };
}

export default { storeScene, loadScene, buildDmDigest, getDmDigest, validateCoverFeature, coverFeatureNames, setEncounterRoom, getEncounterRoom };
