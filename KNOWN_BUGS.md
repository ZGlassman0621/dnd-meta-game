# Known Bugs

Tracked issues that are real and reproducible but not currently being fixed. Distinct from `FUTURE_FEATURES.md` (designed features deferred) and `triage/` (active investigations). This is for: "we know this is broken, we're not fixing it yet, here's why."

## When to add an entry

- Code or PM surfaces a bug during work on something else
- Bug is real (reproducible, has a clear failure mode), not speculative
- Bug isn't being actively fixed (in flight or scheduled in current phase)
- Either the fix is bounded but lower priority than current work, OR the fix needs design/discussion before implementation

## When NOT to add an entry

- Active investigations → `triage/`
- Designed-but-deferred features → `FUTURE_FEATURES.md`
- Things shipped or being fixed in current phase → CHANGELOG and current spec docs
- Speculative concerns ("this might be a bug if X") → leave in conversation; don't bloat the bug log with theory

## Entry shape

Each entry should specify:

- **What's broken.** Concrete failure description, not a vague concern.
- **Where in the code.** File path + line range or function name. Stale line refs are fine; the function name is the durable anchor.
- **Surfaced.** When and how the bug was discovered (e.g., "Pattern D survey, 2026-05-04").
- **Severity.** Cosmetic / Functional / Data-integrity / Blocker. Brief rationale if not obvious.
- **Why deferred.** What's preventing the fix right now (in-flight work elsewhere; needs design call; bounded but lower priority; etc.).
- **Trigger to revisit.** What event, milestone, or condition should prompt a fix attempt. "Next phase that touches this surface" is a valid trigger.
- **Fix shape (if known).** One-paragraph sketch of what fixing it would look like. Skip if the fix needs design.
- **Related.** Files, related bugs, related FUTURE_FEATURES entries, related DECISION_LOG entries.

## Severity definitions

- **Cosmetic** — Visual or text glitch with no functional impact. Player notices nothing or is mildly confused.
- **Functional** — A feature doesn't work as intended; player can work around it or system has acceptable graceful degradation.
- **Data-integrity** — State written to DB is wrong, inconsistent, or lost. Worse than functional because it can compound silently.
- **Blocker** — A primary use case is broken; player can't proceed; system is unusable for the affected feature. Should not be in this file long; should escalate to active fix.

---

## Active known bugs

_None for the v2.0 MVP._

## Obsoleted by the v2.0 MVP (party-base / fortress system archived)

_The entries below describe the fortress / party-base system, which was archived to `/archive/` in the v2.0 reduction — so they are no longer live bugs. Retained for history; restore that system before revisiting them._

### Recapture window without recapture mechanism

**What's broken.** Captured fortresses enter a 14-day recapture window during which the player is theoretically meant to be able to win the base back. The window expiry mechanism exists (`expireStaleCapturedBases` runs in the living-world tick, `RECAPTURE_WINDOW_DAYS = 14` in `raidConfig.js`, the `BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER` from Phase 3.3 SC-7.5 fires correctly). What doesn't exist: any player-side codepath to actually perform the recapture. No `recaptureBase` function. No marker the AI emits to flip a captured base back to active. No quest framework. No UI affordance.

The window opens, the deadline runs out, the base flips to abandoned. The player never had a way to use the window.

**Where in the code.**
- `RECAPTURE_WINDOW_DAYS` constant: `server/config/raidConfig.js`
- Window expiry path: `expireStaleCapturedBases` in `server/services/baseThreatService.js`
- Threshold consumer: `BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER` (Phase 3.3 SC-7.5)
- Missing: any inverse path that flips status back to active

**Surfaced.** Pattern D survey, 2026-05-04. Confirmed during kingdom-management survey, 2026-05-05.

**Severity.** Functional. The mechanic exists but is unreachable from the player's seat. Player who loses a fortress experiences a 14-day "ghost window" that does nothing.

