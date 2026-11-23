# Report — H1: teach the DM its markers

Builder: Claude Code (Opus 5.5). Brief: `docs/pm/h1-teach-the-markers/BRIEF.md`.
Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.202 → **1.0.203**.
Commit: `79b1d6c` (the build); a follow-up commit adds this line.

## Understanding
The project is a solo D&D 2024 "forever game": one human player character, with the DM, NPCs, companions and enemies played by an AI (gemma4:12b on the PC). The AI changes the game world by writing short bracketed markers into its narration (`[HP_CHANGE: …]`, `[COMBAT_START: …]`); the engine reads each marker and does the real work.

Several systems were fully built but the DM was never told their markers exist, so they could never fire: dungeon generation, scene rooms, cold exposure, lair structure, enemy display casting, and a set of class features. This job adds the missing instruction lines to the DM's prompt. It builds nothing and changes no engine behaviour. For each marker it either teaches it, records that it was already taught, or explains with evidence why it stays untaught.

**Where the live build differs from the brief. Read these first.**
1. **The DM never learns what most of these markers did.** The turn route forwards a marker's result note to the DM only for a fixed list of markers: merchant, commission, base defense, combat start/end, turn advance, set cover (`server/routes/dmSession.js:2255-2340`). None of the H1 markers is on that list. Consequences:
   - When `GENERATE_DUNGEON` stores a dungeon, the DM is never told it worked, and never gets the new scene id or room keys.
   - When `GENERATE_DUNGEON`, `SET_ROOM` or a lair marker is refused (missing field, coherence flag needing a Justification, no active fight), the DM never sees the reason.
   - `LAIR_DAMAGE` / `LAIR_STABILIZE` / `LAIR_HAZARD_ROLL` results (structure %, band, hazard) never reach the DM.
   - Cold exposure and enemy displays are the exceptions: cold results ride the rest/time report the DM reads next turn, and enemy displays post a "SPELL NOTICE".

   Fixing this means changing what the route passes to the DM, which is beyond a teaching job. It is listed under "Not done" as a follow-up.
2. **`EVOLVE_PLACE` is not taught, though the brief asks for it.** Its required field is a scene id (`Scene=`), and no scene id ever reaches the DM: not in the prompt, not in any note (searched `dmPromptBuilder.js` and `dmSession.js`). A DM taught this marker would have to invent an id, and a wrong id would change the wrong place. The same blocker rules out the `Scene=`/`Room=` forms of `SET_ROOM`, `COMBAT_START` and `LAIR_CREATE`. Their name-only forms are taught.
3. **`ATTUNE` / `UNATTUNE` were not actually taught.** The brief and the audit say they are taught via `attunementService.js:217`. That function (`attunementPromptSection`) existed but had no caller anywhere, so the line never reached the prompt. It is the same defect as everything else in H1, so I wired it in (fix-as-you-find-it). Its text is byte-identical, and a test proves it.
4. **The class audit is not in the repo.** The brief asks me to reconcile against it, but its document lives in Muse's workspace. So I verified each of the 14 feature markers myself, against the handler code and what consumes its result. `learnPlan`, the brief's example, is wired: the already-taught `ARTIFICER_LEARN_PLAN` calls it (`artificerService.js:680`). Whatever gap the class audit means is elsewhere, and I could not see it.

## Verdict
**BUILT + GREEN** on the builder's run (Files 249/249 green, assertions 19,651 passed, 0 failed). Not a gate: Zach's own `npm test` and the `:5173` checks gate it.

