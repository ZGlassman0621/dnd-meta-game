# Report — combat-loop fix: fights run turn-based in live play

Builder: Claude Code (Opus 5.5). Brief: `docs/pm/combat-loop-fix/BRIEF.md`.
Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version **1.0.204 → 1.0.205**.
Commit: `45c34b4`; a follow-up commit records the hash here.

## Understanding
The diagnosis found one chain: nothing in play ever advanced a turn, so the turn order stayed on its first combatant. The engine then refused the player's attacks, the refusal never reached the DM, and the DM narrated the fight freehand. This job makes the engine run the fight:
- the engine owns the turn order and runs every turn;
- the DM chooses every NPC's action, one DM call per NPC turn (Zach, Q2);
- the engine never rolls for the player — it says what to roll and does the math after (Zach, Q1; scope: ALL player rolls).

**Where this differs from what the brief expected:**
1. **The biggest live defect was not on the brief's list.** Since the commit that wrote it, the ATTACK RESULT fact block has reached the DM as the literal text `[object Promise]`. The route called an `async` formatter without `await` (`dmSession.js`, the ATTACK RESULT injection). So the DM never once saw the engine's judgment of a player attack, which explains part of the diagnosis's freehand narration. In live run 1 the DM narrated "Miss" twice while the engine had judged both swings hits. Fixed; pinned by a test.
2. **Reviving `reconcileTurn` (F1) exposed two hazards in it.** In combat it would have auto-applied any narrated number to the player ("deals 9 damage to the thug"). Its "[SYSTEM: 5 damage was applied but not narrated.]" notes also went into the player's text. Both are fixed (decision 6).
3. **F2 needed a wider guard than "the reason names the player".** Live run 2 showed two `HP_CHANGE`s that name no player but still hurt the player:
   - the DM restating last turn's thug hit (`reason="Thug 1's mace"`, counted twice);
   - the player's own blow put on the player (`reason="Longsword strike"`, 18 → 9).

   So, while a fight runs, a plain damaging `HP_CHANGE` on the player is refused (decision 4).

## Verdict
**BUILT + GREEN.** Builder's full `npm test`: Files **251/251 green**, assertions **19,737 passed, 0 failed** (Windows notes: `sorcerer-prepared-cap` retried once and passed; `arms-armor-variants`, `item-3a-world-ids`, `npc-bank-wiring`, `subclass-batch3`, `xanathar-names` counted `pass*`). Not a gate: Zach's run gates.

## Per-item verdicts
| Item | Verdict | Evidence |
|---|---|---|
| P1 — engine-driven turn loop | **Done** | `runNpcTurns` makes one DM call per NPC turn and advances to the player. Live run 3: both thugs act every round, round 1 → 3, no prompting. Tests: "the damage ends the turn; the engine runs both thugs", "thugs first". |
| P2 — same-turn results and refusals | **Done** | A "⚙" line for the player and a system note for the DM, for every ATTACK / ENEMY_ATTACK result and refusal. The ATTACK RESULT block now actually reaches the DM (the `[object Promise]` fix). HP drops once per hit, live and in tests. |
| P3 — tolerant player-name matching | **Done** | `server/utils/playerName.js` `isPlayerRef`, used at 18 call sites in 12 services. Live: `Target="Kell Varrow"` resolves. Tests: "Kell", "varrow", `Attacker="TEST_COMBAT"` for "TEST_COMBAT Brawler"; fragments ("Kel") refused. |
| P4 — the engine never rolls for the player | **Done for every in-combat player roll; out-of-combat sites reported** | Converted: initiative, attack d20 (already reported), damage dice, death saves, concentration saves, Second Wind. Survey table below. |
| P5 — tracker follows the turn | **Done** | Every response carries `turnState`; `DMSession.jsx` updates the tracker from it. The Next Turn button and its route are gone. |
| P6 — F1, F2, F3 | **Done** | F1: `reconcileTurn` gets `session.character_id`; no crash in any probe log. F2: refusal guard plus the in-combat guard (decision 4); live run 3 refused "Kell's longsword blow" twice. F3: "Thug 1", "Thug 2", with bestiary lookups falling back to the base name. |
| 7 — math display | **Done** | `RollMathPanel.jsx`: a small panel fixed at the lower right of the session view, collapsible and clearable, one line per resolved roll, e.g. `Kell Varrow → Thug 1 (Longsword): d20 17 + 5 = 22 vs AC 13 — HIT; damage: rolled 6 + 3 = 9 slashing`. |

