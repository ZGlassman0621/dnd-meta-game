# Pattern D / Time-Bounded State — Survey

**Audience:** PM drafting `PHASE_3_REFACTOR_SPEC.md` §3.3 (Pattern D primitives)
**Author:** Code, 2026-05-04
**Scope:** Every place "wait N game-time units, then do X" logic exists today
**Status:** Read-only survey. No code changes. Same shape as the prior Pattern A/§3.1 survey.

---

## TL;DR (orientation)

There are **at least 11 distinct time-bounded state surfaces** in the codebase today, falling into four shapes:

1. **Decay-on-read** — score declines proportional to elapsed days; computed lazily when checked. NPC disposition decay, NPC trust decay, notoriety decay, companion mood decay (almost — see §1.1 for the wrinkle).
2. **Threshold-crossed-with-effect** — counter ticks each day; once it crosses a threshold, an irreversible effect fires. Starvation / dehydration; promise auto-break; quest auto-fail; merchant order auto-expire; base-recapture window expiry; world-event deadline expiry.
3. **Stage-advance-on-elapsed** — multi-stage state that progresses N stages over M days, advancing one stage at a time. World event stage advancement (the only consumer today).
4. **Round-bounded session-scoped state** — combat effect duration in rounds, decremented when "Next Round" is clicked. Lives client-side only (no server persistence). Single consumer (`EffectTracker.jsx`); arguably shouldn't be in Pattern D scope at all (see §6).

The shapes share a clear underlying primitive — **(start_marker, threshold, current_clock) → status / effect**. But the **storage of `start_marker` is everywhere**: own column on the row (last_decay_game_day, last_interaction_game_day, mood_set_game_day, game_day_made), implicit in another column (notoriety: last_event_game_day fallback), in JSON blob entries (promises array), or absent entirely (read-time-now for world events). And **what fires on threshold cross is everywhere**: SQL UPDATE in place, separate side-effect call, narrative-queue push, status flip + audit, no-op log entry.

Two orientation observations worth flagging upfront:

- **Game-day arithmetic is open-coded everywhere.** Every consumer does `currentGameDay - lastSomethingDay` inline. There's no `daysSince(row, currentGameDay)` helper. This is a 1-line repetition × ~20 sites; trivial to extract but never has been. A Pattern D primitive that exposes `daysSince(timestamp, now)` as a normalized helper would shave it off without much spec.
- **The clock itself has *one* canonical store** (`characters.game_day` / `game_hour` / `game_year`) but multiple advancers (`advanceGameTime` from metaGame.js, plus inline `+= 1` in survival, plus implicit advance from sessions). Pattern D shouldn't re-abstract the clock — it should treat `game_day` as the assumed input. But it's worth knowing the clock has multiple writers.

---

## §1. Surface inventory

Each entry: file:line span, shape, what it triggers, storage of the timer state, surprises.

### §1.1 Companion mood decay
**File:** `server/services/companionBackstoryService.js:608-645` (`decayMoods`)
**Shape:** Threshold-stepped decay. Mood intensity drops by `Math.floor(daysElapsed / 2)` on every call. Reset to `'content'` when intensity reaches 0.
**Trigger:** Called at session start from `routes/dmSession.js:773` (in the Phase B "mutations" Promise.all alongside `processAbsenceEffects`).
**Timer state:** `companion_backstories.mood_set_game_day` (column). When the timer is consumed (intensity drops or resets to content), the timer row is wiped: `mood_set_game_day = NULL`.
**Surprise — wrong PM line reference.** PM's request mentioned `companionBackstoryService.js:460-489 mood decay logic`. Lines 460-489 are actually `linkThreadToQuest` / `resolveThread` — unrelated thread-management. The actual mood decay is at lines 608-645. Probably a stale line reference in the PM message; the function is the right one.
**Surprise — write-once timer.** Unlike NPC absence-decay (which keeps decaying forever as days roll past), mood decay is consumed: once intensity reaches 0, `mood_set_game_day` is NULLed. So the next day's tick is a no-op on this row until something re-sets the mood. This is a **subtly different shape** from the other decays — it's "decay-until-consumed" not "decay-on-read." Worth flagging in §3.3 design.

