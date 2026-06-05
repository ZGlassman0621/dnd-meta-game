# Mythic Progression System — Review Findings

Working doc between user and PM Claude after a full read of `MYTHIC_PROGRESSION_GUIDE.md` (~912 lines). Captures issues to address; deferred per user framing of "we have time on this one, by design."

**Scope:** Issues only. Format: to-do. Each finding has a severity tag and a one-line recommended next step.

**Severity tags:**
- 🔴 **Bug/error** — clear mistake, no design judgment required to fix
- 🟡 **Open question** — design judgment needed; user decides
- 🟢 **Heads-up** — works as designed but has implications worth knowing

**Status:** Framework-only system. Not built. Not urgent — by user's explicit framing, this is the only reviewed system where deferral is *by design* rather than by circumstance. Even if early-seeding mechanics are added (see Category 6), no full mythic content is wanted before character L14. Time for proper balancing exists.

---

## Important framing context

**Two reasons this system exists** (per user):

1. **Inspired by Pathfinder: Wrath of the Righteous.** WotR allowed a character to take Mythic paths and become more than human — Angel, Aeon, Demon, Lich, etc. The user found this added depth to a game where otherwise "you'd just be an exceptional person of any race." That ascension-to-something-more is the design DNA.

2. **Practical: L20 isn't enough for years-of-play.** By the user's account, around level 12 the strain of "only 8 more levels of progression" began to show. Mythic is a post-L20 progression layer specifically designed to extend character growth beyond 5e's natural cap.

**Companion mythic interactions** are part of the user's stated motivation. New synergies between mythic-tier party members ("an Angel-companion and Aeon-companion having different reactions to a Demon-companion") would create gameplay depth. But — see Category 4 — companion mythic is named as an open question, not designed.

**The deferral is deliberate, not accidental.** Per user: "We have time on this one, even if we decide to seed Mythic paths earlier in the game." The system can wait by design, while everything else we've reviewed is deferred by circumstance. Worth preserving so future-PM doesn't accidentally treat Mythic as urgent because of unresolved balance concerns.

---

## What the design has right (preserved as guardrails)

- Reference work across multiple sources (PF1E Mythic Adventures, WotR, Theros, 2024 PHB Epic Boons, Critical Role Vestiges, Exalted) — most reference-rich design doc in the project.
- Bounded accuracy analysis (Category 11 in the doc): "Damage/healing over accuracy. Qualitative over quantitative. Proficiency stays at +6. Save DCs cap at 22-23." Sophisticated understanding of what makes 5e *5e*.
- "Rules serve story" framing throughout — every mechanical decision backed by narrative justification.
- Trial-based advancement: trials are narrative, DM-determined, players may not know they're in one. Failed trials redirect rather than block.
- Dark paths as DM-only — smart asymmetry that prevents players from fighting mirrors of themselves.
- 5-tier compression of Pathfinder's 10 — appropriate for 5e's design philosophy.
- Multi-Campaign Timeline as possibility, not mandate — explicitly framed as optional.

These are load-bearing patterns. Don't break them when fixing other things.

---

## Category 1: Implementation reality

- 🟡 **Only the Hierophant path has full mechanical detail.** Several paths have substantial detail (Angel, Lich, Demon, Trickster, Devil, Redemption); others (Aeon, Azata, Gold Dragon, Legend) appear sketched rather than fully developed. The doc is honest about this — line 174-175 says "All other paths need equivalent development." But the published count (14 paths) is overstated relative to implementation readiness. *Worth knowing — first task when Mythic activates is finishing path content. Substantial design lift.*

