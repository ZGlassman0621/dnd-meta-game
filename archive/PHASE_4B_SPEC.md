# PHASE_4B_SPEC.md

**Status:** Drafted, framework locked. First three investigation specs included; remaining five scope at activation time.
**Phase:** 4b (second sub-phase of Phase 4 — AI Behavior).
**Authored:** 2026-05-06.
**Sequencing gate:** Phase 4a closes (gating dependency). Phase 4b unblocked when Phase 4a's instrumentation is shipped and queryable.
**Companion document:** `PHASE_4_OVERVIEW.md` provides the framing this spec references.

---

## §1. Overview

### §1.1 What Phase 4b is

The investigation practice phase. Uses Phase 4a's diagnostic instrumentation to investigate specific AI behavior issues, ship targeted fixes, and establish the discipline of evidence-based prompt tuning as a recurring practice.

Investigation-shaped, not structural-refactor-shaped. Outputs include documentation, revised prompts, prompt-shape decisions, and occasional new diagnostic signals. Phase 4b's deliverables are emergent rather than fixed; the work surfaces as evidence accumulates.

### §1.2 What Phase 4b explicitly does NOT do

- **No new structural infrastructure beyond what specific investigations require.** Phase 4b is for tuning, not building. New diagnostic signals or prompt restructuring tools land *because* an investigation needs them, not pre-emptively.
- **No model swap or model-tier work.** Production continues using current Opus per existing logic.
- **No deferred-investigation parking lot.** Items that get deferred from Phase 4b route to KNOWN_BUGS or FUTURE_FEATURES, not to a Phase 4b waiting list.
- **No fortress system design.** Investigation #5 (fortress threat emission tuning) shapes when the AI emits the marker that already exists; the full fortress system design is Phase 5 candidate territory.
- **No exhaustive coverage.** Phase 4b doesn't try to investigate every possible AI behavior issue. It investigates the high-priority ones; the rest stay in KNOWN_BUGS until promoted.

### §1.3 Cadence

Per the recurring-practice framing (PHASE_4_OVERVIEW.md §5):

- Investigations execute one at a time, in priority order
- Each investigation ships at its own internal cadence (PM authors investigation spec; Code implements; PM + user review)
- Investigations exit when: shipped fix lands, hypothesis tested and rejected, or work routed to KNOWN_BUGS/FUTURE_FEATURES
- New investigations join the roster as evidence surfaces
- Phase 4b exits when no further high-priority AI behavior issues warrant investigation

### §1.4 The eight-investigation roster

Phase 4b's starting investigation list, in priority order:

1. **Constraint audit** (first; gates other investigations)
2. **Continuity preservation**
3. **Shelter-fixation diagnostic**
4. **Combat difficulty mechanism**
5. **Fortress threat emission tuning**
6. **Claude-as-collaborator prompt review**
7. **DM-craft articulation absorption** (gates on user delivering the articulation)
8. **Phase 3 plumbing texture review**

This spec details investigations #1, #2, and #3. Investigations #4-#8 scope at the time their priority comes up; deferring detailed specs avoids speculation.

### §1.5 Decision summary going into Phase 4b

| Call | Decision |
|---|---|
| Phase 4b shape | Investigation-practice; recurring; result-boxed exit. |
| First investigation | Constraint audit. Gates others. |
| Investigation #2 | Continuity preservation (cluster of fact/time/name drift). |
| Investigation #3 | Shelter-fixation (original Phase 4 scope). |
| Deferral routing | KNOWN_BUGS or FUTURE_FEATURES, not a Phase 4b waiting list. |
| New investigations | Join roster as evidence surfaces. |
| Outside-AI review | Available technique at constraint-audit-output review specifically. |

---

## §2. Investigation #1 — Constraint audit

### §2.1 What this is

A complete review of every restriction in the production prompt(s), examining each against current evidence. Output: a revised prompt with each restriction either kept, modified, or removed (with rationale per decision).

This is the foundational investigation. It cleans up the prompts before topical investigations run, so subsequent investigations operate against a healthier baseline.

### §2.2 What gets audited

The full production prompt structure. Inventory:

- `dmPromptBuilder.js` — the main gameplay prompt
- `preludeArcPromptBuilder.js` — the prelude prompt
- Any other prompt builders Code identifies during inventory
- All Cardinal Rules, OBSERVATION rules, marker emission rules, content rules, length rules
- All sections of the system prompt

For each restriction:

- **What was this restriction meant to fix?** Original problem identified.
- **Is that problem currently occurring?** Phase 4a's signals tell us. Captured prompts/responses show whether the failure mode shows up in production today.
- **What is this restriction costing in prose quality and natural flow?** Comparison against OoDL reference texture. Phase 4a's response-length and repetition signals provide quantitative input.
- **Is the restriction operating at the right abstraction level?** Per the example-as-hard-fact warning — does the AI apply it broadly or only to the example case?

### §2.3 Decision per restriction

Each restriction receives one of four rulings:

- **KEEP AS-IS.** Restriction earns its place. Failure mode still occurs at meaningful rate; restriction effectively prevents it; cost is acceptable.
- **MODIFY.** Restriction's intent is right but its form is too blunt or too narrow. Rewrite at the right abstraction level.
- **REMOVE AND ACCEPT THE COST.** Failure mode might return; we've decided we can live with it because the prose-quality cost is too high.
- **REMOVE AND ADD DETECTION.** Failure mode might return; we're going to watch via Phase 4a's instrumentation and respond if it gets bad enough.

The decision per rule is documented. The output is a revised prompt + a decision log explaining each call.

### §2.4 Constraints with special attention

The 2026-05-06 user conversation surfaced several constraints worth specific examination:

- **"Never speak for the player"** — user explicitly cited this as over-restrictive. Likely candidate for MODIFY. Better target: autonomy-violating decisions only, not transitional/positional narration.
- **MECHANICAL MARKERS section** — Lean Prompt investigation already hypothesized this compresses prose. Audit decides whether to fold lean-version into production permanently.
- **Cardinal Rule 2 HARD STOPS** — same.
- **Restrictions added during prose-quality investigation** — any restriction added in v1.0.95-v1.0.115 era. Need re-justification against post-Phase-3 instrumentation.

This list isn't exhaustive; Code surfaces additions during inventory.

### §2.5 Outside-AI review

Per PHASE_4_OVERVIEW.md §9, the constraint audit's output is the natural first moment for outside-AI review. After PM + Code produce the revised prompt, an outside AI session reviews:

- What does the proposed prompt look like to a non-Claude AI?
- What concerns surface?
- What alternatives might be considered?

Output is hypothesis input, not verdict. PM + user decide; empirical testing decides.

The mechanics: user decides whether to use outside-AI review for this audit. If yes, PM packages the audit output as a focused review brief; user runs it through the chosen outside AI; surfaces feedback back to PM. If no, the audit output goes directly to Code for implementation.

### §2.6 Implementation shape

This investigation runs as PM-driven analysis with Code support:

1. PM + Code inventory all prompt restrictions
2. PM categorizes each per Phase 4a evidence + OoDL benchmark
3. PM proposes per-restriction ruling with rationale
4. User reviews proposals, refines per their judgment
5. Optional: outside-AI review of the proposed revised prompt
6. Code implements: revised prompt builders, with old versions archived in code comments for reference
7. Ship as v1.0.16x bump (or whatever version is current at audit time)
8. Phase 4a instrumentation runs against new prompts; PM + user observe over several gameplay sessions
9. Adjustments per evidence

### §2.7 Acceptance criteria

- Inventory of all current prompt restrictions, complete
- Per-restriction ruling documented (KEEP / MODIFY / REMOVE-AND-ACCEPT / REMOVE-AND-DETECT)
- Revised prompt builders shipped
- Old prompt versions archived in code (commented out, not deleted) for reference
- Investigation #1 close-out DECISION_LOG entry with the audit summary
- Documented detection plan for any REMOVE-AND-DETECT rulings
- Several gameplay sessions observed against new prompts before Investigation #1 closes

### §2.8 Investigation #1 explicitly does NOT do

- Doesn't redesign the prompt structure from scratch (it's audit, not rewrite)
- Doesn't add new restrictions (only modifies/removes existing ones)
- Doesn't depend on the DM-craft articulation (that's investigation #7)

---

## §3. Investigation #2 — Continuity preservation

### §3.1 What this is

The cluster of fact-drift, time-drift, name-reuse, and consequence-erosion patterns from the user wince-list. Investigation examines:

- How often does the AI contradict canon established earlier in the same session or campaign?
- How often do time-bounded statements drift across turns?
- How often do new NPC names duplicate prior ones?
- How often do player actions that should propagate forward fail to?

### §3.2 What changes about this investigation if the constraint audit runs first

If Investigation #1 has shipped, the production prompt is a current-evidence document. Continuity failures observed in production after the audit are *real* failures (not artifacts of over-constraint). The hypotheses Investigation #2 generates are about genuine model limitations or about specific prompt patterns that need additive support.

