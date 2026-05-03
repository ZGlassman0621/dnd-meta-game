# Consolidated Project To-Do

**Status:** Draft 1, post-review-phase, post-Code-audit, with Phase 0–1 status updates 2026-04-30
**Supersedes:** `PM_TODO.md` queue (PM_TODO described itself as ephemeral end-of-review state; this is the durable sequence)
**Complements:** `PROJECT_TODO.md` (which remains the per-session active/blocked/parked map)
**Sequencing decision:** Foundation-first (Option B). Logged in `DECISION_LOG.md` 2026-04-29.

---

## How to read this

Seven phases plus a parking lot. Phases are sequenced strictly — each phase ships before the next begins, with the gating reason called out per phase. Within a phase, items are ordered by dependency where it matters, and unordered where it doesn't.

Severity tags from the Code audit carry through: 🔴 real bug, 🟡 doc-vs-code drift or scope-not-built, 🟢 heads-up.

The trade this sequence makes: AI behavior diagnostic happens *before* commitment to a focus area, inverting the bootstrap prompt's instinct. Reasoning: three candidate focus areas (Prelude AI behavior, Companions wound representation, Themes AI integration) share the same diagnostic. One investigation feeds three execution paths.

---

## ✓ Phase 0 — Stop the bleeding

**Status:** Shipped at v1.0.103, commit `099a22a` (2026-04-29).

Cheap fixes that landed before bigger work to keep the codebase honest.

