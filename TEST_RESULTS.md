# Test Results Log

## 2026-05-02 — v1.0.109 Phase 2 chunk 5 batch 1: Migration + payload contract + content data

**Change scope:** Three foundation pieces for chunk 5 (rebuilt main creator).
1. **Migration 049** — creates `prelude_canon_heirlooms` table per spec §8.1.2; documents `'creating'` value added to the `creation_phase` enum convention (column has no CHECK constraint, so the enum is application-level).
2. **Pre-fill payload reshape** — `preludeTransitionService.buildHandoffPayload()` rewritten to emit the §8.2.1 flat shape (schema_version=2). Old `locked{}/suggested{}/canon{}/biography{}` wrappers dropped. Added `pickThemeChapterBeats()` (mirror of ancestry helper); `buildAcceptedStatBumps` / `buildAcceptedSkillBumps` preserve per-fire chapter beats; `biography_seed` becomes structured array `[{age, chapter, text}]`; `mentor_imprint_eligible` boolean added. Existing consumers (PreludeTransitionScreen, CharacterCreationWizard pre-fill block) updated to read the new shape.
3. **Six content data files** — verbatim transcription from spec §7. 21 + 63 + 134 + 126 + 106 + 168 = 618 entries.

**Heirloom producer:** intentionally deferred per Option A. Spec §8.1.2 + §5.6.3 + v4 §5d annotated to record what shipped (table + consumer empty-state) and what's intentionally open (producer mechanism choice).

**Client build:** ✅ passed (1.22s).

**Regression suites:**

| Suite | Result |
|-------|--------|
| `tests/prelude-setup.test.js`               | ✅ 59 passed |
| `tests/prelude-arc.test.js`                 | ✅ 15 passed |
| `tests/prelude-markers.test.js`             | ✅ 140 passed |
| `tests/prelude-prompt.test.js`              | ✅ 180 passed |
| `tests/prelude-violation-detection.test.js` | ✅ 91 passed |
| `tests/prelude-canon-threads.test.js`       | ✅ 21 passed |
| `tests/prelude-auto-model.test.js`          | ✅ 33 passed |
| `tests/prelude-theme-commitment.test.js`    | ✅ 59 passed |
| `tests/prelude-transition.test.js`          | ✅ 25 passed |
| `tests/migration-049.test.js` (new)         | ✅ 19 passed |
| `tests/payload-contract.test.js` (new)      | ✅ 70 passed |
| `tests/theme-content-data.test.js` (new)    | ✅ 1284 passed |

**Total:** 1996 assertions green (623 existing + 1373 new). No regressions.

