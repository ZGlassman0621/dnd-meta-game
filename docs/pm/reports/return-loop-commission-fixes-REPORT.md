# Report — return-loop-commission-fixes: commission deadlines are read on the scale they were set on

## Understanding

The DnD Meta Game is a solo D&D 2024 "forever game". One human player character plays in a persistent Forgotten Realms world, and a local AI acts as Dungeon Master, NPCs, companions and enemies. A core MVP promise is **leave and return**: what you set in motion keeps its shape while you are away. Ordering an item from a smith ("a commission") is one of those things. It should be ready when its making time is up, and it should wait for you for a collection window before the smith sells it on.

This job fixes one bug in the commission system. The game clock counts days in two ways:
- an **absolute** counter that never resets (day 465);
- the **day of the year** (day 100 of 1492).

Commission deadlines are written as day-of-year. At session end, the sweep that resolves due commissions compared them against the absolute counter. The two counts are the same only during the campaign's first year. After that, every waiting commission became ready at the next session end, however far off its deadline was. It was also stamped ready with the wrong kind of number, so its 30-day collection window was measured wrong too.

My understanding matches the brief. One finding goes beyond it: the day-of-year scale itself has a year-end edge. See **Needs Zach's decision**.

## Verdict

BUILT + RED (red-with-cause): the full run's only failures are the 5 remaining return-loop gap checks, named below. The two G-3 checks now pass without being edited.

## Files changed

| File | New/edited | Size (bytes) | SHA-256 |
|---|---|---|---|
| `server/services/deferredResolutionSweep.js` | edited | 5,125 | `6f4717c89ad49fe980dd5a9a5e67f9788b31d0a4404c31d9ab14626f560867fe` |
| `server/services/sessionEndService.js` | edited | 14,089 | `3200466178e4ef8864700cd0483f95ef7e49a458a79696816ed41c530052eb44` |
| `tests/deferred-resolution-sweep.test.js` | edited (+16 assertions) | 14,569 | `0823936d70864bed456b60c12d2e3d50fcb2ac4dc5c4ded55d87136f26ab4884` |
| `package.json` | edited (1.0.225 → 1.0.226) | 1,398 | `66408703cf44ca089bab310d682c1333c8aaffc9e2fbcfcd9be93be05c607fa1` |
| `client/package.json` | edited (1.0.225 → 1.0.226) | 427 | `6ecd9794c28e27e887a5fa7bcd5290eaff42bd70c745ba62535d0af204c485bf` |
| `docs/pm/return-loop-commission-fixes/BRIEF.md` | new (the brief, as handed over) | 11,631 | `7d7f15dc47b62854e38e22520dc84bb3e36dcc35e79578b512a6e8443d2e66af` |
| `docs/pm/reports/return-loop-commission-fixes-REPORT.md` | new (this report) | — | — |

No migrations. `tests/return-loop.test.js` was not touched.

## What was built (in play)

On a campaign more than a year old, a commission now behaves the same as in the first year:
- It is still being made until its deadline day arrives.
- On that day it becomes ready, and the DM is told at the next session, as before.
- It waits for you for 30 days, counted from its ready day.
- On the 31st day the smith sells it on, and the DM is told, as before.

A companion sent away still comes back when their time away is up, on the same count as before; that part was already correct.

Today this affects only commissions already in the database. Placing new commissions is still blocked while `DEFERRED_RESOLUTION_ACTIONS` is off, and that is unchanged.

## Per-item verdicts

### 1. Survey every day-scale comparison first — DONE

Base: `phase-4-hybrid-combat` at **`74d48fb`** (pulled 2026-11-27, already up to date). It includes the experience fixes (`bf8c889`, return-loop-xp-fixes) and the later level-up jobs up to `4eca490`/`74d48fb`.

The clock (`server/services/scheduleService.js:6-11, 62-71`) keeps two scales in sync:
- `day`, the absolute counter. `entity_schedule` start and end days live on this scale.
- `dayOfYear`, the Harptos day of the year. `characters.game_day` and the deadline columns live on this scale.

`getCurrentDay()` (`scheduleService.js:99-101`) returns the **absolute** `day`.

**Commission writes and comparisons (`merchant_orders`):**

