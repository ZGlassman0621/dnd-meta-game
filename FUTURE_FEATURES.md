# Future Features & Enhancements

This file tracks feature ideas and enhancements for future implementation.

---

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

---

## Already Implemented

The following features were previously tracked here and have been built:

- **Faction-Driven Quest Generation** (2026-02-23) — Milestone-based faction quest spawning (25/50/75/100%), conflict quests when rival factions clash (player chooses sides), quest completion → faction goal progress feedback (regular quests advance goals by 5-10, conflict quests advance defender +8 and hinder aggressor -5), standing-based reward scaling (allied 1.5x, neutral 1.0x, hostile 0.75x), active quest injection in DM prompt with stage/objective/faction context, quest type labels ([MAIN], [FACTION], [CONFLICT], [COMPANION], [SIDE]), 112-assertion test suite
- **Consequence Automation + Weighted Reputation System** (2026-02-23) — Overdue promise auto-breaking (warning at 21 game days, auto-break at 45 or explicit deadline), quest deadline enforcement with escalation narratives, consequence logging table, [PROMISE_MADE] and [PROMISE_FULFILLED] AI markers with Weight parameter (trivial/minor/moderate/major/critical), weight-scaled disposition/trust effects, reputation ripple to nearby NPCs (probability proportional to weight), faction standing propagation (via leader_npc_id + notable_members, leaders 1.5x), merchant price modifiers (disposition + faction → 0.85-1.25 multiplier with discount/markup badge UI), DM prompt urgency annotations, living world tick step 3.8, 185-assertion test suite
- **Mythic Progression System** (2026-02-22) — 5 tiers (Touched by Legend → Apotheosis), 14 paths (12 player + 2 DM-only), Mythic Power pool (3 + 2×tier/day), Surge mechanic (d6→d12 by tier), trial-based advancement, 53-deity piety system (all character creator deities across 9 pantheons), 12 epic boons, legendary items (4 states: Dormant → Awakened → Exalted → Mythic), shadow-path interaction, 4 AI markers ([MYTHIC_TRIAL], [PIETY_CHANGE], [ITEM_AWAKEN], [MYTHIC_SURGE]), 7-tab frontend UI, 1004-assertion test suite
- **Weather, Survival & Crafting Systems** (2026-02-22) — Weather system (season-based probability tables, region mods, temperature calc, gear warmth, exposure thresholds), survival system (D&D 5e PHB hunger/thirst/starvation/dehydration, auto-consume, food spoilage, foraging DCs by terrain), crafting system (112 recipes across 10 categories, quality tiers, tool proficiency, discoverable recipes, radiant AI-generated recipes via [RECIPE_GIFT] marker)
- **NPC System Overhaul** (2026-02-21) — NPC lifecycle state machine (alive/deceased/missing/imprisoned/unknown) with death propagation cascade, NPC personality enrichment (voice/personality/mannerism/motivation/appearance fill-not-overwrite), NPC voice differentiation in DM prompt, companion activities (off-screen tasks with AI resolution), NPC mail system (candidate scoring, AI/template generation, narrative queue), NPC aging/absence (disposition/trust decay, reunion boost, relocation/forget thresholds), living world tick pipeline (weather → factions → events → companions → NPC mail → survival), narrative queue system
- **Story Chronicle System** (2026-02-21) — Structured canon fact database (`canon_facts` table), session chronicles (`story_chronicles` table), context window management with sliding window compression, adaptive AI context budgeting (2K-8K tokens), priority-ordered fact retrieval (deaths > promises > critical > quest > recent), Chronicle tab in Player Journal with timeline/search/edit, Chronicle stats on Meta Game Dashboard, unlimited campaign notes/character memories/NPC name storage
- **Full Spell Management System** (2026-02-21) — 284 spells (1st-9th level, all classes), spell slot display with use/restore, prepared spell UI (Cleric/Druid/Paladin/Wizard/Artificer), known spell UI (Bard/Ranger/Sorcerer/Warlock), level-up spell selection step with optional swap
- **NPC Conversation Memory** (2026-02-21) — `npc_conversations` table stores dialogue summaries, topics, tone, key quotes per NPC per session; extracted via chronicle AI prompt at session end; last 2 conversations per NPC injected into DM prompt under NPC RELATIONSHIPS section
- **Companion Emotional State** (2026-02-21) — Mood columns on `companion_backstories` (mood, mood_cause, mood_intensity 1-5, mood_set_game_day); 10 mood states; intensity decays by 1 per 2 game days; mood + RP guidance injected into DM prompt companion section
- **Homebrew Class Expansion** (2026-02-21) — Added Blood Hunter (4 subclasses), Pugilist (7 subclasses), Warlord (6 subclasses) as full classes; added Forgewright and Warsmith Artificer subclasses, Path of the Witch Hunter and Path of the Dragon Barbarian subclasses, Spellwarden Fighter subclass, Wealth and Stone Domain Cleric subclasses, School of Theurgy Wizard subclass, Surgeon Rogue subclass (16 classes, 151 total subclasses)
- **Database Migration System** (2026-02-21) — Numbered migration files (`server/migrations/001_*.js` through `010_mythic_progression.js`), `_migrations` tracking table, `up()`/`down()` functions, runs once on startup
- **Achievement System** (2026-02-21) — Achievement tracking with categories, rewards, and discovery achievements; hooked into event emission system
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
- **Content Preference Cleanup** (2026-02-11) — Removed 9 redundant content pref toggles; campaign tone handled by Opus plan
- **Frontend Component Decomposition** (2026-02-11) — Extracted 5 components from DMSession.jsx; reduced from 4583 to 2395 lines
- **Player Journal** (2026-02-11) — Player Knowledge Tracker showing NPCs met, locations visited, faction standings, quests, and world events
- **Companion Skill Checks** (2026-02-11) — Companion skill modifiers + passive Perception in DM prompt; AI narrates companion skill attempts
- **Context-Aware Rest Narratives** (2026-02-11) — AI generates atmospheric rest descriptions based on session context
- **Condition & Status Effect Tracking** (2026-02-11) — 15 D&D 5e conditions + exhaustion 1-6; slide-in panel, info bar chips, AI markers, auto-clear on rest/combat end
- **Companion Management During Sessions** (2026-02-11) — CompanionsPanel extracted; compact companion cards with HP, abilities, equipment
