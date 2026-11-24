/**
 * combatLoopService — the engine-driven combat turn loop (combat-loop fix,
 * 2026-11-23; brief docs/pm/combat-loop-fix/BRIEF.md; diagnosis
 * docs/pm/reports/combat-loop-diagnosis-REPORT.md).
 *
 * Before this, nothing advanced a turn in play: the DM model never wrote
 * [TURN_ADVANCE], the order stuck on its first combatant, and the engine
 * refused the player's attacks as "out of turn". The ENGINE now owns the
 * turn order and drives it; the DM still chooses every NPC's action
 * (Zach 2026-11-23: "The DM should control each and every NPC").
 *
 *   - The player's turn ends when nothing is waiting on the player's
 *     dice (no pending attack, damage, check, initiative or death save).
 *   - Then the route advances the turn and, while the current combatant
 *     is an NPC (enemy or companion), makes ONE DM call for that
 *     combatant (it picks the action and writes its marker), dispatches
 *     the marker through the normal pipeline, states the engine's result
 *     in plain words, and advances — until it is the player's turn again.
 *   - The engine never rolls for the player (Zach 2026-11-23): the
 *     player's initiative and death saves are the player's reported d20s.
 *
 * This module owns the policy and the text; dmSession.js owns the calls.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { getTurnState, advanceTurn, initializeTurnOrder } from './combatTurnService.js';
import { formatTurnStateBlock } from './turnLedgerService.js';

// ---------------------------------------------------------------------------
// session_config helpers
// ---------------------------------------------------------------------------
async function readCfg(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {}) || {};
}
async function writeCfg(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
}

/** Every pending roll that waits on the PLAYER's dice. */
export const PLAYER_ROLL_KEYS = Object.freeze([
  'pendingAttack', 'pendingDamage', 'pendingRoll', 'pendingSpellEffect',
  'pendingBacklashReduction', 'pendingWildMagicOffer', 'pendingInitiative', 'pendingDeathSave',
  'pendingConcentration', 'pendingHeal',
]);

export async function pendingPlayerRolls(sessionId) {
  const cfg = await readCfg(sessionId);
  return PLAYER_ROLL_KEYS.filter((k) => cfg[k]);
}

// ---------------------------------------------------------------------------
// Initiative: the player's own d20 (P4)
// ---------------------------------------------------------------------------
export async function setPendingInitiative(sessionId, entry) {
  const cfg = await readCfg(sessionId);
  cfg.pendingInitiative = { ...entry, postedAt: Date.now() };
  await writeCfg(sessionId, cfg);
}

export async function getPendingInitiative(sessionId) {
  return (await readCfg(sessionId)).pendingInitiative || null;
}

function sortOrder(order) {
  // Initiative descending; ties by modifier; then the player first, then
  // the order already held (stable — no random re-shuffle of the NPCs).
  return order
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (b.c.initiative - a.c.initiative)
      || ((b.c.modifier || 0) - (a.c.modifier || 0))
      || ((b.c.type === 'player') - (a.c.type === 'player'))
      || (a.i - b.i))
    .map(({ c }) => c);
}

/**
 * Settle the player's reported initiative d20: the engine adds the Dex
 * modifier, slots the player into the order, and restarts round 1 at the
 * top. Returns { entry, state, math } or null when nothing is pending.
 */
