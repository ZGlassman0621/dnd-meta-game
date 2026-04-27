# Decision Log

Records the meaningful decisions that shape this project — past calls (so you understand *why* it's built the way it is) and pending calls (so you know what's waiting on a judgment).

Format per entry is light by design:

```
## YYYY-MM-DD — Title (Category)
**Context:** what was the situation
**Decision:** what we chose
**Why:** the reasoning
**Implications:** what this means going forward
**Related:** [optional pointers]
```

**Categories:** Architecture · Direction · Prompt design · UX · Infrastructure · Process

**What goes here vs. CHANGELOG:** CHANGELOG records *what shipped*. This file records *why we shipped that and not the alternatives*. If a decision will shape future work or future architectural choices, it belongs here. Bug fixes and routine implementations don't.

---

## Open decisions pending

These are the calls waiting on user input or external evidence. Listed newest-first.

### 🟡 Opus as production default for main DM sessions
**Status:** Validation completed (v1.0.97 session 147 playtest); decision still open. **Owner:** User.
**Context:** v1.0.96 cache fix delivered. Real measurement from 24-turn Opus playtest: ~71% average cache hit rate (close to the ~77% ceiling for thoughtful play), ~$2.89/session (~$1.50/hour). The original ~$0.85/session prediction was wrong because tier 3 dynamic content (chronicle context, narrative queue, world state) and accumulated message history grow per turn — they cap the achievable cache hit rate, not tier 1+2 alone. v1.0.98 adds tier 2 1-hour TTL (lever 1) which should reduce session cost by ~$0.20–$0.30. Three additional levers (rolling-summary-earlier, tier-3-trim, etc.) could push closer to ~$1.00/session if needed.
**Decision needed:** Make Opus the default for main DM session continuations at the new measured cost (~$1.30–$1.50/hour after lever 1), or keep Sonnet default with the home-page toggle.
**Related:** [`triage/prose-quality-triage.md`](triage/prose-quality-triage.md)

### 🟡 Lean Prompt toggle: keep as diagnostic or retire entirely
**Context:** Lean prompt (strips MECHANICAL MARKERS + softens Cardinal Rule 2) didn't move the needle in user playtest. Automated A/B showed it helps edge cases (atmospheric scene-opens, cinematic build) but not the average turn.
**Decision needed:** Retire as a production direction, OR keep the toggle as a debugging tool, OR fold the relaxed Cardinal Rule 2 into production permanently.

### 🟡 H7 — `PLAYER OBSERVATION = ALWAYS A CHECK` production fix
**Context:** Surfaced during prose-quality A/B. The rule kills atmospheric scene-opens (e.g., the AI demands "Make a Perception check" after the player just opened a tavern door).
**Decision needed:** Move OUT of always-on prompt; only inject when the player commits to a perception/investigation/stealth verb. Or some other shape.

### 🟡 H8 — Cardinal Rule 2 (HARD STOPS) production softening
**Context:** Surfaced during prose-quality A/B. The strict rule forces the AI to end its response immediately after any roll request, compressing cinematic build-ups.
**Decision needed:** Soften to lean-mode variant in production ("ROLL REQUESTS — DON'T SPOIL OUTCOMES"), or keep strict.

### 🟡 Project rename
**Status:** User flagged the working title "D&D Meta Game" needs replacing. No replacement chosen yet.
**Implications:** Affects package.json, UI brand text, README, and this brief. Defer until a name is picked.

### 🟡 Session Hi-Fi: Path A (phased) or Path B (one-shot)
**Status:** Deferred until prose-quality work closes. Five sub-questions captured in [`FUTURE_FEATURES.md`](FUTURE_FEATURES.md) under "Session Hi-Fi implementation".

---

## Decisions log (newest first)

### 2026-04-26 — PROJECT_BRIEF.md and DECISION_LOG.md introduced (Process)
**Context:** Project complexity has grown to multiple parallel strategic threads, multi-session investigations, and recurring AI collaborators (Claude Code, Claude Design, Claude PM). Onboarding a strategic-role collaborator was forcing them to re-derive context every time.
**Decision:** Create `PROJECT_BRIEF.md` (strategic orientation, read once) and `DECISION_LOG.md` (this file — record of decisions and rationale).
**Why:** CLAUDE.md is engineering-deep and doesn't serve strategic readers. PROJECT_TODO.md is current-state and doesn't preserve the *why* behind past calls. Without a brief, every new collaborator has to be re-onboarded. Without a decision log, institutional memory leaks at every session boundary.
**Implications:** Adds two docs to maintain. The brief should change rarely (project shape rarely shifts); the log gets a new entry every time a meaningful call lands. Both should be read by any strategic-role collaborator at start.

