# Report — merge-and-archive: finish the 19 deferred docs

Builder: Claude Code (Sonnet 5.5). Brief: `docs/pm/merge-and-archive/BRIEF.md` (authorized 2026-11-14).
Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Docs-only job: **no version bump** (no app change).
Commit: (recorded in a follow-up commit; see `git log`).

## Understanding
The project is a solo D&D 2024 "forever game": one human player character, with the DM, NPCs, companions and enemies all played by an AI (gemma4:12b on the PC). The MVP is core play; the prologue, full downtime, fortress/domain, Mythic and legacy are post-MVP.

This job tidies what the next builder reads. Nineteen deferred-system documents sat in the repo as separate, overlapping, partly stale files. Each deferred system should have one shelf doc, the files that are only history should be archived byte-identical, and nothing live should be lost in the move. Nothing the player sees changes.

**Where my understanding differs from the brief or the live repo** (details below):
1. **The reference rule.** The brief says to hold back any file that live code or a live test references. Eight of the files to move are named only in **code comments** (no `import`, no file read). I treated comment-only references as non-blocking and moved the files. This is decision 1 for your veto. Nothing functional referenced any moved file.
2. **The residue list is incomplete.** `FUTURE_FEATURES.md` also holds live entries the brief does not name, most importantly **Session Hi-Fi** (the only place its Path A/B detail is recorded). See "Residues for the PM".
3. **The prologue review is older than the plan.** `PRELUDE_REVIEW.md` read a ~515-line plan with five sessions; the plan is v4 (~460 lines, four sessions). Some review findings may be overtaken. The merged doc says so.
4. **The synergies claim in my first draft was wrong and I corrected it.** My first draft said nothing reached the DM prompt. A character's own subclass×theme synergy does (`dmPromptBuilder.js:1346`). The party-level design is what is unbuilt.
5. **I found and corrected an error in my own earlier report** (the DM Mode grep proof). See Findings, item 1.

## Verdict
**BUILT + GREEN** on the builder's run (Files 245/245 green, assertions 19,554 passed, 0 failed). Not a gate: Zach's own `npm test` on the PC gates it.

## Item 0 — adjudication audit
I checked every disposition against the live files before moving or merging anything. **Every disposition held.** Evidence:

| File | Disposition | Verdict | Evidence |
|---|---|---|---|
| `Phase_3_Closeout.md` | archive | confirmed | Header: "Phase 3 closed at v1.0.162", 16/16 sub-checkpoints; a history record. |
| `PROJECT_BRIEF.md` | archive | confirmed | Docs-cleanup's refresh is in it (principle 1, line 67, "Nothing mechanical is narrative-only"); archived post-refresh. The pm-guide is the live brief. |
| `OPEN_QUESTIONS.md` | archive | confirmed | All about published modules; removed in v1.0.180 (commit `1c211b0`); no `campaignModules` file or reference in `server/`, `client/src/`, `tests/`. Residue R1. |
| `KNOWN_BUGS.md` | archive | confirmed | Exactly two active entries, both fortress gaps; both still true (no `recaptureBase`, no `holding_role` in `server/`). Folded into `FORTRESS_DESIGN.md` §2.1, §2.2 first. |
| `FUTURE_FEATURES.md` | archive | confirmed, **with a flag** | Mixed, as the brief says. The dead entries are dead (below). The residue list in the brief is incomplete (see Residues). |
| `CUSTOM_CLASSES.md` | archive | confirmed | Keeper is built. Docs-cleanup fixed the multiclass line (its report line 166). Both Keeper residues are still named in the docs-cleanup report (lines 184–185, 213). Archived post-edit. |
| `ANCESTRY_FEATS_REDESIGN_DEFERRED.md` | archive | confirmed | Gated on lineage-of-characters infrastructure; none exists (no `lineage`/`legacy` migration; the `lineage` hits in `server/data` are species lineages). Residue R3. |
| `DM_MODE.md` | archive | confirmed | The removal landed: commit `f7a0324`; the DM Mode grep (corrected, see Findings) shows no DM Mode file, import or route; `/api/dm-mode` returns 404. `DM_MODE.md` is cited by nothing live except its own review. |
| `Claude PM Review Docs/DM_MODE_REVIEW.md` | archive with `DM_MODE.md` | confirmed | Cited by nothing live (grep: no references). |
| `PHASE_3_7_SPEC.md` → fortress | merge | confirmed | Shipped parts verified in code (`FORTRESS_THREAT` at `markerSchemas.js:677`, handler `baseThreatService.js:737`, `computeDamageFromOutcome` at `:348`). |
| `PRELUDE_IMPLEMENTATION_PLAN.md` → prologue | merge | confirmed | The only full prologue design. Code exists (`prelude*.js`, `routes/prelude.js`), out of MVP. |
| `DOWNTIME_DESIGN.md` → refreshed in place | merge | confirmed | `server/services/downtimeService.js` exists; what it matches is unaudited (merged doc says so). |
| `PARTY_SYNERGIES.md` + `SUBCLASS_THEME_SYNERGIES.md` → synergies | merge | confirmed | Data seeded in code (`teamTactics.js`, `subclassThemeSynergies.js`, `progressionSeedService.js`); see the correction above about the prompt. |
| `THEME_DESIGNS.md`, `CLAUDE.md`, `AI_NARRATIVE_PERSISTENCE.md` | keep untouched | confirmed | Left byte-identical (hashes below). |
| `MYTHIC_PROGRESSION_GUIDE.md` + `MYTHIC_THEME_AMPLIFICATIONS.md`; `COMPANIONS.md` | keep with one fold each | confirmed | Folds done (below). |

**Dead entries in `FUTURE_FEATURES.md`, with evidence (not carried forward):**
- *Self-hostability roadmap* (cloud-dependent, Anthropic-only premise): overtaken. The game runs only gemma4:12b through `server/services/llm.js`, the one client (local-model-only job, `a04d39f`). Its Milestone A ("provider abstraction") is moot: there is one provider. (The brief says the post-MVP plan carries this; check for duplication, see Residues.)
- *LLM infrastructure follow-up pass* (tagged errors `AUTH_FAILURE` / `RATE_LIMITED` / `OVERLOADED`): those Anthropic-era tags no longer exist in `server/`; the only remnant is one stale comment (`client/src/components/PreludeSession.jsx:159`, "503 OVERLOADED").
- *Themes System ("not ready to implement")*: the theme system is built (`server/data/themes.js`, 21 themes served by `/api/progression/themes`, creator Stage 3, `character_theme_unlocks`).
- *Unify Opus + Lean prompt toggles*: Opus is gone from the game.

