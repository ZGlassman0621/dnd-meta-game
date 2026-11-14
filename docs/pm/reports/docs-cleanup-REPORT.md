# Report — docs-cleanup: stop the repo's docs from lying to builders

## Understanding
**The project.** DnD Meta Game is a solo D&D 2024 "forever game". One human plays one character, and the AI runs the DM, NPCs, companions and enemies in a persistent Forgotten Realms world. The server owns the rules; the AI narrates. The MVP is a one-shot test campaign, Embervale.

**This job.** Nothing changes for the player. What changes is what the next builder reads. The job:
- check the PM's `.md` audit before acting on it;
- archive the stale history byte-identically under `archive/`, deleting only the one regenerable file;
- refresh five documents so they're true;
- make named corrections to four KEEP documents;
- report every open item buried in the archived files.

It's docs only: no code, tests, data or config.

**Where the brief and the live code disagree.** Stated first, as the handoff asks:
1. **The decided model isn't the model the code runs.** gemma4:12b via Ollama is decided (Zach, 2026-11-10), but nothing in `server/` defaults to it.
   - Gameplay prefers Claude when `ANTHROPIC_API_KEY` is set and falls back to Ollama, whose default model is still `gpt-oss:20b` (`getLLMProvider()` in `server/routes/dmSession.js`; `server/services/llmClient.js:9`).
   - Campaign plans, session chronicles and DM Mode call Claude only.
   - So I didn't write "the game runs gemma4:12b" anywhere. The refreshed docs state the decision and what the code does today, side by side, and say how to run gemma4:12b now (no key, `OLLAMA_MODEL=gemma4:12b`). Writing the decision as if it were built would just plant a new lie.
2. **There is no "cloud fallback pool" in the code** (brief item 3, LLM_SETUP). No endpoint other than local Ollama and the Anthropic API is configured anywhere in `server/`. I wrote that down and invented no address.
3. **Two audit verdicts don't hold** (details in Item 0). One STALE file is actually accurate, so it stayed. One KEEP file rests on a system that was deleted; KEEP files stay put anyway, so it's reported only.
4. **A few of the brief's requested wordings would be false against the code**, so I wrote the true version:
   - DM Mode's spell panel holds 297 spells, not 583;
   - the party generator still produces a 5e "background", not a theme;
   - DM Mode's model split is Claude-only code, not gemma4:12b.

   Details under Decisions made.
5. **This PC is missing one file the audit read on the Mac.** `dnd-documents/Lost_Mine_of_Phandelver_Clean.md` is gitignored (`.gitignore:21`), so the PC has 61 of the audit's 62 files. It's a KEEP file with no action in this job.

## Verdict
**BUILT + GREEN** on the builder's run: Files 247/247 green, assertions 19,556 passed, 0 failed. Zach's PC run is the gate; not claimed.

## Files changed
Commit and hashes are under Verification evidence. No `.js`, `.jsx`, `.json`, `.sql`, migration, test or config file changed. The changed-file list there proves it.

| Change | Count | Files |
|---|---|---|
| Archived (moved, byte-identical) | 27 | The table under Per-file manifest |
| Held back from archiving | 2 | `Claude UX Design/D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md`, `tests/output/prose-quality-results.md` |
| Deleted (regenerable) | 1 | `triage/alignment-coverage-matrix.md` |
| Refreshed | 5 | `README.md`, `CLAUDE.md`, `LLM_SETUP.md`, `ANCESTRY_FEATS.md`, `PROJECT_BRIEF.md` |
| KEEP-file edits | 4 | `DM_MODE.md`, `COMPANIONS.md`, `CUSTOM_CLASSES.md`, `THEME_DESIGNS.md` |
| New | 4 | `archive/README.md`, `docs/pm/docs-cleanup/BRIEF.md`, `docs/pm/docs-cleanup/AUDIT.md`, this report |
| Replaced with Muse's updated copy | 1 | `docs/pm/HANDOFF.md` (PC-only staging, reports folder) |

## What was built (in play)
Nothing changes in play. For builders:
- The repo root went from 38 `.md` files to 22.
- The refreshed docs describe the current game.
- Each refreshed doc says plainly where the code lags the decisions.
- History lives in `archive/` under its original names, so a code comment that cites one of these files still finds it.

## Item 0: the audit audited
I checked every verdict against the live files: the head and status of each file, and the factual claim each verdict rests on.

