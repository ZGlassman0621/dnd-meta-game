# Report — story-starters (M1): wire the story starters into Stage 5

## Understanding

This is a solo D&D 2024 game: one player character, an AI Dungeon Master, and a six-stage character creator. Stage 5 (Gear & Story) is where the player picks starting equipment and writes who the character is: alignment, faith and lifestyle, seven appearance fields, and nine story fields.

The repo already held about 1,500 lines of story starters, written for the old creator, that nothing showed the player. This job makes those starters into choice lists on Stage 5's story fields. Each list is shaped by the character's theme, species and size. The player can still write their own words through an "Other / write your own" entry beside every list. Fields with no starters stay plain text boxes. No new text is invented.

**Four points where my reading differs from the brief or needs flagging, stated first:**

1. **Placement.** The brief says to place it at `docs/pm/m1-story-starters/BRIEF.md`. Zach's handover said `docs/pm/story-starters/BRIEF.md`. I followed Zach.
2. **The MVP-only UI build is not in the repo yet.** The brief assumes this job comes after creator round 3 and the MVP-only UI strip. Round 3 is built (`docs/pm/reports/creator-round-3-REPORT.md`, and its Stage 5 copy is what the live file shows), so the brief's stop condition doesn't apply. But there is no MVP-only UI brief or report anywhere in `docs/pm/`. I built on the current Stage 5. If the strip later changes Stage 5's story section, this work may need re-fitting there.
3. **Alignment is a fourth driver in the data, and the brief didn't name it.** Every personality, ideal, bond and flaw starter is tagged with one of the nine alignments. The brief names species, size and theme as drivers, so I didn't filter by alignment. Each starter shows its alignment as a small label, which is what the old creator's design did. See Decision 3.
4. **The appearance lists are not 2024 book text.** Their file headers say they were compiled from "PHB Chapter 2 race entries", Volo's Guide, Eberron: Rising from the Last War and Mordenkainen's Tome of Foes. The 2024 Player's Handbook species chapter isn't on the PC, so I could not check them against the 2024 book. They are labelled on screen as suggestions compiled for this game, not 2024 book text. The one question for Zach is about this.

## Verdict

**BUILT + GREEN** on my run: 264/264 files, 20,374 assertions, 0 failed. Item 6, the hand check at :5173, was **not done by me**: this session has no browser I can drive. The exact steps are under "How to verify", and that item is unverified until someone runs them.

## Per-item verdicts

| # | Item | Verdict |
|---|---|---|
| 1 | Survey first | BUILT. Full inventory below |
| 2 | Choice lists by species / size / theme | BUILT. 12 fields got lists, 4 stayed free text, 3 were already selects |
| 3 | Free text survives | BUILT. Every list has an Other entry, and no field lost its free text |
| 4 | Save, rehydrate, show | BUILT, plus a fix: only Faith used to rehydrate on resume |
| 5 | Tests | BUILT. New suite `story-starters.test.js`, 144/144 |
| 6 | Prove at :5173 by hand | NOT DONE (no browser in this session). Steps below |

## Item 1 — the survey

### The starter inventory (all in `client/src/data/`)

| File | Lines (data block) | What it holds | Driver | Field | Status |
|---|---|---|---|---|---|
| themePersonalityPrompts.js | 290 (32–284) | 189 starters: 21 themes × 9, each with an alignment tag | theme | Personality traits | **wired** |
| themeIdealsPrompts.js | 217 (18–217) | 136 starters across 21 themes, alignment-tagged | theme | Ideals | **wired** |
| themeBondsPrompts.js | 209 (20–209) | 126 starters across 21 themes, alignment-tagged | theme | Bonds | **wired** |
| themeFlawsPrompts.js | 188 (19–188) | 106 starters across 21 themes, alignment-tagged | theme | Flaws | **wired** |
| themeBackstoryMoments.js | 251 (20–251) | 168 moments: 21 themes × 8, no alignment | theme | Backstory (tick any) | **wired** |
| raceColorTraits.js | 153 (46–144) | eyes, hair, skin and build lists for 10 species | species | Eyes, Hair, Skin, Build | **wired** |
| raceDemographics.js | 189 (73–180) | age, height and weight lists for 10 species | species (+ size for height and weight) | Age, Height, Weight | **wired** |
| themeNarrativeContinuity.js | 57 (18–57) | 19 class-and-calling cards | theme | none: it was Stage 4 copy | **still orphaned**: no story field matches, and the calling question is out of scope |

That is 1,554 lines in total, matching the audit's "~1,500" (`docs/pm/reports/full-codebase-audit-REPORT.md`, item M1). Every line is accounted for: seven files are wired, and one stays orphaned with its reason.

