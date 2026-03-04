import { dbAll, dbGet, dbRun } from '../database.js';
import {
  BASE_TYPES, LEVEL_THRESHOLDS, getLevelForRenown,
  getUpgradeCatalog, getBaseIncome, PERK_EFFECTS, RENOWN_SOURCES
} from '../config/partyBaseConfig.js';

/**
 * Party Base Service
 * Manages stronghold/base CRUD, upgrade progression, income calculation,
 * upkeep processing, staff management, and perk resolution.
 */

// ============================================================
// BASE CRUD
// ============================================================

export async function getBase(characterId, campaignId) {
  const base = await dbGet(`
    SELECT * FROM party_bases WHERE character_id = ? AND campaign_id = ?
  `, [characterId, campaignId]);

  if (!base) return null;

  // Attach upgrades
  base.upgrades = await dbAll(`
    SELECT * FROM base_upgrades WHERE base_id = ? ORDER BY status DESC, created_at ASC
  `, [base.id]);

  // Parse JSON fields
  base.staff = safeParse(base.staff, []);
  base.active_perks = safeParse(base.active_perks, []);

  // Attach type info
  base.typeInfo = BASE_TYPES[base.base_type] || {};
  base.levelInfo = getLevelForRenown(base.renown);

  return base;
}

export async function getBaseById(baseId) {
  const base = await dbGet('SELECT * FROM party_bases WHERE id = ?', [baseId]);
  if (!base) return null;

  base.upgrades = await dbAll('SELECT * FROM base_upgrades WHERE base_id = ?', [baseId]);
  base.staff = safeParse(base.staff, []);
  base.active_perks = safeParse(base.active_perks, []);
  base.typeInfo = BASE_TYPES[base.base_type] || {};
  base.levelInfo = getLevelForRenown(base.renown);

  return base;
}

