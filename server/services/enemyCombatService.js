/**
 * Enemy Combat Service (Structural #8: P3-A).
 * Server-side enemy HP + enemy turn resolution. The server rolls enemy
 * attacks via rng.js — the AI narrates but does not decide the outcome.
 */
import { dbAll, dbGet, dbRun } from '../database.js';
import { roll, rollD20 } from '../utils/rng.js';
import { safeParse } from '../utils/safeParse.js';
import { applyHpChange } from './characterHpService.js';
import { getConditions, conditionDefenseEffects, conditionAttackEffects } from './conditionService.js';
import { damageAdjustmentFor } from './bestiaryLookupService.js';
import { enemyCritThreshold } from './partyAttackService.js'; // Mechanics hooks D5: DM-declared enemy crit threshold (function declaration — safe across the partyAttackService <-> enemyCombatService import cycle, called only at runtime)

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
      `INSERT INTO combat_enemies (session_id, encounter_seq, name, max_hp, current_hp, armor_class, attack_bonus, damage_dice, dex_mod, status, stats_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [sessionId, encounterSeq, e.name, e.maxHp, e.maxHp, e.armorClass, e.attackBonus, e.damageDice, e.dexMod, e.statsJson || null]);
    created.push({ id: Number(r.lastInsertRowid), sessionId, encounterSeq, name: e.name,
      maxHp: e.maxHp, currentHp: e.maxHp, armorClass: e.armorClass,
      attackBonus: e.attackBonus, damageDice: e.damageDice, dexMod: e.dexMod, status: 'active',
      statsJson: e.statsJson || null });
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

export async function applyDamageToEnemy(sessionId, encounterSeq, enemyName, amount, opts = {}) {
  const enemy = await findActiveEnemy(sessionId, encounterSeq, enemyName);
  if (!enemy) return null;
  const rawDamage = Math.max(0, Math.trunc(amount) || 0);
  // Step 1 (v1.0.194): resistances / vulnerabilities / immunities from
  // the COMBAT_START statblock snapshot, for TYPED damage only. The
  // weapon and spell paths pass their damage type (+ whether it is
  // magical); untyped ENEMY_DAMAGE markers carry no type and apply
  // exactly as before — a stated approximation.
  let adjustment = null;
  let damage = rawDamage;
  if (rawDamage > 0 && opts?.damageType) {
    const snap = safeParse(enemy.stats_json, null);
    adjustment = snap ? damageAdjustmentFor(snap, opts.damageType, { magical: !!opts.magical }) : null;
    if (adjustment?.immune) damage = 0;
    else {
      if (adjustment?.resistant) damage = Math.floor(damage / 2);
      if (adjustment?.vulnerable) damage = damage * 2;
    }
  }
  const damageAdjustment = adjustment?.label || null;
  if (damage === 0) return { type: 'enemy_damage', enemyName: enemy.name, enemyId: enemy.id, damageDealt: 0, rawDamage, damageAdjustment, currentHp: enemy.current_hp, maxHp: enemy.max_hp, status: enemy.status, killed: false };
  const newHp = Math.max(0, enemy.current_hp - damage);
  const killed = newHp === 0;
  await dbRun('UPDATE combat_enemies SET current_hp = ?, status = ? WHERE id = ?', [newHp, killed ? 'dead' : 'active', enemy.id]);
  // Combat Pipeline #8: Death is an event, not just a flag
  let deathEvent = null;
  if (killed) {
    deathEvent = await recordDeathEvent(sessionId, encounterSeq, enemy).catch(() => null);
  }
  return { type: 'enemy_damage', enemyName: enemy.name, enemyId: enemy.id, damageDealt: damage, rawDamage, damageAdjustment, currentHp: newHp, maxHp: enemy.max_hp,
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

export async function resolveEnemyAttack(sessionId, encounterSeq, enemyName, target, opts = {}) {
  const enemy = await findActiveEnemy(sessionId, encounterSeq, enemyName);
  if (!enemy || !target?.id) return null;
  // Combat item 5: enemy action economy — budgets enforced here so
  // every enemy attack path (ENEMY_ATTACK, OA, Ready) shares them.
  // Reactions bypass budgets (their reaction was already spent by
  // the caller); off-turn non-reaction attacks resolve unenforced
  // (legacy), and the cap bites on the enemy's own turn. The gate
  // runs before any hidden/help consumption below, so a refused
  // attack consumes nothing.
  let economy = {};
  try {
    const { checkEnemyAction } = await import('./enemyEconomyService.js');
    const { combatFallbackId } = await import('./worldIdService.js');
    const gate = await checkEnemyAction(sessionId, encounterSeq, combatFallbackId(sessionId, encounterSeq, enemy.id), enemy.name, enemy.id, opts);
    if (gate?.error) return { type: 'enemy_attack', success: false, reason: gate.error };
    economy = gate;
  } catch { /* best-effort; economy never blocks an attack on lookup failure */ }
  const usedAttackBonus = economy.actionStats?.attackBonus ?? enemy.attack_bonus;
  const usedDamageDice = economy.actionStats?.damageDice ?? enemy.damage_dice;
  // Combat Pipeline #6: Cover bonus to AC (D&D 2024)
  const coverBonus = target.cover ? getCoverAcBonus(target.cover) : 0;
  // Combat Pipeline #11: Morale buff to attack (if enemies are rallied)
  let moraleBonus = 0;
  try {
    const { getMoraleBuff } = await import('./moraleService.js');
    moraleBonus = await getMoraleBuff(sessionId, encounterSeq, 'enemies');
  } catch (e) { /* best-effort */ }
  // Conditions (v1.0.190): attacks against a prone / blinded /
  // restrained / incapacitated target are rolled with advantage;
  // against an invisible target, with disadvantage. Both at once
  // cancel, per 5e advantage algebra.
  let attackRolls = null;
  let attackMode = null;
  // Presence-based advantage algebra (see partyAttackService): any
  // advantage source + any disadvantage source = a straight roll,
  // regardless of source counts. Collect flags, resolve once at end.
  let hasAdvantage = false;
  let hasDisadvantage = false;
  try {
    const targetConds = target.type === 'companion'
      ? await getConditions('companion', target.id)
      : target.type === 'player'
        ? await getConditions('player', target.id)
        : [];
    const defense = conditionDefenseEffects(targetConds);
    if (defense.attackerAdvantage) hasAdvantage = true;
    if (defense.attackerDisadvantage) hasDisadvantage = true;
  } catch { /* conditions are best-effort; the attack itself must not fail */ }
  // Attacker's own conditions (combat-real B3): a blinded / poisoned /
  // frightened / prone / restrained enemy attacks at disadvantage; an
  // invisible one with advantage — merged with the target-side state
  // above through the same algebra, never stacked past it.
  let atkPenalty = 0;
  try {
    const attackerConds = safeParse(enemy.active_conditions, []);
    const atk = conditionAttackEffects(Array.isArray(attackerConds) ? attackerConds : []);
    if (atk.advantage) hasAdvantage = true;
    if (atk.disadvantage) hasDisadvantage = true;
    atkPenalty = atk.penalty || 0;
  } catch { /* best-effort */ }
  // Weapon Mastery — Sap (Step 2, v1.0.195): a Sap weapon hit leaves
  // this enemy's next attack roll disadvantaged. partyAttackService
  // sets the flag in session_config; it is consumed here, exactly
  // once, when the enemy next attacks.
  let sapped = false;
  try {
    const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
    const cfg = safeParse(s?.session_config, {}) || {};
    if (cfg.masterySap && cfg.masterySap[enemy.id]) {
      delete cfg.masterySap[enemy.id];
      await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
      hasDisadvantage = true;
      sapped = true;
    }
  } catch { /* best-effort */ }
  // Combat item 3, Tier 3: a dodging target is attacked at
  // disadvantage — same presence algebra as every other source.
  try {
    const { getEntry } = await import('./actionStateService.js');
    const { ledgerKeyForTarget } = await import('./turnLedgerService.js');
    const targetKey = await ledgerKeyForTarget(target.type, target.id);
    const targetEntry = await getEntry(sessionId, encounterSeq, targetKey);
    if (targetEntry.dodge) hasDisadvantage = true;
    // Hide v2 (audit item 4): attacks against a hidden creature are
    // disadvantaged — the Invisible condition's other half.
    if (targetEntry.hidden) hasDisadvantage = true;
  } catch { /* best-effort; action state never blocks an attack */ }
  // Combat item 3, Tier 3 (enemy Hide — Zach's veto of party-only
  // Hide): a hidden enemy's next attack is at advantage, consumed
  // on the roll like every other consume-on-use source.
  try {
    const { getEntry, clearField } = await import('./actionStateService.js');
    const { combatFallbackId } = await import('./worldIdService.js');
    const attackerKey = combatFallbackId(sessionId, encounterSeq, enemy.id);
    const attackerEntry = await getEntry(sessionId, encounterSeq, attackerKey);
    if (attackerEntry.hidden) {
      await clearField(sessionId, encounterSeq, attackerKey, 'hidden');
      hasAdvantage = true;
    }
    // Enemy Help (Tier 3 follow-up, Zach's audit item 1): a helped
    // enemy ally's next attack against the helped-against target
    // is at advantage, consumed on the roll like party Help. The
    // target name here is resolvePartyTarget's name ('Player' for
    // the PC, the companion name otherwise) — the HELP handler
    // stores exactly that form.
    if (attackerEntry.help && String(attackerEntry.help.targetName || '').toLowerCase() === String(target.name || '').toLowerCase()) {
      await clearField(sessionId, encounterSeq, attackerKey, 'help');
      hasAdvantage = true;
    }
  } catch { /* best-effort */ }
  attackMode = hasAdvantage && hasDisadvantage ? null : hasAdvantage ? 'advantage' : hasDisadvantage ? 'disadvantage' : null;
  let attackRoll;
  if (attackMode) {
    const a = rollD20(`enemy attack: ${enemy.name}`);
    const b = rollD20(`enemy attack: ${enemy.name}`);
    attackRolls = [a, b];
    attackRoll = attackMode === 'advantage' ? Math.max(a, b) : Math.min(a, b);
  } else {
    attackRoll = rollD20(`enemy attack: ${enemy.name}`);
  }
  const totalToHit = attackRoll + usedAttackBonus + moraleBonus + atkPenalty;
  // Item 6: a live Shield entry adds +5 AC for a party defender.
  let shieldBonus = 0;
  try {
    const { shieldBonusFor } = await import('./enemySpellService.js');
    const { ledgerKeyForTarget } = await import('./turnLedgerService.js');
    shieldBonus = await shieldBonusFor(sessionId, encounterSeq, await ledgerKeyForTarget(target.type, target.id));
  } catch { /* best-effort; shield never blocks an attack */ }
  const targetAc = (target.armorClass || 10) + coverBonus + shieldBonus;
  const critThreshold = enemyCritThreshold(enemy);
  const isCrit = attackRoll === 20 || attackRoll >= critThreshold, isFumble = attackRoll === 1;
  const hit = isCrit || (!isFumble && totalToHit >= targetAc);
  let damage = 0, damageRolls = [];
  if (hit) {
    const dice = parseDamageDice(usedDamageDice) || { count: 1, sides: 6, modifier: 0 };
    const r = roll(dice.sides, isCrit ? dice.count * 2 : dice.count, { reason: `enemy damage: ${enemy.name}` });
    damageRolls = r.rolls;
    damage = Math.max(0, r.total + dice.modifier);
  }
  let hpResult = null;
  if (damage > 0) {
    if (target.type === 'player') hpResult = await applyHpChange(target.id, -damage, `enemy attack: ${enemy.name}`);
    else if (target.type === 'companion') {
      // Companions store HP in companion_current_hp (there is no
      // companions.current_hp — writing it threw, the marker handler
      // swallowed the throw, and enemy hits on companions silently did
      // nothing in live play until v1.0.189).
      const beforeComp = await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [target.id]);
      await dbRun(`UPDATE companions SET companion_current_hp = MAX(0, companion_current_hp - ?) WHERE id = ?`, [damage, target.id]);
      const u = await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [target.id]);
      hpResult = { applied: true, currentHp: u?.companion_current_hp, damage, hpDamage: Math.max(0, (beforeComp?.companion_current_hp ?? 0) - (u?.companion_current_hp ?? 0)) };
      // Companion concentration (combat-real B4): damage taken forces
      // the same CON save the PC makes in characterHpService.
      try {
        const { checkCompanionConcentration } = await import('./concentrationService.js');
        const cc = await checkCompanionConcentration(target.id, damage);
        if (cc) hpResult.concentrationCheck = cc;
      } catch { /* best-effort */ }
    }
  }
  // Item 6, Tier F2: every damage path writes the last-damage
  // record, so a damage-hook reaction can answer the latest hit.
  if (damage > 0 && hpResult) {
    try {
      const { recordDamage } = await import('./lastDamageService.js');
      const hpDamage = target.type === 'player'
        ? Math.max(0, (hpResult.previousHp ?? 0) - (hpResult.currentHp ?? 0))
        : (hpResult.hpDamage ?? 0);
      if (hpDamage > 0) {
        await recordDamage(sessionId, target.type, target.id, {
          amount: hpDamage, type: null, attackerKind: 'enemy', attackerId: enemy.id,
          attackerName: enemy.name, encounterSeq,
        });
      }
    } catch { /* records never break an attack */ }
  }
  return { type: 'enemy_attack', enemyName: enemy.name, targetName: target.name || 'target', targetType: target.type,
    attackRoll, ...(attackRolls ? { attackRolls, attackMode } : {}), ...(sapped ? { sapped: true } : {}), attackBonus: usedAttackBonus, penalty: atkPenalty, totalToHit, targetAc, hit, isCrit, isFumble,
    damage, damageRolls, damageDice: usedDamageDice, hpResult,
    ...(economy.actionName ? { actionName: economy.actionName } : {}),
    ...(economy.multiattackRemaining != null ? { multiattackRemaining: economy.multiattackRemaining } : {}),
    ...(economy.legendaryRemaining != null ? { legendaryRemaining: economy.legendaryRemaining } : {}),
    ...(economy.bonusSpent ? { bonusSpent: true } : {}) };
}

/**
 * Party-caused enemy damage with the full kill follow-through
 * (combat-real B2): applyDamageToEnemy + kill loot + morale, in ONE
 * place. ENEMY_DAMAGE used to inline this in combatMarkerService —
 * with a latent bug: it read morale.fled, a field checkMorale never
 * returns (the real field is breakChecks), so the flee note never
 * surfaced even though enemies did flee. Party attacks (partyAttack
 * Service) and ENEMY_DAMAGE both call this now.
 */
export async function applyPartyDamageToEnemy(sessionId, encounterSeq, enemyName, amount, characterId, opts = {}) {
  const result = await applyDamageToEnemy(sessionId, encounterSeq, enemyName, amount, opts);
  // Item 6, Tier F2: party damage writes the last-damage record
  // (attacker + type when known) and checks enemy concentration,
  // mirroring the party's own damage path.
  if (result && result.damageDealt > 0) {
    try {
      const { recordDamage } = await import('./lastDamageService.js');
      const atk = opts.attacker || null;
      await recordDamage(sessionId, 'enemy', result.enemyId, {
        amount: result.damageDealt, type: opts.damageType || null,
        attackerKind: atk?.kind || null, attackerId: atk?.id ?? null,
        attackerName: atk?.name || null, encounterSeq,
      });
    } catch { /* records never break damage */ }
    try {
      const { checkEnemyConcentration } = await import('./concentrationService.js');
      result.concentrationCheck = await checkEnemyConcentration(sessionId, encounterSeq, result.enemyId, result.damageDealt);
    } catch { /* concentration never breaks damage */ }
  }
  if (result?.killed && result?.deathEvent && !result.deathEvent.alreadyLooted) {
    try {
      const { generateKillLoot } = await import('./killLootService.js');
      const { checkMorale } = await import('./moraleService.js');
      const char = await dbGet('SELECT level FROM characters WHERE id = ?', [characterId]);
      const loot = await generateKillLoot(characterId, result.deathEvent.deathEventId, enemyName, char?.level || 1);
      if (loot && !loot.alreadyLooted && !loot.noLoot) result.loot = loot;
      const morale = await checkMorale(sessionId, encounterSeq);
      const fled = (morale?.breakChecks || []).filter(c => c.outcome === 'fled');
      if (morale?.triggered && fled.length > 0) {
        result.morale = morale;
        result.systemNote = (result.systemNote || '') + '\n' + (morale.systemNote || '');
      }
    } catch (e) { console.error('[enemyCombatService] Kill loot/morale failed:', e.message); }
  }
  return result;
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
  findActiveEnemy, applyDamageToEnemy, applyPartyDamageToEnemy, resolveEnemyAttack, getActiveEnemies, getCurrentEncounterSeq, getCoverAcBonus, recordDeathEvent };

