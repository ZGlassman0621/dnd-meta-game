# Brief — marker-strip fix: no raw markers in the player's chat

## Goal (in play)
The player never sees a raw bracketed marker in chat. The DM's markers are engine instructions, not narration — when the DM sets a room, records the cold, or throws a display spell, the player reads the story, never `[SET_ROOM: ...]` or `[COLD_SCENE: BaseLevel=3]`. What the player sees is clean fiction; what the engine does still happens exactly as before.

## Background
- Zach's :5173 session 2026-11-23 (recorded as Finding 1 in the H1 report, `docs/pm/reports/h1-teach-the-markers-REPORT.md`, head `e66a400`): bracketed markers printed in chat, e.g. `[SET_COVER: Target="Player" Cover="half" Feature="Bar"]`, `[ENEMY_ATTACK: Enemy="Thug" Target="Player" Multiattack="true"]`, `[COLD_SCENE: BaseLevel=3]`, `[COLD_WET: Target="Player" Status="soaked"]`. The effects applied (cover, cold, wet all worked) — the markers are just shown as well as read.
- Cause, verified against live bytes at head `e66a400` (PM, 2026-11-23): the player-facing text is cleaned by one hand-kept list of strip lines in `server/routes/dmSession.js:2189-2227`. That list removes **28** markers by name; the H1 report counts **126** marker schemas, so about **99** are never removed. There is no catch-all strip. CLAUDE.md's debt list already names this ("marker lists drift by hand"; the Prelude has a catch-all regex worth adopting).
- H1's part: most of the leak predates H1 (`SET_COVER` and `ENEMY_ATTACK` were already taught and not stripped). But H1 taught about 15 more markers the strip list doesn't know, so it widened the leak. H1 was scoped "no route change", which is why this is its own brief — this job IS the route change.
- The markers still work: the engine reads them before the strip, which is why the cover, cold and wet effects applied. Nothing about marker handling changes in this job — only what reaches the player's eyes.
- Single source of truth: `MARKER_SCHEMAS` in `server/services/markerSchemas.js` is the registry of every marker the DM can emit (its header: "single source of truth for every marker the DM AI emits"). The strip pattern must derive from it, so the next taught marker is stripped automatically and no hand list can drift again.

