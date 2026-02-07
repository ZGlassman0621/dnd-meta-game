# LLM Setup & Configuration

The D&D Meta Game uses a **multi-model AI architecture** with Claude as the primary provider and Ollama as an offline fallback.

---

## AI Models Used

| Model | Purpose | When Used |
|-------|---------|-----------|
| **Claude Opus 4.5** | Campaign plan generation | Creating comprehensive living world plans (NPCs, factions, locations, quest arcs, timeline) |
| **Claude Sonnet 4** | AI Dungeon Master sessions | Real-time interactive gameplay, session narration, combat, dialogue |
| **Claude Sonnet 4** | Backstory parsing | Analyzing freeform backstories into structured elements |
| **Claude Sonnet 4** | Content generation | NPC generation, companion backstories, quest generation, location generation |
| **Ollama (Llama 3.2)** | Offline fallback | All of the above when no internet/API key available |

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
│  │  │ Opus 4.5   │  │  │  │ Llama 3.2 3B   │  │  │
│  │  │ (campaigns)│  │  │  │ (all tasks)    │  │  │
│  │  ├────────────┤  │  │  └────────────────┘  │  │
│  │  │ Sonnet 4   │  │  │                      │  │
│  │  │ (sessions) │  │  │  localhost:11434      │  │
│  │  └────────────┘  │  └──────────────────────┘  │
│  └─────────────────┘                             │
└──────────────────────────────────────────────────┘
```

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
- **Opus 4.5** is used only for campaign plan generation (infrequent, ~1 call per campaign)
- **Sonnet 4** handles all other tasks (sessions, parsing, generation) at lower cost
- Typical session: ~$0.05-0.15 depending on conversation length

---

## Ollama Setup (Offline Fallback)

Ollama enables fully offline play with no API costs.

### Installation
```bash
# macOS
brew install ollama
brew services start ollama

# Pull the model
ollama pull llama3.2:3b
```

### Configuration
No `.env` changes needed. The app automatically connects to Ollama at `http://localhost:11434`.

### Model Information
| Property | Value |
|----------|-------|
| Model | Llama 3.2 3B |
| Size | ~2.0 GB |
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

When Claude is available, Opus 4.5 is used for campaign plan generation and Sonnet 4 for everything else. When only Ollama is available, Llama 3.2 handles all tasks.

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
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
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
ollama run llama3.2:3b "Write a D&D adventure hook"
```

### Server Logs
```bash
# Watch server output for LLM-related errors
npm run server
```