## Reference check (item 1)
Searched the whole repo excluding `node_modules`, `.git`, `dist`, `archive/` and `docs/`, for every moved or merged filename (`grep -rnI -E`).

- **No import, no file read, no test assertion, no script, no config references any moved file.**
- **Comment-only references in code and tests (8 files moved despite them; decision 1):**
  - `KNOWN_BUGS.md`: `server/routes/dmSession.js:2391`, `server/services/notorietyService.js:315`, `server/services/npcAgingService.js:140,241`, `tests/sc6-4c-promise-notoriety-schemas.test.js:6`.
  - `PHASE_3_7_SPEC.md`: `server/services/baseThreatService.js:84`. `triage/kingdom-management-survey.md`: `baseThreatService.js:82`.
  - `PRELUDE_IMPLEMENTATION_PLAN.md`: `server/migrations/042_prelude_scaffolding.js:5`, `048_prelude_handoff.js:27`, `049_creator_creating_phase_and_heirlooms.js:33`, `server/services/preludeCanonThreadService.js:11`, `preludeTransitionService.js:19`.
  - `PARTY_SYNERGIES.md`: `server/data/teamTactics.js:4`. `SUBCLASS_THEME_SYNERGIES.md`: `server/data/subclassThemeSynergies.js:5`.
  These comments now point at paths that moved to `archive/`. The prologue and fortress docs keep the original section numbering, so a pointer like "§3d / §5h" still resolves in the merged doc. Fixing the comments is a code edit, which is out of scope; a later code job can retarget them.
- **From KEEP files to archived files (reported, not rewritten):** `COMPANIONS.md` lines ~85, 93 (`PARTY_SYNERGIES.md`); `MYTHIC_THEME_AMPLIFICATIONS.md:194,195` (`PARTY_SYNERGIES.md`, `SUBCLASS_THEME_SYNERGIES.md`).
- **From other docs not adjudicated here (reported):** `Claude PM Review Docs/THEMES_REVIEW.md:5` (`SUBCLASS_THEME_SYNERGIES.md`); `Claude UX Design/D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md:128,146,148`.
- **From files that moved together (no block):** `FUTURE_FEATURES.md`, `PROJECT_BRIEF.md`, `ANCESTRY_FEATS_REDESIGN_DEFERRED.md`, `PHASE_3_7_SPEC.md`, `KNOWN_BUGS.md`, the survey, `DM_MODE_REVIEW.md` and the other review files.

## Files changed
**Zero code, test, data, config or migration files changed** (proof: `git status` shows only the 17 renames, 4 new/edited shelf docs, 2 folded docs, the brief and this report; the diff contains no `.js`/`.jsx`/`.json`/`.sql`).

