# Brief — combat resolution: a fight can't end with enemies standing unless something resolved it

## Goal (in play)
A fight ends only when it is resolved — enemies dead, fled, surrendered, or talked down. The DM can't end a fight while enemies stand without a resolution, and every resolution has a real path in the engine.

## Background
- The combat-loop fix (report commit `45c34b4`, v1.0.205), run 2: the DM wrote `[COMBAT_END]` with Thug 1 untouched and Thug 2 at 1 HP, and the fight ended. No marker lets an enemy flee or surrender, so refusing `COMBAT_END` could trap the player in a fight the DM has narrated as over.
- Zach's answer (2026-11-23): "Fights need some sort of resolution. If both thugs are still standing, there has to be a reason for it — they ran off, we ended up talking things out; something must happen in order for that outcome." That is option (b) from the fix report's Question 3: refuse `COMBAT_END` while enemies stand, and add a way for an enemy to flee, surrender or settle by talking. Morale flight already exists — Thug 1 fled that way in the fix's run 4.
- Standing facts: the DM model is gemma4:12b, offline on the PC. The DM controls every NPC (Zach, 2026-11-23) — on each enemy turn the DM chooses the action; the engine resolves the marker and advances the turn. The fix must be systemic — a model behavior is not the diagnosis and is not the fix; the system gap behind it is. Nothing mechanical is narrative-only (Zach, 2026-11-08).

## What to build
1. **Refuse `COMBAT_END` while enemies stand.** When the DM writes `[COMBAT_END]` and any enemy is still active (not dead, fled, surrendered, or settled), the engine refuses it and tells the DM why, in the same exchange, naming the resolutions that exist (flee, surrender, talk it out — item 2) so the DM can choose one. The refusal reaches the DM the way P2's refusals do (system note, same exchange), not silently.
   - **Fixed looks like:** the DM ends a fight with both thugs standing and the fight does NOT end; the DM is told it can't end while enemies stand and what the resolutions are.
2. **Markers for enemy resolution.** Survey first: what exists today (morale flight — how it works, is it a marker or engine-driven? what enemy states exist?), then add what is missing:
   - **Flee** — an enemy leaves the fight (runs off). If morale flight already covers this, wire the DM to it instead of adding a second path, and say so in the report.
   - **Surrender** — an enemy yields. The engine records the enemy as surrendered, removes it from the turn order, and the fight can end with surrendered enemies standing.
   - **Talk it out / settle** — the fight ends by agreement (parley, a deal, a standoff). The engine records the settlement and ends the fight with the enemies standing but resolved.
   - Teach the DM each marker in the prompt: when each is appropriate, which marker to write, what the engine does. The DM chooses the action on the enemy's turn (Q2); the engine resolves it.
   - **Fixed looks like:** a thug flees, surrenders, and is talked down in three separate probe fights; each ends the fight cleanly, the resolution is narrated, and the engine's enemy state matches what happened.
3. **The fight ends cleanly on a resolution.** When the last active enemy is dead, fled, surrendered, or settled, the fight ends (the existing end path) with the resolution recorded — so a later session, the chronicle, and the tracker all agree the fight is over and why.
   - **Fixed looks like:** after a surrender, the tracker clears, the fight is over, and the enemy is recorded as surrendered, not standing.

## Out of scope
- Balance or numbers (morale thresholds, surrender DCs if any — if a resolution needs a number the engine doesn't have, report it as a question for Zach, do not invent one).
- The general marker-result feedback route for non-combat markers — separate job; item 1's refusal rides the P2 feedback path that already exists.
- The "leave the cold" marker — separate job.
- The feat twelve, the player-rolls-out-of-combat job, or any other queued job.

## Acceptance criteria
- Each item has tests pinning its "fixed looks like", and the full suite stays green.
- Live probe (real server + real gemma4:12b, tavern fight): the DM tries `[COMBAT_END]` with both thugs standing and the fight does not end, with the reason reaching the DM; then a thug flees, a thug surrenders, and a fight is talked down — each ends the fight cleanly with the resolution recorded. Morale flight still works as before.
- The survey (item 2) states what existed before this job and what was added, with file:line evidence.

## Verification
- Run the full `npm test` yourself from the repo root on the PC and iterate until green. Zach's full run is the gate — never claim it. Expect ~253 files (252 after the player-rolls-out-of-combat job if it lands first, plus the new test file(s) — state the actual count in the report).
- Note the known runner flag: spellbook-routes takes ~158s against the runner's 120s per-file cap — a timeout artifact, not a failure, if it trips.
- The report itself is the verification: it must let a reader reproduce each finding from the cited evidence.

## Decisions already made
- Zach's ruling (2026-11-23): a fight can't end with enemies standing unless something resolved it — they ran off, talked it out, surrendered; something must happen.
- Option (b) from the fix report's Question 3: refuse `COMBAT_END` while enemies stand, and add the resolution markers (PM decision, vetoable — it is the option Zach's words describe).
- If morale flight already covers fleeing, wire the DM to it rather than adding a second path (PM decision, vetoable).
- If a resolution needs a number the engine doesn't have, report it as a question for Zach — do not invent one (PM decision, vetoable; do-not-guess).
- The fix must be systemic — a model behavior is not the fix (PM decision, vetoable; the leak-test lesson).
- Fix-as-you-find-it (Zach, 2026-11-06): a sibling defect found live gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask before building. Never invent data — a gap is stated as a gap.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts for the three items above.
- The survey (item 2) with what existed and what was added, the live probe log (turn by turn, what the DM said, markers emitted, engine state, what the player would see), and the "fixed looks like" evidence per item.
- Any question for Zach in full plain terms, one per item, with what was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never :3000).

## How to verify
**Gate:** `npm test` on the PC (expect ~253 files green).

**At `:5173` (never `:3000`), with `npm run dev`:**
1. Use a campaign character. Start a session in a town.
2. Type "I'm drinking in the tavern common room when two thugs draw knives and attack me. I fight."
3. Fight until both thugs are still standing, then say something that makes the DM try to end the fight ("We call it off" / "I lower my weapon and step back").
   - **Look for:** the fight does NOT just end — the DM is told it can't end while enemies stand, and is offered the resolutions.
4. Have a thug flee, surrender, or talk it out.
   - **Look for:** the fight ends cleanly, the tracker clears, and the narration matches the resolution (fled / surrendered / settled).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test` + :5173 checks on the PC.
- Place this brief at `docs/pm/combat-resolution/BRIEF.md` in the repo when handing it over. Reports live in `docs/pm/reports/`.
