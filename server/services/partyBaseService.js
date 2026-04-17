import { dbAll, dbGet, dbRun } from '../database.js';
import {
  BASE_SUBTYPES, BASE_CATEGORIES, BUILDING_TYPES,
  getAvailableBuildingsForSubtype,
  LEVEL_THRESHOLDS, getLevelForRenown,
  getUpgradeCatalog, PERK_EFFECTS, RENOWN_SOURCES
} from '../config/partyBaseConfig.js';
import { safeParse } from '../utils/safeParse.js';

/**
 * Party Base Service (F1a — fortress refactor)
 *
 * Multi-base support: a character can have a primary fortress plus satellite
 * outposts, watchtowers, etc. Each base contains a variable number of named
 * buildings (barracks, armory, wizard tower, tavern, etc.) installed in its
 * building slots.
 *
 * Back-compat: single-base code paths (`getBase`) continue to work by
 * returning the primary base.
 */

// ============================================================
// BASE CRUD
// ============================================================

/**
 * Return the PRIMARY base for a character in a campaign (back-compat).
 * Most existing callers expect a single base; this preserves that shape.
 * For all-base listings, use `getBases`.
 */
export async function getBase(characterId, campaignId) {
  const primary = await dbGet(
    `SELECT * FROM party_bases
     WHERE character_id = ? AND campaign_id = ? AND is_primary = 1`,
    [characterId, campaignId]
  );
  if (primary) return hydrateBase(primary);

  // Fall back: any base, if no primary is marked
  const any = await dbGet(
    `SELECT * FROM party_bases
     WHERE character_id = ? AND campaign_id = ?
     ORDER BY created_at ASC LIMIT 1`,
    [characterId, campaignId]
  );
  return any ? hydrateBase(any) : null;
}

/**
 * Return ALL bases for a character in a campaign. Primary first, then by
 * creation order.
 */
export async function getBases(characterId, campaignId) {
  const rows = await dbAll(
    `SELECT * FROM party_bases
     WHERE character_id = ? AND campaign_id = ?
     ORDER BY is_primary DESC, created_at ASC`,
    [characterId, campaignId]
  );
  const out = [];
  for (const row of rows) out.push(await hydrateBase(row));
  return out;
}

export async function getBaseById(baseId) {
  const row = await dbGet('SELECT * FROM party_bases WHERE id = ?', [baseId]);
  return row ? hydrateBase(row) : null;
}

async function hydrateBase(row) {
  row.staff = safeParse(row.staff, []);
  row.active_perks = safeParse(row.active_perks, []);
  row.levelInfo = getLevelForRenown(row.renown);
  row.categoryInfo = BASE_CATEGORIES[row.category] || null;
  row.subtypeInfo = BASE_SUBTYPES[row.subtype] || null;
  row.buildings = await listBuildings(row.id);
  return row;
}

/**
 * Create a new base. Signature accepts the new category + subtype model.
 * Legacy callers passing `base_type` will hit a validation error — they need
 * to migrate to the new shape.
 */