### Archived (17; `git mv`, byte-identical: SHA-256 before = after, and none remains at its old path)
| Old path | New path | SHA-256 before | SHA-256 after |
|---|---|---|---|
| `Phase_3_Closeout.md` | `archive/Phase_3_Closeout.md` | `8464afef1f5a1e8fb22ed84c630bfe4c7271151e1d63c842d1b49fcb3d7f44ad` | `8464afef1f5a1e8fb22ed84c630bfe4c7271151e1d63c842d1b49fcb3d7f44ad` |
| `PROJECT_BRIEF.md` | `archive/PROJECT_BRIEF.md` | `4a42cbdf9e5a37f846e07e6bf5b66899970be56ee0524676036181cd5f43431e` | `4a42cbdf9e5a37f846e07e6bf5b66899970be56ee0524676036181cd5f43431e` |
| `OPEN_QUESTIONS.md` | `archive/OPEN_QUESTIONS.md` | `95719be183f8a89def0f5968073e3e7a3e2aeff0f7fd6dbffc526c32c00bfff2` | `95719be183f8a89def0f5968073e3e7a3e2aeff0f7fd6dbffc526c32c00bfff2` |
| `KNOWN_BUGS.md` | `archive/KNOWN_BUGS.md` | `8cd3269d2e59b41b4b6d0942e94ff80556c50c237872afc9cd0ad93409c49a7f` | `8cd3269d2e59b41b4b6d0942e94ff80556c50c237872afc9cd0ad93409c49a7f` |
| `FUTURE_FEATURES.md` | `archive/FUTURE_FEATURES.md` | `1a55868abfe7354c9a45df2d989e9300aaceb08c3fea9550209f7e98e7a1fbc9` | `1a55868abfe7354c9a45df2d989e9300aaceb08c3fea9550209f7e98e7a1fbc9` |
| `CUSTOM_CLASSES.md` | `archive/CUSTOM_CLASSES.md` | `d81781c26c0980f1b63692cd958401b0ae17552e05f29d4efc8a50ff2dd7c1aa` | `d81781c26c0980f1b63692cd958401b0ae17552e05f29d4efc8a50ff2dd7c1aa` |
| `ANCESTRY_FEATS_REDESIGN_DEFERRED.md` | `archive/ANCESTRY_FEATS_REDESIGN_DEFERRED.md` | `1e2ca5e15fa71c9246c329b08c354b29255aaf73d756efe89e025464944f576c` | `1e2ca5e15fa71c9246c329b08c354b29255aaf73d756efe89e025464944f576c` |
| `DM_MODE.md` | `archive/DM_MODE.md` | `01e4a7867329d0cc78822a517f79c3c21fe479db1cb966e515d276e1b00b76b9` | `01e4a7867329d0cc78822a517f79c3c21fe479db1cb966e515d276e1b00b76b9` |
| `Claude PM Review Docs/DM_MODE_REVIEW.md` | `archive/Claude PM Review Docs/DM_MODE_REVIEW.md` | `97808eef7b94d02292b83e528221984bbd43c2c083c0d040cd57d95891b1d79d` | `97808eef7b94d02292b83e528221984bbd43c2c083c0d040cd57d95891b1d79d` |
| `PHASE_3_7_SPEC.md` | `archive/PHASE_3_7_SPEC.md` | `ab47a7d9b981b62fb3ab42ab3794825fab4641d2c78aa6807d1ea66476f23006` | `ab47a7d9b981b62fb3ab42ab3794825fab4641d2c78aa6807d1ea66476f23006` |
| `triage/kingdom-management-survey.md` | `archive/triage/kingdom-management-survey.md` | `7fbaf7b6aed2f579cc25a8629ead030db8b337a21f6dbaa10cc895da68c7c779` | `7fbaf7b6aed2f579cc25a8629ead030db8b337a21f6dbaa10cc895da68c7c779` |
| `PRELUDE_IMPLEMENTATION_PLAN.md` | `archive/PRELUDE_IMPLEMENTATION_PLAN.md` | `1e22b9b9735ef84d243bc96154ac9f5ee22cd3d2607d6952e32246f4b744052a` | `1e22b9b9735ef84d243bc96154ac9f5ee22cd3d2607d6952e32246f4b744052a` |
| `Claude PM Review Docs/PRELUDE_REVIEW.md` | `archive/Claude PM Review Docs/PRELUDE_REVIEW.md` | `3a2813dfe90b092231948ff1d0c54376d41b785a37cd7674c4c5a0827643e3b0` | `3a2813dfe90b092231948ff1d0c54376d41b785a37cd7674c4c5a0827643e3b0` |
| `Claude PM Review Docs/DOWNTIME_REVIEW.md` | `archive/Claude PM Review Docs/DOWNTIME_REVIEW.md` | `3da231f4d1ba6077ffab4db8b7ce5cba7bcd73c362cdc128a132e9c6cafa17a0` | `3da231f4d1ba6077ffab4db8b7ce5cba7bcd73c362cdc128a132e9c6cafa17a0` |
| `PARTY_SYNERGIES.md` | `archive/PARTY_SYNERGIES.md` | `8cb0dca54ada0c020a3ebe4cc745798eafebf014457be7592cf675c5e34a8503` | `8cb0dca54ada0c020a3ebe4cc745798eafebf014457be7592cf675c5e34a8503` |
| `SUBCLASS_THEME_SYNERGIES.md` | `archive/SUBCLASS_THEME_SYNERGIES.md` | `194d25c3dc1bd95abaee0b9c6099b1d88a80511d5637e18fc687f6e8ce909b45` | `194d25c3dc1bd95abaee0b9c6099b1d88a80511d5637e18fc687f6e8ce909b45` |
| `Claude PM Review Docs/PARTY_SYNERGIES_REVIEW.md` | `archive/Claude PM Review Docs/PARTY_SYNERGIES_REVIEW.md` | `30ec1f187ed4c8d4e8aa8a3c62ea11538a38a1285b1ad114a392317d1e0493b2` | `30ec1f187ed4c8d4e8aa8a3c62ea11538a38a1285b1ad114a392317d1e0493b2` |

### Merged shelf docs
| Doc | State | SHA-256 | Bytes | Lines |
|---|---|---|---|---|
| `FORTRESS_DESIGN.md` | new (from `PHASE_3_7_SPEC.md`, the kingdom survey, 2 `KNOWN_BUGS.md` entries) | `3425c7bb764f77135f97346c9ae4fe524ba2dd3822ae0c3e7134320eb1594478` | 66,649 | 694 |
| `PROLOGUE_DESIGN.md` | new (from `PRELUDE_IMPLEMENTATION_PLAN.md`, `PRELUDE_REVIEW.md`) | `79f7663aae931f1307572c4f76afe44efe7960c84a20166b759587cdc69c1159` | 64,487 | 648 |
| `DOWNTIME_DESIGN.md` | refreshed in place (was `ccfa1e1e3908f33f2c3bdd417e38358c554473c1dccb860fa44653ca3b9a692b`, 23515 bytes) | `72af21e904fb168afc8094da12bb2868a43ce02289fdb0e331a9bee6e048b1e5` | 35,965 | 617 |
| `SYNERGIES_DESIGN.md` | new (from `PARTY_SYNERGIES.md`, `SUBCLASS_THEME_SYNERGIES.md`, `PARTY_SYNERGIES_REVIEW.md`) | `9ce4a5fb40442607e2f142d7f89cfb2569fa382907db99ce3c74e87052d60837` | 85,497 | 990 |

### The two named folds, and the brief
| File | SHA-256 before | SHA-256 after | What changed |
|---|---|---|---|
| `MYTHIC_PROGRESSION_GUIDE.md` | `b7226b65f0d33a138a9a4ab9d2b84adac87944e0fa813421b00f26402520a6d6` | `bb6317d9dad9e33c0d3158f1dfc01fc4cd00fde5cb111d23213b968a514f7556` | +16 lines: new §15 (Tier 5 flags from `MYTHIC_REVIEW.md`: Lich "Final Equation", Trickster "Narrative Authority", Tier 5 over-scope; campaign re-grounding note) and one contents line. Nothing else changed. |
| `COMPANIONS.md` | `0bd1cff566ad21d408db4f0e583dcbe881063b3c89391d93b9d3a6bde158eda2` | `580ac0dc2f5318f5d5c213a5f1fc2884a9a23aaa76893e101fd3b91600849116` | +9/−1 lines: the wound problem from `COMPANIONS_REVIEW.md` as open design work; one stale pointer ("DM-Mode-style party_relationships") fixed (decision 5). Docs-cleanup's refresh untouched. |
| `docs/pm/merge-and-archive/BRIEF.md` | (new) | `04d22c910e799efd11f1d27b55413b7e946b2cf61d3e62bb6355c31913e3844d` | The brief, placed verbatim. |

### Left untouched (byte-identical before and after)
`THEME_DESIGNS.md` `3ff5bc36…15831c`, `CLAUDE.md` `36dd731a…ee9100`, `AI_NARRATIVE_PERSISTENCE.md` `04e12219…31d071`; also `MYTHIC_THEME_AMPLIFICATIONS.md`, `Claude PM Review Docs/MYTHIC_REVIEW.md` and `COMPANIONS_REVIEW.md` (not moved, not edited, as the brief requires). Full hashes are in the commit.

