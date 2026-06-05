# Downtime System (v3) — Review Findings

Working doc between user and PM Claude after a full read of `DOWNTIME_DESIGN.md`. Captures issues to address; assumes things not flagged here are working as intended.

**Scope:** Issues only. Format: to-do. Each finding has a severity tag and a one-line recommended next step. Findings are deferred per user — captured here to act on later, not now.

**Severity tags:**
- 🔴 **Bug/error** — clear mistake, no design judgment required to fix
- 🟡 **Open question** — design judgment needed; user decides
- 🟢 **Heads-up** — works as designed but has implications worth knowing

**Status:** Findings captured, deferred for later action. Downtime activation is paired with "starting an actual long-running character" — both happen together, not separately.

---

## Important framing context

Downtime is the project's **origin system**. The whole project began as "give my character something to do when I'm at work." Every other system grew outward from this premise.

The current v3 design has evolved from that original intent into something different: structured between-session activity allocation that integrates with every other progression system. The *original* use case (passive time-elapsing while the player is away) is preserved only as a deferred future feature ("Mobile Notifications").

**This shift matters.** The original was *for the character's solo existence*; v3 is *for inter-session campaign management*. Both are valid, both are present in the design, but they're different things. Future work on Downtime should be deliberate about which version of the system is being built.

**Why the system has fallen into disrepair:** Per user, the project has been in *building mode* for the recent stretch. Building mode means short-lived test characters, not continuous campaigns. Downtime requires a continuous character. So Downtime hasn't been used not because the design is bad, but because the project hasn't been in the mode that uses it.

**This means:** Downtime activation is the natural pairing event with "starting an actual long-running character." The two should happen together. Reviving Downtime in isolation would be premature optimization.

---

## Category 1: Origin alignment

