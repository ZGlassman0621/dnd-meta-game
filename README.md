# D&D Meta Game

A comprehensive AI-powered solo D&D 5e campaign management system. Create characters, generate living world campaign plans, and play through adventures with an AI Dungeon Master powered by Claude.

## How to Play (v2.0 — MVP)

> **v2.0.0 reduced this to a focused MVP**: play one character with **Claude Opus 4.8** as your AI Dungeon Master. Other modes and deep systems (DM Mode, the prelude creator, mythic progression, crafting, party bases, merchant economy, the living-world simulation, factions/quests, etc.) were moved to [`/archive/`](archive/README.md) and can be restored later.

```
Create Character → (optional) Write Backstory → Create Campaign → Play!
```
You are the player; the AI is the DM. It runs the world, NPCs, combat, and story. Your character sheet, inventory, companions, spells, leveling, and **world memory** (story chronicles + canon facts + remembered NPCs) persist across sessions.

## Features

> _Note: some features listed below (DM Mode, Living World, Crafting, Mythic Progression, etc.) were **archived in the v2.0 MVP reduction** and are not currently live. The live MVP feature set is: character creation + sheet/inventory/spells/leveling, the progression system, companions, the Player-Mode Opus 4.8 DM session, session memory, and campaign creation/plan. See [`CHANGELOG.md`](CHANGELOG.md) and [`archive/README.md`](archive/README.md)._

### Character Management
- **Character Sheet** — Full D&D 5e characters with race, class, background, stats, equipment, and leveling
- **Spell Management** — 284 spells (1st-9th level), spell slot tracker, prepared/known spells, level-up spell selection
- **Backstory Parser** — AI parses freeform backstories into structured elements that feed into campaign generation
- **Companions** — Recruit and manage companion characters with emotional states and activities

### Player Mode — AI Dungeon Master
- **AI DM Sessions** — Play through your campaign with an AI DM that uses your campaign plan as context
- **Campaign Continuity** — Sessions build on previous adventures with persistent world state, NPC memory, and story chronicles
- **Living World** — Weather, factions, world events, NPC aging, economy simulation, and consequences all tick between sessions
- **Combat & Conditions** — Initiative tracking, 15 D&D 5e conditions + exhaustion, skill checks, companion actions
- **Crafting & Survival** — 112 recipes, weather exposure, hunger/thirst, foraging, shelter
- **Mythic Progression** — Post-level-20 system with 14 paths, piety, epic boons, legendary items

### DM Mode — You Run the Game
- **Party Generation** — Opus generates 4 unique characters with interlocking backstories and genuine tensions
- **Campaign Prep** — Full-screen workspace for NPCs, enemies (full D&D 5e stat blocks), locations, lore, treasure, session notes
- **Session Memory** — Structured chronicles extract NPCs, plot threads, locations, decisions, and character moments across sessions
- **NPC Codex** — Auto-tracks every NPC with voice notes extracted from your narration style
- **Plot Thread Tracker** — Auto-synced from chronicles with manual override for status management
- **Reference Panels** — Equipment & prices, 300+ spell lookup, rules quick reference (conditions, combat, resting, cover, travel, environment)
- **Effect Tracker** — Track spell/condition durations with round countdown, concentration management, auto-decrement
- **DM Coaching** — On-demand tips and DC reference
- **OOC System** — Talk to "players" out of character about their characters

### Campaign System
- **Campaign Plan Generation** — Claude Opus generates living world plans with main quest arcs, NPCs, factions, locations, world events, and DM notes woven around your backstory
- **Campaign Import** — Import externally-planned campaigns via JSON template
- **Spoiler System** — Campaign plan viewer hides DM-sensitive content behind toggleable covers

## Tech Stack

- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express (ES modules)
- **Database:** SQLite (local file, with optional Turso cloud sync)
- **AI:** Claude **Opus 4.8** (`claude-opus-4-8`) as the AI Dungeon Master and for all generation; Sonnet (`claude-sonnet-4-6`) for session-recap extraction. (Ollama fallback retained but dormant.)

## Setup

### Prerequisites
- Node.js (v18 or higher)
- npm
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

### Installation

1. Install dependencies:
   ```bash
   npm run install-all
   ```

2. Create a `.env` file with your Anthropic API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser

### Troubleshooting

- **Can't connect:** Ensure ports 3000 (server) and 5173 (client) aren't in use
- **AI errors:** Verify your `ANTHROPIC_API_KEY` in `.env` and check usage limits at [console.anthropic.com](https://console.anthropic.com)
- **Database:** SQLite database (`local.db`) is created automatically on first run. Delete to reset all data.
- **Offline play:** Install [Ollama](https://ollama.ai) and run `ollama pull gpt-oss:20b` — see [LLM_SETUP.md](LLM_SETUP.md)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both server and client in development mode |
| `npm run server` | Start only the Express server (with --watch) |
| `npm run client` | Start only the Vite client |
| `npm run build` | Build the client for production |
| `npm run start` | Start the production server |
| `npm run offline` | Build and start in offline/production mode |

## Windows Distribution

A portable Windows build is available via GitHub Actions — no Node.js installation required.

1. Go to the repo's **Actions** tab → **Build Windows Release** → **Run workflow**
2. Download the `DnD-Meta-Game-Windows` artifact from the completed run
3. Unzip, add a `.env` file with `ANTHROPIC_API_KEY=your-key`, double-click `Start DnD Meta Game.bat`

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](CLAUDE.md) | Comprehensive technical reference (architecture, key files, conventions) |
| [LLM_SETUP.md](LLM_SETUP.md) | AI model configuration (Claude + Ollama) |
| [MYTHIC_PROGRESSION_GUIDE.md](MYTHIC_PROGRESSION_GUIDE.md) | Mythic progression game design reference |
| [FUTURE_FEATURES.md](FUTURE_FEATURES.md) | Planned enhancements |

## License

MIT