## Per-item verdicts
| Item | Verdict | Evidence |
|---|---|---|
| 1. Survey first | **Built** | Full inventory below (schema, handler, prompt state, file:line). The lean-mode placement and the feedback gap are documented. |
| 2. Dungeon, scene, cold | **Built for 4 of 5; `EVOLVE_PLACE` still-open** | `GENERATE_DUNGEON`, `SET_ROOM` (name form), `COLD_SCENE`, `COLD_WET` are taught. `EVOLVE_PLACE` is untaught: no scene id reaches the DM (Understanding 2). |
| 3. Lair and display | **Built** | `LAIR_CREATE`, `LAIR_DAMAGE`, `LAIR_STABILIZE`, `LAIR_HAZARD_ROLL` and `ENEMY_DISPLAY` are taught. `LAIR_ACTION` was already taught. Lair results still don't reach the DM (Understanding 1). |
| 4. Class features, reconciled | **Built: 7 taught, 7 still-open** | Taught: `PRESERVE_LIFE`, `TELEPATHIC_SPEECH`, `AWAKENED_MIND`, and the four artificer markers. Still-open for severe-seven: `HEROIC_REROLL`, `BEND_LUCK`, `TIDES_OF_CHAOS`, `TAMED_SURGE`, `HOUND_OF_ILL_OMEN`, `ACCURSED_SPECTER`, `FAITHFUL_SUMMONS`, each with evidence below. |
| 5. Prompt-contains tests | **Built** | New `tests/h1-teach-the-markers.test.js`, **123/123**: every taught line is in the assembled prompt and survives lean mode; every taught example passes the real marker validator; untaught markers appear nowhere; ATTUNE text is byte-identical; schemas are pinned. |
| 6. Live on gemma4:12b | **Built: 3 markers live-proved, the rest prompt-proved** | `SET_ROOM`, `COLD_SCENE` and `COLD_WET` fired from the real model and the engine stored the results (output below). `GENERATE_DUNGEON` was not emitted in two attempts, so it is prompt-proved only, like every other marker not listed here. |
| 7. `:5173` by hand | **Not done by me; steps below, with a limit** | No browser tool in this session. Also, no screen shows rooms, stored dungeons, frost or wet status (searched `client/src`), so a hand check can only see the effects through the DM's narration. The direct proof is the live probe. |

## Item 1 — the survey

### Audit evidence against live bytes (audit line numbers were from `6084b18`)
All the audit's handler locations still hold, with drift only in the artificer lines:

| Location | Audit | Live |
|---|---|---|
| `dungeonGenerationService.js` | `:245` | `:245` |
| `sceneLinkService.js` | `:169` | `:169` |
| `timeEvolutionService.js` | `:296` | `:296` |
| `coldExposureService.js` | `:568` / `:505-509` | `:568` / `:505-510` |
| `displayService.js` | `:450` | `:450` |
| `subclassMarkerService.js` | `:369-450` region | `:369-754` |
| `artificerService.js` | `:684` | `:686` |

None of the 21 markers on the audit's list appeared in any prompt text before this job. Searched: `dmPromptBuilder.js`, every subclass `prompt:` string under `server/data/subclasses`, and every system note. The exceptions were `LAIR_ACTION` and the artificer markers already in the combat-features line, which are not on the list.

### Marker inventory
Schema = `server/services/markerSchemas.js` line; `*` = required field. "Prompt before" means before this job.

