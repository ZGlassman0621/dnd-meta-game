# Keeper (Custom Class) — Review Findings

Working doc between user and PM Claude after a full read of `CUSTOM_CLASSES.md`. Captures issues to address; assumes things not flagged here are working as intended.

**Scope:** Issues only. Format: to-do. Each finding has a severity tag and a one-line recommended next step. Findings are deferred per user — captured here to act on later, not now.

**Severity tags:**
- 🔴 **Bug/error** — clear mistake, no design judgment required to fix
- 🟡 **Open question** — design judgment needed; user decides
- 🟢 **Heads-up** — works as designed but has implications worth knowing

**Status:** Findings captured, deferred for later action. The Keeper review confirms the class exists, is integrated, and has known issues — we'll come back to these when system reviews complete.

---

## Important framing context

The Keeper is **purpose-built for a specific player archetype** — players who, like their character, want to spend time in libraries, study lore, and roleplay a scholar. It is explicitly not designed to be appealing to murder hobos, romance bards, political manipulators, or generalist heroes.

**This shifts how we evaluate the class.** "The Keeper does the work of three classes" sounds like a balance problem under generic class-design assumptions. Under the actual design intent ("a class for players who want this specific roleplay experience"), mechanical breadth is a feature, not a bug. The class compensates for being a niche pick by being mechanically rich.

**Implication:** Future review/balance passes should not try to narrow the Keeper's mechanical scope. The breadth IS the design.

---

## Category 1: Bugs / errors

- 🔴 **CASTER_TYPE: none is incorrect.** The Keeper has Recitations (cantrip-equivalent), Texts/Passages (spell-equivalent with save DCs), spell DC formula matching standard casters (8 + prof + CHA), and caster-style scaling and capstones. Marking the class as `CASTER_TYPE: none` means multiclass spell-slot calculations don't include Keeper levels, creating a structural exploit (Wizard 1 / Keeper 19 = full Wizard slot progression + nearly the entire Keeper toolkit). *Fix: classify as half-caster or third-caster for multiclass purposes, OR explicitly forbid multiclass into Keeper, OR design a Keeper-specific multiclass rule.*

- 🔴 **Genre-bonus texts may not exist as real content.** Each Genre Domain says it grants "+1 bonus text." The doc summarizes the Genre Domain reference data as implemented, but the bonus texts themselves aren't visible in the Text Catalog summary. *Verify: are 8 Genre-bonus texts written and in `keeperTexts.js`? If not, this is a content gap that needs filling before Keeper is fully shippable.*

- 🔴 **Genre × Subclass synergy ratings appearing in player-facing UI is a bug.** Per user: synergy ratings (A+, A, B, C) are an internal class-structure concept and should NOT be delivered to the player. The UI integration notes show "Genre interaction ratings shown in L6 subclass picker with synergy descriptions" — that's leaking internal data into the player experience. *Fix: remove ratings from UI; keep synergy descriptions if useful as flavor, but no letter grades.*

- 🔴 **Subclass picker UI missing full descriptions.** Per user: every class's subclass picker (Keeper included) should show full descriptions to support informed player decisions, not just synergy info. *Fix: ensure UI displays full subclass descriptions at the L6 choice point.*

---

## Category 2: Content gaps

- 🟡 **Genre Domain bonus texts (overlaps Bug Category).** If they don't exist, write 8 — one per Genre. Each text needs: title, author (if known), brief description, weapon type, Passage effect.

- 🟢 **Keeper has no example of the AI-DM narrative-delivery pattern.** Most other classes don't need this — a Cleric's spells fire mechanically and the AI runs the narrative around them. Keeper is different because the texts ARE the narrative source. *Worth a future design pass: how does the AI surface text-as-story? Does the AI quote from texts during use? Does the player hear the narration of "the Hymn of the Silver River strikes through your enemy" or just see damage numbers?*

---

## Category 3: AI Narrative Persistence requirements (move to AI_NARRATIVE_PERSISTENCE.md)

- 🟡 **Eidetic Memory (L5)** — AI must track every text the character has ever read or encountered, not just the ones in their selected library. This includes texts seen in NPC libraries, mentioned by NPCs, or discovered in the world. *Memory cost is small per-text (title + author + sentence or two), but the persistence question is "which texts have been encountered" across potentially hundreds of sessions.*

