# Themes System — Review Findings

Working doc between user and PM Claude after a full read of three Themes documents:
- `THEME_DESIGNS.md` (1003 lines) — the 21-Theme foundation
- `SUBCLASS_THEME_SYNERGIES.md` (273 lines) — ~40 resonant subclass × theme pairings
- `MYTHIC_THEME_AMPLIFICATIONS.md` (200 lines) — ~20 mythic path × theme interactions

Captures issues to address; assumes things not flagged here are working as intended.

**Scope:** Issues only. Format: to-do. Each finding has a severity tag and a one-line recommended next step.

**Severity tags:**
- 🔴 **Bug/error** — clear mistake, no design judgment required to fix
- 🟡 **Open question** — design judgment needed; user decides
- 🟢 **Heads-up** — works as designed but has implications worth knowing

**Status:** Findings captured, deferred for later action.

---

## Important framing context

**Themes is the keystone system.** Ancestry Feats references it. Companions uses Theme tags for synergy engagement. Party Synergies is built on the 21-Theme tag list. Mythic amplifies it. The brief calls out Themes content writing as "the largest single design lift remaining in the project."

**The design is closer to shippable than any other major system reviewed except possibly Companions** (which has more integration than design). 21 Themes are designed and balance-passed. ~40 Subclass × Theme synergies are documented. ~20 Mythic × Theme amplifications/arcs are documented. The core design is solid; what remains is implementation and AI integration.

The single biggest risk is that **the system depends on the AI proactively surfacing Theme effects** — same shape as the Prelude AI-behavior issue. If the AI falls back to generic narration, most of the L5/L11/L17 content becomes invisible.

---

## What the design has right (preserved as guardrails)

These are load-bearing patterns. Don't break them when fixing other things.

- **L1/L5/L11/L17 progression structure.** Backgrounds turn into evolving identity that pays off at three additional milestones.
- **Expertise Die mechanic at L11/L17 (d4 → d6).** Borrowed from One D&D Bard, applied selectively. Meaningful but small enough not to break bounded accuracy.
- **"L5 answers what nobody else can do, L11 answers what I'm best at, L17 answers what makes me legendary."** Consistent across all 21 Themes.
- **Divergence notes.** "How this differs from a similar Theme" prevents the system's main failure mode (multiple Themes all doing "I'm a fighter type"). Soldier vs Mercenary vs Knight vs Folk Hero are meaningfully distinct.
- **The balance pass at the end of THEME_DESIGNS.** Real iteration: Sailor Storm's Chosen split, Knight Aura reduced, Hermit Transcendence narrowed, Urchin L5 trimmed.
- **Resonant + dissonant + generative tier structure** in Mythic × Theme amplifications. Resonant = mechanical bonuses. Dissonant = unlocked narrative arcs. Generative = AI improvises moments based on shared tags.
- **Specific exceptional designs:** Folk Hero geographic fame system (L11 "Legend in the Making"); Urchin street children network with explicit ethical cost; Acolyte L17 four-option intervention menu; Sage L17 "Living Library" reaction-to-grant-Expertise-Die; the Mythic × Theme dissonance arcs (Demon+Folk Hero "Righteous Chaos" synthesis).

---

## Category 1: AI integration is the load-bearing missing piece

This is the same concern that surfaced in Prelude, Companions, and Party Synergies — applied here to a system whose surface area is enormous.

- 🟡 **The system works only if the AI proactively surfaces Theme effects on every relevant turn.** Many Theme abilities are *not* player-activated; they require the AI to track Theme + tier on every party member and weave the Theme effects into narration.

  Examples that depend on AI initiative:
  - **Far Traveler L11**: AI must "proactively notify Far Traveler L11+ characters of anything out of place when entering new locations" *(the doc itself flags this as an integration note)*.
  - **Folk Hero L11**: AI must roll d20 recognition checks when entering settlements, expand "home region" outward as deeds accumulate, surface fame appropriately.
  - **Urchin L11**: AI must track street children network state across cities, surface costs and obligations.
  - **Sage L5 lore recall**: AI must answer questions accurately based on world canon, not improvise.
  - **Acolyte L5**: AI must determine emotional state and disposition of NPCs after extended conversation, reveal hidden tensions.

  *This is the same shape as the Prelude AI-behavior issue. If the AI falls back to generic narration, most of the L5/L11/L17 content is invisible. Player won't know they're missing anything.*

