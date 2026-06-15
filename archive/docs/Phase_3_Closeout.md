# Phase 3 close-out brief

**Status:** Phase 3 closed at v1.0.162.
**Span:** Started 2026-05-03 (spec authoring), shipped 2026-05-03 (SC-1+SC-6.1) through 2026-05-04 (SC-7.6.5).
**Sub-checkpoints completed:** 16 of 16 (per the locked spec).
**Ships completed:** 19 (some sub-checkpoints batched per cadence calls; SC-6.4 split into four ships per its own scope assessment).
**Phase 3.5 follows.** Settings page mini-phase between Phase 3 close-out and Phase 4.

---

## Part 1 — Plain-language summary

Phase 3 was three big pieces of plumbing work on the game's internals. None of it changes what you see when you play; all of it makes the game's internals easier to understand and easier to extend without breaking things.

### What was wrong before Phase 3

The game had grown organically. Different parts of the code that did *similar* things had each invented their own way of doing them. That meant fixing one thing took five tries because the same kind of bug was hiding in five different shapes. It also meant building new features on top was harder than it should have been, because each new thing had to figure out *which* of the five existing ways to follow.

Three specific kinds of repetition stood out:

- **Five different systems for tracking relationships and reputation.** Companion loyalty, faction standing, NPC disposition, Mythic piety, and DM Mode bond-shifts each tracked an integer score, mapped it to a label, and recorded a history. Five systems, five different implementations, five places to fix the same kind of bug.
- **Two competing systems for handling the AI's special instructions.** When the AI emits things like `[PIETY_CHANGE: ...]` or `[BOND_SHIFT: ...]` to make changes happen in the game, two parallel systems were processing those — one that validated them, one that actually applied their effects, neither aware of the other.
- **Time-based things scattered everywhere.** Mood decay, NPC forgetfulness, promise expirations, quest deadlines, merchant orders, base recapture windows — every system had reinvented its own way to ask "how many game-days have passed since X?"

### What Phase 3 did

Three consolidations:

**1. One shared mechanism for relationship/reputation tracking.** Instead of five different ways to track scores-with-labels-and-history, there's now one shared library. Each system still has its own data and its own behavior — they're not forced to be identical — but they share the underlying mechanics. New systems can plug in without reinventing the wheel.

**2. One unified pipeline for the AI's special instructions.** The two competing systems became one. When the AI emits `[PIETY_CHANGE: ...]`, the new pipeline validates that the instruction is well-formed *and* applies its effect, all in one place. If the AI gets the instruction wrong, the pipeline tells the AI next turn so it can fix the mistake. This connects two things that were artificially separate before.

**3. One shared system for time-based things.** A shared library now handles "wait N days, then do something" across the codebase. NPC mood decays the same way through the same code that tracks how long it's been since you saw them. Merchant orders, quest deadlines, and base recapture windows all use the same time-tracking primitives.

### Bonus: bugs we found and fixed

While doing this consolidation, we found five real bugs that had been silently shipping. Because the consolidation work was already touching the code where the bugs lived, we fixed them as we went:

- **Notoriety changes were silently being dropped.** The AI was emitting them in a format that the old code couldn't parse. Migrating to the new pipeline auto-fixed it.
- **NPC relocation was getting noted twice.** When an NPC who had drifted away got relocated, then later got relocated *again*, the description ended up reading "Unknown (left Unknown (left Tavern))" instead of just "Unknown (left Tavern)."
- **NPC forgetting fired every game-day.** Once an NPC's disposition and trust both hit zero, the system was firing the "they forgot you" event every single tick, just doing nothing because there was nothing left to forget. Performance issue, not visible to the player.
- **Hot weather wasn't accelerating dehydration.** The docs said it should; the code didn't actually do it. Fixed during the survival timer migration.
- **World events were running on real-world clock instead of game-day.** Players progress game-time much faster than real-time, so this was making world events behave inconsistently with everything else. Fixed during the world event migration.

### Bonus: a survival intensity slider

You asked partway through Phase 3 if the player could turn down or turn off survival mechanics if they were getting in the way of fun. We added a four-position slider — Off / Lenient / Standard / Strict — to the character data. The mechanism is now in place: the survival code reads the player's chosen intensity and adjusts behavior accordingly. The *user interface* for actually changing it (a Settings screen) is the next piece of work — it's what Phase 3.5 will build.

### What changes for you when you play

Today, after Phase 3 closes: nothing visible. The game looks and feels the same as it did before Phase 3 started. The internal cleanup is invisible.

