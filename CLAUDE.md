# CLAUDE.md — Project Instructions for Claude Code

> ## ⚠️ MVP REDUCTION (v2.0.0, 2026-06-04) — READ FIRST
>
> The app was deliberately reduced to a focused **Player-Mode MVP**: play one
> character with **Claude Opus 4.8** as the AI Dungeon Master. **Many systems
> described in the sections below were removed and MOVED to `/archive/`** (nothing
> was deleted; mirrored paths; see [`archive/README.md`](archive/README.md)).
> Migrations were left in place — orphaned tables are harmless.
>
> **Live in the MVP:** character creator (`creator/CharacterCreatorV2`), character
> sheet / inventory / spells / leveling, the full progression system (themes +
> tier abilities + ancestry feats + knight paths), companions, the Player-Mode DM
> chat session, session memory (story chronicles + canon facts + NPC recall + NPC
> lifecycle/aging), campaign creation + Opus campaign plan + import + backstory
> parser, dice/combat/conditions, session rewards, AI-behavior debug page.
>
> **Archived (the sections below largely describe these — treat as historical
> until restored):** prelude, DM Mode, mythic/piety/boons/legendary, crafting,
> party bases/raids, downtime, merchant economy/bargaining/commissions, notoriety,
> living-world tick (weather/survival/factions/world-events/NPC-mail/narrative-
> queue/consequences), factions/quests/locations/world-events/travel simulation,
> achievements, the odds-based "adventure" loop, theme synergies/team-tactics/
> mythic-amplifications.
>
> **Other deltas:** all gameplay AI → `claude-opus-4-8`; **login removed**
> (no-op `server/middleware/auth.js` resolves one local user); DM marker set was
> trimmed to 6 live markers, then v2.1.0 added the mechanical-spine markers
> (`HP_CHANGE`, `EFFECT_START`/`EFFECT_END`, `TURN`, `ROLL_REQUEST`, `SCENE`) handled
> by `gameStateMarkerService.js`; `npm`/`npx` bin shims break on this folder's `&` in
> the path — invoke binaries via `node node_modules/<pkg>/bin/...` (e.g.
> `node node_modules/vite/bin/vite.js build` from `client/`).

## Project Overview
D&D Meta Game: AI-powered solo D&D 5e campaign management system (MVP — see banner above).
- **Frontend**: React 18 + Vite (SPA at `client/`)
- **Backend**: Node.js + Express (ES modules at `server/`)
- **Database**: SQLite via `@libsql/client` (local `file:local.db` or Turso cloud)
- **AI**: Claude **Opus 4.8** (`claude-opus-4-8`) for all gameplay; Sonnet (`claude-sonnet-4-6`) for session-recap extraction. (Ollama fallback retained but dormant.)

## Development Commands
- `npm run dev` — Start both server (port 3000) and client (port 5173). NOTE: the
  server needs **port 3000 free** — if another local app is using it, stop that
  app or change `PORT` (server) + the `proxy.target` in `client/vite.config.js`.
- `npm run server` — Server only with `--watch`
- `npm run client` — Vite dev server only
- `npm run build` — Production client build (or `node node_modules/vite/bin/vite.js build` from `client/` if the npm shim trips on the `&` path)
- `npm run install-all` — Install root + client dependencies
- Tests: `node tests/<testfile>.test.js` (no framework; cut-system tests are in `/archive/tests/`)

## Architecture

### Stack & conventions
- All JS is ES modules (`import`/`export`, `"type": "module"` in package.json). No TypeScript.
- React functional components with hooks. No CSS framework — inline styles throughout.
- SQLite queries use parameterized `?` placeholders. JSON is stored in TEXT columns for flexible fields (inventory, ability_scores, etc.).
- API routes follow REST: `/api/<resource>/...`.
- Migrations are numbered (`server/migrations/NNN_*.js`) and run in order via `server/migrationRunner.js`. Migrations are additive after ~011; early ones drop/recreate tables.