### 2026-04-26 — Triage folder is for *broken systems being diagnosed*, not for *designed systems being built* (Process)
**Context:** Briefly created `triage/session-hifi-triage.md` for the deferred Session Hi-Fi build, then user pointed out that "triage" should mean "system needs an immediate fix." Design work that's scoped-but-deferred isn't the same thing.
**Decision:** Triage folder reserved for active diagnostic investigations only. Designed-but-deferred work goes in `FUTURE_FEATURES.md`.
**Why:** Keeps the semantic clean. A reader scanning `triage/` should know everything in there is a *problem under investigation*, not a *project on the backlog*.
**Implications:** Session Hi-Fi was moved out of triage into FUTURE_FEATURES. Going forward, the test for "does this go in triage?" is "is something broken or behaving badly that we're trying to fix?" If yes → triage. If "we want to build this thing eventually" → FUTURE_FEATURES.

### 2026-04-26 — PROJECT_TODO.md established as single-entry-point for active work (Process)
**Context:** Active work was scattered across triage docs, FUTURE_FEATURES, in-conversation context, and tribal memory. Coming back to a session meant reconstructing state.
**Decision:** Create `PROJECT_TODO.md` at repo root with sections for Active Right Now (1-3 items), Blocked/Waiting, Parked/On Deck, Backlog (pointer), Recently Shipped, and a Living Docs Map. Read at the start of every session.
**Why:** A single living "where are we" doc reduces session-startup cost and prevents lost work.
**Implications:** Convention: items move *between* sections as state changes; never appended below stale entries. Maintained at session boundaries. PROJECT_TODO is the navigation hub; deeper docs (triage, brief, FUTURE_FEATURES) are pointed to from here.

### 2026-04-26 (v1.0.98) — Tier 2 prompt cache also moves to 1-hour TTL (Architecture)
**Context:** v1.0.96 put tier 1 on 1-hour TTL but kept tier 2 at the default 5 minutes, on the assumption that tier 2's smaller size didn't justify the 2× write premium. The v1.0.97 session-147 playtest (24 turns, Opus) disproved that. Real cache log showed tier 2 re-creating ~6 times during the session — entries like `created 5221`, `created 2973`, `created 1927` at turns 10, 11, 18, 20, 22 — each costing ~$0.05. Pattern: thoughtful play gaps exceed 5 min, tier 2 expires, gets re-created on the next turn.
**Decision:** Tier 2 now also uses `cache_control: { type: 'ephemeral', ttl: '1h' }`. Both tiers on 1-hour TTL.
**Why:** Same reasoning as the v1.0.96 tier 1 decision, just confirmed empirically for tier 2: 2× write cost (1h) is amortized over 60 minutes vs 5; net cheaper for thoughtful play. The "smaller block, premium not worth it" intuition was wrong because tier 2 still gets re-created multiple times per session at 5m TTL during normal play, and each recreation pays the full block cost.
**Implications:** Tier 2 re-creations during long pauses should drop from ~6/session to ~1/session. Per-session cost: ~$2.89 → ~$2.60 (~$0.20–$0.30 savings, depending on session length and pause distribution). Cross-session caching also benefits — the next session start can hit BOTH tiers from the prior session (session 147 t1 already showed 88% cache hit from tier 1 alone with 1-hour TTL; this should improve further now that tier 2 is included).
**Related:** v1.0.98 changelog entry; [`triage/prose-quality-triage.md`](triage/prose-quality-triage.md)

### 2026-04-26 (v1.0.96) — Tier 1 prompt cache uses 1-hour TTL (Architecture)
> *Partially superseded 2026-04-26 (v1.0.98): tier 2 also moves to 1-hour TTL based on session-147 production data. See entry below for the new context.*

**Context:** Production cache logs (session 144, Riv A playtest) showed tier 1 evicting every 5-6 turns. Anthropic's default ephemeral cache TTL is 5 minutes, and thoughtful play exceeds 5-minute boundaries between turns. Each eviction forced a full tier 1 rebuild (~5500 tokens).
**Decision:** Use `cache_control: { type: 'ephemeral', ttl: '1h' }` on tier 1 (universal-static block). Tier 2 keeps the default 5-minute TTL — assumption was that the smaller per-character block didn't justify the 2× write premium.
**Why:** Anthropic charges 2× to write 1-hour cache vs 1.25× for 5-minute, but 1-hour survives between thoughtful turns. Net cheaper for tier 1.
**Implications:** Tier 1 mid-session evictions eliminated. The tier 2 5-min decision turned out to be wrong — see v1.0.98 entry below.
**Related:** v1.0.96 changelog entry; [`triage/prose-quality-triage.md`](triage/prose-quality-triage.md)