### §1.2 NPC disposition decay
**File:** `server/services/npcAgingService.js:29-57` (`calculateDispositionDecay`) + `122-198` (`processAbsenceEffects` orchestrator)
**Shape:** Decay-on-read. Three-tier piecewise function of `daysAbsent`: 8-30d → 1/5d, 31-90d → 1/3d, 90+d → 2/3d. High-trust NPCs decay at half rate. Floor: disposition can't drop below -20 from decay alone.
**Trigger:** Called at session start, alongside `decayMoods` (`routes/dmSession.js:773`).
**Timer state:** `npc_relationships.last_interaction_game_day` (column). NEVER NULLed by decay — the timer is a high-water mark of the last interaction, not a "decay credit" that's consumed. Each subsequent tick recomputes from the same anchor.
**Surprise — same trigger as mood, different shape.** Both fire at session start, both walk the same characterId, but their underlying time-state shapes are categorically different (consumed vs. high-water-mark). Pattern D shouldn't force them to converge any more than the standing-scalar abstraction forces loyalty + faction-standing to converge.

### §1.3 NPC trust decay
**File:** `server/services/npcAgingService.js:67-85` (`calculateTrustDecay`)
**Shape:** Decay-on-read. Two-tier: 15-60d → 1/10d, 60+d → 1/5d. Floor: trust can't drop below 0 from decay (and decays nothing if currentTrust ≤ 0 already).
**Trigger:** Inside `processAbsenceEffects` (same orchestrator as disposition). Runs after disposition decay on the same row.
**Timer state:** Same `last_interaction_game_day` column as disposition. **Shared timer, two scalars.** Mirror of the SC-4/SC-5 dual-scalar shape.
**Surprise — slower decay than disposition is a real design call.** Both scalars decay independently from one timer; the difference is in the decay function shape, not the timer storage. Pattern D should support "two consumers reading the same `start_marker`" as a normal case (matches the dual-scalar design from §3.1).

### §1.4 NPC absence-threshold side effects
**File:** `server/services/npcAgingService.js:94-108` (`checkAbsenceThreshold`)
**Shape:** Threshold-crossed-with-effect. At 60+d absent + negative disposition, 10% chance of NPC relocation. At 120+d + low trust, NPC "forgets" player (resets disposition + trust to 0).
**Trigger:** Same orchestrator (`processAbsenceEffects`).
**Timer state:** Same `last_interaction_game_day`. Effect is **non-deterministic** (10% relocation roll) and **consumed-but-not-rearmed** for the relocation case (location flips to `'Unknown (left X)'` once and stays).
**Surprise — silent random side effect at threshold.** Most threshold consumers in this survey are deterministic (starvation always fires at threshold). The 10% relocation roll is the only stochastic threshold-crosser. Pattern D may want a `probability` parameter on threshold descriptors.

### §1.5 NPC absence prompt annotation
**File:** `server/services/dmPromptBuilder.js:1724-1731`
**Shape:** Read-only display annotation. Three tiers (≥7d, ≥14d, ≥30d) emit different `[ABSENCE: N days]` tags into the DM prompt. No state change, no side effect — this is *prompt formatting*, not a timer mechanic.
**Trigger:** Inline in NPC line composer.
**Timer state:** `last_interaction_game_day` (read-only here).
**Surprise — third consumer of `last_interaction_game_day`.** Disposition decay, trust decay, AND prompt annotation all read the same anchor. Suggests the column has earned its denormalized status. Pattern D's likely take: the timer-anchor column stays consumer-owned; the abstraction provides `daysSince(anchor, now)` and threshold-bucket helpers, not the column itself.

### §1.6 Survival: hunger / starvation timer
**File:** `server/services/survivalService.js:151-177` (`checkStarvation`) + `239-298` (`processDayChange` orchestrator)
**Shape:** Threshold-crossed-with-effect. Counter increments daily when `last_meal_game_day < currentGameDay`. Threshold = `3 + CON_modifier` (per 5e PHB). Above threshold → 1 exhaustion level / day.
**Trigger:** Called from per-day advance paths — exact orchestration is across `processDayChange` + `routes/dmSession.js` consumers; not auto-ticked by the living-world tick (see §1.6.1).
**Timer state:** `characters.days_without_food` (counter, not anchor) + `characters.last_meal_game_day` (anchor for the "was today's meal taken" check). Eating resets `days_without_food = 0` AND `last_meal_game_day = currentGameDay`.
**Surprise — counter-style not anchor-style.** Unlike absence decay (which derives N from anchor), starvation maintains a separate counter that's incremented daily. Splits the same temporal information across two columns (`days_without_food` AND `last_meal_game_day`). Pattern D likely wants to call this out as an anti-pattern — the anchor alone is sufficient (`days_without_food = max(0, currentGameDay - last_meal_game_day - 1)`).

