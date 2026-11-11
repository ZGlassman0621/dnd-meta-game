/**
 * dungeonContentService — Dungeon generation + scene layer, Phase B.
 *
 * Pure content assignment over a Phase A skeleton. No DB, no provider,
 * no AI dressing (Phase C). Everything here is deterministic given a
 * pick function: tests inject first/last pickers, production passes
 * rng.pick.
 *
 * Locked rules carried into this build (do not re-litigate in code):
 *   - XP is SIZING ONLY. The locked XP system is pure session-end LLM
 *     scoring across combat/exploration/quests/discovery/social; there
 *     is no per-kill XP (killXpService was deleted 2026-10-20). Monster
 *     XP numbers below size an encounter against a room's Phase A
 *     budget band (chamber/corridor = party size x medium, boss =
 *     party size x deadly). Encounter objects carry awardsXp: false
 *     and xpAward: null on purpose, and this module exports no award
 *     function. Nothing here may award XP.
 *   - Digest scope is ADD, not limit: rooms gain dimensions, ceiling
 *     height and light level here, so the DM digest can meet the room
 *     description contract (N2/N3). Geometry is a Phase B content
 *     field, generated here and stored by dungeonSceneStorageService;
 *     the Phase A skeleton generator is left untouched, so its test
 *     is unaffected.
 *   - Treasure is SITE- AND ERA-APPROPRIATE. A sealed ruin must not
 *     yield modern coins, modern armor or modern technology unless
 *     those things are still in use there. Content assignment takes
 *     an explicit siteEra ('sealed' | 'active' | 'mixed', default
 *     'sealed' — the safe default). 'sealed' allows ancient +
 *     timeless valuables and ancient gear only; 'active' (a live
 *     lair, bandit camp, occupied site) allows current market gear
 *     and current valuables; 'mixed' allows all pools. Era is
 *     recorded on every treasure entry (eraTag) so a stored room
 *     proves what filter produced it.
 *   - Ancient price index is NEW DESIGN WORK in this module, not an
 *     existing system. No item-condition system exists in the repo:
 *     conditionService/conditions.js are character conditions, and
 *     inventory entries are { name, quantity } with no condition or
 *     quality field. The index below (condition -> value multiplier
 *     and usability) is Phase B's, flagged as such, and is NOT wired
 *     into inventory — inventory shape is unchanged. Repair of
 *     damaged ancient gear is not built here.
 *   - SET_COVER Feature= validation is BUILT (ruled 2026-10-29):
 *     features_json carries cover features with kind + coverTier,
 *     and combatMarkerService.js validates a named feature against
 *     that list via dungeonSceneStorageService.js (validateCoverFeature
 *     + the migration 089 encounter -> room link).
 *
 * Field naming follows Phase A: content objects use camelCase,
 * storage maps them to snake_case DB columns.
 */

import { pick } from '../utils/rng.js';

export const LIGHT_LEVELS = ['bright', 'dim', 'dark'];
export const SITE_ERAS = ['sealed', 'active', 'mixed'];
export const FEATURE_KINDS = [
  'cover_half', 'cover_three_quarters', 'cover_full',
  'difficult_terrain', 'elevation', 'darkness', 'hazard_zone',
  // Display casting: the generator pool already deals these kinds, so
  // validation must accept them (gate: real-rolled dungeon failed on
  // secret/water until they were listed here).
  'flammable', 'water', 'secret',
];
export const COVER_TIER_FOR_KIND = {
  cover_half: 'half',
  cover_three_quarters: 'three-quarters',
  cover_full: 'full',
};
export const AC_BONUS_FOR_COVER_TIER = {
  half: 2,
  'three-quarters': 5,
  full: null, // full cover: untargetable, not a bonus (2024, migration 069)
};

