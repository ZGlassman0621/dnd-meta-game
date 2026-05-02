# Phase 2 — Character Creator Spec

**Version:** 1.0 (draft for design + engineering handoff)
**Status:** Locked design — content authoring complete — handed to Claude Design for mockup, then Claude Code for Chunk 5 implementation.
**Supersedes:** The existing `CharacterCreationWizard.jsx` flow (full rebuild — see Phase 2 Pre-Engineering Decision B).
**Companion docs:** [`PRELUDE_IMPLEMENTATION_PLAN.md`](PRELUDE_IMPLEMENTATION_PLAN.md) v4 (the design contract this spec implements §6 of); [`DECISION_LOG.md`](DECISION_LOG.md) (Phase 1 Decisions 1–6 plus Phase 2 Pre-Engineering Decisions A–E).

---

## 1. Overview

### 1.1 Purpose & audience

This spec defines a rebuilt 8-step character creator that serves as the convergence point for two co-equal entry paths into the primary campaign: **manual creation** (player authors freely from blank fields) and **handoff from a completed Prelude** (creator pre-fills from Prelude payload, with field-level treatment ranging from locked-with-celebration to fully editable).

Two readers, two passes:

- **Claude Design reads first.** This spec asks Design to produce a hi-fi mockup of the home page, Screen 2 (path choice), and the eight creator steps. Visual language, motion, micro-interaction patterns, and component-level treatment are Design's decisions to make. Field order, mode-shape rules, and player-facing copy are not — those are locked here.
- **Claude Code reads second.** Once Design's mockup is approved, this spec is the engineering brief for Chunk 5 of Phase 2 (main creator integration). Engineering notes are consolidated in §8 with pointers throughout the per-step sections.

### 1.2 Scope & non-scope

**In scope for Phase 2 (this spec):**

- A complete 8-step creator with two co-equal mode shapes (manual / handoff)
- A redesigned home page (single page, both first-time and returning players)
- A new Screen 2 path-choice screen between home and creator entry
- Pre-fill payload contract from the Prelude transition service
- A `creation_phase` enum expansion: existing `'active'` retained; `'ready_for_primary'` added for Prelude-played, creator-unfinished characters; `'creating'` added for manual-mode mid-creator-flow characters
- 21 starting-gold-modifier values (per theme)
- 252 personality / ideals / bonds / flaws prompts (3 per field × 4 fields × 21 themes)
- ~170 curated backstory moments (~8 per theme × 21 themes)
- All player-facing copy across home, Screen 2, and the eight steps

**Out of scope for Phase 2 (deferred):**

