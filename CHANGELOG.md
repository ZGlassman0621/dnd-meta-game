# Changelog

All notable changes to the D&D Meta Game project will be documented in this file.

## [1.0.0.3] - 2026-04-17 — Implementation Phase 1: Foundation

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
