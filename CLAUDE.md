# CLAUDE.md — Project Instructions for Claude Code

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

## Architecture

### Stack & conventions
- All JS is ES modules (`import`/`export`, `"type": "module"` in package.json). No TypeScript.
- React functional components with hooks. No CSS framework — inline styles throughout.
- SQLite queries use parameterized `?` placeholders. JSON is stored in TEXT columns for flexible fields (inventory, ability_scores, etc.).
- API routes follow REST: `/api/<resource>/...`.
- Migrations are numbered (`server/migrations/NNN_*.js`) and run in order via `server/migrationRunner.js`. Migrations are additive after ~011; early ones drop/recreate tables.

### AI model discipline
- Model aliases (no date suffix): `claude-opus-4-7`, `claude-sonnet-4-6` — major.minor is pinned; bump manually when a new Claude version ships.
- **Opus handles ALL generation** — campaign plans, backstory, NPCs, quests, locations, companions, adventures, living world, prelude arc plans.
- **Sonnet handles ONLY interactive DM sessions** (including prelude sessions), plus chronicle extraction. Exception: the first session opening uses Opus for narrative richness.
- Structured JSON from LLMs goes through `server/utils/llmJson.js` — `extractLLMJson()` / `tryExtractLLMJson()`. Don't write new ad-hoc parsers; Opus occasionally emits multi-block responses that naive extractors splice into invalid JSON.

### Prompt structure
- DM prompt uses **primacy/recency reinforcement**: critical rules appear at the top (ABSOLUTE RULES) AND bottom (FINAL REMINDER). Don't modify this structure without understanding the pattern — it's the main lever holding the AI to the rules.
- DM Mode prompt uses a 3-point reinforcement (ABSOLUTE RULES → character sheets + dynamics → FINAL REMINDER).
- Prompt caching via `claude.js` has three tiers (cache-break markers embedded in the prompt string): universal-static, per-character static, dynamic. Only blocks ≥1024 tokens are cached.

### DM session markers
Markers the DM AI emits during Player Mode sessions, each detected and processed server-side:
`[COMBAT_START]` `[COMBAT_END]` `[LOOT_DROP]` `[MERCHANT_SHOP]` `[MERCHANT_REFER]` `[ADD_ITEM]` `[MERCHANT_COMMISSION]` `[BASE_DEFENSE_RESULT]` `[WEATHER_CHANGE]` `[SHELTER_FOUND]` `[SWIM]` `[EAT]` `[DRINK]` `[FORAGE]` `[RECIPE_FOUND]` `[MATERIAL_FOUND]` `[CRAFT_PROGRESS]` `[RECIPE_GIFT]` `[MYTHIC_TRIAL]` `[PIETY_CHANGE]` `[ITEM_AWAKEN]` `[MYTHIC_SURGE]` `[PROMISE_MADE]` `[PROMISE_FULFILLED]` `[NOTORIETY_GAIN]` `[NOTORIETY_LOSS]` `[CONDITION_ADD]` `[CONDITION_REMOVE]`.

Prelude sessions have their own marker set (see prelude section below).

### Memory systems
Three layers of persistent world memory flow into the DM prompt:

**Canon facts** (`canon_facts` table) — structured ground-truth: NPC details, location facts, relationships. Loaded in full, no SQL cap.

**Story chronicles** (`story_chronicles` table) — 300–500-word Opus-generated session recaps with mood, cliffhanger, key decisions, NPCs involved. ALL chronicles load into session prompt.

**NPC conversations** (`npc_conversations` table) — last ~5 per NPC, summaries + topics + tone + key quotes. Up to 25 NPCs × 4 conversations each injected into DM prompt.

Plus: standalone promises/debts summary, graduated absence annotations (`[ABSENCE: X days]` at 7/14/30 day thresholds), per-NPC aging/decay of disposition when absent long enough.

Context-window budgeting is adaptive: 40% of remaining context, no hard cap, sliding-window compression kicks in for long sessions.