## What was built (in play)
**A fight now runs like this:**
1. The DM writes `COMBAT_START`. The engine rolls the NPCs' initiative and asks the player under the narration: "🎲 Roll a d20 for initiative — the engine adds +1 (Dex) after." Same-name enemies are numbered "Thug 1", "Thug 2". Nobody acts until the number is in.
2. The player sends the number. The engine slots the player in, shows "⚙ Initiative: d20 14 + 1 (Dex) = 15. Turn order: …", and tells the DM the order. If NPCs are first, their turns run at once.
3. **Each NPC turn** is one DM call: "It is Thug 1's turn. You control Thug 1: choose what Thug 1 does now…".
   - The DM describes the attempt and writes its marker.
   - The engine rolls and resolves it, and states the result: "⚙ Thug 1 attacks Kell Varrow: HIT for 4 damage. Kell Varrow is at 24/28 HP."
   - Then it moves to the next combatant.
4. **The player's turn:** "I attack the thug" leads to "🎲 Roll a d20 to attack Thug 1 with your Longsword — the engine adds +5 and checks it against Thug 1's AC."
   - On a hit: "🎲 Roll 1d8 for damage — the engine adds +3 after."
   - The rolled number plus 3 comes off the thug.
   - The player's turn ends once nothing waits on their dice, and the thugs act again.
   - If the DM narrates an attack without writing the `ATTACK` marker, the engine opens the attack itself and asks for the d20.
5. **At 0 HP** the player is asked for each death-save d20. **Concentration** saves after damage are asked for with their DC ("DC 10; the engine adds +2 (CON) after"). **Second Wind** asks for the 1d10. The last two don't end the player's turn.
6. The tracker shows the order and highlights the current combatant after every message. The roll-math panel lists every roll's arithmetic.

## P4 survey — every place the engine rolled for the player
Found by searching `server/` for `rollD20(`, `roll(N, …)` and the dice helpers, then reading each caller to see whose roll it is.

| Site | Roll | Status |
|---|---|---|
| `combatMarkerService.js` COMBAT_START (was `:76`) | player initiative | **Converted.** `pendingInitiative`; settled by `combatLoopService.resolvePlayerInitiative`. |
| `partyAttackService.js` (was `:1719-1728`) | weapon damage fallback | **Converted; fallback removed.** A hit with no damage reported waits on `pendingDamage` and asks for the exact dice (weapon, Improved Smite, Sneak, Smite, Divine Fury, Divine Strike, Lunar Form; every die doubled on a crit). The engine adds the flat parts. |
| `characterHpService.js` `rollDeathSave` (was `:272`) | death saves | **Converted.** It judges a reported d20 and rolls nothing; `pendingDeathSave` holds the ask. |
| `concentrationService.js` `checkConcentration` (`:55`) | the player's concentration CON save | **Converted.** Returns a pending check; `pendingConcentration` queues one save per damage source. |
| `classFeatureService.js` SECOND_WIND (`:619`) | the player's 1d10 heal | **Converted** (`pendingHeal`). Companions still roll engine-side. |
| `rollRequestService.js` (`:635`) | checks and saves via ROLL_REQUEST | **Already player-rolled** for the PC (pending roll); the engine path is NPCs and companions only. |
| `partyAttackService.js` ATTACK (PC) | attack d20 | **Already player-rolled.** |
| `partyAttackService.js:1323` | Absorb Elements rider 1d6 on the PC's next melee hit | **Out of scope.** Rare path. The rider's damage type differs from the weapon's, so folding it into the player's single damage total would lose its type (resistance). Needs a second damage ask; candidate follow-up. |
| `subclassMarkerService.js:410` | Bend Luck 1d4 (Wild Magic sorcerer reaction) | **Out of scope.** A reaction on someone else's roll; it needs a mid-resolution player prompt that doesn't exist yet. |
| `wildMagicService.js` | the Wild Magic surge table dice | **Out of scope.** The surge is the table's roll, not a check the player makes; question below. |
| `restTimeService.js:156` | hit dice on a short rest | **Out of scope (out of combat).** Question 2 below. |
| `coldExposureService.js:451` | hourly cold-exposure CON saves (PC and party) | **Out of scope (out of combat; many saves per span).** Question 2. |
| `craftingService.js:416` | crafting check | **Out of scope (downtime).** Question 2. |
| `perceptionPreRollService.js:354` | the silent replacement Perception die for the PC | **Out of scope by an earlier design.** The comment says a mid-dungeon PC roll request is "the tell this system removes". Question 2. |
| `conditionService.js:968`, `displayService.js:436/501`, `enemySpellService.js:921/1028/1144`, `moraleService.js`, `lairDurabilityService.js`, `enemyCombatService.js`, `spellCastService.js:143`, `partyAttackService.js:1062/1460` | grapple escape, display placement, backlash reduction, enemy spells, morale, lair, enemy attacks, enemy saves, topple, companion attacks | **Engine-side by design.** Each is the roll of an enemy, a companion or the environment; the PC versions of the first three are pending player rolls already. |

