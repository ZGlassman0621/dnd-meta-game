# DM Mode System — Review Findings

Working doc between user and PM Claude after a full read of `DM_MODE.md`. Captures issues to address; assumes things not flagged here are working as intended.

**Scope:** Issues only. Format: to-do. Each finding has a severity tag and a one-line recommended next step. Findings deferred per user.

**Severity tags:**
- 🔴 **Bug/error** — clear mistake, no design judgment required to fix
- 🟡 **Open question** — design judgment needed; user decides
- 🟢 **Heads-up** — works as designed but has implications worth knowing

**Status:** Findings captured. Ninth and final system review of this phase. Next step is Code-side audit pass, then full project to-do construction.

---

## Important framing context

DM Mode inverts the project's main mode: the user is the DM, the AI plays a party of four distinct PCs. The motivation is **tutorial** — a way for the user to learn DM-ing without finding four humans, scheduling, prepping, committing. The bar drops from "find a group" to "open the app."

**This is the most thoroughly-engineered system in the project.** The number of failure modes the doc explicitly designs against (four friendly bots, echoing, AI rolling its own dice, AI narrating the world, static party) and the specific mechanisms used to prevent each (mandatory disagreement, ABSOLUTE RULES + FINAL REMINDER doubling, marker patterns, bond-shift evolution) is the work of someone who has thought hard about what could go wrong and built guardrails for each thing. The design notes read like a postmortem from a previous version.

**It's also the most thoroughly tested system in the project** — 97 tests + 17 integration tests. Either DM Mode was particularly bug-prone during development (which would justify the test investment), or it was prioritized for quality (which suggests it was important enough to invest there). Either way, the test surface is real coverage.

**The "drastically different" framing is accurate.** DM Mode differs from the other reviewed systems in three ways:
1. It's the only system where the user is *not* a player.
2. It's the most explicitly engineered against AI failure modes.
3. It's a tutorial product hiding inside a play product.

---

## What the design has right (preserved as guardrails)

These are load-bearing patterns. Don't break them.

- **"AI declares intentions, DM resolves."** The AI never rolls dice, never adjudicates outcomes, never narrates the world's response. It declares — "Mira would like to check the door for traps" — and stops. The DM rolls and narrates. This is what makes the system a learning tool rather than entertainment.
- **The "DM is god" rule.** AI accepts every DM ruling. Inverse of Player Mode's "AI is source of world truth."
- **Mandatory disagreement at meaningful decision points.** Disagreement comes from values (alignment, ideals, flaws), not random contrarianism.
- **"Silence is characterization."** 2-3 responses per DM prompt is normal, not all four every turn.
- **"No echoing" rule** with ABSOLUTE RULE + FINAL REMINDER repetition.
- **Secrets gated by dramatic pressure**, not casual reveal.
- **Party generator's enforced diversity:** 4 different classes, 4 different alignments (≥1 ambiguous, ≥1 strong moral compass), 4 voice archetypes, ≥3 specific inter-party tensions including ≥1 secret-that-would-damage-trust, interlocking backstories ("met at a tavern" forbidden).
- **The OOC channel.** `OOC:` prefix, purple UI, doesn't trigger markers, doesn't count toward chronicle, doesn't shift bonds. Small but brilliant.
- **Bond-shift directional warmth/trust** updating across sessions. After 20 sessions, alliance map should be unrecognizable.
- **Model split:** Opus for generation + first session opening; Sonnet for continuations + chronicle extraction + coaching.

---

## Category 1: AI behavior — DM Mode has the model the rest of the project needs

This system's design discipline is exemplary and worth holding up as a model for the broader AI behavior diagnostic work.

- 🟢 **DM Mode has actually done the work that Prelude/Companions/Themes are still scoping.** The other systems trust the AI to do the right thing implicitly — Prelude assumes the AI respects tone tags, Companions assumes the AI gives characters edges, Themes assumes the AI proactively surfaces effects. DM Mode names every AI failure mode explicitly and builds counter-mechanisms. **When the AI shelter-behavior diagnostic eventually runs, DM Mode's prompt structure is probably the model:** explicit rules, repeated reinforcement, example-based instruction (RIGHT vs WRONG), structural mechanisms that make rules load-bearing.

- 🟡 **The "AI plays four distinct characters" problem is significantly harder than the AI shelter-behavior issue from prior reviews.** The AI must give each of four characters distinct voice, distinct moral instinct, distinct response cadence, distinct relationship to the others — *simultaneously, in real time, while playing antagonists and reacting to DM narration.* The Companions review found that the AI struggles to give a single character an unsmoothed edge; DM Mode requires this for four characters in conversation. *The same diagnostic investigation that addresses Prelude/Companions/Themes shelter-behavior will likely surface findings here. If the AI shelters child PCs, smooths companion edges, and underplays Theme effects, it probably also collapses four characters into 2.5 distinct voices.*