### §1.6.1 Survival: dehydration timer
**File:** `server/services/survivalService.js:195-221` (`checkDehydration`)
**Shape:** Same shape as starvation but tighter (1 day instead of 3+CON), stacking penalty (≥2 days → 2 exhaustion levels, not 1), and weather-modified (hot conditions accelerate effective day count).
**Trigger:** Same `processDayChange` path.
**Timer state:** Same dual-column shape (`days_without_water` + `last_drink_game_day`).
**Surprise — weather-modulated timer.** The "hot conditions count fractional days as full days" wrinkle isn't currently implemented in the counter increment (which stays at +1/day) — it just changes the exhaustion-levels output. So the prose says "0.5 days counts as a full day" but the code doesn't actually accelerate the counter. May or may not be intended; flagging for PM review separately.

### §1.7 Promise auto-break / overdue warning
**File:** `server/services/consequenceService.js:25` (constants) + `320-362` (`checkOverduePromises`)
**Shape:** Threshold-crossed-with-effect. Two thresholds per promise: explicit `deadline_game_day` if set, else `PROMISE_BREAK_DAYS = 45` after `game_day_made`. Warning fires at `PROMISE_WARNING_FRACTION = 0.5` of the way to deadline (or at `PROMISE_WARNING_DAYS = 21` if no explicit deadline).
**Trigger:** Living-world tick (`livingWorldService.js:175`).
**Timer state:** `npc_relationships.promises_made` JSON array, each promise carrying `game_day_made` + optional `deadline_game_day`.
**Surprise — warning idempotency tracked separately.** `hasRecentWarning` (lines 351) checks consequence_log to avoid double-warning. Pattern D will want to address "fired-once" idempotency as a first-class concern; many consumers reinvent this by writing to a separate audit/log table.

### §1.8 Quest auto-fail (`expired quest` cascade)
**File:** `server/services/consequenceService.js` (`checkExpiredQuests`) + `applyQuestExpiredConsequences:586-630`
**Shape:** Threshold-crossed-with-effect. Quests with `deadline_game_day` past `currentGameDay` are auto-failed; cascades to faction standing -10, narrative queue entry, consequence_log entry.
**Trigger:** Living-world tick (`livingWorldService.js:177-182`).
**Timer state:** `quests.deadline_game_day` (column).
**Surprise — none. Cleanest deadline implementation in the codebase.** Single anchor column, single check, deterministic effect. If Pattern D needs an exemplar of "do it like this," this is the model.

### §1.9 Notoriety decay
**File:** `server/services/notorietyService.js:12-15` (constants) + `92-130` (`decayScores`)
**Shape:** Decay-on-read. Above score 50: 1/day; below 50: 2/day. Zeroed entries are garbage-collected after 30d of inactivity.
**Trigger:** Living-world tick (`livingWorldService.js:198`).
**Timer state:** `character_notoriety.last_decay_game_day` AS the anchor (with fallback to `last_event_game_day` if never decayed). Updated to `currentGameDay` after each decay tick.
**Surprise — written-back anchor.** Unlike NPC absence (anchor stays at `last_interaction_game_day` regardless of how many decay ticks have run), notoriety updates `last_decay_game_day = currentGameDay` after each tick. So notoriety treats the anchor as a "last-time-checked" marker, while NPC absence treats it as a "last-time-event-occurred" marker. Different semantics, same column shape. Pattern D will need to be explicit about which model it picks (or support both).