**Exceptions (2):**
1. **`Themes-Replace-Backgrounds.md`: STALE does not hold. Left in place, not archived.**
   - The audit's only stated reason is that the file's line "Themes unlock **automatically** at the milestone levels. The player never picks from a menu" contradicts the live design.
   - The live code does exactly that. `server/routes/character.js:6850` reads "Theme tier (auto-unlock): only fires at exactly L5, L11, or L17", and picks the theme's single tier ability with no player choice (`:6864–6869`, `LIMIT 1`, `path_variant IS NULL`).
   - The file may still be stale in other ways (its "data partially seeded" status line, for one), but the verdict's evidence is wrong. The brief says no file moves on an unconfirmed verdict.
   - Whether the *design* should be "player picks at tier crossings" is a design question, not a doc one.
2. **`OPEN_QUESTIONS.md`: the KEEP rationale is false.**
   - The audit keeps it because "the module system exists in code (`campaignModules.js`)".
   - That system was removed in v1.0.180 (commit `1c211b0`, "Remove published campaign modules"), and `client/src/data/campaignModules.js` no longer exists. The file's whole content is about that removed system.
   - KEEP files are out of scope for edits and moves, so it stays as is. Muse may want to archive it in a later pass.
   - The same applies to the Mac-only `Lost_Mine_of_Phandelver_Clean.md`, whose KEEP rationale is the same module pipeline.

**Confirmed (the rest), with the facts that were checked:**
- **Spent plans.** Each status header matches the audit:
  - Phase 2, 3, 3.5 and 4/4a/4b specs, `IMPLEMENTATION_PLAN`, `PROJECT_TODO`, `CONSOLIDATED_TODO`, `TEST_RESULTS`.
  - Phase 3.5 shipped: `client/src/components/settings/SettingsOverlay.jsx` exists, with the combat dial "Coming soon".
  - Phase 4a shipped: `server/migrations/053_ai_call_log.js`, `aiBehaviorSignals.js`.
  - Phase 3 shipped: `standingScalar.js`, `timeBoundedState.js`.
- **Old-creator documents.** `CharacterCreationWizard.jsx` is gone, and `App.jsx` mounts only `CreatorNextShell`.
- **Claude-era documents.** `LLM_SETUP_REVIEW`, prose-quality triage and analysis.
- **Dated audits.** `CAMPAIGN_READINESS_AUDIT` (2026-08-09, v1.0.167), `CHAR_CREATOR_DESCRIPTIONS_AUDIT` (2026-04-19), `CODE_AUDIT_FINDINGS` (v1.0.102), `KEEPER_REVIEW`.
- **The UX bundle.** Its README references subfolders that don't exist; the folder holds only README, transcript and `Session Hi-Fi.html`.
- **KEEP / KEEP-DEFERRED.** All 27 are as described. The deferred ones cover post-MVP systems (prologue, downtime, Mythic, fortress, synergies, ancestry redesign, DM Mode review). The live-system ones (`Phase_3_Closeout`, `COMPANIONS`, `DM_MODE`, `CUSTOM_CLASSES`, `THEME_DESIGNS`, `AI_NARRATIVE_PERSISTENCE`, two reviews, `DM_CRAFT_ARTICULATION`) describe things that exist.
- **One overstatement, verdict unaffected.** The audit says the coverage matrix "no longer reflects the live prompts". Regenerating it gave identical counts (241/567); only the date line changed.
- **Structural claim confirmed.** No `.md` files under `server/`, `client/` or `scripts/`.

## Item 1: reference check
**What was run:** a script read every text file in the repo except `node_modules`, `.git`, `.test-tmp` and `docs/pm`. For each of the 30 move/delete targets it listed every line that names the file (the bare basename without `.md`, or `Session-Design-Bundle/README` for the generic README). All 30 files existed at their stated paths, including `Themes-Replace-Backgrounds.md` at the `(Remix)/` root, as the audit corrected.

**Real dependencies (code reads or writes the file):**
- `tests/prose-quality.test.js:42` writes its output to `tests/output/prose-quality-results.md` (`OUTPUT_PATH`). **Held back; it stays at its path.**
- `tests/coverage-matrix.js:140` writes `triage/alignment-coverage-matrix.md`. This is the generator for the delete item, as the brief expects.

**Comment citations only (no code depends on the path).** These files moved, and the comments still find them by name in `archive/`:

| Archived file | Cited from (comment lines) |
|---|---|
| `DECISION_LOG.md` | 34 comment lines across 25 files, e.g. `client/src/App.jsx:113`, `server/services/markerSchemas.js:38`, `server/services/npcAgingService.js:140`, `tests/prelude-setup.test.js:11`, `tests/prelude-marker-schemas.test.js:4` |
| `PHASE_2_CREATOR_SPEC.md` | 13 lines: 7 `client/src/data/theme*.js` headers, `server/data/themeGoldModifiers.js:5`, `server/migrations/049_…js:5,33`, `campaignCanonTransferService.js:6`, `preludeTransitionService.js:183,382` |
| `IMPLEMENTATION_PLAN.md` | `server/migrations/042_…js:5`, `048_…js:27`, `049_…js:33`, `preludeCanonThreadService.js:11`, `preludeTransitionService.js:19` |
| `PHASE_3_REFACTOR_SPEC.md` | `standingScalar.js:14`, `timeBoundedState.js:6`, `tests/faction-standing-prompt-snapshot.test.js:4` |
| `PHASE_4_OVERVIEW.md` | `server/services/aiBehaviorSignals.js:28,417` |
| `CONSOLIDATED_TODO.md` | `server/migrations/049_…js:32`, `campaignCanonTransferService.js:21` |
| `triage/pattern-d-survey.md` | `server/services/timeBoundedState.js:6` |

**References from staying docs to archived files** (reported, not rewritten, per item 1): `PROJECT_BRIEF.md` (to `PROJECT_TODO`, `CONSOLIDATED_TODO`, `DECISION_LOG`, `CHANGELOG`, `IMPLEMENTATION_PLAN`, the UX bundle README), `FUTURE_FEATURES.md`, `KNOWN_BUGS.md`, `PHASE_3_7_SPEC.md`, `Phase_3_Closeout.md`, `PRELUDE_IMPLEMENTATION_PLAN.md`, `DM_MODE.md` (to `PROJECT_TODO`), `Claude PM Review Docs/PRELUDE_REVIEW.md`.

## Per-file manifest

### Archived: 27 files (SHA-256 before = after)
Each was moved with `git mv` to `archive/<same relative path>`. Two checks passed for all 27: the working-file SHA-256 before and after the move, and git's own blob ID (`HEAD:<old>` against the staged `<new>`). Every pair was identical, and no file remains at its old path.

