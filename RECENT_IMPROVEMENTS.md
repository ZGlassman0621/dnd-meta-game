# Recent Improvements

## Latest: Auto-Apply Inventory Changes (2026-02-08)

Inventory changes (items consumed, gained, gold spent) detected by the AI at session end are now **auto-applied** instead of requiring a manual "Apply Changes" click. An "Undo" button appears after auto-apply to revert if the AI got it wrong.

- Auto-apply runs immediately after session end analysis completes
- Pre-apply inventory/gold snapshot saved for undo
- Undo restores via `PUT /api/character/:id` (existing endpoint, no new server code)
- Fallback: if auto-apply fails, manual "Apply Changes" button still appears

**Files Modified**:
- `client/src/components/DMSession.jsx` — Auto-apply in `endSession()`, `undoInventoryChanges()`, undo UI

---

## World State Snapshot for DM Sessions (2026-02-08)

The AI DM now has awareness of the current dynamic world state when starting a session. Previously, the DM only saw the static campaign plan and accumulated campaign notes — faction standings, world events, NPC relationships, and discovered locations were invisible to the AI.

### How It Works
At session start, 5 parallel service queries gather the living world state:
- **Faction standings** — character's reputation with each faction (skip neutrals unless member, 6 max)
- **Active world events** — events in progress with current stage descriptions (5 max)
- **NPC relationships** — disposition, trust, pending promises, outstanding debts, known secrets (8 max)
- **Known faction goals** — faction activities the character has discovered (4 max)
- **Discovered locations** — places the character has visited/explored (8 max)

This data is compressed into a `=== CURRENT WORLD STATE ===` section in the system prompt (~250-500 tokens), placed between the campaign plan and story threads. The AI is instructed to weave this organically into narrative and dialogue — not info-dump it.

### Graceful Degradation
- Wrapped in try/catch — if any queries fail, the session starts normally without world state
- Only runs when the character has a campaign (`character.campaign_id`)
- Empty world state produces no prompt section (empty string)

**Files Modified**:
- `server/services/dmPromptBuilder.js` — Added `formatWorldStateSnapshot()`, `getStandingBehavior()`, `getTrustLabel()`
- `server/routes/dmSession.js` — Added 5 service imports, Promise.all data gathering in POST /start, `worldState` in sessionConfig

---

## Architecture Refactor & Living World Enhancements (2026-02-07)

Major backend refactoring and living world behavior improvements.

### Module Splitting
Split `ollama.js` (1715 lines) into 3 focused modules:
- **`llmClient.js`** (~90 lines) — Raw Ollama API client (chat, status, models)
- **`dmPromptBuilder.js`** (~1300 lines) — DM system prompt construction and all formatters
- **`ollama.js`** (~300 lines) — Session orchestration only (start/continue/summarize)
- Backward-compatible re-exports so no consumer files needed import changes

Split `dmSession.js` route (2362 lines) into route + service:
- **`dmSessionService.js`** (~500 lines) — Business logic (analysis, rewards, NPC extraction, notes, event emission)
- **`dmSession.js`** (~1700 lines) — Thin route handlers that delegate to service

### DM Session Event Bus Integration
DM sessions now emit gameplay events at session end, connecting freeform AI gameplay to the structured quest/companion systems:
- `NPC_INTERACTION` — For each NPC extracted from the session transcript
- `LOCATION_VISITED` — For locations found in extracted campaign notes
- `ITEM_OBTAINED` — For items gained per inventory analysis
- `DM_SESSION_ENDED` — Triggers companion backstory thread activation checks

### Living World Emergent Behavior
Faction tick processing enhanced from deterministic progress bars to emergent behavior:
- **Faction interference**: Hostile factions slow each other; allied factions boost each other
- **Wider variance**: Progress varies 0.5x-1.5x per tick (was 0.8x-1.2x)
- **Random disruptions**: 8% chance/day of setbacks (lose 10-30% progress)
- **Random breakthroughs**: 5% chance/day of bonus progress (50-100% extra)
- **Rival reactions**: At 50%+ milestones, hostile factions have 40% chance of spawning counter-events
- **Power shifts**: Completing major/catastrophic goals increases faction power level

**Files Created**:
- `server/services/llmClient.js`, `server/services/dmPromptBuilder.js`, `server/services/dmSessionService.js`

**Files Modified**:
- `server/services/ollama.js`, `server/routes/dmSession.js`, `server/services/factionService.js`, `server/services/livingWorldService.js`

---

## Bundle Size Optimization (2026-02-07)

Lazy-loaded 13 components with `React.lazy()` + `Suspense` to reduce the initial bundle.

**Before:** 1,321 kB (320 kB gzipped) — all pages loaded upfront
**After:** 971 kB (244 kB gzipped) — hidden/heavy pages loaded on demand

