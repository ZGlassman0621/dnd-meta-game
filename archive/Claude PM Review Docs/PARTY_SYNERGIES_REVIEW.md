# Party Synergies System — Review Findings

Working doc between user and PM Claude after a full read of `PARTY_SYNERGIES.md`. Captures issues to address; assumes things not flagged here are working as intended.

**Scope:** Issues only. Format: to-do. Each finding has a severity tag and a one-line recommended next step. Findings are deferred per user pending Themes review (which will likely create ripple effects here).

**Severity tags:**
- 🔴 **Bug/error** — clear mistake, no design judgment required to fix
- 🟡 **Open question** — design judgment needed; user decides
- 🟢 **Heads-up** — works as designed but has implications worth knowing

**Status:** Findings captured, deferred for later action. **Themes review may create ripple effects** — the synergy-Theme integration is tightly coupled, and any Themes design changes likely require revisiting this doc.

---

## Important framing context

Party Synergies is the most polished Pathfinder import in the project. Inspired by PF1E Teamwork Feats but reshaped to fit 5e — bounded numbers, simple triggers, no resource pools or extra action economy. The "trigger, not activate" decision avoids Pathfinder's notorious "did you take the right feat?" friction.

**The three-tier framework is genuinely clever:**
- Tier 1 (Gear & Positioning) — universally available, no Theme/training required
- Tier 2 (Theme Synergies) — automatic when compatible Themes are in party
- Tier 3 (Team Tactics) — explicitly trained, partner-locked

This means **any party can have synergies** (Tier 1 floor), and parties with compatible compositions get more (Tiers 2-3). No party is shut out from the system.

**This is a "meta-system."** Its job is to add depth on top of Themes, Companions, and Downtime — not introduce new content. Powerful pattern; also fragile, because every system below it can break it.

---

## What the design has right (preserved as guardrails)

- Three-tier framework (Gear / Theme / Tactics) with clear separation of concerns
- "Trigger, not activate" — no action economy or resource cost to fire synergies
- Tier 1 universals ensure every party has access to coordination
- Compatibility tags on every Theme enable Generative Synergies (AI fills the gaps)
- Generative system has explicit guardrails (mechanically modest, narratively flavored, called out in narration)
- "AI companions choose whether to engage" makes companion personality mechanically consequential
- Tier 3 capacity scales with proficiency bonus — no separate progression decisions
- Field-observation learning path for Team Tactics (learn-by-witnessing)
- Strong narrative flavor text on most Signature Synergies

These are load-bearing patterns. Don't break them when fixing other things.

---

## Category 1: Implementation reality

- 🟡 **"Status: In review" is ambiguous in the project's vocabulary.** Designed but not implemented? Implemented but not validated? Designed and partially implemented? Same shape of ambiguity as ANCESTRY_FEATS.md's status header. *Worth clarifying when this becomes active work — what's actually built in code?*

