/**
 * Combat item 5: enemy action economy.
 *
 * Enemies get the same three budgets as the party — 1 action + 1
 * bonus action + 1 reaction (reactions were already tracked) — plus
 * the two boss economies (legendary, lair) and spell slots. The
 * precedent from items 1-4 holds: the DM attests what the engine
 * cannot observe (which pattern, which cost, what the effect is),
 * and the engine enforces the counts, refusing over-budget use
 * with a reason + remedy and consuming nothing.
 *
 * Enforcement scope (the rule that keeps every earlier test
 * green): turn resources (action cap, multiattack accounting,
 * bonus) need a turn order. Without one, everything is legacy
 * unenforced. The action cap and multiattack accounting apply
 * ONLY on the enemy's own turn — off-turn enemy attacks (the
 * item-3d consumption tests attack off-turn) resolve unenforced.
 * Legendary, lair, and spell slots are encounter/round resources
 * and enforce whenever their context exists. Legendary actions
 * happen off-turn by definition; on the enemy's own turn they
 * are refused. A legendary action is never also a bonus action
 * or a multiattack swing: at most one economy flag per swing.
 *
 * Storage: budgets ride turn_budget_json (093, merge-safe) under
 * the enemy's combat fallback key; multiattack patterns and
 * legendary budgets ride action_state_json (094) under the same
 * key; lair state rides session_config (encounter-scoped by key);
 * spell slots ride combat_enemies.enemy_spell_slots_json (096).
 * Nothing here needs a new migration except the slots column.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { getTurnState } from './combatTurnService.js';
import { currentSlotKey, readLedger, budgetIn, updateBudgetForSlot } from './turnLedgerService.js';
import { getEntry, setField } from './actionStateService.js';
import { combatFallbackId } from './worldIdService.js';

export function enemyKeyFor(sessionId, encounterSeq, enemyId) {
  return combatFallbackId(sessionId, encounterSeq, enemyId);
}

async function currentTurnKey(sessionId, encounterSeq) {
  try {
    const st = await getTurnState(sessionId, encounterSeq);
    return st?.currentTurn?.key || null;
  } catch { return null; }
}

async function slotFor(sessionId, encounterSeq) {
  try { return await currentSlotKey(sessionId, encounterSeq); } catch { return null; }
}

async function enemyBudget(sessionId, encounterSeq, slot, key) {
  try {
    const ledger = await readLedger(sessionId, encounterSeq);
    return budgetIn(ledger, slot, key) || {};
  } catch { return {}; }
}

async function writeEnemyBudget(sessionId, encounterSeq, slot, key, patch) {
  try {
    const merged = await updateBudgetForSlot(sessionId, encounterSeq, slot, key, patch);
    return merged !== null;
  } catch { return false; }
}

/** Bonus check without spend (DASH mirrors the party check-then-spend). */
export async function checkEnemyBonus(sessionId, encounterSeq, enemyKey, enemyName) {
  const slot = await slotFor(sessionId, encounterSeq);
  if (!slot) return { tracked: false };
  const budget = await enemyBudget(sessionId, encounterSeq, slot, enemyKey);
  if (budget.enemyBonusSpent) return { error: `${enemyName} has already used its bonus action this turn` };
  return { tracked: true };
}

export async function spendEnemyBonus(sessionId, encounterSeq, enemyKey, enemyName) {
  const checked = await checkEnemyBonus(sessionId, encounterSeq, enemyKey, enemyName);
  if (checked.error) return checked;
  if (!checked.tracked) return { tracked: false };
  const slot = await slotFor(sessionId, encounterSeq);
  if (!(await writeEnemyBudget(sessionId, encounterSeq, slot, enemyKey, { enemyBonusSpent: true }))) {
    return { error: 'could not record the bonus action' };
  }
  return { tracked: true };
}

async function enemyIncapacitated(enemyId) {
  try {
    const { getConditions, normalizeConditionKey } = await import('./conditionService.js');
    const conds = await getConditions('enemy', enemyId);
    for (const c of (Array.isArray(conds) ? conds : [])) {
      const raw = typeof c === 'string' ? c : (c?.key || c?.name || c?.condition);
      if (raw && normalizeConditionKey(raw) === 'incapacitated') return true;
    }
  } catch { /* best-effort; never blocks on lookup failure */ }
  return false;
}

function legendaryState(entry) {
  const leg = entry?.legendary;
  return (leg && typeof leg === 'object') ? leg : { used: 0, max: 3 };
}

