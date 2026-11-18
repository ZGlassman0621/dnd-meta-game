# Report — S2: damage at 0 HP

Builder: Claude Code (Opus 5.5). Brief: `docs/pm/s2-damage-at-zero-hp/BRIEF.md`.
Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.200 → **1.0.201**.
Commit: recorded by a follow-up commit (see the bottom of this file).

## Understanding
The project is a solo D&D 2024 "forever game": one human player character, with the DM, NPCs, companions and enemies played by an AI (gemma4:12b on the PC). The server owns the player's HP and death saves; the AI narrates and stops.

Audit finding S2: once a character was down at 0 HP, further hits did nothing. A downed player could lie under a goblin's blade forever and only the per-turn rolled save could kill them. Zach ruled (2026-11-12) that each hit taken while already at 0 HP is one failed death save, a critical hit is two, and there is **no massive damage**: no single hit kills outright. This job puts that rule where damage is applied, so every damage path inherits it, gives the DM a `crit=true` flag for critical hits it narrates, passes the engine's own crits through untouched, and applies the same rule to companions.

**Where my understanding differs from the brief (all within its latitude):**
1. **Companions had no choke point.** Companion damage was written by three separate inline `UPDATE`s. I made one companion damage function and pointed all three at it (item 5).
2. **The companion "death path" stops at a flag.** The companion death-save route computes `dead` at three failures but never persists a death; it is the only death path companions have, so the new rule mirrors it exactly and the gap is stated below.
3. **The live model over-used the crit flag** with my first prompt wording (it copied the crit example onto an ordinary hit). I tightened the wording and re-proved it live (item 7).

## Verdict
**BUILT + GREEN** on the builder's run (Files 247/247 green, assertions 19,650 passed, 0 failed). Not a gate: Zach's own `npm test` and the `:5173` checks gate it.

## Per-item verdicts
| Item | Verdict | Evidence |
|---|---|---|
| 1. Survey first | **Built** | Every audit evidence point verified against live bytes (below); every damage path to a PC or companion listed with file, line, crit story and disposition. |
| 2. PC rule at the choke point | **Built** | `applyHpChange` (`server/services/characterHpService.js:52`) is the single function that changes PC HP. The rule lives there (`:98-116`). Every PC damage path in the inventory calls it, so every marker inherits the rule. It feeds the existing `death_save_failures` and `is_dead` columns, the same ones the rolled save writes (`:317-322`). There is no new counter and no second death path. |
| 3. Edges | **Built** | The dropping hit adds no failure (only `before.current_hp === 0` counts); temp HP absorbs first (only damage past `temp_hp` counts); damage to a stabilised PC (3 successes at 0) adds the failure(s) and resets successes to 0; partial successes (1–2) are kept; healing and rising above 0 reset as before (unchanged code, `:118-131`). No massive-damage rule: a 999-point hit at 0 adds one failure, tested. |
| 4. Crits, both kinds | **Built** | DM-declared: `HP_CHANGE` gained an optional `crit` bool (`server/services/markerSchemas.js`) plus a prompt instruction (`formatPlayerHpRules`). Engine-judged: the enemy weapon attack's `isCrit` (`enemyCombatService.js:265`) and the enemy spell attack's `isCrit` (`enemySpellService.js:1146`) are now passed to the HP functions. Per-path story in the inventory. |
| 5. Companion rule | **Built, with one pre-existing gap stated** | New `applyCompanionDamage` (`characterHpService.js:195`) is the one place companion damage is written; all three companion damage paths call it. Same rule against `companions.death_save_*`. Gap: companions have no persisted death (see "Companion-path finding"). |
| 6. Tests | **Built** | New `tests/s2-damage-at-zero-hp.test.js`, **38/38**: every branch in the brief for PCs and companions, the HP_CHANGE marker crit, an engine crit, the route note, and the prompt text. |
| 7. Prove at `:5173` | **Server half proven live with the real model; UI clicks not done by me** | No browser tool in this session. I booted the real server against a throwaway database with the real gemma4:12b, downed a hero, and sent two hits through the real turn route; the pips moved by 1 and by 2 (output below). The click steps are in "How to verify". |

## Item 1 — survey

