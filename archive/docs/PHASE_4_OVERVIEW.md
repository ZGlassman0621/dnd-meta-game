# PHASE_4_OVERVIEW.md

**Status:** Drafted, framing locked.
**Phase:** 4 of 7+ (the AI Behavior phase).
**Authored:** 2026-05-06.
**Contains:** Phase 4a and Phase 4b. This document is the framing both specs reference.

---

## §1. What Phase 4 is

Phase 4 is where the project transitions from "build the system" to "tune the system continuously." Everything before Phase 4 was about building durable infrastructure — characters can be created, sessions can be played, state persists, markers route correctly, time-bounded mechanics work, settings can be configured, fortress threats originate from the right pipeline. The mechanics work.

Phase 4 is about whether the AI **uses those mechanics well**. It's the phase that establishes the practice of measuring AI behavior, examining the prompts that shape that behavior, and tuning the system continuously as the model evolves and as evidence accumulates. The artifact Phase 4 produces isn't a fixed prompt or a one-time fix. It's the discipline of evidence-based prompt tuning, as a permanent practice of the project.

This framing matters because it shapes scope. Phase 4 isn't trying to fix every AI behavior issue that exists today. Phase 4 is trying to build the apparatus that lets the project keep finding the right balance as the model changes and as the user's understanding of what good DMing looks like deepens. Get this layer right and tuning prompts forever becomes tractable. Skimp on this layer and every future prompt change is fumbling in the dark.

## §2. The two-phase split

Phase 4 splits into two structurally different sub-phases:

**Phase 4a — Diagnostic infrastructure.** Structural-refactor-shaped. Concrete deliverables. Bounded scope. Ships once. Builds the instrumentation that lets the project see what the AI is actually doing.

**Phase 4b — Investigation practice.** Investigation-shaped. Emergent deliverables. Scope grows or shrinks based on evidence. Runs as long as high-priority AI behavior issues warrant investigation. Establishes the recurring practice of tuning prompts against current evidence.

Phase 4a unblocks Phase 4b. You can't tune what you can't see; you can't audit constraints against current evidence if you can't measure current behavior. Phase 4a's deliverables are the gating dependency for Phase 4b's first investigation.

## §3. The reference texture

Phase 4 anchors to a specific reference experience: the **Order of Dawn's Light campaign** (`Order_of_Dawn_s_Light_-_Original_Campaign_Conversations_with_Claude.pdf`). Played by the user against Opus 4.5 over weeks in December 2025+, this 416-page transcript is concrete evidence of texture this game can produce. Five behavioral patterns the campaign demonstrates, each of which Phase 4's instrumentation watches for and Phase 4b's investigations try to reliably reproduce:

**1. NPCs hold positions; player must earn change.** Skepticism, exhaustion, fear, professional judgment surface in NPC responses unprompted. Earning trust or cooperation produces visible change. Maps to the user wince-list pattern "all NPCs immediately agree."

**2. Time has weight that compounds.** "The ward will hold until tomorrow evening" gets honored across scenes. Time pressure affects every decision; deadlines stay consistent. Maps to the wince-list pattern "Lyra is set to arrive in 7 days for the 4th in-game day."

**3. Resources actually deplete and matter.** Riv's "running on fumes and faith alone" surfaces in narrative because he's mechanically exhausted. Mechanical state has narrative consequences the AI surfaces unprompted. Maps to the wince-list pattern "fighting hordes of enemies rarely results in injury."

**4. The world is specific in its details and stays consistent.** Established facts persist. The Harrow family's composition set up before the players arrive is honored when they encounter it. Maps to the wince-list pattern "misremembering past events."

**5. Stakes land emotionally because the world treats them seriously.** Mechanical resolution and prose elements are woven together. Neither alone produces the emotional weight; the combination does. Maps to the user good-surprise pattern "companions having real moments with my character."

Phase 4a's instrumentation specifically watches for the *absence* of these textures, not just generic AI metrics. Phase 4b's investigations are calibrated against producing them more reliably.

## §4. The same-Opus-family framing

The production app uses current Opus (currently Opus 4.7) for gameplay sessions. PM (Claude, also currently Opus 4.7) is the same model family doing development collaboration. This alignment is a real advantage: PM's self-knowledge about prompt tendencies transfers more cleanly to production behavior than it would across model families.

This advantage doesn't eliminate the need for empirical testing. PM can propose; production-Claude responds; evidence decides. PM as collaborator is an accelerator for evidence-based work, not a substitute for it.

The advantage also doesn't persist forever. When Anthropic ships future Opus versions, the production app picks them up automatically. Phase 4's tuning will need re-examination against future model versions. This is why Phase 4 builds practice rather than fixed artifacts.

## §5. The recurring-practice framing

Phase 4b establishes investigations as a recurring practice rather than one-time events. Specifically:

