# CLAUDE.md — Project Instructions

D&D Meta Game: a solo D&D 2024 campaign game with an AI Dungeon Master.

**This file is a present-tense snapshot, not a history.** What each job changed belongs in its report under `docs/pm/reports/`. Update this file when architecture changes, not when a bug is fixed.

> **Status: building the MVP under a PM workflow.** The product is a solo D&D 2024 "forever game": one human player character, with the DM, NPCs, companions and enemies all played by AI, in a persistent Forgotten Realms world. The MVP is a self-contained one-shot test campaign, **Embervale** (nothing in the code defines it yet, as of 2026-11-13). It covers core play: create, play, leave, return, loot, XP, level, quests, companions, roleplay, combat, story, memory. Prologue (Prelude), full downtime, fortress/domain, Mythic and legacy are **post-MVP** (Zach, 2026-11-11), even where code for them exists. The posture is still **progression on, simulation off**, and several subsystems are switched off; see **Feature flags** below before assuming one is live.
>
> **How work arrives:** read `docs/pm/HANDOFF.md` before every job. Muse (the PM) writes each brief at `docs/pm/<job-slug>/BRIEF.md`; Claude Code builds on the PC copy of the repo (`E:\DnD Meta Game\dnd-meta-game`, branch `phase-4-hybrid-combat`) and writes the report at `docs/pm/reports/<job-slug>-REPORT.md`. Zach gates with `npm test` on the PC. Old plans, audits and the v1-era `CHANGELOG.md` / `DECISION_LOG.md` are in `archive/`, which is history, not guidance.

---

## Stack

- **Frontend**: React 18 + Vite (SPA at `client/`)
- **Backend**: Node.js + Express, ES modules (`server/`)
- **Database**: SQLite via `@libsql/client` — Turso cloud when `TURSO_DATABASE_URL` is set, local `file:local.db` otherwise
- **AI**: a local model through **Ollama on the player's PC** — gemma4:12b by default (Zach, 2026-11-10). No part of the game calls a cloud model or needs an API key (Zach, 2026-11-13: "The only Claude on the system is you building it"). See **Which model runs** below.

Conventions: ES modules only, no TypeScript. React function components with hooks, inline styles, no CSS framework. Parameterized `?` SQL. JSON stored in TEXT columns. REST routes at `/api/<resource>`.

---

## Commands

| | |
|---|---|
| `npm run dev` | Server (3000) + client (5173) |
| `npm test` | **Full suite against a throwaway DB** |
| `npm test <substring>` | One file, e.g. `npm test character-hp` |
| `npm run lint` | ESLint over `server/` |
| `npm run backup` | Verified snapshot into `backups/` |
| `cd client && npx vite build` | Catch client compile errors |

---

## Rules

### 1. Verify before you edit
Documentation in this repo has been wrong in ways that produced bad plans — a stale comment in `markerPipeline.js` claimed no handlers were registered when 26 were, and an audit claimed the living-world tick had no callers when it had three. **Grep the code. Do not trust a comment, an audit, or this file over what the source actually says.** If you find a doc that lies, fix it in the same change.

### 2. Delete outright
Legacy code is removed, not hidden. Git history is the archive. A superseded path left exported "just in case" is how this codebase ended up with two apparent marker pipelines and an audit finding built on the confusion.

### 3. Tests are the gate, and `npm test` must stay green
The suite runs against a throwaway SQLite file — **never** the live database. `server/scripts/run-tests.js` forces `TURSO_DATABASE_URL` to a temp file; dotenv does not override an already-set variable, which is what makes this safe. **Never remove that redirect.**

- Add or update tests for any non-trivial change.
- Run the full suite before finishing. Compare against the known-failing set below.
- Build the client when you touch `client/`.
- No file in `npm test` calls a live model. The runner points `OLLAMA_URL` at a dead loopback port (`http://127.0.0.1:9`), so a call no stub catches fails in milliseconds. The one live-model check, the leak test, runs separately: `npm run test:leak`.

