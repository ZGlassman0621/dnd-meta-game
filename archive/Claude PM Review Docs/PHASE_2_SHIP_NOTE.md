# Phase 2 — Ship Note for PM

Single-pass status snapshot before Phase 3 spec authoring. Three things PM should sign off (or push back on) before we move forward.

**Status:** Phase 2 chunk 5 shipped at v1.0.114 (2026-05-02); v1.0.115 today patched two follow-up bugs (server POST defaults, Prelude path wiring in HomeFlow). Code is structurally complete; no end-to-end smoke run by a real user yet.

---

## 1. What shipped in Chunk 5

Chunk 5 is the rebuild of the character creator + new home page + Screen 2 path choice. Everything below is live in the v1.0.115 build.

**Frontend (`client/src/components/creator/`):**
- 8-step `CharacterCreatorV2` (manual + handoff modes), shell + persistence + scroll-to-top + save-before-advance
- 8 step components (Identity / Ancestry / Theme / Class&Calling / AbilityScores / Equipment / IdentityDetails / Review)
- Shared primitives: `creatorPrimitives.jsx`, `CelebrationCard`, `BumpCelebrationCard`, `AlignmentChip`, `ExpansionSection`, `PromptList`, `MomentList`, `RaceAwareDimensionPicker`
- `equipmentResolver.js` — equipment.json lookup, proficiency-gating, pack expansion
- `creatorPersistence.js` — `submitCreator` + `saveProgress` + two rehydration helpers (manual / handoff)
- `HomeScreenV2` — single-section roster grid with three card states (active / draft / Prelude·step-forward) plus Diablo-4 "Create New Character" entry; v1.0.115 added a fourth state (`prelude` mid-arc) for in-flight prelude characters
- `PathChoiceScreen` — Prelude / Campaign two-card screen
- `HomeFlow` — wraps the above; routes home → path → wizard / prelude.setup → prelude.arc → prelude.session; hands active-character clicks back to App.jsx
- Editorial aesthetic (EB Garamond + Inter + JetBrains Mono) scoped under `.creator-v2`; locked as project default per Decision 6

**Content data (`client/src/data/`):**
- 6 PM-authored content files (~620 entries): theme gold modifiers (21), personality prompts (63), ideals prompts (~136), bonds prompts (~126), flaws prompts (~106), backstory moments (168)
- 19 narrative-continuity copy lines for Step 4 handoff card
- `raceDemographics.js` — PHB-derived age/height/weight ranges with dual-unit display

**Server-side:**
- Migration 049 — `prelude_canon_heirlooms` table; documents new `creation_phase` value `'creating'`
- Migration 050 — `physical_build` column on characters
- `server/routes/character.js` POST accepts `creation_phase` param; PUT detects `'ready_for_primary' → 'active'` transition and runs heirloom flip + canon transfer
- `campaignCanonTransferService.js` — copies prelude_canon_npcs/locations/threads into npcs/locations/campaign_threads with idempotency markers
- `preludeTransitionService.js` — payload contract reshape to schema_version 2 flat shape (§8.2.1); old wrappers no longer emitted
- v1.0.115 patch: every POST `/api/character` field now defaults to `null`/scalar (was throwing `TypeError: Unsupported type of value` on partial-save bodies)
- v1.0.115 patch: Prelude path in HomeFlow wired to real `PreludeSetupWizard` → `PreludeArcPreview` → `PreludeSession` (was a `window.alert` stub)

