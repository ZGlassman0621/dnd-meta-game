# Report — l1-l6-cleanup: take out the dead code, and only the dead code

## Understanding
The project is a solo D&D 2024 "forever game": one human player character, with the DM, NPCs, companions and enemies played by a local AI (gemma4:12b). The engine owns the rules and the dice. The AI narrates and emits bracketed markers that the engine parses.

This job removes code that nothing uses, specifically the audit's lower items L1–L6 and five folded-in items. It must change nothing the player can see. Every deletion needs a survey proving that nothing calls or reads the deleted code. Anything not proved dead stays and is reported as still open. The suite must stay red-with-cause with exactly the five named return-loop checks.

**Where the brief differs from the live repo:**
1. **The audit report's path.** The brief names `docs/pm/full-codebase-audit/REPORT.md`, but that folder holds only `BRIEF.md`. The audit report is at `docs/pm/reports/full-codebase-audit-REPORT.md`, which is the one-folder reports rule. I enumerated L1–L6 from that file (lines 112–117).
2. **BOND_SHIFT has a live reader**, so the brief's "orphan" premise does not hold. See item 3. It is left in place, as the brief says to do in that case.
3. **"2 assertions" for BOND_SHIFT.** The test block holds one BOND_SHIFT assertion (line 180) plus the marker inside a test string (line 177). The dm-mode-removal report's "two assertions at lines 177–180" counts those two lines. It is moot either way, because BOND_SHIFT stays.
4. **L2 counts differ slightly from the audit:**
   - `eventEmitter` has 11 `emit*` wrappers, not 12.
   - My zero-caller sets were built from live search, not from the audit's numbers.

## Verdict
**BUILT + RED-WITH-CAUSE.** The full run is red with exactly the five named return-loop checks and no new failures. This is Zach's expected gate. Zach's run is the gate; this report does not claim it.

## Per-item verdicts (the brief's nine items)
| # | Item | Verdict |
|---|---|---|
| 1 | Survey first | Done. The full inventory is below, with file and line, callers or a zero-caller proof, and the outcome. |
| 2 | Delete L1–L6 dead code | L1, L2 and L3 deleted where proved dead. L2's consequenceService pair, L4, L5 and L6 are still open, with reasons. |
| 3 | BOND_SHIFT orphan | **Still open.** It has a live reader: `server/services/markerStrip.js:22` builds the player-text strip list from every schema key, and `markerSchemas.js` (`validateDmMarkers`) iterates every key. |
| 4 | Comment retargeting | 24 comments in 20 files retargeted (list below). No migration file was touched. |
| 5 | PreludeSession "503 OVERLOADED" | **Corrected.** The behaviour still exists under another name (evidence below). |
| 6 | `markerSchemas.js` duplicates | **Resolved.** 7 duplicated keys are merged, and the runtime object is byte-identical (proof below). |
| 7 | docs/ dead-rule sweep | Hits are listed below. All are in historical briefs and reports, so nothing was deleted. |
| 8 | Tests | Tests asserting on deleted code were deleted with it. The four sc6-4 "still exported" checks now assert the functions are gone. No test was weakened. Suites were run only through `npm test <name>`. |
| 9 | No :5173 pass | Not driven. The final-test checks are listed under "How to verify". |

## Item 1 — survey inventory (line numbers at `99cc002`, before this job)
Search method: `grep -rw <name>` over `server/`, `client/src/`, `scripts/` and `tests/`, with `node_modules` excluded. I also checked:
- every `import * as` of the touched modules (a `ns.name` access matches the `-w` search);
- dynamic `await import(...)` destructuring;
- computed access (`ns[x]`). The only computed access found is the four sc6-4 tests' "still exported" loops.

`server/tests/*.js` holds old scripts that `npm test` does not run. They still count as callers, so any function they use was kept.

### L1 — 28 legacy marker detectors (`server/services/dmSessionService.js:75-815`)
**Deleted (26), with zero production callers and tests only:**
- `detectMerchantShop` :75, `detectMerchantRefer` :98, `detectAddItem` :120, `detectBaseDefenseResult` :160, `detectMerchantCommission` :180, `detectLootDrop` :214, `detectCombatStart` :237, `detectCombatEnd` :255.
- `detectWeatherChange` :478, `detectShelterFound` :493, `detectSwim` :508, `detectEat` :519, `detectDrink` :534, `detectForage` :549, `detectRecipeFound` :565, `detectMaterialFound` :580, `detectCraftProgress` :601, `detectRecipeGift` :615.
- `detectMythicTrial` :656, `detectPietyChange` :677, `detectItemAwaken` :701, `detectMythicSurge` :722, `detectPromiseMade` :742, `detectPromiseFulfilled` :770, `detectNotorietyGain` :793, `detectNotorietyLoss` :815.

