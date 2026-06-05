# PHASE_4A_SPEC.md

**Status:** Drafted, ready for Code execution.
**Phase:** 4a (first sub-phase of Phase 4 — AI Behavior).
**Authored:** 2026-05-06.
**Sequencing gate:** Phase 3.7 closed at v1.0.164. Phase 4a unblocked. No Design dependency this phase — backend instrumentation work plus a small debug surface.
**Companion document:** `PHASE_4_OVERVIEW.md` provides the framing this spec references.

---

## §1. Overview

### §1.1 What Phase 4a is

The diagnostic infrastructure phase. Builds the instrumentation that lets the project see what the AI is actually doing across gameplay sessions. Concrete deliverables; structural-refactor-shaped scope; bounded execution; single end-of-phase review gate.

This is the foundation that makes Phase 4b's investigation practice possible. Without it, prompt tuning is fumbling in the dark.

### §1.2 What Phase 4a explicitly does NOT do

- **No prompt changes.** Phase 4a is read-only on production prompts. Instrumentation captures what the AI does; doesn't tune what the AI does. Tuning is Phase 4b.
- **No investigations.** Phase 4a is infrastructure-only. Specific behavior investigations (shelter-fixation, continuity preservation, etc.) start in Phase 4b after instrumentation lands.
- **No new AI capabilities.** Combat difficulty mechanism, fortress threat emission tuning, etc. are Phase 4b territory.
- **No model swap.** Production continues using current Opus per existing logic; Phase 4a doesn't change model selection.
- **No persistent UI for the diagnostic surface beyond a debug page.** Lightweight inspection tools, not a polished analytics dashboard. The debug page is for the user; consumer-facing diagnostic UX is out of scope.
- **No removal of existing diagnostic infrastructure.** The Lean Prompt toggle, the Sonnet/Opus model selector, the existing prose-quality investigation harnesses — all stay. Phase 4a is additive instrumentation; the existing diagnostic surface continues to work alongside it.

### §1.3 Decision summary going into Phase 4a

Calls already made before this spec was authored (2026-05-06):

| Call | Decision |
|---|---|
| Phase 4 framing | Practice-building, not one-time bug-fixing. Phase 4a (infrastructure) → Phase 4b (investigations as recurring practice). |
| Phase 4a scope | Diagnostic infrastructure only. Read-only on production. No tuning. |
| Reference texture | Order of Dawn's Light campaign — five behavioral patterns from PHASE_4_OVERVIEW.md §3. |
| Same-Opus-family framing | PM (current Opus) and production-Claude (current Opus) are same model family. Useful collaboration, doesn't eliminate empirical testing. |
| Example-as-hard-fact warning | Bake-in. Instrumentation must measure scope-of-instruction-application. |
| One-pass execution | Code drives end-to-end, single end-of-phase review gate, internal ship cadence Code's call. |
| Outside-AI review | Available technique, not default mode. |

### §1.4 Cadence and execution

Same one-pass cadence as Phase 3.5 and Phase 3.7. Code drives end-to-end without per-sub-checkpoint review gates. Internal ship cadence is Code's discretion — likely 1-2 ships given the bounded scope, possibly more if SC-4a.1 capture infrastructure and SC-4a.4 query surface want clean separation.

End-of-phase review covers cumulative Phase 4a state. Phase 4a closes when review passes.

---

## §2. SC-4a.1 — Prompt-response capture

### §2.1 What this builds

Comprehensive logging of every AI call the production system makes, with metadata sufficient for downstream analysis.

### §2.2 What gets captured

For every AI call (gameplay sessions, marker validation, prelude sessions, any other AI-touching path):

- **Identity fields:** character_id, campaign_id, session_id, turn_number, prompt_builder (which builder produced this prompt — `dmPromptBuilder.js`, `preludeArcPromptBuilder.js`, etc.), call_purpose (gameplay turn, marker correction, etc.)
- **Prompt content:** full system prompt, full user message, any conversation history included in the call
- **Response content:** full response text, any markers detected, any tool calls if applicable
- **Timing:** request_started_at, response_received_at, latency_ms
- **Model identity:** model identifier returned by the API (e.g., `claude-opus-4-7`), token counts (input + output)
- **Metadata:** detected markers' parse results (success/failure/correction-loop-trigger), any rule violations flagged downstream, whether response triggered a correction-loop next turn

