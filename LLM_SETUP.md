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
│  │  │ Opus       │  │  │  │ Gemma 3 12B    │  │  │
│  │  │ (building) │  │  │  │ (all tasks)    │  │  │
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

All AI generators (quests, locations, companions, living world, adventures) use Claude Opus for generation with Ollama as offline fallback. Only DM sessions use Claude Sonnet.

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
Start the server and check the AI status indicator in the app header:
- **Purple dot + "Opus + Sonnet"** = Claude API connected with both models
- **Red dot + "AI Offline"** = No AI provider available

### Cost Considerations
- **Claude Opus** handles all world-building and content generation (campaign plans, backstory parsing, NPC/quest/location/companion generation)
- **Claude Sonnet** handles only DM sessions (real-time interactive gameplay) at lower cost
- Typical DM session: ~$0.05-0.15 depending on conversation length
- Generation tasks (backstory parsing, quest creation, etc.) use Opus for higher quality output

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
