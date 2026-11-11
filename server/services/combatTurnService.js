/**
 * Combat Turn Service (Combat Pipeline #2).
 * Server-side turn order tracking. The DB is the source of truth for whose turn it is.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';

export async function initializeTurnOrder(sessionId, encounterSeq, turnOrder) {
  const orderJson = JSON.stringify(turnOrder);
  await dbRun(
    `INSERT INTO combat_turn_state (session_id, encounter_seq, turn_order_json, current_index, round_number, turn_budget_json, action_state_json)
     VALUES (?, ?, ?, 0, 1, '{}', '{}')
     ON CONFLICT(session_id, encounter_seq) DO UPDATE SET
       turn_order_json = excluded.turn_order_json, current_index = 0, round_number = 1, turn_budget_json = '{}', action_state_json = '{}', updated_at = CURRENT_TIMESTAMP`,
    [sessionId, encounterSeq, orderJson]
  );
  return getTurnState(sessionId, encounterSeq);
}

export async function getTurnState(sessionId, encounterSeq) {
  const row = await dbGet('SELECT * FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
  if (!row) return null;
  const order = safeParse(row.turn_order_json, []);
  return { turnOrder: order, currentIndex: row.current_index, currentTurn: order[row.current_index] || null, round: row.round_number, totalCombatants: order.length };
}

export async function advanceTurn(sessionId, encounterSeq) {
  const state = await getTurnState(sessionId, encounterSeq);
  if (!state) return null;
  let nextIndex = state.currentIndex + 1;
  let nextRound = state.round;
  if (nextIndex >= state.totalCombatants) { nextIndex = 0; nextRound += 1; }
  await dbRun('UPDATE combat_turn_state SET current_index = ?, round_number = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND encounter_seq = ?', [nextIndex, nextRound, sessionId, encounterSeq]);
  // Combat Pipeline #5: Reset the incoming combatant's reaction (D&D 2024: refreshes at start of your turn)
  const newState = await getTurnState(sessionId, encounterSeq);
  if (newState?.currentTurn?.name) {
    try {
      const { resetReaction } = await import('./reactionService.js');
      await resetReaction(sessionId, encounterSeq, newState.currentTurn.name);
    } catch (e) { /* best-effort */ }
  }
  // Combat item 1: Slow expiry — a Slow penalty ends at the start of
  // its slower's next turn, which is exactly when the order lands on
  // them. Dynamic import, same pattern as the reaction reset above:
  // partyAttackService owns the slowed state, and this module must not
  // statically import the attack path. Expiry never breaks a turn.
  if (newState) {
    try {
      const { expireSlowedOnTurn } = await import('./partyAttackService.js');
      await expireSlowedOnTurn(sessionId, newState.round, newState.currentIndex);
    } catch (e) { /* best-effort */ }
  }
  // Mechanics hooks, Family 4: Survivor turn-start heal (Champion
  // 18). Fires for the INCOMING combatant, in the same best-effort
  // dynamic-import chain as Slow expiry above: partyAttackService
  // owns the heal (it holds the subclass read + the HP writes), and
  // this module must not statically import the attack path. A hook
  // failure never breaks the turn. The heal rides on the returned
  // state (turnStartHeal) for the TURN_ADVANCE handler to narrate;
  // the dmSession patch for that is in HANDOFF.md.
  if (newState?.currentTurn) {
    try {
      const { applySurvivorHealAtTurnStart } = await import('./partyAttackService.js');
      const healed = await applySurvivorHealAtTurnStart(sessionId, encounterSeq, newState.currentTurn);
      if (healed) newState.turnStartHeal = healed;
    } catch (e) { /* best-effort */ }
  }
  // Mechanics hooks, Family 6 (D4 Heroic Warrior): a Champion fighter
  // of 10th level or higher starts each of their turns holding Heroic
  // Inspiration (max 1; granting while held is a no-op). Same
  // best-effort pattern as Survivor above; a grant failure never
  // breaks the turn. The grant rides on the returned state so the
  // TURN_ADVANCE handler can narrate it (see MERGE-NOTES.md).
  if (newState?.currentTurn) {
    try {
      const { hasSubclassFeature } = await import('./subclassService.js');
      const { grantHeroicInspiration } = await import('./rollRequestService.js');
      const t = newState.currentTurn;
      if (t.type === 'player' || t.type === 'companion') {
        const sess = await dbGet('SELECT character_id FROM dm_sessions WHERE id = ?', [sessionId]);
        let row = null;
        if (t.type === 'player' && sess?.character_id) {
          row = await dbGet('SELECT * FROM characters WHERE id = ?', [sess.character_id]);
        } else if (t.type === 'companion' && sess?.character_id) {
          row = await dbGet(
            'SELECT c.* FROM companions c LEFT JOIN npcs n ON n.id = c.npc_id WHERE c.recruited_by_character_id = ? AND LOWER(n.name) = LOWER(?)',
            [sess.character_id, t.name],
          );
        }
        if (row) {
          const actor = t.type === 'player'
            ? { className: row.class, subclassName: row.subclass, level: row.level, class_levels: safeParse(row.class_levels, null) }
            : { className: row.companion_class, subclassName: row.companion_subclass, level: row.companion_level, class_levels: safeParse(row.companion_class_levels, null) };
          if (hasSubclassFeature(actor, 'heroic_warrior')) {
            const g = await grantHeroicInspiration(t.type, row.id);
            if (g?.success && !g.alreadyHeld) {
              newState.turnStartGrants = [{ feature: 'Heroic Warrior', actor: t.name, kind: t.type, granted: 'Heroic Inspiration' }];
            }
          }
        }
      }
    } catch (e) { /* best-effort */ }
  }
  // Mechanics hooks, Family 5 (Wild Magic turn-start rows): the rows
  // whose engine fires at the START of the caster's turn — Roll Again
  // re-roll (01–04), Regeneration heal 5 (09–12), Potted Plant revert
  // at 0 HP / turn start (37–40), Astral Jaunt return (25–28). All
  // best-effort; a hook failure never breaks the turn. Extra Action
  // (53–56, ledger grant), Blinding Light proximity (81–84) and
  // Invisibility end-on-action (45–48) need consumers that do not
  // exist yet — recorded in MERGE-NOTES.md, not faked here.
  if (newState?.currentTurn) {
    try {
      const t = newState.currentTurn;
      if (t.type === 'player' || t.type === 'companion') {
        const sess = await dbGet('SELECT character_id, session_config FROM dm_sessions WHERE id = ?', [sessionId]);
        let row = null;
        if (t.type === 'player' && sess?.character_id) {
          row = await dbGet('SELECT * FROM characters WHERE id = ?', [sess.character_id]);
        } else if (t.type === 'companion' && sess?.character_id) {
          row = await dbGet(
            'SELECT c.* FROM companions c LEFT JOIN npcs n ON n.id = c.npc_id WHERE c.recruited_by_character_id = ? AND LOWER(n.name) = LOWER(?)',
            [sess.character_id, t.name],
          );
        }
        if (row) {
          const cfg = safeParse(sess?.session_config, {}) || {};
          const actorKey = `${t.type}:${row.id}`;
          const { surgeStateFor, rollSurgeTable, applySurgeRow, clearTransformedForm, clearRemovedFromCombat } = await import('./wildMagicService.js');
          const { hasTimedEffect, clearTimedEffect } = await import('./durationTrackerService.js');
          const st = surgeStateFor(cfg, actorKey);
          const notes = [];
          // Roll Again: re-roll the table; the new row applies at once.
          if (hasTimedEffect(cfg, actorKey, 'wild_magic_roll_again')) {
            const actor = t.type === 'player'
              ? { className: row.class, subclassName: row.subclass, level: row.level, kind: 'player', id: row.id }
              : { className: row.companion_class, subclassName: row.companion_subclass, level: row.companion_level, kind: 'companion', id: row.id };
            const { row: surgeRow } = rollSurgeTable(actor);
            if (surgeRow) {
              await applySurgeRow(actor, surgeRow, { sessionId, sessionConfig: cfg, encounterSeq });
              notes.push(`Wild Magic (Roll Again): re-rolled ${surgeRow.range} ${surgeRow.name}.`);
            }
            clearTimedEffect(cfg, actorKey, 'wild_magic_roll_again');
          }
          // Regeneration: 5 HP at the start of each of the caster's turns.
          if (hasTimedEffect(cfg, actorKey, 'wild_magic_regeneration')) {
            const { applyHpChange } = await import('./characterHpService.js');
            const res = t.type === 'player'
              ? await applyHpChange(row.id, 5, 'Wild Magic (Regeneration): turn-start heal')
              : null;
            if (t.type === 'companion') {
              await dbRun('UPDATE companions SET companion_current_hp = MIN(companion_max_hp, companion_current_hp + 5) WHERE id = ?', [row.id]);
            }
            if (t.type === 'player' ? res?.applied !== false : true) notes.push('Wild Magic (Regeneration): regains 5 HP.');
          }
          // Potted Plant: the form ends at the start of the caster's next
          // turn (and at 0 HP — the damage path owns that half, see
          // MERGE-NOTES.md). Incapacitated lifts with the form.
          if (st.transformedForm?.kind === 'goat' && hasTimedEffect(cfg, actorKey, 'wild_magic_potted_plant')) {
            clearTransformedForm(cfg, actorKey);
            clearTimedEffect(cfg, actorKey, 'wild_magic_potted_plant');
            try {
              const { removeCondition } = await import('./conditionService.js');
              await removeCondition(t.type, row.id, 'incapacitated');
            } catch { /* condition lift is best-effort */ }
            notes.push('Wild Magic (Potted Plant): the plant form ends; the caster is themself again.');
          }
          // Astral Jaunt: the caster returns to combat.
          if (st.removedFromCombat?.kind === 'astral_jaunt' || (st.removedFromCombat && hasTimedEffect(cfg, actorKey, 'wild_magic_astral_jaunt'))) {
            clearRemovedFromCombat(cfg, actorKey);
            clearTimedEffect(cfg, actorKey, 'wild_magic_astral_jaunt');
            notes.push('Wild Magic (Astral Jaunt): the caster returns to the fight.');
          }
          if (notes.length) {
            newState.turnStartSurge = notes;
            await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
          }
        }
      }
    } catch (e) { /* best-effort */ }
  }
  // Combat item 5: legendary budget reset — a legendary creature's
  // actions refresh at the start of its own turn (D&D 2024). Same
  // best-effort dynamic-import pattern as the neighbors; the max
  // is preserved across resets (lair boosts persist).
  if (newState?.currentTurn?.type === 'enemy' && newState.currentTurn.key) {
    try {
      const { resetLegendaryForTurn } = await import('./enemyEconomyService.js');
      await resetLegendaryForTurn(sessionId, encounterSeq, newState.currentTurn.key);
    } catch (e) { /* best-effort */ }
  }
  // Combat item 6: spell repeat saves + duration ticks fire for the
  // OUTGOING combatant (state.currentTurn is the pre-update turn).
  // Same best-effort dynamic-import pattern as the neighbors; the
  // boundary never breaks a turn.
  try {
    const { processTurnBoundary } = await import('./enemySpellService.js');
    await processTurnBoundary(sessionId, encounterSeq, state.currentTurn, newState.currentTurn);
  } catch (e) { /* best-effort */ }
  // Lair hazard auto-roll (2026-11-04): on a ROUND boundary only —
  // not every turn — the encounter's linked lair takes its durability
  // tick, and a damaged lair may throw exactly one hazard. The result
  // rides on the returned state for the TURN_ADVANCE handler to
  // narrate; a hazard failure never breaks a turn, and an encounter
  // with no linked room or no lair simply reports a skip.
  if (newState && newState.round > state.round) {
    try {
      const { runEncounterLairTick } = await import('./lairDurabilityService.js');
      newState.lairHazard = await runEncounterLairTick(sessionId, encounterSeq);
    } catch (e) { /* best-effort */ }
  }
  return newState;
}

