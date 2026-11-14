# Prelude-Forward Character Creator — Implementation Plan

**Version:** v4 — Phase 1 reframe (2026-04-29)
**Supersedes:** v3 (2026-04-19, three rounds of design iteration). The earlier document is archived; design history is preserved in `DECISION_LOG.md`, entries dated 2026-04-29 (Phase 1 Decisions 1–6 plus tone description sub-deliverable).

**Context:** A solo-D&D-5e pre-campaign experience where the player plays their character from age ~6 through ~19 across three chapters and four sessions, in a Faerûn-anchored epic fantasy register. Mechanical commitments emerge from play; theme commits during the Prelude; class and level-1 choices commit at handoff. The Prelude is canon for the primary campaign and seeds long-term threads the world will hold across years of play.

**Inspiration:** Fable's promise of playable life development from childhood to adulthood, with relationships and choices that shape the character. The Prelude is intended to ship what Fable famously over-promised.

---

## 1. Outputs

The Prelude produces the following at completion. Every structural choice is accountable to this list.

### 1a. Tangible outputs (state at Prelude end)

| # | Output | Commit point |
|---|---|---|
| 1 | Theme committed | Ch3 commitment beat |
| 2 | Living biography seeded — appendable entries timestamped by in-fiction age and chapter | Generated at `[PRELUDE_END]` |
| 3 | Canon NPCs persisted with status (alive / deceased / missing / unknown) | Mid-play via `[NPC_CANON]` markers |
| 4 | Canon locations persisted (home + region + landmarks) | Mid-play via `[LOCATION_CANON]` markers |
| 5 | Canon threads persisted (long-term unresolved obligations) | Mid-play via `[CANON_THREAD]` markers |
| 6 | L1 ancestry feat chosen (gated on race/subrace; available throughout) | Player picks at any point post-setup |
| 7 | Up to +2 in up to 2 stats (reward for completion, server-capped) | Mid-play via `[STAT_HINT]` accept flow |
| 8 | Up to 2 skill proficiencies (reward for completion, server-capped at 2 total) | Mid-play via `[SKILL_HINT]` accept flow |

**Note on class.** Class does not commit during the Prelude. `[CLASS_HINT]` markers fire and accumulate as a chapter-weighted tally, which becomes the *suggested* class at handoff. Class, subclass, and final L1 choices commit at the post-Prelude character creator step.

**Note on alignment / ideals / bonds / flaws.** With the values tracker cut (see §4), alignment becomes a manual pick at handoff (standard 5e). Ideals / bonds / flaws are filled at handoff against the backstory. Emergent alignment from played behavior is parked for v2.0.0+.

### 1b. Felt outputs (what the player carries out)

1. The player can recount specific formative memories *and* a few non-formative "just good or bad" memories from the character's upbringing.
2. The player can talk about NPCs in their character's life — family, friends, mentors, guardians, captors, owners, employers, rivals — as if those NPCs are real, living people.
3. The player carries lessons or stories that shape how their character sees the world and reacts to other characters and factions.
4. The character's origin feels encapsulated. There is a *who*, a *why*, and a *where*.

### 1c. Functional outputs

The Prelude tutorialises the core mechanics:
- Basic combat (attack rolls, damage, saves, initiative — at age-scaled stats)
- Skill checks (introduced with named-skill hints in early chapters; bare prompts by Ch3)
- Roleplay (NPC voices, dialogue, in-character speech)

Party combat with companions is **not** a Prelude concern — companions don't appear in the Prelude. Tutorial coverage there falls to the early main campaign.

---

## 2. Player flow (end-to-end)

1. **Home page** offers *"Start with a Prelude"* alongside *"New Character"*.
2. **Setup wizard** — single screen with mandatory curated questions and free-text fallback per field. Captures name, gender, race/subrace, starting age, birth circumstance, home setting, region, parents, siblings, talents, cares, and authority figure (mentor/guardian/captor/etc.). The setup wizard is scheduled for a content + UX revisit at Phase 2 start; current question shape carried forward with two known changes (tone-tag question removed, authority-figure question added).
3. **Opus generates the Prelude arc plan** — structured JSON covering home world, three chapter arcs, recurring threads, departure seed, character trajectory, and seeded emergences. Stored in `prelude_arc_plans`. Shown to the player as an arc preview with a single re-roll allowed.
4. **Session 1 — Ch1 Childhood (ages ~6–10).** Establishing rhythm. Three or four scene snapshots compressed across the age range via `[AGE_ADVANCE]` markers. Meet parents, siblings, the place. One or two skill-check moments per scene (introduced as "you could try X — that's a Perception check"). No combat. Session ends on `[SESSION_END_CLIFFHANGER]`.
5. **Session 2 — Ch2 Adolescence (ages ~11–15).** Widening rhythm. Chapter-promise beat at session opening. Internal `[AGE_ADVANCE]` splits the session into two halves with different ages and emotional registers (e.g., 11–13 then 13–15) so consequences from the first half can land in the second. Combat introduces (training, schoolyard, first defensive moments) at age-scaled stats. Skill checks shift to bare prompts. Theme/class/ancestry hints accumulate. Session ends on `[SESSION_END_CLIFFHANGER]`.
6. **Session 3 — Ch3a Threshold, build (ages ~16–18).** Real rhythm. Chapter-promise beat at session opening. Real-stakes scenes accumulate. The irreversible act builds across the session and resolves at or near session end. Cliffhanger as the act lands.
7. **Session 4 — Ch3b Threshold, resolution (ages ~17–19).** Aftermath of the irreversible act. Theme commitment surfaces in the form of a lightweight in-line card: leading theme + 3 alternatives + "choose your own." Player commits. Departure beat plays out — shape and tone driven by the committed theme. Session ends with `[DEPARTURE]` followed by `[PRELUDE_END]`.
8. **Transition screen** — *"Your Prelude is Complete"* — surfaces the seeded biography entries, canon NPCs, canon locations, canon threads, ancestry feat suggestion, and emergence summary. CTA proceeds to the main creator.
9. **Main creator wizard** opens, pre-filled (locked or editable per field — see §6).
10. **Primary campaign world-gen** receives Prelude context as required input (see §6.5). The campaign opens with the character having traveled from the Prelude's home region — not at the moment of departure. The "you've been on the road for a while" beat is a campaign-opener concern, not a Prelude concern.