### The audit's evidence, checked against live bytes (audit line numbers were from `6084b18`)
| Audit claim | Live bytes before the change | Holds? |
|---|---|---|
| Damage clamps HP at 0; counters only change on dropping to 0 (reset) or rising above 0 (`characterHpService.js:62-100`) | Same logic at `:52-100` (the header comment had grown) | Yes |
| No other place adds a failure on damage (`server/services`, `server/routes`) | `grep death_save_failures` over both trees: writers are the rolled save, the drop/rise resets, the companion death-save route and resets (`companion.js:1046`, `:1135`), and the rest reset (`restTimeService.js:614-618`). None adds a failure on damage. | Yes |
| Failures only rise on rolled saves (`:193-200`) | `:300-322` | Yes |
| No massive-damage rule exists | None in code. The only text containing "massive damage" is the Drow L18 ancestry feat "Exile's Promise" description (`server/data/ancestryFeats.js:76`), which is flavour text, not a rule. | Yes |
| Rolled saves correct: nat 1 = two failures, nat 20 = 1 HP (`:175-200`) | `:282-309` | Yes, unchanged by this job |
| Companion route only rolls saves (`companion.js:1075-1110`) | The death-save route is `:1046`; its outcome logic is `:1069-1118` | Yes |

**Stabilisation state that exists:** PCs: three successes at 0 HP (`death_save_successes = 3`), set by the rolled save; there is no separate column. Companions: none stored; `POST /:id/stabilize` (`companion.js:1135`) only zeroes the counters.

**Temp HP:** PCs: `characters.temp_hp`, absorbed first inside `applyHpChange`. Companions: `companions.companion_temp_hp` exists, but nothing in the build ever grants it, and the old companion damage paths ignored it. The new function honours it anyway.

**Death path at three failures:** PCs: `is_dead = 1`, terminal; the turn route then tells the DM the player has died. Companions: the death-save route returns `dead: true` and stops (see the companion finding).

### Every damage path to a PC or companion
"Crit story" is how a critical hit reaches the rule. "Disposition" is whether the path flows through the fix.

| # | Path | File:line | Target | Kind | Crit story | Disposition |
|---|---|---|---|---|---|---|
| 1 | `HP_CHANGE` marker (negative delta) | `characterHpService.js:400` | PC | DM-declared | New `crit=true` field on the marker; handler passes `parsed.crit === true` | Through `applyHpChange` |
| 2 | `HP_CHANGE` with a table cause (Fall / Trap / Hazard) | `damageTableService.js:193, 201, 204` → `damageToPc` / `damageToCompanion` | PC, companion | Table roll | No attack roll, so no crit (treated as non-crit) | Through `applyHpChange` / `applyCompanionDamage` |
| 3 | Pending trap save resolved | `damageTableService.js:224` → `damageToPc` | PC | Save-based | No crit in a save | Through `applyHpChange` |
| 4 | `ENEMY_ATTACK` (weapon attack judged against AC) | `enemyCombatService.js:277` (PC), `:285` (companion) | PC, companion | Engine-judged | `isCrit` = natural 20 or the enemy's crit threshold (`:265`), passed straight through | Through both functions |
| 5 | `ENEMY_CAST`, spell attack roll | `enemySpellService.js:1157` → `damageToTarget` | PC, companion | Engine-judged | `isCrit` = die 20 (`:1146`), passed through `damageToTarget` | Through both functions |
| 6 | `ENEMY_CAST`, save spells | `enemySpellService.js:1108` → `damageToTarget` | PC, companion | Save-based | No crit in a save | Through both functions |
| 7 | `ENEMY_CAST`, Magic Missile darts | `enemySpellService.js:1030` → `damageToTarget` | PC, companion | Auto-hit | No attack roll, no crit | Through both functions |
| 8 | Enemy pending save effect resolved | `enemySpellService.js:1358` → `damageToPc` | PC | Save-based | No crit | Through `applyHpChange` |
| 9 | Reaction damage (Hellish Rebuke and similar, aimed back at the attacker) | `enemySpellService.js:845`, `:1377` → `damageToTarget` | Whoever attacked (a PC or companion only if they were the attacker) | Save-based | No crit | Through both functions |
| 10 | `DISPLAY` mishap splash | `displayService.js:186` (PC), `:191` (companion) → `damageToPc` / `damageToCompanion` | PC, companion | Engine mishap | No attack roll, no crit | Through both functions |
| 11 | Lair hazard | `lairDurabilityService.js:416` (PC), `:424` (companion) | PC, companion | Save-based | No crit | Through both functions (companion branch was an inline `UPDATE`, now the new function) |
| 12 | Narrated-damage reconciliation (prose says damage, no marker) | `fictionMarkerReconciliation.js:72` | PC | Reconciled | No crit information in prose; treated as non-crit | Through `applyHpChange` |
| — | Exhaustion level 6 death | `conditionService.js:208-210` | PC | Not damage | n/a | Own handling (a direct death, by the 2024 rule, not a hit) |
| — | Cold-exposure death | `coldExposureService.js:213-215` | PC | Not damage | n/a | Own handling (same as exhaustion) |
| — | Prelude HP | `preludeSessionService.js:1063` | Prelude character | Separate model | n/a | Out of scope: the Prelude has its own HP model with no death saves, and it is post-MVP |
| — | `combat_allies` (`entityService`) | — | Not PCs or companions | — | n/a | Not covered by S2 |
| — | Manual sheet edits (`PUT /api/character/:id`, `PUT /api/companion/:id`) | `character.js`, `companion.js:300` | PC, companion | Player edit | n/a | Not damage; a sheet correction, left alone |