| # | Old path | New path | SHA-256 (before = after) |
|---|---|---|---|
| 1 | `PROJECT_TODO.md` | `archive/PROJECT_TODO.md` | `6976c7c603e587f96420be7b372e00285c1f3dd869aaea07a409e46393e71c16` |
| 2 | `CONSOLIDATED_TODO.md` | `archive/CONSOLIDATED_TODO.md` | `4226f4f1eb3875b2fa0e41169dea467f73d4fbcd91a17e75367e66cf7fe75589` |
| 3 | `TEST_RESULTS.md` | `archive/TEST_RESULTS.md` | `aa4f9185f94452c316c9b9bb51d1a62b2690aa792c577fe319b9ccf6af7d7c76` |
| 4 | `CAMPAIGN_READINESS_AUDIT.md` | `archive/CAMPAIGN_READINESS_AUDIT.md` | `28fe1f2a1c9a372b2624d95b6854c4569beddbeb8d9787fdaa2ff85acaf96bfa` |
| 5 | `CHAR_CREATOR_DESCRIPTIONS_AUDIT.md` | `archive/CHAR_CREATOR_DESCRIPTIONS_AUDIT.md` | `d1f4120379e5e92d91092add07326a64f1c5b325f6ec3a46e5d86d3d0c8f41f4` |
| 6 | `PHASE_4_OVERVIEW.md` | `archive/PHASE_4_OVERVIEW.md` | `11e5e6cf78fe98d22ee3c6af73f82370486ecbf29dad29f73f0405bc60eaac95` |
| 7 | `PHASE_4A_SPEC.md` | `archive/PHASE_4A_SPEC.md` | `113e0ff7f1e6a2b0e740d6824b03f7e7350a285bc0fc0c1386138b91293acc09` |
| 8 | `PHASE_4B_SPEC.md` | `archive/PHASE_4B_SPEC.md` | `5bce4bd7dc49a0c80133354fbfc7dab4c660f42961db7a8209de6e906faf6742` |
| 9 | `PHASE_3_5_SPEC.md` | `archive/PHASE_3_5_SPEC.md` | `a543371798c85457485552d95594f5a91d4038205f0d84bb49d2b935086b85ec` |
| 10 | `PHASE_3_REFACTOR_SPEC.md` | `archive/PHASE_3_REFACTOR_SPEC.md` | `3f870e34c6ebc09b45ce37e7799ab3f55c1aa168ad7f1cb8dbe8f5f1f38a79f6` |
| 11 | `PHASE_2_CREATOR_SPEC.md` | `archive/PHASE_2_CREATOR_SPEC.md` | `0d7c011509f94d6f678ebc6eeee8b06a8136bffdd5a370584145cbbdc6ad3e15` |
| 12 | `Phase_2_Creator_Spec_Drafted_Content.md` | `archive/Phase_2_Creator_Spec_Drafted_Content.md` | `247a20cf629688b84f9f6e321b9f5b06b69028592ac40b0181ec651e570a0b00` |
| 13 | `IMPLEMENTATION_PLAN.md` | `archive/IMPLEMENTATION_PLAN.md` | `da95774c0ed27bb4ff2ad7f0d43ddc54565d93d93a44c1cb3e034eae1b3cc3db` |
| 14 | `DECISION_LOG.md` | `archive/DECISION_LOG.md` | `dc6e026fd709aa61aa84f240464d656d2e78deea7ce96f4f2fb375b90654ec4a` |
| 15 | `CHANGELOG.md` | `archive/CHANGELOG.md` | `95e10bf1da7f9f9d5b1f5b1e1f980a229db685db7ada2b28e377c3856d00ffac` |
| 16 | `Character Creator Questions.md` | `archive/Character Creator Questions.md` | `67a3f89bb1eaa2bb716e0163048aa314d16a9e8fc359129a1e43d8c2d26aeadb` |
| 17 | `Claude PM Review Docs/CODE_AUDIT_FINDINGS.md` | `archive/Claude PM Review Docs/CODE_AUDIT_FINDINGS.md` | `55132d09195dc7cd441d3c9c7cfb1a8fdf2f7fd6fb07c8de19886d843f224b0a` |
| 18 | `Claude PM Review Docs/KEEPER_REVIEW.md` | `archive/Claude PM Review Docs/KEEPER_REVIEW.md` | `f9ac85adb0a2f5b0c5abe41ebf235fa8e29deb8c4f8f51271e24133b88261af9` |
| 19 | `Claude PM Review Docs/LLM_SETUP_REVIEW.md` | `archive/Claude PM Review Docs/LLM_SETUP_REVIEW.md` | `f017c6a38c08bbc52cef369fad02934d6ebe736ff6cd21b0bbb7173d4ded4df8` |
| 20 | `Claude PM Review Docs/PHASE_2_SHIP_NOTE.md` | `archive/Claude PM Review Docs/PHASE_2_SHIP_NOTE.md` | `a0285bd1b0532f48a4f165f835d663160791800dc743fe9e787b318e2f8aba61` |
| 21 | `triage/PHASE_3_5_DESIGN_BRIEF.md` | `archive/triage/PHASE_3_5_DESIGN_BRIEF.md` | `76569f86230e55ef173945243b0aa9a5b1c6dfe2f8466f22304471ad49a8ed39` |
| 22 | `triage/pattern-d-survey.md` | `archive/triage/pattern-d-survey.md` | `adb0dc00ff27c3d9816e3af2bdaedcb04bb5a830b2d1da2e9f78269e3186e091` |
| 23 | `triage/prose-quality-triage.md` | `archive/triage/prose-quality-triage.md` | `2badeff7eedbb0f6e0a89f6c0ca6d2f59139b49eea35a3da8c6213ee5d7675a1` |
| 24 | `triage/q6-detect-function-survey.md` | `archive/triage/q6-detect-function-survey.md` | `861c4a08443f8ea9494c3ad072109c241c253cca3ad20fc645f4cdd536f316d2` |
| 25 | `Claude UX Design/D&D Meta Game (Remix)/Session-Design-Bundle/README.md` | `archive/Claude UX Design/D&D Meta Game (Remix)/Session-Design-Bundle/README.md` | `479c8d3690b87dcb33d996ee028f8ab69d064c7a9ff543abea8445f076b2f8b3` |
| 26 | `Claude UX Design/D&D Meta Game (Remix)/Session-Design-Bundle/chat-transcript.md` | `archive/Claude UX Design/D&D Meta Game (Remix)/Session-Design-Bundle/chat-transcript.md` | `c72634a4b9e40b52789cc0adc48b6bf556bdb7bbcc3ef436a0b17e0a19569843` |
| 27 | `tests/output/prose-quality-analysis.md` | `archive/tests/output/prose-quality-analysis.md` | `21f0d94ded43dc24d061a3348c32bff9f98a45058020af6ca55dd1dc8016e05d` |