async function spendLegendaryBudget(sessionId, encounterSeq, enemyKey, enemyName, enemyId, cost, total) {
  const turnKey = await currentTurnKey(sessionId, encounterSeq);
  if (turnKey === enemyKey) {
    return { error: `${enemyName} cannot use a legendary action on its own turn — legendary actions happen at the end of another creature's turn` };
  }
  if (await enemyIncapacitated(enemyId)) {
    return { error: `${enemyName} is incapacitated and cannot use legendary actions` };
  }
  const entry = await getEntry(sessionId, encounterSeq, enemyKey);
  const leg = legendaryState(entry);
  const max = total != null ? Math.max(1, Number(total) || 3) : (leg.max || 3);
  const c = Math.max(1, Number(cost) || 1);
  if (leg.used + c > max) {
    return { error: `${enemyName} has ${max - leg.used} legendary action(s) left — a cost-${c} action does not fit` };
  }
  await setField(sessionId, encounterSeq, enemyKey, 'legendary', { used: leg.used + c, max });
  return { legendaryRemaining: max - (leg.used + c) };
}

/** The gate for resolveEnemyAttack. Returns {} when nothing applies. */
export async function checkEnemyAction(sessionId, encounterSeq, enemyKey, enemyName, enemyId, opts = {}) {
  const { reaction = false, legendary = false, legendaryCost = 1, legendaryTotal = null, multiattack = false, bonus = false } = opts;
  // Combat item 8: an incapacitated enemy cannot take actions or
  // reactions. Checked before any budget spend — and before the
  // reaction bypass, so a reaction attack is refused too (legendary
  // spend has its own identical check; this covers regular,
  // multiattack, and bonus actions, plus reaction attacks routed here).
  if (enemyId && await enemyIncapacitated(enemyId)) {
    return { error: `${enemyName} is incapacitated and cannot take actions` };
  }
  if (reaction) return {};
  const flags = [legendary, multiattack, bonus].filter(Boolean).length;
  if (flags > 1) {
    return { error: 'an enemy attack uses at most one of Legendary, Multiattack, or Bonus — declare only one' };
  }
  const slot = await slotFor(sessionId, encounterSeq);
  if (!slot) return {}; // No turn order: legacy unenforced.
  if (legendary) {
    const spent = await spendLegendaryBudget(sessionId, encounterSeq, enemyKey, enemyName, enemyId, legendaryCost, legendaryTotal);
    if (spent.error) return spent;
    return { legendaryRemaining: spent.legendaryRemaining };
  }
  if (bonus) {
    const spent = await spendEnemyBonus(sessionId, encounterSeq, enemyKey, enemyName);
    if (spent.error) return spent;
    return { bonusSpent: true };
  }
  // Action accounting applies only on the enemy's own turn.
  const turnKey = await currentTurnKey(sessionId, encounterSeq);
  if (turnKey !== enemyKey) return {};
  if (multiattack) {
    const entry = await getEntry(sessionId, encounterSeq, enemyKey);
    const pat = entry?.multiattack;
    if (!pat || typeof pat !== 'object' || pat.slot !== slot) {
      return { error: `no multiattack pattern declared for ${enemyName} this turn — declare it with MULTIATTACK first` };
    }
    if (pat.index >= pat.actions.length) {
      return { error: `${enemyName} has completed its multiattack pattern (${pat.actions.length} attacks)` };
    }
    const actionName = pat.actions[pat.index];
    await setField(sessionId, encounterSeq, enemyKey, 'multiattack', { ...pat, index: pat.index + 1 });
    const actionStats = await bestiaryActionStats(enemyName, actionName);
    return { actionName, multiattackRemaining: pat.actions.length - (pat.index + 1), actionStats };
  }
  const entry = await getEntry(sessionId, encounterSeq, enemyKey);
  const pat = entry?.multiattack;
  if (pat && typeof pat === 'object' && pat.slot === slot) {
    if (pat.index >= pat.actions.length) {
      return { error: `${enemyName} has completed its multiattack pattern (${pat.actions.length} attacks)` };
    }
    return { error: `${enemyName} has a multiattack pattern declared (${pat.actions.join(', ')}) — use Multiattack="true" for pattern swings` };
  }
  const budget = await enemyBudget(sessionId, encounterSeq, slot, enemyKey);
  if (budget.enemyActionSpent) {
    return { error: `${enemyName} has already used its action this turn` };
  }
  if (!(await writeEnemyBudget(sessionId, encounterSeq, slot, enemyKey, { enemyActionSpent: true }))) {
    return { error: 'could not record the attack' };
  }
  return {};
}

