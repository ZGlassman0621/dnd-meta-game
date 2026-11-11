/**
 * sceneSeedService — the system-rolled seed packet for a scene
 * (Dungeon generation + scene layer, Phase A).
 *
 * A seed packet is everything the skeleton generator needs before any
 * AI dressing exists: who is delving, why, where, and six site dice
 * the SYSTEM rolls (never the model inventing them). The packet is
 * stored on scenes.seed_json so a skeleton can be regenerated and
 * audited against the exact packet that produced it.
 *
 * The six site dice (design doc): original function, builder, fall,
 * occupant, twist, hazard family. Each is a small curated table —
 * Phase B/C may grow them; the shape (one pick per die) is stable.
 */

import { pick } from '../utils/rng.js';

export const SITE_DICE = {
  originalFunction: [
    'temple', 'fortress', 'mine', 'tomb', 'prison', 'workshop',
    'sanctuary', 'archive', 'smugglers den', 'watchtower',
  ],
  builder: [
    'dwarves', 'elves', 'humans', 'goblins', 'a cult', 'a wizard',
    'a dragon cult', 'duergar', 'drow', 'an unknown empire',
  ],
  fall: [
    'war', 'plague', 'betrayal', 'a curse', 'flooding', 'abandonment',
    'a siege', 'a magical disaster', 'a schism', 'a dragon',
  ],
  occupant: [
    'goblins', 'orcs', 'kobolds', 'cultists', 'undead', 'bandits',
    'beasts', 'constructs', 'a dragon', 'nothing living',
  ],
  twist: [
    'a hidden heir', 'a sealed curse', 'a sleeping power',
    'a second entrance', 'a traitor among the builders',
    'a treasure that is not what it seems', 'a rival expedition',
    'a portal that should not be open', 'a false history',
    'a guardian that remembers the builders',
  ],
  hazardFamily: [
    'water', 'fire', 'collapse', 'poison', 'cold', 'darkness',
    'vermin', 'machinery', 'magic residue', 'heights',
  ],
};

/**
 * Roll one value from each site die. Pure in shape: the caller may
 * pass a custom pick function (tests pin outcomes by passing a
 * deterministic picker); production passes rng.pick.
 */
export function rollSiteDice(pickFn = pick) {
  const dice = {};
  for (const [die, table] of Object.entries(SITE_DICE)) {
    dice[die] = pickFn(table);
  }
  return dice;
}

/**
 * Build a seed packet. partyLevel/partySize feed the DMG encounter
 * budget bands the validator checks; purpose is the quest/faction
 * hook the site hangs from; region is the setting profile
 * (allow/ban lists are Phase B content rules, not Phase A).
 */
export function buildSeedPacket({
  partyLevel = 1,
  partySize = 4,
  purpose = null,
  region = null,
  pickFn,
} = {}) {
  return {
    party: { level: partyLevel, size: partySize },
    purpose,
    region,
    siteDice: rollSiteDice(pickFn),
    generatedAt: new Date().toISOString(),
  };
}
