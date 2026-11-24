# Brief — Feat addition: the fourteen approved feats (twelve + two WoW feats)

**Status: DRAFT VARIANT — prepared 2026-11-23, not approved for courier, not queued. Use ONLY if Zach picks "fold Silver Tongue + Elegant Maneuver into the feat twelve"; otherwise the twelve-feat draft (`feat-addition-12-BRIEF-DRAFT.md`) stays the handover and this file is discarded. Queue placement is Zach's call.**
**Date:** 2026-11-21 (twelve-feat draft); this fourteen-feat variant prepared 2026-11-23 from the two feats decided 2026-11-22 in `wow-updated-subclasses-comparison-2026-11-22.md`. No other feat text changed.
**Source:** `feat-pdfs-2026-11-20/REPORT.md` (PM research, 2026-11-20) — four feat PDFs Zach supplied, 288 feats read, ~90 net new after de-duping, 12 shortlisted. Decision recorded at the end of that report.
**Decision (Zach, 2026-11-21):** all 12 shortlist feats APPROVED for addition. Energy Affinity is origin. The other 11 are general. Sage Advice and Friend of the Forest are origin-possible — see build step 13 below; that call is still Zach's, not settled here.
**Decision (Zach, 2026-11-22):** Silver Tongue and Elegant Maneuver — the two feats created from the WoW replacement losses — are APPROVED for addition as general feats (feats 13–14 below; build steps 14–15). They were decided after the twelve-feat draft was written and live only in the WoW comparison note until this variant.

## Goal (in play)
Fourteen new feats appear where feats are picked, each doing exactly what its
one-line mechanic says — a tactician who swaps initiative, a tracker who
smells a trail, a slinger whose sling finally hits hard, an origin feat
that gives a resistance and a cantrip, a silver tongue that can charm a
listener with words alone, a duelist who steadies their next leap or
climb. A player who takes one feels it in
play; a player who never takes one loses nothing, because every one of
them is opt-in.

## Background
- The twelve come from four PDFs Zach supplied (Homebrew Feats 2024,
  Fantastic Feats of Forgotten Realms, Book of Revised Feats, DNDBlue
  Feat Collection v2.4). The report de-duped them against the live feat
  registry (`featRegistry.js` — 21 feats + 10 fighting styles in the
  live repo at the time, branch `phase-4-hybrid-combat`), the ancestry
  lists, the Manual of Martial Mastery feats, and the three Fizban's
  Gift feats. None of the twelve duplicates anything already in the
  game. The builder re-verifies that against live bytes — the registry
  has moved since the report was written.
- The Book of Revised Feats carries its own house systems — feat
  tiers, inspiration points, morale dice, conditions that don't exist
  in 2024. None of the twelve uses them, and none of them comes in.
  If any of the twelve's text as extracted leans on one of those
  systems, the builder reports it instead of importing the system.
- The class-feature-grant feats (Bard/Druid/Monk/Paladin Initiate and
  kin) are the riskiest family in these PDFs, because multiclassing
  is free in this game — none of the twelve is one. Do not add any
  of them in this job.
- The 2024 PHB feats still missing from the catalog (Fey Touched,
  Telekinetic, the three armored feats, Fighting Initiate, Gunner,
  Aberrant Dragonmark, Chef, and others listed in the report) are NOT
  in this job. They come from the book, not from these PDFs.
- Slot rules from the project record: an ASI (+1 to a stat) means
  general feat only — never ancestry tier-1, never origin. No ASI
  means origin-candidate if it fits the origin shape, otherwise
  general. Five of the fourteen carry a +1 (Hound +1 Wis, Feather
  Foot +1 Dex, Trapper +1 Wis, Elusive +1 Dex, Silver Tongue +1 Cha);
  all five are general.