**Other survey facts:**

- **Themes:** all 21 theme ids in the starter files match the live theme list (`server/data/themes.js`).
- **Species data covers:** human, dwarf, elf, half-elf, half-orc, halfling, tiefling, aasimar, dragonborn and warforged.
- **The MVP's player species** are those 10 plus gnome (`server/services/speciesService.js:154`). Gnome has no appearance data, so a gnome keeps free text.
- **Size:** the only single species with a size choice is Human, Medium or Small (`server/data/species/phbSpecies2.js:137`). Mixed ancestry has its own size pick.
- **Undriven starters:** none. Every set is keyed by theme or by species.
- **Overlaps:** no starter text appears in two lists, so the "held option is grayed out" rule never comes up.

### How Stage 5 saves today

- **Storage:** every story field is a plain text column on `characters`: alignment, faith, lifestyle, age, height, weight, physical_build, eye_color, hair_color, skin_color, personality_traits, ideals, bonds, flaws, organizations, allies, enemies, backstory, other_notes. All are TEXT, with no length caps.
- **Save:** `buildStage1ProgressBody` (`client/src/components/creator-next/stage1Persistence.js`) sends each non-blank field. A blank field is simply not sent.
- **Validation:** none at Stage 5. Review (Stage 6) requires alignment, faith, lifestyle and the physical description.
- **Review:** the Stage 6 screen prints every field as stored (`Stage6ReviewCommit.jsx`, around lines 733–742).
- **Gap found:** on resume or edit from the saved character, only Faith was read back (`rehydrateStateFromServerRow`). Every other story field came back blank. Item 4 fixes it.

**No new columns are needed:** a pick is the same plain string a typed answer is.

## Field-by-field mapping (for Zach to veto any one)

| Field | Now | Driven by |
|---|---|---|
| Alignment, Faith, Lifestyle | unchanged (already lists) | — |
| Age | list + Other | species |
| Height | list + Other | species, only at the species' usual size |
| Weight | list + Other | species, only at the species' usual size |
| Build | list + Other | species |
| Eyes | list + Other | species |
| Hair | list + Other | species |
| Skin | list + Other | species |
| Personality traits | starters + Other (the three prompt questions stay) | theme |
| Ideals | starters + Other | theme |
| Bonds | starters + Other | theme |
| Flaws | starters + Other | theme |
| Organizations | free text only (no starter set) | — |
| Allies | free text only (no starter set) | — |
| Enemies | free text only (no starter set) | — |
| Backstory | moments to tick + the free-text box, always shown | theme |
| Other notes | free text only (no starter set) | — |

## Files changed

| File | Change | Bytes | SHA-256 |
|---|---|---|---|
| client/src/components/creator-next/storyStarters.js | **new**: list builder, drivers, pick/Other matching, backstory tick-boxes | 8001 | 76fee8d0a8884f54f6020f4d9d58e9d00e4f0d9ccc1caf38ed3ab57d25a35588 |
| client/src/components/creator-next/Stage5GearStory.jsx | edited: `starterField` helper; 12 field calls use it | 57408 | bf601cd84336d7b321b401a88d5f77b3d647b028dbc376f1686f30c0b776e5f5 |
| client/src/components/creator-next/stage1Persistence.js | edited: `STAGE5_STORY_KEYS`; all story fields rehydrate | 42826 | 4f6481c32c803f4c7656f824120fa0e2c44521ae00b6d62093c3e686abccdb06 |
| tests/story-starters.test.js | **new** (144 assertions) | 13920 | c673a5880472a3292d39c06850f42b46497a38fb6710a6d1a0ac4aa8c9e74ba9 |
| tests/creator-next-stage5.test.js | edited: the tooltip count includes `starterField` | 44385 | 901868607b0bf59aa5400de42cb4db1bdf68e62bb54e834aa62020bc0f1c6019 |
| tests/creator-test-notes-2-client.test.js | edited: the height pin is updated (still no slider, still free text) | 37900 | 97c70785ace1d28f287ab9f6faeab1d1f9ee06f93903bd200db87a528e558a0d |
| package.json / client/package.json | version 1.0.218 → 1.0.219 | 1398 / 427 | 279d84d7…8d3864 / b28cccdf…b7e99f |
| docs/pm/story-starters/BRIEF.md | **new** (the brief, placed) | — | d238120667efdcd3d75bc3433aa24a616b1fb0eb6d415d4080af66f751f90eca |

There are no migrations, and no species, size or theme data was changed. No existing helper or description was reworded. Four new lines of on-screen text were added: the three source lines and the alignment label's hover text (Decision 7).

