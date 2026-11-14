# .md Files Audit — DnD Meta Game repo

**Date:** 2026-11-11
**Auditor:** Muse (PM subagent, read-only — nothing on the Mac was modified)
**Repo:** `/Users/zach/Documents/DnD Meta Game/` (Mac, branch `phase-4-hybrid-combat`)
**Judging record:** `~/workspace/dnd-app-review/current-build-state.md`, `~/workspace/dnd-app-review/pm-guide.md` (§5 MVP scope, §6 queue), MEMORY.md
**Method:** `files.search` (extension `md`, recursive) over the whole repo, then `files.read` on every in-scope file. Small files read in full; huge files (CHANGELOG 712 KB, DECISION_LOG 259 KB, PHASE_2_CREATOR_SPEC 236 KB, THEME_DESIGNS 141 KB, Lost Mine 261 KB) read head + targeted tails. No `docs/` folder exists in the repo; no .md files exist under `server/`, `client/`, or `scripts/`.

## Totals

- **62** .md files in scope (493 total in the repo; 431 in `node_modules`, excluded)
- **KEEP: 11** — still true and still needed
- **KEEP-DEFERRED: 16** — deferred post-MVP system, keep and revisit later
- **STALE: 35** — contradicts what was built, or describes a design already built past

## Verdicts

- **KEEP** — still true and still needed.
- **KEEP-DEFERRED** — discusses a system deferred past the MVP (prologue, full downtime, fortress/domain, Mythic, legacy, or anything pm-guide marks post-MVP). Keep it; revisit later.
- **STALE** — gives information that contradicts what was actually built, or describes a design we already built past. Evidence is named in each entry.

---

# Repo root (38 files)

## `README.md` — STALE

Project readme describing the old product: Claude Opus/Sonnet models, 284 spells, DM Mode co-equal with Player Mode, Mythic as a feature, Anthropic API key required. Contradicted on every count: DM model is gemma4:12b offline on the PC (decided 2026-11-10), spell catalog is 583, the product is the solo forever game, and Mythic is post-MVP. **Recommend: rewrite, don't delete** — a current README is still needed.

## `CLAUDE.md` — STALE (needs refresh, not deletion)

Agent instructions file, last modified Aug 2026, "mid-refactor" status: Opus gameplay models, known-failing integration.test.js claims, feature-flag posture (LIVING_WORLD_TICK off, PROGRESSION_AWARDS on with "Mythic tier auto-advance"). The handoff doc (`docs/pm/HANDOFF.md`) is now the operative builder instruction set, the DM model is gemma4:12b, and Mythic is post-MVP. Its working rules (verify before edit, delete outright, tests gate) are still valid. **Recommend: refresh** — it is the auto-loaded instructions file, so a stale copy actively misleads builders.

## `PROJECT_BRIEF.md` — STALE as a live guide

The project brief: DM Mode + Prelude presented as built; decision principle "Narrative beats mechanics" directly contradicts Zach's 2026-11-08 system-wide rule "nothing mechanical is narrative-only." The vision portions (solo forever game, canonical FR history) are still true. **Recommend: refresh the principles section, or archive with a pointer to the pm-guide as the live brief.**

## `OPEN_QUESTIONS.md` — KEEP

Published-campaign-modules reference Q&A (how modules work, chronological play-through). Still true; the module system exists in code (`campaignModules.js`). Not MVP-critical, but accurate and small. Keep.

## `PROJECT_TODO.md` — STALE

Per-session active/blocked/parked map, last updated 2026-05-02, Phase 2 era ("Phase 3 next"). Superseded by `current-build-state.md` + pm-guide §6 as the live queue. Archive.

## `CONSOLIDATED_TODO.md` — STALE as a live sequence

