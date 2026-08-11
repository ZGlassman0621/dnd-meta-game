/**
 * Feature Flags — MVP switches.
 *
 * The MVP is narrative-first: dialogue, exploration, persistent progression,
 * and hybrid combat where the server tracks HP/AC/death and the player rolls
 * their own dice. Complex simulation — living world, economy, aging — is
 * deferred to Phase 2 and is switched off here.
 *
 * Nothing here deletes a subsystem: every flag gates an *invocation*, and the
 * services behind them remain intact, tested, and re-enabled by flipping a
 * single value.
 *
 * MVP posture:
 *   ON   PROGRESSION_AWARDS, NPC_DEATH_SYNC, SESSION_END_BACKUP
 *   OFF  LIVING_WORLD_TICK, NPC_AGING, COMPANION_MOOD_DECAY,
 *        SURVIVAL_DAY_CHANGE, DEFERRED_RESOLUTION_ACTIONS
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
   *
   * OFF for the MVP. The MVP is narrative-first — dialogue, exploration and
   * persistent progression — and complex simulation is deferred to Phase 2.
   * This flag is the single switch for all of it.
   *
   * It was on through Phase 4, which is where the time-driven wiring was built
   * and tested; that work is intact and this is a one-value re-enable. The tick
   * self-guards and returns its full result shape either way, so session end
   * behaves identically with it off.
   */
  get LIVING_WORLD_TICK() {
    return flag('FF_LIVING_WORLD_TICK', false);
  },

  /** NPC absence/aging effects applied at session start. OFF — Phase 2. */
  get NPC_AGING() {
    return flag('FF_NPC_AGING', false);
  },

  /** Companion mood decay applied at session start. OFF — Phase 2. */
  get COMPANION_MOOD_DECAY() {
    return flag('FF_COMPANION_MOOD_DECAY', false);
  },

  /**
   * Survival day-change effects (food spoilage, exhaustion application).
   * OFF — Phase 2.
   *
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
   * OFF — Phase 2, and it MUST stay off while LIVING_WORLD_TICK is off. These
   * actions queue a resolution that only the tick delivers, so with the tick
   * off a companion sent away never returns. That is a soft-lock, not a paused
   * system: the two flags are a pair and have to move together.
   */
  get DEFERRED_RESOLUTION_ACTIONS() {
    return flag('FF_DEFERRED_RESOLUTION_ACTIONS', false);
  },

  /**
   * Automatic progression side effects that fire without the player asking:
   * the MYTHIC_TRIAL marker auto-advancing mythic tier mid-turn, and XP
   * granted by quest/achievement reward application.
   *
   * ON for the MVP. "Persistent progression" is one of the three MVP pillars,
   * and with this off quests and achievements paid gold and items but no XP —
   * the character never advanced from playing. This gates the XP branch only;
   * gold and item rewards always applied.
   *
   * Deliberately does NOT gate canLevelUp or the level-up endpoint: those are
   * explicit player-initiated actions in routes/character.js that never run on
   * the turn or session path, so gating them would break the level-up UI for
   * no stability benefit.
   */
  get PROGRESSION_AWARDS() {
    return flag('FF_PROGRESSION_AWARDS', true);
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
