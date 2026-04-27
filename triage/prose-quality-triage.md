# Prose Quality — Triage

**Started:** 2026-04-25
**Status:** ACTIVE — fix shipped, validation pending
**Last updated:** 2026-04-26

## The problem

DM session prose reads visibly thinner than the original "Order of Dawn's Light" Opus 4.5 campaign (December 2025, PDF in repo root). The original delivered 250-word cinematic moments with sensory layering, character voice, and atmospheric build; current production sessions clip to 170-word responses that often end with "Make a Perception check." truncation. This is the central narrative-quality issue of the game — solving it is upstream of every other content system.

## Hypotheses & verdicts

Original 6, plus 2 surfaced by the diagnostic:

| # | Hypothesis | Verdict (as of 2026-04-26) | Evidence |
|---|---|---|---|
| H1 | Sonnet vs Opus is the biggest factor | **CONFIRMED** | User playtest 2026-04-26: Opus is the differentiator; Lean variants showed no perceptible improvement on Sonnet. |
| H2 | Word-count caps in CONVERSATION HANDLING are squeezing prose | **DOWNGRADED** | A/B (V2): caps don't bind in practice; output sat 170–225 words inside COUNCIL's 120–250 range regardless. |
| H3 | Self-Check at prompt tail produces defensive prose | **PARTIAL** | A/B (V3): helps tavern openers (+27% words), neutral or slightly worse on dialogue/cinematic. Single-sample variance high. |
| H4 | Marker overhead taxes every response | **MIXED** | A/B (V4): strongest mutation in automated test (most cinematic prose in scenarios A and C). User playtest: Lean prompt didn't move the needle in real play. Conclusion: helps edge cases (atmospheric, cinematic) not the average dialogue/action turn. |
| H5 | Memory plumbing flattens NPCs into facts | **MIXED** | A/B (V5): bare prompt helped when context wasn't critical (A, C), hurt when worldbuilding mattered (B). Stripping memory wholesale isn't a win. |
| H6 | Tone presets constrain main sessions | **FALSE** | Code audit confirmed: tone presets (`buildTonePresetBlock`, `TONE_PRESET_LIST`) only wired into prelude. Main DM sessions get only a single line ("Tone: gritty") and an optional `dm_notes.tone` paragraph. Not the issue. |
| H7 | `PLAYER OBSERVATION = ALWAYS A CHECK` rule kills atmospheric scene-opens | **ACTIVE** | A/B turn-end analysis: V1 and V2 both ended a tavern entry with "Make a Perception check." after the player just opened a door. V4 (markers stripped) skipped the demand and gave richer scenes. Not yet tested in production. |
| H8 | Cardinal Rule 2 (HARD STOPS) compresses cinematic build | **ACTIVE** | Original PDF: 250 words of layered horror approaching the body, THEN a check. Production V1: 170 words ending at the check. The HARD STOP rule forces premature cuts. Not yet tested in production. |

## What's been shipped (in v1.0.96)

