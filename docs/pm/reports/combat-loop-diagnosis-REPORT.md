# Report — combat-loop diagnosis: why fights don't run turn-based in live play

Builder: Claude Code (Opus 5.5). Brief: `docs/pm/combat-loop-diagnosis/BRIEF.md`.
Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version unchanged (**1.0.204**): this job changes no product code.
Commit: `3da03a9` (the diagnosis); a follow-up commit adds this line.

## Understanding
The project is a solo D&D 2024 "forever game": one human player character, with the DM, NPCs, companions and enemies played by an AI (gemma4:12b on the PC). In a fight the engine is meant to own the mechanics: who acts when, whether attacks hit, how much damage lands, HP. The AI narrates and drives the engine with markers.

Zach saw a tavern fight play out as free narration: no visible turns, never asked for damage, and enemies that acted only when he did. This job finds where that loop breaks, with evidence, and proposes fixes for a later job. It changes nothing.

**Where my findings differ from the brief's framing:**
1. **The break is not three separate problems. It is mostly one chain.**
   - Nothing in the system ever moves the turn on in normal play.
   - The turn order therefore stays on its first combatant forever.
   - The engine then refuses the player's attacks as "out of turn".
   - That refusal never reaches the DM, so the DM narrates the fight freehand.

   Zach's three symptoms are all downstream of that chain plus one feedback gap (below).
2. **Symptom (b) reproduced differently than described.** In my runs the DM *did* tell the player what to roll for damage ("Roll 1d10+3"), but it made the dice up, and the number the player sent was never applied to the thug. In the path the engine designed, the player is never asked for damage at all: the engine rolls it itself. Zach's "never told what to roll" matches that design path. Which way damage should work is a question for Zach (Q1).
3. **Further findings outside the three symptoms**, reported, not chased:
   - the turn route's narration check (`reconcileTurn`) has crashed on every turn since 2026-10-19;
   - enemies' hits get counted twice;
   - the DM once damaged the **player** with the player's own sword blow;
   - two enemies with the same name can't be told apart.

## Verdict
**BUILT + GREEN** (a diagnosis: report and probe evidence; no product code changed). Builder's full `npm test`: Files 250/250 green, assertions 19,651 passed, 0 failed. Not a gate: Zach's run gates.

## Per-item verdicts
| Item | Verdict | Evidence |
|---|---|---|
| 1. Survey the intended loop | **Done** | Link-by-link trace below. The H1 starting points are confirmed; two line numbers had drifted by 2 (corrected). |
| 2. Reproduce live | **Done**: (a) and (c) reproduced; (b) reproduced in a different form | Two runs of the tavern fight on the real server with gemma4:12b, 7 turns each, logged turn by turn (below). |
| 3. Name the breaks | **Done** | Break table: 6 breaks plus 3 further findings, each with code and probe evidence and a kind (missing / weak / display). |
| 4. Propose fixes | **Done** | Ranked proposals with acceptance tests, and two questions for Zach. |

## Item 1 — the intended loop (from the code)
1. **The fight starts.**
   - The DM writes `[COMBAT_START: Enemies="Thug (HP 12, AC 13, ATK +4, DMG 1d6+2), …"]` as the *last* sentence of its reply (prompt `dmPromptBuilder.js:2206`; schema position `last`).
   - The handler (`combatMarkerService.js:51`) creates the enemies and **rolls initiative for everyone in the engine** (`:66-200`).
   - It stores the order server-side (`initializeTurnOrder`, `:211`) and writes a note for the DM: "Initiative has been rolled. Turn order: … Emit [TURN_ADVANCE] when a combatant's turn ends" (`:206`).
   - The route returns `combatStart {turnOrder, currentTurn, round}` (`dmSession.js:2279-2286`), and the client shows the **combat tracker** with the order (`DMSession.jsx:810` → `<CombatTracker>` `:2921`).
   - *H1 said `DMSession.jsx:808, 888`; they are now `:810, :880-890` (the strip fix shifted them by 2). Confirmed.*
