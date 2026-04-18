/**
 * Base Threat Service (F3)
 *
 * Generates and manages raids + sieges against party bases. A threat is
 * created by `generateThreatsForCampaign()` during the living-world tick
 * when a hostile world event matches a vulnerable base. The player gets
 * warning days to respond — either by initiating defense (F3b) or letting
 * it auto-resolve at the deadline (F3b).
 *
 * This file (F3a) handles generation + state read/write. Resolution logic
 * (auto-resolve engine, defense flow) lands in F3b.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import {
  RAID_CAPABLE_EVENTS,
  SIEGE_FORCE_THRESHOLD,
  RECAPTURE_WINDOW_DAYS,
  rollInRange,
  getRaidConfigForEvent,
  computeRaidProbability
} from '../config/raidConfig.js';
import * as narrativeQueueService from './narrativeQueueService.js';

// ============================================================
// THREAT CRUD
// ============================================================

export async function getThreatById(id) {
  const row = await dbGet('SELECT * FROM base_threats WHERE id = ?', [id]);
  return row ? hydrateThreat(row) : null;
}

export async function listThreatsForBase(baseId, { includeResolved = false } = {}) {
  const sql = includeResolved
    ? 'SELECT * FROM base_threats WHERE base_id = ? ORDER BY warning_game_day DESC'
    : "SELECT * FROM base_threats WHERE base_id = ? AND status != 'resolved' ORDER BY warning_game_day DESC";
  const rows = await dbAll(sql, [baseId]);
  return rows.map(hydrateThreat);
}

export async function listActiveThreatsForCampaign(campaignId) {
  const rows = await dbAll(
    `SELECT t.*, b.name as base_name, b.subtype as base_subtype, b.is_primary
     FROM base_threats t
     JOIN party_bases b ON t.base_id = b.id
     WHERE t.campaign_id = ? AND t.status IN ('approaching', 'defending', 'resolving')
     ORDER BY t.deadline_game_day ASC`,
    [campaignId]
  );
  return rows.map(hydrateThreat);
}

function hydrateThreat(row) {
  row.damage_report = safeParse(row.damage_report, null);
  return row;
}

// ============================================================
// THREAT GENERATION (living-world tick)
// ============================================================

/**
 * Top-level entry point called from livingWorldService.js per tick.
 * Scans active world events for raid-capable ones and, for each, rolls
 * against every active base in the campaign. Creates threats for hits,
 * queues narrative warnings.
 *
 * Returns summary: { generated: [{ threat, baseName, sourceLabel }], checked: N }
 */
