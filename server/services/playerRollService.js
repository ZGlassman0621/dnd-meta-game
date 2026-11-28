/**
 * The player's out-of-combat rolls (player-rolls-out-of-combat job,
 * 2026-11-23). Zach: "ALWAYS — as a rule, the DM never rolls for the
 * player." The engine posts an ask on session_config, tells the player
 * what to roll, and settles the numbers the player reports in a later
 * message, adding every modifier after the roll:
 *
 *   pendingHitDice   — a short rest's Hit Dice (restTimeService)
 *   pendingColdSaves — the hourly cold-exposure CON saves, one batch
 *                      per stretch (coldExposureService)
 *
 * One ask settles per message, Hit Dice first. In-combat rolls and
 * DM-requested checks (pendingRoll) settle elsewhere in the route and
 * take precedence; the route calls settleOutOfCombatRoll only when none
 * of those is waiting.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { applyReportedHitDice, formatHitDiceMath } from './restTimeService.js';
import {
  applyReportedColdSaves, formatColdSaveMath, formatColdSavePrompt, erodedConModifier,
} from './coldExposureService.js';
import { applyReportedRecoveryDie } from './healersKitService.js';

async function readCfg(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {}) || {};
}

/**
 * A message that is only numbers ("7", "7 4", "12, 7, 15 and 3") → the
 * numbers; anything else → null. Up to 48 numbers (two dice an hour
 * across a long march), each up to three digits.
 */
export function reportedNumberList(action) {
  const s = String(action || '').trim();
  if (!/^\d{1,3}(?:\s*(?:,|and|&|\s)\s*\d{1,3}){0,47}$/i.test(s)) return null;
  return s.split(/\s*(?:,|and|&|\s)\s*/i).filter(Boolean).map((n) => parseInt(n, 10));
}

/** Which out-of-combat asks are waiting, in settlement order. */
export async function pendingOutOfCombatRolls(sessionId) {
  const cfg = await readCfg(sessionId);
  return ['pendingHitDice', 'pendingColdSaves', 'pendingRecoveryDie'].filter((k) => cfg[k]);
}

/**
 * Settle the first waiting ask from the player's numbers. Returns null
 * when nothing waits or the message is not a number list; otherwise
 * { kind, line, fact } — line is the player's "⚙" text, fact the DM's
 * binding system fact — or { kind, line, error } for a bad report (the
 * ask stays, and the line says what to send).
 */