**Notes:**
- Payload schema bumped 1 → 2; old shape no longer emitted. Consumers were updated in the same change (per PM ruling — chunk 5 replaces the old creator anyway, no backwards-compat shim warranted).
- `[USE_NAME]` marker referenced in spec §8.2.1 but not implemented; effective `name` falls back to character first/last (which equals setup name today since the prelude doesn't mutate it). Spec-compliant fallback documented inline in `buildHandoffPayload`.
- Six new content files in `client/src/data/` ship in the bundle; smoke test verifies counts + alignment validity + bracketed-placeholder preservation. Verbatim word-by-word transcription is a manual read job — not automated.

## 2026-05-01 — v1.0.108 Phase 2 follow-up: ANCESTRY_HINT reason as celebration beats

**Change scope:** Rule 15d-bis added to preludeArcPromptBuilder (style guidance for the `reason` field on `[ANCESTRY_HINT]`). `pickAncestryChapterBeats()` helper added to preludeTransitionService — picks one beat per chapter (most recent fire), chronologically ordered, max 3. Surfaced in the handoff payload at `locked.ancestry_chapter_beats` and rendered in PreludeTransitionScreen.

**Race reconciliation:** no-op. Current `races.json` already matches the canonical worldbuilding shape; PM's reconciliation instructions hit `if`-guarded branches that resolved to no changes.

**Client build:** ✅ passed.

**Regression suites:**

| Suite | Result |
|-------|--------|
| `tests/prelude-setup.test.js`               | ✅ 59 passed |
| `tests/prelude-arc.test.js`                 | ✅ 15 passed |
| `tests/prelude-markers.test.js`             | ✅ 140 passed |
| `tests/prelude-prompt.test.js`              | ✅ 180 passed (+8 for Rule 15d-bis) |
| `tests/prelude-violation-detection.test.js` | ✅ 91 passed |
| `tests/prelude-canon-threads.test.js`       | ✅ 21 passed |
| `tests/prelude-auto-model.test.js`          | ✅ 33 passed |
| `tests/prelude-theme-commitment.test.js`    | ✅ 59 passed |
| `tests/prelude-transition.test.js`          | ✅ 25 passed |

**Total:** 623 prelude assertions green. No regressions.

**Notes:**
- Old prelude characters with null/empty ancestry-hint reasons surface fewer beats. Helper filters those rows out. No migration needed.
- The patch is additive on the read side; idempotent re-runs of `executeTransition` refresh `ancestry_chapter_beats` without regenerating the biography seed.

## 2026-05-01 — v1.0.107 Phase 2 chunk 2: Transition service + handoff

**Change scope:** Migration 048 (character_biography + mentor_imprints + characters.prelude_handoff_payload column). New preludeTransitionService.js with idempotent `executeTransition()` (Opus biography seed; mentor imprint seeding when applicable; payload + creation_phase flip). [DEPARTURE] + [PRELUDE_END] detection wired through session service. New API endpoints: GET /handoff-payload, POST /transition, GET /biography. PreludeTransitionScreen.jsx surfaces post-Prelude summary. CharacterCreationWizard accepts preludePayload prop and PUTs `creation_phase='active'` on submit per A2a option (iv). Home page renders 'ready_for_primary' characters with a "Finish creating" badge.

**Client build:** ✅ passed.

**Regression suites:**

| Suite | Result |
|-------|--------|
| `tests/prelude-setup.test.js`               | ✅ 59 passed |
| `tests/prelude-arc.test.js`                 | ✅ 15 passed |
| `tests/prelude-markers.test.js`             | ✅ 140 passed |
| `tests/prelude-prompt.test.js`              | ✅ 172 passed |
| `tests/prelude-violation-detection.test.js` | ✅ 91 passed |
| `tests/prelude-canon-threads.test.js`       | ✅ 21 passed |
| `tests/prelude-auto-model.test.js`          | ✅ 33 passed |
| `tests/prelude-theme-commitment.test.js`    | ✅ 59 passed |
| `tests/prelude-transition.test.js` (new)    | ✅ 25 passed |

**Total:** 615 prelude assertions green. No regressions.

**Notes:**
- `executeTransition` is idempotent. First call (`'prelude'` → `'ready_for_primary'`) generates biography + persists payload + flips phase. Subsequent calls on `'ready_for_primary'` characters refresh the payload but DON'T regenerate the biography (prevents conflicts with player edits to the existing creator's `backstory` textarea during the gap window).
- The handoff path uses PUT to update the existing prelude character row in place rather than POST a new row — preserves FK references from `prelude_emergences`, `prelude_canon_*`, `character_biography`, etc.
- Biography seed generation is a real Opus call; not unit-testable in isolation. Pure-logic tests (marker detection, strip, roll-up) shipped in prelude-transition.test.js. End-to-end DB exercise on first playtest.
- Home page "Finish creating" hook avoids redesigning the home page (chunk 5 territory) — additive only.

**Phase 2 closes with this release. Phase 3 (AI Narrative Persistence foundation refactors) is next per CONSOLIDATED_TODO.md.**

## 2026-05-01 — v1.0.106 Phase 2 chunk 3: Prompt builder

**Change scope:** Locked tone description replaces 4-preset / 16-tag systems; Opus arc-plan generator switches to 3-chapter shape; per-turn Sonnet prompt updated for 3-chapter / 4-session boilerplate, new authority_figure + origin_freeform setup fields, Rule 5 (age-appropriate) folded into tone description, Rule 15c (CANON_THREAD calibration) + Rule 15d (ANCESTRY_HINT slug convention) added. preludeThemeService wildcard removed. Chunk-1 graceful-degrade window for talents/cares/tone_tags closed.