## Live probe (real server + real gemma4:12b)
Script: `loop-probe.mjs` (scratchpad). It runs `server/index.js` on port 3085 with a throwaway database.
- The character is invented: Kell Varrow, L3 fighter, STR 16, DEX 12, longsword, chain mail.
- The dice are invented: d20s 14, 17, 8, 19, …; damage 6, 4, 7, ….
- The player answers whatever the engine asks, otherwise "I attack the nearest thug with my longsword."

Runs 1 and 2 found the bugs fixed in this job (below). Run 3 is after those fixes; run 4 is after the last prompt-wording fix.

**Run 3**, per message: what the DM wrote (markers), the engine's state, and what the player saw (condensed).
| # | Player sends | DM calls (markers) | Player sees (engine lines) | Engine state after |
|---|---|---|---|---|
| 1 | the tavern line | gameplay `[COMBAT_START: Enemies="Thug 1 …, Thug 2 …"]` | narration + "🎲 Roll a d20 for initiative — the engine adds +1 (Dex) after." | order Thug 1 15, Thug 2 8; awaiting initiative; HP 28/28 |
| 2 | `14` | gameplay (none) | "⚙ Initiative: d20 14 + 1 (Dex) = 15. Turn order: Kell Varrow 15, Thug 1 15, Thug 2 8." | player's turn (tie on 15: higher modifier wins, then the player), round 1 |
| 3 | attack | gameplay `[ATTACK: Attacker="Player" Target="Thug 1"]` | "🎲 Roll a d20 to attack Thug 1 with your Longsword — the engine adds +5 …" | pending attack |
| 4 | `17` | gameplay (none) | "⚙ … d20 17 + 5 = 22 vs AC 13 — HIT; roll 1d8 for damage" / "🎲 Roll 1d8 for damage — the engine adds +3 after." | pending damage |
| 5 | `6` | gameplay `[HP_CHANGE: delta=-6 reason="Kell's longsword blow"]` (**refused**, F2); npc Thug 1 `[ENEMY_ATTACK …]`; npc Thug 2 `[ENEMY_ATTACK …]` | "⚙ … damage: rolled 6 + 3 = 9 slashing" / "⚙ Thug 1 attacks Kell Varrow: HIT for 4 damage. Kell Varrow is at 24/28 HP." / "⚙ Thug 2 attacks Kell Varrow: HIT for 5 damage. … 19/28" | Thug 1 12 → 3; player 28 → 19 (4 + 5, once each); **round 2**, player's turn |
| 6 | attack | gameplay `[ATTACK … Target="Thug 2"]` | d20 ask | pending attack |
| 7 | `8` | gameplay `[ENEMY_ATTACK: Thug 2]` `[ENEMY_ATTACK: Thug 1]` on the player's turn | "⚙ … 8 + 5 = 13 vs AC 13 — HIT; roll 1d8" / "⚙ Thug 2's attack did not go through: Out of turn: it is Kell Varrow's turn …" (and Thug 1) | refused attacks did nothing; HP 19 |
| 8 | `4` | gameplay `[ATTACK …]` (refused: "no attacks left this turn"); npc Thug 1 (MISS); npc Thug 2 (MISS) | "⚙ … rolled 4 + 3 = 7" + two MISS lines | Thug 2 12 → 5; **round 3** |
| 9 | attack | gameplay `[ATTACK … Thug 2]` | d20 ask | pending attack |
| 10 | `19` | gameplay (none) | "⚙ … 19 + 5 = 24 vs AC 13 — HIT; roll 1d8" | pending damage |
| 11 | `7` | gameplay `[HP_CHANGE: delta=-7 reason="Kell's longsword blow"]` (**refused**, F2), `[ENEMY_ATTACK: Thug 1]` | "⚙ … rolled 7 + 3 = 10 slashing" | Thug 2 dead; Thug 1 failed its morale save and fled; the fight ended (no active enemies) |

