/**
 * Enemy Combat Service (Structural #8: P3-A).
 * Server-side enemy HP + enemy turn resolution. The server rolls enemy
 * attacks via rng.js — the AI narrates but does not decide the outcome.
 */
import { dbAll, dbGet, dbRun } from '../database.js';
import { roll, rollD20 } from '../utils/rng.js';
import { applyHpChange } from './characterHpService.js';

export function parseDamageDice(diceStr) {
  if (!diceStr || typeof diceStr !== 'string') return null;
  const m = diceStr.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  return { count: parseInt(m[1], 10), sides: parseInt(m[2], 10), modifier: m[3] ? parseInt(m[3], 10) : 0 };
}

export function parseEnemyStats(enemiesString) {
  if (!enemiesString || typeof enemiesString !== 'string') return [];
  const enemies = [], parts = [];
  let depth = 0, current = '';
  for (const ch of enemiesString) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  const DEF = { maxHp: 10, armorClass: 12, attackBonus: 3, damageDice: '1d6', dexMod: 0 };
  for (const part of parts) {
    const m = part.match(/^(.+?)\s*\((.+)\)\s*$/);
    if (!m) { if (part) enemies.push({ name: part, ...DEF }); continue; }
    const name = m[1].trim(), s = m[2], stats = { ...DEF };
    const hp = s.match(/HP\s+(\d+)/i); if (hp) stats.maxHp = parseInt(hp[1], 10);
    const ac = s.match(/AC\s+(\d+)/i); if (ac) stats.armorClass = parseInt(ac[1], 10);
    const atk = s.match(/ATK\s+([+-]?\d+)/i); if (atk) stats.attackBonus = parseInt(atk[1], 10);
    const dmg = s.match(/DMG\s+([\dd+-]+)/i); if (dmg && parseDamageDice(dmg[1])) stats.damageDice = dmg[1];
    const dex = s.match(/DEX\s+([+-]?\d+)/i); if (dex) stats.dexMod = parseInt(dex[1], 10);
    if (name) enemies.push({ name, ...stats });
  }
  return enemies;
}

export async function createEncounterEnemies(sessionId, encounterSeq, enemies) {
  const created = [];
  for (const e of enemies) {
    const r = await dbRun(
      `INSERT INTO combat_enemies (session_id, encounter_seq, name, max_hp, current_hp, armor_class, attack_bonus, damage_dice, dex_mod, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [sessionId, encounterSeq, e.name, e.maxHp, e.maxHp, e.armorClass, e.attackBonus, e.damageDice, e.dexMod]);
    created.push({ id: Number(r.lastInsertRowid), sessionId, encounterSeq, name: e.name,
      maxHp: e.maxHp, currentHp: e.maxHp, armorClass: e.armorClass,
      attackBonus: e.attackBonus, damageDice: e.damageDice, dexMod: e.dexMod, status: 'active' });
  }
  return created;
}

export async function getNextEncounterSeq(sessionId) {
  const row = await dbGet('SELECT COALESCE(MAX(encounter_seq), 0) AS m FROM combat_enemies WHERE session_id = ?', [sessionId]);
  return (row?.m || 0) + 1;
}

export async function findActiveEnemy(sessionId, encounterSeq, enemyName) {
  return dbGet(
    `SELECT * FROM combat_enemies WHERE session_id = ? AND encounter_seq = ? AND status = 'active' AND LOWER(name) = LOWER(?) LIMIT 1`,
    [sessionId, encounterSeq, enemyName]);
}

export async function applyDamageToEnemy(sessionId, encounterSeq, enemyName, amount) {
  const enemy = await findActiveEnemy(sessionId, encounterSeq, enemyName);
  if (!enemy) return null;
  const damage = Math.max(0, Math.trunc(amount) || 0);
  if (damage === 0) return { type: 'enemy_damage', enemyName: enemy.name, damageDealt: 0, currentHp: enemy.current_hp, maxHp: enemy.max_hp, status: enemy.status, killed: false };
  const newHp = Math.max(0, enemy.current_hp - damage);
  const killed = newHp === 0;
  await dbRun('UPDATE combat_enemies SET current_hp = ?, status = ? WHERE id = ?', [newHp, killed ? 'dead' : 'active', enemy.id]);
  // Combat Pipeline #8: Death is an event, not just a flag
  let deathEvent = null;
  if (killed) {
    deathEvent = await recordDeathEvent(sessionId, encounterSeq, enemy).catch(() => null);
  }
  return { type: 'enemy_damage', enemyName: enemy.name, damageDealt: damage, currentHp: newHp, maxHp: enemy.max_hp,
    status: killed ? 'dead' : 'active', killed, bloodied: !killed && newHp <= enemy.max_hp / 2, deathEvent };
}

export function getCoverAcBonus(cover) {
  const c = (cover || 'none').toLowerCase();
  if (c === 'half') return 2;
  if (c === 'three-quarters' || c === 'three_quarters') return 5;
  return 0;
}

/**
 * Record a death event (Combat Pipeline #8).
 * Death is an event that triggers loot (#9) and XP (#10).
 */
export async function recordDeathEvent(sessionId, encounterSeq, enemy, killedBy = null) {
  // Look up XP from bestiary
  let xpValue = 0;
  try {
    const { lookupBestiary } = await import('./bestiaryService.js');
    const entry = await lookupBestiary(enemy.name);
    if (entry) xpValue = entry.xp_value || 0;
  } catch (e) { /* best-effort */ }
  const r = await dbRun(
    `INSERT INTO combat_death_events (session_id, encounter_seq, enemy_id, enemy_name, killed_by, xp_value)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, encounterSeq, enemy.id, enemy.name, killedBy, xpValue]
  );
  return { deathEventId: Number(r.lastInsertRowid), enemyName: enemy.name, xpValue };
}

