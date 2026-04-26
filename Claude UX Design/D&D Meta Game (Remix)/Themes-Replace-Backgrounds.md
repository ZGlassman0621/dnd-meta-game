# Themes — Replacing Backgrounds in the D&D Meta Game

**Audience:** UX/design collaborators looking at the wireframes in this folder.
**Status:** Design locked-in 2026; data partially seeded (21 × 4 tiers = 84 abilities live in `server/data/themes.js`); UI surfacing on the Progression tab.

This document describes the **Themes** system — what it is, why it replaces standard D&D 5e backgrounds, and how it shapes the character sheet, the level-up flow, and the AI DM's behavior.

---

## The one-line pitch

In standard 5e, your background is a static L1 choice (skill proficiencies, a flavor trait, gold). In our system, your background **becomes a Theme** — a four-tier progression layer that grows alongside class and subclass, with abilities unlocking automatically at L1 / L5 / L11 / L17.

Inspired by **Starfinder's Themes** (with the d4 → d6 *Expertise Die* as the signature mechanic) and paired with **Pathfinder 2e ancestry feats** (separate progression layer for race).

---

## Why replace backgrounds at all

Standard 5e backgrounds:
- Front-load all their value at L1 (skills + tools + flavor).
- Stay static for the rest of the character's life.
- Have no mechanical relationship to leveling, story moments, or the AI DM's behavior.

This is fine for tabletop sessions where the GM weaves background into roleplay. It's *limp* in a solo AI-DM context where the DM needs structured signals about who the character is becoming over time. A 12-session character with the "Soldier" background is mechanically identical to a 1-session character with the same background — except for what's in the player's head.

Themes fix this by making the background a **living progression layer**. Every background-equivalent gets four tiers of mechanically-relevant identity that the AI DM can reference, NPCs can react to, and other player choices can interact with.

---

## Structure

Every Theme has **four tiers**:

| Tier | Level | What unlocks |
|---|---|---|
| **T1** | L1 | Skill/tool proficiencies + a passive flavor trait (mirrors the existing background's L1 grant — *no break from standard 5e at character creation*) |
| **T2** | L5 | A small active-or-always-on ability tied to the Theme's identity |
| **T3** | L11 | **Expertise Die** (d4) on the Theme's two key skills + secondary capability |
| **T4** | L17 | Capstone ability that makes the concept feel legendary + Expertise Die scales to **d6** |

Themes unlock **automatically** at the milestone levels. The player never picks from a menu mid-progression — but the AI DM is empowered to deliver the unlock through narrative.

### How unlocks are delivered

Two paths, picked by the AI DM based on current scene context:

1. **Story-driven** (preferred when context fits): An in-fiction NPC initiates the unlock. A mentor recognizes the character is ready. A temple elder bestows training. A guild master entrusts a deeper secret. A captain confers a field promotion.

2. **Passive narrative** (when no story-appropriate moment exists): Delivered post-long-rest, Oblivion-style — a short reflective beat where the character realizes something has shifted, followed by a clean *"You've gained: [ability]"* card.

This keeps progression feeling like part of the story rather than a menu, while staying predictable and clearly communicated.

---

## The Expertise Die — signature mechanic

When a Theme T3 unlocks (L11), the character starts adding a **d4** to certain skill checks tied to the Theme's identity:
- A **Knowledge Cleric + Acolyte Theme** gets it on Religion / Insight.
- A **Criminal Rogue** gets it on Deception / Stealth.
- A **Sage Wizard** gets it on two INT skills.

The die scales to **d6** at T4 (L17).

### Why d4 → d6 instead of d6 → d10

Themes grant an *edge*, not dominance. A small die avoids absurd stacking with Bardic Inspiration, Bless, Guidance, and Help — and leaves room for **Mythic-tier** abilities to be the actual god-like mechanics. A consequence of the smaller die: it can apply more often without breaking the math.

Cross-class flavor is intentional. A Fighter + Sage Theme is a military historian. A Rogue + Acolyte Theme is a religious operative. A Cleric + Criminal Theme is a redeemed (or not!) ex-convict. The Theme's Expertise Die works in *any* class — what changes is which two skills it applies to and how the AI DM frames the character's identity.

---

## Knight Theme — the moral-path variant (notable case)

Most Themes have one trajectory. **Knight of the Order** has six:

- **True Knight** — straight-and-narrow honorable.
- **Reformer** — pushes the order toward reform from within.
- **Martyr** — sacrifices personal good for the order's mission.
- **Complicit** — knows the order is corrupt, stays anyway.
- **Fallen** — broke the oaths, wears the title hollowly.
- **Redemption** — fallen and clawing back.

Each path gives the AI DM a **tailored directive** in the system prompt. NPCs in the order react to the player's path. A Reformer at a chapter house gets different dialogue than a Fallen at the same location. The path is committed at character creation but can shift narratively (a True Knight whose order asked them to do something monstrous can become Reformer, Complicit, or Fallen depending on the choice).

This is the template for any future "moral fork" Theme variants.

---

## Synergies — how Themes interact with other systems

Themes are not an island. Three intersection layers, all live in the codebase:

### Subclass × Theme synergies (50 implemented)

When a particular subclass + theme combination has resonance, the AI DM gets an extra system-prompt block describing the synergy. **Battle Master + Soldier** isn't just a fighter who used to be a soldier — it's a *unit-trained tactical fighter* whose maneuvers read as squad doctrine. The AI knows to frame attacks that way and have NPCs recognize it.

### Mythic × Theme amplifications (17 implemented)

When a character reaches mythic tier, certain themes get amplified path abilities. A **Hierophant + Acolyte** doesn't just get "more divine power" — they get a specific amplification tied to the theme's identity. See `server/data/mythicThemeAmplifications.js`.

### Party Synergies (Team Tactics — 20 implemented)

This is the new ground. D&D 5e doesn't have **party feats** the way Pathfinder 1e did with Teamwork Feats (Outflank, Coordinated Maneuvers, etc.) — the closest equivalents are the Help action, Bardic Inspiration, and a few class features like Battle Master's Commander's Strike. Themes is the chance to introduce real party-level mechanics.

**Synergies apply across the full party — including all-AI parties.** Even though companions and DM Mode characters are AI-driven, each has personality, voice, and decision-making. AI characters *choose* whether to invoke a synergy based on personality and current goals. A loyal cleric companion might reliably set up a Soldier-Cleric coordinated attack; a reckless barbarian companion might never play into flanking synergies because they prefer to charge alone. **This makes companion personality mechanically meaningful**: the player learns over time which companions reliably play into synergies, and absences hurt more because losing a Synergy partner removes options the party had become accustomed to.

---

## How Themes intersect with other progression layers

A character's identity emerges from the **intersection** of three layers, each evolving in parallel:

1. **Class + Subclass** — what they DO mechanically. Fighter, Wizard, Cleric, etc.
2. **Theme** — who they ARE (background as living progression). Soldier, Sage, Acolyte, Criminal, etc.
3. **Ancestry Feats** — what their RACE means mechanically over time. Inspired by Pathfinder 2e: race feats unlocked at L1 / L5 / L9 / L13 / L17 from a race-specific list. A dwarf might unlock tremorsense at L9, magic stonecunning at L13, stone giant resilience at L17. An elf might unlock fey step, trance mastery, or elven weapon training.

The Themes System and Ancestry Feats are designed **together** — they occupy the same conceptual space (progression layers that aren't class or subclass), and the goal is that the three layers (class + theme + ancestry) feel like a *braided* identity rather than three separate menus.

**For the UX/design pass:** the character sheet's Progression tab should communicate this as three parallel rails, each with locked-in past unlocks visible and the next milestone shown clearly. Avoid the temptation to flatten them into one progression bar — the *parallelism* is the design intent.

---

## What hasn't been built yet

For your awareness — these are confirmed in scope but not yet implemented:

- **Theme commitment in prelude** — Phase 5 of the prelude-forward character creator commits the player's theme during Chapter 3 (the second-to-last prelude chapter), based on what their play has revealed. This will replace the explicit "pick a background" wizard step. Currently the prelude tracks emergent values + theme hints; the commitment moment hasn't shipped yet. See `PRELUDE_IMPLEMENTATION_PLAN.md`.
- **Discovery-based unlocks** — story-driven unlocks need an "AI DM should look for an opportunity to deliver this" hook in the prompt. Currently themes auto-unlock via passive-narrative path; story-driven path is partially wired but not yet reliably chosen.
- **Cross-character theme demonstrations** — when the player's companion has a theme that synergizes with the player's, the companion should *demonstrate* the synergy in scenes (not just buff stats). Companion AI prompt currently doesn't have access to the synergy table.

---

## Files in the codebase

For when you need to ground something in actual code or data:

- `server/data/themes.js` — 21 × 4 tier abilities (84 total). Single source of truth.
- `server/data/subclassThemeSynergies.js` — the 50 resonance combinations.
- `server/data/mythicThemeAmplifications.js` — the 17 mythic-tier amplifications.
- `server/data/teamTactics.js` — 20 party-level synergies.
- `server/services/progressionService.js` — runtime composition: which abilities a character has earned, which are pending, what the next milestone is.
- `server/services/progressionSeedService.js` — idempotent loader (themes are seeded into the DB on every server startup so we can iterate the data files without DB migrations).
- `client/src/components/CharacterSheet.jsx` — Progression tab (where themes surface to the player).
- `THEME_DESIGNS.md` (root) — the full per-theme spec, all 21 themes detailed.
- `SUBCLASS_THEME_SYNERGIES.md` (root) — the synergy spec.
- `MYTHIC_THEME_AMPLIFICATIONS.md` (root) — the mythic amplification spec.
- `PARTY_SYNERGIES.md` (root) — the team tactics spec.

---

## What the UX needs to convey

If you're building the character-sheet visual or the level-up moment:

1. **Themes are not menus.** No "pick from 4 abilities" cards at level-up — the unlock is automatic. The UI's job is to *celebrate* the unlock and explain what changed, not to ask for input.
2. **Themes are an identity rail, not an inventory.** The Progression tab should make it feel like the character is *becoming* something over time. A locked tier should feel like an upcoming chapter, not a missing inventory slot.
3. **The Expertise Die is the visible payoff.** Players should see the d4 (then d6) on their skill checks as a tangible reward for progression. Surface it on the relevant skill rows in the character sheet.
4. **Synergies are emergent, not designed-by-the-player.** Don't make synergy a goal the player consciously builds for. Make it a *recognition* moment — "wait, my Soldier Theme is making my Battle Master subclass abilities feel different now." The AI DM tells them; the UI confirms.
5. **Three rails, not one bar.** Class, Theme, Ancestry are parallel. The Progression tab should look like three columns or three lanes — visually reinforcing the braided-identity design intent.

---

*If you have questions or proposed changes, drop them inline as comments and I'll iterate. The design is locked-in at the principle level (4 tiers, auto-unlock, narrative delivery, Expertise Die d4→d6) but the UX/visual layer is still very open.*
