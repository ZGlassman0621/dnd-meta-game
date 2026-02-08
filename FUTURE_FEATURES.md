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
- `DMSession.jsx` (~3500 lines)
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

## Other Ideas (Add as needed)

<!-- Add future feature requests below this line -->
