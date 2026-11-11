/**
 * Movement Service — combat item 4, movement v1 (zones).
 *
 * The fight is a graph of named areas, not a grid: "the bridge",
 * "the treeline", "the altar" — areas, not whole rooms — joined by
 * foot-cost edges (difficult edges cost double to walk). Distance
 * between two combatants is the shortest foot path through the
 * graph; two combatants in the same area are 5 ft apart for reach
 * and range purposes. No zones declared = one area ("the fight"):
 * a brawl, all melee. Zone names cannot contain ',', ':', '-' or
 * '|' (they are the list, feet, edge, and edge-key separators).
 *
 * State home is combat_turn_state (Q6): zones_json holds
 * { zones, edges, positions }; movement budgets ride the per-slot
 * turn budget (migration 093) as moveSpent/dashed fields, so a new
 * turn starts fresh by construction and re-init wipes them. The row
 * dies on COMBAT_END, so no graph survives a fight.
 *
 * Distance checks fail OPEN: a broken lookup never blocks an
 * attack (the DM adjudicates). Budget writes fail CLOSED: a move
 * that cannot record its spend is refused, so movement can never
 * silently go unspent. Enemy regular attacks are NOT range-gated:
 * enemies carry no weapon model, so an enemy archer's shot cannot
 * be told from a melee swing — enemy attack ranges stay DM-side
 * (Q2) until item 5 gives enemies weapons. Opportunity attacks are
 * exempt from position checks everywhere: an OA is valid because
 * a MOVE provoked it, and the book resolves it just before the
 * target leaves reach — current positions would refuse every
 * legitimate cross-zone OA.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { currentSlotKey, readLedger, budgetIn, updateBudgetForSlot } from './turnLedgerService.js';
import { combatFallbackId } from './worldIdService.js';
import { walkSpeedFor } from './speciesService.js';
import { lookupWeaponData } from './combatStatsService.js';

const DEFAULT_ZONE = 'the fight';

export function normalizeZone(name) {
  return String(name || '').trim().toLowerCase();
}

export function edgeKey(a, b) {
  const [x, y] = [normalizeZone(a), normalizeZone(b)].sort();
  return `${x}|${y}`;
}

// ---------------------------------------------------------------------------
// Zone graph IO
// ---------------------------------------------------------------------------

export async function readZones(sessionId, encounterSeq) {
  try {
    const row = await dbGet(
      'SELECT zones_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?',
      [sessionId, encounterSeq]
    );
    if (!row) return null;
    const parsed = safeParse(row.zones_json, {});
    return {
      zones: Array.isArray(parsed.zones) ? parsed.zones : [],
      edges: parsed.edges && typeof parsed.edges === 'object' ? parsed.edges : {},
      positions: parsed.positions && typeof parsed.positions === 'object' ? parsed.positions : {},
    };
  } catch { return null; }
}

export async function writeZones(sessionId, encounterSeq, data) {
  try {
    const r = await dbRun(
      'UPDATE combat_turn_state SET zones_json = ? WHERE session_id = ? AND encounter_seq = ?',
      [JSON.stringify(data), sessionId, encounterSeq]
    );
    return (r.changes || 0) > 0;
  } catch { return false; }
}

export function defaultZone(data) {
  return data && data.zones && data.zones.length ? data.zones[0] : DEFAULT_ZONE;
}

export function positionOf(data, key) {
  if (!data) return DEFAULT_ZONE;
  return data.positions[key] || defaultZone(data);
}

// ---------------------------------------------------------------------------
// Distances: geometric (reach/range) vs movement cost (budgets)
// ---------------------------------------------------------------------------

function neighbors(data, zone) {
  const out = [];
  for (const [key, edge] of Object.entries(data.edges || {})) {
    const [a, b] = key.split('|');
    if (a === zone && b) out.push({ to: b, feet: edge.feet, difficult: !!edge.difficult });
    else if (b === zone && a) out.push({ to: a, feet: edge.feet, difficult: !!edge.difficult });
  }
  return out;
}

function shortestPath(data, from, to, costFn) {
  from = normalizeZone(from);
  to = normalizeZone(to);
  if (from === to) return { cost: 0, path: [from] };
  const dist = { [from]: 0 };
  const prev = {};
  const visited = new Set();
  for (;;) {
    let cur = null;
    let best = Infinity;
    for (const [z, d] of Object.entries(dist)) {
      if (!visited.has(z) && d < best) { best = d; cur = z; }
    }
    if (cur === null) return null;
    if (cur === to) break;
    visited.add(cur);
    for (const nb of neighbors(data, cur)) {
      const nd = dist[cur] + costFn(nb);
      if (dist[nb.to] === undefined || nd < dist[nb.to]) { dist[nb.to] = nd; prev[nb.to] = cur; }
    }
  }
  const path = [];
  let z = to;
  while (z !== undefined) { path.unshift(z); z = prev[z]; }
  return { cost: dist[to], path };
}

export function distanceBetweenZones(data, zoneA, zoneB) {
  const za = normalizeZone(zoneA);
  const zb = normalizeZone(zoneB);
  if (za === zb) return { feet: 5, path: [za] };
  if (!data || !data.zones || data.zones.length === 0) return { feet: 5, path: null };
  const found = shortestPath(data, za, zb, (nb) => nb.feet);
  if (!found) return { feet: null, path: null };
  return { feet: found.cost, path: found.path };
}

export function geometricDistance(data, keyA, keyB) {
  if (!data || !data.zones || data.zones.length === 0) return { feet: 5, path: null };
  return distanceBetweenZones(data, positionOf(data, keyA), positionOf(data, keyB));
}

export async function distanceBetween(sessionId, encounterSeq, keyA, keyB) {
  const data = await readZones(sessionId, encounterSeq);
  return geometricDistance(data, keyA, keyB);
}

export function moveCost(data, fromZone, toZone) {
  if (!data || !data.zones || data.zones.length === 0) return null;
  const from = normalizeZone(fromZone);
  const to = normalizeZone(toZone);
  if (from === to) return { cost: 0, path: [from] };
  const found = shortestPath(data, from, to, (nb) => nb.feet * (nb.difficult ? 2 : 1));
  return found;
}

// ---------------------------------------------------------------------------
// Weapons: reach and range bands from the weapon catalog
// ---------------------------------------------------------------------------

export function weaponReach(label) {
  try {
    const w = lookupWeaponData(label);
    if (w && Array.isArray(w.properties) && w.properties.includes('reach')) return 10;
  } catch { /* fall through to 5 */ }
  return 5;
}