## What was built (in play)

- **Personality, Ideals, Bonds and Flaws** show the starters written for the character's theme. An Acolyte sees nine personality starters, an Urchin sees different ones. Each starter shows the alignment it was written for, as a label rather than a limit. The player picks one with a radio button, or chooses "Other — write your own". Choosing Other keeps any starter already picked in the box, so the player can edit it into their own words. With no theme picked yet, the field is the plain text box it always was.
- **Backstory** lists the theme's eight moments as tick-boxes above the usual free-text box. Ticking a moment adds it to the backstory as its own line; unticking removes just that line. Anything the player wrote is never touched.
- **Age, Height, Weight, Build, Eyes, Hair and Skin** become drop-downs of the species' suggestions, with "Other… (type your own)" at the bottom.
  - A Small human gets no height or weight list, because the data only describes Medium humans. Those two stay free text; age, eyes and the rest still show.
  - A gnome, or a character of mixed ancestry, keeps free text for all seven.
- **Organizations, Allies, Enemies and Other notes** are unchanged.
- **Every list shows a one-line source note** saying the starters were written or compiled for this game and are not book text.
- **Resume and edit now bring everything back.** Picks, written text and ticked moments return exactly as saved. Before this job, every story field except Faith came back blank.

## Test results

**Full `npm test`: 264/264 files green, 20,374 assertions passed, 0 failed.**

- Three files show as `pass*`: item-3a-world-ids, item-3b-turn-ledger and npc-bank-wiring. libSQL's native exit crash hit them on Windows after all their assertions passed, so the runner counted them green (`server/scripts/run-tests.js`).
- Two more were retried once after a Windows native crash mid-run, and both passed: creator-gaps-batch and creator-test-notes-20-snake-case-skills.
- spellbook-routes passed in 5.0 s, so the brief's timeout warning didn't come up.
- The client build (`npx vite build`) is clean.

| Suite | Result |
|---|---|
| `story-starters.test.js` (new) | 144/144 |
| `creator-next-stage5.test.js` | 177/177 |
| `creator-next-stage5-validation.test.js` | 188/188 |
| `creator-round-3.test.js` | green |
| `creator-test-notes-2-client.test.js` | green (1,117 checks) |
| `theme-content-data.test.js` | 1,557/1,557 |

**What the new suite checks:**

- **Inventory:** every file counted (189 / 136 / 126 / 106 / 168, and the 10 species), and every theme id is a live theme.
- **Driver filtering:**
  - the theme gets only its own starters, and no theme means no list;
  - a species gets its own list, with no fallback to Human for an unknown species (goliath);
  - mixed ancestry gets no lists;
  - a Small human loses height and weight but keeps eyes and age;
  - a halfling, usually Small, gets its ranges;
  - the four no-set fields get no list.
- **Free text survives on all 11 single-pick fields:** a listed value shows as the pick, the player's own words show as Other verbatim, and a blank stays blank. An edited starter counts as the player's own words.
- **Backstory:** ticking and unticking moments keeps the player's own lines.
- **Stage 5 wiring** (source checks).
- **Blank tolerance** in the save body.
- **Round trip on a real test database through the real character routes:**
  - save a pick, a written ideal, a blank bond, a ticked moment plus text, and species picks;
  - read the character back and rehydrate it as a resume does;
  - each field shows as pick, Other or blank correctly;
  - a later edit keeps the earlier picks.
- **Review** lists all 19 fields and prints each value as stored.

**My first runs had two red files**, both older pins on Stage 5's source:

- **`creator-next-stage5`:** a tooltip count looked only for the old text-box helper. The new helper renders the same help line, so it now counts too. The floor is unchanged.
- **`creator-test-notes-2-client`:** a pin said "height is still free text". It came from the round-2 rule that height has no slider and doesn't change size or speed. It now checks that height is a flavor list with free text beside it, and the "no slider" check is untouched.

Neither was weakened; both are listed under Decision 8.

## Cost and usage

I can't measure this session's cost or the remaining usage from inside Claude Code. That is unverified.

## Not done / still open

1. **Item 6, the hand check at :5173, is unverified.** I have no browser to drive in this session. The steps are below.
2. **`themeNarrativeContinuity.js` stays orphaned.** It is Stage 4 (Class & Calling) copy with no story field to go on, and the calling question is out of scope.
3. **Appearance data has gaps for:**
   - Gnome, an MVP species;
   - Small humans' height and weight;
   - mixed ancestry.

   These stay free text; no ranges were invented.
