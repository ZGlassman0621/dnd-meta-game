# Ancestry Feats — Redesign Vision (Deferred)

A design direction for restructuring the Ancestry Feats system, captured here for future reference. **Not committed to.** The current Ancestry Feats system (in `ANCESTRY_FEATS.md`) remains the live spec. This document holds a vision for what the system *could* become if/when it's revisited with full attention.

**Status:** Design direction, not committed. Filed alongside `FUTURE_FEATURES.md` items but kept distinct because this is a *reshape* of an existing system, not a new feature.

**Trigger to revisit:** Probably tied to lineage-of-characters infrastructure existing, since the L18 mechanism described below requires it. Might also be revisited if Themes review or other system reviews surface enough overlap that consolidation makes sense.

**Last updated:** 2026-04-26

---

## Why this exists

During the Ancestry Feats system review (see `ANCESTRY_FEATS_REVIEW.md` if it still exists in working form), a deeper design conversation surfaced a different way of thinking about what ancestry feats *are*. The framing felt thematically right — closer to the brief's principles than the current system — but committing to it would mean discarding most of the current 84-feat content library and would intersect with infrastructure (lineages of characters) that doesn't yet exist.

Rather than chase the redesign mid-stream, we captured it here for a future revisit when the full project context supports it.

---

## The framing (in user's words)

> The blood that you're born with doesn't decide who you are, but you are capable of heralding the greatest heroes of your people through it. As you age, you unlock new abilities left in your bloodline by the ancestors of your people.
>
> At L1, you recognize potential in yourself that is key to who your people have always been.
>
> At L7, you recognize the nuances of those who came before — and you can bend the bond of yourself and your bloodline towards your needs, choosing the heroes of your lineage who you feel the closest kinship with.
>
> At L13, you claim a boon of your people, specific to your class type, that reflects what a member of your race can be within the confines of that class.
>
> At L18, you awaken something in your blood that few before you have achieved — you are able to choose a boon to leave behind your blood that will affect generations to come, a power you can use to its fullest extent but which dilutes slightly with each successive generation.

---

## Mechanical structure (proposed)

**Four tiers instead of five (no L3 in the new structure).**

### L1 — Foundational Stat Boost
A +1 stat boost specific to the race — the foundation that every member of that race shares. A natural hardiness, an inherited affinity with knowledge, etc. Class-agnostic; every race × every class works because the foundation is *foundational*.

### L7 — Hero of Your Lineage
Choose one feat from among 6 heroes of your race. Each hero specializes in one of the 6 ability scores, with a feat themed around that stat. The 6 heroes are added to world lore as named historical figures, varied across eras, with their own brief biographies.

This means every race has 6 heroes (72 total across 12 lists), each with one feat, each tied to one stat.

### L13 — Class-Aligned Boon
Choose from among 3 specializations: Stealth, Magic, or Melee. Flavor text differentiates per race. A Half-Orc Magic specialization feels different than an Elf Magic specialization, even if their mechanical shapes rhyme.

### L18 — Generational Inheritance
Player and AI DM design a feat together that the character "leaves behind in their blood." This feat:
- Is fully usable by the current character at full strength
- Becomes available to descendants of the current character
- Dilutes slightly with each successive generation
- (Optionally) becomes one of the L7 hero feats for future characters of that race in this campaign world

**This is the mechanism that makes Ancestry Feats explicitly part of the lineages-of-characters north star.**

---

## What carries forward from the current system

Not everything from the current Ancestry Feats spec gets discarded. Items worth preserving as they fit into the new structure:

**L7 hero feats — content sourcing.** Many existing L7-tier feats (War-Born Instinct, Shadow Step, Words of Power, Sacred Fire of Judgment, etc.) could be reframed as the hero feats in the new system. The mechanical content survives; the framing changes.

**L13 specializations — content sourcing.** Existing L13 feats can be sorted into Stealth/Magic/Melee buckets and reused. Some natural fits: Drow Drowcraft Weapon → Stealth or Melee, Half-Elf Inherited Spellwork → Magic, Half-Orc Bloodied and Unbroken → Melee, Tiefling Infernal Pact Magic → Magic.