| Marker | Schema | Handler | What the handler does | Prompt before | Now |
|---|---|---|---|---|---|
| `GENERATE_DUNGEON` | :388 — Name\* Purpose Region SiteEra Location Justification RoomCount | `dungeonGenerationService.js:245` | Builds and stores a dungeon (seed → skeleton → content → storage) with a world-day time anchor; returns an existing one rather than overwriting; refuses a coherence-flagged place without Justification. Never places the party. | nowhere | **taught** (without `Location`: the DM never sees location ids) |
| `SET_ROOM` | :370 — Scene Room Name Features Exits | `sceneLinkService.js:169` | Needs an active fight. `Name=` form creates a simple room (name, features, exits) and links the fight to it; `Scene=`+`Room=` links an existing room. | nowhere | **taught, name form only** |
| `EVOLVE_PLACE` | :404 — Scene\* + 12 optional | `timeEvolutionService.js:296` | Applies a time-driven change to a stored place, with anomaly checks. | nowhere | **still-open**: needs a scene id the DM never sees |
| `COLD_SCENE` | :791 — BaseLevel Campfire InsulatedTent Blizzard MagicalBlizzard Elevation ForceGoliath | `coldExposureService.js:568` | Stores the session's cold scene. Every later time advance or rest runs hourly CON saves (DC 10 + Cold Level); failures add Frost Exhaustion. | nowhere | **taught** |
| `COLD_WET` | :803 — Target\* Status\*(dry/wet/soaked) | `coldExposureService.js:573` | Sets the PC's or a companion's wet status (Target must be "Player" or an exact full name). | nowhere | **taught** |
| `LAIR_CREATE` | :1578 — Lair\* Name MaxHp Features Exits Scene Room | `lairDurabilityService.js:621` | Creates a lair structure record (default 1000 HP). | nowhere | **taught** (without Scene/Room) |
| `LAIR_DAMAGE` | :1590 — Lair\* Amount\* Source | `lairDurabilityService.js:661` | Damages the structure. | nowhere | **taught** |
| `LAIR_STABILIZE` | :1598 — Lair\* Method\*(magic/mechanical) Amount | `lairDurabilityService.js:669` | Magic halts decay; mechanical restores HP. | nowhere | **taught** |
| `LAIR_HAZARD_ROLL` | :1606 — Lair\* | `lairDurabilityService.js:686` | Manual, consequence-free hazard roll. | nowhere | **taught** |
| `LAIR_ACTION` | :1542 — Lair\* Effect\* | `combatMarkerService.js:447` | Fires a lair action. | **already taught** (combat line) | unchanged |
| `ENEMY_DISPLAY` | :331 — Enemy\* Spell\* Level Target\* Intimidate Dc Beside Features | `displayService.js:450` | A real enemy cast at a spot: spends slot and action; the engine rolls placement and posts a SPELL NOTICE for the DM. | nowhere | **taught** |
| `HEROIC_REROLL` | :453 — Target | `subclassMarkerService.js:369` | See reconciliation. | nowhere | **still-open** |
| `BEND_LUCK` | :1202 — Target\* Roll\* Direction\* | `subclassMarkerService.js:382` | See reconciliation. | nowhere | **still-open** |
| `TIDES_OF_CHAOS` | :1210 — Target\* | `subclassMarkerService.js:423` | See reconciliation. | nowhere | **still-open** |
| `PRESERVE_LIFE` | :1216 — Target\* Allocations\* | `subclassMarkerService.js:455` | Spends Channel Divinity; validates Bloodied and the pool; applies real healing (PC through `applyHpChange`). | nowhere | **taught** |
| `TAMED_SURGE` | :1223 — Target\* Row\* | `subclassMarkerService.js:521` | See reconciliation. | nowhere | **still-open** |
| `TELEPATHIC_SPEECH` | :1230 — Target\* Creature\* | `subclassMarkerService.js:565` | Records the telepathic link and its range. | nowhere | **taught** |
| `AWAKENED_MIND` | :1237 — Target\* Creature\* | `subclassMarkerService.js:605` | Records the link, range and duration. | nowhere | **taught** |
| `HOUND_OF_ILL_OMEN` | :1244 — Target\* Creature\* | `subclassMarkerService.js:651` | See reconciliation. | nowhere | **still-open** |
| `ACCURSED_SPECTER` | :1251 — Target\* Slain | `subclassMarkerService.js:705` | See reconciliation. | nowhere | **still-open** |
| `FAITHFUL_SUMMONS` | :1258 — Target\* Beasts\* | `subclassMarkerService.js:754` | See reconciliation. | nowhere | **still-open** |
| `ARTIFICER_REPLACE_PLAN` | :1298 — Target Old\* Plan\* Detail | `artificerService.js:686` | Replaces a known plan; items from the old plan vanish. | nowhere | **taught** |
| `ARTIFICER_ATTUNE` | :1316 — Target Item\* | `artificerService.js:706` | Attunes a created or other item under the artificer cap. | nowhere (only `Attune="true"` on create) | **taught** |
| `ARTIFICER_RIGHT_TOOL` | :1346 — Target Tool\* | `artificerService.js:732` | Records the set of tools made (level 3+). | nowhere | **taught** |
| `ARTIFICER_RELEASE` | :1386 — Target Turn\* | `artificerService.js:766` | Spends one use of the Spell-Storing Item, once per holder turn. | nowhere | **taught** |
| `ATTUNE` / `UNATTUNE` | :1272 / :1279 — Target Item\* | `attunementService.js:300 / :307` | General attunement under the computed cap. | **nowhere** (line built, never called) | **taught** (text byte-identical) |

Every marker above has both a schema and a registered handler, and every handler's service is imported by the turn route. No marker on the list is missing either.

