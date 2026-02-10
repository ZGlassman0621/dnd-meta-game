# LLM Setup & Configuration

The D&D Meta Game uses a **multi-model AI architecture** with Claude as the primary provider and Ollama as an offline fallback.

---

## AI Models Used

| Model | Purpose | When Used |
|-------|---------|-----------|
| **Claude Opus** (`claude-opus-4-6`) | World building & generation | Campaign plans, backstory parsing, NPC/quest/location/companion generation, living world events, adventure generation, first session opening |
| **Claude Sonnet** (`claude-sonnet-4-5`) | AI Dungeon Master sessions | Continuing session gameplay, narration, combat, dialogue |
| **Ollama (Llama 3.1:8b)** | Offline fallback | All of the above when no internet/API key available |

> **Note:** Both Claude models use alias IDs (no date suffix) so they automatically resolve to the latest available version when Anthropic releases updates.

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
│  │  │ Opus       │  │  │  │ Llama 3.1 8B   │  │  │
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

# Pull the model
ollama pull llama3.1:8b
```

### Configuration
No `.env` changes needed. The app automatically connects to Ollama at `http://localhost:11434`.

### Model Information
| Property | Value |
|----------|-------|
| Model | Llama 3.1 8B |
| Size | ~4.9 GB |
| Speed | 6-8 seconds per generation |
| Quality | Good for creative D&D content |

### Status Indicator
- **Green dot + "Ollama"** = Ollama connected and serving locally

---

## Provider Detection & Fallback

The server checks providers on startup and per-request:

1. **Check Claude API** — If `ANTHROPIC_API_KEY` is set, test the connection
2. **Check Ollama** — If Claude is unavailable, check `localhost:11434`
3. **Status endpoint** — `GET /api/dm-session/llm-status` returns provider info

When Claude is available, Claude Opus handles all world-building and content generation while Claude Sonnet runs interactive DM sessions. When only Ollama is available, Llama 3.1 handles all tasks.

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
  -d '{"model":"claude-sonnet-4-5","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
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
ollama run llama3.1:8b "Write a D&D adventure hook"
```

### Server Logs
```bash
# Watch server output for LLM-related errors
npm run server
```
