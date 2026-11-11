/**
 * dungeonSkeletonService — deterministic dungeon skeleton generation
 * and validation (Dungeon generation + scene layer, Phase A).
 *
 * Phase A covers the deterministic core ONLY: given a seed packet
 * (sceneSeedService), produce a room graph — roles, connections,
 * geometry, per-room encounter budgets — and prove it valid. No
 * dressing, no content assignment, no provider: Phase B fills
 * features_json/encounter_json, Phase C dresses rooms on entry.
 *
 * Two representations, kept apart on purpose:
 *   - A SKELETON (this module) references rooms by KEY
 *     ({ key: 'r3', ... }, connections { fromKey, toKey }).
 *   - A STORED scene (migration 086) references rooms by DB id
 *     (scene_connections.from_room_id/to_room_id). Phase B storage
 *     translates keys -> ids at insert time. The validator works on
 *     skeletons, never on DB rows.
 * Field naming follows the codebase convention: skeleton objects use
 * camelCase, DB rows use snake_case.
 *
 * Generation guarantees (validator-checked, not hoped for):
 *   - reachability: every room reachable from the entrance (the
 *     generator builds a spanning tree, then adds loop edges)
 *   - exactly one boss room, at maximum BFS depth, never the entrance
 *   - at most one treasure room (roomCount >= 6)
 *   - every connection references an existing room key; no self-loops;
 *     no duplicate undirected edges
 *   - per-room encounter budgets recomputed from the DMG thresholds
 *     (see ENCOUNTER_XP_THRESHOLDS note below)
 */

import { pick } from '../utils/rng.js';

export const ROOM_ROLES = ['entrance', 'corridor', 'chamber', 'boss', 'treasure'];
export const CONNECTION_KINDS = ['door', 'passage', 'secret', 'stairs'];
export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * DMG encounter XP thresholds per character, by level
 * (easy/medium/hard/deadly). NOTE (Phase B verification): these are
 * the long-standing DMG table values; confirm against the 2024 DMG
 * encounter-building section when Phase B wires real bestiary XP
 * against them. The validator treats an unknown level as an error
 * rather than silently inventing a band.
 */
export const ENCOUNTER_XP_THRESHOLDS = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400],
  4: [125, 250, 375, 500], 5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100], 9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200], 17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700],
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function thresholdsFor(level) {
  return ENCOUNTER_XP_THRESHOLDS[level] || null;
}

/** Expected encounter budget for a room role, in total party XP. */
export function budgetForRole(role, partyLevel, partySize) {
  const t = thresholdsFor(partyLevel);
  if (!t) return null;
  const [, medium, , deadly] = t;
  if (role === 'entrance' || role === 'treasure') return 0;
  if (role === 'boss') return partySize * deadly;
  return partySize * medium;
}

function labelFor(role, index) {
  if (role === 'entrance') return 'Entrance';
  if (role === 'boss') return 'Boss Lair';
  if (role === 'treasure') return 'Treasure Vault';
  if (role === 'corridor') return `Corridor ${index}`;
  return `Chamber ${index}`;
}

/**
 * Generate one skeleton. pickFn defaults to the system roller;
 * tests inject a deterministic picker (first element) to pin output.
 * roomCount default scales with party level: 6 + level, clamped 8..16.
 */