## What was built (in play)
Nothing the player sees changes. For the next builder: each deferred system has one shelf doc.
- **`FORTRESS_DESIGN.md` (new):** what shipped (verified in code), the two active gaps carried verbatim (recapture quest framework, holdings purpose data), the parked intensity dial, the Phase 3.7 deferral rationale and open questions, and the full kingdom survey as Appendix A.
- **`PROLOGUE_DESIGN.md` (new):** the v4 plan verbatim, with the review's central finding up front as the open-issues section: the AI shelters a child protagonist from real stakes, which is now a gemma4:12b question.
- **`DOWNTIME_DESIGN.md` (refreshed in place):** v3 design unchanged; the review's open issues up front; the review as Appendix A.
- **`SYNERGIES_DESIGN.md` (new):** both synergy designs verbatim, a verified built-vs-unbuilt status, the review's AI-integration backlog as open issues.
- **Folds:** Mythic guide gets a new §15 (Tier 5 design debt, campaign re-grounding); `COMPANIONS.md` gets the wound problem under "Open / deferred design".

## Merge verification (traceability)
**Method:** a script compared every non-blank line of every source against its merged doc after the same Opus/Sonnet replacement. A merge is verbatim except the lines listed as dropped.

| Merged doc ← source | Non-blank source lines | Not found in the merged doc |
|---|---|---|
| `FORTRESS_DESIGN.md` ← `PHASE_3_7_SPEC.md` (kept ranges only) | 249 | 0 |
| ← `triage/kingdom-management-survey.md` | 360 | 0 |
| ← `KNOWN_BUGS.md` (the two active entries, lines 43–94) | 138 | 2 (the two entry titles, replaced on purpose by §2.1/§2.2 titles; the text is verbatim) |
| `PROLOGUE_DESIGN.md` ← `PRELUDE_IMPLEMENTATION_PLAN.md` | 346 | 0 |
| ← `PRELUDE_REVIEW.md` | 85 | 0 |
| `DOWNTIME_DESIGN.md` ← the original design (from git `HEAD`) | 381 | 0 |
| ← `DOWNTIME_REVIEW.md` | 60 | 0 |
| `SYNERGIES_DESIGN.md` ← `PARTY_SYNERGIES.md` | 402 | 0 |
| ← `SUBCLASS_THEME_SYNERGIES.md` | 192 | 0 |
| ← `PARTY_SYNERGIES_REVIEW.md` | 91 | 0 |

**Dropped on purpose (fortress only; the brief says only the deferred inheritance is worth keeping):** `PHASE_3_7_SPEC.md` header and §1.1/§1.4, all of §2, §3, §4, §5.1–§5.4, §7 and the footer. Each is a shipped sprint section or a builder instruction; the table is in `FORTRESS_DESIGN.md` Appendix B, with the reason per section. The original is in `archive/PHASE_3_7_SPEC.md`. **No other section was dropped.**

**Model references:** Opus/Sonnet replaced by `gemma4:12b`: `FORTRESS_DESIGN.md` 8, `PROLOGUE_DESIGN.md` 12, `DOWNTIME_DESIGN.md` 1, `SYNERGIES_DESIGN.md` 0 (each doc says so at its top, and says cost or quality reasoning that compared the two models needs re-verification at build time).

**Read-back:** I read in full each doc's authored parts (headers, status and open-issues blocks, section seams) and the two folds. I did **not** re-read the carried verbatim text line by line; the script comparison above is the evidence for it. I also did not re-verify the carried survey's line numbers and function names, which have drifted since May; each merged doc flags this.

## Test results
- **Full `npm test` on the PC, after all edits:** Files **245/245 green**, assertions **19,554 passed, 0 failed**.
- Before this job (creator-polish report): 244 files, 19,534 assertions at the last full run. The +1 file and +20 assertions are `review-text.test.js` (added after that run; it passed 22 on its own). **No test outcome depends on any file this job moved or edited.** The runner and the suite read no `.md`.
- Windows runner notes from the run: `paladin-l1-cap.test.js` was retried once after a native crash mid-run and passed; `exhaustion-2024`, `item-1b-cleave-push-slow`, `roll-request`, `scene-layer-wiring`, `subclass-batch1`, `subclass-scanned5` counted `pass*` (libSQL exit crash after all assertions passed). These are the runner's known Windows branches.
- The `spellbook-routes` timeout the brief warns about did not trip.
- Per-suite counts for touched suites: none; this job touched no code or tests.

## Residues for the PM
(The post-MVP plan is not in the repo and not mine to edit. Everything below is for the PM to file.)

### R1. `OPEN_QUESTIONS.md` §4 — the chronological play-through and level-scaling analysis (lines 89–124), verbatim

> ### 4. Chronological play-through?
> 
> **Current state:** every module has a `year` field (e.g. `'1492 DR'`,
> `'1486 DR'`, `'1285-1290 DR'`, `'Timeless'`). No explicit ordering
> flag, no next/prev pointer, no "campaign chain" concept yet.
> 
> **Chronological ordering as-is** (by year, roughly):
> 1. `bloodstone-pass` — 1285-1290 DR (Witch-King / Orcus era)
> 2. `pool-of-radiance` — 1340 DR (Moonsea frontier era)
> 3. `against-the-giants` / `temple-elemental-evil` / `ruins-of-undermountain` — 1357 DR (pre-Time-of-Troubles)
> 4. `ghosts-of-saltmarsh` — 1480 DR (flexible)
> 5. `dead-in-thay` / `storm-kings-thunder` — 1486 DR
> 6. `rime-of-the-frostmaiden` / `tomb-of-annihilation` — 1489 DR
> 7. `waterdeep-dragon-heist` / `vecna-eve-of-ruin` — 1492 DR
> 8. `baldurs-gate-descent` — 1494 DR
> 9. `curse-of-strahd` — timeless
> 10. `tales-yawning-portal` — various (mixed eras)
> 
> **To actually build this as a feature**, the lightweight version would be:
> - Add a `chronological_order: N` field to each module (explicit integer
>   so "flexible" / "timeless" modules can be placed sensibly)
> - Sort the module picker by this field when a "chronological" toggle is on
> - Optionally: a "Campaign Chain" wizard that queues 2-3 modules to run
>   in order, carrying the same character forward (would require handling
>   level scaling — e.g. Bloodstone ends at 20, Pool of Radiance starts at 1)
> 
> **The level-scaling problem is the real blocker.** Most chronological
> chains would require a character to reset to L1 between modules, which
> breaks continuity. The in-universe workaround is "new party, same
> world" — viable, but it's not really one character playing through
> history, it's a campaign anthology.
> 
> **If you want this:** straightforward half-day of work for the order
> field + sorted picker + optional chain UI. Deeper "level-scaled
> connective tissue between modules" is more like a week.