The only production "hits" for these names were comments:
- `routes/dmSession.js:130-146`
- `pietyService.js:15,227`
- `markerSchemas.js:810`

`detectPromiseMade` was imported, but never called, in `tests/faction-quests.test.js:23`.

The private helper `parseMarkerKeyValue` (:836) was also deleted. Its only callers were the two notoriety detectors (:799, :821).

**Kept, because they are live:**
- `detectDowntime` (:286), called at `routes/dmSession.js:2576`.
- `detectRecruitment` (:376), called at `routes/dmSession.js:2579`.
- `estimateEnemyDexMod` (:264), called at `combatMarkerService.js:114,302`.
- `parseMarkerPairs` (:30), called at `data/conditions.js:30,39`.
- `parseNpcJoinMarker` (:46), called by the live `detectRecruitment` (:377).

**Every deleted marker is still handled by the pipeline, with its own suites:**
- `sc6-4a` covers survival and crafting.
- `sc6-4b` covers merchant and loot.
- `sc6-4c` covers promise and notoriety.
- `sc6-4d` covers combat and mythic.
- `piety-config` and `marker-schemas` cover PIETY_CHANGE.

Note: the deleted promise tests asserted that an invalid `Weight` defaults to moderate. The live schema rejects an invalid `Weight` instead (`sc6-4c` line 68), so the dead tests were asserting the opposite of live behaviour.

### L2 — uncalled helpers
- **`server/services/eventEmitter.js`: deleted.**
  - 11 `emit*` wrappers, at :202, 209, 216, 223, 230, 237, 244, 251, 258, 265 and 272. They have zero callers anywhere.
  - Three more zero-caller utilities in the same file (fix-as-you-find): `getRegisteredEventTypes` :144, `getHandlerCount` :153 and `clearAllHandlers` :183.
  - Kept: `getEventHistory` and `clearEventHistory` (used by `server/tests/narrativeSystemsTest.js`) and `getEventsByType` (used by `routes/worldEvent.js` and `worldEventService.js`).
- **`server/services/narrativeQueueService.js`: deleted.**
  - Zero callers anywhere: `getUrgentItems` :126, `getItemsByEventType` :143, `getQuestRelatedItems` :156, `getCompanionRelatedItems` :169, `updateQueueItem` :291, `cleanupDeliveredItems` :326 and `getSessionDeliveredItems` :373.
  - Tests only (`tests/narrative-queue.test.js`): `markMultipleDelivered` :197 and `getQueueStats` :339.
  - The constant `PRIORITY_ORDER` (:8), which had no reader even before this job.
  - Kept: `getNextBatch`, which is tests-only by name but called internally by the live `formatForAIContext` (:261).
- **`server/services/companionBackstoryService.js`: deleted.** Zero callers anywhere:
  - `updateBackstoryByCompanionId` :119, `getLoyalty` :261, `addSecret` :329, `getRevealedSecrets` :380, `getUnrevealedSecrets` :390, `addUnresolvedThread` :404, `linkThreadToQuest` :451, `getActivatedThreads` :505, `checkThreadTriggers` :515, `deleteBackstory` :551, `deleteBackstoryByCompanionId` :559 and `getMoodRPGuidance` :705.
  - Plus two that went dead with them: `getDormantThreads` :495 (its only caller was `checkThreadTriggers`) and the file-private `MOOD_RP_GUIDANCE` :570 (its only reader was `getMoodRPGuidance`). The live copy in `dmPromptBuilder.js:44` is untouched.
- **`server/services/consequenceService.js`: still open.** `getUndeliveredConsequences` and `markConsequenceDelivered` have no production caller; only `tests/consequence.test.js` uses them. The audit itself marked this pair **unverified**, because it did not know whether consequences reach the player another way. Deleting it would settle a product question, so I left it.

