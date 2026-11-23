# Brief — H1: teach the DM its markers (dungeons, rooms, cold, lair, class features)

## Goal (in play)
Systems the game already built finally get used. When the party
reaches a dungeon the DM creates it instead of describing one
freehand; when a fight starts in a real room the DM names that
room and the room's walls, cover, and hazards actually apply; when
the party walks into freezing weather the cold bites; when a lair
starts coming down the DM can say so and the engine tracks it; and
when a character uses a feature like Tides of Chaos or Bend Luck,
it resolves mechanically instead of being narrated past. Nothing
new is built — the systems exist, the DM just never learned to
call them.

## Background
- Audit finding H1 (full-codebase audit, 2026-11-12, commit
  6084b18, PM-verified against live bytes): several built systems
  can never fire, because the AI is never told their markers
  exist. The handlers are registered and imported; the marker
  text appears only in code comments, never in any prompt (the
  audit searched all of `server/` and `client/src`, including
  non-JS files). Evidence below is starting points from the
  2026-11-12 report — verify each against live bytes before
  trusting it. Line numbers are from 6084b18.
- The markers, as the audit lists them:
  - Dungeon generation `GENERATE_DUNGEON`: handler
    `server/services/dungeonGenerationService.js:245`,
    comment-only usage at `:240`.
  - Scene rooms `SET_ROOM`:
    `server/services/sceneLinkService.js:169`, comment at
    `:163-164`.
  - Place evolution `EVOLVE_PLACE`:
    `server/services/timeEvolutionService.js:296`, comment at
    `:290`.
  - Cold exposure `COLD_SCENE` / `COLD_WET`:
    `server/services/coldExposureService.js:568`. Exposure only
    runs once a cold scene is set (`:505-509`).
  - Lair durability `LAIR_*`:
    `server/services/lairDurabilityService.js` (individual
    marker names enumerated by the survey in item 1).
  - Enemy display spells `ENEMY_DISPLAY`:
    `server/services/displayService.js:450`.
  - Class and subclass features: `HEROIC_REROLL`,
    `BEND_LUCK`, `TIDES_OF_CHAOS`, `PRESERVE_LIFE`,
    `TAMED_SURGE`, `TELEPATHIC_SPEECH`, `AWAKENED_MIND`,
    `HOUND_OF_ILL_OMEN`, `ACCURSED_SPECTER`, `FAITHFUL_SUMMONS`
    (`server/services/subclassMarkerService.js:369-450` region,
    imported at `server/routes/dmSession.js:70-78`), and
    `ARTIFICER_REPLACE_PLAN` / `ARTIFICER_ATTUNE` /
    `ARTIFICER_RIGHT_TOOL` / `ARTIFICER_RELEASE`
    (`server/services/artificerService.js:684` and family).
  - Handlers are imported for their side effects at
    `server/routes/dmSession.js:44-68`.
- Checked, no fix needed: attunement (`ATTUNE` / `UNATTUNE`)
  is already taught via `attunementService.js:217`.
  Marker wiring overall: 125 schemas and 105 handlers, every
  handler service imported; the three schema-only markers are
  handled inline by design (`ADD_ITEM` via `MERCHANT_SHOP`,
  `NPC_WANTS_TO_JOIN` via recruitment, `SWIM`). The gap is
  prompt teaching, not wiring — the survey in item 1 proves
  that per marker or reports the exception.
