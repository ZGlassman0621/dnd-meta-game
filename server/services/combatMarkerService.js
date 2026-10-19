/**
 * Combat Marker Service (Phase 3 SC-6.4d)
 *
 * Owns the COMBAT_START + COMBAT_END marker handlers. COMBAT_START is
 * the heaviest single-marker handler in SC-6.4 — it rolls initiative
 * for the player, all active companions, and all enemies (with DEX
 * modifier estimation from `estimateEnemyDexMod`), sorts the turn
 * order, and returns the structured `{turnOrder, currentTurn, round}`
 * shape the route used to assemble for the response payload.
 *
 * Created during SC-6.4d because no existing combat service owned
 * AI-driven combat-state initialization. Single-purpose module; if
 * future combat markers emerge ([COMBAT_TURN_ADVANCE], etc.), they
 * can co-locate here.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { estimateEnemyDexMod } from './dmSessionService.js';
import { rollD20 as rngRollD20 } from '../utils/rng.js';
import { parseEnemyStats, createEncounterEnemies, getNextEncounterSeq, applyDamageToEnemy, resolveEnemyAttack, getCurrentEncounterSeq, findActiveEnemy } from './enemyCombatService.js';
import { initializeTurnOrder, advanceTurn } from './combatTurnService.js';
import { hasReactionAvailable, useReaction } from './reactionService.js';
import { getCoverAcBonus } from './enemyCombatService.js';
import { lookupBestiary } from './bestiaryService.js';
import { generateKillLoot } from './killLootService.js';
import { checkMorale } from './moraleService.js';

// Initiative is mechanically meaningful, so it routes through the central RNG
// (Phase 3.3) rather than a local Math.random wrapper.
const rollD20 = () => rngRollD20('initiative');

/**
 * COMBAT_START handler. Single-instance per response. Heaviest handler
 * in SC-6.4d.
 *
 * Side effect: NONE on the database — purely computes initiative state
 * for in-memory return + the SYSTEM note text. The route handler's
 * existing dm_sessions persist already covers the combatStart payload
 * via the messages-array push the handler returns the systemNote for.
 *
 * Returns `{combatStart: {turnOrder, currentTurn, round}, systemNote}`
 * — the route extracts `combatStart` for the response payload and
 * pushes `systemNote` to result.messages.
 */
registerMarkerHandler('COMBAT_START', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const character = await dbGet(
      'SELECT id, name, nickname, ability_scores FROM characters WHERE id = ?',
      [context.characterId]
    );
    if (!character) return null;
    const charAbilities = typeof character.ability_scores === 'string'
      ? safeParse(character.ability_scores, {})
      : (character.ability_scores || {});
    const playerDexMod = Math.floor(((charAbilities.dexterity || 10) - 10) / 2);

    const turnOrder = [];

    // Player initiative
    const playerRoll = rollD20();
    turnOrder.push({
      name: character.nickname || character.name || 'Player',
      type: 'player',
      roll: playerRoll,
      modifier: playerDexMod,
      initiative: playerRoll + playerDexMod
    });

    // Companion initiatives. Schema notes preserved from the legacy
    // inline block: companions.name doesn't exist (lives on npcs via
    // npc_id); FK is recruited_by_character_id; active state is
    // status='active' rather than a boolean.
    const activeCompanions = await dbAll(
      `SELECT n.name AS name, c.companion_ability_scores
       FROM companions c
       JOIN npcs n ON c.npc_id = n.id
       WHERE c.recruited_by_character_id = ? AND c.status = 'active'`,
      [context.characterId]
    );
    for (const comp of activeCompanions) {
      const compAbilities = typeof comp.companion_ability_scores === 'string'
        ? safeParse(comp.companion_ability_scores, {})
        : (comp.companion_ability_scores || {});
      const compDexMod = Math.floor(((compAbilities.dexterity || 10) - 10) / 2);
      const compRoll = rollD20();
      turnOrder.push({
        name: comp.name,
        type: 'companion',
        roll: compRoll,
        modifier: compDexMod,
        initiative: compRoll + compDexMod
      });
    }

    // Enemy initiatives — parse stat blocks (Structural #8).
    // Combat Pipeline #7: Check bestiary first for canonical stats.
    // Priority: bestiary > AI-provided stats > defaults.
    const parsedStats = parseEnemyStats(parsed.Enemies || '');
    const enemyStats = [];
    for (const p of parsedStats) {
      // If AI provided full stats (non-default), use them; otherwise check bestiary
      const isDefault = p.maxHp === 10 && p.armorClass === 12 && p.attackBonus === 3;
      if (!isDefault) {
        enemyStats.push(p);
        continue;
      }
      const entry = await lookupBestiary(p.name).catch(() => null);
      if (entry) {
        enemyStats.push({
          name: entry.display_name,
          maxHp: entry.max_hp,
          armorClass: entry.armor_class,
          attackBonus: entry.attack_bonus,
          damageDice: entry.damage_dice,
          dexMod: entry.dex_mod,
        });
      } else {
        enemyStats.push(p);
      }
    }
    const encounterSeq = context?.sessionId ? await getNextEncounterSeq(context.sessionId) : 1;
    if (context?.sessionId && enemyStats.length > 0) {
      await createEncounterEnemies(context.sessionId, encounterSeq, enemyStats);
    }
    for (const enemy of enemyStats) {
      const enemyDexMod = enemy.dexMod || estimateEnemyDexMod(enemy.name);
      const enemyRoll = rollD20();
      turnOrder.push({
        name: enemy.name,
        type: 'enemy',
        roll: enemyRoll,
        modifier: enemyDexMod,
        initiative: enemyRoll + enemyDexMod
      });
    }

    // Sort: initiative descending; ties broken by modifier; remaining ties random.
    turnOrder.sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative;
      if (b.modifier !== a.modifier) return b.modifier - a.modifier;
      return Math.random() - 0.5;
    });

    const orderStr = turnOrder.map(c => `${c.name} (${c.initiative})`).join(', ');
    const systemNote = `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Initiative has been rolled. Turn order: ${orderStr}. Use this order for all combat turns. The first combatant to act is ${turnOrder[0].name}. Emit [TURN_ADVANCE] when a combatant's turn ends.`;

    // Combat Pipeline #2: Store turn order server-side
    if (context?.sessionId) {
      try {
        await initializeTurnOrder(context.sessionId, encounterSeq, turnOrder);
      } catch (e) {
        console.error('[combatMarkerService] Failed to store turn order:', e.message);
      }
    }

    return {
      type: 'combat_start',
      combatStart: { turnOrder, currentTurn: 0, round: 1 },
      systemNote
    };
  } catch (e) {
    console.error('[combatMarkerService] COMBAT_START handler failed:', e.message);
    return null;
  }
});