### AI model discipline
- Model aliases (no date suffix): `claude-opus-4-7`, `claude-sonnet-4-6` — major.minor is pinned; bump manually when a new Claude version ships.
- **Opus is the default for all live gameplay** — Player Mode DM sessions (since v1.0.99), Prelude sessions (since v1.0.141), plus all generation work (campaign plans, backstory, NPCs, quests, locations, companions, adventures, living world, prelude arc plans). PM ruling 2026-05-03: prose quality + narrative continuity outweigh latency for interactive turns.
- **Sonnet's role narrowed** — chronicle extraction (player-mode and DM-mode session recaps) and DM Mode interactive sessions still use Sonnet. Sonnet stays as an explicit opt-down for prelude/DM sessions via stored `model_preference='sonnet'` (no UI surface as of v1.0.141; legacy session state honors it).
- The prelude auto-picker (`preludeSessionService.js::pickAutoModel`) is soft-deprecated as of v1.0.141 — retained as dead code per "deprecate by hiding, not deleting." Reachable only via legacy `model_preference='auto'` session state.
- Structured JSON from LLMs goes through `server/utils/llmJson.js` — `extractLLMJson()` / `tryExtractLLMJson()`. Don't write new ad-hoc parsers; Opus occasionally emits multi-block responses that naive extractors splice into invalid JSON.