export async function resolvePlayerInitiative(sessionId, d20, { extraRoll = null, swapWith = null } = {}) {
  const die = Number(d20);
  if (!Number.isInteger(die) || die < 1 || die > 20) return null;
  const cfg = await readCfg(sessionId);
  const p = cfg.pendingInitiative;
  if (!p) return null;
  // feat-addition-14 (Tactician): the player's own d4 joins the d20. A
  // report without it leaves the initiative pending (refused, not guessed).
  let extra = 0;
  if (p.extraDie) {
    const sides = Number(String(p.extraDie).replace(/^d/i, '')) || 4;
    const x = Number(extraRoll);
    if (!Number.isInteger(x) || x < 1 || x > sides) {
      return { needsExtraDie: p.extraDie, name: p.name };
    }
    extra = x;
  }
  delete cfg.pendingInitiative;
  await writeCfg(sessionId, cfg);
  const state = await getTurnState(sessionId, p.encounterSeq);
  const npcs = (state?.turnOrder || []).filter((c) => c.type !== 'player');
  const total = die + extra + (p.modifier || 0);
  const entry = { name: p.name, type: 'player', key: p.key, roll: die, modifier: p.modifier || 0, initiative: total, ...(p.extraDie ? { extraDie: p.extraDie, extraRoll: extra } : {}) };
  let order = sortOrder([...npcs, entry]);
  // Alert / Tactician swap: right after rolling, before the first turn,
  // with a willing party member — once per combat (this is the one roll).
  let swap = null;
  if (swapWith) {
    if (!p.canSwap) {
      swap = { error: 'no feat lets the player swap initiative (Alert or Tactician)' };
    } else {
      const { applyInitiativeSwap } = await import('./featMechanicsService.js');
      const r = applyInitiativeSwap(order, p.key, swapWith);
      if (r.error) swap = { error: r.error };
      else {
        order = sortOrder(r.order);
        swap = { ...r.swapped, source: (p.swapSources || []).join('/') };
        entry.initiative = r.swapped.playerNow;
      }
    }
  }
  await initializeTurnOrder(sessionId, p.encounterSeq, order);
  const fresh = await getTurnState(sessionId, p.encounterSeq);
  const dex = p.dexModifier ?? (p.modifier || 0);
  const signed = (n) => `${n >= 0 ? '+' : '−'} ${Math.abs(n)}`;
  const featPart = (p.featReasons || []).length ? ` ${(p.featReasons || []).map((r) => r.replace(/\+(\d+)/, '+ $1')).join(' ')}` : '';
  const math = `Initiative: d20 ${die}${p.extraDie ? ` + ${p.extraDie} ${extra} (Tactician)` : ''} ${signed(dex)} (Dex)${featPart} = ${total}` +
    (swap && !swap.error ? `; swapped with ${swap.with} (${swap.source}) → ${swap.playerNow}` : '');
  return { entry, state: fresh, encounterSeq: p.encounterSeq, math, swap };
}

export function formatInitiativeFact(res) {
  if (!res?.state) return '';
  const order = res.state.turnOrder.map((c) => `${c.name} (${c.initiative})`).join(', ');
  const d4 = res.entry.extraDie ? ` + ${res.entry.extraRoll} (Tactician ${res.entry.extraDie})` : '';
  const swap = res.swap && !res.swap.error ? ` Then ${res.entry.name} swapped initiative with ${res.swap.with} (${res.swap.source}): ${res.entry.name} ${res.swap.playerNow}, ${res.swap.with} ${res.swap.allyNow}.` : '';
  const swapRefused = res.swap?.error ? ` The initiative swap was refused: ${res.swap.error}.` : '';
  return `[INITIATIVE — system fact: ${res.entry.name} rolled ${res.entry.roll}${d4} + ${res.entry.modifier} = ${res.entry.roll + (res.entry.extraRoll || 0) + res.entry.modifier}.${swap}${swapRefused} ` +
    `Turn order: ${order}. ${res.state.currentTurn?.name} acts first. The engine runs every turn from here.]`;
}

// ---------------------------------------------------------------------------
// Death saves: the player's own d20 (P4)
// ---------------------------------------------------------------------------
export async function setPendingDeathSave(sessionId, characterId) {
  const cfg = await readCfg(sessionId);
  if (cfg.pendingDeathSave) return false;
  cfg.pendingDeathSave = { characterId, postedAt: Date.now() };
  await writeCfg(sessionId, cfg);
  return true;
}

export async function takePendingDeathSave(sessionId) {
  const cfg = await readCfg(sessionId);
  const p = cfg.pendingDeathSave || null;
  if (p) { delete cfg.pendingDeathSave; await writeCfg(sessionId, cfg); }
  return p;
}

// ---------------------------------------------------------------------------
// Concentration saves: the player's own d20 (P4)
// ---------------------------------------------------------------------------
/** Every pending player concentration check inside a turn's handler
 *  results (HP_CHANGE results carry it at the top, ENEMY_ATTACK results
 *  inside hpResult; the walk finds either). */
export function findPendingConcentration(handlerResults, characterId) {
  const found = [];
  const seen = new Set();
  const walk = (v, depth) => {
    if (!v || typeof v !== 'object' || depth > 5 || seen.has(v)) return;
    seen.add(v);
    if (v.type === 'concentration_check' && v.pending === true && Number(v.characterId) === Number(characterId)) { found.push(v); return; }
    for (const k of Object.keys(v)) walk(v[k], depth + 1);
  };
  for (const hr of handlerResults || []) walk(hr?.result, 0);
  return found;
}

