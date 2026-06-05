# Prelude System — Review Findings

Working doc between user and PM Claude after a full read of `PRELUDE_IMPLEMENTATION_PLAN.md` (~515 lines, three rounds of design iteration). Captures issues to address; leads with the user's actual diagnosis of why the system isn't fun, with PM's initial hypotheses preserved for context.

**Scope:** Issues only. Format: to-do. Each finding has a severity tag and a one-line recommended next step.

**Severity tags:**
- 🔴 **Bug/error** — clear mistake, no design judgment required to fix
- 🟡 **Open question** — design judgment needed; user decides
- 🟢 **Heads-up** — works as designed but has implications worth knowing

**Status:** Findings captured. Prelude is the leading candidate for "where we focus next" after the remaining system reviews complete (Themes, Mythic, Companions). Not committed yet; pending those reviews.

---

## Important framing context

**The Prelude is the project's most ambitious system AND the most problematic-by-user-account.** It exists because the user doesn't want to "step into a character a quarter of the way into their life." It's the project's mechanism for delivering the brief's first definition of "done" — years-long single-character play — at the foundation. If the Prelude doesn't work, every character's foundation is shaky.

**Inspiration:** Fable's promise of playable life development from age 5 to 22, with relationships and choices that shape the character. Fable famously over-promised on this and didn't deliver. The Prelude is trying to actually ship what Fable promised.

**Status of design:** Three rounds of iteration. Round 3 reframe (Ch4 becomes BRIDGE/BECOME, departure moves to Ch3) is "design decision logged, implementation deferred" — it's paired with Phase 5, which is itself unbuilt. The current implementation may not match the Round 3 design.

---

## The actual diagnosis (per user)

The Prelude design is largely sound. The Prelude *implementation* is largely sound. **The AI running the Prelude is the problem.**

Specifically: when running a child protagonist, the AI defaults to sheltering the player from real stakes — even when the player-selected tone tags explicitly call for gritty, brutal, dark, tragic content. The AI treats "young character" as "kid-friendly content" rather than "young character in a serious story." This kills the stakes that make D&D D&D, which is what makes the Prelude not fun.