**Known failing: none.** The full suite ran 247/247 files green on the PC on 2026-11-12 (`docs/pm/reports/windows-test-portability-REPORT.md`, `docs/pm/reports/creation-solidification-REPORT.md`). On Windows the runner names any file it counted as `pass*` or retried once after libSQL's native `0xC0000005` crash; see `server/scripts/run-tests.js`. macOS/Linux never take those branches.

**No test needs a running dev server.** `campaign-import.test.js` and `integration.test.js` each build their own Express app on port 3001.

**Testing anything that calls an LLM** — use `tests/helpers/llmHarness.js`. `installLlmStub()` swaps `globalThis.fetch`, so it intercepts every Ollama request (`/api/tags`, `/api/chat`) without touching production code, and the real `llm.js` still runs (request building, the streamed-reply parser, error tagging). `startTurnServer()` mounts the DM router on an ephemeral port — never import `server/index.js` in a test, it calls `app.listen(3000)` at import time. In the default strict mode an unscripted model call throws. `installLlmStub({ ollamaDown: true })` simulates Ollama not running; use `{ status: 404 }` for a missing model (tagged `LOCAL_MODEL_MISSING`, not retried).

### 4. Feature flags, not commented-out code
Subsystems are switched off via `server/config/featureFlags.js`. Flags are **getters** that read `process.env` at access time — that is deliberate, and it is what lets a test opt back into a subsystem after imports are hoisted:

```js
process.env.FF_LIVING_WORLD_TICK = 'true'   // works even after imports
```

Never destructure a flag into a module-level constant.

### 5. One version bump per job
Bump `package.json` and `client/package.json` together, once per job that changes the app, not per edit. The job's report in `docs/pm/reports/` is the record of what changed. `CHANGELOG.md` was retired to `archive/` on 2026-11-13 (its last entry is 1.0.0.194); don't revive it.

### 6. Don't
- No TypeScript, no CSS framework.
- Don't split `DMSession.jsx` or `CharacterSheet.jsx` unless asked. (The creator is `client/src/components/creator-next/`, six stage components plus `CreatorNextShell.jsx`; the old `CharacterCreationWizard.jsx` is gone.)
- Don't write ad-hoc JSON parsers — use `server/utils/llmJson.js` (LLM output) and `server/utils/safeParse.js` (DB TEXT columns).
- Don't modify the primacy/recency prompt structure without understanding it (critical rules appear at both the top and bottom of the DM prompt on purpose).
- Don't add new root-level documentation files unless asked.

---

## Feature flags — what is on and off

All defaults live in `server/config/featureFlags.js`.

| Flag | Default | Effect |
|---|---|---|
| `LIVING_WORLD_TICK` | **off** (MVP) | Faction goals, world events, NPC mail, base income, notoriety decay, merchant order fulfilment, base threats. Driven by in-game time at session end. Phase 4 turned it on; the MVP feature-flag posture turned it back off |
| `NPC_AGING` | off | NPC absence/disposition decay at session start |
| `COMPANION_MOOD_DECAY` | off | Companion mood decay at session start |
| `SURVIVAL_DAY_CHANGE` | off | Food spoilage + exhaustion application |
| `COLD_EXPOSURE` | on | Frost exhaustion / Cold Level on time advance and rest, on its own switch (not tied to `SURVIVAL_DAY_CHANGE` or the tick) |
| `DEFERRED_RESOLUTION_ACTIONS` | off | Companion away-activities, merchant commissions, fortress threats |
| `PROGRESSION_AWARDS` | **on** (MVP) | Quest/achievement XP. It also gates the `MYTHIC_TRIAL` auto-advance in `mythicService.js`; that code exists, but Mythic is post-MVP. Ancestry feats are wired end to end: creator pick at L1, tier picks at L3/7/13/18, `character_ancestry_feats`, character sheet, DM prompt |
| `NPC_DEATH_SYNC` | on | Canon-fact death reconciler — a reconciler, not simulation |
| `SESSION_END_BACKUP` | on | Fire-and-forget snapshot after session end. Forced off in `run-tests.js` |