Storage is append-only. New table `ai_call_log` (or similar — Code's call on naming) with columns covering the above. Indexes on `character_id`, `session_id`, `request_started_at` for the common query patterns.

### §2.3 What gets NOT captured

- **No personally identifying data beyond what the project already stores.** This is a single-user system; the user IS the data subject; their existing data is already in the project DB. No new PII surfaces.
- **No raw API keys or auth tokens.** Standard practice; just naming for completeness.
- **No client-side state beyond what reaches the server.** UI state, local preferences, etc. don't get logged in the AI call log.

### §2.4 Storage growth implications

A typical gameplay session might generate 20-50 AI calls. With prompts averaging 5-15K tokens and responses 1-5K tokens, each call could log roughly 30-80KB of text. A session = 1-4MB of log data. A long-running campaign over months = potentially gigabytes.

Two practical decisions:
- **Capture everything for now.** The user's hardware can handle it; the data's diagnostic value is highest when complete; pruning is harder than capturing.
- **Plan for future archival, not now.** Add an `archived_at` column NULL by default. When data volumes warrant pruning (probably much later), an archival job moves old rows somewhere cheaper. Phase 4a doesn't build the archival job; it just makes future archival possible.

### §2.5 Implementation shape

A new module — `services/aiCallLogger.js` or similar — exports a wrapping helper that any AI-call site can use:

```js
const result = await logAiCall({
  character_id, campaign_id, session_id, turn_number,
  prompt_builder: 'dmPromptBuilder',
  call_purpose: 'gameplay_turn',
  systemPrompt, userMessage, conversationHistory,
  callFn: () => apiService.callClaude({...}),
});
```

The helper records the request metadata, makes the call, records the response and timing, returns the result transparently. Callers don't change behavior; they just delegate the call through the logger.

Migration to wrap all existing AI call sites is the bulk of the work. The inventory of call sites Code will need to migrate:
- Main DM session turn handler in `routes/dmSession.js`
- Marker correction loop trigger
- Prelude session message handler in `routes/prelude.js`
- Any other AI-touching call sites Code surfaces during implementation

### §2.6 Acceptance criteria

- New table created via migration (053 or whatever the next number is)
- `services/aiCallLogger.js` (or equivalent) exports the logging helper
- All existing AI call sites migrated to delegate through the helper
- Captured fields per §2.2; storage shape per §2.4
- Tests cover: helper wraps calls correctly; failed API calls log appropriately; existing call-site behavior is byte-identical from caller's perspective
- DECISION_LOG entry covering the capture decision and the storage-growth-vs-archival framing
- No prompt-content or response-content changes (Phase 4a is read-only on the AI's actual behavior)

### §2.7 What SC-4a.1 explicitly does NOT do

- Doesn't analyze the captured data (that's SC-4a.4 query surface and Phase 4b investigations)
- Doesn't change AI behavior in any way
- Doesn't add UI for browsing the log (debug page is SC-4a.4)

---

## §3. SC-4a.2 — Quality signal aggregation

### §3.1 What this builds

A set of structured signals derived from production AI behavior, queryable per character, per session, or in aggregate. The signals scaffold the questions Phase 4b will ask.

### §3.2 The signals

Each signal is a measurable behavioral characteristic, named, with clear computation rules.

**Marker correction-loop hits** — count of turns where the marker pipeline detected malformed markers and triggered a correction prompt next turn. Per character, per session, in aggregate. High rates indicate AI is producing markers it can't validate; might suggest prompt complexity issue.

**Rule violation rates** — count of turns where the AI's response triggered any documented rule violation (Cardinal Rule violations, marker validation failures, content rule violations). The existing rule infrastructure already tracks these somewhere; Phase 4a centralizes.

**Repetition-ledger triggers** — count of turns where the existing repetition-ledger system flagged repeated phrasing. Per character, over time — looking for "AI gets stuck in loops as session progresses" patterns.

**Response length distributions** — token counts of responses, segmented by call purpose. Looking for compression patterns ("responses got shorter as session progressed"), bloat patterns ("responses growing unsustainably long"), or tightness patterns ("responses are uniformly short — possibly over-constrained").

**Marker emission rates per type** — count of each marker type emitted, per character, over time. Looking for patterns like "AI stops emitting `[FORTRESS_THREAT]` markers" or "AI emits `[NPC_INTRODUCED]` for the same name across multiple sessions" (name reuse signal).

**Name-reuse signal** — track distinct NPC names introduced via `[NPC_INTRODUCED]` markers (or whatever the AI uses today). Specifically watch for names appearing across multiple different characters introduced separately. The OoDL reference texture has dozens of distinct named NPCs; Phase 4a looks for current production diverging from that.

**Time-drift signal** — when the AI states a time-bounded fact (`X arrives in 7 days`, `the ward holds for 4 hours`), and the same fact appears later, do they agree? This is a hard signal to capture cleanly; SC-4a.2 implements a best-effort version (parse time-mention patterns from response text, compare across turns, flag obvious drift). Phase 4b investigation #2 (continuity preservation) refines as needed.

**Same-Opus-family note:** PM can help calibrate signal thresholds during implementation. "What constitutes 'high' marker correction-loop rate?" — PM can review captured data with Code and propose thresholds based on what Claude tendencies look like in practice. PM-as-collaborator is an explicit input here.

### §3.3 What signals are NOT

- **They're not pass/fail metrics.** Each signal produces a number or distribution; interpretation requires context.
- **They're not automatic alerts.** Phase 4a doesn't build alerting; the user reads signals via the debug page (SC-4a.4) when investigating.
- **They're not all the signals that exist.** The seven above are the starting roster. New signals join the system in Phase 4b as investigations surface them.

### §3.4 Implementation shape

Each signal is a function in a new module — `services/aiBehaviorSignals.js` — that queries the AI call log and returns structured data. Functions take filter parameters (character_id, session_id, time range) and return either single values or distributions.

```js
async function markerCorrectionLoopHits({ characterId, sessionId, startTime, endTime }) {
  // Query ai_call_log for the relevant rows
  // Return { count, rate_per_turn, examples: [...] }
}
```

The functions are pure (read-only on the log); composable; queryable from the debug page (SC-4a.4) or from CLI (also SC-4a.4) or from raw SQL. They're the analysis primitives Phase 4b investigations will use.

### §3.5 Scope-of-instruction-application signal

Per the example-as-hard-fact warning (PHASE_4_OVERVIEW.md §6), one signal deserves special call-out:

**Scope-of-instruction-application** — for each documented prompt restriction (Cardinal Rules, OBSERVATION rules, marker emission rules, etc.), measure how often the AI applies the restriction broadly vs. narrowly to its example case.

Concrete: if a Cardinal Rule says "don't speak for the player" with example "don't say 'you sit at the table'", measure:
- How often the AI follows the broad principle (avoiding any first-person-as-player narration)
- How often the AI follows only the narrow example (avoiding "you sit" but doing other autonomy-violating narration)

This is a hard signal to compute mechanically. SC-4a.2 implements a best-effort version with explicit caveats:
- Parse responses for known autonomy-violation patterns
- Flag responses that contain non-example violations (broader pattern violations not in the example case)
- Surface as an investigation-ready signal: "responses where rule is followed narrowly but not broadly"

This signal is the most important one for Phase 4b's constraint audit. Worth shipping a basic version even if imperfect; refinement happens in Phase 4b investigation #1.

### §3.6 Acceptance criteria

- `services/aiBehaviorSignals.js` (or equivalent) exports the seven primary signals plus the scope-of-instruction-application signal
- Each signal function accepts standard filter parameters and returns documented data shape
- Tests cover each signal function: known-input → known-output verification
- Signals are pure read-only on `ai_call_log`
- DECISION_LOG entry covering the seven signals + scope-of-application signal, with rationale for each

### §3.7 What SC-4a.2 explicitly does NOT do

- Doesn't display signals (that's SC-4a.4)
- Doesn't act on signals (that's Phase 4b)
- Doesn't add new signals beyond the seven + scope-of-application (extending the roster is Phase 4b territory)

