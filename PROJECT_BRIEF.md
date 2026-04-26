# Project Brief — D&D Meta Game

> *Working title.* The name "D&D Meta Game" is a placeholder; the user has flagged it for renaming. Whatever it ends up called, this is what it is.

**For:** Anyone joining this project in a strategic role — a Project Manager Claude, a future-you, a designer, anyone who needs to understand the shape and direction of the work before contributing. Read this once. Then read [`PROJECT_TODO.md`](PROJECT_TODO.md) every session for the live state.

**Audience tone note:** The user is a gamer, not a developer. He knows the basics of coding but should be spoken to as someone who cares about the *experience* and the *system design*, not the engineering depth. When technical detail matters, explain it.

---

## What this is

A **single-player D&D 5e campaign management system with an AI Dungeon Master**. You play, the AI runs the world. Built as a desktop web app (React + Express + SQLite, Claude Opus + Sonnet for AI).

It supports two inverted modes:

- **Player Mode** — you play one character; the AI is the DM. The default experience.
- **DM Mode** — you DM; the AI plays a party of four characters. A learning sandbox for the user (and anyone else) to practice running a game without the social commitment of a tabletop session.

It also has a **prelude character creator** — a 5-session character-building experience where you play your character from age 5 to age 22 across four chapters before they enter the main campaign. The AI shapes them based on the choices you make. This is half character-creation and half tutorial.

Surrounding all of this is a deep mechanical layer: companion AI, merchant economies with persistent inventories, party bases and fortresses, mythic progression endgame, faction politics, weather and survival, crafting, downtime, and a "living world tick" that advances the world between sessions. See [`CLAUDE.md`](CLAUDE.md) for the engineering map.

---

## Why it exists

This is the user's **end-of-world game** — meant in the most literal possible sense. The vision: when the bombs fall and he's in the bunker with his family, this is the game he wants to spend his alone-time playing. *Indefinitely.*

That framing is not decorative. It's a strategic anchor. It means:

- **Durability matters more than polish.** A feature that works for a thousand sessions is more valuable than a beautiful one that breaks after fifty.
- **AI memory and context are the central engineering problem.** A single character should be playable for *years* without the AI losing the lore, the relationships, or the canon.
- **No external dependencies that could disappear.** Ollama fallback exists for exactly this reason — if Claude's API isn't reachable, the game still runs locally.
- **Solo means solo.** Multiplayer would dilute the architecture. It's not coming. (Specific "never" lines below.)

The secondary why: the user has never played tabletop D&D with others. He's loved D&D-flavored RPGs his whole life (KOTOR, Baldur's Gate 3, Elder Scrolls), but the rules complexity kept him from joining a real game. **This is also his way to learn D&D itself** — Player Mode is the safe-space tutorial, and DM Mode is where he can practice running a game without the social commitment.

---

## Who it's for

- **Primarily: the user.** This is a personal project. He is the entire user base today.
- **Potentially eventually: friends.** He may share it with people he knows. He will never market it, charge money, or publish it to app stores.
- **Never: a paying audience or a wider userbase.** This is not a product. It's a hobby project that may grow into a shared hobby project.

Decisions should always be made for the user first. "Does this make the experience better for *him*" beats every other framing. Friends are a possible future audience, not a current constraint.

---

## What "done" looks like

The user said it best. The "before the bombs fall" target is:

1. **A single character playable for literal years** without the AI losing context or forgetting crucial parts of the lore. The AI should remember the cobbler in the third town the character ever visited, when the character returns five years later.
2. **The ability to play classic published D&D campaigns** — Vecna: Eve of Ruin, Curse of Strahd, Tomb of Annihilation, Descent into Avernus, etc. The system should be a faithful enough D&D 5e implementation that running an official adventure feels right, with the AI DM honoring the source material's structure.
3. **Lineages of characters.** The ability to retire a character, have descendants pick up their unfinished business, see a generational arc unfold across multiple lifetimes in the same world. Ancestors' quests pursued by descendants. This is the most novel and least-built ambition; it's the long-term north star.

The bar for any individual feature: **functional first, polish always.** Get it working, then return to make it better. Don't ship broken; don't refuse to ship because it's not pretty enough yet.

