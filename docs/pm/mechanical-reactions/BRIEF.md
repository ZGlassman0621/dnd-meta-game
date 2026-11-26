# Brief — Reactions, mechanical (AMENDED DRAFT)

**Status: AMENDED DRAFT — amended 2026-11-25, not approved for courier, not queued ahead of the story-starters job. Placement is Zach's call; queue position is unchanged (story-starters first, then this job). Do not send to Claude Code while the weekly Claude Code allowance hold stands (Zach, 2026-11-25).**
**Amendment 2026-11-25 (PM):** this draft replaces the 2026-11-22 draft (`reactions-mechanical-BRIEF-DRAFT-2026-11-22.md`) for courier purposes. It folds in the Counterspell slot amendment note (`reactions-counterspell-slot-amendment-note-2026-11-25.md`) and fixes items superseded since 2026-11-22:
- Folded in: when a spell is countered, the countered caster's slot is not expended (2024 Counterspell, from Zach's PHB Chapter 7 transcription; finding recorded in the spell corrections report, built and verified 2026-11-25, v1.0.217). Survey, build, and tests now cover both slots (the counter's and the countered caster's) on every cast path.
- Removed the per-job :5173 pass (old item 7, Verification, Setup) — Zach ruled 2026-11-24: no :5173 testing per job; one test once everything is done; per-job gate is `npm test` only. The live probe on the local model (item 6) stays — it is builder-side proof, not Zach's :5173 test. The report lists the exact final-test checks instead.
- Updated stale references: the marker-teaching job (built 2026-11-23) and the class-audit fixes (built 2026-11-25, including the seven class-feature markers joining the turn order) are live; the survey treats their markers and features as live and reports any reaction feature still unwired on current evidence. Jobs built since 2026-11-22 are no longer listed as future work.
The goal and the rest of the build steps are unchanged from the 2026-11-22 draft.

## Goal (in play)
A reaction is a mechanic, never a line of narration. When a spell
is cast and someone counters it, when a blow lands and someone
raises a shield, when an enemy walks past with its guard down — the
engine resolves it: the slot is spent, the budget is checked, the
bonus applies, the outcome is recorded. The DM never narrates a
reaction the engine did not run, and never runs a reaction past the
player without the engine knowing.

## Background
- Settled principle (Zach, 2026-11-10): reactions are mechanical.
  Every reaction — Counterspell, Shield, opportunity attacks —
  resolves through the engine with all its hooks, never as
  narration. (pm-guide §3.)
- Queue scope (pm-guide queue line): Counterspell / Shield run
  post-cast hooks; all reactions resolve through the engine.
- What exists today: combat item 6 (2026-11-02, gated green)
  rewrote SPELL_CAST and ENEMY_CAST with Shield +5 AC on all
  attack paths, counterspell arming, trio reactions, armed-counter
  deferral, multi-target loops, party-counter interception, and a
  reaction budget — plus `lastDamageService` records on every damage
  path and turn-boundary repeat saves. That is the machinery this
  job audits against the principle: the survey in item 1 proves,
  per reaction, whether the engine path actually runs in play or
  whether the DM can still narrate past it. Since the 2026-11-22
  draft, the spell corrections job (built 2026-11-25, v1.0.217)
  added a material field and cast-time check on the cast paths, and
  the class-audit fixes (built 2026-11-25, v1.0.212–1.0.214) wired
  the seven class-feature markers (Heroic Reroll, Bend Luck, Tides
  of Chaos, Tamed Surge, and the hound, specter, and Faithful
  Summons beasts joining the turn order). The survey confirms all
  of this against live bytes; do not trust this summary over live
  code.
- Counterspell slot finding (spell corrections report, "Not done"
  item 9, built and verified 2026-11-25): the counterspell path
  spends the countered caster's slot when the spell is countered,
  but the 2024 book says the slot isn't expended. Book line, from
  Zach's PHB Chapter 7 transcription (Counterspell): "On a failed
  save, the spell dissipates with no effect, and the action, Bonus
  Action, or Reaction used to cast it is wasted. If that spell was
  cast with a spell slot, the slot isn't expended." This job owns
  that fix (items 1, 2, and 5) — it is the other half of the same
  cast path as the counter's own slot rule, and must not run as a
  separate job alongside this one.