- 🟡 **Several Theme abilities lack clear AI-trigger specs.** "Once per long rest" abilities have player-driven triggers; that's fine. But abilities like Far Traveler L11 ("you automatically notice one thing that doesn't belong") — what's the AI's signal? Every new location? First time per location? Only when something is actually off? *Each Theme ability needs a clear AI-trigger spec, or the AI will inconsistently fire them.*

---

## Category 2: AI memory dependencies (move to AI_NARRATIVE_PERSISTENCE.md)

This system probably contributes more to AI memory requirements than any other reviewed.

- 🟡 **Geographic fame tracking (Folk Hero).** AI must track "home region" + adjacent + distant + foreign per Folk Hero, expand as deeds accumulate, roll recognition appropriately when entering settlements. *Per-character per-location persistent state at scale.*

- 🟡 **Street children network state (Urchin).** Per-city network state, per-city loyalty/cost, accumulated obligations, named children who didn't survive. *Significant new state category; the explicit ethical-cost framing is unique.*

- 🟡 **Acolyte pastoral memory.** L5 "10 minutes of conversation reveals emotional state and what they're hiding." AI must track NPC emotional states and hidden information per NPC, surface them when an Acolyte engages. *Same shape as Companion personality enrichment but for every NPC.*

- 🟡 **Sage lore consistency.** Sage L5 "ask the DM one question." AI must answer based on consistent world canon, not improvise different answers across sessions. *"The cobbler in the third town" expressed as a class feature — every Sage question creates canon that future Sages will reference.*

- 🟡 **Theme tier tracking per character.** Standard infrastructure but multiplied across every party member.

- 🟡 **Mythic × Theme arc tracking.** Each dissonant arc has 7-9 specific narrative beats the AI must recognize and count toward arc resolution. *Complex narrative state machine territory — Demon+Folk Hero requires 7 Community Anchors; Lich+Acolyte requires 9 Moments of Acceptance; Trickster+Knight requires 7 Acts of Secret Service.*

- 🟡 **Subclass × Theme synergy state.** Per-character, always-on, but the AI must know to invoke them when situational conditions match. *Pattern matching on character state plus narrative situation.*

---

## Category 3: Internal balance and pattern consistency

- 🟢 **The balance pass at the end of THEME_DESIGNS shows real iteration.** Sailor Storm's Chosen split, Knight Aura reduced, Hermit Transcendence narrowed, Urchin L5 trimmed. *Worth recognizing.*

- 🟡 **Folk Hero L17 "Hero of the Age — Incite an Uprising" is genuinely powerful.** Once per campaign arc, narrative event that can topple regimes. Comparable to Mythic Tier 3 effects. *Acceptable per the design philosophy ("legendary for the concept") and the once-per-arc gating, but worth flagging as the strongest L17 capstone in the system.*

- 🟡 **Path of the Berserker × Mercenary Veteran "Blood Wages" is bigger than its framing suggests.** "Frenzy exhaustion penalty is reduced — only if the fight was lost or unresolved. If you end the frenzy with victory, you do not gain exhaustion." The Frenzy exhaustion penalty is one of 5e's most impactful balance levers. Removing it conditionally is bigger than the doc's "small but thematic" framing. *Worth re-examining when this becomes active work.*

- 🟡 **Subclass × Theme synergies vary in mechanical weight.** Battle Master × Soldier "Tactician's Eye" gives both a tactical assessment ability AND extends Field Discipline AC to allies. Way of Open Hand × Hermit "Patient Strike" is essentially "+2 to Quivering Palm DC plus a healing buff." *The Battle Master + Soldier synergy is doing 2-3x the work of Way of Open Hand + Hermit. Both within "small but thematic" framing, but the band is wide.*

---

## Category 4: Cross-system integration

- 🔴 **Subclass × Theme synergies for Keeper may need re-validation if Keeper's `CASTER_TYPE: none` is fixed.** Per the Keeper review, Keeper's caster classification is wrong — the class is functionally a caster. Keeper has four Subclass × Theme synergies (Lorewarden × Sage, Mythslinger × Folk Hero, Rhetorician × Noble, Versebinder × Hermit). *If Keeper's caster type changes, these synergies need re-checking. Minor but worth flagging.*

- 🟡 **Path count inconsistency between Mythic docs.** MYTHIC_THEME_AMPLIFICATIONS says "12 player-accessible Mythic Paths × 21 Themes = 252 possible combinations." MYTHIC_PROGRESSION_GUIDE has 14 paths (or 10 player-facing + 4 dark/villain DM-only depending on count). *Reconcile when Mythic activates.*

