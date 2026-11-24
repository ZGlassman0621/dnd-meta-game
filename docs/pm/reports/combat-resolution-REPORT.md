# Report — combat resolution: a fight can't end with enemies standing unless something resolved it

## Understanding
**The game.** This is a solo D&D 2024 game. One human plays one character, and a local AI model (gemma4:12b, on the PC) runs the Dungeon Master and every other character. The engine keeps the rules and the numbers, and the DM controls every NPC (Zach, 2026-11-23).

**This job** comes from Zach's answer: "Fights need some sort of resolution. If both thugs are still standing, there has to be a reason for it — they ran off, we ended up talking things out; something must happen in order for that outcome."

1. The engine refuses the DM's `[COMBAT_END]` while any enemy still stands, and tells the DM why and what its options are.
2. Every way an enemy leaves a fight alive gets a real path: flee (wired to the existing morale flight), surrender, and talk it out.
3. A fight ends cleanly on its last resolution, with the outcome recorded so the tracker, the history and later sessions agree.

The brief matched the live code. One gap the brief doesn't cover: the **player** running away. I asked Muse about it mid-job (Questions, item 1); nothing in this build forces an answer, and the DM handled a walk-away live with a settlement.

## Verdict
BUILT + GREEN (builder's run; Zach's run is the gate).

Commit `3f5801d` on branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.207.

## Per-item verdicts
| Item | Verdict | In one line |
|---|---|---|
| 1. Refuse `COMBAT_END` while enemies stand | **Built** | Refused during a running fight while any enemy is active; the DM gets a note naming who stands and the three resolutions; the player sees "⚙ The fight isn't over — Thug 1 and Thug 2 are still standing." |
| 2. Markers for enemy resolution | **Built** | `[ENEMY_FLEE]` (the same `fled` state and write as morale flight), `[ENEMY_SURRENDER]` and `[COMBAT_SETTLE]`. The DM is taught them in the combat rules and in every enemy's turn directive. Live: a thug fled, two thugs surrendered, and two fights were talked down. |
| 3. The fight ends cleanly on a resolution | **Built** | When no enemy is left active, the engine ends the fight: the tracker clears, each enemy keeps its status, and the outcome ("Thug 1 surrendered; Thug 2 surrendered") reaches the player, the DM and the stored history. |

