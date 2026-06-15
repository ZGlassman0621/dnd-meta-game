# Companions System — Review Findings

Working doc between user and PM Claude after a full read of `COMPANIONS.md`. Captures issues to address; assumes things not flagged here are working as intended.

**Scope:** Issues only. Format: to-do. Each finding has a severity tag and a one-line recommended next step. Findings are deferred per user pending remaining system reviews.

**Severity tags:**
- 🔴 **Bug/error** — clear mistake, no design judgment required to fix
- 🟡 **Open question** — design judgment needed; user decides
- 🟢 **Heads-up** — works as designed but has implications worth knowing

**Status:** Findings captured, deferred for later action. Pending remaining system reviews (Themes, Mythic) before commit-to-focus decision.

---

## Important framing context

The Companions system has a **specific quality benchmark the user named explicitly: BioWare-tier writing.** Cullen, Solas, Bastila, Carth, Varric, Dorian, Alistair, Leliana, Jolee, Bao-dur, Kira, T3-M4. The user has experienced a Claude Opus campaign that produced "truly incredible companions" before forgetting them — the loss of those characters is part of what's driving this project.

**Shared pattern across the named characters:** every one is recognizable by their wound. Cullen's lyrium addiction. Carth's mentor's betrayal. Varric's Bianca. Dorian's family and country. Jolee's rejection of the Jedi code. Solas's divinity. **The good writing shapes the wound into a person, but the wound is what makes them feel real.**

This review evaluates the system through that lens: does it have the means to give companions wounds the AI honors over time? The infrastructure is excellent. The wound question is harder to answer.

---

## What the design has right (preserved as guardrails)

Naming these explicitly so future revisions don't accidentally remove them:

- Mechanical parity with PCs (full 5e mirror)
- Persistent conditions and death saves across sessions (migration 030)
- "Filled-not-overwrite" personality enrichment pattern
- Mood as short-term layer with game-day decay
- Loyalty as labeled scalar (devoted/loyal/trusted/uncertain/distrustful/hostile)
- Secrets gated by loyalty thresholds
- Threads as dormant hooks activated by narration matching
- Activities system with off-screen vignettes returning as story
- Auto-progression based on personality data
- Status states (active/away/dismissed/deceased) with full lifecycle propagation
- Dismissed-as-off-ramp-not-delete

These are load-bearing patterns. Don't break them when fixing other things.

---

## Category 1: The wound problem (the central finding)

The data model and prompt-engineering layer can describe a companion who reacts well, has voice, holds appropriate moods, gates secrets, and has hooks that fire under conditions. What's less clear is whether it can produce a companion who is *constantly haunted* by something — where the haunting shapes their humor, silences, risk appetite, the wine they won't drink because of who they used to drink it with.

- 🟡 **The data model has no field for "the central wound of this companion."** Closest concept is `formative_event` — but that's a discrete past fact, not an ongoing weight. Threads come closest in spirit but they're explicitly *dormant* until activated; a wound is the opposite of dormant. *Possible fixes (not all required):*
  - **Option A:** Add a `core_wound` field to `companion_backstories` — a paragraph describing "what shaped this person and still shapes them daily." Distinct from formative event (a thing that happened) and from threads (dormant hooks). Wound is *ongoing presence*. Most rigorous fix.
  - **Option B:** Route the wound through existing voice/mannerism/motivation enrichment, but at recruit-time generation, instruct Opus to give every companion a specific haunting and populate those fields with wound-shaped content. No schema change.
  - **Option C:** Leave the data model alone but rewrite the backstory generation prompt to produce wound-shaped output, and trust personality enrichment to surface it over time. Smallest change.
  - *Worth a real design conversation. Each option has different costs and different ceilings on quality.*

- 🟡 **The companion backstory generator has no documented prompt-engineering principles.** Per the doc, `companionBackstoryGenerator.js` is an Opus call at recruit time that produces "origin location, formative event, personal goal, secrets, unresolved threads." The doc says nothing about *quality* — no instruction like "every companion should have a contradiction at their core" or "the formative event should be the thing they don't talk about, not the thing on their CV." Without those principles, the generator will produce competent backstories that aren't Solas. *This may be the single highest-leverage piece of work for this system: authoring prompt principles for the backstory generator.*

- 🟡 **There's no mechanism for an AI-DM moment of "the wound surfaces."** Threads activate when narration matches triggers; secrets reveal at loyalty thresholds; mood is set by events. There's no explicit pattern for "this companion is silent at the end of a battle because of something that happened years ago, and the AI knows to write that silence specifically." That kind of moment is what makes BioWare companions feel deep. *Possibly addressable via prompt-engineering on the DM prompt — instruct the AI to occasionally surface wound-shaped reactions in low-stakes moments. Worth scoping.*