**Known inconsistencies** — expect them:

1. Hunger and thirst are derived from `game_day` at read time, not ticked. They were never affected by the flag in either direction.
2. NPC "days since last seen" and promise deadlines are computed inline in the prompt builder, but the stored dispositions behind them decay only under `NPC_AGING`, which is still off. The DM can still say "you haven't spoken to Marta in 40 days" while Marta's disposition is unchanged. **The tick does not fix this** — `NPC_AGING` is a separate session-start flag.

`DEFERRED_RESOLUTION_ACTIONS` was bound to the tick during the scale-back: those actions queue a resolution the tick delivers, so with the tick off they soft-locked (a companion sent away never returned). Phase 4 removed that blocker; it stays off now only because the deferred-resolution loop has not been playtested against the time-driven tick.

---

## Architecture

### The turn loop — `server/routes/dmSession.js`

`POST /:sessionId/message` is the core path, and its **ordering is load-bearing**:

1. **Session lock** taken (`server/utils/sessionLocks.js`). A concurrent POST gets `409`. Released in a `finally` covering every exit.
2. Per-turn system-prompt suffix rebuilt — current vitals, then the repetition ledger. Both are stripped and re-appended each turn by **one combined regex**; splitting them causes either accretion or silent deletion.
3. LLM call.
4. **Marker dispatch — before any persist.** A crash after this loses the turn rather than recording a narrative whose effects never applied.
5. Death save, if the player is at 0 HP.
6. Handler results folded into `result.messages`.
7. **Exactly one** `UPDATE dm_sessions SET messages`.

Two tests cover this path, and they cover different things:

- `tests/turn-e2e.test.js` drives the real route over HTTP against a real database with only the model transport (Ollama) stubbed (`tests/helpers/llmHarness.js`). It asserts on behaviour: markers apply, the player-facing narrative is marker-free while stored history keeps markers intact, a malformed marker queues then consumes a correction, 0 HP triggers a system-rolled death save, a failed LLM call writes nothing, and a concurrent POST gets `409` before the model is called.
- `tests/turn-write-ordering.test.js` still enforces steps 4–7 **structurally**, and is not redundant: on the happy path both orderings produce identical output, so no behavioural test can see the difference.

**Do not wrap marker dispatch in `db.transaction('write')`.** libSQL transactions are connection-scoped while all 26 handlers write through `dbRun` on the outer client, so it would roll back nothing while taking a `BEGIN IMMEDIATE` lock that the handlers then contend against — and `markerPipeline` swallows handler errors into `{ok:false}`, so the failure would surface as a `200` with a saved narrative and no effects. Real turn atomicity needs an `AsyncLocalStorage`-backed ambient executor in `server/database.js`; that is its own project.

### Markers

`markerSchemas.js` defines ~50 schemas; `markerPipeline.js` owns validation and dispatch. Handlers register via `registerHandler(schemaKey, fn)` at module load, co-located with the service that owns the side effect. **A handler service must be imported for its side effect in `dmSession.js` or it silently never runs.**

Schemas without handlers are a legitimate end state — validation alone provides correction-loop feedback. Malformed markers queue a correction on `session_config` that is injected into the next turn.

### Which model runs — `server/services/localModels.js`, `server/services/llm.js`

**Every AI call names a role, never a model.** `localModels.js` maps the four roles — `dm`, `summary`, `extraction`, `generation` — to models, all defaulting to gemma4:12b and overridable in `.env` (`OLLAMA_MODEL`, `OLLAMA_MODEL_<ROLE>`). It is the only place in `server/` that names a model; accessors read `process.env` at call time, like the feature flags. An unknown role throws.

