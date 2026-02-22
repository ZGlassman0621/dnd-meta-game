# Future Features & Enhancements

This file tracks feature ideas and enhancements for future implementation.

---

## Database Migration System

**Priority:** Medium
**Identified:** 2026-02-07

### Problem
`server/database.js` is 1309 lines of `CREATE TABLE IF NOT EXISTS` statements with conditional `ALTER TABLE` additions scattered throughout. Every schema change requires adding another conditional alter that runs on every startup.

### Planned Implementation
- Replace monolithic `database.js` with numbered migration files (e.g., `001_initial_schema.js`, `002_add_campaign_notes.js`)
- Track applied migrations in a `_migrations` table
- Each migration runs once, is idempotent, and includes both `up()` and `down()` functions
- Startup checks which migrations have run and applies any new ones in order

---

## Faction-Driven Quest Generation

**Priority:** Medium
**Identified:** 2026-02-09

### Problem
Factions have goals with progress tracking, but quests are generated independently. When a faction reaches a milestone or two factions come into conflict, there's no automatic quest generation to make those world events playable.

### Desired Behavior
- When faction goals hit key thresholds (25%, 50%, 75%, 100%), auto-generate related quests
- Faction conflicts spawn quests with player choices
- Player's faction standing affects quest availability and rewards
- Completing faction quests shifts standings and affects faction goal progress

### Files to Modify
- `server/services/livingWorldService.js` — Add quest generation triggers to tick processing
- `server/services/questGenerator.js` — Add faction-aware quest generation prompts
- `server/services/questService.js` — Link quest completion to faction standings

---

## Achievement System with Rewards

**Priority:** Medium
**Identified:** 2026-02-09

### Problem
No way to track memorable milestones or reward players for accomplishments beyond quest completion.

### Desired Behavior
- Achievements triggered by in-game actions (first dragon slain, reached level 5, etc.)
- Achievement popup notification during gameplay
- Achievements carry rewards: gold, items, crafting materials
- Some achievements hidden until earned (discovery achievements)
- Categories: Combat, Exploration, Social, Wealth, Story, Companion

### Implementation Approach
- New `achievements` and `character_achievements` tables
- Hook into existing event emission system (`emitSessionEvents`)
- Achievement service: `checkAchievements(characterId, event)` → returns newly earned achievements
- Auto-apply rewards using existing inventory management patterns

---

## Character Image Generation

**Priority:** Low (Future)
**Identified:** 2026-02-09

### Problem
Characters have an `avatar` field and players can upload images, but there's no in-app image generation.

### Desired Behavior
- "Generate Portrait" button on character sheet
- Uses character description (race, class, appearance, gender) as prompt input
- Generates a D&D-style fantasy portrait
- Player can regenerate if they don't like the result
- Stretch: companion portraits, location art, scene illustrations during DM sessions

### Implementation Approach
- Integrate an image generation API (DALL-E, Stable Diffusion, etc.)
- Build prompt from character attributes
- Store generated images locally or as base64 in the database

---

## Already Implemented

The following features were previously tracked here and have been built:

- **Full Spell Management System** (2026-02-21) — 284 spells (1st-9th level, all classes), spell slot display with use/restore, prepared spell UI (Cleric/Druid/Paladin/Wizard/Artificer), known spell UI (Bard/Ranger/Sorcerer/Warlock), level-up spell selection step with optional swap
- **Inventory Management During/After Sessions** (2026-02-08) — Auto-detect items consumed/gained at session end with undo
- **Downtime Integration** (2026-01-29) — Pending downtime narratives injected into DM session context
- **Rest Button Pronoun Fix** (2026-01-29) — Uses character gender for he/she/they pronouns
- **In-Session Calendar Advancement** (2026-01-29) — Manual +/- buttons, long rest auto-advances 1 day
- **Backstory Parser** (2026-02-07) — AI parses backstory into structured elements, editable by player
- **Streamlined Campaign Creation** (2026-02-07) — Auto-pipeline: create → assign → parse → generate plan
- **Gameplay Tabs** (2026-02-07) — Adventure/Downtime/Stats tabs during DM sessions
- **Companion Level-Up UI** (2026-02-07) — HP roll vs average, ASI distribution, subclass selection
- **Quick-Reference Stats Panel** (2026-02-09) — HP/AC/Gold in session bar, racial traits in Abilities tab
- **In-Session Inventory Viewer** (2026-02-09) — Slide-in panel with rarity colors, filter tabs, discard
- **Initiative & Combat Tracker** (2026-02-09) — COMBAT_START/END markers, initiative rolling, turn order bar
- **Persistent Merchant Inventories** (2026-02-10) — Loot tables, referrals, custom items, cursed items, DMG magic items
- **Opus for All Generation** (2026-02-10) — All 6 generators + campaign plan use Opus; Sonnet for DM sessions only
- **Content Preference Cleanup** (2026-02-11) — Removed 9 redundant content pref toggles (romance, horror, etc.); campaign tone handled by Opus plan
- **Frontend Component Decomposition** (2026-02-11) — Extracted 5 components from DMSession.jsx (SessionSetup, SessionRewards, CampaignNotesPanel, QuickReferencePanel, CompanionsPanel); reduced from 4583 to 2395 lines
- **Player Journal** (2026-02-11) — Player Knowledge Tracker showing NPCs met, locations visited, faction standings, quests, and world events; aggregates existing session data
- **Companion Skill Checks** (2026-02-11) — Companion skill modifiers + passive Perception in DM prompt; AI narrates companion skill attempts when player fails
- **Context-Aware Rest Narratives** (2026-02-11) — AI generates atmospheric rest descriptions based on current session context; mechanical results show immediately
- **Condition & Status Effect Tracking** (2026-02-11) — 15 D&D 5e conditions + exhaustion 1-6; slide-in panel, info bar chips, AI markers, auto-clear on rest/combat end
- **Companion Management During Sessions** (2026-02-11) — CompanionsPanel extracted from DMSession; compact companion cards with HP, abilities, equipment accessible during gameplay
- **Story Chronicle System** (2026-02-21) — Structured canon fact database (`canon_facts` table), session chronicles (`story_chronicles` table), context window management with sliding window compression, adaptive AI context budgeting (2K-8K tokens), priority-ordered fact retrieval (deaths > promises > critical > quest > recent), Chronicle tab in Player Journal with timeline/search/edit, Chronicle stats on Meta Game Dashboard, unlimited campaign notes/character memories/NPC name storage
- **Homebrew Class Expansion** (2026-02-21) — Added Blood Hunter (4 subclasses), Pugilist (7 subclasses), Warlord (6 subclasses) as full classes; added Forgewright and Warsmith Artificer subclasses, Path of the Witch Hunter and Path of the Dragon Barbarian subclasses, Spellwarden Fighter subclass, Wealth and Stone Domain Cleric subclasses, School of Theurgy Wizard subclass, Surgeon Rogue subclass (16 classes, 151 total subclasses)
- **NPC Conversation Memory** (2026-02-21) — `npc_conversations` table stores dialogue summaries, topics, tone, key quotes per NPC per session; extracted via chronicle AI prompt at session end; last 2 conversations per NPC injected into DM prompt under NPC RELATIONSHIPS section
- **Companion Emotional State** (2026-02-21) — Mood columns on `companion_backstories` (mood, mood_cause, mood_intensity 1-5, mood_set_game_day); 10 mood states (content, anxious, angry, sad, fearful, excited, conflicted, grateful, resentful, exhausted); intensity decays by 1 per 2 game days; mood + RP guidance injected into DM prompt companion section

