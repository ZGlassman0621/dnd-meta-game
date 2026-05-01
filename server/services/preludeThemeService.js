/**
 * Prelude theme commitment service (v1.0.77).
 *
 * The theme-commitment ceremony lands at Chapter 3 wrap-up:
 * throughout Ch1-2, character-shaping choices fire [THEME_HINT] markers
 * (via the existing emergence system); Ch3 plays out with real decisions,
 * real combat, and an irreversible-act chapter_end_moment; at that wrap-
 * up, the AI offers the player a set of plausible themes to commit to.
 * The commitment shapes Ch4's departure (soldier → enlistment, acolyte
 * → pilgrimage, etc.) and carries forward as the primary campaign's
 * theme at phase-5 transition.
 *
 * Exports:
 *   buildThemeOffer(characterId)       → { leading, alternatives[], wildcard,
 *                                           reason, trajectoryScores }
 *   commitTheme(characterId, { theme, reason, source })
 *   getCommittedTheme(characterId)     → { theme, committed_at } | null
 *   THEME_DEPARTURE_MAP — theme → departure type lookup (for the Ch4 prompt)
 *
 * Storage:
 *   characters.prelude_committed_theme      TEXT  (nullable)
 *   characters.prelude_committed_theme_at   TEXT  (ISO timestamp, nullable)
 */

import { dbGet, dbRun, dbAll } from '../database.js';
import { getTrajectoryWinner, getValues } from './preludeEmergenceService.js';
import { getPreludeCharacter } from './preludeService.js';

// Canonical theme id list — matches server/data/themes.js. Keep in sync
// if themes are added/removed. Used for validation of committed values
// and for the "Other" dropdown in the UI.
export const ALL_THEME_IDS = [
  'soldier', 'sage', 'criminal', 'acolyte', 'charlatan', 'entertainer',
  'noble', 'outlander', 'sailor', 'far_traveler', 'haunted_one',
  'guild_artisan', 'clan_crafter', 'hermit', 'investigator', 'city_watch',
  'knight_of_the_order', 'mercenary_veteran', 'urban_bounty_hunter',
  'folk_hero', 'urchin'
];

// Theme → departure-type map. The TYPE of departure; tone preset modulates
// the FEEL. A soldier in Brutal & Gritty is a conscripted peasant levy; a
// soldier in Epic Fantasy is a royal summons; a soldier in Tender & Hopeful
// is a quiet farm-porch goodbye. Same type, different register.
//
// Entries are short clauses (<100 chars) so they read cleanly inside the
// Ch4 engagement-mode prompt block.
export const THEME_DEPARTURE_MAP = {
  soldier:              'enlistment, military posting, war-call, conscripted levy, mercenary contract',
  sage:                 'academy, library, master\'s teaching, research expedition, a book that requires travel',
  criminal:             'flight from consequences, exile, a crew that needs a new member, a debt called in',
  acolyte:              'pilgrimage, calling, vigil, temple assignment, a vision that demands travel',
  charlatan:            'flight from consequences, a mark that got too close, a new town needed for a new name',
  entertainer:          'a troupe passing through, a patron\'s summons, a stage in another city',
  noble:                'political match, duty-to-crown, dynastic journey, a seat to claim, an envoy posting',
  outlander:            'leaving to explore, wanderlust, a map, a rumor of the deep places, a tracker\'s contract',
  sailor:               'a ship\'s berth, a captain\'s summons, a voyage, a mutiny behind, a new port ahead',
  far_traveler:         'returning home, a summons from a distant land, a diplomatic posting, homesickness answered',
  haunted_one:          'a spirit that won\'t leave you rest, a place that calls you, fleeing something worse',
  guild_artisan:        'apprenticeship posting, a master in another town, a commission that requires travel',
  clan_crafter:         'clan-sanctioned journey, a craft-test in the old way, a tool quest',
  hermit:               'the insight you found requires sharing, or the world requires your absence elsewhere',
  investigator:         'a case that leads out of the village, a letter from someone who needs you, a mystery',
  city_watch:           'promotion, transfer, reassignment, a detail with the Crown\'s guard, a case of conscience',
  knight_of_the_order:  'a quest, an oath-pilgrimage, a vow to uphold, the order calls you to service',
  mercenary_veteran:    'a contract, a warband forming, a debt of honor, a new war',
  urban_bounty_hunter:  'a contract, a target that ran, a warrant from another city',
  folk_hero:            'the call to adventure, a village in need beyond yours, a standard raised',
  urchin:               'a crew moving on, a name heard in another city, survival elsewhere'
};

// Simple helper: look up a theme id's departure phrase, with a sensible
// fallback for unknown ids.
export function getDepartureTypeForTheme(themeId) {
  return THEME_DEPARTURE_MAP[themeId] || 'a reason shaped by the character\'s path — the DM should match the theme, not default to tragedy';
}

