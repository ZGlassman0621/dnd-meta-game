# Recent Improvements

## Latest: Full Spell Management System (2026-02-21)

Complete D&D 5e spell system with 284 spells across all levels, spell slot tracking, prepared/known spell management, and level-up spell selection.

### Phase 1: Spell Data (284 Spells, All Classes, Levels 1-9)
Split the monolithic `spells.json` into per-level files under `client/src/data/spells/`:
- `cantrips.json` — Cantrips organized by class (13 classes)
- `spells-1st.json` through `spells-9th.json` — 284 leveled spells with name, school, casting time, range, duration, components, classes, description, damage/healing/ritual where applicable
- `index.js` — Barrel file re-exporting the same `{ cantrips, spells }` shape
- All 4 component imports updated (CharacterSheet, CharacterCreationWizard, QuickReferencePanel, PartyBuilder)

### Phase 2: Spell Slot Display
Added spell slot tracker to CharacterSheet Spells tab:
- Fetches from existing `GET /api/character/spell-slots/:id` endpoint
- One row per spell level with filled/empty circles showing available vs used slots
- Use/restore buttons per level with optimistic UI updates
- Warlock "Pact Magic Slots" displayed separately

### Phase 3: Prepared Spell Management (Cleric, Druid, Paladin, Wizard, Artificer)
Inline spell preparation UI in CharacterSheet:
- Max prepared calculation per class: Cleric/Druid/Wizard = ability mod + level, Paladin/Artificer = ability mod + floor(level/2)
- Subclass spells shown as "always prepared" (don't count toward limit, not removable)
- Prepare panel with level filter tabs, search field, checkbox toggles
- Wizard spellbook mode: prepares only from `known_spells` (spellbook contents)
- Save/cancel with `PUT /api/character/:id`

### Phase 4: Known Spell Management (Bard, Ranger, Sorcerer, Warlock)
Known spell tracking UI in CharacterSheet:
- Known spells list grouped by level with forget button
- Max known from `SPELLS_KNOWN` progression tables
- Learn New Spell panel with level filter and search
- Wizard "Add to Spellbook" button for scroll/found spell additions

### Phase 5: Level-Up Spell Integration
New "Spells" step in the level-up flow (between Choices and Review):
- **Known casters** (Bard, Sorcerer, Warlock, Ranger): Pick new spells from class list, optionally swap 1 known spell
- **Wizard**: Add 2 spells to spellbook from any castable level
- **New cantrips**: Select from class cantrip list when cantrips known increases
- **Prepared casters** (Cleric, Druid, Paladin): Skip step (change spells on long rest)
- Progress bar dynamically shows 3 or 4 steps based on class
- Review step shows spell selections summary
- Backend persists `newCantrips`, `newSpells`, and `swapSpell` to character record

### Files Created
- `client/src/data/spells/cantrips.json` — Cantrips by class
- `client/src/data/spells/spells-1st.json` through `spells-9th.json` — 9 spell level files
- `client/src/data/spells/index.js` — Barrel file

### Files Modified
- `client/src/components/CharacterSheet.jsx` — Spell slots, prepared spells, known spells UI
- `client/src/components/LevelUpPage.jsx` — Spell selection step, cantrip/spell pickers, swap UI
- `client/src/components/CharacterCreationWizard.jsx` — Import update
- `client/src/components/QuickReferencePanel.jsx` — Import update
- `client/src/components/PartyBuilder.jsx` — Import update
- `client/src/data/classes.json` — Fixed Wizard ("Spellbook") and Artificer ("All prepared") spellsKnown
- `server/routes/character.js` — Level-up endpoint persists newCantrips, newSpells, swapSpell
- `client/src/index.css` — Spell option hover style

---

## Defensive Hardening — All Systems A+ (2026-02-20)

Cross-system audit identified 6 patterns of latent bugs across 11+ services. All fixed in a single pass:

### 1. safeParse() Utility — 60 crash vectors eliminated
- Created `server/utils/safeParse.js` — wraps JSON.parse with try/catch, returns fallback on failure
- Deployed across: questService, factionService, worldEventService, travelService, livingWorldService, dmSession routes, character routes, companion routes
- Every `JSON.parse()` in the read path now fails gracefully instead of crashing the server

### 2. Falsy-Zero Bug Fix (|| → ??)
- `power_level || 5` treats `power_level=0` as falsy, silently defaulting to 5
- Fixed in factionService (3 occurrences) and livingWorldService (2 occurrences) using `??`

### 3. Risk Level & Level Bounds Validation (rewards.js)
- Level clamped to `[1, 20]` range in `getBaseGoldReward()` and `getBaseXPReward()`
- All reward/success functions fall back to `RISK_MULTIPLIERS.medium` on unknown risk levels
- Prevents crashes on invalid enum values from corrupted session data

### 4. Silent Failure Propagation
- `completeQuest()`: Quest reward errors now re-throw with descriptive message
- `processLivingWorldTick()`: Total-failure catch now re-throws instead of returning empty results
- `applyQuestRewards()`: Added `Number.isFinite()` validation on gold and XP values

### 5. Null Guards in Tick Loops
- `processFactionTick()`: Added `if (!factionMap[goal.faction_id]) continue` — prevents crash when faction deleted between initial fetch and goal processing
- `advanceQuestStage()`: Added `!Array.isArray(quest.stages)` guard before checking stage bounds

### 6. Numeric Edge Case Guards
- `calculateTravelTime()`, `calculateRationsNeeded()`, `estimateTravelCost()`: Guard against negative, NaN, and Infinity inputs
- DM session `daysToAdd`: Added `Number.isFinite()` check alongside type check

**Test results: 650+ assertions across 9 suites, 0 failures.**

---

## A+ System Upgrades (2026-02-20)

Following a deep audit that brought 5 systems to A grade, 8 additional improvements bring them all to A+:

### 1. Transaction Wrapping for Import Pipeline (A → A+)
The entire campaign import now runs inside a single SQLite write transaction:
- All DB inserts (campaign, character, sessions, companions, quests) wrapped in `db.transaction('write')`
- Automatic `tx.rollback()` on any failure — no partial imports left in the database
- Non-critical enrichment (merchants, relational records) runs post-commit in `createPostImportRecords()`
- Partial enrichment failures logged but don't fail the import

### 2. Merchant Conflict Propagation as 409 (A → A+)
Merchant transaction conflicts are no longer silently swallowed:
- Removed try/catch that previously `console.warn`'d and continued on merchant update failure
- Merchant inventory update must succeed before returning 200 to the client
- Conflict errors (optimistic locking failure) return **HTTP 409** with descriptive message
- Prevents asymmetric state where character inventory is committed but merchant inventory is stale

### 3. Shared parseMarkerPairs Export (A → A+)
Eliminated code duplication between marker detection and condition detection:
- `parseMarkerPairs()` in dmSessionService.js changed from local function to `export function`
- `conditions.js` now imports the shared parser instead of maintaining a duplicate `parseConditionPairs`
- Single source of truth for all key="value" pair parsing across the codebase

### 4. Defensive Plan Mutations (A → A+)
All plan mutation functions now have try/catch + input validation:
- `updatePlanSection()`: Try/catch on JSON.parse, descriptive error on corrupted plan data
- `addWorldEvent()`: Requires `event.title`, ensures `world_timeline.events` is array before push
- `addNPC()`: Requires `npc.name`, ensures `plan.npcs` is array before push
- Array guards prevent `TypeError: Cannot read properties of undefined (reading 'push')`

### 5. Section Allowlist for Plan Updates (A → A+)
`updatePlanSection()` now validates against a strict allowlist of 13 permitted sections:
- Allowed: `main_quest`, `side_quests`, `npcs`, `locations`, `factions`, `merchants`, `themes`, `world_timeline`, `world_state`, `dm_notes`, `potential_companions`, `session_continuity`, `npc_relationship_system`
- Rejects any attempt to overwrite metadata fields (`id`, `name`, `campaign_id`, etc.)
- Returns 400 with `Invalid plan section` error for disallowed keys

### 6. Inventory Version Locking (A → A+)
Full optimistic locking on merchant inventories with an `inventory_version` counter:
- New `inventory_version INTEGER DEFAULT 0` column on `merchant_inventories`
- `updateMerchantAfterTransaction()` checks both `gold_gp` AND `inventory_version` in WHERE clause
- All 4 inventory-modifying functions increment version: `updateMerchantAfterTransaction`, `restockMerchant`, `addItemToMerchant`, `ensureItemAtMerchant`
- Prevents silent overwrites from concurrent browser tabs or rapid API calls

### 7. Comprehensive Marker Detection Test Suite (NEW)
128-assertion test suite covering all marker parsing:
- `parseMarkerPairs` core: double/single/no quotes, spaces around `=`, empty values, mixed formats
- All 7 detection functions: standard format, flexible quoting, missing fields, null/empty input
- Condition markers: reversed field order, flexible formatting
- Detection/stripping consistency: every detected marker is also stripped from displayed narrative

### 8. Deeper Relational Record Population (A → A+)
Imported campaign plans now create richer database records:
- **Factions**: 14 columns (was 7) — adds alignment, scope, goals, leader, headquarters, resources, power_level
- **Locations**: 14 columns (was 7) — adds type, region, description, tags, environment, population, government, notable_features
- **NPCs**: 17 columns (was 10) — adds occupation, personality, goals, secrets, physical_description, voice_description, backstory

### Files Changed
- `server/services/campaignImportService.js` — Transaction wrapping, post-import enrichment, deeper column mapping
- `server/services/merchantService.js` — `inventory_version` in all 4 update functions
- `server/services/campaignPlanService.js` — Section allowlist, defensive mutations with try/catch + validation
- `server/services/dmSessionService.js` — `parseMarkerPairs` exported
- `server/data/conditions.js` — Uses shared import instead of duplicate parser
- `server/routes/dmSession.js` — Merchant conflict propagation as 409, passes `inventory_version` to update
- `server/database.js` — `inventory_version` column migration
- `tests/marker-detection.test.js` — NEW: 128 assertions across 10 test groups

### Tests
- **650+ assertions across 9 test suites, all passing**:
  - Marker Detection: 128/128
  - Campaign Import: 125/125
  - Integration: 137/137
  - Moral Diversity: 64/64
  - Companion Skill Checks: 59/59
  - Condition Tracking: 56/56
  - Character Memory: 55/55
  - Combat Tracker: 26/26
  - Loot Systems: 4/4 suites

---

## System Audit Improvements (2026-02-20)

Deep audit of all backend systems identified 5 areas rated below A. All upgraded to A grade:

### 1. Campaign Import — Relational Record Creation (B → A)
Imported campaign plans now populate the living world database tables, not just store the plan JSON:
- **Factions**: Created from `plan.factions` with alignment, scope, goals
- **Locations**: Created from `plan.locations` with type, region, tags
- **NPCs**: Created from `plan.npcs` (skips duplicates already created as companions)
- **Quests**: Side quests and main quest created from plan, linked to character
- Errors per-record are caught and logged without failing the whole import

### 2. Merchant Transactions — Optimistic Locking (B+ → A)
Concurrent merchant transactions can no longer silently overwrite each other:
- `updateMerchantAfterTransaction()` accepts optional `expectedGold` parameter
- Uses `WHERE gold_gp = ?` clause to detect concurrent modifications
- Throws conflict error if another transaction modified the merchant's gold between read and write
- Backward compatible: existing callers without `expectedGold` work unchanged

### 3. Campaign Plan Retrieval — Structure Validation (B+ → A)
`getCampaignPlan()` now defensively handles malformed stored plans:
- Try/catch around JSON.parse — returns null instead of crashing on corrupt data
- Ensures critical arrays exist (`npcs`, `locations`, `factions`, `side_quests`, `merchants`, `themes`)
- Ensures critical objects exist (`world_timeline`, `world_state`, `dm_notes`)
- Prevents downstream crashes from missing plan structure

### 4. DM Session Markers — Robust Parsing (B+ → A)
All 8 AI marker detection functions now use a shared `parseMarkerPairs()` helper:
- **Spaces around `=`**: `Key = "value"` now works (previously required `Key="value"`)
- **Single quotes**: `Key='value'` now works alongside double quotes
- **Unquoted values**: `Key=bareword` now works for simple values
- **Empty quoted values**: `Key=""` parsed as empty string instead of failing silently
- **Warning logs**: When a marker bracket pattern matches but required fields are missing, logs a `[Marker]` warning for debugging
- **Condition markers**: `CONDITION_ADD`/`CONDITION_REMOVE` now accept fields in any order (previously required `Target` before `Condition`)

### 5. NPC Routes — Already Complete (Incomplete → A)
Audit revealed the NPC routes already have full CRUD: 9 endpoints covering create, read, update, delete, list, search, and campaign-filtered queries. No changes needed.

### Tests
- **326 assertions across 3 suites, all passing** (before A+ upgrades)

---

## Character-Optional Import & Plan Protection (2026-02-20)

### Character Section Now Optional
Campaign imports no longer require a character section. You can import just the campaign + plan, then build a fresh character through the app's character creation wizard and assign them via the campaign details panel:

- **Import flow**: Paste JSON with `campaign` + `campaign_plan` only — no `character` section needed
- **Character assignment**: Use the existing "Assign Character" dropdown on the campaign details panel
- **Plan protection**: Imported plans (marked `imported: true`) are protected from being overwritten by the campaign plan generation pipeline — assigning a character won't trigger re-generation
- **UI guidance**: Import result shows contextual message when no character is included, directing users to create and assign one

### Files Changed
- `server/services/campaignImportService.js` — Character optional in validation, early return when no character
- `server/services/campaignPlanService.js` — Guard in `generateCampaignPlan` skips generation for imported plans
- `client/src/components/CampaignsPage.jsx` — Conditional import result UI for null characterId

### Tests
- 125 assertions across 21 test cases (all pass, up from 114/20)
- New: campaign-only import (no character), updated Test 8 from validation-fail to success

---

## Enhanced Campaign Import — Custom Plan Sections & Normalizer (2026-02-20)

### Extended Plan Support for Imported Campaigns
The DM prompt now surfaces rich custom sections from imported campaign plans, making externally-played campaigns feel native:

- **DM Directives**: `never_reveal`, `always_follow`, `narrative_principles` rendered as binding rules in the DM prompt (primacy position)
- **NPC Voice Guides**: Speech patterns, surface behavior, and gated depth levels included inline with NPC listings
- **NPC Secrets**: DM-ONLY secrets shown for each NPC so the DM controls information flow
- **Campaign Metadata**: Year, season, tone, status, active party surfaced as campaign context with timeline enforcement
- **Relationship System**: NPC relationship levels and gating mechanics included when present
- **Session Continuity**: Current state, recent events, unresolved threads placed at prompt end (recency position)
- **Timeline Enforcement**: Campaign year from metadata triggers anachronism prevention rules

### Plan Normalizer
Imported plans are now normalized before storage to prevent crashes and handle schema variations:

- **Field name mapping**: `main_story`→`main_quest`, `characters`→`npcs`, `timeline`→`world_timeline`, `shops`→`merchants`, etc.
- **Required structure creation**: Missing arrays (`npcs`, `locations`, `merchants`, `factions`, `side_quests`, `themes`) and objects (`world_state`, `world_timeline`, `dm_notes`) auto-created
- **Events array wrapping**: Plain `[events]` auto-wrapped in `{description, events}` structure
- **Normalization runs before validation**: Alternative field names pass validation correctly

### Bug Fix
- Fixed `getPlanSummaryForSession` reading `planned_twists` instead of `potential_twists` — DM twists were always null

### Files Changed
- `server/services/campaignPlanService.js` — Extended `getPlanSummaryForSession` with custom sections, detailed NPCs, bug fix
- `server/services/dmPromptBuilder.js` — Enhanced `formatCampaignPlan` with DM directives, voice guides, metadata, relationship system, session continuity, timeline enforcement
- `server/services/campaignImportService.js` — Added `normalizePlan()` with field mapping and structure creation
- `server/routes/campaign.js` — Pre-validation normalization

### Tests
- 125 assertions across 21 test cases (all pass, up from 73/15)
- New: normalizer (missing arrays, field mapping, events wrapping), custom section preservation, plan summary extended fields, campaign-only import

---

## Campaign Import Feature (2026-02-20)

### Campaign Import from JSON
Import complete campaigns played externally (e.g., with Claude AI chatbot) into the app so the AI DM can continue them:

- **New endpoint**: `POST /api/campaign/import` accepts a single JSON payload with all campaign data
- **What gets imported**: Campaign metadata, campaign plan, character (full stat block, optional), session history, and companions
- **What gets created**: Campaign record, character record (auto-assigned to campaign), completed session records, NPC + companion records, merchant inventories from plan
- **Validation**: Required fields checked (campaign name, character name/class/race), optional sections gracefully handled with sane defaults
- **UI**: "Import" button on Campaigns page with JSON textarea, client-side validation, and pipeline progress display
- **Sonnet upgraded**: DM sessions now use `claude-sonnet-4-6` (was `claude-sonnet-4-5`)

### Files Changed
- `server/services/campaignImportService.js` — New: validation + orchestrated DB writes
- `server/routes/campaign.js` — New `POST /import` route
- `server/index.js` — Increased JSON body size limit to 2MB
- `client/src/components/CampaignsPage.jsx` — Import button, JSON textarea, pipeline progress
- `server/services/claude.js` — Sonnet model updated to `claude-sonnet-4-6`

### Tests
- 73 assertions across 15 test cases (all pass)
- Covers: minimal/full imports, plan storage, character data integrity, session history, companion creation, validation errors, default values

---

## Opus for All Generation, Sonnet for Sessions Only (2026-02-10)

### AI Model Architecture Overhaul
Claude Opus now handles **all world-building and content generation**, not just campaign plans. Claude Sonnet is reserved exclusively for interactive DM sessions:
- **Opus** (`claude-opus-4-6`): Campaign plans, backstory parsing, NPC generation, quest generation, companion backstories, location generation, living world events, adventure generation
- **Sonnet** (`claude-sonnet-4-6`): DM sessions only (real-time narration, combat, dialogue)
- **Ollama**: Offline fallback for all tasks
- First session opening uses Opus (establishing the narrative arc from campaign plan), continuing sessions use Sonnet
- 6 generators updated: backstoryParserService, questGenerator, companionBackstoryGenerator, locationGenerator, livingWorldGenerator, adventureGenerator
- **PDF parser removed**: `pdfParser.js` and `pdf-parse` dependency deleted (unused functionality)

---

## In-Session Stats, Inventory Panel, Combat Tracker & Claude Model Updates (2026-02-09)

### Claude Model Auto-Updating
Both Claude models now use alias IDs (no date suffix) so they automatically resolve to the latest available version:
- **Opus**: `claude-opus-4-6` (was `claude-opus-4-5-20251101`)
- **Sonnet**: `claude-sonnet-4-6` (was `claude-sonnet-4-20250514`)
- All UI text updated to version-agnostic labels ("Claude Opus" instead of "Opus 4.5")

### Enhanced Stats Bar
The session info bar now displays HP, AC, and Gold at a glance alongside game date and spell slots:
- **HP**: Color-coded (green >50%, yellow 25-50%, red <25%) with current/max display
- **AC**: Armor class with blue accent
- **Gold**: Current gold pieces with gold accent

### Racial Traits in Character Panel
The Abilities tab in the Quick Reference panel now shows racial traits:
- Automatically looks up race/subrace from `races.json`
- Traits displayed as cards with teal accent, separating name from description
- Subraces use their own complete trait arrays

### In-Session Inventory Panel
New slide-in overlay panel (green accent, `#10b981`) accessible via "Inventory" button in session header:
- **Rarity colors**: Items color-coded by D&D rarity (common/uncommon/rare/very rare/legendary)
- **Filter tabs**: All, Weapons, Armor, Misc
- **Session tracking**: Items gained during the current session highlighted with "NEW" badge
- **Discard**: Remove items from inventory with one click
- **Gold display**: gp/sp/cp breakdown
- Server endpoint `POST /api/dm-session/item-rarity-lookup` for batch rarity resolution
- Server endpoint `POST /api/character/:id/discard-item` for inventory management

### Initiative & Combat Tracker
Automatic initiative rolling and visual combat tracking:
- **Markers**: AI DM emits `[COMBAT_START: Enemies="..."]` when combat begins, `[COMBAT_END]` when it ends
- **Server-side initiative**: d20 + DEX modifier for player, companions (from ability scores), and enemies (heuristic estimation)
- **Turn order injection**: Initiative results injected into AI conversation so it follows the established order
- **Visual tracker**: Inline bar above messages showing round counter and combatant chips:
  - Player (blue), Companions (purple), Enemies (red)
  - Active turn highlighted with gold border
  - "Next Turn" and "End Combat" controls
- **3-point prompt reinforcement**: ABSOLUTE RULES + COMBAT section + FINAL REMINDER
- Markers stripped from displayed narrative
- Tests: 26 tests passing in `tests/combat-tracker.test.js`

## Expanded Loot Systems (2026-02-09)

### Broadened Session-End Loot
Loot generation is no longer restricted to high-risk adventures only. All risk levels now have a chance to drop items from the level-appropriate DMG item tables:
- **High risk**: 25% chance (up from 20%)
- **Medium risk**: 10% chance (new)
- **Low risk**: 5% chance (new)

### Travel Encounter Loot Generation
Travel encounters now auto-generate loot when resolved successfully. Each encounter type has a different drop rate:
- **Discovery**: 40% — found something interesting
- **Combat**: 30% — enemy dropped something
- **Omen**: 20% — found a mysterious trinket
- **Creature**: 15% — harvestable materials
- **Obstacle**: 10% — found something behind it
- **Travelers**: 5% — small trade or gift
- **Weather/Merchant**: 0% — no loot

Gold rewards also scale with character level and encounter type (combat enemies carry coin, discoveries reveal caches).

### DM Session Loot Drops (`[LOOT_DROP]` Marker)
The AI DM can now award items during freeform sessions by emitting a structured marker:
```
[LOOT_DROP: Item="Potion of Healing" Source="bandit leader's belt pouch"]
```
- Items are auto-added to the player's real character inventory
- Marker is stripped from displayed narrative (player sees pure story)
- AI is instructed to use sparingly — 1-2 items per significant combat or discovery
- Works for combat loot, hidden treasure, NPC gifts — NOT merchant purchases
- System confirms the item in loot tables when possible
- 3-point reinforcement in DM prompt (ABSOLUTE RULES + mid-prompt + FINAL REMINDER)

### Quest Completion Rewards
Quest-defined rewards now auto-apply when quests complete:
- Gold is added to the character's purse
- XP is added to the character's experience
- Items from the quest's reward definition are added to inventory
- Rewards are narratively tied to the quest (defined by the AI quest generator)
- No random items — everything comes from the quest's own reward field

**Files Modified**:
- `server/config/rewards.js` — Broadened `generateLoot()`, exported `EQUIPMENT_BY_LEVEL`/`getLootTableForLevel`, added `generateEncounterLoot()`
- `server/services/travelService.js` — `resolveEncounter()` now auto-generates loot
- `server/services/dmPromptBuilder.js` — `[LOOT_DROP]` instructions with 3-point reinforcement
- `server/services/dmSessionService.js` — Added `detectLootDrop()` parser
- `server/routes/dmSession.js` — Handle `[LOOT_DROP]` markers, add items to inventory, inject system context
- `server/services/questService.js` — `completeQuest()` now auto-applies rewards via `applyQuestRewards()`

---

## DMG Magic Items & 5-Tier Rarity System (2026-02-09)

### ~165 D&D 5e Magic Items (DMG + XGtE)
Added iconic magic items from the Dungeon Master's Guide and Xanathar's Guide to Everything across all 5 rarity tiers: common, uncommon, rare, very rare, and legendary. Items span every category:

- **Magic Weapons (~27)**: Moon-Touched Sword, Walloping Ammunition, Unbreakable Arrow (XGtE common), Javelin of Lightning, Flame Tongue, Sun Blade, Dragon Slayer, Dancing Sword, Vorpal Sword, Holy Avenger, and more
- **Magic Armor (~17)**: Armor of Gleaming, Cast-Off Armor, Smoldering Armor, Shield of Expression (XGtE common), Mithral Armor, Adamantine Armor, +2/+3 Armor and Shields, Elven Chain, Animated Shield, Armor of Invulnerability
- **Wondrous Items (~80)**: Bag of Holding, Gauntlets of Ogre Power, Winged Boots, Cloak of Displacement, Portable Hole, Carpet of Flying, Staff of the Magi, Ring of Three Wishes, plus ~30 XGtE common items (Cloak of Billowing, Clockwork Amulet, Hat of Wizardry, Wand of Smiles, Veteran's Cane, Pipe of Smoke Monsters, and more)
- **Rings (~8)**: Ring of Protection, Ring of Spell Storing, Ring of Evasion, Ring of Regeneration, Ring of Telekinesis, Ring of Invisibility
- **Wands/Rods/Staves (~10)**: Wand of Magic Missiles, Wand of Fireballs, Rod of Lordly Might, Staff of Power, Staff of the Magi
- **Scrolls (~6)**: Spell Scrolls from Level 1 through Level 9
- **Higher-Tier Potions (~19)**: Potion of Heroism, Potion of Invisibility/Speed/Flying, Oil of Sharpness, Potion of Longevity
- **Higher-Tier Gems (6)**: Diamond, Black Opal, Jacinth (1000gp), Flawless Diamond, Star Sapphire, Black Star Sapphire (5000gp)

### 13 Cursed Items with Disguise System
Cursed items masquerade as desirable items until identified:

| Cursed Item | Appears As | Effect |
|-------------|-----------|--------|
| Bag of Devouring | Bag of Holding | Items placed inside are destroyed |
| Berserker Axe | +1 Greataxe | Wielder must attack nearest creature |
| Sword of Vengeance | +1 Longsword | Cannot willingly let go, compelled to fight |
| Armor of Vulnerability | Armor of Resistance | Vulnerability to one damage type |
| Shield of Missile Attraction | +2 Shield | Attracts ranged attacks |
| Cloak of Poisonousness | Cloak of Protection | Instant death poison on donning |
| Necklace of Strangulation | Necklace of Adaptation | Constricts and strangles wearer |
| Potion of Poison | Potion of Healing | Deals poison damage instead of healing |
| And 5 more... | | |

- Shop UI shows the **disguised name** — players see "Bag of Holding", not "Bag of Devouring"
- AI DM sees `[CURSED: actually Bag of Devouring — items placed inside are destroyed]` in inventory injection
- AI is instructed NOT to reveal curses until the player uses Identify or Detect Magic

### Prosperity-Based Magic Caps
Each prosperity tier limits how many high-rarity magic items a shop can stock:

| Prosperity | Max Uncommon | Max Rare | Max Very Rare | Max Legendary | Cursed Chance |
|------------|-------------|----------|---------------|---------------|---------------|
| Poor | 1 | — | — | — | 15% |
| Modest | 3 | 1 | — | — | 8% |
| Comfortable | — | 2 | — | — | 5% |
| Wealthy | — | 3 | 1 | — | 3% |
| Aristocratic | — | 4 | 2 | 1 | 2% |

Village magic shops (poor) get at most 1 uncommon magic item with a 15% chance it's a cursed fake. City magic shops (aristocratic) can stock up to 1 legendary + 2 very rare + 4 rare items.

### Character Level Gating
- **Uncommon**: Level 3+
- **Rare**: Level 5+
- **Very Rare**: Level 9+
- **Legendary**: Level 13+

### Weighted Rarity Selection
Items are selected with rarity-based weights: common (6x), uncommon (3x), rare (1x), very rare (0.5x), legendary (0.25x). Higher-rarity items are naturally scarce.

### Blacksmith Magic Weapons
Blacksmiths now draw from a `MAGIC_WEAPONS_ARMOR` pool (non-cursed weapons and armor from the magic items list). A village blacksmith (poor) gets nothing magical; a city blacksmith (wealthy) might stock 1 rare magic weapon.

### Rarity Colors in Shop UI
- Uncommon: purple (`#a78bfa`)
- Rare: blue (`#60a5fa`)
- Very Rare: bright violet (`#c084fc`)
- Legendary: orange/gold (`#ff8c00`)

### Session-End Loot Tables Expanded
`EQUIPMENT_BY_LEVEL` expanded from 5 items per tier to 8-15 items per tier using DMG magic item names. Level 1 gets common items, level 5 gets uncommon, level 10 gets rare, level 15 gets very rare.

**Files Modified**:
- `server/data/merchantLootTables.js` — 5-tier rarity, ~130 magic items, cursed items, prosperity caps, blacksmith pool, generateInventory rewrite
- `server/routes/dmSession.js` — Cursed item annotations in AI inventory injection
- `server/config/rewards.js` — Expanded session-end loot tables
- `server/services/merchantService.js` — Carry cursed item fields through ensureItemAtMerchant
- `client/src/components/DMSession.jsx` — Very rare/legendary rarity colors in shop UI

---

## Persistent Merchant Inventory System (2026-02-09)

### Persistent Merchant Inventories
Merchants now have **persistent, loot-table-generated inventories** stored in the database. Previously, merchant inventories were AI-generated on every visit — slow, expensive, and inconsistent. Now inventories are instant, consistent, and persist across sessions.

- **Loot tables**: Item pools sourced from D&D 5e PHB (weapons, armor, adventuring gear, potions, magic items, gems, leather goods, clothing)
- **Prosperity scaling**: Poor/modest/comfortable/wealthy/aristocratic tiers affect item selection, pricing, quantities, and merchant gold
- **Character level gating**: Rare items only at level 5+, uncommon at level 3+
- **Weighted selection**: Common items appear 6x more often than rare

### Campaign Plan Merchant Generation
Campaign plan generation (Claude Opus) now creates merchants scaled by location size:
- **City**: 5-8 merchants (diverse types)
- **Town**: 3-4 merchants (common types)
- **Village**: 1-2 merchants (general store, maybe blacksmith)
- **Traveling**: 1-2 wandering merchants

### Ad-Hoc Merchant Creation
When the AI introduces a merchant not in the campaign plan, the system auto-creates them with a loot-table-generated inventory. No 404 errors — seamless experience.

### AI-Inventory Synchronization
When the AI emits `[MERCHANT_SHOP]`, the server injects the merchant's **real inventory** into the conversation as a `[SYSTEM]` message. The AI can only reference items actually in stock — no more narrative/inventory mismatches.

### Merchant Referrals (`[MERCHANT_REFER]`)
When a player asks for an item not in stock, the AI can redirect them to another campaign merchant. The system **guarantees** that item will exist at the referred merchant's inventory.

### Custom Item Addition (`[ADD_ITEM]`)
The AI can add custom narrative items to a merchant's inventory with proper pricing and quality tiers:
- **Standard** (1x price) — normal quality
- **Fine** (1.5x price) — well-crafted
- **Superior** (2x price) — exceptional
- **Masterwork** (3x price) — the finest available

Items added this way persist in the database and show up in the shop UI.

### Browse Wares Button
- Only appears when AI has detected a merchant (via `[MERCHANT_SHOP]` marker)
- Clears on non-merchant AI responses and session transitions
- Reflects the current merchant being talked to

### Provider Toggle
Manual switch between Claude/Ollama/Auto mid-session with a recheck button. `checkClaudeStatus()` simplified to env var check (no more live API calls that could false-fail).

### Merchant Transaction System
- Buy items: merchant inventory depletes, player inventory grows, gold transfers
- Sell items: limited by merchant's gold purse, items added to merchant stock at resale price
- Restock: regenerate inventory from loot tables (50% old stock persists)
- NPC reputation increases with merchant after purchases

**Files Created**:
- `server/data/merchantLootTables.js` — Item pools, prosperity config, inventory generation, quality tiers, item lookup/similarity
- `server/services/merchantService.js` — Merchant CRUD, restock, on-the-fly creation, item addition, cross-merchant referrals

**Files Modified**:
- `server/database.js` — `merchant_inventories` table
- `server/routes/dmSession.js` — Merchant endpoints, inventory injection, marker handling, provider toggle
- `server/services/dmPromptBuilder.js` — Merchant shopping instructions (3-point reinforcement), referral/add-item markers
- `server/services/dmSessionService.js` — Marker detection for `MERCHANT_SHOP`, `MERCHANT_REFER`, `ADD_ITEM`
- `server/services/campaignPlanService.js` — Merchant section in plan schema, location-scaled generation
- `server/services/claude.js` — Simplified `checkClaudeStatus()` to env var check
- `client/src/components/DMSession.jsx` — Shop UI, Browse Wares button, provider toggle, merchant state lifecycle
- `client/src/components/CampaignPlanPage.jsx` — Merchants tab in plan viewer
- `client/src/components/CampaignsPage.jsx` — Campaigns page theme updates

---

## Skill Check Hard-Stop, Survival Mode, Starting Location Enforcement (2026-02-09)

### Skill Check Hard-Stop
The AI DM now **stops writing immediately** after requesting any dice roll (skill check, saving throw, attack roll). Previously it would ask for a roll and then continue narrating without waiting for the result.

- Primacy/recency reinforcement: rule appears in ABSOLUTE RULES (top), DICE ROLLS (middle), and FINAL REMINDER (bottom) of the system prompt
- Explicit WRONG/RIGHT examples teach the AI the exact behavior

### Survival Content Preference
New "Survival" toggle in content preferences. When enabled, the AI DM tracks rations, weather hazards, exhaustion, and resource pressure during travel and wilderness scenes.

- AI checks character inventory for supplies and narratively pressures when low
- Travel requires Survival checks for navigation, foraging, shelter
- Environmental hazards (blizzards, extreme heat, thin air) become real obstacles
- Doesn't overdo it — survival pressure during travel/camping, not during town scenes

### Starting Location Enforcement
The AI DM now begins the first session **physically in** the chosen starting location, instead of skipping ahead to Act 1 events.

- Explicit rule: "The FIRST session MUST begin physically IN [location]"
- Act 1 guidance softened from "THIS is where the story should start" to "build toward this act's events from there"

### Campaign Tone: Survival Option
Added "Survival" to the campaign tone dropdown on the Campaigns page alongside existing options.

### Bug Fix: Campaign Assignment Not Refreshing
After assigning a character to a campaign, `selectedCharacter` wasn't updating with the new `campaign_id`. Campaign Plan page showed "No campaign assigned" until page refresh. Fixed `loadCharacters()` to refresh `selectedCharacter` with latest server data.

### Local SQLite Fallback
Database now falls back to a local `file:local.db` SQLite file when Turso cloud database is not configured. Previously the server crashed with `URL_INVALID` if `TURSO_DATABASE_URL` was not set.

### Windows Portable Build
GitHub Actions workflow builds a portable Windows distribution with embedded Node.js runtime. Unzip, double-click `Start DnD Meta Game.bat`, open browser to localhost:3000.

**Files Modified**:
- `server/services/dmPromptBuilder.js` — Skill check hard-stop (3 locations), survival mode prompt, starting location enforcement
- `client/src/data/forgottenRealms.js` — Survival content preference toggle
- `client/src/components/CampaignsPage.jsx` — Survival tone option
- `client/src/App.jsx` — selectedCharacter refresh in loadCharacters()
- `server/database.js` — Local SQLite fallback when Turso not configured
- `.github/workflows/build-windows.yml` — Windows portable build workflow
- `start-windows.bat` — Windows launcher script

---

## Auto-Apply Inventory Changes (2026-02-08)

Inventory changes (items consumed, gained, gold spent) detected by the AI at session end are now **auto-applied** instead of requiring a manual "Apply Changes" click. An "Undo" button appears after auto-apply to revert if the AI got it wrong.

- Auto-apply runs immediately after session end analysis completes
- Pre-apply inventory/gold snapshot saved for undo
- Undo restores via `PUT /api/character/:id` (existing endpoint, no new server code)
- Fallback: if auto-apply fails, manual "Apply Changes" button still appears

**Files Modified**:
- `client/src/components/DMSession.jsx` — Auto-apply in `endSession()`, `undoInventoryChanges()`, undo UI

---

## World State Snapshot for DM Sessions (2026-02-08)

The AI DM now has awareness of the current dynamic world state when starting a session. Previously, the DM only saw the static campaign plan and accumulated campaign notes — faction standings, world events, NPC relationships, and discovered locations were invisible to the AI.

### How It Works
At session start, 5 parallel service queries gather the living world state:
- **Faction standings** — character's reputation with each faction (skip neutrals unless member, 6 max)
- **Active world events** — events in progress with current stage descriptions (5 max)
- **NPC relationships** — disposition, trust, pending promises, outstanding debts, known secrets (8 max)
- **Known faction goals** — faction activities the character has discovered (4 max)
- **Discovered locations** — places the character has visited/explored (8 max)

This data is compressed into a `=== CURRENT WORLD STATE ===` section in the system prompt (~250-500 tokens), placed between the campaign plan and story threads. The AI is instructed to weave this organically into narrative and dialogue — not info-dump it.

### Graceful Degradation
- Wrapped in try/catch — if any queries fail, the session starts normally without world state
- Only runs when the character has a campaign (`character.campaign_id`)
- Empty world state produces no prompt section (empty string)

**Files Modified**:
- `server/services/dmPromptBuilder.js` — Added `formatWorldStateSnapshot()`, `getStandingBehavior()`, `getTrustLabel()`
- `server/routes/dmSession.js` — Added 5 service imports, Promise.all data gathering in POST /start, `worldState` in sessionConfig

---

## Architecture Refactor & Living World Enhancements (2026-02-07)

Major backend refactoring and living world behavior improvements.

### Module Splitting
Split `ollama.js` (1715 lines) into 3 focused modules:
- **`llmClient.js`** (~90 lines) — Raw Ollama API client (chat, status, models)
- **`dmPromptBuilder.js`** (~1300 lines) — DM system prompt construction and all formatters
- **`ollama.js`** (~300 lines) — Session orchestration only (start/continue/summarize)
- Backward-compatible re-exports so no consumer files needed import changes

Split `dmSession.js` route (2362 lines) into route + service:
- **`dmSessionService.js`** (~500 lines) — Business logic (analysis, rewards, NPC extraction, notes, event emission)
- **`dmSession.js`** (~1700 lines) — Thin route handlers that delegate to service

### DM Session Event Bus Integration
DM sessions now emit gameplay events at session end, connecting freeform AI gameplay to the structured quest/companion systems:
- `NPC_INTERACTION` — For each NPC extracted from the session transcript
- `LOCATION_VISITED` — For locations found in extracted campaign notes
- `ITEM_OBTAINED` — For items gained per inventory analysis
- `DM_SESSION_ENDED` — Triggers companion backstory thread activation checks

### Living World Emergent Behavior
Faction tick processing enhanced from deterministic progress bars to emergent behavior:
- **Faction interference**: Hostile factions slow each other; allied factions boost each other
- **Wider variance**: Progress varies 0.5x-1.5x per tick (was 0.8x-1.2x)
- **Random disruptions**: 8% chance/day of setbacks (lose 10-30% progress)
- **Random breakthroughs**: 5% chance/day of bonus progress (50-100% extra)
- **Rival reactions**: At 50%+ milestones, hostile factions have 40% chance of spawning counter-events
- **Power shifts**: Completing major/catastrophic goals increases faction power level

**Files Created**:
- `server/services/llmClient.js`, `server/services/dmPromptBuilder.js`, `server/services/dmSessionService.js`

**Files Modified**:
- `server/services/ollama.js`, `server/routes/dmSession.js`, `server/services/factionService.js`, `server/services/livingWorldService.js`

---

## Bundle Size Optimization (2026-02-07)

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
- Claude Opus generates comprehensive living world plans with NPCs, factions, locations, timeline, quest arcs, side quests, and DM notes
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
