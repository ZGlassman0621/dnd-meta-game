# Future Features & Enhancements

This file tracks feature ideas and enhancements for future implementation.

---

## ~~Inventory Management During/After Sessions~~ ✅ IMPLEMENTED

**Priority:** High
**Requested:** 2026-01-28
**Implemented:** 2026-02-08

**Implementation Notes:**
- AI analyzes session transcript at end and detects items consumed, items gained, and gold spent
- Analysis prompt in `dmSessionService.js` provides current inventory + gold to the AI for comparison
- Inventory changes **auto-applied** at session end (no manual confirmation needed)
- Server-side safety: consumed items validated against actual inventory (can't remove what doesn't exist), gold floor at 0
- **Undo button** shown after auto-apply — restores pre-session inventory/gold via `PUT /api/character/:id`
- Fallback: if auto-apply fails silently, manual "Apply Changes" button appears
- Backend: `POST /api/dm-session/:sessionId/apply-inventory` handles consumed/gained/goldSpent
- Frontend: `DMSession.jsx` — `endSession()` auto-applies, `undoInventoryChanges()` reverts

---

## ~~Downtime Integration with Campaign Narrative~~ ✅ IMPLEMENTED

**Priority:** High
**Requested:** 2026-01-28
**Implemented:** 2026-01-29

**Implementation Notes:**
- Added `pending_downtime_narratives` column to characters table
- When downtime completes, saves narrative event to character record
- When starting/resuming DM session, pending narratives are injected into AI context
- Narratives cleared after being included in session
- AI instructed to weave downtime activities naturally into opening narrative

### Problem
Downtime activities (training, working, resting, studying) happen in a separate tab and feel disconnected from the ongoing campaign story. When you return to the DM session, there's no narrative acknowledgment of what happened during downtime.

### Desired Flow
1. Player is in a DM session, reaches a natural pause (arrived at town, finished a quest)
2. Player switches to Downtime tab, starts a "Training" activity for 8 hours
3. When downtime completes, player returns to DM session
4. The AI DM acknowledges the downtime: *"After spending the morning drilling sword forms in the training yard, Riv feels sharper, more confident..."*

### Implementation Approach

#### Option A: Downtime Queue with Narrative Bridge
1. **Track pending downtime narratives** - When downtime completes, store a "narrative event" on the character:
   ```js
   character.pending_narratives = [
     { type: 'training', duration: '8 hours', result: 'Gained 40 XP', timestamp: '...' }
   ]
   ```

2. **Inject into next DM session** - When resuming/continuing a session, check for pending narratives and prepend them to the AI's context:
   ```
   RECENT DOWNTIME: The character spent 8 hours training and gained 40 XP.
   Acknowledge this naturally in your next response.
   ```

3. **Clear after acknowledgment** - Once the AI has woven it into the narrative, clear the pending event.

#### Option B: Unified Timeline View
- Show a combined timeline of "DM Session events" and "Downtime events"
- The AI sees the full timeline and naturally references what happened
- More complex but creates a cohesive story

#### Option C: "Return to Adventure" Button in Downtime
- After completing downtime, show a "Return to Adventure" button
- Clicking it generates a narrative transition and drops you back into the DM session
- The transition describes what happened: "The sun sets on your third day of training..."

### Technical Considerations
- Need to track downtime completion state per character
- Session context needs to include recent downtime activities
- Calendar/time system should stay in sync (downtime advances game time)
- Consider batch downtime (multiple activities before returning to adventure)