export async function generateThreatsForCampaign(campaignId, currentGameDay) {
  const summary = { generated: [], checked: 0 };

  // Active world events in this campaign that are raid-capable.
  const raidCapableTypes = Object.keys(RAID_CAPABLE_EVENTS);
  if (raidCapableTypes.length === 0) return summary;

  // world_events has event_type, title, description, status but NO
  // `severity` or `region` columns — those were in an earlier design.
  // Raid generation doesn't strictly need them; scope/affected_locations
  // could be read for future regional targeting.
  const placeholders = raidCapableTypes.map(() => '?').join(',');
  const events = await dbAll(
    `SELECT id, event_type, title, description, scope, affected_locations
     FROM world_events
     WHERE campaign_id = ?
       AND event_type IN (${placeholders})
       AND status = 'active'`,
    [campaignId, ...raidCapableTypes]
  );
  if (events.length === 0) return summary;

  // Active bases in the campaign — these are the targets.
  const bases = await dbAll(
    `SELECT id, name, subtype, category, defense_rating, garrison_strength, location_id, is_primary, status
     FROM party_bases
     WHERE campaign_id = ? AND status = 'active'`,
    [campaignId]
  );
  if (bases.length === 0) return summary;

  // Don't stack multiple threats against the same base — one active
  // threat at a time keeps the pressure coherent.
  const existingThreatRows = await dbAll(
    `SELECT DISTINCT base_id FROM base_threats
     WHERE campaign_id = ? AND status IN ('approaching','defending','resolving')`,
    [campaignId]
  );
  const basesWithActiveThreats = new Set(existingThreatRows.map(r => r.base_id));

  for (const event of events) {
    const cfg = getRaidConfigForEvent(event.event_type);
    if (!cfg) continue;

    const eligibleBases = bases.filter(b => !basesWithActiveThreats.has(b.id));
    if (eligibleBases.length === 0) continue;

    // If there's only one base in the region/campaign, bandits + outpost
    // preference still fires against anything (nothing else to raid).
    const onlyBaseInRegion = eligibleBases.length === 1;

    for (const base of eligibleBases) {
      summary.checked++;
      const p = computeRaidProbability(cfg, base, { onlyBaseInRegion });
      if (p <= 0) continue;
      if (Math.random() > p) continue;

      const force = rollInRange(cfg.forceRange);
      const warningDays = rollInRange(cfg.warningDays);
      const threatType = force >= SIEGE_FORCE_THRESHOLD ? 'siege' : 'raid';

      const result = await dbRun(
        `INSERT INTO base_threats
         (base_id, campaign_id, threat_type, attacker_source, attacker_category,
          attacker_force, source_event_id, warning_game_day, deadline_game_day)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          base.id, campaignId, threatType,
          cfg.sourceLabel, cfg.category, force,
          event.id, currentGameDay, currentGameDay + warningDays
        ]
      );
      const threatId = Number(result.lastInsertRowid);
      basesWithActiveThreats.add(base.id);

      // Warn the player via narrative queue
      try {
        const character = await dbGet(
          'SELECT id FROM characters WHERE campaign_id = ? LIMIT 1',
          [campaignId]
        );
        if (character) {
          const verb = threatType === 'siege' ? 'is preparing to lay siege to' : 'is moving on';
          await narrativeQueueService.addToQueue({
            campaign_id: campaignId,
            character_id: character.id,
            event_type: 'base_threat_approaching',
            priority: threatType === 'siege' ? 'urgent' : 'normal',
            title: `${cfg.sourceLabel} threaten ${base.name}`,
            description:
              `A rider brings word: ${cfg.sourceLabel} ${verb} ${base.name}. ` +
              `Estimated arrival: ${warningDays} day${warningDays === 1 ? '' : 's'}. ` +
              `Defense rating: ${base.defense_rating}. ` +
              `You can return to defend or accept the base's fate at the deadline.`,
            context: {
              threat_id: threatId,
              base_id: base.id,
              attacker_force: force,
              warning_days: warningDays
            }
          });
        }
      } catch (e) {
        console.warn('F3 narrative queue write failed:', e.message);
      }

      const threat = await getThreatById(threatId);
      summary.generated.push({
        threat,
        baseName: base.name,
        sourceLabel: cfg.sourceLabel
      });
    }
  }

  return summary;
}

// ============================================================
// LIFECYCLE TRANSITIONS (used by F3b + DM session integration)
// ============================================================

/**
 * Mark a threat as being actively defended by the player. Prevents
 * auto-resolution at the deadline.
 */
export async function markThreatDefending(threatId) {
  const threat = await getThreatById(threatId);
  if (!threat) throw new Error('Threat not found');
  if (threat.status !== 'approaching') {
    throw new Error(`Threat is ${threat.status}, not approaching`);
  }
  await dbRun(
    `UPDATE base_threats
     SET status = 'defending', player_defended = 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [threatId]
  );
  return getThreatById(threatId);
}

/**
 * Record a final outcome on a threat. Used by both the DM-session defense
 * flow and the auto-resolver. Called after status → 'resolving' (auto) or
 * 'defending' (player-led).
 */
export async function recordThreatOutcome(threatId, {
  outcome, damageReport, narrative, gameDay
}) {
  const valid = ['repelled', 'damaged', 'captured', 'abandoned'];
  if (!valid.includes(outcome)) {
    throw new Error(`Invalid outcome: ${outcome}. Must be one of: ${valid.join(', ')}`);
  }
  const threat = await getThreatById(threatId);
  if (!threat) throw new Error('Threat not found');

  // Set recapture deadline if captured
  const recaptureDeadline = outcome === 'captured'
    ? (gameDay || threat.deadline_game_day) + RECAPTURE_WINDOW_DAYS
    : null;

  await dbRun(
    `UPDATE base_threats
     SET status = 'resolved', outcome = ?, outcome_game_day = ?,
         damage_report = ?, narrative = ?,
         recapture_deadline_game_day = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      outcome,
      gameDay || null,
      damageReport ? JSON.stringify(damageReport) : null,
      narrative || null,
      recaptureDeadline,
      threatId
    ]
  );
  return getThreatById(threatId);
}

