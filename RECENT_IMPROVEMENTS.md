# Recent Improvements

## Latest: Bundle Size Optimization (2026-02-07)

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
