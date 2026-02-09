# D&D Meta Game

A comprehensive AI-powered solo D&D campaign management system. Create characters, generate living world campaign plans, and play through adventures with an AI Dungeon Master powered by Claude.

## Quick Start Flow

```
Create Character → Write Backstory (optional) → Create Campaign → Auto-Pipeline Runs → Play!
```

When you create a campaign, the system automatically:
1. Assigns your character
2. Parses your backstory (if you have one)
3. Generates a full living world campaign plan with Opus 4.5
4. Presents a "Play Now" button to jump straight into adventure

## Features

### Character Management
- **Character Sheet** — Full D&D 5e characters with race, class, background, stats, equipment, and leveling
- **Backstory Parser** — AI parses freeform backstories into structured elements (characters, locations, factions, events, story hooks) that feed into campaign generation
- **Companions** — Track companion characters and their backstories
- **Downtime** — Manage downtime activities between adventures

### Campaign System
- **Streamlined Campaign Creation** — Starting location dropdown with 15 Forgotten Realms locations, auto-detects location from parsed backstory
- **Auto-Pipeline** — Campaign creation automatically assigns character, parses backstory, and generates the full campaign plan in one flow
- **Campaign Plan Generation** — Opus 4.5 generates comprehensive living world plans including main quest arcs, NPCs, factions, locations, world timeline events, side quests, and DM notes — all woven around your character's backstory
- **Spoiler System** — Campaign plan viewer hides DM-sensitive content (NPC roles, faction allegiances, secrets) behind toggleable spoiler covers

### AI Dungeon Master
- **AI DM Sessions** — Play through your campaign with an AI Dungeon Master that uses your campaign plan as context
- **Campaign Continuity** — Sessions build on previous adventures with persistent world state
- **Gameplay Tabs** — Switch between Adventure, Downtime, and Stats tabs during active sessions
- **Content Preferences** — Control mature themes, combat detail, romance, survival mode, and other content toggles
- **Play Button** — Quick-launch into your adventure from the home screen

### World Building
- **NPC Generator** — Create custom NPCs with AI assistance
- **NPC Relationships** — Track relationships between NPCs and your character

### Meta Game
- **Campaign Stats** — Track adventure outcomes, XP progression, and campaign statistics
- **Content Generation** — AI-powered content generation tools

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite (local file, with optional Turso cloud sync)
- **AI:** Claude API (Opus 4.5 for campaign generation, Sonnet 4 for sessions) with Ollama fallback for offline play

## Setup

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
| [APPLICATION_SUMMARY.md](APPLICATION_SUMMARY.md) | Comprehensive system documentation |
| [LLM_SETUP.md](LLM_SETUP.md) | AI model configuration (Claude + Ollama) |
| [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md) | Development phases and technical details |
| [RECENT_IMPROVEMENTS.md](RECENT_IMPROVEMENTS.md) | Latest feature additions |
| [TEST_RESULTS.md](TEST_RESULTS.md) | System test results |
| [FUTURE_FEATURES.md](FUTURE_FEATURES.md) | Planned enhancements |

## License

MIT
