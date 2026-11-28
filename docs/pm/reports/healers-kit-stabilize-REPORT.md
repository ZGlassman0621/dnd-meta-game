# Report — healers-kit-stabilize: Healer's Kit stabilize, no check + commission year-crossing fix

## Understanding

**The project.** DnD Meta Game is a solo Dungeons & Dragons game. A local AI model (gemma4:12b) is the Dungeon Master and runs every NPC and companion. The engine owns the rules: hit points, death saves, dice math, inventory and the clock. The player rolls their own dice, and the DM narrates what the engine decides.

**This job, Part 1.** In solo play the Healer's Kit is the main way back from 0 Hit Points. The 2024 book says: spend one of the kit's ten uses as a Utilize action, and a creature at 0 HP is stabilized with no Medicine check. A stabilized creature regains 1 HP after 1d4 hours. Before this job the rule was only written on the item; nothing in the engine enforced it. Part 1 makes the engine enforce it in all three directions:
- the player on a downed companion;
- a companion on the downed player;
- a companion on a downed companion.

**This job, Part 2.** A commission ordered near the end of the year must still become ready, and still expire, when that day falls in the next year. Orders stored their deadline as a day-of-year with no year, so "day 370" never arrived.

**Where my understanding differs from the brief or the live code** (none of these blocks the job):
- **The kit comes from the party inventory.** Carried items have lived in one shared party pool (the player character's inventory) since migration 032. So a companion's kit is the party's kit; companions don't carry their own.
- **Kit uses were not tracked anywhere.** I added the tracking (item 3).
- **The book's 1d4 is a die, and the player rolls their own dice (Zach, 2026-11-23).** So when the *player character* is stabilized, the engine asks the player for the d4. For a companion, the engine rolls it: companions are the DM's creatures.
- **Companions had no stored "stable" state.** The Medicine route and the three-successes death-save route both reset the tallies to 0/0. Kit stabilization now gives a companion the same stable state the player has (three successes at 0 HP). Both existing routes are left exactly as they were (the brief fences the Medicine path, and existing tests pin it). The mismatch is named under Not done.

## Verdict

**BUILT + RED-WITH-CAUSE.** Every brief item is built. The full run is red with exactly the five standing leave-and-return checks, and there are no new failures.

## Files changed

Commit `10b0fa5`, branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.226 → **1.0.227**.

| File | New / edited | Bytes |
|---|---|---|
| `server/services/healersKitService.js` | **New** — the kit: uses, refusals, stabilize, 1d4 recovery, dying-ally cue | 19,421 |
| `server/migrations/119_stable_recovery.js` | **New — migration 119**: `stable_recover_at` on characters + companions | 1,390 |
| `server/migrations/120_commission_absolute_day.js` | **New — migration 120**: `deadline_abs_day` / `ready_abs_day` on merchant_orders + backfill | 3,054 |
| `server/services/merchantOrderService.js` | Edited — orders time on the absolute day | 19,694 |
| `server/services/characterHpService.js` | Edited — damage at 0 clears the recovery hour; companion stable state cleared by damage at 0 | 21,049 |
| `server/services/restTimeService.js` | Edited — recovery fires when session time moves; TIME PASSED / REST blocks name who woke | 58,052 |
| `server/services/playerRollService.js` | Edited — the player's d4 as an out-of-combat ask | 7,721 |
| `server/services/combatLoopService.js` | Edited — companion turn directive offers the kit and names who is dying; resuming death saves withdraws the d4 ask | 27,207 |
| `server/services/markerSchemas.js` | Edited — `HEALERS_KIT` schema | 67,306 |
| `server/services/dmPromptBuilder.js` | Edited — the one-line book rule; "stable" line for a kit-stable companion | 199,126 |
| `server/routes/dmSession.js` | Edited — registers the handler; the ⚙ line + DM note; "STABLE" vitals line | 243,087 |
| `server/routes/companion.js` | Edited — death-save route refuses for a kit-stable companion | 73,907 |
| `server/services/deferredResolutionSweep.js` | Edited — passes both day scales to the order resolvers | 5,455 |
| `server/services/livingWorldService.js` | Edited — same, for the (off) living-world tick | 39,603 |
| `tests/healers-kit-stabilize.test.js` | **New** — Part 1 suite | 26,032 |
| `tests/commission-year-crossing.test.js` | **New** — Part 2 suite | 13,382 |
| `tests/live/healers-kit-live.mjs` | **New** — live probe (not part of `npm test`) | 10,760 |
| `tests/deferred-resolution-sweep.test.js` | Edited — two expectations follow the new day scale (see Decisions 9) | 14,887 |
| `tests/marker-strip.test.js` | Edited — schema count 132 → 133 (the new marker) | 10,927 |
| `docs/pm/healers-kit-stabilize/BRIEF.md` | **New** — the brief, placed as asked | 11,746 |
| `package.json`, `client/package.json` | Edited — version bump | 1,398 / 427 |

## What was built (in play)

**Part 1 — Healer's Kit.**
- When the player is down, a companion can kneel and spend a kit use on their own turn, and the player is stable. The player sees, for example: "⚙ Lyra uses a Healer's Kit on Kael: stabilized, no check (kit: 9 uses left)."
- The death saves stop. The player stays at 0 HP and unconscious.
- The player is asked: "🎲 You're stable. Roll a d4 and send the number: that many hours from now you regain 1 HP." When that much game time passes, the player regains 1 HP and wakes.
- The same works for the player on a downed companion, and for one companion on another. A companion's d4 is rolled by the engine, and the ⚙ line says how many hours.
- Each use spends exactly one of the kit's ten uses. When the last use is gone the kit stays in the pack, spent, and the next try says "the party's Healer's Kit has no uses left — it is spent".
- A refused use spends nothing and stabilizes nobody, and the player sees why, for example "⚙ Healer's Kit not used: Lyra is incapacitated and cannot act." A use is refused when:
  - the party has no kit, or the kit is spent;
  - the target isn't at 0 HP, is dead, or is already stable;
  - the user is down, incapacitated, or acting out of turn in a fight.
- A hit on a stable creature ends the stable state and its recovery clock (book rule): the death saves start again.
- The Medicine-check stabilize (no kit, DC 10) works exactly as before.

**Part 2 — commissions across the new year.**
- A commission ordered on day 360 with 10 days of work becomes ready on day 5 of the next year.
- A commission made ready late in the year is held 30 days and expires on schedule in the new year.
- Short late-year orders are ready the same year.
- Placing commissions is still switched off, exactly as before. Prices and the commissions panel are unchanged.

## Per-item verdicts

**Part 1**
1. **Survey first — DONE.** The call chain is below.
2. **The kit works, both directions — DONE.** All three directions and every refusal are built (suite groups 2–5).
3. **Uses are tracked — DONE.** The count lives on the inventory entry (`uses` = uses left in the opened kit). A kit with no record counts as fresh: ten uses (Decisions 2).
4. **The 1d4-hours recovery — DONE, wired to the existing clock.** It fires in `advanceClockForSession`, the one place session time moves (TIME_ADVANCE and REST). No new clock was built.
5. **The DM is told the true rule — DONE.** One line was added to the always-on 0 HP rules. No prompt text said a Medicine check is always required (I searched; the suite checks it).
6. **Tests — DONE.** `healers-kit-stabilize` 66/66. The full run is red-with-cause only.
7. **Live probe on gemma4:12b — DONE.** A companion stabilized the downed player with no check and one use spent. Model non-compliance was found and fixed (Live probe, below).
8. **No :5173 pass — none run.** The final-test checks are under How to verify.

**Part 2**
1. **One scale for deadlines — DONE.** Orders now carry an absolute-day deadline (Representation, below).
2. **Migration — DONE.** Migration 120. The per-case outcome is below. No order is lost, and no year was guessed.
3. **Ready and expiry across the boundary — DONE** (suite groups 1–2).
4. **Tests — DONE.** `commission-year-crossing` 25/25. Both G-3 commission checks in `return-loop` stay green.

## Surveyed call chain (Part 1, item 1)

Paths are from the live bytes after this job's edits.

- **Uses storage (before):** none. Inventory is a JSON array of `{ name, quantity }` on `characters.inventory`, the party pool since migration 032. The crafted kit's text says "10 uses" (`server/data/armorGearRecipes.js:630`), but nothing counted them.
- **Player character's stable state:** death-save successes = 3 at 0 HP (`characterHpService.js:105`, `rollDeathSave` `:275`).
  - Damage at 0 HP clears it (`applyHpChange` `:52`).
  - The engine asks for a death save only while successes < 3 (`dmSession.js:2947` → `combatLoopService.js:146` `setPendingDeathSave`).
  - The player's d20 is settled at `dmSession.js:1739`.
- **Companion death saves:** the `POST /:id/death-save` route (`companion.js:1046`) and companion damage (`applyCompanionDamage`, `characterHpService.js:200`).
- **The Medicine-check path:** `POST /:id/stabilize` (`companion.js:1140`). The caller does the DC 10 check, and the route only resets the counters to 0/0. It is reached from the companion sheet's button (`client/src/components/CompanionSheet.jsx:149`). The player character has no Medicine-stabilize route.
- **How a companion's turn reaches the engine:**
  1. `dmSession.js:2838` calls `runNpcTurns` (`combatLoopService.js:426`).
  2. That makes one DM call per NPC turn with `npcTurnDirective` (`:308`).
  3. The reply goes through `dispatch` (`dmSession.js:2864`) and `processResponseMarkers` to the registered handler.
  4. Results are shown by `combatResultLines` (`dmSession.js:2818`).

  Out of combat, the DM's main reply goes through the same pipeline. The new marker `[HEALERS_KIT: User="…" Target="…"]` rides this route: its schema is at `markerSchemas.js:1263`, its handler and `useHealersKit` are in `healersKitService.js`, and its ⚙ line and DM note are added at `dmSession.js:1446`.
- **The 1d4 recovery:**
  - The kit sets `stable_recover_at`: the engine's d4 for a companion; for the player, `pendingRecoveryDie` → `playerRollService.js:54/107`.
  - The hour fires in `restTimeService.js:282` `advanceClockForSession` → `processStableRecoveries`.
  - Damage at 0 HP clears it (`characterHpService.js`).

## Part 2 — the representation chosen, and the migration per case

**Representation.** Two new columns on `merchant_orders`:
- `deadline_abs_day`: the absolute day the commission is ready;
- `ready_abs_day`: the absolute day it became ready; expiry counts from it.

Both use the world clock's absolute day counter (`world_clock.current_day`).

The day-of-year columns (`deadline_game_day`, `ready_game_day`) are still written the same way. The commissions panel reads them, and presentation is fenced. This is the "minimal and consistent" option the brief allows: the panel and every existing reader are untouched, and only the sweep's comparison changes.

`processDueOrders` / `expireStaleReadyOrders` (`merchantOrderService.js:339/380`) now take the clock, with both scales. The sweep (`deferredResolutionSweep.js:66`) and the tick (`livingWorldService.js:228`) pass it.

**Migration 120, per case.** The live PC database has **zero** orders. Every campaign clock there has the absolute day equal to the day-of-year. I checked this read-only before building.

| Case | What the migration does |
|---|---|
| Pending order, campaign clock with both scales equal (not yet past its first new year) | Deadline copied across unchanged. It already was the absolute day. |
| Ready order, same kind of campaign | Ready day and deadline copied across unchanged. |
| Pending or ready order, campaign whose scales differ (past a new year) | **Not converted.** No year is recorded, so the absolute day can't be known without guessing. The columns stay empty, and the sweep keeps comparing that row on its day-of-year scale, exactly as before. Meaning is unchanged. **Count on the live DB: 0.** |
| Collected, cancelled or expired order | Left alone. These are history, and nothing times them. |

## Live probe (Part 1, item 7)

**Script:** `tests/live/healers-kit-live.mjs`, not part of `npm test`. It drives the real turn route (Express, `dmSession.js`, `llm.js`, Ollama) on **gemma4:12b** against a throwaway database, `.test-tmp/healers-kit-live.db`.

**The scene:**
- Kael (the player character) is at 0 HP and dying.
- The party carries a Healer's Kit (10 uses), and Lyra, a companion cleric, is up.
- A goblin is in the fight, and the turn order is Kael, Lyra, goblin.
- The player sends their death-save d20. The engine then runs Lyra's turn, where the model chooses her action, and then the goblin's.

**Run 1 (before the fix): model non-compliance.**
- Rounds 1 and 2: with only the generic kit mention in her turn directive, the model had Lyra attack the enemy while Kael was dying.
- Round 3: Kael had stabilized himself with three death saves. Then the model wrote a valid `[HEALERS_KIT: User="Lyra" Target="TEST_LIVE Kael"]`, and the engine correctly refused it as "already stable".
- **Fix:** on a companion's turn, the directive now says who is at 0 HP and dying, how many kit uses are left, and the exact marker. It is an offer, and the DM still chooses (`dyingPartyCue`, `combatLoopService.js:455`).

**Runs 4–7 (after the fix): the kit fired on Lyra's first turn in all four.**
- Each time: "⚙ Lyra uses a Healer's Kit on TEST_LIVE Kael: stabilized, no check (kit: 9 uses left)."
- Exactly one use was spent (10 → 9). Kael was at successes 3, failures 0, 0 HP, unconscious.
- **Run 4 (final state, goblin missed):** HP 0, successes 3, failures 0, kit 9, and the player was asked "🎲 You're stable. Roll a d4…". Evidence: `.test-tmp/healers-kit-live-results-run4.json` on the PC.
- **Runs 5–7:** the goblin's engine-run hit landed on the stable Kael and correctly added a failure and cleared stabilization (book rule).

**Defect found in run 5, and fixed.**
- After a hit ended the stable state, the player was asked for a death save, but the d4 ask was still pending too.
- The death save correctly took the player's next number, but the stale ask stayed behind.
- Fix: when death saves resume, the d4 ask is withdrawn, and the d4 prompt shows only while the player is still stable (`combatLoopService.js:146`, `playerRollService.js:107`). Suite group 6 covers it, and runs 6–7 confirm it live.

**Two things the probe did not settle:**
- **The player's d4 reply was not exercised live.** The goblin hit in every post-fix run that would have reached it. The settlement is covered by the suite (group 3: report, refusal of a bad number, recovery hour, and the clock firing the 1 HP).
- **Probe-seeding artifact (not a product defect).** In runs 2–3, Lyra's attacks were refused as "out of turn" *on her own turn*. The probe built her turn key before the engine gave her NPC a world ID, so the keys no longer matched (`companion:1` against `ID0000002`). I fixed the probe by assigning the ID first. I did not check whether a real fight-start can produce the same mismatch, so that is **unverified**.

## Test results

**Full `npm test` on the PC (builder's run, code at `10b0fa5`): 271/272 files green, 20,789 assertions passed, 5 failed.**

The red file is `return-loop.test.js` (81/86). It fails with **exactly the five standing named checks** and no others:
1. `[tick] GAP G-7: a world-clock advance at session end evaluates scene evolution`
2. `[protect] GAP G-4: the player's downtime assignment for TEST_RL_D Mira is scheduled`
3. `[protect] GAP G-5: full downtime jumps the clock by its span, 5 days`
4. `[protect] GAP G-6: the client's end-session request can carry the player's downtime choice`
5. `[protect] GAP G-6: the steward's downtime question is put to the player at session end`

Both G-3 commission checks in that file pass.

Windows notes from the runner: 3 files were retried once after a native crash, and the retry passed. 9 files were counted `pass*` (a native exit crash after all their assertions passed). These are the standing libSQL crash handling in `run-tests.js`.

**Touched suites:**

| Suite | Result |
|---|---|
| `healers-kit-stabilize` (new) | 66/66 |
| `commission-year-crossing` (new) | 25/25 |
| `deferred-resolution-sweep` | 34/34 |
| `character-hp` | 36/36 |
| `s2-damage-at-zero-hp` | 38/38 |
| `integration` | 498/498 (includes the companion death-save and Medicine-stabilize route tests, unchanged) |
| `combat-loop-fix` | 82/82 |
| `turn-e2e` | 51/51 |
| `marker-strip` | green |
| `player-rolls-out-of-combat` | green |
| `rest-time` | green |
| `reactions-turn-e2e` | green |

**Earlier full run, before the probe fixes:** 270/272. The extra red was 2 checks in `deferred-resolution-sweep`, caused by the day-scale change (Decisions 9). Both were fixed before the final run.

## Cost and usage

I can't measure this session's cost from inside Claude Code on this plan, so the figure is **unknown and unverified**. The work was one build session:
- a survey;
- one new service and two migrations;
- edits to 12 files;
- two new suites and one live probe (7 runs, of which runs 2–3 never reached the model);
- three full-suite runs.

The live probe used only the local model, which costs nothing against the $30/month cap.

## Not done / still open

1. **Medicine and three-death-save stabilizations don't start the 1d4 recovery.** The book gives every stable creature 1 HP after 1d4 hours, not only kit-stabilized ones. The brief fences the Medicine path, so only the kit starts the clock. For those creatures a long rest still heals.
2. **Companion "stable" is stored two ways.** A kit leaves a companion at successes 3. The Medicine route and the three-successes death-save route reset to 0/0, so the DM's prompt shows such a companion as dying (0/0). Both routes are fenced and pinned by existing tests (`integration.test.js`), so I left them. Aligning them is a one-line change per route plus two test updates.
3. **Recovery fires only when session time moves** (TIME_ADVANCE or REST).
   - Session-end day jumps don't run the check. The recovery fires late, at the next time advance (the check is "hour reached or passed").
   - A flashback session doesn't move the world clock, so nothing fires there.
4. **The inventory panel doesn't show the kit's uses.** Only the engine line and the DM see the count. Presentation is out of scope.
5. **The commissions panel still shows the day-of-year deadline** (for example "day 370") and counts days from `character.game_day`. This is pre-existing presentation, fenced in Part 2.
6. **In a fight, a companion's kit use must be on that companion's own turn.** If the DM writes it for a companion in the main reply on the player's turn, it is refused as out of turn, like every other companion action. Out of combat it works anywhere.
7. **The live d4 reply and the turn-key mismatch are unverified on the real model** (see Live probe).

## Decisions made (reversible, for veto)

1. **The kit comes from the party inventory** (the player character's, the shared pool since migration 032), for every user. *Reversal:* also look in a companion's legacy `inventory` column — one lookup in `healersKitService.js`.
2. **Uses ride the inventory entry as `uses`.** An entry with no record is a fresh kit with ten uses, so existing saved kits default to ten, as the brief asked, with no data migration. A stack of N kits spends the opened one first. The last kit at 0 stays in the pack, spent. *Reversal:* small, in `spendKitUse`.
3. **The player rolls the d4 for their own recovery; the engine rolls a companion's.** This follows "the DM never rolls for the player". *Reversal:* the engine rolls both — about 5 lines.
4. **A kit-stabilized companion holds successes 3 at 0 HP**, the player's stable state, and damage at 0 clears it. A death save for a kit-stable companion is refused (new 400 on the death-save route). *Reversal:* small.
5. **An already-stable target is refused, so no use is wasted.** *Reversal:* one line.
6. **In a fight, the kit's user must be the one whose turn it is** — the same gate as other actions. Action economy (one action) is DM-attested, as for Dodge and Help; the engine does not count it. *Reversal:* drop the gate — one line.
7. **The companion turn directive names who is dying and the kit's uses** (a live-probe fix). It is an offer; the DM still chooses. *Reversal:* remove the cue — one block.
8. **Part 2 adds absolute columns beside the day-of-year ones rather than replacing them,** and leaves ambiguous rows on their old comparison instead of guessing a year. *Reversal:* moderate — swap the columns and update the panel.
9. **Two expectations in `deferred-resolution-sweep` (written last job) now follow the absolute scale.** That suite's first block readies a sword through a bare-number sweep (absolute day 100, year one). Its second-year block jumps to absolute day 465. The old expectations assumed the sword was ready on day 100 *of year two*, which is the day-of-year reading this job removes. Held 365 days, it now correctly expires at day 465. So the expected counts moved: 1 → 2 expired at day 465, and 2 → 1 at day 131. Each edit carries a comment saying why. *Reversal:* revert the two lines (that would assert the old bug).
10. **Source tag: 2024 book, no feature flag** (the PM's decision, carried as given).

## Needs Zach's decision

Nothing in this job. The open items above are the PM's to place.

## Verification evidence and how to verify

- **Commit:** `10b0fa5` on `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`, pushed to GitHub. This report is in a follow-up commit.
- **Gate:** `npm test` from the repo root. Expect 271/272 files, red with exactly the five named return-loop checks above. Single suites: `npm test healers-kit` (66/66), `npm test commission-year` (25/25).
- **Live probe (optional):** `node tests/live/healers-kit-live.mjs` needs Ollama with gemma4:12b and uses a throwaway DB. It prints `PASSED: true` when Lyra stabilizes Kael with no check and one use spent. Whether the goblin hits afterwards is the model's and the dice's.

**SHA-256 of every changed file (at `10b0fa5`):**

| File | SHA-256 |
|---|---|
| client/package.json | e4d8ee3c7c7556618db5ca8d51458b55d0672b2f9381016c1c7723b9d577370d |
| docs/pm/healers-kit-stabilize/BRIEF.md | 65c3262d86979c729dee9e29e5cef4e94b716b44611f32ab564c56bd9bb047be |
| package.json | a333355dc06c96d448cfee5b36d630a2057e303b705f0a5acccb8f7b978dfe13 |
| server/migrations/119_stable_recovery.js | 2e31f95920b1452fdd2ab40ec8fc25277676f93de9c0ac67b558f872cd876cd8 |
| server/migrations/120_commission_absolute_day.js | 7d5b2ed54592ba364f67b17b826a8b0ded63ae1d5f6d5b15a53a3211ccf7685e |
| server/routes/companion.js | c155701fde3c03746b3306e9a228b142e5129be2ea3fd6a7da81e5923023c08b |
| server/routes/dmSession.js | a779bfab3387b88cb09ffba3f2c4356020d5141c0f25daf393bf5d60a94c80e0 |
| server/services/characterHpService.js | 0b16baaab85b5d24a494ad552b34fbf4fff7ae6e964ba29ac98824a12d9cc980 |
| server/services/combatLoopService.js | d5a1ead2bca60ca662e90f3ed7c6e5447ad6288410983babadadc1b10489f130 |
| server/services/deferredResolutionSweep.js | 8a0fef3bc528d15f09206eced4513409f92131b6a53b67d580e10df8e54649d4 |
| server/services/dmPromptBuilder.js | 712ff14e8e1701d5fbfcc6f68e1450a7840631ab959bd0a7702660a6ac1360c6 |
| server/services/healersKitService.js | 888bb4fd3adc0e014547fb40282842f45315f1ce60be0a77e0bbfeb894e3878d |
| server/services/livingWorldService.js | f7c7a5a7a78513de72b957e14c1b215adf251fd69062f4c4d726452b2c0825ee |
| server/services/markerSchemas.js | fa6d55205f07bf68351466f6e9fe4260c0cd54ceacc62913dd33e9a681136fb7 |
| server/services/merchantOrderService.js | d1f62d298aa0d3047afba2217b440d8c0c00e9600a56a448f4b6160310a9b7fd |
| server/services/playerRollService.js | 534d740ec6ac049b52bd9fbc6b0d91748c484c8f43740189ec4d68c18202dcba |
| server/services/restTimeService.js | 343ac7b806adfe22914c7a73367d9cf654b4dbcf0f1248f7bf3d4ab00993bbc8 |
| tests/commission-year-crossing.test.js | cc1c9fd3f28f33a6a9e8d2eeea2e13483cd2e27eb5e8042176d662ea8bcff5d1 |
| tests/deferred-resolution-sweep.test.js | 224d9b5d44a7f56f0951b3e8f368166c05797c23961db6f17a318e140693b458 |
| tests/healers-kit-stabilize.test.js | 4fa7352d3cdc383961141c68a0da79ec1cd49e3850e794c9201e2a3c0173dd35 |
| tests/live/healers-kit-live.mjs | 9afa6d5c45739970606101686b88f78c71ec90061191222df5d85ffcf2fccd8b |
| tests/marker-strip.test.js | 48ea2cceb17f4e8549040781b44fea54e2933f37558430e05ba22ff096850b68 |

**Exact checks for Zach's one final test (:5173), for when everything is done:**
1. **Kit on the downed player (fight).** Use a party with a Healer's Kit in the inventory and one companion, in a fight. Get the player character to 0 HP. Send the death-save d20. On the companion's turn the DM should have them use the kit.
   - Look for "⚙ <companion> uses a Healer's Kit on <you>: stabilized, no check (kit: 9 uses left)."
   - No further death-save asks.
   - "🎲 You're stable. Roll a d4…"
2. **The d4.** Send a number 1–4 and look for "⚙ Recovery die N: you regain 1 HP after N hours". Then pass that much time (a rest, or travel the DM advances): you wake at 1 HP. A number outside 1–4 is refused and the ask stays.
3. **Kit on a downed companion.** Ask in words to use the kit on a companion at 0 HP. Look for the ⚙ line with the hours, and the companion sheet showing them still at 0 HP.
4. **Refusals.** Ask to use the kit on a companion who is up, or with no kit in the inventory. Look for "⚙ Healer's Kit not used: …" and the kit count unchanged.
5. **Uses.** After uses, check the DM's ⚙ line count goes 10 → 9 → 8. The inventory panel doesn't show uses (Not done 4).
6. **Medicine path unchanged.** The companion sheet's Stabilize button on a downed companion still works as before.
7. **Commissions.** Placement is switched off, so there is nothing to see in play. Covered by the suite.
