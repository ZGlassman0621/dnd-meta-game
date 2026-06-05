# Phase 2 Creator Spec — Drafted Content (Carry Forward)

This document captures all player-facing copy that was drafted and confirmed during the per-step creator spec walkthrough in the previous PM chat (2026-04-30 through 2026-05-02). Carry these verbatim into the spec doc — they were authored carefully, audited for in-fiction voice, and confirmed by the user.

The new PM chat will author the additional content the spec calls for (21 starting gold modifiers, ~252 personality/ideals/bonds/flaws prompts, ~170 curated backstory moments). This document is for the content that is *already* drafted and locked.

---

## Step 1 (Identity) — Drafted Copy

### Use-name affordance (handoff mode, when payload's `name` differs from `setup_name`)

> ***[setup_name]*** *was the name you began with. Through what you did, you came to be known as **[use_name]**. How does [she/he/they] carry forward?*
>
> [Keep "[use_name]"] [Revert to "[setup_name]"] [Write something new]

Pronoun chosen from gender field; "they" if not yet selected.

### Help text below name fields

> *Some peoples don't use family surnames. Leave Last name blank if that fits. Nickname is optional and only shown in informal contexts.*

### Help text below nickname (specifically)

> *If you have one — what people call you informally.*

### Help text below gender

No help text. Two options (Female/Male), self-explanatory.

---

## Step 2 (Ancestry) — Drafted Copy

### Help text below race (manual mode)

> *Your species and heritage. This shapes your starting traits, languages, and the heritage gift you carry from your lineage.*

### Help text below subrace (when shown)

> *A subgroup within [Race] — distinct upbringing, distinct gifts.*

### Help text below ancestry feat (manual mode)

> *A heritage gift — a small mechanical advantage that comes with your lineage. Choose one.*

### Help text below Variant Human bonus general feat (when shown)

Variant Human's bonus feat lives in Step 5, not Step 2. Help text for that is in the Step 5 section below.

### Celebration card template (handoff mode)

Shape 1 — full inline reasoning panel with chapter beats.

> *In the years that shaped you, you:*
> - *[chapter beat 1, one sentence with chapter reference]*
> - *[chapter beat 2, one sentence with chapter reference]*
> - *[optional chapter beat 3]*
>
> *You are **[Race, with subrace if applicable]**.*
>
> *Your heritage gift: **[Ancestry Feat Name]** — [feat one-line description].*
>
> *[Sub-choice picker if applicable — sub-choices stay free in handoff mode per Decision α]*

Chapter beats from `[ANCESTRY_HINT].reason` markers (chunk 4 expansion). Top 2-3 selected by chapter weight, ordered chronologically (Ch1 → Ch2 → Ch3).

---

## Step 3 (Theme) — Drafted Copy

### Help text below theme dropdown (manual mode)

> *Your lived experience — the formative work, training, or trial that shaped who you are before you take on a class. Theme expresses what you care about, what you've done, and what you bring to whatever comes next.*

### Knight of the Order path-explanation paragraph (manual mode only)

Appears below the standard theme description when `theme = knight_of_the_order`:

> *As a Knight of the Order, your path begins true to your vows. How that path bends — whether you remain true, reform, fall, or redeem — emerges through what you do in the world.*

### Celebration card template (handoff mode, all 19 emergence-eligible themes)

Note: knight_of_the_order and haunted_one are excluded from Prelude emergence per Decision D. Only 19 themes can arrive via handoff mode.

> *In the years that shaped you, you:*
> - *[chapter beat 1, one sentence with chapter reference]*
> - *[chapter beat 2, one sentence with chapter reference]*
> - *[optional chapter beat 3]*
>
> *You take up your calling: **[Theme Name]**.*

Chapter beats from `[THEME_HINT].reason` markers (chunk 4 expansion). Same selection logic as ancestry feat.

---

## Step 4 (Class & Calling) — Drafted Copy

### Help text below class (manual mode)

> *Your profession or training — what you do when the situation calls for action. Class shapes your abilities, growth path, and how you engage with combat, magic, and skill checks.*

### Help text below subclass (when shown)

> *A specialization within [Class] — the particular path you've chosen, with its own abilities and flavor.*

