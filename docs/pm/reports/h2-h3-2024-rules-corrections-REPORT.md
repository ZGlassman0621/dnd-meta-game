# Report — H2+H3: 2024 rules corrections (long-rest Hit Dice + prepared-spell caps)

Builder: Claude Code (Opus 5.5). Brief: `docs/pm/h2-h3-2024-rules-corrections/BRIEF.md`.
Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.201 → **1.0.202**.
Commit: recorded by a follow-up commit (see the line added at the bottom of this file).

## Understanding
The project is a solo D&D 2024 "forever game": one human player character, with the DM, NPCs, companions and enemies played by an AI (gemma4:12b on the PC). The server owns the rules facts (HP, Hit Dice, spell slots, prepared-spell limits); the AI narrates.

Two 2014 rules were still in the build. **H2:** a long rest gave back only half of a character's Hit Dice (minimum 1). In 2024, a long rest gives back all of them. **H3:** bards, clerics, druids and wizards could prepare "ability modifier + level" spells. In 2024 the number is printed in each class table's Prepared Spells column, and it is the same at every modifier: every 1st-level bard, cleric, druid or wizard prepares 4. This job makes both rules 2024 everywhere they live and leaves every other rest and spell rule alone.

**Where my understanding differs from the brief (all within its latitude):**
1. **Cleric, druid and wizard already had validators.** The brief says (from the 2026-11-06/07 record) that only the bard among the four had a sheet-save / level-up validator. The live repo also has `wizardService` (2026-11-07), and `clericService` and `druidService` (2026-11-09), all wired into `PUT /api/character/:id` and `POST /level-up` (`server/routes/character.js:4428, 4484, 4541, 7625, 7662, 7697`). All three encoded the 2014 formula. Under "correct an existing validator's formula IS this job", I corrected all four. **No new validator was wired** (paladin's missing validator stays a separate follow-up).
2. **One choke point for Hit Dice, as the brief hoped.** All three long-rest paths (player, companion, downtime) call one function, `hitDiceRegain`. The rule changed there, once.
3. **Two sibling 2014 sites outside the brief's list:** the companion creator (`PartyBuilder.jsx`) had its own cleric/druid "mod + level" count and a 2014 bard known-spells row. The fallback the creator uses when the spells endpoint is down could also return no count for a modifier outside −1…+5. Both are fixed (fix-as-you-find-it, below).

## Verdict
**BUILT + GREEN** on the builder's run (Files 248/248 green, assertions 19,655 passed, 0 failed). Not a gate: Zach's own `npm test` and the `:5173` checks gate it.

## Per-item verdicts
| Item | Verdict | Evidence |
|---|---|---|
| 1. Survey first | **Built** | Both inventories below, with file:line and disposition. All audit evidence points verified against live bytes. |
| 2. H2 long-rest rule | **Built** | `hitDiceRegain` (`server/services/restTimeService.js:175`) returns "nothing spent". It is the one function every long rest uses: PC `:379`, companion `:604`, downtime `:815`. A character with nothing spent regains nothing. The pool itself is never changed, so the result can never go above the maximum. Short rests are unchanged (`spendHitDice`, `:141`). No second long-rest implementation exists. |
| 3. H3 server caps | **Built** | `getSpellsPrepared` (`server/config/levelProgression.js:2121-2122`) reads two new fixed tables (`:1716`, `:1724`), with no modifier input, following the paladin/sorcerer/ranger pattern. The old `mod + lvl` fall-through is gone (`:2130` returns null). The four services' `preparedSpellsMax` read the same tables and keep their `(mod, level)` signature, so the route call sites did not change. No new validators were wired. |
| 4. H3 sheet + creator | **Built** | The sheet `getMaxPrepared` (`client/src/components/CharacterSheet.jsx:745-748`) uses client table constants, proven equal to the server at every level × modifier. The Stage 4 creator validator calls `getSpellsPrepared` (`character.js:1157, 2828`), so it follows automatically. The no-endpoint fallback dataset was regenerated: exactly the four classes changed, each now "table, 4 at every modifier". `GET /api/spells` calls `getSpellsPrepared` (`server/routes/spells.js:197`), so no route change was needed; proven live below. |
| 5. Tests | **Built** | New `tests/h2-h3-2024-rules.test.js`, **89/89**. 16 existing suites updated from 2014 expectations to the tables (list below). |
| 6. Prove at `:5173` | **Server half proven live with the real model; UI clicks not done by me** | No browser tool in this session. I booted the real server against a throwaway database with the real gemma4:12b. A real long-rest turn brought 3 spent dice back to 0 spent, and `GET /api/spells` serves 4 at L1 for all four classes (output below). Click steps are in "How to verify". The prepared cap is visible on the sheet. Hit Dice are not shown on any screen (a pre-existing gap), so the long-rest check by hand is indirect. |

## Item 1 — survey

### Audit evidence, checked against live bytes (audit line numbers were from `6084b18`)
| Audit claim | Live bytes before the change | Holds? |
|---|---|---|
| Long rest regains half the Hit Dice, min 1 | `hitDiceRegain`: `Math.max(1, Math.floor(total / 2))` (`restTimeService.js:170-183`) | Yes |
| Half rule on the player path (:378) | `restPc` → `hitDiceRegain` at `:382` | Yes |
| … companion path (:603) | `restCompanion` → `hitDiceRegain` at `:607` | Yes |
| … downtime path (:814) | `applyDowntimeRest` → `hitDiceRegain` at `:818` | Yes |
| The sheet rest route is gone | No other writer of `hit_dice_used` / `companion_hit_dice_used` anywhere in `server/` (only `restTimeService.js` and migrations 029/082) | Yes |
| Cleric/druid/wizard arm is mod + level, bard arm `max(1, mod + lvl)` | `levelProgression.js:2099` (bard) and the final fall-through `:2106` | Yes |
| The sheet mirrors the arms | `CharacterSheet.jsx` cleric/druid/wizard/bard branches, all `Math.max(1, mod + character.level)` | Yes |
| `bardService` carries the formula | `preparedSpellsMax = max(1, Cha mod + level)` | Yes |
| No cleric/druid/wizard validator | **No:** all three exist and are wired (see Understanding 1) | Differs |

### (a) Every Hit Dice restore path
| # | Path | File:line (live, after the change) | Disposition |
|---|---|---|---|
| 1 | Long-rest regain rule | `server/services/restTimeService.js:175` `hitDiceRegain` | **Changed**: all spent dice back |
| 2 | PC long rest (DM `[REST: Type=long]`) | `restTimeService.js:369` `restPc`, calls it at `:379` | Inherits the rule |
| 3 | Companion long rest (same marker) | `restTimeService.js:593` `restCompanion`, calls it at `:604` | Inherits the rule |
| 4 | Downtime long rest (`POST /api/downtime/complete/:id`) | `server/routes/downtime.js:1684` → `applyDowntimeRest` `restTimeService.js:802`, calls it at `:815` | Inherits the rule |
| 5 | Downtime route's own long-rest block | `downtime.js:1118` (HP and rations only; it never touched dice), plus `:342`. Both comments said "half" | Comments corrected; no logic there |
| 6 | Short rest: spends dice to heal | `restTimeService.js:141` `spendHitDice` | Unchanged (out of scope) |
| 7 | DM prompt rest rules | `server/services/dmPromptBuilder.js:2213` said "half of spent hit dice regained" | **Changed** to "ALL spent hit dice regained" |
| 8 | Player-facing text | `client/src/components/DMSession.jsx:2174` (long-rest button tooltip), `client/src/components/Downtime.jsx:37` (rest description) | **Changed** to "all your spent Hit Dice" |
| 9 | Pugilist Peak Physical Condition (L20): "regain ALL expended hit dice instead of half" | `server/services/pugilistService.js:37, 342` (prompt-only) | Left alone. Still true, now redundant (reported) |
| 10 | Mythic "Dawn's Blessing": "Long rest restores additional hit dice equal to WIS modifier" | `server/config/mythicProgression.js:203` (description only, no engine, post-MVP) | Left alone. It now has no effect (reported) |
| — | Not a long-rest restore | Scholar Treating Physician (short rest), Periapt of Wound Closure, Halfling Quick Healer, Arcane Vigor (spend dice), `POST /full-reset/:id` (`character.js`, does not touch dice) | Untouched |

No second long-rest implementation survives; the Prelude has no Hit Dice.

### (b) Every place the 2014 prepared formula lived (bard / cleric / druid / wizard)
| # | Location | File:line (live, after the change) | Disposition |
|---|---|---|---|
| 1 | Server arm | `server/config/levelProgression.js:2121-2122` (was the bard arm + final fall-through) | **Changed**: tables `:1716` (bard/cleric/druid), `:1724` (wizard); fall-through removed |
| 2 | Server header comment | `levelProgression.js` Stage 4 comment ("cleric, druid, wizard: ability modifier + class level") | Corrected |
| 3 | Bard validator | `server/services/bardService.js:52, 57` | **Changed** to the table |
| 4 | Wizard validator | `server/services/wizardService.js:49, 54` | **Changed** to the table |
| 5 | Cleric validator | `server/services/clericService.js:31, 37` | **Changed** to the table |
| 6 | Druid validator | `server/services/druidService.js:35, 41` | **Changed** to the table |
| 7 | Route callers (PUT + level-up) | `server/routes/character.js:4140, 4428, 4484, 4541, 7470, 7625, 7662, 7697` | Unchanged calls (they pass the mod, which is now ignored). Six formula comments corrected |
| 8 | Stage 4 creator validator | `character.js:1157/1160` and `:2828/2830` → `getSpellsPrepared(cls, 1, mod)` | Inherits (proven: L1 = 4 at every modifier) |
| 9 | `GET /api/spells` | `server/routes/spells.js:197` → `getSpellsPrepared` | Inherits (proven in the test and live) |
| 10 | Sheet `getMaxPrepared` | `client/src/components/CharacterSheet.jsx:745-748` | **Changed** to client tables |
| 11 | Creator no-endpoint fallback dataset | `client/src/data/spellCatalog.generated.json`, regenerated by `scripts/generate-spell-catalog.js` | **Regenerated**: only the four classes changed (`modPlusLevel` → `table`, 4 at every probed mod); 28 lines in, 28 out |
| 12 | Fallback reader | `client/src/components/creator-next/spellCatalogFallback.js:63, 77` | **Fixed**: a fixed column now answers at any modifier, e.g. a rolled Int 7 (−2) wizard |
| 13 | Stage 4 fallback comment | `client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx` | Corrected |
| 14 | Companion creator (sibling) | `client/src/components/PartyBuilder.jsx:146, 214`: cleric/druid "WIS mod + level", bard a 2014 known row | **Fixed**: bard/cleric/druid read the table |
| 15 | Spellbook comment | `server/services/spellbookService.js` header ("Int mod + wizard level") | Corrected |
| 16 | Generator comment | `scripts/generate-spell-catalog.js` ("modPlusLevel … cleric, druid, wizard") | Corrected |
| 17 | `classes.json` | `client/src/data/classes.json`: cleric/druid/wizard have no cap field; bard has a 2014 **known**-spells row `spellsKnownByLevel` (`:936`) | Left alone. It is only read for "Limited known" casters (`CharacterSheet.jsx:3779-3839`), and bards are "All prepared", so it is never shown. It is a spells-known count (out of scope) (reported) |
| 18 | Tests asserting the formula | 16 suites (see Test results) | Updated to the tables |

Other datasets checked and clean: `server/data/spellCatalogData.js` (no caps), `client/src/data/spellCatalog.generated.json` (regenerated), `client/src/data/classes.json` (row 17).

## Files changed
| File | New / edited | SHA-256 | Bytes |
|---|---|---|---|
| `server/config/levelProgression.js` | edited | `2913a8f7a31cefb3b0f5673f4477f183a8f6d6549428d26258fe9257869e77bd` | 74,182 |
| `server/services/restTimeService.js` | edited | `3c4c0177ba546a36e7cdb2a6e08b27b2d376abdf86e66da6aeac9d5b043a0377` | 50,934 |
| `server/services/bardService.js` | edited | `da5c805ce44f922ded285375c117aaf5cfe9d5333f9d30555bb51a43abc17f6e` | 3,461 |
| `server/services/clericService.js` | edited | `1c46e25ad74a78cff8686756779310861a8006bf4e0a4344895fec2940f73bff` | 2,495 |
| `server/services/druidService.js` | edited | `5a303f2b4b5aaf693429c8c339925d637988d9db61fc1ebc4b91d81a1ca16b8e` | 2,741 |
| `server/services/wizardService.js` | edited | `dd13338d2419e2b8925850f91c4fbe600f009f7a29265a86031862d7130818c7` | 2,964 |
| `server/services/spellbookService.js` | edited | `dd1de2a0f0a43b59a87fdaa985ed4446a664ca75fb0dcb4090ff1363d6dd1ee3` | 39,794 |
| `server/services/dmPromptBuilder.js` | edited | `2fc693abab9bebcdf2ac0d9285bfcc20c9c36ac7bd0083dc4aac8abd0cd673a7` | 189,841 |
| `server/routes/character.js` | edited | `1e1119f30341c856d4e7582093423d2b653741166e1620a5129a100d5fb9bf1a` | 430,191 |
| `server/routes/downtime.js` | edited | `8f13b8fc66d65f45cac33ef9d73b25aa327ab4a142cc9664bf39459c4b0fd0c8` | 76,850 |
| `scripts/generate-spell-catalog.js` | edited | `e9e31ec0b8f96dc27234e16b89f6f57d9ba5c295fa67d7adb53ef9c9a1625a34` | 5,704 |
| `client/src/components/CharacterSheet.jsx` | edited | `2c331b06181cb1ccbb69a28e1ae20e84a656fddc6995cd36948ff392b03455f3` | 274,083 |
| `client/src/components/DMSession.jsx` | edited | `ecc41d35a97bb19635e9d88a454bff056fa5960c9e5c63afd5b5a38df3e74d3b` | 130,372 |
| `client/src/components/Downtime.jsx` | edited | `e8bb05ecb5bb43ac54111a95ea37b540c74bbc67d3ad68bcc553caf8db456d2c` | 32,034 |
| `client/src/components/PartyBuilder.jsx` | edited | `b201d26817033ff15413ca1be4a626404941420437d17e7e9cda04e2c16b83c1` | 113,789 |
| `client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx` | edited | `a4043377e22faab886f91221b33a4ab2fb77478e3445a9953a9f507e1857a061` | 71,201 |
| `client/src/components/creator-next/spellCatalogFallback.js` | edited | `bde8b9874f5f3d3da2b641ad552e058e23153aa267b2b560382d98c41da81f13` | 8,174 |
| `client/src/data/spellCatalog.generated.json` | edited (regenerated) | `031c7bf9e5848bbff61598eb03755374da7ef6acbc4da1e2fe3eb07e788a78da` | 437,788 |
| `package.json` | edited | `9fb5eb72eb5f9c2850cb9cf7953b081621d1580f81833c8bf9e2e32d5041feff` | 1,398 |
| `client/package.json` | edited | `43d683f940de2505009f039f05506fa6aabc57d64c55a271000627f093479ed5` | 427 |
| `tests/h2-h3-2024-rules.test.js` | new | `f03cfb80afc9a9c70a3591046dd1b1dd1c412676ca51daea16b6ad2f4175d980` | 23,161 |
| `docs/pm/h2-h3-2024-rules-corrections/BRIEF.md` | new | `f24bbba9b7bf5f4765ceaf25000e9cb2cf7c7d7f4a2a0fb678413d72ab608756` | 11,398 |
| `tests/rest-time.test.js` | edited | `80ec46dfff0016e765cc523277c620930d7e4ccf396ec7f5d81a123eed5f3831` | 64,410 |
| `tests/downtime-rest.test.js` | edited | `76478391e80a89ee3c1d3716bf2eb3cb8724ca7bd4875491ba4d38f4e4d76820` | 10,650 |
| `tests/bard-prepared-cap.test.js` | edited | `028fbb2ba5f32910651028e763cd97c976e6d461cfd5f6e9a9c6f9c6cee81f8c` | 6,706 |
| `tests/bard-validator-wiring.test.js` | edited | `03c712196aac1a49420054b3e296bc64af6178aecefa237c75e873e110435c90` | 33,674 |
| `tests/wizard-validator-wiring.test.js` | edited | `9862901614ec41d2ba88e0910ba35310a5b00126b34c82e245ae138e2562510c` | 33,899 |
| `tests/mechanics-hooks-always-prepared.test.js` | edited | `d8e93dce3ac3cb7d83ebe8ec2d652c5118d3458c71ab83c750c524d201163063` | 37,189 |
| `tests/sheet-prepared-branches.test.js` | edited | `3b94f3f7c93df97576beeddd49aa4697c66a530f91ae5ef157c6ff8aefdeddd3` | 20,025 |
| `tests/spellbook-routes.test.js` | edited | `6633029341e4c77c15b45034a67c40239da2d4a913324d549175931f2729a43a` | 134,654 |
| `tests/spellbook-service.test.js` | edited | `cc94466ff63e1b15968ab5aecea03edb7467d7925cd7ca0d16e218ed2cc83c88` | 70,061 |
| `tests/artificer-validator-wiring.test.js` | edited | `0f150b03a066a411711105956329f20fd9aaba3f033c87bf13363a4b2f94e5c7` | 22,191 |
| `tests/blackguard-validator-wiring.test.js` | edited | `45ae328e023834c9fbd4ef23af176821e428234890877a9c5c22c9fc7f579a00` | 37,321 |
| `tests/creator-gaps-batch.test.js` | edited | `09359972362c619d34f757a9a49981d31cf30888a2350f09c600c11a6695dff5` | 61,293 |
| `tests/creator-next-stage4.test.js` | edited | `539b0bd9219a7bfe9c2ae4f0c45235019d3517f9ea9282a2d0e9fba85f36e17d` | 87,395 |
| `tests/creator-next-stage5-validation.test.js` | edited | `bd3cc3b5757ac140e8395a894bf13eb149cec836e19296bd7d1fcb1ce79b5f9f` | 51,370 |
| `tests/creator-next-stage6-commit.test.js` | edited | `af8eb4cbad4bc650dc92d25fc8ba5340a3fc1a57f3704c76273299571fb96395` | 90,168 |
| `tests/creator-next-stage6.test.js` | edited | `6ff308f03e975f27959884320c4f0572022a67fe00390f3628f4818e203dae3a` | 91,365 |
| `tests/creator-test-notes-2-server.test.js` | edited | `901ea0ab8743a8df31dd5c8c604200c79f000fe8876f39167db46512a61ef5fc` | 37,230 |

Hashes are of the files as committed. **No migration**: the columns (`hit_dice`, `hit_dice_used`, `companion_hit_dice`, `companion_hit_dice_used`, `prepared_spells`) already exist.

## What was built (in play)
- **Long rest:** a character who spent Hit Dice during the day wakes with the full pool back. Companions are the same, and so is a long rest taken as downtime. Someone who spent none gains none, and nobody goes above their maximum. The DM is told the 2024 rule, and the long-rest button tooltip and the downtime rest description say "all your spent Hit Dice". Short rests still spend dice to heal, exactly as before.
- **Prepared spells:** a bard, cleric, druid or wizard prepares the number in their class table, whatever their modifier. At 1st level that is 4 for all four classes: a +2 caster goes from 3 to 4, a +5 caster from 6 to 4. The column then climbs to 22 at level 20 (25 for the wizard). The character sheet's counter, the creator's spell step (online or with the spells endpoint down), the companion creator, the sheet-save check and the level-up check all use the same numbers.
- **Unchanged:** artificer, paladin, ranger, sorcerer, warlock and blackguard caps, at every level and modifier; spell slots, cantrips and spells-known counts; short-rest mechanics.

## Test results
- **Full `npm test` on the PC, after all edits:** Files **248/248 green**, assertions **19,655 passed, 0 failed** (247 files before this job, plus the new `h2-h3-2024-rules`).
- Windows runner notes from the final run: `ek-at-prepared-cap` and `spellbook-service` were each retried once after a native crash mid-run and passed. `combat-real`, `item-3d-action-markers`, `subclass-scanned1` and `subclass-scanned5` counted `pass*` (libSQL exit crash after all assertions passed).
- **Earlier runs, before the old suites were updated:**
  - Run 1 after the rule change: 233/248 green, 95 assertions failing across 15 suites, every one asserting the 2014 numbers.
  - Next full run: only `blackguard-validator-wiring` failed, 2 assertions. Its control cleric (L5, 10 spells) was legal only under the 2014 cap. I had first misread it as crash noise, so it was fixed last.
- **New suite `h2-h3-2024-rules`, 89/89:**
  - H3 (a): server = table at all 80 level × modifier points [−1, 0, +3, +5] for each class; L1 = 4 at every modifier; the wizard still matches mod + level at the standard ASI modifiers (L1 +3 = 4, L5 +4 = 9, L20 +5 = 25); no `mod + lvl` arm remains.
  - H3 (b): the four services' caps = table at all 80 points; validators pass at cap, refuse over cap, and still exclude always-prepared spells.
  - H3 (c): artificer, blackguard, paladin, ranger, sorcerer and warlock are pinned at all 80 points to values captured from the pre-change code; 0 moved.
  - H3 (d): the sheet's `getMaxPrepared`, extracted from the live JSX and executed, matches the table and the server at all 80 points.
  - H3 (e): the regenerated dataset and the real `preparedCountFor` give 4 for modifiers −2 to +6.
  - H3 (f): PartyBuilder uses the table.
  - H3 (g): `GET /api/spells` serves the table.
  - H3 (h): the bard validator on the real routes. PUT 4 at L1 (Cha +0) saves and 5 refuses. Level-up 4→5 with 9 stored succeeds; with 10 it refuses with "at most 9" and the level stays at 4.
  - H3 (i): cleric and druid PUT at L1: 4 saves, 5 refuses.
  - H2 (a)-(d): the regain rule. A PC long rest with 3 of 5 spent regains all 3; a companion with 4 of 4 spent regains all 4; a second rest with none spent regains 0 and the pool stays 5; a short rest with Dice=2 spends 2 and heals (PC and companion), and the next long rest returns both; a downtime long rest with 4 spent regains 4.
- **Updated suites (2014 expectations → the tables, same strength). Own counts:**
  - `rest-time`, `downtime-rest` (H2 expectations);
  - `bard-prepared-cap` 23/23, `bard-validator-wiring` 95/95, `wizard-validator-wiring` 87/87, `mechanics-hooks-always-prepared` 103/103 (cleric/druid), `sheet-prepared-branches` 61/61;
  - `spellbook-routes` 494/494, `spellbook-service` 316/316;
  - `creator-next-stage4` 631/631, `creator-next-stage5-validation` 190/190, `creator-next-stage6-commit` 368/368, `creator-next-stage6` 297/297, `creator-test-notes-2-server` 110/110, `creator-gaps-batch` 652/652;
  - `artificer-validator-wiring` 54/54, `blackguard-validator-wiring` 94/94.
- **How those suites changed:**
  - **Lists:** where a list was sized to an old cap, it was resized to the new cap with real spells of the right class, and every "at cap" / "one over" pair still brackets the cap.
  - **Wizard suite (two groups rewritten):** they tested that the cap rises with Int mod, which the 2024 rule removes. They now prove the opposite: same cap at Int +3 and +4; an L4 ASI no longer moves the cap (8 stored still refuse after +2 Int; 7 pass, and the ASI is still applied).
  - **Spellbook L18 exclusion case:** grew from 22 to 24 spells, so it still proves Spell Mastery picks don't count (24 counted would refuse at cap 23).
  - **Control clerics:** the "a cleric is not governed by the X validator" checks in the artificer, bard, wizard and blackguard suites moved from L5 to L6, where 10 spells is exactly the new cleric cap.
- **Static import check:** `server/` 1,886 named imports across 430 files, **0 problems**. **Client build** (`npx vite build`) succeeds.

## Live proof (item 6): real server, real model
The real `server/index.js` was booted on port 3079 against a throwaway database, with Ollama and gemma4:12b running, and driven over HTTP. The script is `h2h3-probe.mjs` in the session scratchpad; it stopped only its own child process. Output, verbatim:

```
server up: true
--- H3: GET /api/spells, level 1 and level 14, at ability mod +0 and +5 ---
  bard      L1 +0: 4 | L1 +5: 4 | L14 +0: 17 | L14 +5: 17
  cleric    L1 +0: 4 | L1 +5: 4 | L14 +0: 17 | L14 +5: 17
  druid     L1 +0: 4 | L1 +5: 4 | L14 +0: 17 | L14 +5: 17
  wizard    L1 +0: 4 | L1 +5: 4 | L14 +0: 18 | L14 +5: 18
  paladin   L1 +0: 2 | L1 +5: 2 | L14 +0: 12 | L14 +5: 12
  sorcerer  L1 +0: 2 | L1 +5: 2 | L14 +0: 17 | L14 +5: 17
  artificer L1 +0: 1 | L1 +5: 5 | L14 +0: 7 | L14 +5: 12
--- H2: a long rest through the real DM ---
POST /start: 200 215.6 s
turn: "It is getting dark and I am exhausted. I make camp off the road, eat, and sleep through the night — a full long rest."
  HTTP 200 3.0 s
  markers the model emitted: [TIME_ADVANCE: Hours=8 Reason="making camp and sleeping"] [REST: Type=long]
  before: HP 18/44, Hit Dice pool 5, spent 3, available 2
  after:  HP 44/44, Hit Dice pool 5, spent 0, available 5
server log lines mentioning errors: 0
```

What it shows:
- **H3:** the four classes serve the printed column at any modifier (L14: 17, wizard 18). Paladin and sorcerer are unchanged (table), and artificer still follows its modifier, as ruled.
- **H2:** the real DM answered a long-rest request with `[REST: Type=long]`. The level-5 Fighter, who had spent 3 of 5 Hit Dice, ended with 0 spent (under the old rule it would have been 1) and full HP.
- The session start took 215.6 s, including a cold model load.

## Not done / still open
- **`:5173` click-through:** not done by me; there is no browser tool in this session. The server half is proven live above; the steps are below.
- **Wiring new validators:** none, per the brief. Paladin's missing sheet-save / level-up validator stays its own follow-up; cleric, druid and wizard already had theirs (corrected, not added).
- **Found, left alone, for Muse to scope:**
  0. **Hit Dice are invisible to the player.** No client screen reads `hit_dice` / `hit_dice_used` (searched all of `client/src`), and the DM prompt never states the pool. A player cannot see how many dice they have before a short rest, so the H2 fix can only be seen indirectly at `:5173`.
  1. **PartyBuilder's other 2014 numbers.** The companion creator still carries 2014 data for classes outside this job: paladin "Cha mod + half level, no spells before L2"; ranger, sorcerer and warlock "spells known" rows. Only bard/cleric/druid were in scope; those three now use the table.
  2. **Bard `spellsKnownByLevel` in `classes.json`.** A 2014 known-spells row. The sheet never shows it for a bard (bards are prepared casters), so it is dead data. It is a spells-known count, which the brief puts out of scope.
  3. **Mythic "Dawn's Blessing"** (post-MVP, description only): "Long rest restores additional hit dice equal to WIS modifier" now has no effect, because a long rest already restores all of them. It is a homebrew/Mythic rule that needs its own ruling.
  4. **Pugilist "Peak Physical Condition"** (L20, prompt-only): "regain ALL expended hit dice instead of half" is still true but now adds nothing.
  5. **Observed in the live probe, not verified, outside this job:** the model emitted both `[TIME_ADVANCE: Hours=8]` and `[REST: Type=long]` for one night. If both advance the clock, that night may count as 16 hours. I did not check this.
- **Cost and usage against the $30/month cap:** not measurable from inside the session.

## Decisions made (reversible, for veto)
1. **The four services keep their `(mod, level)` signature and ignore the mod,** like `paladinService`. This kept all eight route call sites untouched. Reversal: drop the parameter and edit eight call sites (small).
2. **Refusal messages still print "(Cha mod N)" / "(Int mod N)" / "(Wis mod N)",** as the paladin message already does, although the mod no longer affects the cap. Reversal: delete the parenthesis in eight messages (small, and two test checks).
3. **One shared table for bard, cleric and druid** (`BARD_CLERIC_DRUID_SPELLS_PREPARED`), because the brief's three columns are identical. Reversal: split it into three constants if a book printing ever differs.
4. **`hitDiceRegain` returns "nothing spent"** rather than subtracting the pool. This is the plainest reading of "regain all spent Hit Dice", and it can never exceed the maximum. Reversal: one function.
5. **The fallback fix answers any modifier for a fixed column.** This also benefits paladin/ranger/sorcerer/warlock in the no-endpoint fallback; their numbers are unchanged, and only the "no answer" case for out-of-range modifiers went away. Reversal: delete five lines in `spellCatalogFallback.js`.
6. **PartyBuilder bard switched from a 2014 known row to the prepared table** (bards prepare in 2024). Reversal: restore the row.
7. **Version bump to 1.0.202.** Reversal: two lines.

## Needs Zach's decision
None for this job. Zach's part is the gate. The "found, left alone" items are for Muse to scope; item 3 (Dawn's Blessing) needs a Mythic ruling when Mythic is in scope.

