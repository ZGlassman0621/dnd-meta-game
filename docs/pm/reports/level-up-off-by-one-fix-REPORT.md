# Report — level-up-off-by-one-fix: a level earned at session end can actually be taken

## Understanding

The DnD Meta Game is a solo D&D 2024 game. One human player character plays with an AI Dungeon Master, and the AI plays everyone else. The MVP covers creating a character, playing, leaving and returning, loot, XP and levelling, quests, companions, combat and story.

This job fixes a levelling bug that blocks the MVP. When a session ends, the game awards XP and raises the character's level number. The level-up screen is where the player then takes that level: its hit points, class features and choices. For every newly created character, the screen refused: it thought the level was already taken and asked for the next level's XP. The cause is that creation never wrote the character's record of levels taken (`class_levels`). The brief asks for three things: creation writes that record, existing characters are backfilled, and the probe becomes a permanent test.

**Where the live code differs from the brief, stated first:**

1. **The creation INSERT is not the only place creation finishes.** The brief says "the creation `INSERT` writes one entry… No other creation change." The real player creator (creator-next) doesn't work that way:
   - It first saves a draft (`creation_phase = 'creating'`), usually before the class is final.
   - It sets the class with later saves (`PUT /api/character/:id`).
   - It finishes through `POST /api/character/:id/commit`. The Prelude handoff finishes through a `PUT` that flips the row to `'active'`.

   If only the INSERT wrote the record, a draft would get a wrong record (placeholder class `'creating'`) or none at all, so the real player path would stay broken. I wrote the record **at the moment a character becomes playable**: the INSERT when the character is born playable, the commit, and the PUT that flips a row to active. All three use one helper, it is the same record, and nothing else about creation changed. This goes slightly past the brief's fence, so it is listed under Decisions for veto.
2. **The brief says "the class at level 1."** Creation accepts a starting `level`, and the probe's second case is a Fighter created at level 3. The record therefore uses the character's stored level at the moment it becomes playable. That is level 1 for every normal new character, and it is exactly what the level-up route's own fallback would have read at that moment. Also under Decisions.
3. **Hit dice do not verify as a backfill source**, so the backfill is the conservative case only. Details in "Backfill" below.

## Verdict

**BUILT + RED (expected red only)**: the fix is built and its tests are green. The full suite is red with exactly the 7 named leave-and-return gap checks and no new failures. The backfill for characters above level 1 was **not built**, because hit dice did not verify (as the brief instructs).

## Files changed

| File | New/edited | Size (bytes) |
|---|---|---|
| `server/routes/character.js` | edited | 457,500 |
| `server/migrations/118_class_levels_backfill.js` | **new, migration 118** | 1,897 |
| `tests/level-up-off-by-one.test.js` | **new** | 11,911 |
| `tests/creator-next-stage4.test.js` | edited (INSERT column count 64 → 65) | 87,941 |
| `tests/creator-next-stage6-commit.test.js` | edited (+2 checks: the commit writes the record) | 90,622 |
| `docs/pm/level-up-off-by-one-fix/BRIEF.md` | new (the brief, as given) | 4,298 |
| `package.json`, `client/package.json` | edited (1.0.224 → 1.0.225) | 1,398 / 427 |

## What was built (in play)

- **A new character can take the level session end gives them.** A new Fighter who reaches level 2 at session end opens the level-up screen and it works:
  - hit points rise (+8 for a Fighter with CON 14);
  - the level-2 features land (Action Surge);
  - the waiting "review level 2" choice is made.
- **The same holds at higher levels.** A Fighter at 3 who reaches 4 takes the level with their ability-score increase. Both waiting level-4 choices are made.
- **The record is written at the right moment.** The creator writes it when the character is committed (it becomes playable), with the class the player actually chose. A draft that is still being built gets no record, so changing the class mid-creation can't leave a stale one.
- **Old level-1 characters are fixed too.** Migration 118 gives any playable level-1 character without a record its record (class at level 1). Their first session-end level then works the same way.

**Code changes (`server/routes/character.js`):**
- New helper pair `creationClassLevelsJson` / `writeCreationClassLevelsIfEmpty`, placed just above `router.post('/')`.
- The INSERT gains the `class_levels` column, filled only when the character is born playable.
- The commit route calls the helper right after its flip to `'active'`.
- The PUT calls it when the body flips `creation_phase` to `'active'`.
- A row that already has `class_levels` is never touched.
- The record shape is the level-up route's own: `{ class, level, subclass }`.
- The level-up route's counting logic, the session-end award, the waiting-choice queue and the v1.0.224 class-rules reconciliation are unchanged (fences kept). There is no client change.

