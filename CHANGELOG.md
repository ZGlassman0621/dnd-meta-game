# Changelog

All notable changes to the D&D Meta Game project will be documented in this file.

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