const GEOMETRY_BY_ROLE = {
  entrance: { width: [20, 30, 40], length: [20, 30, 40], ceiling: [15, 20] },
  corridor: { width: [5, 10], length: [20, 30, 40, 60], ceiling: [10, 15] },
  chamber: { width: [20, 30, 40], length: [20, 30, 40, 50], ceiling: [10, 15, 20] },
  boss: { width: [40, 50, 60], length: [40, 50, 60], ceiling: [20, 25, 30] },
  treasure: { width: [15, 20, 30], length: [15, 20, 30], ceiling: [10, 15] },
};

const FEATURE_COUNT_BY_ROLE = {
  entrance: [0, 1],
  corridor: [0, 1],
  chamber: [1, 2],
  boss: [1, 2, 2],
  treasure: [0, 1],
};

const COVER_FEATURE_NAMES = {
  cover_half: ['Toppled pillar', 'Rubble pile', 'Low wall', 'Broken cart'],
  cover_three_quarters: ['Stone altar', 'Thick pillar', 'Barricade', 'Statue'],
  cover_full: ['Sealed alcove', 'Full-height wall', 'Collapsed archway'],
};
const OTHER_FEATURE_NAMES = {
  difficult_terrain: ['Rubble field', 'Mud patch', 'Loose scree'],
  elevation: ['Raised dais', 'Sunken pit edge', 'Ledge'],
  darkness: ['Unlit alcove', 'Shadowed corner'],
  hazard_zone: ['Cracked floor', 'Unstable rubble', 'Slippery stone'],
  // Display casting (combined build with combat item 8): flammable
  // and water features are real mishap/surge candidates — a fire
  // display can ignite the first, a lightning display electrify
  // the second. They carry no coverTier.
  flammable: ['Haybale', 'Straw pile', 'Oil barrel', 'Wooden crates'],
  water: ['Water trough', 'Well', 'Fountain', 'Rain barrel'],
};
const SECRET_FEATURE_NAMES = ['Hidden panel', 'Concealed exit', 'Secret door'];
const FEATURE_KIND_POOL = [
  'cover_half', 'cover_half', 'cover_three_quarters',
  'difficult_terrain', 'elevation', 'darkness', 'hazard_zone', 'cover_full',
  'flammable', 'water',
];

/** Dimensions + light for one room (N2/N3). Entrance is bright (the mouth); the rest are dark or dim. */
export function assignRoomGeometry(room, pickFn = pick) {
  const g = GEOMETRY_BY_ROLE[room.role] || GEOMETRY_BY_ROLE.chamber;
  const safePick = (arr, fallback) => pickFn(arr) ?? fallback;
  return {
    widthFt: safePick(g.width, g.width[0]),
    lengthFt: safePick(g.length, g.length[0]),
    ceilingFt: safePick(g.ceiling, g.ceiling[0]),
    lightLevel: room.role === 'entrance' ? 'bright' : safePick(['dark', 'dark', 'dim'], 'dark'),
  };
}

/** Interactable-ready features as data. Cover features carry kind + coverTier + acBonus so a future SET_COVER validator can check a named feature against this list. Display casting adds one rare roll after the main loop: ~15% of rooms gain a single 'secret' feature (a hidden panel, concealed exit, or secret door) — the only surge-reveal candidate, and never a mishap target. A deterministic pickFn returning the first element never adds a secret. */
export function assignFeatures(room, pickFn = pick) {
  const count = pickFn(FEATURE_COUNT_BY_ROLE[room.role] || [1]) ?? 0;
  const features = [];
  const usedNames = new Set();
  for (let i = 0; i < count; i++) {
    const kind = pickFn(FEATURE_KIND_POOL) ?? 'difficult_terrain';
    const names = COVER_FEATURE_NAMES[kind] || OTHER_FEATURE_NAMES[kind] || ['Feature'];
    const name = pickFn(names) ?? names[0];
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    const feature = { name, kind, notes: '' };
    if (COVER_TIER_FOR_KIND[kind]) {
      feature.coverTier = COVER_TIER_FOR_KIND[kind];
      feature.acBonus = AC_BONUS_FOR_COVER_TIER[feature.coverTier];
      if (feature.coverTier === 'full') feature.untargetable = true;
    }
    features.push(feature);
  }
  const secretRoll = pickFn([false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, true, true]);
  if (secretRoll) {
    const name = pickFn(SECRET_FEATURE_NAMES) ?? SECRET_FEATURE_NAMES[0];
    if (!usedNames.has(name)) features.push({ name, kind: 'secret', notes: '' });
  }
  return features;
}

