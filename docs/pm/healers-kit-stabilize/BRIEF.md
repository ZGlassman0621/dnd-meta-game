# Brief — Healer's Kit stabilize, no check (2026-11-26, amended 2026-11-27)

**Amendment (2026-11-27, Zach):** this brief now carries a second
part — the commission year-crossing fix (Part 2 below). One job,
one report, two parts. This package supersedes the 2026-11-26
package of the same name.

## Goal (in play)
A Healer's Kit does what the 2024 book says: spend one of its ten
uses as a Utilize action on a creature at 0 Hit Points, and the
creature is stabilized — no Medicine check. In solo play this is
the main way back from 0 Hit Points: a companion kneels beside the
downed player character, spends a kit use, and the death saves
stop. Today the rule is written on the item but the engine does
not enforce it; after this job the engine does.

Part 2 (in play): a commission ordered near the end of the year
still becomes ready when its making time runs out, and still
expires on schedule — even when that day falls in the next year.

## Background
- Zach asked for this job on 2026-11-26 after a verdict check on
  a reel about kits and tools: the tool catalog and the crafting
  recipes work as the book intends, but the Healer's Kit's
  no-check stabilize is stated on the item and not wired in the
  engine. This is an MVP fix — it must land before the MVP test.
- Source rule (2024 PHB, Healer's Kit): the kit has ten uses; as
  a Utilize action, expend one use to stabilize a creature at
  0 Hit Points without a Wisdom (Medicine) check. A stabilized
  creature regains 1 Hit Point after 1d4 hours. Source tag:
  2024 book. This is book behaviour, not homebrew.
- What the PM verified in the live repo (2026-11-26, branch
  `phase-4-hybrid-combat` — starting points, verify each against
  live bytes before trusting it):
  - The crafted kit's item description already states the rule:
    "10 uses. Stabilize a dying creature without a Wisdom
    (Medicine) check." (`server/data/armorGearRecipes.js`,
    Craft Healer's Kit recipe).
  - A companion stabilize route exists
    (`server/routes/companion.js`, `POST /:id/stabilize`) but it
    only resets the death-save counters; its comment assumes a
    Medicine DC 10 check already succeeded. Nothing checks for a
    kit, consumes a use, or waives the check.
  - No service references the Healer's Kit at all, and there is
    no generic tool-Utilize service; "utilize" appears only in
    data files.
  - Death-save state for the player character lives in
    `server/services/characterHpService.js` (three successes =
    stabilised; damage at 0 HP clears stabilisation).
  - Whether inventory tracks a kit's remaining uses is unknown —
    survey it (item 1). If uses are not tracked, tracking them is
    part of this job.
- Settled decisions that shape this job (do not re-decide):
  - Nothing mechanical is narrative-only (Zach, 2026-11-08): the
    engine consumes the use and sets the state; narration follows.
  - The DM controls every NPC and companion (Zach, 2026-11-23):
    a companion using a kit on the player character is the DM's
    choice on that companion's turn, resolved by the engine.
  - The player rolls their own dice (Zach, 2026-11-23) — but
    this action has no roll. The Medicine-check path (stabilize
    without a kit, DC 10) stays exactly as it is.
  - Testing (Zach, 2026-11-24): no :5173 testing per job; one
    test once everything is done; per-job gate is `npm test`
    only. A report handed over from Claude Code means the gate
    ran green — with the standing red-with-cause exception for
    the leave-and-return checks (exactly the remaining named
    checks, no new failures).

## What to build — Part 1: Healer's Kit
1. **Survey the live repo first, then build.** On the PC, branch
   `phase-4-hybrid-combat`, verify: how kit uses are stored (if
   at all) for the player character and for companions; how a
   companion's action on its turn reaches the engine (the marker
   or route a kit use would ride); how the player character's
   stabilised state is set and cleared; and how the existing
   Medicine-check stabilize path works end to end. Report the
   call chain with file and line before writing code. Workspace
   mirrors are staging copies, not the repo.
2. **The kit works, both directions.** Using a Healer's Kit on a
   creature at 0 Hit Points: spends one use, stabilizes the
   creature with no check, and records it (death-save counters
   reset, stabilised state set, the creature stays at 0 Hit
   Points unconscious). Cover: the player character using a kit
   on a downed companion; a companion using a kit on the downed
   player character; a companion using a kit on a downed
   companion. Refusals, each with a player-visible reason: no
   kit in inventory, kit has no uses left, target is not at
   0 Hit Points, user cannot act. A refused use spends nothing.
3. **Uses are tracked.** A kit starts with ten uses; each
   stabilize spends one; at zero uses the kit is spent and the
   refusal says so. If uses are not tracked today, add the
   tracking (existing kits in saved games default to ten uses —
   state the choice in the report).
4. **The 1d4-hours recovery.** A stabilized creature regains
   1 Hit Point after 1d4 hours, per the book. Wire it to the
   existing clock if the machinery is there; if it is not,
   report that as a named gap with file and line — do not build
   a new clock in this job.
5. **The DM is told the true rule.** One terse prompt line: a
   Healer's Kit stabilizes with no check and spends a use; the
   engine resolves it. Remove or correct any prompt text that
   says a check is always required.