export async function getCurrentTurn(sessionId, encounterSeq) {
  const state = await getTurnState(sessionId, encounterSeq);
  return state?.currentTurn || null;
}

/**
 * Party cover (combat-real B2): SET_COVER for party members lives in
 * combat_turn_state.party_cover_json (migration 084) — encounter state
 * beside the morale buff, keyed by lowercased actor name.
 */
export async function getPartyCover(sessionId, encounterSeq, actorName) {
  try {
    const row = await dbGet('SELECT party_cover_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
    const map = safeParse(row?.party_cover_json, {});
    return map[String(actorName || '').toLowerCase()] || null;
  } catch { return null; }
}

export async function setPartyCover(sessionId, encounterSeq, actorName, cover) {
  const row = await dbGet('SELECT party_cover_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, encounterSeq]);
  const map = safeParse(row?.party_cover_json, {}) || {};
  const key = String(actorName || '').toLowerCase();
  if (!cover || cover === 'none') delete map[key]; else map[key] = cover;
  await dbRun('UPDATE combat_turn_state SET party_cover_json = ? WHERE session_id = ? AND encounter_seq = ?', [JSON.stringify(map), sessionId, encounterSeq]);
  return map[key] || 'none';
}

export default { initializeTurnOrder, getTurnState, advanceTurn, getCurrentTurn, getPartyCover, setPartyCover };
