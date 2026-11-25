# Report — class-audit-severe-seven: every class can do what the book says

## Understanding first

**The project.** This is a solo D&D 2024 game. One player character goes on a persistent adventure, and an AI Dungeon Master runs everything else: NPCs, companions, enemies and the story. The engine owns the rules (dice math, spell slots, the turn order), and the DM narrates what the engine decides.

**This job.** A class audit found that several classes can't do what the book says in play. This job fixes the seven severe gaps, plus the seven class-feature markers the DM was taught but nothing answered. It first re-checks all 22 audit gaps against the live code.

**Where my reading differs from the brief:**
- **Item 0, source.** The audit document is not on the PC; it is in Muse's workspace. I verified the 22 gaps as the brief names them, against the PC copy (the brief says the Mac, but the Mac copy is no longer used).
- **Item 5.** The plan functions are not dead code. The DM's `ARTIFICER_LEARN_PLAN` marker already calls them. What was missing is the player's side, so that is what I built.
- **Item 3.** The cause was two bugs, not one:
  - The level-up envelope offered 0 spells (the brief's cause).
  - The level-up spell picker could never list a spell for any class except warlock. It counted spell levels from a `spellSlotsByLevel` field that `classes.json` has never had.

  I fixed both. Without the second fix, the picker would have rendered with nothing to pick.
- **Items 4 and 6.** The warden and the scholar get no Spells tab at all, because their base class has no spellcasting in `classes.json`. Fixing the gate alone would not have shown the warden's Known Spells or the Theologian's prepared list. That is fixed too.

## Verdict

**PARTIAL.** Items 0, 1, 3, 4, 5, 6, 7 and 8 are built, and the new and touched suites are green. My full-suite numbers are under Test results. Two items are **BLOCKED on data that is not in the repo**, and I did not invent it:
- **Item 2:** the warlock invocation list. **Built 2026-11-25** from the data Zach sent (v1.0.214). See "Item 2 — built from the supplied data" below.
- **Item 9:** the Keeper's 8 genre-bonus texts. **Superseded 2026-11-25 by Zach's amendment:** the Keeper class is removed instead. See the next section.

**Update, 2026-11-25:** with item 2 built and item 9 superseded, every item in the brief is done or resolved.

## Item 2 — built from the supplied data (2026-11-25, v1.0.214)

**The data.** Zach sent `warlock-invocations-2024-phb.md`. It holds the names, prerequisites and one-line effects of all 28 options (SRD 5.2.1, cross-checked by the supplier against Roll20 and two SRD mirrors). It also holds the invocations-known column, read from the PHB Warlock Features table photo. It is saved in the repo at `docs/pm/class-audit-severe-seven/warlock-invocations-2024-phb.md`, and the test reads its tables directly. Nothing was written from memory.

**What a warlock can do now, in play:**
- **At creation (Stage 2):** the warlock picks the one invocation a level-1 warlock knows. The choices are the five with no prerequisite: Armor of Shadows, Eldritch Mind, and Pact of the Blade, Chain or Tome. Before, only the three Pacts were offered. The label is now "Eldritch Invocation".
- **At level-up:** the level-up page shows an Eldritch Invocations section whenever a warlock level owes invocations. That covers an in-class level and multiclassing into warlock (1 is owed).
  - **Picking:** each option shows its effect. An option the warlock doesn't qualify for is grayed out with the reason (for example "requires Warlock level 5").
  - **Same-time rule:** an option whose only missing prerequisite is a Pact or invocation picked in this same level-up unlocks, so Pact of the Blade and Thirsting Blade can be taken together.
  - **Choices:** a repeatable invocation names its cantrip or Origin feat.
  - **Replacement:** the warlock may also swap one invocation they know for another they qualify for.
  - **Review:** the review screen lists the picks and the swap.
- **On the sheet:** the Spells tab shows "Eldritch Invocations (held/known)", each with its effect. When a warlock knows fewer than the table allows, "+ Learn Invocation" opens a picker. This catches up a warlock made before this change, a creator draft that skipped the pick, or a level-up that took fewer than it could.
- **The DM is told.** The DM prompt's character block carries one line, "Eldritch Invocations: Agonizing Blast (Eldritch Blast) — …; Devil's Sight — …", so the DM honours them in narration.

**The rules the server enforces** (`server/services/warlockInvocationService.js`). Every write path uses them: create, PUT, level-up and Learn.
- **Known count by Warlock level:** 1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10. That is the 2024 table, not the 2014 one.
- **Level prerequisites are Warlock levels.** A fighter 4 / warlock 2 counts as Warlock level 2.
- **Prerequisites:**
  - The Pact invocations need their Pact.
  - Devouring Blade needs Thirsting Blade, not just the Pact.
  - Both can be met "at the same time": a batch is judged against everything held plus the rest of the batch.
  - **Cantrip prerequisites** (Agonizing Blast, Eldritch Spear, Repelling Blast): the named cantrip must be one the character knows, and it must meet the prerequisite. Whether a cantrip deals damage, uses an attack roll, or reaches 10+ feet is read from this repo's spell catalog descriptions into a small table (`WARLOCK_CANTRIP_TRAITS`). The test checks that every entry is a real Warlock cantrip and that each range agrees with the catalog.
- **Repeatable invocations** are taken again only for a different choice.
- **Refusals:**
  - more picks than are owed;
  - replacing an invocation while it is a prerequisite for another one (the Pact can't go while Thirsting Blade is held);
  - a replacement the warlock doesn't qualify for without the invocation given up.
- **Lessons of the First Ones** adds the chosen Origin feat to the character's feats, marked with its source. Replacing it away removes only that entry.

**Storage.**
- **Migration 117:** a new column, `characters.invocations`, a JSON list of `{ key, choice }`.
  - A held Pact is in that list. The existing `pact` column (migration 113) is kept in step with it, so its readers are unaffected.
  - A body that sends only `pact` (the old path) swaps the Pact into the list.
  - A class change away from warlock clears both.
  - **Backfill:** a warlock with a stored pact gets that Pact as its one invocation.
- **Creator resaves are safe.** The creator sends `level_one_invocation`, which the server only accepts while the stored list holds at most one entry, so a resave can't overwrite a higher-level warlock's invocations. Stage 2 also hides the picker past Warlock level 1.

**Files.**
- **New:**
  - `server/data/warlockInvocations.js`, the catalog;
  - `server/services/warlockInvocationService.js`, the rules;
  - `server/migrations/117_warlock_invocations.js`;
  - `client/src/data/warlockInvocations.js`, the client copy, pinned equal by the test;
  - the data document under `docs/pm/class-audit-severe-seven/`;
  - `tests/warlock-invocations.test.js`.
- **Changed:**
  - `server/routes/character.js`: create and PUT, the `GET /invocations/:id` options, the `POST /invocations/:id/learn` catch-up, the level-up envelope (`newInvocations`, `canReplaceInvocation`) and the level-up write (`newInvocations`, `replaceInvocation`);
  - `server/services/dmPromptBuilder.js`;
  - `server/data/featRegistry.js` (new `listOriginFeats`);
  - `Stage2ClassCalling.jsx` and `stage1Persistence.js`;
  - `LevelUpPage.jsx` (the `InvocationPicker` component);
  - `CharacterSheet.jsx`.

**Tests.**
- **New file:** `tests/warlock-invocations.test.js`, 244 passed, 0 failed. It covers:
  - all 28 document rows field by field, and the known table;
  - the client copy matching the server;
  - the rules;
  - the routes over real HTTP, including every refusal above;
  - multiclass-in, the Learn catch-up, the class-change clear and the creator-resave guard;
  - the DM prompt line;
  - the migration backfill and that re-running it is a no-op;
  - the client wiring.

  Two mutation checks were caught. Dropping the level prerequisite fails 10 checks; dropping the "can't replace a prerequisite" rule fails 1.
- **Updated files.** Three Stage 2 source checks (creator-test-notes-1-client, creator-test-notes-2-client, gray-out-client) still pinned the old three-Pact list, its label, and the files the gray-out mutation bundle copies. They now pin the catalog-driven list.
- **Full suite, my run on the PC, 2026-11-25:** `Files: 259/259 green  |  Assertions: 19717 passed, 0 failed`.
  - `pass*` (the libSQL exit crash after all assertions passed): item-2b-resources-feats, item-3c-bonus-action, mechanics-hooks-pools.
  - Retried once after the same crash mid-run, both passing: creator-next-stage4, creator-next-stage6-commit.
- **Client build:** built, no errors. Lint on the new server files: clean except the unused `down(db)` warning that every migration carries.

**Not done / open (item 2):**
- **The engine does not apply invocation mechanics yet.** That means Agonizing Blast's damage, Armor of Shadows' AC, Thirsting Blade's extra attack, Devil's Sight and the rest. The brief asked for the picker, storage and sheet. In play the DM knows each invocation from the prompt line and narrates it, but the engine doesn't do the math. That is a follow-up job, one invocation at a time.
- **Lessons of the First Ones adds the feat entry only.** Feat sub-choices (Magic Initiate's spells, Skilled's proficiencies) are not collected, the same as elsewhere in the game. Tough's HP is not applied anywhere in the game today. It does not check whether the character already has that feat from their background.
- **Cantrip choices are limited to cantrips already known.** In the level-up picker, a cantrip learned in the same level-up isn't listed as a choice yet, though the server accepts it. A cantrip known through another class counts if it is on the Warlock list.

**For Zach — one wording difference to confirm.** The old Stage 2 text for Pact of the Chain listed a Slaad Tadpole familiar. The supplied SRD text does not (SRD 5.2.1 leaves the Slaad Tadpole out), and the new picker uses the supplied text. If the printed PHB lists it and you want it shown, the fix is one line in the catalog. Tell me and I'll change it rather than guess.

**How to verify (item 2).**
1. Run `npm test warlock-invocations`.
2. At :5173, make a warlock. Stage 2 offers five invocations.
3. Give a level-1 warlock 300 XP and level up. The Eldritch Invocations section asks for 2. Agonizing Blast offers Eldritch Blast, and Thirsting Blade is grayed with "requires Warlock level 5".
4. On the sheet's Spells tab, look for "Eldritch Invocations (3/3)".

## Amendment — item 9: the Keeper class is removed (2026-11-25, v1.0.213, commit d6a34dc)

**The amendment.** The Keeper's design documents are lost, and the 8 genre-bonus texts exist nowhere, so they are not written. The Keeper comes out of the class registry on both the client and the server, so it can't be picked. The server refuses Keeper player-character creation with a 400. It is excluded from the class validators and the class-gated logic. Its data stays in the repo, unwired, so the class can come back if the documents turn up. The Keeper service and rest hook (audit gap 17) are moot and were not built. No real characters are affected.

**Removed, so it can't be picked:**
- **Client registry.** `client/src/data/classes.json` no longer has a `keeper` entry, so it lists 22 classes. The Stage 2 class picker, the level-up multiclass list, the companion editor and every other reader of `classes.json` stop offering it. The hard-coded class lists in `PartyBuilder.jsx` and `CompanionSheet.jsx` lose `'Keeper'`.
- **Server registry.** `server/services/classValidationService.js` has a new `REMOVED_CLASSES = {keeper}`, kept separate from the MVP-deferred set because a removed class is not offered at all. `isClassPcCreatable('keeper')` is now false, and `isClassRemoved` and `classUnavailableNote` are new.
- **Refused with a 400 on every player-character path** in `server/routes/character.js`. The error is "Class Keeper — This class has been removed from the game." It covers:
  - `POST /api/character`, with or without the creator marker;
  - `PUT` of `class`;
  - `PUT` of `class_levels`;
  - the creator's Review commit;
  - multiclassing into Keeper;
  - levelling up a Keeper row that already exists. This is new: the deferred classes are refused only on multiclass.
- **Level-up info** filters Keeper out of the multiclass options.

**Taken out of the validators and class-gated logic:**
- **Validators:**
  - `CREATOR_NEXT_KNOWN_CLASSES` (`character.js`);
  - `SPELL_ROUTE_KNOWN_CLASSES` (`routes/spells.js`), so `GET /api/spells?class=keeper` now gets the unknown-class 400;
  - `KNOWN_CLASSES` in `spellSelectionService.js`, along with its Keeper fail-closed branch.
- **Registries that list creatable classes:**
  - `SUBCLASS_LEVELS` (`levelProgression.js`);
  - the class chassis (`server/data/classChassis.js`);
  - the starting packages (`server/data/startingPackages.js`, the package and its gold source);
  - the companion class-to-theme map (`progressionCompanionService.js`);
  - the generated spell catalog (`client/src/data/spellCatalog.generated.json`, regenerated by `scripts/generate-spell-catalog.js`).
- **Class-gated code, deleted outright (CLAUDE.md rule 2; git history is the archive):**
  - the Keeper level-up UI in `LevelUpPage.jsx`: genre domain at 3, specialization at 6, second genre or mastery at 15, the texts and recitations pickers, the subclass-text notice, the review card, its state and its body fields. The page no longer imports `keeperTexts.js`.
  - the Keeper write branch of `POST /level-up` in `character.js`;
  - the Keeper abilities section and specialization tag of the DM prompt (`dmPromptBuilder.js`).

**Kept in the repo, unwired (as the amendment says):**
- `client/src/data/keeperTexts.js`, unchanged.
- **New: `client/src/data/keeperClass.json`.** It holds the former `classes.json` entry, moved unchanged (the parsed content was checked identical; only the indentation moved). It has the 8 genre domains, the 4 subclasses (Lorewarden, Mythslinger, Rhetorician, Versebinder), `keeperAbilities`, the polymath track, `subclassLevel` 6 and the starting equipment. Nothing imports it.
- **In `levelProgression.js`:** `KEEPER_PROGRESSION` and the Keeper rows in the feature, hit-die, caster-type and subclass-name tables.
- **Keeper rows in other data files:** the Keeper synergies in `subclassThemeSynergies.js`, and the journal alias in `packageResolutionService.js`.
- Migration `020_keeper_class.js` and the six `keeper_*` DB columns, along with the `character.js` column plumbing that reads and writes them.

**To bring it back:**
- Delete `keeper` from `REMOVED_CLASSES`.
- Put `keeperClass.json` back into `classes.json`.
- Restore the chassis, package, `SUBCLASS_LEVELS`, validator, level-up and DM-prompt code from the git history of this commit.

**Tests.**
- **New file:** `tests/keeper-removal.test.js`, 50 passed, 0 failed. It pins:
  - the registries;
  - every 400 path, including that a refused POST leaves no row;
  - that nothing is wired;
  - that the kept data is still there, including the DB columns.

  A mutation check (emptying `REMOVED_CLASSES`) fails 14 of the 50.
- **Updated files.** These had asserted that Keeper was offered; they now assert it is refused or absent, or count 22 classes instead of 23:
  - creator-next-stage2, stage2-validation-wiring, creator-next-stage4, creator-next-stage5-validation;
  - package-resolution: its grant-once dedup check used the Keeper package, and no other class gives an item it also offers as a pick, so it now uses a fixture package with the same shape;
  - levelup-subclass-prompts, creator-gaps-batch, gray-out-client, multiclass-removal.
- **Full suite, my run on the PC, 2026-11-25:** `Files: 258/258 green  |  Assertions: 19717 passed, 0 failed`.
  - `pass*` (the Windows native libSQL crash on exit after all assertions passed): exhaustion-2024, magic-item-discovery, mechanics-hooks-crit, migration-schema-contract.
  - Retried once after the same crash mid-run: profane-soul-validator-wiring, which passed.
- **Client build:** built, no errors. Lint on the touched server files shows one problem fewer than before; no new problems.

**How to verify.** Run `npm test keeper-removal`. At :5173, open the creator's Stage 2 class list: there is no Keeper. On any character's Level Up page, the multiclass cards have no Keeper.

## Per-item verdicts

| # | Item | Verdict | In play now |
|---|---|---|---|
| 0 | Audit the audit (22 gaps) | **Done** | 20 verified, 1 partly reproduces (gap 5), 1 partly checkable (gap 21). Table below. |
| 1 | Spell DC for magus / warden / scholar | **Built** | A casting warden's spell has a real save DC and spell attack bonus (Loreseeker Int 14 at level 3: DC 12, +4 on the sheet). The same holds for a magus or scholar when one is playable. The fix covers the cast path, spell attacks and enemy-spell saves. |
| 2 | Warlock Eldritch Invocations | **Built (2026-11-25)** | Built from the data Zach supplied: creator pick, level-up picker and swap, sheet section with a Learn catch-up, and the DM prompt line. See "Item 2 — built from the supplied data". |
| 3 | Wizard +2 spells on in-class level-up | **Built** | A wizard levelling up in wizard gets "Add 2 spells to your spellbook", listing every Wizard spell they can cast. The picks land in the book. Multiclass-in still seeds 6 (unchanged). |
| 4 | Known Spells sheet section | **Built** | Spellshot, magus, casting warden and Ritualist scholar see "Known Spells (n/cap)" on the Spells tab. "+ Learn New Spell" lists only spells they may learn, and saves the pick. |
| 5 | Artificer infusion plans | **Built** | At each level that grants plans (4 at 2nd, then 5 / 6 / 7 / 8 at 6 / 10 / 14 / 18), level-up shows an Infusion Plans picker capped at the new plans. A generic plan ("Common magic item") asks for the item's name. Picks show on the review screen, persist, and appear on the sheet as "Infusion Plans (known/max)". |
| 6 | Theologian scholar | **Built** | Prepared spells are capped at 3 (3rd level) up to 13 (20th). The cap is enforced on sheet save and re-checked on level-up. The sheet shows "Prepared Spells (n/cap)". |
| 7 | Split the pact-slot record (D3) | **Built** | A wizard 5 / warlock 3 who spends a wizard slot and a pact slot at 2nd level gets only the pact slot back on a short rest. The spent wizard slot stays spent, so banked Arcane Recovery can recover it. |
| 8 | Seven class-feature markers | **Built** | See the next table. |
| 9 | Keeper genre-bonus texts | **Superseded: class removed** | No source holds the 8 texts. Per Zach's amendment (2026-11-25), the Keeper class is removed instead; its data is kept, unwired. See the Amendment section. |

### Item 8, marker by marker

| Marker | Before | Now |
|---|---|---|
| Heroic Reroll | The roll was gone before the DM could ask; Target was always empty; the companion reroll was never called. | After a resolved roll, the player sees "⚙ You hold Heroic Inspiration: you can reroll that d20", and the DM's roll block says so. `[HEROIC_REROLL]` re-asks for the same roll, even after it resolved, and the new roll stands. `[HEROIC_REROLL: Target="<companion>"]` re-runs that companion's last roll. One reroll per roll. |
| Bend Luck | The d4 stayed in a note nobody read. | The d4 lands on the roll it answers. On a pending player roll it joins the total. Otherwise it changes the latest engine roll, or re-judges the player's just-resolved roll. The DM is told the new total. |
| Tides of Chaos | The advantage was written where nothing read it. | The sorcerer's next d20 roll (check, save or attack, PC or companion) has advantage, once. Tides stays spent until a slotted Sorcerer spell's automatic surge restores it, or a Long Rest. |
| Tamed Surge | The chosen row was stored and never used. | The next Wild Magic Surge resolves as the chosen row. |
| Hound of Ill Omen | A row nothing read. | The hound joins the turn order and takes turns: the DM directs it and the engine rolls its attacks and damage. Enemies can attack it by name. The creature it hunts has disadvantage on saves against the sorcerer's spells while the hound is within 5 ft. |
| Accursed Specter | A row nothing read. | It joins the turn order, attacks, can be targeted and can be destroyed. |
| Faithful Summons | Rows nothing read. | The beasts join the turn order on one shared initiative, attack, can be targeted and can be destroyed. |

The DM now hears every one of these seven markers' results (used, refused, or what happened) as a system note.

## Files changed

Sizes are in bytes. SHA-256 hashes are under Verification evidence.

| File | New / edited | Size | What |
|---|---|---|---|
| `server/migrations/116_pact_slots_used.js` | new | 1258 | Migration 116: pact_slots_used column (item 7) |
| `server/services/allyCombatService.js` | new | 7766 | Summons in combat: turn order, attacks, targeting, Hound save disadvantage (item 8) |
| `tests/class-audit-severe-seven.test.js` | new | 31007 | This job's suite, items 1, 3–8 (95 checks) |
| `docs/pm/class-audit-severe-seven/BRIEF.md` | new | 14161 | The brief, verbatim |
| `docs/pm/reports/class-audit-severe-seven-REPORT.md` | new | — | This report |
| `server/routes/character.js` | edited | 441224 | Wizard +2 envelope (3); plan catalog route, envelope, level-up validation and save (5); Theologian validator, PUT and level-up re-check (6); pact record on slot use/restore (7) |
| `server/routes/dmSession.js` | edited | 230552 | Class-feature marker results reach the DM; the Heroic Inspiration line (8) |
| `server/services/spellCastService.js` | edited | 100040 | Subclass passed to spellProfileFor (1); recordPactSpend / clampPactRecord (7); Hound save disadvantage, Tamed Surge and Tides in the surge hook (8) |
| `server/services/spellbookService.js` | edited | 41695 | resetPactSlotsTracked, spendsPactSlot (7) |
| `server/services/restTimeService.js` | edited | 56945 | Short/long rests use and clear the pact record (7) |
| `server/services/markerSchemas.js` | edited | 66875 | SPELL_CAST Pact= field (7) |
| `server/services/partyAttackService.js` | edited | 131251 | Subclass for spell attacks (1); summon ATTACK, Tides advantage on attacks (8) |
| `server/services/enemySpellService.js` | edited | 81037 | Subclass for party spell profile (1) |
| `server/services/subclassMarkerService.js` | edited | 47355 | Heroic Reroll target, Bend Luck applied, summons join the fight (8) |
| `server/services/rollRequestService.js` | edited | 67379 | Reroll after resolution, companion reroll, Bend Luck, Tides on rolls, reroll line in the DM roll block (8) |
| `server/services/combatMarkerService.js` | edited | 96353 | Summons in COMBAT_START order; enemies can target summons (8) |
| `server/services/combatLoopService.js` | edited | 25373 | Summon turns: can-act check and DM directive (8) |
| `server/services/enemyCombatService.js` | edited | 20862 | Enemy damage to a summon (8) |
| `server/services/turnLedgerService.js` | edited | 20349 | Ledger key for a summon (8) |
| `client/src/components/CharacterSheet.jsx` | edited | 277642 | Known Spells gate and list from the server (4); Infusion Plans section (5); Theologian prepared list (6); spells tab for warden/scholar; Level Up button fix |
| `client/src/components/LevelUpPage.jsx` | edited | 113685 | Infusion Plans picker and review card (5); spell list from the server (3); review class-level fix |
| `client/src/App.jsx` | edited | 30679 | Level-up handler ignores a non-character argument (sheet Level Up fix) |
| `tests/h2-h3-2024-rules.test.js` | edited | 23651 | Harness passes the new getMaxPrepared inputs |
| `tests/sheet-prepared-branches.test.js` | edited | 20936 | Harness inputs + Theologian cases |
| `tests/mechanics-hooks-markers.test.js` | edited | 27689 | Bend Luck pin updated to the brief's rule (the d4 is applied) |
| `package.json` | edited | 1398 | 1.0.211 → 1.0.212 |
| `client/package.json` | edited | 427 | 1.0.211 → 1.0.212 |


**Migration 116** (`116_pact_slots_used.js`) adds the `pact_slots_used` column to characters and companions. It is idempotent, via PRAGMA.

## What was built, in gameplay terms

- **A warden's spells have a real difficulty.** Before, a casting warden (and a magus or scholar) cast with no save DC and no attack bonus. The game never looked up the subclass that gives them their casting ability. Now the warden's sheet shows its DC and attack bonus, and spells cast in play use them.
- **A wizard who levels up learns two spells.** The level-up flow has a spellbook step listing every Wizard spell the wizard can now cast, and the two picks are written into the book.
- **Known-spells casters have a spell list on the sheet.** A spellshot, a casting warden (and a magus or Ritualist scholar) see their known spells against their cap, and can learn a spell from the list of spells they qualify for.
- **Artificers learn infusion plans.** The level-up flow offers the plans of the new level, and the sheet lists the plans known.
- **A Theologian scholar's prepared spells are capped.** The cap is 3 to 13 by level, enforced on save and level-up and shown on the sheet.
- **A wizard-warlock keeps track of which kind of slot they spent.** A short rest returns pact slots only, so Arcane Recovery works on the wizard slot.
- **The Wild Magic, Shadow, Hexblade and Shepherd features work.** The reroll, the d4, the advantage, the chosen surge, and summons that fight and can be fought.
- **Found and fixed on the way:**
  - **Level Up from the character sheet always failed** with "Cannot Level Up — Character not found", for every character. The button handed React's click event to the level-up handler as if it were the character, and the handler replaced the selected character with it. This dates from 2026-04-17 (commit 97fb708).
  - **The level-up review showed the old class level** ("After Level Up: wizard 2" for a 2→3 level-up). It was a capital-letter mismatch.

## Test results

**Full suite, my run on the PC, 2026-11-24:** `Files: 257/257 green  |  Assertions: 19750 passed, 0 failed`.

- `pass*` (Windows native libSQL crash on exit **after** all assertions passed, counted green by the runner): item-8-conditions.test.js, subclass-scanned5.test.js.
- **The previous run** had one file die mid-run with that same native crash (stage2-validation-wiring.test.js, exit 3221225477). Run alone, it passed 91/91. It was green in this final run.
- **Suites this job added or touched:**
  - class-audit-severe-seven: **95 passed, 0 failed** (new).
  - h2-h3-2024-rules: 90/90.
  - sheet-prepared-branches: 64/64 (3 new Theologian checks).
  - mechanics-hooks-markers: 91/91.
  - Also green: artificer-validator-wiring 54/54, integration 498/498, turn-e2e 51/51, spellbook-routes 494/494, levelup-subclass-prompts.
- **Client build** (`cd client && npx vite build`): built, no errors.

Zach's run is the gate, and this is not it.

## Cost and usage

I can't measure this session's cost or the usage left against the $30/month cap from inside the session. The cost is unmeasured, not zero.

## What was NOT done / still open

- **Item 2, warlock invocations: resolved 2026-11-25.** Built once the data arrived; see "Item 2 — built from the supplied data". The original note: no invocation catalog exists in the repo: no names, no prerequisites, and no count of invocations known per warlock level. The only invocation text is the Pact boon descriptions in the creator (`Stage2ClassCalling.jsx:120`). I did not write the list from memory. The picker, the storage and the sheet section are straightforward once the list exists; see question 1.
- **Item 9, Keeper genre-bonus texts: missing data.** Sources checked:
  - `client/src/data/keeperTexts.js`: `GENRE_DOMAINS` holds only each genre's passive, mastery upgrade and capstone, with no genre-bonus text.
  - `archive/Claude PM Review Docs/KEEPER_REVIEW.md` says only "write 8".
  - `CODE_AUDIT_FINDINGS.md:45`.
  - `archive/CUSTOM_CLASSES.md`.
  - `docs/pm/reports/docs-cleanup-REPORT.md:184` confirms they are missing.

  None holds the texts. **Resolved 2026-11-25:** the class is removed instead (see the Amendment section).
- **Observed, out of scope, not changed:**
  - `markerSchemas.js` defines `ATTACK`, `DISENGAGE`, `DODGE`, `HELP`, `HIDE`, `MASTERY_SET` and `READY` twice each; in a JavaScript object, the later definition silently wins. A comment at the second `ATTACK` says the second block is the one in use, so play is not affected. The dead first blocks should be deleted in a cleanup job.
  - The home screen's character cards say "ACTIVE -1 DAYS AGO" for characters made today.
- **Known edges (rare, left as stated):**
  - Tides of Chaos advantage is spent when the attack is declared, even if the attack is then refused for another reason.
  - On a companion's roll, a condition's disadvantage merges with the original advantage request, so a poisoned companion's Tides roll comes out as a straight roll (advantage and disadvantage cancel). That is the book result anyway.
  - A pact spend made before migration 116 is not in the record. The first short rest after the upgrade returns all slots at the pact level (the old behaviour) once; after that the record is exact.
  - The level filter on the sheet's Learn panel lists the spell levels the server returned.

## Decisions made inside the brief's latitude

Each is reversible and flagged for Zach's veto at the gate.

1. **Which slot pays when a wizard-warlock casts at their pact level.** The Spellcasting (wizard) slot pays first. A pact slot is used when the DM writes `Pact=true` on the cast, or when no Spellcasting slot is left at that level. *Reversal:* flip the default in `spendsPactSlot` (one line, plus its tests).
2. **Initiative for summons.**
   - **Faithful Summons beasts:** they roll one initiative as a group. The repo holds no 2024 wording for this; the group roll follows the 2014 Conjure Animals text, the spell Faithful Summons casts.
   - **Hound and specter:** each rolls its own initiative (the engine's d20 plus its Dex), since the repo holds no wording for either.
   - *Reversal:* change `allyTurnEntries` in `allyCombatService.js` (small), for example to take the turn right after the owner's.
3. **Which summons take turns.** Only the hound, the specter and the Faithful Summons beasts join the turn order. The other friendly-actor kinds (steel defender, eldritch cannon and so on) are untouched, because they are outside this brief. *Reversal:* add kinds to `TURN_TAKING_KINDS`.
4. **One source for spell lists on the sheet and in level-up.** The known-spells cap, the learnable spells, the Theologian's cap and the level-up spell list all come from the server's `GET /api/spells`, the same rule the server validates against. The client-side counting is removed for those paths. *Reversal:* moderate. The client copy of the old logic is still in place as a fallback while the server list loads.
5. **Where Bend Luck lands.** It applies, in order, to the player's pending roll, then the latest engine roll, then the player's just-resolved roll. *Reversal:* reorder in `applyBendLuck`.
6. **Heroic Reroll after the result.** A copy of the player's last resolved roll is kept, so the reroll works once the result is known, which is when a player decides to use it. *Reversal:* drop the copy (the reroll then works only while the roll is pending, as before).

## Anything needing Zach's decision

1. **Answered 2026-11-25:** Zach sent the list, and item 2 is built. The one open point is the Slaad Tadpole wording; see "For Zach" in the item 2 section. The original question: **Warlock Eldritch Invocations: the list itself.** The brief asks for a level-up picker, storage and a sheet display for invocations. Nothing in the repo lists the invocations. I searched `client/src/data`, `server/data`, the services, `archive/` and `docs/`. To build the picker I need, from the 2024 Player's Handbook:
   - every invocation's name;
   - its prerequisite (warlock level, Pact boon, or another invocation);
   - a one-line effect;
   - the "Invocations known" count at each warlock level.

   Can that be sent (photos of the PHB pages are fine)? I will not write it from memory.
2. ~~**The Keeper's 8 genre-bonus texts.**~~ **Answered 2026-11-25:** the design documents are lost, so the class is removed. See the Amendment section.

## How to verify

1. **Gate.** From `E:\DnD Meta Game\dnd-meta-game`, run `npm test`. Look for `tests/class-audit-severe-seven.test.js`: 95 passed, 0 failed.
2. **At :5173.** Run `npm run dev` and open http://localhost:5173. The test characters are invented.
   - **Wizard +2:** make a level-2 wizard with 900 XP. Open CHARACTER, then **Level Up!**, then the Wizard card. Pick a subclass, Take Average, then **Choose Spells →**. Look for "New Spellbook Spells (0/2)" and a list of Wizard spells (1st and 2nd level). Pick two, review (it lists "Spellbook Additions" and "After Level Up: wizard 3"), then **Level Up to 3!** The two spells are in the book.
   - **Artificer plans:** take a level-1 artificer with 300 XP to level 2. Look for "Infusion Plans: … learn 4 new plans", with checkboxes that lock at 4. "Common magic item" asks for a name. The review shows an Infusion Plans card. Afterwards, the sheet's Spells tab shows "Infusion Plans (4/4)" with the four names.
   - **Known Spells:** a level-3 Loreseeker warden (or a level-3 spellshot). On the Spells tab, look for "Known Spells (0/3)" and the warden's Spell Save DC. Click "+ Learn New Spell", then Learn on any spell; the header becomes "Known Spells (1/3)".
   - **Theologian:** scholar is closed to player characters, so this needs a scholar row made outside the creator (the tests do this). The sheet's Spells tab shows "Prepared Spells (n/3)" at 3rd level.
   - **Level Up from the sheet:** Level Up now opens the level-up page for every character. It used to say "Character not found".
3. **In play:** the markers are covered by tests (below). There is no live-model check in this job.

## Verification evidence

- **Branch:** `phase-4-hybrid-combat`. **PC repo:** `E:\DnD Meta Game\dnd-meta-game`. **Commit:** `1ea7d62` (the follow-up commit only records this hash).
- **SHA-256 of every changed file:**

| File | SHA-256 |
|---|---|
| `server/migrations/116_pact_slots_used.js` | `b780ab0dafda827dd739172e239172e39f01dc74a2876b4aa65c25e502fd1df8` |
| `server/services/allyCombatService.js` | `e03c4547d3f3eea3e35febca354d01af2f7ec4c802e61a3db45fa97899642297` |
| `tests/class-audit-severe-seven.test.js` | `45e181998a7c20544b69c403b6582796e9f6d787c973253e892c004a843486d4` |
| `docs/pm/class-audit-severe-seven/BRIEF.md` | `9573b07bc536e23b592189dce86fa957bc8cda4739c1d1757aa0ba95cae998a2` |
| `server/routes/character.js` | `469459a9e8e135a5e18d8b01b384a8cfa97b482b766baa99f3ae292bdf27cb17` |
| `server/routes/dmSession.js` | `4c3dcc958a33b5871cc71af0478b1389c7c4575849c6da9c8dba3b9925ae72fb` |
| `server/services/spellCastService.js` | `2053a215eb6af2c84627388410b43e62f9395bf98da23949878a046b215188b6` |
| `server/services/spellbookService.js` | `1deac889aa4bb5c3a3c301f49fd46fd35fde1c336506b6023325b2a45e8e840d` |
| `server/services/restTimeService.js` | `71a78c1f1dcbec9577d0de02e6d4c38c0297d3092a4fa1369b14498442a4d48d` |
| `server/services/markerSchemas.js` | `f7530744054dc074117482079d33fdab5be581f409e392011bd6cfed322a2f2b` |
| `server/services/partyAttackService.js` | `e118c032b0cdd4f38533d6b03b33f49f362bcc8a06098d498e1ff896a4625ad4` |
| `server/services/enemySpellService.js` | `de2f4b7a9e41aecb6d34cc29318b107e814948bba344f2414940c32575bd4908` |
| `server/services/subclassMarkerService.js` | `04f78a285ca4babcace2b5ff887d7ac44345c26eb784a45425f1f9a7f18e7a83` |
| `server/services/rollRequestService.js` | `64fb1fb97ae0a31d737afb8b54a260892480ba683a04f9ec82be1da9f4cc29ad` |
| `server/services/combatMarkerService.js` | `25b0c11fa92f39a063c5cafd707bb9802b6cdd497d8bee6ea86abb5c783a89c8` |
| `server/services/combatLoopService.js` | `7f2800a376cca9c9d81b9c8be1e77b960643c33e4053e295fb31e5f655cbf9b1` |
| `server/services/enemyCombatService.js` | `36f6dbf273ed94f57fe64b8fe79e715609ec3bfcc02cf5c43d78ecd60fe087bc` |
| `server/services/turnLedgerService.js` | `a41b50cee12035adda5090cbd57da26b6ba5d173f158642ffc0ff8cd577fe7d7` |
| `client/src/components/CharacterSheet.jsx` | `4307f08a16637ebd9d1f5eb10e877113004592d68701f6888eea37cc33df35be` |
| `client/src/components/LevelUpPage.jsx` | `db0106152270d8352da0fa063f6f596ca3dcb6b59db8488782f6fc37a584a79c` |
| `client/src/App.jsx` | `fe785c1c9eda332f0d510ea085bf2307ef91bf3c90d9454796912fe810e4750f` |
| `tests/h2-h3-2024-rules.test.js` | `7f577e936b2096faa1a17d143b6795458876f5f24df92f0103a4b38e0fffdd18` |
| `tests/sheet-prepared-branches.test.js` | `53432cb2d2535f61346b408d3e28ba2acd65d252af596742c04129ba94737fd0` |
| `tests/mechanics-hooks-markers.test.js` | `983f2d914fa4af05de382f3279bf0175c36f94ce1563210b2327176d20fd8fe9` |
| `package.json` | `862f1a8a28d97feff706f1065e5b45417471d0deafb9c1f77cd5312be34c7cd8` |
| `client/package.json` | `5c0e48a03b824e8e4eda6ebabc9fe228ad15117954238e12bccdc940d76f87e0` |
| `docs/pm/reports/class-audit-severe-seven-REPORT.md` | (this file — hash not self-referential) |


- **:5173 evidence (2026-11-24).** Real app, headless Chrome against a throwaway database:
  - **Wizard 2→3:** the spell step lists 110 spells (44 first-level, 66 second-level). Magic Missile and Shield were picked, the review said "Spellbook Additions: Magic Missile, Shield", and the saved book was `["Magic Missile","Shield"]` at level 3 with School of Evocation.
  - **Artificer 1→2:** "4 of 4 chosen" with the other 12 boxes disabled. The saved plans were `["Alchemy Jug","Bag of Holding","Cap of Water Breathing","Goggles of Night"]`, and the sheet showed "Infusion Plans (4/4)". A second artificer's generic plan saved as "Common magic item: Clockwork Amulet".
  - **Loreseeker warden 3:** "Known Spells (0/3)" and "Spell Save DC 12". Learn moved it to "(1/3)" and saved `["Absorb Elements"]`.
  - **Spellshot 3:** "Known Spells (0/3)" with 6 learnable spells.
  - **Theologian 3:** "Prepared Spells (2/3)" and "Spell Save DC 13".
  - **Level Up from the sheet:** before the fix, the page requested `/api/character/level-up-info/undefined` (404). After it, the page opens.

## Item 0 — the audit of the audit (22 gaps)

**Source note:** `class-audit-2026-11-10.md` is not on this PC. A search of the repo, `E:\DnD Meta Game` and Downloads found no copy; it lives in Muse's workspace. So I verified the 22 gaps **as the brief names them**: severe 1–7 in items 1–7, high 7, medium 4 and lower 4 in Out of Scope. That is 22 in all.

Where the audit carried detail beyond the brief's one line, I could not check that detail. Those rows are marked "verified as named". Every check below is against live code on the PC, branch `phase-4-hybrid-combat` at `0da6d9d`. The brief says "on the Mac", but the Mac copy is no longer used, per HANDOFF.

| # | Sev. | Gap (as named) | Verdict | Live evidence |
|---|---|---|---|---|
| 1 | Severe | Magus / Warden / Scholar spell DC: subclass not passed to `spellProfileFor` | **Verified** | `combatStatsService.js:329` resolves the casting ability for magus, warden and scholar only when `subclassName` is passed (the comment at :331–333 flags this). All three `spellCastService.js` callers (:98, :733, :783) pass the class only. **The same defect appears in three siblings the audit did not name:** `partyAttackService.js:242` (spell attacks), `enemySpellService.js:166` and `:168` (party saves against enemy spells). They are fixed with it, under fix-as-you-find-it. |
| 2 | Severe | Warlock Eldritch Invocations: no picker, storage or service | **Verified** | 0 hits for "invocation" in `LevelUpPage.jsx` and `CharacterSheet.jsx`. `character.js:154` is a comment. **No invocation catalog exists anywhere in the repo:** no names, no prerequisites, no per-level count. The only invocation text is the Pact boons in `Stage2ClassCalling.jsx:120`. |
| 3 | Severe | Wizard +2 spells picker on in-class level-up | **Verified** | The envelope at `character.js:6712` uses `getSpellsKnown(...)`, which returns null for a prepared caster, so `newSpellsKnown` is 0. The comment at `character.js:7266` says outright that the in-class +2 picker never renders. Multiclass-in seeds 6 (`character.js:6804`). |
| 4 | Severe | Known Spells sheet section gated on "Limited known" | **Verified** | `CharacterSheet.jsx:798` reads `spellsKnown === 'Limited known'`, and there are 0 hits for that string in `classes.json`. Live values: spellshot and magus use per-level arrays. Warden and scholar have `spellcasting: null`, with their casting coming from the subclass in `levelProgression`. |
| 5 | Severe | Artificer infusion plans: `learnPlan` / `replacePlan` dead code | **Partly reproduces** | It is true that nothing in `character.js` or `dmSession.js` calls them, and there is no route and no UI (0 hits in `LevelUpPage` and `CharacterSheet`). But they are **not dead code**: `artificerService.js:682/686` register the `ARTIFICER_LEARN_PLAN` / `ARTIFICER_REPLACE_PLAN` marker handlers, which call them. They store the plans in `class_resources_json.artificer`, and the DM prompt teaches the markers. So an artificer *can* learn plans today, through the DM at a long rest. **What is missing is the player's side:** a level-up picker and a sheet display. The plan catalog (`PLAN_TABLES`) and the plans-known table (`FORGE_PLANS_KNOWN`) already exist. |
| 6 | Severe | Scholar (Theologian): no sheet section, PUT validator or level-up re-check | **Verified** | 0 "theologian" hits in `character.js` and `CharacterSheet.jsx` |
| 7 | Severe | `resetPactSlots` erases a spent wizard slot at the same level | **Verified** | `spellbookService.js:792–800` subtracts the full pact count from the shared used map at the pact level, and its own comment names D3 (a split map) as the only complete fix. |
| 8 | High | Fighting-style level-up picker (all classes) | **Verified** | 0 "fighting style" hits in `LevelUpPage.jsx`. The style is only picked at creation (`character.js:2926`). |
| 9 | High | Expertise picker and storage (rogue / bard) | **Verified as named, for level-up** | Creation stores and validates `expertise` (`character.js:3001`). There are 0 hits in `LevelUpPage.jsx`, so a later Expertise grant (rogue 6, bard 9) has no picker. |
| 10 | High | Sorcerer Metamagic | **Verified** | The only hit is `levelProgression.js`, a feature-name list. No service, storage or UI. |
| 11 | High | Bard Magical Secrets | **Verified as named** | `bardService.js:28` and `character.js:4137` only count Magical Secrets spells toward the prepared cap. No picker offers spells from other class lists. |
| 12 | High | Warlock Mystic Arcanum storage | **Verified as named** | `warlockService.js:34/70/123` exclude one spell per tier from the prepared count, by catalog spell level. There is no dedicated storage and no once-per-long-rest tracking. |
| 13 | High | Duelist Critical Strikes picker | **Verified** | The state and a DM marker exist (`duelistService.js:92`, `:233`), but there is no player picker (0 hits in `LevelUpPage`). |
| 14 | High | Style lists for warden / blackguard / duelist / blood hunter | **Verified as named** | Each class's own style list lives only as prose in `classes.json` (for example, warden: "Crippling, Great Weapon Fighting, Protection, or Titan…"). The creator's style picker reads the generic `listFightingStyleFeats` (`character.js:2926`). |
| 15 | Medium | Druid Wild Shape uses | **Verified** | No use counter in any service or config. Wild Shape appears only as a form or condition (`conditionService`, `partyAttackService`). |
| 16 | Medium | Paladin Channel Divinity uses | **Verified** | Only `blackguardService.js:127/200` tracks Channel Divinity. Paladin's pool is named in a comment at `classFeatureService.js:42` but not tracked. |
| 17 | Medium | Keeper service and rest hook | **Verified** | There is no `keeperService`, and only `client/src/data/keeperTexts.js` exists. |
| 18 | Medium | Fighter Indomitable | **Verified** | Only the feature names in `levelProgression.js:164/168`. No use tracking. |
| 19 | Lower | Known-caster PUT validation | **Verified** | No spellshot or magus known-count validator in the `character.js` PUT path. |
| 20 | Lower | Book of Shadows mechanic | **Verified** | Only the creator's Pact of the Tome description (`Stage2ClassCalling.jsx:120`). No mechanic. |
| 21 | Lower | OCR-loss flags plus Last Dance | **Verified as named, partly** | Last Dance is flagged in the data as a GAP with no body text (`server/data/subclasses/fighter.js:739`). I can't check the full list of "OCR-loss flags" without the audit document. |
| 22 | Lower | Prepared Spells primary-gating | **Verified** | `CharacterSheet.jsx:789` `isPreparedCaster()` reads `classData` for the primary class only (`:1349`). |

**Nothing was built for a gap that failed verification, and no gap outside the brief was added.** The three `spellProfileFor` sibling callers are the same defect as gap 1.
