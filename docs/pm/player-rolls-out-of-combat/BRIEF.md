# Brief — player rolls out of combat: hit dice, cold saves, crafting, and the hidden Perception die

## Goal (in play)
Every player roll outside combat is the player's roll — the engine tells the player what to roll, waits for the number, and calculates after. This completes Zach's ruling (2026-11-23): "ALWAYS — as a rule, the DM never rolls for the player. Except the hidden perception die."

## Background
- The combat-loop fix (report commit `45c34b4`, v1.0.205) converted every in-combat player roll: initiative, attack d20, damage dice, death saves, concentration saves, Second Wind. Its P4 survey found the out-of-combat sites and left them as Question 2. Zach answered: convert them all.
- The sites, from the fix report's survey table (verify each against live bytes before trusting it):
  - `restTimeService.js:156` — hit dice on a short rest.
  - `coldExposureService.js:451` — hourly cold-exposure CON saves (PC and party).
  - `craftingService.js:416` — crafting check.
  - `perceptionPreRollService.js:354` — the silent replacement Perception die for the PC.
- The hidden Perception die: today the engine rolls the replacement die silently. Zach's ruling: the player rolls it to establish the number, but when it gets rolled is hidden — the player rolls it up front, the engine banks the number, and when it is used stays hidden.
- Design point from the fix report: the cold saves can be many per stretch of travel, so they need a batch prompt (one roll per hour, or one roll for the stretch).
- Standing facts: the DM model is gemma4:12b, offline on the PC. The fix must be systemic — a model behavior is not the diagnosis and is not the fix; the system gap behind it is. Nothing mechanical is narrative-only (Zach, 2026-11-08).

## What to build
1. **Short-rest hit dice.** The engine no longer rolls the player's Hit Dice. When the player takes a short rest, the engine asks how many Hit Dice the player wants to spend, then asks for each roll (the die for the player's class), waits for the numbers, and applies each die + CON modifier itself, after the roll. Companions' Hit Dice stay engine-side (they are not the player's rolls).
   - **Fixed looks like:** on a short rest the player is asked for their Hit Dice one at a time (or all at once in one message), sends the numbers, and the HP gained is the rolled dice + CON per die.
2. **Cold-exposure saves, batched.** The engine no longer rolls the player's hourly cold saves. For a stretch of travel in the cold, the engine presents ONE batch prompt: one CON save per hour of the stretch, and the player sends all the numbers in one message; the engine applies them in order, adding the CON modifier itself. The prompt states the span ("4 hours in the cold — roll 4 CON saves, one per hour") and the engine adds the modifier after. Companion/party cold saves stay engine-side.
   - **Fixed looks like:** marching four hours in the cold asks for four numbers at once, and each hour's save is resolved from the player's number.
3. **Crafting checks.** The engine no longer rolls the player's crafting check. It tells the player what to roll (the check's die and what the engine adds after), waits for the number, and resolves the craft from it.
   - **Fixed looks like:** starting a craft asks the player for the check roll, and the outcome follows the player's number.
4. **The hidden Perception die, player-rolled and banked.** Survey the current bank/replacement flow first (R-01, the perception pre-roll system): the player rolls one Perception per character at the dungeon door, the DM reads stored numbers in secret, a used number is replaced with a fresh roll, the player sees their own banked number but never when the DM reads it. Convert the engine-rolled parts to player-rolled, keeping the secrecy: the player rolls the replacement die up front (at the dungeon door, when the bank is established), the engine banks the number, and when it is used stays hidden — the DM reads the stored number in secret and the player is never told it was read.
   - **Fixed looks like:** the player rolls their Perception number at the door; the engine never rolls a replacement die; the DM's secret reads use the banked number and the player sees nothing about when it was used.
5. **Survey the rest.** Confirm there are no other out-of-combat engine-rolls-for-the-player sites beyond the four above — search the same way the fix did (`rollD20(`, `roll(N, …)`, the dice helpers), then read each caller to see whose roll it is. Convert any found (fix-as-you-find-it) or report it out of scope with a reason.

## Out of scope
- Bend Luck 1d4 (`subclassMarkerService.js:410`) — a reaction on someone else's roll; it needs a mid-resolution player prompt that doesn't exist yet. Separate job.
- Wild Magic surge table dice (`wildMagicService.js`) — the surge is the table's roll, not a check the player makes. A question for Zach at the gate, not decided here.
- The Absorb Elements rider 1d6 (`partyAttackService.js:1323`) — needs a second damage ask (its damage type differs from the weapon's). Candidate follow-up.
- The feat twelve, the combat-resolution job, or any other queued job.

## Acceptance criteria
- Each item has tests pinning its "fixed looks like", and the full suite stays green.
- Live probe (real server + real gemma4:12b): a short rest where the player rolls their Hit Dice; a cold march of several hours with one batch prompt; a crafting check; a dungeon-door Perception bank, a secret read, and a replacement roll. In each, the engine rolls no die for the player — the probe log shows the ask, the player's number, and the engine's math after.
- The survey (item 5) lists every site checked and any further site found, converted or reported out of scope with a reason.
- The hidden Perception die stays secret in timing: the probe shows the banked number used without the player being told when.

## Verification
- Run the full `npm test` yourself from the repo root on the PC and iterate until green. Zach's full run is the gate — never claim it. Expect ~252 files (251 after the combat-loop fix, plus the new test file(s)).
- Note the known runner flag: spellbook-routes takes ~158s against the runner's 120s per-file cap — a timeout artifact, not a failure, if it trips.
- The report itself is the verification: it must let a reader reproduce each finding from the cited evidence.

## Decisions already made
- Zach's ruling (2026-11-23): ALWAYS — the DM never rolls for the player, out of combat too. The hidden Perception die is the one exception, and only in timing: the player rolls it up front and the engine banks it.
- Cold saves use ONE batch prompt — one roll per hour, all numbers in one message (PM decision, vetoable; from the fix report's design point).
- Companion/party rolls stay engine-side — they are not the player's rolls (PM decision, vetoable).
- The fix must be systemic — a model behavior is not the fix (PM decision, vetoable; the leak-test lesson).
- Fix-as-you-find-it (Zach, 2026-11-06): a sibling defect found live gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask before building. Never invent data — a gap is stated as a gap.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts for the five items above.
- The survey (item 5) with every site checked, the live probe log (turn by turn, what the DM said, what the engine asked, the player's numbers, the engine's math after), and the "fixed looks like" evidence per item.
- Any question for Zach in full plain terms, one per item, with what was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never :3000).

## How to verify
**Gate:** `npm test` on the PC (expect ~252 files green).

**At `:5173` (never `:3000`), with `npm run dev`:**
1. Use a campaign character. Start a session in a town.
2. Take a short rest with spent Hit Dice.
   - **Look for:** the engine asks how many Hit Dice you want to spend and what to roll — it never rolls them itself.
3. March into cold country for several hours.
   - **Look for:** ONE prompt asking for one CON save per hour, all numbers in one message — not a save per message, and never an engine-rolled save.
4. Start a craft.
   - **Look for:** the engine tells you what to roll for the crafting check and waits for your number.
5. Enter a dungeon.
   - **Look for:** you roll your Perception number at the door. The DM never tells you when it reads it.

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test` + :5173 checks on the PC.
- Place this brief at `docs/pm/player-rolls-out-of-combat/BRIEF.md` in the repo when handing it over. Reports live in `docs/pm/reports/`.