### Class-audit reconciliation (feature markers)
| Feature marker | Verdict | Evidence |
|---|---|---|
| `PRESERVE_LIFE` (Life Domain 3) | **Taught** | Spends Channel Divinity and checks Bloodied, the 5 × level pool and the half-maximum cap. Healing really lands on the PC (`applyHpChange`) and on companions; the result shows on the HP bars. Covered by `mechanics-hooks-markers`. |
| `TELEPATHIC_SPEECH` (Aberrant Sorcery 3) | **Taught** | Records the link and its range. The feature is a narrative one: the conversation is the DM's to voice, so the marker promises nothing the engine can't do. |
| `AWAKENED_MIND` (Great Old One 3) | **Taught** | Same as above, plus duration. |
| `ARTIFICER_REPLACE_PLAN` / `_ATTUNE` / `_RIGHT_TOOL` / `_RELEASE` | **Taught** | The functions are unit-tested in `artificer-class`. The state each one changes is shown back to the DM every turn in the artificer section of the character block. |
| `HEROIC_REROLL` | **Still-open** | Three defects. **(1)** A pending player roll is deleted the moment its number is resolved (`rollRequestService.js:508`), so by the time the DM could emit the marker there is nothing left to reroll; the "reroll available" flag is returned to the route but never shown on any screen. **(2)** The handler reads `parsed.fields?.Target` (`subclassMarkerService.js:370`) where every other handler reads `parsed.Target`, so Target is always empty. **(3)** It passes the target as a third argument that `requestHeroicReroll(sessionId, previousOutcome)` doesn't take (`:372` vs `rollRequestService.js:348`), so the promised companion reroll never happens. |
| `BEND_LUCK` (Wild Magic 6) | **Still-open** | Spends the sorcery point and rolls the d4, but the d4 is only in the handler's result note (`:411-414`), which never reaches the DM, and nothing applies it to the roll. The service header calls the roll hook "a named follow-up". |
| `TIDES_OF_CHAOS` (Wild Magic 3) | **Still-open** | Writes `tidesOfChaos.advantagePending` into class resources (`:440`), and nothing in the roll system reads it, so the advantage never applies. The surge-restore path reads a different flag (`session_config.tidesOfChaosSpent`, `spellCastService.js:533`), so the two never meet. |
| `TAMED_SURGE` (Wild Magic 18) | **Still-open** | Spends the once-per-long-rest use and stores the chosen row (`:549`), but no caller passes that choice to the surge roller. `tamedSurgeRow` is accepted by `wildMagicService.js:274`, and nothing ever supplies it. |
| `HOUND_OF_ILL_OMEN` (Shadow Magic 6) | **Still-open** | Spends 3 sorcery points and creates a `combat_allies` row. Nothing in combat, the turn order or the prompt reads that table (only `entityService.js` and the marker service touch it), so the hound can't act or be targeted, and its save disadvantage is never applied. |
| `ACCURSED_SPECTER` (Hexblade 6) | **Still-open** | Same: a row nothing reads. |
| `FAITHFUL_SUMMONS` (Shepherd 14) | **Still-open** | Same: rows nothing reads. |

### Lean-mode placement (and why)
`applyLeanTransforms` (`dmPromptBuilder.js`) replaces everything from the "MECHANICAL MARKERS" header to "END OF CORE RULES" with a "markers are disabled" notice. Lean mode is a diagnostic switch, on only when a browser has `dndLeanPrompt=1` in local storage (`DMSession.jsx:616`). Placement:
- **World / scene / lair / display lines:** a new section, `formatWorldMarkers()` (`dmPromptBuilder.js:2158`), placed right after the HP rules and ahead of MECHANICAL MARKERS. That is the same trick that keeps `HP_CHANGE` alive in lean mode.
- **Class-feature lines:** on the per-subclass feature lines (`subclassService.js:1331`, `FEATURE_MARKER_LINES`). They sit after "END OF CORE RULES", outside the strip, and appear only for an actor who has the feature at their level.
- **Artificer lines:** on the artificer section of the character block, the same place as the existing `ARTIFICER_FLASH` line.
- **Attunement line:** on the character block (`dmPromptBuilder.js:324`).
- **Lean notice:** the replacement text now also says these stay live, so the DM isn't told "all markers are off" while seeing them.

