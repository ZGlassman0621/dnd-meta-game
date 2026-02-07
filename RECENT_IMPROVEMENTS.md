# Recent Improvements

## Latest: Streamlined Gameplay Experience (2026-02-07)

Major UX overhaul to reduce the number of manual steps from character creation to playing.

### Streamlined Campaign Creation Pipeline
**Problem**: Creating a campaign required 4+ manual steps: create campaign, assign character, navigate to backstory parser, navigate to campaign plan page, generate plan.

**Solution**: Campaign creation now runs an automatic pipeline:
1. Creates the campaign
2. Assigns the current character
3. Parses backstory (if exists and not already parsed)
4. Generates the full campaign plan via Opus 4.5

A progress UI shows each step with checkmarks, and a "Play Now" button appears on completion.

**Files Changed**:
- `client/src/components/CampaignsPage.jsx` — Pipeline logic, progress UI, Play Now button

### Starting Location Dropdown
**Problem**: Starting location was a free-text input. Players had to know/type Forgotten Realms locations.

**Solution**: Replaced with a grouped `<select>` dropdown using `STARTING_LOCATIONS` from `forgottenRealms.js`:
- **Major Cities**: Waterdeep, Baldur's Gate, Neverwinter, Luskan, Silverymoon, Mithral Hall, Candlekeep, Menzoberranzan, Calimport, Athkatla
- **Regions**: Icewind Dale, Sword Coast Wilderness, Anauroch, Cormanthor, Chult
- **Custom Location**: Text input fallback for homebrew settings

Auto-detects starting location from parsed backstory (hometown/birthplace/current).

**Files Changed**:
- `client/src/components/CampaignsPage.jsx` — Dropdown, backstory auto-select

### Play Button on Home Screen
**Problem**: No quick way to jump into an active campaign from the home screen.

**Solution**: A prominent purple-gradient "Play" button appears on the home screen when the selected character has a campaign plan ready. One click to start playing.

**Files Changed**:
- `client/src/App.jsx` — Campaign plan readiness check, Play button

### Gameplay Tabs (Adventure / Downtime / Stats)
**Problem**: Downtime and Campaign Stats were on separate pages, disconnected from active gameplay.

**Solution**: During active DM sessions, a tab bar appears with three tabs:
- **Adventure** — The main gameplay (messages + input)
- **Downtime** — Embedded Downtime component for rest/work activities
- **Stats** — Embedded MetaGameDashboard for campaign statistics

Players can switch between tabs without leaving their session.

**Files Changed**:
- `client/src/components/DMSession.jsx` — Tab state, tab bar, conditional content rendering

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