2. **Every turn the DM is told whose turn it is.**
   - Each player message rebuilds a turn block into the DM prompt (`dmSession.js:1752`): "[COMBAT TURN STATE — … It is Thug's turn. Turn order: ▶ Thug, Kell, Thug. Only the current combatant acts on their turn; emit [TURN_ADVANCE] when their turn ends.]" (`turnLedgerService.js:391`).
3. **Turns advance only when someone says so.** Two ways:
   - **(a)** the DM writes `[TURN_ADVANCE]` (`combatMarkerService.js:1421` → `combatTurnService.advanceTurn`, `:27`). The route passes the "It is now X's turn" note on for the DM's next call (`dmSession.js:2288`), but **does not send the new current turn to the client**: `combatStart` is the only combat payload.
   - **(b)** the player presses **Next Turn** on the tracker (`DMSession.jsx:880` → `POST /:sessionId/advance-turn`, `dmSession.js:3052`). That moves the server's order and the tracker, but makes **no DM call**.
   - Nothing else advances a turn: there is no route step, no timer, and no automatic follow-up (searched `dmSession.js`, `DMSession.jsx`, `combatTurnService.js`).
4. **The player attacks.**
   - The DM writes `[ATTACK: Attacker="Player" Target="Goblin"]`, asks for the attack roll, then stops (`dmPromptBuilder.js:2211`).
   - The handler (`partyAttackService.js:1979`) accepts the attacker as the player only if it is "Player"/"PC"/"Character" or the **exact full character name** (`:2012`).
   - It checks the **turn order**: an attack when it isn't the player's turn is refused, "Out of turn: it is Thug's turn …" (`turnLedgerService.js:150/301`, via `checkTurnIdentity` `:133`).
   - If allowed, it stores a **pending attack** with the weapon, attack bonus and damage dice (`createPcPendingAttack`, `partyAttackService.js:1528`).
5. **The player's dice come back.**
   - On the next message the route resolves the pending attack (`dmSession.js:1439-1462`) from the client's attack-roll box, or from a message that is *only* a number ("15" or "15 and 12"). A sentence like "I rolled a 14" is not read.
   - `resolveReportedAttack` (`partyAttackService.js:1683`) judges the hit against AC.
   - **Damage:** it uses the player's number only if the damage box was filled in *the same message*. Otherwise **the engine rolls the damage itself** (`:1719-1728`). The player is never asked for damage in this path.
   - It then applies the damage and stores an ATTACK RESULT for the DM, injected next turn (`dmSession.js:1688`; text at `partyAttackService.js:1899`): "narrate exactly these outcomes".
6. **A second, conflicting damage instruction.**
   - When the attack-roll box is used, the route also appends a dice directive to the player's message: "The player has not supplied a damage roll — if the attack hits, **ask them for it** rather than rolling it yourself" (`dmPromptBuilder.js:2968-2983`).
   - Step 5 tells the DM to narrate the engine's damage. This one tells it to ask the player for damage. *H1's "no line tells the DM to ask for weapon damage" needs correcting: this line does, but it contradicts the engine path.*
7. **Enemies attack.**
   - The DM writes `[ENEMY_ATTACK: Enemy="Thug" Target="Player"]` "INLINE" and "narrates the result it returns" (`dmPromptBuilder.js:2218`).
   - The handler (`combatMarkerService.js:334`) finds the target with `resolvePartyTarget` (`:307-311`), which also accepts only "Player" or the exact full name.
   - The engine rolls the attack and damage and applies them (`enemyCombatService.js:134`).
   - **The result (hit or miss, damage) is never sent to the DM or the player.** It isn't on the route's forwarding list (`dmSession.js:2279-2292`), and no next-turn block carries it. Yet the DM writes its narration *before* the marker is resolved, in the same reply.
   - What makes an enemy act on its turn: only the DM choosing to write `ENEMY_ATTACK` in a reply, and replies happen only when the player sends a message.

