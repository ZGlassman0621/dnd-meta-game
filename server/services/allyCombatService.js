/**
 * Summoned allies in combat — class-audit gap 8 (docs/pm/class-audit-severe-seven).
 *
 * The Hound of Ill Omen (Shadow sorcerer 6), the Accursed Specter (Hexblade
 * warlock 6) and the Faithful Summons beasts (Shepherd druid 14) were created
 * as combat_allies rows (migration 112, entityService) that nothing in combat
 * read: they never took a turn, could not attack, and could not be targeted.
 * This module puts them in the fight:
 *   - turn order: a summon joins the running fight with its own initiative
 *     (engine-rolled d20 + its Dex modifier — an NPC die). The hound and the
 *     specter roll their own initiative (entityService's source notes); the
 *     Faithful Summons beasts, "as Conjure Animals", share ONE group roll.
 *     A summon that exists when a fight starts joins it the same way.
 *   - its turn: the DM controls it, like a companion (combatLoopService).
 *   - its attack: [ATTACK: Attacker="<summon name>" Target="<enemy>"] — the
 *     engine rolls d20 + its attack bonus against the enemy's AC and its
 *     damage dice (doubled on a natural 20), and applies the damage.
 *   - targeted: [ENEMY_ATTACK: … Target="<summon name>"] hits it
 *     (enemyCombatService), damage through entityService.applyDamageToAlly.
 *   - the hound's rule: the creature it hunts has disadvantage on saves
 *     against its sorcerer's spells while the hound is within 5 ft.
 * Only these three kinds join turn order (the brief names them); other
 * friendly actors (Steel Defender, Echo, Eldritch Cannon) keep their own
 * act-on-the-owner's-turn rules and are untouched.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { roll, rollD20 } from '../utils/rng.js';

export const TURN_TAKING_KINDS = new Set(['hound', 'specter', 'faithful_beast']);

async function activeAllies(sessionId) {
  const { listActiveFriendlyActors } = await import('./entityService.js');
  return listActiveFriendlyActors(sessionId);
}

/** The active summon in this session with this name (case-insensitive), or null. */
export async function findActiveAlly(sessionId, name) {
  const want = String(name || '').trim().toLowerCase();
  if (!want) return null;
  const list = await activeAllies(sessionId);
  return list.find((a) => String(a.name).toLowerCase() === want)
    || list.find((a) => String(a.name).toLowerCase().startsWith(want + ' (')) // "Wolf" for "Wolf (Faithful Summons)"
    || null;
}

const allyKey = (a) => `ally:${a.id}`;

/** Turn-order entries for summons (one per hound/specter; the beasts share one roll). */
export function allyTurnEntries(allies) {
  const entries = [];
  let beastGroup = null; // one initiative count for the whole group (first beast's roll + Dex)
  for (const a of allies) {
    if (!TURN_TAKING_KINDS.has(a.kind)) continue;
    if (a.kind === 'faithful_beast') {
      if (!beastGroup) {
        const die = rollD20('initiative (Faithful Summons, as a group)');
        const mod = Number(a.dexMod) || 0;
        beastGroup = { roll: die, modifier: mod, initiative: die + mod };
      }
      entries.push({ name: a.name, type: 'ally', key: allyKey(a), ...beastGroup });
      continue;
    }
    const die = rollD20(`initiative: ${a.name}`);
    const mod = Number(a.dexMod) || 0;
    entries.push({ name: a.name, type: 'ally', key: allyKey(a), roll: die, modifier: mod, initiative: die + mod });
  }
  return entries;
}