export async function resolveEnemyAttack(sessionId, encounterSeq, enemyName, target) {
  const enemy = await findActiveEnemy(sessionId, encounterSeq, enemyName);
  if (!enemy || !target?.id) return null;
  // Combat Pipeline #6: Cover bonus to AC (D&D 2024)
  const coverBonus = target.cover ? getCoverAcBonus(target.cover) : 0;
  // Combat Pipeline #11: Morale buff to attack (if enemies are rallied)
  let moraleBonus = 0;
  try {
    const { getMoraleBuff } = await import('./moraleService.js');
    moraleBonus = await getMoraleBuff(sessionId, encounterSeq, 'enemies');
  } catch (e) { /* best-effort */ }
  const attackRoll = rollD20(`enemy attack: ${enemy.name}`);
  const totalToHit = attackRoll + enemy.attack_bonus + moraleBonus;
  const targetAc = (target.armorClass || 10) + coverBonus;
  const isCrit = attackRoll === 20, isFumble = attackRoll === 1;
  const hit = isCrit || (!isFumble && totalToHit >= targetAc);
  let damage = 0, damageRolls = [];
  if (hit) {
    const dice = parseDamageDice(enemy.damage_dice) || { count: 1, sides: 6, modifier: 0 };
    const r = roll(dice.sides, isCrit ? dice.count * 2 : dice.count, { reason: `enemy damage: ${enemy.name}` });
    damageRolls = r.rolls;
    damage = Math.max(0, r.total + dice.modifier);
  }
  let hpResult = null;
  if (damage > 0) {
    if (target.type === 'player') hpResult = await applyHpChange(target.id, -damage, `enemy attack: ${enemy.name}`);
    else if (target.type === 'companion') {
      await dbRun(`UPDATE companions SET current_hp = MAX(0, current_hp - ?) WHERE id = ?`, [damage, target.id]);
      const u = await dbGet('SELECT current_hp FROM companions WHERE id = ?', [target.id]);
      hpResult = { applied: true, currentHp: u?.current_hp, damage };
    }
  }
  return { type: 'enemy_attack', enemyName: enemy.name, targetName: target.name || 'target', targetType: target.type,
    attackRoll, attackBonus: enemy.attack_bonus, totalToHit, targetAc, hit, isCrit, isFumble,
    damage, damageRolls, damageDice: enemy.damage_dice, hpResult };
}

export async function getActiveEnemies(sessionId, encounterSeq) {
  return dbAll(
    `SELECT id, name, max_hp AS maxHp, current_hp AS currentHp, armor_class AS armorClass,
            attack_bonus AS attackBonus, damage_dice AS damageDice, status
     FROM combat_enemies WHERE session_id = ? AND encounter_seq = ? AND status = 'active' ORDER BY id`,
    [sessionId, encounterSeq]);
}

export async function getCurrentEncounterSeq(sessionId) {
  const row = await dbGet('SELECT COALESCE(MAX(encounter_seq), 0) AS m FROM combat_enemies WHERE session_id = ?', [sessionId]);
  return row?.m || 0;
}

export default { parseDamageDice, parseEnemyStats, createEncounterEnemies, getNextEncounterSeq,
  findActiveEnemy, applyDamageToEnemy, resolveEnemyAttack, getActiveEnemies, getCurrentEncounterSeq, getCoverAcBonus, recordDeathEvent };