// ---------------------------------------------------------------------------
// Traps — small tier table (Phase B values, not a book quote)
// ---------------------------------------------------------------------------

export const TRAP_TIERS = {
  setback: { detectDc: 11, disarmDc: 11, saveDc: 11, damageDice: '1d10' },
  dangerous: { detectDc: 13, disarmDc: 13, saveDc: 13, damageDice: '3d10' },
  deadly: { detectDc: 16, disarmDc: 16, saveDc: 16, damageDice: '6d10' },
};

export function trapTierForLevel(partyLevel) {
  if (partyLevel >= 11) return 'deadly';
  if (partyLevel >= 5) return 'dangerous';
  return 'setback';
}

const TRAP_NAMES_BY_HAZARD = {
  water: ['Flood grate trap', 'Sluice release'],
  fire: ['Flame jet', 'Fireburst rune'],
  collapse: ['Falling ceiling block', 'Cave-in trigger'],
  poison: ['Poison needle', 'Gas vent'],
  cold: ['Freezing vent', 'Ice shard fall'],
  darkness: ['Pit trap', 'Snare'],
  vermin: ['Swarm release', 'Vermin nest drop'],
  machinery: ['Blade pendulum', 'Crushing gears'],
  'magic residue': ['Arcane ward', 'Wild magic snare'],
  heights: ['Crumble ledge', 'Drop floor'],
};
const TRAP_DAMAGE_TYPE_BY_HAZARD = {
  fire: 'fire', poison: 'poison', cold: 'cold',
};

export function assignRoomTrap(room, { partyLevel = 1, hazardFamily = null, pickFn = pick } = {}) {
  if (room.role === 'entrance') return null;
  if ((pickFn(['trap', 'none', 'none', 'none']) ?? 'none') !== 'trap') return null;
  const tier = trapTierForLevel(partyLevel);
  const names = TRAP_NAMES_BY_HAZARD[hazardFamily] || ['Pit trap'];
  return {
    name: pickFn(names) ?? names[0],
    tier,
    ...TRAP_TIERS[tier],
    damageType: TRAP_DAMAGE_TYPE_BY_HAZARD[hazardFamily] || 'bludgeoning',
    placement: 'room',
    hidden: true,
  };
}

export function assignConnectionTrap(connection, { partyLevel = 1, hazardFamily = null, pickFn = pick } = {}) {
  if (connection.kind !== 'door' && connection.kind !== 'secret') return null;
  if ((pickFn(['clear', 'clear', 'trapped']) ?? 'clear') !== 'trapped') return null;
  const tier = trapTierForLevel(partyLevel);
  const names = TRAP_NAMES_BY_HAZARD[hazardFamily] || ['Pit trap'];
  return {
    name: pickFn(names) ?? names[0],
    tier,
    ...TRAP_TIERS[tier],
    damageType: TRAP_DAMAGE_TYPE_BY_HAZARD[hazardFamily] || 'bludgeoning',
    placement: 'connection',
    hidden: true,
  };
}

// ---------------------------------------------------------------------------
// Encounters — bestiary keys only, raw XP sum as SIZING, never an award
// ---------------------------------------------------------------------------

/** Shape a BESTIARY_ENTRIES-style object into the { key, name, cr, xp } catalog this module consumes. */
export function catalogFromEntries(entries) {
  const out = [];
  for (const [key, e] of Object.entries(entries || {})) {
    if (e && Number.isFinite(e.xp) && e.xp > 0) out.push({ key, name: e.name || key, cr: e.cr ?? null, xp: e.xp });
  }
  return out;
}