- **DMSession** (101 kB) and **CampaignPlanPage** (27 kB) lazy-loaded behind routes
- **11 hidden pages** (222 kB combined) lazy-loaded — only fetched if navigated to
- `Suspense` fallback shows loading state while chunks download

**Files Changed**:
- `client/src/App.jsx` — Converted 13 imports to `React.lazy()`, added `Suspense` boundary

---

## Home Page Navigation Hub (2026-02-07)

Redesigned the home page from a cluttered dashboard into a clean navigation hub.

### Home Page as Navigation Hub
**Problem**: The home page was crowded with adventure generation, adventure history, and meta game components. Navigation required hunting through dropdown menus.

**Solution**: Home page is now a clean hub with:
- **Green Play button** right at the top — one click to jump into your campaign
- **Character selector** for switching characters
- **8 navigation cards** in a responsive grid, each with a color accent and description explaining what the feature does

**Files Changed**:
- `client/src/App.jsx` — Home page redesign, green Play button, navigation cards

### Downtime & Stats Combined Page
**Problem**: Adventure generation, adventure history, and meta game stats were separate from downtime activities.

**Solution**: New combined "Downtime & Stats" page brings together all between-session activities:
- Downtime activities (left) + Adventure system (right)
- MetaGameDashboard (full width)
- Adventure History (full width)

**Files Changed**:
- `client/src/App.jsx` — Combined Downtime & Stats view

### Trimmed Navigation
**Problem**: Dropdown menus had 14 items across 4 categories, many redundant with the streamlined flow.

**Solution**: Navigation reduced to 3 menus with 8 items total:
- **Character**: Character Sheet, Companions, Backstory Parser, Downtime & Stats, Settings
- **Story**: Campaigns, Campaign Plan
- **Play**: AI Dungeon Master

**Files Changed**:
- `client/src/components/NavigationMenu.jsx` — Removed World menu, trimmed all categories

---

## Streamlined Gameplay Experience (2026-02-07)

Major UX overhaul to reduce the number of manual steps from character creation to playing.

### Streamlined Campaign Creation Pipeline
Campaign creation now runs an automatic pipeline: create campaign → assign character → parse backstory → generate campaign plan. A progress UI shows each step, and a "Play Now" button appears on completion.

### Starting Location Dropdown
Starting location is now a grouped dropdown with 15 Forgotten Realms locations (Major Cities + Regions) plus a custom option. Auto-detects from parsed backstory.

### Gameplay Tabs (Adventure / Downtime / Stats)
During active DM sessions, a tab bar provides Adventure, Downtime, and Stats tabs. Players can switch between tabs without leaving their session.

---

## Previous: Campaign Plan & DM Session Improvements (2026-02-07)

### Campaign Plan Generation
- Opus 4.5 generates comprehensive living world plans with NPCs, factions, locations, timeline, quest arcs, side quests, and DM notes
- Campaign description is prioritized over backstory as the #1 rule for plan generation
- Progress bar with animated steps during generation

### Spoiler System
- Reddit-style spoiler covers hide DM-sensitive content in the campaign plan viewer
- NPC roles, faction allegiances, and secrets are hidden by default
- Click to reveal individual spoilers

### DM Session Streamlining
- Setup form gated when campaign plan exists (shows only Content Preferences + Begin Adventure)
- NPC selection hidden when campaign plan exists (plan NPCs are used automatically)
- Campaign Plan Loaded banner shows quest title in session setup

### Navigation Cleanup
- Reorganized nav: Character (Sheet, Companions, Backstory Parser, Downtime, Settings), World (NPC Generator, NPC Relationships), Story (Campaigns, Campaign Plan, Quests, Companion Backstories), Play (AI DM, Stats, Generate)
- Hidden redundant pages covered by Campaign Plan (Locations, Factions, Travel, World Events, Living World, Narrative Queue)

### Backstory Parser
- AI parses freeform backstories into structured elements: characters, locations, factions, events, story hooks
- Player can edit/add/remove parsed elements; re-parse preserves manual edits
- Parsed backstory feeds into campaign plan generation

---

## Earlier Improvements

### Loading Indicators
- Themed loading indicator during adventure generation
- Shows contextual messages while AI generates content

### Gold Validation
- Gold can no longer go negative from failure consequences
- `Math.max(0, ...)` floor on all gold calculations

### HP Regeneration System
- Passive healing (10-25% of missing HP) on successful adventures
- Active healing via Rest button (50% of missing HP)
- Critical HP indicator when health is low

### Pronoun System
- Rest narratives use character's actual gender pronouns (he/she/they)

### Calendar Controls
- Manual +/- buttons for date advancement during sessions
- Long rest automatically advances calendar by 1 day