4. **The appearance data's own helper** `getRaceDemographics` falls back to Human for an unknown species. I didn't use it, because that fallback would show human ranges for a gnome. The helper itself is unchanged; nothing else calls it.
5. **The MVP-only UI strip** hasn't been built; see Understanding point 2.

## Decisions made (reversible, for veto)

1. **How the lists look.** Theme starters are radio buttons with the full text, because they are one to three sentences each and a drop-down would cut them off. Species suggestions are a drop-down, matching Stage 1's region picker. *Reversal:* the `starterField` helper in `Stage5GearStory.jsx`.
2. **What "Other" does.**
   - On the theme lists, Other keeps whatever is in the field, so a picked starter can be edited.
   - On the species drop-downs, Other clears the field, exactly like Stage 1's region and arrival pickers.

   *Reversal:* one line each.
3. **Alignment is shown, not filtered.** Each starter's alignment tag is a visible label. A Lawful Good character still sees every starter for their theme. *Reversal:* filter the list by the chosen alignment (a small change in `storyStarters.js`).
4. **Size rule.** Height and weight lists show only when the character's size matches the species' usual size. "Not picked yet" counts as the usual size, which is Stage 1's own rule. *Reversal:* data-free, one function.
5. **Backstory moments live in the backstory text,** one per line, so there is no new column, and resume re-ticks them by matching the line. A player who edits a moment's wording has made it their own words, so its box un-ticks. *Reversal:* revert the moments block.
6. **Fix-as-you-find: rehydration.** All 19 story columns are now read back on resume and edit; only Faith was before. This is what makes "a pick survives a resume" true. *Reversal:* the loop in `rehydrateStateFromServerRow`.
7. **Four new on-screen lines,** written by me. They are not story starters and not rewording of any helper:
   - the source note for theme starters;
   - the source note for species suggestions;
   - the source note for backstory moments;
   - the alignment label's hover text, "The alignment this starter was written for — a guide, not a limit".

   *Reversal:* edit the strings in `storyStarters.js` and `Stage5GearStory.jsx`.
8. **Two older test pins were updated** (see Test results). *Reversal:* `git revert` the two test edits, which would go red against the new Stage 5.

## Needs Zach's decision

1. **Should Stage 5 keep the appearance suggestions, given they can't be checked against the 2024 book?** The age, height, weight, build, eye, hair and skin lists come from `raceColorTraits.js` and `raceDemographics.js`. Their headers say they were compiled from the older books (a "PHB Chapter 2" race chapter, Volo's Guide, Eberron, Mordenkainen's Tome of Foes). I checked `docs/pm/` and the repo, and the 2024 Player's Handbook's species chapter isn't on the PC. So I can't tell whether the 2024 book states anything (sizes, heights, lifespans) that these lists contradict. They are on screen now, labelled "not 2024 book text", with free text beside them. If you want them checked first, the 2024 species pages, photographed or transcribed into the repo the way the spell chapter was, would let a follow-up job do it. If you'd rather not show them until then, I can switch the seven appearance fields back to plain text boxes; that's a one-line change.

The gate itself is yours as always.

## How to verify

- **Commit:** `8e6cfe7` on `phase-4-hybrid-combat`, pushed. The repo is `E:\DnD Meta Game\dnd-meta-game`. This report is committed after it.
- **Gate:** `npm test`. Expect 264/264 green, with `story-starters.test.js` at 144/144.
- **In the browser at :5173 (never :3000), with `npm run dev`:**
  1. Create a new character: species **Dwarf**, any class, theme **Acolyte** on Stage 3. Go to Stage 5.
  2. Under **Personality traits**, nine Acolyte starters are listed with alignment labels, plus "Other — write your own". Pick the first one.
  3. Under **Ideals**, choose "Other — write your own" and type `I keep my word, even when it costs me.`
  4. Leave **Bonds** untouched (blank).
  5. Under **Backstory**, tick the first moment. It appears as a line in the text box; type a line of your own above it.
  6. Under **Eyes**, the drop-down lists the dwarf colors (Brown, Hazel, Dark Brown, Gray, Amber, Green) plus "Other… (type your own)". Pick Hazel.
  7. Go to **Review** (Stage 6). The story section shows the picked personality starter word for word, your own ideal, no Bonds line, the backstory with both lines, and "Eyes: Hazel".
  8. Leave the creator and resume this draft from the roster. Back on Stage 5:
     - the personality starter is still selected;
     - the ideal shows under Other with your text;
     - Bonds is blank;
     - the moment is still ticked;
     - Eyes shows Hazel.
  9. For the size rule, start a **Human** and pick **Small** on Stage 1. On Stage 5, Height and Weight are plain text boxes, while Eyes and Age still offer lists.
