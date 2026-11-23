# Brief — combat-loop diagnosis: why fights don't run turn-based in live play

## Goal (in play)
Find where the combat loop breaks in live play, with evidence — so the fix job (separate, after this) knows exactly what to change. A fight should run as a turn-based fight: initiative is rolled and shown, turns pass from one combatant to the next, the player is told what to roll for damage after a hit, and enemies act on their own turns without waiting to be prompted by the player. This job diagnoses only. It builds no fix.

## Background
- Zach's :5173 session 2026-11-23 (H1 report, Finding 2, head `e66a400`): a tavern fight against two thugs. What he saw, in his words: (a) initiative didn't seem to work; combat felt purely narrative; (b) he was asked again and again to "make an attack roll", but never told what to roll for **damage**; (c) the thugs never attacked on their own turn; they acted only in response to his actions, so the fight never became turn-based.
- What the H1 builder checked (NOT a diagnosis — starting points, verify each against live bytes before trusting it; the line numbers are from the H1 report and may have drifted since, the strip fix touched `dmSession.js` and `DMSession.jsx`): `COMBAT_START` does roll initiative (`server/services/combatMarkerService.js`), and the turn order is sent to the client (`DMSession.jsx:808, 888`). The DM prompt only covers damage for the player's dice when the player supplies a damage roll (`dmPromptBuilder.js:2983`), and for spells. No line tells the DM to ask for weapon damage after a hit. Enemy turns depend on the DM emitting `ENEMY_ATTACK` and `TURN_ADVANCE`. The session suggests gemma4:12b does not drive that loop.
- Why this matters: combat is MVP-core (MVP done includes combat). If fights don't run turn-based in live play, the MVP loop is broken at its center — regardless of what the code intends.
- Standing facts: the DM model is gemma4:12b, offline on the PC. The fix must be systemic — the leak-test lesson applies here too: a model behavior is not the diagnosis, the system gap behind it is. Nothing mechanical is narrative-only (Zach, 2026-11-08).

## What to build
1. **Survey the intended loop first.** On the PC, branch `phase-4-hybrid-combat`: trace, from the code, how a fight is SUPPOSED to run end to end — `COMBAT_START` (who rolls initiative, where the order lives, what the client receives), the turn order (how turns advance, what prompts or drives `TURN_ADVANCE`), the player's attack and damage flow (who asks for the attack roll, who asks for the damage roll, what `ROLL_REQUEST` and `HP_CHANGE` do in that flow), and enemy turns (what makes an enemy act — a prompt line? a route step? a client timer? nothing?). Report the intended loop as a trace in words, with file:line for each link. Verify the H1 report's starting points against live bytes; correct any that have drifted, and say so.
2. **Reproduce it live.** Boot the real server against a throwaway database with the real gemma4:12b (the H1 / strip-fix probe pattern) and play the tavern fight: two thugs, several full rounds, the player attacking and being attacked. Record, turn by turn, what the DM says, what markers it emits, what the engine stores, and what the route returns for the player to see. For each of Zach's three symptoms, state whether it reproduced and exactly what happened. The tavern fight is the reproduction case because H1 and the strip fix already proved it drives the loop.
3. **Name the break(s).** For each reproduced symptom, identify the broken link with evidence: is the prompt missing the instruction? Is the route not driving the turn? Is the client not showing the order? Is the model not emitting the marker the loop needs — and if so, what in the system was supposed to make it emit it? Distinguish three kinds: a **missing** link (nothing in the system does X), a **weak** link (something does X but the model doesn't follow it), and a **display** gap (the engine knows but the player can't see it). Each break gets: the symptom, the link, the evidence (code + live probe output), and the kind. A symptom that did NOT reproduce is a finding, not a failure — report it with the probe evidence.
4. **Propose the fix, don't build it.** For each break, write the fix proposal concretely enough that the fix job can be briefed from it: what changes, where (file + area), and what "fixed" looks like in live play (the acceptance test). Rank the breaks by what unblocks the loop. If two breaks share one root cause, say so. If a fix needs a decision from Zach (a rule shape, a prompt wording, a display choice), name it as a question in full plain terms — do not decide it here.

## Out of scope
- Any fix (prompt lines, route changes, client changes, engine changes) — diagnosis only. If a one-line fix looks obvious mid-diagnosis, report it as the proposal, do not apply it.
- The marker-result feedback route, the system-notes reload fix, the feat twelve, or any other queued job.
- Balance or rules questions (whether the thugs' stats are right, whether damage numbers are right) — this is about the loop running, not the numbers in it.

## Acceptance criteria
- The intended loop is documented link by link with file:line evidence, and the H1 report's starting points are confirmed or corrected.
- All three symptoms are reproduced-or-not-reproduced live, with turn-by-turn probe evidence.
- Every reproduced symptom has a named broken link with code + probe evidence, classified missing / weak / display.
- The report carries a ranked fix proposal per break, concrete enough to brief the fix job from, plus any questions for Zach in full plain terms.
- This job changes no product code. If a test would pin a diagnosed fact (e.g. the assembled prompt contains no weapon-damage instruction), add it; otherwise add none. Full `npm test` green on the builder's run either way.

## Verification
- Run the full `npm test` yourself from the repo root on the PC and iterate until green. Zach's full run is the gate — never claim it. Expect ~250 files (250 after the strip fix, plus any new test file, or 250 if none).
- The report itself is the verification: it must let a reader reproduce each finding from the cited evidence.
- Note the known runner flag: spellbook-routes takes ~158s against the runner's 120s per-file cap — a timeout artifact, not a failure, if it trips.

## Decisions already made
- Diagnosis only, no fix (Zach, 2026-11-23 — combat diagnosis first, then feat twelve; the fix follows the diagnosis).
- The fix must be systemic — a model behavior is not the diagnosis (PM decision, vetoable; the leak-test lesson).
- The tavern fight is the reproduction case (PM decision, vetoable; H1 and the strip fix already proved it drives the loop).
- The three symptoms are the scope; anything else found live is reported as a further finding, not chased (PM decision, vetoable).
- Fix-as-you-find-it (Zach, 2026-11-06) does NOT apply to fixes in this job — it applies to findings: a further broken link found live gets diagnosed and reported, not fixed.
- Do not guess (Zach, 2026-11-07): if information is needed, ask before building. Never invent data — a gap is stated as a gap.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts for the four items above.
- The intended-loop trace (link by link, file:line), the turn-by-turn live probe log (what the DM said, markers emitted, engine state, what the player would see), and the break table: symptom / link / evidence / kind (missing / weak / display) / fix proposal, ranked.
- Any question for Zach in full plain terms, one per item, with what was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never :3000).

## How to verify
**Gate:** `npm test` on the PC (expect ~250 files green). The gate for this job is the report: it must be checkable from its evidence.

**At `:5173` (never `:3000`), with `npm run dev` — for Zach, to confirm the symptoms are as described:**
1. Use a campaign character. Start a session in a town.
2. Type "I'm drinking in the tavern common room when two thugs draw knives and attack me. I fight."
   - **Look for:** whether initiative is shown anywhere (combat tracker, narration, turn order); whether the fight reads as turns passing or as free narration.
3. Attack a thug. When the DM asks for an attack roll, make it.
   - **Look for:** after a hit, whether the DM tells you what to roll for damage — and what it says if it doesn't.
4. End your turn without attacking, or simply wait through the next exchange.
   - **Look for:** whether a thug acts on its own turn without you prompting it.

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test` + :5173 checks on the PC.
- Place this brief at `docs/pm/combat-loop-diagnosis/BRIEF.md` in the repo when handing it over. Reports live in `docs/pm/reports/`.