- Related, NOT this job: the identify-and-counter-in-one-Reaction
  idea and Passive Arcana are proposed registry rules, not queued
  — the Arcana gate threshold is open, the Passive Arcana DC is
  undefined. Do not build either here. Section 15 of the Stolen
  Rules pack (reactions) belongs with this job's territory by the
  registry's own note, but its rules are proposed, not decided —
  survey them, do not build them. The object-permanence exploration
  (2026-11-22) is a separate design question; do not fold it in.
- Settled decisions that shape this job (do not re-decide):
  - Nothing mechanical is narrative-only (Zach, 2026-11-08,
    system-wide rule).
  - The DM model is gemma4:12b (Zach, 2026-11-10), offline on the
    PC. Prompt additions must be terse — the model reads the prompt
    every turn.
  - The marker-teaching job (built 2026-11-23) teaches the DM the
    feature markers where the underlying feature is wired. This job
    is the engine side: the reaction actually resolving. The two
    jobs are siblings, not substitutes — teaching a marker for a
    reaction the engine cannot resolve would make the DM promise
    what the engine cannot do. Where the survey finds a taught
    marker whose reaction still cannot resolve, report it; do not
    teach anything new here.

## What to build
1. **Survey the live repo first, then build.** On the PC, branch
   `phase-4-hybrid-combat`, enumerate EVERY reaction path the game
   has — opportunity attacks, Ready, Shield, Counterspell, trio
   reactions, subclass/artificer reaction features, and any other
   reaction the registry or code names — with file and line: its
   trigger, its hook (post-cast or otherwise), its budget check,
   and whether the DM prompt teaches it or can bypass it. For every
   cast path, also record what happens today to BOTH slots: the
   counter's slot and the countered caster's slot, with file and
   line. (The material check's call sites in the spell corrections
   report are a starting list of cast paths, to be confirmed live —
   player cast, companion cast, enemy cast, readied hold, party
   cast.) Report the full inventory before changing anything, per
   reaction: engine-resolved, narration-only, or unwired. Workspace
   mirrors are staging copies, not the repo.
2. **Counterspell and Shield first.** Both run post-cast hooks on
   every cast path (PC cast, enemy cast, multi-target loops): the
   counter is armed before the spell resolves, the counter's slot
   is spent only when the counter fires, a counter with no DC stays
   armed (per the item-6 build call, flagged for veto — do not
   change that behaviour here, report it), and Shield's +5 AC
   applies on all attack paths including recomputed pending
   judgments. **Countered caster's slot:** when a spell is
   countered, the countered caster's action/Bonus Action/Reaction
   is wasted and the spell has no effect, but a spell slot used to
   cast it is not expended. The counter's own slot and reaction
   budget are spent as stated above. Cover every cast path the
   survey finds. Where the survey finds a cast path that skips the
   hook, wire it in and prove it with a test.
3. **Then every other reaction, same rule.** Opportunity attacks,
   Ready firing, and each subclass/artificer reaction feature the
   survey proved wired: each resolves through the engine, spends
   the reaction budget exactly once, and records its outcome. A
   reaction the survey proved unwired is reported still-open with
   its evidence — do NOT build the feature here and do NOT teach
   its marker. (The class-audit fixes built 2026-11-25 wired the
   seven class-feature markers; treat them as live and report any
   reaction feature still unwired on current evidence.)
4. **No narration-only path remains.** Where the DM can currently
   narrate a reaction's outcome without the engine running it (a
   prompt line, a marker the DM may emit freely, a narration path
   with no hook), close it: the outcome comes from the engine
   record, or the narration path is removed. Report each closed
   path with its evidence.