## Item 2 — the survey: what existed, and what was added
**What existed before this job** (line numbers from commit `7ef5d44`, before this job's edits):
- **Enemy states.** `combat_enemies.status` allowed only `'active'`, `'dead'` and `'fled'`, enforced by a CHECK constraint (`server/migrations/064_combat_enemies.js:27-28`). No `surrendered` or `settled` state existed.
- **Morale flight.** This was engine-driven, not a DM marker.
  - The engine checks it after an enemy dies (`enemyCombatService.js:357`).
  - At 50% or more enemy casualties (`moraleService.js:19`), each living enemy rolls the engine's d20 against DC 10, plus a little per casualty above half (`moraleService.js:17, 49`). A failure set `status = 'fled'` directly (`moraleService.js:51`).
  - The DM could not make an enemy run off: there was no flee marker.
  - Morale is homebrew (the file says "D&D 2024 has no RAW morale"). Its numbers are untouched.
- **`COMBAT_END`.** It was presence-only, with no checks (`combatMarkerService.js:266`). The route ended the fight on it (`dmSession.js:2534`, and `:2622` for NPC turns), and so did the turn loop (`combatLoopService.js:409`).
- **No enemy left active.** The turn loop already stopped (`combatLoopService.js:393`, `stoppedOn: 'no-enemies'`), but only when it reached an NPC turn. A fight whose last enemy fell on the player's own action could stay open.
- **The turn order** skipped a non-active enemy (`combatantCanAct`, `combatLoopService.js:238`), but nothing marked it as out.
- **Related markers.** `DISENGAGE` and `ESCAPE` exist, but they only stop opportunity attacks and break a grapple; neither ends a fight. No surrender, parley or settle marker existed.

**What this job added:**
- **Migration 115** (`server/migrations/115_combat_enemy_resolution.js`). It widens the status CHECK to `active, dead, fled, surrendered, settled`. SQLite can't change a CHECK in place, so the table is rebuilt from its current definition (all five later-added columns are kept), the rows are copied, and the indexes are recreated. It is idempotent, and it refuses to run if the CHECK isn't the expected one.
- **`server/services/combatResolutionService.js`**, with these parts:
  - `setEnemyStatus`: the one write for an enemy leaving alive. It sets the status and marks the turn-order entry `out: "<status>"`.
  - `resolveEnemy`: finds the enemy by its exact name, or by a unique base name ("Thug" when one Thug is left). An ambiguous or unknown name is refused, with the names that are standing.
  - `settleFight`.
  - The refusal text and the outcome summary.
  - The three marker handlers.
- **Flee is wired to morale, not duplicated.** `moraleService` now writes `fled` through the same `setEnemyStatus` the DM's `[ENEMY_FLEE]` uses (the PM's vetoable decision). A flight morale forces and one the DM chooses are the same record.
- **Three marker schemas**, `ENEMY_FLEE`, `ENEMY_SURRENDER` and `COMBAT_SETTLE`, declared before `COMBAT_END` (see sibling fix 2). The player-facing strip picks them up automatically, since it is generated from the schemas.
- **`COMBAT_END` is refused** while the current fight has a turn state and an active enemy. A turn state is required so that an old fight, ended before this rule existed, can't block a stray `COMBAT_END`.
- **The engine ends the fight itself** in the route when the current encounter has enemies and none is active. On every ending, the outcome is recorded as a ⚙ line and a `[COMBAT OVER — system fact: …]` note in the stored history.
- **The DM is taught the markers** in two places: the combat rules in `dmPromptBuilder.js`, and each enemy's turn directive in `combatLoopService.npcTurnDirective` ("if Thug 1 runs off… gives up… takes a deal").
- **The tracker** (`CombatTracker.jsx`) shows an enemy that is out as dimmed, with its status in place of its initiative.

**Sibling defects found live and fixed in this job:**
1. **A nested quote cut a marker value short.** The DM wrote `Enemies="Thug 3 (HP 14, …, Weapon="Club"), Thug 4 (…)"`. The field parser (`markerSchemas.js` `extractField`) stopped the value at the first inner quote and made one enemy named `Thug 3 (HP 14, AC 12, ATK +4, DMG 1d8+2, Weapon=`. After that, no attack, surrender or end could name it (live run 1, messages 6–10).
   - The fix: a double-quoted value now ends at a quote followed by the next `Field=` or the end of the marker.
   - Plain markers parse as before: every marker test is green, and the case is pinned in `tests/combat-resolution.test.js`.
2. **A resolution and `[COMBAT_END]` in the same reply.** The DM wrote `[COMBAT_SETTLE: …] [COMBAT_END]` together. Markers dispatch in schema-declaration order, so `COMBAT_END` was judged first and refused, and the player saw "The fight isn't over" directly above "The fight is over" (live run 2).
   - The fix: the three resolution schemas are declared before `COMBAT_END`, so the resolution lands first.