---

## §4. SC-4a.3 — Prompt-shape accounting

### §4.1 What this builds

Visibility into the prompts themselves. Not the AI's behavior in response to prompts (that's SC-4a.2) but the structure and length of the prompts the AI receives.

### §4.2 Why this matters

Phase 4b's constraint audit needs to know what the prompts actually are: which sections exist, how long each section is, what fraction of context window each call consumes, how cumulative context grows per session. Without this visibility, the audit is reading code, not reading evidence.

The prose-quality investigation (Phase 3) already established that prompt length and structure affect output quality. Phase 4a formalizes the measurement so future tuning has data.

### §4.3 What gets accounted

- **Per-call prompt anatomy:** for each AI call, breakdown of the system prompt by section (Cardinal Rules section, character context section, world state section, marker definitions section, etc.). Section boundaries are inferred from the existing prompt builders' structure.
- **Per-builder length distribution:** for each prompt builder (`dmPromptBuilder`, `preludeArcPromptBuilder`, etc.), distribution of total prompt length across calls.
- **Section contribution per builder:** what percentage of each builder's average prompt comes from each section. "Cardinal Rules section is 12% of dmPromptBuilder output on average."
- **Cumulative context per session:** total tokens consumed across all turns of a session. Looking for sessions that hit context limits or get close.
- **Growth patterns:** does prompt length grow over a session as conversation history accumulates? At what rate? Are there step-changes (e.g., when new state is added)?