**Total Prelude length: 4 sessions, ~4–7 hours.** Length is an output of the design, not an input — these four sessions are what the locked outputs require.

---

## 3. Data model

### 3a. Character extension

Migration adds columns to `characters`:
- `creation_phase TEXT` — `'prelude' | 'active'`. Defaults to `'active'` for existing chars; `'prelude'` for new prelude chars. Phase 2 transition flips `'prelude'` → `'active'` (no intermediate state currently — see open questions in §10).
- `prelude_age INTEGER` — current in-fiction age
- `prelude_chapter INTEGER` — 1, 2, or 3
- `prelude_setup_data TEXT` (JSON) — the setup answers blob
- `prelude_committed_theme TEXT` — theme id committed at Ch3 (nullable until commitment fires)

### 3b. Emergence tracking

Table `prelude_emergences`:
```
id INTEGER PRIMARY KEY
character_id INTEGER FK
kind TEXT ('stat' | 'skill' | 'class' | 'theme' | 'ancestry')
target TEXT (stat name, skill name, class id, theme id, ancestry feat id)
magnitude INTEGER (e.g., +1 or +2; nullable for class/theme/ancestry hint kinds)
reason TEXT (AI narrative justification)
game_age INTEGER (age at time of emergence)
game_chapter INTEGER (1–3 — used for tally weighting)
session_id INTEGER FK (nullable)
offered_at_message_index INTEGER
status TEXT ('offered' | 'accepted' | 'declined' | 'declined_permanently')
created_at TEXT
```

The previous `kind = 'value'` is retired alongside the values tracker (see §4).

### 3c. Prelude arc plan

Table `prelude_arc_plans`:
```
id INTEGER PRIMARY KEY
character_id INTEGER FK UNIQUE
generated_at TEXT
model TEXT (e.g., 'claude-opus-4-7')

-- Structured JSON columns:
home_world TEXT (JSON: {description, locals:[{name,role,description}], tensions:[...], threats:[...], authority_figure:{...}})
chapter_1_arc TEXT (JSON: {beats:[...], chapter_end_moment, seeded_emergences:[...]})
chapter_2_arc TEXT (JSON: {chapter_promise_prompt, beats:[...], internal_age_jump_seed, chapter_end_moment, seeded_emergences:[...]})
chapter_3_arc TEXT (JSON: {chapter_promise_prompt, build_beats:[...], irreversible_act_shape, theme_commitment_handoff, departure_seed:{reason, tone}, seeded_emergences:[...]})
recurring_threads TEXT (JSON: [{name, description, spans_chapters, payoff_hint}])
character_trajectory TEXT (JSON: {suggested_class, suggested_theme, suggested_ancestry_feat, notes})
seed_emergences TEXT (JSON: [{kind, target, confidence, narrative_anchor}])

regenerate_count INTEGER DEFAULT 0 -- max 1 re-roll allowed
```

The arc plan is **reference, not rail.** Sonnet consults it at session start, injects relevant chapter beats into context, and riffs within bounds. Player choices that diverge from the plan are allowed; the plan flexes. `seed_emergences` suggests to Sonnet which targets the arc is nudging toward; actual emergences still fire mid-scene based on played behavior.

The `chapter_3_arc.irreversible_act_shape` field describes the *shape* of the act without naming the theme — the act has to land before the lens is chosen (per Decision 4 sequencing).

### 3d. Canonical Prelude elements

Table `prelude_canon_npcs`:
```
id INTEGER PRIMARY KEY
character_id INTEGER FK
name TEXT
relationship TEXT (parent, sibling, mentor, guardian, captor, employer, rival, friend, enemy, stranger, etc.)
age_at_prelude_end INTEGER (nullable if unknown)
description TEXT (AI-written)
status TEXT (alive / deceased / missing / unknown at prelude end)
```

