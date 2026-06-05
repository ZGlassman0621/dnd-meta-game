# Progression Systems Implementation Plan

Status: Draft — phased roadmap for implementing the 6 design documents.

## What we're implementing

Six design documents collectively define the progression overhaul:

1. [THEME_DESIGNS.md](THEME_DESIGNS.md) — 21 Themes replacing Backgrounds, 5 tiers each
2. [ANCESTRY_FEATS.md](ANCESTRY_FEATS.md) — 180 Ancestry Feats across 12 lists
3. [PARTY_SYNERGIES.md](PARTY_SYNERGIES.md) — 3-tier synergy system (Gear, Theme, Team Tactics)
4. [SUBCLASS_THEME_SYNERGIES.md](SUBCLASS_THEME_SYNERGIES.md) — ~40 resonant subclass × theme pairs
5. [MYTHIC_THEME_AMPLIFICATIONS.md](MYTHIC_THEME_AMPLIFICATIONS.md) — 11 resonant + 7 dissonant combos + 2 Shadow Paths
6. [DOWNTIME_DESIGN.md](DOWNTIME_DESIGN.md) — Between-sessions downtime v3 with 30+ activities

This is a **multi-month implementation**. Rushing it will create technical debt and broken integrations. We phase it.

## Phasing philosophy

Each phase is **shippable on its own** — the game remains playable at every phase boundary, with a useful new feature added. We don't leave half-built systems exposed.

Dependencies flow downward: later phases build on earlier ones. We don't try to ship Downtime v3 before the Theme system exists, because Team Tactics training depends on it.

Testing happens continuously — after each phase, we run the full test suite (7 suites) and build the client. No phase ends until tests pass and the build is clean.

---

## Phase 1 — Foundation: Database + Seed Data

**Scope:** All new tables, migrations, and data seeding. No UI yet.

**Tables to create:**
- `themes` — theme definitions (id, name, identity, signature_skills, etc.)
- `theme_tiers` — per-tier abilities for each theme (theme_id, tier, ability_name, description, mechanics)
- `character_themes` — junction (character_id, theme_id, subrace_variant, path_choice)
- `character_theme_unlocks` — per-character unlocked abilities (character_id, theme_id, tier, chosen_ability_id)
- `ancestry_feats` — feat definitions (id, race, tier, name, description, mechanics)
- `character_ancestry_feats` — selected feats (character_id, feat_id, tier, selected_at_level)
- `team_tactics` — trainable tactics (id, name, description, effect, category)
- `character_team_tactics` — learned tactics (character_id, partner_character_id, tactic_id, learned_at)
- `subclass_theme_synergies` — resonant pairs (id, class, subclass, theme_id, name, effect_description)
- `mythic_theme_amplifications` — resonant/dissonant combos (id, mythic_path, theme_id, is_dissonant, name, effect_by_tier)
- `mythic_arcs` — per-character arc tracking (character_id, arc_name, atonement_acts, corruption_acts, milestones_reached)
- `mentor_imprints` — Mentor's Imprint state (character_id, mentor_npc_id, session_count, imprint_granted)
- `downtime_periods` — between-session downtime (id, campaign_id, start_day, end_day, created_at, completed_at)
- `downtime_activities` — per-character assignments (downtime_period_id, character_id, slot, activity_type, parameters, outcome)

**Seed data:**
- All 21 Themes × 5 tiers × 3 choices = 315 rows in `theme_tiers`
- 180 Ancestry Feats across 12 lists
- 20 Team Tactics
- ~40 Subclass × Theme synergies
- ~20 Mythic × Theme amplifications (11 resonant + 7 dissonant + 2 shadow)

**Migrations:** Create `023_themes_ancestry_foundation.js` (this is a big migration — may split into 023-028 for separate concerns).

**Testing:** Database integration tests confirming seed data loaded and relationships work.

**Estimated effort:** 2-3 days of focused work, most of which is content entry (pasting the design docs into seed files).

**Deliverable:** Database is ready. No UI changes visible to players.

---

## Phase 2 — Character Creation: Theme Selection

**Scope:** Update character creation wizard to select a Theme. All existing background logic remains as a fallback for existing characters.

**Changes:**
- New step in character creation wizard: "Choose Your Theme" (replaces "Choose Background" or appears alongside it)
- Theme picker UI — list of 21 themes with descriptions and mechanical previews
- L1 Ancestry Feat selection (3 choices shown, pick one)
- Path choice for Outlander (biome selection) — baked into theme selection flow
- Order Type choice for Knight of the Order — baked into theme selection flow

