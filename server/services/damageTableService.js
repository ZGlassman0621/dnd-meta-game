// ---------------------------------------------------------------------------
// Combat item 7 — declared damage tables: falls, traps, hazards.
//
// The DM names the cause; the engine supplies the number. Today a pit
// trap, a fall, or a hazard does whatever damage the DM writes down —
// everything after the number is real, the number itself invented.
// These tables replace the invented number with an engine roll, reusing
// the existing typed follow-through (death, loot, morale, concentration,
// last-damage records) on every path.
//
// Marker shape (schemas extended in markerSchemas.js):
//   [ENEMY_DAMAGE: Enemy="Goblin" Fall=30]              — 3d6 bludgeoning
//   [ENEMY_DAMAGE: Enemy="Goblin" Trap="dangerous"]     — 3d10, Dex save vs 13
//   [ENEMY_DAMAGE: Enemy="Goblin" Hazard="fire" Severity="moderate"]
//   [HP_CHANGE: Fall=30] / [HP_CHANGE: Trap="dangerous"] — the PC's side
//   [HP_CHANGE: Target="Lyra" Trap="dangerous"]         — a companion's side
// A table field present beats a declared Amount/delta (the table is
// authoritative); a declared amount with no resolvable table entry is
// applied but flagged as declared, never silent. Falls and traps with
// no distance/tier on record are refused with a remedy, never invented.
// Cold uses the cold system, not these tables.
// ---------------------------------------------------------------------------

import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { roll } from '../utils/rng.js';
import { TRAP_TIERS } from './dungeonContentService.js';

async function readCfg(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {}) || {};
}

async function writeCfg(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
}

// --- Pure table math (no DB, directly testable) ---------------------------

export const TRAP_TIER_NAMES = ['setback', 'dangerous', 'deadly'];
export const HAZARD_SEVERITIES = ['minor', 'moderate', 'major'];

// Hazard severity dice mirror the trap ladder's counts (1/3/6) on d6s:
// hazards are environmental exposure, not dedicated traps.
export const HAZARD_TABLE = {
  fire: { type: 'fire', minor: '1d6', moderate: '3d6', major: '6d6' },
  acid: { type: 'acid', minor: '1d6', moderate: '3d6', major: '6d6' },
  poison: { type: 'poison', minor: '1d6', moderate: '3d6', major: '6d6' },
  lightning: { type: 'lightning', minor: '1d6', moderate: '3d6', major: '6d6' },
};

export function fallDiceForFeet(feet) {
  const count = Math.min(20, Math.max(0, Math.floor(Number(feet) / 10)));
  return { count, sides: 6, dice: count > 0 ? `${count}d6` : '0', type: 'bludgeoning' };
}

export function trapTierSpec(tier) {
  const t = TRAP_TIERS[String(tier || '').toLowerCase()];
  if (!t) return null;
  return { tier: String(tier).toLowerCase(), dc: t.saveDc, dice: t.damageDice };
}

export function hazardSpec(name, severity) {
  const h = HAZARD_TABLE[String(name || '').toLowerCase()];
  if (!h) return null;
  const dice = h[String(severity || '').toLowerCase()];
  return dice ? { name: String(name).toLowerCase(), type: h.type, dice } : null;
}

function rollDiceString(dice) {
  const m = /^(\d+)d(\d+)$/.exec(String(dice || ''));
  if (!m) return 0;
  return roll(Number(m[2]), Number(m[1]), { reason: 'damage table' }).total;
}

function trapDamageForSaveMode(total, saveSuccess, saveMode) {
  if (saveMode === 'avoid') return saveSuccess ? 0 : total;
  if (saveMode === 'half') return saveSuccess ? Math.floor(total / 2) : total;
  return total;
}

// --- Cause resolution ------------------------------------------------------
// Input: raw marker fields (already schema-parsed). Returns a cause object,
// a refusal { refusal: { reason, remedy } }, or null when no table field
// is present (the caller then uses the legacy Amount/delta path).

