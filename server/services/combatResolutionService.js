/**
 * Combat resolution (combat-resolution job, 2026-11-23) —
 * docs/pm/combat-resolution/BRIEF.md.
 *
 * Zach: "Fights need some sort of resolution. If both thugs are still
 * standing, there has to be a reason for it — they ran off, we ended up
 * talking things out; something must happen in order for that outcome."
 *
 * An enemy leaves a fight four ways, each a combat_enemies.status:
 *   dead         — HP 0 (enemyCombatService, unchanged)
 *   fled         — ran off: morale flight (moraleService, the engine's
 *                  roll) OR the DM's [ENEMY_FLEE] — one state, one path
 *                  (setEnemyStatus), so a flight the DM chooses and one
 *                  morale forces are the same thing to everything after
 *   surrendered  — yielded: the DM's [ENEMY_SURRENDER]
 *   settled      — stood down by agreement: the DM's [COMBAT_SETTLE],
 *                  which settles every enemy still standing at once
 *
 * The DM chooses (it controls every NPC, Zach 2026-11-23); the engine
 * records it, marks the enemy out of the turn order, and ends the fight
 * when no enemy is left active. [COMBAT_END] while an enemy is still
 * active is refused (combatMarkerService), with the resolutions named.
 */
import { dbAll, dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { getCurrentEncounterSeq } from './enemyCombatService.js';

export const RESOLVED_STATUSES = Object.freeze(['dead', 'fled', 'surrendered', 'settled']);
const STATUS_WORD = { dead: 'is dead', fled: 'fled', surrendered: 'surrendered', settled: 'stood down (settled)' };

/** Enemies in the encounter, in creation order. */
export async function encounterEnemies(sessionId, encounterSeq) {
  if (!sessionId || !encounterSeq) return [];
  return dbAll(
    'SELECT id, name, current_hp, max_hp, status FROM combat_enemies WHERE session_id = ? AND encounter_seq = ? ORDER BY id',
    [sessionId, encounterSeq]).catch(() => []);
}

/** Still in the fight: active and above 0 HP. */
export function isStanding(e) {
  return e?.status === 'active' && (e.current_hp == null || e.current_hp > 0);
}

/**
 * The one write for an enemy leaving the fight alive. Sets the status
 * and marks the enemy's turn-order entry out (it is skipped already —
 * combatantCanAct reads the status — and the tracker shows why). The
 * entry is marked, not spliced out: Slow expiry and other turn hooks
 * key on the turn index, and removing an entry would shift them.
 */
export async function setEnemyStatus(sessionId, encounterSeq, enemyId, status) {
  if (!['fled', 'surrendered', 'settled'].includes(status)) throw new Error(`setEnemyStatus: bad status ${status}`);
  await dbRun('UPDATE combat_enemies SET status = ? WHERE id = ?', [status, enemyId]);
  try {
    const row = await dbGet('SELECT turn_order_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
    if (row) {
      const order = safeParse(row.turn_order_json, []);
      let changed = false;
      for (const entry of order) {
        if (entry?.type === 'enemy' && String(entry.key || '').endsWith(`:${enemyId}`)) { entry.out = status; changed = true; }
      }
      if (changed) {
        await dbRun('UPDATE combat_turn_state SET turn_order_json = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND encounter_seq = ?',
          [JSON.stringify(order), sessionId, encounterSeq]);
      }
    }
  } catch { /* the status is the record; the tracker mark is cosmetic */ }
}

/** Find a standing enemy by name: exact first, then a unique base-name match ("Thug" → the one Thug left). */
async function findStanding(sessionId, encounterSeq, name) {
  const all = (await encounterEnemies(sessionId, encounterSeq)).filter(isStanding);
  const want = String(name || '').trim().toLowerCase();
  const exact = all.find((e) => e.name.toLowerCase() === want);
  if (exact) return { enemy: exact };
  const base = all.filter((e) => e.name.toLowerCase().replace(/\s+\d+$/, '') === want);
  if (base.length === 1) return { enemy: base[0] };
  if (base.length > 1) return { ambiguous: base.map((e) => e.name) };
  return { notFound: true, standing: all.map((e) => e.name) };
}

/** Resolve one named enemy (flee / surrender). */
export async function resolveEnemy(sessionId, name, status) {
  const encounterSeq = await getCurrentEncounterSeq(sessionId);
  if (!encounterSeq) return { success: false, reason: 'no fight is running' };
  const found = await findStanding(sessionId, encounterSeq, name);
  if (found.ambiguous) return { success: false, reason: `"${name}" matches ${found.ambiguous.join(' and ')} — name one` };
  if (found.notFound) return { success: false, reason: `no standing enemy named "${name}"${found.standing.length ? ` (standing: ${found.standing.join(', ')})` : ''}` };
  await setEnemyStatus(sessionId, encounterSeq, found.enemy.id, status);
  return { success: true, enemy: found.enemy.name, status, encounterSeq, standing: (await encounterEnemies(sessionId, encounterSeq)).filter(isStanding).map((e) => e.name) };
}

/** Settle every enemy still standing (the fight is talked down). */
export async function settleFight(sessionId, terms = null) {
  const encounterSeq = await getCurrentEncounterSeq(sessionId);
  if (!encounterSeq) return { success: false, reason: 'no fight is running' };
  const standing = (await encounterEnemies(sessionId, encounterSeq)).filter(isStanding);
  if (!standing.length) return { success: false, reason: 'no enemy is left standing to settle with' };
  for (const e of standing) await setEnemyStatus(sessionId, encounterSeq, e.id, 'settled');
  return { success: true, settled: standing.map((e) => e.name), terms: terms || null, encounterSeq };
}

/** The refusal text for a [COMBAT_END] while enemies stand. */
export function combatEndRefusalNote(standingNames) {
  return `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: [COMBAT_END] was REFUSED — the fight is not over: ${standingNames.join(', ')} ${standingNames.length === 1 ? 'is' : 'are'} still standing. A fight ends only when every enemy is dead or resolved. If the fiction has ended the fight, say how: an enemy that runs off → [ENEMY_FLEE: Enemy="Name"]; one that yields → [ENEMY_SURRENDER: Enemy="Name"]; talked down, a deal or a standoff → [COMBAT_SETTLE: Terms="what was agreed"] (every enemy still standing stands down). The engine ends the fight itself once no enemy is left. Otherwise the fight goes on.`;
}

/** "Thug 1 surrendered; Thug 2 is dead." — the recorded outcome. */
export async function fightOutcome(sessionId, encounterSeq) {
  const rows = await encounterEnemies(sessionId, encounterSeq);
  if (!rows.length) return null;
  const parts = rows.map((e) => `${e.name} ${STATUS_WORD[e.status] || (isStanding(e) ? 'still standing' : e.status)}`);
  return { enemies: rows.map((e) => ({ name: e.name, status: e.status })), text: parts.join('; ') };
}

// ---------------------------------------------------------------------------
// Marker handlers (schemas in markerSchemas.js)
// ---------------------------------------------------------------------------
registerMarkerHandler('ENEMY_FLEE', async (parsed, context) => {
  if (!context?.sessionId) return null;
  const r = await resolveEnemy(context.sessionId, parsed?.Enemy, 'fled');
  return { type: 'enemy_flee', ...r };
});

registerMarkerHandler('ENEMY_SURRENDER', async (parsed, context) => {
  if (!context?.sessionId) return null;
  const r = await resolveEnemy(context.sessionId, parsed?.Enemy, 'surrendered');
  return { type: 'enemy_surrender', ...r };
});

registerMarkerHandler('COMBAT_SETTLE', async (parsed, context) => {
  if (!context?.sessionId) return null;
  const r = await settleFight(context.sessionId, parsed?.Terms || null);
  return { type: 'combat_settle', ...r };
});

export default {
  RESOLVED_STATUSES, encounterEnemies, isStanding, setEnemyStatus, resolveEnemy, settleFight,
  combatEndRefusalNote, fightOutcome,
};
