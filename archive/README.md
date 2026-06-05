# Archive — systems removed for the MVP reduction (2026-06-04)

This folder holds complete systems that were **removed from the live app** when it was
reduced to a focused Player-Mode MVP (play a single character with Claude Opus 4.8 as the
AI Dungeon Master). Nothing here is deleted — files keep their original relative paths
under `archive/` so they can be restored.

These systems were intentionally cut. They are **not** dead/broken code — they worked at
v1.0.167. They were removed to shrink the surface area to a reliably playable core.

## What's here (by system)
- `prelude` — the age-5→22 prelude character-creation sub-game (routes/services/components/data).
- `dm-mode` — the inverted "you are the DM, AI plays a party" mode.
- `mythic` — post-20 mythic progression, piety, epic boons, legendary items.
- `crafting` — recipes, materials, projects.
- `party-bases` — strongholds/fortresses, raids, garrison, long-term projects, **downtime** system.
- `merchant-economy` — persistent merchant inventories, bargaining, commissions, relationships, economy sim.
- `notoriety` — heat/entanglement.
- `living-world` — between-session tick: weather, survival, factions, world-events, NPC mail, narrative queue, consequences/promises automation.
- `factions / world-events / travel / locations / quests` — the world-simulation cluster.
- `achievements` — achievement tracking.
- `adventure-odds` — the odds-based "send your character on an adventure" meta-loop (distinct from the chat DM session).
- misc dashboards/pages — MetaGameDashboard, GenerationControls, PlayerJournal, NPCGenerator, NPCRelationshipsPage.

## How to restore a file
Move it back to the same path minus the `archive/` prefix, then re-wire its imports
(route mount in `server/index.js`, lazy import + view branch in `client/src/App.jsx`,
nav entry in `client/src/components/NavigationMenu.jsx`, and any marker schema/handler).
The full pre-reduction tree is also recoverable from the git "Safety snapshot" commit.

## Migrations & DB tables
Migration files under `server/migrations/` were **left in place** (they are append-only DB
history; removing them would break the migration runner). The tables owned by archived
systems remain in the schema but are simply never read/written. Harmless.

## Archived documentation (2026-06-05)
- `docs/` — root design/spec docs for cut systems (DM_MODE, DOWNTIME_DESIGN, MYTHIC_*,
  SUBCLASS_THEME_SYNERGIES, PARTY_SYNERGIES, PRELUDE_IMPLEMENTATION_PLAN,
  ANCESTRY_FEATS_REDESIGN_DEFERRED) **plus** superseded phase/process/roadmap docs
  (IMPLEMENTATION_PLAN, the `PHASE_*`/`Phase_*` specs, CONSOLIDATED_TODO, PROJECT_TODO,
  OPEN_QUESTIONS, TEST_RESULTS, AI_NARRATIVE_PERSISTENCE).
- `Claude PM Review Docs/` — historical PM review snapshots (mostly of cut systems).

Kept at the project root: foundational docs (CLAUDE, README, CHANGELOG, PROJECT_BRIEF,
DECISION_LOG, FUTURE_FEATURES, KNOWN_BUGS, LLM_SETUP) and docs for kept systems
(COMPANIONS, THEME_DESIGNS, ANCESTRY_FEATS, CUSTOM_CLASSES, the two character-creator docs).
Note: CLAUDE.md and PROJECT_BRIEF.md still contain a few links that now point into this
archive — cosmetic, not load-bearing.