/** Queue concentration saves for the player (one per damage source, as
 *  the 2024 rules ask), each asked for in turn. */
export async function queueConcentrationSaves(sessionId, checks) {
  if (!checks?.length) return null;
  const cfg = await readCfg(sessionId);
  const prior = cfg.pendingConcentration?.dcs || [];
  const first = checks[0];
  cfg.pendingConcentration = {
    characterId: first.characterId, spell: first.spell, conMod: first.conMod, penalty: first.penalty,
    dcs: [...prior, ...checks.map((c) => c.dc)], postedAt: Date.now(),
  };
  await writeCfg(sessionId, cfg);
  return cfg.pendingConcentration;
}

/** Settle the next queued save with the player's d20. Returns the check
 *  ({ roll, conMod, penalty, total, dc, success, broken, spell }) or null. */
export async function resolvePendingConcentration(sessionId, d20) {
  const die = Number(d20);
  if (!Number.isInteger(die) || die < 1 || die > 20) return null;
  const cfg = await readCfg(sessionId);
  const p = cfg.pendingConcentration;
  if (!p?.dcs?.length) return null;
  const { resolveConcentrationSave } = await import('./concentrationService.js');
  const res = await resolveConcentrationSave(p.characterId, die, p.dcs[0]);
  const rest = p.dcs.slice(1);
  if (res && !res.broken && rest.length) cfg.pendingConcentration = { ...p, dcs: rest };
  else delete cfg.pendingConcentration;
  await writeCfg(sessionId, cfg);
  if (!res) return null;
  const sign = (n) => `${n >= 0 ? '+' : '−'} ${Math.abs(n)}`;
  const pen = res.penalty ? ` ${sign(res.penalty)} (exhaustion)` : '';
  // No DC: the engine hides a DC from the player (Zach, 2026-11-23). The
  // DM's fact block still carries it.
  res.math = `Concentration (${res.spell}): d20 ${res.roll} ${sign(res.conMod)} (CON)${pen} = ${res.total} — ${res.success ? 'kept' : 'broken'}`;
  return res;
}

// ---------------------------------------------------------------------------
// Feature heals: the player's own dice (P4) — Second Wind's 1d10
// ---------------------------------------------------------------------------
export async function setPendingHeal(sessionId, heal) {
  const cfg = await readCfg(sessionId);
  cfg.pendingHeal = { ...heal, postedAt: Date.now() };
  await writeCfg(sessionId, cfg);
}

/** Settle a pending feature heal with the player's dice total; the engine
 *  adds the flat part. Returns { feature, rolled, flat, heal, math, hp } or null. */
export async function resolvePendingHeal(sessionId, total) {
  if (!Number.isInteger(total) || total < 0) return null;
  const cfg = await readCfg(sessionId);
  const p = cfg.pendingHeal;
  if (!p) return null;
  delete cfg.pendingHeal;
  await writeCfg(sessionId, cfg);
  const heal = total + (Number(p.flat) || 0);
  const { applyHpChange } = await import('./characterHpService.js');
  const hp = await applyHpChange(p.characterId, heal, (p.feature || 'heal').toLowerCase());
  const math = `${p.feature}: rolled ${total} + ${Number(p.flat) || 0} = ${heal} HP`;
  return { feature: p.feature, rolled: total, flat: Number(p.flat) || 0, heal, math, hp };
}

// ---------------------------------------------------------------------------
// Reading a reported number from the player's message
// ---------------------------------------------------------------------------
/** A bare d20 ("15", "15 and 9") or the structured field. */
export function reportedD20(action, structured = null) {
  if (Number.isInteger(structured) && structured >= 1 && structured <= 20) return [structured];
  const m = String(action || '').trim().match(/^(\d{1,2})(?:\s*(?:and|,|\+)\s*(\d{1,2}))?\s*$/);
  if (!m) return null;
  const d1 = parseInt(m[1], 10);
  const d2 = m[2] ? parseInt(m[2], 10) : null;
  if (d1 < 1 || d1 > 20 || (d2 !== null && (d2 < 1 || d2 > 20))) return null;
  return d2 === null ? [d1] : [d1, d2];
}

