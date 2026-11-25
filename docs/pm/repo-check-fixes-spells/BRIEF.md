# Brief — repo-check-fixes-spells: the spell catalog matches the book

## Goal (in play)
A player reading a spell sees the book's spell: the right school, the
right classes, the right range, the right duration, the right save —
and when they cast it, the engine rolls the book's dice. A paladin
finds Blinding Smite on their list instead of only the homebrew
Blackguard's; a druid finds Tsunami at all; and a spell that needs 300
GP of diamonds can no longer be cast by a character who doesn't have
them.

## Background
- Read-only repo check against the 2024 PHB, run 2026-11-24 at Zach's
  direction ("Check it all"). Report:
  `~/workspace/dnd-app-review/repo-checks-2026-11-24-REPORT.md`, §4.
  Book source: Zach's photos of PHB Ch. 7, pp. 235–343, transcribed
  verbatim (six files in `~/workspace/dnd-app-review/`,
  `phb-2024-spells-pp235-253` through `pp334-343`). The photo-read is
  authoritative. The book wording quoted in this brief is copied from
  those transcriptions.
- The check compared the live catalog
  `server/data/spellCatalogData.js` — `SPELL_DATA_ENTRIES`, 583
  entries, one line per spell, lowercase keys — plus its second table
  `SPELL_DATA_EFFECTS` (236 entries, the damage/healing dice the
  engine resolves) against the book's 391 spells. Line numbers below
  are from the 2026-11-24 read on the `phase-4-hybrid-combat` branch
  (e.g. `"banishing smite"` at line 56, its EFFECTS entry at line
  620) — **confirm the live lines on the PC copy before editing; if
  they have drifted, stop and report the drift, do not guess**.
- Findings: levels are clean (0 errors) and only 1 spell is missing —
  the closest of the four checked sections — but a long tail of wrong
  fields: 7 source-tag errors, 13 school errors, 23 spells missing a
  book class, 12 spells adding a class, 5 casting-time, 9 range, 5
  components, 11 duration/concentration, 1 ritual flag, 11 save
  errors + 3 partial, 5 damage-dice errors + 2 partial, 10
  description-dice gaps + 3 partial. Material components are not
  stored at all.
- The client mirror `client/src/data/spellCatalog.generated.json` is
  generated from the server file by
  `scripts/generate-spell-catalog.js` and was verified 583/583, 0
  mismatches — a faithful mirror, so every error below propagates
  identically to the creator and the `/api/spells` endpoint.
- The legacy client catalogs still carry 2014 text and disagree with
  the live catalog (see item 11).
- Zach directed 2026-11-24 that all four checked sections be fixed in
  the engine. This brief is the spells section.

## What to build

**0. Confirm the live catalog first.** Read the live
`spellCatalogData.js` on the PC copy. Confirm the entries this brief
touches still carry the values the check quoted (the report §4 gives
the live values per item). If any entry has already changed, report it
and do not build on a stale quote. Do not widen scope to spells the
check did not list. The catalog's descriptions are fresh-worded by
design (no verbatim book prose) — this job corrects **mechanics**
(dice, saves, targets, upcast), not wording, except where a
description misstates a number (items 7–8).

**1. Add the one missing spell — Tsunami.** Book text (PHB p. 341,
from the transcription):
- *Level 8 Conjuration (Druid)*. Casting Time: 1 minute. Range: 1
  mile. Components: V, S. Duration: Concentration, up to 6 rounds.
- "A wall of water springs into existence at a point you choose within
  range. You can make the wall up to 300 feet long, 300 feet high, and
  50 feet thick. The wall lasts for the duration. When the wall
  appears, each creature in its area makes a Strength saving throw,
  taking 6d10 Bludgeoning damage on a failed save or half as much
  damage on a successful one. At the start of each of your turns after
  the wall appears, the wall, along with any creatures in it, moves 50
  feet away from you. Any Huge or smaller creature inside the wall or
  whose space the wall enters when it moves must succeed on a Strength
  saving throw or take 5d10 Bludgeoning damage. A creature can take
  this damage only once per round. At the end of the turn, the wall's
  height is reduced by 50 feet, and the damage the wall deals in later
  rounds is reduced by 1d10. When the wall reaches 0 feet in height,
  the spell ends. A creature caught in the wall can move by swimming.
  Because of the wave's force, though, the creature must succeed on a
  Strength (Athletics) check against your spell save DC to move at
  all. If it fails the check, it can't move. A creature that moves out
  of the wall falls to the ground."