export async function createBase(characterId, campaignId, args) {
  const { name, category, subtype, location_id, description, is_primary } = args || {};
  if (!name) throw new Error('Base name is required');
  if (!category || !BASE_CATEGORIES[category]) {
    throw new Error(`Invalid category: ${category}. Must be one of: ${Object.keys(BASE_CATEGORIES).join(', ')}`);
  }
  if (!subtype || !BASE_SUBTYPES[subtype]) {
    throw new Error(`Invalid subtype: ${subtype}. Must be one of: ${Object.keys(BASE_SUBTYPES).join(', ')}`);
  }
  if (BASE_SUBTYPES[subtype].category !== category) {
    throw new Error(`Subtype "${subtype}" doesn't belong to category "${category}"`);
  }

  const subtypeConfig = BASE_SUBTYPES[subtype];
  const existingBases = await getBases(characterId, campaignId);
  const shouldBePrimary = is_primary !== undefined
    ? is_primary
    : (existingBases.length === 0); // First base defaults to primary

  // If this one is marked primary, demote any current primary
  if (shouldBePrimary) {
    await dbRun(
      `UPDATE party_bases SET is_primary = 0
       WHERE character_id = ? AND campaign_id = ? AND is_primary = 1`,
      [characterId, campaignId]
    );
  }

  const result = await dbRun(
    `INSERT INTO party_bases (
       campaign_id, character_id, location_id, name,
       category, subtype, is_primary, building_slots,
       description, monthly_upkeep_gp, renown
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      campaignId, characterId, location_id || null, name,
      category, subtype, shouldBePrimary ? 1 : 0, subtypeConfig.buildingSlots,
      description || subtypeConfig.description,
      subtypeConfig.baseUpkeepGp, subtypeConfig.startingRenown || 0
    ]
  );

  await dbRun('UPDATE characters SET has_base = 1 WHERE id = ?', [characterId]);
  return getBaseById(Number(result.lastInsertRowid));
}

export async function updateBase(baseId, fields) {
  const allowed = ['name', 'description', 'notes', 'location_id'];
  const updates = [];
  const values = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
  }
  if (updates.length === 0) return getBaseById(baseId);
  values.push(baseId);
  await dbRun(
    `UPDATE party_bases SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    values
  );
  return getBaseById(baseId);
}

/**
 * Mark a non-primary base as primary. Demotes the current primary (if any).
 */
export async function setPrimaryBase(baseId) {
  const base = await dbGet('SELECT character_id, campaign_id FROM party_bases WHERE id = ?', [baseId]);
  if (!base) throw new Error('Base not found');
  await dbRun(
    `UPDATE party_bases SET is_primary = 0
     WHERE character_id = ? AND campaign_id = ? AND is_primary = 1`,
    [base.character_id, base.campaign_id]
  );
  await dbRun(
    `UPDATE party_bases SET is_primary = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [baseId]
  );
  return getBaseById(baseId);
}

export async function abandonBase(baseId) {
  await dbRun(
    `UPDATE party_bases SET status = 'abandoned', is_primary = 0, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [baseId]
  );
  // If this was the character's only active base, clear has_base
  const base = await dbGet('SELECT character_id, campaign_id FROM party_bases WHERE id = ?', [baseId]);
  if (base) {
    const active = await dbGet(
      `SELECT COUNT(*) as n FROM party_bases
       WHERE character_id = ? AND campaign_id = ? AND status != 'abandoned'`,
      [base.character_id, base.campaign_id]
    );
    if ((active?.n || 0) === 0) {
      await dbRun('UPDATE characters SET has_base = 0 WHERE id = ?', [base.character_id]);
    }
  }
  return getBaseById(baseId);
}