If Investigation #1 hasn't run, Investigation #2 risks chasing failures that the audit would have resolved. Hence the sequencing.

### §3.3 Likely sub-investigations

The cluster might split into multiple sub-investigations as Phase 4a evidence comes in. Possibilities:

- **Time consistency** — capture statements like "X happens in N days" and compare across subsequent turns. Quantify drift rate. Hypothesis: AI doesn't have a clean "time of last reference" mechanism in prompt.
- **Fact persistence** — capture established facts (NPC family composition, world geography, established lore) and check for contradiction. Quantify drift rate. Hypothesis: relevant context isn't reaching the AI in the prompt.
- **Name distinctiveness** — track all NPC names introduced; flag duplicates and near-duplicates. Hypothesis: AI defaults to small fantasy-name pool without explicit prompting otherwise.
- **Consequence propagation** — capture player actions tagged with downstream implications; check whether the AI surfaces those implications in subsequent turns. Hypothesis: the AI doesn't have a clean "things to remember to surface" mechanism.

Each sub-investigation might earn its own ship. Investigation #2 might span weeks.

### §3.4 Implementation shape

PM-driven analysis pattern, similar to Investigation #1 but more iterative:

1. Phase 4a's signals provide initial baseline (rates of each failure category)
2. PM hypothesizes prompt-shape changes for each sub-cluster
3. User runs sessions with proposed changes (A/B against original where possible)
4. Phase 4a captures behavior under both prompts
5. PM analyzes; refines hypothesis
6. When hypothesis converges, Code implements as production prompt change
7. Continued observation over several sessions

### §3.5 Acceptance criteria

- Each sub-investigation either: shipped fix + observed behavioral improvement, or hypothesis tested and rejected (with reasoning), or routed to KNOWN_BUGS/FUTURE_FEATURES with explicit rationale
- Investigation #2 close-out DECISION_LOG entry summarizing each sub-investigation's outcome

### §3.6 Investigation #2 explicitly does NOT do

- Doesn't claim to "fix continuity" — it tries to reduce specific failure rates measured by specific signals
- Doesn't introduce new state-tracking infrastructure (that's Phase 5+ territory)
- Doesn't extend Phase 4a's signal roster except where directly needed

---

## §4. Investigation #3 — Shelter-fixation diagnostic

### §4.1 What this is

The original Phase 4 scope. The AI DM has a documented behavior pattern of over-emphasizing shelter-finding when survival mechanics are active. Investigation diagnoses why and designs counter-mechanism.

### §4.2 What's known going in

From earlier audit conversations:
- Pattern surfaced via gameplay observation, pre-Phase-3
- Likely cause: shelter is mentioned in prompts for survival contexts; AI pattern-matches and surfaces shelter even when narrative is about something else
- Survival intensity setting (Phase 3.3 SC-7.6.5) doesn't currently affect prompt structure beyond the threshold values

### §4.3 What this investigation builds toward

A targeted prompt-shape change that reduces shelter-fixation without losing legitimate shelter-relevance. Possibilities the investigation might surface:

- Restructured survival section in `dmPromptBuilder` that frames mechanics without leading-the-witness language
- Conditional inclusion: only surface shelter-relevant context when player is actually outdoors / in survival situations
- Anti-shelter-default counter-prompt when context doesn't warrant it

### §4.4 Implementation shape

Similar pattern to Investigation #2 but more focused (single behavior, narrower scope):

1. Phase 4a captures pre-change baseline: what fraction of turns mention shelter-related terms; what fraction is genuinely warranted
2. PM hypothesizes prompt change
3. User runs A/B sessions
4. Phase 4a captures post-change rates
5. Compare; iterate; ship when hypothesis converges

### §4.5 Acceptance criteria

- Pre-change baseline measured
- Post-change measurement showing reduction in unwarranted shelter mentions (with target reduction defined at investigation start)
- Production prompt change shipped if hypothesis succeeds; routed to KNOWN_BUGS if not
- Investigation #3 close-out DECISION_LOG entry

### §4.6 Investigation #3 explicitly does NOT do

- Doesn't change survival mechanics (Phase 3.3 territory; already shipped)
- Doesn't broaden to "any AI fixation" — focused on shelter-fixation specifically
- Doesn't extend if shelter-fixation turns out not to currently be a problem (close investigation, route to FUTURE_FEATURES if needed)

---

## §5. Investigations #4-#8 — Roster placeholders

These investigations are on the roster but not specced in detail; specs author at the time priority surfaces.

### §5.1 #4 — Combat difficulty mechanism