### §4.4 Implementation shape

Two pieces:

**(a) Prompt-builder annotation.** Each prompt builder (probably starting with `dmPromptBuilder.js`) produces, in addition to the prompt string itself, an optional structured breakdown:

```js
{
  prompt: "...",
  sections: [
    { name: 'cardinal_rules', tokens: 412 },
    { name: 'character_context', tokens: 1843 },
    { name: 'world_state', tokens: 2103 },
    // ...
  ],
}
```

The breakdown gets stored alongside the captured prompt in `ai_call_log` (extending the schema from SC-4a.1 — probably a JSON column).

**(b) Aggregation functions** in `services/promptShapeAccounting.js` (or extending the signals module from SC-4a.2). Functions answer questions like:
- "Show me section breakdowns for all `dmPromptBuilder` calls in session X"
- "Average length of `cardinal_rules` section across all production calls"
- "Sessions where total context exceeded 100K tokens"

### §4.5 Token counting

Token counts use the API's actual reported counts (returned in API responses) where possible. Where we need to count without an API call (e.g., breaking a prompt into sections before sending), use a tokenizer estimate. The standard `tiktoken` library or equivalent works; small inaccuracies are acceptable since this is for diagnostic purposes, not billing.

### §4.6 Acceptance criteria

- Prompt builders produce structured section breakdowns alongside prompt strings
- Section breakdowns persist in `ai_call_log`
- Aggregation functions in the module handle the standard queries
- Tests cover: builder breakdowns are accurate; aggregations return expected shapes; token counts within reasonable tolerance of actual API counts
- DECISION_LOG entry on the section-boundary inference approach

### §4.7 What SC-4a.3 explicitly does NOT do

- Doesn't change prompt structure (read-only)
- Doesn't optimize prompts (Phase 4b)
- Doesn't add new sections to existing prompts

---

## §5. SC-4a.4 — Diagnostic query surface

### §5.1 What this builds

The user-facing way to actually use SC-4a.1, SC-4a.2, and SC-4a.3. Lightest weight that's genuinely usable.

### §5.2 The shape

Three surfaces, in priority order:

**(a) Debug page** — a new page in the app accessible at a stable URL (e.g., `/debug/ai-behavior`). Lists recent AI calls; shows captured data per call; surfaces signal computations; lets the user filter by character/session/time range. Modal pattern from the Settings page is the wrong fit (this is a power-user analysis surface, not a configuration surface) — just a page. Lightweight visual treatment, no Design pass needed.

**(b) CLI tool** — a script invocable from the command line that takes query parameters and returns structured output. Useful for the user to grep through data, save reports, or compose with other tools.

