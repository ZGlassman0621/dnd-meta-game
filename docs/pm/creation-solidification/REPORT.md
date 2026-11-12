# Report — creation-solidification: make creation choices stick

## Understanding

**The project.** DnD Meta Game is a solo D&D 2024 campaign app. A player builds a character in a 6-stage creator and then plays with an AI Dungeon Master. The server owns the rules (HP, spells, rest, gear, the clock). The AI narrates and makes changes through short tags in its replies.

**This job.** Everything a player answers in the creator should matter afterwards. That breaks down into six items:
1. Theme choices show on the sheet and to the DM.
2. A draft that lost its ancestry feat can re-pick it, and the pick sticks.
3. A Human or Half-Elf must pick their promised extra language before committing.
4. A wizard who takes gold still owns a spellbook.
5. The server enforces its own subclass rules at commit.
6. The Fighting Style picked in the creator actually works.

**Differences from the brief:** none that block. Four things the brief didn't anticipate:
- **Item 5 lands mostly on Warlords.** At level 1, the only subclasses a player chooses are the 8 Warlord "Presences", and the registry lists all 8 as outside the Forgotten Realms ("KibblesTasty, setting-neutral"). Wiring the rule means every new Warlord must write a subclass origin explanation. I built it as the brief states and flagged it for your veto below.
- **Draft #1203 itself isn't on this PC.** This PC has no database and no `.env`, so the draft is only in your Mac's database. I proved the re-pick path on an equivalent draft (the brief allows this). #1203 needs a quick check on the Mac (see How to verify).
- **Sibling defect fixed (fix-as-you-find-it):** the warlock Pact pick was never saved, the same "creation choice doesn't stick" problem. Details under item 5.
- **This PC can't produce an all-green run, for Windows-only reasons** that are unrelated to this job. Details under Test results. Your Mac run is the gate.

## Verdict
**BUILT + GREEN** on the builder's checks. Every test assertion passes. On the PC, 14 test files still show as red: 13 for Windows-only reasons (a crash on exit after all assertions pass, file locking, a Windows path) and 1 for a pre-existing random-roll flake. None of them comes from this job. Zach's Mac run is the gate. Not claimed.

## Files changed
Commit and hashes are under Verification evidence. Sizes are in bytes, Unix line endings.

| File | New / edited | Size |
|---|---|---|
| `server/migrations/114_subclass_origin_explanation.js` | **new, migration 114** | 1,430 |
| `client/src/components/creator-next/themeLocation.js` | new | 2,020 |
| `tests/creation-solidification.test.js` | new | 26,875 |
| `docs/pm/creation-solidification/BRIEF.md` | new (brief as handed over) | 10,907 |
| `docs/pm/creation-solidification/REPORT.md` | new (this report) | — |
| `server/routes/character.js` | edited | 430,930 |
| `server/services/themeService.js` | edited | 6,449 |
| `server/services/progressionService.js` | edited | 8,263 |
| `server/services/dmPromptBuilder.js` | edited | 189,637 |
| `client/src/components/CharacterSheet.jsx` | edited | 273,686 |
| `client/src/components/creator-next/CreatorNextShell.jsx` | edited | 23,828 |
| `client/src/components/creator-next/Stage2ClassCalling.jsx` | edited | 39,991 |
| `client/src/components/creator-next/Stage3PastPath.jsx` | edited | 32,229 |
| `client/src/components/creator-next/Stage6ReviewCommit.jsx` | edited | 55,121 |
| `client/src/components/creator-next/stage1Persistence.js` | edited | 39,996 |
| `client/src/components/creator-next/stage1Validation.js` | edited | 5,155 |
| `client/src/components/creator-next/subclassOrigin.js` | edited | 2,355 |
| `tests/creator-next-stage3.test.js` | edited | 47,527 |
| `tests/creator-next-stage6-commit.test.js` | edited | 90,261 |
| `tests/creator-test-notes-1-client.test.js` | edited | 20,597 |
| `tests/creator-test-notes-2-client.test.js` | edited | 36,329 |
| `tests/creator-test-notes-5-ancestry-feat-resume.test.js` | edited | 16,019 |
| `tests/spellbook-routes.test.js` | edited | 133,697 |
| `package.json`, `client/package.json` | edited (version 1.0.194, both) | 1,273 / 427 |
| `CHANGELOG.md` | edited (1.0.0.194 entry) | 714,612 |

## What was built (in play), per item

**1. Theme choices: BUILT.**
- The sheet's Progression tab and the DM prompt show labelled answers, e.g. "Military Rank: Sergeant · Active Duty: Still in active duty", "Guild Trade: …", "Home City: Waterdeep", "Region of Seclusion: …".
- Values print exactly as stored; a fixed-list option shows its display label ("sergeant" → "Sergeant"). The DM prompt marks them as canon.
- The stale-pick edge is fixed. If a player picks a home city and then changes their origin so that city is no longer offered, the pick is cleared and Review asks for a fresh one. Before, the box showed blank and the commit was refused.

