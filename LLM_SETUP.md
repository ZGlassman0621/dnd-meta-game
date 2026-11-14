# LLM Setup & Configuration

How the game's AI is configured: what was decided, what the code does today, and how to run it.

## The decision

The DM model is **gemma4:12b, run offline through Ollama on Zach's PC** (Zach, 2026-11-10).
- **Acceptance check:** a secret-holding leak test. The DM must keep hidden information hidden.
- **Per-role models are open.** Nobody has decided that one model must do every job (DM turns, extraction, summaries, generation), so different roles may end up on different models.
- No API key and no internet connection are part of the plan.

## What the code does today

The code was written Claude-first with Ollama as a fallback, and it hasn't been moved to the decision yet.

**Gameplay sessions** choose a provider per request in `getLLMProvider()` (`server/routes/dmSession.js`):
1. If the player picked a provider explicitly (`claude` or `ollama`), only that one is tried.
2. On auto: Claude is used if `ANTHROPIC_API_KEY` is set and Claude answers.
3. Otherwise Ollama is used if it's running.
4. If neither is available, the session reports that no LLM provider is available.

`GET /api/dm-session/llm-status` returns which provider is in use.

**The Ollama model** is whatever `OLLAMA_MODEL` names. The compiled-in default is still `gpt-oss:20b` (`server/services/llmClient.js`, `server/routes/dmSession.js`, `server/services/adventureGenerator.js`). Ollama is reached at `OLLAMA_URL`, default `http://localhost:11434`. If Ollama is running but the configured model isn't installed, the status check says so and names the `ollama pull` command to run.

**Features that call Claude directly**, so they don't use the local model:
- Campaign plan generation refuses to run without Claude (`server/services/campaignPlanService.js`: "Claude API is required for campaign plan generation").
- Session chronicles, the campaign memory written at session end, call Claude's `chat` directly (`server/services/storyChronicleService.js`).
- DM Mode's AI calls are guarded on `claude.isClaudeAvailable()` (`server/routes/dmMode.js`). DM Mode is out of MVP scope.

Moving these to the local model, and making gemma4:12b the default, is open work for a future job.

**There is no cloud fallback pool in the code.** No endpoint other than the local Ollama address and the Anthropic API is configured anywhere in `server/`.

## Running gemma4:12b today

1. Install [Ollama](https://ollama.com) on the PC and pull the model:
   ```bash
   ollama pull gemma4:12b
   ```
2. In `.env` at the repo root, name the model and leave the Anthropic key unset:
   ```
   OLLAMA_MODEL=gemma4:12b
   # OLLAMA_URL=http://localhost:11434   (only if Ollama runs elsewhere)
   ```
   With no key, the provider check skips Claude and goes straight to Ollama.
3. Start the game with `npm run dev`, open http://localhost:5173, and check the provider indicator.

The features listed above that call Claude directly won't work in this setup.

## Server modules

All of these exist in the current code.

| Module | File | What it does |
|---|---|---|
| Provider choice | `server/routes/dmSession.js` (`getLLMProvider`) | Picks Claude or Ollama per request |
| Ollama client | `server/services/llmClient.js` | Raw Ollama calls (chat, status, model list). Strips `<think>`-style reasoning blocks before text reaches the player |
| Session orchestrator | `server/services/ollama.js` | Ollama session lifecycle: start, continue, summarize |
| Claude client | `server/services/claude.js` | Claude calls, with the request contract described in `CLAUDE.md` |
| Claude model registry | `server/services/modelRegistry.js` | Resolves the Claude model IDs |
| DM prompt | `server/services/dmPromptBuilder.js` | Builds the DM system prompt and its sections |
| Session service | `server/services/dmSessionService.js` | Session logic: rewards, notes and NPC extraction, events |
| Context sizing | `server/utils/contextManager.js` | Sizes the context budget; has a smaller-context branch for gemma-family models |
| Call logging | `server/services/aiCallLogger.js` | Logs every AI call and warns on oversized prompts |
| Campaign plan | `server/services/campaignPlanService.js` | Campaign plan generation (Claude only today) |
| Backstory parser | `server/services/backstoryParserService.js` | Parses a freeform backstory, using Claude when available and Ollama otherwise |

## Troubleshooting

```bash
ollama list                                   # is gemma4:12b installed?
ollama run gemma4:12b "Describe a tavern."    # does the model answer on its own?
curl http://localhost:11434/api/tags          # is Ollama reachable at the default address?
```

- **"No LLM provider available":** Ollama isn't running, or `OLLAMA_URL` points somewhere else.
- **"model ... is not installed":** run the `ollama pull` command the message names, or fix `OLLAMA_MODEL` in `.env`.
- **The game is using Claude when you expected the local model:** an `ANTHROPIC_API_KEY` is set in `.env` or in the environment, and auto mode prefers it.
- Server output (`npm run server`) shows provider and LLM errors as they happen.