May 2026 Phase 0–7 plan. Phases 0–3.7 shipped; Phases 4–7 never ran as sequenced (Phase 4 became dungeon/scene/combat per governing order v2, not the AI-behavior diagnostic; Phase 5's focus-area pick never happened; Phases 6–7 never ran — no one has played). **Carry-forward before archiving:** its parking lot still holds open items not tracked in pm-guide §6 — Keeper genre-bonus texts + Eidetic Memory + Unwritten Knowledge, Aasimar Path's Choice persistence, Drow Lolth standing / House Heritage, Human Quick Study time-bounded persistence, deity worship-contract authoring, heirloom handoff producer, the unreviewed-systems list (living-world tick, merchant economy, bases, NPC lifecycle, notoriety, quest ecosystem), and the orphaned `partySynergy.js` import. Archive after the parking lot is checked against the current queue.

## `KNOWN_BUGS.md` — KEEP-DEFERRED

Bug log, last updated May 2026. Active entries are all fortress-system gaps (recapture window without a recapture mechanism, holdings-purpose stub) — fortress is post-MVP. The resolved archive is history. Note: newer bugs/gaps live in the PM queue (pm-guide §6, class audit), not here. Keep; revisit with the fortress phase.

## `TEST_RESULTS.md` — STALE

Test-run log, last entry 2026-05-04, v1.0.139 era. Test verification now lives in Claude Code `REPORT.md` files + Zach's gate runs. Archive.

## `CAMPAIGN_READINESS_AUDIT.md` — STALE

Point-in-time audit, 2026-08-09, v1.0.167, 53 migrations, 10 gaps all "Open" — its own instruction to update Status lines as work landed was never followed. Most headline gaps are now closed: HP/death saves (combat items 1–8), session lock, migration-transaction rule, `npm test`, central RNG (`rng.js`), session-end living-world tick + act resolution, chronicle rollup. **Carry-forward:** two items remain open — ai_call_log archival (still listed as structural debt in CLAUDE.md) and post-level-20 progression (Mythic, post-MVP). Archive as a historical snapshot after carrying those two forward.

## `CHAR_CREATOR_DESCRIPTIONS_AUDIT.md` — STALE

2026-04-19 audit of description coverage in the old `CharacterCreationWizard.jsx` (all 21 items cite its line numbers, v1.0.26–39 era). The old creators are unhooked; the new 6-stage creator has tooltips on every choice as a global rule. Its reference-map ideas (SKILLS_REFERENCE, LANGUAGE_DESCRIPTIONS) are the only live residue, and creator round 3 covers copy/tooltips. Archive.

## `PHASE_4_OVERVIEW.md` — STALE

May 2026 framing of Phase 4 as an AI-behavior diagnostic phase with a practice/closure model. The Phase 4 that was built is dungeon + scene layer + combat items 1–8 (governing order v2, current-build-state). Its §8 (DM-craft articulation) did land — the articulation exists at `triage/DM_CRAFT_ARTICULATION.md` — but the Phase 4b absorption investigation never ran as specced. Archive.

## `PHASE_4A_SPEC.md` — STALE

Diagnostic-infrastructure spec (ai_call_log migration 053, quality signals, prompt-shape accounting, debug page + CLI). Phase 4a shipped per the 2026-05-06 DECISION_LOG entry ("diagnostic infrastructure that immediately surfaced findings"); the spec is a spent plan, and its framing (same-Opus-family calibration, Claude API calls) predates the gemma4:12b decision. Archive.

## `PHASE_4B_SPEC.md` — STALE

Investigation framework: #1 constraint audit, #2 continuity, #3 shelter-fixation, #4–#8 roster placeholders. Superseded: the constraint audit never ran as specced (the DM rules registry + AI behavior playbook + structure-over-instruction skill are the current form of that work); shelter behavior was addressed via system-rolled hidden agendas, a different mechanism than the spec's prompt-shape fix; #7 (DM-craft absorption) never ran. **Carry-forward:** roster item #4 (combat difficulty mechanism activation for the Phase 3.5 placeholder dial) is still open in some form. Archive after noting it.

## `PHASE_3_5_SPEC.md` — STALE

Settings page spec (survival intensity + combat-difficulty placeholder). Phase 3.5 shipped at v1.0.163 (`SettingsOverlay.jsx`, survival dial wired end-to-end, combat dial drawn "Coming soon" — confirmed in CONSOLIDATED_TODO). Spent plan. Archive.

## `PHASE_3_7_SPEC.md` — KEEP-DEFERRED

Fortress groundwork plan (marker-driven threats, damage-asymmetry fix, KNOWN_BUGS updates). SC-3.7.1/3.7.2 shipped at v1.0.164 (kingdom-management survey post-3.7 update); the deferred parts — recapture quest framework, holdings-purpose data, fortress intensity dial — are the fortress phase's inheritance. Fortress is post-MVP. Keep; the fortress phase should re-verify SC-3.7.1/2 against live code before building on them.

## `PHASE_3_REFACTOR_SPEC.md` — STALE

Phase 3 spec (standing-scalar abstraction, marker pipeline consolidation). Phase 3 closed at v1.0.162, 16/16 sub-checkpoints (Phase_3_Closeout.md). Spent plan. Its "does NOT do" list is a useful deferral record, but the closeout covers what happened. Archive.

## `PHASE_2_CREATOR_SPEC.md` — STALE

236 KB spec for the old 8-step creator with Prelude handoff (manual/handoff modes, Screen 2 path choice, 252 prompts, ~170 backstory moments). Superseded by the new 6-stage creator (built, gated green); the old wizard is unhooked. **Do not delete:** its drafted copy may still be referenced by the new creator's copy work. Archive.

## `Phase_2_Creator_Spec_Drafted_Content.md` — STALE

Player-facing copy drafted for the old 8-step flow (Apr–May 2026, confirmed by Zach at the time). Creator round 3 rewrote Story & Appearance copy professionally, and Zach corrected that his draft wording must NOT be used verbatim. Archive as the record of confirmed intent behind the rewrite.

## `Phase_3_Closeout.md` — KEEP

Plain-language close-out brief for Phase 3 (standing-scalar abstraction, unified marker pipeline, shared time primitives, five fix-along-the-way bugs). Accurate historical record of foundations still live in the build. Keep.

## `IMPLEMENTATION_PLAN.md` — STALE

10-phase progression-systems roadmap (Themes, Ancestry Feats, Party Synergies, Subclass×Theme, Mythic amplifications, Downtime v3). Phases 1–5 are built past it — via the new 6-stage creator, not the "character creation wizard" the plan names — and its test instructions point at the stale TEST_RESULTS.md. Phases 6–9 (synergies, downtime v3, team tactics, mentor/mythic trackers) are deferred systems tracked via their own docs + pm-guide. Archive.

## `PRELUDE_IMPLEMENTATION_PLAN.md` — KEEP-DEFERRED

Prelude (prologue) design, v4: 4 sessions across 3 chapters, emergence mechanics, handoff contract. Prologue is post-MVP (locked 2026-11-11). Still the standing design for the deferred system. Note: assumes Opus ("Opus generates the Prelude arc plan") — model references need updating to gemma4:12b at revisit. Keep.

## `DM_MODE.md` — KEEP (with refresh notes)

Design doc for DM Mode (user DMs, AI plays 4 PCs): party generator, bond-shift evolution, marker set, OOC channel, memory architecture, file pointers. The mode exists in code (`dmModePromptBuilder.js` et al.) and the design is live. **Refresh notes:** the model-split sections (Opus generation/opening, Sonnet continuations/coaching/extraction) contradict the gemma4:12b decision; "Spells (300+)" should read 583; the party generator's "background" should read theme. Keep; refresh the model/count lines.

## `COMPANIONS.md` — KEEP (with refresh notes)

Design doc for companions (mechanical parity, loyalty 0–100 with labels, mood, threads, activities, auto-progression, lifecycle). Companions are MVP scope (recruiting is in the MVP done-list) and the design is live. **Refresh notes:** Opus references (backstory generator, activity outcomes) predate gemma4:12b; the synergies section describes Party Synergies as firing, but that system's AI integration is unbuilt (PARTY_SYNERGIES_REVIEW); the garrison/base-roles section is post-MVP fortress. Keep; refresh the noted lines.

## `DOWNTIME_DESIGN.md` — KEEP-DEFERRED

Downtime v3 design (between-sessions, parallel-limited, vignette narration, 30+ activities). Full downtime is post-MVP (locked 2026-11-11). Still the standing design for the deferred system. Keep.

## `MYTHIC_PROGRESSION_GUIDE.md` — KEEP-DEFERRED

Mythic progression reference (5-tier compression of PF1E Mythic Adventures + WotR paths, piety, epic boons). Header says "Framework only. Not active in Campaign I." Mythic is definitely post-MVP. Note: campaign framing (Order of Dawn's Light, Riv, The Master) predates the Embervale MVP campaign and will need re-grounding at revisit. Keep.

## `MYTHIC_THEME_AMPLIFICATIONS.md` — KEEP-DEFERRED

Mythic × Theme resonant/dissonant amplifications (~15 resonant, ~7 dissonant, Redemption/Corrupted Dawn arcs). Mythic is post-MVP. Keep; revisit with the Mythic guide.

## `FUTURE_FEATURES.md` — KEEP-DEFERRED

The parking lot: self-hostability roadmap, Drow Lolth tracker, Nardo's Manual feat layer, LLM infrastructure follow-up, Prelude→campaign handoff, Opus/Lean toggle unification, Session Hi-Fi. **Two entries are overtaken and need flagging at revisit:** the self-hostability entry's premise (cloud-dependent, Anthropic-only; "path to Milestone G plausibly 2027-2028") is overtaken by the gemma4:12b decision — its Milestone A (provider abstraction) is still open work (governing order item 8), and its Milestone G is the decided direction, not a 2027 prospect; the Opus/Lean toggle entry is about the old Claude setup. The Session Hi-Fi entry is still the standing plan, pending 5 user decisions (see headline findings). Keep as the parking lot.

## `CUSTOM_CLASSES.md` — KEEP (with refresh notes)

Keeper class design + implementation checklists (Recitation, Manifest Weapon, Genre Domains, 4 subclasses at L6/L11/L15, Polymath track). Keeper is a live class; subclass-at-6th matches the 2024 subclass-level audit. **Refresh notes:** the `MULTICLASS_REQUIREMENTS (CHA 13 + INT 13)` line contradicts the 2026-11-08 ruling removing all multiclass prerequisites — verify against live `levelProgression.js` (the class audit shows other classes still carrying MULTICLASS tables); the old-wizard references are dead. Keep; refresh the noted lines.

## `ANCESTRY_FEATS.md` — STALE (refresh the header, don't delete)

Ancestry feats design catalog. Its status header ("195 feats implemented across 13 lists") contradicts the built registry (210 feats in 14 lists, per MEMORY.md and the class audit). The feat content itself is the design source for the registry. **Recommend: refresh the status block** (counts + 14th list + Path Less Walked status) rather than archiving — the catalog is still the source of the feat text.

## `ANCESTRY_FEATS_REDESIGN_DEFERRED.md` — KEEP-DEFERRED

Parked redesign vision (4-tier structure, L18 generational inheritance). Explicitly not committed; gated on lineage-of-characters infrastructure (legacy system, post-MVP) and race quests. Note: its "pause new races" guidance was superseded — the registry grew to 29 species / 14 ancestry lists since. Keep; revisit when lineage infrastructure is scoped.

## `PARTY_SYNERGIES.md` — KEEP-DEFERRED

Three-tier synergy design (Gear/Positioning, Theme, Team Tactics). Unbuilt system, Phase 5 candidate (Phase 3 spec §1.2); Tier 3 depends on the deferred downtime system. Not MVP scope. Keep; revisit after MVP.

## `SUBCLASS_THEME_SYNERGIES.md` — KEEP-DEFERRED

~40 resonant subclass × theme pairings with passive bonuses. Unbuilt system, Phase 5 candidate; "Themes AI-trigger specs" is the same deferred bucket. Keep; revisit after MVP.

## `THEME_DESIGNS.md` — KEEP (with a status-line note)

Theme progression catalog: 21 themes × 4 tiers (L1/L5/L11/L17, Expertise Die d4→d6). The theme system is built (creator Stage 3, theme tiers in the DB) and this is its design catalog. **Note:** the status line ("first batch of 4 archetypes for pattern approval") is from April 2026 — all 21 are built. Verify the registry matches the doc at the next theme audit. Keep.

## `AI_NARRATIVE_PERSISTENCE.md` — KEEP

Requirements tracker for AI memory architecture (Drow Lolth standing, Aasimar paths, companion auto-pick canon-coherence, Quick Study, etc.). Still the live requirements list for the queued knowledge-ignorance / AI-memory design work (pm-guide §6). Last updated 2026-04-26; at revisit, check which entries are now covered by built machinery (chronicle extraction, knowledge flags) vs still open. Note: the Drow Lolth entry was parked to FUTURE_FEATURES per the Phase 3 spec (Zach doesn't play Drow). Keep.

## `LLM_SETUP.md` — STALE (needs rewrite, not deletion)

Multi-model architecture doc: Claude Opus/Sonnet primary, Anthropic API key setup, Ollama `gpt-oss:20b` fallback, "DM sessions default to Opus as of v1.0.99." Flatly contradicted by the decided DM model (gemma4:12b, offline on Zach's PC, 2026-11-10) and the PC-native plan. The module-structure table may still be accurate as file names, but the provider/model story is wrong. **Recommend: rewrite** for the current setup (gemma4:12b via Ollama on PC, per-role models open) — a current LLM setup doc is still needed.

## `DECISION_LOG.md` — STALE

Decision record, 259 KB, newest entry 2026-05-06 (v1-maintenance / v2-rebuild decision). Not maintained for 6 months: every major decision since — gemma4:12b, MVP scope lock, new creator, multiclass-prerequisite removal, class audit, PC-native plan, spellbook replacement vetoes — lives in MEMORY.md / pm-guide / current-build-state.md instead. Its headline entry (v1 enters maintenance, v2 is a new build) also needs reconciliation with the actual branch history (work continued on `phase-4-hybrid-combat` with v1.0.19x versioning). Its open-decisions section (project rename, Session Hi-Fi Path A/B) is still the only record of those two open calls. **Recommend: archive as the v1-era record, and either backfill the 6 months of decisions or start a current log** — don't leave two competing decision records.

## `CHANGELOG.md` — STALE

712 KB changelog, newest entry [1.0.0.193] 2026-10-21 (542 spells). The November builds (583 spells, migrations 111–113, creator rounds, spellbook, rest consolidation, Arcane Recovery, mechanics hooks, loot wiring) are unrecorded. current-build-state.md line 7 already notes it lags ("they still read 1.0.193 while the code is past it"). Its purpose is now served by Claude Code REPORT.md files + the state note. **Recommend: archive, or revive by appending a CHANGELOG entry per REPORT.md** as part of the PM pipeline.

## `Character Creator Questions.md` — STALE

Design's pre-mockup questions for the old 8-step creator (all checkboxes unchecked). The mockup work is long done and the creator has since been rebuilt from scratch. Spent. Archive.

---

# `Claude PM Review Docs/` (11 files)

All nine system reviews + the code audit + the Phase 2 ship note, April–May 2026. They are working docs from the nine-system review pass; their status lines ("findings deferred per user pending remaining system reviews") predate the reviews completing.

## `CODE_AUDIT_FINDINGS.md` — STALE

Code-side audit, 2026-04-28, main @ `4d52764`, v1.0.102: reality vs review assumptions across Ancestry Feats, Keeper, Downtime, and more. Point-in-time snapshot, 6+ months and ~90 versions old. Superseded as the live gap record by the 2026-11-10 class audit (23 classes, 22 gaps, read from live bytes). **Carry-forward before archiving:** its non-class findings (downtime v2 state, ancestry-feats integration gaps) should be checked against the current record — the ancestry-feats ones (Lolth tracker, Path's Choice, Quick Study) live on in AI_NARRATIVE_PERSISTENCE.md, which is KEEP. Archive.

## `COMPANIONS_REVIEW.md` — KEEP

Companions review findings: the central "wound problem" (no `core_wound` field; backstory generator has no prompt-engineering principles; no wound-surfacing mechanism), plus guardrails (mechanical parity, filled-not-overwrite enrichment, loyalty-gated secrets). Companions are a live MVP system and the wound problem is still open design work — the deferral condition (remaining system reviews) has long been met, so these are actionable backlog. Note: Opus references in the fix options predate gemma4:12b. Keep.

## `DM_MODE_REVIEW.md` — KEEP-DEFERRED

DM Mode review findings: tutorial question (no progression model/curriculum; coaching panel is a tip generator), AI-behavior model for the rest of the project. DM Mode exists but is out of MVP scope; findings deferred. Note: "Model split: Opus for generation, Sonnet for continuations" is stale. Keep; revisit when DM Mode is next worked on.

## `DOWNTIME_REVIEW.md` — KEEP-DEFERRED

Downtime v3 review findings: origin-alignment question (v3 session-driven vs original time-driven use case), heavy AI-memory dependencies, "downtime activation pairs with starting an actual long-running character." Full downtime is post-MVP. Keep; revisit with DOWNTIME_DESIGN.md.

## `KEEPER_REVIEW.md` — STALE

Keeper review findings (CASTER_TYPE `none` bug, genre-bonus texts gap, synergy ratings leaking into UI, subclass picker descriptions). Its headline bug was fixed in Phase 0 (v1.0.103, per CONSOLIDATED_TODO), and the class audit (2026-11-10) is now the live Keeper gap record — carrying different gaps (no service file, no rest hook, no server subclass file, Passages untracked). **Carry-forward before archiving:** check the genre-bonus-texts gap against live `keeperTexts.js` — CODE_AUDIT_FINDINGS confirmed the 8 texts didn't exist as content, the parking lot still lists them, and the class audit doesn't mention them. If still missing, they belong in the class-audit gap list. Archive after that check.

## `LLM_SETUP_REVIEW.md` — STALE

LLM setup review: Phase 1 audit + Phase 2 fixes at v1.0.102 (Anthropic console spending cap as load-bearing mitigation, Ollama fallback untested, $2.50–4.50/session costs, 429 handling). The entire review is about the Claude-primary/Anthropic setup the gemma4:12b decision replaced; the spending-cap finding is moot for a local model. Its live residue — "we don't know if the fallback actually works" — is now the queued gemma4:12b leak test. Archive.

## `MYTHIC_REVIEW.md` — KEEP-DEFERRED

Mythic review findings: Tier 5 over-scoping (Lich "Final Equation" and Trickster "Narrative Authority" flagged as broken/unbounded), only Hierophant fully detailed, doc is hybrid system-spec/campaign-application. Deferral is by design ("we have time on this one"). Mythic is post-MVP. Keep; the Tier 5 redesign flags are live design debt for the Mythic build.

## `PARTY_SYNERGIES_REVIEW.md` — KEEP-DEFERRED

Synergy review findings: AI DM integration unbuilt (highest-leverage gap), companion engagement layer unbuilt, Tier 3 depends on Downtime activation, active-synergy UI unbuilt. The system is unbuilt; findings are the backlog for it. Keep; revisit with PARTY_SYNERGIES.md.

## `PHASE_2_SHIP_NOTE.md` — STALE

Ship note for the old 8-step creator (CharacterCreatorV2, v1.0.114/115, 2026-05-02) with four spec deviations needing PM sign-off. The old creator was scrapped and rebuilt from scratch; the sign-offs are moot against the new creator. Archive.

## `PRELUDE_REVIEW.md` — KEEP-DEFERRED

Prelude review findings: central finding is AI sheltering the child PC from stakes regardless of tone signal (prompt-engineering/AI-behavior problem, same shape as prose-quality H7/H8), plus the preserved record of PM hypotheses Zach marked wrong. Prologue is post-MVP; the sheltering finding is the key design input for the prologue build. Note: "Round 3 reframe paired with Phase 5, unbuilt" — design state to re-verify at revisit. Keep.

## `THEMES_REVIEW.md` — KEEP

Themes review findings: AI integration is the load-bearing missing piece (AI must proactively surface theme effects; several abilities lack AI-trigger specs), plus guardrails (L1/L5/L11/L17 structure, Expertise Die, divergence notes, balance pass). Themes are built; the AI-surfacing work is still unbuilt — the same open question as the "theme choices read downstream" creation gap in job 1. Keep.

---

# `triage/` (7 files)

## `DM_CRAFT_ARTICULATION.md` — KEEP

Zach's own words on what good DMing looks like in the forever game (cohesive story, meaningful interaction across campaigns, fun-without-risking-story, believable + fantastic world) — including the Riv/Embervale/Candlekeep example this campaign's setting grew from. Still the grounding philosophy for the DM system design. Note: its loose "adjust the outcome of rolls" language predates the settled DM-discretion fence (band ≤2, info/exploration/social only, never attack/damage/death saves, nat 1 never fudgeable — `dm-discretion-design.md` in the workspace is the operative rule). Keep.

## `PHASE_3_5_DESIGN_BRIEF.md` — STALE

Design brief for the Settings page (Phase 3.5). The page shipped at v1.0.163. Spent brief. Archive.

## `alignment-coverage-matrix.md` — STALE

Generated coverage matrix (2026-05-02, 241/567 cells filled) for theme Ideals/Bonds/Flaws prompts. A generated snapshot — re-runnable via `node tests/coverage-matrix.js` — and the creator's Story copy has since been rewritten in round 3, so the snapshot no longer reflects the live prompts. **Only delete candidate in this audit** (regenerable; the generator is the source). Preserve the PM ruling it records ("roleplay-believable coverage, not every cell") — it is also quoted in CONSOLIDATED_TODO's parking lot. Delete or regenerate; do not trust as-is.

## `kingdom-management-survey.md` — KEEP-DEFERRED

Fortress/kingdom management surface survey, updated post-Phase-3.7 (2026-05-06): two findings resolved in 3.7 (producer gap, damage asymmetry), two open as KNOWN_BUGS (recapture, holdings purpose), fortress dial parked. The standing survey for the deferred fortress system; its post-3.7 status is still accurate. Note: Opus prompt references are stale. Keep; revisit with the fortress phase.

## `pattern-d-survey.md` — STALE

Time-bounded state survey (11 surfaces, 4 shapes) written as input to Phase 3 §3.3. Phase 3 closed with the shared time primitives built. Spent input. Archive.

## `prose-quality-triage.md` — STALE

Prose-quality triage, CLOSED 2026-04-26 (Opus vs Sonnet, lean prompt, cache tiers, $1.50/hour Opus costs). Its model framing is superseded by the gemma4:12b decision; the open H7/H8 findings (OBSERVATION=ALWAYS A CHECK, HARD STOPS) live on in the DM rules registry work. Archive with the tests/output artifacts below.

## `q6-detect-function-survey.md` — STALE

SC-6.4 survey of 28 detect-functions as of v1.0.149, input to Phase 3.2's marker-pipeline migration (shipped in four ships). Spent. **Live residue:** the `detectDowntime` deferral (PARK ENTIRELY, Phase 5+ candidate when new marker content is in scope) belongs to the downtime phase, not this survey. Archive.

---

# `Claude UX Design/` (3 files)

## `D&D Meta Game (Remix)/Session-Design-Bundle/README.md` — STALE

Generic "CODING AGENTS: READ THIS FIRST" handoff template from Claude Design. The bundle on disk is partial: the README references `d-d-meta-game/chats/` and `d-d-meta-game/project/` subfolders that don't exist (only the transcript + `Session Hi-Fi.html` are present). The HTML prototype and transcript are the real artifacts. Archive with the bundle.

## `D&D Meta Game (Remix)/Session-Design-Bundle/chat-transcript.md` — STALE

74 KB transcript of the April 2026 wireframe exploration (7 screens: dashboard, DM Session, Character Creation Wizard, Character Sheet, Fortress, Inventory/Merchant, NPC Codex). A design exploration, not a live spec: the screens it wireframed have since been rebuilt (new creator) or deferred (fortress), and the wireframes were never implemented. The Session Hi-Fi decision it feeds is still open (see headline findings). Archive.

## `D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md` — STALE

UX-facing Themes explainer ("Design locked-in 2026; data partially seeded; UI surfacing on the Progression tab"). Its unlock model — "Themes unlock automatically at the milestone levels. The player never picks from a menu" — contradicts the live design: the player picks theme abilities at tier crossings (COMPANIONS.md; IMPLEMENTATION_PLAN Phase 5; THEME_DESIGNS 3-choices-per-tier structure). THEME_DESIGNS.md is the live theme source. Archive.

---

# `dnd-documents/` (1 file)

## `Lost_Mine_of_Phandelver_Clean.md` — KEEP

Full text of the Lost Mine of Phandelver adventure (261 KB). Reference content for the published-module system (OPEN_QUESTIONS.md; `campaignModules.js` exists in code). It can't go stale — it's the book text. Not MVP scope (the MVP campaign is Embervale), but still the reference text for the module pipeline. Keep.

---

# `tests/output/` (2 files)

## `prose-quality-analysis.md` — STALE

Prose-quality diagnostic findings, 2026-04-25 (3 scenarios × 5 prompt variants on Sonnet 4.6; H7/H8 findings). Same closed April 2026 diagnostic as the triage doc; model under test is no longer the DM model. Archive as test evidence.

## `prose-quality-results.md` — STALE

Raw A/B outputs from the same diagnostic (Sonnet 4.6, 2026-04-27). Raw test evidence for a closed investigation. Archive.

---

# Recommended actions

**Refresh (the file should live on, rewritten) — 5 files:**
1. `README.md` — rewrite for the current product (gemma4:12b, 583 spells, solo forever game, MVP scope).
2. `CLAUDE.md` — refresh model/flag/status sections to the handoff + gemma4:12b + current pipeline. Highest priority: it auto-loads for builders.
3. `LLM_SETUP.md` — rewrite for gemma4:12b via Ollama on the PC; per-role models open.
4. `ANCESTRY_FEATS.md` — refresh the status header only (210 feats, 14 lists, Path Less Walked status); the catalog stays.
5. `PROJECT_BRIEF.md` — refresh the principles section ("nothing mechanical is narrative-only") or archive it with a pointer to the pm-guide.

**Refresh notes on KEEP files (small edits, not rewrites):** `DM_MODE.md` (model split, spell count, background→theme), `COMPANIONS.md` (Opus refs, synergy section, garrison section), `CUSTOM_CLASSES.md` (multiclass-requirements line, old-wizard refs), `THEME_DESIGNS.md` (status line).

**Archive (move to an archive folder, don't delete) — 29 files:** all other STALE files. They are the project's history: phase specs, close-out-era audits, review docs, triage surveys, prose-quality evidence, old-creator docs, DECISION_LOG + CHANGELOG as the v1-era records. Archive, don't delete — several contain the only record of a decision or a finding (see carry-forwards).

**Delete candidate — 1 file:** `triage/alignment-coverage-matrix.md` — regenerable via `node tests/coverage-matrix.js`; the PM ruling it records is preserved in CONSOLIDATED_TODO's parking lot. Delete or regenerate; do not trust as-is.

**Carry-forwards — check before archiving (open items buried in STALE docs):**
- CONSOLIDATED_TODO parking lot: Keeper genre-bonus texts / Eidetic Memory / Unwritten Knowledge; Aasimar Path's Choice persistence; Drow Lolth standing / House Heritage; Human Quick Study; deity worship contracts; heirloom producer; unreviewed-systems list; orphaned `partySynergy.js` import.
- CAMPAIGN_READINESS_AUDIT: ai_call_log archival (still CLAUDE.md structural debt); post-20 progression (Mythic, post-MVP).
- KEEPER_REVIEW / CODE_AUDIT_FINDINGS: genre-bonus texts vs live `keeperTexts.js` — if still missing, add to the class-audit gap list.
- PHASE_4B_SPEC roster #4: combat difficulty mechanism activation for the Phase 3.5 placeholder dial.
- DECISION_LOG open decisions: project rename; Session Hi-Fi Path A/B (see below).
- `q6-detect-function-survey`: `detectDowntime` deferral → downtime phase.

**Revive-or-retire decision needed:** DECISION_LOG (last entry May 2026) and CHANGELOG (last entry Oct 2026) are both dead as living records while decisions and ships continue. Either backfill them or formally retire them in favor of MEMORY.md / pm-guide / current-build-state.md + REPORT.md files. Don't leave two competing records.

# Headline findings

1. **The two living records are dead.** DECISION_LOG stopped in May 2026; CHANGELOG stopped in Oct 2026 (current-build-state already notes the lag). Six months of decisions and a month of ships live only in MEMORY.md, the pm-guide, and the state note. The Claude Code REPORT.md pipeline is the de facto changelog now.
2. **The model story is wrong in ~10 files.** README, CLAUDE.md, LLM_SETUP.md, LLM_SETUP_REVIEW.md, DM_MODE.md, COMPANIONS.md, the prose-quality cluster, and FUTURE_FEATURES entries all describe Claude Opus/Sonnet + Anthropic API as production. The decided DM model is gemma4:12b, offline on Zach's PC. LLM_SETUP.md is the worst offender (setup instructions for an API key the game no longer needs).
3. **Phase 4 as documented never happened.** The Phase 4 specs describe an AI-behavior diagnostic phase; the Phase 4 that shipped was dungeon + scene layer + combat items 1–8. The investigation roster was superseded by the DM rules registry, the AI behavior playbook, and system-rolled mechanisms (hidden agendas).
4. **The old creator haunts 6+ files.** PHASE_2_CREATOR_SPEC, Drafted_Content, Character Creator Questions, CHAR_CREATOR_DESCRIPTIONS_AUDIT, PHASE_2_SHIP_NOTE, and the UX bundle all describe creators that were scrapped and rebuilt from scratch. The new 6-stage creator is the only live creator.
5. **The deferred-system docs are in good shape.** Prologue, downtime, Mythic, fortress, synergies, and the ancestry redesign vision are all coherent standing designs with clear revisit triggers — 16 KEEP-DEFERRED files, none contradicting the MVP scope lock. The fortress survey's post-3.7 status is still accurate.
6. **One live design decision sits in the stale pile.** Session Hi-Fi (three-column in-session cockpit): design landed April 2026, 5 open questions, Path A vs Path B undecided — recorded as an open decision in DECISION_LOG and as a standing entry in FUTURE_FEATURES, with the design bundle on disk. It is the only user decision in the audit that is still genuinely pending and not tracked in the PM queue.
7. **The Keeper CASTER_TYPE bug is fixed; the genre-bonus texts gap probably isn't.** Phase 0 fixed CASTER_TYPE in April 2026, but the 8 Genre-bonus texts were confirmed missing by the code audit, are still in the parking lot, and don't appear in the 2026-11-10 class audit. Worth one check against live `keeperTexts.js` before archiving the review docs.

# Limitations

- `files.search` skips hidden files/folders, so any .md under a hidden folder (e.g. `.github/`) was not enumerated.
- Huge files were read head + targeted tails, not cover to cover (CHANGELOG, DECISION_LOG, PHASE_2_CREATOR_SPEC, THEME_DESIGNS, ANCESTRY_FEATS, Lost Mine). Verdicts rest on status headers, structure, and sampled content corroborated against the judging record.
- The search enumeration initially placed `Themes-Replace-Backgrounds.md` inside `Session-Design-Bundle/`; folder listing showed it in the `D&D Meta Game (Remix)/` root instead. Counts were re-verified by folder listing: 38 root + 11 PM Review + 7 triage + 3 UX + 1 dnd-documents + 2 tests/output = 62.
- No .md files exist under `server/`, `client/`, `scripts/`, or `docs/` (no `docs/` folder exists; `docs/pm/` is created by Claude Code on job 1).
