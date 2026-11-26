# Report — mechanical-reactions: every reaction runs through the engine

## Understanding

**The project.** A solo D&D 2024 game. One human player character; the Dungeon Master, the companions and the enemies are all played by a local AI model (gemma4:12b) on Zach's PC, in a persistent Forgotten Realms world. The engine owns the rules (HP, slots, turn order, dice math), and the player rolls their own dice. The AI narrates and chooses what each non-player character does.

**This job.** A reaction (Counterspell, Shield, an opportunity attack, a readied action, a class feature that fires on someone else's turn) must be a mechanic, never a line of narration. The engine resolves it: the budget is checked, the slot is spent, the bonus applies, the outcome is recorded. The brief asks for six things:
1. Survey every reaction path first.
2. Make Counterspell and Shield right on every cast path. That includes the 2024 book rule that a countered spell's slot is not expended.
3. Do the same for every other wired reaction.
4. Close any narration-only path.
5. Test each reaction.
6. Prove one counter and one Shield live on gemma4:12b.

There is no :5173 pass in this job.

**Where the brief and the live build differ (stated before anything else):**
1. **Placement.** The brief's status line says "not approved for courier … do not send while the weekly allowance hold stands". Zach handed it over directly, and story-starters, the job queued ahead of it, is already built (commit 8e6cfe7). I took the handover as Zach's go-ahead. Muse should confirm that reading.
2. **Brief item 2 says "the counter's slot is spent only when the counter fires".** The live code did the opposite on both sides. A party Counterspell spent its slot and reaction when armed, even if no enemy spell followed. An enemy Counterspell spent its slot and reaction when armed and held them until the round ended, even if it expired unused. I built what the brief states (a counter pays when it fires) and list it under Decisions.
3. **The brief assumes the player can take a reaction on an enemy's turn. In the live build the player cannot.** During enemy turns the engine makes one model call per enemy and never pauses for the player (`server/services/combatLoopService.js:416-460`, `runNpcTurns`). So:
   - the player cannot raise Shield when an enemy's attack hits;
   - the player cannot Counterspell an enemy's spell;
   - the player cannot choose to take an opportunity attack.

   The engine resolves all three correctly when they are declared, but there is no moment in play when the player is asked. **Muse decided this on 2026-11-25 ("pause and ask"), and it is now built in this job.** See PM decisions built, below.

## Verdict

BUILT + GREEN, including both PM decisions of 2026-11-25. The unwired class-feature reactions remain a known gap for a follow-up job, as decided.

## PM decisions built (Muse, 2026-11-25)

**Decision 1, in Muse's words:** "Pause and ask: when a reaction trigger fires for the player character, pause the enemy turn and ask the player to use it or pass, only when the reaction is actually available (reaction unused, spell known and slot available). The DM no longer spends the player's reaction unasked."

What the player experiences now:
- **An enemy's attack hits you, and you have Shield ready** (you know Shield, a slot is left, your reaction is free, you are conscious and able to act, and Shield isn't already up).
  - The enemy turn stops *before the damage*, and you see: `⚡ Reaction: Goblin Brute's attack hits you (13 vs AC 12). Cast Shield with a level-1 slot? With +5 AC the attack misses. Reply "Shield" or "pass".` If +5 can't turn the hit (a critical hit, or a total of AC + 5 or more), the prompt says so.
  - **Shield:** the slot and your reaction are spent, +5 AC applies until your next turn, and the same attack is re-judged against the raised AC.
  - **Pass:** the hit lands as rolled.
  - Either way, the enemy turn then resumes. The paused enemy does not act again.