### Database Changes
```sql
-- Add to characters table or create new table
ALTER TABLE characters ADD COLUMN pending_downtime_narratives TEXT DEFAULT '[]';

-- Or create a narrative_events table
CREATE TABLE narrative_events (
  id INTEGER PRIMARY KEY,
  character_id INTEGER,
  event_type TEXT,  -- 'downtime', 'session_end', 'level_up', etc.
  description TEXT,
  game_day INTEGER,
  game_year INTEGER,
  acknowledged BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## ~~Rest Button Pronoun Fix~~ ✅ IMPLEMENTED

**Priority:** Low (quick fix)
**Requested:** 2026-01-28
**Implemented:** 2026-01-29

**Implementation Notes:**
- Added pronoun logic to the `takeRest` function in DMSession.jsx
- Uses character.gender to determine he/him, she/her, or they/them pronouns

### Problem
When clicking "Long Rest" or "Short Rest", the narrative says:
> *"Riv settles in for a long rest, finding what comfort they can. Hours pass as they sleep deeply..."*

The "they/their" is hardcoded but should use the character's actual gender/pronouns.

### Fix
Query `character.gender` and use appropriate pronouns:
- Male → he/him/his
- Female → she/her/her
- Other → they/them/their

```js
const getPronouns = (gender) => {
  const g = gender?.toLowerCase();
  if (g === 'male' || g === 'm') return { subject: 'he', object: 'him', possessive: 'his' };
  if (g === 'female' || g === 'f') return { subject: 'she', object: 'her', possessive: 'her' };
  return { subject: 'they', object: 'them', possessive: 'their' };
};
```

---

## Context-Aware Rest Narratives

**Priority:** Medium
**Requested:** 2026-01-28

### Problem
The rest button generates a generic hardcoded message regardless of what's happening in the story. It would be more immersive if the AI generated an appropriate rest description based on the current narrative context.

### Current Behavior
Clicking "Long Rest" always shows:
> *"Riv settles in for a long rest, finding what comfort they can..."*

### Desired Behavior
The AI should generate contextual rest narratives:
- In a tavern: *"Riv retires to the room upstairs, the sounds of the common room fading as he drifts off..."*
- Camping outdoors: *"With Mira keeping first watch, Riv wraps himself in his bedroll beneath the stars..."*
- After a battle: *"Exhausted from the fight, Riv finds a sheltered corner and sleeps the sleep of the weary..."*
- With companions: *"The group settles around the dying fire, taking turns at watch through the night..."*

### Implementation Approach
Instead of hardcoded text, send a request to the AI:
```js
const restPrompt = `The player is taking a ${restType} rest. Based on the current scene and circumstances, write a brief (2-3 sentence) narrative description of them resting. Include relevant details about the location, companions present, and mood.`;