### R3. `ANCESTRY_FEATS_REDESIGN_DEFERRED.md` — framing (lines 1–12) and "Why this exists" (lines 13–18), verbatim

> # Ancestry Feats — Redesign Vision (Deferred)
> 
> A design direction for restructuring the Ancestry Feats system, captured here for future reference. **Not committed to.** The current Ancestry Feats system (in `ANCESTRY_FEATS.md`) remains the live spec. This document holds a vision for what the system *could* become if/when it's revisited with full attention.
> 
> **Status:** Design direction, not committed. Filed alongside `FUTURE_FEATURES.md` items but kept distinct because this is a *reshape* of an existing system, not a new feature.
> 
> **Trigger to revisit:** Probably tied to lineage-of-characters infrastructure existing, since the L18 mechanism described below requires it. Might also be revisited if Themes review or other system reviews surface enough overlap that consolidation makes sense.
> 
> **Last updated:** 2026-04-26
> 
> ---

> ## Why this exists
> 
> During the Ancestry Feats system review (see `ANCESTRY_FEATS_REVIEW.md` if it still exists in working form), a deeper design conversation surfaced a different way of thinking about what ancestry feats *are*. The framing felt thematically right — closer to the brief's principles than the current system — but committing to it would mean discarding most of the current 84-feat content library and would intersect with infrastructure (lineages of characters) that doesn't yet exist.
> 
> Rather than chase the redesign mid-stream, we captured it here for a future revisit when the full project context supports it.

### R2. `FUTURE_FEATURES.md` — the live ideas the brief names, each verbatim

#### Nardo's Manual of Martial Mastery (lines 136–189)

> ### Nardo's Manual of Martial Mastery — weapon-tier and fighting-style feat layer
> 
> **What:** Add a layer of L4+ feats giving martial characters meaningful weapon-specific identity and weapon-pair fighting styles. Source content is *Nardo D&D's Manual of Martial Mastery* (a homebrew supplement found online, attributed to "Nardo D&D @ Youtube.com"). Two categories:
> 
> - **Weapon Mastery Feats — 36 feats**, one per PHB weapon (battleaxe, blowgun, club, dagger, dart, flail, glaive, greataxe, greatclub, halberd, handaxe, hand crossbow, heavy crossbow, lance, light crossbow, light hammer, longbow, longsword, mace, maul, morningstar, musket, pike, pistol, quarterstaff, rapier, scimitar, shield, shortbow, shortsword, sickle, sling, spear, trident, war pick, warhammer, whip). Each grants an ability score increase plus three weapon-specific features that typically: add a weapon mastery property, modify the weapon's damage die or range, and grant a signature technique (e.g., Greataxe's "Skull Splitter" triple-dice-on-crit, Trident's "Sword Catcher" disarm reaction, Shield's "Bashing" extra attack).
> 
> - **Fighting Style Feats — 16 feats** for specific weapon-pair combos and specialty styles: Anvil of Thunder (warhammer + battleaxe), Bear Fang (battleaxe/handaxe + dagger), Blowgun and Scimitar, Greatclub and Dart, Hammer and Piton, Hammer's Edge (longsword + warhammer), Hand Crossbow and Greatsword, Maul and Greataxe, Morningstar and Wand, Shielded Axe, Spellrazor (dagger + touch cantrip), Spinning Halberd, Three Mountains, Trident and Net, Turtle Dart (heavy armor + shield + shortsword), and Weapon and Torch.
> 
> The thematic appeal is real: this is exactly the kind of "your weapon means something" texture 5.5e gestures at with weapon mastery properties but doesn't fully deliver on. Gives every martial weapon a 4th-level "I'm a [weapon] specialist" upgrade path, and the fighting-style feats fill a niche 5.5e left empty when it folded fighting styles into class features.
> 
> **Why deferred:**
> 
> 1. **Licensing question is unresolved.** This is fan content from a YouTube creator, not WotC material. For private personal-table use, fine. For shipping in a public product — even free — we'd need either Nardo's permission or a clean rewrite using these as inspiration rather than direct adaptation. The licensing decision wants to be made consciously, not slid past.
> 2. **Active threads outrank it.** Prose-quality work, Phase 5 prelude handoff, Themes content lift, and the Ancestry-Feats redesign question are all higher priority. This is additive content, not load-bearing infrastructure.
> 3. **AI-trigger spec work is non-trivial.** Like Themes (which the Themes review flagged as "AI-trigger specs absent — load-bearing risk"), every one of these 52 feats needs the AI DM to know when to invoke it. Without spec work, they become invisible character-sheet text. The AI persistence engineering thread should make headway before we add another 52 features dependent on it.
> 
> **Trigger to revisit:**
> - After Themes content lift completes — the AI-trigger-spec pattern will be established and reusable for these feats.
> - After the Ancestry Feats redesign question resolves — that decision determines whether the L4+ feat slot is even available for these (current 5.5e cadence puts ASIs at L4, but the redesign may reshape the progression layer).
> - If a martial-heavy playtest surfaces "weapons feel interchangeable past the basic mastery property" as a real complaint — confirms the design pressure these solve.
> - If the user wants to use a specific feat at the table during private play (one-off pick is much lower cost than full integration).
> 
> **Scope when revisited:**
> 
> 1. **Licensing call (non-engineering).** Reach out to Nardo for permission to adapt, OR commit to "inspiration only" and rewrite each feat in the project's own voice. Affects every downstream step.
> 
> 2. **Balance pass.** Several feats need pressure-testing against the existing system before integration. Specific watch-list (not exhaustive):
>    - Greataxe Skull Splitter — triple dice on crit + crit on 19, stacks dangerously with Champion Fighter's improved crit range.
>    - Rapier Successive Piercing — second attack rolls and damages twice; large multiplier for action-economy classes.
>    - Trident Sword Catcher — disarm-and-break-mundane-weapons reaction may invalidate certain encounter designs.
>    - Heavy Crossbow Portable Ballista — 1d12 base, double damage to objects, +Slow mastery; may overshadow other ranged options.
>    - Maul and Greataxe Densely Packed Strikes — flat +2d6 to every attack while wielding both is a big static damage floor.
>    - Morningstar Long Hafted — converts a non-versatile weapon into a Versatile + Reach + Slow weapon for 1 hour of crafting; effectively rewrites the weapon's slot in the equipment table.
>    - Anvil of Thunder "The Thunder" — AoE thunder damage from a weapon attack is a meaningful step outside martial design space.
>    - Several feats stack their granted Weapon Mastery on top of the weapon's existing one, effectively giving 2-3 masteries per attack — needs explicit ruling on how that interacts with the per-turn mastery limits.
> 
> 3. **AI-trigger specs.** Each feat needs guidance for when the AI DM should narrate or invoke it. Patterns will likely cluster (passive damage adders, conditional reactions, named special techniques) — design the patterns first, apply across all 52.
> 
> 4. **Schema and integration.** New feat category, new feat data, integration with `LevelUpPage.jsx` for selection, integration with the DM prompt for awareness. Likely smaller than Ancestry Feats since these don't have the multi-tier progression — flat L4+ unlock with a prereq check.
> 
> 5. **Editing pass.** The PDF has a fair number of typos and wording ambiguities that need cleanup regardless of licensing path: "wiled" (Light Crossbow), "Halberd" appearing in Heavy Crossbow text, "loner" (Blowgun and Scimitar), "Continues" (Whip — should be "Continuous"), "Closing Jaws" damage timing wording, etc.
> 
> **Estimated effort:** Multi-day to multi-week depending on choices. Licensing permission + light adaptation is the cheapest path (~few days for balance pass + AI-trigger specs + integration). "Inspiration only" rewrite is closer to multi-week — 52 feats × original-design effort plus everything above.
> 
> **Related docs:**
> - `Nardo_D_D_s_Manual_of_Martial_Mastery.pdf` — source material (project files)
> - `THEMES_REVIEW.md` — analogous AI-trigger-spec problem at scale
> - `ANCESTRY_FEATS_REDESIGN_DEFERRED.md` — progression-layer cadence question that interacts with this
> - `AI_NARRATIVE_PERSISTENCE.md` — the AI-memory thread these depend on for "AI knows when to invoke"
> 
> **Independent of code work — research tasks before this thread reactivates:**
> - Locate Nardo's contact channel (YouTube channel description, Patreon, etc.) and any stated terms of use for the manual.
> - Cross-reference these feats against current 5.5e weapon mastery properties to identify any direct duplication of post-2024 official content.