- ✓ 🔴 Keeper `CASTER_TYPE: 'none'` bug. [`server/config/levelProgression.js:605`](server/config/levelProgression.js#L605). Multiclass spell-slot calc treated Keeper as non-caster despite caster mechanics. Fixed to third caster (not full — design verification surfaced that Keeper has no traditional spell-slot table; setting to `'full'` would have been the inverse exploit). Keeper subclasses (Lorewarden, Mythslinger, Rhetorician, Versebinder, Polymath) registered in `SPELLCASTING_SUBCLASSES`. See DECISION_LOG 2026-04-29 "Keeper is a third caster, not a full caster (Architecture)."
- ✓ 🔴 `[PARTY_ARGUMENT]` reserved-but-unprocessed in DM Mode. Resolved by parking the marker for Phase 6 implementation; reservation kept, DM Mode prompt instructs the AI to skip emission until then. See DECISION_LOG 2026-04-29 "Park `[PARTY_ARGUMENT]` to Phase 6."
- ✓ 🟡 CLAUDE.md `creation_phase` enum drift. Resolved with a Phase 2 forward-looking update — doc now correctly lists `'prelude' | 'ready_for_primary' | 'active'`, and Phase 2 Decision C (2026-04-30) confirmed the third value formally.
- ✓ 🟡 CLAUDE.md ancestry feat count drift. Reconciled to 195 (matches code). "Path Less Walked" cross-pick parks for Phase 7 / playing-mode evaluation. See DECISION_LOG 2026-04-29 "Ancestry feat count: 195 canonical."
- ✓ 🟡 Doc cleanup. PM_TODO retired. PRELUDE_IMPLEMENTATION_PLAN rule #23 (mentor_imprints) flagged as design-only until Phase 2. ANCESTRY_FEATS.md status header reconciled.

**Out of Phase 0 (intentional):** the orphaned `partySynergy.js` import. Touched as part of Party Synergies work later.

---

## ✓ Phase 1 — Prelude reframe (game design)

**Status:** Complete 2026-04-29. No version bump (game design only). Output: `PRELUDE_IMPLEMENTATION_PLAN.md` v4.

The Prelude was too long for the play sessions actually available. The reframe collapsed the 5-session, 4-chapter structure to a 4-session, 3-chapter structure (with Ch4 cut) and tightened the emergence machinery.

**Success criteria carried through:**
1. Allows growth (the PC changes meaningfully across the experience) ✓
2. Allows story beats (not just montage) ✓
3. Feels like an origin story (not a backstory generator) ✓
4. Builds character in a way that beats "pick a background and start at age 20" ✓

**Decisions logged 2026-04-29:**
- Decision 1 — Outputs spec locked (7 tangible, 4 felt; values tracker cut, mentor moves to setup, party combat dropped)
- Decision 2 — Three-chapter structure (Ch1 / Ch2 / Ch3; Ch4 collapsed)
- Decision 3 — Machinery audit (5 hints kept, theme ceremony simplified, backstory repurposed as biography seed, chapter promises shifted, tally re-tuned, values + tone-tags + transient-canon cut) plus tone description sub-deliverable
- Decision 4 — Ch3 beat sequence (irreversible act → theme commitment → departure)
- Decision 5 — Pacing (4 sessions: 1/1/2; intra-Ch2 AGE_ADVANCE; per-chapter rhythm guidance)
- Decision 6 — Long-term thread seeding (`[CANON_THREAD]` marker; asymmetric NPC memory model parked for Phase 3)

---

## Phase 2 — Prelude → Primary transition (engineering) ← *currently in progress*

🔴 **Highest-priority real bug in the codebase as of Phase 0 close.** A player who finished the Prelude pre-Phase-2 had no service to flip them to active. Phase 2 fixes that and ships the surrounding transition machinery.

**Pre-engineering decisions logged 2026-04-30:**
- Decision A — Setup wizard content revisit (10-question rewrite locked; cuts talents/cares/tone-preset, adds authority figure + free-text "anything else")
- Decision B — Main creator rebuild scope (full rebuild, two co-equal entry paths: manual creation + Prelude handoff; new 7-step starting structure; empty-state home page in scope)
- Decision C — `creation_phase` intermediate state (`'prelude'` → `'ready_for_primary'` → `'active'`; home page renders separate "Your characters" and "In progress" sections)

**Phase 2 engineering chunks:**
1. Setup wizard rebuild (per Decision A spec)
2. Transition service (`[PRELUDE_END]` handling; payload generation; persistence; `creation_phase` migration to three-state enum)
3. Prompt builder (arc plan generation including authority_figure + origin_freeform; mentor NPC trigger; tone description integration)
4. Marker handling (`[ANCESTRY_HINT].feat_id` server validation; `[NPC_CANON]`, `[CANON_THREAD]`, `[PRELUDE_END]`)
5. **Main creator integration (GATED)** — does not start until per-step creator spec is locked AND Claude Design mockup is approved. Existing `client/src/components/CharacterCreationWizard.jsx` not touched until this chunk. Home page redesign also lands here.

**Gap-period UX:** Between chunks 1–4 shipping and chunk 5 landing, the existing `CharacterCreationWizard.jsx` continues running with a partial Prelude pre-fill (race/subrace/theme; remaining fields manual). Players who finish the Prelude in this window still get a working closed loop — see PM 2026-04-30 reply to Code on A2a.

**Living biography schema:** Built in chunk 1 as `character_biography` table (row-per-entry); seeded in chunk 2 with `seeded_from_prelude` entries; no UI in Phase 2 (UI lands with the future post-creation character sheet design pass).

**Includes deletion or migration of cut machinery:** values tracker, tone-tag system, Ch4 arc generation, orphaned exports from `preludeSetup.js`.

**Engineering bootstrap drafted 2026-04-30** in PM chat for hand-off to a fresh Code chat. Per-step creator spec design continues in parallel in PM chat (~10–12 message rounds).

**Gate to Phase 3:** Phase 2 ships in full (all five chunks merged to production) before Phase 3 begins.

---

## Phase 3 — AI Narrative Persistence foundation refactors

The two priority refactors from `AI_NARRATIVE_PERSISTENCE.md`. Each unblocks multiple deferred items.

**Refactor 3.1 — Unified standing-scalar abstraction.**

Pattern A in `AI_NARRATIVE_PERSISTENCE.md`. Today: companion loyalty, faction standing, Mythic piety, NPC disposition, DM Mode bond-shifts all repeat the same shape with different schemas. Drow Lolth standing has zero footprint despite being designed.

Build: a single mechanism for "scalar + label + audit trail" relationships. Existing systems migrate to it incrementally. Net: Lolth, Aasimar arc gating, Folk Hero fame, Urchin network, faction-NPC standing parity all become trivially addable. Without it, each is a new bespoke schema.

Sequencing: design-doc the abstraction, then migrate companion loyalty as the first port (lowest risk, well-understood shape), then faction standing, then Mythic piety. DM Mode bond-shifts ports last (JSON-blob storage shape is more invasive to extract).

**Refactor 3.2 — Unified marker → state pipeline.**

The "trigger, not activate" / ambient-pattern-matching shape. Today: five reviewed systems, five different implementations (companion event-bus regex, prelude marker regex, DM Mode marker regex, Themes implicit prompt-only, Party Synergies absent). Code's audit confirms these are not unified.

Build: a single pipeline where AI emits markers, server detects via shared infrastructure, effect applied via system-specific handler. New systems plug into the pipeline rather than reinventing.

Sequencing: design-doc the pipeline, port DM Mode markers first (cleanest existing implementation), then Prelude markers, then companion threads. Party Synergies markers get added in Phase 5 as part of the Party Synergies revival.

**What Phase 3 explicitly does NOT do:**
- Doesn't build Pattern F class features (Keeper Eidetic Memory, Sage L5 lore queries) — those need playing-mode evidence to design correctly. Parking lot.
- Doesn't fix the AI shelter-behavior — that's Phase 4.
- Doesn't fix Party Synergies AI integration — that's Phase 5, and it lands on the marker pipeline.

**Phase 3 deliverables:**
- Standing-scalar abstraction module + migration plan
- Marker pipeline module + migration plan
- Documentation updates to `AI_NARRATIVE_PERSISTENCE.md` reflecting which patterns the new abstractions cover
- DECISION_LOG entries per significant architectural call

**Gate to Phase 4:** Phase 3 ships in full before Phase 4 begins. Strict sequencing.

---

## Phase 4 — AI behavior diagnostic

The Prelude/Companions/Themes/DM-Mode shelter-and-shape concern. Three reviews flagged the same pattern: the AI shelters or smooths content when it should not. DM Mode's prompt has the most explicit and best-handled counter-mechanisms.

**Diagnostic question:** Does prompt engineering alone fix the shelter-behavior, or does it need structural support (e.g., explicit emission requirements tied to detected absences)?

**Why Phase 4 before Phase 5:** All three Phase 5 candidate focus areas (Prelude AI behavior, Companions wound representation, Themes AI integration) share the diagnostic. One investigation feeds three execution paths. Picking a focus area before running the diagnostic risks committing to whichever is most visible rather than whichever has the highest leverage.

**Method:**
- Identify a real-session sample where shelter-behavior occurred (the user's Prelude playtests are the natural source)
- Trace cause: prompt deficit, missing emission requirement, model behavior, or interaction
- Test prompt-only fixes against the same scenario via the existing A/B harness
- Document findings; surface structural recommendations if prompt-only fixes prove insufficient

**Phase 4 deliverables:**
- Diagnostic report covering all four systems (Prelude, Companions, Themes, DM Mode)
- Prompt updates that pass the diagnostic, where prompt-only fixes work
- DECISION_LOG entries identifying any system where structural fixes are needed (those become Phase 5 items)
- Re-evaluation of Phase 5 focus area selection based on findings

**Gate to Phase 5:** Phase 4 ships in full before Phase 5 begins. Phase 5 focus area selected at this gate.

---

## Phase 5 — Focus-area execution

Selection deferred to end-of-Phase-4. Three candidates as of 2026-04-29:

**Candidate A — Prelude AI behavior (post-diagnostic structural fixes).** If Phase 4 surfaces structural needs in the Prelude (beyond the locked tone description), this is where they ship. Includes any further marker-pipeline use (now Phase 3 has built the abstraction).

**Candidate B — Companions wound representation.** The wound system is designed but not integrated into companion behavior surfaces. Ports onto the standing-scalar abstraction (Phase 3); needs design pass on what wound types affect what behavior surfaces.

**Candidate C — Themes AI integration.** 84 ability surfaces exist as content but lack AI-trigger specs (per `THEMES_REVIEW.md`). Each ability needs prompt-side machinery for the AI to actually invoke it during play.

**Selection process at end-of-Phase-4:**
- Phase 4 diagnostic findings inform which area has the most leverage
- User chooses; PM drafts the Phase 5 plan
- DECISION_LOG entry committing the choice and the rationale

**Gate to Phase 6:** Phase 5 ships before Phase 6.

---

## Phase 6 — DM Mode dedicated pass

DM Mode warrants its own phase to ensure deferred work in it is done right rather than handled in passing.

**In scope:**
- `[PARTY_ARGUMENT]` implementation (detector + handler)
- Post-session relationship summary view
- Bond-shift evolution review
- Cross-party NPC memory (now easier to answer with standing-scalar abstraction in place)
- Opus toggle decision (whether DM Mode also defaults to Opus, given session length and party complexity)
- DM Mode product positioning (single-player vs. assist-existing-table framing)
- Confirmation that DM Mode patterns remain consistent with Phase 3 abstractions

**Why after Phase 5:** DM Mode benefits from landing on a codebase where its own patterns have been generalized — cross-party memory becomes easier with standing-scalar abstraction; marker handling becomes uniform with the marker pipeline.

**Gate to Phase 7:** Phase 6 ships before Phase 7.

---

## Phase 7 — Playing mode

The transition from build-mode to play-mode. Several deferred systems become evaluable only when there's a real long-running character to play.

**Becomes evaluable in playing mode:**
- Living biography UI integration (the schema landed in Phase 2; UI design is informed by what biography entries actually look like in play)
- Mythic content gaps (per `MYTHIC_REVIEW.md` parking notes)
- Pattern F class features (Keeper Eidetic Memory, Sage L5 lore queries)
- "Path Less Walked" cross-pick ancestry feat decision (build or formally retire based on lived evidence)
- Non-formative memorable scenes (PRELUDE Decision 5 carried this question forward)
- Asymmetric NPC memory model (PRELUDE Decision 6 part 2; gates on Phase 3 standing-scalar abstraction)

**Project owner's stated bias:** longer build time is acceptable; playing mode eventually replaces building mode, but not yet.

---

## Parking lot

Items intentionally not slotted into any phase, awaiting evidence or scope clarification.

- **Mythic content gaps.** Framework + content + markers + prompt injection all wired. Strategic question shifts from "build" to "fill gaps and playtest." Re-evaluate at Phase 7.
- **Themes content depth.** 84 abilities exist; AI-trigger specs missing per ability. One of three Phase 5 candidates.
- **Party Synergies revival.** `partySynergy.js` imported nowhere; system invisible to AI today. Sequenced contingent on marker pipeline (Phase 3).
- **Multi-tone selection return.** Parked for v2.0.0+. The 16-tag system or successor returns when MVP is shipping clean.
- **Production decisions: Opus vs. Sonnet default; Lean Prompt retire.** Awaiting real-session validation. See PROJECT_TODO Blocked section.
- **Heirloom handoff producer.** `prelude_canon_heirlooms` table and consumer-side empty-state shipped in Phase 2 chunk 5.A (v1.0.109). Producer-side wiring (mechanism choice between play-time `[OBJECT_HINT]` marker, post-Prelude extraction, or hybrid) is its own scoped piece of design work. Reactivate when the user wants Prelude-derived heirloom candidates. Manual-mode heirloom flow unaffected.
- **Deity worship-contract content authoring.** Phase 2 ships with deity selection at Step 7 surfacing alignment chip + 1-line description from `deities.json`. Deeper content — what each deity expects from worshippers, how worshipper-deity alignment relationship works, deity-specific piety thresholds and consequences — is its own scoped content authoring pass. Not creator-blocking. Reactivate when piety mechanics surface in primary campaign play, or when the user wants deity selection at Step 7 to carry more weight. Scope: 53 deities × ~150-250 words each. Don't deviate from the existing `deities.json` shape; the data file holds today's content fine.
- **Soldier (and others) alignment-coverage gap-fills.** Spec §8.6 acknowledged §7.4 (Bonds) had no `CG` / `CE` entries. Playtest review on 2026-05-02 confirmed Soldier theme also missing Chaotic options across Ideals and Flaws. Coverage matrix lives at `triage/alignment-coverage-matrix.md` (re-run via `node tests/coverage-matrix.js` after authoring). Authoring is a PM pass — voice was held intentionally across 431 prompts; gap-fills come from PM, not Code. Code transcribes when content arrives. Principle: not every empty cell needs filling — fill where roleplay-believable coverage is genuinely absent, leave intentional empty cells empty.
- **CharacterCreatorV2 "edit existing character" surface.** New CharacterCreatorV2 (Phase 2 chunk 5) only handles character creation, not editing. CharacterSheet's "Edit in Wizard" button still routes to the deprecated `CharacterCreationWizard.jsx` via the legacy `editCharacterInWizard` flow. Once the new creator grows an edit surface (read existing character, populate creator state, allow re-submit), the wizard can be deleted along with `CharacterManager.jsx`. Scope: ~half-day client work — primarily reusing `rehydrateManualCreatorState` plus an "edit mode" flag on CharacterCreatorV2 that branches Step 8 submit to PUT-only (no creation_phase flip).
- **Campaign-id linkage on transferred canon NPCs/locations.** `campaignCanonTransferService` (Phase 2 chunk 5 sub-checkpoint 5.L.4) copies `prelude_canon_npcs / locations / threads` into the campaign-side tables on handoff submit, with `campaign_id = NULL`. When the player later creates or assigns a campaign to that character (via the existing `/api/campaign/:id/assign-character` endpoint), the orphaned rows need to be linked: a follow-up that updates `npcs.campaign_id` / `locations.campaign_id` / `campaign_threads.campaign_id` for any rows tagged with the prelude-source markers (`[prelude_canon_npc#NN]` in `background_notes` / `[prelude_canon_location#NN]` in `description` / `source = 'prelude'` for threads). Until this lands, the canon NPCs/locations are preserved-but-unlinked — they exist in the active tables but won't appear in campaign-scoped queries. Not data loss; just no campaign binding. Scope: small server work in `assignCharacterToCampaign` or a dedicated `linkPreludeCanonToCampaign(characterId, campaignId)` helper.
- **Delete deprecated creator + manager files.** `CharacterCreationWizard.jsx` and `CharacterManager.jsx` are hidden but still in the repo per CLAUDE.md "deprecate by hiding nav, not deleting code" (CharacterManager only renders when `showCreationForm` is true, which is the edit-existing-character path). After 2-3 playtest cycles confirm no regressions in the new creator AND the edit-existing migration above lands, both files can be deleted as a small repo-hygiene commit.

---

## Operational

- This doc supersedes PM_TODO's queue. PM_TODO retired at Phase 0 close.
- PROJECT_TODO continues per its existing role (active/blocked/parked, per session).
- DECISION_LOG entries get written by PM as decisions land. User pastes.
- Phase boundaries are sequencing gates, not calendar gates. No deadlines implied.
- Re-evaluation point: end of Phase 4 diagnostic. Findings may reshape Phase 5 commitment and parking-lot priorities.
- Doc kept synchronized with PROJECT_TODO at phase boundaries; minor updates in-phase as decisions land.