---

## Decision principles

These are the lenses that should shape "what should we build next" and "how should we build it":

1. **Narrative beats mechanics.** The prose-quality investigation (v1.0.96) is the central evidence. When in doubt, choose the option that produces a better story. The AI DM's voice and atmospheric writing is the heart of the experience; mechanical systems exist to support that, not vice versa.
2. **Don't remove systems — hide or mark them inactive.** Even when something seems unused, keep the option to come back. The user's words; durable feedback from earlier in the project.
3. **Cost-aware.** AI inference isn't free. Architecture decisions that affect token cost (caching, prompt size, model selection) get weighed carefully. The Opus-as-default conversation only became possible after the cache architecture fix made the math work.
4. **No half-finished implementations.** From `CLAUDE.md`: "Three similar lines is better than a premature abstraction." Don't add features for hypothetical futures. Either ship it complete or don't ship it.
5. **Hi-fi designs over wireframes for handoff.** When designs come in for implementation (via Claude Design or otherwise), expect them at hi-fi level. Wireframes leave too much interpretation to the implementer; hi-fi locks the visual language.

---

## What we're explicitly NOT building

The user wants these to be clear so collaborators don't pitch them:

- **Never charge money.** Not now, not ever. No subscriptions, no premium tiers, no in-app purchases.
- **Never publish to App Store or Play Store.** Distribution stays informal. PWA is OK (in `FUTURE_FEATURES.md`); native distribution is not.
- **Never multiplayer.** Solo is the architecture. Multiplayer would mean rewriting the AI memory model, the session model, the campaign model. Not worth it for a project with one user.
- **No tabletop integration.** This isn't a tool for real-table D&D. It's not Roll20, it's not Foundry. Don't build features that only make sense for a multi-human group.

When in doubt, ask the user. He's the only stakeholder.

---

## What's been built (high-level system inventory)

Engineering depth lives in [`CLAUDE.md`](CLAUDE.md). Use this as the strategic map:

- **Player Mode DM sessions** — chat-based AI DM with ~25 game-state markers (combat, loot, merchants, conditions, promises, weather, etc.). Three-tier prompt caching. Rolling summary compaction for long sessions.
- **DM Mode** — user-as-DM with AI playing 4 distinct characters. Separate prompt builder. Bond tracking. Coaching tips.
- **Prelude character creator** — Phases 1-4 shipped (5 sessions, 4 chapters). Phase 5 (handoff to main campaign) is the largest pending work; see `FUTURE_FEATURES.md` and `PRELUDE_IMPLEMENTATION_PLAN.md`.
- **Living world** — between-session tick pipeline (weather → factions → events → quests → companions → mail → consequences → survival → bases → notoriety).
- **Companions** — full 5e progression mirror, multiclass, spell slots, conditions, mood, loyalty, off-screen activities.
- **Merchants & economy** — persistent inventories from loot tables (not AI-generated per visit), DMG + XGtE magic items across 5 rarities, bargaining, custom commissions, price modifiers.
- **Themes (replacing 5e backgrounds)** — 21 themes × 4 tiers = 84 ability shells in code. Architecture locked in; content for individual abilities is the largest single design lift remaining. See `Claude UX Design/D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md` for the system design.
- **Mythic progression** — 5 tiers, 14 paths, piety system (53 deities), epic boons, legendary items with 4 awakening states.
- **Party bases & fortresses** — buildings, garrison, defense, threats, raids, treasury.
- **Crafting** — 112 recipes across 9 categories, quality tiers, AI-gifted radiant recipes.
- **Notoriety / heat** — per-source 0-100 score, decay, entanglement checks at thresholds.
- **Authentication** — JWT + bcrypt; campaigns scoped to user.

What's NOT yet built (the long-term ambitions):
- **Lineages of characters** (the north-star ambition above) — no architecture yet.
- **Robust support for published D&D modules** — the structure exists (`campaignModules.js`, 16 modules listed), but only partial integration. A real Curse of Strahd playthrough would surface gaps.
- **A definitive multi-year persistence story** — the cache fix (v1.0.96) is the latest improvement, but "play one character for years" is still aspirational.