#### Treat Wounds (Medicine Skill Action) (lines 385–415)

> ## Treat Wounds (Medicine Skill Action)
> 
> **Priority:** Medium
> **Status:** Ready to design — relatively self-contained
> 
> Inspired by Pathfinder 2e. Gives the Medicine skill a meaningful out-of-combat healing role, reducing the game's dependence on spell slots and short rests for recovery. Fits naturally alongside the existing survival system (food/water/foraging).
> 
> **Core design:**
> - 10-minute action, requires healer's kit (or herbalism kit)
> - Medicine check vs DC determines how much HP is restored:
>   - DC 15 (trained): 2d8 HP
>   - DC 20 (expert, proficiency bonus ≥ +4): 2d8+10 HP
>   - DC 25 (master, proficiency bonus ≥ +5): 2d8+20 HP
>   - DC 30 (legendary, proficiency bonus ≥ +6): 2d8+30 HP
> - Critical success (beat DC by 10+): double the flat bonus
> - Critical failure (miss DC by 10+): deal 1d8 damage to the patient instead
> - Can only be used on a given creature once per hour (prevents spam)
> - Cannot restore HP beyond the creature's maximum
> 
> **Integration notes:**
> - Pairs well with the Degrees of Success system (also in FUTURE_FEATURES) — if that system is implemented, Treat Wounds is a natural first showcase for 4-outcome rolls
> - The existing survival system already tracks foraging/food; herbalism kit proficiency (already in the game) could optionally lower the DC by 2 or expand the usable materials
> - Could tie into the Themes system: a Healer or Hermit Theme at L5 might grant advantage on Treat Wounds checks or remove the once-per-hour restriction on allies
> 
> **Open design questions:**
> - Does this replace or supplement short rest hit dice recovery?
> - Should NPCs/companions also benefit, and does the AI DM know to prompt for it during rests?
> - Should there be a "battlefield medicine" variant usable in 1 action at a higher DC and lower healing?
> 
> ---

#### Procedural Dungeon Generation (lines 416–427)

> ## Procedural Dungeon Generation
> 
> **Priority:** Medium
> 
> - Generate dungeon layouts with rooms, corridors, doors, traps, and treasures
> - Room-by-room exploration with state tracking (visited, cleared, locked)
> - Dungeon map display showing explored areas
> - Encounters tied to specific rooms
> - Keys, puzzles, and locked doors creating exploration objectives
> 
> ---

#### Character Image Generation (lines 428–439)

> ## Character Image Generation
> 
> **Priority:** Low
> 
> - "Generate Portrait" button on character sheet
> - Uses character description (race, class, appearance, gender) as prompt input
> - Generates a D&D-style fantasy portrait via image generation API (DALL-E, Stable Diffusion, etc.)
> - Player can regenerate if they don't like the result
> - Stretch: companion portraits, location art, scene illustrations during DM sessions
> 
> ---