### Story / narrative systems
- **NPC lifecycle** (`lifecycle_status` on `npcs`): alive/deceased/missing/imprisoned/unknown with `npc_lifecycle_history` audit trail. Death propagation cascades to companion status, canon facts, promises/debts, narrative queue, events.
- **NPC enrichment**: session extraction fills voice/personality/mannerism/motivation/appearance over time (fill-not-overwrite).
- **NPC aging/absence**: decays disposition/trust based on days since last interaction; reunion boost +3 after 14+ days; relocation/forget thresholds for extreme absence.
- **Promises**: `[PROMISE_MADE]` / `[PROMISE_FULFILLED]` markers with weight (trivial→critical). Breaking/fulfilling scales disposition ±40, trust, reputation ripple to nearby NPCs, and faction standing. Overdue promises auto-break after 45 game days (warning at 21).
- **Quests**: milestone-based faction-driven spawning at 25/50/75/100% goal progress; conflict quests when rival factions clash; standing-based reward scaling. Active quests injected into DM prompt with type labels `[MAIN]`/`[FACTION]`/`[CONFLICT]`/`[COMPANION]`/`[SIDE]`. Expired quests auto-fail with escalation narratives.
- **Consequences**: `consequence_log` table tracks automated outcomes (broken promises, expired quests) with narrative queue integration.
- **Narrative queue**: persistent priority-ordered queue for between-session developments; delivered at session start.

### World simulation
- **Living world tick pipeline** (`livingWorldService.js`): weather → factions → events → conflict quests → companions → NPC mail → consequences → survival → base income → base threats → notoriety → custom-order delivery → record.
- **Weather**: season-based probability tables with region modifiers; exposure thresholds (extreme cold <0°F, hot >85°F, etc.); gear warmth scanned from inventory.
- **Survival** (D&D 5e PHB rules): 1 food + 1 water/day; starvation after 3+CON mod days; dehydration after 1 day; auto-consume on long rest; perishable spoilage; foraging DC by terrain.
- **World events**: multi-stage events with NPC effects (disposition shift, location change, status change, occupation change) when stages advance.
- **NPC mail**: candidate scoring (disposition/trust/absence/events) → Opus or template content → narrative queue.

### Economy & merchants
- Persistent merchant inventories from loot tables (not AI-generated per visit). DMG + XGtE items across 5 rarities (common through legendary, 13 cursed items display as disguised forms).
- `[MERCHANT_SHOP]` detection injects real inventory into the AI prompt; `[MERCHANT_REFER]` redirects to another merchant (auto-guarantees item exists there); `[ADD_ITEM]` adds custom narrative items with quality tiers.
- **Economy simulation**: per-category pricing from world events × regional geography × merchant memory (loyalty discounts, demand markups); bulk discounts at 3/5/10+ items; disposition-based price modifier −10%..+15%, faction modifier −5%..+10%, clamped combined.
- **Merchant commissions** (`merchant_orders` table): `[MERCHANT_COMMISSION]` marker places custom orders; pending → ready at deadline → collected/expired (30-day hold).
- **Bargaining**: pure-math haggling in `bargainingService.js`; DC from disposition + rarity + prosperity; theme bonuses (+2 Persuasion for Guild Artisan/Noble; Deception for Charlatan; Intimidation for Criminal/Mercenary Veteran); single-use per transaction; clamped to [0, 20]%.
- **Merchant relationships** panel composes per-merchant rows from transaction history + npc_relationships + loyalty tiers.

### Party systems
- **Shared party inventory** (M1): carried inventory + gold live on the recruiting character. Companions keep per-entity `equipment` slots (mainHand/offHand/armor) but no carried items or coin. Transfer is `POST /api/companion/:id/equip` / `/unequip`.
- **Companions**: full 5e progression — multiclass via `companion_class_levels` JSON array; spell slots, hit dice, rest mechanics, conditions (JSON array), death saves, mood, loyalty. Mirror of the character-side system.
- **Companion activities**: off-screen tasks (training, scouting) with away status; Opus-resolved outcomes.