- Add the entry to `SPELL_DATA_ENTRIES` (level 8, Conjuration, Druid,
  castTime "1 minute", range "1 mile", components ["V","S"],
  duration "Concentration, up to 6 rounds", concentration true, save
  "str") and an EFFECTS entry carrying the book's dice (initial 6d10
  Bludgeoning, save for half; later rounds 5d10, reduced by 1d10 per
  round), following the existing EFFECTS conventions for multi-round
  damage, and report the shape chosen.
- Expected count after this job: **584** entries in
  `SPELL_DATA_ENTRIES` (583 + Tsunami).

**2. Fix the 7 source-tag errors.**
- These five book spells are tagged as expansions; retag them
  `source: "PHB 2024"`: **Blinding Smite** (now "Libris Mortis"),
  **Steel Wind Strike** (now Xanathar), **Summon Celestial** (now
  Tasha), **Summon Fiend** (now Tasha), **Vitriolic Sphere** (now
  Xanathar).
- These two spells are NOT in the 2024 PHB and are wrongly tagged
  `"PHB 2024"`; retag them to their real source: **Pyrotechnics**
  (Xanathar's), **Summon Shadowspawn** (Tasha's). Do not remove them
  — they are legitimate expansion spells; only the tag is wrong.
- Reconciliation to verify in the report: 387 tagged PHB 2024 − 2
  wrong = 385; 391 book spells − 5 mistagged − 1 missing = 385.

**3. Fix the 13 school errors.** Book school → catalog's current
(wrong) school; set the book's:
- Banishing Smite: Conjuration (catalog: Abjuration)
- Conjure Volley: Conjuration (catalog: Evocation)
- Earthquake: Transmutation (catalog: Evocation)
- Etherealness: Conjuration (catalog: Transmutation)
- Glibness: Enchantment (catalog: Transmutation)
- Goodberry: Conjuration (catalog: Transmutation)
- Hallow: Abjuration (catalog: Evocation)
- Heal: Abjuration (catalog: Conjuration)
- Otiluke's Resilient Sphere: Abjuration (catalog: Evocation)
- Power Word Heal: Enchantment (catalog: Evocation)
- Reincarnate: Necromancy (catalog: Transmutation)
- Staggering Smite: Enchantment (catalog: Evocation)
- Stoneskin: Transmutation (catalog: Abjuration)
- All other 377 present spells match — do not touch their schools.
  Most of these are 2014-school holdovers.

**4. Fix the class lists — 23 spells missing a book class, 12 spells
adding a class.** Restore the book's class list in each case. The
homebrew-class additions (Artificer, Blackguard, Spellshot on 151 PHB
spells) are deliberate and stay — except where a book class was
dropped, which is exactly what this item fixes (the homebrew class
stays alongside the restored book class).
- **Add the missing book class(es)** (26 class-slots across 23
  spells):
  - Bard: Antipathy/Sympathy, Eyebite, Prismatic Wall, Slow.
    (Prismatic Wall is `*Level 9 Abjuration (Bard, Wizard)*`; the
    catalog lists Wizard only.)
  - Paladin: **Blinding Smite** — book `*Level 3 Evocation
    (Paladin)*`; catalog lists `["Blackguard"]` only. The Paladin
    class was *replaced* by the homebrew Blackguard, not supplemented.
    Restore Paladin and keep Blackguard.
  - Warlock: Cloud of Daggers, Gate, Teleportation Circle, Thunderclap.
  - Druid: Cone of Cold, Elemental Weapon, Fire Shield, Flesh to
    Stone, Incendiary Cloud, Symbol.
  - Sorcerer: Demiplane, Flame Blade, Flesh to Stone, Grease, Magic
    Weapon, Message, Sunbeam, True Seeing, Vampiric Touch.
  - **Sunbeam** is the worst: book `*Level 6 Evocation (Cleric,
    Druid, Sorcerer, Wizard)*`; catalog lists `["Druid"]` only. Add
    Cleric, Sorcerer, and Wizard.