- 🟡 **The system has drifted from its original purpose.** v3 is session-driven (Downtime happens when player opens the planning screen between sessions). The original was time-driven (character's solo existence while player is at work). Both are valid, but they're not the same thing. *Decision: which is the system trying to be? Or is it both, with v3 as the planning layer and a future layer adding real-time progression?*

- 🟢 **The Mobile Notifications future feature is the lingering ghost of the original use case.** Phone notifications during downtime asking for decisions is exactly the "my character lives when I'm at work" mode. Currently logged for posterity. Worth recognizing this is the original intent trying to reassert itself in v3.

---

## Category 2: AI memory dependencies (heavy — move to AI_NARRATIVE_PERSISTENCE.md)

This is the densest AI memory category in any system reviewed so far. Downtime alone roughly doubles the entries in AI_NARRATIVE_PERSISTENCE.md.

- 🟡 **Companion personality-driven request generation.** "I'd like to spend this week visiting my family in Neverwinter" requires the AI to know the companion has family, where they are, and that there's a narrative reason to visit them right now. Defines clear AI requirements: companion has family/relationships state, location data, recent events that might prompt a personal request.

- 🟡 **Mentor's Imprint cumulative tracking.** "Accumulate progress toward the once-per-career mentor gift. AI DM tracks the cumulative bond." Long-term mentor relationship arc spans potentially years of play. Same pattern as Drow Lolth standing — long-running scalar/status.

- 🟡 **NPC absence-decay offset by Correspondence.** Per-NPC disposition trend tracking, plus whether the player has been corresponding with each. Per-NPC state at scale.

- 🟡 **Vignette generation requires episodic memory.** AI must identify "the most notable downtime events" — meaning it has to know what's notable across the campaign's narrative beats. The AI as story-curator over long history.

- 🟡 **Reflection occasional triggers.** "AI DM may surface a personality development, realization, or bond moment." AI must identify when a character growth moment is *due* — based on accumulated experience, recent events, and the character's emotional arc. Hardest to spec; easiest to feel when it works or fails. May be the most ambitious AI feature in the entire project, hidden in a Background activity slot.

- 🟡 **Folk Hero legend territory progression.** AI must track *which area*, *what legend*, and how the character is regarded across multiple settlements. Per-place, per-character reputation state.

- 🟡 **Faction standing changes from downtime activities.** Every faction-related activity adjusts standing. Fine if standing tracker is solid; cascading mess if it isn't.

- 🟢 **Companion personality-data pipeline informs autonomous companion choices.** Not unique to Downtime, but Downtime stresses it more than other systems because companions are making real choices about their time, not just reacting to player choices.

---

## Category 3: Design specifics worth flagging

- 🟡 **Numeric balance is explicitly deferred.** Doc explicitly leaves "specific numeric balance for all 30+ activities" for implementation phase. Day costs (15 days for fluent language, 5 for Team Tactic, 7 for crafting) haven't been pressure-tested against each other. *Needs balance pass before activation.*

- 🟡 **No clear "minimum interesting Downtime" threshold.** A 1-day Downtime feels useless; most Mains take 5-7 days. Probably needs a minimum of 5-7 days, OR specific "short downtime" activities for sub-5-day periods. *Currently undefined.*

- 🟡 **The 90-day cap on a single Downtime period needs rationale.** Why 90? What happens if the player wants to take 6 months off (waiting for a coronation, training a Team Tactic mastery, sailing across the world)? Multiple sequential Downtime periods? *Worth defining the rationale and what splitting means narratively.*

- 🟢 **Activity catalog has good coverage but uneven density.** Some categories are dense (Character Training, Personal, Investigation). Underworld has 3 specific to Criminal Theme. Some activities are theme-gated which is fine. *No obvious activity for a character who wants to "just adventure between sessions" — like "Solo Errand" or "Personal Quest." Maybe deliberate, maybe a gap.*

- 🟢 **Cost model has tier-dependent pressure.** Wealthy lifestyle at 4gp/day × 14 days = 56gp just for living. Significant for low-level, trivial for high-level. *Probably correct — wealth gating is a real game element — but worth knowing.*

---

## Category 4: Implementation reality check

- 🟡 **What's actually built vs designed?** The doc lists database changes, services, and UI flows that *would* be required. The system isn't visible in recent changelogs. Per user, the system has "fallen into disrepair" — but it's unclear whether v2 exists in some functional form, was designed and never built, or was built and bitrotted. *This question matters for what activation looks like — implement v3 from scratch is multi-week engineering; repair v2 to v3 spec is different.*

- 🟢 **The "Integration with existing systems" section is exemplary.** This kind of cross-system thinking should exist for every system in the project. Notable as a pattern worth replicating in other systems' docs.

---

## Category 5: The unstated UX gap

- 🟡 **No "what does the player do during Downtime planning" UX detail.** Doc has "New Downtime Planning screen" as a one-line implementation note, but nothing about the *experience* of planning. Calendar UI? List with day allocations? Drag-and-drop builder? Each character with their own column? *Downtime is going to be one of the screens players spend the most time in, and it's the least specified UI in the project. Not a v3 design problem — appropriately deferred — but a known cost when implementation happens.*

---

## Suggested next moves (when this comes off the deferred shelf)

When Downtime reactivates, suggested order of operations:

1. **Clarify implementation reality.** What exists in code? What doesn't? Is it v2-in-disrepair or never-built? This determines scope.
2. **Reconcile original-intent vs v3-design.** The two-modes question (passive vs planned) needs a deliberate decision before architecture work.
3. **Numeric balance pass.** Pressure-test the 30+ activities against each other for cost/benefit parity.
4. **AI Narrative Persistence prerequisites.** Many of Category 2's items can't function without AI memory architecture being further along. Downtime activation may need to wait for the AI Narrative Persistence engineering thread to be active.
5. **UX design pass.** The Downtime Planning screen is non-trivial and not yet specified.
6. **First playtest with a long-running character.** This is where Downtime gets stress-tested.

---

## What this review confirmed about the project

- Downtime is the project's origin system. It has fallen into disrepair because the project has been in building mode, not playing mode.
- The v3 design is solid — strong architectural decisions, clean integration with other systems, exciting features (companion requests, vignette narration).
- The system has the heaviest AI memory dependency of any system reviewed so far.
- Activation pairs naturally with starting an actual long-running character — not before, not after.
- This is a major future workstream, not a small fix.