// Send to AI with current session context
const restNarrative = await generateRestNarrative(sessionMessages, restPrompt);
```

### Considerations
- Adds an AI call (latency, cost) - maybe make it optional?
- Could cache/skip if player rests multiple times quickly
- Should still show the mechanical result ("Restored 15 HP and all spell slots")

---

## ~~In-Session Calendar Advancement~~ ✅ IMPLEMENTED

**Priority:** High
**Requested:** 2026-01-28
**Implemented:** 2026-01-29

**Implementation Notes:**
- Added +/- buttons next to calendar display for manual date control
- Long rest automatically advances calendar by 1 day
- Added `/api/dm-session/:sessionId/adjust-date` endpoint
- Uses Harptos calendar's `advanceTime()` function

### Problem
The calendar date shown during a DM session is static. An adventure that starts on "1 Hammer, 1271" stays on that date even after multiple in-game days pass. The date only updates when the session ends (based on activity analysis), but during play it's frozen.

### Current Behavior
- Session starts: "1 Hammer, 1271"
- Two in-game days pass in the narrative
- Calendar still shows: "1 Hammer, 1271"
- Session ends: date advances based on wrap-up analysis

### Desired Behavior
The calendar should reflect the current in-game date as time passes during the session.

### Implementation Options

#### Option A: Manual Date Controls (Easiest)
Add +/- buttons next to the calendar display:
```
❄️ 1 Hammer, 1271 DR  [−] [+]
```
- Player clicks [+] to advance a day when appropriate
- Simple, player-controlled, no AI complexity
- Could also add a "Set Date" modal for larger jumps

#### Option B: Rest-Triggered Advancement
- Short rest: No date change (only 1 hour)
- Long rest: Automatically advance 1 day
- This ties date changes to mechanical actions the player already takes

#### Option C: AI-Detected Time Passage
Have the AI include time markers in responses:
```
[TIME: +1 day]
The sun rises on your second day in Bryn Shander...
```
Parse these markers and update the calendar automatically.

#### Option D: Hybrid Approach
- Long rests auto-advance the date
- Manual controls available for edge cases
- AI can suggest time passage that player confirms

### Technical Notes
- Current date is stored in session as `game_start_day` and `game_start_year`
- Need to add `game_current_day` / `game_current_year` to track mid-session changes
- Or update the start values during session and recalculate on resume
- `dayToDate()` function already handles conversion to display format

### Quick Win
Just add manual [+] [-] buttons - simple, no AI changes needed, gives player control.

---

## ~~Backstory Parser~~ ✅ IMPLEMENTED

**Priority:** High
**Requested:** 2026-02-04
**Implemented:** 2026-02-07

**Implementation Notes:**
- Full page at `client/src/components/BackstoryParserPage.jsx` + `server/services/backstoryParserService.js`
- AI parses freeform backstory into structured elements: characters, locations, factions, events, story hooks
- Player can edit/add/remove parsed elements; re-parse preserves manual edits
- Parsed backstory feeds into campaign plan generation and starting location auto-detection
- Nav entry: Character > Backstory Parser

---

## ~~Streamlined Campaign Creation~~ ✅ IMPLEMENTED

**Priority:** High
**Requested:** 2026-02-07
**Implemented:** 2026-02-07

**Implementation Notes:**
- Campaign creation auto-pipeline: create → assign character → parse backstory → generate campaign plan
- Starting location dropdown with 15 Forgotten Realms locations + custom option
- Auto-detects starting location from parsed backstory
- Progress UI with step indicators and animated progress bar
- "Play Now" button on completion navigates to DM session
- Play button on home screen when campaign plan is ready

---

## ~~Gameplay Tabs (Downtime + Stats during sessions)~~ ✅ IMPLEMENTED

**Priority:** Medium
**Requested:** 2026-02-07
**Implemented:** 2026-02-07

**Implementation Notes:**
- Adventure / Downtime / Stats tabs during active DM sessions
- Downtime and MetaGameDashboard components embedded as tabs without modification
- Tabs reset to "Adventure" when new session starts

---

## ~~Companion Level-Up UI~~ ✅ IMPLEMENTED

**Priority:** Medium
**Requested:** 2026-02-07
**Implemented:** Already existed in `CompanionSheet.jsx`

**Implementation Notes:**
- `CompanionLevelUpModal` component in `client/src/components/CompanionSheet.jsx` (line 521)
- HP roll vs average choice with hit die and CON modifier
- ASI distribution and subclass selection when applicable
- Backend: `GET /api/companion/:id/level-up-info` + `POST /api/companion/:id/level-up`

---

## Database Migration System

**Priority:** Medium
**Identified:** 2026-02-07

### Problem
`server/database.js` is 1309 lines of `CREATE TABLE IF NOT EXISTS` statements with conditional `ALTER TABLE` additions scattered throughout. Every schema change requires adding another conditional alter that runs on every startup, and there's no way to track which changes have been applied.

### Planned Implementation
- Replace monolithic `database.js` with numbered migration files (e.g., `001_initial_schema.js`, `002_add_campaign_notes.js`)
- Track applied migrations in a `_migrations` table
- Each migration runs once, is idempotent, and includes both `up()` and `down()` functions
- Startup checks which migrations have run and applies any new ones in order
- Makes schema history explicit and reviewable

---

## Frontend Component Decomposition

**Priority:** Low
**Identified:** 2026-02-07

### Problem
Several frontend components have grown very large:
- `DMSession.jsx` (~4300 lines)
- `CharacterCreationWizard.jsx` (~3100 lines)
- `CharacterSheet.jsx` (~2700 lines)
- `PartyBuilder.jsx` (~2600 lines)

These files are difficult to navigate and maintain.

### Planned Approach
- Extract sub-components incrementally when modifying sections
- Pull out logical sections (e.g., combat panel, inventory panel, spell management) into separate files
- Keep parent component as orchestrator that passes props down
- Low priority because refactoring carries risk of regressions with no feature benefit

---

## ~~Quick-Reference Stats Panel in DM Session~~ ✅ IMPLEMENTED

**Priority:** High
**Identified:** 2026-02-09
**Implemented:** 2026-02-09

**Implementation Notes:**
- HP/AC/Gold added to the session-info-bar alongside game date and spell slots
- HP color-coded: green (>50%), yellow (25-50%), red (<25%)
- Racial traits displayed in Abilities tab with teal accent, auto-looked up from `races.json`
- No separate component — integrated directly into the existing stats bar in DMSession.jsx

---

## ~~In-Session Inventory Viewer~~ ✅ IMPLEMENTED

**Priority:** High
**Identified:** 2026-02-09
**Implemented:** 2026-02-09

**Implementation Notes:**
- New `InventoryPanel.jsx` component: slide-in overlay (green #10b981 accent, 400px wide)
- Filter tabs (All/Weapons/Armor/Misc), rarity colors via batch API lookup
- Items gained this session highlighted with "NEW" badge
- Discard button removes items via `POST /api/character/:id/discard-item`
- Batch rarity lookup via `POST /api/dm-session/item-rarity-lookup`
- Mutual exclusion with Character and Party panels

---

## Spell Management & Companion Spell Slots

**Priority:** High
**Identified:** 2026-02-09

### Problem
The database has `known_spells`, `prepared_spells`, `known_cantrips`, `spell_slots`, and `spell_slots_used` columns, but there's no UI to manage spells during gameplay. Spell casters can't prep spells, track usage, or see what's available. Additionally, companions who are spellcasters have their own spell slots that need to be tracked independently — the party doesn't share spell resources.

### Desired Behavior — Player Spells
- View known spells organized by level
- Prepare spells (for prepared casters like Clerics/Paladins/Wizards)
- Track spell slot usage (mark slots as used, restore on rest)
- Quick reference during combat: "What spells do I have left?"

### Desired Behavior — Companion Spell Slots
- Each companion spellcaster tracks their own spell slots separately
- The AI DM is aware of companion spell resources and manages them narratively
- When a companion casts a spell, their slot is consumed (not the player's)
- The AI should narrate companion spellcasting naturally: "Mira weaves a healing spell, her hands glowing softly as she touches your wounds"
- Companion spell slots restore on appropriate rests (same rules as player)

### Implementation Approach — Player
- Add spell management to the Quick Stats Panel or as its own tab
- `known_spells` and `prepared_spells` are already JSON columns on characters
- Spell slot tracking: `spell_slots` (max per level) and `spell_slots_used` (current usage)
- Rest button already exists — extend it to restore spell slots (short rest: warlock pact slots; long rest: all slots)
- Level-up already calculates spell slots — just need to persist `known_spells`/cantrips (currently TODO in character.js)

### Implementation Approach — Companion Spell Slots
- Add `spell_slots` and `spell_slots_used` JSON columns to `companions` table (if not already present)
- Companion spell data seeded from their class/level when recruited
- DM prompt injection: include companion spell slot status in the companion context block
- Add `[COMPANION_CAST]` marker or extend existing systems so AI can signal companion spell usage
- Server-side handler: when companion casts, decrement their `spell_slots_used`
- Rest mechanics: companion slots restore alongside player slots

### Files to Modify
- `client/src/components/DMSession.jsx` — Spell management UI
- `server/routes/character.js` — Fix TODO: persist cantrips/spells on level-up
- `server/database.js` — Add spell columns to companions if missing
- `server/services/dmPromptBuilder.js` — Inject companion spell slot status into prompt
- `server/routes/dmSession.js` — Handle companion spell usage markers
- `server/services/dmSessionService.js` — Add `detectCompanionCast()` parser

---

## Condition & Status Effect Tracking

**Priority:** Medium
**Identified:** 2026-02-09

### Problem
D&D 5e has 15 conditions (blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious, exhaustion). The database has `debuffs` and `injuries` fields on characters, but there's no UI to apply or track conditions during active gameplay. The AI and player both rely on memory.

### Desired Behavior
- Quick-apply buttons for common conditions during session
- Conditions visible in the Quick Stats Panel
- AI DM is aware of active conditions and references them narratively
- Conditions auto-clear on appropriate triggers (e.g., "restrained" cleared when combat ends, exhaustion reduced on long rest)
- Companion conditions tracked separately

### Implementation Approach
- Define D&D 5e conditions as a constant array with names, descriptions, and auto-clear rules
- Add condition buttons to the session UI (small toggleable chips)
- Store active conditions in character `debuffs` JSON field (already exists)
- Inject active conditions into DM prompt so AI references them: "Remember, the player is currently poisoned"
- Exhaustion levels (1-6) with escalating effects per D&D 5e rules

### Files to Modify
- `client/src/components/DMSession.jsx` — Condition toggle UI
- `server/services/dmPromptBuilder.js` — Inject active conditions into prompt
- Potentially a new `client/src/data/conditions.js` data file

---

## Player Knowledge Tracker (Fog of War for Information)

**Priority:** Medium
**Identified:** 2026-02-09

### Problem
The Campaign Plan contains rich world data (NPC secrets, faction goals, hidden locations, plot twists) that the AI DM knows but the player hasn't discovered yet. Currently, the Campaign Plan page has a spoiler system, but there's no structured way to track what the player has actually learned vs. what remains hidden. The AI DM knows everything; the player should only know what they've discovered through play.

### Desired Behavior
- A "Player Journal" or "Known World" view showing only information the player has discovered
- Tracks: NPCs met, locations visited, faction allegiances learned, plot points revealed, secrets uncovered
- Automatically populated from DM session events (NPC interactions, location visits already emit events)
- Contrast with full Campaign Plan — player sees their partial picture, not the full map
- Could show "??? Unknown" placeholders for undiscovered elements to create intrigue

### Implementation Approach
- Leverage existing session event emission (`emitSessionEvents` already tracks NPC interactions, location visits, item gains)
- Create a `player_knowledge` table or extend existing tables with `discovered_by_player` flags
- Build a "Journal" page that aggregates: NPCs met (from `npc_relationships`), locations visited (from `discovered_locations`), faction info learned (from `faction_standings`), quest clues found
- The Campaign Plan page already has spoilers — could add a "Player View" toggle that hides unrevealed content
- AI DM prompt already gets full world state; no changes needed there

### Files to Modify
- New `client/src/components/PlayerJournalPage.jsx` component
- `server/database.js` — Potentially add `player_knowledge` table or discovery flags
- `client/src/components/NavigationMenu.jsx` — Add Journal to Story menu
- Could reuse data from existing services (npcRelationshipService, locationService, factionService)

---

## Faction-Driven Quest Generation

**Priority:** Medium
**Identified:** 2026-02-09

### Problem
Factions have goals with progress tracking, but quests are generated independently. When a faction reaches a milestone or two factions come into conflict, there's no automatic quest generation to make those world events playable.

### Desired Behavior
- When faction goals hit key thresholds (25%, 50%, 75%, 100%), auto-generate related quests
- Faction conflicts spawn quests: "The Zhentarim are moving against the Harpers — pick a side"
- Quests are narratively tied to faction activities, not generic fetch quests
- Player's faction standing affects quest availability and rewards
- Completing faction quests shifts standings and affects faction goal progress

### Implementation Approach
- Hook into the living world tick processor (which already advances faction goals)
- When a goal crosses a threshold, call the quest generator with faction context
- Quest generator prompt includes: faction identity, goal description, current progress, opposing factions, player's standing
- Generated quest rewards include faction reputation in addition to gold/XP/items
- Quest completion feeds back into faction goal progress

### Files to Modify
- `server/services/livingWorldService.js` — Add quest generation triggers to tick processing
- `server/services/questGenerator.js` — Add faction-aware quest generation prompts
- `server/services/questService.js` — Link quest completion to faction standings
- `server/services/factionService.js` — Add threshold detection helpers

---

## ~~Initiative & Combat Tracker~~ ✅ IMPLEMENTED

**Priority:** High
**Identified:** 2026-02-09
**Implemented:** 2026-02-09

**Implementation Notes:**
- AI DM emits `[COMBAT_START: Enemies="..."]` and `[COMBAT_END]` markers (3-point prompt reinforcement)
- Server rolls d20 + DEX mod for player, companions, and enemies (heuristic DEX estimation)
- Initiative results injected into AI conversation as system note
- New `CombatTracker.jsx`: inline bar above messages with round counter and combatant chips
- Chips color-coded: player (blue), companion (purple), enemy (red), active turn (gold border)
- Client-side "Next Turn" advancement and "End Combat" manual fallback
- Detection functions in `dmSessionService.js`: `detectCombatStart()`, `detectCombatEnd()`, `estimateEnemyDexMod()`
- 26 tests in `tests/combat-tracker.test.js`

---

## Companion Behind-the-Scenes Skill Checks

**Priority:** Medium
**Identified:** 2026-02-09

### Problem
When the player rolls a skill check (Perception, Stealth, etc.), companions don't independently contribute. In tabletop D&D, each party member rolls — and sometimes a companion succeeds where the player fails, creating memorable moments.

### Desired Behavior
- When the player attempts a skill check, companions in the party also roll behind the scenes
- If the player fails but a companion succeeds, the AI narrates it with flavor:
  - *"You can't hear anything unusual, but Gornak suddenly holds up a fist — 'Quiet,' he growls. 'Something's moving ahead.'"*
  - *"The lock defeats your attempts, but Sera kneels beside you and produces a thin wire. 'Allow me,' she says with a wink."*
- If the player succeeds, companions may still contribute additional details based on their own checks
- Not every check involves companions — only when they're present and the skill is relevant
- The AI DM handles all of this narratively; no UI buttons needed for companion rolls

### Implementation Approach
- This is primarily a **prompt engineering** feature — instruct the AI DM on companion skill check behavior
- Add to DM prompt: "When the player attempts a skill check and companions are present, consider whether companions would also attempt the check. If a companion has a relevant skill proficiency and the player fails, the companion may succeed and contribute narratively. Roll for companions behind the scenes using their actual modifiers."
- Include companion skill modifiers in the companion context block (already partially there via NPC stat blocks)
- The AI handles the rolls and narration — no server-side dice rolling needed for this
- Keep it narrative and natural — not every check triggers a companion check

### Files to Modify
- `server/services/dmPromptBuilder.js` — Add companion skill check instructions to the prompt
- Ensure companion stat blocks include skill proficiencies in the session context

---

## Companion Management During Sessions

**Priority:** High
**Identified:** 2026-02-09

### Problem
Companions exist in the system (backstory, stats, recruitment, leveling) but there's no way to view or manage active companions during a DM session. Players can't check companion HP, equipment, or abilities without leaving the session.

### Desired Behavior
- A "Party" panel or tab accessible during DM sessions
- Shows all active companions with:
  - Portrait/avatar (if available), name, class, level
  - HP (current/max)
  - Key abilities and proficiencies
  - Equipment summary
  - Spell slots (for spellcaster companions)
  - Current conditions
- Quick actions: view full companion sheet, equip/unequip items
- Updates in real-time as companions take damage, cast spells, etc.

### Implementation Approach
- Add a "Party" tab or collapsible panel to the DM session UI
- Fetch active companions for the character's campaign on session start
- Display compact companion cards with key stats
- Link to full `CompanionSheet` component for detailed management
- Companion HP/spell slot changes during session tracked via AI markers or manual adjustment

### Files to Modify
- `client/src/components/DMSession.jsx` — Add party panel
- Potentially extract to `client/src/components/PartyPanel.jsx`
- Companion data already available via `GET /api/companion?characterId=X`

---

## Achievement System with Rewards

**Priority:** Medium
**Identified:** 2026-02-09

### Problem
There's no way to track memorable milestones or reward players for accomplishments beyond quest completion. Achievements add a satisfying meta-layer that encourages exploration and engagement.

### Desired Behavior
- Achievements triggered by in-game actions: first dragon slain, reached level 5, 100 gold earned, first companion recruited, survived a TPK-level encounter, etc.
- Achievement popup notification during gameplay
- Achievement log viewable from character sheet or journal
- **Achievements can carry rewards**: gold, rations, crafting materials, consumable items, or unique cosmetic items
- Some achievements are hidden until earned (discovery achievements)
- Achievement categories: Combat, Exploration, Social, Wealth, Story, Companion

### Example Achievements
| Achievement | Trigger | Reward |
|-------------|---------|--------|
| First Blood | Win first combat encounter | 10 gold |
| Dragon Slayer | Defeat a dragon | Dragonscale (crafting material) |
| Silver Tongue | Pass 10 Persuasion checks | Potion of Charisma |
| Explorer | Visit 10 locations | Boots of Elvenkind |
| Wealthy | Accumulate 1000 gold | Gem of Brightness |
| Loyal Companion | Recruit first companion | Potion of Healing |
| Bookworm | Read 5 in-game books/scrolls | Spell Scroll (random) |
| Penny Pincher | Haggle successfully 5 times | Bag of Holding |
| Against All Odds | Survive combat below 5 HP | Periapt of Wound Closure |
| Master Tactician | Win combat with no party damage | Rations (10 days) |

### Implementation Approach

#### Database
```sql
CREATE TABLE achievements (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,       -- 'first_blood', 'dragon_slayer', etc.
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                   -- combat, exploration, social, wealth, story, companion
  hidden BOOLEAN DEFAULT 0,
  reward_gold INTEGER DEFAULT 0,
  reward_items TEXT DEFAULT '[]',  -- JSON array of item names
  reward_description TEXT          -- "10 days of rations"
);