/**
 * Move any approaching threats that have hit their deadline into the
 * 'resolving' state so the auto-resolver can pick them up. Called from
 * the living-world tick.
 */
export async function markDueThreatsForResolution(campaignId, currentGameDay) {
  const due = await dbAll(
    `SELECT id FROM base_threats
     WHERE campaign_id = ?
       AND status = 'approaching'
       AND deadline_game_day <= ?`,
    [campaignId, currentGameDay]
  );
  for (const t of due) {
    await dbRun(
      `UPDATE base_threats SET status = 'resolving', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [t.id]
    );
  }
  return due.map(t => t.id);
}

// ============================================================
// AUTO-RESOLUTION (F3b)
// ============================================================

/**
 * Auto-resolver: rolls attacker force + d20 vs defender total and returns
 * an outcome shape the caller persists via `recordThreatOutcome()`.
 *
 * Math:
 *   attackerTotal = force + d20
 *   defenderTotal = defense_rating + (garrison_strength / 4, capped at 10) + d20
 *   margin = defenderTotal - attackerTotal
 *
 * Outcome by margin:
 *   ≥ +5   → repelled (no damage)
 *    0..4  → damaged  (1-2 buildings damaged, 25% treasury lost,
 *                      20% garrison lost)
 *   -5..-1 → damaged  (2-3 buildings damaged, 50% treasury lost,
 *                      40% garrison lost)
 *   ≤ -6   → captured (most buildings damaged, 90% treasury lost,
 *                      all garrison scattered, 14-day recapture window)
 *
 * Sieges are less forgiving — their margin-to-outcome thresholds shift
 * down by 2 (harder to repel, more damage at any given margin).
 */
export function computeAutoResolveOutcome({ attackerForce, defenseRating, garrisonStrength, threatType }) {
  const aD20 = 1 + Math.floor(Math.random() * 20);
  const dD20 = 1 + Math.floor(Math.random() * 20);
  const garrisonBonus = Math.min(10, Math.floor((garrisonStrength || 0) / 4));

  const attackerTotal = attackerForce + aD20;
  const defenderTotal = (defenseRating || 0) + garrisonBonus + dD20;
  let margin = defenderTotal - attackerTotal;

  // Sieges lean harder on the attacker
  if (threatType === 'siege') margin -= 2;

  let outcome;
  if (margin >= 5) outcome = 'repelled';
  else if (margin >= -5) outcome = 'damaged';
  else outcome = 'captured';

  return {
    outcome,
    margin,
    rolls: { attackerRoll: aD20, defenderRoll: dD20 },
    attackerTotal,
    defenderTotal,
    garrisonBonus
  };
}

/**
 * Translate an auto-resolve outcome into a damage_report object (building
 * casualties, treasury loss, garrison loss). Called from `autoResolveThreat`.
 * Returns { damage_report, narrative } — the narrative is a short,
 * DM-facing summary.
 */
async function computeDamageFromOutcome(threat, base, outcomeCalc) {
  const report = {
    buildings_damaged: [],
    treasury_lost_gp: 0,
    garrison_lost: 0,
    rolls: outcomeCalc.rolls,
    attacker_total: outcomeCalc.attackerTotal,
    defender_total: outcomeCalc.defenderTotal
  };

  const buildings = await dbAll(
    `SELECT id, name, building_type FROM base_buildings
     WHERE base_id = ? AND status = 'completed'`,
    [base.id]
  );

  if (outcomeCalc.outcome === 'repelled') {
    return {
      damage_report: report,
      narrative: `${threat.attacker_source} were turned back at the gate.`
    };
  }

  // How much damage based on margin
  let buildingsToDamage = 0;
  let treasuryLossPct = 0;
  let garrisonLossPct = 0;

  if (outcomeCalc.outcome === 'damaged') {
    if (outcomeCalc.margin >= 0) {
      buildingsToDamage = Math.min(buildings.length, 1 + Math.floor(Math.random() * 2));
      treasuryLossPct = 0.25;
      garrisonLossPct = 0.20;
    } else {
      buildingsToDamage = Math.min(buildings.length, 2 + Math.floor(Math.random() * 2));
      treasuryLossPct = 0.50;
      garrisonLossPct = 0.40;
    }
  } else if (outcomeCalc.outcome === 'captured') {
    buildingsToDamage = buildings.length; // everything
    treasuryLossPct = 0.90;
    garrisonLossPct = 1.00;
  }

  // Pick random buildings to damage
  const shuffled = [...buildings].sort(() => Math.random() - 0.5);
  const damaged = shuffled.slice(0, buildingsToDamage);
  for (const b of damaged) {
    await dbRun(`UPDATE base_buildings SET status = 'damaged' WHERE id = ?`, [b.id]);
    report.buildings_damaged.push({ id: b.id, name: b.name, building_type: b.building_type });
  }

  // Treasury + garrison
  const freshBase = await dbGet(
    'SELECT gold_treasury, garrison_strength FROM party_bases WHERE id = ?',
    [base.id]
  );
  const treasuryLoss = Math.floor((freshBase.gold_treasury || 0) * treasuryLossPct);
  const garrisonLoss = Math.floor((freshBase.garrison_strength || 0) * garrisonLossPct);
  await dbRun(
    `UPDATE party_bases
     SET gold_treasury = ?, garrison_strength = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      Math.max(0, freshBase.gold_treasury - treasuryLoss),
      Math.max(0, freshBase.garrison_strength - garrisonLoss),
      outcomeCalc.outcome === 'captured' ? 'damaged' : base.status,
      base.id
    ]
  );
  report.treasury_lost_gp = treasuryLoss;
  report.garrison_lost = garrisonLoss;

  // Narrative flavor
  let narrative;
  if (outcomeCalc.outcome === 'damaged') {
    narrative =
      `${threat.attacker_source} breached the outer defenses. ` +
      `${damaged.length} building${damaged.length === 1 ? '' : 's'} damaged, ` +
      `${treasuryLoss}gp looted, ${garrisonLoss} troops lost. The base held.`;
  } else { // captured
    narrative =
      `${threat.attacker_source} overran the garrison and took ${base.name}. ` +
      `Almost the entire treasury is gone, the garrison is scattered, ` +
      `and the buildings lie in ruin. You have ${14} days to reclaim it ` +
      `before they consolidate their hold permanently.`;
  }
  return { damage_report: report, narrative };
}