## How to verify
**Gate:** `npm test` on the PC (expect 248 files green).

**At `:5173` (never `:3000`), with `npm run dev`:**
1. **Prepared cap at L1.** Create a 1st-level **wizard** with a low Intelligence (for example Int 10, modifier +0) and open the character sheet. Then do the same with a **cleric** (Wis 10), a **druid** and a **bard** (Cha 10).
   - **Look for:** the Prepared Spells header reads **"Prepared Spells (n/4)"** for all four. With the old rule a +0 caster showed **/1**.
   - Optional: repeat with a high modifier (Int 17); it still shows **/4** (the old rule said 4 at +3 and 6 at +5).
   - In the creator's spell step, the same characters are asked to pick **4** prepared spells.
2. **Long-rest Hit Dice: indirect only.** No screen in the game shows Hit Dice: not the sheet, not the session view, and not the DM's own state block. That gap predates this job (see "Not done"). So this check can only be indirect:
   - Play a campaign character of level 4 or higher who has taken damage. Take a short rest spending dice ("I take a short rest and spend three hit dice"), then ask for a long rest ("We make camp and sleep through the night"), then send one more ordinary turn.
   - The system tells the DM exactly what the rest did, and the DM is told to narrate only that.
   - **Look for:** the DM's narration after the long rest mentions regaining all of the spent dice (three in this example; the old rule gave back only half the character's total).
   - The direct proof is the live probe above (3 spent → 0 spent through the real turn route) and the tests.