After Phase 3.5 ships (the Settings page): you'll be able to dial survival mechanics up or down mid-game. You'll also have controls for kingdom/fortress management level and combat difficulty (the latter probably depths into Phase 4 because combat is AI-narrated rather than mechanically simulated, and tuning AI behavior is Phase 4's territory).

After Phase 4 onward: each future phase is going to be cheaper and faster than it would have been without Phase 3, because the foundations are now consistent. Building a Settings page, a holiday system, a Pattern F class feature — all of these will plug into Phase 3's foundations rather than reinventing them.

### Why this work mattered

This is the kind of work that's invisible from outside but determines whether the next year of development is fun or frustrating. With Phase 3 done, future features land cleanly. Without Phase 3, every new feature would have multiplied the existing inconsistencies, and the codebase would have gotten harder to extend over time, not easier.

---

## Part 2 — Technical synthesis (for project records)

### Phase 3.1 — Standing-scalar abstraction

Five existing systems migrated to a shared behavioral library:

- Companion loyalty (SC-2)
- Faction standing (SC-3)
- Mythic piety (SC-4) — composite contextKey, separate-table audit
- NPC disposition + trust (SC-4) — dual-scalar pattern validated
- DM Mode bond-shifts (SC-5) — directional pairs, JSON-blob storage, three call sites converged

**Architectural call:** parameterize, don't converge. Each consumer keeps its own schema, range, label bands, audit-trail strategy. Shared library provides shared behavior.

**Implementation pattern:** repository-callback storage rather than declarative table/column config. Subsumes five storage shapes through callbacks. Future-proofs eventual schema migrations.

**Two prompt-injection gaps closed:** companion loyalty and Mythic piety now reach the AI in prompts for the first time.

### Phase 3.2 — Marker pipeline consolidation

Schema-driven validation pipeline elevated to canonical status. Detect-function sprawl in `dmSessionService.js` migrated to handler-style dispatch.

- 24 handlers across 13 service files
- 39 markers in MARKER_SCHEMAS with schema validation + correction-loop active
- ~580 lines deleted from `routes/dmSession.js`
- Schemas-without-handlers as legitimate end-state (4 distinct rationales: ordering invariants, aggregated returns, no side-effect target, orchestrated-with-sibling-marker)

### Phase 3.3 — Time-bounded state primitives

Three primitives — `daysSince`, `registerDecayConsumer`, `registerThresholdConsumer` — consolidating 11 surfaces across the codebase.

- 4 decay consumers + 8 threshold consumers across the migration cluster
- Three decay semantics fully exercised (CONSUMED, HIGH_WATER_MARK, WRITTEN_BACK)
- Five idempotency strategies validated (the abstraction's three plus SELECT-pre-filter and natural-fired-once-marker)
- Player-tunable survival intensity layer (SC-7.6.5) ships mechanism-only

### Cross-phase patterns established

- **Parameterize-not-converge.** Both Pattern A (§3.1) and Pattern D (§3.3) preserved consumer divergence intentionally. The abstractions don't normalize storage; they share behavior.
- **Repository-callback storage.** Originated in §3.1 SC-1; reused in §3.3 SC-7.1. Subsumes arbitrary storage shapes through callbacks.
- **Foundation-first sub-checkpoint cadence.** Each refactor family shipped the abstraction first (SC-1, SC-6.1, SC-7.1), then migrated consumers incrementally with per-ship review gates.
- **Fix-along-the-way as methodology.** Five production bugs surfaced during structural prep work and fixed via the migration mechanism itself. Pattern is reliable enough to plan around.
- **Schemas-without-handlers as legitimate end-state.** The category accreted four distinct rationales across SC-6.3, SC-6.4a, and SC-6.4b. Pipeline validation provides value even where handler dispatch isn't appropriate.

### Cumulative numbers

- 19 ships across 16 sub-checkpoints
- ~1080 test assertions across 21 test suites
- 2 schema migrations (051 world-event game-day columns; 052 survival_intensity column)
- 5 fix-along-the-way bug fixes shipped via the migration mechanism (notoriety silent-drop, NPC absence relocate-prefix, NPC absence forget-repeat-fire, dehydration weather-modulation, world event clock divergence)

### Mechanism-without-UI items closing Phase 3

- **SC-7.6.5 survival intensity:** column ships with default `'standard'`; Phase 3.5 builds the user-facing UI.

### What Phase 3 makes possible (downstream)

- **Phase 3.5 (Settings page):** survival intensity surfacing + kingdom/fortress management level + combat difficulty controls. Mini-phase between Phase 3 close-out and Phase 4.
- **Phase 4 (AI behavior diagnostic):** marker pipeline foundation supports diagnostic instrumentation; combat difficulty tuning is prompt-injection-shaped and naturally lands here.
- **Phase 5 (focus-area execution):** Themes AI-trigger specs and Companions inter-relationship work both plug into Phase 3 foundations.
- **Phase 6 (DM Mode dedicated pass):** bond-shifts JSON-to-table migration completes against an abstraction that already supports the shape.
- **Phase 7 (long-running play):** the foundation Phase 3 built is what makes Pattern F class features and time-bounded abilities (Quick Study, per-arc, etc.) tractable.

### What Phase 3 deliberately did NOT do

- Pattern B (commitments — designed-deferred to Phase 5 focus-area work)
- Pattern C (NPC re-meeting — Phase 7 territory; needs playtest evidence)
- Pattern F (long-term campaign history as resource — Phase 7 territory; needs playtest evidence)
- AI shelter-behavior counter-mechanisms (Phase 4)
- Themes AI-trigger specs (Phase 5)
- Party Synergies marker layer (Phase 5)
- DM Mode bond-shifts JSON-to-table schema migration (Phase 6)
- Inter-companion party_relationships port (Phase 5 or 6)
- Drow Lolth standing tracker (FUTURE_FEATURES, parked)
- Companion thread event-bus migration (different paradigm; stays as-is)
- 100% detect-function deprecation (SC-6.4 took judgment calls; legitimate exceptions stay)

### Related

- `PHASE_3_REFACTOR_SPEC.md` (the spec this closes)
- `AI_NARRATIVE_PERSISTENCE.md` (the requirements doc Phase 3 addresses)
- `CONSOLIDATED_TODO.md` (project plan; updates to reflect Phase 3.5 insertion)
- `DECISION_LOG.md` entries for all 16 sub-checkpoints + 3 close-out entries (SC-6.4, SC-6.5, Phase 3.3)
- `KNOWN_BUGS.md` Resolved archive (5 fix-along-the-way entries from Phase 3)

---

**Phase 3 closed.** Phase 3.5 spec drafting begins next.