**2. Draft #1203 re-pick: VERIFIED WORKING (no code change needed).**
- A draft saved without an ancestry feat can pick one on Stage 1. The next save writes the feat, and resuming the draft brings the pick back, so "Ancestry feat" leaves the "still needed" list. This is proven end to end on an equivalent draft, including the real client resume code.
- No pick was invented. Whether #1203 itself now re-picks has to be checked on the Mac (steps below).

**3. Extra language forced (R2-15): BUILT.**
- A Human or Half-Elf who hasn't picked their "one extra language of your choice" sees "Extra language" in Stage 1's still-needed list, and Review won't let them commit.
- If the server gets a commit without it anyway, it refuses with: "Human grants one extra language of your choice — pick it on Stage 1 (Extra language)", and the error's jump button opens Stage 1.
- Languages from feats (like Traveler's Tongue) don't count toward the species' promise.

**4. Gold-fork Spellbook: BUILT. It was missing.**
- A wizard who takes gold instead of a gear package now has a Spellbook in their inventory. A package wizard is unchanged (still exactly one book).
- Sibling fix: switching a draft from a gear package to gold used to keep the package's gear *and* give the gold. Package gear and package armor are now dropped. AC falls back to 10 + Dex, and items from other sources are kept.

**5. Subclass rules enforced at commit: BUILT.**
- A subclass from outside the Forgotten Realms needs an origin explanation. Stage 2 shows a "Subclass origin" box under the picker for those subclasses.
- Review and the server both refuse a commit without it. The refusal names the subclass, where it's from, and the legal alternative ("or pick a Forgotten Realms subclass"). The explanation reaches the DM prompt.
- Selection level uses the character's real level, so an edited level-5 character with a level-3 subclass passes. A level-1 draft that sends a level-3 subclass gets one refusal line, not two.
- New column: `characters.subclass_origin_explanation` (**migration 114**).
- **Sibling fix:** the creator sent the warlock Pact as `pact_boon` ("Pact of the Blade"), a field the server never reads, so the pick was never saved or resumed. It now sends the stored key (`pact: 'blade'`) and resumes from it.

**6. Fighting Style works: BUILT.**
- At commit, the chosen style is written into the character's feats list, which is what combat, AC and the DM prompt read.
- A Fighter with Defense in Chain Mail shows AC 17 (16 + 1), both on the sheet and in play, with no double count. Archery gives +2 to ranged attacks.
- The style is listed on the sheet (Features: "Fighting Style") and in the DM prompt's feats block.
- Re-committing in edit mode replaces the creator's style rather than stacking a second one. Styles from any other source are never touched.

## Test results
- **Final full `npm test` on the PC** (Unix line endings, matching the Mac): **Files 233/247 green, assertions 19,478 passed, 0 failed.**
- The 14 non-green files, each re-run individually or classified:
  - **Crash on exit after every assertion passed** (a Windows native-module crash, `UV_HANDLE_CLOSING` / exit 139): `creator-next-stage1-origin` 207/0, `downtime-rest` 31/0, `fresh-create-blank` 64/0, `spellbook-service` 316/0, `warlord-subclasses` 466/0, `newclass-warlord` (all passed), `artificer-class` 104/0, `dungeon-generation` 30/0, `exhaustion-2024` 57/0, `subclass-batch3` 142/0. The set changes from run to run.
  - **Windows file locking / path:** `migration-atomicity` and `migration-schema-contract` (EPERM deleting an open database file), and `catalog-gaps-otto-mansion-sword` (imports an `e:` path without a `file://` URL).
  - **Random-roll flake:** `mechanics-hooks-spellcast` failed one dice-dependent check ("Lyra had room"). It failed the same way in the baseline and passes 230/0 on re-run.
- **Baseline before any change:** 218/246 files, 26 failed assertions. Every failure was one of the Windows causes above, the flake, or line-ending-sensitive source checks.
- **Suites this job touched**, run individually:
  - `creation-solidification` (new): 75/0
  - `creator-next-stage6-commit`: 371/0 (was 368; +3 new checks)
  - `creator-test-notes-5-ancestry-feat-resume`: 27/0 (was 20; +7, group (e))
  - `creator-next-stage3`: 676/0
  - `creator-test-notes-1-client`: 155/0
  - `creator-test-notes-2-client`: 957/0
  - `spellbook-routes`: 494/0
  - `creator-next-stage6`: 297/0
  - `creator-next-stage5`: 177/0
  - `creator-next-stage4`: 631/0
  - `creator-gaps-batch`: 652/0
  - `progression-prompt`: green in the full run
  - Client build (`npx vite build`): succeeds.
- **Existing tests updated, all to the new rules, none loosened:**
  - Human / Half-Elf test characters gained their extra language ("Giant").
  - The Warlord test now checks the refusal first, then commits with an explanation.
  - Two tests that pinned the broken `pact_boon` field now check the `pact` key.
  - Three source-text checks followed the location logic into `themeLocation.js`, and still require Stage 3 to use it.
- **To run the client-bundle suites on Windows**, I copied `esbuild.exe` into `client/node_modules/.bin/`. That folder is untracked, so nothing in the repo changed.

## Cost and usage
I can't measure it from inside the session. `/usage` in Claude Code shows standing against the $30/month cap. This job made no billed API calls from the app; the LLM test is excluded by default.

## Not done / still open
- **#1203 itself:** not checked. It lives in the Mac's database and isn't on this PC. The steps are below.
- **Paladin 2 / Ranger 2 Fighting Style at level-up:** not built, as the brief directs (class-audit ground). A style picked through edit mode's level-2 picker reaches `feats` on commit through the same path.
- **Edit-mode AC edge:** an edit-mode commit doesn't re-derive gear, so changing the style to or from Defense there updates `feats` and in-play AC but not the stored sheet AC. Rare, and left as a known edge.
- **Changeling's "Two extra languages":** the client counts this as one pick slot. Changeling is deferred in the MVP, so this wasn't built.
- **Found, not fixed (out of scope):** both `package-lock.json` files are stale. The root lockfile still lists `bcryptjs` and `jsonwebtoken` (removed in v1.0.173), and the client lockfile still says version 1.0.0. `npm install` rewrote them on the PC; I reverted that. A small cleanup job.
- **Found, not fixed:** the test suite isn't Windows-portable. The causes are listed under Test results. That only matters if the PC is ever meant to run a gate.

## Decisions made (reversible, for veto)
1. **Fighting Style mechanism: written into `feats` at commit.** The other option was teaching the engine to read the `fighting_style` column. Reason: every consumer (attacks, AC, prompt) already reads `feats`, and level-up feats live there too. Reversal: delete the commit block and read the column in three places, about half a day.
2. **Subclass explanation is a new column (migration 114), not stored in the subclass choices.** Reason: the subclass choices are validated against each subclass's declared keys and would refuse it. Reversal: the column is additive and stays inert if unused.
3. **Gold fork clears earlier package gear and armor.** This goes slightly beyond "add a Spellbook", but taking gold *instead of* a package shouldn't keep both. Reversal: a few lines.
4. **Pact fix included (fix-as-you-find-it).** Same defect type, same files.
5. **The extra-language pick is "needed", not "blocking", on Stage 1.** The player can move on and Review stops the commit, matching how the ancestry feat already works. Reversal: one word.
6. **Version bumped to 1.0.194 in both package files, with a CHANGELOG entry** (CLAUDE.md rule 5). The client had drifted to 1.0.183 and was re-aligned.

## Needs Zach's decision
**Q1. Should every new Warlord have to write a subclass origin explanation?** The brief's rule is that a subclass from outside the Forgotten Realms needs one, and it's now enforced. In the registry, all 8 Warlord subclasses are marked as from "KibblesTasty (setting-neutral)", meaning homebrew written for no particular world, which counts as outside the Realms. Warlord picks its subclass at level 1, so every new Warlord now sees a "Subclass origin" box and can't commit without filling it. The other options:
- **(a) Keep it:** every Warlord explains.
- **(b) Exempt "setting-neutral" subclasses:** a one-line change, about 15 minutes with tests.

No other class picks a subclass at level 1, so today this affects only Warlords.

## How to verify
- **Gate:** on the Mac, `git pull origin phase-4-hybrid-combat`, then `npm test`. Migration 114 applies itself on first run.
- **At :5173 (`npm run dev`):**
  1. **Theme:** create a Soldier, pick Sergeant + Still in active duty, and commit. The sheet's Progression tab shows "Military Rank: Sergeant" and "Active Duty: Still in active duty".
  2. **Stale pick:** pick City Watch → Waterdeep, go back to Stage 1 and change the origin setting to Eberron, then return to Stage 3. The city pick is cleared and the field reads "Home Region".
  3. **Draft #1203:** resume it from the character list. Stage 1 shows the ancestry feat as still needed with the picker empty. Pick one, continue, then reload and resume again. The feat should still be picked.
  4. **Language:** create a Human and skip "Extra language" on Stage 1. Review lists "Stage 1 — Extra language is still needed". Pick one and Review clears it.
  5. **Spellbook:** create a Wizard and choose Gold on Stage 5. After commit, the inventory holds a Spellbook.
  6. **Subclass origin:** create a Warlord and pick any Presence. A "Subclass origin" box appears under it, Review blocks until it's filled, and it commits once filled.
  7. **Fighting Style:** create a level-1 Fighter with Defense and gear package A (Chain Mail). The sheet AC is 17, and Features lists "Fighting Style: Defense".
  8. **Pact:** create a Warlock, pick Pact of the Chain, continue, then reload and resume. The pact is still picked.