- **Remove the added class(es)** the book does not list (12 spells):
  Dragon's Breath −Druid; Dream −Druid; Feign Death −Sorcerer;
  Freedom of Movement −Paladin; Globe of Invulnerability −Bard,
  −Warlock; Greater Invisibility −Warlock; Magic Jar −Sorcerer,
  −Warlock (book is Wizard-only: `Level 6 Necromancy (Wizard)`);
  Mislead −Sorcerer; Prismatic Spray −Warlock; Remove Curse −Bard;
  True Seeing −Druid, −Ranger; Wall of Ice −Sorcerer (book
  Wizard-only).
- In both directions, keep any homebrew-class addition (Artificer,
  Blackguard, Spellshot) already on the entry.

**5. Fix casting time (5), range (9), components (5), duration (11),
ritual (1).** Book value → catalog's current (wrong) value; set the
book's. Where a duration changes, the `concentration` flag must match
it.
- **Casting time:** Drawmij's Instant Summons — "1 minute or Ritual"
  (catalog `"1 action"`; ritual flag already correct); Fabricate —
  "10 minutes" (catalog `"1 action"`); Foresight — "1 minute"
  (catalog `"1 action"`); Plant Growth — "Action (Overgrowth) or 8
  hours (Enrichment)" (catalog `"1 action"`; the description mentions
  the 8-hour mode, the field is wrong — store both modes following
  the catalog's conventions for multi-mode spells and report the
  shape); Regenerate — "1 minute" (catalog `"1 action"`).
- **Range:** Astral Projection — "10 feet" (catalog `"Touch"`);
  Banishment — "30 feet" (catalog `"60 feet"`); Confusion — "90 feet"
  (catalog `"120 feet"`); Cordon of Arrows — "Touch" (catalog
  `"5 feet"`); Dimension Door — "500 feet" (catalog `"Self"`); Mind
  Spike — "120 feet" (catalog `"60 feet"`); Storm of Vengeance —
  "1 mile" (catalog `"Sight"`); Telepathy — "Unlimited" (catalog
  `"Self"`); Witch Bolt — "60 feet" (catalog `"30 feet"`).
- **Components (letters only):** Aura of Purity — `V` (catalog
  `["V","M"]`); Commune with Nature — `V, S` (catalog `["V","S","M"]`);
  Conjure Woodland Beings — `V, S` (catalog `["V","S","M"]`);
  Resistance — `V, S` (catalog `["V","S","M"]`); Swift Quiver —
  `V, S, M (a quiver worth 1+ GP)` (catalog `["V"]` — the material
  letter was dropped entirely; see also item 9).
- **Duration / concentration:** Animal Shapes — "24 hours",
  concentration false (catalog `"Concentration, up to 24 hours"` —
  the book body never mentions concentration); Banishing Smite —
  "Concentration, up to 1 minute", concentration true (catalog
  `"Instantaneous"`); Blinding Smite — "1 minute", concentration
  false (catalog `"Concentration, up to 1 minute"`); Forcecage —
  "Concentration, up to 1 hour", concentration true (catalog
  `"1 hour"`, `concentration: false`); Goodberry — "24 hours",
  concentration false (catalog `"Instantaneous"` — the catalog's own
  description says the berries are "fresh for 24 hours"); Hallow —
  "Until dispelled" (catalog `"24 hours"`); Searing Smite — "1
  minute", concentration false (catalog `"Concentration, up to 1
  minute"`); Staggering Smite — "Instantaneous", concentration false
  (catalog `"1 minute"`); Teleportation Circle — "1 round" (catalog
  `"Instantaneous"`); Transport via Plants — "1 minute" (catalog
  `"1 round"`); Wrathful Smite — "1 minute", concentration false
  (catalog `"Instantaneous"`).
- **Ritual:** Illusory Script — book "1 minute or Ritual"; set
  `ritual: true` (catalog `ritual: false`).

