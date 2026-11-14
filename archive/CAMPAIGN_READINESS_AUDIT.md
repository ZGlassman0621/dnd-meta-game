# Campaign Readiness Audit

Read-only gap analysis of this codebase against the requirements of a **single, open-ended solo campaign** — one human player, one PC, AI-controlled companions/NPCs/DM, standard 5e, no defined end date or level cap.

- **Audited:** 2026-08-09
- **Version at audit:** 1.0.167 (`package.json`), branch `main`, 53 migrations applied
- **Method:** static read of `server/`, `client/src/`, `tests/`, migrations, and config. No code executed, no tests run, no database queried.
- **Produced by:** `.claude/skills/campaign-audit`

## How to use this document

This is a **point-in-time snapshot**, not a live tracker. Findings are ranked by impact on long-run playability, not by ease of fixing. Line references will drift — the function and file names are the durable anchors.

Relationship to the other tracking docs:

- `KNOWN_BUGS.md` — confirmed, reproducible bugs not currently being fixed. Some findings here belong there once triaged.
- `FUTURE_FEATURES.md` — designed-but-deferred features.
- `CONSOLIDATED_TODO.md` / phase specs — scheduled work.
- **This file** — structural gaps found by audit, including things that are *absent* rather than broken. Findings do not become tracked work until promoted into one of the above.

Each prioritized gap carries a **Status** line. Update it in place as work lands; add a dated note rather than deleting the finding, so the reasoning survives.

---

## A. What this system currently is

A single-player Express + React application (~84k lines server, ~71k lines client, 53 migrations) that runs solo D&D campaigns against Claude, with libSQL/SQLite persistence either local or on Turso. The AI DM receives a large assembled system prompt — character sheet, world state, factions, NPCs, companions, weather, survival, crafting, mythic tier, piety, notoriety, base, canon facts, and full session history — and replies with narrative plus bracketed markers (`[COMBAT_START]`, `[PIETY_CHANGE]`, `[PROMISE_MADE]`, ~55 schemas) that a validation-and-dispatch pipeline turns into database side effects. Around it sit genuinely deep simulation subsystems: faction goals, NPC aging/lifecycle/relationships/mail, companion moods and away-activities, merchant relationships and economy, crafting, survival, weather, world events, long-term projects, and a mythic progression tree. Memory is two-tier: an intra-session rolling summary that compresses old turns, and a cross-session story chronicle that extracts structured canon facts at session end. It is a mature, heavily documented project mid-way through a planned refactor (Phase 3 marker consolidation, Phase 4 observability).

---

## B. Findings table

Labels: **Missing** — capability does not exist. **Partial** — exists but will not hold up over an open-ended campaign. **Fragile** — works, but a single failure loses or corrupts campaign state.