### Held back: 2 files
- `Claude UX Design/D&D Meta Game (Remix)/Themes-Replace-Backgrounds.md`: the verdict does not hold (Item 0, exception 1).
- `tests/output/prose-quality-results.md`: a live test writes to that path (Item 1). Its sibling `prose-quality-analysis.md` did move, since nothing references it.

### Deleted: 1 file, with regeneration proof
`triage/alignment-coverage-matrix.md`
- **Before:** SHA-256 `82ce59491af5f44d40066639828dfc09eefbabedcd2509101934ccf1bc112d90`. Backed up outside the repo before deletion, and it's in git history.
- **Generator:** `tests/coverage-matrix.js` exists. I ran `node tests/coverage-matrix.js`, which printed `Wrote triage/alignment-coverage-matrix.md (142 lines)`. The regenerated file differs from the committed one **only in its date line** (`diff` shows line 3 alone), with the same aggregate "241 / 567 cells filled (43%)".
- **The PM ruling it carries, verbatim** (line 11): *Not every empty cell needs filling. Per PM ruling 2026-05-02: "the principle isn't 'every theme covers every alignment' — it's 'every theme has roleplay-believable coverage across the spectrum.' Some empty slots are correctly empty (a Knight of the Order ideal at CE would read as villain manifesto regardless of how it's phrased)."*
- **Then deleted** with `git rm`. Note that running the generator recreates the file at that path.

### Refreshed: 5 files
Each was checked against live code before writing. SHA-256 values are after the edit.

| File | Bytes | SHA-256 | What changed |
|---|---|---|---|
| `README.md` | 4,030 | `9435adbc5cf5a30dc0959bcc584f3913484de712bc038630b4b978b7d79159ee` | Rewritten: the solo forever game, the MVP and its out-of-scope list, counts from the code, decided model vs. live code, PC run steps (clone, live branch, `ollama pull gemma4:12b`, `npm run dev`, :5173), tests, scripts, docs map. No API key requirement, no Mythic as a feature. Removed the Windows-release section, which told users to add an Anthropic key. |
| `CLAUDE.md` | 26,040 | `877877454bf864c51e2ffc8d268777e26f5b6d511c4bc982e0e17f6b2f2718a0` | Status banner (MVP, PM workflow, `docs/pm/`, `archive/`); AI stack line; new "Which model runs" (decided vs. live, provider logic, Claude-only features, no cloud pool), with the Claude registry and request-contract sections marked as the Claude path; "known failing" (none: 247/247 green); rule 5 (version bump per job, `CHANGELOG.md` retired); rule 6 (dead `CharacterCreationWizard.jsx`); flag table (added `COLD_EXPOSURE`; `PROGRESSION_AWARDS` wording, with Mythic post-MVP); `ai_call_log` debt line (it **is** pruned now); Key files (creator, Prelude post-MVP). Working rules 1–4 untouched. |
| `LLM_SETUP.md` | 5,093 | `5480aca7189aa34ded9d7efcdccf68484ff4f4d88d6098b0a2f152c55a3cd47e` | Rewritten: the decision (gemma4:12b, leak test, per-role models open); what the code does (provider order, `OLLAMA_MODEL` default `gpt-oss:20b`, `OLLAMA_URL` default, the status endpoint); features that call Claude directly; "no cloud fallback pool in the code"; how to run gemma4:12b today; a module table where every file was confirmed to exist; troubleshooting. |
| `ANCESTRY_FEATS.md` | 93,337 | `c46722e65adb1cce1ef1a4bcd0b574994392107bfb9b94201ddf1a60a9bcdd01` | Status header only, plus one count line in the scope bullets (fix-as-you-find). Now reads 210 feats, 14 lists, 15 per list (counted from `server/data/ancestryFeats.js`). The 14th list, Gnome, has **no section in this doc**. Path Less Walked is still not implemented (no list has a 4th choice). Feat catalog text untouched. |
| `PROJECT_BRIEF.md` | 14,697 | `d085734de35735c2f1cd59107bbef262037a3d78b0bcd661c0abdee4e22a38e9` | Principles: #1 "Narrative beats mechanics" is replaced by "Nothing mechanical is narrative-only" (Zach, 2026-11-08); added "the 2024 book wins" and "don't guess; never invent data" (Zach, 2026-11-07); #3 "Cost-aware / Opus-as-default" becomes "Runs locally" (gemma4:12b). The two inventory lines for DM Mode and Prelude now read "exists in code but is out of MVP scope" and "post-MVP". The old line also called the scrapped 8-step creator live. Vision text untouched. |