---

## Category 2: AI behavior and the BioWare benchmark

- 🟡 **"Filled-not-overwrite" enrichment is the right pattern, but its quality depends entirely on what the AI fills it with.** Generic fill ("speaks plainly, dry humor") produces stock fantasy characters. Specific fill ("speaks plainly except about her sister, where she becomes evasive; dry humor that goes sharp when she's been drinking") produces souls. The infrastructure says nothing about which kind of fill the AI should produce. *Worth a prompt-design pass on chronicle extraction — same principle as the wound problem.*

- 🟡 **The AI shelter-behavior issue from the Prelude review likely applies here too.** If the AI playing companions defaults to "make them likeable," it will smooth their edges. Companions who feel like Solas have *unlikeable* moments — Solas is condescending, Morrigan cruel, Sten dismissive, Bastila self-righteous. Those edges are part of why they're memorable. *Likely the same diagnostic investigation that addresses the Prelude shelter-behavior issue. Worth scoping the two together when that work activates.*

- 🟡 **Companion auto-progression is the system most exposed to the canon-coherence problem.** The doc explicitly flags: "The open design question is what happens when the AI picks something that contradicts established canon." Current safety net is "player can override after the fact via the progression UI" — but that requires the player to *notice* the contradiction. For long-running campaigns, the AI making good auto-picks is load-bearing. *Worth elevating from "open design question" to "real engineering question that needs an answer before companions are tested at scale."*

---

## Category 3: Inter-companion relationships (deferred → required)

- 🔴 **Inter-companion relationships are listed as deferred but they're required for the BioWare benchmark.** The doc treats this as "the most natural next narrative-density upgrade for parties of 2+ companions." The framing should be different.

  **The BioWare companions named by the user only feel as alive as they do because they're in conversation with each other.** Alistair and Morrigan's antagonism is half of why both feel real. Varric and Cassandra's banter is a substantial part of Varric's depth. Without inter-companion dynamics, you have a constellation of well-written characters who never bounce off each other.

  *This should be reclassified from "deferred upgrade" to "foundation the BioWare benchmark requires." A companion system without companion-to-companion relationships will produce companions who feel like soloists who happen to share a stage — regardless of how good each one is individually.*

  *Note: the DM-Mode side already has a `party_relationships` pattern. Porting it to player-mode is the technical shape of the fix; the priority elevation is the design call.*

---

## Category 4: Mood limitations

- 🟢 **The 10-state mood system is functional but a quality cap.** Real characters have moods like "dread laced with resignation," "dark amusement at someone else's misfortune," "the brittle good cheer of someone holding it together." The 10 states are good buckets but limit specificity. *Possible fix: keep 10 states as canonical buckets but add a `mood_specifics` text field where the AI writes "anxious specifically about Vask returning" or "conflicted because she still loves him but can't trust him." Small change, potentially big impact on companion specificity.*

- 🟢 **Mood decay to "content" may be too clean for grief-shaped moods.** Intensity decays 1 per 2 game days, resets to content at zero. Real grief doesn't decay to baseline; it complicates into something the character carries. A companion whose lost-friend grief decays to "content" in 10 game days is a companion whose grief was just a temporary state. *Possibly fine for everyday moods. Possibly wrong for grief-shaped moods that should leave residue. Worth a design pass on whether some mood causes should resist decay or transform rather than fade.*

---

## Category 5: AI memory dependencies (move to AI_NARRATIVE_PERSISTENCE.md)

The Companions system adds heavy entries. Several overlap with patterns from earlier reviews; a few are new.

- 🟡 **Personality enrichment over hundreds of sessions.** "Filled-not-overwrite" pattern means the AI is incrementally building a character profile. Over a long campaign, this profile becomes canonical. Requires: per-session enrichment extraction, blank-detection logic, full-profile injection into prompts.

- 🟡 **Loyalty score persistence and labeling.** Pattern A from earlier reviews — same shape as Drow Lolth standing. AI consults label, acts on meaning, updates based on player choices.

- 🟡 **Secrets gated by loyalty thresholds.** *New pattern: "conditional revelations gated by relationship state."* AI must know which secrets exist, what their thresholds are, surface when crossed.

- 🟡 **Thread activation by narration matching.** *New pattern: "ambient pattern matching against character history."* AI checks incoming narration against thread triggers in real time.