## Backfill: derivation, verification, per-case outcome

**The candidate the brief named, maximum hit dice, does not verify.** What was checked:
- `characters.hit_dice` is written in only two places: the level-up route (`getHitDiceBreakdown(classLevels)`, which is calculated *from* `class_levels`) and a direct sheet PUT. Creation and session end never write it.
- So for exactly the characters that need a backfill (empty `class_levels`), hit dice are blank and carry no information. Where hit dice are set, they are a copy of `class_levels`, which proves nothing independent.
- **The live database:** a read-only census of `E:\DnD Meta Game\dnd-meta-game\local.db` found **one character**. Character 1, "Kyle Testman", is a cleric: level 1, 0 XP, active, `class_levels` empty, `hit_dice` empty, nothing waiting. No character in the database has `class_levels` set, so there is nothing to verify against either way.

**What was built instead: the case that needs no derivation (migration 118).** For a playable row (`creation_phase = 'active'`, a real class) at **level 1** with empty `class_levels`, the applied level is certain: it is 1, because a playable character can't be lower. These rows get `[{ class, level: 1, subclass }]`.

| Class of case | Outcome |
|---|---|
| Playable, level 1, empty record | Backfilled with class at level 1 |
| Playable, level 2+, empty record | **Untouched.** Its applied level can't be known: it may have been created at that level or raised by session end. |
| Record already set | Untouched |
| Draft / Prelude / no class | Untouched. It gets its record when it becomes playable. |

**On the live DB**, the migration runs the next time the server starts (migrations apply at `initDatabase`). Its only effect is that Kyle Testman (character 1, cleric, level 1) gets `[{"class":"cleric","level":1,"subclass":null}]`. I did not start the server against the live database in this job. The migration only adds data and deletes nothing.

**Options for characters above level 1, should any exist (none do today):**
- **(a)** Use the waiting "review level N" choices. Session end has queued one per level it granted since v1.0.223/224, and the level-up route removes each one as the level is taken. Applied level would be the lowest waiting review level minus 1. This only works for levels granted after that queue existed.
- **(b)** Leave such characters to a manual sheet correction.
- **(c)** Treat their level as applied. That silently skips the HP and features of any session-end level.

Since the live database is test data with no such row, I recommend (b), meaning no further code. This is the PM's call; nothing was built for it.

## Test results

Full `npm test` on the PC, after the final edit:

```
Files: 269/270 green  |  Assertions: 20681 passed, 7 failed
Retried once after a Windows native crash mid-run (result shown is the retry's): creator-next-stage5.test.js → pass, creator-test-notes-20-snake-case-skills.test.js → pass
pass* (Windows native exit crash AFTER all assertions passed — counted green): item-3b-turn-ledger, mechanics-hooks-entities, subclass-scanned1, subclass-scanned2, subclass-tier0
```

The one red file is `return-loop.test.js` (79/86). It carries **exactly the 7 named gap checks**, with no new failures:
1. `[tick] GAP G-3: the commission is stamped ready on the day-of-year scale its deadline uses, day 103`
2. `[tick] GAP G-3: the commission not due until day 150 is still being made`
3. `[tick] GAP G-7: a world-clock advance at session end evaluates scene evolution`
4. `[protect] GAP G-4: the player's downtime assignment for TEST_RL_D Mira is scheduled`
5. `[protect] GAP G-5: full downtime jumps the clock by its span, 5 days`
6. `[protect] GAP G-6: the client's end-session request can carry the player's downtime choice`
7. `[protect] GAP G-6: the steward's downtime question is put to the player at session end`

**Watch item (return-loop at 78/86):** it did not appear in either full run this job. Both runs showed 79/86 with the 7 named gaps.

**Touched suites:**
- `level-up-off-by-one.test.js` is **new, 29/29**. It covers:
  - [create], 5 checks: born playable, draft has no record, PUT flip writes the record;
  - [1→2], 9 checks;
  - [3→4], 9 checks;
  - [backfill], 6 checks: level 1 backfilled, level 2 untouched, already-set untouched, re-run is a no-op, then session end plus level-up applies;
  - cleanup, 1 check.
