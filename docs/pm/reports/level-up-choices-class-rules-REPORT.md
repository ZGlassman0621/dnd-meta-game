# Report — level-up-choices-class-rules: the off-by-one confirmed; review choices made at level-up; ASI choices by class level

Builder: Claude Code (Opus 5.5). This builds three PM decisions relayed by Zach on 2026-11-26. It follows `level-up-choices-carry` (v1.0.223), which is left unchanged. Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.223 → **1.0.224**.

**The decisions (PM, 2026-11-26), verbatim:**
1. "A review choice counts as made when the player takes that level-up on the character sheet — remove it there, like the ability choice."
2. "Yes — the waiting-choice list must follow the book's class-level ability-increase rules, using the level-up screen's own logic as the one source."
3. "Yes — confirm the possible off-by-one with a test first, before any fix."

Order given: confirm the off-by-one first, then do (1) and (2) together in one small job. That is the order followed here.

## Verdict

- **Step 1, the off-by-one: CONFIRMED, NOT FIXED.** A fix waits for a PM decision, as instructed.
- **Steps 2–3, decisions 1 and 2: BUILT.** The full-suite result is under Test results.

## Step 1 — the off-by-one, confirmed

**Probe:** a throwaway test, not committed, that runs the real path with no product change: create a character through the real `POST /api/character`, award a session through the real `awardSessionXP` (the session-end award), then call the real `GET /api/character/level-up-info/:id` and `POST /api/character/level-up/:id`. Output from the run:

| Character | After creation | After the session-end award | Level-up info | Level-up | Result |
|---|---|---|---|---|---|
| New Fighter | level 1, 299 XP, `class_levels` null | **level 2**, 481 XP (+182) | 400 "Character does not have enough XP to level up" | 400, `xpNeeded 900` | **Level 2 never applied** |
| Fighter at 3 | level 3, 2,699 XP, `class_levels` null | **level 4**, 3,791 XP (+1,092) | 400, same message | 400, `xpNeeded 6500` | **Level 4 never applied** |

**Cause, from the code:**
- The level-up route counts the current level from `class_levels` when set, and otherwise from `characters.level` (`server/routes/character.js:7211-7220`, and the same at `:6890-6901` for level-up info).
- Character creation does not write `class_levels`: the `INSERT` at `:3517` has no such column. Only the level-up route and a character-sheet save (`PUT`, allowed field at `:4720`) ever write it.
- Session end raises `characters.level` (`xpService.js`, `awardSessionXP`).

So for any character whose `class_levels` is still empty, which is every new character until their first manual level-up, the level-up route thinks they are already at the new level. It asks for the next level's XP and refuses. The player cannot apply the level, the hit points, the class features or the ASI that the session gave them. The XP and the level number are on the sheet, but nothing else of that level is.

**Who is affected:** every newly created character, at their first session-end level-up. A character that already has `class_levels` (one that has levelled up once through the screen) counts its level from `class_levels` and is not affected.

**No fix was made.** A permanent failing test was not committed either, because the gate counts any red line as a real failure and no PM decision covers it. See "Needs Zach's decision" 1.

## Steps 2–3 — what was built

**Decision 2, session end queues ability choices by class level** (`server/services/xpService.js:232`, `queueLevelUpChoices`, now exported):
- An `asi_or_feat` choice is queued for a new level only where `hasASI(class, class level)` grants one. That is the same function, from `server/config/levelProgression.js`, that the level-up route uses (`character.js:8114`). Fighters now queue 6 and 14, Rogues 10. A multiclass level that is not an ASI level of its class queues none.
- The class and class level are worked out the way the level-up route works them out: the character's `class_levels`, or, when empty, one entry of the character's class at its level. A new level goes to the route's default class, the character's own class, because session end cannot know whether the player will pick another class at level-up. When `class_levels` lags behind the level, class levels are counted on from the applied ones.
- `level_up_review` is still queued for every level.

**Decision 1, plus decision 2 at the level-up** (`server/routes/character.js:8104-8128`, inside the existing level-up transaction). Taking level N on the level-up screen now:
- makes level N's **review** choice, which is removed;
- makes level N's **ability** choice, which is removed, when the ASI or feat is taken;
- removes a waiting level-N ability choice that the class actually levelled does not grant at that class level. This covers a player who picks a different class at level-up than the one session end queued for: by the level-up screen's own rule there was no ability choice at that level;
- keeps a level-N ability choice that the class grants but the player did not take, and adds it if it was missing. The client always sends the ASI when one is due (`client/src/components/LevelUpPage.jsx:608`), so this happens only through a direct call.

Every other waiting choice stays, in order. A refused level-up changes nothing.

## Files changed

| File | Size | New/edited |
|---|---|---|
| `server/services/xpService.js` | 12,387 B | Edited: `queueLevelUpChoices` uses `hasASI` by class level; it is exported. |
| `server/routes/character.js` | 454,871 B | Edited: the level-up route makes the review choice and reconciles the ability choice. |
| `tests/level-up-choices-carry.test.js` | 15,216 B | Edited: 22 → **35** assertions; new `[queue]` group; `[levelup]` group rewritten for the new rules. |
| `docs/pm/reports/level-up-choices-class-rules-REPORT.md` | — | New (this report). |
| `package.json`, `client/package.json` | — | 1.0.223 → 1.0.224. |