// ---------------------------------------------------------------------------

/**
 * Build the theme offer shown at Ch3 wrap-up. Uses the existing emergence
 * trajectory tally (chapter-weighted) as primary signal; falls back to
 * talent/care patterns for a wildcard option when the trajectory is thin.
 *
 * Returns a shape the Sonnet prompt can embed directly into a
 * [THEME_COMMITMENT_OFFERED] marker AND a UI card can render:
 *   {
 *     leading: 'soldier',
 *     leadingReason: 'Your choices have leaned toward obedience, training, protecting your sibling in fights.',
 *     alternatives: ['city_watch', 'mercenary_veteran', 'folk_hero'],
 *     alternativeReasons: { city_watch: '...', mercenary_veteran: '...', folk_hero: '...' },
 *     wildcard: 'outlander',
 *     wildcardReason: 'You said you care about the woods; worth considering even if your story hasn\'t leaned there.',
 *     trajectoryScores: [{ target: 'soldier', score: 5.5 }, ...]
 *   }
 */
export async function buildThemeOffer(characterId) {
  const character = await getPreludeCharacter(characterId);
  if (!character) throw new Error('Prelude character not found');

  // Pull all theme-hint rows so we can compute top-N, not just the winner.
  const hintRows = await dbAll(
    `SELECT target, chapter FROM prelude_emergences
     WHERE character_id = ? AND kind = 'theme'`,
    [characterId]
  );

  // Chapter-weighted tally — Phase 2 chunk 4 three-chapter shape:
  // Ch1=1×, Ch2=1.5×, Ch3=2× (matches preludeEmergenceService).
  const CHAPTER_WEIGHT = { 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.0 };
  const tally = new Map();
  for (const row of hintRows) {
    const w = CHAPTER_WEIGHT[row.chapter] || 1.0;
    tally.set(row.target, (tally.get(row.target) || 0) + w);
  }
  const sorted = [...tally.entries()]
    .map(([target, score]) => ({ target, score }))
    .sort((a, b) => b.score - a.score);

  const leading = sorted.length > 0 ? sorted[0].target : null;
  // Alternatives: up to 3 more from the trajectory, ALL distinct from leading.
  const alternatives = sorted.slice(1, 4).map(s => s.target);

  // Phase 2 chunk 3 — wildcard removed (Decision 3 simplified the theme
  // commitment ceremony to "leading + 3 alternatives + choose-your-own").
  // Returning null preserves the field for legacy callers / UI; client
  // chunk 1 stops using it.
  const wildcard = null;

  // Short reason strings — brief, not full narratives. Sonnet should
  // expand these in the marker text for richness.
  const reason = buildSummaryReason(sorted);

  return {
    leading,
    alternatives,
    wildcard,
    reason,
    trajectoryScores: sorted.slice(0, 8)  // cap for the UI
  };
}

function buildSummaryReason(sorted) {
  if (sorted.length === 0) {
    return 'No strong theme trajectory emerged from Ch1-2 play — pick from the alternatives below or write your own.';
  }
  const top = sorted[0];
  const leadPct = sorted.length > 1
    ? Math.round((top.score / sorted.reduce((s, r) => s + r.score, 0)) * 100)
    : 100;
  return `Over Ch1-2, "${top.target}" accumulated ${top.score.toFixed(1)} theme-hint weight (~${leadPct}% of the trajectory).`;
}

// ---------------------------------------------------------------------------

/**
 * Write the committed theme. Validates the value against ALL_THEME_IDS.
 * `source` is logged for traceability: 'leading' / 'alternative' /
 * 'wildcard' / 'other' / 'defer' (the last only valid if theme is null).
 */
export async function commitTheme(characterId, { theme, reason = null, source = 'unknown' } = {}) {
  if (theme !== null && !ALL_THEME_IDS.includes(theme)) {
    throw new Error(`Unknown theme id: ${theme}`);
  }
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE characters
     SET prelude_committed_theme = ?, prelude_committed_theme_at = ?
     WHERE id = ?`,
    [theme, theme === null ? null : now, characterId]
  );
  return { theme, committed_at: theme === null ? null : now, source, reason };
}

/**
 * Return the committed theme + timestamp, or null if not yet committed.
 */
export async function getCommittedTheme(characterId) {
  const row = await dbGet(
    `SELECT prelude_committed_theme, prelude_committed_theme_at
     FROM characters WHERE id = ?`,
    [characterId]
  );
  if (!row || !row.prelude_committed_theme) return null;
  return {
    theme: row.prelude_committed_theme,
    committed_at: row.prelude_committed_theme_at
  };
}
