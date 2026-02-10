# D&D Meta Game - Implementation Progress

**Started:** 2026-02-04
**Status:** Active development

---

## Overview

Building a comprehensive AI-powered solo D&D campaign management system. Development follows a foundation-first approach: database tables → CRUD services → event system → AI generators → frontend UI → UX streamlining.

---

## Phase A: Database Tables

### Status: COMPLETE

### Tables Created

| Table | Status | Notes |
|-------|--------|-------|
| `campaigns` | **Done** | Groups characters, quests, locations together |
| `locations` | **Done** | First-class location entities with properties, services, discovery state |
| `quests` | **Done** | Unified quest system (main/side/companion/one-time) with stages |
| `quest_requirements` | **Done** | Individual requirements for quest stages with type-based matching |
| `npc_relationships` | **Done** | Track disposition, trust, history, promises, debts |
| `companion_backstories` | **Done** | Origin, threads, loyalty, secrets |
| `narrative_queue` | **Done** | Pending narrative events for delivery in DM sessions |

### Migrations Added

| Table | Column | Purpose |
|-------|--------|---------|
| `characters` | `campaign_id` | Link characters to campaigns |
| `characters` | `current_location_id` | Link to locations table (alongside text field) |
| `adventures` | `location_id` | Link to locations table |
| `adventures` | `tags` | Tags for quest requirement matching |

### Indexes Created

- `idx_locations_campaign`, `idx_locations_type`, `idx_locations_discovery`
- `idx_quests_campaign`, `idx_quests_character`, `idx_quests_status`, `idx_quests_type`
- `idx_quest_req_quest`, `idx_quest_req_status`
- `idx_npc_rel_character`, `idx_npc_rel_disposition`
- `idx_companion_backstory`
- `idx_narrative_queue_campaign`, `idx_narrative_queue_priority`, `idx_narrative_queue_character`

---

## Phase B: CRUD Services & Routes

### Status: COMPLETE

### Services Created

| Service | File | Status |
|---------|------|--------|
| Campaign Service | `server/services/campaignService.js` | **Done** |
| Location Service | `server/services/locationService.js` | **Done** |
| Quest Service | `server/services/questService.js` | **Done** |
| NPC Relationship Service | `server/services/npcRelationshipService.js` | **Done** |
| Companion Backstory Service | `server/services/companionBackstoryService.js` | **Done** |
| Narrative Queue Service | `server/services/narrativeQueueService.js` | **Done** |

### Routes Created

| Route File | Endpoints | Status |
|------------|-----------|--------|
| `server/routes/campaign.js` | CRUD for campaigns | **Done** |
| `server/routes/location.js` | CRUD for locations | **Done** |
| `server/routes/quest.js` | CRUD for quests + requirements | **Done** |

### API Endpoints Added

**Campaign (`/api/campaign`)**
- `GET /` - List all campaigns
- `GET /active` - List active campaigns
- `GET /:id` - Get campaign by ID
- `GET /:id/stats` - Get campaign statistics
- `GET /:id/characters` - Get characters in campaign
- `POST /` - Create campaign
- `PUT /:id` - Update campaign
- `POST /:id/archive` - Archive campaign
- `POST /:id/assign-character` - Assign character to campaign
- `DELETE /:id` - Delete campaign

**Location (`/api/location`)**
- `GET /campaign/:campaignId` - List campaign locations
- `GET /campaign/:campaignId/discovered` - List discovered locations
- `GET /campaign/:campaignId/type/:type` - Filter by type
- `GET /campaign/:campaignId/region/:region` - Filter by region
- `GET /campaign/:campaignId/search?q=` - Search locations
- `GET /:id` - Get location by ID
- `GET /:id/children` - Get child locations
- `GET /:id/connections` - Get connected locations
- `POST /` - Create location
- `PUT /:id` - Update location
- `POST /:id/discover` - Mark as discovered
- `PUT /:id/discovery-status` - Update discovery status
- `PUT /:id/state` - Update location state
- `POST /connect` - Connect two locations
- `DELETE /:id` - Delete location

**Quest (`/api/quest`)**
- `GET /character/:characterId` - List character quests
- `GET /character/:characterId/active` - List active quests
- `GET /character/:characterId/main` - Get main quest
- `GET /character/:characterId/type/:type` - Filter by type
- `GET /campaign/:campaignId` - List campaign quests
- `GET /:id` - Get quest by ID
- `GET /:id/full` - Get quest with requirements
- `POST /` - Create quest
- `PUT /:id` - Update quest
- `POST /:id/advance` - Advance to next stage
- `POST /:id/complete` - Complete quest
- `POST /:id/fail` - Fail quest
- `POST /:id/abandon` - Abandon quest
- `DELETE /:id` - Delete quest
- `GET /:questId/requirements` - List requirements
- `GET /:questId/requirements/stage/:stageIndex` - Requirements for stage
- `GET /:questId/requirements/incomplete` - Incomplete requirements
- `POST /:questId/requirements` - Add requirement
- `POST /:questId/requirements/bulk` - Add multiple requirements
- `PUT /requirement/:id` - Update requirement
- `POST /requirement/:id/complete` - Complete requirement
- `DELETE /requirement/:id` - Delete requirement
- `GET /:questId/stage-complete` - Check if stage is complete

---

## Phase C: Event System

### Status: COMPLETE

### Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| Event Types | `server/config/eventTypes.js` | Define all event types & constants | **Done** |
| Event Emitter | `server/services/eventEmitter.js` | Central event bus | **Done** |
| Quest Progress Checker | `server/services/questProgressChecker.js` | Check requirements on events | **Done** |
| Companion Trigger Checker | `server/services/companionTriggerChecker.js` | Activate backstory threads | **Done** |
| Narrative Systems Init | `server/services/narrativeSystemsInit.js` | Initialize all handlers on startup | **Done** |

### Event Types Supported

**Game Events (30+):**
- Adventure: `adventure_started`, `adventure_complete`, `adventure_failed`, `adventure_cancelled`
- Story Threads: `story_thread_created`, `story_thread_resolved`, `story_thread_expired`
- Locations: `location_discovered`, `location_visited`, `location_state_changed`
- NPCs: `npc_interaction`, `npc_disposition_changed`, `npc_trust_changed`, `npc_secret_discovered`, `npc_promise_made/fulfilled/broken`
- Items: `item_obtained`, `item_lost`, `item_used`
- Factions: `faction_standing_changed`
- Companions: `companion_recruited`, `companion_dismissed`, `companion_deceased`, `companion_loyalty_changed`, `companion_secret_revealed`, `companion_thread_activated/resolved`
- DM Sessions: `dm_session_started`, `dm_session_ended`, `dm_session_rewards_claimed`
- Downtime: `downtime_started`, `downtime_complete`
- Character: `character_level_up`, `character_rest`, `character_location_changed`
- Time: `game_time_advanced`, `game_day_changed`

**Requirement Types (12):**
- `story_thread_resolved`, `intel_gathered`
- `location_discovered`, `location_visited`
- `npc_met`, `npc_disposition`, `npc_trust`
- `item_obtained`
- `faction_standing`
- `enemy_defeated`, `adventure_completed`
- `time_passed`, `custom`

### Quest Progress Checker Features
- Listens to game events automatically
- Matches events against quest requirements using flexible params
- Supports tag matching, name patterns, numeric thresholds
- Advances quest stages when all required requirements complete
- Completes quests when final stage is done
- Adds notifications to narrative queue

### Companion Trigger Checker Features
- Listens to game events automatically
- Checks companion backstory threads for trigger keyword matches
- Activates dormant threads when triggers match
- Checks for secret reveals when loyalty changes
- Adds notifications to narrative queue

---

## Phase D: AI Generators

### Status: COMPLETE

### Generators

| Generator | File | Purpose | Status |
|-----------|------|---------|--------|
| Quest Generator | `server/services/questGenerator.js` | Generate main, side, one-time, and companion quests | **Done** |
| Location Generator | `server/services/locationGenerator.js` | Generate region locations, dungeons, connections | **Done** |
| Companion Backstory Generator | `server/services/companionBackstoryGenerator.js` | Generate backstories with threads, secrets | **Done** |

### Generator Features

**Quest Generator (`questGenerator.js`)**
- `generateMainQuest()` - 5-stage epic storylines with antagonists
- `generateSideQuest()` - 2-3 stage focused storylines
- `generateOneTimeQuest()` - Single-objective tasks (bounty, rescue, delivery, etc.)
- `generateCompanionQuest()` - Personal quests tied to companion backstory threads
- All generators produce structured JSON with abstract requirements
- Claude primary, Ollama fallback

**Location Generator (`locationGenerator.js`)**
- `generateRegionLocations()` - Generate multiple locations for a region
- `generateLocation()` - Single detailed location with NPCs and hooks
- `generateDungeon()` - Adventure sites with hazards, inhabitants, treasure
- `generateConnections()` - Travel routes between locations
- Supports all location types: cities, dungeons, ruins, temples, etc.

**Companion Backstory Generator (`companionBackstoryGenerator.js`)**
- `generateBackstory()` - Complete backstory with origin, threads, secrets
- `generateAdditionalThreads()` - Add new unresolved threads
- `generateSecret()` - Generate specific secret types
- Thread types: family, enemy, debt, romance, mystery, vengeance, redemption
- Secret categories: shameful, dangerous, valuable, tragic, hopeful
- Loyalty triggers for increase/decrease

---

## Phase E: Integration

### Status: COMPLETE

### Integration Service Created

**Narrative Integration Service (`server/services/narrativeIntegration.js`)**

Central service providing integration functions between new narrative systems and existing codebase:

**Adventure Integration**
- `onAdventureComplete()` - Emits `adventure_complete` event, triggers quest progress checker
- `onAdventureStarted()` - Emits `adventure_started` event

**Story Thread Integration**
- `onStoryThreadCreated()` - Emits `story_thread_created` event
- `onStoryThreadResolved()` - Emits `story_thread_resolved` event (auto-triggers quest progress)

**DM Session Integration**
- `getNarrativeContextForSession()` - Fetches narrative queue items for AI context
- `markNarrativeItemsDelivered()` - Marks items as delivered after session start
- `onDMSessionStarted()` / `onDMSessionEnded()` - Session events

**Companion Integration**
- `onCompanionRecruited()` - Generates backstory, emits event
- `onCompanionDismissed()` - Emits dismissal event
- `onCompanionLoyaltyChanged()` - Triggers secret reveal checks

**Location Integration**
- `onLocationDiscovered()` - Emits event, auto-generates one-time quest for dangerous locations
- `emitLocationVisited()` - Emits visit event, updates visit count

### Integration Points Connected

| Existing System | Integration | Status |
|-----------------|-------------|--------|
| Adventure Completion | Emits events via `onAdventureComplete()` | **Done** |
| Story Thread Creation | Emits events for each new thread | **Done** |
| Story Thread Resolution | Emits events via `resolveThread()` | **Done** |
| Companion Recruitment | Generates backstory via `onCompanionRecruited()` | **Done** |
| Companion Dismissal | Emits events via `onCompanionDismissed()` | **Done** |
| DM Session Context | `getNarrativeContextForSession()` available | **Done** |

