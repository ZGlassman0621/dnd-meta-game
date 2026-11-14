# Proposal for a brief — local-model-only: gemma4:12b runs the whole game, Claude comes out

**From:** Claude Code (builder), 2026-11-13. **For:** Muse, to turn into a brief.
**Status:** not built. Nothing has changed in the code for this yet.

## Zach's ruling (2026-11-13)
Asked whether Claude should stay as an opt-in fallback or be removed from the game entirely, Zach chose removal:

> "B. The only Claude on the system is you building it"

So no part of the game calls Claude or needs an Anthropic key. Claude Code remains the builder only. This builds on the earlier model decision (Zach, 2026-11-10): gemma4:12b, offline through Ollama on the PC, with per-role models still open and a secret-holding leak test as the acceptance check.

## Why it's needed (found in docs-cleanup)
The docs-cleanup report (`docs/pm/reports/docs-cleanup-REPORT.md`) found that the decided model isn't wired in:
- **Gameplay** uses Claude whenever an API key is set, and Ollama otherwise. The Ollama default is still `gpt-oss:20b`, hard-coded in 7 places in `server/`.
- **22 server files call Claude; 12 have no local path at all.** The ones on the MVP path:
  - `server/services/storyChronicleService.js`: session chronicles, the memory between sessions. This is required for the MVP's "memory retained" goal.
  - `server/services/campaignPlanService.js`: refuses to run without Claude.
  - `server/utils/contextManager.js`: context compression that keeps long sessions inside the model's limit.
  - `server/services/companionActivityService.js`: companion activity outcomes. Without Claude it falls back to non-AI outcomes.
- **The remaining Claude-only files are post-MVP systems:** DM Mode (`dmMode.js`, `dmCoachingService.js`, `dmModeChronicleService.js`, `dmModeNpcService.js`, `partyGeneratorService.js`), Prelude (`preludeSessionService.js`, `preludeTransitionService.js`, `preludeArcService.js`), and NPC mail (`npcMailService.js`, which runs on the world tick, currently off).

## What this job is, as I'd scope it
1. **One place names the models.** A small local-model registry (replacing `server/services/modelRegistry.js`) with one setting per role. Roles: DM turns, summaries/compression, extraction (chronicles, NPCs, notes), generation (campaign plan, quests, locations). All default to `gemma4:12b`, overridable in `.env`. The 7 hard-coded `gpt-oss:20b` defaults go.
2. **Remove the Claude path.**
   - Delete `server/services/claude.js`, the Claude half of `getLLMProvider()`, the provider choice and Claude status in the client (12 client files mention Claude, Anthropic, Opus or Sonnet), the Anthropic section of `.env.example`, and the Claude sections of `CLAUDE.md` and `LLM_SETUP.md`.
   - Following CLAUDE.md rule 2 (delete outright), git history is the archive.
3. **Move every MVP-path feature to the local model:** chronicles and their rollup, campaign plan generation, context compression, session-end extraction, companion activity outcomes.
4. **Post-MVP Claude-only features need a ruling from Muse:**
   - **(a) Port them to the local model in this job.** Bigger.
   - **(b) Leave them with no AI**, so they refuse with a clear message until their phase comes. Smaller.

   Recommendation: (b), since they're out of MVP scope and each will be reworked when its phase comes.
5. **Measure, don't guess.** gemma4:12b is a much smaller model than the one this code was written for, so before declaring it done:
   - the DM system prompt's real size against gemma4:12b's context window;
   - whether gemma4:12b reliably returns the structured output that markers and chronicle extraction need (`server/utils/llmJson.js` is the parser);
   - response time per turn on this PC.

   Report the numbers. Prompt trimming, if needed, is a follow-up.
6. **Tests.** The LLM test harness (`tests/helpers/llmHarness.js`) only intercepts Anthropic calls; 7 test files use it. It needs an Ollama stub so the turn loop, chronicles and extraction stay tested with no network. `tests/prose-quality.test.js` makes billed Anthropic calls and goes away or is rewritten for the local model.
7. **Acceptance: the secret-holding leak test** (Zach, 2026-11-10). Muse to define the exact scenario and the pass bar in the brief.

## What's already in place on the PC (checked 2026-11-13)
- Ollama 0.40.16 is installed and running (`http://localhost:11434` answers).
- **gemma4:12b is already pulled** (8.0 GB). Also present: `gemma4:26b`, `qwen3.8:27b`, `qwen3.6`, `qwen3.5:4b`.
- GPU: NVIDIA GeForce RTX 5070 Ti, 16 GB. RAM: 31 GB.
- There is no `.env` on the PC yet. The job creates its settings there; `.env` is not committed.

## Open questions for the brief
1. Post-MVP Claude-only features: port them now, or leave them with no AI until their phase (item 4)?
2. Does the MVP create the Embervale campaign through campaign plan generation, or import it? This decides whether moving campaign plans is MVP-critical.
3. The leak test's exact scenario and pass bar (item 7).
