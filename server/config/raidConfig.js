/**
 * Raid Configuration (F3)
 *
 * Which world events generate raids against bases, how strong those raids
 * are, and how much warning the player gets. Per the design: frequency
 * is driven by active, contextual hostility — a bandit region prompts
 * bandit raids on border outposts, a war front prompts army raids, an
 * undead uprising prompts horde raids. Bases with no nearby hostility
 * sit in peace.
 *
 * Dire wolves and similar stateless monsters are deliberately NOT raid-
 * capable — they don't have the planning to coordinate attacks.
 */

// Event types (from world_events.event_type) that can spawn raids.
// Mapped to an attacker "category" for notoriety / narrative attribution
// and a force-rating range for auto-resolution math.
export const RAID_CAPABLE_EVENTS = {
  bandit_activity: {
    category: 'criminal',
    sourceLabel: 'Bandit Raiders',
    forceRange: [4, 10],
    warningDays: [3, 7],            // lead time before attack
    targetPreferences: ['outpost', 'watchtower', 'tavern', 'hall'],
    // Only roll if this event is active AND a base is nearby
    perTickProbability: 0.06
  },
  war: {
    category: 'military',
    sourceLabel: 'Enemy Soldiers',
    forceRange: [10, 20],
    warningDays: [5, 10],
    targetPreferences: ['keep', 'fortress', 'manor', 'castle'],
    perTickProbability: 0.08
  },
  undead_uprising: {
    category: 'religious',
    sourceLabel: 'Restless Dead',
    forceRange: [8, 16],
    warningDays: [2, 5],
    targetPreferences: ['chapel', 'temple', 'sanctuary', 'watchtower', 'outpost'],
    perTickProbability: 0.07
  },
  mercenary_incursion: {
    category: 'military',
    sourceLabel: 'Mercenary Company',
    forceRange: [8, 14],
    warningDays: [4, 8],
    targetPreferences: ['keep', 'fortress', 'manor'],
    perTickProbability: 0.05
  },
  cult_activity: {
    category: 'religious',
    sourceLabel: 'Cultists',
    forceRange: [6, 12],
    warningDays: [3, 7],
    targetPreferences: ['chapel', 'temple', 'sanctuary', 'wizard_tower'],
    perTickProbability: 0.05
  }
};

/**
 * A threat upgrades from 'raid' to 'siege' when the attacker force exceeds
 * the combined defense+garrison of a sizable base. Sieges have longer
 * warning windows, higher stakes, and can culminate in capture rather than
 * damage.
 */
export const SIEGE_FORCE_THRESHOLD = 15;

/**
 * Probability multipliers applied to the base per-tick probability when
 * the target base is particularly vulnerable. Keeps the game from raining
 * raids on well-defended fortresses and instead concentrates pressure on
 * exposed outposts — which matches how enemies actually behave.
 */
export const VULNERABILITY_MULTIPLIERS = {
  lowDefense: 1.5,     // defense_rating < 5
  isolatedSubtype: 2.0, // watchtower, outpost (no support network)
  abandonedBuildings: 1.2,  // has damaged buildings from a previous attack
  noGarrison: 1.3      // garrison_strength === 0
};

/**
 * How many days a captured base stays "capturable" before flipping to
 * permanently abandoned. Per user direction.
 */
export const RECAPTURE_WINDOW_DAYS = 14;

/**
 * Random within an inclusive range.
 */
export function rollInRange([lo, hi]) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/**
 * Pick a raid-capable event config by event_type, or null if not
 * raid-capable.
 */
export function getRaidConfigForEvent(eventType) {
  return RAID_CAPABLE_EVENTS[eventType] || null;
}

/**
 * Compute per-tick raid probability for this (event, base) pairing.
 * Accounts for target preference and vulnerability. Returns 0 if the
 * base's subtype isn't in the event's preferred target list (so a
 * fortress isn't raided by bandits) unless the base is the ONLY option
 * in the region.
 */
export function computeRaidProbability(eventConfig, base, { onlyBaseInRegion = false } = {}) {
  if (!eventConfig || !base) return 0;
  const prefs = eventConfig.targetPreferences || [];
  const matches = prefs.includes(base.subtype);
  if (!matches && !onlyBaseInRegion) return 0;

  let p = eventConfig.perTickProbability;
  if ((base.defense_rating || 0) < 5) p *= VULNERABILITY_MULTIPLIERS.lowDefense;
  if (['watchtower', 'outpost'].includes(base.subtype)) p *= VULNERABILITY_MULTIPLIERS.isolatedSubtype;
  if ((base.garrison_strength || 0) === 0) p *= VULNERABILITY_MULTIPLIERS.noGarrison;
  return Math.min(p, 0.35); // hard cap per tick — raids should never feel inevitable
}