### Narrative-continuity copy lines (handoff mode, 19 themes)

These are the bespoke per-theme copy lines that surface above the class dropdown in handoff mode. Each is anchored to the theme's `identity` text from `themes.js`. The card sits *above* the dropdown; the dropdown stays free (pre-filled with `[CLASS_HINT]` tally winner, freely overridable).

knight_of_the_order and haunted_one have NO entry — they can't arrive via handoff mode.

#### 1. soldier

> *You've held the line, marched in formation, taken orders and given them. The discipline is in your bones — now choose how you'll bring it to a wider fight:*

#### 2. sage

> *Years in study halls, archives, and dusty libraries have given you a mind that catalogues everything and forgets nothing. The knowledge is yours — now choose how you'll wield it:*

#### 3. criminal

> *You learned the city's underside the hard way — which doors give, which hands take, which alleys swallow people whole. The skills are sharp — now choose what to do with them:*

#### 4. acolyte

> *Years of devotion, ritual, and quiet labor in service of a faith have shaped how you move through the world. The calling is rooted — now choose how you'll answer it:*

#### 5. charlatan

> *You've worn a hundred faces and made each one believable. The art of becoming someone else is yours — now choose who you'll be when the lie has to hold:*

#### 6. entertainer

> *Stages, taverns, market squares — wherever you've performed, you've felt people lean in or turn away. You know what moves them. Now choose what you'll move them toward:*

#### 7. noble

> *Born to privilege, raised among people who command others without raising their voice. The expectation of authority is in the way you walk and speak. Now choose how you'll exercise it:*

#### 8. outlander

> *The wild raised you. You know your forest, your mountain, your steppe — its silences, its cycles, the particular way it kills the unprepared. The wilderness is yours, but only the part you call home. Now choose how you'll carry it into wider lands:*

#### 9. sailor

> *Salt in your skin, the deck under your feet, the company of people who knew that survival was shared. The sea taught you what it taught — now choose what you'll do on land:*

#### 10. far_traveler

> *You came from somewhere far away, and everywhere you go you're an outsider — but an outsider sees what locals miss. You carry a wider world inside you. Now choose how you'll use what you see:*

#### 11. guild_artisan

> *You served apprenticeship under a master, learned a craft to a standard the guild would accept, and earned the right to call yourself a maker. The trade is yours, the network is yours. Now choose how you'll take both into the wider world:*

#### 12. clan_crafter

> *Your craft was taught not by a guild but by your kin — passed from hand to hand, generation to generation, in patterns older than any city's commerce. The work is heritage. Now choose how you'll carry the line:*

#### 13. hermit

> *You withdrew from the world to find what couldn't be found in it. Years of solitude sharpened your inner edge — and gave you something to bring back. Now choose how you'll carry it among people again:*

#### 14. investigator

> *You learned to read what other people overlook — a scuffed boot, a witness's hesitation, the gap between what's said and what's true. The case-shaped mind is yours. Now choose what you'll bring to the cases that matter:*

#### 15. city_watch

> *You walked the same streets every shift, knew which doors opened, which alleys ran into trouble, which neighbors were lying when they said they hadn't seen anything. The city is in your bones. Now choose what you'll do when the city's edges aren't enough:*

#### 16. mercenary_veteran

> *You've fought for coin in more places than most people see in a lifetime. The contracts taught you what loyalty is worth and what it isn't. The skill is real, the scars are real. Now choose what you'll fight for next:*

#### 17. urban_bounty_hunter

> *You hunt people. You've learned to read a stride from across a square, to find the room someone doesn't want you in, to wait three days for the moment that breaks them. The instincts are sharpened. Now choose how you'll use them when the marks are bigger than they were:*

#### 18. folk_hero

> *Something you did got remembered. Maybe you stood up to a tyrant, or saved someone everyone had given up on, or just refused to back down when others did. The story is yours, whether you want it or not. Now choose what you'll do with the weight people have given you:*

#### 19. urchin

> *You learned to be small, quiet, invisible — the kind of someone people's eyes slide past without registering. You ate when you could, slept where you could, and watched everything. The street made you. Now choose what you'll do with the lessons it taught:*

### Themes excluded from Prelude (no narrative-continuity copy)

