# LLM Setup & Infrastructure — Review Findings

Working doc between user and PM Claude after a full read of `LLM_SETUP.md` and a code audit (Phase 1) and fix pass (Phase 2 → v1.0.102). Captures issues to address, what's been resolved, and what remains.

**Scope:** Issues only. Format: to-do. Each finding has a severity tag and a status. Findings already addressed are marked ✅ for institutional memory; deferred items are flagged.

**Severity tags:**
- 🔴 **Bug/error** — clear mistake, no design judgment required to fix
- 🟡 **Open question** — design judgment needed; user decides
- 🟢 **Heads-up** — works as designed but has implications worth knowing

**Status:** Phase 1 audit complete; Phase 2 fixes shipped in v1.0.102. Remaining items deferred.

---

## Important framing context

Unlike the gameplay system reviews (Ancestry Feats, Keeper, Downtime), LLM Setup is **infrastructure, not gameplay.** Different evaluation criteria apply: reliability, cost-effectiveness, observability, drift-resistance, fallback resilience.

Critically, **infrastructure rot is invisible.** A broken Ancestry Feat is a player annoyance; a broken LLM setup can fail silently while costs spiral or fallback paths atrophy. Several of this review's most important findings were "the system has drifted while we weren't watching" — stale documentation, untested fallbacks, missing observability. That pattern is unique to infrastructure systems and worth recognizing.

**This review's most consequential single finding is one not in code at all:** a manually-set Anthropic console spending cap is the load-bearing risk mitigation, providing roughly 80% of practical risk reduction. All the code-side fixes are quality-of-life improvements layered on that bound.

---

## Category 1: Drift / version-currency issues

- ✅ **Architecture diagram → matched code (v1.0.102).** Diagram now correctly shows `gpt-oss:20b` instead of "Gemma 3 12B."

- ✅ **Cost claim drift → corrected (v1.0.102).** Doc updated from stale "$0.05-0.15 per session" to current "$2.50-$4.50/session, $1.30-$1.50/hour" with pointer to DECISION_LOG.

- ✅ **"Sonnet for DM sessions" claim → corrected (v1.0.102).** Updated to reflect post-v1.0.99 Opus-default reality.

- ✅ **Status-indicator description → corrected (v1.0.102).** Updated to current orange/purple/green/red color taxonomy.

- ✅ **Opus 4.7 API compatibility → verified clean.** No sampling parameters, no extended thinking, no message prefills, current API version (`2023-06-01`). Audit confirmed no silent failures from 4.7 breaking changes.

- 🟢 **Module structure description (line 49) still has minor misleading framing.** `ollama.js` is described as "Session Orchestrator" but in current architecture it's the offline fallback path; session orchestration lives in `claude.js` + `dmSession.js`. *Single-line edit in a future doc-hygiene pass; not blocking.*

---

## Category 2: Observability and cost safety

- ✅ **Auth/billing failure (401/403) handling → fixed (v1.0.102).** Tagged-error pattern (`AUTH_FAILURE:`) with clear user-facing message pointing at console.anthropic.com. `checkClaudeStatus()` upgraded to make a real probe call instead of just checking `process.env.ANTHROPIC_API_KEY` is set — the home-page status indicator now reflects actual API health.

- ✅ **Rate limit (429) handling → fixed (v1.0.102).** Added to retryable list with patient backoff (3 attempts, 5s/15s/45s, ~65s total). Exhaustion produces `RATE_LIMITED:` tag → 503 with clear message.

- ✅ **Anthropic console spending cap → set by user (one-time manual task, separate from code).** Highest-leverage single risk mitigation in the entire review.

- 🟡 **Per-call cost calculation logging — deferred.** Token counts are tracked in `cumulativeCacheStats`; dollar amounts are not calculated in code. The console cap is the real backstop; code-side cost math has marginal value once the cap is in place. *Revisit if cost shape shifts dramatically (Sonnet-default reversal, major context-window increase, etc.).*