export async function establishBase(baseId, currentGameDay) {
  await dbRun(
    `UPDATE party_bases
     SET status = 'active', established_game_day = ?, last_upkeep_game_day = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [currentGameDay, currentGameDay, baseId]
  );
  return getBaseById(baseId);
}

// ============================================================
// BUILDING CRUD (F1 additions)
// ============================================================

export async function listBuildings(baseId) {
  const rows = await dbAll(
    'SELECT * FROM base_buildings WHERE base_id = ? ORDER BY status DESC, created_at ASC',
    [baseId]
  );
  for (const r of rows) {
    r.perks_granted = safeParse(r.perks_granted, []);
    r.typeInfo = BUILDING_TYPES[r.building_type] || null;
  }
  return rows;
}

export async function getBuildingById(buildingId) {
  const row = await dbGet('SELECT * FROM base_buildings WHERE id = ?', [buildingId]);
  if (!row) return null;
  row.perks_granted = safeParse(row.perks_granted, []);
  row.typeInfo = BUILDING_TYPES[row.building_type] || null;
  return row;
}

/**
 * Install a building into a base. Checks slot cap + category allowlist,
 * deducts gold, queues the building at 'planned' status (not yet built).
 * Caller then advances it via `advanceBuildingConstruction()` until it's
 * completed and its perks are live.
 */
export async function addBuilding(baseId, { building_type, name, currentGameDay }) {
  const base = await getBaseById(baseId);
  if (!base) throw new Error('Base not found');
  const typeConfig = BUILDING_TYPES[building_type];
  if (!typeConfig) throw new Error(`Unknown building_type: ${building_type}`);

  // Category allowlist
  if (typeConfig.allowedCategories && !typeConfig.allowedCategories.includes(base.category)) {
    throw new Error(
      `${typeConfig.name} cannot be installed in a ${base.category} base ` +
      `(allowed: ${typeConfig.allowedCategories.join(', ')})`
    );
  }

  // Slot cap
  const currentSlotUsage = (base.buildings || [])
    .filter(b => b.status !== 'damaged')
    .reduce((n, b) => n + ((BUILDING_TYPES[b.building_type]?.slots) || 1), 0);
  const neededSlots = typeConfig.slots || 1;
  if (currentSlotUsage + neededSlots > base.building_slots) {
    throw new Error(
      `Not enough building slots — this base has ${base.building_slots} slots, ` +
      `${currentSlotUsage} used, ${typeConfig.name} needs ${neededSlots}`
    );
  }

  // Treasury check
  const cost = typeConfig.baseGoldCost || 0;
  if (base.gold_treasury < cost) {
    throw new Error(
      `Insufficient treasury — need ${cost}gp, have ${base.gold_treasury}gp`
    );
  }

  // Deduct from treasury, insert building at 'planned' (or directly 'in_progress')
  await dbRun(
    'UPDATE party_bases SET gold_treasury = gold_treasury - ? WHERE id = ?',
    [cost, baseId]
  );
  const result = await dbRun(
    `INSERT INTO base_buildings
     (base_id, building_type, name, gold_cost, hours_required,
      perks_granted, status, started_game_day)
     VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?)`,
    [
      baseId, building_type, name || typeConfig.name,
      cost, typeConfig.baseHoursRequired || 0,
      JSON.stringify(typeConfig.perks || []),
      currentGameDay || null
    ]
  );
  return getBuildingById(Number(result.lastInsertRowid));
}

/**
 * Advance construction on a building by N hours. Auto-completes on hitting
 * hours_required, flipping status to 'completed' and merging its perks
 * into the base's active_perks.
 */
export async function advanceBuildingConstruction(buildingId, hours, currentGameDay) {
  const building = await getBuildingById(buildingId);
  if (!building) throw new Error('Building not found');
  if (building.status !== 'in_progress') {
    throw new Error(`Building is ${building.status}, not in_progress`);
  }

  const newHours = (building.hours_invested || 0) + hours;
  if (newHours >= building.hours_required) {
    await dbRun(
      `UPDATE base_buildings
       SET hours_invested = ?, status = 'completed', completed_game_day = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newHours, currentGameDay || null, buildingId]
    );
    // Merge perks into base.active_perks
    const base = await dbGet('SELECT active_perks FROM party_bases WHERE id = ?', [building.base_id]);
    const current = new Set(safeParse(base?.active_perks, []));
    for (const p of building.perks_granted || []) current.add(p);
    await dbRun(
      'UPDATE party_bases SET active_perks = ? WHERE id = ?',
      [JSON.stringify([...current]), building.base_id]
    );
  } else {
    await dbRun(
      `UPDATE base_buildings
       SET hours_invested = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newHours, buildingId]
    );
  }
  return getBuildingById(buildingId);
}

export async function removeBuilding(buildingId) {
  const building = await getBuildingById(buildingId);
  if (!building) return null;
  // Remove its perks from the base's active_perks
  if (building.status === 'completed' && (building.perks_granted || []).length > 0) {
    const base = await dbGet('SELECT active_perks FROM party_bases WHERE id = ?', [building.base_id]);
    const current = new Set(safeParse(base?.active_perks, []));
    for (const p of building.perks_granted) current.delete(p);
    await dbRun(
      'UPDATE party_bases SET active_perks = ? WHERE id = ?',
      [JSON.stringify([...current]), building.base_id]
    );
  }
  await dbRun('DELETE FROM base_buildings WHERE id = ?', [buildingId]);
  return building;
}

// ============================================================
// INCOME + UPKEEP
// ============================================================

/**
 * Daily income in gp. Derived from active perks (passive_income_N patterns)
 * plus a base rate from the subtype's startingRenown-driven level. No direct
 * per-subtype income table anymore — income is entirely building-driven.
 */
export function calculateIncome(base) {
  if (!base) return 0;
  const perks = Array.isArray(base.active_perks) ? base.active_perks : safeParse(base.active_perks, []);
  let income = 0;
  for (const p of perks) {
    const m = typeof p === 'string' && p.match(/^passive_income_(\d+)$/);
    if (m) income += parseInt(m[1], 10);
  }
  // Level modifier: +2gp/day per level above 1
  const level = base.level || 1;
  income += Math.max(0, (level - 1) * 2);
  return income;
}

export function calculateStaffCost(base) {
  if (!base) return 0;
  const staff = Array.isArray(base.staff) ? base.staff : safeParse(base.staff, []);
  return staff.reduce((sum, s) => sum + (s.salary_gp || 0), 0);
}

export async function processIncomeAndUpkeep(baseId, currentGameDay, gameDaysPassed) {
  const base = await getBaseById(baseId);
  if (!base || base.status !== 'active') return null;

  const dailyIncome = calculateIncome(base);
  const dailyStaff = calculateStaffCost(base);
  const totalIncome = dailyIncome * gameDaysPassed;
  const totalStaff = dailyStaff * gameDaysPassed;

  let upkeepDue = 0;
  const lastUpkeep = base.last_upkeep_game_day || base.established_game_day || currentGameDay;
  if (currentGameDay - lastUpkeep >= 30) {
    upkeepDue = base.monthly_upkeep_gp || 0;
  }

  const netChange = totalIncome - totalStaff - upkeepDue;
  const newTreasury = Math.max(0, (base.gold_treasury || 0) + netChange);
  const deficit = (base.gold_treasury || 0) + netChange < 0;

  await dbRun(
    `UPDATE party_bases
     SET gold_treasury = ?, last_upkeep_game_day = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newTreasury, upkeepDue > 0 ? currentGameDay : base.last_upkeep_game_day, baseId]
  );

  if (deficit) {
    await dbRun(
      `INSERT INTO base_events (base_id, event_type, title, description, game_day, severity)
       VALUES (?, 'upkeep', ?, ?, ?, 'moderate')`,
      [
        baseId, 'Treasury Deficit',
        `The base couldn't cover its upkeep this month. Staff morale drops.`,
        currentGameDay
      ]
    );
  }

  return { dailyIncome, dailyStaff, totalIncome, totalStaff, upkeepDue, netChange, newTreasury, deficit };
}

