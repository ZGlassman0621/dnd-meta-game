/**
 * Turn Ledger Service (combat item 3, Tier 1).
 *
 * The per-turn budget for ordered combat lives on combat_turn_state
 * (migration 093, turn_budget_json), keyed by TURN SLOT (encounter +
 * round + turn-order index) and then by combatant key: the world ID
 * for party members and companions, the combat fallback key for
 * mooks. A new slot starts with an empty budget by construction —
 * there is no reset step, and a reaction attack firing on someone
 * else's turn reads that turn's slot, so its once-per-turn flags
 * are fresh (Q5) without any special-casing.
 *
 * No-order fallback: when no turn-state row exists (before any
 * COMBAT_START), these functions return null for the slot and the
 * caller keeps the legacy session_config flags under the old
 * encounter-scoped key. Ordered combat reads the ledger
 * exclusively; the legacy keys are never consulted once an order
 * exists. This preserves pre-combat attack behavior exactly and
 * changes no other service's no-row semantics (reactions,
 * advanceTurn) — no skeleton rows are ever created here.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { getTurnState } from './combatTurnService.js';
import { combatFallbackId } from './worldIdService.js';

/** Pure: the slot key for an encounter/round/index triple. */
export function slotKeyFor(encounterSeq, round, index) {
  return `${encounterSeq}:r${round}:i${index}`;
}

/** The current slot key, or null when no turn order exists. */
export async function currentSlotKey(sessionId, encounterSeq) {
  try {
    const st = await getTurnState(sessionId, encounterSeq);
    if (!st) return null;
    return slotKeyFor(encounterSeq, st.round, st.currentIndex);
  } catch { return null; }
}