/** MULTIATTACK declaration: turn-start only, current turn only. */
export async function declareMultiattack(sessionId, encounterSeq, enemyKey, enemyName, actions) {
  const slot = await slotFor(sessionId, encounterSeq);
  if (!slot) return { error: 'multiattack needs a turn order — declare it after COMBAT_START' };
  const turnKey = await currentTurnKey(sessionId, encounterSeq);
  if (turnKey !== enemyKey) {
    return { error: `MULTIATTACK is declared on ${enemyName}'s turn — it is not ${enemyName}'s turn` };
  }
  const clean = (Array.isArray(actions) ? actions : []).map((a) => String(a || '').trim()).filter(Boolean);
  if (clean.length === 0) return { error: 'MULTIATTACK needs Attacks="Slam,Slam"' };
  await setField(sessionId, encounterSeq, enemyKey, 'multiattack', { actions: clean, index: 0, slot });
  return { enemy: enemyName, actions: clean };
}

/** Legendary reset at the enemy's own turn start (advanceTurn hook). */
export async function resetLegendaryForTurn(sessionId, encounterSeq, enemyKey) {
  try {
    const entry = await getEntry(sessionId, encounterSeq, enemyKey);
    if (entry?.legendary && typeof entry.legendary === 'object') {
      await setField(sessionId, encounterSeq, enemyKey, 'legendary', { used: 0, max: entry.legendary.max || 3 });
    }
  } catch { /* best-effort; never breaks a turn */ }
}

/** Non-attack legendary spend (teleports, gazes, legendary casts). */
export async function spendLegendary(sessionId, encounterSeq, enemyKey, enemyName, enemyId, cost = 1, total = null) {
  const slot = await slotFor(sessionId, encounterSeq);
  if (!slot) return { spent: false, note: 'legendary budget not tracked without a turn order' };
  const spent = await spendLegendaryBudget(sessionId, encounterSeq, enemyKey, enemyName, enemyId, cost, total);
  if (spent.error) return spent;
  return { spent: true, legendaryRemaining: spent.legendaryRemaining };
}

async function readLairState(sessionId) {
  try {
    const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
    const cfg = safeParse(s?.session_config, {}) || {};
    return { cfg, lair: (cfg.lairState && typeof cfg.lairState === 'object') ? cfg.lairState : null };
  } catch { return { cfg: {}, lair: null }; }
}

/** Lair actions: once per round, never the same effect twice in a row. */
export async function declareLairAction(sessionId, encounterSeq, lairName, effect) {
  let round = null;
  try {
    const st = await getTurnState(sessionId, encounterSeq);
    round = st ? st.round : null;
  } catch { round = null; }
  if (round == null) return { error: 'lair actions need a turn order — declare them after COMBAT_START' };
  const { cfg, lair } = await readLairState(sessionId);
  if (lair && lair.encounterSeq === encounterSeq && lair.round === round) {
    return { error: 'the lair has already acted this round' };
  }
  if (lair && lair.encounterSeq === encounterSeq && lair.lastEffect === effect && lair.round === round - 1) {
    return { error: `the lair cannot use ${effect} twice in a row` };
  }
  const next = { ...cfg, lairState: { encounterSeq, round, lastEffect: effect } };
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(next), sessionId]);
  return { lair: lairName, effect, round };
}