**Client build:** ✅ passed.

**Regression suites:**

| Suite | Result |
|-------|--------|
| `tests/prelude-setup.test.js`               | ✅ 59 passed |
| `tests/prelude-arc.test.js`                 | ✅ 15 passed |
| `tests/prelude-markers.test.js`             | ✅ 140 passed |
| `tests/prelude-prompt.test.js`              | ✅ 172 passed (rewrote 4-preset block as locked-tone block; added authority_figure / origin_freeform / 3-chapter coverage) |
| `tests/prelude-violation-detection.test.js` | ✅ 91 passed |
| `tests/prelude-canon-threads.test.js`       | ✅ 21 passed |
| `tests/prelude-auto-model.test.js`          | ✅ 33 passed |
| `tests/prelude-theme-commitment.test.js`    | ✅ 59 passed (relaxed wildcard / "Choose Your Path" wording per simplified ceremony) |

**Total:** 590 prelude assertions green. No regressions.

**Notes:**
- `prelude_arc_plans.tone_tags` / `tone_reflection` / `chapter_4_arc` columns stay in schema; new preludes write NULL. Legacy 4-chapter plans remain readable.
- `preludeThemeService` wildcard field returns `null` (Decision 3 simplified ceremony to "leading + 3 alternatives + choose-your-own").
- Authority-figure-driven mentor seeding is wired in the prompt; chunk 2 will consume the resulting `[NPC_CANON: relationship="mentor"]` row at handoff to seed `mentor_imprints`.

## 2026-05-01 — v1.0.105 Phase 2 chunk 4: Marker handling

**Change scope:** Migration 047 (`prelude_canon_threads` + `campaign_threads`). Added `[CANON_THREAD]` detection + persistence service. Added server-side validation for `[ANCESTRY_HINT]` `feat_id` slugs against the player's race's allowed feat list. Updated chapter-weighted tally to the three-chapter shape (Ch1=1×, Ch2=1.5×, Ch3=2×). Added Ch1 rejection for `[CHAPTER_PROMISE]`. Removed `[VALUE_HINT]` detection and recording.

**Client build:** ✅ passed (`cd client && npx vite build`).

**Regression suites:**

| Suite | Result |
|-------|--------|
| `tests/prelude-setup.test.js`               | ✅ 59 passed |
| `tests/prelude-arc.test.js`                 | ✅ 15 passed |
| `tests/prelude-markers.test.js`             | ✅ 140 passed (+10 net for CANON_THREAD; -4 for VALUE_HINT removal) |
| `tests/prelude-prompt.test.js`              | ✅ 190 passed |
| `tests/prelude-violation-detection.test.js` | ✅ 91 passed |
| `tests/prelude-canon-threads.test.js`       | ✅ 21 passed (new) |
| `tests/prelude-auto-model.test.js`          | ✅ 33 passed |
| `tests/prelude-theme-commitment.test.js`    | ✅ 59 passed |
| `tests/marker-detection.test.js`            | ✅ 128 passed (DM-side smoke) |
| `tests/marker-schemas.test.js`              | ✅ 49 passed |

**Total:** 785 prelude-related assertions green; 177 DM-side marker assertions green. No regressions.

**Notes:**
- Ancestry validator's full DB-round-trip path exercised end-to-end only by integration suites; chunk 3 prompt-builder tests will exercise the slug convention with real AI output when chunk 3 ships. Pure-logic and slug-format paths covered here.
- `prelude_values` table stays in schema; no longer written.
- Migration 047 is additive; existing prelude characters' data unaffected.

## 2026-05-01 — v1.0.104 Phase 2 chunk 1: Setup wizard rebuild

