# D&D Meta Game

A solo D&D game meant to be played essentially forever. You play one character; the Dungeon Master, NPCs, companions and enemies are all run by AI. The world is persistent and built on canonical Forgotten Realms history, and the rules are the 2024 D&D rules. When the book and anything else disagree, the book wins.

The server owns the rules: hit points, death saves, spell slots, rests, gear, XP and the in-game clock. The AI narrates and makes changes through short tags in its replies, which the server checks and applies. The standing rule is that nothing mechanical is left to narration alone.

## Status: building the MVP

The MVP is a self-contained one-shot test campaign, created through the game's normal campaign flow (there is no predefined campaign), covering core play: create a character, play, leave and come back, loot, XP, levelling, quests, companions, roleplay, combat, story, and the world remembering what happened.

Out of MVP scope, even where code exists: the prologue (Prelude), full downtime, fortress/domain management, Mythic progression, legacy characters, and DM Mode (where you run the game and the AI plays a party).

What's in the build today, counted from the code:
- A six-stage character creator for the 2024 rules
- **583 spells**, **23 classes**, **181 subclasses**
- **29 species**, 11 of them available to player characters now
- **21 themes**, replacing backgrounds
- **210 ancestry feats** in 14 lists

## The AI model

The decided DM model is **gemma4:12b, run offline through [Ollama](https://ollama.com) on your own PC**. No API key or internet connection is needed for it.

The code hasn't fully caught up with that decision yet. It still prefers Claude when an `ANTHROPIC_API_KEY` is present, and falls back to Ollama otherwise. To run on gemma4:12b today, leave the key out and point Ollama at the model. See [LLM_SETUP.md](LLM_SETUP.md).

## Running it on the PC

You need Node.js, npm and Ollama.

1. Get the code. The live branch is `phase-4-hybrid-combat`; `main` is stale.
   ```bash
   git clone https://github.com/ZGlassman0621/dnd-meta-game.git
   cd dnd-meta-game
   git checkout phase-4-hybrid-combat
   ```
2. Install dependencies for the server and the client:
   ```bash
   npm run install-all
   ```
3. Pull the model and tell the app to use it:
   ```bash
   ollama pull gemma4:12b
   cp .env.example .env
   # in .env, set: OLLAMA_MODEL=gemma4:12b   (and leave ANTHROPIC_API_KEY unset)
   ```
4. Start the server (port 3000) and the client (port 5173):
   ```bash
   npm run dev
   ```
5. Open **http://localhost:5173**. That's the game; port 3000 is only the API.

A local SQLite database (`local.db`) is created on first run.

## Tests

```bash
npm test                 # the full suite, against a throwaway database
npm test <name>          # one file, e.g. npm test character-hp
```

The suite never touches the real database (`server/scripts/run-tests.js` redirects it). It runs green on Windows; the runner names any file it had to treat specially there.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Server and client together, in development mode |
| `npm run server` | Only the Express server (restarts on change) |
| `npm run client` | Only the Vite client |
| `npm run build` | Build the client for production |
| `npm run start` | Start the production server |
| `npm run offline` | Build, then start in production mode |
| `npm run backup` | Take a verified database snapshot into `backups/` |
| `npm test` | Run the test suite |
| `npm run lint` | Lint the server code |

## Documentation

| Document | What it is |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Technical reference for builders: architecture, rules, feature flags |
| [LLM_SETUP.md](LLM_SETUP.md) | How the AI model is configured |
| [docs/pm/HANDOFF.md](docs/pm/HANDOFF.md) | How work moves between the project manager and the builder |
| `docs/pm/reports/` | One report per finished job: the record of what was built |
| `archive/` | Old plans, audits and logs, kept as history. Not current guidance |

## License

MIT