- 🟡 **Unwritten Knowledge (L14)** — AI must track which "notable enemies" the character has defeated and which "lore sites" they've discovered. At L14, the AI must surface text-acquisition opportunities tied to past defeats and discoveries. *This is "the cobbler in the third town" pattern as a class feature — defeated enemies and discovered sites become a permanent part of the character's potential progression.*

- 🟡 **Genre Domain flavor consistency** — A History Keeper invoking Mastery should narratively feel different from a Mythology Keeper invoking Mastery. The AI must honor the Genre flavor across all uses of class features, not just at the moment of selection. *Same shape as race quest narrative consistency.*

- 🟡 **Keeper's libraries as in-world places** — The class identity ties the character to specific libraries (where they studied, where they discovered texts). A Keeper returning to a previously-visited library should have the AI remember the character was there before. *Tied to general NPC/place persistence, not Keeper-specific, but the Keeper's identity makes it more salient.*

---

## Category 4: Design questions (deferred for play-testing)

These are not bugs and not gaps — they're real design questions that benefit from playtest data before deciding on a direction.

- 🟡 **L6 "subclass or Polymath" choice complexity.** The UI fix in Category 1 (full subclass descriptions) helps. But the underlying question is: should this choice be revisitable? Most 5e classes lock subclass choice; the Keeper's choice is more complex than most. *Decide after play: does the L6 choice feel locked-in-too-tight, or is it appropriately weighty?*

- 🟡 **Synergy ratings: just remove, or make mechanical?** Currently ratings exist internally but don't gate or modify mechanics. The user's call is "internal-only, don't surface to player." But there's a third option: make the ratings *actually matter* mechanically. A+ pairings get a small bonus; C pairings have a small drawback. *Likely defer until other class designs surface — if other classes adopt the "Domain × Subclass" pattern, the synergy mechanic might become useful.*

- 🟡 **Keeper-as-multiclass beyond the CASTER_TYPE fix.** Beyond the multiclass-slot issue, the Keeper has texts/passages that feel narratively wrong to multiclass into. Can a Wizard 5 / Keeper 5 character coherently claim to have studied texts as deeply as a single-class Keeper? *Probably worth thinking about whether Keeper is mechanically multiclass-friendly, narratively multiclass-friendly, or neither. Defer until play.*

---

## Category 5: Player experience (deferred until first play)

- 🟢 **The Keeper has not been played.** Per user. The class is built and integrated but unproven. Most of the design questions above benefit from real playtest data.

- 🟢 **Recitation/Text/Passage terminology may need polish in play.** Three terms (Recitations, Texts, Passages) close to each other in meaning. Players (even one experienced player) may slip between terms in usage. *Watch in play; if confusion is frequent, consider renaming one of them.*

- 🟢 **Genre Domain naming has academic-discipline flavor.** "Political Science," "Natural Philosophy," "Forbidden Texts" — these read as university-curriculum departments. That fits the scholar identity, but it does mean the Keeper's narrative voice leans 19th-century academic. *Worth knowing in case future custom classes want to share a flavor space (e.g., a class that's a working-class scholar, a folk-magic scholar, etc.).*

---

## Suggested next moves (when this comes off the deferred shelf)

When the Keeper review reactivates, suggested order of operations:

1. **Quick fixes (🔴):** Multiclass classification, verify Genre-bonus texts exist, remove synergy ratings from UI, add full subclass descriptions. Maybe 1-2 short Code handoffs.

2. **Add AI Narrative Persistence entries.** The four entries from Category 3 belong in AI_NARRATIVE_PERSISTENCE.md. (Done as part of this review — see that file.)

3. **First playtest.** Before anything else design-related, the user plays a Keeper character through ~15-20 turns of representative content. The playtest answers most of the deferred design questions.

4. **Post-playtest review.** Findings from play feed back into Category 4 and Category 5 decisions.

---

## What this review confirmed about the project

- The Keeper exists and is integrated. It's not theoretical work.
- The class is purpose-built for a specific player archetype, not a generic "balanced class for everyone."
- The class adds significant AI Narrative Persistence requirements — possibly more than any other system reviewed so far.
- The class has 4 fixable bugs and a content gap, all small.
- The class has not been played.

The Keeper is in roughly the same state as Ancestry Feats: built, integrated, with known issues that don't block continued system review.