**6. Fix the saves — 11 confirmed errors, 3 partial.**
- **Add a save where the book imposes one and the catalog has none:**
  Animal Messenger (Charisma save); Control Water — whirlpool
  (Strength save; on a failed save the creature takes 2d8 Bludgeoning
  damage); Mordenkainen's Faithful Hound (Dexterity save or 4d8 Force
  damage — the catalog description instead says a melee spell attack
  for 4d8 *piercing*; fix the description's damage type and mechanism
  too); Wind Wall (Strength save, 4d8 Bludgeoning damage — the catalog
  description omits the damage entirely; add it).
- **Conditional saves — do not flatten them into unconditional ones:**
  Forcecage (Charisma save, only if the creature tries to use
  teleportation or interplanar travel to leave) and Magic Circle
  (same conditional Charisma save). Record the condition in the
  description and, if the save field can model a condition, model it
  there; otherwise leave the save field empty, carry the condition in
  the description, and report the choice. An unconditional save field
  on these two would be a new error.
- **Correct the wrong / invented saves:** Evard's Black Tentacles —
  book Strength save, catalog `"dex"` (fix the field and the
  description, which also says Dexterity); Hallow — the book has no
  save anywhere; remove catalog `"save": "cha"` and the description's
  "resisted by a Charisma save" (invented); Maze — the book has no
  save (escape is a DC 20 Intelligence (Investigation) *check*);
  remove catalog `"save": "int"` (the catalog's own description says
  "with no save to resist", contradicting its save field); Plane
  Shift — the 2024 book has no save and no offensive use ("You and up
  to eight willing creatures… are transported"); remove catalog
  `"save": "cha"` and the description importing the 2014 offensive
  banish; Ray of Sickness — book: "On a hit, the target takes 2d8
  Poison damage and has the Poisoned condition" (automatic, no save);
  remove catalog `"save": "con"`.
- **Partial — the catalog records one real save and misses another:**
  Bigby's Hand — catalog Dex (Grasping Hand) only; add the Forceful
  Hand Strength save. Prismatic Wall — catalog Dex (layers) only; add
  the proximity Constitution save ("must succeed on a Constitution
  saving throw or have the Blinded condition"). Symbol — catalog Wis
  only; add Constitution for Death ("taking 10d10 Necrotic damage")
  and Pain. If the save field is single-valued, extend the model so
  all of the book's saves are captured, or record the additional saves
  in the description and report the shape chosen — do not drop a
  book save because the field holds one.

**7. Fix the damage dice in the engine's damage table
(`SPELL_DATA_EFFECTS`) — 5 errors, 2 partial, plus missing entries.**
- **Cordon of Arrows:** book "take 2d4 Piercing damage"; EFFECTS
  `{"damage": "1d6", "damageType": "piercing"}`. Wrong die — set 2d4.
- **Ice Storm:** book "2d10 Bludgeoning damage and 4d6 Cold damage";
  EFFECTS `{"damage": "2d8+4d6"}`. Bludgeoning die wrong (2d8 vs
  2d10) — set 2d10 + 4d6.
- **Inflict Wounds:** book "taking 2d10 Necrotic damage"; EFFECTS
  `{"damage": "3d10"}`. 3d10 is the 2nd-level upcast value, not base —
  set 2d10.
- **Prismatic Spray:** book — every damaging ray: "12d6 [type]
  damage"; EFFECTS `{"damage": "10d6"}`. Set 12d6.
- **Vitriolic Sphere:** book "takes 10d4 Acid damage and another 5d4
  Acid damage at the end of its next turn"; EFFECTS
  `{"damage": "4d10"}`. Wrong die, wrong amount, and the second 5d4
  tick is missing (the description gets the tick right but also says
  4d10 initial — fix both).
- **Partial — totals right, per-type split lost:** Jallarzi's Storm of
  Radiance (book 2d10 Radiant + 2d10 Thunder; EFFECTS a single `4d10`
  pool) and Meteor Swarm (book 20d6 Fire + 20d6 Bludgeoning; EFFECTS
  a single `40d6` pool). Record the two damage types separately so
  per-type resistance/immunity applies, following the existing
  EFFECTS conventions for multi-type spells, and report the shape.
- **Add EFFECTS entries where a damage-dealing spell has none** (the
  check found no EFFECTS entry at all for these): Control Water
  (whirlpool 2d8 Bludgeoning), Earthquake (12d6 Bludgeoning),
  Storm of Vengeance (all five rounds: 2d6 Thunder, 4d6 Acid, 10d6
  Lightning, 2d6 Bludgeoning, 1d6 Cold), Wind Wall (4d8 Bludgeoning),
  Power Word Kill ("Otherwise, it takes 12d12 Psychic damage" —
  conditional on the target having more than 100 Hit Points; model
  the condition, do not flatten it), Teleport (mishap 3d10 Force
  damage — add an entry only if the engine resolves mishap damage;
  otherwise carry the mishap numbers in the description and report
  the choice), Meld into Stone (6d6 Force damage on partial
  destruction — conditional), Wish (stress: "1d10 Necrotic damage per
  level of that spell" — conditional), Alter Self (1d6 natural-weapons
  damage).
- **Fix the two incomplete EFFECTS entries:** Hunger of Hadar carries
  only the 2d6 cold; add the 2d6 acid. Regenerate has the 4d8+15 but
  not the 1 HP/turn ongoing healing; add it.
- **No EFFECTS entry needed (description fix only):** Blink deals no
  damage — fix the description (item 8), do not add an EFFECTS entry.
  Ray of Enfeeblement deals no damage itself — fix the description
  (item 8), do not add an EFFECTS entry.
- **Not EFFECTS work:** summoned-creature stat-block numbers (all six
  Summon spells, Giant Insect, Find Steed) need creature stat blocks,
  not a spell EFFECTS line — report them as still-open, not as fixed
  here.
- Verified correct in the check and not to be touched: Disintegrate
  `10d6+40`, Finger of Death `7d8+30`, Magic Missile `3d4+3`
  (3 × (1d4+1)), Regenerate `4d8+15`, Dissonant Whispers `3d6`,
  Spiritual Weapon `1d8` + casting mod.

**8. Fix the description-dice gaps — 10 real gaps, 3 partial.** The
descriptions are fresh-worded by design; these omit or misstate
numbers the player and the engine need. Correct each description to
carry the book's numbers (fresh wording is fine; wrong numbers are
not).
- **Blink — wrong, not just missing:** book "Roll 1d6 at the end of
  each of your turns… On a roll of 4–6, you vanish"; catalog "roll a
  d20 — on an 11 or higher you vanish". Wrong die and threshold —
  fix to 1d6, 4–6.
- **Control Water:** whirlpool 2d8 Bludgeoning omitted — add it.
- **Earthquake:** 12d6 Bludgeoning, 1d6 fissures, 1d10×10 ft depth
  all omitted — add them.
- **Meld into Stone:** "deals 6d6 Force damage to you" on partial
  destruction omitted — add it.
- **Power Word Kill:** "Otherwise, it takes 12d12 Psychic damage"
  omitted entirely — add it.
- **Ray of Enfeeblement — misstates the effect:** book "subtracts 1d8
  from all its damage rolls" with Disadvantage on Strength-based D20
  Tests; catalog "Strength-based attack damage is halved and it has
  disadvantage on Strength checks and saves". Rewrite to the book's
  effect.
- **Storm of Vengeance:** all five rounds' dice omitted (2d6 Thunder,
  4d6 Acid, 10d6 Lightning, 2d6 Bludgeoning, 1d6 Cold) — add them.
