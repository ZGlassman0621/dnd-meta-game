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
- **Item 5 lands mostly on Warlords.** At level 1, the only subclasses a player chooses are the 8 Warlord "Presences", and the registry lists all 8 as outside the Forgotten Realms ("KibblesTasty, setting-neutral"). Wiring the rule meant every new Warlord had to write a subclass origin explanation. I built it as the brief stated and flagged it. **Zach ruled on 2026-11-12: "a class is a class."** No subclass, from any setting, needs an origin explanation. The requirement is now removed (see the follow-up commit under Verification evidence).
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

**5. Subclass rules enforced at commit: BUILT, then narrowed by Zach's ruling.**
- *As first built:* a subclass from outside the Forgotten Realms needed an origin explanation, through a Stage 2 "Subclass origin" box, a Review check, a server refusal and a DM-prompt line.
- *After Zach's ruling (2026-11-12, "a class is a class"):* the box, the Review check, the server refusal and the DM-prompt line are removed. A Warlord, or any outside-Realms subclass, commits with no explanation. The Stage 2 note under a subclass still says where it comes from (" · origin Eberron (Khorvaire)") but no longer says an explanation is required. That note was already false before this job.
- **Still enforced:** the subclass must exist, and its selection level uses the character's real level. So an edited level-5 character with a level-3 subclass passes, and a level-1 draft that sends a level-3 subclass gets one refusal line, not two.
- The column `characters.subclass_origin_explanation` (**migration 114**) stays, unused. Its save, resume and commit plumbing still works but no stage fills it, and nothing prints it. It's kept for the proposed "calling" field below. Dropping a column would need its own migration.
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
  - The Warlord test first checked the refusal and then committed with an explanation. After Zach's ruling, it commits with no explanation.
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
2. **Subclass explanation is a new column (migration 114), not stored in the subclass choices.** Reason: the subclass choices are validated against each subclass's declared keys and would refuse it. After Zach's ruling the column is unused but kept, because the proposed "calling" field below can reuse it as is. Reversal: the column is additive and inert.
3. **Gold fork clears earlier package gear and armor.** This goes slightly beyond "add a Spellbook", but taking gold *instead of* a package shouldn't keep both. Reversal: a few lines.
4. **Pact fix included (fix-as-you-find-it).** Same defect type, same files.
5. **The extra-language pick is "needed", not "blocking", on Stage 1.** The player can move on and Review stops the commit, matching how the ancestry feat already works. Reversal: one word.
6. **Version bumped to 1.0.194 in both package files, with a CHANGELOG entry** (CLAUDE.md rule 5). The client had drifted to 1.0.183 and was re-aligned.

## Needs Zach's decision
None open.

**Q1 — RESOLVED by Zach, 2026-11-12: "No, a class is a class. It's just part of the character as a whole."** Zach confirmed that this covers every subclass, not just Warlords. The requirement is removed (item 5 above). This reverses the creator plan's §12 rule that "an outside-FR subclass needs an origin explanation". The character's own origin explanation (Stage 1, for a character from outside the Realms) is unchanged.

The question as originally put:
**Q1. Should every new Warlord have to write a subclass origin explanation?** The brief's rule is that a subclass from outside the Forgotten Realms needs one, and it was enforced. In the registry, all 8 Warlord subclasses are marked as from "KibblesTasty (setting-neutral)", meaning homebrew written for no particular world, which counts as outside the Realms. Warlord picks its subclass at level 1, so every new Warlord now sees a "Subclass origin" box and can't commit without filling it. The other options:
- **(a) Keep it:** every Warlord explains.
- **(b) Exempt "setting-neutral" subclasses:** a one-line change, about 15 minutes with tests.

No other class picks a subclass at level 1, so today this affects only Warlords.

## For Muse: proposed next brief
These came out of Zach's ruling. They aren't built, and are written up so Muse can scope them as briefs.

