# CLAUDE.md — Project Instructions

D&D Meta Game: AI-powered solo D&D 5e campaign management system.

**This file is a present-tense snapshot, not a history.** Version-by-version detail belongs in `CHANGELOG.md`. Update this file when architecture changes, not when a bug is fixed.

> **Status: mid-refactor.** The project is executing a "scale back to scale up" plan — cut to a stable core, harden the data layer, then reintroduce mechanics deliberately. Phases 1–4 have landed: the world simulation is back on and driven by in-game time, and campaign memory is compressed rather than truncated. Several subsystems are still switched off. See **Feature flags** below before assuming one is live.

---

## Stack

- **Frontend**: React 18 + Vite (SPA at `client/`)
- **Backend**: Node.js + Express, ES modules (`server/`)
- **Database**: SQLite via `@libsql/client` — Turso cloud when `TURSO_DATABASE_URL` is set, local `file:local.db` otherwise
- **AI**: Claude (Opus for gameplay) with an Ollama fallback path

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
- `prose-quality.test.js` is excluded by default — it makes **billed** Anthropic API calls. Opt in with `TEST_INCLUDE_LLM=1`.

**Known failing (pre-existing, not yours):** `integration.test.js` — 3 assertions expecting `410 Gone` from retired give-item / take-item / companion-merchant endpoints that now `404`. It is also intermittently flaky under the shared test DB, as is `turn-e2e.test.js`.

**"Needs a running dev server" was wrong** and cost real time. Neither `campaign-import.test.js` nor `integration.test.js` talks to the dev server — each builds its own Express app on port 3001. `campaign-import` failed because that app never mounted the middleware populating `req.user`, so `getAllCampaigns` correctly returned `[]`; it is green as of v1.0.173. `world-event-npcs.test.js` was fixed earlier and passes.

**Testing anything that calls an LLM** — use `tests/helpers/llmHarness.js`. `installLlmStub()` swaps `globalThis.fetch`, so it intercepts every `api.anthropic.com` request without touching production code, and the real `claude.js` still runs (cache-tier splitting, retry triage, error tagging). `startTurnServer()` mounts the DM router on an ephemeral port — never import `server/index.js` in a test, it calls `app.listen(3000)` at import time. Cost safety is structural: no request escapes, and in the default strict mode an unscripted call throws instead of reaching the network. Don't script `429`/`529`/`503`/`500` — `claude.js` retries those with real backoff, up to ~60s; use `401` for the error path.

### 4. Feature flags, not commented-out code
Subsystems are switched off via `server/config/featureFlags.js`. Flags are **getters** that read `process.env` at access time — that is deliberate, and it is what lets a test opt back into a subsystem after imports are hoisted:

```js
process.env.FF_LIVING_WORLD_TICK = 'true'   // works even after imports
```

Never destructure a flag into a module-level constant.

### 5. One version bump per phase
Version + `CHANGELOG.md` entry at each atomic phase boundary, not per edit. Bump `package.json` and `client/package.json` together.

### 6. Don't
- No TypeScript, no CSS framework.
- Don't split `DMSession.jsx`, `CharacterSheet.jsx`, or `CharacterCreationWizard.jsx` unless asked.
- Don't write ad-hoc JSON parsers — use `server/utils/llmJson.js` (LLM output) and `server/utils/safeParse.js` (DB TEXT columns).
- Don't modify the primacy/recency prompt structure without understanding it (critical rules appear at both the top and bottom of the DM prompt on purpose).
- Don't add new root-level documentation files unless asked.

---

## Feature flags — what is on and off

All defaults live in `server/config/featureFlags.js`.

| Flag | Default | Effect |
|---|---|---|
| `LIVING_WORLD_TICK` | **on** (Phase 4) | Faction goals, world events, NPC mail, base income, notoriety decay, merchant order fulfilment, base threats. Driven by in-game time at session end |
| `NPC_AGING` | off | NPC absence/disposition decay at session start |
| `COMPANION_MOOD_DECAY` | off | Companion mood decay at session start |
| `SURVIVAL_DAY_CHANGE` | off | Food spoilage + exhaustion application |
| `DEFERRED_RESOLUTION_ACTIONS` | off | Companion away-activities, merchant commissions, fortress threats |
| `PROGRESSION_AWARDS` | off | Mythic tier auto-advance, quest/achievement XP |
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

