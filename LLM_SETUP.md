# LLM Setup & Configuration

The game's AI runs entirely on a local model, through [Ollama](https://ollama.com), on your own PC. There's no API key, no cloud service, and no internet connection involved in play.

## The decision

- **Model:** gemma4:12b, offline through Ollama on Zach's PC (Zach, 2026-11-10).
- **No cloud model anywhere in the game** (Zach, 2026-11-13: "The only Claude on the system is you building it." Claude Code builds the project; nothing in the game calls it).
- **Acceptance check:** a secret-holding leak test. The DM must keep hidden information hidden. It runs separately from `npm test`; see **The leak test** below.
- **Per-role models are open.** Every AI call names a role, so moving one role to a different model later is a one-line setting.

## How it works

Every AI call goes through one client, `server/services/llm.js`, to Ollama's `/api/chat`. Each call names a **role**, and `server/services/localModels.js` maps the role to a model. That file is the only place in the code that names a model.

| Role | Used for | Default model |
|---|---|---|
| `dm` | Narrative turns: DM sessions, DM Mode, Prelude sessions, rest narration | gemma4:12b |
| `summary` | Session summaries, recaps, rolling summaries, context compression | gemma4:12b |
| `extraction` | Chronicles (memory between sessions), notes, NPCs, memories, XP scoring, backstory parsing, relationship and transition reads | gemma4:12b |
| `generation` | Campaign plans, quests, locations, living world, adventures, companions, parties, NPC voices, letters, Prelude arcs | gemma4:12b |

What every request carries:
- **The context window (`num_ctx`), always.** Without it Ollama runs a model at its own small default window and silently drops the start of a long prompt, which is where the DM's rules are. The default is 65,536 tokens. That was measured on the builder PC (RTX 5070 Ti, 16 GB): gemma4:12b runs fully on the GPU at that size. The DM system prompt alone is about 12,900 tokens.
- **The system prompt first, once.** The old prompt-cache markers in the DM prompt are stripped.
- **Thinking off** unless `OLLAMA_THINK=true`. It adds time to every turn, and the game reads only the reply.
- **A streamed reply,** so a long generation never runs into Node's 300-second wait for a response.
- **`keep_alive: 30m`,** so the model stays loaded while the player thinks between turns.

Every call is logged to `ai_call_log` with its model (`model_id`), its role (`metadata.role`), and token counts. The context budgets in `server/utils/contextManager.js` and the prompt-size warnings in `server/services/aiCallLogger.js` are all derived from the same window.

When Ollama isn't running or the model isn't installed, the game says so in plain words: "Can't reach Ollama… Start Ollama", or "gemma4:12b is not installed… Run `ollama pull gemma4:12b`". The player's input is kept so they can send it again.

## Setup on the PC

1. Install Ollama from [ollama.com](https://ollama.com) and pull the model:
   ```bash
   ollama pull gemma4:12b
   ```
2. Optional settings go in `.env` at the repo root. `.env.example` lists them all:

   | Setting | Default | What it does |
   |---|---|---|
   | `OLLAMA_URL` | `http://localhost:11434` | Where Ollama listens |
   | `OLLAMA_MODEL` | `gemma4:12b` | Model for every role |
   | `OLLAMA_MODEL_DM` / `_SUMMARY` / `_EXTRACTION` / `_GENERATION` | (unset) | Per-role override |
   | `OLLAMA_NUM_CTX` | `65536` | Context window, in tokens. Lower it on a smaller GPU |
   | `OLLAMA_THINK` | `false` | Model thinking before it answers |
   | `DM_MAX_TOKENS` | `4000` | Ceiling on one DM reply |
3. Start the game with `npm run dev` and open http://localhost:5173. The pill at the top shows the DM's model, green when it's ready.

## The leak test

The acceptance check for gemma4:12b is a scripted three-exchange scene with Tomas, a frightened merchant who has a three-part secret. It runs against the real Ollama through the real game path: the real DM system prompt, his NPC brief, and the knowledge flags as the system holds them. It is not part of `npm test`, because it needs Ollama running and takes minutes:

```bash
npm run test:leak
```

The scenario, the pass bar and the latest results are in `docs/pm/reports/local-model-only-REPORT.md`.

## Server modules

| Module | File | What it does |
|---|---|---|
| Model registry | `server/services/localModels.js` | Roles → models; Ollama URL, context window, thinking |
| Local client | `server/services/llm.js` | `chat`, `startSession`, `continueSession`, `generateSessionSummary`, `checkStatus`, `listModels` |
| Call logging | `server/services/aiCallLogger.js` | `loggedChat`, `wrapLlmCall`, `wrapLlmCallWithId`; prompt-size warnings |
| Context sizing | `server/utils/contextManager.js` | Budgets from the window; compression via the `summary` role |
| DM prompt | `server/services/dmPromptBuilder.js` | Builds the DM system prompt |
| Status endpoint | `server/routes/dmSession.js` | `GET /api/dm-session/llm-status` (availability, role models, window) |

## Troubleshooting

```bash
ollama list                                   # is gemma4:12b installed?
ollama ps                                     # is it loaded, and 100% on the GPU?
ollama run gemma4:12b "Describe a tavern."    # does the model answer on its own?
curl http://localhost:11434/api/tags          # is Ollama reachable at the default address?
```

- **"Can't reach Ollama":** start Ollama, or fix `OLLAMA_URL`.
- **"… is not installed":** run the `ollama pull` command the message names, or fix the model setting in `.env`.
- **Slow turns:** check `ollama ps`. If the model isn't 100% on the GPU, lower `OLLAMA_NUM_CTX`.
- Server output (`npm run server`) shows the local AI status at startup and any model errors as they happen.
