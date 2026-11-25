# Brief — class-audit-severe-seven: every class can do what the book says

## Goal (in play)
A player who picks any class in the game can actually play it. A warden's
spells land with a real difficulty to beat. A warlock chooses invocations
from level 1. A wizard who levels up learns two new spells. An artificer
learns infusion plans. A scholar of the Theologian path prepares spells
under a real cap the sheet shows. And a wizard-warlock who spends both
kinds of spell slots can still recover the wizard one. Today, four
in-MVP classes cannot do what the book says in play — this job fixes
that, starting with the seven severe gaps.

## Background
- Read-only class audit, run 2026-11-10 at Zach's request (wizard kept
  surfacing gaps — check whether other classes got the same treatment).
  Report: `class-audit-2026-11-10.md`. It verified **23 classes, not 19**
  (adds blood_hunter, keeper, warlord) from live `client/src/data/classes.json`
  on branch `phase-4-hybrid-combat`, and ordered **22 gaps** by severity.
  This brief covers the severe seven only.
- The audit's headline finding: wizard is actually the *best*-served caster
  (full spellbook system, validators, rest wiring). The least-served classes
  are the newer ones — magus, scholar, warden, warlock, artificer.
- MVP note: Magus and Scholar are grayed out for player characters, so
  their spell-DC gap does not block the MVP — but the one plumbing fix
  covers Warden too, which IS in the MVP. Fix the plumbing once, not
  per class.
- This job comes after creation solidification and creator round 3 in
  the queue (PM guide §6). Creator round 3 is built (gate pending);
  this job touches class systems, not the creator, so it can build
  while round 3 waits for the gate. Zach placed this job next
  2026-11-24, which clears the review block on handing it over.

## What to build

**0. Audit the audit first — before building anything.** Independently
verify all 22 gaps in `class-audit-2026-11-10.md` against the live code
on the Mac. Report any gap that does not reproduce, with the live
evidence. Do not build a gap that fails verification, and do not
silently widen scope to gaps the audit did not list. (Zach, 2026-11-10:
"I'm going to have that program audit this as well to check your work.")

**1. Spell DC for Magus, Warden, Scholar — one plumbing fix.**
`spellProfileFor(actor, className, subclassName = null)` resolves the
casting-subclass ability only when a subclass is passed
(`combatStatsService.js:329-344`, with an in-code comment flagging the
plumbing as a follow-up); all three `spellCastService.js` callers
(`:97,:732,:782`) pass class only. Result: these classes cast with no
DC and no attack bonus. Pass the subclass through so the DC resolves.
In play: a warden's spell now has a difficulty the enemy must beat,
like every other caster's.

**2. Warlock Eldritch Invocations — picker + storage + service.**
Invocations are owed from level 1 and do not exist anywhere in the
build: no picker, no storage column, no service code (0 hits in
LevelUpPage/CharacterSheet; `character.js:153` is a comment only).
Build the level-up picker, persist the picks, and wire them into the
sheet so the player can see what they have. In play: a warlock picks
invocations as they level, the way the book says.

**3. Wizard +2 spells picker on in-class level-up.** The level-up code
returns null for prepared casters (`getSpellsKnown`,
`levelProgression.js:1845`), so the envelope sends `newSpellsKnown: 0`
and the picker never renders (`character.js` ~7100 comment). Fix the
root cause so an in-class wizard level-up offers the +2 spells picker.
Multiclass-in already seeds 6 correctly — do not change that. In play:
a wizard who levels up in wizard learns two new spells for the book.

**4. Known Spells sheet section — make it render.** `isKnownCaster()`
gates on `spellcasting.spellsKnown === 'Limited known'`
(`CharacterSheet.jsx:793-794`), but that string appears **nowhere** in
live `classes.json` (0 hits). The whole section — cap display and
"+ Learn New Spell" button (`CharacterSheet.jsx:3740-3803`) — never
renders. Consequence: magus, spellshot, casting warden, and Ritualist
scholar get no spell UI on the sheet at all. Fix the gate so it matches
what the live data actually says. In play: a known-spells caster sees
their spells and their cap on the sheet between level-ups.

**5. Artificer infusions — wire the dead code.** `learnPlan` /
`replacePlan` (`artificerService.js:250,266`) exist as pure functions
with zero callers in `character.js` or `dmSession.js`, no route, no UI.
Artificers never learn infusion plans. Wire them: a picker at the
levels the book grants them, storage, and display on the sheet. In
play: an artificer learns infusions and can use them.

