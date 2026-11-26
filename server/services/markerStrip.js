/**
 * markerStrip — remove DM markers from text the PLAYER sees (marker-strip
 * fix, 2026-11-23; brief docs/pm/marker-strip-fix/BRIEF.md).
 *
 * One pattern, generated from MARKER_SCHEMAS — the single registry of
 * every marker the DM can emit — so a newly taught marker is stripped
 * with no change here. It replaces the hand-kept list of strip lines that
 * used to sit in routes/dmSession.js and drifted to 28 of 126 markers.
 *
 * Fences (all deliberate):
 *  - Schema names only. Never a bare-bracket catch-all: narration can
 *    carry bracketed text the player must see — "[OOC: Would you like to
 *    formally recruit …?]" is taught to the DM for companion recruitment,
 *    and a catch-all like the Prelude's /\[[A-Z][A-Z_]{2,}…\]/ would eat it.
 *  - With or without a payload: [COMBAT_END] as well as [SET_ROOM: …].
 *  - Case-insensitive, as the old list was.
 *  - Display only. Callers strip AFTER the engine has read the markers;
 *    stored history keeps them intact.
 */
import { MARKER_SCHEMAS } from './markerSchemas.js';

export const STRIPPED_MARKER_NAMES = Object.freeze(Object.keys(MARKER_SCHEMAS));

// The name must be followed by ':' (a payload) or ']' (bare), so a schema
// name never matches the front of a longer bracketed word.
const PATTERN_SOURCE = `\\[(?:${STRIPPED_MARKER_NAMES.join('|')})(?:\\s*:[^\\]]*)?\\]`;

/**
 * A fresh global, case-insensitive matcher (global regexes carry state, so
 * never share one). Each marker takes its trailing whitespace with it,
 * exactly as every line of the old hand list did (`\s*`).
 */
export function markerPattern() {
  return new RegExp(`${PATTERN_SOURCE}\\s*`, 'gi');
}

/**
 * Text with every schema marker removed and the ends trimmed — the old
 * hand list's output, for all markers instead of 28. Non-strings pass
 * through untouched.
 */
/**
 * mechanical-reactions (live probe 2026-11-25): blocks the ENGINE writes
 * into the DM's prompt — "[SPELL NOTICE — system facts for the DM. …]" and
 * "[COUNTERSPELL — system fact: …]" (also CONCENTRATION, DEATH SAVE, …) —
 * are DM-only and can carry a hidden DC. gemma4:12b echoed one verbatim
 * into the player's text. Named shapes only (an em dash + "system fact"),
 * never a bare-bracket catch-all, so [OOC: …] survives.
 */
export function engineBlockPattern() {
  return /\[(?:SPELL NOTICE — system facts for the DM\.|[A-Z][A-Z ]{2,40} — system fact:)[^\]]*\]\s*/g;
}

export function stripMarkers(text) {
  if (typeof text !== 'string' || text === '') return text;
  return text.replace(markerPattern(), '').replace(engineBlockPattern(), '').trim();
}

export default { stripMarkers, markerPattern, engineBlockPattern, STRIPPED_MARKER_NAMES };
