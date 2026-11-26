# Report — return-loop-xp-fixes: experience is awarded once, and a failed score is retried

Builder: Claude Code (Opus 5.5). Brief: `docs/pm/return-loop-xp-fixes/BRIEF.md` (2026-11-26).
Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.221 → **1.0.222**.

## Understanding

When a session ends, the session-end orchestrator scores the session and awards the player character's experience. That award sets experience, level and level-up choices together, because the level lands at session end (locked 2026-10-19). The claim-rewards step then added the same experience a second time (gap G-1). When the scoring call failed at session end, the award was lost: nothing ever read the held stage again (gap G-2). This job fixes those two gaps only. The other five return-loop gaps stay red, unchanged.

**Differences from the brief, checked against live bytes:**
1. All the line numbers the brief cites were correct at `ab52d37` (`dmSession.js:4547`, `:4589-4591`, `sessionEndService.js:37-40`, `:47-50`).
2. With the return-loop fixture, the double award did not make the level and the total disagree. 4,883 XP is still level 4 (the band runs 2,700–6,500). The disagreement the brief describes happens only when the second award crosses a level threshold, because claim never recomputed the level. After this job, claim no longer writes experience, so the case cannot arise.

## Verdict

**BUILT + RED-WITH-CAUSE.** G-1 and G-2 now pass without being edited. The only red file is `return-loop` at 79 passed / 7 failed, and those 7 are the remaining gap assertions, named below. Every other file is green.

## Per-item verdicts

| # | Item | Verdict |
|---|---|---|
| 1 | Survey every XP award path first | **Done.** The table is below. |
| 2 | The player character's session XP is awarded exactly once | **Done.** Claim no longer writes `experience`. The session-end award is the only one, and the level agrees with the total. |
| 3 | Companions get the award exactly once, whichever path is theirs | **Done.** Claim is the companions' only award, so it stays there, now guarded by a once-only marker. The retry pays companions when the session was claimed before its score landed. |
| 4 | Retry a failed or held score at the next session start | **Done.** The retry runs once, guarded by a conditional claim on the stage row. A retry that fails again blocks nothing. |
| 5 | Fix-as-you-find-it | **One sibling fix:** the claim route could pay out twice if two claims ran at once. It now takes the claim atomically. No other route double-awards experience (see the table). No test bugs were found. Session end and session start make the same model calls as before, except a new start-time scorer call that happens only when a held stage exists. The sibling suites that script those calls (`session-end-world-tick` 38/38 and the rest) stay green. |
| 6 | The other seven assertions stay red, untouched | **Done.** No gap assertion was edited. `tests/return-loop.test.js` is unchanged. |

## Surveyed award-path table (every experience write, live bytes before the fix)

**Player character (`characters.experience`):**

| Path | File:line (before) | When | Same stored session reward? |
|---|---|---|---|
| Session-end orchestrator → `awardSessionXP` | `server/services/sessionEndService.js:43` → `server/services/xpService.js:158` | DM session end | **Canonical.** Writes experience, level, experience_to_next_level and level_up_pending_choices. |
| DM session claim | `server/routes/dmSession.js:4547`, written at `:4572` | Claim rewards | **Yes, a double award (G-1).** Added `rewards.xp` again with no level recompute. **Removed.** |
| Retry of a held score | none existed | — | **G-2.** Now `sessionEndService.js:189` (`retryHeldXpAwards`), awarding through `awardSessionXP`. |
| Time-based adventure claim | `server/routes/adventure.js:250`, `:332` | Adventure claim | No. The adventure's own results; its only award. |
| Downtime activity | `server/routes/downtime.js:1670` | Downtime | No. Its own benefits. |
| Quest reward | `server/services/questService.js:306` | Quest completion | No. Behind `PROGRESSION_AWARDS`. |
| Achievement reward | `server/services/achievementService.js:244` | Achievement | No. Behind `PROGRESSION_AWARDS`. |
| Manual grant | `server/routes/character.js:6802` (`POST /grant-xp/:id`) | Tool route | No. |
| Resets to 0 | `server/routes/character.js:3253`, `:6777`, `:6831` | Resets | — |

**Companions (`companions.companion_experience`):**

| Path | File:line (before) | When | Notes |
|---|---|---|---|
| DM session claim | `server/routes/dmSession.js:4589-4607` | Claim rewards | **Their only session award.** Session end never touches companions (`awardSessionXP` writes `characters` only). Kept at claim and guarded. |
| Retry of a held score | none existed | — | Now `sessionEndService.js:247` (`settleSessionRewards`), only when the session was already claimed. |
| Companion away-activity outcome | `server/services/companionActivityService.js:523` | Activity resolves | No. The activity's own `xp_gained`. |
| Adventure claim | `server/routes/adventure.js:386` | Adventure claim | No. The adventure's own results. |