```bash
node scripts/ai-behavior.js --character-id=42 --session-id=last --signal=marker-correction-rate
```

**(c) Raw SQL access** — the data is in SQLite; users can run SQL directly against `ai_call_log` if the higher-level surfaces don't answer their question. Documented schema is the deliverable here; no separate tooling.

### §5.3 What goes on the debug page

The page is biased toward "show me what happened in the last session" since that's the common use case during gameplay-driven investigation:

- Filter controls: character (dropdown), session (dropdown — defaults to most recent), time range
- Summary panel: signal computations for the filtered scope (marker correction rate, repetition triggers, response length distribution, scope-of-application flags)
- Call list: each AI call in the filter scope, sortable, clickable to expand
- Per-call detail: full prompt, full response, captured metadata, computed signals for that call

Visual treatment: editorial register relaxes further from the Settings page. This is a tool surface for the user (and for PM during collaboration). Functional clarity is the only goal. Plain typography, dense layout, no decorative ornaments.

### §5.4 What goes in the CLI tool

The CLI is more flexible than the page — assumes user knows what they're asking. Standard Unix-style: parameters, output to stdout, composable with grep/jq/etc.

```bash
# List recent sessions for a character
node scripts/ai-behavior.js sessions --character-id=42 --limit=10

# Compute a signal across a date range
node scripts/ai-behavior.js signal --signal=name-reuse --since=2026-04-01

# Export call log for a session as JSON
node scripts/ai-behavior.js export --session-id=last --format=json
```

The CLI exposes the same signal functions as the page but with more flexible parameter combinations.

### §5.5 Implementation shape

Debug page is a React component or pair of components, served from the existing app. CLI tool is a Node script in `scripts/` that uses the same signal functions. Both consume from the same backend module (the signals module from SC-4a.2).

The user authentication question doesn't apply since this is a single-user system.

### §5.6 Acceptance criteria

- Debug page exists at stable URL, accessible from the app
- Filter controls work; signal computations display; call list paginates
- Per-call detail view shows captured prompt, response, and metadata
- CLI tool exposes the same signal functions with command-line invocation
- Schema for `ai_call_log` is documented in CLAUDE.md
- Tests cover: debug page renders correctly with sample data; CLI tool produces correct output for sample queries; SQL schema documentation matches actual schema
- No Design dependency — Code's editorial-register-relaxed treatment is fine

### §5.7 What SC-4a.4 explicitly does NOT do

- Doesn't surface diagnostic info to general gameplay UI
- Doesn't add visualization beyond simple listings and tables
- Doesn't add real-time monitoring (refresh-on-demand only)
- Doesn't add export to external analytics tools

---

## §6. Engineering notes

### §6.1 DB shape decisions

