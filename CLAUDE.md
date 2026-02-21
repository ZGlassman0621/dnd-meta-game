# CLAUDE.md - Project Instructions for Claude Code

## Project Overview
D&D Meta Game: AI-powered solo D&D 5e campaign management system.
- **Frontend**: React 18 + Vite (SPA at `client/`)
- **Backend**: Node.js + Express (ES modules at `server/`)
- **Database**: SQLite via `@libsql/client` (local `file:local.db` or Turso cloud)
- **AI**: Claude Opus (world building) + Claude Sonnet (DM sessions) + Ollama fallback

## Development Commands
- `npm run dev` — Start both server (port 3000) and client (port 5173)
- `npm run server` — Server only with `--watch`
- `npm run client` — Vite dev server only
- `npm run build` — Production client build
- `npm run install-all` — Install root + client dependencies
- Tests: `node tests/<testfile>.test.js` (no framework, custom assertions)

## Architecture Rules
- All JS uses ES modules (`import`/`export`, `"type": "module"` in package.json)
- Claude model aliases (no date suffix): `claude-opus-4-6`, `claude-sonnet-4-6`
- Opus handles ALL generation (campaign plans, backstory, NPCs, quests, locations, companions, adventures, living world)
- Sonnet handles ONLY interactive DM sessions (except first session opening which uses Opus)
- AI markers in DM responses: `[COMBAT_START]`, `[COMBAT_END]`, `[LOOT_DROP]`, `[MERCHANT_SHOP]`, `[MERCHANT_REFER]`, `[ADD_ITEM]`
- DM prompt uses primacy/recency reinforcement — critical rules at top (ABSOLUTE RULES) and bottom (FINAL REMINDER)
- Event bus (`server/services/eventEmitter.js`) connects game systems
- Error handling via `server/utils/errorHandler.js` (handleServerError, notFound, validationError)

## Key Files
- `server/index.js` — Express entry, route mounting
- `server/database.js` — Schema (monolithic, ~1300 lines)
- `server/services/claude.js` — Claude API client
- `server/services/dmPromptBuilder.js` — DM system prompt (~600 lines)
- `server/services/dmSessionService.js` — Session logic, marker detection
- `server/routes/dmSession.js` — DM session routes (~1700 lines)
- `client/src/App.jsx` — SPA root, navigation, state
- `client/src/components/DMSession.jsx` — Main DM session UI (~4300 lines)

## Coding Conventions
- No TypeScript — pure JavaScript throughout
- React functional components with hooks (useState, useEffect)
- Large monolithic components (DMSession, CharacterSheet, CharacterCreationWizard) — don't split unless asked
- Inline styles in React components (no CSS framework)
- SQLite queries use parameterized `?` placeholders
- API routes follow REST patterns: `/api/<resource>/...`
- JSON stored in TEXT columns for flexible data (inventory, ability_scores, etc.)

## Don't
- Don't add TypeScript
- Don't add a CSS framework
- Don't split large components unless explicitly asked
- Don't change AI model aliases or add date suffixes
- Don't modify the primacy/recency prompt structure without understanding the pattern
- Don't create new documentation files unless asked