### Progression (themes / ancestry feats / synergies)
- 21 themes × 4 tiers = 84 theme abilities. 195 ancestry feats across 13 lists. 20 team tactics. 50 subclass×theme synergies. 17 mythic×theme amplifications. All seed data in `server/data/*.js`, loaded idempotently on startup.
- Themes auto-unlock at L5/L11/L17; ancestry feats at L3/L7/L13/L18. Character-side prompts the player at level-up; companion-side auto-picks deterministically.
- Knight theme has 6 moral paths (True/Reformer/Martyr/Complicit/Fallen/Redemption) with tailored DM directives.
- Resonant subclass×theme and mythic×theme amplifications surface in the DM prompt and on the Progression tab of the character sheet.

### Mythic progression (endgame)
- 5 tiers (Touched by Legend → Apotheosis), 14 paths (12 player + 2 DM-only: Hierophant, Angel, Aeon, Azata, Gold Dragon, Lich, Demon, Devil, Trickster, Legend, Redemption, Corrupted Dawn, Beast/Dark Hunt, Swarm).
- Mythic Power resource pool (3 + 2×tier/day); Surge mechanic (bonus die d6→d12 by tier); trial-based advancement.
- Shadow-path interaction: light paths require shadow ≤5 (full power at ≤2); dark paths powered by shadow; neutral unaffected.
- Piety system (Theros): score 1–50+ per deity, thresholds at 3/10/25/50 unlock abilities; 53 deities covering the character-creator pantheons.
- Epic Boons (2024 PHB): 12 boons at Level 19+, each with +1 ability score (max 30).
- Legendary items: 4 states (Dormant → Awakened → Exalted → Mythic), narrative-milestone advancement.

### Crafting
- Tables: `crafting_recipes` / `character_recipes` / `crafting_projects` / `character_materials`.
- 112 recipes total (42 default, 70 discoverable) — weapons (simple + martial), armor (light/medium/heavy + shields), ammunition, food, gear, potions, poisons, scrolls, alchemical.
- Quality tiers (standard/fine/superior/masterwork) based on d20 roll margin. Tool proficiency required.
- **Radiant recipes**: `[RECIPE_GIFT]` marker creates AI-generated unique recipes with `is_radiant=1` and NPC attribution.

### Party bases / fortresses
- Bases have `category` (civilian/martial/arcane/sanctified) and `subtype` (13 options: watchtower/outpost/keep/fortress/castle/tavern/hall/manor/wizard_tower/academy/chapel/temple/sanctuary). `is_primary` flag + `building_slots` derived from subtype.
- **Buildings** inside a base via `BUILDING_TYPES` config (20 buildings with slots/cost/hours/perks). Construction status `planned → in_progress → completed`; perks merge into `base.active_perks`; demolish reverses.
- **Garrison + defense**: `defense_rating` = subtype bonus + building perks + officer contributions. `base_officers` table assigns companions to roles.
- **Base threats** (raids/sieges): `base_threats` table, status state machine (approaching → defending/resolving → resolved), outcome enum (repelled/damaged/captured/abandoned). Raid-capable world events spawn threats during the living-world tick; auto-resolve or player-led defense via `[BASE_DEFENSE_RESULT]` marker. 14-day recapture window for captured bases.
- **Renown, levels, treasury, staff, income/upkeep** all processed in the living-world tick.