**Every call goes through `llm.js`** to Ollama's `/api/chat`: `chat(systemPrompt, messages, maxRetries, role, maxTokens, rawResponse, options)`, plus `startSession` / `continueSession` / `generateSessionSummary` / `checkStatus`. Through `aiCallLogger.js` (`loggedChat`, `wrapLlmCall`, `wrapLlmCallWithId`) every call lands in `ai_call_log` with its model, role (`metadata.role`) and token counts. Things the request depends on — break one and the failure is quiet:

1. **`num_ctx` is sent on every call** (`OLLAMA_NUM_CTX`, default 65,536 — measured to keep gemma4:12b 100% on a 16 GB GPU). Without it Ollama uses its own small default window and silently drops the start of a long prompt, which is where the DM rules live. `contextManager.js` budgets and the `checkPromptSize` thresholds derive from the same window.
2. **`num_predict` bounds the reply** (`DM_MAX_TOKENS`, default 4,000 for a DM turn). A reply cut off there (`done_reason: 'length'`) loses the markers at its end; `llm.js` logs it.
3. **The reply is streamed** and accumulated, so a long generation never hits Node's 300-second header wait. Thinking is off (`OLLAMA_THINK`); any inline `<think>` block is stripped before the player sees text.

Failures are tagged: `LOCAL_MODEL_UNAVAILABLE:` (Ollama unreachable; connection errors retry with short backoff) and `LOCAL_MODEL_MISSING:` (model not installed; not retried). The turn route maps both to a 503 that names the fix and keeps the player's input. The DM prompt still carries the `<!-- CACHE_BREAK:... -->` markers from the old prompt-cache design; `llm.js` strips them before sending.

### HP and death — `server/services/characterHpService.js`

HP is **authoritative in the database**. `[HP_CHANGE: delta=-7 reason="..."]` applies via a single atomic clamped `UPDATE` (no transaction needed). At 0 HP the player falls unconscious and the **system** rolls 5e death saves — the AI narrates and stops. Three failures kill; `is_dead` is terminal.

The `HP_CHANGE` prompt instruction lives in `formatPlayerHpRules()`, **outside** `formatMechanicalMarkers()`, because `applyLeanTransforms` strips that entire section — putting it there would make the player silently invulnerable on lean turns.

### Hybrid combat — player-rolled dice

The player rolls their own attack and damage dice. `POST /:sessionId/message` accepts two optional integers, `attackRoll` and `damage`; both are **binding facts** for that turn. The AI adjudicates against the target's AC and narrates, and does not re-roll. The server keeps player HP, unconsciousness and death saves; the AI keeps enemy HP and hit resolution. There is no server-side enemy HP table, and string-matching the narrative for enemy names to build one was rejected outright.

`parsePlayerDiceInput` + `formatPlayerDiceDirective` in `dmPromptBuilder.js` are a pair — validator and the prompt text it guards — and are kept adjacent so the bounds and the wording cannot drift apart. Three rules worth knowing:

- **Absent ≠ zero ≠ malformed.** `null`/`undefined`/`''` mean "no roll" and are the common case. Damage `0` is legitimate; guard with `Number.isInteger`, never truthiness.
- **Malformed is a `400`**, raised before the session lookup. Silently dropping a number the player typed returns the roll to the AI without telling anyone.
- **The directive is appended to the player's action, not the system prompt** — `applyLeanTransforms` could strip it there, and the numbers describe *this* action so recency belongs next to it. The route strips it back off before the single `messages` write, so it never accretes in stored history. The clean action is what persists, transcribes and reaches the client; `ai_call_log` alone records the augmented text.

`tests/hybrid-combat-dice.test.js` covers both layers — the pure functions, and the real route over the stubbed-LLM harness.

Session-end HP heuristics are retired (`hpChange = 0`). All three `Math.max(1, ...)` floors are gone, and `PUT /api/character/:id` clamps `current_hp` to `[0, max_hp]`.

### Session end — `POST /:sessionId/end`

Also order-sensitive. `daysElapsed` comes from `calculateGameTimeAdvance(rewardsAnalysis)`, then:

1. `UPDATE characters SET game_day` — advances the campaign clock.
2. **Living-world tick**, `processLivingWorldTick(campaign_id, daysElapsed)`. **Must run after step 1**: the tick derives its own clock from `MAX(game_day) FROM characters`, so ticking first would advance the world against the day the session *started* on and every deadline would resolve a session late. `tests/session-end-world-tick.test.js` asserts this via the weather stamp.
3. `queueTickHighlights` — narrative-queue entries for spawned world events **only**. Faction quests, merchant orders, base threats, NPC mail, consequences and notoriety all queue themselves at the point of production; re-queueing them here would double every entry.
4. Notes / NPC / memory extraction, then `generateSessionChronicle`.
5. `rollUpOldChronicles` — **after** the chronicle, since this session's chronicle is what pushes the oldest one out of the verbatim window.

Every one of these is individually wrapped: a failed tick or rollup must never fail the session that triggered it.

### Context bounds

Unbounded prompt growth is the failure mode that would eventually end a long campaign.

- **Two-tier campaign history.** `getSessionSummariesForPrompt` returns the newest 10 verbatim, **ordered oldest-first** — `dmSession.js` treats the last element as most recent, so do not flip to DESC. Everything older is compressed by `rollUpOldChronicles` into one running "campaign so far" paragraph on `campaign_chronicle_rollups` (one row per campaign+character, rewritten in place), capped at `MAX_ROLLUP_CHARS`. The rollup is **incremental**: only newly aged-out chronicles are sent, with the previous paragraph, so cost does not grow with campaign length. `through_session_number` is the resume point and must not advance on a failed or empty roll — that would drop history with nothing standing in for it.
- `CHRONICLE_VERBATIM_TAIL` is deliberately the same value as `SESSION_SUMMARY_PROMPT_LIMIT`. The verbatim window and the prompt window are the same window; letting them drift drops or duplicates sessions.
- `calculateChronicleBudget` is capped by `MAX_CHRONICLE_BUDGET`.
- `checkPromptSize` in `aiCallLogger.js` warns at 60k / errors at 100k estimated tokens. It **never throws** — instrumentation must not break gameplay. It sits there because every AI call funnels through the logger with the full prompt in hand.

### Campaign acts

`campaigns.current_act_index` (migration 062) points into `campaign_plan.main_quest.acts`. Reads go through `resolveCurrentAct`, which **clamps** — the pointer is a column and the acts live in a regenerable JSON blob, so they drift. Nothing advances the act automatically; `POST /api/campaign/:id/act/advance` drives it, because deciding an act has ended is a narrative judgement and a mechanical trigger would advance the arc on a schedule the story has not earned.

### No authentication — but `req.user` is still load-bearing

There is no sign-in. The account system (register, bcrypt, JWT, per-request Bearer token, `LoginPage.jsx`) was deleted in v1.0.173; the app opens straight into play.

**What survived is campaign ownership.** `campaigns.user_id` (migration 013) still exists, and `campaignService.getAllCampaigns` / `getActiveCampaigns` both open with `if (!userId) return []` — written so a caller with no user context leaks nothing. That makes a missing `req.user` a **silent empty campaign list**, not an error: every request still returns `200`.

`server/middleware/currentPlayer.js` therefore keeps `req.user` populated — it resolves the lowest-id `users` row (creating a default when the table is empty) and caches it for the process. It is not a gate; it rejects nothing. **Any Express app that mounts campaign routes must mount it too**, production and tests alike — that omission is what kept `campaign-import.test.js` red for its whole life. `tests/current-player.test.js` guards the round trip.

### Persistence

