/**
 * Combat item 6: the last-damage record.
 *
 * One record per damage target, in session_config.lastDamage, keyed by
 * `${kind}:${id}` (kind 'player' | 'companion' | 'enemy'). Every damage
 * path writes it: who was hit, how much HP damage (after temp HP, so it
 * matches what concentration checks see), what type when known, and
 * who dealt it (null for traps, falls, and other unattributed damage).
 *
 * The record is what the damage-hook reactions read. It is consumed on
 * use (one reaction per damage event) and replaced by newer damage —
 * an unanswered hit's reaction opportunity is lost when the next hit
 * lands, which matches the fiction. It is transient combat state, not
 * a ledger: it never survives the encounter in any meaningful sense,
 * and it is never the source of truth for HP (the HP columns are).
 *
 * Zero-damage events (misses, saves for none) write nothing: the
 * trio triggers on being damaged, and no damage means no trigger.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';

async function readCfg(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {}) || {};
}

async function writeCfg(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
}

function keyFor(kind, id) {
  return `${kind}:${id}`;
}

export async function recordDamage(sessionId, targetKind, targetId, { amount, type = null, attackerKind = null, attackerId = null, attackerName = null, encounterSeq = null } = {}) {
  if (!sessionId || !targetKind || targetId == null || !(amount > 0)) return null;
  try {
    const cfg = await readCfg(sessionId);
    const map = (cfg.lastDamage && typeof cfg.lastDamage === 'object') ? cfg.lastDamage : {};
    const record = {
      amount,
      type: type || null,
      attackerKind: attackerKind || null,
      attackerId: attackerId ?? null,
      attackerName: attackerName || null,
      encounterSeq: encounterSeq ?? null,
      consumed: false,
      at: new Date().toISOString(),
    };
    map[keyFor(targetKind, targetId)] = record;
    cfg.lastDamage = map;
    await writeCfg(sessionId, cfg);
    return record;
  } catch { return null; }
}

/** Read the record without consuming it; null when absent or consumed. */
export async function peekDamage(sessionId, targetKind, targetId) {
  try {
    const cfg = await readCfg(sessionId);
    const rec = cfg.lastDamage?.[keyFor(targetKind, targetId)] || null;
    return rec && !rec.consumed ? rec : null;
  } catch { return null; }
}

/** Read and consume the record; null when absent or already consumed. */
export async function takeDamage(sessionId, targetKind, targetId) {
  try {
    const cfg = await readCfg(sessionId);
    const map = (cfg.lastDamage && typeof cfg.lastDamage === 'object') ? cfg.lastDamage : {};
    const rec = map[keyFor(targetKind, targetId)] || null;
    if (!rec || rec.consumed) return null;
    rec.consumed = true;
    cfg.lastDamage = map;
    await writeCfg(sessionId, cfg);
    return rec;
  } catch { return null; }
}

export default { recordDamage, peekDamage, takeDamage };