- 🟡 **The doc is hybrid system-spec / campaign-application.** Status header says "Order of Dawn's Light Campaign | Reference Document." Throughout, references to specific campaign characters appear (Riv, Jakob, Garrick, The Master, Silas, Thane). Piety section is built around Lathander for Riv specifically. Multi-Campaign Timeline is OoDL-specific. *If Mythic is going to be a system available across all campaigns (as the project's general framing suggests), this doc eventually needs to split: a system-spec doc and a campaign-application doc. Not a now-task.*

- 🟢 **Doc was last updated 2026-02-20.** Two months old at time of review. Multiple major project changes have shipped since. Some integration assumptions may have drifted. *Worth a check when Mythic activates.*

---

## Category 2: Power scaling and Tier 5 design

- 🔴 **Lich's "Final Equation" (Tier 5) is broken.** Line 390: "1/year, you can either permanently resurrect someone (true reversal of death, not a copy) or permanently kill something (no resurrection possible by any means)." Permanent unrevokable resurrection bypasses the entire stakes framework. Permanent kill exits a creature from the universe with no recovery path. The 1/year limiter doesn't address the consequence space. The flavor (a Lich understands death as an equation) is good. The mechanic is too unbounded. *Needs redesign before any Lich gameplay is possible.*

- 🔴 **Trickster's "Narrative Authority" (Tier 5) is also too unbounded.** Line 495: "1/day, declare that something is true, and it becomes true. Limitations: must be theoretically possible, can be resisted by Tier 5 beings, universe will impose ironic consequences for excessive use." "Ironic consequences" is GM-art, not mechanics. In a project where the AI is the GM and the AI shelter-behavior issue exists (per Prelude review), this becomes "the player can bend reality once per day with no real check." *Same shape of problem as Final Equation: needs structural bounds.*

- 🟡 **Tier 5 abilities are systemically over-scoped.** Across paths reviewed: Hierophant (quasi-deity, immortality, rewrite history once per year), Lich (Final Equation, above), Demon (all physical stats become 30 while raging, dominion over Abyss layer), Trickster (Narrative Authority, immune to fate, cannot be killed), Devil (rule a portion of the Nine Hells, bind deities to contracts), Angel (parallel patterns based on the trajectory). **Every Tier 5 character is a quasi-deity with a "cannot be permanently killed" capstone.** If multiple party members reach Tier 5 (Multi-Campaign Timeline anticipates this by Campaign IV), the world has a small pantheon of effectively-deities adventuring together. *The Tier 5 design philosophy needs work. Current approach is "make everyone a small god" — exciting in concept but hard to play sustainably. Connects to Open Question #9 in the doc, which acknowledges this.*

- 🟡 **Legend path breaks 5e math at high tiers.** Lines 511-515: Tier 1 grants Level 24 (stat max 24); Tier 5 grants Level 40 with no stat max. A Level 40 character with no ability score cap is mechanically incoherent in 5e. Bounded accuracy completely breaks at +25 modifiers. *Either Legend should keep stat caps (24 max even at Tier 5) and add new abilities/feats instead, or the system needs a separate math framework for Legend characters. Premise (mortal pushed to ultimate limits) is good; implementation breaks 5e.*

---

## Category 3: AI memory dependencies (move to AI_NARRATIVE_PERSISTENCE.md)

Substantial category for Mythic.

- 🟡 **Trial tracking.** Trials are narrative, DM-determined, "players may not know they're in a trial until it's complete." *New pattern: "AI-tracked narrative arcs the player isn't told about." Same shape as the AI shelter-behavior issue from Prelude — the AI must impose stakes the player can't see coming. Risky if not handled deliberately.*

- 🟡 **Piety tracking per deity per character.** 53 deities (per the brief), tracked across multiple characters and companions. Each deity has its own value increases/decreases. Activities accumulate piety; certain abilities require thresholds. *Pattern A territory at scale. Same shape as Drow Lolth standing × 53 × party size.*

- 🟡 **Path commitment as permanent narrative state.** Like Aasimar Fallen Path's Choice but bigger. Once chosen, the world responds: gods take notice, planar entities respond, factions react. *Requires sustained AI response to path identity over potentially years of play.*

- 🟡 **Mythic monsters as combat narrative state.** Mythic Trait — second health bar that triggers at 0 HP, restores HP, unlocks Mythic Actions. Player must register "they're not dead, the fight enters phase 2." *Requires combat state machinery + AI narration of phase transitions.*

- 🟡 **Legendary items with three states (Dormant / Awakened / Exalted).** Items grow in power through narrative milestones. Doc says items begin Dormant, reach Awakened, reach Exalted across campaigns. *Requires per-item narrative milestone tracking that persists across campaign boundaries.*

- 🟡 **Cross-campaign character continuity.** Multi-Campaign Timeline assumes a single character (or party) progresses across multiple campaigns. *Requires: campaign-level state separate from session state, character migration between campaigns, world-state continuation. This is north-star "lineages of characters" territory expressed differently — may end up sharing infrastructure.*

- 🟡 **Hidden mythic NPC progression (e.g., The Master).** Per line 4: "The DM tracks The Master's mythic evolution behind the scenes." AI runs a mythic NPC the player isn't fully aware of, advancing through trials and tiers. *Pattern: "AI runs hidden parallel character progression for opposition." Likely applies to other major NPCs too.*

- 🟡 **Shadow Points as gating for path access.** Light paths require Shadow 0-2; Dark paths gained through Shadow accumulation. *Cross-system dependency on existing Shadow Points infrastructure. May or may not be functional today — should be verified when Mythic activates.*

- 🟢 **Glory Points cross-pollinate with Mythic Power.** Tier 3+: spend 3 Glory to activate mythic ability without Mythic Power. *Existing system intersection.*

---

## Category 4: Companion mythic — the underdesigned piece

- 🟡 **Companion mythic progression is mentioned but not designed.** Open Question #5 in the doc: "Do important NPCs get mythic tiers, or does this remain player-only? If NPCs get it, who manages their advancement?" This is one of the user's stated *reasons* for the system — "Mythic classes can apply to companions and form new synergies, creates a whole new means of gameplay" — but the document doesn't yet design companion mythic. The user's stated motivation isn't yet supported by the design. *This is the place where Mythic most clearly intersects with the Companions review. If companion mythic adds dimension to inter-companion relationships (which the Companions review flagged as required for the BioWare benchmark), it's a substantial enhancement. But it needs its own scoping pass parallel to player-mythic content development.*

---

## Category 5: Load-bearing open questions

The doc has 10 numbered Open Questions. Three are actually-load-bearing rather than nice-to-resolve:

- 🟡 **Open Question #3: Path switching.** WotR allows late-game path switches. *If path-switching is free, paths are just labels. If costly, the cost needs design. Either way, this shapes player behavior and isn't a polish question.*

- 🟡 **Open Question #4: Multipath.** "Can a character have abilities from two paths?" *Mythic abilities are powerful enough that combining two paths could break encounter design. But the design intent ("a character who walks the line") is rich. Needs a real answer.*

- 🟡 **Open Question #9: Stakes at Tier 4-5.** Already flagged in Category 2. *Central design problem of high-tier mythic — what's a real threat, and how do you maintain stakes when self-resurrection is on the table?*

The other open questions (Guardian path, Archmage path, NPC mythic, Artificer path, Piety/Mythic interaction, Order at Tier 3+, Player buy-in timing) are real but more sketchable.

---

## Category 6: Early-seeding design opening (per user)

- 🟡 **Early Mythic seeding via narrative artifacts/encounters.** Per user: "Even if we decide to seed Mythic paths earlier in the game (discovering an angelic sword and using it over time leads to earlier angelic abilities on a lesser scale, or coming into contact with an ancient being corrupts the player over time leading to earlier demonic abilities on a lesser scale, etc)." Not before Level 14, but the seeding mechanism would let mythic paths *earn their way into* the game gradually rather than landing all at once at L20.

  This is a meaningful design opening that:
  - Lets mythic content surface earlier without breaking bounded accuracy (lesser-scale abilities)
  - Creates narrative reasons for path choice (the angelic sword you've been wielding for 5 levels obviously points toward Angel path)
  - Solves Open Question #10 (player buy-in timing) — buy-in happens organically through play
  - Uses the artifact/legendary-item framework (Vestiges-of-Divergence pattern) the doc already references

  *Worth scoping when Mythic activates. Probably should be designed alongside the legendary-item progression since the two are mechanically and narratively coupled.*

---

## Category 7: Cross-system observations

- 🟢 **Mythic is the system most aligned with project ambitions but the least playtested.** Multi-Campaign Timeline echoes the lineages-of-characters north star directly. Piety system is the most direct expression of AI memory as gameplay. Legendary items map onto the brief's "campaign module support" goal. Yet none of it has been played. The system whose design ambitions are most aligned with the project's vision is the one whose actual implementation is most distant.

- 🟢 **Dark-paths-as-DM-only is a pattern worth replicating.** Several other systems might benefit from the same asymmetry — features the AI uses to run opposition that aren't available to players. Most current systems have full PC/NPC parity. *Worth thinking about whether AI-only mechanics are a useful design space the project hasn't explored.*

- 🟢 **The doc's design notes are unusually reflective.** Every mechanical decision is backed by narrative justification, references prior art, acknowledges trade-offs. This is a model the other system docs could learn from.

---

## Suggested next moves (when this comes off the deferred shelf)

When Mythic eventually activates — likely many months or years out per user framing — suggested order:

1. **Resolve the three load-bearing open questions** (path switching cost, multipath rules, Tier 4-5 stakes design). These shape everything else.

2. **Redesign the broken Tier 5 abilities** (Lich Final Equation, Trickster Narrative Authority). Bound the power, preserve the flavor.

3. **Fix the Legend path math.** Cap stat increases at 24, add abilities/feats instead. Or design a separate math framework.

4. **Finish the path content.** Hierophant is full; ~6 paths are partial; ~4 paths are sketched. Substantial design work.

5. **Design companion mythic.** Currently Open Question #5; user has named it as a stated motivation; needs actual design.

6. **Scope early-seeding mechanics.** Per Category 6 — design lesser-scale mythic abilities triggered by artifacts/encounters from L10-14. Probably designed alongside legendary-item progression.

7. **Split the doc into system-spec and campaign-application.** When the system is general-purpose, the OoDL-specific content needs to live somewhere else.

8. **First real playtest at Tier 1.** Hierophant is the obvious first candidate since it's the most complete.

---

## What this review confirmed about the project

- Mythic is framework-only, explicitly future-feature, and *deliberately deferred*. First reviewed system where deferral is by design rather than by circumstance.
- The reference work and bounded-accuracy analysis are unusually sophisticated.
- Tier 5 design is systemically over-scoped; needs work before implementation.
- The Legend path breaks 5e math and needs structural revision.
- Companion mythic is named as a motivation but not designed — gap between stated intent and current spec.
- Early-seeding mechanics are an open design direction worth scoping.
- This system will require extensive balancing to get right; user has explicitly said this going in.
- Time exists to do this properly. No urgency. The system can wait.