6. **Tests.** A suite proving each direction in item 2, each
   refusal, the use count going down, and the Medicine-check
   path still working unchanged. Full `npm test` green on the
   builder's run (or red-with-cause naming only the standing
   leave-and-return checks).
7. **Live probe on gemma4:12b.** Drive one scene end to end on
   the real model: the player character is down at 0 Hit Points,
   a companion with a kit uses it, and the engine stabilizes the
   player character with no check and one use spent. Report what
   actually fired, including any model non-compliance, fixed or
   named.
8. **No :5173 pass in this job.** The report lists the exact
   checks for Zach's one final test.

## What to build — Part 2: commission year-crossing fix

Found by the builder during `return-loop-commission-fixes` and
coupled into this brief by Zach (2026-11-27). It follows that job;
do not start Part 2 until the day-scale fix is in.

The bug: orders store a day-of-year deadline with no year. A
commission ordered on day 360 with 10 days of work is due on
"day 370" — the calendar has 365 days, so the sweep never sees
day 370 arrive and the commission never becomes ready. A
commission made ready near year end would never expire for the
same reason. Placing new commissions is switched off today, so
the bug cannot bite in play yet; commissions are MVP content and
the fix is small.

1. **Give every order a deadline the sweep can compare across a
   year boundary.** The representation is yours to choose; the
   requirement is one scale, compared correctly in both
   directions. The world clock already runs on an absolute day
   counter (the day-scale fix established that), so storing the
   deadline as an absolute day is the natural choice — but if the
   order rows carry other day-of-year fields, keep the change
   minimal and consistent.
2. **Migration** converts existing orders to the new
   representation. No order is lost or silently changed in
   meaning; the report states what the migration did per case
   (orders with a deadline this year, orders already ready,
   expired orders). If an existing order's deadline cannot be
   converted unambiguously (no year recorded), stop and report
   the cases rather than guessing a year.
3. **Ready and expiry both work across the boundary:** a
   commission ordered on day 360 with 10 days of work becomes
   ready 10 days later (day 5 of the next year); a commission
   made ready near year end expires on schedule in the next
   year.
4. **Tests:** the year-crossing cases (ready across the boundary;
   expiry across the boundary; an order placed late in the year
   with a short making time still becomes ready the same year).
   The two commission checks from the return-loop file stay
   green.

Part 2 fences: no change to how commissions are placed, priced,
or presented — placement stays switched off exactly as it is. No
change to the world clock or the calendar.

## Out of scope
- Any other tool's Utilize action (Disguise Kit, Forgery Kit,
  Poisoner's Kit, Gaming Set, and the rest) — this job is the
  Healer's Kit only. A generic tool-Utilize engine is a later
  job if Zach places it.
- Crafting changes: the recipes, costs, and checks stay as built.
- The Medicine-check stabilize path's rules — unchanged.
- Commission placement, pricing, or presentation (Part 2 is the
  deadline representation only).
- Downtime assignments, the leave-and-return gaps, or any other
  queued job.

## Acceptance criteria
- A kit use stabilizes with no check in all three directions,
  spends exactly one use, and refuses cleanly (spending nothing)
  when the kit is missing, empty, or the target is not down.
- Kit uses are tracked and reach zero honestly.
- The 1d4-hours recovery is wired or named as a gap with
  evidence.
- The DM prompt states the book rule.
- A commission ordered near year end becomes ready and expires
  correctly across the year boundary; existing orders are
  migrated without loss or silent change of meaning.
- Full `npm test` green on the builder's run, or red-with-cause
  naming only the standing leave-and-return checks. (After the
  commission day-scale fix, the expected red is exactly the five
  remaining named checks: the four full-downtime checks and the
  scene-evolution check.)
- The live probe shows a companion stabilizing the player
  character on the real model.
- The report lists the exact final-test checks.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  and iterate until green (or red-with-cause as above). Zach's
  full run is the gate — never claim it.
- Live probe on gemma4:12b (Part 1, item 7). No :5173 pass
  (Part 1, item 8).

## Decisions already made
- This is a 2024 book rule, source-tagged "2024 book" — not
  homebrew, no flag (PM decision, vetoable at the gate).
- MVP placement: this fix lands before the MVP test (Zach,
  2026-11-26).
- The year-crossing fix rides in this brief (Zach, 2026-11-27).
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a
  sibling gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed,
  ask before building. Never invent data — a gap is stated as
  a gap.
- The 2024 book wins on conflict.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item
  verdicts for Part 1's eight items and Part 2's four items, the
  surveyed call chain (file + line per step), the Part 2
  representation chosen and the migration's per-case outcome,
  and any named gaps.
- Any question for Zach in full plain terms, one per item, with
  what was checked and what is still unclear.
- How to verify: gate command + the exact final-test checks.

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief
  to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test`
  on the PC; the :5173 pass is the one final test, not per job.
- Place this brief at `docs/pm/healers-kit-stabilize/BRIEF.md`
  in the repo when handing it over. Reports live in
  `docs/pm/reports/`.
