# Report — full-codebase-audit: what we'd have to go back and fix

## Understanding

**The project.** DnD Meta Game is a solo D&D 5e (2024 rules) campaign app. A player builds a character in a 6-stage creator, then plays with an AI Dungeon Master (Claude). The AI tells the story, and short tags it writes into its replies ("markers", like `[LOOT_DROP: …]` or `[HP_CHANGE: …]`) make real changes to the saved game. Players roll their own attack and damage dice. The server owns the player's HP, death saves, rests, spells, inventory and the world clock. Companions, NPCs, loot, merchants and dungeons hang off that loop. The MVP is adventuring and core play. Prelude, full downtime, fortress, Mythic and legacy are switched off or deferred.

**This job.** A read-only audit of the MVP systems. It lists everything broken, half-built, unwired, or wrong against the 2024 book, ordered by severity, each with file + line evidence, so the next fix jobs go in the right order. No code, data or tests changed.

**Differences from the brief:** none that block. Three notes:
- The PC copy was on stale `main`. I switched it to `phase-4-hybrid-combat` before starting. The working tree was clean, and nothing was lost.
- The creation-solidification brief's claims check out against the live code. `validateSelection` exists at `server/services/subclassService.js:286` with no callers, and the client collects no *subclass* origin explanation. Stage 1 collects the *character's* origin explanation (`Stage1OriginIdentity.jsx:996-1018`), which is a different field. Two findings here (S3 Fighting Style, M1 story prompts) are the same "creation choice doesn't stick" shape and could join that job (see Proposed fix order).
- `CLAUDE.md` lists "characters.campaign_id is not set at creation" as known debt. It is still live and is finding S1.

## Verdict
**AUDIT COMPLETE.** Read-only. 3 severe, 4 high, 2 medium, 6 lower findings. No code, data or test files changed.

## Files changed
All new. They are documentation only, with no code, data or tests:

| File | Status | Size |
|---|---|---|
| `docs/pm/full-codebase-audit/REPORT.md` | new (this report) | see Verification evidence |
| `docs/pm/full-codebase-audit/BRIEF.md` | new: the brief as handed over, placed where its Setup section says | see Verification evidence |
| `docs/pm/HANDOFF.md` | new: the handoff doc, placed where its "Where things live" section says | see Verification evidence |

## What was built (in play)
Nothing. The player experiences no change.

## Test results
N/A for a read-only audit. I did not run `npm test`, and `node_modules` is not installed on the PC copy. No gate is claimed.

## Cost and usage
I can't measure it from inside this session. Zach can see plan usage against the $30/month cap with `/usage` in Claude Code. The session was mostly code reading plus a few small local scan scripts (kept in the session scratchpad, not the repo), and made no billed API calls from the app.

---

## Findings (severity order)

Severity key: **Severe** means a player can reach it in MVP play and it breaks a promised behaviour. **High** means reachable and wrong against the book or a built feature, but play continues. **Medium** means promised content or polish is lost. **Lower** means dead code or hygiene with no player impact today.

### SEVERE

**S1. A character with no campaign plays on, but has no session memory, can't shop, and moves every other character's clock.**
- Evidence: after creation the client *suggests* making a campaign (`client/src/App.jsx:228-238`), but the nav "Play" entry is always available (`client/src/components/NavigationMenu.jsx:43`). Session start only adds world context `if (character.campaign_id)` (`server/routes/dmSession.js:802-876`). Session end refuses to write the chronicle without a campaign (`server/services/storyChronicleService.js:64-70`). Merchant shop returns 404 "No campaign found for this character" (`server/routes/dmSession.js:2675-2677`). With no campaign the clock is the shared global row, and every advance is copied onto *all* characters in the database (`server/services/scheduleService.js:70-73`, called at :102/:116/:127/:144).
- In play: a player who clicks Play instead of New Campaign gets an adventure with no chronicle. Leave and come back, and the DM has no record of past sessions. Shops fail. Their rests and travel advance the date on every other character.
- Fix job: guarantee a campaign at commit (auto-create or attach), or block Play until one exists. Hand the persistence half to the return-loop suite job.

