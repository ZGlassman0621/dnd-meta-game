# Changelog

All notable changes to the D&D Meta Game project will be documented in this file.

## [1.0.0.29] - 2026-04-18 — Character creation playtest fixes (10 issues)

Batch of polish fixes from first playtest of v1.0.26's character
creation rework.

### Identity & review screen
- **Class capitalization in review** — was rendering "artificer"
  lowercase in the final summary. Fixed.

### Stats
- **Rolled stats of 19 and 20 now allowed.** The manual ability-score
  input and on-blur clamp were hard-capped at 18, silently downgrading
  a rolled 20 to 18. Raised to 20 (the normal 5e cap). Placeholder,
  helper text, and input `max` all updated.

### Ancestry feat sub-choices (follow-up to v1.0.26)
- **Racial languages now locked out.** When a feat's language choice
  offers "any_language", the dropdown now filters out every language
  granted by the character's race/subrace — Humans can no longer pick
  Common as one of Traveler's Tongue's two languages, Dwarves can't
  double up on Dwarvish, etc.
- **Multi-count picks deduplicate across slots.** Picking Dwarvish in
  slot 1 of a "pick 2 languages" choice hides Dwarvish from slot 2's
  dropdown (but keeps it visible in slot 1 so the current value
  doesn't vanish). Same logic applies to skills and any other
  count > 1 choice.

### PHB feats (Variant Human bonus feat picker)
- **5 feats now have proper sub-choice UI**: Linguist (pick 3
  languages), Skilled (pick 3 skills), Martial Adept (pick 2 Battle
  Master maneuvers from the 16-entry list), Magic Initiate (pick
  class + 2 cantrips + 1 spell), Ritual Caster (pick class + 2 ritual
  spells). Previously the feat's narrative description mentioned
  these picks but no UI surfaced them.
- **Unified schema**: the old PHB `choices: { class: [...] }` object
  was converted to the same array schema ancestry feats use —
  `choices: [{ id, type, count, label, options }]`. Elemental Adept,
  Magic Initiate, and Ritual Caster all migrated. The render code
  now shares the same helpers (`resolveAncestryChoiceOptions`), so
  racial-language lockout and dedup apply to PHB feats too.
- **Validation updated**: the "Next" button gate now requires all
  array-schema slots to be filled (with count > 1 slots each
  requiring `count` non-empty entries), not just one property per key.

### Background Feature display
- **Soldier's "Vehicles (land)" no longer orphaned under the wrong
  header.** The previous renderer dropped fixed tool proficiencies
  as bullets inside the "Choose Tool Proficiencies" section, which
  read like an option in the chooser. Now split into two sections:
  "Automatic Tool Proficiencies" (always-granted, bullet list) and
  "Choose Tool Proficiencies" (only the dropdown slots). Applies to
  any background with a mix — Guild Artisan, Outlander, etc.

### Spell & cantrip pickers
- **Descriptions now display inline** below each cantrip / 1st-level
  spell option, not just as a hover tooltip. Also surfaces
  castingTime, range, and duration in a compact line above the
  description.

### Pickers with descriptions
- **Alignment descriptions added** — each of the 9 alignments now
  shows its PHB-style 1-2 sentence description below the dropdown
  when selected.
- **Lifestyle descriptions added** — all 7 lifestyle options
  (Wretched → Aristocratic) show the PHB description explaining what
  that daily-spend level actually looks like. A one-line helper
  above the dropdown explains what Lifestyle is at all.
- **Deity picker grouped by pantheon and sorted for relevance.**
  Deities are now organized under `<optgroup>` headers by pantheon,
  with the character's racial pantheon listed first and labeled
  "(matches your race)". Atheist/Agnostic options separated into
  a "Belief" group at the top. Selected deity shows
  alignment + domain below the dropdown in addition to the
  existing description.

## [1.0.0.28] - 2026-04-18 — Genericize nickname UI placeholders

Cosmetic follow-up to v1.0.27. Placeholder text and example strings in
the UI previously referenced the example names ("Riv", "Rivelious",
"Jarrick") used when scoping the feature. These never became stored
data — they only appeared as grayed-out hints inside empty inputs —
but they implicitly assumed a specific character.

- `NicknameManagerPanel.jsx`: empty-state copy, nickname input
  placeholder, and notes input placeholder rewritten as
  character-agnostic hints.
- `CharacterCreationWizard.jsx`: pre-existing Step-1 nickname
  placeholder (`"Riv", "The Brave", "Shadowstep"`) replaced with a
  generic "A short form, title, or epithet your character goes by".
- Doc comments in `nicknameService.js` and `nickname.js` softened to
  describe the shape of output rather than specific example strings.
- Test fixtures in `tests/nickname-resolver.test.js` unchanged —
  they use `TEST_NICK_` prefixes, exist only during the test run,
  and are deleted on both entry and exit.

## [1.0.0.27] - 2026-04-18 — Multi-nickname system with audience rules (D)

Characters can now have multiple names (legal name, title, nicknames,
epithets) with per-audience rules controlling who is allowed to use
each one. The DM prompt tells every active NPC exactly which form to
use based on the rule the player set.

### Data layer
- Migration `039_character_nicknames.js` adds `character_nicknames`
  table: `(id, character_id, nickname, audience_type, audience_value,
  notes)` with `ON DELETE CASCADE` from `characters`. Audience types:
  `default`, `friends` (≥ 25), `allied` (≥ 50), `devoted` (≥ 75),
  `specific_npc`, `role`.
- Existing `characters.nickname` values are backfilled as `friends`-tier
  rules (matches the prior DM-prompt semantics). The legacy column
  stays in place for back-compat (session titles, exports, preludes).

### Service & API
- `server/services/nicknameService.js` — CRUD + `resolveForNpc(charId, npcId)`
  that returns all matching names ranked by priority (specific_npc 5 >
  devoted 4 > allied 3 / role 3 > friends 2 > default 0). Fallback to
  the character's legal name when no rows exist. `resolveForNpcBatch()`
  for the prompt builder.
- **Bard override** (rule of cool): any NPC whose `occupation` contains
  "bard" may use any nickname on the list, regardless of the audience
  rules. Flagged as `bard_override: true` in the resolver result and
  surfaced in the DM prompt.
- `server/routes/nickname.js` mounted at `/api/character` — GET / POST /
  PUT / DELETE for nickname rows plus GET `/:id/nicknames/resolve/:npcId`
  for UI previews.

### DM prompt integration
- `formatCustomNpcs()` in `dmPromptBuilder.js` now takes a
  `nicknameResolutions` map and emits a `Calls the PC: "..." (<rule>)`
  line inside each NPC's block. Bard-override rows get the rule-of-cool
  phrasing so the AI knows it's freely allowed.
- `dmSession.js` computes the resolution map once at session start
  (silent failure — a missing resolution just omits the naming line)
  and passes it through `sessionConfig.nicknameResolutions`.

### UI
- New `NicknameManagerPanel` (fuchsia accent, slide-in, 460px) on the
  Character Sheet. Accessible via a ✎ "Manage names & nicknames" button
  next to the character's legal name in the sheet header.
- Add / edit / delete flow with audience picker. Specific-NPC rule
  surfaces a dropdown of the character's known NPCs. Role rule is a
  free-form substring input ("apprentice", "retainer", etc.). Private
  notes field for player memos ("Jarrick started calling me this
  after the Tavern Brawl").

### Tests
- `tests/nickname-resolver.test.js` (27 assertions): stranger default,
  friends tier, allied precedence, devoted, specific-NPC beats tier,
  role match fires regardless of disposition, bard override returns all
  names, prompt formatter output, and fallback-to-legal-name for
  characters with zero rows.
- All existing suites (character-memory, moral-diversity, combat,
  dm-mode, condition-tracking) still pass.

## [1.0.0.26] - 2026-04-18 — Character creation polish: feat copy + theme descriptions + sub-choice selectors

Three-part refresh of the character creation flow, driven by playtest feedback.

### A. Ancestry feat copy — full sentences across all 195 feats
- Rewrote every ancestry feat's `description` in `server/data/ancestryFeats.js` as
  complete, second-person prose. Fragment lists like *"Two additional languages.
  Advantage on Charisma checks..."* become *"You learn two additional
  languages of your choice. You gain advantage on Charisma checks..."*.
- All feat-name, mechanics, flavor, list_id, tier, and choice_index fields
  preserved — only `description` text changed.
- `progressionSeedService.seedAncestryFeats` now UPSERTs descriptions on
  existing DBs so the rewrite propagates without a DB reset.

### B. Theme descriptions — PHB-style narrative blurbs
- Added a 2-3 sentence `description` field to all 21 themes in
  `server/data/themes.js` ("what life was like, what it means for the
  character" in the voice of PHB backgrounds).
- Migration `038_theme_description.js` adds `themes.description`,
  `ancestry_feats.choices`, and `character_ancestry_feats.choices_data`
  columns (all nullable, backward compatible).
- `GET /api/progression/themes` and `GET /api/progression/themes/:id` now
  return `description`.
- CharacterCreationWizard renders the theme description as italic helper
  text directly under the theme picker, above the L1 ability card.

### C. Character creation flow — reorder + feat sub-choice selectors
- **Step 1 order reshuffled** to match the way the DM 5e books actually
  present identity: Name / Identity → Race / Subrace → **Ancestry Feat** →
  **Theme** → **Background Feature** → Class / Subclass. Previously feat came
  after theme, and background feature sat below class features.
- **Feat sub-choices** (skill picks, language picks, damage-type picks,
  enemy-type picks, tool picks, ability-score picks, spell-list picks) are
  now declared on each feat via a `choices: [...]` schema and rendered as
  inline selectors under the feat card. 31 of the 195 feats carry choice
  schemas — Variant Human's *Relentless Drive* now lets you pick the skill
  proficiency and the extra language at creation, *Traveler's Tongue* lets
  you pick both languages, Dwarf's *Grudge-Sworn* lets you pick the
  traditional foe, etc.
- Resolved choices persist on `character_ancestry_feats.choices_data` as JSON.
  `POST /api/character` accepts an `ancestry_feat_choices` object in the
  request body; `progressionService.getCharacterProgression()` returns
  parsed choices + choices_data alongside each feat so character sheet,
  DM prompt, and AI dialogue can all reference the player's actual picks.
- New helper constants in the client: `ALL_SKILLS_5E`,
  `COMMON_ARTISAN_TOOLS`, `COMMON_TOOLS_EXTENDED`, `MARTIAL_WEAPONS`, plus
  `resolveAncestryChoiceOptions()` which maps sentinel strings like
  `any_skill` / `any_language` / `any_martial_weapon` to option lists.
  Open-ended choices (specific spells) fall back to a free-form text input.

## [1.0.0.25] - 2026-04-17 — Ollama: reasoning-token strip + new default model + Opus 4.7

### Claude
- **Opus bumped from 4-6 → 4-7** in `server/services/claude.js`. Opus 4.7
  shipped recently and is the stronger generation model; since the API
  pins major.minor (no rolling `claude-opus` alias), this bump has to
  be manual. Clarified the comment in `claude.js` + `CLAUDE.md` +
  `LLM_SETUP.md` so future bumps don't get missed. Sonnet stays at 4-6
  (still the latest Sonnet).


### Ollama integration
- **`<think>` / `<thinking>` / `<reasoning>` tokens stripped** from all
  Ollama responses before they reach the player or marker detection.
  Reasoning-family models (DeepSeek R1, QwQ, qwen3-thinking variants)
  emit chain-of-thought inside `<think>...</think>` before their final
  output; leaking that into DM narration both spoils pacing and breaks
  `[COMBAT_START]` / `[LOOT_DROP]` / other marker parsing which scans
  the full response body.
- Added `stripThinkingTokens()` in `server/services/llmClient.js`:
  strips matched pairs, orphan opening tags (response truncated
  mid-thought), and orphan closing tags. Runs at the top of the
  existing `cleanupResponse()` pipeline so every Ollama response is
  scrubbed in one place.
- **Default model bumped from `gemma3:12b` → `gpt-oss:20b`.** Better
  narration and instruction-following at a still-comfortable VRAM fit
  for 16GB cards. All hardcoded fallbacks (`dmSession.js`,
  `character.js`, `adventureGenerator.js`, `DMSession.jsx`,
  `.env.example`, `README.md`, `LLM_SETUP.md`) updated to match.
  Override with `OLLAMA_MODEL=<tag>` for any installed model.

## [1.0.0.24] - 2026-04-17 — Bug Sweep: 15 fixes across server + client

Comprehensive bug sweep following a deep audit of the shipped systems.
Ten reported issues + seven more uncovered during verification and
a second follow-up audit, all fixed together here.

### Server bug fixes
- **Downtime "base_upgrade" activity rewired to buildings** — the old
  `advanceUpgrade()` stub from F1a was throwing on every attempt. Now
  calls `advanceBuildingConstruction(buildingId, hours)`; accepts
  both `building:<id>` and legacy `upgrade:<id>` work_type shapes.
- **Merchant transaction input validation** — rejects negative /
  non-integer quantities, negative prices, malformed names with 400.
  Previously a malformed payload could corrupt character state with
  negative totals.
- **Merchant NPC lookup tightened** — was using a loose `LIKE %X%`
  that matched "Bob's Inn" when looking for "Bob". Now: exact match
  first, prefix fallback. Dropped the false `campaign_id = ?` filter
  (NPCs are campaign-global — they have no such column).
- **Merchant transaction atomicity** — character update + merchant
  update now run inside a single `db.transaction('write')`. If the
  merchant's optimistic-lock version check fails, the whole thing
  rolls back; the character's gold is NOT deducted.
- **Living-world tick step visibility** — new `results.step_statuses`
  array tracks each step (ok/skipped/failed with reason). Failed
  steps no longer silently vanish.
- **Dead code removed** — `getAvailableUpgrades`, `startUpgrade`,
  `advanceUpgrade` stubs from partyBaseService were unused after F1b.
- **Three stale `FROM npcs WHERE campaign_id = ?` queries** fixed in
  dmSession.js (PROMISE_MADE / PROMISE_FULFILLED / merchant price
  modifier). Now scan global NPCs by name only.
- **Narrative queue soft validation** — `addToQueue` now throws on
  missing event_type and warns on unknown types (via
  `KNOWN_EVENT_TYPES` set). Catches typos that would queue items the
  DM prompt never recognizes.
- **F3 base threat query** — was selecting non-existent `severity`
  and `region` columns from `world_events`. Now selects `scope` and
  `affected_locations` (which do exist). Also dropped the invalid
  `'escalating'` status filter.
- **Companion reunion narrative** — was INSERTing into
  `narrative_queue.content` column (doesn't exist); now uses the
  correct `title` + `description` + `context` + `event_type`.
- **Cross-user campaign data leak** —
  `campaignService.getCampaignById(id)` added optional userId
  parameter; route now passes `req.user?.id` so users can only read
  their own campaigns. `getAllCampaigns(null)` and
  `getActiveCampaigns(null)` now return `[]` instead of every
  campaign system-wide.
- **MERCHANT_COMMISSION idempotency** — an AI repeat of the same
  marker would have placed the same order twice and deducted the
  deposit twice. Now skips when an active order with the same item
  name already exists at the same merchant for this character.
- **`/adjust-date` now advances downstream systems** — manual date
  advances update `character.game_day` and fire
  `processLivingWorldTick(campaign_id, daysToAdd)` so weather,
  companion moods, merchant orders, base threats, etc. all catch up.
  Backward moves (flashbacks) are skipped.

### Client bug fixes
- **DMSession loot-drop refresh guarded** — was parsing error bodies
  on non-200 responses and clobbering character state; now wrapped
  in try/response.ok guard.
- **Merchant transaction response validation** — a 200 with malformed
  body no longer sets character gold to NaN. Throws if `newGold` or
  `newInventory` are missing from the response.

### Test fixes
- **"Message With Active Conditions"** test now accepts 200/503/500
  (the test is about the endpoint handling the payload, not AI
  availability — 500 is expected when credits are exhausted).
- **Narrative queue test isolation** — new `cleanQueue()` helper
  called between each test group prevents state pollution. Test 7
  now seeds its own item instead of relying on cumulative state.
- **companion-activities cleanup order** — FKs from
  `narrative_queue.related_companion_id` now cleared before
  companions are deleted.

### Test suite
- `tests/integration.test.js`: 502 passed, 0 failed (was 501/1)
- `tests/living-world.test.js`: 38 passed, 0 failed (was 37/1)
- `tests/narrative-queue.test.js`: 30 passed, 0 failed

### Known-but-deferred
- FK cascade gaps on several non-`campaigns` tables. SQLite
  ALTER-to-add-CASCADE requires table recreation; the cleanup
  ordering in tests works around it.
- Character/companion/session endpoints don't filter by user owner.
  Solo-play has no exposure; shared deployments would need a JOIN-
  through-campaigns pattern. Noted for a future multi-user release.
- NPCs are campaign-global (no campaign_id). Architectural choice.
- Scattered `JSON.parse()` calls that could crash on corrupted data
  — most are caught by enclosing try/catch but a full pass to
  `safeParse` would be cleaner.

## [1.0.0.23] - 2026-04-17 — F3: Raids + Sieges

The world can now attack your bases. When hostile factions or regional
threats (bandits, armies, undead, cults, mercenaries) are active, bases
in harm's way get raided. Players get warning days to return and defend,
or the threat auto-resolves at the deadline. Captured bases have a
14-day recapture window before they're permanently lost.

### Design
- **Contextual frequency**: threats spawn only from active, raid-capable
  world events (`bandit_activity`, `war`, `undead_uprising`,
  `mercenary_incursion`, `cult_activity`). Dire wolves and stateless
  monsters don't raid.
- **Player agency is default**: narrative queue warning → player chooses
  to defend or accept auto-resolution at deadline.
- **Captured bases**: 14-day recapture window; after that, permanent.

### Added
- **Migration 037** — `base_threats` table with status state machine
  (approaching → defending/resolving → resolved) and outcome enum
  (repelled/damaged/captured/abandoned).
- **`server/config/raidConfig.js`** — `RAID_CAPABLE_EVENTS` map,
  `SIEGE_FORCE_THRESHOLD=15`, vulnerability multipliers,
  `RECAPTURE_WINDOW_DAYS=14`, helpers `computeRaidProbability` and
  `rollInRange`.
- **`server/services/baseThreatService.js`**:
  - `generateThreatsForCampaign` — scans active world events, rolls
    against vulnerable bases, queues narrative-queue warnings
  - `computeAutoResolveOutcome` — attackerForce + d20 vs defense_rating
    + garrison/4 + d20; margin → outcome
  - `autoResolveThreat` / `autoResolveDueThreats` — applies building
    damage, treasury and garrison loss, narrative queue messages
  - `initiatePlayerDefense`, `recordPlayerDefenseOutcome` — player-led
    flow
  - `markDueThreatsForResolution`, `expireStaleCapturedBases`
- **Living-world tick step 3.95** — generation + due-check + auto-resolve
  + expire.
- **AI marker `[BASE_DEFENSE_RESULT: Threat=X Outcome=Y Narrative="..."]`**
  — detected in `dmSessionService`, processed in `dmSession` to record
  the outcome of a player-led defense sequence.
- **DM prompt** — new BASE THREATS section; `getBaseForPrompt` shows
  per-base "⚔️ UNDER THREAT" / "DEFENDING" / "COMBAT IN PROGRESS" lines.
- **Endpoints**:
  - `GET  /api/base/:id/threats`
  - `GET  /api/threats/campaign/:campaignId`
  - `POST /api/threats/:id/defend`
  - `POST /api/threats/:id/resolve-defense`
- **UI** — PartyBasePage Garrison tab now opens with a red-accented
  Active Threats banner (Return to Defend buttons, defending/combat
  status badges) and a compact recent-attacks history.

### Tests
- 9 new integration tests (Group 22, 19 assertions): empty listing,
  create + list, defend flow transitions, defend rejected when not
  approaching, resolve player defense, invalid outcome rejected, auto-
  resolve math on extreme matchups, captured sets 14-day recapture
  clock, expireStaleCapturedBases.
- Full suite: 501 passing.

### Deferred
- Recapture-quest auto-generation: players can still reclaim a captured
  base narratively or through a directly-initiated DM session, but
  structured automated quest generation is a polish pass.

## [1.0.0.22] - 2026-04-17 — F2: Defense Rating + Garrison + Companions as Officers

Bases now have meaningful defensive stats. Companions can be assigned
as named officers, leading the garrison and contributing to the base's
defense rating. Foundation for F3 (raid + siege world events).

### Added
- **Migration 036** — `defense_rating`, `garrison_strength`,
  `subtype_defense_bonus` on `party_bases`; new `base_officers` table
  with UNIQUE(base_id, companion_id).
- **Subtype defense bonuses**: watchtower +2, outpost +3, keep +5,
  fortress +8, castle +12 (martial); manor +2, wizard tower +3, temple
  +2, sanctuary +4; tavern +0.
- **Three new buildings**: palisade (+2 def), stone_walls (martial-only,
  +5 def), war_room (+1 to each officer's bonus).
- **Perk parser** (`parseDefenseGarrisonPerk`) recognizes pattern keys
  `defense_rating_plus_N`, `garrison_capacity_N`,
  `officer_bonus_plus_N`.
- **`recomputeDefenseAndGarrison`** — sums subtype + building perks +
  officer contributions (ceil(level/3) each + any officer_bonus).
  Auto-fires on building complete, building demolish, officer assign,
  officer unassign.
- **Endpoints**:
  - `GET /api/base/:id/garrison` — defense + garrison + officers
  - `POST /api/base/:id/officers` — assign a companion
  - `DELETE /api/base/:id/officers/:officerId`
- **DM prompt** — each active base shows a defensive-posture line:
  `Defense 11 · Garrison capacity 20 · Officers: Elara, Cedric`.
- **UI** — new Garrison tab in PartyBasePage with three stat cards
  (Defense Rating, Garrison Strength, Officers count), officer roster
  with per-officer defense contribution + Unassign, and companion
  picker to assign new officers.

### Fixed
- **Route ordering bug**: the existing `GET /base/:characterId/:campaignId`
  (primary-base fetch) was swallowing `GET /base/:baseId/garrison`
  because both match any 3-segment `/base/x/y` GET. Moved the 2-param
  GET to the bottom of the /base group. Would have broken any future
  `/base/:id/xxx` GET endpoint too.

### Tests
- 6 new integration tests (Group 21, 15 assertions): subtype defense
  applies at creation, gatehouse + barracks raise stats correctly,
  officer assign/unassign round-trip, dismissed companion rejected,
  duplicate assignment rejected, demolish removes defense.
- Full suite: 482 passing.

## [1.0.0.21] - 2026-04-17 — F1: Fortress-Capable Base System

Reworks the party base system so bases can be fortresses, watchtowers,
keeps, manors, wizard towers, temples, and more — with the old 6 base
types (tavern / guild_hall / wizard_tower / temple / thieves_den /
manor) demoted to BUILDINGS you install inside any compatible base.
Foundation for F2 (defense + garrison) and F3 (raids + sieges).

### Added
- **Migration 035** — drops/recreates `party_bases`, `base_upgrades`
  (replaced by `building_upgrades`); adds `base_buildings`. Schema
  supports:
  - `category` (`civilian`/`martial`/`arcane`/`sanctified`)
  - `subtype` (13 options spanning all categories)
  - `is_primary` with a partial unique index — only one primary base
    per character/campaign
  - `building_slots` derived from the subtype (watchtower=3,
    fortress=14, castle=20)
- **Config overhaul** (`partyBaseConfig.js`):
  - `BASE_CATEGORIES` (4 entries)
  - `BASE_SUBTYPES` (13 entries with slot caps, upkeep, starting
    renown, flavor)
  - `BUILDING_TYPES` (20 buildings, each with
    `allowedCategories`, slot cost, gold cost, hours required, perks
    granted on completion)
  - `getAvailableBuildingsForSubtype(subtype)` helper
- **Service refactor** (`partyBaseService.js` rewritten):
  - `getBase` (primary, back-compat) + `getBases` (all)
  - `createBase({ category, subtype, ... })` new signature
  - `setPrimaryBase(baseId)` — promote a satellite atomically
  - `addBuilding`, `listBuildings`, `getBuildingById`,
    `advanceBuildingConstruction`, `removeBuilding` — full building
    lifecycle with slot-cap enforcement and perk merge/unmerge
  - `calculateIncome` now derived from building perks
    (`passive_income_N` pattern) + level bonus
  - `getBaseForPrompt` renders all active bases with buildings
- **Endpoints** (`/api/*`):
  - `GET /api/bases/:characterId/:campaignId` (new) — all bases
  - `POST /api/base/:baseId/set-primary` (new)
  - `GET /api/base/:baseId/buildings/available` (new) — filtered
    catalog + slot usage
  - `POST /api/base/:baseId/buildings` (new) — install
  - `POST /api/base/:baseId/buildings/:buildingId/advance` (new)
  - `DELETE /api/base/:baseId/buildings/:buildingId` (new)
  - `POST /api/base` now takes `{ category, subtype, is_primary? }`
    instead of `{ base_type }`
- **PartyBasePage UI**:
  - Two-step establish form (Category grid → Subtype grid → Name +
    Description)
  - Upgrades tab replaced with Buildings tab: slot usage header,
    Under Construction section with +8/+16/+32 hour advance buttons,
    Built grid with per-building perks, Install New Building grid
    filtered by category with disabled state when treasury is short

### Known (intentional scope cuts; land in F1+)
- **Multi-base UI switcher** — the server supports multiple bases per
  character, but PartyBasePage still shows only the primary. A sidebar
  for navigating between bases lands in F2 alongside the garrison
  system. Use the API directly to create satellite bases for now.
- **Building upgrades** — `building_upgrades` table is in place but
  unused. The old base-level upgrade catalog (fortifications tiers,
  training yard tiers) will land in a polish pass.

### Tests
- 9 new integration tests (Group 20, 28 assertions): create with new
  signature, reject category/subtype mismatch, multi-base support,
  set-primary atomically demotes, install + complete + perk merge,
  category allowlist blocks disallowed buildings, slot cap enforced,
  /buildings/available filters correctly, demolish removes perk.
- Full suite: 467 passing (up from 439).

## [1.0.0.20] - 2026-04-17 — M4: Merchant Relationships

Completes the merchant-system rework by surfacing the merchant-memory
data the game has been quietly persisting since migration 011.
Transaction history, visit counts, and loyalty discounts finally have
a UI. Plus player-authored notes per merchant and a favorite pin so
your "usual armorer" is one click away.

### Added
- **Migration 034** — `character_merchant_relationships` table
  (character_id, merchant_id, notes, favorited, UNIQUE on the pair).
  Only persists data we can't derive; totals/counts are computed from
  `transaction_history`.
- **`merchantRelationshipService.js`**:
  - `getRelationshipsForCharacter` — joins merchant_inventories
    (filtered history), our new table, npc_relationships (for
    disposition), and the economy service (for the loyalty discount
    tier). Returns one entry per merchant interacted with, sorted
    favorites-first then most-recently-visited.
  - `upsertRelationship` — partial update of notes + favorited.
- **Endpoints**:
  - `GET /api/merchant/relationships/character/:id`
  - `PUT /api/merchant/relationships/:merchantId`
    `{ characterId, notes?, favorited? }`
- **`recordTransaction` extended** — now captures `total_spent_cp`,
  `total_earned_cp`, and an `at` ISO timestamp on each history entry,
  so the relationship panel can show lifetime gold flow per merchant.
  Legacy entries still work (0 totals, visit count still valid).
- **`MerchantRelationshipsPanel`** (gold-accented slide-in):
  - Favorites section pinned first, then all merchants
  - Per-card: disposition badge, loyalty discount pill, visit count,
    last-visit delta ("today" / "3 days ago"), lifetime spent/earned,
    click-to-edit notes textarea, ★ favorite toggle
  - New "Merchants" toolbar button in the DMSession header.

### Tests
- 5 new integration tests (Group 19, 12 assertions): empty state,
  appears after transaction, notes upsert preserves unspecified
  fields, favorites sort first, PUT requires characterId.
- Full suite: 439 passing (up from 427).

## [1.0.0.19] - 2026-04-17 — M3: Bargaining / Haggle

Any party member can roll Persuasion, Deception, or Intimidation
against a merchant to haggle a discount on the current cart.
Well-placed companion skills and theme bonuses genuinely matter —
send your Bard to the market, keep the Barbarian at the door.

### Added
- **`server/services/bargainingService.js`** — pure math:
  - `calculateHaggleDC`: base DC by disposition (hostile 20 → allied
    10), rarity mod (+0 to +8), prosperity mod (-2 to +2)
  - `resolveHaggle`: d20 + ability + proficiency + theme vs. DC
  - Discount tiers: margin 0-4 → 5%, 5-9 → 10%, 10-14 → 15%, 15+ → 20%
  - Nat 20 = auto-success at max tier; nat 1 = auto-fail with
    disposition hit
  - Theme bonuses (+2): Guild Artisan / Noble on Persuasion,
    Charlatan on Deception, Criminal / Mercenary Veteran on
    Intimidation
- **`POST /api/merchant/:id/haggle`** — rolls for the character or
  any active companion. Body: `{ characterId, rollerType, companionId?,
  skill, itemRarity?, attemptNumber?, rollValue? }`. Returns the full
  result including `discountPercent` and `dispositionChange`.
- **Transaction integration** — `/dm-session/:id/merchant-transaction`
  accepts optional `haggleDiscountPercent` (clamped server-side to
  [0, 20]); applied to the total after the bulk discount.
- **In-shop UI** — new inline Haggle card in the merchant shop panel
  with roller dropdown (character + companions), skill dropdown, Roll
  button, and result display. Discount auto-applies to the cart's net
  cost and rides along to the transaction endpoint. Resets after each
  transaction.

### Tests
- 9 new integration tests (Group 18, 20 assertions): nat 20 max
  discount, low-roll failure, nat 1 crit-fail disposition hit,
  Intimidation failure penalty, repeat-attempt penalty, invalid skill
  rejected, companion as roller, discount applied in transaction,
  server-side clamp to 20%.
- Full suite: 427 passing (up from 407).

## [1.0.0.18] - 2026-04-17 — M2: Merchant Commissions / Custom Orders

Players can now commission custom items from merchants — the feature
you tried to build organically once and it didn't stick because the
mechanism wasn't there. Now it is.

Full lifecycle: player asks merchant to craft something → merchant
quotes price + lead time → player pays a deposit → world time advances
→ item becomes ready on the game-day deadline → player collects and
pays the balance.

### Added
- **Migration 033** — `merchant_orders` table with status state
  machine: pending → ready → collected (happy path); pending →
  cancelled (deposit forfeit); ready → expired (30 game days
  unclaimed).
- **Service layer** — `server/services/merchantOrderService.js`:
  - `placeCommission` — deducts deposit from party purse, credits
    merchant, inserts pending order
  - `collectOrder` — pays balance, adds item to party inventory
    (stack-merges on name)
  - `cancelOrder` — pending only; deposit forfeit
  - `processDueOrders` — flips pending → ready at deadline
  - `expireStaleReadyOrders` — 30-day hold before resell
- **REST endpoints** — `server/routes/merchant.js` (new file):
  - `POST /api/merchant/:id/commission`
  - `GET  /api/merchant/orders/character/:id`
  - `GET  /api/merchant/orders/:id`
  - `POST /api/merchant/orders/:id/collect`
  - `POST /api/merchant/orders/:id/cancel`
- **Living-world tick step 3.9** — runs `processDueOrders` and
  `expireStaleReadyOrders` every tick; queues narrative-queue
  entries so the DM can mention pickups / abandonments naturally
  next session.
- **AI marker** — `[MERCHANT_COMMISSION: Merchant=X Item=Y Price_GP=N
  Deposit_GP=M Lead_Time_Days=D Quality=Q Hook=...]`:
  - `detectMerchantCommission()` in `dmSessionService.js`
  - `dmSession.js` finds/creates the merchant, places the order,
    feeds a `[SYSTEM]` note back to the AI (confirming or reporting
    why the order was rejected)
- **DM prompt** — new CUSTOM ORDERS / COMMISSIONS section with
  guidance on when to use the marker, price ranges, lead times, and
  a worked example (masterwork dagger, 400gp, 150gp deposit, 7 days).
- **CommissionsPanel** — teal-accented slide-in panel with Active
  (pending + ready) and History (collected / cancelled / expired)
  sections. Collect + Cancel buttons per-order. New toolbar button
  alongside Inventory/Conditions.

### Tests
- 8 new integration tests (Group 17, 26 assertions): happy path,
  insufficient-deposit rejection, bad-input rejection (deposit >
  quoted, zero lead time), living-world tick flips pending to
  ready, collect pays balance + adds to inventory, collect blocked
  while pending, cancel + forfeit semantics, list orders for
  character.
- Full suite: 407 passing (up from 381).

## [1.0.0.17] - 2026-04-17 — M1 polish: Ultima-style inventory + equipped-by badges

Follow-on polish to M1 (v1.0.16). The in-session InventoryPanel
becomes a true party view, matching the Ultima-style sectioned display
we discussed.

### Changed
- **InventoryPanel** — replaces the tab-filtered inventory with a
  single all-at-once view grouped into five sections:
  Weapons / Armor / Consumables / Quest Items / Misc.
- Each section has a color-coded header, item count, and hides itself
  when empty.
- Quest-item detection stays narrow (explicit `quest: true` flag or
  narrow keyword list — "relic", "artifact", "prophecy", "key to",
  "letter from", etc.) so mundane items don't get mis-labeled.
- Consumable detection: potion, elixir, scroll, ration, antitoxin,
  oil, poison, acid, holy water, etc.
- Header relabeled "Party Inventory".

### Added
- **Equipped-by badges** on every inventory row where a copy of that
  item is equipped on a party member. Shows "Name · main/off/armor"
  pills (teal for the character, purple for companions). Multiple
  badges render if the same-named item is in multiple slots across
  the party.
- New `companions` prop on `InventoryPanel` wired through from
  `DMSession`.

## [1.0.0.16] - 2026-04-17 — M1: Party Inventory + Equip/Unequip

Retires Phase 8's item-transfer and Phase 9's companion-merchant
endpoints in favor of a single shared party bucket. Carried inventory
and gold now live on the recruiting character's columns; companions
keep their per-entity equipment slots and equip from the pool.

Foundational change for the merchant rework (M1-M4) and future fortress
storage (F1-F3).

### Added
- **Migration 032**: one-time merge of every active companion's
  inventory + gold into their recruiting character. Idempotent.
- **`POST /api/companion/:id/equip`** `{ slot, itemName }` — moves one
  item from the party pool to the companion's equipment slot. Any
  previously-equipped item returns to the pool.
- **`POST /api/companion/:id/unequip`** `{ slot }` — inverse.
- **`starting_inventory`** param on `POST /companion/create-party-member`
  merges into the recruiter's bucket at creation time.
- **CompanionSheet UI**: Equipment card with three slot rows + Unequip
  buttons + "equip from party pool" picker (slot dropdown + item
  dropdown + Equip button). Party pool fetched from the character.

### Changed
- `/companion/recruit` and `/create-party-member` now insert companions
  with empty carry columns by default.
- Removed the "Inventory & Equipment" carried-items list from
  CompanionSheet — items are party-wide, not companion-scoped.

### Removed / Retired (410 Gone)
- `POST /api/companion/:id/give-item` (Phase 8)
- `POST /api/companion/:id/take-item` (Phase 8)
- `POST /api/companion/:id/merchant-transaction` (Phase 9)

All three return 410 with an explanatory payload pointing at the
replacement. 244 lines of scaffolding removed.

### Tests
- 8 new integration tests in Group 14 (M1): retired-410s, equip from
  pool, swap returns previous, unequip, error paths (missing item,
  invalid slot, empty slot), recruit-zeroed-carry invariant.
- Phase 8's 7 tests and Phase 9's 5 tests deleted.
- Full suite: 381 passing.

## [1.0.0.15] - 2026-04-17 — Phase 10: Companion Multiclass

Companions can now have multiple classes (Wizard 3 / Cleric 2, etc.),
mirroring the character-side `class_levels` system from migration 001.
Closes the last major progression-parity gap between companions and
player characters.

### Added
- **Migration 031** — `companion_class_levels` TEXT column (JSON array
  of `{ class, level, subclass }`). Null-safe: pre-Phase-10 companions
  fall back to the legacy single-class columns via a new
  `parseCompanionClassLevels()` helper.
- **`targetClass` param** on `POST /api/companion/:id/level-up`:
  - Omitted → advances the primary class (back-compat)
  - Matches an existing class entry → advances that class
  - New class → adds a multiclass entry at level 1
- **Semantics** (mirror character-side):
  - `companion_level` = TOTAL level across all classes
  - `companion_class` / `companion_subclass` = primary (index 0)
  - ASI, subclass level, hit die, features all key off the TARGET
    class's level, not total (5e RAW)
  - Spell slots use `getMulticlassSpellSlots()` when class_levels has
    >1 entry; falls back to single-class `getSpellSlots()` otherwise
  - Theme tier + ancestry feat thresholds continue to key off TOTAL
    level (unchanged)
- **Recruit + create-party-member** endpoints seed class_levels with a
  single-entry array at recruitment time.
- **DM prompt** `formatCompanions` renders a multiclass line when
  class_levels has >1 entry: `Classes: Wizard 3 (Divination) / Cleric 2
  (Life) — total 5`. Single-class companions render unchanged.
- **`/level-up-info`** returns `classLevels` + `choices.canMulticlass`
  so the UI can render a class picker.
- **`/spell-slots`** returns `class_levels` + `pact_magic` (when
  warlock is one of the classes).
- **CompanionSheet UI**: blue-accented "Class to Advance" dropdown in
  the level-up modal groups existing classes with "Multiclass — add a
  new class at level 1" options for all 13 standard classes not
  already taken.

### Tests
- 6 new integration tests (24 assertions) in Group 16: recruit
  seeding, primary-class advance, multiclass addition, secondary-class
  advance, combined spell slots math, level-up-info shape.
- Full suite: 386 passing (up from 362).

## [1.0.0.14] - 2026-04-17 — Phase 9: Companion Merchant Transactions

Companions can now buy and sell from merchants using their own purse.
Spellcasters can buy components, fighters can sell salvage, etc. The
companion's own `gold_gp` / `gold_sp` / `gold_cp` columns (already on
the table since migration 001) are the wallet.

### Added
- **POST /api/companion/:id/merchant-transaction**
  `{ merchantId?, bought: [...], sold: [...] }`
  - Mirrors the character-side transaction endpoint in dmSession.js but
    uses companion's own inventory and gold columns.
  - Same bulk-discount math via `getBulkDiscount()`.
  - Same optimistic-locking merchant update via
    `updateMerchantAfterTransaction()`.
  - Skips NPC disposition ripple (companions aren't independent NPC
    relationship holders — route reputation through the recruiting
    character's transaction instead).
  - 400 on insufficient gold.
  - 400 on selling an item the companion doesn't hold (via the Phase 8
    `inventoryRemoveItem` helper).
  - 409 on merchant optimistic-lock conflict, with companion state
    rolled back to pre-transaction snapshot.

### Known (UI gap, deferred)
- The existing in-session MerchantShop panel in DMSession.jsx is
  character-only. Wiring a "shop as companion" toggle into that panel
  is a separate substantial UI change. Today the endpoint is callable
  via API or (future) AI-driven markers like `[COMPANION_SHOP]`. Will
  surface during playtest and can be addressed then.

### Tests
- 5 new integration tests (13 assertions) in Group 15 — buy, sell,
  insufficient gold, bulk discount threshold, sell-without-owning
  rejection.
- Full suite: 362 passing (up from 349).

## [1.0.0.13] - 2026-04-17 — Phase 8: Companion Item Transfer + Inventory Quick-View

Closes the last major daily-use gap in the companion system: handing a
potion to your companion and taking it back now takes two clicks,
without opening the full CompanionEditor. Also surfaces companion gold
and equipped gear on CompanionSheet so you don't have to hunt for it.

### Added
- **Two new endpoints** on `/api/companion/:id/`:
  - `POST give-item`  `{ characterId, itemName, quantity? }` — moves
    items from the character's inventory into the companion's
  - `POST take-item`  `{ characterId, itemName, quantity? }` — moves
    items in the opposite direction
  Both merge into an existing stack on the destination (case-insensitive
  name match), split partial stacks (quantity < total), and fully remove
  the source entry when quantity == total. Reject missing items,
  overdraws, and non-positive quantities with 400.
- **Shared helpers** `inventoryAddItem` / `inventoryRemoveItem` in
  `server/routes/companion.js` keep merge/split logic in one place.
- **CompanionSheet UI**: new green-accented "Inventory & Equipment"
  card. Displays:
  - Gold total (gp/sp/cp) in the header
  - Equipped gear as emoji chips (🗡 weapon, 🛡 shield, 🥼 armor)
  - Carried items with quantities
  - A "Hand back" button per inventory row that invokes take-item with
    quantity=1
  The card hides itself entirely when the companion has nothing
  (no gold, no items, no equipment).

### Tests
- 7 new integration tests in Group 14: both transfer directions, merge
  into existing stack, full-stack source removal, missing item
  rejection, overdraw rejection, non-positive quantity rejection.
- Full suite: 349 passing (up from 337).

## [1.0.0.12] - 2026-04-17 — Phase 7: Companion Combat Safety

Adds persistent condition tracking and full 5e death save mechanics for
companions. Previously the ConditionPanel kept conditions as React state
only (lost when the session ended), and there was no death save
infrastructure anywhere — a companion at 0 HP just sat there.

### Added
- **Migration 030** — three columns on `companions`:
  - `active_conditions` (JSON array of condition keys)
  - `death_save_successes`, `death_save_failures` (INTEGER 0..3)
- **Six new endpoints**:
  - `GET  /api/companion/:id/conditions`
  - `POST /api/companion/:id/conditions/add` — validates against known
    condition list; exhaustion levels are mutually exclusive
  - `POST /api/companion/:id/conditions/remove`
  - `GET  /api/companion/:id/death-saves`
  - `POST /api/companion/:id/death-save` — server rolls d20 if `roll`
    not provided; full 5e RAW (nat 20 revives at 1 HP, nat 1 = 2
    failures, 10+ = success, 3 successes stabilize, 3 failures die)
  - `POST /api/companion/:id/stabilize` — Medicine DC 10 equivalent
- **Rest hookups** — the existing `/rest/:id` endpoint now:
  - Long rest: clears all conditions except petrified, decrements
    exhaustion by 1 per level, and resets death-save tallies.
  - Short rest that brings the companion above 0 HP also resets
    death-save tallies.
- **DM prompt**: two new indented lines per companion in
  `formatCompanions`:
  - `Active conditions: Poisoned, Prone, Exhaustion 2`
  - `Death saves: 2 successes, 1 failure (at 0 HP — edge text)`
  Helpers `formatCompanionActiveConditionsLine` and
  `formatCompanionDeathSavesLine` exported from `dmPromptBuilder.js`.
- **CompanionSheet UI**:
  - Orange-accented Active Conditions card: chip display with tooltip
    descriptions and click-to-remove, plus dropdown + Add button.
  - Red-accented Death Saves card that only renders at 0 HP: three
    success circles + three failure circles, Roll Save button (server
    rolls), Stabilize button.

### Tests
- 13 new integration tests (Group 13) — initial empty state, add/remove,
  case-insensitive normalization, exhaustion mutual exclusion, unknown
  condition rejection, long-rest clearing + exhaustion decrement +
  petrified persistence, HP>0 rejection, success/failure/stabilize/die
  state transitions, nat 20 revive, nat 1 double-failure, stabilize
  endpoint, long-rest death-save reset.
- Full suite: 337 passing (up from 310).

## [1.0.0.11] - 2026-04-17 — Phase 6: Companion Rest + Spell Slots

Fixes the single biggest functional gap for companions: spellcasting
companions (wizards, clerics, druids, warlocks, bards, sorcerers,
paladins, rangers, artificers) can now actually cast leveled spells,
and every companion can take a long or short rest that restores HP.
Previously companions had no `spell_slots` column and the long rest
endpoint didn't exist for them.

### Added
- **Migration 029**: `companion_spell_slots`, `companion_spell_slots_used`,
  and `companion_hit_dice` columns on the `companions` table. All
  nullable. Max slots are computed on demand from class + level via the
  shared `getSpellSlots()` helper — only the used map is persisted.
- **New endpoints** mirroring the character-side contracts:
  - `GET /api/companion/:id/spell-slots` → `{ max, used, class, level }`
  - `POST /api/companion/:id/spell-slots/use` → consume one slot at
    given level; 400 if no slots available at that level
  - `POST /api/companion/:id/spell-slots/restore` → refund one used slot
  - `POST /api/companion/:id/rest` → `{ restType: 'long' | 'short' }`
    - long: restores full HP + clears all used slots
    - short: restores 50% of missing HP (min 1); warlocks also refresh
      pact slots (parity with character-side behavior)
- **DM prompt** now surfaces each spellcasting companion's current slot
  state as a `Spell slots: L1 2/4, L2 0/3` line under their block via
  the new `formatCompanionSpellSlotsLine()` helper in
  `dmPromptBuilder.js`. Max + used are pre-computed in `dmSession.js`
  so `dmPromptBuilder.js` stays import-free.
- **CompanionSheet UI**: purple-accented Spell Slots section with
  circle indicators and Use / +1 buttons per level, matching the
  CharacterSheet pattern. Two new action buttons — teal "Long Rest"
  and blue "Short Rest".

### Tests
- 8 new integration tests (30 assertions) in Group 12:
  spellcasting vs non-caster slot maps, use + restore round-trip,
  rejection paths (no such slot level, slots exhausted, npc_stats
  companion), long rest HP + slot restoration, short rest 50% heal
  math, warlock pact-slot recovery on short rest.
- Full suite: 310 passing (up from 280).

## [1.0.0.10] - 2026-04-17 — Phase 5.6: DM Prompt Parity + Critical Bug Fix

Two fixes surfaced during the Phase 5.5 audit: one long-standing bug that
was silently disabling companion backstory generation on recruit, and one
parity gap between companion and player-character progression in the DM
system prompt.

### Fixed
- **Critical typo in `narrativeIntegration.js:202`** — `onCompanionRecruited`
  was calling `companionBackstoryService.getBackstoryByCompanion`, which
  doesn't exist. The real function name is `getBackstoryByCompanionId`.
  Every companion recruit has been throwing `TypeError: ... is not a function`
  since before Phase 5.5 (caught by `.catch`, so non-fatal but silently
  disabling backstory generation). Fix restores backstory generation on
  recruit.

### Added
- **DM prompt parity with Phase 4**: companion theme abilities + ancestry
  feats are now rendered in the DM system prompt, matching the treatment
  player characters got via `formatProgression()`. Previously the DM saw
  a companion's class and stats but had no awareness of their Phase 5.5
  theme or tier abilities.
- **`getCompanionProgression(companionId)`** in
  `progressionCompanionService.js` — slim mirror of `getCharacterProgression()`
  returning theme + unlocks + ancestry feats. Single source of truth for
  pulling a companion's progression snapshot.
- **`formatCompanionProgressionLines(progression)`** in `dmPromptBuilder.js`
  — exported helper that renders the snapshot as indented lines (theme,
  unlocked abilities, ancestry feats). Plugged into each companion's block
  inside `formatCompanions()`.
- **dmSession.js** loads and attaches progression to each class-based
  companion at session start (with lazy backfill + silent failure, so a
  progression hiccup never blocks a session).

### Tests
- 13 new unit tests for `formatCompanionProgressionLines` in
  `tests/companion-skill-checks.test.js` — null/empty/missing-theme edge
  cases, full snapshot rendering, path_choice rendering, mechanics
  inclusion, orphaned-unlock handling.
- Integration suite still green at 280 passing.

### Known (out of scope)
- Fixing the typo unblocks the real backstory-generation flow, which
  surfaces two pre-existing latent bugs previously masked by the crash:
  a foreign-key constraint failure and an AI response parse failure.
  Both are still swallowed by the `.catch` in `onCompanionRecruited` and
  are left for a future pass.

## [1.0.0.9] - 2026-04-17 — Implementation Phase 5.5: Companion Progression

Extends the Themes + Ancestry Feats progression system to companions. At
recruit time a companion is auto-assigned a theme based on its class and
(when possible) an L1 ancestry feat based on the linked NPC's race. When
companions level up, theme tier abilities auto-unlock at L5/L11/L17 and
ancestry feats auto-pick at L3/L7/L13/L18 — one less prompt per companion
per session, keeping companion level-up fast.

### Added
- **Migration 028** — `companion_themes`, `companion_theme_unlocks`, and
  `companion_ancestry_feats` tables mirroring the character-side tables
  from 023/024.
- **`server/services/progressionCompanionService.js`** — single source of
  truth for companion progression:
  - `mapCompanionClassToTheme`: class → default theme (fighter→soldier,
    rogue→criminal, wizard→sage, etc.; unknown classes fall back to
    soldier).
  - `normalizeRaceToAncestryList`: NPC race text → ancestry `list_id`.
    Handles Drow, Half-Elf, Half-Orc, all three Aasimar paths, standard
    races, and Warforged. Returns `null` for unmapped races (Goblin,
    Bugbear, Firbolg, etc.) so ancestry-feat progression silently skips.
  - `autoAssignCompanionTheme`: idempotent upsert + L1 ability unlock.
  - `autoSeedCompanionAncestryFeatTier1`: L1 feat auto-pick.
  - `computeCompanionProgressionDecisions`: tier-threshold check for
    L5/L11/L17 theme unlock + L3/L7/L13/L18 ancestry feat auto-pick.
  - `ensureCompanionProgressionInitialized`: lazy backfill for pre-5.5
    companions.
- **POST /api/companion/recruit** and **POST /api/companion/create-party-member**
  auto-assign a theme + L1 feat after insert. Best-effort — failures are
  logged but never block recruitment.
- **POST /api/companion/:id/level-up** applies theme tier unlocks and
  auto-picks ancestry feats in the same request. Response's
  `levelUpSummary` now includes `themeTierUnlocked` and `ancestryFeatSelected`.
- **GET /api/companion/:id/level-up-info** returns a `progression` preview
  so the UI can show what will auto-apply.
- **GET /api/companion/:id/progression** — new read-only snapshot
  (theme + all tiers + unlocks + feats) mirroring the character-side
  endpoint.
- **CompanionLevelUpModal UI** — purple theme-tier card and teal
  ancestry-feat card. Both are informational; the pick has already been
  made by the server. The teal card explicitly labels "auto-picked
  (companions don't choose)" so the DM understands the difference from
  the player flow.

### Tests
- 6 new integration tests (Group 11 in `tests/integration.test.js`):
  - Auto-assign theme + L1 feat on recruit
  - Goblin (unmapped) recruit still gets theme but no feat
  - L4→L5 triggers theme tier unlock
  - L2→L3 auto-picks ancestry feat
  - GET /progression returns full snapshot
  - Pre-5.5 companion lazy-backfill on level-up
- Integration suite: 280 passed / 0 failed (up from 258).

## [1.0.0.8] - 2026-04-17 — Implementation Phase 5: Level-Up Wizard Progression

Extends the level-up wizard to support Theme tier unlocks (L5/L11/L17) and
Ancestry Feat selection (L3/L7/L13/L18) for player characters. The wizard now
surfaces these decisions at the right tier thresholds, validates inputs
server-side, and persists everything inside the same transaction as the
existing level-up writes.

### Added
- **Theme tier auto-unlock at L5/L11/L17**: When a character with a theme
  crosses one of these levels, the corresponding L5/L11/L17 theme ability
  is automatically granted. Surfaced in the wizard as a purple-accented
  notification card showing the new ability's name, description, and flavor
  text. No player choice — themes have exactly one ability per tier.
- **Ancestry Feat pick at L3/L7/L13/L18**: When crossing these levels, the
  wizard shows 3 feat options from the character's race list and requires
  one pick before allowing completion. Teal-accented selectable cards.
- **`computeProgressionDecisions(characterId, newTotalLevel)`** helper in
  `server/routes/character.js` — determines whether a tier threshold is
  crossed and returns the unlock/pick details. Skips silently if the
  character has no theme, no prior ancestry feat, or has already unlocked
  at that tier.
- **`GET /api/character/level-up-info/:id`** now returns a `progression`
  object with `theme_tier_unlock` and `ancestry_feat_tier`, each null when
  not applicable.
- **`POST /api/character/level-up/:id`** accepts optional `ancestryFeatId`.
  Validates that it's provided when a tier threshold is crossed (422 if
  missing, 400 if not one of the offered options). Response payload's
  `levelUpSummary` now includes `themeTierUnlocked` and `ancestryFeatSelected`
  for UI celebration.
- **Review step** in LevelUpPage shows both theme tier unlock and ancestry
  feat selection when applicable.

### Fixed
- **Subclass validation regression from 4.5**: The multiclass subclass
  validation was firing spuriously for single-class level-ups (e.g., a
  Fighter leveling L2→L3 has subclass=Champion in the DB but the request
  body doesn't re-send it). Now checks `existingSubclass` from
  `classLevels` before demanding a new pick. Multiclass case still
  returns 422 correctly when no existing subclass + no payload subclass.

### Deferred (Phase 5.5)
- **Companion theme/ancestry progression**: Companions don't currently have
  theme or ancestry feat assignments (character creation wizard only sets
  these for player characters), and their level-up path is separate. Adding
  this requires companion theme assignment at recruitment, companion-specific
  progression tracking, and AI personality-based auto-pick logic. Scoped as
  its own phase.

### Testing
- 5 new integration tests (Group 10):
  - `testLevelUpInfoSurfacesProgressionDecisions`: L2→L3 returns ancestry
    feat tier with 3 options, no theme unlock
  - `testLevelUpRequiresAncestryFeatId`: 422 when missing; character
    unchanged
  - `testLevelUpPersistsAncestryFeatAndThemeTier`: L4→L5 unlocks Soldier's
    "Field Discipline"
  - `testLevelUpWithAncestryFeatChoice`: feat pick persists via transaction,
    surfaces in `/progression` endpoint
  - `testLevelUpRejectsInvalidAncestryFeatId`: 400 for elf feat on dwarf
    character
- 258/258 integration tests pass (up from 232)
- 55/64/26/43 unit tests all green
- Client builds cleanly

## [1.0.0.7] - 2026-04-17 — Phase 4.5: Level-Up Flow Cleanup

Foundation pass on the level-up flow before Phase 5 layers Theme tier unlocks
and Ancestry Feat selection on top. Shipped as five small, focused commits.

### Added
- **Feat-instead-of-ASI at level-up**: When a character reaches an ASI level
  (4/6/8/10/12/14/16/19 depending on class), the wizard now offers a toggle:
  "Increase Ability Scores (+2 total)" or "Take a Feat". Feat mode shows a
  dropdown of all 42 feats with descriptions, benefits, and prerequisites.
  Feats with half-ASI ability bumps (Resilient, Actor, Observant, etc.)
  prompt for which ability gets +1. Selected feats are persisted to the
  character's `feats` JSON array with `acquiredAtLevel` for provenance.
- **Multiclass subclass validation**: `POST /api/character/level-up/:id`
  returns `422 Unprocessable Entity` when the player attempts to level
  into a class that requires a subclass at the target level (e.g.,
  multiclassing into Cleric/Sorcerer/Warlock at L1) without providing
  one. Error payload includes `targetClass` and `newClassLevel` for UI
  feedback. Character state is left untouched on failed validation.

### Changed
- **Transaction-wrapped writes**: The level-up endpoint issued up to 10
  separate `dbRun` calls for feats, cantrips, spells, Keeper data, and
  the main character update. A SQL error mid-flight could leave the
  character in a half-updated state. Now all writes happen inside a
  single `db.transaction('write')` — on any error, `tx.rollback()` is
  called before re-throwing.
- **Consolidated level-up UI**: Deleted `client/src/components/LevelUpModal.jsx`
  (768 lines of "coming soon" placeholders and divergent logic). The
  full-screen `LevelUpPage.jsx` is now the single level-up surface. Both
  the character sheet "Level Up" button and the character list button
  route through the same flow. CharacterManager lost ~50 lines of modal
  state management.
- **Clarified CON-retroactivity math**: The formula
  `(newConMod - conMod) × newTotalLevel` was previously flagged as a bug
  but is actually correct — this level's hpGain was computed with the
  old mod, and we need to add modDiff for this level plus modDiff ×
  (newTotalLevel - 1) retroactive, which equals modDiff × newTotalLevel.
  Expanded inline comment explaining the derivation.

### Deferred
- **DecisionStep abstraction**: Planned as part of 4.5 but deferred to
  Phase 5. Building abstractions speculatively risks getting them wrong;
  extracting from real Theme tier / Ancestry Feat usage in Phase 5 will
  produce a better fit.

### Testing
- 3 new integration tests (Group 10):
  - `testLevelUpRequiresSubclassForMulticlass`: verifies 422 + untouched
    character state, then successful retry with subclass
  - `testLevelUpFeatInsteadOfASI`: creates a Fighter, levels up with
    `feat=resilient` (+1 CON), verifies feat persisted, CON bumped 14→15
  - `testLevelUpFeatMissingFeatKey`: edge case — `asiChoice.type='feat'`
    with no feat key still succeeds, nothing appended
- 232/232 integration tests pass (up from 215)
- 55/55 character-memory, 64/64 moral-diversity, 26/26 combat-tracker,
  43/43 progression-prompt all green
- Client builds cleanly

### Files touched
- `server/routes/character.js` (validation + feat handling + transaction)
- `client/src/components/LevelUpPage.jsx` (feat UI)
- `client/src/components/LevelUpModal.jsx` (deleted)
- `client/src/components/CharacterManager.jsx` (modal removal, delegate up)
- `client/src/App.jsx` (`handleShowLevelUp` accepts optional character)
- `tests/integration.test.js` (3 new tests)

## [1.0.0.6] - 2026-04-17 — Implementation Phase 4: AI DM Prompt Integration

### Added
- **Progression-aware AI DM sessions.** The AI DM system prompt now includes a `CHARACTER PROGRESSION LAYER` section when the character has a theme selected:
  - Theme name, path choice (e.g., Outlander biome), identity, and signature skills
  - All unlocked theme tier abilities with descriptions and mechanics
  - Ancestry feats with tier + mechanics
  - Knight moral path state with path-specific DM guidance (True/Reformer/Martyr/Complicit/Fallen/Redemption — each gets a tailored narration directive)
  - Resonant Subclass × Theme synergy (if any) with name, description, mechanics
  - Mythic × Theme amplification (resonant combo) with tier bonuses filtered by character level, OR dissonant arc description + required threshold acts
  - Per-theme **narration hook** — short DM directives for how each theme should shape NPC responses, environmental description, and scene framing (all 21 themes have hooks)
- **`server/services/progressionService.js`**: Extracted `getCharacterProgression(characterId)` as reusable service. Used by both the Character Sheet endpoint (GET /api/character/:id/progression) and the DM session start flow.
- **`formatProgression()` + `NARRATION_HOOKS_BY_THEME`** exported from `server/services/dmPromptBuilder.js`.
- DM session start (`POST /api/dm-session/start`) now fetches progression for both the primary character and optional second character; snapshots are passed into sessionConfig as `progression` and `secondaryProgression` and rendered by `formatProgression()`.
- **`tests/progression-prompt.test.js`** (43 new tests) covers: empty/null handling, theme identity rendering, path_choice rendering (Outlander biome, Knight order), ancestry feat rendering, Knight moral path guidance for all 6 paths, subclass synergy rendering, level-gated Mythic tier bonus rendering (T1 at L5, T2 at L10, T3 at L15, T4 at L20), dissonant arc rendering, narration hook presence for all 21 themes, full prompt integration, and graceful absence when progression is not supplied.

### Changed
- `GET /api/character/:id/progression` now delegates to the extracted service (behavior unchanged; same response shape). The endpoint file shrunk from ~100 lines to 9 lines.

### Testing
- 215/215 integration tests pass (no regressions from refactor)
- 43/43 new progression-prompt tests pass
- 55/55 character-memory, 64/64 moral-diversity, 26/26 combat-tracker pass
- Client builds cleanly
- Full run of all 5 suites: 403 total passing

## [1.0.0.5] - 2026-04-17 — Implementation Phase 3: Character Sheet Display

### Added
- **"Progression" tab on the Character Sheet** (new tab between "Features & Traits" and "Spells"):
  - Theme identity block (name, path choice, identity text, signature skills, Knight moral path if applicable)
  - Full 4-tier theme progression with visual state indicators:
    - Unlocked abilities (purple, 100% opacity, "✓ Unlocked" badge)
    - Ready-to-unlock abilities (amber badge — level reached but ability not yet granted)
    - Future abilities (dimmed, "Level X" badge for preview)
  - Ancestry Feats section (teal) showing all selected feats with tier, list, description, and mechanics
  - Resonant Subclass × Theme synergy callout (indigo) when the character's subclass/theme pair matches a seeded synergy (e.g., Battle Master + Soldier = "Tactician's Eye")
  - Mythic × Theme amplification callout (amber for resonant, red for dissonant) when the character has a mythic path with a matching combo. Shows T1-T4 bonus scaling for resonant combos; arc description + threshold acts for dissonant arcs
- **QuickReferencePanel "Abilities" tab extended** with compact in-session displays:
  - Theme callout with all unlocked tier abilities (purple)
  - Ancestry Feats summary (teal)
  - Resonant Synergy indicator (indigo)
  - Fetches progression data silently; progression sections hidden if unavailable (no blocking failures)
- **`GET /api/character/:id/progression` enhanced** to return:
  - Character class/subclass/level for consumer UI context
  - Full theme metadata (identity, signature skills, tags)
  - `theme_all_tiers` — all 4 theme tier abilities for upcoming-tier preview
  - `subclass_theme_synergy` — resonant pair match from seed data, or null
  - `mythic_theme_amplification` — resonant or dissonant combo from seed data (with tier bonuses or arc description), or null (also works for Legend Path's "any" theme sentinel)

### Testing
- Added `testProgressionReturnsUpcomingTiersAndSynergy` (verifies enriched endpoint, theme_all_tiers, synergy detection for Battle Master + Soldier)
- Added `testProgressionNoSynergyForNonResonantPair` (verifies null synergy when subclass/theme pair isn't in seed data)
- All 215 integration tests passing (up from 197)
- All 55/64/26 unit tests passing
- Client builds cleanly

## [1.0.0.4] - 2026-04-17 — Implementation Phase 2: Character Creation Theme Selection

### Added
- **Progression API** (`server/routes/progression.js`): Read-only endpoints exposing the reference catalog for the character creation wizard, level-up wizard, and character sheet:
  - `GET /api/progression/themes` — All 21 themes with metadata and L1 abilities
  - `GET /api/progression/themes/:id` — Full theme with all tier abilities (L1/L5/L11/L17)
  - `GET /api/progression/ancestry-feats/:listId` — Feats for a race, optionally filtered by tier
  - `GET /api/progression/team-tactics` — All 20 team tactics
  - `GET /api/progression/subclass-theme-synergies` — All 50 resonant pairings
  - `GET /api/progression/mythic-amplifications` — All 17 path × theme combos
- **Character Progression GET endpoint**: `GET /api/character/:id/progression` — Returns a character's theme, tier unlocks, ancestry feats, and Knight moral path state.
- **Theme + Ancestry Feat selection in Character Creation Wizard**:
  - Background dropdown replaced with Theme picker (maps 1:1 to old Backgrounds — downstream Step 3 personality suggestions still work via the legacy `background` field auto-synced from theme)
  - Conditional creation-time path choice for Outlander (biome) and Knight of the Order (order type)
  - L1 Ancestry Feat picker renders after race (and subrace, if applicable) is chosen — shows 3 feat options with descriptions, pick one
  - Selected theme L1 ability shown as preview in the wizard
  - Review step (Step 5) displays selected Theme, path choice, and Ancestry Feat
- **Character creation persistence**: `POST /api/character` now accepts `theme_id`, `theme_path_choice`, `ancestry_feat_id`, and `ancestry_list_id`. On character creation:
  - Inserts into `character_themes` (theme + path choice)
  - Inserts L1 ability into `character_theme_unlocks`
  - Inserts into `character_ancestry_feats` (the chosen L1 feat)
  - Initializes `knight_moral_paths` row if theme is knight_of_the_order (default path: 'true')

### Testing
- **Group 10 in integration tests** (9 new tests): theme/feat catalog lookups, 404 handling, character creation with progression fields, Knight moral-path initialization, legacy character creation without progression fields (graceful no-op)
- All 201 integration tests passing
- All 55 character-memory, 64 moral-diversity, 26 combat-tracker tests passing
- Client builds cleanly

## [1.0.0.3] - 2026-04-17 — Implementation Phase 1: Foundation

### Fixed
- **Character memory test**: Removed stale assertion for a 3KB soft cap that no longer exists. The cap was removed long ago (per the design decision that character_memories grows unbounded on disk), but the test and doc comment still referenced it. Updated both to accurately describe unbounded behavior. All 55 character-memory tests now pass.

### Added (Database + Seed Data)
- **Migrations 023-027**: Complete schema for the progression system
  - `023_themes_schema.js`: themes, theme_abilities, character_themes, character_theme_unlocks, knight_moral_paths (6-path tracker for True/Reformer/Martyr/Complicit/Fallen/Redemption)
  - `024_ancestry_feats_schema.js`: ancestry_feats, character_ancestry_feats
  - `025_synergies_schema.js`: team_tactics, character_team_tactics, subclass_theme_synergies, mythic_theme_amplifications
  - `026_narrative_trackers_schema.js`: mythic_arcs, mentor_imprints, prelude_unlock_flags
  - `027_downtime_schema.js`: downtime_periods, downtime_activities, downtime_vignettes
- **Seed data**: All progression reference content loaded automatically on server startup
  - 22 themes (21 active + 1 "any" sentinel for path amplifications)
  - 84 theme abilities (L1/L5/L11/L17 × 21 themes)
  - 195 ancestry feats (13 lists × 5 tiers × 3 choices)
  - 20 team tactics (10 combat, 5 utility_skill, 5 defensive_survival)
  - 50 subclass × theme synergies across all 12 classes including Keeper custom class
  - 17 mythic × theme amplifications (10 resonant + 7 dissonant arcs)
- **progressionSeedService.js**: Idempotent seed runner wired into `initDatabase()`. Safe to run on every startup.

### Tested
- All 5 schema migrations verified applying cleanly against Turso
- All seed data verified loading correctly (counts match design docs)
- All 156 integration tests passing
- All 64 moral-diversity tests passing
- All 26 combat-tracker tests passing
- Client builds cleanly

## [1.0.0.2] - 2026-04-16 — Design Phase: Themes, Ancestry Feats, Party Synergies, Subclass Synergies

### Design Documents (not yet implemented in code)
- **THEME_DESIGNS.md**: Full design for 21 Themes (leveling backgrounds), each with L1/L5/L11/L17 progression and balance-passed abilities. Replaces static D&D backgrounds with a four-tier progression layer.
- **PARTY_SYNERGIES.md**: Three-tier synergy system — Gear & Positioning (10 universal), Theme (34 signature + generative tag-based), Team Tactics (20 Pathfinder-style trainable via downtime).
- **ANCESTRY_FEATS.md**: 180 ancestry feats across 12 lists (5 tiers × 3 choices each). Covers all 10 races plus Drow and Aasimar path variants. Balance-passed.
- **SUBCLASS_THEME_SYNERGIES.md**: ~40 resonant subclass × theme pairings with small thematic mechanical bonuses. Covers the most iconic combinations across all 12 classes (including custom Keeper class).
- **MYTHIC_THEME_AMPLIFICATIONS.md**: 11 resonant amplifications + 7 dissonant narrative arcs + 2 special Shadow Paths (Redemption, Corrupted Dawn). Amplifications scale across Mythic Tiers T1-T4. Dissonant arcs unlock unique abilities through in-character atonement or corruption acts tracked by the AI DM.
- **DOWNTIME_DESIGN.md**: Complete overhaul of the Downtime v2 system. Runs between sessions (not in-session) to solve AI DM time-drift. Parallel Limited structure (1 Main + 2 Background per character). 30+ activities across 10 categories including Team Tactics training, Mentor's Imprint deepening, Mythic atonement. Companions auto-manage with personality-driven requests.

### Changed
- **FUTURE_FEATURES.md**: Extensive design decisions locked in for Themes, Ancestry Feats, Party Synergies, Mythic interactions, Mentor's Imprint, and downtime overhaul.
- **races.json**: Removed Genasi, Firbolg, Tabaxi, and Goliath from character creator to narrow race scope.

### Design Decisions Locked In
- Themes replace Backgrounds entirely, with 21 distinct progressions (one per background)
- Ancestry Feats unlock at L1/3/7/13/18, staggered to avoid overlap with other progression systems
- Companions auto-pick ancestry feats and theme unlocks based on personality — no menus for AI characters
- Knight of the Order gets six branching paths (True/Reformer/Martyr/Complicit/Fallen/Redemption) with positive and negative consequences at every tier
- Fallen Aasimar makes a permanent "Path's Choice" at L13 (Redeemer or Embraced Shadow) that reshapes the L18 capstone
- Mentor's Imprint: once per character, after 5+ sessions with an AI-gated trusted companion, gain one L1-tier trait from their Theme

## [1.0.0.1] - 2026-04-05

### Added
- **Prelude Sessions**: Play through a character's origin story before their first adventure
  - Setup form with location, time span, ending location, themes, tone, and story beats
  - Dedicated Opus-powered prompt with 3-act structure (Foundation, Turning Point, Threshold)
  - Background and class-specific turning point guidance (unique hooks for all 14 classes + 12 backgrounds)
  - Tutorial integration — game mechanics introduced through narrative, not exposition
  - Pacing rules for 3-5 hours of rich, unhurried storytelling
  - NPC creation guidelines for 2-4 memorable origin characters
  - On completion: backstory enriched with prelude summary, canon facts extracted, prelude_completed flag set
  - "Play a Prelude?" option shown in AI DM session setup for new characters
- **Session Encountered field**: NPC codex now tracks and displays `first_seen_session` across Campaign Prep and in-session NPC Codex panel
- **CHANGELOG.md**: This file

### Changed
- NPC codex `updateNpc()` now accepts `first_seen_session` in allowed fields
- Campaign Prep NPC edit form includes "Session Encountered" input
- NPCCodexPanel shows "First Encountered: Session X" in detail view and edit form

## [1.0.0.0] - Pre-changelog

All features prior to this changelog entry, including:
- AI Dungeon Master (Player Mode) with Claude Opus/Sonnet
- DM Mode (user as DM, AI controls 4 characters)
- Campaign plan generation, NPC codex, plot threads, campaign prep
- Combat tracker, inventory panel, merchant system, crafting
- Weather, survival, mythic progression, piety system
- Party base system, notoriety, long-term projects
- Story chronicles, canon facts, session memory
- User authentication, Keeper custom class
- Reference panels, effect tracker, dice roller, DM coaching