/** Whole ledger object; {} when the row or column is absent. */
export async function readLedger(sessionId, encounterSeq) {
  try {
    const row = await dbGet('SELECT turn_budget_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
    return safeParse(row?.turn_budget_json, {}) || {};
  } catch { return {}; }
}

async function writeLedger(sessionId, encounterSeq, ledger) {
  await dbRun('UPDATE combat_turn_state SET turn_budget_json = ? WHERE session_id = ? AND encounter_seq = ?', [JSON.stringify(ledger), sessionId, encounterSeq]);
}

/** Budget for one combatant in one slot; {} when nothing is recorded. */
export function budgetIn(ledger, slotKey, combatantKey) {
  const slot = ledger?.[slotKey];
  if (!slot || typeof slot !== 'object') return {};
  const budget = slot[combatantKey];
  return (budget && typeof budget === 'object') ? budget : {};
}

/** Budget for one combatant in the CURRENT slot, or null (no order). */
export async function getBudget(sessionId, encounterSeq, combatantKey) {
  const slot = await currentSlotKey(sessionId, encounterSeq);
  if (!slot) return null;
  const ledger = await readLedger(sessionId, encounterSeq);
  return budgetIn(ledger, slot, combatantKey);
}

/** Merge a patch into one combatant's budget in one slot. Returns the
 *  merged budget, or null when there is no slot (no order) or no row. */
export async function updateBudgetForSlot(sessionId, encounterSeq, slotKey, combatantKey, patch) {
  const ledger = await readLedger(sessionId, encounterSeq);
  const merged = { ...budgetIn(ledger, slotKey, combatantKey), ...patch };
  if (!ledger[slotKey] || typeof ledger[slotKey] !== 'object') ledger[slotKey] = {};
  ledger[slotKey][combatantKey] = merged;
  try {
    await writeLedger(sessionId, encounterSeq, ledger);
  } catch { return null; }
  return merged;
}

/** Merge a patch into one combatant's CURRENT-slot budget. */
export async function updateBudget(sessionId, encounterSeq, combatantKey, patch) {
  const slot = await currentSlotKey(sessionId, encounterSeq);
  if (!slot) return null;
  return updateBudgetForSlot(sessionId, encounterSeq, slot, combatantKey, patch);
}

// ---------------------------------------------------------------------------
// Combatant keys: world IDs for party/companions, fallbacks that never
// block combat when a world ID is somehow missing (pre-backfill rows
// on a DB whose migration has not run yet).
// ---------------------------------------------------------------------------

export async function ledgerKeyForPlayer(characterId) {
  try {
    const row = await dbGet('SELECT world_id FROM characters WHERE id = ?', [characterId]);
    if (row?.world_id) return row.world_id;
  } catch { /* fall through to the id fallback */ }
  return `player:${characterId}`;
}

export async function ledgerKeyForCompanion(companionRow) {
  const npcId = companionRow?.npc_id;
  try {
    if (npcId != null) {
      const row = await dbGet('SELECT world_id FROM npcs WHERE id = ?', [npcId]);
      if (row?.world_id) return row.world_id;
    }
  } catch { /* fall through */ }
  return `companion:${companionRow?.id}`;
}

/** kind 'player' | 'companion'; id is the character or companion-row id. */
export async function ledgerKeyForTarget(kind, id) {
  if (kind === 'player') return ledgerKeyForPlayer(id);
  try {
    const row = await dbGet('SELECT npc_id FROM companions WHERE id = ?', [id]);
    if (row) return ledgerKeyForCompanion({ id, npc_id: row.npc_id });
  } catch { /* fall through */ }
  return `companion:${id}`;
}

// ---------------------------------------------------------------------------
// Q1 enforcement: FULL hard refuse once turn order exists. Reactions
// are exempt by the caller passing reaction: true (they have their
// own budget and legitimately fire on others' turns); before any
// COMBAT_START the identity check is skipped entirely (bootstrap).
// A refusal names the remedy and consumes nothing — callers run
// this before any ammo, flag, or budget write.
// ---------------------------------------------------------------------------

export async function checkTurnIdentity(sessionId, encounterSeq, combatantKey) {
  let st = null;
  try { st = await getTurnState(sessionId, encounterSeq); } catch { st = null; }
  if (!st || !st.currentTurn) return { allowed: true, bootstrap: !st };
  const current = st.currentTurn;
  if (current.key != null && current.key === combatantKey) return { allowed: true };
  // Legacy rows (order stored before keys were stamped) carry no key
  // and cannot be identified reliably by name (nicknames, duplicate
  // enemy names): they run ungated until the next COMBAT_START
  // stamps keys. Refusing on a guessed name match would be worse
  // than allowing a transient old combat through.
  if (current.key == null) {
    return { allowed: true, legacyUnkeyed: true };
  }
  const name = current.name || 'the current combatant';
  return {
    allowed: false,
    reason: `Out of turn: it is ${name}'s turn (round ${st.round}), not this combatant's.`,
    remedy: `Wait for ${name}'s turn, advance the turn order (Next Turn) until it is this combatant's turn, or start a new combat if this combatant is not in the order.`,
    currentName: name,
    round: st.round,
  };
}

// ---------------------------------------------------------------------------
// Attack budget (Tier 1): Extra Attack grants, Action Surge grants,
// off-hand gate, Loading. Pure decision + thin DB wrappers so tests
// can check the math without a database.
//
// opts: { extraAttacks, isLoading, hand ('off' | null), cleave }
// Budget fields: attackActionTaken, attacksTaken, surgesSpent,
// loadingShots, offHandUsed, bonusSpent, bonusSpentBy.
//
// Tier 2 (bonus-action charging): one bonus action per turn slot.
// A bonus spend is checked BEFORE the underlying resource is spent
// (so a refusal consumes nothing) and committed only once the action
// is real — same gate order as Tier 1. No turn order means no slot,
// so no bonus is tracked (legacy behavior, exactly as Tier 1 flags).
// ---------------------------------------------------------------------------

export function attackBudgetDecision(budget, { extraAttacks = 0, isLoading = false, hand = null, cleave = false } = {}) {
  const b = budget || {};
  const attacksTaken = Number(b.attacksTaken || 0);
  const surgesSpent = Number(b.surgesSpent || 0);
  const loadingShots = Number(b.loadingShots || 0);
  if (hand === 'off') {
    if (!b.attackActionTaken) {
      return { allowed: false, reason: 'the off-hand attack requires an Attack action first', remedy: 'Attack with the main hand first, then make the off-hand attack.' };
    }
    if (b.offHandUsed) {
      return { allowed: false, reason: 'the off-hand attack has already been used this turn', remedy: 'Wait for the next turn.' };
    }
    return { allowed: true };
  }
  if (cleave) {
    // A Cleave follow-up is feature-granted, not an Attack-action
    // swing: it never consumes the Extra Attack budget. Its own
    // gate is the cleaveReady flag, checked by the caller.
    return { allowed: true };
  }
  const actionsAvailable = 1 + surgesSpent;
  const maxAttacks = actionsAvailable * (1 + Number(extraAttacks || 0));
  if (attacksTaken >= maxAttacks) {
    return { allowed: false, reason: `no attacks left this turn (${attacksTaken}/${maxAttacks} used)`, remedy: 'Spend Action Surge for another action, or end the turn.' };
  }
  if (isLoading && loadingShots >= actionsAvailable) {
    return { allowed: false, reason: 'a Loading weapon can fire only once per Attack action', remedy: 'Use a non-Loading weapon for the remaining attacks, or spend Action Surge for another action.' };
  }
  return { allowed: true };
}

/** Record a gated attack in the CURRENT slot. Returns the merged
 *  budget, or null when there is no slot (caller falls back). */
export async function recordAttack(sessionId, encounterSeq, combatantKey, { extraAttacks = 0, isLoading = false, hand = null, cleave = false } = {}) {
  const budget = await getBudget(sessionId, encounterSeq, combatantKey);
  if (budget == null) return null;
  const decision = attackBudgetDecision(budget, { extraAttacks, isLoading, hand, cleave });
  if (!decision.allowed) return { ...budget, refused: decision };
  if (hand === 'off') return updateBudget(sessionId, encounterSeq, combatantKey, { offHandUsed: true });
  if (cleave) return budget;
  return updateBudget(sessionId, encounterSeq, combatantKey, {
    attackActionTaken: true,
    attacksTaken: Number(budget.attacksTaken || 0) + 1,
    loadingShots: Number(budget.loadingShots || 0) + (isLoading ? 1 : 0),
  });
}

/** Spend one Action Surge for this slot. Returns the new surgesSpent,
 *  or null when there is no slot (resource still spent by caller). */
export async function recordSurge(sessionId, encounterSeq, combatantKey) {
  const budget = await getBudget(sessionId, encounterSeq, combatantKey);
  if (budget == null) return null;
  const merged = await updateBudget(sessionId, encounterSeq, combatantKey, { surgesSpent: Number(budget.surgesSpent || 0) + 1 });
  return merged ? merged.surgesSpent : null;
}

// ---------------------------------------------------------------------------
// Bonus action (Tier 2): one per turn slot, charged by name so a
// refusal can say what already spent it. Pure decision + thin DB
// wrappers; slotOverride pins a slot (a PC pending attack resolves
// against its declaration slot, not whatever slot is current later).
// ---------------------------------------------------------------------------

export function bonusDecision(budget) {
  const b = budget || {};
  if (b.bonusSpent) {
    return {
      allowed: false,
      reason: `bonus action already spent this turn${b.bonusSpentBy ? ` (${b.bonusSpentBy})` : ''}`,
      remedy: 'Wait for your next turn.',
    };
  }
  return { allowed: true };
}

/** Check the bonus action for the current slot (or slotOverride).
 *  No slot (no turn order) means allowed with noSlot: true — the
 *  caller keeps legacy behavior and charges nothing. */
export async function checkBonus(sessionId, encounterSeq, combatantKey, slotOverride = null) {
  const slot = slotOverride || await currentSlotKey(sessionId, encounterSeq);
  if (!slot) return { allowed: true, noSlot: true };
  const ledger = await readLedger(sessionId, encounterSeq);
  return bonusDecision(budgetIn(ledger, slot, combatantKey));
}

/** Spend the bonus action in the current slot (or slotOverride).
 *  Returns the merged budget, or null when there is no slot. */
export async function spendBonus(sessionId, encounterSeq, combatantKey, label, slotOverride = null) {
  const slot = slotOverride || await currentSlotKey(sessionId, encounterSeq);
  if (!slot) return null;
  return updateBudgetForSlot(sessionId, encounterSeq, slot, combatantKey, { bonusSpent: true, bonusSpentBy: label || 'bonus action' });
}

// ---------------------------------------------------------------------------
// Spell economy (combat item 6, Tier E): casting-time charging + the
// bonus-action spell rule, in the book's turn-as-a-whole form (a build
// correction of the design's "one leveled spell per turn", which is
// wrong for Action Surge and for bonus cantrips — see the design's
// Built section). Budget fields, all per-slot per-combatant:
//   spellActionTaken (bool) — an action spell was cast this turn
//   bonusSpellCast (bool) — a bonus-action spell was cast this turn
//   actionLeveledCast (bool) — a leveled action spell was cast
// The action budget counts actions used (attack action + spell action)
// against 1 + surgesSpent, so Action Surge genuinely grants a second
// action spell. Reactions are NOT here — they ride reactionService.
// ---------------------------------------------------------------------------

/**
 * Member-only turn identity for spellcasters (item 6). Same hard
 * refuse as checkTurnIdentity for combatants IN the order; a caster
 * who is NOT in the order passes through ungated (Tier 1's fail-open
 * philosophy: the order cannot judge someone it does not contain —
 * the economy checks below still apply to them when a slot exists).
 * Legacy unkeyed orders run ungated, exactly as Tier 1.
 */
export async function checkSpellIdentity(sessionId, encounterSeq, combatantKey) {
  let st = null;
  try { st = await getTurnState(sessionId, encounterSeq); } catch { st = null; }
  if (!st || !st.currentTurn) return { allowed: true, noSlot: !st };
  const current = st.currentTurn;
  if (current.key == null) return { allowed: true, legacyUnkeyed: true };
  if (current.key === combatantKey) return { allowed: true };
  const order = Array.isArray(st.turnOrder) ? st.turnOrder : [];
  const member = order.some((e) => e && e.key === combatantKey);
  if (!member) return { allowed: true, nonMember: true };
  const name = current.name || 'the current combatant';
  return {
    allowed: false,
    reason: `Out of turn: it is ${name}'s turn (round ${st.round}), not this combatant's.`,
    remedy: `Wait for ${name}'s turn, advance the turn order (Next Turn) until it is this combatant's turn, or start a new combat if this combatant is not in the order.`,
    currentName: name,
    round: st.round,
  };
}

/** Pure spell-economy decision over one slot budget. */
export function spellCastDecision(budget, { castTime = 'action', level = 0 } = {}) {
  const b = budget || {};
  const ct = String(castTime || 'action').toLowerCase();
  if (ct.includes('reaction')) return { allowed: true, reaction: true };
  if (ct.includes('bonus')) {
    const bonus = bonusDecision(b);
    if (!bonus.allowed) return bonus;
    if (b.actionLeveledCast) {
      return {
        allowed: false,
        reason: 'a leveled action spell was already cast this turn, so no bonus-action spell can follow it',
        remedy: 'Cast a cantrip with your bonus action instead, or wait for your next turn.',
      };
    }
    return { allowed: true };
  }
  if (ct.includes('action')) {
    const actionsAvailable = 1 + Number(b.surgesSpent || 0);
    const actionsUsed = (b.attackActionTaken ? 1 : 0) + (b.spellActionTaken ? 1 : 0);
    if (actionsUsed >= actionsAvailable) {
      return {
        allowed: false,
        reason: `no actions left this turn (${actionsUsed}/${actionsAvailable} used)`,
        remedy: 'Spend Action Surge for another action, or end the turn.',
      };
    }
    if (Number(level) > 0 && b.bonusSpellCast) {
      return {
        allowed: false,
        reason: 'a bonus-action spell was already cast this turn, so only a cantrip can follow it',
        remedy: 'Cast a cantrip with your action instead, or wait for your next turn.',
      };
    }
    return { allowed: true };
  }
  // Longer casting times (1 minute and up) never complete inside one
  // combat turn in v1 — out of combat (no slot) the caller allows them
  // and the DM narrates the casting.
  return {
    allowed: false,
    reason: `a ${castTime} casting time cannot complete in a single combat turn`,
    remedy: 'Cast it out of combat, or pick a spell with a 1 action or 1 bonus action casting time.',
  };
}

/** Check spell economy for the current slot. No slot → allowed, noSlot. */
export async function checkSpellEconomy(sessionId, encounterSeq, combatantKey, opts = {}) {
  const slot = await currentSlotKey(sessionId, encounterSeq);
  if (!slot) return { allowed: true, noSlot: true };
  const ledger = await readLedger(sessionId, encounterSeq);
  return spellCastDecision(budgetIn(ledger, slot, combatantKey), opts);
}

/** Commit spell economy after a successful cast. Null when no slot. */
export async function spendSpellEconomy(sessionId, encounterSeq, combatantKey, { castTime = 'action', level = 0, spellName = '' } = {}) {
  const slot = await currentSlotKey(sessionId, encounterSeq);
  if (!slot) return null;
  const ct = String(castTime || 'action').toLowerCase();
  const patch = {};
  if (ct.includes('bonus')) {
    patch.bonusSpent = true;
    patch.bonusSpentBy = spellName ? `spell: ${spellName}` : 'spell';
    patch.bonusSpellCast = true;
  } else if (ct.includes('action')) {
    patch.spellActionTaken = true;
    if (Number(level) > 0) patch.actionLeveledCast = true;
  } else {
    return null;
  }
  return updateBudgetForSlot(sessionId, encounterSeq, slot, combatantKey, patch);
}

// ---------------------------------------------------------------------------
// DM prompt turn block: current turn + order, injected into every DM
// prompt during combat (Q1 consequence). Pure formatting.
// ---------------------------------------------------------------------------

export function formatTurnStateBlock(turnState) {
  if (!turnState || !Array.isArray(turnState.turnOrder) || turnState.turnOrder.length === 0) return '';
  const order = turnState.turnOrder.map((c, i) =>
    i === turnState.currentIndex ? `▶ ${c.name}` : c.name).join(', ');
  const current = turnState.currentTurn?.name || turnState.turnOrder[turnState.currentIndex]?.name || 'unknown';
  return `[COMBAT TURN STATE — system facts. Round ${turnState.round}. It is ${current}'s turn. Turn order: ${order}. Only the current combatant acts on their turn; emit [TURN_ADVANCE] when their turn ends.]`;
}

export default {
  slotKeyFor, currentSlotKey, readLedger, budgetIn, getBudget,
  updateBudget, updateBudgetForSlot, ledgerKeyForPlayer,
  ledgerKeyForCompanion, ledgerKeyForTarget, checkTurnIdentity,
  attackBudgetDecision, recordAttack, recordSurge, formatTurnStateBlock,
  bonusDecision, checkBonus, spendBonus,
  checkSpellIdentity, spellCastDecision, checkSpellEconomy, spendSpellEconomy,
};