## Files changed
| File | New / edited | SHA-256 | Bytes |
|---|---|---|---|
| `CLAUDE.md` | edited | `36167f06c0a1403794cd3e4a611931e2c54821e4b9ed2893feb656f6877692a5` | 27957 |
| `client/package.json` | edited | `6866eeaeae3a99013bdcbeac52a7383a842dc046e356131d54e2e141cdc2fb49` | 427 |
| `client/src/components/CombatTracker.jsx` | edited | `70fca9ca3cbe166894608bb64fbbb674d663d7524d970d4483404c4ea8121d92` | 4694 |
| `package.json` | edited | `2f2e554ee193950c1b7b325bfcb4f9e6b1b8478d038ddd8264e0dc94a8b4b946` | 1398 |
| `server/migrations/115_combat_enemy_resolution.js` | new | `472129102d6ada205280f6ff61dd5dfdeb430aed5da79c59ca9863a2bc766cdd` | 2604 |
| `server/routes/dmSession.js` | edited | `07560ec350bcd59e9a4136cac4e876588c9634b97f18658d175c9e40fe3660ad` | 224221 |
| `server/services/combatLoopService.js` | edited | `dc16c2111a0760e35e1dcfbc92330fd3b4f832af42ef5eae21da4782560437ad` | 22992 |
| `server/services/combatMarkerService.js` | edited | `0408f6b0854ac87eb0cb6602d99b42880eff2ce18d2f586549b5752798f48402` | 88857 |
| `server/services/combatResolutionService.js` | new | `1116a1f916de66d912d57c231952a02c6661c0252a2ead13261e97a932e70404` | 8071 |
| `server/services/dmPromptBuilder.js` | edited | `0e43038c75358b76d6d0251210b635a442784f0a65dc2d4697922a51ddddd6b3` | 196538 |
| `server/services/markerSchemas.js` | edited | `2748697708c95b363e9ef2be1a3c3dd21468e46b215b5d1de66110d81dc8e20a` | 65152 |
| `server/services/moraleService.js` | edited | `81cef5f83fa21ce52fd28431ab028f5f19eda0a5394e20cfdb9bc0335be50600` | 5457 |
| `tests/combat-resolution.test.js` | new | `3403eee0b3ec5794fe94d35e6a89383730696431e3f449e82620217f8eefe62b` | 15153 |
| `tests/marker-strip.test.js` | edited | `0e0872af75a287120f993235009b2a7fb658b0befc87633c887b1878bec4cca5` | 10777 |
| `docs/pm/reports/combat-resolution-REPORT.md` | new (this file) | n/a | — |

This job's brief, `docs/pm/combat-resolution/BRIEF.md`, was placed and committed with the previous job (`7ef5d44`).

**Migration 115** (new). Both `package.json` files are bumped to 1.0.207. `CLAUDE.md`'s turn-loop section gains the resolution rule.

## What was built (in play)
- **Calling a fight off while both thugs stand.** The DM can no longer just declare it over. If it tries, the player sees "⚙ The fight isn't over — Thug 1 and Thug 2 are still standing." The DM is told the fight goes on unless it says how it ended: an enemy runs, yields, or the fight is talked down.
- **A thug runs.** "⚙ Thug 2 flees the fight." The tracker shows "Thug 2 — fled", dimmed, and the other thug fights on.
- **A thug yields.** "⚙ Thug 1 surrenders." It stays in the scene, out of the fight, at the party's mercy.
- **Talking it down.** An offer of gold, or a truce, ends with "⚙ The fight is settled — Thug 1 and Thug 2 stand down."
- **When the last enemy is resolved**, the fight ends by itself: "⚙ The fight is over: Thug 1 surrendered; Thug 2 surrendered." The tracker clears, and the outcome stays in the session's history for the chronicle and the DM.
- **Morale flight** works as before. When it breaks a thug, that thug is recorded as fled, the same as a DM-chosen flight.

## Live probe (real server + real gemma4:12b)
Setup: the real `server/index.js` on its own port with a throwaway database, Ollama gemma4:12b, and invented characters (Dara Fenwick, human Fighter 3). The player's dice are invented values. The scripts are in the session scratchpad (`cres-probe.mjs`, `cres-probe2.mjs`; logs `cres-probe.out`, `cres-probe2.out`, `cres-probe3.out`). There were no server errors in any run.

**Final run** (`cres-probe3.out`, after both sibling fixes; each fight in its own session):