/** A bare damage total ("9") or the structured field. */
export function reportedTotal(action, structured = null) {
  if (Number.isInteger(structured) && structured >= 0) return structured;
  const m = String(action || '').trim().match(/^(\d{1,3})\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

// ---------------------------------------------------------------------------
// Turn bookkeeping
// ---------------------------------------------------------------------------
export function isPlayerEntry(entry) {
  return entry?.type === 'player';
}

/** Is this combatant still able to take a turn? (Dead or fled enemies,
 *  and downed or departed companions, are skipped by the loop.) */
export async function combatantCanAct(sessionId, entry) {
  if (!entry) return false;
  if (entry.type === 'enemy') {
    const m = String(entry.key || '').match(/:(\d+)$/);
    if (!m) return true;
    const row = await dbGet('SELECT current_hp, status FROM combat_enemies WHERE id = ? AND session_id = ?', [Number(m[1]), sessionId]).catch(() => null);
    if (!row) return true;
    return row.status === 'active' && (row.current_hp == null || row.current_hp > 0);
  }
  if (entry.type === 'companion') {
    const row = await dbGet(
      `SELECT c.companion_current_hp AS hp, c.status FROM companions c JOIN npcs n ON n.id = c.npc_id WHERE LOWER(n.name) = LOWER(?) ORDER BY c.id DESC LIMIT 1`,
      [entry.name]).catch(() => null);
    if (!row) return true;
    return row.status === 'active' && (row.hp == null || row.hp > 0);
  }
  return true;
}

export async function activeEnemyCount(sessionId, encounterSeq) {
  const row = await dbGet(
    "SELECT COUNT(*) AS n FROM combat_enemies WHERE session_id = ? AND encounter_seq = ? AND status = 'active' AND (current_hp IS NULL OR current_hp > 0)",
    [sessionId, encounterSeq]).catch(() => null);
  return Number(row?.n || 0);
}

/** The DM's instruction for one NPC's turn (Q2: the DM chooses). */
export function npcTurnDirective(entry, state, playerName) {
  const who = entry.name;
  const player = playerName || 'Player';
  const markerHint = entry.type === 'companion'
    ? `for an attack emit [ATTACK: Attacker="${who}" Target="<enemy name>"] (the engine rolls and resolves a companion's attack at once)`
    : `for an attack emit [ENEMY_ATTACK: Enemy="${who}" Target="${player}"] (or a companion's name as Target); for a spell, [ENEMY_CAST: …]; if ${who} runs off, [ENEMY_FLEE: Enemy="${who}"]; if ${who} gives up, [ENEMY_SURRENDER: Enemy="${who}"]; if ${who}'s side takes a deal, a bribe or a truce the party offered, [COMBAT_SETTLE: Terms="what was agreed"] (every enemy still standing stands down)`;
  return `[SYSTEM — COMBAT TURN (round ${state.round}): It is ${who}'s turn. You control ${who}: choose what ${who} does now — attack, move, cast, flee, talk, anything that fits the fight. ` +
    `Write one to three sentences describing ${who}'s action and ${markerHint}. ` +
    `Describe the attempt only — do NOT say whether it hits or how much damage it does: the engine resolves it and states the result. ` +
    `Never emit HP_CHANGE for an attack, and never emit TURN_ADVANCE — the engine moves the turn. Act for ${who} only, then stop. Do not describe ${player}'s actions.]`;
}

// ---------------------------------------------------------------------------
// Dispatch filters (B3 double-count guard; the engine owns TURN_ADVANCE)
// ---------------------------------------------------------------------------
const TURN_ADVANCE_RE = /\[TURN_ADVANCE(?:\s*:[^\]]*)?\]\s*/gi;
const HP_CHANGE_RE = /\[HP_CHANGE:[^\]]*\]\s*/gi;
const ENEMY_ATTACK_RE = /\[ENEMY_ATTACK\s*:[^\]]*\]/i;

/**
 * The text handed to the marker pipeline during a fight. Removes
 * [TURN_ADVANCE] (the engine advances turns now) and, when the same reply
 * carries an ENEMY_ATTACK, any damaging HP_CHANGE — the engine already
 * applies the enemy's damage, so the DM's HP_CHANGE for the same blow
 * would count it twice. Healing HP_CHANGEs (positive deltas) stay.
 * Returns { text, dropped: [markers removed] }. Display text is untouched.
 */
