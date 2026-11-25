# Brief — repo-check-fixes-tools: the tools say what the book says

## Goal (in play)
A player who opens a tool's description reads what the tool actually does in
the 2024 book — the action the tool performs and what it can craft — instead
of invented flavor. A calligrapher learns their flourishes guard *against*
forgery; a dice player learns the set helps them *catch* a cheater, not cheat.
And the game finally stores each tool's ability and difficulty, so the engine
can resolve a tool use instead of only describing it.

## Background
- Read-only repo check against the 2024 PHB, run 2026-11-24 at Zach's
  direction ("Check it all"). Report:
  `~/workspace/dnd-app-review/repo-checks-2026-11-24-REPORT.md`, §1.
  Book source: Zach's photos of PHB pp. 220–221, transcribed verbatim
  (`~/workspace/dnd-app-review/phb-equipment-pp220-229-transcription-2026-11-24.md`).
  The photo-read is authoritative.
- The check compared the `TOOLS` object in
  `client/src/data/references.js` (TOOLS object ~lines 92–150 on the
  `phase-4-hybrid-combat` branch, as read 2026-11-24 — **confirm the live
  line numbers on the PC copy before editing; if they have drifted, stop
  and report the drift, do not guess**) against the book's Tools entries.
- Findings: **17 of 37 entries mismatch the book (11 major, 6 minor).
  0 missing, 0 extra.** The entries are one-sentence flavor strings
  written from the tool names, not the book. The recurring invented
  pattern — "Also useful for identifying/spotting X" — appears in 11
  entries and in the book in zero of them. Two entries are direct
  inversions of the book.
- The same check found the repo stores **no Ability or DC data at all**
  for any tool. The book gives an Ability and a DC for every tool's
  Utilize action; none of that exists in `references.js`.
- Zach directed 2026-11-24 that all four checked sections be fixed in
  the engine. This brief is the tools section.

## What to build

**0. Confirm the live entries first.** Read the live `TOOLS` object in
`client/src/data/references.js` on the PC copy. Confirm the 17 entries
below still carry the repo text quoted in this brief. If any entry has
already changed, report it and do not build on a stale quote. Do not
widen scope to entries the check did not list.

**1. Rewrite the 17 mismatched descriptions**, one sentence each,
grounded in the book's Utilize + Craft lines quoted below. The sentence
must state what the tool's Utilize action does and what it can craft,
and must drop every invented clause named in the "What's wrong" note.
Do not invent anything the book does not say. Book wording below is
quoted from the transcription; use it, not memory.

**2. Add the book's Ability and DC data to all 37 entries**, as
structured fields following the file's existing entry conventions
(confirmed live — if entries are bare strings, convert them to
structured entries and report the shape). Several tools have two
Utilize options with different DCs; store both, keyed to the action,
not a single number. The Ability and DCs for the 17 rewritten tools are given below; the Ability and DCs for the 20 matching entries are in the table after them — their text stays untouched, only the structured fields are added.

### The 17 entries (book text quoted from PHB pp. 220–221)

**1. Alchemist's Supplies** (repo line ~94)
- Repo now: *"Brewing potions and identifying alchemical substances."*
- What's wrong: the book's craft list has no potion (Potion of Healing
  is Herbalism Kit); "start a fire" omitted.
- Book — Ability: Intelligence. Utilize: Identify a substance (DC 15),
  or start a fire (DC 15). Craft: Acid, Alchemist's Fire, Component
  Pouch, Oil, Paper, Perfume.
- Store: ability Intelligence; DCs 15 (identify a substance), 15
  (start a fire).

**2. Brewer's Supplies**
- Repo now: adds "sanitizing water" (invented).
- Book — Ability: Intelligence. Utilize: Detect poisoned drink (DC 15),
  or identify alcohol (DC 10). Craft: Antitoxin.
- Store: ability Intelligence; DCs 15 (detect poisoned drink), 10
  (identify alcohol).

**3. Calligrapher's Supplies** (repo line ~96) — direct inversion
- Repo now: *"Useful for forging signatures or recognizing a scribe's
  hand."*