**App-level cutover:**
- `App.jsx` early-returns `<HomeFlow>` when no character is selected; legacy `CharacterManager` only renders when `showCreationForm` is true (CharacterSheet's "Edit in Wizard" affordance)
- "← Your characters" button at top of dashboard chrome to return to HomeFlow

**Tests:**
- `tests/migration-049.test.js`, `migration-050.test.js`, `payload-contract.test.js`, `theme-content-data.test.js`, `creator-server-persistence.test.js`, `canon-transfer.test.js`, `coverage-matrix.js`
- `triage/alignment-coverage-matrix.md` — generated coverage map (43% of cells filled, 241/567)

---

## 2. Spec deviations — needs PM sign-off

Four annotations were added inline to `PHASE_2_CREATOR_SPEC.md`. Each needs a PM call: **accept as-is** or **file as tech debt to revisit**.

### 🟡 §5.2.5 — Step 2 (Ancestry) reorder

**Spec said:** opening line → race → beats → feat
**Shipped:** opening line → beats → **feat (the outcome the beats causally justify)** → race line as quieter confirmation below

**Why:** `[ANCESTRY_HINT]` markers explain why this *feat* emerged; race was committed at setup-wizard time and didn't move during the Prelude. Parenting the beats under the feat is more honest about what the marker semantics actually justify.

**PM call:** Accept the reorder, or revisit?

### 🟢 §5.7.3 — Step 7 expansions default state

**Spec said:** expansions default OPEN in handoff mode (so biography seed is exposed)
**Shipped:** expansions default CLOSED in BOTH modes with chevron marker

**Why:** open-by-default visually crowded Step 7's required-fields section and made the page noisy at first paint. Biography seed still renders read-only at the top of the Backstory expansion when opened.

**PM status:** This was PM-signed in-context during the v1.0.112 review round. Listed here for completeness; no new ask. Confirm if memory serves and we can stop calling it a deviation.

### 🟡 §5.6.3 + §8.1.2 — Heirloom producer deferred (single decision)

**Spec said:** `prelude_canon_heirlooms` table with both producer (Prelude play surfaces heirloom candidates) and consumer (handoff Step 6 picker)
**Shipped:** table + consumer-side empty-state ship clean. **No producer exists** — chunks 1–4 did not implement an `[OBJECT_HINT]` marker, and the v4 plan §5d does not enumerate one. Until the producer lands, every Prelude completes with zero candidates and Step 6 falls back cleanly to manual-mode opt-in.

**Why deferred:** mechanism choice is open (play-time `[OBJECT_HINT]` marker, post-Prelude extraction pass, or hybrid) and worth deciding on its own merits, not under chunk 5 scope pressure.

**PM call:** Accept producer-deferred, or pull producer wiring into Phase 3?

---

## 3. Parking-lot items — needs PM scope call

Four items in `CONSOLIDATED_TODO.md` flagged as "reactivate when…" — none are Phase-3-blocking. PM should decide which (if any) get pulled into Phase 3 scope vs. stay deferred.

| Item | Default disposition | Trigger to reactivate |
|------|---------------------|----------------------|
| 🟡 Heirloom handoff producer | Deferred | When user wants Prelude-derived heirloom candidates surfacing in handoff |
| 🟡 Deity worship-contract content (53 deities × 150–250 words) | Deferred | When piety mechanics surface in primary campaign play, or when deity selection at Step 7 should carry more weight |
| 🟡 CharacterCreatorV2 "edit existing character" surface | Deferred (currently routes to legacy CharacterManager) | Half-day of work; reactivate when editing-via-V2 becomes a felt gap |
| 🟢 Delete deprecated files (`CharacterCreationWizard.jsx`, `CharacterManager.jsx`) | Retained for 2–3 playtest cycles | Delete when stable per "deprecate by hiding nav" discipline |

---

## 4. What we don't know yet

**Smoke validation gap.** No real-user end-to-end run through either path since the v1.0.114 cutover. Today's two bugs (server POST `undefined` + Prelude alert stub) are the first signals back from actual use. My honest read: 2–4 more small bugs likely to surface on first full play-through. Not a Phase 3 blocker — Phase 3 work won't touch the creator surfaces — but worth flagging.

**Recommendation:** PM-decide whether a smoke-run is a Phase 3 entry gate or whether bugfixes roll in alongside Phase 3 work as they surface.

---

## What I'm asking PM to do with this doc

1. Sign off (or push back on) the §5.2.5 reorder
2. Confirm §5.7.3 was your in-context call (so I can stop tagging it as a deviation)
3. Decide §5.6.3 + §8.1.2: producer stays deferred, or pulls into Phase 3?
4. Decide each of the four parking-lot items: stays deferred, or pulls into Phase 3?
5. Decide whether smoke validation is a Phase 3 entry gate

Once those five calls are made, Phase 3 has a clean baseline.
