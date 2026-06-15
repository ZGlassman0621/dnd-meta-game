# Future Features & Enhancements

Feature ideas for future implementation.

> **Post-v2.0 MVP status (2026-06-04).** Some entries below describe systems that
> were **archived** in the v2.0 MVP reduction. Building them now means **restoring
> the archived system first** (see `/archive/` + `archive/README.md`). Archived-system
> entries: **Drow Lolth Standing Tracker**, **Downtime system activation**, **Deeper
> work — surfaced during Prelude play-testing**, **Prelude → Primary Campaign Handoff
> (Phase 5)**, and the prelude half of **Unify Opus + Lean Prompt toggles**.
>
> Entries that are **directly actionable for the current MVP** (no restore needed):
> **Session Hi-Fi implementation (the in-session cockpit)** — now briefed for Claude
> Design at `Claude UX Design/MVP_DESIGN_BRIEF.md`; **Legacy System** (the
> character-lineages north-star); **Self-hostability roadmap**; **Character Image
> Generation**; **Visual World Map**; **Character creator deferred polish**.

---

# Entry to Add to FUTURE_FEATURES.md

Paste this entry into `FUTURE_FEATURES.md` under the appropriate section (likely the same content/system-additions area that holds the Themes content lift and Ancestry Feats progression-layer entries). It's a content-addition workstream, not infrastructure.

---

## Self-hostability roadmap (offline-capable LLM operation)

**Priority:** Strategic — load-bearing for the project's "end of the world" framing
**Status:** Planning entry. No work scheduled. Captures the path from current cloud-dependent state to fully self-hostable operation.

The project's stated goal is software that runs when nothing else works — when the cloud is gone, when Anthropic's API is unreachable, when long-distance infrastructure has failed. Current architecture depends entirely on Anthropic's hosted Claude for narrative AI work. Without a path to local inference, the program degrades to a character-sheet manager in any "end of the world" scenario.

This entry captures the realistic path. Not custom model training (out of solo-developer scope). Not "build our own LLM" (years of community-scale work). The realistic version: become *swap-ready* for whatever local model is sufficient when the moment arrives, and build toward that incrementally.

### What "swap-ready" means concretely

A clean separation between game logic and AI inference such that the inference endpoint can be replaced — local model, different cloud provider, hybrid — without touching game code. The architecture today is partially there: `apiService.js` is a real seam, prompt builders are deterministic functions of game state, and the marker pipeline / chronicle extraction / DM dispatch layers don't know what model produced their inputs. What's missing is a formal *provider abstraction* that takes "AI work intent" (gameplay prose, structured extraction, etc.) and routes to whatever's currently configured.

### Five levels of "modifying an existing local LLM"

When the time comes to actually run a local model, "modify" can mean any of the following. Realistic path likely includes most of them at different stages:

**Level 1 — Use as-is, your prompts.** Pull an open-weights model (Llama, Qwen, Mistral, DeepSeek — whatever's good when you do this), serve via Ollama / llama.cpp / vLLM, point the provider abstraction at the local endpoint. No model modification; the model runs on your hardware with your existing prompts. Effort: days to weeks once provider abstraction exists.

**Level 2 — Prompt-engineer for the local model.** Same model, retuned prompts. Different models have different sensitivities; what works on Opus may not work on a 13B local model. Per-system prompt tuning to match the local model's optimal shape. Effort: ongoing iteration, real data-driven work, gated on diagnostic infrastructure (see "What needs to come first," below).

**Level 3 — Full fine-tuning.** Continue training an open-weights base model on data from your campaigns. Produces a model that's internalized your game's prose voice, world consistency, and narrative shape. Real engineering: training data preparation, GPU compute (cloud or local), evaluation, iteration. Probably overkill for solo use; included for completeness.

**Level 4 — LoRA / QLoRA adapters.** Cheaper, faster fine-tuning that produces small swappable "adapter" layers instead of modifying all the model's weights. Doable on consumer GPU hardware overnight. Multiple specialized adapters per use case (DM voice, chronicle extraction, in-character NPC dialogue, etc.). Tools: Axolotl, Unsloth, Ollama's emerging fine-tuning support. **Likely the eventual production path for this project.**

**Level 5 — Architectural augmentation.** Beyond the model itself: retrieval-augmented generation (RAG) pulling from chronicles, agent loops with verification stages, specialized smaller models for subtasks, prompt-time context optimization for smaller windows. Some pieces already exist in primitive forms (chronicle injection ≈ RAG; correction-loop ≈ agent loop). A local-model future likely leans harder into these to compensate for raw model quality.

### What needs to come first (work to enable the path)

Three specific pieces of work that aren't on the plan today, in rough priority order:

**1. Provider abstraction at `apiService.js`.** A formal seam that takes intent (e.g., `'gameplay-prose'`, `'structured-extraction'`) and routes to a configurable provider. Today's implementation: route everything to Anthropic. Tomorrow's implementation: route per-intent to whatever backend's appropriate (local Ollama for prose, hosted API for fallback, mixed routing during transition periods). Doesn't change anything operational; sets up the swap.

This is the single highest-leverage piece of swap-readiness work. Without it, every other piece is harder. With it, every other piece is bounded.

Likely a small dedicated phase — "Phase 3.5" or "Phase 4.5" — with clear deliverables, isolated scope, no competition for attention. Realistic effort: weeks of focused work.

**2. Prompt-shape diagnostics (widening Phase 4 scope).** Different models respond differently to the same prompts. Today's prompts are tuned for Opus. A future local model — even a very good one — has different sensitivities, different context window characteristics, different prompt-shape preferences. What's missing today: visibility into how prompts perform.

A diagnostic layer that records *prompt → response → quality signals* for every AI call would let us, over time, characterize the prompts empirically. Which prompts trigger marker malformation? Which trigger rule violations? Which run too long for a hypothetical smaller context window? The marker correction-loop is the closest existing thing; this is its broader generalization.

Phase 4 (AI behavior diagnostic) is the natural home. The current Phase 4 framing focuses on diagnosing specific AI behavior issues (shelter-fixation, etc.). Widening Phase 4's scope to include "prompt characterization for swap-readiness" costs scope but is high-value if Phase 4 is happening anyway.

This work also doubles as **data collection for Level 4 LoRA fine-tuning.** Each Opus campaign session generates training data for a future fine-tuned local model. The diagnostic layer is the capture mechanism. Setting it up early means we have the data when we need it.

**3. Context window discipline (prompt accounting).** Opus's context window is large. Local models in 2026 have meaningful but smaller windows. Prompts have grown organically — chronicles inject, marker schemas inject, mythic context, NPC blocks, faction blocks, companion blocks, world state. There's no current mechanism to *measure* how much context each system contributes per turn.

A "prompt accounting" pass — measure, log, expose — would surface what's actually in the prompt and let us make priority calls about what to trim if a smaller context becomes necessary. Could pair with Phase 4's diagnostic widening or land standalone. Smaller piece of work than #1 or #2.

### Realistic milestones (rough sequencing, no commitment to dates)

- **Milestone A: Provider abstraction shipped.** A small dedicated phase. After this lands: nothing changes operationally; everything routes through the abstraction; Anthropic stays the configured backend.
- **Milestone B: First Level 1 test.** Pick a currently-strong open-weights model (whichever's best when you do this), run sample prompts side-by-side with Opus, characterize the gap on this project's specific prompts. Days of work; produces concrete information about today's quality gap.
- **Milestone C: Diagnostic layer ships (Phase 4 expansion).** Captures prompt-response pairs with quality signals. Active use: diagnosing existing AI behavior issues. Side benefit: training data accumulating.
- **Milestone D: Context accounting ships.** Visibility into prompt composition; informs trimming priorities.
- **Milestone E: Level 2 prompt tuning per system.** As specific systems show quality gaps on local models, retune. Iterative; ongoing.
- **Milestone F: First LoRA fine-tune.** Once campaign data has accumulated and base model quality has improved enough that fine-tuning earns its keep. Probably starts with the most prose-quality-sensitive system (DM session generation).
- **Milestone G: Production-quality local-model gameplay.** The actual swap. Local model becomes the default; cloud provider becomes optional fallback or fully retired. Full self-hostability achieved.

### What's deliberately not in scope

- **Custom model training from scratch.** Years of community-scale work. Not a solo-developer project.
- **Active multi-provider operation.** Provider abstraction enables it; running multiple providers simultaneously in production adds operational complexity without gameplay benefit. Build the abstraction; flip the switch when ready.
- **Aggressive prompt optimization for hypothetical local models today.** Today's prompts are tuned for Opus because Opus is the production backend. Building toward hypothetical model shapes now means building twice. Build for what's running; collect data; retune fast when the moment comes.

### Trigger conditions to revisit

- **A particular open-weights model release hits the right shape** — atmospheric prose quality on long-context narrative work approaches usable level. Could happen any time given current model release cadence.
- **Anthropic API access becomes meaningfully constrained** — pricing changes, capability changes, geographic availability changes, anything that creates urgency on the swap.
- **Phase 7 (long-running play) starts hitting realistic timescales** — once campaigns are running for months and years of game-time, the "what if I lose API access mid-campaign" question becomes felt rather than theoretical.
- **Another solo developer or small project demonstrates production-quality local-LLM gameplay** — proof point that the path is viable. Lowers risk on committing to the work.

### Estimated effort

Provider abstraction: a small dedicated phase, weeks of focused work.
Diagnostic layer (Phase 4 expansion): variable depending on Phase 4 scope.
Context accounting: smaller, days to weeks.
Level 1 testing: days, post-provider-abstraction.
Level 2 prompt tuning: ongoing, distributed across many phases.
Level 4 LoRA fine-tuning: weeks of dedicated work when data is ready.
Total path to Milestone G (production-quality local-model gameplay): plausibly 2027-2028 given current model release trajectory; sooner with luck on open-weights releases.

### Related docs

- `PROJECT_BRIEF.md` (the "end of the world program" framing this entry takes seriously)
- `CONSOLIDATED_TODO.md` Phase 4 (AI behavior diagnostic — natural home for diagnostic widening)
- `CLAUDE.md` model-split documentation (the prose-vs-non-prose principle that extends naturally to provider selection)
- `apiService.js` (the seam where provider abstraction lands)
- `dmPromptBuilder.js`, `preludePromptBuilder.js`, `dmModePromptBuilder.js` (the prompt-builders that benefit from accounting + diagnostic instrumentation)

### What this entry isn't

Not a commitment to do the work. Not a schedule. Not a feasibility assessment of any particular open-weights model. **A planning entry to capture the realistic path while it's clearly in mind**, so future scoping decisions can shape current work around keeping the path open. The day Milestone A becomes urgent, this entry should make scoping fast: the path is already mapped; only execution remains.

## Drow Lolth Standing Tracker

**Priority:** Deferred — character-content-specific
**Status:** Designed in `AI_NARRATIVE_PERSISTENCE.md` (Drow Lolth standing tracker entry) and `ANCESTRY_FEATS.md` (Drow L13 Lolth's Favor / Defiance). Has zero footprint in code today.
**Depends on:** Phase 3 standing-scalar abstraction. Once that abstraction lands, building this becomes "instantiate the abstraction for a new locus" rather than designing a new bespoke schema.

**What it is:** A scalar value tracking a Drow character's standing with Lolth — devout-and-favored to apostate-and-cursed. Updates via player actions that align with or defy Lolth (assisting Drow, killing Drow, defending or opposing Lolth's interests, how Lolth-aligned NPC interactions resolve). At L13, the summoned spider's reliability and behavior under Lolth's Favor / Defiance depends on current standing.

**Why deferred:** User does not play Drow. Lolth standing is Drow-specific — it doesn't apply to non-Drow companions or any other system. With nobody likely to ever trigger it in practice, building it now would be premature. The Phase 3 standing-scalar abstraction is justified by other consumers (companion loyalty, faction standing, Mythic piety, NPC disposition, DM Mode bond-shifts, Aasimar Path's Choice); Lolth was an example of "trivially addable once the abstraction exists," not a justifier. Removing it from Phase 3 scope keeps that phase focused.

**Trigger to revisit:**
- User decides to play a Drow character in Player Mode, or
- A Drow companion the user has actually recruited reaches L13 and Lolth's Favor / Defiance becomes mechanically active in their play, or
- A campaign with significant Drow content gets started and standing-with-Lolth becomes a live story dimension

**Scope when revisited:**
- Build the standing tracker as a new instantiation of the Phase 3 standing-scalar abstraction (per-character per-deity-or-faction-equivalent scalar + label + audit trail). Most of the structural work is the abstraction; this is the consumer.
- Wire L13 Lolth's Favor / Defiance ability to consult standing for spider reliability.
- Author the standing-shift events (what the AI watches for, how big the shifts are, what NPC interactions move the needle).
- Decide whether standing is visible to the player (always-on UI element, surfaced only when consequences fire, never).

**Estimated effort when reactivated:** Small — a few days of work assuming the abstraction is in place. The abstraction is the load-bearing piece; this is content + wiring.

**Related docs:**
- `AI_NARRATIVE_PERSISTENCE.md` (Drow Lolth standing tracker entry — design source)
- `ANCESTRY_FEATS.md` (Drow L13 Lolth's Favor / Defiance ability)
- `ANCESTRY_FEATS_REDESIGN_DEFERRED.md` (the broader feat-vs-race-quest framing question may reshape this when both are reactivated)
- Phase 3 standing-scalar abstraction (when shipped) — the dependency

### Nardo's Manual of Martial Mastery — weapon-tier and fighting-style feat layer

**What:** Add a layer of L4+ feats giving martial characters meaningful weapon-specific identity and weapon-pair fighting styles. Source content is *Nardo D&D's Manual of Martial Mastery* (a homebrew supplement found online, attributed to "Nardo D&D @ Youtube.com"). Two categories:

- **Weapon Mastery Feats — 36 feats**, one per PHB weapon (battleaxe, blowgun, club, dagger, dart, flail, glaive, greataxe, greatclub, halberd, handaxe, hand crossbow, heavy crossbow, lance, light crossbow, light hammer, longbow, longsword, mace, maul, morningstar, musket, pike, pistol, quarterstaff, rapier, scimitar, shield, shortbow, shortsword, sickle, sling, spear, trident, war pick, warhammer, whip). Each grants an ability score increase plus three weapon-specific features that typically: add a weapon mastery property, modify the weapon's damage die or range, and grant a signature technique (e.g., Greataxe's "Skull Splitter" triple-dice-on-crit, Trident's "Sword Catcher" disarm reaction, Shield's "Bashing" extra attack).

- **Fighting Style Feats — 16 feats** for specific weapon-pair combos and specialty styles: Anvil of Thunder (warhammer + battleaxe), Bear Fang (battleaxe/handaxe + dagger), Blowgun and Scimitar, Greatclub and Dart, Hammer and Piton, Hammer's Edge (longsword + warhammer), Hand Crossbow and Greatsword, Maul and Greataxe, Morningstar and Wand, Shielded Axe, Spellrazor (dagger + touch cantrip), Spinning Halberd, Three Mountains, Trident and Net, Turtle Dart (heavy armor + shield + shortsword), and Weapon and Torch.

The thematic appeal is real: this is exactly the kind of "your weapon means something" texture 5.5e gestures at with weapon mastery properties but doesn't fully deliver on. Gives every martial weapon a 4th-level "I'm a [weapon] specialist" upgrade path, and the fighting-style feats fill a niche 5.5e left empty when it folded fighting styles into class features.

**Why deferred:**

1. **Licensing question is unresolved.** This is fan content from a YouTube creator, not WotC material. For private personal-table use, fine. For shipping in a public product — even free — we'd need either Nardo's permission or a clean rewrite using these as inspiration rather than direct adaptation. The licensing decision wants to be made consciously, not slid past.
2. **Active threads outrank it.** Prose-quality work, Phase 5 prelude handoff, Themes content lift, and the Ancestry-Feats redesign question are all higher priority. This is additive content, not load-bearing infrastructure.
3. **AI-trigger spec work is non-trivial.** Like Themes (which the Themes review flagged as "AI-trigger specs absent — load-bearing risk"), every one of these 52 feats needs the AI DM to know when to invoke it. Without spec work, they become invisible character-sheet text. The AI persistence engineering thread should make headway before we add another 52 features dependent on it.

**Trigger to revisit:**
- After Themes content lift completes — the AI-trigger-spec pattern will be established and reusable for these feats.
- After the Ancestry Feats redesign question resolves — that decision determines whether the L4+ feat slot is even available for these (current 5.5e cadence puts ASIs at L4, but the redesign may reshape the progression layer).
- If a martial-heavy playtest surfaces "weapons feel interchangeable past the basic mastery property" as a real complaint — confirms the design pressure these solve.
- If the user wants to use a specific feat at the table during private play (one-off pick is much lower cost than full integration).

**Scope when revisited:**

1. **Licensing call (non-engineering).** Reach out to Nardo for permission to adapt, OR commit to "inspiration only" and rewrite each feat in the project's own voice. Affects every downstream step.

2. **Balance pass.** Several feats need pressure-testing against the existing system before integration. Specific watch-list (not exhaustive):
   - Greataxe Skull Splitter — triple dice on crit + crit on 19, stacks dangerously with Champion Fighter's improved crit range.
   - Rapier Successive Piercing — second attack rolls and damages twice; large multiplier for action-economy classes.
   - Trident Sword Catcher — disarm-and-break-mundane-weapons reaction may invalidate certain encounter designs.
   - Heavy Crossbow Portable Ballista — 1d12 base, double damage to objects, +Slow mastery; may overshadow other ranged options.
   - Maul and Greataxe Densely Packed Strikes — flat +2d6 to every attack while wielding both is a big static damage floor.
   - Morningstar Long Hafted — converts a non-versatile weapon into a Versatile + Reach + Slow weapon for 1 hour of crafting; effectively rewrites the weapon's slot in the equipment table.
   - Anvil of Thunder "The Thunder" — AoE thunder damage from a weapon attack is a meaningful step outside martial design space.
   - Several feats stack their granted Weapon Mastery on top of the weapon's existing one, effectively giving 2-3 masteries per attack — needs explicit ruling on how that interacts with the per-turn mastery limits.

3. **AI-trigger specs.** Each feat needs guidance for when the AI DM should narrate or invoke it. Patterns will likely cluster (passive damage adders, conditional reactions, named special techniques) — design the patterns first, apply across all 52.

4. **Schema and integration.** New feat category, new feat data, integration with `LevelUpPage.jsx` for selection, integration with the DM prompt for awareness. Likely smaller than Ancestry Feats since these don't have the multi-tier progression — flat L4+ unlock with a prereq check.

5. **Editing pass.** The PDF has a fair number of typos and wording ambiguities that need cleanup regardless of licensing path: "wiled" (Light Crossbow), "Halberd" appearing in Heavy Crossbow text, "loner" (Blowgun and Scimitar), "Continues" (Whip — should be "Continuous"), "Closing Jaws" damage timing wording, etc.

**Estimated effort:** Multi-day to multi-week depending on choices. Licensing permission + light adaptation is the cheapest path (~few days for balance pass + AI-trigger specs + integration). "Inspiration only" rewrite is closer to multi-week — 52 feats × original-design effort plus everything above.

**Related docs:**
- `Nardo_D_D_s_Manual_of_Martial_Mastery.pdf` — source material (project files)
- `THEMES_REVIEW.md` — analogous AI-trigger-spec problem at scale
- `ANCESTRY_FEATS_REDESIGN_DEFERRED.md` — progression-layer cadence question that interacts with this
- `AI_NARRATIVE_PERSISTENCE.md` — the AI-memory thread these depend on for "AI knows when to invoke"

**Independent of code work — research tasks before this thread reactivates:**
- Locate Nardo's contact channel (YouTube channel description, Patreon, etc.) and any stated terms of use for the manual.
- Cross-reference these feats against current 5.5e weapon mastery properties to identify any direct duplication of post-2024 official content.

## LLM infrastructure follow-up pass
What: Pick up the remaining deferred items from the LLM Setup audit and Phase 2 fixes (v1.0.102). Includes the Ollama fallback smoke test, tagged-error coverage extension to non-/message paths, doc-hygiene polish, and any new findings that surface in the smoke test.
Why deferred: The high-priority fixes shipped in v1.0.102 (auth/billing handling, rate-limit retry, Ollama model verification, doc drift). Combined with the user's manual setting of an Anthropic console spending cap, the major operational risks are now bounded. Remaining items are quality-of-life rather than safety-critical.
Trigger to revisit:

Before starting a long-running campaign (the smoke test ensures fallback actually works before you depend on it)
When the project moves to a new machine, or after any major prompt refactor (validates the fallback against a changed system prompt)
If a real failure surfaces in a non-/message path that should have produced a clear tagged error
If costs ever shift in a way that makes the console cap insufficient

Scope when revisited:

Ollama fallback smoke test (the big one). Pull gpt-oss:20b (~12GB), unset ANTHROPIC_API_KEY, play 2-3 turns of an actual session. Three possible outcomes, each leading to different downstream work:

Fallback works cleanly → no further action needed beyond documenting that it's been validated
Fallback half-works (some features broken, basic narration OK) → identify what's broken; decide whether to fix or document limitations
Fallback is broken → significant engineering work; reassess whether Ollama is still load-bearing for the project


Tagged-error coverage extension. The new tagged-error infrastructure (AUTH_FAILURE, RATE_LIMITED, OVERLOADED) is wired through dmSession.js /message only. Extend to /start, /restart, DM Mode routes, and generator services (campaign plans, NPCs, quests, locations, companions, adventures). Each route currently surfaces a 401/403/429 as a generic error.
Doc-hygiene polish on LLM_SETUP.md:

Line 49 module structure description (still describes ollama.js as "Session Orchestrator" — misleading post-Claude-default)
Cross-platform Ollama install instructions (currently macOS-only)
API key rotation procedure (what to do if a key is leaked)
Workspace-scoped keys with per-key spending caps as best practice
User-facing fallback experience documentation (what does the player see when fallback fires)


Cost monitoring deepening (only if needed). Per-call cost calculation logging, persisted lifetime totals. Currently deferred because the console cap is the real backstop. Revisit only if cost shape changes dramatically.

Estimated effort: Multi-hour to multi-day depending on smoke test outcome. Smoke test alone is ~1 hour of work plus the 12GB Ollama model download. Tagged-error coverage extension is ~1-2 hours. Doc polish is ~1 hour. If smoke test surfaces broken fallback, scope expands significantly.
Related docs:

LLM_SETUP.md (current operational documentation)
LLM_SETUP_REVIEW.md (review findings, deferred-action list)
v1.0.102 changelog (Phase 2 fixes)
DECISION_LOG.md (cost decisions and Opus-default rationale)

Independent of code work — user task to verify before this thread reactivates:

Run git log -p | grep -i "sk-ant" in the project repo to confirm no API key has ever been committed to git history. If the search returns anything, rotate the key immediately at console.anthropic.com.

## Downtime system activation
What: Bring the Downtime v3 system from designed-but-dormant state to functional in-play feature. This includes implementation reality assessment (what's built vs not), reconciling the original-intent vs v3-design tension, balance pass on the 30+ activities, UX design for the Downtime Planning screen, and first-playtest validation with a long-running character.
Why deferred: Downtime is the project's origin system but has fallen into disrepair while the project has been in building mode (short-lived test characters rather than continuous campaigns). Activating Downtime in isolation would be premature optimization — it should pair naturally with the transition out of building mode into long-running character play. Additionally, the system has the heaviest AI memory dependency of any system reviewed so far; full activation likely requires the AI Narrative Persistence engineering thread to be further along.
Trigger to revisit:

User starts a long-running character intended for sustained play (the natural pairing event)
AND the AI Narrative Persistence engineering thread has progressed enough to support per-NPC tracking, companion personality state, faction standing tracking at scale
OR a partial activation makes sense before either of the above (e.g., player-driven planning mode without the AI-memory-heavy features like Reflection or vignette curation)

Scope when revisited:

Implementation reality assessment. Audit what exists in code (v2 functionality, partial v3, nothing). Determines whether activation is "implement v3 from scratch" (multi-week engineering) or "repair existing v2 to v3 spec."
Reconcile original-intent vs v3-design tension. Original was time-driven (passive, while player is away). v3 is session-driven (explicit allocation between sessions). Decide which version is being built — or whether v3 is the planning layer with a future passive-progression layer added later.
Numeric balance pass. Pressure-test the 30+ activities against each other for cost/benefit parity. Currently explicitly deferred from design phase.
Define "minimum interesting Downtime" threshold and 90-day cap rationale. Sub-5-day Downtimes feel useless; need either a minimum or short-Downtime-specific activities. The 90-day cap needs documented rationale.
UX design pass for Downtime Planning screen. Currently a one-line implementation note. Will be one of the screens players spend the most time in. Non-trivial design work.
AI Narrative Persistence prerequisites. Many Downtime features (companion requests, Reflection triggers, vignette curation, NPC absence-decay tracking) require AI memory architecture being further along. Activation may need to wait for or coordinate with that thread.
First playtest with a long-running character. The system gets stress-tested against actual sustained play.

Estimated effort: Multi-week to multi-month engineering thread, depending on implementation reality. Not a small fix.
Related docs:

DOWNTIME_DESIGN.md (the v3 spec)
DOWNTIME_REVIEW.md (review findings, deferred-action list)
AI_NARRATIVE_PERSISTENCE.md (Downtime adds significant entries here)
Mobile Notifications future feature (the original-intent ghost — passive while-player-is-away mode)

## Themes System (Leveling Backgrounds)

**Priority:** Medium
**Status:** Design in progress — not ready to implement

Inspired by Starfinder's Themes. The concept is to take D&D's existing backgrounds and expand them into a progression system that grants new abilities at milestone levels (1, 5, 11, 17), giving characters a "concept layer" that evolves alongside class and subclass rather than being a static L1 choice.

**Core design (locked-in decisions in 2026):**
- Each standard D&D background becomes a Theme with 4 tiers of abilities
- L1: Skill/tool proficiencies + a passive flavor trait (same as current backgrounds)
- L5: A small active or always-on ability tied to the theme's identity
- L11: Expertise Die (**d4** at L11, scaling to **d6** by L17) on the theme's key skills — unlocked here so it feels earned
- L17: A capstone that makes the concept feel legendary, plus the Expertise Die scaling step

**Progression model — automatic, narratively delivered.** Themes unlock automatically at the milestone levels — no choice menus. The unlock is delivered through narrative, picked by the AI DM based on current scene context:
- **Story-driven** (preferred when context fits): An in-fiction NPC initiates the unlock — a mentor recognizes the character is ready, a temple elder bestows new training, a guild master entrusts a deeper secret.
- **Passive narrative** (when no story-appropriate moment exists): Delivered post-long-rest, Oblivion-style — a short reflective beat where the character realizes something has shifted, followed by a clean "You've gained: [ability]" card.
This keeps progression as part of the story rather than a menu, while still being predictable and clearly communicated.

**Expertise Die** is the signature mechanic — an extra die added to certain skill checks, tied to theme identity rather than class. A Knowledge Cleric + Acolyte Theme gets it on Religion/Insight; a Criminal rogue gets it on Deception/Stealth; a Sage wizard gets it on two Intelligence skills. Any class can access any theme's Expertise Die by choosing that theme, which creates interesting cross-class flavor (a Fighter + Sage Theme is a military historian).

**Why d4 → d6 instead of d6 → d10:** Themes grant an *edge*, not dominance. A small die avoids stacking absurdly with Bardic Inspiration, Bless, Guidance, and the Help action — and leaves room for Mythic-tier abilities to be the actual "god-like" mechanics. A consequence of the smaller die: it can apply more often without breaking the math.

**Ancestry Feats (companion concept, design in progress):**
Inspired by Pathfinder 2e, where racial/ancestry traits aren't just a L1 dump but a progression — feats unlocked at levels 1, 5, 9, 13, 17 from a race-specific list. A dwarf might unlock tremorsense at L9, magic stonecunning at L13, and stone giant resilience at L17. An elf might unlock fey step, trance mastery, or elven weapon training at different milestones.

The Themes System and Ancestry Feats should be designed together since they occupy the same conceptual space — both are "progression layers that aren't class or subclass." The goal is that a character's identity emerges from the intersection of all three: class, theme, and ancestry, each evolving in parallel.

**Theme Interactions (party-level synergies — confirmed in scope):**
D&D 5e doesn't have party feats the way Pathfinder 1e did with Teamwork Feats (Outflank, Coordinated Maneuvers, etc.) — the closest things in 5e are the Help action, Bardic Inspiration, and a few class features like Battle Master's Commander's Strike. Themes is a chance to introduce genuine party-level mechanics where character identities reinforce each other, rather than each character existing as a self-contained build.

**Synergies apply across the full party — including all-AI parties.** Even though companions and DM Mode characters are AI-driven, each has their own personality, voice, and decision-making. AI characters *choose* whether to invoke a synergy based on their personality and current goals — a loyal cleric companion might reliably set up a Soldier-Cleric coordinated attack, while a reckless barbarian companion might never play into flanking synergies because they prefer to charge alone. This makes companion personality mechanically meaningful: the player learns over time which companions reliably play into synergies, and absences hurt more because losing a Synergy partner removes options the party had become accustomed to.

Four directions worth exploring:

1. **Party Synergies** — Specific Theme pairings unlock collaborative bonuses when both characters participate in an activity together. Examples:
   - Sage + Acolyte researching a relic: combined check uses higher modifier + d4 bonus from shared expertise
   - Soldier + Criminal planning a heist or ambush: both get advantage on the next attack roll after a successful prep scene
   - Folk Hero + Outlander rallying a community: combined Persuasion check counts as one degree of success higher
   - Noble + Charlatan working a social gathering: can swap Insight and Deception modifiers for one round
   These could be unlocked at L5 (when each character's first Theme ability comes online) and grow more potent at L11 and L17.

2. **Theme Resonance** — Themes have implicit compatibility tiers that the AI DM can surface during play:
   - **Kindred** (Sage + Hermit, Soldier + Soldier): natural understanding, conversations flow easily, NPCs perceive them as a unit
   - **Complementary** (Soldier + Acolyte, Noble + Sage): different strengths that fit together
   - **Friction** (Noble + Criminal, Acolyte + Charlatan): built-in dramatic tension that the DM can lean into for roleplay scenes
   This isn't mechanical — it's a flag the AI uses to generate character moments, party tensions, and downtime conversations.

3. **Cross-Theme Training** — At higher tiers, characters who travel together long enough can pick up a single L1 ability from a party member's Theme via extended downtime. The Fighter who spends a year alongside a Sage gains the Sage's L1 trait. This rewards long campaigns and deepening interconnection — and pairs naturally with the Downtime v2 system already in place.

4. **Group Activations** — At L11+, a party member can spend their reaction (or a downtime hour) to **share** their Theme's Expertise Die with an adjacent ally for one check. The Sage lends their d6 to the Fighter making a critical Religion check; the Soldier lends their d6 to the Bard's Intimidation roll. This creates active party-level decisions instead of passive "everyone has their own die" play.

### Avatar feature deferred from MVP creator rebuild. 
Original placement was Step 3 (post-theme-lock, for informed visual identity choice). When revived, slot back into Step 3 unless creator structure has shifted. Existing characters.avatar_url (or equivalent) column is dormant in DB and can be leveraged when feature returns.

### Cross-system progression integration check
What: Verify that the four progression systems (Ancestry Feats, Themes, Mythic, Class) don't produce broken combinations, dead levels, or pathological power stacking when applied together to the same character.
Why deferred: Surfaced during Ancestry Feats system review (April 2026). Identified as the highest-leverage piece of unfinished design work in the Ancestry Feats spec, but doing it well requires Themes and Mythic to also have been reviewed and stabilized. Doing the integration check before reviewing those systems individually means any of them may shift afterward and invalidate the check.
Trigger to revisit: After Themes review and Mythic review are both complete, OR if a specific combination problem surfaces in real play that requires resolution.
Scope when revisited:

Cross-reference Ancestry Feat picks against Theme abilities at every tier — flag overlaps, redundancies, and pathological stacking.
Cross-reference Subclass × Theme synergies (per SUBCLASS_THEME_SYNERGIES.md) — verify the synergy tags are real and balanced.
Cross-reference Mythic × Theme amplification combos (per MYTHIC_THEME_AMPLIFICATIONS.md) — same concern.
Audit level cadence: at every character level (1-20), enumerate what each progression system grants. Flag levels that grant nothing (dead levels) and levels that grant too much (firehose levels).
For each character class, verify that at least one race × theme × mythic combination is viable for that class without forcing class-misaligned picks.

Estimated effort: 1-3 dedicated sessions, depending on how deep the audit goes. Could surface real design problems requiring further work.
Related docs:

ANCESTRY_FEATS.md (current system spec)
THEME_DESIGNS.md, SUBCLASS_THEME_SYNERGIES.md, MYTHIC_THEME_AMPLIFICATIONS.md, PARTY_SYNERGIES.md
Claude UX Design/D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md

**Locked-in decisions (2026):**
- **Theme replaces Background entirely.** "Background" becomes "Theme" everywhere in the UI. Existing characters auto-convert at their current tier. The L1 Theme tier preserves the existing Background's skills, equipment, and feature.
- **21 distinct Themes, one per Background.** Acolyte, Charlatan, City Watch, Clan Crafter, Criminal, Entertainer, Far Traveler, Folk Hero, Guild Artisan, Haunted One, Hermit, Investigator, Knight of the Order, Mercenary Veteran, Noble, Outlander, Sage, Sailor, Soldier, Urban Bounty Hunter, Urchin. Each gets a unique L5/L11/L17 progression — no clustering. Similar Themes (Soldier vs Mercenary Veteran vs Knight of the Order) must be designed with meaningful mechanical differences so the choice matters.
- **2014 rules baseline.** The game uses 2014 PHB rules, not 2024. There is no Origin Feat to replace — Theme L1 is the existing Background structure, and Theme adds the new L5/L11/L17 progression on top.
- **Mythic interaction is amplifying with dissonance arcs.** Resonant Theme+Path combos (Acolyte+Hierophant, Soldier+Angel) gain bonuses. Dissonant combos (Criminal+Angel) unlock a special "Redemption Arc" or "Fall From Grace" narrative path with unique abilities for playing against type. AI DM leans into dissonance for roleplay opportunities.
- **Mentor's Imprint replaces Cross-Theme Training.** Each character can, **once per career**, declare one specific NPC or companion as their most influential bond. After significant downtime with that person, they gain **one L1-tier trait** from that mentor's Theme. Only once. Only with one chosen mentor.
- **Custom Themes ship as a separate post-launch module.** Standard 21 at launch. Custom Themes (Opus-generated four-tier progressions from player concept) come later once the system is proven.
- **Ancestry Feats ship at launch alongside Themes.** Full identity-progression overhaul in one release.
- **Companions auto-pick Ancestry Feats and Theme unlocks based on personality.** No level-up menus for companions. The AI uses voice, mannerism, motivation, ideals, bonds, flaws, and alignment to pick feats that match the character. Selection delivered as a small narrative beat ("Tormund grins. 'Time I learned the old stone-runner trick.'") rather than a menu prompt.

**More locked-in decisions:**
- **Subclass × Theme combos use tagged synergies.** Specific resonant combinations (Battle Master + Soldier, Lore Bard + Sage, Arcane Trickster + Charlatan) get tagged bonuses or shared abilities. Accept some imbalance in service of flavor — major characters should be roughly balanced, but the player character can occasionally feel like a god among mortals.
- **Multiclassing uses total character level.** A Fighter 5 / Wizard 6 unlocks Theme L11 abilities. Consistent with how D&D handles proficiency bonus.
- **All NPCs have Themes for personality flavor.** Most NPCs don't need full mechanical leveling — the Theme is used by the AI DM to give them functional, realistic personalities and consistent voices. Only NPCs the player parties with as companions/hirelings get the full mechanical progression.
- **L1 feature treatment is tabled until Prelude integration.** How the existing Background's L1 feature (Shelter of the Faithful, Position of Privilege, etc.) maps to the four-tier progression depends on whether the prelude is where you *earn* your L1 Theme tier through play. Decision deferred to Prelude+Themes integration design.

**Ancestry Feats progression — locked in:**
- **5 tiers, staggered at L1 / L3 / L7 / L13 / L18.** Avoids overlap with Theme tiers (1/5/11/17), ASIs (4/8/12/16/19), and Mythic tiers (5/10/15/20). Spreads "you got something new" moments across the campaign.
- **10 races in the game** (Genasi, Firbolg, Tabaxi, Goliath removed from character creator): Aasimar, Dragonborn, Dwarf, Elf, Half-Elf, Half-Orc, Halfling, Human, Tiefling, Warforged.
- **Each major race gets its own Ancestry Feat list**, plus subrace variations for **Drow** (mechanically distinct from other Elves) and **Aasimar** (3 paths with different destinies). All other subraces share their parent race's list. **Half-races get their own dedicated lists** (not hybrid picks from parent races) — Half-Elf identity is its own thing, not "elf with human bonuses." Total: ~12 effective lists × 5 tiers = ~60 ancestry feats.

**Party Synergies — three-tier model (see PARTY_SYNERGIES.md for full design):**
- **Tier 1 (Gear & Positioning):** Universal synergies for any two characters based on equipment and tactical position. 10 synergies (Shield Wall, Volley, Spell Convergence, Back to Back, etc.). No Theme required.
- **Tier 2 (Theme):** 34 hardcoded signature synergies for compelling Theme pairs, plus generative tag-based synergies handled by the AI DM.
- **Tier 3 (Team Tactics):** 20 Pathfinder-style shared techniques that both characters must learn together through downtime training (5 days) or field observation. Pair-specific: learning Coordinated Strike with Tormund doesn't mean you can execute it with Sera. Capacity = proficiency bonus.

**Downtime overhaul required:**
- Current Downtime v2 system needs extension to support Team Tactics training as an activity (5 days per tactic, both characters must participate).
- Broader downtime overhaul is due — this should be bundled with Themes/Ancestry rollout.

**Synergy invocation — triggered, not activated:**
- Synergies fire automatically when narrative conditions are met (both characters attack the same target, both succeed on the same skill check, both engage in the same conversation). No action economy cost, no fiddly invocation. The *right circumstances* activate it, which means companion personality matters — companions choose whether to engage in the qualifying action based on who they are.

**Mentor's Imprint — session count + AI gate:**
- Player declares a mentor at any time. After **5+ sessions** where the mentor is present, the AI evaluates behind-the-scenes affinity/relationship data. When the threshold is met, the AI delivers the imprint as a narrative beat. Session count denotes real time passage; the AI gate ensures the relationship has actually deepened, not just co-existed.

**No retroactive unlocks needed** — no existing high-level characters in the system.

**Prelude mechanical payoff — locked in:**
- **Characters who complete a prelude unlock their Expertise Die (d4) at L5 instead of L11.** They've already lived in this background for 3-5 hours of gameplay — they've earned that edge earlier. At L11, it scales to d6 like everyone else's d4, so the gap closes naturally. Non-prelude characters get their standard Theme L1 tier at creation with no penalty — the d4 just arrives at L11 as normal.
- **Prelude + Theme Synergy variants: cut.** Synergies are based on what Themes characters have, not narrative details from session history. Preludes are narrative; synergies are mechanical. They don't need to talk to each other.

**Background L1 feature — locked in:**
- **Keep as-is for launch.** Existing Background features (Shelter of the Faithful, Criminal Contact, Position of Privilege, etc.) become Theme L1 features unchanged. They already work. Enhancement pass can come after the whole system is running.

**Progression map — confirmed clean.** No dead levels, no overloaded levels. L1 is dense (Theme L1 + Ancestry L1 + class) but that's character creation, not a level-up. All open design questions are resolved.

**All architectural decisions are finalized. Next phase: content design** — the actual abilities for 21 Theme progressions, 12 Ancestry Feat lists, ~30-40 hardcoded Party Synergies, Subclass×Theme synergy tags, and Mythic amplification combos.

---

## Treat Wounds (Medicine Skill Action)

**Priority:** Medium
**Status:** Ready to design — relatively self-contained

Inspired by Pathfinder 2e. Gives the Medicine skill a meaningful out-of-combat healing role, reducing the game's dependence on spell slots and short rests for recovery. Fits naturally alongside the existing survival system (food/water/foraging).

**Core design:**
- 10-minute action, requires healer's kit (or herbalism kit)
- Medicine check vs DC determines how much HP is restored:
  - DC 15 (trained): 2d8 HP
  - DC 20 (expert, proficiency bonus ≥ +4): 2d8+10 HP
  - DC 25 (master, proficiency bonus ≥ +5): 2d8+20 HP
  - DC 30 (legendary, proficiency bonus ≥ +6): 2d8+30 HP
- Critical success (beat DC by 10+): double the flat bonus
- Critical failure (miss DC by 10+): deal 1d8 damage to the patient instead
- Can only be used on a given creature once per hour (prevents spam)
- Cannot restore HP beyond the creature's maximum

**Integration notes:**
- Pairs well with the Degrees of Success system (also in FUTURE_FEATURES) — if that system is implemented, Treat Wounds is a natural first showcase for 4-outcome rolls
- The existing survival system already tracks foraging/food; herbalism kit proficiency (already in the game) could optionally lower the DC by 2 or expand the usable materials
- Could tie into the Themes system: a Healer or Hermit Theme at L5 might grant advantage on Treat Wounds checks or remove the once-per-hour restriction on allies

**Open design questions:**
- Does this replace or supplement short rest hit dice recovery?
- Should NPCs/companions also benefit, and does the AI DM know to prompt for it during rests?
- Should there be a "battlefield medicine" variant usable in 1 action at a higher DC and lower healing?

---

## Procedural Dungeon Generation

**Priority:** Medium

- Generate dungeon layouts with rooms, corridors, doors, traps, and treasures
- Room-by-room exploration with state tracking (visited, cleared, locked)
- Dungeon map display showing explored areas
- Encounters tied to specific rooms
- Keys, puzzles, and locked doors creating exploration objectives

---

## Character Image Generation

**Priority:** Low

- "Generate Portrait" button on character sheet
- Uses character description (race, class, appearance, gender) as prompt input
- Generates a D&D-style fantasy portrait via image generation API (DALL-E, Stable Diffusion, etc.)
- Player can regenerate if they don't like the result
- Stretch: companion portraits, location art, scene illustrations during DM sessions

---

## Visual World Map

**Priority:** Low

- Location markers on a stylized map
- Fog of war for unexplored areas
- Travel routes between discovered locations
- Click-to-travel for known destinations
- Notable event markers on the map

---

## Tavern Mini-games

**Priority:** Low

- Dice games (Liar's Dice, Three Dragon Ante)
- Card games with NPC opponents
- Drinking contests with Constitution checks
- Gambling with gold stakes
- Win/loss affects NPC relationships

---

## Legacy System

**Priority:** Low

- Retired characters become NPCs in the world
- Dead characters' graves/monuments can be discovered
- Previous characters' actions reflected in world state
- Items left behind can be found by new characters
- Legends and stories about previous characters circulate among NPCs

---

## Mobile Companion App (PWA)

**Priority:** Medium
**Status:** Scoped — ready to implement after core progression systems ship

Turn the existing React client into an installable Progressive Web App so key notifications and decisions can reach the player on their phone — especially useful for **downtime decision moments** (companion requests, critical choices, crafting completions) that the AI DM wants to surface between sessions.

### Why PWA over native

- Uses existing React codebase (no Xcode, no Android Studio, no native rewrites)
- No App Store or Play Store submission required
- No Apple Developer Program ($99/year) or Play Console ($25) fees
- Installs to home screen, runs in its own window, receives push notifications
- iOS 16.4+ and all modern Android support the Web Push API

### Phase 1 — Install to home screen (~2 hours)
- Add `manifest.json` to the client
- Add a service worker for offline shell
- Home screen install prompt appears on supported browsers

### Phase 2 — Basic push notifications (~4 hours)
- Generate VAPID keys for Web Push
- Add `web-push` npm package to server
- Store device push subscriptions in a new `push_subscriptions` table
- Fire test notification: "Downtime complete — Tormund has a question for you"

### Phase 3 — Interactive decision flow (~1-2 days)
- Notifications include deep links to a decision page
- Decision page: "Tormund wants to visit his family. Approve / Redirect / Discuss"
- Response syncs to server and is consumed by AI DM at next session
- Primary use case: companion requests during downtime

### Phase 4 — Broader notification surface
- Crafting project completions
- Companion relationship milestones ("Sera has grown close enough that the Mentor's Imprint is available")
- Narrative queue alerts (faction events, political shifts)
- Mentor's Imprint thresholds
- Any AI DM `[NOTIFY]` marker can fire a push

### iOS gotchas (manageable)
- Push requires iOS 16.4+ and the PWA must be installed first
- Install UX on iOS hides behind Safari's share menu — needs an onboarding screen explaining the install steps
- Android is significantly easier — install prompt works on first visit

### Open questions (for when we implement)
- Should notifications be per-campaign or global per-user?
- Do we want a mobile-first alternate layout for the Downtime Planning screen, or reuse the desktop layout?
- Should this work for DM Mode too (e.g., "Your party of AI characters has made a decision that needs review"), or is it Player Mode only?

---

## Character creator — deferred polish from v1.0.40

**Priority:** Low
**Status:** Deferred during the v1.0.40 descriptions pass. Both items are polish, not player-blocking.

### 1. Class features data-schema rewrite
Currently `client/src/data/classes.json` stores each class's `features[]` as an array of `"Name - Description"` strings. The wizard parses these at render time via `splitFeature()` in `CharacterCreationWizard.jsx` and styles them as bold name + description.

**What we'd change:** Convert every entry from a string to `{ name, description }` so the data is self-describing instead of relying on a ` - ` separator convention.

**Why it was deferred:** All ~150 entries across 17 classes already have usable descriptions embedded, and the split helper produces identical rendered output. Pure refactor with no player-visible change. Worth doing the next time class data needs editing for another reason (e.g., when adding a new class or revising a feature).

**Scope:** ~150 feature strings to convert; also update `featuresByLevel` subclass maps where the pattern is inconsistent; verify wizard rendering still works.

### 2. Weapon-property tooltips (finesse, versatile, two-handed, etc.)
`client/src/data/references.js` already exports a `WEAPON_PROPERTIES` reference map with 1-sentence descriptions of all 11 weapon properties. They're referenced today only via the existing inline stat line (e.g., "Longsword — 1d8 slashing · versatile · 15 gp · 3 lb").

**What we'd add:** Hover/click tooltips on each property in that stat line, showing its description. Also applies wherever weapons appear in ancestry feat sub-choices and class starting-equipment dropdowns.

**Why it was deferred:** The native `<select>` element doesn't render rich tooltips, so this requires either (a) migrating the relevant pickers to a custom dropdown component or (b) adding a dedicated "hovered property" helper line under the selected item. Both are bigger surface-area changes than fit inside the v1.0.40 diff.

**Scope decision needed:** Custom dropdown vs. inline glossary line. Inline is simpler; custom dropdown is more discoverable. Worth picking one when we revisit picker UX.

### Open questions
- Are there other equipment stats worth similar treatment? Armor `stealthDisadvantage` and `strReq` could use 1-line "what this actually means in play" tooltips.
- Damage-type glossary has the same problem: damage types appear inline (e.g., "1d8 slashing") but hovering them reveals nothing.

---

## Deeper work — surfaced during Prelude play-testing (v1.0.47-48)

Three areas that need real design work, not just prompt rule tweaks.

### 1. Character voice / tone system (NPC dialogue)

**Priority:** High. **Status:** Deferred.

The existing voice-palette system (v1.0.33, generated by Opus per-NPC)
produces a rough personality sketch — age_descriptor, register,
speech_patterns, mannerisms, vocabulary, forbid. It helps with age-register
differentiation but doesn't deeply capture *how* a character talks — the
rhythm, the hesitations, the class and education markers, the emotional
compression of tired/rushed/guarded speech.

Play-test observations:
- Prompt rules alone ("compressed fragmented dialogue") produce stilted
  approximations — NPCs end up talking like "writerly fragmented
  dialogue," not *like the person they are.*
- Even with ABSOLUTE RULE 17 (authentic speech) and a WRONG/RIGHT pair,
  Sonnet drifts toward a generic "tired mother" voice rather than
  *this* tired mother.
- The problem isn't lexical (shopping list vs. fragments) — it's tonal.
  How does Moira actually sound? Not "tired working-class mother" in
  the abstract; specifically what words does she over-use, what pauses
  does she leave, what does her voice do when she's angry vs. worried
  vs. half-asleep?

**What we'd build:**
- Extend voice palettes with *signature tics* (a phrase they over-use,
  a pause pattern, a specific filler word, a tell when lying).
- Track per-NPC emotional state (tired / tense / open / guarded) and
  modulate dialogue against it.
- Inject 1-2 example lines in the character's voice into the system
  prompt (not rules about their voice — actual sample utterances).
- Consider a "dialogue audit" pass — a small Sonnet check on the
  generated response that flags stilted/generic dialogue and suggests
  a rewrite before delivery. Costs tokens but would catch drift.

### 2. Expanded naming conventions

**Priority:** Medium. **Status:** Deferred.

The AI repeatedly reaches for the same fantasy-stock names — Voss, Lyra,
Aldric, Jarrick, Jakob, Garda, Aldrin. This has surfaced both in main-
campaign NPCs and now in prelude-arc NPCs. The player wants access to
the full richness of fantasy literature as a naming pool, not a generic
"fantasy RPG name" set.

**What we'd build:**
- A server-side name-bank organized by culture/region/class — drawing from
  Tolkien (Middle-earth names have distinct branches), Sapkowski (Slavic
  cadence), Le Guin, Pratchett, Herbert, Moorcock, Howard, Martin, Rothfuss,
  Abercrombie, etc.
- Region-tuned sampling: a Calimshan NPC shouldn't have a Nordic name, a
  Rashemen shaman shouldn't sound Tolkien-Elvish, etc.
- Inject 20-30 suggested names per region/role into the system prompt at
  NPC introduction time, with rotation so Sonnet isn't shown the same
  names every session.
- Consider pulling existing forgotten-realms canon names where known —
  the game already has location/regional data, so there are anchor points.

**Open question:** How to handle the "but I want my OWN names" case — some
players want full creative control. Probably a preference toggle:
"AI name generation: cautious (suggest canonical FR names only) / broad
(draw from the wider literary tradition) / off (I'll name everyone)."

### 3. Cross-session repetition detection

**Priority:** Low. **Status:** Deferred.

The existing repetition ledger (v1.0.34, 30-entry FIFO on the session's
config) catches distinctive phrases reused *within a single session*.
But phrases like "He says the name like he's tasting it" drift across
sessions — Sonnet defaults to certain narrative tics when it doesn't
have a signal to avoid them. One use per session isn't flagged; many
uses across many sessions accumulates without detection.

**What we'd build:**
- Optional character-level (or user-level) repetition ledger that
  persists across sessions.
- Detect over the full DM-output corpus, not just the current session.
- Feed detected repeats back into the prompt as a "don't reach for these"
  list.
- Probably lives on `characters.dm_output_phrase_history` as a TEXT
  JSON column, capped at N most-recent distinctive phrases.

**Design tension:** too aggressive = robs the AI of natural turns of
phrase; too loose = lets the same phrasing creep across sessions. The
existing per-session ledger is intentionally short (30 entries, FIFO)
to avoid this trap. Cross-session version would need a much tighter
definition of "distinctive" to stay useful.

---

## Main-campaign tone preset integration

**Priority:** Medium. **Status:** Deferred until prelude work is complete.

**Context:** The prelude has a proper 4-preset tone system
(`brutal_gritty`, `epic_fantasy`, `rustic_spiritual`, `tender_hopeful`)
with full "tone bibles" in `server/data/tonePresets.js` — register
rules, vocabulary anchors, scene-type guidance, age-scaling, exemplar
paragraphs. `buildTonePresetBlock(presetValue)` formats them for
injection.

The MAIN DM prompt (post-prelude, ongoing campaign) currently has none
of this. Tone reaches the main DM prompt only through scattered
free-text fields (campaign.tone, campaignPlan.dm_notes.tone, module
themes) and gets buried mid-prompt where it can't actually shape
register. A Brutal & Gritty prelude graduates into a tonally
agnostic main campaign, which is incoherent.

**What we'd build:**

1. Add `tone_preset` TEXT column to `campaigns` (one of the 4 canonical
   values, or NULL).
2. Capture the preset at campaign creation:
   - If the campaign was seeded from a prelude character, inherit the
     preset from `prelude_setup_data.tone_tags` automatically.
   - Otherwise surface the 4-option picker in the campaign creation UI
     (same label/description pattern as `PreludeSetupWizard.jsx`).
3. In `createDMSystemPrompt`, when `sessionContext.tonePreset` is set,
   inject `buildTonePresetBlock(preset)` at the TOP of the prompt
   (before Cardinal Rules). Tone shapes BOTH register and scope, so
   lead with it — every example and rule that follows reads through
   that register.
4. When `tonePreset` is unset (legacy campaigns, or user declined to
   pick one), fall back to the current behavior — no tone preset
   block, scattered inline tone guidance only.

**Why deferred:** we're still iterating on the prelude experience
itself (session loop, emergences, canon ledger, theme commitment at
Ch3 wrap). Wiring tone presets into the main campaign before the
prelude-to-campaign handoff is even finished (Phase 5 of
PRELUDE_IMPLEMENTATION_PLAN) would mean reworking it. Do it once, after
the handoff design is locked.

**Note for the future reviewer:** v1.0.90 included a short-lived attempt
at a 7-category tone system (gritty/epic/gothic/political/mystery/
whimsical/default) inferred from free-text campaign tone. That was
reverted as incoherent with the prelude's 4-preset system. Don't
re-invent new categories — use the canonical 4.

---

## Prelude → Primary Campaign Handoff (Phase 5)

**Priority:** High once prelude playtests stabilize. **Status:** Deferred (Phase 5 of `PRELUDE_IMPLEMENTATION_PLAN.md`, design work only — not yet implemented).

**The handoff is the single most important integration point in the game.** The prelude builds a character with depth, relationships, place-in-world, and mechanical hooks (theme, ancestry feats, Expertise Die at L5 unlock). The primary campaign is where they live the rest of their story. If the handoff is rough, everything the prelude built leaks out.

### MUST honor the Round 3 structural reframe

When this is implemented, **Ch4 is the bridge to adventuring, not the departure scene.** The character arrives at the primary campaign already road-tested, weeks-to-months into independent life, with their theme committed and exercised, with their home threads either wrapped or deliberately carried forward.

The campaign opener does NOT read as "you have just arrived" or "you have just left home." It reads as any other D&D session opener — the character has been here for some time, looking for work / a way forward / something worth doing. See `PRELUDE_IMPLEMENTATION_PLAN.md` Round 3 for the full design.

### Build checklist when this is taken up

- [ ] **Ch3 absorbs the departure scene.** Move `departure_seed` from Ch4 to Ch3 in the arc plan generator. Ch3's `chapter_end_moment` is now irreversible act + theme commitment + departure as one scene cluster (paced explicitly).
- [ ] **Ch4 becomes BECOME (or BRIDGE / ARRIVE — pick a tag).** New mode in `preludeArcPromptBuilder.js` with the 6 candidate beats from the Round 3 reframe. Time-compression techniques promoted to Ch4 prompt foreground.
- [ ] **Add `transient` flag to canon facts.** Migration adds the column; Ch4-emitted canon defaults to `transient=true`. New marker `[CANON_FACT_PROMOTE]` for the AI to surface road NPCs that the player has invested in.
- [ ] **Primary campaign world-gen filters transient canon.** When seeding the campaign from prelude data, exclude `transient: true` canon facts so the campaign isn't polluted with one-shot road NPCs.
- [ ] **Campaign opener writes from "already here for some time" position.** Not "you arrive" — "you have been here for ~weeks, looking for X." The Ch4 `arrival_destination` becomes the campaign's starting region.
- [ ] **Prelude tone preset carries forward** (paired with the existing FUTURE_FEATURES entry on main-campaign tone preset integration). The committed tone from `prelude_setup_data.tone_tags` populates the new `campaigns.tone_preset` column automatically.
- [ ] **Open design choice — theme commitment UX moment.** Currently a discrete "Choose Your Path" card. Under the new structure, theme + departure happen together. Decide: keep the card as a discrete UI moment, or fold it into narrative ("you put your hand on the recruitment ledger" — theme implicit in player action). Either is valid; pick before implementing.

### Why this is paired with Round 3

If Phase 5 is built without honoring the Ch4-as-bridge reframe, the campaign opener will keep reading like a fresh-departure scene — undermining the entire reason for the structural change. These two pieces of work need to ship together (or Phase 5 needs to ship AFTER Ch4 is restructured, never before).

---

## Unify Opus + Lean Prompt toggles across main campaign and prelude

**Priority:** Low (diagnostic tooling, not user-facing). **Status:** Notes only — added during the v1.0.95 prose-quality investigation.

The home-page Sonnet/Opus pill and the Lean Prompt toggle (both added April 2026) currently affect **only the main DM session**. Prelude has independent model selection and no lean equivalent. This is fine for the current diagnostic work but should be unified before either toggle ships as a real user-facing setting.

### Current state (snapshot of the two systems)

| Surface | State variable | localStorage key | API body param |
|---|---|---|---|
| Home pill / SessionSetup / in-session pill | `forceOpus: boolean` | `dndForceOpus` (`'1'` / `'0'`) | `modelOverride: 'opus' \| null` |
| Home pill (Lean) | `leanPrompt: boolean` | `dndLeanPrompt` (`'1'` / `'0'`) | `leanPrompt: boolean` |
| Prelude session UI ([PreludeSession.jsx:66](client/src/components/PreludeSession.jsx#L66)) | `model: 'auto' \| 'sonnet' \| 'opus'` | none — session-local only | `model: 'auto' \| 'sonnet' \| 'opus'` |

The home pill writes `dndForceOpus`; only [DMSession.jsx](client/src/components/DMSession.jsx) and [SessionSetup.jsx](client/src/components/SessionSetup.jsx) read it. PreludeSession has its own internal Auto/Sonnet/Opus button that's untouched by the home pill, and there is no lean transform path through `preludeArcPromptBuilder.js` at all.

### Why it's not unified yet

1. **Prelude prompt has a different structure.** `applyLeanTransforms()` in `dmPromptBuilder.js` strips the `MECHANICAL MARKERS` section by regex and replaces the `2. HARD STOPS` Cardinal Rule. Neither heading exists in the prelude prompt — running the transform there is a silent no-op. A separate `applyPreludeLeanTransforms()` would need to identify the prelude-specific equivalents (the prelude marker block, the strict roll-stop discipline embedded in the prelude prompt's voice section).

2. **Prelude already has its own model toggle.** The prelude UI exposes Auto / Sonnet / Opus as buttons inside the session view. This was built before the home pill and uses a different vocabulary (`'auto'` is meaningful in prelude — it picks Sonnet for continuations and Opus for chapter opens; in the main session there's just Sonnet-default-with-Opus-on-first-session, not exposed as a 3-way choice).

3. **The user's diagnostic test (April 2026) is main-campaign focused.** The original prose baseline ("Order of Dawn's Light" PDF) is main-campaign play. So the toggles only needed to work where the test is happening.

### Build checklist when this is taken up

- [ ] **Decide on unified vocabulary.** Either lift main-session `forceOpus` boolean to a 3-way `'auto' | 'sonnet' | 'opus'` (matches prelude), or push prelude toward a binary `forceOpus` (matches main session). The 3-way is more expressive and `'auto'` is semantically useful — recommend that direction.
- [ ] **Have PreludeSession read `dndForceOpus`** as its initial model state, falling through to its own Auto button as the override surface (or hide its button entirely once the home pill is canonical).
- [ ] **Add `leanPrompt` body param to `/api/prelude/sessions/:sessionId/message`.** Wire through to `sendPreludeMessage` and the prelude prompt assembly.
- [ ] **Author `applyPreludeLeanTransforms()`** in `preludeArcPromptBuilder.js` (or a sibling util). Identify which prelude prompt blocks are the prose-killers there — likely the per-life-stage NPC voice rules, the time-compression directives, or the canon-fact ledger injection. Empirical, not symmetric with the main-session lean.
- [ ] **Update `PreludeSession.jsx`** to read `dndLeanPrompt` from localStorage at send time and pass `leanPrompt` in the body, mirroring the pattern in DMSession.
- [ ] **Verify in `applyLeanTransforms()` dryrun** that prelude prompts don't accidentally match the main-session regex once both prompts coexist in the codebase. (They don't today, but a future refactor that aligns the two prompt builders' headings would silently start firing the wrong transform.)

### Decision deferred

- Should the lean toggle even exist as a user-facing thing once we know what it does? If lean prose is universally better, fold the relaxed Cardinal Rule 2 into production and don't make it a toggle. The toggle is a diagnostic, not a feature. Same question for forceOpus: if Opus is necessary for prose quality, the answer might be "always Opus" — making the toggle redundant. This whole entry is contingent on the diagnostic finding that *neither* lever fully closes the gap. If we ship lean+opus as the default for production, prelude needs to follow.

---

## Session Hi-Fi implementation (in-session three-column cockpit)

**Priority:** Medium. **Status:** Design landed and scope analyzed (2026-04-26); awaiting user decisions on five questions before build. Design source preserved in `Claude UX Design/D&D Meta Game (Remix)/Session-Design-Bundle/` (HTML + chat transcript + handoff README).

A fundamental restructure of the in-session play surface from a single-column message list into a **three-column cockpit**: passive party/effects/quests/scene context on the left (248px), narrative theatre in the center (flex), active tools (HP, init, slots, quick cast, rules) on the right (296px). Visual language: dark navy-slate with terracotta/forest/purple/gold accents, Fraunces display for DM voice, Inter body, JetBrains Mono labels.

### Why deferred

Scope is large enough that explicit user decisions are needed on the five open questions below before charging in. The README in the design bundle explicitly asks the implementer to confirm scope first.

### Mapping table — design ↔ current production

| Design element | Current backing in DMSession | Status |
|---|---|---|
| Left party panel | Companions data (in slide-in CompanionsPanel) | ✅ data exists, currently a slide-in |
| Effects (round counters) | Condition tracking with TTL | ⚠ data exists; round counters not currently surfaced |
| Active Quests | Active quests w/ [MAIN]/[FACTION]/[SIDE] labels | ✅ |
| Scene meta (weather/light/tension/terrain) | Weather only | ⚠ light/tension/terrain are net-new |
| Stage strip combat pulse | CombatTracker round | ✅ |
| Scene breaks in transcript | (none) | ⚠ net-new — would need a marker or server beat |
| DM serif blocks vs. player bubbles | All messages currently styled identically | ⚠ need to discriminate who-said-what visually |
| Roll receipts | Dice results currently inline | ⚠ format change |
| Say/Do/OOC composer modes | Single text input | ⚠ net-new — chat says these would shape AI interpretation |
| HP block w/ temp HP overlay + heal/damage | HP shown in info-bar; no in-UI heal/damage | ⚠ partial |
| Initiative panel + Action/Bonus/Reaction tracker | CombatTracker has init; no A/B/R surface | ⚠ partial |
| Slot pips | Spell slots tracker | ✅ data + concept; visual is different |
| Quick Cast | Prepared spells display in QuickReferencePanel | ✅ data; currently in a panel |
| Rules in play | (none) | ⚠ net-new |
| Cmd-K command palette | (none) | ⚠ net-new — designed in chat but not in HTML |
| Right-rail collapse states (combat/roleplay/hidden) | (none) | ⚠ net-new — designed in chat but not in HTML |

### Open questions (must answer before building)

1. **Phased (Path A) or one-shot (Path B)?**
   - **Path A** (recommended) — three commits: (1) layout + tokens + restyle existing data; (2) composer modes + scene-break renderer; (3) net-new features (Cmd-K, collapse, scene meta, rules-in-play) each as their own scope.
   - **Path B** — one big effort that ships everything including the chat-only items.
2. **Existing slide-in panels** — what happens to Inventory, Companions, Conditions, Campaign Notes, Quick Reference, Merchants, Commissions, Coaching panels? Hide, fold into rails where it fits, or coexist?
3. **Visual language propagation** — should the SessionSetup and SessionRewards screens be restyled to match, or just the in-session view for now?
4. **Pixel-perfect or pragmatic?** HTML is `max-width: 1440px`, desktop-only. Current app is responsive. User noted "I'll only ever use this on desktop" — probably accept desktop-only, but confirm.
5. **Scene meta data** — weather we have. Light/tension/terrain don't exist as fields. Mock as static placeholders for v1, infer from session state, or design proper backing (`[SCENE_TENSION: high]` markers, etc.) before they land?

### Recommended starting point — Path A, commit 1

If Path A picked, the first commit (estimated 4-6 hours):

1. New CSS tokens file: `client/src/styles/session-cockpit.css` (or inline in DMSession initially).
2. Restructure `DMSession.jsx` JSX to a three-column grid (preserve all existing behavior).
3. Build the rail components inline first, extract later if they grow:
   - `<PartyRail>` — sources from existing companions state
   - `<EffectsRail>` — sources from existing conditions state
   - `<QuestsRail>` — sources from existing quests query
   - `<SceneRail>` — weather only for now, placeholder light/tension/terrain
   - `<HpBlock>` — sources from existing character HP
   - `<InitPanel>` — pulls from existing CombatTracker state, restyled
   - `<SlotsPanel>` — existing spell-slot data, repipped
   - `<QuickCastPanel>` — existing prepared spells, restyled
   - `<RulesPanel>` — placeholder for v1, no backing yet
4. Restyle the message list:
   - DM messages → serif Fraunces 17.5px in a left-aligned `<div class="dm-block">`
   - Player messages → Inter 14.5px in a right-aligned purple-bordered bubble
   - System events (combat starts, conditions, etc.) → centered mono pill
   - Roll results → `<div class="roll-receipt">` grid
5. Composer wrap with the visual mode-toggle (Say/Do/OOC) — **rendered but not yet behavior-wired** in commit 1. Existing input/send still works.
6. Hide the old slide-in panel buttons (or keep them under a "legacy panels" expander).
7. Don't touch Cmd-K, scene meta backend, rules-in-play, or right-rail collapse — those are commits 2+.

### Related but separately scoped

The same chat also discussed **Origin & Identity** tab (replaces standard "Background" — uses Themes system per `Themes-Replace-Backgrounds.md`) and **Progression** tab (the three-rail Class/Theme/Ancestry braid). These are natural follow-ons after Session Hi-Fi commit 1 lands the design system.
