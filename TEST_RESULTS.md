# Test Results Log

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