/** Spell-slot ledger on the enemy row (migration 096). */
export async function getEnemySlots(enemyRowId) {
  try {
    const row = await dbGet('SELECT enemy_spell_slots_json FROM combat_enemies WHERE id = ?', [enemyRowId]);
    const parsed = safeParse(row?.enemy_spell_slots_json, {}) || {};
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch { return {}; }
}

export async function setEnemySlots(enemyRowId, slots) {
  await dbRun('UPDATE combat_enemies SET enemy_spell_slots_json = ? WHERE id = ?', [JSON.stringify(slots || {}), enemyRowId]);
}

/** "1:4,2:3" → { "1": 4, "2": 3 }. Per-day powers map to buckets. */
export function parseSlotsSpec(spec) {
  const out = {};
  for (const part of String(spec || '').split(',')) {
    const [lvl, count] = part.split(':').map((s) => (s || '').trim());
    const l = Number(lvl), c = Number(count);
    if (Number.isInteger(l) && l >= 0 && l <= 9 && Number.isInteger(c) && c >= 0) out[String(l)] = c;
  }
  return out;
}

async function bestiaryActionStats(enemyName, actionName) {
  try {
    const { lookupBestiaryFull } = await import('./bestiaryLookupService.js');
    const entry = await lookupBestiaryFull(enemyName);
    const acts = entry?.actions || [];
    const want = String(actionName || '').toLowerCase();
    const act = acts.find((a) => String(a?.name || '').toLowerCase() === want
      && (a.kind === 'melee' || a.kind === 'ranged') && a.attackBonus != null
      && Array.isArray(a.damage) && a.damage.length > 0);
    if (!act) return null;
    // Same precedent as primaryActionFor: the first damage entry.
    return { name: act.name, attackBonus: act.attackBonus, damageDice: act.damage[0].dice, damageType: act.damage[0].type || null };
  } catch { return null; }
}

async function bestiarySpellDc(enemyName) {
  try {
    const { lookupBestiaryFull } = await import('./bestiaryLookupService.js');
    const entry = await lookupBestiaryFull(enemyName);
    return entry?.spellcasting?.dc ?? null;
  } catch { return null; }
}

/**
 * Enemy spell casts (economy + slots only; resolution lives in
 * enemySpellService since item 6).
 * Cantrips (level 0) spend no slot. Action economy mirrors attacks:
 * legendary casts spend legendary, Bonus casts spend bonus, other
 * casts spend the action on the enemy's turn and are refused
 * off-turn (reaction casts spend only the slot; the handler
 * checks the reaction budget).
 */
export async function castEnemySpell(sessionId, encounterSeq, enemyKey, enemyRowId, enemyName, spell, level = 0, opts = {}) {
  const { bonus = false, legendary = false, legendaryCost = 1, dc = null, reaction = false } = opts;
  if (legendary && bonus) {
    return { error: 'an enemy spell cannot be both legendary and a bonus action' };
  }
  if (reaction && (legendary || bonus)) {
    return { error: 'a reaction spell cannot also be legendary or a bonus action' };
  }
  const lvl = Math.max(0, Number(level) || 0);
  let slots = await getEnemySlots(enemyRowId);
  if (Object.keys(slots).length === 0) {
    // Lazy bestiary seeding (avoids COMBAT_START surgery).
    try {
      const { lookupBestiaryFull } = await import('./bestiaryLookupService.js');
      const entry = await lookupBestiaryFull(enemyName);
      if (entry?.spellcasting?.slots && typeof entry.spellcasting.slots === 'object') {
        const seeded = {};
        for (const [k, v] of Object.entries(entry.spellcasting.slots)) {
          const n = Number(v);
          if (Number.isInteger(n) && n >= 0) seeded[String(k)] = n;
        }
        if (Object.keys(seeded).length > 0) {
          await setEnemySlots(enemyRowId, seeded);
          slots = seeded;
        }
      }
    } catch { /* fall through to the no-ledger refusal below */ }
  }
  // Slot availability is checked BEFORE any economy spend, so a
  // refused cast consumes nothing (neither the slot nor the action).
  if (lvl > 0 && (slots[String(lvl)] ?? 0) <= 0) {
    return { error: `${enemyName} has no level-${lvl} spell slot left` };
  }
  const slot = await slotFor(sessionId, encounterSeq);
  if (slot) {
    if (reaction) {
      // Reaction casts spend only the slot (availability checked
      // above, spent below); the reaction budget is the handler's
      // check, not this function's.
    } else if (legendary) {
      const spent = await spendLegendaryBudget(sessionId, encounterSeq, enemyKey, enemyName, enemyRowId, legendaryCost, null);
      if (spent.error) return spent;
    } else if (bonus) {
      const spent = await spendEnemyBonus(sessionId, encounterSeq, enemyKey, enemyName);
      if (spent.error) return spent;
    } else {
      const turnKey = await currentTurnKey(sessionId, encounterSeq);
      if (turnKey !== enemyKey) {
        return { error: `${enemyName} can only cast on its own turn, or as a legendary action` };
      }
      const budget = await enemyBudget(sessionId, encounterSeq, slot, enemyKey);
      if (budget.enemyActionSpent) {
        return { error: `${enemyName} has already used its action this turn` };
      }
      if (!(await writeEnemyBudget(sessionId, encounterSeq, slot, enemyKey, { enemyActionSpent: true }))) {
        return { error: 'could not record the action' };
      }
    }
  }
  if (lvl > 0) {
    const next = { ...slots, [String(lvl)]: (slots[String(lvl)] ?? 0) - 1 };
    await setEnemySlots(enemyRowId, next);
    slots = next;
  }
  const spellDc = dc != null ? Number(dc) : await bestiarySpellDc(enemyName);
  return { spell, level: lvl, slotsRemaining: lvl > 0 ? slots[String(lvl)] : null, dc: spellDc };
}

export default {
  enemyKeyFor, checkEnemyBonus, spendEnemyBonus, checkEnemyAction,
  declareMultiattack, resetLegendaryForTurn, spendLegendary,
  declareLairAction, getEnemySlots, setEnemySlots, parseSlotsSpec,
  castEnemySpell,
};