| Msg | Player sends | DM's markers (main reply + NPC turns) | Player sees (engine lines) | Engine state after |
|---|---|---|---|---|
| **Fight 1** 1 | "I'm drinking in the tavern common room when two thugs draw knives and attack me. I fight." | `[COMBAT_START: Enemies="Thug 1 (HP 12…), Thug 2 (HP 12…)"]` | 🎲 Roll a d20 for initiative — the engine adds +1 (Dex) after. | Thug 1, Thug 2 active |
| 2 | "17" | — | ⚙ Initiative: d20 17 + 1 (Dex) = 18. Turn order: Dara Fenwick 18, Thug 2 11, Thug 1 5. | — |
| 3 | "I lower my weapon and step back. "We call it off — nobody needs to die tonight."" | `[COMBAT_SETTLE: Terms="they back off and leave"] [COMBAT_END]` | ⚙ The fight is settled — Thug 1 and Thug 2 stand down. ⚙ The fight is over: Thug 1 stood down (settled); Thug 2 stood down (settled). | both `settled`; combatEnd; tracker cleared |
| **Fight 2** 4 | "At the docks, two thugs jump me with clubs. I fight back." | `[COMBAT_START: …] [ZONES: …]` | 🎲 initiative | both active |
| 5–8 | (initiative 12; attack Thug 1; d20 15; damage 6) | `ENEMY_ATTACK` ×3 on NPC turns | ⚙ … d20 15 + 5 = 20 vs AC 13 — HIT; damage: rolled 6 + 3 = 9 … ⚙ Thug 1 attacks …: HIT for 3 damage … | Thug 1 at 3/12 |
| 9 | "I knock the wounded thug down and put my blade to his throat. "Yield, or die."" | `[ENEMY_SURRENDER: Enemy="Thug 1"]`; NPC turn: `[ENEMY_ATTACK: Enemy="Thug 2" …]` | ⚙ Thug 1 surrenders. ⚙ Thug 2 attacks …: HIT for 3 damage. | Thug 1 `surrendered`; tracker "Thug 1(surrendered)"; the fight goes on |
| 10 | "I turn my blade on the other one. "Your friend gave up. Drop it."" | `[ENEMY_SURRENDER: Enemy="Thug 2"] [COMBAT_END]` | ⚙ Thug 2 surrenders. ⚙ The fight is over: Thug 1 surrendered; Thug 2 surrendered. | both `surrendered`; combatEnd; tracker cleared |
| **Fight 3** 11–12 | "In an alley, two thugs block my way…"; initiative 9 | `COMBAT_START`; `ENEMY_ATTACK` | 🎲 initiative; ⚙ Thug 1 attacks …: HIT for 3 damage. | both active |
| 13 | "I raise my empty hand. "I have forty gold. Ten of it is yours if you walk away right now."" | `[COMBAT_SETTLE: Terms="they let us pass for 20 gold"]` | ⚙ The fight is settled — Thug 1 and Thug 2 stand down. ⚙ The fight is over: … (settled) … | both `settled`; combatEnd; tracker cleared |

**Earlier runs, which found the sibling defects:**
- **Run 1** (`cres-probe.out`), Fight 1, message 4. The player roared and charged, and on its own turn the DM wrote `[ENEMY_FLEE: Enemy="Thug 2"]`. The player saw "⚙ Thug 2 flees the fight.", the tracker showed "Thug 2(fled)", and Thug 1 fought on. This is the live flee.
- **Run 1**, Fight 2. The nested-quote parse (sibling fix 1). At message 10 the DM wrote `[COMBAT_END]` with the mis-parsed enemy still active, and it was refused: "⚙ The fight isn't over — … is still standing", and the fight didn't end. This is the live refusal, though the enemy's name was garbled.
- **Run 2** (`cres-probe2.out`), message 4. "I sheathe my sword, turn my back on them and walk out." The DM wrote `[COMBAT_SETTLE: Terms="Dara Fenwick walks away and the thugs do not pursue"] [COMBAT_END]`. The settlement worked, but the contradictory refusal line appeared (sibling fix 2).

