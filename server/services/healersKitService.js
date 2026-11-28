/**
 * Healer's Kit — stabilize with no check (healers-kit-stabilize, 2026-11-27).
 *
 * Source: 2024 PHB, Healer's Kit (book rule, not homebrew — no flag):
 *   "This kit has ten uses. As a Utilize action, you can expend one of its
 *    uses to stabilize an Unconscious creature that has 0 Hit Points
 *    without needing to make a Wisdom (Medicine) check."
 *   A stabilized creature regains 1 Hit Point after 1d4 hours.
 *
 * The DM writes [HEALERS_KIT: User="<who uses it>" Target="<who is down>"]
 * (User defaults to the player). The engine checks, spends, and records:
 *   - the kit comes from the party inventory (the player character's
 *     inventory — the shared pool since migration 032);
 *   - one use is spent; uses ride the inventory entry as `uses` (uses left
 *     in the opened kit). An entry without `uses` is an unopened kit: ten.
 *     A stack of N kits spends the opened one first; the last kit at 0 uses
 *     stays in the inventory, spent, so a refusal can say so;
 *   - the target is stabilized: death-save successes 3, failures 0, still
 *     at 0 HP and unconscious (the same stable state three successful death
 *     saves leave — characterHpService). Damage at 0 HP clears it;
 *   - the 1d4 hours: a companion's die is the engine's (the DM's creature);
 *     the player character's die is the player's (Zach 2026-11-23: the DM
 *     never rolls for the player) — asked through the out-of-combat roll
 *     asks (playerRollService, pendingRecoveryDie). The recovery fires when
 *     the session clock passes the hour (restTimeService.advanceClockForSession).
 * Refusals spend nothing.
 *
 * The Medicine-check path (no kit, DC 10) keeps its check; since
 * stabilize-recovery-alignment it leaves the same stable state and starts
 * the same 1d4 recovery (startStableRecovery), as do three death-save successes.
 */
import { dbGet, dbRun, dbAll } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { isPlayerRef } from '../utils/playerName.js';
import { roll } from '../utils/rng.js';
import { daysBetween } from '../config/harptos.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { hasIncapacitatingCondition } from './conditionService.js';
import { getClock } from './scheduleService.js';

export const KIT_USES = 10;
export const RECOVERY_DIE = '1d4';

// ---------------------------------------------------------------------------
// Inventory: finding the kit, counting and spending uses (pure)
// ---------------------------------------------------------------------------