| # | Category | Label | Finding | Evidence |
|---|---|---|---|---|
| 1 | Engineering | **Partial** | Every past session's 300–500 word chronicle summary is injected into the system prompt with no cap or budget | `dmPromptBuilder.js:996-1027` (`formatPreviousSessionSummaries`), `storyChronicleService.js:612-621` (`getSessionSummariesForPrompt`) |
| 2 | Engineering | **Partial** | Chronicle token budget is computed from inputs that exclude the largest prompt component | `routes/dmSession.js:727-730` |
| 3 | Gameplay | **Missing** | Player HP is never changed during a session; no `HP_CHANGE` handler exists on the player path | `HP_CHANGE` implemented only in `preludeMarkerDetection.js:120`, `preludeSessionService.js:1193` |
| 4 | Gameplay | **Missing** | Player character cannot die — post-session HP is a heuristic clamped to ≥1 | `dmSessionService.js:1030-1042` (`calculateHPChange`), `routes/dmSession.js:3079` |
| 5 | Gameplay | **Missing** | No encounter difficulty / CR / XP-budget system anywhere | Inferred from absence — no `encounterBudget`/`xpBudget`/`challengeRating` outside content prose |
| 6 | Engineering | **Fragile** | A gameplay turn is ~15 sequential un-transacted writes; a crash mid-turn leaves narrative saved but effects unapplied | `routes/dmSession.js:1373-1471` |
| 7 | Engineering | **Fragile** | No idempotency or session lock on `POST /:sessionId/message`; a retry re-rolls the turn and re-applies markers | `routes/dmSession.js:1197-1215` |
| 8 | Engineering | **Fragile** | Backup is a manual `fs.copyFileSync` of a possibly-mid-write SQLite file; no WAL checkpoint, retention, verification, or restore path | `scripts/backup.js:15-28` |
| 9 | Engineering | **Fragile** | Migrations are not wrapped in a transaction with their `_migrations` insert; a partial failure re-runs on next boot | `migrationRunner.js:56-61` |
| 10 | Gameplay | **Missing** | Progression ceiling is level 20 + mythic tier 5, then nothing | `config/levelProgression.js:645-648` (`canLevelUp`), `mythicService.js:163-165` (`advanceTier`) |
| 11 | Engineering | **Partial** | `canon_facts` accretes forever; dedup only covers exact-string matches in 3 of 10 categories; budget truncation is a silent `break` | `storyChronicleService.js:342-372`, `storyChronicleService.js:437` |
| 12 | Gameplay | **Partial** | The living-world tick only runs when the player clicks a button; never driven by in-game time passing | `routes/livingWorld.js:38`, `LivingWorldPage.jsx:299` — no other non-test caller |
| 13 | Gameplay | **Partial** | Campaign plan's `current_act` is hardcoded to `acts[0]`; the main arc never advances | `campaignPlanService.js:604` |
| 14 | Engineering | **Partial** | `ai_call_log` stores full system prompt + full conversation history + response per call, with no archival job | `migrations/053_ai_call_log.js:44-52`, `aiCallLogger.js:132-156` |
| 15 | Engineering | **Partial** | The system prompt is built once at session start and frozen; the block labelled "live values, may change during play" does not | `dmPromptBuilder.js:334-341`, `routes/dmSession.js:1373` — no rebuild in the message handler |
| 16 | Engineering | **Partial** | 80+ test files, no `npm test` script, no CI workflow that runs them | `package.json:6-19`, `.github/workflows/` holds only a `workflow_dispatch` Windows build |
| 17 | Engineering | **Partial** | 95 bare `Math.random()` call sites, no central RNG module, no seeding — rolls unreproducible and unauditable | e.g. `combatMarkerService.js:22` |
| 18 | Gameplay | **Partial** | Prose-repetition ledger is per-session and capped at 30 entries; cross-session imagery repetition untracked | `repetitionLedgerService.js:20-25` |
| 19 | Engineering | **Partial** | Two marker pipelines coexist mid-migration; the legacy path "silently drops malformed markers" | `markerPipeline.js:11-27`, 28 surviving `detect*` exports in `dmSessionService.js` |
| 20 | Gameplay | **Partial** | Continuation sessions explicitly suppress recap ("Do NOT recap"); no player-facing "previously on…" | `routes/dmSession.js:1001` |

**Balance note.** 11 engineering findings to 9 gameplay. The split is close, but engineering skews slightly heavier for a structural reason worth naming: this codebase has *far more* gameplay system than most projects at this stage — factions, NPC aging, companion autonomy, merchant relationships, survival, crafting, mythic progression all genuinely exist and are wired. The gameplay gaps that remain are concentrated in one place (the combat/consequence core) rather than spread thin. The engineering gaps are spread across persistence, context, and durability because those layers were built to serve a campaign of unspecified length and were never sized for an indefinite one.

---

## C. Prioritized gaps

### 1. The prompt grows without bound and will hard-stop the campaign

**Status:** Open (2026-08-09)
**Findings:** #1, #2 · **Effort:** medium

**What is missing.** `formatPreviousSessionSummaries` (`dmPromptBuilder.js:996-1027`) receives *every* chronicle row from `getSessionSummariesForPrompt` (`storyChronicleService.js:612-621`) — no `LIMIT`, no token budget, no truncation — and renders each as a 300–500 word summary plus cliffhanger plus up to three key decisions. That is roughly 650 tokens per past session, injected into every new session's system prompt. At 50 sessions that is ~33k tokens; at 100, ~65k; at 200, ~130k; at 300 it exceeds the 200k window on its own, before the character sheet, world state, faction blocks, or canon facts are added.

