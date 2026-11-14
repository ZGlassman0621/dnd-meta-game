# Settings page — Design brief

**Phase:** 3.5
**Project:** Single-player D&D 5e + AI DM web app
**Authored by:** PM (Claude)
**Date:** 2026-05-05
**Audience:** Claude Design

---

## Context

The project is in late Phase 3 / early Phase 3.5. We've recently shipped a server-side mechanism for survival intensity — a four-position dial (Off / Lenient / Standard / Strict) that controls how punishing the survival mechanics (starvation, dehydration, weather effects on water needs) feel during play. The mechanism is fully implemented; characters default to Standard. What's missing is the player-facing way to actually change the setting.

Phase 3.5's purpose is to deliver that UI — but rather than building a one-off control for one setting, we're using this as the moment to introduce a proper Settings page to the app. The page launches with two visible items:

- **Survival intensity** (active control, four positions)
- **Combat difficulty** (placeholder, visible but disabled, labeled as "coming soon")

Future settings will accumulate here over time (additional difficulty dials, accessibility options, possibly audio when audio exists, possibly debug/developer toggles). The design needs to anticipate that growth without over-investing in surfaces that don't have content yet.

---

## What Design owns this round

- Where Settings is accessed from in the existing nav
- Modal overlay vs. full-screen treatment
- Information architecture (single scrolling page vs. sectioned/tabbed)
- Visual treatment of the survival intensity control (dropdown / radio / segmented control / something else)
- Visual treatment of the combat difficulty placeholder
- Save behavior (apply on click, apply on close, explicit save button)
- Return-to-gameplay flow (especially mid-session — player is in a DM session, opens Settings, what happens to session state)
- Empty-state treatment for sections that don't yet have many items
- Mobile-vs-desktop responsiveness if relevant to current targets

## What Design does not own this round

- Specific controls for future settings beyond what's specified above
- Settings affecting character creation flow (separate Design ask if it ever happens)
- Settings sub-pages or hierarchical navigation (page is flat for now)

---

## Editorial constraints

The app's editorial aesthetic is locked as the project default (established Phase 2). Settings extends it rather than redefines it. Reference:

- The wizard reskin pattern (eyebrow / display title / italic lede header treatment; card spacing; form-control underlines)
- The home screen and DM session screen layout patterns
- Editorial register (warm, slightly literary, never breaking the fourth wall into "app-speak")

Settings is the first non-wizard, non-gameplay surface this app has. The aesthetic should still feel like the same app — but Settings is a tool screen, not a narrative screen, so the editorial register relaxes slightly. Functional clarity comes first; literary flourish supports rather than leads.

---

## Functional requirements

### Access

The player must be able to reach Settings:
- From the home screen (always)
- From mid-DM-session (without losing session state)

How those two access patterns work visually is Design's call. Suggestions worth weighing:
- A persistent gear icon in a top bar that's present across all screens
- A hamburger / kebab menu somewhere consistent
- An in-session "menu" affordance that surfaces Settings alongside other options (save, return to home, etc.)

### Mid-session safety

If the player opens Settings during a DM session and changes a setting (say, flips survival intensity from Standard to Off), the session state must not be disturbed. Settings changes apply immediately at the point of next evaluation; the player returns to their session intact.

This means: no full page navigation that loses context. Either modal/overlay over the session, or a navigation pattern that explicitly preserves session state. Design's call on which.

### The two controls

**Survival intensity (active)**
- Four positions: Off / Lenient / Standard / Strict
- Each position has a short explanatory paragraph (~1-2 sentences) so the player understands what they're choosing
- Default: Standard
- Per-character setting (each character has their own survival intensity)

Suggested explanatory copy (Design may revise):
- **Off** — Survival mechanics fully disabled. No starvation, no dehydration, no weather effects. Useful for narrative-focused play.
- **Lenient** — Survival exists as flavor. Hunger and thirst rarely punish; weather effects are mild.
- **Standard** — Realistic survival pressure. Default rules.
- **Strict** — Survival genuinely matters. Tighter thresholds, harsher weather effects.