---

## Consequence Automation

**Priority:** High (Next build)
**Identified:** 2026-02-21

### Problem
Broken promises and ignored quests have no automatic consequences. NPCs should remember and react when the player fails to follow through.

### Desired Behavior
- Broken promises auto-trigger NPC disposition decreases
- Ignored quests escalate (bandits attack the village, the hostage is killed, etc.)
- Faction standing changes based on player actions and inactions
- Canon facts about promises feed directly into consequence triggers

### Files to Modify
- `server/services/storyChronicleService.js` — Add promise expiration/broken detection
- `server/services/npcRelationshipService.js` — Auto-update disposition on broken promises
- `server/services/questService.js` — Quest escalation timers

---

## Crafting System

**Priority:** Medium
**Identified:** 2026-02-21

### Problem
Characters have artisan tools and crafting proficiencies but no crafting mechanic.

### Desired Behavior
- Use artisan tools to create items during downtime
- Recipe system: known recipes + discoverable recipes
- Material gathering from exploration and combat loot
- Quality outcomes based on skill checks and tool proficiency
- Upgrade existing equipment (add enchantments, improve quality)

---

## Weather & Time of Day

**Priority:** Medium
**Identified:** 2026-02-21

### Problem
No weather or time-of-day tracking. All scenes happen in generic conditions.

### Desired Behavior
- Weather system: clear, rain, storm, snow, fog, etc.
- Seasonal weather patterns based on Harptos calendar
- Time of day affects NPC availability (shops closed at night, taverns busy at evening)
- Weather affects travel speed, visibility, and encounter types
- Spell effects interact with weather (e.g., Call Lightning in a storm)

---

## Procedural Dungeon Generation

**Priority:** Medium
**Identified:** 2026-02-21

### Problem
No multi-room dungeon exploration with spatial awareness.

### Desired Behavior
- Generate dungeon layouts with rooms, corridors, doors, traps, and treasures
- Room-by-room exploration with state tracking (visited, cleared, locked)
- Dungeon map display showing explored areas
- Encounters tied to specific rooms
- Keys, puzzles, and locked doors creating exploration objectives

---

## Visual World Map

**Priority:** Low
**Identified:** 2026-02-21

### Problem
No visual representation of the game world. Players can't see where they are or where they've been.

### Desired Behavior
- Location markers on a stylized map
- Fog of war for unexplored areas
- Travel routes between discovered locations
- Click-to-travel for known destinations
- Notable event markers on the map

---

## Tavern Mini-games

**Priority:** Low
**Identified:** 2026-02-21

### Problem
No structured mini-games for social downtime in taverns and inns.

### Desired Behavior
- Dice games (Liar's Dice, Three Dragon Ante)
- Card games with NPC opponents
- Drinking contests with Constitution checks
- Gambling with gold stakes
- Win/loss affects NPC relationships

---

## Economy Simulation

**Priority:** Low
**Identified:** 2026-02-21

### Problem
Prices are static. Merchants always have the same prices regardless of supply, demand, or world events.

### Desired Behavior
- Supply and demand affects prices (war = expensive weapons, plague = expensive potions)
- Merchant memory (merchants remember past transactions)
- Price fluctuation based on world events
- Regional price differences (coastal cities have cheaper fish, mountain towns have cheaper ore)
- Bulk discount/markup for large transactions

---

## Legacy System

**Priority:** Low
**Identified:** 2026-02-21

### Problem
Retired or dead characters have no lasting impact on the world for new characters.

### Desired Behavior
- Retired characters become NPCs in the world
- Dead characters' graves/monuments can be discovered
- Previous characters' actions are reflected in world state
- Items left behind can be found by new characters
- Legends and stories about previous characters circulate among NPCs

---

## Other Ideas (Add as needed)

<!-- Add future feature requests below this line -->