// ============================================================
// RENOWN
// ============================================================

export async function addRenown(baseId, amount, reason) {
  const base = await dbGet('SELECT renown, level FROM party_bases WHERE id = ?', [baseId]);
  if (!base) throw new Error('Base not found');

  const newRenown = (base.renown || 0) + (amount || 0);
  const newLevelInfo = getLevelForRenown(newRenown);
  const leveledUp = newLevelInfo.level > (base.level || 1);

  await dbRun(
    `UPDATE party_bases
     SET renown = ?, level = ?, monthly_upkeep_gp = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newRenown, newLevelInfo.level, newLevelInfo.upkeep, baseId]
  );

  if (leveledUp) {
    await dbRun(
      `INSERT INTO base_events (base_id, event_type, title, description, game_day, severity)
       VALUES (?, 'level_up', ?, ?, NULL, 'moderate')`,
      [baseId, 'Base Level Up', `Reached renown threshold for level ${newLevelInfo.level}. Upkeep: ${newLevelInfo.upkeep}gp.`]
    );
  }

  return { renown: newRenown, level: newLevelInfo.level, leveledUp, reason };
}

// ============================================================
// STAFF
// ============================================================

export async function hireStaff(baseId, { name, role, salary_gp }) {
  const base = await getBaseById(baseId);
  if (!base) throw new Error('Base not found');
  const staff = base.staff || [];
  const cap = (base.levelInfo?.staffCap) || 2;
  if (staff.length >= cap) throw new Error(`Staff cap reached (${cap})`);
  staff.push({ name, role, salary_gp: salary_gp || 1, morale: 100, hired_at: new Date().toISOString() });
  await dbRun(
    'UPDATE party_bases SET staff = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(staff), baseId]
  );
  return getBaseById(baseId);
}

export async function fireStaff(baseId, staffIndex) {
  const base = await getBaseById(baseId);
  if (!base) throw new Error('Base not found');
  const staff = base.staff || [];
  if (staffIndex < 0 || staffIndex >= staff.length) {
    throw new Error(`Invalid staff index: ${staffIndex}`);
  }
  staff.splice(staffIndex, 1);
  await dbRun(
    'UPDATE party_bases SET staff = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(staff), baseId]
  );
  return getBaseById(baseId);
}

// ============================================================
// TREASURY
// ============================================================

export async function modifyTreasury(baseId, amount, reason) {
  const base = await dbGet('SELECT gold_treasury FROM party_bases WHERE id = ?', [baseId]);
  if (!base) throw new Error('Base not found');
  const newTreasury = Math.max(0, (base.gold_treasury || 0) + amount);
  await dbRun(
    'UPDATE party_bases SET gold_treasury = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newTreasury, baseId]
  );
  return { newTreasury, delta: amount, reason };
}

// ============================================================
// EVENTS
// ============================================================

export async function getBaseEvents(baseId, includeResolved = false) {
  const clause = includeResolved ? '' : 'AND resolved = 0';
  return dbAll(
    `SELECT * FROM base_events WHERE base_id = ? ${clause} ORDER BY created_at DESC`,
    [baseId]
  );
}

export async function resolveEvent(eventId, resolution) {
  await dbRun(
    `UPDATE base_events SET resolved = 1, resolution = ? WHERE id = ?`,
    [resolution || null, eventId]
  );
}

// ============================================================
// PERKS
// ============================================================

export async function getPerks(baseId) {
  const base = await dbGet('SELECT active_perks FROM party_bases WHERE id = ?', [baseId]);
  if (!base) return [];
  return safeParse(base.active_perks, []);
}

export async function hasPerk(characterId, campaignId, perkId) {
  const bases = await getBases(characterId, campaignId);
  for (const b of bases) {
    if (b.status === 'active' && (b.active_perks || []).includes(perkId)) return true;
  }
  return false;
}

// ============================================================
// DM PROMPT
// ============================================================

export async function getBaseForPrompt(characterId, campaignId) {
  const bases = await getBases(characterId, campaignId);
  if (bases.length === 0) return '';

  const lines = ['\n\nPARTY BASES:'];
  for (const b of bases) {
    if (b.status === 'abandoned') continue;
    const primaryTag = b.is_primary ? ' [PRIMARY]' : '';
    lines.push(
      `- ${b.name}${primaryTag} — ${b.subtypeInfo?.name || b.subtype} (${b.categoryInfo?.name || b.category})`
    );
    lines.push(`    Level ${b.level}, Renown ${b.renown}, Treasury ${b.gold_treasury}gp`);
    if (b.buildings && b.buildings.length > 0) {
      const built = b.buildings.filter(x => x.status === 'completed').map(x => x.name || x.building_type);
      const building = b.buildings.filter(x => x.status === 'in_progress').map(x => `${x.name || x.building_type} (under construction)`);
      if (built.length > 0) lines.push(`    Buildings: ${built.join(', ')}`);
      if (building.length > 0) lines.push(`    In progress: ${building.join(', ')}`);
    }
    if ((b.active_perks || []).length > 0) {
      lines.push(`    Active perks: ${b.active_perks.slice(0, 6).join(', ')}`);
    }
  }
  return lines.join('\n');
}

// Legacy upgrade functions — to be rewired in F1b for per-building upgrades.
// Kept as stubs so route-layer imports don't fail; real implementation
// lands when PartyBasePage UI is rebuilt.
export async function getAvailableUpgrades() { return []; }
export async function startUpgrade() { throw new Error('Upgrades are being rewired in F1b. Use addBuilding() for now.'); }
export async function advanceUpgrade() { throw new Error('Upgrades are being rewired in F1b. Use advanceBuildingConstruction() for now.'); }