Table `prelude_canon_locations`:
```
id INTEGER PRIMARY KEY
character_id INTEGER FK
name TEXT
type TEXT (home, village, city, region, landmark)
description TEXT
is_home INTEGER (boolean — the character's primary home location)
```

Table `prelude_canon_threads` (NEW — Decision 6):
```
id INTEGER PRIMARY KEY
character_id INTEGER FK
kind TEXT ('unresolved_loss' | 'blood_debt' | 'unfulfilled_oath' | 'unpaid_crime' | 'unfinished_relationship' | 'held_object' | 'held_secret')
subject_npc_id INTEGER FK nullable (references prelude_canon_npcs.id when applicable)
subject_location_id INTEGER FK nullable (references prelude_canon_locations.id when applicable)
subject_text TEXT (free-text for abstract subjects: "the soldier's medal", "the family name")
condition TEXT (what triggers the thread to ripen — e.g., "PC returns to home region after 5+ years", "PC encounters anyone bearing the family name")
weight TEXT ('minor' | 'notable' | 'major')
status TEXT ('active' | 'ripened' | 'resolved' | 'decayed')
created_at_age INTEGER
created_at_chapter INTEGER
description TEXT (the AI's narrative justification)
```

When the primary campaign is created, NPCs and locations feed into the campaign's `npcs` and `locations` tables. Threads transfer to a `campaign_threads` table (Phase 2 schema work) for the main campaign AI to consult.

### 3e. DM session integration

Reuse existing `dm_sessions` table. `session_type` enum includes `'prelude'`. No new table.

---

## 4. What the Prelude does NOT track

Cut machinery, recorded so we don't accidentally re-add it:

- **Values tracker.** The 12-value tally (`prelude_values` table), `[VALUE_HINT]` marker, chapter-weighted value scoring, and the values paragraph generation are all cut. The "what does this character believe" output is delivered through the backstory text and through the AI's accumulated knowledge of played behavior, not through a numeric tally. Emergent alignment from values is parked for v2.0.0+.
- **Tone tags.** The 16-tag multi-select setup question and per-prompt tone-tag injection are cut for MVP. Replaced by a single fixed tone description (see §7). Multi-tone selection returns at v2.0.0+.
- **Mentor as an emergent figure.** The previous design hoped a mentor would emerge from improvised play, then tried to seed `mentor_imprints` retroactively. Replaced by a setup-wizard question ("Who looms largest in your early life?" — parent / sibling / mentor / guardian / captor / employer / rival / no one). The arc plan is generated against the player's answer. The "no mentor" case is a legitimate setup choice, not a failure mode. `mentor_imprints` seeding (when applicable) happens at handoff.
- **Ch4 and the BECOME / BRIDGE phase.** The previous Round 3 reframe of Ch4 as a road-life adjustment phase is superseded. With class committing at handoff (not during the Prelude), Ch4's load-bearing reason for existing — committing the adventurer identity through road life — no longer applies. The "you've been on the road for a while" beat moves to the main campaign opener. The transient-canon flag for Ch4 NPCs is cut along with Ch4.
- **Theme commitment as a discrete full-screen UI moment.** The previous "Choose Your Path" card with leading theme + 3 alternatives + wildcard + "Other" + "See where it goes" defer is simplified. Now: a lightweight in-line card with leading theme + 3 alternatives + "choose your own." No wildcard, no defer, no full-screen takeover. Integrates into the Ch3b climax cluster.
- **Party combat tutorialisation in the Prelude.** Companions are not Prelude content. Party combat tutorial falls to the early main campaign.

---

## 5. Prelude prompt builder (`preludePromptBuilder.js`)

Separate from `dmPromptBuilder.js`. Shares voice-palette infrastructure but has its own Cardinal Rules, tone description, and marker set.

### 5a. Tone description (Phase 1 deliverable, locked)

The tone description is the prompt's authoritative tone signal. It replaces per-player tone-tag selection. Wired into the always-on prompt at the position previously occupied by tone-tag injection.

> Concrete details in this description are illustrative of register and texture. They are guidance for what kinds of things belong in scenes; they are not canon facts about the player's world. Specific places, names, NPCs, and circumstances come from the arc plan and the player's setup answers, not from this tone description.
>
> **What this tone is.** This is epic fantasy in the Forgotten Realms — a world with deep history, real gods, working magic, and ancient places that remember things humans don't. The map has been walked for thousands of years. There are ruins older than nations, artifacts whose owners are long dead, mountain ranges where dragons sleep, and crossroads where small choices have echoed for generations. *And* this world is also lived in: bread is baked, debts are owed, taverns smell of smoke, knees ache, and most people have never seen a wizard. The grand and the granular share the same scene. A child can grow up watching their father shoe horses and also know that a knight of an ancient order rode through their village last spring. Both things are real. The wonder doesn't make the mundane less true; the mundane doesn't make the wonder less wondrous.
>
> **What this tone is not.** It is not generic fantasy where the world arranges itself around the protagonist's importance. It is not high-camp parody, video-game-pastiche, or YA-coded fantasy that sands down moral edges to make them easier. It is also not grimdark — this world has light, beauty, decency, and people who help each other for no reason. It is not safe, either. Children in this world get hurt. Parents disappoint. Mentors die. Choices have lasting cost. The protagonist's age affects what they understand and how they feel, not what the world is willing to do to them. Do not soften consequences because the protagonist is young; a coming-of-age story in this world can include real loss, real fear, and real moral weight, and the best ones do.
>
> **Beats this tone reaches for.** Quiet scenes that earn their weight before the loud ones land. NPCs who are competent at their actual jobs, suspicious of strangers, occasionally generous, often tired — and a few who have seen things they don't talk about. Combat that is fast, dirty, and frightening at any age. Magic that costs something, that feels strange, that doesn't always behave. Old places that feel old. Legends that may or may not be true but are part of the cultural air. Moments of unexpected tenderness in hard places. Choices that cost something whichever way the player goes. Knights, monsters, gods, ruins, and rumors — alongside fields, kitchens, market days, and the work of being alive. The world is real; it does not negotiate. It is also full of wonder; honor that too.