export function generateSkeleton(seedPacket, { roomCount, pickFn = pick } = {}) {
  const { level, size } = seedPacket.party;
  const count = roomCount ?? clamp(6 + level, 8, 16);
  const total = clamp(count, 4, 24);

  // Rooms: entrance first, then the rest in creation order.
  const rooms = [{ key: 'r1', role: 'entrance', label: 'Entrance', features: [], encounterBudgetXp: 0, state: 'undiscovered' }];
  let corridorN = 0;
  let chamberN = 0;
  for (let i = 2; i <= total; i++) {
    const role = pickFn(['chamber', 'chamber', 'corridor']);
    const label = role === 'corridor' ? labelFor(role, ++corridorN) : labelFor(role, ++chamberN);
    rooms.push({ key: `r${i}`, role, label, features: [], encounterBudgetXp: 0, state: 'undiscovered' });
  }

  // Pick one room from a list by key, once. A picker that returns
  // an unknown key (or undefined) falls back to the first room, so
  // deterministic test pickers can never produce a dangling edge.
  const pickRoom = (list) => list.find(r => r.key === pickFn(list.map(x => x.key))) ?? list[0];

  // Spanning tree: each new room attaches to a random earlier room,
  // which guarantees reachability by construction.
  const connections = [];
  for (let i = 2; i <= total; i++) {
    const key = `r${i}`;
    const fromKey = pickRoom(rooms.slice(0, i - 1)).key;
    connections.push({
      fromKey, toKey: key, kind: 'passage', locked: false, trapped: false,
      distanceFt: pickFn([20, 30, 30, 40, 60]),
      elevationFt: 0,
      direction: pickFn(DIRECTIONS),
    });
  }

  // Loop edges: 1-2 extra connections between existing rooms for
  // non-tree interest. One becomes a secret passage on big dungeons;
  // one becomes stairs (verticality, N9) when the dungeon is big.
  // Loops go in BEFORE role assignment: a loop edge can shortcut
  // toward a deep room, so boss depth must be measured on the final
  // graph (BFS), not on the tree.
  const existingPairs = new Set(connections.map(c => [c.fromKey, c.toKey].sort().join('|')));
  const loopCount = total >= 12 ? 2 : 1;
  for (let n = 0; n < loopCount; n++) {
    const a = pickRoom(rooms);
    const b = pickRoom(rooms);
    if (a === b) continue;
    const pair = [a.key, b.key].sort().join('|');
    if (existingPairs.has(pair)) continue;
    existingPairs.add(pair);
    const isSecret = total >= 10 && n === 0;
    const isStairs = total >= 8 && n === loopCount - 1 && !isSecret;
    connections.push({
      fromKey: a.key, toKey: b.key,
      kind: isSecret ? 'secret' : isStairs ? 'stairs' : 'passage',
      locked: false, trapped: false,
      distanceFt: pickFn([20, 30, 30, 40, 60]),
      elevationFt: isStairs ? pickFn([-15, -10, 10, 15]) : 0,
      direction: pickFn(DIRECTIONS),
    });
  }

  // Boss = a max-BFS-depth room on the FINAL graph (never the
  // entrance). Treasure = one non-boss, non-entrance room when the
  // dungeon is big enough.
  const depths = roomDepths({ rooms, connections });
  const maxDepth = Math.max(...Object.values(depths));
  const deepest = rooms.filter(r => depths[r.key] === maxDepth && r.key !== 'r1');
  const bossRoom = pickRoom(deepest);
  bossRoom.role = 'boss';
  bossRoom.label = 'Boss Lair';
  if (total >= 6) {
    const candidates = rooms.filter(r => r !== bossRoom && r.key !== 'r1');
    const treasureRoom = pickRoom(candidates);
    treasureRoom.role = 'treasure';
    treasureRoom.label = 'Treasure Vault';
  }

  // Doors into boss/treasure rooms; the boss door is locked (the key
  // is Phase B content). Traps stay false in Phase A — Phase B sets
  // them from the trap tables.
  const specialKeys = new Set(rooms.filter(r => r.role === 'boss' || r.role === 'treasure').map(r => r.key));
  for (const c of connections) {
    if (specialKeys.has(c.toKey) || specialKeys.has(c.fromKey)) {
      c.kind = c.kind === 'secret' ? 'secret' : 'door';
      if (specialKeys.has(c.toKey) && rooms.find(r => r.key === c.toKey)?.role === 'boss') c.locked = true;
    }
  }

  // Budgets per role, from the packet.
  for (const room of rooms) {
    room.encounterBudgetXp = budgetForRole(room.role, level, size) ?? 0;
  }

  const skeleton = { seedPacket, rooms, connections };
  return { ...skeleton, score: scoreSkeleton(skeleton) };
}

/** Score a skeleton for best-of-3 selection (higher is better). */
export function scoreSkeleton(skeleton) {
  let score = 0;
  const kinds = new Set(skeleton.connections.map(c => c.kind));
  if (skeleton.connections.length > skeleton.rooms.length - 1) score += 2; // has a loop edge
  if (kinds.has('secret')) score += 1;
  if (kinds.has('stairs')) score += 1;
  if (skeleton.rooms.some(r => r.role === 'treasure')) score += 1;
  const depths = roomDepths(skeleton);
  if (Math.max(...Object.values(depths)) >= 3) score += 1;
  return score;
}