### Files Modified for Integration

| File | Changes |
|------|---------|
| `server/routes/adventure.js` | Added import for narrativeIntegration, calls `onAdventureComplete()` and `onStoryThreadCreated()` |
| `server/routes/companion.js` | Added import for narrativeIntegration, calls `onCompanionRecruited()` and `onCompanionDismissed()` |
| `server/services/storyThreads.js` | Added event emission in `resolveThread()` |

---

## Testing Checkpoints

### After Phase A
- [ ] All tables created successfully (verify with server start)
- [ ] Can insert sample data into each table
- [ ] Foreign key relationships work
- [ ] Indexes created

### After Phase B
- [ ] All CRUD endpoints respond correctly
- [ ] Can create/read/update/delete each entity type
- [ ] Validation works (required fields, etc.)

### After Phase C
- [ ] Events emit and are received by handlers
- [ ] Quest progress checker responds to mock events
- [ ] No errors when no handlers registered

### After Phase D
- [ ] Quest generator produces valid JSON
- [ ] Backstory generator produces valid JSON
- [ ] Location generator produces valid JSON
- [ ] Ollama fallback works when Claude unavailable

### After Phase E
- [ ] Adventure completion triggers quest progress
- [ ] New companions get backstories generated
- [ ] Narrative queue items appear in DM context
- [ ] Location discovery creates one-time quests

---

## Files Modified

| File | Changes | Date |
|------|---------|------|
| `server/database.js` | Added 7 new tables, 4 migrations, 11 indexes | 2026-02-04 |
| `server/index.js` | Registered new routes + narrative systems init | 2026-02-04 |
| `server/routes/adventure.js` | Added narrative integration (event emission) | 2026-02-04 |
| `server/routes/companion.js` | Added narrative integration (backstory gen, events) | 2026-02-04 |
| `server/services/storyThreads.js` | Added event emission on thread resolution | 2026-02-04 |

## Files Created

| File | Purpose | Date |
|------|---------|------|
| `IMPLEMENTATION_PROGRESS.md` | This tracking document | 2026-02-04 |
| `.claude/settings.json` | Auto-approve permissions | 2026-02-04 |
| `server/services/campaignService.js` | Campaign CRUD operations | 2026-02-04 |
| `server/services/locationService.js` | Location CRUD + discovery | 2026-02-04 |
| `server/services/questService.js` | Quest + requirement CRUD | 2026-02-04 |
| `server/services/npcRelationshipService.js` | NPC relationship tracking | 2026-02-04 |
| `server/services/companionBackstoryService.js` | Backstory, loyalty, secrets, threads | 2026-02-04 |
| `server/services/narrativeQueueService.js` | Narrative event queue management | 2026-02-04 |
| `server/routes/campaign.js` | Campaign API endpoints | 2026-02-04 |
| `server/routes/location.js` | Location API endpoints | 2026-02-04 |
| `server/routes/quest.js` | Quest API endpoints | 2026-02-04 |
| `server/config/eventTypes.js` | Event types and constants | 2026-02-04 |
| `server/services/eventEmitter.js` | Central event bus | 2026-02-04 |
| `server/services/questProgressChecker.js` | Quest requirement matching | 2026-02-04 |
| `server/services/companionTriggerChecker.js` | Backstory thread activation | 2026-02-04 |
| `server/services/narrativeSystemsInit.js` | Event handler initialization | 2026-02-04 |
| `server/services/questGenerator.js` | AI quest generation (main/side/one-time/companion) | 2026-02-04 |
| `server/services/locationGenerator.js` | AI location generation (regions/dungeons) | 2026-02-04 |
| `server/services/companionBackstoryGenerator.js` | AI backstory generation with threads/secrets | 2026-02-04 |
| `server/services/narrativeIntegration.js` | Integration layer connecting narrative systems | 2026-02-04 |

---

## Schema Reference

### campaigns
```sql
id, name, description, setting, tone, starting_location, status, time_ratio, created_at, updated_at
```

### locations
```sql
id, campaign_id, name, description, location_type, parent_location_id, region,
population_size, danger_level, prosperity_level, services (JSON), tags (JSON),
climate, discovery_status, first_visited_date, times_visited, connected_locations (JSON),
current_state, state_description, created_at, updated_at
```

### quests
```sql
id, campaign_id, character_id, quest_type, source_type, source_id, title, premise,
description, antagonist (JSON), status, priority, current_stage, stages (JSON),
completion_criteria (JSON), rewards (JSON), world_impact_on_complete,
world_state_changes (JSON), time_sensitive, deadline_date, escalation_if_ignored,
created_at, updated_at, started_at, completed_at
```

### quest_requirements
```sql
id, quest_id, stage_index, requirement_type, description, params (JSON),
status, completed_at, completed_by, is_optional
```

### npc_relationships
```sql
id, character_id, npc_id, disposition, disposition_label, trust_level,
times_met, first_met_date, first_met_location_id, last_interaction_date,
witnessed_deeds (JSON), known_facts (JSON), rumors_heard (JSON),
player_known_facts (JSON), discovered_secrets (JSON),
promises_made (JSON), debts_owed (JSON), created_at, updated_at
```

### companion_backstories
```sql
id, companion_id, origin_location, origin_description, formative_event,
formative_event_date, personal_goal, goal_progress, unresolved_threads (JSON),
loyalty, loyalty_events (JSON), secrets (JSON), created_at, updated_at
```

### narrative_queue
```sql
id, campaign_id, character_id, event_type, priority, title, description,
context (JSON), related_quest_id, related_companion_id, related_npc_id,
related_location_id, related_thread_id, status, created_at, deliver_after,
expires_at, delivered_at, delivered_in_session_id
```

---

## Notes & Decisions

### Campaign Table Decision
Characters currently have no campaign grouping. We'll add a `campaign_id` to characters and make it optional for backwards compatibility. Existing characters can be assigned to a campaign later.

### Backwards Compatibility
- Existing characters will continue to work
- `campaign_id` fields are nullable
- New features require campaign assignment to function fully
- `current_location` (text) kept alongside `current_location_id` (FK) for migration

### AI Provider Strategy
- Claude is primary (user has paid subscription)
- Ollama is fallback for offline use
- All generators will support both providers

### Quest Requirement Types
```
story_thread_resolved, location_discovered, npc_met, npc_disposition,
item_obtained, intel_gathered, faction_standing, enemy_defeated, adventure_completed, custom
```

### Narrative Queue Event Types
```
adventure_complete, quest_stage_advanced, companion_reaction, story_thread_activated,
downtime_event, world_state_change, npc_relationship_shift, time_sensitive_warning,
quest_completed, companion_secret_revealed
```

### Narrative Queue Priority Levels
```
urgent, high, normal, low, flavor
```

---

## Phase F: Foundation Layer API

### Status: COMPLETE

Exposed all backend narrative systems through REST APIs and integrated with existing routes.

### Narrative Queue API (`/api/narrative-queue`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/:characterId` | GET | Get pending narrative items (with optional `?priority=` filter) |
| `/:characterId/context` | GET | Get AI-formatted narrative context |
| `/:characterId/history` | GET | Get delivery history |
| `/deliver` | POST | Mark items as delivered |
| `/` | POST | Add manual item to queue |
| `/:itemId` | DELETE | Delete pending item |

### Generation API Endpoints

