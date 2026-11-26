# Report — return-loop: leave, come back, keep playing, and the world remembers

Builder: Claude Code (Opus 5.5). Brief: `docs/pm/return-loop/BRIEF.md` (amended 2026-11-25).
Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.220 → **1.0.221**.
Commit: `ab52d37` (the build). A follow-up commit adds this line.

## Understanding

**The project.** This is a solo D&D 2024 "forever game". There is one human player character. The Dungeon Master, the NPCs, the companions and the enemies are all played by a local AI model (gemma4:12b on the PC). The world is persistent and lives inside a campaign. The engine owns the rules and the bookkeeping, and the player rolls their own dice.

**This job.** The MVP promise is "play, leave, return, play again, memory retained without loss" (Zach, 2026-11-11). This job proves that promise with tests that run outside of play, not with a DM narration that says it happened. The tests end a session that has pending state, then check five things in turn:
1. the clock moved by the right span;
2. what session end resolves did get resolved;
3. the state is really on disk;
4. a summary is waiting on return;
5. the PC is protected throughout.

Where the product does not do what the design says, the job reports the gap and leaves the product code alone.

**Where the brief and the live build differ (stated before anything else):**
1. **`session-end-flow-design.md` is not in the repo.** It lives in Muse's workspace. I checked every machinery point against live bytes only. The table in "Surveyed call chain" below is the evidence.
2. **"Session end writes `sessions.pending_downtime`, and session start reads it."** No such column exists. The closest thing is `characters.pending_downtime_narratives`:
   - session start reads it (`server/routes/dmSession.js:637`) and clears it (`:1251`);
   - it is written only by the time-based adventure claim (`server/routes/adventure.js:336`), the downtime route (`server/routes/downtime.js:1749`) and the meta-game service (`server/services/metaGame.js:230`);
   - **session end never writes it.**

   This fits the brief's own line that downtime at session end "resolves nothing yet": there is no downtime outcome to write. I list it as open item S-1. There is no test for it, because no repo document says what session end would put there.
3. **"A pending-LLM fallback … retries at next start."** The fallback exists in name only:
   - the XP stage is marked `pending_llm` only when no model function is passed (`server/services/sessionEndService.js:37-40`), and the route always passes one;
   - a model that fails marks the stage `failed` (`:47-50`);
   - nothing outside `sessionEndService.js` ever reads `session_end_runs`, so nothing retries.

   This is gap **G-2**, with a failing test.
4. **"The tick" at session end, in the MVP posture, is the deferred-resolution sweep only.**
   - The living-world tick is behind `FEATURE_FLAGS.LIVING_WORLD_TICK`, which is off by default (`server/config/featureFlags.js:48-49`).
   - The time-evolution tick (`tickEvolution`, `server/services/timeEvolutionService.js:191`) has no caller anywhere. This is gap **G-7**.
   - The general schedule resolver (`completeDueSchedules`, `server/services/scheduleService.js:252`) also has no caller. This matches the brief's "resolving nothing yet", so I report it as by design, not as a gap.
5. **S1 holds as built.** The loop asserts S1's clock invariant: a character in another campaign does not move. It passes, so there is no S1 divergence, and the job did not stop. One claim in the S1 report was inaccurate: it said the existing `session-end-world-tick` tests 1-6 "still prove … chronicle". They didn't, because of a test bug, which I fixed in this job (Test bug fixed, below). The product behavior S1 described (a chronicle row is written) was proven by S1's live probe. It is now also proven by tests.

## Verdict

**BUILT + RED (red with cause).** Full `npm test` on the PC: Files **266/267 green**, assertions **20,577 passed, 9 failed**. The only red file is the new `return-loop` suite. Its 9 failing assertions are exactly the 7 product gaps G-1 to G-7, each tagged with its gap and its step. None is a test fault. Brief item 4 says gaps are reported, not fixed, and item 5 forbids papering the suite green. So the suite stays red until the follow-up fix jobs land. Muse confirmed this on 2026-11-25: keep them as real failures. All 9 are listed by name under "How to verify". Everything else in the loop passes.

## Per-item verdicts