Every path that damages a PC calls `applyHpChange`; every path that damages a companion now calls `applyCompanionDamage`. The healing writers (Second Wind, Lay on Hands, healing spells, Wild Magic, Survivor, Preserve Life, the reaction refund) were checked and are positive changes only.

## Companion-path finding
- **Before:** three separate inline writes (`enemyCombatService`, `enemySpellService.damageToCompanion`, `lairDurabilityService`). Each was `MAX(0, hp - damage)`. None touched the counters, none honoured temp HP, and at 0 HP a hit did nothing.
- **Now:** `applyCompanionDamage(companionId, amount, { crit })`, one `UPDATE`. Temp HP absorbs first. The dropping hit adds no failure and resets the counters, so a companion that went down before starts fresh. A hit while already at 0 adds 1 failure (2 on a crit), capped at 3. A companion whose `status` is `dead` or `deceased` takes nothing. At three failures it returns `dead: true`, the same outcome the death-save route reports.
- **Gap, pre-existing, not built (stated, not skipped):** the companion death-save route (`companion.js:1046`) computes `dead` at three failures but **never persists a death**. `status` stays `active`, and a full death needs a separate call to `POST /api/companion/:id/deceased` (`:1367`, which runs the NPC death propagation). The S2 helper matches that route exactly (counters at 3 plus the `dead` flag in its result); it does not invent a second companion death path. Persisting companion death automatically is its own decision and job.
- **Stabilise:** companions store no stabilised state, so there is nothing to clear; the failure(s) still count.
- **Healing:** companion healing paths don't reset the counters (pre-existing). The new drop-to-0 reset means stale counters can no longer carry into a fresh fall.

## Files changed
| File | New / edited | SHA-256 | Bytes |
|---|---|---|---|
| `server/services/characterHpService.js` | edited | `78a988630b9211944cca852f4931f9a63f9b7bfe0773f04e3d2ef4f1ffd43e3b` | 17,121 |
| `tests/s2-damage-at-zero-hp.test.js` | new | `36bc6c1448e3750c2dd496bbf9b4b63cb00b787c01e81033e6f88ae18792106a` | 15,182 |
| `docs/pm/s2-damage-at-zero-hp/BRIEF.md` | new | `ee8184cc462625725a86bd21782efc02abe75866e97f9a572204ddfac0087693` | 8,559 |
| `server/routes/dmSession.js` | edited | `e5a5dc243b91f089fa7c94a320526e767b240444e61eddf636597697b593ff2b` | 196,465 |
| `server/services/dmPromptBuilder.js` | edited | `f2e82e9229b7284f759a403466c7c964ae3e71732529ef455c694920baad95eb` | 189,845 |
| `server/services/enemyCombatService.js` | edited | `814db003bd9ed498484b567fcc1ff01b9a84bd24d00e33c77816bea59def9789` | 20,512 |
| `server/services/enemySpellService.js` | edited | `bbb71b7b3351d565c28b6263341a0880981b9207b5af4fdf2880f98cdaf99d62` | 80,993 |
| `server/services/lairDurabilityService.js` | edited | `91cd600bb81c2ac029ffaa4c8c2744860b0b56502da43207083e3993e0c9e625` | 36,712 |
| `server/services/markerSchemas.js` | edited | `02813f759bbe2916ed1687d67fe9f39d95e837adf9ec4950ebf1eb7a4f6df6ec` | 63,924 |
| `package.json` | edited | `dffdd1c3cb48f31e1551e9482c3cb979613aa71218eeab37c920d9b4dfe7bffb` | 1,398 |
| `client/package.json` | edited | `a033e1e234d78e86d162a12454f9747bf742c71364573c2dbc5dfca6ad129df2` | 427 |

