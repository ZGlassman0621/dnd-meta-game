# Changelog

All notable changes to the D&D Meta Game project will be documented in this file.

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

**Cost impact (Opus, 15-turn session, with caching working):**

| | Before | After |
|---|---|---|
| Cache hit rate | ~55% | ~95% |
| Per-session cost | ~$1.55 | ~$0.85 |
| Tier 1 evictions | every 5–6 turns | ~0 (1h TTL) |
| Tier 2 cache | inconsistent (state leak) | byte-stable across turns |

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