Two things make it worse. First, `calculateChronicleBudget` (`routes/dmSession.js:727-730`) is fed `estimateTokens(worldState + campaign_notes + character_memories)` — it does not see the summaries block at all, so it hands out *more* canon-fact budget precisely as the prompt approaches the ceiling. Second, the reactive safety net cannot help: `compressMessageHistory` (`utils/contextManager.js:100-106`) filters system messages out and compresses only conversation, so once the system prompt alone is oversized, compression fires every turn and reduces nothing.

**Why it matters.** This is the finding that ends the campaign. Not degrades — ends. Somewhere between session 150 and 250 the session-start call begins returning API errors and there is no in-app path back. Everything else in this document is survivable; this is not.

**Recommended approach.** The design that will not survive is "inject all history verbatim." It has to become hierarchical: recent sessions verbatim, older ones rolled into era-level summaries, oldest into a single campaign-history paragraph — with the canon-fact store carrying the precision that the compressed prose loses. The simplest version that actually works, and is a contained change: cap `getSessionSummariesForPrompt` with `ORDER BY session_number DESC LIMIT 10`, re-reverse for chronology, and prepend one `campaigns`-table column holding a periodically-regenerated "campaign so far" paragraph covering everything older. Then fix the budget call to include the rendered summaries block in `estimatedPromptTokens`, and add a hard assertion at session start that logs loudly if the assembled system prompt exceeds a threshold. That alone converts a hard wall into a flat ceiling. The full hierarchical rollup can follow.

---

### 2. Combat has no mechanical existence, and the player cannot die

**Status:** Open (2026-08-09)
**Findings:** #3, #4 · **Effort:** medium