Tests prove every taught line survives lean mode.

## Files changed
| File | New / edited | SHA-256 | Bytes |
|---|---|---|---|
| `server/services/dmPromptBuilder.js` | edited | `9e55c3436ca656890e7faeacda617d52fcae9b51ff81e8222dc9d6559816cdca` | 194,691 |
| `server/services/subclassService.js` | edited | `a686ba066d20a33295f5e5ac6d6cae70fd15005819847f04cfdbd61af9d6981e` | 67,257 |
| `server/services/artificerService.js` | edited (prompt-section text only) | `5955ea76625ae09b3bab2e41c35444c8cad71f733f93cd8f91ca6fac4cd83805` | 40,344 |
| `server/services/attunementService.js` | edited (one comment) | `da75b7a6cb334c2a8e04b604846c2ce4b0442f27de543db7a6d72746a9f48f2e` | 15,508 |
| `server/services/markerSchemas.js` | edited (one comment; no schema change) | `7ad77396f8e2e63b27db3b30feb754451bd68ddda8ddda2cb8617a40e043ec8d` | 63,871 |
| `tests/h1-teach-the-markers.test.js` | new | `124e9e25ff997d49877c29e7b8170312cf0d88510802230b6329b230d75769c6` | 13,872 |
| `docs/pm/h1-teach-the-markers/BRIEF.md` | new | `18967590947b98f0e4d9c5659802af8676a5246a8737d38bd28ac6bc2bd09c0e` | 12,458 |
| `package.json` | edited | `a4315ab3ef8e7a6e997966b26afcc54d0fc854fbe96f30ef2817ccc549ac04ed` | 1,398 |
| `client/package.json` | edited | `0fb39a951219478f33d66ddce51c6b78744514f19dc70e3124d01f21074fd4c8` | 427 |

- **No handler, schema, marker-pipeline or route logic changed. No migration.** The two service files outside the prompt builder changed only in prompt text (artificer) or comments (attunement, marker schemas). The schema comment had said "the DM prompt does not yet teach these markers", which was no longer true.
- **Prompt size:** the always-on world section adds about 3,000 characters. A plain fighter's assembled prompt is about 54,000 characters.

## What was built (in play)
- **Fights in named places:** when a fight breaks out in a named place (a tavern common room, a guard post), the DM now records the room: its features, cover and exits. The engine's cover checks, display casting and room hazards then read it. Live, the DM did exactly that for a tavern brawl.
- **Cold:** walking into freezing country makes the DM set a cold scene. From then on every hour of travel or rest makes the party roll against the cold, and failures build Frost Exhaustion. Falling into water is recorded as wet or soaked. Live, a hero marching through the Spine of the World took two levels of Frost Exhaustion and was soaked after falling through the ice.
- **Dungeons:** the DM knows it can create and store a dungeon when its world places one. The player can't summon one, and the party is never dropped inside.
- **Lairs:** in a fight in a lair that can come down, the DM can create the structure, damage it, shore it up, and roll for hazards.
- **Enemy displays:** an enemy can throw a real spell at the floor as a threat; the engine rolls how it lands and tells the DM next turn.
- **Class features:**
  - a Life Domain cleric's Preserve Life heals for real;
  - an Aberrant sorcerer's or Great Old One warlock's telepathy is recorded;
  - an artificer can replace plans, attune items, record their Right Tool, and use a Spell-Storing Item through markers;
  - every non-artificer's attunement slots now show in the DM's view of the character, with how to attune.
- **Unchanged:** the features that don't work yet (Bend Luck, Tides of Chaos, Tamed Surge, Heroic Inspiration rerolls, and the three summoned creatures) are not taught, so the DM won't promise them.