## Item 2 — live reproduction (real server, real gemma4:12b)
Scripts `combat-probe.mjs` and `combat-probe2.mjs` (session scratchpad) booted the real `server/index.js` against throwaway databases and played seven turns each. For every turn they logged:
- what the player sends;
- what the DM was shown that turn (turn block, attack result, dice directive);
- the markers the model emitted;
- what the player sees;
- the response's combat fields;
- the engine's turn state, enemy HP and player HP;
- the pending player attack.

Run 1 used a two-word character name ("TEST_COMBAT Brawler"); run 2 a one-word name ("Kell"), to separate name matching from the rest. Excerpts are verbatim; the narration is cut short.

**Run 1, "TEST_COMBAT Brawler" (two-word name):**
```
TURN 1 "…two thugs draw knives and attack me. I fight."
  markers: [SET_ROOM: Name="Tavern common room" …] [COMBAT_START: Enemies="Thug (HP 12, AC 13, ATK +3, DMG 1d6+2), Thug (HP 12, AC 13, ATK +3, DMG 1d6+2)"]
  response combatStart: order ["Thug(17)","TEST_COMBAT Brawler(8)","Thug(7)"], round 1, currentTurn 0
  engine turn: round 1, current Thug (index 0)
TURN 2 "I attack the nearest thug with my longsword."
  DM shown: [COMBAT TURN STATE — … Round 1. It is Thug's turn. Turn order: ▶ Thug, TEST_COMBAT Brawler, Thug. …]
  markers: [ATTACK: Attacker="TEST_COMBAT" Target="Thug"]
  player sees: "…The first thug lunges … you meet his momentum with the weight of your longsword. … Please roll a d20 for your attack."
  pending player attack: none        engine turn: round 1, current Thug (index 0)
TURN 3 {"action":"I roll my attack.","attackRoll":15}
  DM shown: dice directive "…The player has not supplied a damage roll — if the attack hits, ask them for it…"
  markers: (none)
  player sees: "Your longsword connects … the steel biting deep into the first thug's shoulder. … Please roll 1d10+3 for your damage."
  enemies: Thug 12/12, Thug 12/12   engine turn: round 1, current Thug (index 0)
TURN 4 "I attack the same thug again…"   markers: [ATTACK: Attacker="TEST_COMBAT" Target="Thug"]   pending: none
TURN 5 "I rolled a 14."   markers: (none)
  player sees: "The steel of your blade finds its mark again … Please roll 1d10+3 for your damage."
  enemies: Thug 12/12, Thug 12/12
TURN 6 "I step back, raise my guard and wait to see what the thugs do."
  markers: [ENEMY_ATTACK: Enemy="Thug" Target="TEST_COMBAT"]
  player sees: "…The first thug, his shoulder mangled …, collapses … The second thug … swings the heavy iron head toward y…"
  player HP 28/28 (the enemy attack did not land: unknown target)
TURN 7 "I hold my ground and keep my guard up."   markers: [HP_CHANGE: delta=-3 reason="thug's mace"]   player HP 25/28
  engine turn after 7 turns: round 1, current Thug (index 0)
server log, every turn: [reconciliation] failed: characterId is not defined
```