**Why deferred.** The user's 2026-05-05 fortress design vision treats recapture as a multi-session quest arc with ally requirements, coordination beats, and dramatic stakes — substantively bigger than a marker handler. Belongs to the future fortress system design phase (Phase 5 candidate).

**Trigger to revisit.** Fortress system design phase opens scope for the recapture quest framework.

**Fix shape.** Recapture quest framework — multi-session arc with allies/preparation/coordination phases. Real feature design work, not a small fix. Belongs to the fortress system design phase's first deliverable list.

**Related.**
- `triage/kingdom-management-survey.md` §1.5
- `PHASE_3_7_SPEC.md` §1.2 (deferral rationale)
- 2026-05-05 user design call (recapture is a quest, not a marker)

---

### Holdings purpose data is stub

**What's broken.** Player bases are distinguished by `subtype` (outpost, watchtower, tavern, hall, keep, fortress, manor, castle, chapel, temple, sanctuary, wizard tower) but no data captures what each holding *does* or *produces*. The user's design vision: watchtowers grant advance warning of enemy movement, mines/logging camps generate wealth and raw materials, trading posts boost income or notoriety, temples reinforce a deity's presence, etc. None of this exists in code. Holdings are visually differentiated but mechanically identical aside from defense_rating contribution.

**Where in the code.**
- `party_bases` table schema: `server/migrations/` (whichever migration defines `party_bases`)
- Subtype list: scattered in `partyBaseConfig.js` and elsewhere
- Missing: `holding_role` / `production_profile` / equivalent data

**Surfaced.** Kingdom-management survey, 2026-05-05. User fortress design discussion, 2026-05-05.

**Severity.** Functional. The mechanic that makes holdings *worth building for different reasons* doesn't exist. Players currently choose holding subtype primarily for narrative flavor and defense_rating; production/utility value is invisible.

**Why deferred.** Holdings purpose is framework-shaped but its consumers (holdings management UI, building-purpose mechanics, narrative-driven threat origination keyed off region/holding context) don't exist yet. Designing the data shape now means guessing at consumer needs. Belongs to the fortress system design phase where the framework gets designed alongside its first real consumer.

**Trigger to revisit.** Fortress system design phase opens scope for holdings management UX and building-purpose mechanics.

**Fix shape.** Schema migration adds `holding_role` (or equivalent) data on `party_bases`. Default values backfill from `subtype`. Each subtype gets a default purpose (watchtower → 'advance_warning'; outpost → 'patrol_presence'; trading_post → 'income_boost'; etc.). Real data shape designed in concert with the consumer.

**Related.**
- `triage/kingdom-management-survey.md` §1.7
- `PHASE_3_7_SPEC.md` §1.2 (deferral rationale)
- 2026-05-05 user fortress design vision

---

## Resolved known bugs (archive)

Once a bug is fixed, move its entry here with the version it shipped in. Keeps history without bloating the active list.

### Producer gap — raid-capable event types had no producer — *resolved in v1.0.164 (Phase 3.7 SC-3.7.1)*

**What was broken.** `RAID_CAPABLE_EVENTS` defined five event types (`bandit_activity`, `war`, `undead_uprising`, `mercenary_incursion`, `cult_activity`) that `generateThreatsForCampaign` read to spawn fortress threats. No production code path created `world_events` rows with any of those event types. The Opus living-world-generator prompt instructed different types entirely. Faction-milestone spawner emitted different types entirely. **Threat-from-event spawn was dead code in production.** Players never experienced fortress threats from world events.

**Where in the code.**
- `RAID_CAPABLE_EVENTS`: `server/config/raidConfig.js`
- Reader: `generateThreatsForCampaign` in `server/services/baseThreatService.js`
- Producers: none

**Surfaced.** Kingdom-management survey, 2026-05-05.

**Severity at time of discovery.** Functional. Major fortress system feature was non-functional in production.