The tone description is treated as living text. Playtesting may surface places where the AI mis-reads, over-leans on Faerûn-typical types, or underdelivers on a specific register. Revisions follow the same loop as the H7/H8 prose-quality work: identify the failure, adjust the text, re-validate.

### 5b. Cardinal Rules (primacy block)

The previous Cardinal Rule 2 ("age-appropriate everything") is superseded by the directive within the tone description's second paragraph and removed as a separate rule. The remaining rules:

1. **Non-binary decisions.** When the player faces a moral choice, every option has real cost and real benefit. Never label one option as "the right thing to do." Criminals may be surviving. Guards may abuse power. Family may disappoint. Strangers may save. Acts that feel wrong in the abstract may feel necessary in context — honor that.
2. **Time compression.** Not every day needs a scene. Pass weeks or months in two paragraphs when the texture is repetitive. Intensity is earned through contrast, not constant. Specific compression density per chapter is given in §5g.
3. **Stakes match scale.** A lost toy, a broken friendship, a sharp word from a parent — these are devastating at the right age. Do not inflate childhood stakes into high fantasy. Do not diminish them either. Stakes are real and load-bearing at every age.
4. **Emergence is earned.** Mechanical hints (`[STAT_HINT]`, `[SKILL_HINT]`, `[CLASS_HINT]`, `[THEME_HINT]`, `[ANCESTRY_HINT]`) only fire when the player has actually demonstrated the behavior — not on authorial whim. If a hint fires without play behind it, the rule is being violated.
5. **Combat is real and rolled.** Combat happens when the setting warrants it, at every age. The player rolls dice as in any D&D session: attack rolls, damage, saves, initiative. Use age-scaled provisional stats and weapon damage (see §5e). A 7-year-old rolls an attack the same way a 17-year-old does — with lower numbers.
6. **Departures are not default tragic.** When Ch3 ends, the character leaves — but the reason is shaped by the arc, the committed theme, and the character's circumstances. It can be a pilgrimage, a test, conscription into a war, an exile, a political match, an apprenticeship posting, a coming-of-age ritual, a call to adventure, a flight from consequences, or yes, a tragedy — but tragedy is one option among many. Parents can and often should survive into the primary campaign. Let the departure emerge from the story.
7. **Engagement at every response end.** Every DM response ends on exactly one of: (a) a direct question to the player, (b) a roll prompt, or (c) something happening to or around the character that demands response. Menus of actions the character could take are banned — that's the AI playing the PC. Even "being led" scenes preserve agency via the NPC's speech, a noticed detail, or an arrival beat. Atmospheric texture is fine in the body; the end forces engagement.
8. **Roll discipline.** In Ch1, roll prompts are surfaced inside the action with the skill named ("you could try to catch their eye — that'd be a Perception check") so the player learns the skill→situation mapping. By Ch3, roll prompts go bare ("Roll Perception"). The DC is never announced. Natural 1 = critical failure; natural 20 = critical success; 2–19 pass/fail against internal DC. The DM **must** wait for the reported die result before narrating outcome.

### 5c. Conversation handling (reuse from DM prompt)

Same 4-mode taxonomy: SPOTLIGHT / COUNCIL / CROSSTALK / WAIT. Same NPC voice palette integration. The child / tween / teen / young-adult / adult / elder age-register work is critical here — a 7-year-old and their 40-year-old father should sound wildly different.

### 5d. Markers