Hashes are of the files as committed (CRLF where the repo has it). No migration: every column the rule needs (`characters.death_save_*`, `temp_hp`, `is_dead`; `companions.death_save_*`, `companion_temp_hp`, `status`) already exists.

## What was built (in play)
- **A downed player can be killed by attacks.** Each hit on them while at 0 HP marks one failed death save, and a critical hit marks two. Three failures and they die, the same death as failing the rolled saves. The DM is told plainly when a hit killed them, and no extra death save is rolled that turn.
- **No hit kills outright.** However large the hit, at 0 HP it is one failure (two on a crit).
- **The blow that knocks them down costs no failure.** Temp HP soaks a hit first, so a hit fully absorbed by temp HP costs nothing. A stabilised hero who is hit loses the stabilisation and takes the failure. Healing works exactly as before.
- **The DM marks crits** with `crit=true` on `HP_CHANGE` (prompt says: only for a natural 20). Enemy attacks and spell attacks the engine rolls carry their crits automatically.
- **Companions follow the same rule** on every path that damages them.
- Fix-along: the companion death-save line in the DM prompt said "one more failure = dead" even at three failures. At three it now says "three failures: dead".

## Test results
- **Full `npm test` on the PC, after all edits:** Files **247/247 green**, assertions **19,650 passed, 0 failed** (246 files before this job, plus `s2-damage-at-zero-hp`). Windows runner notes: `profession-archetype`, `set-cover-feature` and `spell-damage` counted `pass*` (libSQL exit crash after all assertions passed); no file was retried. An earlier full run, before the final prompt-wording change, was also 247/247 green (19,648 assertions).
- **New suite `s2-damage-at-zero-hp`, 38/38.** It covers:
  - PC: the dropping hit adds no failure; a hit at 0 adds one; a crit adds two; three failures set `is_dead`; the dead roll no saves and take no damage or healing; a 999-point hit adds one failure (no massive damage); temp HP fully absorbing a hit adds none; temp HP partly absorbing still adds one; a stabilised PC loses the stabilisation and keeps the failure; partial successes are kept; healing resets.
  - Rolled saves are unchanged: forced natural 1 = two failures; forced natural 20 = 1 HP and up.
  - `HP_CHANGE crit=true` goes through the real marker pipeline and adds two.
  - An engine crit: a real enemy built by `createEncounterEnemies` attacks with dice forced to 20, and adds two.
  - Companion: the dropping hit resets stale counters; a hit at 0 adds one; crits kill; massive damage adds one; temp HP; a deceased companion takes nothing; `damageToCompanion` crit; an enemy crit on a companion.
  - Turn route: a fatal hit produces the "HAS DIED" note and no extra roll.
  - Prompt text: the crit flag, the at-0 rule and "no instant death" lines.
- Touched suites, own counts: `enemy-combat` 23/23, `turn-e2e` 50/50, `dm-prompt-builder` pass, `fiction-marker-reconciliation` 9/9.
- **Static import check:** `server/` 1,882 named imports, **0 problems**.

## Live proof (item 7): real server, real model
The real `server/index.js` was booted on port 3078 against a throwaway database, with Ollama and gemma4:12b running, and driven over HTTP. The script is `s2-probe.mjs` in the session scratchpad; it stopped only its own child process. The probe created a campaign and a level-1 Fighter, started a session, set the hero to 0 HP with zeroed counters, and sent two turns through `POST /api/dm-session/:id/message`. It reset the counters before each turn so each turn reads on its own. Final run, verbatim:

```
server up: true
POST /start: 200 6.5 s
set to 0 HP: HP 0, unconscious 1, dead 0, successes 0, failures 0
turn: "(I am unconscious at 0 HP.) The goblin standing over me stabs down with its scimitar and hits me."
  HTTP 200 2.7 s
  markers the model emitted: [HP_CHANGE: delta=-5 reason="goblin's scimitar"]
  death save rolled by the system this turn: 13 → success
  pips before: HP 0, unconscious 1, dead 0, successes 0, failures 0
  pips after:  HP 0, unconscious 1, dead 0, successes 1, failures 1
turn: "(Still down at 0 HP.) A second goblin rolls a natural 20 and its scimitar strikes me — a critical hit."
  HTTP 200 2.2 s
  markers the model emitted: [HP_CHANGE: delta=-14 crit=true reason="the goblin's critical blow"]
  death save rolled by the system this turn: 3 → died
  pips before: HP 0, unconscious 1, dead 0, successes 0, failures 0
  pips after:  HP 0, unconscious 1, dead 1, successes 0, failures 3
```