export function resolveTableCause({ fall, trap, hazard, severity, type, save, amount }) {
  if (fall != null && String(fall).trim() !== '') {
    const feet = Number(fall);
    if (!Number.isFinite(feet) || feet < 0) {
      return { refusal: { reason: 'Fall needs feet fallen (a number 0 or higher)', remedy: 'Declare Fall= with the feet fallen, e.g. Fall=30.' } };
    }
    const spec = fallDiceForFeet(feet);
    return { kind: 'fall', feet, dice: spec.dice, type: 'bludgeoning' };
  }
  if (trap != null && String(trap).trim() !== '') {
    const spec = trapTierSpec(trap);
    if (!spec) {
      return { refusal: { reason: `Unknown trap tier "${trap}"`, remedy: 'Declare a tier: setback, dangerous, or deadly.' } };
    }
    const saveMode = String(save || 'half').toLowerCase();
    if (!['half', 'avoid', 'none'].includes(saveMode)) {
      return { refusal: { reason: `Unknown trap save mode "${save}"`, remedy: 'Save must be half (success takes half), avoid (success takes none), or none (no save).' } };
    }
    return {
      kind: 'trap', tier: spec.tier, dc: spec.dc, dice: spec.dice,
      saveMode, type: String(type || 'bludgeoning').toLowerCase(),
      trapLabel: `${spec.tier} trap`,
    };
  }
  if (hazard != null && String(hazard).trim() !== '') {
    const name = String(hazard).toLowerCase();
    if (name === 'cold') {
      return { refusal: { reason: 'Cold damage uses the cold system, not a damage table', remedy: 'Use the cold system (Wet/Soaked + Cold Level) for cold exposure.' } };
    }
    const spec = hazardSpec(name, severity);
    if (spec) return { kind: 'hazard', ...spec, severity: String(severity).toLowerCase() };
    if (Number.isFinite(Number(amount))) {
      // Q2 flagged path: a one-off hazard with no table entry keeps its
      // declared amount, but the result says so — never silent.
      return { kind: 'hazard', flagged: true, name, amount: Number(amount), type: HAZARD_TABLE[name]?.type || null };
    }
    return { refusal: { reason: `No table entry for hazard "${name}"`, remedy: 'Add Severity="minor", "moderate", or "major" for a table roll, or Amount= for a flagged declared amount.' } };
  }
  return null;
}

// --- Companion lookup (same query shape as resolvePartyTarget) -------------

export async function resolveCompanionByName(sessionCharacterId, name) {
  const comp = await dbGet(
    `SELECT c.id, n.name FROM companions c JOIN npcs n ON c.npc_id = n.id
     WHERE c.recruited_by_character_id = ? AND c.status = 'active' AND LOWER(n.name) = LOWER(?) LIMIT 1`,
    [sessionCharacterId, name]);
  return comp ? { kind: 'companion', id: comp.id, name: comp.name } : null;
}

// --- Enemy-side application ------------------------------------------------

export async function applyTableDamageToEnemy(sessionId, encounterSeq, enemyName, cause, sessionCharacterId) {
  const ess = await import('./enemySpellService.js');
  const { applyPartyDamageToEnemy, findActiveEnemy } = await import('./enemyCombatService.js');
  let total = 0;
  let saveSuccess = null;
  if (cause.kind === 'trap' && cause.saveMode !== 'none') {
    const row = await findActiveEnemy(sessionId, encounterSeq, enemyName);
    if (!row) return { type: 'enemy_damage', success: false, reason: `no active enemy named "${enemyName}"` };
    const save = await ess.rollEnemySave(sessionId, encounterSeq, row, 'dex', cause.dc, cause.trapLabel);
    saveSuccess = save.success;
    total = trapDamageForSaveMode(rollDiceString(cause.dice), save.success, cause.saveMode);
  } else {
    total = cause.flagged ? cause.amount : rollDiceString(cause.dice);
  }
  if (!(total > 0)) {
    return { type: 'enemy_damage', success: true, cause: cause.kind, dice: cause.dice || null, total: 0, applied: 0, saveSuccess, flagged: !!cause.flagged };
  }
  // Environment damage is unattributed: the attacker is null, so no
  // damage-hook reaction can answer a pit trap (unlike Amount=, which
  // stays player-dealt by design).
  const res = await applyPartyDamageToEnemy(sessionId, encounterSeq, enemyName, total, sessionCharacterId,
    { damageType: cause.type, attacker: null });
  return {
    type: 'enemy_damage', success: true, cause: cause.kind, dice: cause.dice || null,
    total, applied: res?.damageDealt ?? 0, killed: !!res?.killed,
    saveSuccess, flagged: !!cause.flagged,
  };
}

// --- Party-side application -------------------------------------------------