/**
 * Auto-resolve a single threat. Should only be called on threats in
 * 'resolving' status (the living-world tick flips 'approaching' →
 * 'resolving' at the deadline).
 */
export async function autoResolveThreat(threatId, currentGameDay) {
  const threat = await getThreatById(threatId);
  if (!threat) throw new Error('Threat not found');
  if (threat.status !== 'resolving') {
    throw new Error(`Threat is ${threat.status}, not resolving`);
  }

  const base = await dbGet('SELECT * FROM party_bases WHERE id = ?', [threat.base_id]);
  if (!base) throw new Error('Base not found for threat');

  const outcomeCalc = computeAutoResolveOutcome({
    attackerForce: threat.attacker_force,
    defenseRating: base.defense_rating,
    garrisonStrength: base.garrison_strength,
    threatType: threat.threat_type
  });

  const { damage_report, narrative } = await computeDamageFromOutcome(threat, base, outcomeCalc);

  await recordThreatOutcome(threatId, {
    outcome: outcomeCalc.outcome,
    damageReport: damage_report,
    narrative,
    gameDay: currentGameDay
  });

  // Queue a narrative entry describing what happened in the player's absence
  try {
    const character = await dbGet(
      'SELECT id FROM characters WHERE campaign_id = ? LIMIT 1',
      [threat.campaign_id]
    );
    if (character) {
      await narrativeQueueService.addToQueue({
        campaign_id: threat.campaign_id,
        character_id: character.id,
        event_type: outcomeCalc.outcome === 'captured'
          ? 'base_captured'
          : (outcomeCalc.outcome === 'damaged' ? 'base_damaged' : 'base_defended'),
        priority: outcomeCalc.outcome === 'captured' ? 'urgent' : 'high',
        title: outcomeCalc.outcome === 'repelled'
          ? `${base.name} held against ${threat.attacker_source}`
          : outcomeCalc.outcome === 'damaged'
            ? `${base.name} bloodied but standing`
            : `${base.name} has fallen to ${threat.attacker_source}`,
        description: narrative,
        context: { threat_id: threatId, base_id: base.id, outcome: outcomeCalc.outcome, damage_report }
      });
    }
  } catch (e) { /* best-effort */ }

  return getThreatById(threatId);
}