**6. Scholar (Theologian) — validator + UI.** Theologian prepares cleric
spells, cap 3@3→13@20, and the cap table exists in `getSpellsPrepared`
— but there is no sheet section, no PUT validator, no level-up
re-check (0 "theologian" hits in `character.js` and
`CharacterSheet.jsx`). Build all three, following the prepared-caster
validator pattern the other classes already use. In play: a Theologian
scholar prepares spells under a cap the game enforces and shows.

**7. Batch (a) — split the shared slot map.** `resetPactSlots`
(`spellbookService.js:792-800`) subtracts the full pact slot count from
the shared used-slots map and deletes the key at ≤0. A wizard 5 /
warlock 3 who spent 1 wizard + 1 pact 2nd-level slot loses the record
of the spent wizard slot after a pact reset, so banked Arcane Recovery
refuses "no level 2 spell slot is spent" though a wizard slot is
spent. Split the map (D3) so pact resets touch pact slots only. In
play: a wizard-warlock recovers the wizard slot they actually spent.

**8. Seven class-feature markers the DM can write but nothing answers.**
The marker-teaching job taught the DM prompt seven class-feature
markers; these seven were left still-open because the engine side
does not answer them. Each one is in `subclassMarkerService.js`
with per-marker defect evidence in the marker-teaching report
(`docs/pm/reports/h1-teach-the-markers-REPORT.md`, reconciliation
section). Fix each so the feature actually works in play:
- **Heroic Reroll** — three defects. (1) A pending player roll is
  deleted the moment its number is resolved
  (`rollRequestService.js:508`), so by the time the DM could emit
  the marker there is nothing left to reroll; the "reroll available"
  flag is returned to the route but never shown on any screen.
  (2) The handler reads `parsed.fields?.Target`
  (`subclassMarkerService.js:370`) where every other handler reads
  `parsed.Target`, so Target is always empty. (3) It passes the
  target as a third argument that
  `requestHeroicReroll(sessionId, previousOutcome)` doesn't take
  (`:372` vs `rollRequestService.js:348`), so the promised companion
  reroll never happens.
- **Bend Luck** (Wild Magic sorcerer 6) — spends the sorcery point
  and rolls the d4, but the d4 is only in the handler's result note
  (`:411-414`), which never reaches the DM, and nothing applies it
  to the roll.
- **Tides of Chaos** (Wild Magic sorcerer 3) — writes
  `tidesOfChaos.advantagePending` into class resources (`:440`),
  and nothing in the roll system reads it, so the advantage never
  applies. The surge-restore path reads a different flag
  (`session_config.tidesOfChaosSpent`, `spellCastService.js:533`),
  so the two never meet.
- **Tamed Surge** (Wild Magic sorcerer 18) — spends the
  once-per-long-rest use and stores the chosen row (`:549`), but no
  caller passes that choice to the surge roller. `tamedSurgeRow` is
  accepted by `wildMagicService.js:274`, and nothing ever supplies it.
- **Hound of Ill Omen** (Shadow Magic sorcerer 6) — spends 3 sorcery
  points and creates a `combat_allies` row. Nothing in combat, the
  turn order or the prompt reads that table (only `entityService.js`
  and the marker service touch it), so the hound can't act or be
  targeted, and its save disadvantage is never applied.
- **Accursed Specter** (Hexblade warlock 6) — same: a row nothing
  reads.
- **Faithful Summons** (Shepherd druid 14) — same: rows nothing reads.
In play: the reroll happens, the d4 applies to the roll, the
advantage applies, the chosen surge row is used, and the summoned
hound, specter, and beasts act in combat and can be targeted.

**9. Keeper genre-bonus texts — find them or report them missing.**
The Keeper's 8 genre-bonus texts are confirmed missing (no `genre`
key in `keeperTexts.js`, per the docs-cleanup report). Check the
Keeper design material for the texts and wire them in if they exist.
If no source holds them, report them as missing data — never invent
them. (The Keeper's missing service and rest hook are a separate,
medium gap — not this job.)

## Out of scope
- The high gaps (fighting-style level-up picker for all classes;
  Expertise picker/storage for rogue/bard; sorcerer Metamagic; bard
  Magical Secrets; warlock Mystic Arcanum storage; duelist Critical
  Strikes picker; style lists for warden/blackguard/duelist/blood
  hunter) — next job(s) after this one, in severity order.