| Where | What | Scale |
|---|---|---|
| `merchantOrderService.js:429` (`MERCHANT_COMMISSION` handler) | `currentGameDay: character.game_day` | day-of-year |
| `merchantOrderService.js:110-116` (`placeCommission`) | writes `commissioned_game_day = currentGameDay`, `deadline_game_day = currentGameDay + leadTimeDays` | day-of-year (from above) |
| `merchantOrderService.js:445` | tells the DM "ready … (day `game_day + lead`)" | day-of-year |
| `merchantOrderService.js:302-309` (`processDueOrders`) | `deadline_game_day <= ?` | whatever the caller passes |
| `merchantOrderService.js:249-255` (due consumer) | writes `ready_game_day = currentGameDay` | whatever the caller passes |
| `merchantOrderService.js:338-346` + consumer `:268-290` | `(? - ready_game_day) > 30` and threshold 31 from `ready_game_day` | whatever the caller passes |
| `merchantOrderService.js:183-188` (`collectOrder`) | writes `collected_game_day = ready_game_day \|\| deadline_game_day` | copies a stored value (day-of-year) |
| `livingWorldService.js:226, 228, 243` (tick step 3.9) | `ordersGameDay = tickClock.dayOfYear` → `processDueOrders` / `expireStaleReadyOrders` | **day-of-year — correct** |
| `deferredResolutionSweep.js:48, 70` (before) ← `sessionEndService.js:112` (before) | `gameDay = getCurrentDay(campaignId)` → `processDueOrders` / `expireStaleReadyOrders` | **absolute — the G-3 bug** |

**Sibling callers on the same path:**

| Where | What | Scale | Verdict |
|---|---|---|---|
| `deferredResolutionSweep.js:40` ← `sessionEndService.js:112` | `checkAndResolveActivities(campaignId, gameDay)` (companion away-activities) | absolute | correct: activities are `entity_schedule` rows on the absolute scale |
| `livingWorldService.js:135-137` (tick step 3) | `checkAndResolveActivities(campaignId, tickClock.day)` | absolute | correct, the same split the sweep now uses |
| `companionActivityService.js:69, 86` ← `routes/companion.js:1987` | activity `start_day` from `getCurrentDay()` | absolute | correct |
| `routes/companion.js:2018` | `recallCompanion(…, getCurrentDay())` | absolute | correct |
| `sessionEndService.js:70` (downtime stage) | `startDay = getCurrentDay()` → `parseDowntimeAssignments` → `entity_schedule` | absolute | correct |
| `downtimeService.js:94` | `getCurrentDay()` after `advanceDays` | absolute | correct |

**Other deadline columns** are outside this job's path and were not changed:
- every other tick step (`livingWorldService.js:101, 123, 154, 168, 190, 206, 271`) reads `tickClock.dayOfYear` against day-of-year columns: world events, base threats, mail, consequences, notoriety;
- the promise and quest deadlines in `dmPromptBuilder.js:1862-1971` and `consequenceService.js` compare `game_day` values with each other.

None of them mixes the two scales. No other caller of `processDueOrders`, `expireStaleReadyOrders` or `sweepDeferredResolutions` exists (grep over `server/` and `tests/`).

### 2. Read deadlines on the scale they were set on — DONE

- `sessionEndService.js` sweep stage: it now reads the whole clock (`getClock(campaignId)`) instead of only the absolute day, and hands the clock to the sweep.
- `deferredResolutionSweep.js`: companion activities get `clock.day` (absolute, unchanged), and both commission calls get `clock.dayOfYear`. This mirrors the living-world tick exactly.
- A bare number is still accepted and means both scales are equal (a first-year clock). Only the existing first-year test block uses that form.
- No production caller passes a number.

On the return-loop fixture (absolute 468 = day 103 of the second year):
- the commission due on day 102 is stamped ready on **day 103** (before: 468);
- the commission due on day 150 is **still pending** (before: ready).

Before and after on a second-year clock, from the new `deferred-resolution-sweep` checks. "Before" is the same test run against the pre-fix code, which failed 8 checks:

| Case (clock: absolute 465 = day 100) | Before | After |
|---|---|---|
| Commission due day 98: status / ready stamp | ready / **465** | ready / **100** |
| Commission due day 150 | **ready** (stamp 465) | **pending**, no stamp |
| Ready since day 80 (20 days held) | **expired** | still held |
| Ready since day 60 (40 days held) | expired | expired |
| Day-100-ready commission on day 130 (30 held) | — | still held |
| Same on day 131 (31 held) | — | expired |
| Day-150 commission on day 131 | **expired** | still pending |
| Companion activity ending absolute 460 / 470 | completes / stays away | completes / stays away (unchanged) |