- **One new schema migration** (053 or next available) creating `ai_call_log` table.
- **Possibly extending the same migration** with an `ai_signal_cache` table if signal computation turns out expensive enough to warrant caching (Code's call during implementation; not required if signals are fast enough).
- **No changes to existing tables** — Phase 4a is purely additive.

### §6.2 Backwards compatibility

- All existing AI call sites work unchanged after migration to the logging helper (the helper is transparent to callers).
- Existing diagnostic infrastructure (Lean Prompt toggle, Sonnet/Opus selector, prose-quality harnesses) continues to work alongside Phase 4a's new instrumentation.
- No data migration needed.

### §6.3 Test strategy

- **SC-4a.1 tests:** logging helper wraps calls correctly; captured data matches input; failed API calls log appropriately; existing call-site behavior is byte-identical.
- **SC-4a.2 tests:** each signal function returns documented shape; known-input/known-output verification; edge cases (empty log, single call, long ranges).
- **SC-4a.3 tests:** prompt-builder breakdowns are accurate; section boundaries inferred correctly; aggregations work.
- **SC-4a.4 tests:** debug page renders correctly with sample data; CLI tool produces correct output; SQL schema matches code.
- **Regression tests:** all existing test suites stay green; AI call sites produce identical output to pre-migration.

### §6.4 Sub-checkpoint structure

Phase 4a internal sub-checkpoints (informal, Code's discretion to ship as 1-2 ships):

- **SC-4a.1** — Prompt-response capture
- **SC-4a.2** — Quality signal aggregation
- **SC-4a.3** — Prompt-shape accounting
- **SC-4a.4** — Diagnostic query surface

Likely cadence:
- One ship: SC-4a.1 + SC-4a.2 + SC-4a.3 (all backend instrumentation, naturally cohesive)
- Second ship: SC-4a.4 (the user-facing query surface)

But Code may judge a single ship cleanest, or three ships (split SC-4a.1 from the others). End-of-phase review covers cumulative state.

### §6.5 What Phase 4a makes possible (downstream)

Everything in Phase 4b. Specifically:

- **Investigation #1 (constraint audit)** uses SC-4a.1 captured data + SC-4a.2 signals + SC-4a.3 prompt accounting to evaluate each constraint against current evidence
- **Investigation #2 (continuity preservation)** uses time-drift, name-reuse, and detail-canon signals to characterize the failure cluster
- **Investigation #3 (shelter-fixation)** uses response-content analysis on captured prompts/responses
- **Investigations #4-#8** all benefit from the captured data being available

Phase 4b couldn't run without Phase 4a's foundation.

---

## §7. Open questions

Resolved during drafting; no PM calls outstanding for Phase 4a.

**Q1 — Should signals cache, or compute on-demand?** Code's call during implementation. If on-demand is fast enough, skip caching. If not, add `ai_signal_cache` table.

**Q2 — Should the debug page be access-controlled?** No — single-user system, user IS the audience. Plain access fine.

**Q3 — Should captured prompts/responses be stored encrypted?** No — same reasoning; plus the existing project DB doesn't encrypt other content.

**Q4 — How long does the log retain data?** Forever for now. Archival is future work; Phase 4a just makes future archival possible by including the `archived_at` column.

**Q5 — Section-boundary inference (SC-4a.3) — exact vs. heuristic?** Code's call. Exact requires modifying each prompt builder; heuristic uses regex/pattern matching on existing output. Heuristic is fine for first version; exact when it's worth the work.

---

## §8. Handoff to Code

### §8.1 What this spec is

A scoping document for Phase 4a implementation. PM has authored the spec; Code implements end-to-end. No Design dependency.

### §8.2 Sequence Code follows

1. **Implement SC-4a.1 → SC-4a.2 → SC-4a.3 → SC-4a.4** in the order that makes most sense to Code (likely the order listed since each builds on the prior). Internal ship cadence Code's discretion.
2. **Ship for end-of-phase review.** PM + user review the cumulative Phase 4a state.
3. **Iterate per review feedback.** Phase 4a closes when review passes.

### §8.3 What Code is being asked to do

- Build `ai_call_log` table and the wrapping logger helper
- Migrate all existing AI call sites to use the helper
- Implement seven primary signals + scope-of-application signal
- Add prompt-builder section accounting
- Build debug page and CLI tool
- DECISION_LOG entries per sub-checkpoint
- Tests per §6.3

### §8.4 What Code is NOT being asked to do

- Modify production prompts in any way (Phase 4b)
- Investigate specific AI behaviors (Phase 4b)
- Build alerting, real-time monitoring, or external analytics integration
- Pre-optimize for archival or pruning (future work)
- Add Design pass for the debug page (functional treatment is fine)

### §8.5 Standing by

PM is available throughout for clarification. Surface questions when they arise. Standing by for end-of-phase review when the work is ready.

---

## Document footer

**Authored:** 2026-05-06 by PM.
**Lock date:** 2026-05-06.
**Supersedes:** Nothing.
**Related:**
- `PHASE_4_OVERVIEW.md` — framing this spec inherits
- `PHASE_4B_SPEC.md` — the investigation phase Phase 4a unblocks
- `Order_of_Dawn_s_Light_-_Original_Campaign_Conversations_with_Claude.pdf` — reference texture
- `AI_NARRATIVE_PERSISTENCE.md`
- `DECISION_LOG.md` — to receive Phase 4a entries during implementation
- `CONSOLIDATED_TODO.md` — to be updated to reflect Phase 4a active