- `tests/turn-e2e.test.js` drives the real route over HTTP against a real database with only the Anthropic transport stubbed (`tests/helpers/llmHarness.js`). It asserts on behaviour: markers apply, the player-facing narrative is marker-free while stored history keeps markers intact, a malformed marker queues then consumes a correction, 0 HP triggers a system-rolled death save, a failed LLM call writes nothing, and a concurrent POST gets `409` before the model is called.
- `tests/turn-write-ordering.test.js` still enforces steps 4–7 **structurally**, and is not redundant: on the happy path both orderings produce identical output, so no behavioural test can see the difference.

**Do not wrap marker dispatch in `db.transaction('write')`.** libSQL transactions are connection-scoped while all 26 handlers write through `dbRun` on the outer client, so it would roll back nothing while taking a `BEGIN IMMEDIATE` lock that the handlers then contend against — and `markerPipeline` swallows handler errors into `{ok:false}`, so the failure would surface as a `200` with a saved narrative and no effects. Real turn atomicity needs an `AsyncLocalStorage`-backed ambient executor in `server/database.js`; that is its own project.

### Markers

`markerSchemas.js` defines ~50 schemas; `markerPipeline.js` owns validation and dispatch. Handlers register via `registerHandler(schemaKey, fn)` at module load, co-located with the service that owns the side effect. **A handler service must be imported for its side effect in `dmSession.js` or it silently never runs.**

Schemas without handlers are a legitimate end state — validation alone provides correction-loop feedback. Malformed markers queue a correction on `session_config` that is injected into the next turn.

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

**Session & prompt** — `server/routes/dmSession.js`, `server/services/{dmPromptBuilder,dmSessionService,markerSchemas,markerPipeline,characterHpService,combatMarkerService,aiCallLogger,claude}.js`

**World & story** — `storyChronicleService.js`, `livingWorldService.js`, `campaignPlanService.js`, `questService.js`, `consequenceService.js`, `narrativeQueueService.js`, the `npc*Service.js` family

**Gameplay** — `weatherService.js`, `survivalService.js`, `craftingService.js`, `merchant*Service.js`, `mythicService.js`, `pietyService.js`, `notorietyService.js`, `baseThreatService.js`, `partyBaseService.js`

**Prelude creator** — `server/routes/prelude.js`, `preludeSessionService.js`, `preludeMarkerDetection.js`, `preludeArcService.js`, `preludeCanonService.js`

---

## Known structural debt

Verified during the Phase 1–4 refactor; none of it is scheduled yet.

- **`characters.campaign_id` is the single point of failure for world state.** It is not set at creation, and it gates chronicle generation, chronicle summaries, canon-fact budget, crafting, weather, notoriety, the living-world tick and the rollup. A character created on the default path engages almost none of the world — and now fails to record a chronicle at all (logged as a warning by `generateSessionChronicle`, which refuses rather than paying for an extraction it cannot store). **This is the highest-value fix outstanding.**
- **`dm_sessions` has no `campaign_id` column**, so `session.campaign_id` in `dmSession.js` is always `undefined` — it reaches `ai_call_log` as a null. The campaign is only reachable via `characters.campaign_id`. This is what broke `generateSessionChronicle` for its entire life before Phase 4; check the column exists before selecting it.
- **The prelude runs two parsers** over the same text (`validateDmMarkers` + `detectPreludeMarkers`) and carries an ordering invariant (`AGE_ADVANCE` → `HP_CHANGE`) that the pipeline's declaration-order dispatch cannot express.
- **Marker lists drift by hand** — `MARKER_SCHEMAS`, the prompt text, the strip regexes, and the handler registry are maintained separately. `preludeMarkerDetection.js` already has a catch-all strip regex worth adopting.
- **`ai_call_log` has no archival job.** It stores full prompts and full conversation history per call, growing quadratically within a session. This makes backups progressively more expensive.
- **`validateDmMarkers` runs twice per turn** over the same narrative.
- **No trigger advances the campaign act.** The lookup is dynamic as of Phase 4, but `POST /api/campaign/:id/act/advance` is the only thing that moves the pointer.