- **The constraint audit** (Phase 4b's first investigation) re-justifies every prompt restriction against current evidence. After Phase 4b's first run, the audit becomes recurring — every six months, or every time the model updates significantly, or every time observed behavior diverges from the OoDL reference texture.
- **Investigations exit when resolved or routed elsewhere.** A specific investigation ends when its hypothesis has been tested, its fix has been shipped or rejected, or the issue has been re-classified as KNOWN_BUGS or FUTURE_FEATURES.
- **Phase 4b exits when no further high-priority AI behavior issues warrant investigation.** Not time-boxed. Not item-count-boxed. Result-boxed.
- **New investigations join the list as they surface.** If a new failure mode emerges during gameplay, it joins Phase 4b's roster rather than being deferred. If a deferred investigation becomes high-priority, it activates.

The practice continues after Phase 4 closes. Phase 4 establishes the discipline; the discipline runs forever.

## §6. The example-as-hard-fact warning

The user's 2026-05-06 framing input: "AI takes examples from rules as hard fact. The instruction becomes lost when the AI can't extrapolate all scenarios from a singular scenario."

This is bake-in for Phase 4 across both sub-phases:

- **Phase 4a's instrumentation must measure scope-of-instruction-application**, not just example-case satisfaction. If a constraint targets a specific failure mode by example, instrumentation watches whether the constraint applies broadly (good) or narrowly to the example case only (bad).
- **Phase 4b's counter-prompts and revised constraints must operate at the right abstraction level.** Concrete enough to be actionable, abstract enough that Claude applies them across scenarios. This is the central craft skill of Phase 4b.

Specific implication: prompt examples are dangerous unless framed correctly. "Great DMs let consequences land — for example, if the player burns down a temple, it stays burned" produces an AI that imitates the temple example and misses the equivalent cases (the spared bandit, the betrayed friend). Better: "Consequences propagate. Whatever the player does, the world reflects it back." Less concrete, but applies broadly.

This warning is the single most important framing input from the user across Phase 4 design conversations.

## §7. The relationship to other phases

**Phase 3 (AI Narrative Persistence)** built the durable foundations — markers, time-bounded state, standing scalars. Phase 4 examines whether those foundations *reach the AI well in prompts*. One Phase 4b investigation (#8 — Phase 3 plumbing texture review) specifically examines this surface area.

**Phase 3.5 (Settings page)** shipped a placeholder combat difficulty control. Phase 4b investigation #4 (combat difficulty mechanism) builds the underlying behavior; the placeholder activates.

**Phase 3.7 (Fortress groundwork)** shipped the `[FORTRESS_THREAT]` marker mechanism. Phase 4b investigation #5 (fortress threat emission tuning) shapes when the AI emits it.

**Phase 5 (focus-area execution)** depends on Phase 4 for AI behavior tuning that affects Themes, Companions, and the eventual fortress system design. Phase 5 lands cleanly only on a tuned-prompt foundation; Phase 4 produces that foundation.

**Phase 6 (DM Mode dedicated pass)** benefits from Phase 4's practice — bond-shifts JSON-to-table migration is structural, but DM Mode's AI behavior tuning runs through the same audit/investigation framework Phase 4 establishes.

**Phase 7 (long-running play)** is where Phase 4's investments pay off most. Continuity, consequence, and texture matter most across long campaigns; Phase 4's tuning is what makes long campaigns playable.

## §8. The DM-craft articulation

The user committed during 2026-05-06 conversation to write a 3-page DM-craft articulation in their own voice. Specific principles, drawn from their experience playing D&D-flavored games and from the OoDL reference. Becomes Phase 4b investigation material — real input to prompt-shape investigations.

This is genuine project work. The articulation is the user's clearest statement of what good DMing looks like in *this* game. Not a generic "rules of good DMing" document — a specific articulation for this campaign system. Phase 4b investigation #7 (DM-craft articulation absorption) takes the user's document and works out how to translate it into prompt instruction text that operates at the right abstraction level (per §6).

When the user delivers the articulation: it joins the project at `triage/DM_CRAFT_ARTICULATION.md` (or wherever feels right), and Phase 4b investigation #7 picks it up.

## §9. Outside-AI review as available technique

Phase 4 doesn't make outside-AI review a default mode (overhead, divergent-advice risk) but preserves it as a technique available at specific high-leverage moments. The natural first such moment: when Phase 4b's constraint audit produces a proposed revised production prompt, an outside AI's review of that proposal is genuinely valuable.

When used: bounded, specific, treated like a Claude session in care. Output is hypothesis input alongside PM's suggestions and user's judgment, not a verdict. Empirical testing remains the tiebreaker.

## §10. Sequencing and exit criteria

**Phase 4a sequence:**
1. PM ships Phase 4a spec (this delivery)
2. Code executes per spec — likely 1-2 internal ships, end-of-phase review gate
3. PM + user review at end-of-phase
4. Phase 4a closes

**Phase 4b sequence:**
1. Phase 4a closes (gating dependency)
2. PM ships Phase 4b investigation framework + first three investigation specs
3. Code executes investigations one at a time, internal ship cadence Code's call within each investigation
4. Each investigation closes with: shipped fix, deferred routing (KNOWN_BUGS or FUTURE_FEATURES), or determination that hypothesis was wrong
5. New investigations spec'd as they earn priority
6. Phase 4b exits when no further high-priority AI behavior issues warrant investigation

**Phase 4 closure:** Phase 4 closes when Phase 4b exits. The practice (recurring constraint audit, ongoing investigations) continues afterward as ongoing project work, not as Phase 4 work.

---

## Document footer

**Authored:** 2026-05-06 by PM.
**Lock date:** 2026-05-06.
**Related:**
- `PHASE_4A_SPEC.md`
- `PHASE_4B_SPEC.md`
- `PROJECT_BRIEF.md`
- `Order_of_Dawn_s_Light_-_Original_Campaign_Conversations_with_Claude.pdf`
- `AI_NARRATIVE_PERSISTENCE.md`
- `DECISION_LOG.md` 2026-05-06 entries on Phase 4 framing