- 🟡 **AI DM integration is unbuilt (Next Phase #3).** Per the doc: "add synergy detection logic to the prompt builder so the AI knows when to trigger and narrate them." **A synergy system the AI doesn't know how to detect or narrate is invisible in play.** The doc has 35 Signature Synergies + 20 Team Tactics + 10 Gear synergies + a Generative system, but if the AI prompt doesn't surface these at the right moments, none of it lands. *This is the highest-leverage piece of work for this system.*

- 🟡 **Companion engagement layer is unbuilt (Next Phase #5).** "Tag companions with 'Synergy engagement likelihood' so the AI can roleplay choosing (or not choosing) to engage." This is the integration with Companions that makes the system mechanically meaningful. *A companion that automatically engages every synergy is identical to a companion with no personality. The "choose to engage" piece is what makes this system part of the BioWare benchmark, not just a rules layer.*

- 🟡 **"Train Team Tactic" downtime activity is unbuilt and depends on Downtime activation.** Per the doc: "The existing Downtime v2 system needs to be extended with a 'Train Team Tactic' activity." Per the Downtime review, Downtime has fallen into disrepair and pairs with starting an actual long-running character. **Tier 3 (Team Tactics) cannot exist until Downtime is functional.** Explicit dependency.

- 🟡 **Active synergy UI display is unbuilt (Next Phase #4).** Players need to know what synergies are available to them. The AI's per-turn eligibility check is currently a private decision; making it player-visible is a meaningful UX layer. *Important for player agency — without UI, players don't know to set up the conditions.*

---

## Category 2: Balance specifics

- 🟡 **Killing Floor (Mercenary Veteran × Mercenary Veteran) is a strong outlier.** Both below half HP → +2 attack and damage *for the rest of the encounter*. No save, no duration limit beyond "encounter," no per-rest cap. Two Mercenary Veterans who get bloodied early are doing +2/+2 for the rest of every fight. Compare to Bardic Inspiration (limited uses) or Battle Master maneuvers (limited Superiority Dice). *Probably needs scaling — duration-limited, escalating bonus, or per-rest cap.*

- 🟡 **Several Theme Synergies grant "advantage" with no resource cost.** Sworn Brothers, Faith in Steel, Hunter and Hunted, Master and Tradition, others. 5e treats advantage as a meaningful resource (Help action costs an action; Hide is gated). **Synergies that grant advantage automatically when triggered may compound with other advantage sources in ways the doc hasn't pressure-tested.** The doc itself flags this in Next Phases #2 (Battle Master + Shield Wall as example) but the issue is broader. *Soldier-Knight pair with Formation Advance + Faith in Steel + Sworn Brothers can stack a lot of bonuses in a single round.*

- 🟢 **The "below half HP" trigger pattern (used by 4 synergies) creates a meta-dynamic worth knowing.** Killing Floor, Last Stand, Back Together, Survivors' Creed all use it. **Rewards parties that take damage but stay engaged** — thematically rich, but means heal-tank parties that never drop below half can't access these synergies. *Probably intentional. Worth knowing as a design choice.*

- 🟢 **Generative Synergies guidance is appropriately bounded.** "Mechanically modest (advantage, +1 bonus, small temporary buffs)." *This is the right ceiling for AI-improvised effects. The risk of escalation is explicitly addressed.*

---

## Category 3: AI memory dependencies (move to AI_NARRATIVE_PERSISTENCE.md)

This system's memory dependencies are unusual — heavier on real-time pattern matching than long-term state.

- 🟡 **Per-turn synergy detection.** AI must check every combat turn against all eligible synergies for the party — Tier 1 (gear/positioning), Tier 2 (Theme pairs), Tier 3 (learned Team Tactics), plus Generative (shared tags). For a party of 4 with 6 Themes between them, that's a lot of patterns to check per round. *Pattern: "ambient pattern matching against multiple eligibility lists at high per-turn frequency" — same family as Companions thread-activation but more frequent.*

- 🟡 **Companion synergy engagement likelihood.** AI must consult companion personality data when *deciding* whether to take qualifying actions, not just when narrating. *Different flavor of AI behavior than most other systems — the AI is making strategic decisions on behalf of a character with personality, not narrating outcomes.*

- 🟡 **Field-observed Team Tactic mastery tracking.** "Some Team Tactics can be learned by repeatedly witnessing them in combat... The AI DM tracks these over the course of a campaign and notifies the player when a tactic has been implicitly mastered." *New pattern: "implicit mastery tracking through observed repetition." Requires AI to know which tactics are eligible for implicit learning, count repetitions, surface acquisition at the right narrative moment.*

- 🟡 **Synergy partner pairing memory.** "Team Tactics are tied to specific partners... the partner you've trained with for many sessions is mechanically irreplaceable." Requires per-pair state — character A knows tactic X with character B but not with character C. *Pattern: "relationship-state with mechanical consequences" — extends Companions' loyalty model into shared-skill territory.*

- 🟡 **Active synergy eligibility exposed to UI.** Per Next Phase #4. The AI's per-turn eligibility analysis is currently internal; making it player-visible is a UX layer. *Probably solvable but a real interface to design.*

---

## Category 4: Integration risks

- 🟡 **This is the second-most coupled system in the project (after Mythic).** Depends on:
  - Themes (the 21-Theme list and their tags)
  - Companions (personality engagement, synergy partnerships)
  - Downtime (Train Team Tactic activity)
  - AI DM prompt builder (synergy detection, narration)
  - UI (active synergy display)

  *Several of those have unresolved review findings that may ripple here. Themes review especially — if Themes review concludes the 21-Theme list needs revision, every Theme Synergy needs revisiting. If Themes shifts from 4-tier ability shells to a different progression model, the synergy-Theme integration may need rework.*

- 🟢 **The Companions integration is well-anticipated.** Next Phase #5 explicitly addresses it. *The implementation order will matter — synergies without companion engagement are mechanical-only; synergies with companion engagement are part of the BioWare benchmark.*

---

## Category 5: Design specifics worth flagging

- 🟢 **Tier 3 capacity scaling (PB-based) is elegant.** Proficiency bonus = max Team Tactics known. Scales naturally without per-level decisions. *Smart constraint that solves the "infinite tactics list" problem without explicit gating.*

- 🟢 **Trainer/guidebook acquisition is good narrative texture.** NPC trainers, rare martial manuals. *Creates quest hooks (find the lost manual of the Order's Sword-Brothers) and gives Theme-specific NPCs mechanical relevance beyond flavor.*

- 🟢 **Field observation learning is the most narratively interesting acquisition path.** Tactics learned through repeated witnessing. *The kind of feature that makes campaigns feel alive — your party slowly develops mastery just from playing together. Implementation is non-trivial but the design is right.*

- 🟡 **35 Signature Synergies is a lot to author with consistent voice.** Quality is generally high but variable — Sworn Brothers, Killing Floor, Survivors' Creed are strong. Some others are functional but less evocative. *Worth a polish pass on the flavor text when this becomes active work. Mechanical text is fine; narrative text is what makes the system feel alive vs. mechanical.*

- 🟡 **Some Theme pairs that seem natural don't appear in the Signature list.** No Hermit + Sage synergy (both knowledge-focused), no Folk Hero + Acolyte (both community-focused), no Sailor + Outlander beyond Land and Sea. *Either deliberate gaps for the Generative system to fill, or oversight worth filling. Worth checking against the tag table when this work activates.*

---

## Category 6: Cross-system observations

- 🟢 **The "trigger, not activate" framing is a project-wide pattern worth naming.** Several systems use ambient pattern matching to fire effects: Companions thread activation, Prelude emergences, Party Synergies. *Worth naming this as a pattern in AI_NARRATIVE_PERSISTENCE.md or a cross-cutting design doc — the project keeps returning to it, and it's likely to recur.*

- 🟢 **The system's flavor text is a model for what the project's narrative-first principles can produce.** "Sworn Brothers — The old oath-forms come back without thought." "Killing Floor — They've seen each other bleed before. It focuses them rather than frightening them." "Survivors' Creed — One has faced worse. The other has survived worse. Neither thinks this is the end." *These are the kind of small character moments the project's narrative-first principles aspire to — the opposite of the AI shelter-behavior issue. Earned, weighted, assume real stakes.*

- 🟢 **Inter-companion synergies are exactly the BioWare-benchmark territory.** Companion A and companion B working together while the player watches — this is "Alistair and Morrigan bouncing off each other" expressed mechanically. *One of the cleanest integration points between two reviewed systems (Companions × Party Synergies).*

---

## Suggested next moves (when this comes off the deferred shelf)

When Party Synergies activates (likely after Themes review at minimum, possibly after Companions focus area):

1. **Verify implementation reality.** What's actually built in code? Match against the doc.

2. **Re-audit after Themes review.** If Themes design changes, re-validate the synergy list. Theme tags, Theme pair compatibility, and Theme Synergy mechanics all depend on Themes being settled.

3. **Build AI DM detection and narration layer.** Highest-leverage single piece of work. Without this, the system is invisible.

4. **Build companion engagement layer.** Tag companions with engagement likelihood; integrate with personality data. Connects to Companions focus area.

5. **Balance pass on advantage-stackers and Killing Floor.** Specific fixes plus a broader pressure-test of multi-synergy combat rounds.

6. **Coordinate with Downtime activation for Tier 3 (Team Tactics).** Tier 3 is gated behind Downtime functionality.

7. **UI pass: active synergy display + acquired Team Tactics view.** Player-visible eligibility.

8. **Polish pass on Signature Synergy flavor text.** Some entries are excellent, some are functional. Lift the functional ones.

---

## What this review confirmed about the project

- The most polished Pathfinder import in the project. The 5e translation is mostly right — bounded math, simple triggers, no resource pools.
- The system is a "meta-system" — depends on Themes, Companions, Downtime, AI DM, UI all being right. Powerful but fragile.
- The flavor writing models what the project's narrative-first principles can produce.
- AI integration is the load-bearing missing piece. Until the AI knows how to detect and narrate synergies, the system is invisible.
- Companion engagement is the integration that makes the system meaningful for the BioWare benchmark.
- Themes review is likely to ripple into this system. Re-validate after Themes.
