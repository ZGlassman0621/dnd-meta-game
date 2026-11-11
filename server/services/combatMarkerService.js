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
import { ensureWorldId, combatFallbackId } from './worldIdService.js'; // Combat item 3: turn-order entry keys
import { checkTurnIdentity, checkBonus, spendBonus, ledgerKeyForPlayer, ledgerKeyForCompanion, ledgerKeyForTarget } from './turnLedgerService.js'; // Combat item 3, Tier 3
import { getEntry, setField, clearField, untilFor } from './actionStateService.js'; // Combat item 3, Tier 3
import { parseEnemyStats, createEncounterEnemies, getNextEncounterSeq, applyPartyDamageToEnemy, resolveEnemyAttack, getCurrentEncounterSeq, findActiveEnemy } from './enemyCombatService.js';
import { initializeTurnOrder, advanceTurn, getTurnState, getPartyCover, setPartyCover } from './combatTurnService.js';
import { hasReactionAvailable, useReaction } from './reactionService.js';
import { getCoverAcBonus } from './enemyCombatService.js';
import { attackBlockedByConditions, hasIncapacitatingCondition, findCompanionIdByName, charmerFor } from './conditionService.js'; // Combat item 8: action/refusal sweep
import { lookupBestiary } from './bestiaryService.js';
import { lookupBestiaryFull, primaryActionFor, bestiaryDigestLine, abilityMod } from './bestiaryLookupService.js';
import { getPlayerCombatAc, abilityModifier } from './combatStatsService.js';

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
    // B1 fix: sheets store SHORT ability keys (dex). The old read of
    // .dexterity silently made every initiative modifier +0.
    const playerDexMod = abilityModifier(charAbilities.dex ?? charAbilities.dexterity ?? 10);

    const turnOrder = [];

    // Item 3, Tier 1: every entry carries its ledger key (world ID
    // for party/companions, combat fallback for enemies) so the turn
    // ledger can gate on identity. Best-effort throughout: a missing
    // key falls back to the id-based key, never blocks combat start.
    let playerKey = `player:${character.id}`;
    try { playerKey = (await ensureWorldId('characters', character.id)) || playerKey; } catch { /* fallback stands */ }

    // Player initiative
    const playerRoll = rollD20();
    turnOrder.push({
      name: character.nickname || character.name || 'Player',
      type: 'player',
      key: playerKey,
      roll: playerRoll,
      modifier: playerDexMod,
      initiative: playerRoll + playerDexMod
    });

    // Companion initiatives. Schema notes preserved from the legacy
    // inline block: companions.name doesn't exist (lives on npcs via
    // npc_id); FK is recruited_by_character_id; active state is
    // status='active' rather than a boolean.
    const activeCompanions = await dbAll(
      `SELECT c.id AS companionId, n.id AS npcId, n.world_id AS npcWorldId,
              n.name AS name, c.companion_ability_scores
       FROM companions c
       JOIN npcs n ON c.npc_id = n.id
       WHERE c.recruited_by_character_id = ? AND c.status = 'active'`,
      [context.characterId]
    );
    for (const comp of activeCompanions) {
      const compAbilities = typeof comp.companion_ability_scores === 'string'
        ? safeParse(comp.companion_ability_scores, {})
        : (comp.companion_ability_scores || {});
      const compDexMod = abilityModifier(compAbilities.dex ?? compAbilities.dexterity ?? 10);
      const compRoll = rollD20();
      let compKey = comp.npcWorldId || `companion:${comp.companionId}`;
      if (!comp.npcWorldId) {
        try { compKey = (await ensureWorldId('npcs', comp.npcId)) || compKey; } catch { /* fallback stands */ }
      }
      turnOrder.push({
        name: comp.name,
        type: 'companion',
        key: compKey,
        roll: compRoll,
        modifier: compDexMod,
        initiative: compRoll + compDexMod
      });
    }

    // Enemy initiatives — parse stat blocks (Structural #8).
    // Combat Pipeline #7: Check bestiary first for canonical stats.
    // Priority: bestiary > AI-provided stats > defaults.
    // Step 1 (v1.0.194): the FULL 2024 block resolves for every enemy
    // (bestiaryLookupService: DB statblock_json overlay > canonical
    // data > legacy-shaped row). Default-shaped specs take their
    // numbers from the block; AI-specified numbers stand as given.
    // Either way the block snapshots into combat_enemies.stats_json
    // (migration 085) — saves, resistances and condition immunities
    // read it in combat — and a one-line digest per block joins the
    // system note so the DM narrates real traits and actions. The
    // row keeps the DM's name for the enemy: markers target enemies
    // by that name, and the block's book name may differ (the DM's
    // "Goblin" is the book's "Goblin Warrior").
    const parsedStats = parseEnemyStats(parsed.Enemies || '');
    const enemyStats = [];
    const enemyDigests = [];
    for (const p of parsedStats) {
      const isDefault = p.maxHp === 10 && p.armorClass === 12 && p.attackBonus === 3;
      const full = await lookupBestiaryFull(p.name).catch(() => null);
      let spec = p;
      if (isDefault) {
        if (full) {
          const primary = primaryActionFor(full);
          spec = {
            name: p.name,
            maxHp: full.hp,
            armorClass: full.ac,
            attackBonus: primary?.attackBonus ?? p.attackBonus,
            damageDice: primary?.damageDice ?? p.damageDice,
            dexMod: full.abilities ? abilityMod(full.abilities.dex) : (full.dexMod ?? p.dexMod),
          };
        } else {
          const entry = await lookupBestiary(p.name).catch(() => null);
          if (entry) {
            spec = {
              name: entry.display_name,
              maxHp: entry.max_hp,
              armorClass: entry.armor_class,
              attackBonus: entry.attack_bonus,
              damageDice: entry.damage_dice,
              dexMod: entry.dex_mod,
            };
          }
        }
      }
      if (full) {
        spec = { ...spec, statsJson: JSON.stringify(full) };
        const line = bestiaryDigestLine(full);
        if (line) enemyDigests.push(line);
      }
      enemyStats.push(spec);
    }
    const encounterSeq = context?.sessionId ? await getNextEncounterSeq(context.sessionId) : 1;
    // Created rows come back in insertion order, matching enemyStats
    // by index — that pairing is what stamps each mook's fallback key.
    let createdEnemies = [];
    if (context?.sessionId && enemyStats.length > 0) {
      createdEnemies = await createEncounterEnemies(context.sessionId, encounterSeq, enemyStats);
    }
    for (let ei = 0; ei < enemyStats.length; ei++) {
      const enemy = enemyStats[ei];
      const enemyDexMod = enemy.dexMod || estimateEnemyDexMod(enemy.name);
      const enemyRoll = rollD20();
      const enemyKey = createdEnemies[ei]
        ? combatFallbackId(context.sessionId, encounterSeq, createdEnemies[ei].id)
        : `enemy:${String(enemy.name).toLowerCase()}`;
      turnOrder.push({
        name: enemy.name,
        type: 'enemy',
        key: enemyKey,
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
    const digestText = enemyDigests.length
      ? `\nEnemy intel (system facts from the bestiary — narrate these traits, actions and spells faithfully; do not invent others):\n${enemyDigests.map(d => `- ${d}`).join('\n')}`
      : '';
    const systemNote = `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Initiative has been rolled. Turn order: ${orderStr}. Use this order for all combat turns. The first combatant to act is ${turnOrder[0].name}. Emit [TURN_ADVANCE] when a combatant's turn ends.${digestText}`;

    // Combat Pipeline #2: Store turn order server-side
    if (context?.sessionId) {
      try {
        await initializeTurnOrder(context.sessionId, encounterSeq, turnOrder);
      } catch (e) {
        console.error('[combatMarkerService] Failed to store turn order:', e.message);
      }
    }

    // Scene layer wiring: COMBAT_START Scene=/Room= auto-links the new
    // encounter to a dungeon room. A failed link surfaces in roomLink
    // and stores nothing; combat still starts (legacy, not a wrong room).
    let roomLink = null;
    if (context?.sessionId && parsed?.Scene != null && parsed?.Room) {
      try {
        const { setEncounterRoom } = await import('./dungeonSceneStorageService.js');
        const linked = await setEncounterRoom({ sessionId: context.sessionId, encounterSeq, sceneId: Number(parsed.Scene), roomKey: String(parsed.Room).trim() });
        roomLink = { success: true, ...linked };
      } catch (e) {
        roomLink = { success: false, reason: e.message };
      }
    }

    return {
      type: 'combat_start',
      combatStart: { turnOrder, currentTurn: 0, round: 1, encounterSeq },
      systemNote,
      roomLink
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
    if (!enemyName) return null;
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return null;
    // Combat item 7: a table cause (Fall/Trap/Hazard) replaces the
    // declared amount — the engine rolls, the DM names the cause.
    // A table field present beats Amount (the table is authoritative).
    const { resolveTableCause, applyTableDamageToEnemy } = await import('./damageTableService.js');
    const tableCause = resolveTableCause({
      fall: parsed?.Fall, trap: parsed?.Trap, hazard: parsed?.Hazard,
      severity: parsed?.Severity, type: parsed?.Type, save: parsed?.Save,
      amount: parsed?.Amount,
    });
    if (tableCause?.refusal) {
      return { type: 'enemy_damage', success: false, reason: tableCause.refusal.reason, remedy: tableCause.refusal.remedy };
    }
    if (tableCause) {
      return applyTableDamageToEnemy(context.sessionId, encounterSeq, enemyName, tableCause, context.characterId);
    }
    const amount = Number(parsed?.Amount);
    if (!Number.isFinite(amount)) return null;
    // XP Decision 2026-10-16: Kill XP auto-award REMOVED. XP is session-end only
    // via LLM scoring (combat/exploration/quests/discovery/social). Death events
    // still record xp_value as input data for the scorer.
    // Kill loot + morale live in applyPartyDamageToEnemy (combat-real B2) —
    // shared with party attacks so a kill resolves identically either way.
    // Item 6, Tier F2: declared player damage records the attacker
    // (the session PC) so a damage-hook reaction can answer it;
    // the type stays null (declared damage is untyped).
    const pcRow = await dbGet('SELECT name FROM characters WHERE id = ?', [context.characterId]);
    const result = await applyPartyDamageToEnemy(context.sessionId, encounterSeq, enemyName, amount, context.characterId,
      { attacker: { kind: 'player', id: context.characterId, name: pcRow?.name || 'Player' } });
    return result;
  } catch (e) {
    console.error('[combatMarkerService] ENEMY_DAMAGE handler failed:', e.message);
    return null;
  }
});

/**
 * Resolve a party member as an attack target (combat-real B1/B2):
 * computed AC for the PC (equipment truth; armor_class column is the
 * no-equipment fallback), stored AC for companions, plus any
 * SET_COVER state recorded for them this encounter. Shared by
 * ENEMY_ATTACK and OPPORTUNITY_ATTACK.
 */
async function resolvePartyTarget(context, encounterSeq, targetName) {
  let target = null;
  const wanted = String(targetName || '').toLowerCase();
  const c = await dbGet('SELECT id, name FROM characters WHERE id = ?', [context.characterId]);
  if (c && (wanted === 'player' || wanted === String(c.name).toLowerCase())) {
    const combatAc = await getPlayerCombatAc(context.characterId).catch(() => null);
    target = { type: 'player', id: c.id, armorClass: combatAc?.ac || 10, name: 'Player' };
  } else {
    const comp = await dbGet(
      `SELECT c.id, c.armor_class, n.name FROM companions c JOIN npcs n ON c.npc_id = n.id
       WHERE c.recruited_by_character_id = ? AND c.status = 'active' AND LOWER(n.name) = LOWER(?) LIMIT 1`,
      [context.characterId, targetName]);
    if (comp) target = { type: 'companion', id: comp.id, armorClass: comp.armor_class || 10, name: comp.name };
  }
  if (target) {
    const cover = await getPartyCover(context.sessionId, encounterSeq, target.name).catch(() => null);
    if (cover) target.cover = cover;
  }
  return target;
}

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
    // Combat item 8: an incapacitated enemy cannot act, and a
    // charmed enemy cannot attack the charmer. Checked before any
    // reaction spend (Ready branch) or economy spend.
    const gateEnemy = await findActiveEnemy(context.sessionId, encounterSeq, enemyName);
    if (gateEnemy) {
      const gateTarget = await resolvePartyTarget(context, encounterSeq, targetName);
      const blocked = await attackBlockedByConditions('enemy', gateEnemy.id, gateTarget?.type, gateTarget?.id);
      if (blocked) return { type: 'enemy_attack', success: false, reason: blocked };
    }
    // Item 3, Tier 3 (enemy Ready — Zach's veto of party-only
    // Ready): a readied enemy attack fires via Ready="true" — the
    // stored READY and an available reaction are required, and the
    // reaction is spent on the firing, exactly like the party path.
    if (actionTruthy(parsed?.Ready)) {
      // Item 5: a readied attack cannot also be a legendary action —
      // refused here, before any reaction is spent.
      if (actionTruthy(parsed?.Legendary)) {
        return { type: 'enemy_attack', success: false, reason: 'a readied attack cannot also be a legendary action', reactionConsumed: false };
      }
      const enemy = await findActiveEnemy(context.sessionId, encounterSeq, enemyName);
      if (!enemy) return null;
      const enemyKey = combatFallbackId(context.sessionId, encounterSeq, enemy.id);
      const readyEntry = await getEntry(context.sessionId, encounterSeq, enemyKey);
      if (!readyEntry.ready) return { type: 'enemy_attack', success: false, reason: `no readied action stored for ${enemyName}`, reactionConsumed: false };
      const st = await getTurnState(context.sessionId, encounterSeq);
      if (st) {
        if (!(await hasReactionAvailable(context.sessionId, encounterSeq, enemyName))) return { type: 'enemy_attack', success: false, reason: 'reaction already used', reactionConsumed: false };
        await useReaction(context.sessionId, encounterSeq, enemyName);
      }
      await clearField(context.sessionId, encounterSeq, enemyKey, 'ready');
      const target = await resolvePartyTarget(context, encounterSeq, targetName);
      if (!target) return { type: 'enemy_attack', success: false, reason: `unknown target: ${targetName}`, reactionConsumed: true };
      const attack = await resolveEnemyAttack(context.sessionId, encounterSeq, enemyName, target, { reaction: true });
      return { type: 'enemy_attack', success: true, readyFired: true, reactionConsumed: true, attack };
    }
    const target = await resolvePartyTarget(context, encounterSeq, targetName);
    if (!target) return null;
    // Item 5: enemy action economy — the resolver enforces the cap,
    // multiattack accounting, legendary budget, and bonus budget.
    const economyOpts = {
      multiattack: actionTruthy(parsed?.Multiattack),
      legendary: actionTruthy(parsed?.Legendary),
      legendaryCost: parsed?.Cost != null ? Number(parsed.Cost) : 1,
      legendaryTotal: parsed?.LegendaryTotal != null ? Number(parsed.LegendaryTotal) : null,
      bonus: actionTruthy(parsed?.Bonus),
    };
    const result = await resolveEnemyAttack(context.sessionId, encounterSeq, enemyName, target, economyOpts);
    return result;
  } catch (e) {
    console.error('[combatMarkerService] ENEMY_ATTACK handler failed:', e.message);
    return null;
  }
});