export async function createBase(characterId, campaignId, { name, base_type, location_id, description }) {
  if (!name || !base_type) {
    throw new Error('Base name and type are required');
  }
  if (!BASE_TYPES[base_type]) {
    throw new Error(`Invalid base type: ${base_type}`);
  }

  // Check for existing base
  const existing = await getBase(characterId, campaignId);
  if (existing) {
    throw new Error('Character already has a base in this campaign');
  }

  const typeConfig = BASE_TYPES[base_type];
  const starterPerks = JSON.stringify(typeConfig.starterPerks || []);

  const result = await dbRun(`
    INSERT INTO party_bases (
      campaign_id, character_id, location_id, name, base_type,
      description, monthly_upkeep_gp, active_perks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    campaignId, characterId, location_id || null, name, base_type,
    description || typeConfig.description, LEVEL_THRESHOLDS[0].upkeep, starterPerks
  ]);

  // Mark character as having a base
  await dbRun('UPDATE characters SET has_base = 1 WHERE id = ?', [characterId]);

  return getBaseById(result.lastInsertRowid);
}

export async function updateBase(baseId, fields) {
  const allowed = ['name', 'description', 'notes', 'location_id'];
  const updates = [];
  const values = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }

  if (updates.length === 0) return getBaseById(baseId);

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(baseId);

  await dbRun(`UPDATE party_bases SET ${updates.join(', ')} WHERE id = ?`, values);
  return getBaseById(baseId);
}

export async function abandonBase(baseId) {
  const base = await getBaseById(baseId);
  if (!base) throw new Error('Base not found');

  await dbRun(`UPDATE party_bases SET status = 'abandoned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [baseId]);
  await dbRun('UPDATE characters SET has_base = 0 WHERE id = ?', [base.character_id]);

  return getBaseById(baseId);
}

// ============================================================
// UPGRADES
// ============================================================

export async function getAvailableUpgrades(baseId) {
  const base = await getBaseById(baseId);
  if (!base) throw new Error('Base not found');

  const catalog = getUpgradeCatalog(base.base_type);
  const existing = base.upgrades || [];
  const available = [];

  // Check upgrade slot limit
  const completedCount = existing.filter(u => u.status === 'completed').length;
  const inProgressCount = existing.filter(u => u.status === 'in_progress').length;
  const slotsUsed = completedCount + inProgressCount;
  const slotsAvailable = base.levelInfo.upgradeSlots - slotsUsed;

  for (const [key, upgrade] of Object.entries(catalog)) {
    for (const tier of upgrade.tiers) {
      // Check if this exact upgrade+level is already built or in progress
      const exists = existing.find(e => e.upgrade_key === key && e.level === tier.level);
      if (exists) continue;

      // Check if prerequisite level is complete (tier 2 requires tier 1 complete)
      if (tier.level > 1) {
        const prereq = existing.find(e => e.upgrade_key === key && e.level === tier.level - 1 && e.status === 'completed');
        if (!prereq) continue;
      }

      available.push({
        upgrade_key: key,
        name: upgrade.name,
        category: upgrade.category,
        level: tier.level,
        gold_cost: tier.gold_cost,
        hours_required: tier.hours_required,
        perk: tier.perk,
        description: tier.description,
        canAfford: base.gold_treasury >= tier.gold_cost,
        hasSlots: slotsAvailable > 0
      });
    }
  }

  return { available, slotsUsed, slotsAvailable, maxSlots: base.levelInfo.upgradeSlots };
}

export async function startUpgrade(baseId, upgradeKey, upgradeLevel = 1) {
  const base = await getBaseById(baseId);
  if (!base) throw new Error('Base not found');

  const catalog = getUpgradeCatalog(base.base_type);
  const upgradeDef = catalog[upgradeKey];
  if (!upgradeDef) throw new Error(`Unknown upgrade: ${upgradeKey}`);

  const tier = upgradeDef.tiers.find(t => t.level === upgradeLevel);
  if (!tier) throw new Error(`Unknown tier ${upgradeLevel} for ${upgradeKey}`);

  // Check gold
  if (base.gold_treasury < tier.gold_cost) {
    throw new Error(`Insufficient treasury. Need ${tier.gold_cost} gp, have ${base.gold_treasury} gp`);
  }

  // Deduct gold
  await dbRun('UPDATE party_bases SET gold_treasury = gold_treasury - ? WHERE id = ?', [tier.gold_cost, baseId]);

  // Create upgrade record
  const result = await dbRun(`
    INSERT INTO base_upgrades (base_id, upgrade_key, name, category, level, status, gold_cost, hours_required, perk_granted)
    VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)
  `, [baseId, upgradeKey, upgradeDef.name, upgradeDef.category, upgradeLevel, tier.gold_cost, tier.hours_required, tier.perk]);

  return dbGet('SELECT * FROM base_upgrades WHERE id = ?', [result.lastInsertRowid]);
}

export async function advanceUpgrade(upgradeId, hours) {
  const upgrade = await dbGet('SELECT * FROM base_upgrades WHERE id = ?', [upgradeId]);
  if (!upgrade) throw new Error('Upgrade not found');
  if (upgrade.status !== 'in_progress') throw new Error('Upgrade is not in progress');

  const newHours = upgrade.hours_invested + hours;
  const isComplete = newHours >= upgrade.hours_required;

  if (isComplete) {
    return completeUpgrade(upgradeId);
  }

  await dbRun('UPDATE base_upgrades SET hours_invested = ? WHERE id = ?', [newHours, upgradeId]);

  return {
    upgrade: await dbGet('SELECT * FROM base_upgrades WHERE id = ?', [upgradeId]),
    isComplete: false,
    progress: Math.min(100, (newHours / upgrade.hours_required) * 100)
  };
}

async function completeUpgrade(upgradeId) {
  const upgrade = await dbGet('SELECT * FROM base_upgrades WHERE id = ?', [upgradeId]);

  await dbRun(`
    UPDATE base_upgrades
    SET status = 'completed', hours_invested = hours_required, completed_game_day = 0
    WHERE id = ?
  `, [upgradeId]);

  // Grant perk to base
  if (upgrade.perk_granted) {
    const base = await getBaseById(upgrade.base_id);
    const perks = base.active_perks || [];
    if (!perks.includes(upgrade.perk_granted)) {
      perks.push(upgrade.perk_granted);
      await dbRun('UPDATE party_bases SET active_perks = ? WHERE id = ?', [JSON.stringify(perks), upgrade.base_id]);
    }
  }

  return {
    upgrade: await dbGet('SELECT * FROM base_upgrades WHERE id = ?', [upgradeId]),
    isComplete: true,
    progress: 100,
    perkGranted: upgrade.perk_granted
  };
}

// ============================================================
// INCOME & UPKEEP
// ============================================================

/**
 * Calculate daily income from base type + upgrades + staff.
 */
export function calculateIncome(base) {
  if (!base || base.status !== 'active') return 0;

  let income = getBaseIncome(base.base_type, base.level);

  // Add passive income from perks
  const perks = base.active_perks || [];
  for (const perkId of perks) {
    const match = perkId.match(/^passive_income_(\d+)$/);
    if (match) {
      income += parseInt(match[1]);
    }
  }

  // Staff morale modifier
  const staff = base.staff || [];
  if (staff.length > 0) {
    const avgMorale = staff.reduce((sum, s) => sum + (s.morale || 50), 0) / staff.length;
    income = Math.round(income * (0.5 + (avgMorale / 100)));
  }

  return income;
}

/**
 * Calculate total daily staff salary.
 */
export function calculateStaffCost(base) {
  const staff = base?.staff || [];
  return staff.reduce((sum, s) => sum + (s.salary_gp || 0), 0);
}

/**
 * Process income and upkeep for a living world tick.
 * Called from livingWorldService step 3.6.
 */
export async function processIncomeAndUpkeep(baseId, currentGameDay, gameDaysPassed) {
  const base = await getBaseById(baseId);
  if (!base || base.status !== 'active') return null;

  const dailyIncome = calculateIncome(base);
  const dailyStaffCost = calculateStaffCost(base);
  const totalIncome = dailyIncome * gameDaysPassed;
  const totalStaffCost = dailyStaffCost * gameDaysPassed;

  // Check monthly upkeep (every 30 game days)
  let upkeepDue = 0;
  const lastUpkeep = base.last_upkeep_game_day || 0;
  const daysSinceUpkeep = currentGameDay - lastUpkeep;
  if (daysSinceUpkeep >= 30) {
    upkeepDue = base.monthly_upkeep_gp;
  }

  const netChange = totalIncome - totalStaffCost - upkeepDue;
  const newTreasury = Math.max(0, base.gold_treasury + netChange);

  // Update treasury
  const updates = ['gold_treasury = ?'];
  const values = [newTreasury];

  if (upkeepDue > 0) {
    updates.push('last_upkeep_game_day = ?');
    values.push(currentGameDay);
  }

  values.push(baseId);
  await dbRun(`UPDATE party_bases SET ${updates.join(', ')} WHERE id = ?`, values);

  // Check if treasury went negative (can't go below 0, but flag it)
  const deficit = base.gold_treasury + netChange < 0;
  if (deficit) {
    // Create upkeep overdue event
    await dbRun(`
      INSERT INTO base_events (base_id, event_type, title, description, game_day, severity, gold_impact)
      VALUES (?, 'upkeep', 'Upkeep Overdue', 'Your base treasury is empty. Staff morale drops and facilities may deteriorate.', ?, 'moderate', ?)
    `, [baseId, currentGameDay, netChange]);

    // Reduce staff morale
    const staff = base.staff.map(s => ({ ...s, morale: Math.max(0, (s.morale || 50) - 10) }));
    await dbRun('UPDATE party_bases SET staff = ? WHERE id = ?', [JSON.stringify(staff), baseId]);
  }

  return {
    dailyIncome,
    dailyStaffCost,
    totalIncome,
    totalStaffCost,
    upkeepDue,
    netChange,
    newTreasury,
    deficit
  };
}

// ============================================================
// RENOWN & LEVELING
// ============================================================

export async function addRenown(baseId, amount, reason) {
  const base = await getBaseById(baseId);
  if (!base) throw new Error('Base not found');

  // Check for renown display perk (+25%)
  const perks = base.active_perks || [];
  const bonusMultiplier = perks.includes('renown_display') ? 1.25 : 1.0;
  const actualAmount = Math.round(amount * bonusMultiplier);

  const newRenown = base.renown + actualAmount;
  const oldLevel = base.level;
  const newLevelInfo = getLevelForRenown(newRenown);
  const leveledUp = newLevelInfo.level > oldLevel;

  const updates = ['renown = ?'];
  const values = [newRenown];

  if (leveledUp) {
    updates.push('level = ?', 'monthly_upkeep_gp = ?');
    values.push(newLevelInfo.level, newLevelInfo.upkeep);
  }

  values.push(baseId);
  await dbRun(`UPDATE party_bases SET ${updates.join(', ')} WHERE id = ?`, values);

  return {
    previousRenown: base.renown,
    newRenown,
    amount: actualAmount,
    reason,
    leveledUp,
    oldLevel,
    newLevel: newLevelInfo.level,
    newLevelInfo
  };
}

// ============================================================
// STAFF MANAGEMENT
// ============================================================

export async function hireStaff(baseId, { name, role, salary_gp }) {
  const base = await getBaseById(baseId);
  if (!base) throw new Error('Base not found');

  const staff = base.staff || [];
  if (staff.length >= base.levelInfo.staffCap) {
    throw new Error(`Staff cap reached (${base.levelInfo.staffCap}). Upgrade base level for more slots.`);
  }

  staff.push({
    name: name || 'Unnamed Worker',
    role: role || 'general',
    salary_gp: salary_gp || 1,
    hired_game_day: null,
    morale: 60
  });

  await dbRun('UPDATE party_bases SET staff = ? WHERE id = ?', [JSON.stringify(staff), baseId]);
  return getBaseById(baseId);
}

export async function fireStaff(baseId, staffIndex) {
  const base = await getBaseById(baseId);
  if (!base) throw new Error('Base not found');

  const staff = base.staff || [];
  if (staffIndex < 0 || staffIndex >= staff.length) {
    throw new Error('Invalid staff index');
  }

  staff.splice(staffIndex, 1);
  await dbRun('UPDATE party_bases SET staff = ? WHERE id = ?', [JSON.stringify(staff), baseId]);
  return getBaseById(baseId);
}

// ============================================================
// TREASURY
// ============================================================

export async function modifyTreasury(baseId, amount, reason) {
  const base = await getBaseById(baseId);
  if (!base) throw new Error('Base not found');

  const newTreasury = Math.max(0, base.gold_treasury + amount);
  await dbRun('UPDATE party_bases SET gold_treasury = ? WHERE id = ?', [newTreasury, baseId]);

  return { previousTreasury: base.gold_treasury, newTreasury, change: amount, reason };
}

// ============================================================
// EVENTS
// ============================================================

export async function getBaseEvents(baseId, includeResolved = false) {
  const whereClause = includeResolved ? '' : 'AND resolved = 0';
  return dbAll(`
    SELECT * FROM base_events WHERE base_id = ? ${whereClause} ORDER BY game_day DESC
  `, [baseId]);
}

export async function resolveEvent(eventId, resolution) {
  await dbRun(`
    UPDATE base_events SET resolved = 1, resolution = ? WHERE id = ?
  `, [resolution || 'Resolved', eventId]);

  return dbGet('SELECT * FROM base_events WHERE id = ?', [eventId]);
}

// ============================================================
// PERKS
// ============================================================

export async function getPerks(baseId) {
  const base = await getBaseById(baseId);
  if (!base) return [];

  return (base.active_perks || []).map(perkId => ({
    id: perkId,
    ...(PERK_EFFECTS[perkId] || { name: perkId, effect: 'Unknown perk' })
  }));
}

export async function hasPerk(characterId, campaignId, perkId) {
  const base = await getBase(characterId, campaignId);
  if (!base) return false;
  return (base.active_perks || []).includes(perkId);
}

// ============================================================
// PROMPT FORMATTING
// ============================================================

export async function getBaseForPrompt(characterId, campaignId) {
  const base = await getBase(characterId, campaignId);
  if (!base || base.status === 'abandoned') return '';

  const typeInfo = BASE_TYPES[base.base_type] || {};
  const perks = (base.active_perks || [])
    .map(p => PERK_EFFECTS[p]?.name || p)
    .join(', ');

  const staff = base.staff || [];
  const staffStr = staff.length > 0
    ? `${staff.length} (${staff.map(s => s.role).join(', ')})`
    : 'None';

  const events = await getBaseEvents(base.id);
  const eventStr = events.length > 0
    ? events.slice(0, 3).map(e => `${e.title} (${e.severity})`).join(', ')
    : 'None';

  const lines = [
    `=== PLAYER BASE ===`,
    `${typeInfo.icon || ''} ${typeInfo.name || base.base_type} "${base.name}" (Level ${base.level}) at ${base.description || 'Unknown Location'}`,
    `Active Perks: ${perks || 'None'}`,
    `Staff: ${staffStr}`,
    `Treasury: ${base.gold_treasury} gp`,
  ];

  if (events.length > 0) {
    lines.push(`Unresolved Events: ${eventStr}`);
  }

  return '\n' + lines.join('\n') + '\n';
}

// ============================================================
// ESTABLISH BASE (set status to active)
// ============================================================

export async function establishBase(baseId, currentGameDay) {
  await dbRun(`
    UPDATE party_bases
    SET status = 'active', established_game_day = ?, last_upkeep_game_day = ?
    WHERE id = ?
  `, [currentGameDay, currentGameDay, baseId]);

  return getBaseById(baseId);
}

// ============================================================
// HELPERS
// ============================================================

function safeParse(jsonStr, defaultVal) {
  try {
    return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : (jsonStr || defaultVal);
  } catch {
    return defaultVal;
  }
}
