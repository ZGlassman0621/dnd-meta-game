# Report — player rolls out of combat: hit dice, cold saves, crafting, and the hidden Perception die

## Understanding
**The game.** This is a solo D&D 2024 game. One human plays one character, and a local AI model (gemma4:12b, on the PC) runs the Dungeon Master and every other character. The engine holds the rules and the numbers; the DM narrates them.

**This job.** Zach's ruling (2026-11-23) is "ALWAYS — as a rule, the DM never rolls for the player." The combat-loop fix had already applied that to combat. This job applies it everywhere else:

- **Short-rest Hit Dice.** The player chooses how many to spend and rolls them; the engine adds CON to each.
- **Hourly cold saves.** One batch ask per stretch of travel, with all the numbers in one message.
- **Crafting checks.**
- **The hidden Perception die.** The player rolls the numbers up front at the dungeon door; when the DM reads one stays secret.
- **A survey** for any other place the engine rolls a player's die out of combat.

Muse ruled on the Perception spares mid-job: 3 numbers at the door (the banked number plus 2 spares), passive Perception when they run out, a refill at the next dungeon door, and never a mid-dungeon ask. That is what was built.

The brief matched the live code, with one difference. The brief says "the player rolls one Perception per character at the dungeon door". The player's door number was already player-rolled before this job; only the replacement after a use was engine-rolled.

## Verdict
BUILT + GREEN (builder's run; Zach's run is the gate).

Commit `7ef5d44` on branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.206.