| Marker | Purpose | Server effect |
|---|---|---|
| `[AGE_ADVANCE: years=N]` | Time compression jump (within or between chapters) | `prelude_age += N`; if chapter boundary crossed, `prelude_chapter += 1`; multiple fires per chapter expected |
| `[CHAPTER_END: summary="..."]` | Close a chapter | Persist summary, show chapter-end UI |
| `[STAT_HINT: stat=str magnitude=1 reason="..."]` | Stat emergence candidate | Insert into `prelude_emergences` as `offered`; UI shows accept/decline toast |
| `[SKILL_HINT: skill="Athletics" reason="..."]` | Skill emergence candidate | Same; enforces 2-total cap server-side |
| `[CLASS_HINT: class="ranger" reason="..."]` | Class affinity signal | Weighted tally; informs handoff suggestion (not commitment) |
| `[THEME_HINT: theme="outlander" reason="..."]` | Theme affinity signal | Weighted tally; drives Ch3 commitment ceremony |
| `[ANCESTRY_HINT: feat_id="dwarf_l1_stone_sense" reason="..."]` | Ancestry-feat affinity | Weighted tally; informs handoff suggestion (gated on race) |
| `[NPC_CANON: name="..." relationship="..." status="..."]` | Mark NPC as canonical | Insert `prelude_canon_npcs` |
| `[LOCATION_CANON: name="..." type="..." is_home=true]` | Mark location as canonical | Insert `prelude_canon_locations` |
| `[CANON_THREAD: kind="..." subject="..." condition="..." weight="..."]` | Mark unresolved obligation the world will hold | Insert `prelude_canon_threads`; subject references existing NPC/location or free-text |
| `[CHAPTER_PROMISE: theme="..." question="..."]` | Fires at the opening of Ch2 and Ch3 only. Proposes the thematic throughline drawn from the arc plan and invites confirmation/redirect/see-where-it-goes. | UI renders a chapter-promise beat with Accept / Redirect / See-where-it-goes buttons |
| `[SESSION_END_CLIFFHANGER: "..."]` | Session wraps (Sessions 1–3 only) | Persist cliffhanger for next session's opening |
| `[THEME_COMMITMENT_OFFERED]` | Fires after the irreversible act resolves in Ch3b | UI renders the lightweight commitment card (leading theme + 3 alternatives + choose-your-own) |
| `[DEPARTURE: reason="..." tone="..."]` | Character leaves their prelude life — must emit before `[PRELUDE_END]`. Reason and tone are shaped by the committed theme. | Persist departure record |
| `[PRELUDE_END]` | Prelude complete | Trigger transition flow (Phase 2 engineering) |
| `[COMBAT_START]`, `[COMBAT_END]`, `[LOOT_DROP]` | Existing markers | Reused as-is (with age-scaled stats per §5e) |

> **Heirloom-handoff producer DEFERRED (chunk 5 ship note, 2026-05-02).** Earlier-batch design conversations discussed an `[OBJECT_HINT]` marker for capturing meaningful objects acquired during play. **It was never speced into v4 and never implemented in chunks 1–4.** Phase 2 chunk 5 lands the consumer side: `prelude_canon_heirlooms` table (see `PHASE_2_CREATOR_SPEC.md` §8.1.2) and Step 6 handoff-mode empty-state. Producer-side wiring — choice between play-time marker, post-Prelude extraction pass, or hybrid — is its own scoped piece of design work. Until it lands, every Prelude completes with zero heirloom candidates and Step 6 falls back to the manual-mode opt-in path (per `PHASE_2_CREATOR_SPEC.md` §5.6.3). Manual-mode heirloom authoring is fully functional and unaffected. See `CONSOLIDATED_TODO.md` parking lot.

### 5e. Server-side caps + tally weighting

- `[STAT_HINT]` rejected if that stat already has +2 accepted
- `[SKILL_HINT]` rejected if 2 skills already accepted
- `[CLASS_HINT]`, `[THEME_HINT]`, `[ANCESTRY_HINT]` are weighted tallies — no cap on firing. Tally weights:
  - **Ch1 hints count 1×**
  - **Ch2 hints count 1.5×**
  - **Ch3 hints count 2×**
  - Ties broken by recency (latest hint wins)
- Theme tally drives the Ch3 commitment offering (leading theme + runners-up). If the player defers (not currently a UI option per the simplified card, but reserved as a server-side fallback), the trajectory winner from the arc plan applies.
- Class and ancestry tallies inform handoff suggestions only — pre-selected in the main creator with player free to change.
- `[CHAPTER_PROMISE]` only fires at Ch2 and Ch3 boundaries. Server rejects firing at Ch1 and warns AI via injected `[SYSTEM]` message.
- `[CANON_THREAD]` has no cap, but the AI is instructed (§5h) to fire it only when a beat creates a genuinely unresolved obligation, not on every beat.
- On cap violation or misplaced chapter promise, the AI is informed via injected `[SYSTEM]` message so it knows to stop firing that category.

### 5f. Age-scaled provisional stats

Prelude characters use real dice for everything. They have provisional stats until the main creator runs.

