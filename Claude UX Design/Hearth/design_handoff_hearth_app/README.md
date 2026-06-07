# Handoff: Hearth — AI Dungeon Master companion (full app)

## Overview
**Hearth** is a companion app for playing Dungeons & Dragons with an AI Dungeon Master ("**Opus**"). It is where a player lives *between and during* sessions: a character home, the live in-session DM cockpit, the 5e character sheet, world/lore screens, character creation, and **campaign creation**. The aesthetic is **"dark-editorial"** — warm near-black surfaces, parchment-toned ink, a single muted manuscript-gold accent, and an EB Garamond literary voice. It should read like a beautifully typeset book that happens to be software, not a typical SaaS dashboard.

This bundle is the **complete design**, not a subset. Two pieces are the most recent work and are documented in the most detail below:
1. A **first-time tutorial** on the Dashboard (welcome card → guided spotlight tour).
2. **Begin a new Campaign** — a conversational atelier where Opus authors your world.

---

## About the design files
The files in this bundle are **design references created in HTML/CSS/vanilla JS** — high-fidelity prototypes that show the intended look, copy, and behavior. **They are not production code to copy verbatim.**

The task is to **recreate these designs in the target codebase's environment** (React, Vue, SwiftUI, etc.), using its established component patterns, routing, and state libraries. If no front-end environment exists yet, choose the most appropriate stack for the product and implement there.

**The single most important file is `tokens.css`.** Every screen is built from the shared tokens and component classes it defines. Port `tokens.css` first — as CSS custom properties, a Tailwind theme, a design-token module, or your platform's theming system — and build components against those tokens. If you do this faithfully, the screens will match what the designer is looking at. Do **not** re-derive colors/spacing per screen; they all come from `tokens.css`.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, shadows, copy, and interactions are all intentional. Recreate pixel-faithfully using the codebase's libraries. Where a screen's inline `<style>` block overrides or extends a token-class, treat the inline value as the source of truth for that screen (the tokens are the defaults; screens occasionally specialize them).

---

## Tech notes that make the result match

### Fonts (load these exact families)
Loaded from Google Fonts in every file:
- **EB Garamond** — the *voice*. Used for prose, headings, titles, italic emphasis. Weights 400/500/600 + italics.
- **Inter** — UI chrome only: eyebrows, labels, buttons, nav, form controls. Weights 400/500/600/700.
- **JetBrains Mono** — numbers, dice, timestamps, system/meta lines. Weights 400/500.

```
https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap
```

Rule of thumb: **if it's a sentence the player reads, it's EB Garamond. If it's a UI label, it's Inter. If it's a number/timestamp, it's JetBrains Mono.**