**Change scope:** Rewrote Prelude setup wizard from 11 questions to 10 per DECISION_LOG 2026-04-30 Decision A. Cut talents/cares/tone-preset; added authority figure (Q9) and free-text escape valve (Q10); replaced sibling sub-form with single dropdown. Server-side validator updated. `PreludeArcPreview` lost its tone card (orphaned by the tone-preset cut).

**Client build:** ✅ passed (`cd client && npx vite build`).

**Regression suites:**

| Suite | Result |
|-------|--------|
| `tests/prelude-setup.test.js`              | ✅ 59 passed (rewritten for new payload) |
| `tests/prelude-arc.test.js`                | ✅ 15 passed |
| `tests/prelude-markers.test.js`            | ✅ 130 passed |
| `tests/prelude-prompt.test.js`             | ✅ 190 passed |
| `tests/prelude-violation-detection.test.js`| ✅ 91 passed |

**Total:** 485 prelude-related assertions green. No regressions.

**Notes:**
- Existing prelude characters' setup blobs are not migrated. Readers default cut fields safely; old preludes continue to work in degraded mode (no tone preset, no talent/cares-driven theme suggestion).
- `PreludeArcPreview.jsx` lost its tone card; old preludes silently lose this UI element. Intentional.
- Out-of-scope cleanup deferred to chunk 3: `preludeArcService.js` and `preludeThemeService.js` still reference the cut fields in their prompt prose, but graceful-degrades at runtime.

## 2026-04-26 — v1.0.96 Prose-quality diagnostic + prompt cache architecture fix

**Change scope:** Investigation of original "Order of Dawn's Light" Opus 4.5 baseline against current production. Three new diagnostic toggles (Force Opus, Lean Prompt) on home page. Cache architecture fix — split character info into static (tier 2) + dynamic (tier 3) blocks; tier 1 switched to 1-hour TTL. Pre-existing PreludeSession descStyle crash fixed; prelude canon ledger duplicate removed from Setup panel.

**Client build:** ✅ passed.

**Regression suites:**

| Suite | Result |
|-------|--------|
| `tests/character-memory.test.js`     | ✅ 56 passed |
| `tests/moral-diversity.test.js`      | ✅ 59 passed |
| `tests/combat-tracker.test.js`       | ✅ 26 passed |
| `tests/loot-systems.test.js`         | ✅ 4 suites passed |
| `tests/condition-tracking.test.js`   | ✅ 56 passed |
| `tests/lean-prompt-dryrun.js`        | ✅ 14/14 transform checks passed |
| `tests/cache-tier-diff.js`           | ✅ tier 2 byte-stable across simulated state changes (HP/gold/location/quest/inventory) |

**Diagnostic harness output:**

