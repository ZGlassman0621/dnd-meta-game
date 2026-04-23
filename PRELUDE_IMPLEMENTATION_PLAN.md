# Prelude-Forward Character Creator — Implementation Plan

**Date:** 2026-04-19 (updated with round-2 design decisions)
**Context:** Build a Fable-inspired pre-campaign childhood/adolescence phase where the player plays their character from age ~5 through ~21 across 7-10 sessions (3-5 hours each). Mechanics (stats, class, theme, ancestry feats, skills, values) emerge from play rather than being picked upfront. When the prelude ends, the player enters the existing character creator with emerged state pre-filled. The prelude is canon for the primary campaign.

**Inspiration:** Fable (childhood → adulthood arc, moral nuance) without Fable 2's binary good/evil dichotomy. Every choice carries real cost *and* real benefit — criminals may be surviving, guards may abuse power, family may disappoint, strangers may save.

---

## 1. Design goals (from conversation)

| # | Rule | Source |
|---|---|---|
| 1 | Age-bracket chapter structure: Early (5-8), Middle (9-12), Adolescence (13-16), Threshold (17-21) | Round 1 |
| 2 | Up to +2 per stat, never more. Not every stat gets a bonus. | Round 1 |
| 3 | Up to 2 skill proficiencies total from emergence — stacks with class/background | Round 1 |
| 4 | Class / theme / ancestry-feat emergence: pre-selected (never locked) in main creator | Round 1 |
| 5 | Setup questions mandatory + curated, with free-text override when curated doesn't fit | Round 1 |
| 6 | Mid-scene emergence commitment (not batched at chapter boundaries) | Round 1 |
| 7 | Cliffhangers at session ends | Round 1 |
| 8 | Combat absolutely included — street life, war, raiders | Round 1 |
| 9 | Non-binary decisions — no option is "the moral choice" | Round 1 |
| 10 | Everything canon — NPCs, setting, values carry into primary campaign | Round 1 |
| 11 | Separate prompt builder (`preludePromptBuilder.js`), not inline extension | Round 1 |
| 12 | Values tracker → alignment / ideals / bonds / flaws suggestion (editable) | Round 1 |
| 13 | Hybrid player agency — AI surfaces 2-3 options, player picks | Round 1 |
| 14 | Prelude is its own campaign-like flow; main creator runs after | Round 1 |
| 15 | **Opus generates a structured arc plan at setup end.** Sonnet plays within it — coherent beginning, middle, end. Not a rail; player choices flex the beats. | Round 2 |
| 16 | **Dice are used throughout the prelude** — combat, skill checks, saves. Everything rolls as in a normal D&D session. Stats are provisional (all 10s + racial + emergence so far); HP / AC / weapon damage scale with age. | Round 2 |
| 17 | **Tone is player-calibrated at setup** — a multi-select of 2-4 tone tags ("gritty + dark humor" / "epic + tragic + mystical" / "rustic + tender + whimsical", etc.). AI gets the composite as tone guidance. | Round 2 |
| 18 | **Chapter promises only apply to chapters 3-4** (adolescence + threshold). Chapters 1-2 open organically — a "what is this chapter about?" beat on a 6-year-old is jarring; on a 14-year-old it's natural self-reflection. | Round 2 |
| 19 | **Departures are non-tragic-compatible.** A departure can be a pilgrimage, a test, conscription, an exile, being ordered away, leaving for apprenticeship, a call to adventure, a political match, etc. Tragedy is one option among many — not the default. Parents can and often should survive into the primary campaign. | Round 2 |
| 20 | **Backstory is written as remembered childhood** (with gentle acknowledgment of distortion), not documentary. | Round 2 |
| 21 | **Values emerge as a narrative paragraph** at prelude end ("You have become someone who…"), not raw scores. | Round 2 |
| 22 | **Late-chapter hints weight more.** Chapter 4 [CLASS_HINT] / [THEME_HINT] / [ANCESTRY_HINT] count 2x, chapter 3 counts 1.5x, chapters 1-2 count 1x. The threshold self is more indicative of the adult self. | Round 2 |
| 23 | **Prelude mentor seeds the primary campaign's `mentor_imprints` table** — if a mentor emerges in the prelude, they're a canonical mentor imprint when the primary campaign begins. | Round 2 |
| 24 | **Prelude rolling summaries use a different summarizer template** than adventure sessions — they preserve character development, relationship shifts, values-forming choices, and emotional texture instead of plot / combat / quest beats. | Round 2 |
| 25 | **Emergence shapes the story as it happens.** Accepted stat/skill emergences and leading class/theme/ancestry tallies are injected into every turn's system prompt (the EMERGENCE SO FAR block) so the DM can lean upcoming scenes toward the character's emerging strengths. A character who develops Perception gets more noticing beats; a character trending toward "ranger" gets more wilderness scenes; a character with rising Loyalty gets more scenes testing it. Gentle lean, not heavy-handed — the arc plan still owns macro structure. By Chapter 3-4 the story should feel tailored to who the player has been playing. | v1.0.63 |
| 26 | **The prelude IS the tutorial.** Rolls should be frequent and waited-on. In Chapters 1-2, roll prompts are surfaced INSIDE the action with the skill named ("you could try to catch Moss's eye — that'd be a Perception check") so the player learns the skill→situation mapping. In Chapters 3-4, roll prompts go bare ("Roll Perception") because the player is fluent. The DC is never announced. Natural 1 = critical failure (funny/disaster per tone); natural 20 = critical success (epic per tone); 2-19 pass/fail against internal DC. The DM MUST wait for the reported die result before narrating outcome. | v1.0.63 |
| 27 | **Every DM response ends on engagement.** Exactly one of: (a) a direct question to the player, (b) a roll prompt, or (c) something happening TO/AROUND the character that demands response. Menus of actions the character could take are BANNED — that's the AI playing the PC. Even "being led" scenes preserve agency via the NPC's speech, a noticed detail, or an arrival beat. Atmospheric texture is fine in the BODY; the END forces engagement. | v1.0.63 |
| 28 | **Condensed 5-session structure with per-chapter engagement modes.** The prelude is 5 focused sessions (was 7-10): Ch1 OBSERVE (1 session), Ch2 LEARN (1), Ch3 DECIDE (2), Ch4 COMMIT (1). Each chapter has a primary engagement mode that constrains what kinds of scenes and choices belong there. **Ch1 OBSERVE + character-shaping choices** — the PC is 5-8, primary engagement is witnessing; character-shaping choices (hide/run, obey/defy, speak/stay-silent, attentive/drift, which-task-first) are essential but story-shaping choices (factions, quests) are forbidden; NO combat yet. **Ch2 LEARN + training combat** — the PC is 9-12, world widens; schoolyard scuffles and wooden-sword lessons appear; small consequential relationship choices. **Ch3 DECIDE + real combat** — the PC is 13-16, real agency, real stakes; bodies matter, wounds leave marks; alliances, oaths, irreversible acts. **Ch4 COMMIT + varied departure** — the PC is 17-21; the departure_seed offers non-tragic alternatives (enlistment, apprenticeship, pilgrimage, cure-finding, learning, exploration, quest, political match) and tragedy is only ONE option among many. Arc-plan generator and DM session prompt both carry these rules. | v1.0.76 |