### KEEP-file edits: 4 files

| File | Bytes | SHA-256 | Edit |
|---|---|---|---|
| `DM_MODE.md` | 18,587 | `7d9aea3efaf479f999270acef7584c51bf1a0d57458d56e748472cf3b918af84` | Model notes added above both model-split sections: the decided model is gemma4:12b, the split shown is today's Claude-only code, and DM Mode is out of MVP scope. "Spells (300+)" now reads "Spells (297, from `client/src/data/spells/` …)". "background" was **not** changed to "theme" (see Decisions). |
| `COMPANIONS.md` | 16,252 | `d1b91b2d8d47a3faa85814517567b2d82bdf27e60bc05cb5c98faed7bc4b2403` | The Opus references (activity outcomes, two file pointers) now describe the real code paths (Claude when a key is set; Ollama or a non-AI fallback otherwise) and name the decided model. The synergies section is marked **unbuilt as an AI behavior** (team tactics are seeded but never reach the DM prompt). The garrison/base-roles section is marked **post-MVP fortress**, and its dead pointer to a CLAUDE.md section that doesn't exist now points to `partyBaseService.js`. |
| `CUSTOM_CLASSES.md` | 13,226 | `d81781c26c0980f1b63692cd958401b0ae17552e05f29d4efc8a50ff2dd7c1aa` | The `MULTICLASS_REQUIREMENTS (CHA 13 + INT 13)` line is fixed. `levelProgression.js` has no such table, and its comments record the removal (`:1339`, `:2111`, "REMOVED 2026-11-08"). In the same line, `CASTER_TYPE (none)` becomes `'third'` (live value, `levelProgression.js:1390`). The dead old-wizard checklist line now states the live gap: the six-stage creator has no Keeper text or recitation picker. |
| `THEME_DESIGNS.md` | 141,114 | `3ff5bc36eb72a1d2d400aa6bb8e3651c27d68d9434f125baf3b5ae12dc15831c` | Status line only: built, all 21 themes with four tier abilities each (84 `tier:` entries in `server/data/themes.js`), offered on Stage 3. |