**This is a prompt-engineering and AI-behavior problem of the same shape as H7 and H8 from the prose-quality work.** The Cardinal Rules in the prompt are correct (Rule 1: non-binary decisions, Rule 4: stakes match scale, Rule 8: departures aren't default tragic). The rules exist in the prompt but are getting overridden in practice — the AI defaults back to its trained "child protagonist = lighter content" convention.

**The fix has the same shape as the prose-quality fixes:** identify where the override is happening, adjust prompt structure to make the rule actually load-bearing, validate via play.

The user's framing of why this matters: "Choice is of utmost importance in D&D games... stakes make D&D more fun to play, regardless of the age of the character." A coming-of-age story can be brutal, gritty, full of real loss — and good ones often are. The AI is mistaking *what kind of story this is*.

---

## PM hypotheses that were wrong-or-partial

Captured for future context — these were PM's initial guesses before user diagnosis. Preserved so future-PM doesn't re-run the same misread, and so the *partial* matches stay visible.

| PM hypothesis | User assessment | Notes for future |
|---|---|---|
| Setup wizard front-loads decision fatigue | **Wrong.** Character creation has plenty of choice normally; this is no different. | Don't pull on this thread without evidence. |
| Emergence toasts feel transactional rather than rewarding | **Wrong.** It's set up as a tutorial; emergence is important to the feel. | Emergence is load-bearing, not extra. |
| Chapter structure does too much narrative scaffolding | **Closest to the actual issue, but not the actual issue.** | Worth pulling on later as a secondary finding. |
| Dice-rolling at provisional stats may feel neither D&D nor Fable | **Wrong.** Dice-rolling is fun and pure D&D. | Combat is part of the experience; don't propose dropping it. |
| Combat-throughout creates pacing problems | **Wrong.** Combat encounters are pure D&D and crucial to the experience. | Same as above. |
| The system competes with what the player can already imagine | **Wrong.** The player wants to play it — being able to imagine it isn't the point. | The Prelude exists because imagining isn't enough. |

The pattern in the wrong hypotheses: PM was looking for design problems. The actual problem is execution-level. A well-designed system being incorrectly run by the AI looks identical from the outside to a poorly-designed system; only playtest experience reveals the difference.

---

## Category 1: AI behavior issues (the central finding)

- 🟡 **AI shelters the child PC from stakes regardless of tone signal.** Even when the player selects "gritty + dark humor" or "brutal + tragic" tone tags at setup, the AI softens consequences when running scenes with the child protagonist. The Cardinal Rules forbidding this exist in the prompt; they're not load-bearing in practice. *Diagnostic investigation needed: where is the override happening? Likely candidates: (a) the AI's training-data prior on "child protagonist = lighter content" overrides the Cardinal Rule, (b) the age-appropriate Cardinal Rule (Rule 2) is being misread as "make content age-appropriate" when it should mean "give the character age-appropriate inner voice and fears in serious situations," (c) something in the prompt structure puts the safety-prior in front of the tone signal.*

- 🟡 **The age-appropriate Cardinal Rule may be working against the project's intent.** Rule 2 says: "A 7-year-old has 7-year-old fears (dark rooms, adult anger, being lost). A 13-year-old has 13-year-old fears (humiliation, betrayal, not belonging)." This is correct. But the AI may be reading "7-year-old fears" as "fears appropriate for stories told to 7-year-olds" rather than "fears a 7-year-old character would have in a serious story for adult readers." *Possible fix: rewrite Rule 2 to be more explicit about who the audience is and what the genre is.*

- 🟡 **Tone tags may not be sufficiently weighted in the prompt.** 16 tags including "Gritty / Brutal / Tragic / Eerie/uncanny" exist. They're documented as shaping word choice and pacing. But the AI's default-to-shelter behavior suggests the tone signal is losing to a stronger prior. *Investigation: how prominently are tone tags placed in the prompt? Are they injected fresh per turn (high weight) or buried in the system prompt's middle (low weight)? Compare to where the age-of-PC information sits in the prompt — that's likely the competing signal.*

- 🟢 **The "stakes match scale" Cardinal Rule (Rule 4) may need a companion rule.** Rule 4 currently says childhood stakes shouldn't be inflated to high fantasy or diminished. The wording protects against making *too much* of childhood stakes, but doesn't push back against making *too little* of them. *A "stakes are real and load-bearing — children in serious stories experience real fear, real loss, real consequences" framing might counter the shelter-default.*

---

## Category 2: Scaffolding (the closest hypothesis but not the actual issue)

User flagged narrative scaffolding as "closest to the actual issue, but not the actual issue." Worth pulling on as a secondary finding once the central AI-behavior issue is addressed.

- 🟡 **Number of mandatory scaffolding moments is high.** Chapter promises at Ch3/Ch4 openings (formal "Here's what this chapter is about" beats), theme commitment ceremony at Ch3 wrap-up (UI card), irreversible act at Ch3, departure beat (with non-tragic-compatible variants), session-end cliffhangers, prelude-end transition screen. *Each is well-designed in isolation. Stacked, they may be visible as machinery — the player feels the structure rather than living inside it. Worth scoping a "subtract, don't add" pass once the AI-behavior fix lands.*

- 🟡 **The arc plan + chapter beats + emergence + chapter-weighted tally + theme commitment system has multiple mechanisms doing the same job.** All are about "what is this character becoming?" Sophisticated, but possibly more system than narrative needs. *Worth examining whether one or two of these mechanisms could be retired without losing function.*

- 🟢 **The Round 3 reframe (Ch4 as BRIDGE) addresses one structural concern.** Originally Ch4 was the departure scene; reframe moves departure to Ch3 and makes Ch4 the road-life adjustment phase. This is the right call. But it's "design decision logged, implementation deferred" — the current code doesn't yet implement it. *When Prelude becomes active work, the Round 3 reframe is one of the first things to ship.*

---

## Category 3: AI memory dependencies (move to AI_NARRATIVE_PERSISTENCE.md)

The Prelude is heavily memory-dependent — possibly the heaviest of any system reviewed so far when measured by *new state introduced per session*.

- 🟡 **Arc plan as living reference.** Sonnet consults the Opus-generated arc plan at session start, injects relevant chapter beats, and "riffs within bounds." Player choices that diverge are allowed; the plan flexes. *Requires: arc plan persistence, per-session beat selection, AI consultation logic, divergence detection.*

- 🟡 **Emergence tracking with chapter-weighted tallies.** Stat / skill / class / theme / ancestry / value emergences fire mid-scene as markers. Server caps and tallies them. Late-chapter hints count more (1x / 1.5x / 2x by chapter). At prelude end, weighted tallies determine winning class/theme/ancestry. *Requires: marker detection, tally math, cap enforcement, AI feedback when caps violated.*

- 🟡 **Canon NPC and location persistence.** Every NPC marked with `[NPC_CANON]` and location with `[LOCATION_CANON]` becomes part of the prelude's canonical world. These must persist into the primary campaign as pre-existing canon. *Requires: marker detection, dedup against existing canon, persistence into `prelude_canon_*` tables, transfer logic to primary campaign.*

- 🟡 **Mentor imprint seeding.** Mentor figures from prelude must seed the primary campaign's mentor_imprints table. The mentor relationship was built through play; it must arrive at primary campaign with prior history intact. *Requires: relationship state at prelude end, mapping logic, primary campaign integration.*

- 🟡 **Remembered-voice backstory generation.** Post-prelude, Opus writes a 3-5 paragraph backstory in the voice of the adult character looking back, with allowed gentle distortion ("you remember her as taller than she was"). *Requires: full prelude session history accessible to Opus call, voice-shift prompt engineering, distortion guidance.*

- 🟡 **Values paragraph generation.** Opus generates a single-paragraph "You have become someone who..." narrative from the values tracker scores. *Requires: values tracker state, ranking logic, narrative generation prompt.*

- 🟡 **Prelude-tuned rolling summary template.** Prelude sessions use a different summarizer than adventure sessions — preserves character development, relationships, values-forming choices instead of plot/combat/quest beats. *Requires: session-type-aware summarizer routing, prelude-specific prompt, validation that summaries actually preserve the right things.*

- 🟡 **Primary campaign world-gen anchored to prelude.** Campaign generator receives prelude arc plan, canon NPCs/locations, departure reason, emerged class/theme, values paragraph as required input. World-gen is anchored near prelude home; opening scene picks up from departure moment. *Requires: campaign generator extension, prelude-context-as-input handling, anchor logic.*

- 🟡 **Transient canon flag for Ch4 (Round 3).** Ch4 introduces NEW NPCs (road travelers, inn-keepers, strangers in new town). Most won't carry into primary campaign. `transient` boolean defaults TRUE for Ch4 facts; AI can promote via `[CANON_FACT_PROMOTE]` marker. *Requires: schema migration, default logic, marker handling, filtering at handoff.*

- 🟢 **Setup data injected verbatim into prompt.** The 12-question setup payload is `prelude_setup_data` JSON, injected into both the Opus arc-plan generator and the per-turn Sonnet prompt. *No AI memory work; just persistence and injection. Already working.*

**Pattern observation:** The Prelude introduces several memory categories that haven't appeared elsewhere — arc plan as reference rather than rail, chapter-weighted tallies, transient-vs-permanent canon, voice-shift generation. *This system surfaces more new patterns than any prior review.*

---

## Category 4: Design specifics worth flagging

- 🟡 **3-hour single-session reframe is open as a design direction.** User said: "I'm very open to exploring a way of doing this in a single 3-hour session." Current design is 5 sessions × 3-5 hours = 15-25 hours. A 3-hour single-session version would be a major restructure, but the user has explicitly opened the door. *Worth scoping when Prelude becomes active work — could be a parallel design exploration alongside fixing the AI-behavior issue.*

- 🟡 **The Round 3 reframe is partially implemented.** Documentation describes Ch4 as BECOME/BRIDGE with departure in Ch3. Implementation may still have departure in Ch4. *Verify code state vs documented state. May be a real bug.*

- 🟡 **Phase 5 is unbuilt.** Per the doc: transition flow, remembered-voice backstory, values paragraph, mentor imprint seeding, primary campaign world-gen anchored to prelude — all unbuilt. *This means a player completing the prelude today either (a) cannot transition to a primary campaign at all, or (b) transitions via some partial/stub implementation. Verify which.*

- 🟢 **The phasing claims 50-85 hours of work, with Round 2 updates pushing to 52-77.** This is a substantial engineering investment. Unclear what fraction is shipped vs. unshipped. *When Prelude becomes active work, an audit of "what's actually built" should be the first step.*

---

## Category 5: Documentation health

- 🟢 **The doc is unusually well-thought-through.** Three rounds of iteration, integrated changelog, design goals table, marker reference, phasing breakdown. As a design document, this is exemplary. *Worth preserving the format as a model for other major-system docs.*

- 🟢 **The doc may have drifted from implementation.** Round 3 reframe (Ch4 as BRIDGE) is "design logged, implementation deferred." Phase 5 is unbuilt. The doc describes a system more complete than what exists in code. *Not a doc bug; just a state to be aware of.*

---

## Suggested next moves (when this comes off the deferred shelf)

When the Prelude reactivates (likely the leading candidate post-system-reviews), suggested order:

1. **Audit current implementation against the documented design.** What's actually shipped? What's in Round 3 reframe state? What's Phase 5 unbuilt? *Before any fix work, ground truth.*

2. **Diagnostic investigation on AI shelter-behavior.** Same shape as the H7/H8 prose-quality investigation. Identify where the "shelter the child" override beats the Cardinal Rules. Likely candidates: prompt structure (where is the age info vs the tone tags?), Cardinal Rule wording (Rule 2 may be misread), missing companion rules. Use the existing dryrun A/B harness if it can be adapted to prelude prompts.

3. **Ship the AI-behavior fix.** Once the diagnosis lands, implement and validate via real playtest. This is the highest-leverage single fix in the system.

4. **Audit scaffolding density (secondary thread).** User flagged this as "closest hypothesis but not the actual issue." Worth a "subtract, don't add" pass once the AI-behavior issue is resolved. May reveal that scaffolding isn't actually the problem either — but worth checking once the central issue is gone.

5. **Implement Round 3 reframe if not yet shipped.** Ch4 as BRIDGE/BECOME, departure in Ch3, transient canon flag.

6. **Build Phase 5.** Transition flow, remembered-voice backstory, values paragraph, mentor imprint seeding, primary campaign world-gen anchored to prelude.

7. **Explore the 3-hour single-session reframe as a parallel design direction.** Not required — the existing design has the user's commitment. But a smaller-scoped version may serve some players (or moods) better, and the user has opened the door.

---

## What this review confirmed about the project

- The Prelude is the project's most ambitious system. The design is largely sound after three rounds of iteration. The implementation is partially built; Round 3 reframe and Phase 5 are unbuilt or partial.

- The reason it isn't fun is execution-level, not design-level. The AI shelters the child PC from real stakes regardless of tone signal. This is a fixable AI-behavior problem of the same shape as H7/H8.

- PM's initial design-focused hypotheses were mostly wrong. User had to course-correct. The lesson: design problems and execution problems look identical from outside the playtest — only experience reveals which is which.

- The Prelude is the heaviest AI-memory-dependent system reviewed so far when measured by new state per session. Several categories of state are unique to this system.

- The user has explicitly committed to the Prelude as their leading focus area pending remaining system reviews. Themes, Mythic, and Companions reviews remain before final commitment.