Server log: no `reconcileTurn` crash and no combat-loop errors in any run. Timing: 1.5–4.8 s per message, including two NPC calls.

**Run 1** (before the later fixes) found:
- the `[object Promise]` ATTACK RESULT: the DM narrated two engine hits as misses;
- the initiative reply acting for Thug 2, so the loop asked Thug 2 again ("already used its action");
- the DM echoing "[ATTACK RESULT: Hit]" and "Roll 1d8+3".

**Run 2** found:
- the next-turn restated hit (23 → 18);
- the player's blow on the player (18 → 9);
- `[COMBAT_END]` with both thugs standing (Question 3);
- the reconciliation notes in the player's text.

All except `COMBAT_END` are fixed, and each fix has a test.

**Run 4 (after the prompt-wording fix):** clean, 8 messages. Thug 1 (first, 18) attacked on the initiative message before the player acted (HIT for 6, 28 → 22). Both thugs acted after the player's damage ("rolled 6 + 3 = 9"; Thug 2 15 → 6) and the round went 1 → 2. HP dropped only from engine hits (22 → 16). The DM's `[HP_CHANGE: delta=-6 reason="Kell's longsword"]` (F2) and `[HP_CHANGE: delta=-4 reason="Thug 2's blade"]` (the in-fight guard) were both refused; HP stayed 16. The DM never told the player which modifiers to add. The kill (4 + 3 = 7) dropped Thug 2; Thug 1 failed morale and fled, and the fight ended. No server errors.

## "Fixed looks like", per item — evidence
- **P1:**
  - The order shows (tracker `turnState`).
  - A thug first attacks before the player's first action ("thugs first" test: both thugs attack before "then it is the player's turn"; live run 2 message 2: Thug 1 attacked on the initiative message).
  - Both thugs act after the player's attack resolves, and the turn returns (run 3 messages 5 and 8).
  - The round climbs (run 3: 1 → 2 → 3).
- **P2:**
  - An enemy hit is narrated with the engine's damage: the ⚙ lines, plus the system note the DM receives.
  - HP drops once: run 3, 28 → 24 → 19 for 4 + 5; test "the player loses exactly the engine's damage (the DM's HP_CHANGE -5 was not added)".
  - An out-of-turn attack is explained: run 3 message 7; test "the refusal is stated to the player".
- **P3:** `Target="Kell"` and `Attacker="TEST_COMBAT"` resolve (unit tests); live `Target="Kell Varrow"` resolved every time.
- **P4:**
  - After a hit the player is asked for the engine's own dice ("Roll 1d8 for damage — the engine adds +3 after").
  - The thug's HP drops by the rolled amount plus the flat bonus: run 3, 12 → 3 for 6 + 3, 12 → 5 for 4 + 3, 5 → dead for 7 + 3.
  - No converted path rolls for the player: `character-hp` asserts "the engine rolled no die for the player's death save" (empty roll log), and the concentration and Second Wind tests assert nothing is rolled before the report.
- **P5:** `turnState {turnOrder, currentTurn, round, encounterSeq, awaitingInitiative}` on every combat response; the tracker reads it.
- **F1:** no `reconcileTurn` error line in any probe's server log.
- **F2:** live refusals in run 3 (messages 5 and 11); tests.
- **F3:** "Thug 1,Thug 2" in tests and live; the death-event XP still comes from the bestiary ("death event carries bestiary XP value (50)").
- **7:** the `rollMath` array in every response (run 3 lists them), rendered by `RollMathPanel`.