- What's wrong: the book's flourish guards *against* forgery; the repo
  says the tool is useful *for* forging.
- Book — Ability: Dexterity. Utilize: Write text with impressive
  flourishes that guard against forgery (DC 15). Craft: Ink, Spell
  Scroll.
- Store: ability Dexterity; DC 15 (flourishes that guard against
  forgery).

**4. Carpenter's Tools**
- Repo now: *"Shaping wood — building structures, furniture, doors, and
  traps. Also useful for identifying weak spots in wooden
  construction."*
- What's wrong: no structures/furniture/traps in the book; real Utilize
  omitted.
- Book — Ability: Strength. Utilize: Seal or pry open a door or
  container (DC 20). Craft: Club, Greatclub, Quarterstaff, Barrel,
  Chest, Ladder, Pole, Portable Ram, Torch.
- Store: ability Strength; DC 20 (seal or pry open a door or
  container).

**5. Cartographer's Tools**
- Repo now: adds scale estimation and land navigation (invented).
- Book — Ability: Wisdom. Utilize: Draft a map of a small area (DC 15).
  Craft: Map.
- Store: ability Wisdom; DC 15 (draft a map of a small area).

**6. Cobbler's Tools** (repo line ~99)
- Repo now: *"Crafting and repairing footwear… spotting worn shoe
  patterns."*
- What's wrong: the book crafts Climber's Kit only — no footwear
  crafting.
- Book — Ability: Dexterity. Utilize: Modify footwear to give Advantage
  on the wearer's next Dexterity (Acrobatics) check (DC 10). Craft:
  Climber's Kit.
- Store: ability Dexterity; DC 10 (modify footwear).

**7. Glassblower's Tools**
- Repo now: *"Also useful for identifying glass quality, origin, and
  craftsmanship."*
- What's wrong: the book's Utilize is discerning what a glass object
  *held*, not identifying quality/origin.
- Book — Ability: Intelligence. Utilize: Discern what a glass object
  held in the past 24 hours (DC 15). Craft: Glass Bottle, Magnifying
  Glass, Spyglass, Vial.
- Store: ability Intelligence; DC 15 (discern what a glass object
  held).

**8. Jeweler's Tools**
- Repo now: *"Appraising gems, cutting stones, setting jewelry. Useful
  for spotting fakes and valuing treasure."*
- What's wrong: no gem-cutting or jewelry-setting in the book;
  "spotting fakes" invented.
- Book — Ability: Intelligence. Utilize: Discern a gem's value (DC 15).
  Craft: Arcane Focus, Holy Symbol.