**Combat difficulty (placeholder)**
- Same four-position layout as survival intensity (Off / Lenient / Standard / Strict)
- Visually disabled or marked as "coming soon"
- Labeled clearly: "Combat difficulty — coming with future updates" or similar
- Visual goal: player understands this is a real future control, not a teaser or abandoned stub

This placeholder is intentional — it sets player expectations that the Settings page is a growing surface, and signals that combat tuning is a real planned feature.

### Save behavior

Three reasonable approaches; Design picks:
- **Apply on click.** Player selects a position; setting saves immediately. No save button.
- **Apply on close.** Player makes changes; settings save when they close the page or navigate away. Possible "Discard changes" option.
- **Explicit save button.** Player makes changes; settings stay pending until they click Save. Most traditional but adds friction.

PM lean: apply on click feels right for low-stakes settings like difficulty dials. Less ceremony. But Design has the better instinct here.

### Return to gameplay

When the player is done with Settings, they return to:
- The home screen if they came from home
- The DM session if they came from mid-session (session state intact)

Whatever the access pattern is, this exit path needs to be obvious. "Done" / "Close" / "Back to game" / "X" — Design's call on which, but the exit must be visible without scrolling.

---

## Open questions for Design

These are the calls Design should make and report back on:

1. **Where does Settings access live?** Top-bar gear icon? In-session menu? Both? How does the access pattern handle the home-vs-session contexts?

2. **Modal or full-screen?** A modal overlay preserves visual context (the player still sees their game in the background); a full-screen takeover gives Settings room to grow as more controls land. Which fits the app's aesthetic better?

3. **Single page or sectioned?** With two controls today (one active, one placeholder), it could be a single page. As more settings accumulate, it might become sectioned. Should we design for the future state now, or start simple and let it evolve?

4. **Save behavior.** Apply on click, apply on close, or explicit save?

5. **Visual treatment of the four-position dial.** Dropdown? Radio group? Segmented control? Custom slider with labeled positions? Something else? The four positions need to be clearly distinguishable, with explanatory text per position visible (or visible on hover/expansion).

6. **Placeholder treatment for combat difficulty.** How to make "this control will work later" clear without it looking abandoned or like a bug? Greyed-out? Different visual treatment with a "coming soon" tag? Visible-but-non-interactive?

7. **Empty-state framing.** With only two items today, will the page feel sparse? Worth designing some lightweight scaffolding to make the page feel intentional even with few controls?

---

## Constraints worth pre-loading

- **Aesthetic continuity is non-negotiable.** Editorial register, typography, spacing patterns from existing screens carry into Settings. This isn't a place to experiment with a new design language.
- **Player should never feel "the app changed under me."** Settings is a tool surface but should still feel like part of this game.
- **Per-character data, not per-account.** Different characters can have different survival intensities. Design may want to indicate "settings for [character name]" somewhere on the page so the scope is clear.

---

## Deliverables PM needs back from Design

- Visual mocks (figma, image, sketch — whatever Design's normal output is) for: Settings page layout, survival intensity control, combat difficulty placeholder, access affordance(s), exit affordance
- Decisions on the seven open questions above
- Any constraints or implementation notes Code should know about for the build

PM forwards Design's output to Code as part of the Phase 3.5 spec handoff. Code then ships the page end-to-end.

---

## Reference docs

If helpful for context:
- `PROJECT_BRIEF.md` — overall project framing
- `PHASE_2_CREATOR_SPEC.md` — example of a prior Design-led ship's spec shape (the wizard reskin)
- `CLAUDE.md` — editorial aesthetic notes
- Phase 3 ship history (v1.0.114 through v1.0.162) — examples of what the editorial aesthetic looks like in shipped form

---

End of brief.