- 🟡 **Cumulative cache stats are process-lifetime only.** Server restart wipes running totals. There's no persisted "lifetime spend" anywhere in code. Anthropic console is the only authoritative source for total spend. *Probably fine for a single-user project; flag if multi-user use ever happens.*

---

## Category 3: Fallback path

- ✅ **Ollama model verification in status check → fixed (v1.0.102).** `checkOllamaStatus()` now parses `/api/tags` and confirms `OLLAMA_MODEL` is in the installed list. Reachable-but-missing returns distinct `error_code: 'no_model'`, fail-fast instead of routing doomed calls.

- 🟡 **The Ollama fallback has not been smoke-tested in actual play.** Per audit: `gpt-oss:20b` (the configured default) isn't pulled locally, so end-to-end fallback hasn't been validated. *Important caveat:* the model-verification check tells us Ollama is reachable and has a model; it doesn't tell us the fallback produces a coherent session. The system prompt is Claude-tuned; the marker-based game state system may not work on gpt-oss:20b; output format expectations may break silently. **The deferral is honest only if we name what we don't know: "we don't know if the fallback actually works" is the truthful state.**

- 🟡 **Ollama setup section is macOS-only.** No Linux or Windows install instructions. The brief frames Ollama fallback as load-bearing for the bunker scenario; cross-platform docs matter for that purpose. *Add when the doc gets its next pass.*

- 🟡 **No documented user-facing fallback experience.** What does the player see when the system silently switches Anthropic → Ollama mid-session? Quality jarring? UI notification? Nothing? *Worth defining and documenting once smoke test happens.*

- 🟢 **The reasoning-token stripping note (line 113) is good operational documentation.** Worth preserving and replicating in future docs.

---

## Category 4: Tagged-error coverage gap

- 🟡 **Tagged-error infrastructure is wired through `/message` only.** AUTH_FAILURE / RATE_LIMITED / OVERLOADED tags surface cleanly in the dominant call path (in-session errors). Other paths — `/start`, `/restart`, DM Mode routes, generators (campaign plans, NPCs, quests, etc.) — would surface a 401/403/429 as a generic error. *Worth a follow-up coverage audit. Not urgent: the dominant path is covered, and edge paths fail less often.*

---

## Category 5: Security and operational hygiene

- 🟡 **API key never validated against git history.** User should run `git log -p | grep -i "sk-ant"` to verify no key has ever been committed. If the search returns anything, rotate immediately.

- 🟡 **No documented key rotation procedure.** What to do if a key is leaked, how to rotate without breaking running sessions, where to update the `.env`. *Add to LLM_SETUP.md when the doc gets its next pass.*

- 🟡 **No mention of workspace-scoped keys with per-key spending caps.** Anthropic now supports this. Best practice: separate workspace for this project, separate API key, separate cap. *Mention in doc; doesn't require code change.*

---

## Suggested next moves (if/when this comes off the deferred shelf)

When LLM Setup gets reviewed again, suggested order:

1. **Ollama smoke test.** Pull `gpt-oss:20b`, unset `ANTHROPIC_API_KEY`, play 2-3 turns, document what happens. Outputs: "fallback works / fallback half-works / fallback is broken." Each outcome leads to different downstream work.

2. **Tagged-error coverage extension** to non-/message paths if the smoke test or any other path surfaces failures that should have been clearly tagged.

3. **Doc-hygiene polish pass** for module-structure framing, cross-platform Ollama install, key rotation procedure, workspace-scoped keys, fallback experience documentation.

4. **Cost monitoring deepening** — only if cost shape changes in a way that makes the console cap insufficient.

---

## What this review confirmed about the project

- Opus 4.7 compatibility is clean. No silent failures from breaking changes.
- The most operationally important fix (status indicator now reflects reality) is shipped.
- Auth/billing failures, rate limits, and Ollama model-missing scenarios all now produce clear, actionable error messages.
- The Ollama fallback exists in code and passes basic checks but has not been validated end-to-end. That's a known unknown.
- The Anthropic console spending cap is the load-bearing risk mitigation. Code fixes are quality-of-life on top of that bound.
- Several smaller doc/coverage items remain as known gaps; none are blocking.