/**
 * Fill one room's budget with bestiary monsters. Greedy over a
 * descending-XP candidate list: a first-element picker therefore
 * fills the budget closely (largest affordable first), and a random
 * picker still never exceeds the budget. At most 8 monsters.
 * Returns null for a zero budget (entrance/treasure); otherwise an
 * encounter object whose sizingXp is raw summed XP, with awardsXp
 * false and xpAward null by design — there is no award path here.
 */
export function assignEncounter(room, { catalog = [], pickFn = pick } = {}) {
  const budget = room.encounterBudgetXp ?? 0;
  if (!budget || budget <= 0) return null;
  const affordable = [...catalog].filter(c => c.xp > 0 && c.xp <= budget).sort((a, b) => b.xp - a.xp);
  const encounter = {
    roomKey: room.key, budgetXp: budget, sizingXp: 0,
    monsters: [], totalCount: 0, awardsXp: false, xpAward: null,
    sizingNote: 'XP numbers are difficulty sizing only; the locked system awards XP only at session end via LLM scoring.',
  };
  if (!affordable.length) return encounter;
  let remaining = budget;
  const byKey = new Map();
  while (remaining >= affordable[affordable.length - 1].xp && encounter.totalCount < 8) {
    const candidates = affordable.filter(c => c.xp <= remaining);
    if (!candidates.length) break;
    const chosen = pickFn(candidates) ?? candidates[0];
    if (!chosen) break;
    remaining -= chosen.xp;
    encounter.sizingXp += chosen.xp;
    encounter.totalCount += 1;
    if (!byKey.has(chosen.key)) byKey.set(chosen.key, { key: chosen.key, name: chosen.name, cr: chosen.cr, xp: chosen.xp, count: 0 });
    byKey.get(chosen.key).count += 1;
  }
  encounter.monsters = [...byKey.values()];
  return encounter;
}

// ---------------------------------------------------------------------------
// Treasure — coins/valuables now, magic slots as typed placeholders
// ---------------------------------------------------------------------------

function levelBand(partyLevel) {
  if (partyLevel >= 17) return 3;
  if (partyLevel >= 11) return 2;
  if (partyLevel >= 5) return 1;
  return 0;
}

const CACHE_COINS = [
  [{ cp: 50, sp: 10, gp: 2, pp: 0 }, { cp: 20, sp: 25, gp: 0, pp: 0 }, { cp: 0, sp: 15, gp: 5, pp: 0 }],
  [{ cp: 0, sp: 40, gp: 15, pp: 0 }, { cp: 100, sp: 20, gp: 25, pp: 0 }, { cp: 0, sp: 0, gp: 40, pp: 0 }],
  [{ cp: 0, sp: 0, gp: 80, pp: 2 }, { cp: 0, sp: 100, gp: 50, pp: 0 }, { cp: 0, sp: 0, gp: 120, pp: 0 }],
  [{ cp: 0, sp: 0, gp: 200, pp: 10 }, { cp: 0, sp: 0, gp: 150, pp: 25 }, { cp: 0, sp: 0, gp: 300, pp: 5 }],
];
const TREASURE_COINS = [
  [{ cp: 200, sp: 100, gp: 50, pp: 0 }, { cp: 0, sp: 200, gp: 75, pp: 0 }, { cp: 500, sp: 50, gp: 100, pp: 0 }],
  [{ cp: 0, sp: 300, gp: 200, pp: 5 }, { cp: 0, sp: 0, gp: 350, pp: 0 }, { cp: 0, sp: 500, gp: 150, pp: 10 }],
  [{ cp: 0, sp: 0, gp: 800, pp: 20 }, { cp: 0, sp: 0, gp: 600, pp: 50 }, { cp: 0, sp: 1000, gp: 400, pp: 10 }],
  [{ cp: 0, sp: 0, gp: 2000, pp: 100 }, { cp: 0, sp: 0, gp: 1500, pp: 200 }, { cp: 0, sp: 0, gp: 3000, pp: 50 }],
];