export function parseRange(range) {
  if (typeof range !== 'string') return null;
  const m = range.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  return { short: Number(m[1]), long: Number(m[2]) };
}

export function weaponRange(label) {
  try {
    const w = lookupWeaponData(label);
    return parseRange(w?.range);
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Speed: species base, bestiary, else 30. Heavy armor deferred.
// ---------------------------------------------------------------------------

const SPECIES_SPEED = {
  human: 30, dwarf: 25, elf: 30, 'wood elf': 35, 'high elf': 30, 'dark elf': 30, drow: 30,
  halfling: 25, gnome: 25, 'half-orc': 30, orc: 30, tiefling: 30, dragonborn: 30,
  'half-elf': 30, goblin: 30, hobgoblin: 30, goliath: 35, tabaxi: 30, aasimar: 30,
  bugbear: 30, kobold: 30, lizardfolk: 30, triton: 30, 'sea elf': 30, firbolg: 30,
  kenku: 30, tortle: 30, centaur: 40, satyr: 35, changeling: 30, shifter: 30,
};

// Registry first, hardcoded map second, 30 last. The registry fixes
// the real bug the map cannot express: a variant's speed (Wood Elf
// 35, where the row only stores race 'elf'). The map stays as the
// fallback for species the registry does not cover yet (goblin,
// tabaxi, centaur 40, …) so nothing unregistered changes behavior.
export function speedForSpecies(race, subrace) {
  if (!race) return 30;
  const registrySpeed = walkSpeedFor(race, subrace);
  if (registrySpeed) return registrySpeed;
  return SPECIES_SPEED[String(race).trim().toLowerCase()] ?? 30;
}

export async function speedFor(sessionId, kind, id) {
  try {
    if (kind === 'player') {
      const row = await dbGet('SELECT * FROM characters WHERE id = ?', [id]);
      return speedForSpecies(row?.race ?? row?.species ?? null, row?.subrace ?? null);
    }
    if (kind === 'companion') {
      const row = await dbGet(
        'SELECT c.*, n.race AS npc_race FROM companions c LEFT JOIN npcs n ON n.id = c.npc_id WHERE c.id = ?',
        [id]
      );
      return speedForSpecies(row?.npc_race ?? row?.race ?? null, row?.companion_subrace ?? null);
    }
    const row = await dbGet('SELECT * FROM combat_enemies WHERE id = ?', [id]);
    if (row) {
      if (Number.isFinite(Number(row.speed)) && Number(row.speed) > 0) return Number(row.speed);
      try {
        const { lookupBestiary } = await import('./bestiaryService.js');
        const entry = await lookupBestiary(row.name);
        if (entry && Number.isFinite(Number(entry.speed)) && Number(entry.speed) > 0) return Number(entry.speed);
      } catch { /* fall through to 30 */ }
    }
  } catch { /* fall through to 30 */ }
  return 30;
}

export async function reachFor(sessionId, kind, id) {
  try {
    if (kind === 'player' || kind === 'companion') {
      const table = kind === 'player' ? 'characters' : 'companions';
      const row = await dbGet(`SELECT equipment FROM ${table} WHERE id = ?`, [id]);
      const eq = safeParse(row?.equipment, {});
      const name = eq?.mainHand?.name || (typeof eq?.mainHand === 'string' ? eq.mainHand : null);
      if (name) return weaponReach(name);
      return 5;
    }
    const row = await dbGet('SELECT * FROM combat_enemies WHERE id = ?', [id]);
    if (row) {
      const snap = safeParse(row.stats_json, null);
      if (snap && Number.isFinite(Number(snap.reach)) && Number(snap.reach) > 0) return Number(snap.reach);
      try {
        const { lookupBestiary } = await import('./bestiaryService.js');
        const entry = await lookupBestiary(row.name);
        if (entry && Number.isFinite(Number(entry.reach)) && Number(entry.reach) > 0) return Number(entry.reach);
      } catch { /* fall through to 5 */ }
    }
  } catch { /* fall through to 5 */ }
  return 5;
}

// ---------------------------------------------------------------------------
// Speed 0: 2024 Grappled and Restrained both set speed to 0.
// Best-effort and fail-open: an unreadable list never blocks a move.
// ---------------------------------------------------------------------------

function conditionNames(conds) {
  const list = Array.isArray(conds) ? conds : [];
  return list.map((c) => {
    if (typeof c === 'string') return c.toLowerCase();
    if (c && typeof c === 'object') return String(c.key ?? c.name ?? c.condition ?? '').toLowerCase();
    return '';
  }).filter(Boolean);
}

export async function isSpeedZero(sessionId, kind, id) {
  try {
    if (kind === 'enemy') {
      const row = await dbGet('SELECT active_conditions FROM combat_enemies WHERE id = ?', [id]);
      const names = conditionNames(safeParse(row?.active_conditions, []));
      return names.includes('grappled') || names.includes('restrained');
    }
    const { getConditions } = await import('./conditionService.js');
    const names = conditionNames(await getConditions(kind, id));
    return names.includes('grappled') || names.includes('restrained');
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Movement budgets (per turn slot, in the turn budget)
// ---------------------------------------------------------------------------

export async function moveBudget(sessionId, encounterSeq, combatantKey) {
  try {
    const slot = await currentSlotKey(sessionId, encounterSeq);
    if (!slot) return null;
    const ledger = await readLedger(sessionId, encounterSeq);
    const budget = budgetIn(ledger, slot, combatantKey) || {};
    return { slot, spent: Number(budget.moveSpent) || 0, dashed: !!budget.dashed };
  } catch { return null; }
}

export async function spendMove(sessionId, encounterSeq, combatantKey, feet) {
  const cur = await moveBudget(sessionId, encounterSeq, combatantKey);
  if (!cur) return null;
  if (!feet) return cur;
  return updateBudgetForSlot(sessionId, encounterSeq, cur.slot, combatantKey, { moveSpent: cur.spent + feet });
}

export async function setDashed(sessionId, encounterSeq, combatantKey) {
  const cur = await moveBudget(sessionId, encounterSeq, combatantKey);
  if (!cur) return null;
  return updateBudgetForSlot(sessionId, encounterSeq, cur.slot, combatantKey, { dashed: true });
}

// ---------------------------------------------------------------------------
// Turn order + keys
// ---------------------------------------------------------------------------

export async function turnOrderEntries(sessionId, encounterSeq) {
  try {
    const row = await dbGet(
      'SELECT turn_order_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?',
      [sessionId, encounterSeq]
    );
    const list = safeParse(row?.turn_order_json, []);
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function sideOf(entry) {
  return entry?.type === 'enemy' ? 'enemy' : 'party';
}

export async function resolveKey(sessionId, encounterSeq, key) {
  if (!key) return null;
  if (key.startsWith('combat:')) {
    const parts = key.split(':');
    const id = Number(parts[parts.length - 1]);
    return Number.isFinite(id) ? { kind: 'enemy', id } : null;
  }
  if (key.startsWith('player:')) {
    const id = Number(key.slice('player:'.length));
    return Number.isFinite(id) ? { kind: 'player', id } : null;
  }
  if (key.startsWith('companion:')) {
    const id = Number(key.slice('companion:'.length));
    return Number.isFinite(id) ? { kind: 'companion', id } : null;
  }
  try {
    const npc = await dbGet('SELECT id FROM npcs WHERE world_id = ?', [key]);
    if (npc) {
      const comp = await dbGet('SELECT id FROM companions WHERE npc_id = ?', [npc.id]);
      if (comp) return { kind: 'companion', id: comp.id };
    }
    const ch = await dbGet('SELECT id FROM characters WHERE world_id = ?', [key]);
    if (ch) return { kind: 'player', id: ch.id };
  } catch { /* fall through to null */ }
  return null;
}

export async function keyForEnemyName(sessionId, encounterSeq, name) {
  if (!name) return null;
  try {
    const row = await dbGet(
      'SELECT id FROM combat_enemies WHERE session_id = ? AND encounter_seq = ? AND LOWER(name) = LOWER(?) ORDER BY id DESC LIMIT 1',
      [sessionId, encounterSeq, name]
    );
    if (row) return combatFallbackId(sessionId, encounterSeq, row.id);
  } catch { /* fall through to null */ }
  return null;
}

// ---------------------------------------------------------------------------
// Opportunity attacks: whoever's reach the mover leaves, step by step.
// Disengaged or hidden movers provoke nobody (checked by the caller).
// ---------------------------------------------------------------------------

export async function provokedByMove(sessionId, encounterSeq, moverKey, moverSide, pathZones, moverHidden, moverDisengaged) {
  if (moverDisengaged || moverHidden) return [];
  if (!pathZones || pathZones.length < 2) return [];
  const data = await readZones(sessionId, encounterSeq);
  const entries = await turnOrderEntries(sessionId, encounterSeq);
  const provoked = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry?.key || entry.key === moverKey) continue;
    if (sideOf(entry) === moverSide) continue;
    if (seen.has(entry.key)) continue;
    const resolved = await resolveKey(sessionId, encounterSeq, entry.key);
    const reach = resolved ? await reachFor(sessionId, resolved.kind, resolved.id) : 5;
    const oppZone = positionOf(data, entry.key);
    for (let i = 0; i + 1 < pathZones.length; i++) {
      const before = distanceBetweenZones(data, oppZone, pathZones[i]);
      const after = distanceBetweenZones(data, oppZone, pathZones[i + 1]);
      if (before.feet !== null && after.feet !== null && before.feet <= reach && after.feet > reach) {
        provoked.push({ key: entry.key, name: entry.name || entry.key });
        seen.add(entry.key);
        break;
      }
    }
  }
  return provoked;
}

// ---------------------------------------------------------------------------
// Attack distance gate (party attacks only — see the header on enemies).
// Returns null when the attack may proceed, { reason } when it must
// not, { disadvantage, reason } for a long-range shot, or { note }
// when disconnected zones make range unjudgeable (the shot proceeds
// and the DM adjudicates — refusing archery across a chasm because
// no foot path exists would be wrong). Fail-open throughout.
// ---------------------------------------------------------------------------

export async function checkAttackDistance(sessionId, encounterSeq, attackerKey, attackerKind, attackerId, targetEnemy, profile) {
  try {
    if (!profile || profile.spellAttack) return null;
    if (!targetEnemy?.id) return null;
    const data = await readZones(sessionId, encounterSeq);
    const targetKey = combatFallbackId(sessionId, encounterSeq, targetEnemy.id);
    const d = geometricDistance(data, attackerKey, targetKey);
    if (d.feet === null) {
      const isRanged = profile.rangeType === 'ranged' || profile.thrown === true;
      if (isRanged) return { note: 'rangeUnchecked' };
      return { reason: 'no path between the attacker and the target areas' };
    }
    if (profile.thrown === true) {
      const band = parseRange(profile.thrownRange || profile.range) || { short: 20, long: 60 };
      if (d.feet > band.long) return { reason: `the target is ${d.feet} ft away — beyond the ${profile.label}'s long range (${band.long} ft)` };
      if (d.feet > band.short) return { disadvantage: true, reason: `long range (${d.feet} ft)` };
      return null;
    }
    if (profile.rangeType === 'ranged') {
      const range = parseRange(profile.range);
      if (!range) return null;
      if (d.feet > range.long) return { reason: `the target is ${d.feet} ft away — beyond the ${profile.label}'s long range (${range.long} ft)` };
      if (d.feet > range.short) return { disadvantage: true, reason: `long range (${d.feet} ft)` };
      return null;
    }
    const reach = (profile.properties || []).includes('reach') ? 10 : 5;
    if (d.feet > reach) return { reason: `the target is ${d.feet} ft away — beyond the ${profile.label}'s reach (${reach} ft)` };
    return null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Cleave follow-up gate: second target within 5 ft of the first AND
// within the attacker's reach. { unchecked: true } when the first
// target's position is unknowable (its row is gone) — the follow-up
// proceeds and the DM adjudicates, because a refused follow-up must
// never consume the flag on missing bookkeeping. Callers check
// BEFORE consumeCleaveFlag, so a refused follow-up stays available.
// ---------------------------------------------------------------------------

export async function checkCleaveDistance(sessionId, encounterSeq, attackerKey, firstTargetName, secondEnemy, reach) {
  try {
    if (!firstTargetName || !secondEnemy?.id) return { unchecked: true };
    const firstKey = await keyForEnemyName(sessionId, encounterSeq, firstTargetName);
    if (!firstKey) return { unchecked: true };
    const secondKey = combatFallbackId(sessionId, encounterSeq, secondEnemy.id);
    const data = await readZones(sessionId, encounterSeq);
    const between = geometricDistance(data, firstKey, secondKey);
    if (between.feet === null) return { reason: 'the second target is not within 5 ft of the first target (no path between their areas)' };
    if (between.feet > 5) return { reason: `the second target is ${between.feet} ft from the first target — Cleave needs it within 5 ft` };
    const d = geometricDistance(data, attackerKey, secondKey);
    if (d.feet === null) return { reason: 'the second target cannot be reached from the attacker (no path between their areas)' };
    if (d.feet > reach) return { reason: `the second target is ${d.feet} ft away — beyond reach (${reach} ft)` };
    return null;
  } catch { return { unchecked: true }; }
}

// ---------------------------------------------------------------------------
// Teleport — mechanics hooks, Family 5 (shared piece, 2026-11-09).
// Wild Magic rows 41–44 (Short Teleports, 20 ft as a bonus action)
// and 73–76 (Long Teleport, 60 ft), Astral Jaunt's return, and the
// Echo Knight teleport-swap (Amendment 2 §1.4) all use this one
// function. The fight is a zone graph, not a grid: a "space" is a
// zone, and a zone is "unoccupied" when no other combatant's position
// key sits in it. That is an approximation the zone model forces —
// several combatants routinely share a zone in ordinary movement —
// so the strict occupancy refusal only bites when the caller asks
// for it (opts.strictOccupancy) or when finding a return space
// (nearestUnoccupiedZone). Otherwise a teleport lands in the named
// zone and records the position like any other move.
// ---------------------------------------------------------------------------

/**
 * Pure: occupants of each zone in a zones blob, as
 * { [zone]: [actorKey, ...] }. The actor's own key is NOT excluded
 * here — callers exclude it when they mean "other occupants".
 */
export function occupantsByZone(data) {
  const out = {};
  const positions = (data && data.positions && typeof data.positions === 'object') ? data.positions : {};
  for (const [key, zone] of Object.entries(positions)) {
    const z = normalizeZone(zone);
    if (!out[z]) out[z] = [];
    out[z].push(key);
  }
  return out;
}

/** Pure: true when no combatant other than `actorKey` sits in `zone`. */
export function isZoneUnoccupied(data, zone, actorKey) {
  const occupants = occupantsByZone(data)[normalizeZone(zone)] || [];
  return !occupants.some((k) => k !== actorKey);
}

/**
 * Pure: the nearest zone to `fromZone` (by graph distance, self
 * included) with no occupant other than `actorKey`, or null when
 * every zone is occupied. Used by the Astral Jaunt return ("the
 * space you previously occupied or the nearest unoccupied space if
 * that space is occupied") and by any teleport that must land in a
 * free space. Zones with no path from `fromZone` are skipped, never
 * guessed.
 */
export function nearestUnoccupiedZone(data, fromZone, actorKey) {
  if (!data || !Array.isArray(data.zones) || data.zones.length === 0) return null;
  const from = normalizeZone(fromZone);
  const ranked = data.zones
    .map((z) => ({ zone: z, d: distanceBetweenZones(data, from, z) }))
    .filter((x) => x.d.feet !== null)
    .sort((a, b) => a.d.feet - b.d.feet);
  for (const { zone } of ranked) {
    if (isZoneUnoccupied(data, zone, actorKey)) return zone;
  }
  return null;
}

/**
 * Teleport one combatant to a zone.
 *
 * teleportActor(sessionId, actorKey, targetZone, opts) →
 *   { success: true, zone, from, feet } or
 *   { success: false, reason }.
 *
 * opts:
 * - encounterSeq (resolved from the current encounter when omitted),
 * - maxFeet (refuse when the graph distance from the actor's current
 *   zone exceeds it — e.g. 20 for Short Teleports, 60 for Long Teleport),
 * - requireVisible (default false) + canSee (default true): when a row
 *   requires "an unoccupied space you can see", the caller passes
 *   requireVisible: true and canSee: false when the DM says the
 *   destination cannot be seen. There is no sight engine in the app;
 *   a missing canSee is DM-attested as visible, never silently refused.
 * - strictOccupancy: refuse when another combatant occupies the zone.
 * - nearestUnoccupied: when true and the target zone is occupied,
 *   land in the nearest unoccupied zone instead of refusing.
 *
 * Refusals never move the actor and never spend anything — the caller
 * (turn ledger / marker) charges only on success. No-op teleports
 * (already in the target zone) succeed with feet 0.
 */
export async function teleportActor(sessionId, actorKey, targetZone, opts = {}) {
  const zone = normalizeZone(targetZone);
  if (!sessionId || !actorKey || !zone) {
    return { success: false, reason: 'teleport needs a session, an actor, and a destination zone' };
  }
  const encounterSeq = opts.encounterSeq ?? await getCurrentEncounterSeqSafe(sessionId);
  if (encounterSeq == null) return { success: false, reason: 'no current encounter' };
  const data = await readZones(sessionId, encounterSeq);
  if (!data || !Array.isArray(data.zones) || data.zones.length === 0) {
    return { success: false, reason: 'no zones declared for this fight' };
  }
  if (!data.zones.some((z) => normalizeZone(z) === zone)) {
    return { success: false, reason: `no such zone: ${targetZone}` };
  }
  if (opts.requireVisible && opts.canSee === false) {
    return { success: false, reason: `cannot see ${targetZone}` };
  }
  const from = positionOf(data, actorKey);
  let feet = null;
  if (normalizeZone(from) !== zone) {
    const d = distanceBetweenZones(data, from, zone);
    if (d.feet === null) return { success: false, reason: `no path from ${from} to ${targetZone}` };
    feet = d.feet;
    if (opts.maxFeet != null && feet > Number(opts.maxFeet)) {
      return { success: false, reason: `${targetZone} is ${feet} ft away — beyond the teleport range (${Number(opts.maxFeet)} ft)` };
    }
  } else {
    feet = 0;
  }
  let landing = zone;
  if (opts.strictOccupancy && !isZoneUnoccupied(data, zone, actorKey) && normalizeZone(from) !== zone) {
    if (opts.nearestUnoccupied) {
      const near = nearestUnoccupiedZone(data, zone, actorKey);
      if (!near) return { success: false, reason: `no unoccupied space near ${targetZone}` };
      landing = normalizeZone(near);
      const d = distanceBetweenZones(data, from, landing);
      feet = d.feet;
      if (opts.maxFeet != null && feet !== null && feet > Number(opts.maxFeet)) {
        return { success: false, reason: `nearest unoccupied space (${landing}) is ${feet} ft away — beyond the teleport range (${Number(opts.maxFeet)} ft)` };
      }
    } else {
      return { success: false, reason: `${targetZone} is occupied — no unoccupied space` };
    }
  }
  const next = {
    zones: data.zones,
    edges: data.edges || {},
    positions: { ...(data.positions || {}), [actorKey]: landing },
  };
  const written = await writeZones(sessionId, encounterSeq, next);
  if (!written) return { success: false, reason: 'could not record the teleport' };
  return { success: true, zone: landing, from, feet };
}

async function getCurrentEncounterSeqSafe(sessionId) {
  try {
    const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
    return await getCurrentEncounterSeq(sessionId);
  } catch {
    return null;
  }
}