- Store: ability Intelligence; DC 15 (discern a gem's value).

**9. Leatherworker's Tools**
- Repo now: *"Treating hides, making armor, saddles, belts, and
  bindings. Useful for identifying leather origin."*
- What's wrong: saddles, belts, bindings not in the book's craft list.
- Book — Ability: Dexterity. Utilize: Add a design to a leather item
  (DC 10). Craft: Sling, Whip, Hide Armor, Leather Armor, Studded
  Leather Armor, Backpack, Crossbow Bolt Case, Map or Scroll Case,
  Parchment, Pouch, Quiver, Waterskin.
- Store: ability Dexterity; DC 10 (add a design to a leather item).

**10. Mason's Tools**
- Repo now: *"Working stone — building walls, identifying construction
  techniques, spotting weak points in stonework."*
- What's wrong: walls, techniques, weak points all invented; real
  Utilize omitted.
- Book — Ability: Strength. Utilize: Chisel a symbol or hole in stone
  (DC 10). Craft: Block and Tackle.
- Store: ability Strength; DC 10 (chisel a symbol or hole in stone).

**11. Painter's Supplies**
- Repo now: adds identifying an artist's hand, copying visual details,
  art-culture blending (invented).
- Book — Ability: Wisdom. Utilize: Paint a recognizable image of
  something you've seen (DC 10). Craft: Druidic Focus, Holy Symbol.
- Store: ability Wisdom; DC 10 (paint a recognizable image).

**12. Potter's Tools**
- Repo now: *"Useful for identifying pottery origins, periods, and
  cultural markers."*
- What's wrong: the book's Utilize is discerning what a ceramic object
  *held*, not identifying origins.
- Book — Ability: Intelligence. Utilize: Discern what a ceramic object
  held in the past 24 hours (DC 15). Craft: Jug, Lamp.
- Store: ability Intelligence; DC 15 (discern what a ceramic object
  held).

**13. Smith's Tools**
- Repo now: *"Forging and repairing metal weapons and armor. Useful for
  identifying metallurgy and armor strength."*
- What's wrong: the Utilize is prying, not identifying.
- Book — Ability: Strength. Utilize: Pry open a door or container
  (DC 20). Craft: Any Melee weapon (except Club, Greatclub,
  Quarterstaff, and Whip), Medium armor (except Hide), Heavy armor,
  Ball Bearings, Bucket, Caltrops, Chain, Crowbar, Firearm Bullets,
  Grappling Hook, Iron Pot, Iron Spikes, Sling Bullets.
- Store: ability Strength; DC 20 (pry open a door or container).

**14. Tinker's Tools**
- Repo now: adds "repairing and modifying", "clockwork, constructs"
  (invented).
- Book — Ability: Dexterity. Utilize: Assemble a Tiny item composed of
  scrap, which falls apart in 1 minute (DC 20). Craft: Musket, Pistol,
  Bell, Bullseye Lantern, Flask, Hooded Lantern, Hunting Trap, Lock,
  Manacles, Mirror, Shovel, Signal Whistle, Tinderbox.
- Store: ability Dexterity; DC 20 (assemble a Tiny item of scrap).
  The 1-minute falling-apart limit belongs in the description.

**15. Weaver's Tools**
- Repo now: adds "identifying fabric origin and quality" (invented).
- Book — Ability: Dexterity. Utilize: Mend a tear in clothing (DC 10),
  or sew a Tiny design (DC 10). Craft: Padded Armor, Basket, Bedroll,
  Blanket, Fine Clothes, Net, Robe, Rope, Sack, String, Tent,
  Traveler's Clothes.
- Store: ability Dexterity; DCs 10 (mend a tear), 10 (sew a Tiny
  design).

**16. Woodcarver's Tools**
- Repo now: adds figurines, puzzle boxes, replacement bow shafts
  (invented).
- Book — Ability: Dexterity. Utilize: Carve a pattern in wood (DC 10).
  Craft: Club, Greatclub, Quarterstaff, Ranged weapons (except Pistol,
  Musket, and Sling), Arcane Focus, Arrows, Bolts, Druidic Focus, Ink
  Pen, Needles.
- Store: ability Dexterity; DC 10 (carve a pattern in wood).

**17. Dice Set** (repo line ~113) — direct inversion
- Repo now: *"Gaming sets grant proficiency on games involving them and
  let you cheat by hand."*
- What's wrong: the book lets you *catch* a cheater; the repo says the
  set lets *you* cheat.
- Book (Gaming Set entry, which covers all four variants) — Ability:
  Wisdom. Utilize: Discern whether someone is cheating (DC 10), or win
  the game (DC 20). Variants: Dice (1 SP), dragonchess (1 GP), playing
  cards (5 SP), three-dragon ante (1 GP).
- Store: ability Wisdom; DCs 10 (discern whether someone is cheating),
  20 (win the game).
- Note: only the Dice Set's text is wrong. The Dragonchess Set,
  Playing Card Set, and Three-Dragon Ante Set entries matched the book
  and are out of scope — do not touch their text.

### Ability/DC for the 20 matching entries (text untouched — fields only)

These 20 matched the book, so their description text does not change. Each still gets the book's Ability and DC data as structured fields, so the catalog ends up uniformly structured instead of half-done. Book wording below is quoted from the transcription (PHB pp. 220–221); use it, not memory.

- **Cook's Utensils** — Store: ability Wisdom; DCs 10 (improve food's flavor), 15 (detect spoiled or poisoned food).
- **Disguise Kit** — Store: ability Charisma; DC 10 (apply makeup).
- **Forgery Kit** — Store: ability Dexterity; DCs 15 (mimic 10 or fewer words of someone else's handwriting), 20 (duplicate a wax seal).
- **Dragonchess Set / Playing Card Set / Three-Dragon Ante Set** — Store: ability Wisdom; DCs 10 (discern whether someone is cheating), 20 (win the game). (One book entry, Gaming Set, covers all three variants.)
- **Herbalism Kit** — Store: ability Intelligence; DC 10 (identify a plant).
- **Musical Instrument (all 10 variants)** — Store: ability Charisma; DCs 10 (play a known tune), 15 (improvise a song). (One book entry covers all ten instruments.)
- **Navigator's Tools** — Store: ability Wisdom; DCs 10 (plot a course), 15 (determine position by stargazing).
- **Poisoner's Kit** — Store: ability Intelligence; DC 10 (detect a poisoned object).
- **Thieves' Tools** — Store: ability Dexterity; DCs 15 (pick a lock), 15 (disarm a trap).

## Out of scope
- The 20 matching entries listed above: their description text stays untouched in this job — only the Ability/DC fields are added (see the table above).
- Thieves' Tools carries an extra unsourced mechanics claim
  ("Required proficiency for most locks") — observed, not contradicted
  by the book, not fixed here.
- Any engine behavior that *uses* the new Ability/DC data (checks,
  crafting resolution, DC prompts). This job stores the data; using it
  is a later job.
- The other three repo-check fix jobs (alignment/lifestyle, feats,
  spells) — separate briefs, separate gates.

## Acceptance criteria
- All 17 descriptions read as one sentence grounded in the book's
  Utilize + Craft lines above: no "identifying/spotting X" secondary
  function survives in any of them, no invented craft item survives,
  and the two inversions (Calligrapher's, Dice Set) now state the
  book's direction.
- Each of the 37 entries carries structured Ability + DC data matching the tables above, with both DCs where the book gives two.
- The 20 matching entries' description text is byte-identical to before this job (only structured Ability/DC fields added).
- Full `npm test` green on the builder's run; new/updated suites cover all 37 entries (description content for the 17 + stored Ability/DC against the tables in this brief).

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  (`E:\DnD Meta Game\dnd-meta-game`) and iterate until green. Zach's
  full run is the gate — never claim it.
- Re-check: for each of the 37, the report lists the live description (17 rebuilt) and the stored Ability/DCs next to the book lines in this brief, so the PM can verify without opening the repo.

## Decisions already made
- The 2024 book wins on conflict (Zach's rules hierarchy).
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling gets
  fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.
- Zach directed 2026-11-24 that all four checked sections be fixed in
  the engine.
- The 20 matching entries' text stays untouched in this job; only their Ability/DC fields are added (PM scope call 2026-11-24: the catalog must end up uniformly structured, not half-done).

## Report
- §3 format from `claude-code-handoff.md`, plus a per-item verdict
  table for all 37 tools (17 rebuilt / 20 already-correct, fields added /
  still-open with evidence), with the live description and stored Ability/DCs quoted
  next to the book lines.
- The structured-field shape chosen (field names, where the two-DC
  tools store their second DC), for the PM's veto at the gate.
- Confirmation that all 37 entries now carry Ability/DC data.
- Any question for Zach in full plain terms, one per item, with what
  was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never
  :3000).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief to
  Claude Code and carries the report back to Muse.
- Repo sync CONFIRMED 2026-11-10: the project lives on GitHub; Zach
  keeps the Mac and PC copies in sync. Claude Code builds on the PC
  copy and pushes to GitHub; Zach pulls to the Mac for the gate test.
- This job is one of four sibling briefs from the 2026-11-24 repo
  check (tools, alignment/lifestyle, feats, spells). They touch
  different files; Zach places them in order, one job at a time, one
  serial gate each.
- Place this brief at `docs/pm/repo-check-fixes-tools/BRIEF.md` in the
  repo when handing it over.