export function combatDispatchText(text, { combatActive } = {}) {
  const src = String(text || '');
  if (!combatActive) return { text: src, dropped: [] };
  const dropped = [];
  let out = src.replace(TURN_ADVANCE_RE, (m) => { dropped.push(m.trim()); return ''; });
  if (ENEMY_ATTACK_RE.test(out)) {
    out = out.replace(HP_CHANGE_RE, (m) => {
      const d = m.match(/delta\s*=\s*"?(-?\d+)/i);
      if (d && Number(d[1]) < 0) { dropped.push(m.trim()); return ''; }
      return m;
    });
  }
  return { text: out, dropped };
}

// ---------------------------------------------------------------------------
// Plain-words results (P2) and the math panel (item 7)
// ---------------------------------------------------------------------------
function signed(n) { return `${n >= 0 ? '+' : '−'} ${Math.abs(n)}`; }

/** An ENEMY_ATTACK handler result -> { line (player sees), note (DM), math }. */
export function enemyAttackResultText(r, playerName = null) {
  if (!r) return null;
  if (r.success === false) {
    return { line: `⚙ ${r.enemyName || 'The enemy'}'s attack did not go through: ${r.reason}.`, note: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Enemy attack refused: ${r.reason}.`, math: null };
  }
  if (r.type !== 'enemy_attack' || r.attackRoll == null) return null;
  // The engine names the PC target "Player"; the player reads their own name.
  const target = (r.targetType === 'player' && playerName) ? playerName : (r.targetName || 'the target');
  const dice = Array.isArray(r.attackRolls) && r.attackRolls.length > 1 ? `d20 ${r.attackRolls.join('/')} (${r.attackMode}, took ${r.attackRoll})` : `d20 ${r.attackRoll}`;
  const bonus = Number(r.attackBonus || 0) + Number(r.penalty || 0);
  const hpAfter = r.hpResult && r.hpResult.currentHp != null ? ` ${target} is at ${r.hpResult.currentHp}${r.hpResult.maxHp ? `/${r.hpResult.maxHp}` : ''} HP.` : '';
  const hitText = r.hit
    ? `${r.isCrit ? 'CRITICAL HIT' : 'HIT'} for ${r.damage} damage.${hpAfter}`
    : `MISS${r.isFumble ? ' (natural 1)' : ''}.`;
  const math = `${r.enemyName} → ${target}: ${dice} ${signed(bonus)} = ${r.totalToHit} vs AC ${r.targetAc} — ${r.hit ? (r.isCrit ? 'CRIT' : 'HIT') : 'MISS'}` +
    (r.hit ? `; damage ${r.damageDice || ''}${Array.isArray(r.damageRolls) && r.damageRolls.length ? ` [${r.damageRolls.join(', ')}]` : ''} = ${r.damage}` : '');
  return {
    line: `⚙ ${r.enemyName} attacks ${target}: ${hitText}`,
    note: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: ${r.enemyName} attacked ${target}: rolled ${r.totalToHit} vs AC ${r.targetAc} — ${r.hit ? `${r.isCrit ? 'critical hit' : 'hit'} for ${r.damage} damage` : 'miss'}.${hpAfter}`,
    math,
  };
}

/** A party attack outcome (player or companion) -> math line. */
export function partyAttackMath(o) {
  if (!o || o.type !== 'party_attack' || o.takenDie == null) return null;
  const dice = (o.dice || []).length > 1 ? `d20 ${o.dice.join('/')} (took ${o.takenDie})` : `d20 ${o.takenDie}`;
  const head = `${o.attacker} → ${o.target} (${o.weapon}): ${dice} ${signed(Number(o.attackBonus || 0))} = ${o.total} vs AC ${o.targetAc} — ${o.hit ? (o.critical === 'hit' ? 'CRIT' : 'HIT') : 'MISS'}`;
  if (o.awaitingDamage) return `${head}; roll ${o.damageDiceText} for damage`;
  if (!o.hit) return head;
  if (o.damageRoll != null) {
    // Everything the engine added after the player's dice: the flat
    // modifier, GWM, and settle-time flats (Divine Fury's half-level…).
    const bonus = Number(o.damage || 0) - Number(o.damageRoll || 0);
    return `${head}; damage: rolled ${o.damageRoll} ${signed(bonus)} = ${o.damage}${o.damageType ? ` ${o.damageType}` : ''}`;
  }
  return `${head}; damage ${o.damage}${Array.isArray(o.damageRolls) && o.damageRolls.length ? ` [${o.damageRolls.join(', ')}]` : ''}`;
}

/** A party attack refusal -> { line, note }. */
export function partyAttackRefusalText(r) {
  if (!r || r.type !== 'party_attack' || r.success !== false) return null;
  return {
    line: `⚙ That attack did not go through: ${r.reason}`,
    note: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: The ATTACK marker was refused: ${r.reason}. Do not narrate it as a hit or a miss.`,
  };
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------
/**
 * Run NPC turns until it is the player's turn again.
 *
 *   playerTurnDone — advance past the player first (their action resolved).
 *   callDm(directive, systemPrompt) -> Promise<string> (the DM's raw reply)
 *   dispatch(rawText) -> Promise<{ handlerResults }> (the normal pipeline,
 *     already wrapped with combatDispatchText by the caller)
 *
 * Returns { turns: [{ combatant, raw, handlerResults }], advanced: [state], state, ended, stoppedOn }.
 * Never throws: a failed DM call stops the loop where it is, so the
 * player can carry on (the next player turn retries).
 */
export async function runNpcTurns({ sessionId, encounterSeq, playerTurnDone, playerName, baseSystemPrompt, callDm, dispatch, alreadyActed = [] }) {
  // NPCs whose ordinary attack already resolved in this message's main
  // reply (the DM narrated the NPC's turn itself): their turn is taken.
  const acted = new Set((alreadyActed || []).map((n) => String(n).toLowerCase()));
  const turns = [];
  const advanced = []; // every state an advance produced (lair ticks, turn-start effects)
  let state = await getTurnState(sessionId, encounterSeq).catch(() => null);
  if (!state?.turnOrder?.length) return { turns, advanced, state, ended: false, stoppedOn: 'no-turn-order' };
  if (await getPendingInitiative(sessionId)) return { turns, advanced, state, ended: false, stoppedOn: 'awaiting-initiative' };
  if (isPlayerEntry(state.currentTurn)) {
    if (!playerTurnDone) return { turns, advanced, state, ended: false, stoppedOn: 'player-turn' };
    state = await advanceTurn(sessionId, encounterSeq);
    if (state) advanced.push(state);
  }
  // One full round at most per player message: a guard, never the norm.
  const maxSteps = state?.turnOrder?.length || 0;
  for (let step = 0; state && step < maxSteps && !isPlayerEntry(state.currentTurn); step++) {
    if (await activeEnemyCount(sessionId, encounterSeq) === 0) return { turns, advanced, state, ended: true, stoppedOn: 'no-enemies' };
    const entry = state.currentTurn;
    if (acted.has(String(entry.name).toLowerCase())) {
      acted.delete(String(entry.name).toLowerCase());
    } else if (await combatantCanAct(sessionId, entry)) {
      const systemPrompt = `${baseSystemPrompt}\n\n${formatTurnStateBlock(state)}`;
      let raw;
      try {
        raw = String(await callDm(npcTurnDirective(entry, state, playerName), systemPrompt) || '');
      } catch (e) {
        console.error('[combatLoop] NPC turn call failed:', e.message);
        return { turns, advanced, state, ended: false, stoppedOn: 'dm-call-failed' };
      }
      let handlerResults = [];
      try { handlerResults = (await dispatch(raw))?.handlerResults || []; } catch (e) { console.error('[combatLoop] NPC dispatch failed:', e.message); }
      turns.push({ combatant: entry, raw, handlerResults });
      // An accepted COMBAT_END or a settlement ends the fight; a COMBAT_END
      // refused while enemies stand does not (combat resolution).
      if (handlerResults.some((hr) => (hr?.schemaKey === 'COMBAT_END' && !hr.result?.refused)
          || ((hr?.schemaKey === 'COMBAT_SETTLE' || hr?.schemaKey === 'COMBAT_ESCAPE') && hr.result?.success === true))) {
        return { turns, advanced, state, ended: true, stoppedOn: 'combat-end' };
      }
    }
    state = await advanceTurn(sessionId, encounterSeq);
    if (state) advanced.push(state);
  }
  return { turns, advanced, state, ended: false, stoppedOn: state && isPlayerEntry(state.currentTurn) ? 'player-turn' : 'max-steps' };
}

export default {
  PLAYER_ROLL_KEYS, pendingPlayerRolls, setPendingInitiative, getPendingInitiative, resolvePlayerInitiative, formatInitiativeFact,
  setPendingDeathSave, takePendingDeathSave, findPendingConcentration, queueConcentrationSaves, resolvePendingConcentration, setPendingHeal, resolvePendingHeal, reportedD20, reportedTotal, isPlayerEntry, combatantCanAct, activeEnemyCount,
  npcTurnDirective, combatDispatchText, enemyAttackResultText, partyAttackMath, partyAttackRefusalText, runNpcTurns,
};