What it shows:
- **Ordinary hit:** the model emitted a plain `HP_CHANGE` and the hit added **1 failure**. The system then rolled the turn's normal death save (13, a success), so the pips read 1 success, 1 failure.
- **Critical hit:** the model emitted `crit=true` and the hit added **2 failures**. The turn's normal save then rolled a 3 (a failure), making 3 failures, and the hero died through the existing death path.

**The first live run found a prompt problem, and that run is why the wording changed.** With my first wording the model tagged the *ordinary* hit `crit=true`, copying the example. The prompt now says crit is only for a natural 20 and gives an ordinary-hit example next to it; the rerun above is with that wording. The model also reused the crit example's `-14` as its damage; that is the DM's damage call and outside S2.

## Not done / still open
- **`:5173` click-through:** not done by me, because there is no browser tool in this session. The server half is proven live above; the steps are below.
- **Companion death is not persisted** at three failures (pre-existing; see the companion finding). Not built.
- **A stabilised PC keeps rolling death saves each turn** (pre-existing: the turn route rolls whenever HP is 0 and the player is not dead, and does not skip a stabilised player). Out of scope under "no change to rolled death-save mechanics"; reported for a later job.
- **For Muse, unrelated to S2, found while reading the prompt:** the Artificer combat prompt text (`server/services/dmPromptBuilder.js`, the long class-features line) still says "Every artificer comes from Eberron (Khorvaire) and needs an explanation for how they reached the Forgotten Realms … ask for it in play and record it with `[ARTIFICER_ORIGIN: …]`". That conflicts with Zach's 2026-11-17 ruling that the Artificer needs no explanation. I left it alone (one job at a time); it belongs with the plan §12 change Muse is briefing.
- **Cost and usage against the $30/month cap:** not measurable from inside the session.

## Decisions made (reversible, for veto)
1. **Partial successes are kept when a non-stabilised PC is hit at 0 HP;** only a full stabilisation (3 successes) is cleared. This is the book reading: damage adds a failure, it does not wipe successes. Reversal: one line in `applyHpChange` (reset `successes` to 0 always).
2. **The drop-to-0 hit resets a companion's counters,** matching the PC. This had been missing for companions. Reversal: remove the `droppedToZero` branch in `applyCompanionDamage`.
3. **When a hit kills the player, the turn adds a system note and skips that turn's death save,** using the same wording as a fatal rolled save. Reversal: delete the `fatalHit` block in `dmSession.js`.
4. **Paths with no attack roll** (table damage, traps, save spells, Magic Missile, splash, lair, reconciliation) **are never crits.** This is the book: only an attack roll can crit. Reversal: none needed.
5. **The crit prompt wording is strict** ("only for a natural 20; when unsure, leave crit off"), chosen after the live over-tagging. Reversal: edit the bullet in `formatPlayerHpRules`.
6. **Version bump to 1.0.201.** Reversal: two lines.

## Needs Zach's decision
None for S2. Zach's part is the gate. (The companion persisted-death gap and the stabilised-PC re-rolls are queued for Muse to scope, not questions for this job.)

## How to verify
**Gate:** `npm test` on the PC (expect 247 files green).

**At `:5173` (never `:3000`), with `npm run dev`:**
1. Use a character that is in a campaign (create one, and on the Campaign page create a campaign for it). Click **Play** and start a session.
2. Get the character to 0 HP. Either fight until a hit drops you, or type an action such as "I step in front of the ogre's club" and let the DM land it. The sheet shows 0 HP and the death-save pips appear; the system rolls one save per turn.
3. While still at 0 HP, type: "(I'm unconscious at 0 HP.) The goblin standing over me stabs down and hits me."
4. **Look for:** the failure pips go up by **one more** than that turn's rolled save accounts for. In stored history, the DM's reply carries `[HP_CHANGE: delta=-N reason="…"]` with no `crit`.
5. Crit case: type "(Still down.) A second goblin rolls a natural 20 and its scimitar strikes me — a critical hit." **Look for:** `crit=true` on the marker, and the failures go up by **two** for the hit. Three failures in all and the character dies; the DM narrates the death.
6. Massive damage: any hit, however big, moves the pips by one (two on a crit), never straight to dead.