const VALUABLES_ANCIENT = [
  { name: 'Carved jade idol', valueGp: 250, eraTag: 'ancient' },
  { name: 'Gold funerary mask', valueGp: 500, eraTag: 'ancient' },
  { name: 'Ancient silver torc', valueGp: 100, eraTag: 'ancient' },
  { name: 'Weathered bronze circlet', valueGp: 50, eraTag: 'ancient' },
];
const VALUABLES_CURRENT = [
  { name: 'Jeweled dagger', valueGp: 150, eraTag: 'current' },
  { name: 'Silk tapestry', valueGp: 200, eraTag: 'current' },
  { name: 'Silvered mirror', valueGp: 75, eraTag: 'current' },
  { name: 'Merchant signet ring', valueGp: 120, eraTag: 'current' },
];
const VALUABLES_TIMELESS = [
  { name: 'Quartz crystal', valueGp: 50, eraTag: 'timeless' },
  { name: 'Garnet', valueGp: 100, eraTag: 'timeless' },
  { name: 'Sapphire', valueGp: 1000, eraTag: 'timeless' },
];
const GEAR_CURRENT = [
  { name: 'Rope (50 ft.)', costGp: 1, eraTag: 'current' },
  { name: 'Lantern', costGp: 5, eraTag: 'current' },
  { name: 'Climbing kit', costGp: 25, eraTag: 'current' },
  { name: 'Healing potion', costGp: 50, eraTag: 'current' },
];
const GEAR_ANCIENT = [
  { name: 'Bronze shortsword', baseValueGp: 15, eraTag: 'ancient' },
  { name: 'Iron helm, pitted', baseValueGp: 8, eraTag: 'ancient' },
  { name: 'Ancient spear', baseValueGp: 5, eraTag: 'ancient' },
  { name: 'Old chain shirt, rusted', baseValueGp: 25, eraTag: 'ancient' },
];

/** NEW Phase B design (not an existing system): ancient condition -> value multiplier + usability. Repair is not built. */
export const ANCIENT_CONDITION_INDEX = {
  pristine: { multiplier: 1, usable: true },
  worn: { multiplier: 0.6, usable: true },
  damaged: { multiplier: 0.3, usable: false, note: 'needs repair (repair system not built)' },
  ruined: { multiplier: 0.05, usable: false, note: 'salvage only' },
};

export function priceAncientItem(baseValueGp, condition) {
  const entry = ANCIENT_CONDITION_INDEX[condition];
  if (!entry) return null;
  return { valueGp: Math.round(baseValueGp * entry.multiplier), condition, usable: entry.usable, note: entry.note || null };
}

function valuablesPoolForEra(siteEra) {
  if (siteEra === 'sealed') return [...VALUABLES_ANCIENT, ...VALUABLES_TIMELESS];
  if (siteEra === 'active') return [...VALUABLES_CURRENT, ...VALUABLES_TIMELESS, ...VALUABLES_ANCIENT];
  return [...VALUABLES_ANCIENT, ...VALUABLES_CURRENT, ...VALUABLES_TIMELESS];
}

function gearPoolForEra(siteEra) {
  if (siteEra === 'sealed') return GEAR_ANCIENT.map(g => ({ ...g, kind: 'ancientGear' }));
  if (siteEra === 'active') return GEAR_CURRENT.map(g => ({ ...g, kind: 'currentGear' }));
  return [...GEAR_ANCIENT.map(g => ({ ...g, kind: 'ancientGear' })), ...GEAR_CURRENT.map(g => ({ ...g, kind: 'currentGear' }))];
}

/**
 * Treasure for one room. Treasure room: coins + valuables + optional
 * gear + one typed magic-item placeholder slot (item: null — filled
 * at book-order Step 6 / item 13, never a real item here). Other
 * rooms: a small coin cache, sometimes. Entrance: null. An unknown
 * siteEra throws rather than silently defaulting to a wrong era.
 */