**What is missing.** `COMBAT_START` (`combatMarkerService.js:37-60`) rolls initiative server-side and returns a turn order — and that is the entire mechanical footprint of combat. There is no attack resolution, no damage application, no AC check, no death saves for the player, and no HP write during play. The `HP_CHANGE` marker schema exists at `markerSchemas.js:527` but is only implemented on the prelude path; the player session neither detects nor handles it. The DM prompt instructs the AI to track HP impressionistically — "HP milestones: 'bloodied' (half), 'barely standing' (near death)" (`dmPromptBuilder.js:1934`) — and the character sheet the AI is reading was frozen at session start anyway (see gap 11 / finding #15).

HP only moves at session end, via `calculateHPChange` (`dmSessionService.js:1030-1042`): if the LLM's 0–10 "combat" score exceeds 3, subtract a fraction of max HP capped at 40%. Then `routes/dmSession.js:3079` applies it as `Math.max(1, ...)`. The floor of 1 is not a safety clamp on an edge case — it is the only HP write path there is. **The player character cannot reach 0 HP.**

The asymmetry is telling: companions have real `companion_current_hp`, real death-save tracking, and a d20 revival roll (`routes/companion.js:1021`). The protagonist has none of it.

**Why it matters.** Over three sessions, narrated combat reads fine. Over three hundred, a game where the only character who can die is an NPC has no stakes, and every subsystem that depends on risk — survival, weather exposure, fortress threats, notoriety, the entire mythic trial framing — is resting on a consequence that never arrives. This is the difference between a campaign and a very long improv scene.

**Recommended approach.** The load-bearing decision is whether HP is authoritative in the database or in the model's narration; right now it is nominally the former and actually the latter, which is the worst of both. Make it authoritative in the DB. The simplest version: register an `HP_CHANGE` handler on the player path in the existing marker pipeline (the prelude implementation at `preludeSessionService.js:1193` is a working reference), instruct the DM to emit it on every hit taken, apply the delta to `characters.current_hp` transactionally, and re-inject current HP into the per-turn prompt via the same mechanism the repetition ledger already uses to append to `messages[0]`. Then decide the death rule deliberately — death saves, or a defeat-with-consequence table — and remove the `Math.max(1, …)` floor. The initiative work already proves the pattern; this is finishing it, not inventing it.

---

### 3. A turn is not atomic, and a retry re-runs it

**Status:** Open (2026-08-09)
**Findings:** #6, #7 · **Effort:** medium

**What is missing.** After the LLM returns, `routes/dmSession.js:1373-1471` performs the messages write, the transcript append, the validation write, and the full marker dispatch as separate un-transacted operations, each in its own `try/catch`. The narrative is persisted *before* the markers that give it mechanical meaning are dispatched. A crash, a killed process, or an aborted request between those points leaves a transcript saying "you hand over 50 gold and take the blade" with the gold unspent and no blade — permanently, and silently, since each step swallows its own errors. Separately, there is no idempotency key or session lock on the endpoint, so a client retry after a timeout produces a second LLM call and a second application of whatever markers come back.

**Why it matters.** These are silent, compounding corruptions of exactly the state the campaign is made of. Over hundreds of sessions they accumulate into a world that contradicts its own record, which is precisely the failure the chronicle system exists to prevent.

**Recommended approach.** The infrastructure is already here — `routes/character.js:1322` and `routes/dmSession.js:2186` both use `db.transaction('write')` correctly for level-up and merchant purchases. Extend it. The simplest version that closes the worst gap: reorder so marker dispatch precedes the messages write, and wrap dispatch-plus-messages-write in one `db.transaction('write')` so a turn either lands whole or not at all. Add an in-memory `Set` of in-flight session IDs and return `409` on a second concurrent `POST` for the same session — a single-user app does not need more than that to eliminate double-submission.

---

### 4. Campaign state has no real backup story

**Status:** Open (2026-08-09)
**Findings:** #8, #9 · **Effort:** small

**What is missing.** `scripts/backup.js` is a manual `fs.copyFileSync` of `local.db`. It is never invoked automatically, does not checkpoint the WAL or use SQLite's backup API (so a copy taken while the server is running can be torn), keeps every copy forever with no retention, never verifies the result is readable, and has no matching restore script. Separately, `runMigrations` (`migrationRunner.js:46-65`) applies each migration and records it as two independent statements — a migration that half-applies and throws is never recorded, so the next boot re-runs it and typically dies on "duplicate column."

**Why it matters.** An indefinite campaign is an irreplaceable artifact — hundreds of hours with no way to regenerate it. A single corrupted write or a botched migration on a database with no verified recent copy ends it as surely as the context wall, just faster.

**Recommended approach.** The simplest version that would genuinely protect the data: replace the copy with `VACUUM INTO 'backups/local-<ts>.db'`, which SQLite guarantees is a consistent snapshot of a live database, call it automatically at session end alongside chronicle generation, keep the last N by timestamp, and reopen each new backup read-only to confirm it parses before pruning the oldest. Add a `restore.js` that does the reverse with a confirmation prompt. For the migration runner, wrap `migration.up(db)` and the `_migrations` insert in one transaction — a handful of lines, and it makes every future schema change safe to retry.

---

### 5. Progression stops, permanently, at level 20 + mythic tier 5

**Status:** Open (2026-08-09)
**Findings:** #10 · **Effort:** medium

**What is missing.** `XP_THRESHOLDS` ends at 20 and `canLevelUp` (`config/levelProgression.js:645-648`) returns `false` at that level. `advanceTier` (`mythicService.js:163-165`) throws at tier 5. Past that point XP still accrues from every session and buys nothing, forever.

**Why it matters.** "No level cap, runs indefinitely" is the stated play model, and the system has a hard ceiling roughly a year of weekly play in. The failure is quiet — no error, just a reward loop that stops paying out — which in an open-ended campaign is the point where the player stops feeling the campaign is going anywhere.

**Recommended approach.** Post-cap progression does not need to be more class levels, and probably shouldn't be — 5e above 20 is not a solved problem, and the mythic tree already exists as the intended vehicle. The simplest version that keeps the loop alive: define boons purchasable with XP past the cap (an epic-boon table is the conventional shape), spend down `experience` when granted, and surface them in the existing mythic UI. Even a small fixed table converts dead XP into a continuing reward. Worth pairing with a decision about whether mythic tier 5 is genuinely terminal or should extend.

---

### 6. The world only moves when the player pushes it

**Status:** Open (2026-08-09)
**Findings:** #12, #13 · **Effort:** small

**What is missing.** `processLivingWorldTick` (`livingWorldService.js:46`) advances faction goals, spawns events, and expires stale state. Outside of tests, its only caller is a button in `LivingWorldPage.jsx:299`. Nothing in the session flow calls it when game days pass — and sessions do advance the calendar, via `calculateGameTimeAdvance` (`dmSessionService.js:1047-1050`) and long rests. A related symptom: `getPlanSummaryForSession` (`campaignPlanService.js:604`) hardcodes `current_act: plan.main_quest?.acts?.[0]`, so the main quest arc reports Act 1 to the DM forever.

**Why it matters.** The simulation depth here is the project's real distinguishing asset, and it is disconnected from the clock. Factions that only scheme when the player opens a menu are set dressing. Over hundreds of sessions this is the difference between a world and a backdrop.

**Recommended approach.** Drive the tick from in-game time rather than from the UI. The simplest version: at session end, where the new game date is already computed and written (`routes/dmSession.js:2709`), call `processLivingWorldTick(campaignId, daysElapsed)` with the delta and log the results into the narrative queue that already exists to feed them back into the next session's prompt. Keep the manual button for debugging. Separately, replace the hardcoded `acts[0]` with a lookup against a stored `current_act_index` on the campaign, advanced by an existing progression marker.

---

### 7. Canon facts accrete forever with no consolidation

**Status:** Open (2026-08-09)
**Findings:** #11 · **Effort:** small (logging + consolidation), medium (FTS retrieval)

**What is missing.** `recordCanonFact` (`storyChronicleService.js:342-372`) dedups only on exact lowercase string equality, and only for `death`, `npc`, and `location`. Every session adds 5–15 more facts permanently. In `getRelevantContext` (`storyChronicleService.js:425-602`), the top three tiers — deaths, promises, critical facts — are documented as "ALWAYS included" but are unbounded queries fed through an `addFacts` helper that `break`s silently on budget exhaustion. After a few hundred sessions those three tiers alone can consume the entire budget, and the truncation is invisible: no warning, no count of what was dropped.

**Why it matters.** The chronicle is the mechanism that makes the campaign feel continuous, and it degrades in the least visible way possible — the DM simply stops being told about things, and neither the player nor the logs can tell which things.

**Recommended approach.** Two independent fixes, both small. For visibility: have `addFacts` count and log skipped facts per section, so silent starvation becomes an observable number. For growth: add a periodic consolidation pass — at chronicle generation, ask the model to merge facts sharing a subject into one current statement and mark the originals `is_active = 0`. The `superseded_by` column and `supersedeFact` (`storyChronicleService.js:393-398`) already exist to support exactly this; nothing calls them automatically. Longer term, adding SQLite FTS over `canon_facts` would let retrieval be relevance-driven rather than category-priority-driven, which is what the `LIKE '%…%'` matching in the hint path is approximating today.

---

### 8. Observability storage grows quadratically with no archival

**Status:** Open (2026-08-09)
**Findings:** #14 · **Effort:** small

**What is missing.** `ai_call_log` (`migrations/053_ai_call_log.js:44-52`) captures the full system prompt, full conversation history, and full response for every AI call. Conversation history is stored per turn, so turn 51 stores 51 messages — quadratic within a session — on top of a 30–100KB system prompt per row. A 60-turn session plausibly writes several MB; hundreds of sessions reach gigabytes. The `archived_at` column exists and the migration comment says archival is future work; no job writes to it.

**Why it matters.** This is the Phase 4a instrumentation doing its job, and the data is genuinely valuable. But it is currently sized for a campaign that ends. Left alone it will eventually dominate the database, slow backups, and make the `VACUUM INTO` recommended in gap 4 expensive.

**Recommended approach.** The simplest version: at session end, null out `system_prompt` and `conversation_history` for rows older than N sessions while keeping timings, token counts, model identity, markers, and response text — that preserves essentially all the analytical value at a fraction of the size. Stamp `archived_at` so the intent is legible. If full prompts matter for later analysis, write them to gzipped JSONL on disk before nulling.

---

### 9. No automated test execution

**Status:** Open (2026-08-09)
**Findings:** #16 · **Effort:** small (assuming the suite currently passes — unverified, see D)

**What is missing.** There are 80+ test files in `tests/` and more in `server/tests/`, covering marker schemas, migrations, prompt building, standing scalars, NPC lifecycle, and much else. There is no `test` script in `package.json:6-19` and no CI workflow that runs them — the only GitHub workflow is a manually-triggered Windows build. The suite is real work that currently only runs when someone remembers to invoke a file by hand.

**Why it matters.** A codebase mid-refactor, with two marker pipelines live simultaneously (`markerPipeline.js:11-27`) and 53 migrations against irreplaceable data, needs a regression signal more than most. Right now the discipline lives entirely in the documentation rather than in the tooling.

**Recommended approach.** Add a `test` script that runs the suite (Node's built-in runner will discover `tests/*.test.js` directly) and a push-triggered CI job that executes it. The prerequisite worth checking first: several tests appear to touch the database, so they likely need to be pointed at a temp file via an env var before they can run unattended.

---

### 10. Rolls are unreproducible and unauditable

**Status:** Open (2026-08-09)
**Findings:** #17 · **Effort:** medium

**What is missing.** 95 direct `Math.random()` call sites across the server, no central RNG module, no seeding, no logging of roll inputs or outcomes. The one player-facing dice roller is client-side (`DiceRoller.jsx:18-19`) and unconnected to server state.

**Why it matters.** Lower urgency than the items above, but it compounds them: when something in the simulation produces a strange outcome three hundred sessions in, there is no way to reconstruct what was rolled. It also blocks deterministic replay, which is the natural way to test the systems in gap 9.

**Recommended approach.** A `server/utils/rng.js` exporting `roll(sides, count)` and `pick(array)`, seeded per campaign from a stored seed, with an optional roll log. Migrating all 95 sites is mechanical but wide; the version worth doing first is introducing the module and routing only mechanically-meaningful rolls through it — initiative, threat resolution, loot — leaving cosmetic randomness alone.

---

### Smaller items (noted, not fully treated)

- **Cross-session prose repetition (#18).** The repetition ledger is per-session and capped at 30 entries (`repetitionLedgerService.js:20-25`), so the "same simile again" problem it was built to solve returns fresh each session. Promoting the ledger to campaign scope is a small change.
- **No player-facing recap (#20).** Continuation sessions explicitly instruct the DM not to recap (`routes/dmSession.js:1001`). Defensible for immediate continuity, but across a campaign spanning years of real time, a "previously on" — which the chronicle summaries could generate for free — is the kind of thing that keeps a long campaign legible to the person playing it.

### Already tracked elsewhere

- `KNOWN_BUGS.md` tracks the fortress recapture-window gap with a clear severity rationale.
- `FUTURE_FEATURES.md:58` names prompt-accounting as an open concern. Gap 1 is adjacent to that entry but is a **distinct and more severe** problem: that entry describes a *measurement* gap (addressed by Phase 4a's prompt-shape accounting); gap 1 is an unbounded-growth hard wall.

---

## D. What could not be assessed

These are the limits of a static, read-only pass. Each would need something this audit deliberately did not do.

- **Whether the test suite passes.** Test filenames and contents were read; nothing was executed — several tests appear to write to the database. A run of the full suite against a throwaway database would establish whether the 80+ files currently pass, which materially changes how much confidence the existing coverage provides.
- **Real context sizes.** All prompt-growth figures in gap 1 are arithmetic from the code (word counts in prompt templates × row counts), not measurements. The `ai_call_log` table now records actual `input_tokens` per call — `SELECT session_id, input_tokens FROM ai_call_log WHERE call_purpose='session_start' ORDER BY id` against a database with real play history would replace the estimates with facts and pin down which session number hits the wall.
- **How the game actually plays.** Whether narrated combat feels stakeless in practice, whether the DM's impressionistic HP tracking holds up, and whether prose repetition is a live complaint are playtest questions. `TEST_RESULTS.md` and `tests/output/prose-quality-results.md` exist and likely speak to this; they were not read, since evaluating subjective play quality from stored transcripts is outside what a code audit can honestly claim.
- **Current campaign scale.** `local.db` is 1.29MB and the other root `.db` files are zero bytes, suggesting little accumulated play — but the database was not queried, so actual session count is unknown. Every growth projection assumes the campaign reaches hundreds of sessions. If the longest run so far is a dozen, none of the growth problems have manifested yet, which is consistent with their not having been noticed.
- **Turso vs. local behavior.** The code paths diverge at `database.js:9-13`. Transaction semantics, latency under the sequential-write turn loop, and whether the file-copy backup is meaningful at all differ substantially between the two. This audit assessed the local SQLite path.
- **Client-side state.** The audit focused on the server. The React layer holds meaningful gameplay state — conditions, spell slots, exhaustion tracked in `DMSession.jsx` component state — and how much survives a page refresh was not traced. Since conditions are passed *into* the message endpoint as `activeConditions` rather than read from the database, some of it may not.