### 3. Legacy rows — DONE, no migration needed

The PC's database is `local.db` at the repo root. `.env` has no `TURSO_DATABASE_URL`, so `server/database.js:10-12` uses `file:local.db`. I read it before building, read-only:
- **`merchant_orders` has 0 rows**;
- every `world_clock` row is in year 1492, with absolute day equal to day-of-year (the highest is campaign 1 at day 345).

No commission anywhere was stamped ready on the wrong scale, and no clock has passed a new year yet, so there is nothing to convert. This job writes no data migration. Converting legacy stamps would not be possible in general anyway: orders carry no year column, so a wrong absolute stamp cannot be told apart from a later year's day-of-year without the clock history.

### 4. Fix-as-you-find-it — DONE: no sibling scale mix

The survey found no second place that compares the two scales (table above). Companion activities share the sweep path with commissions, and they were already on the right scale. They stay on it, and the new test now checks that explicitly: an activity ending on absolute day 460 resolves on a clock reading day 100.

I found one test issue. Its first block leaves rows that the new second-year block's sweep picks up: an activity ending on day 103, and a commission stamped ready on day 100. I counted them in the second-year expectations and say so in the test comments, so the counts are exact rather than loose.

The fix changes no model calls, neither their number nor their order: the sweep makes the same calls. `session-end-world-tick.test.js` (38/38) and `session-end.test.js` pass.

### 5. The other assertions stay red, untouched — DONE

`tests/return-loop.test.js` is unedited (`git diff` shows no change to it). The 5 remaining gap checks fail with their exact names, listed under **Test results**.

## Test results

Full `npm test` from the repo root on the PC, run by me (not the gate), base `74d48fb` plus this job:

```
Files: 269/270 green  |  Assertions: 20698 passed, 5 failed
Retried once after a Windows native crash mid-run (result shown is the retry's): creator-next-stage6-commit.test.js → pass, downtime-rest.test.js → pass
pass* (Windows native exit crash AFTER all assertions passed — counted green, see run-tests.js): artificer-class.test.js, companion-engine.test.js, subclass-batch1.test.js
```

- The retries and `pass*` files are runner artifacts, not failures. libSQL's native crash on Windows is handled by `server/scripts/run-tests.js`.
- **`return-loop.test.js`: 81 passed / 5 failed** (86 assertions). This is the expected count with the experience fixes landed.
- **`deferred-resolution-sweep.test.js`: 34/34** (was 18; +16 second-year assertions).
- `session-end-world-tick.test.js` 38/38. `session-end.test.js` pass.

G-3 assertions, now passing (assertion text unedited; the "got" note inside the text is the original wording):
- `✓ [tick] GAP G-3: the commission is stamped ready on the day-of-year scale its deadline uses, day 103 (got 103 …)`
- `✓ [tick] GAP G-3: the commission not due until day 150 is still being made (got pending …)`

Still red, exact names. These are the only failures in the run:
1. `[tick] GAP G-7: a world-clock advance at session end evaluates scene evolution`
2. `[protect] GAP G-4: the player's downtime assignment for TEST_RL_D Mira is scheduled`
3. `[protect] GAP G-5: full downtime jumps the clock by its span, 5 days`
4. `[protect] GAP G-6: the client's end-session request can carry the player's downtime choice`
5. `[protect] GAP G-6: the steward's downtime question is put to the player at session end`

Totals versus the last recorded full run (20,650 passed / 7 failed, at `84c40f5`): the two G-3 checks moved to passed, the 16 new sweep assertions were added, and the level-up-off-by-one job added assertions in between.

### Incident: one test file run outside the runner, against the live local DB

After the full run, to read the G-3 lines verbatim, I ran `node tests/return-loop.test.js` directly instead of `npm test return-loop`. That skips the runner's throwaway-database redirect, so the test ran against the live `local.db`. What it did, checked afterwards by comparing the live DB with the snapshot taken during the run:
- **The test's own fixtures were created and removed again.** None are left: no `TEST%` characters, NPCs, merchants or commissions; `world_clock` is back to 18 rows.
- The pre-existing data is unchanged: character 1 Kyle Testman (L1, day 345 of 1492), campaign 1 and its clock, session 1.
- **Pending migration 118 (`118_class_levels_backfill`, from the level-up-off-by-one job) was applied at 2026-11-27 22:55:16 UTC.** The server would apply it on its next start anyway. It only fills `class_levels` for level-1 playable characters that have none.
- **Six session-end snapshots** were written to `backups/` (`local-2026-11-27T22-55-18-720Z.db` … `T22-55-28-600Z.db`), because the session-end backup is switched off only inside the runner. They are gitignored and contain the test's temporary rows. I left them in place rather than delete anything. They are safe to delete.
- That direct run printed 69 passed / 6 failed. It is not a valid result: no dead model port, no backup switch-off, the live DB. The runner's 81/5 is the result.