### Notoriety / heat
- 0–100 score per source (City Watch, Thieves' Guild, etc.), 5 categories (criminal/political/arcane/religious/military).
- Decays 1–2/day; entanglement checks at thresholds (21–40: 10%/day, 41–60: 20%, 61–80: 35%, 81–100: 50%).
- `[NOTORIETY_GAIN]` / `[NOTORIETY_LOSS]` markers detected in DM responses.

### Authentication
- JWT-based, bcryptjs hashing; secret auto-generated + stored in `_app_settings`.
- Middleware (`server/middleware/auth.js`) verifies Bearer token on `/api/*` except `/api/auth/*` and `/api/health`.
- Campaigns scoped to `user_id`.
- Frontend intercepts `window.fetch` to inject Authorization header on `/api` requests; LoginPage renders when no valid token.

### DM Mode (user-as-DM)
Inverted game mode: user DMs, AI controls 4 distinct player characters.
- `dm_mode_parties` table: name, setting, tone, level, `party_data` (JSON blob for stats/spells/inventory/gold — persists across sessions), `party_dynamics` (JSON).
- `dm_sessions` with `session_type='dm_mode'` and `dm_mode_party_id` (character_id is nullable).
- Opus generates the 4-character party with class/alignment/voice diversity + inter-party tensions.
- **Chronicles** (`dm_mode_chronicles`): Sonnet-extracted structured session data (NPCs, locations, plot threads, character moments, mood, cliffhanger). All chronicles inject into next session's system prompt.
- **Relationship evolution**: Sonnet extracts warmth/trust deltas at session end and updates `party_relationships` + `party_dynamics` (no new tables).
- **NPC codex** (`dm_mode_npcs`): auto-synced from chronicles with voice extraction; searchable panel.
- **Plot threads** (`dm_mode_plot_threads`): status/tags, auto-synced from chronicles with manual overrides.
- **Campaign prep** (`dm_mode_prep`): 6 content types (npc/enemy/location/lore/treasure/session_notes) with full 5e enemy stat blocks.
- **Reference panels** in-session: Equipment, Spells (300+), Rules, effect tracker (round countdown + concentration).
- **OOC**: `OOC:` prefix speaks to players about their characters (purple UI, no marker processing).

### Prelude-forward character creator
Phase 1–4 shipped; full plan in `PRELUDE_IMPLEMENTATION_PLAN.md`. Sessions play ages 5–22 across four chapters before the character enters the main campaign.

**Structure**: 5 play sessions — Chapter 1 (OBSERVE): 1 session, Chapter 2 (LEARN): 1 session, Chapter 3 (DECIDE): 2 sessions, Chapter 4 (COMMIT): 1 session.

**Setup**: `POST /api/prelude/setup` creates a prelude-phase character from an 11-question wizard (`PreludeSetupWizard.jsx`). Starting age is race-derived server-side (humans 6, elves 30, dwarves 18, warforged 1, etc.).

**Arc plan**: Opus generates a structured arc via `preludeArcService.js` — home world (4–6 locals, 2 tensions, 1–2 threats, mentor), 4 chapter arcs (2 beats each, seeded emergences), recurring threads, character trajectory. One re-roll allowed. Departure in Ch4 is a SEED of 3–4 plausible shapes; the actual departure type is driven by the player's committed theme at Ch3 wrap-up.

**Sessions**: Sonnet plays within the arc via `preludeArcPromptBuilder.js`. Rolling summary is tuned for character-development weighting (`rollingSummaryService.js` branches on `session_type='prelude_arc'`).

**Markers**:
- `[AGE_ADVANCE]` — time jumps within or between chapters
- `[HP_CHANGE]` — HP damage/healing during prelude
- `[CHAPTER_END]` — chapter close, triggers session-end recap
- `[CHAPTER_PROMISE]` — fires at Ch3/Ch4 opens; dashed-purple card asking the player what the chapter is about
- `[SESSION_END_CLIFFHANGER]` — session boundary (server nudges with escalating `[SYSTEM NOTE]` at ≥30/50/70 messages)
- 6 emergence markers (`[STAT_HINT]` / `[SKILL_HINT]` / `[CLASS_HINT]` / `[THEME_HINT]` / `[ANCESTRY_HINT]` / `[VALUE_HINT]`) — player-confirmable; caps +2/stat, 2 skills total; chapter-weighted tallies (ch1-2: 1x, ch3: 1.5x, ch4: 2x)
- `[CANON_FACT]` / `[CANON_FACT_RETIRE]` — ground-truth ledger; injected into every Sonnet prompt grouped by category (people/relationships/traits/places/items/events)

**Tables**: `prelude_emergences`, `prelude_values`, `prelude_canon_facts`, `prelude_canon_npcs`, `prelude_canon_locations`, `prelude_arc_plans`. Character columns: `creation_phase` ('prelude'/'ready_for_primary'/'active'), `prelude_age`, `prelude_chapter`, `prelude_setup_data`.

**Prompt discipline**: tone-preset shapes prose register; per-life-stage NPC speech patterns (small child → elder); 4 named time-compression techniques (season-skip / rhythm-compression / selective-detail / AGE_ADVANCE jump); 16 tone tags with applied guidance; no invented character traits (physical markers, secret bloodlines, prophecies) unless in setup.

## Key files

### Server infrastructure
- `server/index.js` — Express entry, route mounting
- `server/database.js` — Schema, imports migrationRunner
- `server/migrationRunner.js` — Numbered up/down migrations
- `server/services/claude.js` — Claude API client (model aliases, 3-tier prompt caching)
- `server/utils/llmJson.js` — **Shared robust JSON extractor for all LLM responses**
- `server/utils/safeParse.js` — Safe JSON.parse for DB-stored JSON
- `server/utils/contextManager.js` — Token estimation, adaptive budgeting
- `server/utils/errorHandler.js` — `handleServerError`, `notFound`, `validationError`
- `server/middleware/auth.js` — JWT middleware
- `server/services/eventEmitter.js` — Event bus between game systems

### Prompt builders & session
- `server/services/dmPromptBuilder.js` — Player Mode DM system prompt
- `server/services/dmModePromptBuilder.js` — DM Mode system prompt
- `server/services/preludeArcPromptBuilder.js` — Prelude session prompt
- `server/services/dmSessionService.js` — Session logic, marker detection
- `server/routes/dmSession.js` — DM session routes (main API surface)
- `server/routes/dmMode.js` — DM Mode routes
- `server/routes/prelude.js` — Prelude routes
- `server/services/preludeSessionService.js` — Prelude session lifecycle
- `server/services/preludeMarkerDetection.js` — Prelude-specific marker parsing
- `server/services/preludeArcService.js` — Opus arc-plan generation
- `server/services/preludeCanonService.js` — Canon-facts ledger
- `server/services/preludeEmergenceService.js` — Stat/skill/theme hints with caps
- `server/services/rollingSummaryService.js` — Per-session rolling summary (branches by session_type)

### World / story
- `server/services/storyChronicleService.js` — Canon facts, chronicles, NPC conversation extraction
- `server/services/npcRelationshipService.js`, `npcLifecycleService.js`, `npcAgingService.js`, `npcMailService.js`, `npcVoiceService.js`
- `server/services/companionBackstoryService.js`, `companionActivityService.js`, `companionBackstoryGenerator.js`, `progressionCompanionService.js`
- `server/services/worldEventNpcService.js`
- `server/services/livingWorldService.js` — Tick orchestration
- `server/services/livingWorldGenerator.js` — Opus faction goals + world events
- `server/services/questService.js`, `questGenerator.js`, `questProgressChecker.js`
- `server/services/narrativeQueueService.js`
- `server/services/consequenceService.js`
- `server/services/campaignPlanService.js` — Opus campaign plan
- `server/services/backstoryParserService.js` — Structured backstory extraction
- `server/services/progressionService.js` — Character progression snapshot
- `server/services/progressionSeedService.js` — Idempotent seed loader

### Gameplay systems
- `server/services/weatherService.js` + `server/config/weather.js`
- `server/services/survivalService.js`
- `server/services/craftingService.js` + `server/data/craftingRecipes.js` (+ weapon/armor/gear subfiles)
- `server/services/merchantService.js`, `merchantOrderService.js`, `merchantRelationshipService.js`, `bargainingService.js`, `economyService.js`
- `server/services/mythicService.js` + `pietyService.js` + `server/config/mythicProgression.js` + `server/routes/mythic.js`
- `server/services/partyBaseService.js`, `longTermProjectService.js`, `notorietyService.js`, `baseThreatService.js`
- `server/config/partyBaseConfig.js`, `raidConfig.js`, `economyConfig.js`
- `server/routes/partyBase.js`

### DM Mode
- `server/services/partyGeneratorService.js` — Opus 4-character party gen
- `server/services/dmModeService.js` — Marker detection, segment parsing
- `server/services/dmModeChronicleService.js` — Session chronicle + relationship evolution
- `server/services/dmModeNpcService.js` — NPC codex + plot threads + voice extraction
- `server/services/dmModePrepService.js` — Campaign prep
- `server/services/dmCoachingService.js` — Sonnet coaching tips

### Progression seed data
- `server/data/themes.js` (21 × 4 tiers), `ancestryFeats.js` (195), `teamTactics.js` (20), `subclassThemeSynergies.js` (50), `mythicThemeAmplifications.js` (17)

### Frontend
- `client/src/App.jsx` — SPA root, navigation, top-level state
- `client/src/components/DMSession.jsx` — Main Player Mode session UI (~3000 lines, do not split further without plan)
- `client/src/components/DMMode.jsx` — DM Mode UI
- `client/src/components/CharacterCreationWizard.jsx` — 4-step wizard (~4300 lines)
- `client/src/components/CharacterSheet.jsx` — Character view/edit (~3600 lines)
- `client/src/components/PreludeSetupWizard.jsx`, `PreludeArcPreview.jsx`, `PreludeSession.jsx`
- `client/src/components/MythicProgressionPage.jsx` — 7-tab mythic UI
- `client/src/components/PartyBasePage.jsx` — 6-tab base management
- Reference panels: `EquipmentReferencePanel`, `SpellReferencePanel`, `RulesReferencePanel`, `PrepReferencePanel`
- `client/src/components/EffectTracker.jsx`, `CombatTracker.jsx`, `DiceRoller.jsx`
- In-session overlays: `InventoryPanel`, `ConditionPanel`, `CampaignNotesPanel`, `QuickReferencePanel`, `CompanionsPanel`, `CommissionsPanel`, `MerchantRelationshipsPanel`, `DMCoachingPanel`
- `client/src/data/references.js` — Ability scores, skills, tools, languages, damage types, weapon properties, magic initiate class flavors
- `client/src/data/preludeSetup.js` — Curated prelude setup options
- `client/src/data/campaignModules.js` — 16 published + 1 custom module definitions

### Design docs (root)
`THEME_DESIGNS.md`, `PARTY_SYNERGIES.md`, `ANCESTRY_FEATS.md`, `SUBCLASS_THEME_SYNERGIES.md`, `MYTHIC_THEME_AMPLIFICATIONS.md`, `DOWNTIME_DESIGN.md`, `PRELUDE_IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_PLAN.md`, `OPEN_QUESTIONS.md`, `FUTURE_FEATURES.md`, `LLM_SETUP.md`, `MYTHIC_PROGRESSION_GUIDE.md`, `CUSTOM_CLASSES.md`, `CHAR_CREATOR_DESCRIPTIONS_AUDIT.md`.

## Versioning & CHANGELOG
- Every meaningful change gets a CHANGELOG.md entry + matching version bump in `package.json` + `client/package.json`.
- Semver patch increments for iterative work (1.0.1, 1.0.2, …). CHANGELOG uses a 4-part display format for readability (1.0.0.1) but package.json uses strict semver.
- At phase/feature boundaries: update CHANGELOG **and** bump both package.json files **in the same commit**. Also update CLAUDE.md if architecture, new services, or new frontend components landed — keep this file a present-tense snapshot, NOT a per-version history (that's CHANGELOG's job).

## Testing discipline
Tests live in `tests/`, custom assertions, no framework. Real Turso DB with `TEST_`-prefixed data cleaned up per run.

**Mandatory before push for any non-trivial change** (new endpoints, prompt changes, marker detection, loot/reward logic, schema changes):
1. Add/update tests.
2. Run the relevant suites.
3. Build the client (`cd client && npx vite build`) to catch compile errors.
4. Log results in `TEST_RESULTS.md`.

Every new API endpoint gets integration tests in `tests/integration.test.js` (happy path, 404/400 errors, interactions, empty state).

## Don't
- Don't add TypeScript.
- Don't add a CSS framework.
- Don't split `DMSession.jsx`, `CharacterSheet.jsx`, or `CharacterCreationWizard.jsx` unless explicitly asked or working a state-refactor plan.
- Don't change AI model aliases or add date suffixes.
- Don't modify the primacy/recency prompt structure without understanding the pattern.
- Don't write new ad-hoc JSON extractors — use `server/utils/llmJson.js`.
- Don't create new documentation files unless asked.
- Don't forget to update CHANGELOG, CLAUDE.md, and package.json versions together at each phase boundary.