## Files changed
| File | New / edited | SHA-256 | Bytes |
|---|---|---|---|
| `CLAUDE.md` | edited | `c1c1fa45682d719583ffe21df662706b7b470b45ce682f99cf6143deb4bcf3de` | 26410 |
| `client/package.json` | edited | `1a4946b2f3186b8d80bbedff703b8ee438f142285e6d0a8b89427e073472f953` | 427 |
| `client/src/components/CombatTracker.jsx` | edited | `6955aa0a7b17bb87d098779c61a29a4732641f6f7b9dc3ebcae30dc58d3c48cb` | 4378 |
| `client/src/components/DMSession.jsx` | edited | `12d70831bc136895879b6cd190356abe329c56590c260f3b06763fcc695d94c9` | 130232 |
| `client/src/components/RollMathPanel.jsx` | new | `344e1811aa45e30c94228f9a173cbe5799ce184f0cd30a8fecf17582f862b663` | 2328 |
| `docs/pm/combat-loop-fix/BRIEF.md` | new | `7c289c9bcad61c0174307484fcc024f3b20763f3461d6ad12fe36a5492f94541` | 14497 |
| `package.json` | edited | `d393d3fe275fd4fc317b02191dc070930d55320a592e00c2c17cba80bab381ab` | 1398 |
| `server/routes/dmSession.js` | edited | `fbac3d39106357a9f1458eccaae188d4a5e6e53904cf3ff670b85f8a195c5e8f` | 216335 |
| `server/services/artificerService.js` | edited | `557893856355ead3886036544b20f31a02e63cc681cc9c5a10e7e470d13c587d` | 40314 |
| `server/services/bestiaryLookupService.js` | edited | `01023b9577dbd20c5952ea82034f0efa37a90c0bf5d5579322f9fb9d17c7482f` | 11766 |
| `server/services/bestiaryService.js` | edited | `db80427b1e9708e4d29076add2946b6a3124b8c0e9770b8a969e835300a957a9` | 1504 |
| `server/services/characterHpService.js` | edited | `dc2453cd9b2ad75abd8d24237b8b81ded8565fd7f028be42cef382b626fbbc91` | 20509 |
| `server/services/classFeatureService.js` | edited | `cd82faf248179aefcfe5c99d299af2abcd76a420c94aeb5434037b5dc17d914e` | 39152 |
| `server/services/coldExposureService.js` | edited | `3d1f2ec2b5cdc34e91813efaa00f37d2b99960192ed80d5f9da8c2f0e03336ab` | 25686 |
| `server/services/combatLoopService.js` | new | `941fe24a31110680966bdd44ab1d5c7206ec40b2609a9b98f0f3084399d2ade0` | 22371 |
| `server/services/combatMarkerService.js` | edited | `d0972cabf7d905fd1d772af6a37c94cc6c6be4510cd8ba131a1b52979e45a9f8` | 87777 |
| `server/services/concentrationService.js` | edited | `3e447c6bd3416518b8f4efd4756bf8d5c58ef48b1bf0df4067112e7e86d1d022` | 12611 |
| `server/services/conditionService.js` | edited | `6ed8c80ad9dc6abd70454694b7a4e2a464434d41adc68611bf042abe7da08efc` | 52975 |
| `server/services/damageTableService.js` | edited | `804e553a5b86cafb2f9a7bf7bb7dd5abf55017d9886913baa367f194e76d8088` | 12808 |
| `server/services/displayService.js` | edited | `0d4936decc687dfef76b1ce9296c27ce3099bd712a78c600986d9891b8012786` | 29569 |
| `server/services/dmPromptBuilder.js` | edited | `bcdbac9a7a48cf265b6522e3ade96d36393f5b29701aa69340ebd41073f45f4a` | 195673 |
| `server/services/enemyEconomyService.js` | edited | `2614f482634e571214d78a9927cf33cb72cb62d39853d9a3e6592aff0ae4729b` | 19283 |
| `server/services/enemySpellService.js` | edited | `2c023496df7e5a1e6004654e6eebbabd178e5778691a01bf7f14df06bf911c25` | 80968 |
| `server/services/fictionMarkerReconciliation.js` | edited | `35044c4be787722dbb2618e62de9226490d1aab49e4c2c80df7dc272c1db48e0` | 4695 |
| `server/services/partyAttackService.js` | edited | `00d841628c08980236210bd448bb96b78e3acef7b7ea0d0b005165600dcfdb6d` | 128082 |
| `server/services/restTimeService.js` | edited | `803ed7b9673f2b0c859c3e0f88a7b894e21cac40527b54f0e6f76aed56e70620` | 50924 |
| `server/services/rollRequestService.js` | edited | `d0f97af9c51e9396e7d7fa8b077097e865f361dc97634f21ab4f16cd75721a9c` | 52502 |
| `server/services/spellCastService.js` | edited | `aaeec0d5b49ebe7be6585e5fea36bd12e6c4c107a2b3529be50fbaf1cfce4a0d` | 92928 |
| `server/services/subclassMarkerService.js` | edited | `8b123bf967411b9be244658175405807ea4532e75c71b19bc7b6299addc11015` | 43613 |
| `server/services/turnLedgerService.js` | edited | `300a8fc83d5036ff4b4f11dadf9769012e31063339c6d76b572cad6f057331ec` | 20239 |
| `server/utils/playerName.js` | new | `1db14db09fdd2d7856d8d007a97b8ac96c0b557fb97de95d28bda3cc3c70b781` | 1415 |
| `tests/capstone-combat.test.js` | edited | `df8e993f708c24dc8fa880c9e3257630af7d71be05184e940e42c13fad9766b5` | 28261 |
| `tests/character-hp.test.js` | edited | `ab849eb402e6fd82a45cd8a4870ce8c9a7eedb0e3d886504e8eb6d8c01cb4b21` | 8721 |
| `tests/combat-loop-fix.test.js` | new | `10ea502106c69ff1a4ce7a1d7f2cc0679ba00a8d09144ea513eb873b32b4af6f` | 22684 |
| `tests/combat-real.test.js` | edited | `974e9140bc1f5bae7d99a54a4efc2398d9d11260182cea409eba6dfca40f1070` | 26836 |
| `tests/concentration.test.js` | edited | `ddd64778184e84394564ca357e43dbe8f4302e3a9c7fe6e0e98a061606000c04` | 3382 |
| `tests/exhaustion-2024.test.js` | edited | `2dd06502b3b920485a1dbccc2699a998165bcc73fc38de417565d4edb2427b39` | 17737 |
| `tests/hybrid-combat-dice.test.js` | edited | `cbc27e0a420486356ba1e6bd4a5c0a0350cb00b66fc4e6c79e0926928ad1ec76` | 14246 |
| `tests/item-1b-cleave-push-slow.test.js` | edited | `d1d4f6c1b3980a0098b18c685fc838e7f625fbb37c1610b963d55c89ff87e635` | 16749 |
| `tests/item-2a-features.test.js` | edited | `fd8e77310d6a9902943ee826a19a38c67550c493b8300b1b1a2377d78f4bc96b` | 16561 |
| `tests/item-3d-action-markers.test.js` | edited | `4f5d489d1c32ec87dc9330408aa977688dc65a574c284fc4f204c25fffaa17dc` | 65171 |
| `tests/item-4-movement.test.js` | edited | `f24ee45a7baa7ef2408b731696739db4a2c6d26c54d36d4117c0a681217f1907` | 30792 |
| `tests/item-5-enemy-economy.test.js` | edited | `e07a4a99f9014560ea970063cad62af6c1a0613913965f43d31b048121de22a3` | 14244 |
| `tests/item-7-damage-tables.test.js` | edited | `67c53057e160c64c7e252524b5993f14e238beac92e3a198326fb4630bd30c34` | 19347 |
| `tests/mechanics-hooks-attack.test.js` | edited | `5b10a807221e18d272298bb6d47dadc37a09f115c8baceee1735e74e87bb35d9` | 23972 |
| `tests/mechanics-hooks-crit.test.js` | edited | `b1853f5b363851a7b8fa89cce216a80ed17edc3cd358481bfd9b05ef47db262f` | 15961 |
| `tests/s1-campaign-gate.test.js` | edited | `874ee64fdf168e18c36824e80a7d4fc188a350c06cd1dd2fde419601d6d8d268` | 16750 |
| `tests/s2-damage-at-zero-hp.test.js` | edited | `f58b9c4df0bd0b536826e86bcb311aba47e740ec92e067a47498dbac63232ae1` | 15178 |
| `tests/turn-e2e.test.js` | edited | `ffbda73897462326f70a32c413fc8ac182da7be00c771d8f3cbfe5082d5994a4` | 16925 |
| `docs/pm/reports/combat-loop-fix-REPORT.md` | new (this file) | n/a | — |