- 🟡 **Mood as short-term layer.** Set by events, decays over game time, influences current scene. AI consults, writes to, respects decay.

- 🟡 **Auto-progression with personality-aware picks.** AI accesses full companion history when leveling and picks consistently with established canon. *Open design question per the doc — needs concrete answer before scale testing.*

- 🟡 **Activity outcomes generated against personality.** Opus generates activity results with personality fed in. Personality must be well-developed enough to actually shape outcomes. *Connects to the wound problem — if personality is generic, activity outcomes are generic.*

- 🟡 **Reunion narratives queued for next session.** When companion returns from Activity, vignette delivered at session start. Requires: outcome state, narrative generation, queue persistence, prompt-time injection.

- 🟡 **Lifecycle propagation on death.** When companion dies, NPC record updates, promises reconcile, narrative queue gets high-priority entry, AI is told. *Pattern: "death as cascading state update across multiple subsystems."*

- 🟡 **Inter-companion relationship state (when implemented).** Companion ↔ companion warmth/trust tracking. Pattern A territory but with an extra dimension — relationships between non-player characters that develop in response to play.

- 🟡 **Dismissed companion return triggers.** "When the player visits the companion's home region, an NPC mail / chronicle reference / returning-character beat may surface." The "may" requires AI judgment. Requires: dismissed companion list, region matching, decision logic for whether to surface, narrative generation when surfacing.

---

## Category 6: Smaller specifics

- 🟡 **The garrison/base-officer system is unflagged for AI persistence.** Stationed companions contribute to defense rating. Do they continue to develop? Have moods that matter? Personalities that affect base operations? *Probably an entire sub-system worth scoping later. Currently undefined.*

- 🟢 **Recipe gifts (`[RECIPE_GIFT]` marker) deserve more design attention.** "An old soldier teaches a martial recipe after a campaign together" — exactly the kind of moment that makes BioWare companions feel like real teachers and friends. *Worth ensuring the AI fires this marker frequently and meaningfully. Currently low-detail in the doc.*

- 🟢 **Dismissed companion return mechanism is underspecified.** The "may surface" language gives the AI lots of latitude but no guidance. *Worth defining what determines whether a returning beat happens — time elapsed, player actions in the meantime, loyalty at dismissal, etc.*

---

## Suggested next moves (when this comes off the deferred shelf)

When Companions becomes active work, suggested order:

1. **Author backstory generator prompt principles.** Highest-leverage single piece of work. Document what makes a companion BioWare-tier. Use the named-companion list (Cullen, Solas, Bastila, etc.) as quality benchmarks. Outputs: a `BACKSTORY_GENERATION_PRINCIPLES.md` doc, an updated prompt in `companionBackstoryGenerator.js`, validation that newly generated companions feel right.

2. **Decide on the wound representation.** Options A/B/C from Category 1. Pick one. Implement.

3. **Reclassify inter-companion relationships from "deferred" to "required."** Plan the port from DM-Mode `party_relationships` pattern to player-mode. Estimate scope.

4. **Address auto-progression canon-coherence.** Move from "open design question" to concrete answer. Connect to the AI Narrative Persistence engineering thread.

5. **Coordinate AI shelter-behavior fix with Prelude work.** Same diagnostic investigation, two beneficiary systems.

6. **First playtest with a long-running character to evaluate companions at scale.** Without sustained play, the Companions system is theoretical. Pairs naturally with the broader "transition out of building mode" trigger discussed in earlier reviews.

---

## What this review confirmed about the project

- Companions is the strongest infrastructure of any system reviewed so far. Mechanical parity, persistent state, mood/loyalty/secrets/threads layering — all well-built.

- The bones support the BioWare benchmark, but the prompt-engineering layer that produces companion content (backstory generation, personality enrichment, run-time AI behavior) needs explicit quality direction. Without it, the system will produce competent generic companions.

- The wound question is the central design problem. Three possible solutions; user decision needed.

- The AI shelter-behavior issue from Prelude likely applies here. Companions with edges are required for the benchmark.

- Inter-companion relationships are misclassified as a future upgrade. They're foundational to the benchmark.

- The system is heavily AI-memory-dependent. Adds significant entries to AI_NARRATIVE_PERSISTENCE.md, with two new patterns ("conditional revelations gated by relationship state," "ambient pattern matching against character history").

- This system probably can't be properly evaluated until first playtest with a long-running character. Pairs naturally with the broader "transition to playing mode" trigger.