**Aasimar Fallen Path's Choice.** Move out of Ancestry Feats entirely. Becomes a **race quest** — see "Race quests" section below.

**Other moments of significant narrative weight in current spec** (Drow Lolth standing, Drow House Heritage, Half-Orc Orc Blood Awakened body change, etc.) — likely become race quest content rather than feat content.

---

## Race quests as a parallel system

A separate idea surfaced in the same conversation: **race quests and class quests** as their own system, providing narrative-driven character-defining moments that aren't gated by character level alone.

In the redesign, race quests could be tied to L7 and L13 unlocks — completing your race quest might be the trigger for unlocking the L7 hero feat selection or the L13 specialization choice. **Thematically: "you don't level into ancestry awareness; you live into it."**

Race quests would replace the "narrative beats moved out of feats" content (Aasimar Path's Choice, Drow Lolth allegiance arc, etc.) — these become real questlines the player undertakes, with stakes, choices, and outcomes that flow back into mechanical effects.

This needs its own design pass and isn't part of this redesign per se, but the two systems would interlock.

---

## Concerns and open problems

The system review flagged several real concerns that any future commitment to this redesign must address:

**Content lift.** 12 races × 6 hero feats + 12 races × 3 specialization feats = 108 new feats to design and write, plus 72 hero NPCs to add to world lore varied across eras. Roughly equivalent in scope to the entire Themes content lift. Not trivial.

**L18 is genuinely novel and genuinely hard.** Player-DM-designed feats raise:
- Balance (player-designed feats can be over- or under-powered)
- AI-DM challenge (the AI must either generate the feat fairly or vet a player proposal against unstated balance criteria)
- Persistence (the feat must survive across character lifetimes and *dilute* over generations — what does that mean numerically?)
- Infrastructure (no architecture for character lineages exists yet)

The L18 mechanism essentially can't exist without lineages-of-characters infrastructure. **This redesign is therefore gated on the lineage system being built.** That's not a blocker for capturing the vision now; it's a real timing constraint for ever shipping it.

**Hero differentiation across races.** If every race has an INT hero and the resulting feats are "+1 cantrip / +1 known spell / +1 to INT-based check" with different flavor text, the system fails its purpose. The hero feats must be *meaningfully different* per race, which is the same content-lift problem named above.

**Loss of unique designs.** Several genuinely strong designs in the current system (Aasimar Fallen Path's Choice, Tiefling cost mechanic, Drow Lolth tracker) don't naturally fit the new shape. We've proposed moving Path's Choice to race quests, but other designs may not have a clean home. **What gets lost should be deliberately catalogued before any commitment.**

---

## When to revisit

Strong triggers for picking this back up:

1. **Lineage-of-characters infrastructure exists or is being scoped.** L18 generational-boon mechanism becomes possible.
2. **Race quests system has been designed.** The L7/L13 unlock-via-quest mechanic becomes possible, and the "narrative beats" content from current system has a clear home.
3. **Themes review and Mythic review are complete.** Cross-system structural understanding is mature enough to design Ancestry Feats in concert with sister systems.
4. **The AI Narrative Persistence engineering thread has progressed.** The "AI tracks and acts on" requirements are no longer aspirational.

Until at least 2 of these 4 land, this redesign stays here.

Soft trigger: if at any point the user says "the current Ancestry Feats system is producing problems that this redesign would solve," that's a signal to bring it forward earlier.

---

## What to do with the existing ANCESTRY_FEATS.md in the meantime

Keep it as the live system. The fixes from the recent review are still worth shipping (status header, Half-Elf Fey Reflexes balance miss, Forge of Will narrowing, etc.) — they make the current system better even if the eventual direction is replacement.

Don't invest *additional* design effort in the current system. Bug fixes and polish only. Major content additions (e.g., adding new races) should pause until this redesign question is resolved.
