/**
 * playerName — does a marker's name field mean the player character?
 * (combat-loop fix P3, 2026-11-23; brief docs/pm/combat-loop-fix/BRIEF.md)
 *
 * Markers name the player as "Player" — but the DM model usually writes
 * the character's name, and often only part of it ("TEST_COMBAT" for
 * "TEST_COMBAT Brawler", "Kell" for "Kell Brightwater"). Every handler
 * used to accept only "player"/"pc"/"character" or the exact full name,
 * so those markers were refused or ignored, silently. This is the one
 * shared rule:
 *   - the aliases player / pc / character / self / you;
 *   - the full name, case-insensitive;
 *   - any run of whole consecutive words of the full name ("Kell",
 *     "Brightwater", "Kell Brightwater"), ignoring a leading "the".
 * A fragment of a word ("Ke") never matches.
 */

const ALIASES = new Set(['player', 'pc', 'character', 'self', 'you']);

function words(s) {
  return String(s || '').trim().toLowerCase().replace(/^the\s+/, '').split(/\s+/).filter(Boolean);
}

export function isPlayerRef(raw, playerName) {
  const w = words(raw);
  if (w.length === 0) return false;
  if (w.length === 1 && ALIASES.has(w[0])) return true;
  const full = words(playerName);
  if (full.length === 0) return false;
  for (let i = 0; i + w.length <= full.length; i++) {
    if (w.every((t, j) => full[i + j] === t)) return true;
  }
  return false;
}

export default { isPlayerRef };
