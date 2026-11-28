# Report — scene-evolution-tick-fix: evaluate scene evolution when the world clock advances at session end

## Understanding

**The project.** The DnD Meta Game is a solo D&D 2024 "forever game". One human player character plays in a persistent Forgotten Realms world, and an AI Dungeon Master (a local model) plays everyone else. The MVP covers the core loop: create a character, play, leave, come back, and find that the world kept its state and moved on by the time that passed.

**This job.** Places are meant to change with world time. A cleared watchtower left alone for years should become something new, such as squatters, a ruin or a camp. The locked time-evolution design has two triggers for that: on return, and on tick. The return-loop report (gap G-7) found that the tick trigger, `tickEvolution`, has no caller, so moving the clock never evaluates any place. This job wires that one call into session end. It also replaces the G-7 source check with a behavior check. The four downtime gaps stay red.

**What I found in the live code** (the survey, item 1):
- **`tickEvolution`** is at `server/services/timeEvolutionService.js:191`; the brief's line is confirmed (it is `:194` after this job's comment edit). For each scene in the campaign, it works out how many years have passed since the scene's anchor (the date it last evolved, or else the date it was generated or seeded). It turns that into a band (stable under 5 years, minor 5–20, major 20–100, settlement 100+). It returns a scene as a candidate when that band is above the band of the scene's last applied chapter and is not stable. Each candidate is `{ sceneId, name, elapsedYears, band, baseBand, held, escalated, currentOccupants, currentUse, anchorKnown, lastBand }`. By design it writes nothing and creates no news.
- **Candidate sink: none.** Nothing reads candidates today. Only the DM can apply an evolution, with `[EVOLVE_PLACE]` → `applyEvolution`. The DM prompt is never told about candidates; that wiring is the post-MVP evolution-news work (Wave 1). Per the brief, I report this gap and did not fix it. No applier was built.
- **Where the clock moves at session end.** `POST /:sessionId/end` in `server/routes/dmSession.js` does not itself advance the world clock. The clock already moved during play: `[TIME_ADVANCE]` / `[REST]` → `restTimeService.advanceTimeForSession` → `scheduleService.advanceHours`. Session end measures that movement as `daysElapsed` (`sessionEndDays`) and stamps the final date onto the character. This is "the world-clock advance at session end": the same span the living-world tick uses. I used it as the call site. A **flashback** session also produces a `daysElapsed`, but there the world clock stays put and only the character's own date moves. So I gate the call on the world clock having actually moved, not on `daysElapsed > 0` alone.
- **Other paths.**
  - The living-world tick (`processLivingWorldTick`) reads the clock but never advances it.
  - The deferred-resolution sweep (`deferredResolutionSweep.js`) also never advances the clock.
  - Neither is the same code path as session end, so neither was wired.
  - Other places do move the clock, and I left all of them unwired, as the brief directs:
    - the adjust-date route (`dmSession.js`, around `:3674`);
    - the meta-game advance-time route (`server/routes/metaGame.js:404`);
    - short downtime (`downtimeService.js:93`, which runs inside session end's own downtime stage, before the measured span).
- **Why there is no orchestrator stage.** `session_end_runs.stage` has a CHECK constraint (migration 075: `xp, downtime, domains, digest, sweep`). A new "evolution" stage would need a migration, which the brief fences off. I put the call in the route next to the living-world tick instead, so no migration was needed.

There is one difference from the brief's wording. The brief says "the one place session time moves". At session end the clock is measured, not moved: it moved during play. The call evaluates against the clock where the session left it, which is what "on world-clock advance" requires.

## Verdict

**BUILT + RED (expected).** The G-7 check now passes. The full run is red with exactly the four named downtime checks and no other failures.

## Per-item verdicts

| Brief item | Verdict |
|---|---|
| 1. Survey | Done (above) |
| 2. Wire the call | Done. `tickEvolution(campaign_id, { currentWorldDay: clock.day, currentYear: clock.year })` runs at session end when the world clock moved. Candidates are returned in the `/end` response as `sceneEvolution` and logged. Nothing else consumes them, as reported. |
| 3. Replace the source check with a behavior check | Done. It fails against the pre-fix code (counts below). |

## Files changed

| File | New/Edited | Size (bytes) | SHA-256 |
|---|---|---|---|
| `server/routes/dmSession.js` | Edited | 244,604 | `6cc8ede901ce149b5750c7ad18bd8ec2dac3ce35b4c1ad871e3cb1fd428f73fc` |
| `server/services/timeEvolutionService.js` | Edited (header comment only) | 16,351 | `cde10d0f1d669011a526cba670ed8415196553684ec825f068fb20e4e60d3113` |
| `tests/return-loop.test.js` | Edited | 43,491 | `0dffe8718a4720584e232ea9381d6a030f4143e9f42ac8403f15c2d06af45740` |
| `package.json` | Edited (1.0.229 → 1.0.230) | 1,398 | `53e3692fbb4060371c58135a215131b035782df952334943aec4d040b429dad3` |
| `client/package.json` | Edited (1.0.229 → 1.0.230) | 427 | `53926812ff9a6c3f124550b1785cfd30a9848e899d3a411d726d26e4204d4af3` |
| `docs/pm/scene-evolution-tick-fix/BRIEF.md` | New (the brief, placed as given) | 5,086 | `440130587cdb1cf1c82dbd8e55079568c0e68695ee01c51801546176b86d1550` |

No migration.

Changes in `dmSession.js`:
- The side-effect import `import '../services/timeEvolutionService.js'` is now `import { tickEvolution } from …`. It still registers `EVOLVE_PLACE`.
- A `worldClockAdvanced` flag is set only in the non-flashback branch, when `daysElapsed > 0`.
- The scene-evolution block runs after the living-world tick block. It is non-fatal (try/catch, logged).
- `sceneEvolution` was added to the `/end` JSON.

## What was built (in play)

When a session ends after world time has passed, the game now checks every place in the campaign against how long it has been left alone. It lists the places that are due to change: for example, a watchtower last touched six years ago is now a "minor" candidate. Nothing changes in the world yet. The places stay as they were and no news is written, because the design keeps every change DM-proposed. The list comes back with the session-end result (`sceneEvolution`), but nothing reads it yet: the client ignores it and the DM is not told. Feeding it to the DM is the post-MVP evolution-news work.

A session in which no world time passed checks nothing, and neither does a flashback session.

## Test results

**Full `npm test` (PC, after the change):** Files **272/273 green**. Assertions: **20,640 passed, 4 failed** (first run) and **20,642 passed, 4 failed** (second run). The only red file is `return-loop.test.js` (85/89), and its four failures are exactly the standing named downtime checks:
1. `[protect] GAP G-4: the player's downtime assignment for TEST_RL_D Mira is scheduled`
2. `[protect] GAP G-5: full downtime jumps the clock by its span, 5 days`
3. `[protect] GAP G-6: the client's end-session request can carry the player's downtime choice`
4. `[protect] GAP G-6: the steward's downtime question is put to the player at session end`

There are no other failures. `[tick] GAP G-7: a world-clock advance at session end evaluates scene evolution` **passes**.

The pass total differs between runs because of the Windows runner. Files that hit libSQL's native exit crash after all their assertions passed are counted green as `pass*`, and some of them report no assertion count. A different set of files hit the crash each run: eight files in run 1 and three in run 2. The failure set was identical in both runs. The previous job reported 20,632 passed / 5 failed. The expected change is return-loop +4 passed (G-7 now passes, plus 3 new checks), which matches return-loop's own count. The rest of the difference comes from `pass*` files that report no count.

**Touched suites:**
- `return-loop.test.js`: **85 passed / 4 failed** of 89 (was 81/5 of 86). The source check became four checks, so the total is 3 higher:
  - `[tick] GAP G-7: a world-clock advance at session end evaluates scene evolution`: campaign A has two scenes. The one generated 6 years before is a `minor` candidate; the one generated on the session's start day is not.
  - `[tick] scene evolution was evaluated against the clock where the session left it, day 468`.
  - `[tick] a candidate is not an evolution: no chapter and no news were written`.
  - `[tick] a session end that does not advance the world clock evaluates no scene evolution`: a fixture that ends with 0 days elapsed gets no `sceneEvolution`.
- `time-evolution.test.js`: green (unchanged; the runner does not parse its own pass/fail line).

**The new check fails against the pre-fix code.** I restored `server/routes/dmSession.js` from HEAD (`fad518c`) and kept the new test. Result: return-loop **83 passed / 6 failed**. The two extra failures are the G-7 check (`got []`) and the clock-day check (`got undefined`). The two guard checks (no writes; no evaluation without advance) pass against both versions, as guards should. I then put the fixed file back.

## Cost and usage

Unknown. Session cost and the remaining $30/month cap are not measurable from inside the session.

## Not done / still open

- **Candidates have no consumer.** They are returned in the `/end` response and logged, and nothing reads them. Getting them to the DM (so the DM can propose `[EVOLVE_PLACE]`) is the post-MVP evolution-news → DM prompt wiring, out of scope by the brief.
- **Other clock movers are not wired.** The adjust-date route, the meta-game advance-time route and the in-session `[TIME_ADVANCE]` / `[REST]` path all move the clock and do not evaluate evolution. The brief limits this job to session end. Wiring advance-time would be a one-line call there, if the PM wants it.
- **Downtime gaps G-4, G-5, G-6 ×2:** untouched, still red as named.

## Decisions made (reversible, for veto)

1. **Call site is the route, not the orchestrator.** A `sessionEndService` stage would need migration 075's stage CHECK widened, which is a migration and fenced off. *Reversal cost:* a migration plus moving about 20 lines into a new stage.
2. **Gate: the world clock moved** (non-flashback and `daysElapsed > 0`, with a campaign). A flashback session moves only the character's date, not the world. If the clock read fails, the gate stays false and nothing is evaluated, because there is no reliable clock to evaluate against. *Reversal cost:* one condition.
3. **Not gated on `LIVING_WORLD_TICK`.** The service's own header says the tick hook deliberately does not read that flag. The call writes nothing, so it is safe with the MVP posture (tick off). *Reversal cost:* add the flag to the condition.
4. **Candidates are returned in the `/end` response (`sceneEvolution`: `worldDay` + `{sceneId, name, band, lastBand, elapsedYears}` per candidate) and logged.** This is the honest sink: it is visible and testable, and it is not an applier. It is not persisted anywhere. *Reversal cost:* drop the response field.
5. **The check name keeps its "GAP G-7:" prefix** now that it passes, as the closed G-1/G-2/G-3 checks do. *Reversal cost:* rename one string.

## Needs Zach's decision

Only the gate.

## Verification evidence

- **Commit:** `14f0ab4` on `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. The parent is `fad518c` (the l1-l6-cleanup report). The report commit follows it.
- **File hashes:** in the table above.
- **Gate:** `npm test` from the repo root. Expect `Files: 272/273 green | Assertions: ~20,640 passed, 4 failed`. The passed count drifts a little because of `pass*` files. The FAIL line should be only `return-loop.test.js (85/89)`, with exactly the four downtime names above.
- **Single suite:** `npm test return-loop`. Expect 85 passed / 4 failed, with `✓ [tick] GAP G-7: …`.
- **:5173:** no visible change. The client ignores `sceneEvolution`. To see it, end a session in a campaign that has a scene at least 5 years old after world time has passed in play, and open the `/end` response in the browser's Network tab: it carries `sceneEvolution.candidates`.