// ---------------------------------------------------------------------------
// Combat item 5: enemy action economy markers.
// MULTIATTACK declares a turn's pattern; LEGENDARY_SPEND spends the
// legendary budget on non-attacks; LAIR_ACTION fires the lair's
// once-per-round action; ENEMY_SLOTS sets a caster's slots;
// ENEMY_CAST resolves through enemySpellService (item 6).
// All five return { success: false, reason } for a missing enemy.
// ---------------------------------------------------------------------------
registerMarkerHandler('MULTIATTACK', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const enemyName = parsed?.Enemy;
    if (!enemyName) return { type: 'multiattack', success: false, reason: 'MULTIATTACK needs Enemy=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'multiattack', success: false, reason: 'no active encounter' };
    const enemy = await findActiveEnemy(context.sessionId, encounterSeq, enemyName);
    if (!enemy) return { type: 'multiattack', success: false, reason: `unknown enemy: ${enemyName}` };
    const { declareMultiattack } = await import('./enemyEconomyService.js');
    const key = combatFallbackId(context.sessionId, encounterSeq, enemy.id);
    const actions = String(parsed?.Attacks || '').split(',');
    const declared = await declareMultiattack(context.sessionId, encounterSeq, key, enemy.name, actions);
    if (declared.error) return { type: 'multiattack', success: false, reason: declared.error };
    return { type: 'multiattack', success: true, enemy: declared.enemy, actions: declared.actions };
  } catch (e) {
    console.error('[combatMarkerService] MULTIATTACK handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('LEGENDARY_SPEND', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const enemyName = parsed?.Enemy;
    if (!enemyName) return { type: 'legendary_spend', success: false, reason: 'LEGENDARY_SPEND needs Enemy=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'legendary_spend', success: false, reason: 'no active encounter' };
    const enemy = await findActiveEnemy(context.sessionId, encounterSeq, enemyName);
    if (!enemy) return { type: 'legendary_spend', success: false, reason: `unknown enemy: ${enemyName}` };
    const { spendLegendary } = await import('./enemyEconomyService.js');
    const key = combatFallbackId(context.sessionId, encounterSeq, enemy.id);
    const spent = await spendLegendary(context.sessionId, encounterSeq, key, enemy.name, enemy.id,
      parsed?.Cost != null ? Number(parsed.Cost) : 1,
      parsed?.Total != null ? Number(parsed.Total) : null);
    if (spent.error) return { type: 'legendary_spend', success: false, reason: spent.error };
    return { type: 'legendary_spend', success: true, enemy: enemy.name, effect: parsed?.Effect || null, legendaryRemaining: spent.legendaryRemaining ?? null, tracked: spent.spent };
  } catch (e) {
    console.error('[combatMarkerService] LEGENDARY_SPEND handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('LAIR_ACTION', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const lairName = parsed?.Lair;
    const effect = parsed?.Effect;
    if (!lairName || !effect) return { type: 'lair_action', success: false, reason: 'LAIR_ACTION needs Lair= and Effect=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'lair_action', success: false, reason: 'no active encounter' };
    const { declareLairAction } = await import('./enemyEconomyService.js');
    const declared = await declareLairAction(context.sessionId, encounterSeq, lairName, effect);
    if (declared.error) return { type: 'lair_action', success: false, reason: declared.error };
    return { type: 'lair_action', success: true, lair: declared.lair, effect: declared.effect, round: declared.round };
  } catch (e) {
    console.error('[combatMarkerService] LAIR_ACTION handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('ENEMY_SLOTS', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const enemyName = parsed?.Enemy;
    const spec = parsed?.Slots;
    if (!enemyName || !spec) return { type: 'enemy_slots', success: false, reason: 'ENEMY_SLOTS needs Enemy= and Slots=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'enemy_slots', success: false, reason: 'no active encounter' };
    const enemy = await findActiveEnemy(context.sessionId, encounterSeq, enemyName);
    if (!enemy) return { type: 'enemy_slots', success: false, reason: `unknown enemy: ${enemyName}` };
    const { parseSlotsSpec, setEnemySlots } = await import('./enemyEconomyService.js');
    const slots = parseSlotsSpec(spec);
    await setEnemySlots(enemy.id, slots);
    return { type: 'enemy_slots', success: true, enemy: enemy.name, slots };
  } catch (e) {
    console.error('[combatMarkerService] ENEMY_SLOTS handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('ENEMY_CAST', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const enemyName = parsed?.Enemy;
    const spell = parsed?.Spell;
    if (!enemyName || !spell) return { type: 'enemy_cast', success: false, reason: 'ENEMY_CAST needs Enemy= and Spell=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'enemy_cast', success: false, reason: 'no active encounter' };
    const enemy = await findActiveEnemy(context.sessionId, encounterSeq, enemyName);
    if (!enemy) return { type: 'enemy_cast', success: false, reason: `unknown enemy: ${enemyName}` };
    const key = combatFallbackId(context.sessionId, encounterSeq, enemy.id);
    const level = parsed?.Level != null ? Number(parsed.Level) : 0;
    const reaction = actionTruthy(parsed?.Reaction);
    const dc = parsed?.Dc != null ? Number(parsed.Dc) : null;
    const targets = [];
    if (parsed?.Target) targets.push(String(parsed.Target));
    if (parsed?.Targets) {
      for (const t of String(parsed.Targets).split(',')) {
        const name = t.trim();
        if (name) targets.push(name);
      }
    }
    // Combat item 8: an incapacitated enemy cannot cast, and a
    // charmed enemy cannot target the charmer with a harmful spell.
    // Checked before prereqs, so a refusal consumes nothing.
    if (await hasIncapacitatingCondition('enemy', enemy.id)) {
      return { type: 'enemy_cast', success: false, reason: `${enemy.name} is incapacitated and cannot take actions` };
    }
    if (targets.length) {
      const enemyCharmer = await charmerFor('enemy', enemy.id);
      const { spellIsHarmful } = await import('./spellCastService.js');
      if (enemyCharmer && spellIsHarmful(spell)) {
        for (const t of targets) {
          const pt = await resolvePartyTarget(context, encounterSeq, t);
          let tKind = pt?.type || null;
          let tId = pt?.id ?? null;
          if (!tKind) {
            const te = await findActiveEnemy(context.sessionId, encounterSeq, t);
            if (te) { tKind = 'enemy'; tId = te.id; }
          }
          if (tKind && enemyCharmer.kind === tKind && Number(enemyCharmer.id) === Number(tId)) {
            return { type: 'enemy_cast', success: false, reason: `${enemy.name} is charmed by ${enemyCharmer.name || 'the target'} and cannot target them with harmful spells` };
          }
        }
      }
    }
    const ess = await import('./enemySpellService.js');
    // (a) Prereqs before any spend: reaction validity, save DC and
    // attack-bonus availability. A refused cast consumes nothing.
    const prereq = await ess.enemyCastPrereqs(context.sessionId, encounterSeq, enemy, spell, {
      reaction, level, dc, atkBonus: parsed?.AtkBonus != null ? Number(parsed.AtkBonus) : null,
    });
    if (!prereq.allowed) return { type: 'enemy_cast', success: false, reason: prereq.reason, remedy: prereq.remedy };
    // (b) Reaction budget, checked before the slot spend.
    if (reaction) {
      const rc = await ess.checkReaction(context.sessionId, encounterSeq, enemy.name);
      if (!rc.allowed) return { type: 'enemy_cast', success: false, reason: rc.reason, remedy: rc.remedy };
    } else {
      // (c) Enemy leveled-spell rule (bonus/action symmetry, long
      // casting times refused in combat).
      const { lookupSpell } = await import('../data/spellCatalog.js');
      const castTime = lookupSpell(spell)?.castTime || 'action';
      const ruled = await ess.checkEnemyLeveledRule(context.sessionId, encounterSeq, key, { castTime, level });
      if (!ruled.allowed) return { type: 'enemy_cast', success: false, reason: ruled.reason, remedy: ruled.remedy };
    }
    // (d) Economy + slot (slot availability before economy spend).
    const { castEnemySpell } = await import('./enemyEconomyService.js');
    const cast = await castEnemySpell(context.sessionId, encounterSeq, key, enemy.id, enemy.name, spell, level,
      { bonus: actionTruthy(parsed?.Bonus), legendary: actionTruthy(parsed?.Legendary),
        legendaryCost: parsed?.Cost != null ? Number(parsed.Cost) : 1, dc, reaction });
    if (cast.error) return { type: 'enemy_cast', success: false, reason: cast.error };
    if (!reaction) {
      const { lookupSpell } = await import('../data/spellCatalog.js');
      const castTime = lookupSpell(spell)?.castTime || 'action';
      await ess.markEnemyLeveledCast(context.sessionId, encounterSeq, key, { castTime, level });
    }
    // (e) Counterspell interception (non-reaction casts only): the
    // counter never launders an illegal cast — economy already ran.
    if (!reaction) {
      const counter = ess.takePartyCounter(context, enemy.name);
      if (counter) {
        const save = await ess.rollEnemySave(context.sessionId, encounterSeq, enemy, 'con', counter.dc, spell);
        if (!save.success) {
          return { type: 'enemy_cast', success: true, countered: true, counterspeller: counter.counterspeller, enemy: enemy.name, spell: cast.spell, level: cast.level, slotsRemaining: cast.slotsRemaining };
        }
      }
    }
    // (f) Resolution (Tiers A–D, F, F2).
    const resolved = await ess.resolveEnemyCast(context.sessionId, encounterSeq, enemy, key, spell, level, {
      targets, dc, atkBonus: parsed?.AtkBonus != null ? Number(parsed.AtkBonus) : null,
      casterLevel: parsed?.CasterLevel != null ? Number(parsed.CasterLevel) : null,
      reaction, choice: parsed?.Choice || null, sessionCharacterId: context.characterId ?? null,
    });
    // (g) Reaction spent only after successful resolution.
    if (reaction && resolved?.success !== false) {
      await ess.spendReaction(context.sessionId, encounterSeq, enemy.name);
    }
    return { ...resolved, enemy: enemy.name, spell: cast.spell, level: cast.level, slotsRemaining: cast.slotsRemaining, dc: cast.dc };
  } catch (e) {
    console.error('[combatMarkerService] ENEMY_CAST handler failed:', e.message);
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
    // Item 3, Tier 3: a Disengaged mover cannot be opportunity-
    // attacked — and the refusal must NOT burn the attacker's
    // reaction, so this check goes before the reaction burn below.
    try {
      const partyMover = await resolvePartyTarget(context, encounterSeq, target);
      let moverKey = null;
      if (partyMover) moverKey = await ledgerKeyForTarget(partyMover.type, partyMover.id);
      else {
        const enemyMover = await findActiveEnemy(context.sessionId, encounterSeq, target);
        if (enemyMover) moverKey = combatFallbackId(context.sessionId, encounterSeq, enemyMover.id);
      }
      if (moverKey) {
        const moverEntry = await getEntry(context.sessionId, encounterSeq, moverKey);
        if (moverEntry.disengage) return { type: 'opportunity_attack', success: false, reason: `${target} Disengaged — opportunity attacks cannot target them`, attacker, target, reactionConsumed: false };
      }
    } catch { /* best-effort; a failed check must not block the OA */ }
    // Combat item 8: an incapacitated attacker cannot react, and a
    // charmed attacker cannot attack the charmer. Checked BEFORE
    // the reaction is spent, so a refusal consumes nothing.
    const oaEnemyAttacker = await findActiveEnemy(context.sessionId, encounterSeq, attacker);
    if (oaEnemyAttacker) {
      const oaPartyTarget = await resolvePartyTarget(context, encounterSeq, target);
      const oaBlocked = await attackBlockedByConditions('enemy', oaEnemyAttacker.id, oaPartyTarget?.type, oaPartyTarget?.id);
      if (oaBlocked) return { type: 'opportunity_attack', success: false, reason: oaBlocked, attacker, target, reactionConsumed: false };
    } else {
      const oaCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [context.characterId]);
      const oaIsPc = /^(player|pc|character)$/i.test(attacker) || (oaCharacter && attacker.toLowerCase() === String(oaCharacter.name).toLowerCase());
      const oaEnemyTarget = await findActiveEnemy(context.sessionId, encounterSeq, target);
      if (oaIsPc) {
        const oaBlocked = await attackBlockedByConditions('player', context.characterId, 'enemy', oaEnemyTarget?.id);
        if (oaBlocked) return { type: 'opportunity_attack', success: false, reason: oaBlocked, attacker, target, reactionConsumed: false };
      } else {
        const oaCompId = await findCompanionIdByName(context.characterId, attacker);
        if (oaCompId) {
          const oaBlocked = await attackBlockedByConditions('companion', oaCompId, 'enemy', oaEnemyTarget?.id);
          if (oaBlocked) return { type: 'opportunity_attack', success: false, reason: oaBlocked, attacker, target, reactionConsumed: false };
        }
      }
    }
    // Check reaction availability (D&D 2024: one per round)
    const available = await hasReactionAvailable(context.sessionId, encounterSeq, attacker);
    if (!available) {
      return { type: 'opportunity_attack', success: false, reason: 'reaction_already_used', attacker, target };
    }
    await useReaction(context.sessionId, encounterSeq, attacker);
    // Combat-real B6: resolve a REAL attack through whichever resolver
    // owns the attacker. Enemy → resolveEnemyAttack against the party
    // target; companion → partyAttackService's server roll; the PC → a
    // pending attack (the player rolls for their own reaction).
    const enemyAttacker = await findActiveEnemy(context.sessionId, encounterSeq, attacker);
    if (enemyAttacker) {
      const partyTarget = await resolvePartyTarget(context, encounterSeq, target);
      if (!partyTarget) return { type: 'opportunity_attack', success: false, reason: `unknown target: ${target}`, attacker, target, reactionConsumed: true };
      const attack = await resolveEnemyAttack(context.sessionId, encounterSeq, attacker, partyTarget, { reaction: true });
      return { type: 'opportunity_attack', success: true, attacker, target, reactionConsumed: true, attack };
    }
    const enemyTarget = await findActiveEnemy(context.sessionId, encounterSeq, target);
    if (!enemyTarget) return { type: 'opportunity_attack', success: false, reason: `unknown target: ${target}`, attacker, target, reactionConsumed: true };
    const { createPcPendingAttack, resolveCompanionAttack } = await import('./partyAttackService.js');
    // NOTE: findCompanionIdByName is NOT re-imported here. It comes from the
    // static item-8 import at the top; a local re-import in this try block
    // shadowed the companion branch above into TDZ and crashed every
    // companion opportunity attack (capstone + combat-real gate).
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [context.characterId]);
    const isPc = /^(player|pc|character)$/i.test(attacker) || (character && attacker.toLowerCase() === String(character.name).toLowerCase());
    if (isPc) {
      // Item 3, Tier 1: reactions are exempt from the turn-identity
      // gate (they legitimately fire on others' turns); their flags
      // are slot-keyed, so they are fresh on the reaction's slot.
      const { pending, error } = await createPcPendingAttack(context.sessionId, context.characterId, character, enemyTarget, { reaction: true });
      if (error) return { type: 'opportunity_attack', success: false, reason: error, attacker, target, reactionConsumed: true };
      return { type: 'opportunity_attack', success: true, attacker, target, reactionConsumed: true, pending: true, pendingAttack: pending };
    }
    const compId = await findCompanionIdByName(context.characterId, attacker);
    if (!compId) return { type: 'opportunity_attack', success: false, reason: `unknown attacker: ${attacker}`, attacker, target, reactionConsumed: true };
    const companionRow = await dbGet(`SELECT c.*, n.name AS display_name FROM companions c LEFT JOIN npcs n ON n.id = c.npc_id WHERE c.id = ?`, [compId]);
    const attack = await resolveCompanionAttack(context.sessionId, context.characterId, companionRow, enemyTarget, { reaction: true });
    return { type: 'opportunity_attack', success: true, attacker, target, reactionConsumed: true, attack };
  } catch (e) {
    console.error('[combatMarkerService] OPPORTUNITY_ATTACK handler failed:', e.message);
    return null;
  }
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Combat item 4, movement v1 (zones): the fight is a graph of named
// areas, not a grid. ZONES declares the graph (areas + foot-cost
// edges + optional starting placements); MOVE walks it on a turn
// movement budget; DASH doubles this turn's budget. Same area =
// 5 ft for reach and range purposes; no zones declared = one area
// ("the fight"), a brawl, all melee. Zone names cannot contain
// ',', ':' or '-' (the list, feet, and edge separators).
// ---------------------------------------------------------------------------
registerMarkerHandler('ZONES', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const zonesRaw = String(parsed?.Zones || '').trim();
    if (!zonesRaw) return { type: 'zones', success: false, reason: 'ZONES needs Zones="area1,area2"' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'zones', success: false, reason: 'no active encounter' };
    const { readZones, writeZones, normalizeZone, edgeKey } = await import('./movementService.js');
    const existing = await readZones(context.sessionId, encounterSeq);
    if (!existing) return { type: 'zones', success: false, reason: 'no combat turn state — declare zones after COMBAT_START' };
    const zones = [...new Set(zonesRaw.split(',').map((z) => normalizeZone(z)).filter(Boolean))];
    if (!zones.length) return { type: 'zones', success: false, reason: 'ZONES needs at least one area in Zones=' };
    const edges = {};
    const edgesRaw = String(parsed?.Edges || '').trim();
    if (edgesRaw) {
      for (const part of edgesRaw.split(',')) {
        const seg = part.trim();
        if (!seg) continue;
        const bits = seg.split(':');
        if (bits.length < 2 || bits.length > 3) return { type: 'zones', success: false, reason: `bad edge "${seg}" — use "area1-area2:feet" or "area1-area2:feet:difficult"` };
        const pair = bits[0].split('-');
        if (pair.length !== 2) return { type: 'zones', success: false, reason: `bad edge "${seg}" — use "area1-area2:feet"` };
        const a = normalizeZone(pair[0]);
        const b = normalizeZone(pair[1]);
        const feet = Number(bits[1]);
        if (!zones.includes(a) || !zones.includes(b)) return { type: 'zones', success: false, reason: `edge "${seg}" names an area not in Zones=` };
        if (!Number.isFinite(feet) || feet <= 0) return { type: 'zones', success: false, reason: `edge "${seg}" needs a positive feet value` };
        edges[edgeKey(a, b)] = { feet, difficult: String(bits[2] || '').toLowerCase().trim() === 'difficult' };
      }
    }
    // A re-declaration replaces the graph wholesale. Positions
    // survive when their area still exists; otherwise they fall
    // back to the first declared area (via positionOf).
    const positions = {};
    for (const [key, zone] of Object.entries(existing.positions || {})) {
      if (zones.includes(zone)) positions[key] = zone;
    }
    const placesRaw = String(parsed?.Places || '').trim();
    const placed = [];
    if (placesRaw) {
      for (const part of placesRaw.split(',')) {
        const seg = part.trim();
        if (!seg) continue;
        const bits = seg.split(':');
        if (bits.length !== 2) return { type: 'zones', success: false, reason: `bad placement "${seg}" — use "Name:area"` };
        const zone = normalizeZone(bits[1]);
        if (!zones.includes(zone)) return { type: 'zones', success: false, reason: `placement "${seg}" names an area not in Zones=` };
        const target = await resolveActionTarget(context, encounterSeq, bits[0].trim());
        if (!target) return { type: 'zones', success: false, reason: `unknown combatant: ${bits[0].trim()}` };
        positions[target.key] = zone;
        placed.push({ name: target.name, zone });
      }
    }
    const ok = await writeZones(context.sessionId, encounterSeq, { zones, edges, positions });
    if (!ok) return { type: 'zones', success: false, reason: 'could not store the zone graph' };
    return { type: 'zones', success: true, zones, edges: Object.keys(edges).length, placed };
  } catch (e) {
    console.error('[combatMarkerService] ZONES handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('MOVE', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    const toRaw = String(parsed?.To || '').trim();
    if (!targetRaw || !toRaw) return { type: 'move', success: false, reason: 'MOVE needs Target= and To=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'move', success: false, reason: 'no active encounter' };
    const mover = await resolveActionTarget(context, encounterSeq, targetRaw);
    if (!mover) return { type: 'move', success: false, reason: `unknown mover: ${targetRaw}` };
    const { readZones, writeZones, normalizeZone, edgeKey, positionOf, moveCost, moveBudget, spendMove, speedFor, isSpeedZero, provokedByMove } = await import('./movementService.js');
    const data = await readZones(context.sessionId, encounterSeq);
    if (!data) return { type: 'move', success: false, reason: 'no combat turn state — move after COMBAT_START' };
    // Turn-gated for the party (Q1); enemies are DM-governed (Q2).
    if (mover.kind !== 'enemy') {
      const gateErr = await gateActionTarget(context, encounterSeq, mover);
      if (gateErr) return { type: 'move', success: false, reason: gateErr };
    }
    // Speed 0 (grappled / restrained) cannot move at all.
    if (await isSpeedZero(context.sessionId, mover.kind, mover.id)) return { type: 'move', success: false, reason: `${mover.name} cannot move (speed 0)` };
    const to = normalizeZone(toRaw);
    const from = positionOf(data, mover.key);
    let cost = null;
    let path = null;
    let nextData = data;
    if (data.zones.includes(to)) {
      const found = moveCost(data, from, to);
      if (!found) return { type: 'move', success: false, reason: `no path from ${from} to ${to}` };
      cost = found.cost;
      path = found.path;
    } else {
      // Organic creation: a new area joined to the mover's area by
      // the declared distance (a difficult edge when flagged). When
      // no graph exists yet, the mover's default area becomes the
      // first declared area so the edge has both ends.
      const feet = Number(parsed?.Distance);
      if (!Number.isFinite(feet) || feet <= 0) return { type: 'move', success: false, reason: `To="${toRaw}" is not a declared area — MOVE needs Distance="feet" to create it` };
      const difficult = actionTruthy(parsed?.Difficult);
      nextData = { zones: data.zones.length ? [...data.zones, to] : [from, to], edges: { ...data.edges, [edgeKey(from, to)]: { feet, difficult } }, positions: { ...data.positions } };
      cost = difficult ? feet * 2 : feet;
      path = [from, to];
    }
    const speed = await speedFor(context.sessionId, mover.kind, mover.id);
    const budget = await moveBudget(context.sessionId, encounterSeq, mover.key);
    if (!budget) return { type: 'move', success: false, reason: 'no movement budget — move after COMBAT_START' };
    const allowance = speed * (budget.dashed ? 2 : 1);
    const remaining = allowance - budget.spent;
    if (cost > remaining) return { type: 'move', success: false, reason: `${mover.name} has ${remaining} ft of movement left, but ${to} costs ${cost} ft` };
    const spent = await spendMove(context.sessionId, encounterSeq, mover.key, cost);
    if (!spent) return { type: 'move', success: false, reason: 'could not record the movement' };
    nextData.positions[mover.key] = to;
    const stored = await writeZones(context.sessionId, encounterSeq, nextData);
    if (!stored) return { type: 'move', success: false, reason: 'could not store the move' };
    // Scene layer wiring: a declared Room= re-links the encounter to
    // that room after a successful move (same scene as the current
    // link, or Scene= when given). A failed re-link never undoes the
    // move; it surfaces in roomLink. No Room= means no re-link — zone
    // names are not room keys.
    let roomLink = null;
    if (parsed?.Room) {
      try {
        const { relinkOnMove } = await import('./sceneLinkService.js');
        const sceneNum = parsed?.Scene != null && !Number.isNaN(Number(parsed.Scene)) ? Number(parsed.Scene) : null;
        roomLink = await relinkOnMove({ sessionId: context.sessionId, encounterSeq, roomKey: String(parsed.Room).trim(), sceneId: sceneNum });
      } catch (e) { roomLink = { success: false, reason: e.message }; }
    }
    // Opportunity attacks: whoever's reach the mover left, step by
    // step. Disengaged or hidden movers provoke nobody.
    let provoked = [];
    try {
      const entry = await getEntry(context.sessionId, encounterSeq, mover.key);
      provoked = await provokedByMove(context.sessionId, encounterSeq, mover.key, mover.kind === 'enemy' ? 'enemy' : 'party', path, !!entry.hidden, !!entry.disengage);
    } catch { /* best-effort */ }
    return { type: 'move', success: true, mover: mover.name, from, to, feet: cost, remaining: remaining - cost, provoked: provoked.map((p) => p.name), roomLink };
  } catch (e) {
    console.error('[combatMarkerService] MOVE handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('DASH', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    if (!targetRaw) return { type: 'dash', success: false, reason: 'DASH needs Target=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'dash', success: false, reason: 'no active encounter' };
    const target = await resolveActionTarget(context, encounterSeq, targetRaw);
    if (!target) return { type: 'dash', success: false, reason: `unknown target: ${targetRaw}` };
    // Combat item 8: incapacitated creatures cannot take actions.
    if (await hasIncapacitatingCondition(target.kind, target.id)) return { type: 'dash', success: false, reason: `${target.name} is incapacitated and cannot take actions` };
    // Turn-gated for the party (Q1); enemies are DM-governed (Q2).
    if (target.kind !== 'enemy') {
      const gateErr = await gateActionTarget(context, encounterSeq, target);
      if (gateErr) return { type: 'dash', success: false, reason: gateErr };
    }
    const { moveBudget, setDashed, speedFor } = await import('./movementService.js');
    // Bonus="true" is the Cunning Action / Step of the Wind bridge
    // (Tier 3 pattern): checked before anything is set, charged
    // only after the Dash lands. Enemies charge their bonus budget
    // the same way (item 5 — the Tier 3 note-never-charged flip).
    const bonusFlag = actionTruthy(parsed?.Bonus);
    if (bonusFlag && target.kind !== 'enemy') {
      const bc = await checkBonus(context.sessionId, encounterSeq, target.key);
      if (!bc.allowed) return { type: 'dash', success: false, reason: `${bc.reason} ${bc.remedy}` };
    } else if (bonusFlag && target.kind === 'enemy') {
      const { checkEnemyBonus } = await import('./enemyEconomyService.js');
      const ebc = await checkEnemyBonus(context.sessionId, encounterSeq, target.key, target.name);
      if (ebc.error) return { type: 'dash', success: false, reason: ebc.error };
    }
    const budget = await moveBudget(context.sessionId, encounterSeq, target.key);
    if (!budget) return { type: 'dash', success: false, reason: 'no movement budget — dash after COMBAT_START' };
    if (budget.dashed) return { type: 'dash', success: false, reason: `${target.name} already dashed this turn` };
    const dashed = await setDashed(context.sessionId, encounterSeq, target.key);
    if (!dashed) return { type: 'dash', success: false, reason: 'could not record the Dash' };
    if (bonusFlag && target.kind !== 'enemy') await spendBonus(context.sessionId, encounterSeq, target.key, 'Dash');
    else if (bonusFlag && target.kind === 'enemy') {
      const { spendEnemyBonus } = await import('./enemyEconomyService.js');
      const spent = await spendEnemyBonus(context.sessionId, encounterSeq, target.key, target.name);
      if (spent.error) return { type: 'dash', success: false, reason: spent.error };
    }
    const speed = await speedFor(context.sessionId, target.kind, target.id);
    const dashResult = { type: 'dash', success: true, target: target.name, speed, budget: speed * 2 };
    if (bonusFlag && target.kind === 'enemy') dashResult.bonusSpent = true;
    return dashResult;
  } catch (e) {
    console.error('[combatMarkerService] DASH handler failed:', e.message);
    return null;
  }
});

// ---------------------------------------------------------------------------
// Combat item 3, Tier 3: Dodge / Disengage / Help / Hide / Ready.
// Party actions are identity-gated like any turn action (Q1); enemy
// Dodge / Disengage are DM-governed (Q2), so they skip the gate.
// Hide and Ready are mechanical for enemies too (Zach's veto of
// party-only: narrative fallbacks break the system) — a hidden
// enemy's next attack is advantaged in resolveEnemyAttack, and an
// enemy's readied attack fires via ENEMY_ATTACK Ready="true".
// Action costs are DM-attested (the engine does not gate actions
// generally); Bonus="true" on Dodge / Disengage / Hide charges the
// Tier 2 bonus instead, and is checked before the state is set so
// a refused bonus spends nothing and sets nothing.
// ---------------------------------------------------------------------------
async function resolveActionTarget(context, encounterSeq, targetRaw) {
  const wanted = String(targetRaw || '').trim();
  const c = await dbGet('SELECT id, name FROM characters WHERE id = ?', [context.characterId]);
  if (c && (/^(player|pc|character)$/i.test(wanted) || wanted.toLowerCase() === String(c.name).toLowerCase())) {
    return { kind: 'player', id: c.id, key: await ledgerKeyForPlayer(c.id), name: c.name };
  }
  const comp = await dbGet(
    `SELECT c.id, c.npc_id, n.name FROM companions c JOIN npcs n ON n.id = c.npc_id
     WHERE c.recruited_by_character_id = ? AND c.status = 'active' AND LOWER(n.name) = LOWER(?) LIMIT 1`,
    [context.characterId, wanted]);
  if (comp) return { kind: 'companion', id: comp.id, key: await ledgerKeyForCompanion(comp), name: comp.name };
  const enemy = await findActiveEnemy(context.sessionId, encounterSeq, wanted);
  if (enemy) return { kind: 'enemy', id: enemy.id, key: combatFallbackId(context.sessionId, encounterSeq, enemy.id), name: enemy.name };
  return null;
}

function actionTruthy(v) {
  return ['true', 'yes', '1'].includes(String(v || '').toLowerCase().trim());
}

async function gateActionTarget(context, encounterSeq, target) {
  if (target.kind === 'enemy') return null;
  const id = await checkTurnIdentity(context.sessionId, encounterSeq, target.key);
  return id.allowed ? null : `${id.reason} ${id.remedy}`;
}

registerMarkerHandler('DODGE', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    if (!targetRaw) return { type: 'dodge', success: false, reason: 'DODGE needs Target=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'dodge', success: false, reason: 'no active encounter' };
    const target = await resolveActionTarget(context, encounterSeq, targetRaw);
    if (!target) return { type: 'dodge', success: false, reason: `unknown target: ${targetRaw}` };
    // Combat item 8: incapacitated creatures cannot take actions
    // (including firing a readied Dodge — firing costs a reaction).
    if (await hasIncapacitatingCondition(target.kind, target.id)) return { type: 'dodge', success: false, reason: `${target.name} is incapacitated and cannot take actions` };
    // Firing a readied Dodge: the stored ready + reaction are the
    // cost (the action was paid when it was readied), so this is
    // exempt from the identity gate and from any bonus charge.
    let readyFired = false;
    if (actionTruthy(parsed?.Ready)) {
      const fireErr = await fireReadiedAction(context, encounterSeq, target);
      if (fireErr) return { type: 'dodge', success: false, reason: fireErr };
      readyFired = true;
    }
    if (!readyFired) {
      const gateErr = await gateActionTarget(context, encounterSeq, target);
      if (gateErr) return { type: 'dodge', success: false, reason: gateErr };
    }
    // Enemies have no tracked bonus action until item 5, so a
    // Bonus flag on an enemy's move is noted, never charged.
    const bonusFlag = actionTruthy(parsed?.Bonus);
    if (bonusFlag && !readyFired && target.kind !== 'enemy') {
      const bc = await checkBonus(context.sessionId, encounterSeq, target.key);
      if (!bc.allowed) return { type: 'dodge', success: false, reason: `${bc.reason} ${bc.remedy}` };
    }
    await setField(context.sessionId, encounterSeq, target.key, 'dodge', { until: await untilFor(context.sessionId, encounterSeq, target.key) });
    if (bonusFlag && !readyFired && target.kind !== 'enemy') await spendBonus(context.sessionId, encounterSeq, target.key, 'Dodge');
    const dodgeResult = { type: 'dodge', success: true, target: target.name };
    if (readyFired) dodgeResult.readyFired = true;
    if (bonusFlag && target.kind === 'enemy') dodgeResult.bonusIgnored = 'enemy bonus action not charged for Dodge in v1 (free)'; 
    return dodgeResult;
  } catch (e) {
    console.error('[combatMarkerService] DODGE handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('DISENGAGE', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    if (!targetRaw) return { type: 'disengage', success: false, reason: 'DISENGAGE needs Target=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'disengage', success: false, reason: 'no active encounter' };
    const target = await resolveActionTarget(context, encounterSeq, targetRaw);
    if (!target) return { type: 'disengage', success: false, reason: `unknown target: ${targetRaw}` };
    // Combat item 8: incapacitated creatures cannot take actions
    // (including firing a readied Disengage — firing costs a reaction).
    if (await hasIncapacitatingCondition(target.kind, target.id)) return { type: 'disengage', success: false, reason: `${target.name} is incapacitated and cannot take actions` };
    // Firing a readied Disengage: same exemption as Dodge — the
    // stored ready + reaction are the cost, no identity gate, no
    // bonus charge.
    let readyFired = false;
    if (actionTruthy(parsed?.Ready)) {
      const fireErr = await fireReadiedAction(context, encounterSeq, target);
      if (fireErr) return { type: 'disengage', success: false, reason: fireErr };
      readyFired = true;
    }
    if (!readyFired) {
      const gateErr = await gateActionTarget(context, encounterSeq, target);
      if (gateErr) return { type: 'disengage', success: false, reason: gateErr };
    }
    const bonusFlag = actionTruthy(parsed?.Bonus);
    if (bonusFlag && !readyFired && target.kind !== 'enemy') {
      const bc = await checkBonus(context.sessionId, encounterSeq, target.key);
      if (!bc.allowed) return { type: 'disengage', success: false, reason: `${bc.reason} ${bc.remedy}` };
    }
    await setField(context.sessionId, encounterSeq, target.key, 'disengage', { until: await untilFor(context.sessionId, encounterSeq, target.key) });
    if (bonusFlag && !readyFired && target.kind !== 'enemy') await spendBonus(context.sessionId, encounterSeq, target.key, 'Disengage');
    const disengageResult = { type: 'disengage', success: true, target: target.name };
    if (readyFired) disengageResult.readyFired = true;
    if (bonusFlag && target.kind === 'enemy') disengageResult.bonusIgnored = 'enemy bonus action not charged for Disengage in v1 (free)'; 
    return disengageResult;
  } catch (e) {
    console.error('[combatMarkerService] DISENGAGE handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('HELP', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const helperRaw = String(parsed?.Helper || '').trim();
    const targetRaw = String(parsed?.Target || '').trim();
    const allyRaw = String(parsed?.Ally || '').trim();
    if (!helperRaw || !targetRaw || !allyRaw) return { type: 'help', success: false, reason: 'HELP needs Helper=, Target=, and Ally=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'help', success: false, reason: 'no active encounter' };
    // Enemy Help (Tier 3 follow-up, Zach's audit item 1): helper
    // and ally must be on the SAME side, and the target on the
    // OPPOSITE side — a party member helping an enemy, or an enemy
    // helping the party, is refused with the reason named (charmed
    // helpers stay DM-side). The enemy attack path reads the stored
    // help exactly like the party path does.
    const helper = await resolveActionTarget(context, encounterSeq, helperRaw);
    if (!helper) return { type: 'help', success: false, reason: `unknown helper: ${helperRaw}` };
    // Combat item 8: an incapacitated helper cannot take the Help
    // action. (Charmed helpers stay DM-side per the existing note:
    // helping is not attacking the charmer.)
    if (await hasIncapacitatingCondition(helper.kind, helper.id)) return { type: 'help', success: false, reason: `${helper.name} is incapacitated and cannot take actions` };
    const ally = await resolveActionTarget(context, encounterSeq, allyRaw);
    if (!ally) return { type: 'help', success: false, reason: `unknown ally: ${allyRaw}` };
    const helperSide = helper.kind === 'enemy' ? 'enemy' : 'party';
    const allySide = ally.kind === 'enemy' ? 'enemy' : 'party';
    if (helperSide !== allySide) return { type: 'help', success: false, reason: 'HELP helper and ally must be on the same side' };
    let targetName;
    let targetDisplay;
    let targetKey = null;
    if (allySide === 'party') {
      const enemy = await findActiveEnemy(context.sessionId, encounterSeq, targetRaw);
      if (!enemy) return { type: 'help', success: false, reason: `no active enemy named "${targetRaw}"` };
      targetName = enemy.name.toLowerCase();
      targetDisplay = enemy.name;
      targetKey = combatFallbackId(context.sessionId, encounterSeq, enemy.id);
    } else {
      const partyTarget = await resolveActionTarget(context, encounterSeq, targetRaw);
      if (!partyTarget || partyTarget.kind === 'enemy') return { type: 'help', success: false, reason: 'HELP ally and target must be on opposite sides' };
      // The enemy attack path sees party targets through
      // resolvePartyTarget, which names the PC 'Player' — store
      // that name, not the character name, or help vs the PC
      // would never match.
      targetName = partyTarget.kind === 'player' ? 'player' : partyTarget.name.toLowerCase();
      targetDisplay = partyTarget.name;
      targetKey = partyTarget.key;
    }
    // Combat item 4: Help needs the helper within 5 ft of the
    // target — checked before any reaction is spent or gate is
    // passed, so a refused Help consumes nothing.
    try {
      const { distanceBetween } = await import('./movementService.js');
      const d = await distanceBetween(context.sessionId, encounterSeq, helper.key, targetKey);
      if (d.feet === null || d.feet > 5) return { type: 'help', success: false, reason: `${helper.name} is too far from ${targetDisplay} to Help — Help needs the helper within 5 ft of the target` };
    } catch { /* best-effort; a broken distance check never blocks Help */ }
    // Firing a readied Help: the helper's stored ready + reaction
    // are the cost — exempt from the identity gate (the helper was
    // gated when the ready was stored).
    let readyFired = false;
    if (actionTruthy(parsed?.Ready)) {
      const fireErr = await fireReadiedAction(context, encounterSeq, helper);
      if (fireErr) return { type: 'help', success: false, reason: fireErr };
      readyFired = true;
    }
    if (!readyFired) {
      const gateErr = await gateActionTarget(context, encounterSeq, helper);
      if (gateErr) return { type: 'help', success: false, reason: gateErr };
    }
    await setField(context.sessionId, encounterSeq, ally.key, 'help', { helperKey: helper.key, targetName, until: await untilFor(context.sessionId, encounterSeq, helper.key) });
    return { type: 'help', success: true, helper: helper.name, ally: ally.name, target: targetDisplay, ...(readyFired ? { readyFired: true } : {}) };
  } catch (e) {
    console.error('[combatMarkerService] HELP handler failed:', e.message);
    return null;
  }
});

// One check resolution for Hide v2 + Search (audit item 4): a
// player-rolled total comes in as the override (with the die when
// it was a natural 1 or 20), otherwise the system rolls. Natural 1
// never succeeds, natural 20 always succeeds (Zach, 2026-10-20).
async function resolveCheckTotal(context, actor, skill, dc, given, givenDie) {
  if (Number.isFinite(given)) {
    const die = Number.isFinite(givenDie) ? givenDie : null;
    const passed = die === 1 ? false : die === 20 ? true : given >= dc;
    return { total: given, die, modifier: null, passed };
  }
  const { getPcCheckModifier, getNpcCheckModifier, resolveDice } = await import('./rollRequestService.js');
  let modifier = 0;
  if (actor.kind === 'player') {
    const mod = await getPcCheckModifier(context.characterId, 'skill', skill);
    modifier = mod?.modifier ?? 0;
  } else {
    const mod = await getNpcCheckModifier(actor.name, 'skill', skill, context.characterId);
    modifier = mod?.modifier ?? 0;
  }
  const die = rngRollD20();
  const judged = resolveDice({ dice: [die], modifier, dc });
  return { total: judged.total, die, modifier, passed: judged.outcome === 'success' || judged.outcome === 'critical_success' };
}

// Opposing combatants whose passive Perception meets the Stealth
// total spot the hider immediately (2024: the find DC applies to
// passive scores too). Best-effort: an unresolvable passive is
// skipped, never blocking the hide. Allies' eyes don't count.
async function passiveSpotters(context, encounterSeq, target, total) {
  const spotters = [];
  try {
    const st = await getTurnState(context.sessionId, encounterSeq);
    if (!st?.turnOrder) return spotters;
    const { getPcPassive, getNpcCheckModifier } = await import('./rollRequestService.js');
    const partySide = target.kind === 'player' || target.kind === 'companion';
    for (const entry of st.turnOrder) {
      if (entry.key === target.key) continue;
      const opponent = partySide ? entry.type === 'enemy' : (entry.type === 'player' || entry.type === 'companion');
      if (!opponent) continue;
      try {
        let passive = null;
        if (entry.type === 'player') passive = await getPcPassive(context.characterId, 'Perception');
        else {
          const mod = await getNpcCheckModifier(entry.name, 'skill', 'Perception', context.characterId);
          if (mod) passive = 10 + mod.modifier;
        }
        if (passive != null && passive >= total) spotters.push({ name: entry.name, passive });
      } catch { /* one unresolvable passive never blocks the hide */ }
    }
  } catch { /* no turn order, no sweep */ }
  return spotters;
}

registerMarkerHandler('HIDE', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    if (!targetRaw) return { type: 'hide', success: false, reason: 'HIDE needs Target=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'hide', success: false, reason: 'no active encounter' };
    const target = await resolveActionTarget(context, encounterSeq, targetRaw);
    if (!target) return { type: 'hide', success: false, reason: `unknown target: ${targetRaw}` };
    // Ending hidden (a shout, stepping out) is a free action, not a
    // turn action: no identity gate, no bonus, no check.
    if (actionTruthy(parsed?.End)) {
      const entry = await getEntry(context.sessionId, encounterSeq, target.key);
      if (!entry.hidden) return { type: 'hide', success: false, reason: `${target.name} is not hidden` };
      await clearField(context.sessionId, encounterSeq, target.key, 'hidden');
      return { type: 'hide', success: true, target: target.name, ended: true };
    }
    // Combat item 8: incapacitated creatures cannot take actions.
    // Placed after the End branch above (ending hidden is free, not
    // an action) and before the Ready branch (firing costs a reaction).
    if (await hasIncapacitatingCondition(target.kind, target.id)) return { type: 'hide', success: false, reason: `${target.name} is incapacitated and cannot take actions` };
    // Firing a readied Hide: same exemption as Dodge — the stored
    // ready + reaction are the cost, no identity gate, no bonus.
    let readyFired = false;
    if (actionTruthy(parsed?.Ready)) {
      const fireErr = await fireReadiedAction(context, encounterSeq, target);
      if (fireErr) return { type: 'hide', success: false, reason: fireErr };
      readyFired = true;
    }
    if (!readyFired) {
      const gateErr = await gateActionTarget(context, encounterSeq, target);
      if (gateErr) return { type: 'hide', success: false, reason: gateErr };
    }
    const bonusFlag = actionTruthy(parsed?.Bonus);
    if (bonusFlag && !readyFired && target.kind !== 'enemy') {
      const bc = await checkBonus(context.sessionId, encounterSeq, target.key);
      if (!bc.allowed) return { type: 'hide', success: false, reason: `${bc.reason} ${bc.remedy}` };
    }
    // The action is taken here, so the bonus is spent even if the
    // check fails — like a missed attack still spending the swing.
    if (bonusFlag && !readyFired && target.kind !== 'enemy') await spendBonus(context.sessionId, encounterSeq, target.key, 'Hide');
    // Hide v2 (audit item 4): DC 15 Stealth check, then the passive
    // sweep — an opposing passive that meets the total spots the
    // hider on the spot and the hide does not take.
    const stealth = await resolveCheckTotal(context, target, 'Stealth', 15, Number(parsed?.Stealth), Number(parsed?.StealthDie));
    if (!stealth.passed) {
      const reason = stealth.die === 1
        ? `${target.name} rolled a natural 1 on Stealth — the hide fails`
        : `${target.name} failed the DC 15 Stealth check (${stealth.total})`;
      return { type: 'hide', success: false, target: target.name, stealthTotal: stealth.total, reason };
    }
    const spotters = await passiveSpotters(context, encounterSeq, target, stealth.total);
    if (spotters.length) {
      const names = spotters.map((s) => `${s.name} (passive ${s.passive})`).join(', ');
      return { type: 'hide', success: false, target: target.name, stealthTotal: stealth.total, reason: `${target.name} was spotted by ${names}` };
    }
    await setField(context.sessionId, encounterSeq, target.key, 'hidden', { total: stealth.total });
    const hideResult = { type: 'hide', success: true, target: target.name, stealthTotal: stealth.total };
    if (stealth.die != null) hideResult.die = stealth.die;
    if (stealth.modifier != null) hideResult.modifier = stealth.modifier;
    if (readyFired) hideResult.readyFired = true;
    if (bonusFlag && target.kind === 'enemy') hideResult.bonusIgnored = 'enemy bonus action not charged for Hide in v1 (free)'; 
    return hideResult;
  } catch (e) {
    console.error('[combatMarkerService] HIDE handler failed:', e.message);
    return null;
  }
});

// Finding a hidden creature (audit item 4, 2024 Hide): a Wisdom
// (Perception) check against the hider's stored Stealth total — the
// searcher's rolled total comes in as Perception= (from a
// ROLL_REQUEST the DM ran first), otherwise the system rolls.
// Success finds the hider and hidden clears for everyone: the book
// makes hidden global, so one finder finds them, period.
registerMarkerHandler('SEARCH', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const searcherRaw = String(parsed?.Searcher || '').trim();
    const targetRaw = String(parsed?.Target || '').trim();
    if (!searcherRaw) return { type: 'search', success: false, reason: 'SEARCH needs Searcher=' };
    if (!targetRaw) return { type: 'search', success: false, reason: 'SEARCH needs Target=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'search', success: false, reason: 'no active encounter' };
    const searcher = await resolveActionTarget(context, encounterSeq, searcherRaw);
    if (!searcher) return { type: 'search', success: false, reason: `unknown searcher: ${searcherRaw}` };
    // Combat item 8: searching is an action; an incapacitated
    // searcher cannot take it.
    if (await hasIncapacitatingCondition(searcher.kind, searcher.id)) return { type: 'search', success: false, reason: `${searcher.name} is incapacitated and cannot take actions` };
    const target = await resolveActionTarget(context, encounterSeq, targetRaw);
    if (!target) return { type: 'search', success: false, reason: `unknown target: ${targetRaw}` };
    if (searcher.key === target.key) return { type: 'search', success: false, reason: 'a searcher cannot search for themself' };
    // Searching is an action: the SEARCHER's turn is gated (enemies
    // are DM-governed per Q2, so gateActionTarget skips them).
    const gateErr = await gateActionTarget(context, encounterSeq, searcher);
    if (gateErr) return { type: 'search', success: false, reason: gateErr };
    const entry = await getEntry(context.sessionId, encounterSeq, target.key);
    if (!entry.hidden) return { type: 'search', success: false, reason: `${target.name} is not hidden` };
    // A total-less hidden (pre-v2 state) falls back to the hide DC.
    const dc = Number.isFinite(entry.hidden?.total) ? entry.hidden.total : 15;
    const check = await resolveCheckTotal(context, searcher, 'Perception', dc, Number(parsed?.Perception), Number(parsed?.PerceptionDie));
    if (!check.passed) {
      const reason = check.die === 1
        ? `${searcher.name} rolled a natural 1 — ${target.name} stays hidden`
        : `${searcher.name} failed to find ${target.name} (Perception ${check.total} vs Stealth ${dc})`;
      const failResult = { type: 'search', success: false, searcher: searcher.name, target: target.name, perceptionTotal: check.total, stealthTotal: dc, reason };
      if (check.die != null) failResult.die = check.die;
      if (check.modifier != null) failResult.modifier = check.modifier;
      return failResult;
    }
    await clearField(context.sessionId, encounterSeq, target.key, 'hidden');
    const foundResult = { type: 'search', success: true, found: true, searcher: searcher.name, target: target.name, perceptionTotal: check.total, stealthTotal: dc };
    if (check.die != null) foundResult.die = check.die;
    if (check.modifier != null) foundResult.modifier = check.modifier;
    return foundResult;
  } catch (e) {
    console.error('[combatMarkerService] SEARCH handler failed:', e.message);
    return null;
  }
});

// Fire a readied action (audit item 3): the stored ready + an
// available reaction are required, and the reaction is spent here,
// before any other gate — the same shape as a readied attack firing
// in partyAttackService. No stored ready, or no reaction left, is a
// named refusal and nothing is spent. The stored Action text is NOT
// matched (the DM attests the circumstance, as with Bonus="true");
// readied spells match strictly on the held spell instead, because
// slots are at stake.
async function fireReadiedAction(context, encounterSeq, actor) {
  const entry = await getEntry(context.sessionId, encounterSeq, actor.key);
  if (!entry.ready) return `no readied action stored for ${actor.name}`;
  const st = await getTurnState(context.sessionId, encounterSeq);
  if (st) {
    if (!(await hasReactionAvailable(context.sessionId, encounterSeq, actor.name))) return 'reaction already used';
    await useReaction(context.sessionId, encounterSeq, actor.name);
  }
  await clearField(context.sessionId, encounterSeq, actor.key, 'ready');
  return null;
}

registerMarkerHandler('READY', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    const action = String(parsed?.Action || '').trim();
    const trigger = String(parsed?.Trigger || '').trim();
    if (!targetRaw || !action || !trigger) return { type: 'ready', success: false, reason: 'READY needs Target=, Action=, and Trigger=' };
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'ready', success: false, reason: 'no active encounter' };
    const target = await resolveActionTarget(context, encounterSeq, targetRaw);
    if (!target) return { type: 'ready', success: false, reason: `unknown target: ${targetRaw}` };
    // Combat item 8: incapacitated creatures cannot take actions
    // (Ready itself is an action, and firing it costs a reaction).
    if (await hasIncapacitatingCondition(target.kind, target.id)) return { type: 'ready', success: false, reason: `${target.name} is incapacitated and cannot take actions` };
    const gateErr = await gateActionTarget(context, encounterSeq, target);
    if (gateErr) return { type: 'ready', success: false, reason: gateErr };
    const spellRaw = String(parsed?.Spell || '').trim();
    if (spellRaw) {
      // A readied spell: enemies have no spellcasting path, so only
      // party members can hold one. The slot is spent now and the
      // spell is held with concentration until released or lost.
      if (target.kind === 'enemy') return { type: 'ready', success: false, reason: 'enemy spellcasting has no engine path yet — enemies cannot ready spells' };
      const { holdSpellSlot } = await import('./spellCastService.js');
      const held = await holdSpellSlot({ characterId: context.characterId, casterName: target.kind === 'player' ? null : target.name, spellName: spellRaw, level: parsed?.Level != null ? Number(parsed.Level) : null });
      if (!held.success) return { type: 'ready', success: false, reason: held.reason };
      await setField(context.sessionId, encounterSeq, target.key, 'ready', { action, trigger, until: await untilFor(context.sessionId, encounterSeq, target.key), heldSpell: { spell: held.spell, level: held.level } });
      return { type: 'ready', success: true, target: target.name, action, trigger, heldSpell: held.spell, heldLevel: held.level, slotConsumed: held.slotConsumed, ...(held.replacedConcentration ? { replacedConcentration: held.replacedConcentration } : {}) };
    }
    await setField(context.sessionId, encounterSeq, target.key, 'ready', { action, trigger, until: await untilFor(context.sessionId, encounterSeq, target.key) });
    return { type: 'ready', success: true, target: target.name, action, trigger };
  } catch (e) {
    console.error('[combatMarkerService] READY handler failed:', e.message);
    return null;
  }
});

/**
 * SET_COVER handler (Combat Pipeline #6), Phase B Feature= validation
 * (ruled 2026-10-29: cover must actually exist in the room where the
 * fight is happening, and a failed check must surface, never silently).
 * [SET_COVER: Target="Goblin" Cover="half" Feature="Toppled pillar"]
 * Valid: none, half, three-quarters, full. D&D 2024: +2/+5 AC.
 *
 * Enforcement, in order:
 *   - Cover="none" clears cover and needs no feature (it grants nothing).
 *   - When the encounter is linked to a scene room (migration 089,
 *     setEncounterRoom), the named feature MUST be in that room's
 *     stored feature list with the matching cover tier. A missing,
 *     non-cover, or wrong-tier feature returns success:false with a
 *     systemNote and writes NOTHING — the route pushes that note into
 *     the DM's context so the DM/player learn to move, instead of the
 *     cover silently landing. No Feature at all in a linked room is
 *     the same failure, with the room's real cover features listed.
 *   - When NO room is linked, there is no feature list to check
 *     against (a fight outside a scene room), so the pre-Phase-B grant
 *     stands, marked featureVerified:false. That is the legacy path,
 *     not a scene validation — scene entry still has to link the room
 *     for validation to bite in a dungeon fight (see setEncounterRoom).
 *   - Tier mismatch does NOT auto-grant the feature's tier: the DM
 *     asked for a tier that is not there, so nothing is granted and
 *     the note says what the feature actually gives.
 */
registerMarkerHandler('SET_COVER', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const target = parsed?.Target;
    const cover = (parsed?.Cover || 'none').toLowerCase();
    const feature = parsed?.Feature ? String(parsed.Feature).trim() : '';
    if (!target) return null;
    const valid = ['none', 'half', 'three-quarters', 'three_quarters', 'full'];
    if (!valid.includes(cover)) return null;
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return null;
    const enemy = await findActiveEnemy(context.sessionId, encounterSeq, target);
    // Party targets (combat-real B2): cover lives in the encounter's
    // turn state and resolveEnemyAttack reads it via resolvePartyTarget.
    const partyTarget = enemy ? null : await resolvePartyTarget(context, encounterSeq, target);
    if (!enemy && !partyTarget) return null;
    const resolvedName = enemy ? enemy.name : partyTarget.name;
    const resolvedKind = enemy ? 'enemy' : partyTarget.type;

    // Validation (granting cover only): Cover="none" clears, never grants.
    let featureVerified = false;
    if (cover !== 'none') {
      const { getEncounterRoom, validateCoverFeature, coverFeatureNames } =
        await import('./dungeonSceneStorageService.js');
      const room = await getEncounterRoom(context.sessionId, encounterSeq).catch(() => null);
      if (room) {
        const coverNames = coverFeatureNames(room.features);
        const coverList = coverNames.length > 0
          ? coverNames.map(n => `"${n}"`).join(', ')
          : 'none — there is no cover feature in this room';
        if (!feature) {
          return {
            type: 'set_cover', success: false, reason: 'feature_required_in_scene',
            target: resolvedName, targetKind: resolvedKind, cover, roomKey: room.roomKey,
            availableCoverFeatures: coverNames,
            systemNote: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Cover NOT granted to ${resolvedName}: this fight is in room ${room.roomKey}, and cover must come from a feature in that room. Available cover here: ${coverList}. Re-emit SET_COVER with Feature="<name>" and the matching Cover tier, or narrate that no cover is available and ${resolvedName} must move to find cover.`,
          };
        }
        const check = validateCoverFeature(room.features, { feature, cover });
        if (check.valid) featureVerified = true;
        if (!check.valid) {
          let why;
          if (check.reason === 'feature_not_found') {
            why = `there is no feature named "${feature}" in room ${room.roomKey}. Available cover here: ${coverList}.`;
          } else if (check.reason === 'feature_not_cover') {
            why = `"${feature}" exists in room ${room.roomKey} but provides no cover. Available cover here: ${coverList}.`;
          } else {
            why = `"${feature}" in room ${room.roomKey} gives ${check.coverTier} cover, not ${cover}. Grant only what the feature actually gives, or move to different cover.`;
          }
          return {
            type: 'set_cover', success: false, reason: check.reason,
            target: resolvedName, targetKind: resolvedKind, cover, feature, roomKey: room.roomKey,
            availableCoverFeatures: coverNames,
            systemNote: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Cover NOT granted to ${resolvedName}: ${why} Tell the player plainly that the cover is not there, so they know to move.`,
          };
        }
      }
    }

    if (enemy) {
      await dbRun('UPDATE combat_enemies SET cover = ? WHERE id = ?', [cover, enemy.id]);
      return { type: 'set_cover', success: true, target: enemy.name, targetKind: 'enemy', cover, acBonus: getCoverAcBonus(cover), feature: feature || null, featureVerified };
    }
    await setPartyCover(context.sessionId, encounterSeq, partyTarget.name, cover);
    return { type: 'set_cover', success: true, target: partyTarget.name, targetKind: partyTarget.type, cover, acBonus: getCoverAcBonus(cover), feature: feature || null, featureVerified };
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
    // Lair hazard auto-roll (2026-11-04): only real hazard outcomes
    // reach the DM note — a strike, a telegraph, or a precursor.
    // Skips (no linked room, no lair) stay in the returned
    // lairHazard object for diagnostics and are not narrated every
    // round, or every unlinked fight would spam the note. The
    // struck/telegraphed detail is DM-facing narration fuel, not
    // player text: the DM adjudicates what the party sees.
    const lairHazard = newState.lairHazard || null;
    let systemNote = `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Turn advanced. It is now ${newState.currentTurn?.name}'s turn (Round ${newState.round}).`;
    if (lairHazard?.struck?.hazard) {
      const h = lairHazard.struck.hazard;
      const caught = (lairHazard.struck.results || []).filter((r) => !r.avoided && !r.skipped).map((r) => `${r.name} (${r.damageTaken})`).join(', ');
      systemNote += `\n[LAIR HAZARD] ${h.feature} (${h.severity}, ${h.type}) struck: ${caught || 'everyone avoided it'}.`;
    } else if (lairHazard?.telegraphed) {
      const t = lairHazard.telegraphed;
      systemNote += `\n[LAIR HAZARD TELEGRAPH] ${t.feature} (${t.severity}, ${t.type}) is about to strike — it lands on the next round's tick unless the party moves, stabilizes, or leaves.`;
    } else if (lairHazard?.hazard?.precursor) {
      systemNote += `\n[LAIR HAZARD PRECURSOR] ${lairHazard.hazard.feature}: ${lairHazard.hazard.note}`;
    }
    // Mechanics hooks (M13): turn-start subclass effects ride newState.
    if (newState.turnStartHeal) {
      const h = newState.turnStartHeal; // { applied, kind, actor, amount, currentHp, maxHp, newHp, feature: 'Survivor' }
      systemNote += `\n[SURVIVOR] ${h.actor} regains ${h.amount} HP at the start of their turn.`;
    }
    if (newState.turnStartGrants?.length) {
      for (const g of newState.turnStartGrants) { // { feature: 'Heroic Warrior', actor, kind, granted: 'Heroic Inspiration' }
        systemNote += `\n[${g.feature.toUpperCase()}] ${g.actor} gains ${g.granted}.`;
      }
    }
    if (newState.turnStartSurge?.length) { // string[]
      for (const n of newState.turnStartSurge) systemNote += `\n[WILD MAGIC] ${n}`;
    }
    return {
      type: 'turn_advance',
      currentTurn: newState.currentTurn,
      round: newState.round,
      lairHazard,
      systemNote
    };
  } catch (e) {
    console.error('[combatMarkerService] TURN_ADVANCE handler failed:', e.message);
    return null;
  }
});