### Icons
All icons are **[Lucide](https://lucide.dev)** glyphs, embedded as inline SVG `<symbol>` sprites at the top of each HTML file (ids like `#i-arrow-left`, `#i-play`, `#i-users`). In a real codebase, **use `lucide-react` (or the platform equivalent)** instead of copying the SVGs. Name mapping used in the prototypes:

| sprite id | Lucide name | sprite id | Lucide name |
|---|---|---|---|
| `i-arrow-left` | `ArrowLeft` | `i-arrow-right` | `ArrowRight` |
| `i-play` | `Play` (filled) | `i-send` | `Send` |
| `i-settings` | `Settings` | `i-sliders` | `SlidersHorizontal` |
| `i-users` | `Users` | `i-user` / crest | (monogram, not an icon) |
| `i-compass` | `Compass` | `i-globe` | `Globe` |
| `i-scroll` | `ScrollText` | `i-feather` | `Feather` |
| `i-eye-off` | `EyeOff` | `i-shield` | `Shield` |
| `i-refresh` | `RefreshCw` | `i-check` | `Check` |
| `i-pin` | `MapPin` | `i-clock` | `Clock` |
| `i-book` | `BookOpen` | `i-plus` | `Plus` |
| `i-activity` | `Activity` | | |

Stroke icons use `stroke-width: 1.7–1.8`, `stroke-linecap/linejoin: round`, `fill: none`, and inherit `currentColor`.

### No images, no gradients-as-texture
There is exactly **one raster asset** (`_lu3.png`, used on the Level Up screen). Everything else is type, rules, and tokenized surfaces. The "crest" monograms are a serif letter on a tokenized linear-gradient tile — not images.

---

## Design tokens (port these first — verbatim from `tokens.css`)

### Surfaces — warm near-black, like dark aged paper
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#1a1712` | app background |
| `--bg-2` | `#221e18` | raised: rails, header, panels |
| `--bg-card` | `#272219` | cards, modals |
| `--page` | `#211d17` | reading column behind DM prose |
| `--raise` | `#2e2820` | hover / nested surfaces |

### Ink — warm parchment text
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#ece4d6` | primary text / DM prose |
| `--ink-2` | `#b8af9b` | secondary text |
| `--ink-3` | `#988e77` | labels, metadata |
| `--ink-4` | `#7c7360` | faintest, still legible |

### Rules
| Token | Hex | Use |
|---|---|---|
| `--rule` | `#3a3328` | hairline borders |
| `--rule-soft` | `#2c2620` | softer dividers |

### Accents — used sparingly, with meaning
| Token | Hex | Use |
|---|---|---|
| `--accent` | `#c9a96a` | **manuscript gold** — primary action, emphasis |
| `--accent-d` | `#b1925a` | gold, pressed |
| `--accent-2` | `#8ba2c6` | muted ink-blue — secondary, info, links |
| `--selection` | `rgba(201,169,106,.20)` | text selection |

### Semantic game-state (all muted, inside the calm)
| Token | Hex | Meaning |
|---|---|---|
| `--good` | `#93b98a` | healthy HP, success |
| `--warn` | `#d8b46b` | bloodied HP, caution, **spoiler flag** |
| `--bad` | `#cf8478` | low HP, danger, damage |
| `--combat` | `#d2895a` | terracotta — combat flags, active turn |
| `--magic` | `#ab9fda` | muted violet — spells, concentration |

### Type families
`--serif: "EB Garamond", "Iowan Old Style", Georgia, serif`
`--sans: "Inter", system-ui, -apple-system, sans-serif`
`--mono: "JetBrains Mono", ui-monospace, "SF Mono", monospace`

### Type scale (primitive classes in tokens.css)
- `.display` 56px serif 500 / lh 1.04 / -.015em
- `.step` 44px serif 500 / lh 1.08
- `.section` 24px serif 500
- `.lede` 20px serif italic 400, color `--ink-2`
- `.help` 16px serif italic, `--ink-3`
- `.eyebrow` 11px Inter 600, uppercase, **.22em** tracking, `--ink-3`
- `.label` 11px Inter 600, uppercase, .18em
- button text: 12px Inter 600, uppercase, .14em
- `.mono` / `.num` tabular numerals

### Shadows & radii
- `--shadow: 0 1px 2px rgba(0,0,0,.35), 0 14px 44px rgba(0,0,0,.5)` (candlelit, deep)
- `--shadow-sm: 0 1px 2px rgba(0,0,0,.30), 0 4px 14px rgba(0,0,0,.32)`
- `--radius: 7px`, `--radius-lg: 11px` (cards/panels), buttons use `--radius`, pills use `999px`

### Background ambiance
`body.app-bg` adds two faint radial gradients (gold top-center ~.045 alpha, ink-blue bottom-right ~.03) — a barely-there candlelit lift. Reproduce as a subtle fixed background.

---

## Component vocabulary (defined in `tokens.css`)
Recreate these as reusable components; the screens are assembled almost entirely from them.

- **`.btn`** + variants `.primary` (gold, dark text), `.ghost`, `.danger`, sizes `.lg` / `.sm`, and `.btn-icon` (32×32 quiet icon button). Uppercase Inter, .14em tracking.
- **`.chip`** (pill) + `.on` (selected = gold) + semantic `.warn/.bad/.magic/.combat` tints. **`.tagpill`** = mono framed eyebrow pill.
- **`.panel`** (bg-2) and **`.card`** (bg-card) with `.panel-head` (icon + uppercase mono title + right meta) / `.panel-body`.
- **`.narr-card`** — narrative/scene card: 3px accent bar (left, or top via `.top`), an uppercase marker label, serif body. `.magic` / `.combat` recolor the bar. (This pattern recurs: DM scene cards, the campaign premise card, milestone moments.)
- **HP**: `.hpbar` / `.hptrack` with `.warn` / `.bad` fills; **resource pips** `.pip` / `.pip.full` / `.pip.magic`.
- **`.scene-break`** — hairline + centered asterism divider with optional italic label.
- **Overlays**: `.scrim` (fixed, blurred, z-80), `.modal` (460px card), `.sheet` (380px right slide-in).
- **Chrome**: `.dash-hdr` (sticky 58px header: wordmark · back · links · Opus indicator), `.wordmark` (serif "D&D", gold italic ampersand), `.opus` (mono indicator w/ glowing gold dot), `.page` canvas (max 1120px), `.page-eyebrow`, `.sec-head` (serif heading + fleuron rule), `.crest` (heraldic monogram tile w/ level badge).

---

## Screens / Views

> Routing map (hrefs used in prototypes):
> Roster → Create Character (wizard) → **Dashboard** (character home) → { Character Sheet, Companions, Campaigns, Campaign Plan, Backstory, Settings }. Campaigns → **Begin Campaign** → Cockpit (live session). Dashboard "Continue" → Cockpit.

### 1. Dashboard / Character home — `Dashboard.html`  ★ includes the new first-time tutorial
**Purpose:** the still place between sessions; resume play and reach every management screen.
**Layout:** sticky `.dash-hdr`; centered column `max-width 1120px`, padding `46px 28px 80px`.
- **Hero card** (`.hero`, bg-card, radius 14, 3px top gold bar): grid `auto 1fr auto` — a 92×92 **crest** (serif monogram + level badge) · identity block (name `EB Garamond 44px/500`, italic descriptor, campaign line) · CTA column (primary **Continue** + mono "last played" line). Below: **"Where you left off" recap** (uppercase label + serif 19px prose, gold italic emphasis on `<em>`). Footer: a **stat row** of pills (HP/AC/Speed/Ki pips/Gold/Session), HP in `--good`, gold in `--accent`.
- **Nav grid** (`.nav-grid`, 3 columns, 16px gap): six `.nav-card`s — Character Sheet, Companions, Campaigns, Campaign Plan (with amber **Spoilers** flag), Backstory, Settings. Each: 38px icon tile, serif 22px title, serif 15px description, a top-right arrow that slides + turns gold on hover; hover lifts `-2px` and warms the border toward gold.

#### First-time tutorial (the new work) — behavior in detail
A **welcome card → guided spotlight tour** that auto-runs the first time and is replayable.
- **Trigger / persistence:** on load, if `localStorage['hearth.dash.tour.v1']` is unset, auto-start after ~500ms. A quiet **"Replay tour"** link (Compass icon, gold) sits in the header and re-runs it anytime. Finishing or skipping sets the localStorage flag.
- **First-time hero framing:** while the tour runs, the hero is swapped into a *first-time* state — primary button reads **"Begin your first session"**, the mono line reads "Your tale begins now", and the recap label reads "Your opening scene". On finish it reverts to the steady "Continue" / "Last played…" / "Where you left off" state. (This is how the tutorial teaches *starting a campaign*: the same door becomes "Continue" every session after.)
- **Welcome card:** centered modal (452px, bg-card, 3px gold top bar). Opus indicator (gold orb + "OPUS"), serif 30px title ("Welcome to your hearth, Dravyr."), serif 17px body, foot buttons: ghost **"Skip for now"** + primary **"Show me around."**
- **Spotlight tour (6 steps):** the page dims to `rgba(11,9,6,.72)` and the target is ringed by a gold-glowing "spotlight" (a positioned box with `box-shadow: 0 0 0 9999px <dim>, 0 0 0 1.5px var(--accent), …glow`). A tooltip card (322px) shows step count (`❧ N of 6`), serif title, serif body, and **Skip / Back / Next** (Finish on last). Tooltip auto-flips above/below the target and is arrow-pointed. Order + copy (Opus's in-world voice):
  1. **Begin button** — "Your tale begins here." (begin/continue the session; how a campaign starts)
  2. **Campaigns card** — "Many roads, one wanderer." (begin new / switch / open the backstory seed)
  3. **Character Sheet card** — "Who you are, in full."
  4. **Companions card** — "Those who walk beside you."
  5. **Campaign Plan card** — "The world I keep." (explains the amber Spoilers veil)
  6. **Settings card** — "Set the weather of your story."
- **Keyboard:** ← / → navigate, **Esc** dismisses.
- **CRITICAL implementation detail (learned the hard way):** the spotlight ring must **not** animate its position when it is first revealed, when the page scrolls a target into view, or on resize — only animate the slide between two already-visible steps. In CSS-transition terms: set `transition: none` for reveal/scroll/resize repositions (write geometry, force a reflow, then restore the transition), otherwise the ring gets pinned at a stale position during smooth scrolling. In a React/Popper implementation, the equivalent is: don't transition `top/left` during scroll-follow; only tween on deliberate step changes. Verify the ring lands exactly on each target (including below-the-fold targets that require scrolling).

### 2. Begin a new Campaign — `Begin Campaign.html`  ★ new
**Purpose:** start a campaign as a **conversation with Opus**, who authors the world while the player sets the mood. Reached from Campaigns ("Begin a new campaign" button + the backstory "New seed" card).
**Two states** (toggled by `body.mode-open` vs `body.mode-compose`; `#start` hash boots the greeting):

**A · Greeting (entry).** Single hero card (bg-card, 3px gold bar). Top row: Opus orb + "OPUS" with a right-aligned **"Creating for Dravyr Wyrmrest"** context line (mini-crest + name). Campaign creation is **always scoped to the character you entered through** — there is no character/world choice (campaigns are created from within a character's context). Serif 33px headline ("Every campaign begins as a single sentence. Tell me yours."); serif 18px sub with gold-italic emphasis. Then:
- **"What do you want to play?"** (primary entry) — a large serif textarea (italic placeholder) with a primary **"Begin with Opus"** send button bottom-right.
- **"Not sure where to begin? Start from a thread I drew from Dravyr"** — 2 seed cards: **a character-grounded seed** ("The high passes", tagged *From your background · Hermit*) and **"Surprise me"** (tagged *Opus's choice* — "I'll conjure an adventure from nothing, and we'll shape it together").

> **Seeds — source of truth:** seeds are **Opus-generated premises grounded in the strongest narrative thread on the character sheet**, and each seed *names the thread it pulled from* so the player sees why it was suggested. Do **not** assume a rich freeform "backstory" field exists (it's thin in the creator). Pull from: **background/theme** (e.g., 5e Hermit's *Discovery*), **class/subclass fantasy** (Monk → monasteries), and **personal details** (alignment, the character quote). "Surprise me" is a *generate-from-scratch* action, not a pre-existing draft.

Sending the prompt or choosing a seed → switches to Compose.

**B · Compose (the atelier).** Two-column grid `1fr 372px`, 30px gap, with a sticky commit footer.
- **Left — the dialogue thread** (`max-width 660px`): title "Opus is writing *The Debt of Snows*" (gold italic campaign name) + sub. A vertical thread of **turns**:
  - *Opus turns*: 28px gold orb + uppercase mono "OPUS" speaker label + **serif 18px prose** (gold-italic `<em>`). This is manuscript prose, not chat bubbles.
  - *You turns*: right-aligned quiet note card (bg-2, 2px gold left border, serif italic 15.5px) with a mono "YOU ASKED FOR" label.
  - **Premise card** (`.premise-card`): bg-card, 3px gold top bar, "THE PREMISE" marker + a "Spoilers veiled" tagpill, serif 30px campaign title, serif 17px premise prose, and a meta chip row (region/scope/genre/tone).
  - **Opening-scene preview** (`.scene-card`): `--page` surface; a context strip (location tagpill + "dusk · first snow" italic tagpill); "Opening scene — read aloud" italic direction; serif 18px prose with a gold **drop-cap**.
  - A thinking indicator (3 pulsing gold dots) shows while Opus "responds".
- **Composer** (below thread): a **Nudge** row of chips — *Darker · More hopeful · Raise the stakes · Keep it intimate · Make it a one-shot · Regenerate* (gold) — plus a serif textarea + 40×40 primary send. Clicking a nudge appends a "You" note + a scripted Opus reply and updates the rail. ⌘/Ctrl+Enter sends the free text.
- **Right rail** (`.rail`, sticky `top:78px`):
  - **"The shape of it"** panel ("Set by Opus" badge): **Scope** segmented control (One-shot / **Short arc** / Ongoing campaign); **Genre & tone** — a summary of selected chips with a **"Change"** link that expands an inline palette grouped Genre/Tone (multi-select; the summary updates live); **Setting** value tile (MapPin) with an **"Edit"** link that expands inline name + descriptor inputs plus a **"Let Opus reimagine"** action (saving updates the setting tile, the premise's region chip, and the plan-forming Region row); **Your party** — the hero only (Dravyr), with the note *"You set out alone — companions join as the story finds them"* (pre-picking companions is intentionally **out of scope for v1**); **Difficulty & the DM** ("Inherit from Settings" toggle + a value tile); **Content boundaries** — a button (count badge) that opens a **modal**: each sensitive topic (gore, character death, harm to children, torture, romance, substance, body horror, slurs) gets a three-state control **Open / Veil / Line** (Open = shown in full · Veil = happens off the page · Line = never appears), with a legend and a live "N set" count. This is the classic *lines & veils* safety tool.
  - **"Campaign plan · forming"** mini-panel: Region / Locations / Named NPCs / "The truth → behind a veil".
- **Sticky commit footer** (`.commit`, blurred): left = "Draft autosaved…"; right = campaign title + primary **"Begin the first session."**
- **Cinematic Begin:** pressing Begin reveals a full-screen near-black overlay (`#0d0b07` + faint gold radial). Staged fade-ins: mono eyebrow "Session 1 · The Cinderpeak Reach" → serif **64px** title → italic 21px opening line → a mono "Opus is setting the scene" status with the pulsing dots. After ~4.2s (or a "Skip →" button) it **navigates into the live session** (Cockpit). Respect `prefers-reduced-motion`.

### 3. Live session cockpit — `Cockpit - Calm.html` (dialogue) & `Cockpit - Combat.html` (initiative live)
**Purpose:** the 90% screen — playing with the AI DM. Calm = narrative/dialogue; Combat = initiative order, turn tracking, the party panel. The most complex screens; treat their inline `<style>` as authoritative. The DM prose reads in a `--page` reading column; a right rail holds party/resources/initiative.

### 4. Character Sheet — `Character Sheet.html`
5e sheet with **Overview** and **Progression** tabs (click tabs inside). Abilities, features, spells, equipment.

### 5. Supporting screens
- **Companions.html** — allies traveling with the character (campaign-specific roster).
- **Campaigns.html** — the active campaign "feature" card + other/seed campaigns + "Begin a new campaign" (→ Begin Campaign).
- **Campaign Plan.html** — the world bible Opus wrote; **spoiler veil** pattern (blurred `.veil` content with a "Reveal" affordance — `filter: blur(7px)` → none).
- **Backstory.html** — origin parsed into people/places/hooks.
- **Settings.html** — difficulty, tone, and DM behavior dials & rules.
- **Level Up.html** — level-up wizard (uses `_lu3.png`).
- **Create Character.html** — 8-step guided wizard (Identity · Ancestry · Theme · Class · Abilities · Equipment · Details · **Review**) with a sticky step-ribbon (`.wiz-chrome`/`.ribbon`), a sticky Back/Next footer (`.wiz-foot`), and an editable Review step. Internal nav via hashes (`#identity`, `#theme`, `#details`, `#review`).

---

## Interactions & behavior (summary)
- **Navigation:** standard links between screens (see routing map). The persistent `.dash-hdr` carries the wordmark, a back link, contextual links, and the Opus indicator.
- **Hover:** cards lift `translateY(-2px)` and warm their border toward `--accent`; arrows slide + turn gold; buttons shift surface/border per `.btn:hover`. Transitions ~`.14–.16s`.
- **Tutorial:** localStorage-gated auto-run, spotlight + tooltip, keyboard nav, replay link, first-time hero swap (see §1).
- **Begin Campaign:** state toggle (greeting/compose), scripted Opus replies to nudges + free text, live-updating rail dials, cinematic begin → route to session (see §2).
- **Spoiler veil:** blur + reveal-on-demand (Campaign Plan).
- **Wizards:** step ribbon + sticky footer + Review-with-edit (Create Character; Level Up).
- **Reduced motion:** entrance animations and the cinematic sequence should degrade to their visible end-state under `prefers-reduced-motion`.

## State management (what a real build needs)
- **Tour:** `hasSeenDashboardTour` (persisted); `tourActive`, `tourStage` (`welcome | 0..5 | end`); derived `firstTimeHero` boolean. Replay resets stage, keeps the persisted flag set.
- **Begin Campaign:** `mode` (greeting/compose); `chosenSubject` (character id | "world"); `seed`; `prompt`; conversation `turns[]`; draft `{ title, premise, openingScene, region, locations, npcs }`; dials `{ scope, tones[], setting, party[], inheritSettings, linesAndVeils[] }`. On Begin → create campaign, mark active for the character, navigate to session. (In the prototype Opus's replies are **scripted**; in production these are model calls — see below.)
- **Session/sheet/settings:** standard per-feature state (HP, resources, initiative order, sheet fields, settings dials).

## "Make it real" notes
- The Opus dialogue in Begin Campaign is **scripted canned text** in the prototype. In production, wire it to your model endpoint: the user's prompt + dial state → a structured campaign draft (title, premise, opening scene, region, NPC count, hidden "truth"), with nudges as follow-up turns that patch the draft. Keep the *manuscript prose* presentation regardless of source.
- Persist drafts ("autosaved to Dravyr's home").

## Assets
- **Fonts:** EB Garamond, Inter, JetBrains Mono (Google Fonts URL above).
- **Icons:** Lucide (use `lucide-react`/equivalent; mapping table above). Do not ship the inline SVG sprites.
- **Raster:** `_lu3.png` — the only image, used on Level Up. Everything else is type + tokenized surfaces; "crest" monograms are serif letters on a gradient tile.
- **No third-party brand assets.** "D&D"/Dungeons & Dragons naming in the mock is placeholder product chrome — use your own product's branding/legal-approved naming in the real app.

## Files in this bundle
- `tokens.css` — **the design system. Port this first.**
- `Dashboard.html` — character home **+ first-time tutorial**
- `Begin Campaign.html` — **conversational campaign creation** (greeting + compose + cinematic begin)
- `Cockpit - Calm.html`, `Cockpit - Combat.html` — live session cockpit
- `Character Sheet.html`, `Companions.html`, `Campaigns.html`, `Campaign Plan.html`, `Backstory.html`, `Settings.html`, `Level Up.html`, `Create Character.html`, `Roster.html`, `Roster - Empty.html`
- `_lu3.png` — Level Up image asset

> Tip for the implementer: open each HTML file directly in a browser to see the live, interactive reference while you build. Build the **token layer and shared components first**, then assemble screens — that ordering is what guarantees the result matches the references.