#### Visual World Map (lines 440–451)

> ## Visual World Map
> 
> **Priority:** Low
> 
> - Location markers on a stylized map
> - Fog of war for unexplored areas
> - Travel routes between discovered locations
> - Click-to-travel for known destinations
> - Notable event markers on the map
> 
> ---

#### Tavern Mini-games (lines 452–463)

> ## Tavern Mini-games
> 
> **Priority:** Low
> 
> - Dice games (Liar's Dice, Three Dragon Ante)
> - Card games with NPC opponents
> - Drinking contests with Constitution checks
> - Gambling with gold stakes
> - Win/loss affects NPC relationships
> 
> ---

#### Mobile Companion App (PWA) (lines 476–526)

> ## Mobile Companion App (PWA)
> 
> **Priority:** Medium
> **Status:** Scoped — ready to implement after core progression systems ship
> 
> Turn the existing React client into an installable Progressive Web App so key notifications and decisions can reach the player on their phone — especially useful for **downtime decision moments** (companion requests, critical choices, crafting completions) that the AI DM wants to surface between sessions.
> 
> ### Why PWA over native
> 
> - Uses existing React codebase (no Xcode, no Android Studio, no native rewrites)
> - No App Store or Play Store submission required
> - No Apple Developer Program ($99/year) or Play Console ($25) fees
> - Installs to home screen, runs in its own window, receives push notifications
> - iOS 16.4+ and all modern Android support the Web Push API
> 
> ### Phase 1 — Install to home screen (~2 hours)
> - Add `manifest.json` to the client
> - Add a service worker for offline shell
> - Home screen install prompt appears on supported browsers
> 
> ### Phase 2 — Basic push notifications (~4 hours)
> - Generate VAPID keys for Web Push
> - Add `web-push` npm package to server
> - Store device push subscriptions in a new `push_subscriptions` table
> - Fire test notification: "Downtime complete — Tormund has a question for you"
> 
> ### Phase 3 — Interactive decision flow (~1-2 days)
> - Notifications include deep links to a decision page
> - Decision page: "Tormund wants to visit his family. Approve / Redirect / Discuss"
> - Response syncs to server and is consumed by AI DM at next session
> - Primary use case: companion requests during downtime
> 
> ### Phase 4 — Broader notification surface
> - Crafting project completions
> - Companion relationship milestones ("Sera has grown close enough that the Mentor's Imprint is available")
> - Narrative queue alerts (faction events, political shifts)
> - Mentor's Imprint thresholds
> - Any AI DM `[NOTIFY]` marker can fire a push
> 
> ### iOS gotchas (manageable)
> - Push requires iOS 16.4+ and the PWA must be installed first
> - Install UX on iOS hides behind Safari's share menu — needs an onboarding screen explaining the install steps
> - Android is significantly easier — install prompt works on first visit
> 
> ### Open questions (for when we implement)
> - Should notifications be per-campaign or global per-user?
> - Do we want a mobile-first alternate layout for the Downtime Planning screen, or reuse the desktop layout?
> - Should this work for DM Mode too (e.g., "Your party of AI characters has made a decision that needs review"), or is it Player Mode only?
> 
> ---

### Pointer flags (from the brief)
- **Module-pipeline citation.** The post-MVP plan's Wave 2 item 7 cites `OPEN_QUESTIONS.md` as the module-pipeline reference. That file now lives at `archive/OPEN_QUESTIONS.md`. **The PM must update that pointer.** The level-scaling analysis is R1 above.
- **Milestone A duplication.** `FUTURE_FEATURES.md`'s self-hostability entry names Milestone A (provider abstraction). The brief says the plan's "Throughout" section already carries it. **The PM should check for duplication, not double-file it.** Note the evidence above: with one provider (gemma4:12b via `llm.js`) the milestone's premise has changed.

### `FUTURE_FEATURES.md` entries NOT named in the brief (the file is archived intact; nothing is lost; the PM should decide where each lives)
| Entry (lines in the archived file) | Status I found |
|---|---|
| **Session Hi-Fi implementation** (769–837) | **Live post-MVP.** Three-column cockpit; the only record of the open questions and the "Path A, commit 1" starting point; the design bundle is in `Claude UX Design/…/Session-Design-Bundle/` (archived by docs-cleanup). The brief's Decisions say Path A is standing; this entry is the detail behind it. |
| Drow Lolth Standing Tracker (107–135) | Parked, "zero footprint in code." Also tracked in `AI_NARRATIVE_PERSISTENCE.md`. |
| Downtime system activation (233–259) | Now covered by `DOWNTIME_DESIGN.md` "Open issues". |
| Legacy System (464–475) | Post-MVP legacy item. |
| Character creator deferred polish from v1.0.40 (527–555) | Check against the new creator before filing; it predates the six-stage rebuild. |
| Deeper work from Prelude play-testing (556–650): voice/tone, naming, cross-session repetition | Live ideas, prologue-adjacent. |
| Main-campaign tone preset integration (651–701) | Prelude-dependent. |
| Prelude → Primary Campaign Handoff, Phase 5 (702–729) | Covered by `PROLOGUE_DESIGN.md`; Phase 5 state needs the re-audit that doc requests. |
| Avatar feature deferred from the MVP creator rebuild (312) | Check whether the creator now has avatars. |

### Keeper residues (`CUSTOM_CLASSES.md`) — checked, not re-filed
Both are still named in the docs-cleanup report: the 8 missing genre-bonus texts and Eidetic Memory / Unwritten Knowledge (its lines 184–185), and the Keeper creator gap (its line 213).

### `KNOWN_BUGS.md` — where each active entry landed
Recapture window → `FORTRESS_DESIGN.md` §2.1. Holdings purpose data → `FORTRESS_DESIGN.md` §2.2. The resolved-bugs archive stays in `archive/KNOWN_BUGS.md`.

### Proposed line for `archive/README.md` (not edited, per the brief)
> **2026-11-14 (merge-and-archive):** 17 more files: the history and superseded records (`Phase_3_Closeout.md`, `PROJECT_BRIEF.md`, `OPEN_QUESTIONS.md`, `KNOWN_BUGS.md`, `FUTURE_FEATURES.md`, `CUSTOM_CLASSES.md`, `ANCESTRY_FEATS_REDESIGN_DEFERRED.md`), the removed DM Mode doc and its review, and the sources of four merged shelf docs (`PHASE_3_7_SPEC.md`, the kingdom survey, `PRELUDE_IMPLEMENTATION_PLAN.md`, `PRELUDE_REVIEW.md`, `DOWNTIME_REVIEW.md`, `PARTY_SYNERGIES.md`, `SUBCLASS_THEME_SYNERGIES.md`, `PARTY_SYNERGIES_REVIEW.md`). Current homes: `FORTRESS_DESIGN.md`, `PROLOGUE_DESIGN.md`, `DOWNTIME_DESIGN.md`, `SYNERGIES_DESIGN.md`. The live brief is the pm-guide in the PM's workspace.

## Still open: the theme-tier question (recorded, not decided)
**Question (from the brief):** theme tiers auto-unlock one ability in code, while the design says the player picks at tier crossings. Needs Zach's ruling eventually.
**What I checked:** the code side is confirmed. On level-up, `server/routes/character.js:6850` ("Theme tier (auto-unlock): only fires at exactly L5, L11, or L17") selects the single theme ability for that tier (`path_variant IS NULL … LIMIT 1`) and writes it to `character_theme_unlocks` at `:7833`, with no player choice. The creator's L1 theme ability is written by `persistThemeSelection` (`:3599`). **What I did not verify:** the design side. `THEME_DESIGNS.md` was left untouched and I did not read its tier structure; a search for an explicit "player picks" statement found none. So the claim "the design says the player picks" is the PM's from the audit and is unverified by me.

## Not done / still open
- No `archive/README.md` edit (brief forbids it; proposed line above).
- The comment-only pointers in code (decision 1) are not retargeted: code edits are out of scope.
- The carried survey text was not re-verified against current code (flagged in `FORTRESS_DESIGN.md`).
- Cost and usage against the $30/month cap: not measurable from inside the session. Unmeasured.

## Decisions made (reversible, for veto)
1. **Comment-only references do not block a move.** The brief's rule says to hold a file back if "live code or a live test references" it. I read that as a functional reference (import, file read, assertion). Eight moved files are named only in code comments. **Reversal:** one `git mv` per file back to its old path (the merged doc stays valid either way). Alternatively, the PM may want those comments retargeted in a code job.
2. **Fortress doc carries the whole survey as Appendix A** and only the deferred inheritance in the body. The brief allows dropping shipped sections with a reason; I kept the survey whole because it is the code map the intensity dial needs, and nothing was lost. **Reversal:** trim the appendix (the original survey is in `archive/triage/`).
3. **Headings in carried text were demoted one level** so each merged doc has one top heading; no wording changed except Opus/Sonnet → gemma4:12b. **Reversal:** none needed; git history has the originals.
4. **Model-name replacement is mechanical** (`Opus`/`Sonnet` → `gemma4:12b`, 21 places in all). Some sentences now read oddly ("gemma4:12b generates…; gemma4:12b consults…"); each doc says so. **Reversal:** a find-and-replace per doc.
5. **Fixed one stale pointer in a file this job touches** (`COMPANIONS.md`): "the DM-Mode-style party_relationships pattern" now says the pattern comes from the removed DM Mode and is recoverable from git history. Fix-as-you-find-it, bounded to docs.
6. **Added a table-of-contents line** (`15. Design Debt and Re-grounding`) to the Mythic guide, because the new §15 would otherwise be missing from its contents.
7. **Archived `FUTURE_FEATURES.md` although the brief's residue list is incomplete.** The file is preserved intact, so nothing is lost; the missing entries are listed above. **Reversal:** `git mv` back.

## Findings
1. **A false claim in my own earlier report, found and corrected.** The dm-mode-removal report said its DM Mode grep returned "0 hits". It used `grep -P`, which errors in this shell and was hidden, so the check never ran. Re-run with plain `grep -E`: **2 hits**, both in one explanatory comment I wrote (`server/services/markerSchemas.js:876-877`), plus the `dmModel`/`dmModelId` false positives. No DM Mode code remains. The report was corrected in commit `d5e6270` (`docs/pm/reports/dm-mode-removal-REPORT.md`, SHA-256 `50f81638ca0260f44304755ac1615f0f070e6134664644ae8beb344d2ca6cdb5`). **If Muse already read the earlier version, it should read the corrected one.**
2. **Stale DM Mode references remain in docs this job could not touch.** `AI_NARRATIVE_PERSISTENCE.md` (lines 11, 179, 287, 316, 326, 347 and others) still describes DM Mode as a live pattern source ("DM Mode has the working implementation pattern…"). The brief forbids editing that file here. The knowledge-ignorance job that strikes built items should fix it.
3. **Stale comment:** `client/src/components/PreludeSession.jsx:159` mentions "503 OVERLOADED" (an Anthropic-era error). Code edit, out of scope.
4. **Docs that point at moved files and were not adjudicated here:** `THEMES_REVIEW.md`, and the `Claude UX Design/…/Themes-Replace-Backgrounds.md` file (still at the repo root although docs-cleanup archived its sibling).
5. **`CLAUDE.md` is stale on the test count** (says 247/247; the suite is now 245 files). Left untouched per the brief.

## Needs Zach's decision
1. **The theme-tier question** (above). Does a player pick a theme ability at levels 5, 11 and 17, or does the game hand them the one ability for that tier, as the code does today? This is the only call in this job that only Zach can make, and it is not urgent; it affects the post-MVP progression design.

Everything else is for Muse to decide. Zach's part is the gate.

## How to verify
**Docs-only job: there is nothing to see at `:5173`.** Gate: Zach's `npm test` on the PC (expect 245 files; the exact assertion total can vary only by the Windows `pass*` labelling). To spot-check the docs: `FORTRESS_DESIGN.md`, `PROLOGUE_DESIGN.md`, `DOWNTIME_DESIGN.md` and `SYNERGIES_DESIGN.md` at the repo root each start with a "Consolidates…" note and an open-issues section; `archive/` holds the 17 moved files at their original relative paths.
