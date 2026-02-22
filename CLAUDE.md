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
- AI markers in DM responses: `[COMBAT_START]`, `[COMBAT_END]`, `[LOOT_DROP]`, `[MERCHANT_SHOP]`, `[MERCHANT_REFER]`, `[ADD_ITEM]`, `[WEATHER_CHANGE]`, `[SHELTER_FOUND]`, `[SWIM]`, `[EAT]`, `[DRINK]`, `[FORAGE]`, `[RECIPE_FOUND]`, `[MATERIAL_FOUND]`, `[CRAFT_PROGRESS]`, `[RECIPE_GIFT]`
- DM prompt uses primacy/recency reinforcement — critical rules at top (ABSOLUTE RULES) and bottom (FINAL REMINDER)
- Event bus (`server/services/eventEmitter.js`) connects game systems
- Error handling via `server/utils/errorHandler.js` (handleServerError, notFound, validationError)
- Story Chronicle system: canon facts in `canon_facts` table, session chronicles in `story_chronicles` table
- Context window management: adaptive budgeting (2K-8K tokens), sliding window compression for long sessions
- No storage caps: campaign_notes, character_memories, and usedNames all grow without limit
- NPC conversation memory: `npc_conversations` table stores dialogue summaries, topics, tone, key quotes per NPC per session
- Companion emotional state: mood columns on `companion_backstories` (mood, mood_cause, mood_intensity, mood_set_game_day) with time-based decay
- NPC lifecycle state machine: `lifecycle_status` on `npcs` table (alive/deceased/missing/imprisoned/unknown), `npc_lifecycle_history` audit trail
- NPC personality enrichment: session extraction fills voice/personality/mannerism/motivation/appearance over time (fill-not-overwrite), `enrichment_level` tracks depth
- NPC death propagation: `propagateNpcDeath()` in `npcLifecycleService.js` cascades to companion status, canon facts, promises/debts, narrative queue, events
- NPC voice differentiation: `generateNpcVoiceHint()` in dmPromptBuilder.js — enriched NPCs get personality RP hints, others get occupation-based voice guidance
- Companion activities: `companion_activities` table tracks off-screen activities (training, scouting, etc.); companions can be 'away' status; activities resolve via Opus AI
- Companion dismiss is soft-delete: status='dismissed' preserves history instead of DELETE
- World event NPC effects: `worldEventNpcService.js` generates NPC effects (disposition shift, location change, status change, occupation change) when world events advance stages
- NPC mail system: `npcMailService.js` scores NPC candidates (disposition/trust/absence/events), generates AI or template mail, queues via narrative_queue — runs as step 3.75 in living world tick
- NPC aging/absence: `npcAgingService.js` decays disposition/trust based on days since last interaction (applied at session start like decayMoods), reunion boost (+3 disp) after 14+ day absence, relocation/forget thresholds for extreme absence
- `last_interaction_game_day` INTEGER on `npc_relationships` — populated by `recordInteraction()`, used for absence math and [ABSENCE: X days] annotations in DM prompt
- Weather system: `campaign_weather` table per campaign, season-based probability tables with region modifiers, temperature = base + weather mod + time-of-day mod, gear warmth scanned from inventory, exposure thresholds (extreme cold <0°F, cold <32°F, hot >85°F, extreme heat >100°F)
- Survival system: D&D 5e PHB rules — 1 food + 1 water/day, starvation after 3+CON mod days, dehydration after 1 day, auto-consume during long rest, perishable food spoilage (heat wave halves shelf life), foraging DC by terrain
- Crafting system: `crafting_recipes`/`character_recipes`/`crafting_projects`/`character_materials` tables, quality tiers (standard/fine/superior/masterwork) based on d20 roll margin, default vs discoverable recipes, tool proficiency requirements
- Radiant recipes: AI-generated unique recipes via `[RECIPE_GIFT]` marker — `is_radiant=1`, `gifted_by` tracks NPC attribution, linked via `character_recipes` with `discovered_method='gift'`
- Recipe data: 112 total recipes (42 default, 70 discoverable) across 3 data files — weapons (simple + martial), armor (light/medium/heavy + shields), ammunition, food, gear, potions, poisons, scrolls, alchemical

## Key Files
- `server/index.js` — Express entry, route mounting
- `server/database.js` — Schema (imports migrationRunner, ~35 lines)
- `server/migrationRunner.js` — Numbered migration system with up/down
- `server/services/claude.js` — Claude API client
- `server/services/dmPromptBuilder.js` — DM system prompt (~600 lines)
- `server/services/dmSessionService.js` — Session logic, marker detection
- `server/services/storyChronicleService.js` — Canon fact database, session chronicles, context retrieval, NPC conversation + mood extraction
- `server/services/npcRelationshipService.js` — NPC relationship CRUD, conversation memory
- `server/services/npcLifecycleService.js` — NPC lifecycle transitions, death propagation cascade, canon fact sync
- `server/services/companionBackstoryService.js` — Companion backstories, loyalty, mood system
- `server/services/companionActivityService.js` — Away companion activities, resolution, recall
- `server/services/worldEventNpcService.js` — NPC effects from world event stage advances
- `server/services/npcMailService.js` — NPC mail candidate scoring, AI/template content generation, narrative queue integration
- `server/services/npcAgingService.js` — Absence-based disposition/trust decay, reunion boost, relocation/forget thresholds
- `server/services/livingWorldService.js` — Living world tick pipeline (weather → factions → events → companions → NPC mail → survival → record)
- `server/services/narrativeQueueService.js` — Narrative queue CRUD, priority ordering, delivery tracking, AI context formatting
- `server/services/weatherService.js` — Weather state, generation, advance, temperature, exposure checks
- `server/services/survivalService.js` — Hunger, thirst, food spoilage, auto-consume, foraging DC
- `server/services/craftingService.js` — Recipes, projects, materials, quality, discovery
- `server/config/weather.js` — Weather types, season tables, region mods, exposure rules, gear warmth
- `server/data/craftingRecipes.js` — Main recipe catalog (imports + exports 112 recipes)
- `server/data/weaponRecipes.js` — Simple + martial weapon recipes (32)
- `server/data/armorGearRecipes.js` — Armor, ammunition, gear, food, alchemical recipes (38)
- `server/migrations/009_radiant_recipes.js` — Radiant recipe columns + unique name index
- `server/utils/contextManager.js` — Token estimation, context window compression, adaptive budgeting
- `server/routes/dmSession.js` — DM session routes (~1700 lines)
- `server/routes/chronicle.js` — Chronicle API routes (timeline, search, facts)
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