**Run 2, "Kell" (one-word name):**
```
TURN 1  markers: [COMBAT_START: Enemies="Thug (HP 12, …), Thug (HP 10, AC 12, ATK +3, DMG 1d4+1)"] [SET_ROOM: …]
  response combatStart: order ["Thug(16)","Thug(14)","Kell(7)"]      enemies: Thug 12/12, Thug 32/32
TURN 2 "I attack the nearest thug with my longsword."
  markers: [ENEMY_ATTACK: Enemy="Thug" Target="Kell"] [HP_CHANGE: delta=-3 reason="Thug's shortsword"] [ENEMY_ATTACK: Enemy="Thug" Target="Kell"] [HP_CHANGE: delta=-2 reason="Thug's knife"]
  hpChanges: previousHp 11 → 8, then 8 → 6        (the two ENEMY_ATTACKs had already taken 28 → 11)
  player sees: "The barrel-chested thug lunges first … clanging against your shoulder … The leaner thug … The serrated edge bites into your side … What do you do?"
TURN 3 {"action":"I roll my attack.","attackRoll":15}
  markers: [ATTACK: Attacker="Kell" Target="Thug"]
  player sees: "…The blade finds its mark, biting deep into the man's tunic … Roll 1d10+3 for the damage."
  pending player attack: none        enemies: Thug 12/12, Thug 32/32
TURN 4 "I attack the same thug again…"   markers: [ATTACK: Attacker="Kell" Target="Thug"]   pending: none
  player sees: "…The steel meets his chest with a sickening thud … Roll 1d10+3 for the damage."
TURN 5 "14"   markers: [HP_CHANGE: delta=-14 reason="Kell's longsword strike"]
  player sees: "The longsword bites deep … He collapses … slumps to the floor…"
  hpChanges: player 6 → 0, droppedToZero true; deathSave rolled (failure)      enemies still: Thug 12/12, Thug 32/32
TURN 6 "I step back … wait to see what the thugs do."   markers: [ENEMY_ATTACK: Enemy="Thug" Target="Kell"]   deathSave: failure (2)
TURN 7 "I hold my ground…"   markers: [ENEMY_ATTACK: Enemy="Thug" Target="Kell"] [HP_CHANGE: delta=-4 …]
  engine turn after 7 turns: round 1, current Thug (index 0)
```

**Why the matched `ATTACK` still left no pending attack.** The real `ATTACK` handler was replayed through the marker pipeline against a copy of run 2's database (`attack-why.mjs`). Verbatim:
```
turn state: current index 0 of [Thug(16), Thug(14), Kell(7)]
ATTACK while it is the Thug's turn -> {"type":"party_attack","success":false,"reason":"Out of turn: it is Thug's turn (round 1), not this combatant's. Wait for Thug's turn, advance the turn order (Next Turn) until it is this combatant's turn, or start a new combat if this combatant is not in the order."}
ATTACK on Kell's own turn -> {"success":true,"pending":true,"weapon":"Longsword","attackBonus":5,"damageDice":"1d10"}
ATTACK with a partial name -> "unknown attacker: TEST_COMBAT"
```

**The three symptoms, as reproduced:**
- **(a) Initiative not working; combat purely narrative: reproduced.**
  - Initiative *is* rolled, and the order *is* sent to the client's tracker (run 1: Thug 17, Brawler 8, Thug 7).
  - But the turn never moved off its first combatant in 14 turns across both runs: the model never emitted `TURN_ADVANCE`.
  - So every player attack was refused as out of turn, or as an unknown attacker.
  - Not one hit landed on a thug in the engine: they stayed 12/12 and 32/32, while the narration described them mangled and collapsing.
