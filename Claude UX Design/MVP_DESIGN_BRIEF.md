# Design Brief for Claude Design — "Hearth" (D&D solo MVP)

*Paste this whole document into a new claude.ai/design conversation. Optionally attach the existing prototypes from `Claude UX Design/D&D Meta Game (Remix)/` — `Session Hi-Fi.html` and the three `Character Sheet *.html` files — as **layout/data references only** (their dark-gaming styling is being replaced; see §1).*

---

## 0. What you're designing

A **single-player Dungeons & Dragons app** where one person plays one character and **Claude (Opus) is the Dungeon Master**. The player types what they do; the AI writes the world, the NPCs, the combat, the story. It is played **solo, on desktop, for hours at a time, and ideally for years** with the same character.

So this is, above everything, a **reading and writing app** dressed as a game. The DM's prose is the product. Mechanics (HP, dice, conditions, initiative) exist to support the story, never to crowd it.

Your job: design the **hi-fi screens** for this app in HTML/CSS (your usual prototypes). A coding agent will then rebuild them in React. Design the *visual output* — the agent handles the code. Build a small, coherent **design system** first, then the screens, so everything feels like one world.

**Platform:** desktop only, ~1440px wide. No mobile/responsive needed. No CSS framework (the agent uses plain CSS + React).

---

## 1. The aesthetic — "dark editorial"

The look is **editorial, literary, restrained — but warm and dark**, tuned for reading prose at night for hours without fatigue. Think an *illuminated manuscript read by candlelight*, or a beautiful dark-mode reading app (iA Writer / Instapaper dark), not a flashy game UI.

This app already has a **light** editorial design system used in its character-creation flow (EB Garamond serif, cream paper, hairline rules, almost no color). **We are keeping that system's soul — the typography, the restraint, the component vocabulary — and translating it into a warm dark palette** so the in-session reading screens are easy on the eyes over long sessions. The whole app (session, character sheet, dashboard, creator) should ultimately feel like one cohesive editorial world.

**Design principles (in priority order):**
1. **Prose is the hero.** The DM's narrative gets the best typography, the most space, the calmest surroundings. Everything else recedes.
2. **Restraint.** One serif for prose + headings, one sans for labels/chrome, one mono for numbers/dice. Hairline 1px rules, soft shadows, almost no border-radius, color used *sparingly* and only with meaning.
3. **Chrome fades, content breathes.** Buttons, stats, and panels are quiet and low-contrast until you need them. Generous whitespace and line-height.
4. **Durable, not trendy.** This will be used for years. No effects that will feel dated; legibility and calm over novelty.

### Starting palette (refine for contrast/legibility as you design)

```
/* surfaces — warm near-black, like dark aged paper */
--bg:        #1a1712   /* app background */
--bg-2:      #221e18   /* raised surfaces: rails, header, panels */
--bg-card:   #272219   /* cards, modals */
--page:      #211d17   /* the reading column behind DM prose (subtle lift) */

/* ink — warm parchment text */
--ink:       #ece4d6   /* primary text / DM prose */
--ink-2:     #b0a892   /* secondary text */
--ink-3:     #79725f   /* labels, metadata, the quiet stuff */

/* rules */
--rule:      #383228   /* hairline borders */
--rule-soft: #2b261e   /* softer dividers */

/* accents — used sparingly */
--accent:    #c9a96a   /* muted manuscript gold: primary action, markers, emphasis */
--accent-2:  #8ba2c6   /* muted ink-blue: secondary/info/links */
--selection: rgba(201,169,106,.20)

/* semantic game-state colors — all muted so they sit inside the calm */
--good:   #93b98a   /* healthy HP, success */
--warn:   #d8b46b   /* bloodied HP, caution */
--bad:    #cf8478   /* low HP, danger, damage taken */
--combat: #d2895a   /* terracotta: combat flags, active turn */
--magic:  #ab9fda   /* muted violet: spells, concentration */

--shadow: 0 1px 2px rgba(0,0,0,.35), 0 14px 44px rgba(0,0,0,.5);
```

This is a **starting point** — please refine the exact values for comfortable, accessible contrast (parchment ink on warm dark). The intent: warm, low-glare, gold/ink accents, never neon.

### Typography (carry over from the existing editorial system)

- **`EB Garamond`** (serif) — **all prose**: DM narrative, headings, character descriptions, lede/subtitle text, italic emphasis. This is the voice of the app.
- **`Inter`** (sans) — UI chrome only: labels, eyebrows (uppercase, tracked-out), buttons, navigation, metadata, numeric stat values.
- **`JetBrains Mono`** (mono) — technical/quiet: dice rolls, system/mechanics lines, initiative order, numbers, timestamps.

Type scale to reuse (from the creator system): display 56 / step 44 / section 24 / lede 20 italic / body 18 (line-height 1.6) / help 16 italic / eyebrow 11 uppercase letter-spacing .22em / label 11 uppercase .18em / button 12 uppercase .14em. **For DM prose specifically, go a touch larger and airier — ~18–19px, line-height ~1.7, measure capped at ~660–700px** for comfortable reading.