CREATE TABLE character_achievements (
  id INTEGER PRIMARY KEY,
  character_id INTEGER NOT NULL,
  achievement_key TEXT NOT NULL,
  earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_id INTEGER,             -- which session it was earned in
  UNIQUE(character_id, achievement_key)
);
```

#### Achievement Checking
- Hook into existing event emission system (`emitSessionEvents`)
- After each session event (combat, NPC interaction, location visit, item gain), check achievement conditions
- Some achievements check cumulative stats (total gold earned, total locations visited)
- Achievement service: `checkAchievements(characterId, event)` → returns newly earned achievements

#### Reward Application
- When achievement earned, auto-apply rewards (gold added, items added to inventory)
- Notification returned in API response for UI popup
- Achievement rewards use existing inventory management patterns

### Files to Create/Modify
- New `server/services/achievementService.js` — Achievement definitions, checking, reward application
- New `server/routes/achievement.js` — API endpoints (list, earned, check)
- `server/database.js` — Achievement tables
- `client/src/components/DMSession.jsx` — Achievement popup notification
- New `client/src/components/AchievementLog.jsx` — Achievement gallery/log view
- `server/services/dmSessionService.js` — Hook achievement checks into session events

---

## Character Image Generation

**Priority:** Low (Future)
**Identified:** 2026-02-09

### Problem
Characters have an `avatar` field and players can upload images, but there's no in-app image generation. As the app moves toward more visual elements, AI-generated character portraits would add polish and immersion.

### Desired Behavior
- "Generate Portrait" button on character sheet
- Uses character description (race, class, appearance, gender) as prompt input
- Generates a D&D-style fantasy portrait
- Player can regenerate if they don't like the result
- Saved as the character's avatar
- Stretch: companion portraits, location art, scene illustrations during DM sessions

### Implementation Approach
- Integrate an image generation API (DALL-E, Stable Diffusion, etc.)
- Build prompt from character attributes: `"A ${race} ${class}, ${gender}, ${appearance_description}, fantasy D&D portrait style"`
- Store generated images locally or as base64 in the database
- Add UI to character sheet for generation and preview

### Files to Modify
- New `server/services/imageGenerationService.js`
- `client/src/components/CharacterSheet.jsx` — Add generate button
- `server/routes/character.js` — Add generation endpoint

---

## Content Preference Cleanup

**Priority:** Low
**Identified:** 2026-02-09

### Note
The 9 content preference toggles in `client/src/data/forgottenRealms.js` were part of the old UI where campaigns were manually configured. With Opus generating campaign plans, these toggles are no longer needed — the campaign description and tone settings in `CampaignsPage.jsx` handle content direction. These can be removed in a future cleanup pass.

### Files to Modify
- `client/src/data/forgottenRealms.js` — Remove `CONTENT_PREFERENCES` array
- `server/services/dmPromptBuilder.js` — Remove `formatContentPreferences()` and its injection
- Any UI that references content preference toggles

---

## Other Ideas (Add as needed)

<!-- Add future feature requests below this line -->
