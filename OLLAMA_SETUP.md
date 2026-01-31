# Ollama Integration

The D&D Meta Game now uses **Ollama** for local, free LLM generation instead of paid API services.

## What Changed

- **Removed**: Anthropic API dependency (no more $100/month required!)
- **Added**: Ollama with Llama 3.2 3B model (completely free, runs locally)
- **Benefit**: Zero ongoing costs, fast generation, privacy-focused

## How It Works

### Adventure Generation
When you select a risk level and duration, the app sends your character's context to Ollama:
- Character name, class, race, level
- Current location
- Current quest
- Risk level preference

Ollama's Llama 3.2 model generates 3 contextual adventure options that tie into your ongoing quest.

### Example Adventures Generated
For a character fighting a cult of Malar near Thornhaven at high risk:
1. **Gathering Supplies for Thornhaven** - Research and gather supplies to counter Malar's influence
2. **Cult of Malar Informant** - Track down a defected cult member for intel
3. **The Abandoned Laboratory** - Investigate a lab that studied Malar's influence

### Narrative Generation
When adventures complete, Ollama generates immersive D&D-style narratives describing what happened, including:
- Specific NPCs and encounters
- Character skill usage
- Quest hooks for follow-up adventures (25% chance)

## Installation

Ollama is already installed and running on your system:

```bash
# Check Ollama status
brew services list | grep ollama

# Check installed models
ollama list

# Start Ollama (if not running)
brew services start ollama
```

## Model Information

- **Model**: Llama 3.2 3B
- **Size**: 2.0 GB
- **Speed**: 6-8 seconds per generation
- **Quality**: Excellent for creative D&D content

## Configuration

No API keys needed! The app automatically connects to Ollama running locally at `http://localhost:11434`.

## Troubleshooting

If adventure generation stops working:

1. **Check if Ollama is running**:
   ```bash
   brew services list | grep ollama
   ```

2. **Restart Ollama if needed**:
   ```bash
   brew services restart ollama
   ```

3. **Check server logs**:
   ```bash
   tail -f /tmp/server-debug.log
   ```

4. **Test Ollama directly**:
   ```bash
   ollama run llama3.2:3b "Write a D&D adventure hook"
   ```

## Cost Comparison

| Service | Cost | Notes |
|---------|------|-------|
| Anthropic API | $100/month | Requires Claude Max subscription + API credits |
| Ollama (Local) | $0 | Free, unlimited usage, runs on your machine |

## Performance

- **Adventure Options**: ~6-8 seconds
- **Narratives**: ~4-6 seconds
- **Total per adventure cycle**: ~10-14 seconds

Much faster than waiting for external API calls!
