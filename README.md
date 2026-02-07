# D&D Meta Game

A comprehensive AI-powered solo D&D campaign management system. Create characters, generate living world campaign plans, and play through adventures with an AI Dungeon Master powered by Claude.

## Features

### Character Management
- **Character Sheet** — Create and manage D&D 5e characters with race, class, background, stats, and equipment
- **Backstory Parser** — AI parses freeform backstories into structured elements (characters, locations, factions, events, story hooks) that feed into campaign generation
- **Companions** — Track companion characters and their backstories
- **Downtime** — Manage downtime activities between adventures

### Campaign System
- **Campaigns** — Create campaigns with descriptions, tones, settings, and starting locations
- **Campaign Plan Generation** — Opus 4.5 generates comprehensive living world plans including main quest arcs, NPCs, factions, locations, world timeline events, side quests, and DM notes — all woven around your character's backstory
- **Spoiler System** — Campaign plan viewer hides DM-sensitive content (NPC roles, faction allegiances, secrets) behind toggleable spoiler covers

### AI Dungeon Master
- **AI DM Sessions** — Play through your campaign with an AI Dungeon Master that uses your campaign plan as context
- **Campaign Continuity** — Sessions build on previous adventures with persistent world state
- **Content Preferences** — Control mature themes, combat detail, romance, and other content toggles

### World Building
- **NPC Generator** — Create custom NPCs with AI assistance
- **NPC Relationships** — Track relationships between NPCs and your character

### Meta Game
- **Campaign Stats** — Track adventure outcomes, XP progression, and campaign statistics
- **Content Generation** — AI-powered content generation tools

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite (with optional Turso cloud migration)
- **AI:** Claude API (Opus 4.5 for generation, Sonnet for sessions) with Ollama fallback for offline play

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

## License

MIT