- 🟡 **Mythic × Theme amplifications stop at T4 but Mythic has T5.** What happens at T5? Resonant amplification stops scaling? Continues? Becomes something new? *Worth defining.*

- 🟢 **The Prelude integration note is good.** "The Prelude Session can plant seeds for these interactions" — exactly the right cross-system thinking.

---

## Category 5: Content gaps

- 🟡 **The Themes system doesn't cover Custom Classes' interaction with Themes generally.** Subclass × Theme has Keeper synergies but doesn't address: how does the Keeper as a class interact with Themes' L5/L11/L17 progression? A Keeper uses Genre Domains as their identity layer — does that interact with Theme progression? Does picking Forbidden Texts genre + Haunted One Theme produce double-darkness identity? *Implicit gap; system was designed assuming standard 5e classes.*

- 🟡 **The 252-combination scope note raises a real question.** Mythic × Theme doc says it doesn't catalog all combinations; uncovered combinations "function normally." But what does that mean? Both work independently? Don't interact? AI DM still finds narrative moments? *The doc says AI DM "can invoke generative narrative moments" but doesn't specify when or how.*

---

## Category 6: The keystone risk

- 🟡 **Themes is the system the project depends on most.** From prior reviews:
  - Ancestry Feats uses Themes for cross-system collision check (deferred, not yet done)
  - Companions uses Theme tags for synergy engagement
  - Party Synergies is built on the 21-Theme tag list and Theme synergies
  - Mythic has a full amplifications layer that depends on Theme identity

  **If Themes ships as designed, the ecosystem works. If any aspect of Themes shifts after these systems are built, the ripple effects are substantial.** This is the single largest "system the project hangs on" surface area.

  *The design doesn't appear to need redesign — the balance pass is done, all 21 Themes are documented, integration points are mapped. But the project's posture should reflect that Themes is the keystone. Changes here have outsized consequences elsewhere.*

---

## Cross-system observations

- 🟢 **The "L11 = signature ability + Expertise Die" pattern works.** Across 21 Themes, this template produces consistently meaningful tier moments. *Worth recognizing as a project pattern.*

- 🟢 **The Mythic × Theme dissonance arcs are the most narratively ambitious design in the project after the Prelude.** They take character-internal conflict and turn it into mechanical-narrative gameplay. *The Demon+Folk Hero "Righteous Chaos" synthesis ability could become a campaign-defining narrative beat.*

- 🟢 **This is the third system where the AI proactive-action issue surfaces.** Prelude (AI shelters child PC), Companions (AI smooths character edges), Themes (AI must proactively surface Theme effects). **Three different systems, same underlying concern.** When that diagnostic investigation eventually happens, all three are beneficiaries.

---

## Suggested next moves (when this comes off the deferred shelf)

When Themes activates as work — likely at the same time as or downstream of the AI shelter-behavior diagnostic:

1. **Author per-Theme-ability AI-trigger specs.** What signal fires Far Traveler L11? When does Folk Hero recognition roll? Every Theme ability needs explicit trigger language for the AI.

2. **Build AI integration layer.** Same shape as the Party Synergies AI integration work. The Theme system without AI integration is invisible.

3. **Reconcile cross-system inconsistencies.** Mythic path count, T5 amplification scaling, Custom Class × Theme interaction.

4. **Resolve the Keeper synergy question** (after Keeper's CASTER_TYPE issue is fixed).

5. **Implementation in code.** Database, UI, prompt integration. The 84 ability shells in code already exist (per the brief); content for individual abilities is largely written across these three docs.

6. **First playtest with a long-running character.** Theme effects only manifest meaningfully across many sessions. Pairs with the broader "transition to playing mode" trigger.

---

## What this review confirmed about the project

- The Themes system is the closest-to-shippable major design system in the project. 21 Themes designed and balance-passed; ~40 subclass synergies documented; ~20 mythic interactions documented.
- The design is solid; the gap is implementation and AI integration.
- Three Themes are exceptionally strong design (Folk Hero, Urchin, Acolyte L17). Several others are very good. None are weak.
- The AI proactive-action concern (third occurrence after Prelude and Companions) is the central risk.
- This is the keystone system — multiple other systems depend on it. Changes here ripple widely.
- The design notes across all three docs are unusually thorough. Worth preserving as a model for the project.