### Prompt structure
- DM prompt uses **primacy/recency reinforcement**: critical rules at the top (CARDINAL RULES) and a slim recency anchor at the bottom (BEFORE YOU SEND). As of v2.4.0 the bottom is a **1–2 item gut-check** (player sovereignty + the conditional content-boundary check), NOT a full restatement of the top — the prior redundant 5–6 item self-check doubled rule salience and crowded out the live thread. Keep the two anchors load-bearing; don't re-bloat the recency block.
- **Render only what currently exists** (v2.4.0): the MEMORY HIERARCHY, the "past sessions are canonical" paragraph, and the quest-weaving paragraph are gated on real stored memory — a fresh campaign instead gets a one-line directive making the live transcript authoritative (ranking the recent transcript below an empty canon ledger was the main early-session "forgetting" cause). Mechanical per-turn state (active conditions/effects) goes in the **system-prompt tail** (sent, strip-before-persist), never as user-role turns in the transcript. `formatCampaignPlan`'s CONTENT BOUNDARIES block is the gating template.
- DM Mode prompt uses a 3-point reinforcement (ABSOLUTE RULES → character sheets + dynamics → FINAL REMINDER).
- Prompt caching via `claude.js` has three tiers (cache-break markers embedded in the prompt string): universal-static, per-character static, dynamic. Only prefixes **≥4096 tokens** cache on Opus 4.x (`CACHE_MIN_TOKENS`); shorter tiers are merged (1024 is the Sonnet floor and silently won't cache on Opus).

### DM session markers + marker pipeline
Markers the DM AI emits during Player Mode sessions:
`[COMBAT_START]` `[COMBAT_END]` `[LOOT_DROP]` `[MERCHANT_SHOP]` `[MERCHANT_REFER]` `[ADD_ITEM]` `[MERCHANT_COMMISSION]` `[FORTRESS_THREAT]` `[BASE_DEFENSE_RESULT]` `[WEATHER_CHANGE]` `[SHELTER_FOUND]` `[SWIM]` `[EAT]` `[DRINK]` `[FORAGE]` `[RECIPE_FOUND]` `[MATERIAL_FOUND]` `[CRAFT_PROGRESS]` `[RECIPE_GIFT]` `[MYTHIC_TRIAL]` `[PIETY_CHANGE]` `[ITEM_AWAKEN]` `[MYTHIC_SURGE]` `[PROMISE_MADE]` `[PROMISE_FULFILLED]` `[NOTORIETY_GAIN]` `[NOTORIETY_LOSS]` `[CONDITION_ADD]` `[CONDITION_REMOVE]` `[BOND_SHIFT]` (DM Mode) `[NPC_WANTS_TO_JOIN]`.

Prelude sessions have their own marker set (19 markers — see prelude section below).

**Marker pipeline (canonical path post-Phase-3.2):** `markerSchemas.js` (schema definitions) + `markerPipeline.js` (dispatch) own marker validation + side-effect dispatch. Every marker in `MARKER_SCHEMAS` flows through `validateDmMarkers` (schema validation + correction-loop feedback) and `processResponseMarkers` (handler dispatch to consumer services). Schemas double as future tool-use definitions — no rewrite needed when that migration lands.

Handlers register via `registerHandler(schemaKey, fn)` at module-load time, co-located with the consumer service that owns the side effect: `pietyService` (PIETY_CHANGE), `dmModeBondShiftService` (BOND_SHIFT), `survivalService` (SHELTER_FOUND/EAT/DRINK/FORAGE), `weatherService` (WEATHER_CHANGE), `craftingService` (CRAFT_PROGRESS/RECIPE_FOUND/MATERIAL_FOUND/RECIPE_GIFT), `merchantService` (MERCHANT_SHOP/MERCHANT_REFER), `merchantOrderService` (MERCHANT_COMMISSION), `lootDropService` (LOOT_DROP), `consequenceService` (PROMISE_MADE/PROMISE_FULFILLED), `notorietyService` (NOTORIETY_GAIN/NOTORIETY_LOSS), `mythicService` (MYTHIC_TRIAL/ITEM_AWAKEN/MYTHIC_SURGE), `baseThreatService` (FORTRESS_THREAT/BASE_DEFENSE_RESULT), `combatMarkerService` (COMBAT_START/COMBAT_END), `gameStateMarkerService` (HP_CHANGE/EFFECT_START/EFFECT_END/TURN/ROLL_REQUEST — the v2.1.0 mechanical spine). When a handler doesn't naturally co-locate with an existing service, the precedent is a single-purpose marker-handler module (`lootDropService.js`, `combatMarkerService.js`, `gameStateMarkerService.js`).

**Mechanical-spine markers (v2.1.0):** `gameStateMarkerService.js` persists narrated mechanics so the cockpit + DM stop guessing. `[HP_CHANGE]` writes `characters.current_hp` (clamped); `[EFFECT_START]`/`[EFFECT_END]` maintain `session_config.activeEffects` with the 5e single-concentration rule (injected back into the prompt); `[TURN]` updates `session_config.combat`; `[ROLL_REQUEST]` returns the player's preloaded modifier for a one-click in-UI roll. `[CONDITION_ADD/REMOVE]` now persist to `characters.debuffs` and `[SCENE]` to `session_config.lastScene` — both handled at the route call site (they reuse the existing in-route detector/parser), not in the service. The `routes/dmSession.js` `/message` handler surfaces `hpChange`/`conditions`/`activeEffects`/`turn`/`rollRequest` on the turn response for the cockpit.

**Fortress threat origination is marker-driven** (Phase 3.7 SC-3.7.1): the AI DM emits `[FORTRESS_THREAT]` when narrative context warrants a threat against a player-owned base; the handler in `baseThreatService.js` validates ownership/active-status, enforces the single-active-threat-per-base invariant, and creates the `base_threats` row. Source/Category fields fall back handler-side to `RAID_CAPABLE_EVENTS[EventType]` lookups when omitted on the marker. The legacy world-event-tick path (`generateThreatsForCampaign` reading raid-capable `event_type` rows from `world_events`) is **deprecated** and unused in production — kept in place per Phase 3.7 §1.2 (removing it would touch the living-world tick architecture).

**Schemas-without-handlers** is a first-class end-state — schema validation provides correction-loop feedback even without handler dispatch. Four legitimate rationales (DECISION_LOG 2026-05-05 SC-6.4 close-out, intentional design):
1. **Ordering invariants** — sibling markers require a strict run order the pipeline can't guarantee (19 prelude markers — `AGE_ADVANCE → HP_CHANGE`, `CANON_FACT_RETIRE → CANON_FACT`)
2. **Aggregated returns** — route handler combines per-marker results into one structured response payload (also the prelude markers)
3. **No side-effect target** — marker has no consumer service to wire (`SWIM`)
4. **Orchestrated-with-sibling-marker** — coupled markers fold into one handler internally rather than dispatching independently (`ADD_ITEM` consumed by MERCHANT_SHOP handler via `context.narrative` extension)

The legacy `detectXxx()` functions in `dmSessionService.js` remain exported per "deprecate by hiding nav" but are no longer invoked from the production route. `processResponseMarkers` is the canonical dispatch path. `dmSessionService.js`'s remaining live exports are utility helpers (`parseMarkerPairs`, `parseMarkerKeyValue`, `estimateEnemyDexMod`) and the still-active `detectDowntime` (player-input classifier, not a marker detector — PARK ENTIRELY per Q6 survey + PM ruling 2026-05-05) + `detectRecruitment` (free-text fallback for unstructured AI prose).

Malformed marker emissions get correction-loop feedback via `session_config.pendingMarkerCorrections` (player-mode) or the same key on prelude sessions — invisible `[SYSTEM]` note injected on next turn telling the AI which fields failed validation.

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
- **Base threats** (raids/sieges): `base_threats` table, status state machine (approaching → defending/resolving → resolved), outcome enum (repelled/damaged/captured/abandoned). Threat origination is **marker-driven** post-Phase-3.7 — AI DM emits `[FORTRESS_THREAT]`, `baseThreatService` handler creates the row (deprecated world-event path retained but unused; see marker-pipeline section above). Auto-resolve or player-led defense via `[BASE_DEFENSE_RESULT]` marker.
- **Damage application is mechanical regardless of resolution path** (Phase 3.7 SC-3.7.2): both auto-resolve (`autoResolveThreat`) and player-led defense (`recordPlayerDefenseOutcome`) mutate buildings/treasury/garrison columns per `computeDamageFromOutcome`. Player-led `damaged` defaults to **mild sub-tier** (margin treated as 0); a future severity field on `[BASE_DEFENSE_RESULT]` may override.
- **Recapture window exists but no recapture path** — 14-day window opens on capture (`RECAPTURE_WINDOW_DAYS`, `BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER`), but no player-side codepath uses it; window expires → permanently abandoned. Tracked in [`KNOWN_BUGS.md`](KNOWN_BUGS.md); the recapture quest framework belongs to the future fortress system design phase (Phase 5 candidate).
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

**Setup**: 6-step wizard `PreludeCreatorV2.jsx` (live as of v1.0.143) — Identity / Ancestry / Origin / Family / Appearance / Review. Save-on-step-advance via the new `'prelude_setup'` `creation_phase` value (draft endpoints `POST/PUT/GET /api/prelude/setup/draft`). Final submit POSTs to `/api/prelude/setup` with `draft_character_id`, which RECYCLES the draft row (UPDATE in place, flips phase `prelude_setup → prelude`). Starting age is race-derived server-side (humans 6, elves 30, dwarves 18, warforged 1, etc.). Appearance fields collected: eye / hair / skin / build (height + weight intentionally cut — prelude character is a child across most of the arc; adult-range dimensions would mislead the narrator). Legacy one-page wizard (`PreludeSetupWizard.jsx`) retained but unwired per "deprecate by hiding nav, not deleting code"; safe to delete after 2-3 playtest cycles.

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

**Tables**: `prelude_emergences`, `prelude_values`, `prelude_canon_facts`, `prelude_canon_npcs`, `prelude_canon_locations`, `prelude_canon_threads`, `prelude_canon_heirlooms` (chunk 5 — consumer-side ready, producer deferred), `campaign_threads`, `prelude_arc_plans`, `character_biography`, `mentor_imprints`. Character columns: `creation_phase` ('active' | 'creating' | 'ready_for_primary' — 'creating' added in chunk 5 for manual-mode mid-flow saves; 'prelude' was dropped in Phase 0), `prelude_age`, `prelude_chapter`, `prelude_setup_data`, `prelude_committed_theme`, `prelude_handoff_payload`.

**Handoff transition (Phase 2 chunk 2)**: `[PRELUDE_END]` triggers `executeTransition()` in `preludeTransitionService.js` — flips `creation_phase` to `'ready_for_primary'`, generates the appendable biography seed (Opus call → `character_biography` rows with `entry_type='seeded_from_prelude'`), seeds `mentor_imprints` when `authority_figure='mentor'` AND a `[NPC_CANON: relationship='mentor']` row exists, and persists the rich pre-fill blob on `characters.prelude_handoff_payload`. The home page renders `'ready_for_primary'` characters with a "Finish creating" badge → click into `PreludeTransitionScreen` → "Begin character creation" launches the existing `CharacterCreationWizard` with `preludePayload` prop. The wizard PUTs to `/api/character/{id}` with `creation_phase='active'` on submit (no duplicate row; FK references preserved). Theme + ancestry feat are NOT pre-filled in the existing creator's flow — chunk 5's rebuilt creator handles those with the locked-with-celebration affordance.

**Pre-fill payload contract (Phase 2 chunk 5.B, schema_version=2)**: `buildHandoffPayload()` emits the §8.2.1 flat shape — top-level `setup_name / name / gender / race / subrace / committed_theme / theme_chapter_beats / ancestry_feat_id / ancestry_chapter_beats / class_suggestion / accepted_stat_bumps / accepted_skill_bumps / heirloom_candidates / biography_seed / canon_npcs / canon_locations / canon_threads / mentor_imprint_eligible`, plus helper fields chunk 5 needs (`class_score, ancestry_score, departure_summary, home_region, home_setting, authority_figure, authority_label, mentor_imprint_id, canon_fact_count, name_parts`). Old `locked{}/suggested{}/canon{}/biography{}` wrappers (schema_version=1) no longer emitted — chunk 5 replaces the existing creator anyway, so no backwards-compat shim. `[USE_NAME]` marker referenced in spec §8.2.1 not yet implemented; effective `name` falls back to character first/last.

**Chunk 5 content data files** (`client/src/data/`): `themeGoldModifiers.js`, `themePersonalityPrompts.js`, `themeIdealsPrompts.js`, `themeBondsPrompts.js`, `themeFlawsPrompts.js`, `themeBackstoryMoments.js`, `themeNarrativeContinuity.js` — 637 PM-authored entries transcribed verbatim from spec §7 + §5.4.5. Prompt files (personality / ideals / bonds / flaws) are `{ themeId: [{ text, alignment }] }` with always-visible 9-square alignment indicators (Decision 3). Backstory moments are `{ themeId: [string] }` — bare strings, no alignment per Decision 4 (events ≠ commitments). Narrative-continuity is `{ themeId: string }` (19 entries — Knight + Haunted One excluded per Decision D). Bracketed placeholders in prompt/moment text (e.g. `[the village that raised you]`) are intentional player-fill-in invitations.

**Chunk 5 main creator (LIVE as of v1.0.114; Phase 2 closed)** — `client/src/components/creator/` houses the rebuilt 8-step creator + new home flow. **The new flow is the live path**: when no character is selected, App.jsx renders `<HomeFlow>` (HomeScreenV2 → PathChoiceScreen → CharacterCreatorV2). When a character is selected, the existing dashboard chrome renders with a "← Your characters" button at the top to return to HomeFlow. Components: `CharacterCreatorV2.jsx` (shell — scroll-to-top, Submit branching, save-before-advance with `persistProgress` prop, `initialState` + `initialCharacterId` for resume), `creatorPrimitives.jsx` (Field/Stepper/WizardHead/WizardFoot/Eyebrow), `CelebrationCard.jsx` (handoff-mode primitive shared by Steps 2/3), `BumpCelebrationCard.jsx` (Step 5's count-aware variant), `AlignmentChip.jsx` (9-square chip + ALIGNMENT_DESCRIPTIONS for Step 7), `ExpansionSection.jsx` (collapsible w/ chevron — closed-by-default in BOTH modes per PM review feedback, see spec §5.7.3 annotation), `PromptList.jsx` (Model A click-to-fill), `MomentList.jsx` (Model B multi-select chips), `RaceAwareDimensionPicker.jsx` (PHB-derived demographics dropdowns + Custom override + dual-unit display), `equipmentResolver.js` (equipment.json lookup + filter `(if proficient)` + pack contents), `creatorPersistence.js` (`submitCreator` for final commit; `saveProgress` for partial saves on step advance; `rehydrateManualCreatorState` + `rehydrateHandoffCreatorState` for resume), `Step1Identity.jsx`, `Step2Ancestry.jsx`, `Step3Theme.jsx`, `Step4ClassCalling.jsx`, `Step5AbilityScores.jsx`, `Step6Equipment.jsx`, `Step7IdentityDetails.jsx`, `Step8Review.jsx`, `HomeScreenV2.jsx` (single-section "Your Characters" grid w/ Diablo-4 Create entry + 3 card states), `PathChoiceScreen.jsx` (Screen 2 — Prelude/Campaign two-card layout), `HomeFlow.jsx` (live wrapper — fetches /api/character, routes home → path → wizard, hands active-character clicks back to App.jsx via `onSelectActive`). Editorial aesthetic: EB Garamond + Inter + JetBrains Mono via Google Fonts in `client/index.html`; design tokens + structural classes in `client/src/styles/creator-theme.css`, all scoped under `.creator-v2`. Per Decision 6: editorial-only, no aesthetic toggle.

**Chunk 5 server-side** (live as of v1.0.114): `server/routes/character.js` POST accepts `creation_phase` (defaults `'active'` for backwards compat); PUT detects `'ready_for_primary' → 'active'` transition and runs (a) `applyHeirloomChoiceOnSubmit()` to flip chosen candidate → `'carried_forward'` and others → `'left_behind'`, (b) `transferCanonToCampaign()` from `server/services/campaignCanonTransferService.js` to copy `prelude_canon_npcs / locations / threads` into `npcs / locations / campaign_threads` with idempotent prelude-source markers (campaign_id NULL until campaign assignment lands; parking-lot entry). Migration 050 added `physical_build` column for Step 7's "build" field; PUT allowlist accepts it.

**Deprecated (per CLAUDE.md "deprecate by hiding nav, not deleting code")**: `client/src/components/CharacterCreationWizard.jsx` and `client/src/components/CharacterManager.jsx` are retained but unwired from the live path. CharacterManager only renders when `showCreationForm` is true (CharacterSheet's "Edit in Wizard" affordance — until the new creator grows an edit-existing surface, parking-lot entry).

**Chunk 5 server-side**: `server/routes/character.js` POST accepts `creation_phase` (defaults `'active'` for backwards compat); PUT detects `'ready_for_primary' → 'active'` transition and runs `applyHeirloomChoiceOnSubmit()` to flip chosen candidate → `'carried_forward'` and others → `'left_behind'`. Canon transfer to campaign tables (npcs/locations/campaign_threads) deferred to checkpoint 3.

**Chunk 5 race demographics**: `client/src/data/raceDemographics.js` carries PHB-derived age/height/weight ranges per race id. Step 7's age/height/weight fields are race-aware dropdowns via `RaceAwareDimensionPicker.jsx` — dual-unit labels (`5'10" (178 cm)` / `165 lb (75 kg)`); a "Custom…" affordance opens a free-text input per Player-First principle (CLAUDE.md). Falls back to plain text input when race not yet picked.

**Chunk 5 alignment coverage tooling**: `tests/coverage-matrix.js` reads ideals/bonds/flaws prompt files and writes `triage/alignment-coverage-matrix.md` — visibility input for PM's targeted gap-fill content authoring (current coverage 241/567 cells = 43%). Personality skipped per spec (intentional skew).

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
- `server/services/dmSessionService.js` — Session logic + legacy detect-functions (no longer invoked from production route per Phase 3.2 SC-6.4 close-out; kept exported for back-compat)
- `server/services/markerSchemas.js` — Marker schema definitions + validation (canonical dispatch surface, post Phase 3.2)
- `server/services/markerPipeline.js` — `processResponseMarkers` dispatch + `registerHandler` API
- `server/services/combatMarkerService.js` — COMBAT_START + COMBAT_END handlers (initiative orchestration)
- `server/services/gameStateMarkerService.js` — v2.1.0 mechanical-spine handlers (HP_CHANGE, EFFECT_START/END, TURN, ROLL_REQUEST)
- `server/services/lootDropService.js` — LOOT_DROP handler (character-inventory mutation for AI-driven drops)
- `server/routes/dmSession.js` — DM session routes (main API surface)
- `server/routes/dmMode.js` — DM Mode routes
- `server/routes/prelude.js` — Prelude routes
- `server/services/preludeSessionService.js` — Prelude session lifecycle
- `server/services/preludeMarkerDetection.js` — Prelude-specific marker parsing (consumer-side dispatch per SC-6.3 schemas-without-handlers parking — see DECISION_LOG)
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
- `server/services/campaignDraftService.js` — Begin-Campaign atelier (v2.2.0; v2.3.0 design refresh; v2.5.0 two modes): Opus drafts/refines a campaign from a prompt + dials; commit creates the campaign + plan + links the character and persists the table's content boundaries (lines & veils, three-state open/veil/line) onto the plan as `lines_and_veils` (`POST /api/campaign/draft` + `/begin`). **v2.5.0 modes:** *Collaborative* — `converseCampaign()` + `POST /api/campaign/converse` (uses `CONVERSE_SYSTEM_PROMPT`) talks the campaign through and never drafts; the client passes the running conversation each turn, and `draftCampaign({ conversation })` authors the draft from that transcript when the player is ready. **v2.6.0** made converse return **structured `{reply, why, readyToDraft}`** (parsed via `extractLLMJson`, raw-text fallback) and accept `questionNumber` — driving a finite ~6–10-question budget, a per-question "why", a visible "Question N of ~8" counter, an offer-to-draft-early `readyToDraft` cue, no praise-padding, and honoring what the player asks to leave open (prompt synthesized via a judge-panel). Don't revert converse to plain-text — the client renders the `why` sub-line + counter off the JSON. *Quick start* — `draftCampaign` with `seed:'surprise'` + dials, no prompt. Subject resolution is shared via `resolveSubject()`. The whole atelier design reaches the live DM: `getPlanSummaryForSession` (campaignPlanService) carries the atelier fields through (premise/opening_scene/region/setting/hidden_truth/scope/locations/tone/lines_and_veils, `from_atelier` flag), and `dmPromptBuilder.formatCampaignPlan` renders them — including a **non-negotiable CONTENT BOUNDARIES block** (primacy) reinforced by a conditional 6th BEFORE-YOU-SEND self-check item (recency). Canonical/imported plans are unaffected (atelier sections render only when present).
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
- `client/src/components/BeginCampaign.jsx` — conversational "Begin a new Campaign" atelier (v2.2.0; v2.3.0 design refresh; v2.5.0 two modes): four `mode`s — `greet` (entry: prompt box + character-grounded seeds), `converse` (v2.5.0 collaborative open conversation — Opus asks questions in the thread; "Draft it from our conversation" authors the draft), `quickstart` (v2.5.0 "Surprise me" dedicated screen — only length + genre/tone + lines & veils, then Opus conjures a draft from those dials), and `compose` (the living draft: dialogue thread + premise/scene preview + rail dials + cinematic begin). "Build it together" → `converse`; "Surprise me" → `quickstart`; both land in `compose`. Reached from CampaignsPage, wired to campaignDraftService (`/draft`, `/converse`, `/begin`).
- `client/src/components/DMMode.jsx` — DM Mode UI
- `client/src/components/CharacterCreationWizard.jsx` — 4-step wizard (~4300 lines)
- `client/src/components/CharacterSheet.jsx` — Character view/edit (~3600 lines)
- `client/src/components/creator/PreludeCreatorV2.jsx` (+ `PreludeStep1Identity` through `PreludeStep6Review`, `preludePersistence.js`), `client/src/components/PreludeArcPreview.jsx`, `PreludeSession.jsx`. Legacy `PreludeSetupWizard.jsx` retained-but-unwired.
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
- Don't modify the primacy/recency prompt structure without understanding the pattern — and don't re-bloat the recency "BEFORE YOU SEND" block back into a full rule restatement (it's intentionally a 1–2 item gut-check as of v2.4.0; see Prompt structure).
- Don't write new ad-hoc JSON extractors — use `server/utils/llmJson.js`.
- Don't create new documentation files unless asked.
- Don't forget to update CHANGELOG, CLAUDE.md, and package.json versions together at each phase boundary.