- **(b) Never told what to roll for damage: reproduced in a different form.**
  - The DM did say "Roll 1d10+3 for the damage", but those dice came from the model, not the engine (the engine's longsword profile is 1d10, +5 to hit).
  - The number the player sent was never applied to any enemy.
  - In the engine's own path the player is never asked for damage (step 5).
- **(c) Thugs act only when the player acts: reproduced.**
  - Enemies acted only inside replies to the player's messages (run 1 turn 6; run 2 turns 2, 6, 7).
  - Nothing makes an enemy act on its own turn.
  - In run 2 turn 2 the thugs did attack, but in the same reply as the player's own attack request, with no turn order behind it.

## Item 3 — the breaks
Kind: **missing** = nothing in the system does it; **weak** = something does it but the model doesn't follow it; **display** = the engine knows, but the player or DM can't see it.

| # | Symptom | Broken link | Evidence | Kind |
|---|---|---|---|---|
| B1 | a, c (and the cause of b) | **Nothing advances the turn in play.** The only drivers are the DM writing `[TURN_ADVANCE]` or the player pressing Next Turn. The model never wrote it in 14 turns, despite the turn block every turn. Nothing else runs a turn: no route step after a combatant acts, no enemy-turn call. | Trace steps 2-3; both runs end on "round 1, current Thug (index 0)". | **missing**, with a **weak** link on top (the prompt instruction is there and ignored) |
| B2 | a, b | **A stuck order blocks the player's attacks, silently.** On an enemy's turn the engine refuses the player's `ATTACK` ("Out of turn …"), and the refusal never reaches the DM. The DM then judges the swing itself in prose. | Replay above; route forwarding list `dmSession.js:2279-2292` (no `ATTACK`); runs: "pending player attack: none" on every attack. | **missing** (no feedback), caused by B1 |
| B3 | c (and wrong HP) | **Enemy attack results never reach the DM or the player,** and the DM narrates before the engine rolls. The DM can't narrate the real hit or miss, so it writes its own `HP_CHANGE` for the same blow: the damage counts twice. | Trace step 7; run 2 turn 2: two ENEMY_ATTACKs took 28 → 11, then the DM's HP_CHANGEs took 11 → 6. | **missing** (feedback) + **display** |
| B4 | a, b | **Name matching is exact.** `ATTACK`, `ENEMY_ATTACK` (and `COLD_WET`, seen in H1) accept the player only as "Player" or the exact full name. The model writes the character's name, often partly: "TEST_COMBAT" for "TEST_COMBAT Brawler". The marker is then refused or ignored, silently. | `partyAttackService.js:2012`, `combatMarkerService.js:311`; replay: "unknown attacker: TEST_COMBAT"; run 1 turn 6: the enemy attack didn't land. | **weak** (the prompt example says "Player"; the model uses names) + **missing** (no fallback) |
| B5 | b | **Two contradictory damage instructions, and no engine-owned damage prompt.** The engine path rolls damage itself and never asks the player. The dice directive tells the DM to ask the player. The DM then invents the dice ("1d10+3"), and a reply like "14" has nowhere to go (no pending attack), so it isn't applied. | Trace steps 5-6; run 1 turns 3/5 and run 2 turns 3-5: "Roll 1d10+3", enemies unchanged. | **missing** (no engine "now roll X for damage" step) + design conflict (Q1) |
| B6 | a | **The tracker doesn't follow turns the DM advances.** `TURN_ADVANCE` moves the server's order, but the response carries only `combatStart`, so the tracker would stay on the first combatant even if the DM did advance. Only the Next Turn button moves it. | Trace step 3; `dmSession.js:2279-2292` returns no current turn. | **display** |

**Further findings (outside the three symptoms; diagnosed, not chased):**
- **F1 — the narration check crashes every turn.** `reconcileTurn(cleanNarrative, …, { characterId, sessionId })` (`dmSession.js:2210`) uses a `characterId` that doesn't exist in that scope. Every turn logs "[reconciliation] failed: characterId is not defined". It has been there since commit `16b4710` (2026-10-19). Its job, applying damage that narration describes but no marker carries, has never run in live play. The tests never caught it because the error is caught and only logged. Fix: pass `session.character_id`. One line, but not applied here (diagnosis only).
- **F2 — the DM can damage the player with the player's own blow.** In run 2 turn 5 the DM put the player's longsword damage on an enemy as `[HP_CHANGE: delta=-14 reason="Kell's longsword strike"]`. `HP_CHANGE` only ever changes the *player's* HP, so the player went from 6 to 0 and began dying. The prompt does say "do NOT emit it for damage the player deals" (`dmPromptBuilder.js:2125`), but the model did it anyway, and the engine has no guard. This is mostly downstream of B2/B5: the DM had no working way to damage the enemy.
- **F3 — same-name enemies.** Both thugs were named "Thug" (run 2 also gave one of them the bestiary's 32 HP instead of the DM's 10). Every marker finds an enemy by name, so the second Thug can't be targeted reliably. The numbers themselves are out of scope (balance); the naming collision is a loop problem.

**Shared root cause:** B2, B3 and B5's "where did my number go" are the same gap as the H1 finding. Marker results and refusals don't come back to the DM in the same exchange, so the DM narrates blind. B1 is the other root.

## Item 4 — proposed fixes (ranked by what unblocks the loop)
1. **P1 — an engine-driven turn loop (fixes B1, and with it B2's cause; most of a and c).** Make the route, not the model, advance turns.
   - **The player's turn:** after the engine resolves the player's attack (step 5), the route advances the turn itself.
   - **Enemy turns:** while the current combatant is an enemy, the route runs that enemy's turn without waiting for the player. Either the engine rolls a default action for it (attack the player or a companion), or the route makes one extra DM call that must write exactly that enemy's `ENEMY_ATTACK` (the shape is Q2).
   - **Then** it advances to the next combatant, and stops when it is the player's turn again.
   - **Where:** `server/routes/dmSession.js` (after marker dispatch), `combatTurnService.js`, `enemyCombatService.js`.
   - **Fixed looks like:** in the tavern fight the order shows on the tracker; if a thug is first it attacks before the player's first action; after the player's attack resolves, both thugs act and the turn comes back to the player, every round, with no player prompting. The turn state shows the round number climbing.
2. **P2 — same-turn result feedback (fixes B2, B3; supports B5).**
   - Resolve `ATTACK` and `ENEMY_ATTACK` so their results (hit or miss, damage, refusals with the reason) reach the DM *before* it narrates the outcome. Either they resolve first and the DM narrates after, or the DM is given the result to narrate in the same exchange.
   - At minimum, forward every refusal note to the DM, as is already done for `SET_COVER`.
   - This is the H1 "marker results never reach the DM" follow-up, so the two should be one job.
   - **Fixed looks like:** an enemy's hit is narrated with the engine's real damage; the player's HP drops once, not twice; an out-of-turn attack is explained, not narrated as a hit.
3. **P3 — tolerant name matching for the player (fixes B4).** Accept the player's first name, or any unique part of the full name, wherever "Player" is accepted. One shared matcher (`ATTACK`, `ENEMY_ATTACK`, `COLD_WET`, the conditions, …) instead of the copies. **Fixed looks like:** `Attacker="TEST_COMBAT"` and `Target="Kell"` resolve to the player, in tests and live.
4. **P4 — one damage flow, owned by the engine (fixes B5).** Remove the contradiction between the dice directive and the engine path. Pick one of (Q1):
   - **(i)** the engine always rolls weapon damage (today's fallback), and the directive stops telling the DM to ask; or
   - **(ii)** after a hit, the engine asks the player for the exact damage dice from the weapon profile ("Roll 1d10 + 3"), waits for the number, and applies it.

   **Fixed looks like:** after a hit the player is either shown the engine's damage or asked for the engine's own dice, and the thug's HP drops by that amount.
5. **P5 — the tracker follows the turn (fixes B6).** Return the current turn and round on every combat response, and have the client update the tracker from it. **Fixed looks like:** the tracker's highlight moves as turns pass, without pressing Next Turn.
6. **P6 — guards and bugs found along the way (F1-F3).**
   - pass `session.character_id` to `reconcileTurn` (F1);
   - refuse or redirect an `HP_CHANGE` whose reason names the player as the attacker (F2; the exact guard is a fix-job decision);
   - give same-name enemies distinct names at `COMBAT_START` ("Thug 1", "Thug 2") (F3).

**Order:** P1 and P2 together unblock the loop. P3 is small and stops silent failures immediately. P4 needs Q1 answered. P5 is display only. P6 can ride with any of them.

**No new test added (decision 1):** pinning today's broken behaviour would make the fix job's correct change break a test. The probe logs and the replay are the evidence, and each "fixed looks like" above is written to become the fix job's acceptance test.

## Files changed
| File | New / edited | SHA-256 | Bytes |
|---|---|---|---|
| `docs/pm/combat-loop-diagnosis/BRIEF.md` | new | `e98a0e44f2166e2ac52ed90eb0bc4ec884f7729530a995ced9e8cc05fd3715a4` | 9082 |
| `docs/pm/reports/combat-loop-diagnosis-REPORT.md` | new (this file) | n/a | — |

No product code, test or data changed. No migration.

## What was built (in play)
Nothing changes in play. This job produced a diagnosis: what breaks in a fight, and how to fix it.

## Test results
- **Full `npm test` on the PC:** Files **250/250 green**, assertions **19,651 passed, 0 failed** (no code changed; Windows notes: `fresh-create-blank` retried once and passed, `item-3a-world-ids` and `roll-request` counted `pass*`).
- No test added (decision 1).

## Not done / still open
- **No fix applied:** that is the next job (P1-P6). That includes the one-line F1 fix, which is diagnosis-only here by the brief.
- **The `:5173` steps for Zach are below.** I didn't click through, because there is no browser tool in this session.
- **Cost and usage against the $30/month cap:** not measurable from inside the session.

## Decisions made (reversible, for veto)
1. **No pinning test**, because it would pin broken behaviour. Reversal: add the probe facts as a failing test in the fix job instead.
2. **A one-word-name second run**, to separate name matching (B4) from the turn loop (B1). Reversal: none.
3. **A replay of the real handler against a copy of the probe database**, to name the exact refusal. The original probe database is untouched.

## Needs Zach's decision
- **Q1 — who rolls weapon damage?** Today the engine rolls it itself whenever the player doesn't fill the damage box in the same message as the attack roll. Meanwhile one prompt line tells the DM to ask the player for damage, and the DM then invents the dice. The project's hybrid-combat rule says the player rolls their own attack *and* damage dice. Which should the fix build?
  - (i) the engine rolls weapon damage automatically after a hit, and shows the result; or
  - (ii) the engine tells the player the exact damage dice for their weapon (e.g. "Roll 1d10 + 3") and waits for the number.

  Checked: `partyAttackService.js:1719` (engine fallback roll), `dmPromptBuilder.js:2982-2983` (ask the player), the CLAUDE.md hybrid-combat section ("The player rolls their own attack and damage dice").
- **Q2 — how should enemy turns be run?** When it is a thug's turn, the fix can either:
  - (i) have the engine take the thug's turn itself (attack the nearest party member with its listed attack), then ask the DM only to narrate the result; or
  - (ii) make an extra DM call for that thug's turn, where the DM chooses its action (attack, flee, talk) and the engine resolves it.

  (i) is reliable and fast but less varied; (ii) keeps the DM in charge but costs one extra model call (about 2-4 s each on this PC) per enemy per round, and depends on the model writing the marker. Which should the fix build?

## How to verify
**Gate:** `npm test` on the PC (expect 250 files green). The real check for this job is the report: each finding can be reproduced from the cited code and the probe output.

**At `:5173` (never `:3000`), with `npm run dev`, to see the symptoms as described:**
1. Use a campaign character. Start a session in a town.
2. Type "I'm drinking in the tavern common room when two thugs draw knives and attack me. I fight."
   - **Look for:** a combat tracker with an initiative order appears. Note who is highlighted.
3. Type "I attack the nearest thug with my longsword", then type only a number (e.g. "15") when asked for the attack roll.
   - **Look for:** the tracker's highlight never moves. The DM describes hits, but a thug never goes down in the engine (it keeps attacking at full strength). Any damage dice the DM asks for are its own.
4. Type "I step back and wait."
   - **Look for:** a thug acts only now, in reply to you. It never acts on its own between your messages.
5. **Optional:** press **Next Turn** on the tracker until your name is highlighted, then attack and send only a number.
   - **Look for:** this time the engine resolves the swing (the DM narrates an exact hit or miss and the thug's HP falls), which shows the turn order is what blocks it.