- **Migrations** (`server/migrationRunner.js`): each `up()` and its `_migrations` insert run in **one transaction**, so a failure rolls back and is safely retried. Pass `tx` into `up()`, never `db`. Numbered `NNN_*.js`, additive, idempotent via `PRAGMA table_info`.
- **Backups** (`server/scripts/backup.js`): the path is chosen by the **URL scheme**, not by whether `TURSO_DATABASE_URL` is merely set. A remote scheme is pulled down via embedded-replica `sync()`; unset or a `file:` URL uses `VACUUM INTO`. `VACUUM INTO` does **not** work against Turso — it runs server-side. Getting this wrong is not a soft failure: feeding a `file:` URL into `syncUrl` makes the libsql native layer **panic**, which no JS `try/catch` can absorb, so the fire-and-forget session-end backup takes the whole process down. Every backup is reopened and verified before older ones are pruned.
- **RNG** (`server/utils/rng.js`): mechanically meaningful rolls (initiative, crafting, death saves) go through `roll`/`rollD20`/`pick`/`shuffle`. Cosmetic randomness is deliberately left alone. Seeding is not implemented; its correct home is per-session, not per-campaign.

---

## Key files

**Infrastructure** — `server/index.js`, `server/database.js`, `server/migrationRunner.js`, `server/config/featureFlags.js`, `server/middleware/currentPlayer.js`, `server/utils/{rng,sessionLocks,contextManager,llmJson,safeParse,errorHandler}.js`, `server/scripts/{backup,run-tests}.js`

**Session & prompt** — `server/routes/dmSession.js`, `server/services/{dmPromptBuilder,dmSessionService,markerSchemas,markerPipeline,characterHpService,combatMarkerService,aiCallLogger,llm,localModels}.js`

**World & story** — `storyChronicleService.js`, `livingWorldService.js`, `campaignPlanService.js`, `questService.js`, `consequenceService.js`, `narrativeQueueService.js`, the `npc*Service.js` family

**Gameplay** — `weatherService.js`, `survivalService.js`, `craftingService.js`, `merchant*Service.js`, `mythicService.js`, `pietyService.js`, `notorietyService.js`, `baseThreatService.js`, `partyBaseService.js`

**Character creator (MVP)**: `client/src/components/creator-next/` (six stages), committed through `POST /api/character/:id/commit` in `server/routes/character.js`

**Prelude (post-MVP; the code exists but is out of MVP scope)**: `server/routes/prelude.js`, `preludeSessionService.js`, `preludeMarkerDetection.js`, `preludeArcService.js`, `preludeCanonService.js`

---

## Known structural debt

Verified during the Phase 1–4 refactor; none of it is scheduled yet.

- **`characters.campaign_id` is the single point of failure for world state.** It is not set at creation, and it gates chronicle generation, chronicle summaries, canon-fact budget, crafting, weather, notoriety, the living-world tick and the rollup. A character created on the default path engages almost none of the world — and now fails to record a chronicle at all (logged as a warning by `generateSessionChronicle`, which refuses rather than paying for an extraction it cannot store). **This is the highest-value fix outstanding.**
- **`dm_sessions` has no `campaign_id` column**, so `session.campaign_id` in `dmSession.js` is always `undefined` — it reaches `ai_call_log` as a null. The campaign is only reachable via `characters.campaign_id`. This is what broke `generateSessionChronicle` for its entire life before Phase 4; check the column exists before selecting it.
- **The prelude runs two parsers** over the same text (`validateDmMarkers` + `detectPreludeMarkers`) and carries an ordering invariant (`AGE_ADVANCE` → `HP_CHANGE`) that the pipeline's declaration-order dispatch cannot express.
- **Marker lists drift by hand** — `MARKER_SCHEMAS`, the prompt text, the strip regexes, and the handler registry are maintained separately. `preludeMarkerDetection.js` already has a catch-all strip regex worth adopting.
- **`ai_call_log` is pruned, not archived.** It stores full prompts and full conversation history per call. Session end runs `pruneAiCallLog()` (`server/services/aiCallLogger.js`), which clears the heavy content columns of rows older than `AI_CALL_LOG_RETENTION_DAYS` (default 30). There is no export of old rows before pruning.
- **`validateDmMarkers` runs twice per turn** over the same narrative.
- **No trigger advances the campaign act.** The lookup is dynamic as of Phase 4, but `POST /api/campaign/:id/act/advance` is the only thing that moves the pointer.