**What the live runs did not show:** the DM never wrote a bare `[COMBAT_END]` with healthy enemies standing in the final run. Once the resolution markers existed, it chose one every time. The refusal of that exact case is pinned by the tests (below); live, the refusal path ran in run 1. Morale flight did not trigger live, because no fight reached 50% casualties. Its tests cover both outcomes, and the combat-loop fix's live run 4 showed it firing.

## "Fixed looks like", per item — evidence
`tests/combat-resolution.test.js` (new, 36 assertions) drives the real route with a stubbed model:
- **Migration 115:** the CHECK lists all five statuses, the later columns are kept, and both indexes are back.
- **Item 1:**
  - With both thugs standing, `[COMBAT_END]` doesn't end the fight: `combatEnd` is unset, the turn state remains, and both thugs stay active.
  - The player sees "⚙ The fight isn't over — Thug 1 and Thug 2 are still standing."
  - The stored DM note names both thugs and all three resolution markers, and the NPC turns still run.
- **Item 2:**
  - A thug's `[ENEMY_FLEE]` on its turn gives `fled`, the ⚙ line, the tracker's `out: "fled"`, and a DM note naming who still stands.
  - `[ENEMY_SURRENDER]` gives `surrendered`.
  - `[COMBAT_SETTLE]` settles both thugs, runs no NPC turns, and passes the terms to the DM. Sent with `[COMBAT_END]` in the same reply, it gives no contradictory line.
  - An unknown name ("Thug 9") is refused, with the standing names.
- **Item 3:**
  - The last surrender ends the fight: `combatEnd`, the turn state deleted, no tracker state, "⚙ The fight is over: Thug 1 fled; Thug 2 surrendered.", and the `COMBAT OVER` fact in the stored history.
  - With every enemy dead, `COMBAT_END` is accepted and recorded.
- **Morale:** the engine's d20 is modelled both ways. Pinned to a natural 1, Thug 2 flees with the same status and turn-order mark as `ENEMY_FLEE`; on a held save it stays active.
- **Sibling fix 1:** the nested `Weapon="Club"` parses into two named, statted thugs, and a plain two-field marker is unchanged.

## Test results
- **Full `npm test` on the PC:** Files **253/253 green**, assertions **19,746 passed, 0 failed** (Windows notes: `display-casting`, `subclass-scanned4` counted `pass*`).
- **New file:** `tests/combat-resolution.test.js`, 36 passed, 0 failed.
- **Changed:** `tests/marker-strip.test.js` pins the schema count at 129 (it was 126; the three new markers). 64 passed.
- **The suites this job touched** were run separately and are green: combat-loop-fix (82), turn-e2e (51), marker-schemas, marker-pipeline (44), prelude-marker-schemas (74), capstone-combat, combat-real, item-3d (162), item-4 (55), item-5 (42), h1-teach-the-markers, dm-prompt-builder.
- **Client build:** `npx vite build` succeeded.

## Cost and usage
I can't measure this session's cost or the remaining usage against the $30/month cap from inside the session.

## Not done / still open
- **The player running away** is not a modelled resolution; see Questions, item 1. Live, the DM handled a walk-away with `COMBAT_SETTLE` ("the thugs do not pursue").
- **A new `[COMBAT_START]` while a fight is unresolved** leaves the old fight's enemies standing as `active`. That is a way around item 1, and the earlier probes saw the DM do it. It is not changed here; see Questions, item 2.
- **The :5173 click-through:** steps are below. I couldn't click through myself (no browser here); the probes drove the same server over HTTP.
- **Observed, outside this job:**
  - In live Fight 2 the DM once wrote `[ATTACK: Attacker="Thug 2" Target="Dara"]` for an enemy's blow (the engine refused it, since `ATTACK` is the party's marker), plus an `HP_CHANGE` the in-fight guard refused.
  - The DM's combat rules still tell it that every Artificer needs an Eberron origin explanation, which conflicts with Zach's ruling that no class needs one. I found this while editing that block and left it, because it isn't this job; it should be swept with the origin-explanation removal.