**Quest Generation (`/api/quest/generate/*`)**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/generate/main` | POST | Generate 5-stage main quest |
| `/generate/side` | POST | Generate 2-3 stage side quest |
| `/generate/one-time` | POST | Generate single-objective quest |
| `/generate/companion` | POST | Generate companion personal quest |

**Location Generation (`/api/location/generate/*`)**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/generate` | POST | Generate single location |
| `/generate/region` | POST | Generate multiple locations for a region |
| `/generate/dungeon` | POST | Generate dungeon/adventure site |
| `/generate/connections` | POST | Generate travel routes between locations |

**Companion Backstory (`/api/companion/:id/backstory/*`)**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/backstory` | GET | Get companion's backstory |
| `/backstory/generate` | POST | Generate or regenerate backstory |
| `/backstory/threads` | POST | Add new unresolved threads |
| `/backstory/secret` | POST | Generate new secret |
| `/backstory/thread/:threadId` | PUT | Update thread status |
| `/backstory/secret/:secretId/reveal` | POST | Reveal a secret |

### DM Session Context Integration

Added narrative queue context to DM session AI prompts:
- `server/routes/dmSession.js` - Fetches narrative queue on session start
- `server/services/dmPromptBuilder.js` - Includes `narrativeQueueContext` in system prompt
- Items automatically marked as delivered after session creation

### Character-Campaign Association (`/api/character/:id/campaign`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/campaign` | GET | Get character's current campaign |
| `/campaign` | PUT | Assign character to campaign |
| `/campaign` | DELETE | Remove character from campaign |

### Character Quest Tracking (`/api/character/:id/quests`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/quests` | GET | Get all quests (with optional `?type=` or `?status=` filters) |
| `/quests/active` | GET | Get only active quests |
| `/quests/main` | GET | Get main quest |
| `/quests/summary` | GET | Get quest counts by type and status |

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `server/routes/narrativeQueue.js` | Narrative queue REST API | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `server/routes/quest.js` | Added generation endpoints | 2026-02-04 |
| `server/routes/location.js` | Added generation endpoints | 2026-02-04 |
| `server/routes/companion.js` | Added backstory endpoints | 2026-02-04 |
| `server/routes/character.js` | Added campaign + quest tracking endpoints | 2026-02-04 |
| `server/routes/dmSession.js` | Added narrative queue context integration | 2026-02-04 |
| `server/services/ollama.js` (now `dmPromptBuilder.js`) | Added narrativeQueueContext to system prompt | 2026-02-04 |
| `server/services/narrativeQueueService.js` | Added getDeliveredItems function | 2026-02-04 |

---

## Phase G: Expansion Systems - Phase 1

### Status: COMPLETE

Implemented the first phase of expansion systems: Factions and World Events.

### Tables Created

| Table | Status | Notes |
|-------|--------|-------|
| `factions` | **Done** | Organizations with identity, power, relationships, values |
| `faction_goals` | **Done** | Goals factions pursue with progress tracking, visibility |
| `faction_standings` | **Done** | Character standings with factions, membership, history |
| `world_events` | **Done** | Multi-stage events affecting the world |
| `event_effects` | **Done** | Specific effects from world events |

### Indexes Created

- `idx_factions_campaign`, `idx_factions_scope`, `idx_factions_status`
- `idx_faction_goals_faction`, `idx_faction_goals_status`, `idx_faction_goals_visibility`
- `idx_faction_standings_character`, `idx_faction_standings_faction`, `idx_faction_standings_standing`
- `idx_world_events_campaign`, `idx_world_events_status`, `idx_world_events_type`, `idx_world_events_scope`
- `idx_event_effects_event`, `idx_event_effects_target`, `idx_event_effects_status`

### Services Created

| Service | File | Status |
|---------|------|--------|
| Faction Service | `server/services/factionService.js` | **Done** |
| World Event Service | `server/services/worldEventService.js` | **Done** |

### Routes Created

| Route File | Endpoints | Status |
|------------|-----------|--------|
| `server/routes/faction.js` | CRUD for factions, goals, standings + tick processing | **Done** |
| `server/routes/worldEvent.js` | CRUD for events, effects + tick processing | **Done** |

### Faction API Endpoints (`/api/faction`)

**Faction CRUD**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/campaign/:campaignId` | GET | List all factions for a campaign |
| `/campaign/:campaignId/active` | GET | List active factions |
| `/:id` | GET | Get faction by ID |
| `/` | POST | Create faction |
| `/:id` | PUT | Update faction |
| `/:id` | DELETE | Delete faction |
| `/:id/relationship` | POST | Update relationship with another faction |

**Faction Goals**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/:factionId/goals` | GET | List faction goals |
| `/:factionId/goals/active` | GET | List active goals |
| `/:factionId/goals` | POST | Create goal |
| `/goal/:id` | GET | Get goal by ID |
| `/goal/:id` | PUT | Update goal |
| `/goal/:id/advance` | POST | Advance goal progress |
| `/goal/:id/discover` | POST | Character discovers goal |
| `/goal/:id` | DELETE | Delete goal |

**Faction Standings**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/standings/character/:characterId` | GET | Get all standings for character |
| `/:factionId/members` | GET | Get faction members |
| `/standing/:characterId/:factionId` | GET | Get specific standing |
| `/standing/:characterId/:factionId` | PUT | Update standing |
| `/standing/:characterId/:factionId/modify` | POST | Modify standing by amount |
| `/standing/:characterId/:factionId/join` | POST | Join faction |
| `/standing/:characterId/:factionId/leave` | POST | Leave faction |

**Tick Processing**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tick/:campaignId` | POST | Process faction tick (advance goals) |

### World Event API Endpoints (`/api/world-event`)

**Event CRUD**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/campaign/:campaignId` | GET | List campaign events |
| `/campaign/:campaignId/active` | GET | List active events |
| `/campaign/:campaignId/type/:eventType` | GET | Filter by type |
| `/location/:locationId` | GET | Get events affecting location |
| `/faction/:factionId` | GET | Get events affecting faction |
| `/character/:characterId` | GET | Get events visible to character |
| `/:id` | GET | Get event by ID |
| `/` | POST | Create event |
| `/:id` | PUT | Update event |
| `/:id/advance-stage` | POST | Advance to next stage |
| `/:id/resolve` | POST | Resolve event with outcome |
| `/:id/cancel` | POST | Cancel event |
| `/:id/discover` | POST | Character discovers event |
| `/:id` | DELETE | Delete event |

**Event Effects**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/:eventId/effects` | GET | Get effects for event |
| `/effects/target/:targetType/:targetId` | GET | Get effects for target |
| `/effects/campaign/:campaignId` | GET | Get all active effects for campaign |
| `/:eventId/effects` | POST | Create effect |
| `/effect/:id` | GET | Get effect by ID |
| `/effect/:id` | PUT | Update effect |
| `/effect/:id/reverse` | POST | Reverse an effect |
| `/effect/:id` | DELETE | Delete effect |

**Tick Processing**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tick/:campaignId` | POST | Process event tick (advance stages, expire effects) |

### Schema Reference (New Tables)

**factions**
```sql
id, campaign_id, name, description, symbol, motto, scope, power_level,
influence_areas (JSON), headquarters_location_id, territory (JSON),
leader_npc_id, leadership_structure, notable_members (JSON),
wealth_level, military_strength, political_influence, magical_resources, information_network,
faction_relationships (JSON), alignment, primary_values (JSON), typical_methods (JSON),
recruitment_requirements, membership_benefits (JSON), status, public_reputation,
created_at, updated_at
```

**faction_goals**
```sql
id, faction_id, title, description, goal_type, progress, progress_max,
milestones (JSON), deadline, urgency, started_at,
success_consequences, failure_consequences, stakes_level,
target_location_id, target_faction_id, target_npc_id, target_character_id,
visibility, discovered_by_characters (JSON), status, completed_at, outcome,
last_tick_at, tick_notes, created_at, updated_at
```

**faction_standings**
```sql
id, character_id, faction_id, standing, standing_label, rank,
is_member, joined_at, membership_level,
deeds_for (JSON), deeds_against (JSON), gifts_given (JSON), quests_completed (JSON),
known_members (JSON), known_goals (JSON), known_secrets (JSON),
created_at, updated_at
```

**world_events**
```sql
id, campaign_id, title, description, event_type, scope,
affected_locations (JSON), affected_factions (JSON),
current_stage, stages (JSON), stage_descriptions (JSON),
started_at, expected_duration_days, deadline, visibility,
discovered_by_characters (JSON), triggered_by_faction_id, triggered_by_character_id,
triggered_by_event_id, possible_outcomes (JSON), player_intervention_options (JSON),
status, completed_at, outcome, outcome_description,
last_tick_at, tick_notes, created_at, updated_at
```

**event_effects**
```sql
id, event_id, effect_type, description, target_type, target_id,
parameters (JSON), stage_applied, duration, expires_at,
status, reversed_at, reversal_reason, created_at
```

### Service Features

**Faction Service (`factionService.js`)**
- Full CRUD for factions, goals, and standings
- Faction relationship management between factions
- Goal progress tracking with completion detection
- Standing modifications with deed tracking
- Membership system (join/leave with levels)
- Knowledge discovery (members, goals, secrets)
- Tick processing for automatic goal advancement
- Standing labels: enemy → hated → hostile → unfriendly → neutral → friendly → honored → revered → exalted

**World Event Service (`worldEventService.js`)**
- Full CRUD for events and effects
- Multi-stage event progression
- Event discovery by characters
- Effect management with expiration
- Automatic effect expiration processing
- Event resolution with outcomes
- Tick processing for stage advancement and deadlines

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `server/services/factionService.js` | Faction CRUD, goals, standings, tick processing | 2026-02-04 |
| `server/services/worldEventService.js` | World event CRUD, effects, tick processing | 2026-02-04 |
| `server/routes/faction.js` | Faction API endpoints | 2026-02-04 |
| `server/routes/worldEvent.js` | World event API endpoints | 2026-02-04 |
| `server/tests/expansionPhase1Test.js` | Phase 1 expansion system tests (29 tests) | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `server/database.js` | Added 5 new tables, 15 indexes | 2026-02-04 |
| `server/index.js` | Registered faction and worldEvent routes | 2026-02-04 |

### Test Results

- **Expansion Phase 1 Tests:** 29 passed, 0 failed
- **Foundation API Tests:** 16 passed, 0 failed
- **Total Backend Tests:** 45 passed

---

## Phase H: Expansion Systems - Phase 2

### Status: COMPLETE

Implemented the second phase of expansion systems: Travel System and NPC Relationship Enhancements.

### Tables Created

| Table | Status | Notes |
|-------|--------|-------|
| `journeys` | **Done** | Travel between locations with time, resources, companions |
| `journey_encounters` | **Done** | Events that occur during travel |

### Indexes Created

- `idx_journeys_character`, `idx_journeys_campaign`, `idx_journeys_status`
- `idx_journey_encounters_journey`, `idx_journey_encounters_type`, `idx_journey_encounters_status`

### Services Created/Enhanced

| Service | File | Status |
|---------|------|--------|
| Travel Service | `server/services/travelService.js` | **Done** (NEW) |
| NPC Relationship Service | `server/services/npcRelationshipService.js` | **Enhanced** |

### Routes Created

| Route File | Endpoints | Status |
|------------|-----------|--------|
| `server/routes/travel.js` | Journey CRUD, encounters, calculations | **Done** |
| `server/routes/npcRelationship.js` | Relationship CRUD, rumors, promises, debts | **Done** |

### Travel API Endpoints (`/api/travel`)

**Journey Management**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/character/:characterId` | GET | Get all journeys for character |
| `/character/:characterId/active` | GET | Get active journey |
| `/campaign/:campaignId` | GET | Get all campaign journeys |
| `/:id` | GET | Get journey by ID |
| `/:id/full` | GET | Get journey with encounters |
| `/` | POST | Start a new journey |
| `/:id` | PUT | Update journey |
| `/:id/complete` | POST | Complete journey |
| `/:id/abort` | POST | Abort journey |
| `/:id/consume-resources` | POST | Consume rations/gold |
| `/:id` | DELETE | Delete journey |

**Encounters**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/:journeyId/encounters` | GET | Get journey encounters |
| `/:journeyId/encounters/pending` | GET | Get pending encounters |
| `/:journeyId/encounters` | POST | Create encounter |
| `/encounter/:id` | GET | Get encounter by ID |
| `/encounter/:id/resolve` | POST | Resolve encounter |
| `/encounter/:id/avoid` | POST | Avoid encounter |
| `/encounter/:id` | DELETE | Delete encounter |

**Calculations**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/calculate/time` | POST | Calculate travel time, rations, cost |
| `/generate/encounter` | POST | Generate random encounter |
| `/check/encounter` | POST | Check if encounter occurs |
| `/constants` | GET | Get travel speeds, route modifiers |

### NPC Relationship API Endpoints (`/api/npc-relationship`)

**Relationship CRUD**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/character/:characterId` | GET | Get all relationships |
| `/character/:characterId/with-npcs` | GET | Get relationships with NPC details |
| `/character/:characterId/summary` | GET | Get relationship summary |
| `/character/:characterId/allies` | GET | Get allied NPCs |
| `/character/:characterId/hostile` | GET | Get hostile NPCs |
| `/character/:characterId/by-label/:label` | GET | Get NPCs by disposition label |
| `/:characterId/:npcId` | GET | Get specific relationship |
| `/` | POST | Create relationship |
| `/:id` | PUT | Update relationship |
| `/:id` | DELETE | Delete relationship |

**Disposition & Trust**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/:characterId/:npcId/disposition` | POST | Adjust disposition |
| `/:characterId/:npcId/trust` | POST | Adjust trust |
| `/:characterId/:npcId/interaction` | POST | Record interaction |

**Knowledge**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/:characterId/:npcId/known-fact` | POST | Add NPC-known fact |
| `/:characterId/:npcId/player-known-fact` | POST | Add player-known fact |
| `/:characterId/:npcId/secret` | POST | Discover secret |

**Rumors**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/:characterId/:npcId/rumor` | POST | Add rumor |
| `/:characterId/:npcId/rumor/:index/disprove` | POST | Disprove rumor |

**Promises**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/character/:characterId/promises` | GET | Get pending promises |
| `/:characterId/:npcId/promise` | POST | Add promise |
| `/:characterId/:npcId/promise/:index/fulfill` | POST | Fulfill promise |
| `/:characterId/:npcId/promise/:index/break` | POST | Break promise |

**Debts**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/character/:characterId/debts` | GET | Get outstanding debts |
| `/:characterId/:npcId/debt` | POST | Add debt |
| `/:characterId/:npcId/debt/:index/settle` | POST | Settle debt |
| `/:characterId/:npcId/debt/:index/forgive` | POST | Forgive debt |

### Schema Reference (New Tables)

**journeys**
```sql
id, character_id, campaign_id, origin_location_id, destination_location_id,
origin_name, destination_name, travel_method, route_type,
distance_miles, estimated_hours, actual_hours,
started_at, expected_arrival, actual_arrival,
game_start_day, game_start_hour,
rations_consumed, gold_spent, traveling_companions (JSON),
status, outcome, outcome_description,
encounters_faced, encounters_avoided,
created_at, updated_at
```

**journey_encounters**
```sql
id, journey_id, encounter_type, title, description,
hours_into_journey, game_day, game_hour,
danger_level, challenge_type,
status, approach, outcome, outcome_description,
hp_change, gold_change, items_gained (JSON), items_lost (JSON),
time_lost_hours, npcs_involved (JSON),
created_story_thread_id, created_at
```

### Service Features

**Travel Service (`travelService.js`)**
- Journey CRUD with travel method and route type support
- Encounter creation, resolution, and avoidance
- Travel time calculation based on distance, method, and terrain
- Rations and cost estimation
- Random encounter generation with type-based probabilities
- Encounter occurrence checking based on danger and terrain
- Support for 8 travel methods: walking, forced_march, riding, fast_riding, carriage, boat, ship, flying
- Support for 9 route types: road, trail, wilderness, mountain, swamp, desert, river, sea, underground

**NPC Relationship Service Enhancements**
- Rumor tracking (heard, believed status, disprove)
- Promise lifecycle (add, fulfill, break with disposition impact)
- Debt management (add, settle, forgive with disposition impact)
- Aggregation queries (pending promises, outstanding debts, relationship summary)
- NPCs by disposition label lookup

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `server/services/travelService.js` | Journey mechanics, encounters, calculations | 2026-02-04 |
| `server/routes/travel.js` | Travel API endpoints | 2026-02-04 |
| `server/routes/npcRelationship.js` | NPC Relationship API endpoints | 2026-02-04 |
| `server/tests/expansionPhase2Test.js` | Phase 2 expansion system tests (29 tests) | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `server/database.js` | Added 2 new tables (journeys, journey_encounters), 6 indexes | 2026-02-04 |
| `server/index.js` | Registered travel and npcRelationship routes | 2026-02-04 |
| `server/services/npcRelationshipService.js` | Added rumor, promise, debt management methods | 2026-02-04 |

### Test Results

- **Expansion Phase 2 Tests:** 29 passed, 0 failed
- **Expansion Phase 1 Tests:** 29 passed, 0 failed
- **Foundation API Tests:** 16 passed, 0 failed
- **Total Backend Tests:** 74 passed

---

## Phase I: Expansion Systems - Phase 3 (Living World Integration)

### Status: COMPLETE

Implemented the third phase of expansion systems: Living World Integration that ties together factions, events, and time progression.

### Services Created

| Service | File | Status |
|---------|------|--------|
| Living World Service | `server/services/livingWorldService.js` | **Done** (NEW) |
| Living World Generator | `server/services/livingWorldGenerator.js` | **Done** (NEW) |

### Routes Created

| Route File | Endpoints | Status |
|------------|-----------|--------|
| `server/routes/livingWorld.js` | Tick processing, world state, AI generation | **Done** |

### Living World API Endpoints (`/api/living-world`)

**Tick Processing**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tick/:campaignId` | POST | Manually trigger living world tick |

**World State**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/state/:campaignId` | GET | Get comprehensive world state |
| `/character-view/:characterId` | GET | Get world state visible to character |

**Faction Goal Generation**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/generate/faction-goal/:factionId` | POST | Generate a goal for a faction |
| `/generate/faction-goals/:factionId` | POST | Generate multiple goals for a faction |

**World Event Generation**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/generate/world-event/:campaignId` | POST | Generate a world event |
| `/generate/faction-event/:factionId/:goalId` | POST | Generate event from faction goal |

**Simulation**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/simulate/:campaignId` | POST | Simulate multiple days of progression |

### Meta-Game Integration

Updated `/api/meta-game/advance-time/:characterId` to trigger living world tick when time advances:
- Processes faction goal advancement
- Processes world event progression
- Auto-spawns events at faction goal milestones (25%, 50%, 75%, 100%)
- Returns living world results in response

Added `/api/meta-game/world-view/:characterId` endpoint for character-specific world state.

### Service Features

**Living World Service (`livingWorldService.js`)**
- Coordinated tick processing for factions and events
- Auto-spawns world events when faction goals hit milestones
- Milestone events at 25%, 50%, 75%, and 100% goal progress
- Goal completion events with effects
- World state queries (campaign-wide and character-specific)
- Character time advance integration

**Living World Generator (`livingWorldGenerator.js`)**
- AI-powered faction goal generation
- Faction goals match faction identity, values, and methods
- Multiple goal types: expansion, defense, economic, political, military, covert, religious, magical
- AI-powered world event generation
- Event types: political, economic, military, natural, magical, religious, social, conspiracy, threat
- Faction-triggered event generation from goal progress
- Dual provider support (Claude primary, Ollama fallback)

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `server/services/livingWorldService.js` | Tick coordination, world state queries | 2026-02-04 |
| `server/services/livingWorldGenerator.js` | AI generation for goals and events | 2026-02-04 |
| `server/routes/livingWorld.js` | Living world API endpoints | 2026-02-04 |
| `server/tests/expansionPhase3Test.js` | Phase 3 integration tests (18 tests) | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `server/index.js` | Registered livingWorld routes | 2026-02-04 |
| `server/routes/metaGame.js` | Added living world tick integration, world-view endpoint | 2026-02-04 |
| `server/services/factionService.js` | Fixed getGoalsVisibleToCharacter query | 2026-02-04 |

### Test Results

- **Expansion Phase 3 Tests:** 18 passed, 0 failed
- **Expansion Phase 2 Tests:** 29 passed, 0 failed
- **Expansion Phase 1 Tests:** 29 passed, 0 failed
- **Foundation API Tests:** 16 passed, 0 failed
- **Total Backend Tests:** 92 passed

---

## Frontend Implementation

All backend expansion systems are complete. Now building frontend components.

---

## Frontend Phase 1: Faction System UI

### Status: COMPLETE

Implemented the Faction System UI for managing factions, standings, and goals.

### Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| FactionsPage | `client/src/components/FactionsPage.jsx` | Main faction management UI | **Done** |

### FactionsPage Features

**Faction List (Left Panel)**:
- Lists all factions in the character's campaign
- Shows faction scope badges (local/regional/continental/global)
- Displays character's standing with each faction (Hated → Exalted scale)
- Visual standing bar with color-coded levels
- Membership badges for joined factions
- Create new faction form

**Faction Detail (Right Panel)**:
- Detailed faction information when selected
- Stats grid: Power, Wealth, Military, Political influence
- Alignment badge display
- Join/Leave faction buttons
- Active goals with progress bars and visibility badges
- Notable members list

**Standings System**:
- Color-coded standing levels:
  - Hated (dark red) / Hostile (red) / Unfriendly (orange)
  - Neutral (gray)
  - Friendly (green) / Honored (bright green) / Exalted (teal)
- Visual progress bar showing standing from -100 to +100
- Membership level display (initiate, member, etc.)

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `client/src/components/FactionsPage.jsx` | Faction management UI component | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `client/src/App.jsx` | Added FactionsPage import, showFactions state, header button, routing | 2026-02-04 |

### API Integration

The FactionsPage uses the following backend endpoints:
- `GET /api/faction/campaign/:campaignId` - Load all factions
- `GET /api/faction/standings/character/:characterId` - Load character standings
- `GET /api/faction/:factionId/goals/active` - Load faction's active goals
- `GET /api/faction/:factionId/members` - Load faction members
- `POST /api/faction` - Create new faction
- `POST /api/faction/standing/:characterId/:factionId/join` - Join faction
- `POST /api/faction/standing/:characterId/:factionId/leave` - Leave faction

### Test Results

- **Frontend Build**: Successful (no compilation errors)
- **Backend Tests**: All 76 tests passing
  - Phase 1: 29 passed
  - Phase 2: 29 passed
  - Phase 3: 18 passed

---

## Frontend Phase 2: World Events UI

### Status: COMPLETE

Implemented the World Events UI for viewing and managing world events and their effects.

### Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| WorldEventsPage | `client/src/components/WorldEventsPage.jsx` | World events management UI | **Done** |

### WorldEventsPage Features

**Event List (Left Panel)**:
- Lists all events in the character's campaign
- Filter tabs: Active, All, Resolved
- Event type icons and colors (political, economic, military, etc.)
- Scope badges (local/regional/continental/global)
- Status badges (active/resolved/cancelled)
- Visibility badges (public/rumored/secret)
- Stage progress bars
- Create new event form

**Event Detail (Right Panel)**:
- Detailed event information when selected
- Event type, scope, status, duration metadata
- Stage progression display with current stage highlighted
- Advance Stage and Resolve Event action buttons
- Possible outcomes list
- Player intervention options
- Active effects from the event
- Outcome description (for resolved events)

**Event Types**:
- Political (purple/crown) - Power shifts, treaties
- Economic (orange/money) - Trade, markets
- Military (red/sword) - Wars, campaigns
- Natural (green/leaf) - Disasters, plagues
- Magical (blue/sparkle) - Wild magic, planar incursions
- Religious (purple/prayer) - Divine interventions
- Social (teal/masks) - Festivals, riots
- Conspiracy (dark/spy) - Hidden plots
- Threat (dark red/skull) - Monsters, dangers

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `client/src/components/WorldEventsPage.jsx` | World events management UI component | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `client/src/App.jsx` | Added WorldEventsPage import, showWorldEvents state, header button, routing | 2026-02-04 |

### API Integration

The WorldEventsPage uses the following backend endpoints:
- `GET /api/world-event/campaign/:campaignId` - Load all events
- `GET /api/world-event/campaign/:campaignId/active` - Load active events
- `GET /api/world-event/effects/campaign/:campaignId` - Load active effects
- `GET /api/world-event/:eventId/effects` - Load effects for specific event
- `POST /api/world-event` - Create new event
- `POST /api/world-event/:id/advance-stage` - Advance event stage
- `POST /api/world-event/:id/resolve` - Resolve an event

### Test Results

- **Frontend Build**: Successful (no compilation errors)
- **Backend Tests**: All 76 tests passing
  - Phase 1: 29 passed
  - Phase 2: 29 passed
  - Phase 3: 18 passed

---

## Frontend Phase 3: Travel System UI

### Status: COMPLETE

Implemented the Travel System UI for managing journeys, encounters, and travel planning.

### Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| TravelPage | `client/src/components/TravelPage.jsx` | Main travel management UI | **Done** |

### TravelPage Features

**Journey List (Left Panel)**:
- Lists all journeys for the campaign
- Filter tabs: Active, Completed, All
- Journey cards showing origin → destination route
- Status badges (in_progress/completed/aborted/failed)
- Progress bars for active journeys
- Travel method and distance display
- Create new journey form

**New Journey Form**:
- Character selection dropdown
- Origin and destination location selection
- Distance input (miles)
- Danger level slider (1-10)
- Travel method selection (walking/horse/cart/ship/flying)
- Route type selection (road/trail/wilderness/mountain/swamp/sea)
- Starting rations and gold inputs

**Travel Calculator**:
- Quick estimation tool
- Distance, party size, travel method, route type inputs
- Calculates estimated travel time (hours and days)
- Calculates rations needed
- Estimates travel cost in gold

**Journey Detail (Right Panel)**:
- Full route information (origin → destination)
- Traveler character name
- Distance, travel method, route type, danger level
- Progress bar showing elapsed vs estimated hours
- Resource tracking (rations and gold remaining)
- Resource consumption buttons (-1 ration, -5 gold)
- Complete Journey and Abort Journey actions
- Outcome description for completed journeys

**Encounters Section**:
- Lists all encounters for the selected journey
- Encounter type icons (combat, social, environmental, discovery, rest, etc.)
- Status badges (pending/resolved/avoided)
- Encounter description
- Action buttons for pending encounters:
  - Fight (combat approach)
  - Negotiate (diplomacy approach)
  - Flee (stealth avoidance)

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `client/src/components/TravelPage.jsx` | Travel management UI component | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `client/src/App.jsx` | Added TravelPage import, showTravel state, header button, routing | 2026-02-04 |

### API Integration

The TravelPage uses the following backend endpoints:
- `GET /api/travel/campaign/:campaignId` - Load all journeys
- `GET /api/travel/constants` - Load travel constants (speeds, modifiers)
- `GET /api/travel/:journeyId/encounters` - Load journey encounters
- `POST /api/travel` - Start new journey
- `POST /api/travel/:id/complete` - Complete journey
- `POST /api/travel/:id/abort` - Abort journey
- `POST /api/travel/:id/consume-resources` - Use rations/gold
- `POST /api/travel/calculate/time` - Calculate travel time and costs
- `POST /api/travel/encounter/:id/resolve` - Resolve encounter
- `POST /api/travel/encounter/:id/avoid` - Avoid encounter

### Test Results

- **Frontend Build**: Successful (no compilation errors)

---

## Frontend Phase 4: NPC Relationships UI

### Status: COMPLETE

Implemented the NPC Relationships UI for managing NPC relationships, promises, debts, and knowledge.

### Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| NPCRelationshipsPage | `client/src/components/NPCRelationshipsPage.jsx` | NPC relationship management UI | **Done** |

### NPCRelationshipsPage Features

**Summary Bar**:
- Quick counts: Allies, Neutral, Hostile NPCs
- Pending promises count
- Outstanding debts count

**NPC List (Left Panel)**:
- Lists all NPCs the character has met
- Filter tabs: All, Allies, Neutral, Hostile
- NPC cards showing:
  - Disposition label badge (color-coded)
  - Times met and first met date
  - Disposition bar (-100 to +100 visual)
  - Trust meter (10-dot display)

**Detail Panel (Right Panel) with Tabs**:

**Info Tab**:
- Disposition score with adjustment buttons (+10, +5, -5, -10)
- Visual disposition bar
- Trust level with adjustment buttons
- Stats grid: Times Met, Witnessed Deeds, Secrets Known, Pending Promises

**Promises Tab**:
- List of all promises made to/by NPC
- Status badges (pending/fulfilled/broken)
- Fulfill and Break buttons for pending promises

**Debts Tab**:
- List of all debts (owed to NPC or owed by NPC)
- Debt type and description
- Status badges (outstanding/settled/forgiven)
- Settle Debt button for outstanding debts

**Knowledge Tab**:
- Secrets discovered (dark themed cards)
- Known facts (green themed cards)
- Rumors heard with disprove option

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `client/src/components/NPCRelationshipsPage.jsx` | NPC relationships management UI | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `client/src/App.jsx` | Added NPCRelationshipsPage import, showNPCRelationships state, header button, routing | 2026-02-04 |

### API Integration

The NPCRelationshipsPage uses the following backend endpoints:
- `GET /api/npc-relationship/character/:characterId` - Load relationships
- `GET /api/npc-relationship/character/:characterId/summary` - Load summary counts
- `GET /api/npc-relationship/character/:characterId/promises` - Load pending promises
- `GET /api/npc-relationship/character/:characterId/debts` - Load outstanding debts
- `POST /api/npc-relationship/:characterId/:npcId/disposition` - Adjust disposition
- `POST /api/npc-relationship/:characterId/:npcId/trust` - Adjust trust
- `POST /api/npc-relationship/:characterId/:npcId/promise/:index/fulfill` - Fulfill promise
- `POST /api/npc-relationship/:characterId/:npcId/promise/:index/break` - Break promise
- `POST /api/npc-relationship/:characterId/:npcId/debt/:index/settle` - Settle debt
- `POST /api/npc-relationship/:characterId/:npcId/rumor/:index/disprove` - Disprove rumor

### Test Results

- **Frontend Build**: Successful (no compilation errors)

---

## Frontend Phase 5: Living World Dashboard

### Status: COMPLETE

Implemented the Living World Dashboard for world state overview, tick processing, and AI content generation.

### Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| LivingWorldPage | `client/src/components/LivingWorldPage.jsx` | Living world management UI | **Done** |

### LivingWorldPage Features

**Summary Cards**:
- Active Factions count
- Active Goals count
- Active Events count
- Active Effects count

**World Controls (Left Panel)**:

*Advance Time*:
- Days input (1-7)
- Process Tick button
- Results display: goals processed, events spawned, effects expired

*Simulate Time Skip*:
- Days input (1-30)
- Simulate button
- Summary: goals advanced/completed, events spawned, effects expired

*AI Content Generation*:
- Faction selector + Generate Goal button
- Event type selector + Generate Event button
- Results display showing generated content

**World State (Right Panel) with Tabs**:

*Overview Tab*:
- Character's view statistics (visible factions, known goals, visible events)
- Recent activity log (active goals, active events)

*Factions Tab*:
- All factions with power level badges
- Scope and active goal counts
- Goal progress bars for each faction

*Events Tab*:
- All events with type color-coding
- Scope, stage, and status display
- Stage progress bars

*Effects Tab*:
- All active effects
- Effect type, target, and description
- Expiration dates

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `client/src/components/LivingWorldPage.jsx` | Living world dashboard UI | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `client/src/App.jsx` | Added LivingWorldPage import, showLivingWorld state, header button, routing | 2026-02-04 |

### API Integration

The LivingWorldPage uses the following backend endpoints:
- `GET /api/living-world/state/:campaignId` - Load world state
- `GET /api/living-world/character-view/:characterId` - Load character view
- `POST /api/living-world/tick/:campaignId` - Process tick
- `POST /api/living-world/simulate/:campaignId` - Simulate multiple days
- `POST /api/living-world/generate/faction-goal/:factionId` - Generate faction goal
- `POST /api/living-world/generate/world-event/:campaignId` - Generate world event

### Test Results

- **Frontend Build**: Successful (no compilation errors)

---

## Frontend Phase 6: Campaign Management UI

### Status: COMPLETE

Implemented the Campaign Management UI for creating and managing campaigns, assigning characters.

### Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| CampaignsPage | `client/src/components/CampaignsPage.jsx` | Campaign management UI | **Done** |

### CampaignsPage Features

**Campaign List (Left Panel)**:
- Lists all campaigns
- Filter tabs: Active, Archived, All
- Campaign cards showing:
  - Name and description
  - Setting and tone
  - Status badge (active/archived)
  - Character count
- Create new campaign form

**New Campaign Form**:
- Name and description inputs
- Setting selection (Forgotten Realms, Eberron, Homebrew, etc.)
- Tone selection (Heroic Fantasy, Dark Fantasy, etc.)
- Starting location input
- Time ratio slider (1-12 hours per real hour)

**Campaign Detail (Right Panel)**:
- Campaign information display
- Stats grid: Characters, Quests, Locations
- Starting location display
- Character assignment section:
  - List of assigned characters with remove buttons
  - Dropdown to assign new characters
- Archive campaign action
- Archived status indicator

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `client/src/components/CampaignsPage.jsx` | Campaign management UI | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `client/src/App.jsx` | Added CampaignsPage import, showCampaigns state, header button, routing | 2026-02-04 |

### API Integration

The CampaignsPage uses the following backend endpoints:
- `GET /api/campaign` - Load all campaigns
- `GET /api/campaign/:id/stats` - Load campaign statistics
- `GET /api/campaign/:id/characters` - Load campaign characters
- `GET /api/character` - Load all characters (for assignment)
- `POST /api/campaign` - Create new campaign
- `POST /api/campaign/:id/archive` - Archive campaign
- `POST /api/campaign/:id/assign-character` - Assign character to campaign
- `DELETE /api/campaign/:campaignId/character/:characterId` - Remove character from campaign

### Test Results

- **Frontend Build**: Successful (no compilation errors)

---

## Frontend Phase 7: Quest Tracker Panel

### Status: COMPLETE

Implemented the Quest Tracker UI for viewing and managing quests, stages, and requirements.

### Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| QuestsPage | `client/src/components/QuestsPage.jsx` | Quest tracking UI | **Done** |

### QuestsPage Features

**Quest List (Left Panel)**:
- Lists all quests for the character
- Filter tabs: Active, Completed, Failed, All
- Quest cards showing:
  - Quest type icon (Main/Side/Companion/One-Time)
  - Type, status, and priority badges
  - Stage progress indicator
  - Progress bar for active quests

**Quest Detail (Right Panel) with Tabs**:

**Info Tab**:
- Quest type, status, and priority display
- Premise/description in styled block
- Antagonist information (if present)
- Deadline warning for time-sensitive quests
- Action buttons: Advance Stage, Complete, Fail, Abandon

**Stages Tab**:
- Visual stage progression with color-coding
- Current stage highlighted
- Requirements for each stage with checkboxes
- Manual requirement completion
- Completed/pending requirement styling

**Rewards Tab**:
- Reward items (XP, Gold, Items, Reputation)
- World impact on completion
- Escalation if ignored

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `client/src/components/QuestsPage.jsx` | Quest tracker UI | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `client/src/App.jsx` | Added QuestsPage import, showQuests state, header button, routing | 2026-02-04 |

### API Integration

The QuestsPage uses the following backend endpoints:
- `GET /api/quest/character/:characterId` - Load all quests
- `GET /api/quest/:questId/requirements` - Load quest requirements
- `POST /api/quest/:id/advance` - Advance quest stage
- `POST /api/quest/:id/complete` - Complete quest
- `POST /api/quest/:id/fail` - Fail quest
- `POST /api/quest/:id/abandon` - Abandon quest
- `POST /api/quest/requirement/:id/complete` - Complete requirement

### Test Results

- **Frontend Build**: Successful (no compilation errors)

---

## Frontend Phase 8: Location Map/List

### Status: COMPLETE

Implemented the Locations UI for browsing and managing campaign locations.

### Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| LocationsPage | `client/src/components/LocationsPage.jsx` | Location management UI | **Done** |

### LocationsPage Features

**Location List (Left Panel)**:
- Lists all locations in the campaign
- Search box for filtering locations
- Filter tabs: All, Discovered, Visited
- Type filter dropdown (city, town, dungeon, etc.)
- Location cards showing:
  - Type icon and name
  - Danger level indicator
  - Type and discovery status badges
  - Region name
- Create new location form

**New Location Form**:
- Name input
- Type and region selection
- Danger level slider (1-10)
- Discovery status selection
- Description textarea

**Location Detail (Right Panel) with Tabs**:

**Info Tab**:
- Type, danger level, region display
- Description block
- Services available
- Tags list
- Visit count and first visit date

**Connections Tab**:
- List of connected locations
- Travel time and route type for each connection
- Location type and region info

**Status Tab**:
- Current discovery status display
- Status update buttons (unknown/heard_of/visited/familiar/home_base)
- Current state information
- "Mark as Discovered" action

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `client/src/components/LocationsPage.jsx` | Location management UI | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `client/src/App.jsx` | Added LocationsPage import, showLocations state, header button, routing | 2026-02-04 |

### API Integration

The LocationsPage uses the following backend endpoints:
- `GET /api/location/campaign/:campaignId` - Load all locations
- `GET /api/location/:id/connections` - Load connected locations
- `POST /api/location` - Create new location
- `POST /api/location/:id/discover` - Mark as discovered
- `PUT /api/location/:id/discovery-status` - Update discovery status

### Test Results

- **Frontend Build**: Successful (no compilation errors)

---

## Frontend Phase 9: Companion Backstory View

### Status: COMPLETE

Implemented the Companion Backstory UI for viewing and managing companion backstories, threads, and secrets.

### Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| CompanionBackstoryPage | `client/src/components/CompanionBackstoryPage.jsx` | Companion backstory management UI | **Done** |

### CompanionBackstoryPage Features

**Companion List (Left Panel)**:
- Lists all companions for the character
- Companion cards showing:
  - Avatar and name
  - Race and class information
  - Level display

**Backstory Detail (Right Panel) with Tabs**:

**Story Tab**:
- Personal history/summary
- Origin information
- Motivation display
- Key relationships list

**Threads Tab**:
- Unresolved story threads list
- Thread status icons (active/developing/resolved/abandoned)
- Status dropdown for updating thread status
- Thread descriptions with story hooks
- Add Thread button for AI generation

**Secrets Tab**:
- Hidden secrets list (blurred until revealed)
- Secret category badges
- Reveal Secret button
- Potential impact information
- Add Secret button for AI generation

**Backstory Generation**:
- Generate Backstory button when no backstory exists
- Regenerate button to create new backstory
- Thread and secret generation buttons

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `client/src/components/CompanionBackstoryPage.jsx` | Companion backstory UI | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `client/src/App.jsx` | Added CompanionBackstoryPage import, showBackstories state, header button, routing | 2026-02-04 |

### API Integration

The CompanionBackstoryPage uses the following backend endpoints:
- `GET /api/companion/character/:characterId` - Load companions
- `GET /api/companion/:id/backstory` - Load backstory
- `POST /api/companion/:id/backstory/generate` - Generate backstory
- `POST /api/companion/:id/backstory/threads` - Add new threads
- `POST /api/companion/:id/backstory/secret` - Generate new secret
- `PUT /api/companion/:id/backstory/thread/:threadId` - Update thread status
- `POST /api/companion/:id/backstory/secret/:secretId/reveal` - Reveal secret

### Test Results

- **Frontend Build**: Successful (no compilation errors)

---

## Frontend Phase 10: Narrative Queue Display

### Status: COMPLETE

Implemented the Narrative Queue UI for viewing and managing pending story events.

### Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| NarrativeQueuePage | `client/src/components/NarrativeQueuePage.jsx` | Narrative queue management UI | **Done** |

### NarrativeQueuePage Features

**Summary Bar**:
- Urgent, High, Normal counts
- Total pending items

**Tabs**:
- Pending: Items waiting to be delivered
- History: Previously delivered items

**Left Panel - Item List**:
- Priority filter dropdown
- Add manual item button
- Item cards showing:
  - Event type icon
  - Title and priority badge
  - Description preview
  - Created date
- Bulk "Mark All as Delivered" action

**Add Item Form**:
- Event type selection (custom, story_thread, world_change, etc.)
- Priority selection (urgent/high/normal/low/flavor)
- Title and description inputs

**Right Panel - Item Details**:
- Event type and status display
- Priority badge
- Created/delivered timestamps
- Expiration date (if set)
- Full description
- Context data (JSON)
- Related entities (quest, location, companion, NPC)
- Actions: Mark as Delivered, Delete

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `client/src/components/NarrativeQueuePage.jsx` | Narrative queue UI | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `client/src/App.jsx` | Added NarrativeQueuePage import, showNarrativeQueue state, header button, routing | 2026-02-04 |

### API Integration

The NarrativeQueuePage uses the following backend endpoints:
- `GET /api/narrative-queue/:characterId` - Load pending items
- `GET /api/narrative-queue/:characterId/history` - Load delivery history
- `POST /api/narrative-queue` - Add manual item
- `POST /api/narrative-queue/deliver` - Mark items as delivered
- `DELETE /api/narrative-queue/:itemId` - Delete pending item

### Test Results

- **Frontend Build**: Successful (no compilation errors)

---

## Frontend Phase 11: Generation Controls

### Status: COMPLETE

Implemented the Generation Controls UI for triggering AI content generation.

### Components Created

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| GenerationControlsPage | `client/src/components/GenerationControlsPage.jsx` | AI content generation controls | **Done** |

### GenerationControlsPage Features

**Navigation Panel**:
- Quests section
- Locations section
- World Events section
- Backstories section

**Quest Generation**:
- Quest type selection (Main/Side/One-Time/Companion)
- Theme/type customization
- Companion selection for companion quests
- One-click generation with result display

**Location Generation**:
- Generation type (Single/Region/Dungeon)
- Location type selection (city, town, ruins, etc.)
- Region name and type for region generation
- Dungeon type selection
- Danger level slider
- Theme customization

**World Content Generation**:
- World event generation with type selection
- Faction goal generation with faction selection
- Event types: political, economic, military, natural, magical, etc.

**Backstory Generation**:
- List of companions with quick-generate buttons
- One-click backstory generation per companion

**Result Panel**:
- Displays generated content details
- Shows quest title, premise, antagonist
- Shows location name, type, description
- Shows event/goal titles and descriptions
- Shows backstory summary and thread/secret counts

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `client/src/components/GenerationControlsPage.jsx` | AI generation controls UI | 2026-02-04 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `client/src/App.jsx` | Added GenerationControlsPage import, showGeneration state, header button, routing | 2026-02-04 |

### API Integration

The GenerationControlsPage uses the following backend endpoints:
- `POST /api/quest/generate/main` - Generate main quest
- `POST /api/quest/generate/side` - Generate side quest
- `POST /api/quest/generate/one-time` - Generate one-time quest
- `POST /api/quest/generate/companion` - Generate companion quest
- `POST /api/location/generate` - Generate single location
- `POST /api/location/generate/region` - Generate region
- `POST /api/location/generate/dungeon` - Generate dungeon
- `POST /api/living-world/generate/faction-goal/:factionId` - Generate faction goal
- `POST /api/living-world/generate/world-event/:campaignId` - Generate world event
- `POST /api/companion/:id/backstory/generate` - Generate backstory

### Test Results

- **Frontend Build**: Successful (no compilation errors)

---

## Frontend Implementation Complete

All 11 frontend phases have been successfully implemented:

1. ~~**Faction System UI**~~ - COMPLETE
2. ~~**World Events UI**~~ - COMPLETE
3. ~~**Travel System UI**~~ - COMPLETE
4. ~~**NPC Relationships Panel**~~ - COMPLETE
5. ~~**Living World Dashboard**~~ - COMPLETE
6. ~~**Campaign Management UI**~~ - COMPLETE
7. ~~**Quest Tracker Panel**~~ - COMPLETE
8. ~~**Location Map/List**~~ - COMPLETE
9. ~~**Companion Backstory View**~~ - COMPLETE
10. ~~**Narrative Queue Display**~~ - COMPLETE
11. ~~**Generation Controls**~~ - COMPLETE

---

## Post-Implementation Polish

### Status: COMPLETE

Date: 2026-02-04

### Improvements Made

#### 1. Travel Constants Endpoint Fix
- **Issue**: `/api/travel/constants` returned "Journey not found" error
- **Cause**: Route defined after `/:id` wildcard route, which matched "constants" as an ID
- **Fix**: Moved `/constants` route to top of file before dynamic routes
- **File**: `server/routes/travel.js`

#### 2. Standardized Error Handling
- **Created**: `server/utils/errorHandler.js` utility
- **Functions**:
  - `handleServerError(res, error, context)` - Logs errors and returns consistent 500 response
  - `notFound(res, resource)` - Returns standardized 404 response
  - `validationError(res, message)` - Returns standardized 400 response
- **Error Codes**: `NOT_FOUND`, `VALIDATION_ERROR`, `DATABASE_ERROR`, `INTERNAL_ERROR`, `CONFLICT`
- **Updated Routes**: character.js, faction.js, travel.js

#### 3. Navigation Reorganization
- **Problem**: Header had 18+ individual buttons, cluttered UI
- **Solution**: Created dropdown-based navigation with 4 categories
- **Created**: `client/src/components/NavigationMenu.jsx`
- **Categories**:
  | Category | Features |
  |----------|----------|
  | Character | Character Sheet, Companions, Downtime, Settings |
  | World | Factions, World Events, Travel, Locations, Living World, NPC Generator, Relationships |
  | Story | Campaigns, Quests, Backstories, Narrative Queue |
  | Play | AI Dungeon Master, Campaign Stats, Generate Content |
- **Refactored**: `App.jsx` from 20+ boolean states to single `activeView` state
- **Benefits**: Cleaner UI, organized features, easier navigation

### Files Created

| File | Purpose |
|------|---------|
| `server/utils/errorHandler.js` | Standardized API error handling |
| `client/src/components/NavigationMenu.jsx` | Dropdown navigation component |

### Files Modified

| File | Changes |
|------|---------|
| `server/routes/travel.js` | Moved /constants route, added error handler import |
| `server/routes/character.js` | Added error handler utilities |
| `server/routes/faction.js` | Replaced manual error handling with utilities |
| `client/src/App.jsx` | Replaced 20+ show* states with single activeView state, integrated NavigationMenu |

### Test Results

- **Travel Constants**: `GET /api/travel/constants` now returns correct data
- **Frontend Build**: Successful (no compilation errors)
- **Navigation**: All 18 features accessible via 4 dropdown menus

---

## Phase J: Campaign Plan System

### Status: COMPLETE

Date: 2026-02-07

Implemented AI-powered campaign plan generation using Claude Opus 4.5, creating comprehensive living world plans from character backstories and campaign descriptions.

### Services Created

| Service | File | Status |
|---------|------|--------|
| Campaign Plan Service | `server/services/campaignPlanService.js` | **Done** (NEW) |

### Campaign Plan API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/campaign/:id/plan` | GET | Get campaign plan |
| `/api/campaign/:id/plan/generate` | POST | Generate plan with Opus 4.5 |

### Campaign Plan Structure

Generated plans include:
- **main_quest** — Title, summary, hook, stakes, 3-act structure
- **npcs** — Array of NPCs with descriptions, roles, motivations, from_backstory flag
- **factions** — Array with goals, allegiances, relationship_to_party
- **locations** — Array with descriptions and significance
- **side_quests** — Array of supplementary quest hooks
- **world_timeline** — Events independent of player action
- **dm_notes** — Tone guidance, twists, backup hooks, session zero tips

### Campaign Plan Viewer

**File**: `client/src/components/CampaignPlanPage.jsx`

- Displays all plan sections with collapsible accordions
- **Spoiler system**: Reddit-style spoiler covers hide DM-sensitive content (NPC roles, faction allegiances, secrets)
- Click to reveal individual spoilers
- Red accent styling for spoiler-covered content
- Progress bar with animated steps during generation

### DM Session Integration

- `getPlanSummaryForSession()` generates condensed plan context for AI DM prompts
- Campaign context endpoint: `/api/dm-session/campaign-context/:characterId`
- When campaign plan exists, DM session setup form is gated (shows only Content Preferences + Begin Adventure)
- NPC selection hidden when campaign plan exists (plan NPCs used automatically)
- "Campaign Plan Loaded" banner shows quest title in session setup

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `server/services/campaignPlanService.js` | Opus 4.5 plan generation + plan summary for sessions | 2026-02-07 |
| `client/src/components/CampaignPlanPage.jsx` | Campaign plan viewer with spoiler system | 2026-02-07 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `server/routes/campaign.js` | Added plan GET/POST endpoints | 2026-02-07 |
| `server/routes/dmSession.js` | Added campaign context endpoint, plan summary injection | 2026-02-07 |
| `server/database.js` | Added `campaign_plan` column to campaigns table | 2026-02-07 |
| `client/src/App.jsx` | Added CampaignPlanPage routing | 2026-02-07 |
| `client/src/components/DMSession.jsx` | Gated setup form, hidden NPC selection, plan loaded banner | 2026-02-07 |

---

## Phase K: Backstory Parser

### Status: COMPLETE

Date: 2026-02-07

Implemented AI-powered backstory parsing that extracts structured elements from freeform character backstories.

### Services Created

| Service | File | Status |
|---------|------|--------|
| Backstory Parser Service | `server/services/backstoryParserService.js` | **Done** (NEW) |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/character/:id/parsed-backstory` | GET | Get parsed backstory |
| `/api/character/:id/parsed-backstory/parse` | POST | Parse backstory with AI |
| `/api/character/:id/parsed-backstory` | PUT | Update parsed elements |

### Parsed Elements

The parser extracts:
- **Characters** — NPCs mentioned in backstory with roles and relationships
- **Locations** — Places with types (hometown, birthplace, current, visited)
- **Factions** — Organizations and groups
- **Events** — Key events in the character's history
- **Story Hooks** — Unresolved plot threads for DM use

### Features

- AI parses freeform backstory into structured JSON elements
- Player can edit, add, and remove parsed elements
- Re-parse preserves manual edits (merges with existing data)
- Parsed backstory feeds into campaign plan generation
- Parsed locations used for starting location auto-detection

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `server/services/backstoryParserService.js` | AI backstory parsing service | 2026-02-07 |
| `client/src/components/BackstoryParserPage.jsx` | Backstory parser UI with edit capabilities | 2026-02-07 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `server/routes/character.js` | Added parsed backstory endpoints | 2026-02-07 |
| `server/database.js` | Added `parsed_backstory` column to characters table | 2026-02-07 |
| `client/src/App.jsx` | Added BackstoryParserPage routing | 2026-02-07 |
| `client/src/components/NavigationMenu.jsx` | Added Backstory Parser to Character menu | 2026-02-07 |

---

## Phase L: Streamlined Gameplay Experience

### Status: COMPLETE

Date: 2026-02-07

Major UX overhaul reducing manual steps from character creation to playing. Previous flow required 4+ manual steps; new flow: **Create Character → Create Campaign (auto-pipeline) → Play**.

### L1: Starting Location Dropdown

**File**: `client/src/components/CampaignsPage.jsx`

- Replaced free-text starting location input with grouped `<select>` dropdown
- Uses `STARTING_LOCATIONS` from `client/src/data/forgottenRealms.js` (15 locations)
- **Major Cities**: Waterdeep, Baldur's Gate, Neverwinter, Luskan, Silverymoon, Mithral Hall, Candlekeep, Menzoberranzan, Calimport, Athkatla
- **Regions**: Icewind Dale, Sword Coast Wilderness, Anauroch, Cormanthor, Chult
- **Custom Location**: Text input fallback for homebrew settings
- Auto-detects starting location from parsed backstory (matches hometown/birthplace/current against location list)
- Shows "(from backstory)" indicator when auto-selected

### L2: Auto-Pipeline on Campaign Creation

**File**: `client/src/components/CampaignsPage.jsx`

When creating a campaign, an automatic pipeline runs:

| Step | Action | API |
|------|--------|-----|
| 1 | Create campaign | POST `/api/campaign` |
| 2 | Assign character | POST `/api/campaign/:id/assign-character` |
| 3 | Parse backstory | POST `/api/character/:id/parsed-backstory/parse` |
| 4 | Generate campaign plan | POST `/api/campaign/:id/plan/generate` |
| 5 | Done | "Play Now" button appears |

- Progress UI with step indicators (checkmarks, spinner, pending dots)
- Animated CSS progress bar during plan generation
- Error handling with retry button
- Backstory parsing skipped if no backstory or already parsed
- Pipeline continues if parsing fails (plan generation handles missing parsed data)

### L3: Play Button on Home Screen

**File**: `client/src/App.jsx`

- `campaignPlanReady` state checks if character's campaign has a plan with `main_quest`
- Fetches `/api/campaign/:id/plan` when selected character changes
- Prominent purple-gradient Play button appears between character grid and adventure history
- One click to jump straight into DM session

### L4: Gameplay Tabs (Adventure / Downtime / Stats)

**File**: `client/src/components/DMSession.jsx`

- Three-tab interface during active DM sessions
- **Adventure** tab: Main gameplay (messages + input)
- **Downtime** tab: Embedded `Downtime` component (self-contained)
- **Stats** tab: Embedded `MetaGameDashboard` component (self-contained)
- Tab bar with purple active indicator
- Tabs reset to "Adventure" when new session starts
- Players can switch between tabs without leaving their session

### L5: Home Page Navigation Hub

**Files**: `client/src/App.jsx`, `client/src/components/NavigationMenu.jsx`

Redesigned home page from a cluttered dashboard into a clean navigation hub:
- **Green Play button** at the top of the page (visible when campaign plan ready)
- **Character selector** for switching characters
- **8 navigation cards** in a responsive grid with color accents and descriptions
- Removed adventure generation, adventure history, and meta game from home page

Combined "Downtime & Stats" page brings together all between-session activities:
- Downtime activities (left) + Adventure system (right)
- MetaGameDashboard + Adventure History (full width below)

Trimmed dropdown navigation to 3 menus (8 items, down from 4 menus / 14 items):
- **Character**: Sheet, Companions, Backstory Parser, Downtime & Stats, Settings
- **Story**: Campaigns, Campaign Plan
- **Play**: AI Dungeon Master

Hidden pages (code exists, lazy-loaded, not shown in menus):
- Locations, Factions, Travel, World Events, Living World, Narrative Queue, NPC Generator, NPC Relationships, Quests, Companion Backstories, Campaign Stats, Generate Content

### L6: Bundle Size Optimization

**File**: `client/src/App.jsx`

Lazy-loaded 13 components with `React.lazy()` + `Suspense` to reduce the initial bundle:
- **Main bundle**: 1,321 kB → 971 kB (26.5% reduction)
- **Gzipped**: 320 kB → 244 kB (23.7% reduction)
- DMSession (101 kB) and CampaignPlanPage (27 kB) lazy-loaded behind routes
- 11 hidden pages (222 kB combined) split into separate chunks loaded on demand
- `Suspense` boundary wraps all view routing with a loading fallback

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `client/src/components/CampaignsPage.jsx` | Starting location dropdown, auto-pipeline, progress UI, Play Now button | 2026-02-07 |
| `client/src/App.jsx` | Home page nav hub, green Play button, combined Downtime & Stats view, `onNavigateToPlay` prop | 2026-02-07 |
| `client/src/components/DMSession.jsx` | Gameplay tabs (Adventure/Downtime/Stats), tab bar, conditional content | 2026-02-07 |
| `client/src/components/NavigationMenu.jsx` | Trimmed to 3 menus, added Downtime & Stats | 2026-02-07 |

### Test Results

- **Campaign Plan API**: All tests passing (plan retrieval, structure validation, null for new campaigns)
- **Campaign Creation Pipeline**: Full pipeline tested (create → assign → parse → generate → cleanup)
- **Backstory Parser API**: Parse endpoint verified
- **Frontend Build**: 78 modules, 971 kB main + 14 lazy chunks, no errors
- **Play Button**: Correctly shows/hides based on campaign plan readiness
- **Overall**: 104/104 tests passing (100% pass rate)

---

## Phase M: Architecture Refactor & Living World Enhancements

### Status: COMPLETE

Date: 2026-02-07

Backend architecture refactoring (module splits) and living world emergent behavior enhancements. Based on an AI architectural review that identified 6 issues — 4 addressed here, 2 deferred to FUTURE_FEATURES.md.

### M1: Split ollama.js (1715 lines → 3 modules)

Separated concerns into focused modules with backward-compatible re-exports:

| New File | Purpose | ~Lines |
|----------|---------|--------|
| `server/services/llmClient.js` | Raw Ollama API client (chat, status, models) | 90 |
| `server/services/dmPromptBuilder.js` | DM system prompt + all formatters | 1300 |
| `server/services/ollama.js` (slimmed) | Session orchestration (start/continue/summarize) | 300 |

**Re-export strategy**: `ollama.js` re-exports from `llmClient.js` and `dmPromptBuilder.js`, so all 7 consumer files work without import changes.

### M2: Split dmSession.js Route (2362 lines → route + service)

Extracted business logic from the monolithic route handler:

| New File | Purpose | ~Lines |
|----------|---------|--------|
| `server/services/dmSessionService.js` | Session business logic + event emission | 500 |

**Extracted to service**:
- Detection helpers: `parseNpcJoinMarker()`, `detectDowntime()`, `detectRecruitment()`
- Analysis: `buildAnalysisPrompt()`, `parseAnalysisResponse()`, `calculateSessionRewards()`, `calculateHPChange()`, `calculateGameTimeAdvance()`
- Campaign notes: `buildNotesExtractionPrompt()`, `appendCampaignNotes()`
- NPC extraction: `buildNpcExtractionPrompt()`, `saveExtractedNpcs()`
- Name tracking: `extractAndTrackUsedNames()`
- Event emission: `emitSessionEvents()`, `emitSessionEndedEvent()`

### M3: DM Session Event Bus Integration

Connected DM sessions to the event bus — `onDMSessionEnded()` was defined in `narrativeIntegration.js` but never called.

**Events emitted at session end**:

| Event | Source | Listeners |
|-------|--------|-----------|
| `NPC_INTERACTION` | Each NPC extracted from session | Quest progress checker |
| `LOCATION_VISITED` | Locations from extracted notes | Quest progress checker |
| `ITEM_OBTAINED` | Items from inventory analysis | Quest progress checker |
| `DM_SESSION_ENDED` | Session end handler | Companion trigger checker |

### M4: Living World Emergent Behavior

Enhanced faction tick processing from deterministic to emergent:

**Faction Interference** (`factionService.js`):
- Hostile/enemy/rival factions reduce each other's progress by `power_level * 0.3`
- Allied/friendly factions boost each other by `power_level * 0.15`
- Uses `faction_relationships` JSON column (already existed)

**Wider Variance & Random Events** (`factionService.js`):
- Variance: 0.5x-1.5x (was 0.8x-1.2x)
- 8% chance/day per goal: setback (lose 10-30% progress)
- 5% chance/day per goal: breakthrough (gain 50-100% bonus)

**Rival Reactions** (`livingWorldService.js`):
- At milestones >= 50%, hostile rivals have 40% chance to spawn counter-events
- Counter-events: "[Rival] Moves Against [Faction]" with stages and player options

**Power Shifts** (`livingWorldService.js`):
- Goal completion with `major` stakes: +1 power level
- Goal completion with `catastrophic` stakes: +2 power level
- Event effects track the power change

### Files Created

| File | Purpose | Date |
|------|---------|------|
| `server/services/llmClient.js` | Ollama API client (chat, status, models) | 2026-02-07 |
| `server/services/dmPromptBuilder.js` | DM system prompt + all formatters | 2026-02-07 |
| `server/services/dmSessionService.js` | Session business logic + event emission | 2026-02-07 |

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `server/services/ollama.js` | Removed ~1400 lines, imports from llmClient + dmPromptBuilder, re-exports | 2026-02-07 |
| `server/routes/dmSession.js` | Moved ~600 lines of business logic to service, added event emission | 2026-02-07 |
| `server/services/factionService.js` | Added faction interference, wider variance, random disruptions/breakthroughs | 2026-02-07 |
| `server/services/livingWorldService.js` | Added rival reactions on milestones, power shifts on completion | 2026-02-07 |
| `FUTURE_FEATURES.md` | Added Database Migration System + Frontend Component Decomposition entries | 2026-02-07 |

### Test Results

- **Client Build**: Successful (78 modules, no import errors)
- **Server Startup**: All imports resolved, database initialized, narrative systems initialized

---

## Phase N: World State Snapshot for DM Sessions

### Status: COMPLETE

Date: 2026-02-08

Inject dynamic living world state into the AI DM's system prompt at session start. The AI DM now sees faction standings, active world events, NPC relationships (with promises/debts/secrets), known faction goals, and discovered locations — enabling it to reference ongoing events, adjust NPC behavior based on faction standing, and follow up on promises/debts naturally.

### Implementation

**`formatWorldStateSnapshot(worldState)`** in `dmPromptBuilder.js`:

Compresses 5 data sources into a `=== CURRENT WORLD STATE ===` prompt section (~250-500 tokens):

| Section | Hard Cap | Data Source | Filtering |
|---------|----------|-------------|-----------|
| Faction Standings | 6 | `getCharacterWorldView()` | Skip neutrals unless member |
| World Events | 5 | `getEventsVisibleToCharacter()` | All visible (public + discovered) |
| NPC Relationships | 8 | `getCharacterRelationshipsWithNpcs()` | Skip neutral with no promises/debts/secrets |
| Known Faction Goals | 4 | `getCharacterWorldView()` | Character-scoped (discovered goals only) |
| Discovered Locations | 8 | `getDiscoveredLocations()` | visited/familiar/home_base only |

**Helper functions**:
- `getStandingBehavior(label)` — maps standing labels (exalted→enemy) to NPC behavior hints
- `getTrustLabel(trust)` — maps numeric trust (-100 to +100) to None/Low/Moderate/High/Absolute

**Data gathering** in `dmSession.js` POST `/start`:
- 5 service calls via `Promise.all` (no added serial latency)
- Wrapped in try/catch — session starts normally if queries fail
- Gated behind `character.campaign_id` (skipped for characters without campaigns)

**Prompt placement**: After `formatCampaignPlan()`, before story threads context — broadest context to most specific.

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `server/services/dmPromptBuilder.js` | Added `formatWorldStateSnapshot()`, `getStandingBehavior()`, `getTrustLabel()`, wired into `createDMSystemPrompt()` | 2026-02-08 |
| `server/routes/dmSession.js` | Added 5 service imports, Promise.all world state gathering, `worldState` in sessionConfig | 2026-02-08 |

### Test Results

- **Client Build**: Successful (no import errors)
- **Server Startup**: All imports resolved, both modified modules load correctly

---

## Phase O: DMG Magic Items & 5-Tier Rarity System

### Status: COMPLETE

Date: 2026-02-09

Added ~130 iconic D&D 5e Dungeon Master's Guide magic items across 5 rarity tiers with smart distribution based on shop type, settlement prosperity, and character level. Includes 13 cursed items with a disguise system, prosperity-based magic item caps, and expanded session-end loot tables.

### Rarity System

**5-Tier Rarity**: `RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, very_rare: 3, legendary: 4 }`

| Rarity | Level Gate | Weight | Color |
|--------|-----------|--------|-------|
| Common | 1+ | 6x | — |
| Uncommon | 3+ | 3x | `#a78bfa` purple |
| Rare | 5+ | 1x | `#60a5fa` blue |
| Very Rare | 9+ | 0.5x | `#c084fc` violet |
| Legendary | 13+ | 0.25x | `#ff8c00` orange |

### Prosperity-Based Magic Caps

`PROSPERITY_CONFIG` updated with `magicCaps` and `cursedChance` per tier:

| Tier | Magic Caps | Cursed Chance | Gold Purse |
|------|-----------|---------------|------------|
| Poor | uncommon:1 | 15% | 50gp |
| Modest | uncommon:3, rare:1 | 8% | 200gp |
| Comfortable | rare:2 | 5% | 500gp |
| Wealthy | rare:3, very_rare:1 | 3% | 1200gp |
| Aristocratic | rare:4, very_rare:2, legendary:1 | 2% | 2500gp |

### Magic Items Added (~130 total)

| Category | Count | Examples |
|----------|-------|---------|
| Magic Weapons | ~25 | Moon-Touched Sword, Flame Tongue, Sun Blade, Vorpal Sword, Holy Avenger |
| Magic Armor | ~13 | Mithral Armor, Adamantine Armor, +2/+3 Armor, Animated Shield |
| Wondrous Items | ~50 | Bag of Holding, Gauntlets of Ogre Power, Cloak of Displacement, Staff of the Magi |
| Rings | ~8 | Ring of Protection, Ring of Spell Storing, Ring of Invisibility |
| Wands/Rods/Staves | ~10 | Wand of Magic Missiles, Rod of Lordly Might, Staff of Power |
| Scrolls | ~6 | Spell Scroll Level 1 through Level 9 |
| Potions | ~19 new | Potion of Heroism, Potion of Speed, Oil of Sharpness |
| Gems | 6 new | Diamond, Black Opal, Jacinth (1000gp), Flawless Diamond (5000gp) |

### Cursed Items (13)

Items with `cursed: true`, `appears_as`, and `curse_description` fields:
- Bag of Devouring → appears as Bag of Holding
- Berserker Axe → appears as +1 Greataxe
- Sword of Vengeance → appears as +1 Longsword
- Armor of Vulnerability → appears as Armor of Resistance
- Shield of Missile Attraction → appears as +2 Shield
- Cloak of Poisonousness → appears as Cloak of Protection
- Necklace of Strangulation → appears as Necklace of Adaptation
- Dust of Sneezing and Choking → appears as Dust of Disappearance
- Scarab of Death → appears as Scarab of Protection
- Medallion of Thought Projection → appears as Medallion of Thoughts
- Ring of Clumsiness → appears as Ring of Free Action
- Deck of Illusions → appears as Deck of Many Things
- Potion of Poison → appears as Potion of Healing

### Blacksmith Magic Pool

Created derived pool: `MAGIC_WEAPONS_ARMOR = MAGIC_ITEMS.filter(i => ['weapon', 'armor', 'shield'].includes(i.category) && !i.cursed)`

Added to blacksmith merchant type: `['weapons', 'armor', 'ammunition', 'magic_weapons_armor']`

Result: village blacksmith (poor) gets nothing magical; city blacksmith (wealthy) might stock 1 rare magic weapon.

### generateInventory() Rewrite

1. Separate cursed items from main pool before selection
2. Select items with weighted random (existing logic)
3. Enforce `magicCaps` — count all uncommon+ items by rarity, remove excess
4. Cursed injection: roll `cursedChance`, if hit, **replace** an existing same-rarity item with a cursed fake (maintains cap integrity)
5. Cursed items use `appears_as` as display name in shop UI

### AI Cursed Item Awareness

Inventory injection in `dmSession.js` annotates cursed items:
```
- Bag of Holding (250gp) [CURSED: actually Bag of Devouring — items placed inside are destroyed]
```

System message includes conditional cursed instructions: "If an item is marked [CURSED], do NOT reveal it is cursed. The curse reveals itself only when used or identified with Identify/Detect Magic."

### Session-End Loot Tables

`EQUIPMENT_BY_LEVEL` in `rewards.js` expanded from 5 items per tier to 8-15 items:
- Level 1: 8 common items (Driftglobe, Moon-Touched Sword, etc.)
- Level 5: 15 uncommon items (Bag of Holding, Gauntlets of Ogre Power, etc.)
- Level 10: 15 rare items (Flame Tongue, Sun Blade, Cloak of Displacement, etc.)
- Level 15: 12 very rare items (Dancing Sword, Scimitar of Speed, Staff of Power, etc.)

### Files Modified

| File | Changes | Date |
|------|---------|------|
| `server/data/merchantLootTables.js` | 5-tier rarity, ~130 magic items, cursed items, prosperity caps, blacksmith pool, generateInventory rewrite | 2026-02-09 |
| `server/routes/dmSession.js` | Cursed item `[CURSED]` annotations in AI inventory injection, conditional cursed instructions | 2026-02-09 |
| `server/config/rewards.js` | Expanded EQUIPMENT_BY_LEVEL to 8-15 items per tier with DMG magic items | 2026-02-09 |
| `server/services/merchantService.js` | Carry cursed/true_name/curse_description fields through ensureItemAtMerchant | 2026-02-09 |
| `client/src/components/DMSession.jsx` | Very rare (#c084fc) and legendary (#ff8c00) rarity colors in shop UI | 2026-02-09 |

### Test Results

- **Inventory Generation Tests**: 14 tests, all passing
- **Cap Enforcement**: Zero cap violations across 600 test runs (100 runs × 6 scenarios)
- **Cursed Item Distribution**: Cursed items appear at expected rates per prosperity tier
- **Level Gating**: Verified uncommon/rare/very_rare/legendary items respect level thresholds
- **Blacksmith Pool**: Confirmed blacksmiths only stock weapons/armor magic items
