# Report — stabilize-recovery-alignment: every stabilization starts the 1d4 recovery, and a stable companion is stored one way

## Understanding

**The project.** DnD Meta Game is a solo D&D 5e (2024 rules) game. A local AI model (gemma4:12b) narrates as the Dungeon Master, and the engine keeps the rules honest. The engine tracks HP, death saves, the clock and companions. It never rolls the player's dice for them, and the DM narrates around what the engine records.

**This job.** The 2024 book says a stable creature regains 1 HP after 1d4 hours. That applies however the creature became stable. Before this job, only a Healer's Kit stabilization started that clock. Two other routes did not: a Medicine check, and three successful death saves. Those two routes also reset a companion's death-save tallies to 0/0. A stabilized companion at 0 HP with 0/0 tallies looks exactly like a dying one, and the DM's prompt showed it that way. So the job has two parts:
- Every route to stable starts the 1d4 recovery. The engine rolls a companion's d4. The player rolls their own d4, through the same ask the kit uses.
- Every route leaves the same stored state the kit leaves: successes 3, failures 0, at 0 HP. Damage at 0 HP clears it.

**What I found in the live code.**
- **Three test pins, not two.** The brief names two `integration.test.js` expectations that pin the old 0/0 reset. A third one sits in `tests/healers-kit-stabilize.test.js`, group 8 ("Medicine stabilize … counters reset exactly as before"). I updated it the same way, with a comment saying why.
- **The player's 3-success route** is `characterHpService.rollDeathSave`. Its only caller is the death-save settle in `server/routes/dmSession.js`. It had no session in scope, so it now takes an optional `{ sessionId }` argument.
- **No DM prompt change was needed.** `formatCompanionDeathSavesLine` in `dmPromptBuilder.js` already shows successes 3 at 0 HP as "Stable at 0 HP".
- **No migration.** The `stable_recover_at` column from migration 119 already exists on both `characters` and `companions`.

Nothing in the brief conflicted with the live build.

## Verdict

**BUILT + RED-with-cause.** The only failures are the 5 standing named gaps in `return-loop.test.js`. No new failures.

## Per-item verdicts

| Item | Verdict | Evidence |
|---|---|---|
| 1a. A Medicine-check stabilization sets the recovery hour (engine rolls the d4) | Done | `stabilize-recovery-alignment.test.js` group 1 |
| 1b. Three successes sets the recovery hour: the player is asked for the d4, and the player's number settles it | Done | group 3 |
| 1b. Three successes sets the recovery hour: a companion gets an engine d4 | Done | group 2 |
| 1. The recovery firing is unchanged | Unchanged | `restTimeService.js` not touched; groups 1–3 show it firing on `advanceClockForSession` |
| 2. Medicine and 3-success routes store a stable companion as successes 3 / failures 0 | Done | groups 1 and 2; updated integration and kit expectations |
| 2. The death-save route refuses for any stable companion | Done | groups 1 and 2 (400, the stable state holds) |
| Damage at 0 HP clears the stable state and the recovery hour on every route | Done (the damage code already did this; now covered on the new routes) | group 4 |

## Files changed

Commit `f73d40e` on `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Parent: `a02b973`. 11 files, +397 / −26. No migration.

| File | New/Edited | Size (bytes) | SHA-256 |
|---|---|---|---|
| server/services/healersKitService.js | edited: adds `startStableRecovery` | 21257 | f9c0ebc7f1a1f0978ef4ec21c472dd74498b01f3112b03d83a20549cc56ba7a2 |
| server/services/characterHpService.js | edited: `rollDeathSave(id, d20, { sessionId })` starts the recovery when the player stabilizes | 21559 | 09ecc30b6e0955a3a0701e6dda7751e4c7ad6aba4033842c4cab7918f5c93a9e |
| server/routes/companion.js | edited: Medicine route and 3-success death-save route hold successes 3 and start the recovery | 74903 | 9e11f9bbb3b6d9f133050d59f501da61652d71fe54c20bc29618c6b2ecf49d06 |
| server/routes/dmSession.js | edited: passes the session to `rollDeathSave`; the DM fact says the player rolls 1d4 | 243219 | 9c6885a7f66be3f69bcfeeaa1e3b1ac229014df7f29dc77923358161dd52523f |
| client/src/components/CompanionSheet.jsx | edited: Stabilize shows the returned tallies instead of a hard-coded 0/0; button tooltip | 56059 | 6f09ad1f40682c9c1ae3a383565ef05920310ab03b9dc3bc7154ffb342f83f9b |
| tests/stabilize-recovery-alignment.test.js | **new** (32 assertions) | 15651 | aef83f7ea2e0343512c25d30060b6d35eff129a46484604d95543c776f86826d |
| tests/integration.test.js | edited: 2 expectations updated, with comments | 154324 | 58a79dca3c2d7114f6359a393cef526d03e23301f9b6ac072f80b810fc797bb6 |
| tests/healers-kit-stabilize.test.js | edited: 1 expectation updated, with comment; header line | 26404 | 63b4781567a562b63516c297278f5c806edf9a08d4e3e8052fd3b3d2b7c9947c |
| package.json | edited: version 1.0.227 → 1.0.228 | 1398 | 62c9ccefcac1b6a98dd9d359a3998e1a8cf7936133b23969674bc35f4c392790 |
| client/package.json | edited: version 1.0.227 → 1.0.228 | 427 | e3f435954f1858a9f0ead059ef91f2d42cb2e078253d807ca38e4f7671f7defa |
| docs/pm/stabilize-recovery-alignment/BRIEF.md | **new** (the brief, placed as given) | 4790 | 4bca82ce4aec27a9dee14123191566375e18d46ac7aa0b56f2a97b0dd0c0e1ab |

This report is committed separately after the code commit.

## What was built (in play)

- **A companion stabilized by a Medicine check** stays down at 0 HP, unconscious, and no longer makes death saves. The engine rolls its d4. When the clock passes that many hours (a TIME_ADVANCE or a rest), it wakes at 1 HP. The DM's prompt now shows it as "Stable at 0 HP — unconscious, no death saves" instead of as dying. On the companion sheet, the Stabilize button now shows three green success pips.
- **A companion that makes its third successful death save** behaves the same way: stable, an engine-rolled d4, and 1 HP when the clock passes the hour.
- **The player character's third successful death save** leaves them stable. The player sees "🎲 You're stable. Roll a d4 and send the number…", the same ask the Healer's Kit uses. Their number sets the hour, and they wake at 1 HP when the clock passes it. The DM's system fact now also says the player rolls 1d4 for the hours.
- **Taking damage while stable at 0 HP**, on any route, ends the stable state: one failed death save, and the recovery hour is cleared. Death saves resume, and no HP returns when the old hour passes.
- **The Healer's Kit is unchanged** in every particular: uses, refusals, the ⚙ lines, and the d4 ask.

## Test results

**Full `npm test` from the repo root**, after all code edits: **272/273 files green, 20,820 assertions passed, 5 failed.**

The only red file is `return-loop.test.js` (81/86). It fails exactly the five standing named checks:
1. `[tick] GAP G-7: a world-clock advance at session end evaluates scene evolution`
2. `[protect] GAP G-4: the player's downtime assignment for TEST_RL_D Mira is scheduled`
3. `[protect] GAP G-5: full downtime jumps the clock by its span, 5 days`
4. `[protect] GAP G-6: the client's end-session request can carry the player's downtime choice`
5. `[protect] GAP G-6: the steward's downtime question is put to the player at session end`

