/**
 * Feature Flags — MVP scale-back switches.
 *
 * Phase 1.2 of the "scale back to scale up" refactor bypasses the world
 * simulation so the core narrative loop can be stabilised against a static
 * world. Nothing here deletes a subsystem: every flag gates an *invocation*,
 * and the services behind them remain intact, tested, and re-enabled by
 * flipping a single value.
 *
 * Read flags at call time, never destructure them into a module-level constant
 * at import time — the env override below is what lets tests and a future
 * re-enable work without a code change.
 *
 * Env overrides use the FF_ prefix and are string-compared, so:
 *   FF_LIVING_WORLD_TICK=true npm run server   → tick back on
 *   FF_NPC_DEATH_SYNC=false  npm run server    → reconciler off
 */

/**
 * Resolve one flag: an unset env var yields the built-in default, and any value
 * other than the literal string "false" enables it.
 */
const flag = (name, fallback) =>
  process.env[name] === undefined ? fallback : process.env[name] !== 'false';

export const FEATURE_FLAGS = {
  /**
   * The whole living-world tick: faction goals, world events, NPC mail, base
   * income, notoriety decay, merchant order fulfilment, base threats.
   * OFF for MVP — the world is deliberately static.
   */
  get LIVING_WORLD_TICK() {
    return flag('FF_LIVING_WORLD_TICK', false);
  },

  /** NPC absence/aging effects applied at session start. */
  get NPC_AGING() {
    return flag('FF_NPC_AGING', false);
  },

  /** Companion mood decay applied at session start. */
  get COMPANION_MOOD_DECAY() {
    return flag('FF_COMPANION_MOOD_DECAY', false);
  },

  /**
   * Survival day-change effects (food spoilage, exhaustion application).
   * Note this does NOT freeze hunger/thirst: those are derived from game_day at
   * read time, so they keep advancing regardless of this flag.
   */
  get SURVIVAL_DAY_CHANGE() {
    return flag('FF_SURVIVAL_DAY_CHANGE', false);
  },

  /**
   * Player actions that queue a resolution the tick would later deliver:
   * companion away-activities, merchant commissions, fortress threats.
   *
   * Bound to the tick on purpose. With the tick off these never resolve, so a
   * companion sent away never returns and a commissioned item never arrives —
   * a soft-lock rather than a paused system. Keeping them off while the world
   * is static is what makes the scale-back safe.
   */
  get DEFERRED_RESOLUTION_ACTIONS() {
    return flag('FF_DEFERRED_RESOLUTION_ACTIONS', false);
  },

  /**
   * Automatic progression side effects that fire without the player asking:
   * the MYTHIC_TRIAL marker auto-advancing mythic tier mid-turn, and XP
   * granted by quest/achievement reward application.
   *
   * OFF for MVP. Note this gates the XP branch only — gold and item rewards
   * still apply, because suppressing those would remove earned loot rather
   * than pause progression.
   *
   * Deliberately does NOT gate canLevelUp or the level-up endpoint: those are
   * explicit player-initiated actions in routes/character.js that never run on
   * the turn or session path, so gating them would break the level-up UI for
   * no stability benefit.
   */
  get PROGRESSION_AWARDS() {
    return flag('FF_PROGRESSION_AWARDS', false);
  },

  /**
   * Snapshot the database to backups/ after each session ends.
   *
   * ON: an indefinite campaign is an irreplaceable artifact, and this is the
   * only automatic protection it has. Runs fire-and-forget after the response,
   * so it never delays session end. Retention is handled in the backup script.
   */
  get SESSION_END_BACKUP() {
    return flag('FF_SESSION_END_BACKUP', true);
  },

  /**
   * Reconciles canon-fact deaths into NPC lifecycle state at session start.
   * ON: this is a consistency reconciler, not simulation. Disabling it lets an
   * NPC the chronicle records as dead walk back into the DM prompt alive.
   */
  get NPC_DEATH_SYNC() {
    return flag('FF_NPC_DEATH_SYNC', true);
  },
};

export default FEATURE_FLAGS;