### 2026-04-26 — Split character info into static (tier 2) + dynamic (tier 3) for cache stability (Architecture)
**Context:** Tier 2 cache hit rate was inconsistent in production (~55%). Investigation showed the entire character sheet (name, race, abilities, HP, gold, current location, current quest, equipped weapon) was a single block in tier 2. Every state change (every turn) drifted tier 2's content, forcing cache rebuilds.
**Decision:** Split `formatCharacterInfo()` into `staticText` (identity that doesn't change session-to-session: name, race, class, abilities, skills, feats, spells, demographics, personality/ideals/bonds/flaws, backstory) → tier 2; and `dynamicText` (HP, AC, weapon, key equipment, current location, current quest) → tier 3. Backwards-compat: `text` field still returned with the concatenation so any caller still using it works.
**Why:** Per-character cache should hit on every continuation turn within a session. With state mixed in, it never did. The split is the architecturally correct fix.
**Implications:** Predicted at ~95% cache hit rate. Real measurement from session 147 (v1.0.97) was ~71% — close to the ~77% mathematical ceiling for this play pattern, since fresh-input from accumulated message history + tier 3 dynamic content (chronicle context, narrative queue, world state) caps the ratio. The ~95% prediction was wrong; ~71–77% is the realistic range. Pattern is now established — any future per-character static content should land in tier 2; per-turn state in tier 3.
**Related:** v1.0.96 changelog entry; v1.0.97 session-147 production playtest; [`tests/cache-tier-diff.js`](tests/cache-tier-diff.js)

### 2026-04-26 — Sonnet/Opus model selector replaces Auto/Claude/Ollama provider toggle (UX + Direction)
**Context:** During the prose-quality investigation, user needed to A/B Sonnet vs Opus across sessions. The existing setup-screen toggle was for *provider* (Auto/Claude/Ollama), not *model*.
**Decision:** Replace the provider toggle with a Sonnet/Opus model selector on three surfaces: home-page pill, session setup screen, in-session info bar pill. Provider preference stays internally on `auto` so Ollama fallback still works.
**Why:** Model is the lever that affects prose quality, not provider. Surfacing model choice while keeping provider abstracted matches what actually matters.
**Implications:** Three surfaces share `dndForceOpus` localStorage key. Ollama users (offline play) lose explicit provider control but can still rely on auto-fallback. If lean prompt or another model-affecting toggle is added, follow this same pattern.

### 2026-04-26 — Lean Prompt toggle as a diagnostic-only experiment (Prompt design)
**Context:** Two prompt elements (the MECHANICAL MARKERS section and Cardinal Rule 2 HARD STOPS) were hypothesized to compress prose. Needed a way to A/B them without rebuilding.
**Decision:** Add `applyLeanTransforms()` post-processor in `dmPromptBuilder.js`. When body param `leanPrompt: true`, strip MECHANICAL MARKERS section and replace Cardinal Rule 2 with a softer "ROLL REQUESTS — DON'T SPOIL OUTCOMES" variant. Applied per-turn on a copy; full prompt always stays in `messages[0]`. Toggleable mid-session via a home-page pill.
**Why:** Diagnostic, not production. Reversible per-turn. Keeps the experiment cheap.
**Implications:** This toggle is on the open-decisions list above — keep, retire, or fold parts into production permanently is still TBD. Pattern of "post-process the system prompt on a copy at API-call time" is now established and could be reused for other diagnostic experiments.

### 2026-04-25 — Establish the prose-quality investigation as the central narrative-quality work (Direction)
**Context:** User reported sessions read thinner than the original "Order of Dawn's Light" Opus 4.5 baseline (December 2025 PDF in repo root). Started with 6 hypotheses; expanded to 8 after diagnostic surfaced two more (H7 OBSERVATION-as-check, H8 HARD STOPS).
**Decision:** Treat prose quality as the central engineering investment for v1.0.95 → v1.0.96 → forward. Build the diagnostic toolkit (3 dryrun harnesses + 1 A/B harness against Sonnet). Then act on findings.
**Why:** Narrative is the heart of the experience. Mechanics exist to support it. If the AI DM doesn't write well, nothing else matters.
**Implications:** Strategic Thread 1 (per `PROJECT_BRIEF.md`) — the active push. Will likely run for several more versions. Production decisions on Opus default, Lean retire, H7/H8 fixes are downstream.
**Related:** [`triage/prose-quality-triage.md`](triage/prose-quality-triage.md), `tests/output/prose-quality-analysis.md`

### 2026-04-24 — Append-only transcript decoupled from LLM message history (Architecture)
**Context:** `dm_sessions.messages` doubles as the LLM-facing conversation array (gets compacted by rolling summary at message 30+) and the source of truth for "what happened in this session" (used for chronicle gen, recap, transcript display, exports, turn counter). The compaction broke everything that needed the full history.
**Decision:** Add `dm_sessions.transcript` column that grows append-only. `messages` continues to drive what the LLM sees (compacted, bounded). `transcript` is the source of truth for play history.
**Why:** Compaction is correct for LLM cost; lossiness is wrong for everything else. Decoupling fixes both.
**Implications:** All downstream consumers of "what happened" should read from `transcript`. `getTurnCount(sessionId)` is now authoritative. Pattern: when LLM-context concerns and historical-truth concerns conflict, separate the columns.
**Related:** v1.0.95 changelog (migration 046)

### 2026-04 — Themes replace 5e backgrounds as a 4-tier progression layer (Direction)
**Context:** Standard 5e backgrounds front-load all value at L1 then stay static. In a solo AI-DM context, the background needs to be a living signal the AI can reference and react to over time, not a one-time L1 grant.
**Decision:** Replace the standard "Background" character creation step with **Themes** — every D&D 5e background becomes a 4-tier progression (L1 / L5 / L11 / L17). Auto-unlock at milestones, narratively delivered (story-driven preferred, passive-narrative fallback). Signature mechanic: the **Expertise Die** (d4 at T3, scaling to d6 at T4) on the Theme's two key skills.
**Why:** Makes the character's identity progression *mechanically meaningful* over the lifetime of a campaign. Inspired by Starfinder Themes + Pathfinder 2e ancestry feats. Three parallel progression layers (Class / Theme / Ancestry) feel like a *braided* identity rather than three separate menus.
**Implications:** Architecture is locked in (21 themes × 4 tiers = 84 ability shells exist in `server/data/themes.js`). Content for individual abilities is the largest single design lift remaining. Knight Theme has 6 moral paths (template for future moral-fork variants). Background tab in character sheet renamed → "Origin & Identity," Theme progression lives on Progression tab.
**Related:** `Claude UX Design/D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md`, `THEME_DESIGNS.md`, `SUBCLASS_THEME_SYNERGIES.md`, `MYTHIC_THEME_AMPLIFICATIONS.md`, `PARTY_SYNERGIES.md`

### 2026-04 — Hi-fi designs over wireframes for AI-implementer handoff (Process)
**Context:** Wireframes (sketchy / dashed / hand-drawn aesthetic) were intentional "this isn't done" signals. But for handoff to an AI implementer (Claude Code), wireframes get faithfully reproduced as wireframes — the AI doesn't infer "oh, this should be a real portrait."
**Decision:** Iterate designs to hi-fi *before* handing them to Claude Code. Hi-fi locks the visual language (real fonts, real icons, real spacing); the implementer recreates pixel-fidelity rather than re-deriving aesthetic intent.
**Why:** AI implementers are literal. They need the spec to be the artifact, not a sketch of the artifact.
**Implications:** Workflow: Claude Design produces hi-fi HTML/CSS prototypes → exported as a design bundle (with README, chat transcript, source files) → handed to Claude Code with clear scope-confirmation step before implementation. Existing hi-fi pieces: 5 character sheet tabs, 1 session screen. Pending: Origin & Identity tab, Progression tab.
**Related:** `Claude UX Design/D&D Meta Game (Remix)/`

### 2026 (early-mid) — Prelude-forward character creator (5 sessions, ages 5-22, 4 chapters) (Direction)
**Context:** Standard D&D character creation is a stat-block exercise; the character has no lived history when play begins. For an AI-DM-driven solo experience, the AI needs grounding — *who is this person, what shaped them* — to give NPCs something to react to.
**Decision:** Replace the standard one-step character wizard with a **prelude** — a 5-session character-building experience where the player plays the character from age 5 to age 22 across four chapters (OBSERVE → LEARN → DECIDE → COMMIT). The AI shapes them based on choices made in play. Theme commitment lands in Ch3.
**Why:** Builds character depth *through play*, not through form-filling. Generates canon facts, NPCs, and relationships organically. Doubles as a tutorial for D&D itself.
**Implications:** Phases 1-4 shipped. Phase 5 (handoff to main campaign) is the largest pending integration work. Affects everything downstream — main campaign opener now reads from prelude state, NPCs from prelude can recur, Theme is committed before main play begins.
**Related:** `PRELUDE_IMPLEMENTATION_PLAN.md`

### 2026 (earlier) — DM Mode (user as DM, AI as 4 player characters) as a first-class mode (Direction)
**Context:** User has never played D&D with others, partly because of rules complexity. Wanted a way to learn DM-ing without the social commitment of a tabletop session.
**Decision:** Build DM Mode as the inverted of Player Mode. User runs the game; AI plays a party of four distinct characters generated by Opus with class/alignment/voice diversity and inter-party tensions. Separate prompt builder, separate session type, separate UI flow.
**Why:** Tutorial value + dual-purpose codebase. The same engine that supports playing also supports practicing.
**Implications:** All AI-companion infrastructure (voice palettes, personality, decision-making) is reusable in DM Mode. New patterns surfaced here (party dynamics, bond tracking, coaching tips) feed back into Player Mode companions.

### 2026 (earlier) — Three-tier prompt cache architecture (Architecture)
**Context:** Per-turn AI cost is a major concern. Naive sending of the full system prompt every turn is expensive.
**Decision:** Stratify the system prompt into three tiers via `<!-- CACHE_BREAK:AFTER_CORE -->` and `<!-- CACHE_BREAK:AFTER_CHARACTER -->` markers. Tier 1 (universal-static: Cardinal Rules, Craft, Conversation, examples, mechanical markers) — cached across all sessions. Tier 2 (per-character static: world setting, character identity, progression) — cached across turns of one session. Tier 3 (dynamic: live context, world state, chronicles) — uncached.
**Why:** Maximize cache hits while keeping live context fresh.
**Implications:** Any new prompt content must be classified by tier. Putting dynamic state in tier 1 or 2 breaks the cache silently — the v1.0.96 fix corrected exactly this problem in tier 2.
**Related:** [`server/services/claude.js`](server/services/claude.js) `buildSystemParam`

### 2026 (earlier) — Marker-based game-state mutation (Architecture)
**Context:** AI DM's narrative output needs to actually change game state (drop items, deal damage, advance quests, etc.) without breaking immersion.
**Decision:** ~25 game-state markers the DM AI emits inline (`[COMBAT_START]`, `[LOOT_DROP]`, `[MERCHANT_SHOP]`, `[CONDITION_ADD]`, `[PROMISE_MADE]`, etc.). Server-side detection parses them out before display, applies the state change, and (for some markers) injects a system message back into the conversation so the AI references the real outcome.
**Why:** Markers are the only place mechanics surface in the AI's output; everything else stays fictional. Single discipline; auditable; verifiable.
**Implications:** Marker schemas are part of the prompt (in MECHANICAL MARKERS section). Adding a new marker requires: (1) update prompt schema, (2) add detection in `dmSessionService.js`, (3) wire to the action that fires the state change, (4) handle the back-injection if relevant. Verifiers exist to catch malformed markers and feed corrections to the next turn.
**Related:** [`server/services/dmSessionService.js`](server/services/dmSessionService.js), [`server/services/ruleVerifiers.js`](server/services/ruleVerifiers.js)

### 2026 (earlier) — Persistent merchant inventories from loot tables (not AI-generated per visit) (Architecture)
**Context:** AI-generated merchant inventories felt random and disconnected. Players couldn't predict what was where; the world didn't feel like it had a real economy.
**Decision:** Per-merchant persistent `merchant_inventories` table. Inventories generated once from loot tables (DMG + XGtE items across 5 rarities, scaled by prosperity + character level). The AI references the actual inventory; doesn't make items up. `[ADD_ITEM]` marker exists for narrative additions, but the default is "what's on the shelf is what's in the data."
**Why:** Persistent economy. World feels real. Bargaining and price modifiers actually mean something because the items are stable.
**Implications:** Merchant generation happens at campaign-plan time. Restock logic is per-merchant. Cursed items (~13) display as their disguise to maintain the cursed-item experience.
**Related:** [`server/data/merchantLootTables.js`](server/data/merchantLootTables.js), [`server/services/merchantService.js`](server/services/merchantService.js)

### 2026 (earlier) — Living world tick pipeline (between-session world advancement) (Architecture)
**Context:** A static world between sessions feels dead. Without something happening when the player isn't playing, the world doesn't feel alive.
**Decision:** Between-session orchestration pipeline: weather → factions → events → conflict quests → companions → NPC mail → consequences → survival → base income → base threats → notoriety → custom-order delivery → record. Runs when a new session starts; advances world state by elapsed game time.
**Why:** The world is alive. NPCs do things while the player is away. Factions advance their goals. Threats accumulate. The narrative queue surfaces what happened at session start.
**Implications:** Each subsystem (weather, factions, events, etc.) is independently developable. Adding a new world-advancing system means adding it to the tick. Off-screen companion activities, base raids, world events, and NPC mail all flow through this.
**Related:** [`server/services/livingWorldService.js`](server/services/livingWorldService.js)

### 2026 (foundational) — Stack: ES modules, no TypeScript, no CSS framework, SQLite via @libsql/client (Architecture)
**Context:** Baseline tech-stack decisions made early in the project's life.
**Decision:** All JS is ES modules (no CommonJS). No TypeScript. No CSS framework (inline styles or per-component classes only). React 18 + Vite frontend. Node + Express backend. SQLite via `@libsql/client` (local `file:local.db` or Turso cloud — interchangeable).
**Why:** Solo project; aggressive simplicity; minimal toolchain. TypeScript adds friction without enough payoff for this team-of-one. CSS frameworks add lock-in. SQLite scales fine for one user; Turso option exists if cloud sync is wanted later.
**Implications:** Don't introduce TypeScript. Don't introduce a CSS framework. Don't split the largest components (`DMSession.jsx`, `CharacterSheet.jsx`, `CharacterCreationWizard.jsx`) without explicit plan — they're large but cohesive. New JS code is ES modules with `import`/`export`. Migrations are numbered (`server/migrations/NNN_*.js`); after ~011 they're additive only.
**Related:** [`CLAUDE.md`](CLAUDE.md) "Stack & conventions"

### 2026 (foundational) — Custom assertions in tests; no test framework (Process)
**Context:** Solo project; aggressive simplicity.
**Decision:** Tests live in `tests/`; each is a Node script using `assert(condition, message)`. No Jest, no Mocha, no Vitest. Real Turso DB used in integration tests with `TEST_`-prefixed data, cleaned up per run.
**Why:** No framework lock-in. Trivial to debug. Tests are scripts you can read top to bottom.
**Implications:** Adding a test means adding a `.test.js` file under `tests/`. Run with `node tests/<file>.test.js`. Mandatory before push for any non-trivial change (per CLAUDE.md). Results logged to `TEST_RESULTS.md`.

### 2026 (foundational) — Authentication: JWT + bcrypt; campaigns scoped to user (Infrastructure)
**Context:** Even though the project has one user today, the auth model needed to be in place from the start (especially if shared with friends later).
**Decision:** JWT-based auth, bcryptjs for password hashing. JWT secret auto-generated and stored in `_app_settings`. Middleware verifies Bearer token on `/api/*` except `/api/auth/*` and `/api/health`. Campaigns scoped to `user_id`.
**Why:** Standard pattern, low complexity, ready for multi-user without refactor.
**Implications:** Anything new touching `/api/*` automatically requires auth. New tables that store user-specific data should include a `user_id` column.

### 2026 (early baseline — being challenged) — Opus for ALL generation, Sonnet for sessions only (Direction)
**Context:** Cost discipline. Opus is ~10× Sonnet at runtime. Generation tasks (campaign plan, NPCs, quests, locations, companions, adventures, prelude arc) run once and are heavy; sessions run many times and need to be cheap.
**Decision:** Opus handles ALL generation tasks (one-shot heavy lifting). Sonnet handles ALL interactive DM sessions. Exception: the first session opening uses Opus for narrative richness.
**Why:** Cost-aware (principle #3). Sonnet is "good enough" for ongoing interaction.
**Status:** **Being challenged** by the v1.0.96 prose-quality investigation. User playtest confirmed Opus is the prose-quality lever. The cache fix made Opus tenable as a continuation default. Pending decision in Open Decisions above.
**Implications:** If Opus becomes the new default for sessions, this entry gets superseded. If Sonnet stays default, the home-page toggle stays as the user's escape hatch.

---

## Closed / superseded

(Nothing yet — when a decision is reversed or replaced, move it here with a note pointing to the replacement.)