No new failures.

**Windows runner notes, as the runner printed them:**
- `creator-gaps-batch` and `ek-at-prepared-cap` were retried once after a native crash, and both passed on the retry.
- Seven files were marked `pass*`, meaning a native crash on exit after all their assertions had passed: bestiary-full, companion-sheet, item-1b-cleave-push-slow, item-2a-features, magic-item-discovery, npc-bank-wiring, subclass-batch3.

**Why the totals moved:**
- Files went from 271/272 to 272/273: that is the one new suite.
- Assertions went from 20,789 to 20,820, which is +31, but the new suite has 32. The gap is most likely the `pass*` files: some of them print no assertion count when they crash on exit, and which files crash changes from run to run. That attribution is an inference, not checked. The suites this job touched report the same counts as before plus the new 32. No assertion was removed.

**Suites this job touched:**
- `npm test stabilize-recovery`: 32 passed, 0 failed (new).
- `npm test healers-kit`: 66 passed, 0 failed. This was rerun after a final comment-only header edit, made after the full run.
- `npm test integration`: 498 passed, 0 failed.

All runs went through `npm test`. No test file was run directly with node.

## Cost and usage

Unknown. Nothing in this session measures cost or the remaining usage against the $30/month cap. No live model calls were made.

## Not done / still open

- **The live probe was not run.** The brief marks it optional. Suite group 1 covers the same scene: a companion stabilized by Medicine check regains 1 HP when the clock passes its recovery hour.
- **The companion death-save route still rolls its own d20** with `Math.random` when no roll or outcome is sent. That roll is for the DM's creature, so it is not a rule breach. It was already there and is outside this brief; noted only.
- **The recovery's HP-change reason for the player still reads "healer's kit recovery"**, even when the stabilization came from another route. The text is only a log label and nothing reads it. Left alone, because the brief fences the kit code.

## Decisions made (reversible, for veto)

1. **One shared function**, `startStableRecovery` in `healersKitService.js`, is used by both non-kit routes. The kit's own code was left as it was rather than moved onto the shared function, per the fence. Reversal: cheap. The function is small and could be inlined.
2. **`rollDeathSave` takes an optional third argument**, `{ sessionId }`. Without a session the player is stable but no d4 is asked, the same as the kit's no-session behavior. Reversal: cheap.
3. **The third pinned test in `healers-kit-stabilize.test.js` group 8**, which the brief did not name, was updated the same way as the two named ones, with a comment. Reversal: none sensible, because it asserted the mismatch this job removes.
4. **Companion sheet fix-along.** The Stabilize button had hard-coded 0/0 in the client. It now shows what the server returns, and the tooltip text changed. Reversal: a two-line revert.
5. **The DM's death-save system fact** now adds "The player rolls 1d4 for the hours until they regain 1 HP" when the player stabilizes, the same wording as the kit's DM note. Reversal: a one-line revert.

## Needs Zach's decision

Only the gate: a full `npm test` run on the PC.

## How to verify

1. On the PC: `git pull origin phase-4-hybrid-combat`. Head should be the report commit, with `f73d40e` as its parent.
2. Run `npm test` from the repo root. Expected: red-with-cause, exactly the 5 GAP checks above in `return-loop.test.js`, and nothing else red. `stabilize-recovery-alignment.test.js` should show 32/32.
3. Browser check at :5173:
   1. Open a companion's sheet.
   2. Put the companion at 0 HP. The Death Saves box appears.
   3. Press **Stabilize**. All three success pips should be green, not cleared.
   4. Press **Roll Death Save**. It is refused with "Companion is stable — no death save needed".
   5. Advance game time by 4 or more hours (a rest or a TIME_ADVANCE). The companion should be at 1 HP.