- **Teleport:** mishap "3d10 Force damage", "2d12 miles", "Roll 1d8
  for the direction" omitted — add them.
- **Wind Wall:** 4d8 Bludgeoning omitted entirely — add it.
- **Witch Bolt:** book initial hit "2d12 Lightning damage", later
  turns 1d12; catalog description and EFFECTS both use 1d12 as the
  initial damage — fix both to 2d12 initial, 1d12 later.
- **Partial:** Alter Self (1d6 natural-weapons damage omitted); Wish
  (stress "1d10 Necrotic damage per level of that spell", "Strength
  score becomes 3 for 2d4 days" omitted); Web (conditional 2d4 fire
  damage omitted).
- **Not errors, do not touch:** upcast increments (Chromatic Orb 1d8,
  Flame Blade 1d6, Mass Healing Word 1d4, Elemental Weapon 2d4/3d4
  tiers), cantrip-upgrade dice (systematically omitted from
  descriptions; EFFECTS carries `cantripScale: true`), behaviour-table
  rolls (Confusion 1d10/1d4, Reincarnate 1d10).

**9. Material components — the structural item.** The catalog records
only V/S/M letters. There is no field for material specifics
anywhere — no costs, no consumed flags — so Revivify's 300 GP
diamonds, Heroes' Feast's 1,000+ GP gem-encrusted bowl, Astral
Projection's 1,000+ GP jacinthe, Arcane Lock's 25+ GP gold dust, and
every other costly/consumed component are absent from the catalog
data, and the engine cannot check them.
- **Requirement:** add a field for material specifics to the catalog
  entries — the material text, its cost, and whether it is consumed —
  for every spell with an M component, and enforce it at cast time: a
  spell with a costly or consumed material cannot be cast without it,
  and a consumed material is spent. The exact field names, storage
  shape, and check placement are the builder's, following existing
  catalog/service conventions — this brief states the requirement and
  its verification, not a schema. Report the shape chosen for the
  PM's veto at the gate.