## Per-item verdicts
| Item | Verdict | In one line |
|---|---|---|
| 1. Short-rest Hit Dice | **Built** | The rest asks how many to spend and for the numbers; each die heals die + CON. Live: "7 4" healed 12 → 27/28. |
| 2. Cold saves, batched | **Built** | One ask per stretch ("4 hours in the cold — roll 4 Constitution saving throws … send all 4 numbers"), resolved hour by hour. Live: "14 9 1 17" → frost 0 → 2. |
| 3. Crafting checks | **Built** | Finishing a craft asks for the d20 and resolves from it; the journal's Complete button asks for the number. Live: through the HTTP route. |
| 4. Hidden Perception die | **Built** (Muse's spares ruling) | 3 numbers at the door; a used number is replaced by the player's next spare; passive once they're gone; never a mid-dungeon ask. Live: the bank opened, a secret read used the banked 14, and the spare 8 moved up with nothing shown to the player. |
| 5. Survey | **Done** | One more player roll found and converted (the lair-hazard save). Three sites are out of scope, with reasons. Three sibling defects found live were fixed (below). |

## Files changed
| File | New / edited | SHA-256 | Bytes |
|---|---|---|---|
| `CLAUDE.md` | edited | `83bc1ec35fc73481c158fc8d9c2928cddee1806a0fc7570f0dabed84ed36f74f` | 27286 |
| `client/package.json` | edited | `88499639a046df3a12339bd2dd6cfb54894287cd62a95d9471d1023594a2478f` | 427 |
| `client/src/components/PlayerJournalPage.jsx` | edited | `717e36f851b7bcffb4be490481a5847c71d4819eaa037ab8f89bf5de763eb5d2` | 70686 |
| `docs/pm/combat-resolution/BRIEF.md` | new | `447eeed620ac03c7d6aea0f0e488940a0d78bbfb2eabd4b479685aa437a1ed53` | 7872 |
| `docs/pm/player-rolls-out-of-combat/BRIEF.md` | new | `2fb10f0fcbe1e60c673e3fdbfc7cbedb8b8ea0afcd47554ed65df94dbfcb7d64` | 8927 |
| `package.json` | edited | `07e2249422c4916f35f7dcc82a9fe07c88fa5f916172559b76e8f8f75fc34d58` | 1398 |
| `server/routes/crafting.js` | edited | `2d111372beaae0dbaa45c78a830a33aa8656bc3417da377266b7734d3f253f29` | 8247 |
| `server/routes/dmSession.js` | edited | `b33d8ac1717ad339b133f95596ee164d607f87e7f02515b3409cebba9237baec` | 220711 |
| `server/services/coldExposureService.js` | edited | `11bab7ee44f56017123b548bf629d12d82ce4a4bedb9cb62113e6221a02a7881` | 32014 |
| `server/services/craftingService.js` | edited | `13b00784848d73afd81954792f3555bccacd09c6ae3288117ee498c7e8968c36` | 40812 |
| `server/services/damageTableService.js` | edited | `2ec9a0904b7d692074b53f43c06dbed8def3c0e352bdba637c2756cb7f2a78f5` | 12998 |
| `server/services/dmPromptBuilder.js` | edited | `a52a54b6f265cadf6dd838113559230d255655dc24459534a10d4260cdc17619` | 195826 |
| `server/services/lairDurabilityService.js` | edited | `5cd17315cf398205976049b00eeb776999b1b54c061d0822f2ce20691a4d7cbc` | 38530 |
| `server/services/perceptionPreRollService.js` | edited | `74a9c3277ad191bd645959f3fd3ab929e45a43b410c69918f2a9ef386c218372` | 29611 |
| `server/services/playerRollService.js` | new | `7a8456279aa32ab2525b67b1f33961da4420acfda5cc2dec285e3c8860387721` | 5671 |
| `server/services/restTimeService.js` | edited | `ad07f87ee6519bdf13b21778913ca46ed7d4d6947b7d30002527dd8a4b1cb890` | 55561 |
| `server/services/rollRequestService.js` | edited | `255f08a86e3846d86ebc8d360541ad380c5e6b9e573ea65e2671f20a9e9fdd3e` | 54204 |
| `tests/cold-exposure.test.js` | edited | `15a4aa1f8ef110cd2ce347e81d67727dac9101babe916c12e689319e3838b8a4` | 22818 |
| `tests/h2-h3-2024-rules.test.js` | edited | `b7bd50bbb705171f708ca1e2973baff2b4bd0baffc62ee38ba52a00ef853cd7c` | 23617 |
| `tests/perception-pre-roll.test.js` | edited | `f7da5d5cf315480c6b62209fce28a450e60afab54e80e734a08346599484b6e1` | 26665 |
| `tests/player-rolls-out-of-combat.test.js` | new | `02cbe049deb87d46d3015dddbb019f37b451955e8551b82c91d8ea1a6ef6727e` | 17330 |
| `tests/rest-time.test.js` | edited | `8b8686b3e91424270f34abf2c041a4486adb495dd416b2faa3f1c71f4ba30700` | 65779 |
| `tests/spellbook-routes.test.js` | edited | `ed9dcda6b1bafea9450ce4059df5a57fd50fa496eee181393e366bfca25df627` | 135294 |
| `docs/pm/reports/player-rolls-out-of-combat-REPORT.md` | new (this file) | n/a | — |

No migration. Both `package.json` files are bumped to 1.0.206. `CLAUDE.md` gains a paragraph on the out-of-combat rolls in the hybrid-combat section.

## What was built (in play)
- **Short rest.** The DM narrates the rest, and under it the player sees: "🎲 Short rest: you're at 12/28 HP with 3 Hit Dice left (d10, d10, d10). Spend as many as you like: roll them and send the numbers in that order (e.g. "6 4"), or send 0 to spend none. The engine adds +2 (CON) to each after."
  - The player sends their dice, e.g. "7 4", and sees "⚙ Hit Dice: d10 7 + 2 (CON) = 9, d10 4 + 2 (CON) = 6 → +15 HP (12 → 27/28); 1 left."
  - A face the die can't roll, such as 12 on a d10, is refused in plain words, and the ask stays open.
  - Spell slots, class resources and the clock all apply at once; only the Hit Dice wait for the player.
- **Cold.** A stretch of travel in the cold gives one ask: "🎲 4 hours in the cold — roll 4 Constitution saving throws (a d20 each, one per hour) and send all 4 numbers in one message, in order … The engine adds your CON modifier (+2 now; frost can lower it) after."
  - With advantage (cold resistance) or disadvantage (wet clothes), it asks for two d20s per hour.
  - Each hour is resolved in order from the player's numbers, and a failed hour lowers the next hour's CON modifier, exactly as before.
  - The ⚙ line shows each hour's math, and never the DC.
- **Crafting.** Clicking Complete on a project opens a box: "🎲 Roll a d20 for the Strength check to finish Iron Dagger — the engine adds +3 (STR) after." The player types the number and sees "⚙ d20 13 + 3 = 16 — success: Iron Dagger (standard)."
- **Perception at a dungeon door.** "🎲 At the door of Sunless Citadel: roll 3 d20s for Perception and send all 3 numbers in one message (e.g. "14 8 17"). Your first number is banked now and the others are held in reserve; the engine adds +1 after."
  - Inside, the DM reads the number in secret at a trap, a secret door or a hidden enemy, and the player is never told.
  - After a use, the next of the player's own numbers takes its place. When all three are gone, passive Perception judges.
  - The same dungeon never asks again; the next dungeon door asks for three fresh numbers.
- **Any check the DM asks for** now shows the player what to roll: "🎲 Roll a d20 for a Perception check — the engine adds +1 after." The DC is never shown.
- **Lair hazards.** When a lair hazard strikes the player, the player is asked for their own save, and the hazard's damage applies on a failure.

## Item 5 — the survey
Method: I searched `server/` for `rollD20(`, `roll(` and the dice helpers (including `Math.random() * 20`), then read each caller to see whose roll it is. The combat-loop fix's P4 table covered the in-combat sites; this table covers every site that table did not list as converted.

| Site | Roll | Whose | Status |
|---|---|---|---|
| `restTimeService.js:156` `spendHitDice` | short-rest Hit Dice | PC + companions | **Converted for the PC** (item 1). `restPc` no longer calls it; companions still do (engine-side by the brief's decision). |
| `coldExposureService.js:451` | hourly cold CON saves | PC + party | **Converted for the PC** (item 2). Companions still roll engine-side. |
| `craftingService.js:416` | crafting check | PC | **Converted** (item 3). The local `rollD20` helper is deleted (no caller left). |
| `perceptionPreRollService.js:354` | Perception replacement after a use | PC + companions | **Converted for the PC** (item 4): the player's own spare replaces it. Companion replacements stay engine-rolled. |
| `lairDurabilityService.js:406` `strikeHazard` | lair-hazard save | PC, companions, enemies | **Found and converted** (fix-as-you-find-it). The combat-loop survey listed this as "the environment's roll", but the save belongs to whoever is caught, including the player. The PC's save now rides the trap-save slot (`pendingTrapSave`, with the hazard's already-rolled damage). Others stay engine-side. |
| `routes/downtime.js:1455` | Gather Intel check (`Math.random`) | PC | **Out of scope, reported.** It is in the downtime system, post-MVP (Zach, 2026-11-11), and converting it needs a roll ask in the downtime UI. Candidate follow-up. |
| `longTermProjectService.js:125` `rollForProgress` (via `workOnProject`) | project progress, 1 roll per 2 hours (`Math.random`) | PC | **Out of scope, reported.** It is reached only from the party-base and downtime routes (fortress/downtime, post-MVP). It would need the same batch ask as the cold saves. Candidate follow-up. |
| `displayService.js:164` `rollSplashDamage` | a display mishap's splash damage | the mishap table | **Out of scope, reported.** It is a mishap's consequence, the same kind as the Wild Magic surge the brief parks as a question; it is not a roll the player makes. |
| `subclassMarkerService.js:410`, `wildMagicService.js`, `partyAttackService.js:1323` | Bend Luck, the surge table, the Absorb Elements rider | — | **Out of scope by the brief.** |
| `rollRequestService.js:635/659`, `concentrationService.js:141/242`, `conditionService.js:968`, `displayService.js:436/501/504`, `enemySpellService.js` (all), `spellCastService.js:143–149/790/793`, `enemyCombatService.js`, `moraleService.js`, `partyAttackService.js:747/1062/1135/1460`, `combatMarkerService.js:105/197`, `damageTableService.js:73`, `killLootService.js`, `npcComplexityService.js`, `npcProfessionService.js` | NPC, companion, enemy and environment rolls; loot and NPC generation | not the player's | **Engine-side by design.** Each was re-read: none rolls a die the player rolls at the table. `partyAttackService.js:1135` rolls only when the engine itself applies a feature's math (`applyMath`); on a player-reported total it refuses and leaves the dice to the player, as the combat-loop fix set. |

**Sibling defects found live and fixed in this job:**
1. **The player wasn't told to roll a check the DM asked for.** A ROLL_REQUEST (and a trap or hazard save) posted a pending roll but gave no 🎲 ask, so it depended on the DM's narration. In live Perception run 1, the DM asked six times and never said "roll". Now every pending check shows the ask, with no DC.
2. **An open Perception roll while the player holds a bank.** In live run 3 the DM wrote `[ROLL_REQUEST: Skill="Perception" DC=15]` at a hidden trap seam, the tell the bank exists to remove. The engine now refuses it and tells the DM, in the same exchange, to read the bank with `PERCEPTION_USE`. A search the player declares ("I search the walls…") still rolls openly; the pre-roll design keeps active searches on ROLL_REQUEST. In the rerun, the DM's next turn used the bank.
3. **The rest's hour counted twice.** In live run A the DM answered the Hit Dice report with `[TIME_ADVANCE: Hours=1 Reason="short rest"]`, which moved the clock a second hour. A message that only reports Hit Dice is no in-story action, so the route no longer dispatches a TIME_ADVANCE or REST on that turn. The DM's fact also says the hour has already passed.

## Live probe (real server + real gemma4:12b)
Setup: the real `server/index.js` on its own port with a throwaway database, Ollama gemma4:12b, and an invented character (Brin Halloway, human Fighter 3, CON 14, 3 × d10 Hit Dice). The player's dice are invented values. The scripts are in the session scratchpad (`ooc-probe.mjs`, `ooc-probe2.mjs`, `ooc-probe3.mjs`).

**Run A–C** (`ooc-probe.out`; 0 server errors):

| Msg | Player sends | DM's markers | Player sees (engine lines) | Engine state after |
|---|---|---|---|---|
| 1 | "Bruised from the road, I sit by the fire and take a short rest for an hour…" | `[REST: Type=short]` | 🎲 Short rest: you're at 12/28 HP with 3 Hit Dice left (d10, d10, d10)… adds +2 (CON) to each after. | HP 12/28; no dice spent; `pendingHitDice` |
| 2 | "7 4" | `[TIME_ADVANCE: Hours=1 Reason="short rest"]` (now dropped — sibling fix 3) | ⚙ Hit Dice: d10 7 + 2 (CON) = 9, d10 4 + 2 (CON) = 6 → +15 HP (12 → 27/28); 1 left. The DM got `[HIT DICE — system fact: … +15 HP, now 27/28 …]`. | HP 27/28; 2 d10 spent |
| 3 | (setup: a cold scene at base level 2, on an open road) "We break camp and march four hours north along the frozen road toward the pass." | `[TIME_ADVANCE: Hours=4 …] [COLD_SCENE: BaseLevel=2]` | 🎲 4 hours in the cold — roll 4 Constitution saving throws … send all 4 numbers in one message … adds your CON modifier (+2 now; frost can lower it) after. | frost 0; `pendingColdSaves` |
| 4 | "14 9 1 17" | `[COLD_WET: Target="Player" Status="wet"]` | ⚙ Cold saves: hour 1: d20 14 + 2 (CON) = 16 — held; hour 2: d20 9 + 2 (CON) = 11 — failed; hour 3: d20 1 + 1 (CON) = 2 — failed; hour 4: d20 17 + 1 (CON) = 18 — held. Frost 0 → 2. | frost 2; the CON modifier dropped after hour 2's failure, as the rules say |
| C | `POST /api/crafting/projects/1/complete` with no die | — | `{"needsRoll":true,…,"prompt":"Roll a d20 for the Strength check to finish TEST_OOC Iron Dagger — the engine adds +3 (STR) after."}` | project still in progress |
| C | … with `d20: 23` | — | `400 {"error":"d20 must be a whole number from 1 to 20"}` | unchanged |
| C | … with `d20: 13` | — | `{"success":true,…,"roll":{"d20":13,"ability_mod":3,"proficiency_bonus":0,"total":16}}` | completed, standard quality |

**Perception runs** (`ooc-probe2.out`, `ooc-probe2b.out`, `ooc-probe3.out`, `ooc-probe3b.out`):
- **Run 1 (the Old Mine).**
  - The DM never wrote the door marker. It wrote `[ROLL_REQUEST: Skill="Perception" DC=15 …]` on all six turns.
  - The player saw no ask, because no 🎲 existed yet for DM checks (sibling fix 1).
- **Run 2 (the same, after fix 1).**
  - The player now saw "🎲 Roll a d20 for a Perception check — the engine adds +1 after." and their 11 settled it.
  - The DM still never opened a bank; see "Not done / still open".
- **Run 3 (the Sunless Citadel, named as a dungeon).**
  - The DM wrote `[PERCEPTION_PREROLL: Dungeon="Sunless Citadel"]`. The player sent "14 8 17", and the engine banked 14 with spares [8, 17].
  - At a trap seam the DM then asked an open Perception roll, the tell (sibling fix 2).
- **Run 3b (after fix 2), message by message:**

| Msg | Player sends | DM's markers | Player sees | Bank after |
|---|---|---|---|---|
| 1 | "We reach the iron gate of the Sunless Citadel, an ancient ruined dungeon…" | `[PERCEPTION_PREROLL: Dungeon="Sunless Citadel"]` | 🎲 At the door of Sunless Citadel: roll 3 d20s for Perception … adds +1 after. | — |
| 2 | "14 8 17" | `[TIME_ADVANCE: Hours=0 …]` | narration only | banked 14; spares [8, 17] |
| 3 | "I walk slowly down the main tunnel, torch held high." | `[ROLL_REQUEST: Skill="Perception" DC=15 …]` — **refused** | narration only, no ask | unchanged |
| 4 | "I keep going deeper, past the old ore carts." | `[PERCEPTION_USE: Target="Brin Halloway" Trigger="stealthed_enemy" DC=15]` | narration only: no number, no ask, no word of a read | banked 8; spares [17]. roll_log: banked 14 + 1 = 15 vs DC 15, success, source "banked" |
| 5–7 | (the fight that followed) | `COMBAT_START`, `ENEMY_ATTACK`… | combat | unchanged |

No engine-rolled player die appears in any run. In each run, every die the player rolled was the number the player sent.

## "Fixed looks like", per item — evidence
`tests/player-rolls-out-of-combat.test.js` (new, 61 assertions) drives the real route with a stubbed model, and every section checks the engine's roll log for player dice:
- **Item 1:** the rest spends no die and heals nothing by itself, and posts the ask (three d10, +2 CON). "12" is refused and the ask stays. "7 4" heals (7+2) + (4+2) = 15 (10 → 25). The ⚙ line, the DM's fact and the clean stored action are all checked. A TIME_ADVANCE on that reply does not move the clock. "0" spends none.
- **Item 2:** a 4-hour TIME_ADVANCE in a cold scene posts one 4-number ask with no DC. "20 15 1 20" resolves hour by hour, and the natural 1 fails its hour. The ⚙ line shows no DC, and the DM gets the fact.
- **Item 3:** with no die, `completeProject` asks (d20, +4 DEX, no DC) and leaves the project in progress. 25 is refused. 15 + 4 = 19 succeeds (fine quality), and 3 + 4 = 7 fails.
- **Item 4:**
  - The door asks for 3 numbers. "14" is refused in plain words, and "14 8 17" banks 14 with spares 8 and 17.
  - An open Perception ask is refused with a note to the DM, while a declared search still asks.
  - A secret read shows the player nothing, and the spare 8 replaces the used 14.
  - `tests/perception-pre-roll.test.js` group 5b (new): spares move up in order with no roll. Once they're gone, passive 14 judges DC 14 (success) and DC 15 (failure), with no die. The DM block still lists the PC, and the same dungeon never asks again. The next dungeon door, and re-entering from elsewhere, refill the bank.
- **Item 5 (lair hazard):** `strikeHazard` posts the player's save (DC 13, damage 7) and rolls nothing; a reported 5 (+4 = 9) fails, for 7 damage.
- **Sibling fix 1:** a ROLL_REQUEST Athletics check shows "🎲 Roll a d20 for an Athletics check — the engine adds +2 after.", with no DC, and the reported 12 settles it.

## Test results
- **Full `npm test` on the PC:** Files **252/252 green**, assertions **19,745 passed, 0 failed** (Windows notes: `profane-soul-validator-wiring` retried once and passed; `companion-sheet`, `dungeon-generation`, `lair-hazard-auto`, `subclass-batch3`, `time-evolution` counted `pass*`).
- **New file:** `tests/player-rolls-out-of-combat.test.js`, 61 passed, 0 failed.
- **Existing tests changed to the new rule.** Each changed line says why.
  - `rest-time` (now 209 passed), `h2-h3-2024-rules` (90 passed) and `spellbook-routes` (494 passed): a short rest no longer heals by itself, so each test settles the reported Hit Dice and then checks the HP.
  - `cold-exposure` (82 passed): TIME_ADVANCE posts the batch ask, and a reported 20 then 1 gives exactly one frost level.
  - `perception-pre-roll` (88 passed): the door takes 3 numbers, and group 5b is new.
- **Earlier run, for the record:** one full run during the job showed 251/252 files with 0 failed assertions. The red file was `spellbook-routes`, which ran while the live probe was loading the machine; it takes about 158 s against the runner's 120 s cap (the timeout the brief warns of). Every later run had it green, in 5 s.
- **Lint:** 0 errors in the files touched. The two `no-useless-assignment` errors in `restTimeService.js` and `lairDurabilityService.js` predate this job; they were checked against a stash of the changes and are unchanged.
- **Client build:** `npx vite build` succeeded.

## Cost and usage
I can't measure this session's cost or the remaining usage against the $30/month cap from inside the session.

## Not done / still open
- **The DM only opens the Perception bank when the place is clearly a dungeon.** In two live runs at "the abandoned Old Mine", gemma4:12b never wrote `PERCEPTION_PREROLL`. When the player said "the Sunless Citadel, an ancient ruined dungeon", it did, on the first message.
  - The system gap: nothing in the engine knows when the party enters a dungeon, so the bank depends on the DM noticing.
  - I widened the DM's instruction to "a dungeon, cave, mine, crypt, ruin or lair" and told it to write this marker rather than a Perception ROLL_REQUEST. An engine-side trigger is a separate design; see Questions.
- **Downtime Gather Intel and long-term project progress** still roll the player's d20 (survey). Both are in post-MVP systems; they're candidate follow-ups.
- **The :5173 click-through:** steps are below. I couldn't click through myself (no browser here); the probes drove the same server over HTTP.
- **Known edges:**
  - An unanswered Hit Dice or cold ask stays on screen until the player sends numbers (or a new rest replaces it, or a long rest clears it). A message that isn't only numbers leaves it waiting.
  - A check the DM asks for while a Hit Dice or cold ask waits takes the next numbers first. The player sees only one ask at a time: the DM's check is shown first, then the rest ask.
- **Seen in the probe, outside this job:** in Perception run 3b's fight, the DM wrote `COMBAT_START` again mid-fight and restated bites with `HP_CHANGE`. That is combat-loop territory, and the next queued job (combat resolution) touches the same loop.

## Decisions made (reversible, for veto)
1. **Hit Dice: the player picks how many by sending that many numbers.** One message does both (the brief allows "all at once"). `Dice=` on the DM's REST marker now governs companions only. Spending stops at full HP; later dice stay unspent. Reversal: `applyReportedHitDice`.
2. **Cold saves: two d20s per hour with advantage or disadvantage**, sent in pairs, in order. The ask must be answered in full; a wrong count is refused and the ask stays. Stretches that pile up before an answer join one ask. Reversal: `formatColdSavePrompt` / `applyReportedColdSaves`.
3. **Crafting: a two-step route.** With no `d20`, the route returns `needsRoll` and the ask; with one, it resolves. A malformed `d20` is a 400. The journal uses a browser prompt box, matching the page's existing `alert` style. Reversal: the route and `handleCompleteProject`.
4. **Perception bank storage:** the spares live on `session_config.perceptionSpares` per dungeon (no migration). A companion's replacement stays engine-rolled. Reversal: `PERCEPTION_BANK_DICE` and the spares helpers.
5. **"The next dungeon door" means a different dungeon, or the same one entered again from elsewhere.** A repeated door marker while the party is still inside asks nothing. Reversal: the `stillInside` check in `bankAtDoor`.
6. **The open-Perception guard exempts a declared search.** I match the player's own words (search, look for or around, inspect, examine, check for, listen, peer, scan, keep an eye). Anything else during an active bank is refused. Reversal: `ACTIVE_SEARCH_RE` in `rollRequestService.js`.
7. **The 🎲 ask for DM checks.** It shows the d20 count (two with advantage or disadvantage, with the reason) and the modifier the engine adds, never the DC. A subclass bonus die (e.g. Supernatural Defense 1d6) isn't in the ask yet; it was already DM-applied. Reversal: one block in the route's roll prompts.
8. **The out-of-combat math stays out of the roll-math panel.** Per Zach's answer ("just make it for combat"), it appears as the ⚙ line under the narration.
9. **A lair hazard's PC save uses the trap-save slot**, carrying the hazard's rolled damage (`fixedDamage`); on a success the PC takes no damage, the same as before.

## Needs Zach's decision
1. **Should the engine open the Perception bank itself when the party enters a dungeon, instead of relying on the DM?**
   - Today only the DM's `[PERCEPTION_PREROLL]` marker opens the bank. gemma4:12b wrote it when the player named "an ancient ruined dungeon", but not at "the abandoned Old Mine" (two runs).
   - The engine has no "entered a dungeon" event. `GENERATE_DUNGEON` builds one but doesn't mean the party is inside, and locations carry no "dungeon" type the engine reads.
   - Options:
     - (a) Leave it to the DM, with the widened instruction (as now).
     - (b) Open the bank whenever the party moves into a generated dungeon's rooms (needs a "party entered" signal from the dungeon system).
     - (c) Open it when the DM asks the first open Perception roll in a place with no bank, and ask the player for the 3 numbers instead of the 1 (turning the tell into the door).
   - Which, if any? This is a design call, so Muse may decide it and pass it on.

## How to verify
**Gate:** `npm test` on the PC (expect 252 files green).

**At `:5173` (never `:3000`), with `npm run dev`:**
1. Use a campaign character with some HP missing and Hit Dice left to spend. Start a session.
2. Type "I sit down by the fire and take a short rest."
   - **Look for:** under the narration, "🎲 Short rest: you're at X/Y HP with N Hit Dice left (…)… The engine adds +C (CON) to each after." HP has not changed yet.
3. Send your dice, e.g. "7 4".
   - **Look for:** "⚙ Hit Dice: d10 7 + C (CON) = …, … → +N HP (… → …)". The sheet's HP rises by exactly that.
4. Get into the cold. Ask the DM to march you into a blizzard for several hours; the DM sets the cold scene.
   - **Look for:** ONE ask, "🎲 N hours in the cold — roll N Constitution saving throws … send all N numbers in one message". Send them in one message, e.g. "14 9 1 17", and see one ⚙ line with each hour's math and no DC.
5. Open the Journal → Crafting, and click **Complete** on a project that has its hours in.
   - **Look for:** a box saying what to roll and what the engine adds (no DC). Enter your d20, and see the ⚙ result.
6. Type "We reach the gate of [a named dungeon], an ancient ruined dungeon. We go inside."
   - **Look for:** "🎲 At the door of …: roll 3 d20s for Perception and send all 3 numbers in one message". Send three numbers.
   - Walk on. The DM never asks you for a Perception roll unless you say you're searching, and never says when it reads your number.

---

## Addendum — Muse's decision on the bank trigger (2026-11-23), v1.0.208
Commit `6412b66` on `phase-4-hybrid-combat`.

**Muse's decision:** "when the DM asks the first open Perception roll in a place with no bank, the engine refuses it and asks the player for the 3 numbers instead. The DM is told to read the bank."

**Built** (`rollRequestService.js`, ROLL_REQUEST handler):
- **When it applies:** an open Perception request for the player while no bank is active anywhere in the session, unless the player declared a search or the request is hearing-tagged.
- **What happens:** it is refused, and the engine opens a bank keyed by the character's current location ("this place" if none is set).
- **The player sees:** "🎲 Perception for the hills above Luskan: roll 3 d20s for Perception and send all 3 numbers in one message … the engine adds +1 after."
- **The DM is told:** "Your Perception ROLL_REQUEST was NOT sent. The party had no banked Perception, so the engine is asking … for their three Perception numbers for … instead. Once they are in, read the bank in secret for what you meant to check: [PERCEPTION_USE …]."
- **If the DM reads the bank before the numbers are in,** it is now told to wait ("still rolling their banked Perception numbers … do not ask for a roll"). Before, the reason pointed it back to an open roll.

**Checks a companion is helping with are exempt too.** A pending `HELP_CHECK` for Perception means a companion is actively helping the player look, which counts as a declared search. The full suite showed this: `item-3d-action-markers` drives Lyra helping the player's Perception check, and it stays green unchanged.

**Hearing-tagged requests are exempt.** A deafened player's listening check must still auto-fail (`item-8-conditions`). That test's non-hearing example switched from a Perception check to a Survival check ("looking for tracks"), because a first open Perception ask now opens the bank.

**Tests:**
- `tests/player-rolls-out-of-combat.test.js` (now 65): the first open ask on the tundra is refused and opens the bank (count 3, `first_ask`), with the "Perception for …" prompt and the DM's note, and "13 6 18" banks 13.
- `perception-pre-roll` (88) and `item-8-conditions` (60) are green.

**Live** (`ooc-probe5.out`, `ooc-probe5b.out`):
- **At the Old Mine, run 5.** The DM's first message was an open `[ROLL_REQUEST: Skill="Perception" DC=15 …]`. It was refused, and the player was asked for their 3 numbers. (The probe script didn't answer that prompt, so the bank stayed waiting.)
- **Run 5b.** The DM wrote `[PERCEPTION_PREROLL: Dungeon="Old Mine"]` itself at the mine mouth (under the widened instruction). The player's "14 8 17" was banked, and the DM's next turn read it in secret: 14, success. The spare 8 moved up, and a later open Perception ask during the bank was refused.
- This answers this report's earlier question for Zach: the engine now opens the bank when the DM doesn't.

**Known edge:** the bank stays active until a new dungeon door or first ask elsewhere. Walking back to town doesn't close it, so a town Perception ask is read from the dungeon's bank. That was already the system's behaviour.

**Files and the full `npm test`:** see the addendum in `docs/pm/reports/combat-resolution-REPORT.md` (one commit covers all three decisions).
