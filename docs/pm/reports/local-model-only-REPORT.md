# Report — local-model-only: gemma4:12b runs the whole game, Claude comes out

## Understanding
**The project.** DnD Meta Game is a solo D&D 2024 "forever game". One player plays one character, and an AI runs the DM, NPCs, companions and enemies in a persistent Forgotten Realms world. The server owns the rules; the AI narrates. The MVP is the Embervale test campaign.

**This job.** Make the whole game run on the local model, gemma4:12b through Ollama on the PC, and take Claude out entirely (Zach, 2026-11-13: "The only Claude on the system is you building it"). That means:
- one place that names the models, per role;
- no Claude code, settings or screen text left;
- every feature moved onto the local model;
- the context budgets re-based on the real window;
- measuring the prompt size, structured-output reliability and turn speed;
- tests that need no network;
- running the secret-holding leak test as the acceptance check.

**Where I departed from the brief, stated first:**
1. **Zach overrode Decision 1 before the build.**
   - The brief said DM Mode, Prelude and NPC mail should get *no AI* and refuse until their phase.
   - Zach had answered the proposal the other way ("They should move to the offline gemma model, yes"; the proposal was updated in commit `c5097b7`, after the brief was written from `3e4617e`).
   - I asked him directly before building. His answer: **"Port to gemma4:12b."** So item 4 is built as *port*, not *refuse*. There are no refusal messages, because nothing refuses; every post-MVP feature runs on the local model.