- **Verification for this item:** Revivify (300 GP of diamonds,
  consumed), Heroes' Feast (1,000+ GP gem-encrusted bowl, consumed),
  Astral Projection (1,000+ GP jacinthe), Arcane Lock (25+ GP gold
  dust) — each stored with cost and consumed flag, and the cast path
  refuses the cast without the component. Swift Quiver's material (a
  quiver worth 1+ GP) is stored under this item as well as its letter
  fix in item 5.
- Do not invent material text: take it from the book's Components
  line for each spell (the transcription files hold it).

**10. Regenerate the client mirror — do not hand-edit it.**
`client/src/data/spellCatalog.generated.json` is generated from
`server/data/spellCatalogData.js` by
`scripts/generate-spell-catalog.js`. After items 1–9, run the
generator and verify the mirror matches the server file entry for
entry (expected: **584/584**, up from 583 with Tsunami added). Never
hand-edit the generated file; if the generator cannot express a new
field (e.g. the material specifics from item 9), extend the
generator and report the change.

**11. Bring the legacy client catalogs in line or remove them from
the read paths.** Both still carry 2014 text and disagree with the
live catalog:
- `client/src/data/spells.json` (166 objects across per-class lists;
  feeds the early creator spell rows via
  `spellBlurb.catalogSpellRow`): Blade Ward is the 2014 version
  ("resistance against bludgeoning, piercing, and slashing… Until the
  end of your next turn", duration "1 round"); Guidance is the 2014
  once-per-spell version; Resistance is the 2014 version ("add the
  number rolled to one saving throw of its choice"); Banishing Smite
  and Tsunami are absent. Mending agrees (1 minute).
- `client/src/data/spells/*.json` (cantrips + spells-1st..9th; feeds
  the in-play UI: quick reference, party builder, level-up,
  character sheet): cantrips.json repeats the same 2014 Blade
  Ward/Guidance/Resistance.
- **Do one of these, and report which:** (a) replace their content
  from the corrected live catalog, so every surface shows the same
  text; or (b) remove the reads so every surface reads the generated
  catalog. The choice is the builder's, reported as a decision with
  its reversal cost.
- **Do not regress the two cases where the legacy files are currently
  more correct than the live catalog:** `spells-5th.json` Banishing
  Smite has the correct duration ("Concentration, up to 1 minute")
  where the live catalog said Instantaneous, and `spells-8th.json`
  has Tsunami (range wrongly "Sight" vs book 1 mile; duration and
  6d10 correct). After the live catalog is fixed (items 1 and 5), the
  legacy files must match the live catalog — the legacy files are
  never the source of truth. Tsunami's range in `spells-8th.json` is
  corrected to 1 mile either way.

## Out of scope
- Level changes. All 390 present spells match the book's level — do
  not touch any level field.
- The 151 homebrew-class additions (Artificer, Blackguard, Spellshot
  on PHB spells). Deliberate by design; they stay, except where a
  book class was dropped — those are already in the item 4
  corrections.
- Summoned-creature stat blocks (item 7, still-open).
- Any spell effect the engine does not yet resolve beyond the
  EFFECTS/description corrections above: correct text and data in
  this job; wiring new mechanical effects is a later job, reported
  as still-open per spell.
- The other three repo-check fix jobs (tools, alignment/lifestyle,
  feats) — separate briefs, separate gates.

## Acceptance criteria
- `SPELL_DATA_ENTRIES` holds 584 entries: all 391 book spells present,
  Tsunami added, no other spell added or removed.
- Source tags: the 5 mistagged book spells read `"PHB 2024"`;
  Pyrotechnics and Summon Shadowspawn read their real sources; the
  reconciliation (387 − 2 = 385 = 391 − 5 − 1) holds.
- All 13 schools, all 23 missing-class and 12 added-class corrections,
  all 5 casting-time, 9 range, 5 components, 11 duration, and 1
  ritual corrections match the book values in this brief, with
  `concentration` flags matching the durations.
- No invented saves remain (Hallow, Maze, Plane Shift, Ray of
  Sickness have no save field); the conditional saves (Forcecage,
  Magic Circle) are not flattened into unconditional ones; Bigby's
  Hand, Prismatic Wall, and Symbol carry all of the book's saves.
- The engine's damage table carries the book's dice for Cordon of
  Arrows, Ice Storm, Inflict Wounds, Prismatic Spray, and Vitriolic
  Sphere; Jallarzi's Storm of Radiance and Meteor Swarm record their
  two damage types separately; the missing-entries spells in item 7
  have entries where the engine resolves their damage; Hunger of
  Hadar has both 2d6 cold and 2d6 acid; Regenerate has the 1 HP/turn
  healing.
- Every description in item 8 carries the book's numbers; Blink rolls
  1d6 on 4–6, not a d20 on 11+.
- Material specifics are stored for every M-component spell and
  enforced at cast time; Revivify, Heroes' Feast, Astral Projection,
  and Arcane Lock verify as in item 9.
- The generated mirror matches the server file entry for entry
  (584/584) and was produced by the generator, not hand-edited.
- The legacy catalogs either match the corrected live catalog or are
  no longer read; no surface shows 2014 spell text.
- Full `npm test` green on the builder's run; new/updated suites
  cover the catalog: presence (391/391), schools, class lists,
  fields, saves, damage-table dice, material storage, and the
  mirror's fidelity.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  (`E:\DnD Meta Game\dnd-meta-game`) and iterate until green. Zach's
  full run is the gate — never claim it.
- Note the known runner flag: spellbook-routes takes ~158s against
  the runner's 120s per-file cap — a timeout artifact, not a failure,
  if it trips.
- Re-check: the report lists, per spell, the live catalog values next
  to the book values in this brief, so the PM can verify without
  opening the repo. Include the 584/584 mirror check, the
  reconciliation from item 2, and the per-spell verification of the
  four material-component examples from item 9.

## Decisions already made
- The 2024 book wins on conflict (Zach's rules hierarchy).
- The catalog's descriptions stay fresh-worded (no verbatim book
  prose) — this job corrects mechanics, not wording, except where a
  description misstates a number.
- The homebrew-class additions stay (deliberate by design).
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling
  gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.
- Zach directed 2026-11-24 that all four checked sections be fixed in
  the engine.

## Report
- §3 format from `claude-code-handoff.md`, plus per-spell verdicts
  grouped by item (added / corrected / already-correct / still-open
  with evidence), the mirror fidelity check (584/584), the item 2
  reconciliation, and the material-component verification for the
  four named spells.
- The shapes chosen for: multi-save spells, conditional saves,
  multi-round/multi-type damage entries, Plant Growth's two modes,
  and the material-specifics field — each for the PM's veto at the
  gate.
- The legacy-catalog decision from item 11 (replaced from the live
  catalog, or reads removed), with its reversal cost.
- Any spell whose effect the engine does not yet resolve, listed as
  still-open (correct text and data, unwired effect) rather than
  silently dropped.
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
- Place this brief at `docs/pm/repo-check-fixes-spells/BRIEF.md` in the
  repo when handing it over.