No migration, no client change. The throwaway probe file was deleted and not committed.

## Test results

- **`level-up-choices-carry.test.js`: 35/35.**
  - `[queue]`: Fighter 6 and 14, Rogue 10, Wizard 4 yes and 6 no; a multiclass Fighter 2 / Rogue 1 reaching 4 queues no ASI; class levels counted from lagging `class_levels`; two levels at once in order; through the real award, a Fighter reaching 6 gets the ASI choice and a Wizard does not.
  - `[levelup]`: level 4 with an ASI makes the level-4 review and ability choices and nothing else; level 5 makes its review and removes an ability choice Fighter 5 does not grant; an untaken ASI stays waiting; nothing waiting stays empty; a refused level-up changes nothing.
- **Against the old rules** (the old route, and the fixed 4/8/12/16/19 levels), 9 checks fail. So the tests test the change.
- **Full `npm test`:** Files **268/269 green**, Assertions **20,650 passed, 7 failed**. The only red file is `return-loop` at 79/86, with the same 7 named gap checks. There are no new failures. `session-xp-once` is 34/34. Windows runner artifacts: `companion-sheet`, `lair-durability`, `npc-bank-wiring`, `subclass-batch4` and `subclass-tier0` counted as `pass*` (libSQL crashed on exit after all assertions passed). No file was retried.
- **One intermittent result, reported in the open.** After the full run, I re-ran the files that use `xpService.js` (I had made a one-line lint fix to it during the full run; the code was equivalent). In that re-run, `return-loop` came out **78/86**: one check more than the 7 gaps failed. My filter printed only the summary line, so **I do not know which check it was**, and the runner deletes its logs at the start of each run. I then ran `return-loop` 19 more times, with the failing lines captured: **79/86 every time**, with only the 7 gaps. It happened in 1 of about 20 runs. I cannot say whether it comes from this job. If it shows up on your gate run, its name will be in the run output. Please send it back.
- `eslint`: `xpService.js` clean. `character.js` has the same 5 errors that were there before this job; none is in the lines touched.

## Not done / still open

- **The off-by-one is confirmed and not fixed** (Step 1). It waits for your decision.
- **The test fixtures for the level-up route set `class_levels`**, as every existing level-up test does. Until the off-by-one is fixed, the route cannot be driven end to end from a freshly created character. That is exactly the bug in Step 1.
- **No screen shows the waiting list** (unchanged from `level-up-choices-carry`).

## Decisions made (reversible, for veto)

1. **At session end, a new level is assumed to go into the character's own class.** That is the level-up route's own default (`selectedClass || character.class`), and the level-up then reconciles the list with the class actually picked. *Reversal:* queue no ASI choices at session end, and add them only at level-up.
2. **An ability choice that the levelled class does not grant at that level is removed at that level-up.** This is my reading of decision 2: the list follows the level-up screen's rule, and by that rule the choice never existed. It is not a "choice made". *Reversal:* one branch.
3. **An ASI the level grants but the player did not take stays waiting, and is added if missing.** That follows the book rule, but no screen can settle it afterwards. The client never sends a level-up without the ASI. *Reversal:* one branch.
4. **Version 1.0.224.**

## Needs Zach's decision

1. **Fix the off-by-one, and how?** It is confirmed (Step 1): a new character cannot apply a level that session end gave them. Two plain options:
   - **(a)** Have the level-up route count the applied level from what has actually been applied (hit dice, or a new column) rather than `characters.level`.
   - **(b)** Have creation write `class_levels` (one entry: the class at level 1), and backfill existing characters whose `class_levels` is empty from their class and the level they had before their first session-end level-up.

   What I checked: the level count at `character.js:7211-7220` and `:6890-6901`, the creation `INSERT` at `:3517`, and every writer of `class_levels`. What is unclear: (b) needs each existing character's applied level, and nothing stores it once session end has raised `characters.level`. Hit dice are the likely record, but I have not verified them for every character. Which way should the fix go? Should it be its own job, with the probe made into a permanent test?

## How to verify

**Gate:** from `E:\DnD Meta Game\dnd-meta-game`, run `npm test`. Expect **Files 268/269, Assertions 20,650 passed, 7 failed**. The red file should be `return-loop.test.js` at 79 passed / 7 failed, with exactly the 7 gap checks named in `docs/pm/reports/return-loop-xp-fixes-REPORT.md`. Any other red line is a real failure. For this job's file alone, run `npm test level-up-choices-carry` and expect 35/35.

**Final-test checks (the one browser pass, :5173):** no screen shows the waiting list, so this is covered by the test file only. For the off-by-one, a hand check: create a new character, play a session that levels them up, then open Level Up on the character sheet. Today it refuses with "Character does not have enough XP to level up". That is the bug in Step 1, not a result of this job.