- The two added feats are homebrew adaptations, not book feats: Silver
  Tongue adapts Xanathar's Panache (social charm only — the hostile
  taunt is already covered by the WoW Goad Cunning Strike); Elegant
  Maneuver adapts Xanathar's Swashbuckler feature, as written. Both
  carry a homebrew source tag (feats 13–14; build steps 14–15). They do NOT come
  with the post-MVP WoW replacement subclasses — folding them in
  here does not pull any WoW subclass, species, spell, or monster
  into the MVP.
- Granted cantrips never count against known/prepared (Zach,
  2026-11-04). That covers Energy Affinity's cantrip.
- Zach's take, 2026-11-21: take all twelve — cherry-picking saves
  nothing, because the build job is one brief whether it's five
  feats or twelve. The three he would fight for are Tactician,
  Sage Advice, and Friend of the Forest. Trapper's Hunter's Mark
  twice per long rest without a slot is the strongest free-spell
  grant in the twelve — flagged to watch, not a blocker.

## The fourteen (exact mechanics — the builder works from these, not from memory)

1. **Tactician** — general, no ASI. When you roll initiative, roll
   a d4 and add it to your initiative. After rolling initiative but
   before the first turn, you may swap initiative with a willing
   creature, once per combat. Note: this is the same swap mechanic
   as the 2024 Alert feat — the two stack, which is fine.
2. **Sage Advice** — general (origin-possible, see build step 13), no ASI.
   Spend 10 minutes advising: choose a skill or tool you are
   proficient with; up to 6 friendly creatures within 30 ft who can
   hear and understand you each, once within the next hour, may add
   their proficiency bonus to one ability check with the chosen
   skill or tool, if they are not already proficient in it. Uses
   equal to your proficiency bonus; regain on a long rest.
3. **Hound** — general, +1 Wisdom. Advantage on Perception checks
   based on smell. Smell an object worn or used by a creature
   within the last 10 days: +5 to Perception/Survival checks to
   track that creature, until a long rest.
4. **Feather Foot** — general, +1 Dexterity. Prerequisite Dex 13+.
   Use Dexterity instead of Strength for jump distance and height.
   Your footsteps do not trigger non-magical pressure-based traps.
5. **Seismic Touch** — general, no ASI. As an action, touch a solid
   surface and gain 60 ft tremorsense until the start of your next
   turn.
6. **Trapper** — general, +1 Wisdom. You learn Hunter's Mark. You
   can cast it twice per long rest as a 1st-level spell without
   expending a slot; you can also cast it with spell slots, using
   Wisdom as your spellcasting ability. Advantage on Survival
   checks to track or hunt beasts and creatures with Intelligence
   8 or lower. Advantage on checks to skin, extract, and preserve
   precious organs from creatures you have researched or hunted
   for at least 1 week of downtime.
7. **Friend of the Forest** — general (origin-possible, see build step
   13), no ASI. You understand and can speak with beasts. Beasts
   can give you information about nearby locations and monsters,
   including what they perceived within the past day.
8. **Elusive** — general, +1 Dexterity. Prerequisite Dex 13+. You
   and up to 10 companions within 60 ft travel at a normal pace
   while stealthing (at a slow pace, +5 to Stealth instead);
   creatures have disadvantage on Perception/Survival checks to
   track you.
9. **Sling Expert** — general, no ASI. Sling attacks deal +1d4
   damage when the target is within the sling's first range
   increment, +1d4 more if the target is one size larger than you.
   After taking the Attack action with a sling, you can make one
   additional sling attack as a bonus action.
10. **Mountaineer** — general, NO ASI. Climbing speed equals your
    walking speed. Reduce falling damage by your level. Advantage
    on Athletics checks for climbing. (The Book of Revised Feats
    copy says "increase Strength or Constitution by 5" — a typo
    for +1, and the DNDBlue copy has no ASI at all. Take the
    DNDBlue version: no ASI. Do not take the +5 literally, and do
    not add a +1.)
11. **Energy Affinity** — ORIGIN, no ASI. Choose one: Mind —
    psychic resistance + the Mind Sliver cantrip; Soul — radiant
    resistance + the Sacred Flame cantrip; Death — necrotic
    resistance + the Toll the Dead cantrip. The cantrip is granted,
    never counted against known/prepared.