export function assignTreasure(room, { partyLevel = 1, siteEra = 'sealed', pickFn = pick } = {}) {
  if (!SITE_ERAS.includes(siteEra)) throw new Error(`unknown siteEra: ${siteEra}`);
  if (room.role === 'entrance') return null;
  const band = levelBand(partyLevel);
  if (room.role === 'treasure') {
    const coins = pickFn(TREASURE_COINS[band]) ?? TREASURE_COINS[band][0];
    const valuablesPool = valuablesPoolForEra(siteEra);
    const valuableCount = pickFn([2, 3, 2]) ?? 2;
    const valuables = [];
    for (let i = 0; i < valuableCount; i++) {
      const v = pickFn(valuablesPool) ?? valuablesPool[0];
      if (!valuables.some(x => x.name === v.name)) valuables.push({ ...v });
    }
    const gear = [];
    if ((pickFn(['gear', 'none']) ?? 'none') === 'gear') {
      const g = pickFn(gearPoolForEra(siteEra)) ?? gearPoolForEra(siteEra)[0];
      if (g.kind === 'ancientGear') {
        const condition = pickFn(Object.keys(ANCIENT_CONDITION_INDEX)) ?? 'worn';
        const priced = priceAncientItem(g.baseValueGp, condition);
        gear.push({ name: g.name, eraTag: 'ancient', baseValueGp: g.baseValueGp, ...priced });
      } else {
        gear.push({ name: g.name, eraTag: 'current', valueGp: g.costGp, usable: true });
      }
    }
    return {
      roomKey: room.key, coins, valuables, gear, siteEra,
      magicSlots: [{
        slot: 'magic_item',
        type: pickFn(['weapon', 'armor', 'wondrous', 'potion', 'scroll']) ?? 'wondrous',
        item: null,
        note: 'typed placeholder — filled at book-order Step 6 / item 13, not a real item',
      }],
    };
  }
  if ((pickFn(['cache', 'none', 'none']) ?? 'none') !== 'cache') return null;
  return {
    roomKey: room.key,
    coins: pickFn(CACHE_COINS[band]) ?? CACHE_COINS[band][0],
    valuables: [], gear: [], siteEra, magicSlots: [],
  };
}

// ---------------------------------------------------------------------------
// Whole-dungeon content + validation
// ---------------------------------------------------------------------------

export function assignDungeonContent(skeleton, {
  pickFn = pick, siteEra = 'sealed', catalog = [],
  partyLevel, hazardFamily,
} = {}) {
  if (!SITE_ERAS.includes(siteEra)) throw new Error(`unknown siteEra: ${siteEra}`);
  const level = partyLevel ?? skeleton.seedPacket?.party?.level ?? 1;
  const hazard = hazardFamily ?? skeleton.seedPacket?.siteDice?.hazardFamily ?? null;
  const rooms = skeleton.rooms.map(room => {
    const geometry = assignRoomGeometry(room, pickFn);
    const encounter = assignEncounter(room, { catalog, pickFn });
    const trap = assignRoomTrap(room, { partyLevel: level, hazardFamily: hazard, pickFn });
    const treasure = assignTreasure(room, { partyLevel: level, siteEra, pickFn });
    return {
      ...room, ...geometry,
      features: assignFeatures(room, pickFn),
      encounter, traps: trap ? [trap] : [], treasure,
    };
  });
  const connections = skeleton.connections.map(c => {
    const trap = assignConnectionTrap(c, { partyLevel: level, hazardFamily: hazard, pickFn });
    return { ...c, trapped: trap ? true : c.trapped, trap: trap || null };
  });
  const totalBudgetXp = rooms.reduce((s, r) => s + (r.encounterBudgetXp || 0), 0);
  const totalSizingXp = rooms.reduce((s, r) => s + (r.encounter?.sizingXp || 0), 0);
  return {
    sceneEra: siteEra, rooms, connections,
    totalBudgetXp, totalSizingXp, awardsXp: false,
  };
}

const DIRECTION_OPPOSITE = {
  N: 'S', S: 'N', E: 'W', W: 'E', NE: 'SW', SW: 'NE', SE: 'NW', NW: 'SE',
};
export function invertDirection(direction) {
  return DIRECTION_OPPOSITE[direction] || direction || null;
}