/**
 * Batch-resolve every threat in 'resolving' state for a campaign. Called
 * from the living-world tick right after `markDueThreatsForResolution()`.
 */
export async function autoResolveDueThreats(campaignId, currentGameDay) {
  const due = await dbAll(
    `SELECT id FROM base_threats WHERE campaign_id = ? AND status = 'resolving'`,
    [campaignId]
  );
  const resolved = [];
  for (const t of due) {
    try {
      const r = await autoResolveThreat(t.id, currentGameDay);
      resolved.push(r);
    } catch (e) {
      console.error(`Error auto-resolving threat ${t.id}:`, e);
    }
  }
  return resolved;
}

// ============================================================
// PLAYER-LED DEFENSE (F3b)
// ============================================================

/**
 * Player chooses to defend a base. Marks the threat as 'defending' so the
 * auto-resolver will skip it. The defense itself plays out in a DM session;
 * the outcome gets recorded via the DM-session integration.
 */
export async function initiatePlayerDefense(threatId) {
  return markThreatDefending(threatId);
}

/**
 * Record a player-led defense outcome. Called from dmSession after the
 * narrative combat concludes with a [BASE_DEFENSE_RESULT] marker or an
 * explicit UI action. Typically passes outcome='repelled' or 'damaged';
 * 'captured' is possible if the session represents a catastrophic defeat.
 */
export async function recordPlayerDefenseOutcome(threatId, args) {
  const { outcome, damageReport, narrative, gameDay } = args;
  const threat = await getThreatById(threatId);
  if (!threat) throw new Error('Threat not found');
  if (threat.status !== 'defending') {
    throw new Error(`Threat is ${threat.status}, not defending`);
  }

  // Apply damage effects (same helper path as auto-resolve, but margin/roll
  // are simulated from the declared outcome since the DM decides narratively)
  const base = await dbGet('SELECT * FROM party_bases WHERE id = ?', [threat.base_id]);
  if (damageReport && typeof damageReport === 'object') {
    // Caller may supply a pre-computed damage report; persist as-is
  }

  return recordThreatOutcome(threatId, {
    outcome,
    damageReport: damageReport || { player_defended: true },
    narrative: narrative || `Player-led defense: ${outcome}.`,
    gameDay
  });
}

/**
 * After the recapture window closes, flip captured bases to 'abandoned'
 * permanently. Runs per tick.
 */
export async function expireStaleCapturedBases(campaignId, currentGameDay) {
  const stale = await dbAll(
    `SELECT t.id, t.base_id, b.name as base_name
     FROM base_threats t
     JOIN party_bases b ON t.base_id = b.id
     WHERE t.campaign_id = ?
       AND t.outcome = 'captured'
       AND t.recapture_deadline_game_day IS NOT NULL
       AND t.recapture_deadline_game_day <= ?
       AND b.status != 'abandoned'`,
    [campaignId, currentGameDay]
  );
  const expired = [];
  for (const row of stale) {
    // Flip the base itself to abandoned + mark the threat outcome as abandoned
    await dbRun(
      `UPDATE party_bases SET status = 'abandoned', is_primary = 0 WHERE id = ?`,
      [row.base_id]
    );
    await dbRun(
      `UPDATE base_threats SET outcome = 'abandoned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [row.id]
    );

    // Narrative warning
    try {
      const character = await dbGet(
        'SELECT id FROM characters WHERE campaign_id = ? LIMIT 1',
        [campaignId]
      );
      if (character) {
        await narrativeQueueService.addToQueue({
          campaign_id: campaignId,
          character_id: character.id,
          event_type: 'base_permanently_lost',
          priority: 'high',
          title: `${row.base_name} is lost`,
          description:
            `The occupiers of ${row.base_name} have consolidated their hold. ` +
            `The recapture window has closed — the base is now permanently lost.`,
          context: { threat_id: row.id, base_id: row.base_id }
        });
      }
    } catch (e) { /* best-effort */ }

    expired.push(row);
  }
  return expired;
}