- Settled decisions that shape the teaching (do not re-decide):
  - Dungeon generation trigger is the DM marker ONLY — the
    DM's world decides where dungeons are, never the player
    (Zach, 2026-11-02). Scope is generation + storage ONLY —
    the party must choose to enter; nothing places them inside
    automatically. Coherence guardrails apply: the DM's choice
    is final, but an anomalous result carries a justifying
    story, never passes silently.
  - Scene layer (Zach, 2026-11-02): trigger is auto-link for
    dungeon rooms + DM marker for other fights; scope is
    linking PLUS a simple room record for non-dungeon fights
    (name + features + exits); mid-fight moves re-link; once
    linked, cover / display / durability read the room
    automatically, with no per-action DM naming.
  - Cold is a feature, never a hazard to soften (pm-guide §3):
    cold, dangerous survival pressure stays in play.
  - The DM model is gemma4:12b (Zach, 2026-11-10), offline on
    the PC. Prompt additions must be terse — one trigger line
    per marker in the existing marker pattern, not essays.
    The model reads the prompt every turn; brevity is part of
    the job.
- Related open items, NOT this job: the scene-entry call site
  that links an encounter to its room via setEncounterRoom —
  the link table and setter exist, no caller wires it yet, so
  validation bites only once a room is linked. Teaching
  `SET_ROOM` is the DM-side half of that; building a caller
  is separate. Evolution news reaching the DM prompt is
  deferred post-MVP — teaching `EVOLVE_PLACE` (the DM
  proposing a place's change) is this job; the news-wiring
  job is not.

## What to build
1. **Survey the live repo first, then build.** On the PC, branch
   `phase-4-hybrid-combat`, verify every evidence point above
   against live bytes, and enumerate for EACH marker in the
   list: its schema (fields, required vs optional), its
   registered handler and what it does, and whether any prompt
   text already teaches it — in `dmPromptBuilder.js`, in any
   per-feature subclass prompt line, in a system note, or
   nowhere. Report the full inventory, with file and line,
   before changing anything. Workspace mirrors are staging
   copies, not the repo. Survey the lean-prompt path too:
   `applyLeanTransforms` strips the mechanical-markers section
   and `[HP_CHANGE]` survives only by explicit exception — say
   where the new teaching must live so it is not stripped in
   lean mode, and report the placement chosen and why.
2. **Dungeon, scene, and cold first.** Teach `GENERATE_DUNGEON`,
   `SET_ROOM`, `EVOLVE_PLACE`, `COLD_SCENE`, and `COLD_WET`
   in the DM prompt, in the audit's order. Each line states
   WHEN to emit it and its exact fields, in the existing
   marker pattern: `GENERATE_DUNGEON` when the DM's world
   places a dungeon the party may find (never on a player's
   say-so, never placing the party inside); `SET_ROOM` when a
   fight starts in a named room, or the party moves to one;
   `EVOLVE_PLACE` when the DM proposes a place changed by
   time; `COLD_SCENE` when the party enters freezing
   conditions, `COLD_WET` when a character gets wet in the
   cold. No new handler, no new field, no behavior change —
   the engine already does the work once the marker arrives.
3. **Lair and display next.** Teach the `LAIR_*` markers
   (enumerated by the survey) and `ENEMY_DISPLAY`, same
   pattern: when to emit, exact fields, what the engine does
   with it. Lair teaching covers creating / damaging /
   stabilising a lair and the hazard roll; display teaching
   covers an enemy casting a spell as a display.
4. **Class-feature markers last, reconciled with the class
   audit.** Teach the ten subclass markers and the four
   artificer markers ONLY where the survey proves the
   underlying feature is actually wired and working. Where
   the feature itself is a class-audit gap (unwired, like the
   known `learnPlan` example) or otherwise not working,
   do NOT teach its marker and do NOT build the feature —
   report it as still-open for the severe-seven job, with
   its evidence. Teaching a marker for a broken feature
   would make the DM promise something the engine cannot do.
   The subclass / artificer part of H1 is a possible
   class-audit overlap by the audit's own flag; this item is
   the reconciliation.
5. **Prompt-contains tests, one per marker.** A test per taught
   marker asserting the assembled DM prompt contains its
   instruction (the audit's fix shape). Tests also assert the
   already-taught `ATTUNE` / `UNATTUNE` lines are unchanged,
   and that no taught marker's instruction is lost in lean
   mode. Full `npm test` green on the builder's run.
6. **Prove it live on gemma4:12b.** Start a session on the
   real server + local model and confirm the assembled prompt
   carries the new sections (report the verbatim excerpt).
   Where feasible, drive at least one marker end to end in
   play (e.g. `SET_ROOM` or `COLD_SCENE`) and report what
   actually fired. Markers not live-probed are reported as
   prompt-proved only — never claimed as live-proved.
7. **Prove it at :5173 (never :3000).** Play a short session
   by hand in which the DM creates a dungeon or names a room
   and the engine responds (room record, dungeon stored).
   Exact steps in the report.

## Out of scope
- Any new handler, service, schema, or migration. If the
  survey finds a marker with no handler or no schema, report
  it as still-open with evidence — do not build it here.
  This is a prompt-teaching job; the audit's verdict was
  that the wiring exists.
- Building or fixing any class / subclass feature — that is
  the severe-seven job. This job teaches markers for working
  features and reports the rest.
- H2+H3, creator round 3, M1, reactions, return-loop, L1–L6,
  or any other queued job.
- Evolution-news-into-DM-prompt wiring (deferred post-MVP).
- Any change to the DM rules registry, the AI behavior
  playbook, or the knowledge-flag system (none exists yet).
- Any change to marker schemas, handler behavior, or the
  correction loop — teaching only.

## Acceptance criteria
- Every marker in the audit's H1 list is accounted for in the
  report: taught, already taught, or still-open with evidence.
- `GENERATE_DUNGEON`, `SET_ROOM`, `EVOLVE_PLACE`,
  `COLD_SCENE`, `COLD_WET`, the `LAIR_*` set, and
  `ENEMY_DISPLAY` are taught in the prompt and survive lean
  mode; prompt-contains tests pass per marker.
- No class-feature marker is taught for a feature the survey
  showed unwired; each such marker is listed still-open for
  severe-seven.
- `ATTUNE` / `UNATTUNE` teaching is byte-identical to before
  this job.
- No handler, schema, or service behavior changed; no
  migration.
- Full `npm test` green on the builder's run; new suites cover
  each item above.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  and iterate until green. Zach's full run is the gate — never
  claim it.
- Live probe on gemma4:12b (item 6) + :5173 by hand (item 7,
  never :3000).
- Note the known runner flag: spellbook-routes takes ~158s against
  the runner's 120s per-file cap — a timeout artifact, not a
  failure, if it trips.

## Decisions already made
- Prompt-only job; wiring exists (audit, 2026-11-12, PM-verified).
  A marker with no handler is reported, not built (PM decision,
  vetoable at the gate).
- Dungeon / scene / cold first, then class-feature markers,
  reconciled with the class audit (audit's proposed order, PM
  decision, vetoable).
- Teach only working features; unwired features stay still-open
  for severe-seven, never taught, never built here (PM decision,
  vetoable — teaching a broken feature makes the DM promise
  what the engine cannot do).
- Terse teaching lines, one trigger line per marker in the
  existing pattern (PM decision, vetoable — gemma4:12b reads
  this prompt every turn).
- GENERATE_DUNGEON is DM-marker-only; generation + storage
  only; coherence justification required (Zach, 2026-11-02).
  Scene-layer trigger and scope as settled (Zach, 2026-11-02).
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a
  sibling gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.
- The 2024 book wins on conflict.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts
  for the seven items above (built / already-present / still-open
  with evidence), the full marker inventory (schema + handler +
  prompt state, file + line for each), the lean-mode placement
  decision with its evidence, and the class-audit reconciliation
  list (taught vs still-open, per feature marker).
- Any question for Zach in full plain terms, one per item, with
  what was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never
  :3000).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief
  to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test` +
  :5173 checks on the PC.
- Place this brief at `docs/pm/h1-teach-the-markers/BRIEF.md`
  in the repo when handing it over. Reports live in
  `docs/pm/reports/`.