---

## Category 2: The tutorial question

- 🟡 **DM Mode is positioned as tutorial but underdeveloped as one.** The success criteria in the doc read as teaching: "they prepped, narrated, made a ruling, rolled dice, made decisions." But there's no progression model — no easier modes for first-timers, no harder modes for experienced DMs, no feedback on rulings, no curriculum. The DM Coaching Panel exists and provides reactive tips but is not skill-building. *If DM Mode is genuinely a tutorial, the coaching layer is the place to build the tutorial scaffolding. Currently it's a tip generator; it could be a curriculum.*

- 🟡 **No mechanism for "you handled this well" or "you might want to reconsider this" feedback.** The DM makes rulings; the AI accepts them; the moment moves on. There's no reflective layer. *A real DM tutorial would have post-session coaching about specific moments: "Your ruling on the locked door was generous — consider whether the rogue should have rolled. Your handling of the moral disagreement at the inn was strong." Currently this doesn't exist.*

- 🟢 **The DC reference table + beginner DM tips in the coaching panel are small but real teaching aids.** Worth preserving. *Possibly the seed of the curriculum, if that's where this evolves.*

---

## Category 3: The bond-shift evolution layer is the most underused powerful mechanic

- 🟡 **The bond-shift mechanism is invisible to the DM.** Per the doc's deferred design: "The bond shifts apply silently. A post-session 'here's what changed between characters this session' view would make the evolution layer visible — currently the DM has to compare the PartyView relationship block before/after to see what moved." **This is the equivalent of having an emotional plot in your novel that the reader can't see.** If a relationship cracked because of how the DM handled a moment, the DM should *see that crack*. *Building the post-session relationship summary view is probably the single highest-leverage UX improvement for this mode.*

- 🟢 **The directional warmth/trust scoring is sophisticated.** A's warmth toward B independent of B's warmth toward A. With 4 party members, that's 12 directional pairs evolving across sessions. *Pattern worth preserving and possibly porting to other systems (Companions, in particular — the Companions review surfaced inter-companion relationships as required-not-optional for the BioWare benchmark, and DM Mode's `party_relationships` is exactly the implementation pattern Companions needs).*

---

## Category 4: Cross-party memory and the lineages connection

- 🟡 **Cross-party memory is a real gap with strategic implications.** Per the doc: "A user with multiple parties has parallel campaign worlds. There is no mechanism today to let an NPC from one party show up in another, or to import a chronicled location across parties." DM Mode is *already* a context where the user might run multiple parties — practice runs, different settings, comparing approaches. **A user's DM Mode experience would deepen significantly if NPCs could carry across parties.** *This connects to the project's north-star "lineages of characters" ambition — DM Mode's cross-party memory and the lineages-of-characters system probably share infrastructure when built.*

---

## Category 5: AI memory dependencies (move to AI_NARRATIVE_PERSISTENCE.md)

DM Mode's AI memory load is more *structural* than other systems'. Genuinely different in kind.

- 🟡 **Per-pair directional warmth/trust scores across N characters, evolving across sessions.** 4 party members = 12 directional pairs. Scores update via `[BOND_SHIFT]` markers and persist. *New pattern: "directional inter-NPC relationship state." Distinct from Companion loyalty (companion-to-player) and Theme tags (static).*

- 🟡 **Voice consistency across sessions for four AI-controlled party characters with mutual-distinctness constraint.** Not just "each character has a voice" but "the four voices must remain mutually distinct." If enrichment drifts one toward generic, the "covered names test" fails. *New pattern: "multi-character voice consistency with mutual-distinctness constraint."*

- 🟡 **Secret protection across sessions, multi-revealable per character.** Each character has a secret that must not casually surface. AI must remember which character has which secret, what conditions warrant reveal, and not surface prematurely. *Pattern: "long-running revelation gating with multiple revealable items per character."*

- 🟡 **NPC Codex auto-synced from chronicles with explicit fill-vs-update distinction.** Stable traits (race, class, age, personality, connections) fill-not-overwrite. Volatile traits (location, status, disposition) always-update. *Same pattern family as Player Mode but with explicit distinction worth recognizing.*

- 🟡 **Plot threads with state determined by latest chronicle mention.** Threads accumulate, get tagged, resolve based on last mention. *Pattern: "narrative state machine where current state is determined by latest update, not aggregated history."*