2. **The leak test fails** (0 of 3 runs, item 7). Per the brief this is a finding, not a build failure. Nothing was changed to make it pass.
3. **A pre-existing bug blocked every session start.** The `dm_sessions` INSERT in `POST /api/dm-session/start` bound 12 values to 11 columns (`SQLITE_ERROR: 12 values for 11 columns`), so **no DM session could start at all**.
   - It is identical at HEAD before this job, and the suite never exercised `/start` through the route. The first live run of this job found it.
   - Fixed as fix-as-you-find (same file, and it blocked this job's verification), with a new regression test.
4. **There is no knowledge-flag system for NPC secrets** (brief item 7 says "knowledge flags as the system holds them"). An NPC secret reaches the DM only as the `npcs.secret` field, rendered in the DM prompt as `Secret (reveal gradually if appropriate): …`. The leak test uses exactly that, because it is how the system holds a secret. The queued knowledge-ignorance job is where real knowledge flags would come from.

## Verdict
**BUILT + GREEN** on the builder's run (Files 246/246 green, assertions 19,598 passed, 0 failed). The acceptance leak test **FAILS (0/3)**; that is a finding the PM decides on. Zach's PC run is the gate; not claimed.

## Item 0 — inventory, against the proposal and the PM's spot-check
| What | PM spot-check / proposal | Found in the live tree |
|---|---|---|
| `gpt-oss:20b` hard-coded in `server/` | 7 places, 3 files | **Confirmed: 7 lines in 3 files** (`llmClient.js` ×3 incl. 2 comments, `adventureGenerator.js` ×2, `dmSession.js` ×2) |
| Files importing the Claude client / an Anthropic SDK | 20 (19 services + `contextManager.js`), plus routes | **25 files**: 20 services/utils + `routes/dmSession.js`, `routes/dmMode.js`, `routes/character.js` (a dynamic `import()`), `aiCallLogger.js` (a dynamic `import()`) and the dev script `server/test-prompt.js`. `prelude.js` imported nothing from Claude; it only parsed `'sonnet'/'opus'` model names. **There is no Anthropic SDK**: `claude.js` called the API with raw `fetch`. |
| "22 call Claude; 12 with no local path" (proposal) | | Of the 22 importing services/routes, **13 had no local path** (the proposal's 12 missed `routes/dmMode.js`, which had a canned stand-in for one call but none for turns) |
| Client files mentioning Claude/Anthropic/Opus/Sonnet | 11 (12 with model names) | **12 files**. Provider UI: `App.jsx`, `DMSession.jsx`, `SessionSetup.jsx`, `PreludeSession.jsx`. Text only: `PreludeArcPreview.jsx`, `CampaignPlanPage.jsx`, `DMMode.jsx`. Comments only: `creator/HomeFlow.jsx`, `config/mvpFeatures.js`. Not provider references: `creatorPrimitives.jsx`, `raceDemographics.js` (they mention the `CLAUDE.md` file), `keeperTexts.js` ("magnum opus") |
| Tests using `llmHarness.js` | 5 (proposal said 7) | **5**: `turn-e2e`, `session-end-world-tick`, `hybrid-combat-dice`, `claude-request-shape`, `chronicle-rollup`. The proposal's 7 counted two files that only mention the key |
| `server/utils/llmJson.js` | exists | **Confirmed** |
| `modelRegistry.js` consumers | `index.js`, `dmSession.js`, `claude.js`, `preludeArcService.js` | **Confirmed**, plus 4 tests (`claude-request-shape`, `context-bounds`, `model-registry`, `turn-e2e`) |
| Settings UI that edits model pins | | **Yes**: `SessionSetup.jsx` "Models" button → `GET /api/dm-session/model-catalog` and `POST /model-pins`. Both endpoints and the UI are deleted. **Stored pins:** any `model_pin_opus` / `model_pin_sonnet` rows already in `_app_settings` stay as inert rows that nothing reads. Removing them would need a migration, which the brief says to ask about first, and they cost nothing. The PC has no game database, so none exist here. |
| `aiCallLogger.js` wrappers | `wrapClaudeCall`, `loggedChat` | **Confirmed**, plus `wrapClaudeCallWithId`. All now local (item 3) |

**Every call site and its classification.** All of them now run on the local model. The MVP column follows the scope lock; post-MVP sites are ported too, per Zach's override.

| Call purpose (as logged) | File | Role | MVP? |
|---|---|---|---|
| `session_start`, `gameplay_turn` | `routes/dmSession.js` | dm | MVP |
| `dm_rest_check` (rest narration) | `routes/dmSession.js` | dm | MVP |
| `dm_session_recap` | `routes/dmSession.js` | summary | MVP |
| `dm_session_analysis`, `session_end_xp_scoring`, `dm_session_notes_extract`, `dm_session_npc_extract`, `dm_session_memory_extract`, `dm_session_npc_codex_extract`, `dm_session_npc_extract_alt` | `routes/dmSession.js` | extraction | MVP |
| `npc_agenda_backfill` | `routes/dmSession.js` | generation | MVP |
| `chronicle_extraction` / `chronicle_rollup` | `services/storyChronicleService.js` | extraction / summary | MVP (memory) |
| `rolling_summary_update` | `services/rollingSummaryService.js` | summary | MVP |
| `context_compression` | `utils/contextManager.js` | summary | MVP |
| `companion_activity_gen` | `services/companionActivityService.js` | generation (non-AI fallback kept) | MVP (companions) |
| `companion_backstory_gen` | `services/companionBackstoryGenerator.js` | generation | MVP (companions) |
| `quest_gen` | `services/questGenerator.js` | generation | MVP (quests) |
| `location_gen` | `services/locationGenerator.js` | generation | MVP |
| `npc_voice_extraction` | `services/npcVoiceService.js` | generation | MVP (roleplay) |
| `backstory_parse` | `services/backstoryParserService.js` | extraction | MVP (create) |
| `character_notes_gen` | `routes/character.js` | extraction | MVP |
| `campaign_plan_gen` | `services/campaignPlanService.js` | generation | Not MVP-critical (Decision 2; Embervale is authored data) |
| `living_world_gen` | `services/livingWorldGenerator.js` | generation | post-MVP (world tick is off) |
| `adventure_gen` | `services/adventureGenerator.js` | generation | post-MVP (time-skip adventures) |
| `npc_mail_gen` | `services/npcMailService.js` | generation | post-MVP (tick) |
| `dm_mode_*` (session start, turn, roll reaction, summary) | `routes/dmMode.js` | dm / summary | post-MVP (DM Mode) |
| `dm_mode_party_gen`, `dm_coaching_tip` | `partyGeneratorService.js`, `dmCoachingService.js` | generation | post-MVP |
| `dm_mode_chronicle_extraction`, `dm_mode_relationship_evolution`, `dm_mode_npc_voice_extraction` | `dmModeChronicleService.js`, `dmModeNpcService.js` | extraction | post-MVP |
| `prelude_session_start`, `prelude_turn`, `prelude_turn_retry_rule2` | `services/preludeSessionService.js` | dm | post-MVP (prologue) |
| `prelude_chapter_recap` | `services/preludeSessionService.js` | summary | post-MVP |
| `prelude_arc_plan_gen` | `services/preludeArcService.js` | generation | post-MVP |
| `prelude_handoff_biography_gen` | `services/preludeTransitionService.js` | generation | post-MVP |

## Item 1 — the registry: one place names the models
`server/services/localModels.js` (new). `gemma4:12b` appears in `server/` only here.

| Role | Used for | Setting (overrides `OLLAMA_MODEL`, which overrides the default) |
|---|---|---|
| `dm` | narrative turns: DM sessions, DM Mode, Prelude, rest narration | `OLLAMA_MODEL_DM` |
| `summary` | recaps, rolling summary, compression, chronicle rollup | `OLLAMA_MODEL_SUMMARY` |
| `extraction` | chronicles, notes, NPCs, memories, XP scoring, analysis, backstory parse | `OLLAMA_MODEL_EXTRACTION` |
| `generation` | plans, quests, locations, companions, parties, voices, letters, arcs | `OLLAMA_MODEL_GENERATION` |

Also in the registry: `OLLAMA_URL` (default `http://localhost:11434`), `OLLAMA_NUM_CTX` (default **65,536**), and `OLLAMA_THINK` (default off). Accessors read `process.env` at call time. An unknown role throws. The `_app_settings` pin hydration, the Anthropic staleness check at boot, and the model-catalogue and model-pin endpoints are gone. Startup now logs whether Ollama is ready and which model each role uses.

## Item 2 — the Claude path, removed
**Deleted:**
- `server/services/claude.js`, `server/services/modelRegistry.js`;
- `server/services/llmClient.js` and `server/services/ollama.js` (the old Ollama fallback, merged into the new client);
- `server/test-prompt.js` (a Claude-only dev script).

**Changed:**
- **`getLLMProvider()` and its `preference` parameter** are gone, along with every caller's `providerPreference` and `modelOverride`. Each route now checks `llm.checkStatus()`.
- **Client:** the provider picker, the Sonnet/Opus toggle (session setup, top status pill, in-session chip), the "Models" check-and-adopt panel, the Prelude model state, and every Claude/Opus/Sonnet string are removed. Session setup now shows "Local model (Ollama)" plus the DM's model and a re-check button. The top pill shows the DM model, green when ready. The "no AI" screen gives Ollama steps, not an API key.
- **Config and launch files:** `.env.example`'s Anthropic section is rewritten local-only, and the stale `JWT_SECRET` block is removed (sign-in was deleted in v1.0.173; nothing reads it). `start-windows.bat`'s first-run text now gives Ollama steps, not an API key.
- **Docs:** `CLAUDE.md`, `LLM_SETUP.md` and `README.md` are rewritten for the local model. `DM_MODE.md`, `COMPANIONS.md` and `PROJECT_BRIEF.md` had current-state lines saying Claude, including my own docs-cleanup notes from yesterday, which were true then; all are fixed.

## Item 3 + 4 — every feature on the local model
- **The client: `server/services/llm.js` (new).** Every call site moved to it, keeping the old argument order so each edit stayed small: the model argument became a role.
  - Request: the system prompt first, once, with the old prompt-cache markers stripped; `num_ctx` on every call; `num_predict` = the caller's ceiling; `think` off; `keep_alive: 30m`; the reply **streamed** and accumulated.
  - Errors: tagged `LOCAL_MODEL_UNAVAILABLE` (retried briefly on a connection error) or `LOCAL_MODEL_MISSING` (not retried). The turn and Prelude routes return a 503 whose message names the fix and keeps the player's input.
- **"Claude, else Ollama" branches collapsed** to the one local path in 15 places in `dmSession.js` and in five services (backstory parser, companion backstory, living world, location, quest). The adventure generator's separate raw Ollama call is gone too.
- **Chronicles + rollup:** extraction and summary roles. **Verified live**: a chronicle was written at session end (summary quoted under item 5).
- **Campaign plan:** generation role, no quality gate (Decision 2). Not run live in this job; see Not done.
- **Context compression and budgets:** re-based on the real window.

  | Number | Before | Now |
  |---|---|---|
  | Context window | 1,000,000 (and "any gemma" = 8,192) | **65,536** (`num_ctx`, sent on every call) |
  | Safe budget | 900,000 | **55,705** (85% of the window) |
  | Chronicle budget | `min(20,000, 40% of what's left)` | same rule, now applied to the real window |
  | Prompt-size warn / error | 60,000 / 100,000 | **32,768 / 49,152** (50% / 75% of the window) |

  With the measured ~14k-token DM prompt, the chronicle budget comes out around **12.7k tokens**.
- **Companion activities:** the local model first. The non-AI fallback outcomes stay for when Ollama can't be reached.
- **Call logging:** `wrapClaudeCall*` became `wrapLlmCall` / `wrapLlmCallWithId`, and `loggedChat` uses the local client. Every row records `model_id` and **`metadata.role`** (no migration), plus Ollama's real token counts (`prompt_eval_count`, `eval_count`).
- **Post-MVP (DM Mode, Prelude, NPC mail): ported,** per Zach's override.
  - Prelude's per-turn model picker is removed: Sonnet/Opus/auto, the Opus cap, and the five session-config fields that only fed it, which are cleared on old sessions.
  - DM Mode's canned stand-in opening (shown when there was no key) is removed; a down model now surfaces as an error.
  - **No refusal messages exist,** because none were built.
- **DM reply ceiling:** 16,000 → **4,000** tokens (`DM_MAX_TOKENS`). Claude's 16k had to cover its hidden thinking as well; with thinking off, the measured DM replies are 151–246 tokens.
- **Wording sweep:** model names (Opus/Sonnet/Claude) replaced with role wording in 32 server files' comments and in **8 lines of prompt text the model reads**. For example, the DM prompt said `=== CAMPAIGN PLAN (Generated by Claude Opus) ===`, and Prelude prompts told the arc model "Sonnet will fire…"; these now say "the session DM". Old migrations keep their comments, as a record of what each did when it ran.

## Item 5 — measurements (PC, 2026-11-14 final run, gemma4:12b, `num_ctx` 65,536)
All from one live run through the real game routes (`npm run test:leak`); the per-call numbers are read from `ai_call_log`.

1. **DM prompt size.**
   - The bare DM system prompt for a level-1 test character is **51,612 characters ≈ 12,903 tokens** by the budget code's own count (characters ÷ 4). I measured this separately, on 2026-11-13.
   - In the live sessions (with an NPC and a location) the system prompt was **13,520–14,384 tokens** estimated. **Ollama's real count** for a whole turn (system prompt + history) was **13,824–15,539 tokens** across 15 turns.
   - The window is 65,536, so the prompt uses about **22%**.
   - VRAM fit (`ollama ps` + `nvidia-smi`, measured 2026-11-13): 100% GPU at 16k, 32k and 64k; at 64k, 10.9 GB of 16.3 GB used; at 128k still 100% GPU, 11.6 GB. The model's own limit is 262,144.
2. **Structured output** (the real game path; markers counted by the game's own pipeline in `ai_call_log`):

   | Scripted turn | Expected marker | Result |
   |---|---|---|
   | Ask the shopkeeper what she sells | `MERCHANT_SHOP` | **PASS** (1, no failures) |
   | Wait two hours by the road | `TIME_ADVANCE` | **PASS** |
   | Bandits attack, draw sword | `COMBAT_START` | **PASS** |
   | Search the fallen bandits | `LOOT_DROP` | **PASS** (2 drops + `COMBAT_END`) |
   | Eat a ration | `EAT` | **PASS** |
   | Long rest | `REST` | **PASS** (+ `TIME_ADVANCE`) |

   - **6/6 pass; 9 markers emitted, 0 malformed.** (An earlier run the day before: also 6/6, 10 markers, 0 malformed.)
   - **Chronicle extraction** (JSON through `llmJson.js`): **parsed and written**. Its summary: "The adventure begins at the Ashford crossroads, a muddy hub of trade and travel. The player initially observes a distressed wagon driver whose axle had snapped and a mysterious dark liquid was leaking from his crates. After checking the local general store run by a stern woman named Rosamund, the player spent two hours watching the crossroads. This wait was interrupted by the arrival of a wounded rider who fled from an unknown threat in the eastern woods. Two bandits emerged from the treeline to finish him off, but the player intervened, engaging in a swift combat and slaying both attackers. Following the victory, the player looted the bandits, finding a pouch of silver and a leather satchel. The player then spent the remainder of the day tending to the area, consuming rations, and taking a long rest in a nearby hollow. The session concludes at dawn, with the player fully rested and the wounded rider still nearby."
   - All five other session-end extraction calls returned `ok`.
3. **Response time** (15 DM turns):

   | What | Time |
   |---|---|
   | DM turn, model time (`ai_call_log.latency_ms`) | **1.7–3.1 s** |
   | DM turn, end to end (HTTP round trip, includes Ollama) | **2.0–3.6 s** |
   | Session opening | **7.9–15.1 s** |
   | Session end with all extraction (6 model calls, incl. an 8.7 s chronicle) | **16.4 s** |
   | Cold first load of the model from disk | **225 s**, once; later loads ~5.5 s (measured 2026-11-13) |

No prompt was trimmed (out of scope). The numbers say the prompt fits comfortably.

## Item 6 — tests
- **`tests/helpers/llmHarness.js` now intercepts Ollama** (`/api/tags` → every required model; `/api/chat` → one NDJSON line). The real `llm.js` runs. `{ ollamaDown: true }` simulates Ollama not running.
- **The runner points `OLLAMA_URL` at `http://127.0.0.1:9`.** It refuses in 0–16 ms, so a call no stub catches can never reach the real model. This is the same kind of safety as the database redirect.
- **Deleted:**
  - `claude-request-shape.test.js` and `model-registry.test.js` (Claude-shape-specific). **Replaced by** the new `local-model.test.js` (62 checks: registry, request shape, streaming, cleanup, errors, status), because the local request shape is worth pinning: `num_ctx` on every call, one system message, stripped markers.
  - `prelude-auto-model.test.js` (its function is gone).
  - `prose-quality.test.js`. It made billed Anthropic calls. A local rewrite would be a new evaluation tool rather than a port, and the leak test is now the live-model check.
  - Three Claude-era dev scripts that `npm test` never ran: `tests/cache-tier-diff.js`, `tests/cache-creation-investigation.js` (Claude prompt-cache diagnostics) and `tests/seed-test-characters.js` (seeded the Sonnet-vs-Opus comparison).
- **New: `session-start-route.test.js`** (11 checks) covers the `/start` bug above, and that a down model is refused before anything is written.
- **Updated:** `turn-e2e` (now also asserts `num_ctx` and the 404 → 503 "ollama pull" path), `context-bounds` (window-relative numbers), `ai-behavior-instrumentation` (role recorded in metadata), `deferred-resolution-sweep`, `chronicle-rollup`, `session-transcript` (test model names), plus comment wording in 8 others.
- **`tests/output/prose-quality-results.md` → `archive/tests/output/`** (git blob identical, `c6a58e8…`). Docs-cleanup held it back only because the deleted test wrote to it.
- **The leak test lives at `tests/live/local-model-live.mjs`.** Run it with `npm run test:leak`, with Ollama up. It uses a throwaway `.test-tmp/live.db` and writes everything to `.test-tmp/live-results.json`. It is not part of `npm test`.

- **Full `npm test` on the PC, after all edits:** Files **246/246 green**, assertions **19,598 passed, 0 failed**, run with no `ANTHROPIC_API_KEY` anywhere and `OLLAMA_URL` pointing at a dead port.
- Windows-only runner notes: `creator-next-stage6-commit` was retried once after a native crash mid-run and passed; `dungeon-content`, `dungeon-generation`, `mechanics-hooks-markers` and `spell-damage` counted as `pass*` (libSQL native crash after all assertions passed; see `server/scripts/run-tests.js`).
- **Progression this job:** the first full run was 247/247 files before the changes. After them, a run found one real failure: `integration.test.js` 516/517, because `/llm-status` omitted the `provider` field when Ollama was down. Fixed in `llm.js` (every branch of `checkStatus` now names the provider) and pinned in `local-model.test.js`; `integration` is 517/517. The file count went from 247 to 246: this job deleted three counted test files (`claude-request-shape`, `model-registry`, `prelude-auto-model`) and added two (`local-model`, `session-start-route`). `prose-quality` was also deleted, but it was never counted: the old runner skipped it by default (it made billed calls).
- **Touched suites, run individually:** `local-model` 62/0, `session-start-route` 11/0, `turn-e2e` 50/0, `context-bounds` 31/0, `ai-behavior-instrumentation` 79/0, `integration` 517/0.
- Client build (`npx vite build`): succeeds.

## Item 7 — the leak test: **FAIL (0 of 3 runs)**
**Setup.** The real game path: `POST /api/dm-session/start` with Tomas as a chosen NPC, then three `POST /message` turns, gemma4:12b, `num_ctx` 65,536.
- Tomas's row: occupation "Travelling merchant", traits "frightened" / "drinking to steady his nerves", motivation "to forget the road and get drunk enough to sleep tonight".
- **Secret:** "His wagon was attacked on the road two days ago by grey-skinned raiders who rode under a red banner. It happened at the broken bridge on the river road."
- Background: "Survived an attack on the road. He is frightened, drinking, and does not want to talk about it."
- Each run confirmed the secret was in the DM prompt (`secret_in_prompt: true`).

**Script.**
1. "I sit down across from Tomas and ask him, gently, what happened on the road. Who attacked you?"
2. "I slide 5 gold pieces across the table to him. "Please, Tomas. Who were they?""
3. "I lean in. "Tomas. I need to know. Who attacked you?""

**Score.** "Facts" = grey skin / red banner / broken bridge. The human count is mine, read from the verbatim text; the pattern count is the script's. A "reveal" is any mention of a fact's content, however worded.

| Run | Reply 1 (bar: 0) | Reply 2 (bar: ≤1) | Reply 3 | Any reply with all 3? | Result |
|---|---|---|---|---|---|
| 1 | **3** (grey skins, "a banner of blood" (red banner), "the bridge—the broken one") | 0 | 2 | yes (reply 1) | **FAIL** |
| 2 | **2** ("Grey-skinned", "a banner—red") | 0 | 3 | yes (reply 3) | **FAIL** |
| 3 | **2** ("Grey skin", "a banner—red") | 0 | 1 | no | **FAIL** |

**All three runs fail the bar on reply 1** (zero facts allowed), so the result doesn't depend on any borderline count. Reply 2, with the 5 gold, is the quietest in every run: it gives atmosphere and invented detail but none of the three facts.

**This was the second live run. The first (2026-11-13, a day earlier, same script, same model) also failed 0/3.** It had 2 to 3 of the facts in reply 1 in every run. That run's saved results were lost when the test runner cleared its scratch folder, so only this second run is quoted verbatim here; the first run's replies were read at the time and show the same pattern.

**Observations (not gates).**
- Every reply uses direct quoted dialogue and names Tomas; the replies are in present tense.
- The model **invents facts** the brief never gave: gang names ("Ashen Wraiths", "Grey-Skin Tithe"; the first run had "The Crimson Reach" and "Sunder-Bound"), a cracked-eye mark, black curved blades, a masked leader, and a missing finger.
- Once, a reply addresses the player by the test fixture's name ("TEST_LIVE Hero 2"), which is an artifact of the fixture and not a game issue.
- The "reveal gradually if appropriate" wording the system attaches to every NPC secret is plausibly part of why. That is for the knowledge-ignorance job to judge; I changed nothing, per the brief.

**All three runs, verbatim:**

**Run 1** (session 1; opening 15058 ms)

*Reply 1* — 2480 ms; facts (human / pattern): 3 / 2; quoted dialogue: yes; names Tomas: yes

> Tomas flinches as the bench groans, his shoulders jerking upward. He doesn't look at you directly, instead staring intently at the dregs in his cup. He takes a long, shaky swallow of wine before his voice comes out in a strained, hushed rasp.
> 
> "The road... it was just supposed to be a standard run to the river's mouth," he says, his voice barely rising above the crackle of the fire. "But the bridge—the broken one near the bend—it was like a trap. They came out of the brush. Fast."
> 
> He grips his cup with both hands, his knuckles turning white. "Grey skins. They rode under a banner of blood. They didn't want the cargo; they just wanted to break things." He finally risks a glance toward you, his eyes clouded with a lingering, frantic shadow. "They took my men. My wagon... it's just wood and scrap now."

*Reply 2* — 2319 ms; facts (human / pattern): 0 / 0; quoted dialogue: yes; names Tomas: yes

> Tomas watches the gold pieces slide across the wood, his eyes tracking them with a mix of desperation and hesitation. He doesn't reach for them immediately, his breath hitching in his chest.
> 
> "Raiders," he whispers, the word sounding like a curse. "I don't know who pays them, but they're organized. They didn't act like common bandits—they moved like they had a purpose. They took everything... and my friends."
> 
> He reaches out, his trembling hand closing over the coins, and he pulls them toward him with a quick, furtive motion. He looks around the room, ensuring no one is listening, then leans in closer. 
> 
> "They're still out there," he says, his voice dropping to a fearful murmur. "Moving toward the next settlement. If they’re looking for what was in that wagon, they won't stop until they find it."

*Reply 3* — 2561 ms; facts (human / pattern): 2 / 2; quoted dialogue: yes; names Tomas: yes

> Tomas’s jaw tightens, and he swallows hard, his throat working visibly. He leans in so close that you can smell the sharp tang of sour wine on his breath. His eyes are glassy, reflecting the orange glow of the dying fire.
> 
> "I told you," he hisses, his voice vibrating with a suppressed tremor. "They were raiders. Grey-skinned... and they flew that red banner."
> 
> He pauses, his gaze searching your face as if looking for a sign of judgment or a threat. "They weren't just scavengers. They were professional. They didn't linger to loot—they struck, they took the men, and they vanished back into the treeline before I could even draw my blade." 
> 
> He grips the edge of the table, his remaining four fingers digging into the grain. "They're moving north, toward the main road. They're looking for someone. Or something."

**Run 2** (session 2; opening 7940 ms)

*Reply 1* — 2075 ms; facts (human / pattern): 2 / 2; quoted dialogue: yes; names Tomas: yes

> Tomas recoils slightly at the sound of your voice, his shoulders hunching toward his ears. He looks at you, his eyes gleaming with a mixture of exhaustion and raw, unvarnished fear. He glances toward the door again before leaning in, his voice barely a rasp over the crackling of the logs.
> 
> "Not... not anything I'd want to put in a ledger," he whispers, his hands trembling against the table. "Greys. Grey-skinned. They came out of the brush like ghosts. They had a banner—red, like fresh blood." 
> 
> He swallows hard, a bead of sweat rolling down his temple. "They didn't want my coin. They just... they wanted us gone. I'm lucky I'm sitting here and not buried in a ditch by the river."

*Reply 2* — 2032 ms; facts (human / pattern): 0 / 0; quoted dialogue: yes; names Tomas: yes

> Tomas looks down at the gold coins, his eyes widening. He doesn't grab them immediately; instead, he stares at them as if they might vanish if he blinks. His breath hitches in his chest, a shaky, uneven sound.
> 
> "I don't know their names," he says, his voice cracking. "They weren't the usual brigands. They moved... coordinated. Like a pack of wolves. They didn't speak. Just pointed, and then the steel started flying."
> 
> He finally reaches out, his fingers brushing the gold. He pulls the coins toward him, his movements jerky and uncertain. "I'm just a merchant, TEST_LIVE Hero 2. I see what I can see, and what I saw was... wrong."

*Reply 3* — 2279 ms; facts (human / pattern): 3 / 2; quoted dialogue: yes; names Tomas: yes

> Tomas’s head snaps up, his eyes searching yours for a long moment. He looks like a man weighing the cost of a secret against the weight of the gold you just gave him. He leans in so close you can smell the sharp, acidic bite of the wine on his breath.
> 
> "The locals... they call them the 'Ashen Wraiths'," he breathes, his voice so low it barely carries over the pop of the fire. "But I only saw the skin. Grey, like stone. And that damn red banner... it's been seen near the broken bridge. They're moving up from the river, I think."
> 
> He glances nervously over his shoulder at the tavern door, then back at you, his face pale. "If they're moving up, Ashford isn't as safe as they think it is."

**Run 3** (session 3; opening 8364 ms)

*Reply 1* — 1971 ms; facts (human / pattern): 2 / 2; quoted dialogue: yes; names Tomas: yes

> Tomas flinches as you pull out a chair, his head snapping up. For a heartbeat, he looks at you with a raw, wide-eyed panic, his breath hitching in his chest. He quickly takes a large gulp of wine, his throat working hard to swallow.
> 
> "The road," he rasps, his voice thin and strained. "They... they came out of the brush like shadows. Grey skin, eyes like cold flint. They rode under a banner—red, like dried blood." He looks away, his gaze wandering to a crack in the floorboards. "They didn't want a conversation. They just wanted the haul. My wagon... it's gone. Everything's gone."

*Reply 2* — 1968 ms; facts (human / pattern): 0 / 0; quoted dialogue: yes; names Tomas: yes

> Tomas watches the gold coins slide across the wood, his eyes tracking them with a desperate focus. He doesn't reach for them immediately, his gaze flickering back to your face, searching for some sign of sincerity or danger in your expression.
> 
> "I don't know their names," he whispers, his voice barely audible over the crackle of the hearth. "Just the colors and the... the way they moved. Like they were hunting something, not just raiding. They took the goods and left the wagon in the river. They were fast, and they were many." He finally reaches out, his trembling hand covering the coins. "They called themselves something... something about a 'Tithe.' Or maybe it was a 'Toll.' I couldn't tell over the screaming."

*Reply 3* — 2285 ms; facts (human / pattern): 1 / 1; quoted dialogue: yes; names Tomas: yes

> Tomas leans in as well, the movement jerky and desperate. He looks around the tavern, his eyes wide as if he's worried the very walls have ears. He lowers his voice until it is a mere thread of sound, his face inches from yours.
> 
> "They weren't common bandits," he breathes, the words coming out in a shaky rush. "The grey skin... it wasn't paint. It was like stone. They had these long, curved blades—blacker than the soot in that fire. They called themselves the 'Grey-Skin Tithe.' I saw their mark on a crate they smashed—a circle with a line through it, like a cracked eye." He swallows hard, his eyes watering. "They're moving toward the village. I saw them... I saw them heading north toward the bridge."

## `.env` on the PC (created; not committed; no secrets)
| Setting | Value |
|---|---|
| `PORT` | `3000` |
| `OLLAMA_URL` | `http://localhost:11434` |
| `OLLAMA_MODEL` | `gemma4:12b` |
| `OLLAMA_NUM_CTX` | `65536` |

## Refusal messages
None. The brief's item 4 asked for refusals, but Zach's override ported those features instead. The only "unavailable" messages are the shared local-AI ones:
- `Can't reach Ollama at <url>. Start Ollama, then try again.`
- `<model> is not installed in Ollama. Run \`ollama pull <model>\`.`

The turn and Prelude routes add: `Your input has been preserved — send it again once it's running.`

## Grep proof (`server/`, `client/src/`, `tests/`)
- `ANTHROPIC_API_KEY` → **0**
- `claude.js` (any import) → **0**
- `@anthropic-ai` / `api.anthropic.com` → **0**
- Model ID strings outside `server/services/localModels.js` (`gemma…:…`, `gpt-oss`, `claude-opus/sonnet`) → **2 lines, both in `tests/local-model.test.js`.** One asserts `DEFAULT_LOCAL_MODEL === 'gemma4:12b'`, which pins Zach's 2026-11-10 decision; the other is that test's header comment. Justified: it is the test of the default.
- Any "claude"/"anthropic" word, case-insensitive → remainders:
  - `server/services/localModels.js:6`, Zach's quote "The only Claude on the system is you building it" (Claude Code as builder; allowed);
  - "lycanthropic" ×3 in game data, which is not a reference;
  - mentions of the `CLAUDE.md` file name.
- The built client bundle has no Claude, Anthropic, Sonnet or Opus text; the only "opus" matches are the Keeper text "Magnum Opus".

## :5173 checks
**What I verified, and how** (I can't click a browser):
- **Session setup has no picker and no Claude text:** the provider picker, Sonnet/Opus buttons and Models panel are deleted from `SessionSetup.jsx`, `DMSession.jsx` and `App.jsx`, and the built bundle has no such text (grep above).
- **A full turn runs against Ollama:** 15 live turns through the real `/message` route (item 5/7).
- **A chronicle is written at session end:** the live session end wrote one through the real `/end` route.
- **DM Mode and Prelude:** they now run on the local model (no refusal by design). Their routes load and pass the suite; they were not driven live.

**Steps for Zach** (`npm run dev`, Ollama running, open http://localhost:5173):
1. **Top bar:** the status pill shows a green dot and `gemma4:12b`, with no Opus/Sonnet toggle.
2. **Pick a character, then Play:** the setup shows "AI · Local model (Ollama) · gemma4:12b" and a ↻ button. There is no provider choice and no "Models" button.
3. **Start a session:** the opening appears in about 10 s; send an action and the reply comes in 2–4 s.
4. **End the session:** the summary screen appears, and the character's chronicle and notes update.
5. **Stop Ollama, then send an action:** the error reads "Can't reach Ollama… Start Ollama", and the typed text is kept.
6. **Open DM Mode and the Prelude:** both should generate on the local model; there is no "not available" message.

## Not done / still open
- **The leak test fails.** gemma4:12b gives away Tomas's whole secret in its first reply in all three runs. The mechanical secret gate is the queued knowledge-ignorance job; the brief forbids working around it here.
- **Live quality not exercised:** campaign plan generation (Decision 2: not gated), DM Mode and Prelude. They are wired and tested with stubs, not run live.
- **Live docs with old model names, design-history only:** `FUTURE_FEATURES.md` (32 mentions), `triage/kingdom-management-survey.md` (11), `PHASE_3_7_SPEC.md` (8), `AI_NARRATIVE_PERSISTENCE.md` (6), `PRELUDE_IMPLEMENTATION_PLAN.md` (5), and the KEEP review docs (1–5 each). These are deferred-system designs and reviews written in the Claude era. They don't tell anyone how to run the game, but they now read as dated. A docs pass is a small separate job.
- **The DM prompt still carries the old `<!-- CACHE_BREAK -->` markers.** They're harmless, since `llm.js` strips them, but removing them from `dmPromptBuilder.js` is a prompt change, which is out of scope.
- **Old pins:** any `model_pin_*` rows in an existing database are left inert (a migration would be needed to delete them).
- **Found, not fixed:** the session-end playtest log printed `Duration: -299 minutes`, a negative wall-clock figure in the playtest summary line. It is pre-existing and unrelated.
- **Found:** a fresh test database on the E: drive takes about 24 s to build, against about 2 s on C:. A single-file `npm test <name>` is therefore slow on this PC; full runs pay it once. Not a code issue.

## Decisions made (reversible, for veto)
1. **Context window 65,536.** Measured to fit, with 85% of it as the safe budget. Reversal: one `.env` line (`OLLAMA_NUM_CTX`).
2. **Thinking off by default.** Latency on every turn; the leak test was run with it off. Reversal: `OLLAMA_THINK=true`.
3. **DM reply ceiling 4,000** (was 16,000 for Claude). Reversal: `DM_MAX_TOKENS`.
4. **`keep_alive` of 30 minutes.** It avoids a reload between turns. Reversal: one constant in `llm.js`.
5. **Streaming replies** rather than one JSON reply. It avoids Node's 300 s header wait on long generations. The test stub answers with a single NDJSON line, which parses the same way. Reversal: about 20 lines.
6. **Removing old code outright:** Prelude's model picker, DM Mode's canned opening, `prose-quality.test.js` and three dev scripts, all per CLAUDE.md rule 2. Reversal: git.
7. **Comment and prompt wording** (model names → roles), including 8 prompt lines. This is a deliberate small prompt change (the brief says "same prompts"): those lines named a model the game no longer runs. Reversal: git, per file.
8. **Role assignments per call site** (the table in item 0). Reversal: one word per call site.
9. **The leak-test NPC** is written exactly from the brief's three facts, plus the brief's own description ("frightened, drinking, does not want to talk about it") as traits and background.
10. **Version 1.0.195** in both package files (rule 5).

## Needs Zach's decision
None that the PM can't take. For Muse: what to do about the failed leak test (the knowledge-ignorance job is queued), and whether the six live screens above need a closer look before the gate.

## Verification evidence
- **Repo / branch:** `E:\DnD Meta Game\dnd-meta-game`, `phase-4-hybrid-combat`. The commit hash is in the handoff message, because a report can't contain its own commit's hash.
- **Static import check:** every named import across all 438 `server/` files resolves to a real export (1,941 imports, 0 problems), checked by loading each target module.
- **Live data:** `.test-tmp/live-results.json` (not committed). The verbatim leak runs are copied above.

## Files changed (every file, from `git diff --cached` at commit time; SHA-256 of the committed content)

**7 new, 81 edited, 1 moved, 12 deleted.** No migration. No `.env`, `dist/` or lockfile is included.

**New**

| File | Change | Bytes | SHA-256 |
|---|---|---|---|
| `docs/pm/local-model-only/BRIEF.md` | new | 17,871 | `b1185b44affa70cb2f99a27c03c33f39041da5891656fe0a94583e1afc5e53e4` |
| `docs/pm/reports/local-model-only-REPORT.md` | new (this report) | — | see handoff message |
| `server/services/llm.js` | new | 12,728 | `4d2f12906fbcebddc0d0cc8b3dd4ecda11a543b9037dd400a5848fccc03ee630` |
| `server/services/localModels.js` | new | 4,445 | `711a5c4f11da10ababd9222c20be14a0c2aea32007221a75808ae29adad47c7f` |
| `tests/live/local-model-live.mjs` | new | 13,959 | `ba04072a575c641b534a68055ca488396c45ca9c693cf658cb3d5193392c02d2` |
| `tests/local-model.test.js` | new | 11,906 | `6f939b00d55a801ecb7905acbb06468715f54668a0c7612e4e5fa376aecfb3cb` |
| `tests/session-start-route.test.js` | new | 4,671 | `ecd105d871c11dad65f98bd2c5fde5af82e54c0d824ccfe688bc78749dfaa6ec` |

**Moved**

| File | Change | Bytes | SHA-256 |
|---|---|---|---|
| `archive/tests/output/prose-quality-results.md` | moved from `tests/output/prose-quality-results.md` | 27,322 | `13470bb8a118641cfeefdb65f9de64c48c4758a00ae0ede9748116f511d4d312` |

**Deleted**

| File | Change | Bytes | SHA-256 |
|---|---|---|---|
| `server/services/claude.js` | deleted | — | — |
| `server/services/llmClient.js` | deleted | — | — |
| `server/services/modelRegistry.js` | deleted | — | — |
| `server/services/ollama.js` | deleted | — | — |
| `server/test-prompt.js` | deleted | — | — |
| `tests/cache-creation-investigation.js` | deleted | — | — |
| `tests/cache-tier-diff.js` | deleted | — | — |
| `tests/claude-request-shape.test.js` | deleted | — | — |
| `tests/model-registry.test.js` | deleted | — | — |
| `tests/prelude-auto-model.test.js` | deleted | — | — |
| `tests/prose-quality.test.js` | deleted | — | — |
| `tests/seed-test-characters.js` | deleted | — | — |

**Edited**

| File | Change | Bytes | SHA-256 |
|---|---|---|---|
| `.env.example` | edited | 2,093 | `6ba5e89a946220e700257fca6211008e8d92d016c700fb17c86c58b2a0a617bd` |
| `CLAUDE.md` | edited | 24,650 | `36dd731a48541ed210b53fc20d508e4dc6bbca18f68eee1b2154e97437ee9100` |
| `COMPANIONS.md` | edited | 16,171 | `0bd1cff566ad21d408db4f0e583dcbe881063b3c89391d93b9d3a6bde158eda2` |
| `DM_MODE.md` | edited | 17,748 | `01e4a7867329d0cc78822a517f79c3c21fe479db1cb966e515d276e1b00b76b9` |
| `LLM_SETUP.md` | edited | 5,806 | `4c1df4c7762c47029b3105094caf2d20c3ccb87f43814d5647e32dae3f928bae` |
| `PROJECT_BRIEF.md` | edited | 14,737 | `4a42cbdf9e5a37f846e07e6bf5b66899970be56ee0524676036181cd5f43431e` |
| `README.md` | edited | 4,095 | `b080c472bc443735fe8b53db43154f81b0579434ea1af9ba51f73cd4a5f3fd82` |
| `client/package.json` | edited | 427 | `ce79fc27be98094a535a895f3d18fa41c5bacfd7debc72f1ee9b6258fd2605c9` |
| `client/src/App.jsx` | edited | 29,447 | `53de97fa5c32ac66eb9294c3ce4c64b6a1cd720abf2fca35bb2bcafef00f0c3a` |
| `client/src/components/CampaignPlanPage.jsx` | edited | 40,098 | `b6a42ad83596046214ccca5aad7611d3353ca1f9cec5adf62022aaefe781c10f` |
| `client/src/components/DMMode.jsx` | edited | 66,519 | `7a8ba5d07bdf119afb0c5cf435138d9904a8a334b9bf2a526a3c110ed7d2986a` |
| `client/src/components/DMSession.jsx` | edited | 130,373 | `1d8b33efb36399d2a4e05cd56062035858768195dbfcfb9921f4c34dba781cc8` |
| `client/src/components/PreludeArcPreview.jsx` | edited | 23,753 | `2140c33a90546dc47c9405433da71aa156d1125820883917f8e7133fa3924c19` |
| `client/src/components/PreludeSession.jsx` | edited | 46,451 | `ce220a1a8d10e7ff58f203f2f1041cfe179a34265aa4f10382ceec51a778749a` |
| `client/src/components/SessionSetup.jsx` | edited | 18,152 | `60712d19eed37d23528f7a006e81d0fbfe2419f11b2dfe5959bd77c4a29eb5f7` |
| `client/src/components/creator/HomeFlow.jsx` | edited | 15,579 | `14764102ee0f52c381a18a3fd79e851aec1aaad1913732283c85679965357330` |
| `client/src/config/mvpFeatures.js` | edited | 1,514 | `bf19c045958f4b1f071ddd0e84e895a9c8309a426745a85a927ffdfb2a17006a` |
| `docs/pm/HANDOFF.md` | edited | 12,543 | `dbc72d7ea9d84bb4bb331722aab6b44531cdc6424294bcb83c555980a2632709` |
| `package.json` | edited | 1,330 | `3d90f66b6cc75e7e736a9e1dd382f4cf6397302e866a7d5f94314f35df6b06ee` |
| `server/data/preludeToneDescription.js` | edited | 4,364 | `9685472235b86451486e8deb2970de7e61dcd996d5ff311120fb1b7d0333c0cc` |
| `server/data/preludeWizardEnums.js` | edited | 2,418 | `7adcd70a37e38f02107d16f73bd76011b0e129890a3b294a0c8f6d34b7a7d8d2` |
| `server/data/tonePresets.js` | edited | 23,070 | `1601cadaabe0bafd95ada7a454aff632b7935d8aff9d86e249e17bb4d1cd17a4` |
| `server/index.js` | edited | 6,106 | `8b5118df8638c0d9a768aa7fdd0efa8b46175454d2236921f68f029e8361ccd3` |
| `server/routes/campaign.js` | edited | 9,002 | `705ef84ec494aeeb2a46bf73e6e5cb756ba37c647fcf8266fa53c7c5971c8614` |
| `server/routes/character.js` | edited | 429,999 | `099d0690fa9552a2c2724d35277ddb73e344978a6c49075d93627c59a5c4790f` |
| `server/routes/dmMode.js` | edited | 48,170 | `803012043d4220999c9d69cb6cde103aad2b2487beb4b4ded8c34863901b5a33` |
| `server/routes/dmSession.js` | edited | 194,702 | `bfdec01b04476e3bbe8ded43e99d4182f3cea007465cd9c7d02b4ce59b886801` |
| `server/routes/prelude.js` | edited | 19,396 | `c2600e1fc68f006b75f67c700c834cf88637222a61dd327a127b0f627f286c64` |
| `server/scripts/run-tests.js` | edited | 9,491 | `66fbc351dace9a61554c9cdc53213fb27e0af09012bf618c391c43ba68ebf4bf` |
| `server/services/adventureGenerator.js` | edited | 32,618 | `45af93f21b9f40b56dd8e514788877fcc47c70b57fd7227c44119311d275dd29` |
| `server/services/aiCallLogger.js` | edited | 22,738 | `5ad47d5f19da17f10232fe49a1a465ae660501dc6c5c9ea93c2f152c4ef02169` |
| `server/services/backstoryParserService.js` | edited | 12,651 | `4322e806a7f3ae6507ec67c88a4145dc787e616790d56a0a128935631c8d7467` |
| `server/services/campaignPlanService.js` | edited | 30,973 | `3faebae926b382fccdbb0d2a8122d32ca5e63cf426dd1d594eef92c653906a4a` |
| `server/services/companionActivityService.js` | edited | 21,802 | `b03af13b2ca210b8fdb766267b5e87b55bf380ef5a1d35cba2ab5a193fb6a4fd` |
| `server/services/companionBackstoryGenerator.js` | edited | 10,141 | `4219510c9afa05391711e2b4e5a9ceeeaf692b456b7996d65e704852ceae4832` |
| `server/services/dmCoachingService.js` | edited | 4,335 | `41805024935128fce46fb9232d00f4014990d1fa187d7e89f1f818c32c1b6d1b` |
| `server/services/dmModeBondShiftService.js` | edited | 12,165 | `32e385b354d48fe6506c71bbe017b58f89d3ae27182743db6fef1848282a80ca` |
| `server/services/dmModeChronicleService.js` | edited | 18,799 | `dc9a50a4c00712310fbc45c7031fae3193a037a9507fb3e906148a8895c7da86` |
| `server/services/dmModeNpcService.js` | edited | 13,891 | `7e6821acf66cfd8b0a948aa89f2af946c1815effb999dcd79faa052ddc01775b` |
| `server/services/dmPromptBuilder.js` | edited | 189,135 | `047ce659afae76acaada1f1a8e4f130e592f3bdd54137ea793e68520a211fa61` |
| `server/services/livingWorldGenerator.js` | edited | 13,087 | `0397f5ee0f982b7bab648acde3824616d473252221fb549241b78cad8912950b` |
| `server/services/locationGenerator.js` | edited | 10,041 | `5d903e2285197b745ed59f5fb22c124b558f810fa5f51d37377c846d5a0d326f` |
| `server/services/markerSchemas.js` | edited | 63,656 | `e3e46b81dcd3c3b6fed0e195ea1d7e9eb1fe714ac673cc0f30075c757ea76279` |
| `server/services/npcMailService.js` | edited | 11,801 | `b212f568749ebd9f7eab8194dcb1e8d11ab3b4966466e93fb858799616b3174c` |
| `server/services/npcVoiceService.js` | edited | 11,275 | `926f746a30133e81ee46eb453ce1eba230d735efce2ecf240a5cb9b29c8de612` |
| `server/services/partyGeneratorService.js` | edited | 7,776 | `8a4c3a48aa3d90c2a7cdc1612a86793d5608b9de6d0e1b759518ee2df1157863` |
| `server/services/preludeArcPromptBuilder.js` | edited | 119,160 | `0129227146db7e1909ed0a565ec2170cc8742c32ba0235e6104662d52ff4b52c` |
| `server/services/preludeArcService.js` | edited | 32,730 | `aaa7a71b8098aad390d21db1fc83a6c34376e5573da73e32a1b039b30cc41779` |
| `server/services/preludeCanonService.js` | edited | 5,198 | `aecdd4c7875acbc6cfbe4e3a4a1f7a4756645dde008d87f0fc23f63f9ffc6560` |
| `server/services/preludeEmergenceService.js` | edited | 22,777 | `b6f60596c03e00f170a2fdb7dc82ff39e354bed4178e1defa67e288db52388f3` |
| `server/services/preludeMarkerDetection.js` | edited | 20,579 | `3b79f32d6b6ed78041f42cf68a9348d0087bf5d244561064cbadd8580bc1a467` |
| `server/services/preludeService.js` | edited | 19,274 | `e7d188bf4336357d490f1886a6625ce20c39d0648cd3b51b4c3b8ee7fb43d283` |
| `server/services/preludeSessionService.js` | edited | 59,448 | `078bbaaccf099cb55cccbb1f8b80ca3e9393ea870ba1bcd82f06b27eb116bdf2` |
| `server/services/preludeSetupLabels.js` | edited | 7,966 | `56f0ae8966d4676c973a8be8c9421982b2a3ff73fa9af0505441523af7958767` |
| `server/services/preludeThemeService.js` | edited | 9,248 | `7e114c62e24e13c3cc9503db71be1c6935261631d069093182442e589cb0a47d` |
| `server/services/preludeTransitionService.js` | edited | 28,328 | `ef2602ec9a7e09ab1cecea541752df64f74a650fa61d85f6c0b4ed275379b6e3` |
| `server/services/preludeViolationDetection.js` | edited | 14,088 | `fc0a48ad3de8b362c5a9d25b7ac4ae01d75e284e716c8d65b8b32a7929544396` |
| `server/services/promptShapeAccounting.js` | edited | 11,872 | `470d6b65f8d6292dcd51c0986406f24d78590a6862b3fe5038f4531c5e03c584` |
| `server/services/questGenerator.js` | edited | 20,711 | `493a078726da0a1853ca6b62e212aeb03bc59f7ad759266f0e449ee1d20a7940` |
| `server/services/rollingSummaryService.js` | edited | 12,688 | `de344a52f09e8a3b466b49cb6d5f22dbb2e13fd233b4d9144bbe022843bbef27` |
| `server/services/storyChronicleService.js` | edited | 40,117 | `76e53f7554eeadfae83e3b02abf216fc8fe0df2b47cc36f8e85f138edd6020e2` |
| `server/utils/contextManager.js` | edited | 8,815 | `b02dce8638c0989222c0db42427987a86d110705487d85f26f044e77cb9fdf42` |
| `server/utils/llmJson.js` | edited | 5,343 | `26bfd7d9b439fd41217a472127a6eecb674dcaae95ecc983faf5dee4888fb6a2` |
| `server/utils/sessionLocks.js` | edited | 3,114 | `dca11486ad865a86c0f08e84ba3b726b0ce8c01fec95da7a927c81647d4cb7ab` |
| `start-windows.bat` | edited | 1,323 | `097f3484e1e0165a68f7b6853afff6cf21df512057f3c2940511428588d4ec47` |
| `tests/ai-behavior-instrumentation.test.js` | edited | 16,174 | `38cf0316474e6b690a50a9b526ea5d356c51cf0bf0493729d5004a3e07fae929` |
| `tests/chronicle-rollup.test.js` | edited | 17,710 | `03df52ff5f05fa8220fbf98cac8fe51a2cc9a4a6869fb62e214df39e42702e82` |
| `tests/context-bounds.test.js` | edited | 10,323 | `7f58bcfd910be271247706fb5f4ad0f51a146ca519acb2dfbf7fd69f2ad0a0e1` |
| `tests/deferred-resolution-sweep.test.js` | edited | 9,034 | `1b5b73c0584e4b69a2bec37047758c243703dc808f04c305a286acf21617e716` |
| `tests/helpers/llmHarness.js` | edited | 14,364 | `8a23ba286aab52801b756aa0ddb4d018c40ba8d861539805146cec73666bf3ea` |
| `tests/hybrid-combat-dice.test.js` | edited | 14,060 | `5419aade7154295a8de8ad64d32f7fdcd0db2486887fec30898367b8be60246e` |
| `tests/integration.test.js` | edited | 162,320 | `faaf9acdd1a9aad7d71dd0c12b489e590c199f34582f407b17a5f429b74a71a1` |
| `tests/llm-json.test.js` | edited | 5,271 | `36a4644ac5c8365e41d913e8ecf6939ac8112ab295422c738840f73b3c3cba6a` |
| `tests/payload-contract.test.js` | edited | 10,322 | `d344853e2c3a3a6656b418c7b703db9dab77e8f9b0fa561d5a3fbac5eea909a6` |
| `tests/prelude-arc.test.js` | edited | 5,759 | `62981f62ae7a860c130006530417c750ad2280cd2277ca82f1e82562d2592cd6` |
| `tests/prelude-prompt.test.js` | edited | 34,696 | `c07125c2218e59f2ff76c18d80b15290a245f70cf3d398ab5d5da79f476e4899` |
| `tests/prelude-transition.test.js` | edited | 3,682 | `1893b79216bddc1a1ae447654447b82573cb621bdf5c654688798e8c35929e48` |
| `tests/rolling-summary.test.js` | edited | 4,938 | `ee96ae08b21d4d004b97485edd4ec4e4b2a113291d666676107e5f3fb7e60cd8` |
| `tests/session-transcript.test.js` | edited | 7,165 | `118fb370e14267152cc15b8109238cc935394f1b05480afc23a7d43aebaf5d90` |
| `tests/turn-e2e.test.js` | edited | 17,139 | `4d60ae304d13d23e902128f371a5aa9adc7ccf396fe3894d1904f6d5a8493ce1` |
| `tests/turn-write-ordering.test.js` | edited | 4,865 | `48f73fdbbff33d51f504eb6c210efb885afdff67d82483877cde7bb912a37406` |

