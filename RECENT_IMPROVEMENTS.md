# Recent Improvements

## Latest: DMG Magic Items & 5-Tier Rarity System (2026-02-09)

### ~130 D&D 5e DMG Magic Items
Added iconic Dungeon Master's Guide magic items across all 5 rarity tiers: common, uncommon, rare, very rare, and legendary. Items span every category:

- **Magic Weapons (~25)**: Moon-Touched Sword, Javelin of Lightning, Flame Tongue, Sun Blade, Dragon Slayer, Dancing Sword, Vorpal Sword, Holy Avenger, and more
- **Magic Armor (~13)**: Mithral Armor, Adamantine Armor, +2/+3 Armor and Shields, Elven Chain, Animated Shield, Armor of Invulnerability
- **Wondrous Items (~50)**: Bag of Holding, Gauntlets of Ogre Power, Winged Boots, Cloak of Displacement, Portable Hole, Carpet of Flying, Staff of the Magi, Ring of Three Wishes
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
Campaign plan generation (Opus 4.5) now creates merchants scaled by location size:
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