### New and replaced
| File | Bytes | SHA-256 |
|---|---|---|
| `archive/README.md` | 1,708 | `05493d349a49b389faa8c776732943fa9c92224669d9d46918edca666e7e3682` |
| `docs/pm/docs-cleanup/BRIEF.md` | 18,609 | `73060fc6f00c67b20589bd8d297bcde2f354aa825a024210c637cd84a2670b52` |
| `docs/pm/docs-cleanup/AUDIT.md` | 34,990 | `beb02f4f316e6ca040c1aa9633ec84f556d12fa4ff034082caa8b1c19025e482` |
| `docs/pm/HANDOFF.md` (Muse's updated copy) | 12,648 | `b80cda9f2efdda2064789fb1d71b915637680fc39ba743d3114102b4ab394f0c` |

**Read-back.** `CLAUDE.md` was read back in full after editing. `README.md` and `LLM_SETUP.md` were written whole, then read back. `ANCESTRY_FEATS.md`, `PROJECT_BRIEF.md` and the four KEEP files had small edits, each confirmed by reading the edited lines in context.

## Carry-forwards (item 6)
Nothing was built; each was checked against live code.

| Item | Verdict | Evidence / what would resolve it |
|---|---|---|
| Keeper 8 genre-bonus texts | **Still open: missing** | `client/src/data/keeperTexts.js:531` `GENRE_DOMAINS` has only `passive` / `masteryUpgrade` / `masteryCapstone` per genre. No Text object is tagged to a genre (no `genre` key anywhere in the file). Resolver: author the 8 texts. It belongs in the class-audit gap list. |
| Keeper L5 Eidetic Memory, L14 Unwritten Knowledge | **Still open** | Named only in `server/config/levelProgression.js:358,367` (feature lists). No service, route or prompt logic. Resolver: design against chronicle data (Pattern F). |
| Aasimar Path's Choice persistence | **Still open** | The feat exists as data (`server/data/ancestryFeats.js:226`), but nothing stores which path was chosen. Resolver: storage + prompt wiring. |
| Drow Lolth standing | **Still open: no footprint** | "Lolth" appears only in data/config (`ancestryFeats.js`, `phbSpecies.js`, `themes.js`, `mythicProgression.js`); none in services, routes or migrations. Drow is also deferred for PCs in the MVP. Parked to FUTURE_FEATURES. |
| Drow House Heritage NPC recognition | **Still open** | Feat text only (`ancestryFeats.js:73`); no recognition logic. |
| Human Quick Study time-bounded persistence | **Still open** | Feat text only (`ancestryFeats.js:82`). The `quickStudySkill` in `scholarService.js:157` is the Scholar class's own feature, not this feat. |
| Deity worship-contract authoring | **Still open** | `client/src/data/deities.json`: 55 deities with only `name` and `description`; no contract text anywhere. |
| Heirloom handoff producer | **Still open** | `server/services/preludeTransitionService.js:179`: "Producer-side wiring is DEFERRED — no [OBJECT_HINT] marker". No `INSERT` into `prelude_canon_heirlooms` exists. Prelude is post-MVP. |
| Unreviewed systems (living-world tick, merchant economy, bases, NPC lifecycle, notoriety, quest ecosystem) | **Still open** | No dedicated review of these is recorded in the repo. The tick and NPC aging are flag-off; bases are post-MVP. Resolver: a review job per system before switching any on. |
| Orphaned `partySynergy.js` import | **Resolved** | `server/config/rewards.js:1` imports `calculatePartySynergy` and `calculateModifiedSuccessChance` from `./partySynergy.js`, which exists and exports both (`:229`, `:426`). |
| `ai_call_log` archival | **Built (as pruning)** | `pruneAiCallLog()` (`server/services/aiCallLogger.js:302`) runs at session end (`server/routes/dmSession.js:3771`). It clears the heavy content columns of rows older than 30 days (`AI_CALL_LOG_RETENTION_DAYS`) and stamps `archived_at`. No export of old rows before pruning. `CLAUDE.md` corrected to match. |
| Post-level-20 progression | **Record only** | Mythic is post-MVP. Code exists (`mythicService.js`, `server/config/mythicProgression.js`). |
| Combat-difficulty mechanism (Phase 4b roster #4) | **Still open** | `client/src/components/settings/SettingsOverlay.jsx:245–256`: the dial is drawn `disabled` and labelled "Coming soon"; nothing in `server/` reads a combat-difficulty value. |
| Project rename | **Still open: Zach's call** | Not decided here. Blocks nothing. |
| Session Hi-Fi Path A/B | **Settled** | Decided post-MVP, Path A standing (PM, 2026-11-11). Not reopened. |
| `detectDowntime` deferral | **Record only** | `detectDowntime` exists (`server/services/dmSessionService.js:286`) and is called (`server/routes/dmSession.js:2210`). Its marker migration belongs to the downtime phase, which is post-MVP. |

## Test results
- **Full `npm test` on the PC, after all edits:** Files **247/247 green**, assertions **19,556 passed, 0 failed**. That is the same count as the creation-solidification follow-up run, as expected for a docs-only change.
- Windows-only runner notes: `migration-schema-contract` and `weapons-mastery` were counted as `pass*` (libSQL native crash after all assertions passed; see `server/scripts/run-tests.js`). Nothing was retried.
- `prose-quality.test.js` was skipped as usual (billed LLM calls). It is the test that writes to the held-back `tests/output/prose-quality-results.md`.
- No suite was touched by this job: no test file changed. `tests/coverage-matrix.js` was run, not edited.

## Cost and usage
I can't measure it from inside the session; `/usage` in Claude Code shows standing against the $30/month cap. This job made no billed API calls.

## Not done / still open
- **Making gemma4:12b the code's default, and moving the Claude-only features** (campaign plans, chronicles, DM Mode) to the local model. These are code changes, out of scope. The docs now say plainly that they're open. **Chronicles matter for the MVP**: the "memory retained" goal depends on them, and today they only run through Claude (`server/services/storyChronicleService.js:16`).
- **Gnome has no section in `ANCESTRY_FEATS.md`.** The brief allowed a status-header-only edit, so the 15 Gnome feats are documented only in code.
- **The Keeper creator gap.** A Keeper created in the six-stage creator gets no text or recitation picks at level 1. It's a code gap, out of scope here, and recorded in `CUSTOM_CLASSES.md`.
- **The DM Mode spell panel uses its own 297-spell list**, not the 583-spell catalog. Code; out of scope; post-MVP.
- **The party generator still produces 5e backgrounds**, not themes. Code; out of scope; post-MVP.
- **Two files the audit got wrong stay where they are:** `Themes-Replace-Backgrounds.md` and `OPEN_QUESTIONS.md`.
- **Links from staying docs to archived files** (listed under Item 1) were reported, not rewritten.
- **`PROJECT_BRIEF.md` principle #2,** "Don't remove systems — hide or mark them inactive", sits awkwardly next to `CLAUDE.md` rule 2 ("Delete outright"). The brief limited me to replacing #1 and the current principles, so I left #2 for Muse.
- **The audit's "11 KEEP" count.** Its own KEEP list includes `PROJECT_BRIEF` and `ANCESTRY_FEATS` among the files to refresh, so the totals overlap. That has no effect on any action.

## Decisions made (reversible, for veto)
1. **Comment citations don't block a move; real code dependencies do.**
   - The brief says a file referenced by live code stays put. Read literally, that would have held back `DECISION_LOG`, `IMPLEMENTATION_PLAN`, `PHASE_2_CREATOR_SPEC`, `PHASE_3_REFACTOR_SPEC`, `PHASE_4_OVERVIEW`, `CONSOLIDATED_TODO` and `pattern-d-survey`, every one of them because of a source comment like "see DECISION_LOG 2026-04-30".
   - No code reads those files, and their names are unchanged in `archive/`. I held back only the file a test actually writes to (`prose-quality-results.md`).
   - Every citing line is listed under Item 1.
   - Reversal: `git mv archive/<file> <file>` per file, about one minute each.
2. **Truth over the brief's wording where the two conflict:**
   - **(a) `DM_MODE.md`:** the model-split sections got notes rather than a rewrite to "gemma4:12b", because DM Mode's code is Claude-only.
   - **(b) DM Mode's "Spells (300+)"** became 297, not 583. The panel reads `client/src/data/spells/` (297 entries), not the catalog.
   - **(c) The party generator's "background"** stayed, because `server/services/partyGeneratorService.js:69` still asks for `"background": "D&D 5e background"`.
   - **(d) Every refreshed doc** states the gemma4:12b decision next to what the code does, not as built.
   - Reversal: text edits, minutes each.
3. **`archive/README.md` says the files moved on 2026-11-13,** the actual date, not the 2026-11-11 the brief anticipated. The audit date is given as 2026-11-11. Reversal: one word.
4. **Fix-as-you-find inside files this job touched,** all doc lines:
   - `CLAUDE.md`'s false `ai_call_log` "no archival job", dead `CharacterCreationWizard.jsx` and "exactly two lines" grep claim;
   - `CUSTOM_CLASSES.md`'s `CASTER_TYPE (none)`;
   - `ANCESTRY_FEATS.md`'s second "195" line;
   - `COMPANIONS.md`'s dead CLAUDE.md section pointer;
   - `PROJECT_BRIEF.md`'s "8-step creator is live".

   Reversal: git revert of those lines.
5. **`CLAUDE.md` rule 5** is now "one version bump per job, recorded in the job's report", following the PM decision that `CHANGELOG.md` retires. This job made no app change, so there was no version bump. Reversal: restore the rule's old text.
6. **Muse's updated handoff replaces `docs/pm/HANDOFF.md`** as handed over (PC-only staging). The brief says never to touch `docs/`, but placing PM-supplied documents there is how the workflow runs; the content is Muse's, verbatim.

## Needs Zach's decision
None. Questions for Muse, inside PM latitude: whether to archive `OPEN_QUESTIONS.md` (it's about a removed system), what to do with `Themes-Replace-Backgrounds.md`, and principle #2 in `PROJECT_BRIEF.md`.

## Verification evidence
- **Repo / branch:** `E:\DnD Meta Game\dnd-meta-game`, `phase-4-hybrid-combat`. The commit hash is in the handoff message, because a report can't contain its own commit's hash.
- **Proof that no code, test, data or config changed:** the commit's file list is only `.md` files. Every rename is `R100` (identical content), plus the one deleted `.md`.
- **Hashes:** every changed file is listed above with SHA-256. The 27 archived files are checked both at file level and at git-blob level.

## How to verify
- **Gate:** on the PC, `git pull`, then `npm test`. Expect all files green and 0 failed; any `pass*` or retry lines name their files.
- **Docs-only job: there is no visible change at :5173.**
- **Spot checks:**
  - `ls archive` shows the moved tree.
  - `git log --follow archive/DECISION_LOG.md` shows the file's full history.
  - `node tests/coverage-matrix.js` regenerates the deleted matrix. Delete it again afterwards, or it shows as a new file.