/** "Healer's Kit", "Healer’s kit", "healers kit" → "healers kit". */
export function normalizeItemName(name) {
  return String(name || '').toLowerCase().replace(/['’`]/g, '').replace(/\s+/g, ' ').trim();
}

export function isHealersKit(item) {
  return !!item && normalizeItemName(item.name) === 'healers kit';
}

function stackOf(item) {
  const q = Math.trunc(Number(item?.quantity));
  return Number.isFinite(q) && q >= 1 ? q : 1;
}

/** Uses left in the opened kit of a stack; an entry with no record is fresh. */
export function kitUsesLeft(item) {
  const u = Number(item?.uses);
  return Number.isInteger(u) && u >= 0 ? Math.min(u, KIT_USES) : KIT_USES;
}

/** Every use left across a kit stack. */
export function kitTotalUses(item) {
  const u = kitUsesLeft(item);
  return u > 0 ? (stackOf(item) - 1) * KIT_USES + u : (stackOf(item) - 1) * KIT_USES;
}

/**
 * Spend one use from the first kit stack that has one. Pure: returns
 * { ok, inventory (new array), usesLeft (opened kit), totalLeft } or
 * { ok: false, reason: 'no_kit' | 'spent' }.
 */
export function spendKitUse(inventory) {
  const inv = Array.isArray(inventory) ? inventory.map((i) => (i && typeof i === 'object' ? { ...i } : i)) : [];
  const kits = inv.map((it, i) => ({ it, i })).filter(({ it }) => isHealersKit(it));
  if (!kits.length) return { ok: false, reason: 'no_kit' };
  const pick = kits.find(({ it }) => kitTotalUses(it) > 0);
  if (!pick) return { ok: false, reason: 'spent' };
  const item = pick.it;
  let q = stackOf(item);
  let u = kitUsesLeft(item);
  if (u <= 0 && q > 1) { q -= 1; u = KIT_USES; } // an emptied kit left on a stack: open the next
  u -= 1;
  if (u === 0 && q > 1) { q -= 1; u = KIT_USES; } // the opened kit is used up: discard it, open the next
  item.quantity = q;
  item.uses = u;
  return { ok: true, inventory: inv, usesLeft: u, totalLeft: kitTotalUses(item) };
}

// ---------------------------------------------------------------------------
// The clock: one absolute hour scale
// ---------------------------------------------------------------------------

/** Absolute game hour of a clock (scheduleService.getClock shape). One
 *  formula for campaign and campaign-less clocks: days since 1 DR day 1. */
export function absoluteHour(clock) {
  const doy = Number(clock?.dayOfYear) || 1;
  const year = Number(clock?.year) || 1492;
  const hour = Number(clock?.hour) || 0;
  return daysBetween(1, 1, doy, year) * 24 + hour;
}

async function clockFor(characterId) {
  const pc = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [characterId]);
  const campaignId = pc?.campaign_id ?? null;
  return getClock(campaignId, campaignId == null ? { characterId } : {});
}

// ---------------------------------------------------------------------------
// Party members: who is who, and what state they are in
// ---------------------------------------------------------------------------

async function resolveMember(characterId, raw) {
  const c = await dbGet('SELECT id, name FROM characters WHERE id = ?', [characterId]);
  if (!c) return null;
  const wanted = String(raw || '').trim();
  if (!wanted || isPlayerRef(wanted, c.name)) return { kind: 'player', id: c.id, name: c.name };
  const comp = await dbGet(
    `SELECT c.id, n.name FROM companions c JOIN npcs n ON n.id = c.npc_id
      WHERE c.recruited_by_character_id = ? AND c.status = 'active' AND LOWER(n.name) = LOWER(?) LIMIT 1`,
    [characterId, wanted]);
  if (comp) return { kind: 'companion', id: comp.id, name: comp.name };
  // A first name ("Lyra" for "Lyra Dawnwhisper").
  const rows = await dbAll(
    `SELECT c.id, n.name FROM companions c JOIN npcs n ON n.id = c.npc_id
      WHERE c.recruited_by_character_id = ? AND c.status = 'active'`, [characterId]).catch(() => []);
  const low = wanted.toLowerCase();
  const hit = (rows || []).find((r) => String(r.name || '').toLowerCase().split(/\s+/)[0] === low);
  return hit ? { kind: 'companion', id: hit.id, name: hit.name } : null;
}

/** { hp, dead, stable, successes, failures } for a party member. */
export async function memberState(m) {
  if (m.kind === 'player') {
    const r = await dbGet('SELECT current_hp, is_dead, death_save_successes, death_save_failures FROM characters WHERE id = ?', [m.id]);
    if (!r) return null;
    const hp = Number(r.current_hp) || 0;
    return { hp, dead: !!r.is_dead, stable: hp === 0 && !r.is_dead && (r.death_save_successes || 0) >= 3, successes: r.death_save_successes || 0, failures: r.death_save_failures || 0 };
  }
  const r = await dbGet('SELECT companion_current_hp, status, death_save_successes, death_save_failures FROM companions WHERE id = ?', [m.id]);
  if (!r) return null;
  const hp = Number(r.companion_current_hp) || 0;
  const dead = r.status === 'dead' || r.status === 'deceased' || (r.death_save_failures || 0) >= 3;
  return { hp, dead, stable: hp === 0 && !dead && (r.death_save_successes || 0) >= 3, successes: r.death_save_successes || 0, failures: r.death_save_failures || 0 };
}

/** In a fight with a turn order, the user must be the one whose turn it is. */
async function turnRefusal(sessionId, user) {
  if (!sessionId) return null;
  try {
    const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
    const { ledgerKeyForTarget, checkTurnIdentity } = await import('./turnLedgerService.js');
    const seq = await getCurrentEncounterSeq(sessionId);
    if (!seq) return null;
    const id = await checkTurnIdentity(sessionId, seq, await ledgerKeyForTarget(user.kind, user.id));
    return id.allowed ? null : `${id.reason} ${id.remedy}`;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// The recovery: 1 HP after 1d4 hours
// ---------------------------------------------------------------------------

async function setRecoverAt(kind, id, at) {
  const table = kind === 'player' ? 'characters' : 'companions';
  await dbRun(`UPDATE ${table} SET stable_recover_at = ? WHERE id = ?`, [at, id]);
}

/**
 * stabilize-recovery-alignment (2026-11-27; 2024 PHB, book rule, no flag):
 * every stable creature regains 1 HP after 1d4 hours — not only a
 * kit-stabilized one. Called by the two non-kit routes to stable: the
 * Medicine check (companion route) and three successful death saves
 * (the player's rollDeathSave, the companion death-save route). The caller
 * has already written the stable state (successes 3 at 0 HP).
 *   - companion: the engine rolls the d4 (the DM's creature);
 *   - player: the player rolls it — the same out-of-combat ask the kit
 *     uses (pendingRecoveryDie, settled by applyReportedRecoveryDie).
 * The Healer's Kit path keeps its own code (unchanged by this job).
 */
export async function startStableRecovery({ kind, id, sessionId = null }) {
  if (kind === 'player') {
    const now = absoluteHour(await clockFor(id));
    await setRecoverAt('player', id, null);
    if (!sessionId) return { die: RECOVERY_DIE, pendingPlayerDie: false, note: 'no session: the recovery die is not asked' };
    const cfg = await readSessionCfg(sessionId);
    cfg.pendingRecoveryDie = { characterId: id, stabilizedAt: now, postedAt: Date.now() };
    await writeSessionCfg(sessionId, cfg);
    return { die: RECOVERY_DIE, pendingPlayerDie: true };
  }
  const row = await dbGet('SELECT recruited_by_character_id FROM companions WHERE id = ?', [id]);
  if (!row) return null;
  const now = absoluteHour(await clockFor(row.recruited_by_character_id));
  const d = roll(4, 1, { reason: 'stable recovery' }).total;
  await setRecoverAt('companion', id, now + d);
  return { die: RECOVERY_DIE, hours: d, recoverAt: now + d };
}

async function readSessionCfg(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {}) || {};
}

async function writeSessionCfg(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
}

/**
 * Settle the player's 1d4 for their own recovery (an out-of-combat ask,
 * playerRollService). Returns { error } for a bad report (the ask stays),
 * or { hours, recoverAt, recovered? }.
 */
export async function applyReportedRecoveryDie(sessionId, numbers) {
  const cfg = await readSessionCfg(sessionId);
  const ask = cfg.pendingRecoveryDie;
  if (!ask) return null;
  const n = Array.isArray(numbers) && numbers.length === 1 ? numbers[0] : null;
  if (!Number.isInteger(n) || n < 1 || n > 4) return { error: 'send one number from 1 to 4 (your d4)' };
  delete cfg.pendingRecoveryDie;
  await writeSessionCfg(sessionId, cfg);
  const st = await memberState({ kind: 'player', id: ask.characterId });
  if (!st || st.dead || !st.stable) return { hours: n, lapsed: true };
  const recoverAt = Number(ask.stabilizedAt) + n;
  await setRecoverAt('player', ask.characterId, recoverAt);
  // The clock may already have passed the hour (time moved before the report).
  const recovered = await processStableRecoveries(ask.characterId);
  return { hours: n, recoverAt, recovered: recovered.length ? recovered : undefined };
}

/**
 * Every party member who is stable at 0 HP and whose recovery hour the
 * clock has reached regains 1 HP. Returns [{ kind, id, name }].
 */
export async function processStableRecoveries(characterId, clock = null) {
  if (!characterId) return [];
  const now = absoluteHour(clock || await clockFor(characterId));
  const out = [];
  const pc = await dbGet(
    `SELECT id, name, current_hp, is_dead, death_save_successes, stable_recover_at FROM characters WHERE id = ?`, [characterId]);
  if (pc && pc.stable_recover_at != null && Number(pc.stable_recover_at) <= now) {
    if ((Number(pc.current_hp) || 0) === 0 && !pc.is_dead && (pc.death_save_successes || 0) >= 3) {
      const { applyHpChange } = await import('./characterHpService.js');
      await applyHpChange(pc.id, 1, "healer's kit recovery");
      out.push({ kind: 'player', id: pc.id, name: pc.name });
    }
    await setRecoverAt('player', pc.id, null);
  }
  const comps = await dbAll(
    `SELECT c.id, n.name, c.companion_current_hp, c.status, c.death_save_successes, c.death_save_failures, c.stable_recover_at
       FROM companions c JOIN npcs n ON n.id = c.npc_id
      WHERE c.recruited_by_character_id = ? AND c.stable_recover_at IS NOT NULL`, [characterId]).catch(() => []);
  for (const c of comps || []) {
    if (Number(c.stable_recover_at) > now) continue;
    const dead = c.status === 'dead' || c.status === 'deceased' || (c.death_save_failures || 0) >= 3;
    if ((Number(c.companion_current_hp) || 0) === 0 && !dead && (c.death_save_successes || 0) >= 3) {
      await dbRun(
        `UPDATE companions SET companion_current_hp = 1, death_save_successes = 0, death_save_failures = 0, stable_recover_at = NULL WHERE id = ?`,
        [c.id]);
      out.push({ kind: 'companion', id: c.id, name: c.name });
    } else {
      await setRecoverAt('companion', c.id, null);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Using the kit
// ---------------------------------------------------------------------------

function refuse(reason, extra = {}) {
  return { type: 'healers_kit', success: false, reason, ...extra };
}

/**
 * Use a Healer's Kit. Refuses (spending nothing) when the user cannot act,
 * the target is not down, the kit is missing or spent.
 */
export async function useHealersKit({ characterId, sessionId = null, user: userRaw = null, target: targetRaw }) {
  if (!characterId) return null;
  if (!String(targetRaw || '').trim()) return refuse('HEALERS_KIT needs Target= (the creature at 0 Hit Points)');
  const user = await resolveMember(characterId, userRaw || 'player');
  if (!user) return refuse(`unknown user: ${userRaw} — the kit's user must be the player or an active companion`);
  const target = await resolveMember(characterId, targetRaw);
  if (!target) return refuse(`unknown target: ${targetRaw} — the target must be the player or an active companion`);

  // The user cannot act: dead, down, or incapacitated.
  const us = await memberState(user);
  if (!us || us.dead) return refuse(`${user.name} is dead and cannot act`, { refusal: 'user_cannot_act' });
  if (us.hp <= 0) return refuse(`${user.name} is at 0 Hit Points and cannot act`, { refusal: 'user_cannot_act' });
  if (await hasIncapacitatingCondition(user.kind, user.id)) return refuse(`${user.name} is incapacitated and cannot act`, { refusal: 'user_cannot_act' });
  const outOfTurn = await turnRefusal(sessionId, user);
  if (outOfTurn) return refuse(outOfTurn, { refusal: 'user_cannot_act' });

  // The target must be dying: at 0 HP, not dead, not already stable.
  const ts = await memberState(target);
  if (!ts) return refuse(`unknown target: ${targetRaw}`);
  if (ts.dead) return refuse(`${target.name} is dead — a Healer's Kit cannot help`, { refusal: 'target_not_down' });
  if (ts.hp > 0) return refuse(`${target.name} is not at 0 Hit Points (${ts.hp} HP) — a Healer's Kit only stabilizes a creature at 0 HP`, { refusal: 'target_not_down' });
  if (ts.stable) return refuse(`${target.name} is already stable — no use spent`, { refusal: 'target_already_stable' });

  // The kit: the party inventory.
  const pc = await dbGet('SELECT inventory FROM characters WHERE id = ?', [characterId]);
  const inv = safeParse(pc?.inventory, []);
  const spent = spendKitUse(Array.isArray(inv) ? inv : []);
  if (!spent.ok) {
    return spent.reason === 'spent'
      ? refuse("the party's Healer's Kit has no uses left — it is spent", { refusal: 'kit_spent' })
      : refuse("the party has no Healer's Kit", { refusal: 'no_kit' });
  }
  await dbRun('UPDATE characters SET inventory = ? WHERE id = ?', [JSON.stringify(spent.inventory), characterId]);

  // Stabilize: still 0 HP and unconscious; the saves stop.
  const clock = await clockFor(characterId);
  const now = absoluteHour(clock);
  let recovery;
  if (target.kind === 'player') {
    await dbRun(
      `UPDATE characters SET is_unconscious = 1, death_save_successes = 3, death_save_failures = 0, stable_recover_at = NULL WHERE id = ?`,
      [target.id]);
    if (sessionId) {
      const cfg = await readSessionCfg(sessionId);
      // The death save the player was asked for is moot now.
      if (cfg.pendingDeathSave && Number(cfg.pendingDeathSave.characterId) === Number(target.id)) delete cfg.pendingDeathSave;
      cfg.pendingRecoveryDie = { characterId: target.id, stabilizedAt: now, postedAt: Date.now() };
      await writeSessionCfg(sessionId, cfg);
      recovery = { die: RECOVERY_DIE, pendingPlayerDie: true };
    } else {
      recovery = { die: RECOVERY_DIE, pendingPlayerDie: false, note: 'no session: the recovery die is not asked' };
    }
  } else {
    const d = roll(4, 1, { reason: "healer's kit recovery" }).total;
    await dbRun(
      `UPDATE companions SET death_save_successes = 3, death_save_failures = 0, stable_recover_at = ? WHERE id = ?`,
      [now + d, target.id]);
    recovery = { die: RECOVERY_DIE, hours: d };
  }

  return {
    type: 'healers_kit', success: true,
    user: user.name, userKind: user.kind, target: target.name, targetKind: target.kind,
    usesLeft: spent.usesLeft, totalUsesLeft: spent.totalLeft, recovery,
  };
}

/**
 * Who in the party is dying right now (0 HP, not dead, not stable), and the
 * party kit's uses left — the cue a companion's combat turn carries so the
 * DM knows the kit is there (live probe, 2026-11-27: with only a generic
 * mention, gemma4:12b had the companion attack while the player was dying).
 * It is an offer: the DM still chooses the companion's action.
 */
export async function dyingPartyCue(characterId) {
  if (!characterId) return null;
  const pc = await dbGet('SELECT id, name, nickname, inventory FROM characters WHERE id = ?', [characterId]);
  if (!pc) return null;
  const inv = safeParse(pc.inventory, []);
  const kits = (Array.isArray(inv) ? inv : []).filter(isHealersKit);
  const kitUses = kits.reduce((n, k) => n + kitTotalUses(k), 0);
  const dying = [];
  const ps = await memberState({ kind: 'player', id: pc.id });
  if (ps && !ps.dead && ps.hp === 0 && !ps.stable) dying.push(pc.name);
  const comps = await dbAll(
    `SELECT c.id, n.name FROM companions c JOIN npcs n ON n.id = c.npc_id
      WHERE c.recruited_by_character_id = ? AND c.status = 'active' AND COALESCE(c.companion_current_hp, 0) = 0`, [characterId]).catch(() => []);
  for (const c of comps || []) {
    const st = await memberState({ kind: 'companion', id: c.id });
    if (st && !st.dead && !st.stable) dying.push(c.name);
  }
  return dying.length ? { dying, kitUses } : null;
}

/** Player-facing line + DM note for a HEALERS_KIT result. */
export function healersKitResultText(r, playerName = null) {
  if (!r) return null;
  if (r.success === false) {
    return {
      line: `⚙ Healer's Kit not used: ${r.reason}.`,
      note: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: HEALERS_KIT refused — ${r.reason}. Nothing was spent and nobody was stabilized; narrate accordingly.`,
    };
  }
  const tgt = r.targetKind === 'player' && playerName ? playerName : r.target;
  const left = `${r.totalUsesLeft} use${r.totalUsesLeft === 1 ? '' : 's'} left`;
  const rec = r.recovery?.hours ? ` ${r.target} will regain 1 HP in ${r.recovery.hours} hour${r.recovery.hours === 1 ? '' : 's'}.` : '';
  return {
    line: `⚙ ${r.user} uses a Healer's Kit on ${tgt}: stabilized, no check (kit: ${left}).${rec}`,
    note: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: HEALERS_KIT applied — ${r.user} spent one use of the party's Healer's Kit (${left}). ${r.target} is STABLE: still at 0 HP and unconscious, no more death saves. ` +
      (r.recovery?.hours ? `${r.target} regains 1 HP after ${r.recovery.hours} hour(s) of game time.` : r.recovery?.pendingPlayerDie ? 'The player rolls 1d4 for the hours until they regain 1 HP.' : ''),
  };
}

registerMarkerHandler('HEALERS_KIT', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    return await useHealersKit({
      characterId: context.characterId, sessionId: context.sessionId ?? null,
      user: parsed?.User || null, target: parsed?.Target,
    });
  } catch (e) {
    console.error('[healersKitService] HEALERS_KIT failed:', e.message);
    return null;
  }
});

export default {
  KIT_USES, RECOVERY_DIE, normalizeItemName, isHealersKit, kitUsesLeft, kitTotalUses, spendKitUse,
  absoluteHour, memberState, useHealersKit, applyReportedRecoveryDie, processStableRecoveries,
  healersKitResultText, startStableRecovery,
};