- **The new test catches the bug.** Run once against the pre-fix `character.js` (from `HEAD` before this commit), it fails with 13 passed / 16 failed. The fix was restored immediately afterwards.
- `creator-next-stage6-commit.test.js`: 370/370, including 2 new checks (the draft has no record; the commit writes the class at level 1).
- `creator-next-stage4.test.js`: 623/623, with the INSERT balance updated to 65/65 and `class_levels` in the column list.
- `level-up-choices-carry` 35/35, `session-xp-once` 34/34, `xp-service` green.

The first full run (before the stage-4 count update) had one extra red line: `POST INSERT is balanced at 64 columns / 64 placeholders (got 65 / 65)`. It is a source-shape check that counts the INSERT columns, and it was correctly caught and updated.

## Cost and usage

I can't measure this session's cost or the remaining usage from inside the session. Zach can check them on the Claude Code plan page (cap $30/month).

## Not done / still open

- **The backfill for playable characters above level 1 with no record.** It wasn't built because hit dice don't verify; options (a)/(b)/(c) are above. No such row exists in the live DB.
- **Known edge, not fixed:** an edit-mode commit or a sheet PUT that changes the *class*, or sets `level` directly, on a character that already has a record does not update that record. This was already true for every character that had levelled once. It now also applies to level-1 characters, because they have a record from creation. In play, the class is fixed once a character is committed. It is a rare corner, left as an edge rather than over-engineered.
- **Not done:** the live server was not started, so the migration has not run against `local.db` yet.

## Decisions made (reversible, for veto)

1. **The record is written when a character becomes playable** (INSERT if born active, the draft commit, the PUT flip to active), not only in the INSERT. *Why:* the real creator finishes through the commit, so an INSERT-only write would leave the player path broken. *Reversal cost:* remove two helper calls (commit route, PUT) and one test block. The player path would then regress to the bug.
2. **The record uses the character's stored level at that moment, not a literal 1.** This is 1 for every normal new character and 3 for the probe's created-at-3 Fighter. *Reversal cost:* one line in `creationClassLevelsJson`. Characters created above level 1 would then be miscounted.
3. **The backfill covers playable level-1 rows only.** *Reversal cost:* the migration only adds data; clearing those records means one `UPDATE … SET class_levels = NULL` on the backfilled rows.
4. **Two checks were added to an existing suite** (`creator-next-stage6-commit.test.js`), so the commit path is tested where the commit fixture already lives. *Reversal cost:* delete 4 lines.

## Needs Zach's decision

- **The gate:** Zach's full `npm test` on the PC. The expected result is 269/270 files, with the red file being `return-loop.test.js` carrying exactly the 7 named gap checks.

Nothing else needs Zach. Backfill option (a)/(b)/(c) for above-level-1 rows is the PM's call.

## How to verify

- **Commit:** `4eca490` on `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`, pushed to `origin`.
- **SHA-256 of changed files (at commit):**
  - `server/routes/character.js` `9b404c13f1641ec7209797a241be01a3a82782e7f080e9eb8b58e4bdd3eac1b2`
  - `server/migrations/118_class_levels_backfill.js` `18b48fc250917ca1865d248a2ac3e97a7bee91e2d5068412eb4b46e3eb410157`
  - `tests/level-up-off-by-one.test.js` `4a8a2fe68264fd27c977db31a40c52e5f0de14875a4fbcda26c6e82b41655b0a`
  - `tests/creator-next-stage4.test.js` `5124c5d1f1ad4a3edb9e3c289da999f202f148a576304916440aac11f4e07905`
  - `tests/creator-next-stage6-commit.test.js` `75ae0f6c06581d689d364b8d7bca0155bd8b0468dba44916b40eb921c1678591`
  - `docs/pm/level-up-off-by-one-fix/BRIEF.md` `8bfa4d5ae06579b60007b24740a7cbf097c6289063503473efe9c4f4daabb4cc`
  - `package.json` `71aaeffd0b2eee962b4f34c96930a1815e0847de1621eddb67747576cccd3b98`
  - `client/package.json` `4a6577e004fbb282a9578b7415479a7c01731444d9132d6797ee89fda04ddfcb`
- **Gate:** `npm test` in the PC repo. Single file: `npm test level-up-off-by-one` should give 29/29.
- **:5173 (after `npm run dev`; starting the server applies migration 118 to the live DB):**
  1. Create a new character through the creator and commit it.
  2. Play a session and end it with enough XP for level 2. The sheet now says level 2.
  3. Open level-up. It should offer level 2, not refuse with "not enough XP". Take it. HP rises, the level-2 features appear, and the waiting review choice is gone.