**Evidence for item 3:** session end awards companions nothing. In the new suite, `[once] session end does not award the companion (the claim is its award)` passes against both the old and the new code.

**Other reward fields at claim:** gold, loot and the HP change are awarded only at claim. Session end stores `gold: 0`, `loot: null` and `hp_change: 0` and applies none of them. Their behavior is unchanged.

## The fix

**Claim** (`server/routes/dmSession.js:4547`):
- It no longer writes `experience`. `rewards.xp` stays as the record of the award, for the claim screen and session history.
- It takes the claim atomically with `UPDATE … SET rewards_claimed = 1 WHERE … AND rewards_claimed = 0` (`:4564`). If something fails before the character row is written, the claim is released so the player can claim again. After the row is written, the claim is never released, so a retry cannot pay out twice.
- Companions are paid through `awardCompanionSessionXP` (`sessionEndService.js:145`, moved out of the route). The award is recorded as `rewards.companionXpAwarded`, and a session that carries that marker pays companions nothing more.

**What the retry scores from:**
- When the XP stage is marked `failed` or `pending_llm`, its `session_end_runs.detail_json` now stores `sessionData`: the session narrative (every assistant message) and the character's level at session end, exactly what the end route scored. It also stores `characterId` (`sessionEndService.js:38`).
- Rows held before this job have no `sessionData`. For those, the retry rebuilds the narrative from `dm_sessions.messages` the same way the end route does (`sessionDataFromMessages`, `:264`).

**Where it hooks into session start:** `POST /api/dm-session/start`, at `server/routes/dmSession.js:583`. It runs after the active/paused, unclaimed, adventure and campaign checks, and before the opening scene is built. The scorer call uses the held session's own system prompt and is logged as `session_end_xp_scoring_retry`. If anything was awarded, the start route re-reads the character so the opening uses the new level.

**Exactly once (`retryHeldXpAwards`, `sessionEndService.js:189`):**
- Each held row is claimed with `UPDATE session_end_runs SET status = 'started' WHERE … AND status IN ('failed','pending_llm')` before scoring. A second or concurrent retry finds nothing to claim.
- On success, it awards through `awardSessionXP`, marks the stage `complete` (`retried: true`) and records the award on the session's `rewards`. If the session was already claimed, it pays companions once.
- On failure, it puts the row back to `failed`, adds one to `retries` and keeps the stored `sessionData`.
- The function never throws, and the route also wraps it, so session start is never blocked.

No migration was needed: the existing CHECK on `session_end_runs.status` allows `started`.

## Files changed

| File | Size | New/edited |
|---|---|---|
| `server/services/sessionEndService.js` | 13,932 B | Edited: stores `sessionData` on a held stage; adds `retryHeldXpAwards` and `awardCompanionSessionXP`. |
| `server/routes/dmSession.js` | 242,629 B | Edited: claim (no PC XP, atomic claim, guarded companion award); start (retry hook). |
| `tests/session-xp-once.test.js` | 16,285 B | **New**, 34 assertions. |
| `docs/pm/return-loop-xp-fixes/BRIEF.md` | 11,899 B | New (the brief, placed as asked). |
| `docs/pm/reports/return-loop-xp-fixes-REPORT.md` | — | New (this report). |
| `package.json`, `client/package.json` | — | 1.0.221 → 1.0.222. |

No migrations. No client change: the claim screen reads `data.character` and `companionXPResults`, both still returned.

## What was built (in play)

- Ending a session raises your experience, and your level if you earned one, once. Claiming rewards no longer raises experience again. Active class-based companions gain the session's experience once, when you claim.
- If the scorer is down when you end a session, the session still ends and you can still claim and play again. The award is held, and it is scored again the next time you start a session. If the scorer is still down, the start goes ahead and the award stays held for the next start. Once the score succeeds, your experience, level and level-up choices land together, and your companions get their share, all once.

## Test results

- **Full `npm test` on the PC, after all edits:** Files **267/268 green**, Assertions **20,611 passed, 7 failed**. The file count is 267 from before plus the new `session-xp-once`.
- **The only red file is `return-loop.test.js`, at 79/86** (was 77/86). G-1 and G-2 now pass. On this run, the G-2 line reads `stage complete, XP 2699 → 3791`.
- **`session-xp-once.test.js`: 34/34.** Run against the pre-fix code, it fails 14, so it tests the fix:
  - `[once]`: end → claim, the PC's XP and level, the companion once, and a second claim refused;
  - `[held]`: the scorer down at end, a failed retry, a successful retry, and a later start;
  - `[race]`: two concurrent retries award once.
