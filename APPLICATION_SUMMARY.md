# D&D Meta Game - Application Summary

A comprehensive D&D 5e campaign management and AI-powered narrative generation tool that works both online (Claude API) and offline (Ollama).

---

## Table of Contents

1. [Core Systems](#core-systems)
2. [Character Management](#1-character-management)
3. [AI Dungeon Master Sessions](#2-ai-dungeon-master-sessions)
4. [Meta Adventure System](#3-meta-adventure-system)
5. [Companion System](#4-companion-system)
6. [Downtime Activities](#5-downtime-activities)
7. [Story Thread System](#6-story-thread-system)
8. [In-Game Clock](#7-in-game-clock)
9. [Campaign Continuity](#8-campaign-continuity)
10. [Campaign Management](#9-campaign-management)
11. [Quest System](#10-quest-system)
12. [Location System](#11-location-system)
13. [Narrative Event System](#12-narrative-event-system)
14. [Faction System](#14-faction-system)
15. [World Events System](#15-world-events-system)
16. [Travel System](#16-travel-system)
17. [Living World System](#17-living-world-system)
18. [AI Content Generation](#18-ai-content-generation)
19. [Technical Architecture](#technical-architecture)
20. [Key User Flows](#key-user-flows)

---

## Core Systems

### 1. Character Management

#### Core Character Creation & Development
- **Full D&D 5e character sheets** with 50+ attributes including:
  - Basic info: name, first/last name, nickname, gender, race, subrace
  - Class system with multiclass support
  - Level progression (1-20) with experience tracking
  - Ability scores (STR, DEX, CON, INT, WIS, CHA) with modifiers
  - HP management (current/max)
  - Armor class and speed
  - Skills and proficiencies
  - Background and personality traits (ideals, bonds, flaws)
  - Physical appearance (height, weight, age, hair/eye/skin colors)
  - Alignment and faith
  - Equipment and inventory system
  - Avatar/character portraits

#### Advanced Leveling System
- **Multiclass Support**: Characters can combine multiple classes (e.g., Fighter 5 / Rogue 2)
- **Class-specific progression**: Each class has unique features at each level
- **Ability Score Improvements (ASI)**: Automatic detection and implementation at appropriate levels
- **Subclass selection**: Prompts for subclass choice at the appropriate level for each class
- **Hit Dice management**: Tracks hit dice breakdown for multiclass characters
- **Spell slot tracking**: Manages spell slots per level and class
- **Cantrips and spells**: Tracks known/prepared spells per class

#### Spell Management
- Spell slot tracking by level (1-9)
- Short and long rest mechanics (Warlock special rules)
- Spell slot usage and restoration
- Arcane Recovery and other class abilities

#### Character Progression Utilities
- **Rest mechanics**: Short rest (1 hour) and long rest (8 hours) with proper D&D 5e rules
- **XP tracking**: Experience points with level-based thresholds
- **Inventory management**: Track items and equipment
- **Gold management**: Copper, silver, and gold pieces with separate starting gold tracking
- **Faction standings**: Track relationships with organizations
- **Debuffs and injuries**: Status effects and temporary conditions
- **Campaign notes**: Auto-generated notes from session history with player-editable sections

#### Character Reset Options
- **XP Reset**: Clear experience points
- **Full Reset**: Reset HP, gold, inventory, and clear all adventures

---

### 2. AI Dungeon Master Sessions

#### LLM Provider Support
- **Multi-provider architecture**:
  - Claude API (Anthropic) - Primary AI option
  - Ollama - Local fallback with offline support
  - Automatic provider detection and fallback
- **Status checking**: Health checks for both providers

#### Interactive Text Adventure Sessions
- **Real-time conversation-based gameplay**
- **Character message history**: Full conversation saved per session
- **Dynamic narrative generation**: AI generates descriptions and outcomes
- **Session properties**:
  - Title and setting description
  - Tone customization (heroic, dark, comedic, etc.)
  - Model selection
- **Session states**: active, paused, completed
- **Reward claiming**: Rewards from sessions can be claimed separately

#### Session Outcomes
- **Rewards from DM sessions**:
  - XP gained
  - Gold earned
  - Loot acquisition
  - HP changes
- **Location updates**: Sessions can change character location
- **Quest updates**: Sessions can trigger new quests
- **Game time advancement**: Sessions advance in-game time
- **Session recap**: Auto-generated summaries of events

#### Context Awareness
- **Campaign context injection**: Full character state sent to AI
- **Story thread awareness**: AI knows about active plot threads
- **Pending narratives**: Downtime and adventure events inform DM behavior
- **NPC relationships**: AI aware of character relationships
- **Location-aware**: Sessions consider current location

---

### 3. Meta Adventure System

#### Adventure Generation & Management
- **Intelligent adventure generation** using Claude AI or Ollama with full campaign context
- **Multi-risk adventures**: Generate all risk levels (low, medium, high) in one call
- **Contextual adventure creation**: Uses character location, level, past adventures, and story threads
- **Adventure preview**: See odds of success before committing
- **Adventure properties**:
  - Title and description
  - Location setting
  - Risk level (low/medium/high)
  - Duration in hours
  - Activity type (combat, stealth, investigation, etc.)
  - Quest relevance (side_quest/quest_adjacent/quest_advancing)

#### Adventure Execution & Rewards
- **Time-based resolution**: Adventures complete after elapsed real-world time
- **Success determination**: Based on risk level, party composition, and companion participation
- **Party synergy calculations**: All 13 D&D classes integrated with role-based bonuses
- **Transparent odds display**: See breakdown of success factors before starting
- **Rewards system**:
  - Experience points (scaled by risk and duration)
  - Gold rewards (scaling with level and risk)
  - Loot generation (20% chance on high-risk)
  - HP restoration on success
- **Consequences on failure**:
  - HP loss
  - Gold loss (percentage-based)
  - Debuffs with duration
- **Story thread creation**: Adventures auto-generate plot hooks and consequences

#### Party Synergy System
- **Class roles defined** for all 13 D&D classes:
  - Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard, Artificer
- **Activity-specific synergies**: Different activities benefit from different class combinations
  - Combat, Stealth, Social, Exploration, Arcane, Investigation, Survival, etc.
- **Required vs beneficial roles**: Some activities require certain roles, others just benefit from them
- **Success chance modifiers**: +5% to +15% bonuses for good party composition

---

### 4. Companion System

#### Companion Management
- **Recruitment**: NPCs can be recruited as companions
- **Progression types**:
  - **NPC stats**: Use original CR-based stats (simpler)
  - **Class-based**: Full class progression with leveling (advanced)
- **Companion leveling**: Class-based companions can gain levels
- **Companion HP**: Calculated from class, level, and CON modifier
- **Companion inventory**: Separate inventory and gold tracking
- **Companion skills**: Proficiency tracking
- **Companion spellcasting**: Cantrips and spells known

#### Companion Traits & Details
- Personality traits (trait_1, trait_2)
- Voice and mannerism descriptions
- Motivation and fears
- Alignment, faith, lifestyle
- Ideals, bonds, flaws
- Bonds to party members
- Background and history
- Armor class and speed
- Ability scores (full 6-ability tracking)

#### Party Member Creation
- **Create from scratch**: Build new NPCs as party members directly
- **Appearance customization**: Full physical descriptions
- **Personality system**: Motivation, fears, secrets
- **Starting equipment**: Define equipment and starting gold
- **Class selection**: Choose class and level at creation

#### Companion Status Management
- **Active**: Currently in the party
- **Dismissed**: Can be re-recruited fresh
- **Deceased**: Permanently fallen
- **Campaign availability states**: Available for recruitment, party member, etc.

#### Companion Backstories (Auto-Generated)
When a companion is recruited, an AI-generated backstory is automatically created:
- **Origin story**: Where they came from, early life events
- **Formative event**: Key moment that shaped their personality
- **Unresolved threads**: Personal plot hooks (family, enemies, debts, mysteries)
- **Secrets**: Hidden information revealed at loyalty thresholds
- **Loyalty triggers**: Actions that increase or decrease their loyalty

See [Narrative Event System](#12-narrative-event-system) for details on backstory integration.

#### Adventure Participation
- **Companion participation tracking**: Specific companions can join adventures
- **Synergy bonuses**: Party composition affects success odds
- **XP distribution**:
  - Participating companions get full XP
  - Non-participating get 50% XP
  - Supports full leveling progression
- **Narrative inclusion**: Adventure narratives mention companion contributions

---

### 5. Downtime Activities

#### Activity Types Available
1. **Rest & Sleep**: Short rest (1h) and long rest (8h) with quality modifiers
2. **Pray & Meditate**: Spiritual activities with divine favor chance
3. **Train & Practice**: Combat skill improvement
4. **Study & Read**: Knowledge acquisition and lore learning
5. **Craft & Create**: Item creation and tool use
6. **Work for Hire**: Earn gold through labor
7. **Socialize**: Gather rumors, make contacts
8. **Carouse**: Tavern activities with random events
9. **Maintain Equipment**: Prevent gear degradation

#### Location-Based Activities
- **Settlement activities**: Work, socializing, training
- **Tavern activities**: Carousing, gambling
- **Wilderness activities**: Hunting, foraging, camping
- **Temple activities**: Prayer, meditation
- **Library activities**: Study, research

#### Rest Mechanics
- **Rest quality levels**: Luxurious, comfortable, adequate, poor, terrible
- **Quality modifiers**: Affect HP recovery and ability recharge
- **Rest conditions**: Location keywords determine quality
- **Hit Dice spending**: Short rest allows Hit Dice recovery
- **Spell slot restoration**: Long rest restores all slots

#### Class-Specific Work Options
Each class has 5-6 unique work options with different pay rates and benefits:

| Class | Example Work Options |
|-------|---------------------|
| Cleric | Healing, temple service, preaching, blessing goods |
| Paladin | Guard duty, militia training, mediation |
| Fighter | Guard duty, arena fighting, bounty board work |
| Rogue | Locksmith, spying, street performance, gambling |
| Wizard | Magic item identification, scroll scribing, tutoring |
| Sorcerer | Fortune telling, magical entertainment |
| Warlock | Occult readings, curse consultation |
| Bard | Tavern performance, entertainment, music lessons |
| Ranger | Wilderness guide, hunting, tracking |
| Druid | Animal healing, crop blessing, nature guidance |
| Monk | Martial arts teaching, meditation, courier service |
| Barbarian | Heavy labor, arena fighting, debt collection |
| Artificer | Repair services, crafting, magic item repair |

#### Downtime Rewards & Benefits
- **HP restoration**: Quality-dependent recovery
- **Gold earned**: Class and level scaling
- **XP gained**: Activity-dependent amounts
- **Equipment maintenance**: Prevents degradation
- **Random events**: Rumors, contacts, unusual occurrences
- **Narrative flavor**: Generate descriptive text for rest events

---

### 6. Story Thread System

#### Story Thread Types
- **new_enemy**: A new antagonist or hostile faction (high priority)
- **new_ally**: A potential ally or friendly contact
- **intel**: Valuable information discovered
- **reputation**: How others perceive you has changed
- **resource**: Access to new resources or opportunities
- **mystery**: An unanswered question or unexplained event
- **opportunity**: A time-limited chance to gain something valuable
- **threat**: A danger that will manifest if not addressed
- **relationship**: A shift in relationship with an NPC or faction

#### Thread Properties
- **Title and description**: What is the plot hook about
- **Status**: Active, resolved, expired
- **Priority**: High, normal, low
- **Quest relevance**: side_quest, quest_adjacent, quest_advancing
- **Related NPCs**: Who is involved
- **Related locations**: Where the action takes place
- **Potential outcomes**: How the thread could resolve
- **Expiration date**: When the thread becomes irrelevant
- **Resolution tracking**: How/when the thread was resolved
- **Consequence category**: new_enemy, new_ally, intel, reputation, resource

#### Quest Resolution
- **Quest-resolving threads**: Some threads can resolve current quests
- **Quest completion**: Intel or new_ally consequences on quest-advancing adventures can resolve quests
- **Multi-quest support**: Track multiple parallel quests
- **Auto-generation**: DM sessions and adventures generate threads

#### AI DM Integration
- **Context injection**: Active story threads are included in DM session prompts
- **Narrative weaving**: AI is instructed to incorporate threads into the story
- **Priority weighting**: Higher priority threads are emphasized

---

### 7. In-Game Clock

#### Time Tracking
- **Harptos calendar** tracking (Forgotten Realms standard)
  - Day, month, year
  - Season awareness
  - Time of day (morning, afternoon, evening, night)

#### Configurable Time Ratios
| Mode | In-Game Hours per Real Hour |
|------|----------------------------|
| Narrative | 12 hours |
| Normal | 6 hours |
| Action-packed | 1 hour |
| Slow | 2 hours |

#### Time Advancement
- **Adventures**: Time advances based on adventure duration
- **Downtime**: Activities advance time appropriately
- **DM sessions**: Sessions advance in-game time
- **Manual skips**: Advance time for montages or time jumps

---

### 8. Campaign Continuity

#### Auto-Generated Campaign Notes
- **Session summaries**: Key moments extracted from conversations
- **NPC memory**: Important NPCs and interactions recorded
- **Item tracking**: Notable acquisitions and trades recorded
- **Promise tracking**: Obligations and deals recorded
- **Key events**: Major narrative moments summarized

#### Player-Editable Notes
- **"My Notes" section**: Persists across regenerations
- **Player annotations**: Add personal campaign notes
- **Session observations**: Record important details

---

### 9. Campaign Management

#### Campaign Creation & Configuration
- **Campaign properties**:
  - Name and description
  - Setting (e.g., Forgotten Realms, Eberron, homebrew)
  - Tone (heroic fantasy, dark, comedic, gritty)
  - Starting location for new characters
  - Status tracking (active, paused, completed)
  - Time ratio configuration (how fast in-game time passes)

#### Campaign Statistics
- Track total quests, locations, characters per campaign
- Aggregate narrative data across sessions
- Campaign-wide event history

---

### 10. Quest System

#### Multi-Stage Quest Architecture
- **Quest types**:
  - **Main Quests**: 5-stage epic storylines with antagonists and world-changing stakes
  - **Side Quests**: 2-3 stage focused storylines with local impact
  - **One-Time Quests**: Single-objective tasks (bounty, rescue, delivery, retrieval)
  - **Companion Quests**: Personal quests tied to companion backstory threads

#### Quest Properties
- Title, premise, and detailed description
- Quest giver NPC and target/antagonist tracking
- Location associations
- Urgency level (leisure, normal, pressing, urgent, critical)
- Reward tiers (gold, XP, items, reputation)
- Expiration dates for time-sensitive quests
- Tags for categorization and matching

#### Quest Stages
- Sequential stages with names and descriptions
- Each stage has abstract requirements that can be satisfied multiple ways
- Stage completion unlocks the next stage
- Final stage completion resolves the quest

#### Abstract Requirement System
Requirements are **abstract** - they describe what needs to happen, not exactly how:

| Requirement Type | Description | Example |
|------------------|-------------|---------|
| `adventure_completed` | Complete adventures with certain tags | "Complete an investigation adventure" |
| `location_visited` | Visit a specific type of location | "Visit a dungeon" |
| `location_discovered` | Discover a new location | "Find the hidden temple" |
| `npc_interaction` | Interact with specific NPC types | "Speak with a merchant" |
| `item_obtained` | Acquire items with certain tags | "Obtain a magical weapon" |
| `story_thread_resolved` | Resolve a story thread | "Deal with the bandit threat" |
| `companion_recruited` | Recruit a companion | "Find an ally" |
| `gold_spent` | Spend gold on something | "Invest 500 gold" |
| `time_passed` | Wait for time to pass | "Let a week pass" |
| `custom` | Flexible custom conditions | DM discretion |

#### Quest Progress Checking
- **Event-driven progress**: Game events automatically check quest requirements
- **Partial completion**: Requirements track individual completion status
- **Multiple paths**: Same requirement can be satisfied different ways
- **Automatic advancement**: Stage advances when all requirements met

---

### 11. Location System

#### Location Types
- **Cities**: Major settlements with services and NPCs
- **Towns/Villages**: Smaller settlements
- **Dungeons**: Adventure sites with encounters
- **Ruins**: Ancient locations with mysteries
- **Temples/Shrines**: Religious sites
- **Wilderness**: Forests, mountains, plains
- **Fortresses/Castles**: Strongholds
- **Caves/Mines**: Underground locations

#### Location Properties
- Name and detailed description
- Location type and region
- Danger level (1-10 scale)
- Discovery status (unknown, rumored, discovered, visited, explored)
- Visit tracking (times visited, last visit date)
- Associated NPCs (who can be found here)
- Tags for matching and categorization
- Coordinates for mapping (optional)

#### Location Connections
- **Travel routes** between locations
- Connection properties:
  - Distance and travel time
  - Danger level of the route
  - Route type (road, trail, river, teleportation)
  - Requirements (e.g., boat needed, password required)
- Bidirectional or one-way connections
- Discoverable shortcuts

#### Location Discovery Flow
1. Location starts as "unknown"
2. Can become "rumored" through intel
3. Visiting changes to "discovered" then "visited"
4. Full exploration changes to "explored"
5. Dangerous locations (level 3+) auto-generate one-time quests when discovered

---

### 12. Narrative Event System

#### Central Event Bus
A pub/sub event system that connects all game systems:

```
Game Action → Event Emitted → Listeners Triggered → Consequences Applied
```

#### Supported Game Events

| Event | Trigger | Consequences |
|-------|---------|--------------|
| `adventure_complete` | Adventure finishes | Check quest progress, companion triggers |
| `adventure_started` | Adventure begins | Update character state |
| `location_discovered` | New location found | Create quests, update maps |
| `location_visited` | Location entered | Track visits, trigger events |
| `story_thread_created` | Plot hook generated | Add to narrative queue |
| `story_thread_resolved` | Thread concluded | Check quest progress, update reputation |
| `quest_stage_advanced` | Quest progresses | Notify player, unlock content |
| `quest_completed` | Quest finished | Grant rewards, update world state |
| `companion_recruited` | NPC joins party | Generate backstory, add to queue |
| `companion_dismissed` | NPC leaves party | Update availability |
| `companion_loyalty_changed` | Loyalty shifts | Check secret reveals |
| `npc_interaction` | Talk to NPC | Check quest requirements |
| `item_obtained` | Get new item | Check quest requirements |
| `game_time_advanced` | Time passes | Check expirations, trigger events |
| `dm_session_started` | DM session begins | Load narrative context |
| `dm_session_ended` | DM session ends | Process outcomes |

#### Narrative Queue
A queue of story events waiting to be delivered to the player during DM sessions:

- **Event types**: Quest progress, companion reactions, world changes, warnings
- **Priority levels**: Urgent, high, normal, low, flavor
- **Delivery tracking**: Items marked as delivered after DM mentions them
- **AI context formatting**: Queue items formatted for DM system prompt
- **Session integration**: DM is instructed to weave queue items into narrative

#### Companion Backstory System

**Backstory Components**:
- **Origin**: Where they came from, their early life
- **Formative Event**: Key moment that shaped who they are
- **Motivation**: What drives them now
- **Personality Summary**: Core traits and tendencies

**Unresolved Threads**:
Personal plot hooks that can activate during play:
- Thread types: family, enemy, debt, romance, mystery, vengeance, redemption
- Status: dormant, active, resolved
- Intensity level (1-10)
- Activation triggers (location visits, NPC encounters, events)

**Secrets**:
Hidden information revealed at loyalty thresholds:
- Categories: shameful, dangerous, valuable, tragic, hopeful
- Loyalty threshold required for reveal
- Impact on relationship when revealed

**Loyalty Triggers**:
Actions that increase or decrease companion loyalty:
- Positive triggers (rescue them, support their goals, etc.)
- Negative triggers (betray trust, oppose their values, etc.)

---

### 14. Faction System

#### Faction UI (FactionsPage Component)
Access via the "Factions" button in the header when a character is selected:

**Faction List Panel**:
- View all factions in the current campaign
- See your standing with each faction at a glance
- Color-coded standing indicators (Hated → Exalted)
- Scope badges (local/regional/continental/global)
- Create new factions for your campaign

**Faction Detail Panel**:
- View detailed faction information (stats, alignment, description)
- See active faction goals with progress tracking
- View notable faction members
- Join or leave factions with membership tracking

#### Faction Management
Track organizations that pursue their own goals and interact with the world:

- **Faction properties**:
  - Identity: Name, description, symbol, motto
  - Scope: Local, regional, continental, global
  - Power level (1-10 scale)
  - Influence areas and territory
  - Headquarters location
  - Leadership structure and leader NPC
  - Resources: wealth, military, political, magical, information network

#### Faction Values & Methods
- **Alignment**: Faction's moral alignment
- **Primary values**: What the faction believes in
- **Typical methods**: How they achieve their goals
- **Recruitment requirements**: What it takes to join
- **Membership benefits**: What members receive

#### Faction Goals
Factions actively pursue objectives that can affect the world:

| Property | Description |
|----------|-------------|
| Goal type | Expansion, defense, economic, political, military, covert |
| Progress tracking | 0-100 progress with milestones |
| Urgency level | Critical, high, normal, low |
| Stakes level | Minor, moderate, major, catastrophic |
| Visibility | Public, rumored, secret |
| Targets | Can target locations, factions, NPCs, or characters |
| Consequences | Success and failure outcomes defined |

#### Faction Standings
Track character relationships with factions:

- **Standing levels**: Enemy → Hated → Hostile → Unfriendly → Neutral → Friendly → Honored → Revered → Exalted
- **Standing ranges**: -100 to +100
- **Deed tracking**: Separate lists for deeds for and against the faction
- **Membership system**: Join factions with membership levels
- **Knowledge tracking**: Track known members, known goals, known secrets
- **Quest completion**: Track quests completed for the faction

#### Faction Relationships
- Factions can have relationships with other factions (-100 to +100)
- Relationship status affects world events and opportunities
- Player actions can shift faction relationships

#### Tick Processing
- Faction goals automatically advance over game time
- Progress based on faction power level and goal urgency
- Goals complete when progress reaches maximum
- Completed goals trigger consequences

---

### 15. World Events System

#### World Events UI (WorldEventsPage Component)
Access via the "Events" button in the header when a character is selected:

**Event List Panel**:
- View all world events in the current campaign
- Filter by: Active, All, or Resolved events
- Event type icons with color-coding
- Scope, status, and visibility badges
- Stage progress bars for multi-stage events
- Create new world events

**Event Detail Panel**:
- View detailed event information
- Stage progression with current stage highlighted
- Advance Stage and Resolve Event actions
- Possible outcomes and player intervention options
- Active effects from the event

#### World Event Types
Significant events that affect the game world:

| Event Type | Description |
|------------|-------------|
| Political | Power shifts, treaties, conflicts |
| Economic | Trade routes, market crashes, prosperity |
| Military | Wars, invasions, military campaigns |
| Natural | Disasters, plagues, celestial events |
| Magical | Wild magic surges, planar incursions |
| Religious | Divine interventions, cult activities |
| Social | Festivals, riots, migrations |
| Conspiracy | Hidden plots affecting the world |
| Threat | Monsters, villains, external dangers |

#### Multi-Stage Events
Events progress through stages over time:

- **Stage tracking**: Events have defined stages with descriptions
- **Duration**: Expected duration in game days
- **Deadline**: Time-sensitive events have deadlines
- **Automatic progression**: Events advance based on elapsed time

#### Event Scope & Impact
- **Scope levels**: Local, regional, continental, global
- **Affected locations**: Which locations feel the impact
- **Affected factions**: Which factions are involved
- **Triggered by**: Can be triggered by factions, characters, or other events
- **Chain reactions**: Events can spawn new events

#### Event Visibility
- **Public events**: Everyone knows about them
- **Rumored events**: Whispers and hints
- **Secret events**: Must be discovered
- **Character discovery**: Characters can uncover hidden events

#### Event Outcomes
- **Possible outcomes**: List of ways events can resolve
- **Player intervention options**: Ways characters can affect the event
- **Outcome description**: What happened when the event concluded

#### Event Effects
Specific effects that events create:

| Effect Type | Description |
|-------------|-------------|
| Price modifier | Affects goods prices at locations |
| Danger modifier | Changes location danger levels |
| Access restriction | Blocks travel or entry |
| Resource change | Affects faction or location resources |
| NPC status | Changes NPC availability or disposition |
| Custom | Flexible effect with parameters |

**Effect Properties**:
- Target type and ID (location, faction, character, etc.)
- Parameters (JSON for flexible configuration)
- Duration and expiration
- Can be reversed with reason tracking

#### Tick Processing
- Events automatically progress through stages
- Deadlines are enforced (events resolve when deadline passes)
- Effects are automatically expired when their time is up

---

### 16. Travel System

#### Journey Management
Track travel between locations with full journey mechanics:

- **Journey properties**:
  - Origin and destination locations
  - Travel method (walking, riding, ship, flying, etc.)
  - Route type (road, trail, wilderness, mountain, sea, etc.)
  - Distance and estimated travel time
  - Traveling companions
  - Game time tracking (start day/hour)

#### Travel Methods & Speeds

| Travel Method | Miles per Hour | Notes |
|---------------|----------------|-------|
| Walking | 3 mph | Standard travel |
| Forced March | 4 mph | Exhausting pace |
| Riding | 6 mph | Horseback |
| Fast Riding | 8 mph | Galloping |
| Carriage | 4 mph | Comfortable but slow |
| Boat | 5 mph | River/lake travel |
| Ship | 8 mph | Sea travel |
| Flying | 10 mph | Magical flight |
| Teleportation | Instant | Magical transport |

#### Route Modifiers

| Route Type | Time Multiplier | Description |
|------------|-----------------|-------------|
| Road | 1.0x | Well-maintained paths |
| Trail | 1.3x | Cleared but rough |
| Wilderness | 2.0x | No path, difficult terrain |
| Mountain | 2.5x | Steep and treacherous |
| Swamp | 3.0x | Most difficult terrain |
| Desert | 1.8x | Open but harsh |
| River/Sea | 1.0x | Water travel |
| Underground | 2.0x | Caves and tunnels |

#### Journey Encounters
Random encounters that occur during travel:

| Encounter Type | Description | Danger Range |
|----------------|-------------|--------------|
| Combat | Hostile creatures or bandits | 3-8 |
| Creature | Wildlife encounters | 2-6 |
| Travelers | Fellow travelers on the road | 1-3 |
| Merchant | Trading caravans | 1-2 |
| Weather | Storms, extreme conditions | 2-5 |
| Obstacle | Blocked roads, collapsed bridges | 2-4 |
| Discovery | Hidden locations, treasure | 1-3 |
| Omen | Strange signs, portents | 1-2 |

**Encounter Properties**:
- Type and danger level
- Challenge type (combat, social, survival, exploration, arcane)
- Approach chosen (fight, negotiate, flee, sneak)
- Outcome (victory, defeat, avoided, escaped)
- Consequences (HP change, gold, items, time lost)
- Can create story threads

#### Resource Consumption
- **Rations tracking**: Party size × travel days
- **Gold spent**: Travel costs for transport
- **Time management**: Hours into journey tracking

#### Journey Outcomes
- **Completed**: Arrived at destination successfully
- **Aborted**: Journey cancelled, returned or stranded
- **Encounter stats**: Track encounters faced vs avoided

#### NPC Relationship Enhancements
Enhanced relationship tracking with NPCs:

**Rumor System**:
- Track rumors heard about NPCs
- Rumors can be believed or disproven
- Affects how character perceives NPC

**Promise System**:
- Track promises made to/by NPCs
- Status: pending, fulfilled, broken
- Breaking promises damages reputation (-15 disposition)
- Fulfilling promises improves standing (+10 disposition)

**Debt System**:
- Track debts owed to/by NPCs
- Types: gold, favor, life_debt, service
- Status: outstanding, settled, forgiven
- Settling debts improves relations (+10 disposition)
- Being forgiven a debt creates gratitude (+5 disposition)

#### Travel UI (TravelPage Component)

The TravelPage provides a comprehensive interface for managing journeys:

**Left Panel - Journey Management**:
- Journey list with filter tabs (Active/Completed/All)
- Journey cards showing:
  - Route (origin → destination)
  - Status badges with color coding
  - Traveler name, distance, travel method
  - Progress bar for active journeys
- New journey form:
  - Character, origin, and destination selection
  - Distance and danger level inputs
  - Travel method and route type dropdowns
  - Starting rations and gold settings

**Travel Calculator**:
- Quick estimation without starting a journey
- Inputs: distance, party size, travel method, route type
- Outputs: estimated hours/days, rations needed, gold cost

**Right Panel - Journey Details**:
- Complete route and traveler information
- Distance, method, route type, danger level display
- Progress tracking (elapsed vs estimated hours)
- Resource display with consumption buttons:
  - -1 Ration button
  - -5 Gold button
- Action buttons:
  - Complete Journey (for active journeys)
  - Abort Journey (for active journeys)
- Outcome description (for completed journeys)

**Encounters Section**:
- Lists all encounters for the selected journey
- Encounter type icons: combat (⚔️), social (💬), environmental (🌲), discovery (🔍), rest (🏕️), merchant (💰), weather (🌧️), wildlife (🐺)
- Status badges (pending/resolved/avoided)
- Action buttons for pending encounters:
  - Fight (combat approach)
  - Negotiate (diplomacy approach)
  - Flee (stealth avoidance)

**API Integration**:
- `GET /api/travel/campaign/:campaignId` - Load journeys
- `GET /api/travel/constants` - Load travel constants
- `GET /api/travel/:journeyId/encounters` - Load encounters
- `POST /api/travel` - Start journey
- `POST /api/travel/:id/complete` - Complete journey
- `POST /api/travel/:id/abort` - Abort journey
- `POST /api/travel/:id/consume-resources` - Use resources
- `POST /api/travel/calculate/time` - Calculate travel time
- `POST /api/travel/encounter/:id/resolve` - Resolve encounter
- `POST /api/travel/encounter/:id/avoid` - Avoid encounter

#### NPC Relationships UI (NPCRelationshipsPage Component)

The NPCRelationshipsPage provides a comprehensive interface for managing NPC relationships:

**Summary Bar**:
- Quick counts of Allies, Neutral, and Hostile NPCs
- Pending promises and outstanding debts counters

**Left Panel - NPC List**:
- All NPCs the character has met
- Filter tabs: All, Allies, Neutral, Hostile
- NPC cards showing:
  - Disposition label badge (hated/hostile/unfriendly/neutral/friendly/helpful/devoted)
  - Times met and first met date
  - Disposition bar (visual -100 to +100)
  - Trust meter (10-dot display)

**Right Panel - Detail Tabs**:

*Info Tab*:
- Disposition score with adjustment buttons (+10, +5, -5, -10)
- Trust level with adjustment buttons (+1, -1)
- Stats grid: Times Met, Witnessed Deeds, Secrets Known, Pending Promises

*Promises Tab*:
- List of promises made to/by NPC
- Status badges (pending/fulfilled/broken)
- Fulfill and Break buttons for pending promises
- Fulfilling improves disposition (+10), breaking damages it (-15)

*Debts Tab*:
- Debts owed to NPC or owed by NPC
- Debt types: gold, favor, life_debt, service
- Status badges (outstanding/settled/forgiven)
- Settle Debt button for outstanding debts

*Knowledge Tab*:
- Secrets discovered (dark themed)
- Known facts (green themed)
- Rumors heard with Disprove option

**API Integration**:
- `GET /api/npc-relationship/character/:characterId` - Load relationships
- `GET /api/npc-relationship/character/:characterId/summary` - Load summary
- `GET /api/npc-relationship/character/:characterId/promises` - Load promises
- `GET /api/npc-relationship/character/:characterId/debts` - Load debts
- `POST /api/npc-relationship/:characterId/:npcId/disposition` - Adjust disposition
- `POST /api/npc-relationship/:characterId/:npcId/trust` - Adjust trust
- `POST /api/npc-relationship/:characterId/:npcId/promise/:index/fulfill` - Fulfill promise
- `POST /api/npc-relationship/:characterId/:npcId/promise/:index/break` - Break promise
- `POST /api/npc-relationship/:characterId/:npcId/debt/:index/settle` - Settle debt
- `POST /api/npc-relationship/:characterId/:npcId/rumor/:index/disprove` - Disprove rumor

#### Living World UI (LivingWorldPage Component)

The LivingWorldPage provides a comprehensive dashboard for managing the living world simulation:

**Summary Cards**:
- Active Factions, Active Goals, Active Events, Active Effects counts

**Left Panel - World Controls**:

*Advance Time*:
- Process 1-7 days of world progression
- Shows: goals processed, events spawned, effects expired

*Simulate Time Skip*:
- Simulate 1-30 days for "what if" scenarios
- Summary: goals advanced/completed, events spawned, effects expired

*AI Content Generation*:
- Generate faction goals (select faction, auto-create)
- Generate world events (optional type filter, auto-create)
- Results display for generated content

**Right Panel - World State with Tabs**:

*Overview Tab*:
- Character's visible world view statistics
- Recent activity log (goals, events)

*Factions Tab*:
- All factions with power levels
- Active goal counts and progress bars

*Events Tab*:
- All events with type color-coding
- Stage progress and status

*Effects Tab*:
- All active effects with targets
- Expiration dates

**API Integration**:
- `GET /api/living-world/state/:campaignId` - Load world state
- `GET /api/living-world/character-view/:characterId` - Load character view
- `POST /api/living-world/tick/:campaignId` - Process tick
- `POST /api/living-world/simulate/:campaignId` - Simulate days
- `POST /api/living-world/generate/faction-goal/:factionId` - Generate goal
- `POST /api/living-world/generate/world-event/:campaignId` - Generate event

#### Campaign Management UI (CampaignsPage Component)

The CampaignsPage provides a comprehensive interface for managing campaigns:

**Left Panel - Campaign List**:
- All campaigns with filter tabs (Active/Archived/All)
- Campaign cards showing:
  - Name and description
  - Setting and tone badges
  - Status (active/archived)
  - Character count
- New campaign form:
  - Name and description
  - Setting selection (Forgotten Realms, Eberron, Homebrew, etc.)
  - Tone selection (Heroic Fantasy, Dark Fantasy, etc.)
  - Starting location input
  - Time ratio slider (1-12 hours per real hour)

**Right Panel - Campaign Details**:
- Full campaign information display
- Stats grid: Characters, Quests, Locations
- Starting location
- Character assignment section:
  - List of assigned characters with remove option
  - Dropdown to assign new characters
- Archive campaign action

**API Integration**:
- `GET /api/campaign` - Load campaigns
- `GET /api/campaign/:id/stats` - Load statistics
- `GET /api/campaign/:id/characters` - Load assigned characters
- `GET /api/character` - Load all characters
- `POST /api/campaign` - Create campaign
- `POST /api/campaign/:id/archive` - Archive campaign
- `POST /api/campaign/:id/assign-character` - Assign character
- `DELETE /api/campaign/:campaignId/character/:characterId` - Remove character

#### Quest Tracker UI (QuestsPage Component)

The QuestsPage provides a comprehensive interface for tracking quests:

**Left Panel - Quest List**:
- All quests with filter tabs (Active/Completed/Failed/All)
- Quest cards showing:
  - Quest type icons (Main 👑, Side 📜, Companion 👤, One-Time ⚡)
  - Type, status, and priority badges
  - Stage progress (Stage X of Y)
  - Progress bar for active quests

**Right Panel - Quest Details with Tabs**:

*Info Tab*:
- Quest metadata (type, status, priority)
- Premise/description block
- Antagonist info (if applicable)
- Deadline warning for time-sensitive quests
- Actions: Advance Stage, Complete Quest, Fail Quest, Abandon

*Stages Tab*:
- Visual stage progression with color indicators
- Current stage highlighted in blue
- Completed stages in green
- Requirements for each stage with checkboxes
- Click to manually complete requirements

*Rewards Tab*:
- XP, Gold, Items, Reputation rewards
- World impact on completion
- Escalation consequences if ignored

**API Integration**:
- `GET /api/quest/character/:characterId` - Load quests
- `GET /api/quest/:questId/requirements` - Load requirements
- `POST /api/quest/:id/advance` - Advance stage
- `POST /api/quest/:id/complete` - Complete quest
- `POST /api/quest/:id/fail` - Fail quest
- `POST /api/quest/:id/abandon` - Abandon quest
- `POST /api/quest/requirement/:id/complete` - Complete requirement

#### Locations UI (LocationsPage Component)

The LocationsPage provides a comprehensive interface for managing locations:

**Left Panel - Location List**:
- All locations with search box
- Filter tabs (All/Discovered/Visited)
- Type filter dropdown
- Location cards showing:
  - Type icons (🏙️ city, 🏘️ town, 🏚️ dungeon, etc.)
  - Danger level indicators
  - Discovery status badges
  - Region names
- Create new location form

**Right Panel - Location Details with Tabs**:

*Info Tab*:
- Type, danger level, region info
- Description block
- Services and tags lists
- Visit statistics

*Connections Tab*:
- Connected locations with travel times
- Route types (road, trail, etc.)
- Click to navigate to connected locations

*Status Tab*:
- Current discovery status
- Status update buttons
- Current state information
- "Mark as Discovered" action

**API Integration**:
- `GET /api/location/campaign/:campaignId` - Load locations
- `GET /api/location/:id/connections` - Load connections
- `POST /api/location` - Create location
- `POST /api/location/:id/discover` - Discover location
- `PUT /api/location/:id/discovery-status` - Update status

#### Companion Backstory UI (CompanionBackstoryPage Component)

The CompanionBackstoryPage provides an interface for viewing and managing companion backstories:

**Left Panel - Companion List**:
- All companions for the character
- Companion cards showing:
  - Avatar and name
  - Race and class
  - Level

**Right Panel - Backstory Details with Tabs**:

*Story Tab*:
- Personal history/summary narrative
- Origin description
- Motivation information
- Key relationships list

*Threads Tab*:
- Unresolved story threads
- Thread status icons (🔥 active, 📖 developing, ✅ resolved, ❌ abandoned)
- Status dropdown to update thread status
- Descriptions with story hooks
- Add Thread button for AI generation

*Secrets Tab*:
- Hidden secrets (blurred until revealed)
- Secret category badges
- Reveal Secret button
- Potential impact information
- Add Secret button for AI generation

**Backstory Generation**:
- Generate Backstory button when none exists
- Regenerate button to create new backstory
- Thread and secret AI generation

**API Integration**:
- `GET /api/companion/character/:characterId` - Load companions
- `GET /api/companion/:id/backstory` - Load backstory
- `POST /api/companion/:id/backstory/generate` - Generate backstory
- `POST /api/companion/:id/backstory/threads` - Add threads
- `POST /api/companion/:id/backstory/secret` - Generate secret
- `PUT /api/companion/:id/backstory/thread/:threadId` - Update thread
- `POST /api/companion/:id/backstory/secret/:secretId/reveal` - Reveal secret

#### Narrative Queue UI (NarrativeQueuePage Component)

The NarrativeQueuePage provides an interface for managing pending story events:

**Summary Bar**:
- Urgent/High/Normal counts
- Total pending items

**Left Panel - Queue List**:
- Tabs for Pending and History
- Priority filter dropdown
- Add manual item form
- Item cards showing:
  - Event type icons (⚔️ adventure, 📜 quest, 💬 companion, etc.)
  - Title and priority badges (color-coded)
  - Description preview
  - Timestamps
- Bulk "Mark All as Delivered" action

**Add Item Form**:
- Event type selection
- Priority selection (urgent/high/normal/low/flavor)
- Title and description inputs

**Right Panel - Item Details**:
- Event type and status display
- Created/delivered timestamps
- Full description and context
- Related entities (quest, location, companion, NPC)
- Actions: Mark as Delivered, Delete

**API Integration**:
- `GET /api/narrative-queue/:characterId` - Load pending items
- `GET /api/narrative-queue/:characterId/history` - Load history
- `POST /api/narrative-queue` - Add item
- `POST /api/narrative-queue/deliver` - Mark delivered
- `DELETE /api/narrative-queue/:itemId` - Delete item

#### Generation Controls UI (GenerationControlsPage Component)

The GenerationControlsPage provides a centralized interface for triggering AI content generation:

**Left Panel - Generation Categories**:
- Quest Generation
- Location Generation
- World Content
- Companion Backstories

**Main Panel - Generation Options**:

*Quest Generation*:
- Quest type selection (Main Quest, Side Quest, One-Time, Companion)
- Theme input for quest flavor
- Generate button with loading state
- Displays generated quest details on success

*Location Generation*:
- Generation type (Single, Region, Dungeon)
- Location type dropdown (city, town, dungeon, ruins, etc.)
- Danger level selector (1-10)
- Theme input
- Generate button

*World Content*:
- Faction goal generation (select faction from dropdown)
- World event generation (optional type filter)
- Generate buttons for each type

*Companion Backstories*:
- List of companions without backstories
- Generate Backstory button for each
- Shows backstory summary on success

**Right Panel - Results Display**:
- Generated content details
- Quest: title, type, premise, stages, rewards
- Location: name, type, description, danger, connections
- World content: goal/event details
- Backstory: origin, motivation, threads, secrets

**API Integration**:
- `POST /api/quest/generate/main` - Generate main quest
- `POST /api/quest/generate/side` - Generate side quest
- `POST /api/quest/generate/one-time` - Generate one-time quest
- `POST /api/quest/generate/companion/:companionId` - Generate companion quest
- `POST /api/location/generate` - Generate location
- `POST /api/location/generate/region` - Generate region
- `POST /api/location/generate/dungeon` - Generate dungeon
- `POST /api/living-world/generate/faction-goal/:factionId` - Generate faction goal
- `POST /api/living-world/generate/world-event/:campaignId` - Generate world event
- `POST /api/companion/:id/backstory/generate` - Generate backstory

---

### 17. Living World System

#### Tick Processing
The living world advances automatically when game time passes:

- **Faction Goal Advancement**: Goals progress based on faction power level and urgency
- **World Event Progression**: Events advance through stages
- **Effect Expiration**: Temporary effects expire when their duration ends
- **Deadline Enforcement**: Time-sensitive events resolve when deadlines pass

#### Automatic Event Spawning
World events are automatically created when faction goals reach milestones:

| Milestone | Event Type | Visibility |
|-----------|------------|------------|
| 25% progress | Faction makes progress | Depends on goal visibility |
| 50% progress | Faction gains momentum | At least rumored |
| 75% progress | Faction nears goal | At least rumored |
| 100% complete | Goal achieved | Public if major stakes |

#### AI Content Generation
Generate dynamic content for the living world:

**Faction Goals**:
- Match faction identity, values, and methods
- Types: expansion, defense, economic, political, military, covert, religious, magical
- Include success/failure consequences
- Player intervention hooks

**World Events**:
- Types: political, economic, military, natural, magical, religious, social, conspiracy, threat
- Multi-stage progression
- Player intervention options
- Effects on locations and factions

#### World State Queries
- **Campaign-wide state**: All factions, goals, events, effects
- **Character view**: Only what the character can see
  - Public events
  - Discovered events
  - Known faction goals
  - Faction standings

#### Time Integration
When game time advances (via adventures, downtime, or manual skips):
1. Living world tick is processed
2. Faction goals advance
3. World events progress
4. Milestone events spawn
5. Results returned to player

---

### 18. AI Content Generation

#### Quest Generator
Generates complete quests with AI (Claude primary, Ollama fallback):

- **Main Quest Generation**: Epic 5-stage storylines with antagonists
- **Side Quest Generation**: Focused 2-3 stage adventures
- **One-Time Quest Generation**: Single objectives (bounty, rescue, delivery, retrieval, exploration)
- **Companion Quest Generation**: Personal quests tied to backstory threads

Output includes:
- Quest metadata (title, premise, urgency, rewards)
- Stage definitions with names and descriptions
- Abstract requirements for each stage
- Related NPCs and locations

#### Location Generator
Generates detailed locations for the game world:

- **Region Generation**: Create multiple thematically-linked locations
- **Single Location Generation**: Detailed location with NPCs and adventure hooks
- **Dungeon Generation**: Adventure sites with hazards, inhabitants, treasure
- **Connection Generation**: Travel routes between locations

Output includes:
- Location details (name, type, description, danger level)
- Notable NPCs present
- Adventure hooks and secrets
- Connected locations and travel routes

#### Companion Backstory Generator
Generates rich backstories for recruited companions:

- **Full Backstory Generation**: Origin, formative event, motivation, personality
- **Thread Generation**: Create additional unresolved threads
- **Secret Generation**: Generate specific secret types

Output includes:
- Complete life history
- 2-4 unresolved threads with activation triggers
- 1-2 secrets with loyalty thresholds
- Loyalty triggers (positive and negative)

---

## Technical Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React (Vite) |
| Backend | Express.js |
| Database | SQLite / Turso (cloud) |
| AI Providers | Claude API, Ollama (local) |
| Deployment | Works offline with Ollama only |

### Frontend Navigation

The application uses a **dropdown-based navigation system** that organizes 18+ features into 4 logical categories:

| Category | Features |
|----------|----------|
| **Character** | Character Sheet, Companions, Downtime, Settings |
| **World** | Factions, World Events, Travel, Locations, Living World, NPC Generator, Relationships |
| **Story** | Campaigns, Quests, Backstories, Narrative Queue |
| **Play** | AI Dungeon Master, Campaign Stats, Generate Content |

**Navigation Components**:
- `NavigationMenu.jsx` - Dropdown menu component with category groupings
- `App.jsx` - Single `activeView` state manages which page is displayed
- Home button appears when viewing any sub-page

**State Management**:
- Uses React's `useState` for simple boolean navigation
- Single `activeView` state replaces multiple `show*` boolean flags
- `navigateTo(view)` and `goHome()` helper functions for clean navigation

### Error Handling

The API uses a standardized error response utility (`server/utils/errorHandler.js`):

| Function | Purpose | HTTP Status |
|----------|---------|-------------|
| `handleServerError(res, error, context)` | Log and return server errors | 500 |
| `notFound(res, resource)` | Resource not found | 404 |
| `validationError(res, message)` | Validation failures | 400 |

**Error Codes**: `NOT_FOUND`, `VALIDATION_ERROR`, `DATABASE_ERROR`, `INTERNAL_ERROR`, `CONFLICT`

### Database Tables

**Core Tables**:
- **characters**: Full character data with 50+ columns
- **adventures**: Adventure instances and results
- **dm_sessions**: Text adventure sessions
- **downtime**: Downtime activity logs
- **companions**: Recruited NPC companions
- **npcs**: NPC database
- **story_threads**: Plot hooks and campaign consequences
- **activity_queue**: Scheduled activities for meta game
- **adventure_options**: Cache for generated adventures

**Narrative System Tables**:
- **campaigns**: Campaign configuration and settings
- **quests**: Quest definitions with metadata
- **quest_stages**: Sequential stages within quests
- **quest_requirements**: Abstract requirements for stages
- **locations**: Detailed location data
- **location_connections**: Travel routes between locations
- **companion_backstories**: Rich backstory data for companions
- **narrative_queue**: Story events awaiting delivery to DM sessions

**Expansion System Tables**:
- **factions**: Organizations with identity, power, resources, values
- **faction_goals**: Goals factions pursue with progress tracking
- **faction_standings**: Character standings with factions
- **world_events**: Multi-stage events affecting the world
- **event_effects**: Specific effects from world events
- **journeys**: Travel between locations with companions and resources
- **journey_encounters**: Encounters during travel with outcomes

### API Routes

**Core Routes**:
- `/api/character` - Character CRUD and progression
- `/api/adventure` - Meta adventure system
- `/api/dm-session` - AI DM sessions
- `/api/downtime` - Downtime activities
- `/api/companion` - Companion management
- `/api/npc` - NPC database
- `/api/meta-game` - Campaign context and time management
- `/api/story-threads` - Story thread CRUD
- `/api/upload` - File uploads (avatars)

**Narrative System Routes**:
- `/api/campaign` - Campaign CRUD and statistics
- `/api/quest` - Quest management, stages, and requirements
- `/api/location` - Location CRUD, discovery, and connections
- `/api/narrative-queue` - Narrative queue management

**Expansion System Routes**:
- `/api/faction` - Faction CRUD, goals, standings, and tick processing
- `/api/world-event` - World event CRUD, effects, and tick processing
- `/api/travel` - Journey management, encounters, and travel calculations
- `/api/npc-relationship` - NPC relationships, rumors, promises, and debts
- `/api/living-world` - Living world tick, state queries, AI generation, simulation

---

## Key User Flows

### Flow 1: Meta Adventure Loop
```
Create character → Generate adventures → Start adventure → Wait for completion → Claim rewards → Story threads created
```

### Flow 2: Interactive DM Session
```
Start DM session → Interactive roleplay → Session ends → Claim rewards → Campaign notes updated
```

### Flow 3: Downtime Management
```
Do downtime → Advance time → Events feed into next DM session
```

### Flow 4: Party Building
```
Recruit companion → Include in adventures → Party synergy improves odds → Companion levels up
```

### Flow 5: Quest Progression (Enhanced)
```
Quest generated → Requirements defined abstractly → Game events check progress → Stage advances when requirements met → Final stage completes quest → Rewards granted
```

### Flow 6: Location Discovery
```
Location rumored → Character visits area → Location discovered → One-time quest generated (if dangerous) → Exploration unlocks secrets
```

### Flow 7: Companion Backstory Integration
```
Recruit companion → Backstory auto-generated → Threads dormant → Trigger conditions met → Thread activates → Added to narrative queue → DM weaves into session
```

### Flow 8: Narrative Queue Delivery
```
Game event occurs → Event added to narrative queue → DM session starts → Queue formatted for AI context → DM incorporates into narrative → Items marked delivered
```

### Flow 9: Faction Reputation
```
Help/hinder faction → Standing modified → Deeds recorded → Standing label updates → At high standing, join faction → Unlock faction benefits
```

### Flow 10: Faction Goal Discovery
```
Faction pursues goal secretly → Character investigates → Goal discovered → Added to character's known goals → Can help or hinder → Goal progress affects world
```

### Flow 11: World Event Progression
```
Event triggered → Starts at stage 0 → Time passes → Stage advances → Effects applied → Event resolves → Outcome affects world state
```

### Flow 12: Living World Tick
```
Game time advances → Faction tick processed → Goals progress → World event tick processed → Events advance stages → Effects expire → World state updated
```

### Flow 13: Journey Travel
```
Start journey → Travel time calculated → Encounter checks made → Encounters resolved or avoided → Resources consumed → Journey completes → Arrive at destination
```

### Flow 14: NPC Promise/Debt
```
Make promise to NPC → Promise tracked → Fulfill or break promise → Disposition updated → Relationship affected → Future interactions impacted
```

---

## Summary

This is a **solo D&D campaign manager** that lets you play asynchronously:

1. **Start an adventure** and come back later when it's done
2. **Dive into interactive AI DM sessions** when you have time for deeper roleplay
3. **Manage downtime** between adventures with class-specific activities
4. **Build a party** of companions who contribute to your success
5. **Track persistent story consequences** that carry across sessions
6. **Progress through multi-stage quests** with abstract requirements satisfied by gameplay
7. **Explore a living world** with discoverable locations and travel connections
8. **Experience companion depth** through AI-generated backstories, secrets, and personal plot threads
9. **Engage with factions** that pursue their own goals and react to your actions
10. **Witness world events** that progress over time and shape the campaign
11. **Travel between locations** with realistic journey mechanics, encounters, and resource management
12. **Build NPC relationships** with tracked rumors, promises, and debts

The system seamlessly integrates structured meta-game mechanics (adventures, downtime, rewards) with freeform AI-powered narrative sessions. An **event-driven narrative system** connects all game actions to consequences, automatically checking quest progress, activating companion storylines, and queuing story events for delivery during DM sessions.

**Living World Systems** enable factions to pursue goals over time and world events to unfold and affect locations, creating a dynamic game world that evolves even when the player isn't actively engaged. Tick processing advances faction goals and world events based on game time passage, automatically spawning new events when factions reach significant milestones. **Travel mechanics** make journeys meaningful with encounter chances, resource consumption, and multiple travel methods. **NPC relationship tracking** adds depth through rumors, promises, and debts that affect how characters interact with the world.

AI generators (Claude primary, Ollama fallback) create quests, locations, and companion backstories on demand, ensuring fresh content while maintaining narrative coherence across the campaign.