export async function applyTableDamageToParty(sessionId, encounterSeq, target, cause, sessionCharacterId) {
  const ess = await import('./enemySpellService.js');
  if (cause.kind === 'trap' && cause.saveMode !== 'none') {
    if (target.kind === 'player') {
      // The player rolls their own Dex save (item-6 pending pattern);
      // the damage follows the reported roll.
      const effect = {
        kind: 'trap', trapLabel: cause.trapLabel, tier: cause.tier,
        dice: cause.dice, damageType: cause.type, saveDc: cause.dc,
        saveMode: cause.saveMode, target: { kind: 'player', id: target.id },
        encounterSeq, sessionCharacterId, postedAt: Date.now(),
      };
      const posted = await ess.postPendingSave(sessionId, target.id, 'Dexterity', cause.dc, 'pendingTrapSave', effect);
      if (!posted) return { type: 'party_damage', success: false, reason: 'could not post the trap save' };
      await ess.pushDmNotice(sessionId, `Ask the player for a Dexterity save vs DC ${cause.dc} for the ${cause.trapLabel} — the trap damage follows the reported save.`);
      return { type: 'party_damage', success: true, pending: true, cause: 'trap', dc: cause.dc, saveMode: cause.saveMode, dice: cause.dice };
    }
    const save = await ess.rollCompanionSave(sessionId, sessionCharacterId, target.name, 'dex', cause.dc, cause.trapLabel);
    const total = trapDamageForSaveMode(rollDiceString(cause.dice), save.success, cause.saveMode);
    if (!(total > 0)) {
      return { type: 'party_damage', success: true, cause: 'trap', dice: cause.dice, total: 0, applied: 0, saveSuccess: save.success };
    }
    const dmg = await ess.damageToCompanion(sessionId, encounterSeq, target.id, total, { type: cause.type, attacker: null, spell: '' });
    return { type: 'party_damage', success: true, cause: 'trap', dice: cause.dice, total, applied: dmg.applied, saveSuccess: save.success };
  }
  const total = cause.flagged ? cause.amount : rollDiceString(cause.dice);
  if (!(total > 0)) {
    return { type: 'party_damage', success: true, cause: cause.kind, dice: cause.dice || null, total: 0, applied: 0, flagged: !!cause.flagged };
  }
  if (target.kind === 'player') {
    const dmg = await ess.damageToPc(sessionId, encounterSeq, target.id, total, { type: cause.type, attacker: null, spell: '' });
    return { type: 'party_damage', success: true, cause: cause.kind, dice: cause.dice || null, total, applied: dmg.applied, flagged: !!cause.flagged };
  }
  const dmg = await ess.damageToCompanion(sessionId, encounterSeq, target.id, total, { type: cause.type, attacker: null, spell: '' });
  return { type: 'party_damage', success: true, cause: cause.kind, dice: cause.dice || null, total, applied: dmg.applied, flagged: !!cause.flagged };
}

// --- Pending PC trap-save resolution (dmSession route branch) --------------
// Returns a result object when this effectKey is a pending trap save,
// false when the key belongs to another effect (the route then falls
// through to the item-6 pending-spell resolution).

export async function applyPendingTrapSave(sessionId, effectKey, rollOutcome) {
  const cfg = await readCfg(sessionId);
  const effect = cfg.pendingTrapSave;
  if (!effect || effect.key !== effectKey) return false;
  const success = (typeof rollOutcome?.total === 'number' && typeof rollOutcome?.dc === 'number')
    ? rollOutcome.total >= rollOutcome.dc
    : rollOutcome?.outcome === 'success';
  const total = rollDiceString(effect.dice);
  const damage = trapDamageForSaveMode(total, success, effect.saveMode);
  const ess = await import('./enemySpellService.js');
  const dmg = damage > 0
    ? await ess.damageToPc(sessionId, effect.encounterSeq, effect.target.id, damage, { type: effect.damageType, attacker: null, spell: '' })
    : { applied: 0 };
  const fresh = await readCfg(sessionId);
  delete fresh.pendingTrapSave;
  await writeCfg(sessionId, fresh);
  return { handled: true, applied: dmg.applied, total, saveSuccess: success };
}

export default {
  TRAP_TIER_NAMES, HAZARD_SEVERITIES, HAZARD_TABLE,
  fallDiceForFeet, trapTierSpec, hazardSpec, resolveTableCause,
  resolveCompanionByName, applyTableDamageToEnemy, applyTableDamageToParty,
  applyPendingTrapSave,
};