## Test results
- **Full `npm test` on the PC, after all edits:** Files **249/249 green**, assertions **19,651 passed, 0 failed** (248 files before this job, plus the new `h1-teach-the-markers`). Windows note: `subclass-batch1` counted `pass*` (libSQL exit crash after all assertions passed).
- An earlier full run, before a one-line `COLD_WET` wording fix found live, was also 249/249 green (19,653 assertions; the runner's count varies by which files crash after passing).
- **New suite `h1-teach-the-markers`, 123/123:**
  - (a)+(b) each of the 9 taught world/lair/display markers is in the assembled prompt and survives lean mode. The settled rules are in the lines: DM-world dungeon trigger, never placing the party inside, Justification for unusual places, SET_ROOM after COMBAT_START, cold never softened, how to leave the cold. The section sits ahead of the stripped block; the lean notice names it; the HP_CHANGE exception and the already-taught `LAIR_ACTION` are unchanged.
  - (c) every taught example and variant passes the real `validateDmMarkers` with zero corrections.
  - (d) `PRESERVE_LIFE` appears for a Life cleric at L3 (not at L2, not for a fighter), and survives lean mode. `TELEPATHIC_SPEECH` and `AWAKENED_MIND` appear for companions with those subclasses.
  - (e) the 7 still-open feature markers and `EVOLVE_PLACE` appear in no prompt, for a Wild Magic L18, a Shadow Magic L6, a Hexblade L6, a Shepherd L14 and a fighter.
  - (f) the four artificer markers sit at the right levels and states, reach the assembled prompt, survive lean mode, and validate. An artificer is not shown the general ATTUNE line.
  - (g) the ATTUNE text is byte-identical, is now in the prompt, survives lean mode, and the cap comes from the engine (a level-13 Thief shows 4).
  - (h) the 16 relied-on schemas are pinned to the surveyed fields.
- **Touched suite:** `dm-prompt-builder` passes.
- **Static import check:** `server/` 1,889 named imports, **0 problems**.

## Live proof (item 6): real server, real model
The real `server/index.js` was booted against a throwaway database, with Ollama and gemma4:12b running. Scripts `h1-probe.mjs` and `h1-probe2.mjs` are in the session scratchpad; each stopped only its own child process.

**The assembled prompt the model received** (read back from `ai_call_log.system_prompt`; 58,921 characters; lines cut at 200 characters here):
```
WORLD, SCENE & LAIR MARKERS
INLINE, the moment the trigger happens. The engine does the work; never narrate its numbers yourself.
[GENERATE_DUNGEON: Name="Sunken Temple" Purpose="rescue" Region="Sword Coast" SiteEra="sealed"] — when YOUR world places a dungeon the party may find. Never because the player asks for one. It build…
[SET_ROOM: Name="Tavern common room" Features="Bar:cover_half:half, Fireplace:flammable" Exits="North:street"] — right after COMBAT_START when the fight is in a named room, and again if the fight mo…
[COLD_SCENE: BaseLevel=2] — when the party enters freezing country. BaseLevel is the place's Cold Level: every exposed hour is a CON save at DC 10 + Cold Level, and failures add Frost Exhaustion. Ad…
[COLD_WET: Target="Player" Status="wet"] — a character gets wet in the cold …
Lair structure (a fight in a lair that can come down around them):
[LAIR_CREATE: Lair="dragon-lair" Name="The Dragon's Lair" Features="Pillars:cover_half, Lava vent:hazard_zone"] — once, when that fight begins. …
[LAIR_DAMAGE: Lair="dragon-lair" Amount=40 Source="the fireball strikes the pillars"] — when an effect hits the structure itself …
[LAIR_STABILIZE: Lair="dragon-lair" Method="magic"] halts the decay; Method="mechanical" (shoring, rebuilding) restores the structure.
[LAIR_HAZARD_ROLL: Lair="dragon-lair"] — test whether the failing structure threatens this round (foreshadowing; it hurts no one).
[ENEMY_DISPLAY: Enemy="Mage" Spell="Fireball" Target="the floor beside Lyra" Beside="Lyra"] — in combat, an enemy casts a real spell at a spot …
attunement line: - Attunement: Attuned 0/3 — nothing attuned. Attune/unattune with [ATTUNE: Target="Name" Item="Item name"] / [UNATTUNE: Target="Name" Item="Item name"]; over-cap attunement is refused.
```

**Probe 1 (port 3080), a level-3 Fighter in Luskan. Verbatim:**
```
turn: "I am drinking in the Cutlass tavern common room when two dockside thugs draw knives and attack me. I draw my sword and fight."
  HTTP 200 3.0 s
  watched markers emitted: [COMBAT_START: Enemies="Thug 1 (HP 12, AC 13, ATK +4, DMG 1d6+2), Thug 2 (HP 12, AC 13, ATK +4, DMG 1d6+2)"] [SET_ROOM: Name="Cutlass Tavern Common Room" Features="Bar:cover_half:half, Fireplace:flammable" Exits="North:street"]
turn: "The fight is over. I leave Luskan and march north into the frozen mountain passes of the Spine of the World — snow, ice and bitter wind. I walk for four hours."
  watched markers emitted: [TIME_ADVANCE: Hours=4 …] [COLD_SCENE: BaseLevel=3] [COLD_WET: Target="TEST_H1" Status="wet"]
turn: "I keep climbing through the snow for another three hours."
  watched markers emitted: [TIME_ADVANCE: Hours=3 …]
turn: "At a lonely shepherd hut I ask the old goatherd whether there are any old ruins or caves in these mountains that people avoid."
  watched markers emitted: (none)
--- what the engine stored ---
encounter room links: [{"encounter_seq":1,"scene_id":1,"room_key":"cutlass-tavern-common-room","name":"Cutlass Tavern Common Room","kind":"room"}]
scene rooms: [{"scene_id":1,"room_key":"cutlass-tavern-common-room","label":"Cutlass Tavern Common Room","features_json":"[{\"name\":\"Bar\",\"kind\":\"cover_half\",\"coverTier\":\"half\",\"acBonus\":2},{\"name\":\"Fireplace\",\"kind\":\"flammable\"}]","exits_json":"[{\"direction\":\"North\",\"roomKey\":\"street\"}]"}]
session coldScene: {"baseColdLevel":3, … }
character cold columns: {"frost_exhaustion":2,"cold_wet_status":"dry"}
```

**Probe 2 (port 3081), after tightening the COLD_WET wording:**
```
turn: "I leave Luskan and march north into the frozen mountain passes … I walk for two hours."
  watched markers emitted: [TIME_ADVANCE: Hours=2 …] [COLD_SCENE: BaseLevel=3] [COLD_WET: Target="Player" Status="wet"]
turn: "Crossing a frozen stream, the ice breaks and I plunge in up to my chest. I haul myself out, soaked to the skin, and keep walking for another hour."
  watched markers emitted: [COLD_WET: Target="Player" Status="soaked"] [TIME_ADVANCE: Hours=1 …]
turn: "Later, as night falls, the goatherd I met earlier points up at a dark cleft in the mountainside and says something old lies sealed in there. I make camp below it."
  watched markers emitted: [REST: Type=short]
character cold columns: {"frost_exhaustion":2,"cold_wet_status":"soaked"}
```

What the two probes show:
- **`SET_ROOM` live-proved end to end.** The real DM emitted it right after `COMBAT_START`, and the engine created the room record and linked the fight to it.
- **`COLD_SCENE` live-proved.** The cold took hold, and the following hours cost Frost Exhaustion. In the turn where the cold scene was set, that same reply's time advance ran first and carried no exposure, as the line warns ("from then on").
- **`COLD_WET` live-proved after a fix.** In probe 1 the model wrote a partial name (`Target="TEST_H1"`), and the handler accepts only "Player" or an exact full name, so nothing was stored. The line now says so explicitly ("Target is the word Player for the player character, or a companion's exact full name"). In probe 2 the model used `Target="Player"` and the soaked status was stored.
- **`GENERATE_DUNGEON` not emitted** in two tries, so it is prompt-proved only. In the second try the player had invented the sealed place, and the DM's restraint matches "never because the player asks". A natural trigger is the DM's own world placing a ruin, which a short scripted probe can't force.
- **Every other taught marker is prompt-proved only:** lairs, `ENEMY_DISPLAY`, the feature and artificer markers, and attunement.
- **Side observation, outside this job:** the model answered "I make camp" with a short rest instead of a long one.

## Not done / still open
- **`EVOLVE_PLACE`:** not taught. It needs a scene id the DM never sees, and an invented id would change the wrong place. It becomes teachable once scene ids reach the DM (next item).
- **Marker results never reach the DM** for `GENERATE_DUNGEON`, `SET_ROOM`, `EVOLVE_PLACE` and the lair markers (Understanding 1). Fixing it is a route change: forward these markers' result and refusal notes the way combat and cover already are, and tell the DM the new scene id / room keys. It needs its own brief; it is also what unblocks `EVOLVE_PLACE`, the `Scene=`/`Room=` forms, and automatic lair hazards (the per-round tick needs a lair linked to a known room).
- **Seven class-feature markers stay untaught,** still-open for severe-seven with the evidence above: `HEROIC_REROLL`, `BEND_LUCK`, `TIDES_OF_CHAOS`, `TAMED_SURGE`, `HOUND_OF_ILL_OMEN`, `ACCURSED_SPECTER`, `FAITHFUL_SUMMONS`.
- **No way to end a cold scene.** Nothing in production clears one (`clearColdScene` has no caller). The taught exit, `[COLD_SCENE: BaseLevel=-10]`, uses the engine's own rule that a Cold Level below 0 means not exposed. It works, but a proper "leave the cold" marker would be cleaner; flagged for Muse.
- **Invisible to the player:** no screen shows rooms, stored dungeons, frost or wet status (searched `client/src`). The DM narrates them, but the player can't check them.
- **`:5173` click-through:** not done by me; there is no browser tool in this session. Steps below.
- **Cost and usage against the $30/month cap:** not measurable from inside the session.

## Decisions made (reversible, for veto)
1. **`EVOLVE_PLACE` and the `Scene=`/`Room=` forms left untaught**, because they need an id the DM can't know. Reversal: add one line to `formatWorldMarkers` once scene ids reach the DM.
2. **The general `ATTUNE` line wired into the character block** (fix-as-you-find-it, text byte-identical). Artificers get only their own `ARTIFICER_ATTUNE` line. Reversal: remove the `attunementSection` block (about 12 lines).
3. **`TELEPATHIC_SPEECH` / `AWAKENED_MIND` taught** although nothing reads the link they record. The feature is narrative and the marker promises nothing impossible. Reversal: delete two entries from `FEATURE_MARKER_LINES`.
4. **Leaving the cold taught as `[COLD_SCENE: BaseLevel=-10]`** (any negative level means not exposed under the engine's rule). Reversal: drop the sentence; the cold would then never end in a session.
5. **One always-on world section** rather than per-condition blocks, since gemma needs to know these exist before the trigger happens. It costs about 3,000 characters. Reversal: gate it on a session flag (small).
6. **Lean-mode notice extended** to name what stays live. Reversal: one string.
7. **Right Tool line shown from artificer level 3 on**, even before a tool is recorded ("none made"), so the marker is taught. Before, the line appeared only after a tool existed. Reversal: one condition.
8. **Version bump to 1.0.203.** Reversal: two lines.

## Needs Zach's decision
None for this job. Zach's part is the gate. Muse to scope: the marker-result feedback route, a "leave the cold" marker, and showing rooms/cold on a screen.

## How to verify
**Gate:** `npm test` on the PC (expect 249 files green).

**At `:5173` (never `:3000`), with `npm run dev`.** These checks are indirect, through the DM's narration, because no screen shows rooms, dungeons or cold (see "Not done").
1. Use a campaign character. Start a session in a town.
2. **Room:** type "I'm drinking in the tavern common room when two thugs draw knives and attack me. I fight."
   - **Look for:** the fight starts, and the DM can describe cover at the bar. Then type "I duck behind the bar for cover": the cover should be accepted, because the room now has a bar with half cover.
   - The room record itself isn't shown on screen; the live probe above is the direct proof.
3. **Cold:** after the fight, type "I leave town and march north into frozen mountain passes — snow and bitter wind — for four hours", then "I keep climbing for another three hours."
   - **Look for:** the DM's narration after the second turn mentions the cold wearing you down (Frost Exhaustion).
4. **Wet:** type "The ice breaks and I fall into a frozen stream, soaked through. I keep walking for an hour."
   - **Look for:** the DM's narration treats you as soaked and the cold as harsher.
5. **Dungeon:** keep exploring wilderness. Let the DM's own world offer a ruin or cave; don't ask for one by name.
   - **Look for:** a stored dungeon can't be seen on screen. This check stays prompt-proved unless you happen to catch it in play.