No migration. Version bumped in both `package.json` files. `CLAUDE.md` updated: the turn-loop step, the HP/death section, and the hybrid-combat section, whose old "no server-side enemy HP table" line was already false (`combat_enemies` is one). RNG list updated too.

## Test results
- **Full `npm test` on the PC:** Files **251/251 green**, assertions **19,737 passed, 0 failed** (Windows notes: `sorcerer-prepared-cap` retried once and passed; `arms-armor-variants`, `item-3a-world-ids`, `npc-bank-wiring`, `subclass-batch3`, `xanathar-names` counted `pass*`).
- **New test, `tests/combat-loop-fix.test.js`:** 80 assertions over the real route with the stubbed model. It covers each P item, F2, F3, the `[object Promise]` fix, the in-combat `HP_CHANGE` guard, concentration, Second Wind and death saves. Its process sometimes hits libSQL's Windows exit crash *after* the results line, which the runner counts as `pass*`.
- **Existing tests changed to the new rules.** Each changed line says why:
  - **Initiative** (`capstone-combat`, `combat-real`): the player is held for their own d20.
  - **Off-turn enemy attacks are refused** (`item-3d`, `item-4`, `item-5`, `capstone-combat`): the attacker's turn comes first. `item-5` group 4 now asserts the refusal.
  - **Reported damage is dice only** (`combat-real`, `item-1b`, `item-2a`, `mechanics-hooks-attack`, `mechanics-hooks-crit`): the engine adds the flat bonus.
  - **Death saves** (`character-hp`, `exhaustion-2024`, `s2-damage-at-zero-hp`, `turn-e2e`): they take the reported d20.
  - **Concentration** (`concentration`, `exhaustion-2024`, `capstone-combat`): the save is pending, then reported.
  - **The deleted advance-turn route** (`s1-campaign-gate`).
  - **Mid-fight plain `HP_CHANGE` is refused** (`item-7-damage-tables`, decision 4).
  - **System notes now ride the stored history after the player's turn** (`hybrid-combat-dice`): the "player turn is stored clean" check skips system-note entries.