/**
 * COMBAT_END handler. Presence-only marker. No DB side effect — the
 * route handler used to set a `combatEnd` boolean for the response
 * payload (consumed by DMSession.jsx:821 to clear combat UI state).
 * Handler just returns the truthy event so the route can extract it.
 */
registerMarkerHandler('COMBAT_END', async () => {
  return { type: 'combat_end' };
});

/**
 * ENEMY_DAMAGE handler (Structural #8).
 * [ENEMY_DAMAGE: Enemy="Goblin" Amount=8] — player dealt damage to an enemy.
 * Server applies it to combat_enemies, reports HP and death.
 */
registerMarkerHandler('ENEMY_DAMAGE', async (parsed, context) => {
  if (!context?.sessionId || !context?.characterId) return null;
  try {
    const enemyName = parsed?.Enemy;
    const amount = Number(parsed?.Amount);
    if (!enemyName || !Number.isFinite(amount)) return null;
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return null;
    const result = await applyDamageToEnemy(context.sessionId, encounterSeq, enemyName, amount);
    // Combat Pipeline #9: Auto-loot on kill (server-rolled via rng.js)
    // Combat Pipeline #11: Morale check on death
    // XP Decision 2026-10-16: Kill XP auto-award REMOVED. XP is session-end only
    // via LLM scoring (combat/exploration/quests/discovery/social). Death events
    // still record xp_value as input data for the scorer.
    if (result?.killed && result?.deathEvent && !result.deathEvent.alreadyLooted) {
      try {
        const char = await dbGet('SELECT level FROM characters WHERE id = ?', [context.characterId]);
        const loot = await generateKillLoot(context.characterId, result.deathEvent.deathEventId, enemyName, char?.level || 1);
        if (loot && !loot.alreadyLooted && !loot.noLoot) result.loot = loot;
        // Morale: survivors may flee
        const morale = await checkMorale(context.sessionId, encounterSeq);
        if (morale?.triggered && morale?.fled?.length > 0) {
          result.morale = morale;
          result.systemNote = (result.systemNote || '') + '\n' + (morale.systemNote || '');
        }
      } catch (e) { console.error('[combatMarkerService] Kill loot/morale failed:', e.message); }
    }
    return result;
  } catch (e) {
    console.error('[combatMarkerService] ENEMY_DAMAGE handler failed:', e.message);
    return null;
  }
});