- **knight_of_the_order** — manual mode only per Decision D
- **haunted_one** — manual mode only per Decision D

---

## Step 5 (Ability Scores) — Drafted Copy

### Bump celebration card (handoff mode, when bumps exist)

> *Two moments hardened you:*
> - *[chapter beat 1] — +1 to assign*
> - *[chapter beat 2] — +1 to assign*
>
> *Choose where each shows.*
>
> [Bump 1: STR ▾] [Bump 2: CON ▾]

Dropdowns let the player pick the target stat for each bump. As they choose, displayed ability scores update to show base + racial bonus + bump = total.

Per Decision E: bumps cap at 18 at L1 (standard 5e cap before ASIs). The Mythic-tier cap raise (20→22) is out of Phase 2 scope.

### Help text above generation method

> *Choose how to set your six ability scores. Standard Array gives you six fixed values to assign; Manual lets you enter custom scores within allowed ranges.*

### Help text above skills picker

> *Skills you're proficient in. Each skill ties to one of your six abilities — pick the ones you've practiced or trained.*

### Help text above Variant Human bonus feat (when applicable)

> *Variant Humans choose a general feat at the start of their journey — a self-taught skill or talent that defines you apart from your lineage. Some feats have prerequisites; only feats you qualify for are shown.*

### Standard Array UX direction for Claude Design

