/**
 * Client-side MVP feature switches.
 *
 * The server has `server/config/featureFlags.js` for subsystems that cost
 * money or mutate the world. This file is the client equivalent for *surfaces*
 * — entry points that are built and working but deliberately not part of the
 * MVP.
 *
 * Same discipline as the server flags and CLAUDE.md rule 4: switched off, not
 * commented out and not deleted. The code behind a false flag still compiles,
 * still has its tests, and comes back by flipping one boolean.
 */

/**
 * The Prelude — a guided origin-story play session (6-step setup wizard →
 * AI-planned arc → DM play loop → handoff into the main creator with
 * race/subrace/theme/ancestry-feat pre-committed).
 *
 * OFF for the MVP. It is a second, longer path to the same destination, and
 * the MVP needs one obvious way to make a character. Nothing about it is
 * broken — it is scope, not quality.
 *
 * With this false, the Prelude fork never appears. 2026-11-05 unhook:
 * nothing on the client reads this flag any more — the old creators are
 * deleted and the new creator is the only path; the flag is kept so the
 * Prelude return can re-check it. The prelude routes (`prelude.arc` /
 * `prelude.session`), their components, the `/api/prelude` server routes
 * and the resume-a-draft path all remain intact — an in-flight prelude
 * draft on an existing character still resumes, so flipping this off
 * cannot strand a character mid-wizard.
 */
export const PRELUDE_ENABLED = false;