| Item | Verdict | Evidence |
|---|---|---|
| 1. Survey first | **Done** | The call chain below gives a file and line for every step. It was surveyed before any test was written. Three differences from the brief are stated above. |
| 2. The loop as tests | **Built** | New `tests/return-loop.test.js` has five step groups, `[end]`, `[clock]`, `[tick]`, `[persist]` and `[return]`, and every assertion names its step. Pending state: a companion away on an in-flight schedule, an NPC's in-flight schedule, two commissions (one due, one weeks away), and an unspent XP award one point short of a level. `[persist]` reads every row back through a **new connection in a separate process**, `tests/helpers/freshDbRead.mjs`. |
| 3. Protection holds | **Built** | `[protect]` group. The PC's HP, gold, gear, death saves, conditions and location are unchanged across end → claim → return, and again with the living-world tick switched on. With no opt-in there is a clean path and nothing is scheduled. "I'll be right back" adds no time. A short skip moves the clock only when opted into. The level lands at session end, not during play or on return. A failed XP score never blocks the end or the return. |
| 4. Gaps reported, not fixed | **Done** | 7 gaps (G-1 to G-7) below, each with a file, a line and the failing assertion. No product code was changed. One test bug in a sibling suite was fixed in the open (before/after below). |
| 5. Full `npm test` | **Red with cause** | Full `npm test` on the PC: Files **266/267 green**, assertions **20,577 passed, 9 failed**. The 9 red assertions are the 7 gaps, and only those. |
| 6. No :5173 pass | **Done** | Nothing driven at :5173. The final-test checks are listed under "How to verify". |

## Surveyed call chain (live bytes, this commit)

