# Report — level-up-choices-carry: waiting level-up choices are kept, not overwritten

Builder: Claude Code (Opus 5.5). This is a follow-up fix to `return-loop-xp-fixes`, which is closed and left unchanged. Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.222 → **1.0.223**.

**The decision this builds (PM, relayed by Zach, 2026-11-26), verbatim:** "keep unresolved level-up choices and add new ones to them. A session-end award must never overwrite an older unresolved choice. New choices are added in order, with no duplicates. Making one choice removes only that one. If an award gains no new level, the waiting choices stay as they are." No separate brief file was written: the decision came in chat, and this report records it.

## Understanding

A character's waiting level-up choices live in `characters.level_up_pending_choices`, a JSON list of `{ level, type, prompt }`. There are two types: `asi_or_feat` at levels 4, 8, 12, 16 and 19, and `level_up_review` at every level.

The only writer was the session-end award (`awardSessionXP`, `server/services/xpService.js`). It replaced the whole list on every award. An award that gained no level set the list to null, and an award that gained a level threw away whatever was still waiting. Nothing in the app removed a choice when the player made it.

## Verdict

**BUILT.** The full-suite result is under Test results.

## What changed

**Session-end award** (`server/services/xpService.js:149`, `awardSessionXP`):
- **No new level:** the choices column is not written at all, so the waiting list stays exactly as it was.
- **New level:** the waiting choices are kept first, untouched and in their order. This award's choices are added after them, in level order. A choice already waiting (same level and type) is not added again.
- The return value's `pendingChoices` is now the full waiting list after the award. A new `newChoices` field holds what this award added. Nothing outside the function read the old value.
- New helpers in the same file: `parsePendingChoices` (`:183`), `serializePendingChoices` (`:194`), `mergePendingChoices` (`:200`) and `removePendingChoice` (`:214`). A choice is identified by its level plus its type.

**Making a choice** (`server/routes/character.js`, `POST /api/character/level-up/:id`, from `:8108`):
- When the player takes an Ability Score Improvement or a feat for the level being reached, that level's `asi_or_feat` choice is removed, and only that one. The rest stay, in order.
- The write happens inside the route's existing level-up transaction (`:8181`), so a refused or failed level-up changes nothing.
- A level-up with no ASI leaves the list as it was.

## Files changed

| File | Size | New/edited |
|---|---|---|
| `server/services/xpService.js` | 11,061 B | Edited: carry rule in `awardSessionXP`, four list helpers. |
| `server/routes/character.js` | 454,051 B | Edited: the level-up route removes the one choice that was made. |
| `tests/level-up-choices-carry.test.js` | 10,474 B | **New**, 22 assertions. |
| `docs/pm/reports/level-up-choices-carry-REPORT.md` | — | New (this report). |
| `package.json`, `client/package.json` | — | 1.0.222 → 1.0.223. |

No migration. No client change: no client code reads this column today.

## Test results

- **`level-up-choices-carry.test.js`: 22/22.**
  - `[merge]`: the pure list rules (order, no duplicates, remove one, unreadable value, empty stored as null).
  - `[award]`: the real database. With no new level the column is byte-for-byte unchanged. A new level keeps the older choice and adds the new ones after it. A choice already waiting is not added twice. With nothing waiting and no new level, nothing is written.
  - `[levelup]`: the real level-up route. An ASI at level 4 removes only the level-4 ASI choice. A level with no ASI changes nothing. A refused level-up changes nothing.
- **Run against the old code, it fails 5:** the two no-new-level checks, the two carry checks, and the remove-one check. So the tests test the fix. The duplicate check passes on the old code too, because the old code threw the list away and so could not duplicate.
- **Full `npm test`:** Files **268/269 green**, Assertions **20,635 passed, 7 failed**. That is 268 files from before plus this new one. The only red file is `return-loop` at 79/86, with the same 7 named gap checks as after `return-loop-xp-fixes`. There are no new failures. `session-xp-once` is still 34/34. Windows runner artifacts: `item-3d-action-markers`, `roll-request`, `subclass-batch1`, `subclass-scanned1` and `subclass-scanned2` counted as `pass*` (libSQL crashed on exit after all assertions passed). No file was retried.
- `eslint`: `xpService.js` is clean. `character.js` reports 5 `no-useless-assignment` errors, the same 5 as before this change (checked against the committed file); none is in the lines touched here.

## Not done / still open

- **The `level_up_review` choices are never removed** (question 1 below). They now pile up, one per level, as the decision says unresolved choices should.
- **No client code shows the waiting list.** Nothing reads `level_up_pending_choices` outside the server tests. The decision is about keeping the data; showing it is a separate job.

## Decisions made (reversible, for veto)

1. **"Making a choice" is wired for the ASI/feat choice only, at the level-up route.** That is the one place in the code where the player makes one of these choices. *Reversal:* remove one block.
2. **Duplicates are judged by level plus type.** Prompt text is ignored. *Reversal:* change one key function.
3. **An ASI is matched to the waiting choice by total character level.** That is how the queue records it (levels 4/8/12/16/19). See question 2. *Reversal:* small.
4. **Version 1.0.223.**

## Needs Zach's decision

1. **When is a "Review level N features with the DM" choice made?** I checked the code: no route, DM marker or client screen marks a review as done. The level-up route applies a level's class features but asks the player nothing about a review. What is unclear: does taking the level-up on the character sheet count as making the review choice for that level (then the level-up route would remove it too), or is it settled in play with the DM (then it needs a marker or a button, which is a new job)? Until this is decided, review choices are kept and never removed.
2. **ASI levels differ between the queue and the class rules.** The queue lists an ASI choice at total levels 4, 8, 12, 16 and 19. The level-up route grants an ASI by class level (`hasASI`), which adds Fighter 6/14 and Rogue 10 and moves the ASIs for a multiclass character. So a Fighter's level-6 ASI settles no waiting choice, because none was queued. And a Fighter 2 / Rogue 2 reaching level 4 has an ASI choice queued that no level-up can settle. Should the queue follow the class rules? The 2024 book says ASIs are by class level, so the book would say yes. That changes what an award queues, which is outside this decision, so I did not change it.
3. **Found while reading, not run: the level-up route may be one level off after a session-end level-up.** The route counts the current level from `class_levels` when it is set, and otherwise from `characters.level` (`server/routes/character.js:7211-7220`). Session end raises `characters.level` and does not touch `class_levels`. Character creation (`POST /api/character`, `:3517`, and the commit route) does not appear to write `class_levels`. If so, a character levelled up by session end looks one level higher to the level-up route, and the route refuses for lack of XP. That would leave the player unable to apply the level the session gave them. I have not run this, so it is unverified. I can confirm it with a test before any fix, if you want.

## How to verify

**Gate:** from `E:\DnD Meta Game\dnd-meta-game`, run `npm test`. Expect **Files 268/269, Assertions 20,635 passed, 7 failed**. The red file should be `return-loop.test.js` at 79 passed / 7 failed, with exactly the 7 gap checks named in `docs/pm/reports/return-loop-xp-fixes-REPORT.md`. Any other red line is a real failure. For this file alone, run `npm test level-up-choices-carry` and expect 22/22.

**Final-test checks (the one browser pass, :5173):** no screen shows the waiting choices yet, so there is nothing to see in the browser. This can be checked only through the data, and the test file covers it.