### §1.10 Merchant order: due → ready, ready → expired
**File:** `server/services/merchantOrderService.js:235-280` (`processDueOrders`, `expireStaleReadyOrders`)
**Shape:** Two-stage threshold pipeline. Stage 1: `pending` orders with `deadline_game_day ≤ currentGameDay` flip to `ready`. Stage 2: `ready` orders held more than `holdDays = 30` flip to `expired`.
**Trigger:** Living-world tick (`livingWorldService.js:223`).
**Timer state:** `merchant_orders.deadline_game_day` (anchor for stage 1) + the `ready_at` timestamp (effectively the anchor for stage 2 — but it's a real-time timestamp not a game-day, which the 30-day-hold check converts via Date arithmetic).
**Surprise — mixed game-day + real-time anchors.** Stage 1 uses game-day arithmetic; stage 2 uses real-time arithmetic (`new Date() - new Date(ready_at)`). In practice the player advances game-days much faster than real-time, so the 30-day hold means "30 game days OR 30 real days, whichever is shorter" — likely unintended. Flagging.

### §1.11 Base-threat: recapture-window expiry
**File:** `server/services/baseThreatService.js:547-595` (`expireStaleCapturedBases`)
**Shape:** Threshold-crossed-with-effect. Captured bases auto-flip to `abandoned` after `recapture_deadline_game_day`. Side effect: narrative queue entry warning the base is permanently lost.
**Trigger:** Living-world tick.
**Timer state:** `base_threats.recapture_deadline_game_day` (anchor — already in absolute game-day, not relative).
**Surprise — none.** Same clean shape as quest auto-fail. Pattern D exemplar.

### §1.12 World event: deadline + stage-advance
**File:** `server/services/worldEventService.js:460-470` (deadline check) + `473-486` (stage advance)
**Shape:** Hybrid. Deadline check uses real-time (`event.deadline` is an ISO string compared to `new Date()`). Stage advance uses real-time too (`(new Date() - new Date(event.started_at))` divided by ms-per-day).
**Trigger:** Per-tick scan (`processWorldEventTick` — called from living-world tick).
**Timer state:** `world_events.deadline` + `world_events.started_at` + `world_events.expected_duration_days` + `world_events.current_stage`.
**Surprise — only consumer not on game-day clock.** Every other consumer above uses `currentGameDay`. World events use real-time. **This is almost certainly a bug** (or at least an inconsistency) — players progress `game_day` much faster than real-time, so stage advance and deadline expiry on world events run on a different clock than everything else. Worth a separate PM call before Pattern D drafts; not Pattern D's responsibility to fix, but the design should call out which clock it standardizes on.

### §1.13 Companion activity: completion check
**File:** `server/services/companionActivityService.js:189-220`
**Shape:** Threshold-crossed-with-effect. Activities with `start_game_day + expected_duration_days ≤ currentGameDay` are eligible for completion (Opus-resolved outcome).
**Trigger:** Polled when player checks companion status; not a tick-driven side effect.
**Timer state:** `companion_activities.start_game_day` + `expected_duration_days`.
**Surprise — not auto-resolved.** Activities don't auto-complete during the living-world tick; they sit "ready" until the player explicitly polls. Different pattern from merchant orders (which DO auto-flip to ready). Pattern D might want to call out the "auto-fire" vs. "lazy-poll" axis as a deliberate consumer choice.

### §1.14 Combat effect rounds (client-side only)
**File:** `client/src/components/EffectTracker.jsx:1-160`
**Shape:** Round-bounded countdown. `roundsRemaining` decremented on "Next Round »" click. Concentration effects (warmth visualizable via color tier).
**Trigger:** User clicks "Next Round". No server persistence.
**Timer state:** Component-local React state. No DB column, no server logic.
**Surprise — out of scope.** This isn't time-bounded *game-state*; it's session-scoped UI state. If Pattern D extends to client-side timers it would need a different abstraction (the server-side `daysSince` primitive doesn't translate). Recommend §3.3 explicitly excludes this and any other session-scoped UI counters.

---

## §2. Cross-cutting observations

### §2.1 Two clocks, same name
`currentGameDay` is the universal anchor for ~12 of the 14 surfaces. World events are the holdout (real-time). Pattern D should standardize on `currentGameDay`. World events become a separate fix (out of Pattern D scope, but flagged).

### §2.2 Five storage shapes for "when did X start?"
- **Anchor column on the row** (most common) — `last_interaction_game_day`, `mood_set_game_day`, `last_meal_game_day`, `last_decay_game_day`, `start_game_day`, `deadline_game_day`, `recapture_deadline_game_day`, `game_day_made`
- **Counter + anchor pair** — `days_without_food` + `last_meal_game_day` (redundant; counter is derivable)
- **Inside JSON blob entry** — promise's `game_day_made` field in the `promises_made` JSON array
- **Inside structured row with implicit fallback** — notoriety's `last_decay_game_day` falls back to `last_event_game_day` falls back to `currentGameDay`
- **Real-time string** — world events' `deadline` / `started_at` (ISO timestamps)

Same as the standing-scalar lesson: **storage diverges, behavior converges**. Pattern D probably wants the same parameterize-not-converge call.

### §2.3 What fires on threshold cross — also five shapes
1. SQL UPDATE in place (mood, disposition decay, notoriety)
2. Side-effect call to another service (promise break → consequence log + faction standing + reputation ripple)
3. Narrative queue push (base-recapture expiry, quest expiry)
4. Status flip + audit log entry (merchant order, base capture)
5. Free-text annotation in DM prompt (NPC absence)

Pattern D shouldn't try to abstract the side-effect; it should provide hooks (similar to standingScalar's `registerThresholdHandler`). The side-effect logic stays consumer-side.

### §2.4 Idempotency is reinvented per-consumer
- Promise warnings: `hasRecentWarning` checks consequence_log
- Notoriety decay: `last_decay_game_day` is updated post-tick to prevent re-decay on same day
- Mood decay: `mood_set_game_day` is NULLed when intensity hits 0 (prevents re-decay until re-set)
- Stage advance: relies on `current_stage` field comparison (`expectedStage > current_stage`)

A Pattern D primitive could offer "fired-once-per-period" semantics as a first-class behavior; current implementations are all bespoke and a mix of safe/unsafe (e.g., notoriety's gap from `last_event_game_day` to `last_decay_game_day` could double-decay on the first tick after an event fires — likely intended per the comment but not obvious).

### §2.5 No shared `daysSince(anchor, now)` helper
Inline `currentGameDay - someAnchor` appears at 20+ sites across these services. Trivial to extract; never has been. Lowest-effort Pattern D win is just shipping that helper. It also paves the way for unit-of-time abstraction (game-hour vs. game-day) without touching every call site.

### §2.6 Game-hour vs. game-day divergence
Most consumers use day-granularity. A handful use hour-granularity (weather effective temperature in `survivalService.js`, `getTimeOfDay` in metaGame.js, exposure-thresholds in weatherService.js — those check `weather_type` AND `effectiveTemp` but don't accumulate). No consumer accumulates hour-granularity time today (no "stand in the cold for 2 hours then take exhaustion"). If Pattern D wants to support hour-granularity timers as a future-facing primitive, the hooks exist but no real consumer is asking for it yet.

---

## §3. Suggested §3.3 scope (Code's read; PM owns the call)

**In:**
- `daysSince(anchorGameDay, currentGameDay)` normalized helper — cheapest, biggest impact
- Decay-on-read primitive — config-driven decay function, anchor column reference, floor/ceiling, optional "high-trust modifier" hook (parameterize it like standing-scalar). Targets §1.2/1.3/1.9 (NPC disposition, NPC trust, notoriety).
- Threshold-crossed-with-effect primitive — anchor column, threshold, fired-once-per-period semantics, side-effect handler. Targets §1.7/1.8/1.10/1.11 (promise auto-break, quest auto-fail, merchant order expire, base-recapture expire).
- "Decay-until-consumed" variant for §1.1 (mood) — same primitive but with anchor-NULLing semantics on consume.

**Out:**
- World event stage-advance timer (§1.12 — uses real-time clock, separate fix)
- Combat effect rounds (§1.14 — client-side only)
- Companion activity completion (§1.13 — lazy-poll, not auto-tick; arguably belongs in a "scheduled work" abstraction not a "time-bounded state" one)
- Game-clock advancement itself (`metaGame.js::advanceGameTime`) — Pattern D should *consume* the clock, not own it

**Defer to §3.3 design call:**
- Stochastic thresholds (§1.4 NPC relocation 10% roll) — could be in scope as `{value, direction, probability}` extension to the existing standing-scalar threshold descriptor; could be out as bespoke consumer logic.
- Counter-style timers like §1.6 (`days_without_food`) — recommend Pattern D treat as anchor-only (`last_meal_game_day` is enough); the counter column is redundant. But that's a migration story, not a fresh-build call.

---

## §4. Files surveyed

- `server/services/companionBackstoryService.js` (mood decay)
- `server/services/npcAgingService.js` (disposition + trust decay, absence threshold)
- `server/services/dmPromptBuilder.js:1724-1731` (ABSENCE prompt annotations)
- `server/services/survivalService.js` (starvation, dehydration, food spoilage)
- `server/services/consequenceService.js` (promise auto-break, quest expiry)
- `server/services/notorietyService.js` (notoriety decay, GC of zeroed entries)
- `server/services/merchantOrderService.js` (order due / ready / expired pipeline)
- `server/services/baseThreatService.js` (base recapture expiry)
- `server/services/worldEventService.js` (deadline + stage advance — uses real-time clock)
- `server/services/companionActivityService.js` (activity completion eligibility)
- `server/services/livingWorldService.js` (the orchestrator that calls most of the above)
- `server/services/metaGame.js` (`advanceGameTime`, time ratios, Harptos calendar)
- `client/src/components/EffectTracker.jsx` (combat round countdown — client-only)

Migrations referenced for column shape verification:
- `001_initial_schema.js` (npc_relationships, character_piety, world_events foundations)
- `011_consequence_automation.js` (`quests.deadline_game_day`)
- `030_companion_combat_safety.js` (companion conditions JSON shape)
- `033_merchant_orders.js` (merchant_orders schema)
- `037_base_threats.js` (base_threats schema)

---

## §5. Open questions for PM (when drafting §3.3)

1. **Pattern D shape: same parameterize-not-converge as Pattern A, or stricter?** The 11 consumers above span more divergent shapes than the 5 Pattern A consumers did. A stricter abstraction would force more refactoring; a looser one might not buy enough.

2. **Counter-style timers (§1.6): rip out, or live with?** `days_without_food` is derivable from `last_meal_game_day` but the column has callers in survival prompt-builder and exhaustion logic. Migration vs. tolerate.

3. **World event clock fix: in this phase, or separate?** §1.12 is using real-time clock when everything else uses game-day. Bug or design? If bug, when does it get fixed — Pattern D adoption or before?

4. **Stochastic threshold support (§1.4 relocation 10% roll): first-class or out-of-scope?** Only one consumer today. YAGNI suggests out; future-facing inclusion suggests in.

5. **Hour-granularity timers: support or block?** No consumer needs it today. Including it in the primitive shape adds a parameter no one uses; excluding it forces a future migration if a consumer needs it.

6. **Consumer ordering at session start vs. living-world tick.** §1.1, §1.2, §1.3, §1.4 fire at session start. §1.7, §1.8, §1.9, §1.10, §1.11, §1.12 fire in the living-world tick. This split is intentional (per the npcAgingService.js comment: "Called at session start [...] NOT during living world tick, to avoid compounding decay during long real-world breaks"). Pattern D should preserve the trigger choice as a consumer concern, not abstract it.

7. **Should Pattern D claim the `daysSince` helper, or is that a 2-line refactor outside the phase?** The helper is so small it could ship as Phase 3.1.5 prep work without spec. PM call.

---

## §6. Code's recommendation on §3.3 scope

Three primitives is the right scope:

1. **`daysSince(anchorGameDay, currentGameDay)`** — Day 1 ship, no spec needed. Shaves ~20 sites of inline arithmetic. Paves the way for unit-of-time abstraction without touching call sites.
2. **`registerDecayConsumer(config)`** — config-driven decay-on-read with floor/ceiling + optional modifier hooks. Migrates §1.2/1.3/1.9 cleanly, plus §1.1 with a "consumed" variant.
3. **`registerThresholdConsumer(config)`** — anchor column, threshold value, side-effect handler, fired-once semantics. Migrates §1.7/1.8/1.10/1.11.

Recommend explicit OUT for combat-round client state, world event stage-advance (until clock fix), companion activity completion (different pattern). Recommend deferred call on stochastic thresholds + counter-timer migrations.

The shape mirrors Pattern A's three-piece structure (config + repository callbacks + threshold handlers) closely enough that the engineering pattern is already familiar from SC-1..SC-5. The migrations would benefit from the same sub-checkpoint cadence (one consumer per ship, abstraction landed in its own ship first).
