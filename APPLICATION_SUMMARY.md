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
10. [Technical Architecture](#technical-architecture)
11. [Key User Flows](#key-user-flows)

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

## Technical Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React (Vite) |
| Backend | Express.js |
| Database | SQLite / Turso (cloud) |
| AI Providers | Claude API, Ollama (local) |
| Deployment | Works offline with Ollama only |

### Database Tables
- **characters**: Full character data with 50+ columns
- **adventures**: Adventure instances and results
- **dm_sessions**: Text adventure sessions
- **downtime**: Downtime activity logs
- **companions**: Recruited NPC companions
- **npcs**: NPC database
- **story_threads**: Plot hooks and campaign consequences
- **activity_queue**: Scheduled activities for meta game
- **adventure_options**: Cache for generated adventures

### API Routes
- `/api/character` - Character CRUD and progression
- `/api/adventure` - Meta adventure system
- `/api/dm-session` - AI DM sessions
- `/api/downtime` - Downtime activities
- `/api/companion` - Companion management
- `/api/npc` - NPC database
- `/api/meta-game` - Campaign context and time management
- `/api/story-threads` - Story thread CRUD
- `/api/upload` - File uploads (avatars)

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

### Flow 5: Quest Progression
```
Set current quest → Adventures tagged by relevance → Quest-advancing threads created → Quest can resolve through meta adventures
```

---

## Summary

This is a **solo D&D campaign manager** that lets you play asynchronously:

1. **Start an adventure** and come back later when it's done
2. **Dive into interactive AI DM sessions** when you have time for deeper roleplay
3. **Manage downtime** between adventures with class-specific activities
4. **Build a party** of companions who contribute to your success
5. **Track persistent story consequences** that carry across sessions

The system seamlessly integrates structured meta-game mechanics (adventures, downtime, rewards) with freeform AI-powered narrative sessions, creating a complete D&D experience for solo or small-group play.