12. **Quick Draw** — general, no ASI. While wielding a ranged or
    thrown weapon, creatures provoke an opportunity attack from you
    when they move within 5 feet of you. Ranged weapons used as
    improvised weapons deal d4 damage and you are proficient with
    them.
13. **Silver Tongue** — general, +1 Charisma. Prerequisite Charisma
    13+. **Ability Score Increase:** +1 Charisma, maximum 20.
    **Winning Words:** as an action, make a Charisma (Persuasion)
    check contested by a creature's Wisdom (Insight) check; the
    creature must be able to hear you and you must share a language;
    if you succeed and the creature isn't hostile to you, it has the
    Charmed condition for 1 minute and regards you as a friendly
    acquaintance; ends immediately if you or your companions do
    anything harmful to it. No usage limit, as written — the fences
    are the action cost, the contest, and harm ending it. (Zach,
    2026-11-22, DECIDED as written; the +1 Cha and the Cha 13+
    prerequisite are part of the decided feat, the charm text is the
    book's verbatim Panache text.)
14. **Elegant Maneuver** — general, no ASI. As a bonus action, gain
    advantage on the next Dexterity (Acrobatics) or Strength
    (Athletics) check you make this turn. Keeps its name — no
    collision, the WoW subclass has no feature by that name.
    (Zach, 2026-11-22, DECIDED as written.)

## What to build
1. **Survey the live repo first, then build.** On the PC, branch
   `phase-4-hybrid-combat`, verify every background point above
   against live bytes, and enumerate how feats live in the game
   today: the feat catalog/registry and where each entry is defined,
   how the creator picker offers feats (general vs origin slots,
   prerequisites, ASI half-feats), how a feat's mechanics reach
   play (registry effects for the DM prompt vs engine-enforced
   mechanics), and how granted spells/cantrips, resistances, and
   per-long-rest uses are tracked. Report the inventory, with file
   and line, before changing anything. Workspace mirrors are
   staging copies, not the repo.
2. **Add all fourteen to the catalog** with the mechanics above,
   each carrying a source tag (which PDF it came from, plus the
   homebrew/book separation the game already uses). Where a feat's
   mechanic already has an engine hook (initiative, damage dice,
   advantage, resistances), wire it to that hook. Where no hook
   exists, the builder states per feat whether it is engine-enforced
   or DM-prompt/registry-enforced, with evidence — a gap stated as
   a gap, never a silent narrative-only effect. Nothing mechanical
   is narrative-only (Zach, 2026-11-08): if a mechanic cannot be
   enforced by anything in the build, the report says so and what
   it would take, instead of dressing it up as working.
3. **The five half-feats** (Hound, Feather Foot, Trapper, Elusive,
   Silver Tongue) follow the existing +1 ASI flow exactly — same
   picker, same cap handling as the half-feats already in the game.
   Silver Tongue's +1 is Charisma, maximum 20. If the survey
   shows no half-feat flow exists, the builder reports that before
   inventing one.
4. **Trapper's Hunter's Mark.** Survey whether Hunter's Mark exists
   in the spell catalog and how free casts (no slot, 2/long rest)
   and slotted casts (Wisdom) interact with the existing spell
   system. The granted spell is learned by the feat, not by class.
   If the spell is absent from the catalog, add it as part of this
   job and say so in the report.
5. **Energy Affinity's cantrips.** Survey whether Mind Sliver,
   Sacred Flame, and Toll the Dead exist in the cantrip catalog.
   Add any that are missing as granted cantrips for this feat only,
   never counted against known/prepared. The resistance is the
   chosen one only — picking Mind does not grant the other two.
6. **Prerequisites enforced.** Elusive and Feather Foot require Dex
   13+; Silver Tongue requires Cha 13+; enforce each where
   prerequisites are enforced today. If the survey shows
   prerequisites are not enforced anywhere, the report says so and
   the picker still shows the requirement.
7. **Initiative, stealth pace, tremorsense, tracking.** Tactician's
   d4 and swap, Elusive's stealth pace and tracking disadvantage,
   Seismic Touch's tremorsense, Hound's +5 tracking — wire each to
   the system that owns it (initiative service, travel/stealth,
   senses, tracking checks). Where the game has no such system
   (e.g. no travel-pace model, no tremorsense), the builder reports
   the gap per feat with what exists instead — it does not invent
   a new travel or senses system inside this job.
8. **Friend of the Forest's beast information.** Beasts as
   information sources fit the knowledge/lore game and the AI DM —
   wire it as a DM-prompt/knowledge instruction in the same way
   the game's other information-source mechanics are wired, and
   state which one in the report.
9. **Sling Expert's size comparison.** The +1d4-against-larger
   clause needs creature size; survey how size is stored and use
   it. If size is not stored for the target, report that instead
   of guessing.
10. **Quick Draw's opportunity attack.** Survey the opportunity-
    attack path and wire the within-5-ft trigger to it. The
    improvised-weapon d4 + proficiency is a weapon rule, not a
    separate feat effect — implement it where improvised weapons
    are resolved.
11. **Tests that model every branch.** Each feat: pickable in the
    right slot, prerequisite enforced where stated, ASI applied
    once and only for the five half-feats, per-long-rest uses
    counted and reset, granted spell/cantrip present and not
    counted against known/prepared, damage dice correct (Sling
    Expert's two +1d4 clauses separately), initiative d4 + swap
    once per combat, tremorsense duration ends at the start of
    the next turn, Silver Tongue's charm applies for 1 minute and
    ends on harm (and does not apply to a hostile creature),
    Elegant Maneuver's advantage applies to the next Acrobatics
    or Athletics check this turn and then ends. Full `npm test`
    green on the builder's run.
12. **Prove it at :5173 (never :3000).** Creator picker shows all
    fourteen in the right slots; pick one and confirm its effect
    shows in play or in the character record, per the report's
    per-feat verification steps.
13. **Sage Advice and Friend of the Forest — origin question.**
    Build both as GENERAL feats. In the report, state exactly
    what would change to also offer each as an origin feat
    (picker, slot rules, theme fit), so Zach can make the
    origin call at the gate without a rebuild. Do not settle it
    in this job: a proposal is a proposal, never a resolution
    (Zach, 2026-11-19).
14. **Silver Tongue's Winning Words.** Wire the contested check
    (Charisma (Persuasion) vs the creature's Wisdom (Insight)) to
    the check system that owns contested checks, and the Charmed
    condition (1 minute, ends immediately on any harmful act by
    the player or a companion, does not apply to a hostile
    creature) to the condition system. The creature must be able
    to hear the player and share a language — survey how hearing
    and shared language are represented, if at all, and report
    the gap per the survey instead of inventing a language model
    in this job. No usage limit: no per-rest counter. State in
    the report how Winning Words interacts with R-29 (Influence
    DC 10 + CR): the feat is a locked-in mechanic, not DM
    judgment — the contested check replaces the Influence DC for
    this charm, it does not stack with it.
15. **Elegant Maneuver.** Wire the bonus-action advantage to the
    next Dexterity (Acrobatics) or Strength (Athletics) check
    this turn, on the same path the game uses for advantage on a
    check. The advantage ends after that one check whether it
    succeeds or fails, and does not carry past the turn. If no
    such advantage path exists, the builder reports the gap
    instead of inventing one.

## Out of scope
- Any feat beyond these fourteen — including the honourable mentions
  (Arcane Discipline Savant, Diplomat, Dragon Breath, Fey
  Teleportation, Grudge-Bearer, Beguiler) and the five near-misses.
  Those are a separate decision, not this job.
- The 2024 PHB feats still missing from the catalog (Fey Touched,
  Telekinetic, the armored feats, Fighting Initiate, Gunner,
  Aberrant Dragonmark, Chef, and the rest) — they come from the
  book, not this job.
- Any Book of Revised Feats house system (feat tiers, inspiration
  points, morale dice, non-2024 conditions). None of the twelve
  uses them; none comes in.
- Any class-feature-grant feat. None of the twelve is one.
- Ancestry lists: none of these feats goes into a species list.
- H2+H3, H1, creator round 3, MVP-only UI, tooltip rewrite,
  severe-seven, M1, reactions, return-loop, L1–L6, or any other
  queued job.
- Any migration unless the survey proves a column is missing and
  the report states why — the builder stops and reports instead
  of inventing schema.

## Acceptance criteria
- All fourteen are pickable in the creator in the right slots:
  Energy Affinity as origin, the other thirteen as general.
- Each feat's mechanic works as written in the fourteen above, on
  the path the survey assigned it — engine-enforced where a hook
  exists, registry/DM-prompt-enforced where that is the game's
  existing route, and reported as a gap where neither exists.
- Mountaineer grants NO ASI. The +5 typo is nowhere in the build.
- No feat tiers, inspiration points, morale dice, or non-2024
  conditions enter the build with this job.
- Trapper's Hunter's Mark casts 2/long rest free, and with slots
  (Wisdom) beyond that; the granted cantrips from Energy Affinity
  never count against known/prepared.
- Full `npm test` green on the builder's run; new/updated suites
  cover each feat above.
- Silver Tongue grants +1 Charisma (max 20) once, requires Cha 13+,
  and Winning Words charms a non-hostile creature that can hear
  and understands the player for 1 minute, ending on harm, with
  no usage limit. Elegant Maneuver grants advantage on the next
  Acrobatics or Athletics check this turn as a bonus action.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  and iterate until green. Zach's full run is the gate — never
  claim it.
- At :5173 (never :3000): the creator picker shows the fourteen in
  the right slots; pick at least one per mechanic family and
  confirm the effect per the report's steps.

## Decisions already made
- All twelve feats approved for addition (Zach, 2026-11-21).
  Energy Affinity is origin; the other eleven are general.
- Silver Tongue and Elegant Maneuver approved for addition as
  general feats (Zach, 2026-11-22, DECIDED as written). Silver
  Tongue: +1 Cha (max 20), Cha 13+, Winning Words as written, no
  usage limit. Elegant Maneuver: bonus action, advantage on the
  next Dex (Acrobatics) or Str (Athletics) check this turn.
  Both are homebrew adaptations (Xanathar's Panache /
  Swashbuckler); the WoW subclasses themselves stay post-MVP.
- Sage Advice and Friend of the Forest origin-possible — NOT
  settled; built as general, origin route stated in the report
  for Zach's call (see build step 13).
- Mountaineer has no ASI — DNDBlue version, not the Book of
  Revised Feats "+5" typo (report, §10 and the unreadable-items
  list).
- Trapper's Hunter's Mark 2/long rest free is the strongest
  free-spell grant in the twelve — flagged to watch, not a
  blocker (Zach, 2026-11-21).
- Granted cantrips never count against known/prepared (Zach,
  2026-11-04).
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a
  sibling gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.
- The 2024 book wins on conflict.

## Report
- §3 format from `claude-code-handoff.md`, plus per-feat verdicts
  for the fourteen (built / already-present / still-open with
  evidence), the feat-system inventory from the survey (file +
  line for the catalog, picker, ASI flow, granted-spell/cantrip
  handling, per-long-rest tracking), and per-feat enforcement
  route (engine hook vs registry/DM prompt vs gap).
- The Sage Advice / Friend of the Forest origin route: exactly
  what would change to offer each as origin, in full plain terms.
- Any question for Zach in full plain terms, one per item, with
  what was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never
  :3000).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief
  to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test` +
  :5173 checks on the PC.
- Place this brief at `docs/pm/feat-addition-14/BRIEF.md`
  in the repo when handing it over. Reports live in
  `docs/pm/reports/`.