## Not done / still open
- **The `:5173` click-through:** steps are below. I couldn't click through myself (no browser in this session); the probe drove the same server over HTTP.
- **The out-of-scope P4 sites** in the survey table (Question 2).
- **`COMBAT_END` with enemies still standing** (Question 3).
- **Residual DM wording.** gemma4:12b still sometimes narrates the turn handoff ("Thug 1's turn. What does he do?") or re-emits `ATTACK` after damage settles; the engine refuses the latter and says so. These are cosmetic, and the engine lines stay authoritative.
- **Known edge:** on the player's turn, any message that leaves no roll pending ends the turn, including a question to the DM.

## Decisions made (reversible, for veto)
1. **When the player's turn ends:** when nothing waits on their dice after a message. Exceptions: settling initiative, a concentration save, or Second Wind leaves the turn open. Reversal: a cheap condition change in the route (`playerTurnDone`).
2. **NPC turns:** one DM call each, with a directive that has the DM describe the attempt only. The engine appends the "⚙" result and a DM note. If the DM's own reply already took the current NPC's attack, the loop skips that NPC's call. Reversal: `runNpcTurns` options.
3. **The engine owns `TURN_ADVANCE`:** the route strips it from the DM's replies, and the manual Next Turn button and `POST /advance-turn` are deleted. Reversal: restore from git.
4. **The F2 guard, widened:**
   - Outside a fight, a damaging `HP_CHANGE` whose reason names the player as the attacker is refused ("Kell's longsword", "the player's arrow", "Kell strikes").
   - **During a fight, any plain damaging `HP_CHANGE` on the player is refused** with a note: combat damage comes only from the engine's markers.
   - Fall, Trap and Hazard table causes still apply.
   - Reversal: one `if` in `characterHpService.js`.
