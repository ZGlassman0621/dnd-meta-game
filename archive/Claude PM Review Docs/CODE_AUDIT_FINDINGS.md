# Code-Side Audit: Reality vs Review Assumptions

**Date:** 2026-04-28
**Branch:** `main` @ `4d52764` (v1.0.102)
**Scope:** Static code reading. Read-only. No fixes proposed.

Severity tags used where useful: 🔴 real bug, 🟡 doc-vs-code drift, 🟢 heads-up.

---

## Block 1 — Per-System Implementation Reality

### 1. Ancestry Feats

**Shipped:**
- 13 lists × 5 tiers × 3 choices = **195 feats** in [server/data/ancestryFeats.js](../server/data/ancestryFeats.js) (dwarf, elf, drow, human, halfling, dragonborn, half_elf, half_orc, tiefling, aasimar_protector, aasimar_scourge, aasimar_fallen, warforged).
- Schema: migration 024 (`character_ancestry_feats`, `companion_ancestry_feats`, plus catalog `ancestry_feats`).
- Companion auto-pick **does fire in code** — [progressionCompanionService.js:130-170](../server/services/progressionCompanionService.js#L130) (recruit-time L1) and `:235-260` (level-up tier crossings). Selection is currently random by personality-shaped weighting via the JOIN to ancestry list, not personality-LLM-aware.
- Player picks: wired via [LevelUpPage.jsx](../client/src/components/LevelUpPage.jsx).
- DM prompt injection: confirmed at [dmPromptBuilder.js:677](../server/services/dmPromptBuilder.js#L677) and `:1153`.

**Partial:**
- 🟡 **L13 cross-pick "Path Less Walked" is documented but absent in code.** [ANCESTRY_FEATS.md](../ANCESTRY_FEATS.md) line 26 declares 5×3 + 1 cross-pick = 16 feats per list × 13 = **208 total**; code has 195 (no cross-pick). This is the actual count drift.
- 🟡 Companion auto-pick is *firing* but is mechanical (DB pick), not personality-LLM-aware as the design implies. Whether that meets the design intent is a judgment call.

**Documented but absent:**
- 🟡 Aasimar Fallen "Path's Choice" L13 commitment has **no storage column or service** — searched and not found. The redesign-deferred doc moves this to "race quests"; the live system documents it but doesn't persist it.
- 🟡 Drow "Lolth standing" tracker — **no storage**. Persistence is documented in [AI_NARRATIVE_PERSISTENCE.md](../AI_NARRATIVE_PERSISTENCE.md) but no scalar/table exists.
- 🟡 Drow "House Heritage" recognition — no NPC-recognition trigger logic.
- 🟡 Human "Quick Study" 24-hour temporary proficiency — no time-bounded persistence (depends on Pattern D infra that's session-scoped).

**Status header verdict:** [ANCESTRY_FEATS.md](../ANCESTRY_FEATS.md) line 3 currently reads **"All 13 lists complete. Balance pass applied. Pending: cross-system integration check, AI memory architecture decisions, implementation."** — both halves of the "In review vs All Lists Designed" contradiction the review flagged are partially accurate against code. Lists ARE complete and wired; cross-system integration (Lolth tracker, Path's Choice, Quick Study time logic) is NOT.

---

### 2. Keeper (Custom Class)

**Shipped:**
- Migration 020 creates Keeper schema.
- Class wired into `CLASS_FEATURES`, `SUBCLASS_LEVELS`, etc.
- Texts catalog: 596-line [client/src/data/keeperTexts.js](../client/src/data/keeperTexts.js) with `RECITATIONS`, `STANDARD_TEXTS`, `RARE_TEXTS`, `SUBCLASS_TEXTS` (4 subclasses × 3 texts = 12 subclass texts), `ALL_TEXTS`, `GENRE_DOMAINS` (8 entries: history / tactics / romance / poetry / mythology / political_science / natural_philosophy / forbidden_texts).

**Partial / bugs (🔴 confirms review):**
- 🔴 **`CASTER_TYPE: 'none'` is real in code** — [server/config/levelProgression.js:605](../server/config/levelProgression.js#L605). Multiclass spell-slot calc explicitly treats Keeper as non-caster despite full caster mechanics. Bug confirmed.
- 🔴 **8 Genre-bonus texts do NOT exist as content.** `GENRE_DOMAINS` (lines 531–596) only has `passive` / `masteryUpgrade` / `masteryCapstone` field text per Genre. There are no actual *Text* objects (with `weapon` / `weaponType` / `passage`) tagged as Genre bonuses. The "+1 bonus text per Genre Domain" the design names is unimplemented. Content gap confirmed.
- The 12 SUBCLASS_TEXTS are by Keeper subclass (Lorewarden / Mythslinger / Rhetorician / Versebinder), not by Genre. So Subclass bonus texts ✅ exist; Genre bonus texts ❌ don't.

**Documented but absent:**
- L5 Eidetic Memory — no encountered-texts log infrastructure.
- L14 Unwritten Knowledge — no "notable enemies / lore sites" structured log.

---

### 3. Downtime

**Shipped:**
- Migration 027 creates `downtime_periods`, `downtime_activities`, `downtime_vignettes`.
- [server/routes/downtime.js](../server/routes/downtime.js) (~1700 lines) with endpoints `/available`, `/work-options`, `/status`, `/start`, `/complete`, `/cancel`, `/history`. Wired in [server/index.js:83](../server/index.js#L83).
- [client/src/components/Downtime.jsx](../client/src/components/Downtime.jsx) (~32 KB) exists and is reachable.

**Partial:**
- 🟡 Activity catalog is **shallow generic stubs** (rest, pray, train, study, craft, work, socialize, carouse, maintain, faction, intel, base, project, recruit, network) — name + description + icon + maxHours + simple benefits. No structured sub-activities.
- No dedicated `downtimeService.js` (route handles logic inline).

**Documented but absent (vs DOWNTIME_DESIGN.md):**
- ❌ "Train Team Tactic" activity (gates Party Synergies Tier 3 — explicit cross-system blocker).
- ❌ "Mentor's Imprint" cumulative deepening.
- ❌ Folk Hero "Legend territory" downtime activity.
- ❌ Numeric balance pass on the 30+ designed activities.
- ❌ Companion personality-driven request generation ("I'd like to visit my family in Neverwinter").
- ❌ Reflection / vignette-narration AI integration.

**Verdict:** v3 schema present, v3 activity catalog NOT present. It's "v2-ish in disrepair plus v3 schema scaffolding" — not v2 nor v3, but a partial v2 with the v3 tables empty.

---

### 4. LLM Setup

**Shipped (v1.0.102 fixes confirmed):**
- Tagged-error pattern in [server/services/claude.js:328-381](../server/services/claude.js#L328): `AUTH_FAILURE:` / `RATE_LIMITED:` / `OVERLOADED:` tagging at 401/403/429/529.
- `checkClaudeStatus()` at [claude.js:192-260](../server/services/claude.js#L192) — real probe via count_tokens, returns `auth_failure` / `rate_limited` / `transient` / `unreachable`.
- `checkOllamaStatus()` at [llmClient.js:31-70](../server/services/llmClient.js#L31) — real probe via `/api/tags`, returns `unreachable` / `no_model`. Confirms `OLLAMA_MODEL` is in installed list.
- /message handles all three tags: [dmSession.js:2204, 2211, 2218](../server/routes/dmSession.js#L2204).

**Coverage gap (confirmed):**
- 🟡 `/start` (DM session start) at [dmSession.js:1045-1052](../server/routes/dmSession.js#L1045) — generic `handleServerError`, no tag handling.
- 🟡 `/restart` and DM Mode routes ([dmMode.js](../server/routes/dmMode.js)) — zero tag handling. Grep confirmed.
- 🟡 Generator services ([campaignPlanService.js](../server/services/campaignPlanService.js), [livingWorldGenerator.js](../server/services/livingWorldGenerator.js), [partyGeneratorService.js](../server/services/partyGeneratorService.js), [npcMailService.js](../server/services/npcMailService.js), [companionBackstoryGenerator.js](../server/services/companionBackstoryGenerator.js), [preludeArcService.js](../server/services/preludeArcService.js), [locationGenerator.js](../server/services/locationGenerator.js), [adventureGenerator.js](../server/services/adventureGenerator.js), [questGenerator.js](../server/services/questGenerator.js), [dmCoachingService.js](../server/services/dmCoachingService.js), [backstoryParserService.js](../server/services/backstoryParserService.js)) — all call `claude.chat()` (which can throw tagged errors) but their callers don't handle the tags. Players hitting auth/rate failures during world-gen would see raw errors.
- 🟡 [server/routes/prelude.js:235](../server/routes/prelude.js#L235) handles **OVERLOADED only**, not AUTH_FAILURE or RATE_LIMITED.

---

### 5. Prelude

**Shipped:**
- 5-session structure (Ch1 OBSERVE, Ch2 LEARN, Ch3 DECIDE × 2, Ch4 COMMIT) per CLAUDE.md design.
- Migrations 022, 042, 043, 044, 045 — `prelude_sessions`, `prelude_emergences`, `prelude_values`, `prelude_canon_facts`, `prelude_canon_npcs`, `prelude_canon_locations`, `prelude_arc_plans`, `prelude_committed_theme`, `arc_plan_tone_reflection`.
- `creation_phase` enum on characters: **`'prelude'` and `'active'`** (CLAUDE.md mention of `'ready_for_primary'` is ASPIRATIONAL — see drift below).
- Round 3 reframe **IS implemented in arc-plan generator**: [preludeArcService.js:140-148](../server/services/preludeArcService.js#L140) — "FINAL departure is decided at Ch3 wrap-up by theme-commitment ceremony"; departure_seed emits 3-4 plausible departure shapes for committed theme to pick from.
- Theme commitment ceremony at Ch3 wrap-up: [preludeService.js](../server/services/preludeService.js) + `POST /api/prelude/:id/commit-theme` writes `characters.prelude_committed_theme` (migration 044). [PreludeThemeCommitCard.jsx](../client/src/components/PreludeThemeCommitCard.jsx) renders it.
- 16 tone tags + per-life-stage NPC speech patterns + 4 time-compression techniques + Cardinal Rules — all in [preludeArcPromptBuilder.js](../server/services/preludeArcPromptBuilder.js) (~108 KB).
- Marker detection ([preludeMarkerDetection.js](../server/services/preludeMarkerDetection.js)) covers: AGE_ADVANCE, HP_CHANGE, CHAPTER_END, CHAPTER_PROMISE, SESSION_END_CLIFFHANGER, the 6 emergence markers, CANON_FACT, CANON_FACT_RETIRE.

**Documented but absent (Phase 5 confirmed unbuilt):**
- ❌ **No `ready_for_primary` creation_phase value exists in code.** [preludeService.js:13](../server/services/preludeService.js#L13) docstring says: *"the emerged state and flips creation_phase to 'active'"*. There is no intermediate state. **CLAUDE.md is wrong** — its claim that `creation_phase ∈ {'prelude', 'ready_for_primary', 'active'}` doesn't match code.
- ❌ Grep for `ready_for_primary`, `prelude_complete`, `transitionToPrimary`, `complete_prelude` returns **zero hits** outside docstring/comments.
- ❌ Remembered-voice backstory generation (Round 2 rule #20) — no service generates the post-prelude 3-5 paragraph adult-looking-back backstory.
- ❌ Values paragraph generation (Round 2 rule #21) — no service generates "You have become someone who…"
- ❌ Mentor imprint seeding (Round 2 rule #23) — no `mentor_imprints` table in any migration; no code links prelude mentor → primary campaign.
- ❌ Primary campaign generator does not consume `prelude_canon_*` tables — [campaignPlanService.js](../server/services/campaignPlanService.js) does not import from prelude tables.
- ❌ `[CANON_FACT_PROMOTE]` marker (Round 3 transient-canon flag) — no `transient` boolean on prelude canon tables; no marker handler.
- ❌ Prelude-tuned rolling summary — confirmed branched in [rollingSummaryService.js](../server/services/rollingSummaryService.js) per CLAUDE.md, ✅ this one exists.

**🔴 What happens today if a player completes the prelude?** No transition path exists in code. They reach a terminal state with `creation_phase='prelude'` and no documented "flip to active." The flip is referenced in a docstring but the service that does it is absent. Player is effectively stuck at prelude end. (This is the most concrete real bug surfaced in this audit.)

---

### 6. Companions

**Shipped:**
- All infrastructure documented in CLAUDE.md confirmed: 5e mirror parity, conditions, death saves, mood, loyalty, secrets, threads, activities, status states, fill-not-overwrite enrichment.
- Migrations 028–032: companion progression, rest, combat safety, multiclass, party inventory.
- Companion theme + ancestry-feat auto-pick wired ([progressionCompanionService.js](../server/services/progressionCompanionService.js)).

**🔴 Player-mode inter-companion relationships: ABSENT.**
- No `companion_relationships` / `inter_companion_*` table in any migration.
- No service tracks companion-to-companion warmth/trust.
- DM Mode pattern is `dm_mode_parties.party_data.party_relationships` (JSON column, not a table) — works there but is not ported to player mode.
- This matches the review's reclassification ("deferred upgrade → required for BioWare benchmark").

**DM Mode `party_relationships` pattern (referenced as the porting source):**
- ✅ Confirmed at [dmModeChronicleService.js:295-303](../server/services/dmModeChronicleService.js#L295) (read), `:347-380` (BOND_SHIFT application with warmth/trust deltas clamped to ±2), and [dmModePromptBuilder.js:322-338](../server/services/dmModePromptBuilder.js#L322) (next-session injection).

**Other companion-system gaps:**
- 🟡 `[RECIPE_GIFT]` marker exists in dmSessionService but author-frequency is data-only (no prompt-instructed cadence).
- 🟡 Dismissed-companion return triggers — code path TBD, no clear region-match service.
- 🟡 Wound representation — confirmed no `core_wound` field on `companion_backstories`.

---

### 7. Mythic

**Review claim:** "Framework-only. Zero gameplay implementation."
**Code reality:** ⚠️ More built than the review suggested. Framework + content + active marker pipeline exist. *Gameplay validation* (i.e., real playtest) is what's missing — and that's true.

**Shipped:**
- Migration 010 creates: `mythic_characters`, `mythic_trials`, `mythic_abilities`, `character_piety`, `character_epic_boons`, `legendary_items`, `piety_history`.
- [mythicService.js](../server/services/mythicService.js) (~558 lines): `getMythicStatus`, `initializeMythic`, `selectMythicPath`, `advanceTier`, `recordTrial`, `grantAbility`, `useMythicPower`, `checkShadowConstraints`, `getLegendaryItems`, `selectEpicBoon`, `advanceItemState`. All real, not stubs.
- [pietyService.js](../server/services/pietyService.js) (~182 lines): `getCharacterPiety`, `adjustPiety`, `checkNewThreshold`, `getPietyHistory`.
- [server/config/mythicProgression.js](../server/config/mythicProgression.js): `MYTHIC_TIERS`, `BASE_MYTHIC_ABILITIES`, `MYTHIC_PATHS` (12 player + 2 DM-only). Hierophant fully fleshed; rest sketchier (matches review).
- [server/routes/mythic.js](../server/routes/mythic.js) (~480 lines, 16 endpoints), wired at [server/index.js:102](../server/index.js#L102).
- 7-tab [client/src/components/MythicProgressionPage.jsx](../client/src/components/MythicProgressionPage.jsx) (~63 KB).
- Markers detected/processed: `[MYTHIC_TRIAL]` ([dmSessionService.js:653](../server/services/dmSessionService.js#L653)), `[PIETY_CHANGE]` (`:674`), `[ITEM_AWAKEN]` (`:698`), `[MYTHIC_SURGE]` (`:719`).
- DM prompt injection: [dmPromptBuilder.js:2426-2453](../server/services/dmPromptBuilder.js#L2426) — Mythic Tier, Path, Power Remaining, Surge die, Shadow constraint.

**Partial:**
- 🟡 12 paths exist in config; only Hierophant has full content. Others sketched (matches review's design-side flag).
- 🟡 No companion-mythic interactions code; companion mythic NOT yet built (Open Question #5 in design).
- 🟡 Tier 5 broken-mechanics (Lich Final Equation, Trickster Narrative Authority) — design problem, not code-side.

**Verdict:** Reframe the review's "framework-only" claim. The framework AND content AND wired markers AND prompt injection AND UI all exist. What doesn't exist is: most paths' detailed content, companion mythic, fixed Tier 5 / Legend math, and any real playtest. Closer to "framework + Hierophant + scaffolding for the rest" than "framework only."

---

### 8. Party Synergies

**Shipped:**
- Migration 025 creates `team_tactics`, `character_team_tactics`, `subclass_theme_synergies`, `mythic_theme_amplifications`.
- [server/data/teamTactics.js](../server/data/teamTactics.js) — 20 tactics seeded.
- [server/data/subclassThemeSynergies.js](../server/data/subclassThemeSynergies.js) — ~50 pairings per CLAUDE.md.
- [server/data/mythicThemeAmplifications.js](../server/data/mythicThemeAmplifications.js) — 17 per CLAUDE.md.
- [server/config/partySynergy.js](../server/config/partySynergy.js) — `CLASS_ROLES`, `ACTIVITY_SYNERGIES` (downtime-side activity bonuses).

**🔴 AI integration ABSENT (review confirmed):**
- 🟡 Subclass × Theme synergy injection IS in [dmPromptBuilder.js:1178-1185](../server/services/dmPromptBuilder.js#L1178) (character-level resonance only).
- 🟡 Mythic × Theme injection at `:1187-1213`.
- ❌ **Zero "synergy" / "team tactic" / "team_tactic" / "Tier 1" / "Tier 2" / "Tier 3" guidance in dmPromptBuilder.js for *party-level* synergies.** The 35 Signature Synergies + 20 Team Tactics + 10 Gear Synergies + Generative system are completely invisible to the AI today.
- ❌ [server/config/partySynergy.js](../server/config/partySynergy.js) is imported nowhere in `server/services/`. It exists but nothing reads it.

**Documented but absent:**
- ❌ Companion engagement-likelihood layer (Next Phase #5). No `engagement_likelihood` field on companions. No personality-aware "decline to engage" logic.
- ❌ Field-observed Team Tactic mastery tracking. No `tactic_mastery` / `observed_count` / `team_tactic_observation`. `character_team_tactics` tracks `learned_at_game_day` only.
- ❌ Active synergy UI display (Next Phase #4) — no client component.
- ❌ "Train Team Tactic" downtime activity (gated on Downtime — Tier 3 cannot ship until Downtime ships).

---

### 9. Themes

**Shipped:**
- 21 themes × 4 tiers = **84 abilities, all full content with mechanics + flavor**, [server/data/themes.js](../server/data/themes.js) (400 lines). Spot-checked Soldier, Sage, Folk Hero, Urchin, Acolyte — all real content, no shells.
- Migration 023 creates schema; [progressionSeedService.js:20-49](../server/services/progressionSeedService.js#L20) seeds idempotently.
- Theme tier auto-unlock at L5/L11/L17 wired via `character_theme_unlocks` ([progressionService.js:46-54](../server/services/progressionService.js#L46)).
- Companion theme auto-pick: [progressionCompanionService.js:92-124](../server/services/progressionCompanionService.js#L92).
- DM prompt injects active theme abilities: [dmPromptBuilder.js:1178-1218](../server/services/dmPromptBuilder.js#L1178).
- Knight 6-path moral state via `knight_moral_paths` table (per CLAUDE.md).
- LevelUpPage.jsx renders theme tier UI ([LevelUpPage.jsx:1332-1364](../client/src/components/LevelUpPage.jsx#L1332)).

**Partial:**
- 🟡 **No explicit AI-trigger specs per Theme ability.** Folk Hero L11 fame recognition, Urchin L11 street-children network, Sage L5 lore consultation, Acolyte L5 emotional read, Far Traveler L11 "notice one thing out of place" — all *content* present, but the prompt doesn't tell the AI *when* to fire each. Relies on AI judgment from the ability text alone. This is the load-bearing risk the review flagged.

---

### 10. DM Mode

**Shipped:**
- Migration 016 + 017 + 018 create: `dm_mode_parties` (with `party_data` + `party_dynamics` JSON blobs), `dm_sessions` (extended), `dm_mode_chronicles`, `dm_mode_npcs`, `dm_mode_plot_threads`, `dm_mode_prep`.
- 4-character party generation via Opus ([partyGeneratorService.js](../server/services/partyGeneratorService.js)).
- BOND_SHIFT marker fully wired: detected at [dmModeService.js:116-134](../server/services/dmModeService.js#L116), persisted at [dmModeChronicleService.js:347-380](../server/services/dmModeChronicleService.js#L347), injected at [dmModePromptBuilder.js:322-338](../server/services/dmModePromptBuilder.js#L322).
- Other DM-Mode markers detected/processed: SKILL_CHECK, ATTACK, CAST_SPELL.
- Chronicles (Sonnet-extracted) sync NPCs and plot threads.
- ABSOLUTE RULES + FINAL REMINDER + RIGHT-vs-WRONG examples confirmed in [dmModePromptBuilder.js:367-421](../server/services/dmModePromptBuilder.js#L367) and `:560-585`.
- 97 + 17 integration tests (per review; not re-counted).

**Confirmed gaps:**
- 🔴 **`[PARTY_ARGUMENT]` is reserved but unprocessed.** Sole occurrence: [dmModeService.js:145](../server/services/dmModeService.js#L145) — a strip regex. No detector, no service handler. The review is correct.
- 🟡 Post-session relationship summary view: backend extraction ✅ exists, dedicated UI summary ❌ does not. [DMMode.jsx:1685](../client/src/components/DMMode.jsx#L1685) has manual relationship editing only — `handleRelationshipUpdate`, no auto-summary panel.
- 🟡 Cross-party memory: no NPC-portability mechanism between parties.
- 🟡 Opus toggle for DM Mode continuations not implemented (Sonnet-default per CLAUDE.md model split).

---

## Block 2 — AI Narrative Persistence Pattern Audit

### Pattern A — Standing/relationship tracking
**Status:** Multiple parallel implementations, same shape, no unified mechanism.

| Locus | Storage | Scale |
|---|---|---|
| Companion loyalty | `companion_backstories.loyalty` (0–100) + label | 1 per companion |
| Faction standing | `faction_standings` table | per-faction |
| NPC disposition | per-conversation in `npc_conversations` + lifecycle audit | ad hoc, conversation-based |
| Mythic piety | `character_piety` table + `piety_history` | per-deity (53 max) |
| DM Mode bond-shifts | `dm_mode_parties.party_data` JSON `party_relationships` | per directional pair |
| Drow Lolth standing | ❌ no storage | — |

Every implementation is "scalar + optional label/audit trail." None share an abstraction. Lolth standing has zero footprint. Disposition recovery dynamics differ across systems (companion mood decays 1 per 2 days; faction standing has its own decay; Mythic piety thresholds at 3/10/25/50; NPC disposition aging is graduated absence-based).

### Pattern B — Permanent narrative commitments
| Commitment | Persisted? | Prompt-injected? |
|---|---|---|
| Theme | ✅ `character_themes.theme_id` | ✅ via dmPromptBuilder |
| Prelude committed theme | ✅ `characters.prelude_committed_theme` (migration 044) | ⚠️ used at Ch4 only |
| Mythic path | ✅ `mythic_characters.mythic_path` | ✅ at [dmPromptBuilder.js:2426+](../server/services/dmPromptBuilder.js#L2426) |
| Subclass | ✅ `characters.subclass` | ✅ |
| Knight moral path | ✅ `knight_moral_paths` table | ✅ per CLAUDE.md |
| Keeper Genre Domain | ⚠️ stored via `character_themes.path_choice` | ⚠️ Genre flavor consistency NOT explicitly enforced in prompt |
| Aasimar Path's Choice | ❌ no storage | — |
| Aasimar Scourge "arc" gating | ❌ no storage | — |

Stored-and-silent items: Knight moral path is stored and consulted in DM directives ✅ (per CLAUDE.md). Genre Domain is stored but no prompt-engineering instructs the AI to honor flavor consistency across uses. Aasimar Path's Choice doesn't exist at all.

### Pattern C — NPC recognition / re-meeting
**Infrastructure exists. Trigger logic minimal.**
- `canon_facts` table (migration 003) is queryable by category/subject. `getRelevantContext()` injects priority-ordered facts into the prompt.
- NPC identity: `npcs` table + `npc_lifecycle_history`. NPC re-encounter relies on the AI pattern-matching the canon facts present in the prompt — there's no explicit `[FIRST_ENCOUNTER]` vs `[REUNION]` signal.
- ❌ Folk Hero geographic fame: zero footprint.
- ❌ Urchin street children network: zero footprint.
- ❌ Keeper libraries-as-places: piggybacks on generic location persistence; no Keeper-specific revisit boon.
- Dismissed-companion return triggers: companion `status='dismissed'` exists but no region-match service surfaces returning beats.

### Pattern D — Time-bounded state
- Game-time clock: ✅ reliable. `characters.game_day` / `game_hour` / `game_year`.
- Mood decay: ✅ implemented at [companionBackstoryService.js:460-489](../server/services/companionBackstoryService.js#L460) — `floor(daysElapsed / 2)`, resets to `content` at zero.
- Survival/exposure timers: weather + survival services use game-day.
- Status-effect timers in combat: session-scoped per [ConditionPanel.jsx](../client/src/components/ConditionPanel.jsx); not designed to persist.
- Quick Study 24-hour proficiency: ❌ no infrastructure. Would need new schema.
- Per-arc abilities (Aasimar Scourge Final Judgment): ❌ "arc" not defined in code.
- Overdue promise auto-break (45 days, warning at 21): ✅ per CLAUDE.md, in narrativeQueue/promise system.

### Pattern E — Player-DM negotiation moments
**Minimal — no general-purpose "AI ruling logged" mechanism.**
- `canon_facts` is the closest thing — AI can emit `[CANON_FACT]` markers and the entry is queryable thereafter. But no marker is "this was an AI judgment call."
- `mythic_trials` table records trials with outcome enum. Decent for Mythic; not generalized.
- Aasimar Scourge "good-aligned" gating: no recording. Keeper Unwritten Knowledge negotiation: no recording. Generic AI judgments are resolved per-turn and forgotten.

### Pattern F — Long-term campaign history as mechanical resource
- Chronicles + canon_facts are queryable — but in practice are *injection-only* (loaded into the prompt context window). `searchFacts()` exists at [storyChronicleService.js:668](../server/services/storyChronicleService.js#L668) but its only callers are admin/debug paths, not class features.
- Defeated enemies: present in `story_chronicles.npcs_involved` but not flagged or queryable as a structured "defeated_log."
- Discovered locations: in `locations`, but no "first_visited" timestamp or class-feature query API.
- Encountered texts: ❌ no infrastructure (Keeper L5/L14 spec depends on this).
- Legendary items: ✅ `legendary_items` table with state machine (Dormant → Awakened → Exalted → Mythic) at [migration 010:100-119](../server/migrations/010_mythic_progression.js#L100). Good model for the pattern.
- Sage L5 lore consistency: relies on AI pattern-matching canon facts already in prompt; no Sage-specific query.

**Net:** History is *write-only narrative log* in practice, despite the chronicle infrastructure being technically queryable. Pattern F is not currently consumed mechanically (Mythic legendary items are the one exception).

### AI behavior pattern 1 — Ambient pattern matching ("trigger, not activate")
Five reviewed systems × five different implementations. **Not unified.**
| System | Where | Mechanism |
|---|---|---|
| Companions threads | [companionTriggerChecker.js:46-73](../server/services/companionTriggerChecker.js#L46) | Event-handler registry + per-thread `checkTriggerMatch()` regex |
| Prelude emergences | [preludeMarkerDetection.js](../server/services/preludeMarkerDetection.js) | Marker regex extraction, server tally caps |
| Party Synergies eligibility | nowhere | not implemented |
| Themes proactive surfacing | implicit | relies on AI reading ability text in prompt |
| DM Mode bond shifts | [dmModeService.js:116-134](../server/services/dmModeService.js#L116) | Marker regex extraction |

Two legit implementations (companion threads, prelude markers + DM Mode markers — markers are arguably one shape). One implicit (themes), one absent (synergies). Reliability: untested at scale, no shared trigger library, no consistency between which system uses event-bus vs marker vs implicit prompt reliance.

### AI behavior pattern 2 — Proactive-action vs shelter-behavior counter-mechanisms
**Confirmed: DM Mode is the model.**
- DM Mode prompt: [dmModePromptBuilder.js:367-421](../server/services/dmModePromptBuilder.js#L367) ABSOLUTE RULES (8 mandatory caps); `:535-547` RELATIONSHIP TRACKING with explicit BOND_SHIFT format; `:560-585` FINAL REMINDER 10-point checklist. Right-vs-Wrong examples present (skill-check correct/wrong, voice correct/wrong).
- Player Mode prompt: [dmPromptBuilder.js](../server/services/dmPromptBuilder.js) has primacy/recency ABSOLUTE RULES + FINAL REMINDER per CLAUDE.md. Less explicit RIGHT-vs-WRONG examples than DM Mode (verified via grep — no example pattern that matches DM Mode's structure).
- Prelude prompt: [preludeArcPromptBuilder.js](../server/services/preludeArcPromptBuilder.js) (~108 KB) has Cardinal Rules. Per the review: rules exist but "are not load-bearing in practice" against the AI's training-data prior on "child protagonist = lighter content." No RIGHT-vs-WRONG examples in the same shape as DM Mode.
- Companions prompts: companions don't have a dedicated prompt builder — they're injected as data into the DM prompt. No companion-specific counter-mechanisms.

---

## Block 3 — Systems Not Reviewed That Deserve a Look

Items below were not the subject of any of the ten review docs. One-line take per item.

**Needs review pass before to-do sequencing:**
- 🟡 **Living World tick pipeline** — [livingWorldService.js](../server/services/livingWorldService.js) (990 lines) + [livingWorldGenerator.js](../server/services/livingWorldGenerator.js) + [worldEventService.js](../server/services/worldEventService.js). Orchestrates 13+ subsystems (weather, factions, events, conflict quests, companions, NPC mail, consequences, survival, base income, base threats, notoriety, custom-order delivery). Single load-bearing pipeline; bugs here cascade.
- 🟡 **Merchant economy bundle** — [merchantService.js](../server/services/merchantService.js), [merchantOrderService.js](../server/services/merchantOrderService.js), [merchantRelationshipService.js](../server/services/merchantRelationshipService.js), [bargainingService.js](../server/services/bargainingService.js), [economyService.js](../server/services/economyService.js) + [server/config/economyConfig.js](../server/config/economyConfig.js). Persistent merchant inventories, commissions, bargaining. Not reviewed; cross-cutting with notoriety, faction, and disposition systems.
- 🟡 **Party Bases / Fortresses** — [partyBaseService.js](../server/services/partyBaseService.js) (751 lines) + [baseThreatService.js](../server/services/baseThreatService.js) (595 lines) + [longTermProjectService.js](../server/services/longTermProjectService.js). 13 subtypes, 20 building types, garrison + officers, threat state machine, 14-day recapture window. Substantial system, no review.
- 🟡 **NPC lifecycle ecosystem** — [npcAgingService.js](../server/services/npcAgingService.js), [npcMailService.js](../server/services/npcMailService.js), [npcLifecycleService.js](../server/services/npcLifecycleService.js), [npcVoiceService.js](../server/services/npcVoiceService.js), [npcRelationshipService.js](../server/services/npcRelationshipService.js), [worldEventNpcService.js](../server/services/worldEventNpcService.js). Death cascades, mail candidate scoring, voice palette, aging absence. Touched by Companions review but not given a full pass.
- 🟡 **Notoriety/heat** — [notorietyService.js](../server/services/notorietyService.js). 5 categories, 0–100 scoring, decay 1–2/day, threshold entanglement checks. Not reviewed.
- 🟡 **Quest ecosystem** — [questService.js](../server/services/questService.js), [questGenerator.js](../server/services/questGenerator.js), [questProgressChecker.js](../server/services/questProgressChecker.js). Milestone-based faction-driven spawning, conflict quests, consequence integration. Touched indirectly via Companions/Downtime; not a full review.

**Likely stable; review pass optional:**
- 🟢 **Crafting** — [craftingService.js](../server/services/craftingService.js) (1011 lines), 112 recipes. Mostly self-contained mechanics.
- 🟢 **Weather + Survival** — [weatherService.js](../server/services/weatherService.js) (637 lines) + [survivalService.js](../server/services/survivalService.js) (720 lines). Per CLAUDE.md spec aligned.
- 🟢 **Faction politics** — [factionService.js](../server/services/factionService.js) (707 lines). Stored in `faction_standings`. AI consumption pathway unverified but mechanism is canonical.
- 🟢 **Travel** — [travelService.js](../server/services/travelService.js) (571 lines). Self-contained.
- 🟢 **Achievements** — [achievementService.js](../server/services/achievementService.js) + [achievementChecker.js](../server/services/achievementChecker.js). Declarative.
- 🟢 **Adventure generation** — [adventureGenerator.js](../server/services/adventureGenerator.js). Side flow (`AdventureManager.jsx` UI).
- 🟢 **Authentication** — [authService.js](../server/services/authService.js) + JWT middleware. Standard.
- 🟢 **Backstory parser** — [backstoryParserService.js](../server/services/backstoryParserService.js). Input pipeline.
- 🟢 **Tone presets** — [server/data/tonePresets.js](../server/data/tonePresets.js). Static data.
- 🟢 **Marker schemas / rule verifiers** — [markerSchemas.js](../server/services/markerSchemas.js), [ruleVerifiers.js](../server/services/ruleVerifiers.js). Validation utility.
- 🟢 **Rolling summary compaction** — [rollingSummaryService.js](../server/services/rollingSummaryService.js). Now branches by session_type ('prelude_arc' vs main); per-session summary.
- 🟢 **Campaign management** — [campaignService.js](../server/services/campaignService.js) + [campaignImportService.js](../server/services/campaignImportService.js).

**In-flight / scope-uncertain:**
- 🟡 **Repetition ledger** — [repetitionLedgerService.js](../server/services/repetitionLedgerService.js). Likely the prose-quality detection layer (related to the closed v1.0.101 thread). Confirm scope before sequencing.
- 🟡 **Story threads** — [storyThreads.js](../server/services/storyThreads.js) + [server/routes/storyThreads.js](../server/routes/storyThreads.js). Distinct from companion `unresolved_threads`; what's its role? Worth a short pass.
- 🟡 **Achievement checker** uses a checker pattern that may be a model worth replicating elsewhere — incidental observation.
- 🟡 **Nickname service** — [nicknameService.js](../server/services/nicknameService.js) + migration 039. Small; likely stable.
- 🟡 **Narrative integration / narrative queue** — [narrativeIntegration.js](../server/services/narrativeIntegration.js), [narrativeQueueService.js](../server/services/narrativeQueueService.js), [narrativeSystemsInit.js](../server/services/narrativeSystemsInit.js). Cross-cutting; touched by every review tangentially but not given its own review.
- 🟡 **Adventure history** — [AdventureHistory.jsx](../client/src/components/AdventureHistory.jsx) + [adventure.js routes](../server/routes/adventure.js). Secondary UI; review status unclear.

---

## Block 4 — What PM Should Know Before Sequencing

### Drift between docs and code

- 🟡 **CLAUDE.md `creation_phase` enum is wrong.** It says `'prelude' | 'ready_for_primary' | 'active'`. Code only has `'prelude'` and `'active'`. There's no intermediate phase, and no transition service to flip prelude → active. This is the single concrete bug in this audit.
- 🟡 **CLAUDE.md says "195 ancestry feats."** [ANCESTRY_FEATS.md](../ANCESTRY_FEATS.md) line 26 says **208** (with the 13 cross-pick "Path Less Walked" feats). Code matches CLAUDE.md (195). The cross-pick is documented but not in code.
- 🟡 **CLAUDE.md says `livingWorldService.js` includes "custom-order delivery"** in the tick. Confirmed — but the merchant order pipeline ([merchantOrderService.js](../server/services/merchantOrderService.js)) wasn't reviewed in any of the ten review docs. Treat as unreviewed even though the tick is canonically described.
- 🟡 **DOWNTIME_DESIGN.md describes a v3 activity catalog that the route layer doesn't have.** The schema exists; the v3 activities don't.
- 🟡 **PRELUDE_IMPLEMENTATION_PLAN.md rule #23** says "Prelude mentor seeds primary campaign mentor_imprints table." There is no `mentor_imprints` table in any migration. This is design-only.

### Load-bearing tech debt

- 🔴 **Prelude → primary campaign transition is a real bug, not a doc drift.** A player who finishes the prelude has no documented way out. The `'ready_for_primary'` phase referenced in CLAUDE.md doesn't exist; the flip-to-active service doesn't exist; primary campaign generator doesn't consume prelude canon. PM should treat this as a routing-level bug to fix BEFORE shipping any new prelude work.
- 🟡 **No unified standing-tracker abstraction.** Companion loyalty, faction standing, mythic piety, DM Mode bond-shifts, NPC disposition all repeat the same shape with different schemas. If AI Narrative Persistence becomes engineering work, this is the cleanest cross-cutting refactor — collapse to one mechanism, save schema sprawl. Lolth standing, Aasimar arc gating, Folk Hero fame, Urchin network all become trivially addable once the abstraction lands. Without it, each is a new bespoke schema.
- 🟡 **Five parallel ambient-pattern-matching implementations.** Companion triggers (event-bus + regex), Prelude markers (regex extraction), DM Mode markers (regex extraction), Themes (implicit, prompt-only), Party Synergies (absent). The shared shape is "AI emits marker, server detects, effect applied." Worth deciding whether to standardize before adding the sixth (Pattern F class features that consume history).
- 🟡 **Generators don't catch tagged errors.** Eleven generator services ([campaignPlanService.js](../server/services/campaignPlanService.js), [livingWorldGenerator.js](../server/services/livingWorldGenerator.js), [partyGeneratorService.js](../server/services/partyGeneratorService.js), [npcMailService.js](../server/services/npcMailService.js), [companionBackstoryGenerator.js](../server/services/companionBackstoryGenerator.js), [preludeArcService.js](../server/services/preludeArcService.js), [locationGenerator.js](../server/services/locationGenerator.js), [adventureGenerator.js](../server/services/adventureGenerator.js), [questGenerator.js](../server/services/questGenerator.js), [dmCoachingService.js](../server/services/dmCoachingService.js), [backstoryParserService.js](../server/services/backstoryParserService.js)) call `claude.chat()` but don't surface AUTH_FAILURE / RATE_LIMITED tags to users. v1.0.102 fixed the dominant /message path; the rest is exposed.

### Cross-cutting refactors that would unblock multiple deferred items

1. **A unified "standing scalar" abstraction** unblocks: Pattern A unification, Drow Lolth, Aasimar arc gating, Folk Hero fame, Urchin network, faction-NPC standing parity.
2. **A unified marker → state pipeline** unblocks: Party Synergies AI integration, ambient-pattern-matching reliability across companion/prelude/DM Mode, future Pattern F class features (Keeper Eidetic, Sage lore queries).
3. **Inter-companion `party_relationships`, ported from DM Mode JSON to a player-mode table** unblocks: BioWare-tier companion banter, Companions-Party-Synergies engagement layer (synergy partner pairing memory), and the post-session relationship summary view (which DM Mode also wants).
4. **Mentor imprint table + prelude-to-primary handoff service** unblocks: Phase 5 Prelude work AND lineages-of-characters infra AND Mythic cross-campaign continuity (they share the cross-context-handoff shape).
5. **Time-bounded state primitives** (24-hour debt window, per-arc gate) unblocks: Quick Study, Tiefling 1-week debts, Aasimar Scourge per-arc Final Judgment, generic ability-with-game-day-expiry pattern.

### Things that surprised me

- **Mythic is more built than the review suggested.** Framework + content + markers + DM-prompt injection are all in place. What's missing is path-content depth (only Hierophant is full) and any real playtest. The "framework only" framing undersells the integration; the design-level concerns (Tier 5, Legend math, companion mythic) are the actual blockers.
- **DM Mode's `party_relationships` is a JSON column inside `dm_mode_parties.party_data`, not a dedicated table.** Important if you're planning to port it to player mode — the schema decision repeats for free if you don't catch it.
- **`partySynergy.js` config exists but is imported nowhere.** The downtime activity-synergy code in there is orphaned. Worth checking if it's also unused on the downtime side, or just unused in DM prompt-side.
- **The repetition ledger ([repetitionLedgerService.js](../server/services/repetitionLedgerService.js)) was not in any review.** Since prose-quality / repetition was the entire H7/H8 thread that closed at v1.0.101, an unreviewed standalone service for it is worth a quick check before writing it off.
- **Ancestry feats has 14 lists in CHARACTER terms (humans + drow + aasimar's 3 paths counted separately + warforged) but ANCESTRY_FEATS.md sometimes counts 13.** Numbering is internally inconsistent; not a bug, but PM should pick one count and stick with it.

---

## Summary table

| System | Reviewed claim | Code reality |
|---|---|---|
| Ancestry Feats | "All lists designed; companion auto-pick spec'd" | 195 of 208 feats; auto-pick **fires** but is mechanical-pick, not personality-LLM-aware. Lolth tracker, Path's Choice, Quick Study unbuilt. |
| Keeper | CASTER_TYPE bug; 8 Genre-bonus texts may not exist | Both confirmed: bug at [levelProgression.js:605](../server/config/levelProgression.js#L605); GENRE_DOMAINS exists but no bonus *Text* objects. |
| Downtime | "Fallen into disrepair" | v3 schema present, generic activity catalog only. Train-Team-Tactic / Mentor / Folk-Hero activities unbuilt. |
| LLM Setup | v1.0.102 fixes shipped, /message covered | Confirmed. Coverage gap at /start, /restart, DM Mode, 11 generator services, prelude/message (OVERLOADED only). |
| Prelude | Round 3 reframe deferred, Phase 5 unbuilt | Round 3 reframe **IS implemented** in arc generator. Phase 5 confirmed unbuilt — **🔴 finishing the prelude is a dead-end in code today**. |
| Companions | Inter-companion relationships deferred | Player-mode: absent. DM Mode pattern at `dm_mode_parties.party_data.party_relationships` JSON column. Wound representation unbuilt. |
| Mythic | "Framework-only" | Framework + content + markers + DM-prompt injection all wired. Hierophant full; other paths sketched. Companion mythic absent. |
| Party Synergies | AI integration unbuilt | Confirmed. Schema + data ✅; partySynergy.js imported nowhere; zero "synergy" guidance in DM prompt; engagement-likelihood absent; mastery tracking absent. |
| Themes | 84 shells; AI-trigger specs absent | 84 abilities are full content, not shells. Seeded, unlocked, injected. AI-trigger specs per ability absent — load-bearing risk. |
| DM Mode | [PARTY_ARGUMENT] reserved-but-unprocessed; relationship summary missing | Both confirmed. BOND_SHIFT pipeline fully wired. Manual relationship UI exists; auto-summary panel does not. |

**One real bug worth routing separately:** [PRELUDE Phase 5 transition gap](../server/services/preludeService.js#L13). If a player completes the prelude today, there's no service to flip them to active. Everything else is doc-vs-code drift or scope-not-built.
