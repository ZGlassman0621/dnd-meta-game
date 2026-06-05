# Handoff: Hearth — Character Sheet

## Overview
The **Character Sheet** is one screen in **Hearth**, a D&D 5e companion app. It presents a single
player character (the level‑3 Wood Elf Monk "Dravyr Wyrmrest") across seven tabbed views:
Overview, Abilities & Skills, Features & Traits, Progression, Equipment, Inventory, and Background.

The screen's job is **reference and review** — a player glances here to read their stats, modifiers,
features, gear, and story. It is the detail view reached from the Dashboard ("Dravyr's home"). It is
deliberately calm and editorial, not a live combat tool (that's the separate Cockpit screen).

## About the Design Files
The files in this bundle are **design references created in HTML/CSS** — a high‑fidelity prototype
showing intended look and behavior. **They are not production code to copy directly.**

The task is to **recreate this design inside your target codebase** (React, Vue, SwiftUI, native,
etc.) using its established patterns, component primitives, and state libraries. If no app
environment exists yet, choose the framework most appropriate for the project and implement there.
Treat the HTML as the source of truth for *layout, spacing, color, type, and copy* — not for
architecture.

## Fidelity
**High‑fidelity.** Colors, typography, spacing, and the resting visual state are final and should be
matched closely. All values come from a shared token sheet (`tokens.css`) — port those tokens into
your codebase's theme system rather than hardcoding hex values per component.

The **interactions are intentionally minimal** in the prototype — only tab switching is wired. See
*Interactions & Behavior* and *What Is NOT Built* for exactly what still needs real engineering.

---

## ⚠️ This Is a Static Mock — Read This First
Every number on this screen is **hardcoded HTML**, not derived. The prototype does no D&D math.
A production build must add the calculation layer:

- **Ability modifier** = `floor((score − 10) / 2)` → drives almost everything below.
- **Skill/Save modifier** = ability mod `+` (proficiency bonus if proficient) `+` situational sources.
- **Proficiency bonus** is level‑derived (+2 at levels 1–4, +3 at 5–8, …).
- **AC** here is Monk Unarmored Defense: `10 + Dex mod + Wis mod`.
- **Passive Perception/Insight** = `10 + skill modifier`.
- **Attack `to‑hit`** = ability mod + proficiency; **damage** = die + ability mod.
- **Carry capacity** = `Str score × 15` (180 for Str 12 shown is illustrative — verify against your rules engine).

The character should be a single **data model** consumed by this screen *and* the sibling screens
(Level Up, Cockpit, Companions, Backstory) so they all read one source of truth. Define that schema
first; this screen is its read view.

---

## Screens / Views

This is **one screen with a tab switcher**. Shared chrome wraps all tabs; each tab swaps the body.

### Shared chrome (always visible)

**Header (`.dash-hdr`)** — sticky, top, height **58px**, `padding: 0 28px`, 1px bottom rule,
translucent blurred background (`backdrop-filter: blur(8px)`).
- Left: serif wordmark "D&D" (gold italic ampersand) · vertical divider · back link
  "← Dravyr's home" (→ `Dashboard.html`).
- Right: "Opus" model indicator (mono caps + glowing gold dot).

**Identity hero (`.id-hero`)** — card directly under header. CSS grid `auto 1fr auto`, gap 26px,
padding `24px 28px`, radius 14px, `--shadow-sm`.
- **Crest** (84×84, radius 12px): dark gradient tile with a large serif gold monogram "D" and a
  −8px‑offset circular **level badge** "3" bottom‑right.
- **Identity block**: `<h1>` name (EB Garamond 500, **40px**), italic serif subtitle line
  "Wood elf · Monk of the Open Hand · Hermit · The Hollow Man" (dotted `·` separators in `--ink-4`),
  then a wrap of **stat pills** (`.ipill`): HP `24 / 27` (green variant), AC `15`, Init `+3`,
  Speed `40 ft`, Prof `+2` (gold variant), Ki `3 / 3`, Hit Dice `3d8`.
- **Actions column** (min‑width 138px, stacked, gap 8px): **Level up** (`.btn.primary`, gold) →
  should route to `Level Up.html`; **Short rest** and **Long rest** (`.btn.ghost`).

**Tab bar (`.tabs`)** — horizontal, 1px bottom rule, wraps. Each `.tab` is a button with a 15px
icon + label; the active tab is gold text with a 2px gold bottom border (overlapping the rule via
`margin-bottom: -1px`). The Inventory tab carries a mono count badge (`.ct`) "9".

Tabs (in order): **Overview · Abilities & Skills · Features & Traits · Progression · Equipment ·
Inventory · Background**.

**Canvas** — `.sheet-canvas`: `max-width: 1180px`, centered, `padding: 34px 28px 90px`.

### Tab 1 — Overview (default active)
Recap dashboard. Layout = a `1.1fr .9fr .9fr` row (`.grid3`) then two `2fr 1fr` rows (`.grid2`).
- **Abilities** card: 3×2 grid of `.ability` tiles (name caps label, big score, gold modifier).
  Prime abilities (Dex, Wis) get a tinted background + gold dot marker.
- **Saves** card: six `.rrow` rows; proficient rows (Str, Dex) get a filled gold dot + tinted bg.
- **Senses** card: Perception/Insight/Investigation rows (icon + value) + an italic note line
  (Darkvision 60 ft · Fey Ancestry · Trance).
- **Skills** card: 18 skills in a 3‑column grid (`.skill`), each = dot · name · ability tag · mod.
- **Proficiencies** card: Languages (chips), Weapons & armor (prose), Tools (chips with icons).
- **Attacks** card: three `.atk` rows (name + meta · gold to‑hit · mono damage).
- **Key features** card: three `.feat` entries (title + source tag + description).
- Closes with an italic **footnote** line.

### Tab 2 — Abilities & Skills
Deep view. Top: 6 `.ab-card` detail cards (3‑col) each with name, modifier, big score, and a
"governs" line. Then a `.grid2` of **Saving throws** + **At a glance** (passive scores, prof bonus,
initiative). Then a full‑width **Skills** card using `.skillrow` (dot · name · ability · *source*
tag · modifier), where proficiency sources are labeled (Monk / Hermit).

### Tab 3 — Features & Traits
Three labelled groups, each a 2‑col grid of `.anc-feat` cards (icon tile + title + description):
**Monk** (6 features), **Wood Elf** (6 ancestry traits), **Hermit** (theme tier I, 2 entries).

### Tab 4 — Progression
- **Theme hero** (`.theme-hero`, 3px gold left bar): eyebrow "Theme · replaces background",
  title "The Hermit", italic description.
- **Theme tiers**: 4‑col `.tier` cards with states — `.done` (gold border/tint + check icon),
  `.next` (dashed border), `.locked` (55% opacity). Each shows tier number, unlock level, name, and
  ability text.
- **Ancestry feats**: 2‑col `.anc-feat` grid (Wood Elf).
- **The Hermit's Path** (`.path-card`): a **conviction track** — two italic poles
  (Solitude ↔ Communion), a gradient bar with a glowing draggable‑looking **marker** at `left: 38%`,
  four tick labels (Hidden · **Wary** · Open · Devoted, current in gold), and an italic note. This is
  a narrative slider — **visual only** in the mock.

### Tab 5 — Equipment
**Wielded** card (three `.atk` rows). A `.grid2` of **Armor Class** (big 44px number + italic
formula prose) and **Worn** (key/value prose). **Attunement** section: 3 dashed `.attune-slot`
placeholders ("An open slot", 0 of 3 used).

### Tab 6 — Inventory
`.grid2`: left = **Carried** card with 9 `.invrow` rows (icon tile · name + sub · qty · weight).
Right column = a gold **Gold** card (`112 gp`), a **Burden** card (carry bar at 21%, "38 lb / 180"),
and a **Notable** card (quest/keepsake items). *(Note: the Carried header says "12 items" and the tab
badge says "9" — reconcile against real data; both are placeholders.)*

### Tab 7 — Background
Editorial prose: **The life that shaped him** (`.bg-prose`, EB Garamond 17px / 1.7, two paragraphs
with `<strong>` 500‑weight emphasis). **What drives him**: 2‑col `.vows` grid — Ideal, Bond (blue
left bar), Flaw (red left bar), Personality (green left bar), each an italic quote. Closes with a
link to `Backstory.html` ("Backstory parser →").

---

## Interactions & Behavior

**Built in the prototype:**
- **Tab switching** — click a `.tab`: toggles `.active` on the tab, toggles `.show` on the matching
  `.tabpane` (`data-tab` ↔ `data-pane`), and `window.scrollTo({top:0})`. Panes are `display:none`
  until `.show`.

**Hover states (CSS, built):** back link, tabs, buttons (see `tokens.css` `.btn` variants), chips.
Transitions are short — `.12s`–`.14s` on color/background/border.

**NOT built — needs engineering (visual only in mock):**
- **Level up / Short rest / Long rest** buttons — no handlers. Level up should route to
  `Level Up.html`; rests should mutate HP / Ki / Hit Dice state.
- **Dice & attacks** — to‑hit and damage are static text; no roll behavior.
- **The Hermit's Path marker** — fixed at 38%; not draggable, no persistence.
- **Inventory/Equipment** — no add/remove/equip/attune actions; quantities are static.
- **Editing** — nothing on the sheet is editable; this is a read view.
- **Responsive** — the document is authored at a fixed `width=1440` viewport
  (`<meta name="viewport" content="width=1440">`) with `max-width` content columns. There are **no
  breakpoints**; mobile/tablet layouts must be designed if needed.

## State Management
Define a single **character model** and derive everything. Minimum shape:

- **Identity**: name, ancestry, class + subclass, background/theme, alignment/epithet, level.
- **Vitals**: hp.current, hp.max, hp.temp, hitDice, ac, speed, initiative, proficiencyBonus.
- **Resources**: ki.current/max (generalize to a resource list — spell slots, etc.).
- **Abilities**: { str, dex, con, int, wis, cha } scores → derive modifiers.
- **Proficiencies**: saves[], skills[] (with source), languages[], tools[], weapons/armor.
- **Skills**: derive modifier from ability + proficiency + sources.
- **Features**: grouped by source (class / ancestry / theme), each title + description + level.
- **Progression**: theme tiers (with unlock level + state done/next/locked), the conviction track
  position (0–1) and current label.
- **Equipment**: wielded attacks, worn items, attunement slots (max 3).
- **Inventory**: items [{ icon, name, sub, qty, weight }], gold, carry.current/max, notable[].
- **Background**: prose paragraphs, ideal/bond/flaw/personality.

State transitions to support: tab selection (UI), short/long rest (resets resources & HP rules),
level up (opens flow), conviction marker move, inventory mutations. Data likely fetched per
character id; this screen is read‑mostly.

## Design Tokens
All tokens live in **`tokens.css`** — port these into your theme. Key values:

**Surfaces (warm near‑black):** `--bg #1a1712` · `--bg-2 #221e18` · `--bg-card #272219` ·
`--page #211d17` · `--raise #2e2820`.
**Ink (warm parchment):** `--ink #ece4d6` · `--ink-2 #b8af9b` · `--ink-3 #988e77` · `--ink-4 #7c7360`.
**Rules:** `--rule #3a3328` · `--rule-soft #2c2620`.
**Accents:** `--accent #c9a96a` (manuscript gold, primary) · `--accent-d #b1925a` (pressed) ·
`--accent-2 #8ba2c6` (ink‑blue, secondary/links) · `--selection rgba(201,169,106,.20)`.
**Semantic game‑state:** `--good #93b98a` · `--warn #d8b46b` · `--bad #cf8478` ·
`--combat #d2895a` · `--magic #ab9fda`.
**Type families:** `--serif "EB Garamond"` (prose/headings/italic emphasis) ·
`--sans "Inter"` (UI chrome: labels, buttons, nav) · `--mono "JetBrains Mono"` (numbers, dice, meta).
**Shadows:** `--shadow 0 1px 2px rgba(0,0,0,.35), 0 14px 44px rgba(0,0,0,.5)` ·
`--shadow-sm 0 1px 2px rgba(0,0,0,.30), 0 4px 14px rgba(0,0,0,.32)`.
**Radius:** `--radius 7px` · `--radius-lg 11px` (hero/crest use a custom 12–14px).
**Type scale (from tokens):** display 56 / step 44 / section 24 / lede 20 italic / body 18 /
help 16 italic / eyebrow 11 (.22em) / label 11 (.18em) / button 12 (.14em). Numbers use
`font-variant-numeric: tabular-nums`.

`tokens.css` also ships shared component classes — `.btn` (default/primary/ghost/danger + .lg/.sm),
`.chip`/`.tagpill`, `.card`/`.panel`, `.hpbar`/`.hptrack`, `.pip`/`.pip-bar`, `.modal`/`.sheet`/
`.scrim`, `.sec-head`, `.crest`, header chrome. **Build these as your shared component primitives** —
they recur across every Hearth screen.

## Assets
- **Icons**: inline SVG sprite at the top of `Character Sheet.html` (`<symbol id="i-…">`), all
  24×24, `stroke=currentColor`, Feather/Lucide‑style line icons (arrow‑left, sword, shield, eye,
  brain, leaf, flame, coin, etc.). Swap for your codebase's icon set (Lucide matches the style 1:1)
  or keep the sprite.
- **Fonts**: Google Fonts — EB Garamond, Inter, JetBrains Mono (loaded in the HTML `<head>`).
- **No raster images / no external image assets** on this screen.
- **Crest "D"** is typographic (serif monogram), not an image.

## Files
In this bundle:
- `Character Sheet.html` — the screen (inline `<style>` for screen‑specific layout + a small tab
  script at the bottom). Authored at 1440px width.
- `tokens.css` — the shared Hearth design system (tokens + component classes). Imported by every
  screen, not just this one.

**Sibling screens this connects to** (not included here, but referenced/linked from the sheet —
ask if you want them bundled too):
`Dashboard.html` (back link) · `Level Up.html` (Level up button) · `Backstory.html` (Background tab
link) · plus `Cockpit - Calm/Combat.html`, `Companions.html`, `Campaigns.html`, `Settings.html`.
They share `tokens.css`, so build the design system once and reuse.
