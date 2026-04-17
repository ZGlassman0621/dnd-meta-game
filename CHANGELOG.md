# Changelog

All notable changes to the D&D Meta Game project will be documented in this file.

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
