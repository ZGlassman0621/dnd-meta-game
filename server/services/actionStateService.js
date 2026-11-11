/**
 * Combat item 3, Tier 3: Dodge / Disengage / Help / Hide / Ready state.
 *
 * One JSON column on combat_turn_state (`action_state_json`, migration
 * 094), keyed by combatant ledger key (world ID for party/companions,
 * combat fallback key for mooks). Entry shape:
 *
 *   { dodge: { until }, disengage: { until },
 *     hidden: { total },
 *     help: { helperKey, targetName, until },
 *     ready: { action, trigger, until } }
 *
 * `hidden.total` is the hider's Stealth check total (Hide v2, audit
 * item 4) — the DC for a creature to find them with a Perception
 * check (SEARCH) or a passive score. Hidden never expires on
 * position; it is consumed by the hider's next attack, cleared by
 * being found, by a verbal spell, or by HIDE End="true".
 *
 * `until` is the (round, index) at which the owner's next turn starts,
 * or null when there is no turn order (legacy: the state then lasts
 * until consumed or combat ends). Expiry is LAZY: reads compare the
 * current turn position against `until`, so no TURN_ADVANCE hook is
 * needed and nothing can expire a state early. A re-initialized turn
 * order resets the column (see combatTurnService), so stale `until`
 * values never leak across orderings.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { getTurnState } from './combatTurnService.js';
import { ledgerKeyForPlayer, ledgerKeyForCompanion } from './turnLedgerService.js';
import { combatFallbackId } from './worldIdService.js';

export function playerKey(characterId) {
  return ledgerKeyForPlayer(characterId);
}

export async function companionKey(companionRow) {
  return ledgerKeyForCompanion(companionRow);
}

export function enemyKey(sessionId, encounterSeq, enemyId) {
  return combatFallbackId(sessionId, encounterSeq, enemyId);
}

export async function readState(sessionId, encounterSeq) {
  try {
    const row = await dbGet('SELECT action_state_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
    if (row) return safeParse(row.action_state_json, {}) || {};
  } catch { /* fall through to the legacy fallback below */ }
  // No turn-state row (pre-combat / no turn order): the Tier 1
  // legacy pattern — action state lives in session_config until a
  // turn order exists, and is left unread once one does (a fresh
  // order resets the column, so the fallback copy never leaks
  // into ordered combat). Per-session, not per-encounter: without
  // an order there is only ever the current encounter.
  try {
    const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
    const cfg = safeParse(s?.session_config, {}) || {};
    return (cfg.actionState && typeof cfg.actionState === 'object') ? cfg.actionState : {};
  } catch { return {}; }
}

async function writeState(sessionId, encounterSeq, state) {
  try {
    const row = await dbGet('SELECT 1 AS one FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
    if (row) {
      await dbRun('UPDATE combat_turn_state SET action_state_json = ? WHERE session_id = ? AND encounter_seq = ?', [JSON.stringify(state), sessionId, encounterSeq]);
      return;
    }
  } catch { /* fall through to the legacy fallback below */ }
  // No turn-state row: an UPDATE here would touch zero rows and
  // silently drop the state (the item-3d group 7 failure — the
  // markers reported success while nothing was stored). Write to
  // session_config instead.
  try {
    const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
    const cfg = safeParse(s?.session_config, {}) || {};
    cfg.actionState = state;
    await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
  } catch { /* state is best-effort; the attack itself must not fail */ }
}

/** Current turn position, or null when no turn order exists. */
export async function currentPos(sessionId, encounterSeq) {
  try {
    const st = await getTurnState(sessionId, encounterSeq);
    if (!st) return null;
    return { round: st.round, index: st.currentIndex, total: st.totalCombatants, order: st.turnOrder };
  } catch { return null; }
}

function posValue(until, total) {
  return until.round * total + until.index;
}

/**
 * The (round, index) at which `key`'s next turn starts, or null when
 * there is no turn order. When the key is not in the order (legacy
 * unkeyed orders), the approximation is a full cycle from now —
 * never earlier than the owner's real next turn.
 */
export async function untilFor(sessionId, encounterSeq, key) {
  const pos = await currentPos(sessionId, encounterSeq);
  if (!pos) return null;
  const idx = pos.order.findIndex((e) => e && e.key === key);
  if (idx === -1) return { round: pos.round + 1, index: pos.index };
  if (idx > pos.index) return { round: pos.round, index: idx };
  return { round: pos.round + 1, index: idx };
}

function timedActive(field, pos) {
  if (!field) return false;
  if (!field.until) return true;
  if (!pos) return true;
  return (pos.round * pos.total + pos.index) < posValue(field.until, pos.total);
}

/**
 * The entry for one combatant, with expired timed fields removed
 * (and written back when anything expired). Hidden has no expiry.
 */
// Resolve a ledger key (a world id) back to its owner and end the
// concentration on a held spell, if that is what they are still
// concentrating on. Combat fallback keys (mooks) match nothing and
// are a no-op — enemies hold no spells.
async function clearHeldSpellConcentration(spellName, key) {
  const lower = String(spellName).toLowerCase();
  const pc = await dbGet('SELECT id, concentrating_on FROM characters WHERE world_id = ?', [key]);
  if (pc) {
    if (pc.concentrating_on?.toLowerCase() === lower) {
      const { breakConcentration } = await import('./concentrationService.js');
      await breakConcentration(pc.id, 'readied spell expired');
    }
    return;
  }
  const comp = await dbGet('SELECT c.id, c.concentrating_on FROM companions c JOIN npcs n ON c.npc_id = n.id WHERE n.world_id = ?', [key]);
  if (comp && comp.concentrating_on?.toLowerCase() === lower) {
    const { breakCompanionConcentration } = await import('./concentrationService.js');
    await breakCompanionConcentration(comp.id, 'readied spell expired');
  }
}

export async function getEntry(sessionId, encounterSeq, key) {
  const state = await readState(sessionId, encounterSeq);
  const entry = state[key];
  if (!entry || typeof entry !== 'object') return {};
  const pos = await currentPos(sessionId, encounterSeq);
  let changed = false;
  for (const field of ['dodge', 'disengage', 'help', 'ready', 'shield', 'absorb']) {
    if (entry[field] && !timedActive(entry[field], pos)) {
      // A readied spell expiring unused ends the hold: the
      // concentration on the held spell ends with it (the slot
      // stays spent — no refund). Best-effort; never breaks a read.
      if (field === 'ready' && entry.ready?.heldSpell) {
        try { await clearHeldSpellConcentration(entry.ready.heldSpell.spell, key); } catch { /* best-effort */ }
      }
      delete entry[field];
      changed = true;
    }
  }
  if (changed) {
    if (Object.keys(entry).length === 0) delete state[key];
    await writeState(sessionId, encounterSeq, state);
  }
  return entry;
}

export async function setField(sessionId, encounterSeq, key, field, value) {
  const state = await readState(sessionId, encounterSeq);
  if (!state[key] || typeof state[key] !== 'object') state[key] = {};
  state[key][field] = value;
  await writeState(sessionId, encounterSeq, state);
}

export async function clearField(sessionId, encounterSeq, key, field) {
  const state = await readState(sessionId, encounterSeq);
  if (state[key] && typeof state[key] === 'object' && field in state[key]) {
    delete state[key][field];
    if (Object.keys(state[key]).length === 0) delete state[key];
    await writeState(sessionId, encounterSeq, state);
  }
}

export default { readState, getEntry, setField, clearField, untilFor, currentPos, playerKey, companionKey, enemyKey };