### Component vocabulary to define (a shared mini-system)

Buttons (`default` / `primary` (gold) / `ghost` / `danger`, plus `lg`); chips/pills (default + `on` selected state, used for conditions/tags/quick-rolls); cards and panels (1px `--rule`, soft shadow, `--bg-card`); the **narrative card** and **celebration card** patterns from the creator (a card with a 3px accent bar on the top or left edge, an uppercase sans "marker" label, and serif body — reuse these for DM scene cards and milestone moments); eyebrow/section labels; hairline dividers (`.hr`); HP bars; stat blocks; tab rails; left/right **rails** for the cockpit; modal/overlay sheet. Keep them all in **one tokens + components stylesheet** that every screen shares.

---

## 2. The screens — what to design, in priority order

> Scope note: this is a deliberately **lean MVP**. Do **not** design merchants/shops, crafting, party bases/strongholds, mythic progression, weather/survival meters, faction/quest trackers, world-event feeds, or a "DM Mode." Those were removed. The list below is the whole app.

### ★ TIER 1 — The In-Session DM Cockpit  *(the 90% screen — give this the most love)*

This is where the player lives. A **three-column cockpit** on a warm dark canvas. (The existing `Session Hi-Fi.html` has a good three-column *layout* — ~248px left rail / fluid center / ~296px right rail — reuse that **structure and data density**, but restyle entirely in dark-editorial and drop the cut features.)

**Center column — the reading stage (the star):**
- A slim **context strip** at top, always visible: campaign name · current location (uppercase serif, italic) · an in-combat indicator when active · the in-world date/time. (No weather, no survival.) Quiet and persistent so the player always knows *where/when* they are.
- The **narrative transcript**, a single scrolling reading column (~660–700px measure, centered in the column):
  - **DM narration** — EB Garamond, generous, left-aligned, the most beautiful text on screen. **NPC dialogue** set apart (e.g. gold-tinted italic or a subtle left rule) so speech reads differently from description.
  - **Player actions** — visually distinct but a sibling, not a chat bubble: a quieter, slightly indented entry with a small "you" marker; smaller than the DM prose (the player writes briefly, the DM writes at length).
  - **System / mechanics lines** — centered, small, JetBrains Mono, very quiet: dice results, damage (muted green/red), "items added," "leveled up," combat start/end. They should feel like margin notes, not interruptions.
  - **Scene breaks** — an understated decorative divider (a hairline with a centered ornament/glyph) between major beats.
- The **composer** at the bottom — make it feel like a *writing surface*, not a chat box: a calm serif textarea with a soft focus state, a quiet "What do you do?" prompt, a primary **Send** (gold) and an unobtrusive row of quick-roll chips (d20 / Advantage / Disadvantage / Save). Sending should feel like turning a page.

**Left rail — the party at a glance:**
- The **player character** card + any **companions**: small portrait/monogram, name, a thin **HP bar** (good/warn/bad color by health), and condition tags (e.g. *concentrating, poisoned, prone*). Active-turn indicator during combat. Click → opens that character's sheet/quick-ref. (No quest panel — cut.)

**Right rail — mechanics within reach (so the player never leaves the prose):**
- **Initiative / combat tracker** (appears in combat): round number, the turn order mixing party + enemies, the active combatant highlighted (terracotta), already-acted entries dimmed/struck.
- **Active effects / concentration**: buffs/debuffs with remaining duration.
- **Quick rolls / dice**: d20, advantage/disadvantage, saving throw, with the last roll's breakdown shown in mono.

**Top header bar:** session title · a small **Opus** model indicator · spell-slot quick view · short-rest / long-rest buttons · toggles to open panels (Character sheet · Party · Notes · Inventory · Conditions) · **End session**. All low-contrast, recessive.

**Slide-in panels / overlays** (design as a consistent panel family — a dark-editorial sheet that slides from the right or overlays center): **Inventory** (carried items + equipped, quantities, gold), **Conditions** (toggle + plain-language description of each), **Campaign Notes** (the player's own running notes — a quiet writing surface), **Quick Reference** (the character's key stats + known/prepared spells + a rules cheat-sheet), **Companions** (party overview).

**Modals** (one shared modal style — centered sheet, serif heading, soft shadow): **companion recruitment** ("Recruit [Name]?"), **end-session** (three choices: Pause / Complete / Abort), **session rewards** recap (XP + gold gained, shown like a quiet ledger), and a **level-up available** nudge.

**A note on states to mock up:** show the cockpit (1) in calm exploration/dialogue, and (2) mid-combat (initiative populated, a condition or two active, a damage line in the transcript). These two states prove the design.

### TIER 2 — Dashboard chrome & navigation

The shell around everything when a character is selected. A **persistent header** (serif "D&D" wordmark with the gold ampersand · a "← Your characters" back affordance · Settings · an AI-Behavior/diagnostics link · the Opus indicator) and a **character home** landing: a prominent **"Continue your adventure" / Play** entry, plus quiet navigation to Character Sheet, Companions, Campaigns, Campaign Plan, Backstory, Settings. Today this is raw and clashes with the editorial creator — bring it fully into the dark-editorial system so returning from creation feels seamless.