> Standard Array assignment uses a six-value pool: 15, 14, 13, 12, 10, 8. Each value assigned to exactly one ability. Dropdown-per-score (the existing creator's pattern) creates mental tracking burden — Claude Design should propose a draggable-chip or assignable-pool treatment that makes available values visible at a glance and assigned values bound to their ability. Existing dropdown logic remains as fallback if implementation is meaningfully complex.

---

## Step 6 (Equipment) — Drafted Copy

### Help text above class equipment

> *Choose your starting equipment. Most callings offer two equipment packages — pick the one that fits how you'll engage the world.*

### Help text above starting gold display

> *What you're bringing in coin from your previous life into the road ahead.*

Displayed as: "Starting gold: 75 gp (Soldier baseline 50gp + Theme adjustment +50%)" or similar. No interaction; calculated from class baseline × per-theme modifier.

### Heirloom callout (handoff mode, when candidates exist)

> *In the years behind you, [N] objects came into your hands. Carry one of them forward — or leave them all behind, if you'd rather travel light.*

### Heirloom opt-in prompt (manual mode)

> *Some travelers carry an heirloom — a sword from their grandfather, a book stolen from the library they grew up in, a piece of jewelry their mother wore. An heirloom is real gear in your hands now, and may reveal greater meaning over time as your story unfolds. Add an heirloom?*
>
> [Add an heirloom] [Skip]

### Heirloom authoring form (manual mode, after opt-in)

Fields:
- **Name** (text, e.g., "Arven's Blade" or "The Whitestone Codex")
- **Type** (curated select): Weapon / Armor / Book or Tome / Jewelry / Tool / Trinket / Other
- **Specific item type** (conditional on type):
  - Weapon: select from `equipment.json` weapons (sets baseline combat stats)
  - Armor: select from `equipment.json` armor (sets baseline AC)
  - Book/Tome: free text or focus item if the player's class accepts spellcasting focus
  - Tool: select from `equipment.json` tools (artisan tools, instruments, etc.)
  - Jewelry: free text (no underlying equipment baseline)
  - Trinket: free text
  - Other: free text
- **Description** (textarea)
- **Awakening hook** (optional textarea)

### Help text below awakening hook field

> *Optional. If you have a sense of what could draw out this object's deeper meaning — a place, a person, a moment — describe it here. Leave blank if you'd rather let the object find its own time.*

### Heirloom mechanical and prompt-side behavior

- Mechanical baseline: standard stats for the underlying item type. A heirloom longsword does longsword damage; a heirloom shield grants standard shield AC. No L1 mechanical bonus from heirloom-ness.
- `is_heirloom` tag on inventory item — distinguishes from regular inventory in UI and AI prompt context.
- Awakening: awakening_hook field captured at creation time and persisted; awakening mechanism deferred to follow-on phase.
- AI prompt-side handling: heirloom is given as deep context, not narrative pressure. Awakening hook (when present) is recognized when earned by the wider story, never insisted upon. Same guidance shape as `[CANON_THREAD]` ripening.

### Prompt instruction draft for chunk 3/5 prompt builder

> *The character carries one or more heirloom items, each of which may have an awakening_hook describing a narrative condition under which the item could reveal greater meaning. These hooks are deep context for your understanding of the character's story, not beats to play toward. Recognize them when the wider story earns them. Never invent reasons to fire them. Many campaigns will pass without an heirloom awakening; that is correct play.*

---

## Step 7 (Identity Details) — Drafted Copy

### Help text above alignment

> *Your moral compass — how you tend to act when no one's watching.*

### Help text above faith

> *Your connection to the divine, if any. Faith shapes ritual, oath, and the language you use under pressure.*

### Help text above lifestyle

> *How you live between adventures — the comfort you're accustomed to and the standard you can sustain.*

### Help text above physical description

> *What you look like. This grounds how others first see you.*

### Help text above optional expansions (manual mode)

> *The deeper texture of who you are. Fill in what feels meaningful and skip what doesn't.*

### Help text above optional expansions (handoff mode)

> *The years behind you shaped these. Confirm what fits, edit what doesn't.*

### Optional expansion section toggle labels

Each is its own expand toggle. Closed by default in manual mode; expanded by default in handoff mode (with Prelude pre-fill).

- **+ Personality traits** — what you do habitually
- **+ Ideals** — what you believe
- **+ Bonds** — what you value most
- **+ Flaws** — your weakness or vice
- **+ Backstory** — the years before the campaign

### Backstory affordance below biography seed display (handoff mode)

Below the read-only biography summary:

> *What you see here is canonical to your campaign. To revise it later, you can edit your character's biography directly.*

### Cuts (no copy needed; do not appear in either mode)

- Organizations
- Allies
- Enemies
- Other notes

---

## Step 8 (Review) — Drafted Copy

### Handoff-mode callout above preview card

> *The years that shaped you are behind you now. Step forward.*

Manual mode: no callout. Preview card stands on its own.

### Edit affordance shape

Click "Edit" next to a section in the editable summary list → direct jump back to that step (state preserved across other steps). Player advances forward through subsequent steps to return to Submit. Not inline editing. Decision: per Step 8 Q2 = (a).

---

## Home Page — Drafted Copy

### Empty state and returning player layout

Single-page layout for both states. "Your characters" section at top with **"Create New Character"** as the first item in the grid/list (Diablo-4-style pattern). "In progress" section below "Your characters" only renders when `creation_phase = 'ready_for_primary'` characters exist.

No page-level tagline or framing. The list view *is* the home page.

### "Create New Character" item

Visually distinct from existing character cards but lives in the same container. Lives as the first item in the list/grid. Clear "this is an action, not an existing character" treatment.

### Click flow

- "Create New Character" (any state) → Screen 2 (path choice)
- Existing character card → that character's main game screen
- In-progress character card → resume creator at handoff state for that character

---

## Screen 2 (Character Path Choice) — Drafted Copy

### Framing line at top

> *Your character will be played across years of their life. Choose how to bring them into the world:*

### Card 1 — Create a Prelude Character

**Card title:** *Create a Prelude Character*

**Body:**

> *Play through your character's formative years before you reach the campaign. Four sessions follow them from childhood to the threshold of adulthood, where decisions you make in fiction shape who they become — their class, their theme, their heritage gift, and the moments their stats grew sharper. By the time the road begins, the character is already someone with history.*
>
> *The Prelude takes longer to play than building a character directly. In return, your character earns small mechanical advantages: stat bumps from formative moments, a meaningful object or two carried into adventure, established places and people from their past that can return in the campaign. These are the gameplay bonuses of having actually lived your character before playing them.*

### Card 2 — Create a Campaign Character

**Card title:** *Create a Campaign Character*

**Body:**

> *Build your character directly. Eight steps to a complete person — name, ancestry, calling, abilities, gear — ready to step into their first adventure. You author whatever depth your character has: as much or as little personality, history, and detail as you want.*
>
> *This path is faster than the Prelude. Your character begins the campaign without the small mechanical advantages a Prelude character earns, and without the established past that emerges from played fiction. They begin as a complete person on their own terms.*

### Click flow

- Card 1 (Prelude) → setup wizard
- Card 2 (Campaign) → Step 1 of the manual creator
- Back affordance → return to home page

---

## Voice Direction (the audit pattern that produced all of the above)

This pattern was applied retroactively to all draft copy. Carry it forward when authoring new content.

### Rules of thumb

1. **Address the character as "you," not "your character."** Second person puts the player inside the fiction. The system is talking *to* the character, not *about* them.

2. **Replace meta references** ("the DM" / "the AI" / "the system") with neutral verbs or in-fiction phrasings. *"The story may give you a use-name"* instead of *"the DM will."*

3. **Replace "your Prelude" with in-fiction time-references.** *"The years behind you"* / *"the years that shaped you"* / *"in the years that shaped you"* — past-tense narration of the character's life, not the player's session.

4. **Mechanical terms like "stat bumps" stay** in operational contexts. Where they appear in player-facing copy, frame them via in-fiction effects. *"Two moments hardened you"* instead of *"You earned two stat bumps."*

5. **Wizard / setup-page copy can stay meta.** The player isn't in-fiction yet; they're agreeing to enter.

6. **Operational help text in pure-mechanics steps** (Equipment package selection, generation method, etc.) can have mild meta where in-fiction phrasing would be more contorted than helpful.

7. **Pre-fiction screens** (home page, Screen 2 path choice) can be operational/meta. The player chooses their path before entering the world.

### Tense

- **Past tense** for what shaped the character ("you've held the line," "you learned," "the wild raised you")
- **Present tense** for the character's current identity ("you are," "the discipline is in your bones")
- **Present-imperative** for the choice ahead ("now choose," "carry forward")

### Length

- Help text: usually one sentence; two if the field is meaty
- Celebration cards: 2-3 chapter beats + result line; total under ~50 words
- Narrative-continuity copy lines (Step 4): 2 sentences default, 3 if the theme demands it (Outlander, Hermit), 4 for the heaviest themes (Mercenary Veteran, Folk Hero, Urchin)

---

## Content Authoring Lift Summary (for new PM chat)

The new PM chat will author the following content as part of the spec doc. This document captures what's already drafted; the rest is fresh authoring work.

### To author fresh

- **21 starting gold modifiers** (one per theme; multiplier or flat adjustment to class baseline). Direction: Noble +50%, Folk Hero baseline, Urchin -50%, all 21 themes interpolated for internal consistency.
- **252 personality / ideals / bonds / flaws prompts** for Step 7 (~3 prompts per field × 4 fields × 21 themes). Each prompt is a short suggested string the player can click to fill in the field. Themes drive flavor; voice rules above apply.
- **~170 curated backstory moments** for Step 7 (~8 moments per theme × 21 themes). Each moment is a short formative event the player can pick from a guided backstory authoring path. Themes drive flavor.

### Already drafted (this document)

- 19 narrative-continuity copy lines for Step 4 (preserved verbatim above)
- All revised in-voice help text across Steps 1-7
- Step 8 callout
- Home page click flow
- Screen 2 framing + two card descriptions

---

## Decisions Log Reference

When writing the spec doc, reference these committed decision entries for context:

- **Phase 2 Pre-Engineering Decision A** (2026-04-30) — Setup wizard content revisit (10-question rewrite locked)
- **Phase 2 Pre-Engineering Decision B** (2026-04-30) — Main creator rebuild scope (Option B, full rebuild, two co-equal entry paths, 7-step starting structure since revised to 8)
- **Phase 2 Pre-Engineering Decision C** (2026-04-30) — `creation_phase` intermediate state (`'ready_for_primary'` added)
- **Phase 2 Pre-Engineering Decision D** (2026-04-30) — Knight of the Order and Haunted One excluded from Prelude emergence
- **Phase 2 Pre-Engineering Decision E** (2026-04-30) — Mythic-tier stat cap raise (lifetime cap 22 at Mythic onset; Phase 2 uses standard 5e math)

Phase 1 decisions 1-6 (2026-04-29) and the tone description sub-deliverable are also relevant for the spec doc's overview section.