/** Slot summons into a running fight's order by initiative (no restart). */
export async function joinAlliesToFight(sessionId, encounterSeq, allies) {
  try {
    const { getTurnState } = await import('./combatTurnService.js');
    const state = await getTurnState(sessionId, encounterSeq);
    if (!state?.turnOrder) return { joined: [] };
    const order = [...state.turnOrder];
    let currentIndex = Number(state.currentIndex || 0);
    const already = new Set(order.map((c) => c.key));
    const joined = [];
    for (const entry of allyTurnEntries(allies.filter((a) => !already.has(allyKey(a))))) {
      let pos = order.findIndex((c) => (c.initiative ?? 0) < entry.initiative);
      if (pos < 0) pos = order.length;
      order.splice(pos, 0, entry);
      if (pos <= currentIndex) currentIndex += 1;
      joined.push(entry);
    }
    if (!joined.length) return { joined };
    await dbRun('UPDATE combat_turn_state SET turn_order_json = ?, current_index = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND encounter_seq = ?',
      [JSON.stringify(order), currentIndex, sessionId, encounterSeq]);
    return { joined, order };
  } catch { return { joined: [] }; }
}

/** Can this summon act (alive and still summoned)? */
export async function allyCanAct(entry) {
  const m = String(entry?.key || '').match(/^ally:(\d+)$/);
  if (!m) return true;
  const row = await dbGet('SELECT current_hp, status FROM combat_allies WHERE id = ?', [Number(m[1])]).catch(() => null);
  if (!row) return false;
  return row.status === 'active' && Number(row.current_hp) > 0;
}

/** A summon's attack: the engine rolls (an NPC's dice). Returns a party_attack outcome. */
export async function resolveAllyAttack(sessionId, encounterSeq, ally, enemy, characterId) {
  const { getCoverAcBonus, applyPartyDamageToEnemy, parseDamageDice } = await import('./enemyCombatService.js');
  const die = rollD20(`attack: ${ally.name}`);
  const attackBonus = Number(ally.attackBonus) || 0;
  const targetAc = (Number(enemy.armor_class) || 10) + getCoverAcBonus(enemy.cover);
  const total = die + attackBonus;
  const critical = die === 20 ? 'hit' : die === 1 ? 'miss' : null;
  const hit = die === 20 || (die !== 1 && total >= targetAc);
  const out = {
    type: 'party_attack', success: true, attackerKind: 'ally', attacker: ally.name, target: enemy.name,
    weapon: 'attack', dice: [die], takenDie: die, attackBonus, total, targetAc, hit, critical, source: 'server',
  };
  if (!hit) return out;
  const spec = parseDamageDice(String(ally.damageDice || '').replace(/\s+/g, ''));
  if (!spec) return { ...out, damage: 0, note: `${ally.name} has no damage dice on record — the DM narrates the hit` };
  const count = spec.count * (critical === 'hit' ? 2 : 1);
  const r = roll(spec.sides, count, { reason: `damage: ${ally.name}` });
  const damage = Math.max(0, r.total + (spec.modifier || 0));
  const applied = await applyPartyDamageToEnemy(sessionId, encounterSeq, enemy.name, damage, characterId,
    { attacker: { kind: 'ally', id: ally.id, name: ally.name } });
  return { ...out, damage, damageRolls: r.rolls, damageApplied: applied?.damageDealt ?? damage, enemyKilled: !!applied?.killed };
}

/**
 * Hound of Ill Omen: does the creature `targetName` have disadvantage on a
 * save against a spell this caster casts? True when an active hound owned
 * by the caster hunts that creature and is within 5 ft of it (movement
 * zones; with no zones declared, everyone shares one area — within 5 ft).
 */
export async function houndSaveDisadvantage(sessionId, encounterSeq, casterKind, casterId, targetName) {
  try {
    const { findActiveHound } = await import('./entityService.js');
    const hound = await findActiveHound(sessionId, encounterSeq, casterKind, casterId, targetName);
    if (!hound) return false;
    const { distanceBetween, keyForEnemyName } = await import('./movementService.js');
    const enemyKey = await keyForEnemyName(sessionId, encounterSeq, targetName);
    if (!enemyKey) return true;
    const d = await distanceBetween(sessionId, encounterSeq, allyKey(hound), enemyKey);
    return d?.feet == null || d.feet <= 5;
  } catch { return false; }
}

export default { TURN_TAKING_KINDS, findActiveAlly, allyTurnEntries, joinAlliesToFight, allyCanAct, resolveAllyAttack, houndSaveDisadvantage };