---

## Strategic threads currently in flight

Three threads, plus a backlog of standalone features. Detail lives in [`PROJECT_TODO.md`](PROJECT_TODO.md) and [`FUTURE_FEATURES.md`](FUTURE_FEATURES.md). High-level:

1. **Prose quality** — current focus. Just shipped v1.0.96 (cache architecture fix). Validating Opus as production default. Next moves: production fixes for two prompt rules that compress cinematic moments (H7, H8), then NPC voice/tone system, then expanded naming. All centered on "the AI DM writes meaningfully better prose."
2. **Hi-fi UX** — design for an in-session three-column cockpit landed (`Claude UX Design/D&D Meta Game (Remix)/Session-Design-Bundle/`). Plus designs for character sheet tabs (Stats, Combat, Spells, Inventory, Features all done). Origin & Identity tab and Progression tab still need building. This thread is on deck.
3. **Themes content + prelude integration** — most ambitious. Includes Themes content design (84 abilities to write), Phase 5 prelude→main campaign handoff, tone-preset integration, theme commitment in prelude Ch3. The pieces interlock; high reward but high dependency chain.

The PM's job includes helping pick which thread to push, when, and how far before pivoting.

---

## How a PM works on this project

The user runs this project alone with three classes of AI assistance:

- **Claude Code** does most engineering work.
- **Claude Design** does most visual design work (via the design-bundle handoff pattern — see `Claude UX Design/D&D Meta Game (Remix)/Session-Design-Bundle/README.md`).
- **Claude PM** (you, if you're reading this in that role) does **strategic thinking, prioritization, and some design judgment**. You're the layer that helps the user decide *what* to work on and *whether* a proposed approach fits the project's principles. You don't write production code or polish UX yourself — you hand those off to the right specialist.

What the PM should do every session:
1. **Read [`PROJECT_TODO.md`](PROJECT_TODO.md)** for current state.
2. **Skim any open `triage/*-triage.md` files** for active diagnoses.
3. **Pull deeper docs** (CLAUDE.md, FUTURE_FEATURES, design specs) only when a specific question requires them.
4. **Help the user think strategically.** When he describes a problem, your first move is usually clarifying questions, not solutions. When he asks "what should we work on next," you reference the threads and recommend with reasoning.
5. **Maintain documentation hygiene.** When a triage closes, update PROJECT_TODO. When a major decision lands, add it to `DECISION_LOG.md`. When the project's direction shifts, update this brief.

What the PM should NOT do:
- Don't make engineering architecture decisions in isolation. Surface options, get the user's call, then loop in Claude Code to execute.
- Don't make visual/interaction design decisions in isolation. Either the user has a strong preference, or it goes to Claude Design via the handoff pattern.
- Don't ship work the user hasn't agreed to. Even small changes — confirm scope first.

---

## How to navigate the docs

The full map lives in [`PROJECT_TODO.md`](PROJECT_TODO.md), section "Living docs map." High-leverage entry points for a PM:

- **`PROJECT_BRIEF.md`** (this file) — strategic orientation. Read once.
- **`PROJECT_TODO.md`** — active/blocked/parked work. Read every session.
- **`DECISION_LOG.md`** — record of major decisions, why we made them, what they imply. Read when context-setting.
- **`triage/*-triage.md`** — active diagnostic investigations. Read what's open.
- **`FUTURE_FEATURES.md`** — backlog of designed-but-deferred work. Skim periodically.
- **`CHANGELOG.md`** — what shipped, per release. Frozen-in-time per version.
- **`CLAUDE.md`** — engineering depth. For technical context only.
- **`PRELUDE_IMPLEMENTATION_PLAN.md`** — detailed prelude-system plan. Phase 5 is still active.
- **`Claude UX Design/`** — design hand-offs from external design tooling.

When in doubt about where something belongs:
- Frozen historical record? `CHANGELOG.md`.
- Living state of an active investigation? `triage/`.
- Designed but deferred work? `FUTURE_FEATURES.md`.
- "Why did we decide that"? `DECISION_LOG.md`.
- "What are we doing right now"? `PROJECT_TODO.md`.
- Strategic context? Here, in the brief.