The live DB holds test data only (handoff §4). I have recorded the rule — single suites only through `npm test <name>` — so it does not recur.

## Cost and usage

I can't measure this session's cost or the remaining allowance from inside Claude Code. It was a small job: one full suite run, and a few single-suite runs (including the incident run above).

## Not done / still open

- **Commission deadlines across a year end (pre-existing, found in the survey; not built).** See the first question under **Needs Zach's decision**. The tick has the same behaviour.
- Downtime (G-4, G-5, G-6 ×2) and scene evolution (G-7) stay red, as the brief requires.
- No browser test, by design.

## Decisions made (reversible, for veto)

1. **The sweep takes the whole clock, not two loose numbers.** `sweepDeferredResolutions(campaignId, characterId, clock)` reads `clock.day` for companion activities and `clock.dayOfYear` for commissions. A bare number is still accepted as "both scales equal", for the first-year test only.
   - Reversal cost: one function signature and one caller, about 10 lines.
2. **Day-of-year was kept as the commission scale, as the brief settled.** Moving commissions to the absolute counter would also fix the year-end edge. But it needs a rewrite of the order placement, the DM's "ready on day N" text and the tick, plus a migration of stored deadlines that have no year to convert from.
   - Reversal cost: that rewrite, plus the conversion question.
3. **No data migration.** Zero commission rows exist (evidence in item 3).
   - Reversal cost: none.

## Needs Zach's decision

1. **What should happen to a commission whose making time runs past the end of the year?**
   - Commission deadlines are stored as a day of the year with no year attached (`merchantOrderService.js:116`: deadline = today's day-of-year + making time).
   - So an order placed on day 360 with a 10-day making time is due on "day 370". The Harptos calendar has 365 days (366 in a Shieldmeet year), so day 370 never comes, and that commission would never become ready.
   - The same applies to the collection window. A commission ready on day 360 is measured against day 10 of the next year as "minus 350 days held", so it never expires.
   - The living-world tick has the same behaviour. This job's fix did not introduce it, and the brief's day-of-year decision keeps it.
   - What I checked: the stored columns (migration `033_merchant_orders.js:28-29`, no year column), placement, both resolvers and the clock's day-of-year wrap (`server/config/harptos.js`).
   - Still unclear, and yours or the PM's to decide: whether to fix this now or leave it as a known edge until commissions are switched on (`DEFERRED_RESOLUTION_ACTIONS`, off today). A fix would mean either (a) adding a year to each commission and comparing year plus day, or (b) moving commissions onto the absolute counter. Either is a separate job with a migration.
   - Today it can't happen in play: commission placement is blocked, and no rows exist.

## How to verify

**Gate:** `npm test` from `E:\DnD Meta Game\dnd-meta-game`.
- Expect `Files: 269/270 green | Assertions: 20698 passed, 5 failed`, with `return-loop.test.js (81/86)`, and only the 5 named gap checks red.
- Runner artifacts (retries, `pass*`) may name different files on a different run, and they are not failures.
- Any other red line is a real failure.

**Commit evidence:** branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. The commit hash is in the push that carries this report (`git log -1 -- docs/pm/reports/return-loop-commission-fixes-REPORT.md`). File hashes are in the table above.

**Final-test checks (the one browser pass at the end, not per job):** a commission across a year boundary **cannot be staged by hand** in the browser today.
- Placing a commission is blocked while `DEFERRED_RESOLUTION_ACTIONS` is off, and the brief keeps it off.
- Reaching a second-year clock by hand means playing or advancing past day 365.

Coverage for this behaviour is the automated tests:
- `return-loop.test.js` `[tick] GAP G-3` ×2;
- `deferred-resolution-sweep.test.js` `[year 2]` ×16.

If commissions are switched on later, the hand check is:
1. On a campaign clock past its first year, commission an item with a short making time, then end the session.
2. Next session, the DM must not say it is ready before its stated day.
3. After the stated day passes and a session ends, the DM says it is ready for pickup.
4. Leave it uncollected for more than 30 in-game days, then end a session: the DM says the smith sold it on.