**Resolved.** Phase 3.7 SC-3.7.1 (v1.0.164). Fortress threat origination moved to a marker-driven mechanism: AI DM emits `[FORTRESS_THREAT]`, handler in `baseThreatService.js` creates `base_threats` row directly. The producer gap is no longer a gap because threats no longer originate from world events. The legacy `generateThreatsForCampaign` path is deprecated but kept in place; no longer the canonical origination mechanism.

**Resolution mechanism.** Fix-along-the-way pattern (sixth instance). Bug surfaced during structural prep work for Phase 3.7; structural change subsumed the fix.

**Related.**
- `triage/kingdom-management-survey.md` §0
- `PHASE_3_7_SPEC.md` §2

---

### Mechanical-damage asymmetry — player-led defense was mechanically free — *resolved in v1.0.164 (Phase 3.7 SC-3.7.2)*

**What was broken.** When a fortress threat auto-resolved with `damaged` outcome, `computeDamageFromOutcome` mutated buildings, treasury, and garrison (real mechanical loss). When the player engaged via `defending` flow and the marker reported `damaged`, `recordPlayerDefenseOutcome` wrote the outcome and damage_report JSON blob but **did not mutate base buildings/treasury/garrison.** Only narrative damage was recorded.

The result: engaging defense was mechanically free (worst case: no mechanical damage), while ignoring threats could cost real resources (worst case: real garrison/treasury loss). Created a perverse incentive to always engage even when narratively senseless.

**Where in the code.**
- Auto-resolve damage: `computeDamageFromOutcome` in `server/services/baseThreatService.js`
- Player-led path: `recordPlayerDefenseOutcome` in same file (lines 522-543)

**Surfaced.** Kingdom-management survey, 2026-05-05 §1.6.

**Severity at time of discovery.** Functional. Created incentive misalignment that would degrade gameplay over time.

**Resolved.** Phase 3.7 SC-3.7.2 (v1.0.164). `recordPlayerDefenseOutcome` now runs `computeDamageFromOutcome` for `damaged` and `captured` outcomes, applying mechanical damage to buildings/treasury/garrison the same way auto-resolve does. The damage_report JSON blob continues to populate. `repelled` outcomes continue to apply zero damage. Player-led `damaged` defaults to mild sub-tier (margin treated as 0); future severity field on the marker can override.

**Resolution mechanism.** Direct fix during Phase 3.7. Not a fix-along-the-way (this was an explicit acceptance criterion of SC-3.7.2, not an incidental discovery).

**Related.**
- `triage/kingdom-management-survey.md` §1.6
- `PHASE_3_7_SPEC.md` §3
- 2026-05-05 user ruling: "damage should never just be narrative"

---

### World events: real-time clock instead of game-day clock for deadline + stage-advance — *resolved in v1.0.161 (Phase 3 SC-7.7)*

**What was broken.** `worldEventService.processEventTick` used `new Date()` and ISO timestamp comparisons for both deadline checks (`new Date(event.deadline) < new Date()`) and stage-advance calculations (`(new Date() - new Date(event.started_at)) / (1000 * 60 * 60 * 24)`). This made world events the only consumer in the codebase NOT running on the `currentGameDay` clock — every other time-bounded state surface used integer game-day arithmetic. Practical impact: a player who created a world event in real-time and then played slowly (e.g., one game-day advance per real-day) would see events fire deadlines or advance stages based on real-world elapsed time, not in-game elapsed time. A campaign played briefly over a real-time week could see events firing as if many game-days had passed.

**Where in the code.** `server/services/worldEventService.js::processEventTick` lines 459-486 (pre-SC-7.7). Two distinct comparisons: deadline check (line 461-462) and stage-advance duration calculation (line 475-477).

**Surfaced.** Pattern D survey §1.12 (2026-05-04). Code flagged the divergence as part of the cross-cutting "two clocks, same name" finding (orientation note from triage/pattern-d-survey.md). PM Q10 ruling: in scope for Phase 3.3, fixed via SC-7.7.