/**
 * ENEMY_ATTACK handler (Structural #8).
 * [ENEMY_ATTACK: Enemy="Goblin" Target="Player"] — resolve an enemy's attack.
 * Server rolls to-hit vs target AC via rng.js, rolls damage on hit,
 * applies through the HP pipeline. Returns the result for AI narration.
 */
registerMarkerHandler('ENEMY_ATTACK', async (parsed, context) => {
  if (!context?.sessionId || !context?.characterId) return null;
  try {
    const enemyName = parsed?.Enemy;
    const targetName = parsed?.Target || 'Player';
    if (!enemyName) return null;
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return null;
    // Resolve target: Player -> character, else look up companion by name
    let target = null;
    if (targetName.toLowerCase() === 'player') {
      const c = await dbGet('SELECT id, armor_class FROM characters WHERE id = ?', [context.characterId]);
      if (c) target = { type: 'player', id: c.id, armorClass: c.armor_class || 10, name: 'Player' };
    } else {
      const comp = await dbGet(
        `SELECT c.id, c.armor_class, n.name FROM companions c JOIN npcs n ON c.npc_id = n.id
         WHERE c.recruited_by_character_id = ? AND c.status = 'active' AND LOWER(n.name) = LOWER(?) LIMIT 1`,
        [context.characterId, targetName]);
      if (comp) target = { type: 'companion', id: comp.id, armorClass: comp.armor_class || 10, name: comp.name };
    }
    if (!target) return null;
    const result = await resolveEnemyAttack(context.sessionId, encounterSeq, enemyName, target);
    return result;
  } catch (e) {
    console.error('[combatMarkerService] ENEMY_ATTACK handler failed:', e.message);
    return null;
  }
});

/**
 * OPPORTUNITY_ATTACK handler (Combat Pipeline #5).
 * [OPPORTUNITY_ATTACK: Attacker="Name" Target="Name"] — reaction attack when
 * a combatant leaves reach. Consumes the attacker's reaction for the round.
 */
registerMarkerHandler('OPPORTUNITY_ATTACK', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const attacker = parsed?.Attacker;
    const target = parsed?.Target;
    if (!attacker || !target) return null;
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return null;
    // Check reaction availability (D&D 2024: one per round)
    const available = await hasReactionAvailable(context.sessionId, encounterSeq, attacker);
    if (!available) {
      return { type: 'opportunity_attack', success: false, reason: 'reaction_already_used', attacker, target };
    }
    await useReaction(context.sessionId, encounterSeq, attacker);
    // Resolve as a standard attack (attacker makes a melee attack)
    // For MVP, return success; full attack resolution via existing ENEMY_ATTACK/player flow
    return { type: 'opportunity_attack', success: true, attacker, target, reactionConsumed: true };
  } catch (e) {
    console.error('[combatMarkerService] OPPORTUNITY_ATTACK handler failed:', e.message);
    return null;
  }
});

/**
 * SET_COVER handler (Combat Pipeline #6).
 * [SET_COVER: Target="Goblin" Cover="half"] — set cover for an enemy.
 * Valid: none, half, three-quarters, full. D&D 2024: +2/+5 AC.
 */
registerMarkerHandler('SET_COVER', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const target = parsed?.Target;
    const cover = (parsed?.Cover || 'none').toLowerCase();
    if (!target) return null;
    const valid = ['none', 'half', 'three-quarters', 'three_quarters', 'full'];
    if (!valid.includes(cover)) return null;
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return null;
    const enemy = await findActiveEnemy(context.sessionId, encounterSeq, target);
    if (!enemy) return null;
    await dbRun('UPDATE combat_enemies SET cover = ? WHERE id = ?', [cover, enemy.id]);
    return { type: 'set_cover', target: enemy.name, cover, acBonus: getCoverAcBonus(cover) };
  } catch (e) {
    console.error('[combatMarkerService] SET_COVER handler failed:', e.message);
    return null;
  }
});

/**
 * TURN_ADVANCE handler (Combat Pipeline #2).
 * [TURN_ADVANCE] — advance to the next combatant in initiative order.
 * The AI emits this when a combatant's turn ends.
 */
registerMarkerHandler('TURN_ADVANCE', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return null;
    const newState = await advanceTurn(context.sessionId, encounterSeq);
    if (!newState) return null;
    return {
      type: 'turn_advance',
      currentTurn: newState.currentTurn,
      round: newState.round,
      systemNote: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Turn advanced. It is now ${newState.currentTurn?.name}'s turn (Round ${newState.round}).`
    };
  } catch (e) {
    console.error('[combatMarkerService] TURN_ADVANCE handler failed:', e.message);
    return null;
  }
});