**1. Optional "calling" question on Stage 5 (Gear & Story).** Zach's idea (2026-11-12): let *every* player say why their character has their class and subclass ("that could be a fun thing to ask players for regardless").
- *Where:* Stage 5's Story section, next to personality traits, ideals, bonds, flaws and backstory.
- *Optional,* like the other Story fields. A blank answer prints nothing.
- *Builder's suggested wording, for Muse/Zach to settle:* label "Your calling: why this class (and subclass)?", placeholder "What drew you to this path? Who taught you, or what happened?"
- *Reach:* the DM prompt (as the player's words, canon) and the character sheet, next to the backstory.
- *Cheap:* migration 114's `subclass_origin_explanation` column and its save, resume and commit plumbing already exist and are unused, so no new migration is needed. Muse should decide whether the column name ("subclass origin") is close enough or worth a rename migration.
- *Watch:* today, changing class or subclass on Stage 2 clears that state field. A "calling" answer on Stage 5 probably shouldn't be wiped that way.

**2. Cleanup: the registry's own origin rule.** `subclassService.validateSelection` still treats an outside-Realms subclass with no explanation as "incomplete". The creator now ignores that half, so nothing enforces it. About 9 subclass test files (`subclass-scanned1`–`5`, `subclass-tier0`, `subclass-artificer`, `warlord-subclasses`) and comments in three data files (`fighter.js`, `spellshot.js`, `warden.js`) still describe the rule. Under CLAUDE.md rule 2 (delete outright) it should come out. That's a mechanical sweep across many files, so I left it for a brief rather than widening this change.

## How to verify
- **Gate:** on the Mac, `git pull origin phase-4-hybrid-combat`, then `npm test`. Migration 114 applies itself on first run.
- **At :5173 (`npm run dev`):**
  1. **Theme:** create a Soldier, pick Sergeant + Still in active duty, and commit. The sheet's Progression tab shows "Military Rank: Sergeant" and "Active Duty: Still in active duty".
  2. **Stale pick:** pick City Watch → Waterdeep, go back to Stage 1 and change the origin setting to Eberron, then return to Stage 3. The city pick is cleared and the field reads "Home Region".
  3. **Draft #1203:** resume it from the character list. Stage 1 shows the ancestry feat as still needed with the picker empty. Pick one, continue, then reload and resume again. The feat should still be picked.
  4. **Language:** create a Human and skip "Extra language" on Stage 1. Review lists "Stage 1 — Extra language is still needed". Pick one and Review clears it.
  5. **Spellbook:** create a Wizard and choose Gold on Stage 5. After commit, the inventory holds a Spellbook.
  6. **Subclass origin (after Zach's ruling):** create a Warlord and pick any Presence. The description reads "… · origin KibblesTasty (setting-neutral)", with no "required" wording and no "Subclass origin" box. Review raises nothing about it, and the character commits.
  7. **Fighting Style:** create a level-1 Fighter with Defense and gear package A (Chain Mail). The sheet AC is 17, and Features lists "Fighting Style: Defense".
  8. **Pact:** create a Warlock, pick Pact of the Chain, continue, then reload and resume. The pact is still picked.

## Verification evidence
- **Original build:** commit `6464cc2` ("Creation solidification: creation choices stick (v1.0.194)") on `phase-4-hybrid-combat`.
- **Follow-up for Zach's ruling (2026-11-12):** the commit that carries this revision of the report. A report can't contain its own commit hash, so the hash and this file's SHA-256 are in the handoff message.
  - Server: `server/routes/character.js` drops the subclass-origin refusal and stops passing an explanation to `validateSelection`; `server/services/dmPromptBuilder.js` drops the "Subclass origin" line.
  - Client: `Stage2ClassCalling.jsx` (box removed), `Stage6ReviewCommit.jsx` (Review check and error routing removed), `subclassOrigin.js` (`subclassNeedsOriginExplanation` deleted; the note loses its "required" wording), `stage1Persistence.js` (comments only).
  - Tests: `creation-solidification` (group 5 rewritten to the new rule: 72/0), `creator-next-stage6-commit` (the Warlord commits without an explanation: 368/0), `creator-test-notes-1-client` (suffix strings), all green individually. Client build succeeds.
  - **Full `npm test` on the PC after the follow-up:** Files **247/247 green**, assertions **19,556 passed, 0 failed**. That's 6 fewer than the 19,562 in the windows-test-portability run, because the 3 + 3 removed refusal checks in `creation-solidification` and `creator-next-stage6-commit` are gone. Windows-only notes from the runner: `human-2024` and `paladin-l1-cap` were retried once after a native crash and passed; `item-1a-picks-ammo-thrown-offhand` and `magic-item-discovery` counted as `pass*`. Zach's Mac run remains the gate; not claimed.