### L3 — dead UI and duplicates (all deleted)
- `client/src/components/CompanionManager.jsx` (30,725 bytes): imported by nothing. The only mention was a comment in `tests/rest-calls-client.test.js:23`, now corrected.
- `companionSheetService.getCompanionSheet` (:103): zero callers. `parseSheet` stays, because `ensureCompanionSheet` uses it.
- `npcVoiceService.formatVoicePaletteForPrompt` (:242): zero callers. The live copy, `formatVoicePalette` at `dmPromptBuilder.js:442`, is kept, and its doc comment was updated.

### L4 — duplicated prepared-spell tables: still open
The client tables are at `client/src/components/CharacterSheet.jsx:697,781` (the audit's lines have moved), and the server keeps its own copy. Both copies are live; this is duplication, not dead code. Merging them is a refactor, which is out of scope.

### L5 — data hygiene: still open
- **Spelljammer label.** `server/data/spellCatalogData.js:28` labels the source "Spelljammer", and `:129` labels it "Spelljammer: Adventures in Space". Unifying them is a data change, and choosing the label is a call for the PM.
- **Staged weapons.** `server/data/armsArmorVariants.js` `PROPOSED_WEAPONS` (:265) has 9 entries with `mastery: 'TBD'`. It is read only by its own file's default export and by `tests/arms-armor-variants.test.js:73,164`. It is staged data that a test still asserts on, not dead code.

### L6 — unused endpoints: still open
- 4 character-quest routes at `server/routes/character.js:8396, 8421, 8436, 8451` (moved from the audit's 7861–7916).
- 8 `story-threads` routes at `server/routes/storyThreads.js:16-197`.
- Some of the 19 `location` routes. The client calls 7 paths, in `LocationsPage.jsx` and `GenerationControlsPage.jsx`.

These routes are mounted on the running server (`server/index.js:104,106`), and `tests/integration.test.js:124` mounts story-threads. Having no client caller is not proof of no reader for a live HTTP endpoint. The audit calls these "AI-driven or post-MVP", so pruning them is a product decision, not dead-code removal. Deleting them would also cascade into live services such as `storyThreads.js` and `companionBackstoryService.resolveThread`.

## Item 3 — BOND_SHIFT (still open)
`server/services/markerSchemas.js:955` (now about :945) holds the BOND_SHIFT schema. No prompt emits it and no handler is registered. However:
- `markerStrip.js:22` reads it: `STRIPPED_MARKER_NAMES = Object.keys(MARKER_SCHEMAS)`.
- `validateDmMarkers` reads it, because it loops over every key.

If the schema went, a stray `[BOND_SHIFT: …]` from the model would no longer be stripped and would show in the player's text. That is a visible change, so the schema and its test (`sc6-4a…test.js:176-180`) stay. Removing it safely needs either a ruling that the risk is acceptable, or a strip-list entry that does not depend on the schema.

## Item 5 — PreludeSession comment (corrected)
`client/src/components/PreludeSession.jsx:159` said the `message` field is "set on retryable errors like 503 OVERLOADED". No `OVERLOADED` exists anywhere in `server/`, `client/src/` or `tests/`.

The behaviour still exists under another name. `server/routes/prelude.js:281-291` returns HTTP 503 `{ error: 'Local AI not available', message: …, retryable: true }` on `LOCAL_MODEL_UNAVAILABLE:` and `LOCAL_MODEL_MISSING:`. The comment now names that.

## Item 6 — `markerSchemas.js` duplicates (resolved)
Seven keys were defined twice in `MARKER_SCHEMAS`:

| Key | First copy | Second copy |
|---|---|---|
| ATTACK | :207 | :1191 |
| DODGE | :250 | :1514 |
| DISENGAGE | :258 | :1523 |
| HELP | :266 | :1532 |
| HIDE | :275 | :1542 |
| READY | :283 | :1564 |
| MASTERY_SET | :292 | :1218 |

In a JS object literal, a duplicated key keeps its **first position** but takes its **last value**. So the second copies were the ones read, and the first copies' contents were never read.

The position still matters. `markerPipeline.js:101` dispatches handlers in `Object.keys` order, and ATTACK sits at index 12, ahead of RAGE at index 87. Deleting the first copies would have moved ATTACK and changed dispatch order. Instead, I put each live definition into the first slot (the old field comments are kept) and deleted the second copies.

**Proof.** I took a JSON snapshot of `{ keys: Object.keys(MARKER_SCHEMAS), schemas: MARKER_SCHEMAS }` before and after the edit. The script is a pure module import; markerSchemas.js has no imports and no database access.
- Both snapshots have SHA-256 `173735fc5a5f346a08c7a6f4f2d61d6c8f33fa7303bee735c60a693c71e937b4`.
- `cmp` reports them identical: 133 keys, in the same order, with the same values.
- 0 duplicate keys remain.

## Item 4 — retargeted comments (24 sites, 20 files; migrations skipped)
| File:line | Was | Now |
|---|---|---|
| `server/data/teamTactics.js:4` | `PARTY_SYNERGIES.md` | `SYNERGIES_DESIGN.md` Part 1 |
| `server/data/subclassThemeSynergies.js:5` | `SUBCLASS_THEME_SYNERGIES.md` | `SYNERGIES_DESIGN.md` Part 2 |
| `server/data/themeGoldModifiers.js:5` | `PHASE_2_CREATOR_SPEC.md` | `archive/PHASE_2_CREATOR_SPEC.md` |
| `server/services/campaignCanonTransferService.js:6` | same | same |
| `server/services/preludeTransitionService.js:182, 381` | same | same |
| `client/src/components/creator-next/storyStarters.js:32` | same | same |
| `client/src/data/themeBackstoryMoments.js:3` | same | same |
| `client/src/data/themeBondsPrompts.js:4` | same | same |
| `client/src/data/themeFlawsPrompts.js:4` | same | same |
| `client/src/data/themeGoldModifiers.js:5` | same | same |
| `client/src/data/themeIdealsPrompts.js:4` | same | same |
| `client/src/data/themeNarrativeContinuity.js:3` | same | same |
| `client/src/data/themePersonalityPrompts.js:4` | same | same |
| `server/routes/dmSession.js:~3117` | `KNOWN_BUGS.md` | `archive/KNOWN_BUGS.md` |
| `server/services/notorietyService.js:315` | `KNOWN_BUGS.md` | `archive/KNOWN_BUGS.md` |
| `server/services/npcAgingService.js:140` | `DECISION_LOG + KNOWN_BUGS.md` | `archive/DECISION_LOG.md + archive/KNOWN_BUGS.md` |
| `server/services/npcAgingService.js:241` | `KNOWN_BUGS.md` | `archive/KNOWN_BUGS.md` |
| `tests/sc6-4c-promise-notoriety-schemas.test.js:6` | `KNOWN_BUGS.md` | `archive/KNOWN_BUGS.md` |
| `server/services/aiBehaviorSignals.js:28, 417` | `PHASE_4_OVERVIEW.md` | `archive/PHASE_4_OVERVIEW.md` |
| `server/services/preludeCanonThreadService.js:11` | `PRELUDE_IMPLEMENTATION_PLAN.md §3d / §5h` | `PROLOGUE_DESIGN.md §3d / §5h` (the section numbers are kept in the merged doc) |
| `server/services/timeBoundedState.js:6` | `triage/pattern-d-survey.md` + `PHASE_3_REFACTOR_SPEC` | `archive/triage/…` + `archive/PHASE_3_REFACTOR_SPEC.md` |
| `server/services/baseThreatService.js:82` | `triage/kingdom-management-survey.md §0` | `FORTRESS_DESIGN.md` Appendix A §0 |
| `server/services/baseThreatService.js:84` | `PHASE_3_7_SPEC.md §1.2` | `FORTRESS_DESIGN.md` §3 (its §1.2) |

Migration comments left as written: `server/migrations/042_prelude_scaffolding.js:5`, `048_prelude_handoff.js:27` and `049_creator_creating_phase_and_heirlooms.js:33`.

The same commit also corrected five stale comments that described the deleted legacy exports as still present:
- `routes/dmSession.js:130-146` (the import block)
- `pietyService.js:15, 227`
- `markerSchemas.js` (the ATTACK/RAGE and SEARCH section notes)
- `dmPromptBuilder.js:436`

## Item 7 — docs/ dead-rule sweep
I searched `docs/` with the registry cleanup's own zero-hit terms, plus `origin explanation`, `origin-explanation`, `outside-FR`, `outside FR` and `outside the Realms`. `docs/` contains only `docs/pm/`. Every hit is in a historical brief or report:
- **Briefs** (job instructions as given, kept as records):
  - `docs/pm/creation-solidification/BRIEF.md:45, 90`
  - `docs/pm/registry-origin-rule-cleanup/BRIEF.md:35, 45`
  - `docs/pm/creator-round-3/BRIEF.md`
- **Reports** (records, not edited, per the brief):
  - `docs/pm/reports/creation-solidification-REPORT.md` (4 lines)
  - `creator-round-3-REPORT.md:71`
  - `registry-origin-rule-cleanup-REPORT.md` (20 lines)
  - `combat-resolution-REPORT.md`
  - `full-codebase-audit-REPORT.md`
- `docs/pm/HANDOFF.md` has no hits.

**Nothing was deleted:** there is no live doc in `docs/` that states the dead rule.

## Files changed
Code commit `4862489` on `phase-4-hybrid-combat`: 49 files, +333 / −3,115. There are no migrations. Sizes and SHA-256 hashes are after the change.

| File | Status | Bytes | SHA-256 |
|---|---|---|---|
| client/src/components/CompanionManager.jsx | **deleted** (was 30,725 B) | — | — |
| docs/pm/l1-l6-cleanup/BRIEF.md | new | 11506 | 1f36c7953b6480eeb8daacbe1d915cefed098abd3de162ea544de44fca261698 |
| package.json | edited (1.0.229) | 1398 | ba91c392b1d2bdb6a45b499e35aebb4ab24de7ac5e31da207dc8bb277878b6db |
| client/package.json | edited (1.0.229) | 427 | 96a100bbadfc6b3c0aaf14e26769825cf011745738883bbdb4336ba4579ca35e |
| client/src/components/PreludeSession.jsx | edited | 46576 | af9b25da7d796abc25940082d212c77710e279eebe114315238a6e0ee82ac93b |
| client/src/components/creator-next/storyStarters.js | edited | 8009 | ee6f0ae6f85b4d9180750a5d88c29f0088d6be01af30f506f3f411ec09ef49f3 |
| client/src/data/themeBackstoryMoments.js | edited | 22568 | 2fabc23abcf2b046e88cc942da00f4e15a3e0fb010a4d8ab3acfc1873d47e49a |
| client/src/data/themeBondsPrompts.js | edited | 20426 | 1a8c1208c7ae86c105c10abad5dd7b58c5bcad05a593ba4a7a922ab94df447a9 |
| client/src/data/themeFlawsPrompts.js | edited | 17054 | c15387e2f05ef99fdfe0611801990920ac5556fb74d8d793154786f4cf729fe8 |
| client/src/data/themeGoldModifiers.js | edited | 1546 | 73127dd9e07144337e7aea42c28bb1ff29885dd71c21575c240445aeb1953417 |
| client/src/data/themeIdealsPrompts.js | edited | 20216 | 31b37e732e9cd7951674085536642b237a71dba6f76ded4403288e68a09691d0 |
| client/src/data/themeNarrativeContinuity.js | edited | 5119 | e6df415598fd5988bce73478d360f263d0d7c26e5b3ce428bb89a6bfe9057226 |
| client/src/data/themePersonalityPrompts.js | edited | 45110 | 841260e34012b957dc7276cdd8ecb36e01b7b4d762c9c359026c21755be07ec7 |
| server/data/subclassThemeSynergies.js | edited | 24997 | bacaaede7d59d50edcb20a02e7283f9b55a714155800af8798bb1aeba8a1b3af |
| server/data/teamTactics.js | edited | 10250 | 11a6f641c9481ef495b89c9f892283d2eda2ea9434a0e22b051a8ef6442310fe |
| server/data/themeGoldModifiers.js | edited | 1546 | 73127dd9e07144337e7aea42c28bb1ff29885dd71c21575c240445aeb1953417 |
| server/routes/dmSession.js | edited | 242523 | c59cf900a67fa165a0d63123b019b3d07d69f4ca9e0321bf594935a498b9610e |
| server/services/aiBehaviorSignals.js | edited | 21935 | afb30d9db72e32e74f044421234a2c4f58474c4a72e609570eae8caf82581f5f |
| server/services/baseThreatService.js | edited | 35358 | 4e17b59963254d99c7b877cada296b65bd5d91b7da582ede3d7320439bc35b58 |
| server/services/campaignCanonTransferService.js | edited | 7560 | 67ef311fae66cfeca5c736a425b079f6f2ef60cf203a53dfabf104eb7a03e315 |
| server/services/companionBackstoryService.js | edited | 18507 | 72c4b7f8d574a8548035c1674227469192b3242d538a8131038b4b1994c1d906 |
| server/services/companionSheetService.js | edited | 7731 | 6cd7635863b325e1e65c0bc90f991ab9771827038e6e32f55b5ad739b1c28e29 |
| server/services/dmPromptBuilder.js | edited (comment) | 199207 | 0a719fd39033ad4413432ad363ad5c47355fce731ebff478c14eb67a3ba00eab |
| server/services/dmSessionService.js | edited | 33997 | 07d2ca4d68ff4839f8537e743e001ac7439ac36ad3259dca4c0070dc46b07e81 |
| server/services/eventEmitter.js | edited | 4849 | c41908aa7addc7d6a40cd293cacf86096d181ce944b1e7359c45110bcf619368 |
| server/services/markerSchemas.js | edited | 65995 | 172f29b01751954a5f857424bcd6f0f3eaebc94ac90b5e61a31dfee9a5c6844a |
| server/services/narrativeQueueService.js | edited | 9599 | 76b5fdf802d309e5ba9c84cbd87daba1d6cd4a92f87e8fd8f0f62c55ebe15818 |
| server/services/notorietyService.js | edited (comment) | 14118 | c899fdea23b623fd5d9cab8f170c307f515d63034b84b14565565eb770a52d0e |
| server/services/npcAgingService.js | edited (comment) | 15047 | a1452a7041bffef894f5f107c022c372cbbf28e1e383543dec9080aa8c98ef02 |
| server/services/npcVoiceService.js | edited | 9659 | 891f5e3616ce9193863500baa2fde36664a835050170c2fef37a6282ae1cec1c |
| server/services/pietyService.js | edited (comment) | 15329 | da42b5d21eec0f8bb448df0d2ffc619e3a4b600483f8b5012bd89236f0e86fbf |
| server/services/preludeCanonThreadService.js | edited (comment) | 5902 | fb698d010de2320d25c9680a730a6792f2fb6cf9a093d381868bef0242c95bb4 |
| server/services/preludeTransitionService.js | edited (comment) | 28344 | 274a1dba3e0822b2c4f56b39d08a2e141998891ff5a5c6049b06a7e5ab982141 |
| server/services/timeBoundedState.js | edited (comment) | 16028 | 442e6b2023c25f2f652786272d5f9679ff0595bfcee16fccf29d0c6c567ba5e0 |
| tests/combat-tracker.test.js | edited | 1485 | 569a37d429dca53eb8e19468173b4772b8f2cb71ed9996b1f620fb27d8497ade |
| tests/consequence.test.js | edited | 16261 | 5dfe05907e2cbb67925e36dba9530f73b623a18eaf98cab1283fd2bb8e9849e3 |
| tests/crafting.test.js | edited | 18202 | 16aec8fa586a6267e858b3105f069f3d16f0cfb6f31199365c887e3d755eee20 |
| tests/faction-quests.test.js | edited (unused import) | 23229 | 6ef5490210ff87c3d08519acc17606753b3b205477342d9c16980335101f74f9 |
| tests/loot-systems.test.js | edited | 9762 | 99a01d40e08034d9e39b0cc22169e41c5379ca2305270a896112eb2a44476e8a |
| tests/marker-detection.test.js | edited | 8806 | 40cb967c961fc94e7354be1022022ae45269ca1de0d37d3339a1fe0ecac526ca |
| tests/mythic.test.js | edited | 21266 | 8c69952c0aaf1b0d3013aa7be8b240d95b6cf25efe851de6514abee9303bbaae |
| tests/narrative-queue.test.js | edited | 14187 | 10d06abb1dafdc3ec64321fe6e22edbe807ee73adca4cb7b7f7d9be8537fbbd0 |
| tests/rest-calls-client.test.js | edited (comment) | 17908 | 7cbdeca7485323f1f289e11ca2c30e6bd44aee3a364d78c8973be6bcbed5f1b4 |
| tests/sc6-4a-survival-crafting-schemas.test.js | edited | 8839 | f7ef5322d6b40f654845bf7e885d94b84e66d52fdb89eb5304eedb7d522eaed7 |
| tests/sc6-4b-merchant-schemas.test.js | edited | 12948 | dc643009c55a36975435531470fab9d612613d591857e3846f4ab29582f7f63d |
| tests/sc6-4c-promise-notoriety-schemas.test.js | edited | 7610 | 4e5299acc058da7a368f7154b24e84c1984bd644231281c720ee73262228cc40 |
| tests/sc6-4d-combat-mythic-schemas.test.js | edited | 8067 | 8ef7dfe3d9e0f404922eb19f9ccd87b89e09357e6a75397ebdc4b1585d6ea174 |
| tests/survival.test.js | edited | 9540 | 61657f6156003207feb81b45f49f4d45101119080c96ac2be8fc6f758cf264da |
| tests/weather.test.js | edited | 19496 | 77aabf5191079c64429ca3519347f6107ef2d64f44d20c5f592cea176c7687e3 |

This report (`docs/pm/reports/l1-l6-cleanup-REPORT.md`) is committed separately, on top of `4862489`.

## Deletion list with one-command restores
The backup is git history: the pre-job state is commit `99cc002`, which is on `origin`.
- Restore everything at once: `git checkout 99cc002 -- server client tests`. This undoes the whole job, including the comment edits.
- Or revert the commit: `git revert 4862489`.
- Restore a single file:

| What | One-command restore |
|---|---|
| 26 L1 detectors + `parseMarkerKeyValue` (dmSessionService.js) | `git checkout 99cc002 -- server/services/dmSessionService.js` |
| 14 eventEmitter functions | `git checkout 99cc002 -- server/services/eventEmitter.js` |
| 9 narrativeQueue functions + `PRIORITY_ORDER` | `git checkout 99cc002 -- server/services/narrativeQueueService.js` |
| 14 companionBackstory functions/consts | `git checkout 99cc002 -- server/services/companionBackstoryService.js` |
| `getCompanionSheet` | `git checkout 99cc002 -- server/services/companionSheetService.js` |
| `formatVoicePaletteForPrompt` | `git checkout 99cc002 -- server/services/npcVoiceService.js` |
| `CompanionManager.jsx` | `git checkout 99cc002 -- client/src/components/CompanionManager.jsx` |
| markerSchemas duplicate copies | `git checkout 99cc002 -- server/services/markerSchemas.js` |
| Deleted test sections (per file) | `git checkout 99cc002 -- tests/<file>.test.js` |

If a service file is restored, restore its tests from `99cc002` too.

## What was built (in play)
Nothing changes for the player. The six-stage creator, sessions, combat, markers, companions and the prologue behave exactly as before.

The game's marker handling is now one parser (the marker pipeline) instead of a pipeline plus 26 dormant look-alikes. The combat marker schemas are defined once, with the same dispatch order.

## Test results
**Full `npm test` (PC, after the change): Files 272/273 green | Assertions 20,632 passed, 5 failed.**

The single red file is `return-loop.test.js` (81/86), with exactly the five standing named checks:
1. `[tick] GAP G-7: a world-clock advance at session end evaluates scene evolution`
2. `[protect] GAP G-4: the player's downtime assignment for TEST_RL_D Mira is scheduled`
3. `[protect] GAP G-5: full downtime jumps the clock by its span, 5 days`
4. `[protect] GAP G-6: the client's end-session request can carry the player's downtime choice`
5. `[protect] GAP G-6: the steward's downtime question is put to the player at session end`

There are no new failures.
- `pass*`: `companion-sheet` and `subclass-scanned2` hit the known Windows native-exit crash after all their assertions passed, and the runner counts them green.
- `spellbook-routes` passed (494/494) within the time cap.

**The assertion count fell by 188 from the last run (20,820 at v1.0.228).** Removed assertions, from the runner's per-file counts:

| Suite | Before | After | Removed |
|---|---|---|---|
| marker-detection | 128 | 58 | −70 |
| weather | 302 | 270 | −32 |
| survival | 66 | 44 | −22 |
| crafting | 151 | 91 | −60 |
| **Total** | | | **−184** |

- **Unchanged:** `sc6-4a` 62, `sc6-4b` 47, `sc6-4c` 36 and `sc6-4d` 48. Each "still exported" check became a "no longer exported" check: sc6-4d replaced 7 checks with 6 + 1. `rest-calls-client` stays at 58 and `companion-loyalty-prompt` at 33.
- **Not in the runner's total:** these suites print their counts in a format the runner does not parse. They are green, and I counted the removed `assert` lines statically:

| Suite | `assert` lines removed |
|---|---|
| consequence | 62 |
| mythic | 31 |
| combat-tracker | 18 |
| loot-systems | 10 (all `console.assert`) |
| narrative-queue | 8 (two groups) |
| faction-quests | 0 (unused import only) |

- **The other 4 of the 188 are not attributed to a specific file.** The 20,820 baseline is from the previous job's run, not a fresh run at `99cc002`. My best explanation is run-to-run variation in a suite whose assertion count depends on its data. I did not prove it, and no extra failure appears.

## Cost and usage
I can't measure this session's cost from inside the session. It was a long, survey-heavy session: one full suite run plus about 15 targeted suite runs.

## Not done / still open
1. **BOND_SHIFT schema and its test:** it has a live generic reader (item 3).
2. **L2 `consequenceService`:** `getUndeliveredConsequences` and `markConsequenceDelivered` are tests-only, but the audit marked whether consequences reach the player as unverified.
3. **L4:** the duplicated prepared-spell tables are live duplication; merging them is a refactor.
4. **L5:**
   - the Spelljammer label (`spellCatalogData.js:28` vs `:129`) needs a data choice;
   - `PROPOSED_WEAPONS` `mastery: 'TBD'` is staged data that a test asserts on.
5. **L6:** the unused endpoints are mounted, reachable routes, so pruning them is a product decision.
6. **Two unused imports** were left as they are, since they are live-module imports, not dead code:
   - `parseNpcJoinMarker` at `routes/dmSession.js:129`;
   - `server/tests/*.js`, old scripts that `npm test` does not run, still reference some kept functions.

## Decisions made (reversible, for veto)
1. **Tests-only functions counted as dead** (`markMultipleDelivered`, `getQueueStats`, and every L1 detector). A test is not a live caller.
   - **Reversal:** restore the file pair from `99cc002`, about 2 minutes.
2. **Three uncalled eventEmitter utilities, `PRIORITY_ORDER`, `getDormantThreads` and the private `MOOD_RP_GUIDANCE` were deleted** even though the audit did not name them. They are the same defect and have zero readers (fix-as-you-find).
   - **Reversal:** a one-file restore each.
3. **The sc6-4a–d "still exported" checks now assert "no longer exported"**, rather than being deleted outright. This guards against a second parser coming back (CLAUDE.md rule 2).
   - **Reversal:** delete those four loops, about 5 minutes.
4. **The duplicates were merged into the first position** rather than the first copies being deleted. This keeps the dispatch order, and the runtime object is proved identical.
   - **Reversal:** restore `markerSchemas.js` from `99cc002`.
5. **The consequenceService pair, L4, L5, L6 and BOND_SHIFT were kept** under "a wrong deletion costs more than a leftover". Each can be deleted later in one targeted job.
6. **Comments for archived docs point at `archive/<file>`, and comments for merged docs point at the merged doc.** These are comment-only.
   - **Reversal:** restore the file from `99cc002`.

## Needs Zach's decision
None. Everything still open is a PM scope call inside the brief's latitude (listed above).

## How to verify
- **Commit:** `4862489` (code) plus the report commit after it. Branch `phase-4-hybrid-combat`. PC repo `E:\DnD Meta Game\dnd-meta-game`.
- **Gate:** `npm test` from the repo root. Expected: **272/273 files green**, with `return-loop.test.js` at 81/86 and exactly the five named GAP checks red, and no other failure.
- **Spot checks:**
  - `npm test marker-detection` → 58/58
  - `npm test sc6-4` → 193 passed
  - `npm test weather` → 270/270
  - `npm test survival` → survival.test 44/44
  - `npm test crafting` → crafting.test 91/91
- **The one final :5173 test** (listed, not run in this job; Zach 2026-11-24):
  1. Start the app (`npm run dev` or the usual start). The server boots with no import error in its log. That proves every deleted export had no importer.
  2. The home page lists characters. Open a character and its sheet loads, including the spell tab for a caster.
  3. Open the Companions page. Companion cards and the companion sheet still render, which proves `CompanionManager.jsx` was unused.
  4. Start or resume a DM session. The opening narration arrives with no bracketed markers showing. Send one action that starts combat: initiative and the combat tracker appear, and an attack resolves. That checks the merged ATTACK and DODGE schemas.
  5. End the session. The session-end flow completes, with no new failure beyond the known downtime gaps.
  6. Optional: open a prologue session and send a message with Ollama stopped. You should see the "Local AI not available … your input has been preserved" message (the corrected comment's path).