- The medium gaps (druid Wild Shape uses, paladin Channel Divinity,
  Keeper service/rest hook, fighter Indomitable) and the lower gaps
  (known-caster PUT validation, Book of Shadows mechanic, OCR-loss
  flags + Last Dance, Prepared Spells primary-gating) — later jobs.
- Reactions running post-cast hooks (separate job, queued after this).
- Return-loop test suite (separate job).
- Knowledge-ignorance design (design job, not a build).
- #12 origin-suffix reversal (flagged for Zach's veto).
- Goliath, ancestry feats for the 18 deferred species, Metamagic,
  Cosmic Omen (book text received 2026-11-10 — photo; unblocks the
  mechanics-hooks follow-up, separate job).
- Any change to the 11-species MVP scope or the grayed-out classes.
  Magus/Scholar stay grayed out for PCs; this job fixes their shared
  plumbing because Warden needs it, not because they are un-grayed.

## Acceptance criteria
- A warden (and magus/scholar, where playable) casts a spell and the
  target faces a real spell DC and attack bonus; previously the DC was
  null.
- A warlock picks invocations from level 1; picks persist across
  sessions and show on the sheet.
- A wizard leveling up inside wizard gets the +2 spells picker; the
  picked spells land in the spellbook. Multiclass-in still seeds 6.
- A magus, spellshot, casting warden, or Ritualist scholar sees their
  Known Spells section on the sheet with the real cap and a working
  "+ Learn New Spell" action.
- An artificer learns infusion plans at the book's levels; plans persist
  and show on the sheet.
- A Theologian scholar's prepared spells are capped at 3@3→13@20 on
  sheet save and level-up, and the sheet shows the prepared list.
- A wizard 5 / warlock 3 who spent 1 wizard + 1 pact 2nd-level slot
  recovers the wizard slot with banked Arcane Recovery after a pact
  reset; the pact reset no longer erases the wizard spend.
- Each of the seven class-feature markers works in play: the reroll
  happens, Bend Luck's d4 applies to the roll, Tides of Chaos
  advantage applies, the chosen Tamed Surge row is used, and the
  Hound of Ill Omen, Accursed Specter, and Faithful Summons act in
  combat and can be targeted.
- The Keeper's 8 genre-bonus texts are wired in from the design
  material, or reported as missing data with the source checked.
- The independent audit (item 0) reports a per-gap verdict for all 22
  gaps: verified, or not reproduced with live evidence.
- Full `npm test` green on the builder's run; new/updated suites cover
  each item above.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  (`E:\DnD Meta Game\dnd-meta-game`) and iterate until green. Zach's
  full run is the gate — never claim it.
- Note the known runner flag: spellbook-routes takes ~158s against the
  runner's 120s per-file cap — a timeout artifact, not a failure, if it trips.

## Decisions already made
- Severe seven first, then high, medium, lower in severity order (Zach,
  2026-11-10, walkthrough Part 5 + PM guide §6).
- Claude Code independently audits the class audit before building
  (Zach, 2026-11-10).
- One plumbing fix covers magus, warden, and scholar DC (audit finding;
  do not fix per class).
- The sheet-spell gap for Spellshot and Warden (full-codebase audit,
  high finding) is covered by item 4 as written — both are named in
  its acceptance — so it folds in here with no separate item.
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling gets
  fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask before
  building. Never invent data — a gap is stated as a gap.
- Multiclass prerequisites removed (Zach, 2026-11-08); nothing here
  reintroduces one.
- The 2024 book wins on conflict.
- Reactions are mechanical (Zach, 2026-11-10) — noted here only because
  item 1 touches the cast path; reaction-hook wiring itself is the
  separate reactions job, not this one.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts for
  the seven items above (built / already-present / still-open with evidence),
  and the item-0 audit verdicts for all 22 gaps.
- Any question for Zach in full plain terms, one per item, with what was
  checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never :3000).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief to
  Claude Code and carries the report back to Muse.
- Repo sync CONFIRMED 2026-11-10: the project lives on GitHub; Zach
  keeps the Mac and PC copies in sync. Claude Code builds on the PC
  copy and pushes to GitHub; Zach pulls to the Mac for the gate test.
- This job runs AFTER creation solidification and creator round 3.
  Zach placed this job next 2026-11-24; the review block is cleared.
- Place this brief at `docs/pm/class-audit-severe-seven/BRIEF.md` in the
  repo when handing it over.