- **Touched siblings:** `session-end-world-tick` 38/38, unchanged.
- **Windows runner notes from the final run:** `companion-sheet`, `item-7-damage-tables`, `migration-schema-contract`, `pc-conditions` and `subclass-tier0` counted as `pass*`: libSQL crashed on exit after all their assertions had passed. These are runner artifacts, not failures. No file was retried this run.
- `npm run lint` on the two edited server files: 0 errors. The warnings were all there before this job.

## Not done / still open

- **The five other return-loop gaps** (G-3 ×2, G-4, G-5, G-6 ×2, G-7) are out of scope and still red. Each is a follow-up job.
- **A crash in the middle of a retry or session end** leaves the XP stage at `started`. The retry never picks up a `started` row, because the award might already be written, so the award stays held without being paid. Making the award and the stage mark one atomic write would close this. CLAUDE.md warns that libSQL transactions are connection-scoped, so that is its own small job. It is rare: it needs a process crash between two writes.
- **The browser final test** is not done here (no browser test per job, Zach 2026-11-24). The checks are listed below.

## Decisions made (reversible, for veto)

1. **The session-end award is canonical, and claim never writes the PC's experience** (brief decision). *Reversal:* restore one line.
2. **Companions stay paid at claim, with the full session award** (unchanged behavior; the `COMPANION_XP` present/away/absent multipliers in `xpService.js` are still unused). *Reversal:* none needed.
3. **A held award for an already-claimed session pays companions at the retry. For an unclaimed session, the retry writes the award into `rewards.xp` and the claim pays it.** One marker, `rewards.companionXpAwarded`, keeps the payment to once either way. *Reversal:* small.
4. **The retry runs inside session start and the route waits for it.** That adds one scorer call to the start of a session after a failed score, and none otherwise. *Reversal:* make it fire-and-forget. That would race the opening scene's level and would make the gap check untestable at start.
5. **Atomic claim** (sibling fix). *Reversal:* a few lines.
6. **Version 1.0.222.**

## Needs Zach's decision

One finding, not fixed, because the brief puts level-up choices out of scope:

- **`awardSessionXP` overwrites `level_up_pending_choices` every time it runs** (`server/services/xpService.js:158`). If the player still has an unresolved level-up choice from an earlier session, and the next session's award does not level them up, the stored choice is set to empty and lost. The same happens when it levels them up: the new choices replace the old ones instead of being added. I checked the write and found no other place that restores the choices. What is unclear: whether unresolved choices are meant to carry forward (my reading of "level-up choices consistent") or whether the client always resolves them before the next session can end. **Question for Zach:** should unresolved level-up choices be kept and added to at the next award? If yes, it is a two-line fix in a follow-up job.

## How to verify

**Gate:** from `E:\DnD Meta Game\dnd-meta-game`, run `npm test`. Expect **Files 267/268, Assertions 20,611 passed, 7 failed**. The only red file should be `return-loop.test.js` at **79 passed / 7 failed**, and these are the 7 failures, by exact name:

1. `[tick] GAP G-3: the commission is stamped ready on the day-of-year scale its deadline uses, day 103`
2. `[tick] GAP G-3: the commission not due until day 150 is still being made`
3. `[tick] GAP G-7: a world-clock advance at session end evaluates scene evolution`
4. `[protect] GAP G-4: the player's downtime assignment for TEST_RL_D Mira is scheduled`
5. `[protect] GAP G-5: full downtime jumps the clock by its span, 5 days`
6. `[protect] GAP G-6: the client's end-session request can carry the player's downtime choice`
7. `[protect] GAP G-6: the steward's downtime question is put to the player at session end`

Any other red line is a real failure. Files counted as `pass*` are Windows runner artifacts.

**Final-test checks (the one browser pass, :5173):**
1. Note the character's experience and level on the character sheet. Play a session with at least one action, then end it. Experience rises once, and the level matches the new total.
2. Claim the rewards. The experience on the sheet **does not rise again**. An active class-based companion's experience rises by the session award once.
3. Start the next session. The experience is unchanged.
4. **The failed-score retry can be staged by hand:** stop Ollama just before you press End Session. The session ends, the claim works, and the experience does not change. Start Ollama again, then start the next session. The experience rises once by the session's award, and the level follows. Starting a further session adds nothing. To see a second failed retry, keep Ollama stopped for the first start after ending: play must still start. Ollama being down also stops the opening scene, so that start may show the model-unavailable message instead of play, which is expected.
