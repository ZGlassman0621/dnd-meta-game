# Brief — S2: damage at 0 HP

## Goal (in play)
A downed character can be killed by attacks. Every hit taken while
already at 0 HP marks one failed death save — two if the hit is a
critical — and three failures kill, through the same death path as
failed rolled saves. A huge hit never kills outright: we're always
doing death saves. Companions follow the same rule. Everything else
about death saves stays exactly as it is.

## Background
- Audit finding S2 (full-codebase audit, 2026-11-12, commit
  6084b18, PM-verified against live bytes): damage taken while at
  0 HP does nothing, so a downed player can't be killed by attacks.
  Evidence: `server/services/characterHpService.js:62-100` — damage
  clamps HP at 0, and the only counter changes are on dropping to 0
  (reset) or rising above 0. Searching `server/services` and
  `server/routes` found no other place that adds a failure on
  damage; failures only increase on rolled saves (`:193-200`); no
  massive-damage rule exists anywhere. The rolled saves themselves
  are correct: nat 1 counts two failures, nat 20 gives 1 HP
  (`:175-200`). Line numbers are from 6084b18 — verify each against
  live bytes before trusting it.
- Zach's rulings, 2026-11-12 (audit Q&A, recorded in the report):
  any damage at 0 HP is one failed death save, a critical hit is
  two, the same in the 2014 and 2024 rules; NO massive damage
  ("we're always doing death saves" — a single huge hit never kills
  outright). Settled; this job implements them, it does not
  re-decide anything.
- Companion path: NOT verified by the audit (the companion route
  only rolls saves, `server/routes/companion.js:1075-1110`). The
  2026-10-26 record says companions already carry
  death_save_successes/failures columns and a prompt display line
  at 0 HP — only the automation is deferred. This job checks the
  companion path and applies the same rule there.
- Fix shape (audit recommendation): on a negative HP change at
  0 HP, add one failure (two for a crit, which needs a crit flag
  on the marker and a prompt instruction to set it). Three
  failures kill as usual.

## What to build
1. **Survey the live repo first, then build.** On the PC, branch
   `phase-4-hybrid-combat`, verify every audit evidence point
   above against live bytes, and enumerate EVERY path by which
   damage reaches a PC or a companion at 0 HP: every marker that
   carries damage (HP_CHANGE, ENEMY_DAMAGE, table branches, spell
   damage, anything else the survey finds), every service and
   route that applies it, how each path knows a hit is a crit,
   how temp HP flows, what stabilization state exists, the
   companion HP/damage path in full, and the death path at three
   failures. Report the full list, with file and line, before
   changing anything. Workspace mirrors are staging copies, not
   the repo.
2. **The PC rule, at the choke point.** Damage taken while already
   at 0 HP adds one failed death save; a critical hit adds two.
   Fix it where damage is applied, not per marker: if one service
   applies all HP changes, the rule lives there and every marker
   inherits it. The survey must prove the coverage — every damage
   path in item 1 either flows through the fix or is listed with
   its own handling. The failures feed the EXISTING counters and
   the EXISTING three-failure death path: no parallel counter
   system, no second death path.
3. **The edges, as decided.** The hit that drops a character from
   positive HP to 0 adds NO failure — only damage taken while
   already at 0 counts. Temp HP absorbs first: only damage that
   reaches HP past temp HP adds failures. Damage to a stabilized
   character adds failures per the same rule and clears
   stabilization. Healing from 0 HP and rising above 0 reset the
   counters exactly as today. If the survey shows any of these
   edges can't work as stated, report it with evidence instead of
   inventing a variant.
4. **Crits, both kinds.** DM-declared damage: a crit flag on the
   damage marker(s) plus a prompt instruction telling the DM to
   set it on a critical hit. Engine-judged damage: where the
   engine already computes crits (attacks judged against AC), the
   crit flows through automatically — no DM flag needed. The
   report states, per damage path, which kind it is and how the
   crit reaches the rule.
5. **The companion rule.** The same rule on the companion damage
   path: damage at 0 HP adds failures (two on a crit) against the
   companions' existing counters, same death path. If the survey
   shows the companion path can't take it, report exactly why
   with evidence — a gap stated as a gap, never a silent skip.
6. **Tests that model every branch.** The dropping hit adds no
   failure; a non-crit hit at 0 adds one; a crit at 0 adds two;
   three failures kill through the existing death path; rolled
   saves unchanged (nat 1 = two failures, nat 20 = revive);
   healing from 0 resets; damage to a stabilized character adds
   failures and clears stabilization; temp HP absorbs before any
   failure; companion equivalents of each. Full `npm test` green
   on the builder's run.
7. **Prove it at :5173 (never :3000).** Drive the audit's repro by
   hand: a character at 0 HP takes another hit and the death-save
   pips move; a crit case if it can be driven, otherwise the
   route-test coverage is stated. Exact steps in the report.

## Out of scope
- Massive damage — FORBIDDEN by Zach's ruling. No instant-death
  rule of any shape, no matter how large the hit.
- Any change to rolled death-save mechanics (nat 1 / nat 20 /
  stabilization on successes) — already correct.
- Reactions (Counterspell/Shield post-cast hooks) — separate job.
- H2+H3, H1, creator round 3, severe-seven, M1, return-loop,
  L1–L6, or any other queued job.
- Any migration. The counters already exist for PCs and
  companions; if the survey shows a column missing anywhere, the
  builder stops and reports it instead of inventing schema.

## Acceptance criteria
- Damage while already at 0 HP adds one failed death save; a crit
  adds two — for PCs and companions, on every damage path the
  survey found.
- The dropping hit adds no failure; temp HP absorbs first;
  stabilization clears on damage; healing resets as today.
- Three failures kill through the existing death path — the same
  path rolled-save failures use.
- No massive-damage rule exists anywhere in the build.
- Rolled saves unchanged (nat 1 / nat 20 behavior intact).
- Full `npm test` green on the builder's run; new/updated suites
  cover each item above.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  and iterate until green. Zach's full run is the gate — never
  claim it.
- At :5173 (never :3000): the audit repro by hand — a downed
  character takes a hit and the pips move.
- Note the known runner flag: spellbook-routes takes ~158s against
  the runner's 120s per-file cap — a timeout artifact, not a
  failure, if it trips.

## Decisions already made
- Damage at 0 HP = 1 failure, crit = 2; NO massive damage, ever
  (Zach, 2026-11-12). Settled.
- The dropping hit adds no failure; temp HP absorbs first;
  stabilization clears on damage (PM decisions, vetoable at the
  gate — the book-consistent readings).
- Fix at the choke point, not per marker (PM decision, vetoable):
  one rule where damage is applied, coverage proved by the survey.
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling
  gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.
- The 2024 book wins on conflict.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts
  for the seven items above (built / already-present / still-open
  with evidence), the full damage-path inventory (file + line for
  every path, with its crit story and its disposition), and the
  companion-path finding.
- Any question for Zach in full plain terms, one per item, with
  what was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never
  :3000).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief
  to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test` +
  :5173 checks on the PC.
- Place this brief at `docs/pm/s2-damage-at-zero-hp/BRIEF.md`
  in the repo when handing it over. Reports live in
  `docs/pm/reports/`.
