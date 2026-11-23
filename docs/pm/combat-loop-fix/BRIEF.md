# Brief — combat-loop fix: make fights run turn-based in live play

## Goal (in play)
Fights run as turn-based fights in live play: initiative is rolled and shown, turns pass from one combatant to the next without anyone prompting, the player is told exactly what to roll and rolls it themselves, enemies act on their own turns, and the tracker follows the turn. The diagnosis (report commit `3da03a9`) found the breaks; this job fixes them.

## Background
- The diagnosis, 2026-11-23: the break is mostly ONE chain. Nothing advances the turn in play — the only drivers are the DM writing `[TURN_ADVANCE]` or the player pressing Next Turn, and the model never wrote it in 14 probe turns. So the order stays on the first combatant forever, the engine refuses the player's attacks as "out of turn", and the refusal never reaches the DM, so the DM narrates the fight freehand. In both probe runs, not one hit landed on a thug in the engine while the narration described them mangled and collapsing.
- The breaks, from the diagnosis (its break table is the evidence; verify each against live bytes before trusting it):
  - **B1 (missing + weak):** nothing advances the turn in play. Turn order stuck on index 0 after 7 turns in both runs.
  - **B2 (missing feedback):** a stuck order blocks the player's attacks silently — the "Out of turn" refusal never reaches the DM, so the DM judges the swing itself in prose.
  - **B3 (missing feedback + display):** enemy attack results never reach the DM or the player, and the DM narrates before the engine rolls — so the DM writes its own `HP_CHANGE` for the same blow and the damage counts twice (run 2 turn 2: two `ENEMY_ATTACK`s took the player 28 → 11, then the DM's `HP_CHANGE`s took 11 → 6).
  - **B4 (weak + missing fallback):** name matching is exact — `ATTACK` / `ENEMY_ATTACK` (and `COLD_WET`) accept the player only as "Player" or the exact full name. The model writes partial names ("TEST_COMBAT" for "TEST_COMBAT Brawler") and the marker is refused or ignored, silently.
  - **B5 (missing + design conflict):** two contradictory damage instructions — the engine path rolls damage itself and never asks the player, while the dice directive tells the DM to ask the player. The DM then invents the dice ("1d10+3"), and a reply like "14" has nowhere to go (no pending attack), so it isn't applied.
  - **B6 (display):** the tracker doesn't follow turns the DM advances — `TURN_ADVANCE` moves the server's order, but the response carries only `combatStart`, so the tracker would stay on the first combatant even if the DM did advance.
  - **F1:** `reconcileTurn` crashes EVERY turn since 2026-10-19 (`characterId is not defined` in that scope; fix: pass `session.character_id`). Its job — applying damage the narration describes but no marker carries — has never run in live play.
  - **F2:** the DM can damage the player with the player's own blow — the DM put the player's longsword damage on an enemy as `[HP_CHANGE: delta=-14]`, and `HP_CHANGE` only ever changes the player's HP, so the player went 6 → 0 and began dying. The prompt says "do NOT emit it for damage the player deals" (`dmPromptBuilder.js:2125`), but the model did it anyway and the engine has no guard.
  - **F3:** same-name enemies can't be told apart — both thugs named "Thug", every marker finds an enemy by name. (The thug HP numbers — one got the bestiary's 32 HP instead of the DM's 10 — are balance/data, OUT of scope here.)
- Zach's answers to the diagnosis's two questions (2026-11-23, recorded in the diagnosis report, in his words):
  - **Q1 — who rolls weapon damage?** "The engine should never roll for the player. Tell me what to roll, and I'll find the correct die and roll what I need to. When it comes to benefits or drawbacks from advantage or disadvantage or anything like that, the engine will calculate that after the roll. Maybe in a side chat that just shows the math?" — **Scope CONFIRMED 2026-11-23: ALL player rolls** — attack, damage, saves, checks. Not just weapon damage.
  - **Q2 — how should enemy turns be run?** "The DM should control each and every NPC. That's what keeps things fresh and interesting." — one extra DM call per enemy/NPC turn, the DM chooses the action; the ~2–4 s cost per enemy per round is accepted.
- Standing facts: the DM model is gemma4:12b, offline on the PC. The fix must be systemic — a model behavior is not the diagnosis and is not the fix; the system gap behind it is. Nothing mechanical is narrative-only (Zach, 2026-11-08).

## What to build
1. **P1 — an engine-driven turn loop (fixes B1, and with it B2's cause).** Make the route, not the model, advance turns.
   - **The player's turn:** after the engine resolves the player's attack, the route advances the turn itself.
   - **Enemy turns:** while the current combatant is an enemy (or an NPC combatant), the route runs that combatant's turn without waiting for the player: it makes one extra DM call for that combatant, where the DM chooses the action (attack, flee, talk, anything — Q2), the engine resolves the marker, and the turn advances.
   - **Then** it advances to the next combatant, and stops when it is the player's turn again.
   - **Where:** `server/routes/dmSession.js` (after marker dispatch), `combatTurnService.js`, `enemyCombatService.js`.
   - **Fixed looks like:** in the tavern fight the order shows on the tracker; if a thug is first it attacks before the player's first action; after the player's attack resolves, both thugs act and the turn comes back to the player, every round, with no player prompting. The turn state shows the round number climbing.
2. **P2 — same-turn result feedback (fixes B2, B3; supports B5).** Resolve `ATTACK` and `ENEMY_ATTACK` so their results (hit or miss, damage, refusals with the reason) reach the DM *before* it narrates the outcome. Either they resolve first and the DM narrates after, or the DM is given the result to narrate in the same exchange. At minimum, forward every refusal note to the DM, as is already done for `SET_COVER`. This absorbs the combat part of the H1 "marker results never reach the DM" follow-up — the general feedback route for non-combat markers (room/scene results, scene ids, room keys) stays a separate job and is NOT this one.
   - **Fixed looks like:** an enemy's hit is narrated with the engine's real damage; the player's HP drops once, not twice; an out-of-turn attack is explained, not narrated as a hit.
3. **P3 — tolerant name matching for the player (fixes B4).** Accept the player's first name, or any unique part of the full name, wherever "Player" is accepted. One shared matcher (`ATTACK`, `ENEMY_ATTACK`, `COLD_WET`, the conditions, …) instead of the copies.
   - **Fixed looks like:** `Attacker="TEST_COMBAT"` and `Target="Kell"` resolve to the player, in tests and live.
4. **P4 — one player-roll flow, owned by the engine (fixes B5).** Remove the contradiction between the dice directive and the engine path, under Zach's ruling: the engine NEVER rolls for the player.
   - After a hit, the engine tells the player the exact dice to roll, taken from the weapon profile (e.g. "Roll 1d10 for damage"), waits for the number, then applies the modifiers, advantage or disadvantage, crits and feature bonuses itself, after the roll.
   - The engine's own damage roll for the player (`partyAttackService.js:1719-1728`) goes; the player's dice are the only source.
   - **Survey first:** find EVERY place the engine rolls for the player — attack rolls, damage rolls, saving throws, ability/skill checks, death saves, and anything else where the engine produces a number the player should have rolled — and apply the same rule to each: tell the player what to roll, wait for the number, calculate after. Enemy/NPC rolls stay engine-side (they are not the player's rolls; the DM chooses the action, the engine resolves it).
   - **Fixed looks like:** after a hit the player is asked for the engine's own dice, the thug's HP drops by that amount; no player roll is ever made by the engine, in tests and live.
5. **P5 — the tracker follows the turn (fixes B6).** Return the current turn and round on every combat response, and have the client update the tracker from it.
   - **Fixed looks like:** the tracker's highlight moves as turns pass, without pressing Next Turn.
6. **P6 — guards and bugs found along the way (F1–F3).**
   - Pass `session.character_id` to `reconcileTurn` (F1, one line).
   - Refuse or redirect an `HP_CHANGE` whose reason names the player as the attacker (F2; the exact guard is this job's decision — report it).
   - Give same-name enemies distinct names at `COMBAT_START` ("Thug 1", "Thug 2") (F3).
7. **Math display (Zach's suggestion, in his words: "Maybe in a side chat that just shows the math?").** Build a display in the session view showing the engine's arithmetic for each resolved roll: die + modifiers = total vs AC or DC. Form to be designed in this job — a side panel next to the chat is the default shape; report the chosen form in the report. Display only; it changes no roll.
- **Order:** P1 and P2 together unblock the loop; build them first. P3 is small and stops silent failures immediately. P4 needs the survey before the change. P5 is display only. P6 rides with any of them. The math display (item 7) rides with P4.

## Out of scope
- Balance or numbers (thug HP 32 vs 10, damage values, ACs) — this is about the loop running, not the numbers in it.
- The general marker-result feedback route for non-combat markers (room/scene results, scene ids, room keys, EVOLVE_PLACE, the Scene=/Room= forms) — separate job; P2 covers combat marker results only.
- The "leave the cold" marker — separate job (candidate to fold into the general feedback-route brief).
- The feat twelve, the system-notes reload fix, or any other queued job.

## Acceptance criteria
- Each P item has tests pinning its "fixed looks like", and the full suite stays green.
- Live probe (real server + real gemma4:12b, tavern fight, several full rounds): the turn order shows on the tracker and the round number climbs; a thug acting first attacks before the player's first action; after the player's attack resolves, both thugs act and the turn comes back to the player with no prompting; the player's HP drops once per enemy hit, never twice; a partial player name resolves; after a hit the player is asked for the engine's own damage dice and the thug's HP drops by the rolled amount; the tracker's highlight moves without pressing Next Turn; the reconcileTurn crash is gone from the server log.
- The P4 survey lists every engine-rolls-for-the-player site found, and each is converted or explicitly reported as out of scope with a reason.
- No player roll is made by the engine anywhere in the converted paths, in tests and live.
- The math display shows the arithmetic for a resolved roll and is reported with its chosen form.

## Verification
- Run the full `npm test` yourself from the repo root on the PC and iterate until green. Zach's full run is the gate — never claim it. Expect ~251 files (250 after the diagnosis, plus the new test file(s)).
- Note the known runner flag: spellbook-routes takes ~158s against the runner's 120s per-file cap — a timeout artifact, not a failure, if it trips.
- The report itself is the verification: it must let a reader reproduce each finding from the cited evidence.

## Decisions already made
- The fix must be systemic — a model behavior is not the fix (PM decision, vetoable; the leak-test lesson).
- Q1 settled by Zach 2026-11-23: the engine never rolls for the player; option (ii) — tell the player the exact dice, wait, calculate after. Scope confirmed the same day: ALL player rolls.
- Q2 settled by Zach 2026-11-23: the DM controls every NPC; option (ii) — one extra DM call per enemy/NPC turn, DM chooses the action; the ~2–4 s cost per enemy per round is accepted.
- P2 absorbs the combat part of the H1 marker-feedback follow-up; the general feedback route stays a separate job (PM decision, vetoable).
- The math display is Zach's suggested display item; its exact form is designed in this job (PM decision, vetoable).
- The F2 guard's exact form is this job's decision, reported in the report (PM decision, vetoable).
- Fix-as-you-find-it (Zach, 2026-11-06): a sibling defect found live gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask before building. Never invent data — a gap is stated as a gap.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts for the seven items above.
- The P4 survey (every engine-rolls-for-the-player site, converted or reported out of scope with a reason), the live probe log (turn by turn, what the DM said, markers emitted, engine state, what the player would see), and the "fixed looks like" evidence per item.
- Any question for Zach in full plain terms, one per item, with what was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never :3000).

## How to verify
**Gate:** `npm test` on the PC (expect ~251 files green).

**At `:5173` (never `:3000`), with `npm run dev`:**
1. Use a campaign character. Start a session in a town.
2. Type "I'm drinking in the tavern common room when two thugs draw knives and attack me. I fight."
   - **Look for:** the combat tracker shows the initiative order and highlights the current combatant. If a thug is first, it attacks before your first action.
3. Type "I attack the nearest thug with my longsword", then send only a number (e.g. "15") when asked for the attack roll.
   - **Look for:** after a hit, the DM tells you the exact damage dice for your weapon — and the thug's HP falls by what you rolled. The tracker moves on without you pressing Next Turn.
4. Type "I step back and wait."
   - **Look for:** the thugs act on their own turns, and the turn comes back to you.
5. **Look for:** the math display — the engine's arithmetic for a resolved roll (die + modifiers = total vs AC or DC) — next to the chat.

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test` + :5173 checks on the PC.
- Place this brief at `docs/pm/combat-loop-fix/BRIEF.md` in the repo when handing it over. Reports live in `docs/pm/reports/`.