Activates the Phase 3.5 placeholder. Builds the prompt-injection mechanism that flips Off/Lenient/Standard/Strict combat difficulty into actual AI narration tuning. Spec authors when investigation #3 closes (or earlier if combat difficulty becomes higher priority).

### §5.2 #5 — Fortress threat emission tuning

Shapes when the AI emits `[FORTRESS_THREAT]` (the marker shipped in Phase 3.7 SC-3.7.1). Phase 4a captures emission patterns; investigation analyzes and tunes. Spec authors when priority surfaces.

### §5.3 #6 — Claude-as-collaborator prompt review

Uses PM (current Opus) directly as a hypothesis input on the production prompt. PM reviews the production prompt with full context; flags concerns; suggests changes; hypotheses get tested empirically against production behavior. Spec authors when priority surfaces.

### §5.4 #7 — DM-craft articulation absorption

The user committed to writing a 3-page DM-craft articulation. Investigation #7 takes that document and works out how to translate it into prompt instruction text at the right abstraction level (per example-as-hard-fact warning). Gates on user delivering the articulation; activates whenever delivered.

### §5.5 #8 — Phase 3 plumbing texture review

Examines where Phase 3's mechanical state (standing scalars, marker outcomes, time-bounded state, etc.) reaches the AI in current prompts. Asks whether the texture between plumbing and AI is right. Spec authors when priority surfaces.

---

## §6. New investigations

When evidence surfaces a high-priority AI behavior issue not covered by the eight roster items, it joins the roster. PM authors a new investigation spec following the same shape as investigations #1-#3.

The bar for promotion: "this is a high-priority AI behavior issue affecting current play" — not "this might be interesting to investigate someday."

Items that don't meet the bar route to KNOWN_BUGS (if the issue is real but lower priority) or FUTURE_FEATURES (if the work is genuine future enhancement).

---

## §7. Phase 4b exit

Phase 4b exits when no further high-priority AI behavior issues warrant investigation. Specifically: PM + user agree that observed AI behavior reaches acceptable quality against the OoDL reference texture, with no specific failure modes promoted to investigation status.

This is a real PM call when it surfaces. It's not "every investigation on the roster has shipped" — investigations may close as routed-to-KNOWN_BUGS rather than shipped. It's not "X weeks have passed" — investigation work isn't time-boxed. It's "the practice is established, and the current state is good enough that further investigation isn't producing meaningful improvement."

After Phase 4b exits, the practice continues as ongoing project work: future audits, future investigations as evidence surfaces. Phase 4b just establishes the discipline.

---

## §8. Handoff to Code

### §8.1 What this spec is

A framework document for Phase 4b plus detailed scoping for the first three investigations. Subsequent investigations spec at activation time.

### §8.2 Sequence Code follows

1. **Wait for Phase 4a closure.** Phase 4a's instrumentation gates Phase 4b.
2. **Wait for Investigation #1 spec activation.** PM signals when Phase 4a is ready and Investigation #1 is starting.
3. **Execute Investigation #1** per its spec (above). End of investigation, ship + close.
4. **Continue with Investigation #2, then #3, then subsequent investigations** per priority order.

### §8.3 What Code is being asked to do (per investigation)

- Implement prompt changes per investigation spec
- Author tests where investigation introduces new behavior signals
- Coordinate with PM during analysis phase (PM-driven investigations need Code's read on implementation feasibility)
- Ship at investigation cadence (per-investigation review, not per-phase)

### §8.4 What Code is NOT being asked to do

- Run the investigations alone (PM drives analysis; Code implements)
- Pre-build infrastructure for investigations not yet specced
- Make autonomous prompt changes
- Promote items between KNOWN_BUGS / FUTURE_FEATURES / investigation status (PM owns triage)

### §8.5 Standing by

Phase 4b doesn't activate until Phase 4a closes. After Phase 4a closure, PM authors Investigation #1 detailed activation message and hands off.

---

## Document footer

**Authored:** 2026-05-06 by PM.
**Lock date:** 2026-05-06 (framework + first three investigations); subsequent investigations dated at their activation.
**Supersedes:** Nothing.
**Related:**
- `PHASE_4_OVERVIEW.md`
- `PHASE_4A_SPEC.md`
- `Order_of_Dawn_s_Light_-_Original_Campaign_Conversations_with_Claude.pdf` — reference texture
- `KNOWN_BUGS.md` and `FUTURE_FEATURES.md` — deferral routing destinations
- `DECISION_LOG.md` — to receive Phase 4b entries during execution