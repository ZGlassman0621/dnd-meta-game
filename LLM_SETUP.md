# LLM Setup & Configuration

The D&D Meta Game uses a **multi-model AI architecture** with Claude as the primary provider and Ollama as an offline fallback.

---

## AI Models Used

| Model | Purpose | When Used |
|-------|---------|-----------|
| **Claude Opus** (`claude-opus-4-7`) | World building & generation | Campaign plans, backstory parsing, NPC/quest/location/companion generation, living world events, adventure generation, first session opening |
| **Claude Sonnet** (`claude-sonnet-4-6`) | AI Dungeon Master sessions | Continuing session gameplay, narration, combat, dialogue |
| **Ollama (`gpt-oss:20b`)** | Offline fallback | All of the above when no internet/API key available |

> **Note:** Claude model IDs use the alias form (no date suffix), which auto-resolves to the latest *build* within a major.minor version. Bumping across major.minor (e.g. Opus 4-6 → 4-7) still requires a manual code change — update these when Anthropic releases new versions.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Client (React)                 │
│  DM Session │ Campaign Plan │ Backstory Parser   │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│                 Express Server                   │
│                                                  │
│  ┌─────────────────┐  ┌──────────────────────┐  │
│  │  Claude API      │  │  Ollama (Fallback)   │  │
│  │  ┌────────────┐  │  │  ┌────────────────┐  │  │
│  │  │ Opus       │  │  │  │ gpt-oss:20b    │  │  │
│  │  │ (default)  │  │  │  │ (all tasks)    │  │  │
│  │  ├────────────┤  │  │  └────────────────┘  │  │
│  │  │ Sonnet     │  │  │                      │  │
│  │  │ (sessions) │  │  │  localhost:11434      │  │
│  │  └────────────┘  │  └──────────────────────┘  │
│  └─────────────────┘                             │
└──────────────────────────────────────────────────┘
```

### Server Module Structure

The AI DM backend is split into focused modules:

| Module | File | Purpose |
|--------|------|---------|
| **LLM Client** | `server/services/llmClient.js` | Raw Ollama API calls (chat, status, list models) |
| **Prompt Builder** | `server/services/dmPromptBuilder.js` | ~600-line DM system prompt + all formatters (character info, companions, campaign plan, world state snapshot, content preferences including survival mode, skill check hard-stop rules, starting location enforcement) |
| **Session Orchestrator** | `server/services/ollama.js` | Session lifecycle (start, continue, summarize) — imports from the above two |
| **Session Service** | `server/services/dmSessionService.js` | Session business logic (rewards, notes extraction, NPC extraction, event emission) |
| **Campaign Plan** | `server/services/campaignPlanService.js` | Claude Opus campaign plan generation |
| **Backstory Parser** | `server/services/backstoryParserService.js` | Claude Opus backstory parsing into structured elements |

All AI generators (campaign plans, NPCs, quests, locations, companions, adventures) use Claude Opus. **DM sessions also default to Opus as of v1.0.99**, with a Sonnet opt-down toggle on the home pill, the SessionSetup screen, and the in-session info bar (toggle is shared across all three via `dndUseSonnet` localStorage). Ollama serves as the offline fallback when Anthropic is unreachable.

## Claude API Setup (Primary)

### 1. Get an API Key
- Sign up at [console.anthropic.com](https://console.anthropic.com)
- Create an API key under Settings > API Keys

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env:
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Verify Connection
Start the server and check the AI status indicator in the app header. As of v1.0.102, the indicator reflects a **real probe of the Anthropic API** (cheap `count_tokens` call) rather than just a check that the env var is set, so the displayed status accurately reflects auth/billing health:
- **Orange dot + "Opus"** = Claude API connected, Opus is the active model (production default)
- **Purple dot + "Sonnet"** = Claude API connected, Sonnet selected via toggle (opt-down for cost)
- **Green dot + "Ollama"** = Claude unavailable, Ollama is being used as fallback
- **Red dot + "AI Offline"** = No AI provider available (key missing, billing failure, or both)

If the API key is invalid or the Anthropic account has a billing issue, the status indicator will say "AI Offline" even though the env var is set — this is intentional. Surfaces auth/billing problems before a session starts rather than mid-play.

### Cost Considerations
- **Claude Opus** handles all world-building and content generation, AND all DM session continuations as of v1.0.99 (the prose-quality investigation found Opus was the differentiator; cost was made tenable by the v1.0.96/v1.0.98 cache architecture work).
- **Claude Sonnet** is available as an opt-down toggle if cost matters more than prose density on a particular session.
- **Typical Opus DM session: ~$2.50–$4.50** depending on session length and cache hit rate. Roughly **~$1.30–$1.50/hour of play**. See session 147/148 analysis in `DECISION_LOG.md` for the underlying measurements and cost-decomposition math.
- Sonnet sessions run roughly **1/5 to 1/10** the cost of Opus sessions.
- A user-set spending cap at [console.anthropic.com](https://console.anthropic.com) → Settings → Billing is the recommended hard backstop. Independent of any code-level controls.

---

## Ollama Setup (Offline Fallback)

Ollama enables fully offline play with no API costs.

### Installation
```bash
# macOS
brew install ollama
brew services start ollama

# Pull the default model
ollama pull gpt-oss:20b

# Optional: stronger narration (tighter VRAM fit on 16GB cards)
ollama pull qwen3.5:27b

# Optional: lighter/faster fallback
ollama pull qwen3.5:9b
```

### Configuration
No `.env` changes needed for the default. The app automatically connects to Ollama at `http://localhost:11434` and uses `gpt-oss:20b`. Override via `OLLAMA_MODEL=qwen3.5:27b` (or any installed tag) in `.env`.

### Model Information
| Model | Size | VRAM (Q4) | Notes |
|-------|------|-----------|-------|
| **gpt-oss:20b** (default) | ~12 GB | ~12 GB | Fast, good narration, comfortable fit on 16GB cards |
| qwen3.5:27b | ~16 GB | ~16 GB | Best narration; tight VRAM fit |
| qwen3.5:9b | ~5 GB | ~6 GB | Budget pick, still capable |
| gemma4:26b | ~15 GB | ~15 GB | Alternative to qwen3.5:27b |

Reasoning-model `<think>` / `<thinking>` / `<reasoning>` tokens are automatically stripped before responses reach the player, so DeepSeek R1 and similar reasoning models are safe to use (though not recommended for narration).

### Status Indicator
- **Green dot + "Ollama"** = Ollama connected and serving locally

---

## Provider Detection & Fallback

The server checks providers on startup and per-request:

1. **Check Claude API** — If `ANTHROPIC_API_KEY` is set, test the connection
2. **Check Ollama** — If Claude is unavailable, check `localhost:11434`
3. **Status endpoint** — `GET /api/dm-session/llm-status` returns provider info

When Claude is available, Claude Opus handles all world-building and content generation while Claude Sonnet runs interactive DM sessions. When only Ollama is available, the configured local model (default `gpt-oss:20b`) handles all tasks.

---

## Troubleshooting

### Claude API Issues
```bash
# Verify API key is set
echo $ANTHROPIC_API_KEY

# Test API directly
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-opus-4-7","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Ollama Issues
```bash
# Check if running
brew services list | grep ollama

# Restart
brew services restart ollama

# Verify model installed
ollama list

# Test directly
ollama run gpt-oss:20b "Write a D&D adventure hook"
```

### Server Logs
```bash
# Watch server output for LLM-related errors
npm run server
```