5. **Off-turn ordinary enemy attacks are refused**, but only for enemies listed in the turn order; reactions, legendary and bonus actions are unaffected. Reversal: one check in `enemyEconomyService.js`.
6. **`reconcileTurn`, now that it runs (F1):** during a fight it doesn't auto-apply narrated damage. Its "not narrated" notes go to the DM's history, not the player's text. Reversal: the `combatActive` flag and the route loop.
7. **Damage reports mean dice only:** the player's number is the dice total and the engine adds every flat modifier. The same holds for a damage number sent with the attack roll in one message. Reversal: `settleReportedAttack`.
8. **A narrated attack with no marker becomes a real attack:** on the player's turn, an attack intent or a bare d20 with no `ATTACK` marker makes the engine open the attack on the named (or first) enemy. Reversal: `synthesizePlayerAttack` call sites.
9. **Fixed while found:**
   - the `[object Promise]` ATTACK RESULT;
   - the correction write that rebuilt `session_config` from the turn-start snapshot, which would erase the new pending keys (it now merges onto the live row);
   - bestiary lookups by numbered name (base-name fallback);
   - the table-damage path dropping the concentration check.
10. **The math panel's shape:** fixed at the lower right, collapsible, the last 200 lines, cleared by the player. It shows AC for attacks and the DC for concentration saves (public by the rules). It does not show the DC of DM-requested checks (Question 1).

## Needs Zach's decision
1. **Should the math panel show the DC of a check the DM asked for?** For attacks it shows AC ("vs AC 13"), and for concentration the DC (it follows from the damage). For ROLL_REQUEST checks (e.g. a DC 15 Athletics check), the DM's DC is not shown today, because a visible DC tells the player in advance whether a roll will succeed. Show it, or keep it hidden? Checked: `rollRequestService.js` outcome fields; `RollMathPanel.jsx`.
2. **Should the out-of-combat rolls also become yours?**
   - Short-rest hit dice;
   - hourly cold-exposure saves (can be many per span of travel);
   - crafting checks;
   - the hidden replacement Perception die (silent by design, so the player isn't tipped off that something is hidden).

   Each can take the same "tell me what to roll" flow. The cold saves and the hidden Perception die would interrupt travel and give away secrets. Convert which, if any? Checked: `restTimeService.js:156`, `coldExposureService.js:451`, `craftingService.js:416`, `perceptionPreRollService.js:354`.
3. **What should happen when the DM ends a fight while enemies are still standing?** Live run 2: the DM wrote `[COMBAT_END]` with Thug 1 untouched and Thug 2 at 1 HP, and the fight ended. No marker lets an enemy flee or surrender, so refusing `COMBAT_END` could trap you in a fight the DM has narrated as over. Options:
   - (a) leave it as now, the DM's call;
   - (b) refuse `COMBAT_END` while enemies stand, and add a marker for an enemy fleeing or surrendering;
   - (c) accept `COMBAT_END`, and record any standing enemies as having withdrawn.

   Which?

## How to verify
**Gate:** `npm test` on the PC (expect 251 files green).

**At `:5173` (never `:3000`), with `npm run dev`:**
1. Use a campaign character. Start a session in a town.
2. Type "I'm drinking in the tavern common room when two thugs draw knives and attack me. I fight."
   - **Look for:** under the narration, "🎲 Roll a d20 for initiative — the engine adds … after". The tracker says it is waiting for your roll.
3. Send only a number, e.g. "14".
   - **Look for:** "⚙ Initiative: d20 14 + … = …" and the order. The tracker highlights whoever acts.
   - If a thug is first, it attacks now, with a "⚙ Thug 1 attacks …: HIT/MISS" line, before you act.
4. Type "I attack the nearest thug with my longsword", then send only the d20 you roll.
   - **Look for:** "⚙ … d20 N + 5 = … vs AC … — HIT", then "🎲 Roll 1d8 for damage — the engine adds +3 after" (your weapon's dice).
   - Send your damage roll. The "⚙ … damage: rolled N + 3 = …" line appears, then both thugs act on their own turns, and the tracker comes back to you.
5. Type "I step back and wait."
   - **Look for:** the thugs act again and the round number on the tracker goes up. Your HP falls once per hit.
6. **Look for:** the **Roll math** panel at the lower right of the screen, listing each roll's arithmetic (die + modifiers = total vs AC or DC). Collapse it with ▾; Clear empties it.