**Backend:**
- Character creation endpoint accepts `theme_id`, `theme_path_choice`, `ancestry_feat_id` at L1
- Falls back gracefully if the character is being restored from a backup with no theme set (assigns the matching Background's Theme automatically)

**Testing:**
- Integration tests for creating characters with each Theme
- Migration test for converting existing characters (Background → Theme)

**Estimated effort:** 3-4 days (UI work + integration).

**Deliverable:** New characters can select a Theme. Existing characters are mapped to their equivalent Theme automatically. No gameplay changes yet beyond data capture.

---

## Phase 3 — Character Sheet: Display Active Abilities

**Scope:** Show Theme and Ancestry Feat abilities on the character sheet. Make the selections visible to the player.

**Changes:**
- Character sheet gets a new "Progression" tab showing:
  - Current Theme + tier + unlocked abilities
  - Ancestry Feats selected
  - Resonant Subclass × Theme synergy (if applicable) — passive bonus described
  - Resonant Mythic × Theme amplification (if applicable) — passive bonus described
- Quick reference panel for in-session use shows active abilities
- Character creation wizard is updated to reflect these additions in the final review step

**Backend:**
- `GET /api/character/:id/progression` endpoint returns the full progression state
- No new logic, just a clean data contract for the UI

**Testing:**
- UI rendering tests
- Integration test for the new endpoint

**Estimated effort:** 2-3 days.

**Deliverable:** Players can see their Theme abilities, Ancestry Feats, and resonant synergies on their character sheet.

---

## Phase 4 — AI DM Prompt Integration

**Scope:** The AI DM knows about Themes, Ancestry Feats, and synergies during sessions.

**Changes:**
- `dmPromptBuilder.js` extended to include:
  - Active Theme + tier + abilities (with mechanical details)
  - Ancestry Feats selected (with mechanical details)
  - Active Subclass × Theme synergy (if any)
  - Active Mythic × Theme amplification or arc (if any)
- Theme-specific narration hooks: e.g., the prompt tells the DM to reference Folk Hero recognition in rural settlements, Knight of the Order code in moral situations, etc.
- Marker detection for ability usage (e.g., `[THEME_ABILITY: Acolyte - Faithkeeper]` — used to track per-rest limits)

**Testing:**
- Prompt builder tests confirming Theme/Ancestry content appears in the prompt
- Character-memory tests updated to check Theme-aware behaviors

**Estimated effort:** 3-4 days (careful prompt engineering).

**Deliverable:** The AI DM reads and responds to Theme/Ancestry identity in session. Abilities are tracked.

---

## Phase 5 — Level-Up Wizard

**Scope:** When a character crosses a tier threshold (Theme L5/L11/L17, Ancestry L3/L7/L13/L18), the level-up wizard presents the new options.

**Changes:**
- Level-up wizard detects tier crossings for both Theme and Ancestry
- Theme tier unlock screen: 3 choices for the new tier's ability
- Ancestry Feat selection screen: 3 choices for the new feat tier
- **Companion auto-pick logic:** A companion's level-up uses an AI subroutine that evaluates the companion's personality data (voice, mannerism, motivation, ideals, bonds, flaws, alignment) and picks the most thematically appropriate option. Delivered as a narrative beat: *"Tormund grins. 'Time I learned the old stone-runner trick.'"*

**Backend:**
- `POST /api/character/:id/level-up` extended to accept Theme/Ancestry selections
- Companion auto-pick helper in `companionPersonalityService.js`

**Testing:**
- Level-up integration tests for each tier threshold
- Companion auto-pick tests covering personality-based selection

**Estimated effort:** 4-5 days.

**Deliverable:** Characters can level up and gain Theme/Ancestry abilities. Companions do this automatically with narrative flair.

---

## Phase 6 — Party Synergies: Gear & Theme Tiers

**Scope:** Implement Tier 1 (Gear & Positioning) and Tier 2 (Theme) synergies. Tier 3 (Team Tactics) is deferred to after Downtime.

**Changes:**
- Combat tracker detects synergy conditions during play:
  - Gear synergies (Shield Wall activates when two characters with shields are adjacent)
  - Theme synergies (Sworn Brothers activates when two Knights attack the same enemy)
- UI indicator shows which synergies are currently active
- AI DM prompt is informed of active synergies so narration reflects them
- Generative tag-based synergies handled by the AI DM when Theme pairs share tags

**Backend:**
- `synergyService.js` — detection and application logic
- Combat state tracks adjacency, attack targets, etc.

**Testing:**
- Unit tests for each Gear synergy trigger condition
- Unit tests for each Theme synergy trigger condition
- Integration test for mixed-party synergies

**Estimated effort:** 5-6 days.

**Deliverable:** Synergies activate automatically in combat. Players see them happen. AI DM narrates them.

---

## Phase 7 — Downtime v3 System

**Scope:** The between-sessions downtime mode with activity planning, time advancement, and AI DM vignette generation.

**Changes:**
- Downtime planning screen — new UI route, appears between sessions
- Activity catalog UI — browse and select activities by category
- Companion request modals — approve/redirect companion auto-selections
- Downtime results screen — recap of outcomes before starting next session
- AI DM system prompt integration — hard time statement + activity summary + vignette instructions
- `current_game_day` atomic advancement

**Backend:**
- `downtimeService.js` — activity resolution logic, cost calculation, outcome generation
- `downtimePromptBuilder.js` — vignette integration
- `POST /api/downtime/create` — start a new downtime period
- `POST /api/downtime/:id/activities` — assign activities
- `POST /api/downtime/:id/resolve` — finalize, advance clock, generate outcomes

**Integration:**
- Existing Party Base upgrade system routes through Downtime as one of the available activities
- Existing Crafting system routes through Downtime
- Piety, Mythic arc progression, NPC aging/absence all integrate

**Testing:**
- Integration tests for each activity type
- Downtime flow tests (create → assign → resolve → advance clock)
- AI DM prompt tests confirming time statement is injected correctly

**Estimated effort:** 8-10 days (this is the biggest phase).

**Deliverable:** Players can take downtime between sessions, allocate activities, and see results narrated as vignettes at the next session start.

---

## Phase 8 — Team Tactics (Tier 3 Party Synergies)

**Scope:** Now that Downtime exists, implement Team Tactic training and activation.

**Changes:**
- "Train Team Tactic" becomes a Main Activity in Downtime
- Both characters must participate
- Character sheet shows learned Team Tactics with specific partners
- Combat detection for Team Tactic triggers (similar to Theme synergies)
- AI companions request Team Tactic training during downtime based on personality

**Testing:**
- Team Tactic learning integration tests
- Combat detection tests for each tactic
- Companion personality-driven request tests

**Estimated effort:** 3-4 days.

**Deliverable:** Complete Party Synergy system — all three tiers functional.

---

## Phase 9 — Narrative Trackers: Mentor's Imprint, Mythic Arcs

**Scope:** Long-term narrative tracking systems.

**Changes:**
- Mentor's Imprint declaration UI (player nominates a mentor during a session or between them)
- Session count tracking + AI-gated readiness check
- Downtime "Mentor's Imprint Deepening" activity feeds into this
- Mythic arc tracking: atonement and corruption acts counter
- Arc threshold notifications (reach a new tier of Redemption / Corrupted Dawn)

**Backend:**
- `mentorImprintService.js` — declaration, progress tracking, readiness evaluation
- `mythicArcService.js` — act tracking, threshold triggers, ability unlock delivery

**Testing:**
- Arc progression tests
- Mentor's Imprint flow tests

**Estimated effort:** 4-5 days.

**Deliverable:** Long-term character arcs are tracked and deliver mechanical payoffs.

---

## Phase 10 — PWA + Mobile Notifications (Future)

**Scope:** See FUTURE_FEATURES.md. Not part of this implementation push — deferred until core progression systems are live and stable.

---

## Overall estimates

| Phase | Focus | Estimated Days |
|-------|-------|---------------|
| 1 | Database + seed data | 2-3 |
| 2 | Character creation | 3-4 |
| 3 | Character sheet display | 2-3 |
| 4 | AI DM prompt integration | 3-4 |
| 5 | Level-up wizard | 4-5 |
| 6 | Gear & Theme synergies | 5-6 |
| 7 | Downtime v3 | 8-10 |
| 8 | Team Tactics | 3-4 |
| 9 | Narrative trackers | 4-5 |
| **Total** | | **34-44 days** |

That's 7-9 weeks of focused work, assuming no surprises and no parallel projects. Realistically, with normal life interruptions, this is probably 2-3 months of steady part-time work, or 6-8 weeks of intensive work.

**Phases 1-5 (~15-19 days)** delivers the core Theme/Ancestry system — this is the "minimum viable" delivery that shows meaningful value.

**Phases 6-9 (~20-25 days)** delivers the full progression overhaul.

## Cross-cutting concerns

**Testing strategy:**
- Each phase includes writing new tests *before* the phase ends
- Full test suite run at each phase boundary (`node tests/integration.test.js`, etc.)
- Client build verified (`cd client && npx vite build`)
- Results logged in `TEST_RESULTS.md`

**Data migration concerns:**
- Existing characters need a Background → Theme mapping (automatic at first character load after the migration)
- Existing companions need Ancestry Feats auto-populated based on their personality
- Existing campaigns remain playable; gradual adoption of new system

**Documentation:**
- CHANGELOG updated at each phase boundary
- CLAUDE.md updated as major integrations land

## Open questions before we start

1. **Start with Phase 1 (database) or Phase 2 (character creation)?** Phase 1 is invisible to the player but necessary. Phase 2 gives immediate visible value but requires some Phase 1 work anyway.
2. **Big-bang migration or gradual rollout?** Do we force all existing characters to their mapped Themes at once, or let players opt in? Gradual is safer but fragments the codebase longer.
3. **Keep the old Background fields in the character creator UI as a "legacy" option?** Probably not — the Theme is meant to replace Background, so the UI should reflect that cleanly.
4. **Default Theme path choices for existing characters?** An Outlander needs a biome picked at L1 — for existing Outlander-equivalent characters, do we auto-pick based on their backstory, or prompt them?

## Recommendation

**Start with Phase 1.** It's foundational, it's the least risky (no UI changes), and it de-risks every later phase. We do it cleanly:
- All migrations written and tested
- All design-doc content paste-and-adapted into seed data
- Data model verified by integration tests
- No UI changes visible to players yet

Once Phase 1 lands, we can tackle Phase 2 with confidence that the data layer is sound.

If you approve this plan, I'll start on Phase 1.