## Decisions made (reversible, for veto)
1. **Out-of-fight enemies stay in the turn order, marked `out`.** They aren't spliced out, because Slow expiry and other turn-start hooks key on the turn index. They were already skipped when their turn came, and now the tracker shows them dimmed with their status. Reversal: `setEnemyStatus` and the tracker's two style lines.
2. **`COMBAT_SETTLE` settles every enemy still standing at once.** A talked-down fight is the whole fight. Reversal: `settleFight`.
3. **A name fallback:** "Thug" resolves only when exactly one standing enemy has that base name. Two match → refused, asking for the numbered name. Reversal: `findStanding`.
4. **The refusal applies only to a running fight** (one with a turn state), so encounters ended before this rule can't block a stray `COMBAT_END`. Reversal: one query in the `COMBAT_END` handler.
5. **The engine ends the fight** whenever the current encounter has enemies and none is active, whoever's turn resolved it. Reversal: one check in the route after the turn loop.
6. **Surrendered and settled enemies keep their HP**, and nothing else changes for them: no loot, no XP rule, no capture state. Surrender and settlement add no numbers, and morale's numbers are untouched. The brief rules out inventing them.
7. **The parser's quote rule** (sibling fix 1) changes how every marker reads a double-quoted value, from "up to the first inner quote" to "up to the quote before the next field or the end". Reversal: one regex in `extractField`.

## Needs Zach's decision
I asked Muse about item 1 in chat mid-job and hadn't had an answer when this report was written; it's restated here so the report stands alone.

1. **What happens when the player's side runs away?**
   - All three resolutions are the enemies' (they flee, surrender, or the fight is talked down). If the party flees or outruns them, `COMBAT_END` is refused while the enemies stand, so the fight wouldn't end.
   - Live, the DM handled a walk-away by writing `COMBAT_SETTLE` ("the thugs do not pursue"), which works but records the thugs as "settled".
   - Options:
     - (a) A fourth resolution, `[COMBAT_ESCAPE]`: the party got away, the enemies are recorded as still standing but out of this fight, and the fight ends.
     - (b) Keep it as now: an escape is the enemies letting the party go (`COMBAT_SETTLE`).
     - (c) An escape only through movement, once the party is out of reach.
   - Checked: no marker today lets the party leave a fight. `DISENGAGE` only stops opportunity attacks, and `MOVE` only moves between declared areas.
2. **What should happen when the DM starts a new fight while the last one is unresolved?**
   - Today `[COMBAT_START]` opens a new encounter. The old encounter's enemies stay `active` and its turn state lingers; the probes saw the DM do this ("Later, at the docks…") and also restart a fight mid-fight.
   - Options:
     - (a) Refuse `COMBAT_START` while a fight is running, unless it adds to it.
     - (b) Treat a mid-fight `COMBAT_START` as reinforcements joining the running fight.
     - (c) Record the old fight's standing enemies as having withdrawn when a new fight starts.
   - Checked: `combatMarkerService.js` COMBAT_START always opens a new `encounter_seq`, and nothing reads or closes the previous one.

## How to verify
**Gate:** `npm test` on the PC (expect 253 files green).

**At `:5173` (never `:3000`), with `npm run dev`** (the server applies migration 115 to your local database on start; the table is rebuilt with its rows):
1. Use a campaign character. Start a session in a town.
2. Type "I'm drinking in the tavern common room when two thugs draw knives and attack me. I fight." Answer the initiative ask.
3. Fight a round, then type "I lower my weapon and step back. "We call it off.""
   - **Look for:** the fight does NOT just end. Either the DM resolves it, with "⚙ The fight is settled — … stand down." and then "⚙ The fight is over: …", or it tries to end it bare and you see "⚙ The fight isn't over — Thug 1 and Thug 2 are still standing." and the fight goes on.
