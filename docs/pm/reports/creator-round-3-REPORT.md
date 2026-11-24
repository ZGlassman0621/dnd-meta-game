# Report — creator-round-3: creator retest fixes (picker layout, missing descriptions, two copy fixes)

## Understanding

The game is a solo D&D 2024 campaign with an AI Dungeon Master. Before play, the player builds a level-1 character in a six-stage creator:
1. Origin & Identity
2. Class & Calling
3. Past & Path
4. Abilities, Skills & Spells
5. Gear & Story
6. Review

This job finishes the creator's retest notes. Every picker must read cleanly on the real screen, with the checkbox or radio beside its name. Every choice should explain itself: dragonmarks, artisan's tools, the wizard's level-1 spell list, alignment, faith and lifestyle. The Story & Appearance help text should speak to the player in professional language. The Magic Initiate pickers should match the shared spell-row format.

Two points where I read the brief differently from its letter:
1. **Item 8 asks for a voice pass over "the section Tips", but the same item and the Out of Scope list say "do not add or change any `<Tip>`".** I followed the explicit prohibition: no `<Tip>` was touched. The story section's own Tip and the three Alignment/Faith/Lifestyle helps are separate things. The helps are on-page text and were rewritten; the Tip was not.
2. **The brief calls it "the Story & Appearance screen", but in the creator that is the lower half of Stage 5, "Gear & Story".** I rewrote:
   - the page lede (it describes both halves);
   - every helper in the Story & appearance section;
   - the footer help.

   The gear half was left untouched: its copy belongs to items 10–12 of Zach's 2026-11-23 notes, which the brief excludes. That covers the package text, the gold fork and the derived-numbers help.

## Verdict

BUILT + GREEN on the builder's run, with items 1, 4 and 9 verified on the running app at :5173. Zach's run is the gate.

