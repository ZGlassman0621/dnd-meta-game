# Changelog

All notable changes to the D&D Meta Game project will be documented in this file.

## [2.8.1] - 2026-06-09 — Data-integrity fixes from second-pass code review (turn persistence + reward claim)

Two correctness fixes for silent state-corruption paths surfaced by an adversarial
second-pass code review, plus the mock-Anthropic integration harness that unblocks
testing the god handlers. Unlike the behavior-preserving 2.8.0 pass, these DO
change behavior on purpose — they stop data loss and double-application.

- **Rolling-summary index desync — long campaigns no longer forget their middle
  (review finding #1).** `dm_sessions.messages` was both the durable history AND
  the per-turn API buffer; once the rolling summary fired, the COMPACTED
  send-buffer was persisted back, permanently dropping the summarized-away
  verbatim messages and freezing `rolling_summary_through_index` (an absolute
  index that was never translated to the new array coordinates). Over a long
  campaign the model structurally forgot the conversation's middle, and a safety
  guard could silently stop injecting the summary entirely. Fix
  (`routes/dmSession.js` `/message`): persist the FULL, uncompacted history —
  prior turns verbatim plus this turn's new pair — instead of the compacted
  buffer. The model still receives the compacted prompt (rolling summary +
  reactive compressor are unchanged on the send path), so the prompt stays small
  while the durable array only ever grows by appending, keeping the through-index
  valid and advancing turn over turn. Sessions already compacted by the old code
  can't be un-corrupted (the append-only `transcript` retains their raw history)
  but stop losing data immediately.
- **`/claim` is now atomic and idempotent (review finding #3).** Claiming session
  rewards was a check-then-act race: read `rewards_claimed`, ~90 lines of work,
  then set the flag LAST via a bare `dbRun` — so a double-click / retry could pass
  the guard twice and double-award XP, gold, loot, and companion XP, and a crash
  mid-sequence left the character credited with the flag still unset (re-applied
  on the next claim). Fix: the whole claim runs in one `withTransaction` guarded
  by a CONDITIONAL flag flip (`UPDATE … SET rewards_claimed = 1 WHERE id = ? AND
  rewards_claimed = 0`); only the first claimer (`changes === 1`) applies rewards,
  and any throw rolls the flag back with the rest. Response shape unchanged.
- **Mock-Anthropic integration harness (new).** `tests/helpers/mockAnthropic.js`
  intercepts `api.anthropic.com` at the `fetch` layer (passing every other URL —
  including libsql/Turso traffic — straight through) so integration tests drive
  the real `/message` and `/claim` handlers with deterministic AI output, no
  network, and no token spend. `tests/helpers/dmTestApp.js` mounts the real router
  on an ephemeral port with TEST_-prefixed, self-cleaning seed data.
- **New regression suites.** `tests/dm-turn-lifecycle.test.js` drives several
  turns through the real handler and asserts no verbatim message is ever dropped
  and the through-index advances monotonically — confirmed to FAIL on the pre-fix
  code (durable history compacted 33→26, `PRIOR_0` lost, index frozen at 8) and
  PASS on the fix. `tests/claim-idempotency.test.js` fires two concurrent claims
  and asserts the reward lands exactly once (XP 100 not 200, one loot copy, the
  loser gets a clean 400). 7 adjacent suites stay green (rolling-summary,
  with-transaction, session-transcript, marker-pipeline, phaseB-spine). The
  lifecycle test's index-advance assertions are SOFT (the through-index is written
  by a fire-and-forget background roll) so a slow Turso write can't flake the
  build red; the race-free durable-history guards stay hard. Missing-env runs
  print a loud `HARNESS SKIPPED — DID NOT RUN` banner so a green exit is never
  mistaken for a real pass.
- **Known follow-up (deferred to the history-bounding pass).** Because
  `dm_sessions.messages` is now the full uncompacted history, the session-BOUNDARY
  LLM calls that read it directly (end-session analysis/notes/NPC/memory
  extraction, `/resume` recap, retroactive `/extract-npcs`) now send the full
  history with no compression — a token-cost/latency increase on long sessions at
  session end (NOT the hot per-turn path; the per-turn prompt is still compacted).
  No correctness impact and within the 200K context window. To be bounded
  alongside the other LLM-input-bounding work (reactive-compressor middle-truncation
  and the unbounded chronicle load) — these calls need their own size guard
  mirroring `storyChronicleService`'s 40000-char cap.

## [2.8.0] - 2026-06-09 — Code-quality & data-integrity refactor (no functionality change)

A focused, behavior-preserving hardening pass driven by an architecture audit.
Every change keeps runtime behavior identical on the normal/valid path; the only
intentional differences are graceful fallbacks on *corrupt* data, atomicity on
*failure*, and serialization of *concurrent* writes. An adversarial multi-agent
review of the full diff (6 reviewers) found **zero behavior changes on valid
paths**. 17 existing test suites stay green; 5 new suites were added.

- **Crash-proof DB JSON reads.** Replaced 18 raw `JSON.parse()` calls on
  database-sourced columns with the existing `safeParse()` helper, so one
  corrupted row degrades gracefully instead of 500-ing the whole endpoint
  (`chronicle.js` ×8, `progression.js`, `companion.js`, `services/metaGame.js`,
  `backstoryParserService.js`, `companionBackstoryService.js`). `metaGame` keeps
  its `typeof` object-passthrough guard; backstory mutation paths keep their
  throw-on-corrupt (same 500), so corrupt data is never silently mutated.
- **Atomic writes (`database.withTransaction`).** New libsql write-transaction
  wrapper whose `get/all/run` mirror `dbGet/dbAll/dbRun`. Multi-row sequences are
  now all-or-nothing (companion **level-up**, **equip**/**unequip**, **dismiss** —
  a mid-sequence failure no longer leaves an item vanished or a companion leveled
  without its unlocks). Single-column read-modify-write endpoints (character +
  companion **spell-slots use/restore**, **conditions add/remove**,
  **discard-item**) are wrapped so the write-lock serializes concurrent
  mutations, closing last-write-wins races. Statuses and response bodies are
  byte-identical. Verified empirically: 12 concurrent increments commit with zero
  lost updates.
- **One marker-strip pass (`stripKnownMarkers`).** The per-turn route scrubbed
  DM markers from player-facing narrative via 31 inline `.replace()` calls;
  consolidated into a single compiled-regex helper in `markerSchemas.js`.
  `tests/strip-known-markers.test.js` proves byte-identical output to the legacy
  chain across 50 inputs (every marker, bodyless forms, adjacency, multiline).
- **Single source of truth for ability math (`dndMath`).** The ability-modifier
  formula was copy-pasted 15+ times. Added a canonical module on the server
  (`server/utils/dndMath.js`, re-exporting the authoritative proficiency/hit-dice
  tables) and the client (`client/src/utils/dndMath.js`), and migrated the
  byte-identical sites (`character.js`, `gameStateMarkerService.js`,
  `LevelUpPage`, `CompanionEditor`, `CompanionSheet`, `CompanionManager`).
  `tests/dnd-math.test.js` proves equivalence to the legacy formulas across the
  full valid domain.
- **Perf.** Companion progression enrichment at session start now runs
  concurrently (`Promise.all`) instead of a sequential per-companion N+1.
- **Test hygiene.** Three suites failed at baseline because they exercised
  `PROMISE_MADE`/`NOTORIETY_GAIN`, which were deliberately removed from
  `MARKER_SCHEMAS` in the v2.0 MVP reduction (consumer services live in
  `/archive`, no handlers registered). Rather than resurrect archived schemas,
  the assertions were retargeted to the same parser capabilities on live markers
  (`marker-schemas` 40/9→48/0; `marker-pipeline` crash→44/0), and the
  archived-import suite was relocated to `archive/tests/`.
- **New tests:** `with-transaction`, `dnd-math`, `strip-known-markers` (+ the two
  retargeted marker suites). Deferred (documented) follow-ups: thinning the
  `/message` handler, deeper character/companion mirror-logic extraction,
  transactions for debt/recruit paths that delegate to shared services, and a
  centralized client API client.

## [2.7.0] - 2026-06-09 — Narration clarity guardrail + roll-your-own dice

Two playtest fixes:

- **Narration clarity (clear-but-atmospheric).** The DM prompt rewarded
  SHOW-DON'T-TELL and FRESH IMAGERY with no counterbalance, so narration drifted
  into opaque poetry (e.g. "the light came up out of the middle of you boys" —
  meant as a gut-punch, read as gibberish). Added a **CLARITY OVER CLEVERNESS**
  craft principle (right after ANSWER FIRST) and a clarity item to the
  BEFORE-YOU-SEND gut-check: keep mood and sensory detail, but the player must
  understand it on the first read; metaphor only when the plain meaning is
  obvious. Atmosphere stays; obliqueness goes. Prompt suites green (dm-prompt
  30/30, character-memory 56/56, moral-diversity 59/59, lines-and-veils 27/27).
- **Roll your own dice.** Pending roll cards (the DM's requested checks/attacks)
  now have an "or your roll:" field beside the in-app button — type your physical
  d20 (1–20) and "Use my roll." It produces the same rolled state as the animated
  roller, so the DC/Resolve flow that reports back to the DM is identical. The
  in-app roller stays. (Investigated the "low rolls" report first: the RNG is a
  fair uniform 1–20 and difficulty never touches the roll — this is purely for
  players who prefer physical dice.)

## [2.6.3] - 2026-06-09 — Expand equipment pack contents into inventory

Equipment packs (Explorer's Pack, Dungeoneer's Pack, etc.) were stored as a
single inventory line, so neither the player nor the DM (which reads the
inventory) could see or use the contents — bedroll, rations, rope, torches were
invisible. Now:
- **Creator (new characters):** `creatorPersistence.js` expands a picked pack
  into its individual items at commit, tagged with `pack_source` for provenance.
- **Existing characters:** migration **055** backfills stored inventories,
  replacing any pack line with its contents (idempotent; PHB pack contents kept
  in sync with `equipment.json`). Applied to the live Turso DB and verified — the
  in-progress character's Explorer's Pack expanded into its 8 items.

Dice note (no change): investigated the d20 RNG on a report of low rolls — it's a
fair uniform 1–20 (`Math.floor(Math.random()*sides)+1`), and the difficulty
setting is never passed to the roll or the DM. The roll isn't biased; hard-mode
difficulty raises DCs (and a level-1 character's modifiers are modest), which is
what makes fair rolls fail more often.

## [2.6.2] - 2026-06-09 — Silence the harmless punycode (DEP0040) deprecation warning

A transitive dependency — `whatwg-url` (pulled in by the libsql/HTTP client
stack) — still does `require('punycode')` on Node's deprecated built-in module,
printing `(node:NNNN) [DEP0040] DeprecationWarning: The punycode module is
deprecated` on every server start. It's harmless (punycode still works) but
clutters the console. Added `server/suppressDeprecation.js` (imported first in
`server/index.js`, before any dep loads) that patches `process.emitWarning` to
swallow **only** DEP0040 / punycode and pass every other warning through — so
genuine deprecation notices still surface. No dependency changes; remove the file
if `whatwg-url` upstream ever switches to the userland `punycode` package.

## [2.6.1] - 2026-06-08 — Fix missing npcs.distinguishing_features column + stop stale-bundle caching

- **Bug: `SQL_INPUT_ERROR: no such column: n.distinguishing_features`.** The NPC
  enrichment pipeline (`storyChronicleService` / `dmSessionService`) and
  `npcRelationshipService.getCharacterRelationshipsWithNpcs` both read and write
  `npcs.distinguishing_features`, but no migration ever added the column — so
  gathering world state for a DM session threw and the NPC-relationship context
  silently dropped out of the prompt. Migration **054** adds the column
  idempotently (applied to the live Turso DB; verified present).
- **Stale client bundle after a rebuild.** `index.html` is now served with
  `Cache-Control: no-cache`, so a normal browser reload always picks up the latest
  hashed bundle instead of the browser holding an old shell that fetches dead chunk
  hashes (the "Failed to fetch dynamically imported module …" error). Content-hashed
  JS/CSS assets keep their immutable caching.

## [2.6.0] - 2026-06-08 — Collaborative campaign builder: contextual, finite, partner-like

The "Build it together" conversation worked but read like an interrogation — it
praised every answer, only ever extracted (never pitched), kept drilling things
the player wanted left open, and never offered to stop (the player had to ask
"how many more questions?"). Overhauled it into a real creative partner:

- **A "why" on every question.** Each question now carries a one-clause purpose
  ("this is the campaign's spine"), shown as a sub-line, so you know what it
  shapes and why it's asking.
- **A finite, visible budget.** A "Question N of ~8" counter — roughly 6–10
  questions mapped to the things a campaign actually needs (tone, the hero's
  drive/wound, opening, setting, central threat, allies, ending, scope) — not an
  open-ended interview.
- **Offers to draft early + hands you the wheel.** The moment it has the
  essentials (often ~6–7), it flips a `readyToDraft` flag, shows a "Ready to
  draft" cue + hint, and plainly offers to write it up. The budget is a ceiling,
  not a quota; you can draft anytime.
- **Pitches ideas when you defer.** Say "you tell me" and it proposes a concrete
  option or two instead of asking again.
- **Honors what you leave open.** Say "leave it a mystery" and it acknowledges it
  as a deliberate hook and moves on, instead of re-drilling it.
- **No praise-padding.** Substantive reactions (observations, "yes-and",
  consequences), never "that's great" every turn.

Technically: `/api/campaign/converse` now returns structured
`{reply, why, readyToDraft}`; `converseCampaign` accepts `questionNumber` (for
pacing + the counter) and parses the JSON via `extractLLMJson` with a raw-text
fallback. The client renders the counter, the "why" sub-line, and the draft-ready
emphasis. The new conversation prompt was synthesized via a judge-panel of
candidate prompts. Verified live on the user's real survival scenario: it honored
two "leave it open" signals, pitched the alpine setting when the player deferred,
offered to draft at question 7, and praised nothing across the whole run.

## [2.5.1] - 2026-06-08 — Collaborative campaign builder: plain, conversational voice

The "Build it together" conversation was too wordy and hard to collaborate with —
because `CONVERSE_SYSTEM_PROMPT` told Opus to use "literary, warm, manuscript
prose" with `*asterisk*` emphasis, producing overwrought replies ("I can already
smell the brine and the old money"). Rewrote it for **plain, conversational
English**: talk like a friend planning a game at the table, keep replies short
(aim under 50 words), and ask **one concrete question at a time** ("Who's the
villain?" / "Happy ending or a bleak one?") rather than paragraphs of questions.
Per-turn instructions and the on-screen intro copy were plained-up to match. The
separate literary draft prompt (`SYSTEM_PROMPT`) is untouched, so the *final*
campaign prose stays evocative — only the back-and-forth changed. Verified live:
turns now run ~35–50 words, plain voice, one question each.

## [2.5.0] - 2026-06-08 — Begin a Campaign: collaborative "Build it together" + Quick Start

The "Begin a new Campaign" flow no longer jumps straight from your sentence to a
finished campaign. It now offers two deliberate paths:

- **Build it together (collaborative, the new default).** Instead of drafting
  immediately, Opus *converses* — it reacts to your idea and asks a few sharp,
  generative questions (tone, stakes, who betrays whom, what you want to feel),
  building on each answer, in the existing chat thread. It will not write a
  title/premise/scene until you click **"Draft it from our conversation"**, which
  then authors the full draft from everything you discussed and drops you into the
  usual compose view (nudge / rail / begin). Reached from the prompt box's
  "Build it together" button and the character-thread seed card.
  - Backend: new `CONVERSE_SYSTEM_PROMPT` + `converseCampaign()` +
    `POST /api/campaign/converse` (prose, asks questions, never drafts); the
    client passes the running conversation each turn. `draftCampaign()` /
    `/api/campaign/draft` gained a `conversation` field that becomes the brief
    when drafting from a conversation. Subject resolution refactored into a shared
    `resolveSubject()`.
- **Quick Start ("Surprise me").** A dedicated screen with *only* campaign length,
  genre/tone, and lines & veils — no premise box, no details. Opus conjures a full
  draft from those dials (`seed: 'surprise'`) and drops you into compose. Reached
  from the greeting's "Surprise me" card.
- The greeting presents both paths; "Start over" now resets from any mode
  (greet / converse / quickstart / compose).

Verified end-to-end against the live server (real Opus calls): the converse turns
ask questions without leaking a draft, draft-from-conversation reflects the talk,
and quick-start authors from dials alone. Client build clean.

## [2.4.3] - 2026-06-08 — Lifestyle wired into the DM prompt as flavor (no gold mechanics)

Lifestyle was 100% inert — the player picks one of 7 tiers in the creator, it's
stored and shown to the DM as a bare cosmetic line, but nothing used it (the
downtime/survival/upkeep systems that would were archived in the v2.0.0 cut).
Per the chosen direction, it's now **wired into the DM prompt as social/economic
texture** rather than a stat: the identity-block line for each tier (Wretched →
Aristocratic) now carries a concise directive about where the character sleeps,
what they can afford, and how NPCs first read their station ("Let this colour
lodging, prices, and how NPCs first read the character"). No gold deduction, no
character-sheet change, no new systems — `dmPromptBuilder.js` only. Honors the
player's choice now; a real upkeep mechanic remains deferred with downtime.

## [2.4.2] - 2026-06-08 — Trim long cleric domains + make the creator review page show every choice

- **Cleric domains trimmed.** Revelry, Wealth, and Stone had 27–30-word
  descriptions (all opening with the redundant "Clerics of the [Domain] Domain…")
  while every other domain is a terse 5–9-word archetype. Recast the three to
  match: Revelry → "Bringer of joy, wine, and divine festivity"; Wealth →
  "Master of commerce, treasure, and divine fortune"; Stone → "Guardian who
  wields the enduring strength of stone".
- **Creator review page (Step 8) now represents every choice.** Four gaps fixed
  so the player can catch anything that isn't true before committing:
  - *Ancestry* showed a bare numeric feat id (e.g. "151") because creator state
    only holds the id and Step 2 fetches feat names from the API. Step 8 now
    re-fetches the same per-race/subrace feat list and shows the feat **name**
    (`computeAncestryListId` exported from Step 2 for reuse).
  - *Abilities* listed "N additional skill picks" → now lists the actual skill
    names (`state.selected_skills`).
  - *Equipment* listed "N package choices" → now lists each chosen item, with
    sub-picks resolved (the specific instrument/weapon, not the generic label).
  - *Details* showed only alignment + eyes + build + one ideal + a hook count →
    now lays out the full Step-7 record: alignment, faith (resolved to the deity
    name), lifestyle, every physical field, personality / ideals / bonds / flaws,
    and **each backstory hook resolved to its text** (curated moments via
    `THEME_BACKSTORY_MOMENTS`, plus custom moments). Review rows gained an
    optional rich `body` for this.

Client build clean.

## [2.4.1] - 2026-06-08 — Playtest fixes: instrument picker, moment alignment, campaign scoping + delete, coined genre chips

Four fixes from a play session.

- **Equipment — "Any Other Musical Instrument" now opens a picker.** The
  equipment-option resolver only recognized generic *weapon* choices ("Any
  Simple Weapon"), so musical-instrument / artisan's-tools / gaming-set choices
  fell through with no dropdown. Added `getToolChoiceList()` (equipmentResolver)
  — recognizes "musical instrument", "artisan's tools", and "gaming set" labels
  (including the combined "artisan's tools or one musical instrument" form) and
  returns the pickable list from `equipment.json`. Step 6's option card renders
  the same picker pattern as the weapon one; the chosen item persists through the
  existing `equipment_subpicks` path (no backend change). Specific tools like
  "Thieves' Tools" correctly don't trigger a picker.
- **Creator — BACKSTORY MOMENTS now align properly.** The moment chips are
  `<button>`s (which default to `text-align:center`) laid out with
  `align-items:center`, so sentence-length moments rendered centered and ragged.
  Converted the moments list to a full-width, left-aligned stacked list with the
  radio top-aligned to the first line (matching the picked-chips rows above).
  Scoped to `.chipwrap`/`.mchip`, which are used only by the moment list.
- **Campaigns — fixed cross-character "bleed" + made delete discoverable.** The
  campaign list is workspace-wide (every campaign the local user owns), and the
  page featured `filteredCampaigns[0]` — the first active campaign *globally* —
  so a brand-new character's page surfaced a *different* character's campaign as
  if it were theirs. The feature is now scoped to the character's own
  `campaign_id`; a character with no campaign sees a clear "hasn't begun a
  campaign yet" state instead. "Other campaigns" cards now label which character
  each belongs to (or "Unassigned"), and every card carries a visible delete
  affordance (plus a Delete button on the featured campaign) so removing a
  campaign no longer requires digging into the detail panel. `deleteCampaign`
  already unassigns characters and cleans up related rows.
- **Begin Campaign — Opus-coined genres/tones no longer vanish, and read as
  real.** When Opus invents a genre/tone word (e.g. "Melancholy"), it lived in
  the palette only while selected — toggling it off removed it irrecoverably, and
  nothing signaled whether it actually mattered. Coined words are now tracked
  separately from the selection so their chips persist in the palette (dim when
  off, re-pickable), are marked with a ✦ and a tooltip, and a one-line hint makes
  explicit that lit chips (coined ones included) are sent to Opus and shape the
  campaign. They were always real — `toneSummary` already flowed coined words to
  `dials.tones` (draft) and `committed.tones` (commit); the fix is visibility +
  persistence, not wiring.

Client build clean.

## [2.4.0] - 2026-06-08 — DM prompt overhaul: fix early-session "forgetting" + creative-but-constrained

Following a deep multi-agent architecture audit of how the app drives the AI DM,
a four-tier pass that fixes the DM losing the thread early in fresh sessions and
relaxes the over-constraint that was stiffening prose — without touching the
load-bearing guardrails (player sovereignty, no-spoiler, content boundaries,
marker contract). The diagnosis: it was never history-trimming (compaction only
fires at 70–85% of budget) — it was the *frozen system prompt* drowning a short
early transcript and telling the model to rank the transcript below an empty
memory ledger.

**Tier 1 — memory hierarchy + bulk + stale state** (`dmPromptBuilder.js`):
- The MEMORY HIERARCHY, the always-on "past sessions are canonical" paragraph,
  and the quest-weaving paragraph are now **gated on real stored memory**. A
  fresh campaign (empty chronicle/canon/NPC tables) instead gets one line making
  the live transcript authoritative — it was previously ranked *below* an empty
  canon ledger ("never overrides chronicle"), the most direct early-forgetting
  mechanism. Populated sessions render the full hierarchy exactly as before.
- Trimmed the Conversation-Handling example bank (the COUNCIL/CROSSTALK
  transcripts featuring NPCs that don't exist in the player's game, plus the
  AGE&REGISTER and SHOW-DON'T-TELL banks); kept the 4 MODE definitions + ladder
  + a short SPOTLIGHT/WAIT exemplar.
- Stopped asserting a frozen Current Location/Quest (built once at /start; goes
  stale within a few exchanges and reads "Unknown/None" early, contradicting the
  opening scene). The transcript + campaign-plan opening scene own them now.

**Tier 2 — cut self-policing / stiffness** (`dmPromptBuilder.js`, `dmSession.js`):
- BEFORE-YOU-SEND self-check shrunk from a 5–6 item QA pass (a near-verbatim
  restatement of the Cardinal Rules in the recency slot) to a 1–2 item gut-check:
  player sovereignty + the conditional content-boundary check.
- CRAFT PRINCIPLES recast from a prohibition wall ("Don't pad / Never bury /…")
  into positive directives, intent preserved.
- `[SCENE]` marker made conditional (emit on change, not every turn) so the
  closing line lands the narrative beat instead of a schema tag.
- The per-turn correction loop now injects only **load-bearing** rule violations
  (sovereignty/dice-UX) + marker-schema failures; the cosmetic prose-tic
  ("X goes still", Rule 19a) is detected for logging but no longer nags the next
  turn.

**Tier 3 — keep the transcript clean** (`dmSession.js`):
- Active conditions/effects are no longer pushed as fake user-role messages that
  persisted and accreted between the DM's narration and the player's action.
  They're built into a per-turn system-tail block (sent, not persisted).
- `stripEphemeralStateNotes()` runs at every `result.messages` persist site,
  removing legacy condition/effect notes + loot-drop receipts from the stored
  transcript while preserving the COMBAT_START initiative note (the DM needs the
  rolled order) and the durable /inject-context GM note.

**Tier 4 — response cap + cache floor** (`claude.js`):
- DM-turn `max_tokens` 4000 → 8000 (long opening scenes were truncating
  mid-thought and dropping trailing markers). Streaming for even longer turns is
  deferred (touches the client contract).
- `CACHE_MIN_TOKENS` 1024 → 4096 to match Opus 4.x's real cacheable-prefix
  minimum (1024 is the Sonnet floor; sub-4096 tiers carried a no-op cache marker).

Each tier shipped as its own commit, with a verification checkpoint after Tier 1.
Tests: dmPrompt-linesAndVeils 27/27 (new memory-gating assertions),
dm-prompt-builder 30/30, moral-diversity 59/59, character-memory 56/56,
progression-prompt 43/43, session-transcript 8/8, condition-tracking 56/56
(two anchor assertions updated to the new self-check/craft wording). Pre-existing
marker-schema failures (archived PROMISE/NOTORIETY schemas) are unrelated.

## [2.3.0] - 2026-06-07 — Begin a new Campaign: design refresh (character-scoped + lines & veils)

Integrated the revised `design_handoff_hearth_app/Begin Campaign.html` design (the
handoff was updated after v2.2.0 shipped) into the live atelier.

- **Greeting is now always character-scoped.** Dropped the "Who walks into this
  story?" character/world choice — campaign creation always belongs to the
  character you entered through (it's reached from that character's Campaigns
  screen). Added a "Creating for <name>" context line (mini-crest), personalized
  Opus's copy with the character's name, and reordered so the free-text prompt is
  the primary entry with the seeds beneath it.
- **Seeds name the thread they pulled from.** The character-grounded seed is
  labelled from the strongest thread on the sheet ("From your background · Hermit"
  / "…your calling · Monk"), and choosing it asks Opus to build from that thread;
  "Surprise me" generates from scratch. (Seeds no longer assume a rich freeform
  backstory field exists.)
- **Compose rail upgrades** (`BeginCampaign.jsx` + `hearth-begincampaign.css`):
  - **Scope** "Open-ended" → **"Ongoing campaign"**.
  - **Genre & tone** is now a live summary with a **Change** link that expands a
    grouped Genre/Tone palette (multi-select); selections are carried into the
    committed campaign.
  - **Setting** gains an inline **Edit** editor (name + descriptor) with a **"Let
    Opus reimagine"** action; saving updates the setting tile, the premise's
    region chip, and the plan-forming Region row together.
  - **Your party** shows the hero alone with the note "companions join as the
    story finds them" (pre-picking companions stays out of scope for v1).
  - **Content boundaries** opens a real **Open / Veil / Line** modal across eight
    sensitive topics, with a legend and a live "N set" count.
- **Persistence:** `POST /api/campaign/begin` + `beginCampaign()` now accept the
  table's `linesAndVeils` and store them (validated to open/veil/line) on the
  campaign plan as `lines_and_veils`; the committed draft also honours the rail's
  scope/tone edits. `tests/beginCampaign-flow.test.js` covers the new persistence
  (invalid entries filtered). Client `vite build` passes (127 modules).
- **The DM now reads the whole atelier design.** Previously the co-authored plan
  was stored in a shape `getPlanSummaryForSession()` mostly dropped, so the DM
  barely saw the world the player built. Now the summary carries the atelier
  fields through (`premise` → main-quest summary, `opening_scene`, `region`/
  `setting`, `hidden_truth`, `scope`, `locations`, the `tone` leanings, and
  `lines_and_veils`), and `formatCampaignPlan()` renders them into the DM system
  prompt: a **SETTING** line, **KEY LOCATIONS**, the **OPENING SCENE**, a DM-only
  **HIDDEN TRUTH**, and **CAMPAIGN SCOPE**.
  - **Content boundaries are enforced, not just stored.** Lines & veils render as
    a **non-negotiable CONTENT BOUNDARIES block** near the top of the plan
    (primacy) — LINES never appear (on- or off-screen), VEILS happen off the page
    — and are reinforced as a conditional 6th item in the BEFORE-YOU-SEND
    self-check (recency), mirroring the prompt's existing top/bottom rule pattern.
    Canonical/imported plans are unchanged (the atelier sections only render when
    present). `formatCampaignPlan` is now exported; `tests/dmPrompt-linesAndVeils.test.js`
    (20/20) asserts the boundaries, opening scene, and hidden truth reach the
    prompt, with a control proving the self-check is absent when no boundary is set.

## [2.2.0] - 2026-06-06 — Begin a new Campaign (conversational atelier)

A new screen where Opus authors your world while you set the mood, built from the
Hearth `design_handoff_hearth_app/Begin Campaign.html` design.

- **Frontend** `client/src/components/BeginCampaign.jsx` + scoped
  `client/src/styles/hearth-begincampaign.css`: a two-state atelier — a Greeting
  (who walks in / a backstory seed / "start from the world" + a free-text prompt)
  and a Compose view (a manuscript-prose dialogue thread with Opus, a living
  premise card + opening-scene preview with drop-cap, nudge chips, and a right
  rail of dials — scope/tone/setting/party/difficulty/lines&veils — over a
  "campaign plan · forming" mini-panel), ending in a cinematic "Begin the first
  session" that plays while the opening scene generates and drops into the cockpit.
- **Backend** `server/services/campaignDraftService.js` + `POST /api/campaign/draft`
  and `POST /api/campaign/begin`: Opus authors a structured campaign draft from
  the prompt + dials (and refines it on nudges — darker / more hopeful / raise the
  stakes / keep it intimate / one-shot / regenerate); committing creates the real
  campaign, stores the co-authored draft as its plan, and links the character so
  the existing `/start` flow plays it.
- Reached from the Campaigns screen ("Begin a new campaign"); the legacy inline
  new-campaign flow remains as a fallback. `tests/beginCampaign-flow.test.js` — 8/8.

## [2.1.0] - 2026-06-06 — MVP hardening: creation fixes, the mechanical spine, full Hearth, cleanup

A four-phase pass following a full system audit. Made the MVP correct, gave it a
real mechanical backbone, finished the Hearth visual conversion, and cut dead wiring.

**Phase A — character-creation data fixes (critical).** The V2 creator shipped
every new character with HP 0/0, AC 10, empty worn equipment, an orphaned duplicate
draft row, and inventory keyed only by `label`; the manual submit also dropped
theme/ancestry-feat selections.
- `creatorPersistence`: compute worn equipment slots {armor, mainHand, offHand},
  armored AC (mirrors the sheet's formula incl. monk/barbarian Unarmored Defense),
  and L1 max_hp from hit die + CON; add `name` to package items.
- `submitCreator` + `CharacterCreatorV2`: thread the draft `characterId` so submit
  PUTs the 'creating' row in place — no duplicate orphan row.
- `routes/character.js`: server-side derived-vitals safety net on every active
  transition (POST + PUT) so no path can create a 0-HP / AC-10 character; persist
  theme + ancestry-feat on the 'creating'→'active' flip. Backfilled the one broken
  existing character.
- `combatMarkerService`: read `ability_scores.dex` (short key), not `.dexterity`,
  so DEX affects initiative.

**Phase B — the mechanical spine (the "missing frameworks").** The DM narrated
mechanics but the system never tracked them as state. New `gameStateMarkerService.js`
+ marker schemas + route wiring + prompt rules + cockpit UI:
- `[HP_CHANGE]` writes `current_hp` immediately (clamped); the cockpit refetches HP.
- `[EFFECT_START]`/`[EFFECT_END]` track active spell effects + the 5e single-
  concentration rule on the session; injected back into the prompt and shown in the
  Active Effects panel.
- `[CONDITION_ADD/REMOVE]` now persist to `characters.debuffs` (were client-only).
- `[SCENE]` persists to the session and rehydrates the cockpit panel on resume.
- `[TURN]` advances the initiative round/turn (was rolled once, never advanced).
- `[ROLL_REQUEST]` surfaces a one-click "Roll d20 +mod" button preloaded with the
  player's modifier that reports the result back to the DM.
- `tests/phaseB-spine.test.js` — 7/7.

**Phase C — finished the Hearth conversion.** Converted the last legacy-blue
screens on the core path to the Hearth dark-editorial system: Session Setup,
Session Rewards, the Campaign Notes slide-in, and the Companions slide-in. Added
defensive `.hearth` resets so legacy `index.css` form styles stop leaking. Fixed
the roster Settings/AI-Behavior buttons that were painted behind the fixed Hearth
layer (moved into the roster header; dropped the occluded appbar).

**Phase D — cut dead wiring.** Removed the dead companion-activity fetches (the
`/away` endpoint actually hangs) and weather/survival fetches (unmounted → 404 every
turn). `abortSession` + `claimRewards` now return to the roster instead of stranding
the player in DM setup. Removed the unreachable CompanionBackstory view and the dead
PathChoiceScreen + handoff route.

## [2.0.0] - 2026-06-04 — MVP reduction: Player-Mode core with Opus 4.8 as DM

Deliberate, large reduction of the v1.0.167 system down to a focused, reliably
playable MVP: **play one character with Claude Opus 4.8 as your AI Dungeon
Master.** Nothing was deleted — every removed system was **moved to `/archive/`**
(mirrored paths) and remains recoverable; migrations were left in place (orphaned
tables are harmless).

**Kept (the MVP):** the existing 8-step character creator (CharacterCreatorV2);
character sheet / inventory / spells / **leveling**; the full **progression**
system (themes + theme tier abilities + ancestry feats + knight moral paths);
**companions** (recruit / sheet / level-up / backstory); the Player-Mode DM chat
session; **session memory** (story chronicles + canon facts + NPC conversation /
relationship recall + NPC lifecycle / aging); campaign creation + Opus campaign
plan + JSON import + backstory parser; dice / combat / conditions; session
rewards; the AI-behavior debug page; edit-in-wizard (legacy creator, edit-only).

**Archived → `/archive/`:** prelude character-creator; DM Mode (user-as-DM);
mythic + piety + epic boons + legendary items; crafting; party bases / fortresses
/ raids; downtime activity system + long-term projects; merchant economy +
bargaining + commissions + merchant relationships + economy sim; notoriety; the
living-world tick (weather, survival, factions, world-events, NPC mail, narrative
queue, consequence/promise automation); the factions / world-events / travel /
locations / quests simulation cluster; achievements; the odds-based "adventure"
meta-loop; subclass×theme synergies / team tactics / mythic×theme amplifications.

**Other changes.**
- All gameplay AI repointed to **`claude-opus-4-8`** (was `claude-opus-4-7`).
- **Login removed** — a no-op auth middleware resolves a single local user; no
  sign-in screen. (Revert `server/middleware/auth.js` + the App.jsx gate to
  restore JWT auth.)
- DM marker set reduced to the 6 live markers (COMBAT_START/END, LOOT_DROP,
  CONDITION_ADD/REMOVE, NPC_WANTS_TO_JOIN); the DM prompt no longer documents
  cut-system markers.
- Cut-system tests moved to `/archive/tests/`; cut-system `server/tests/`
  scripts archived.

**Verification.** Server boots clean; client `vite build` passes (114 modules,
down from 200+); ESLint shows no undefined-reference errors; a live Opus 4.8 DM
turn was exercised end-to-end (start → message → prompt assembly → Opus →
narrative → save).

---

## [1.0.0.167] - 2026-05-06 — Phase 4a review fix part 2: home-route appbar missed the AI Behavior link

PM 2026-05-06 review caught that v1.0.166's "fix" only landed on one of HomeFlow's two appbars. The path-route appbar (`route === 'path'`, the choice-of-beginnings screen) got the AI Behavior link; the home-route appbar (`route === 'home'`, the default — the user's primary surface) did not.

**Root cause.** The two appbars in `HomeFlow.jsx` use different indentation levels — the path-route block sits inside a `creator-v2` wrapper at 12-space indent; the home-route block sits at 10-space indent. The earlier `replace_all` edit's pattern matched the 12-space version only, silently leaving the home-route appbar untouched. `grep "setAiBehaviorOpen(true)"` showed 1 occurrence at v1.0.166 instead of the expected 2.

**Fix.** Added the AI Behavior button to the home-route appbar with matching indentation. Verified with `grep -c "setAiBehaviorOpen(true)"` → 2 occurrences. Rebuilt bundle now includes 7 "AI Behavior" string occurrences (was 5 at v1.0.166), confirming all three appbar surfaces (HomeFlow home + HomeFlow path + App.jsx dashboard header) ship the button.

**No other changes.** Same code path, same component, same `aiBehaviorOpen` state machine. Pure indentation-pattern miss caught by PM review.

---

## [1.0.0.166] - 2026-05-06 — Phase 4a review fix: AI Behavior debug page entry point in appbar

PM 2026-05-06 review surfaced that v1.0.165's only entry point to the AI Behavior debug page was a card in the dashboard nav grid — invisible from the home screen and inconsistent with the Settings access pattern. PM lean: appbar text link, right side, near the Settings link, visible on home + mid-session same as Settings.

**`client/src/components/creator/HomeFlow.jsx`:**
- Lazy-loaded `AIBehaviorDebugPage` import. Full-screen takeover (same pattern as the wizard / prelude routes) when `aiBehaviorOpen` is true; `onBack` returns to the prior route.
- "AI Behavior" link added to BOTH appbars (home route + path-choice route) beside the existing "Settings" link. Same `.nav-settings` editorial-aesthetic class; uses a `◇` glyph to distinguish from Settings's `✦`. Visible regardless of whether a character exists (the page has its own filter dropdowns and works against an empty log).

**`client/src/App.jsx`:**
- "AI Behavior" button added to the dashboard header beside the Settings button. Same dark-aesthetic inline-style treatment; sets `activeView='showAIBehavior'`.
- Shared `appbarLinkStyle` + `appbarLinkGlyph` constants extracted (DRY across the two header buttons).
- Removed the dashboard nav grid card for "AI Behavior (debug)" — the appbar link is now the single canonical entry point per PM lean. Comment block left in the grid card array referencing this DECISION_LOG ruling so a future reader doesn't re-add it.

**Mid-session access:** DMSession runs inside the dashboard branch with `activeView === 'showDMSession'`; the dashboard header (with the new AI Behavior button) renders above it. Same access pattern as Settings — appbar link visible mid-session, click opens the debug page in a separate view, returning via `onBack` resumes the same DM turn.

Smoke: client build clean (1716 kB index.js, +1KB from glyph + branch logic). No server change. Tests unchanged (the navigation fix is purely UI plumbing).

---

## [1.0.0.165] - 2026-05-06 — Phase 4a: AI behavior diagnostic infrastructure (read-only on production prompts)

PM-authored mini-phase between Phase 3.7 close (v1.0.164) and Phase 4b. Implements [`PHASE_4A_SPEC.md`](PHASE_4A_SPEC.md) end-to-end. Ships the instrumentation that lets the project see what the AI is actually doing — captured prompts, captured responses, derived signals, prompt-shape accounting, debug page + CLI. **No production prompt changes** — Phase 4a is read-only on the AI's actual behavior; tuning is Phase 4b.

**SC-4a.1 — Prompt-response capture.**

- Migration 053 creates `ai_call_log` table with 28 columns covering identity (character_id / campaign_id / session_id / turn_number / prompt_builder / call_purpose), timing (request_started_at / response_received_at / latency_ms), model + token counts (model_id / input_tokens / output_tokens / cache_read_input_tokens / cache_creation_input_tokens), prompt + response content (system_prompt / user_message / conversation_history / response_text / response_status / response_error), prompt-shape (prompt_sections JSON), marker-pipeline annotations (markers_detected / marker_failures / triggered_correction_loop / rule_violations), free-form metadata, and a future `archived_at` hook for eventual pruning. Indexed on (character_id, started_at), (session_id, started_at), (started_at), (call_purpose, started_at).
- New module [`server/services/aiCallLogger.js`](server/services/aiCallLogger.js) exports `logAiCall`, `logAiCallWithId`, `annotateAiCallLog`, `wrapClaudeCall`, `wrapClaudeCallWithId`, and a thin drop-in `loggedChat(callContext, ...chatArgs)` for generator-style sites. Logging is best-effort — DB persistence failures never propagate to the caller; gameplay continues if the log table is unreachable.
- Token-count capture via `options.onApiMeta` callback added to [`server/services/claude.js`](server/services/claude.js) `chat()`. The logger wires this callback automatically; existing call sites are unaffected.
- **All 37 production Claude call sites migrated** to delegate through the logger:
  - **Gameplay-critical paths (with `logAiCallWithId` + post-marker annotation):** dmSession main turn, dmSession start, prelude turn (with rule-2 retry separately tracked), prelude session start, DM Mode session start / turn / roll-reaction.
  - **Chronicle + memory paths:** storyChronicleService chronicle extraction, dmModeChronicleService chronicle + relationship-evolution, npcVoiceService voice extraction, dmModeNpcService NPC voice extraction, rollingSummaryService rolling-summary update.
  - **Generator paths:** preludeArcService Opus arc-plan, preludeSessionService chapter recap, preludeTransitionService biography seed, backstoryParserService, partyGeneratorService, npcMailService, questGenerator, livingWorldGenerator, campaignPlanService, dmCoachingService, adventureGenerator, companionBackstoryGenerator, companionActivityService, locationGenerator, contextManager compression, character-route notes generation, dmMode session summary, dmSession internal sub-prompts (rest check, analysis, notes extract, NPC extract, memory extract, recap, NPC codex extract ×2).
- DM session main turn additionally annotates the row post-fact with `markers_detected`, `marker_failures`, `triggered_correction_loop`, and `turn_number` once the marker pipeline + transcript writer run.

**SC-4a.2 — Quality signal aggregation.**

[`server/services/aiBehaviorSignals.js`](server/services/aiBehaviorSignals.js) — eight signals plus orchestration:

1. `markerCorrectionLoopHits` — count of turns triggering correction prompt next-turn; per-call rate; recent examples
2. `ruleViolationRates` — per-call flagging counts; by-kind buckets
3. `repetitionLedgerTriggers` — repetition-ledger flag counts (sourced from metadata for now; promoted to a dedicated column if Phase 4b investigations need it)
4. `responseLengthDistribution` — token-count distribution per call_purpose (count / min / max / mean / median / p90)
5. `markerEmissionRates` — per-marker-type emission count totals
6. `nameReuseSignal` — heuristic proper-noun extraction; flags names appearing across ≥ 2 character_ids (looks for the OoDL "dozens of distinct named NPCs" pattern; flags divergence)
7. `timeDriftSignal` — best-effort heuristic regex on time-bounded statements ("X arrives in N days" / "ward holds for N hours"); flags subject-keyed value drift within a session
8. `scopeOfInstructionApplication` — **the most important signal per [`PHASE_4_OVERVIEW.md`](PHASE_4_OVERVIEW.md) §6**. Detects autonomy-violation patterns (player_dialogue_attribution / player_thought_attribution / player_emotion_attribution / player_physical_action_directive) regardless of whether the narrow example case is present. Per spec §3.5 v1 is best-effort with explicit caveats; refinement is Phase 4b investigation #1.

`computeAllSignals(filter)` composes all eight in parallel for the debug page + CLI.

**SC-4a.3 — Prompt-shape accounting.**

[`server/services/promptShapeAccounting.js`](server/services/promptShapeAccounting.js):

- `computePromptSections(prompt, builder)` — heuristic section-boundary inference per Q5 ruling. Recognizes `=== SECTION ===`, `ALL CAPS HEADERS:`, `**Bold**`, `# Markdown` patterns. Returns `[{ name, chars, tokens, line_start, line_end }]`. Token estimate is `chars/4` (Claude tokenizer empirical average for mixed prose+structured content).
- Persisted alongside every captured prompt in `ai_call_log.prompt_sections` JSON column.
- Aggregation queries: `lengthDistributionForBuilder`, `sectionContributionForBuilder` (avg tokens + share % per section across calls), `cumulativeContextForSession` (input+output token trajectory), `promptGrowthForSession` (system-prompt growth slope across turns).

**SC-4a.4 — Diagnostic query surface.**

- [`server/routes/aiBehavior.js`](server/routes/aiBehavior.js) — REST API mounted at `/api/ai-behavior`. Endpoints: `GET /calls` (filtered list), `GET /calls/:id` (full detail with parsed JSON columns), `GET /dimensions` (filter dropdowns), `GET /signals/:name` for each of the eight signals + `signals/all`, `GET /prompt-shape/length-distribution`, `GET /prompt-shape/section-contribution`, `GET /prompt-shape/cumulative-context/:sessionId`, `GET /prompt-shape/growth/:sessionId`.
- [`client/src/components/AIBehaviorDebugPage.jsx`](client/src/components/AIBehaviorDebugPage.jsx) — React debug page accessible via dashboard nav card "AI Behavior (debug)". Filter controls (character / session / call_purpose) → signal summary panel + paginated call list + per-call detail pane (full prompt, response, conversation history, marker results, prompt sections breakdown). Editorial register relaxed per spec §5.3 — plain monospace typography, dense two-column layout, no decorative ornaments.
- [`server/scripts/ai-behavior.js`](server/scripts/ai-behavior.js) — CLI tool with subcommands `sessions / signal / calls / export / shape / cumulative`. Pipeable to grep/jq for ad-hoc analysis. Supports `--session-id=last` magic value for "the most-recent session." Same signal functions backing both the page and the CLI.

**Tests** — [`tests/ai-behavior-instrumentation.test.js`](tests/ai-behavior-instrumentation.test.js), 78 assertions all passing:

- **SC-4a.3 section inference (10 assertions):** `=== SECTION ===` markers, ALL-CAPS headers, **Bold** headers, # Markdown headers all recognized; estimateTokens edge cases (empty / null / chars/4); unstructured prompt yields one section.
- **SC-4a.1 logger basics (16 assertions):** `logAiCall` returns callFn result transparently, captures all metadata fields (character_id / system_prompt / user_message / response_text / latency_ms / response_status); failed callFn rethrows + logs as `response_status='error'`; missing `call_purpose` throws (defensive); section inference happens automatically and persists as JSON.
- **SC-4a.1 logAiCallWithId + annotation (5 assertions):** returns numeric logId; `annotateAiCallLog` updates `markers_detected`, `triggered_correction_loop`, `rule_violations` on the existing row.
- **SC-4a.1 onApiMeta hook (4 assertions):** `wrapClaudeCall` wires the callback so the token counts (model_id / input_tokens / output_tokens / cache_read_input_tokens) all land on the row when the synthesized claudeFn invokes onApiMeta.
- **SC-4a.2 signals (33 assertions across 6 signals):** scopeOfInstructionApplication shape + autonomy-violation detection (seeded "you decide" / "you feel" → flagged); responseLengthDistribution by_purpose buckets; markerEmissionRates picks up annotated markers; nameReuseSignal detects shared proper noun across two character_ids ("Korren"); timeDriftSignal detects subject-keyed value drift ("Lyra 7 days → 4 days"); computeAllSignals composes the eight under documented keys.
- **SC-4a.3 aggregation queries (8 assertions):** sectionContributionForBuilder + lengthDistributionForBuilder return documented shapes; section names from seeded data surface in breakdown.

Regression suites green: marker-pipeline (44), fortress-threat-marker (61), survival-intensity (59), time-bounded-state (69). Server boot smoke clean (migration 053 applies; routes mount; CLI tool runs end-to-end against the seeded test data). Client build clean — 1715 kB index.js (no significant size delta), 82.85 kB CSS bundle.

**Phase 4a acceptance criteria met (per spec §2.6 + §3.6 + §4.6 + §5.6):**
- ✅ `ai_call_log` table created via migration 053 with all spec §2.2 fields
- ✅ `services/aiCallLogger.js` exports the logging helper (and convenience wrappers)
- ✅ All 37 existing AI call sites migrated to delegate through the helper
- ✅ Captured fields per §2.2; storage shape per §2.4 (append-only with archival hook)
- ✅ Tests cover helper wraps correctly, failed API calls log, existing call-site behavior is byte-identical
- ✅ Eight signal functions exported with documented shapes
- ✅ Tests cover each signal: known-input → known-output verification
- ✅ Prompt builders' section breakdowns inferred + persisted in `ai_call_log`
- ✅ Aggregation functions handle the standard queries (length distribution / section contribution / cumulative context / growth)
- ✅ Debug page exists at stable activeView `'showAIBehavior'`, accessible from app
- ✅ Filter controls work; signal computations display; call list paginates; per-call detail view shows captured prompt + response + metadata
- ✅ CLI tool exposes the same signal functions with command-line invocation
- ✅ Schema for `ai_call_log` is documented in migration header + this CHANGELOG entry
- ✅ DECISION_LOG entry covering each sub-checkpoint's design decisions
- ✅ No prompt-content or response-content changes (read-only on production)

**Phase 4a is closed.** Phase 4b (investigation practice) is unblocked. PM ships Phase 4b's investigation framework + first three investigation specs next.

---

## [1.0.0.164] - 2026-05-06 — Phase 3.7: fortress groundwork (marker-driven threats + mechanical-damage symmetry + KNOWN_BUGS triage)

PM-authored mini-phase between Phase 3.5 close (v1.0.163) and Phase 4 entry. Three sub-checkpoints, all backend + documentation work, no Design dependency. Implements [`PHASE_3_7_SPEC.md`](PHASE_3_7_SPEC.md). Lays foundation for the eventual fortress system design phase (Phase 5 candidate) by absorbing two findings from [`triage/kingdom-management-survey.md`](triage/kingdom-management-survey.md) and triaging the rest into `KNOWN_BUGS.md`.

**SC-3.7.1 — Marker-driven fortress threats.** Reframes threat origination from world-event-tick to AI DM marker emission.

- New `FORTRESS_THREAT` schema in [server/services/markerSchemas.js](server/services/markerSchemas.js): required `BaseId`, `EventType` (one of five `RAID_CAPABLE_EVENTS` keys), `Force` (1-30), `WarningDays` (1-30); optional `Source`, `Category`, `Reason`. Multi-instance per Q1 (pipeline default loop handles).
- New handler in [server/services/baseThreatService.js](server/services/baseThreatService.js) registered via `registerMarkerHandler('FORTRESS_THREAT', ...)`. Validates: base exists + belongs to character's campaign; base status='active'; no existing approaching/defending/resolving threat (single-active-threat invariant). Source/Category fallbacks land **handler-side** per Q3 (schema validates structure; handler reads `RAID_CAPABLE_EVENTS[EventType].sourceLabel` / `.category` for absent optional fields). Computes `threat_type` from `Force` + `SIEGE_FORCE_THRESHOLD`; inserts row + writes narrative_queue entry. Returns structured result with `threatId`/`threatType`/`baseName`/`source`/`deadlineGameDay` plus a systemNote for the route to assemble.
- `generateThreatsForCampaign` deprecated per Q2 — comment block references spec §1.2 ("removing it would touch the living-world tick architecture — out of scope") and notes that marker-driven origination is canonical post-Phase-3.7. Function stays in place; same row shape if any future ship re-activates the world-event path.
- Resolves the producer-gap finding from [`triage/kingdom-management-survey.md`](triage/kingdom-management-survey.md) §0 + §3.1. Fix-along-the-way #6 in Phase 3 + 3.7 (joins notoriety silent-drop, NPC absence ×2, dehydration weather modulation, world event clock standardization). KNOWN_BUGS Resolved-archive entry.

**SC-3.7.2 — Mechanical-damage asymmetry fix.** Closes the perverse incentive surfaced in survey §1.6.

- `recordPlayerDefenseOutcome` ([server/services/baseThreatService.js](server/services/baseThreatService.js)) now runs `computeDamageFromOutcome` for `damaged` and `captured` outcomes — the same helper auto-resolve uses. Mechanical mutation (buildings flipped to `damaged`, treasury debited, garrison reduced) lands regardless of resolution path.
- New `synthesizeOutcomeCalcFromMarker(outcome)` helper translates the marker's `Outcome` enum value into the `outcomeCalc` shape `computeDamageFromOutcome` expects (auto-resolve produces this via dice rolls; player-led path doesn't roll). Synthetic rolls flagged `synthetic: true` in the resulting damage_report so analytics can distinguish marker-driven outcomes from auto-resolve.
- Player-led `damaged` defaults to **mild sub-tier** (margin treated as 0) per spec §3.4: 25% treasury / 20% garrison / 1-2 buildings damaged. Rationale: player engaged with the defense; even a "damaged" outcome reflects active resistance. Penalize engaged players less harshly than unengaged. Future severity field on `[BASE_DEFENSE_RESULT]` (Q4) can override; out of Phase 3.7 scope.
- Caller-supplied `damageReport` blobs merge WITH mechanical mutation — caller fields preserved on the JSON blob; mechanical mutation runs underneath either way.
- `repelled` outcome continues to apply zero damage (no behavior change).
- KNOWN_BUGS Resolved-archive entry. Per DECISION_LOG: this fix is NOT fix-along-the-way (it was an explicit acceptance criterion of the sub-checkpoint).

**SC-3.7.3 — Documentation + KNOWN_BUGS triage.**

- [KNOWN_BUGS.md](KNOWN_BUGS.md) cleaned up: duplicate `## Active known bugs` and `## Resolved known bugs (archive)` headers removed (PM-authored entries had concatenation duplicates); `v1.0.16x` placeholders updated to `v1.0.164` on the two SC-3.7.x resolution stamps.
- Two new active entries (Recapture window without recapture mechanism; Holdings purpose data is stub) — both formally deferred to the future fortress system design phase per spec §1.2.
- Two new resolved-archive entries (Producer gap; Mechanical-damage asymmetry).
- [CLAUDE.md](CLAUDE.md) updated per spec §4.3: `[FORTRESS_THREAT]` added to the canonical marker list; `baseThreatService` handler registry entry now reads `FORTRESS_THREAT/BASE_DEFENSE_RESULT`; new paragraph documents marker-driven threat origination as canonical; Party bases / fortresses section updated to reflect mechanical-damage symmetry + the recapture-window known limitation.
- [triage/kingdom-management-survey.md](triage/kingdom-management-survey.md) updated with a post-Phase-3.7 status block at the top — names which findings were absorbed (producer gap, mechanical-damage asymmetry) versus which remain open as KNOWN_BUGS (recapture, holdings purpose) versus what stayed parked (the fortress intensity dial itself, naming nudge carried forward).

**Tests** — `tests/fortress-threat-marker.test.js` (new, 61 assertions all passing):
- **Schema validation (15 assertions)** — canonical FORTRESS_THREAT parses; required fields enforced (BaseId / EventType / Force / WarningDays); enum validation (EventType, Category); Force min/max + WarningDays max; minimal canonical with all optionals omitted parses (fallbacks land handler-side); multi-instance extraction (two markers in one narrative).
- **Handler dispatch (20 assertions)** — valid marker → 1 new `base_threats` row with handler-side Source/Category fallbacks from `RAID_CAPABLE_EVENTS`; raid-vs-siege determination at the SIEGE_FORCE_THRESHOLD boundary; deadline = game_day + WarningDays; status starts approaching; narrative_queue entry created; error paths covered (unknown BaseId → `base_not_found`; base in another campaign → `base_not_owned`; abandoned base → `base_not_active`; existing threat → `threat_already_active` with `existingThreatId`); explicit Source/Category in marker used verbatim (no fallback).
- **SC-3.7.2 damage symmetry (24 assertions)** — `repelled`: treasury/garrison untouched, no buildings damaged; `damaged` (mild sub-tier default): 25% treasury / 20% garrison / 1-2 buildings; `captured`: 90% treasury / 0 garrison / all buildings + party_bases.status flips to `damaged` + recapture_deadline_game_day = gameDay + 14; damage_report JSON populates with mechanical detail (`treasury_lost_gp`, `garrison_lost`, `buildings_damaged`, `player_defended: true`, `rolls.synthetic: true`); caller-supplied damageReport blobs merge WITH mechanical mutation (caller fields preserved; mechanical mutation runs underneath).

Regression suites all green: marker-pipeline (44), sc6-4d-combat-mythic-schemas (48), threshold-crossed-cluster (33), survival-intensity (59), time-bounded-state (69). Server boot smoke clean — handler registration loads on import as expected.

**Phase 3.7 acceptance criteria met (per spec §2.7 + §3.5 + §4.4):**
- ✅ FORTRESS_THREAT schema added to markerSchemas.js
- ✅ Handler registered in baseThreatService.js via registerMarkerHandler
- ✅ Handler validates base ownership + active status
- ✅ Handler enforces single-active-threat-per-base invariant
- ✅ Handler creates base_threats row + narrative_queue entry on success
- ✅ Handler returns structured result for route to pass through
- ✅ Tests cover valid marker / invalid BaseId / existing threat / raid vs siege
- ✅ Existing world-event-driven `generateThreatsForCampaign` still works (no regression)
- ✅ `recordPlayerDefenseOutcome` runs `computeDamageFromOutcome` for damaged + captured
- ✅ `repelled` continues to apply zero damage
- ✅ Mild sub-tier used as default for player-led damaged
- ✅ damage_report JSON blob continues to populate
- ✅ Three KNOWN_BUGS entries (PM-authored content; Code landed) — actually four, two active + two resolved-archive
- ✅ CLAUDE.md updated per §4.3
- ✅ DECISION_LOG entries (one closing entry consolidating the three SC-3.7.x ships)

**Phase 3.7 is closed.** Phase 4 (AI behavior diagnostic + combat difficulty mechanism activation) is unblocked.

---

## [1.0.0.163] - 2026-05-05 — Phase 3.5 first ship: Settings overlay UI (survival intensity wired end-to-end + combat difficulty placeholder)

User-facing surface for the SC-7.6.5 mechanism. Implements [`settings/SETTINGS_DESIGN_BRIEF.md`](settings/SETTINGS_DESIGN_BRIEF.md) verbatim — centered editorial overlay sheet on a tinted scrim, reachable from a `Settings` link in the appbar on home and mid-session alike. Two controls today (Gameplay section): survival intensity (active, writes via existing PUT `/api/character/:id` boundary added in SC-7.6.5) and combat difficulty (placeholder dial; mechanism activation is Phase 4 territory per CONSOLIDATED_TODO).

**`client/src/components/settings/SettingsOverlay.jsx` (new):**
- `SettingsOverlay` — fixed-position overlay (`role="dialog"`, `aria-modal`, Esc-to-close, scrim-click dismiss). Per-character scope via `character` prop; dial click fires PUT immediately and updates the right-margin meta to `Saved · just now` (decays via 15s polling tick to `a moment ago`, `5m ago`, `1h ago`, `earlier today`).
- `FourPosDial` — labeled register dial primitive (per design §5). Four columns (`I/II/III/IV`), active position promoted in editorial-accent color, active explanation paragraph below in faded-gold left-rule block. Disabled variant identical structurally (per design §6 — "real future feature, not broken stub"); the disabled dial still ships as a real DOM control (`aria-disabled`) pointing at `standard`.
- Optimistic local state + rollback on PUT failure. Apply-on-click contract per design §4 — no save button, no discard prompt.
- `context` prop drives exit-button label: `'Back to game'` from session, `'Done'` from home.

**`client/src/styles/creator-theme.css`:**
- Appended Settings overlay styles scoped under `.settings-overlay-root`. Editorial palette duplicated (small token block) so the overlay reads correctly when summoned from either the editorial-aesthetic HomeFlow appbar or the legacy dark-aesthetic dashboard chrome — the scrim provides visual separation either way. Promotion to `design-tokens.css` deferred per the existing comment at the top of the file (waiting for a third surface).
- Added `.creator-v2 .appbar .nav-settings` for the editorial Settings link in HomeFlow's appbar.

**`client/src/components/creator/HomeFlow.jsx`:**
- Settings link added to BOTH appbars (home route + path-choice route). Picks the most-recently-updated active character (or in-progress draft as fallback) for per-character scope. Hidden when zero characters exist.
- `handleSettingsSaved` patches the locally-tracked character list so subsequent home renders reflect the new `survival_intensity` without a refetch round-trip.

**`client/src/App.jsx`:**
- Settings link added to the dashboard header (sits above DMSession + character sheet + all dashboard views). Scopes to `selectedCharacter`; `context` is `'session'` when `activeView === 'showDMSession'`, else `'home'`. Mid-session safety contract (per design): overlay is fixed-position above the session view; the underlying DOM is not unmounted; closing returns the player to the same DM turn they paused on.
- `onSaved` callback patches both `selectedCharacter` and the local `characters` array so the UI stays in sync without a refetch.

**Server:** No backend changes. The `survival_intensity` PUT allowlist + enum guard shipped at SC-7.6.5 / v1.0.162 ([server/routes/character.js](server/routes/character.js)) is the contract this UI consumes. Migration 052's `'standard'` default means existing characters render the dial pointing at Standard out of the box.

**Smoke:**
- Client build (`cd client && npx vite build`) clean — 1715 kB index.js, 82.85 kB CSS bundle. No warnings beyond the existing chunk-size advisory.
- Server boot smoke clean — no migrations to apply (052 already shipped at v1.0.162).
- No new tests this ship — UI surface; no test framework for React components per CLAUDE.md. The mechanism it consumes is covered by [tests/survival-intensity.test.js](tests/survival-intensity.test.js) (59 assertions) shipped at v1.0.162.

**Design brief acceptance criteria** (per `settings/SETTINGS_DESIGN_BRIEF.md` "Functional contract for Code"):
- ✅ `Settings` link in the appbar, right side; visible on home and session screens both
- ✅ Click opens overlay over the current screen; no route change
- ✅ Overlay is a layer above the session view; session DOM is not unmounted
- ✅ Exit affordance reads `Back to game` in-session, `Done` from home; available in both `×` and foot-row positions
- ✅ Settings persist on the character record (not the account); header reads "Settings for *[active character name]*"
- ✅ Apply-on-click: each dial click writes immediately + updates the `Saved · just now` stamp; decays to relative time on subsequent renders (no debouncing)
- ✅ Survival intensity values: `off / lenient / standard / strict`; default `standard`
- ✅ Combat placeholder rendered as real DOM control (`role="radiogroup"`, `aria-disabled="true"`); pointing at `standard` so the value is meaningful when the feature lands; right-margin meta reads `Coming soon`
- ✅ Future sections — each is a `.settings-section` with `.sec-head` (eyebrow + rule + count); adding a new section is one block

**Phase 3.5 status:** Settings page UI shipped. Combat difficulty mechanism activation deferred to Phase 4 per CONSOLIDATED_TODO. Phase 3.5 scope (confirmed 2026-05-05) is **two controls only**: survival intensity (active) + combat difficulty (placeholder). No fortress/kingdom dial in Phase 3.5. The producer-gap and recapture-mechanism gaps surfaced in [`triage/kingdom-management-survey.md`](triage/kingdom-management-survey.md) belong to Phase 3.7 (Fortress groundwork) at earliest, with the full fortress system as a Phase 5 candidate; three KNOWN_BUGS entries (producer gap, mechanical-damage asymmetry, recapture-window-without-recapture-mechanism) get filed during Phase 3.7. Phase 3.5 closes once PM ships the close-out DECISION_LOG entry — no further Code work in this phase.

---

## [1.0.0.162] - 2026-05-05 — Phase 3.3 SC-7.6.5: player-tunable survival intensity (`off / lenient / standard / strict`)

PM-drafted addendum to Phase 3.3. Adds a four-position character-level survival intensity setting that consumers read at decay/threshold evaluation time, so players can dial survival mechanics between gritty (Strict) and tonal-only (Off) without rebuilding consumer registrations or restarting the campaign. Default `'standard'` for all rows — byte-identical behavior to SC-7.6 for any character who hasn't explicitly chosen otherwise. **UI deferred** (no slider component this ship); column + server logic land first so the contract is settled before paint.

**`server/migrations/052_survival_intensity.js` (new):**
- Adds `survival_intensity TEXT NOT NULL DEFAULT 'standard'` to `characters`. Idempotent — `PRAGMA table_info` check before ALTER. SQLite ALTER doesn't support inline CHECK constraints; the migration header documents the intended `CHECK (survival_intensity IN ('off','lenient','standard','strict'))` shape for a future schema-rebuild ship. Application-layer enum validation enforced at PUT boundary.
- All existing rows pick up `'standard'` automatically — no backfill code needed beyond the column default.

**`server/services/survivalService.js`:**
- New SC-7.6.5 infrastructure block (`VALID_INTENSITIES`, `INTENSITY_THRESHOLDS`, `INTENSITY_HOT_MULTIPLIERS`, `INTENSITY_COLD_MULTIPLIERS`, `INTENSITY_DEHYDRATION_MAGNITUDE` maps + `getSurvivalIntensity` + `isColdWeather` helpers). Per-position numbers picked to bracket the design space (~2× spread Lenient ↔ Strict so the slider has visible effect at every position):
  - **Starvation thresholds** (added to CON mod, min 1): Lenient 6 / **Standard 3** / Strict 2.
  - **Dehydration kick-in days**: Lenient 3 / **Standard 1** / Strict 1.
  - **Hot multipliers**: Lenient 1.5× / **Standard 2.0×** / Strict 3.0×.
  - **Cold multipliers** (Strict-only addition): Lenient 1.0× / **Standard 1.0×** / Strict 1.5×.
  - **Dehydration tier magnitudes** ({tier1, tier2}): Lenient {1, 1} (capped, no escalation) / **Standard {1, 2}** / Strict {2, 2} (severe immediately).
- `STARVATION_THRESHOLD_CONSUMER.repository.readAnchor` now reads intensity at evaluation time. Off short-circuits via `null` anchor (no fire). Otherwise threshold = `INTENSITY_THRESHOLDS.starvation[intensity] + CON_mod` (min 1).
- `DEHYDRATION_THRESHOLD_CONSUMER.repository.readAnchor` reads intensity, short-circuits on Off, shifts the anchor by `kick_in_days - 1` so threshold=1 fires at `lastDrink + kick_in_days`. (Lenient anchor = `lastDrink + 2`; Standard/Strict anchor = `lastDrink`.)
- `DEHYDRATION_THRESHOLD_CONSUMER.handler` reads intensity, applies `INTENSITY_HOT_MULTIPLIERS[intensity]` for hot weather, `INTENSITY_COLD_MULTIPLIERS[intensity]` for cold (mutually exclusive — hot = `heat_wave`/>85F, cold = `blizzard`/`snow`/<32F), pulls tier magnitudes from `INTENSITY_DEHYDRATION_MAGNITUDE[intensity]`. Standard preserves SC-7.6's `'DOUBLE water needs — effective rate is 2x'` message string verbatim (byte-identity); Lenient/Strict use generic `'multiply water needs (Nx)'` wording.
- `checkStarvation` / `checkDehydration` wrappers detect Off and short-circuit before invoking the consumer (defense-in-depth — null-anchor path also covers direct `checkAndFire` calls). Wrapper returns include `intensity` field.
- `getSurvivalStatus` returns `survival_intensity`; threshold display reflects the intensity-adjusted value. `formatSurvivalForPrompt` adds a one-line intensity hint to the DM prompt for non-Standard intensities (Standard remains silent — preserves SC-7.6 prompt byte-identity).

**`server/routes/character.js`:**
- `survival_intensity` added to PUT allowlist with `VALID_SURVIVAL_INTENSITIES` enum guard. Invalid values silently skip the update (cannot corrupt the column from a malformed client).

**Tests** — `tests/survival-intensity.test.js`, 59 assertions all passing:
- **Test 1: Off short-circuit** — STARVATION + DEHYDRATION consumers do not fire even at 100 days; wrapper functions report non-effect; `intensity: 'off'` propagated.
- **Test 2: Lenient extended thresholds** — starvation threshold 8 (6 + CON 2), dehydration kick-in at 3 days, magnitude capped at 1 level (no tier2 escalation).
- **Test 3: Standard byte-identity** — threshold 5, day-6 fires starving, hot 2× tier transition, **cold not modulated** (`cold` flag stays false), `'DOUBLE'` message string preserved.
- **Test 4: Strict tightening** — threshold 4, tier1 magnitude = 2 levels (severe immediately), 3.0× hot multiplier produces 3 effective days, **cold modulated 1.5×** (Strict-only feature).
- **Test 5: Default fallback** — missing `survival_intensity` field → 'standard'; invalid value (e.g., `'extreme'`) → 'standard'.
- **Test 6: getSurvivalStatus surfaces intensity** — returns `survival_intensity`; `starvation_threshold` reflects intensity-adjusted value.
- **Test 7: Runtime read mid-stream** — same character row, intensity flipped Standard→Lenient between calls; consumer picks up the new threshold without restart.
- **Test 8: PUT enum guard** — accepts the four valid values; rejects `'STANDARD'` (case-sensitive), `''`, `null`, `'normal'`, `'hardcore'`, etc.

All prior Pattern D + Phase 3 suites green: time-bounded-state (69), companion-mood-decay (45), npc-absence-cluster (50), notoriety-decay (43), threshold-crossed-cluster (33), world-event-clock-fix (14), survival-timer-cleanup (50), survival (66), standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-marker-schemas (73). Server boot smoke clean — migration 052 applied + intensity wiring loads without error. (Skipping client build — no client/ changes.)

**SC-7.6.5 acceptance criteria met (per spec §3.3.10):**
- STARVATION_THRESHOLD_CONSUMER and DEHYDRATION_THRESHOLD_CONSUMER read intensity at evaluation time
- Off short-circuits both threshold consumers via null anchor
- Lenient / Standard / Strict produce different effective threshold values per the spec table
- Weather modulation respects intensity per `INTENSITY_HOT_MULTIPLIERS` (and the Strict-only `INTENSITY_COLD_MULTIPLIERS` extension)
- Behavior parity vs. SC-7.6: any existing character with `survival_intensity = 'standard'` (the default) sees byte-identical behavior to SC-7.6's shipped state — explicitly validated in Test 3
- DECISION_LOG entry covering the four-position design + runtime-read pattern + deferred UI surfacing

**Phase 3.3 status:** 7 sub-checkpoints complete (SC-7.1 abstraction + SC-7.2–SC-7.7 per-system ports + this player-tunable extension). Phase 3.3 functionally closed; remaining work is the §3.3 close-out DECISION_LOG entry (synthesizes the arc + consolidates cumulative findings — same shape as SC-6.4 close-out). After that close-out, Phase 3 closes.

---

## [1.0.0.161] - 2026-05-05 — BUG FIX: world events on real-time clock instead of game-day clock (resolved as part of Phase 3.3 SC-7.7 migration)

**Headline.** `worldEventService.processEventTick` was the only consumer in the codebase NOT running on the `currentGameDay` clock. Pre-SC-7.7 it used `new Date()` and ISO timestamp arithmetic for both deadline checks (`new Date(event.deadline) < new Date()`) and stage-advance calculations (`(new Date() - new Date(event.started_at)) / (1000 * 60 * 60 * 24)`). A campaign played briefly over a real-time week could see events firing as if many game-days had passed. Pattern D survey §1.12 (2026-05-04) flagged this as the cross-cutting "two clocks, same name" finding. PM Q10 ruling: fix in Phase 3.3 scope.

**Severity.** Functional / Game-state-consistency. World events drive narrative pacing; firing on the wrong clock disconnects story progression from in-game time. Severity scales with how variable the game-day-per-real-day ratio is in actual play.

**Fix shape.** Migration 051 adds `started_game_day` and `deadline_game_day` integer columns to `world_events`; backfills `started_game_day = MAX(game_day)` per campaign for active events (best-effort — past stage advances stay baked into `current_stage`; future advances measure from the fresh anchor). New `WORLD_EVENT_DEADLINE_THRESHOLD_CONSUMER` (Pattern D abstraction; threshold=0; SELECT-pre-filter idempotency). Stage-advance uses `daysSince(started_game_day, currentGameDay)` inline. `processEventTick` signature: `(campaignId, gameDaysPassed)` → `(campaignId, currentGameDay)`. Caller in `livingWorldService` updated.

**Fix-along-the-way #5** in Phase 3 (joins notoriety silent-drop SC-6.4c, NPC absence ×2 SC-7.3, dehydration weather modulation SC-7.6). KNOWN_BUGS.md archive entry resolved at v1.0.161.

---

## [1.0.0.161] - 2026-05-05 — Phase 3.3 SC-7.7: world event clock standardization (final §3.3 ship; per-system migrations complete)

Final ship in Phase 3.3's per-system migration sequence (SC-7.2 → SC-7.7). Standardizes the last consumer that wasn't on the `currentGameDay` clock. All 11 Pattern D survey surfaces are now migrated.

**`server/migrations/051_world_event_game_day_columns.js` (new):**
- Adds `started_game_day` + `deadline_game_day` INTEGER columns to `world_events` (idempotent — checks `PRAGMA table_info` before ALTER).
- Backfills `started_game_day = MAX(game_day) per campaign` for active events. Treats existing events as "started today" in game-time terms; past stage advances are baked into `current_stage` so future advances measure from the fresh anchor. Acceptable trade-off for a forward-looking clock-standardization fix.
- `deadline_game_day` stays NULL for legacy events (threshold consumer's null-anchor short-circuit gracefully ungates them).

**`server/services/worldEventService.js`:**
- New module-level export `WORLD_EVENT_DEADLINE_THRESHOLD_CONSUMER` — Pattern D threshold consumer, `threshold: 0`, anchor = `event.deadline_game_day`. Handler calls `resolveEvent(event.id, 'deadline_passed', ...)`. SELECT-pre-filter idempotency (orchestrator's `status='active'` filter drops fired events from subsequent ticks).
- `createWorldEvent` accepts `started_game_day` + `deadline_game_day` parameters and writes them to the new columns. Legacy `deadline` (ISO string) and `started_at` (DATETIME) columns continue to be written for back-compat.
- `processEventTick` signature changed: `(campaignId, gameDaysPassed = 1)` → `(campaignId, currentGameDay = 0)`. The real-time delta wasn't useful for game-day-clock work. Default `0` for the parameter means uncalled callers no-op safely.
- Deadline check delegates to `WORLD_EVENT_DEADLINE_THRESHOLD_CONSUMER`. Stage-advance computes from `daysSince(started_game_day, currentGameDay)` inline (no consumer wrapper — stage advance is a current-vs-expected comparison, not a fire-once-when-crossing mechanic; the abstraction wouldn't have added value).

**`server/services/livingWorldService.js`:**
- Caller of `processEventTick` updated to pass `MAX(game_day)` per campaign instead of `gameDaysPassed`. Same shape as the other consumers in the tick.

**Tests** — `tests/world-event-clock-fix.test.js`, 14 assertions all passing:
- `WORLD_EVENT_DEADLINE_THRESHOLD_CONSUMER` shape sanity (name, threshold=0, checkAndFire)
- **HEADLINE: clock standardization** — `currentGameDay=11 vs deadline=10 → 1 day elapsed` (would fire); `currentGameDay=10 vs deadline=50 → 0 elapsed` (orchestrator SELECT pre-filter handles future-deadline exclusion in production)
- Anchor null (legacy events without backfilled `deadline_game_day`) → `no_anchor` reason → no fire
- Stage-advance: `daysSince` computes 5 game days elapsed; `expectedStage = floor(5 / daysPerStage)`; clamps to last stage even on huge elapsed values
- Same-day creation: 0 elapsed → no premature stage advance
- **Three semantics still distinct post-SC-7.7** — synthetic test repeats the SC-7.4 enum-fully-exercised check as defense against accidental regression in the abstraction layer

All prior suites green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-marker-schemas (73), sc6-4a-survival-crafting-schemas (62), sc6-4b-merchant-schemas (47), sc6-4c-promise-notoriety-schemas (36), sc6-4d-combat-mythic-schemas (48), time-bounded-state (69), companion-mood-decay (45), npc-absence-cluster (50), notoriety-decay (43), threshold-crossed-cluster (33), survival-timer-cleanup (50), survival (66), faction-quests (112). Server boot smoke clean — migration 051 applied + handler registered. (Skipping client build — no client/ changes.)

**SC-7.7 acceptance criteria met (per spec §3.3.7):**
- `worldEventService.js` deadline + stage-advance use `currentGameDay` instead of `new Date()`
- Deadline check implemented via `registerThresholdConsumer`
- All world-event consumers run on the same game-day clock as the rest of the codebase
- DECISION_LOG entry covering the bug fix and clock-standardization rationale

**Phase 3.3 per-system migration progress: 6 of 6 complete.** Six consumer ports across SC-7.2 → SC-7.7 covering all 11 Pattern D survey surfaces. Three decay semantics validated against real consumers (CONSUMED / HIGH_WATER_MARK / WRITTEN_BACK). Eight threshold consumers built via the abstraction (5 in SC-7.5 + 2 in SC-7.6 + 1 in SC-7.7).

**Phase 3.3 remaining:**
- **SC-7.6.5** — Player-tunable survival intensity (Off / Lenient / Standard / Strict). PM in flight on the spec section; lands as a separate sub-checkpoint after spec arrives. Shape: settings storage on character row + UI toggle + default-value migration + runtime multiplier read in survival decay/threshold functions.
- **SC-7 close-out DECISION_LOG entry** — synthesizes the §3.3 arc (SC-7.1 → SC-7.7) and consolidates findings. Same shape as SC-6.4 close-out. Lands after SC-7.6.5 ships.

**For close-out DECISION_LOG entry** (cumulative findings now):
1. Three-semantics enum fully exercised in production
2. SELECT-pre-filter as a fifth idempotency strategy (used by 6 of 8 threshold consumers in Phase 3.3)
3. Per-instance threshold derivation via `repository.readAnchor` (variable thresholds absorbed into anchor derivation — used by promise auto-break SC-7.5 + starvation SC-7.6)
4. **Fix-along-the-way pattern is now load-bearing methodology** — 5 instances across Phase 3.2 + Phase 3.3 (notoriety silent-drop / NPC absence ×2 / dehydration weather modulation / world event clock divergence). Each surfaced during prep work and resolved through the migration mechanism.
5. **Vestigial-column cleanup pattern** — column-as-source-of-truth → anchor-as-source-of-truth without schema migration. Used in SC-7.6.
6. **Schema migration as last resort** — only Phase 3.3 ship that needed one (SC-7.7) was the world event clock fix, where the legacy table had no game-day columns to compute against. All other migrations were behavioral (config + handler swaps).

---

## [1.0.0.160] - 2026-05-05 — BUG FIX: dehydration hot-weather acceleration (resolved as part of Phase 3.3 SC-7.6 migration)

**Headline.** `survivalService.checkDehydration` documented behavior — "Hot weather doubles water needs — 0.5 days without water counts as a full day" — was not actually implemented. The legacy code only added a cosmetic string to the message; exhaustion levels did NOT accelerate. PM ruling 2026-05-05: implement the doubling. Resolved via SC-7.6's `DEHYDRATION_THRESHOLD_CONSUMER` reading `hint.weather` and computing `effective_days = raw_days × (hot ? 2 : 1)`.

**Severity.** Functional / Game-balance. D&D 5e exhaustion is a real lever; missing doubling under-penalized players in heat-wave/desert scenarios.

**Fix shape.** Migration handler computes effective elapsed via the contextHints plumbing; exhaustion levels = `effective_days >= 2 ? 2 : 1`. So 1 raw day in hot weather = 2 effective days = severe-tier (2 levels) immediately. Boundary: `temperature_f === 85` is NOT hot (strict `>` check matches legacy detection).

**Fix-along-the-way #4** (named pattern from SC-6.4 close-out). KNOWN_BUGS.md archive entry resolved at v1.0.160.

**Test snapshot.** `tests/survival-timer-cleanup.test.js` HEADLINE section asserts: heat_wave weather → 1 raw day → 2 effective → 2 exhaustion (BUG FIX); high-temp (92F) triggers same; boundary (85F) does NOT trigger (matches legacy `> 85`); 2 raw days in hot = 4 effective (capped at severe-tier 2 levels).

---

## [1.0.0.160] - 2026-05-05 — Phase 3.3 SC-7.6: survival timer cleanup (anchor-as-source-of-truth + weather-modulated dehydration consumer)

Survival timers migrate to Pattern D threshold consumers. Counter columns (`days_without_food`, `days_without_water`) become **vestigial cache** — anchor columns (`last_meal_game_day`, `last_drink_game_day`) are the source of truth post-migration. Helpers compute elapsed time from anchor with column-fallback for legacy data. Weather-modulated dehydration consumer fixes the long-standing docs/code divergence (see headline above).

**`server/services/survivalService.js`:**
- New helpers: `daysSinceLastMeal(character, currentGameDay)` + `daysSinceLastDrink(character, currentGameDay)`. Use `daysSince` from timeBoundedState when anchor is set; fall back to legacy column when anchor null. `isHotWeather(weather)` extracted from inline heat-detection logic. `effectiveLastMealAnchor(character)` + `effectiveLastDrinkAnchor(character)` synthesize an anchor for the threshold-consumer's `readAnchor` callback (column-fallback computes `game_day - column_value` when anchor null).
- New module-level export `STARVATION_THRESHOLD_CONSUMER` — `threshold: 1` (one day past effective starvation day), variable per-character threshold absorbed into `repository.readAnchor` derivation: `anchor = last_meal + max(3 + conMod, 1)`. Same per-instance-threshold-via-anchor-derivation pattern as SC-7.5's promise auto-break. Per-day re-emission (idempotency no-op — handler emits status report, doesn't mutate state).
- New module-level export `DEHYDRATION_THRESHOLD_CONSUMER` — `threshold: 1` (1 raw day without water). Handler reads `hint.weather` and computes effective elapsed: `effective = raw * (hot ? 2 : 1)`. Exhaustion levels: `effective < 2` → 1 level, `effective >= 2` → 2 levels (severe tier). 1 raw day in hot weather → 2 effective → 2 exhaustion immediately.
- `checkStarvation(character, currentGameDay?)` and `checkDehydration(character, weather, currentGameDay?)` now async; delegate to their respective threshold consumers. Hungry-but-not-starving status returned synchronously (without invoking the consumer's fire path) when below threshold. `currentGameDay` parameter optional, defaults to `character.game_day`.
- `processDayChange` rewritten: stops writing the counter columns; uses `daysSinceLastMeal/Drink` helpers; awaits the now-async `checkStarvation/checkDehydration`. The `effectsApplied` array still surfaces "Starvation: +1 exhaustion" / "Dehydration: +N exhaustion" status reports (now with optional ", hot" suffix on dehydration when weather-accelerated).
- `getSurvivalStatus` now computes `days_without_food` / `days_without_water` from anchor (with column fallback). Client response shape preserved exactly — clients that read these fields from `survivalState` continue to work.

**Counter columns are now vestigial.** Eat/drink continues to write `0` (a denormalized cache that's still used by the column-fallback path in `daysSinceLastMeal/Drink`); `processDayChange` no longer increments them daily. Schema columns stay (no migration); future cleanup ship can drop them. Documented in DECISION_LOG.

**Tests** — `tests/survival-timer-cleanup.test.js`, 50 assertions all passing:
- Both threshold consumers built + exposed
- **Anchor-as-source-of-truth** validated: helpers compute from anchor when set; fall back to vestigial column when anchor null
- Starvation: per-character threshold via CON modifier (CON 14 → 5, CON 8 → 2, CON 1 → floor 1)
- Dehydration: 1 raw day normal → 1 exhaustion; 2 raw days normal → 2 exhaustion (severe tier)
- **HEADLINE: Weather modulation fix-along-the-way #4** — heat_wave + 1 raw day → 2 effective → 2 exhaustion (BUG FIX); temperature_f > 85 triggers same; 85F boundary is NOT hot; 2 raw days in hot = 4 effective (capped at severe-tier 2 levels)
- 0 raw days → not dehydrated regardless of weather (kick-in still requires elapsed time)
- `getSurvivalStatus` field shape preserved (client-facing payload unchanged)
- **Behavior parity**: 5 representative scenarios match inline-replicated legacy logic for `starving / hungry` flags

Existing `tests/survival.test.js` updated (66 assertions still passing): `makeMockCharacter` now auto-syncs anchor when overriding the column (post-anchor-source-of-truth requires self-consistent mocks); `checkStarvation` / `checkDehydration` calls await-ed (they're now async).

All prior suites green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-marker-schemas (73), sc6-4a-survival-crafting-schemas (62), sc6-4b-merchant-schemas (47), sc6-4c-promise-notoriety-schemas (36), sc6-4d-combat-mythic-schemas (48), time-bounded-state (69), companion-mood-decay (45), npc-absence-cluster (50), notoriety-decay (43), threshold-crossed-cluster (33), faction-quests (112). Server boot smoke clean.

**Production wire-up**: existing `processDayChange` callsites (per-day-advance paths) continue to work unchanged. The function is still async (was already), and now its inner `checkStarvation/Dehydration` calls are too — handled transparently via the existing await chain.

**Player-tunable survival intensity** (Off / Lenient / Standard / Strict) is intentionally OUT of SC-7.6 per PM direction. Lands as a separate sub-checkpoint (SC-7.6.5 or Phase 3.3 follow-up). PM drafts the spec section during SC-7.7 implementation. Code's discretion to fold in if it turns out smaller than estimated; surfaces back to PM if going that direction.

**SC-7.6 acceptance criteria met (per spec §3.3.7):**
- `survivalService.checkStarvation` and `checkDehydration` delegate to `registerThresholdConsumer`
- Counter columns become computed-from-anchor (with column fallback for legacy data); schema unchanged, columns vestigial
- Survival prompt-builder paths (`getSurvivalStatus`) read from anchor; client payload shape preserved
- PM call resolved on weather-modulation wrinkle: implemented per ruling 2026-05-05
- DECISION_LOG entry on counter-column cleanup decision (vestigial-column approach + fix-along-the-way #4 framing)

**Pattern D migration progress**: 5 of 6 ports complete. Remaining: SC-7.7 (world event clock fix — real-time → game-day standardization, the only consumer not yet on `currentGameDay`).

**For Phase 3.3 close-out DECISION_LOG entry** (cumulative findings now):
1. Three-semantics enum fully exercised — CONSUMED / HIGH_WATER_MARK / WRITTEN_BACK
2. SELECT-pre-filter as a fifth idempotency strategy
3. Per-instance threshold derivation via repository.readAnchor (variable thresholds absorbed into anchor derivation)
4. **Fix-along-the-way pattern is now load-bearing methodology** — four instances (notoriety silent-drop, NPC absence ×2, dehydration weather modulation). Each surfaced during prep work, resolved through the migration mechanism, documented durably in KNOWN_BUGS archive.
5. **Vestigial-column cleanup pattern** — when migrating from column-as-source-of-truth to anchor-as-source-of-truth, columns can stay as a fallback cache rather than requiring schema migration. Bridges legacy data without a drop-column ship.

---

## [1.0.0.159] - 2026-05-05 — Phase 3.3 SC-7.5: threshold-crossed cluster migration (5 consumers batched; SELECT-pre-filter idempotency; two-stage merchant order pipeline)

Largest cluster ship in Phase 3.3 — five `registerThresholdConsumer` registrations across three service files in one batch per spec §3.3.5 + the user's batching principle. All five share the same idempotency strategy: **SELECT-pre-filter via status column**. Orchestrator's WHERE clause filters to pre-fire status only; handler flips status; subsequent ticks don't see the row. Abstraction's idempotency callbacks are no-ops because the orchestrator owns the strategy.

**Five threshold consumers placed in their consumer services:**
- `PROMISE_AUTO_BREAK_THRESHOLD_CONSUMER` ([consequenceService.js](server/services/consequenceService.js)) — threshold = 1, anchor = effective deadline (`deadline_game_day` if explicit, else `game_day_made + 45`). Per-promise effective deadline derived in repository.readAnchor.
- `QUEST_AUTO_FAIL_THRESHOLD_CONSUMER` ([consequenceService.js](server/services/consequenceService.js)) — threshold = 1, anchor = `quests.deadline_game_day`. Cleanest of the five (single column anchor).
- `MERCHANT_ORDER_DUE_THRESHOLD_CONSUMER` ([merchantOrderService.js](server/services/merchantOrderService.js)) — threshold = 0, anchor = `deadline_game_day`. Stage 1 of the two-stage merchant pipeline (pending → ready).
- `MERCHANT_ORDER_EXPIRE_THRESHOLD_CONSUMER` ([merchantOrderService.js](server/services/merchantOrderService.js)) — threshold = 31, anchor = `ready_game_day`. Stage 2 (ready → expired). Threshold 31 matches legacy strict-greater check `(currentGameDay - ready_game_day) > 30`.
- `BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER` ([baseThreatService.js](server/services/baseThreatService.js)) — threshold = 0, anchor = `recapture_deadline_game_day`. Side effect: flip both `party_bases.status` and `base_threats.outcome` to 'abandoned' + best-effort narrative queue entry.

**Per-promise effective-deadline derivation** — `repository.readAnchor` returns `promise.deadline_game_day || (promise.game_day_made + PROMISE_BREAK_DAYS)`. Single threshold (1) suffices for both explicit-deadline and 45-day-default promises because the anchor's derivation absorbs the variability. Promises lacking `game_day_made` (legacy data without tracking) return null anchor → threshold consumer no-ops via `reason: 'no_anchor'`.

**Promise warnings (half-deadline / 21-day) stay inline** — different shape (per-promise lookback idempotency via `consequence_log` query), not in SC-7.5 scope per spec §3.3.5. Auto-break is the only promise threshold migrated.

**One small back-compat removal**: `expireStaleReadyOrders` legacy signature `(currentGameDay, holdDays = 30)` simplified to `(currentGameDay)` — the production caller (`livingWorldService:252`) never overrode `holdDays`, the threshold consumer's `threshold: 31` is config-time fixed, and a future caller needing a different hold time would register a second consumer rather than parameter-override. Verified single caller via grep before the simplification.

**Tests** — `tests/threshold-crossed-cluster.test.js`, 33 assertions all passing:
- All five consumers built + exposed (name, threshold, checkAndFire methods)
- Promise effective-deadline derivation (explicit-deadline path AND 45-day-default path both produce correct daysElapsed)
- Promise legacy data (no `game_day_made`) → null anchor → no-fire
- Quest single-column anchor: `current==deadline` no-fire (0 elapsed); `current=deadline+1` fires
- Two-stage merchant pipeline: due (threshold=0) fires at exact-anchor day; expire (threshold=31) does NOT fire at 30 elapsed (matches legacy `> 30`); fires at 31 elapsed
- Base recapture: threshold=0 fires when current reaches deadline; future-anchored rows clamp to 0 elapsed (orchestrator's SELECT pre-filter handles the future-deadline exclusion)
- **Cluster batch validation**: all five consumers have identical surface area (`checkAndFire / name / threshold`) — only the threshold value, anchor source, and handler side effect vary. Three distinct threshold values across the five (0, 1, 31). Validates the abstraction handled all five with one API.

All prior suites green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-marker-schemas (73), sc6-4a-survival-crafting-schemas (62), sc6-4b-merchant-schemas (47), sc6-4c-promise-notoriety-schemas (36), sc6-4d-combat-mythic-schemas (48), time-bounded-state (69), companion-mood-decay (45), npc-absence-cluster (50), notoriety-decay (43), faction-quests (112). Server boot smoke clean. (Skipping client build — no client/ changes.)

**Production wire-up**: existing call sites in `livingWorldService` (line 175 for promise/quest cascade; 223/252 for merchant order; baseThreat tick) continue to work unchanged. Cluster behavior identical from the player perspective.

**SC-7.5 acceptance criteria met (per spec §3.3.7):**
- Promise, quest, merchant order, base recapture all use `registerThresholdConsumer`
- Idempotency strategies vary per consumer — documented as SELECT-pre-filter for all five (the strategy lives in the orchestrator's WHERE clause, not in the abstraction's callbacks)
- Two-stage merchant order pipeline (pending → ready → expired) handled with two registrations per spec
- Behavior unchanged from player perspective

**For Phase 3.3 close-out DECISION_LOG entry** (cumulative findings):
1. Three-semantics enum fully exercised against real production consumers (CONSUMED ✓, HIGH_WATER_MARK ✓, WRITTEN_BACK ✓ — completes after SC-7.4)
2. **SELECT-pre-filter as a fifth idempotency strategy** — joins the SC-1 standing-scalar's threshold-handler-registry pattern + SC-7.3's natural-fired-once-marker pattern. Five consumers in one cluster all use the same strategy, encoded by no-op idempotency callbacks because the orchestrator's WHERE clause IS the strategy.
3. **Per-instance threshold derivation via repository.readAnchor** — the promise auto-break consumer needs different effective deadlines per promise (explicit OR game_day_made + 45). The fixed-threshold abstraction handled this by deriving the anchor in the repository callback rather than parameterizing the threshold value. The threshold becomes a constant offset (1) from the derived anchor.

**Pattern D migration progress**: 4 of 6 ports complete (mood SC-7.2, absence SC-7.3, notoriety SC-7.4, threshold cluster SC-7.5 = 9 consumer registrations across 4 ships). Remaining: SC-7.6 (survival timer cleanup — counter columns drop), SC-7.7 (world event clock fix — real-time → game-day standardization).

---

## [1.0.0.158] - 2026-05-05 — Phase 3.3 SC-7.4: notoriety decay migration (validates WRITTEN_BACK semantics — completes the three-semantics exercise set)

Third Pattern D consumer port. Validates `DECAY_SEMANTICS.WRITTEN_BACK` — the variant where the anchor advances to currentGameDay after each tick (vs SC-7.2's CONSUMED that NULLs at floor and SC-7.3's HIGH_WATER_MARK that stays put). All three decay semantics now exercised in production: CONSUMED ✓ (companion mood), HIGH_WATER_MARK ✓ (NPC absence), WRITTEN_BACK ✓ (notoriety).

**`server/services/notorietyService.js`:**
- New module-level export `NOTORIETY_DECAY_CONSUMER` — `semantics: WRITTEN_BACK`, tiered decay rate (`> 50` score → 1/day; `≤ 50` → 2/day), `floor: 0`, `ceiling: 100` (MAX_SCORE). Repository preserves the legacy anchor fallback chain exactly: `last_decay_game_day || last_event_game_day || currentGameDayFallback`. The `advanceAnchor` callback writes `last_decay_game_day = currentGameDay` after each tick.
- `decayScores(characterId, campaignId, currentGameDay)` rewritten as orchestrator: SELECT entries → for each: skip-and-GC if zeroed (housekeeping kept consumer-side, not pushed into abstraction), otherwise `applyDecay({entryId, currentGameDayFallback}, currentGameDay)` → aggregate `{source, category, oldScore, newScore, decayed}` results. Same orchestrator shape as SC-7.2 + SC-7.3.

**Two-step write trade-off documented inline** (mirrors SC-7.2's mood reset trade-off): legacy wrote both `score` and `last_decay_game_day` in one UPDATE; the abstraction splits into writeValue (score) + advanceAnchor (last_decay_game_day). 2 statements vs 1. Acceptable cost: notoriety decay runs on the living-world tick (not session-start), entries per character are typically <10, most ticks are no-ops.

**Tests** — `tests/notoriety-decay.test.js`, 43 assertions all passing:
- `NOTORIETY_DECAY_CONSUMER` shape sanity (name, semantics=WRITTEN_BACK)
- Tiered decay rate preserved exactly: score > 50 → 1/day (sticky), score ≤ 50 → 2/day, boundary at 50/51 verified
- **WRITTEN_BACK anchor advancement**: tick 1 advances anchor; tick 2 measures from advanced position (5 elapsed, not 10) — distinguishes from HIGH_WATER_MARK behavior
- Floor at 0 with anchor still advancing even at clamp
- **Anchor fallback chain** exactly preserved: last_decay → last_event → currentGameDayFallback (third fallback yields 0 elapsed → no-op)
- Same-day tick → 0 elapsed → no-op (no DB writes)
- **Behavior parity vs legacy**: 5 representative scenarios run through inline-replicated legacy logic + the new abstraction side-by-side; all produce byte-identical end-state across `score` + `last_decay_game_day`
- **Three-semantics-together validation**: HIGH_WATER_MARK / CONSUMED / WRITTEN_BACK each tested with the same 5-day-elapsed-decay-by-5 sequence, asserts each produces structurally distinct end-state matching its semantics. Marks the DECAY_SEMANTICS enum as fully exercised.

All prior suites green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-marker-schemas (73), sc6-4a-survival-crafting-schemas (62), sc6-4b-merchant-schemas (47), sc6-4c-promise-notoriety-schemas (36), sc6-4d-combat-mythic-schemas (48), time-bounded-state (69), companion-mood-decay (45), npc-absence-cluster (50), faction-quests (112). Server boot smoke clean. (Skipping client build — no client/ changes.)

**Production wire-up**: existing `decayScores` callsite at `livingWorldService.js:198` (per the SC-6.4 inventory) continues to work unchanged. Notoriety decay behavior is identical from the player perspective.

**SC-7.4 acceptance criteria met (per spec §3.3.7):**
- `notorietyService.decayScores` delegates to `registerDecayConsumer`
- "Written-back anchor" semantics validated (tested distinctly from HIGH_WATER_MARK + CONSUMED)
- Existing notoriety tests pass (no pre-existing decay-specific tests; new test suite is the first coverage)

**Pattern D migration progress**: 3 of 6 consumer ports complete (mood SC-7.2, absence SC-7.3, notoriety SC-7.4). All three decay semantics validated against real production consumers. Remaining: SC-7.5 (threshold-crossed cluster — 4 consumers batched), SC-7.6 (survival timer cleanup), SC-7.7 (world event clock fix).

---

## [1.0.0.157] - 2026-05-05 — Phase 3.3 SC-7.3: NPC absence cluster migration (dual decay from one anchor + stochastic threshold + 2x fix-along-the-way)

Second cluster Pattern D port. Stress-tests three abstraction surfaces in one ship: dual-decay-from-shared-anchor (disposition + trust both reading `last_interaction_game_day`), stochastic threshold (relocation 10% probability roll — first exercise of `registerThresholdConsumer.probability`), and the "fix-along-the-way" pattern doubled (compound-prefix relocate bug + repeat-fire forget bug both surface during prep, both resolved through the migration mechanism).

**`server/services/npcAgingService.js`:**
- New module-level exports: `DISPOSITION_DECAY_CONSUMER`, `TRUST_DECAY_CONSUMER` (both `HIGH_WATER_MARK`, both reading the shared `last_interaction_game_day` anchor against different value columns), `RELOCATION_THRESHOLD_CONSUMER` (60d threshold + `probability: 0.1`), `FORGET_THRESHOLD_CONSUMER` (120d threshold, deterministic).
- `processAbsenceEffects` rewritten as orchestrator: SELECT alive-and-met NPCs → iterate → call each consumer's `applyDecay` / `checkAndFire` → aggregate counts. Same shape as SC-7.2's decayMoods orchestrator. Per-relationship processing does ~6-10 DB round trips vs. legacy ~2-3; acceptable for session-start (documented in DECISION_LOG).
- Legacy `calculateDispositionDecay`, `calculateTrustDecay`, `checkAbsenceThreshold` kept exported (potential test consumers + per "deprecate by hiding"); no longer called from production processAbsenceEffects.

**Stochastic threshold validates `probability` parameter** (Q8 from survey, named in SC-7.1 DECISION_LOG): relocation handler fires only when `Math.random() < probability` AND threshold + condition both hold. Failed rolls don't record idempotency — next tick can roll again. Test forces deterministic random (override `Math.random`) to verify both pass and fail paths.

**Two fix-along-the-way bug fixes** ([KNOWN_BUGS.md](KNOWN_BUGS.md) Resolved archive, both resolved at v1.0.157):
- **Compound-prefix relocate bug** (cosmetic): legacy had no relocation idempotency → consecutive 10% rolls produced `Unknown (left Unknown (left Tavern))`. Migration adds `hasFiredRecently: location.startsWith('Unknown (left ')` as the natural fired-once marker. Side-effect fix via the abstraction's idempotency slot.
- **Repeat-fire forget bug** (perf): legacy fired forget every tick once disposition+trust hit 0 (wasted UPDATE per forgotten NPC). Migration adds `hasFiredRecently: disposition === 0 && trust_level === 0` as the natural fired-once marker.

**Tests** — `tests/npc-absence-cluster.test.js`, 50 assertions all passing:
- All four consumers built + exposed (name, semantics/threshold, applyDecay/checkAndFire methods)
- `calculateDispositionDecay` legacy formula preserved exactly: 8 boundary + 30/31 tier transitions + 90/93 second-tier + high-trust modifier (half rate) + -20 floor cap
- `calculateTrustDecay` legacy formula preserved: 14/15 boundary + 24/60/65/80 tier values + 0 floor + zero-trust shortcut
- Dual-decay-from-one-anchor: parallel synthetic test runs both consumers against shared anchor, verifies both decays apply independently to different value columns, anchor stays at HIGH_WATER_MARK
- Stochastic threshold honored: forced random pass/fail paths verify probability gate + idempotency-on-failed-roll behavior
- **Fix-along-the-way validation**: relocate idempotency blocks compound-prefix on already-relocated NPC; forget idempotency blocks repeat-fire on already-zero NPC
- Consumer-side condition gate (handler-level filter) returns `{fired: false, reason: 'condition_not_met'}` cleanly — abstraction doesn't need a generic condition parameter

All prior suites green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-marker-schemas (73), sc6-4a-survival-crafting-schemas (62), sc6-4b-merchant-schemas (47), sc6-4c-promise-notoriety-schemas (36), sc6-4d-combat-mythic-schemas (48), time-bounded-state (69), companion-mood-decay (45), faction-quests (112). Server boot smoke clean. (Skipping client build — no client/ changes.)

**Production wire-up**: existing `processAbsenceEffects` callsite at `routes/dmSession.js:773` continues to work unchanged. Per-NPC absence behavior is identical from the player perspective — except for the two latent bugs which are now fixed (cosmetic compound-prefix prevented; perf-wasted UPDATEs blocked).

**SC-7.3 acceptance criteria met (per spec §3.3.7):**
- `processAbsenceEffects` orchestrates two decay consumers + two threshold consumers (interpreted spec's literal "one threshold consumer" liberally — see DECISION_LOG)
- Stochastic threshold (relocation 10% roll) exercises `probability` parameter
- ABSENCE prompt annotation reads same anchor without going through decay primitive (read-only display, untouched)
- DECISION_LOG entry on stochastic threshold support + dual fix-along-the-way

**Pattern D migration progress:** 2 of 6 consumer ports complete (SC-7.2 mood + SC-7.3 absence cluster). Remaining: SC-7.4 (notoriety — WRITTEN_BACK semantics), SC-7.5 (threshold cluster: 4 consumers batched), SC-7.6 (survival timer cleanup), SC-7.7 (world event clock fix). Three decay semantics validated post-SC-7.4: CONSUMED ✓ (SC-7.2), HIGH_WATER_MARK ✓ (SC-7.3), WRITTEN_BACK (next).

---

## [1.0.0.156] - 2026-05-05 — Phase 3.3 SC-7.2: companion mood decay migration (first Pattern D port — validates CONSUMED semantics)

First consumer port for the time-bounded state abstraction. Validates the `DECAY_SEMANTICS.CONSUMED` shape — the variant that distinguishes companion mood from the high-water-mark decays in §1.2/§1.3/§1.9 (NPC disposition, NPC trust, notoriety). When the decay value reaches floor (0), the entire mood state resets and the anchor NULLs; subsequent ticks no-op until `setMood` re-establishes a non-content mood with a fresh anchor.

**`server/services/companionBackstoryService.js`:**
- New module-level export `MOOD_DECAY_CONSUMER` — built via `registerDecayConsumer({...})` with `semantics: DECAY_SEMANTICS.CONSUMED`, `decayFunction: (daysElapsed) => Math.floor(daysElapsed / 2)` (legacy preserved exactly), `floor: 0`. Repository callbacks read/write `companion_backstories.mood_set_game_day` (anchor) and `mood_intensity` (value). The `consumeAnchor` callback does the full legacy reset (`mood='content', mood_cause=NULL, mood_intensity=1, mood_set_game_day=NULL`) — overwrites the abstraction's writeValue(0) call that just landed.
- `decayMoods(characterId, currentGameDay)` rewritten as a thin orchestrator: SELECT all eligible companions (filter preserved: active companions of this character with non-content mood + non-null anchor) → iterate → `MOOD_DECAY_CONSUMER.applyDecay({backstoryId}, currentGameDay)` for each. The per-companion decay logic moves into the abstraction; the consumer scope decision (which companions to consider) stays in the orchestrator.
- New import: `registerDecayConsumer, DECAY_SEMANTICS` from `./timeBoundedState.js`.

**Two-step reset trade-off documented inline.** When the abstraction's writeValue(0) lands and consumeAnchor follows with the full reset, there are 2 UPDATE statements vs. legacy's 1 UPDATE. Acceptable cost: mood decay runs at session-start only, companions per character are typically <10, resets are rare. Documented at the consumer registration so future review doesn't get confused by the redundant intensity write.

**Tests** — `tests/companion-mood-decay.test.js`, 45 assertions all passing:
- `MOOD_DECAY_CONSUMER` shape sanity (name, semantics=CONSUMED, applyDecay)
- Decay function preservation: 1 intensity per 2 game days (`floor(daysElapsed / 2)`) — legacy behavior preserved exactly
- **CONSUMED-vs-HIGH-WATER distinction** validated explicitly with a two-tick sequence: tick 1 (intensity 3 → 1, anchor STAYS at 100), tick 2 (intensity 1 → 0 → reset, anchor NULLed)
- Reset shape: `mood='content'`, `mood_cause=NULL`, `mood_intensity=1` (NOT 0), `mood_set_game_day=NULL` — matches legacy reset state exactly
- Subsequent ticks after reset are no-ops (anchor=null, no decay applies)
- Edge cases: 0 elapsed → no-op; 1 elapsed → decay 0 → no-op (legacy threshold preserved); large elapsed crosses floor in single tick
- **Legacy-vs-new behavior comparison**: 4 scenarios run through inline-replicated legacy logic + the new abstraction side-by-side. All four scenarios produce byte-identical end-state across `mood / intensity / mood_cause / anchor`.

All prior suites green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-marker-schemas (73), sc6-4a-survival-crafting-schemas (62), sc6-4b-merchant-schemas (47), sc6-4c-promise-notoriety-schemas (36), sc6-4d-combat-mythic-schemas (48), time-bounded-state (69), faction-quests (112). Server boot smoke clean. (Skipping client build — no client/ changes.)

**Production wire-up**: existing `decayMoods` callsite at `routes/dmSession.js:812` continues to work unchanged. Mood decay behavior is identical from the player perspective; the change is purely structural (per-companion logic moved into the abstraction).

**SC-7.2 acceptance criteria met (per spec §3.3.7):**
- `companionBackstoryService.decayMoods` delegates to `registerDecayConsumer`
- "Consumed" semantics validated — anchor NULLs at intensity 0 (verified in test, legacy reset shape preserved exactly)
- Existing mood-decay tests pass (no pre-existing tests; new test suite is the first coverage)
- New test for consumed-vs-high-water distinction lands the validation explicitly
- Behavior unchanged from player perspective (legacy-vs-new comparison test confirms byte-identical end-state)

**For Phase 3.3 close-out DECISION_LOG entry**: this ship is the first real exercise of `DECAY_SEMANTICS.CONSUMED`. The two-step reset trade-off (2 UPDATEs vs 1) and the orchestrator-stays-consumer-side pattern (SELECT scope decision NOT in abstraction) are both worth landing as part of the close-out's "what we learned migrating consumers" section.

---

## [1.0.0.155] - 2026-05-05 — Phase 3.3 SC-7.1: Pattern D foundation (time-bounded state primitives — no consumer migrations yet)

First ship in Phase 3.3 (Pattern D / time-bounded state primitives). Per spec §3.3.7: foundation lands, API review gate before any consumer migrates in SC-7.2. Same pattern as §3.1 SC-1 + §3.2 SC-6.1 — foundation-first, validate API shape, then incremental migrations.

**`server/services/timeBoundedState.js`** (new file, ~280 lines):
- New export `daysSince(anchorGameDay, currentGameDay)` — normalized arithmetic helper. Returns null when either arg is null/undefined (explicit "no anchor set" semantics); returns `max(0, elapsed)` otherwise (game-day-rollback safety). Replaces ~20 sites of inline arithmetic identified by the Pattern D survey. Future hour-granularity work can grow a unit parameter without breaking call sites (per spec Q11).
- New export `registerDecayConsumer(config)` — consumer factory for decay-on-read patterns. Accepts config with `decayFunction`, `floor`/`ceiling`, `repository` callbacks, and `semantics` enum. Returns object with `applyDecay(contextKey, currentGameDay, contextHints)` method.
- New export `registerThresholdConsumer(config)` — consumer factory for threshold-crossed-with-effect patterns. Accepts config with `threshold` (in days), `handler`, `idempotency` callbacks, optional `probability` parameter for stochastic crossers (Q8 — used first by SC-7.3 NPC relocation 10% roll). Returns object with `checkAndFire(contextKey, currentGameDay, contextHints)` method.
- New export `DECAY_SEMANTICS` enum — three frozen values: `HIGH_WATER_MARK` (anchor stays put across ticks; NPC disposition / trust shape), `CONSUMED` (anchor NULLs at floor; companion mood shape), `WRITTEN_BACK` (anchor advances to currentGameDay after each tick; notoriety shape). Each consumer specifies its semantics; abstraction dispatches to semantics-specific anchor handling post-decay.

**Design decisions (full DECISION_LOG entry alongside this ship):**
- **Parameterize, don't converge** — same call as §3.1 SC-1. Each consumer keeps its own anchor column, decay function shape, and idempotency strategy. Repository callbacks own storage; abstraction owns orchestration.
- **Probability roll happens BEFORE handler.** Failed rolls leave idempotency unrecorded — next tick can roll again (matches legacy NPC relocation semantics).
- **Handler errors contained, not propagated.** Logged via `console.error`; surfaced as `{fired: false, reason: 'handler_error', error}`. Idempotency NOT recorded on handler error (allows retry). Mirrors §3.1 SC-1's threshold-handler-error containment policy.
- **Idempotency-record errors don't degrade handler success.** If `recordFired` throws after the handler ran, return is `{fired: true, handlerResult, idempotencyError}` rather than rolling back. The handler's side effect already landed; flagging the secondary failure is more useful than pretending it didn't.

**Tests** — `tests/time-bounded-state.test.js`, 69 assertions all passing:
- `daysSince` null/clamp/edge-case semantics
- Config validation for both registration APIs (catches malformed configs early; tested via `expectThrow` helper covering 11 distinct invalid-config shapes)
- Three decay semantics validated independently — high-water-mark anchor unchanged, consumed anchor NULLed at floor, written-back anchor advanced to currentGameDay
- Floor + ceiling clamping with no-op-on-clamp behavior
- Threshold + idempotency + probability roll + handler-error containment
- Empty-state safety (no-op consumers don't crash; foundation ship has no consumer migrations yet)
- DECAY_SEMANTICS enum exposed + frozen

All prior Phase 3 suites green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-marker-schemas (73), sc6-4a-survival-crafting-schemas (62), sc6-4b-merchant-schemas (47), sc6-4c-promise-notoriety-schemas (36), sc6-4d-combat-mythic-schemas (48), faction-quests (112). Server boot smoke clean. (Skipping client build — no client/ changes.)

**SC-7.1 acceptance criteria met (per spec §3.3.7):**
- `services/timeBoundedState.js` exports the three primitives
- Tests confirm primitive API shapes and configuration validation
- DECISION_LOG entry on parameterize-not-converge call (mirroring Pattern A's SC-1 call)
- No consumer migrations yet; behavior unchanged everywhere

**API review gate**: PM + user review the API shape before SC-7.2 (companion mood migration) starts. Same gate as §3.1 SC-1 + §3.2 SC-6.1 had.

---

## [1.0.0.154] - 2026-05-05 — Phase 3 SC-6.5: documentation closing (Phase 3.2 marker pipeline consolidation complete)

Documentation-only ship. Closes Phase 3.2 per spec §3.9: `markerSchemas.js` header docs reflect canonical role; `CLAUDE.md` "DM session markers + marker pipeline" section landed with the four-rationale schemas-without-handlers category as **intentional design** (not reverse-engineered from per-ship entries); closing DECISION_LOG entry consolidating §3.2's whole arc across 5 sub-checkpoints.

**`server/services/markerSchemas.js` header:**
- Reframed as **canonical dispatch surface** (post-Phase-3.2). Old framing ("intermediate step toward full tool-use migration") preserved as forward-looking note; the schemas + pipeline are the production path today.
- Architecture section spells out the 4-step model: schemas → parsing (`parseMarkerBody`) → dispatch (handlers via `markerPipeline`) → correction loop (`pendingMarkerCorrections`).
- Schemas-without-handlers section enumerates the four legitimate rationales (ordering invariants / aggregated returns / no side-effect target / orchestrated-with-sibling-marker) with example markers per rationale.

**`CLAUDE.md` "DM session markers + marker pipeline" section:**
- Old flat marker list replaced with: marker list + canonical-pipeline description + handler placement map (13 service files, 24 handlers) + four-rationale schemas-without-handlers landed as intentional design + legacy `detectXxx()` deprecation note.
- "Key files" section updated to add `markerSchemas.js` + `markerPipeline.js` + `combatMarkerService.js` + `lootDropService.js` (the new SC-6.4 single-purpose marker-handler modules), and to annotate `dmSessionService.js` + `preludeMarkerDetection.js` with their post-Phase-3.2 status.

**`DECISION_LOG.md`:**
- New top entry "Phase 3.2 closing: marker pipeline consolidation complete" — synthesizes the whole §3.2 arc across SC-6.1 → SC-6.5. Distinct from the SC-6.4 close-out entry below it (which covered the SC-6.4 sweep specifically). Captures three principles validated by Phase 3.2: foundation-first sub-checkpoint cadence, schemas-without-handlers as first-class end-state, schema-direction as per-marker call.

**Phase 3.2 final numbers (post all 5 sub-checkpoints):**
- 39 markers in MARKER_SCHEMAS with schema validation + correction-loop feedback active
- 24 handlers registered across 13 service files
- 22 detect-function call sites deleted from `routes/dmSession.js` (~580 lines), 6 from `routes/dmMode.js` (BOND_SHIFT migration), 1 from earlier (PIETY_CHANGE migration in SC-4)
- 2 new single-purpose service files (`lootDropService.js`, `combatMarkerService.js`)
- 5 PARK ENTIRELY rulings for non-marker functions
- 1 production bug discovered + resolved via "fix-along-the-way" pattern

**No code changes** (header docstring is the only `.js` edit; rest is `.md`). Server boot smoke clean. All 13 prior Phase 3 + faction-quests test suites still green. Skipping client build (no `client/` changes; would be a no-op).

**Phase 3 status post-SC-6.5:**
- Phase 3.1 (standing-scalar abstraction) — complete (SC-1 through SC-5)
- Phase 3.2 (marker pipeline consolidation) — complete (SC-6.1 through SC-6.5)
- Phase 3.3 (Pattern D / time-bounded state primitives) — spec locked at PHASE_3_REFACTOR_SPEC.md §3.3; SC-7.1 unblocked

---

## [1.0.0.153] - 2026-05-05 — Phase 3 SC-6.4d: combat / mythic / base-defense cluster + SC-6.4 close-out (6 markers — all 6 handlers)

Fourth and final ship in the SC-6.4 four-ship sweep. Final cluster is the cleanest-shape: 6 markers, 6 handlers, zero parks. Includes the heaviest single-marker handler in SC-6.4 (COMBAT_START rolls initiative for player + companions + enemies) and the orchestrator handler with cascade (MYTHIC_TRIAL → optional advanceTier).

**`server/services/markerSchemas.js`:** 3 new schemas added to MARKER_SCHEMAS:
- MYTHIC_TRIAL: Name required, Description + Outcome enum (passed/failed/redirected) optional
- ITEM_AWAKEN: Item required, NewState enum (awakened/exalted/mythic) + Deed optional
- MYTHIC_SURGE: Ability required, Cost optional positive int

(COMBAT_START / COMBAT_END / BASE_DEFENSE_RESULT schemas already in MARKER_SCHEMAS pre-Phase-3.)

**`server/services/mythicService.js`:**
- MYTHIC_TRIAL handler — calls `recordTrial`; if result.canAdvance, additionally calls `advanceTier`. Returns `{mythicEvents: [trial, optional tier_advance]}` for the route to unpack into mythicEvents array.
- ITEM_AWAKEN handler — locates legendary item via `findLegendaryItemByName`; calls `advanceItemState` with new state + deed. Silent no-op if item not in inventory (legacy preserved).
- MYTHIC_SURGE handler — calls `useMythicPower`; gated on `character.has_mythic` (legacy preserved).

**`server/services/baseThreatService.js`:**
- BASE_DEFENSE_RESULT handler — calls `recordPlayerDefenseOutcome`. Returns systemNote text the route pushes to result.messages (success or failure variant). Multi-instance support preserved.

**`server/services/combatMarkerService.js` (new file):**
- Single-purpose module owning COMBAT_START + COMBAT_END handlers. Created because no existing combat service owned AI-driven combat-state initialization.
- COMBAT_START handler — heaviest single-marker handler in SC-6.4. Computes player initiative (ability_scores DEX mod + d20), companion initiatives (joins companions + npcs tables for active companions), enemy initiatives (`estimateEnemyDexMod` heuristic + d20). Sorts turn order by initiative/modifier with random tiebreaker. Returns `{combatStart: {turnOrder, currentTurn, round}, systemNote}`.
- COMBAT_END handler — presence-only marker. Returns `{type: 'combat_end'}` for the route to set `combatEnd` boolean.

**`server/routes/dmSession.js`:**
- 6 inline detect-function dispatches DELETED — ~145 lines removed. Replaced by 4 small handlerResults extraction blocks routing by schemaKey into `defenseHandlerResults` / `combatStart` + `combatEnd` / `mythicEvents`.
- Imports cleaned: 6 detect-functions + 5 service helpers (recordTrial, advanceTier, findLegendaryItemByName, advanceItemState, useMythicPower, recordPlayerDefenseOutcome) no longer imported. Bare side-effect imports for baseThreatService + combatMarkerService.
- **Cumulative SC-6.4 thinning of `dmSession.js`: ~580 lines** of inline marker dispatch removed across the four cluster ships.

**Tests** — `tests/sc6-4d-combat-mythic-schemas.test.js`, 48 assertions all passing:
- All 6 cluster-5 schemas registered + handlers wired
- All 7 legacy detect-functions still exported (incl. estimateEnemyDexMod utility helper)
- Per-schema field validation including the 3 new mythic schemas
- End-to-end realistic combat/mythic turn extracts all 6 markers cleanly
- Cross-pipeline isolation: prior SC-4 + SC-6.4a/b markers still validate

All prior suites green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-marker-schemas (73), sc6-4a-survival-crafting-schemas (62), sc6-4b-merchant-schemas (47), sc6-4c-promise-notoriety-schemas (36), faction-quests (112). Server boot smoke clean. Client production build clean.

**Composition reconfirmed in SC-6.4d prep**: detectMythicTrial does NOT touch piety. The Q6 survey's hypothesized trial→piety cascade was a misread; recordTrial only inserts mythic_trials + bumps trials_completed. canAdvance triggers advanceTier (also no piety). Migration is structurally clean.

**SC-6.4 sweep complete (cumulative across 4 ships):**
- 22 detect-functions migrated to handlers (10 + 5 + 4 + 6 cluster splits, with PIETY_CHANGE pre-migrated in SC-4 = 23 actual; actual handler count post-Phase-3 in MARKER_SCHEMAS: 24 incl. BOND_SHIFT from SC-5)
- 2 added as schema-without-handler (SWIM, ADD_ITEM) — extending SC-6.3's prelude-marker precedent in two new categorical directions (no-side-effect-target, orchestrated-with-sibling)
- 4 confirmed PARK ENTIRELY (detectDowntime per PM ruling, detectRecruitment, estimateEnemyDexMod utility, parseMarkerKeyValue + parseMarkerPairs utilities)
- ~580 lines deleted from `routes/dmSession.js`
- 193 new schema/handler/snapshot test assertions
- 1 production bug discovered + fixed via the migration mechanism (notoriety silent-drop, headlined in v1.0.152)

**Consolidated SC-6.4 close-out DECISION_LOG entry** lands with this ship — covers all four cluster ships + the four structural decisions (schemas-without-handlers four rationales / schema-relaxation pattern / context.narrative API extension / "fix-along-the-way" named pattern). See [DECISION_LOG.md](DECISION_LOG.md) entry "Phase 3 SC-6.4 close-out" 2026-05-05.

**Phase 3.2 (marker pipeline consolidation) complete.** SC-6.5 (documentation closing — markerSchemas.js header docs + CLAUDE.md model split + closing DECISION_LOG entry per spec §3.9) is the remaining Phase 3.2 sub-checkpoint. Phase 3.3 (Pattern D / time-bounded state primitives) is the next major Phase 3 surface, gated on PM drafting §3.3 of PHASE_3_REFACTOR_SPEC.md.

---

## [1.0.0.152] - 2026-05-05 — BUG FIX: notoriety silent-drop on canonical-format markers (resolved as part of Phase 3 SC-6.4c migration)

**Headline.** `[NOTORIETY_GAIN]` and `[NOTORIETY_LOSS]` markers emitted by the DM AI in the canonical prompt-instructed format (quoted, space-separated: `[NOTORIETY_GAIN: source="City Watch" amount=15 category="criminal"]`) were silently dropped pre-v1.0.152. The detect-functions used `parseMarkerKeyValue` which expects comma-separated, possibly-unquoted values. When the AI emitted canonical, the parser's `str.split(',')` returned one entry containing the whole quoted string; key-extraction on that single entry produced garbage and the truthy-check `if (data.source && data.amount)` rejected it. Result: the notoriety side effect never fired. No error logged, no correction-loop feedback, no client visibility.

**Severity.** Functional / Data-integrity. The notoriety system is a real game mechanic (entanglement risk, faction reactions). Players accumulated less heat than the AI intended; the AI's narrative-side notoriety acknowledgments wouldn't match the DB state. Likely most or all production NOTORIETY emissions silently dropped, given the prompt instructs the canonical quoted format explicitly.

**Discovery.** SC-6.4 implementation prep, 2026-05-05. Surfaced while spot-checking the survey's "alternative parser" PM call against the actual code path — the divergence between the prompt-instructed format and the detect-function's parser was visible in source.

**Fix shape.** The SC-6.4c migration replaces both `detectNotorietyGain` and `detectNotorietyLoss` call sites in `routes/dmSession.js` with handlers backed by `markerSchemas.js` parsing. The schema's `extractField` regex's third alternation (`([^\\s,\\]]+)`) handles bareword/comma-sep formats while the first two alternations handle quoted forms — natively accepts BOTH formats without consumer-side accommodation. `parseMarkerKeyValue` becomes dead code (the helper is referenced in the Q6 survey as PARK ENTIRELY); legacy `detectNotoriety*` exports stay per "deprecate by hiding" but no longer invoked from production.

**KNOWN_BUGS archive.** Entry resolved at v1.0.152. See [KNOWN_BUGS.md](KNOWN_BUGS.md) "Notoriety silent-drop on canonical-format markers."

**Test snapshot.** `tests/sc6-4c-promise-notoriety-schemas.test.js` "HEADLINE" section asserts the canonical quoted format parses cleanly post-fix:
- `source="City Watch"` extracts as `'City Watch'` (embedded space preserved)
- `amount=15` extracts as int 15
- `category="criminal"` extracts as enum 'criminal'
- Plus schema validation surfaces field-targeted correction-loop feedback for malformed amount/category violations

---

## [1.0.0.152] - 2026-05-05 — Phase 3 SC-6.4c: promise + notoriety cluster migration (4 markers — all 4 handlers, no parks)

Third of four ships in the SC-6.4 sweep. **The notoriety silent-drop bug fix above ships with this cluster** (separate CHANGELOG entry per PM direction so the bug fix lands as the headline, not buried as a migration footnote).

**Cluster shape: 4 markers, 4 handlers, zero parks.** Cleanest-shape cluster in SC-6.4 — every marker has a single clean side-effect target. PROMISE_MADE/FULFILLED touch npcRelationshipService + canon_facts + consequenceService cascades; NOTORIETY_GAIN/LOSS touch notorietyService.

**`server/services/notorietyService.js`:**
- NOTORIETY_GAIN handler — multi-instance dispatch. Reads character's campaign_id + game_day, calls `addNotoriety` with parsed source/amount/category. Returns event object for response payload. Resolves the silent-drop bug headlined above by routing through the schema parser.
- NOTORIETY_LOSS handler — same shape, inverts amount sign. Hardcodes `category: 'criminal'` (legacy behavior; NOTORIETY_LOSS schema doesn't carry category).

**`server/services/consequenceService.js`:**
- PROMISE_MADE handler — NPC name lookup (case-insensitive), `npcRelationshipService.addPromise`, INSERT into canon_facts. NPC-not-found is silent no-op (legacy preserved).
- PROMISE_FULFILLED handler — heaviest in this cluster. NPC lookup → `getPendingPromises` → fuzzy match by promise text prefix → `fulfillPromise` (returns weight) → weight-derived `adjustDisposition` + `adjustTrust` → `spreadReputationRipple` → `spreadFactionStanding` → INSERT into canon_facts. Returns rich event object with all the cascade effects.

**`server/routes/dmSession.js`:**
- Inline detect-function dispatches for all 4 markers DELETED — ~135 lines removed. Replaced by a 12-line `handlerResults` extraction that splits results into `promiseEvents` / `notorietyEvents` arrays by schemaKey set membership.
- Imports cleaned: `detectPromiseMade`, `detectPromiseFulfilled`, `detectNotorietyGain`, `detectNotorietyLoss` no longer imported (legacy exports stay). Five service-function imports removed: `addPromise`, `fulfillPromise`, `getPendingPromises`, `adjustDisposition` (npc), `adjustTrust` (npc), `addNotoriety`, `FULFILL_WEIGHTS`, `spreadReputationRipple`, `spreadFactionStanding` — all now invoked inside their respective service handlers.
- `calculatePriceModifier` import retained (used elsewhere in the route at the merchant-price-modifier path).

**Tests** — `tests/sc6-4c-promise-notoriety-schemas.test.js`, 36 assertions all passing:
- All 4 cluster-3 schemas registered + handlers wired
- All 4 legacy detect-functions still exported (back-compat)
- Per-schema field validation including the canonical-format bug-fix headline assertions
- End-to-end realistic narrative extraction
- Cross-pipeline isolation: SC-4 + SC-6.4b markers still validate

All prior suites green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-marker-schemas (73), sc6-4a-survival-crafting-schemas (62), sc6-4b-merchant-schemas (47), faction-quests (112). Server boot smoke clean. Client production build clean.

**Cumulative SC-6.4 progress:** 19 of 22 detect-functions migrated (10 in v1.0.150 + 5 in v1.0.151 + 4 in v1.0.152). Remaining: 6 in v1.0.153 (combat/mythic cluster). Cumulative thinning of `routes/dmSession.js`: ~440 lines deleted across the three cluster ships.

**Per-ship review gates:** v1.0.152 ships → user smoke + PM review → v1.0.153 (combat/mythic + consolidated DECISION_LOG entry covering all four ships) starts.

---

## [1.0.0.151] - 2026-05-05 — Phase 3 SC-6.4b: merchant cluster migration (5 markers — 4 handlers + 1 schema-only orchestrated by sibling)

Second of four ships in the SC-6.4 sweep. Merchant cluster has the heaviest response-payload coupling — MERCHANT_SHOP loads inventory, builds the AI-context message, integrates merchant relationships; MERCHANT_COMMISSION pushes success/failure system notes; LOOT_DROP consolidates per-drop results into a combined player-facing inventory message. The cluster validates the "handler returns data; route assembles response payload" pattern from cluster 1 against substantially more complex coupling.

**Cluster shape: 4 handlers + 1 schema-only.** ADD_ITEM is the schema-only entry — its legacy code path was orchestrated WITH MERCHANT_SHOP (only fires when a merchant context exists), so the migration folds ADD_ITEM processing INTO the MERCHANT_SHOP handler. ADD_ITEM keeps its schema for correction-loop validation but doesn't dispatch independently. This extends the SC-6.3 schemas-without-handlers precedent: schema-only is also the right shape for markers that orchestrate together with a sibling marker (the orchestration belongs in one handler, not split across two).

**`server/services/markerSchemas.js`:** MERCHANT_COMMISSION schema extended with optional `Price_SP`, `Price_CP`, `Deposit_SP`, `Deposit_CP`, `Description` fields + `Price_GP` min relaxed from 1 to 0. Preserves the legacy detect-function's tolerance for mixed-denomination prices and free-text description without forcing the AI prompt to change. Other 4 cluster schemas (MERCHANT_SHOP, ADD_ITEM, MERCHANT_REFER, LOOT_DROP) were already in MARKER_SCHEMAS pre-Phase-3.

**`server/services/merchantService.js`:**
- MERCHANT_SHOP handler — orchestrates the full shop activation: find/create merchant via `getMerchantInventory` + `createMerchantOnTheFly`; processes coupled ADD_ITEM markers from the same narrative via `extractMarkerBodies` + `parseMarkerBody`; calls `addItemToMerchant` for each; re-loads inventory; builds the inventoryContext system note with cursed-item special-case handling. Returns the merchant info + the inventoryContext string for the route to push to `result.messages`.
- MERCHANT_REFER handler — calls `ensureItemAtMerchant`. Silent side effect; no AI-context message push.

**`server/services/merchantOrderService.js`:**
- MERCHANT_COMMISSION handler — preserves the idempotency guard (skip if active order exists for the same item at the same merchant) and the gp/sp/cp price aggregation. Returns a structured `{type, status, orderId, systemNote}` object the route handler pushes to `result.messages` based on `status` (placed | failed | skipped_duplicate).

**`server/services/lootDropService.js` (new file):**
- Single-purpose module owning the LOOT_DROP marker handler. Created because no existing service owned character-inventory mutation for AI-driven drops. Handler does per-marker: lookup against loot tables, mutate inventory, persist. Returns the structured drop result. Route consolidates handlerResults for all LOOT_DROPs into ONE combined SYSTEM note (preserves the legacy "items have been added: A, B, C" shape).

**`server/routes/dmSession.js`:**
- Pipeline context extended: now passes `narrative` so the MERCHANT_SHOP handler can self-orchestrate the coupled ADD_ITEM markers without needing a separate handler for them.
- Inline detect-function dispatches for MERCHANT_SHOP / ADD_ITEM (combined block, ~55 lines) + MERCHANT_REFER (~10 lines) + MERCHANT_COMMISSION (~75 lines) + LOOT_DROP (~50 lines) all DELETED. Replaced by a 25-line `handlerResults` extraction that reads `MERCHANT_SHOP.inventoryContext` / `MERCHANT_COMMISSION.systemNote` / consolidated LOOT_DROP results and pushes to `result.messages`.
- Two new bare side-effect imports: `import '../services/merchantOrderService.js'` (was `import { placeCommission }` — now loaded for module-level handler registration), `import '../services/lootDropService.js'` (new).
- Imports cleaned: `detectMerchantShop`, `detectMerchantRefer`, `detectAddItem`, `detectLootDrop`, `detectMerchantCommission` no longer imported (legacy exports stay per "deprecate by hiding"). `placeCommission`, `addItemToMerchant`, `ensureItemAtMerchant`, `getLootTableForLevel` no longer imported (handlers in consumer services own the calls now). `lookupItemByName` still imported (used elsewhere in the file).
- Net: ~190 lines deleted from the route handler this ship; cumulative SC-6.4 thinning ~300 lines.

**Tests** — `tests/sc6-4b-merchant-schemas.test.js`, 47 assertions all passing:
- All 5 cluster-2 schemas registered, 4 handlers registered (ADD_ITEM excluded by design — verified `!_hasHandler('ADD_ITEM')`)
- All 5 legacy detect-functions still exported
- Per-schema field-extraction tests covering all 5 schemas including the SC-6.4b extension fields (sp/cp denominations + Description)
- End-to-end realistic merchant turn extracts all 5 markers cleanly with zero false failures
- **Response-payload snapshot tests** (PM suggestion for cluster-2): 5 cases covering MERCHANT_SHOP message push, MERCHANT_COMMISSION placed/failed/skipped_duplicate variants, LOOT_DROP combined-message consolidation, MERCHANT_REFER silent (no push). Each asserts byte-identical `result.messages` content versus the legacy inline-dispatch shape.
- Cross-pipeline isolation: SC-4 PIETY_CHANGE + SC-6.4a SHELTER_FOUND still validate alongside cluster-2 schemas.

All prior suites green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-marker-schemas (73), sc6-4a-survival-crafting-schemas (62), faction-quests (112). Server boot smoke clean. Client production build clean.

**Notable findings deferred to consolidated DECISION_LOG entry at v1.0.153 close-out:**
- ADD_ITEM as schema-only-orchestrated-by-sibling extends the SC-6.3 schemas-without-handlers precedent in a new direction (SC-6.3 reasons were ordering invariants + aggregated returns; SC-6.4a added "no side-effect target" via SWIM; SC-6.4b adds "orchestrated-with-sibling-marker" via ADD_ITEM).
- MERCHANT_COMMISSION schema extension preserves legacy detect-tolerance (mixed-denomination prices, free-text description) — schema-relaxation rather than tightening; an explicit choice to keep behavior-neutral on the migration ship.
- Pipeline context now carries `narrative` for self-orchestrating handlers — small API extension, used by MERCHANT_SHOP only this ship; available for future cross-marker-coordination cases.

**Per-ship review gates:** v1.0.151 ships → user smoke + PM review → v1.0.152 (promise/notoriety cluster — headlines the notoriety silent-drop bug fix in its own CHANGELOG entry) starts.

**SC-6.4b acceptance criteria progress:** 15 of 22 detect-functions migrated cumulatively (10 in v1.0.150 + 5 in v1.0.151). Cluster-2 detect-function call sites removed from `routes/dmSession.js`; legacy exports retained. Existing tests stay green; new tests confirm schema validation + response-payload byte-identity. DECISION_LOG entry deferred to v1.0.153 close-out.

---

## [1.0.0.150] - 2026-05-05 — Phase 3 SC-6.4a: survival + crafting cluster migration (10 markers — 9 handlers + 1 schema-only)

First of four ships in the SC-6.4 detect-function sweep. Per the four-ship split confirmed by PM 2026-05-05 (single SC-6.4 ship was rejected after sizing surfaced cluster-2/3/4 having substantively different review surfaces). 10 markers across the survival + crafting domain: SHELTER_FOUND first per the Phase 4 prep flag; SWIM is schema-only because the legacy `detectSwim` was exported but never invoked from any side-effect path; the other 8 are full schema+handler migrations.

**`server/services/markerSchemas.js`:** 10 new schemas under a Phase 3 SC-6.4 section header — SHELTER_FOUND (Type enum required, Quality enum optional), WEATHER_CHANGE (Type required, Duration_Hours optional positive int defaulting to 24), EAT (Item required), DRINK (Item required), FORAGE (Terrain/Result/Food/Water all optional with Result enum + non-negative int constraints), SWIM (Duration optional — schema-only), CRAFT_PROGRESS (Hours required positive int), RECIPE_FOUND (Name required + Source optional), MATERIAL_FOUND (Name required + Quantity/Quality optional with Quality enum), RECIPE_GIFT (Name + Category required + 9 optional fields covering DC / Hours / Materials / etc.).

**`server/services/survivalService.js`:**
- New export `setCharacterShelter(characterId, shelterType)` — single-purpose helper called by the SHELTER_FOUND handler; also available for future non-marker shelter-set paths.
- 4 module-load handler registrations: SHELTER_FOUND (calls `setCharacterShelter`), EAT (calls `consumeFood`), DRINK (calls `consumeWater`), FORAGE (mutates inventory + writes back). Each handler reads game_day from the characters table fresh; matches the SC-4 piety pattern.
- Each handler returns the event object the route handler used to push into `survivalEvents` (preserves the existing client contract — `DMSession.jsx:869` uses `survivalEvents.length > 0` as a refresh trigger).

**`server/services/weatherService.js`:**
- WEATHER_CHANGE handler registers at module load. Reads character's campaign_id + game_day, calls `setWeather`, returns the weatherChangeResult shape the route used to push into `data.weatherChange`.

**`server/services/craftingService.js`:**
- 4 module-load handler registrations: RECIPE_FOUND (calls `discoverRecipe`), MATERIAL_FOUND (calls `addMaterial`), CRAFT_PROGRESS (looks up active in-progress project via `getProjectStatus`, calls `advanceProject` if found — no-op if none), RECIPE_GIFT (maps schema's PascalCase fields to recipeData lowercase shape, calls `createRadiantRecipe`).
- Each handler returns the event object the route handler used to push into `craftingEvents`.

**`server/routes/dmSession.js`:**
- The `processResponseMarkers` call site now captures `pipelineResult` (was previously fire-and-forget). Downstream code reads `pipelineResult.handlerResults` to assemble response-payload arrays.
- Inline detect-function dispatches for all 10 cluster-1 markers DELETED — 113 lines removed. Replaced by an 11-line `handlerResults` extraction that routes by schemaKey into the existing `survivalEvents` / `craftingEvents` / `weatherChangeResult` slots.
- Imports cleaned: `detectWeatherChange` / `detectShelterFound` / `detectSwim` / `detectEat` / `detectDrink` / `detectForage` / `detectRecipeFound` / `detectMaterialFound` / `detectCraftProgress` / `detectRecipeGift` no longer imported (legacy exports stay per "deprecate by hiding"). `setWeather`, `consumeFood`, `consumeWater`, `discoverRecipe`, `addMaterial`, `advanceProject`, `getProjectStatus`, `createRadiantRecipe` no longer imported (handlers in the consumer services own the calls now). The bare side-effect imports of survival/weather/crafting services in dmSession.js still fire the module-load `registerMarkerHandler` calls.

**Tests** — `tests/sc6-4a-survival-crafting-schemas.test.js`, 62 assertions all passing:
- All 10 cluster-1a schemas registered in MARKER_SCHEMAS
- 9 handlers registered (SWIM excluded by design — verified `!_hasHandler('SWIM')`)
- All 10 legacy detect-functions still exported from dmSessionService.js (back-compat per "deprecate by hiding")
- Per-schema field-extraction tests: canonical form parses, missing required → field-targeted error, enum violations → field-targeted error, min/max violations → field-targeted error, optional fields tolerated
- End-to-end realistic narrative slice with 5 markers extracts to validByKey correctly with zero false failures
- Cross-pipeline isolation: SC-4 PIETY_CHANGE + SC-5 BOND_SHIFT still validate alongside cluster-1 schemas

All prior suites green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-marker-schemas (73), faction-quests (112). Server boot smoke clean. Client production build clean.

**Notable findings during implementation, deferred to later ships' DECISION_LOG entries (consolidated at v1.0.153 close-out):**
- `detectDowntime` ruled PARK ENTIRELY (not SCHEMA-WITHOUT-HANDLER as initial survey suggested) — operates on player input not AI narrative; adding `[DOWNTIME]` would be NEW marker semantics excluded by spec §3.5. Survey + KNOWN_BUGS-style triage updated.
- `detectMythicTrial` does NOT compose with the SC-4 piety abstraction (initial survey hypothesized a trial→piety cascade — spot-check confirmed `recordTrial` doesn't touch piety). Migration in v1.0.153 (cluster 5) is structurally clean.
- Notoriety silent-drop bug discovered (`parseMarkerKeyValue` chokes on the canonical prompt-instructed format) — pre-emptively logged in `KNOWN_BUGS.md` Resolved archive section as a fix-along-the-way for v1.0.152 (cluster 4 — promise/notoriety).

**Per-ship review gates assumed:** v1.0.150 ships → user smoke + PM review → v1.0.151 (merchant cluster) starts. Same gate before v1.0.152 (promise/notoriety + notoriety bug fix headlined in its own CHANGELOG entry) and v1.0.153 (combat/mythic + consolidated DECISION_LOG entry covering all four ships).

**SC-6.4a acceptance criteria progress:**
- 10 of 22 detect-functions migrated this ship (cumulative SC-6.4 progress)
- All cluster-1 detect-function call sites removed from `routes/dmSession.js`; legacy exports retained per "deprecate by hiding"
- Existing tests stay green; new tests confirm schema validation; cross-pipeline isolation verified
- DECISION_LOG entry deferred to v1.0.153 close-out per the four-ship sequencing

---

## [1.0.0.149] - 2026-05-04 — Phase 3 SC-6.3: Prelude marker schemas + correction-loop (parked from handler dispatch; ordering invariants force consumer-side orchestration)

19 Prelude markers added to MARKER_SCHEMAS for validation + correction-loop feedback. Per the SC-6.3 parking decision (DECISION_LOG entry 2026-05-04): ZERO handlers registered. Side-effect dispatch stays in `preludeSessionService.processMarkersForSession` because of ordering invariants between markers (`AGE_ADVANCE → HP_CHANGE` for max_hp; `CANON_FACT_RETIRE → CANON_FACT` for retire-then-record; `CHAPTER_PROMISE → AGE_ADVANCE` for chapter check) plus aggregated-return shapes (`npcsCreated`, `capViolations`, `offeredEmergences` etc.) that don't fit per-handler dispatch. The pipeline's contribution is **correction-loop feedback** — a capability that didn't exist for prelude markers before SC-6.3.

**`server/services/markerSchemas.js`:** 19 new schemas under a Phase 3 SC-6.3 section header:
- 15 standard field-extracted markers: `AGE_ADVANCE` (years int min 1), `CHAPTER_END` (summary required), `SESSION_END_CLIFFHANGER` (text optional), `NPC_CANON` (name required + relationship/status optional), `LOCATION_CANON` (name required + type/is_home optional), `HP_CHANGE` (delta signed int + reason optional), `CHAPTER_PROMISE` (theme/question both optional), `STAT_HINT` (stat enum [str|dex|con|int|wis|cha] required + magnitude bounded [1, 2] + reason optional), `SKILL_HINT`, `CLASS_HINT`, `THEME_HINT`, `ANCESTRY_HINT` (all canonical-form: skill/class/theme/feat_id required + reason optional), `CANON_THREAD` (kind enum [unresolved_loss|blood_debt|...] + subject + condition required + weight enum optional), `CANON_FACT` (subject + category enum [npc|location|event|relationship|trait|item] + fact required), `CANON_FACT_RETIRE` (subject + fact_contains required), `DEPARTURE` (reason/tone optional).
- 3 presence-only markers: `THEME_COMMITMENT_OFFERED`, `NEXT_SCENE_WEIGHT`, `PRELUDE_END` — `fields: {}`. The bareword/free-text bodies of these markers don't fit the field-extractor; the existing detect functions handle value extraction. Schema confirms presence.
- Backward-compat aliases (`CLASS_HINT.class_id=`, `THEME_HINT.theme_id=`, `ANCESTRY_HINT.feat=`, `CANON_FACT_RETIRE.contains=`) NOT in schema but still tolerated by detect functions. Intentional asymmetry: schemas tighten the AI-facing contract via the correction-loop; detect-functions stay legacy-tolerant for old transcripts.

**`server/services/preludeSessionService.js`:**
- New import: `validateDmMarkers, buildCorrectionMessage` from `markerSchemas.js`.
- After `processMarkersForSession`, run `validateDmMarkers(result.response)` to capture marker failures. Defensive try/catch — validation failures never block the message-flush flow.
- Stash `buildCorrectionMessage(failures)` to `session_config.pendingMarkerCorrections` (same key the player-mode pipeline uses; sessions are scoped per `session_type` so no cross-pollution risk).
- Consume any prior-turn `pendingMarkerCorrections` at the start of the next message-flush; inject as a `user`-role message before the AI call, mirroring the existing `pendingCapFeedback` / `pendingViolationNote` patterns.
- Logs malformed markers via `console.warn('[prelude-marker-schema] N malformed marker(s) on session X: ...')` for playtest visibility.

**`server/services/preludeMarkerDetection.js`:** untouched. All 19 detect functions stay in place (parking decision = side-effect dispatch stays consumer-side).

**Tests** — `tests/prelude-marker-schemas.test.js`, 73 assertions all passing:
- All 19 prelude schemas registered; ZERO handlers registered (parking preserved via `_hasHandler` checks)
- Field-extraction validation for each schema: canonical form parses, missing required → field-targeted error, enum violations → field-targeted error, min/max violations → field-targeted error
- Presence-only markers tolerate empty body + stray-content body
- End-to-end: realistic narrative slice with 2 valid + 2 invalid markers → 2 valid extractions + 2 correction-note entries that reference the malformed fields
- Cross-pipeline: prelude `CHAPTER_END` and DM `PIETY_CHANGE` co-validate without false failures

All prior suites still green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), dm-mode-bond-shift (59), prelude-markers (140), prelude-arc (15), prelude-canon-threads (21), prelude-prompt (180), prelude-theme-commitment (59), prelude-violation-detection (91). Server boot smoke clean. Client production build clean.

**SC-6.3 acceptance criteria met (per spec §3.9):**
- All 19 Prelude markers have schemas (parked from handler dispatch with documented rationale per SC-6.3 DECISION_LOG entry)
- `preludeMarkerDetection.js` ad-hoc functions removed for migrated markers — applies vacuously (zero markers migrated to handlers per the parking decision)
- Existing Prelude tests pass (501 assertions across 6 prelude test suites)
- DECISION_LOG entry documents the parking rationale (ordering invariants + aggregated returns + cross-marker shared state)

**Pattern D survey delivered alongside.** [triage/pattern-d-survey.md](triage/pattern-d-survey.md) — 11 time-bounded state surfaces inventoried, four shapes identified (decay-on-read, threshold-with-effect, stage-advance-on-elapsed, round-bounded session-only), 7 open questions surfaced for PM's §3.3 drafting. Recommended scope: `daysSince` helper + `registerDecayConsumer` + `registerThresholdConsumer`. Out: combat-round client state, world-event stage-advance (uses real-time clock — flagged as separate fix), companion-activity completion. Survey is read-only; no code changes.

**Marker pipeline progression:** Two markers fully owned by handlers (`[PIETY_CHANGE]` SC-4, `[BOND_SHIFT]` SC-5); 19 markers schema-validated but parked from handler dispatch (SC-6.3); ~26 detect-functions still in `dmSessionService.js` awaiting SC-6.4 survey. The SC-6.3 parking decision establishes that "schemas without handlers" is a legitimate end-state — useful precedent for SC-6.4's similarly-entangled detect-functions.

---

## [1.0.0.148] - 2026-05-04 — Phase 3 SC-5: DM Mode bond-shifts migration (service extraction + dual-scalar with shared audit + JSON-blob storage + marker pipeline owns [BOND_SHIFT])

Fifth and last consumer port for the standingScalar abstraction. Per spec §2.7 — the most complex migration in Phase 3: dual-scalar (warmth + trust) per directional pair, JSON-blob storage inside `dm_mode_parties.party_data`, three application paths converging on a shared service, and the marker pipeline taking ownership of `[BOND_SHIFT]` dispatch (second migrated marker after `[PIETY_CHANGE]`).

**`server/services/dmModeBondShiftService.js`** (new file, ~210 lines):
- New exports `DM_MODE_BOND_WARMTH_CONFIG` and `DM_MODE_BOND_TRUST_CONFIG` — both range -5..+5, default 0, no label bands (raw signed integer in prompts), `AUDIT_STRATEGIES.NONE`. Distinct names so the abstraction's threshold registry treats them as fully independent. Repository callbacks walk into `dm_mode_parties.party_data` JSON blob: `readScore` parses → finds `characters[fromCharName].party_relationships[toCharName]` → returns warmth/trust; `writeScore` does the same walk + mutate + stringify + write back. ContextKey shape: `{partyId, fromCharName, toCharName}` (directional — A→B independent of B→A).
- New export `mutateRelationshipScalars(rel, warmthDelta, trustDelta, reason, sessionLabel)` — the deterministic core. Clamps warmth and trust via the abstraction's exported `clampToRange(value, config.range)` (single source of truth for [-5, +5] bounds), pushes ONE shared history entry combining both deltas (FIFO max 10). Skips history push when both deltas are zero.
- New exports `applyBondShift(partyId, fromCharName, toCharName, warmthDelta, trustDelta, reason, sessionLabel)` (single-shift) and `applyBondShifts(partyId, shifts, sessionLabel)` (batched). Both load party_data once, mutate via `mutateRelationshipScalars`, write back once. Single-shift is used by the marker handler + manual relationship route.
- Module-load `registerMarkerHandler('BOND_SHIFT', ...)` — pipeline owns dispatch. Handler unpacks `parsed.From / To / Warmth / Trust / Reason` + `context.partyId / sessionLabel` and calls `applyBondShift`. Per-shift dispatch (N reads + N writes per turn) accepted as the right cadence — BOND_SHIFTs are rare per turn ("most messages have none").

**`server/services/markerSchemas.js`:** new entry `BOND_SHIFT` — position `'last'`, fields `From` (string, required), `To` (string, required), `Warmth` (signed int, optional, bounded [-5, +5]), `Trust` (signed int, optional, bounded [-5, +5]), `Reason` (string, optional). Replaces `dmModeService.detectBondShifts`'s no-op-skip-on-zero-deltas behavior with schema validation + correction-loop feedback for malformed markers.

**`server/routes/dmMode.js`:**
- Removed `detectBondShifts` from the `dmModeService` named imports + the inline 35-line application block at lines 295-329 — pipeline now owns dispatch via `processResponseMarkers(narrative, {partyId, sessionLabel})`. Module-load handler registration fires transitively via the new `import { applyBondShift } from '../services/dmModeBondShiftService.js'`.
- The OOC gate (skip BOND_SHIFTs for OOC turns) is preserved at the route level — `processResponseMarkers` only runs when `!isOOC`.
- Refreshed-characters reload after dispatch to reflect handler mutations back to the client (the handler mutates `party_data` directly via the JSON-blob repository).
- Manual relationship adjust route (`PUT /api/dm-mode/party/:partyId/relationship`) rewritten to delegate to `applyBondShift`. Per-route delta clamp to [-2, +2] preserved at the call site (manual adjustments tighter than AI markers — per-path policy, not abstraction territory).

**`server/services/dmModeChronicleService.js`:** the session-end `extractRelationshipEvolution` shift loop (lines 347-380) rewritten to call `mutateRelationshipScalars(rel, warmthDelta, trustDelta, reason, sessionNumber)` for the warmth/trust+history mutations. The `attitude` / `tension` field updates and the preserve-original-shape JSON persist (lines 397-407) stay chronicle-side — they're not part of the bond-shift abstraction. Per-path delta clamp to [-2, +2] preserved (Sonnet's session-end synthesis can be chatty about deltas). Attitude-only history entry preserved as a special case (zero deltas + `new_attitude` → push `attitude→X` entry inline after `mutateRelationshipScalars`).

**Tests** — 59 new assertions, all passing:

- `tests/dm-mode-bond-shift.test.js` (59 assertions): both configs' shape sanity (range, defaults, NONE audit, distinct names), formatForPrompt fragment shapes (sign-aware including `+0`), `mutateRelationshipScalars` clamps at upper bound (5+3 → 5), lower bound (-3 + -5 → -5), warmth-only shifts (history entry omits trust), trust-only shifts, no-op (both deltas 0 → no history push), missing-field defaults (rel without warmth/trust treated as 0), FIFO max 10 (12 events → trims to oldest 2 dropped), directional pair semantics (A→B mutation doesn't touch B→A's separate sub-object), BOND_SHIFT marker schema field shape (From/To required, Warmth/Trust optional bounded [-5, +5]), module-load BOND_SHIFT handler registration verified.

All prior suites still green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), piety-config (31), npc-disposition-trust (48), faction-quests (112). Server boot smoke clean (4-second hold). Client production build clean.

**SC-5 acceptance criteria met (per spec §2.7):**
- Service extracted (`dmModeBondShiftService.js`) — three application paths converge on `mutateRelationshipScalars` + `applyBondShift`
- Two configs (`DM_MODE_BOND_WARMTH_CONFIG` + `DM_MODE_BOND_TRUST_CONFIG`) created with the dual-scalar shape per spec §2.7 step 2
- Directional contextKey (`{partyId, fromCharName, toCharName}`) supported via opaque pass-through (no abstraction-level changes needed; the consumer's repository encodes the JSON-blob walk)
- Per-turn application path migrated (route handler now uses pipeline dispatch)
- Session-end synthesis path migrated (chronicle extractor now uses `mutateRelationshipScalars`)
- Manual relationship route migrated (now uses `applyBondShift`)
- Prompt injection at `dmModePromptBuilder.js:321-338` unchanged — output format preserved (warmth/trust raw integers, history entries via shared `rel.history` array). The line composer reads from `party_data` JSON which the new wrappers write identically.
- `[BOND_SHIFT]` handler registered and verified (`_hasHandler('BOND_SHIFT')`)

**Schema migration to dedicated `party_relationships` table is OUT of scope** per Phase 3 Call 3 — that's Phase 6 work. The repository callbacks here encode the JSON-blob walk; Phase 6 will swap them for SQL on a dedicated table without the abstraction or the application call sites needing to change.

**Phase 3 standing-scalar migrations are now complete.** All five consumer systems (companion loyalty SC-2, faction standing SC-3, piety + NPC disposition/trust SC-4, DM Mode bond-shifts SC-5) migrated. Two markers (`[PIETY_CHANGE]`, `[BOND_SHIFT]`) fully owned by the pipeline. The detect-function survey (SC-6.4) is the natural next step — with two markers migrated through the pipeline as proof points, the survey can scope additional candidates among the remaining ~26 detect-functions.

---

## [1.0.0.147] - 2026-05-04 — Phase 3 SC-4: piety + NPC disposition/trust migration (dual-scalar + composite contextKey + marker pipeline owns [PIETY_CHANGE])

Third and fourth consumer ports for the standingScalar abstraction in a single sub-checkpoint. Per spec §2.6 — piety adds composite contextKey (per-deity scoping) + `SEPARATE_TABLE` audit + threshold-handler dispatch + prompt-injection gap fix; NPC disposition/trust adds the dual-scalar pattern (two configs against one row). The marker pipeline (§3.2) takes ownership of `[PIETY_CHANGE]` dispatch — the first detect-function call site removed from `routes/dmSession.js` in favor of the schema-driven pipeline.

**`server/services/pietyService.js`:**
- New export `MYTHIC_PIETY_CONFIG` — composite contextKey `{characterId, deityName}`, range `{min: 0, max: Infinity}`, default 1, no label bands (piety uses thresholds), `SEPARATE_TABLE` audit pointing to `piety_history`. Repository callbacks own the SQL — `readScore` / `writeScore` use `COLLATE NOCASE` for case-insensitive deity matching; `appendAuditEntry` INSERTs into `piety_history` with the legacy column shape (`change_amount`, `new_score`, `game_day`, `session_id`); `readAuditTrail` SELECTs back and maps to the abstraction's standard entry shape.
- `adjustPiety(characterId, deityName, amount, reason, gameDay, sessionId)` rewritten to delegate the math + clamp + audit + threshold-dispatch to `adjustStanding(MYTHIC_PIETY_CONFIG, ...)`. Pre-create-row pattern (`initializePiety`) preserved consumer-side. Return shape (`{oldScore, newScore, change, reason, thresholdCrossed, thresholdAbility}`) preserved for back-compat — `thresholdCrossed` derived from the abstraction's `thresholdsCrossed` array (highest cross-up).
- Module-load `registerThresholdHandler(MYTHIC_PIETY_CONFIG, threshold, handler, 'up')` calls for each of `[3, 10, 25, 50]` — replaces the legacy `checkNewThreshold` cascade. Each handler runs the same `UPDATE character_piety SET highest_threshold_unlocked = ? ... AND highest_threshold_unlocked < ?` (highest-only invariant preserved). Cross-down does NOT lock; matches legacy `if (newScore > oldScore)` gate.
- Module-load `registerMarkerHandler('PIETY_CHANGE', ...)` — pipeline now owns dispatch. Handler reads `characterId` + `sessionId` from the pipeline context; pulls `gameDay` from the characters table best-effort; calls `adjustPiety(...)`.
- New export `formatPietyForPrompt(pietyRows)` — sync helper for prompt builders. Renders one line per deity: `- {Deity}: N piety (unlocked X, next at Y | max tier reached)`. Returns empty string for empty array so callers can string-concatenate safely.
- `checkNewThreshold` kept as back-compat export (also functional — runs the same UPDATE). Now redundant with the abstraction's threshold dispatch.

**`server/services/npcRelationshipService.js`:**
- New exports `NPC_DISPOSITION_CONFIG` and `NPC_TRUST_CONFIG` — the dual-scalar pair targeting the same `npc_relationships` row via contextKey `{characterId, npcId}`. Disposition: range -100..+100, default 0, 7 label bands (devoted/allied/friendly/neutral/unfriendly/hostile/nemesis), `INLINE_JSON` audit on `witnessed_deeds` with mapping to/from the legacy `{deed, impact, date}` shape. Trust: range -100..+100, default 0, no label bands (trust uses raw integer in prompts via the existing `getTrustLabel` in dmPromptBuilder), `NONE` audit (legacy adjustTrust recorded no audit; preserved exactly).
- `adjustDisposition(characterId, npcId, change, reason)` and `adjustTrust(characterId, npcId, change)` rewritten to delegate to `adjustStanding(NPC_DISPOSITION_CONFIG, ...)` and `adjustStanding(NPC_TRUST_CONFIG, ...)` respectively. Pre-create-row pattern (`getOrCreateRelationship`) preserved consumer-side.
- `updateRelationship` now uses `mapToLabel(data.disposition, NPC_DISPOSITION_CONFIG.labelBands)` instead of the legacy `getDispositionLabel` helper.
- `createRelationship` now uses `mapToLabel(disposition, NPC_DISPOSITION_CONFIG.labelBands)` for the initial label.
- Legacy `getDispositionLabel` deleted (verified no external consumers via grep before deletion; same name in `server/config/eventTypes.js` is a different function — different signature).

**`server/services/markerSchemas.js`:** new entry `PIETY_CHANGE` — position `'inline'`, fields `Deity` (string, required), `Amount` (signed int, required), `Reason` (string, optional). Replaces `dmSessionService.detectPietyChange`'s silent-drop behavior with schema validation + correction-loop feedback for malformed markers.

**`server/routes/dmSession.js`:**
- Removed direct `import { adjustPiety }` and the dispatch block at lines 1999-2011 — pipeline now owns dispatch via the registered handler in `pietyService.js`. The `mythicEvents` array no longer carries per-turn piety entries; verified zero client consumers via grep.
- New `import { getAllCharacterPiety, formatPietyForPrompt } from '../services/pietyService.js'` — also fires the module-level handler registrations transitively.
- New parallel-load slot `pietyRowsResult` via `getAllCharacterPiety(characterId)` in the parallel context assembly (alongside `mythicStatusResult`).
- New `pietyContext` builder — wraps `formatPietyForPrompt` output with the `=== PIETY ===` section header + a one-line directive about acknowledging unlocked abilities. Empty when no piety rows exist.
- `pietyContext` threaded into the `sessionContext` object passed to the prompt builder.
- Removed `detectPietyChange` from the dmSessionService named imports.

**`server/services/dmPromptBuilder.js`:** the mega-string interpolation now includes `${sessionContext.pietyContext ? '\n\n' + sessionContext.pietyContext : ''}` immediately after `mythicContext` — surfaces piety to the AI for the first time (per spec §2.6.3 gap fix).

**Tests** — 79 new assertions across two new suites, all passing:

- `tests/piety-config.test.js` (31 assertions): config shape sanity (composite contextKey, separate-table audit, 4-threshold dispatch, infinity max-range), `formatForPrompt` fragment shape (positive / negative / no-recent / missing-reason cases), `formatPietyForPrompt` per-deity scoping (single deity, multiple deities, defaults, empty array), module-load registration verified (`_getThresholdHandlerCount() >= 4` and `_hasHandler('PIETY_CHANGE')`)
- `tests/npc-disposition-trust.test.js` (48 assertions): full integer-range parity for disposition labels (201 values, 0 mismatches against the inlined legacy `getDispositionLabel`), 15 band-edge spot checks, both configs' shape sanity, `formatForPrompt` fragments for both, dual-scalar isolation (distinct names, distinct audit strategies, NONE-strategy trust has no audit callbacks)

All prior suites still green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-standing-prompt-snapshot (38), faction-quests (112). Server boot smoke clean (4-second hold). Client production build clean.

**SC-4 acceptance criteria met (per spec §2.6):**
- All piety tests pass; new test for piety prompt injection (`formatPietyForPrompt` coverage)
- All NPC disposition tests pass; full-range disposition_label parity proves no NPC prompt-output regression (the line composer in dmPromptBuilder reads the denormalized column unchanged)
- Threshold cascade for piety fires correctly: 4 handlers registered, exercised by the abstraction's own threshold tests in `tests/standing-scalar.test.js` (handler dispatch + handler-error containment paths)
- Dual-scalar shape validates: two configs with distinct names, distinct audit strategies, both targeting the same row via shared contextKey
- Per-deity scoping for piety works: `formatPietyForPrompt` renders one line per deity (verified in test)
- `[PIETY_CHANGE]` handler registered and verified (`_hasHandler('PIETY_CHANGE')`)

**Marker pipeline transition:** `[PIETY_CHANGE]` is the first marker whose detect-function call site has been removed from `routes/dmSession.js`. The legacy `detectPietyChange` export in `dmSessionService.js` stays for back-compat per the "deprecate by hiding nav, not deleting code" policy. SC-5 will follow the same pattern for `[BOND_SHIFT]`.

**Lossy migration footnote:** `mythicEvents` array no longer pushes per-turn piety entries (the legacy code returned `{type: 'piety', deity, oldScore, newScore, ...}` to the client). Verified zero client consumers of `mythicEvents` via grep before the silent drop. Piety state still lives in `character_piety` / `piety_history`; UI surfaces continue to read from there.

---

## [1.0.0.146] - 2026-05-04 — Phase 3 SC-3: faction standing migration (split_by_sign audit + prompt byte-identity guarantee)

Second consumer port for the standingScalar abstraction. Per spec §5.3 — faction standing migrates with `AUDIT_STRATEGIES.SPLIT_BY_SIGN` (PM Q1 ruling 2026-05-04), preserving the dual-array `deeds_for / deeds_against` shape and producing byte-identical DM prompt output.

**`server/services/factionService.js`:**
- New export `FACTION_STANDING_CONFIG` — per-consumer-static configuration. Range -100..+100, default 0, the existing 9 label bands (exalted/revered/honored/friendly/neutral/unfriendly/hostile/hated/enemy), `split_by_sign` audit storage routing positive `change` to `deeds_for` and negative to `deeds_against`. Repository callbacks own the SQL — `writeScore` updates BOTH `standing` AND the denormalized `standing_label` column in a single UPDATE (label computed via `mapToLabel(newScore, FACTION_STANDING_CONFIG.labelBands)`); `appendAuditEntry` enacts split_by_sign consumer-side; `readAuditTrail` merges + sorts both deed arrays into the abstraction's standard entry shape.
- `modifyStanding(characterId, factionId, amount, deed)` rewritten to delegate the math + clamp + audit to `adjustStanding(FACTION_STANDING_CONFIG, ...)`. Pre-create-row pattern (`getOrCreateStanding`) preserved consumer-side. New private `normalizeDeedReason()` collapses the legacy polymorphic `deed` parameter (`{ description, ... }` object | bare string | null) into the abstraction's string `reason` slot — lossy migration; `deed.quest_id` and other ancillary fields are dropped (verified zero consumers via grep before deletion; columns are debug-only today).
- New export `formatFactionStandingFragment(standingScore)` — sync helper for prompt builders that already have standing data loaded. Returns `"LABEL (+N)"` from `FACTION_STANDING_CONFIG.formatForPrompt`, or empty string when score is null. Same pattern as SC-2's `formatLoyaltyForPrompt`.
- `updateStanding` now uses `mapToLabel(updates.standing, FACTION_STANDING_CONFIG.labelBands)` instead of the legacy `getStandingLabel` helper — single source of truth for label bands.
- Legacy `getStandingLabel` deleted (verified no external consumers via grep before deletion).

**`server/services/dmPromptBuilder.js::formatWorldStateSnapshot`:** the faction standings block now composes lines as `- ${faction_name}: ${formatFactionStandingFragment(s.standing)}${memberNote} - ${behavior}`. Output is byte-identical to the legacy hand-rolled string. `getStandingBehavior` stays in `dmPromptBuilder` (consumer-specific NPC behavior hint, not part of the abstraction's `formatForPrompt`).

**Tests** — `tests/faction-standing-prompt-snapshot.test.js`, 38 assertions all passing:
- Full integer range walk: `mapToLabel` produces identical labels to the inlined legacy `getStandingLabel` for every score in [-100, 100] (201 values, 0 mismatches)
- 16 representative `formatFactionStandingFragment` outputs covering band edges (80→exalted, 79→revered, 0→neutral, -1→unfriendly, -60→hated, -61→enemy) plus extremes (+100, -100) and the sign-formatting edge case (0 has no sign prefix)
- Empty-fragment cases (null/undefined score)
- 8 full-line scenarios across band edges + member states confirm byte-identity between the legacy composer and the new composer (SC-3 acceptance criteria gate)
- Config shape sanity (range, defaults, 9 bands, audit strategy, callable repository methods)

All prior test suites still green: standing-scalar (71), marker-pipeline (44), companion-loyalty-prompt (33), faction-quests (112). Server boot smoke confirmed clean module load (no circular import — factionService imports from standingScalar; dmPromptBuilder imports from both factionService and companionBackstoryService). Client production build clean.

**SC-3 acceptance criteria met (per spec §5.3):**
- Output byte-identical: snapshot test walks all 201 integer standings + 8 full-line scenarios
- Audit trail preserved: `deeds_for` / `deeds_against` columns still receive entries on positive / negative changes respectively
- Range clamping unchanged: -100..+100 enforced via `range` config
- Faction membership flag (`is_member`), rank/level fields untouched (orthogonal to standing-scalar)

**No marker handler registered.** Faction standing has no dedicated marker — state changes flow through `consequenceService` (promise breaks, quest expiry) and `questService` (quest completion), never via a `[STANDING_CHANGE]` marker. Handler registration first lands at SC-4 ([PIETY_CHANGE]).

---

## [1.0.0.145] - 2026-05-04 — Phase 3 SC-2: companion loyalty migration (first abstraction port + prompt-injection gap fix)

First real exercise of the standingScalar abstraction against an existing system. Per spec §2.4 — companion loyalty migrates with no behavior change to existing loyalty math, plus the prompt-injection gap that Code's Tranche 1 survey flagged (orientation note #2): companion loyalty is now visible to the AI in DM session prompts for the first time.

**`server/services/companionBackstoryService.js`:**
- New export `COMPANION_LOYALTY_CONFIG` — per-consumer-static configuration. Range 0–100, default 50, the existing 6 label bands (devoted/loyal/trusted/uncertain/distrustful/hostile), `inline_json` audit storage on `loyalty_events`. Repository callbacks own the SQL — `readScore / writeScore / readAuditTrail / appendAuditEntry` map between the abstraction's standard entry shape (strategy/change/newScore/reason/sessionId/gameDay/date) and the legacy `loyalty_events` shape (event/change/new_total/date) so anything reading the column directly stays back-compat.
- `adjustLoyalty(companionId, change, reason)` rewritten to delegate the math + clamp + audit to `adjustStanding(COMPANION_LOYALTY_CONFIG, ...)`. The pre-create-row pattern (`getOrCreateBackstory`) and the post-call cascade (`checkSecretReveals`) stay consumer-side per Invariant B — secret thresholds are per-secret (each carries its own `loyalty_threshold`), which doesn't fit the abstraction's per-config-static threshold list.
- New export `formatLoyaltyForPrompt(loyaltyScore, loyaltyEventsJson)` — sync helper for prompt builders that already have loyalty data loaded (the formatCompanions case). Renders the spec §2.4 fragment shape: `"Loyalty: TRUSTED (62/100). Recent: defended in tavern brawl (+5)"`. Returns empty string when score is null so callers can string-concatenate safely.
- Legacy `getLoyaltyLabel` kept as no-op redundant export per "deprecate by hiding, not deleting." Now redundant with `mapToLabel(loyalty, COMPANION_LOYALTY_CONFIG.labelBands)`.

**`server/routes/dmSession.js`:** the companion-load SELECT (line 475) extended to include `cb.loyalty as companion_loyalty, cb.loyalty_events as companion_loyalty_events` — these are what `formatLoyaltyForPrompt` reads.

**`server/services/dmPromptBuilder.js::formatCompanions`:** new line in each companion's parts array — `formatLoyaltyForPrompt(companion.companion_loyalty, companion.companion_loyalty_events)` rendered alongside mood / progression / spell-slots / conditions / death-saves. The `.filter(Boolean)` already in place handles the empty-string return for companions without backstory rows.

**Tests** — `tests/companion-loyalty-prompt.test.js`, 33 assertions all passing:
- 18 assertions verifying the 6 label bands match legacy `getLoyaltyLabel` exactly at every boundary (no behavior drift)
- Empty-fragment cases (null score, null/empty audit JSON)
- Single-event format (positive change shows `+`, negative shows `-` once not `--`)
- Most-recent-event-wins (newest event surfaces, older events suppressed)
- Malformed JSON graceful fallback
- Edge case: event missing `event` field falls back to label-only
- Standalone `COMPANION_LOYALTY_CONFIG.formatForPrompt()` callable matches spec §2.4 example output

All prior test suites still green: standing-scalar (71), marker-pipeline (44), prelude-draft (43).

**No marker handler registered.** Per the SC-2 spec note: companion loyalty has no dedicated marker (state-change paths flow through consequenceService / promise / deed-recording paths, not a `[LOYALTY_CHANGE]` marker). Confirmed during the spec read; PM acknowledged. Handler registration begins at SC-4 (`[PIETY_CHANGE]`) and SC-5 (`[BOND_SHIFT]`).

**SC-2 acceptance criteria met (per spec §2.4):**
- All existing companion-loyalty-touching tests pass (no companion-loyalty-specific tests existed pre-SC-2; new tests added in this ship)
- New tests confirm prompt injection works for companion loyalty
- Companion mood decay (separate code path, not standing-scalar) unchanged
- Secret-reveal cascade (`checkSecretReveals`) still fires correctly (preserved as the post-`adjustStanding` consumer-side cascade)
- Companion-level UI surfaces unchanged (no UI touched)

---

## [1.0.0.144] - 2026-05-04 — Phase 3 SC-1 + SC-6.1: foundation modules (standingScalar + markerPipeline)

First Phase 3 ship. Two API-foundation modules batched per PM cadence call (both reviewed at the same gate; SC-2 exercises both APIs anyway). Sub-checkpoint review before SC-2 begins.

**SC-1 — `server/services/standingScalar.js`** (per spec §2.3):
- Public API: `adjustStanding`, `getStanding`, `formatStandingForPrompt`, `registerThresholdHandler`, `clampToRange`, `mapToLabel`, `detectThresholdCrossings`, `AUDIT_STRATEGIES` enum
- Configuration shape per spec §2.2 — `range / defaultValue / labelBands / thresholds / auditTrail / formatForPrompt / repository`
- **`repository` callbacks own storage** — abstraction never builds SQL. Consumer supplies `readScore / writeScore / readAuditTrail / appendAuditEntry`. Lets DM Mode bond-shifts (JSON-blob storage) use the same API as faction standing (SQL row).
- Audit-trail strategies: `'inline_json'`, `'separate_table'`, `'split_by_sign'` (per spec Q1, faction standing's case), `'none'`
- Threshold dispatch: handlers registered at module-load (per spec Q3); fires on cross-up / cross-down / both. Errors contained (logged, don't block adjust).
- 71 unit-test assertions in `tests/standing-scalar.test.js` covering range clamping, label mapping (boundaries + below-floor), threshold detection (all directions + multi-cross), audit recording (all strategies), error containment, validation.

**SC-6.1 — `server/services/markerPipeline.js`** (per spec §3.7):
- Public API: `registerHandler`, `processResponseMarkers`, `buildPendingCorrectionsNote`
- Composes existing `markerSchemas.js::validateDmMarkers` + `ruleVerifiers.js::buildRuleCorrectionMessage` — no reimplementation
- Handler errors contained (logged, recorded as `{ ok: false, error }` in `handlerResults`, don't block other markers)
- Wired into `routes/dmSession.js` as a parallel call alongside existing detect-functions (lines 1330ish, after the existing validation block). With no handlers registered yet at this ship, behavior is unchanged.
- 44 unit-test assertions in `tests/marker-pipeline.test.js` covering registration validation, dispatch (single/multi instance/multi schema), error containment, validation-failure separation (malformed markers go in `failures`, not `handlerResults`), correction-note composition (marker-only / rule-only / combined / empty).

**Wiring change in `routes/dmSession.js`:** new `processResponseMarkers(narrative, { characterId, sessionId })` call after the existing validation block. Try/catch wrapped — any pipeline bug is logged but doesn't block existing flow. `validateDmMarkers` runs twice per turn at this point (once via the existing block, once inside `processResponseMarkers`); SC-6.4 will collapse this.

**No behavior change for end users.** Both modules are foundations; migrations begin in SC-2.

**DECISION_LOG entry** documents the design tradeoffs: storage-via-repository (vs. declarative SQL), threshold-dispatch as future-facing API, parallel-not-replacement pipeline strategy, handler error containment.

**Open from spec §6:**
- Q1 (faction standing `'split_by_sign'`) — pre-answered in `AUDIT_STRATEGIES`; PM call procedural before SC-3
- Q6 (detect-function deferral criteria) — PM authors survey doc before SC-6.4 implementation

---

## [1.0.0.143] - 2026-05-04 — Phase 2 close-out: Prelude wizard cutover (PreludeCreatorV2 is the live path; legacy retired-but-hidden)

End-to-end smoke confirmed by user 2026-05-04 — full create → exit-mid-wizard → resume-from-card → submit cycle works clean; appearance fields reach Opus during gameplay and the opening narration honors them faithfully. Cutover unblocked.

**Changes:**

- **`HomeFlow.jsx`** — `?prelude_v2=1` URL gate removed. Prelude entry route now renders `PreludeCreatorV2` unconditionally (resume + fresh paths converge). `PreludeSetupWizard` import dropped. Vite tree-shakes the legacy file out of the bundle.
- **`PreludeCreatorV2.jsx`** — appbar crumbs simplified from `Prelude · setup (v2 preview)` to `Prelude · setup`. Resume crumbs unchanged (`Prelude · resuming setup`).
- **`PreludeSetupWizard.jsx`** — file retained per CLAUDE.md "deprecate by hiding nav, not deleting code." Header comment marks it DEPRECATED with a note that the only remaining importer is the deprecated `CharacterManager.jsx` (itself unwired except for the legacy "Edit in Wizard" affordance from CharacterSheet). Safe to delete once 2-3 playtest cycles confirm no need to revert.
- **`CLAUDE.md`** — Prelude system snapshot updated: 6-step wizard is the live path; describes the new `'prelude_setup'` save/resume model + the four appearance fields. Frontend file-list updated.

**The Prelude flow as of v1.0.143** (player-facing):

Home → Path Choice → Prelude → Step 1 (Identity) → Step 2 (Ancestry) → Step 3 (Origin) → Step 4 (Family) → Step 5 (Appearance + free-text) → Step 6 (Review) → Submit → Arc Preview (testing toggle on) or first session (off). Save-on-step-advance throughout; exit mid-wizard surfaces a "Prelude · Continue setup" card on the home page; click resumes with all fields preserved.

**Phase 2 close-out is now complete.** Remaining parking-lot items (heirloom handoff producer, deity worship-contract content, CharacterCreatorV2 edit-existing surface, deletion of deprecated legacy files) all flagged as deferred per `CONSOLIDATED_TODO.md` — not blocking Phase 3.

---

## [1.0.0.142] - 2026-05-04 — Project-discipline catchup: tests for prelude draft endpoints

CLAUDE.md mandates "tests before push for any non-trivial change (new endpoints, schema changes)." v1.0.138 added three new endpoints (`POST/PUT/GET /api/prelude/setup/draft`) plus modified `createPreludeCharacter` to accept a `draft_character_id` for row recycling. v1.0.139 was a hotfix for a BigInt serialization bug that proper tests would have caught at write time. Catching up the discipline gap.

**New file: `tests/prelude-draft.test.js`** — 43 assertions, all passing. In-memory libsql; service SQL replicated inline (canon-transfer.test.js pattern). Coverage spans:
- BigInt regression — draft create returns Number id, not BigInt (the literal v1.0.139 bug, locked in)
- Draft create / update / read shape (phase enforcement, name composition, state JSON round-trip)
- Finalize WITH `draft_character_id` (row recycling, phase flip prelude_setup → prelude, refuse non-draft rows)
- Finalize WITHOUT `draft_character_id` (legacy back-compat)
- Appearance persistence — `payload.appearance.{eye/hair/skin/build}` lands on `eye_color/hair_color/skin_color/physical_build` columns
- End-to-end save → resume → submit cycle preserves character id

**Run command:** `node tests/prelude-draft.test.js`. Pass/fail in stdout. TEST_RESULTS.md updated with the run record.

**Side ship**: memory entry added — `project_opus_default_for_gameplay.md` — captures the v1.0.141 PM ruling (Opus default for live gameplay) so future model-selection calls in unrelated conversations have the rule on hand. Doesn't affect any code path; durable project context.

Cutover work (originally v1.0.142) shifts to v1.0.143; smoke gate carries forward.

---

## [1.0.0.141] - 2026-05-03 — Prelude gameplay flips to Opus default

PM ruling 2026-05-03: prelude gameplay generalizes the v1.0.99 main DM session decision (Opus default for live gameplay). User has Claude Max so cost is bounded; prose quality and narrative continuity outweigh latency for interactive turns. Auto-picker logic retained as soft-deprecated dead code per "deprecate by hiding, not deleting."

**Server (`server/services/preludeSessionService.js`):**
- `resolveModel`: default mode flipped from `'auto'` → `'opus'`. The `'auto'` branch still works when stored session state has `model_preference='auto'` (legacy sessions) or when an explicit override comes in via the request body. New sessions go straight to Opus.
- `pickAutoModel`: marked SOFT-DEPRECATED with header comment. No callers from the new default path; retained for legacy session compatibility. Drop together with the `'auto'` branch when the auto pattern is confirmed retired.

**Client (`client/src/components/PreludeSession.jsx`):**
- Auto / Sonnet toggle in the session header HIDDEN. The toggle's "off" state used to mean "Sonnet always" but with Opus as the new default, an unchecked box would visually suggest Sonnet while the user is actually in Opus — confusing. State preserved (`model`, `resolvedModel`, `resolveReason`) for back-compat with stored sessions; UI affordance gone.
- `useState('auto')` → `useState('opus')` so the local default matches the server before the first session-load roundtrip completes. Same for `resolvedModel`.

**Chronicle extraction stays on Sonnet** (Code's read; PM deferred). Both `storyChronicleService.js::extractChronicle` and `dmModeChronicleService.js::extractChronicle / extractRelationshipEvolution` continue to call Sonnet. Reasoning: chronicle extraction is structured-output work (read transcript → emit JSON), not prose narration. The prose-quality argument that justified the live-gameplay flip doesn't directly apply. Latency at session-end is user-facing — Opus would add 15–30s the player feels. If playtests show extraction missing nuance, it's a one-line per-call-site flip later. Conservative read: only flip what we have evidence to flip.

**CLAUDE.md updated:** "AI model discipline" section reflects the new split. Sonnet's role narrowed; the prelude auto-picker called out as soft-deprecated.

**v1.0.140 (Sonnet session prompt appearance fix) stands unchanged.** The `formatAppearanceBlock` runs against `createPreludeSystemPrompt` which feeds whichever model the resolver chose — now Opus by default — so the appearance block reaches Opus instead of Sonnet, but the wiring is the same.

DM Mode (user-as-DM) sessions are intentionally NOT included in this flip — DM Mode's pacing and economics differ from prelude/main-DM, and there's been no quality complaint there. Surface separately if PM wants to generalize further.

Cutover work (originally slated for v1.0.140 → shifted to v1.0.141 last turn → now shifts to v1.0.142). Smoke gate carries forward; with Opus on prelude gameplay, the smoke now also confirms Sonnet/Opus prompt-builder reads appearance correctly through the new resolver path.

---

## [1.0.0.140] - 2026-05-03 — Sonnet session prompt now reads player-set appearance fields

User caught it during smoke: the v1.0.138 arc-prompt update wired appearance into Opus's arc-plan generator, but `preludeArcPromptBuilder.js` (the Sonnet system prompt for live prelude gameplay sessions) was unchanged. Sonnet was narrating the character with no knowledge of the four appearance fields the player set — it would invent eye/hair/skin/build every time the PC was described, and the player's Step 5 picks would silently never matter in actual gameplay.

**Fix:** appended an `Appearance` block to the CHARACTER context in `createPreludeSystemPrompt` (line 1064). New helper `formatAppearanceBlock(character)` reads `eye_color / hair_color / skin_color / physical_build` off the character row and emits the same "honor when describing the character, do NOT invent additional physical markers" framing the arc-prompt update used. Returns empty string when the player skipped Step 5 (no fields set), so the prompt stays clean for those characters.

The opening prompt at line 1187 already instructs Sonnet to "describe your own body — size, hair, skin, eyes, canonical race features, don't invent markers" — that instruction now has the actual values to use, sourced from the system prompt's CHARACTER block.

Cutover work originally slated for v1.0.140 shifts to v1.0.141; smoke gate carries forward.

---

## [1.0.0.139] - 2026-05-03 — v1.0.138 hotfix: BigInt serialization in draft endpoint responses

Smoke caught: `POST /api/prelude/setup/draft` returned 500 — `TypeError: Do not know how to serialize a BigInt`. The `result.lastInsertRowid` from libsql is a BigInt, and `res.json({ id: bigint })` can't serialize it. Same pattern affected `updateDraftPreludeCharacter` (its `characterId` came from `req.params` as a string, but the response object built it back without coercing).

**Fix:** `Number(id)` coercion before returning from `createDraftPreludeCharacter` and `updateDraftPreludeCharacter`. Safe — SQLite rowids are < 2^53.

Cutover work originally slated for v1.0.139 shifts to v1.0.140; smoke gate carries forward unchanged.

Also of note (cleanup, not a fix): an orphan node process from yesterday's debugging was holding port 3000, so the user's `npm run dev` wasn't binding and they were hitting yesterday's server (no draft endpoints). Killed the orphan + restarted dev cleanly. The 404s the user saw were from the stale server, not from a real routing issue. The 500 was real and is what this hotfix addresses.

---

## [1.0.0.138] - 2026-05-03 — Phase 2 close-out: Prelude wizard plumbing — save/resume, appearance persistence, 4th card state, arc-prompt APPEARANCE

The cutover slice's plumbing layer. All four pieces ship together since they're interdependent. Still gated behind `?prelude_v2=1`; cutover flip lands as v1.0.139 after end-to-end smoke validation.

**1. Server-side `prelude_setup` recognition + draft endpoints** (`server/services/preludeService.js`, `server/routes/prelude.js`):
- New `creation_phase` value `'prelude_setup'` for in-flight wizard rows. Final enum: `'active' | 'creating' | 'ready_for_primary' | 'prelude' | 'prelude_setup'`.
- New service helpers: `createDraftPreludeCharacter(state)`, `updateDraftPreludeCharacter(id, state)`, `getDraftPreludeState(id)`.
- New endpoints: `POST /api/prelude/setup/draft` (Step 1 advance creates a draft row), `PUT /api/prelude/setup/draft/:id` (subsequent advances update), `GET /api/prelude/setup/draft/:id` (resume reads stored state).
- Draft rows use placeholder values for required NOT-NULL columns (`class='prelude_setup'`, `level=0`, `current_hp=0`, `current_location='(setting up)'` etc.) — same pattern as the v1.0.116 `'creating'` phase placeholders.
- `createPreludeCharacter` modified: when payload includes `draft_character_id`, RECYCLES that row (UPDATE, flips phase `prelude_setup → prelude`) instead of creating a new one. Keeps the same character id through the save→submit transition so anything bookmarking the draft id stays valid.

**2. Server-side appearance field persistence** (same files):
- At finalize, `eye_color` / `hair_color` / `skin_color` / `physical_build` from `payload.appearance` get written to the character row's columns directly (existing schema columns; `physical_build` added in migration 050).
- Stable child→adult traits per the v1.0.137 cut (no height/weight).

**3. Save/resume client wiring** (`client/src/components/creator/preludePersistence.js` — new file, `PreludeCreatorV2.jsx`):
- `savePreludeProgress({ state, characterId })` — POST/PUT helper mirroring `creatorPersistence.js`'s shape for the primary creator.
- `submitPrelude({ state, characterId })` — final submit, includes `draft_character_id` so the server recycles the row.
- `loadPreludeDraft(characterId)` — resume helper; reads stored state from the draft row.
- `PreludeCreatorV2` now accepts `initialState` and `initialCharacterId` props for resume; `next()` is async and calls `savePreludeProgress` before advancing; "Saving…" button state during in-flight saves; `saveError` surfaces inline if save fails (player's input preserved, can retry).

**4. HomeScreenV2 fourth in-progress card state** (`HomeScreenV2.jsx`):
- New badge: `Prelude · Continue setup` for `prelude_setup` rows.
- Footer: `Prelude setup in progress`.
- Shares the desaturated in-progress treatment with the existing three states.

**HomeFlow `prelude_setup` card click routing** (`HomeFlow.jsx`):
- `handleOpenCharacter` branches on `state === 'prelude_setup'`, fetches the draft state via `/api/prelude/setup/draft/:id`, populates `preludeDraftState` + `preludeDraftCharacterId`, routes to the `prelude.setup` route.
- The render branch uses these to construct `<PreludeCreatorV2 initialState initialCharacterId>` instead of a fresh wizard.
- `handlePickPrelude` (fresh start) clears the draft state so a new wizard isn't accidentally seeded with a prior resume.

**5. Arc-prompt updates** (`server/services/preludeArcService.js`):
- `buildArcUserPrompt` appends an `APPEARANCE` block listing only the four kept fields (Eyes / Hair / Skin / Build) when set on the character row. Block reads: *"player-set — canonical; honor when describing the character, do NOT invent additional physical markers"*.
- `buildArcSystemPrompt` line 141 (CARDINAL RULE 9) refined per PM rev 2 framing: appearance fields are now part of the "canon" list; rule still bans inventing ADDITIONAL physical markers beyond what was set.

**End-to-end smoke gate before cutover (v1.0.139):** create prelude character via `?prelude_v2=1` → exit mid-wizard → verify "Continue setup" card surfaces on home → click resume → complete remaining steps → submit → confirm arc generation includes the APPEARANCE block. Cutover flip + legacy `PreludeSetupWizard.jsx` retirement queue once smoke passes.

---

## [1.0.0.137] - 2026-05-03 — Sub-checkpoint #6 fix: drop height + weight from Step 5 (Prelude character is a child)

User-reported issue from v1.0.136 review: the prelude character is a CHILD across most of the arc (race-derived starting age: humans 6, elves 30, dwarves 18, etc.), so adult-range height/weight values would confuse the Sonnet narrator — picture "the small child carefully tries to lift the practice sword" running alongside a character sheet that says 6'0" / 225lb.

**Fix:** Step 5's Appearance section drops Height + Weight cells. Keeps Eyes / Hair / Skin / Build — those four read truthfully at any age. Grid restructures from 3-col×2-row (6 cells) to 2-col×2-row (4 cells). The original spec rev 2 said "wholesale port from primary creator's Step 7" but that was a foreseeable design tension; review surfaced the consequence and we corrected.

**Changes:**
- `PreludeStep5Appearance.jsx`: removed Height + Weight `RaceAwareDimensionPicker` cells; removed the now-unused `RaceAwareDimensionPicker` import; updated grid to `1fr 1fr`; tightened the help-text wording (no longer mentions adult-range caveat); doc-comment header rewrites the rationale.
- `PreludeCreatorV2.jsx::buildInitialState`: dropped `height: ''` and `weight: ''` from `appearance` object. State shape is now four fields, not six.
- `PreludeStep6Review.jsx`: dropped Height + Weight conditional renders from the Appearance preview section; `hasAnyAppearance()` helper now only checks the four kept fields.

The arc-prompt APPEARANCE section work that lands at cutover should also reference only the four fields. Memory entry's "TWO server-side changes" item still applies — but the field list narrows.

---

## [1.0.0.136] - 2026-05-03 — Phase 2 close-out: Prelude wizard Step 6 (Review) — feature-complete (sub-checkpoint #6)

Sub-checkpoint #5 signed off (v1.0.133-135). Step 6 — the final step — ships next, completing the 6-step structural redesign.

**New component: `client/src/components/creator/PreludeStep6Review.jsx`** — three-part review screen:

1. **Character preview card** — large serif name + nickname header; gender · race · subrace eyebrow; sectioned by Origin / Family & Influence / Appearance / Anything else. Sections that have no filled content are omitted (Appearance + free-text are optional).
2. **Edit any step** section list — five rows (one per Step 1–5), each with step number + label + brief detail + an "Edit →" affordance that jumps directly to that step via the Stepper.
3. **Testing toggle + Submit** — the legacy wizard's `show_arc_preview` checkbox preserved (controls whether arc preview shows or the player dives straight into first scene). Submit button is the primary CTA, lives inside Step 6 (mirrors primary creator's Step 8 pattern).

**Defensive end-to-end validation** in `validateForSubmit(state)`. Per-step gates already catch most issues, but Step 6 surfaces stragglers (player jumped backward via Stepper, cleared a required field, jumped forward to Step 6). Errors render at the top of the page with inline "Edit Step N →" links — same accent left-border treatment used elsewhere.

**Submit handler** — `submitPrelude(state)` builds the same payload shape the legacy `PreludeSetupWizard::buildPayload` produces (so `/api/prelude/setup`'s contract is unchanged). Adds appearance fields for forward-compat; server silently drops them until persistence work lands at cutover. On success, calls `onPreludeCreated(character, { showArcPreview })` — HomeFlow routes the player to either PreludeArcPreview (testing) or PreludeSession (skip).

**Shell extensions in `PreludeCreatorV2.jsx`**:
- Step 6 receives `state`, `set`, `onJump(targetStep)`, `onSubmit()`
- WizardFoot for Step 6 only carries Back + Save-and-exit (`canNext: false`, `nextLabel: ''`, `isLast: true`) — Submit lives inside the step
- Removed now-unused `PlaceholderStep` helper + `WizardHead` import
- New top-level `submitPrelude(state)` helper with the payload-build + POST logic

**Structural redesign is now feature-complete on the client side.** All 6 steps live; full submit path works. The preview build (`?prelude_v2=1`) walks Home → Path → Prelude → 6-step wizard → submit → arc preview / session. Try it end-to-end.

**Out of scope for this sub-checkpoint** (still pending; lands at cutover):
- Save/resume server-side persistence (new `creation_phase = 'prelude_setup'` enum value, partial-save endpoints)
- HomeScreenV2 fourth in-progress card state
- Server-side appearance field persistence (currently silent-drops on insert)
- Arc-prompt updates (APPEARANCE section + line-141 system-prompt rule refinement)
- Cutover from legacy `PreludeSetupWizard` to `PreludeCreatorV2` as the live path

---

## [1.0.0.135] - 2026-05-03 — Sub-checkpoint #5 follow-up: variety pass for Half-Orc / Elf / Dwarf build pools

After v1.0.134 fixed Dragonborn, surfaced the same flat-pool problem in three other races. PM call: apply the same variety pass.

**Half-Orc** — `['Muscular', 'Broad-shouldered', 'Heavy', 'Tall', 'Towering', 'Powerfully built']` → `['Lean', 'Wiry', 'Athletic', 'Stocky', 'Muscular', 'Broad-shouldered', 'Heavy', 'Tall', 'Towering', 'Powerfully built']`. Skews large (orcish heritage) but lean/athletic Half-Orcs are now legitimate — the human half of parentage carries weight too.

**Elf** — `['Slender', 'Lithe', 'Lean', 'Tall', 'Graceful']` → `['Slight', 'Slender', 'Lithe', 'Wiry', 'Lean', 'Athletic', 'Average', 'Compact', 'Tall', 'Graceful']`. Skews slender/graceful but covers wirier Wood Elves, athletic outdoorspeople, shorter compact elves. No "Stocky" or "Heavy" — those read off-archetype.

**Dwarf** — `['Stocky', 'Broad-shouldered', 'Heavy', 'Compact', 'Stout', 'Muscular']` → `['Lean', 'Wiry', 'Compact', 'Stocky', 'Stout', 'Athletic', 'Broad-shouldered', 'Muscular', 'Heavy']`. Skews stocky/sturdy (mountain & forge build) but a lean dwarven scout or wiry climber is uncommon-not-impossible. No "Tall" — dwarves are a short race per PHB.

Inline comments added to each race entry capturing the design intent (skew preserved, individual variation added) so future content edits respect the rationale.

---

## [1.0.0.134] - 2026-05-03 — Sub-checkpoint #5 fix: Dragonborn build pool — actual variety

User-reported issue from v1.0.133 review: Dragonborn's build options in Step 5 were `['Tall', 'Powerfully built', 'Muscular', 'Broad-shouldered', 'Towering', 'Heavy']` — six different ways of saying "big and strong." A content-authoring miss in the v1.0.120 raceColorTraits.js.

**Fix:** revised Dragonborn build pool to cover the full range of individual variation: `['Lean', 'Wiry', 'Athletic', 'Compact', 'Stocky', 'Broad-shouldered', 'Muscular', 'Heavy', 'Tall', 'Towering']`. The race still skews large (no "Slight" — Dragonborn aren't tiny), but a lean / wiry / compact Dragonborn is now a legitimate option, not just six flavors of intimidating.

---

## [1.0.0.133] - 2026-05-03 — Phase 2 close-out: Prelude wizard Step 5 (Appearance + free-text) (sub-checkpoint #5)

Sub-checkpoint #4 signed off (v1.0.132). Step 5 next.

**New component: `client/src/components/creator/PreludeStep5Appearance.jsx`** — two halves in one step per spec:

1. **Appearance grid** — six fields in a 3-column × 2-row grid: Eyes / Hair / Skin / Build / Height / Weight. Wholesale port of the primary creator's Step 7 race-aware pickers (`RaceAwareColorPicker`, `RaceAwareDimensionPicker`). Same primitives, same data shape, same race-derived dropdown options + "Custom…" override per the v1.0.120 work that built those.
2. **Anything else?** — free-text textarea, 2000-char cap with monospace counter (turns accent at overflow). Carried over from the legacy 11-question wizard's Q10.

**Age intentionally NOT included** — starting age is race-derived server-side per `preludeService.js::computeStartingAge` (humans 6, elves 30, dwarves 18, warforged 1, etc.). Legacy wizard removed its age field in v1.0.43 for the same reason.

**All appearance fields are optional**, matching the legacy wizard's Q10 leniency. Race-derived ranges in `raceDemographics.js` / `raceColorTraits.js` are calibrated for adult characters; the prelude character is a child whose appearance changes across the arc, so the player can fill what matters and use Custom… for child-appropriate values where it counts. Future iteration could split into "as a child" vs "as an adult" pickers — parking-lot consideration, not in scope here. Documented inline in the component.

**Step 5 → Step 6 validation gate** added: only blocks advance when `origin_freeform` exceeds the 2000-char cap (player sees + addresses before reaching review). All other fields lenient.

**Out of scope for this sub-checkpoint**:
- Step 6 (review)
- Save/resume server-side persistence
- HomeScreenV2 fourth in-progress card state
- Arc-prompt updates (APPEARANCE section in `preludeArcService.js` + line-141 system-prompt rule refinement) — these wire alongside cutover, per memory entry
- Cutover from legacy `PreludeSetupWizard`

---

## [1.0.0.132] - 2026-05-03 — Phase 2 close-out: Prelude wizard Step 4 (Family & Influence) (sub-checkpoint #4)

Sub-checkpoint #3 signed off (v1.0.131, no notes). Step 4 ships next — the largest step structurally, hence shipped alone before the smaller Steps 5+6.

**New component: `client/src/components/creator/PreludeStep4Family.jsx`** — three sections in a single step:

- **Parents / guardians** — two slots, each row is a 4-column grid (role / race / name / status). Race defaults to player's race when blank. Status description renders as `.help` text below the rows when the first parent's status changes.
- **Siblings** — single dropdown from `SIBLING_OPTIONS`. No free-text override (the legacy wizard's Q10 catches edge cases; here, Step 5's "Anything else?" carries that load).
- **Authority figure** — card-list of 8 options (parent / sibling / mentor / guardian / captor / employer / rival / none). Reuses the v1.0.124-signed-off pattern: editorial cards with accent left-border on the picked entry, label + italic description per option.

**Sibling/authority contradiction guard.** Selecting "Only child" + "An older sibling" as the dominant adult presence is incoherent — the legacy wizard's `validate()` blocked it; this version surfaces an inline `.help` warning ("You said 'Only child' above — pick a different authority here, or change your sibling answer.") AND disables Continue until resolved.

**Step 4 → Step 5 validation gate** added: requires `siblings` + `authority_figure`; blocks the only-child contradiction. Parents lenient — server fills a default unknown guardian if all slots are empty (matches legacy behavior).

**Out of scope for this sub-checkpoint**:
- Steps 5–6 (appearance + free-text / review)
- Save/resume server-side persistence
- HomeScreenV2 fourth in-progress card state
- Arc-prompt updates
- Cutover from legacy `PreludeSetupWizard`

---

## [1.0.0.131] - 2026-05-03 — Phase 2 close-out: Prelude wizard Step 3 (Origin) (sub-checkpoint #3)

Sub-checkpoint #2 signed off (v1.0.130). Step 3 ships next.

**New component: `client/src/components/creator/PreludeStep3Origin.jsx`** — birth circumstance / home setting / region. All three preserved verbatim from the legacy 11-question wizard. Each field reuses the visual pattern Step 2 established (signed off v1.0.130): curated dropdown → italic `.help` description below the dropdown after a value is picked → free-text override input ("Or write your own…") below the description.

Internal `CuratedFieldWithOverride` helper component reduces the three near-identical Field blocks to one shape parameterized by label / options / state slot. Server's `preludeService.js::buildPayload` resolves each field via `resolved(curated, otherKey)` — override wins when populated; otherwise dropdown value.

**Step 3 → Step 4 validation gate** added to `canAdvanceFromStep`: each origin field counts as filled when EITHER the dropdown value OR the override has content. Mirrors the legacy wizard's `validate()` after the resolver runs.

**Out of scope for this sub-checkpoint** (still pending later steps):
- Steps 4–6 (family / appearance / review)
- Save/resume server-side persistence
- HomeScreenV2 fourth in-progress card state
- Arc-prompt updates
- Cutover from legacy `PreludeSetupWizard`

---

## [1.0.0.130] - 2026-05-03 — Sub-checkpoint #2 fix: use-name guidance moves to Step 1 where the Last Name decision is made

User-reported issue from v1.0.129 review: the use-name guidance ("if you left Last name blank, the Prelude DM may introduce you with a use-name like 'Aelar of the Silver Glade'…") was on Step 2's Race field. By the time the player reaches Step 2, the Last Name decision is already made — the guidance arrives too late to inform it.

**Fix:** moved the use-name explanation to Step 1's Last Name help text, where the player is making the decision. Step 2's Race field help dropped (the WizardHead subtitle + the description-below-dropdown together cover the race choice; the field doesn't need its own redundant help).

Combined Step 1 Last Name help now reads: "Some peoples don't use family surnames — leave blank if that fits. If you do, the Prelude DM may introduce you with a use-name (e.g. 'Aelar of the Silver Glade') shaped by your race and where you grew up."

The legacy 11-question wizard had the same awkwardness (use-name copy lived on the race section but described the name section). This fix corrects an issue inherited from the legacy wizard, surfaced by the structural redesign putting the same content on a separate step.

---

## [1.0.0.129] - 2026-05-03 — Phase 2 close-out: Prelude wizard Step 2 (Ancestry) + per-step validation gates (sub-checkpoint #2)

Step 1 signed off. Per the cadence agreed with PM: ship Step 2 alone (not batched with Step 3) so the new race-description visual treatment is reviewed before the same pattern propagates to Step 3.

**New component: `client/src/components/creator/PreludeStep2Ancestry.jsx`** — race + subrace selectors with descriptive copy pulled inline from `client/src/data/races.json` (`races.<id>.description` and `races.<id>.subraces[].description`). One of three intentional content changes from the legacy 11-question wizard. Description renders as italic `.help` text below each dropdown after a value is selected. Subrace field appears only when the chosen race has subraces.

This is a prelude-specific surfacing — the primary creator's `Step2Ancestry.jsx` does NOT show race descriptions inline (race is just a dropdown name there). PM spec called this out as intentional.

**Per-step validation gates wired** (Step 1 + Step 2):

- Step 1 → Step 2: requires (`first_name` OR `last_name`) AND `gender`
- Step 2 → Step 3: requires `race`; requires `subrace` when the chosen race has subraces

Implemented as a `canAdvanceFromStep(step, state)` helper in `PreludeCreatorV2.jsx`. Continue button disables when the gate isn't met. Steps 3–5 currently return `true` while they're placeholders so the player can still walk forward and back during sub-checkpoint review; each gate lands when its step component lands.

Note: this gating is a small divergence from `CharacterCreatorV2`'s pattern — the primary creator doesn't gate per-step (only Submit on Step 8 validates). PM spec for the prelude wizard explicitly called for per-step gates ("Required fields per step gate advance"); going with the spec rather than primary parity. Reversible if PM wants primary parity later.

**Out of scope for this sub-checkpoint** (still pending later steps):
- Steps 3–6 (origin / family / appearance / review)
- Save/resume server-side persistence (new `creation_phase = 'prelude_setup'` enum value, partial-save endpoints)
- HomeScreenV2 fourth in-progress card state
- Arc-prompt updates (APPEARANCE section + line-141 system-prompt rule refinement)
- Cutover from legacy `PreludeSetupWizard` to `PreludeCreatorV2`

---

## [1.0.0.128] - 2026-05-03 — Sub-checkpoint #1 fix: horizontally-grouped Field rows align input baselines

User-reported issue from v1.0.127 Step 1 review: the three-column name row (First Name / Last Name / Nickname) showed inputs at staggered heights because each column's help text was a different number of lines. Help-above-input meant longer help pushed inputs down; the row read as broken even though each cell was technically correct.

**Fix:** when a `.field` is a direct child of `.field-row`, render help BELOW the input via flex `order` so inputs share a baseline. v1.0.118's global HEADING > SUBHEADING > CHOICE order still applies for single-column / vertically-stacked fields. Context-specific exception scoped to `.field-row` layouts.

Removed inline `marginTop:4 / marginBottom:10` from the Field primitive's help div; moved margins into CSS so the `.field-row` override actually wins.

**Side benefit:** the primary creator's Step 1 has the same three-column name row with the same misalignment latent since v1.0.118. This same fix improves both surfaces.

---

## [1.0.0.127] - 2026-05-03 — Phase 2 close-out: Prelude wizard structural redesign — Step 1 (sub-checkpoint #1)

PM-approved structural redesign per spec rev 2 (memory: `project_prelude_setup_structural_redesign.md`). Restructures `PreludeSetupWizard` from one-page-11-questions into a 6-step wizard mirroring the primary creator. Sub-checkpoint cadence: ship Step 1 first; user reviews against primary creator's Step 1; then proceed.

**This release lands Step 1 (Identity) + the 6-step shell + placeholders for Steps 2–6.** The legacy `PreludeSetupWizard.jsx` stays the live path; `PreludeCreatorV2` is reachable via `?prelude_v2=1` query param for review without disturbing the live flow. Cutover lands once all 6 steps + save/resume + HomeScreenV2 fourth-card-state + arc-prompt updates are signed off.

**New components:**
- `client/src/components/creator/PreludeCreatorV2.jsx` — wizard shell (parallels `CharacterCreatorV2`). 6-step state machine, Stepper rail, scroll-to-top on step change, WizardFoot Back/Continue. Save/resume scaffolding deferred to a later sub-checkpoint per PM cadence.
- `client/src/components/creator/PreludeStep1Identity.jsx` — Step 1. First/last/nickname inputs in a 3-column field row + Female/Male gender chips. Single-mode (no handoff fork — prelude is the entry path INTO a character, not a resume from one). Mirrors primary `Step1Identity.jsx` primitive choices verbatim.

**Primitive extensions** (backward-compat for `CharacterCreatorV2`):
- `Stepper`: new `steps` prop (defaults to the 8-step primary array). Prelude passes the new exported `PRELUDE_STEPS` constant (`Identity / Ancestry / Origin / Family / Appearance / Review`).
- `WizardHead`: new `totalSteps` prop (defaults to 8) + `eyebrowLabel` override. Prelude renders "Prelude Setup · Step 01 of 06"; primary unchanged.

**Gender content change** (per spec — one of three intentional content changes): collapses from female / male / non-binary / other(write your own) to binary Female / Male. Server-side `preludeService.js::validate` accepts any non-empty string, so the tightening is purely client-side. Existing characters with non-binary/other gender values are not a concern (clean slate confirmed in Phase 3 entry).

**Routing:** `HomeFlow.jsx` reads `?prelude_v2=1` from the URL when entering the `prelude.setup` route. Present → renders `PreludeCreatorV2`. Absent → renders the legacy `PreludeSetupWizard` as before. No effect on any other path.

**Out of scope for this sub-checkpoint** (lands as later steps complete):
- Steps 2–6 (race / origin / family / appearance / review) — placeholders only
- Save/resume server-side persistence (new `creation_phase = 'prelude_setup'` enum value, partial-save endpoints)
- HomeScreenV2 fourth in-progress card state
- Arc-prompt updates (APPEARANCE section + line-141 system-prompt rule refinement)
- Cutover from legacy `PreludeSetupWizard` to `PreludeCreatorV2` as the live path

---

## [1.0.0.126] - 2026-05-03 — Polish: capitalize Class nudge / Theme nudge values in arc preview

Sub-checkpoint review surfaced one polish item: the "Where the arc might lead" section's `Class nudge` and `Theme nudge` values rendered raw (`ranger`, `outlander`, `city_watch`) instead of display-formatted (`Ranger`, `Outlander`, `City Watch`). Added a small `prettifyId(id)` helper local to `PreludeArcPreview.jsx` matching the same pattern used elsewhere (HomeFlow, Step2Ancestry). User flagged that players will rarely see this section but consistency matters.

---

## [1.0.0.125] - 2026-05-03 — Phase 2 close-out: Prelude arc-preview editorial reskin (sub-checkpoint 2 of 2)

Second of two surfaces in the Prelude entry path. v1.0.124 reskinned the setup wizard; this lands the arc preview. Player walking from HomeScreenV2 → PathChoiceScreen → PreludeSetupWizard → PreludeArcPreview now reads as one continuous editorial experience. PreludeSession (the play loop) stays slate per scope ruling; parked.

**Token swap, not redesign.** `client/src/components/PreludeArcPreview.jsx` reskinned to match the `.creator-v2` editorial system:

- Wrapped in `<div className="creator-v2">` with the same appbar pattern (brand + "Prelude · arc preview" crumbs)
- Header uses the `wizard-head` + `eyebrow` + `h-step` + `lede` shape from the rest of the editorial flow
- Each section (Home / Chapters / Recurring threads / Where the arc might lead) renders as `.card`
- Per-chapter inner card uses `bg-2` + `rule-soft` border with a top label-row hairline divider
- Mentor possibility: dashed-border + accent left-border block (matches the celebration-card pattern at smaller scale)
- Departure seed (Ch4): accent left-border + structured "What most likely pulls them out" + "Plausible shapes" sub-blocks; back-compat with legacy `reason`/`non_tragic_alternatives` fields preserved
- Loading state: centered `h-step` + `lede` + monospace elapsed-seconds counter (replaces the slate spinner-text pattern)
- Error states: editorial-tone error block with accent left-border (matches v1.0.124's pattern)
- Footer: `.btn ghost` (Back) + `.btn` (Re-roll, when available) + `.btn primary lg` (Begin the Prelude →)

**Logic preserved verbatim.** Network calls, regenerate semantics, schema-version compatibility (v1.0.81 `primary_thread`/`plausible_shapes` vs legacy `reason`/`non_tragic_alternatives`), elapsed-seconds counter — all unchanged. Pure visual reskin.

**Closes the visible-seam item from the Phase 2 ship note.** Both surfaces (setup wizard + arc preview) now match the editorial system. Per the structural-redesign spec captured to memory, the next piece of close-out work is the 6-step structural redesign of PreludeSetupWizard — sequencing-wise that lands after this; the visual foundation is now in place under it.

---

## [1.0.0.124] - 2026-05-03 — Phase 2 close-out: Prelude setup wizard editorial reskin (sub-checkpoint 1 of 2)

PM ruling 2026-05-03 (Medium tier reskin): close the visible seam between editorial home and the prelude entry path. v1.0.115 wired `PreludeSetupWizard` into the new HomeFlow but kept its slate aesthetic — player walking from HomeScreenV2 → PathChoiceScreen → PreludeSetupWizard registered a hard visual transition.

**Token swap, not redesign.** `client/src/components/PreludeSetupWizard.jsx` reskinned to match the `.creator-v2` editorial system used by the rebuilt main creator + home page + Screen 2:

- Wrapped in `<div className="creator-v2">` with the same appbar pattern (brand + crumbs + back-to-roster button) used by HomeFlow / CharacterCreatorV2
- Replaced inline-styled `cardStyle` (purple slate) blocks with the editorial `.card` primitive
- Each question now uses the shared `<Field label help>` primitive from `creatorPrimitives.jsx` — same label/help/control composition as Steps 1-7 of the main creator
- Form controls swapped to `.input` / `.select` / `.textarea` (EB Garamond + Inter + accent underline)
- Q9 authority figure: card-list of options with editorial accent (left-border highlight on picked entry) replaces the purple radio cards. Preserves the label + description structure
- Q10 character counter: monospace ink-3, switches to accent on overflow
- Footer: `.btn ghost` cancel + `.btn primary lg` submit
- Error message: editorial-tone block (bg-2 + accent left-border) replaces `#fca5a5` red text

**Logic, copy, validation, payload shape, all preserved verbatim.** Form fields are the same 10 questions, validate() is unchanged, buildPayload() is unchanged, server contract unchanged. Pure visual reskin.

PreludeArcPreview reskin lands as v1.0.125 after sub-checkpoint review of this surface against the existing editorial pages.

PreludeSession (the play-loop UI) stays slate per PM scope ruling. Parking-lot entry pending: "if slate play loop feels jarring against editorial bookends after this reskin lands, reactivate."

---

## [1.0.0.123] - 2026-05-03 — Phase 2 close-out: Theme personality prompts — full alignment coverage (PM authored)

PM-authored content drop closing the personality alignment gap surfaced in v1.0.122's coverage scan. Replaces `client/src/data/themePersonalityPrompts.js` from 63 prompts (3 per theme, heavy alignment skew, every theme missing at least one alignment) to 189 prompts (9 per theme, every alignment present exactly once). 21 prompts carried forward from the existing file unchanged; 168 are new.

**Rule applied:** every theme requires at least one personality prompt for each of the 9 alignments (LG/NG/CG/LN/N/CN/LE/NE/CE) so players are never funneled into an alignment they didn't intend. PM-authored prompts honor the institution-shifts-with-alignment refinement (Phase 2 Decision 5 + 2026-05-03) — a Charlatan can be Lawful-Good but it still feels like a charlatan, not a paladin.

**Test update (`tests/theme-content-data.test.js`):** §7.2 block now asserts 9 prompts per theme = 189 total + every alignment present exactly once per theme. 1557 assertions pass.

**Export naming:** kept `THEME_PERSONALITY_PROMPTS` (UPPER_SNAKE) as the primary binding for existing consumers (Step7IdentityDetails, theme-content-data.test). Added `themePersonalityPrompts` (camelCase) + default export per PM's transcription convention so future code can use either.

User report that surfaced this: "I chose City Watch and I see all Personality traits are Lawful-coded. Make another note — this isn't what I want from this system!" Resolved system-wide.

---

## [1.0.0.122] - 2026-05-03 — Smoke-run fixes: Gold copy, claim direction, age ranges, primary/dump stat markers, optional Distinguishing Features

**Step 3 — gold "+0%" instead of "Class baseline".** "Class baseline" was too oblique. Zero-modifier case now renders "+0%" so every theme's gold display reads with the same shape (+5% / +0% / −10%).

**Step 5 — Claim direction copy.** v1.0.119 moved the value pool below the rows; v1.0.121 fixed the actual Claim button rendering. The "Pick a value above" button text on a claiming row was still pointing the wrong direction. Now reads "Pick a value below".

**Step 5 — primary/dump ability markers (legacy parity).** Surfaces ★ next to abilities listed in the chosen class's `primaryAbility[]` and ✗ next to the class's `dumpStat`. Matches the legacy CharacterCreationWizard's signal that helps players see at a glance which scores their class needs vs. doesn't. A small italic legend above the rows names which abilities are which (e.g., "For Cleric, ★ marks the primary ability (Wisdom); ✗ marks the dump stat (Intelligence).").

**Step 7 — Distinguishing Features now optional.** Previously blocked submit if blank; now optional. Field label updated to "(optional)" so players know they can skip without filler. Not every character has visible scars or markings.

**raceDemographics.js — age ranges audited per race lifespan.** Previous ranges had uneven jumps and short ceilings; revised so every race's adventuring window is dense (every year), then thins to 5y/10y/25y steps appropriate to the race's natural lifespan:

- Human: 16–65 every year, then 5y to 85
- Dwarf: 50–200 every 5y, 25y to 350
- Elf: 100–300 every 10y, 25y to 500, 50y to 750
- Halfling: 20–60 every year, 5y to 100, 10y to 150
- Tiefling: 16–50 every year, 5y to 100
- Dragonborn: 15–50 every year, 5y to 80 (matures ~15, lifespan ~80 per PHB)
- Half-Elf: 20–60 every year, 5y to 120, 20y to 180
- Half-Orc: 14–50 every year, 5y to 75
- Aasimar: 16–60 every year, 5y to 100, 20y to 160
- Warforged: 1–30 every year, 5y to 100 (years since creation)

User report: Dragonborn dropdown felt off — "average adventuring age 15-20" wasn't well-represented in the previous gappy range. Now every year through the prime adventuring window for every race.

---

## [1.0.0.121] - 2026-05-03 — Smoke-run fix: Step 5 Claim button never rendered (real root cause)

v1.0.119 thought it had fixed Step 5's Claim flow by reordering the value pool below the rows. The reorder was correct but the underlying bug was something else entirely: `computeFinal()` did `const base = baseScores[k] || 0` — collapsing both `null` (not yet assigned) and `0` (deliberately zero) into `0`. Since `base` was always a number, the downstream `base != null` check was always true → the value-already-assigned button always rendered → the Claim button never rendered. Worse: clicking the displayed "0" called `releaseSlot` which set the value to `null`, but the next render's `|| 0` coerced it back to `0` — a silent invisible loop.

Fix: preserve the null-vs-0 distinction. `const base = baseScores[k]` (no coercion); math operations downstream use `(base ?? 0)` so the totals still compute. Render branches that already had `base == null` checks (the value cell falsy display, the manual-mode input fallback) now actually trigger.

User report: "no claim button for the stat rolls. It looks like you can click on the 0 stat, but nothing happens when you do."

---

## [1.0.0.120] - 2026-05-03 — Smoke-run fixes: Race-derived eye/hair/skin/build pickers + "Any Simple Weapon" sub-picker + spellcasting focus tooltips

**Race-derived eye/hair/skin/build pickers (Step 7).** New `client/src/data/raceColorTraits.js` mirrors `raceDemographics.js` but for color/shape traits — eye colors, hair colors, skin tones, body builds — with race-appropriate defaults distilled from PHB Chapter 2 + Volo's (aasimar) + Eberron (warforged) + Mordenkainen's (dragonborn ancestry). New `RaceAwareColorPicker.jsx` parallels `RaceAwareDimensionPicker.jsx`: dropdown with PHB defaults + "Custom…" affordance for player-authoring agency + plain-text fallback when no race is picked. Step 7's physical-description grid now uses race-aware pickers for all four color/build fields (previously plain text inputs).

Race coverage: human, dwarf, elf, half-elf, half-orc, halfling, tiefling, aasimar, dragonborn (scaled — "hair" → "None — scaled"; "skin" → scale colors per draconic ancestry), warforged ("hair" → constructed/filaments/none; "skin" → plating materials; "eyes" → glowing/crystalline).

**"Any Simple Weapon" / "Any Martial Weapon" sub-picker (Step 6).** Class equipment options like Cleric's "Any Simple Weapon" rendered as a clickable card with no way to actually choose which simple weapon. Now: when the player selects an "Any X Weapon" option, a sub-dropdown appears inside the card listing the matching weapons with their damage + properties. The picked weapon's name flows through to the inventory at submit time (replaces the generic label). Subpick state lives in `state.equipment_subpicks` (new field, parallel shape to `equipment_picks`).

**Spellcasting focus tooltips (Step 6).** "Component Pouch", "Arcane Focus", "Holy Symbol", and "Druidic Focus" options now render an inline italic description below the option name explaining what the focus actually IS — so the player isn't choosing blind. Descriptions distilled from PHB Chapter 5 (Equipment) and Chapter 10 (Spellcasting). New helper `getFocusDescription(label)` in `equipmentResolver.js` keyed off the option label.

**Card structure adjustment.** `EquipmentOptionCard` switched from `<button>` to `<div role="button">` so it can host a `<select>` child without nesting interactive elements (HTML spec). Click semantics preserved via `onClick` + Enter/Space keyboard handler. Subpick dropdown clicks `stopPropagation` so the player doesn't accidentally re-toggle the parent pick when picking a weapon.

---

## [1.0.0.119] - 2026-05-03 — Smoke-run fixes: Heirloom Skip is now visible + Step 5 value pool moved below the rows

**Heirloom Skip (Step 6).** The Skip button set `state.heirloom = null` — but heirloom was already null in that state, so the click was a silent no-op. Now Skip flips a new `state.heirloom_skipped` flag, and the prompt collapses to a small dismissed-state row ("No heirloom — you set out unburdened. [Change my mind]"). The "Change my mind" affordance reopens the prompt with the same buttons. Authoring an heirloom (or starting authoring) clears the skipped flag automatically.

**Stats page (Step 5).** The instruction read "click 'Claim' on an ability row, then click a value below" — but the Standard Array value pool rendered ABOVE the ability rows. Click flow was right; the spatial mismatch was wrong. Reordered so the value pool renders AFTER the ability rows. Now the instruction text matches what the player sees, and the pool stays visible after they click Claim (no need to scroll back up). Updated the instruction copy slightly to match the new layout: "Click 'Claim' on an ability row above, then pick a value here."

---

## [1.0.0.118] - 2026-05-02 — Smoke-run fixes: Field layout (HEADING > SUBHEADING > CHOICE) + Starting Gold copy

User flagged twice: Step 7 sections (Alignment, Faith, Lifestyle) were rendering as HEADING > CHOICE > SUBHEADING. The expected reading order is HEADING > SUBHEADING > CHOICE so the player understands what they're choosing before they choose it.

**Field primitive (`creatorPrimitives.jsx`):** moved the `help` block above `children`. This is a one-line swap that affects every step using `<Field label="..." help="...">` — Step 2 (Race / Subrace / Ancestry feat), Step 4 (Class / Subclass), Step 6 (Equipment / Gold / Heirloom), Step 7 (Alignment / Faith / Lifestyle / physical fields), and a few others. Inline `className="help"` divs that render *after* a selection (post-pick context, like the deity description after picking faith) are unaffected — those are not section subheadings.

**Step 3 gold display copy:** changed "Starting gold +5% gold" → "Starting Gold: +5%". Two pieces: the label "Starting gold" → "Starting Gold:", and `formatModifier` no longer appends the redundant " gold" suffix.

---

## [1.0.0.117] - 2026-05-02 — Smoke-run fix: Aasimar (and Drow) ancestry-feat lookup

Smoke-run blocker. Step 2 in the rebuilt creator was fetching `/api/progression/ancestry-feats/aasimar` for an Aasimar character — but that list_id doesn't exist in `ancestry_feats`. Aasimar's feats are split across three subrace-specific lists (`aasimar_protector` / `aasimar_scourge` / `aasimar_fallen`), and Drow lives at the top level (`drow`) rather than nested under `elf`. The legacy `CharacterCreationWizard` already had a `computeAncestryListId(race, subrace)` helper handling both cases; it was lost during the chunk 5 rewrite of Step 2.

**Fix in `Step2Ancestry.jsx`:**
- Ported `computeAncestryListId(race, subrace)` to derive the correct list_id from race + subrace
- Fetch dependency now includes `subrace` so the list refetches when a Protector/Scourge/Fallen pick changes
- Aasimar with no subrace: skip the fetch entirely; dropdown disables and shows "Pick a subrace first…" instead of an empty options list
- Generic placeholders: "Pick a race first…" when nothing's chosen yet

User reported as: "Selecting a heritage gift either doesn't work/isn't hooked up… or just doesn't work for Aasimar" + "I can't complete creating a character until we figure out Ancestry Feats in the character creator." Both resolved by the same fix.

---

## [1.0.0.116] - 2026-05-02 — Smoke-run fix: NOT NULL placeholders for 'creating'-phase partial saves

Smoke-run uncovered that v1.0.115's POST defaults still failed at the schema layer. Defaults were `null`, but five columns are NOT NULL with no schema-level default: `class`, `current_hp`, `max_hp`, `current_location`, `experience_to_next_level`. The wizard's Step 1 → Continue path (POST `/api/character` with `creation_phase='creating'` and only first/last/nickname/gender) tripped the constraint with `LibsqlError: NOT NULL constraint failed: characters.class`.

**Fix:** Refined the v1.0.115 defaults to placeholder values that satisfy the constraints, mirroring the existing prelude pattern (`preludeService.js` writes `class='prelude'`, `level=0`, computed HP, computed location for in-flight prelude characters):

- `class` defaults to `'creating'` (string placeholder, distinguishable in queries)
- `current_hp` / `max_hp` default to `0`
- `current_location` defaults to `''` (empty string)
- `experience_to_next_level` defaults to `0`
- `name` defaults to `'(unnamed)'` for the edge case where neither first nor last name is set

These placeholders never reach gameplay code — the wizard PUTs real values as the player completes each step, and consumer-side guards already exist for in-progress phases (level-up checker skips `creation_phase === 'prelude'` and now should treat `'creating'` the same way; the new HomeFlow doesn't call level-up on in-progress rows so this is defense-in-depth).

No schema migration required. Schema NOT NULL constraints are the existing shape; all the fix does is provide non-null defaults at the route layer for the case where the client legitimately can't yet provide a value.

---

## [1.0.0.115] - 2026-05-02 — Phase 2 chunk 5 follow-ups: Prelude path wired into HomeFlow + server POST defaults

Two fixes surfaced after the v1.0.114 cutover made the new home page the live path.

### Server: explicit defaults for every POST `/api/character` field

`server/routes/character.js` POST destructure now defaults every field to `null` (or a sensible scalar like `1` for `level`, `0` for currencies, `'[]'` for JSON arrays). Without defaults, partial-save bodies from the new `creating`-phase save flow (Step 1 advance with just `first_name + gender + creation_phase='creating'`) left fields like `level`, `current_hp`, `current_location`, etc. as `undefined`. libsql throws `TypeError: Unsupported type of value` when any bind parameter is `undefined`. Defaults route every untouched field through as `null`/scalar, which libsql accepts. Active-character POSTs still pass full bodies and get the same defaults — backwards-compatible.

### HomeFlow: Prelude path now opens the real wizard

`handlePickPrelude` in `client/src/components/creator/HomeFlow.jsx` previously showed a `window.alert` stub. Live wiring per the existing `CharacterManager` pattern:

- New routes in HomeFlow's state machine: `'prelude.setup'`, `'prelude.arc'`, `'prelude.session'`
- Click "Prelude" on Screen 2 → `PreludeSetupWizard` (existing 11-question intake)
- Wizard's `onPreludeCreated(char, opts)` → `PreludeArcPreview` (or straight into the session if the testing checkbox bypasses preview)
- Arc preview's `onBegin` → `PreludeSession` (existing Sonnet play loop)
- Any of the three's exit/back → refresh roster + return home (so a now-`'ready_for_primary'` card shows up in place)

Resume path: clicking a `'prelude'` card from the home roster routes directly into `PreludeSession` for that character — `handleOpenCharacter` now branches on `state === 'prelude'` to load the row and resume the session.

### HomeScreenV2: 'prelude' card state added

Cards now render three in-progress states: `creating` ("Draft"), `prelude` ("Prelude · Continue", with `Ch N · age X` footer), `ready_for_primary` ("Prelude · Step forward"). All three share the desaturated portrait treatment.

`mapCharacterForHome` in HomeFlow now passes `prelude_chapter` and `prelude_age` through to the card.

---

## [1.0.0.114] - 2026-05-02 — Phase 2 chunk 5 batch 3 sub-checkpoint 2: Save/resume + canon transfer + migration 050 + cutover (Phase 2 closes)

Final piece of Phase 2 chunk 5. Lands save/resume wiring, campaign canon transfer, the `physical_build` column migration, and the cutover that makes the new home page + creator the live path. **Phase 2 ships with this commit.**

### 5.L.3 — Save/resume wiring per spec §6.2 + PM Option 1 (single source of truth)

Per PM ruling 2026-05-02: save creator progress to the character row directly. No parallel JSON blob. Submit becomes a clean state transition (flip `creation_phase` + run post-creation services), not a data move from one shape to another.

**`creatorPersistence.js` extended:**
- `saveProgress({ state, mode, preludePayload, characterId })` — POST creates a `'creating'` row on Step 1 advance (manual mode); PUT updates on every subsequent step. Handoff mode PUTs from the start (character_id arrives via `preludePayload.character_id`). Returns `{ character_id }`.
- `buildProgressBody(state)` — partial body that only includes fields the player has touched. Skips null values so PUT doesn't NULL out columns the player hasn't reached. Distinct from `buildSubmitBody` which composes everything for the final commit.
- `rehydrateManualCreatorState(character)` — manual-mode resume: reads the partial-save fields directly off the character row; never touches `prelude_handoff_payload` (which doesn't exist for manual characters).
- `rehydrateHandoffCreatorState(character, payload)` — handoff-mode resume: reads the character row + prelude_handoff_payload, with character-row values taking precedence where they exist.

Per PM note: kept the two rehydration paths separate rather than unifying around a synthetic empty payload. Two clean paths beat one path that branches internally.

**`CharacterCreatorV2.jsx` extended:**
- `characterId` state + `saving` / `saveError` state
- `next()` is now async — calls `saveProgress` before `setStep(s+1)`. On save failure: surfaces error inline, doesn't advance, preserves typed input.
- WizardFoot Continue button shows "Saving…" + disables during save
- New props: `initialState`, `initialCharacterId`, `initialStep`, `persistProgress` (defaults true; HomeFlow passes true; preview-only paths can pass false)

### 5.L.4 — Campaign canon transfer service (`campaignCanonTransferService.js`)

Per spec §8.2.2 step 5: on handoff submit, copies `prelude_canon_npcs / locations / threads` into the campaign-side `npcs / locations / campaign_threads` tables.

**`transferCanonToCampaign(characterId)`:**
- NPCs: insert into `npcs` with `race='Unknown'` (column is NOT NULL; canonical race tracking is a future enrichment), `relationship_to_party` from prelude relationship, `background_notes` prefixed with `[prelude_canon_npc#NN]` marker for idempotency
- Locations: insert into `locations` with `description` prefixed with `[prelude_canon_location#NN]` marker; `location_type` mapped from prelude type via `mapLocationType()` (village/hamlet/town → 'settlement'; forest/mountain → 'wilderness'; etc.)
- Threads: insert into `campaign_threads` with `source='prelude'` + `source_thread_id` linking back to the prelude_canon_threads.id (clean idempotency without a marker hack)

**Idempotency**: each insertion checks for existing rows tagged with the prelude-source marker before inserting. Submit can be retried safely; second runs no-op. 23 assertions in `tests/canon-transfer.test.js` lock down the behavior (chosen→carried_forward / others→left_behind, idempotent re-run, no-op when no canon data exists).

**Hooked into PUT `/api/character/:id`** at the existing `'ready_for_primary' → 'active'` transition detection (alongside `applyHeirloomChoiceOnSubmit`). Failure is non-blocking — character still flips to `'active'`; transfer error logged + retryable later via the idempotent re-run.

**Campaign-id linkage deferred**: transferred rows have `campaign_id = NULL` (no campaign exists at character submit time per the existing app flow). Linkage happens when the player later creates/assigns a campaign — parking-lot entry added.

### 5.L.5 — Migration 050: `physical_build` column

Adds the `physical_build` column to `characters` for Step 7's "build" field (slim/heavy/wiry/etc., per spec §5.7.4). Column was captured client-side since v1.0.112 but server PUT allowlist intentionally omitted it (would have crashed UPDATE). Migration 050 adds the column; same commit adds `physical_build` to the PUT allowlist; `creatorPersistence.buildProgressBody` + `buildSubmitBody` both now send the value. 5 assertions in `tests/migration-050.test.js`.

### 5.L.6 — Cleanup + cutover

The new home + creator becomes the live path.

**`HomeFlow.jsx` (new)** — wraps `HomeScreenV2 + PathChoiceScreen + CharacterCreatorV2` with real `/api/character` data + a small state machine (home / path / wizard.manual / wizard.resume.manual / wizard.resume.handoff). Card click routing per spec §3.5: active → handoff to App.jsx via `onSelectActive` callback (existing dashboard takes over); creating → load character + rehydrate manual state; ready_for_primary → load character + handoff_payload + rehydrate. `mapCharacterForHome()` adapts API row shape to HomeScreenV2 prop shape (state derives from creation_phase; pretty-fies theme/class ids; formats `updated_at` as relative time).

**`App.jsx` cutover:**
- `?creator=v2` preview routing removed — `CreatorV2Preview` function, `PREVIEW_FIXTURE_*` consts, `PREVIEW_HOME_CHARACTERS` all deleted (~300 LOC)
- New early-return: `if (!selectedCharacter && !showCreationForm) return <HomeFlow ... />` — HomeFlow is the landing surface for any logged-in user without a character selected
- Auto-select-first-character logic disabled — players land on HomeFlow deliberately, not skipped past it
- `<CharacterManager>` render gated on `showCreationForm` — only renders when CharacterSheet's "Edit in Wizard" path fires; never on the regular dashboard view
- New "← Your characters" ghost button at the top of the dashboard chrome — clears `selectedCharacter` so HomeFlow takes over again

**Deprecation** (per CLAUDE.md "deprecate by hiding nav, not deleting code"):
- `CharacterCreationWizard.jsx` — top-of-file comment marks it deprecated 2026-05-02. Reachable only via CharacterSheet's Edit-in-Wizard path until the new creator grows an edit-existing surface.
- `CharacterManager.jsx` — same. Reachable only when `showCreationForm` is true (the edit path).
- Both files retained in the repo. Safe to delete after 2-3 playtest cycles + the edit-existing migration lands. Parking-lot entry added.

### Files

- `client/src/components/creator/HomeFlow.jsx` (new)
- `client/src/components/creator/CharacterCreatorV2.jsx` (initialState/initialCharacterId/persistProgress props; save-before-advance)
- `client/src/components/creator/creatorPersistence.js` (saveProgress / buildProgressBody / rehydrate helpers)
- `client/src/components/CharacterCreationWizard.jsx` (deprecation header)
- `client/src/components/CharacterManager.jsx` (deprecation header)
- `client/src/App.jsx` (HomeFlow integration; preview wiring removed; auto-select disabled; back-to-roster button; CharacterManager conditional)
- `server/services/campaignCanonTransferService.js` (new)
- `server/routes/character.js` (transferCanonToCampaign hooked into PUT submit; physical_build added to PUT allowlist)
- `server/migrations/050_physical_build_column.js` (new)
- `tests/canon-transfer.test.js` (new — 23 assertions)
- `tests/migration-050.test.js` (new — 5 assertions)
- `CONSOLIDATED_TODO.md` (4 new parking-lot entries)

### Verification

- Vite build clean (1.35s)
- Dev server starts cleanly (per the lesson learned in v1.0.113 — module-load is verified, not just build)
- 2036 prelude + chunk 5 assertions green across 15 suites (1996 prior + 12 + 23 + 5 = 2036)

### Phase 2 closes

This commit closes Phase 2 of the consolidated project plan. The full chunk 5 surface is shipped:

- 8-step rebuilt creator (Steps 1-8 + Submit + validation) — manual + handoff modes
- Editorial aesthetic (EB Garamond + Inter + JetBrains Mono, parchment palette) — the project's default visual register going forward per Decision 6
- Six PM-authored content data files (~620 entries — gold modifiers / personality / ideals / bonds / flaws / backstory moments + 19 narrative-continuity lines + 21 race demographic ranges)
- Save/resume — partial creator state persists to the character row; mid-creation can resume from the home page
- Canon transfer — Prelude-derived NPCs/locations/threads carry into the campaign tables on handoff submit
- New home page (Diablo-4 Create + 3 card states) + Screen 2 path choice
- Spec annotations preserve every deviation reasoning (§5.2.5 celebration card reorder, §5.7.3 expansions closed-by-default)
- Coverage matrix tooling for content-authoring follow-ups

Next: Phase 3 (AI Narrative Persistence foundation refactors per `CONSOLIDATED_TODO.md`).

## [1.0.0.113] - 2026-05-02 — Phase 2 chunk 5 batch 3 checkpoint 3 sub-checkpoint 1: Home page + Screen 2 + bundle-load regression fix

First half of checkpoint 3 — the user-facing visual surfaces that wrap the rebuilt creator. Save/resume wiring + canon transfer + cleanup land in sub-checkpoint 2.

### Bundle-load regression fix (v1.0.112 fallout)

Step 6's `ALL_TOOLS` const at module scope assumed `equipmentData.tools` was an array; it's actually a dict grouped as `artisansTools / gamingSets / otherTools`. Calling `.map` on a dict threw `TypeError` at module load, which cascaded:

```
Step6Equipment.jsx fails to evaluate
  → CharacterCreatorV2.jsx fails to import it
    → App.jsx fails to import CharacterCreatorV2
      → entire bundle fails to load
        → white screen on every URL
```

The build passed because esbuild only checks syntax, not runtime evaluation. Module-load errors only surface when a browser executes the code. **Lesson logged for memory**: always run the dev server briefly when shipping anything that touches new data file shapes — build-clean is necessary but not sufficient for module-scope code that consumes imported data.

Fix: rewrote `ALL_TOOLS` as an IIFE that flattens across the three tool groups + handles string-or-object entries.

### Home page V2 (`HomeScreenV2.jsx`)

Per `PHASE_2_CREATOR_SPEC.md` §3. Single-section "Your characters" layout with:

- **Heading**: *Your Characters*
- **Subheading (italic serif lede)**: *Pick a character to get started.*
- **Right-side help text**: *"Active characters, in-progress drafts, and Preludes ready to step forward — all here."*
- **Diablo-4-style "Create New Character"** entry as the first card. Visually distinct (dashed border, "+" affordance, no portrait/name/level) but lives in the same 3-column grid as character cards. Per spec §3.2 + PM ruling.
- **Three card states** (active / creating / ready_for_primary). The two in-progress states share the desaturated-portrait visual treatment per PM ruling 2026-05-02; only the badge text distinguishes them ("Draft" with outlined accent for `creating`; "Prelude · Step forward" with filled accent for `ready_for_primary`). Active characters get no badge — the absence IS the "ready to play" signal.
- **Per-state click routing**: active → game screen (out of v2 scope); creating → resume manual creator at last step; ready_for_primary → resume in handoff mode.

### Screen 2 — Path choice (`PathChoiceScreen.jsx`)

Per `PHASE_2_CREATOR_SPEC.md` §4. Two co-equal cards (Prelude on the left, Campaign on the right). Body copy verbatim from spec §4.4 / §4.5. Eyebrow + lede framing line per §4.3. "← Back to roster" ghost button below the cards.

Both cards use equal weight (same size, same hierarchy) per spec §4.2 — neither path is presented as "the recommended" path.

### App.jsx integration (preview only)

`?creator=v2` query param now opens an internal sub-router (`CreatorV2Preview`) with three routes:
- `?creator=v2&from=home` — opens at the new home page
- `?creator=v2&from=path` — opens at Screen 2 directly
- `?creator=v2` (no `from`) — opens at the creator wizard (existing behavior)
- `?creator=v2&handoff=1&fixture=verena|single-bump|hermit` (existing) — handoff mode wizard with fixture

Five preview character fixtures wired so PM can review all three card states + the Diablo-4 entry: Verena (ready_for_primary), Aelarra (active), Brenn (creating), Quill (active), Halvor (ready_for_primary).

### CSS — `creator-theme.css` extended

Added `~240 LOC` of home + path-choice styles, all scoped under `.creator-v2`:
- `.home-head` flex layout (heading left, help right)
- `.charlist` 3-column grid
- `.charcard` (active state baseline) + `.charcard.in-progress` (desaturated glyph) + `.charcard.create` (dashed-border action card) + `.charcard .badge.draft` + `.charcard .badge.prelude`
- `.pathframe` centered + `.pathcards` 2-column grid + `.pathcard` (with hover translateY + arrow translation)

### Files

- `client/src/components/creator/HomeScreenV2.jsx` (new)
- `client/src/components/creator/PathChoiceScreen.jsx` (new)
- `client/src/components/creator/Step6Equipment.jsx` (ALL_TOOLS bug fix)
- `client/src/App.jsx` (sub-router + 5 fixture characters)
- `client/src/styles/creator-theme.css` (~240 LOC home + path styles)

### Verification

- Vite build clean (1.34s)
- Dev server confirmed loading after fix (verified via console error trace)
- 2008 prelude + chunk 5 assertions still green (no regressions)

### Intentional deferrals (sub-checkpoint 2)

- **Save/resume wiring** — Step-1-advance creates `'creating'` row; subsequent step advances PUT to update; home cards resume into the creator with full state
- **Canon transfer service** — `transferCanonToCampaign()` server-side: copies `prelude_canon_npcs / locations / threads` into campaign-side `npcs / locations / campaign_threads`; seeds `mentor_imprints` when applicable; called from PUT `/api/character/:id` on `'ready_for_primary' → 'active'` transition
- **Migration 050** — `physical_build` column + any other small additions
- **Cleanup + cutover** — remove `?creator=v2` query-param wiring; new home page becomes the live path; `CharacterCreationWizard.jsx` hidden with deprecation comment per CLAUDE.md "deprecate by hiding nav, not deleting code"

## [1.0.0.112] - 2026-05-02 — Phase 2 chunk 5 batch 3 checkpoint 2: Step 7 (Identity Details) + Step 8 (Review) + Submit + persistence + PM-review polish

Lands the judgment-heavy half of the rebuilt creator. Step 7 (Identity Details) introduces the prompts/moments interaction patterns (Model A click-to-fill + Model B multi-select chips) plus the always-visible alignment chips. Step 8 (Review) renders the assembled character as a read-only preview card with editable summary list + Edit-jumps + Submit branching. Server-side: POST/PUT extended to handle the new `'creating'` phase and the handoff submit's heirloom flip. Plus a substantial PM review-feedback round.

### Step 7 — Identity Details (`Step7IdentityDetails.jsx`)

Per spec §5.7. Two stacked sections:

**Required core (always visible):**
- **Alignment** — 3×3 grid picker (LG/NG/CG · LN/N/CN · LE/NE/CE). Picking a cell surfaces a 1-sentence summary + 2 illustrative behavior examples below (distilled from canonical 5e PHB definitions, not freshly authored). All 9 cells covered in `AlignmentChip.jsx`'s `ALIGNMENT_DESCRIPTIONS` export.
- **Faith** — select listing all 53 deities from `deities.json` + "None / Unaligned" anchor. Selected faith surfaces description + alignment chip below.
- **Lifestyle** — 7 chip options (Wretched → Aristocratic) per spec §5.7.7. Each chip shows daily cost inline ("Modest 1 gp/day"). Picked tier surfaces description below: cost + meaning per PHB Chapter 5 ("a respectable apartment or comfortable lodging…").
- **Physical description** — 3-column compact grid for Age / Height / Weight / Eyes / Hair / Skin / Build (per §5.7.7 design call to avoid 11 stacked rows). Distinguishing features as a wider textarea below.
- **Race-aware Age / Height / Weight pickers** (PM ruling 2026-05-02) — `RaceAwareDimensionPicker.jsx` renders dropdowns from `client/src/data/raceDemographics.js` (PHB-derived ranges per race, distilled from PHB Ch.2 / Volo's Guide / ERftLW). Dual-unit display in labels: `5'10" (178 cm)` / `165 lb (75 kg)`. "Custom…" affordance opens a text input for unusual characters (200-year-old polymorphed dragon halflings, etc.) — honors player authoring agency per CLAUDE.md "Player first." Falls back to plain text input when race not yet picked (manual-mode pre-Step-2).

**Five collapsible expansions** (`ExpansionSection.jsx`):
- **Closed by default in BOTH modes** with chevron (▸) marker that rotates 90° when open. PM review feedback 2026-05-02: original spec §5.7.3 called for handoff-default-open, but in-context review chose closed-with-marker — open-by-default visually crowded the required-fields section and the chevron preserves discoverability without imposing the expansion's content on every player. Spec §5.7.3 annotated.
- "✓ filled" tag appears in the collapsed header when the expansion has content, so the player can see at a glance what's authored.

**Model A click-to-fill** for Personality / Ideals / Bonds / Flaws (`PromptList.jsx`):
- Theme-flavored prompts render as clickable rows with **always-visible alignment chips** inline (Decision 3 — never hover-gated).
- Click → text drops into the textarea as starter; player edits freely.
- Confirm dialog if the player has typed beyond the previous starter ("You've edited this. Replace with the new prompt?").
- Picked-state highlight tracks exact-match (clears when player edits).

**Model B multi-select** for Backstory (`MomentList.jsx`):
- Curated moments (8 per theme) render as checkbox rows; click to pick.
- Picked moments become **chips** with up/down reorder (↑↓) + remove (✕).
- "Write your own" affordance — text input + Add button → custom moments slot in alongside curated picks.
- **Handoff mode**: read-only biography seed renders at the top of the Backstory expansion with timestamps + "What you see here is canonical to your campaign…" affordance per §5.7.5. The §7 prompts/moments remain accessible below per spec.
- Per Decision 4: Backstory moments have NO alignment chip (events ≠ commitments) — visibly distinct from PromptList's shape.

### Step 8 — Review (`Step8Review.jsx`)

Per spec §5.8. Two stacked components:

**Preview card** — character-sheet-shaped read-only summary:
- Name + nickname inline, with race / subrace / gender / theme / class / level subline (PM review feedback 2026-05-02: order is `Race · Subrace · Gender · Theme · Class · Level 1`).
- 6-column ability score grid with mod string below each (`+2`, `+0`, `−1` etc.).
- Section grid for Alignment & faith / Appearance / Inner life (only when filled).

**Editable summary list** — 7 sections (Steps 1-7), each with an **Edit →** affordance that calls `onJump(step - 1)`. State preserved across all other steps; player advances forward through subsequent steps to return to Submit (per spec §5.8.6 Q2 = (a) locked decision).

**Validation**: every required field across Steps 1-7 checked before Submit. Errors render with **per-step jump links** so the player can fix in place. Submit disabled until valid; surfaces submit errors inline.

**Handoff callout** above the preview card per §5.8.5: *"The years that shaped you are behind you now. Step forward."* Single-line, modest visual weight.

**Submit button**: primary CTA — *"Step into the world"* (handoff) or *"Create character"* (manual).

### Submit branching (`creatorPersistence.js`)

`buildSubmitBody()` composes the request body with: final ability scores (base + racial + bumps clamped at 18), inventory (equipment picks + authored heirloom with `is_heirloom=true`), composed backstory (biography seed + picked moments + custom moments in pick order, blank-line-separated), Identity Details fields (alignment / faith / lifestyle / physical / expansions).

```
mode === 'handoff':
  → PUT /api/character/{preludePayload.character_id}
  → server detects 'ready_for_primary' → 'active' transition
  → applyHeirloomChoiceOnSubmit() flips chosen → 'carried_forward', others → 'left_behind'
  → TODO (checkpoint 3): canon transfer to campaign tables

mode === 'manual':
  → POST /api/character (or PUT if a 'creating' row was created at Step 1 advance)
```

### Server-side (`server/routes/character.js`)

- **POST /api/character**: now accepts `creation_phase` (defaults to `'active'` for backwards compat with existing callers — server seed scripts, tests, internal imports).
- **PUT /api/character/:id**: detects `ready_for_primary → active` transition, runs `applyHeirloomChoiceOnSubmit()` to flip candidate statuses (chosen → `'carried_forward'`, others → `'left_behind'`); no-op when no candidates exist (the only case today since OBJECT_HINT producer is deferred per Option A).

### PM-review polish round (in-checkpoint feedback fixes)

Substantial fixes from visual review at checkpoint 2:

- **Feat name lookup fixed.** Step 2 was reading `f.name` but the API returns `feat_name`. Added `ancestry_feat_name` + `ancestry_feat_description` override fields to fixtures (production payloads will get these from the transition service); added `prettifyFeatId` last-line fallback for raw slugs.
- **Class primary ability rendering.** `class.primaryAbility` is an array (`['str', 'dex']`); added `formatAbilityList` helper that joins to `"STR or DEX"`. Same fix applies to saving throws.
- **Subclass dropdown is pick-level-aware.** `detectSubclassPickLevel()` inspects class subclass data: if any subclass has L1 features (Cleric/Sorcerer/Warlock/etc.) → renders the subclass picker; otherwise renders *"[Class] chooses a specialization at level N. You'll pick when you reach that level in play."* For Fighter that reads "level 3."
- **Bump celebration card phrasing.** Reformatted "+1 to assign" as a small badge after the chapter beat (no more confusing em-dash). Replaced "Choose where each shows" with PM's suggested wording: *"Though your past shaped you, you may shape your future. Where would you like each to land?"* Fixed the broken Verena fixture sentence about the river-crossing winter.
- **Equipment picker improvements.** New `equipmentResolver.js` filters `(if proficient)` options entirely (until subclass-aware proficiency tracking lands — PM ruling: better to hide than surface a confusing tag). Each equipment option resolves through the resolver and shows damage/properties for weapons (e.g., *"Longsword — 1d8 slashing · versatile"*), AC + STR requirement + stealth disadvantage for armor (e.g., *"Chain Mail — AC 16 (no DEX) · STR 13 required · stealth disadvantage"*). Pack picks render their full contents inline as a 2-column bulleted list.
- **Heirloom specific-item dropdowns.** Wired real selects from `equipment.json`: Weapon → grouped by simple/martial × melee/ranged with damage stats below; Armor → grouped by light/medium/heavy/shields with AC stats below; Tool → all artisan tools + musical instruments. Book/Tome/Jewelry/Trinket/Other stay as free text per spec §5.6.5.
- **Scroll-to-top on step change.** `useEffect` in `CharacterCreatorV2` shell calls `window.scrollTo(0, 0)` instantly on every step change.
- **Step 7 expansions closed-by-default.** All 5 expansions now closed by default in both modes, with chevron (▸) marker for expandability. Spec §5.7.3 annotated with the deviation reasoning.
- **Step 8 char-name subline format.** `Race · Subrace · Gender · Theme · Class · Level 1` per PM spec.
- **"heirloom:" capitalization** fixed to "Heirloom:" in Step 8 summary.

### Coverage matrix side-output

- `tests/coverage-matrix.js` (new) — Node script that reads `themeIdealsPrompts.js` / `themeBondsPrompts.js` / `themeFlawsPrompts.js` and tabulates which 9-square alignment slots are filled per theme × field. Skips Personality (intentionally skewed per spec).
- `triage/alignment-coverage-matrix.md` (new) — generated report. Initial coverage: **241 / 567 cells (43%)** filled. Used by PM as visibility input for the targeted gap-fill content authoring pass (parking-lot entry added to `CONSOLIDATED_TODO.md`).

### Parking-lot entries (CONSOLIDATED_TODO.md)

Three new entries logged for post-chunk-5 work:
- **Heirloom handoff producer** (already had table + consumer; producer-mechanism choice deferred).
- **Deity worship-contract content authoring** — 53 deities × ~150-250 words each. Not creator-blocking.
- **Soldier (and others) alignment-coverage gap-fills** — PM authoring pass; coverage matrix produced as side-output.

### Spec annotations

- `PHASE_2_CREATOR_SPEC.md` §5.7.3 — annotated with the closed-by-default deviation note, including PM's reasoning (visual crowding + chevron-as-discoverability).

### Files

- `client/src/components/creator/Step7IdentityDetails.jsx` (new)
- `client/src/components/creator/Step8Review.jsx` (new)
- `client/src/components/creator/AlignmentChip.jsx` (new — exports ALIGNMENT_NAMES + ALIGNMENT_DESCRIPTIONS)
- `client/src/components/creator/ExpansionSection.jsx` (new — chevron marker)
- `client/src/components/creator/PromptList.jsx` (new — Model A)
- `client/src/components/creator/MomentList.jsx` (new — Model B with chips)
- `client/src/components/creator/RaceAwareDimensionPicker.jsx` (new — PM-review feedback)
- `client/src/components/creator/equipmentResolver.js` (new — equipment.json lookup)
- `client/src/components/creator/creatorPersistence.js` (new — Submit handler)
- `client/src/components/creator/CharacterCreatorV2.jsx` (Steps 7+8 wired; scroll-to-top; state schema extended)
- `client/src/components/creator/Step2Ancestry.jsx` (feat_name fix; locked-feat fallback)
- `client/src/components/creator/Step4ClassCalling.jsx` (formatAbilityList; subclass pick-level logic)
- `client/src/components/creator/Step6Equipment.jsx` (equipmentResolver wiring; specific-item dropdowns)
- `client/src/components/creator/BumpCelebrationCard.jsx` (phrasing fix)
- `client/src/data/raceDemographics.js` (new — PHB-derived ranges)
- `client/src/App.jsx` (fixture overrides for ancestry_feat_name + biography seed; canon NPCs/locations)
- `server/routes/character.js` (POST creation_phase; PUT phase-flip + applyHeirloomChoiceOnSubmit)
- `tests/creator-server-persistence.test.js` (new — 12 assertions)
- `tests/coverage-matrix.js` (new — side-output script)
- `triage/alignment-coverage-matrix.md` (new — generated report)
- `PHASE_2_CREATOR_SPEC.md` (§5.7.3 annotation)
- `CONSOLIDATED_TODO.md` (3 new parking-lot entries)

### Verification

- Vite build clean (1.29s)
- 2008 prelude + chunk 5 assertions green (1996 prior + 12 new from creator-server-persistence)
- Three preview fixtures exercise singular/plural bump phrasing + all three gold variants + biography seed: `?creator=v2&handoff=1&fixture=verena|single-bump|hermit`

### Intentional deferrals (checkpoint 3)

- Canon transfer to campaign tables (TODO comment + console.log at handoff submit). Spec §8.2.2 step 5: copy `prelude_canon_npcs / locations / threads` into the campaign-side tables; seed `mentor_imprints` when applicable. Needs integration with primary-campaign generation logic.
- Manual-mode Step-1-advance row creation (the persistence wiring for `'creating'` phase to enable mid-creator save/resume).
- `physical_build` server column (Step 7 new "build" field). Captured client-side and surfaced in Step 8 preview; server PUT allowlist intentionally omits it. Migration in checkpoint 3.

## [1.0.0.111] - 2026-05-02 — Phase 2 chunk 5 batch 3 checkpoint 1: Step 5 (Ability Scores) + Step 6 (Equipment) + bump celebration card

First of three checkpoints inside batch 3. Lands the two cleanest standalone steps — bump celebration card (third instance of the celebration primitive), gold modifier display (three variants), and heirloom flow shape. Step 7 + Step 8 + Submit + persistence land in checkpoint 2; home page + Screen 2 + cleanup land in checkpoint 3.

### Step 5 — Ability Scores (`Step5AbilityScores.jsx`)

Per spec §5.5. Manual mode subsections in order: generation method picker (Standard Array / Manual) → ability score assignment (six rows) → racial choice picker when applicable → skills picker → Variant Human bonus general feat (when human + Variant subrace).

**Standard Array UX**: click-to-claim pattern (Pattern B from spec §5.5.6). Click "Claim" on an ability row → click a value in the pool. Click an assigned value to release it back. Used values gray out in the pool. Chose this over drag-and-drop for accessibility + mobile fit; drag-and-drop on web is fiddly and the spec leaves the mechanism open ("what's locked is the goal — visible at a glance, assignment is bound, not error-prone").

**Manual mode**: numeric inputs with **3–20 base range** per spec §5.5.7 (intentionally wide — supports roleplay-driven custom builds like frail scholars or savants).

**Racial bonus handling** (`races.json`): supports both static (`{wis: 1}`) and choice (`{choice: 2}`) shapes. Half-Elf's mixed shape (`{cha: 2, choice: 2}`) decomposes correctly — fixed +2 CHA pre-applied, 2 player choices via chip picker.

**L1 cap 18 clamp** per Decision E. When raw `base + racial + bumps > 18`, the total renders in accent color with a "(capped from N)" annotation below. Visible, not silent (per §5.5.7 explicit requirement).

**Skills picker**: chip-style multi-select within `class.skillChoices` allotment, scoped to `class.skillOptions`. Emergence skills from `accepted_skill_bumps` pre-check + are read-only + count toward the allotment (caps at 2 per v4 §5e). Allotment math currently subtracts emergence count; doesn't yet subtract class/theme/ancestry-granted skills (spec §5.7 ack: "engineering: confirm against current `class_skills` data shapes" — left for batch 3 follow-up since the data shape needs confirming first).

**Variant Human bonus general feat picker**: placeholder. Real prereq-filtered feat picker is a follow-up — flagged inline with help text rather than faking a control.

### Step 5 — BumpCelebrationCard (`BumpCelebrationCard.jsx`)

Third instance of the celebration primitive (after Step 2 + Step 3). Two shape differences from the standard CelebrationCard:

1. **Count-aware heading** per spec §5.5.5: 1 → "One moment shaped you:" / 2 → "Two moments shaped you:" / N → "[N] moments shaped you:". Verb stays "shaped" per the §5.5.5 verb-choice note (intentionally neutral about *how* the moments did their work — the chapter-beat text carries the texture).
2. **Per-bump assignment dropdown** paired with each beat. Default to alphabetical first-fit per §5.5.7 (cha → con → dex → int → str → wis); player override is one click. Live-updates the bumps column on the ability table below.

The `defaultBumpAssignments(bumps)` helper is a named export so checkpoint 2's payload-shape tests can lock the alphabetical-first-fit behavior.

### Step 6 — Equipment (`Step6Equipment.jsx`)

Per spec §5.6. Three subsections in order: class equipment package picker → starting gold display (read-only, calculated) → heirloom flow.

**Class equipment package picker**: reads `class.startingEquipment.choices` from classes.json. Each choice is "choose 1 of N options" — renders as its own picker row. Fighter has 4 choices (armor, primary weapon, secondary weapon, pack); other classes vary.

**Starting gold display** — three display variants per spec §7.1.4:
- Zero modifier: `Starting gold: 125 gp (Fighter baseline)`
- Positive modifier (e.g., Investigator +10%): `Starting gold: 220 gp (Rogue baseline 200 gp + Investigator theme adjustment +10%)`
- Negative modifier (e.g., Hermit −35%): `Starting gold: 130 gp (Druid baseline 200 gp + Hermit theme adjustment −35%)` — using **U+2212** minus glyph (NOT a hyphen) per spec §7.1.4 explicit requirement
- Read-only (no interaction). Calculation via `applyGoldModifier()` from `themeGoldModifiers.js` (half-up rounding per §7.1.4)

**Heirloom flow** — two paths via `useOptInPath` branch:
- **Handoff with candidates**: candidate picker with name + type + description + awakening hook per candidate. Player picks one or "Carry none". NOT REACHED today since producer is deferred per Option A — kept wired so it lights up automatically when producer-side work lands.
- **Opt-in path** (manual mode + handoff with zero candidates — the only path handoff players see today): opt-in prompt → if accepted, manual authoring form (name, type [7-option select], specific item [free text — see note], description, awakening hook). Cancel-heirloom button releases cleanly back to opt-in state.

The handoff-with-zero-candidates path uses softened lead-in copy: *"Your Prelude didn't surface a particular object as a marked keepsake — but if there's something you carry forward in spirit, you can author it here."*

**Heirloom specific-item field is free text for all types** (including Weapon / Armor / Tool which spec §5.6.5 wants as `equipment.json` selects with mechanical baseline derivation). Free-text fallback is honest about the gap; type-aware help text tells the player the underlying type sets baseline stats. Real `equipment.json` filtering is a separate batch-3 follow-up — significant pass involving deciding which entries to surface, picker shape, and mechanical-baseline application logic.

### App.jsx fixture variants

Three preview fixtures wired so the singular/plural/N bump phrasings AND all three gold variants get visual review:

- `?creator=v2&handoff=1&fixture=verena` (default) — Variant Human + Soldier theme + Fighter class. Plural bump phrasing (2 bumps). Zero gold modifier.
- `?creator=v2&handoff=1&fixture=single-bump` — Half-Elf + Investigator + Rogue. **Singular** bump phrasing (1 bump). Positive gold modifier (+10%).
- `?creator=v2&handoff=1&fixture=hermit` — Wood Elf + Hermit + Druid. Plural bump phrasing (2 bumps both targeting WIS — exercises L1 cap clamp visualization). **Negative** gold modifier (−35% with U+2212).

### Files

- `client/src/components/creator/Step5AbilityScores.jsx` (new)
- `client/src/components/creator/BumpCelebrationCard.jsx` (new — exports `defaultBumpAssignments`, `ABILITY_KEYS`, `ABILITY_LABELS` for downstream tests)
- `client/src/components/creator/Step6Equipment.jsx` (new — `HeirloomFlow`, `HeirloomAuthoringForm`, `HandoffCandidatePicker` co-located)
- `client/src/components/creator/CharacterCreatorV2.jsx` (Steps 5+6 wired into router; initial state extended)
- `client/src/App.jsx` (3-fixture wiring for preview review)

### Verification

- Vite build clean (1.26s, +~14KB)
- 1996 prelude + chunk 5 assertions still green
- Visual review by PM at checkpoint 1 ✅

### Intentional follow-ups (logged for batch 3 checkpoint 3 cleanup)

1. Skills allotment math should subtract class/theme/ancestry-granted skills, not just emergence skills (spec §5.5.7).
2. Variant Human bonus general feat picker — real prereq-filtered selector (currently placeholder).
3. Heirloom specific-item picker for Weapon / Armor / Tool — `equipment.json` filtered selects with mechanical baseline application (currently free text).

## [1.0.0.110] - 2026-05-02 — Phase 2 chunk 5 batch 2: Creator shell + Steps 1–4 + celebration card + narrative-continuity card

Visual + interaction layer for the rebuilt creator. Steps 5–8, save/resume persistence, the home page redesign, and Screen 2 land in batch 3. The new creator is reachable behind a query-param preview affordance (`?creator=v2`) so the rest of the app stays untouched until 5.K wires it as the only path.

### Editorial aesthetic locked

Per Decision 6 (DECISION_LOG 2026-05-02): editorial & literary is the project's default visual register going forward. Parchment + dark variants from the design mockup are NOT carried — single-aesthetic only per PM ruling. Tweaks panel + manuscript celebration variant skipped for the same reason.

- **`client/src/styles/creator-theme.css`** (new, ~580 LOC) — design tokens + structural classes, all scoped under `.creator-v2`. Wrapper-class scoping means the editorial palette never bleeds into the existing app's dark slate gradient. Promote to `client/src/styles/design-tokens.css` when a second surface (Origin & Identity, Progression) starts referencing the same tokens; don't pre-promote.
- **`client/index.html`** — Google Fonts `<link>` for EB Garamond + Inter + JetBrains Mono with `preconnect` hints. Self-hosting deferred until the project formalizes its asset pipeline.
- **`client/src/main.jsx`** — imports `creator-theme.css` globally. Zero side effect on existing app since all rules are scoped under `.creator-v2`.

### New components in `client/src/components/creator/`

- **`creatorPrimitives.jsx`** — `Eyebrow`, `Field`, `Stepper` (8-segment rail), `WizardHead`, `WizardFoot`. Step rail clicks jump to step (powers Step 8's Edit affordance later).
- **`CelebrationCard.jsx`** — single primitive used by Step 2 + Step 3 (and Step 5 in batch 3). Card UI variant only; manuscript variant skipped per PM ruling. Reads `{ chapter, reason }` beats from the §8.2.1 payload. Opening line is opt-in per caller.
- **`Step1Identity.jsx`** — three name fields + gender chips. Use-name affordance fires when `payload.name !== payload.setup_name` (resolves to Keep / Revert / Write something new). Pronoun for the affordance copy uses `state.gender`; defaults to "they" defensively.
- **`Step2Ancestry.jsx`** — race + subrace + ancestry feat. Manual mode fetches feats from `/api/progression/ancestry-feats/:race?tier=1`. Handoff mode locks all three with celebration card above. Locked-feat render is graceful when API hasn't loaded or feat ID isn't in the list (renders feat name as text rather than a broken dropdown).
- **`Step3Theme.jsx`** — manual-mode dropdown of all 21 themes (Knight + Haunted One INCLUDED — they're only excluded from Prelude emergence per Decision D, not from manual-mode selection). Selected theme detail card with identity + description + signature skills + gold modifier. Knight of the Order callout paragraph (§5.3.5 verbatim) renders only on manual mode for Knight.
- **`Step4ClassCalling.jsx`** — class picker + class detail card. Narrative-continuity card (handoff only) renders above when `themeId in THEME_NARRATIVE_CONTINUITY`. Dismissable via "✕" — local-session-scoped, resets on theme change. Subclass + L1 mechanical picks render placeholders (real per-class wiring lands in batch 3).
- **`CharacterCreatorV2.jsx`** — shell. Mode determined by `preludePayload` presence. Initial state seeded from §8.2.1 payload fields. Steps 5–8 render `<PlaceholderStep>` until batch 3.

### Content data file (new)

- **`client/src/data/themeNarrativeContinuity.js`** — 19 entries verbatim from spec §5.4.5. Knight + Haunted One absent per Decision D (cannot arrive via handoff).

### Step 2 celebration card — structural reorder (spec deviation, annotated)

Spec §5.2.5's prose template orders **opening → beats → race → feat**. Implementation reorders to **opening → beats → feat (the outcome the beats causally justify) → race line as a quieter italic confirmation below**. Reasoning: `[ANCESTRY_HINT]` markers explain why this *feat* emerged; race was committed at setup-wizard time and didn't move during the Prelude. Visually parenting the beats under the feat is more honest about marker semantics. Spec §5.2.5 annotated inline acknowledging the reorder.

### Wording cleanup from review pass

Three near-identical "years that shaped you" phrases were stacked within visual range on Steps 2 + 3. Collapsed to:
- Eyebrow marker: "From your Prelude" (was "From the years that shaped you")
- Per-step opening: opt-in, focused. Step 2: "These moments named your heritage gift:". Step 3: "These moments brought you to your theme:". The redundant "In the years that shaped you, you:" lead-in is gone.
- Step 3 lockTag: "Locked from the Prelude" (matches Step 2). Was "Committed during the years that shaped you".

Step 1 subtitle changed from the design mockup's "Two anchors — a name and a presence" (a poetic stand-in for gender that read as ambiguous) to spec-faithful "A name and a gender — the two anchors the rest of the creator references when it speaks about you."

### Preview affordance in App.jsx

`?creator=v2` opens the new creator in manual mode for visual review. `?creator=v2&handoff=1` simulates handoff using a built-in `PREVIEW_HANDOFF_PAYLOAD` (Verena Ashfall — Variant Human Soldier, Fighter class suggestion, full chapter beats). "Exit preview" strips the params and reloads. Removed when 5.K wires the new creator into the home page as the only path.

### Intentional deferrals (batch 3)

- **`'creating'` phase persistence.** Spec §6.2 wants manual-mode to write a `creation_phase='creating'` row on Step 1 advance. Migration shipped in 5.A; the persistence wiring is contracted with Step 8 submit + the home page resume flow, both batch 3.
- **Step 4 subclass + L1 mechanical picks.** Render placeholder. Real wiring needs per-class subclass-pick level + fighting style options + cantrip allotments — batch 3 alongside Step 5.
- **Save / resume routing, validation aggregation, mode coherence** (spec §6.1, §6.3, §6.4) — batch 3.

### Files

- `client/src/styles/creator-theme.css` (new, ~580 LOC editorial design tokens)
- `client/index.html` (Google Fonts links)
- `client/src/main.jsx` (imports creator-theme.css)
- `client/src/App.jsx` (preview affordance + fixture payload)
- `client/src/components/creator/CharacterCreatorV2.jsx` (new)
- `client/src/components/creator/creatorPrimitives.jsx` (new)
- `client/src/components/creator/CelebrationCard.jsx` (new)
- `client/src/components/creator/Step1Identity.jsx` (new)
- `client/src/components/creator/Step2Ancestry.jsx` (new)
- `client/src/components/creator/Step3Theme.jsx` (new)
- `client/src/components/creator/Step4ClassCalling.jsx` (new)
- `client/src/data/themeNarrativeContinuity.js` (new — 19 verbatim entries)
- `PHASE_2_CREATOR_SPEC.md` (annotation in §5.2.5)

### Verification

- Vite build clean (1.24s, +22KB bundle from new components + content)
- 1996 prelude + chunk 5 assertions still green (no regressions)
- Visual review by PM at Step 4 completion ✅

## [1.0.0.109] - 2026-05-02 — Phase 2 chunk 5 batch 1: Migration + payload reshape + content data files

Foundation pieces for chunk 5 (rebuilt main creator). Lands the data-model deltas, the §8.2.1 payload contract, and the six PM-authored content data files. The 8-step React component tree, redesigned home page, and Screen 2 path choice are batch 2 + 3 work — gated on this batch shipping.

### Migration 049 (`creator_creating_phase_and_heirlooms.js`)

Two changes per spec §8.1:

- **`creation_phase` enum gains `'creating'`.** Manual-mode mid-creator-flow characters write this value when Step 1 advances. Final conceptual enum: `'active' | 'creating' | 'ready_for_primary'`. The column is unconstrained `TEXT DEFAULT 'active'` — no CHECK constraint, so the enum is project convention enforced at the application layer. Migration carries no DDL for the new value, only documentation.
- **New `prelude_canon_heirlooms` table.** Schema per spec §8.1.2 — `id, character_id (FK ON DELETE CASCADE), name, type, specific_item_ref, description, awakening_hook, acquired_at_age, acquired_at_chapter, status DEFAULT 'candidate', created_at`. Index on `(character_id, status)`.

### Heirloom producer DEFERRED (PM Option A)

The `[OBJECT_HINT]` marker discussed in earlier-batch design conversations was never speced into v4 and never implemented in chunks 1–4. Chunk 4's marker set is `STAT_HINT / SKILL_HINT / CLASS_HINT / THEME_HINT / ANCESTRY_HINT` (`VALUE_HINT` was dropped).

Chunk 5 lands the **consumer side**:
- Migration creates the table.
- Step 6 handoff-mode consumer renders empty-state when no candidates exist (legitimate per spec §5.6.3 "graceful degradation").
- Manual-mode heirloom authoring writes directly to `characters.inventory` JSON with `is_heirloom=true`/`heirloom_description`/`awakening_hook`. Unaffected by deferral.

The producer-side mechanism (play-time marker / post-Prelude extraction / hybrid) is its own scoped piece of design work. Annotations added inline in `PHASE_2_CREATOR_SPEC.md` §8.1.2 + §5.6.3 and `PRELUDE_IMPLEMENTATION_PLAN.md` §5d so future readers see the gap is intentional, the consumer is ready, and the producer choice is open. Parking-lot entry queued for `CONSOLIDATED_TODO.md`.

### Pre-fill payload contract reshape (schema_version 1 → 2)

`preludeTransitionService.buildHandoffPayload()` rewritten to emit the §8.2.1 flat shape. Old `locked{}/suggested{}/canon{}/biography{}` wrappers dropped — those were a chunk 2 stop-gap shape, no longer worth maintaining now that the new creator is in flight. Per PM ruling: producer reshapes once; existing-creator stop-gap consumer reshaped in the same change; no backwards-compat shim warranted because chunk 5 replaces the existing creator anyway.

**Required §8.2.1 fields (top-level):** `setup_name`, `name`, `gender`, `race`, `subrace`, `committed_theme`, `theme_chapter_beats`, `ancestry_feat_id`, `ancestry_chapter_beats`, `class_suggestion`, `accepted_stat_bumps`, `accepted_skill_bumps`, `heirloom_candidates`, `biography_seed`, `canon_npcs`, `canon_locations`, `canon_threads`, `mentor_imprint_eligible`.

**Helper fields chunk 5 also needs (top-level, documented as such):** `class_score`, `ancestry_score`, `departure_summary`, `home_region`, `home_setting`, `authority_figure`, `authority_label`, `mentor_imprint_id`, `canon_fact_count`, `name_parts: { first_name, last_name, nickname }`.

**New helpers** in `preludeTransitionService.js`:
- `pickThemeChapterBeats()` — mirror of `pickAncestryChapterBeats` for committed-theme `[THEME_HINT]` reasons. Both delegate to a shared `pickChapterBeatsByKind()`.
- `buildAcceptedStatBumps()` — projects `kind='stat'` emergences as per-fire `{ stat, magnitude, chapter, chapter_beat }` (no aggregation; the +2-per-stat creator clamp is consumer-side per spec §5.5.5).
- `buildAcceptedSkillBumps()` — projects `kind='skill'` emergences as `{ skill, chapter, chapter_beat }`.
- `composeName()` — joins setup/character first+last into a single string (used for `setup_name` and effective `name`).

Old `aggregateStatBonuses()` / `aggregateSkills()` helpers removed — dead code after the reshape (they returned the old `{str, dex, ...}` map / bare-skill-name array shape that nothing reads now).

**`biography_seed` is structured array.** `[ { age, chapter, text }, ... ]` mapped from `character_biography` rows (`origin_age` → `age`, `origin_chapter` → `chapter`, `body` → `text`). The flattened-string projection moves from server to client — `CharacterCreationWizard` flattens inline for its single backstory textarea; chunk 5's new creator will render entries natively.

**`mentor_imprint_eligible` boolean** added: true when `setup.authority_figure='mentor'` AND a `prelude_canon_npcs` row with `relationship='mentor'` exists. Independent of `mentor_imprint_id` (which records whether seeding actually happened — null on refresh runs even when eligible).

**`[USE_NAME]` fallback.** Spec §8.2.1 references a `[USE_NAME]` marker for an effective-name override; the marker isn't implemented in v4 / chunk 4. Until it is, effective `name` falls back to the character's persisted first/last name. Documented inline in `buildHandoffPayload`.

**Consumers updated in the same commit:**
- `PreludeTransitionScreen.jsx` — reads top-level `canon_npcs/canon_locations/canon_threads`, `accepted_stat_bumps/accepted_skill_bumps` (with stat-totals computed inline for display), `theme_chapter_beats` (renders alongside ancestry beats with appropriate framing).
- `CharacterCreationWizard.jsx` (existing creator pre-fill block, ~line 224-310) — reads new shape, flattens biography_seed inline for the backstory textarea, drops the suggested-Identity-Details fields that were always null in the old shape (chunk 5's Step 7 sources those from `client/src/data/themePersonalityPrompts.js` etc., not from Prelude emergence).

### Six content data files (`client/src/data/`)

Verbatim transcription from spec §7. PM authored ~1100 lines of in-fiction starter content; this commit gets it into the bundle.

| File | Spec § | Entries | Shape |
|---|---|---|---|
| `themeGoldModifiers.js` | §7.1 | 21 | `{ themeId: number }`, +0.50 to −0.50 in 0.05 steps. Plus `applyGoldModifier(baselineGp, themeId)` helper (half-up rounding per §7.1.4). |
| `themePersonalityPrompts.js` | §7.2 | 21 × 3 = 63 | `{ themeId: [{ text, alignment }] }` |
| `themeIdealsPrompts.js` | §7.3 | 134 (4-7/theme) | Same shape. Full 9-square coverage per Decision 5; evil-axis prompts written as character commitments held by people who think they're doing right. |
| `themeBondsPrompts.js` | §7.4 | 126 (4-6/theme) | Same shape. Bracketed placeholders preserved verbatim ([the village that raised you], [the elder], etc.). Note: §7.4 has no CG/CE entries per Open PM call §8.6 (deferred to later content pass if playtest surfaces a need). |
| `themeFlawsPrompts.js` | §7.5 | 106 (4-6/theme) | Same shape. Flaws written as recognizable human limitations rather than villain credentials per §7.5.2. |
| `themeBackstoryMoments.js` | §7.6 | 21 × 8 = 168 | `{ themeId: [string] }` — bare strings, NO alignment field per Decision 4 (events ≠ commitments). Bracketed placeholders preserved. |

### Files

- `server/migrations/049_creator_creating_phase_and_heirlooms.js` (new)
- `server/services/preludeTransitionService.js` (reshape — `pickThemeChapterBeats`, `buildAcceptedStatBumps/SkillBumps`, `buildHandoffPayload` v2 shape, testkit exports for unit testing)
- `client/src/components/PreludeTransitionScreen.jsx` (consumer reshape)
- `client/src/components/CharacterCreationWizard.jsx` (consumer reshape — pre-fill block at lines 224-310)
- `client/src/data/themeGoldModifiers.js` (new)
- `client/src/data/themePersonalityPrompts.js` (new)
- `client/src/data/themeIdealsPrompts.js` (new)
- `client/src/data/themeBondsPrompts.js` (new)
- `client/src/data/themeFlawsPrompts.js` (new)
- `client/src/data/themeBackstoryMoments.js` (new)
- `tests/migration-049.test.js` (new — 19 assertions)
- `tests/payload-contract.test.js` (new — 70 assertions)
- `tests/theme-content-data.test.js` (new — 1284 assertions)
- `PHASE_2_CREATOR_SPEC.md` (annotations — §8.1.2, §5.6.3 producer-deferred notes)
- `PRELUDE_IMPLEMENTATION_PLAN.md` (annotation — §5d producer-deferred note + acknowledgment that earlier-batch OBJECT_HINT discussion was never speced)

### Test sweep

| Suite | Result |
|---|---|
| `tests/prelude-setup.test.js`               | ✅ 59 passed |
| `tests/prelude-arc.test.js`                 | ✅ 15 passed |
| `tests/prelude-markers.test.js`             | ✅ 140 passed |
| `tests/prelude-prompt.test.js`              | ✅ 180 passed |
| `tests/prelude-violation-detection.test.js` | ✅ 91 passed |
| `tests/prelude-canon-threads.test.js`       | ✅ 21 passed |
| `tests/prelude-auto-model.test.js`          | ✅ 33 passed |
| `tests/prelude-theme-commitment.test.js`    | ✅ 59 passed |
| `tests/prelude-transition.test.js`          | ✅ 25 passed |
| `tests/migration-049.test.js` (new)         | ✅ 19 passed |
| `tests/payload-contract.test.js` (new)      | ✅ 70 passed |
| `tests/theme-content-data.test.js` (new)    | ✅ 1284 passed |

**Total:** 1996 assertions green (623 existing + 1373 new). Vite build clean.

### Notes

- The data files use direct JS object exports rather than separate JSON files because the alignment-tagged shape benefits from JS comments documenting Decision 3/4/5 in-source. Bundle size impact is small — the prompt/moment text was already going to ship somewhere.
- Smoke test verifies counts, all 21 themes present, alignment indicators valid 9-square, bracketed placeholders preserved on spot-check entries. Word-by-word transcription is a manual read job; not automated.
- Migration is idempotent (`CREATE IF NOT EXISTS` + `INSERT OR REPLACE` patterns elsewhere). Applies cleanly on fresh DB and on existing user data per the 19-assertion test.

## [1.0.0.108] - 2026-05-01 — Phase 2 follow-up: ANCESTRY_HINT reason as celebration beats

Small post-Phase-2 patch from a design clarification surfaced during PM's per-step creator spec walkthrough. The chunk-5 creator's locked-feat celebration card needs to render past-tense narrative bullets justifying why play pointed at this ancestry feat. The infrastructure for that — `reason` field captured + persisted with chapter context — already shipped in chunk 4. This patch adds (a) explicit prompt-side style guidance for what makes a *good* reason, and (b) handoff-payload surfacing of the chapter beats so chunk 5 (and the gap-window transition screen) can render them.

### Race reconciliation — no-op

PM's "race system reconciliation" instructions in this clarification round turned out to be a no-op against current `races.json`. Drow is already not a standalone playable race; "Drow Descent" already exists as a Half-Elf subrace; the canonical race list matches the current data. PM withdrew the reconciliation request after I surfaced the actual data shape. The ancestry feat list_id `drow` and the `[ANCESTRY_HINT]` slug convention stay as-is.

### Rule 15d-bis — ANCESTRY_HINT reason style guidance (chunk 3 patch)

`preludeArcPromptBuilder.js` Rule 15d-bis added immediately after the slug-convention rule. Tells the AI:

- The `reason` field is NOT optional flavor — it's load-bearing for the locked-feat celebration card at character creation.
- Style: past-tense, single clause, names + actions (not abstractions), chapter-aware tone (Ch1 smaller/domestic, Ch3 stakes), no mechanic-talk, no DM-speak, no interpretive tail.
- Worked good examples: *"Held the line when Brella was wounded, took a club to the ribs and didn't fall."*
- Worked bad examples: *"Demonstrated resilience and physical endurance"* / *"Showed strong CON-based behavior pattern"*.
- Same `feat_id` firing across multiple chapters is expected — the system picks the best 2-3 across chapters for the celebration; aim for one good reason per fire.

### Chapter beats in the handoff payload (chunk 2 patch)

`preludeTransitionService.js` adds `pickAncestryChapterBeats(characterId, winnerFeatId)` — reads `prelude_emergences` rows where `kind='ancestry'` AND `target=winnerSlug` AND `reason` is non-empty, picks ONE beat per chapter (the most recent fire within each chapter), orders chronologically Ch1 → Ch2 → Ch3, caps at 3.

The result is surfaced in the handoff payload at `locked.ancestry_chapter_beats` — array of `{ chapter, reason }`. Chunk-5 creator reads this for the celebration card; for the gap window between chunks 2 and 5, `PreludeTransitionScreen.jsx` renders the same data as bullets under "Across your Prelude, you showed:" with chapter tags `(Ch1)` / `(Ch2)` / `(Ch3)`.

### Selection rule (engineering call from PM's "you can refine")

PM's intuition: "top 3 by chapter weight, ordered chronologically (Ch1 → Ch2 → Ch3) so the bullets tell a small arc." Refined to: **one beat per chapter MAX**, taking the LAST fire within each chapter (most recent fires are usually the most concrete beats; earlier fires happen as the player is still feeling out the affinity). This caps total beats at 3 (Ch1 + Ch2 + Ch3) and prevents Ch3-domination from repeated fires of the same feat in the climax chapter.

### Files

- `server/services/preludeArcPromptBuilder.js` — added Rule 15d-bis (style guidance for `reason`).
- `server/services/preludeTransitionService.js` — added `pickAncestryChapterBeats()` helper; wired into `executeTransition()`; surfaced in `buildHandoffPayload()` at `locked.ancestry_chapter_beats`.
- `client/src/components/PreludeTransitionScreen.jsx` — renders the chapter beats as bullets in the emergence summary card.
- `tests/prelude-prompt.test.js` — added 8 assertions for Rule 15d-bis (heading + load-bearing framing + style markers + worked examples).

### Test sweep

| Suite | Result |
|---|---|
| `tests/prelude-setup.test.js`               | ✅ 59 passed |
| `tests/prelude-arc.test.js`                 | ✅ 15 passed |
| `tests/prelude-markers.test.js`             | ✅ 140 passed |
| `tests/prelude-prompt.test.js`              | ✅ 180 passed (+8 for Rule 15d-bis) |
| `tests/prelude-violation-detection.test.js` | ✅ 91 passed |
| `tests/prelude-canon-threads.test.js`       | ✅ 21 passed |
| `tests/prelude-auto-model.test.js`          | ✅ 33 passed |
| `tests/prelude-theme-commitment.test.js`    | ✅ 59 passed |
| `tests/prelude-transition.test.js`          | ✅ 25 passed |

**Total:** 623 prelude assertions green. Vite build clean.

### Notes

- Existing `prelude_emergences` rows from prior preludes have null/empty `reason` for some ancestry hints (the AI wasn't yet given Rule 15d-bis style guidance). The selection helper filters those out (`AND reason IS NOT NULL AND TRIM(reason) <> ''`); old preludes will surface fewer beats than newly-played ones. Acceptable degradation — no migration needed.
- The `pickAncestryChapterBeats` query is read-only; idempotent re-runs of `executeTransition` (e.g., a manual POST `/transition` retry) refresh the beats automatically without regenerating the biography.

## [1.0.0.107] - 2026-05-01 — Phase 2 chunk 2: Transition service + handoff

Final Phase 2 engineering chunk. Wires the Prelude → Primary handoff that closes the loop on Phase 1's reframe — `[PRELUDE_END]` now actually does something. Transition state, biography seeding, mentor imprint, home-page resume hook, and the (iv) preludePayload pre-fill into the existing creator all ship here. Phase 2 closes; chunk 5 (rebuilt main creator) remains gated until the per-step spec lands.

### Migration 048

Three additions:
- **`character_biography` table** — appendable per-character biography entries. Phase 2 seeds entries from the Prelude (`entry_type='seeded_from_prelude'`); main-campaign-side append flows ship in later phases. Per Decision A3 option (ii).
- **`mentor_imprints` table** — seeded at handoff when `authority_figure='mentor'` AND a `[NPC_CANON: relationship='mentor']` row exists. Mentor relationship arrives at the main campaign with prior history. Per PRELUDE_IMPLEMENTATION_PLAN rule #23 (the rule Phase 0 flagged as design-only-until-Phase-2 — this migration is the Phase-2 implementation).
- **`characters.prelude_handoff_payload` JSON column** — the rich pre-fill blob the existing creator reads on resume.

### `creation_phase` intermediate state

Phase 2 Decision C lands. New value `'ready_for_primary'` between `'prelude'` and `'active'`. Lifecycle:
- New character: `'prelude'` (set when Prelude begins)
- `[PRELUDE_END]` fires: `'prelude'` → `'ready_for_primary'`
- Main creator submit: `'ready_for_primary'` → `'active'`

Lets the player close the browser between Prelude end and creator submit and resume later without losing Prelude play. CLAUDE.md updated to reflect the three-state shape.

### `preludeTransitionService.js` (new)

`executeTransition(characterId)` is the handoff workhorse. Idempotent:
- Already `'active'` → no-op (returns existing payload).
- Already `'ready_for_primary'` → refreshes payload, does NOT regenerate biography.
- `'prelude'` → first transition: aggregates emergences (chapter-weighted class/ancestry winners + accepted stat/skill rows), reads canon NPCs/locations/threads/facts, reads committed theme + arc plan, calls Opus for the biography seed, writes `character_biography` rows, seeds `mentor_imprints` when applicable, persists the rich payload, flips `creation_phase`.

Biography seed generation: 4–6 timestamped second-person entries written as the adult character looking back, with allowed gentle distortion. Replaces the v1.0.73 single-blob backstory output with the living biography per Phase 1 Decision 3.

Cross-chunk surface: chunk 4's `prelude_canon_threads` rows are read here and pointed at by the handoff payload. Actual transfer of threads → `campaign_threads` happens at primary-campaign creation downstream of the existing creator's submit (out of scope for chunk 2; chunk 5 / chunk 7 territory).

### Marker handling — `[PRELUDE_END]` + `[DEPARTURE]`

Both detected in [preludeMarkerDetection.js](server/services/preludeMarkerDetection.js) and wired through [preludeSessionService.processMarkers()](server/services/preludeSessionService.js). `[PRELUDE_END]` triggers `executeTransition`; failures are caught and surfaced to the client in the `results.preludeEnd` payload (status='error') so the session message-flush still completes cleanly. Both markers are stripped from displayed narrative.

### API endpoints (server/routes/prelude.js)

- **GET `/api/prelude/:id/handoff-payload`** — returns the persisted handoff payload for a character in `'ready_for_primary'` or `'active'` phase. 404 if still in prelude.
- **POST `/api/prelude/:id/transition`** — manually trigger the transition for recovery / QA flows (idempotent).
- **GET `/api/prelude/:id/biography`** — returns `character_biography` entries for the character.

### `PreludeTransitionScreen.jsx` (new)

Renders the post-`[PRELUDE_END]` summary screen per PRELUDE_IMPLEMENTATION_PLAN.md §7a. Surfaces:
- Biography seed entries with age + chapter timestamps
- Canon NPCs (with relationship + status + age at prelude end)
- Canon locations (with home flag)
- Long-term threads the world will hold (kind + weight + ripening condition)
- Emergence summary (stat bonuses, skills, class/theme/ancestry trajectories)
- Mentor imprint surfaced when seeded

CTA: "Begin character creation" → launches `CharacterCreationWizard` with the handoff payload as the `preludePayload` prop.

### CharacterCreationWizard.jsx (iv) preludePayload pre-fill

Per A2a option (iv). New `preludePayload` prop. When set without `editCharacter`, the wizard:
- Pre-fills name parts, gender, race/subrace, suggested class (from `[CLASS_HINT]` tally), suggested alignment/lifestyle (placeholders for chunk 5), emerged personality fields, physical-detail emergences, and the flattened biography text into the `backstory` textarea.
- Submits via PUT to `/api/character/{character_id}` with `creation_phase='active'` rather than POSTing a new row. Preserves all FK references from the prelude phase (`prelude_emergences`, `prelude_canon_*`, `character_biography`).

Theme + ancestry feat are NOT pre-filled in the existing creator — chunk 5's rebuilt creator handles those with the locked-with-celebration affordance per Decision B. This was the explicit (iv) acceptance: "fields the existing creator can't consume just don't get pre-filled and the player fills them in manually like a normal character."

The `backstory` textarea is a one-way mirror of `character_biography`. The table is canonical; edits to the textarea during the gap window between chunks 2 and 5 do not round-trip back to the table. Code comment near the projection logic documents this.

### Home-page resume hook (CharacterManager.jsx)

Per the agreed UX gap fix. ~50 lines of additions on the existing home page (no redesign — that's chunk 5):
- New state `preludeTransitionCharacter` and `handoffPayload`.
- Card click handler routes `'ready_for_primary'` characters into `PreludeTransitionScreen` (no transition screen re-show on resume — always-skip preserved by reading the persisted payload, never re-firing `executeTransition`).
- New "✦ Finish creating" badge on the card. New italic subtitle "Prelude complete — finish creating".
- `CharacterCreationWizard` mount accepts `preludePayload`; success dispatches via `onCharacterUpdated` (handoff finalize is an update of the prelude row, not a new character).

### `character.js` PUT route

Added `creation_phase` to the allowedFields list so the (iv) flow can flip `'ready_for_primary'` → `'active'` at submit.

### Files

- **NEW** `server/migrations/048_prelude_handoff.js`
- **NEW** `server/services/preludeTransitionService.js`
- **NEW** `client/src/components/PreludeTransitionScreen.jsx`
- **NEW** `tests/prelude-transition.test.js`
- `server/services/preludeMarkerDetection.js` — added `detectDeparture()` + `detectPreludeEnd()`; updated roll-up; strip regex extended.
- `server/services/preludeSessionService.js` — wired `[DEPARTURE]` + `[PRELUDE_END]` handlers; calls `executeTransition` on prelude-end fire.
- `server/routes/prelude.js` — added GET `/handoff-payload`, POST `/transition`, GET `/biography`.
- `server/routes/character.js` — added `creation_phase` to PUT allowedFields.
- `client/src/components/CharacterCreationWizard.jsx` — new `preludePayload` prop + handoff-mode submit (PUT with `creation_phase='active'`).
- `client/src/components/CharacterManager.jsx` — transition screen routing, card click handler for `'ready_for_primary'`, "Finish creating" badge.
- `CLAUDE.md` — `creation_phase` enum updated to three values; handoff transition flow documented.

### Test sweep

| Suite | Result |
|---|---|
| `tests/prelude-setup.test.js`               | ✅ 59 passed |
| `tests/prelude-arc.test.js`                 | ✅ 15 passed |
| `tests/prelude-markers.test.js`             | ✅ 140 passed |
| `tests/prelude-prompt.test.js`              | ✅ 172 passed |
| `tests/prelude-violation-detection.test.js` | ✅ 91 passed |
| `tests/prelude-canon-threads.test.js`       | ✅ 21 passed |
| `tests/prelude-auto-model.test.js`          | ✅ 33 passed |
| `tests/prelude-theme-commitment.test.js`    | ✅ 59 passed |
| `tests/prelude-transition.test.js`          | ✅ 25 passed (new — DEPARTURE + PRELUDE_END detection + roll-up + strip) |

**Total:** 615 prelude assertions green. Vite build clean.

### What ships in production

End-to-end Prelude → existing-creator-with-pre-fill is functional:
1. Player completes Prelude setup → arc preview → 4 sessions of play
2. `[DEPARTURE]` and `[PRELUDE_END]` fire at the close of Ch3b
3. Transition service runs: biography seeded, payload persisted, phase flipped
4. Player exits or stays
5. Home page shows "Finish creating [name]" card
6. Click → transition screen surfaces summary
7. "Begin character creation" → existing creator, pre-filled with handoff payload
8. Submit → creator PUTs with `creation_phase='active'`
9. Character appears in normal "Your Characters" list, ready for main play

### Out of scope (chunk 5 territory)

- Locked-with-celebration UI for theme and ancestry feat in the creator — chunk 5's rebuild handles these with the proper affordance.
- AI-introduced use-name with revert affordance on Step 1 — chunk 5.
- Empty-state home page redesign + section-based "Your characters" / "In progress" structure — chunk 5.
- Canon NPC/location/thread → `npcs` / `locations` / `campaign_threads` actual transfer at primary-campaign creation — happens downstream when the campaign is generated; chunk 5 or chunk 7 territory.
- Living biography UI (Origin & Identity tab) — out of scope for the creator rebuild per Decision B; separate design pass.

**Phase 2 closes here. Phase 3 (AI Narrative Persistence foundation refactors) is the next phase per CONSOLIDATED_TODO.md.**

## [1.0.0.106] - 2026-05-01 — Phase 2 chunk 3: Prompt builder

Third Phase 2 engineering chunk. Reframes the Opus arc-plan generator and the per-turn Sonnet prompt around the locked tone description, the three-chapter shape, and the new setup fields (authority figure + free-text origin). Closes the chunk-1 graceful-degrade window for `talents` / `cares` / `tone_tags`. Chunk 2 (transition service) is the only Phase 2 chunk remaining.

### Locked tone description

New module `server/data/preludeToneDescription.js` exports the three-paragraph "epic fantasy in a lived-in world" description Phase 1 Decision 3 (sub-deliverable) locked in. Replaces the v1.0.73 four-preset selector and the v1.0.72 16-tag combinable system. The locked description is injected into both the Opus arc-plan prompt and the Sonnet per-turn prompt at the position previously occupied by tone-preset injection.

The shelter-behavior corrective ("the protagonist's age affects what they understand and how they feel, not what the world is willing to do to them") lives in paragraph 2 of the description — at tone-setting altitude rather than as a separate Cardinal Rule. Phase 4's diagnostic tests whether this elevation is sufficient; if not, prompt-engineering work follows.

### Three-chapter arc-plan generation

`preludeArcService.js` now generates a 3-chapter plan (Ch1 Childhood, Ch2 Adolescence, Ch3 Threshold). The departure_seed moves from `chapter_4_arc` to `chapter_3_arc`, alongside two new Ch3-specific fields the Sonnet prompt consults:

- **`irreversible_act_shape`** — described WITHOUT naming a theme; the act lands before the theme commitment ceremony per Phase 1 Decision 4.
- **`theme_commitment_handoff`** — describes the aftermath state in which `[THEME_COMMITMENT_OFFERED]` will surface.

`chapter_2_arc` gains `intra_age_jump_seed` per Phase 1 Decision 5 — Sonnet's intra-Ch2 `[AGE_ADVANCE]` splits the session into two emotional registers (e.g., 11-13 then 13-15).

The `chapter_4_arc`, `tone_tags`, and `tone_reflection` columns on `prelude_arc_plans` stay in schema (additive-only) but are written `NULL` for new preludes. Legacy 4-chapter plans remain readable via `getArcPlan` for old prelude characters.

### Setup field injection — `authority_figure` + `origin_freeform`

Per Decision A, both fields shape the arc:

- **`authority_figure`** (8-value enum from chunk 1). The Opus prompt receives explicit per-value instructions:
  - `mentor` → seed a mentor figure in `home_world.locals` and at least one Ch1/Ch2 establishing beat. Mentor becomes the `mentor_imprints` seed at chunk 2's handoff.
  - `captor` → captivity arc; Ch1 and Ch2 unfold under captivity; departure flows from captivity ending.
  - `sibling` → load-bearing sibling in Ch1 with own pressures.
  - `rival` → rival prominently seeded in Ch1-2.
  - `employer` → home is partly the workplace.
  - `none` → PC raised themselves; home is more chaos than structure.
  - `parent` / `guardian` → no special instruction; fits default home shape.
- **`origin_freeform`** — when present, injected with explicit "honor this over conflicting curated answers" instruction. Verbatim text rendered; not paraphrased.

### Prompt builder updates (`preludeArcPromptBuilder.js`)

- Cardinal Rule 5 ("AGE-APPROPRIATE EVERYTHING") removed; directive moved to tone description per Decision 3 sub-deliverable.
- Cardinal Rule 5 (engagement mode) renumbered from 5a; chapter-of-3 / session-of-4 boilerplate updated throughout.
- Cardinal Rule 11/11a session budget rewritten — three-chapter shape, intra-Ch2 age-jump guidance, three-beat Ch3 sequencing (irreversible act → theme commitment → departure as distinct scene weights).
- Cardinal Rule 13 (roll surfacing) updated to "Ch 1-2 tutorial / Ch 3 fluent" gate (was Ch 1-2 / Ch 3-4).
- Cardinal Rule 14 (TONE FIDELITY) rewritten to reference the locked tone description's structure rather than the four-preset bibles; explicit "don't soften consequences because the protagonist is young" directive surfaced.
- Cardinal Rule 16 ("don't invent character traits") canon list updated — talents/cares/tone removed; authority figure + Q10 free-text added.
- **NEW Cardinal Rule 15c** — `[CANON_THREAD]` calibration block per PRELUDE_IMPLEMENTATION_PLAN.md §5h. Explicit kind/weight enums, ✓/✗ examples, "err toward fewer-and-heavier" discipline.
- **NEW Cardinal Rule 15d** — `[ANCESTRY_HINT]` `feat_id` slug convention (`${list_id}_t${tier}_c${choice_index}`). Cross-cuts with chunk 4's server-side validator.
- CHARACTER block: `talents` / `cares` / `tone preset` lines removed; authority-figure line + conditional Q10 block added.
- MARKERS section: `[VALUE_HINT]` removed; `[CANON_THREAD]` added; `[ANCESTRY_HINT]` updated to slug convention.

### `preludeThemeService.js` cleanup

Wildcard picker (which mapped `setup.talents` / `setup.cares` to themes) removed. Phase 1 Decision 3 simplified the theme commitment ceremony to "leading + 3 alternatives + choose-your-own" — no wildcard slot. The `wildcard` field on the offer payload returns `null` for Phase 2 callers; preserved in shape for backward-compat with any UI that still reads it. Chapter weights synced to chunk 4's three-chapter shape (Ch1=1×, Ch2=1.5×, Ch3=2×).

### Files

- **NEW** `server/data/preludeToneDescription.js` — locked 3-paragraph tone description + `buildLockedToneBlock()`.
- **NEW** `server/data/preludeWizardEnums.js` — server-side mirror of `SIBLING_OPTIONS` and `AUTHORITY_FIGURES` with `findSiblingOption` / `findAuthorityFigure` helpers.
- `server/services/preludeArcPromptBuilder.js` — full rewrite of CHARACTER block, tone block injection, Cardinal Rules 5 / 11 / 13 / 14 / 16, MARKERS section. Added 15c (CANON_THREAD calibration) and 15d (ANCESTRY_HINT slug convention).
- `server/services/preludeArcService.js` — `buildArcSystemPrompt` rewritten for 3-chapter shape with locked tone block injected. `buildArcUserPrompt` drops talents/cares/tone-tags; adds authority_figure + origin_freeform. `validateParsedPlan` updated to require chapter_3_arc.departure_seed (not chapter_4_arc). Insert writes NULL for legacy columns.
- `server/services/preludeThemeService.js` — wildcard picker removed; chapter weights updated to three-chapter shape; `wildcard: null` preserved in offer shape.
- `tests/prelude-prompt.test.js` — replaced 4-preset test blocks with locked-tone-description tests; added authority_figure + origin_freeform tests; updated boilerplate-count tests to 3-chapter / 4-session shape. Updated `makeSetup()` default to Phase 2 payload.
- `tests/prelude-theme-commitment.test.js` — relaxed "Choose Your Path" assertion to match Phase 2's "lightweight in-line commitment card" wording.

### Test sweep

| Suite | Result |
|---|---|
| `tests/prelude-setup.test.js`               | ✅ 59 passed |
| `tests/prelude-arc.test.js`                 | ✅ 15 passed |
| `tests/prelude-markers.test.js`             | ✅ 140 passed |
| `tests/prelude-prompt.test.js`              | ✅ 172 passed (+18 net for locked-tone / Q9 / Q10 / 3-chapter; -42 for old preset bibles) |
| `tests/prelude-violation-detection.test.js` | ✅ 91 passed |
| `tests/prelude-canon-threads.test.js`       | ✅ 21 passed |
| `tests/prelude-auto-model.test.js`          | ✅ 33 passed |
| `tests/prelude-theme-commitment.test.js`    | ✅ 59 passed |

**Total:** 590 prelude assertions green. Vite build clean.

### Out of scope

- Transition service (`[PRELUDE_END]` → `creation_phase = 'ready_for_primary'` flip; biography seed generation; canon NPC/location/thread transfer; mentor imprint seeding when authority_figure='mentor') — chunk 2.
- `PreludeTransitionScreen.jsx` UI + minimal home-page resume hook — chunk 2.
- Main creator pre-fill via `preludePayload` prop on existing `CharacterCreationWizard.jsx` — chunk 2.

## [1.0.0.105] - 2026-05-01 — Phase 2 chunk 4: Marker handling

Second Phase 2 engineering chunk. Wires the marker plumbing for the reframed Prelude — long-term thread seeding, ancestry-feat validation, chapter-promise gating, three-chapter tally weights, and `[VALUE_HINT]` removal. Chunks 3 (prompt builder) and 2 (transition service) follow.

### Migration 047 — `prelude_canon_threads` + `campaign_threads` tables

`prelude_canon_threads` persists `[CANON_THREAD]` markers fired during Prelude play (Phase 1 Decision 6 — DECISION_LOG 2026-04-29). Each thread is an unresolved obligation the world will hold across years of main-campaign time. Schema includes:

- `kind` enum (`unresolved_loss` / `blood_debt` / `unfulfilled_oath` / `unpaid_crime` / `unfinished_relationship` / `held_object` / `held_secret`)
- `subject_npc_id` / `subject_location_id` / `subject_text` (subject resolves to a `prelude_canon_npcs` or `prelude_canon_locations` row when the AI references an established entity; falls back to free text otherwise)
- `condition` (free text — what triggers the thread to ripen)
- `weight` enum (`minor` / `notable` / `major`)
- `status` enum (`active` / `ripened` / `resolved` / `decayed`)
- `created_at_age` / `created_at_chapter` / `session_id` for audit

`campaign_threads` is the handoff target. Chunk 2 (transition service) transfers active prelude threads into this table when the primary campaign is created. Schema mirrors `prelude_canon_threads` plus a `campaign_id` reference and `ripened_at_game_day` / `resolved_at_game_day` columns. Both tables ship together to keep migration numbering tight.

### `[CANON_THREAD]` marker — new

Detected in [preludeMarkerDetection.js](server/services/preludeMarkerDetection.js) (`detectCanonThreads()`); processed in `preludeSessionService.processMarkers()` against the new `preludeCanonThreadService.recordCanonThread()`. Subject resolution attempts NPC name match → location name match → free-text fallback. Invalid `kind` or `weight` values are rejected and surface as cap violations so the AI gets `[SYSTEM]` feedback. Strip regex covers display.

### `[ANCESTRY_HINT]` server-side validation — new

Per Decision A. Markers carry a `feat_id` slug in the form `${list_id}_t${tier}_c${choice_index}` (e.g. `dwarf_t1_c2`). The validator:

1. Maps the character's race → allowed ancestry list_id(s) (most races map 1:1; `aasimar` accepts all three paths until commitment; `drow` accepts whether stored as race or as elf subrace; `half-elf` / `half-orc` normalize to underscore form).
2. Parses the slug; rejects malformed shapes.
3. Confirms `(list_id, tier, choice_index)` resolves to an existing `ancestry_feats` row.
4. Rejects mismatched list_id (e.g. an elf trying to claim a dwarf feat).

Invalid hints are rejected; the session service surfaces them as cap violations. Tally degrades gracefully — rejected hints just don't accumulate. Chunk 3 will instruct the AI on the slug convention.

### Chapter-weighted tally — three-chapter shape

Phase 1 Decision 5: Ch1=1×, Ch2=1.5×, Ch3=2×. Updated `CHAPTER_WEIGHT` in [preludeEmergenceService.js](server/services/preludeEmergenceService.js). Ch4 stays mapped to 2× for any legacy hints from the old four-chapter shape — they tally the same as Ch3 hints (closest-living-stage match).

### `[CHAPTER_PROMISE]` — Ch1 rejection added

Per Phase 1 Decision 3. Chapter promises fire at Ch2 and Ch3 openings only (Ch1 is too young for self-reflection beats). Ch1 emissions are rejected and surfaced as cap violations rather than rendered to the UI; the AI gets `[SYSTEM]` feedback to stop firing them.

### `[VALUE_HINT]` removal

Per Phase 1 Decision 3 (values tracker cut). Detection function removed from `preludeMarkerDetection.js`; the `valueHints` field dropped from `detectPreludeMarkers()` roll-up. `recordValueHint` removed from `preludeEmergenceService.js`; session service no longer calls it. Strip regex stays so any legacy transcripts and stray AI emissions still clean up. The `prelude_values` table remains in schema but is no longer written.

### Files

- **NEW** `server/migrations/047_prelude_canon_threads.js` — `prelude_canon_threads` + `campaign_threads` tables, plus indices.
- **NEW** `server/services/preludeCanonThreadService.js` — `recordCanonThread`, `getActiveThreads`, `getAllThreads`, `setThreadStatus`, with `_internals` exporting the kind/weight/status enums for tests.
- **NEW** `tests/prelude-canon-threads.test.js` — enum integrity + presence checks (21 assertions).
- `server/services/preludeMarkerDetection.js` — added `detectCanonThreads()`; removed `detectValueHints()`; updated `detectPreludeMarkers()` roll-up; added `[CANON_THREAD]` strip regex.
- `server/services/preludeEmergenceService.js` — added `validateAncestryFeat()` + `allowedAncestryListIds()`; updated `recordAncestryHint()` to validate and return `invalid_feat` on rejection; updated `CHAPTER_WEIGHT` to three-chapter shape; removed `recordValueHint()`.
- `server/services/preludeSessionService.js` — wired `[CANON_THREAD]` recording with cap-violation surfacing; wired ancestry-validation rejections into the cap-violation list; added Ch1 chapter-promise rejection; removed `[VALUE_HINT]` processing.
- `tests/prelude-markers.test.js` — replaced `VALUE_HINT` test block with a `CANON_THREAD` test block; added `CANON_THREAD` strip assertion. Net +10 assertions.

### Test sweep

| Suite | Result |
|---|---|
| `tests/prelude-setup.test.js`               | ✅ 59 passed |
| `tests/prelude-arc.test.js`                 | ✅ 15 passed |
| `tests/prelude-markers.test.js`             | ✅ 140 passed (+10 net) |
| `tests/prelude-prompt.test.js`              | ✅ 190 passed |
| `tests/prelude-violation-detection.test.js` | ✅ 91 passed |
| `tests/prelude-canon-threads.test.js`       | ✅ 21 passed (new) |
| `tests/prelude-auto-model.test.js`          | ✅ 33 passed |
| `tests/prelude-theme-commitment.test.js`    | ✅ 59 passed |
| `tests/marker-detection.test.js`            | ✅ 128 passed (DM-side smoke) |
| `tests/marker-schemas.test.js`              | ✅ 49 passed |

**Total:** 785 prelude assertions green; 177 DM-side marker assertions green. No regressions. Vite build clean.

### Out of scope

- Ancestry-feat slug DB-integration test (validator queries `ancestry_feats`). Pure-logic enum check shipped; full DB round-trip exercised by chunk 3 prompt-builder tests when the AI emits actual slugs against the prompt convention.
- Prompt-builder updates that instruct the AI on the `[CANON_THREAD]` calibration examples (§5h of PRELUDE_IMPLEMENTATION_PLAN.md), the slug convention for `[ANCESTRY_HINT]`, and the new tone description — all chunk 3.

## [1.0.0.104] - 2026-05-01 — Phase 2 chunk 1: Setup wizard rebuild

First Phase 2 engineering chunk. Rebuilds the Prelude setup wizard from 11 questions to 10 per DECISION_LOG 2026-04-30 Decision A. Other chunks (marker handling, prompt builder, transition service) follow.

### Setup wizard content changes

- **Cut Q9 (talents).** Pre-loaded class/theme expectations against Phase 1's "play sets the character" principle.
- **Cut Q10 (cares).** Seeded the values tracker that Phase 1 Decision 3 cut. Orphaned.
- **Cut Q11 (tone preset).** Replaced by the locked tone description in `preludePromptBuilder.js` (Phase 2 chunk 3 wires it).
- **Added Q9 (authority figure).** Single-select, 8 curated options (`parent` / `sibling` / `mentor` / `guardian` / `captor` / `employer` / `rival` / `none`). `mentor` is the precondition for mentor-NPC seeding at handoff (chunk 2 work).
- **Added Q10 (anything else?).** Optional free-text escape valve, 2000-character cap. The DM is instructed to honor it over conflicting curated answers.
- **Restructured Q8 (siblings).** Variable-length sub-form replaced by a single dropdown with 9 enum values (`only_child` / `younger_one` / `younger_many` / `older_one` / `older_many` / `twin` / `mixed` / `lost_one` / `lost_many`). AI generates names and dynamics during Ch1 narrative play.
- **Q1 / Q3 / Q8 help text additions** per Decision A: surname-blank guidance on Q1, race-naming-convention heads-up on Q3, pointer to Q10 on Q8.
- **Validation rule added.** Q8 `only_child` + Q9 `sibling` is a blocking contradiction (would produce incoherent arc plans). Client surfaces inline warning; server rejects with 400.
- **Wizard intro rewritten.** "Four focused sessions" / "ten questions" / "ancestry feat and ability bumps emerge from what you actually do."

### Setup blob shape (`characters.prelude_setup_data` JSON)

- **Dropped:** `talents`, `cares`, `tone_tags`, per-sibling sub-form fields.
- **Added:** `authority_figure` (enum), `origin_freeform` (optional, ≤2000 chars). `siblings` is now a single string instead of an array of objects.
- **Existing prelude characters' blobs are not migrated.** Readers (`preludeArcService`, `preludeThemeService`) already use null-safe fallbacks for the cut fields. Old preludes continue to work in degraded mode (no tone preset, no talent/cares-driven theme suggestion); new preludes use the new shape.
- The `chapter_4_arc` JSON column on `prelude_arc_plans` and the `tone_reflection` column from migration 045 stay unused (additive-only schema convention).

### Files

- `client/src/data/preludeSetup.js` — added `SIBLING_OPTIONS` and `AUTHORITY_FIGURES`; removed `SIBLING_RELATIVE_AGES`, `SIBLING_GENDERS`, `CHILDHOOD_TALENTS`, `CHILDHOOD_CARES`, `TONE_PRESETS`, `TONE_TAGS`. Updated docstring.
- `client/src/components/PreludeSetupWizard.jsx` — full rewrite to the 10-question structure. Dev-only `show_arc_preview` toggle preserved. Submit blocks while the Q8/Q9 contradiction is unresolved.
- `client/src/components/PreludeArcPreview.jsx` — removed the `TONE_PRESETS`-backed tone card (orphaned by the tone-preset cut). The arc-preview UI no longer surfaces tone information; the locked tone description lives in the prompt only. Old preludes silently lose this card.
- `server/services/preludeService.js` — `validateSetupPayload` updated: dropped talents/cares/tone validations; replaced sibling array validation with single-enum check; added `authority_figure` required + enum; added `origin_freeform` ≤2000 chars; added Q8/Q9 contradiction enforcement. Docstring updated to reflect 10-question shape.
- `server/routes/prelude.js` — docstring updated.
- `tests/prelude-setup.test.js` — rewritten for the new payload shape. Tests 6/7/8 (talents/cares/tone) replaced with siblings-enum, authority-figure, contradiction, and origin-freeform tests. Test 11 added: cut fields are ignored, not rejected (legacy compat).

### Out of scope

- Cleanup of `preludeArcService.js` and `preludeThemeService.js` references to the cut fields — chunk 3 work (prompt builder updates).
- Mentor-NPC seeding from `authority_figure='mentor'` — chunk 3 (prompt builder) emits the canon NPC; chunk 2 (transition service) seeds `mentor_imprints` at handoff.
- Removal of `prelude_values` table and `tone_reflection` column — additive-only schema convention; both stay unused.

## v1.0.103 (2026-04-29) — Phase 0 stop-the-bleeding cleanup

Commit: `099a22a`

### Fixed
- **Keeper multiclass spell-slot bug.** `CASTER_TYPE: 'none'` at `server/config/levelProgression.js:605` was a real bug — Keeper levels were entirely bypassed in multiclass slot calculations. Surfaced during the fix that Keeper's design intent is third caster, not full caster (see DECISION_LOG entry of same date). Set to `'third'`. Multiclass math verified: W1/K19 = 7 caster-equiv levels, W5/K1 = 5 (1-level dip earns toolkit, no slot bonus), W5/K6 = 7.
- **Keeper subclass registration.** Lorewarden, Mythslinger, Rhetorician, Versebinder, and Polymath now registered in `SPELLCASTING_SUBCLASSES`. The base-class bug had a sibling at the subclass layer; both shipped together.

### Changed (docs)
- **CLAUDE.md `creation_phase` enum** reduced from `'prelude' | 'ready_for_primary' | 'active'` to `'prelude' | 'active'` to match code reality. The middle value may return in Phase 2 if Prelude → Primary transition work calls for it.
- **ANCESTRY_FEATS.md** count reconciled to 195 (matching code and CLAUDE.md). The 13 "Path Less Walked" cross-pick feats remain documented as a parked-for-Phase-7 design idea, marked clearly as not currently implemented in 4 places (status header, scope intro, total summary, balance-pass note).
- **PRELUDE_IMPLEMENTATION_PLAN.md rule #23** flagged inline as design-only until Phase 2; `mentor_imprints` table and seeding service do not yet exist in code.

### Removed
- **PM_TODO.md** retired. Superseded by `CONSOLIDATED_TODO.md` (durable seven-phase plan) and `PROJECT_TODO.md` (per-session view). Historical content preserved in git history.

### Phase status
- Phase 0 gate complete. Phase 1 (Prelude reframe game design) unblocked.

## [1.0.0.103] - 2026-04-29 — Phase 0 cleanup (Keeper caster-type bug + doc reconciliation)

Stop-the-bleeding cleanup before Phase 1 (Prelude reframe) opens. One real bug, three doc reconciliations, one retired file.

### Fix — Keeper `CASTER_TYPE` multiclass exploit

**Before:** `CASTER_TYPE: 'none'` for the Keeper. Multiclass spell-slot calculation skipped Keeper levels entirely. A Wizard 1 / Keeper 19 build kept full Wizard slot progression while gaining nearly the entire Keeper toolkit (Texts, Recitations, Passages, Genre Domain, subclass features).

**After:**
- `levelProgression.js` — Keeper `CASTER_TYPE` set to `'third'`. The four Keeper subclasses (Lorewarden / Mythslinger / Rhetorician / Versebinder) plus the Polymath alternative track are registered in `SPELLCASTING_SUBCLASSES.keeper` so the third-caster branch in `getMulticlassSpellSlots()` actually counts Keeper levels once the L6 specialization is chosen.
- Math check: W1/K19 = 1 + floor(19/3) = 7 caster-equivalent levels (closes the original exploit). W5/K1 = 5 caster levels — a 1-level Keeper dip nets the toolkit but contributes zero to slot calc until L6, mirroring the Eldritch Knight / Arcane Trickster pattern. W5/K6 = 5 + floor(6/3) = 7 caster levels.
- The Keeper itself uses no traditional spell slots (its resources are Texts/Passages on short-rest + Recitations always-available + Literary Recall on long-rest), so this change only affects multiclass interactions; single-class Keepers are unaffected.

### Doc reconciliations

- **CLAUDE.md** — `creation_phase` enum reduced to `'prelude' | 'active'` to match code. The aspirational `'ready_for_primary'` value referenced previously does not exist in any migration or service. May return in Phase 2 (Prelude → Primary transition work).
- **ANCESTRY_FEATS.md** — count reconciled to **195 implemented feats** (15 per list × 13). The 13 "Path Less Walked" L13 cross-pick feats remain documented in-doc as a parked design idea but are clearly labeled as deferred for Phase 7. Status header, scope intro, total summary, and balance-pass note all updated.
- **PRELUDE_IMPLEMENTATION_PLAN.md** — rule #23 (mentor seeds primary campaign's `mentor_imprints` table) gained an inline 2026-04-29 note flagging it as design-only until Phase 2; the `mentor_imprints` table and seeding service are not yet implemented.

### Retired

- **PM_TODO.md** — superseded by `CONSOLIDATED_TODO.md`. Removed.

## [1.0.0.102] - 2026-04-27 — LLM infrastructure phase-2 fixes (auth/rate-limit handling + Ollama model verification + doc drift)

Phase 2 of the LLM infrastructure audit. Four high-priority fixes shipping in one commit. The Anthropic-console spending cap (the highest-leverage defense) was set separately by the user.

### Fix 1 — Auth/billing failure handling (401/403)

**Before:** failures from auth or billing problems surfaced as generic API errors mid-session. Users would see "Claude API error: invalid x-api-key" or similar, with no signal whether to check their key, their balance, or just wait.

**After:**
- `claude.js` now classifies 401/403 in the chat error path as a non-retryable `AUTH_FAILURE:` tagged error.
- `dmSession.js` `/message` route catches the tag and returns a 503 with a clear user-facing message pointing at console.anthropic.com → Settings → Billing and Settings → API Keys.
- `checkClaudeStatus()` was upgraded from "is `ANTHROPIC_API_KEY` set?" to a real probe via the `count_tokens` endpoint. Cost is effectively zero (count_tokens is metered as input only, ~10 tokens per probe). Returns distinct `error_code` values for `no_key`, `auth_failure`, `rate_limited`, `transient`, and `unreachable`.
- The status indicator in the app header now reflects actual API health rather than just env-var presence. If the key is invalid, revoked, or the account has a billing issue, the indicator now says "AI Offline" before the user starts a session.

### Fix 2 — 429 rate-limit retry handling

**Before:** 429 was not in the retryable list. First 429 from Anthropic would fail-fast with the raw error message.

**After:**
- `claude.js` now treats 429 as retryable with a more patient backoff than 503/500: 3 attempts with 5s/15s/45s delays (~65 seconds total budget). Backoff is more patient than 529's because rate-limited callers should slow down rather than retry rapidly.
- If retries exhaust, throws a `RATE_LIMITED:` tagged error.
- Route layer maps the tag to a 503 with a clear message: "Wait ~30 seconds and try again. If this happens repeatedly, you may have an unusually high request rate or your account tier may need review."

Low-frequency at solo-user volume, but ugly when it fires — now graceful.

### Fix 3 — Ollama model verification in status check

**Before:** `checkOllamaStatus()` only verified that `/api/tags` was reachable. Auto-fallback would happily route to Ollama with the configured `OLLAMA_MODEL` (default `gpt-oss:20b`), and the chat call would then fail with a model-not-found error if the model wasn't actually pulled.

**After:** `checkOllamaStatus()` now parses the `/api/tags` response, verifies the configured `OLLAMA_MODEL` is in the installed list, and returns a distinct `error_code: 'no_model'` when reachable-but-missing. The auto-fallback path treats any `available: false` as "skip Ollama," so a doomed call no longer routes through. The descriptive error message tells the user exactly which model is missing and how to install it.

### Fix 4 — LLM_SETUP.md drift

Three high-priority doc edits aligning the doc with current code:
- **Line 31 (architecture diagram):** "Gemma 3 12B" → `gpt-oss:20b` (the actual default).
- **Line 54 (module structure paragraph):** Updated from "Only DM sessions use Claude Sonnet" to reflect the v1.0.99 reality — Opus is the default for DM sessions too, with a Sonnet opt-down toggle on the home pill, setup screen, and in-session info bar (sharing the `dndUseSonnet` localStorage key).
- **Line 77 (cost claim):** "~$0.05–0.15 per session" → "~$2.50–$4.50 per Opus session, ~$1.30–$1.50/hour of play" with a pointer to the session 147/148 cost decomposition in `DECISION_LOG`. Added a recommendation to set a hard spending cap at console.anthropic.com.
- **Section 3 (Verify Connection):** Added a note that `checkClaudeStatus()` now makes a real API call as of v1.0.102, so the status indicator is meaningful rather than just key-set/key-missing. Updated the indicator-color list to show Opus (orange) as the production default and Sonnet (purple) as the opt-down.

### Files

- Modified: `server/services/claude.js` (401/403 detection, AUTH_FAILURE tag, 429 retry with 5s/15s/45s backoff, RATE_LIMITED tag, `checkClaudeStatus` upgraded to live `count_tokens` probe with `error_code` taxonomy).
- Modified: `server/services/llmClient.js` (`checkOllamaStatus` verifies configured model is installed, returns distinct `error_code: 'no_model'` when reachable but missing).
- Modified: `server/routes/dmSession.js` (`/message` error handler now maps AUTH_FAILURE and RATE_LIMITED tags to clear user-facing 503 messages alongside the existing OVERLOADED handling).
- Modified: `LLM_SETUP.md` (architecture diagram, module structure, cost considerations, verify-connection section).
- Modified: `CHANGELOG.md`, `package.json`, `client/package.json`.

### Verification

- All prompt-builder + cache test suites pass: `character-memory` 56, `moral-diversity` 59, `lean-prompt-dryrun` 14, `combat-tracker` 26, `condition-tracking` 56.
- Client builds clean.
- Existing 529 retry behavior preserved (regression-tested implicitly via the OVERLOADED tag path staying intact).
- New behaviors are observable from server logs (`Claude API rate-limited (429, attempt N/3), retrying in Ms…`) and from the status indicator (now reflects real API health).

### Deferred

- **Per-call cost calculation logging** — diminishing returns once Anthropic console cap is in place. May revisit if cost shape changes.
- **Ollama smoke test with `gpt-oss:20b`** — requires the 12 GB model pull, scheduled separately.
- **LLM_SETUP.md cosmetic edits** (line 49 module-structure description, line 71 status-indicator description) — nice-to-fix but lower priority.

## [1.0.0.101] - 2026-04-27 — H7 + H8 production fixes (verb-gated observation rule + soft Cardinal Rule 2)

Two prompt-rule fixes shipping together. Both surfaced during the v1.0.96 prose-quality A/B testing as items that needed to leave the always-on prompt. Decisions were green-lit by the project-management layer; the prose-quality triage now closes.

### H7 — `PLAYER OBSERVATION = ALWAYS A CHECK` is now verb-gated

**Problem:** The rule lived in `formatMechanicalMarkers()` as an always-on block, so the AI treated every player observation as triggering a Perception/Investigation check — including atmospheric scene-opens like "I push open the tavern door and look around" where no check is warranted. Pre-fix V1 baselines in the A/B harness routinely ended with "Make a Perception check." after a benign look-around.

**Fix:**
- Removed the rule block from `formatMechanicalMarkers()`. It no longer appears in the canonical system prompt.
- Added a verb detector — `detectObservationVerbs(action)` — exported from `dmPromptBuilder.js`. Word-stem regex against a narrow list of commitment verbs: search, examine, investigate, study, scrutinize, inspect, sneak, skulk, listen, peer, identify, track, persuade, intimidate, deceive, pick, disarm, climb.
- Added the rule text as `OBSERVATION_AS_CHECK_BLOCK` (also exported), with wording updated for the v1.0.101 soft Cardinal Rule 2 (no longer says "STOP").
- `/message` route now appends the block to the API call's system prompt only when the player's input matches a commitment verb. Block lands in tier 3 (uncached); restored to original `systemPrompt` before persisting to `messages[0]` so the block doesn't accumulate across turns.
- 15/15 verb-detector smoke-test cases pass: triggers on "I search the body," "I'll investigate the desk," "I'm trying to sneak past the guard," etc. Ignores "I push open the tavern door and look around," "I walk into the tavern," "I sit at the bar."

**Verification:** A/B harness V1 Scenario A now ends with the bartender asking *"Passing through, or staying?"* — natural conversational close. No spurious Perception-check demand.

**Trade-off:** Verb detection is intentionally narrow. False negatives (rule doesn't fire when it would have helped) are recoverable — the AI can still call for a check on its own. False positives (firing on atmospheric narrative) were the bug we fixed.

### H8 — Cardinal Rule 2 softened from "HARD STOPS" to "ROLL REQUESTS — DON'T SPOIL OUTCOMES"

**Problem:** The strict Cardinal Rule 2 forced the AI to end its response immediately after any roll request. This compressed cinematic build-ups — pre-fix V1 baselines on Scenario C (body approach) truncated mid-scene to demand a Medicine check instead of continuing the layered horror.

**Fix:** Replaced the strict version in the always-on prompt with the soft variant that was previously only available in `applyLeanTransforms()`. The soft version preserves the actual goal (don't let the AI narrate the outcome before the roll) while letting cinematic build-ups breathe:

> *When you call for a dice roll, you may continue narrating the surrounding moment — environment, other characters' reactions, the player's posture as they prepare. Never reveal the outcome of the check before the player rolls. The roll request can sit in the middle of a paragraph. You don't need to STOP after asking for it. The constraint is only on outcomes.*

**Verification:** A/B harness V1 Scenario C now reads:
> "...You roll him carefully onto his back. Make a Medicine check as you work. **The wounds tell a story — you just need to read it.**"
>
> The check call is mid-paragraph; atmospheric prose continues after it without revealing the check's outcome.

**applyLeanTransforms() reconciliation:** the function's H8 swap is now a no-op — its regex looks for the strict heading "2. HARD STOPS" which no longer appears in the canonical prompt. Left in place so a future revival of the strict rule would still be transformable. The function's primary role is now stripping `MECHANICAL MARKERS` (still works as a diagnostic). Toggle was retired from UI in v1.0.100; trigger via `dndLeanPrompt=1` in the browser console. Comment updated to reflect the new shape.

### Test reconciliation

- `tests/lean-prompt-dryrun.js` updated for the new H7/H8 production semantics. 14/14 checks pass: H7 rule absent from both full and lean canonical prompts; soft Cardinal Rule 2 present in both; strict version absent from both.
- `tests/character-memory.test.js` line 178 updated: was asserting `prompt.includes('HARD STOPS')`; now asserts the soft variant `ROLL REQUESTS — DON'T SPOIL OUTCOMES`.
- All other prompt-builder tests (`moral-diversity` 59, `combat-tracker` 26, `condition-tracking` 56) pass without modification.

### Files

- Modified: `server/services/dmPromptBuilder.js` (H7 block removed from `formatMechanicalMarkers`; `detectObservationVerbs` + `OBSERVATION_AS_CHECK_BLOCK` exported; H8 strict→soft swap in `createDMSystemPrompt` template; `applyLeanTransforms` comment updated).
- Modified: `server/routes/dmSession.js` (verb-gated H7 injection wired into `/message`; `applyLeanTransforms` import line extended).
- Modified: `tests/lean-prompt-dryrun.js` (assertions updated for new semantics; runner accepts `shouldBeIn: 'neither'`).
- Modified: `tests/character-memory.test.js` (Cardinal Rule 2 assertion updated).
- Modified: `CHANGELOG.md` (this entry).

### Closes the prose-quality triage

After this release, all four closure criteria from `triage/prose-quality-triage.md` are met:

1. ✅ Path decisions made (Opus default, both tiers 1h TTL, Lean retired, H7 verb-gated, H8 softened).
2. ✅ H7 + H8 production fixes shipped.
3. ✅ Cost validated in real-session metrics (sessions 147 + 148).
4. ✅ Findings folded into design docs (`CHANGELOG`, `DECISION_LOG`, `FUTURE_FEATURES`, `PROJECT_BRIEF`).

Triage archives next; the prose-quality thread closes.

## [1.0.0.100] - 2026-04-27 — Lean Prompt toggle retired from user-facing UI

User decision logged in DECISION_LOG ("Retire Lean Prompt toggle as production direction"). The toggle was a diagnostic-only experiment that didn't move the needle in real playtest. Removing it from the UI clears the question of "which one should I use?" since it has been answered.

### What changed

**Removed from the user-facing surface (`client/src/App.jsx`):**
- The "✂️ Lean prompt ON / · Lean prompt OFF" pill that lived under the home-page Sonnet/Opus pill
- The `leanPrompt` React state and its `updateLeanPrompt` setter
- The localStorage write path that was triggered by the toggle (the *read* path stays — see below)
- Tooltip / help-text references to "Lean Prompt"

**Kept intact as a diagnostic harness:**
- `applyLeanTransforms()` in `server/services/dmPromptBuilder.js` — the post-processor that strips MECHANICAL MARKERS and softens Cardinal Rule 2. The function and its 14 dryrun checks (`tests/lean-prompt-dryrun.js`) still pass.
- The `leanPrompt: true` body-param path through `/api/dm-session/start` and `/message`. Server still applies the transform when set.
- The localStorage *read* in `DMSession.jsx` (two call sites — `/start` and `/message`). A developer can still trigger lean by setting `dndLeanPrompt=1` in the browser console for prompt-design experiments. Comments updated to explain the diagnostic-only framing.

The split keeps the post-process-the-system-prompt-on-a-copy pattern available for future prompt-design experiments without surfacing a question to users that has been answered.

### Why

Lean didn't move the needle in user playtest. Automated A/B showed it helped edge cases (atmospheric scene-opens, cinematic build) but not the average turn. The H7 (OBSERVATION-as-check) and H8 (HARD STOPS) production fixes — currently pending in DECISION_LOG Open Decisions — will address the underlying prose-compression issues directly in the always-on prompt, which is the right shape of fix.

### Migration note

The previous `dndLeanPrompt` localStorage key is left orphan in user browsers. Any user who previously set the toggle ON will continue to send `leanPrompt: true` from DMSession (because the localStorage read path persists). To explicitly opt out, set `dndLeanPrompt=0` or remove the key via DevTools. For most users (toggle was off or never touched), no action needed — the transform won't apply.

### Files

- Modified: `client/src/App.jsx` (removed state + UI block; left explanatory comment).
- Modified: `client/src/components/DMSession.jsx` (kept the two body-param call sites; updated comments to reflect diagnostic-only framing).
- Modified: `CHANGELOG.md` (this entry).
- Modified: `DECISION_LOG.md` ("Retire Lean Prompt toggle as production direction" entry already added 2026-04-26; Open Decisions section already cleared of the Lean question).

## [1.0.0.99] - 2026-04-26 — Opus is now the production default for main DM session continuations

User decision logged in DECISION_LOG. Code now defaults to Opus on all three surfaces.

### What changed

**Server (`server/routes/dmSession.js`):** both `/start` and `/message` endpoints now default to Opus for all turns. The `modelOverride` body param vocabulary is now `'opus' | 'sonnet' | null` (was `'opus' | null`); `'sonnet'` is the explicit opt-down signal, `'opus'` is accepted as a no-op, `null` falls through to the Opus default.

**Client (3 surfaces):** the `forceOpus` boolean has been renamed to `useSonnet` with inverted meaning across `App.jsx`, `DMSession.jsx`, and `SessionSetup.jsx`. localStorage key migrated from `dndForceOpus` to `dndUseSonnet`. Default is now Opus on every surface; the toggle selects Sonnet as an opt-down.

- **Home pill** — defaults to "🟠 Opus" with terracotta accent. Click to switch to "🟣 Sonnet."
- **Setup screen** — Opus button is the bold/selected state by default; Sonnet button is the opt-down.
- **In-session info bar pill** — same Opus default, click to opt down to Sonnet.

Tooltips updated to reflect the new framing ("production default" vs "opt-down for cost").

### Why

User playtest confirmed Opus is the prose-quality lever the project needed. Sonnet's "good enough" wasn't actually good enough for the brief's ambition of an end-of-world game playable for years on a single character. v1.0.96's cache architecture fix and v1.0.98's tier 2 1-hour TTL brought Opus session cost to ~$1.30–$1.50/hour validated against real session-147 data — acceptable for the user's most-played hobby project (~$300–700/year for 2–3 sessions/week).

Levers 2 and 3 (rolling-summary-earlier, tier-3-trim) were considered as further cost reductions but deferred. Both trade cost for AI memory quality, which is the central engineering problem the brief flags as load-bearing — those need their own scoped investigation, not casual inclusion in the default-flip.

### Migration note

The previous `dndForceOpus` localStorage key is left orphan in user browsers; it's not read by any v1.0.99+ code. Any user who previously toggled the old "Force Opus" pill ON will now see the new Opus default (matching their prior intent). Users who previously had the old toggle OFF (Sonnet) will see Opus on first load — they can opt down via the toggle if they want Sonnet back. The orphan key will eventually be cleaned up via a future minor pass.

### Files

- Modified: `server/routes/dmSession.js` (server defaults, body param vocabulary).
- Modified: `client/src/App.jsx` (home pill: rename + invert + default Opus).
- Modified: `client/src/components/DMSession.jsx` (in-session pill + state + API calls).
- Modified: `client/src/components/SessionSetup.jsx` (setup-screen Opus/Sonnet selector).
- Modified: `CHANGELOG.md` (this entry).
- Modified: `DECISION_LOG.md` (new "Opus as production default" entry; supersedes the older "Opus for ALL generation, Sonnet for sessions only" entry which moved to Closed/superseded).

## [1.0.0.98] - 2026-04-26 — Tier 2 prompt cache to 1-hour TTL + cost-prediction corrections

Single architecture change plus documentation corrections from the v1.0.97 session-147 playtest data.

### Architecture: tier 2 prompt cache now uses 1-hour TTL

In v1.0.96, tier 1 (universal-static) was put on 1-hour TTL but tier 2 (per-character) was kept at the default 5-minute TTL — the assumption was that the smaller block didn't justify the 2× write premium.

The v1.0.97 session-147 playtest (24-turn Opus, character #1044 Riv C) disproved that assumption. Real cache logs showed tier 2 re-creating ~6 times during the session (entries like `created 5221`, `created 2973`, `created 1927` at turns 10, 11, 18, 20, 22) — each costing roughly $0.05. Pattern: thoughtful play gaps exceed 5 minutes, tier 2 expires, gets re-created on the next turn.

Fix: tier 2 now also uses `cache_control: { type: 'ephemeral', ttl: '1h' }`. Both tiers on 1-hour TTL.

**Expected savings:** ~$0.20–$0.30 per Opus session by consolidating tier 2 re-creations from ~6/session to ~1/session. Cross-session caching also benefits — the next session start can hit BOTH tiers from the prior session's residual cache (session 147 t1 already showed an 88% cache hit on tier 1 alone with 1-hour TTL; this should improve further with tier 2 also persisting).

### Documentation: cost-prediction corrections

The original v1.0.96 entries quoted "~$1.55 → ~$0.85 per session" as the predicted Opus cost improvement, with a ~95% cache hit rate target. Real session-147 data showed ~$2.89/session (~$1.50/hour) at ~71% cache hit rate.

The prediction was wrong because it assumed tier 1+2 dominated the input. They don't — tier 3 dynamic content (chronicle context, narrative queue, world state, weather) and accumulated message history grow per turn, mathematically capping the cache hit ceiling at ~77% for thoughtful play. The 71% measured rate is close to that ceiling; the architecture fix is operating near optimal.

Updated to reflect actual numbers:
- `CHANGELOG.md` — v1.0.96 cost-impact table now shows measured numbers + a note explaining the prediction error.
- `DECISION_LOG.md` — open Opus-default decision entry, character info split entry, and tier-1-TTL entry all updated with measured numbers; new tier-2-TTL entry added.
- `PROJECT_TODO.md` — active item description updated; v1.0.96 in Recently Shipped reflects measured cost.
- `triage/prose-quality-triage.md` — cost-impact bullet, open question 1, and closure criterion 3 all updated.

### Strategic context (lever 1 of three)

Per the cost analysis after session 147, three additional levers exist to push per-session cost lower if desired:

1. **Tier 2 to 1-hour TTL** — this release. Saves ~$0.20–$0.30/session.
2. Apply rolling summary earlier (currently triggers at turn 30; could trigger at turn 15). Would save ~$0.40–$0.60/session but trades cost for slightly weaker AI memory of recent turns.
3. Trim tier 3 dynamic content (smarter pruning of chronicle context, narrative queue, world state). Would save ~$0.30–$0.50/session but is the most complex change and risks AI losing important context.

This release ships only lever 1 — the cheap, behavior-risk-free fix. Levers 2 and 3 are deferred until we know whether the new measured cost is acceptable as a production default.

### Files

- Modified: `server/services/claude.js` (TIER2_CACHE_CONTROL now uses `ttl: '1h'`; comment block expanded with the v1.0.97 playtest reasoning).
- Modified: `CHANGELOG.md` (v1.0.96 cost-impact table corrected; this v1.0.98 entry added).
- Modified: `DECISION_LOG.md` (open Opus-default entry, character info split entry, tier-1-TTL entry updated; new tier-2-TTL entry added).
- Modified: `PROJECT_TODO.md` (active item + Recently Shipped updated).
- Modified: `triage/prose-quality-triage.md` (cost-impact bullet, open question, closure criterion updated).

## [1.0.0.97] - 2026-04-26 — Documentation hygiene: BRIEF, DECISION_LOG, TODO, triage convention

No code changes. Three new docs that change how this project is navigated and how strategic-role collaborators (Claude PM, future-me, designers) get oriented.

### New top-level docs

- **`PROJECT_BRIEF.md`** — strategic orientation for anyone joining the project in a non-coding role. ~2200 words. What this is (Player Mode + DM Mode + Prelude), why it exists (the user's "end-of-world game" framing), who it's for (one user, possibly friends, never marketed), what "done" looks like (3 north-star ambitions: years of context, official campaigns, lineages), the 5 decision principles, what we're NOT building, the high-level system inventory, the 3 strategic threads, and how a PM works on this project. Read once.

- **`PROJECT_TODO.md`** — the single-entry-point for active work. Active Right Now (1-3 items max), Blocked / waiting, Parked / on deck, Backlog (pointer to FUTURE_FEATURES), Recently Shipped, Living Docs Map. Read every session.

- **`DECISION_LOG.md`** — both retrospective and forward-looking record of the meaningful calls that shape this project. Open Decisions Pending at top (6 entries: Opus default, Lean retire, H7/H8 production fixes, project rename, Session Hi-Fi path). Decisions Log section with 18 retrospective entries spanning v1.0.96 (cache architecture, character info split, Sonnet/Opus toggle) back through project foundations (stack choices, marker system, three-tier cache, prelude-forward creator, Themes-replace-backgrounds, DM Mode, persistent merchants, living world, no-test-framework, JWT auth). Records the *why* — CHANGELOG records *what shipped*.

### Triage folder convention clarified

- **`triage/`** is for active diagnoses of broken systems. Not for design work or deferred builds.
- Currently holds `prose-quality-triage.md`.
- An earlier `session-hifi-triage.md` was moved out — Session Hi-Fi is design work, not a diagnosis. It now lives as a full entry in `FUTURE_FEATURES.md`.

### FUTURE_FEATURES.md additions

- **Session Hi-Fi implementation** — full design + scope analysis as a deferred feature entry. Covers the three-column cockpit redesign of `DMSession.jsx`, the design ↔ production mapping table, the 5 open questions that need user decisions before building, and the recommended Path A (phased, 3 commits) starting point. Source preserved in `Claude UX Design/D&D Meta Game (Remix)/Session-Design-Bundle/`.

### Claude UX Design folder additions

Two design-handoff artifacts now travel with the project (referenced from PROJECT_BRIEF, FUTURE_FEATURES, DECISION_LOG):

- **`Claude UX Design/D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md`** — design doc explaining the Themes system (4-tier progression replacing 5e backgrounds), the Expertise Die signature mechanic, the Knight Theme moral-paths variant, subclass × theme synergies, mythic × theme amplifications, party-level Team Tactics, and how Themes intersect with class/subclass/ancestry as braided progression rails. Includes 5 UX guidance principles for whoever's iterating on visuals.

- **`Claude UX Design/D&D Meta Game (Remix)/Session-Design-Bundle/`** — preserved design source for the Session Hi-Fi work. Contains the full 1482-line `Session Hi-Fi.html` prototype, the design assistant's coding-agent handoff README, and the 1831-line chat transcript that captures the design intent.

### Files

- New: `PROJECT_BRIEF.md`, `PROJECT_TODO.md`, `DECISION_LOG.md`, `triage/prose-quality-triage.md`, `Claude UX Design/D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md`, `Claude UX Design/D&D Meta Game (Remix)/Session-Design-Bundle/{README.md,Session Hi-Fi.html,chat-transcript.md}`.
- Modified: `FUTURE_FEATURES.md` (Session Hi-Fi entry added).

## [1.0.0.96] - 2026-04-26 — Prose-quality diagnostic + prompt cache architecture fix

User feedback: current sessions read thinner than the original "Order of Dawn's Light" Opus 4.5 baseline (December 2025 PDF in repo root). This release ships the diagnostic toolkit, the findings from running it, and the cache-architecture fix that came out of investigating Opus per-session cost. Net result: Opus is now the validated production direction at roughly half the previous cost.

### Diagnostic findings (in priority order — see `tests/output/prose-quality-analysis.md`)

After reading the 416-page original campaign PDF and running a 3-scenarios × 5-variants automated A/B against Sonnet, **plus** a hands-on user playtest of all 4 Sonnet/Opus × Default/Lean combinations, the original 6-hypothesis list was reordered:

| Original hypothesis | Verdict |
|---|---|
| Sonnet vs Opus is the biggest factor | **CONFIRMED** by user playtest. Opus is the lever. |
| Word-count caps in CONVERSATION HANDLING | **DOWNGRADED** — caps barely bind in practice. |
| Self-Check at prompt tail | **PARTIAL** — helps tavern openers (+27%), neutral elsewhere. |
| Marker overhead | **UPGRADED** — strongest mutation in automated A/B, *but* lean prompt didn't move the needle in real playtest, suggesting markers help on edge cases not average turns. |
| Memory plumbing | **MIXED** — depends on scenario. |
| Tone presets | **FALSE** — confirmed by code audit, not wired into main DM sessions at all. |

Two unexpected findings the data surfaced:

- **`PLAYER OBSERVATION = ALWAYS A CHECK` + Cardinal Rule 2 HARD STOPS truncate atmospheric scene-opens.** Production V1 ended a tavern entry with "Make a Perception check." after the player just opened a door. Original PDF didn't gate observation behind checks. Lean prompt mode tests softening this.
- **The "werewolf bias" the user observed in playtest was a methodology error in the seed script** — `current_quest = "Investigate the strange howls and missing livestock"` was hardcoded into the test-character template, which is a textbook werewolf-mystery prompt. Removed; tests now start with neutral state.

### Prompt cache architecture fix (the big one)

Investigation of production cache logs revealed two distinct issues, both fixed:

**Issue 1: Tier 2 cache content was leaking dynamic state.** The character sheet was a single block in tier 2, with HP, gold, current location, current quest, and equipped weapon all baked in. Every state change (every turn) drifted tier 2's content, breaking the per-character cache.

Fix: split `formatCharacterInfo()` in `dmPromptBuilder.js` into two return fields. `staticText` holds identity (name, race, class, level, abilities, skills, feats, spells, faith, alignment, demographics, personality/ideals/bonds/flaws, backstory) — lands in tier 2. `dynamicText` holds state (HP, AC, weapon, key equipment, current location, current quest) — lands in tier 3. Backwards-compat: `text` field still returned with the concatenation. Verified byte-stable across HP/gold/location/quest/inventory changes via `tests/cache-tier-diff.js`.

**Issue 2: Tier 1 used 5-minute cache TTL.** During thoughtful play (3–10 minutes between turns), the cache evicted mid-session and rebuilt every ~5 turns. Production logs of session 144 showed eviction at t1, t5, t11, t18 — exactly the 5-minute boundaries.

Fix: tier 1 now uses `cache_control: { type: 'ephemeral', ttl: '1h' }`. Anthropic charges 2× to write 1-hour cache vs 1.25× for 5-minute, but the 1-hour TTL survives between thoughtful turns and is net cheaper. Tier 2 keeps the default 5-minute TTL — smaller block, premium not worth it.

**Cost impact (Opus, with caching working):**

> *Updated 2026-04-26 with v1.0.97 production data from session 147 (24-turn Opus playtest, character #1044 Riv C). The original prediction of ~$0.85/session and ~95% cache hit rate assumed tier 1+2 dominated the input. Real data showed they don't — tier 3 dynamic content (chronicle context, narrative queue, world state, weather) and accumulated message history grow per turn, mathematically capping the cache hit ceiling at ~77% for thoughtful play. Measured hit rate was 71% — close to the ceiling. Real per-session cost is closer to ~$1.50/hour of play (~$2.89 for the 24-turn session). Tier 2 is moving to 1-hour TTL in v1.0.98 (lever 1), which should save ~$0.20–$0.30 per session by consolidating tier 2 re-creations.*

| | Before v1.0.96 | After v1.0.96 (measured in v1.0.97 playtest) |
|---|---|---|
| Cache hit rate | ~55% | **~71% measured** (ceiling ~77%) |
| Mid-session tier 1 evictions | every 5–6 turns | ~0 (1h TTL working as intended) |
| Tier 2 cache stability | inconsistent (state leak) | byte-stable across turns |
| Tier 2 re-creations during long pauses | n/a (always evicted anyway) | ~6 per 24-turn session (5m TTL) |
| Per-session cost (24-turn Opus) | not previously measured at this fidelity | **~$2.89 measured** (~$1.50/hour) |
| First-turn cache hit (cross-session) | 0% | **88% measured** (1h TTL keeps prior session's cache alive) |

### Diagnostic toggles

Three new user-facing toggles, all implemented as localStorage-backed pills with server-side body params:

**Sonnet/Opus model selector** — replaces the old Auto/Claude/Ollama provider toggle on the SessionSetup screen. Three surfaces:
- Home-page pill under the "Adventure awaits while you're away" subtitle (clickable).
- SessionSetup screen status row (right-side Sonnet | Opus buttons).
- In-session info bar pill (purple "Sonnet" / orange "Opus" — toggle mid-session for live A/B).
- All three read/write the same `dndForceOpus` localStorage key.
- Body param: `modelOverride: 'opus' | null` threaded through `/api/dm-session/start` and `/message`.
- The previous Auto/Claude/Ollama button is gone from setup; the provider preference stays internally on `auto` so Ollama is still a fallback if Claude is unreachable.

**Lean Prompt toggle** — diagnostic only, on the home page. When ON:
- Strips the entire `MECHANICAL MARKERS` section (~5.5K chars / 23% of prompt).
- Replaces strict Cardinal Rule 2 (`HARD STOPS`) with the soft `ROLL REQUESTS — DON'T SPOIL OUTCOMES` variant — allows continued narration around a check call as long as the outcome stays hidden.
- Game-state markers (combat, loot, merchant, conditions, promises, weather) will NOT fire while it's on. Diagnostic only.
- Implementation: `applyLeanTransforms()` post-processor in `dmPromptBuilder.js`. Applied per-turn on a copy of the system prompt, so the FULL prompt always stays in `messages[0]` and toggling lean off restores all rules immediately. 14/14 transform checks in `tests/lean-prompt-dryrun.js`.

**Prelude/main toggle gap** — logged to `FUTURE_FEATURES.md` as deferred work. The Sonnet/Opus + Lean toggles only affect the main DM session, not prelude (different prompt builder, different model API param). Prelude has its own internal Auto/Sonnet/Opus button. Unification deferred until we know which toggle (if any) becomes a production default.

### New diagnostic infrastructure

- `tests/prose-quality.test.js` — re-runnable A/B harness, 3 scenarios × 5 variants against Sonnet, ~2 min / 15 API calls. Outputs to `tests/output/prose-quality-results.md` for human read-and-rank.
- `tests/prose-quality-dryrun.js` — verifies regex transforms before burning API calls.
- `tests/cache-tier-diff.js` — diagnoses cache content stability. Generates the prompt twice with the same character + once with simulated state changes; reports tier sizes and byte-level diffs. Confirmed tier 2 byte-stable across state changes after the architecture fix.
- `tests/lean-prompt-dryrun.js` — 14 idempotent checks that lean transforms strip the right things and leave the right things alone.
- `tests/seed-test-characters.js` — creates 4 identical Riv-style cleric characters (Riv (A) Sonnet/Default, (B) Sonnet/Lean, (C) Opus/Default, (D) Opus/Lean). Bypasses prelude (`creation_phase = 'active'`). Initial version had werewolf priming in the quest field — fixed. Backstory expanded to 1100 chars to ensure tier 2 exceeds the 1024-token cache threshold.
- `tests/output/` — A/B run artifacts.

### Pre-existing fixes that surfaced during this work

- **`PreludeSession.jsx` runtime crash** — `descStyle` was referenced on lines 629 and 658 but never declared in the file (it lives in `PreludeSetupWizard.jsx`). Defined at module scope.
- **Canon ledger duplicated in prelude Setup panel** — the v1.0.75 migration moved canon facts into `PreludeLorePanel` but left a copy in the Setup panel. Removed the duplicate; Setup now shows only character details + emerging values, canon lives exclusively in the Lore panel button.

### Files

- New: `server/services/dmPromptBuilder.js applyLeanTransforms()` export, `tests/prose-quality.test.js`, `tests/prose-quality-dryrun.js`, `tests/lean-prompt-dryrun.js`, `tests/cache-tier-diff.js`, `tests/seed-test-characters.js`, `tests/output/prose-quality-results.md`, `tests/output/prose-quality-analysis.md`.
- Modified: `server/services/dmPromptBuilder.js` (formatCharacterInfo split into staticText + dynamicText, prompt template uses both across CACHE_BREAK:AFTER_CHARACTER), `server/services/claude.js` (TIER1_CACHE_CONTROL with `ttl: '1h'`, TIER2_CACHE_CONTROL default 5m), `server/routes/dmSession.js` (modelOverride + leanPrompt body params on /start + /message; full prompt restored to messages[0] post-call so toggles are reversible mid-session), `client/src/App.jsx` (Sonnet/Opus pill + Lean Prompt pill on home page), `client/src/components/DMSession.jsx` (forceOpus state + in-session pill + leanPrompt read from localStorage at send time), `client/src/components/SessionSetup.jsx` (Sonnet/Opus buttons replace Auto/Claude/Ollama), `client/src/components/PreludeSession.jsx` (descStyle declaration; canon ledger removed from Setup panel), `FUTURE_FEATURES.md` (prelude/main toggle unification entry).

## [1.0.0.95] - 2026-04-24 — Playtest fixes round 2 + transcript decoupling

Eight fixes from the v1.0.94 playtest. Two infrastructure changes (transcript decoupling, accurate turn counter) plus six prompt + verifier fixes for issues observed in the actual play.

### Infrastructure: append-only transcript (migration 046)

`dm_sessions.messages` is the LLM-facing conversation array — gets compacted by the rolling summary at message 30+ for prompt budgeting. That's correct for the AI, but it meant anything downstream that wanted the full play history (chronicle gen, recap, transcript display, exports, the playtest turn counter) was reading a lossy view.

Fix: new `dm_sessions.transcript` column that grows append-only with the actual full message history. `messages` continues to drive what the LLM sees (compacted, bounded). `transcript` is the source of truth for "what happened in this session." Both prelude and main DM session paths now write to both. Backfill: existing sessions bootstrap from current `messages` on first append.

`getTurnCount(sessionId)` reads from the transcript and gives the authoritative turn number — unaffected by rolling-summary compaction. Wired into both per-turn and session-end playtest logs.

### Prompt fixes (six prompt-side updates from playtest observations)

**Cardinal Rule 13b — ROLL NUMBERS NEVER APPEAR IN NARRATION.** Playtest showed "You rolled an 11. The spoke seats — mostly..." — leaking the roll into prose. New rule explicitly bans the family ("you rolled X" / "with a 14" / "your roll of N" / "the dice land" / "you succeed on your check" / "your check succeeds"). The d20 result is INPUT to your generation, never OUTPUT. Includes worked WRONG/RIGHT pair from the actual playtest.

**Rule 19a extended — still/freeze/spoon-stops variants.** Playtest showed "Toren is very still" + "Vess's spoon stops" slipping past the existing tic ban (which only matched "X goes still"). Now the full family is explicit: "X is very/suddenly/completely still," "X has gone still," "X freezes," "X holds completely still," "X stops moving," and the action-freeze cousin "X's [hand/spoon/sewing/breath/work] stops" as a reaction-beat.

**Rule 6 strengthened — atmospheric endings are violations.** Playtest player wrote "I'm bored, the story isn't moving" after a passage that ended on cold weather + frozen mud + fogged breath + non-moving canvas. The rule already said this was bad; now it has the full WRONG passage as a worked example with three alternative RIGHT endings, plus an explicit test: "read your last 1-2 sentences. If they're describing weather, lighting, ambient sound, motion-of-objects-not-aimed-at-the-PC, or characters disengaging without a handoff — REWRITE."

**OBSERVE mode clarified — choices must be PRESENTED.** Playtest showed Chapter 1 OBSERVE getting interpreted as "PC stands still while adults do things." OBSERVE is supposed to mean small character-shaping choices (hide/run, share/hoard, speak/stay silent). New "ENGAGEMENT TEST" subsection: every Ch1 response must end with one of {choice presented, NPC addressing the PC, roll prompt, physical pressure on the PC}. Atmosphere stays in the body, never the close.

### New code-verifiers

**`verifyNoMechanicalRoll`** — catches Rule 13b violations: "you rolled N" / "with a 14" / "your roll of 19" / "you succeed on your X check" / "your check succeeds" / "the dice land" / "on your 8" patterns. 10 unit tests covering the family + clean prose passing through.

**`verifyNoStillFreezeTic`** — catches Rule 19a violations including the new variants: "X is very still" / "X freezes" / "X's [hand/spoon] stops" patterns. Carefully tuned to NOT flag legitimate "still" usage ("the lake is still," "Toren stops the wagon"). 10 unit tests.

Both wired into `verifyDmResponse` so they run on every AI turn alongside the existing hard-stop and meta-commentary verifiers. Failures plug into the same invisible-correction-feedback loop — next turn's prompt gets a `[SYSTEM]` note explaining the violation.

### Files

- New: `server/migrations/046_session_transcript.js`, `server/utils/sessionTranscript.js`, `tests/session-transcript.test.js` (8 tests).
- Modified: `server/services/preludeArcPromptBuilder.js` (Rule 13b, Rule 19a extension, Rule 6 stockyard worked example, OBSERVE mode ENGAGEMENT TEST), `server/services/preludeSessionService.js` (init + append + transcript-based turn counter), `server/routes/dmSession.js` (init + append + transcript-based turn counter + session-end walks transcript), `server/services/ruleVerifiers.js` (+verifyNoMechanicalRoll +verifyNoStillFreezeTic), `tests/marker-schemas.test.js` (+20 verifier tests, now 49 passed).

## [1.0.0.94] - 2026-04-24 — Anthropic 529 resilience + cleaner error surface

Playtest hit Anthropic's `529 Overloaded` mid-session. The previous retry policy gave up after 3 attempts (8s total wait) and surfaced "Claude API error: Overloaded" to the player. Improved both layers.

### `claude.js` retry policy

529 specifically gets its own, more patient budget — Anthropic's docs say back off longer for overloads (they expect the API to be at capacity for tens of seconds, not transient seconds).

- **Before:** 3 attempts, 2s + 4s backoff (8s total).
- **After:** 5 attempts, 4s + 8s + 16s + 32s backoff (60s total max wait).
- Other retryable errors (503, 500, network) keep the existing 3-attempt / 2s+4s policy — only overloaded gets the longer fuse.
- When we do give up on 529, the thrown error is tagged `OVERLOADED:` so the route layer can map it to a clean user-facing string.

### Cleaner error surface

Both `server/routes/prelude.js` and `server/routes/dmSession.js` now intercept `OVERLOADED:`-tagged errors and respond with HTTP 503 + JSON `{ error, message, retryable: true }`. The user-facing `message` reads:

> *"Anthropic's API is temporarily at capacity. Your input has been preserved — please send again in a moment."*

Client-side, `PreludeSession.jsx` now prefers the friendlier `body.message` over `body.error` when surfacing the error to the player. They get an actionable message instead of a raw provider error.

The player's input was already preserved in the textarea on error (rolled back from optimistic-add); this change makes the failure recoverable without confusion.

### Files

- Modified: `server/services/claude.js` (separate 529 retry budget + OVERLOADED tag), `server/routes/prelude.js` (503 mapping + clean message), `server/routes/dmSession.js` (same 503 mapping at the per-turn handler), `client/src/components/PreludeSession.jsx` (prefers `body.message` on error).

## [1.0.0.93] - 2026-04-24 — Playtest log human-readable framing

The `s=124` prefix in playtest log lines was the database row id (auto-incremented across all sessions ever), which read as "session 124" but was actually session 1 of a brand-new character. Logs now lead with character name + prelude session ordinal, with the DB id moved to the tail as `(sid=NNN)` for log cross-referencing.

Before:
```
[playtest] s=124 t=3 type=prelude_arc prompt=82.1k canon+1 (rule2!)
```

After:
```
[playtest] Alexiel · prelude 1/5 · ch1 · t3 prompt=82.1k canon+1 (rule2!) (sid=124)
```

Session-end banner gets the same treatment:
```
═══ [playtest] · SESSION SUMMARY · Alexiel · prelude 1/5 · 14 turns · (sid=124) ═══
```

DM Mode sessions render as `Kaelen · dm · t12 ...` (no session ordinal — those are continuous campaigns).

### Files

- Modified: `server/utils/playtestLogger.js` (new optional `characterName` / `sessionOrdinal` / `sessionTotal` / `chapter` fields; head/tail formatting), `server/services/preludeSessionService.js` (passes character + ordinal in both per-turn + session-end logs), `server/routes/dmSession.js` (best-effort character name lookup at per-turn log site, character passed at session-end), `tests/playtest-logger.test.js` (+2 new tests, format assertions updated).

## [1.0.0.92] - 2026-04-24 — Playtest fixes: 5 issues from session 124

Session 124 surfaced five fixable issues in one playtest. All addressed.

### Rule 2c — PLAYER INPUT IS PLAYER AUTHORSHIP

The most serious bug: the AI read player input as if the AI had written it, then apologized for "putting words in your mouth" — for words the PLAYER wrote. Cardinal Rule 2 (don't speak for player) had become so weighted that the AI was hallucinating violations in the player's own first-person input.

New rule explicitly inverts: when the player writes their character's dialogue, internal monologue, decisions, or actions in any voice — that's the player AUTHORING their character, the OPPOSITE of a Rule 2 violation. The AI must never apologize for player-authored words. Read player input at face value; respond by narrating the world's reaction.

### Whitelist for sensory "you know" patterns

The violation detector flagged "merchants you know by face" as a Pattern C state-attribution violation (because `know` is in the cognition-verb list). It's not — it's biographical context the character would obviously have given their setup. Added a whitelist for `you (know|knew|...|recall) [up to 3 words] (by|from|as) ...` — covers "by face / from childhood / as a friend" patterns. Deliberately excluded `to` because "you remember to take the keys" attributes directive intent. 11 new tests in `prelude-violation-detection.test.js`.

### Rule 6d — GIVE THE PLAYER WHAT THEY NEED TO ANSWER

The AI asked the player to calculate "if a man already owes 2sp 4cp and wants three jugs of oil and a pound of nails on top of it..." — but never told the player what oil and nails cost. New rule: before asking the player to make a calculation/judgment/decision, give them the data needed in-scene, OR rewrite the question to one they can answer with what they know.

### Rule 19b — Banned triadic-rhythm tic ("X and X and X")

Extends the existing Rule 19a banned-tics list. The pattern "expected an answer and received the right one and is now thinking about something else entirely" — three parallel clauses joined by "and" for false weight — is now an explicit ban. Includes positive instructions and worked examples (write the one clause that matters, or break the rhythm with a genuine pause).

### Toned down the canon-fact banner

The ⚑⚑⚑ + ALL CAPS + "we cannot afford" banner in the opening prompt was an attention-sink that crowded out other constraints. Replaced with a calm one-line requirement (still requires 8-15 facts, still requires inline emission, still lists category coverage and worked examples — just stops screaming).

### Files

- Modified: `server/services/preludeArcPromptBuilder.js` (Rule 2c, Rule 6d, Rule 19b, calmer canon banner), `server/services/preludeViolationDetection.js` (sensory whitelist), `tests/prelude-violation-detection.test.js` (+11 whitelist tests, now 91 passed), `tests/prelude-prompt.test.js` (banner-text assertion updated for the toned-down version).

## [1.0.0.91] - 2026-04-24 — Playtest logging + Ch4-as-bridge design logged

Two pieces, both for playtest visibility and design continuity.

### Playtest logging instrumentation

New `server/utils/playtestLogger.js` surfaces context-drift signals during sessions. Two outputs:

**Per-turn one-liner** (greppable, dense):
```
[playtest] s=99 t=12 type=prelude_arc prompt=24.1k canon+2 emerg=1 (CHAPTER+,Ch2->Ch3)
[playtest] s=42 t=6 type=dm prompt=19.2k markers=1/1bad viol=1 will-correct
[playtest] s=42 t=7 type=dm prompt=19.4k markers=1/0bad fixed-prev
```

**Session-end multi-line summary** (trajectory analysis):
```
═══ [playtest] SESSION SUMMARY · session 99 · prelude_arc · 28 turns ═══
Duration: 47 minutes wall-clock
Markers: 47 emitted, 3 malformed (6.4%)
Rule violations: 4 caught (hard-stop / meta-commentary)
Corrections: 6 queued, 5 acted on (83% self-corrected next turn)
Canon: +23 added, -2 retired ⚠ retire = potential drift
Emergences: 12 offered (8 accepted, 3 declined, 1 cap-blocked)
Chapters: 1 advance(s) within session
Prompt size: 11.2k → 18.4k (↑7.2k drift)
Note: Theme committed: Acolyte (forest path)
═══════════════════════════════════════════════════════════════════════
```

Wired into both DM session route and prelude session service. The `canon-N!` per-turn flag and the ⚠ session-end indicator highlight canon retirements specifically — the most direct context-drift signal.

23-test coverage in `tests/playtest-logger.test.js`.

### Prelude Round 3 design (Ch4 as bridge) logged

`PRELUDE_IMPLEMENTATION_PLAN.md` Round 3 documents the structural reframe:
- Ch1-3 = home arc; Ch3 ends with irreversible act + theme commitment + departure scene
- Ch4 becomes BECOME — post-departure adjustment, thread wrap, runway to primary campaign
- 6 candidate Ch4 beats sketched (lonely, identity test, theme in practice, home echo, small adventure, arrival)
- Implementation impact mapped (arc plan generator, chapter modes, theme commitment, canon `transient` flag, Phase 5 handoff)
- Migration plan: zero existing prelude characters, no migration needed

`FUTURE_FEATURES.md` Phase 5 handoff entry now references the Round 3 reframe and includes a build checklist for when implementation begins.

No code changes — design logged for the next implementation pass.

### Files

- New: `server/utils/playtestLogger.js`, `tests/playtest-logger.test.js`
- Modified: `server/routes/dmSession.js` (per-turn + session-end logging), `server/services/preludeSessionService.js` (per-turn + session-end logging with prelude-specific canon/emergence signals)
- Docs: `PRELUDE_IMPLEMENTATION_PLAN.md` (+Round 3), `FUTURE_FEATURES.md` (+Phase 5 handoff)

## [1.0.0.90] - 2026-04-24 — DM prompt rebuild + code-verified rules

Six of the seven architectural weaknesses from the audit, fixed. Tone-preset unification (weakness 7) deferred to a proper follow-up once the prelude-to-campaign handoff design is locked — see `FUTURE_FEATURES.md`.

### Weaknesses 1 & 3 — Rules consolidated, memory precedence explicit

- Removed redundancy: duplicate BACKSTORY IS FUEL (had two instances), CONCRETE OVER VAGUE (dupe of SHOW DON'T TELL), LENGTH BY MODE (self-reference), TIMELINE FIDELITY (covered by worldSettingSection).
- New **MEMORY HIERARCHY** section: explicit 6-level precedence for when canon facts, chronicles, conversations, promises, rolling summary, and campaign plan disagree. Removes a whole class of silent contradictions.
- FINAL REMINDER remains 5 checks (tone-honor check pulled back with the tone rework — see FUTURE_FEATURES).

### Weakness 2 — Dead markers moved to conditional injection

Marker specs for WEATHER/SURVIVAL, CRAFTING, MYTHIC, NOTORIETY, and BASE THREATS are now only included in the system prompt when the corresponding session context is present (e.g., `sessionContext.mythicContext` exists). A character without crafting active no longer carries 8 lines of crafting marker spec on every turn. The 360-line always-on marker block is gone.

### Weakness 4 — NPC voice unified

`formatCustomNpcs` no longer renders three overlapping voice sources. When a voice palette exists, it's the single source of truth for how the NPC sounds; personality + background_notes render as "Character Context (background — the VOICE block below is how they sound)". No palette → personality becomes the voice fallback, clearly labelled. The prompt now explicitly says NPCs stay weak/quiet/humorous/taciturn per their palette — the VOICE block is "how they sound", Character Context is "who they are", and the VOICE block wins for speech when they conflict. Language is carefully worded to avoid "authoritative" as a voice directive (which would flatten NPCs toward a generic confident register).

### Weakness 5 — Schema-driven marker validation with invisible correction

New `server/services/markerSchemas.js`: typed schemas for 14 DM markers (required fields, enums, int ranges). `validateDmMarkers(text)` returns `{ validByKey, failures }`. Failures are **stashed on `session_config.pendingMarkerCorrections`** and surfaced in the NEXT turn's system prompt as a "MARKER CORRECTION NEEDED" block. This is invisible to the player — it lives entirely in the system-prompt layer, not in the transcript. Stops the silent-failure class of bug where `[PROMISE_MADE]` typos silently drop and plotholes emerge months later.

### Weakness 6 — Code-verifiers for Cardinal Rules 2 and 4

New `server/services/ruleVerifiers.js`:
- `verifyHardStops` catches "Make a check / Roll your X" followed by >4 more words — Cardinal Rule 2 violation where the AI narrates past the stop point.
- `verifyMetaCommentary` catches parenthetical DM notes, "you succeed on your check", narrated roll outcomes — Cardinal Rule 4 violations.
- `verifyDmResponse(text)` runs all verifiers; violations plug into the same correction-feedback plumbing as marker schemas.

This is the pattern extension the Rule 2 dialogue-violation detector demonstrated. Every mechanical rule that can be code-verified should be — the prompt stops carrying "please remember" for it.

### Files

- New: `server/services/markerSchemas.js`, `server/services/ruleVerifiers.js`, `tests/marker-schemas.test.js` (29 tests).
- Modified: `server/services/dmPromptBuilder.js` (new memory-hierarchy section, conditional marker injection, unified NPC voice, consolidated craft principles), `server/routes/dmSession.js` (wired validators + correction-note injection), `FUTURE_FEATURES.md` (tone-preset integration deferred).

## [1.0.0.89] - 2026-04-23 — Structural hardening pass

Five concurrent improvements targeting the most fragile surfaces in the codebase. No new player-facing features; the point is to stop classes of production bugs from happening again.

### 1. Shared LLM JSON extractor (`server/utils/llmJson.js`)

Fixes the bug class that broke arc-plan generation yesterday. Opus occasionally emits structured responses as TWO separate JSON objects (e.g. `{tone_reflection}` followed by `{home_world, ...}`). The old ad-hoc parsers at every call site used `indexOf('{') / lastIndexOf('}')`, which spliced the two into invalid JSON. `JSON.parse` succeeded on the first object and then threw on the trailing content.

New utility walks the string with a string-aware brace matcher, extracts every balanced top-level object, shallow-merges them, and repairs trailing commas. `tryExtractLLMJson(raw, fallback)` for paths that want graceful degradation.

Migrated 15 services to the shared utility: `preludeArcService`, `partyGeneratorService`, `dmCoachingService`, `campaignPlanService`, `adventureGenerator` (3 parsers), `backstoryParserService`, `livingWorldGenerator` (2 parsers), `questGenerator`, `locationGenerator` (2 parsers), `npcVoiceService`, `npcMailService`, `companionActivityService`, `companionBackstoryGenerator` (3 parsers), `storyChronicleService`, `dmModeChronicleService` (2 parsers). 26 unit tests in `tests/llm-json.test.js`.

### 2. Prelude session hardening

- **Arc-plan generation** retries once with a corrective follow-up when the first JSON response fails extract/validate. The retry quotes the offending response back at Opus and asks for a clean re-emission. Two total attempts. Failure after both returns a descriptive error with 1500-char preview.
- **Marker processing** in `sendMessage` now wraps `processMarkersForSession` and `canonService.buildCanonFactsBlock` in try/catch. A bad canon-fact insert or unexpected DB error no longer 500s the entire turn — the player's AI response still reaches them; marker failures are logged and a safe empty-results shape is returned.

### 3. Prelude session count fixed across prompts

Corrected stale "7-10 play sessions" references in `preludeArcService.js` and `rollingSummaryService.js`. The actual structure is **5 sessions** (Ch1: 1, Ch2: 1, Ch3: 2, Ch4: 1).

### 4. DM session state — merchant shop extracted

19 merchant-related `useState` calls extracted from `DMSession.jsx` (now at 3,011 lines) into `client/src/hooks/useMerchantShop.js`. Same semantics; destructured back into the component. First of a planned series of state-cluster extractions — grouped: shop lifecycle, loaded merchant record, cart drafts, haggle mechanic.

### 5. CLAUDE.md rewritten + ghost-weight pass

- `CLAUDE.md` reduced from 54KB → 24KB. Dropped per-version history (belongs in CHANGELOG), corrected stale claims (`DMSession.jsx` line count, test file count), organized into architecture subsections. Added `server/utils/llmJson.js` + "don't write ad-hoc JSON extractors" rule.
- Deleted retired Phase 8/9 410-Gone handlers in `server/routes/companion.js` — they've been dead since v1.0.16 and any stale caller had plenty of time to update.
- `OPEN_QUESTIONS.md` indexed in CLAUDE.md (previously untracked design doc).



Two quality issues from playtest #3.

### 1. Phantom canon via dialogue definite articles

*"If she asks you about the letter, you don't know anything about the letter."* — But no letter had been mentioned in any prior scene. Definite article ("THE letter") tells the reader the thing is already known; when the AI cold-drops named references this way, it retcons canon that doesn't exist, and the player has no prior scene to anchor on.

New sub-rule under Rule 15a — **DON'T RETCON CANON THROUGH DIALOGUE DEFINITE ARTICLES.** Before writing "the [noun]" in dialogue or narration, the AI must check: has this been established in prior narration, the CANON FACTS block, or the arc plan? If no, three fix options:

1. **Establish first.** Write the scene that introduces the thing, emit a `[CANON_FACT]`, then reference it in dialogue.
2. **Use indefinite article.** "A letter came this morning" signals first introduction cleanly.
3. **Drop the reference.** If the scene doesn't support establishing it, the reference doesn't belong.

Applies to people too — "THE rider" / "THE cleric" / "THE visitor" all need prior establishment. Worked examples (the Moss-letter scenario from the playtest) included.

### 2. "Goes very still" and siblings banned

Playtest feedback: *"'X character goes very still' whenever my character says or does anything unexpected."* This is Claude's single most recognizable narrative tic. New Rule 19a — **BANNED "IMPACTFUL BEAT" STOCK TICS** — lists the top offenders:

- "X goes very still" / "X goes still" / "X stills" — most recognizable
- "Something passes across X's face"
- "X's smile doesn't (quite / fully) reach her eyes"
- "The silence stretches"
- "X sees you now, really sees you" / "X really looks at you"
- "X's jaw tightens" / "X's eyes tighten"
- "X exhales slowly" (as reaction-beat)
- "X's hand / fingers tighten on your shoulder / arm / wrist"

These are signal-shortcuts — they tell the reader "this moment is impactful" without earning it through observed detail.

**What to do instead:** pick a specific physical gesture rooted in the character's body, occupation, and context. Worked examples:

- WRONG: *"Moss goes very still."*
- RIGHT: *"Moss sets the ladle down on the counter. Carefully. The way she does when she doesn't want someone downstairs to hear her put a thing down."*

- WRONG: *"Something passes across Halgrim's face."*
- RIGHT: *"Halgrim looks at the corner of the table. Not at you. The corner. For three breaths."*

- WRONG: *"Her smile doesn't quite reach her eyes."*
- RIGHT: *"She smiles. Her fingers keep folding the hem of her apron even while she smiles, tighter, a little faster than before."*

### FINAL REMINDER updated

Both rules surface at recency:

- **NO "IMPACTFUL BEAT" STOCK TICS (rule 19a)** — lists the banned phrasings
- **NO PHANTOM CANON (rule 15a carve-out)** — the "definite article = already known" test

### Tests + build

- `tests/prelude-prompt.test.js` grew 176 → 190 (+14 tests covering both rule headings, specific banned phrasings, worked replacement examples, FINAL REMINDER surfacing).
- All 7 prelude suites green: 42 + 15 + 130 + 190 + 33 + 76 + 59 = **545 prelude tests total**.
- Client build clean. No schema changes.

### What to watch next playtest

- Named things should appear in NARRATION before they appear in DIALOGUE. If an NPC says "the visitor," you should be able to scroll up and find where the visitor was first shown.
- NPC reaction beats should read as *specific observed gestures* (hands, objects, eyes on a specific thing), not *"X goes still"* or *"something passes across X's face."*

## [1.0.0.87] - 2026-04-22 — Opening canon emission (louder) + Rule 2 violations retry server-side

Two problems from playtest #2.

### 1. Canon not populating after v1.0.86

v1.0.86 added an opening-prompt directive for 8-15 canon facts. Playtest showed it still didn't fire. The instruction was in the middle of the opening prompt, surrounded by other requirements (body description, home senses, family member, first situation), and Opus was prioritizing prose density over markers.

Fix: elevated the directive to the TOP of the opening prompt with authoritative framing.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚑⚑⚑ THIS RESPONSE MUST EMIT 8-15 [CANON_FACT] MARKERS. ⚑⚑⚑
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Sits right below the opening-line intro and PRESENT TENSE reminder. Explains that the opening is the single highest-density moment for canon establishment in the prelude. Names the downstream consequence: *"if you emit fewer than 8 canon facts, the Lore panel will be empty and the player will lose track of everyone."* Explicit *"EMIT EACH CANON FACT INLINE"* guidance so markers appear alongside the prose that introduces the entity, not dumped at the end. Required category coverage listed (npc / location / event / item / trait — hit each at least once). 13 worked examples (up from 8) showing the expected density. Ends with *"Before you submit: count your markers. If it's fewer than 8, STOP and add more."*

### 2. Rule 2 violations now RETRY server-side

User feedback: *"I don't want rules to get broken."* The existing architecture detected violations → flagged the UI → queued correction for next turn. That still lets the violation reach the player.

New flow in `sendMessage`:

1. Call the AI → get response.
2. Run `detectPlayerDialogueViolation` on the response.
3. If violated, re-call the AI with a correction preface that names the violating snippets and gives explicit DO-NOT / INSTEAD-DESCRIBE guidance. Retry's user message ends with *"Produce ONLY the rewritten response. No apology, no meta-commentary, no acknowledgment — just the clean response the player should see."*
4. Detect on retry response.
   - If clean: use retry, no flag surfaced to the player.
   - If retry still violates: use retry anyway (at least it tried), flag the player, inject next-turn correction (old behavior).
5. Save messages, continue normal flow.

Capped at 1 retry to prevent loops. Cost: one extra API call per violation, which is rare. Server logs show *"Rule 2 violation retry on session X: retry cleaned"* or *"retry still violates — flagged"* so we have observability.

### What to look for

**Opening scene**: Lore panel should now have 8-15 entries immediately after the opening renders. If it's still empty, the prompt still isn't loud enough and we need to go further (e.g., reject responses with <5 markers and retry).

**Rule 2**: when a response would have violated, the player should see either (a) a clean response with no warning (retry worked) or (b) a flagged response with a warning badge (retry also failed — rare). Either way, the first attempt doesn't reach the player on its own.

### Tests + build

All 7 prelude suites green (531 tests). Client build clean. No schema changes.

## [1.0.0.86] - 2026-04-22 — Present-tense narration + opening-scene canon emission

Playtest #1 surfaced two prompt gaps in the Thesalian opening:

### 1. Narration was in PAST TENSE

The opening read *"Thesalian stood at the arrow-slit… you had to rise on your toes… you could hear the kitchen through the floor… Benric had sent word."* — past tense throughout. Combined with second person, this reads as retrospective memoir, not inhabited experience. The prompt had no explicit tense rule; the AI defaulted to past.

Fixed with new **Rule 1a — PRESENT TENSE, ALWAYS.** Narration, description, and dialogue attribution are all present tense. Past tense is allowed ONLY inside quoted dialogue or when an NPC is genuinely referring to earlier events. Rule includes a worked wrong/right example comparison and a self-check: if you find yourself writing "stood / watched / heard / sent / had / was / were / could" for what the PC is experiencing now, rewrite to present.

FINAL REMINDER surfaces the rule at recency position.

### 2. Zero CANON_FACT markers emitted in the opening

The opening introduced roughly a dozen named entities — Mosstheliel, Benric, Ser Halrick, Valkineth Dawnbringer, Diona, Sister Alenne, Goodwife Thrale, the Stonelands, Marpenoth, the Feast of the Lion, the sun-in-splendor heraldry, scourge-mark, the garrison, the chapel — and zero markers fired. The Lore panel was empty. Rule 15a's general canon-emission guidance wasn't loud enough to counter the AI's bias toward prose-over-markers in a dense opening scene.

Strengthened the opening prompt with a dedicated **CANON EMISSION IS ESSENTIAL IN THE OPENING** section:

- Quantitative target: **8-15 canon facts** in the opening scene (vs. the usual 3-6/session cadence — openings are denser).
- Explicit instruction to emit one per named NPC, place, cultural item, heraldry piece, calendar reference, historical event.
- Worked examples for all 5 category types (npc / location / event / item / trait) — Mosstheliel, Valkineth, the Stonelands, Marpenoth, Feast of the Lion, sun-in-splendor, scourge-mark.
- Notes the downstream consequence: *"if you omit canon facts here, the player has no context panel to reference when these names recur."*

### Tests + build

- `tests/prelude-prompt.test.js` grew 161 → 176 (+15 tests for Rule 1a presence, worked example, live-vs-memoir framing, FINAL REMINDER surfacing, opening-prompt canon-emission heading, quantitative target, worked examples across all 5 categories, Lore-panel reference).
- All 7 prelude suites green: 42 + 15 + 130 + 176 + 33 + 76 + 59 = **531 prelude tests total**.
- Client build clean. No schema changes.

### What to look for in the next opening

- Narration in present tense: *"You stand at the arrow-slit…"* not *"You stood at the arrow-slit…"*
- Lore panel populated with 8-15 canon facts after the opening renders — named NPCs, places, events, heraldry, cultural terms all visible for reference.

## [1.0.0.85] - 2026-04-22 — Hotfix (cont.): CharacterManager was still wrapping PreludeSession in `.container`

v1.0.84 removed the `.container` className from PreludeSession's OWN outer shell — but `CharacterManager.jsx` (the parent) was ALSO wrapping the session in `<div className="container">` at line 203. That outer wrapper is what drew the big dark outlined box around the play+Lore flex row in the playtest screenshot.

Fix: when `preludeSessionCharacter` is active, CharacterManager now returns PreludeSession directly (no `.container` wrapper). The session owns its own layout + chrome. When preludeSessionCharacter is null, CharacterManager uses the `.container` wrapper as before for the character-list view.

This is an early-return pattern — the expansive PreludeSession gets full page control; the narrower CharacterManager views keep their container chrome.

### Tests + build

Pure UI fix. All 7 prelude suites still green (516 tests). Client build clean.

## [1.0.0.84] - 2026-04-22 — Hotfix: container chrome was wrapping the outer shell instead of each panel

v1.0.83 broke the visual layout. The `.container` CSS class from `index.css` adds background + border + 2rem padding + backdrop-filter — and I was applying it to the OUTER shell (now 1668px wide with a centered flex row inside). Result: a huge dark rounded box with the play area centered in it and a big empty region visible beside it (especially obvious when Lore was closed — the shell was drawing its chrome around the empty flex space).

Fix: outer shell drops the `.container` className and is pure layout (`margin: 0 auto`, `maxWidth`, `padding: 0 1rem`). The play-area wrapper inherits the same chrome as before (`background`, `border`, `borderRadius`, `padding`, `backdropFilter`) inline, so visually the play area looks identical to the pre-v1.0.82 layout — just scoped to the 1200px wrapper instead of the whole shell.

PreludeLorePanel already had its own chrome in docked mode (from v1.0.82), so it's unchanged.

### Loading + error states

These still use `className="container"` since they're single-panel views that don't need the wide layout. Narrowed them explicitly to `maxWidth: 860px` so they don't stretch to the wide shell size.

### Tests + build

All 7 prelude suites still green (516 tests). Client build clean.

## [1.0.0.83] - 2026-04-22 — Lore pops out right (doesn't shrink play area) + title/meta simplified + Auto alignment

Three polish items from the v1.0.82 screenshot review.

### Lore panel now pops out to the right without shrinking the play area

v1.0.82's docked Lore shared the shell's flex row — so when Lore opened, the narrative column shrank to make room. User feedback: the play area should keep its width; Lore appears alongside it, not inside it.

Restructure:

- Shell wraps a single flex row with `justifyContent: center`.
- **Play area wrapper**: fixed `width: 1200px`, `flex-shrink: 0`. Top bar, messages, wrap-up, and input all live inside this wrapper. The play area keeps this width regardless of Lore state.
- **Lore popout**: 420px wide sibling of the play area. When toggled on, it appears to the right of the play area; the combined unit (play + gap + Lore = ~1636px) centers together inside the shell.
- **Shell max-width**: bumped to accommodate play + gap + Lore + padding (~1700px).

When Lore is closed, only the play area renders and it centers alone. When Lore is open, both render side-by-side and the combined unit centers. Play area width never changes.

This is the sibling-dock pattern for future panels. Map panel (eventually) will slot into the same position or a third column using the same approach.

### Title + meta simplified

- **Title**: was *"✦ [Nickname or First Name]'s Prelude"* — now *"✦ [First Name] [Last Name]"* (with fallback to `character.name`).
- **Meta line**: was *"Session X · Chapter X of 4 — Early Childhood · Age 6 [HP X/X]"* — now *"Session X - Chapter X - Age X - HP X/X"* (hyphen-separated, no "of 4", no chapter name).

### Auto toggle flattened

The column-wrapper around the Auto toggle + resolve-reason indicator was making the toggle taller than its sibling buttons, misaligning the row's baseline. Removed the wrapper; Auto is now a single-line label matching the other buttons' height.

The resolve-reason indicator is gone from the UI (it was noise in common cases). When Auto is on AND last turn resolved to Opus, a tiny **"→opus"** marker appears inside the Auto label itself. The tooltip on hover carries the reason when one exists.

### Tests + build

Pure UI. All 7 prelude suites still green (516 tests). Client build clean.

### Note on future Map panel

User confirmed the map (if/when built in campaign play) would use this same pop-out-right pattern. Either as an alternate panel in the same slot as Lore (toggle between them) or as a second side panel (play + lore + map, three columns). The infrastructure here supports either.

## [1.0.0.82] - 2026-04-22 — Desktop-friendly play area: wider shell, docked Lore panel, compact top bar

Player feedback: the 860px-max narrative column left most of a desktop monitor empty, and the Lore slide-in panel wasted the natural right-hand rail that was sitting right there. Top bar buttons were also bulkier than they needed to be.

### Shell — widened to use desktop real estate

`shellStyle.maxWidth` changed from 860px → 1800px with 1rem side padding. Content centers on truly wide monitors (ultra-wide doesn't stretch forever) but fills everything up to ~1800px of horizontal space.

### Flex two-column content row

Content area below the top bar is now a flex row:

- **Narrative column** — `flex: 1`, grows to fill available space. Contains the message scroller (now `flex: 1, minHeight: 60vh` instead of `maxHeight: 60vh`), the session wrap-up banner, and the input bar. Input width tracks the narrative column so it doesn't extend under the Lore panel.
- **Lore column** — 420px fixed width, `flex-shrink: 0`, only rendered when Lore is toggled on. No longer a `position: fixed` slide-in overlay.

When Lore is closed, the narrative column takes the full width. When Lore is open, narrative shrinks to leave room and Lore sits sticky at the right.

### PreludeLorePanel — new `docked` mode

`PreludeLorePanel` takes a new `docked` prop. When `true`, container uses `position: sticky` + rounded border + height-constrained overflow, rendering inline inside its parent column. When `false` (default), the old fixed-position slide-in behavior is preserved for any consumer that still uses it. Close button is hidden in docked mode since the top bar's Lore toggle does the toggling.

### Top bar — compact uniform buttons

All action buttons (Lore / Setup / End / Characters) now use a shared compact spec: `0.35rem 0.65rem` padding, `0.78rem` font, `nowrap` whitespace. Smaller without feeling cramped. Renamed *"End session"* → *"End"* for visual weight balance. Tooltips added on hover for each button.

The "last turn → sonnet" indicator under the Auto toggle now only shows when Auto is on AND the last turn resolved to Opus (or had a non-null resolve reason). Sonnet→Sonnet is the uninteresting default; hiding it cuts noise. Text also compacted from *"last turn → opus · heavy-weight"* → *"→ opus · heavy-weight"*.

### No schema or API changes

Pure UI restructure. All 7 prelude suites still green (516 tests). Client build clean.

### Known follow-ups (not shipped here)

- The Setup panel is still an inline expanded section above the message feed. Could also be converted to a dockable right-side panel (sibling to Lore), but one-at-a-time or two-column right-side is a bigger UX decision — deferring to a future round based on playtest feedback.
- Wrap-up screen and setup panel span only the narrative column width. If you find wrap-ups feel cramped at certain viewport sizes, they can be expanded.

## [1.0.0.81] - 2026-04-22 — Hotfixes: tone_reflection storage column + departure seed is a seed, not a verdict

Two bugs surfaced in the next playtest of v1.0.80:

### 1. tone_reflection was being silently dropped on INSERT

The tone card on re-rolled arc plans still showed the "pre-v1.0.79" fallback note. Cause: the arc plan is stored in NORMALIZED columns (`home_world`, `chapter_1_arc`, etc.), not a single JSON blob. The new `tone_reflection` field had no column, so the INSERT dropped it. `getArcPlan` returned null for the field. UI fell through to the fallback.

Fix: migration 045 adds `tone_reflection TEXT` to `prelude_arc_plans`. INSERT writes `parsed.tone_reflection`, `getArcPlan` returns `row.tone_reflection`. Old arc plans have NULL — graceful fallback preserved. Next time you re-roll, the actual AI interpretation renders.

### 2. departure was pre-deciding even though theme commitment should govern

v1.0.77 added theme-commitment-at-Ch3 as the mechanism that decides the departure TYPE. But the arc plan still had `departure_seed.reason` as a single-valued field, and Opus was writing things like `reason: "call_to_adventure"` — locking in a departure before the theme-commitment ceremony ever fires. The preview rendered it as *"Departure: call_to_adventure — determined, weighted"* which looked (and was) authoritative.

Fix: schema reshape.

**Before (v1.0.77-80):**
```json
"departure_seed": {
  "reason": "pilgrimage | test | conscription | exile | ...",
  "tone": "hopeful | bitter | ...",
  "non_tragic_alternatives": [ "..." ]
}
```

**After (v1.0.81):**
```json
"departure_seed": {
  "primary_thread": "what most likely pulls them out — 1 sentence, no theme-lock",
  "plausible_shapes": [ "3-4 short lines, theme-compatible shapes, never all same type" ],
  "tone": "1-3 words (hopeful / bitter / determined / numb / wistful)"
}
```

No single "reason" field. Opus's new job: seed the possibility space, not close it. The prompt's rule 11 Ch4 section got a loud *"⚠ IMPORTANT — DO NOT PRE-DECIDE THE DEPARTURE"* warning plus a reminder that the committed theme drives the final type.

Preview UI rewritten:

- Card titled **DEPARTURE SEED** (not "Departure")
- Italic caveat: *"The final departure is decided at Chapter 3's theme commitment. These are plausible shapes, not a verdict."*
- "What most likely pulls them out: [primary_thread]"
- "Plausible shapes (theme at Ch3 picks from these or overrides):" [bulleted list]
- Back-compat: old arc plans with just `reason` still render under a *"Legacy seed:"* label so nothing crashes.

### Tests + build

- All 7 prelude suites still green (516 tests). Schema change is read-write-symmetric; existing tests didn't exercise the `reason` field specifically.
- Client build clean.

Combined effect: re-rolling now produces a proper tone_reflection (visible in the Tone card) AND a non-pre-decided departure seed (visible as plausible shapes, making the theme commitment moment feel earned).

## [1.0.0.80] - 2026-04-22 — Tone card: arc-specific reflection only, no preset boilerplate

v1.0.79's Tone card showed both the generic preset description (which the player had already read at setup) AND the AI's arc-specific `tone_reflection` below it. Result: redundant, and when the character had an old arc plan without the reflection, the card was just a repeat of the setup-time description with no arc-specific signal at all.

Simplified to show ONLY arc-specific content:

- **Header line**: preset name + reference works inline (compact — *"Tone: Epic Fantasy — ref: Tolkien, Brian Staveley, Robert Jordan"*)
- **Body**: the `tone_reflection` from the arc plan as the primary content
- **Fallback for old arc plans**: italic note — *"This arc plan was generated before tone reflection was added. Re-roll to see how the AI interprets this tone for your specific character."*

If you have a pre-v1.0.79 arc plan, the fallback tells you to re-roll. If you generate a fresh arc, you see the AI's specific interpretation for your character.

### Tests + build

Pure UI change. Tests unchanged — all 7 prelude suites still green (516 tests). Client build clean.

## [1.0.0.79] - 2026-04-22 — Arc preview: 5-session copy fix + visible tone reflection

Two small but important fixes to the post-setup arc preview (what the player sees after the 12-question setup wizard, before they begin playing).

### The "seven-to-ten-session" copy bug

`PreludeArcPreview.jsx` still said *"A seven-to-ten-session shape for your character's first twenty years"* — left over from before v1.0.76's 5-session restructure. Setup wizard also still said *"You'll play through 7-10 sessions of their growing up."* Both updated to "five" / "5 focused sessions."

### Tone reflection — the AI's understanding made visible

User feedback: they couldn't tell from the arc preview whether the AI had actually internalized the tone preset or was just running a generic arc with tone as decoration. Fix: Opus now emits a `tone_reflection` field in the arc plan JSON — 2-3 sentences citing the preset BY NAME and naming at least one specific register choice (vocabulary, scene-type treatment, age-scaling approach) it's leaning into for THIS character's arc.

Example output for a Rustic & Spiritual setup:
> *"Rustic & Spiritual shapes this arc around the temple calendar — feast days mark time, Sister Halene's prayers frame the home, and the first-rupture at chapter 2 will be a crisis of faith when a shrine goes cold."*

The arc preview now renders a dedicated **Tone** card at the top (purple accent) showing:
- The selected preset's label + description + reference works (from the player-facing card)
- A sub-panel titled *"HOW THE AI IS INTERPRETING THIS TONE"* with the `tone_reflection`

Old arc plans (pre-v1.0.79) don't have this field — the card renders without the reflection sub-panel. Graceful fallback.

### Schema + prompt changes

`preludeArcService.buildArcSystemPrompt` adds `tone_reflection` to the top of the required JSON output schema and a FINAL REMINDER line flagging it as required with specific content requirements. No migration needed — the arc plan is stored as a JSON blob and just gets the new field.

### Tests + build

- Existing tests unchanged — no new server logic tested specifically for this schema change (the field either appears in Opus output or doesn't; failure mode is a missing UI section, not a crash).
- All 7 prelude suites still green (516 tests). Client build clean.

## [1.0.0.78] - 2026-04-22 — Proper session wrap-up screen

The pre-existing session-end banner was thin: session number, a chapter/age line (still referencing the outdated "~7-10 sessions" from before v1.0.76), AI-generated prose recap, cliffhanger, two action buttons. No sense of what happened mechanically — which emergences got accepted, what canon facts landed, which NPCs the player met, how HP trended, whether a chapter or age advanced.

Upgraded to a proper wrap-up screen.

### What's new on the wrap-up screen

- **Progress indicator** — 5-segment bar showing session N of 5. Filled purple through the just-completed session, dim for future sessions.
- **Prose recap** — unchanged (v1.0.55 Sonnet-generated, with accepted emergences woven in per v1.0.56).
- **SESSION HIGHLIGHTS** — new structured section (amber accent, only renders sections with content):
  - ⚑ **Path chosen** — if theme committed during the session (v1.0.77 ceremony), shown here
  - ↑ **Chapter advanced** — e.g. "Chapter 1 → 2"
  - ⏳ **Age advanced** — "+3 years — age 9"
  - ✦ **Emergences accepted** — each stat/skill the player accepted, with reason
  - 👥 **Met** — NPCs canonized this session, with relationships
  - 🗺️ **Places named** — locations canonized
  - 📜 **Canon facts added** — count + pointer to Lore panel
  - 💔 **Net HP change** — total delta across the session + recent reasons
- **Cliffhanger** — moved to its own card (purple accent, "CARRIED FORWARD" header)
- **Action footer** — "Begin Session N+1" + "Back to characters"

### How it's wired

Client-side accumulation — no extra server endpoints needed. A new `sessionSummary` state in `PreludeSession.jsx` accumulates as each turn's marker payload flows through:

- `markers.canonFactsAdded` / `markers.npcsCreated` / `markers.locationsCreated` → appended to running arrays
- `markers.hpDelta` → summed into `totalHpDelta`
- `markers.hpReasons` → kept as a rolling last-10
- `markers.chapterAdvanced` / `markers.ageAdvanced` → latched (last value wins per session)
- Emergence acceptances → pushed when the player clicks Accept (captured from the message-feed record at commit time)
- Theme commitments → pushed when the Choose Your Path card fires `onCommit`

Reset at resume: when the player begins a new play-session (`handleResumeSession`), the summary clears so the next wrap-up starts fresh.

### The "7-10" copy fix

Previous copy: *"Chapter X of 4 · chapterName · Age Y · ~7-10 sessions total in a prelude"* and *"Ready for Session N+1? Or pick this up later."* The "7-10" was left over from the pre-v1.0.76 structure. Now reads *"Session N of 5 complete"* at the top, *"Ready for Session N+1 of 5?"* as the next-step prompt, and *"This is the final session of the prelude — the arc approaches the Threshold."* at session 5.

### What's NOT in this release

- **Character state snapshot** (current stats, accumulated skills, theme trajectory top-3) — the Setup panel already shows these, so not duplicated here. Could add if the wrap-up feels thin during playtest.
- **Server-computed session summary** — pushed off; client-side accumulation is sufficient and needs no DB round-trip. Can convert later if client state proves unreliable (e.g., the player reloads mid-session).
- **Final-session wrap-up** (after `[PRELUDE_END]`) — deferred to Phase 5's transition-to-primary-campaign flow. This release covers intermediate-session wrap-ups only.

### Tests + build

- Tests unchanged — wrap-up is pure UI with no new server logic to exercise. All 7 prelude suites stay green (516 tests).
- Client build clean. No schema changes.

## [1.0.0.77] - 2026-04-22 — Theme commitment at Ch3 wrap-up drives Ch4 departure

User insight (from playtest discussion): tone shouldn't deterministically shape the departure — that makes Brutal & Gritty always conscription, Tender & Hopeful always apprenticeship. Instead, the player's character choices throughout the story should drive which theme emerges, and the theme should drive the departure. A Brutal & Gritty Soldier departs for war. A Tender & Hopeful Soldier departs for a quiet enlistment. A Brutal & Gritty Acolyte might go on a grim pilgrimage; a Tender & Hopeful Acolyte to a pastoral apprenticeship. Theme drives TYPE, tone drives FEEL.

Landing moment: Chapter 3 wrap-up — after the irreversible-act beat, when the PC has DONE the things that define who they're becoming.

### New data model

- Migration 044: `characters.prelude_committed_theme TEXT` + `prelude_committed_theme_at TEXT` (nullable).

### New service — `preludeThemeService.js`

- `ALL_THEME_IDS` — canonical list of 21 themes (mirrors `server/data/themes.js`).
- `THEME_DEPARTURE_MAP` — 21-entry theme-id → departure-type-clause map:
  - `soldier` → *enlistment, military posting, war-call, conscripted levy, mercenary contract*
  - `sage` → *academy, library, master's teaching, research expedition*
  - `acolyte` → *pilgrimage, calling, vigil, temple assignment, a vision that demands travel*
  - `guild_artisan` → *apprenticeship posting, a master in another town*
  - `outlander` → *leaving to explore, wanderlust, a map, a rumor of the deep places*
  - `folk_hero` → *the call to adventure, a village in need beyond yours, a standard raised*
  - `criminal` → *flight from consequences, exile, a crew that needs a new member*
  - `charlatan` → *flight from consequences, a mark that got too close*
  - `hermit` → *the insight you found requires sharing, or the world requires your absence*
  - `knight_of_the_order` → *a quest, an oath-pilgrimage, a vow to uphold*
  - `noble` → *political match, duty-to-crown, dynastic journey*
  - *…15 more themes mapped in the same shape.*
- `buildThemeOffer(characterId)` — pulls all `theme` kind rows from `prelude_emergences`, applies chapter weighting (1.0x Ch1-2, 1.5x Ch3, 2x Ch4), returns `{ leading, alternatives[], wildcard, reason, trajectoryScores[] }`. Wildcard comes from a talent/care → theme lean map when the trajectory hasn't reached it — surfaces a fresh option the player might not have expected.
- `commitTheme(characterId, { theme, reason, source })` — validates against `ALL_THEME_IDS`, writes to `characters`. Null = explicit defer.
- `getCommittedTheme(characterId)` — read path.
- `getDepartureTypeForTheme(themeId)` — helper for the Ch4 prompt.

### New marker — `[THEME_COMMITMENT_OFFERED]`

Fires at Ch3 wrap-up AFTER the irreversible-act chapter_end_moment. Server recomputes the authoritative offer from the trajectory + setup wildcards (doesn't trust fields in the marker — the AI doesn't have the full trajectory data), attaches it to the `markers.themeCommitmentOffer` response payload. Stripped from display text; the UI renders a "Choose Your Path" card inline below the narration.

### New endpoints

- `POST /api/prelude/:characterId/commit-theme` — writes the chosen theme (or null for defer).
- `GET /api/prelude/:characterId/committed-theme` — reads the committed theme.
- `GET /api/prelude/:characterId/theme-offer` — rebuilds the offer (for UI rehydration if player navigates away and back).

### Prompt changes

**Ch3 engagement mode** — new THEME COMMITMENT CEREMONY block. Tells the DM:
- AFTER the irreversible-act beat lands, emit `[THEME_COMMITMENT_OFFERED]`
- Lead into the marker with a reflective narrative beat (elder/mentor/sibling framing the "who are you becoming" question, or the PC's own quiet moment)
- DO NOT name specific themes in the narrative — the card does that; the ceremony is emotional, not administrative
- Fire the marker ONCE at wrap-up; never at chapter open

**Ch4 engagement mode** — reads `runtime.committedTheme`. If set, the block includes a COMMITTED THEME header plus the theme-specific departure type clause from `THEME_DEPARTURE_MAP`. Teaches: *"Tone preset modulates the FEEL, not the type. A soldier departing in Brutal & Gritty reads very differently from a soldier in Tender & Hopeful or Epic Fantasy — match the tone's register. But the TYPE (how they leave, under what banner, for what reason) comes from the theme."* If no theme committed, falls back to arc plan's departure_seed + trajectory winner with non-tragic-variety emphasis preserved.

Old per-tone-preset departure leans (v1.0.76: *Brutal & Gritty leans conscription/flight; Tender & Hopeful leans apprenticeship/pilgrimage; Epic Fantasy leans call-to-adventure*) are replaced. Tone no longer prescribes departure type.

### New UI component — `PreludeThemeCommitCard.jsx`

Rendered inline in the message feed (same pattern as emergence toasts) when `data.markers.themeCommitmentOffer` is present. Shows:

- Leading theme button (with "leading" badge)
- Up to 3 alternative theme buttons from the trajectory
- 1 wildcard theme button (talent/care-derived, with "wildcard" badge, amber accent)
- "Other" dropdown → full 21-theme list
- Commit button (enabled only when something is picked)
- "See where it goes" button (commits null → fallback to trajectory winner at prelude end)

On commit, POSTs to the endpoint, then displays a brief confirmation line in the card's place. No page refresh needed.

### PRELUDE_IMPLEMENTATION_PLAN.md

Added design goal **#29** capturing the theme-commitment ceremony.

### Tests

- **New suite `tests/prelude-theme-commitment.test.js`** — 59 tests covering:
  - `[THEME_COMMITMENT_OFFERED]` marker detection (bare, with fields, case-insensitive, roll-up, absence)
  - Marker stripping
  - `ALL_THEME_IDS` (21 themes, specific ids)
  - `THEME_DEPARTURE_MAP` (entry per theme, non-empty, `getDepartureTypeForTheme` lookups)
  - Ch3 engagement mode prompt content (ceremony heading, marker named, wrap-up timing specified, Choose-Your-Path mentioned, "don't name themes in narrative" instruction)
  - Ch4 prompt — no-theme-committed fallback language, theme-committed header+specific departure, theme-specific substring asserts (soldier→enlistment, acolyte→pilgrimage, acolyte does NOT show soldier line), tone-modulates-feel guidance preserved
  - Departure variety (tragedy-never-default language preserved, 5+ varied departure types listed)
- All 7 prelude suites green: 42 + 15 + 130 + 161 + 33 + 76 + 59 = **516 prelude tests total**.
- Client build clean.

### What this fixes

- A Cleric who wants an apprenticeship can get one — pick the Acolyte theme at Ch3 (or Guild Artisan), and tone modulates it from there.
- A Soldier in Epic Fantasy gets a royal summons, not a conscripted peasant levy.
- Tone doesn't deterministically write the departure — the player's played choices do.
- The "Choose Your Path" moment is a real player-agency beat, not a pre-determined outcome.
- Committed theme carries forward — it's the primary campaign's starting theme when Phase 5 (transition to primary campaign) ships.

## [1.0.0.76] - 2026-04-22 — Prelude restructure: 5 focused sessions + per-chapter engagement modes

Playtest feedback: Ch1 was meandering and too ambitious. A 6-year-old's life doesn't have story-shaping choices (no factions, no quests, no world-changing decisions) — just character-shaping ones (hide or run, obey or defy, share or hoard, attentive or drift). The arc generator was designing Ch1 beats like adventure hooks, and the DM tried to make the PC own choices they couldn't honestly own. Meandering was the symptom; the actual problem was that no layer of the system knew what engagement-mode belonged to which chapter.

This release condenses the prelude to 5 focused sessions and gives each chapter a dedicated engagement mode.

### New structure — 5 focused sessions

| Chapter | Mode | Sessions | Combat |
|---|---|---|---|
| **Ch1 — Foundations** | OBSERVE (+ character-shaping choices) | 1 | none — PC too young |
| **Ch2 — Widening** | LEARN (+ training combat enters) | 1 | schoolyard scuffles, wooden swords, bruises not scars |
| **Ch3 — Forging** | DECIDE (+ real combat) | 2 | bodies matter, wounds leave marks |
| **Ch4 — Threshold** | COMMIT (+ varied non-tragic departure) | 1 | culmination |

Total: 5 sessions at ~50 exchanges each (longer, focused).

### Per-chapter engagement modes

Each chapter has a primary mode that tells the AI what kinds of scenes and choices belong in it. Modes are injected dynamically into the DM prompt as Rule 5a based on `runtime.chapter` — only the CURRENT chapter's mode appears in the prompt, so there's no catalog pollution.

**Ch1 — OBSERVE + character-shaping choices.** Primary engagement is witnessing and relationship-forming, NOT adventuring. YES to hide-or-run / obey-or-defy / speak-or-stay-silent / attentive-or-drift / which-chore-first / share-or-hoard. NO to picking factions, committing to quests, plot-shaping decisions. NO combat at this age. Roll prompts are frequent (Perception, Intelligence, Insight, Dexterity, Wisdom, Athletics) for noticing / recalling / calming / slipping past / carrying.

**Ch2 — LEARN + training combat.** The world widens. First friend outside family, skill learned from an elder, first secret kept, first lie attempted. Training combat enters — schoolyard scuffles, wooden swords, real dice, low stakes. Bruises not scars.

**Ch3 — DECIDE + real combat.** Real agency, real consequences. First alliance forged, first oath, first irreversible act. Real combat: bodies matter, wounds leave marks, the PC can be hurt. Chapter opens with CHAPTER_PROMISE.

**Ch4 — COMMIT + varied non-tragic departure.** The question is no longer "what will I do" but "who am I leaving as." Departure options expanded and explicitly non-tragic-default:

- Enlistment (call to military service)
- Apprenticeship posting (craft/smithy/temple)
- Pilgrimage (faith or self-discovery)
- Finding a cure (for a loved one, for oneself)
- Leaving to learn (academy, temple, master, library)
- Leaving to explore (wanderlust, map, rumor)
- Coming-of-age quest or test
- Political match (betrothal journey)
- Conscription (world calls, PC answers)
- Exile (when story earned it)
- Tragedy (ONE option among many — NEVER default)

The tone preset shapes which options fit: Brutal & Gritty leans conscription/flight; Tender & Hopeful leans apprenticeship/pilgrimage; Epic Fantasy leans call-to-adventure/quest; Rustic & Spiritual leans pilgrimage/vision-quest.

### Arc-plan generator updates

`preludeArcService.js` cardinal rules grew a new rule 11 — PER-CHAPTER ENGAGEMENT MODES — spelling out the YES/NO beat criteria for each chapter. Opus now designs Ch1 arcs with observational beats only, Ch4 arcs with multiple non-tragic departure alternatives, etc.

### DM session prompt updates

`preludeArcPromptBuilder.js`:
- New `engagementModeBlock(chapter, age)` helper renders the per-chapter mode with concrete examples, YES/NO lists, roll-prompt guidance, and target beat count.
- Injected as Rule 5a in the cardinal rules.
- Rule 11a (per-chapter session budget) updated from `~7-10 sessions, Ch1 1-2, Ch2 2, Ch3 2-3, Ch4 2-3` to the new `5 focused sessions, Ch1 1, Ch2 1, Ch3 2, Ch4 1` distribution.
- Opening line reduced from "7-10 sessions" to "5 focused sessions."
- Character block session counter switched from "X of ~7-10" to "X of 5."

### PRELUDE_IMPLEMENTATION_PLAN.md

Added design goal **#28** capturing the 5-session condensed structure + per-chapter engagement modes.

### Tests

- `prelude-prompt.test.js` grew 130 → 161 (+31 tests covering all 4 chapter mode blocks, the YES/NO example checks, Ch1 no-combat, Ch2 training-combat, Ch3 real-combat / bodies-matter / 2-session-target, Ch4 departure-options count ≥ 8 / tragedy-never-default / DEPARTURE+PRELUDE_END markers, and 5-session structure references at the prompt-opening + character block + rule 11a).
- All 6 prelude suites green: 42 + 15 + 130 + 161 + 33 + 76 = **457 prelude tests total**.
- Client build clean.
- No schema changes; no UI changes; purely a prompt/guidance restructure.

### What this fixes

- Ch1 stops trying to be a mini-adventure. It becomes what it's supposed to be: a tight, atmospheric, character-revealing session that shapes relationships and ends on a first-crack — not a quest.
- Combat has a proper ladder: absent at 5-8, training-only at 9-12, real at 13+.
- Departures get proper variety. Tragedy is one option among many, not the default.
- The arc and DM layers now speak the same language — each chapter has a named mode that both sides honor.
- Total playtime is more manageable: 5 sessions of ~50 exchanges = ~250 exchanges to get through the prelude, vs. an ambiguous "7-10" that was sliding toward 10+.

## [1.0.0.75] - 2026-04-22 — Rule 2 state-attribution detector + Auto default + Lore panel + anachronism tightening

Playtest #1 with the new tone preset system surfaced four distinct issues. Bundled into one release.

### 1. Rule 2 detector missed non-quoted state attribution

Transcript from the playtest: *"You like the stag. The stag is looking back over its shoulder..."* The old detector caught quoted dialogue (`"...", you say`) but not bare state assertions like *"you like,"* *"you remember,"* *"you decide."* The AI was declaring the PC's preferences and memories without the player having a say — exactly the violation Rule 2 forbids.

**Pattern C added to `preludeViolationDetection.js`:** matches `\byou\s+(adverb?)\s+STATE_VERB\s+CONTENT` where STATE_VERB covers preferences (*like, love, hate, prefer, want, enjoy*) and cognition (*think, know, remember, decide, realize, believe, recognize, recall, wonder*). Includes the same inside-quote guard as Patterns A/B (so NPC dialogue containing *"you know what this means"* doesn't false-positive), plus a new interrogative guard — if the enclosing sentence ends in `?`, it's the AI asking the player something (*"Do you remember what Halda said?"*), not attributing state. Skip.

**Kept allowed:** sensory (*you see, you hear, you feel the cold stone*) and movement (*you walk, you turn*) — per Rule 2's explicit carve-out for involuntary physical sensation and PC-body narration in service of player action.

Tests grew 52 → 76 (+24), covering the user's stag transcript, preference/cognition verb coverage, legitimate perception+movement non-matches, question-mark guard, and NPC-dialogue inside-quote rejection.

### 2. Auto mode now default + picker simplified to two-state toggle

Auto-mode used to require a per-session opt-in via the 3-button picker (auto / sonnet / opus). User reported needing to manually re-enable it each session. Now:

- New sessions default to `model: 'auto'`.
- `getResumePayload` now returns `'auto'` as fallback for unrecognized/absent stored mode (was `'sonnet'`).
- UI replaced the 3-button picker with a single checkbox-style toggle: **Auto (on)** or **Auto (off) = Sonnet always.**
- Manual Opus-always is no longer a UI option (rarely the right choice; the auto escalator handles heavy beats). Server still accepts `'opus'` in the API for legacy session state.

### 3. Anachronism tightening — modern legal/bureaucratic vocab explicitly banned

Playtest produced a funny exchange — an NPC saying *"I thought the statute had run"* — which the user wanted to preserve the humor of (dry wit is welcome) but flagged as anachronistic (statutes of limitations are a modern legal concept).

**Rule 15 updated** with a NO MODERN LEGAL/BUREAUCRATIC VOCABULARY section listing banned phrasings: *statute, statute of limitations, jurisdiction (modern civic sense), plea, prosecute, indictment, plaintiff, code of law, statutory, legal precedent, court date, civil rights, police, detective, officer (as job title — use guard, watchman, sergeant-of-the-watch).* Explicit instruction: **wit and humor are welcome; modern framing is not.** Worked examples of period-correct wit provided (*"the question hasn't been answered in three years — I'd say the matter has gone stale"* instead of *"the statute has run"*).

### 4. New dedicated Lore panel

User report: *"The Reaving"* was referenced by an NPC without the player having any context. The canon ledger existed in the Setup panel (v1.0.60) but was buried and compact. Now:

- **New `PreludeLorePanel.jsx`** — dedicated slide-in, accessed via a new **Lore** button in the session top bar (amber accent, distinct from Setup's purple).
- Groups canon facts by category with **Events & Lore** promoted to the top (the category that holds world-history facts).
- Search filter across subject + fact text.
- Larger typography than the Setup panel's compact ledger.
- Each category has a hint line explaining what belongs there (e.g., *Events & Lore — "World happenings, named historical events, regional history, threats"*).

**Rule 15a strengthened** to require canon-fact emission for **named world events** the PC encounters in dialogue or narration. If an adult mentions "The Reaving" / "the Year of Two Winters" / "the Battle of Three Rivers" / any event the PC would be expected to know about, the DM MUST emit `[CANON_FACT category=event]` capturing what's commonly understood (what happened, when, who was involved, consequences). Included a worked example for The Reaving.

### Future work discussed (NOT in this release)

- **Stratified lore by PC background** — descriptions of each event tailored to noble-child vs. common-child vs. noble-adult vs. common-adult. User-confirmed high-value but deferred. Would likely land as v2 after we've built up a body of canonical world events.
- **Prelude structure rebalance** — user's critique that Ch1 is too long/meandering (6-year-olds see and learn; they don't DO as much as the current arc suggests). Separate design conversation deferred to a follow-up release.

### Tests + build

- New Pattern C tests in `prelude-violation-detection.test.js`: 52 → 76 (+24 tests).
- Setup tests updated for v1.0.73+ preset system: 38 → 42 (+4 tests validating exact-1-preset rule).
- All 6 prelude suites green: 42 + 15 + 130 + 130 + 33 + 76 = **426 prelude tests total**.
- Client build clean.
- No schema changes.

## [1.0.0.74] - 2026-04-22 — Hotfix: server-side tone validation still required 2-4 tags

v1.0.73 replaced 16 combinable tags with a single preset everywhere except `server/services/preludeService.js`, which still rejected submissions with fewer than 2 tone_tags:

```
Error: Invalid setup: Pick 2-4 tone tags
```

### Fix

`validateSetupPayload()` now checks for exactly 1 tone_tag and that the value is one of the four known preset keys (`brutal_gritty`, `epic_fantasy`, `rustic_spiritual`, `tender_hopeful`). Any unknown preset is rejected with a clear error including the unknown value.

Client-side and server-side validation now match.

### Tests + build

- No new tests — existing suites already covered prompt rendering with single preset values. The validation path is exercised by the `POST /api/prelude/setup` endpoint, which wasn't test-instrumented before and still isn't (server integration test follow-up noted).
- All 6 prelude suites still green (398 tests).
- Client build clean.

## [1.0.0.73] - 2026-04-22 — Tone preset system: 4 curated presets with full "tone bibles"

Play-test feedback: the old 16-tag combinable tone system wasn't landing. Selecting "gritty + hopeful" vs "epic + mystical + tragic" didn't produce noticeably different prose — the AI defaulted to a mid-register literary fantasy regardless of tags. Three compounding reasons: the AI saw all 16 tag definitions every turn (14 of them irrelevant — signal polluted by noise); guidance was abstract, not exemplified; combinations were under-specified so the AI picked one tag and ignored the rest.

v1.0.73 replaces the system entirely.

### 4 curated presets replace 16 combinable tags

Player picks ONE at setup time. Each preset is a fully designed "tone bible":

- **Brutal & Gritty** — Medieval realism, no softening. Political intrigue, real violence, lean years. *Reference works: early ASOIAF, The Witcher, Joe Abercrombie.*
- **Epic Fantasy** — Mythic weight in small moments. The big currents of the world touch the village. *Reference works: Tolkien, Brian Staveley, Robert Jordan.*
- **Rustic & Spiritual** — Land, faith, and season. Priests, elders, and dreams are trusted. *Reference works: Patricia McKillip, Le Guin's Earthsea, Naomi Novik's Uprooted.*
- **Tender & Hopeful** — Small-scale, warm, intimate. Family-scale stakes. *Reference works: T. Kingfisher's Saint of Steel, Katherine Addison's Goblin Emperor, Becky Chambers.*

### What "tone bible" means structurally

Each preset has server-side content (`server/data/tonePresets.js`) with:

- **Register rules** — sentence length, diction level, figurative-language budget, prose rhythm.
- **Vocabulary anchors** — 10-15 words/phrases that signal the register (Brutal & Gritty: *callused, scabbed, lean year, heel of bread, watery, threadbare*; Epic Fantasy: *storm-colored, old as stone, the weight of, out of the north*).
- **Scene-type guidance** — per-scene-kind posture (combat, dialogue, travel, home, ritual/politics). A fight scene in Tender & Hopeful reads differently than a fight scene in Brutal & Gritty.
- **Age-scaling across chapters** — the register persists; intensity grows. Brutal & Gritty at Ch1 is PROXIMITY (child witnesses violence at a distance); at Ch4 it's OWNERSHIP (character IS the scarred young adult). Epic Fantasy at Ch1 is "the epic LEAKS IN"; at Ch4 "the epic COMMITS." User-requested addition — the register stays constant, but intensity scales with age.
- **Exemplar prose** — 2 sample paragraphs (Ch1 opening + mid-chapter) so the AI has a concrete anchor.

### Prompt-level changes

- **Rule 14 rewritten** — no longer dumps all 16 tag definitions. Now names the selected preset and points at the dedicated TONE block below.
- **New dedicated TONE block** — injected into every system prompt between the EMERGENCE block and the MARKERS block. Renders the full bible for the ONE preset the player picked. The other 14 unrelated tag definitions are gone from the prompt.
- **FINAL REMINDER** — applied direction ("A fight scene in Tender & Hopeful reads differently than a fight scene in Brutal & Gritty — honor the preset, not the scene type"), not just a tag list.
- **Opening prompt** — "Open IN-REGISTER per the TONE block... match register rules, vocabulary anchors, and Chapter 1 age-scaling tier. Not generic literary fantasy."
- **Arc-plan generator** — receives the preset short-block (label + description + references) instead of concatenated tag labels. Opus shapes home world and chapter arcs in-register at setup time, baking tone into ground truth (not just a runtime rule).

### UI changes

- `PreludeSetupWizard` Q11 converted from multi-select chip bar (pick 2-4 of 16) to a single-select card grid (pick 1 of 4). Each card shows label, full description, and reference works inline.
- Storage shape unchanged — `prelude_setup_data.tone_tags` is still an array; now always length 1 with a preset value (e.g. `['brutal_gritty']`). No migration needed since no surviving playtest characters.

### Back-compat posture

- No migration layer. User confirmed no existing characters — each playtest is fresh.
- If a character somehow has legacy multi-tag data, `resolvePresetFromTags` returns null and the prompt falls back to a placeholder TONE block (no crash).
- `TONE_TAGS` re-exported as a back-compat alias (player-facing slice of each preset) so any legacy consumer keeps working.

### Tests

- `tests/prelude-prompt.test.js` grew 86 → 130 (+44 tests). Coverage for all 4 presets — TONE block heading, REGISTER RULES / VOCABULARY ANCHORS / SCENE-TYPE GUIDANCE / AGE-SCALING / EXEMPLAR PROSE sections, preset-specific vocabulary anchors, preset-specific scene guidance. Plus: only one preset injects (no catalog pollution), old 16-tag catalog explicitly gone (quiet/melancholic, bawdy not in prompt), invalid preset falls back to placeholder, brutal-specific age-scaling terms (PROXIMITY → OWNERSHIP) present, all 4 chapter tiers present.
- All 6 prelude suites green: 38 + 15 + 130 + 130 + 33 + 52 = **398 prelude tests total**.
- Client build clean. No schema changes.

### Why this matters

Most impactful prompt change since v1.0.56 (Phase 3 mechanical emergence). State tracking was already solid (canon facts v1.0.60, session position v1.0.70, emergence snapshot v1.0.63) but actual *prose register* was drifting toward a single mid-fantasy voice regardless of tone preference. This is Option C from the v1.0.72 design conversation — bake tone into the prompt structurally, not just as a rule to obey. One preset, one full bible, rendered authoritatively. The noise floor is much lower; the signal-per-token is much higher.

## [1.0.0.72] - 2026-04-22 — Sibling nickname field in prelude setup

Siblings can now have an optional nickname (e.g., `Moira Astaron` called `"Mo"`). Parents already had a name field; siblings had only a formal name. Families use nicknames; the DM should too.

### Changes

- **Client** (`PreludeSetupWizard.jsx`) — new nickname column in the sibling form, placed between the full-name input and the race dropdown. Labeled "Nickname (optional)."
- **Payload** — `siblings[].nickname` is included when non-empty, `null` when empty.
- **Prompt builder** — sibling lines now render as `• Moira Astaron ("Mo") (Human sister, two years older)` when a nickname is set. Falls back to just `• Moss (Human brother, older)` when absent — fully back-compatible with existing prelude characters.

### Storage

No migration needed — siblings live inside the `prelude_setup_data` JSON blob on the `characters` table. Existing characters without nicknames render correctly via the optional-field fallback.

### Tests

- `tests/prelude-prompt.test.js` grew 82 → 86 (+4 tests for nickname rendering, back-compat, and empty-string fallback).
- All 6 prelude suites green: 38 + 15 + 130 + 86 + 33 + 52 = **354 prelude tests total**.
- Client build clean.

## [1.0.0.71] - 2026-04-22 — DX: `npm run dev` waits for the server before starting the client

Every `npm run dev` run produced an `AggregateError [ECONNREFUSED]` in the Vite log because the client's proxy tried to forward requests to the Express server before it finished booting.

### Fix

- New `client:wait` npm script uses `wait-on` to poll `GET /api/health` (up to 30s) before starting Vite.
- `dev` now runs `server` + `client:wait` concurrently, with labeled output (`server` in blue, `client` in green).
- `client` script preserved as an escape hatch for the rare case you want to start Vite without waiting.

### Dependencies

- `wait-on ^9.0.5` added to `devDependencies`.

### Not a version bump for any user-facing behavior — pure DX

No prompt, schema, route, or client feature changes. Tests not re-run (no code path altered).

## [1.0.0.70] - 2026-04-22 — Session-position injection + expanded canon taxonomy + 5-exchange nudge

Play-test: the AI DM drifted on recent NPC details (within the last 20 exchanges) and miscounted its own position — thought it was at exchange 8-12 when the player was at 32. Two different failures that share a root cause: **the AI has no reliable structured signal about session state or what's worth remembering.** This release gives it both.

### Part 1 — Live session-position in every system prompt

`buildRuntime()` now computes:
- `exchangeCount` — `floor(playSessionLength / 2)`, derived from the live message count minus the baseline
- `sessionBudget` — 50 (soft target, matches the 100-message nudge)
- `wrapAt` — 65 (matches the 130-message wrap threshold)
- `forceAt` — 80 (matches the 160-message force threshold)
- `progressFraction` — `exchangeCount / sessionBudget`

Injected into the system prompt as:
> Session position: exchange 32 of ~50 target budget (64% — wrap ~65, force-close ~80). Begin foreshadowing a cliffhanger moment around exchange 40; fire `[SESSION_END_CLIFFHANGER]` at the strongest natural beat after that.

So the AI has an authoritative count every turn — no more guessing from context. When it drifts, it drifts with visibility.

### Part 2 — Expanded canon taxonomy (Rule 15a rewritten)

Drift wasn't "the AI didn't try" — it was "the AI didn't know how many things in recent scenes were worth logging." Rule 15a's taxonomy was too terse. Rewritten with the full taxonomy from the play-test conversation:

- **(a) NPC details** — age, race, role, physical description, voice/cadence, tone, personality markers, defining flaw, moral temperament, personal history, relationships between NPCs
- **(b) Conversations and decisions** — plans made, plot shifts, perception changes, relationship shifts, promises made or broken
- **(c) Character moments** — skills demonstrated, world lore learned, achievements, failures, **promises / vows / oaths / debts**, **lies told**, **secrets kept**, **body / physical state changes (scars, injuries, growth, distinguishing marks)**
- **(d) World canon** — settlements / layouts / weather / holds / kingdoms / threats / discoveries / regional history / NPCs who exist but haven't met the PC
- **(e) Named objects** — heirlooms, gifts, tokens, named weapons, cursed items

Each category has concrete CANON_FACT examples drawn from the actual play-test transcript.

New quantitative target: **3-6 canon facts per session, more in rich scenes.** Under-emission is called out explicitly as the single biggest source of drift. The old "1-2 per session is typical" guidance is reversed — it was under-prescribing.

FINAL REMINDER updated accordingly: `CANON FACTS: emit GENEROUSLY (target 3-6/session, more in rich scenes) — NPC details, conversation beats, character moments, world canon. Under-emission is the primary cause of drift.`

### Part 3 — 5-exchange canon nudge

Server-side forcing function. Every 5 exchanges (10 messages), a `[SYSTEM NOTE]` is injected into the next prompt:

> Canon check-in (every 5 exchanges). In the last ~5 exchanges, did you establish or reinforce any of:
> • NPC details — age, race, tone, personality, flaw, personal history, relationship to another NPC
> • Conversation beats — a plan made, plot shift, shared perception change, promise, debt, oath
> • Character moments — a skill demonstrated, world lore learned, achievement, failure, lie told, secret kept, scar earned
> • World details — location layout, seasonal weather, settlement politics, regional threat, historical reference
> If YES to any you haven't yet logged, emit the corresponding `[CANON_FACT]` marker(s) THIS turn. If genuinely no, continue normally — but check against the CANON FACTS block to confirm nothing drifted.

Cadence guaranteed via `session_config.lastCanonCheckAtMessages` — the cursor advances only when the nudge actually fires, so skipped turns or error retries don't break the rhythm. Nudge is gated on `exchangeCount >= 5` so the first few turns don't get a premature check-in.

### Architecture discussion — future work (documented for later)

This conversation also surfaced the **years-of-play architecture question**: how does canon scale from a single prelude to multiple campaigns over real-world years? Sketched three options (phase-scoped silos, unified canon with scope columns, append-only event log with derived views). Recommended path: **unified canon tables with a `scope` column**, rolling out around Phase 5 (prelude → primary campaign transition). Retrieval at scale (beyond ~500 facts) will need relevance filtering, recency bias, and eventually semantic retrieval via embeddings — all deferred until there's real cross-campaign play data to learn from.

### Tests + build

- `tests/prelude-prompt.test.js` grew 60 → 82 (+22 tests covering: session-position injection at 0/3/32 exchange, foreshadowing instruction, expanded taxonomy sections (a)-(e), user's taxonomy terms (age/race/role/personality/flaw, plans/plot/perception, skill reveals/lore), added categories (promises/vows/lies/secrets/scars), 5-exchange nudge callout, FINAL REMINDER surfacing generous emission).
- All 6 prelude suites green: 38 + 15 + 130 + 82 + 33 + 52 = **350 prelude tests total**.
- Client build clean. No schema changes; new counter lives on the existing `session_config` JSON column.

## [1.0.0.69] - 2026-04-22 — Rule 6c: NPC exits and unfinished thoughts require a handoff

Play-test: Halgrim said "'Your brother holds honor like a shield… You — ' He stops. Doesn't finish it. He walks toward the far door without looking back." Great atmospheric prose, but the response ended there. The PC was left alone in a room with nothing to do — no question to answer, no roll to make, no time-skip to a new beat. The unfinished "You —" was a direct invitation for the PC to speak, but the NPC walked away before they had the chance.

Rule 6 already requires every response to end on engagement. But "NPC walks away" was slipping through option (c) ("something happening TO/AROUND the PC that demands response") because something IS happening — they're leaving. The rule didn't catch that leaving-the-room doesn't DEMAND response; it atmospherically closes the scene.

### New sub-rule 6c — THREE VALID HANDOFFS for NPC exits

Prompt-only fix. When an NPC is leaving, walking away, turning their back to go, closing a door between them, or cutting themselves off mid-thought, the response CANNOT end on the exit itself. Choose one of:

- **(i) PAUSE BEFORE THE EXIT.** End at the moment the NPC stops, hesitates, reaches for the door — BEFORE they actually leave. The PC has this beat to speak.
  > *"'You — ' Halgrim stops. Does not finish it. His hand rests on the door handle. He has not turned yet."*

- **(ii) COMPRESS FORWARD PAST THE EXIT.** Narrate past the NPC leaving to the next meaningful moment — minutes, a tenday, a season later. Always land on a new beat that demands response.
  > *"He walks toward the far door without looking back. The door closes. A tenday passes… Then, on the seventh morning, Moira comes to find you — her face is new."*

- **(iii) CALL A ROLL ON WHAT JUST HAPPENED.** What does the PC make of it? Insight (was he lying?), Perception (what did you see in his face?), Investigation (what was he about to say?), History (do you remember anything like this?).
  > *"He walks toward the far door without looking back. Whatever he was about to say is yours to guess at — give me an Insight check."*

### THE UNFINISHED SENTENCE IS A BECKON

Special case named explicitly in the rule: when an NPC cuts themselves off mid-thought about the PC ("You — " and stops), that IS a direct invitation for the PC to fill the silence. Use option (i) — pause the NPC before the exit, let the beat sit, end the response. Don't let them walk away from that silence uncontested.

### BAD / GOOD endings updated

The exact play-test transcript is now a worked BAD example:

> *"Halgrim pauses at the edge of the lamplight ... 'You — ' He stops. Doesn't finish it. He walks toward the far door without looking back."* [unfinished thought + NPC exit — stop at "He stops. Doesn't finish it." and let the PC speak]

Three worked GOOD endings show the correct 6c(i), 6c(ii), and 6c(iii) shapes.

### FINAL REMINDER updated

Rule 6's existing "CARVE-OUT" (NPC-directed tasks → roll) is now labeled CARVE-OUT 1. New CARVE-OUT 2 covers NPC exits + unfinished thoughts and lists the three handoff options in recency position.

### No server-side detection this round

A heuristic detector for "NPC walks away without handoff" would require scanning the last N sentences for exit verbs AND absence of question marks, roll prompts, and [AGE_ADVANCE] markers. Too many false-positive edges (a valid pause-before-exit ending with "door" nouns could trip it). Prompt-strengthening first; if the pattern keeps slipping through, detection is the next layer.

### Tests

- `tests/prelude-prompt.test.js` grew 49 → 60 (+11 tests covering the new carve-out heading, three options, unfinished-sentence callout, Halgrim BAD example, three GOOD 6c examples, fail-condition line, and FINAL REMINDER surfacing).
- All 6 prelude suites green: 38 + 15 + 130 + 60 + 33 + 52 = **328 prelude tests total**.
- Client build clean. No schema or API changes.

## [1.0.0.68] - 2026-04-22 — Hotfix: violation detector false-positive on NPC split dialogue

v1.0.67's detector fired on an NPC's mid-sentence dialogue break:

```
"You will not speak of this. Not to Moss. ... Not to Moira — " he
does not look at Moira ... "— who has already forgotten what she
heard. Do you understand me?"
```

Halgrim (NPC) is addressing the PC in second person, mid-quote, and
the regex couldn't tell the difference. Pattern B matched "You will
not speak" → consumed "speak" as the verb → treated the closing `"`
of Q1 as the opening of what it thought was a PC quote → bridged to
the opening `"` of Q2 as the closing bookend. The whole match sat
INSIDE the NPC's split dialogue.

### Fix — reject matches inside open quote spans

New helper `isInsideQuote(text, index)` counts `"` chars before the
match's start position. Odd count ⇒ inside a quote ⇒ reject the
match. Applied to both Pattern A and Pattern B.

Intuition: the `you [verb]` pattern only signals PC dialogue
attribution when it appears in NARRATION. Inside an NPC's quoted
speech, "you [verb]" is the NPC addressing the PC in second person
(command, question, observation) — that's fine, it's dialogue, not
the AI writing the PC's voice.

The guard is stateless and single-pass — no quote-parser needed. It
doesn't understand escaped quotes or nested quote substitutes
(rare in prose), but it catches the actual false-positive patterns
Sonnet/Opus emit.

### Still works on real violations

Verified with tests:
- NPC split dialogue with "you [verb]" inside → NOT flagged
- NPC command with "you [verb]" inside → NOT flagged
- Real violation after NPC dialogue ("`"I won't tell anyone," she
  said. You whisper, "I promise."`") → still flagged
- Internal monologue (`You think, "he's lying."`) → still flagged
  (the `you think` is OUTSIDE the quote it attributes to)

### Tests

- `tests/prelude-violation-detection.test.js` grew 46 → 52
  (+6 tests covering the Halgrim transcript, simpler split dialogue,
  NPC commands with "you" inside, and sanity-checks that real
  violations after NPC dialogue still fire).
- All 6 prelude suites green: 38 + 15 + 130 + 49 + 33 + 52 = **317
  prelude tests total**.
- Client build clean. No schema changes, no API surface changes.

## [1.0.0.67] - 2026-04-22 — Rule 2 hard enforcement: detector + next-turn correction + UI warning

Play-test: Opus wrote dialogue for the player during a climactic beat
— "'Someone removed an instruction,' you say. 'Something Father told
you to do…'" — a direct Rule 2 violation. The existing rule was
clearly insufficient on its own at emotional peaks. Three-layer fix.

### Layer 1 — Rule 2 rewritten (primacy position)

**New foundational framing** (user-contributed):

> YOU CONTROL EVERYTHING IN THIS WORLD EXCEPT THE PLAYER CHARACTER.
> The world, NPCs, weather, rooms, smells, sounds, consequences,
> time passing, what other people say and do, what the PC's body
> passively senses — all yours. The PC's voice, thoughts, feelings,
> choices, and actions — NOT YOURS. Your job is to build a world the
> PC can experience and react to, placing them into situations with
> means of interacting, without EVER forcing the PC to do or say or
> think anything they haven't said they're doing.

Positive statement of what the AI owns BEFORE the negative boundary
— clearer mental model than the previous rule-2 wording.

Added a second WRONG example taken verbatim from the play-test
transcript so the pattern Opus fell into is explicitly banned.

### Layer 2 — New Rule 2b: climactic-moment self-check

New sub-rule that explicitly calls out emotional peaks as the
violation hotspot:

> The strongest pull to write the player's line comes at emotional
> peaks: the confession, the breakthrough realization, the
> courageous word, the revelation. "If only I could hear the player
> deliver THIS line," you think. That pull IS the violation point.

Plus a **mandatory self-check** the AI must run before emitting:

> Scan the last 3 paragraphs of your response. Are there any quoted
> passages followed OR preceded by "you said / say / whisper /
> answer / reply / think / tell / ask / murmur / add / mutter /
> begin / continue / offer / breathe / call / realize / decide /
> wonder / remember" (or similar verbs of speech or cognition)? If
> YES — STOP. DELETE that section. Rewrite to END at the point
> where the player WOULD speak.

Plus GOOD/BAD endings list showing the exact tempting violations
vs. the correct non-violating endings.

### Layer 3 — Server-side detector (belt-and-suspenders)

Because trusting the AI to self-police at climactic moments isn't
enough. New module `preludeViolationDetection.js` pattern-matches
the two common violation shapes:

- **Pattern A**: `"..."[,.-—]? you [verb]` (quote before verb)
- **Pattern B**: `you [verb] [up to 120 chars, tempered] "..."` (verb
  before quote, with a tempered quantifier that REJECTS if another
  speaker verb intervenes — so "you say nothing as she whispers
  'hello'" correctly doesn't flag)

Verb list covers speech (said, whisper, answer, reply, tell, ask,
murmur, etc.) and cognition (thought, realize, wonder, decide).
Curly quotes normalized before matching.

When a violation is detected:

1. **The response still surfaces** — the player sees what happened.
   We don't hide it, because opaque censorship feels worse than a
   transparent flag.
2. **A warning badge renders inline** — red-outlined card beneath
   the offending response: *"⚠ Rule violation flagged. The DM wrote
   dialogue or reaction attributed to your character. Disregard that
   passage — your character has not spoken or reacted. The DM has
   been notified and will correct on the next turn."*
3. **A correction `[SYSTEM NOTE]` is queued** for the next turn — it
   names the specific pattern(s) that fired and instructs the AI to
   briefly acknowledge ("Apologies — I put words in your mouth
   there; please disregard that passage.") and strictly end scenes at
   the point where the player would speak.
4. **The violation is logged** server-side for telemetry.

### Layer 4 — FINAL REMINDER updated (recency position)

Two ⚠-prefixed lines at the top of the reminder block:

- "YOU CONTROL THE WORLD, NOT THE PLAYER CHARACTER (rule 2). You
  own… You do NOT own the PC's voice, thoughts, feelings, choices,
  or reactions."
- "BEFORE FINISHING: scan your last 3 paragraphs. Did you write
  QUOTED DIALOGUE attributed to the player character… If YES →
  DELETE and rewrite. This violation is most tempting in climactic
  moments. The satisfying line belongs to the player, NOT to you."

### Rules apply to BOTH Sonnet AND Opus — clarified

The system prompt is built once per turn and passed to whichever
model the auto-picker chose. Rules never switch off. But Opus
interprets rules differently from Sonnet — it prioritizes narrative
flow more and will more readily override structural rules in
climactic moments. That's a model-personality difference, not a
prompt-handling issue. The detector + correction loop is model-
agnostic; it catches Opus violations the same as Sonnet ones.

### Tests

- **New suite `tests/prelude-violation-detection.test.js`** — 46
  tests covering the user's exact transcript, canonical variants,
  Pattern B with intervening words, colon-attribution (`you answer
  in a voice smaller than you meant: "yes"`), curly-quote
  normalization, internal-monologue variants, NPC-dialogue
  negatives, tempered-quantifier (second-speaker NOT flagged),
  snippet truncation, and `buildViolationCorrectionNote`.
- `tests/prelude-prompt.test.js` unchanged (still 49 green).
- All 6 prelude suites green: 49 + 130 + 38 + 15 + 33 + 46 = **311
  prelude tests total**.
- Client build clean. No schema changes; warning note lives on the
  existing `session_config` JSON column.

### What's not here (follow-up if needed)

Automatic retry — if the detector flags a violation, we could
re-call the AI with a stronger system note and serve the retry
instead of the violation. Not built this round: adds latency + cost,
could loop, and prompt-strengthening + next-turn correction should
already move the needle. If play-test still sees violations
surfacing, retry is the obvious next layer.

## [1.0.0.66] - 2026-04-22 — Auto picker: break the Opus-feedback loop (release discipline + cap)

Play-test report: auto mode got stuck on Opus. Once Opus was running,
its own emotionally loaded prose read as "heavy" to itself, so it
kept tagging `[NEXT_SCENE_WEIGHT: heavy]` on every turn, never
releasing back to Sonnet for ordinary texture. Two fixes — one
prompt-side, one server-side safety valve.

### Prompt fix — RELEASE DISCIPLINE in the marker guidance

The old guidance said: *"Err toward 'heavy' when ambiguous and the
stakes are real."* That line actively biased toward stickiness.

Rewritten with new framing:

> **HEAVY IS A SHOT, NOT A STATE.** The most common mistake is
> staying tagged 'heavy' across multiple turns because the arc
> feels loaded. Don't. A heavy tag buys ONE climactic scene. After
> that scene resolves — the confrontation lands, the tears dry, the
> decision is made, the stranger leaves — the NEXT scene is back to
> ordinary texture. Tag it 'standard' or 'light'. […] You must
> actively release.

Plus explicit RELEASE DISCIPLINE bullets:
- Did the previous scene fire a heavy beat? Then the next tag is
  almost certainly 'standard' or 'light'.
- Conversation, chore, quiet walk, meal, transition? That's
  'standard', never 'heavy'.
- When in doubt, omit the marker (defaults to standard). The burden
  of proof is on 'heavy' — you should be able to name the specific
  climactic beat coming.

Frequency target tightened: heavy ~1 scene in 5-10, not every
emotionally loaded moment.

### Server fix — consecutive-Opus cap

Because trusting the AI to self-release isn't enough on its own,
a server-side safety valve: soft-triggered Opus can run at most
**2 consecutive turns** before auto-dropping to Sonnet for one
cooldown turn. Reason code surfaced to the UI as `soft-opus-cap`.

Trigger taxonomy in `pickAutoModel()`:

- **HARD triggers** (bypass cap — user-directed long-Opus states):
  chapter 4, session-wrap. `hard: true`.
- **SOFT triggers** (Opus, subject to cap): heavy-weight, hp-drop
  ≤ -3, chapter-promise. `hard: false`.
- **AI downshift** (always Sonnet): light-weight tag.
- **Default**: Sonnet.

New `session_config.consecutiveSoftOpusTurns` counter — increments
on any soft-triggered Opus turn, resets on ANY Sonnet turn OR on
any hard-triggered Opus turn. That last part matters: Chapter 4
should not accumulate against the cap since it's explicitly a
finale-long Opus state.

### API surface (UI-visible)

`resolveReason` field on the message response now includes
`soft-opus-cap` when the cap forces a cooldown. The auto-indicator
in the top bar will show `last turn → sonnet · soft-opus-cap` for
that cooldown turn — so the player can see the safety valve fire.

### Tests

- **New suite `tests/prelude-auto-model.test.js`** — 33 tests
  covering hard/soft trigger precedence, cap behavior
  (counter=0/1 passes, counter≥2 caps), light-weight downshift,
  hard-triggers-bypass-cap, and boundary conditions (HP 0, HP +5,
  HP -2).
- `pickAutoModel` exported from `preludeSessionService` for direct
  unit testing.
- All 5 prelude suites green: 49 + 130 + 38 + 15 + 33 = **265
  prelude tests total**.
- Client build clean. No schema changes; new counter lives on the
  existing `session_config` JSON column.

### What this means in play

- A heavy beat still gets Opus for 1-2 turns of rich prose.
- Then, unless the player's action creates a new escalation (HP
  drop, new chapter promise, or a fresh heavy tag from a *Sonnet*
  turn), auto drops back to Sonnet for the quiet aftermath.
- The player still has full manual override — toggle Opus directly
  in the top bar to stay heavy.

## [1.0.0.65] - 2026-04-21 — Rule 6 carve-out: NPC-directed tasks route to roll prompts

Play-test regression. Halgrim-the-steward pushed a sealed letter
across the table and said "Read me what it says." Sonnet ended the
response there. Rule 13 explicitly flags letter-reading as an
Intelligence check — and its ANTI-STALL example was literally this
scenario — but the rule didn't fire.

### Why it failed

Rule 6 (momentum) and Rule 13 (roll discipline) competed. Sonnet
satisfied Rule 6's option (c) "something happening TO the PC that
demands response" with the NPC's request to read the letter. From
its view, the response had ended on engagement. Rule 13's roll
trigger lost to the cheaper Rule 6 branch.

The player is left inventing content they don't have (the words of
the letter) to make progress. That's the stall Rule 13 was supposed
to prevent.

### Fix — carve NPC-directed tasks out of Rule 6 option (c)

New sub-section in Rule 6:

> CRITICAL CARVE-OUT — NPC-DIRECTED TASKS ROUTE TO (b), NOT (a) OR (c).
>
> When an NPC asks the PC to DO SOMETHING with an uncertain outcome
> where a skill applies — "Read it to me." "Can you sneak past?"
> "Convince her." "What do you remember?" "Try again." — that is NOT
> an end-on-(a)-question ending. That is a ROLL PROMPT. End on the
> roll, not on the NPC's request.

Plus an explicit **trigger-phrase list** Sonnet can pattern-match
against — the exact NPC lines that should flip its ending from "I
asked a question" to "I called a roll":

- "Read it to me." / "Read what it says." → Intelligence
- "What does it say?" / "What do you think it says?" → Intelligence (Investigation)
- "Keep going." / "Try again." (mid-task) → same skill as the task
- "Tell me what you remember." → Intelligence (History)
- "Can you sneak past?" → Stealth
- "Convince her." / "Talk him out of it." → Persuasion / Deception / Intimidation
- "Did you catch his face?" → Perception
- "Can you lift it?" / "Climb up." → Athletics
- "Is she lying?" → Insight
- …etc.

### Self-test baked into the rule

> Test: if the player's next move would require them to invent
> content they don't have (the words of the letter, the memory of
> the face, the exact lie told) — you've skipped a roll. Go back and
> call it.

That test is the cleanest way to catch the class of failure without
building a new marker or enforcement system. If Sonnet notices it's
about to offload un-rollable content to the player, it knows to
rewind.

### BAD ENDINGS list now includes skipped-roll examples

- "'Your father's seal,' he says. 'Read me what it says.'" → SKIPPED
  ROLL — letter-reading is Intelligence
- "'Can you sneak past them?' she whispers." → SKIPPED ROLL — Stealth

GOOD ENDINGS list adds matching worked examples:

- "Halgrim pushes the parchment toward you. 'Read me what it says.'
  The letter is dense and you're six — give me an Intelligence
  check." [NPC-directed task → roll prompt]

### FINAL REMINDER updated

The carve-out + self-test now land in recency position so Sonnet
sees them at generation time, not just in the primacy block.

### Tests + build

- `tests/prelude-prompt.test.js` grew 38 → 49 (+11 tests covering
  the carve-out, trigger phrases, self-test, BAD/GOOD examples,
  FINAL REMINDER surfacing).
- All 4 prelude suites green: 38 + 15 + 130 + 49 = **232 prelude
  tests total**.
- Client build clean. No schema changes, no API surface changes.

## [1.0.0.64] - 2026-04-21 — Hotfix: SQLITE_NOMEM on emergence snapshot

v1.0.63's `buildEmergenceSnapshotBlock()` fired 5 queries via
Promise.all on every prelude turn — saturated Turso's per-request
compute budget and crashed `sendMessage` with:

```
LibsqlError: SQLITE_NOMEM: SQLite error: init_step failed: out of memory
```

### Consolidated 5 queries into 2 sequential reads

One `SELECT kind, target, magnitude, chapter, status FROM
prelude_emergences WHERE character_id = ?` pulls every emergence row
for the character. All four previously-separate reductions (accepted
stat totals, accepted skill names, and the three chapter-weighted
class/theme/ancestry trajectory winners) now happen in JS from that
single pass. A second read grabs `prelude_values`. No more Promise.all.

### Safety net at the call sites

Both `startSession` and `sendMessage` in `preludeSessionService.js`
now wrap the snapshot build in try/catch. Rule 15b uses the snapshot
to lean upcoming scenes — it's informational, not load-bearing, so a
DB hiccup should degrade to the prompt builder's "none yet"
placeholder rather than crash the whole turn. Matches the defensive
pattern already used for rolling summaries and session recaps.

### Tests + build

- All 4 prelude suites still green (38 + 15 + 130 + 38 = 221).
- Client build clean.
- No schema changes; no API surface changes.

## [1.0.0.63] - 2026-04-21 — Prelude as tutorial: rolls, momentum, emergence-aware shaping

Play-test surfaced three real issues with prelude gameplay:

1. **Rolls weren't happening.** The DM was asking the player to
   notice / recall / react — tasks that should be rolled for — but
   never prompting the dice. The prelude was built to use physical
   dice throughout (design goal #16), but the prompt wasn't enforcing
   it strongly enough.
2. **Narrative momentum stalled.** Responses ended on atmosphere
   ("the keep is already arranging itself around his arrival") or on
   the PC being passively moved (hand on shoulder, led across the
   yard). Great prose, no forward beat — player stuck.
3. **The prelude lost its "I'm a tutorial" framing.** It should be
   teaching the player how our version of D&D feels while building
   backstory. That role got buried under atmospheric writing.

Three prompt-level rules fixed it, plus one new data plumbing path.

### Rule 6 MOMENTUM — rewritten for hard engagement endings

Old rule had an escape hatch offering "2-3 concrete options" the
character could take. Player feedback: action menus pull them out of
the scene because the AI is effectively playing the character's
agency. That branch is GONE.

Every response now must end in exactly ONE of:
- **(a)** A direct question to the player (NPC asks, situation
  demands a decision).
- **(b)** A roll prompt (per rule 13).
- **(c)** Something happening TO or AROUND the PC that demands
  response — NPC speaks, door opens, sound cuts through, hand lands
  on arm, stranger meets their eyes.

Explicit BANNED: menus of actions the character could take. Even
"being led" scenes preserve agency — the NPC steering the PC says
something, passes something, notices something. Atmospheric texture
is fine in the BODY; the END forces engagement.

Rule 6 now includes worked BAD endings (hand-on-shoulder-led-across,
atmosphere-only closes) and GOOD endings (direct question, aimed
pressure, thing happening to PC, roll prompt) so Sonnet can pattern-
match.

### Rule 13 ROLL DISCIPLINE — rewritten, chapter-gated

The old rule had the bones (wait-for-roll, DC hidden, crit framework)
but it wasn't explicit enough about HOW to surface the roll, and the
"THIS IS THE TUTORIAL" framing was missing.

**THE IRON RULE** (unchanged, now louder): when a roll is called, the
response ENDS THERE. Do not speculate about the outcome. Do not write
provisional prose. Do not continue past the prompt. The player rolls
physical dice, reports the number, and THEN the DM narrates.
Exception: player explicitly declines ("skip the roll," "just narrate").

**Chapter-gated surface format** (the tutorial scaffolding):
- **Chapter 1-2** (early + middle childhood): surface rolls INSIDE
  the action, naming the skill so the player learns what it's for.
  Example: *"You could try to catch Moss's eye — that'd be a
  Perception check."* / *"The letter is dense and you're six. Give me
  an Intelligence check."* The mapping becomes visible through play.
- **Chapter 3-4** (adolescence + threshold): surface rolls BARE —
  *"Roll Perception."* / *"Athletics, go."* The player is fluent
  now; the tutorial scaffold drops.

A `CURRENT CHAPTER` footer in rule 13 tells the DM which mode to use
THIS turn (switches at chapter threshold).

**DC never announced, in either mode.** Difficulty is conveyed
through narrative flavoring ("she's guarded," "the letter is dense,"
"this one's tricky"), never a number.

**Critical framework (bake-it-in explicit):**
- **Natural 1 = CRITICAL FAILURE** — fail and something worse, funny
  or dramatic per tone. Self-injury, object breaking, decision
  foreclosed, bystander laughing, NPC hurt in extreme cases only.
  Don't punish for playing; make failures interesting.
- **Natural 20 = CRITICAL SUCCESS** — miraculous, epic per tone
  regardless of register. Memory unlocks, hidden passage reveals,
  merchant spills a secret, bully's jaw drops.
- **2-19 against internal DC** — ordinary pass/fail narrated in tone.

Expanded "WHEN TO CALL FOR ROLLS" list — noticing, reading people,
remembering, piecing clues, sneaking, persuading, deceiving,
intimidating, physical feats, difficult texts, jargon, any "can my
character do this?" moment where a die should decide.

### Rule 15b EMERGENCE SHAPING + EMERGENCE SO FAR block

New directive: the AI should lean UPCOMING scenes toward the
character's emerging strengths. A character whose Perception emerged
should start getting more noticing beats; one trending toward
"ranger" gets more wilderness; one with rising Loyalty gets more
scenes testing it.

**New data plumbing — emergence snapshot block.** Every Sonnet
(and Opus, when auto escalates) call now gets an EMERGENCE SO FAR
block in the system prompt — accepted stat bonuses, accepted skills,
leading class/theme/ancestry trajectories (by chapter-weighted
tally), and top 5 values with scores.

- New service helper `buildEmergenceSnapshotBlock(characterId)` in
  `preludeEmergenceService.js` — composes the block from existing
  accessors (`getAcceptedEmergences`, `getValues`, per-kind
  `getTrajectoryWinner`). Always returns a structured block (with
  "none yet" / "undecided" placeholders) so the prompt shape stays
  stable for caching.
- Wired into both `startSession` and `sendMessage` in
  `preludeSessionService.js` — fetched alongside the canon-facts
  block, passed to `createPreludeSystemPrompt` as a new 6th arg.
- Lands in the system prompt right below the CANON FACTS block, above
  MARKERS — same general shape as canon facts (state snapshot the AI
  consults every turn).

**Applies to both Sonnet AND Opus.** v1.0.62's auto model picker can
escalate mid-session, so the emergence block must flow through
whichever model is serving the turn. Since it's in the system prompt,
it does.

**Rule 15b tells the AI** to consult the block before composing the
next scene and to pick the next-beat option that plays to the
character's emerging direction — gentle lean, not heavy-handed. Arc
plan still owns macro structure. By Chapter 3-4, the story should
feel TAILORED to who the player has been playing.

DM-side only — don't announce "this scene was chosen because your
Perception emerged." Just play the scene.

### FINAL REMINDER updated (recency position)

New lines surface:
- "END EVERY RESPONSE ON ENGAGEMENT" with the three allowed endings.
- "ROLLS ARE FREQUENT AND WAITED ON" with runtime-selected chapter
  mode ("CH 1-2 tutorial mode" vs "CH 3-4 fluent mode") — the
  recency reminder literally tells the DM which surface format to
  use THIS turn.
- "EMERGENCE SHAPING" with the gentle-lean directive.

### Opening prompt — "concrete options" removed

The first-session opening-prompt instruction used to say "End with an
invitation to action — a question, a pressure, concrete options."
"Concrete options" is a menu. Gone. Now: "End on engagement — a
direct question, a concrete pressure, or something happening to/
around the character that demands response. NEVER offer menus."

### PRELUDE_IMPLEMENTATION_PLAN.md — 3 new design goals

- **#25 Emergence shapes the story as it happens.**
- **#26 The prelude IS the tutorial.** (rolls + chapter-gated surface
  format)
- **#27 Every DM response ends on engagement.** (no action menus)

### Tests

- **New suite `tests/prelude-prompt.test.js`** — 38 tests covering:
  - Rule 6 momentum language (direct question / roll / happening TO
    PC; no action menus; BAD vs GOOD endings)
  - Rule 13 roll discipline (iron-rule language; Ch 1-2 offer-inside
    mode; Ch 3-4 bare mode; runtime chapter footer flips between
    modes; DC-hidden; crit framework)
  - Rule 15b emergence shaping (heading, gentle-lean, DM-side)
  - Emergence snapshot block passes through + placeholder when absent
  - FINAL REMINDER surfaces all three new rules in recency position
    (and flips chapter mode based on runtime)
  - Opening prompt no longer mentions "concrete options"
- All 4 prelude suites green: setup 38, arc 15, markers 130, prompt
  38 → **221 prelude tests total**.
- Client build clean. No schema changes.

### What's not here (still Phase 5)

Transition to main creator — `[PRELUDE_END]` marker, Opus-generated
backstory from canon facts + emergences + values, pre-filled main
creator, primary campaign world-gen receiving prelude as input. The
emergence snapshot block will feed the backstory generator when
Phase 5 lands.

## [1.0.0.62] - 2026-04-21 — Auto/Sonnet/Opus model picker for prelude sessions

Prelude sessions default to Sonnet but now expose a three-mode model
toggle in the top bar: **auto · sonnet · opus**. The Auto mode escalates
to Opus for heavy beats (chapter 4, session wrap, HP drops, chapter
promises, AI-tagged heavy scenes) and stays on Sonnet for the texture
that fills most of play. Cost stays low, climactic scenes get the
richer writer.

### New marker — `[NEXT_SCENE_WEIGHT: heavy|standard|light]`

Forward-looking hint the AI emits at the end of a response to flag
what the NEXT scene is about to carry. The server parses it and uses
it to pick the model for the following turn. Stripped from display.

- `heavy` — confrontation, farewell, death, betrayal, chapter-defining
  meeting, resolution of a chapter promise. Err toward heavy when the
  stakes are real.
- `light` — transition, routine work, atmospheric beat, time-
  compression. Used sparingly.
- `standard` — default. Omit the marker entirely if uncertain.

Prompt rule tells Sonnet to tag based on WHAT THE STORY IS ABOUT TO
DO, not what it just wrote, and to avoid over-tagging 'heavy' to seem
important — the player feels forced escalation immediately.

### Auto-mode escalation heuristic (`resolveModel` in `preludeSessionService.js`)

Order of checks, first match wins:

1. Current chapter == 4 → **opus** (`chapter-4`) — finale always heavy
2. Play-session past `PLAY_SESSION_WRAP_MESSAGES` (130) → **opus** (`session-wrap`) — close big beats well
3. `session_config.lastSceneWeight === 'heavy'` → **opus** (`heavy-weight`) — AI flagged
4. `session_config.lastSceneWeight === 'light'` → **sonnet** (`light-weight`) — AI downgraded
5. `session_config.lastHpDelta <= -3` → **opus** (`hp-drop`) — stakes spiked last turn
6. `session_config.lastChapterPromiseTurn === true` → **opus** (`chapter-promise`) — next 2-3 scenes resolve its weight
7. Default → **sonnet**

Signals are stashed on `session_config` after each turn by
`processMarkersForSession` — `lastSceneWeight`, `lastHpDelta`,
`lastChapterPromiseTurn`. They drive only the NEXT turn's resolution;
they're either refreshed or cleared on each response.

### Persistence + API

- Mode lives on `session_config.model_preference`. Survives pause /
  resume / server restart.
- `POST /api/prelude/sessions/:sid/message` accepts optional `model`
  field ('auto' | 'sonnet' | 'opus'). Any valid override becomes the
  new stored preference (written BEFORE the Sonnet call so a failed
  API call doesn't lose the flip).
- Response payload adds three fields: `model` (mode), `resolvedModel`
  (what we actually called), `resolveReason` (null for manual modes,
  short string like `heavy-weight` for auto escalations).

### UI — top-bar toggle + auto indicator

Three-segment toggle left of the Setup button in
`PreludeSession.jsx`. Purple accent. Disabled while a turn is in
flight. Title-tooltip explains what auto does. When mode is 'auto',
a small `last turn → opus · heavy-weight` line shows under the
toggle so the player can see when and why an escalation fired. Hidden
when mode is manual sonnet/opus.

### Tests + build

- `prelude-markers.test.js` +13 tests (parse, case-insensitive,
  last-fire-wins, roll-up inclusion, strip). 117 → 130 green.
- Prelude setup (38) and arc (15) suites unchanged. Client build
  clean.
- No schema changes — state lives on the existing `session_config`
  JSON column.

### What this unlocks for v1.0.63

The auto-picker is a prerequisite for the upcoming roll-discipline +
momentum + emergence-aware shaping work — those prompt changes need
to apply regardless of which model is serving the turn. With the
escalation heuristic in place, new prompt rules land in one system
prompt and flow through both Sonnet and Opus calls.

## [1.0.0.61] - 2026-04-21 — Session length target raised to ~50 exchanges

v1.0.59's thresholds were too tight — a play-test session ended at
16 exchanges with no cliffhanger, no action, no weight. The pacing
nudges fired early and Sonnet interpreted "begin looking for a close"
as "close ASAP," cutting sessions short. Now that canon facts
(v1.0.60) guard against drift, we can safely let sessions run longer.

### Raised thresholds

| Threshold | v1.0.59 (old) | v1.0.61 (new) |
|---|---|---|
| Gentle nudge | 30 msg / ~15 exchanges | **100 msg / ~50 exchanges** |
| Wrap ("fire in 3-5 responses") | 50 msg / ~25 exchanges | **130 msg / ~65 exchanges** |
| Force ("fire NOW") | 70 msg / ~35 exchanges | **160 msg / ~80 exchanges** |

Target session length: **~50 exchanges** — substantial enough for
multiple scenes, real character development, and stakes that build
across the session.

### Re-tuned nudge language

The first nudge used to say "begin looking for a close point" —
Sonnet interpreted that as an order to end soon. New language: "Watch
for a strong cliffhanger moment over the next several scenes. Don't
force an arbitrary ending; wait for the right beat." Same escalation
ladder, but the first step is an explicit HINT, not a close order.

### Prompt rule 11b rewritten

Now explicitly distinguishes good vs. bad stopping points:

- **GOOD:** stakes spike, significant decision pending, someone
  important just appeared/died/threatened, chapter close moments
- **BAD:** mid-conversation lulls, quiet texture scenes, trivial
  errand completions, "the morning stretches out ahead"

Tells Sonnet the first pacing nudge is a hint to start watching,
not an order to close. Notes that canon facts mitigate the drift
risk that originally motivated early endings.

### Tests + build

- All 3 prelude suites still green (38 + 15 + 117). Build clean.
- Numbers-only change in the service + prompt rewording; no schema
  or API surface changes.

## [1.0.0.60] - 2026-04-21 — Canon facts ledger: prevent context drift at the source

Context drift is the root cause of the "Moss is 12 now" class of
regressions. Pacing fixes (v1.0.59) help, but the real solution is to
give the AI a ground-truth ledger it sees every turn. Ported the
pattern from the main DM's `canon_facts`.

### New table — `prelude_canon_facts` (migration 043)

Per-character ledger of canonical truths. Columns: `category`
(npc/location/event/relationship/trait/item), `subject`, `fact`,
`established_age`, `session_id`, `status` ('active' | 'retired').
UNIQUE index on (character_id, category, subject, fact) where
status='active' — exact duplicates silently ignored. Index on
(character_id, status, category) for fast retrieval.

### New markers

- **`[CANON_FACT: subject="..." category="npc|location|event|relationship|trait|item" fact="..."]`** —
  additive. Sonnet emits when establishing new canonical detail. Multiple
  per response allowed. Strip from display.
- **`[CANON_FACT_RETIRE: subject="..." fact_contains="..."]`** — marks
  matching active facts as `retired` so they stop appearing in the
  prompt. Used when a fact is no longer true (age rolled forward,
  character died, trait changed). Substring match on `fact`.

### New service — `preludeCanonService.js`

- `recordCanonFact(characterId, {subject, category, fact, establishedAge, sessionId})`
- `retireCanonFacts(characterId, {subject, factContains})`
- `getActiveCanonFacts(characterId)` — flat list, ordered by category+subject
- `buildCanonFactsBlock(characterId)` — formatted prompt block: grouped
  sections per category (PEOPLE / RELATIONSHIPS / TRAITS / PLACES /
  ITEMS / EVENTS), bullets per subject, dense and scannable.

### Wire — every Sonnet call sees the ledger

Both `startSession` and `sendMessage` now call
`canonService.buildCanonFactsBlock()` and pass the result to the prompt
builder. `createPreludeSystemPrompt()` takes a new `canonFactsBlock`
parameter; the block appears between RECURRING THREADS and the MARKERS
section. When no facts exist yet, a placeholder tells Sonnet to start
emitting.

### Session processor — process canon markers

`processMarkersForSession`:
1. Retires match first (so a same-turn fire+retire lands cleanly).
2. Inserts new facts with the current `prelude_age` as `established_age`.
3. Duplicate inserts (exact subject+category+fact match) silently
   succeed — the UNIQUE index catches them; `recordCanonFact` returns
   `{status: 'duplicate'}`.
4. Surfaces added/retired in the `markers` payload returned to the UI.

### Prompt rule 15a — CANON FACTS DISCIPLINE

New ABSOLUTE RULE teaches Sonnet:
- Scan the CANON FACTS block before generating named details.
- Defer to canon when it contradicts what you're about to write.
- Emit `[CANON_FACT]` when first establishing a named NPC / place /
  event / relationship / trait / item — with examples.
- Emit `[CANON_FACT_RETIRE]` before overwriting (e.g., after
  `[AGE_ADVANCE]`, retire old ages).
- Facts should be short, factual, dense — not flowery. 1-2 per session
  is typical.

FINAL REMINDER surfaces the rule in recency position.

### New API

- `GET /api/prelude/:characterId/canon-facts` — active ledger for the UI.

### UI — Canon ledger section in the Setup panel

The existing Setup panel gets a new "Canon ledger" section showing
the live ground truth grouped by category (People / Relationships /
Traits / Places / Items / Events). Each fact shows subject + fact text
+ established age. Refreshes on Setup panel open + after any turn. Makes
drift debuggable — you can see what Sonnet has registered.

### Tests + build

- `tests/prelude-markers.test.js` grew 101 → 117 (covering both canon
  markers + strip regressions + default category + aliases).
- prelude-setup 38, prelude-arc 15, prelude-markers 117 — 170 prelude
  tests green total.
- Migration 043 verified on Turso.
- Client build clean.

### How this interacts with existing systems

- **v1.0.54 session ordinal**: unchanged.
- **v1.0.55 session recap**: unchanged. Recap generation doesn't touch
  canon facts.
- **v1.0.55 rolling summaries**: complementary — rolling summary is
  prose memory, canon facts is structured ground truth. Both get
  injected in the prompt.
- **v1.0.56 emergence markers**: canon facts are lighter-weight and
  have no accept/decline step. A stat hint is player-facing and
  mechanical; a canon fact is DM-facing and informational.
- **v1.0.59 session length pacing**: canon facts don't affect length.
  But if a session does run long, canon facts prevent the drift that
  forced v1.0.59 in the first place.

### Still not built (Phase 5)

Transition to main creator — `[PRELUDE_END]` marker, Opus-generated
backstory using canon facts + emergences, pre-filled main creator
wizard, primary campaign world-gen receiving prelude as required
input. Canon facts give Phase 5 a much richer source for backstory
generation when it lands.

## [1.0.0.59] - 2026-04-21 — Preserve self-correction + enforce session length discipline

Two things from play-test:

### 1. Self-correction (bake the good behavior into the prompt)

Sonnet caught itself putting words in the player's mouth mid-response,
acknowledged the violation, and rewound. Good behavior — I want to
preserve it.

New rule **2a: SELF-CORRECTION IS WELCOME** explicitly blesses this:
if you catch yourself mid-violation, acknowledge and rewind — don't
silently cover it up. Same for when the player corrects a drift the
AI missed ("Moss is nine, not twelve"): brief "You're right — [correction].
[Continue]." pattern, don't over-explain.

FINAL REMINDER surfaces the same line in recency position.

### 2. Session length discipline

Context drift hit a long-running session. Sonnet started writing
"Moss is twelve and has had lessons" — but Moss is nine with no
weapons training established. The prompt's `[SESSION_END_CLIFFHANGER]`
guidance was too soft: "at a natural break." Sonnet kept going past
natural break points because the player was engaged.

Two-sided fix:

**Server-side pacing enforcement** (`preludeSessionService.js`):

- New `session_config.currentPlaySessionBaseline` — message-count at
  the start of the current play-session. Set to 0 on session creation;
  reset to `messages.length` on each resume (so each pause-to-pause
  cycle gets its own length budget).
- Three escalating thresholds on play-session message count:
  - **≥30 messages** (~15 exchanges): gentle nudge injected as
    `[SYSTEM NOTE]` — "begin looking for a natural close."
  - **≥50 messages** (~25 exchanges): firmer — "fire
    [SESSION_END_CLIFFHANGER] within the next 2-3 responses."
  - **≥70 messages** (~35 exchanges): forced — "you MUST fire
    [SESSION_END_CLIFFHANGER] in THIS response. Even an imperfect
    cliffhanger beats continuing."
- Thresholds defined as module constants for easy tuning.

**Prompt-side awareness** (new rule **11b**: SESSION LENGTH DISCIPLINE):

Lists good stopping points (scene close, stakes spike, decision forced,
chapter close moment). Makes the AI aware that the server will inject
escalating nudges and instructs it to obey them promptly.

Existing sessions without `currentPlaySessionBaseline` treat baseline
as 0 — meaning their full current history counts, which correctly
triggers wrap/force nudges for sessions that have already drifted long.

### Tests + build

- All 3 prelude suites still green (38 + 15 + 101). Client build clean.
- No schema changes — new config field lives on the existing
  `session_config` JSON column.
- Follow-up noted: integration test for session pacing (mock Sonnet +
  simulate long session) would catch regressions. Not written tonight.

## [1.0.0.58] - 2026-04-21 — Hotfix: TDZ error in Phase 3 sendMessage

Every prelude message send was crashing with
`ReferenceError: Cannot access 'markerResults' before initialization`.

### Cause

In the Phase 3 cap-violation feedback code I added, the block that
reads `markerResults.capViolations` was placed BEFORE the line that
declares `markerResults`. Classic temporal-dead-zone JavaScript
error. Tests didn't catch it because the marker-detection tests are
unit tests against the detection module, not the send flow.

### Fix

Swapped the ordering in `preludeSessionService.sendMessage()`:

1. Call Sonnet → get result
2. Persist messages
3. Fire rolling summary (no dependencies on markerResults)
4. **`const markerResults = await processMarkersForSession(...)`** ← moved here
5. Consume cap-violation feedback into `session_config` for the next turn
6. Handle cliffhanger / recap

No prompt or schema changes — pure ordering fix.

### Tests + build

- All 3 prelude suites green. Build clean.
- Follow-up note: should add an integration-style test covering the
  full sendMessage flow with mocked Sonnet to catch this class of
  regression in future.

## [1.0.0.57] - 2026-04-20 — Prelude Phase 4: age-register voice + time compression + tone application

Phase 4 ships. All prompt-only work — no schema, service, or UI changes.
The goal: make NPC dialogue sound age-differentiated, time compression
feel crafted rather than lazy, and tone tags actually shape prose
rather than just decorate it.

### Expanded Rule 17 — NPC VOICE: AGE REGISTER

Was one sentence. Now five life-stages with concrete speech/thought
patterns each:

- **Small child (5-9):** fragments, concrete nouns, favorites named,
  one idea per breath
- **Older child / tween (9-13):** chaining thoughts, "actually" and
  "though," compares things, secrets matter
- **Teen / adolescent (13-18):** compression as coolness, irony,
  loaded single words ("fine," "whatever"), peer over family
- **Young adult (18-25):** most formally competent, confident where
  untested, green at edges
- **Adult (25-55):** class + occupation + exhaustion shapes speech;
  rural compressed, urban layered
- **Elder (55+):** memory as lens, repeated stories, direct opinions,
  body fatigue in dialogue

Applied-test framing: "if a tavern has innkeeper + drunk + 7-year-old
daughter, those three voices should be UNMISTAKABLY distinct in cadence,
vocabulary, topic-density, and compression."

### Expanded Rule 11 — TIME ADVANCES with four technique examples

Was generic guidance. Now four named compression techniques with
worked examples:

- **SEASON-SKIP:** concrete beat + time passing + delta detail, all in
  2 sentences
- **RHYTHM-COMPRESSION:** name the pattern, then break it with the
  scene
- **SELECTIVE DETAIL:** specific concrete details across time
- **[AGE_ADVANCE] JUMP:** the biggest hammer — use only at chapter
  close

Plus a positive rule of what compression ISN'T ("Time passed. Things
happened. You grew." = lazy; every line still earns its keep).

And a WHEN-TO-COMPRESS-vs-SCENE-OUT decision ladder: new decisions,
relationship shifts, new people, fights/oaths/betrayals → scene out;
routine work, waiting, repeated meals → compress.

### Expanded Rule 14 — TONE FIDELITY with per-tag applied guidance

Was generic "gritty + dark humor has blunt prose." Now 16 tone tags,
each with how it actually shapes prose at the word/sentence level:

- Gritty: short sentences, concrete nouns, body details, name hunger
  not "empty feeling"
- Dark humor: one dry aside per scene, salt not sugar
- Hopeful: small kindnesses explicitly named
- Epic: elevated diction ("cold stone," "the wind out of the north")
- Quiet/melancholic: long sentences, pauses, unsaid things
- Tragic: beautiful things named just before they break
- Whimsical: wonder-details, never violates Faerûn canon
- Political: another agenda in every room
- Rustic: land details saturate, time measured in crops not clocks
- Mystical: porous world, dreams carry weight, gods indirect
- Brutal: slow healing, rare mercy, unclean resolutions
- Tender/intimate: close-ups on faces and hands, small touches
- Romantic: yearning as a color, unsaid words
- Eerie/uncanny: something faintly wrong, repetition, children's dreams
- Bawdy: earthy, frank, no euphemism
- Spiritual: ritual weight, faith as daily presence

Explicit note: COMBINED TAGS amplify each other — honour the
combination, don't pick one and ignore the rest.

### Tests + build

- All 3 prelude suites green (38 + 15 + 101 = 154 prelude tests total).
- Client build clean.
- No code changes, so no code tests added — prompt-only release.

### Phase 4 scope notes

- **Prompt-only by design** per user directive. Full per-NPC voice
  palette generation (like the main DM's system) is deferred — the
  expanded age-register and tone rules should be sufficient for the
  7-10 session prelude scope.
- **Next:** Phase 5 (transition to primary campaign) — `[PRELUDE_END]`
  marker, backstory generation from emergences + canon NPCs + values,
  pre-filled main creator wizard, mentor imprint seeding, campaign
  world-gen receiving prelude as required input.

## [1.0.0.56] - 2026-04-20 — Prelude Phase 3: mechanical emergence

Phase 3 ships. Non-binary choices now shape the character sheet.

### Six emergence markers

Sonnet fires these when the player's actions earn them — not on authorial
whim. Server records, caps enforce, UI surfaces accept/decline cards.

- `[STAT_HINT: stat=str|dex|con|int|wis|cha magnitude=1|2 reason="..."]` —
  stat pressure from played behaviour. **Cap: +2 max per stat.**
- `[SKILL_HINT: skill="Athletics" reason="..."]` —
  skill affinity. **Cap: 2 skills total across the prelude.**
- `[CLASS_HINT: class="ranger" reason="..."]` — auto-tallied class affinity.
- `[THEME_HINT: theme="outlander" reason="..."]` — auto-tallied theme affinity.
- `[ANCESTRY_HINT: feat_id="dwarf_l1_stone_sense" reason="..."]` — auto-tallied ancestry feat.
- `[VALUE_HINT: value="loyalty" delta=+1 reason="..."]` —
  values accumulate (no cap). 12 canonical values: curiosity, loyalty,
  empathy, ambition, self_preservation, restraint, justice, defiance,
  compassion, pragmatism, honor, freedom.

### Chapter-weighted tallies

Class / theme / ancestry hints are weighted by chapter at prelude end:
Ch1-2 = 1.0x, Ch3 = 1.5x, Ch4 = 2.0x. Recency breaks ties. Stats and
skills aren't tallied — they're player-decided accept/decline cards
fired inline in the message feed.

### New service — `preludeEmergenceService.js`

`recordStatHint`, `recordSkillHint`, `recordClassHint`,
`recordThemeHint`, `recordAncestryHint`, `recordValueHint`:
each enforces its specific caps and returns `{ status: 'offered' | 'capped'
| 'capped_previously_declined' | 'tallied' | 'accumulated' }`.

`acceptEmergence(characterId, id)`, `declineEmergence(characterId, id,
{permanent})`: player decisions.

`getOfferedEmergences(characterId)`: for UI polling.
`getAcceptedEmergences(characterId, sinceSessionId)`: feeds session recap.
`getValues(characterId)`: for the values tracker panel.
`getTrajectoryWinner(characterId, kind)`: chapter-weighted winner for
class/theme/ancestry at prelude end (Phase 5 consumer).

### New API endpoints

- `GET /api/prelude/:characterId/emergences/offered` — pending cards
- `POST /api/prelude/:characterId/emergences/:id/accept`
- `POST /api/prelude/:characterId/emergences/:id/decline` (body: `{permanent: bool}`)
- `GET /api/prelude/:characterId/values` — current rolling tally

### UI — inline accept/decline cards in the message feed

When Sonnet emits a STAT_HINT or SKILL_HINT, the UI renders an amber-
bordered card below the assistant message with ✦ EMERGENCE OFFER header,
reason, and three buttons: **Accept**, **Not now**, **Never offer**.
Resolved cards show their status inline. Class/theme/ancestry hints
tally silently (no card).

### UI — values tracker in Setup panel

The existing Setup panel now includes an "Emerging values" section
below the setup review. Shows each value and its current score,
color-coded (green +3+, purple +1/+2, red -3+, gray neutral).
Refreshes when the Setup panel opens and after any player turn (so
the tracker reflects value hints fired this session).

### Cap-violation feedback loop

When Sonnet fires a hint the server rejects (e.g., STR already at +2,
or 2 skills already accepted), the rejection reason gets queued on
`session_config.pendingCapFeedback` and injected into the NEXT turn's
prompt as a `[SYSTEM NOTE]` so Sonnet knows to stop firing that
target. Cleared after consumption.

### Session-end recap integration

The Sonnet-generated session recap now receives the list of
emergences the player accepted during this session (stat +1 CON, skill
Athletics, etc.) and weaves them into the prose naturally — "the
running and climbing have made you quicker" — instead of listing them
mechanically. Feels earned, not bureaucratic.

### Prompt — EMERGENCE MARKERS section

New block in the Sonnet system prompt documenting all 6 markers with
canonical ids (stats, 5e skill names, D&D class ids, theme ids from
`server/data/themes.js`, ancestry feat list ids from migration 023).
Firing rules: only fire when PLAYED BEHAVIOR earned the hint, aim for
1-3 per session (not every turn), obey `[SYSTEM NOTE]` cap-violation
feedback.

### Tests + build

- prelude-markers grew 74 → 101 (covering all 6 emergence marker types
  + roll-up + strip regressions). prelude-setup 38, prelude-arc 15.
- Client build clean.

### Still not built (Phase 5)

Stat bonuses and skill proficiencies don't APPLY to the character
sheet mid-prelude — they accumulate on `prelude_emergences` and flow
through at prelude end into the main creator wizard. That's the Phase
5 "transition to primary campaign" work. For now, accepted emergences
show "✓ Accepted" in the UI and get carried in the session recap.

## [1.0.0.55] - 2026-04-20 — Prelude Phase 2b-ii: HP, session recap, chapter promise, pacing

Phase 2b-ii ships. Seven pieces integrated:

### HP tracking
- **`[HP_CHANGE: delta=-N reason="..."]`** marker — Sonnet emits for damage/healing.
  Server updates `characters.current_hp`, UI top bar reflects.
- HP displayed in top bar with color: green >50%, yellow <50%, red at 0.
- Dropped: +/- buttons (per user directive — if Sonnet misses the marker, it's a bug to fix, not a UI fallback).

### Age-scaled stats
- When `[AGE_ADVANCE]` pushes into a new chapter, `max_hp` recomputes from
  the per-chapter formula (4/6/8/10 + CON mod), and `current_hp` scales
  proportionally — a character at full HP stays full, at half stays at
  roughly half.

### Per-chapter session budget (DM-side pacing)
- Prompt rule 11a adds soft guidance: Ch1 ~1-2 sessions, Ch2 ~2, Ch3 ~2-3,
  Ch4 ~2-3. Sonnet sees it every turn alongside the current session number.
- Player-facing top bar stays clean — this is DM guidance only.

### CHAPTER_PROMISE marker
- **`[CHAPTER_PROMISE: theme="..." question="..."]`** — emitted ONLY at
  the opening of chapter 3 and chapter 4. Surfaces the thematic
  throughline and invites player to confirm / redirect / see-where-it-goes.
- Rendered inline in the message feed as a distinct dashed-purple card
  labeled "CHAPTER N PROMISE."

### Session-end recap
- When `[SESSION_END_CLIFFHANGER]` fires, server invokes Sonnet to
  generate a 1-2 paragraph recap of the session in second person.
- Persisted on `session_config.lastSessionRecap`, surfaced in the
  paused banner + on reload of a paused session. Fresh recap per session
  (no cross-session history per user directive).

### Prelude-tuned rolling summary template
- `rollingSummaryService.buildSummaryPrompt()` now branches on
  `sessionType`. For `session_type='prelude_arc'`, uses a character-
  development-weighted template instead of the plot/combat/quest-focused
  adventure template.
- Prioritizes: character development moments, relationship shifts,
  values-forming choices, emotional texture. Plot beats only matter
  insofar as they shaped those.
- `preludeSessionService.sendMessage()` now applies the rolling summary
  before building the continuation prompt and fires `rollSummary()`
  fire-and-forget after each turn, matching the main DM pattern.

### Notice pills in the feed
- Chapter advances, age advances, and HP deltas surface as quiet
  monospace notice rows between messages (e.g., *"→ Chapter 2"*, *"→ +4 years (Age 10)"*, *"HP -2"*).

### Tests + build
- prelude-markers tests grew 55 → 74 (covering HP_CHANGE, CHAPTER_PROMISE,
  strip regressions for both). 38 + 15 + 74 = 127 prelude tests green.
- Client build clean.

### Scope cuts (as discussed with user)
- Dice roller UI — dropped. User uses physical dice; text action reports work.
- Combat tracker UI — dropped. Combat handled narratively by AI + dice rolls.
- HP manual override — dropped. Marker is the only path; regressions are bugs.

## [1.0.0.54] - 2026-04-20 — Prelude play-test round 5: DC leak, agency violation, marker leak, session ordinal

Four fixes from play-test, two prompt-side, two code-side.

### Prompt — DM-SIDE vs PLAYER-SIDE INFORMATION (new rule 13a)

Sonnet was announcing DCs directly: "That's an Insight check, DC 12."
The DC is DM-side info — it stays behind the screen. New rule with
explicit WRONG/RIGHT pairs:

- WRONG: "That's an Insight check, DC 12. She's guarded."
- RIGHT: "Give me an Insight check — she's guarded."

Also bans announcing: critical success/failure as numbers ("nat 20 means
critical success"), enemy AC/HP, named arc-plan beats ("this is the
First Blood beat"). Difficulty is conveyed through narrative adjectives
("tricky," "long shot") — the numbers stay yours.

### Prompt — tightened PLAYER AGENCY (rule 2) with the exact violation as the WRONG example

Sonnet wrote direct dialogue for the player: `"Moss," you say. Very
quiet. Very even. "Get Halda. Go up the stairs. Right now."` The rule
said "don't narrate what you do/say/think/feel" but was generic.
Now includes the exact violation as the WRONG example plus a RIGHT
rewrite that describes the pressure around the player without putting
words in their mouth. Also clarifies: never narrate internal thoughts,
feelings, or decisions either — only involuntary physical sensations
("the coin is warmer than you expected") are environment, not choice.

### Code — marker leak fixed

`[COMBAT_START]` and other inherited markers were leaking into the
player-facing narrative. `stripPreludeMarkers()` now also removes:

- `[COMBAT_START]`, `[COMBAT_END]`, `[LOOT_DROP]`, `[ADD_ITEM]`
  (inherited from main DM prompt; prelude doesn't wire these into UI
  yet but Sonnet sometimes emits them anyway)
- Any `[ALL_CAPS_TOKEN: ...]` bracketed marker as a catch-all for
  future additions. Requires 3+ chars of A-Z/underscore so mixed-case
  bracketed content like `[Karrow's Rest]` or `[Eleint]` passes through.

9 new strip tests cover the regression.

### Code — session ordinal (UX: "Session N of ~7-10")

Play-test surfaced that "session end" was ambiguous — was that the end
of session 1? a break? A prelude uses a SINGLE `dm_sessions` row per
character, state-machined through pauses and resumes. Now tracks a
play-session ordinal on `session_config.session_number`:

- Starts at 1 on creation.
- Increments by `resumeSession()` — resuming after a pause/cliffhanger
  means the player is starting the NEXT play-session.
- Surfaced in the UI top bar ("Session 3 · Chapter 2 of 4 · Age 10")
  and in the paused banner ("Session 3 complete — Begin Session 4")
  and in Sonnet's system prompt ("play-session 3 of ~7-10 in a prelude").

Paused banner rewritten:
- Old: small dashed "Session paused" box with generic "Resume session"
  button.
- New: proper "✦ Session N complete" framing with chapter / age /
  cliffhanger context, and a clear "Begin Session N+1" button.

### Tests + build

- prelude-setup 38, prelude-arc 15, prelude-markers 55 (was 46 — +9
  for marker strip coverage). Build clean.

### Scope deliberately cut

Things the user raised that land in later releases:

- **Session-end recap** (Sonnet-generated summary of what happened
  this session) — deferred. Ordinal + cliffhanger banner covers the
  "what happens at session end" question for now.
- **Chapter wrap-up** (auto-close when seeded beats all fire) — needs
  seeded-beat tracking, which lands with Phase 3 emergence infrastructure.
- **Emergence offers on session end** — Phase 3.

## [1.0.0.53] - 2026-04-20 — Prelude: anachronism ban + anti-stall skill-check

Two specific issues from v1.0.52 play-test: (1) Sonnet invented "the
last train before the pass closed" — trains don't exist in Faerûn.
(2) A letter-reading scene ended with Halda saying "Keep going" with
no next-word to read, leaving the player softlocked when it should
have been a skill check.

### Prompt — expanded WORLD RULES with explicit anachronism list

Rule 15 (WORLD RULES = FAERÛN) now spells out banned anachronisms
that Sonnet drifts toward:

- **NO TRAINS, rails, railways.** Caravans move by wagon, ox, horse,
  foot. "A wagon train" at most.
- **NO GUNS, firearms, cannons, gunpowder** (unless the setup
  explicitly establishes a gunpowder setting).
- **NO MODERN TECH:** no photos, phones, cars, radios, computers,
  precise-minute clocks (use bells / candlemarks / sundials), kilometers,
  "miles per hour."
- **NO INDUSTRIAL CONCEPTS:** factories, assembly lines, shipping
  containers, steam engines, electricity, plastic.
- **Currency:** gold/silver/copper, never "dollars."
- **Time:** tenday, season, candlemark, watch, bell — not "week" /
  precise "hour."
- **Distance:** miles, leagues, bowshots, strides — not metric.

Plus the existing Faerûn canon clauses (animals don't speak, 5e magic,
canonical pantheon).

FINAL REMINDER block also surfaces anachronism guard.

### Prompt — expanded SKILL CHECKS with reading + anti-stall

Rule 13 (COMBAT AND SKILL CHECKS) now includes:

- **New explicit scenario: Reading a difficult text.** Intelligence
  check. DC by complexity: merchant's ledger DC 10, lord's formal
  letter DC 12-15, arcane/ancient text DC 15-20. Child-level literacy
  vs. adult document = roll, not handoff.
- **Anti-stall guard:** if your response would end with "keep going,"
  "try again," "continue," "what do you think it says" — and the
  next step needs content the player doesn't have (more of a letter,
  next beat in a song) — THAT IS A SKILL CHECK, not a handoff. Call
  for the roll.
- **Worked example** in the prompt: the player-character reading a
  lord's formal letter aloud. Wrong behavior (end with "keep going")
  vs. right behavior ("The next sentence is small and dense — give me
  an Intelligence check, DC 13") baked in.

FINAL REMINDER block adds the anti-stall line so Sonnet sees it in
recency position.

### Tests + build

- All prelude suites still green (38 + 15 + 46). Build clean.
- Prompt-only change, no schema or API touch.

## [1.0.0.52] - 2026-04-20 — Prelude: skill checks, banned openers, family race, dev toggle

Round 4 of play-test feedback. Six coordinated changes tackling the
biggest remaining issues: no skill-check requests, stock opening lines,
family-race assumptions, and sessions drifting into pure-conversation
drift.

### Prompt — SCENES CARRY WEIGHT (revised urgency rule)

Previous framing demanded an event-or-shift in every scene. Too strict
— it ruled out quiet moments like Aelwin-and-the-wax-tablet that
genuinely matter. New framing:

> Most scenes should contain one of: event, discovery, decision forced,
> relationship change, threat, revelation, or meaningful time
> compression. Pure texture scenes are ALLOWED but must be the
> exception — roughly 1 in 5, not 4 in 5.

Plus a STALL GUARD: if a scene has drifted through 3-4 dialogue
exchanges with no shift, escalate — interruption, revelation,
consequence, or time-forward.

New companion rule: **TIME ADVANCES AFTER TEXTURE SCENES** — specific
per-chapter pacing guidance. Early chapter: days-to-weeks between
scenes. Mid chapter: weeks-to-months. Approaching boundary:
months-to-a-year. At the boundary: emit `[AGE_ADVANCE]`. Texture scenes
cost real time budget.

### Prompt — COMBAT AND SKILL CHECKS (expanded, made proactive)

Previous rule just said "ask for rolls." Play-test surfaced zero rolls
across multiple sessions. New rule is explicit about:

- **Never narrate an uncertain outcome without the roll.**
- **State the DC, then STOP. Wait for the player to report.**
- **DC guidance:** standard = 10, easy = 5, hard = 15, very hard = 20.
- **Nat 1 = critical failure** — lean into humor/disaster appropriate to tone.
- **Nat 20 = critical success** — lean into magnificent outcomes.
- **Be PROACTIVE**: learning a craft → Insight or tool proficiency.
  Reading a person → Insight. Remembering → History. Sneaking →
  Stealth. If you're narrating an uncertain outcome without asking for
  a roll, you're doing it wrong.

### Prompt — BANNED STOCK OPENERS

Every test character opened with some variant of: "[Name] is [N] winters
old and small for it, the smallest person in any room that isn't a
cradle." Explicit bans added to both the ABSOLUTE RULES and the
opening-prompt:

- "[Name] is [N] winters old…"
- "small for it" / "small for [their age]"
- "the smallest person in any room that isn't a cradle"
- "[season] sun comes through the [window/door] in [stripes/bars/…]"
- Any demographic-summary-plus-size opener as the first line.

Open on a SPECIFIC moment instead.

### Prompt — NO NPC ECHO AS DEFAULT

The pattern where an NPC repeats the player's phrase back as a
"I'm-listening" beat ("'Fitting in,' he says. Not a question. More
like he's turning the phrase over to see what's under it.") is an AI
tic. New rule: allowed MAX ONCE per session across ALL NPCs, only for
characters where it genuinely fits (a quiet elder, a careful priest).
Never as a default.

### Prompt — NO INVENTED SPECIALNESS

Sonnet kept treating the player's uncommon-race birth as a secret or
burden even when the player hadn't established that. New rule: if the
player's family shares the player's race (they usually do by default
— see race fields below), that's normal. Don't dwell on "your
specialness" unless the player's setup actually established that.

### New — parent and sibling race fields

Each parent slot now has a race dropdown alongside role, name, and
status. Each sibling slot adds race alongside gender + relative age.
Default: player's race. Override per-slot for mixed-race or foundling
scenarios. Piped through to both the Opus arc-plan generator and the
Sonnet session prompt as canonical.

Existing characters (pre-v1.0.52) without race data fall back to the
player's race silently — no migration needed.

### New — dev-mode arc preview toggle

New checkbox at the bottom of the setup wizard: "Show the arc preview
(testing)." Default ON while play-testing. When unchecked, the wizard
submits and the player goes straight into the first session — the arc
plan is auto-generated server-side on session start (adds 45-90s to
the first turn; same token cost, just deferred).

This addresses "I like the arc preview for testing but don't want it
in the full game." Flip the checkbox OFF for production-feeling play.

### Tests + build

- All prelude suites still green (38 + 15 + 46). Build clean.
- No schema changes — parent/sibling race is a new optional JSON field
  on the setup payload, server accepts it without migration.

## [1.0.0.51] - 2026-04-20 — Character delete: dynamic FK discovery

Play-test turned up a character that couldn't be deleted from the UI —
the endpoint was failing silently with a foreign-key constraint error.
Manual cleanup found the blocking row was in a table not on the
endpoint's hand-written deletion list. Rewrote the endpoint to
discover FK references dynamically from the schema.

### Problem

The `DELETE /api/character/:id` endpoint was maintaining a 13-step
hand-written deletion list of tables with `character_id` columns.
Every time a new table with an FK to `characters` was added (e.g.,
the Phase 1 prelude tables, or older feature tables that were never
retrofitted), someone had to remember to add it to the delete list.
When a row existed in an unlisted table, the final `DELETE FROM
characters` would fail with `SQLITE_CONSTRAINT: FOREIGN KEY constraint
failed` — and the client just saw "delete failed" with no hint which
table was blocking.

In TEST_LWChar's case, the blocker ended up being `companions.recruited_by_character_id`
(actually on the list), but an earlier table in the chain threw first
and the endpoint never reached the companion delete.

### Fix

`DELETE /api/character/:id` now:

1. Handles one known **indirect cascade** explicitly — `session_message_summaries`
   FKs `dm_sessions`, not `characters` directly, and has no `ON DELETE
   CASCADE`. So we clear it before any `dm_sessions` rows go.
2. Scans `sqlite_master` for every table, queries
   `PRAGMA foreign_key_list` on each, and collects every `{table, column}`
   pair with a declared FK to `characters`.
3. Deletes matching rows from each discovered table (order among direct
   FK holders doesn't matter — they're all at the same depth).
4. Deletes the `characters` row last.
5. On FK-constraint failure, returns HTTP 409 with the specific error
   message instead of generic 500. Logs the full stack for inspection.

New tables with an FK to `characters` are picked up automatically on
next request — no endpoint edit needed. The response includes
`cleaned_tables` (count cleared) and `tables_scanned` (total in
schema) for observability.

### Why the dynamic approach is safer than hand-maintained

Since v1.0.0 the codebase has added ~20 tables with `character_id`
FKs across themes, crafting, mythic progression, merchants, bases,
prelude, etc. The hand-written list drifts against the schema
silently. The dynamic sweep trades a small per-request cost
(~20-30 extra PRAGMA queries on delete — happens once per character,
not per turn) for reliability.

### Tests + build

- All 5 unit suites still green. Client build clean.
- No schema change — this is endpoint logic only.

## [1.0.0.50] - 2026-04-19 — Prelude 2b-i round 3 (grounded prose + UX polish)

Round 3 of real-play feedback. Big fix: Sonnet was overwriting the
opening scene with writerly metaphor ("The Spine of the World sits
blue on the horizon and pretends to be a wall"). Added GROUNDED
PROSE as a new ABSOLUTE RULE with concrete WRONG/RIGHT examples. Plus
four smaller fixes from the same play-test.

### New — sibling gender field

Setup was asking for sibling name + relative age but not gender —
leaving the AI to guess or use neutral language. Added a gender
dropdown (Sister / Brother / Sibling non-binary) per sibling slot.
Schema: `{ name, gender, relative_age }` where gender defaults to
`sibling` on null. Wizard UI row is now 4-column; server prompt
surfaces sibling gender inline.

### Prompt fix — whimsical tone description

Old text: "Wonder is close to the surface — omens in the wheat, the
forge that hums on feast days, **dreams that come true small**. The
world of Faerûn stays Faerûn; the whimsy lives in perception and
small kindnesses, **not in rule-breaking.**" The "dreams come true
small" phrasing was confusing ("what does that even mean?"), and the
"not in rule-breaking" clause was a system rule leaking into player-
facing flavor text. New text: "Wonder is close to the surface — small
omens in the wheat, a forge that sings on feast days, folk tales
half-remembered from old grandmothers. Tender and curious, not twee."

### Prompt fix — GROUNDED PROSE (new ABSOLUTE RULE 18)

Sonnet's opening scene drifted into purple prose that reads as
"AI trying to sound literary" rather than a child's lived moment.
Five specific patterns now banned:

(a) **Personifying inanimate things that adds nothing.** WRONG: "The
Spine of the World sits blue on the horizon and pretends to be a
wall." The mountain IS a wall. The personification is showing-off.

(b) **Abstract-compound descriptors for people.** WRONG: "a tall
woman made of long bones and patience." Writerly tic. RIGHT: "a
tall woman with a long face and rough hands."

(c) **Delayed-reveal syntax for known subjects.** WRONG: "someone —
your father, years ago — carved a small crooked star." If the player
knows who, name them directly.

(d) **Single-line poetic flourishes ending a paragraph.** WRONG:
"The morning stretches out ahead, empty and ordinary and entirely
Zalyere's." These read as short-story endings, not session beats —
they substitute mood for direction.

(e) **Metaphor compounds stacked three-ways.** One flourish per
paragraph at most, earned.

Plus an explicit age-perception reminder: "A 6-year-old does NOT
perceive their mother as 'made of long bones and patience.'" Stay
in the perceptual register of the character's age.

FINAL REMINDER block updated to surface GROUNDED PROSE in recency
position — Sonnet will see it on every turn.

### UX — elapsed-time counter on loading screens

Static estimates ("20-40 seconds" / "15-30 seconds") were inaccurate
and gave no sense of real progress. Both the arc-generation loading
screen and the session-opening loading screen now show a live
monospace `{N}s elapsed` counter updating twice per second. Static
estimates bumped to more accurate ranges: arc 45-90s, opening 30-60s.
The in-feed "The story unfolds…" during send also shows elapsed time.

### UX — Setup review panel in session

No way to see prelude-setup choices once in gameplay. New **Setup**
button in the session top bar toggles an inline panel showing: name,
gender, race, birth circumstance, home, region, parents (with roles),
siblings (with gender + age), talents, cares, tone tags. Useful
during play-test to verify state; also just useful for players who
forget what they picked ten sessions in.

### Tests + build

- All prelude suites still green (38 + 15 + 46). Build clean.
- No schema changes — sibling gender is a new optional field on the
  setup payload JSON blob; server accepts it alongside existing
  schema without migration.

## [1.0.0.49] - 2026-04-19 — Prelude: resume paused sessions

Blocking bug: after clicking "End session" (or a `[SESSION_END_CLIFFHANGER]`
marker firing), the session went to `paused` status but the UI only showed
"Back to characters" — no way to resume. The session was stuck.

### Fixed

- New service method `resumeSession(sessionId)` flips paused → active.
  No-op on already-active sessions, rejects completed ones.
- New endpoint **`POST /api/prelude/sessions/:sessionId/resume`**.
- "Session paused" banner in `PreludeSession.jsx` now shows a **▶ Resume
  session** button alongside "Back to characters." Clicking it flips the
  session back to active, clears the paused banner, and the action input
  reappears so the player can continue.
- The last cliffhanger (from either an end-session or a SESSION_END_CLIFFHANGER
  marker) is already persisted on `session_config.lastCliffhanger`, so the
  next Sonnet call will receive it via the resume prompt infrastructure
  (`createPreludeResumePrompt`) once that's wired into `sendMessage` — which
  happens naturally because `sendMessage` builds the system prompt fresh
  each turn and the resume prompt is baked into the regular continuation flow.

### Tests + build

- Prelude suites still green (38 + 15 + 46). Build clean.

## [1.0.0.48] - 2026-04-19 — Prelude 2b-i play-test fixes (round 2)

Round 2 of real-play feedback. Six new ABSOLUTE RULES + deeper work
logged to FUTURE_FEATURES.

### Prompt fixes

**ABSOLUTE RULE 1: SECOND-PERSON NARRATION.** The AI was writing "Rook
looks at Zalyere" and "Rook looks at him" — third person about the
player character. Breaks immersion. New rule: always "you," never the
character's name (except when another character speaks it aloud). One
allowed exception: the opening scene can use the full name as
establishing exposition once, then shifts to "you" for everything after.

**ABSOLUTE RULE 3: NPC QUESTIONS ARE HARD STOPS.** The AI had an NPC
ask "You got coin for bread?" and then keep talking right past it:
"I'll walk with you… Got nothing. Breta gave me a heel last tenday."
The player never got to answer. Ported the main-DM rule: when an NPC
asks a direct question, the response ENDS. Includes the WRONG/RIGHT
pair.

**ABSOLUTE RULE 4: HONOR ESTABLISHED PRONOUNS.** "They're" was used
for Rook, whose gender is established (boy). New rule: gendered NPCs
get gendered pronouns. Only use they/them for genuinely unknown or
explicitly non-binary NPCs.

**ABSOLUTE RULE 6: KEEP MOMENTUM.** The big one. After the player
finished the bread errand, the AI left them in "the morning stretches
out ahead, empty and ordinary" — a "what now?" vacuum. For a
6-year-old character with no agency or worldliness, directionless
banter is unplayable. New rule: when a beat concludes, advance time,
introduce a new beat, surface a seeded arc beat that hasn't fired, OR
offer 2-3 concrete age-and-location-appropriate options. Never drift.

**ABSOLUTE RULE 7: FAERÛN CALENDAR.** The AI called a month "October"
— should be "Marpenoth." Harptos months listed in the rule: Hammer,
Alturiak, Ches, Tarsakh, Mirtul, Kythorn, Flamerule, Eleasis, Eleint,
Marpenoth, Uktar, Nightal. "Tenday" not "week." Mention the month
sparingly — once for season, not in every paragraph.

**ABSOLUTE RULE 8: WORLD JARGON MUST BE INFERRABLE.** The AI used
"heel" and "tenday" with no context — player was lost on both. New
rule: in-world slang either has obvious meaning or gets a brief
contextual hint. "Breta gave me a heel last tenday" → "Breta gave me
a heel — the end-slice, no good for selling — tenday back." Don't
strand the player.

FINAL REMINDER block updated to surface all six new rules in recency
position. Opening-scene prompt updated to specify second-person after
the establishing paragraph.

### Logged to FUTURE_FEATURES — deeper work

Three items flagged for real design work beyond prompt tweaks:

1. **Character voice / tone system.** The existing voice-palette
   infrastructure gives rough sketches; play-test shows NPCs still
   drift to "writerly fragmented dialogue" rather than *this person's*
   actual voice. Needs: signature tics, emotional-state modulation,
   sample-utterance injection, possibly a dialogue-audit pass.

2. **Expanded naming conventions.** The AI leans on a stock pool
   (Voss, Lyra, Aldric, Jarrick, Jakob, Garda, Aldrin) repeatedly.
   Need a culture/region-tuned name bank drawing from the wider
   fantasy literary tradition (Tolkien, Sapkowski, Le Guin, Pratchett,
   Herbert, Moorcock, Howard, Martin, Rothfuss, Abercrombie, etc.).

3. **Cross-session repetition detection.** The session-scope ledger
   (v1.0.34) doesn't catch phrases like "he says the name like he's
   tasting it" that recur across sessions. Optional character-level
   persistent ledger — design tension around how aggressive to be.

### Tests

- All prelude suites still green (38 + 15 + 46). Build clean.
- No test additions — all changes are prompt wording.

## [1.0.0.47] - 2026-04-19 — Prelude 2b-i play-test fixes (SQL + prompt)

First round of real-play feedback on the session loop. One blocker, three
prompt-tuning wins.

### Fixed — SQL error on every send

`sendMessage` was writing `UPDATE dm_sessions SET messages = ?,
updated_at = datetime('now')` but the `dm_sessions` table has no
`updated_at` column (unlike `characters`). Every player action crashed
with `SQLITE_UNKNOWN: no such column: updated_at`. Dropped the
timestamp write — if we need telemetry later, we'll add the column in
a proper migration.

### Prompt fix — dialogue authenticity

Sonnet was writing NPC dialogue like a DM dispensing player instructions
rather than people talking. Example from play-test:

> "Little fish. I need you to run to the bread woman and bring back a
> half-loaf. Just the half. Don't let her talk you into the whole one
> — tell her *half*, and bring back the two copper."

That's stilted — over-explained, complete sentences, narrated shopping
list. Real tired working-class speech is compressed, contextual, and
trusts the listener.

New **ABSOLUTE RULE 11: NPC VOICE — AUTHENTIC SPEECH, NOT DM-NARRATION**
added to the prompt with a WRONG/RIGHT comparison:

> WRONG: "Little fish. I need you to run to the bread woman and bring
> back a half-loaf..."
> RIGHT: "Take this." (pushing the coin across) "Bread. Half a loaf
> — not the whole one. You tell her half." A pause. "And stay off
> the stairs."

The rule calls out: fragments, elision, trust, pronouns-instead-of-nouns,
no self-narration, speech matched to who the person is (tired / rushed
/ guarded / loving) and the tone tags.

### Prompt fix — opening scene set dressing + length

Opening was missing physical grounding — the player came in with no
visual for their own character (age, appearance, clothing, how they
carry themselves), the home (specific corner, sensory detail beyond
the room), or the family member present (face, hands, voice).

**`createPreludeOpeningPrompt`** now explicitly requires 5-8 paragraphs
covering:

1. The character's own body — size relative to adults, canonical race
   features, what they're wearing (shaped by birth circumstance), how
   they carry themselves at this age.
2. The home with senses — smell, sound, texture, light — specific
   corner of it, using the arc plan's home-world description as
   source material.
3. At least one named family member with physical presence — face,
   hands, clothing, voice, wear.
4. A grounded first situation with stakes appropriate to the age,
   tone-matched, using authentic speech per Rule 11.

### Prompt fix — response length guidance

New **ABSOLUTE RULE 13: RESPONSE LENGTH** — weight-matched rather than
uniformly short. Routine beats 2-4 paragraphs, important beats 4-7,
openings 5-8. Never end on exposition; always end on a question or
pressure. FINAL REMINDER block surfaces the same guidance for recency.

### Tests

- All prelude suites still green (38 + 15 + 46). Build clean.
- No test additions — all changes are prompt wording / SQL removal,
  and the existing marker detection tests already cover the output
  side.

## [1.0.0.46] - 2026-04-19 — Prelude Phase 2b-i: core session loop

The prelude is playable. Click **Begin the Prelude** from the arc preview
(or click an in-progress prelude character from the list) and you drop
into a text-based D&D session running within the Opus-generated arc plan.
Opus writes the opening scene; Sonnet runs the gameplay.

### New — prompt builder (`preludeArcPromptBuilder.js`)

Separate from `dmPromptBuilder.js` (adult adventuring) and from
`preludeArcService.buildArcSystemPrompt` (which is Opus *generating* the
arc plan). This builder is **Sonnet playing within** an already-generated
plan. Three entry points:

- `createPreludeSystemPrompt(character, setup, arcPlan, runtime)` — the
  system prompt injected on every Sonnet turn. Includes 11 ABSOLUTE
  RULES + character canon + home-world reference + current chapter's
  seeded beats + recurring threads + MARKERS block + FINAL REMINDER.
- `createPreludeOpeningPrompt(...)` — the user-role "opening" message
  for the first session. Asks Sonnet to open Chapter 1 with a
  grounded, age-appropriate scene ending in an invitation to action.
- `createPreludeResumePrompt(..., lastCliffhanger)` — resume prompt
  when reopening a paused session.

**ABSOLUTE RULES include**: player agency (beats are situations, not
scripted outcomes — with WRONG/RIGHT examples), age-appropriate voice
and stakes, non-binary choices, time compression, real-and-rolled
combat, tone fidelity, Faerûn canon, no invented character traits,
age-register NPC voice, and "arc is reference, not a rail."

### New — session service (`preludeSessionService.js`)

- `startSession(characterId)` — creates a new `dm_sessions` row with
  `session_type='prelude_arc'`, calls Opus for the opening scene, processes
  any markers the opening emits, returns session data.
- `getActiveSession(characterId)` — lookup for UI resume-vs-begin
  branching.
- `getResumePayload(sessionId)` — full payload for reopening a
  session (messages, character, runtime, last cliffhanger).
- `sendMessage(sessionId, action)` — appends player action, calls
  Sonnet (with the latest system prompt reflecting current age/
  chapter), processes markers, persists, returns cleaned response.
- `endSession(sessionId, { completed })` — flips status to `paused`
  (resumable) or `completed` (Phase 5 reserved).
- Race-aware chapter-boundary logic: when `[AGE_ADVANCE]` pushes a
  character past the next threshold for their race
  (dwarf > 25 → Ch2, elf > 50 → Ch2, etc.), the chapter updates.

### New — marker detection (`preludeMarkerDetection.js`)

Five lifecycle markers for Phase 2b-i:

- `[AGE_ADVANCE: years=N]` — time compression; updates character
  age + chapter if threshold crossed.
- `[CHAPTER_END: summary="..."]` — narrative chapter close.
- `[SESSION_END_CLIFFHANGER: "..."]` — natural session pause; flips
  session to `paused` and stores cliffhanger for the resume prompt.
- `[NPC_CANON: name="..." relationship="..." status="..."]` — marks
  NPCs canonical; inserts into `prelude_canon_npcs` (deduped by name).
- `[LOCATION_CANON: name="..." type="..." is_home=true]` — same for
  `prelude_canon_locations`.

Parsers are regex-based and tolerant of single/double/no-quote
variants. `stripPreludeMarkers(text)` removes markers from displayed
narrative while the server retains them for state processing.

Emergence markers (`[STAT_HINT]`, `[SKILL_HINT]`, `[CLASS_HINT]` etc.)
and transition markers (`[DEPARTURE]`, `[PRELUDE_END]`) land in Phase
3 and Phase 5 respectively — scope cut here for shippability.

### New — API endpoints

- `POST /api/prelude/:characterId/sessions/start` — begin a session
- `GET  /api/prelude/:characterId/sessions/active` — resume lookup
- `GET  /api/prelude/sessions/:sessionId` — full resume payload
- `POST /api/prelude/sessions/:sessionId/message` — send player action
- `POST /api/prelude/sessions/:sessionId/end` — pause or complete

Response markers are stripped from the displayed narrative but
retained server-side. The `runtime` object (age + chapter + maxHp)
travels with every response so the UI updates in real time.

### New — UI (`PreludeSession.jsx`)

Text-based gameplay screen with a top bar (character name + chapter
N of 4 + life-stage label + age), scrolling message feed (user actions
styled blue, Sonnet narrative styled purple-tinted), textarea action
input (Enter to send, Shift+Enter for newline), End-session button,
Back-to-characters button. Session-ended state surfaces the
cliffhanger prose + a return button.

### Wired into CharacterManager

- **"Begin the Prelude"** on the arc preview now routes into
  `PreludeSession` (not back to the character list). The button is no
  longer a dead end.
- **Clicking an in-progress prelude character** checks for an active
  session: if one exists, jumps straight into `PreludeSession`; if
  not, opens the arc preview (which has the Begin button).

### Tests

- **`tests/prelude-markers.test.js`** — 46 tests covering all 5
  markers' detection + `stripPreludeMarkers` + `detectPreludeMarkers`
  roll-up. Handles single/double/no-quote variants, edge cases
  (empty, missing fields, negative numbers), and the roll-up
  aggregation.
- Existing suites all still green: prelude-setup 38, prelude-arc 15,
  plus 310 pre-prelude tests. Total 409.
- Client build clean.

### Scope deliberately cut from 2b-i

These land in subsequent sub-phases:

- **Dice roller UI** (2b-ii) — player describes rolls in action text
  for now; the prompt tells Sonnet to state DCs/ACs and ask the
  player to roll physically and report.
- **Combat tracker integration** (2b-ii).
- **Age-scaled provisional stats engine** beyond the max-HP formula
  that ships here (2b-ii).
- **`[CHAPTER_PROMISE]` marker** (chapters 3-4 only) (2b-ii).
- **Prelude-tuned rolling summary template** (2b-ii).
- **Emergence markers + toast UI** (Phase 3).
- **`[DEPARTURE]` + `[PRELUDE_END]` transition flow** (Phase 5).

## [1.0.0.45] - 2026-04-19 — Arc preview fixes (play-test round 2)

Second round of play-test feedback. Fixes a batch of UX + prompt issues
surfaced by actually reading a generated arc.

### UX fixes

- **Re-roll button was hidden.** POST `/api/prelude/:id/arc-plan` returned
  the plan object without the `can_regenerate` flag that the UI checks —
  so `plan.can_regenerate` was always `undefined`, hiding the button
  after the initial generate. Fixed: POST now includes the flag.
- **Preview was left-aligned.** The outer `.app` container is centered at
  1200px, but `PreludeArcPreview` set `maxWidth: 780px` without
  `margin: 0 auto`, so the 780px card hugged the left edge with huge
  right whitespace. Added `margin: 0 auto` to both the preview and the
  setup wizard.
- **False "Level Up!" badge on prelude characters.** The level-up status
  checker was running `/api/character/can-level-up/:id` on prelude-phase
  characters (which have `class='prelude'`, `level=0`), producing bogus
  level-up notifications. Fixed: level-up check now skips characters
  with `creation_phase === 'prelude'`. Leveling happens when the prelude
  ends and the main creator submits — not during play.
- **No way to resume an in-progress prelude.** Clicking a prelude
  character in the character list now routes back into the arc preview
  so the player can pick up where they left off. (Phase 2b will replace
  this with a session-resume hook.)

### Arc prompt fixes (the big ones)

Three new ABSOLUTE RULES added to the Opus arc-plan generator to fix
player-agency violations + ungrounded suggestions observed in the first
real generation:

- **Rule 8: BEATS ARE SITUATIONS, NOT SCRIPTED OUTCOMES.** The single
  most important rule. A beat describes the SITUATION the player walks
  into — the setting, the other people, the stakes, the question. It
  does NOT describe what the character does, says, feels, or decides.
  WRONG/RIGHT examples are now in the prompt:
  - WRONG: "Cornered by toughs in an alley, Zalyere spins a lie so
    vivid about a watchman coming that the men flinch and leave."
  - RIGHT: "Cornered by toughs in an alley, close enough to smell the
    indigo on their hands. The way you get out of this — fists, lies,
    running, surrender, something else — will mark how Rook sees you
    for years."
- **Rule 9: DON'T INVENT CHARACTER TRAITS NOT IN THE SETUP.** The
  previous generation hallucinated "dark veins to the surface of his
  arms" as a scourge-aasimar fever symptom — never in the player's
  setup. New rule: canonical 5e race features are fair game, but
  invented physical markers (veins, birthmarks, glowing eyes) and
  family secrets (hidden bloodlines, prophecies) are not. Stay inside
  the lines the player drew.
- **Rule 10: TRAJECTORY NUDGES MUST CITE PLAYER SETUP EXPLICITLY.**
  The previous "paladin because scourge aasimar" reasoning was
  ungrounded. New requirement: "paladin because **you said you care
  about Justice and Protecting the Weak**, and Chapter 3 puts you
  between a fallen institution and a quiet faith." Cite talents,
  cares, or tone tags BY NAME.

Schema updated: `character_trajectory` now requires `why_class` and
`why_theme` fields (1 sentence each, must cite setup). The preview UI
renders these below the class/theme nudges. FINAL REMINDER block
reinforces all three new rules with one-liners.

### Tests

- 38 setup + 15 arc + all prior suites still green. Client build clean.
- Prompt changes don't change any API shape, so no test additions.

## [1.0.0.44] - 2026-04-19 — Remove old origin-story prelude

Two systems both calling themselves "preludes" were confusing. The new
prelude-forward character creator is the one we're keeping. The old
single-session origin-story flavor (from migration 022) is fully removed.

### Deleted

- **`server/services/preludePromptBuilder.js`** — the single-session
  origin-story prompt builder. File gone.
- **`client/src/components/PreludeSetup.jsx`** — the old in-session
  prelude setup form. File gone.
- **`POST /api/dm-session/start-prelude`** — the endpoint that started
  an origin-story session for an already-built character. Gone.
- **Prelude-completion hook in `dm_sessions` end-session flow** — the
  `if (session.session_type === 'prelude')` block that set
  `prelude_completed=1` and appended the summary to backstory. Gone.
- **`startPrelude` function in `DMSession.jsx`** and its state
  (`showPreludeSetup`). Gone.
- **"Play a Prelude?" card in `SessionSetup.jsx`** and its
  `onStartPrelude` prop. Gone.

### Preserved (intentionally)

- **Migration 022** itself stays — it's historical and migrations are
  append-only. The columns it added (`prelude_completed`, `prelude_config`)
  remain on the `characters` table but are no longer read or written by
  anything. They're harmless; dropping them would require SQLite 3.35+
  and the cost isn't worth the cleanup.
- **Any existing characters with `prelude_completed=1`** — their flag
  just stops being surfaced. No migration, no backfill.
- **`dm_sessions` rows with `session_type='prelude'`** — historical data
  stays intact. The new system uses `session_type='prelude_arc'` (coming
  in Phase 2b), so the two don't collide.

### Wire-through

- Only one "prelude" entry point now: **Characters → ✦ Start with a
  Prelude** on `CharacterManager.jsx`. No more surprise "Play a Prelude?"
  card appearing inside a session-setup screen.

### Tests

- 38 setup + 15 arc + 310 existing = 363 green. Client build clean.
- No test file referenced the removed APIs, so no test updates needed.

## [1.0.0.43] - 2026-04-19 — Prelude Phase 2a hardening (play-test feedback)

First round of play-test feedback on the arc generator. Addresses a hard
blocker (JSON truncation) and a batch of UX issues surfaced by real setup
flow.

### Fixed — arc generation was hitting max_tokens

Opus was producing verbose beats + wordy JSON overhead that pushed the
output past the 4096-token cap, truncating mid-array and crashing the
JSON parser. Two compounding fixes:

- **Bump max_tokens 4096 → 8192.** Headroom for even the wordiest
  tone combinations (political + mystical + tragic).
- **Tighten the schema prose directives.**
  - home_world description: 3-5 sentences → 2-3
  - locals: 5-10 entries → 4-6 entries, each 1 sentence (was 1 sentence
    but no cap)
  - tensions: any count → exactly 2
  - threats: any count → 1-2
  - chapter beats: 2-3 per chapter → exactly 2
  - beat descriptions: 2-3 sentences → 1-2 sentences
  - chapter_end_moment: 1-2 sentences → 1 sentence
  - recurring_threads: 2-4 → 2-3
  - non_tragic_alternatives: 2-3 → exactly 2
  - seeded_emergences: any count → 1-2 per chapter
  - Explicit "BE CONCISE. Keep prose TIGHT." directive in the system prompt
  - Explicit QUANTITY LIMITS block

Before: two consecutive generation attempts both failed with Opus emitting
~4096 output tokens of an incomplete JSON object. After: plan comfortably
fits in ~2000-3500 output tokens.

### Fixed — starting age now race-aware

Starting age was a hardcoded 5-8 picker regardless of race. An elven 7-year-old
is a newborn by elven reckoning; a dwarven 18-year-old is still
pre-adolescent. Removed the age picker entirely:

- **Q4 starting-age picker is gone.** The wizard now has 11 questions
  instead of 12.
- `server/services/preludeService.js::computeStartingAge(race)` derives
  the Chapter 1 starting age from the character's race:
  human/tiefling/aasimar/halfling = 6, half-elf = 8, half-orc = 4,
  dragonborn = 2, dwarf = 18, elf = 30, gnome = 14, warforged = 1.
- `server/services/preludeArcService.js::RACE_CHAPTER_AGES` defines the
  per-race chapter age ranges passed to Opus so the arc plan honours the
  race's actual life stages. Elves run 25-50 / 50-80 / 80-100 / 100-120;
  dwarves 15-25 / 25-40 / 40-50 / 50-75; humans 5-8 / 9-12 / 13-16 / 17-21;
  warforged "N years post-activation" across all four chapters.
- The arc system prompt explicitly notes: "This character is a {race}.
  Chapter 1 = early childhood for a {race} ({ages.ch1}). Chapter 4 =
  threshold of adulthood for a {race} ({ages.ch4})."
- Smoke-test confirms: creating an elf now produces `prelude_age=30` (was
  always 7); a dwarf → 18; a warforged → 1.
- Validator no longer checks starting_age. If a client sends one anyway,
  it's silently ignored and recomputed from race.

### Fixed — setup UX issues from play-test

- **Merged `farmer_child` + `rural_smallholder` → `farm_family`.** They
  were functionally identical; the isolated-vs-connected distinction is
  handled by the home-setting question (farmstead vs. village etc.).
- **Regions annotated with race affinities.** Each region's description
  now ends with the dominant races ("Cormyr — predominantly human,"
  "Underdark — drow, duergar, deep gnomes," etc.). Two new regions
  added: **Cormanthor** (ancient elven realm east of Cormyr) and
  **Evermeet** (elven island kingdom) — give elven characters natural
  homelands.
- **Parent slots now have a role dropdown.** Was "Parent 1 / Parent 2"
  with no way to distinguish; now: Mother, Father, Guardian, Step-mother,
  Step-father, Adoptive mother, Adoptive father, Grandmother/father
  (raised you), Aunt/Uncle (raised you), Elder sibling (raised you).
  Both slots can be any role — two mothers, guardian + stepfather, etc.
- **Sibling age is now Younger / Older / Twin** — dropdown replaces the
  confusing "age diff number; positive = older, negative = younger"
  input. Server-side validation enforces the enum.
- **Q9/Q10 now address the player directly** — "Three things you're
  good at," "Three things you care about" (was "they").
- **Whimsical tone description rewritten.** Old text said "animals might
  speak" which violates Faerûn's established rules. New text:
  "Wonder is close to the surface — omens in the wheat, the forge that
  hums on feast days, dreams that come true small. The world of Faerûn
  stays Faerûn; the whimsy lives in perception and small kindnesses,
  not in rule-breaking." The arc prompt also gets an explicit WORLD RULES
  line reinforcing that Faerûn canon is non-negotiable.

### Tests

- `tests/prelude-setup.test.js` grew from 37 → 38 tests covering the
  new sibling relative_age enum and the removed age-bounds logic.
- `tests/prelude-arc.test.js` still at 15 (no schema-validation shape
  changes).
- All 7 prior suites still green.
- Client build clean.

## [1.0.0.42] - 2026-04-19 — Prelude Phase 2a: Opus arc plan + preview

Second Prelude ship. After the player completes the 12-question setup, Opus
now generates a structured 1-2k-token arc plan covering the entire 7-10-session
shape of the character's childhood. The player sees a full preview before
gameplay, with a single re-roll available if it doesn't land. No gameplay
yet — Phase 2b adds the session loop.

### New — Phase 1 audit fixes (shipped alongside 2a)

- **Server-side name validation lenient to match client.** Phase 1's server
  validator required BOTH `first_name` AND `last_name`, while the wizard
  accepted either. D&D has plenty of single-name characters ("Pig," "Tom,"
  "Vermalen"). Fixed the server to match the wizard — at least one name
  field must be non-empty. Added test cases for first-only, last-only,
  and both-empty.
- **Prelude-phase characters get a purple "✦ In Prelude" badge** in the
  character list and render as `[Race] (Subrace) · Age N` instead of the
  misleading "Level 0 [Race] Prelude" that Phase 1 produced. Makes
  in-progress preludes visually distinct from finished characters.

### New — arc plan service

- **`server/services/preludeArcService.js`** — Opus call + persistence.
  - `generateArcPlan(characterId, { isRegeneration })` — calls
    `claude-opus-4-7` with a structured system prompt (6 ABSOLUTE RULES +
    JSON output format + FINAL REMINDER) and a user prompt containing
    the character's full 12-question setup enriched with the player-
    selected tone tags' full descriptions.
  - `getArcPlan(characterId)` — reads and parses the stored plan.
  - `canRegenerate(characterId)` — returns true only if the re-roll
    hasn't been used (hard cap `MAX_REGENERATIONS=1`).
  - `extractJson()` — strips fence wrappers and surrounding prose, finds
    the outermost `{ ... }` block. Tolerates Opus occasionally echoing
    a preamble or closing comment.
  - `validateParsedPlan()` — rejects missing `home_world`, any missing
    `chapter_N_arc`, or a chapter 4 arc missing its `departure_seed`.

### New — arc plan content shape

```
{
  home_world: { description, locals[5-10], tensions[], threats[], mentor_possibility }
  chapter_1_arc: { theme, beats[2-3], chapter_end_moment, seeded_emergences[] }
  chapter_2_arc: (same)
  chapter_3_arc: (same + chapter_promise_prompt)
  chapter_4_arc: (same + chapter_promise_prompt + departure_seed)
  recurring_threads[2-4]
  character_trajectory: { suggested_class, suggested_theme, suggested_ancestry_feat, notes }
  seed_emergences[] — candidate hints the arc nudges toward; emergences still fire from played behaviour
}
```

The departure seed explicitly carries both a primary reason
(pilgrimage / test / conscription / exile / apprenticeship-posting /
political-match / call-to-adventure / flight / tragedy) and an emotional
tone, plus 2-3 non-tragic alternatives in case play diverges.

### New — server-side labels

- **`server/services/preludeSetupLabels.js`** — mirrors the client's
  `preludeSetup.js` curated lists (BIRTH_CIRCUMSTANCES, HOME_SETTINGS,
  REGIONS, TONE_TAGS). Used only to enrich the Opus prompt with the same
  flavor text the player saw when picking. Keep in sync with the client
  file; if they drift, Opus still works on raw `value` strings.

### New — API endpoints

- `POST /api/prelude/:characterId/arc-plan` — generate. Accepts
  `?regenerate=1` query param (or `{regenerate: true}` body) for re-roll.
  Returns 400 when the re-roll limit is exceeded, else the parsed plan.
- `GET /api/prelude/:characterId/arc-plan` — read. 404 if not yet
  generated. Response includes `can_regenerate` flag so the UI can
  hide the re-roll button after the cap is hit.

### New — UI

- **`PreludeArcPreview.jsx`** — full-page preview shown right after
  setup completes. Renders the home (description + locals + tensions +
  threats + mentor possibility), all four chapters (theme + beats +
  chapter-end moment; chapter 4 also shows the departure seed),
  recurring threads, and the soft trajectory suggestions. Auto-fetches
  the plan on mount (generates if not yet generated). Re-roll button
  respects the server-side cap.
- **CharacterManager flow** — setup → arc preview → (Phase 2b will add
  gameplay) → back to character list. `preludeArcCharacter` state
  drives the new screen; `showPrelude` still drives the wizard.

### Tests

- **`tests/prelude-arc.test.js`** — 15 tests on `extractJson` (clean,
  fenced, with prose, malformed, empty) and `validateParsedPlan`
  (minimal, null, missing fields, missing departure_seed). All green.
- Prelude setup tests grew from 35 → 37 to cover the single-name fix.
- All 7 prior suites still green (56 + 59 + 26 + 56 + 49 + 21 + 43 = 310).
- Client build clean.

### Known concerns (non-blocking for Phase 2a)

- **Pre-existing "prelude" system** from migration 022 is a separate
  single-session origin-story flavor (different from this 7-10 session
  character-creation-through-play system). Both coexist: the old system
  uses `preludePromptBuilder.js` + `prelude_completed` flag + `session_type='prelude'`;
  the new one uses `preludeArcService.js` + `prelude_arc_plans` table +
  `creation_phase='prelude'`. Phase 2b will name its new session-prompt
  module `preludeArcPromptBuilder.js` and use `session_type='prelude_arc'`
  to avoid collision.

## [1.0.0.41] - 2026-04-19 — Prelude Phase 1: setup scaffolding

First ship of the Prelude-Forward Character Creator (see
`PRELUDE_IMPLEMENTATION_PLAN.md` for the full 6-phase plan). This release
lays the foundation: data model, setup wizard, API endpoints. No gameplay
yet — Phase 2 adds the Opus arc-plan generator + session loop.

### New — setup flow

- **"✦ Start with a Prelude" button** in the character manager, next to
  "+ New Character" — purple-accented. Opens a new 12-question setup
  wizard instead of the standard creator.
- **`PreludeSetupWizard.jsx`** — 12 questions, every one mandatory.
  Curated picklists with free-text fallback (except Q12 which is a
  closed vocabulary):
  1. Name (first / last / nickname)
  2. Gender (female / male / non-binary / other-write-your-own)
  3. Race + sub-race (same pickers as main creator)
  4. Starting age (5-8, default 7)
  5. Birth circumstance (10 curated: noble scion, street orphan,
     caravan child, refugee, temple foundling, etc.)
  6. Home setting (12 curated: village, tenement, caravan, ship, etc.)
  7. Region (15 curated FR regions + free text)
  8. Parents (1-2, each with name + status: present / living-distant /
     died-before-memory / died-in-childhood / unknown)
  9. Siblings (0-N, name + age difference)
  10. 3 things they're good at (28 curated + free text)
  11. 3 things they care about (27 curated + free text)
  12. Tone tags (pick 2-4 from 16 — gritty, dark humor, epic, quiet,
      tragic, whimsical, political, rustic, mystical, brutal, tender,
      romantic, eerie, bawdy, spiritual, hopeful). Composite shapes
      arc-plan generation and scene prose in later phases.

### New — data model (migration 042)

- `characters` gains 4 columns: `creation_phase` (default `'active'`
  for existing rows; `'prelude'` for new prelude characters),
  `prelude_age`, `prelude_chapter`, `prelude_setup_data` (JSON blob).
- New tables, all scoped per-character with FK cascade:
  - `prelude_emergences` — every `[STAT_HINT]` / `[SKILL_HINT]` /
    `[CLASS_HINT]` / `[THEME_HINT]` / `[ANCESTRY_HINT]` / `[VALUE_HINT]`
    the AI will eventually emit, with accept/decline status. Unused
    in Phase 1; wired in Phase 3.
  - `prelude_values` — rolling tally of emergent values. Unused in
    Phase 1; wired in Phase 3.
  - `prelude_canon_npcs` — parents, siblings, mentors, rivals that
    will carry into the primary campaign.
  - `prelude_canon_locations` — home village, landmarks, region
    anchors.
  - `prelude_arc_plans` — table scaffolding only; Phase 2 populates
    this from Opus via `preludeArcService.js`.

### New — API surface

- `POST /api/prelude/setup` — creates a prelude-phase character.
  Server-side `validateSetupPayload` enforces all 12 field rules
  (matches client-side validation in the wizard).
- `GET /api/prelude/list` — all preludes (for the character manager).
- `GET /api/prelude/:characterId` — one prelude with parsed setup.
- `server/services/preludeService.js` — `createPreludeCharacter`,
  `getPreludeCharacter`, `listPreludeCharacters`, `validateSetupPayload`.
  Provisional stats (all 10s + age-scaled HP) are set at creation time;
  emergences accrue on `prelude_emergences` in later phases.

### Phase 1 cap — nothing playable yet

After submitting the setup, the wizard closes and the player returns
to the character list. The prelude character is saved with
`creation_phase='prelude'` and all 12 answers persisted — but gameplay
doesn't exist until Phase 2 (arc plan + session loop). The
`onPreludeCreated` hook is wired so Phase 2 can route to the arc
preview screen without rewiring.

### Tests

- `tests/prelude-setup.test.js` — 35 tests covering payload validation
  (happy path, required fields, age bounds, parents / siblings array
  rules, talent/care count enforcement, tone-tag count limits,
  null/empty/whitespace edges). All green.
- All 7 existing suites still green (56 + 59 + 26 + 56 + 49 + 21 + 43 = 310).
- Client `vite build` succeeds; migration 042 applies cleanly on boot.

## [1.0.0.40] - 2026-04-19 — Character creator descriptions pass

Addresses player feedback: "the character creator we've built is good,
but it isn't descriptive enough. I want to make sure that when a player
creates a new character, they know who and what they're creating."

The wizard was strong on narrative choices (alignment, deity, theme,
lifestyle) but weak on the mechanical ones — weapons, armor, tools,
skills, languages, and theme sub-choices were bare names in dropdowns
with no explainer. This release surfaces that information inline.

### New reference data
- **`client/src/data/references.js`** — single source of truth for
  1-sentence explainers of shared D&D 5e concepts. `ABILITY_SCORES`
  (6), `SKILLS` (18), `TOOLS` (~27 artisan + gaming + kits + 10
  instruments), `LANGUAGES` (~18 standard + exotic + Druidic +
  Thieves' Cant), `DAMAGE_TYPES` (13), `WEAPON_PROPERTIES` (11),
  `MAGIC_INITIATE_CLASSES` (6). Plus `formatWeaponLine/ArmorLine/
  GearLine` helpers for compact inline stats.
- **`client/src/data/races.json`** — added `description` field to all
  10 base races (Aasimar, Dragonborn, Dwarf, Elf, Half-Elf, Half-Orc,
  Halfling, Human, Tiefling, Warforged). Previously only subraces had
  descriptions; selecting a race with no subrace showed nothing.

### Theme sub-choice schema upgrade
- `server/data/themes.js` — `creation_choice_options` upgraded from
  bare `string[]` to `{ value, label, description }[]` for the three
  themes that use sub-choices: Outlander (9 biomes), City Watch (10
  home cities), Knight of the Order (4 order types). Each option now
  carries a 1-sentence flavor description.
- **Back-compat preserved.** `value` fields match the old strings, so
  existing characters' `theme_path_choice` values still resolve. The
  wizard renders both shapes (objects → description shown; strings →
  legacy behavior). Seed service already JSON.stringify's the blob;
  no migration needed — next boot reseeds.

### Wizard rendering (`CharacterCreationWizard.jsx`)
- **Theme sub-choices**: description appears under the selected value
  (italic gray, 0.8rem).
- **Base race**: description rendered above subrace description in the
  Racial Traits box.
- **Class features**: `"Name - Description"` strings parsed and
  rendered as `<strong>Name</strong> — description` for readability.
- **Ability scores** (Step 2): 1-sentence explainer under each STR/
  DEX/CON/INT/WIS/CHA label.
- **Skill picker** (Step 2 class skills): skill name bold + governing
  ability + 1-sentence description per tile.
- **Equipment items**: stat line inline in dropdowns and under picks
  (e.g., "Longsword — 1d8 slashing · versatile · 15 gp · 3 lb").
  Packs show cost in dropdown; contents already surfaced below.
- **Ancestry feat picker**: `flavor_text` line now rendered below the
  description. Sub-choice selects show inline reference descriptions
  (skill / tool / language / damage / weapon) under the picked value.
- **Background language picker**: description under selected language.
- **Background tool picker**: description under selected tool.
- **Variant Human PHB feat sub-choices**: class picker surfaces Magic
  Initiate flavor ("Wizard = methodical studied arcane magic" etc.);
  other sub-choices get the same reference-map helper.

### Not shipped (deferred to a polish pass)
- Class feature data schema rewrite. Most features already have
  `"Name - Description"` strings embedded — rendering fix is enough.
  A cleaner `{ name, description }[]` schema is a follow-up.
- Tooltips for weapon properties (finesse, versatile, etc.). Data is
  in `WEAPON_PROPERTIES` map; UI integration pending.

### Tests
- All 5 existing suites still green (56 + 59 + 26 + 56 + 49 + 21 +
  43 = 310). No behavioral changes to prompts, markers, or API
  shapes — purely additive data + UI.
- `vite build` succeeds without warnings beyond the existing chunk-
  size notice.

## [1.0.0.39] - 2026-04-19 — City Watch home city options + seed refresh for theme fields

### Bug fix
- **City Watch theme's "Home City" dropdown was empty.** The theme had
  `creation_choice_label: 'Home City'` but `creation_choice_options: []`
  in `server/data/themes.js` — the list had never been populated. Added
  the 10 canonical Forgotten Realms cities from `STARTING_LOCATIONS`:
  Waterdeep, Baldur's Gate, Neverwinter, Luskan, Silverymoon, Mithral
  Hall, Candlekeep, Menzoberranzan, Calimport, Athkatla.

### Seed refresh
- `progressionSeedService.seedThemes()` previously only backfilled
  `description` on existing theme rows. Any other seed-data change
  (like populating `creation_choice_options` for City Watch) wouldn't
  propagate without a DB reset.
- Extended the UPSERT to also refresh `identity`, `creation_choice_label`,
  and `creation_choice_options` when they differ from the seed file.
  Only writes when at least one field differs, so it's idempotent and
  quiet when there's nothing to update.
- Added a null-coalesce helper so libsql doesn't reject undefined args
  when a pre-existing row has sparse columns.

Effect: next server boot automatically picks up the City Watch fix
(and any future similar data changes) — no manual migration needed.

## [1.0.0.38] - 2026-04-19 — Rolling session summaries

Final invisible-infrastructure follow-up. Replaces the reactive "panic
compress when the context window fills up" pattern with incremental,
proactive summarization. No latency spike mid-session, no loss of
detail from emergency compression.

### How it works
- `dm_sessions` gains three columns via migration 041:
  - `rolling_summary TEXT` — prose recap of the earlier session
  - `rolling_summary_through_index INTEGER` — last message index covered
  - `rolling_summary_updated_at TEXT` — telemetry
- After every AI response, if the session's message count has grown
  past a roll threshold, a background Sonnet call extends the summary
  to cover the next chunk. Fire-and-forget — never delays the player's
  turn.
- When assembling the NEXT turn's prompt, `applyToMessages()` replaces
  the summarized prefix with a synthetic "PREVIOUS SCENES — SUMMARY"
  message. Messages after the through-index are kept verbatim.
- The most-recent 16 messages (~8 exchanges) are always kept verbatim —
  the model needs recent turns in full to stay coherent.

### Tunables (in `rollingSummaryService.js`)
- `KEEP_TAIL_MESSAGES = 16` — never summarize the last N
- `ROLL_TRIGGER_THRESHOLD = 30` — start rolling once messages > 30
- `ROLL_CHUNK_SIZE = 8` — summarize this many per roll
- `MIN_ROLL_AGE_MESSAGES = 4` — don't re-roll the same chunk

### Summary generation
- Sonnet call with a dense, factual template — output read only by the
  DM, never the player, so the summary stays compact and information-
  rich rather than narrative-pretty.
- Produces updates under ~600 words; condenses older material as the
  summary grows.
- Preserves: named NPCs, locations, items gained/lost, promises
  made/kept, combat outcomes, deaths, key decisions, discovered clues.
- Drops: atmospheric description, weather dressing, repeated scene-
  setting.

### Safety net
- Reactive `shouldCompress` / `compressMessageHistory` stays in place
  as a last-resort fallback. With rolling summaries active it should
  rarely fire — but it catches edge cases where summarization lags
  behind (rapid-fire turns, Sonnet outage, etc.).

### Tests
- New `tests/rolling-summary.test.js` — 21 unit-test assertions for
  `shouldRoll` and `applyToMessages` across edge cases (empty,
  drifted through-index, missing system message, etc.).
- All existing suites still pass.

### Deferred
- Live-session integration test (requires real Sonnet calls and a
  running session — best verified during playtest).

## [1.0.0.37] - 2026-04-19 — 3-tier prompt cache split

Follow-up to Pillar 6 (v1.0.35). The original 2-tier split cached ~3.3K
tokens. With the prompt reorganized so all static content is contiguous
before the first cache break, the universal-static tier is now ~7K
tokens — most of the prompt.

### Prompt reorganization
- All static marker schemas (MECHANICAL MARKERS through BACKSTORY IS
  FUEL) and CHARACTER-DEFINING MOMENTS have been moved up into the
  core rules block, BEFORE the first cache break.
- NPC NAMING's dynamic "NAMES ALREADY USED" interpolation extracted
  and moved to Tier 3 (it varies per session). A reference note in
  Tier 1 tells the DM that list exists later in the prompt.
- PLAYER NAME SPELLING now lives in Tier 2 (per-character block).
- SELF-CHECK rubric stays at the very bottom (Tier 3, uncached) —
  ~200 tokens is cheap to re-send, and recency positioning helps.

### Tier layout
- **Tier 1** (universal, cacheable): Cardinal Rules, Craft Principles,
  Conversation Handling, 15 few-shot examples, MECHANICAL MARKERS,
  COMPANION RECRUITMENT, PLAYER OBSERVATION, BASE THREATS, NPC NAMING
  (static), STORY MEMORY, BACKSTORY IS FUEL, CHARACTER-DEFINING
  MOMENTS. ~7K tokens. Never changes across sessions or characters.
- **Tier 2** (per-character, cacheable): worldSettingSection,
  character sheet(s), progression, PLAYER NAME SPELLING. ~200-2000
  tokens depending on campaign depth.
- **Tier 3** (dynamic, uncached): NAMES ALREADY USED (if any),
  CAMPAIGN STRUCTURE, pacing, all dynamic formatters (customConcepts,
  customNpcs, companions, campaign plan, world state, chronicle,
  weather, survival, crafting, mythic, party base, notoriety, projects,
  repetition ledger), SELF-CHECK. Varies per session and per turn.

### Cache control wiring
- `claude.js` now handles TWO markers:
  - `<!-- CACHE_BREAK:AFTER_CORE -->` → end of Tier 1
  - `<!-- CACHE_BREAK:AFTER_CHARACTER -->` → end of Tier 2
- Full 3-tier split emits a 3-block system array with `cache_control`
  on blocks 0 and 1.
- Graceful degradation: if Tier 2 is below Anthropic's 1024-token
  cache minimum (common for starter characters), Tier 2 and Tier 3
  merge into a single uncached block, preserving Tier 1's cache.
- Back-compat fully preserved: prompts with no markers or only the
  AFTER_CORE marker still work (2-block or plain string).

### Expected performance
- First turn in a session: ~7K cached write, ~200-2K uncached
  (character block isn't cached yet either since the cache key is
  the character block content itself).
- Subsequent turns in the same session: ~7K cache read + ~200-2K
  cache read (character, once warm) + ~500-3K fresh.
- Cache-hit rate climbs from ~50% (v1.0.35) to **~80-90%** on long
  sessions with rich campaign context.

### Tests
- All existing suites pass (character-memory 56, moral-diversity 59,
  nickname-resolver 49, combat-tracker 26, condition-tracking 56).
- Cache-split smoke test validates all four paths: 3-block form
  (both markers, all tiers big), 2-block form (only core marker),
  merged-tail form (both markers but Tier 2 too small), and plain
  string (no markers, back-compat).

## [1.0.0.36] - 2026-04-19 — Parallel context assembly + batched NPC lookups

Two invisible-infrastructure wins from the Pillar 6 follow-up list.
No change to player-visible behavior — just faster session start and
fewer DB round-trips per prompt build.

### Parallel context assembly (session-start latency)
- `/start-session` previously did 15+ sequential `await`s gathering
  weather, survival, crafting, mythic, party base, notoriety,
  projects, chronicles, progression, nickname resolutions, etc.
  Total ~150-300ms on cold caches.
- Refactored into three phases:
  - **Phase A** — worldState-filling reads (NPC conversations, NPC
    event effects, active quests) + away companions. All parallel.
  - **Phase B** — mood + absence mutations (parallel — different tables).
  - **Phase C** — all remaining independent reads (weather, crafting,
    mythic, party base, notoriety, projects, chronicle summaries,
    primary + secondary progression, nickname resolutions). Parallel.
- Dedupes a double weather fetch (previously fetched twice — once for
  weatherContext, once for survivalContext).
- Silent-per-fetch error handling preserved — one failure doesn't
  cancel the rest.
- Expected session-start latency cut roughly in half.

### Batched NPC relationship lookups
- `resolveForNpcBatch` previously looped `resolveForNpc` sequentially:
  4 queries × N NPCs = 4N queries, each round-trip.
- Now batches to **4 queries total regardless of N**:
  - 1 character fetch
  - 1 character-nicknames fetch
  - 1 batched `npc_relationships WHERE character_id=? AND npc_id IN (...)`
  - 1 batched `npcs WHERE id IN (...)`
- Resolution logic extracted to a pure-in-memory helper
  (`resolveForNpcInMemory`) so single-NPC and batch paths share one
  rule implementation.
- New test case (`nickname-resolver.test.js` Test 9): batch output
  matches single-NPC output for every id. 49 assertions total (up
  from 27).

### Tests
- Full suites still green: character-memory 56, moral-diversity 59,
  nickname-resolver 49, combat-tracker 26, condition-tracking 56.
- Server boots cleanly.

## [1.0.0.35] - 2026-04-19 — Pillar 6: Anthropic prompt caching + cache telemetry

Final pillar from the prompt redesign arc (invisible infrastructure —
no change to player-visible behavior, just latency and cost savings).

### What changed
- DM system prompt now embeds a `<!-- CACHE_BREAK:AFTER_CORE -->`
  marker immediately after the END OF CORE RULES header.
- `claude.chat()` detects the marker and converts the string system
  prompt into Anthropic's multi-block format:
  ```
  system: [
    { type: "text", text: "<core rules>", cache_control: { type: "ephemeral" } },
    { type: "text", text: "<dynamic context>" }
  ]
  ```
- Anthropic's prompt cache kicks in. Cache reads cost ~10% of a fresh
  input token; cache creation costs ~25% more than fresh. Net effect
  after the first turn in a session: ~50% reduction in input-token
  cost and noticeably lower latency on the cached prefix.
- Back-compat: `chat()` still accepts a plain string system prompt
  with no marker and sends it as-is. Short prompts (below Anthropic's
  1024-token cache minimum) also fall back to string form.

### Telemetry
- `[cache]` log line printed for every cached call, e.g.:
  ```
  [cache] session 42: created 0 / read 3311 / fresh-input 842 / output 1203 (67% cache-hit rate)
  ```
  Shows cache creation (bytes written to cache), cache read (bytes
  served from cache), fresh input (uncached portion of this turn),
  and output tokens.
- Aggregated stats available via `getCumulativeCacheStats()` — can be
  wired to an admin summary log or periodic report.

### Current tier split
- Tier 1 (cached): Cardinal Rules, Craft Principles, Conversation
  Handling, few-shot examples. ~3.3K tokens.
- Tier 2 (not cached): world setting, character sheet, progression,
  campaign context, mechanical markers, self-check. ~4.2K tokens.

### Future work (filed)
- 3-tier split (adds per-character cache for world + char sheet +
  progression) requires reordering the prompt so all static content
  is contiguous before dynamic content. Estimated ~+20% cache rate
  over current.
- Parallel context assembly at session start — independent fetches
  (weather, crafting, mythic, party base, notoriety, projects,
  chronicles, progression) are all sequential today. `Promise.all`
  would cut session-start latency in half. Filed for the next
  invisible-infra pass.
- Retry/backoff on Anthropic 529s: already implemented in
  `claude.chat()` (discovered during the Pillar 6 work — no action
  needed).

### Tests
- All existing test suites still pass (character-memory 56,
  moral-diversity 59, nickname-resolver 27, combat-tracker 26,
  condition-tracking 56).
- Added mock-fetch smoke test that validates the cache split in all
  three paths (long-prompt with marker → array; short-prompt below
  cache minimum → string; no marker → string). Available in the
  Pillar 6 commit history.

## [1.0.0.34] - 2026-04-18 — Pillar 5: session-level repetition ledger

Stretch pillar from the v1.0.33 prompt redesign. Solves the playtest
failure where the AI reused distinctive imagery like "skinny as a
pulled thread" across multiple descriptions because it had no memory
of what it already wrote.

### Extraction
- `repetitionLedgerService.extractSimiles()` detects three patterns
  in narration text (dialogue and italicized NPC voice excluded):
  - "X as Y" similes ("skinny as a pulled thread")
  - "like a X" similes ("like a coin at the bottom of a well")
  - "the X of Y" imagery ("the color of old pewter")
- Common structural nouns ("the edge of", "the rest of", "the end of")
  are filtered out. Functional language produces zero matches.
- Regex-only — no AI call, no latency cost.

### Storage
- Ledger persists on `dm_sessions.session_config.repetition_ledger`
  as `{ similes: string[], updated_at: ISO }`. No migration required —
  `session_config` is an existing JSON TEXT column.
- Cap: 30 most recent entries, FIFO.

### Capture
- `captureFromResponse(sessionId, responseText)` called after every
  AI response in the DM-session message handler, right before the
  JSON reply is sent. Fire-and-forget, silent-fail — a failed capture
  never blocks the player.

### Injection
- Before each Claude/Ollama continue-session call, the current
  ledger is rendered by `formatRepetitionLedger()` and appended to
  the system prompt (messages[0]). On subsequent turns, the stale
  ledger block is stripped and replaced with the fresh one, so the
  AI always sees the latest "do not reuse" list.
- Rendered block explicitly notes:
  *"This rule is STRICT for imagery and simile. Functional language —
  'the door opens', 'he nods' — is fine to reuse."*
- Compression flow (`shouldCompress` / `compressMessageHistory`) uses
  the augmented messages so the ledger survives compression.

### Complements prior pillars
- Pillar 1 (Craft Principles) already includes "VARY IMAGERY" as a
  rule. Pillar 5 enforces it with concrete memory.
- Pillar 3 (Self-Check Rubric) has a check item: "Did I reuse
  distinctive imagery from earlier this session?" The ledger gives
  the model the data to answer that honestly.

### Deferred (next release)
- Pillar 6 — layered prompt architecture with Anthropic prompt
  caching. The repetition ledger's dynamic injection pattern is a
  good precursor to the caching split (core static vs. per-turn
  dynamic).

## [1.0.0.33] - 2026-04-18 — DM prompt redesign: rules, craft, conversation modes, voice palette

Full architectural rewrite of the main DM system prompt, informed by a
deep audit of the existing ~16K-token prompt (100+ prohibitions, 80+
directives, zero few-shot examples, scattered duplication). Targets
speech quality, conversation flow, age-appropriate NPC dialogue, and
rule discipline.

### Pillar 1 — Rules redesign
- Consolidated ~100 prohibitions into **5 Cardinal Rules**, each with
  paired WRONG/RIGHT examples:
  1. **Player sovereignty** — no dialogue, thoughts, decisions, or dice
     rolls for the player. Explicit "never write 'you roll a 19'" rule.
  2. **Hard stops** — terminal moments (NPC question, roll request).
  3. **Scene integrity** — only established NPCs.
  4. **Stay in the world** — no meta-commentary, pure narrative.
  5. **Markers = mechanics** — exact schema, required positions.
- Each Cardinal Rule includes a defensive framing note:
  *"examples illustrative — the rule applies universally."*
- **12 Craft Principles** consolidated into a single block: match energy,
  answer first / elaborate second, one beat per NPC per turn, show don't
  tell, concrete over vague, vary imagery, silence is fine, moral
  diversity, knowledge boundaries, timeline fidelity, consequences
  stick, backstory is fuel.
- Killed contradictions: "short vs. vivid" resolved as "short for
  mechanics, vivid for atmosphere"; foreshadowing resolved as
  "plant clues you'll pay off; avoid hints you won't."

### Pillar 2 — Conversation Handling (new)
- Four-mode conversation taxonomy: **SPOTLIGHT** (one NPC holds the
  floor), **COUNCIL** (multiple NPCs in sequence, each to their
  domain), **CROSSTALK** (short interlocking cuts), **WAIT** (silence
  as a valid beat).
- Decision ladder the AI walks before each response (time pressure →
  Crosstalk; narrow question → Spotlight; multi-domain → Council;
  brief player input → Wait).
- Length scales by mode — no more padding to fill space. SPOTLIGHT
  30-120 words, COUNCIL 120-250, CROSSTALK 60-150, WAIT 1-30.
- Power dynamics inside modes — senior NPCs can interrupt juniors,
  subordinates wait for superiors.
- Solves the playtest failures where an NPC would answer + ask 3
  questions + take a physical action in one response.

### Pillar 3 — Few-shot examples (15 embedded in prompt)
- WRONG/RIGHT pairs for: player-sovereignty violation (dialogue + rolls
  + decisions), hard-stop violations (continuing past question, past
  roll request), all four conversation modes with Corvin/fortress-
  meeting/tactical-recon examples, age & register calibration
  (9-year-old street kid vs. elderly priest vs. dockworker),
  show-don't-tell (concrete vs. vague).
- Each example block has defensive framing so the model doesn't
  treat examples as the only valid cases.

### Pillar 4 — Voice palette (Opus-generated NPC speech hints)
- Migration 040 adds `voice_palette` (JSON), `voice_palette_generated_at`,
  and `interaction_count` columns to `npcs`.
- `npcVoiceService.js` generates a structured palette per NPC via one
  Opus call:
  - `age_descriptor` — "child (9)", "elder (60s)", etc.
  - `register` — "street slang, clipped" vs. "formal, measured"
  - `speech_patterns` — 2-4 tics ("trails off mid-thought")
  - `mannerisms` — 2-3 physical tells
  - `vocabulary` — "limited (kid-appropriate)" vs. "scholarly"
  - `forbid` — things this NPC would never say
- **Auto-triggers**: important NPCs (companions, quest-givers, faction
  leaders, campaign-plan NPCs) get a palette immediately at NPC
  creation. Minor NPCs generate lazily after 3 player interactions
  (threshold tracked via `npcs.interaction_count`, bumped by
  `recordInteraction`).
- `formatCustomNpcs()` in `dmPromptBuilder` renders the palette as
  4 extra lines per NPC block: Voice / Speech / Mannerisms /
  Vocabulary / Never says. Fire-and-forget generation — silent-fail
  never blocks gameplay.
- Solves the Corvin playtest failure (9-year-old speaking like a
  30-year-old narrator).

### Size impact
- Prompt assembly shrank from ~16K tokens → ~7.5K tokens
  **while adding the examples, voice-palette hooks, and conversation
  mode taxonomy**. Rule consolidation netted more savings than
  examples added.

### Tests
- All prompt-related tests updated to match the new architecture:
  `character-memory.test.js` (56 passing), `moral-diversity.test.js`
  (59 passing), plus `combat-tracker`, `loot-systems`,
  `condition-tracking`, `nickname-resolver` all green.

### Deferred (separate releases)
- **Pillar 5** — session-level repetition ledger (track recently-used
  distinctive imagery, inject as "avoid reusing" list).
- **Pillar 6** — layered prompt architecture with Anthropic prompt
  caching (split core vs. character vs. session tiers).
- Portrait headshot cropping, prelude opt-out / more questions —
  still deferred from earlier feedback.

## [1.0.0.32] - 2026-04-18 — Prelude + deity picker + prompt discipline fixes

Batch of playtest fixes. Portrait headshot cropping (3), prelude
opt-out / more questions (7), and the bigger NPC-speech-quality /
duplicate-phrase prompt engineering pass (12, 13) are deferred to
their own releases — each is sized for a focused pass.

### Deity picker
- **Atheist and Agnostic no longer double up.** They were appearing
  in both the "Belief" optgroup AND under "Other" because deities
  without a `pantheon` field were falling into `groups['Other']`. Now
  excluded from the grouped map entirely.
- **Relevance sort now considers class, subclass, theme, and
  alignment — not just race.** New "Recommended for your character"
  optgroup surfaces up to 6 deities with strong matches. Scoring:
  - Cleric with Divine Domain subclass picked → deity domain must
    include the subclass name (e.g. Life → Chauntea / Lathander).
  - Paladin → lawful/good alignment, War/Light/Life/Protection/Valor
    domain affinity.
  - Druid, Ranger → Nature / Tempest domain affinity.
  - Warlock → Trickery / Death / Grave domains.
  - Bard → Knowledge / Trickery / Light.
  - Racial pantheon match (existing).
  - Theme match (Acolyte, Hermit, Charlatan/Criminal, Soldier,
    Knight of the Order).
  - Alignment first-letter resonance (soft signal).

### Prelude setup
- **Character line now reads cleanly**: "Level 1 Scourge Aasimar
  Cleric — Mercenary Veteran" (was "Level 1 Aasimar Cleric —
  mercenary_veteran"). Subrace prepended, theme title-cased.
- **Intro blurb uses gendered pronouns** derived from
  `character.gender` rather than a blanket "they/them". Non-binary /
  other / unset still fall back to they/them.
- **Multiple tones can be picked.** Tones blend rather than compete
  (a "gritty" story can also be "hopeful"), so the single-select
  button strip became a multi-toggle. Backend receives the joined
  string (`"heroic + gritty"`) on the legacy `tone` field plus a
  raw `tones` array for future use. One tone is always required.
- **Start date no longer hardcoded to 1 Hammer, 1492 DR.** The year
  now derives from `character.game_year - yearsBack` where
  `yearsBack` matches the player's chosen `timeSpan`:
    - Childhood to Young Adult → 18-22 years back
    - Coming of Age → 10-14
    - Last Few Years → 3-7
    - Single Pivotal Event → 5-15
  Day-of-year is randomized (1..365), so preludes don't all start
  on New Year's.

### DM prompt discipline
- **"Never roll for the player" rule explicitly added** to the
  ABSOLUTE RULES (primacy block) AND to the prelude's FINAL
  REMINDER. Covers: never write "you roll", "you rolled", "the
  number you rolled", "a 19", or any outcome of a player-side d20.
  AI must emit the skill-check marker then STOP.
- **"Never narrate the result before the system returns it"** —
  explicit rule that the marker is the LAST sentence in the
  response.

### Bug fixes
- **SQL error when rolling initiative** — `SELECT name,
  companion_ability_scores FROM companions WHERE character_id = ?
  AND is_active = 1` was wrong on three counts. `companions` has no
  `name` column (name lives on npcs via npc_id), no `character_id`
  (it's `recruited_by_character_id`), and no `is_active` (active
  state is `status = 'active'`). Query rewritten with a proper
  JOIN and correct column names.
- **`[SKILL_CHECK: ...]` marker leaking into visible narrative**
  during preludes. The marker-stripping list in `dmSession.js` had
  entries for LOOT_DROP, COMBAT_START, CONDITION_ADD, etc. but was
  missing SKILL_CHECK. Added.

## [1.0.0.31] - 2026-04-18 — Fix silent Step 2 "Next" block when any ability score > 18

Follow-up to v1.0.29 "raise stat cap from 18 → 20." That change fixed
the input clamp but missed `allAbilitiesAssigned()` in the wizard,
which also hardcoded `score <= 18` as a validity check. Any character
with a rolled 19 or 20 passed the input but silently failed the
validator, leaving the Step 2 "Next" button disabled with no visible
explanation. Raised the cap in `allAbilitiesAssigned()` to 20 too.

## [1.0.0.30] - 2026-04-18 — Magic Initiate + Ritual Caster spell pickers (follow-up to 1.0.29)

1.0.29 shipped Magic Initiate and Ritual Caster sub-choices as
free-form text inputs because the valid spell list depends on which
class you pick. Free text meant nothing stopped a player from
entering a spell that didn't exist or wasn't available to the chosen
class.

### Fix
- New `spell_grid` sub-choice type with fields `spell_level`
  (`'cantrip'` or `'1st'`), `class_from` (id of the sibling choice
  holding the class), `ritual_only` (bool), and `count`.
- Renders a multi-select grid identical in style to the existing
  class-cantrip picker: checkbox-style toggles, selected-count
  readout, inline description + casting time + range + ritual tag.
- Filters spells by the chosen class from `spellsData.cantrips[class]`
  or `spellsData.spells['1st'].filter(s => s.classes.includes(class))`.
  Ritual Caster additionally filters to `s.ritual === true`.
- Shows helpful placeholder text when no class is picked yet:
  "Pick a class above first to see available spells."
- **Switching the class sub-choice clears any dependent spell_grid
  picks** — you can't keep "Faerie Fire" selected after switching
  from Bard to Wizard.
- Magic Initiate (`choices[1]` cantrips, `choices[2]` spell) and
  Ritual Caster (`choices[1]` rituals) migrated to use `spell_grid`.
- "Next" button validation updated to handle grid storage (always
  arrays, even for count=1).

## [1.0.0.29] - 2026-04-18 — Character creation playtest fixes (10 issues)

Batch of polish fixes from first playtest of v1.0.26's character
creation rework.

### Identity & review screen
- **Class capitalization in review** — was rendering "artificer"
  lowercase in the final summary. Fixed.

### Stats
- **Rolled stats of 19 and 20 now allowed.** The manual ability-score
  input and on-blur clamp were hard-capped at 18, silently downgrading
  a rolled 20 to 18. Raised to 20 (the normal 5e cap). Placeholder,
  helper text, and input `max` all updated.

### Ancestry feat sub-choices (follow-up to v1.0.26)
- **Racial languages now locked out.** When a feat's language choice
  offers "any_language", the dropdown now filters out every language
  granted by the character's race/subrace — Humans can no longer pick
  Common as one of Traveler's Tongue's two languages, Dwarves can't
  double up on Dwarvish, etc.
- **Multi-count picks deduplicate across slots.** Picking Dwarvish in
  slot 1 of a "pick 2 languages" choice hides Dwarvish from slot 2's
  dropdown (but keeps it visible in slot 1 so the current value
  doesn't vanish). Same logic applies to skills and any other
  count > 1 choice.

### PHB feats (Variant Human bonus feat picker)
- **5 feats now have proper sub-choice UI**: Linguist (pick 3
  languages), Skilled (pick 3 skills), Martial Adept (pick 2 Battle
  Master maneuvers from the 16-entry list), Magic Initiate (pick
  class + 2 cantrips + 1 spell), Ritual Caster (pick class + 2 ritual
  spells). Previously the feat's narrative description mentioned
  these picks but no UI surfaced them.
- **Unified schema**: the old PHB `choices: { class: [...] }` object
  was converted to the same array schema ancestry feats use —
  `choices: [{ id, type, count, label, options }]`. Elemental Adept,
  Magic Initiate, and Ritual Caster all migrated. The render code
  now shares the same helpers (`resolveAncestryChoiceOptions`), so
  racial-language lockout and dedup apply to PHB feats too.
- **Validation updated**: the "Next" button gate now requires all
  array-schema slots to be filled (with count > 1 slots each
  requiring `count` non-empty entries), not just one property per key.

### Background Feature display
- **Soldier's "Vehicles (land)" no longer orphaned under the wrong
  header.** The previous renderer dropped fixed tool proficiencies
  as bullets inside the "Choose Tool Proficiencies" section, which
  read like an option in the chooser. Now split into two sections:
  "Automatic Tool Proficiencies" (always-granted, bullet list) and
  "Choose Tool Proficiencies" (only the dropdown slots). Applies to
  any background with a mix — Guild Artisan, Outlander, etc.

### Spell & cantrip pickers
- **Descriptions now display inline** below each cantrip / 1st-level
  spell option, not just as a hover tooltip. Also surfaces
  castingTime, range, and duration in a compact line above the
  description.

### Pickers with descriptions
- **Alignment descriptions added** — each of the 9 alignments now
  shows its PHB-style 1-2 sentence description below the dropdown
  when selected.
- **Lifestyle descriptions added** — all 7 lifestyle options
  (Wretched → Aristocratic) show the PHB description explaining what
  that daily-spend level actually looks like. A one-line helper
  above the dropdown explains what Lifestyle is at all.
- **Deity picker grouped by pantheon and sorted for relevance.**
  Deities are now organized under `<optgroup>` headers by pantheon,
  with the character's racial pantheon listed first and labeled
  "(matches your race)". Atheist/Agnostic options separated into
  a "Belief" group at the top. Selected deity shows
  alignment + domain below the dropdown in addition to the
  existing description.

## [1.0.0.28] - 2026-04-18 — Genericize nickname UI placeholders

Cosmetic follow-up to v1.0.27. Placeholder text and example strings in
the UI previously referenced the example names ("Riv", "Rivelious",
"Jarrick") used when scoping the feature. These never became stored
data — they only appeared as grayed-out hints inside empty inputs —
but they implicitly assumed a specific character.

- `NicknameManagerPanel.jsx`: empty-state copy, nickname input
  placeholder, and notes input placeholder rewritten as
  character-agnostic hints.
- `CharacterCreationWizard.jsx`: pre-existing Step-1 nickname
  placeholder (`"Riv", "The Brave", "Shadowstep"`) replaced with a
  generic "A short form, title, or epithet your character goes by".
- Doc comments in `nicknameService.js` and `nickname.js` softened to
  describe the shape of output rather than specific example strings.
- Test fixtures in `tests/nickname-resolver.test.js` unchanged —
  they use `TEST_NICK_` prefixes, exist only during the test run,
  and are deleted on both entry and exit.

## [1.0.0.27] - 2026-04-18 — Multi-nickname system with audience rules (D)

Characters can now have multiple names (legal name, title, nicknames,
epithets) with per-audience rules controlling who is allowed to use
each one. The DM prompt tells every active NPC exactly which form to
use based on the rule the player set.

### Data layer
- Migration `039_character_nicknames.js` adds `character_nicknames`
  table: `(id, character_id, nickname, audience_type, audience_value,
  notes)` with `ON DELETE CASCADE` from `characters`. Audience types:
  `default`, `friends` (≥ 25), `allied` (≥ 50), `devoted` (≥ 75),
  `specific_npc`, `role`.
- Existing `characters.nickname` values are backfilled as `friends`-tier
  rules (matches the prior DM-prompt semantics). The legacy column
  stays in place for back-compat (session titles, exports, preludes).

### Service & API
- `server/services/nicknameService.js` — CRUD + `resolveForNpc(charId, npcId)`
  that returns all matching names ranked by priority (specific_npc 5 >
  devoted 4 > allied 3 / role 3 > friends 2 > default 0). Fallback to
  the character's legal name when no rows exist. `resolveForNpcBatch()`
  for the prompt builder.
- **Bard override** (rule of cool): any NPC whose `occupation` contains
  "bard" may use any nickname on the list, regardless of the audience
  rules. Flagged as `bard_override: true` in the resolver result and
  surfaced in the DM prompt.
- `server/routes/nickname.js` mounted at `/api/character` — GET / POST /
  PUT / DELETE for nickname rows plus GET `/:id/nicknames/resolve/:npcId`
  for UI previews.

### DM prompt integration
- `formatCustomNpcs()` in `dmPromptBuilder.js` now takes a
  `nicknameResolutions` map and emits a `Calls the PC: "..." (<rule>)`
  line inside each NPC's block. Bard-override rows get the rule-of-cool
  phrasing so the AI knows it's freely allowed.
- `dmSession.js` computes the resolution map once at session start
  (silent failure — a missing resolution just omits the naming line)
  and passes it through `sessionConfig.nicknameResolutions`.

### UI
- New `NicknameManagerPanel` (fuchsia accent, slide-in, 460px) on the
  Character Sheet. Accessible via a ✎ "Manage names & nicknames" button
  next to the character's legal name in the sheet header.
- Add / edit / delete flow with audience picker. Specific-NPC rule
  surfaces a dropdown of the character's known NPCs. Role rule is a
  free-form substring input ("apprentice", "retainer", etc.). Private
  notes field for player memos ("Jarrick started calling me this
  after the Tavern Brawl").

### Tests
- `tests/nickname-resolver.test.js` (27 assertions): stranger default,
  friends tier, allied precedence, devoted, specific-NPC beats tier,
  role match fires regardless of disposition, bard override returns all
  names, prompt formatter output, and fallback-to-legal-name for
  characters with zero rows.
- All existing suites (character-memory, moral-diversity, combat,
  dm-mode, condition-tracking) still pass.

## [1.0.0.26] - 2026-04-18 — Character creation polish: feat copy + theme descriptions + sub-choice selectors

Three-part refresh of the character creation flow, driven by playtest feedback.

### A. Ancestry feat copy — full sentences across all 195 feats
- Rewrote every ancestry feat's `description` in `server/data/ancestryFeats.js` as
  complete, second-person prose. Fragment lists like *"Two additional languages.
  Advantage on Charisma checks..."* become *"You learn two additional
  languages of your choice. You gain advantage on Charisma checks..."*.
- All feat-name, mechanics, flavor, list_id, tier, and choice_index fields
  preserved — only `description` text changed.
- `progressionSeedService.seedAncestryFeats` now UPSERTs descriptions on
  existing DBs so the rewrite propagates without a DB reset.

### B. Theme descriptions — PHB-style narrative blurbs
- Added a 2-3 sentence `description` field to all 21 themes in
  `server/data/themes.js` ("what life was like, what it means for the
  character" in the voice of PHB backgrounds).
- Migration `038_theme_description.js` adds `themes.description`,
  `ancestry_feats.choices`, and `character_ancestry_feats.choices_data`
  columns (all nullable, backward compatible).
- `GET /api/progression/themes` and `GET /api/progression/themes/:id` now
  return `description`.
- CharacterCreationWizard renders the theme description as italic helper
  text directly under the theme picker, above the L1 ability card.

### C. Character creation flow — reorder + feat sub-choice selectors
- **Step 1 order reshuffled** to match the way the DM 5e books actually
  present identity: Name / Identity → Race / Subrace → **Ancestry Feat** →
  **Theme** → **Background Feature** → Class / Subclass. Previously feat came
  after theme, and background feature sat below class features.
- **Feat sub-choices** (skill picks, language picks, damage-type picks,
  enemy-type picks, tool picks, ability-score picks, spell-list picks) are
  now declared on each feat via a `choices: [...]` schema and rendered as
  inline selectors under the feat card. 31 of the 195 feats carry choice
  schemas — Variant Human's *Relentless Drive* now lets you pick the skill
  proficiency and the extra language at creation, *Traveler's Tongue* lets
  you pick both languages, Dwarf's *Grudge-Sworn* lets you pick the
  traditional foe, etc.
- Resolved choices persist on `character_ancestry_feats.choices_data` as JSON.
  `POST /api/character` accepts an `ancestry_feat_choices` object in the
  request body; `progressionService.getCharacterProgression()` returns
  parsed choices + choices_data alongside each feat so character sheet,
  DM prompt, and AI dialogue can all reference the player's actual picks.
- New helper constants in the client: `ALL_SKILLS_5E`,
  `COMMON_ARTISAN_TOOLS`, `COMMON_TOOLS_EXTENDED`, `MARTIAL_WEAPONS`, plus
  `resolveAncestryChoiceOptions()` which maps sentinel strings like
  `any_skill` / `any_language` / `any_martial_weapon` to option lists.
  Open-ended choices (specific spells) fall back to a free-form text input.

## [1.0.0.25] - 2026-04-17 — Ollama: reasoning-token strip + new default model + Opus 4.7

### Claude
- **Opus bumped from 4-6 → 4-7** in `server/services/claude.js`. Opus 4.7
  shipped recently and is the stronger generation model; since the API
  pins major.minor (no rolling `claude-opus` alias), this bump has to
  be manual. Clarified the comment in `claude.js` + `CLAUDE.md` +
  `LLM_SETUP.md` so future bumps don't get missed. Sonnet stays at 4-6
  (still the latest Sonnet).


### Ollama integration
- **`<think>` / `<thinking>` / `<reasoning>` tokens stripped** from all
  Ollama responses before they reach the player or marker detection.
  Reasoning-family models (DeepSeek R1, QwQ, qwen3-thinking variants)
  emit chain-of-thought inside `<think>...</think>` before their final
  output; leaking that into DM narration both spoils pacing and breaks
  `[COMBAT_START]` / `[LOOT_DROP]` / other marker parsing which scans
  the full response body.
- Added `stripThinkingTokens()` in `server/services/llmClient.js`:
  strips matched pairs, orphan opening tags (response truncated
  mid-thought), and orphan closing tags. Runs at the top of the
  existing `cleanupResponse()` pipeline so every Ollama response is
  scrubbed in one place.
- **Default model bumped from `gemma3:12b` → `gpt-oss:20b`.** Better
  narration and instruction-following at a still-comfortable VRAM fit
  for 16GB cards. All hardcoded fallbacks (`dmSession.js`,
  `character.js`, `adventureGenerator.js`, `DMSession.jsx`,
  `.env.example`, `README.md`, `LLM_SETUP.md`) updated to match.
  Override with `OLLAMA_MODEL=<tag>` for any installed model.

## [1.0.0.24] - 2026-04-17 — Bug Sweep: 15 fixes across server + client

Comprehensive bug sweep following a deep audit of the shipped systems.
Ten reported issues + seven more uncovered during verification and
a second follow-up audit, all fixed together here.

### Server bug fixes
- **Downtime "base_upgrade" activity rewired to buildings** — the old
  `advanceUpgrade()` stub from F1a was throwing on every attempt. Now
  calls `advanceBuildingConstruction(buildingId, hours)`; accepts
  both `building:<id>` and legacy `upgrade:<id>` work_type shapes.
- **Merchant transaction input validation** — rejects negative /
  non-integer quantities, negative prices, malformed names with 400.
  Previously a malformed payload could corrupt character state with
  negative totals.
- **Merchant NPC lookup tightened** — was using a loose `LIKE %X%`
  that matched "Bob's Inn" when looking for "Bob". Now: exact match
  first, prefix fallback. Dropped the false `campaign_id = ?` filter
  (NPCs are campaign-global — they have no such column).
- **Merchant transaction atomicity** — character update + merchant
  update now run inside a single `db.transaction('write')`. If the
  merchant's optimistic-lock version check fails, the whole thing
  rolls back; the character's gold is NOT deducted.
- **Living-world tick step visibility** — new `results.step_statuses`
  array tracks each step (ok/skipped/failed with reason). Failed
  steps no longer silently vanish.
- **Dead code removed** — `getAvailableUpgrades`, `startUpgrade`,
  `advanceUpgrade` stubs from partyBaseService were unused after F1b.
- **Three stale `FROM npcs WHERE campaign_id = ?` queries** fixed in
  dmSession.js (PROMISE_MADE / PROMISE_FULFILLED / merchant price
  modifier). Now scan global NPCs by name only.
- **Narrative queue soft validation** — `addToQueue` now throws on
  missing event_type and warns on unknown types (via
  `KNOWN_EVENT_TYPES` set). Catches typos that would queue items the
  DM prompt never recognizes.
- **F3 base threat query** — was selecting non-existent `severity`
  and `region` columns from `world_events`. Now selects `scope` and
  `affected_locations` (which do exist). Also dropped the invalid
  `'escalating'` status filter.
- **Companion reunion narrative** — was INSERTing into
  `narrative_queue.content` column (doesn't exist); now uses the
  correct `title` + `description` + `context` + `event_type`.
- **Cross-user campaign data leak** —
  `campaignService.getCampaignById(id)` added optional userId
  parameter; route now passes `req.user?.id` so users can only read
  their own campaigns. `getAllCampaigns(null)` and
  `getActiveCampaigns(null)` now return `[]` instead of every
  campaign system-wide.
- **MERCHANT_COMMISSION idempotency** — an AI repeat of the same
  marker would have placed the same order twice and deducted the
  deposit twice. Now skips when an active order with the same item
  name already exists at the same merchant for this character.
- **`/adjust-date` now advances downstream systems** — manual date
  advances update `character.game_day` and fire
  `processLivingWorldTick(campaign_id, daysToAdd)` so weather,
  companion moods, merchant orders, base threats, etc. all catch up.
  Backward moves (flashbacks) are skipped.

### Client bug fixes
- **DMSession loot-drop refresh guarded** — was parsing error bodies
  on non-200 responses and clobbering character state; now wrapped
  in try/response.ok guard.
- **Merchant transaction response validation** — a 200 with malformed
  body no longer sets character gold to NaN. Throws if `newGold` or
  `newInventory` are missing from the response.

### Test fixes
- **"Message With Active Conditions"** test now accepts 200/503/500
  (the test is about the endpoint handling the payload, not AI
  availability — 500 is expected when credits are exhausted).
- **Narrative queue test isolation** — new `cleanQueue()` helper
  called between each test group prevents state pollution. Test 7
  now seeds its own item instead of relying on cumulative state.
- **companion-activities cleanup order** — FKs from
  `narrative_queue.related_companion_id` now cleared before
  companions are deleted.

### Test suite
- `tests/integration.test.js`: 502 passed, 0 failed (was 501/1)
- `tests/living-world.test.js`: 38 passed, 0 failed (was 37/1)
- `tests/narrative-queue.test.js`: 30 passed, 0 failed

### Known-but-deferred
- FK cascade gaps on several non-`campaigns` tables. SQLite
  ALTER-to-add-CASCADE requires table recreation; the cleanup
  ordering in tests works around it.
- Character/companion/session endpoints don't filter by user owner.
  Solo-play has no exposure; shared deployments would need a JOIN-
  through-campaigns pattern. Noted for a future multi-user release.
- NPCs are campaign-global (no campaign_id). Architectural choice.
- Scattered `JSON.parse()` calls that could crash on corrupted data
  — most are caught by enclosing try/catch but a full pass to
  `safeParse` would be cleaner.

## [1.0.0.23] - 2026-04-17 — F3: Raids + Sieges

The world can now attack your bases. When hostile factions or regional
threats (bandits, armies, undead, cults, mercenaries) are active, bases
in harm's way get raided. Players get warning days to return and defend,
or the threat auto-resolves at the deadline. Captured bases have a
14-day recapture window before they're permanently lost.

### Design
- **Contextual frequency**: threats spawn only from active, raid-capable
  world events (`bandit_activity`, `war`, `undead_uprising`,
  `mercenary_incursion`, `cult_activity`). Dire wolves and stateless
  monsters don't raid.
- **Player agency is default**: narrative queue warning → player chooses
  to defend or accept auto-resolution at deadline.
- **Captured bases**: 14-day recapture window; after that, permanent.

### Added
- **Migration 037** — `base_threats` table with status state machine
  (approaching → defending/resolving → resolved) and outcome enum
  (repelled/damaged/captured/abandoned).
- **`server/config/raidConfig.js`** — `RAID_CAPABLE_EVENTS` map,
  `SIEGE_FORCE_THRESHOLD=15`, vulnerability multipliers,
  `RECAPTURE_WINDOW_DAYS=14`, helpers `computeRaidProbability` and
  `rollInRange`.
- **`server/services/baseThreatService.js`**:
  - `generateThreatsForCampaign` — scans active world events, rolls
    against vulnerable bases, queues narrative-queue warnings
  - `computeAutoResolveOutcome` — attackerForce + d20 vs defense_rating
    + garrison/4 + d20; margin → outcome
  - `autoResolveThreat` / `autoResolveDueThreats` — applies building
    damage, treasury and garrison loss, narrative queue messages
  - `initiatePlayerDefense`, `recordPlayerDefenseOutcome` — player-led
    flow
  - `markDueThreatsForResolution`, `expireStaleCapturedBases`
- **Living-world tick step 3.95** — generation + due-check + auto-resolve
  + expire.
- **AI marker `[BASE_DEFENSE_RESULT: Threat=X Outcome=Y Narrative="..."]`**
  — detected in `dmSessionService`, processed in `dmSession` to record
  the outcome of a player-led defense sequence.
- **DM prompt** — new BASE THREATS section; `getBaseForPrompt` shows
  per-base "⚔️ UNDER THREAT" / "DEFENDING" / "COMBAT IN PROGRESS" lines.
- **Endpoints**:
  - `GET  /api/base/:id/threats`
  - `GET  /api/threats/campaign/:campaignId`
  - `POST /api/threats/:id/defend`
  - `POST /api/threats/:id/resolve-defense`
- **UI** — PartyBasePage Garrison tab now opens with a red-accented
  Active Threats banner (Return to Defend buttons, defending/combat
  status badges) and a compact recent-attacks history.

### Tests
- 9 new integration tests (Group 22, 19 assertions): empty listing,
  create + list, defend flow transitions, defend rejected when not
  approaching, resolve player defense, invalid outcome rejected, auto-
  resolve math on extreme matchups, captured sets 14-day recapture
  clock, expireStaleCapturedBases.
- Full suite: 501 passing.

### Deferred
- Recapture-quest auto-generation: players can still reclaim a captured
  base narratively or through a directly-initiated DM session, but
  structured automated quest generation is a polish pass.

## [1.0.0.22] - 2026-04-17 — F2: Defense Rating + Garrison + Companions as Officers

Bases now have meaningful defensive stats. Companions can be assigned
as named officers, leading the garrison and contributing to the base's
defense rating. Foundation for F3 (raid + siege world events).

### Added
- **Migration 036** — `defense_rating`, `garrison_strength`,
  `subtype_defense_bonus` on `party_bases`; new `base_officers` table
  with UNIQUE(base_id, companion_id).
- **Subtype defense bonuses**: watchtower +2, outpost +3, keep +5,
  fortress +8, castle +12 (martial); manor +2, wizard tower +3, temple
  +2, sanctuary +4; tavern +0.
- **Three new buildings**: palisade (+2 def), stone_walls (martial-only,
  +5 def), war_room (+1 to each officer's bonus).
- **Perk parser** (`parseDefenseGarrisonPerk`) recognizes pattern keys
  `defense_rating_plus_N`, `garrison_capacity_N`,
  `officer_bonus_plus_N`.
- **`recomputeDefenseAndGarrison`** — sums subtype + building perks +
  officer contributions (ceil(level/3) each + any officer_bonus).
  Auto-fires on building complete, building demolish, officer assign,
  officer unassign.
- **Endpoints**:
  - `GET /api/base/:id/garrison` — defense + garrison + officers
  - `POST /api/base/:id/officers` — assign a companion
  - `DELETE /api/base/:id/officers/:officerId`
- **DM prompt** — each active base shows a defensive-posture line:
  `Defense 11 · Garrison capacity 20 · Officers: Elara, Cedric`.
- **UI** — new Garrison tab in PartyBasePage with three stat cards
  (Defense Rating, Garrison Strength, Officers count), officer roster
  with per-officer defense contribution + Unassign, and companion
  picker to assign new officers.

### Fixed
- **Route ordering bug**: the existing `GET /base/:characterId/:campaignId`
  (primary-base fetch) was swallowing `GET /base/:baseId/garrison`
  because both match any 3-segment `/base/x/y` GET. Moved the 2-param
  GET to the bottom of the /base group. Would have broken any future
  `/base/:id/xxx` GET endpoint too.

### Tests
- 6 new integration tests (Group 21, 15 assertions): subtype defense
  applies at creation, gatehouse + barracks raise stats correctly,
  officer assign/unassign round-trip, dismissed companion rejected,
  duplicate assignment rejected, demolish removes defense.
- Full suite: 482 passing.

## [1.0.0.21] - 2026-04-17 — F1: Fortress-Capable Base System

Reworks the party base system so bases can be fortresses, watchtowers,
keeps, manors, wizard towers, temples, and more — with the old 6 base
types (tavern / guild_hall / wizard_tower / temple / thieves_den /
manor) demoted to BUILDINGS you install inside any compatible base.
Foundation for F2 (defense + garrison) and F3 (raids + sieges).

### Added
- **Migration 035** — drops/recreates `party_bases`, `base_upgrades`
  (replaced by `building_upgrades`); adds `base_buildings`. Schema
  supports:
  - `category` (`civilian`/`martial`/`arcane`/`sanctified`)
  - `subtype` (13 options spanning all categories)
  - `is_primary` with a partial unique index — only one primary base
    per character/campaign
  - `building_slots` derived from the subtype (watchtower=3,
    fortress=14, castle=20)
- **Config overhaul** (`partyBaseConfig.js`):
  - `BASE_CATEGORIES` (4 entries)
  - `BASE_SUBTYPES` (13 entries with slot caps, upkeep, starting
    renown, flavor)
  - `BUILDING_TYPES` (20 buildings, each with
    `allowedCategories`, slot cost, gold cost, hours required, perks
    granted on completion)
  - `getAvailableBuildingsForSubtype(subtype)` helper
- **Service refactor** (`partyBaseService.js` rewritten):
  - `getBase` (primary, back-compat) + `getBases` (all)
  - `createBase({ category, subtype, ... })` new signature
  - `setPrimaryBase(baseId)` — promote a satellite atomically
  - `addBuilding`, `listBuildings`, `getBuildingById`,
    `advanceBuildingConstruction`, `removeBuilding` — full building
    lifecycle with slot-cap enforcement and perk merge/unmerge
  - `calculateIncome` now derived from building perks
    (`passive_income_N` pattern) + level bonus
  - `getBaseForPrompt` renders all active bases with buildings
- **Endpoints** (`/api/*`):
  - `GET /api/bases/:characterId/:campaignId` (new) — all bases
  - `POST /api/base/:baseId/set-primary` (new)
  - `GET /api/base/:baseId/buildings/available` (new) — filtered
    catalog + slot usage
  - `POST /api/base/:baseId/buildings` (new) — install
  - `POST /api/base/:baseId/buildings/:buildingId/advance` (new)
  - `DELETE /api/base/:baseId/buildings/:buildingId` (new)
  - `POST /api/base` now takes `{ category, subtype, is_primary? }`
    instead of `{ base_type }`
- **PartyBasePage UI**:
  - Two-step establish form (Category grid → Subtype grid → Name +
    Description)
  - Upgrades tab replaced with Buildings tab: slot usage header,
    Under Construction section with +8/+16/+32 hour advance buttons,
    Built grid with per-building perks, Install New Building grid
    filtered by category with disabled state when treasury is short

### Known (intentional scope cuts; land in F1+)
- **Multi-base UI switcher** — the server supports multiple bases per
  character, but PartyBasePage still shows only the primary. A sidebar
  for navigating between bases lands in F2 alongside the garrison
  system. Use the API directly to create satellite bases for now.
- **Building upgrades** — `building_upgrades` table is in place but
  unused. The old base-level upgrade catalog (fortifications tiers,
  training yard tiers) will land in a polish pass.

### Tests
- 9 new integration tests (Group 20, 28 assertions): create with new
  signature, reject category/subtype mismatch, multi-base support,
  set-primary atomically demotes, install + complete + perk merge,
  category allowlist blocks disallowed buildings, slot cap enforced,
  /buildings/available filters correctly, demolish removes perk.
- Full suite: 467 passing (up from 439).

## [1.0.0.20] - 2026-04-17 — M4: Merchant Relationships

Completes the merchant-system rework by surfacing the merchant-memory
data the game has been quietly persisting since migration 011.
Transaction history, visit counts, and loyalty discounts finally have
a UI. Plus player-authored notes per merchant and a favorite pin so
your "usual armorer" is one click away.

### Added
- **Migration 034** — `character_merchant_relationships` table
  (character_id, merchant_id, notes, favorited, UNIQUE on the pair).
  Only persists data we can't derive; totals/counts are computed from
  `transaction_history`.
- **`merchantRelationshipService.js`**:
  - `getRelationshipsForCharacter` — joins merchant_inventories
    (filtered history), our new table, npc_relationships (for
    disposition), and the economy service (for the loyalty discount
    tier). Returns one entry per merchant interacted with, sorted
    favorites-first then most-recently-visited.
  - `upsertRelationship` — partial update of notes + favorited.
- **Endpoints**:
  - `GET /api/merchant/relationships/character/:id`
  - `PUT /api/merchant/relationships/:merchantId`
    `{ characterId, notes?, favorited? }`
- **`recordTransaction` extended** — now captures `total_spent_cp`,
  `total_earned_cp`, and an `at` ISO timestamp on each history entry,
  so the relationship panel can show lifetime gold flow per merchant.
  Legacy entries still work (0 totals, visit count still valid).
- **`MerchantRelationshipsPanel`** (gold-accented slide-in):
  - Favorites section pinned first, then all merchants
  - Per-card: disposition badge, loyalty discount pill, visit count,
    last-visit delta ("today" / "3 days ago"), lifetime spent/earned,
    click-to-edit notes textarea, ★ favorite toggle
  - New "Merchants" toolbar button in the DMSession header.

### Tests
- 5 new integration tests (Group 19, 12 assertions): empty state,
  appears after transaction, notes upsert preserves unspecified
  fields, favorites sort first, PUT requires characterId.
- Full suite: 439 passing (up from 427).

## [1.0.0.19] - 2026-04-17 — M3: Bargaining / Haggle

Any party member can roll Persuasion, Deception, or Intimidation
against a merchant to haggle a discount on the current cart.
Well-placed companion skills and theme bonuses genuinely matter —
send your Bard to the market, keep the Barbarian at the door.

### Added
- **`server/services/bargainingService.js`** — pure math:
  - `calculateHaggleDC`: base DC by disposition (hostile 20 → allied
    10), rarity mod (+0 to +8), prosperity mod (-2 to +2)
  - `resolveHaggle`: d20 + ability + proficiency + theme vs. DC
  - Discount tiers: margin 0-4 → 5%, 5-9 → 10%, 10-14 → 15%, 15+ → 20%
  - Nat 20 = auto-success at max tier; nat 1 = auto-fail with
    disposition hit
  - Theme bonuses (+2): Guild Artisan / Noble on Persuasion,
    Charlatan on Deception, Criminal / Mercenary Veteran on
    Intimidation
- **`POST /api/merchant/:id/haggle`** — rolls for the character or
  any active companion. Body: `{ characterId, rollerType, companionId?,
  skill, itemRarity?, attemptNumber?, rollValue? }`. Returns the full
  result including `discountPercent` and `dispositionChange`.
- **Transaction integration** — `/dm-session/:id/merchant-transaction`
  accepts optional `haggleDiscountPercent` (clamped server-side to
  [0, 20]); applied to the total after the bulk discount.
- **In-shop UI** — new inline Haggle card in the merchant shop panel
  with roller dropdown (character + companions), skill dropdown, Roll
  button, and result display. Discount auto-applies to the cart's net
  cost and rides along to the transaction endpoint. Resets after each
  transaction.

### Tests
- 9 new integration tests (Group 18, 20 assertions): nat 20 max
  discount, low-roll failure, nat 1 crit-fail disposition hit,
  Intimidation failure penalty, repeat-attempt penalty, invalid skill
  rejected, companion as roller, discount applied in transaction,
  server-side clamp to 20%.
- Full suite: 427 passing (up from 407).

## [1.0.0.18] - 2026-04-17 — M2: Merchant Commissions / Custom Orders

Players can now commission custom items from merchants — the feature
you tried to build organically once and it didn't stick because the
mechanism wasn't there. Now it is.

Full lifecycle: player asks merchant to craft something → merchant
quotes price + lead time → player pays a deposit → world time advances
→ item becomes ready on the game-day deadline → player collects and
pays the balance.

### Added
- **Migration 033** — `merchant_orders` table with status state
  machine: pending → ready → collected (happy path); pending →
  cancelled (deposit forfeit); ready → expired (30 game days
  unclaimed).
- **Service layer** — `server/services/merchantOrderService.js`:
  - `placeCommission` — deducts deposit from party purse, credits
    merchant, inserts pending order
  - `collectOrder` — pays balance, adds item to party inventory
    (stack-merges on name)
  - `cancelOrder` — pending only; deposit forfeit
  - `processDueOrders` — flips pending → ready at deadline
  - `expireStaleReadyOrders` — 30-day hold before resell
- **REST endpoints** — `server/routes/merchant.js` (new file):
  - `POST /api/merchant/:id/commission`
  - `GET  /api/merchant/orders/character/:id`
  - `GET  /api/merchant/orders/:id`
  - `POST /api/merchant/orders/:id/collect`
  - `POST /api/merchant/orders/:id/cancel`
- **Living-world tick step 3.9** — runs `processDueOrders` and
  `expireStaleReadyOrders` every tick; queues narrative-queue
  entries so the DM can mention pickups / abandonments naturally
  next session.
- **AI marker** — `[MERCHANT_COMMISSION: Merchant=X Item=Y Price_GP=N
  Deposit_GP=M Lead_Time_Days=D Quality=Q Hook=...]`:
  - `detectMerchantCommission()` in `dmSessionService.js`
  - `dmSession.js` finds/creates the merchant, places the order,
    feeds a `[SYSTEM]` note back to the AI (confirming or reporting
    why the order was rejected)
- **DM prompt** — new CUSTOM ORDERS / COMMISSIONS section with
  guidance on when to use the marker, price ranges, lead times, and
  a worked example (masterwork dagger, 400gp, 150gp deposit, 7 days).
- **CommissionsPanel** — teal-accented slide-in panel with Active
  (pending + ready) and History (collected / cancelled / expired)
  sections. Collect + Cancel buttons per-order. New toolbar button
  alongside Inventory/Conditions.

### Tests
- 8 new integration tests (Group 17, 26 assertions): happy path,
  insufficient-deposit rejection, bad-input rejection (deposit >
  quoted, zero lead time), living-world tick flips pending to
  ready, collect pays balance + adds to inventory, collect blocked
  while pending, cancel + forfeit semantics, list orders for
  character.
- Full suite: 407 passing (up from 381).

## [1.0.0.17] - 2026-04-17 — M1 polish: Ultima-style inventory + equipped-by badges

Follow-on polish to M1 (v1.0.16). The in-session InventoryPanel
becomes a true party view, matching the Ultima-style sectioned display
we discussed.

### Changed
- **InventoryPanel** — replaces the tab-filtered inventory with a
  single all-at-once view grouped into five sections:
  Weapons / Armor / Consumables / Quest Items / Misc.
- Each section has a color-coded header, item count, and hides itself
  when empty.
- Quest-item detection stays narrow (explicit `quest: true` flag or
  narrow keyword list — "relic", "artifact", "prophecy", "key to",
  "letter from", etc.) so mundane items don't get mis-labeled.
- Consumable detection: potion, elixir, scroll, ration, antitoxin,
  oil, poison, acid, holy water, etc.
- Header relabeled "Party Inventory".

### Added
- **Equipped-by badges** on every inventory row where a copy of that
  item is equipped on a party member. Shows "Name · main/off/armor"
  pills (teal for the character, purple for companions). Multiple
  badges render if the same-named item is in multiple slots across
  the party.
- New `companions` prop on `InventoryPanel` wired through from
  `DMSession`.

## [1.0.0.16] - 2026-04-17 — M1: Party Inventory + Equip/Unequip

Retires Phase 8's item-transfer and Phase 9's companion-merchant
endpoints in favor of a single shared party bucket. Carried inventory
and gold now live on the recruiting character's columns; companions
keep their per-entity equipment slots and equip from the pool.

Foundational change for the merchant rework (M1-M4) and future fortress
storage (F1-F3).

### Added
- **Migration 032**: one-time merge of every active companion's
  inventory + gold into their recruiting character. Idempotent.
- **`POST /api/companion/:id/equip`** `{ slot, itemName }` — moves one
  item from the party pool to the companion's equipment slot. Any
  previously-equipped item returns to the pool.
- **`POST /api/companion/:id/unequip`** `{ slot }` — inverse.
- **`starting_inventory`** param on `POST /companion/create-party-member`
  merges into the recruiter's bucket at creation time.
- **CompanionSheet UI**: Equipment card with three slot rows + Unequip
  buttons + "equip from party pool" picker (slot dropdown + item
  dropdown + Equip button). Party pool fetched from the character.

### Changed
- `/companion/recruit` and `/create-party-member` now insert companions
  with empty carry columns by default.
- Removed the "Inventory & Equipment" carried-items list from
  CompanionSheet — items are party-wide, not companion-scoped.

### Removed / Retired (410 Gone)
- `POST /api/companion/:id/give-item` (Phase 8)
- `POST /api/companion/:id/take-item` (Phase 8)
- `POST /api/companion/:id/merchant-transaction` (Phase 9)

All three return 410 with an explanatory payload pointing at the
replacement. 244 lines of scaffolding removed.

### Tests
- 8 new integration tests in Group 14 (M1): retired-410s, equip from
  pool, swap returns previous, unequip, error paths (missing item,
  invalid slot, empty slot), recruit-zeroed-carry invariant.
- Phase 8's 7 tests and Phase 9's 5 tests deleted.
- Full suite: 381 passing.

## [1.0.0.15] - 2026-04-17 — Phase 10: Companion Multiclass

Companions can now have multiple classes (Wizard 3 / Cleric 2, etc.),
mirroring the character-side `class_levels` system from migration 001.
Closes the last major progression-parity gap between companions and
player characters.

### Added
- **Migration 031** — `companion_class_levels` TEXT column (JSON array
  of `{ class, level, subclass }`). Null-safe: pre-Phase-10 companions
  fall back to the legacy single-class columns via a new
  `parseCompanionClassLevels()` helper.
- **`targetClass` param** on `POST /api/companion/:id/level-up`:
  - Omitted → advances the primary class (back-compat)
  - Matches an existing class entry → advances that class
  - New class → adds a multiclass entry at level 1
- **Semantics** (mirror character-side):
  - `companion_level` = TOTAL level across all classes
  - `companion_class` / `companion_subclass` = primary (index 0)
  - ASI, subclass level, hit die, features all key off the TARGET
    class's level, not total (5e RAW)
  - Spell slots use `getMulticlassSpellSlots()` when class_levels has
    >1 entry; falls back to single-class `getSpellSlots()` otherwise
  - Theme tier + ancestry feat thresholds continue to key off TOTAL
    level (unchanged)
- **Recruit + create-party-member** endpoints seed class_levels with a
  single-entry array at recruitment time.
- **DM prompt** `formatCompanions` renders a multiclass line when
  class_levels has >1 entry: `Classes: Wizard 3 (Divination) / Cleric 2
  (Life) — total 5`. Single-class companions render unchanged.
- **`/level-up-info`** returns `classLevels` + `choices.canMulticlass`
  so the UI can render a class picker.
- **`/spell-slots`** returns `class_levels` + `pact_magic` (when
  warlock is one of the classes).
- **CompanionSheet UI**: blue-accented "Class to Advance" dropdown in
  the level-up modal groups existing classes with "Multiclass — add a
  new class at level 1" options for all 13 standard classes not
  already taken.

### Tests
- 6 new integration tests (24 assertions) in Group 16: recruit
  seeding, primary-class advance, multiclass addition, secondary-class
  advance, combined spell slots math, level-up-info shape.
- Full suite: 386 passing (up from 362).

## [1.0.0.14] - 2026-04-17 — Phase 9: Companion Merchant Transactions

Companions can now buy and sell from merchants using their own purse.
Spellcasters can buy components, fighters can sell salvage, etc. The
companion's own `gold_gp` / `gold_sp` / `gold_cp` columns (already on
the table since migration 001) are the wallet.

### Added
- **POST /api/companion/:id/merchant-transaction**
  `{ merchantId?, bought: [...], sold: [...] }`
  - Mirrors the character-side transaction endpoint in dmSession.js but
    uses companion's own inventory and gold columns.
  - Same bulk-discount math via `getBulkDiscount()`.
  - Same optimistic-locking merchant update via
    `updateMerchantAfterTransaction()`.
  - Skips NPC disposition ripple (companions aren't independent NPC
    relationship holders — route reputation through the recruiting
    character's transaction instead).
  - 400 on insufficient gold.
  - 400 on selling an item the companion doesn't hold (via the Phase 8
    `inventoryRemoveItem` helper).
  - 409 on merchant optimistic-lock conflict, with companion state
    rolled back to pre-transaction snapshot.

### Known (UI gap, deferred)
- The existing in-session MerchantShop panel in DMSession.jsx is
  character-only. Wiring a "shop as companion" toggle into that panel
  is a separate substantial UI change. Today the endpoint is callable
  via API or (future) AI-driven markers like `[COMPANION_SHOP]`. Will
  surface during playtest and can be addressed then.

### Tests
- 5 new integration tests (13 assertions) in Group 15 — buy, sell,
  insufficient gold, bulk discount threshold, sell-without-owning
  rejection.
- Full suite: 362 passing (up from 349).

## [1.0.0.13] - 2026-04-17 — Phase 8: Companion Item Transfer + Inventory Quick-View

Closes the last major daily-use gap in the companion system: handing a
potion to your companion and taking it back now takes two clicks,
without opening the full CompanionEditor. Also surfaces companion gold
and equipped gear on CompanionSheet so you don't have to hunt for it.

### Added
- **Two new endpoints** on `/api/companion/:id/`:
  - `POST give-item`  `{ characterId, itemName, quantity? }` — moves
    items from the character's inventory into the companion's
  - `POST take-item`  `{ characterId, itemName, quantity? }` — moves
    items in the opposite direction
  Both merge into an existing stack on the destination (case-insensitive
  name match), split partial stacks (quantity < total), and fully remove
  the source entry when quantity == total. Reject missing items,
  overdraws, and non-positive quantities with 400.
- **Shared helpers** `inventoryAddItem` / `inventoryRemoveItem` in
  `server/routes/companion.js` keep merge/split logic in one place.
- **CompanionSheet UI**: new green-accented "Inventory & Equipment"
  card. Displays:
  - Gold total (gp/sp/cp) in the header
  - Equipped gear as emoji chips (🗡 weapon, 🛡 shield, 🥼 armor)
  - Carried items with quantities
  - A "Hand back" button per inventory row that invokes take-item with
    quantity=1
  The card hides itself entirely when the companion has nothing
  (no gold, no items, no equipment).

### Tests
- 7 new integration tests in Group 14: both transfer directions, merge
  into existing stack, full-stack source removal, missing item
  rejection, overdraw rejection, non-positive quantity rejection.
- Full suite: 349 passing (up from 337).

## [1.0.0.12] - 2026-04-17 — Phase 7: Companion Combat Safety

Adds persistent condition tracking and full 5e death save mechanics for
companions. Previously the ConditionPanel kept conditions as React state
only (lost when the session ended), and there was no death save
infrastructure anywhere — a companion at 0 HP just sat there.

### Added
- **Migration 030** — three columns on `companions`:
  - `active_conditions` (JSON array of condition keys)
  - `death_save_successes`, `death_save_failures` (INTEGER 0..3)
- **Six new endpoints**:
  - `GET  /api/companion/:id/conditions`
  - `POST /api/companion/:id/conditions/add` — validates against known
    condition list; exhaustion levels are mutually exclusive
  - `POST /api/companion/:id/conditions/remove`
  - `GET  /api/companion/:id/death-saves`
  - `POST /api/companion/:id/death-save` — server rolls d20 if `roll`
    not provided; full 5e RAW (nat 20 revives at 1 HP, nat 1 = 2
    failures, 10+ = success, 3 successes stabilize, 3 failures die)
  - `POST /api/companion/:id/stabilize` — Medicine DC 10 equivalent
- **Rest hookups** — the existing `/rest/:id` endpoint now:
  - Long rest: clears all conditions except petrified, decrements
    exhaustion by 1 per level, and resets death-save tallies.
  - Short rest that brings the companion above 0 HP also resets
    death-save tallies.
- **DM prompt**: two new indented lines per companion in
  `formatCompanions`:
  - `Active conditions: Poisoned, Prone, Exhaustion 2`
  - `Death saves: 2 successes, 1 failure (at 0 HP — edge text)`
  Helpers `formatCompanionActiveConditionsLine` and
  `formatCompanionDeathSavesLine` exported from `dmPromptBuilder.js`.
- **CompanionSheet UI**:
  - Orange-accented Active Conditions card: chip display with tooltip
    descriptions and click-to-remove, plus dropdown + Add button.
  - Red-accented Death Saves card that only renders at 0 HP: three
    success circles + three failure circles, Roll Save button (server
    rolls), Stabilize button.

### Tests
- 13 new integration tests (Group 13) — initial empty state, add/remove,
  case-insensitive normalization, exhaustion mutual exclusion, unknown
  condition rejection, long-rest clearing + exhaustion decrement +
  petrified persistence, HP>0 rejection, success/failure/stabilize/die
  state transitions, nat 20 revive, nat 1 double-failure, stabilize
  endpoint, long-rest death-save reset.
- Full suite: 337 passing (up from 310).

## [1.0.0.11] - 2026-04-17 — Phase 6: Companion Rest + Spell Slots

Fixes the single biggest functional gap for companions: spellcasting
companions (wizards, clerics, druids, warlocks, bards, sorcerers,
paladins, rangers, artificers) can now actually cast leveled spells,
and every companion can take a long or short rest that restores HP.
Previously companions had no `spell_slots` column and the long rest
endpoint didn't exist for them.

### Added
- **Migration 029**: `companion_spell_slots`, `companion_spell_slots_used`,
  and `companion_hit_dice` columns on the `companions` table. All
  nullable. Max slots are computed on demand from class + level via the
  shared `getSpellSlots()` helper — only the used map is persisted.
- **New endpoints** mirroring the character-side contracts:
  - `GET /api/companion/:id/spell-slots` → `{ max, used, class, level }`
  - `POST /api/companion/:id/spell-slots/use` → consume one slot at
    given level; 400 if no slots available at that level
  - `POST /api/companion/:id/spell-slots/restore` → refund one used slot
  - `POST /api/companion/:id/rest` → `{ restType: 'long' | 'short' }`
    - long: restores full HP + clears all used slots
    - short: restores 50% of missing HP (min 1); warlocks also refresh
      pact slots (parity with character-side behavior)
- **DM prompt** now surfaces each spellcasting companion's current slot
  state as a `Spell slots: L1 2/4, L2 0/3` line under their block via
  the new `formatCompanionSpellSlotsLine()` helper in
  `dmPromptBuilder.js`. Max + used are pre-computed in `dmSession.js`
  so `dmPromptBuilder.js` stays import-free.
- **CompanionSheet UI**: purple-accented Spell Slots section with
  circle indicators and Use / +1 buttons per level, matching the
  CharacterSheet pattern. Two new action buttons — teal "Long Rest"
  and blue "Short Rest".

### Tests
- 8 new integration tests (30 assertions) in Group 12:
  spellcasting vs non-caster slot maps, use + restore round-trip,
  rejection paths (no such slot level, slots exhausted, npc_stats
  companion), long rest HP + slot restoration, short rest 50% heal
  math, warlock pact-slot recovery on short rest.
- Full suite: 310 passing (up from 280).

## [1.0.0.10] - 2026-04-17 — Phase 5.6: DM Prompt Parity + Critical Bug Fix

Two fixes surfaced during the Phase 5.5 audit: one long-standing bug that
was silently disabling companion backstory generation on recruit, and one
parity gap between companion and player-character progression in the DM
system prompt.

### Fixed
- **Critical typo in `narrativeIntegration.js:202`** — `onCompanionRecruited`
  was calling `companionBackstoryService.getBackstoryByCompanion`, which
  doesn't exist. The real function name is `getBackstoryByCompanionId`.
  Every companion recruit has been throwing `TypeError: ... is not a function`
  since before Phase 5.5 (caught by `.catch`, so non-fatal but silently
  disabling backstory generation). Fix restores backstory generation on
  recruit.

### Added
- **DM prompt parity with Phase 4**: companion theme abilities + ancestry
  feats are now rendered in the DM system prompt, matching the treatment
  player characters got via `formatProgression()`. Previously the DM saw
  a companion's class and stats but had no awareness of their Phase 5.5
  theme or tier abilities.
- **`getCompanionProgression(companionId)`** in
  `progressionCompanionService.js` — slim mirror of `getCharacterProgression()`
  returning theme + unlocks + ancestry feats. Single source of truth for
  pulling a companion's progression snapshot.
- **`formatCompanionProgressionLines(progression)`** in `dmPromptBuilder.js`
  — exported helper that renders the snapshot as indented lines (theme,
  unlocked abilities, ancestry feats). Plugged into each companion's block
  inside `formatCompanions()`.
- **dmSession.js** loads and attaches progression to each class-based
  companion at session start (with lazy backfill + silent failure, so a
  progression hiccup never blocks a session).

### Tests
- 13 new unit tests for `formatCompanionProgressionLines` in
  `tests/companion-skill-checks.test.js` — null/empty/missing-theme edge
  cases, full snapshot rendering, path_choice rendering, mechanics
  inclusion, orphaned-unlock handling.
- Integration suite still green at 280 passing.

### Known (out of scope)
- Fixing the typo unblocks the real backstory-generation flow, which
  surfaces two pre-existing latent bugs previously masked by the crash:
  a foreign-key constraint failure and an AI response parse failure.
  Both are still swallowed by the `.catch` in `onCompanionRecruited` and
  are left for a future pass.

## [1.0.0.9] - 2026-04-17 — Implementation Phase 5.5: Companion Progression

Extends the Themes + Ancestry Feats progression system to companions. At
recruit time a companion is auto-assigned a theme based on its class and
(when possible) an L1 ancestry feat based on the linked NPC's race. When
companions level up, theme tier abilities auto-unlock at L5/L11/L17 and
ancestry feats auto-pick at L3/L7/L13/L18 — one less prompt per companion
per session, keeping companion level-up fast.

### Added
- **Migration 028** — `companion_themes`, `companion_theme_unlocks`, and
  `companion_ancestry_feats` tables mirroring the character-side tables
  from 023/024.
- **`server/services/progressionCompanionService.js`** — single source of
  truth for companion progression:
  - `mapCompanionClassToTheme`: class → default theme (fighter→soldier,
    rogue→criminal, wizard→sage, etc.; unknown classes fall back to
    soldier).
  - `normalizeRaceToAncestryList`: NPC race text → ancestry `list_id`.
    Handles Drow, Half-Elf, Half-Orc, all three Aasimar paths, standard
    races, and Warforged. Returns `null` for unmapped races (Goblin,
    Bugbear, Firbolg, etc.) so ancestry-feat progression silently skips.
  - `autoAssignCompanionTheme`: idempotent upsert + L1 ability unlock.
  - `autoSeedCompanionAncestryFeatTier1`: L1 feat auto-pick.
  - `computeCompanionProgressionDecisions`: tier-threshold check for
    L5/L11/L17 theme unlock + L3/L7/L13/L18 ancestry feat auto-pick.
  - `ensureCompanionProgressionInitialized`: lazy backfill for pre-5.5
    companions.
- **POST /api/companion/recruit** and **POST /api/companion/create-party-member**
  auto-assign a theme + L1 feat after insert. Best-effort — failures are
  logged but never block recruitment.
- **POST /api/companion/:id/level-up** applies theme tier unlocks and
  auto-picks ancestry feats in the same request. Response's
  `levelUpSummary` now includes `themeTierUnlocked` and `ancestryFeatSelected`.
- **GET /api/companion/:id/level-up-info** returns a `progression` preview
  so the UI can show what will auto-apply.
- **GET /api/companion/:id/progression** — new read-only snapshot
  (theme + all tiers + unlocks + feats) mirroring the character-side
  endpoint.
- **CompanionLevelUpModal UI** — purple theme-tier card and teal
  ancestry-feat card. Both are informational; the pick has already been
  made by the server. The teal card explicitly labels "auto-picked
  (companions don't choose)" so the DM understands the difference from
  the player flow.

### Tests
- 6 new integration tests (Group 11 in `tests/integration.test.js`):
  - Auto-assign theme + L1 feat on recruit
  - Goblin (unmapped) recruit still gets theme but no feat
  - L4→L5 triggers theme tier unlock
  - L2→L3 auto-picks ancestry feat
  - GET /progression returns full snapshot
  - Pre-5.5 companion lazy-backfill on level-up
- Integration suite: 280 passed / 0 failed (up from 258).

## [1.0.0.8] - 2026-04-17 — Implementation Phase 5: Level-Up Wizard Progression

Extends the level-up wizard to support Theme tier unlocks (L5/L11/L17) and
Ancestry Feat selection (L3/L7/L13/L18) for player characters. The wizard now
surfaces these decisions at the right tier thresholds, validates inputs
server-side, and persists everything inside the same transaction as the
existing level-up writes.

### Added
- **Theme tier auto-unlock at L5/L11/L17**: When a character with a theme
  crosses one of these levels, the corresponding L5/L11/L17 theme ability
  is automatically granted. Surfaced in the wizard as a purple-accented
  notification card showing the new ability's name, description, and flavor
  text. No player choice — themes have exactly one ability per tier.
- **Ancestry Feat pick at L3/L7/L13/L18**: When crossing these levels, the
  wizard shows 3 feat options from the character's race list and requires
  one pick before allowing completion. Teal-accented selectable cards.
- **`computeProgressionDecisions(characterId, newTotalLevel)`** helper in
  `server/routes/character.js` — determines whether a tier threshold is
  crossed and returns the unlock/pick details. Skips silently if the
  character has no theme, no prior ancestry feat, or has already unlocked
  at that tier.
- **`GET /api/character/level-up-info/:id`** now returns a `progression`
  object with `theme_tier_unlock` and `ancestry_feat_tier`, each null when
  not applicable.
- **`POST /api/character/level-up/:id`** accepts optional `ancestryFeatId`.
  Validates that it's provided when a tier threshold is crossed (422 if
  missing, 400 if not one of the offered options). Response payload's
  `levelUpSummary` now includes `themeTierUnlocked` and `ancestryFeatSelected`
  for UI celebration.
- **Review step** in LevelUpPage shows both theme tier unlock and ancestry
  feat selection when applicable.

### Fixed
- **Subclass validation regression from 4.5**: The multiclass subclass
  validation was firing spuriously for single-class level-ups (e.g., a
  Fighter leveling L2→L3 has subclass=Champion in the DB but the request
  body doesn't re-send it). Now checks `existingSubclass` from
  `classLevels` before demanding a new pick. Multiclass case still
  returns 422 correctly when no existing subclass + no payload subclass.

### Deferred (Phase 5.5)
- **Companion theme/ancestry progression**: Companions don't currently have
  theme or ancestry feat assignments (character creation wizard only sets
  these for player characters), and their level-up path is separate. Adding
  this requires companion theme assignment at recruitment, companion-specific
  progression tracking, and AI personality-based auto-pick logic. Scoped as
  its own phase.

### Testing
- 5 new integration tests (Group 10):
  - `testLevelUpInfoSurfacesProgressionDecisions`: L2→L3 returns ancestry
    feat tier with 3 options, no theme unlock
  - `testLevelUpRequiresAncestryFeatId`: 422 when missing; character
    unchanged
  - `testLevelUpPersistsAncestryFeatAndThemeTier`: L4→L5 unlocks Soldier's
    "Field Discipline"
  - `testLevelUpWithAncestryFeatChoice`: feat pick persists via transaction,
    surfaces in `/progression` endpoint
  - `testLevelUpRejectsInvalidAncestryFeatId`: 400 for elf feat on dwarf
    character
- 258/258 integration tests pass (up from 232)
- 55/64/26/43 unit tests all green
- Client builds cleanly

## [1.0.0.7] - 2026-04-17 — Phase 4.5: Level-Up Flow Cleanup

Foundation pass on the level-up flow before Phase 5 layers Theme tier unlocks
and Ancestry Feat selection on top. Shipped as five small, focused commits.

### Added
- **Feat-instead-of-ASI at level-up**: When a character reaches an ASI level
  (4/6/8/10/12/14/16/19 depending on class), the wizard now offers a toggle:
  "Increase Ability Scores (+2 total)" or "Take a Feat". Feat mode shows a
  dropdown of all 42 feats with descriptions, benefits, and prerequisites.
  Feats with half-ASI ability bumps (Resilient, Actor, Observant, etc.)
  prompt for which ability gets +1. Selected feats are persisted to the
  character's `feats` JSON array with `acquiredAtLevel` for provenance.
- **Multiclass subclass validation**: `POST /api/character/level-up/:id`
  returns `422 Unprocessable Entity` when the player attempts to level
  into a class that requires a subclass at the target level (e.g.,
  multiclassing into Cleric/Sorcerer/Warlock at L1) without providing
  one. Error payload includes `targetClass` and `newClassLevel` for UI
  feedback. Character state is left untouched on failed validation.

### Changed
- **Transaction-wrapped writes**: The level-up endpoint issued up to 10
  separate `dbRun` calls for feats, cantrips, spells, Keeper data, and
  the main character update. A SQL error mid-flight could leave the
  character in a half-updated state. Now all writes happen inside a
  single `db.transaction('write')` — on any error, `tx.rollback()` is
  called before re-throwing.
- **Consolidated level-up UI**: Deleted `client/src/components/LevelUpModal.jsx`
  (768 lines of "coming soon" placeholders and divergent logic). The
  full-screen `LevelUpPage.jsx` is now the single level-up surface. Both
  the character sheet "Level Up" button and the character list button
  route through the same flow. CharacterManager lost ~50 lines of modal
  state management.
- **Clarified CON-retroactivity math**: The formula
  `(newConMod - conMod) × newTotalLevel` was previously flagged as a bug
  but is actually correct — this level's hpGain was computed with the
  old mod, and we need to add modDiff for this level plus modDiff ×
  (newTotalLevel - 1) retroactive, which equals modDiff × newTotalLevel.
  Expanded inline comment explaining the derivation.

### Deferred
- **DecisionStep abstraction**: Planned as part of 4.5 but deferred to
  Phase 5. Building abstractions speculatively risks getting them wrong;
  extracting from real Theme tier / Ancestry Feat usage in Phase 5 will
  produce a better fit.

### Testing
- 3 new integration tests (Group 10):
  - `testLevelUpRequiresSubclassForMulticlass`: verifies 422 + untouched
    character state, then successful retry with subclass
  - `testLevelUpFeatInsteadOfASI`: creates a Fighter, levels up with
    `feat=resilient` (+1 CON), verifies feat persisted, CON bumped 14→15
  - `testLevelUpFeatMissingFeatKey`: edge case — `asiChoice.type='feat'`
    with no feat key still succeeds, nothing appended
- 232/232 integration tests pass (up from 215)
- 55/55 character-memory, 64/64 moral-diversity, 26/26 combat-tracker,
  43/43 progression-prompt all green
- Client builds cleanly

### Files touched
- `server/routes/character.js` (validation + feat handling + transaction)
- `client/src/components/LevelUpPage.jsx` (feat UI)
- `client/src/components/LevelUpModal.jsx` (deleted)
- `client/src/components/CharacterManager.jsx` (modal removal, delegate up)
- `client/src/App.jsx` (`handleShowLevelUp` accepts optional character)
- `tests/integration.test.js` (3 new tests)

## [1.0.0.6] - 2026-04-17 — Implementation Phase 4: AI DM Prompt Integration

### Added
- **Progression-aware AI DM sessions.** The AI DM system prompt now includes a `CHARACTER PROGRESSION LAYER` section when the character has a theme selected:
  - Theme name, path choice (e.g., Outlander biome), identity, and signature skills
  - All unlocked theme tier abilities with descriptions and mechanics
  - Ancestry feats with tier + mechanics
  - Knight moral path state with path-specific DM guidance (True/Reformer/Martyr/Complicit/Fallen/Redemption — each gets a tailored narration directive)
  - Resonant Subclass × Theme synergy (if any) with name, description, mechanics
  - Mythic × Theme amplification (resonant combo) with tier bonuses filtered by character level, OR dissonant arc description + required threshold acts
  - Per-theme **narration hook** — short DM directives for how each theme should shape NPC responses, environmental description, and scene framing (all 21 themes have hooks)
- **`server/services/progressionService.js`**: Extracted `getCharacterProgression(characterId)` as reusable service. Used by both the Character Sheet endpoint (GET /api/character/:id/progression) and the DM session start flow.
- **`formatProgression()` + `NARRATION_HOOKS_BY_THEME`** exported from `server/services/dmPromptBuilder.js`.
- DM session start (`POST /api/dm-session/start`) now fetches progression for both the primary character and optional second character; snapshots are passed into sessionConfig as `progression` and `secondaryProgression` and rendered by `formatProgression()`.
- **`tests/progression-prompt.test.js`** (43 new tests) covers: empty/null handling, theme identity rendering, path_choice rendering (Outlander biome, Knight order), ancestry feat rendering, Knight moral path guidance for all 6 paths, subclass synergy rendering, level-gated Mythic tier bonus rendering (T1 at L5, T2 at L10, T3 at L15, T4 at L20), dissonant arc rendering, narration hook presence for all 21 themes, full prompt integration, and graceful absence when progression is not supplied.

### Changed
- `GET /api/character/:id/progression` now delegates to the extracted service (behavior unchanged; same response shape). The endpoint file shrunk from ~100 lines to 9 lines.

### Testing
- 215/215 integration tests pass (no regressions from refactor)
- 43/43 new progression-prompt tests pass
- 55/55 character-memory, 64/64 moral-diversity, 26/26 combat-tracker pass
- Client builds cleanly
- Full run of all 5 suites: 403 total passing

## [1.0.0.5] - 2026-04-17 — Implementation Phase 3: Character Sheet Display

### Added
- **"Progression" tab on the Character Sheet** (new tab between "Features & Traits" and "Spells"):
  - Theme identity block (name, path choice, identity text, signature skills, Knight moral path if applicable)
  - Full 4-tier theme progression with visual state indicators:
    - Unlocked abilities (purple, 100% opacity, "✓ Unlocked" badge)
    - Ready-to-unlock abilities (amber badge — level reached but ability not yet granted)
    - Future abilities (dimmed, "Level X" badge for preview)
  - Ancestry Feats section (teal) showing all selected feats with tier, list, description, and mechanics
  - Resonant Subclass × Theme synergy callout (indigo) when the character's subclass/theme pair matches a seeded synergy (e.g., Battle Master + Soldier = "Tactician's Eye")
  - Mythic × Theme amplification callout (amber for resonant, red for dissonant) when the character has a mythic path with a matching combo. Shows T1-T4 bonus scaling for resonant combos; arc description + threshold acts for dissonant arcs
- **QuickReferencePanel "Abilities" tab extended** with compact in-session displays:
  - Theme callout with all unlocked tier abilities (purple)
  - Ancestry Feats summary (teal)
  - Resonant Synergy indicator (indigo)
  - Fetches progression data silently; progression sections hidden if unavailable (no blocking failures)
- **`GET /api/character/:id/progression` enhanced** to return:
  - Character class/subclass/level for consumer UI context
  - Full theme metadata (identity, signature skills, tags)
  - `theme_all_tiers` — all 4 theme tier abilities for upcoming-tier preview
  - `subclass_theme_synergy` — resonant pair match from seed data, or null
  - `mythic_theme_amplification` — resonant or dissonant combo from seed data (with tier bonuses or arc description), or null (also works for Legend Path's "any" theme sentinel)

### Testing
- Added `testProgressionReturnsUpcomingTiersAndSynergy` (verifies enriched endpoint, theme_all_tiers, synergy detection for Battle Master + Soldier)
- Added `testProgressionNoSynergyForNonResonantPair` (verifies null synergy when subclass/theme pair isn't in seed data)
- All 215 integration tests passing (up from 197)
- All 55/64/26 unit tests passing
- Client builds cleanly

## [1.0.0.4] - 2026-04-17 — Implementation Phase 2: Character Creation Theme Selection

### Added
- **Progression API** (`server/routes/progression.js`): Read-only endpoints exposing the reference catalog for the character creation wizard, level-up wizard, and character sheet:
  - `GET /api/progression/themes` — All 21 themes with metadata and L1 abilities
  - `GET /api/progression/themes/:id` — Full theme with all tier abilities (L1/L5/L11/L17)
  - `GET /api/progression/ancestry-feats/:listId` — Feats for a race, optionally filtered by tier
  - `GET /api/progression/team-tactics` — All 20 team tactics
  - `GET /api/progression/subclass-theme-synergies` — All 50 resonant pairings
  - `GET /api/progression/mythic-amplifications` — All 17 path × theme combos
- **Character Progression GET endpoint**: `GET /api/character/:id/progression` — Returns a character's theme, tier unlocks, ancestry feats, and Knight moral path state.
- **Theme + Ancestry Feat selection in Character Creation Wizard**:
  - Background dropdown replaced with Theme picker (maps 1:1 to old Backgrounds — downstream Step 3 personality suggestions still work via the legacy `background` field auto-synced from theme)
  - Conditional creation-time path choice for Outlander (biome) and Knight of the Order (order type)
  - L1 Ancestry Feat picker renders after race (and subrace, if applicable) is chosen — shows 3 feat options with descriptions, pick one
  - Selected theme L1 ability shown as preview in the wizard
  - Review step (Step 5) displays selected Theme, path choice, and Ancestry Feat
- **Character creation persistence**: `POST /api/character` now accepts `theme_id`, `theme_path_choice`, `ancestry_feat_id`, and `ancestry_list_id`. On character creation:
  - Inserts into `character_themes` (theme + path choice)
  - Inserts L1 ability into `character_theme_unlocks`
  - Inserts into `character_ancestry_feats` (the chosen L1 feat)
  - Initializes `knight_moral_paths` row if theme is knight_of_the_order (default path: 'true')

### Testing
- **Group 10 in integration tests** (9 new tests): theme/feat catalog lookups, 404 handling, character creation with progression fields, Knight moral-path initialization, legacy character creation without progression fields (graceful no-op)
- All 201 integration tests passing
- All 55 character-memory, 64 moral-diversity, 26 combat-tracker tests passing
- Client builds cleanly

## [1.0.0.3] - 2026-04-17 — Implementation Phase 1: Foundation

### Fixed
- **Character memory test**: Removed stale assertion for a 3KB soft cap that no longer exists. The cap was removed long ago (per the design decision that character_memories grows unbounded on disk), but the test and doc comment still referenced it. Updated both to accurately describe unbounded behavior. All 55 character-memory tests now pass.

### Added (Database + Seed Data)
- **Migrations 023-027**: Complete schema for the progression system
  - `023_themes_schema.js`: themes, theme_abilities, character_themes, character_theme_unlocks, knight_moral_paths (6-path tracker for True/Reformer/Martyr/Complicit/Fallen/Redemption)
  - `024_ancestry_feats_schema.js`: ancestry_feats, character_ancestry_feats
  - `025_synergies_schema.js`: team_tactics, character_team_tactics, subclass_theme_synergies, mythic_theme_amplifications
  - `026_narrative_trackers_schema.js`: mythic_arcs, mentor_imprints, prelude_unlock_flags
  - `027_downtime_schema.js`: downtime_periods, downtime_activities, downtime_vignettes
- **Seed data**: All progression reference content loaded automatically on server startup
  - 22 themes (21 active + 1 "any" sentinel for path amplifications)
  - 84 theme abilities (L1/L5/L11/L17 × 21 themes)
  - 195 ancestry feats (13 lists × 5 tiers × 3 choices)
  - 20 team tactics (10 combat, 5 utility_skill, 5 defensive_survival)
  - 50 subclass × theme synergies across all 12 classes including Keeper custom class
  - 17 mythic × theme amplifications (10 resonant + 7 dissonant arcs)
- **progressionSeedService.js**: Idempotent seed runner wired into `initDatabase()`. Safe to run on every startup.

### Tested
- All 5 schema migrations verified applying cleanly against Turso
- All seed data verified loading correctly (counts match design docs)
- All 156 integration tests passing
- All 64 moral-diversity tests passing
- All 26 combat-tracker tests passing
- Client builds cleanly

## [1.0.0.2] - 2026-04-16 — Design Phase: Themes, Ancestry Feats, Party Synergies, Subclass Synergies

### Design Documents (not yet implemented in code)
- **THEME_DESIGNS.md**: Full design for 21 Themes (leveling backgrounds), each with L1/L5/L11/L17 progression and balance-passed abilities. Replaces static D&D backgrounds with a four-tier progression layer.
- **PARTY_SYNERGIES.md**: Three-tier synergy system — Gear & Positioning (10 universal), Theme (34 signature + generative tag-based), Team Tactics (20 Pathfinder-style trainable via downtime).
- **ANCESTRY_FEATS.md**: 180 ancestry feats across 12 lists (5 tiers × 3 choices each). Covers all 10 races plus Drow and Aasimar path variants. Balance-passed.
- **SUBCLASS_THEME_SYNERGIES.md**: ~40 resonant subclass × theme pairings with small thematic mechanical bonuses. Covers the most iconic combinations across all 12 classes (including custom Keeper class).
- **MYTHIC_THEME_AMPLIFICATIONS.md**: 11 resonant amplifications + 7 dissonant narrative arcs + 2 special Shadow Paths (Redemption, Corrupted Dawn). Amplifications scale across Mythic Tiers T1-T4. Dissonant arcs unlock unique abilities through in-character atonement or corruption acts tracked by the AI DM.
- **DOWNTIME_DESIGN.md**: Complete overhaul of the Downtime v2 system. Runs between sessions (not in-session) to solve AI DM time-drift. Parallel Limited structure (1 Main + 2 Background per character). 30+ activities across 10 categories including Team Tactics training, Mentor's Imprint deepening, Mythic atonement. Companions auto-manage with personality-driven requests.

### Changed
- **FUTURE_FEATURES.md**: Extensive design decisions locked in for Themes, Ancestry Feats, Party Synergies, Mythic interactions, Mentor's Imprint, and downtime overhaul.
- **races.json**: Removed Genasi, Firbolg, Tabaxi, and Goliath from character creator to narrow race scope.

### Design Decisions Locked In
- Themes replace Backgrounds entirely, with 21 distinct progressions (one per background)
- Ancestry Feats unlock at L1/3/7/13/18, staggered to avoid overlap with other progression systems
- Companions auto-pick ancestry feats and theme unlocks based on personality — no menus for AI characters
- Knight of the Order gets six branching paths (True/Reformer/Martyr/Complicit/Fallen/Redemption) with positive and negative consequences at every tier
- Fallen Aasimar makes a permanent "Path's Choice" at L13 (Redeemer or Embraced Shadow) that reshapes the L18 capstone
- Mentor's Imprint: once per character, after 5+ sessions with an AI-gated trusted companion, gain one L1-tier trait from their Theme

## [1.0.0.1] - 2026-04-05

### Added
- **Prelude Sessions**: Play through a character's origin story before their first adventure
  - Setup form with location, time span, ending location, themes, tone, and story beats
  - Dedicated Opus-powered prompt with 3-act structure (Foundation, Turning Point, Threshold)
  - Background and class-specific turning point guidance (unique hooks for all 14 classes + 12 backgrounds)
  - Tutorial integration — game mechanics introduced through narrative, not exposition
  - Pacing rules for 3-5 hours of rich, unhurried storytelling
  - NPC creation guidelines for 2-4 memorable origin characters
  - On completion: backstory enriched with prelude summary, canon facts extracted, prelude_completed flag set
  - "Play a Prelude?" option shown in AI DM session setup for new characters
- **Session Encountered field**: NPC codex now tracks and displays `first_seen_session` across Campaign Prep and in-session NPC Codex panel
- **CHANGELOG.md**: This file

### Changed
- NPC codex `updateNpc()` now accepts `first_seen_session` in allowed fields
- Campaign Prep NPC edit form includes "Session Encountered" input
- NPCCodexPanel shows "First Encountered: Session X" in detail view and edit form

## [1.0.0.0] - Pre-changelog

All features prior to this changelog entry, including:
- AI Dungeon Master (Player Mode) with Claude Opus/Sonnet
- DM Mode (user as DM, AI controls 4 characters)
- Campaign plan generation, NPC codex, plot threads, campaign prep
- Combat tracker, inventory panel, merchant system, crafting
- Weather, survival, mythic progression, piety system
- Party base system, notoriety, long-term projects
- Story chronicles, canon facts, session memory
- User authentication, Keeper custom class
- Reference panels, effect tracker, dice roller, DM coaching