**S2. Damage taken while at 0 HP does nothing, so a downed player can't be killed by attacks.** *(Zach 2026-11-12: no massive-damage instant death, "we're always doing death saves". Whether a hit while downed counts as a failed save is still open, Q3b.)*
- Evidence: `server/services/characterHpService.js:62-100`. Damage clamps HP at 0. The only counter changes are on dropping to 0 (reset) or rising above 0. Searching `server/services` and `server/routes` finds no other place that adds a failure on damage (failures only increase on rolled saves, `:193-200`), and no massive-damage rule anywhere.
- In play: 2024 rules say damage at 0 HP is one death-save failure (two on a critical hit), and damage that leaves at least your HP maximum remaining kills outright. Here a downed player can be stabbed repeatedly with no effect, and an overwhelming hit only knocks them unconscious. The rolled saves themselves are correct: nat 1 counts two failures, nat 20 gives 1 HP (`:175-200`).
- Fix job, if Q3b is yes: on a negative `HP_CHANGE` at 0 HP, add one failure (two for a crit, which needs a crit flag on the marker). Do not build massive damage (Zach 2026-11-12). If Q3b is no, S2 closes as working as intended. Companion path: not verified (the companion route only rolls saves, `server/routes/companion.js:1075-1110`), so check it in the same job.

**S3. The Fighting Style picked in the creator does nothing: not in combat, not on the sheet, not in the DM prompt.**
- Evidence: the creator saves the pick to the `fighting_style` column only (`server/routes/character.js:5058-5062` commit, `:4549` PUT, client `stage1Persistence.js:102`). The engine reads styles from the `feats` list: attack bonuses at `server/services/partyAttackService.js:355` via `classFeatureService.js:179`, and Defense AC at `server/services/combatStatsService.js:242`. Nothing in `server/services`, `dmPromptBuilder.js` or `CharacterSheet.jsx` reads `fighting_style` (searched). Level-up has no Fighting Style handling at all (no match in `character.js:6482-7788` or the level-up page).
- In play: a Fighter who takes Archery gets no +2 on ranged attacks. Defense gives no +1 AC. The choice isn't shown anywhere. Paladin 2 and Ranger 2 (2024) never get offered a style. The level-up half is a **possible class-audit overlap**.
- Fix job: at commit, write the style into `feats` (or have the engine read the column), and show it on the sheet and in the prompt. Fits the creation-solidification goal.
- Verify at :5173: create a level-1 Fighter with Defense in chain mail. Sheet AC should be base +1, but it won't be.

### HIGH

**H1. Several built systems can never fire, because the AI is never told their markers exist.**
- Evidence: the handlers are registered and imported, but the marker text appears only in code comments, never in any prompt (I searched all of `server/` and `client/src`, including non-JS files):
  - Dungeon generation `GENERATE_DUNGEON`: handler `server/services/dungeonGenerationService.js:245`, comment-only usage at `:240`.
  - Scene rooms `SET_ROOM`: `server/services/sceneLinkService.js:169`, comment at `:163-164`.
  - Place evolution `EVOLVE_PLACE`: `server/services/timeEvolutionService.js:296`, comment at `:290`.
  - Cold exposure `COLD_SCENE` / `COLD_WET`: `server/services/coldExposureService.js:568`. Exposure only runs once a cold scene is set (`:505-509`).
  - Lair durability `LAIR_*`: `server/services/lairDurabilityService.js`.
  - Enemy display spells `ENEMY_DISPLAY`: `server/services/displayService.js:450`.
  - Class and subclass features: `HEROIC_REROLL`, `BEND_LUCK`, `TIDES_OF_CHAOS`, `PRESERVE_LIFE`, `TAMED_SURGE`, `TELEPATHIC_SPEECH`, `AWAKENED_MIND`, `HOUND_OF_ILL_OMEN`, `ACCURSED_SPECTER`, `FAITHFUL_SUMMONS` (`server/services/subclassMarkerService.js:369-450` region, imported at `server/routes/dmSession.js:70-78`), and `ARTIFICER_REPLACE_PLAN` / `ARTIFICER_ATTUNE` / `ARTIFICER_RIGHT_TOOL` / `ARTIFICER_RELEASE` (`server/services/artificerService.js:684` and family).
  - The handlers are imported for their side effects at `server/routes/dmSession.js:44-68`.