/** Validate assigned content. Returns { valid, errors[] }; never trusts the assigner. */
export function validateContent(content) {
  const errors = [];
  if (!SITE_ERAS.includes(content.sceneEra)) errors.push(`unknown sceneEra: ${content.sceneEra}`);
  const roomKeys = new Set();
  for (const r of content.rooms || []) {
    roomKeys.add(r.key);
    if (!(r.widthFt > 0) || !(r.lengthFt > 0) || !(r.ceilingFt > 0)) errors.push(`room ${r.key} has non-positive dimensions`);
    if (!LIGHT_LEVELS.includes(r.lightLevel)) errors.push(`room ${r.key} has unknown light level ${r.lightLevel}`);
    if (!Array.isArray(r.features)) errors.push(`room ${r.key} features must be an array`);
    for (const f of r.features || []) {
      if (!FEATURE_KINDS.includes(f.kind)) errors.push(`room ${r.key} feature ${f.name} has unknown kind ${f.kind}`);
      if (COVER_TIER_FOR_KIND[f.kind] && f.coverTier !== COVER_TIER_FOR_KIND[f.kind]) errors.push(`room ${r.key} feature ${f.name} coverTier mismatch`);
    }
    if (r.encounter) {
      if (r.encounter.sizingXp > (r.encounterBudgetXp || 0)) errors.push(`room ${r.key} encounter sizing ${r.encounter.sizingXp} exceeds budget ${r.encounterBudgetXp}`);
      if (r.encounter.awardsXp !== false || r.encounter.xpAward !== null) errors.push(`room ${r.key} encounter must not award XP`);
      if (r.encounterBudgetXp === 0) errors.push(`room ${r.key} has an encounter with a zero budget`);
    }
    for (const t of r.traps || []) {
      if (!TRAP_TIERS[t.tier]) errors.push(`room ${r.key} trap has unknown tier ${t.tier}`);
      if (!(t.detectDc > 0) || !(t.disarmDc > 0)) errors.push(`room ${r.key} trap has non-positive DCs`);
    }
    if (r.treasure) {
      if (r.treasure.siteEra !== content.sceneEra) errors.push(`room ${r.key} treasure era ${r.treasure.siteEra} != scene era ${content.sceneEra}`);
      if (content.sceneEra === 'sealed') {
        for (const v of r.treasure.valuables || []) if (v.eraTag === 'current') errors.push(`room ${r.key} sealed treasure contains current valuable ${v.name}`);
        for (const g of r.treasure.gear || []) if (g.eraTag === 'current') errors.push(`room ${r.key} sealed treasure contains current gear ${g.name}`);
      }
      for (const s of r.treasure.magicSlots || []) if (s.item !== null) errors.push(`room ${r.key} magic slot must be a placeholder (item null)`);
    }
  }
  for (const c of content.connections || []) {
    if (!roomKeys.has(c.fromKey) || !roomKeys.has(c.toKey)) errors.push(`connection references unknown room: ${c.fromKey}->${c.toKey}`);
    if (c.trap && !c.trapped) errors.push(`connection ${c.fromKey}->${c.toKey} has a trap but trapped is false`);
    if (!c.trap && c.trapped) errors.push(`connection ${c.fromKey}->${c.toKey} is trapped with no trap object`);
  }
  if (content.awardsXp !== false) errors.push('content must not award XP');
  return { valid: errors.length === 0, errors };
}

export default {
  LIGHT_LEVELS, SITE_ERAS, FEATURE_KINDS, COVER_TIER_FOR_KIND, AC_BONUS_FOR_COVER_TIER,
  TRAP_TIERS, ANCIENT_CONDITION_INDEX,
  assignRoomGeometry, assignFeatures, trapTierForLevel, assignRoomTrap, assignConnectionTrap,
  catalogFromEntries, assignEncounter, priceAncientItem, assignTreasure,
  assignDungeonContent, invertDirection, validateContent,
};