4. In another fight, wound a thug and type "I put my blade to his throat. "Yield, or die.""
   - **Look for:** "⚙ Thug 1 surrenders." The tracker shows Thug 1 dimmed and labelled "surrendered", and the other thug keeps fighting.
   - Make the last one yield or run. **Look for:** "⚙ The fight is over: Thug 1 surrendered; Thug 2 …", and the tracker clears.
5. In a third fight, offer them gold to walk away.
   - **Look for:** "⚙ The fight is settled — Thug 1 and Thug 2 stand down.", then the fight is over, and the tracker clears.

---

## Addendum — Muse's decisions on the two questions (2026-11-23), v1.0.208
Muse answered both questions above. What was built:

1. **Party escape: `[COMBAT_ESCAPE: How="…"]`.**
   - Asked for: when the DM writes it, the fight ends as an escape. The party got away; the enemies are recorded as still standing but out of this fight; the outcome is recorded. No automatic pursuit, and the enemies remain in the world where they were.
   - Built: a new schema, declared before `COMBAT_END`. It needs a running fight with someone standing. The enemies keep status `active` ("still standing, where they were"), and nothing pursues.
   - The player sees "⚙ You get away — Thug 1 and Thug 2 … are left behind, still standing." and "⚙ The fight is over: the party escaped — Thug 1 still standing (the party got away); …".
   - The DM gets "The party ESCAPED (how) … they do not pursue unless you start a new fight later", and the `COMBAT OVER` fact records the escape in the stored history.
   - The combat rules teach it, and the `COMBAT_END` refusal note now lists it among the options.
2. **Mid-fight `COMBAT_START` joins the running fight.**
   - Asked for: while a fight is active, the listed enemies join it. Their initiative is rolled, they're slotted into the current order, and the existing state is kept. The engine tells the DM they joined. With no fight active, it's a normal fresh fight.
   - Built: a fight is "active" when it has a turn state. Joiners go into the same encounter and roll the engine's d20 for initiative (an enemy's roll). Each is slotted in by initiative, after existing ties, and the current-turn pointer moves when an entry lands before it. HP, conditions, the round and the player's place are all unchanged.
   - Joiners are numbered on from the fight ("Thug 3" after Thug 1 and 2; a lone "Thug" becomes "Thug 5").
   - The DM's note reads "Thug 3 (initiative 14), Thug 4 (initiative 9) JOINED the fight already running — no new fight started … Turn order now: …".
   - **Fixed live:** gemma4:12b re-listed the whole fight when two thugs joined (`Enemies="Thug 2, Thug 1, Thug 3, Thug 4"`), and the first build cloned Thug 1 and 2 as Thug 5 and 6. A listed name that is already in the fight is now skipped, and the note says how many were already there. A numbered name the DM gives a newcomer (e.g. "Thug 3") is kept.
   - **Known edge:** a re-listing with unnumbered names ("Orc, Orc" while Orc 1–3 fight) can't be told apart from newcomers, so they join as new orcs. Live Perception run 5b showed it once, while a fight was still waiting on initiative.
   - **Known edge:** turn hooks keyed on the turn index (Slow expiry) and set before a join can be off by the number inserted ahead of them.

**Tests** (`tests/combat-resolution.test.js`, now 49 assertions):
- A join with the live re-listing gives four distinct thugs, all in the same encounter, with initiative, and no new player initiative ask. The DM note says two were already there, and the turn returns to the player.
- A lone "Thug" joins as Thug 5.
- The escape ends the fight and clears the tracker. All five thugs stay `active`, and the ⚙ lines and outcome say they were left standing. The DM note and the history fact record it.
- With no fight running, a `COMBAT_START` starts a fresh encounter.
- `tests/marker-strip.test.js` pins 130 schemas.