- In play: dungeons and scene rooms never generate from play, cold weather never bites, and features like Wild Magic's Tides of Chaos, Bend Luck, Preserve Life and Heroic Inspiration rerolls never resolve mechanically. The DM narrates them freehand at best. The subclass and artificer part is a **possible class-audit overlap**, the same shape as the known `learnPlan` example.
- Fix job: add each marker's instruction to the DM prompt (the mechanical-markers section, or the per-feature subclass prompt lines), with a prompt-contains test per marker. Attunement (`ATTUNE` / `UNATTUNE`) is already taught via `attunementService.js:217` and needs no fix.

**H2. A long rest gives back only half your Hit Dice, which is the 2014 rule.** *(CONFIRMED by Zach 2026-11-12: a long rest regains all spent Hit Point Dice.)*
- Evidence: `server/services/restTimeService.js:166-181` ("recover half your total dice, minimum 1"). Used for the player (`:378`), companions (`:603`) and downtime rests (`:814`).
- In play: as I read the 2024 PHB, a long rest regains **all** spent Hit Point Dice. Under this code a player who spends dice across a few days runs dry faster than the book allows.
- Fix job: regain all spent dice on all three paths, and update `tests/rest-time.test.js`.

**H3. Prepared-spell caps for Bard, Cleric, Druid and Wizard use the 2014 formula (ability modifier + level), not the 2024 class tables.** *(CONFIRMED 2026-11-12 from photos of Zach's 2024 PHB class tables; possible class-audit overlap.)*
- Book values (2024 PHB, Chapter 3, "Prepared Spells" column of each class's Features table, read from Zach's photos 2026-11-12; Cleric table on p. 70):

  | Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Bard, Cleric, Druid | 4 | 5 | 6 | 7 | 9 | 10 | 11 | 12 | 14 | 15 | 16 | 16 | 17 | 17 | 18 | 18 | 19 | 20 | 21 | 22 |
  | Wizard | 4 | 5 | 6 | 7 | 9 | 10 | 11 | 12 | 14 | 15 | 16 | 16 | 17 | 18 | 19 | 21 | 22 | 23 | 24 | 25 |

  Example of the error: a Cleric with +1 Wisdom at level 1 should prepare 4, and the game allows 2. A level 20 Cleric with +5 Wisdom should prepare 22, and the game allows 25.
- Evidence: `server/services/bardService.js:54`, `clericService.js:29`, `druidService.js:33`, `wizardService.js:54`. The comments in bard and wizard call this "2024 PHB formula". The client mirrors it at `client/src/components/CharacterSheet.jsx:740-744`. By contrast Paladin (`paladinService.js:49-57`), Ranger, Warlock and Sorcerer already use the 2024 Prepared Spells column, and the sorcerer comment notes the column "does not equal Cha mod + level" (`CharacterSheet.jsx:762-766`). The codebase is half-migrated.
- In play: the number of spells these four classes can prepare is wrong against the book at many level and stat combinations, sometimes too many and sometimes too few. The server and sheet agree with each other, so nothing looks broken.
- Fix job: move these four to table lookups on both sides (server services + `CharacterSheet.jsx`), using the book values above. Artificer's modifier + half-level is a recorded Zach ruling (`artificerService.js:112-118`) and is not flagged.

**H4. A Spellshot (a playable MVP class) gets no spell section on the sheet, and the sheet's "Known Spells" section can never render for anyone.**
- Evidence: Spellshot's `spellcasting.spellsKnown` in `client/src/data/classes.json` is a per-level list of numbers. The sheet only shows a spell section when that value is the text `'All prepared'` / `'Spellbook'` (`CharacterSheet.jsx:785-790`, section at `:2764`) or `'Limited known'` (`:793-795`, section at `:3740`). `'Limited known'` appears nowhere in the data (searched), so this is the brief's known example and it is still present. Spellshot isn't deferred (`server/services/classValidationService.js:67` defers only magus, blackguard, scholar). The server does gate Spellshot spells (`spellSelectionService.js:104-107`). Warden's casting subclasses look likely to have the same gap, since Warden has no `spellcasting` block, but I haven't verified it.
- In play: a Spellshot's chosen spells are invisible on the sheet and can't be managed there.
- Fix job: add a Spellshot (and Warden caster) known-spells branch, and retire or repoint the dead "Limited known" gate. **Possible class-audit overlap.**
- Verify at :5173: create a Spellshot and level to 2+. The sheet shows no Known or Prepared Spells section.

### MEDIUM

**M1. The creator's curated story starters are orphaned. About 1,500 lines of theme-specific content never reach the player.**
- Evidence: `client/src/data/themePersonalityPrompts.js`, `themeIdealsPrompts.js`, `themeBondsPrompts.js`, `themeFlawsPrompts.js` and `themeBackstoryMoments.js` (21 themes each) are imported only by `tests/theme-content-data.test.js`. Nothing at all imports `raceColorTraits.js`, `raceDemographics.js` (per-species eye/hair/skin, age/height/weight pickers) or `themeNarrativeContinuity.js`. They were written for the old creator's Step 7. The new Stage 5 story fields (`creator-next/Stage5GearStory.jsx`) don't use them.
- In play: blank text boxes where clickable, theme-matched personality, ideal, bond, flaw and backstory starters, plus species-aware appearance pickers, used to be.
- Fix job: wire them into Stage 5, or delete them (CLAUDE.md rule 2). That's a PM scope call, with my recommendation under Decisions.

**M2. Validators built but called by nothing (beyond the known `validateSelection`).**
- `validateSelection` (`server/services/subclassService.js:286`): already creation-solidification item 5, so it's an **overlap** and not re-counted here.
- `originFeatFor` (`server/services/themeService.js:56`): only tests call it. The creator resolves origin feats a different way, so I found no player impact. Confirm or delete.
- `validateSpellSelection` (`server/services/spellSelectionService.js:434`): an unused wrapper. The per-spell gate it wraps, `canLearnSpell`, *is* wired (`character.js:1190, 2324, 4328, 5406, 5746, 5960`). No player impact, so delete.

### LOWER

- **L1. 28 legacy marker detectors.** The `detect*` functions in `server/services/dmSessionService.js:75-815` were replaced by the marker pipeline and only tests call them. That leaves two apparent parsers, the exact confusion CLAUDE.md rule 2 warns about. Fix: delete them and their tests.
- **L2. Uncalled helpers.** `eventEmitter.js`: 12 `emit*` wrappers with no callers (events go through `on()` directly; companion triggers are wired, see below). `narrativeQueueService.js`: 9 functions. `companionBackstoryService.js`: 12 functions (`getLoyalty`, `addSecret`, `checkThreadTriggers` and others). `consequenceService.js`: `getUndeliveredConsequences` and `markConsequenceDelivered` are tests-only. I did *not* verify whether consequences reach the player another way, so that one is **unverified** and worth a look in the return-loop job.
- **L3. Dead UI and duplicates.** `client/src/components/CompanionManager.jsx` is imported by nothing. `companionSheetService.getCompanionSheet` has no callers. `npcVoiceService.formatVoicePaletteForPrompt` has no callers because the prompt builder keeps its own copy (`dmPromptBuilder.js:423`).
- **L4. Duplicated rules tables.** The prepared-spell tables live in both client (`CharacterSheet.jsx:767-779`) and server services. Today they agree, but there's a risk they drift.
- **L5. Data hygiene.** The spell catalog labels one book two ways ("Spelljammer" and "Spelljammer: Adventures in Space", in `server/data/spellCatalogData.js`). Proposed weapons in `server/data/armsArmorVariants.js:269-309` carry `mastery: 'TBD'`, but they're staged and unreachable (only their own file reads them), so there's no impact today.
- **L6. Unused endpoints.** These server endpoints have no client caller: the 4 character-quest routes (`character.js:7861-7916`), all 8 `story-threads` routes, and 10 of the 19 `location` routes. Most are AI-driven or post-MVP. Prune them in a cleanup job.

---

## Checked, no findings

- **Routing:** all 38 route files are mounted in `server/index.js:96-133`, and every `/api/...` URL in the client resolves to a mounted route (0 mismatches).
- **Marker wiring:** 125 schemas and 105 handlers, and every handler service is imported. The three schema-only markers are handled inline by design: `ADD_ITEM` via `MERCHANT_SHOP` (`dmSession.js:2371`), `NPC_WANTS_TO_JOIN` via recruitment (`:2212-2230`), and `SWIM` (`markerSchemas.js:765`). The gap is prompt teaching (H1), not wiring.
- **Loot discovery:** `LOOT_DROP` is wired (`dmSession.js:31-33`, `:2404-2418`), as are item reveal and identify (`:34-36`).
- **Companions and NPCs:** recruitment works. Companion backstory triggers start at boot (`server/index.js:83`) and fire at session end (`dmSession.js:3620-3624`). NPC voice palettes reach the prompt (`dmPromptBuilder.js:499`).
- **Registries:** 583 spells with no duplicates or near-duplicates, every field filled, and every class tag a real class. 29 species (11 live, 18 deferred). 181 subclasses with no duplicates within any class. Counts match the brief.
- **TODO / placeholder sweep:** 10 markers in all. The only stubs are session-end domain turns and digest (`sessionEndService.js:86, 98`), which are post-MVP.
- **Tests:** 247 test files. Only `prose-quality` (billed, excluded by design) and `prelude-auto-model` (post-MVP) have fewer than 3 assertions.
- **Rest (other than H2):** Arcane Recovery, Memorize Spell, warlock pact slots, exhaustion step-down and concentration ending are all handled (`restTimeService.js:368-581`).
- **Creator commit:** nothing is written before `validateCreatorNextStage6` passes (`character.js:4968-4969`).

**Covered lightly, not cleared:** per-attack combat math, dungeon generator internals, edit mode, draft resume, and per-class level-up features (the class audit's ground). No findings came up in those areas, but the depth there was spot-check, not line-by-line.

## Deferred, not defects

- The 21 prelude-only markers have no handlers. Prelude is off, and `client/src/config/mvpFeatures.js` (`PRELUDE_ENABLED=false`) is deliberately read by nothing.
- Mythic (20 of 21 routes unused by the client), party base / fortress, DM-mode bond shifts, and session-end domain/digest stubs: all post-MVP.
- Staged data banks with no wiring by design: `server/data/gearItems.js`, `kalas.js`, `quickThreats.js`, `towers.js`, `villainTemplates.js`, `guilds.js`, `client/src/data/preludeSetup.js`.
- The 18 deferred species. Magus, Blackguard and Scholar are grayed out. When Blackguard returns, note that its `spellsKnown` text ("Prepared: Cha mod + half level…") matches neither sheet gate, the same shape as H4.

## Proposed fix order

1. **S1 (campaign at creation).** This is the biggest blast radius, and the return-loop suite needs it fixed first. It's a small job: attach or create a campaign at commit, or gate Play.
2. **S3 (Fighting Style), folded into creation-solidification.** It's the same "make creation choices stick" goal and the same files (`character.js` commit, sheet, prompt). Consider adding M1 too, if the wire-it-in call stands.
3. **S2 (damage at 0 HP), only if Zach answers yes to Q3b.** A small, self-contained HP-service job with tests. No massive damage.
4. **H1 (teach the AI its markers).** Prompt-only edits plus prompt-contains tests. Dungeon, scene and cold first, then the class-feature markers (reconcile with the class audit).
5. **H2 + H3 as one "2024 rules corrections" job.** It's unblocked: Zach confirmed the Hit Dice rule and supplied the table values (2026-11-12).
6. **H4 (Spellshot / Warden sheet spells).** Reconcile with the class audit first.
7. **Lower items (L1-L6) as one cleanup job.** Delete legacy and dead code after the next gate. None of it blocks play.

## Not done / still open

- I didn't trace every class's level-up path, since that's the class audit's ground. Overlaps are flagged inline.
- Companion damage at 0 HP (part of S2) and Warden caster sheets (part of H4) are unverified, as stated in each.
- Whether consequences reach the player another way (L2) is unverified.
- No `npm test` run. This is read-only and `node_modules` is not installed on the PC.

## Decisions made (reversible, for veto)

1. **Switched the PC checkout from `main` to `phase-4-hybrid-combat`.** The tree was clean before switching. Reversal: `git checkout main`, no cost.
2. **Git ownership workaround.** The E: drive doesn't record file ownership, so git refused the repo. I passed `-c safe.directory=…` per command instead of changing Zach's global git config. Reversal: none needed. If Zach wants it permanent, `git config --global --add safe.directory "E:/DnD Meta Game/dnd-meta-game"`.
3. **Placed BRIEF.md and HANDOFF.md under `docs/pm/`,** as both documents instruct. Reversal: delete two files. I didn't place the creation-solidification brief, which belongs with that job's handover.
4. **Severity calls.** S2 and S3 are rated severe (book-promised and reachable at level 1). H2 and H3 are rated high pending the book check. The PM can re-rank at no cost.
5. **M1 recommendation: wire the story starters into Stage 5 rather than delete them.** The content is finished, theme-matched and tested, and dropping it removes guidance a new player benefits from. That's the PM's call to confirm or veto. Reversal cost: none until a job is built.
6. **Method.** I found dead and unwired code with mechanical scans (who imports what, who calls each export, client URL to server route, marker schema to handler to prompt), then confirmed every reported finding by reading the code. The scans can miss dynamic calls (name built at runtime). Each finding above was checked by hand. The raw scan lists stayed in the session scratchpad and weren't committed.

## Needs Zach's decision

**Answered by Zach, 2026-11-12:**
- **Q1 (long-rest Hit Dice):** a long rest regains **all** spent Hit Point Dice. H2 is confirmed.
- **Q2 (prepared spells):** Zach supplied photos of the Bard, Cleric, Druid and Wizard Features tables from his 2024 PHB. The values are recorded under H3, and H3 is confirmed.
- **Q3 (massive damage):** **no.** "We're always doing death saves." A single huge hit never kills outright, so massive damage is not built.

**Still open:**

**Q3b. A hit on a character who is already down.** When a character is already at 0 HP, unconscious and making death saves, and an enemy hits them again, does that hit count as a failed death save (two failures if it's a critical hit)?
- **Yes:** enemies attacking a downed character push them toward death, as in the 2024 book. S2 becomes a small fix job.
- **No:** a downed character only risks death through their own death-save rolls. That's how the game works today (`characterHpService.js:62-100`), so S2 closes with no change.

Zach's earlier answer ("we're always doing death saves") rules out instant death but doesn't settle this part.

## Verification evidence

- Repo: PC path `E:\DnD Meta Game\dnd-meta-game`, branch `phase-4-hybrid-combat`. Audited at commit `40ab0c013b767d02f506a4870c5041caf8911b55` ("lots of changes, switching to Claude Code", 2026-11-11), which was up to date with `origin` at audit time. The commit carrying this report is listed in the hand-back message.
- Read-only proof: `git status` shows only the three new `docs/pm/` files.
- SHA-256 of BRIEF.md and HANDOFF.md: listed in the hand-back message, computed after the files were final. This report can't contain its own hash; its hash is in the hand-back message too.
- Browser spot-checks at **:5173** (run `npm run dev`):
  - **S1:** create a character, skip New Campaign, click Play. Play a short session and end it. The server log shows `[Chronicle] … has no campaign_id`. Try a merchant and get "No campaign found".
  - **S3:** create a level-1 Fighter with the Defense style, wearing armor. Sheet AC is not +1, and the style isn't listed anywhere on the sheet.
  - **H4:** create a Spellshot and level to 2. There is no spell section on the sheet.
  - **S2:** at 0 HP, have the DM hit the character again. The death-save pips don't change.