- **An enemy casts a spell, and you have Counterspell ready** (known, a level-3+ slot left, reaction free).
  - The spell stops before it resolves (the enemy's slot and action are already committed, since the casting is under way). You see: `⚡ Reaction: the Archmage is casting Lightning Bolt. Cast Counterspell with a level-3 slot? Reply "counter" or "pass".`
  - **Counter:** your slot and reaction are spent and the enemy makes its Constitution save against your DC (which you never see). If it fails, its spell has no effect and its slot is not expended. If it succeeds, the spell goes off.
  - **Pass:** the spell resolves.
- **The DM writes one of your reactions during an enemy's turn.** That covers your opportunity attack, a readied attack, Dodge, Disengage, Hide or Help firing, a readied spell released, a damage-answer spell, Bend Luck, and Flash of Genius.
  - The engine removes it from the enemy's turn and **asks you** instead ("Goblin is leaving your reach: take an opportunity attack? Use your reaction? Reply "yes" or "pass"."). It runs that exact action only on "yes".
  - If the DM writes your Shield or Counterspell on an enemy turn, it is dropped. The engine asks you itself when the real trigger happens.
  - Whenever something is dropped, the DM is told never to spend your reaction for you.
- **One question at a time.**
  - Anything else the paused enemy wrote after the paused action (a second multiattack swing, a second cast) waits and replays after you answer.
  - A long message isn't read as an answer (for example a question like "What happens if I let it hit?"). The question stays open, the DM is told it's unanswered, and you are asked again.
  - While a question is open, or while an accepted opportunity attack waits on your d20, the enemy turns don't run on.

Technical shape:
- New: `server/services/reactionOfferService.js`.
- The enemy attack splits into judge, hold and land: `landEnemyAttack` and `resumeHeldEnemyAttack` in `enemyCombatService.js`.
- The enemy cast hold and the "queue behind the question" step are in `combatMarkerService.js`.
- The loop's `shouldPause` hook is in `combatLoopService.js`.
- In the route (`dmSession.js`):
  - the answer is resolved before the DM narrates, and its result is handed to the DM as a binding fact;
  - player reactions are filtered out of enemy-turn replies;
  - the loop resumes past the combatant whose turn already ran;
  - the question rides `rollPrompts`.

**Decision 2, in Muse's words:** "The 104 subclass reactions and the base-class/feat reactions stay DM-narrated in this job, with one fence: the DM must not narrate a number change the engine didn't apply." Built as one terse DM prompt line: *"Class-feature reactions with no marker (Uncanny Dodge, Cutting Words, Sentinel, Protection, …) you narrate in words only — never state a number change (damage reduced, AC raised, extra damage, HP) the engine did not apply."* The same line tells the DM the engine asks the player about their own reactions. This is a prompt fence only: no engine check catches a model that ignores it. That is stated as a known gap.

## Files changed

There are no migrations. The version went from 1.0.219 to **1.0.220** in both package files. SHA-256 hashes are taken at commit `8e464e0`.

| File | New / edited | Size | SHA-256 |
|---|---|---|---|
| `client/package.json` | edited | 427 B | `17d34d9eb90075b9f39081a71f2a0c5fb789eed0e51db6612fd08a7e8f224727` |
| `docs/pm/mechanical-reactions/BRIEF.md` | new | 13474 B | `a4e30502c10cc9d41caf9e8562f62bcdcf7fdbfeb36f4a2b67cc580897807c5f` |
| `package.json` | edited | 1398 B | `2f983c5b7ca3a30b2f88e11e204c5b5ef15dc65fc1b192576fd1d38fd85241cc` |
| `server/routes/dmSession.js` | edited | 235777 B | `1c96cc56bf41678e2f3338b19abd2c69558be93253ab9f3ff590236514a5aa9e` |
| `server/services/artificerService.js` | edited | 40712 B | `49980e47ed77bb21449096683223471b6d0e045fccf32d2e373f3a3bfbf95167` |
| `server/services/combatMarkerService.js` | edited | 101584 B | `5870cbecb50c3274eeddca85482a4eff4c8594622d3bff3292bccb8af0f1f137` |
| `server/services/displayService.js` | edited | 30664 B | `319370e2354e712e5bfffcec281c703c1c5d84b38a9976bf454a49539b453e01` |
| `server/services/dmPromptBuilder.js` | edited | 198288 B | `28f2ef817b907d60a9ee665a45886c056bbb76050bde64db55d3b426036202f3` |
| `server/services/enemyEconomyService.js` | edited | 20084 B | `8b2eddf9310a69903798e9fcd6dc5d278fff26cfac1efd0446c68d285e36e215` |
| `server/services/enemySpellService.js` | edited | 86508 B | `6169ed7cc6ed47822b3af826d284fa1487758c6a1d93013dfabaef8f1031950d` |
| `server/services/markerStrip.js` | edited | 2729 B | `37a4a8f3eb018deb0ab57b09173be74732d482988c91c8475faa98a1f6c542a2` |
| `server/services/reactionService.js` | edited | 4415 B | `1865c867f0263728cb9a310aaadd9db93de4c5fe39fbf4e5abaad3801dd2cbee` |
| `server/services/ruleVerifiers.js` | edited | 17303 B | `15f56761814a286e29b26221dda1d91e2643513249a2c7c02e8c4f4bb932df57` |
| `server/services/spellCastService.js` | edited | 106073 B | `e6a6fa6b1404e8f5e88d9e1c974275964bac52181cd2afa02fdb8cbc105d81bc` |
| `server/services/subclassMarkerService.js` | edited | 47753 B | `1bab0b8505ef50ddcc0389128896e44736ebd2bf4fd51fa0760ba19a7a13c6d6` |
| `tests/display-casting.test.js` | edited | 22991 B | `44ca11542345de3a34d05b83d486be08aa84e06a19a547a3097e8eee9aa43c5a` |
| `tests/item-6-spells.test.js` | edited | 63150 B | `e2c9f8addbe727dc649ccf9c82dcfb4794bff81c0151e05b684506e30a58669e` |
| `tests/live/reactions-live.mjs` | new | 11440 B | `26479769fbd9469809a4e1d767af3592c25e4a924812e1b590b67051aef6e750` |
| `tests/mechanical-reactions.test.js` | new | 27547 B | `1e0b671a494396524ae20c85cddf2fd77872e1af94a49be66bfe3e1db065f4c1` |
| `tests/reactions-turn-e2e.test.js` | new | 7868 B | `053a77c86330a984b5cafb15e90798ce33b948abae927b973aa4949c47d8618d` |

The brief was placed at `docs/pm/mechanical-reactions/BRIEF.md`, the path Zach named; the brief's own text suggests `reactions-mechanical/`. Its contents are byte-identical to the file Zach handed over.

**Second build commit `babd4e3` (PM decisions 2026-11-25).** These hashes supersede the table above for the files listed. Same job, so the version stays at 1.0.220.

| File | New / edited | Size | SHA-256 |
|---|---|---|---|
| `server/routes/dmSession.js` | edited | 240961 B | `dad471dbe2c33b2f6d96458ff374f0d84020424b56db146b74dcd095b458affe` |
| `server/services/combatLoopService.js` | edited | 25872 B | `893ccb426bb5d657f6028a0d00cee769e88d9099495d8931111d60920fc8892c` |
| `server/services/combatMarkerService.js` | edited | 103782 B | `41fc742e8ba5418bc17747b4b6c612cb21cddf81f79d7432d5a60129cacfab20` |
| `server/services/dmPromptBuilder.js` | edited | 198722 B | `5daf0c6f73fa2e3c169ca2f5e27bf52c02b99261ae5dc74a1aef03a3a6d36b68` |
| `server/services/enemyCombatService.js` | edited | 23397 B | `7556ba297c5244ae414b57f81ff9fb68d04c944118d09735e9b39b29c9212190` |
| `server/services/reactionOfferService.js` | new | 19725 B | `c900ec29628ab7060c47d209ae125f658ffc6d420d25d70a57e5dfd8c96c6013` |
| `tests/live/reactions-live.mjs` | edited | 14429 B | `668712869ae2245a6381fc8753e5719cbc0472ded1cafa19192e537842259aa2` |
| `tests/mechanical-reactions.test.js` | edited | 36144 B | `307d1777e9dfaf8818b0c48bdfd6a26ec546c4aa43089e6d7cf7fcc8f5e213fb` |
| `tests/reactions-turn-e2e.test.js` | edited | 10964 B | `b3cfcad1edf39e2296f85f024dc5029d72fbb545dde05c16072ba00ca9c2a619` |

## What was built (in play)

- **A countered spell no longer burns its slot.** This holds on every cast path:
  - the player's cast (refunded when they fail the Constitution save);
  - a companion's cast (never spent);
  - an enemy's cast (refunded);
  - a display cast and an enemy display cast;
  - a readied spell (never spent).

  The action is still wasted, as the book says. A spell that gets through spends its slot exactly once, as before.
- **A Counterspell pays when it fires, not when it is declared.** If the player or a companion declares a counter and no enemy spell follows, nothing is spent. When it fires, it spends the counterspeller's slot and reaction once. An enemy's held counter that expires unused costs the enemy nothing. If the counterspeller can no longer pay when the spell comes (reaction already used, slot gone, dead or incapacitated), the counter does not fire and the spell goes on. The DM gets a notice saying why.
- **Readying a spell can now be counterspelled.** The 2024 book treats readying as casting the spell and holding it. That path skipped the counter check before; now it is covered.
- **Bend Luck (Wild Magic Sorcerer) and Flash of Genius (Artificer) now take the reaction.** In a fight each needs the character's reaction and spends it exactly once. A second use in the same round is refused, and the refusal spends no sorcery point and no Flash use. Out of combat they work as before.
- **The DM is told the true rule.** The prompt line that said a countered spell "fizzles with its slot spent" now says the spell has no effect, its action is wasted, and its slot is not spent. It also says a counter spends its own slot and reaction only when it fires. The two DM notices that said "slot stays spent" now say the slot is not expended.
- **The live probe found three problems, and all three are fixed.** These showed up only on the real model:
  - **Shield written without the reaction flag.** gemma4:12b wrote `[SPELL_CAST: Spell="Shield" Level=1]` without `Reaction="true"`. The engine refused it without telling anyone, while the prose said a barrier went up. A spell that can only be a reaction (Shield, Counterspell, Absorb Elements, and the rest) is now treated as a reaction automatically, on both the party and enemy cast paths.
  - **Shield narrated with no marker.** When the player says "I cast Shield" (or Absorb Elements, Hellish Rebuke, Backlash) and the DM narrates it without writing any marker, the engine now opens the player's declared reaction itself. This is the same approach the engine already takes for a player attack the DM narrates without a marker. The player then sees a ⚙ line with the real result ("⚙ Shield: +5 AC until the start of your next turn…", or why it was refused). If the player declares a Counterspell and the DM writes no marker, the player is told plainly that it did not take effect. In every one of these cases the DM is corrected next turn.
  - **A countered spell narrated as hitting.** On the turn the player's save fails, the countered outcome is now a binding engine fact the DM reads in the player's action text, plus a ⚙ line for the player ("⚙ Your spell is countered: it has no effect. Your action is spent, but the spell slot is not."). Before, the outcome went only into a notice block at the end of the system prompt, which the model ignored once and narrated the darts hitting. The same fix covers a countered display.

## Reaction inventory (survey, item 1)

Paths are from the live bytes after this job's edits (branch `phase-4-hybrid-combat`).

| Reaction | Trigger / hook | Budget check | Engine-resolved? | DM prompt |
|---|---|---|---|---|
| **Counterspell — party → enemy cast** | `SPELL_CAST Reaction="true"` arms on the message context (`spellCastService.js:1611`); fires inside `ENEMY_CAST` (`combatMarkerService.js` step (e)) and `ENEMY_DISPLAY` (`displayService.js`) via `firePartyCounter` (`enemySpellService.js:728`) | at arm (check only) + at fire (spend) | **Yes** | Taught ("same message as the enemy cast") |
| **Counterspell — enemy → party cast** | `ENEMY_CAST Reaction="true"` arms in session config until round end (`enemySpellService.js` `armEnemyCounter`); fires in `castPartySpell` (`spellCastService.js` step 7), `DISPLAY` and, new, `READY Spell=` (`combatMarkerService.js:1460` `counterReadiedHold`) via `fireEnemyCounter` (`enemySpellService.js:756`) | at arm (check) + at fire (spend) | **Yes** | Taught |
| **Shield — party** | `SPELL_CAST Spell="Shield" Reaction="true"` (`spellCastService.js:1624`); +5 read in `resolveEnemyAttack` (`enemyCombatService.js:256-263`), enemy spell attacks and Magic Missile (`enemySpellService.js` `shieldBonusFor` callers) | yes, spent once | **Yes** (slot, reaction, +5 on every enemy attack path) | Taught |
| **Shield — enemy** | `ENEMY_CAST Spell="Shield" Reaction="true"`; +5 read by party attacks and by a pending PC attack recomputed at settle (`partyAttackService.js:1282`, `:1703`) | yes | **Yes** | Taught |
| **Absorb Elements / Hellish Rebuke / Backlash** (party and enemy) | answer the last-damage record, the next message after the hit (`enemySpellService.js:924` `resolveTrioReaction`; records written on every damage path) | yes, spent once after success | **Yes** | Taught |
| Other reaction-only spells (Silvery Barbs, Feather Fall, Temporal Shunt, Gift of Gab, Soul Cage) | `SPELL_CAST Reaction="true"` generic branch (`spellCastService.js:1645`) | yes | **Partly**: slot and reaction are engine-spent, but the effect is narrated ("not wired") | Not taught by name |
| **Opportunity attack** | `[OPPORTUNITY_ATTACK]` (`combatMarkerService.js:762`) | yes, spent once; Disengage and conditions refuse before the spend | **Yes** | Taught |
| **Ready — attack** (party, enemy) | `ATTACK/ENEMY_ATTACK Ready="true"` (`partyAttackService.js:1389`, `:1570`; `combatMarkerService.js` ENEMY_ATTACK Ready branch) | yes | **Yes** | Taught |
| **Ready — Dodge / Disengage / Help / Hide** | `fireReadiedAction` (`combatMarkerService.js:1439`) | yes | **Yes** | Taught |
| **Ready — spell** | hold at `READY Spell=` (`holdSpellSlot`, `spellCastService.js:1240`), release `SPELL_CAST Ready="true"` (`releaseReadiedSpell`, `:1483`) | release spends the reaction | **Yes** (and the hold is now counterable) | Taught |
| **Bend Luck** (Wild Magic Sorcerer 6) | `[BEND_LUCK]` (`subclassMarkerService.js`) | **was missing; now spent once** | **Yes** (as of this job) | Not taught (marker-teaching job left it untaught) |
| **Flash of Genius** (Artificer) | `[ARTIFICER_FLASH]` (`artificerService.js`) | **was missing; now spent once** | **Yes** (as of this job) | Taught |
| Heroic Reroll, Tides of Chaos, Tamed Surge, Hound of Ill Omen, Accursed Specter, Faithful Summons | (the class-audit markers) | n/a | n/a: **not reactions** in the book (Tides of Chaos, Tamed Surge and Heroic Inspiration have no reaction cost; the summons are bonus actions or triggers) | — |
| **Flash of Genius (Scholar, homebrew)** | `SCHOLAR_FLASH_OF_GENIUS` handler written in `scholarService.js:349`, but `registerScholarMarkers` is **never called** and the marker has **no schema** | — | **Unwired** | DM sees text only (`scholarService.js:257`) |
| **Subclass reaction features (104)** | e.g. Cutting Words, Warding Flare, Spirit Shield, Uncanny Dodge (Duelist), Riposte, Protective Field, Arcane Deflection, Slayer's Counter… (`server/data/subclasses/*.js`, each `engine:` line says "DM-prompt only" / "DM-adjudicated") | none | **Unwired**: narrated | Prompt text describes them |
| **Base-class / feat reactions** | Uncanny Dodge (Rogue), Deflect Attacks (Monk), Interception, Protection (`featRegistry.js:77-78`, "prompt-only"), Sentinel, Mage Slayer, Polearm Master reaction, War Caster reaction spell | none | **Unwired**: narrated | Prompt text |

**Both slots, per cast path** (the counter's slot and the countered caster's slot):

| Cast path | Counter's slot (before → now) | Countered caster's slot (before → now) |
|---|---|---|
| Player cast vs enemy counter (`castPartySpell` step 7) | spent at arm, kept even if unused → **spent when it fires** | reserved at declaration and **kept on a failed save** → reserved, **refunded on a failed save** (`applyPendingSaveEffect`) |
| Companion cast vs enemy counter | spent at arm → **spent when it fires** | **spent** → **not spent** |
| Enemy cast vs party counter (`ENEMY_CAST` step (e)) | spent at arm (even with no enemy cast) → **spent when it fires** | **spent** (`castEnemySpell`) → **refunded** (`restoreEnemySlot`) |
| Player display vs enemy counter (`DISPLAY`) | spent at arm → **spent when it fires** | **kept on a failed save** → **refunded** |
| Companion display vs enemy counter | spent at arm → **spent when it fires** | **spent** → **not spent** |
| Enemy display vs party counter (`ENEMY_DISPLAY`) | spent at arm → **spent when it fires** | **spent** → **refunded** |
| Readied spell hold vs enemy counter (`READY Spell=`) | **no counter check at all** → **spent when it fires** | **not counterable** → **not spent when countered**, spent once when held |
| Readied spell release (`SPELL_CAST Ready="true"`) | n/a: the spell was cast at hold time | n/a |
| Multi-target casts | one counter per cast, same rule | same rule |

## Per-item verdicts

1. **Survey:** DONE. The inventory is above.
2. **Counterspell and Shield first:** DONE for every cast path the survey found, including the readied-spell hold, which skipped the hook before. "A counter with no DC stays armed" is kept unchanged for enemy counters, as the brief asked. A party counter with no DC does not fire and spends nothing (see Decisions).
3. **Every other reaction:** DONE for the wired ones. Bend Luck and Flash of Genius did not spend the reaction budget; now they do. Opportunity attacks, Ready and the trio were already correct, and they are now covered by this job's suite. The unwired features are reported below, not built.
4. **No narration-only path:** PARTIAL. Four paths are closed (listed below). The unwired class features are still narration-only, and the brief forbids building or re-teaching them here. That conflict goes to the PM (question 2).
5. **Tests:** DONE. There are two new suites: `tests/mechanical-reactions.test.js` (84 assertions, 13 groups) and `tests/reactions-turn-e2e.test.js` (the real turn route over the stubbed model). Five old assertions were updated to the new rules: four to "a countered slot isn't expended", and one to "a reaction-only spell implies the flag".
6. **Live probe on gemma4:12b:** DONE. One Shield and one Counterspell were driven end to end through the real route; the final run was engine-correct with matching prose. The probe also surfaced four defects, all fixed (paths 5–8 below). The enemy arming its own counter was not model-driven (see Live probe).
7. **No :5173 pass:** none was run. The final-test checks are listed under How to verify.

## Narration-only paths closed (item 4)

1. **The DM prompt taught the wrong outcome.** `dmPromptBuilder.js` said a countered cast "fizzles with its slot spent", so the DM would narrate a slot loss the book does not have. It now states the book rule. Evidence: suite group 12.
2. **Two engine notices to the DM said "slot stays spent".** They were in `enemySpellService.js` (countered cast) and `displayService.js` (countered display). Both now say the slot is not expended. Evidence: suite group 12.
3. **Bend Luck and Flash of Genius ran as reactions without the reaction budget.** The DM could fire them any number of times a round alongside a Shield or an opportunity attack. They now go through the budget. Evidence: suite groups 9 and 10.
4. **A readied spell bypassed an armed Counterspell.** The DM could narrate an enemy's held counter while the engine ignored it, or the reverse. The hold now runs the counter. Evidence: suite group 6.
5. **A reaction spell refused for a missing flag.** A Shield or Counterspell written without `Reaction="true"` was refused without a word, so only the prose remained (live probe). Reaction-only spells now imply the flag. Evidence: suite group 11, `item-6-spells` group 8, and live probe A.
6. **A player's declared reaction spell narrated with no marker.** The engine opens Shield and the three damage-answer spells from the player's own declaration. For anything it doesn't open, it tells the player the spell did not take effect and corrects the DM (`ruleVerifiers.js` `verifyDeclaredReactionCast`, `dmSession.js`). Evidence: `reactions-turn-e2e` tests 1 and 2, suite group 13.
7. **A countered spell narrated as landing.** The engine's countered outcome is now a binding fact for that turn, plus a ⚙ line for the player. Evidence: `reactions-turn-e2e` test 3, and live probe B.
8. **Engine blocks echoed to the player.** The model copied the DM-only `[SPELL NOTICE …]` block, hidden DC included, into the player's text (live run 2). The player-facing strip (`markerStrip.js`) now also removes the engine's own named blocks: `[SPELL NOTICE — system facts for the DM. …]` and `[X — system fact: …]`. It still does not strip arbitrary brackets, so `[OOC: …]` survives. Evidence: suite group 13.

## Test results

**Final: full `npm test` on the PC (builder's run, code at `babd4e3`, with both PM decisions built): 266/266 files green, 20,496 assertions passed, 0 failed.**
- On Windows, 2 files were counted `pass*` (native exit crash after all assertions passed): `mechanics-hooks-spellcast` and `migration-schema-contract`.
- Touched suites: `mechanical-reactions` 120/120 (17 groups; the count moves by a few between runs because the natural-1 branches are modelled, not assumed), `reactions-turn-e2e` 22/22 (4 route tests, including the full pause, answer and resume cycle), `combat-loop-fix` 82/82, `hybrid-combat-dice` 58/58, `turn-e2e` 51/51, `turn-write-ordering` 7/7, `item-6-spells` 147/147, and `display-casting` and `marker-strip` green.

The earlier run, before the PM decisions:

**Full `npm test` on the PC (builder's run, code at `8e464e0`): 266/266 files green, 20,460 assertions passed, 0 failed.**
- On Windows, the runner counted 4 files as `pass*` (libSQL's native exit crash AFTER all their assertions passed, handled by `run-tests.js`): `dungeon-generation`, `mechanics-hooks-crit`, `npc-banks`, `subclass-scanned3`.
- It retried 2 files once after a native crash mid-run, and both passed on the retry: `spellbook-routes` and `story-starters`.
- These are the known Windows runner behaviours, not failures.

The suites this job touched:

| Suite | Result |
|---|---|
| `mechanical-reactions.test.js` (new) | 84/84 |
| `reactions-turn-e2e.test.js` (new, real route over the stubbed model) | green |
| `item-6-spells.test.js` | 147/147 (3 assertions updated to the new rules) |
| `display-casting.test.js` | green (2 assertions updated to the book rule) |
| `turn-e2e.test.js` | 51/51 |
| `turn-write-ordering.test.js` | 7/7 |
| `marker-strip.test.js` | green |
| `mechanics-hooks-markers`, `class-audit-severe-seven`, `artificer-class` | green |

One red run happened along the way, and it was fixed rather than worked around. The first version of the declared-reaction opener called the marker pipeline a second time inside the message handler, and `turn-write-ordering` correctly refused it ("processResponseMarkers is called exactly once (found 2)"). The opener now dispatches through a helper outside the handler, the same way the existing attack fallback (`synthesizePlayerAttack`) does. The dispatch still happens before the single persist.

**Lint:** `npm run lint` reports 14 `no-useless-assignment` errors in the files I edited. Every one is on a `let x = null` line that existed before this job. None is on a line this job added.

## Live probe (item 6)

**Script:** `tests/live/reactions-live.mjs` (not part of `npm test`). It drives the real turn route (Express, `dmSession.js`, `llm.js`, Ollama) on **gemma4:12b** against a throwaway database, `.test-tmp/reactions-live.db`. The fight state is seeded directly (encounter plus turn order), so the probe tests the reactions rather than the model's choice to start a fight. For the counter case, the Archmage's held Counterspell is armed through the same service its own reaction cast uses (`armEnemyCounter`, with fire-time payment), not by the model. That is stated plainly: **the enemy arming its counter was not model-driven in this probe.**

**Final run (after every fix), what actually fired:**
- **A. Shield.** The player said: "I cast Shield (1st-level slot) as my reaction". The player's 1st-level slots went from 0 used to 1 used. The goblin's engine-run attack was "d20 5 + 4 = 9 vs **AC 17** — MISS", which is the player's AC 12 plus 5. The player saw "⚙ Goblin Skirmisher attacks …: MISS."
- **B. Counterspell.** The player cast Magic Missile, and the engine fired the Archmage's counter: its level-3 slots went from 3 to **2**, its reaction was **spent**, and the player was asked for a Constitution save d20. The player reported 3. The player's level-1 slot went from 1 used (reserved) back to **0** (not expended). The Archmage's HP stayed at **99** (no effect). The model narrated the spell "dissolving into harmless sparks before it can even leave your fingertips", and the player saw "⚙ Your spell is countered: it has no effect."

**What the earlier runs showed (and what was fixed):**

| Run | Shield | Counterspell |
|---|---|---|
| 1 | Prose only; the engine refused a marker with no reaction flag; slot unspent | Engine right; the model narrated the darts hitting (notice ignored) |
| 2 | Same as run 1 | Engine right; prose right, but the model **echoed the `[SPELL NOTICE …]` block, including "DC 17", into the player's text** |
| 3 | Same as run 1 (debugged: "Shield can only be cast as a reaction") | Engine right; the model narrated hitting and invented a `[SPELL_EFFECT: … 3 damage]` tag; the ⚙ line was correct |
| 4 | Same as run 1 | The model wrote no usable Magic Missile cast (refused: "no actions left this turn"), so no counter |
| 5, 6 (final) | **Engine-run, +5 applied** | **Engine-run, prose matches** |

**C. Pause and ask (decision 1), live on gemma4:12b.** The player did not pre-declare anything; the goblin's action each round was the model's choice.
- Round 1: "d20 1 + 9 = 10 vs AC 12 — MISS" (a natural 1, so no question).
- Round 2: the goblin hit (13 vs AC 12). The engine paused before damage and asked: `⚡ Reaction: Goblin Brute's attack hits you (13 vs AC 12). Cast Shield with a level-1 slot? With +5 AC the attack misses. Reply "Shield" or "pass".`
- The player answered "Shield":
  - "⚙ Shield: +5 AC until the start of your next turn (level-1 slot and your reaction spent)."
  - The paused attack landed as "d20 4 + 9 = 13 vs **AC 17** — MISS".
  - The player's HP was unchanged (30 → 30).
  - 1st-level slots used went to 1.
  - The turn came back to the player without the goblin acting twice.

One display bug showed up in that run, and it is fixed: the question was printed twice in the narrative. It is now added only through `rollPrompts`, and the route test checks it appears exactly once.

**What was live-probed:** Shield (declared, and asked-and-answered) and Counterspell (enemy against player). The player's Counterspell question, the opportunity-attack question, Ready, the damage-answer spells, Bend Luck and Flash of Genius are **test-proved only**.

## Cost and usage

I can't measure this session's cost from inside Claude Code on this plan, so the figure is unknown and unverified. The work was one build session: a survey, edits to 9 service files and 2 test files, one new suite, one live probe, and full-suite runs. The live probe used only the local model, which costs nothing against the $30/month cap.

## Not done / still open

1. **The player-reaction window is built (decision 1), with these edges left open:**
   - An enemy's **display cast** (`ENEMY_DISPLAY`) does not offer Counterspell to the player. Only `ENEMY_CAST` does.
   - An enemy's **reaction spell** (for example its own Shield) is not offered for Counterspell (see item 5).
   - A player's **damage-answer spell** (Absorb Elements, Hellish Rebuke, Backlash) is not offered automatically when the player is hit. The player can still declare it on their next message, or say yes when the DM writes it on an enemy turn.
   - **Opportunity attacks** are offered only when the DM writes the marker. The engine does not detect "leaving reach" from movement by itself.
   - "Spell known" means the spell is in the character's known or prepared spells (`known_spells` / `prepared_spells`).
2. **Known gap for a follow-up job (decision 2): 104 subclass reaction features, plus base-class and feat reactions, stay DM-narrated.** Examples are Uncanny Dodge, Deflect Attacks, Cutting Words, Warding Flare, Sentinel, Protection, Interception, Spirit Shield, Riposte and Arcane Deflection. The full set comes from `server/data/subclasses/*.js` (each entry's `engine:` line says "DM-prompt only" / "DM-adjudicated"), plus `featRegistry.js:77-78` and `classFeatureService.js:177`. The fence is a prompt line only. A future wiring job would give each one a marker, a reaction-budget spend and (for the defensive ones) a hold like Shield's.
3. **The Scholar's Flash of Genius (homebrew) has no live marker.** A handler is written, but `registerScholarMarkers` is never called and the marker has no schema (`scholarService.js:315-350`). It is reported unwired, not built.
4. **Silvery Barbs, Feather Fall, Temporal Shunt, Gift of Gab and Soul Cage.** The engine spends the slot and the reaction, but each spell's effect is narrated (`spellCastService.js:1645`, "not wired"). They were left as they are, since building those effects is new feature work.
5. **A party Counterspell cannot answer an enemy's reaction spell** (for example an enemy Shield). The book allows it (Counterspell answers any spell being cast). The party counter is checked only on non-reaction enemy casts (`combatMarkerService.js` step (e)). This is a rare corner and is left as a known edge.
6. **An enemy's leveled spell with no `Level=` is cast at level 0 and spends no slot** (`combatMarkerService.js` ENEMY_CAST, `level` defaults to 0). This predates the job and is not specific to reactions, but it means an enemy Counterspell written without `Level=3` costs nothing. I did not change it, because the same default covers every enemy cast. It needs its own small job (default to the catalog level, as `ENEMY_DISPLAY` already does).
7. **A player's countered cast whose save request is replaced by a newer save request** (the single-pending-save rule) keeps the reserved slot spent. This is an ultra-rare corner and is left as a known edge.
8. **gemma4:12b doesn't always follow engine facts.** In two of six live runs the model narrated a countered spell as hitting, even though the engine state was right and the ⚙ line told the player the truth. The fix (the fact placed in the action text) held in the last two runs, but that is a small sample. This is model compliance, not engine behaviour.
9. **The model can write an invented tag** such as `[SPELL_EFFECT: Magic Missile dealt 3 damage]` (live run 3). It is not a real marker, so the player sees it. I did not widen the strip to arbitrary brackets, because that would also eat `[OOC: …]`.
10. **A refused SPELL_CAST is generally not shown to the player.** That covers refusals for no slot, no action left, wrong reaction use and the like. Attacks have a ⚙ refusal line; spells do not. For reaction spells, this job's fallback states the outcome. For every other spell it is still open, and out of scope here.

## Decisions made (reversible, for veto)

1. **Counters pay when they fire.** Arming checks that the slot and reaction are available but spends neither, and firing spends both once. A counter that answers nothing costs nothing. The brief's own wording asked for this. Reversal cost: small, about four call sites.
2. **The player's countered cast reserves the slot at declaration and refunds it on a failed save,** instead of not spending it until the save. This keeps the made-save path exactly as it was. Reversal cost: small.
3. **A countered readied spell spends nothing until it is actually held** (no reservation). Reversal cost: small.
4. **A countered spell's costly or consumed material component is not consumed.** This is unchanged from before this job. The book's Counterspell text speaks only of the slot. If Zach's book says otherwise, this is a one-line change.
5. **A party counter whose caster has no spell save DC does not fire and spends nothing.** Before, it tried to roll the enemy's save against no DC. Enemy counters with no DC still stay armed, unchanged, as the brief asked.
6. **Counters armed before this build carry no payment info.** They fire free (they were already paid at arm time). Reversal cost: none; this only matters for sessions saved mid-round.
7. **A reaction-only spell implies `Reaction="true"`.** That covers Shield, Counterspell, Absorb Elements, Hellish Rebuke, Backlash, Silvery Barbs, Feather Fall, Temporal Shunt, Gift of Gab and Soul Cage, on both the party and enemy cast paths. Before, a missing flag was refused. A non-reaction spell flagged as a reaction is still refused. Reversal cost: one line per cast path.
9. **Offer rules (decision 1), all reversible in `reactionOfferService.js`:**
   - "Known" means the spell is in known or prepared spells.
   - Shield is offered on any hit, including a critical hit or a total too high for +5 to matter. The prompt says when +5 cannot turn the hit, since that is still the book trigger and Shield lasts the round. Reversal: one condition.
   - A reply of more than 8 words is never read as an answer.
   - A DM-written player Shield or Counterspell on an enemy turn is dropped rather than asked, because the engine asks at the real trigger.
   - The question shows the enemy's attack total and the player's AC (as the roll-math panel already does), never a DC.
8. **The engine opens a player-declared Shield, Absorb Elements, Hellish Rebuke or Backlash when the DM narrated it with no marker.** It matches only "cast <spell>" in the player's own words, so "I raise my shield" never trips it. The level comes from "Nth-level" in the action text, or defaults to 1. This follows the existing attack fallback (combat-loop P1). Counterspell is never opened this way, because it needs an enemy cast in the same reply. Reversal cost: remove one block in `dmSession.js`.

## Questions for the PM (Muse)

Both questions from the first report were answered on 2026-11-25 and are built (see PM decisions built). No new questions.

## Needs Zach's decision

Only the gate. There is no spend beyond the cap, and nothing that only Zach can supply. (The two questions above go to Muse first.)

## How to verify

**Evidence:** code commits `8e464e0` (reactions) and `babd4e3` (PM decisions: pause and ask, number-change fence) on branch `phase-4-hybrid-combat`, in the PC repo at `E:\DnD Meta Game\dnd-meta-game`, pushed to GitHub. This report is in the commit that follows it.

**Gate:** run `npm test` from the repo root. Green means 266/266 files and 0 failed assertions, with `mechanical-reactions.test.js` fully green (about 120 assertions) and `reactions-turn-e2e.test.js`, `item-6-spells.test.js` (147/147), `display-casting.test.js`, `turn-e2e.test.js` (51/51) and `turn-write-ordering.test.js` (7/7) all green. A `pass*` or "retried once" note on Windows is the known runner behaviour.

**Live probe (optional, needs Ollama running gemma4:12b):** `node tests/live/reactions-live.mjs`. It writes `.test-tmp/reactions-live-results.json`. Expect:
- Shield: `slot1_after` = 1, and the goblin's attack `rollMath` reads "vs AC 17".
- Counterspell: the Archmage's level-3 slots go 3 → 2 and its reaction is spent; after the player reports 3, the player's slot is back to 0 and the Archmage's HP is 99.

The model varies from run to run (see Live probe).

**Checks for Zach's one final :5173 test (item 7; not run in this job):**
1. **Shield, wizard PC in a fight, on your turn.** Type "I cast Shield (1st-level slot) as my reaction."
   - A ⚙ line confirms the +5 (or the DM's own marker resolves it).
   - The roll-math panel shows the next enemy attack against your AC + 5.
   - One 1st-level slot is used, and casting Shield again the same round is refused.
2. **Counterspell against you.** An enemy caster holds a Counterspell (the DM writes `[ENEMY_CAST: Enemy="…" Spell="Counterspell" Level=3]` on the enemy's turn); then cast a leveled spell at it.
   - You are asked for a Constitution save d20.
   - Report a low number: you see "⚙ Your spell is countered: it has no effect. Your action is spent, but the spell slot is not."
   - Your slot count is unchanged and the enemy's HP is unchanged.
   - No DC appears anywhere in your text.
3. **Asked when hit (decision 1).** Play a wizard who knows Shield, with a 1st-level slot left and the reaction unused. Do NOT declare Shield; let an enemy attack you.
   - On a hit you see `⚡ Reaction: … attack hits you (N vs AC X). Cast Shield …? Reply "Shield" or "pass".`, and no damage has landed yet.
   - Reply "Shield": a ⚙ Shield line appears, the same attack is re-judged against AC X + 5 in the roll-math panel, and the enemy turn finishes without that enemy acting twice.
   - Reply "pass" on another hit: the damage lands as rolled and no slot is spent.
4. **Asked when an enemy casts (decision 1).** Play a wizard who knows Counterspell, with a 3rd-level slot left. When an enemy casts, you see `⚡ Reaction: … is casting …. Cast Counterspell …? Reply "counter" or "pass".`
   - Reply "counter": your 3rd-level slot and reaction are spent. Either "⚙ … countered and has no effect" appears (the enemy's slot count is unchanged), or the spell goes off.
   - No DC is ever shown.
5. **The DM no longer spends your reaction.** If the DM narrates you taking an opportunity attack on an enemy's turn, you are asked "take an opportunity attack? … yes or pass" instead, and nothing is spent until you say yes.