### TIER 3 — Character Sheet

A full D&D 5e sheet with tabs: **Overview · Abilities & Skills · Features & Traits · Progression · Spells · Equipment · Inventory · Background.** Restyle in dark-editorial: serif tab/section headings, hairline rules, calm stat blocks; keep the dense functional grids (ability scores, skills with proficiency dots, spell-slot tracker, attacks with to-hit/damage) but make them legible and quiet, not bootstrap-y. The **Progression** tab is real and kept: it shows the character's **theme** (a 4-tier "background" replacement with tier abilities), **ancestry feats**, and — for the Knight theme — a **moral path**. Design **Overview** and **Progression** fully; the others can follow the same patterns. *(The existing `Character Sheet *.html` files show good data layouts for Stats/Combat/Spells — reuse the information design, replace the gaming styling.)*

### TIER 4 — Supporting screens (lighter touch, same system)

- **Settings overlay** — already close to editorial; refine. It's a calm centered sheet with a couple of "dial" controls (e.g. Survival intensity is removed, but a difficulty/intensity dial pattern may remain) and an apply-on-click + "saved" affordance. Use it as the template for the modal/overlay family.
- **Level-Up flow** — a short multi-step sheet (class → HP roll/average → ability-score-improvement or feat → subclass → spell choices). Editorial wizard styling (it can echo the creator's step rail).
- **Campaigns** — list of the player's campaigns + a detail view (name, level, premise, the Opus-generated world plan).
- **Campaign Plan viewer** — the AI-generated world bible shown as tabbed, *spoiler-toggled* read cards (World / Locations / NPCs / lore). Read-only, literary.
- **Backstory Parser** — a page that shows the player's backstory broken into structured elements (characters, places, hooks) they can edit.
- **Companions** — roster of companions + a builder form for recruiting/creating one.

---

## 3. Deliverables & how this gets used

- Produce **hi-fi HTML/CSS prototypes** (your normal medium) — self-contained, desktop ~1440px, populated with the realistic sample content below so they look real, not lorem-ipsum.
- Start with a **shared `tokens.css`/components** file (palette, fonts, type scale, buttons, chips, cards, rails, panels, modal) and have every screen import it, so the system is consistent and the coding agent can lift it directly.
- Then the screens in priority order: **(1) the in-session cockpit — calm state + combat state, (2) the dashboard chrome, (3) the character sheet (Overview + Progression), (4) the modal/overlay family + level-up.** Tier 4 screens after.
- When the user exports the handoff bundle, a coding agent rebuilds these in **React (no CSS framework)**. So: favor a clean token system and reusable components; match the *visual output* — the agent won't copy your HTML structure.
- If anything's ambiguous, ask the user before going deep — one screen built right beats five built wrong.

---

## 4. Realistic sample content (use this to populate the mockups)

**Character:** *Dravyr Wyrmrest* — Level 3 Monk, wood elf, Hermit theme. AC 15 · HP 24/27 · Speed 40ft · Gold 112 gp. Abilities: STR 12, DEX 17, CON 14, INT 10, WIS 16, CHA 8. Ki points 3/3.

**A companion:** *Sister Veil* — Level 3 Cleric, human, HP 19/22, *concentrating* on Bless.

**Sample DM narration (center stage):**
> The street opens onto a poor quarter's square — a dry fountain choked with leaves, a shuttered fishmonger's stall, a shrine to some harbor-god worn faceless by salt and hands. An old woman sits on the fountain's lip, a basket of mended nets at her feet, a hooked needle still in her fingers though it's far too dark to work by.
>
> *"Troubles,"* she says, turning the word over like a coin she suspects is false. *"You're not from the Gate. What's it to you, what troubles us?"*

**Sample player action:**
> I crouch to her eye level and offer the half-loaf from my pack. "No. I'm just passing through — but I've been hungry in a strange town before."

**Sample system lines (quiet, mono):**
`⟡ Insight check — DC 13 → you rolled 18. She's testing you, not threatening you.`
`⚔ Combat begins — roll for initiative.`
`✦ Dravyr takes 5 piercing damage — HP 19/27.`

**Sample conditions:** Poisoned · Prone · Exhaustion 1 · Concentrating (Bless).

**Sample inventory:** Quarterstaff · Shortbow + 20 arrows · Explorer's pack · Healer's kit (3 uses) · Potion of Healing ×2 · Hermit's herbalism notes · 112 gp.

**Sample initiative order (combat):** Sister Veil 19 · **Dravyr 17 (active)** · Bandit Archer 14 · Dravyr's quarry, the Hollow Man 11 · Bandit Brute 8.

---

*End of brief. The north star: when the user sits down at midnight to read what the Dungeon Master wrote, the screen should feel like opening a beautiful book — warm, quiet, and effortless to read — with the dice and the character sheet a calm glance away.*