**Live** (`cres-probe4.out`):
- **Fight A.** "I flip a table into their path and sprint out the back door into the dark alleys" → `[DODGE…] [COMBAT_ESCAPE: How="ducked into the crowd"]`. All four thugs were left standing, the fight was over, and the tracker cleared.
- **Fight B.** "the thugs shout for their friends to come help" → a mid-fight `COMBAT_START`. The newcomers took turns in the same fight; before the fix, the clones above also appeared. After the fix, the test pins the re-listing case.

**Files changed for both decisions** (and for the Perception decision in the other report):
| File | New / edited | SHA-256 | Bytes |
|---|---|---|---|
| `CLAUDE.md` | edited | `b3f6ad3af2136c2cb5f8e9bfe2396e2804597d3d2ef6cb220feca89bc373be60` | 28789 |
| `client/package.json` | edited | `07dd4f622a87e7bbb33331232f8f5cb97c898243aab42ec83a5134709da694ae` | 427 |
| `docs/pm/reports/player-rolls-out-of-combat-REPORT.md` | edited | `9cb5b1e63bd565933ce11dec777e23aba417518d40795a35f1f81def18dde2c8` | 30188 |
| `package.json` | edited | `52d90b1e8e4d22088227da94de819a89142feb701de31045cc874266f910dbc3` | 1398 |
| `server/routes/dmSession.js` | edited | `5d7bbd4b72947301cee3686fea688b03c9cb0aef1f1e41c08dcbb5395b8d3e9f` | 225013 |
| `server/services/combatLoopService.js` | edited | `706bfd9a9fb51f65464385682cead2f0699481d07d63009dc09d95dd209a9107` | 23031 |
| `server/services/combatMarkerService.js` | edited | `0e201e1ef85eb6306d0222efd4154ee9412ea770351197c50bee200b04608251` | 94427 |
| `server/services/combatResolutionService.js` | edited | `fe9f76e89996c93f6cd16ea7e32e2a622242df20d3f510e97710c970f569a06f` | 9611 |
| `server/services/dmPromptBuilder.js` | edited | `84ef1cb750907b6b538e6a3bfe0d7ae2ed371c3df67cbb483c3df01b7aead8d0` | 196928 |
| `server/services/markerSchemas.js` | edited | `07626edf1a4f05c26cb3d9afc7eafcebfa9acde2e8af40ced5376d1261f22dff` | 65414 |
| `server/services/perceptionPreRollService.js` | edited | `8ea94456b0ce32ad1c24c1271ab1ef018f7ce7974d844cab1efaf78baaf6d067` | 29980 |
| `server/services/rollRequestService.js` | edited | `34e7d529c33350fe17cf610bba3e46a1b4431d217a1db36877b14ca3c5953331` | 56908 |
| `tests/combat-resolution.test.js` | edited | `e0c0064b9c016b2ea9f39b23d0e31c127e7ec0934b857620f0fb019922d4a9a0` | 19580 |
| `tests/item-8-conditions.test.js` | edited | `5bc102ae876326f86f8a5363dd9f9c3d1e985eebfc1ce29a03f9030780e6ca0d` | 22551 |
| `tests/marker-strip.test.js` | edited | `fcd88ff7d424411a1608d2059e38d28c8413ef5a342d8864795b68d04650f8a2` | 10792 |
| `tests/player-rolls-out-of-combat.test.js` | edited | `8ec99d41735ec8d770ca9bb083e557602e1981165c7384bb0a98122b6e478ea0` | 18771 |
| `docs/pm/reports/combat-resolution-REPORT.md` | edited (this file) | n/a | — |

**Full `npm test`:** Files **253/253 green**, assertions **19,744 passed, 0 failed** (Windows notes: `item-1b-cleave-push-slow`, `item-8-conditions`, `lair-durability`, `pc-conditions` counted `pass*`).