**Provisional ability scores.** All 10s + racial bonus + accepted emergences. Example: a half-orc after accepting +2 STR and +1 CON from emergence has STR 12, DEX 10, CON 13, INT 10, WIS 10, CHA 10 (with Half-Orc's +2 STR / +1 CON baseline already in).

**Age-scaled HP.**
- Ages 5–8: `max_hp = 4 + CON_mod`
- Ages 9–12: `max_hp = 6 + (2 × CON_mod)`
- Ages 13–16: `max_hp = 8 + (2 × CON_mod)`
- Ages 17–19: standard L1 HP (hit-die max + CON mod; class-default or 1d8 if class hasn't emerged yet)

**Age-scaled AC.** All ages: `AC = 10 + DEX_mod` (no armor unless specifically acquired in play).

**Age-scaled weapon damage.**
- Ages 5–8: unarmed 1 point; improvised 1d2; small knives 1d3
- Ages 9–12: unarmed 1d2; improvised 1d3; knives/sticks 1d4
- Ages 13–16: standard 5e weapon damage with -1 damage on STR-based attacks
- Ages 17–19: standard 5e rules

**Enemy scaling.** Adult opponents are dangerous. A tavern bully at age 9 might be AC 12 / HP 20 — a 9-year-old PC needs courage, cleverness, allies, or flight. Combat going badly produces narrative outcomes (capture, flight, injury that shapes the character) rather than child-PC death against non-lethal foes. Lethal encounters remain possible (a raider will kill a child) but flagged in the arc plan as weight-bearing moments.

### 5g. Per-chapter rhythm guidance

The prompt builder injects chapter-specific pacing guidance into the system prompt based on `prelude_chapter`.

**Ch1 — Establishing rhythm.**
- Scenes are short, atmospheric, observational.
- `[AGE_ADVANCE]` fires multiple times across the session (3–4 times to carry from ~6 to ~10).
- Each scene introduces or develops one element: an NPC, a place, a household ritual, a moment of awareness.
- No combat. Skill checks tutorialised with named-skill framing.
- Rhythm-compression is the dominant time-compression technique ("the summer passed in the rhythm of the fields…").

**Ch2 — Widening rhythm.**
- Chapter-promise beat at session opening.
- Scenes lengthen. Each scene has a small decision or stake.
- One deliberate intra-session `[AGE_ADVANCE]` splits the session into two halves with different ages and emotional registers (e.g., 11–13 then 13–15). The split lets consequences from the first half land in the second within one session. Rendered as compressed prose ("the autumn after that fight, you turned twelve. Then thirteen. By the time you were fourteen, the village had stopped looking at you the same way.") rather than as an announced cut.
- Combat introduces (training, schoolyard, first defensive). Light damage, age-scaled stats.
- Skill checks shift to bare prompts.
- Theme/class/ancestry hints accumulate.
- Selective-detail is the dominant time-compression technique — pick the moments that matter, skip the connective tissue.

**Ch3 — Real rhythm.**
- Chapter-promise beat at Ch3a opening.
- Scenes have full weight. Real stakes. Real combat. Real consequence.
- `[AGE_ADVANCE]` fires sparingly — once or twice across the two sessions, mostly between Ch3a and Ch3b.
- Ch3a builds toward the irreversible act. Cliffhanger as the act lands.
- Ch3b plays the aftermath: theme commitment surfaces, departure follows. Each of the three Ch3 beats — irreversible act, theme commitment, departure — gets its own scene weight; the AI must not compress all three into one paragraph or one scene.
- Real-time scene weight dominates; minimal time compression.

### 5h. Calibration guidance for `[CANON_THREAD]`

The marker fires only when a beat creates a genuinely unresolved obligation the world will hold across years. Examples that warrant a thread:

- A parent goes missing and is never found within the Prelude → `unresolved_loss`
- The PC kills an NPC who has surviving family who would seek revenge → `blood_debt`
- The PC makes an oath that hasn't been fulfilled by Prelude end → `unfulfilled_oath`
- The PC commits a crime that's been seen but not yet pursued → `unpaid_crime`
- The PC walks away from a relationship that's not closed → `unfinished_relationship`
- The PC takes something whose owner will reclaim it → `held_object`
- The PC knows something that someone else needs hidden → `held_secret`

Examples that do *not* warrant a thread (these are texture or canon, not threads):
- A neighbor disliked the PC. (Texture.)
- The PC visited a market once. (Canon location, not a thread.)
- The PC's friend moved away. (Canon NPC with status, not a thread unless the friend specifically becomes load-bearing for future payoff.)

The AI is instructed: **err toward fewer threads of higher weight rather than many threads of low weight.** A Prelude with 2–4 `notable` or `major` threads is healthier than one with 12 `minor` threads.

---

## 6. Transition flow (Prelude → main creator)

Triggered by `[PRELUDE_END]`. Phase 2 engineering work; design contract follows.

1. **Aggregate emergences.**
   - Stats: sum of `magnitude` per stat where `status='accepted'`, capped at +2 per stat
   - Skills: first 2 accepted, extras ignored
   - Class: chapter-weighted `[CLASS_HINT]` tally → suggested class
   - Theme: committed theme from `characters.prelude_committed_theme` (set at the commitment ceremony)
   - Ancestry feat: chapter-weighted `[ANCESTRY_HINT]` tally → suggested feat
2. **Backstory generation as biography seed.** Opus call with Prelude chronicle summaries, arc plan, canon NPCs, and canon threads → appendable biography entries written in the voice of the adult character looking back, with allowed gentle distortion. Format: timestamped entries (in-fiction age + chapter), not a single prose blob. These are the seed entries for the living biography, which appends across the main campaign. Phase 2 designs the schema, service, and UI for the living biography.
3. **Canon NPCs / locations / threads transfer.** Persist Prelude canon into the campaign's `npcs` / `locations` / `campaign_threads` tables at campaign creation.
4. **Mentor imprint seeding (when applicable).** If the player's authority-figure setup answer was "mentor" and a corresponding `prelude_canon_npcs` row with `relationship='mentor'` exists, insert a row into `mentor_imprints` at primary-campaign creation. The mentor relationship arrives at the main campaign with prior history intact.
5. **Main creator wizard opens** at Step 1 with the following state:
   - Name / gender / race / subrace: locked (set at Prelude setup)
   - Theme: locked to committed theme (player view: the theme card explains *what* committed and *why*; not editable)
   - Class / subclass: pre-selected from chapter-weighted class tally, editable
   - Ancestry feat: pre-selected from chapter-weighted ancestry tally, editable
   - Ability scores: standard array / rolled stats; emergence bonuses layer on top at final calculation, clamped to normal caps
   - Skills: class + background + emerged skills shown as already-picked
   - Backstory: pre-filled with biography seed entries, editable
   - Alignment: manual pick (standard 5e); ideals / bonds / flaws filled at handoff against the backstory
6. **Main creator wizard rebuild is open work.** The user has flagged the existing creator as too clunky and wants a rebuild. The Prelude handoff produces a richer pre-fill payload than the current creator can cleanly consume. Phase 2 either expands to include a creator rebuild or carves the rebuild off as its own phase. Resolved at Phase 2 start.

### 6a. Primary campaign world-gen receives Prelude as input

When a character has finished the Prelude and is being assigned to a newly-created campaign, the campaign plan generator receives as required input:

- The Prelude arc plan (home world, three chapters, recurring threads, departure)
- `prelude_canon_npcs` (with status at Prelude end)
- `prelude_canon_locations` (home village, region, landmarks)
- `prelude_canon_threads` (with conditions for ripening)
- The departure marker's reason and tone
- Committed theme (so opening adventures are theme-compatible)
- Suggested class (from tally) — informational; the player may have changed class in the creator

Opus generates the primary campaign world-gen anchored near the Prelude's home region. The first session opens with the character having traveled — the "you've been on the road for a while" beat replaces the original "you have just arrived" framing. This is a campaign-opener concern, owned by the main campaign generator, not the Prelude.

When the creator wizard submits, `creation_phase` flips from `'prelude'` to `'active'`, mentor imprints are seeded (when applicable), canon entities and threads are persisted into the campaign, and the character is linked.

---

## 7. UI components

### 7a. New (Phase 2 engineering)

- `PreludeLanding.jsx` — pick between "New Character" and "Start with a Prelude"
- `PreludeSetupWizard.jsx` — content + UX revisit at Phase 2 start; adds authority-figure question, removes tone-tag question
- `PreludeArcPreview.jsx` — post-setup screen showing arc summary with re-roll button
- `PreludeSession.jsx` — gameplay UI, mirrors `DMSession.jsx` with prelude-specific cues (age in top bar, chapter indicator)
- `PreludeEmergenceToast.jsx` — emergence candidate notification (Accept / Not now / Never offer)
- `PreludeChapterPromise.jsx` — renders `[CHAPTER_PROMISE]` at Ch2 and Ch3 openings (Accept / Redirect / See-where-it-goes)
- `PreludeChapterIndicator.jsx` — top-bar widget with age + chapter
- `PreludeThemeCommitmentCard.jsx` — lightweight in-line card at Ch3b (leading theme + 3 alternatives + choose-your-own)
- `PreludeTransitionScreen.jsx` — "Your Prelude is Complete" summary with biography seed entries, emergence summary, canon NPCs / locations / threads, and CTA
- Pre-fill integration in the (rebuilt) main creator with "Prelude" badges on pre-filled fields

### 7b. Reused

- Dice roller, combat tracker, condition panel, inventory panel (operate identically with age-scaled provisional stats)
- Voice palette / NPC rendering (with age-register work — child / tween / teen / young-adult / adult / elder)
- Context manager (Prelude sessions use a Prelude-tuned rolling-summary template that prioritizes character development, relationship shifts, and formative beats over plot/combat/quest beats — same infrastructure, different summarizer prompt)

### 7c. Cut from previous design

- `PreludeValuesPanel.jsx` (values tracker cut)
- `PreludeChapterPromise.jsx` firing at Ch4 (Ch4 cut)
- The full-screen "Choose Your Path" UI (replaced by the lightweight in-line card)

---

## 8. Testing strategy

Each phase ships with tests:

| Phase | Test types |
|---|---|
| Setup wizard | Field validation; prelude character creation round-trip; new authority-figure question persisted |
| Markers | Marker detection unit tests (parallel to `marker-detection.test.js`); cap enforcement; `[CHAPTER_PROMISE]` Ch2/Ch3-only validation; `[CANON_THREAD]` schema validation |
| Emergence | +2/stat cap; 2-skill cap; accept/decline flows; class/theme/ancestry tally math at three-chapter weights (1× / 1.5× / 2×) |
| Prompt | Prelude prompt includes setup data; tone description present; per-chapter rhythm guidance present; separate from DM prompt |
| Transition | Prelude → main creator pre-fill correctness; NPC/location/thread persistence into campaign; mentor imprint seeding when authority-figure was 'mentor' |
| Integration | Full happy path: setup → 4 sessions → end → creator → primary campaign |

---

## 9. Phased rollout

**Most of the previous "Phase 1–4 of the Prelude rollout" work is already shipped** as part of the original Prelude system (~v1.0.41–v1.0.77). The Phase 1 reframe (this document) restructures the design; Phase 2 engineering picks up the surviving pieces, retires the cut pieces, and ships the new pieces.

In the consolidated project plan, the Prelude work falls within the project's larger phase sequence (`CONSOLIDATED_TODO.md`):

- **Project Phase 0** (stop-the-bleeding fixes): shipped at v1.0.103.
- **Project Phase 1** (this document): Prelude reframe game design — completed 2026-04-29.
- **Project Phase 2** (Prelude → primary transition engineering): builds the transition flow, biography seeding, canon-thread persistence, the setup-wizard content + UX revisit, the main-creator rebuild evaluation, and the marker / prompt-builder updates that follow from Phase 1's reframe. Includes deletion or migration of the cut machinery (values tracker, tone-tag system, Ch4 arcs).
- **Project Phase 4** (AI behavior diagnostic): tests whether the tone description's elevation of the shelter-behavior corrective is sufficient; further prompt-engineering work follows from findings. Ch1 is the highest-shelter-risk chapter and the diagnostic's natural focus.
- **Project Phase 7** (playing mode): real evaluation of whether the felt outputs land — including non-formative memorable scenes (no dedicated machinery in Phase 1; re-evaluate at Phase 7), thread-resurfacing in main campaign play, and the asymmetric NPC memory model (Phase 3 use case).

Engineering scope estimate for Phase 2's Prelude work: 25–40 hours, depending on whether the main-creator rebuild is folded in. (Most of the original 52–77 hour estimate is already shipped; Phase 2's job is delta work, not greenfield.)

---

## 10. Open questions

Carried forward as the design moves into Phase 2 engineering.

- **`creation_phase` intermediate state.** Currently `'prelude'` and `'active'`. Phase 2 may want a `'ready_for_primary'` state to gate the period between `[PRELUDE_END]` and the player completing the main creator. Decision lands when Phase 2 designs the transition flow.
- **Setup-wizard content revisit.** Question count, bloat trimming, consolidation. Resolved at Phase 2 start as a content + UX pass between PM, user, and Design (not Code).
- **Main-creator rebuild scope.** Whether to rebuild the existing creator alongside Phase 2 transition work, or carve as its own phase. Resolved at Phase 2 start.
- **Re-roll cap for arc plan.** Currently 1 re-roll. May need adjustment based on first-session playtest.
- **Save/load mid-scene emergence offer.** If a toast is open when the player saves, does it persist? Lean yes — store offer state on the session config blob.
- **Prelude interruption.** If the player wants to bail before `[PRELUDE_END]`, do they get a "terminate prelude early" option that takes whatever has emerged and moves on? Lean yes, with a confirmation dialog.
- **Living biography schema and UI.** Phase 2 design work. Schema (likely `character_biography` table + entries) and the Origin & Identity tab integration both need design + build.
- **Asymmetric NPC memory model.** The principle is logged (Decision 6 part 2). Implementation gates on Phase 3's standing-scalar abstraction (Refactor 3.1 in `CONSOLIDATED_TODO.md`).
- **Multi-tone selection return.** Parked for v2.0.0+. The 16-tag system or successor returns when MVP is shipping clean.
- **Non-formative memorable scenes.** Felt output #1 includes "a few non-formative just-good-or-bad memories." Phase 1 ships no dedicated structural machinery for these; Decision 5's pacing builds in deliberate breathing room. Re-evaluate at Phase 7 based on whether the felt output lands; if not, distinguish AI-side gap from structure-side gap.

---

## Document history

This is v4 of the Prelude implementation plan, produced by the Phase 1 reframe completed 2026-04-29.

The reframe was driven by six structural decisions plus a sub-deliverable, all logged in `DECISION_LOG.md` under entries dated 2026-04-29:

- **Decision 1** — Outputs spec locked (7 tangible, 4 felt, tutorial; values tracker cut, mentor moves to setup, party combat dropped)
- **Decision 2** — Three-chapter structure (Ch1 / Ch2 / Ch3; Ch4 collapsed)
- **Decision 3** — Machinery audit (5 hints kept, theme ceremony simplified, backstory repurposed as biography seed, chapter promises shifted, tally re-tuned, values + tone-tags + transient-canon cut) plus tone description sub-deliverable
- **Decision 4** — Ch3 beat sequence (irreversible act → theme commitment → departure)
- **Decision 5** — Pacing (4 sessions: 1/1/2; intra-Ch2 AGE_ADVANCE; per-chapter rhythm guidance)
- **Decision 6** — Long-term thread seeding (`[CANON_THREAD]` marker; asymmetric NPC memory model parked for Phase 3)

The previous v3 document (with three rounds of design iteration) is archived. Its design history is preserved in the DECISION_LOG entries above and in earlier DECISION_LOG entries on the original Prelude direction.