**Severity.** Functional / Game-state-consistency. World events drive narrative pacing; firing on the wrong clock means the story progresses based on how long the player has owned their save rather than how much in-game time has elapsed. Severity scales with how aggressively players use the deadline / staged-event mechanic; in solo D&D campaigns where game-day-per-real-day ratio is variable, the bug surfaces noticeably.

**Fix shape.** SC-7.7 migration: (1) add `started_game_day` and `deadline_game_day` integer columns to `world_events` via migration 051; (2) backfill `started_game_day` for active events to MAX(game_day) per campaign at migration time (treats existing events as "started today" in game-time terms — past stage advances are baked into `current_stage` already, so future advances measure from the fresh anchor); (3) deadline check delegates to `WORLD_EVENT_DEADLINE_THRESHOLD_CONSUMER` (Pattern D abstraction; threshold=0; SELECT-pre-filter idempotency); (4) stage-advance uses `daysSince(started_game_day, currentGameDay)` instead of real-time arithmetic; (5) `processEventTick` signature changes from `(campaignId, gameDaysPassed)` to `(campaignId, currentGameDay)` — `livingWorldService` caller updated to pass `MAX(game_day)` for the campaign.

**Backfill caveat.** Legacy events without `started_game_day` (pre-migration data with NULL backfill, or events without an associated character to derive game_day from) gracefully no-op via the helper's null-anchor short-circuit. Stage advance won't fire; deadline check won't fire. Ungated rather than incorrectly fired.

**Fix-along-the-way #5** in Phase 3 — joins the named pattern alongside notoriety silent-drop (SC-6.4c), NPC absence ×2 (SC-7.3), and dehydration weather modulation (SC-7.6). Each surfaced during prep work and resolved through the migration mechanism.

**Related.** [DECISION_LOG.md](DECISION_LOG.md) Phase 3.3 SC-7.7 entry (final §3.3 ship), [server/services/worldEventService.js](server/services/worldEventService.js), [server/migrations/051_world_event_game_day_columns.js](server/migrations/051_world_event_game_day_columns.js), [tests/world-event-clock-fix.test.js](tests/world-event-clock-fix.test.js).

---

### Dehydration: hot-weather acceleration documented but not implemented — *resolved in v1.0.160 (Phase 3 SC-7.6)*