- 🟡 **The bond-shift mechanism is the most ambitious AI memory mechanic in the project.** AI emits a marker when a moment "meaningfully changes" how characters feel. The judgment of "meaningfully changes" is AI initiative. **Fifth occurrence of the project-wide ambient-pattern-matching pattern** (Companions threads, Prelude emergences, Party Synergies eligibility, Themes proactive surfacing, DM Mode bond shifts). *This pattern needs to be named and unified when AI Narrative Persistence becomes engineering work.*

---

## Category 6: Open design questions worth elevating

- 🟡 **Opus toggle for DM Mode continuations.** Per doc's deferred design. The Player Mode prose-quality finding (Opus is the differentiator at session-continuation prose density) hasn't been ported to DM Mode. **The four-voice constraint may be exactly the kind of problem where Opus's stronger character coherence matters most.** *Worth an Opus toggle experiment when Player Mode's Opus default has been validated.*

- 🟡 **`[PARTY_ARGUMENT]` marker is reserved but not processed.** The cleanup regex strips it but no service handles it. *Either implement the argument-tracking it's reserved for, or remove the reservation.*

- 🟢 **Session-end relationship summary UI** — covered in Category 3 above as the highest-leverage UX improvement.

---

## Category 7: Strategic flag for the consolidation phase

- 🟡 **DM Mode may be quietly underweighted in the project's strategic thinking.** It's the most thoroughly engineered system, has the most tests, manages AI failure modes most explicitly, and has the most sophisticated cross-session memory architecture in the project. **And yet the main thread of project work has been Player Mode** — Player Mode prose quality, Player Mode narrative depth, Player Mode AI behavior fixes. *When was the last time DM Mode got strategic attention? This system deserves a real conversation about whether it's getting the priority it warrants.*

---

## Cross-system observations

- 🟢 **DM Mode is the project's most complete answer to "how do you build a campaign that accumulates."** Player Mode has chronicles, NPC tracking, plot threads. DM Mode has all of that *plus* bond-shift evolution, *plus* explicit relationship tracking, *plus* a Codex panel that surfaces accumulated NPC data, *plus* prep next to the campaign. **If you wanted a model for what AI memory architecture should look like across the whole project, DM Mode is closer to that model than Player Mode is.**

- 🟢 **The AI Narrative Persistence engineering thread, when it activates, probably has more to learn from DM Mode's existing implementation than from any other source.** The other systems describe what the AI must *remember*. DM Mode describes what the AI must *do with what it remembers* — emit markers when state changes, consult per-pair relationships when generating dialogue, respect canon across sessions, maintain voice distinctness.

- 🟢 **DM Mode is the system most likely to inform a redesign of Player Mode's memory infrastructure.** Currently Player Mode and DM Mode have parallel-but-different memory systems. *Worth considering during the AI Narrative Persistence engineering phase: should Player Mode adopt DM Mode's architecture?*

---

## Suggested next moves (when this comes off the deferred shelf)

When DM Mode reactivates as work:

1. **Build the post-session relationship summary view.** Highest-leverage single UX improvement for the mode. Makes the bond-shift evolution layer visible.
2. **Decide whether DM Mode is a tutorial or an entertainment with you-as-DM.** If tutorial, develop the curriculum / coaching scaffolding properly. If entertainment, drop the tutorial framing and design accordingly.
3. **Coordinate AI behavior work with the Prelude/Companions/Themes diagnostic.** Same root issue, additional beneficiary system.
4. **Evaluate Opus toggle for DM Mode continuations.** Likely a small experiment with high information value.
5. **Consider whether DM Mode's memory architecture should inform a Player Mode rebuild.** Strategic conversation, not engineering conversation.
6. **Address `[PARTY_ARGUMENT]` reservation** — implement or remove.
7. **Cross-party memory** — connect to lineages-of-characters infrastructure when that becomes work.

---

## What this review confirmed about the project

- DM Mode is the most thoroughly engineered system in the project. The design discipline is exemplary; the test coverage is substantial.
- It's a different product than Player Mode — tutorial in motivation, separate UX surface, separate marker set, separate memory architecture.
- The system's AI behavior management is the model the rest of the project's systems should aspire to.
- The four-voice constraint is a harder AI problem than any other system's; same diagnostic family but bigger.
- The bond-shift evolution layer is brilliant and underused — invisible to the DM is a design problem.
- Cross-party memory is an unbuilt connection point with the lineages-of-characters north-star.
- DM Mode may be underweighted in project strategic thinking. Worth examining during consolidation.
- The "ambient pattern matching" / "trigger, not activate" pattern is now in five reviewed systems — unambiguously project-wide.