## What to build
1. **Survey first.** On the PC, branch `phase-4-hybrid-combat`: (a) the strip list in `server/routes/dmSession.js` — exact lines, exact count of markers it removes, and where it sits in the turn pipeline relative to marker handling and `reconcileTurn`; (b) `MARKER_SCHEMAS` — the exact count of schemas and how their keys are enumerated from the module (the count the builder reports is the surveyed count, not the H1 report's 126 — verify it); (c) the Prelude catch-all regex the H1 report and CLAUDE.md mention — find it and evaluate it as the starting point for the generated pattern; (d) any other player-facing path that shows raw DM text (summaries, recaps, the Prelude flow, session notes) — survey and report; if one shows the same leak, fix it with the same pattern and report it (fix-as-you-find-it); if it needs a different fix, report it as open, do not redesign it here.
2. **Replace the hand list with one generated pattern.** Derive the strip pattern from `MARKER_SCHEMAS` keys — one source of truth, generated, not hand-listed. It runs at the same pipeline point the hand list runs today (after the engine has read the markers, before the text reaches the player), and the hand list is removed, not kept alongside. Fences, all hard: the pattern matches **schema names only** — never a bare-bracket catch-all, because the DM's narration can legitimately contain bracketed prose that is not a marker; it must strip markers with and without a field payload (`[COMBAT_END]` as well as `[SET_ROOM: ...]`); it stays case-insensitive, as the hand list is (`/gi`); and it changes nothing about marker handling — the engine reads the markers before the strip, and that order stays. If a schema name can never appear in player-facing text (a marker the DM never emits in narration), say so in the report rather than silently skipping it.
3. **Tests.** New suite proving no schema marker survives into the narrative the player sees: enumerate every `MARKER_SCHEMAS` key, embed each one in sample narrative with and without a field payload, run the strip, and assert none survives. Regression: the 28 markers the hand list removed are still removed. Full `npm test` green on the builder's run.
4. **Prove it live.** Boot the real server against a throwaway database with the real gemma4:12b (the H1 probe pattern) and drive a turn that emits markers — a tavern fight is the known case (`SET_ROOM`, `SET_COVER`, `ENEMY_ATTACK`) — then read the narrative the route returns and assert it contains no marker text. Report the probe output verbatim. The `:5173` steps for Zach go in "How to verify" below.

## Out of scope
- Any change to marker handling, validation, dispatch, or engine behavior — the engine reads markers exactly as before; only the player-facing text changes.
- The marker-result feedback route (forwarding result/refusal notes TO the DM, and scene ids reaching the DM) — that is a separate brief; it unblocks `EVOLVE_PLACE` and the `Scene=`/`Room=` forms.
- Any prompt teaching (H1 is done) or the combat-loop diagnosis (separate job).
- Any other player-facing text path beyond the turn narrative, unless the survey proves the same leak there (item 1d covers that case).

## Acceptance criteria
- No schema marker survives into the narrative the player sees — proved by the new test for every `MARKER_SCHEMAS` key, with and without a field payload.
- The hand list in `dmSession.js` is gone; the strip derives from `MARKER_SCHEMAS` alone, so a newly taught marker is stripped without a code change to the strip.
- The 28 markers the hand list removed are still removed (regression covered).
- Marker handling is unchanged: the markers still fire (existing tests green + the live probe shows effects applying with clean narration).
- Full `npm test` green on the builder's run.

## Verification
- Run the full `npm test` yourself from the repo root on the PC and iterate until green. Zach's full run is the gate — never claim it. Expect ~250 files (249 after H1, plus the new suite).
- Live probe per item 4, real server + real gemma4:12b, output in the report.
- `:5173` by hand (never `:3000`): the steps are in "How to verify" below.
- Note the known runner flag: spellbook-routes takes ~158s against the runner's 120s per-file cap — a timeout artifact, not a failure, if it trips.

## Decisions already made
- One generated pattern from `MARKER_SCHEMAS`, replacing the hand list (PM decision, vetoable at the gate). The hand list is removed, not kept as a fallback — two lists is how this drifted.
- Schema names only, never a bare-bracket catch-all (PM decision, vetoable). Bracketed prose that is not a marker must survive.
- Same pipeline point as today; marker handling order unchanged (PM decision, vetoable).
- The Prelude catch-all is a starting point to evaluate, not a mandate — if it doesn't fit the schema-derived pattern, say why and build from the registry (PM decision, vetoable).
- Fix-as-you-find-it (Zach, 2026-11-06): the same leak on another player-facing path gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask before building. Never invent data — a gap is stated as a gap.
- The gate for this job runs combined with H1 + H2+H3 (one `npm test` covering all of them) — Zach's call, per the day plan.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts for the four items above.
- The exact surveyed counts: schemas in `MARKER_SCHEMAS`, markers the hand list removed, markers that survived before the fix.
- The live probe output verbatim, and the tavern-fight (or equivalent) turn that proves clean narration with effects applying.
- Any question for Zach in full plain terms, one per item, with what was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never :3000).

## How to verify
**Gate:** `npm test` on the PC (expect ~250 files green). This gate runs combined with H1 + H2+H3.

**At `:5173` (never `:3000`), with `npm run dev`:**
1. Use a campaign character. Start a session in a town.
2. Type "I'm drinking in the tavern common room when two thugs draw knives and attack me. I fight."
   - **Look for:** the fight starts, the DM describes cover at the bar — and **no bracketed marker text anywhere in the chat**: no `[SET_ROOM: ...]`, no `[SET_COVER: ...]`, no `[ENEMY_ATTACK: ...]`, no `[COMBAT_START: ...]`.
3. After the fight, type "I leave town and march north into frozen mountain passes — snow and bitter wind — for four hours."
   - **Look for:** the DM narrates the cold wearing you down — and no `[COLD_SCENE: ...]` or `[TIME_ADVANCE: ...]` in the chat.
4. Type "The ice breaks and I fall into a frozen stream, soaked through. I keep walking for an hour."
   - **Look for:** the DM treats you as soaked and the cold as harsher — and no `[COLD_WET: ...]` in the chat.

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test` + :5173 checks on the PC.
- Place this brief at `docs/pm/marker-strip-fix/BRIEF.md` in the repo when handing it over. Reports live in `docs/pm/reports/`.