**What was broken.** `survivalService.checkDehydration` had a documented behavior (in the function's JSDoc + the prose accompanying the legacy heat-doubling comment): "Hot weather (heat_wave or temp > 85) doubles water needs — 0.5 days without water counts as a full day." But the implementation only added a string to the message ("Hot conditions double water needs — situation is critical."). Exhaustion levels did NOT actually accelerate. A character at 1 raw day in hot weather got the same 1 exhaustion level as a character at 1 raw day in cool weather, despite the docs saying hot conditions should double the effective rate.

**Where in the code.** `server/services/survivalService.js::checkDehydration` lines ~210-236 (pre-SC-7.6). The `isHot` boolean was computed but only consumed by string-concatenation; the `exhaustionLevels` calculation depended only on `daysWithout` (the raw counter).

**Surfaced.** Pattern D survey (§1.6.1, 2026-05-04). Code flagged the docs/code divergence as a wrinkle for SC-7.6 to resolve. PM ruling 2026-05-05: implement the doubling.

**Severity.** Functional / Game-balance. D&D 5e exhaustion mechanics are a real gameplay lever; missing the doubling means players in heat-wave or desert scenarios were under-penalized for water scarcity. Severity scales with how often hot-weather + low-water scenarios occur in production play (occasional but not rare).

**Fix shape.** SC-7.6 migration's `DEHYDRATION_THRESHOLD_CONSUMER` reads `hint.weather` in the handler. Effective elapsed = raw × (hot ? 2 : 1). Exhaustion levels = effective_days >= 2 ? 2 : 1. So 1 raw day in hot weather = 2 effective days = severe-tier exhaustion (2 levels) immediately. 2 raw days in hot = 4 effective (capped at severe-tier 2 levels). The `isHotWeather()` helper preserves the legacy detection logic (heat_wave type OR temperature > 85F).

**Resolution category**: fix-along-the-way #4 (after SC-6.4c notoriety silent-drop; SC-7.3's compound-prefix relocate + repeat-fire forget). The migration mechanism's contextHints plumbing naturally accommodates the weather-state read; the bug fix lands as a side effect of the structural change. The "fix-along-the-way" pattern is now load-bearing methodology for Phase 3 refactors — see DECISION_LOG entry 2026-05-05 SC-6.4 close-out for the named pattern.

**Related.** [DECISION_LOG.md](DECISION_LOG.md) Phase 3.3 SC-7.6 entry, [server/services/survivalService.js](server/services/survivalService.js), [tests/survival-timer-cleanup.test.js](tests/survival-timer-cleanup.test.js) HEADLINE section.

---

### NPC absence: compound `Unknown (left ...)` prefix on repeated relocation — *resolved in v1.0.157 (Phase 3 SC-7.3)*

**What was broken.** `npcAgingService.checkAbsenceThreshold` rolled a 10% relocation chance every session-start tick when an NPC had been absent 60+ days with negative disposition. The handler updated `npcs.current_location` to `Unknown (left <previous-location>)` but had no idempotency. On consecutive ticks where the roll happened to pass twice, the location compounded into `Unknown (left Unknown (left Tavern))`, then `Unknown (left Unknown (left Unknown (left Tavern)))`, etc. Pure cosmetic (no game-state implications), but the location string degraded.

**Where in the code.** `server/services/npcAgingService.js::processAbsenceEffects` lines ~177-194 (pre-SC-7.3) — the inline `if (threshold.type === 'relocate' && rel.current_location)` branch.

**Surfaced.** SC-7.3 implementation prep, 2026-05-05. Discovered while designing the idempotency strategy for the migration's `RELOCATION_THRESHOLD_CONSUMER`. The legacy code's lack of idempotency was directly visible in the code path.

**Severity.** Cosmetic. The location string degrades on repeated relocation rolls but no game state breaks. Probability of compound-prefix per consecutive sessions = 0.1 × 0.1 = 1%; per three sessions = 0.1%. So the bug surfaces rarely in practice but accumulates over long campaigns.

**Why deferred (until SC-7.3).** Bug was undiscovered until SC-7.3 prep. The Pattern D migration mechanism naturally provides an idempotency-strategy slot (`registerThresholdConsumer.idempotency.hasFiredRecently`); checking the location prefix becomes the natural fired-once marker. Fix-along-the-way pattern (named in SC-6.4 close-out): the structural change subsumes the bug's failure mode without a separate fix ship.

**Fix shape.** SC-7.3 migration registers `RELOCATION_THRESHOLD_CONSUMER` with `hasFiredRecently: async () => current_location.startsWith('Unknown (left ')`. The abstraction blocks repeat fires when the location already carries the prefix. No standalone fix; resolved as a side effect of the migration.

**Related.** [DECISION_LOG.md](DECISION_LOG.md) Phase 3.3 SC-7.3 entry, [server/services/npcAgingService.js](server/services/npcAgingService.js).

---

### NPC forget: wasted UPDATE on every tick once disposition+trust both at 0 — *resolved in v1.0.157 (Phase 3 SC-7.3)*

**What was broken.** Companion bug to the relocate compound-prefix above. Once `checkAbsenceThreshold` fired the "forget" effect (set `disposition = 0, trust_level = 0` after 120+d absence + low trust), the legacy code re-checked the threshold every subsequent tick. The condition `daysAbsent >= 120 && rel.trust_level < 10` still held (trust=0 is < 10), so the handler fired again, executed `UPDATE npc_relationships SET disposition = 0, trust_level = 0` (no-op data-wise), and consumed a DB round trip per tick per forgotten NPC.

**Where in the code.** Same processAbsenceEffects function, the `else if (threshold.type === 'forget')` branch.

**Surfaced.** Same prep work as the relocate bug above.

**Severity.** Cosmetic / Performance. Wasted UPDATEs accumulate proportional to (number of forgotten NPCs × number of session-start ticks since forgotten). Negligible at small scale; could measurably extend session-start latency for very-long-campaign characters with many forgotten NPCs.

**Fix shape.** SC-7.3 migration's `FORGET_THRESHOLD_CONSUMER.idempotency.hasFiredRecently` checks `disposition === 0 && trust_level === 0` — pure post-fire state signature. Once forgotten, idempotency blocks repeats.

**Related.** Same as above.

---

### Notoriety silent-drop on canonical-format markers — *resolved in v1.0.152 (Phase 3 SC-6.4c)*

**What was broken.** `[NOTORIETY_GAIN]` and `[NOTORIETY_LOSS]` markers emitted by the DM AI in the canonical prompt-instructed format (quoted, space-separated: `[NOTORIETY_GAIN: source="City Watch" amount=15 category="criminal"]`) were silently dropped. The detect-functions used `parseMarkerKeyValue` which expects comma-separated, possibly-unquoted values (`source=City Watch, amount=15, category=criminal`). When the AI emitted canonical, the parser's `str.split(',')` yielded one entry; key-extraction on that single entry produced garbage (`source = '"City Watch" amount=15 category="criminal"'`) and the truthy-check `if (data.source && data.amount)` rejected it. Result: the notoriety side effect never fired. No error logged, no correction-loop feedback, no client visibility.

**Where in the code.** `server/services/dmSessionService.js::detectNotorietyGain` (lines 793-809) and `::detectNotorietyLoss` (lines 815-829). The shared `parseMarkerKeyValue` helper at line 836 is the source of the format mismatch.

**Surfaced.** SC-6.4 implementation prep, 2026-05-05. Discovered while spot-checking the survey's "alternative parser" PM call against the actual code path — the divergence between the prompt-instructed format and the detect-function's parser was visible in source.

**Severity.** Functional / Data-integrity. The notoriety system is a real game mechanic (entanglement risk, faction reactions). Silent drops mean players accumulated less heat than the AI intended; the AI's narrative-side notoriety acknowledgments wouldn't match the DB state. How often this triggered depended on whether the AI followed the prompt format literally; given the prompt is explicit about quoting, likely most or all production NOTORIETY emissions silently dropped.

**Why deferred (until SC-6.4).** Bug was undiscovered until SC-6.4 prep work. Fix-along-the-way is the right ship-shape: the SC-6.4 migration replaces both detect-functions with handlers backed by `markerSchemas.js` parsing (the schema's `extractField` regex handles both quoted-space-sep AND unquoted-comma-sep formats natively via its third alternation). Migration auto-resolves the bug without a separate fix.

**Fix shape.** SC-6.4 migration: replace `detectNotorietyGain`/`detectNotorietyLoss` call sites in `routes/dmSession.js` with handlers registered via `markerPipeline`. Handlers consume the schema's parsed output (already validated against `MARKER_SCHEMAS.NOTORIETY_GAIN` / `NOTORIETY_LOSS`) and call the existing `notorietyService` functions. The `parseMarkerKeyValue` helper becomes dead code; legacy `detectNotoriety*` exports kept per "deprecate by hiding" but no longer invoked from production.

**Related.** [DECISION_LOG.md](DECISION_LOG.md) Phase 3 SC-6.4 entry, [triage/q6-detect-function-survey.md](triage/q6-detect-function-survey.md) Tier 1B notoriety rows.