**Diagnostic toggles** — let us A/B in live play without rebuilds:
- Home-page Sonnet/Opus pill (replaces SessionSetup's old Auto/Claude/Ollama).
- In-session pill in the gameplay info bar — toggle mid-session.
- Home-page Lean Prompt toggle — strips MECHANICAL MARKERS + softens Cardinal Rule 2.
- All persisted in localStorage, threaded as body params (`modelOverride`, `leanPrompt`) into `/api/dm-session/start` + `/message`.

**Prompt cache architecture fix** — the bigger win:
- Tier 2 (per-character) was leaking dynamic state (HP, gold, location, equipped weapon). Split `formatCharacterInfo()` into `staticText` (tier 2) + `dynamicText` (tier 3). Verified byte-stable across state mutations via `tests/cache-tier-diff.js`.
- Tier 1 (universal-static) was on 5-min TTL — evicting mid-session during thoughtful play (production logs showed eviction at t1, t5, t11, t18 — exactly the 5-minute boundaries). Switched to 1-hour TTL.
- Cost impact for Opus (measured in v1.0.97 session-147 playtest, 24 turns): ~$2.89/session (~$1.50/hour). Cache hit rate measured at ~71% — close to the ~77% mathematical ceiling for this play pattern (fresh-input from message history + tier 3 dynamic content limits achievable hit rate; tier 1+2 alone aren't the dominant input). The original v1.0.96 prediction of ~$0.85 / ~95% was based on wrong assumptions and has been corrected in CHANGELOG and DECISION_LOG.
- Cross-session benefit confirmed: session 147 t1 hit 88% cache from prior session's residual tier 1 cache. v1.0.98 extending tier 2 to 1-hour TTL too should improve this further.

**Test infrastructure**:
- `tests/prose-quality.test.js` — 3 scenarios × 5 variants A/B harness against Sonnet, re-runnable.
- `tests/cache-tier-diff.js` — diagnoses cache content stability under simulated state changes.
- `tests/lean-prompt-dryrun.js` — verifies lean transforms strip the right things (14/14 passing).
- `tests/seed-test-characters.js` — creates 4 identical Riv-style chars for A/B (Sonnet/Default, Sonnet/Lean, Opus/Default, Opus/Lean). Initial version had werewolf priming in the quest field — fixed.

**Pre-existing fixes that surfaced**:
- `PreludeSession.jsx` referenced `descStyle` without declaring it — runtime crash. Defined at module scope.
- Canon ledger duplicated in prelude Setup panel after the v1.0.75 migration to `PreludeLorePanel`. Duplicate removed.

## Open questions

1. **Is ~$1.50/hour acceptable as the always-on default?** Measured cost from v1.0.97 session 147 (24 turns Opus). Cache hit rate is at the achievable ceiling (~71%, close to the ~77% mathematical max). v1.0.98 lever 1 (tier 2 → 1-hour TTL) brings this down ~$0.20–$0.30 per session. Three more levers (rolling-summary-earlier, tier-3-trim) could push toward ~$1.00/hour if needed but trade cost for AI memory quality.
2. **Should Lean Prompt be retired or kept as a diagnostic?** It didn't help the user's playtest. The automated A/B showed value only on edge moments. Recommend retire from production direction; possibly keep the toggle for future debugging.
3. **H7 (OBSERVATION = ALWAYS A CHECK) — should we move it to JIT injection?** The rule kills tavern entries. Right answer might be: only inject when the player commits to a perception/investigation/stealth verb ("I sneak", "I search the body"), not on benign "I look around."
4. **H8 (HARD STOPS) — should we soften in production?** The strict rule is correct in spirit (don't narrate the result before the player rolls) but applied too broadly (truncates the cinematic moment). Soft version exists in lean mode; could be folded into production Cardinal Rule 2.
5. **If Opus is the production default, do these toggles become redundant?** The forceOpus toggle exists because Sonnet was the default. If Opus becomes default, the toggle could be retired (or repurposed: "downgrade to Sonnet for cost").
6. **Prelude/main toggle gap** — the lean transform doesn't apply to prelude prompts (different builder, different structure). If we ship Lean as a default, prelude needs `applyPreludeLeanTransforms()` separately. Logged in `FUTURE_FEATURES.md`.

## Pending experiments

- [ ] **Validate Opus-as-default cost over a real week of play.** Need real cache hit data from production-like cadence (3–10 min between turns).
- [ ] **Riv (D) — Opus/Lean playtest.** User played A, B, C — D pending. Probably skippable since we already have the signal that Lean ≈ noise.
- [ ] **Targeted V4 deployment trial.** Move OBSERVATION = ALWAYS A CHECK out of always-on, only inject when player commits to stealth/investigation/perception verbs. Test in 1–2 sessions; compare prose to baseline.
- [ ] **Soften Cardinal Rule 2 in production.** Replace strict HARD STOPS with the lean-mode variant ("ROLL REQUESTS — DON'T SPOIL OUTCOMES"). Risk: AI may start spoiling outcomes; mitigate with a verifier.
- [ ] **Variance check on V3 Scenario C anomaly.** V3 produced 115w (vs ~170 baseline) for body-approach scenario — possibly single-sample variance. 3 reruns would tell us if self-check has real anti-cinematic effect.

## Decision points (needs user input before implementation)

- Is Opus officially the production default for main DM sessions? (Cache fix makes this financially tenable.)
- Should we retire Lean Prompt as a direction, or keep iterating on it?
- Should we ship the H7/H8 production fixes (OBSERVATION-as-check JIT, soft HARD STOPS) before the Opus-default decision, after, or together?

## Files of note

**Diagnostic harnesses:**
- [tests/prose-quality.test.js](../tests/prose-quality.test.js) — A/B harness
- [tests/cache-tier-diff.js](../tests/cache-tier-diff.js) — cache content stability
- [tests/lean-prompt-dryrun.js](../tests/lean-prompt-dryrun.js) — lean transform verification
- [tests/seed-test-characters.js](../tests/seed-test-characters.js) — 4-character A/B seed

**A/B output:**
- [tests/output/prose-quality-results.md](../tests/output/prose-quality-results.md) — raw outputs
- [tests/output/prose-quality-analysis.md](../tests/output/prose-quality-analysis.md) — verdicts snapshot (note: this triage doc is the LIVE version; analysis.md is frozen at first run)

**Production code touched:**
- [server/services/dmPromptBuilder.js](../server/services/dmPromptBuilder.js) — `formatCharacterInfo` static/dynamic split, `applyLeanTransforms()`
- [server/services/claude.js](../server/services/claude.js) — TIER1_CACHE_CONTROL with `ttl: '1h'`
- [server/routes/dmSession.js](../server/routes/dmSession.js) — `modelOverride`, `leanPrompt` body params
- [client/src/App.jsx](../client/src/App.jsx) — home-page toggle pills
- [client/src/components/DMSession.jsx](../client/src/components/DMSession.jsx) — in-session pill
- [client/src/components/SessionSetup.jsx](../client/src/components/SessionSetup.jsx) — Sonnet/Opus selector

**Reference baseline:**
- `Order of Dawn's Light - Original Campaign Conversations with Claude.pdf` (untracked at repo root) — Opus 4.5, December 2025, 416 pages.

## Closure criteria

This investigation closes when:
1. A production decision is made on Opus vs Sonnet (and the toggles are either kept for debugging or retired).
2. H7 (OBSERVATION-as-check) and H8 (HARD STOPS) are either fixed in production or deliberately deferred with rationale.
3. Real-session cache metrics validated. (v1.0.97 session-147 measured ~71% hit rate at the ~77% ceiling — predicted ~95% was wrong, but the architecture fix did meaningfully improve from the pre-fix ~55% rate, and the cross-session caching benefit is real.)
4. The findings + decisions are folded into the relevant design docs (CLAUDE.md, FUTURE_FEATURES.md as needed).

When all four are done, this entry moves to a "Closed Investigations" archive at the bottom of TRIAGE.md (or the equivalent index of this folder), and a new file replaces it for the next investigation.
