# Brief — level-up-off-by-one-fix: a level earned at session end can actually be taken

## Understanding

You are Claude Code, building the DnD Meta Game on Zach's PC (repo `E:\DnD Meta Game\dnd-meta-game`, branch `phase-4-hybrid-combat`). Muse is the project manager; Zach gates with his full `npm test`. This brief is the fix for the off-by-one confirmed in `docs/pm/reports/level-up-choices-class-rules-REPORT.md` (v1.0.224): a newly created character cannot apply a level that session end gave them. The fix direction below is a PM decision (2026-11-27), vetoable at the gate. It is an MVP blocker: leveling is core MVP.

## The bug (confirmed, from the class-rules report)

- Character creation does not write `class_levels` (the `INSERT` at `server/routes/character.js:3517` has no such column). Only the level-up route and a character-sheet save ever write it.
- Session end raises `characters.level` (`awardSessionXP` in `server/services/xpService.js`).
- The level-up route counts the current level from `class_levels` when set, otherwise from `characters.level` (`character.js:7211-7220`, and the same at `:6890-6901` for level-up info). For a character whose `class_levels` is still empty — every new character until their first manual level-up — the route thinks they are already at the new level, asks for the next level's XP, and refuses. The level number and XP are on the sheet; the hit points, class features, and ability choice of that level are not.

## The fix (PM decision: option b)

1. **Creation writes `class_levels`.** The creation `INSERT` writes one entry: the character's class at level 1, in the same shape the level-up route and sheet save already write. No other creation change.
2. **Backfill existing characters with empty `class_levels`.** Derive each one's applied level (the levels actually taken on the sheet) from the best available record. The builder's candidate is maximum hit dice — **verify it before relying on it**: check that max hit dice equals applied level for characters that have levelled through the screen (where `class_levels` is set and known). If hit dice do not verify, stop and report with options rather than guessing. Backfill writes `class_levels` in the same shape; characters whose `class_levels` is already set are untouched. Note: the live database holds test data only (fresh build, no real players), so a conservative backfill is acceptable — but it must be correct for the characters it touches, and the report must state what it did per character class of case.
3. **The probe becomes a permanent test.** The throwaway probe from the class-rules report (real `POST /api/character` → real `awardSessionXP` → real `GET level-up-info` + `POST level-up`) becomes a committed test covering both probed cases: a new Fighter reaching level 2, and a Fighter at 3 reaching 4. The level must apply: hit points, features, and waiting choices land. Add a backfill test (a character with empty `class_levels` and a raised `characters.level` can level up after backfill).

## Fences

- No change to the level-up route's counting logic — it already trusts `class_levels`; the fix gives it a correct record from creation.
- No change to the session-end award, the waiting-choice queue, or the class-rules reconciliation built in v1.0.224.
- No client change. No screen work.
- If the backfill record does not verify, stop that part and report — do not invent a derivation.

## Test results expected

- The new permanent test passes (both probed cases + backfill).
- Full `npm test`: red-with-cause with exactly the same 7 named leave-and-return gap checks and no new failures (the standing expectation since v1.0.222). Any other red line is a real failure.
- Watch item from the class-rules report: `return-loop` came out 78/86 once in about 20 runs (one extra check, unnamed). If it appears in your run, capture and name the check in the report.

## Report

Write `docs/pm/reports/level-up-off-by-one-fix-REPORT.md`, opening with an Understanding section. State: the creation change, the backfill derivation and its verification, per-case backfill outcomes, the permanent test and its results, full-suite counts, and anything not done. A claim without evidence (commit hash, test counts) is reported as unverified, not done.
