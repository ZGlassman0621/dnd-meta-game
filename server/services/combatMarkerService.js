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

import { dbAll, dbGet } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { estimateEnemyDexMod } from './dmSessionService.js';

const rollD20 = () => Math.floor(Math.random() * 20) + 1;

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
    // Ability scores are stored under short keys (dex), not long (dexterity),
    // so reading only `dexterity` meant DEX never affected initiative (Phase A fix).
    const playerDexMod = Math.floor(((charAbilities.dex ?? charAbilities.dexterity ?? 10) - 10) / 2);

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
      const compDexMod = Math.floor(((compAbilities.dex ?? compAbilities.dexterity ?? 10) - 10) / 2);
      const compRoll = rollD20();
      turnOrder.push({
        name: comp.name,
        type: 'companion',
        roll: compRoll,
        modifier: compDexMod,
        initiative: compRoll + compDexMod
      });
    }

    // Enemy initiatives — Enemies field is comma-separated. Heuristic
    // DEX-mod estimation per estimateEnemyDexMod (kept in dmSessionService
    // per the Q6 survey's PARK ENTIRELY ruling — utility helper, not a
    // marker detector).
    const enemies = (parsed.Enemies || '').split(',').map(e => e.trim()).filter(Boolean);
    for (const enemy of enemies) {
      const enemyDexMod = estimateEnemyDexMod(enemy);
      const enemyRoll = rollD20();
      turnOrder.push({
        name: enemy,
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
    const systemNote = `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Initiative has been rolled. Turn order: ${orderStr}. Use this order for all combat turns. The first combatant to act is ${turnOrder[0].name}.`;

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