- `tests/prose-quality.test.js` re-run: 15/15 API calls completed. Subsequent turns hit cache at 60–83% (limited by harness's 3 scenarios × 5 variants — real sessions reuse the same prompt many more times).
- `tests/output/prose-quality-results.md` — raw 15-output A/B against Sonnet, baseline + 4 mutations.
- `tests/output/prose-quality-analysis.md` — verdicts on the 6 original hypotheses, 2 new findings (OBSERVATION-as-check truncation, HARD STOPS compressing cinematic build), recommended next experiments.

**Net assessment:** No regressions. The character-info split is backward-compatible (`text` field still returned alongside new `staticText` / `dynamicText`) — any caller still using `char.text` continues to work. Prompt prompt-builder tests unchanged in count, all green. The cache architecture fix is verified by the new `cache-tier-diff.js` harness — tier 2 is now byte-identical across HP/gold/location/quest/inventory mutations, which was the source of the 55% cache hit rate the production logs surfaced.

## 2026-04-24 — v1.0.92 Playtest fixes (5 issues from session 124)

**Change scope:** Five prompt + detector fixes from playtest observations. Rule 2c (player input is player authorship), violation-detector whitelist for sensory "you know", Rule 6d (give player data to answer), Rule 19b (triadic-rhythm tic ban), toned-down canon banner.

**Client build:** ✅ passed.

**New tests:** 11 added to `tests/prelude-violation-detection.test.js` covering the whitelist (sensory cases pass clean, novel-attribution cases still flag, "remember to" still flagged as directive intent).

**Regression suites:**

| Suite | Result |
|-------|--------|
| `tests/prelude-violation-detection.test.js` | ✅ 91 passed (was 76) |
| `tests/prelude-prompt.test.js`              | ✅ 190 passed (assertion updated for toned-down canon banner) |
| `tests/dm-prompt-builder.test.js`           | ✅ 30 passed |
| `tests/marker-schemas.test.js`              | ✅ 29 passed |
| `tests/llm-json.test.js`                    | ✅ 26 passed |
| `tests/prelude-markers.test.js`             | ✅ 130 passed |
| `tests/prelude-arc.test.js`                 | ✅ 15 passed |
| `tests/playtest-logger.test.js`             | ✅ 23 passed |
| `tests/character-memory.test.js`            | ✅ 56 passed |
| `tests/moral-diversity.test.js`             | ✅ 59 passed |

**Net assessment:** Prompt + detector tweaks only. Whitelist is conservative (only `by | from | as`, never `to`). Rule 2c is additive — strengthens the existing Rule 2 / 2a / 2b cluster. Rule 19b extends Rule 19a banned-tics list. No behavioral regressions.

## 2026-04-24 — v1.0.91 Playtest logging + Round 3 design

**Change scope:** New `server/utils/playtestLogger.js` for per-turn and session-end context-drift instrumentation. Wired into both DM session route and prelude session service. PRELUDE_IMPLEMENTATION_PLAN.md Round 3 (Ch4-as-bridge) and FUTURE_FEATURES.md Phase 5 handoff entries logged — design only, no code changes there.

**Client build:** ✅ passed.

**New test file:** `tests/playtest-logger.test.js` — 23 passed, 0 failed.

**Regression suites:**

| Suite | Result |
|-------|--------|
| `tests/playtest-logger.test.js`       | ✅ 23 passed (new) |
| `tests/dm-prompt-builder.test.js`     | ✅ 30 passed |
| `tests/marker-schemas.test.js`        | ✅ 29 passed |
| `tests/llm-json.test.js`              | ✅ 26 passed |
| `tests/prelude-prompt.test.js`        | ✅ 190 passed |
| `tests/prelude-markers.test.js`       | ✅ 130 passed |
| `tests/prelude-arc.test.js`           | ✅ 15 passed |

**Net assessment:** Pure additive. No regressions. Logging is best-effort (try/catch around all log calls) — if anything in the formatter breaks, the session continues normally.

## 2026-04-24 — v1.0.90 DM prompt rebuild + code-verified rules

**Change scope:** DM system prompt restructure (memory hierarchy, consolidated cardinal rules, unified NPC voice, conditional markers), new `markerSchemas.js` + `ruleVerifiers.js` for schema-driven and rule-verified marker/response validation with invisible-to-player correction feedback. Main-campaign tone preset integration (Weakness 7) deferred — noted in `FUTURE_FEATURES.md` until the prelude-to-campaign handoff design is locked.

**Client build:** ✅ passed.

**New test file:** `tests/marker-schemas.test.js` — 29 passed, 0 failed. Covers marker body extraction, all schema types (PROMISE_MADE/NOTORIETY_GAIN/CONDITION_ADD/LOOT_DROP/etc.), whole-response validation, and both rule verifiers.

**Regression suites:**

| Suite | Result |
|-------|--------|
| `tests/marker-schemas.test.js`        | ✅ 29 passed (new) |
| `tests/llm-json.test.js`              | ✅ 26 passed |
| `tests/dm-prompt-builder.test.js`     | ✅ 30 passed (also fixed a pre-existing stale assertion — was looking for "ABSOLUTE RULES" when the prompt uses "CARDINAL RULES") |
| `tests/moral-diversity.test.js`       | ✅ 59 passed |
| `tests/character-memory.test.js`      | ✅ 56 passed |
| `tests/progression-prompt.test.js`    | ✅ 43 passed |
| `tests/marker-detection.test.js`      | ✅ 128 passed |
| `tests/combat-tracker.test.js`        | ✅ 26 passed |
| `tests/condition-tracking.test.js`    | ✅ 56 passed |
| `tests/prelude-prompt.test.js`        | ✅ 190 passed |
| `tests/prelude-markers.test.js`       | ✅ 130 passed |
| `tests/prelude-arc.test.js`           | ✅ 15 passed |
| `tests/prelude-setup.test.js`         | ✅ 42 passed |
| `tests/prelude-theme-commitment.test.js` | ✅ 59 passed |
| `tests/prelude-violation-detection.test.js` | ✅ 76 passed |
| `tests/dm-mode.test.js`               | ✅ 97 passed |
| `tests/loot-systems.test.js`          | ✅ 4 suites passed |
| `tests/nickname-resolver.test.js`     | ✅ 49 passed |
| `tests/narrative-queue.test.js`       | ✅ 30 passed |
| `tests/rolling-summary.test.js`       | ✅ 21 passed |

**Net assessment:** No regressions. One pre-existing test failure fixed (stale "ABSOLUTE RULES" → "CARDINAL RULES" assertion). All 20 regression suites green + one new suite added.

## 2026-04-23 — v1.0.89 structural hardening pass

**Change scope:** Shared LLM JSON extractor, prelude session hardening, CLAUDE.md rewrite, retired-endpoint deletion, merchant-shop state extraction. Spans ~20 server service files + `DMSession.jsx` + new utility + new hook.

**Client build:** ✅ passed (`cd client && npx vite build`) — DMSession bundle 179.75 kB (same as baseline).

**New test file:** `tests/llm-json.test.js` — 26 passed, 0 failed. Covers happy paths, brace-in-string safety, multi-block merge (the original Opus bug), trailing-comma repair, array mode, error cases, `tryExtractLLMJson` fallback.

**Regression suites run:**

| Suite | Result |
|-------|--------|
| `tests/llm-json.test.js`              | ✅ 26 passed |
| `tests/prelude-markers.test.js`       | ✅ 130 passed |
| `tests/prelude-prompt.test.js`        | ✅ 190 passed |
| `tests/prelude-arc.test.js`           | ✅ 15 passed |
| `tests/prelude-setup.test.js`         | ✅ 42 passed |
| `tests/prelude-theme-commitment.test.js` | ✅ 59 passed |
| `tests/prelude-violation-detection.test.js` | ✅ 76 passed |
| `tests/marker-detection.test.js`      | ✅ 128 passed |
| `tests/combat-tracker.test.js`        | ✅ 26 passed |
| `tests/condition-tracking.test.js`    | ✅ 56 passed |
| `tests/loot-systems.test.js`          | ✅ 4 suites passed |
| `tests/moral-diversity.test.js`       | ✅ 59 passed |
| `tests/character-memory.test.js`      | ✅ 56 passed |
| `tests/dm-mode.test.js`               | ✅ 97 passed |
| `tests/narrative-queue.test.js`       | ✅ 30 passed |
| `tests/rolling-summary.test.js`       | ✅ 21 passed |
| `tests/nickname-resolver.test.js`     | ✅ 49 passed |
| `tests/progression-prompt.test.js`    | ✅ 43 passed |
| `tests/dm-prompt-builder.test.js`     | ⚠️ 29 passed, 1 failed (PRE-EXISTING — fails on clean HEAD too; not a regression) |

**Unit tests not run:** integration.test.js, scenarios.test.js, economy.test.js, crafting.test.js, mythic.test.js, faction-quests.test.js, living-world.test.js, survival.test.js, weather.test.js, consequence.test.js, npc-aging/lifecycle/mail/relationships, world-event-npcs, companion-activities/skill-checks, prelude-auto-model, campaign-import. These require live Turso DB credentials and are out of scope for this pass (structural change, not behavioral).

**Net assessment:** No regressions introduced. All refactored call sites import cleanly (verified via `node -e "import('./...')"`). The one failing `dm-prompt-builder.test.js` assertion is pre-existing and unrelated to this pass.
