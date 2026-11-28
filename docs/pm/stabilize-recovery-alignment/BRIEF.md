# Brief — stabilize-recovery-alignment: every stabilization starts the 1d4 recovery, and a stable companion is stored one way

**Job slug:** `stabilize-recovery-alignment`
**Brief placement:** `docs/pm/stabilize-recovery-alignment/BRIEF.md`
**Report placement:** `docs/pm/reports/stabilize-recovery-alignment-REPORT.md`
**Branch:** `phase-4-hybrid-combat` (pull latest first; head is v1.0.227, commit `10b0fa5`)
**Source:** the Healer's Kit stabilize job's report (2026-11-27), "Not done / still open" items 1 and 2. The 2024 book's stabilize rule: a stable creature regains 1 HP after 1d4 hours — every stable creature, not only kit-stabilized ones.

## Understanding (required in your report)

Open your report with an Understanding section: what this job is, what you found in the live code, and where your understanding differs from this brief. A claim without evidence (commit hash, file hashes, test counts) is reported as unverified, not done.

## What to build

### 1. Every stabilization starts the 1d4-hours recovery

Today only a Healer's Kit stabilization sets `stable_recover_at` (migration 119). The other two routes to stable do not:

- **The Medicine-check route** (`POST /:id/stabilize` in `server/routes/companion.js`): the caller does the DC 10 check; the route resets the counters. On success it must also set the recovery hour — the engine rolls the companion's d4, exactly as it does for a kit-stabilized companion.
- **The three-death-save-successes route** (a creature stabilizes itself): when the third success lands, the recovery hour must be set. For the player character, the player rolls their own d4 — reuse the existing ask (`pendingRecoveryDie` / `playerRollService.js`) exactly as the kit path does. For a companion, the engine rolls it.

The recovery firing itself is unchanged: it fires in `advanceClockForSession` when session time moves, and damage at 0 HP clears it. Do not change when it fires.

### 2. A stable companion is stored one way

Today a kit-stabilized companion holds death-save successes 3 at 0 HP (the player character's stable state), but the Medicine route and the three-successes route reset the tallies to 0/0 — so the DM's prompt shows such a companion as dying. Align both routes to the kit's state: successes 3 at 0 HP, cleared by damage at 0 HP. The death-save route already refuses for a kit-stable companion; it must refuse the same way for any stable companion.

Two existing tests in `integration.test.js` pin the old 0/0 reset. Update them to the aligned state, each with a comment saying why (the old expectation asserted the mismatch this job removes).

## Fences

- The Medicine check itself is unchanged: DC 10, the caller does the check, the route only records the outcome.
- Healer's Kit behavior is unchanged in every particular (uses, refusals, the ⚙ lines, the d4 ask).
- The recovery firing is unchanged: only when session time moves (TIME_ADVANCE / REST). Session-end day jumps firing late at the next advance is accepted behavior; do not change it.
- No new clock, no new migration unless the live code proves one is needed — if it does, stop and report before writing it.
- Source tag: 2024 book, no feature flag.

## Tests

- Extend `tests/healers-kit-stabilize.test.js` or add a small suite covering: Medicine-route stabilization sets the recovery hour (engine d4, 1–4 hours out) and the companion holds successes 3; three-successes stabilization sets the recovery hour for both the player character (ask fires, player's number settles it) and a companion (engine d4); damage at 0 HP clears both the stable state and the recovery hour on every route; the death-save route refuses for any stable companion.
- Update the two `integration.test.js` expectations that pin the 0/0 reset.
- Run suites only through `npm test <name>` — never run a test file directly (it hits the live database).

## Gate

Full `npm test` from the repo root. Expected: red-with-cause with **exactly the five standing named checks** in `return-loop.test.js` (four full-downtime checks, one scene-evolution check) and no other failures. Any other count is a new red — report it as such.

## Live probe

One short probe on the local model is welcome but not required; the suite coverage is the gate. If you run one, a companion stabilized by Medicine check (not the kit) regaining 1 HP when the clock passes the recovery hour is the scene that proves item 1.

## Report

Write the report to `docs/pm/reports/stabilize-recovery-alignment-REPORT.md`: Understanding first, then per-item verdicts, files changed with SHA-256s, test counts (full run + touched suites), anything not done named honestly, and decisions made (reversible, for veto). Cost/usage: report what you can measure; "unknown" is an acceptable answer.