/** BFS depths from the entrance over undirected connections. */
export function roomDepths(skeleton) {
  const adj = new Map(skeleton.rooms.map(r => [r.key, []]));
  for (const c of skeleton.connections) {
    adj.get(c.fromKey)?.push(c.toKey);
    adj.get(c.toKey)?.push(c.fromKey);
  }
  const entrance = skeleton.rooms.find(r => r.role === 'entrance');
  const depths = {};
  if (!entrance) return depths;
  const queue = [entrance.key];
  depths[entrance.key] = 0;
  while (queue.length) {
    const cur = queue.shift();
    for (const next of adj.get(cur) ?? []) {
      if (depths[next] === undefined) {
        depths[next] = depths[cur] + 1;
        queue.push(next);
      }
    }
  }
  return depths;
}

/**
 * Validate a skeleton against its seed packet. Returns
 * { valid, errors[] }. Every check recomputes from the packet and
 * the threshold table — the validator never trusts the generator.
 */
export function validateSkeleton(skeleton, seedPacket) {
  const errors = [];
  const { rooms, connections } = skeleton;
  const { level, size } = seedPacket.party;

  if (!rooms.length) errors.push('no rooms');
  const keys = rooms.map(r => r.key);
  if (new Set(keys).size !== keys.length) errors.push('duplicate room keys');
  if (rooms.filter(r => r.role === 'entrance').length !== 1) errors.push('must have exactly one entrance');
  if (rooms.filter(r => r.role === 'boss').length !== 1) errors.push('must have exactly one boss room');
  if (rooms.filter(r => r.role === 'treasure').length > 1) errors.push('at most one treasure room');
  const boss = rooms.find(r => r.role === 'boss');
  if (boss && boss.role === 'entrance') errors.push('boss must not be the entrance');
  for (const r of rooms) {
    if (!r.label) errors.push(`room ${r.key} has no label`);
    if (!Array.isArray(r.features)) errors.push(`room ${r.key} features must be an array`);
  }

  const keySet = new Set(keys);
  const seenPairs = new Set();
  for (const c of connections) {
    if (!keySet.has(c.fromKey) || !keySet.has(c.toKey)) errors.push(`connection references unknown room: ${c.fromKey}->${c.toKey}`);
    if (c.fromKey === c.toKey) errors.push(`self-loop on ${c.fromKey}`);
    const pair = [c.fromKey, c.toKey].sort().join('|');
    if (seenPairs.has(pair)) errors.push(`duplicate connection ${pair}`);
    seenPairs.add(pair);
    if (!CONNECTION_KINDS.includes(c.kind)) errors.push(`unknown connection kind ${c.kind}`);
    if (!(c.distanceFt > 0)) errors.push(`connection ${c.fromKey}->${c.toKey} has non-positive distance`);
    if (!Number.isInteger(c.elevationFt)) errors.push(`connection ${c.fromKey}->${c.toKey} has non-integer elevation`);
    if (c.direction !== null && c.direction !== undefined && !DIRECTIONS.includes(c.direction)) errors.push(`unknown direction ${c.direction}`);
    if (typeof c.locked !== 'boolean' || typeof c.trapped !== 'boolean') errors.push(`connection ${c.fromKey}->${c.toKey} locked/trapped must be boolean`);
  }

  const depths = roomDepths(skeleton);
  if (Object.keys(depths).length !== rooms.length) errors.push('not all rooms reachable from the entrance');
  if (boss && Object.keys(depths).length) {
    const maxDepth = Math.max(...Object.values(depths));
    if (depths[boss.key] !== maxDepth) errors.push('boss room is not at maximum depth');
  }

  if (!thresholdsFor(level)) {
    errors.push(`no encounter thresholds for party level ${level}`);
  } else {
    for (const r of rooms) {
      const expected = budgetForRole(r.role, level, size);
      if (r.encounterBudgetXp !== expected) errors.push(`room ${r.key} budget ${r.encounterBudgetXp} != expected ${expected} for role ${r.role}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Best-of-3: generate three skeletons, keep the highest score. */
export function generateBestSkeleton(seedPacket, options = {}) {
  let best = null;
  for (let i = 0; i < 3; i++) {
    const candidate = generateSkeleton(seedPacket, options);
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}
