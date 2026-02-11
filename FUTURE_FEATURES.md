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

## Spell Management & Companion Spell Slots

**Priority:** High
**Identified:** 2026-02-09

### Problem
The database has `known_spells`, `prepared_spells`, `known_cantrips`, `spell_slots`, and `spell_slots_used` columns, but there's no UI to manage spells during gameplay. Additionally, companions who are spellcasters have their own spell slots that need to be tracked independently.

### Desired Behavior
- View known spells organized by level
- Prepare spells (for prepared casters like Clerics/Paladins/Wizards)
- Track spell slot usage (mark slots as used, restore on rest)
- Each companion spellcaster tracks their own spell slots separately
- The AI DM manages companion spellcasting narratively

### Files to Modify
- `client/src/components/DMSession.jsx` — Spell management UI
- `server/routes/character.js` — Persist cantrips/spells on level-up
- `server/database.js` — Add spell columns to companions if missing
- `server/services/dmPromptBuilder.js` — Inject companion spell slot status into prompt
- `server/routes/dmSession.js` — Handle companion spell usage markers

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

## Companion Management During Sessions

**Priority:** High
**Identified:** 2026-02-09

### Problem
Companions exist in the system (backstory, stats, recruitment, leveling) but there's no way to view or manage active companions during a DM session without leaving the session.

### Desired Behavior
- A "Party" panel accessible during DM sessions showing active companions
- Compact companion cards with HP, key abilities, equipment
- Quick actions: view full companion sheet, equip/unequip items
- Updates in real-time as companions take damage, cast spells, etc.

### Files to Modify
- `client/src/components/DMSession.jsx` — Add party panel
- Potentially extract to `client/src/components/PartyPanel.jsx`

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

---

## Other Ideas (Add as needed)

<!-- Add future feature requests below this line -->