## Per-item verdicts

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Picker layout on screen | **Verified clean on screen**, plus one sibling fixed (below) | Headless Chrome against :5173. Results per picker below. |
| 2 | Dragonmark explainer | **Built** | A visible line under the Variant picker names dragonmarks and each mark's house. It is read from the mark's own description, so nothing is invented. Seen live for Human. |
| 3 | Artisan-tool descriptions | **Built**, including both Crafter pickers | Clan's Craft shows the chosen tool's description under the picker (seen live: Mason's Tools). The Stage 1 Versatile and Stage 3 theme Crafter lists show each tool's description under its row. |
| 4 | Level-1 wizard list as a bounded choice | **Built + verified on screen** | 44 options, grouped by school of magic into 8 collapsible groups. Details below. |
| 5 | Alignment descriptions | **Built** (gap noted) | 10 descriptions; the chosen one shows under the picker (seen live: Chaotic Good). |
| 6 | Faith and Lifestyle descriptions | **Built** | The chosen deity's description shows (seen live: Tymora). Lifestyle shows its description plus daily cost (seen live: "Modest … Cost: 1 gp a day."). |
| 7 | "Flavor for the DM" removed | **Built** | Gone from all seven appearance helpers. Checked live: 0 occurrences on the page. |
| 8 | Story & Appearance copy | **Built** | The before/after table is below. Seen live: the new "How you act" helper. |
| 9 | Magic Initiate pickers in the shared row format | **Built + verified on screen** | Stage 1 Versatile and Stage 3 theme cantrips now use the shared `SpellPickRow`: checkbox beside the name, description and facts line under it. Stage 1 also gained the chosen level-1 spell's description, as Stage 3 already had. |

### Item 1 — one line per picker, from the running app

**Method:** headless Chrome with a fresh profile, so no cache (equivalent to a hard refresh), at 1280 px wide, driving the real app at :5173 against a throwaway database. For every checkbox and radio, a page script measured whether its label text sits on the same row, right beside it. It checked:
- the gap between the input and its text;
- that the input never stretches;
- that no label text overflows its row.

I also looked at screenshots of each picker.

| Picker | Result |
|---|---|
| Stage 2 cantrip picker (Wizard, 33 rows) | **Verified clean on screen**: 0 bad rows. Each checkbox is 13 px wide, with the name 8 px to its right on the same row. |
| Stage 4 class skills, plus every other checkbox on Stage 4 (54–56 rows, including the method radios and the spellbook) | **Verified clean on screen**: 0 bad rows |
| Starting equipment, Stage 5, all 13 playable classes (package cards, package-alternative radios: Artificer 6, Cleric 3, Monk 2, Paladin 3; gold-fork radio) | **Verified clean on screen**: 0 bad rows in every class. Screenshot of the Cleric card: the Holy Symbol alternatives (Amulet / Emblem / Reliquary) sit radio-beside-name. |
| Stage 1 mixed-ancestry trait picker (Elf + Dwarf, 10 rows) | **Verified clean on screen**: 0 bad rows |
| Stage 1 Versatile Magic Initiate cantrips (16 rows) | **Verified clean on screen** after item 9 |
| Stage 3 theme Magic Initiate cantrips (Sage, 16 rows) | **Verified clean on screen** after item 9 |
| Stage 1 Versatile Musician / Skilled / Crafter lists | **Fixed, then verified** (Crafter: 17 rows, 0 bad). **What was wrong:** these three lists used `display: block` labels with an unstyled checkbox, the same defect class the round-2 fix addressed elsewhere but never reached here. They now use the flex row with a non-stretching checkbox. |

### Item 2 — dragonmarks

The help line now reads, for a Human:

> The variants named "Mark of …" are dragonmarks, from Eberron: a dragonmark is a magical sigil that appears on the skin of certain bloodlines and grants innate magic. Each one ties you to the dragonmarked house that bears it: Mark of Finding (House Tharashk), Mark of Handling (House Vadalis), Mark of Making (House Cannith), Mark of Passage (House Orien), Mark of Sentinel (House Deneith).

Every one of the 13 mark entries names its house: the 12 marks across 7 species, with Finding on both half-orc and human. Mark of Shadow names both of its houses, Phiarlan and Thuranni. The selected mark's description and traits still show below the picker (seen live for Mark of Making).

The one-sentence definition of a dragonmark is my wording of Eberron: Rising from the Last War's description. It is not a quotation.

**Origin-explanation check: a gap, as the brief asked me to report.** The outside-Forgotten-Realms explanation is required only when the character's *origin setting* is outside the Realms (`server/routes/character.js:2488`). The species-must-match-origin rule was removed on 2026-11-05 (the comment at `character.js:2491`). So a character with a Forgotten Realms origin can take a Mark of Making with **no explanation recorded anywhere**. A character who picks Eberron as origin still gets the explanation requirement. Nothing was changed; the origin system is out of scope.

### Item 3 — the tool descriptions against the 2024 book

**All 17 artisan-tool descriptions are unverified.** The `references.js` `TOOLS` text is the repo's own prose: for example, "Brewing potions and identifying alchemical substances — vials, flasks, and reagents for extractions and analysis." The 2024 PHB writes each tool as an entry with its ability, what it is used for, and what it crafts, so there is no prose description to compare against.

I cannot check the wording against the book without a copy. Nothing was rewritten and nothing was dropped, so the descriptions show as they are. A mismatch check needs the PHB's Tools section.

### Item 4 — the spellbook list

- **Option count:** 44 first-level wizard spells, the same as the scope pass. It is still level 1 only; the scope was not changed.
- **Grouping:** by school of magic, alphabetically:

  | School | Spells |
  |---|---|
  | Abjuration | 7 |
  | Conjuration | 6 |
  | Divination | 4 |
  | Enchantment | 4 |
  | Evocation | 10 |
  | Illusion | 4 |
  | Necromancy | 3 |
  | Transmutation | 6 |

- **How it reads:** each school is a collapsible group whose heading shows its count. A group holding a pick shows "— N in your book" and stays open. Above the groups: "44 first-level wizard spells, grouped by school of magic. Open a school to see its spells."
- **Seen live:** ticking two Evocation spells updated the heading to "Evocation (10) — 2 in your book" and the book counter to "2 of 6 … 4 left".

### Item 5 — alignment source

The descriptions are written in my own words from the 2024 PHB, Chapter 2 ("Alignment"). They are summaries of the book's meaning, **not quotations, and not checked line by line against a physical copy. That is a gap: each one should be read against the book at the gate.**

The picker still offers "True Neutral". The 2024 book names that alignment "Neutral", and its description says so. Renaming the stored value would touch saved characters, so it was left as it is.

### Item 6 — Faith and Lifestyle

- **Faith:** all 55 `deities.json` entries have a description, and the chosen deity's shows under the picker. **None** shows no description and keeps the field's help, which explains None as a real choice.
- **Duplication, as observed (not fixed):** the Faith list starts with **None**, and `deities.json` also has **Atheist** ("Does not worship any deity") and **Agnostic** ("Uncertain about the existence or nature of deities"). The picker therefore offers three ways to say "no god": None, Atheist and Agnostic.
- **Lifestyle:** 7 descriptions in my own words from the 2024 PHB lifestyle expenses, **unverified word for word, the same gap as alignment**. The cost shown is the in-repo daily cost, and a test keeps it equal to the server table:

  | Lifestyle | Cost |
  |---|---|
  | Wretched | Free |
  | Squalid | 1 sp a day |
  | Poor | 2 sp a day |
  | Modest | 1 gp a day |
  | Comfortable | 2 gp a day |
  | Wealthy | 4 gp a day |
  | Aristocratic | 10 gp a day |

### Item 8 — copy, before and after (every changed string)

| Field | Before | After |
|---|---|---|
| Page lede | Take your class's starting equipment — or gold instead — then say who this person is. The gear choice locks at creation; the story text stays editable later in edit mode. Nothing here is pre-picked: the fork starts empty, and every story field starts blank. | Choose your starting equipment — your class's gear, or gold to buy your own — and then describe who your character is. Your equipment choice is final once you create your character; what you write about yourself can be changed later. Nothing is chosen for you: every option and every story field starts empty. |
| Alignment | Your moral compass: the nine alignments, or Unaligned if none of them fit. It shapes how the DM plays the world around you, never a mechanic — no class or feature reads it. Required at Review, changeable later in edit mode. | Your character's moral outlook: one of the nine alignments, or Unaligned if none of them fits. It guides how you play your character and how the world responds to you; it never changes your abilities. Choose one before you finish. You can change it later. |
| Faith | Who you worship, if anyone — the Faerûnian pantheon, or None. Picking None is a real choice, not a missing value: an atheist and a devout cleric meet the world differently, and the DM plays that. Required at Review, changeable later in edit mode. | The god you follow, if any, from the deities of the Forgotten Realms. None is a real answer: a character who follows no god meets the world differently from a devout one. Choose one before you finish. You can change it later. |
| Lifestyle | How you live day to day, from Wretched to Aristocratic. It sets what a night, a meal, and a roof cost you between adventures — flavor with a price tag, not a lock. Required at Review, changeable later in edit mode. | How you live between adventures, from Wretched to Aristocratic. It sets what you pay each day for food, lodging, and upkeep. Choose one before you finish. You can change it later. |
| Age | How old you are, in years or in your species' own reckoning. Flavor for the DM — it never changes a number. Optional, changeable later in edit mode. | How old you are, in years or by your people's own reckoning. Optional; you can change it later. |
| Height | How tall you are — feet and inches, or your species' own measure. Flavor for the DM, never a mechanic. Optional, changeable later in edit mode. | How tall you are, in feet and inches or your people's own measure. Optional; you can change it later. |
| Weight | How much you weigh. Flavor for the DM, never a mechanic. Optional, changeable later in edit mode. | How much you weigh. Optional; you can change it later. |
| Build | Your build — slim, heavy, wiry, broad, or your own words. Flavor for the DM, never a mechanic. Optional, changeable later in edit mode. | Your build: slender, stocky, wiry, broad, or in your own words. Optional; you can change it later. |
| Eyes | Your eye color. Flavor for the DM, never a mechanic. Optional, changeable later in edit mode. | The color of your eyes. Optional; you can change it later. |
| Hair | Your hair color and style, or bald, or something stranger. Flavor for the DM, never a mechanic. Optional, changeable later in edit mode. | Your hair's color and style — or none at all, or something stranger. Optional; you can change it later. |
| Skin | Your skin color and texture. Flavor for the DM, never a mechanic. Optional, changeable later in edit mode. | The color and texture of your skin. Optional; you can change it later. |
| Personality traits | How you act — habits, tics, the things people notice first. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode. | How you act: your habits, mannerisms, and the things people notice first. The DM uses this to shape how the world reacts to you. Optional; you can change it later. |
| Ideals | What you believe in — the principles you would not give up. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode. | The principles you live by — the beliefs you would never give up. The DM will put them to the test. Optional; you can change it later. |
| Bonds | Who and what you are tied to — people, places, promises. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode. | The people, places, and promises you are tied to. The DM weaves them into your story. Optional; you can change it later. |
| Flaws | Where you go wrong — the weakness the world can press on. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode. | Your weaknesses — the fears, vices, and blind spots the world can use against you. Optional; you can change it later. |
| Organizations | Groups you belong to — a guild, an order, a crew. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode. | The groups you belong to: a guild, a temple, an order, a crew. Optional; you can change it later. |
| Allies | People on your side — friends, patrons, debts owed to you. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode. | The people on your side: friends, patrons, and those who owe you a favor. Optional; you can change it later. |
| Enemies | People against you — rivals, hunters, debts you owe. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode. | The people against you: rivals, hunters, and those you owe. Optional; you can change it later. |
| Backstory | Your story so far, in your own words — where you came from, what brought you here. The DM reads it and works it into the adventure. Optional, changeable later in edit mode. | Your story so far, in your own words: where you come from and what brought you here. The DM reads it and weaves it into the adventure. Optional; you can change it later. |
| Other notes | Anything else the DM should know that fits nowhere above. Free text, never a mechanic. Optional, changeable later in edit mode. | Anything else you would like the DM to know about your character. Optional; you can change it later. |
| Footer help | Locked at creation: the equipment package or gold. Changeable later: everything on this page below the gear — appearance and story text never touch mechanics. | Your equipment choice is final once you create your character. Everything else on this page — alignment, faith, lifestyle, appearance, and story — can be changed later. |

**Unchanged:**
- The three personality prompt questions ("What do people notice about you first?", "What habit gives you away?", "What do you do when you're nervous?"). They already speak to the player.
- Every `<Tip>`, which is out of scope.

## Files changed

There is no migration. The version is now 1.0.210, in both `package.json` files. The SHA-256 values are of the committed bytes.

| File | New / edited | Bytes | SHA-256 |
|---|---|---|---|
| `client/package.json` | edited | 427 | `a0c153a1b527488dd855dfde6c46f7d483141d18ec59c18767272bf32c07ac1f` |
| `client/src/components/creator-next/Stage1OriginIdentity.jsx` | edited | 76158 | `f0e6701a8048198450877759698ab9607d529b8081e6c98a9c21a25573892480` |
| `client/src/components/creator-next/Stage3PastPath.jsx` | edited | 32510 | `5c61376551e96561740fcc8cab6eabda1da2267bb7d06225562262ae1ebf93dd` |
| `client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx` | edited | 72222 | `440ba8c7539fe58f2ff9e4d6d7217a025157907f66325f1b52eddbad4933b5e8` |
| `client/src/components/creator-next/Stage5GearStory.jsx` | edited | 51512 | `6f0eb98f6397ca0d0bdf5a396ff0812754f74f05b8ed423a9fab0d0d7b5ead55` |
| `client/src/components/creator-next/choiceOptions.js` | edited | 12449 | `93e56c75edb19f1d925cd55a6b8760d2f98709b2a9ef000d12c1eee6abb75cea` |
| `client/src/components/creator-next/speciesAdapter.js` | edited | 12005 | `e7562c9ebfc3bc2f29bd6dfc715e474f534fb37d18ec06d9cc99d4060bbbc95f` |
| `client/src/components/creator-next/spellBlurb.js` | edited | 3106 | `6260fd20d03f12f55582a1411b61f872af90031e285d048d698ddb6999f9a2ed` |
| `package.json` | edited | 1398 | `d53d51fd2cee470f8e131e7677906aff726af8451e1fe47fe542bb68764e124f` |
| `tests/creator-next-stage2.test.js` | edited | 21304 | `d2fe15a1f81606161bbc4fd7afcac22d86eda9e90c037a392822ee253b670893` |
| `tests/creator-test-notes-1-client.test.js` | edited | 20823 | `8903dc629dd650e50b58a2bc9a9576deefae3bc5d21a0a2712135c9d98f517df` |
| `tests/creator-test-notes-2-client.test.js` | edited | 37401 | `cd63e5abc77eed4e7f7f00b60d623b0fbee03209570a7ac0a8b54aa98b246dcd` |
| `client/src/components/creator-next/SpellPickRow.jsx` | new | 1659 | `3b835b27ecff7cc96d710f651becde901f0920474a7f438e2c57177e79bac07b` |
| `client/src/data/storyChoices.js` | new | 3531 | `6969b2187a01de9fe11b5219ab7b9bb8cd724910876be2e7eeec364d24d6a65f` |
| `docs/pm/creator-round-3/BRIEF.md` | new | 17536 | `48085a3e3a0ba9868feedd1af8a7e5eea5ce8348e564e812db4e9a77b840a80a` |
| `tests/creator-round-3.test.js` | new | 12157 | `a92916e54815032a76b3145c28a08cf9a042848531fc2f5675c40b397104b29d` |

## What was built (in play)

- **On every picker** (cantrips, class skills, mixed-ancestry traits, the Magic Initiate cantrips, the Versatile feat lists, the package radios): each name sits beside its checkbox or radio, on one row. This was confirmed on the running app, not only in code.
- **Choosing a race variant:** a human, dwarf, elf, gnome, halfling, half-elf or half-orc sees a line explaining that the "Mark of …" variants are Eberron dragonmarks, and which house each belongs to, before picking.
- **Clan's Craft:** a dwarf who picks a tool sees what that tool is for, right under the picker. The Crafter feat's tool lists show every tool's purpose.
- **Wizard spellbook:** the 44 first-level spells come as eight schools to open, each showing how many it holds and how many you have taken.
- **Story choices:** picking an alignment, a god or a lifestyle shows what it means, and for a lifestyle, what it costs a day.
- **Story help text:** it speaks to the player plainly. The "Flavor for the DM" line is gone.
- **Magic Initiate:** the cantrips read like every other spell picker, with each spell's description and casting facts under its name. On Stage 1, the chosen level-1 spell shows its description too.

## Test results

This was the builder's full `npm test` on the PC, 2026-11-24. **Files: 255/255 green. Assertions: 19,752 passed, 0 failed.**
- Retried after Windows' native libsql crash, and passed: `creator-next-stage4`, `spellbook-routes`.
- `pass*` (the crash came after every assertion had passed, so it counts green): `companion-sheet`, `item-2a-features`, `lair-hazard-auto`, `subclass-scanned4`.
- The total is printed by the runner. On Windows, a `pass*` file can drop its count from the total, so the number moves between runs. No assertion failed in any file.

**New: `tests/creator-round-3.test.js`, 46 assertions.** The pure helpers are run for real:
- `dragonmarkHouses`: all 13 mark entries, both Shadow houses, nothing invented;
- tool descriptions from `resolveChoiceOptions`: 17/17;
- `groupSpellsBySchool`: 44 spells in 8 groups;
- the alignment and lifestyle tables, with costs equal to the server table;
- `catalogSpellRow`.

Plus source pins for the JSX wiring and the copy, covering items 1 to 9. A source pin is not a screen check: the on-screen results are in the Item 1, 4 and 9 sections above.

Three existing suites pinned code this job deliberately changed, and were updated:
- `creator-next-stage2` (414 passed) and `creator-test-notes-1-client` (165 passed): the shared spell row moved to `SpellPickRow.jsx`.
- `creator-test-notes-2-client` (1,077 passed): Stage 3 now shows a description for every cantrip option, not only picked ones, and the "How you act" helper was rewritten.

Client build (`npx vite build`): green.

## Cost and usage

I can't measure this session's cost or remaining usage from inside the session. The job made no paid API calls.

## Not done / still open

1. **Every `<Tip>` is unchanged,** per the brief's prohibition. The story section's Tip still says "Nothing here touches mechanics" and "edit mode". That belongs to the queued tooltip job.
2. **The tool, alignment and lifestyle text is not checked against the 2024 book:** items 3, 5 and 6, gaps stated above. Each needs a read against the PHB.
3. **"True Neutral" versus the 2024 name "Neutral":** the stored value was left as it is; renaming it touches saved characters.
4. **Faith None / Atheist / Agnostic duplication:** reported, not fixed, as the brief asks.
5. **A Realms-origin character can take a dragonmark with no explanation recorded:** an origin-system gap, reported, not fixed.
6. **The Stage 1 Versatile Musician and Skilled lists got the row fix (item 1 sibling) but no per-option descriptions.** The brief asks for tool descriptions on the Crafter pickers only. The same data would light them up with a one-line change each.

## Decisions made (reversible, for veto)

1. **The shared spell row moved to its own file** (`creator-next/SpellPickRow.jsx`, unchanged) so Stages 1, 3 and 4 use one row. Reversal: inline it again.
2. **Spellbook school groups start closed**, except a group holding a pick, which stays open. Reversal: one condition (`open`).
3. **Any option whose name has a `TOOLS` entry now carries its description** in `resolveChoiceOptions`. That covers every artisan's tool, kit, gaming set and instrument, not only artisan's tools; the pickers only show it where this job asked. Reversal: limit the lookup to the artisan list.
4. **The dragonmark help appears whenever the species' variant list contains a mark,** and only then. Reversal: a different condition.
5. **The Stage 1 ancestry-feat choice shows the description of every chosen value** (each slot of a multi-pick), wherever the options carry one. Today that is the tool choices.

## Needs Zach's decision

None that the PM cannot make. The gaps above (book checks, True Neutral, the Faith duplicates, the dragonmark origin gap) are the PM's to queue or decide.

## How to verify

**Gate:** `npm test` from the repo root. Expect all files green, including the new `tests/creator-round-3.test.js` (46 assertions).

At **:5173** (never :3000), after `npm run dev` and a hard refresh (Ctrl+Shift+R), choose **Create New Character**:

1. **Stage 1, Human:**
   - Under **Variant**, a line explains that the "Mark of …" variants are dragonmarks and names each house, before you pick anything.
   - Pick Mark of Making: its description and traits appear below.
2. **Stage 1, Human, then the Versatile origin feat:**
   - Choose **Magic Initiate**, then the **Wizard** list. Each cantrip has its checkbox beside the name, with its description and casting facts underneath. Pick a level-1 spell, and its description appears under the select.
   - Switch to **Crafter**: each tool shows what it is for under its name.
3. **Stage 1, Dwarf:** under Ancestry feat choose **Clan's Craft**, then pick **Mason's Tools**. Its description appears under the picker.
4. **Stage 1, Mixed Ancestry on,** parents **Elf** and **Dwarf**: every trait checkbox sits beside its name.
5. **Stage 2, Wizard:** every cantrip checkbox sits beside its name.
6. **Stage 3, Sage theme:** the Magic Initiate cantrips use the same row as Stage 2.
7. **Stage 4, as a wizard:**
   - The spellbook shows "44 first-level wizard spells, grouped by school of magic" with eight schools.
   - Open **Evocation** and tick two spells: the heading becomes "Evocation (10) — 2 in your book".
8. **Stage 5, as a Cleric:** the package radios and the Holy Symbol alternatives (Amulet / Emblem / Reliquary) sit radio-beside-name.
9. **Stage 5, story choices:**
   - Pick **Chaotic Good**, **Tymora** and **Modest**: each shows its description under the picker, and Modest also shows "Cost: 1 gp a day."
   - No helper says "Flavor for the DM". The **Personality traits** helper starts "How you act: your habits, mannerisms, and the things people notice first."

## Verification evidence

- Commit `bb3ccfc`, branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`, pushed to `origin`.
- SHA-256 per file: the Files changed table.
- Tests: the Test results section.
- On-screen evidence: the Item 1, 4 and 9 sections (headless Chrome at :5173, fresh profile, measured row geometry and screenshots).