---

## 2. Player flow (end-to-end)

1. **Home page** gets a new button: *"Start with a Prelude"* alongside the existing *"New Character"*.
2. **Prelude setup wizard** (one screen, 12 questions, mandatory curated with free-text fallback per field).
3. **Opus generates the prelude arc plan** — ~1-2k token structured JSON covering home world, per-chapter arcs (theme + 2-3 major beats + chapter-end moment), recurring threads, departure seed, character trajectory, and seeded emergences. Saved to `prelude_arc_plans`. Shown to the player as a *"Your Prelude has been shaped"* preview (can be re-rolled once if it doesn't land, capped to avoid shopping).
4. **Prelude session gameplay** — looks like DM Session but with prelude-mode visual cues (age in top bar, chapter indicator, values tracker, emergence toasts). Sonnet plays within the arc plan, using it as reference.
5. **Age advances narratively** — the AI decides when time compresses ("three years later…"), emitting `[AGE_ADVANCE: years=3]`. Chapter boundaries are triggered by age crossing thresholds. At chapter 3 and chapter 4 boundaries, the AI opens with a *chapter promise* beat — proposing the thematic throughline from the arc plan and inviting the player to confirm, redirect, or "see where it goes."
6. **Mechanical emergence** fires mid-scene via markers. Player gets a toast: *"Growing up milking cows has made you hardy — take +1 CON?"* with Yes / Not now / Never offer buttons.
7. **Session ends** on a cliffhanger — AI emits `[SESSION_END_CLIFFHANGER: "..."]`. Player saves and returns later.
8. **Prelude completes** when the AI emits `[DEPARTURE: reason="..." tone="..."]` followed by `[PRELUDE_END]` (typically near end of Chapter 4, around age 17-21). The departure is context-matched — pilgrimage, test, conscription, exile, ordered-away, apprenticeship-posting, call to adventure, political match, flight, or tragedy — not tragedy by default. AI writes a 3-5 paragraph backstory in *remembered* voice.
8. **Transition screen** — *"Your Prelude is Complete"* — shows backstory preview, emergence summary, values profile, and canonical NPCs/locations carried forward.
9. **Primary-campaign creator wizard** opens, pre-filled:
   - Race/subrace (locked — was set at prelude setup)
   - Class/subclass (emerged → pre-selected; player can change)
   - Theme (emerged → pre-selected; player can change)
   - Ancestry feat L1 (emerged → pre-selected; player can change)
   - Ability scores: player assigns standard array / rolled stats, then `+emergence` layers on top, clamped at normal racial-bonus caps
   - Skill proficiencies: class + background + up to 2 emerged skills (stack)
   - Backstory: AI-written, editable
   - Alignment + ideals + bonds + flaws: suggested from values tracker, editable
10. **Primary campaign creation** — standard campaign setup flow. The prelude's home setting, NPCs, and locations are seeded into the campaign's world before Opus runs full world-gen.

---

## 3. Data model

### 3a. Character extension

Migration adds columns to `characters`:
- `creation_phase TEXT` — `'prelude' | 'ready_for_primary' | 'active'`. Defaults to `'active'` for existing chars; `'prelude'` for new prelude chars.
- `prelude_age INTEGER` — current in-fiction age
- `prelude_chapter INTEGER` — 1-4
- `prelude_setup_data TEXT` (JSON) — the setup answers blob

### 3b. Emergence tracking

New table `prelude_emergences`:
```
id INTEGER PRIMARY KEY
character_id INTEGER FK
kind TEXT ('stat' | 'skill' | 'class' | 'theme' | 'ancestry' | 'value')
target TEXT (stat name, skill name, class id, theme id, ancestry feat id, value name)
magnitude INTEGER (e.g., +1 or +2)
reason TEXT (AI narrative justification)
game_age INTEGER (age at time of emergence)
session_id INTEGER FK (nullable)
offered_at_message_index INTEGER (which message in the session fired this)
status TEXT ('offered' | 'accepted' | 'declined' | 'declined_permanently')
created_at TEXT
```

New table `prelude_values` — rolling tally:
```
character_id INTEGER FK
value TEXT ('curiosity', 'loyalty', 'empathy', 'ambition', 'self_preservation', 'restraint', 'justice', 'defiance', 'compassion', 'pragmatism', 'honor', 'freedom')
score INTEGER (can go negative — e.g., acting against a value lowers it)
last_changed_age INTEGER
```

### 3c. Prelude arc plan (NEW — from round 2)

New table `prelude_arc_plans`:
```
id INTEGER PRIMARY KEY
character_id INTEGER FK UNIQUE
generated_at TEXT
model TEXT (e.g., 'claude-opus-4-7')
tone_tags TEXT (CSV — the player's selected tone tags)

-- Structured JSON columns (stored as TEXT, parsed on read):
home_world TEXT (JSON: {description, locals:[{name,role,description}], tensions:[...], threats:[...], mentor_possibility:{...}})
chapter_1_arc TEXT (JSON: {theme, beats:[...], chapter_end_moment, seeded_emergences:[...]})
chapter_2_arc TEXT (JSON: same shape)
chapter_3_arc TEXT (JSON: same shape + chapter_promise_prompt for the opening beat)
chapter_4_arc TEXT (JSON: same shape + departure_seed:{reason, tone, non_tragic_alternatives:[...]})
recurring_threads TEXT (JSON: [{name, description, spans_chapters, payoff_chapter}])
character_trajectory TEXT (JSON: {suggested_class, suggested_theme, suggested_ancestry_feat, notes})
seed_emergences TEXT (JSON: [{kind, target, confidence, narrative_anchor}])

regenerate_count INTEGER DEFAULT 0 -- max 1 re-roll allowed
```

The arc plan is **reference, not rail.** Sonnet consults it at session start, injects relevant chapter beats into context, and riffs within bounds. Player choices that diverge from the plan are allowed — the plan flexes. `seed_emergences` suggests to Sonnet which stats/class/theme/ancestry the arc is nudging toward; actual emergences still fire mid-scene based on played behavior.

### 3d. Canonical prelude elements

New table `prelude_canon_npcs`:
```
id INTEGER PRIMARY KEY
character_id INTEGER FK
name TEXT
relationship TEXT (parent, sibling, mentor, rival, friend, enemy, stranger, etc.)
age_at_prelude_end INTEGER (nullable if unknown)
description TEXT (AI-written)
status TEXT (alive / deceased / missing / unknown at prelude end)
```

New table `prelude_canon_locations`:
```
id INTEGER PRIMARY KEY
character_id INTEGER FK
name TEXT
type TEXT (home, village, city, region, landmark)
description TEXT
is_home INTEGER (boolean — the character's primary home location)
```

When the primary campaign is created, these feed directly into the campaign's `npcs` and `locations` tables as pre-existing canon.

### 3e. DM session integration

Reuse existing `dm_sessions` table. Extend `session_type` enum with `'prelude'`. No new table.

---

## 4. Setup wizard (pre-play)

All fields are mandatory. Each has a curated dropdown + "Other (write your own)" free-text fallback.

| # | Field | Curated options | Notes |
|---|---|---|---|
| 1 | First name / last name / nickname | Text + existing name generator | No AI fill — player owns this |
| 2 | Gender | Same options as main creator | |
| 3 | Race + sub-race | Same pickers as main creator | Drives ancestry emergence |
| 4 | Starting age | 5, 6, 7, 8 (player chooses — default 7) | Affects chapter 1 length |
| 5 | Birth circumstance | Noble scion · Merchant family · Artisan household · Farmer's child · Street orphan · Refugee · Temple foundling · Caravan child · Rural smallholder · Tenement child | Drives setting, parent availability, initial stats pressure |
| 6 | Home setting | Village · Town · City ward · Farmstead · Caravan · Temple grounds · Noble manor · Tenement · Monastery · Frontier outpost · Ship · Wilderness camp | Becomes canonical primary-campaign starting location |
| 7 | Region | Curated FR regions (Sword Coast, Cormyr, Tethyr, Waterdeep, Neverwinter Woods, the Underdark, etc.) + free text | |
| 8 | Parents (up to 2) | Name field + "unknown" toggle. Also: "living" / "died before you remember" / "present" dropdown | Orphans select "unknown" or "died" |
| 9 | Siblings | 0-N entries; each with name + rough age relative to PC | |
| 10 | 3 things they're good at (choose 3 or write your own) | Running · Climbing · Hiding · Noticing things · Making friends · Making things · Numbers · Stories · Fixing things · Calming animals · Calming people · Fast hands · Patience · Courage · Singing · Reading · Fighting · Sneaking · Quick thinking · Memory · Negotiation · Lying convincingly · (write your own) | Weighted toward initial class/theme affinity signals — NOT locked, just hints to the AI |
| 11 | 3 things they care about (choose 3 or write your own) | Family · Home · Freedom · Justice · Safety · Adventure · Learning · Friends · Animals · Honor · Faith · Power · Wealth · Art · Truth · Belonging · Proving themselves · Protecting the weak · Being left alone · Being known · (write your own) | Seeds initial values profile |
| 12 | Tone tags (pick 2-4) | Gritty · Dark humor · Hopeful · Epic · Quiet/melancholic · Tragic · Whimsical/fable-like · Political/intrigue · Rustic · Mystical · Brutal · Tender/intimate · Romantic · Eerie/uncanny · Bawdy · Spiritual | AI combines tags as composite tone guidance. "Gritty + dark humor" ≠ "epic + tragic + mystical" ≠ "rustic + tender + whimsical." Shapes both arc-plan generation and Sonnet's scene-level writing. |

The setup payload becomes `prelude_setup_data` JSON on the character row and is injected verbatim into the prelude system prompt *and* into the Opus arc-plan generator as input.

---

## 5. Prelude prompt builder (`preludePromptBuilder.js`)

Separate from `dmPromptBuilder.js`. Shares voice-palette infrastructure but has its own Cardinal Rules and marker set.

### 5a. Cardinal Rules (primacy block)

1. **NON-BINARY DECISIONS.** When the player faces a moral choice, every option has real cost and real benefit. Never label one option as "the right thing to do." Criminals may be surviving. Guards may abuse power. Family may disappoint. Strangers may save. Acts that feel wrong in the abstract may feel necessary in context — honor that.
2. **AGE-APPROPRIATE EVERYTHING.** The player character's inner voice, vocabulary, and attention span match their age. A 7-year-old has 7-year-old fears (dark rooms, adult anger, being lost). A 13-year-old has 13-year-old fears (humiliation, betrayal, not belonging). Do not write a 9-year-old like a world-weary adult.
3. **TIME COMPRESSION.** Not every day needs a scene. Pass weeks or months in two paragraphs when the texture is repetitive ("the summer passed in the rhythm of the fields…"). Intensity is earned through contrast, not constant.
4. **STAKES MATCH SCALE.** A lost toy, a broken friendship, a sharp word from a parent — these are devastating at the right age. Do not inflate childhood stakes into high fantasy. Do not diminish them either.
5. **EMERGENCE IS EARNED.** Mechanical hints (stat, skill, class, theme, ancestry, value) only fire when the player has actually demonstrated the behavior — not on authorial whim. If a hint fires without play behind it, the rule is being violated.
6. **COMBAT IS REAL AND ROLLED.** Street fights, farmyard raids, refugee ambushes, schoolyard beatings — combat happens when the setting warrants it, at every age. The player rolls dice as in any D&D session: attack rolls, damage, saves, initiative. Use provisional stats (all 10s + racial + emergence accrued) and age-scaled HP / AC / weapon damage (see §5e). A 7-year-old rolls an attack the same way a 17-year-old does — with lower numbers.
7. **TONE MATCHES PLAYER-PICKED TAGS.** The player selected 2-4 tone tags at setup — honor them. "Gritty + dark humor" asks for blunt prose with pockets of wry relief. "Epic + tragic + mystical" asks for elevated diction and weight. "Rustic + tender + whimsical" is warm and small-scale. Tone shapes word choice, scene pacing, NPC voice, the kinds of beats you reach for. Don't override the player's tone signal by drifting to a different register.
8. **DEPARTURES ARE NOT DEFAULT TRAGIC.** When chapter 4 ends, the character leaves — but the reason is shaped by the arc and the character's circumstances. It can be: a pilgrimage, a test, conscription into a war, an exile, a political match, an apprenticeship posting, a coming-of-age ritual, a call to adventure, a flight from consequences, or yes, a tragedy — but tragedy is one option among many. Parents can and often should survive into the primary campaign. Let the departure emerge from the story.

### 5b. Conversation handling (reuse from DM prompt)

Same 4-mode taxonomy: SPOTLIGHT / COUNCIL / CROSSTALK / WAIT. Same NPC voice palette integration. The child/adult/elder age-register work is CRITICAL here — a 7-year-old and their 40-year-old father should sound wildly different.

### 5c. Markers

| Marker | Purpose | Server effect |
|---|---|---|
| `[AGE_ADVANCE: years=N]` | Time compression jump | `prelude_age += N`; if chapter boundary crossed, `prelude_chapter += 1` |
| `[CHAPTER_END: summary="..."]` | Close a chapter | Persist summary, show chapter-end UI |
| `[STAT_HINT: stat=str magnitude=1 reason="..."]` | Stat emergence candidate | Insert into `prelude_emergences` as `offered`; UI shows accept/decline toast |
| `[SKILL_HINT: skill="Athletics" reason="..."]` | Skill emergence candidate | Same; enforces 2-total cap server-side |
| `[CLASS_HINT: class="ranger" reason="..."]` | Class affinity signal | Weighted tally; no immediate player action |
| `[THEME_HINT: theme="outlander" reason="..."]` | Theme affinity signal | Weighted tally |
| `[ANCESTRY_HINT: feat_id="dwarf_l1_stone_sense" reason="..."]` | Ancestry-feat affinity | Weighted tally |
| `[VALUE_HINT: value="loyalty" delta=+1 reason="..."]` or `delta=-1` | Value deltas | Upsert `prelude_values` |
| `[NPC_CANON: name="..." relationship="..." status="..."]` | Mark NPC as canonical | Insert `prelude_canon_npcs` |
| `[LOCATION_CANON: name="..." type="..." is_home=true]` | Mark location as canonical | Insert `prelude_canon_locations` |
| `[CHAPTER_PROMISE: theme="..." question="..."]` | Fires at the opening of chapter 3 and chapter 4 only. Proposes the thematic throughline drawn from the arc plan and invites confirmation/redirect. | UI renders a chapter-promise beat with Accept / Redirect / See-where-it-goes buttons |
| `[SESSION_END_CLIFFHANGER: "..."]` | Session wraps | Persist cliffhanger for next session's opening |
| `[DEPARTURE: reason="..." tone="..."]` | Character leaves their prelude life — must emit before `[PRELUDE_END]`. Reason is context-matched (pilgrimage / test / conscription / exile / apprenticeship-posting / political-match / call-to-adventure / flight / tragedy / etc.) | Persist departure record; flag character as `ready_for_departure` |
| `[PRELUDE_END]` | Prelude complete | Trigger transition flow |
| `[COMBAT_START]`, `[COMBAT_END]`, `[LOOT_DROP]` | Existing markers | Reused as-is (with age-scaled stats per §5e) |

### 5d. Server-side caps + tally weighting

- `[STAT_HINT]` rejected if that stat already has +2 accepted
- `[SKILL_HINT]` rejected if 2 skills already accepted
- `[CLASS_HINT]`, `[THEME_HINT]`, `[ANCESTRY_HINT]` are weighted tallies — no cap on firing, but the winning class/theme/ancestry is determined at `[PRELUDE_END]` by **chapter-weighted score**:
  - Chapter 1-2 hints count **1x**
  - Chapter 3 hints count **1.5x**
  - Chapter 4 hints count **2x**
  - Ties broken by recency (latest hint wins)
- `[VALUE_HINT]` has no cap — each value just accumulates.
- `[CHAPTER_PROMISE]` only fires at chapter 3 and chapter 4 boundaries. Server rejects and warns AI if it fires at chapter 1 or 2.
- On cap violation or misplaced chapter promise, the AI is informed via injected `[SYSTEM]` message so it knows to stop firing that category.

### 5e. Age-scaled provisional stats (NEW — from round 2)

Prelude characters use **real dice for everything**. They just have provisional stats until the primary creator runs.

**Provisional ability scores.** All 10s + racial bonus + accepted emergences. Example: a half-orc after accepting +2 STR and +1 CON from emergence has STR 12, DEX 10, CON 13, INT 10, WIS 10, CHA 10 (with Half-Orc's +2 STR / +1 CON baseline racial already in).

**Age-scaled HP.**
- Ages 5-8: `max_hp = 4 + CON_mod` (a 5-year-old is fragile)
- Ages 9-12: `max_hp = 6 + (2 × CON_mod)`
- Ages 13-16: `max_hp = 8 + (2 × CON_mod)`
- Ages 17-21: standard L1 HP (hit-die max + CON mod; class-default or 1d8 if class hasn't emerged yet)

**Age-scaled AC.**
- All ages: `AC = 10 + DEX_mod` (no armor unless specifically acquired in play)

**Age-scaled weapon damage.**
- Ages 5-8: unarmed 1 point; improvised weapons 1d2; small knives 1d3
- Ages 9-12: unarmed 1d2; improvised 1d3; knives/sticks 1d4
- Ages 13-16: standard 5e weapon damage, but -1 damage on STR-based attacks (kids don't hit as hard)
- Ages 17-21: standard 5e rules

**Enemy scaling.** Adult opponents are dangerous. A tavern bully at age 9 might be AC 12 / HP 20 — a 9-year-old PC should need courage, cleverness, allies, or a headlong flight. This isn't punishment; it's honesty. When combat goes badly, narrative outcomes (capture, flight, injury that shapes the character) replace character death. Server-side: add a soft floor that prevents child-age PCs from dying in combat against non-lethal foes (bullies, drunks, first fights). Lethal encounters are possible (a raider will kill a child) but flagged in the arc plan as weight-bearing moments.

Dice rolls are rolled by the player as usual (player rolls physical dice, tells the AI). The AI applies provisional modifiers based on current age and accepted emergences.

---

## 6. Transition flow (prelude → primary creator)

Triggered by `[PRELUDE_END]`. Steps:

1. **Aggregate emergences:**
   - Stats: sum of `magnitude` per stat where `status='accepted'`, capped at +2 per stat
   - Skills: first 2 accepted, extras ignored
   - Class: **chapter-weighted** `[CLASS_HINT]` tallies (chapter 4 = 2x, 3 = 1.5x, 1-2 = 1x) → pre-selected
   - Theme: same weighting → pre-selected
   - Ancestry feat: same weighting → pre-selected
   - Values: `prelude_values` score rankings → feed into values-paragraph generator
2. **Backstory generation (as *remembered childhood*):** Opus call with prelude chronicle summaries, arc plan, and canon NPCs → 3-5 paragraphs written in the voice of the adult character looking back. Gentle distortion is allowed and encouraged ("you remember her as taller than she was"; "the fight was probably shorter than it felt"). Dropped into the `backstory` field.
3. **Values paragraph + alignment/ideals/bonds/flaws suggestion:** Two Opus calls (or one combined call):
   - **Values paragraph:** A single paragraph narrative — "You have become someone who…" — surfacing the ranked values in human language, not raw scores. Shown at the transition screen and editable.
   - **Alignment + ideals + bonds + flaws:** from the same values profile + canon NPCs, generate a suggested alignment + one ideal + one bond + one flaw. All editable in the creator.
4. **Mentor imprint seeding:** If a mentor figure emerged in the prelude (NPC with `relationship='mentor'` in `prelude_canon_npcs`), insert a corresponding row into the existing `mentor_imprints` table at primary-campaign creation. The mentor is already established in the character's life.
5. **Canon NPCs/locations:** `prelude_canon_*` rows persist untouched. When the primary campaign is created (see §6.5 below), these feed directly into the campaign's world-gen.
6. **Character creator wizard opens** at Step 1 with the following state:
   - Name / gender / race / subrace: locked (set at prelude setup)
   - Class / subclass / theme / ancestry feat: pre-selected (editable)
   - Ability scores: player proceeds through standard array / roll normally; emergence bonuses layer on top at final calculation (clamped to normal caps)
   - Skills: class + background + emerged skills all shown as already-picked
   - Backstory: pre-filled (remembered-voice), editable
   - Alignment / ideals / bonds / flaws: pre-filled, editable
   - A purple "Prelude" badge on every pre-filled field shows the reason (hover tooltip: "Emerged because you spent four years apprenticed to a blacksmith")

### 6.5 Primary campaign world-gen receives prelude as input

Critical round-2 addition. The existing `campaignPlan.js` generator needs a new "post-prelude" mode: when a character has `creation_phase = 'ready_for_primary'` and is being assigned to a newly-created campaign, the campaign plan generator **receives as required input**:

- The prelude arc plan (home world, chapters, recurring threads, departure)
- `prelude_canon_npcs` (all parents, siblings, mentors, rivals, friends — with status at prelude end)
- `prelude_canon_locations` (home village, region, landmarks)
- The departure marker's `reason` and `tone`
- Emerged class/theme/ancestry (so the campaign's opening adventures are compatible with the emerged identity)
- Values paragraph (for tonal calibration)

Opus generates the primary campaign's world-gen *anchored* near the prelude's home region. The first session's opening scene picks up from the departure moment — "You left [home] [days/weeks] ago because [departure reason]" — so the primary campaign feels continuous with the prelude's ending.

When the creator wizard submits, `creation_phase` flips from `'ready_for_primary'` to `'active'`, mentor imprints are seeded, canon NPCs/locations are persisted into the campaign's `npcs`/`locations` tables, and the character is linked to the campaign.

---

## 7. UI components

### 7a. New
- `PreludeLanding.jsx` — pick between "New Character" and "Start with a Prelude"
- `PreludeSetupWizard.jsx` — the 12-question setup form
- `PreludeArcPreview.jsx` — shown right after setup: the Opus-generated arc plan summary (home world + per-chapter themes + a hint of the recurring threads). Has a "Re-roll (1 remaining)" button that regenerates the arc plan once if it doesn't land.
- `PreludeSession.jsx` — gameplay UI (extends/mirrors DMSession.jsx; own visual language)
- `PreludeEmergenceToast.jsx` — emergence candidate notification (Accept / Not now / Never offer buttons)
- `PreludeChapterPromise.jsx` — renders the `[CHAPTER_PROMISE]` beat at chapter 3/4 openings (Accept / Redirect / See-where-it-goes buttons)
- `PreludeValuesPanel.jsx` — slide-in panel showing accumulated values (raw scores visible during play; narrative paragraph only at transition)
- `PreludeChapterIndicator.jsx` — top-bar widget with age + chapter
- `PreludeTransitionScreen.jsx` — "Your Prelude is Complete" summary with backstory (remembered-voice), values paragraph, emergences, canon NPCs/locations, and CTA to proceed to main creator
- Pre-fill integration in existing `CharacterCreationWizard.jsx` (new props: `preludeState` → initial form data + "Prelude" badges on pre-filled fields)

### 7b. Reused
- Dice roller, combat tracker, condition panel, inventory panel (all operate identically, with age-scaled provisional stats)
- Voice palette / NPC rendering (with expanded age-register work — see Phase 4)
- Context manager (prelude sessions use a **prelude-tuned rolling-summary template** that prioritizes character development, relationship shifts, and values-forming choices over plot/combat/quest beats — same infrastructure, different summarizer prompt)

---

## 8. Testing strategy

Each phase ships with tests:

| Phase | Test types |
|---|---|
| Setup | Setup wizard field validation; prelude character creation round-trip |
| Markers | Marker detection unit tests (parallel to `marker-detection.test.js`); cap enforcement |
| Emergence | +2/stat cap; 2-skill cap; accept/decline flows; class/theme/ancestry tally math |
| Prompt | Prelude prompt includes setup data; age-appropriate rules present; separate from DM prompt |
| Transition | Prelude → main creator pre-fill correctness; NPC/location persistence into campaign |
| Integration | Full happy path: setup → N sessions → end → creator → primary campaign |

Total estimated new tests: 40-60 across the phases.

---

## 9. Phased rollout

The full scope is 50-85 hours of work. Breaking into phases gives us checkpoints to play-test and course-correct.

### Phase 1 (v1.0.41) — Scaffolding + Setup (~7-11 hrs)
- Migration: `characters.creation_phase`, `prelude_age`, `prelude_chapter`, `prelude_setup_data`; new tables `prelude_emergences`, `prelude_values`, `prelude_canon_npcs`, `prelude_canon_locations`, `prelude_arc_plans`
- Setup data files (`client/src/data/preludeSetup.js`) — curated option lists for all 12 questions including tone tags
- `PreludeLanding.jsx` + `PreludeSetupWizard.jsx` (12 questions, mandatory curated + free-text fallback, tone multi-select)
- Create/read prelude character; nothing playable yet
- **Play-test goal:** click *Start with a Prelude*, answer the 12 questions (including tone tags), see your character saved in prelude phase.

### Phase 2 (v1.0.42) — Arc plan + Core Play Loop (~16-22 hrs)
- **`preludeArcService.js`** — Opus call at setup completion → structured arc plan (home world, 4 chapter arcs, recurring threads, departure seed, character trajectory, seeded emergences). Respects tone tags. Stored in `prelude_arc_plans`. One re-roll allowed.
- `PreludeArcPreview.jsx` — post-setup screen showing arc summary with re-roll button.
- `preludePromptBuilder.js` with Cardinal Rules + setup data + arc plan reference injection
- `PreludeSession.jsx` UI (reuses dice roller, combat tracker, condition panel)
- Markers: `[AGE_ADVANCE]`, `[CHAPTER_END]`, `[CHAPTER_PROMISE]` (chapters 3-4 only), `[SESSION_END_CLIFFHANGER]`, `[NPC_CANON]`, `[LOCATION_CANON]`, `[DEPARTURE]`
- Chapter/age tracking, cliffhanger persistence, chapter-promise UI for chapters 3-4
- **Prelude-tuned rolling-summary template** — summarizer prompt tuned for character development / relationships / values instead of plot / combat / quests; fires when `session_type = 'prelude'`.
- Provisional stats engine: age-scaled HP / AC / weapon damage applied server-side; player rolls dice as normal.
- **Play-test goal:** play a session with real dice, experience age-scaled combat and skill checks, see a chapter-promise beat at chapter 3 opening, time passes, chapter ends on a cliffhanger, save and resume.

### Phase 3 (v1.0.43) — Mechanical Emergence (~10-15 hrs)
- Markers: `[STAT_HINT]`, `[SKILL_HINT]`, `[CLASS_HINT]`, `[THEME_HINT]`, `[ANCESTRY_HINT]`, `[VALUE_HINT]`
- Server-side caps (+2/stat, 2 skills)
- Chapter-weighted tally math (1x / 1.5x / 2x for chapters 1-2 / 3 / 4)
- `PreludeEmergenceToast.jsx` accept/decline flow
- `PreludeValuesPanel.jsx` live display (raw scores during play)
- Cap-violation feedback to AI via `[SYSTEM]` injection
- **Play-test goal:** real behaviors trigger real stat/skill/class hints; accepting one bumps the character; declining one is respected; hints fired in chapter 4 meaningfully outweigh chapter 2 hints.

### Phase 4 (v1.0.44) — Age-register voice + Time compression (~5-8 hrs)
- Age-register NPC voice palette extension (child / tween / teen / young-adult / adult / elder registers). Extends the existing voice palette system.
- Time-compression directives + worked examples in the prompt
- Tone-tag-aware scene writing (the AI respects "gritty + dark humor" vs. "epic + mystical" differently)
- **Play-test goal:** a 7-year-old's parents sound like adults, not other children; a month of farm work passes in a paragraph when the texture is repetitive; tone tags actually shift the prose register.

### Phase 5 (v1.0.45) — Transition + Integration (~10-15 hrs)
- `[PRELUDE_END]` flow (after `[DEPARTURE]` fires)
- Remembered-voice backstory generation (Opus)
- Values → narrative paragraph generation (Opus)
- Alignment / ideals / bonds / flaws suggestion (Opus)
- Mentor imprint seeding into existing `mentor_imprints` table
- `PreludeTransitionScreen.jsx` with full summary
- `CharacterCreationWizard.jsx` pre-fill integration with "Prelude" badges
- **Primary campaign generator accepts prelude context as required input** — extend `campaignPlan.js` to anchor world-gen near prelude home, respect canon NPCs/locations, open scene from the departure moment
- Canon NPC/location seeding into new campaign's `npcs`/`locations` tables at campaign creation
- **Play-test goal:** prelude ends on a satisfying departure (non-tragic allowed), transition screen shows remembered-voice backstory + values paragraph, main creator opens with everything pre-filled, primary campaign generates anchored to your home region with your prelude mentor already established.

### Phase 6 (v1.0.46) — Polish (~4-6 hrs)
- UI refinement based on play-test feedback from phases 1-5
- Edge cases: saving mid-emergence toast, resuming after a crash, editing prelude setup after play has started (probably disabled), emergence conflict (e.g., player accepted +1 STR and then the AI offers +2 STR in a later scene — second offer's magnitude gets auto-clamped)
- Test coverage gaps

---

## 10. Open design questions (park until needed)

- **Should the prelude be interruptible?** If you play 4 sessions and want to bail — do you get a "terminate prelude early" option that takes whatever has emerged and moves on? I lean yes, with a confirmation dialog.
- **Multiple preludes per user?** One prelude per character; no shared across characters. Should probably enforce this in the schema (unique constraint on `character_id` in emergence tables).
- **Save/load mid-scene emergence offer?** If an emergence toast is open when you save, does it persist? I lean yes — store offer state on the session config blob.
- **Can emerged class conflict with racial stat bonuses?** E.g., the character emerges as a Wizard (INT primary) but is a Half-Orc (STR/CON). Handled by suggestion-not-lock — player can still switch class in the primary creator.
- **How does the prelude's `[COMBAT_START]` interact with the main creator's starting-level assumption?** Prelude characters still emerge as L1 for the primary campaign. The prelude gives them experience and memories, not levels.
- **Multiplayer / shared characters?** N/A — solo game per CLAUDE.md.

---

## 11. Scope estimate summary

**Total: ~52-77 hours of focused implementation**, split across 6 phases, each independently testable. Round-2 updates added ~6 hours (Opus arc plan service, arc preview UI, prelude-tuned rolling summary template, age-scaled provisional stats engine, primary-campaign world-gen integration).

Ready to start Phase 1 on your confirmation. First change would be the migration + setup wizard skeleton.

---

## Changelog of this document

**Round 1 (initial plan):** design goals 1-14, player flow, data model, setup wizard (11 questions), prompt builder sketch, 5 initial Cardinal Rules, marker set, 6-phase rollout.

**Round 2 (this update):**
- Added design goals 15-24 (arc plan, dice throughout, tone calibration, chapter promises chapters 3-4 only, non-tragic departures, remembered backstory, values paragraph, late-chapter weighting, mentor imprint seeding, prelude-tuned summaries)
- Added setup question #12 (tone tags, multi-select, 16 options)
- Added data table `prelude_arc_plans`
- Added Cardinal Rules 6 (combat + dice), 7 (tone), 8 (non-tragic departures); revised original Rule 6 to reflect dice usage
- Added marker `[CHAPTER_PROMISE]` (chapters 3-4) and `[DEPARTURE]`
- Added section 5e (age-scaled provisional stats)
- Updated transition flow with remembered-voice backstory, values paragraph, mentor imprint seeding, chapter-weighted tallies
- Added section 6.5 (primary campaign world-gen receives prelude as required input)
- Updated UI components (arc preview, chapter-promise beat)
- Moved Opus arc-plan generation into Phase 2; restructured Phase 4 to focus on age-register voice + time compression; expanded Phase 5 with primary-campaign-gen integration
- Scope estimate revised from 46-71 → 52-77 hours