- Avatar / character portrait
- Multiclassing at creation
- Path picker for Knight of the Order in manual mode (path defaults to `'true'` and shifts at runtime through play)
- Earned-name marker / `[NAME_EARNED]` (deferred to a follow-on phase; the use-name affordance described in §5.1.5 captures the same player intent at creation time without the runtime mechanism)
- Heirloom awakening mechanism (the `awakening_hook` field is captured at creation and persisted; the mechanism that ripens an heirloom is post-MVP)
- Physical description pre-fill from Prelude narration (player fills fresh in Step 7 even in handoff mode)
- Theme starting equipment (themes don't carry equipment in `themes.js` — confirmed)
- Stat cap raise above 20 (deferred to Mythic-tier onset; lifetime cap eventually becomes 22 — that's its own future work item; Phase 2 uses standard 5e math, L1 cap 18, lifetime cap 20)

### 1.3 Relationship to the Prelude implementation plan

This spec is the implementation expansion of [`PRELUDE_IMPLEMENTATION_PLAN.md`](PRELUDE_IMPLEMENTATION_PLAN.md) §6 ("Transition flow — Prelude → main creator"). The plan's §6 names the field-level pre-fill matrix; this spec turns that matrix into a concrete eight-step UI with player-facing copy, validation, and engineering contracts.

The Prelude plan is the canonical source for: emergence semantics, marker behavior, biography seed generation, canon NPC / location / thread persistence, mentor imprint seeding. This spec defers to it on those subjects and references its sections directly where they intersect creator behavior.

### 1.4 Definitions

The following terms appear throughout this spec.

**Manual mode.** The creator entered when the player picks "Create a Campaign Character" on Screen 2. All fields begin blank or at sensible defaults; the player authors freely. No Prelude payload exists.

**Handoff mode.** The creator entered when a Prelude-played character reaches `[PRELUDE_END]` and the transition service flips `creation_phase` to `'ready_for_primary'`. The creator pre-fills from the Prelude payload (committed theme, race / subrace, gender, name, ancestry feat, biography seed, canon NPCs / locations / threads, emergence stat / skill bumps, class hint tally, ancestry hint tally, heirloom candidates).

**Field treatment** — three states a field can be in, varying by step and by mode:

- **Locked** — field is read-only. The value comes from the Prelude payload and the player can't change it within the creator. Locked fields are never silent: they appear with a celebration card or in-fiction framing that explains *what* committed and *why* it committed.
- **Locked-with-celebration** — same as locked, but with explicit "the years that shaped you produced this" framing. Used for fields where the Prelude *did the work* and the celebration is honoring that.
- **Suggested-but-editable** — the field comes pre-filled with a Prelude-derived suggestion, but the dropdown / picker is fully active and the player can change it. Used for class (which doesn't commit during the Prelude — the suggestion is the chapter-weighted `[CLASS_HINT]` tally winner).
- **Fully editable** — field is treated identically in handoff mode and manual mode. Used for ability score generation, skills (when not class- or background-locked), alignment, faith, lifestyle, physical description, and the optional Step 7 expansions. In handoff mode these are pre-filled from biography seed where applicable; in manual mode they begin blank.

**Use-name affordance.** A handoff-mode-only Step 1 widget that fires when the Prelude payload's `name` differs from the setup wizard's original `setup_name` (because the player typed a different name into a `[USE_NAME]` moment during play). It surfaces both names and asks the player which one they want to carry forward.

**Celebration card.** A handoff-mode UI block that appears above an otherwise-locked field. Lists 2–3 chapter beats (drawn from the relevant `[*_HINT].reason` markers, top-weighted, ordered chronologically) and the locked outcome. Pattern is consistent across Step 2 (ancestry / ancestry feat), Step 3 (theme), and Step 5 (stat bumps). The bump celebration card is the only celebration card with player input — it carries dropdowns for the player to assign each bump to a stat.

**Narrative-continuity copy.** A handoff-mode-only Step 4 panel that sits *above* the class dropdown. Bespoke per-theme copy honoring the theme's identity and inviting the class choice. The dropdown itself stays free; the copy frames what the character has done into the question of how they'll act now.

### 1.5 Voice direction

The previous PM chat audited all draft copy and removed meta language ("your character" / "the DM" / "your Prelude" / "in play"). This pattern carries forward across all newly authored content in §7.

**Rules of thumb:**

1. Address the character as "you," not "your character." Second person puts the player inside the fiction. The system is talking *to* the character, not *about* them.
2. Replace meta references ("the DM" / "the AI" / "the system") with neutral verbs or in-fiction phrasings. *"The story may give you a use-name"* instead of *"the DM will."*
3. Replace "your Prelude" with in-fiction time-references. *"The years behind you"* / *"the years that shaped you"* / *"in the years that shaped you"* — past-tense narration of the character's life, not the player's session.
4. Mechanical terms like "stat bumps" stay in operational contexts. Where they appear in player-facing copy, frame them via in-fiction effects. *"Two moments shaped you"* instead of *"You earned two stat bumps."*
5. Wizard / setup-page copy can stay meta. The player isn't in-fiction yet; they're agreeing to enter.
6. Operational help text in pure-mechanics steps (equipment package selection, generation method, etc.) can have mild meta where in-fiction phrasing would be more contorted than helpful.
7. Pre-fiction screens (home page, Screen 2 path choice) can be operational/meta. The player chooses their path before entering the world.

**Tense:**

- **Past tense** for what shaped the character ("you've held the line," "you learned," "the wild raised you")
- **Present tense** for the character's current identity ("you are," "the discipline is in your bones")
- **Present-imperative** for the choice ahead ("now choose," "carry forward")

**Length:**

- Help text: usually one sentence; two if the field is meaty
- Celebration cards: 2–3 chapter beats + result line; total under ~50 words
- Narrative-continuity copy lines (Step 4): 2 sentences default, 3 if the theme demands it (Outlander, Hermit), 4 for the heaviest themes (Mercenary Veteran, Folk Hero, Urchin)
- Personality / ideals / bonds / flaws prompts: a single short clause or sentence each (typically 4–12 words)
- Backstory moments: a single sentence each (typically 8–18 words), past tense, the formative event compressed to its load-bearing core

---

## 2. Mode definitions

The creator is one component with two entry shapes. The same eight steps render in both modes; what differs is which fields begin filled, which are locked vs. editable, and where celebration cards appear.

### 2.1 Manual mode (Campaign Character)

**Entry:** Player clicks "Create a Campaign Character" on Screen 2.

**Initial state:** No Prelude payload. All fields begin blank or at sensible defaults (e.g., gender unselected, generation method = Standard Array as the recommended option, alignment unselected). The Step 7 optional expansions are collapsed by default.

**Behavior:**

- Player advances step-by-step through Steps 1 → 8. No step is skippable. Required fields are validated at advance; optional fields can be left empty.
- At the moment the player advances past Step 1 with valid name + gender, a character record is created at `creation_phase = 'creating'`. From there forward, every step advance, back-step, and explicit Save and exit persists the latest creator state to that record. The player can close the browser at any point after Step 1 and find their work preserved on return (see §6.2).
- The Step 6 heirloom flow opens with an opt-in prompt; if the player declines, no heirloom is created and Step 6 advances on equipment + gold alone.
- Step 7's optional expansions (personality, ideals, bonds, flaws, backstory) are surfaced as collapsed toggles. The player opens what they want, skips what they don't.
- On Step 8, the Submit action flips `creation_phase` from `'creating'` to `'active'` and links the character to a freshly-generated primary campaign with no Prelude inputs.

**Exit:** Submit on Step 8 → primary campaign opens. Save and exit at any post-Step-1 step → home page (character persists at `'creating'`). Discard at any step → confirmation dialog → home page (any partial character record deleted).

### 2.2 Handoff mode (Prelude Character)

**Entry:** Player either (a) clicks an in-progress character card on the home page (a character with `creation_phase = 'ready_for_primary'`), or (b) is auto-routed into the creator immediately after `[PRELUDE_END]` fires and the transition service runs.

**Initial state:** Pre-filled from the Prelude payload. See §2.3 for the field-level treatment matrix. Step 7's optional expansions are *expanded by default* with biography-seed pre-fill where applicable; the player confirms or edits.

**Behavior:**

- Same eight steps, same advance rules. Required-field validation still applies.
- Locked fields (race, subrace, ancestry feat, theme) display celebration cards above them honoring what shaped them. The cards explain *what* committed and *why*, drawing from the chapter-weighted `[ANCESTRY_HINT]` and `[THEME_HINT]` reasons.
- Suggested-but-editable fields (class) display narrative-continuity framing copy above the dropdown. The dropdown is pre-selected to the chapter-weighted `[CLASS_HINT]` tally winner, freely overridable.
- Stat bumps from accepted `[STAT_HINT]` markers surface in Step 5 as a bump celebration card with dropdowns to assign each bump to a stat. Bumps clamp to L1 cap 18 (per Decision E).
- Skill bumps from accepted `[SKILL_HINT]` markers display as already-picked in the Step 5 skills picker, distinguished visually from class-/background-derived skills.
- The Step 6 heirloom flow surfaces the 1–3 Prelude-derived heirloom candidates with an in-fiction "carry one forward, or leave them all behind" callout. The manual-mode authoring form is hidden in handoff mode.
- Step 7's biography seed displays read-only at the top of the step's Backstory expansion, with the affordance: *"What you see here is canonical to your campaign. To revise it later, you can edit your character's biography directly."*
- Step 8 displays the handoff-mode callout above the preview card: *"The years that shaped you are behind you now. Step forward."*

**Exit:** Submit on Step 8 → `creation_phase` flips from `'ready_for_primary'` to `'active'`, mentor imprints seed (when applicable), canon entities and threads persist into the primary campaign, and the campaign opens with the character having traveled from the Prelude's home region.

**Save / resume:** A handoff-mode character can exit the creator at any step (browser close, navigation away, explicit quit). Their progress persists at `creation_phase = 'ready_for_primary'`. They appear in the home page's character list with the in-progress card treatment (per §3.3). Clicking the in-progress card resumes the creator at the step they left, with all prior-step state restored.

### 2.3 Field-treatment matrix

For each field across the eight steps, this matrix names the treatment in manual mode (blank by default) and handoff mode (pre-filled per the source listed). Entries below the eight-step boundary live in `prelude_canon_*` tables and transfer at submit.

| Step | Field | Manual mode | Handoff mode | Source |
|---|---|---|---|---|
| 1 | Name (first / last / nickname) | Blank | Pre-filled from `prelude_setup_data.name` (split heuristically: first / last). Use-name affordance fires when `payload.name ≠ setup_name`. Editable. | Setup wizard + `[USE_NAME]` markers |
| 1 | Gender | Unselected | Pre-filled from `prelude_setup_data.gender`. Locked. | Setup wizard |
| 2 | Race | Unselected | Pre-filled. **Locked-with-celebration.** | Setup wizard |
| 2 | Subrace (when applicable) | Unselected | Pre-filled. **Locked-with-celebration.** | Setup wizard |
| 2 | Ancestry feat | Unselected | Pre-filled from chapter-weighted `[ANCESTRY_HINT]` tally winner. **Locked-with-celebration.** Sub-choices within the feat (when the feat has internal options) remain editable. | `prelude_emergences` (kind=`ancestry`) |
| 3 | Theme | Unselected | Pre-filled from `characters.prelude_committed_theme`. **Locked-with-celebration.** | Ch3 commitment beat |
| 4 | Class | Unselected | Pre-filled from chapter-weighted `[CLASS_HINT]` tally winner. **Suggested-but-editable.** Narrative-continuity copy displays above the dropdown. | `prelude_emergences` (kind=`class`) |
| 4 | Subclass (when class picks at L1) | Unselected | Not pre-filled. Fully editable. | — |
| 4 | L1 mechanical choices (cantrips, fighting styles, etc.) | Unselected | Not pre-filled. Fully editable. | — |
| 5 | Generation method | Standard Array (default) | Standard Array (default). Bump celebration card displays above. | — |
| 5 | Six ability scores | Unassigned (Standard Array) | Unassigned baseline; player assigns Standard Array values; emergence bumps layer at final calculation, clamped to L1 cap 18. | `prelude_emergences` (kind=`stat`) |
| 5 | Skills | Unselected (player picks within class + background allotment) | Class- and theme-derived skills shown as already-picked; emergence skills shown as already-picked and distinguished visually. Player picks remaining within allotment. | `prelude_emergences` (kind=`skill`) |
| 5 | Variant Human bonus feat (when race=human, subrace=variant) | Unselected | Unselected. Fully editable. | — |
| 6 | Class equipment package | Unselected | Unselected. Fully editable. | — |
| 6 | Starting gold | Calculated: class baseline × (1 + theme modifier) | Calculated: class baseline × (1 + theme modifier). Display only, no interaction. | Class baseline + per-theme modifier (§7.1) |
| 6 | Heirloom | Opt-in prompt → optional manual authoring form | 1–3 Prelude-derived candidates with in-fiction picker; player chooses one or none. | Dedicated heirloom table — schema in §8.3 |
| 7 | Alignment | Unselected | Unselected. Fully editable. | — |
| 7 | Faith | Unselected | Unselected. Fully editable. | — |
| 7 | Lifestyle | Unselected | Unselected. Fully editable. | — |
| 7 | Physical description (8 fields, all required) | Blank | Blank. Fully editable. (Pre-fill from Prelude narration deferred — see §1.2.) | — |
| 7 | Personality (optional expansion) | Collapsed by default; prompts available via §7.2 | Expanded by default; pre-filled from biography seed if available; prompts available. Editable. | Biography seed (when available) |
| 7 | Ideals (optional expansion) | Collapsed by default; prompts available via §7.3 | Expanded by default; pre-filled from biography seed if available; prompts available. Editable. | Biography seed (when available) |
| 7 | Bonds (optional expansion) | Collapsed by default; prompts available via §7.4 | Expanded by default; pre-filled from biography seed if available; prompts available. Editable. | Biography seed (when available) |
| 7 | Flaws (optional expansion) | Collapsed by default; prompts available via §7.5 | Expanded by default; pre-filled from biography seed if available; prompts available. Editable. | Biography seed (when available) |
| 7 | Backstory (optional expansion) | Collapsed by default; moments available via §7.6 | Expanded by default; biography seed displays read-only at top; backstory text editable below. | Biography seed |

**Reading the matrix.** In handoff mode, **locked-with-celebration** is the strictest treatment — the player can't override the field; the celebration card honors what the Prelude produced. **Suggested-but-editable** is one click weaker — the dropdown is pre-selected but free. **Fully editable** is identical between modes, with handoff mode's only privilege being earlier visibility of biography-seed pre-fill where applicable.

---

## 3. Home page specification

### 3.1 Layout

A single-page layout serves both first-time players (who have no characters yet) and returning players (who have one or more). No separate landing page; no separate dashboard. The list view *is* the home page.

The page has one section: **Your characters.** It always renders. It contains the "Create New Character" entry as the first item in the grid, followed by all of the player's characters in any state — `'active'` (in primary campaign), `'creating'` (manual-mode mid-creator), and `'ready_for_primary'` (Prelude played, creator unfinished) all live in the same list. Card-level visual treatment differentiates the states; the section structure does not.

No page-level tagline, headline, or framing copy. The list is the page.

### 3.2 "Create New Character" entry

The "Create New Character" entry is the first item in the grid. It is visually distinct from character cards but lives in the same container — the same grid, same card spacing — so it reads as part of the same set of selectable items.

**Pattern reference:** Diablo 4's character select. The "Create" item is the first card, recognizable as an action rather than an existing character (different visual treatment — no portrait, no name, no level — with a clear "this is where new characters begin" affordance), but lives in the same grid as the player's real characters so the act of creating feels like part of the character roster rather than a separate workflow.

### 3.3 Character cards — three states

Each character is one card. The card's visual treatment differentiates which of the three states the character is in.

**Active characters** (`creation_phase = 'active'`) — characters in their primary campaign. The card displays identifying information (name, race / subrace, theme, class / level, the campaign they're playing in). The card's primary affordance: enter the game.

**In-progress (manual)** characters (`creation_phase = 'creating'`) — characters mid-creator-flow in manual mode, who have completed at least Step 1 (so a record exists) but haven't yet completed Step 8. The card displays whatever identifying information has been filled so far (name minimum; race, theme, class shown if set). The card's primary affordance: resume creating this character.

**In-progress (Prelude handoff)** characters (`creation_phase = 'ready_for_primary'`) — characters who completed their Prelude (reached `[PRELUDE_END]`, the transition service flipped them to `'ready_for_primary'`) but have not yet completed the main creator. The card displays the same identifying information available so far (name, race / subrace, theme — these are locked at this state) plus a clear in-progress indicator. The card's primary affordance: resume creating this character.

Design has discretion over the visual treatment that distinguishes the three states (a badge, a state ribbon, a desaturated portrait area, a different border treatment, a "continue" CTA on the card itself, etc.) — what's locked here is that all three states render in the same grid and that the differentiation reads at a glance. The two in-progress states (`'creating'` and `'ready_for_primary'`) can share a visual treatment if Design judges that simpler, since both are "this character isn't fully born yet" — distinguishing manual-from-handoff is less important than distinguishing in-progress-from-active.

### 3.4 States of the home page

- **Empty (first-time player):** "Your characters" renders with "Create New Character" as the only item. The grid has one tile.
- **Populated:** "Your characters" renders with "Create New Character" first and the player's characters following. Active characters and in-progress characters (in either flavor — manual or handoff) intermix in card order (most-recently-touched first, with whatever sort treatment Design lands on).

### 3.5 Routing

| Click | Destination |
|---|---|
| "Create New Character" | Screen 2 (path choice) |
| Active character card | That character's main game screen |
| In-progress (manual) character card | Resume the manual creator at the last step the player reached |
| In-progress (Prelude handoff) character card | Resume the creator in handoff mode for that character (at the last step they reached, or Step 1 if the creator was never opened post-Prelude) |

---

## 4. Screen 2 — Path choice

### 4.1 Purpose

Screen 2 sits between the home page and the creator. It exists because there are two co-equal entry paths (manual / Prelude-handoff) that produce different experiences and different mechanical outcomes. The player needs to make this choice deliberately, with enough information to choose correctly.

### 4.2 Layout

A simple two-card layout. Framing line at the top; two cards below it (Prelude card on the left, Campaign card on the right, or stacked on narrower viewports). A back affordance returns to the home page.

The two cards are visually equivalent in weight — same size, same hierarchy. Neither is "the recommended" path. The framing line and card body copy together convey what's gained and lost in each choice; the player decides.

### 4.3 Framing line at top

> *Your character will be played across years of their life. Choose how to bring them into the world:*

### 4.4 Card 1 — Create a Prelude Character

**Card title:** *Create a Prelude Character*

**Body:**

> *Play through your character's formative years before you reach the campaign. Four sessions follow them from childhood to the threshold of adulthood, where decisions you make in fiction shape who they become — their class, their theme, their heritage gift, and the moments their stats grew sharper. By the time the road begins, the character is already someone with history.*
>
> *The Prelude takes longer to play than building a character directly. In return, your character earns small mechanical advantages: stat bumps from formative moments, a meaningful object or two carried into adventure, established places and people from their past that can return in the campaign. These are the gameplay bonuses of having actually lived your character before playing them.*

### 4.5 Card 2 — Create a Campaign Character

**Card title:** *Create a Campaign Character*

**Body:**

> *Build your character directly. Eight steps to a complete person — name, ancestry, calling, abilities, gear — ready to step into their first adventure. You author whatever depth your character has: as much or as little personality, history, and detail as you want.*
>
> *This path is faster than the Prelude. Your character begins the campaign without the small mechanical advantages a Prelude character earns, and without the established past that emerges from played fiction. They begin as a complete person on their own terms.*

### 4.6 Routing

| Click | Destination |
|---|---|
| Card 1 (Prelude) | The Prelude setup wizard (out of this spec's scope; lives in the Prelude system) |
| Card 2 (Campaign) | Step 1 of the manual creator |
| Back | Home page |

### 4.7 Voice notes

This is a pre-fiction screen — the player hasn't entered the world yet. Per voice rule 7, operational/meta language is acceptable here. The drafted body copy mixes operational framing ("Eight steps to a complete person") with light in-fiction tone ("by the time the road begins, the character is already someone with history"). Design should preserve this register.

---

## 5. Per-step specification

Each of the eight steps is specified in its own subsection using a consistent template:

- **Purpose** — what this step accomplishes for the player and what it commits to the character record.
- **Manual-mode shape** — what the player sees when they enter the step with no Prelude payload.
- **Handoff-mode shape** — what's different in handoff mode (deltas from manual, not a full restatement).
- **Fields** — explicit list with required / optional / validation / defaults.
- **Authored copy** — every help text, callout, celebration card, and inline string the step renders. All copy is verbatim from the drafted-content file unless explicitly noted as new in this spec.
- **Edge cases & engineering notes** — surfaced for Code, including any open PM calls.

### 5.1 Step 1 — Identity

#### 5.1.1 Purpose

Establish the character's name and gender. These are the two anchors the rest of the creator references in copy ("she'd held the line" / "he'd held the line" / "they'd held the line"). Step 1 is intentionally light — minimum input, maximum clarity — so the player gets into the deeper choices fast.

#### 5.1.2 Manual-mode shape

Three name fields (First / Last / Nickname) and a gender selector. The player types their name; nothing is pre-filled. Last name accepts blank. Nickname is optional.

#### 5.1.3 Handoff-mode shape

Name fields pre-fill from `prelude_setup_data.name`, split heuristically on whitespace into First / Last (single-word names → First only, Last blank). Gender pre-fills from `prelude_setup_data.gender` and is locked.

If the Prelude payload's effective name (the one used in late Prelude sessions) differs from the original `setup_name` — typically because the player engaged a `[USE_NAME]` moment in fiction and committed to a different name for the character — the **use-name affordance** fires above the name fields before they render normally. The player resolves the affordance, then sees the standard name fields populated with their resolution.

#### 5.1.4 Fields

| Field | Type | Required | Default | Validation |
|---|---|---|---|---|
| First name | Text | Yes | Blank (manual) / pre-filled (handoff) | Non-empty; max 64 chars |
| Last name | Text | No | Blank | Max 64 chars; can be empty |
| Nickname | Text | No | Blank | Max 32 chars; can be empty |
| Gender | Select | Yes | Unselected (manual) / locked (handoff) | One of: Female, Male |

#### 5.1.5 Authored copy

**Help text below name fields:**

> *Some peoples don't use family surnames. Leave Last name blank if that fits. Nickname is optional and only shown in informal contexts.*

**Help text below nickname (specifically):**

> *If you have one — what people call you informally.*

**Help text below gender:** None. Two options (Female / Male) are self-explanatory.

**Use-name affordance (handoff mode, when `payload.name ≠ setup_name`):**

> ***[setup_name]*** *was the name you began with. Through what you did, you came to be known as **[use_name]**. How does [she/he/they] carry forward?*
>
> [Keep "[use_name]"] [Revert to "[setup_name]"] [Write something new]

Pronoun chosen from gender field; "they" if gender hasn't been selected yet (defensive — shouldn't happen in handoff since gender is locked, but covers edge cases).

The three resolutions:
- **Keep "[use_name]"** → name fields populate with `use_name` (split into First / Last per the same heuristic as the default pre-fill).
- **Revert to "[setup_name]"** → name fields populate with `setup_name`.
- **Write something new** → name fields render blank for the player to author from scratch.

After the player picks one, the affordance dismisses and Step 1 renders normally.

#### 5.1.6 Edge cases & engineering notes

- **First-name validation in handoff mode.** If the Prelude payload's name is somehow blank (data corruption, edge case in setup), fall back to manual-mode behavior — render blank fields and require input.
- **Use-name affordance trigger logic.** The trigger is `payload.name !== setup_name` after both are stripped of leading/trailing whitespace and case-normalized. Simple equality check — no fuzzy matching.
- **Earned-name marker is out of scope.** Per §1.2, `[NAME_EARNED]` is deferred. The use-name affordance is the in-creator mechanism that captures the same player intent (committing to a name that emerged through play). Future work may add a runtime mechanism that lets the name shift again later.
- **Gender lock in handoff mode.** Per the v4 plan, gender is captured at setup and not subject to in-Prelude change. Hard lock with no override is correct.

### 5.2 Step 2 — Ancestry

#### 5.2.1 Purpose

Commit to the character's race, subrace (when applicable), and ancestry feat — the heritage gift carried from lineage. In handoff mode this is the first step where a celebration card honors what the years did. In manual mode it's a clean three-pick flow.

#### 5.2.2 Manual-mode shape

Race dropdown, subrace dropdown (renders only when the chosen race has subraces), and ancestry feat picker (filtered to feats valid for the chosen race / subrace combination). All three fields are required to advance.

#### 5.2.3 Handoff-mode shape

Race and subrace are **locked-with-celebration** — they came from the setup wizard and cannot change. The ancestry feat is **locked-with-celebration**, populated from the chapter-weighted `[ANCESTRY_HINT]` tally winner. A celebration card sits above the locked fields, naming the chapter beats that produced this ancestry feat and the feat itself.

If the chosen ancestry feat has internal sub-choices (some feats let the player pick a specific element — a damage type, a language, a skill, etc.), those sub-choices remain editable in handoff mode. Only the feat *itself* is locked; its sub-choices stay free per Phase 1 Decision α.

#### 5.2.4 Fields

| Field | Type | Required | Default | Validation |
|---|---|---|---|---|
| Race | Select | Yes | Unselected (manual) / locked (handoff) | One of the supported races |
| Subrace | Select | Yes (when race has subraces) | Unselected (manual) / locked (handoff) | One of the chosen race's subraces |
| Ancestry feat | Select | Yes | Unselected (manual) / locked (handoff) | One of the feats valid for race / subrace |
| Ancestry feat sub-choices | Varies (select / text / multi-select per feat) | Per feat | Unselected | Per feat's schema |

#### 5.2.5 Authored copy

**Help text below race (manual mode):**

> *Your species and heritage. This shapes your starting traits, languages, and the heritage gift you carry from your lineage.*

**Help text below subrace (when shown):**

> *A subgroup within [Race] — distinct upbringing, distinct gifts.*

**Help text below ancestry feat (manual mode):**

> *A heritage gift — a small mechanical advantage that comes with your lineage. Choose one.*

**Celebration card template (handoff mode):**

> *In the years that shaped you, you:*
> - *[chapter beat 1, one sentence with chapter reference]*
> - *[chapter beat 2, one sentence with chapter reference]*
> - *[optional chapter beat 3]*
>
> *You are **[Race, with subrace if applicable]**.*
>
> *Your heritage gift: **[Ancestry Feat Name]** — [feat one-line description].*
>
> *[Sub-choice picker if applicable]*

Chapter beats from `[ANCESTRY_HINT].reason` markers — top 2-3 by chapter weight (Ch1×1, Ch2×1.5, Ch3×2 per v4 plan §5e), ordered chronologically (Ch1 → Ch2 → Ch3).

#### 5.2.6 Edge cases & engineering notes

- **Race / subrace handoff with no ancestry hint history.** If a Prelude character somehow has zero accepted `[ANCESTRY_HINT]` markers (edge case — the Prelude is supposed to surface ancestry hints), the celebration card displays the locked race / subrace but falls back to "Your heritage gift: choose one below" with the picker active. This is a defensive path; the expected case is at least one accepted hint.
- **Sub-choice editing post-handoff.** When a feat with sub-choices is locked in handoff mode, the picker for the sub-choice renders below the celebration card with manual-mode help text shape. The lock is on which feat, not on which sub-element of the feat.
- **Ancestry feat list filtering.** Manual-mode pickers must filter to feats valid for the chosen race / subrace. The existing `ANCESTRY_FEATS` data file (195 feats per the Phase 0 reconciliation) is the source of truth. A single feat can apply to multiple races (cross-pick); cross-pick visibility is per-feat metadata.
- **Chapter-beat string source.** The `[ANCESTRY_HINT].reason` field is short authored prose from the Prelude DM. Code surfaces them verbatim with the feat name and description appended.

### 5.3 Step 3 — Theme

#### 5.3.1 Purpose

Commit to the character's theme — the formative work, training, or trial that shaped them before they took on a class. Theme replaces 5e backgrounds in this system; it expresses what the character cares about, what they've done, and what they bring forward. Step 3 is single-pick.

#### 5.3.2 Manual-mode shape

A single theme dropdown listing all 21 themes. The selected theme's full description renders below the dropdown (theme card preview from `themes.js`). Knight of the Order receives an additional path-explanation paragraph below its standard description (see §5.3.5). Haunted One receives no special treatment in manual mode beyond its standard description.

#### 5.3.3 Handoff-mode shape

The theme is **locked-with-celebration** — it committed during the Ch3 commitment beat and cannot change. A celebration card sits above the locked field, naming the chapter beats that produced the theme commitment.

Two themes can never arrive via handoff: **knight_of_the_order** and **haunted_one**, per Decision D (excluded from Prelude emergence). Handoff mode therefore renders the celebration card for one of 19 themes only.

#### 5.3.4 Fields

| Field | Type | Required | Default | Validation |
|---|---|---|---|---|
| Theme | Select | Yes | Unselected (manual) / locked (handoff) | One of the 21 themes (manual) / one of 19 emergence-eligible themes (handoff) |

#### 5.3.5 Authored copy

**Help text below theme dropdown (manual mode):**

> *Your lived experience — the formative work, training, or trial that shaped who you are before you take on a class. Theme expresses what you care about, what you've done, and what you bring to whatever comes next.*

**Knight of the Order path-explanation paragraph (manual mode only):**

Appears below the standard theme description when `theme = knight_of_the_order`:

> *As a Knight of the Order, your path begins true to your vows. How that path bends — whether you remain true, reform, fall, or redeem — emerges through what you do in the world.*

**Celebration card template (handoff mode, all 19 emergence-eligible themes):**

> *In the years that shaped you, you:*
> - *[chapter beat 1, one sentence with chapter reference]*
> - *[chapter beat 2, one sentence with chapter reference]*
> - *[optional chapter beat 3]*
>
> *You take up your calling: **[Theme Name]**.*

Chapter beats from `[THEME_HINT].reason` markers — top 2–3 by chapter weight, ordered chronologically. Same selection logic as the ancestry-feat celebration card.

#### 5.3.6 Edge cases & engineering notes

- **Themes excluded from Prelude (Decision D):** `knight_of_the_order` and `haunted_one`. Both are manual-mode only. The Prelude's `[THEME_HINT]` marker schema must reject these two values server-side; if the AI emits one, the server logs the violation and injects a corrective `[SYSTEM]` message back into the Prelude conversation. (This is Prelude infrastructure, not creator infrastructure — flagging here for cross-reference.)
- **Theme starting equipment confirmed nil.** Per the bootstrap, `themes.js` carries no per-theme starting equipment. Theme's mechanical effect on Step 6 is the per-theme **starting gold modifier** (§7.1), not a per-theme equipment package.
- **Theme description rendering.** The theme card preview below the dropdown should show whatever metadata `themes.js` makes canonical for the theme — identity blurb, pillar abilities, signature flavor — rather than authoring new theme descriptions in this spec. If `themes.js` data needs reshaping for the creator, surface as a Code call during Chunk 5.
- **Path Less Walked cross-pick (themes).** Out of scope for Phase 2; `themes.js` does not currently support theme cross-pick. Mentioned only because `ANCESTRY_FEATS` has an analogous concept that's parked.

### 5.4 Step 4 — Class & Calling

#### 5.4.1 Purpose

Commit to the character's class, subclass (when the class picks at L1), and any L1 mechanical choices that follow (cantrips, fighting style, expertise, draconic ancestry, etc., per class). This is the largest mechanical step in the creator. In handoff mode it's also the step where narrative continuity from the Prelude lands hardest — the years shaped a *theme*, but the class is the player's call about what to *do* with that theme going forward.

#### 5.4.2 Manual-mode shape

A class dropdown lists all supported classes. Below the dropdown, a class card preview displays the class's identity, primary stats, hit die, and proficiencies. When the player picks a class, additional UI elements render conditionally:

- **Subclass dropdown** — appears only for classes that pick subclass at L1 (Cleric, Sorcerer, Warlock — engineering will need to confirm the L1-subclass list against current rules)
- **L1 mechanical choice fields** — render per class. Cantrip selectors, fighting style picker, expertise picks, etc.

#### 5.4.3 Handoff-mode shape

The class dropdown is **suggested-but-editable** — it pre-fills with the chapter-weighted `[CLASS_HINT]` tally winner, and the player can change it freely. A **narrative-continuity copy** card sits *above* the dropdown, anchored to the committed theme. This is the only step in the creator where handoff mode adds player-facing copy that isn't a celebration of a locked field — the copy honors what the years did *to the character* and frames the class choice as the next move.

The 19 narrative-continuity copy lines (one per emergence-eligible theme) are listed in §5.4.5 below. Each ends with present-imperative framing that hands off to the dropdown beneath it.

The narrative-continuity copy card is **dismissable** — the card includes a small dismiss affordance (an "✕" or a "this doesn't fit" link) the player can click if the copy doesn't read true to their intent for the character. Once dismissed, the card stays dismissed for the remainder of the creator session. This affordance exists because most theme × class combinations work fine with the theme-anchored copy, but a few combinations (e.g., a Soldier-themed character whose player commits to a Warlock-of-the-Fiend class) can produce a tonal collision the copy can't anticipate. Trust the player to be the judge of fit; they're better at it than any rule we'd encode.

Subclass and L1 mechanical choices are **fully editable** in handoff mode — no pre-fill, no celebration. They depend on the player's class commitment, which is itself overridable. Pre-filling them would over-promise a Prelude signal that isn't really there (the Prelude tracks class affinity, not subclass affinity).

#### 5.4.4 Fields

| Field | Type | Required | Default | Validation |
|---|---|---|---|---|
| Class | Select | Yes | Unselected (manual) / pre-filled from `[CLASS_HINT]` tally (handoff) | One of the supported classes |
| Subclass | Select | When class picks subclass at L1 | Unselected | One of the chosen class's L1 subclasses |
| Cantrips | Multi-select | When class has cantrips at L1 | Unselected | Per class allotment |
| Fighting style | Select | When class picks fighting style at L1 | Unselected | Per class options |
| Other L1 picks (expertise, draconic ancestry, etc.) | Varies | Per class | Unselected | Per class schema |

#### 5.4.5 Authored copy

**Help text below class (manual mode):**

> *Your profession or training — what you do when the situation calls for action. Class shapes your abilities, growth path, and how you engage with combat, magic, and skill checks.*

**Help text below subclass (when shown):**

> *A specialization within [Class] — the particular path you've chosen, with its own abilities and flavor.*

**Narrative-continuity copy (handoff mode, 19 themes).** These bespoke lines render *above* the class dropdown. Each ends in a present-imperative framing that hands off to the dropdown beneath it. The copy lines below are verbatim from the previous chat's audit — preserved without edits.

**knight_of_the_order** and **haunted_one** are excluded from this list per Decision D — they cannot arrive via handoff and therefore have no narrative-continuity copy.

##### 1. soldier

> *You've held the line, marched in formation, taken orders and given them. The discipline is in your bones — now choose how you'll bring it to a wider fight:*

##### 2. sage

> *Years in study halls, archives, and dusty libraries have given you a mind that catalogues everything and forgets nothing. The knowledge is yours — now choose how you'll wield it:*

##### 3. criminal

> *You learned the city's underside the hard way — which doors give, which hands take, which alleys swallow people whole. The skills are sharp — now choose what to do with them:*

##### 4. acolyte

> *Years of devotion, ritual, and quiet labor in service of a faith have shaped how you move through the world. The calling is rooted — now choose how you'll answer it:*

##### 5. charlatan

> *You've worn a hundred faces and made each one believable. The art of becoming someone else is yours — now choose who you'll be when the lie has to hold:*

##### 6. entertainer

> *Stages, taverns, market squares — wherever you've performed, you've felt people lean in or turn away. You know what moves them. Now choose what you'll move them toward:*

##### 7. noble

> *Born to privilege, raised among people who command others without raising their voice. The expectation of authority is in the way you walk and speak. Now choose how you'll exercise it:*

##### 8. outlander

> *The wild raised you. You know your forest, your mountain, your steppe — its silences, its cycles, the particular way it kills the unprepared. The wilderness is yours, but only the part you call home. Now choose how you'll carry it into wider lands:*

##### 9. sailor

> *Salt in your skin, the deck under your feet, the company of people who knew that survival was shared. The sea taught you what it taught — now choose what you'll do on land:*

##### 10. far_traveler

> *You came from somewhere far away, and everywhere you go you're an outsider — but an outsider sees what locals miss. You carry a wider world inside you. Now choose how you'll use what you see:*

##### 11. guild_artisan

> *You served apprenticeship under a master, learned a craft to a standard the guild would accept, and earned the right to call yourself a maker. The trade is yours, the network is yours. Now choose how you'll take both into the wider world:*

##### 12. clan_crafter

> *Your craft was taught not by a guild but by your kin — passed from hand to hand, generation to generation, in patterns older than any city's commerce. The work is heritage. Now choose how you'll carry the line:*

##### 13. hermit

> *You withdrew from the world to find what couldn't be found in it. Years of solitude sharpened your inner edge — and gave you something to bring back. Now choose how you'll carry it among people again:*

##### 14. investigator

> *You learned to read what other people overlook — a scuffed boot, a witness's hesitation, the gap between what's said and what's true. The case-shaped mind is yours. Now choose what you'll bring to the cases that matter:*

##### 15. city_watch

> *You walked the same streets every shift, knew which doors opened, which alleys ran into trouble, which neighbors were lying when they said they hadn't seen anything. The city is in your bones. Now choose what you'll do when the city's edges aren't enough:*

##### 16. mercenary_veteran

> *You've fought for coin in more places than most people see in a lifetime. The contracts taught you what loyalty is worth and what it isn't. The skill is real, the scars are real. Now choose what you'll fight for next:*

##### 17. urban_bounty_hunter

> *You hunt people. You've learned to read a stride from across a square, to find the room someone doesn't want you in, to wait three days for the moment that breaks them. The instincts are sharpened. Now choose how you'll use them when the marks are bigger than they were:*

##### 18. folk_hero

> *Something you did got remembered. Maybe you stood up to a tyrant, or saved someone everyone had given up on, or just refused to back down when others did. The story is yours, whether you want it or not. Now choose what you'll do with the weight people have given you:*

##### 19. urchin

> *You learned to be small, quiet, invisible — the kind of someone people's eyes slide past without registering. You ate when you could, slept where you could, and watched everything. The street made you. Now choose what you'll do with the lessons it taught:*

#### 5.4.6 Edge cases & engineering notes

- **Class change in handoff mode.** When the player overrides the suggested class, the narrative-continuity copy card stays by default — most theme × class combinations work fine with theme-anchored copy ("the discipline is in your bones" reads true whether the player picks Fighter, Paladin, Cleric, or Wizard). For combinations where the copy would awkwardly contradict the player's class choice (e.g., Soldier theme + Warlock-of-the-Fiend class), the dismiss affordance on the card lets the player remove it. This trusts the player as the judge of fit rather than encoding every theme-class collision in rules.
- **Dismiss-affordance behavior.** Click the card's dismiss control → the card collapses with a brief animation; the dropdown remains in place. Once dismissed, the card stays dismissed for the rest of the creator session (including across step jumps from Step 8). State: a single boolean on the creator state object (`narrative_continuity_dismissed: true`). Not persisted across save/resume in handoff mode — if the player saves and exits, then later resumes, the card returns. Rationale: the dismissal is a local-to-this-pass judgment, not a permanent annotation on the character.
- **Subclass timing across classes.** Some classes pick subclass at L1 (e.g., Cleric domain), others not until L2 or L3. Manual-mode UI must conditionally render the subclass picker based on the chosen class's subclass-pick level. Engineering reference: existing `levelProgression.js` knows subclass-pick levels per class.
- **L1 mechanical choices catalog.** Per class, the L1 picks vary: cantrips for casters, fighting style for fighters / paladins / rangers, expertise picks for rogues / bards, draconic ancestry for sorcerers, etc. Engineering should source these from existing class data files rather than hand-list per spec. The spec only asserts: every L1 pick the class requires at character creation must be presented before Step 4 advances.
- **Class card preview content.** Show class identity, hit die, primary ability, saving-throw proficiencies, armor / weapon proficiencies, and a brief flavor blurb. Match whatever shape `classData.js` (or equivalent) provides.
- **Theme-anchored narrative copy is theme-locked, not class-locked.** This is worth restating: the narrative-continuity copy card depends on `prelude_committed_theme`, which is locked. Even if the player swaps class three times, the same copy card displays (unless dismissed). The dropdown beneath it is what changes.

### 5.5 Step 5 — Ability Scores

#### 5.5.1 Purpose

Set the character's six ability scores, choose skill proficiencies (within class + theme + ancestry allotment), and — for Variant Humans only — pick a bonus general feat. In handoff mode, layer accepted Prelude `[STAT_HINT]` bumps onto the assigned scores via the bump celebration card.

#### 5.5.2 Manual-mode shape

Three subsections render in order:

1. **Generation method picker** — Standard Array (default, recommended) / Manual (custom values within allowed ranges). Point Buy is intentionally excluded for Phase 2 simplicity; can be added later if requested.
2. **Ability score assignment** — six rows (STR, DEX, CON, INT, WIS, CHA). Standard Array provides a six-value pool (15, 14, 13, 12, 10, 8); Manual mode provides numeric inputs within validation rules. Racial bonuses display alongside but are not editable. Final score = base + racial bonus.
3. **Skills picker** — multi-select within class + theme + ancestry allotment. Skills already granted by class / theme / ancestry render as read-only checked entries with a clear "granted by [source]" label.

If `race = human` and `subrace = variant`, a fourth subsection renders:

4. **Variant Human bonus general feat** — single-select picker filtered to general feats the character qualifies for (some feats have prerequisites).

#### 5.5.3 Handoff-mode shape

Two deltas from manual mode:

**Bump celebration card** renders at the top of the step (above the generation method picker) when accepted `[STAT_HINT]` markers exist in the character's Prelude history. The card displays the chapter beats that earned each bump and a dropdown per bump letting the player assign each +1 to a specific stat.

**Emergence skills layer into the skills picker.** Accepted `[SKILL_HINT]` markers display as already-checked entries in the skills picker, distinguished visually from class- / theme- / ancestry-derived skills (a different label or chip treatment — Design's call). Emerged skills count toward the player's allotment. Per the v4 plan §5e, emergence skills cap at 2 total.

The Variant Human bonus feat picker behaves identically in handoff mode (no pre-fill), since the Prelude doesn't track general-feat affinity.

#### 5.5.4 Fields

| Field | Type | Required | Default | Validation |
|---|---|---|---|---|
| Generation method | Select | Yes | Standard Array | One of: Standard Array, Manual |
| Six ability scores | Six numeric assignments | Yes | Unassigned | Standard Array: each pool value used exactly once. Manual: each base score 3–20 inclusive; total score after racial bonus + bumps clamps at 18 (L1 cap) per Decision E. |
| Bump assignments (handoff only) | Per-bump dropdown | Yes (when bumps exist) | First bump → first stat alphabetically | Each bump → one ability; multiple bumps can stack on one ability up to L1 cap 18 |
| Skills | Multi-select | Yes (within allotment) | Class- / theme- / ancestry- / emergence-skills pre-checked | Total count ≤ allotment; emergence skills cap at 2 |
| Variant Human bonus feat | Select | When applicable | Unselected | One of the general feats the character qualifies for |

#### 5.5.5 Authored copy

**Help text above generation method:**

> *Choose how to set your six ability scores. Standard Array gives you six fixed values to assign; Manual lets you enter custom scores within allowed ranges.*

**Help text above skills picker:**

> *Skills you're proficient in. Each skill ties to one of your six abilities — pick the ones you've practiced or trained.*

**Help text above Variant Human bonus feat (when applicable):**

> *Variant Humans choose a general feat at the start of their journey — a self-taught skill or talent that defines you apart from your lineage. Some feats have prerequisites; only feats you qualify for are shown.*

**Bump celebration card (handoff mode, when bumps exist):**

> *Two moments shaped you:*
> - *[chapter beat 1] — +1 to assign*
> - *[chapter beat 2] — +1 to assign*
>
> *Choose where each shows.*
>
> [Bump 1: STR ▾] [Bump 2: CON ▾]

The card adapts to the actual number of accepted bumps:
- One bump → "*One moment shaped you:*" (singular phrasing)
- Two bumps → "*Two moments shaped you:*" (drafted shape)
- More bumps (rare; theoretically up to four if all four +1 hints accept) → "*[N] moments shaped you:*"

Per v4 plan §5e: maximum is +2 to any single stat, +2 across all stats not enforced (the plan caps per-stat, not total), but the L1 cap 18 hard-stops total stat value regardless.

**Note on verb choice:** "shaped" is intentionally neutral about *how* the moments did their work. The chapter-beat text from `[STAT_HINT].reason` carries the texture (whether the moment was harsh, gentle, surprising, won, lost). The card's framing should not impose a tone — "hardened" leans toward physical / hardship registers and reads wrong for moments that earned, e.g., a CHA bump through a charming negotiation or a WIS bump through a mentor's quiet teaching. "Shaped" is true to every register.

#### 5.5.6 Standard Array UX direction (for Claude Design)

Standard Array assignment uses a six-value pool: 15, 14, 13, 12, 10, 8. Each value assigned to exactly one ability. The existing creator's dropdown-per-score pattern creates mental tracking burden — the player has to remember which values they've used.

**Design call requested:** Propose a treatment that makes available values visible at a glance and assigned values bound to their ability. Two patterns to consider (others welcome):

- **Draggable chips.** Six chips (15, 14, 13, 12, 10, 8) sit in a pool above six ability rows. Player drags a chip onto an ability. Used chips disappear from the pool. Reassignment supported by dragging back or swapping.
- **Assignable pool.** Six chips fixed in position; each ability has a "claim" affordance that pulls a chip into its slot. Visual feedback shows which chips remain unclaimed.

The dropdown-per-score pattern remains as a fallback if the proposed treatment is meaningfully complex to implement. Design has discretion to land on whatever pattern serves the interaction best — what's locked is the goal (visible at a glance, assignment is bound, not error-prone), not the mechanism.

#### 5.5.7 Edge cases & engineering notes

- **Stat cap math (Decision E).** Phase 2 uses standard 5e math: L1 cap 18, lifetime cap 20. Mythic-tier onset eventually raises lifetime cap to 22 — that's its own future work item, out of Phase 2 scope. The creator must clamp `base + racial + bumps` at 18 before submit; if the player's assignment + bumps would exceed 18 on a stat, the UI must surface the clamp visibly (not silently cap behind the scenes).
- **Bump dropdown defaults.** If multiple bumps exist, default each to a different ability (alphabetical first-fit) so the player doesn't accidentally stack two on one stat without intending to. Player override is one click away.
- **Manual-mode score validation.** Manual mode allows custom **3–20 base scores** per ability. This is intentionally wide and intentionally permissive — the goal is to support roleplay-driven custom builds (a frail scholar with INT 18 / STR 6, a savant with one extreme score, a deliberately disadvantaged character). The wide range is a creative-tools decision, not a rules-purity one. Validation: each base score 3–20 inclusive; final score after racial bonus + bumps still clamps at L1 cap 18 per Decision E (the cap applies to the *final* value at L1, not the manual-entered base — a Variant Human who manually enters CHA 16 + racial +1 = 17 final stays valid; the cap only fires if base + racial + bumps would exceed 18).
- **Skills picker counting.** Class skills + theme skills + ancestry skills + emergence skills + player-picked skills all sum into the proficiency count. The player's *picks* (the skills they choose from the open allotment) are bounded by class allotment minus skills already granted. Emergence skills count against the allotment per v4 plan; if class grants 2 skills and emergence grants 2, the player picks 0 additional from the open list. Engineering: confirm against current `class_skills` / `theme_skills` / `ancestry_skills` data shapes.
- **Variant Human bonus feat filter.** Some general feats have ability-score prerequisites (e.g., "Strength 13 or higher"). The picker must filter against the player's *current* assigned scores including racial bonuses but *excluding* bumps (bumps haven't been applied yet at the moment the Variant Human feat picker renders). Edge: a Variant Human in handoff mode with bumps that *would* qualify them for a feat they don't currently qualify for — this is acceptable; they pick a feat they qualify for now. Lifetime cap-up via ASIs at L4+ will let them retroactively qualify if needed.

### 5.6 Step 6 — Equipment

#### 5.6.1 Purpose

Outfit the character. Three subsections: class equipment package selection, starting gold (calculated from class baseline × per-theme modifier), and the heirloom flow (opt-in authoring in manual mode; pick-from-Prelude-candidates in handoff mode).

#### 5.6.2 Manual-mode shape

Three subsections in order:

1. **Class equipment package** — most classes offer two packages (e.g., "chain mail and a martial weapon" vs. "leather, longbow, 20 arrows"). Player picks one. Display shows what each package contains so the player can choose deliberately.
2. **Starting gold** — display only (no interaction). Calculated as `class baseline × (1 + theme modifier)`. Theme modifier from §7.1.
3. **Heirloom flow** — opt-in. Default state is a prompt asking whether the player wants to add an heirloom. If they decline, Step 6 advances on equipment + gold alone. If they accept, the manual-mode authoring form renders inline.

The manual-mode heirloom authoring form captures: name (text), type (curated select: Weapon / Armor / Book or Tome / Jewelry / Tool / Trinket / Other), specific item type (conditional on type — see §5.6.5), description (textarea), awakening hook (optional textarea).

#### 5.6.3 Handoff-mode shape

The class equipment package and starting gold subsections are identical to manual mode. The heirloom flow is different:

In handoff mode, the Prelude payload includes 1–3 heirloom candidates (objects the character acquired during play, captured in the dedicated heirloom table — see §8.3). The heirloom subsection renders an in-fiction picker letting the player choose one of the candidates to carry forward, or none. The manual-mode authoring form is hidden — the candidates are already authored (their description and any awakening hook came from Prelude play).

If zero heirloom candidates exist (a Prelude where no heirloom-eligible object was acquired), the heirloom subsection falls back to manual-mode opt-in behavior, and the manual-mode authoring form renders if the player accepts. This is a graceful degradation — handoff doesn't promise heirlooms.

> **Producer-deferred (chunk 5 ship note, 2026-05-02).** Until producer-side wiring lands (see §8.1.2 note), the zero-candidates path is the only path handoff-mode players see — `prelude_canon_heirlooms` will be empty for every Prelude that completes. Step 6 handoff falls back cleanly to manual-mode opt-in. No code changes needed here when the producer eventually lands; the `payload.heirloom_candidates` array begins to populate and this subsection's existing logic surfaces the picker.

#### 5.6.4 Fields

| Field | Type | Required | Default | Validation |
|---|---|---|---|---|
| Class equipment package | Single-select | Yes | Unselected | One of the chosen class's packages |
| Starting gold | Display only (calculated) | N/A | `class baseline × (1 + theme modifier)` | N/A |
| Heirloom opt-in (manual) | Boolean | N/A | False (skip) | N/A |
| Heirloom name (manual, if opted in) | Text | Yes | Blank | Non-empty; max 64 chars |
| Heirloom type (manual, if opted in) | Select | Yes | Unselected | One of: Weapon, Armor, Book or Tome, Jewelry, Tool, Trinket, Other |
| Heirloom specific item (manual, if opted in) | Conditional select / text | Per type | — | Per type schema (see §5.6.5) |
| Heirloom description (manual, if opted in) | Textarea | Yes | Blank | Non-empty; soft 500-char limit |
| Heirloom awakening hook (manual, if opted in) | Textarea | No | Blank | Soft 500-char limit |
| Heirloom candidate (handoff, if candidates exist) | Single-select with "carry none" option | No | "Carry none" pre-selected | One of the candidates, or none |

#### 5.6.5 Authored copy

**Help text above class equipment:**

> *Choose your starting equipment. Most callings offer two equipment packages — pick the one that fits how you'll engage the world.*

**Help text above starting gold display:**

> *What you're bringing in coin from your previous life into the road ahead.*

Display format example:
> Starting gold: 75 gp (Soldier baseline 50 gp + Theme adjustment +50%)

Or, when modifier is zero:
> Starting gold: 50 gp (Soldier baseline)

Or, when modifier is negative:
> Starting gold: 25 gp (Soldier baseline 50 gp + Theme adjustment −50%)

**Heirloom callout (handoff mode, when candidates exist):**

> *In the years behind you, [N] objects came into your hands. Carry one of them forward — or leave them all behind, if you'd rather travel light.*

**Heirloom opt-in prompt (manual mode):**

> *Some travelers carry an heirloom — a sword from their grandfather, a book stolen from the library they grew up in, a piece of jewelry their mother wore. An heirloom is real gear in your hands now, and may reveal greater meaning over time as your story unfolds. Add an heirloom?*
>
> [Add an heirloom] [Skip]

**Help text below heirloom awakening hook field (manual mode):**

> *Optional. If you have a sense of what could draw out this object's deeper meaning — a place, a person, a moment — describe it here. Leave blank if you'd rather let the object find its own time.*

**Heirloom specific-item-type conditional logic:**

| Heirloom type | Specific item picker shape | Mechanical baseline |
|---|---|---|
| Weapon | Select from `equipment.json` weapons | Sets baseline combat stats from selected weapon |
| Armor | Select from `equipment.json` armor | Sets baseline AC from selected armor |
| Book or Tome | Free text; if class accepts spellcasting focus, can flag as focus | If flagged as focus, behaves as that focus mechanically |
| Tool | Select from `equipment.json` tools (artisan tools, instruments, etc.) | Tool benefits per chosen tool |
| Jewelry | Free text | No mechanical baseline |
| Trinket | Free text | No mechanical baseline |
| Other | Free text | No mechanical baseline |

Per the drafted-content file: heirloom-ness contributes no L1 mechanical bonus on its own. The mechanical baseline comes from the underlying item type. The `is_heirloom` tag distinguishes the item from regular inventory in the UI and in the AI prompt context.

#### 5.6.6 Edge cases & engineering notes

- **Heirloom AI prompt-side handling (cross-reference for Code).** The drafted-content file specifies: heirlooms are given to the AI as deep context, not narrative pressure. The awakening hook (when present) is recognized by the AI when the wider story earns it; never insisted upon. Same guidance shape as `[CANON_THREAD]` ripening (v4 plan §5h). The prompt instruction is drafted in the content file:
  > *The character carries one or more heirloom items, each of which may have an awakening_hook describing a narrative condition under which the item could reveal greater meaning. These hooks are deep context for your understanding of the character's story, not beats to play toward. Recognize them when the wider story earns them. Never invent reasons to fire them. Many campaigns will pass without an heirloom awakening; that is correct play.*

  This prompt instruction belongs in the primary campaign prompt builder (Chunk 3 / 5 work). Surfaced here for visibility; not creator-side work.

- **Heirloom candidate count cap.** Per the bootstrap, handoff candidates are 1–3. The Prelude system caps how many heirloom-eligible objects it surfaces. If the Prelude promotes a heirloom-eligible object to candidacy, it's because narrative beats earned it (parallel logic to `[CANON_THREAD]` calibration in v4 plan §5h). Engineering: confirm the heirloom-promotion logic during Chunk 4 of Phase 2 (Prelude marker work).

- **Starting gold calculation.** `class_baseline_gp × (1 + theme_modifier)`, where theme modifier is a decimal between −0.50 and +0.50 from §7.1. Result rounds to nearest integer gp. Edge: theme modifier of zero means starting gold equals class baseline exactly.

- **Class baseline gold source.** Engineering should source per-class baseline gp from existing class data. The 5e standard gives each class a fixed-amount-or-roll choice; for the creator, default to the fixed-amount value (class baseline) and apply the theme modifier on top.

- **Awakening mechanism deferred.** The awakening hook is captured at creation and persisted on the heirloom record. The mechanism that actually awakens the heirloom (turning the latent meaning into a mechanical effect) is post-MVP. The hook field exists at MVP because future awakening work will need the player's intent at creation time.

### 5.7 Step 7 — Identity Details

#### 5.7.1 Purpose

Capture the character's interior life and outward presentation. Four required mechanical fields (alignment, faith, lifestyle, plus an eight-field physical description) anchor the character's day-to-day presence in the world. Five optional expansions (personality / ideals / bonds / flaws / backstory) deepen the texture for players who want it. In handoff mode, the optional expansions surface biography-seed pre-fill where applicable; in manual mode, they begin collapsed and the player chooses what to open.

#### 5.7.2 Manual-mode shape

Two stacked sections:

**Section 1 — Required identity (always visible):**

1. Alignment (single-select from the standard 9-square 5e grid)
2. Faith (single-select from supported deities + "None / Unaligned")
3. Lifestyle (single-select from standard 5e tiers: Wretched / Squalid / Poor / Modest / Comfortable / Wealthy / Aristocratic)
4. Physical description (eight required fields — see §5.7.4)

**Section 2 — Optional expansions (collapsed by default in manual mode):**

Five expand toggles, each opening a single text input or textarea with the §7 prompts/moments accessible inline:

- **+ Personality traits** — what you do habitually
- **+ Ideals** — what you believe
- **+ Bonds** — what you value most
- **+ Flaws** — your weakness or vice
- **+ Backstory** — the years before the campaign

Each expansion (when opened) surfaces theme-flavored prompts/moments from §7. The player can click a prompt to fill the field (Model A — drops in as starter text, then editable), or — for backstory — multi-select moments to compose a backstory (Model B with multi-select).

**Cuts** (do not appear in either mode): Organizations, Allies, Enemies, Other notes. These were on the existing creator and have been removed.

#### 5.7.3 Handoff-mode shape

Section 1 (required identity) is identical to manual mode. The player picks alignment, faith, and lifestyle fresh; physical description is filled fresh by the player. None of these pre-fill from Prelude — physical-description pre-fill is explicitly deferred per §1.2, and alignment / faith / lifestyle are creator-time picks per the v4 plan §1a.

Section 2 (optional expansions) has two deltas in handoff mode:

1. **Expansions are expanded by default** — opened, ready for the player to confirm or edit. The player can collapse what they don't care about; the default state assumes the years behind them produced texture worth showing.

2. **Biography seed pre-fill** — when the biography-seed generator (v4 plan §6 step 2) produces text relevant to a specific expansion (a personality trait, an ideal, a bond, a flaw), that text pre-fills the corresponding expansion. The seed is also surfaced in full at the top of the **Backstory** expansion as read-only canon, with an affordance pointing at the future biography-editing UI.

The §7 prompts and moments remain accessible in handoff mode below the pre-filled value, so the player can browse alternatives or compose extra material alongside the seed.

#### 5.7.4 Fields

| Field | Type | Required | Default | Validation |
|---|---|---|---|---|
| Alignment | Select | Yes | Unselected | One of the 9 standard 5e alignments |
| Faith | Select | Yes | Unselected | One of the supported deities, or "None / Unaligned" |
| Lifestyle | Select | Yes | Unselected | One of the 7 standard 5e lifestyle tiers |
| Physical: Age | Numeric | Yes | Blank | Reasonable range per race; soft validation |
| Physical: Height | Text or numeric | Yes | Blank | Free text or per-unit numeric |
| Physical: Weight | Text or numeric | Yes | Blank | Free text or per-unit numeric |
| Physical: Eyes | Text | Yes | Blank | Max 64 chars |
| Physical: Hair | Text | Yes | Blank | Max 64 chars |
| Physical: Skin | Text | Yes | Blank | Max 64 chars |
| Physical: Build | Text | Yes | Blank | Max 64 chars |
| Physical: Distinguishing features | Textarea | Yes | Blank | Max 256 chars |
| Personality (optional expansion) | Textarea | No | Blank (manual) / pre-filled from biography seed if available (handoff) | Soft 500-char limit |
| Ideals (optional expansion) | Textarea | No | Blank (manual) / pre-filled from biography seed if available (handoff) | Soft 500-char limit |
| Bonds (optional expansion) | Textarea | No | Blank (manual) / pre-filled from biography seed if available (handoff) | Soft 500-char limit |
| Flaws (optional expansion) | Textarea | No | Blank (manual) / pre-filled from biography seed if available (handoff) | Soft 500-char limit |
| Backstory (optional expansion) | Textarea (with biography seed read-only above in handoff mode) | No | Blank (manual) / biography seed displayed read-only above editable backstory area (handoff) | Soft 2000-char limit |

#### 5.7.5 Authored copy

**Help text above alignment:**

> *Your moral compass — how you tend to act when no one's watching.*

**Help text above faith:**

> *Your connection to the divine, if any. Faith shapes ritual, oath, and the language you use under pressure.*

**Help text above lifestyle:**

> *How you live between adventures — the comfort you're accustomed to and the standard you can sustain.*

**Help text above physical description:**

> *What you look like. This grounds how others first see you.*

**Help text above optional expansions (manual mode):**

> *The deeper texture of who you are. Fill in what feels meaningful and skip what doesn't.*

**Help text above optional expansions (handoff mode):**

> *The years behind you shaped these. Confirm what fits, edit what doesn't.*

**Optional expansion section toggle labels:**

- **+ Personality traits** — what you do habitually
- **+ Ideals** — what you believe
- **+ Bonds** — what you value most
- **+ Flaws** — your weakness or vice
- **+ Backstory** — the years before the campaign

**Backstory affordance below biography seed display (handoff mode):**

Below the read-only biography summary at the top of the Backstory expansion:

> *What you see here is canonical to your campaign. To revise it later, you can edit your character's biography directly.*

#### 5.7.6 Prompts and moments — interaction model

Per the locked PM call:

- **Personality / Ideals / Bonds / Flaws** use **Model A**: click-to-fill, then editable. Three theme-flavored prompts per field surface inline (collapsed in a "see suggestions" affordance, or always visible — Design's call). Player clicks a prompt; the prompt's text populates the textarea as starter text; player edits freely from there. The starter text is soft — clicking a different prompt replaces it (with a "you've edited this; replace?" confirmation if the player has typed beyond the starter).

- **Backstory moments** use **Model B with multi-select**: the player picks 1 or more moments (typically 2–4) from the curated list. Each picked moment becomes a chip / token that can be reordered or removed. A "write your own" affordance lets the player author free-text moments alongside the curated picks. The final backstory field renders the picked moments in order (with separator like a line break or bullet) plus any free-text the player adds.

Theme-flavored content for both models lives in §7.2–§7.6.

#### 5.7.7 Edge cases & engineering notes

- **Required-field load on Step 7.** Eleven required fields (alignment, faith, lifestyle, eight physical-description fields) is a heavy lift for a single step. Design should surface the eight physical-description fields as a compact grid rather than eleven stacked rows — they're related and can fit together visually.

- **Physical-description pre-fill from Prelude narration is deferred.** Per the v4 plan and the bootstrap, Step 7's physical-description fields begin blank in handoff mode. The Prelude DM does narrate physical detail through play; surfacing those details to pre-fill these fields is a future authoring problem (extracting consistent physical-description tokens from prose is non-trivial). For now: blank in both modes, player fills fresh.

- **Biography seed structure in handoff mode.** Per v4 plan §6 step 2, the biography seed is timestamped entries (in-fiction age + chapter), not a single prose blob. Step 7's Backstory expansion displays this in its native timestamped format (read-only) at the top, then provides the editable backstory textarea below. The seed is the *living biography's* seed entries — future biography work appends new entries across the main campaign.

- **Alignment / faith / lifestyle pre-fill (handoff mode).** None. The v4 plan §1a explicitly states: alignment becomes a manual pick at handoff; ideals/bonds/flaws fill against the backstory; faith is a manual pick. Lifestyle is also a manual pick (no Prelude tracking). This step exists to commit those.

- **Faith data source.** The 53 deities tracked by the Mythic piety system are the supported faith options. "None / Unaligned" is the explicit no-faith pick. Engineering should pull from the existing piety-system data file rather than re-enumerate.

- **Lifestyle tiers.** Standard 5e tiers from the DMG: Wretched, Squalid, Poor, Modest, Comfortable, Wealthy, Aristocratic. No Phase 2 deviation.

- **Cuts confirmed.** Organizations, Allies, Enemies, Other notes do not render in either mode. They're cut from the creator entirely — these belong (if anywhere) in mid-game character sheets and notes, not at creation.

### 5.8 Step 8 — Review

#### 5.8.1 Purpose

Final review before character creation commits. The player sees the full character at a glance, can jump back to any prior step to make edits, and clicks Submit to finalize. In handoff mode, a brief in-fiction callout sets the tone for stepping forward into the campaign.

#### 5.8.2 Manual-mode shape

Two stacked components:

1. **Preview card** — read-only, shaped like a character sheet summary. Displays name, race / subrace, theme, class / subclass / level, ability scores (with racial bonuses applied), skills, ancestry feat, equipment, alignment, faith, lifestyle, physical description, and any filled optional expansions. The visual treatment evokes a character-sheet preview rather than a form summary — Design's call on layout, but the intent is "this is who you'll be playing" not "review your form data."

2. **Editable summary list** — a structured list of the choices made, grouped by step. Each group has an "Edit" affordance that jumps the player back to the corresponding step with state preserved across all other steps. After editing, the player advances forward through subsequent steps to return to Submit. Not inline editing — actual step jumps.

A **Submit** button at the bottom commits the character and advances to the primary campaign.

#### 5.8.3 Handoff-mode shape

Identical to manual mode, with one delta:

A **handoff callout** renders above the preview card, in-fiction:

> *The years that shaped you are behind you now. Step forward.*

The callout is a single line. No interaction. Visual treatment should be modest — this is a moment of transition, not a celebration card. Design has discretion over weight and placement (above the preview card, or as a banner spanning the page width above the preview); what's locked is the copy and the placement above (not below or beside) the preview card.

Submit on Step 8 in handoff mode flips `creation_phase` from `'ready_for_primary'` to `'active'`, runs the canon-transfer service (NPCs, locations, threads, mentor imprint when applicable), and opens the primary campaign.

#### 5.8.4 Fields

Step 8 has no fields — only Submit. All character data is committed by prior steps.

| Field | Type | Required | Default | Validation |
|---|---|---|---|---|
| Submit | Button | N/A | N/A | Validates that all required fields across Steps 1–7 are filled; surfaces step-specific errors if any are blank or invalid |

#### 5.8.5 Authored copy

**Handoff-mode callout above preview card:**

> *The years that shaped you are behind you now. Step forward.*

Manual mode: no callout. Preview card stands on its own.

**Edit affordance:** Standard text label such as "Edit" or a pencil icon next to each section group in the editable summary list. Design's call on icon vs. text.

**Submit button:** Standard text such as "Begin" or "Step into the world" for handoff mode; "Create character" or similar for manual mode. Design has discretion to land on the exact button copy that fits the visual register, with the caveat that handoff mode's button can lean in-fiction ("Begin") and manual mode's can lean operational ("Create character"). If Design wants a unified label across both modes, that's also fine — pick one that works in both registers.

#### 5.8.6 Edit-affordance behavior

Per Step 8 Q2 = (a) (locked decision):

- Click "Edit" next to a section → direct jump back to that step, state preserved across all other steps.
- The player makes their edit on that step.
- Player advances forward through subsequent steps (each step renders with its prior state intact — no re-asking) to return to Submit.
- Not inline editing on Step 8.

This pattern keeps the creator's step sequence intact and avoids duplicate-state-management complexity that inline editing would introduce. The cost is one extra forward-click per intermediate step on the way back, which is acceptable for a path the player only takes occasionally.

#### 5.8.7 Edge cases & engineering notes

- **Submit-time validation.** Step 8's Submit must validate every required field across Steps 1–7. If any are missing, surface a step-specific error message and disable Submit until resolved. Common cases: physical description fields blank, alignment unselected, class equipment package unselected.

- **Handoff-mode submit also runs the canon transfer.** Per v4 plan §6, on Submit in handoff mode the server runs: aggregate emergences, persist canon NPCs / locations / threads into the primary campaign's tables, seed mentor imprint when applicable, and link the character to a freshly-generated primary campaign that received Prelude inputs. This is a single transactional operation — if any subsystem fails, the submit fails atomically and the character stays at `'ready_for_primary'`.

- **Manual-mode submit creates a new primary campaign with no Prelude inputs.** Standard creation path. Existing campaign-generation logic applies.

- **Preview card content vs. character-sheet content.** The preview card is a *creator-time summary*, not the live character sheet. It shows everything filled into the creator. The actual character sheet (post-creation) draws from the persisted character record and adds runtime state (current HP, conditions, inventory changes, etc.). Engineering can either reuse character-sheet view components or build a creator-specific preview — Code's call.

- **Cross-step state preservation.** Jumping back to a prior step must preserve every other step's state. This is a creator-state-management concern. Implementation: hold all step state in one creator-level state object until Submit; jumps re-render the target step from that state. Standard wizard pattern.

---

## 6. Cross-cutting interactions

### 6.1 Step navigation

The creator is linear with branching exits:

- **Forward (Next):** Advance to the next step. Enabled only when the current step's required fields are filled and valid.
- **Backward (Back):** Return to the previous step. Always enabled (except on Step 1). State on the current step is preserved.
- **Jump (Step 8 Edit affordance):** Direct jump back to a prior step from the Step 8 editable summary list. State on intermediate steps is preserved.
- **Save and exit:** Available at any step in both modes after Step 1 has been completed. Persists creator state with the character record at `creation_phase = 'creating'` (manual mode) or `'ready_for_primary'` (handoff mode). The character appears in the home page's character list with the in-progress treatment. Resuming returns the player to the step they left.
- **Cancel / discard:** Available at any step. Discards all creator state and returns to the home page. A confirmation dialog ("Discard this character? This can't be undone.") prevents accidental data loss. In manual mode, this also deletes the in-progress character record if Step 1 had been completed (a `'creating'`-state character existed). In handoff mode, this prompts an additional warning that the Prelude history will be preserved but the partial main-creator state will be lost — the character returns to `'ready_for_primary'` with creator progress wiped.

### 6.2 Save / resume behavior

**Both modes persist mid-creator state from Step 1 advance onward.** The persistence model and storage state differ slightly:

**Manual mode:**

- At the moment the player advances past Step 1 with valid name + gender, a character record is created at `creation_phase = 'creating'`.
- Every subsequent step advance, back-step, or explicit Save and exit persists the latest creator state to that record.
- Submit on Step 8 flips `creation_phase` from `'creating'` to `'active'` and runs primary-campaign generation.
- The in-progress character appears on the home page with the same in-progress card treatment as a `'ready_for_primary'` character (per §3.3).

**Handoff mode:**

- The character record already exists at `creation_phase = 'ready_for_primary'` from the moment the Prelude transition runs.
- Every step advance, back-step, or Save and exit persists the latest creator state to that record.
- Submit on Step 8 flips `creation_phase` from `'ready_for_primary'` to `'active'` and runs the canon-transfer service (NPCs, locations, threads, mentor imprint).
- The in-progress character appears on the home page from the moment Prelude completes.

**Common to both modes:**

- The persistence model is "current state, not undo history." There is no creator-internal undo beyond per-step Back. To revert a choice committed earlier, Back through to it or use the Step 8 edit affordance.
- An explicit Save and exit is available from Step 2 onward (at Step 1 there's no character record yet to save against). Save and exit is functionally a "persist current state and route home" action.
- Auto-persist on every step advance means the player can close the browser at any time after Step 1 and find their work preserved on return.

**Why mid-creator save matters in manual mode.** Step 7's optional expansions and the heirloom authoring form represent meaningful authoring effort — players investing in a character's interior life shouldn't lose that investment to a closed browser tab or an interrupted session. The drafted-content file's Step 7 invitations *("the deeper texture of who you are")* assume the player can take their time; persistence makes that real.

### 6.3 Validation aggregation

Each step validates its own required fields on Forward attempt. Step 8's Submit re-validates everything as the final guard.

Validation messages should appear inline at the field level (close to the offending field), not aggregated at the top of the step. The exception is Step 8: if Submit fails, surface a list of "X step has [issue]" messages so the player knows where to jump.

### 6.4 Mode coherence guarantees

The two modes share the same eight-step component tree and the same field schemas. What differs is the initial state and the per-field treatment (locked / suggested / fully editable). This means:

- Adding a new field to any step adds it to both modes.
- Authoring help text for a field works in both modes (manual-mode and handoff-mode help text can differ when the in-fiction tone calls for it, but both must exist).
- Validation rules are identical across modes.
- The preview card on Step 8 renders the same data shape regardless of mode.

This coherence is by design — the creator is one component, not two. Mode is a payload-and-treatment difference, not an architectural fork.

---

## 7. Content data appendix

This appendix authors the player-facing content the creator displays at runtime. All content is in-voice, second-person, and follows the voice direction in §1.5. The content is structured as data, not prose — it lives in a content data file that the creator loads.

For each theme-flavored content category (gold modifier, prompts, moments), the structure is:

- **Per-theme keying.** Content is keyed by theme id (the same ids used in `themes.js` — e.g., `soldier`, `sage`, `criminal`).
- **Stable string format.** Strings are short and composable; no markdown, no inline variable substitution beyond second-person pronoun consistency.
- **Coverage.** Every emergence-eligible theme has a complete entry. Knight of the Order and Haunted One (both manual-mode-only per Decision D) also have complete entries — they just never arrive via handoff. The 21 themes in this project's `themes.js` get content; nothing is skipped.

### 7.1 Starting gold modifiers

#### 7.1.1 Purpose

Each theme applies a percentage modifier to the character's class-baseline starting gold. This is the only mechanical effect of theme on Step 6 (themes don't carry equipment per the bootstrap, confirmed against `themes.js`). The modifier represents what the character is bringing in coin from their previous life into the road ahead.

Display format on Step 6 (per §5.6.5):

> Starting gold: 75 gp (Soldier baseline 50 gp + Theme adjustment +50%)

When the modifier is zero, the parenthetical reads:

> Starting gold: 50 gp (Soldier baseline)

#### 7.1.2 Rubric

Two factors drive a theme's modifier:

1. **Material wealth of the previous life** — did the theme involve access to money? Noble: yes by birth. Hermit: no by choice. Urchin: no by circumstance.
2. **Convertibility on departure** — at the moment they leave for adventure, can they liquidate, carry, or call upon that wealth? Sailor's pay was spent in port. Far Traveler is prepared for the journey but not wealthy. Charlatan's hustled wealth is in their pocket.

The curve uses 0.05 increments (5% steps) to keep the spread smooth without over-precision. Range: −50% (Urchin) to +50% (Noble).

#### 7.1.3 The values

Stored as decimal multipliers (e.g., +0.50 = +50%). Sort order below is descending modifier.

| Theme id | Modifier | Display | Rationale |
|---|---|---|---|
| `noble` | +0.50 | +50% | Born to coin; departing with family backing or inherited wealth in hand |
| `charlatan` | +0.30 | +30% | Hustled wealth accumulated over years of successful cons; soft money but real |
| `guild_artisan` | +0.25 | +25% | Established trade, completed apprenticeship, accumulated tools and savings; guild network gives commercial reach |
| `knight_of_the_order` | +0.15 | +15% | Order-supported; the order would equip a departing knight |
| `sage` | +0.10 | +10% | Patrons or institutions occasionally paid well; modest savings |
| `investigator` | +0.10 | +10% | Steady casework brings steady pay; not rich, but solvent |
| `clan_crafter` | +0.10 | +10% | Heritage trade with kin support, but no guild-network commercial reach |
| `entertainer` | +0.05 | +5% | Income varies wildly; departure-moment savings depend on the last gig |
| `folk_hero` | 0.00 | baseline | No wealth claim; the village fed you, but you leave with what's yours |
| `soldier` | 0.00 | baseline | Discharge pay or back wages; modest, expected |
| `sailor` | 0.00 | baseline | Last pay packet from the ship; everything else spent in port |
| `city_watch` | 0.00 | baseline | Watch-pay savings; nothing extraordinary |
| `mercenary_veteran` | 0.00 | baseline | Last contract paid; departing without a current employer |
| `far_traveler` | 0.00 | baseline | Prepared for the journey but not wealthy; what's in pocket got you here |
| `acolyte` | −0.05 | −5% | Temple stipend was modest; possibly leaving with the temple's blessing in lieu of coin |
| `urban_bounty_hunter` | −0.10 | −10% | Bounties are feast-or-famine; depends on what's recent |
| `outlander` | −0.15 | −15% | Subsistence-level life; barter economy doesn't translate to gp |
| `haunted_one` | −0.20 | −20% | Whatever resources existed went to whatever haunts them; nothing accumulated |
| `criminal` | −0.25 | −25% | Crime pays poorly on average and is often spent or seized |
| `hermit` | −0.35 | −35% | Chosen poverty; deliberate withdrawal from material accumulation |
| `urchin` | −0.50 | −50% | Nothing to leave with; everything carried on your back is everything you own |

#### 7.1.4 Engineering notes

- **Storage shape.** Recommend a single-file constant export, e.g., `THEME_GOLD_MODIFIERS` in a new `client/src/data/themeGoldModifiers.js` (or matching server-side module). One key per theme id, value is the decimal multiplier.
- **Calculation.** `final_gold = round(class_baseline_gp × (1 + theme_modifier))`. Round to nearest integer gp; ties round up (standard half-up rounding).
- **Display logic.** When `theme_modifier === 0`, omit the "+ Theme adjustment" parenthetical; show "(Class baseline)" only. When positive, show "+N%". When negative, show "−N%" using the proper minus glyph (Unicode U+2212), not a hyphen.
- **Class baseline source.** Pull from existing class data (`classData.js` or equivalent). The 5e PHB gives each class a fixed-amount-or-roll choice for starting gold; the creator uses the fixed-amount value as the baseline.
- **No interaction.** The starting gold display is read-only — the player cannot change the modifier, the baseline, or the result. The display exists to make the calculation visible and explainable.

### 7.2 Personality prompts

#### 7.2.1 Purpose

Three theme-flavored prompts per theme that the player can click to populate the **Personality traits** field on Step 7. Per §5.7.6, this field uses Model A: clicking a prompt drops it into the textarea as starter text, then the player edits freely.

Personality traits describe *habitual behaviors* — what the character does without thinking, the small recognizable patterns that make them them. Each prompt is a single short observation in second-person, present tense, focused on a recognizable habit tied to the theme without being a stereotype.

#### 7.2.2 Alignment indicators

Each prompt carries a 5e alignment indicator using the standard 9-square abbreviations:

`LG`, `NG`, `CG`, `LN`, `N`, `CN`, `LE`, `NE`, `CE`

`N` is True Neutral. The indicator captures where the habit nudges the character's overall alignment. A habit that's "Lawful but morally neutral" is `LN`; a habit that's neutral on both axes is `N`.

The indicator exists to give the player a navigational signal while scanning — a player aiming for a Lawful Good character can scan for `LG`, `LN`, and `NG` prompts and skip the rest.

**Display direction for Claude Design:** the indicator should be always-visible inline alongside the prompt text, with modest visual weight (a chip, pill, muted-type tag, or similar). Don't bury it; the navigational use depends on quick scanning. Design has discretion over the exact rendering; what's locked is the always-visible default and that the indicator reads at a glance.

**Distribution note.** Personality prompts skew toward `N`, `LN`, `CN`, `NG`, and `NE` because most habits push one alignment axis without committing the other. The full 9-square is represented across the 63 prompts but not evenly.

#### 7.2.3 Storage shape

Recommend a single-file constant export, e.g., `THEME_PERSONALITY_PROMPTS` keyed by theme id. Each entry is an array of 3 objects with `text` and `alignment` fields:

```js
{
  soldier: [
    { text: "You count entrances and exits the moment you enter a room.", alignment: "N" },
    { text: "You speak in clipped sentences when stressed, the way command speaks under fire.", alignment: "LN" },
    { text: "You're up before dawn whether anyone's calling muster or not.", alignment: "LN" }
  ],
  // ... 20 more theme entries
}
```

Same shape for §7.3 (ideals), §7.4 (bonds), §7.5 (flaws). §7.6 (backstory moments) uses a slightly different shape — see that section.

#### 7.2.4 The 63 personality prompts

**`acolyte`**

1. *You speak a brief blessing under your breath before meals, even alone.* `[LG]`
2. *You sit still for long stretches without growing restless, the way prayer taught you.* `[LN]`
3. *You ask after people's troubles before their names, and you remember the answers.* `[NG]`

**`charlatan`**

1. *You watch a person's hands first, their face second, their words last.* `[CN]`
2. *You change small details about yourself depending on the room — accent, posture, the weight of your laugh.* `[CN]`
3. *You tell stories about yourself you know aren't true and let people decide which ones to believe.* `[CN]`

**`city_watch`**

1. *You scan a crowd for the people who don't fit before you scan for the people you came to find.* `[LN]`
2. *You notice when a door is locked that should be open, and you remember it.* `[LN]`
3. *You greet shopkeepers and beggars by name on the streets you know, and you know a lot of streets.* `[LG]`

**`clan_crafter`**

1. *You run your thumb along the seam of any worked thing you handle, judging the maker.* `[N]`
2. *You name your tools, and you keep them clean even when you're exhausted.* `[LN]`
3. *You stand at a particular angle when you work — the angle your kin stood at — without thinking about it.* `[LN]`

**`criminal`**

1. *You sit with your back to walls and your eye on the door.* `[CN]`
2. *You count the people in any room before you settle into it.* `[CN]`
3. *You answer questions with questions when you're being measured.* `[CN]`

**`entertainer`**

1. *You read the room before you open your mouth — who's bored, who's drunk, who's sad.* `[CN]`
2. *You hum or whistle without realizing it, and you notice when you stop.* `[CN]`
3. *You make eye contact a half-beat longer than other people are comfortable with, and you've learned to use it.* `[CN]`

**`far_traveler`**

1. *You compare everything to home, sometimes aloud, often in your head.* `[N]`
2. *You eat foods you don't recognize before you ask what they are, because asking is sometimes rude.* `[NG]`
3. *You watch how locals greet each other and adjust your own greeting accordingly.* `[N]`

**`folk_hero`**

1. *You greet everyone the same — the magistrate and the stable hand — and it surprises both of them.* `[NG]`
2. *You stand up when other people are sitting and the room has gone wrong.* `[CG]`
3. *You can't stop yourself from offering help even when no one asked, and sometimes it costs you.* `[NG]`

**`guild_artisan`**

1. *You evaluate the quality of any made thing in your hands within a few seconds, and your face shows it.* `[LN]`
2. *You introduce yourself with your craft as if it were your second name.* `[LN]`
3. *You keep a notebook of techniques and ideas, and you'd lose sleep before losing it.* `[LN]`

**`haunted_one`**

1. *You scan rooms for the dark corners first.* `[N]`
2. *You speak softly without meaning to, the way people do around the sleeping or the dead.* `[N]`
3. *You go quiet at certain words — some predictable, some not — and people learn to step around them.* `[N]`

**`hermit`**

1. *You speak less than the situation calls for, and the silence often does the work.* `[LN]`
2. *You forget how loud taverns are, and you remember why you left when you walk into one.* `[N]`
3. *You watch people the way you used to watch the seasons — patient, unhurried, slow to judge.* `[NG]`

**`investigator`**

1. *You notice the lie before you notice that you've noticed it.* `[LN]`
2. *You memorize people's faces against their words, and you compare them later.* `[LN]`
3. *You ask questions in an order designed to let people contradict themselves, and you don't always tell them.* `[LN]`

**`knight_of_the_order`**

1. *You stand to attention without thinking when authority enters a room, even when the authority isn't yours to obey.* `[LN]`
2. *You speak the language of vows and oaths in casual conversation, and you mean it every time.* `[LG]`
3. *You bow your head a fraction when you greet equals, and a touch deeper for those above your station.* `[LG]`

**`mercenary_veteran`**

1. *You price a job within seconds of hearing it, in your head, and your face doesn't quite hide it.* `[CN]`
2. *You sleep with a weapon within reach, and you don't apologize for it.* `[N]`
3. *You count contracts, not friendships, and you're honest about the difference.* `[N]`

**`noble`**

1. *You expect to be heard when you speak, and it confuses you when you aren't.* `[LN]`
2. *You dress for the room, even when no one is looking.* `[LN]`
3. *You phrase requests as if refusal isn't an available answer.* `[LN]`

**`outlander`**

1. *You read weather without looking up, by the way the air is moving.* `[N]`
2. *You go quiet inside walls, the way other people go quiet outside them.* `[N]`
3. *You walk for hours before you notice you've been walking, and you don't tire the way town-folk do.* `[N]`

**`sage`**

1. *You quote sources in casual conversation and assume people are following.* `[LN]`
2. *You correct factual errors before you've decided whether to, and sometimes you regret it.* `[LN]`
3. *You read while you eat, and you eat slower than people who don't.* `[LN]`

**`sailor`**

1. *You refer to directions by the wind even on dry land — windward, leeward — and people look at you funny.* `[N]`
2. *You walk with the rolling gait of a deck even when the floor isn't moving.* `[N]`
3. *You never refuse a drink among shipmates, and you remember every face that's bought you one.* `[CN]`

**`soldier`**

1. *You count entrances and exits the moment you enter a room.* `[N]`
2. *You speak in clipped sentences when stressed, the way command speaks under fire.* `[LN]`
3. *You're up before dawn whether anyone's calling muster or not.* `[LN]`

**`urban_bounty_hunter`**

1. *You read a stride from across a square — who's hurrying, who's hiding, who's pretending they aren't.* `[N]`
2. *You wait, and the waiting doesn't feel like waiting to you the way it does to other people.* `[CN]`
3. *You answer questions about your work in as few words as possible, and you don't volunteer.* `[N]`

**`urchin`**

1. *You eat fast, like the food might be taken back.* `[N]`
2. *You notice every coin purse in a room without meaning to.* `[CN]`
3. *You sleep light, with one ear open for the wrong kind of footstep.* `[N]`

### 7.3 Ideals prompts

#### 7.3.1 Purpose

Theme-flavored prompts that the player can click to populate the **Ideals** field on Step 7. Per §5.7.6, this field uses Model A (click-to-fill, then editable).

Ideals describe *what the character believes* — the moral framework that shapes their choices when stakes are real. Each prompt follows the 5e convention of leading with a one-word label, then a single-sentence elaboration in second-person voice with conviction.

#### 7.3.2 Alignment indicators and coverage

Same notation as §7.2.2 — the 5e 9-square abbreviations (`LG`, `NG`, `CG`, `LN`, `N`, `CN`, `LE`, `NE`, `CE`).

**Coverage principle.** Each theme offers ideals across the alignment spectrum — Good, Neutral, and Evil axes; Lawful, Neutral, and Chaotic axes. The goal is roleplay support across the full range. A player choosing Acolyte should find believable LG, LN, NG, *and* LE / NE options. Evil-axis ideals are written as character commitments held by people who think they're doing right — internally coherent moral frameworks, not villain manifestos. The line between an evil ideal and a villain credential is whether the ideal is something a thoughtful person could believe in earnest.

**Counts.** Prompts per theme range from 4 to 7 depending on the natural alignment surfaces of the theme. No fixed count; total across §7.3 lands around 110-120 prompts.

#### 7.3.3 Storage shape

Same as §7.2.3 — keyed by theme id, array of objects with `text` and `alignment` fields, in a constant export `THEME_IDEALS_PROMPTS`.

#### 7.3.4 The ideals prompts

**`acolyte`**

1. *Faith. The divine speaks through ritual, study, and quiet — and you hear it most clearly when you serve.* `[LG]`
2. *Tradition. The old forms exist for reasons older than your understanding, and reverence is its own reward.* `[LN]`
3. *Charity. The first measure of any soul is what it gives without being asked.* `[NG]`
4. *Mercy. Even the worst of us deserve grace; the divine asks no less of those who serve.* `[NG]`
5. *Doctrine. The faithful must hold the line on what is true, even when the world prefers comfortable lies.* `[LN]`
6. *Authority. The hierarchy of the faith reflects the order of creation; questioning it weakens what holds the world together.* `[LE]`
7. *Purification. The faith demands hard things of those who serve it, and the unworthy must be held to account.* `[LE]`

**`charlatan`**

1. *Freedom. The truth a person earns matters more than the truth they're handed, and a good lie can teach as much as it costs.* `[CN]`
2. *Equity. The rules were written by the rich; bending them is justice, not crime.* `[CG]`
3. *Self-Reliance. No one is coming to save you, and pretending otherwise is the dangerous lie.* `[CN]`
4. *Compassion. You've conned bad people for good reasons more often than the other way, and the work has its own kind of honor.* `[CG]`
5. *Pragmatism. Every transaction is a performance; the only sin is being bad at it.* `[N]`
6. *Power. The fool and their coin part ways by natural law; you're just an instrument of that law.* `[NE]`
7. *Domination. People reveal what they are when you can read them — and what they are is mostly weak, and weakness is for using.* `[CE]`

**`city_watch`**

1. *Order. The streets work because someone holds the line — and you know what happens when no one does.* `[LN]`
2. *Justice. The law is imperfect, but it's what we have. Enforcing it fairly is the work.* `[LG]`
3. *Loyalty. The people you walk patrol with are the people who'd die for you, and you for them.* `[LN]`
4. *Service. The watch protects the people who can't protect themselves, and that's the whole point of wearing the badge.* `[LG]`
5. *Authority. The badge is the thing; people who don't respect it get the lesson, and the lesson is for everyone's good.* `[LE]`
6. *Control. The streets stay calm because someone is willing to be feared, and that's a service too.* `[LE]`

**`clan_crafter`**

1. *Heritage. The patterns your kin taught you carry weight no guild contract ever will.* `[LN]`
2. *Excellence. Work that doesn't honor the ones who taught you is work you shouldn't sign your name to.* `[LG]`
3. *Continuity. What you make outlives you, and that is the point.* `[LN]`
4. *Generosity. The craft is meant to be given — to the kin, to those who need what you make, to the future.* `[NG]`
5. *Pride. Your work outshines the guilds' for a reason, and the world should know it.* `[LE]`
6. *Supremacy. Some hands are made to shape, and others are made to be shaped by what those hands make. The order is older than your bloodline.* `[LE]`

**`criminal`**

1. *Loyalty. The crew is the only law you respect, and you'd burn the world before you'd burn one of them.* `[CN]`
2. *Self-Interest. Everyone's looking out for themselves; you just admit it.* `[CN]`
3. *Redemption. You can leave the life if you choose to, and you'd like to believe that.* `[CG]`
4. *Justice. The rich got there by stealing first, and what you do is closer to a redistribution than a crime.* `[CG]`
5. *Survival. The only ideal that's ever kept you alive is making sure you stay alive, and you don't apologize for it.* `[N]`
6. *Greed. Coin is the cleanest measure of what a person is worth, and you measure honestly.* `[NE]`
7. *Cruelty. The world hurt you; you've returned the favor with interest, and you'd do it again.* `[CE]`

**`entertainer`**

1. *Beauty. There's something true in every good performance, and you spend your life chasing it.* `[NG]`
2. *Freedom. Every audience is different, and rules that worked yesterday won't work tonight — that's the whole job.* `[CN]`
3. *Honesty. The stage doesn't lie, even when the words do, and you've come to trust it more than most people.* `[N]`
4. *Joy. The world is heavy enough; what you do is meant to lift, and you take that obligation seriously.* `[CG]`
5. *Glory. You will be remembered, and that takes work no one else is willing to do.* `[N]`
6. *Manipulation. You can move a room any way you want, and the room mostly deserves to be moved.* `[CE]`

**`far_traveler`**

1. *Curiosity. There's no end to what you don't know, and that's the most exciting fact in the world.* `[NG]`
2. *Hospitality. You were a stranger once. Strangers are owed kindness, especially the ones who don't speak the language.* `[NG]`
3. *Independence. Home was something you chose to leave, and choosing to keep moving is its own kind of fidelity.* `[CN]`
4. *Understanding. The world's quarrels are mostly born of people not knowing each other, and you can be the one who carries the bridge.* `[NG]`
5. *Detachment. You don't belong anywhere, and you've learned that's a clearer place to see from than belonging.* `[N]`
6. *Superiority. Where you came from did things better, and the locals would benefit from listening — though they rarely do.* `[LE]`

**`folk_hero`**

1. *Justice. The strong shouldn't get to take from the weak, and someone has to say so out loud.* `[NG]`
2. *Community. You belong to the people who claimed you, and you owe them more than they'll ever ask for.* `[LG]`
3. *Sincerity. The story people tell about you isn't the truth, but the truth is close enough that you try to live up to it.* `[NG]`
4. *Defiance. Authority that hasn't earned obedience doesn't deserve it, and you've stopped pretending otherwise.* `[CG]`
5. *Humility. You're not the hero of the story; the people you stood for are. You just happened to be the one standing.* `[NG]`
6. *Vengeance. The wrongs done to your people don't end with apologies, and forgiveness is a luxury the dead don't get to give.* `[NE]`

**`guild_artisan`**

1. *Mastery. The work demands what it demands, and shortcuts insult both the maker and the made.* `[LN]`
2. *Community. The guild raised you. You owe it back, and you'll teach when your time comes.* `[LG]`
3. *Aspiration. Every piece you make should be better than the last, and the day that stops being true is the day to retire.* `[LN]`
4. *Generosity. What you make is meant for hands that need it, and the right buyer matters more than the highest bidder.* `[NG]`
5. *Hierarchy. The guild ranks exist for reasons, and respect for rank is what keeps the work honest.* `[LE]`
6. *Profit. The work is a commodity in the end, and pretending otherwise is sentiment that costs you coin.* `[LE]`

**`haunted_one`**

1. *Endurance. What's been done is done. What's left is to keep going, and not let it own you.* `[N]`
2. *Vigilance. You've seen what hides in the dark places. You don't pretend it isn't real, and you don't let others either.* `[LN]`
3. *Mercy. You know what suffering does to people, and you'd spare it if you can.* `[NG]`
4. *Truth. The thing that haunted you was real, and the world's denial of it is what you push against now.* `[N]`
5. *Vengeance. What was done to you didn't end with you. You'll see the source of it answer before you let it rest.* `[NE]`
6. *Annihilation. Some things shouldn't exist, and you've come to believe the same is true of what made you.* `[NE]`

**`hermit`**

1. *Truth. There are answers that can't be found in cities, and you've come back from where you found them.* `[LN]`
2. *Inner Peace. Solitude taught you that the noise outside is not the noise that matters. The noise inside is.* `[N]`
3. *Compassion. You went away to learn how to come back, and what you carry is meant to be given.* `[NG]`
4. *Free Thought. The wisdom of crowds is the absence of wisdom; only the solitary mind sees clearly.* `[CN]`
5. *Greater Good. The revelation you found in the wilderness is what the world needs, and bringing it back is your work.* `[NG]`
6. *Misanthropy. People are mostly the noise you went away from, and you came back to share that finding, not to forget it.* `[CE]`

**`investigator`**

1. *Truth. Every lie has a cost, and someone has to be willing to pay it to find what's underneath.* `[LN]`
2. *Justice. The case isn't closed when the verdict comes in. It's closed when the right thing happens.* `[LG]`
3. *Persistence. The questions don't stop because the trail goes cold, and neither do you.* `[LN]`
4. *Protection. The work exists because someone has to stand between the predators and the prey, and you've signed up to be that someone.* `[NG]`
5. *Knowledge. The hidden things want to stay hidden, and that's reason enough to drag them into the light.* `[N]`
6. *Control. Information is the only real currency; what you find out is yours, and you decide who gets it.* `[LE]`
7. *Punishment. The verdict isn't enough. The guilty pay in the way the law won't reach for, and you've stopped feeling bad about it.* `[LE]`

**`knight_of_the_order`**

1. *Honor. The vows are not theater. You took them in earnest, and you live them the same way.* `[LG]`
2. *Service. Your blade is not your own. It belongs to the order, the realm, and what they protect.* `[LG]`
3. *Mercy. Power that knows when not to strike is the only power worth holding.* `[LG]`
4. *Duty. The order asks what it asks. Your judgment of its asks is a luxury you set down when you took the oath.* `[LN]`
5. *Glory. The order's name endures through what its knights do, and you intend to leave it brighter than you found it.* `[LN]`
6. *Supremacy. The order's way is the right way; the world will be better when it has been brought into accord.* `[LE]`
7. *Crusade. There are enemies of the realm who do not deserve the mercy of the law, and you've made your peace with that.* `[LE]`

**`mercenary_veteran`**

1. *Pragmatism. Coin is honest. It tells you what people actually value, and it doesn't pretend to be friendship.* `[N]`
2. *Loyalty. The contract is the contract — and the people you signed alongside are the only ones you owe more than that.* `[LN]`
3. *Survival. Every job has a way out planned before you walk in. The ones who forget that don't come home.* `[N]`
4. *Honor. The ones who sign with you are entitled to your back; the ones you sign against are entitled to a clean fight.* `[LG]`
5. *Compassion. You've seen what war does to the ones who can't fight back, and you've started picking your contracts with that in mind.* `[NG]`
6. *Domination. The world goes to those who can take it, and pretending otherwise is the lie of people who couldn't.* `[LE]`
7. *Cruelty. You've stopped flinching at the work, and there's a part of you that's stopped wanting to.* `[NE]`

**`noble`**

1. *Responsibility. Privilege is owed back to the people whose work made it possible.* `[LG]`
2. *Order. The structures that govern us are imperfect, but they are how civilization endures.* `[LN]`
3. *Mastery. Those born to power are obligated to wield it well — better than they were given it.* `[LN]`
4. *Largesse. The honor of a house is measured by what it gives, not what it holds.* `[LG]`
5. *Independence. The judgment of the house is yours by birthright, and you answer to it before any council, peer, or king.* `[N]`
6. *Authority. Some are born to rule and others to be ruled, and pretending the order is otherwise produces only chaos and suffering.* `[LE]`
7. *Aggrandizement. The house's standing is yours to elevate, and any who stand in the way are obstacles to be removed.* `[LE]`

**`outlander`**

1. *Nature. The wild has its own laws, older than any kingdom's, and you respect them more than the ones written down.* `[N]`
2. *Self-Reliance. You ate what you caught and slept where you found shelter. The lessons of that don't leave you.* `[N]`
3. *Honesty. The wilderness doesn't pretend, and you've stopped being able to either.* `[CG]`
4. *Stewardship. The wild raised you. What you can do for it now is the obligation you're working off.* `[NG]`
5. *Freedom. No fence, no border, no flag should command where a person walks. That's the law of the open country.* `[CN]`
6. *Predation. The wild taught you that everything eats, and pretending you're above the law of teeth is how prey thinks.* `[CE]`

**`sage`**

1. *Knowledge. There is a truth at the bottom of every question, and approaching it is the work of a life.* `[LN]`
2. *Wisdom. Knowing isn't enough. What's known must be weighed, shared, and used.* `[LG]`
3. *Skepticism. Most of what people are certain of is wrong. Holding that lightly is the only way to learn.* `[N]`
4. *Mentorship. What you've learned was given to you. The chain of teaching is the only thing keeping the world from forgetting itself.* `[LG]`
5. *Discovery. The frontier of knowledge is a place; you intend to set foot on it, and it doesn't matter who's already turned back.* `[CN]`
6. *Rigor. The careless and the credulous are the real enemies of truth, and they should be corrected without softness.* `[LE]`
7. *Mastery. Knowledge is power, and the few who hold it are obligated to use it without false humility.* `[NE]`

**`sailor`**

1. *Camaraderie. The ship runs because the crew runs together, and you'd swing a hammer for any of them.* `[LG]`
2. *Freedom. The sea has no roads, no fences, no kings. You crossed it, and you can't unlearn that.* `[CN]`
3. *Respect. The water doesn't care who you are, and learning that taught you to stop pretending too.* `[N]`
4. *Loyalty. The captain you serve is the captain you serve, and the ones who don't understand that haven't sailed enough.* `[LN]`
5. *Adventure. There are coasts no one has charted, and you intend to be the chart that's drawn from your travels.* `[CG]`
6. *Plunder. The sea gives what it gives, and only the law-abiding never get rich. You've stopped pretending you're sentimental about it.* `[CE]`

**`soldier`**

1. *Duty. The order is given. You carry it out. The thinking comes after, if it comes at all.* `[LN]`
2. *Brotherhood. The unit is the line that doesn't break, and the people in it are the only ones who understand what you've done.* `[LN]`
3. *Honor. The ones who fell beside you deserve a war fought the right way, even when no one's watching.* `[LG]`
4. *Sacrifice. The line holds because some are willing to be the line, and you've already accepted what that means.* `[LG]`
5. *Survival. The objective doesn't bring anyone home — discipline does, and you've stopped apologizing for prioritizing it.* `[N]`
6. *Obedience. Orders are orders, and the questions about them are above your pay and ought to stay there.* `[LE]`
7. *Glory. You signed up for something the civilians can't see, and the rest of your life is going to be measured against it.* `[LN]`

**`urban_bounty_hunter`**

1. *Justice. The bounty is the contract. The contract is what holds society together when courts can't reach.* `[LN]`
2. *Pragmatism. Marks aren't villains, mostly. They're people who made a wrong choice, and your job is the choice's cost.* `[N]`
3. *Persistence. Every mark thinks they can outwait you. They're wrong, and finding out is the lesson.* `[N]`
4. *Mercy. Every mark has a story; you bring them in alive when you can, and you've taken cuts to your fee for it.* `[NG]`
5. *Order. The marks are weeds in the city's garden; pulling them is the maintenance work no one wants to admit is necessary.* `[LE]`
6. *Predation. The hunt is its own pleasure, and you've stopped pretending the contract is the whole reason you do it.* `[CE]`

**`urchin`**

1. *Survival. You ate when you could and slept where you could, and pretending those rules don't still apply is the trap.* `[N]`
2. *Solidarity. The other kids on the street were the only family you had, and you don't forget what that taught you.* `[NG]`
3. *Suspicion. People offering help usually want something. The ones who don't are rare, and you remember them by name.* `[CN]`
4. *Compassion. Every street kid you see is the kid you were, and you do what someone might have done for you.* `[NG]`
5. *Liberty. No one owns you, no one tells you where to be, and you'd burn before you took an arrangement that pretended otherwise.* `[CG]`
6. *Greed. The streets taught you what scarcity feels like, and you've made up your mind to never feel it again.* `[NE]`
7. *Cruelty. The world taught you the lesson young; you've started teaching it back to the world.* `[CE]`

### 7.4 Bonds prompts

#### 7.4.1 Purpose

Theme-flavored prompts that the player can click to populate the **Bonds** field on Step 7. Per §5.7.6, this field uses Model A (click-to-fill, then editable).

Bonds describe *what the character values most* — the specific people, places, objects, or unfinished business they'd pay real cost to protect, recover, or honor. Each prompt names a concrete attachment with implied stakes that the player can elaborate or rename in the textarea.

Several prompts use [bracketed placeholders] for names or specifics — these are intentional invitations for the player to fill in their own canon (e.g., *"[the village that raised you]"*, *"[the master who taught you the craft]"*).

#### 7.4.2 Alignment indicators and coverage

Same notation as §7.2.2. Bonds spread across the 9-square — bonds about people you love lean Good, bonds about places and objects lean Neutral, bonds about grudges, debts, and possessions lean toward the Evil axis. Each theme offers attachments across distinct registers (a person, a place, an object, an obligation, a grudge) so the player gets range across the alignment spectrum.

**Counts.** Prompts per theme range from 4 to 6 depending on the natural attachment surfaces of the theme. No fixed count.

#### 7.4.3 Storage shape

Same as §7.2.3 — keyed by theme id, array of objects with `text` and `alignment` fields, in a constant export `THEME_BONDS_PROMPTS`.

#### 7.4.4 The bonds prompts

**`acolyte`**

1. *The temple that raised you. You'll return to it whenever you can, and you'll defend it if it ever calls.* `[LG]`
2. *A specific text — a passage, a parable, a verse — that you read until it became the spine of your faith.* `[LN]`
3. *The person who first taught you to pray. You don't know if they're still alive, and you mean to find out.* `[NG]`
4. *A relic of the faith — small, precious, entrusted to you. You'd lay down your life before it was lost or defiled.* `[LG]`
5. *A fellow servant of the faith who fell from doctrine. You haven't spoken to them in years, and you don't know whether you mean to reconcile or to make them answer.* `[LN]`
6. *A heretic — someone who corrupted what you held sacred. You've been waiting for the chance to bring them to account.* `[LE]`

**`charlatan`**

1. *A mark you cheated badly enough that it's stayed with you. One day you'll make it right — or so you tell yourself.* `[N]`
2. *The first persona you ever wore convincingly. It's still in your kit, in case you need to be that person again.* `[CN]`
3. *A partner who taught you the work, then disappeared. You'd cross continents for word of where they went.* `[CN]`
4. *Someone you cheated who didn't deserve it — and who never knew it was you. You'd undo it if you could find a way that didn't reveal you.* `[NG]`
5. *A rival con artist who beat you at your own game. You owe them a long-running answer.* `[CN]`
6. *A list of marks you've kept all along — names, weaknesses, the right approach. The list is worth a fortune to the right buyer, and you've been considering selling.* `[NE]`

**`city_watch`**

1. *The street you walked your first patrol on. You still know which doors stick and which neighbors lie.* `[LN]`
2. *A partner who didn't come home from a shift. You carry their name, and you carry it loudly.* `[LG]`
3. *A case that never closed. The file is still in your head, and you'll work it until you can't.* `[LN]`
4. *A neighborhood — its shopkeepers, its kids, its troublemakers — that you came to think of as yours. You'd return at any hour they called.* `[LG]`
5. *A criminal you've crossed paths with for years; the unspoken arrangement between you isn't something you'd put in a report.* `[LN]`
6. *A magistrate or captain who used you to do dirty work for them, and the leverage they have on you hasn't gone away.* `[LE]`

**`clan_crafter`**

1. *The forge or workshop your kin worked in. The walls remember every hand that shaped them.* `[LN]`
2. *An unfinished piece — your grandparent's last work, set aside before they passed. You'll complete it one day.* `[LG]`
3. *The teacher who refused to call you ready, and was right to refuse. You're still earning the moment they would have.* `[LN]`
4. *A sibling or cousin in the craft who's gone further than you have. You don't always say so, but their success is something you guard for them.* `[NG]`
5. *A rival clan or guild whose work threatens what your people made. The accounting is overdue.* `[LN]`
6. *A piece you made for someone who turned out to be unworthy of it. You'd take it back, and you'd be willing to spill blood doing it.* `[NE]`

**`criminal`**

1. *A friend who took the fall for something you did. You owe them, and you mean to pay.* `[CN]`
2. *The first place you called safe — a hideout, a back room, a rooftop. It's where you go when everything else fails.* `[CN]`
3. *Someone who crossed you and didn't pay. You haven't forgotten, and you don't intend to.* `[NE]`
4. *A child, a sibling, a parent the streets nearly took — the one you stayed straight for, when you tried.* `[NG]`
5. *A handler or fence who's been loyal across years of bad luck. You'd burn for them, and you'd expect them to burn for you.* `[CN]`
6. *A score you walked away from at the last moment. You still know exactly where it sits, and you've been thinking about going back.* `[CN]`

**`entertainer`**

1. *The first audience that loved you. You'd play one more show in that room before you'd play the grandest hall.* `[NG]`
2. *A song, a routine, a piece — the one that's yours, that no one else can do the way you do it.* `[N]`
3. *A rival whose work made you better. You hate them a little, and you respect them more than you let on.* `[N]`
4. *A patron or sponsor who saw something in you when no one else did. Their faith is the standard you measure yourself against.* `[NG]`
5. *A performer who stole your work and won acclaim with it. You haven't forgotten, and the reckoning is overdue.* `[N]`
6. *A piece of compromising material on a powerful person — a letter, a confession, a witnessed scene. You've kept it for years, and you've considered using it.* `[NE]`

**`far_traveler`**

1. *Home. Wherever you're standing, it's somewhere else, and you carry it like a second heartbeat.* `[NG]`
2. *A promise you made before you left — to return, or to send word, or to come back changed.* `[LG]`
3. *A traveling companion who turned back when you didn't. You wonder, often, if they were the wiser one.* `[N]`
4. *A guide who saw you safely across a dangerous stretch and refused payment. You owe them, and you intend to repay it the day you can.* `[NG]`
5. *Someone in the place you came from who waits for you — a parent, a betrothed, a sibling, a child — whose patience is finite.* `[LG]`
6. *Something from your homeland — a writ, a debt, a feud — that's followed you here. You haven't told anyone what it is.* `[LN]`

**`folk_hero`**

1. *The community that knows your name. They were what you stood up for, and you'd stand up again.* `[LG]`
2. *The person you saved that day — the one who started the story. You think about them more than the story itself.* `[NG]`
3. *The tyrant or the wrong-doer you faced down. They're still out there, and you wonder if you finished what you started.* `[NG]`
4. *The friend or family member whose loss is what made you act when you finally did. You carry them in everything that came after.* `[NG]`
5. *A village, town, or holding that's named you their own. You can return there at any time and find a roof, a meal, a fire.* `[LG]`
6. *An enemy you spared who shouldn't have been spared. You watch the news for word of what they're doing now.* `[NE]`

**`guild_artisan`**

1. *The master who took you on as an apprentice. You owe them everything you can make, and you'll keep making it.* `[LG]`
2. *Your guild — the network, the code, the hall. You bear its mark in every piece you sign.* `[LN]`
3. *A commission you couldn't finish, and a client you couldn't satisfy. The piece sits in your shop, waiting for you to be ready.* `[LN]`
4. *A protégé you trained who's gone on to do work that humbles you. Their reputation is part of what you live for now.* `[NG]`
5. *A patron who paid for everything they shouldn't have, and then asked you for something you couldn't give. The leverage is still in their hands.* `[LE]`
6. *A rival you sabotaged once, when the guild's politics turned ugly. They don't know you did it, and you've considered telling them.* `[N]`

**`haunted_one`**

1. *The person who didn't survive what you did. You carry their name in places no one else looks.* `[NG]`
2. *The thing that haunted you. You know what it is, and you know it isn't done with you yet.* `[N]`
3. *A keepsake — small, easy to overlook — that proves the worst of it actually happened. You won't part with it.* `[N]`
4. *A scholar, priest, or sage who believed your account when no one else did. They asked nothing in return, and you owe them everything.* `[NG]`
5. *The place where it happened — house, road, ruin, river. You haven't returned, and the leaving is unfinished.* `[N]`
6. *Whatever, or whoever, made the haunting possible in the first place. You've sworn to find them, and the oath is binding even if no one heard you take it.* `[NE]`

**`hermit`**

1. *The place you withdrew to. The trees, the cell, the cave, the high country — wherever it was, it's yours.* `[N]`
2. *A revelation that came to you in solitude. It's why you came back, and you mean to share it when the time is right.* `[NG]`
3. *A book, a journal, a letter — the writing you did or read that changed you. It travels with you.* `[LN]`
4. *A traveler who found you in the wilderness and changed something about why you stayed. You don't know where they went, and you'd like to know.* `[NG]`
5. *A teacher you never met — whose writing or example shaped your retreat — and whose grave or last residence you mean to visit.* `[LN]`
6. *A truth you uncovered that someone powerful would prefer stayed buried. You haven't decided whether the time to surface it has come.* `[N]`

**`investigator`**

1. *A case that broke wrong — the witness who lied, the lead that went dark, the verdict that came in wrong. You're still working it.* `[LG]`
2. *Someone you couldn't save. Their name is the answer to a question you haven't stopped asking.* `[NG]`
3. *The person who taught you the work — how to read a room, how to wait, how to know when to stop asking. You measure yourself against them.* `[LN]`
4. *A network of informants you've cultivated over years. They trust you, and you've stayed worthy of that trust at real cost.* `[LN]`
5. *A target who eluded you in a way that still doesn't make sense. The file is open, and the open-ness has gotten personal.* `[LN]`
6. *Files on people in power — kept private, kept current. The leverage they represent isn't something you've used, but you've thought about it.* `[LE]`

**`knight_of_the_order`**

1. *Your order. The vows you took within it are not metaphors, and the people who took them with you are family by oath.* `[LG]`
2. *The one who knighted you. Their standard, their counsel, their example — you carry all of it forward.* `[LG]`
3. *A blade, a sigil, an honor — the object that names you a knight. To lose it would be to lose yourself.* `[LN]`
4. *A squire or junior knight whose training you took on. Their honor is partly yours now, and you'd answer for it.* `[LG]`
5. *An enemy of the order you fought to a draw. The matter is unfinished, and you've been waiting for the rematch.* `[LN]`
6. *A senior of the order who used your loyalty for ends you didn't sanction. They still hold rank, and you still owe obedience, and the contradiction has been wearing on you.* `[LE]`

**`mercenary_veteran`**

1. *The crew you fought beside the longest. They're scattered now, but if any of them called, you'd come.* `[LN]`
2. *A contract that ended badly — bodies you saw, choices you made, money you took anyway. It sits with you.* `[N]`
3. *A weapon you've carried through more campaigns than you can count. It knows your hand, and you trust it.* `[N]`
4. *A child or family of the place where a campaign went bad. You send coin to them every year, and you've never told anyone.* `[NG]`
5. *A captain who hired you to do work you wish you hadn't done. They're still alive somewhere, and the account is open.* `[NE]`
6. *A weapons cache — buried, hidden, kept against a contingency. You haven't gone back for it, but you remember exactly where.* `[N]`

**`noble`**

1. *Your house. Its name, its honor, its standing — what was given to you, you intend to give back enlarged.* `[LG]`
2. *A sibling, a parent, or a spouse whose esteem matters to you more than the world's. You'd shape your life by their judgment.* `[LN]`
3. *The land your family is bound to — the people, the soil, the fortune that flows from both. You're answerable to all of it.* `[LG]`
4. *A retainer — old, loyal, undervalued by everyone but you. You'd defend their honor against any peer who slighted them.* `[LG]`
5. *A rival house whose injury to yours hasn't been answered. The accounting is overdue, and you intend to be the one to deliver it.* `[LE]`
6. *A scandal — a buried letter, a paid-off witness, a bastard child unacknowledged. The truth is in your keeping, and what you do with it is still open.* `[LN]`

**`outlander`**

1. *The wild country that raised you. You'll defend its borders against any kingdom that thinks it owns them.* `[N]`
2. *A specific place — a rock, a glen, a peak, a river bend — that you'd return to die at, if you got the choice.* `[N]`
3. *A teacher from your people who taught you to read the land. You speak their lessons aloud sometimes when no one's listening.* `[NG]`
4. *A creature, herd, or pack you came to know in your country. You think of them more often than people understand.* `[NG]`
5. *An outsider — a settler, a logger, a noble's hunter — whose presence in your country has not been answered. You haven't decided how it will be.* `[N]`
6. *Someone whose harm to your people hasn't been paid for. The land remembers, and you remember on its behalf.* `[NE]`

**`sage`**

1. *A library, an archive, a collection — somewhere the knowledge you love is stored. You'll defend it as if it were a person.* `[LG]`
2. *A question you've never been able to answer. It's the question, and you'll spend your life on it if you have to.* `[LN]`
3. *A mentor whose mind you measured your own against. They saw something in you, and you'd hate to disappoint them.* `[LN]`
4. *A student you taught who surpassed you. Their work is part of what you're proud of now, in a way you don't quite say aloud.* `[LG]`
5. *A rival scholar whose theories you've spent years dismantling. The dismantling has become its own kind of relationship.* `[LN]`
6. *A piece of dangerous knowledge you uncovered, and have not yet shared, and have not yet destroyed. The choice is still in front of you.* `[N]`

**`sailor`**

1. *The ship you served on the longest. Whether she's still afloat or rotting on a beach, she's yours.* `[N]`
2. *A captain or shipmate who saved your life. The debt is open, and you'll close it when the chance comes.* `[LN]`
3. *A port you'll always come back to — the harbor, the tavern, the person who waits there.* `[NG]`
4. *A crew member who didn't make it home, whose family doesn't know what happened. You've been meaning to tell them.* `[NG]`
5. *A captain who turned cruel — toward the crew, toward prizes, toward you. The reckoning is something you've thought about for years.* `[NE]`
6. *A treasure, chart, or cargo that should have been yours, and isn't. You know who has it, and you remember the way back.* `[CN]`

**`soldier`**

1. *The unit you served with. They're family in a way no one outside the line will ever understand.* `[LN]`
2. *A specific battle that defined you — the one you came out of changed. You'd return to that ground if you ever could.* `[LN]`
3. *A commander you would have died for. Maybe you nearly did. You measure every superior against them.* `[LG]`
4. *A civilian or refugee whose life intersected with your war and changed because of it. You think of them more than is reasonable, given how brief it was.* `[NG]`
5. *An officer who used your unit badly, and was promoted instead of held accountable. You haven't forgotten the name.* `[LE]`
6. *A pact with people from the other side — survivors, captives, witnesses — that no commander would have approved of. You'd honor it before any flag.* `[N]`

**`urban_bounty_hunter`**

1. *A mark who got away. You haven't forgotten the face, the gait, the laugh. One day they'll surface again.* `[N]`
2. *The first contract you ever closed. The mark, the pay, the moment you knew you were good at this.* `[N]`
3. *A handler or broker who put work your way when you needed it. You'd take their call before any other.* `[LN]`
4. *A mark you brought in alive who deserved a worse fate, and the family who haunted you for not delivering it. You owe them, you think.* `[NG]`
5. *A rival hunter who beat you to a contract that should have been yours. You've been waiting for them to slip.* `[N]`
6. *A list of names you keep — marks you've decided are worth your time when the right contract comes through. None of them know they're on it.* `[LE]`

**`urchin`**

1. *The other street kids who looked out for you. Most of them are gone, scattered or worse. You remember each of them.* `[NG]`
2. *A specific corner, alley, or doorway where you slept when nowhere else was safe. You go past it when you can.* `[N]`
3. *Someone who showed you kindness when no one else did — a baker, a watchman, a stranger. You'd lay down your life for them, and they have no idea.* `[NG]`
4. *A rival from the streets who's done worse than you have, and gotten away with it. You've thought about settling the account.* `[CN]`
5. *A child you took under your wing the way someone took you — and lost. Their name is one you carry.* `[NG]`
6. *A piece of valuable information you stole off a powerful person — one of your last good thieves' tricks. They're still looking for it.* `[CN]`

### 7.5 Flaws prompts

#### 7.5.1 Purpose

Theme-flavored prompts that the player can click to populate the **Flaws** field on Step 7. Per §5.7.6, this field uses Model A (click-to-fill, then editable).

Flaws describe *the character's weakness or vice* — the failure mode they fall into when stress, grief, temptation, or pressure get the better of them. Flaws should feel like real human limitations, not villain credentials. Each prompt names a specific failure pattern with implied texture about when and how it surfaces.

#### 7.5.2 Alignment indicators and coverage

Same notation as §7.2.2. Flaws spread across the full 9-square — flaws are the natural place for selfish, cruel, reckless, rigid, prideful, or cowardly patterns, all of which can read as recognizable human limitations rather than villain manifestos. Each theme offers flaws across distinct failure modes (vice, attachment-failure, coping pattern, loss of control) and across the alignment spectrum.

A note on tone: flaws should feel like things a *good person* could carry as easily as a bad one. Pride, suspicion, possessiveness, rigidity, evasiveness, and self-pity are flaws that belong in heroes. Evil-axis flaws here describe vices a person carries with awareness — cruelty noticed and not stopped, greed acknowledged and acted on — rather than declarations of villainy.

**Counts.** Prompts per theme range from 4 to 6 depending on the natural failure surfaces of the theme. No fixed count.

#### 7.5.3 Storage shape

Same as §7.2.3 — keyed by theme id, array of objects with `text` and `alignment` fields, in a constant export `THEME_FLAWS_PROMPTS`.

#### 7.5.4 The flaws prompts

**`acolyte`**

1. *You judge faithlessness harshly, and the judgment shows on your face before you've decided what to say.* `[LN]`
2. *You retreat into ritual when grief comes, and people close to you have learned not to expect comfort then.* `[LN]`
3. *You suspect your own doubts are tests, and you sometimes pray when you should be listening.* `[LG]`
4. *You assume your faith's authority extends further than it does, and you've offered counsel where it wasn't welcome.* `[LN]`
5. *You take pleasure in the discomfort of those who reject the faith, and you've stopped pretending you don't.* `[LE]`

**`charlatan`**

1. *You can't help running a small con on people you've just met — small enough that they don't notice, big enough that you do.* `[CN]`
2. *You assume everyone is performing the way you do, and you trust no one's stated reasons.* `[CN]`
3. *You leave when things get too real, and you've burned good relationships doing it.* `[CN]`
4. *You can't stop yourself from helping a mark you've already cheated, and the inconsistency has cost you crews who counted on it.* `[NG]`
5. *You enjoy the moment a mark realizes you've taken them, and you've stopped pretending the satisfaction isn't part of why you do it.* `[NE]`

**`city_watch`**

1. *You see crimes where there are only people, and you've made bad calls on bad evidence more than once.* `[LN]`
2. *You don't trust outsiders to a community, and you're sometimes the last to admit one belongs.* `[LN]`
3. *You hold grudges from the job — names, faces, slights — and you carry them long past their use.* `[LN]`
4. *You take orders from above without asking what they're for, and you've executed them and asked later, and the answers haven't always sat well.* `[LE]`
5. *You've leaned on people who couldn't push back — informants, suspects, neighbors — and you tell yourself you'll stop, and you haven't.* `[LE]`

**`clan_crafter`**

1. *You won't be rushed, even when speed is what the situation calls for.* `[LN]`
2. *You take other crafters' shortcuts as a personal insult, and you say so when you shouldn't.* `[LN]`
3. *You measure your kin by your own standards, and you've driven people away with the measuring.* `[LN]`
4. *You can't refuse a request from kin, even when the request is unreasonable, and you've worked yourself sick honoring family obligations.* `[LG]`
5. *You hide flaws in your work from buyers when you can get away with it, and the patterns you teach the next generation include the cover-up.* `[LE]`

**`criminal`**

1. *You take small things that aren't yours, even when you don't need them, and you don't feel bad about it.* `[CN]`
2. *You assume betrayal before it comes, and you've burned allies who never planned to turn.* `[CN]`
3. *You'll lie when the truth would serve you, just to keep the muscle of lying ready.* `[CN]`
4. *You can't stop yourself from giving away what you've stolen when you see real need, and the crews who've trusted you have learned to plan around it.* `[CG]`
5. *You hurt people who've crossed you more than the situation called for, and the part of you that did it didn't feel like a stranger.* `[CE]`

**`entertainer`**

1. *You need an audience to feel real, and you fade quietly in rooms where no one's watching.* `[CN]`
2. *You take criticism harder than the work deserves, and you hide it badly.* `[CN]`
3. *You can't resist a stage, even when the moment isn't yours, and you've stepped on others to get there.* `[CN]`
4. *You give too freely to younger performers — coaching, advances, references — and you've left yourself short doing it.* `[NG]`
5. *You manipulate audiences and lovers using the same craft, and you've stopped distinguishing between performance and intimacy.* `[NE]`

**`far_traveler`**

1. *You hold your home up as the standard, and you condescend without realizing you're doing it.* `[LN]`
2. *You leave before relationships deepen — there's always somewhere else to be — and you've broken hearts you'd swear you didn't mean to.* `[CN]`
3. *You distrust local customs you don't understand, and you've insulted hosts by acting on the distrust.* `[N]`
4. *You can't pass a stranger in trouble without stopping, and the stops have cost you appointments, contracts, and once nearly your life.* `[NG]`
5. *You consider yourself above local laws because you'll be gone before the consequences catch up, and sometimes you're right and sometimes you aren't.* `[CE]`

**`folk_hero`**

1. *You believe the story people tell about you, and you choose its lessons over what's actually in front of you.* `[CG]`
2. *You can't stand to be doubted, and you've gotten loud with people who only meant to ask.* `[CN]`
3. *You feel responsible for everyone in trouble, and you've gotten yourself badly hurt by acting on that.* `[NG]`
4. *You won't take a side in a fair disagreement, because both sides are your people, and your refusal has been read as cowardice it isn't.* `[NG]`
5. *You've started thinking the wrongs done to you and yours justify acts you wouldn't have done before, and the line keeps moving.* `[NE]`

**`guild_artisan`**

1. *You judge people by the quality of what they make or own, and the judgment is hard to hide.* `[LN]`
2. *You can't accept work you think is below your standard, even when you need it, and pride costs you coin you can't afford.* `[LN]`
3. *You're slow to forgive crafters who undercut the guild, and you carry the grudge into rooms it shouldn't enter.* `[LN]`
4. *You give work away to those who can't afford it more often than the guild approves of, and your books reflect it.* `[NG]`
5. *You overcharge wealthy clients to compensate, and you take a private satisfaction in the practice that goes beyond the math.* `[LE]`

**`haunted_one`**

1. *You go cold when the haunting surfaces, and people close to you have learned to wait it out alone.* `[N]`
2. *You assume the worst possible outcome reflexively, and you've sabotaged good things by preparing for their loss.* `[N]`
3. *You drink, work, walk, or fight too hard when the memory presses — whatever it is, you do it past the point of use.* `[CN]`
4. *You can't refuse to help anyone whose situation echoes what happened to you, and you've followed strangers into trouble for it.* `[NG]`
5. *You've started to believe that the ones who hurt you deserve worse than the law would give, and the belief has begun to look like a plan.* `[NE]`

**`hermit`**

1. *You retreat into silence when conversations turn loud, and people read it as judgment whether or not you mean it.* `[LN]`
2. *You believe your insight is harder-won than other people's, and the belief shows.* `[LN]`
3. *You can't stand crowds for long, and you'll find an excuse to leave even when the leaving costs you.* `[N]`
4. *You give your last to those in need, and you've left yourself without resources you'd need to survive a hard winter.* `[NG]`
5. *You've started to see most of humanity as the noise you went away from, and you've stopped trying to hide the contempt.* `[CE]`

**`investigator`**

1. *You can't let a question rest when something doesn't add up, and you've damaged friendships poking at things people wanted left alone.* `[LN]`
2. *You assume motive before evidence, and you've been wrong embarrassingly often without changing the habit.* `[LN]`
3. *You sleep poorly when a case is open, and the people around you live with what that does to your temper.* `[LN]`
4. *You take cases pro bono when the victim has no other recourse, and you've nearly bankrupted yourself doing it.* `[LG]`
5. *You've used what you've found out as leverage — small things, mostly, but the pattern is there, and you've stopped feeling bad about it.* `[LE]`

**`knight_of_the_order`**

1. *You measure others against your vows, and find them wanting in ways you struggle to keep to yourself.* `[LN]`
2. *You can't bend a code you've sworn to, even when bending would serve a greater good than keeping.* `[LN]`
3. *You expect deference from people who haven't agreed to give it, and the expectation embarrasses you when you catch it.* `[LN]`
4. *You won't refuse a request for protection, and you've taken on causes that couldn't be won, because refusing felt like a betrayal of what you swore.* `[LG]`
5. *You believe the order's enemies don't deserve the protections of the law, and you've acted on that belief in ways you wouldn't write home about.* `[LE]`

**`mercenary_veteran`**

1. *You count what you're owed before you count what you've been given, and you've burned employers over slights they didn't realize they'd given.* `[N]`
2. *You go cold during conflict, and people who care about you have to wait until the work is done to see you again.* `[N]`
3. *You don't form attachments to employers, locations, or causes — you've done it before, and the grief wasn't worth it.* `[N]`
4. *You can't refuse a contract that would protect noncombatants, even at cost — the work you used to do haunts you that way.* `[NG]`
5. *You stopped asking what the contract was for somewhere along the way, and you don't always like what you find out afterward — but you take the next contract anyway.* `[LE]`

**`noble`**

1. *You expect to be deferred to, and you treat people who don't as if they're being rude.* `[LN]`
2. *You retreat into the dignity of your station when you don't know what to say, and it makes you seem cold when you mean to seem composed.* `[LN]`
3. *You judge the unrefined harshly, even when the unrefined are doing the right thing better than you are.* `[LN]`
4. *You can't ignore a slight against your house, and the responses you've made have escalated situations that didn't need escalating.* `[LN]`
5. *You believe your house's interests outweigh most others, and the belief has shaped decisions you'd rather not have to defend.* `[LE]`

**`outlander`**

1. *You distrust city walls, city laws, and city people, and the distrust shows whether you mean it to or not.* `[CN]`
2. *You don't ask for help, even when not asking will cost you, because asking was something you learned not to do.* `[N]`
3. *You go quiet around crowds, and the quietness has been read as menace more than once.* `[N]`
4. *You can't refuse hospitality once it's been formally offered, and the obligation has taken you places you should have refused to go.* `[LG]`
5. *You've started solving problems with people the way you'd solve problems with predators, and the line between has gotten thin.* `[CE]`

**`sage`**

1. *You correct people when correcting them isn't useful, and you do it without registering that you're doing it.* `[LN]`
2. *You assume a problem can be reasoned through, and you've lost arguments — and people — by refusing to see when it can't.* `[LN]`
3. *You hoard books, notes, and rare facts the way merchants hoard coin, and you'd rather not lend than risk a loss.* `[LN]`
4. *You give your time to students who can't pay you, and you've left more profitable work undone for it.* `[NG]`
5. *You've published work that you knew would hurt people, and the publication felt clean to you because the work was true.* `[LE]`

**`sailor`**

1. *You drink harder than the situation calls for, and you've made decisions ashore that the deck-version of you wouldn't have.* `[CN]`
2. *You hold grudges across years and harbors, and you've started fights with people who didn't remember why you'd want one.* `[CN]`
3. *You go restless when you've been on land too long, and you've left jobs and people behind to chase the next ship.* `[CN]`
4. *You won't sail past survivors of a wreck without stopping, even when the contract says otherwise, and the captains who hire you have learned to expect it.* `[CG]`
5. *You've taken what wasn't yours from prizes the captain didn't know about, and you've gotten harder about it as the years passed.* `[CE]`

**`soldier`**

1. *You assume civilian situations have a chain of command, and you bristle when no one is in charge.* `[LN]`
2. *You go quiet when grief comes — the way the line goes quiet — and people who haven't served read it as not caring.* `[LN]`
3. *You can't tolerate disorder, and you've made enemies of people who weren't trying to fight you.* `[LN]`
4. *You can't refuse a fellow veteran's request, even when the request is unreasonable, and the obligation has cost you more than once.* `[LN]`
5. *You followed an order once that you should have refused, and you've stopped letting yourself think about it, and the not-thinking is its own kind of cost.* `[LE]`

**`urban_bounty_hunter`**

1. *You see marks where there are only people, and you've assessed strangers for capture-difficulty without meaning to.* `[N]`
2. *You go cold during a hunt, and friends have learned not to expect anything human from you until the work is done.* `[N]`
3. *You don't quit a contract once you've taken it, even when the right thing would be to walk away.* `[LN]`
4. *You can't refuse to help when a neighbor or friend is being preyed on by someone the law won't reach, and the work you do then is unpaid and dangerous.* `[NG]`
5. *You've taken contracts that you suspected weren't clean, and you've stopped checking whether your suspicions were right.* `[NE]`

**`urchin`**

1. *You hide food, even when you have plenty, and you've embarrassed yourself when someone has noticed.* `[N]`
2. *You assume kindness has a price, and you've insulted people who only meant to be kind.* `[CN]`
3. *You keep small lies running about your past, and the lies have outlived their usefulness without you stopping them.* `[CN]`
4. *You can't pass a hungry child without giving them what you have, and you've gone without yourself doing it more than once.* `[NG]`
5. *You take what you need without asking when no one is watching, and the streets-rules are still your rules even though the streets are behind you.* `[CN]`
6. *You've hurt people who reminded you of who hurt you, and you didn't always check whether they deserved what they got.* `[CE]`

### 7.6 Backstory moments

#### 7.6.1 Purpose

Eight theme-flavored moments per theme that the player can pick from a guided backstory authoring path. Per §5.7.6, this field uses **Model B with multi-select** — the player selects 1 or more moments (typically 2–4) from the curated list; each picked moment becomes a chip / token that can be reordered or removed; a "write your own" affordance lets the player author free-text moments alongside the curated picks.

A backstory moment is a **single past-tense sentence describing a load-bearing event** in the character's life before the campaign opened. The moment is the *what happened* — not the *what the character did about it* and not the *who the character became because of it*. That's where the player's voice comes in when they assemble their backstory from the picks.

#### 7.6.2 No alignment indicators

Backstory moments do not carry alignment indicators. Moments are *events* — what happened to the character or what they encountered — not character commitments or behaviors. The action a character takes in response to a moment, and the meaning the player assigns it when they write the backstory, is what carries alignment. The same moment ("you watched your home burn") can shape a Lawful Good knight, a Chaotic Neutral wanderer, or a Neutral Evil revenant, depending on what the player and the character do with it.

This is a deliberate departure from §7.2–§7.5's prompt structure. Moments are scaffolding for *story*, not declarations of *self*.

#### 7.6.3 Moment type coverage

Each theme's eight moments cover a deliberate range of formative event types so the player isn't picking from eight variations on the same beat. Across themes, the eight typically include:

- **Origin moment** — something foundational about how the character entered the theme
- **Formative gift** — a teacher, ally, opportunity, or kindness that shaped the character
- **Formative wound** — a loss, betrayal, failure, or harm that shaped the character
- **Defining choice** — a moment where the character had to decide who they were going to be
- **Almost-died** — a brush with mortality that left a mark
- **A relationship won** — a person, friendship, or attachment formed in the theme's life
- **A relationship lost** — a person, friendship, or attachment broken or ended
- **A kept secret** — something the character knows that hasn't been shared, an obligation unfulfilled, an unfinished thing

Not every theme uses exactly these eight categories. Some themes lean more naturally into different moment types — Hermit gets revelations and visions in place of relationships-won; Haunted One gets the encounter-that-haunted in addition to (not in place of) other moment types. The principle is range and load-bearing-ness, not strict category coverage.

#### 7.6.4 Voice and shape

Each moment is one sentence, past tense, second-person ("you"), 8–18 words. The sentence describes what *happened*, with concrete texture but without forcing a specific outcome on the player's interpretation.

Bracketed placeholders ([the master who taught you], [the village that raised you], [the one you served]) are intentional invitations for the player to fill in their own canon when editing.

#### 7.6.5 Storage shape

Recommend a single-file constant export `THEME_BACKSTORY_MOMENTS` keyed by theme id. Each entry is an array of 8 strings (no alignment field, since moments are alignment-agnostic):

```js
{
  soldier: [
    "You enlisted young — younger than they should have taken — because home wasn't a place you could stay.",
    "You held a line that should have broken, and you don't entirely know why it didn't.",
    // ... 6 more moments
  ],
  // ... 20 more theme entries
}
```

#### 7.6.6 The 168 backstory moments

**`acolyte`**

1. *You were brought to the temple young — by family who couldn't keep you, or by family who wanted to honor a vow.*
2. *A teacher there saw something in you that you couldn't see in yourself, and they wouldn't stop saying so.*
3. *You memorized a long passage on a dare, recited it perfectly, and discovered you loved the words more than the dare.*
4. *You watched a senior priest do something you knew was wrong, and the silence you kept afterward still bothers you.*
5. *You attended a death — held the hand, said the words — and you understood what the calling actually asks.*
6. *A revelation came to you in the quiet of a long night, and you've never quite been able to put it into words.*
7. *You were sent away from the temple — by the order or your own choice — and the leaving wasn't simple.*
8. *You carry a piece of the temple's authority with you, and you haven't decided whether you'll use it.*

**`charlatan`**

1. *You ran your first con as a child, on someone who should have known better, and they laughed when they figured it out — eventually.*
2. *A mentor — older, smoother, harder to read — taught you the work and disappeared before you could ask why.*
3. *You stole an identity to escape a worse life, and the borrowed name fit better than the one you'd been born with.*
4. *A mark you cheated took it harder than they should have, and you found out about it later from someone else.*
5. *You walked away from a long con at the moment you could have closed it, and you've never decided whether you regret it.*
6. *You met someone who saw through you on first sight, and you couldn't stop thinking about them after.*
7. *You took a job that was supposed to be simple, and what came next is the reason you no longer trust simple jobs.*
8. *You carry a piece of evidence — a letter, a mark, a name — that could undo someone powerful, and you haven't decided when.*

**`city_watch`**

1. *You took the watch oath because it was the only paid work that didn't ask you to leave the city you grew up in.*
2. *Your first sergeant was harder on you than on anyone else, and you didn't understand why until much later.*
3. *You walked the same beat for years, and you can still draw the map of every door, alley, and shopkeeper from memory.*
4. *A partner of yours died on the job, and the report didn't quite match what you remember happening.*
5. *You let someone go once who should have been brought in, and you've watched for them ever since.*
6. *A captain you respected made a call you couldn't follow, and you've carried the disagreement quietly.*
7. *You saved a child — or a stranger, or someone who wouldn't have known your name — and that's the moment people in your district remember.*
8. *You left the watch — discharged, retired, or simply walked off — and you still feel the routes in your feet.*

**`clan_crafter`**

1. *You were born into the work — your first toys were tools, your first lessons were patterns, your first words were the names of materials.*
2. *Your grandparent shaped your hands the right way the first time you held the work, and you can still feel their grip.*
3. *You ruined a piece of work that mattered, and the way the family handled the failure taught you more than the success would have.*
4. *You finished your first piece deemed worthy of the kin's name, and the moment is one of the few times you've seen [the elder] cry.*
5. *A traveler from outside the clan saw your work and tried to buy it for a price that astonished you — and the clan told you to refuse.*
6. *You disagreed with a kin elder over how the work should be carried forward, and the disagreement hasn't fully closed.*
7. *You watched the clan workshop burn — or flood, or fail — and what you saved from it is what travels with you now.*
8. *You carry a tool, a pattern, or a piece of unfinished work that belongs to the clan, and you'll bring it home when the time comes.*

**`criminal`**

1. *You stole because you were hungry, and the second time you did it you weren't, and you've thought about the difference ever since.*
2. *You were taken in by a crew when you had nowhere else to go, and they taught you faster than the streets would have.*
3. *You crossed someone you shouldn't have crossed, and the way it ended is why you don't talk about it.*
4. *A friend took the fall for something you did, and you haven't been able to make it right yet.*
5. *You walked away from a job at the last moment because of something you saw, and the crew has never quite trusted you the same way since.*
6. *You killed someone — by accident or otherwise — and the city remembers them better than it remembers you.*
7. *You did time, or did the running that was supposed to keep you out of doing time, and you came out of it changed.*
8. *You carry money, an item, or a name that someone is still looking for, and you haven't decided what to do with it.*

**`entertainer`**

1. *You performed for the first time in front of strangers when you were too young to understand fear, and the room loved you.*
2. *A teacher — a tutor, a master, a traveling performer — taught you the trade and left a piece of themselves in your work.*
3. *You bombed in front of an audience that mattered, and the silence is what you measure yourself against still.*
4. *You met a rival whose talent eclipsed yours, and you stopped competing and started studying them.*
5. *You loved someone in the troupe, the company, or the audience, and the leaving wasn't your idea.*
6. *You were paid by a powerful person to perform something you knew was wrong, and you said yes, and you've thought about it ever since.*
7. *You wrote, composed, or choreographed a piece that was yours alone, and people still ask you to repeat it.*
8. *You walked off a stage you swore you'd never return to, and the door is still open behind you.*

**`far_traveler`**

1. *You left home for a reason you don't always tell strangers — exile, mission, curiosity, grief — and the leaving was final.*
2. *The first language you tried to learn on the road broke you down, and the people who taught it to you were patient in ways you remember.*
3. *You met a traveler from somewhere even farther, and what they told you about the world keeps surfacing.*
4. *You were robbed early in the journey of something irreplaceable, and you've kept walking anyway.*
5. *You crossed a border you weren't supposed to cross, and the people who let you through took a risk for you.*
6. *Someone tried to claim you — to keep you, to marry you, to recruit you — and you said no, and the leaving was hard.*
7. *You found a place along the way that almost made you stop, and you've thought about going back.*
8. *You carry a token from home — a coin, a piece of cloth, a phrase — that you haven't shown anyone here, and you haven't decided when.*

**`folk_hero`**

1. *You were ordinary until the day you weren't, and the change happened faster than you could think it through.*
2. *The community that raised you taught you what mattered before you knew the word for it, and you carry that.*
3. *You stood up to someone the village had been afraid of, and the standing-up cost you in ways you didn't expect.*
4. *You saved someone who shouldn't have needed saving, and they're still alive because of it.*
5. *The story people tell about what you did is bigger than what actually happened, and you haven't corrected them.*
6. *Authority — a lord, a guard, a tax collector — came looking for you afterward, and you didn't run, but you didn't stay either.*
7. *Someone who saw it all happen has been writing letters about you ever since, and you haven't read them.*
8. *You carry a piece of evidence — a token, a relic, a wound — that ties you to what you did, and you can't quite let it go.*

**`guild_artisan`**

1. *You were apprenticed young by a family hoping the trade would give you a better life than they could.*
2. *Your master was demanding, exacting, and rare with praise, and the praise you did get is the standard you measure yourself against.*
3. *You completed your first commissioned piece at an age that surprised the guild, and the piece is still in the buyer's family.*
4. *A rival guild — or a rival within your own guild — undermined you in a way that's still not fully resolved.*
5. *You took an apprentice yourself, and they taught you something you didn't expect to learn.*
6. *A patron commissioned work you weren't ready to make, and you made it anyway, and the result is somewhere you can't easily revisit.*
7. *You broke from the guild — formally, informally, or just in spirit — and the break is part of why you're on the road.*
8. *You carry a piece of unfinished work, or a tool no one else can use, that won't let you forget what you came from.*

**`haunted_one`**

1. *Something happened to you when you were too young to understand it, and you've been understanding it ever since.*
2. *You survived an encounter that should have killed you, and the part of you that came back isn't entirely the same.*
3. *Someone close to you didn't survive what you did, and you haven't yet found a way to live with that.*
4. *You saw something — heard it, felt it, knew it — that no one around you saw, and the others stopped believing you a long time ago.*
5. *You've encountered the haunting again since the first time, and it knew you, and you knew it.*
6. *You found a person who believed you when no one else did, and what they said to you is what you've held onto.*
7. *You went looking for the source of the haunting once, and what you found out you haven't told anyone.*
8. *You carry a thing — a token, a wound, a name — that proves the worst of it actually happened, and you won't part with it.*

**`hermit`**

1. *You withdrew from the world at a moment you can name precisely, for a reason you can name only partly.*
2. *The place you went to felt like it had been waiting for you, and you stopped resisting that thought after a while.*
3. *You spent your first year there surviving the practical things — food, shelter, weather — before any of the inner work started.*
4. *A revelation came to you in the silence, and what it told you is part of why you came back.*
5. *Someone visited you in the wilderness — a traveler, a pilgrim, a fugitive — and what passed between you matters more than the visit's length suggests.*
6. *You nearly didn't make it through one winter or one fever, and the closeness changed what you came back to say.*
7. *You decided to leave the solitude on a specific day, for a specific reason, and the decision still feels right.*
8. *You carry something out of the place that taught you — a book, a stone, a phrase — and you don't show it to many.*

**`investigator`**

1. *Your first case was a small one, and the way it cracked open under questioning is what taught you that you could do this work.*
2. *A mentor — a senior investigator, a magistrate, a private patron — saw your mind early and made the work available to you.*
3. *You closed a case that had been open for years, and the relief on the family's face is something you measure success against.*
4. *You were wrong about a verdict once, and the wrongness cost someone who didn't deserve to pay, and you've never let yourself forget it.*
5. *A case turned dangerous — someone wanted it not to close — and the threats you took were real.*
6. *You met a witness who lied to you, and you let them, and what came of the letting still sits with you.*
7. *You walked away from a case that was about to close, because closing it would have hurt the wrong person, and the file is still open.*
8. *You carry notes from a case that never closed — names, dates, gaps in the record — and you mean to come back to it when you can.*

**`knight_of_the_order`**

1. *You were sponsored into the order by [a relative, a patron, a saved life] and you've spent your time there proving you belonged.*
2. *Your knight-master was harder on you than on the others, and you understand now what they were building.*
3. *You took your vows on a specific day, in a specific place, and you can recall the exact words spoken back to you.*
4. *You faced an enemy of the order in your first real campaign, and what you saw there — and what you did — shaped what came after.*
5. *A fellow knight died in a way you don't speak of, and you carry their pendant, signet, or last words with you.*
6. *You questioned the order's leadership over a single decision, and the question hasn't fully resolved.*
7. *You were sent on the errand, the pilgrimage, the campaign that brought you here, and your standing in the order travels with you.*
8. *You carry a relic, a banner, or an authority that ties you to the order across any distance, and you mean to honor it.*

**`mercenary_veteran`**

1. *You took your first contract because there was no other paid work that didn't ask you to be someone you weren't.*
2. *A captain or sergeant taught you the work — how to read a battlefield, how to read an employer, how to read a contract — and the lessons hold up.*
3. *You fought in a campaign whose name you don't speak, and what you did there is part of why you no longer drink in certain company.*
4. *A crew you fought with — the closest thing to family you had — broke up over money or a betrayal, and the scattering still hurts.*
5. *You were left for dead by an employer who counted you as expendable, and the employer is still alive somewhere.*
6. *You took a contract you knew was bad and went through with it anyway, and the bad outcome sits with you.*
7. *You walked away from the work — discharged, broke, done — and you walked back into it within the year.*
8. *You carry a weapon, a coin, or a name from a campaign that ended badly, and what to do with it is still open.*

**`noble`**

1. *You were raised in a household that taught you who you were before you could tell anyone else.*
2. *A tutor or governess shaped your mind in ways the family didn't fully approve of, and you remember them more clearly than the family wishes you would.*
3. *You attended court — a coronation, a wedding, a tribunal — at an age when you were old enough to understand and young enough to be marked by it.*
4. *A scandal touched the family — yours, a sibling's, a parent's — and the household handled it in ways that shaped how you see honor.*
5. *You were promised to someone, or for something, and the promise is unresolved.*
6. *You broke with a family decision, quietly or loudly, and the break is part of why you're on the road.*
7. *You inherited or lost something — a title, an estate, a name — that has not yet finished playing out.*
8. *You carry a signet, a letter, or a writ that ties you to the house, and you haven't decided how openly you'll wear it.*

**`outlander`**

1. *You were born to a people for whom the wild was home, and the lessons came before the words for the lessons.*
2. *A teacher among your people — an aunt, an elder, a hunter — taught you to read the land, and you can hear their voice when you slow down.*
3. *You survived an encounter with the wild — a beast, a storm, a season — that should have ended you, and what came after is who you became.*
4. *You watched something happen to your home — encroachment, change, harm — that taught you what the outside world was capable of.*
5. *You took on a responsibility for your people younger than was customary, and you carried it without complaint.*
6. *You met an outsider — a traveler, a trader, a refugee — and what they told you about the wider world was the first crack.*
7. *You left your land for a reason that mattered, and you'd return if the reason resolved.*
8. *You carry a token of your home — a stone, a feather, a piece of bone — and the place is in it whenever you hold it.*

**`sage`**

1. *You were drawn to learning before anyone taught you to be, and the first book or scroll you encountered changed something permanent.*
2. *A master, library, or institution took you in and gave you access to materials that shaped the rest of your work.*
3. *You posed a question that the people around you couldn't answer, and the impossibility of the question is what set the rest of your career in motion.*
4. *You discovered something — an error in a record, a forgotten reference, a contradiction — that not everyone wanted brought to light.*
5. *A rival, a peer, or a doubter pushed you to refine your work, and you've never quite stopped competing with them in your head.*
6. *You traveled to a place — an archive, a ruin, a meeting of scholars — that proved as important as anyone said it was.*
7. *You broke with an institution over a question of truth or method, and the break is unresolved.*
8. *You carry notes, a manuscript, or a translation that no one else has fully seen, and the timing of when to share it is still in your hands.*

**`sailor`**

1. *You went to sea because home wasn't a place you could stay, or because the sea was the only thing your family knew, or because someone you respected made it look possible.*
2. *Your first ship's captain or first mate taught you the trade with patience some sailors never get, and you measure yourself by what they expected.*
3. *You survived a storm that took shipmates with it, and you can still hear the sounds it made.*
4. *You held the watch through a quiet ocean night and felt something the daytime sea doesn't show, and you can't explain it cleanly.*
5. *Mutiny, desertion, or scandal touched a ship you served on, and what you did during it is part of why you no longer serve in certain harbors.*
6. *You found a port that almost stopped you — a person, a place, a possibility — and you've thought about going back.*
7. *You walked off a ship for the last time after years of service, and the leaving was either your call or someone else's.*
8. *You carry a piece of a ship, a knot, a phrase, or a token from a captain who mattered, and the sea is in it.*

**`soldier`**

1. *You enlisted young — younger than they should have taken — because home wasn't a place you could stay.*
2. *A drill instructor or first sergeant shaped you into something you wouldn't have become on your own, and you carry that shaping consciously.*
3. *You held a line that should have broken, and you don't entirely know why it didn't.*
4. *You watched the unit beside you take losses you somehow avoided, and the survivor's debt is still open.*
5. *You were given an order that you executed, and you've thought about it since — sometimes you'd give it again, sometimes you wouldn't.*
6. *You came home or were discharged in a way you weren't ready for, and the return wasn't the relief everyone said it would be.*
7. *You stayed in touch with the people you served with for as long as you could, and the names you've lost contact with weigh on you.*
8. *You carry insignia, a trophy, or a letter that ties you to the unit, and the unit is what the object means.*

**`urban_bounty_hunter`**

1. *You took your first contract for a reason you can name — debt, hunger, revenge, opportunity — and the work suited you in a way that surprised you.*
2. *A handler or older hunter taught you how to read marks and how to read brokers, and they're still alive somewhere if you ever needed them.*
3. *You closed a contract that no one else had been able to close, and the reputation that came with it changed what work was offered.*
4. *A mark you brought in turned out not to be the person the contract claimed, and finding that out came too late.*
5. *You hunted someone you knew personally — by accident or otherwise — and the moment of recognition is one you don't talk about.*
6. *A rival hunter beat you to a contract that should have been yours, and the rivalry hasn't fully closed.*
7. *You walked away from a contract once you understood what it actually was, and the broker who hired you noticed.*
8. *You carry a name — on a list, in your head, in a folded paper — that's still open, and you'll close it when the chance comes.*

**`urchin`**

1. *You don't fully remember when you became a street kid — only that the door closed, the family ended, the place stopped being yours.*
2. *Another child took you in when no one else did, taught you the rules of the streets, and was the first person you'd have died for.*
3. *You stole something you needed and got away clean, and the success is the moment you understood what you were going to be.*
4. *Adult kindness reached you once — a baker, a watch officer, a stranger — and you remember the face better than the food or the coin.*
5. *You watched another street kid disappear, taken, killed, or worse, and the disappearance is something you still see in unguarded moments.*
6. *You hid in a place — a rooftop, a cellar, an alley — for a number of nights you'd rather not count, and you remember the smell of it.*
7. *Something changed — luck, an opportunity, a stranger's offer — that gave you a way out, and you took it without quite knowing why you trusted it.*
8. *You carry something from the streets — a coin, a token, a small habit — that proves you came from there, and you have not yet decided if you'll let it go.*


## 8. Engineering notes summary

This section consolidates engineering-relevant decisions and contracts that appear throughout the spec. Code reading this section should also read the per-step engineering notes in §5 — the per-step entries are authoritative for step-specific behavior.

### 8.1 Data model deltas

#### 8.1.1 `creation_phase` enum expansion

Existing values: `'active'`. After Phase 0: confirmed as `'active'` only (not `'prelude'` despite older docs — see Phase 0 ship notes).

Phase 2 adds two values:

- `'creating'` — manual-mode mid-creator-flow characters (created at Step 1 advance with valid name + gender)
- `'ready_for_primary'` — Prelude-played, creator-unfinished characters (set by transition service on `[PRELUDE_END]`)

Final enum: `'active' | 'creating' | 'ready_for_primary'`.

Migration: additive only. No data backfill required — existing rows stay at `'active'`.

#### 8.1.2 New: dedicated heirloom table

A new table for heirlooms acquired during the Prelude that become candidates in Step 6 handoff mode. Suggested name: `prelude_canon_heirlooms` (Code's call on final naming).

Suggested schema:

```
id INTEGER PRIMARY KEY
character_id INTEGER FK
name TEXT
type TEXT ('weapon' | 'armor' | 'book_or_tome' | 'jewelry' | 'tool' | 'trinket' | 'other')
specific_item_ref TEXT (nullable; references equipment.json id when type is weapon/armor/tool, otherwise null)
description TEXT
awakening_hook TEXT (nullable)
acquired_at_age INTEGER
acquired_at_chapter INTEGER
status TEXT ('candidate' | 'carried_forward' | 'left_behind')
created_at TEXT
```

**Status semantics.** Candidates are surfaced in Step 6 handoff mode. Player picks one (or none) on submit; the picked one flips to `'carried_forward'` and persists into the character's primary-campaign inventory with `is_heirloom=true` and the `awakening_hook` carried through. Unpicked candidates flip to `'left_behind'` and are kept in the table for narrative reference (the AI may surface "remember the [object] you didn't take" in late campaign play, but no MVP mechanism wires this).

> **Producer-side wiring DEFERRED (chunk 5 ship note, 2026-05-02).** The table is created in chunk 5 (migration 049) and the consumer-side empty-state ships clean per §5.6.3. **No producer exists** — chunks 1–4 did not implement an `[OBJECT_HINT]` marker, and `PRELUDE_IMPLEMENTATION_PLAN.md` v4 §5d does not enumerate one. Heirloom candidates are populated by future scoped follow-up work; the choice between play-time marker, post-Prelude extraction pass, or hybrid is intentionally open and made on its own merits. Manual-mode heirloom authoring (§5.6.2) is unaffected — that path writes directly to the character's inventory and does not pass through this table. See `CONSOLIDATED_TODO.md` for the parking-lot entry.

#### 8.1.3 Heirloom inventory tag

The character's `inventory` (or equivalent) gets a boolean flag `is_heirloom` per item, plus an optional `awakening_hook` text field. These distinguish heirlooms from regular gear in the UI and in the AI prompt context.

Manual-mode heirlooms (authored in the creator's heirloom flow) are persisted directly to the character's inventory at submit with `is_heirloom=true`. They do not pass through `prelude_canon_heirlooms` since there's no Prelude history.

### 8.2 Pre-fill payload contract (handoff mode)

The transition service that runs on `[PRELUDE_END]` produces the payload the creator consumes in handoff mode. This contract is what the transition service must guarantee.

#### 8.2.1 Required payload fields

| Field | Type | Source | Used by |
|---|---|---|---|
| `setup_name` | string | `prelude_setup_data.name` | Step 1 (use-name affordance comparison) |
| `name` (effective) | string | Latest `[USE_NAME]` marker target, or `setup_name` if none | Step 1 (default fill) |
| `gender` | string | `prelude_setup_data.gender` | Step 1 (locked) |
| `race` | string | `prelude_setup_data.race` | Step 2 (locked) |
| `subrace` | string \| null | `prelude_setup_data.subrace` | Step 2 (locked when applicable) |
| `committed_theme` | string | `characters.prelude_committed_theme` | Step 3 (locked) |
| `theme_chapter_beats` | array of `{ chapter, reason }` | Top 2-3 weighted `[THEME_HINT]` reasons | Step 3 celebration card |
| `ancestry_feat_id` | string | Chapter-weighted `[ANCESTRY_HINT]` tally winner | Step 2 (locked) |
| `ancestry_chapter_beats` | array of `{ chapter, reason }` | Top 2-3 weighted `[ANCESTRY_HINT]` reasons | Step 2 celebration card |
| `class_suggestion` | string | Chapter-weighted `[CLASS_HINT]` tally winner | Step 4 (suggested-but-editable pre-fill) |
| `accepted_stat_bumps` | array of `{ magnitude, chapter_beat }` | `prelude_emergences` where `kind='stat'` and `status='accepted'`, with associated chapter-beat strings | Step 5 bump celebration card |
| `accepted_skill_bumps` | array of `{ skill, chapter_beat }` | `prelude_emergences` where `kind='skill'` and `status='accepted'` | Step 5 skills picker |
| `heirloom_candidates` | array of heirloom records (0–3) | `prelude_canon_heirlooms` where `status='candidate'` | Step 6 |
| `biography_seed` | array of `{ age, chapter, text }` | Generated by post-Prelude Opus call (per v4 plan §6 step 2) | Step 7 Backstory expansion |
| `canon_npcs` | array of NPC records | `prelude_canon_npcs` | Persists to campaign at submit |
| `canon_locations` | array of location records | `prelude_canon_locations` | Persists to campaign at submit |
| `canon_threads` | array of thread records | `prelude_canon_threads` | Persists to campaign at submit |
| `mentor_imprint_eligible` | boolean | True if `prelude_setup_data.authority_figure='mentor'` AND a `prelude_canon_npcs` row with `relationship='mentor'` exists | Triggers mentor imprint seeding at submit |

#### 8.2.2 Submit-time persistence (handoff mode)

When the player submits Step 8 in handoff mode, the server runs as one transaction:

1. Flip `creation_phase` from `'ready_for_primary'` to `'active'`
2. Persist final character state (name, class, subclass, L1 picks, ability scores with bumps applied and clamped at 18, skills, equipment, alignment, faith, lifestyle, physical description, optional expansions)
3. Apply heirloom: chosen candidate → inventory with `is_heirloom=true`; other candidates flip to `'left_behind'`
4. Generate primary campaign with Prelude inputs (per v4 plan §6a)
5. Persist `canon_npcs`, `canon_locations`, `canon_threads` into the campaign's tables
6. Seed `mentor_imprints` if eligible
7. Link character to campaign

If any step fails, the transaction rolls back; the character stays at `'ready_for_primary'`.

#### 8.2.3 Submit-time persistence (manual mode)

When the player submits Step 8 in manual mode:

1. Flip `creation_phase` from `'creating'` to `'active'`
2. Persist final character state (same fields as handoff)
3. Apply manual-mode heirloom (if authored) to inventory with `is_heirloom=true`
4. Generate primary campaign with no Prelude inputs (standard campaign-gen path)
5. Link character to campaign

### 8.3 Content data files

Six new content data files (or one consolidated module — Code's call):

| File | Purpose | Format | Approx. size |
|---|---|---|---|
| `themeGoldModifiers.js` | §7.1 — per-theme starting gold modifier | `{ themeId: number }` | 21 entries |
| `themePersonalityPrompts.js` | §7.2 — 63 personality prompts | `{ themeId: [{ text, alignment }] }` | 21 entries × 3 |
| `themeIdealsPrompts.js` | §7.3 — ~136 ideals prompts | `{ themeId: [{ text, alignment }] }` | 21 entries × 4–7 |
| `themeBondsPrompts.js` | §7.4 — ~126 bonds prompts | `{ themeId: [{ text, alignment }] }` | 21 entries × 4–6 |
| `themeFlawsPrompts.js` | §7.5 — ~106 flaws prompts | `{ themeId: [{ text, alignment }] }` | 21 entries × 4–6 |
| `themeBackstoryMoments.js` | §7.6 — 168 backstory moments | `{ themeId: [string] }` | 21 entries × 8 |

The content in §7 is the source of truth; Code transcribes it into the data files. Recommend keeping the data files client-side under `client/src/data/` since the creator is fully client-rendered and the data is small enough to ship in the bundle without round-trips.

### 8.4 Variant Human bonus feat handling

When `race='human'` and `subrace='variant'`:

- Step 5 renders an additional subsection (§5.5.5)
- Picker filters general feats to those the character qualifies for, given current ability scores including racial bonuses but **excluding** Prelude bumps (bumps haven't been applied at the moment the picker renders)
- The picked feat persists alongside the ancestry feat from Step 2 — the character carries both at L1
- Sub-choices within the bonus feat (when applicable) are editable in both modes

The Variant Human bonus feat is independent of the Prelude — no Prelude tracking applies. In handoff mode, this picker behaves identically to manual mode.

### 8.5 Out-of-scope reminders

Repeated here as a checklist for Code, since they're easy to scope-creep into:

- **Avatar / character portrait** — deferred. No upload, no avatar UI in the creator.
- **Multiclassing at creation** — deferred. Creator commits a single class at L1.
- **Path picker for Knight of the Order in manual mode** — deferred. Path defaults to `'true'` at creation; runtime path-shift mechanism is post-MVP.
- **Earned-name marker / `[NAME_EARNED]`** — deferred. The use-name affordance in Step 1 captures equivalent player intent at creation time.
- **Heirloom awakening mechanism** — deferred. The `awakening_hook` field is captured and persisted; the mechanism that ripens an heirloom is post-MVP.
- **Physical description pre-fill from Prelude narration** — deferred. Player fills fresh in Step 7 in both modes.
- **Theme starting equipment** — `themes.js` carries no per-theme starting equipment. Confirmed against current data.
- **Stat cap raise above 20** — deferred to Mythic-tier onset (raises lifetime cap to 22). Phase 2 uses standard 5e math, L1 cap 18, lifetime cap 20.
- **Point Buy generation method** — Phase 2 supports Standard Array and Manual only.

### 8.6 Open PM calls

Calls surfaced during spec authoring that are tracked here for transparency. None currently block engineering — all are either resolved or out of scope.

- **`creation_phase` migration coordination.** The migration that adds `'creating'` and `'ready_for_primary'` should land in the same Chunk 5 migration to keep schema atomic. Confirmed during spec authoring; no further call needed.
- **Heirloom table naming.** Suggested `prelude_canon_heirlooms`; final naming is Code's call during Chunk 5.
- **Bonds alignment coverage gap.** §7.4 has no `CG` or `CE` entries — call made during authoring (those alignments don't land naturally for bonds; not authored). If playtest surfaces a need, additional bond prompts can be authored in a later content pass.

---

## 9. Handoff to Claude Design

This section is for Claude Design — what we're asking you to mock, what's locked here that you should not deviate from, and where you have discretion.

### 9.1 What this spec asks Design to mock

A hi-fi mockup covering the following surfaces, in order of priority:

1. **The home page** (§3) — the single-section "Your characters" grid with three card states (active, in-progress manual, in-progress Prelude handoff) and the "Create New Character" entry as the first item.
2. **Screen 2 — path choice** (§4) — the two-card layout with framing line, Prelude card on the left, Campaign card on the right, back affordance.
3. **The eight creator steps** (§5.1–§5.8) — manual mode and handoff mode for each. Where the two modes differ (Steps 1, 2, 3, 4, 5, 6, 7, 8), mock both.
4. **Step 8 review** — the preview card (character-sheet-shaped summary) plus the editable summary list with edit affordances. Both modes.
5. **Cross-cutting interactions** (§6) — Save and exit, Cancel/discard, the in-progress card resume flow.

The deliverable is a hi-fi mockup, not a wireframe. Per `PROJECT_BRIEF.md` decision principle #5: hi-fi locks the visual language and leaves less interpretation for Code.

### 9.2 What Design has discretion over

Visual language, motion, micro-interaction patterns, component-level treatment, and visual weight are Design's calls. Specifically:

- **Visual language overall** — color, typography, iconography, spacing, density, decorative treatment. The spec does not commit to any of these. The project does not currently have a unified design system; this work may produce one.
- **Card visual treatment** — the home page's three card states (active, in-progress manual, in-progress Prelude handoff) need to read at a glance. Design picks the differentiation pattern (badge, ribbon, border treatment, desaturation, etc.). The two in-progress states can share visual treatment if Design judges that simpler.
- **Celebration card visual weight** — the spec specifies what celebration cards say and where they sit (above the locked field). Visual treatment — animation, decorative elements, color, typography — is Design's call. The cards should feel like honoring a moment, not like a system notification.
- **Standard Array UX pattern** — §5.5.6 explicitly delegates this. Propose a draggable-chip, assignable-pool, or similar treatment that makes assignment visible and bound. Existing dropdown-per-score remains as fallback if the proposed pattern is meaningfully complex.
- **Step 8 preview card layout** — the spec specifies what the card displays (character-sheet-shaped summary with name, race, theme, class, abilities, skills, equipment, alignment, faith, lifestyle, physical description, optional expansions). Layout, hierarchy, and visual evocation of "this is who you'll be playing" are Design's calls.
- **Submit button copy** — operational ("Create character") in manual mode, in-fiction ("Begin," "Step into the world") in handoff mode, or unified across both. Design picks. Whatever the final copy, it should sit naturally with the visual register.
- **Edit affordance shape** — text label or icon next to each section group on Step 8's editable summary list. Design's call.
- **Heirloom picker visual pattern** (handoff mode) — 1-3 candidate cards with the "carry one forward, or leave them all behind" callout. Card layout, comparison treatment, and the "leave them all behind" affordance are Design's calls.
- **Step 7 expansion toggle visual** — the five collapsed/expanded toggles for personality, ideals, bonds, flaws, backstory. Visual treatment of the open/closed state, of the prompt list within each, and of how alignment indicators render are Design's calls (see §9.4 for specific notes on alignment indicator rendering).
- **In-progress card resume CTA** — the affordance that resumes creator flow. Design picks the pattern (a CTA on the card, a tap-to-resume default, etc.).
- **Narrative-continuity copy card dismiss affordance** (Step 4 handoff mode) — the small "✕" or "this doesn't fit" link. Design's call on which.
- **Diablo 4-style "Create New Character" entry** — visually distinct from existing character cards but in the same grid container. Design's call on exactly how that distinctness reads.

### 9.3 What Design does NOT have discretion over

These are locked here and should carry through verbatim into the mockup. Deviations should come back as questions, not implementations:

- **Player-facing copy.** All help text, celebration card text, narrative-continuity copy lines, heirloom callouts, the Step 8 handoff callout, the Screen 2 framing and card bodies, the use-name affordance copy. Verbatim.
- **The eight-step structure.** Eight steps in the order specified (Identity → Ancestry → Theme → Class & Calling → Ability Scores → Equipment → Identity Details → Review). No step combinations, no step splits.
- **Mode shape rules.** Which fields are locked, suggested-but-editable, or fully editable in handoff mode (the field-treatment matrix in §2.3). These define the experiential difference between modes and are not visual.
- **Required vs. optional field designations.** Per the per-step field tables in §5.
- **Field validation rules.** Per the per-step field tables in §5.
- **The home page's single-section structure.** No splitting in-progress characters into a separate section. All characters in one grid, differentiated by card treatment (per §3.1, locked decision).
- **Screen 2's two-card-only layout.** No third path, no "skip Screen 2" option, no condensing into a single dropdown. The path choice is deliberate and gets its own screen.
- **The dismissable-but-default-visible narrative-continuity copy** (Step 4 handoff mode). The card is visible by default; the dismiss affordance exists; once dismissed it stays dismissed for the session. Per §5.4.3.
- **The 21 themes.** The theme list comes from `themes.js`. Design renders all 21 in Step 3 (manual mode); only 19 ever arrive via handoff (knight_of_the_order and haunted_one excluded per Decision D).

### 9.4 Specific design questions worth surfacing

A handful of patterns where Design's first proposal will benefit from discussion before final mockup:

#### 9.4.1 Alignment indicator rendering (§7.2 – §7.5)

Each prompt in personality / ideals / bonds / flaws carries a 9-square alignment indicator (`LG`, `NG`, `CG`, `LN`, `N`, `CN`, `LE`, `NE`, `CE`). The spec asks: always-visible, modest visual weight, scannable. Specifically open:

- Pill / chip / colored tag / muted-type label — pick one.
- If color-coded, what color logic? (Good = warm, Evil = cool? Lawful = blue, Chaotic = orange? Aligned with broader 5e alignment convention?) Recommend whatever lands cleanly with the rest of the visual system.
- Tooltip on hover that expands the abbreviation to the full name (e.g., `LG` → "Lawful Good")? Likely yes, but Design's call.

#### 9.4.2 Backstory moments multi-select pattern (§5.7.6)

Model B with multi-select: player picks 1+ moments from the curated list of 8 per theme; each picked moment becomes a chip / token; chips can be reordered and removed; "write your own" affordance lets the player author free-text moments alongside.

The unresolved pattern question: how does the picked-moments list compose into the final backstory textarea? Three options to evaluate:

- **Linear list** — moments render as bullets or short lines in the textarea, in the order picked.
- **Compose-into-prose** — moments concatenate into prose with light connective tissue ("Years later," "Then,"). Risk: forces a temporal interpretation Design and the player may not want.
- **Token-and-prose hybrid** — moments live as tokens above the textarea; the textarea below is free for the player to write the connective prose themselves, with the tokens as scaffolding.

Recommend the **token-and-prose hybrid**. It honors the moment-as-event framing (moments aren't sentences in the backstory; they're scaffolding the player composes around). But Design has discretion to land on the pattern that visualizes best.

#### 9.4.3 Bump celebration card (§5.5.5)

The card displays N chapter beats and N dropdowns. The dropdowns are the interaction. Question: should the chapter beats and dropdowns be paired visually (one beat with its dropdown beneath, repeated N times), or separated (chapter beats listed, then dropdowns as a group)? Recommend paired — the player should associate each dropdown with the beat that earned the bump.

#### 9.4.4 Step indicator / progress UI

The spec doesn't commit to a step indicator pattern (1-of-8 progress dots, named-step breadcrumb, persistent left-rail step list, etc.). Design picks. The creator is linear with branching exits, so whatever pattern is used should accommodate Back, Save and exit, Cancel, and (on Step 8) jumps back to a prior step.

### 9.5 Information you'll want from the project

When mocking, Design may need:

- The 21 theme list and identity blurbs from `themes.js` for rendering Step 3's theme card preview.
- The class list and L1 mechanical-pick shapes from `classData.js` (or equivalent) for rendering Step 4's class card preview and L1 picks.
- The race / subrace list and ancestry feat list from `ANCESTRY_FEATS.md` and the source data file for Step 2.
- The `equipment.json` weapon / armor / tool catalogs for Step 6 heirloom specific-item picker.
- The 53-deity faith list from the Mythic piety system data for Step 7 faith picker.

These are pull-ins from existing project data — Design doesn't need to re-enumerate them, just render them.

### 9.6 What ships next after Design

Once Design's mockup is approved, this spec becomes the engineering brief for **Chunk 5 of Phase 2** (main creator integration). Code will:

1. Implement the migration that adds `'creating'` and `'ready_for_primary'` to the `creation_phase` enum and the `prelude_canon_heirlooms` table.
2. Build the new creator component tree (8 steps + home page redesign + Screen 2 + cross-cutting nav/save/resume), using Design's mockup as the visual contract.
3. Implement the pre-fill payload contract (§8.2) on the transition service side.
4. Transcribe the §7 content data into the six data files specified in §8.3.
5. Wire submit-time persistence (§8.2.2 and §8.2.3) including canon transfer and mentor imprint seeding.

Engineering chunks 1–4 of Phase 2 (running in a separate Code chat) cover Prelude marker work, transition service foundation, biography seed generation, and canon-thread wiring — all upstream of Chunk 5. The dependencies between chunks are sequenced; Chunk 5 starts when 1–4 are far enough along that the payload contract can be tested end-to-end.

---

## Document footer

**Version:** 1.0 (draft for design + engineering handoff)
**Authored:** 2026-05-02
**Companion docs:** [`PRELUDE_IMPLEMENTATION_PLAN.md`](PRELUDE_IMPLEMENTATION_PLAN.md) v4 (this spec implements §6 of that plan); [`DECISION_LOG.md`](DECISION_LOG.md) (Phase 1 Decisions 1–6 plus Phase 2 Pre-Engineering Decisions A–E plus Phase 2 spec-time decisions logged during this authoring pass).
**Next steps:** Hand to Claude Design for hi-fi mockup. Once mockup is approved, this spec is the engineering brief for Chunk 5 of Phase 2.