export async function settleOutOfCombatRoll(sessionId, action) {
  const numbers = reportedNumberList(action);
  if (!numbers) return null;
  const cfg = await readCfg(sessionId);
  if (cfg.pendingHitDice) {
    const ask = cfg.pendingHitDice;
    const r = await applyReportedHitDice(ask.characterId, ask, numbers);
    if (r.error) return { kind: 'hit_dice', error: r.error, line: `⚙ Hit Dice not spent: ${r.error}.` };
    const fresh = await readCfg(sessionId);
    delete fresh.pendingHitDice;
    await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(fresh), sessionId]);
    const math = formatHitDiceMath(r);
    return {
      kind: 'hit_dice', result: r, line: `⚙ ${math}.`,
      fact: r.none
        ? `[HIT DICE — system fact: the player spent no Hit Dice on the short rest. HP stays ${r.hpTo}/${r.maxHp}. The rest's hour has ALREADY passed on the clock — do not write TIME_ADVANCE or REST for it. Narrate it.]`
        : `[HIT DICE — system fact: the player rolled their Hit Dice (${r.rolls.map((x) => `${x.die} ${x.roll}`).join(', ')}); the engine added CON to each: +${r.healed} HP, now ${r.hpTo}/${r.maxHp}. ${r.remaining} Hit ${r.remaining === 1 ? 'Die' : 'Dice'} left. The rest's hour has ALREADY passed on the clock — do not write TIME_ADVANCE or REST for it. Narrate the rest's recovery; do not change the numbers.]`,
    };
  }
  if (cfg.pendingColdSaves) {
    const r = await applyReportedColdSaves(sessionId, numbers);
    if (!r) return null;
    if (r.error) return { kind: 'cold_saves', error: r.error, line: `⚙ Cold saves not settled: ${r.error}.` };
    const fails = r.hours.filter((x) => x.outcome === 'failure' || x.outcome === 'critical_failure').length;
    return {
      kind: 'cold_saves', result: r, line: `⚙ ${formatColdSaveMath(r)}.`,
      fact: `[COLD EXPOSURE — system fact: the player rolled ${r.hours.length} hourly Constitution save(s) against the cold; ${fails} failed. Frost ${r.frostBefore} → ${r.frostAfter}.${r.died ? ' THE PLAYER CHARACTER HAS DIED OF THE COLD.' : ''} Narrate it.]`,
    };
  }
  if (cfg.pendingRecoveryDie) {
    // healers-kit-stabilize: the player's 1d4 — hours until a
    // kit-stabilized player character regains 1 HP (2024 PHB).
    const r = await applyReportedRecoveryDie(sessionId, numbers);
    if (!r) return null;
    if (r.error) return { kind: 'recovery_die', error: r.error, line: `⚙ Recovery die not settled: ${r.error}.` };
    if (r.lapsed) {
      return { kind: 'recovery_die', result: r, line: `⚙ Recovery die ${r.hours}: you are no longer stable at 0 HP, so it no longer applies.`,
        fact: `[RECOVERY DIE — system fact: the player rolled ${r.hours}, but they are no longer stable at 0 HP; nothing changes. Narrate on.]` };
    }
    const woke = r.recovered?.some((x) => x.kind === 'player');
    return {
      kind: 'recovery_die', result: r,
      line: woke ? `⚙ Recovery die ${r.hours}: those hours have already passed — you regain 1 HP and wake.`
        : `⚙ Recovery die ${r.hours}: you regain 1 HP after ${r.hours} hour${r.hours === 1 ? '' : 's'} of rest.`,
      fact: woke
        ? `[RECOVERY DIE — system fact: the player rolled ${r.hours}; that much time has already passed, so the player character has regained 1 HP and is conscious. Narrate it.]`
        : `[RECOVERY DIE — system fact: the player rolled ${r.hours}. The player character stays stable and unconscious at 0 HP and regains 1 HP after ${r.hours} hour(s) of game time — the engine applies it when the clock gets there. Narrate on.]`,
    };
  }
  return null;
}

/** The player-facing asks for whatever out-of-combat roll is waiting. */
export async function outOfCombatRollPrompts(sessionId) {
  const cfg = await readCfg(sessionId);
  if (cfg.pendingHitDice) {
    const a = cfg.pendingHitDice;
    const sign = a.conMod >= 0 ? `+${a.conMod}` : `${a.conMod}`;
    const n = a.dice.length;
    return [`🎲 Short rest: you're at ${a.hp}/${a.maxHp} HP with ${n} Hit ${n === 1 ? 'Die' : 'Dice'} left (${a.dice.join(', ')}). Spend as many as you like: roll them and send the numbers in that order (e.g. "${a.dice.slice(0, 2).map((_, i) => [6, 4][i]).join(' ')}"), or send 0 to spend none. The engine adds ${sign} (CON) to each after.`];
  }
  if (cfg.pendingColdSaves) {
    let conMod = 0;
    try {
      const pc = await dbGet('SELECT ability_scores, frost_exhaustion FROM characters WHERE id = ?', [cfg.pendingColdSaves.characterId]);
      conMod = erodedConModifier(safeParse(pc?.ability_scores, {}) || {}, Number(pc?.frost_exhaustion) || 0);
    } catch { /* the prompt still asks for the dice */ }
    return [formatColdSavePrompt(cfg.pendingColdSaves, conMod)];
  }
  if (cfg.pendingRecoveryDie) {
    // Only while the player is still stable (a hit at 0 HP ends it).
    const pc = await dbGet('SELECT current_hp, is_dead, death_save_successes FROM characters WHERE id = ?', [cfg.pendingRecoveryDie.characterId]);
    if (!pc || pc.is_dead || (pc.current_hp || 0) > 0 || (pc.death_save_successes || 0) < 3) return [];
    return ["🎲 You're stable. Roll a d4 and send the number: that many hours from now you regain 1 HP."];
  }
  return [];
}

export default { reportedNumberList, pendingOutOfCombatRolls, settleOutOfCombatRoll, outOfCombatRollPrompts };