**Session end: `POST /api/dm-session/:id/end`** (`server/routes/dmSession.js:3762`, behind S1's `requireSessionCampaign`). The steps run in this order:

| # | Step | File:line |
|---|---|---|
| 1 | Zero-action early return (no rewards, no clock, no tick) | `dmSession.js:3783-3797` |
| 2 | Rewards analysis call: the stored session summary | `dmSession.js:3812-3832` |
| 3 | Orchestrator `endSession(...)`. The route passes `downtimeChoice` (default `clean`) but **no `roster` and no `spanDays`** | `dmSession.js:3862-3868` → `server/services/sessionEndService.js:120-131` |
| 3a | XP stage: the LLM scorer, then `awardSessionXP` writes `experience`, `level` and `level_up_pending_choices` **now, at session end** | `sessionEndService.js:32-52`, `server/services/xpService.js:142-160` |
| 3b | Downtime stage: clean / short skip (`advanceDays`) / full (parse against the roster, then `scheduleDowntime` with `protect_entity_ids: [pc]`) | `sessionEndService.js:54-79`, `server/services/downtimeService.js:37-99` (`parseDowntimeAssignments` :37, `scheduleDowntime`, `shortSkip` :91) |
| 3c | Domains and digest stages: stubs, marked complete | `sessionEndService.js:81-102` |
| 3d | Sweep stage: `getCurrentDay` (the **absolute** day counter), then `sweepDeferredResolutions` (companion activities, due commissions, stale commissions) | `sessionEndService.js:104-118`, `server/services/deferredResolutionSweep.js:33-91` |
| 4 | Clock measured, not invented: `getClock`, then `sessionEndDays` gives `daysElapsed` | `dmSession.js:3911-3945` |
| 5 | Stamp the character's date | `dmSession.js:3947` |
| 6 | Living-world tick, only when `LIVING_WORLD_TICK` is on (off in the MVP) and `daysElapsed > 0` | `dmSession.js:3972-3999`, `server/services/livingWorldService.js:49-79` |
| 7 | Notes, NPC and memory extraction (three model calls) | `dmSession.js:4009-4087` |
| 8 | Chronicle: `story_chronicles` row plus canon facts (the DM's memory of the session) | `dmSession.js:4112`, `server/services/storyChronicleService.js:35` |
| 9 | Chronicle roll-up (only after 10 sessions) | `dmSession.js:4129-4144` |
| 10 | Session row completed: summary, rewards, `game_end_day/year` | `dmSession.js:4149-4155` |

**Clock writers on this path.** In play, `[TIME_ADVANCE]`/`[REST]` reach `advanceTimeForSession` (`server/services/restTimeService.js:318`), then `advanceClockForSession` (`:281`), then `scheduleService.advanceHours` (`server/services/scheduleService.js:145`), which mirrors the date onto the campaign's characters only (`:103-118`). At end, the only clock writer is the short skip (`downtimeService.js` `shortSkip`, then `advanceDays`).

**Between sessions (the return).**

| Step | File:line |
|---|---|
| Claim rewards. `/start` refuses while a completed session is unclaimed | `dmSession.js:4525`; refusal at `:537-547` |
| Summary on the campaign page (claimed sessions only) | `GET /campaign-context/:id`, `dmSession.js:385` |
| Session history (claimed sessions only) | `GET /history/:id`, `dmSession.js:362` |

**Session start (the return): `POST /api/dm-session/start`** (`dmSession.js:508`).

| Step | File:line |
|---|---|
| Pending downtime narratives read, then cleared | `:637`, `:1251` |
| Narrative queue read: companion returns, commission notices | `:714` |
| Chronicle summaries read | `:938` |
| Continuation opening prompt with the last chronicle summary | `:1126` |
| Clock synced forward to the session's start date | `:1218` |
| Session row inserted | `:1224` |
| Narrative items marked delivered | `:1278` |

## Still-open gap list (product gaps; none fixed here)

Each gap's failing assertion is in `tests/return-loop.test.js` and carries its step tag and gap ID.

**G-1. The session's XP is awarded twice.** Step `[return]`.
- At session end, the orchestrator already adds the XP to `experience` (`server/services/sessionEndService.js:43` → `server/services/xpService.js:158`) and also stores it as `rewards.xp`.
- When the player presses "claim rewards", the claim route adds `rewards.xp` to `experience` **again** (`server/routes/dmSession.js:4547`).
- The level is not recomputed at claim, so the XP total and the level disagree.
- It also gives every active class-based companion the same XP (`:4589-4591`), which may be intended, since it is the companions' only award.
- Failing assertion: `[return] GAP G-1: the session's XP is awarded once — claiming does not add it again (XP after end 3791, after claim 4883, award 1092)`.

**G-2. A failed XP score is never retried.** Step `[protect]`.
- When the scorer call fails, the stage is marked `failed` (`sessionEndService.js:47-50`). `pending_llm` is set only when no model function is passed at all (`:37-40`).
- Nothing outside `sessionEndService.js` reads `session_end_runs`: `grep` finds no reader in `server/` other than the service itself.
- The next session start does not retry, so the session's XP is lost for good.
- The other half of the design does hold, and is asserted: the session ends normally and the return is not blocked.
- Failing assertion: `[protect] GAP G-2: the held XP award is retried at the next session start (stage failed, XP 2699 → 2699)`.

**G-3. The session-end sweep reads commission deadlines on the wrong day scale.** Step `[tick]`.
- The sweep passes the clock's **absolute** day counter (`sessionEndService.js:109`, `getCurrentDay`) to `processDueOrders` and `expireStaleReadyOrders` (`server/services/deferredResolutionSweep.js:48, 70`).
- Commission deadlines are set on the **day-of-year** scale (`server/services/merchantOrderService.js:429`, `currentGameDay: character.game_day`), and the living-world tick correctly uses that scale (`server/services/livingWorldService.js:226`).
- The two scales are equal only until the first new year. After that, the absolute counter is past every deadline.
- Effect: once a campaign is more than a year old, every pending commission comes due at the next session end, however far off its deadline is, and it is stamped ready on an absolute-scale day.
- The 30-day expiry then compares two different scales as well.
- Only legacy rows are affected today, because placing new commissions is blocked while `DEFERRED_RESOLUTION_ACTIONS` is off.
- Failing assertions: `[tick] GAP G-3: the commission is stamped ready on the day-of-year scale its deadline uses, day 103 (got 468 — the absolute day counter)` and `[tick] GAP G-3: the commission not due until day 150 is still being made (got ready …)`.

**G-4. Full downtime chosen at session end schedules nothing.** Step `[protect]`.
- The route never passes the roster of companions and NPCs to the orchestrator (`server/routes/dmSession.js:3862-3868`).
- So the assignment parser matches the player's words against an empty list (`sessionEndService.js:68`) and schedules 0.
- The service itself works when it is given a roster. That is asserted and passes: one schedule row, with the PC in `protect_entity_ids`.
- Failing assertion: `[protect] GAP G-4: the player's downtime assignment for TEST_RL_D Mira is scheduled (scheduled 0 — the route passes no roster)`.

**G-5. Full downtime never jumps the clock.** Step `[protect]`.
- The design comment says "Full downtime … clock jumps" (`server/services/downtimeService.js:10`), and the brief's background says the flow "jumps the clock at end".
- The full path (`sessionEndService.js:66-70`) schedules the work but never advances the clock. Only the short skip does.
- Failing assertion: `[protect] GAP G-5: full downtime jumps the clock by its span, 5 days (moved 0)`.

**G-6. The downtime opt-in can't be reached in play.** Step `[protect]`.
- The client's "end session" posts `/end` with no body (`client/src/components/DMSession.jsx:1095-1097`), so the route always takes the clean path.
- The steward's question, `promptDowntimeOptIn` (`server/services/downtimeService.js:27`), has no caller.
- The protection itself holds: no downtime happens without the opt-in. But the opt-in cannot be given.
- Failing assertions (2): `[protect] GAP G-6: the client's end-session request can carry the player's downtime choice …` and `[protect] GAP G-6: the steward's downtime question is put to the player at session end (promptDowntimeOptIn has no caller)`.

**G-7. Scene evolution is never evaluated when the clock moves.** Step `[tick]`.
- The locked time-evolution design says the tick trigger is `tickEvolution()`, which "evaluates every scene in a campaign on world-clock advance" (`server/services/timeEvolutionService.js:15`; function at `:191`).
- It has no caller anywhere: not session end, not the orchestrator, not the living-world tick, not the sweep. No evolution candidates are produced or applied at session end.
- `tickEvolution` writes nothing by design, so this assertion is a source check that some session-end path calls it.
- Failing assertion: `[tick] GAP G-7: a world-clock advance at session end evaluates scene evolution (tickEvolution has no caller; no candidates are produced or applied)`.

**Open items that are not product gaps:**
- **S-1.** Session end does not write `pending_downtime_narratives` (brief difference 2). There's nothing to write until downtime resolves anything, which is out of scope.
- **By design.** A non-companion schedule that comes due during a session (for example, an NPC's) stays `active`, because `completeDueSchedules` has no caller. Session end resolves only companion activities and commissions. This matches "resolving nothing yet". The suite asserts it as current design, so if Muse rules that session end should resolve these, that assertion flips.

## Test bug fixed (fix-as-you-find-it, in the open)

The sibling suite `tests/session-end-world-tick.test.js` scripted **five** model replies for session end. Session end makes **six** calls: the XP scorer became call 2 when the session-end orchestrator arrived. Every reply after the analysis landed one call early:
- the XP scorer got the notes text, so the XP stage failed;
- the memory extractor got the chronicle JSON, which was saved as "character memories";
- the chronicle call went unscripted, and its error was swallowed (`[Chronicle] Failed to generate chronicle: llmHarness: unscripted model call #6`).

The suite stayed green only because it never checked those three things.
- **Before:** 35/35. The chronicle, XP and memory paths were silently wrong. This is why the S1 report's "tests 1-6 still prove … chronicle" was not true.
- **After:** 38/38. The script order is analysis, scorer, notes, NPCs, memories, chronicle. Three new assertions check that the chronicle row is written from its own reply, that the XP stage completed, and that no chronicle JSON was saved as memories.
- Nothing else in that file changed.

To stop this class of bug in the new suite, `return-loop` sends each reply based on what the prompt asks for, not on call order.

## Files changed

Hashes are of the committed bytes (`git show ab52d37:<path> | sha256sum`).

| File | New / edited | SHA-256 | Bytes |
|---|---|---|---|
| `tests/return-loop.test.js` | new | `b00858b1f788bbfc254f3d10a18864baa2844f32d866b34e866beea54b28089f` | 41,221 |
| `tests/helpers/freshDbRead.mjs` | new | `f283e96bb39c70391f6c77a86a79a6c79500ef06ea895f8d3efeeb5094932d38` | 1,198 |
| `docs/pm/return-loop/BRIEF.md` | new (the brief, placed as asked) | `9b13550e53e511c763506db6906df1e8914648f1d8d13c60e40629a96d9a68ae` | 8,646 |
| `tests/session-end-world-tick.test.js` | edited (test-bug fix) | `3f13ae3c6ae72beb55febb10d6bba2297802427fe12e026e136a75125079261b` | 17,574 |
| `package.json` | edited (version) | `33a1525df0dd80d7361e1da1f2b36c4d2cc8cce663eb1761c1ec9ffa697ce79b` | 1,398 |
| `client/package.json` | edited (version) | `56111cd8699956b154994864f7f4ae4889fd9afb9004f661ffe3547435a4d625` | 427 |
| `docs/pm/reports/return-loop-REPORT.md` | new (this report) | in the follow-up commit | — |

No product code was changed and there is no migration.

## What was built (in play)

Nothing changes for the player. This is a test job. In play terms, here is what the suite now proves, and where play falls short:
- **Proven:** a session ends, and the calendar moves by exactly the time that passed in the story. A companion who was away scouting comes back with their own line. A commission that came due is ready. The level is gained at the end of the session, with its choices queued. Everything is on disk. On return, the campaign page shows the last session's summary. The DM opens the next session as a continuation: it is told what happened last time, that the companion is back, and that the commission is ready to collect. The new session starts on the day the last one ended. The PC is never hurt, robbed or killed by any of it, even with the living-world tick on. A failed XP score never stops the player from ending or coming back.
- **Falls short (the gaps):**
  - claiming rewards doubles the session's XP (G-1);
  - an XP score that failed is lost rather than retried (G-2);
  - in a campaign more than a year old, every commission becomes ready at the next session end (G-3);
  - the player cannot actually choose downtime at session end (G-6), and if they could, nothing would be scheduled (G-4) and no time would pass (G-5);
  - places never change with time (G-7).

## Test results

- **Full `npm test` on the PC, after all edits:** Files **266/267 green**, assertions **20,577 passed, 9 failed**. The file count is 266 files from before plus the new `return-loop`.
- **The one red file is `return-loop.test.js`, at 77/86.** Its 9 failures are the gap assertions, and nothing else:
  - `[tick]`: G-3 (×2), G-7
  - `[return]`: G-1
  - `[protect]`: G-4, G-5, G-6 (×2), G-2

  Every other assertion in the suite passes: `[end]` 16/16, `[clock]` 6/6, `[tick]` 10/13, `[persist]` 12/12, `[return]` 13/14, `[protect]` 19/24, cleanup 1/1. Those counts come from a separate standalone run. I ran the suite alone four times and got 77 passed, 9 failed every time.
- **Touched sibling:** `session-end-world-tick` went from 35/35 to **38/38** (the test-bug fix above).
- **Windows runner notes from the final run:**
  - `warlock-invocations` was retried once after a native crash mid-run, and passed.
  - `audit-cross-system`, `dungeon-generation`, `subclass-batch2`, `subclass-batch3` and `subclass-scanned2` counted as `pass*`: libSQL crashed on exit after all their assertions had passed.
  - `spellbook-routes` did not trip the per-file cap this time.

## Cost and usage

I can't measure this session's cost from inside Claude Code on this plan, so the figure is unknown and unverified. The work was one build session: a survey, one new suite and one helper, a 3-assertion fix to a sibling suite, a version bump, and full-suite runs. No model calls left the PC: every model call in the tests is stubbed.

## Not done / still open

- **The 7 product gaps, G-1 to G-7,** are reported, not fixed (brief item 4). Each is a follow-up job for Zach to place. Until then, `return-loop` is red with these 9 assertions.
- **S-1** (no `pending_downtime_narratives` write at session end) is reported without a test. See difference 2.
- **The :5173 final test** is not done here (brief item 6). The checks are listed below.
- **Not exercised:** the chronicle roll-up after 10 sessions (unchanged, and covered by its own suite), and a flashback session's end (unchanged, and covered by `rest-time`).

## Decisions made (reversible, for veto)

1. **Gap assertions stay real, failing assertions, so the full run is red. This is now settled by the PM (Muse, 2026-11-25):** "keep the 9 return-loop gap checks as real failures. Do not convert them to non-failing known gaps." It is no longer a builder call open for veto. Every later job's `npm test` shows `return-loop` red with exactly the 9 checks listed under "How to verify", until fix jobs close them.
2. **The loop includes "claim rewards"** because the client always claims before you can play again (`/start` refuses an unclaimed session, `dmSession.js:537-547`). *Reversal:* none needed. It mirrors play.
3. **The world clock fixture is a campaign one year in** (absolute day 465 = day 100 of 1492), which is what makes G-3 visible. Both scales are kept in sync, as `scheduleService` requires. *Reversal:* change one constant. On a first-year clock, the G-3 assertions would pass by coincidence.
4. **G-7 and G-6 are source checks, not behavior checks.** `tickEvolution` writes nothing by design, and the opt-in gap is a missing call in the client. *Reversal:* when a fix job wires them, it should replace each source check with a behavior check.
5. **Cleanup deletes dependent rows generically:** any row in any table whose `session_id`, `companion_id` or `character_id` points at one of this suite's own `TEST_RL_` ids. Session end and start write into many side tables, and a hand-kept list had already missed two. *Reversal:* replace it with an explicit table list.
6. **Version bump to 1.0.221** (`package.json`, `client/package.json`). *Reversal:* two lines.

## Needs Zach's decision

None. Muse settled decision 1 on 2026-11-25: the gate stays red with exactly the 9 gap checks until fix jobs land.

## How to verify

**Gate:** run `npm test` from `E:\DnD Meta Game\dnd-meta-game` on the PC. Expect Files 266/267, Assertions 20,577 passed, 9 failed. The only red file should be `return-loop.test.js`, with exactly the 9 failing checks in the table below. Any other red line is a real failure. To see the suite alone, run `npm test -- return-loop`.

The 9 expected failures, by name. Each line starts with its step tag and gap ID. The text in brackets after the name shows the values seen on the builder's run.

| # | Step | Gap | Failing check (exact name) |
|---|---|---|---|
| 1 | `[tick]` | G-3 | `GAP G-3: the commission is stamped ready on the day-of-year scale its deadline uses, day 103` |
| 2 | `[tick]` | G-3 | `GAP G-3: the commission not due until day 150 is still being made` |
| 3 | `[tick]` | G-7 | `GAP G-7: a world-clock advance at session end evaluates scene evolution` |
| 4 | `[return]` | G-1 | `GAP G-1: the session's XP is awarded once — claiming does not add it again` |
| 5 | `[protect]` | G-4 | `GAP G-4: the player's downtime assignment for TEST_RL_D Mira is scheduled` |
| 6 | `[protect]` | G-5 | `GAP G-5: full downtime jumps the clock by its span, 5 days` |
| 7 | `[protect]` | G-6 | `GAP G-6: the client's end-session request can carry the player's downtime choice` |
| 8 | `[protect]` | G-6 | `GAP G-6: the steward's downtime question is put to the player at session end` |
| 9 | `[protect]` | G-2 | `GAP G-2: the held XP award is retried at the next session start` |

A later job's run should be red with exactly these 9, and no others. The exceptions:
- **A new failure** is a real failure, and that job must report it.
- **One of these 9 turning green** means a fix job closed that gap. That job should say so, and the expected count drops.
- **These checks are never edited to pass** (PM decision, 2026-11-25).

**Final test at :5173 (the one end-of-build pass, not this job's).** With `npm run dev`, on a character in a campaign:
1. Play a short session in which time passes in the story (travel, or a rest). Note the date shown, the character's XP and level, HP, and gold.
2. Click **End session**. The summary appears, with the XP earned. Note the XP shown on the character sheet before you claim.
3. Click **Claim rewards**. **Check G-1:** the XP on the sheet should not go up a second time by the same amount. Today it does.
4. Close the browser tab. Reopen `:5173` and pick the same character. The **Campaign** page should show the last session's summary and the date it ended. That date should be later than the start date by the time that passed in the story.
5. Click **Play** and continue the campaign. The DM's opening should pick up from where you left off and mention anything that happened while you were away, such as a companion returning. The date should be the one the last session ended on.
6. HP, gold and gear should be exactly as you left them, apart from anything spent in play.
7. **Check G-6:** at **End session**, you are never asked what your people should do while you're away. That is the open gap. Today the end is always a clean end.

**Evidence:** commit `ab52d37` on `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. The SHA-256 for every changed file is in the Files table.
