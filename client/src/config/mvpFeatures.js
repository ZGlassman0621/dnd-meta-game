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
 * Opus-planned arc → Sonnet play loop → handoff into the main creator with
 * race/subrace/theme/ancestry-feat pre-committed).
 *
 * OFF for the MVP. It is a second, longer path to the same destination, and
 * the MVP needs one obvious way to make a character. Nothing about it is
 * broken — it is scope, not quality.
 *
 * With this false, HomeFlow skips PathChoiceScreen entirely and "Create New
 * Character" goes straight to the 8-step manual creator. The prelude routes
 * (`prelude.setup` / `prelude.arc` / `prelude.session`), their components, the
 * `/api/prelude` server routes and the resume-a-draft path all remain intact —
 * an in-flight prelude draft on an existing character still resumes, so
 * flipping this off cannot strand a character mid-wizard.
 */
export const PRELUDE_ENABLED = false;