5. **Tests.** One suite per reaction in the inventory, asserting
   the engine resolution: budget spent once, counter's slot spent
   only on a fired counter, **a countered spell leaves the
   countered caster's slot unspent on each cast path; a spell that
   is not countered spends its slot as before; no path both refunds
   the slot and lets the spell take effect**, Shield bonus applied
   and recomputed, no double resolution, and a narration-only
   attempt producing no mechanical effect. Full `npm test` green on
   the builder's run.
6. **Prove it live on gemma4:12b.** Start a session on the real
   server + local model and drive at least one counter and one
   Shield end to end in play; report what actually fired. Reactions
   not live-probed are reported as test-proved only — never claimed
   as live-proved.
7. **No :5173 pass in this job.** Zach ruled 2026-11-24: no :5173
   testing per job — one test once everything is done and ready;
   per-job gate is `npm test` only. Do not drive :5173 in this job.
   Instead, the report lists the exact final-test checks for this
   job (play a short combat in which a Shield and a Counterspell
   both fire and the engine state — slots, budget — shows it; a
   countered spell leaves the caster's slot unspent) so Zach's one
   final test covers the visible result.

## Out of scope
- The identify-and-counter-in-one-Reaction idea and Passive Arcana
  (proposed registry rules, not queued — thresholds undefined).
- Building or fixing any class / subclass feature — the
  class-audit fixes (built 2026-11-25) owned that; this job wires
  reactions for working features and reports the rest.
- Any new reaction type not in the book or registry.
- Any change to marker schemas, handler behaviour, or the DM rules
  registry, except where item 4 closes a narration-only path.
- The story-starters job (packaged, held 2026-11-25 for the weekly
  allowance — it goes first), the leave-and-return test, the
  dead-code cleanup, the tooltip rewrite, the MVP-only UI build,
  or any other queued job. (Jobs built since the 2026-11-22 draft
  are done and are not scope here.)

## Acceptance criteria
- Every reaction in the inventory is accounted for in the report:
  engine-resolved, or still-open with evidence.
- Counterspell and Shield run post-cast hooks on every cast path;
  no cast path skips them.
- No reaction spends its budget twice; no counter spends its slot
  without firing; no countered spell expends the countered
  caster's slot.
- No narration-only reaction path remains; each closed path is
  listed with evidence.
- Full `npm test` green on the builder's run.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  and iterate until green. Zach's full run is the gate — never
  claim it. Per Zach's 2026-11-24 rule, a handed-over report is
  assumed gate-green unless Zach reports red; there is no per-job
  :5173 pass (item 7).
- Live probe on gemma4:12b (item 6).
- Note the known runner flag: spellbook-routes takes ~158s against
  the runner's 120s per-file cap — a timeout artifact, not a
  failure, if it trips.

## Decisions already made
- Reactions are mechanical; all resolve through the engine, never
  as narration (Zach, 2026-11-10).
- Counterspell / Shield run post-cast hooks (pm-guide queue line).
- A countered spell does not expend the countered caster's slot
  (2024 PHB Counterspell, from Zach's Chapter 7 transcription;
  finding in the spell corrections report, 2026-11-25).
- Unwired features are reported still-open, never built or taught
  here (PM decision, vetoable).
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling
  gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.
- The 2024 book wins on conflict.
- Testing (Zach, 2026-11-24): no :5173 testing per job; per-job
  gate is `npm test` only; the :5173 pass is the one final test
  once everything is done.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts
  for the seven items above, the full reaction inventory (file +
  line, engine-resolved / still-open with evidence, both slots'
  behaviour per cast path), and the list of narration-only paths
  closed.
- Any question for Zach in full plain terms, one per item, with
  what was checked and what is still unclear.
- How to verify: gate command, plus the final-test checks from
  item 7 (to be run at Zach's one final test, not in this job).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief
  to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test`
  on the PC (no per-job :5173 pass, Zach 2026-11-24).
- Place this brief at `docs/pm/reactions-mechanical/BRIEF.md`
  in the repo when handing it over. Reports live in
  `docs/pm/reports/`.
