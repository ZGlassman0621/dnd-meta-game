# Report — registry-origin-rule-cleanup: the dead subclass-origin rule is gone everywhere

Builder: Claude Code (Opus 5.5). Brief: `docs/pm/registry-origin-rule-cleanup/BRIEF.md`.
Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.198 → **1.0.199**.
Commit: `969bd6e` (the build); a follow-up commit adds this line.

## Understanding
The project is a solo D&D 2024 "forever game": one human player character; the DM, NPCs, companions and enemies are played by an AI (gemma4:12b on the PC). The six-stage creator builds the character.

On 2026-11-12 Zach ruled "a class is a class": no subclass, from any setting, needs an explanation of how its holder came to the Forgotten Realms. Job 1's follow-up (`8d586ac`) removed the creator box, the Review check, the server refusal and one DM-prompt line. This job removes the residue: the registry validator's dead origin half, the tests that asserted the old rule, and the comments and rules text that still stated it. The character's own Stage 1 origin explanation (how *the character* came to the Realms) is a different thing and stays exactly as it was, as does the migration 114 column, kept unused for the queued calling-question job.

**Where my understanding differs from the brief:**
1. **More residue than the brief listed.** Besides `validateSelection`, about 9 test files and the fighter/spellshot/warden comments, the live repo had: the **DM prompt still telling the AI "origin explanation required"** after every outside-FR subclass (`subclassService.js:1346`); a now-uncalled helper `isOutsideFr`; the same "no origin explanation required … later outside-FR batches" comment in eight more class files; five more subclass files (blackguard, blood hunter, duelist, magus, pugilist, scholar) whose comments said the validator would demand an explanation; and two registry `sourceNote` strings (artificer ×2, monk). All fixed (fix-as-you-find-it).
2. **One sibling at class level, flagged for your veto.** The DM prompt told the AI that every Artificer's "origin explanation [is] REQUIRED, not yet recorded" (`artificerService.js:586`). That is the same defect one level up: an Artificer's class origin (Eberron) explanation that nothing enforces and the client never sends. I removed the "REQUIRED" text and kept the recorded explanation when one exists. See Decision 3.

## Verdict
**BUILT + GREEN** on the builder's run (Files 245/245 green, assertions 19,556 passed, 0 failed). Not a gate: Zach's own `npm test` and the `:5173` checks gate it.

## Per-item verdicts
| Item | Verdict | Evidence |
|---|---|---|
| 1. Survey first | **Built** | Full list below (file and line, pre-change numbering), taken before any edit. |
| 2. Dead half of `validateSelection` | **Built (origin half removed; function kept)** | The function still has a live job: the commit path calls it for *found* + *selection level* (`server/routes/character.js:2494`). So only the origin half went: the `originExplanation` parameter, the `isOutsideFr(...)` check and its reason text. `validateSelection` now returns `{found, complete, reasons}` from existence and level only. `isOutsideFr` had no other caller, so it was deleted (CLAUDE.md rule 2). The commit path's behavior for everything else is unchanged; its comment now states the ruling. |
| 3. Tests assert the ruling | **Built** | 10 test files changed, none deleted (each also covered live behavior). Details below. |
| 4. Comments and rules text | **Built** | 24 code/comment sites corrected to one line stating the ruling. Plan §12 pointers flagged below for Muse. |
| 5. Prove nothing broke | **Built for the suite; `:5173` not done by me** | Full suite green (below). The `:5173` behavior is covered at route level by existing tests (below); the click-through is in "How to verify" for Zach. |

## Item 1 — survey (every dead-rule reference found, before changes)
Search run over `server/`, `client/src/`, `tests/`, `scripts/` and root `*.md` (excluding `node_modules`, `.git`, `archive/`, `dist`, `docs/`): `validateSelection`, `subclass_origin_explanation`, `subclassOriginExplanation`, `originExplanation`, `origin explanation`, `origin_explanation`, `outside-FR` / `outside FR` / `outside the Realms`, `setting-neutral`, `plan section 12`. 254 lines matched; most are about the **character's** Stage 1 origin (kept) or are origin **labels** in the data (kept). The subclass-rule references:

**Code (behavior):**
- `server/services/subclassService.js:286, 296-299` — `validateSelection(… originExplanation)` and the check "needs an origin explanation for how its holder came to be in the Forgotten Realms". **Removed.**
- `server/services/subclassService.js:251-254, 1525` — `isOutsideFr` (only caller was the check above). **Deleted.**
- `server/services/subclassService.js:1344-1346` — DM prompt: `origin: <setting> — origin explanation required`. **Now prints the origin label only.**
- `server/services/artificerService.js:586` — DM prompt: `origin explanation REQUIRED, not yet recorded` (class level; Decision 3). **Removed.**

**Comments / rules text:**
- `server/services/subclassService.js:39-41` (S3 batch header), `:257-260` (formatSubclassOrigin note), `:277-283` (validateSelection doc).
- `server/routes/character.js:2483-2491` (commit comment), `:4609-4610` (allowlist comment), `:4726-4731` (artificer origin comment "per the outside-FR ruling").
- `server/data/subclasses/` — `bard.js:30-32`, `cleric.js:28-30`, `druid.js:53-55`, `paladin.js:39-41`, `ranger.js:41-43`, `sorcerer.js:32-34`, `warlock.js:40-42`, `wizard.js:33-35`, `fighter.js:22-25` ("no origin explanation required … later batches … require an explanation"); `blackguard.js:32-34`, `blood_hunter.js:29-32`, `duelist.js:10-13`, `scholar.js:10-15` ("how validateSelection treats null"); `magus.js:15-22`, `pugilist.js:14-19`, `spellshot.js:12-17`, `warden.js:11-16` ("an origin explanation is required at selection"); `artificer.js:226, 530` and `monk.js:459` (`sourceNote` strings).
- `client/src/components/creator-next/subclassOrigin.js:10-11, 13-14`; `Stage2ClassCalling.jsx:460-461`.
- `tests/creator-test-notes-1-client.test.js:263, 277` (comments).

**Tests asserting the dead rule:** `tests/subclass-artificer.test.js:141-152`; `subclass-scanned3.test.js:13-14, 192-196`; `subclass-scanned4.test.js:29-31, 187-192, 288`; `warlord-subclasses.test.js:231-244`; `subclass-tier0.test.js:116, 119-120`; `artificer-class.test.js:350`; plus a dead `originExplanation: ''` argument in `subclass-scanned1:153`, `scanned2:171`, `scanned5:157`.

**Already correct before this job (asserting or stating the ruling):** `Stage2ClassCalling.jsx:96`, `subclassOrigin.js:26-30`, `tests/creation-solidification.test.js:14-15, 291-323`, `tests/creator-next-stage6-commit.test.js:813-816`.

**Left on purpose:** `server/migrations/114_subclass_origin_explanation.js:4-7` (an applied migration's history comment; migrations are not edited). The column and plumbing it adds stay, per the brief.

## Item 3 — what each test now asserts
| Test file | Now asserts | Own count |
|---|---|---|
| `warlord-subclasses.test.js` | All **8** Warlord Presences carry an outside-FR origin label and are each a **complete selection with no explanation** (no reasons); the DM prompt shows the KibblesTasty origin label and **never** says "origin explanation". | 480 passed, 0 failed |
| `subclass-artificer.test.js` | Alchemist, Battle Smith, Armorer, Cartographer (Eberron origin) are complete at level 3 with no explanation; below level 3 still incomplete. | 130 / 0 |
| `subclass-scanned3.test.js` | Every S3 outside-FR subclass is complete at level 3 with no explanation; level 2 still incomplete; Champion complete. | 110 / 0 |
| `subclass-scanned4.test.js` | Warrior of Waves (non-FR) complete with no explanation; its DM prompt names the origin and no longer says an explanation is required. | 225 / 0 |
| `subclass-tier0.test.js` | Champion complete with no explanation; level and unknown-subclass gates still fail; `isOutsideFr` no longer exists on the service. | 55 / 0 |
| `artificer-class.test.js` | The Artificer prompt no longer demands an explanation, still shows "origin: Eberron/Khorvaire", and still prints a recorded explanation. | 104 / 0 |
| `subclass-scanned1/2/5.test.js` | Unchanged assertions; the dead `originExplanation: ''` argument removed. | 193, 242, 177 / 0 |
| `creator-test-notes-1-client.test.js` | Comments only. | 162 / 0 |

**The Warlord commit, Review and server-refusal cases** were already asserted by job 1 and still pass: `creator-next-stage6-commit.test.js:813-816` (a Warlord commits with **no** subclass origin explanation → HTTP 200; suite 368/368) and `creation-solidification.test.js:291-323` (no origin error for an outside-FR subclass; Review and Stage 2 carry no subclass-origin check; the column's save and resume still work; suite 86/86).

**The character's own Stage 1 origin is still required** (unchanged): `creator-next-stage6-commit.test.js:352` (outside-FR origin with no explanation is refused at commit) and `creator-next-stage6.test.js:466-472` (Review blocks at Stage 1 in plain words). Both pass.

## Item 4 — the ruling text, and plan §12 pointers
Each corrected site now says, in one line, that the origin is an informational label and that no subclass needs an origin explanation ("a class is a class", Zach 2026-11-12), keeping any still-true meaning (for example "do not silently flip this to Forgotten Realms", now "the label would lie").

**Repo text that still points at plan §12, for Muse** (not edited; the workspace doc is PM-owned). These cite §12 for the part of the old ruling that still stands, **settings kept as themselves, not reskinned**, not for the explanation requirement: `server/services/subclassService.js` S3 header ("not reskinned (plan section 12)"), `tests/subclass-scanned3.test.js:9` ("OUTSIDE-FR RULING (Zach, plan section 12): … NOT reskinned"), and the `conversionCheck` strings in `bard.js:467`, `cleric.js:597`, `druid.js:574`, `fighter.js:663`, `wizard.js:450, 515`. **Muse should correct plan §12 in the workspace** to drop the explanation requirement and keep the no-reskin rule, so these pointers stay accurate.

## Zero-hits check
**Dead-rule search terms** (`grep -rnIE`, same exclusions as the survey, plus `server/migrations/` reported separately): `needs an origin explanation for how`, `origin explanation required`, `origin explanation is required`, `origin explanation REQUIRED`, `requires? an origin explanation`, `requiring an origin explanation`, `require an explanation`, `outside-FR ruling`, `outside-FR rule`, `outside-FR explanation`, `explanation requirement`, `fail-closed per the outside`, `isOutsideFr`, `originExplanation: '' }`, `subclassNeedsOriginExplanation`, `validateSelection treats`.

**Result: zero subclass-rule hits in code, comments and root docs.** Every remaining hit is one of these, each justified:
- **The character's own Stage 1 origin, which still applies:** `server/routes/character.js:2109`, `server/services/speciesService.js:264` (the DM prompt flags a missing *character* explanation), `client/src/data/originSettings.js:12`, `client/src/components/creator-next/speciesAdapter.js:128` ("never reskinned"), `tests/creator-next-stage6.test.js:389, 571`.
- **Selection level, not origin:** `server/services/subclassService.js:141` ("validateSelection treats that as 0, i.e. no level gate").
- **Tests asserting the rule is gone:** `tests/subclass-scanned4.test.js:287`, `tests/subclass-tier0.test.js:120-121`, `tests/warlord-subclasses.test.js:243`, `tests/artificer-class.test.js:350`, `tests/creation-solidification.test.js:320, 323`, and the `BOILERPLATE` guard list in `tests/creator-test-notes-12-subclass-descriptions.test.js:62` (asserts descriptions never contain the phrase).
- **History:** `server/migrations/114_subclass_origin_explanation.js:4, 6` (untouched).

The brief's broader terms still appear by design: `validateSelection` (kept; found + level), `subclass_origin_explanation` / `subclassOriginExplanation` (the kept column and its save/resume/commit plumbing: `stage1Persistence.js:135-136, 326, 568`, `Stage2ClassCalling.jsx:451, 462`, `character.js:3249, 3495, 4611, 4910, 5082`), and `setting-neutral` / outside-FR origin values (the origin labels players still see, e.g. `warlord.js` "KibblesTasty (setting-neutral)").

## Migration 114 column — intact and unused
- The column and plumbing are unchanged: the save body (`stage1Persistence.js:135-136`), resume (`:568`), the draft PUT (`character.js:3495`) and the allowlists (`character.js:4611, 4910, 5082`). `creation-solidification.test.js:302-311` still proves save and resume.
- **Nothing reads or prints it:** a search of `server/services/` and `client/src/components/` outside `stage1Persistence.js` and `Stage2ClassCalling.jsx` finds no reader; the DM prompt does not use it.

## Files changed
| File | SHA-256 | Bytes |
|---|---|---|
| `client/package.json` | `738cf6cfd16a5b292f6633c8fc9d3f38ce05a085275dd543dd7d9a42b157b314` | 427 |
| `client/src/components/creator-next/Stage2ClassCalling.jsx` | `7aa180edffb7179f5801bf192dc833002e9fb65ec64ac445ff09f9a2af65021d` | 40,181 |
| `client/src/components/creator-next/subclassOrigin.js` | `7d2a7794910f359feed175d78716b43a08bbde486b441ee8097592b9c00b726f` | 1,499 |
| `package.json` | `f7cb2c9b7b2450e589594e65fce0045bdd2291ec701af4fcb959439b548a65af` | 1,398 |
| `server/data/subclasses/artificer.js` | `af79f69cec93dceb1a3fdf8a2bd1e610e9192dc19fefb16b07b52fdb0b2d2248` | 53,942 |
| `server/data/subclasses/bard.js` | `efb8767c7dadc6e5ea8bb22e965f8eb67cab420f411aaaff783ec659d998b0c4` | 58,189 |
| `server/data/subclasses/blackguard.js` | `215575149f6dc85056c208dc81031e3b1736c81909201b57bc3dfe8e6baf3027` | 25,272 |
| `server/data/subclasses/blood_hunter.js` | `f6a07e2bb129635ac96e72b89d1d2115665e4c4bce16e8210e94f61ea6b7fb55` | 36,198 |
| `server/data/subclasses/cleric.js` | `887e350bcd3a1d4e29e028d450ef1fdcc42ac87afc89ddc467586c636fe94fa6` | 64,493 |
| `server/data/subclasses/druid.js` | `a4edbdee8f89fc2ee689dc7add40c8cc405b409d8eaa452be0084d20891e7081` | 60,440 |
| `server/data/subclasses/duelist.js` | `40d3e15b4c4e084abc73cdb51e9b173c14490a1b537178ecb17796c4ec142fa1` | 11,419 |
| `server/data/subclasses/fighter.js` | `36047c776c3d4e80c174204ede9c77bc889cf70a5de05ba2f30168be9e0487d5` | 72,717 |
| `server/data/subclasses/magus.js` | `71adc06e71555cb2f4385b0a12a52722f3adc3f04557a6a321142ed08ab61c9c` | 25,223 |
| `server/data/subclasses/monk.js` | `c859f2ed83a3dc0a3c92ebf2691e894b7e9575e199176878e921626f0fb7a8a0` | 45,957 |
| `server/data/subclasses/paladin.js` | `7233f97621a9b7ecc5db4da34fb39b536384c6fdbfaec1417c3d2bf840e656a2` | 56,185 |
| `server/data/subclasses/pugilist.js` | `c6e4165308a5ed22c416c1ffe04bcac6d50c8021bdb9521ac0e098d560d2b4fd` | 24,744 |
| `server/data/subclasses/ranger.js` | `cdba6aa7821547ba51ff8392f611936f67d3db86df506eb5c754f5aad4b99faa` | 57,338 |
| `server/data/subclasses/scholar.js` | `85da5b4c686f61e4e1ecb549f5704f4b39ec1ff6a86d038fec67ca1049d55b3e` | 29,245 |
| `server/data/subclasses/sorcerer.js` | `80f8c3374488933bfc33ad0ac8416bcc0d7ded27ce68539910414f44b713fb0f` | 67,197 |
| `server/data/subclasses/spellshot.js` | `0ddd4582cefdc7427869836e61dd9921c3940cf84487e76879fca8b856f6109b` | 14,444 |
| `server/data/subclasses/warden.js` | `9a4f371e6704980390f82bb9ee0728dab795cab1a0463107488bc4e1e8c76040` | 37,692 |
| `server/data/subclasses/warlock.js` | `69a0a8f530c6f3a41a0c100be9bfbc37a6960df59420985e4652e928bafd2b47` | 63,402 |
| `server/data/subclasses/wizard.js` | `87309370af9b3c24a9a02ea836c04e33a37052a3f1c986fe7e054fe67a28cdf8` | 54,685 |
| `server/routes/character.js` | `faa5ddabe51ea491d7a5491fa66bbbcd76379596d00ec69d02e32e9d2ce41abf` | 430,151 |
| `server/services/artificerService.js` | `ad77e2455f72ae81b2692b3aac45200f2cef8a1617dd6c53f929769d7b8cca87` | 39,693 |
| `server/services/subclassService.js` | `d07d1f655461e0ce4632f53b9e53e53313b541d584d72a4b2a1623e06a6e9320` | 65,976 |
| `tests/artificer-class.test.js` | `1b3d6b2dc99790bb662ce18817c90774af2dafb8ef8a4c328f259d442cfbca0e` | 24,504 |
| `tests/creator-test-notes-1-client.test.js` | `74b9a7ea9a3387c766b5d55f1612e6077668a7c4002e5dc78b16b251139010ec` | 20,565 |
| `tests/subclass-artificer.test.js` | `6636de4485c3a79d3498865f4ee7a6c7873112574627b771d637be67c6df5acd` | 22,714 |
| `tests/subclass-scanned1.test.js` | `29fd0931237c1bade63a272ae4c722f6b43ebb33a64dd8f8ddb451d53f273aad` | 20,479 |
| `tests/subclass-scanned2.test.js` | `fe421cde4844b8ee0818dbce459df4827ef61d5e742a90fd810e0e59dd5d5889` | 22,490 |
| `tests/subclass-scanned3.test.js` | `d5829af74054fc298da0be32a55dd30054a6c32a4a3017e8029783d3c260cb5b` | 14,986 |
| `tests/subclass-scanned4.test.js` | `8e30df1a8e0a047d0711983087c1b661e499d4891ef9ddf71219bc9f189b4cca` | 23,691 |
| `tests/subclass-scanned5.test.js` | `728e4b441f697dbf837e46da5ea5a0cf8ec4f1067a3f3a957d60f8284f6f852f` | 21,412 |
| `tests/subclass-tier0.test.js` | `25b07fc1e83b5696d1f0a9715be4ed5e69b1152c901e8f5cede364a46fbd3e31` | 11,748 |
| `tests/warlord-subclasses.test.js` | `1627d00f221657d389ef886d8e816525271c513e4700cb1206928a22e9229fe7` | 26,633 |
| `docs/pm/registry-origin-rule-cleanup/BRIEF.md` | `6681b15704f8dbb5e99225ad6c600366af12e92e41a957ac01b10d494dbed29a` | 8,943 |

No migration. No file deleted. `docs/pm/registry-origin-rule-cleanup/BRIEF.md` is new (the brief, verbatim).

## What was built (in play)
A player who picks a Warlord, or any subclass from outside the Forgotten Realms, is never asked to explain it, never blocked at Review and never refused at commit. That was already true after job 1. What changes now is what the game says behind the scenes: **the AI DM is no longer told an explanation is "required"** for an outside-FR subclass or an Artificer, and the game's own rules code and comments no longer describe the old rule. A character from outside the Realms is still asked how *they* got there, exactly as before.

## Test results
- **Full `npm test` on the PC, after all edits:** Files **245/245 green**, assertions **19,556 passed, 0 failed**.
- Windows runner notes from the run: `downtime-rest.test.js` was retried once after a native crash mid-run and passed; `dungeon-generation`, `item-8-conditions`, `spell-damage` and `subclass-scanned3` counted `pass*` (libSQL exit crash after all assertions passed, so the runner records no count for them). The assertion total therefore moves a little between runs; the `subclass-scanned3` count from its own run is 110/0 (table above).
- **Touched suites, each run on its own** (their own totals): see the Item 3 table; also `creation-solidification` 86/86, `creator-next-stage6-commit` 368/368, `creator-test-notes-12-subclass-descriptions` 125/125, `creator-next-stage6` and `blood-hunter-subclasses` green.
- **Static import check:** `server/` 1,876 named imports across 429 files, **0 problems** (nothing imported `isOutsideFr` by name). `tests/`: the same 4 pre-existing false positives as before this job (import text inside test strings).
- **Client build:** succeeds.

## Not done / still open
- **`:5173` click-through:** not done by me (no browser). Route-level tests cover the same behavior (above); steps for Zach are below.
- **Plan §12 in Muse's workspace** still states the reversed rule (see Item 4). Muse corrects it.
- Cost and usage against the $30/month cap: not measurable from inside the session.

## Decisions made (reversible, for veto)
1. **Kept `validateSelection`**, removing only the origin half, because the commit path still uses it for existence and selection level. Reversal: restore the parameter and check from commit `329f534` (the head before this job; a few lines).
2. **Deleted `isOutsideFr`** (no caller left). Reversal: four lines; restore from git.
3. **Removed "origin explanation REQUIRED" from the Artificer DM-prompt line.** The ruling was spoken about subclasses; I applied it to the Artificer *class* origin because "a class is a class", nothing enforces that explanation, and the client never sends it. The storage path (`class_resources_json.artificer.origin`) is unchanged, and a recorded explanation is still printed. **If Zach or Muse wants the AI to keep prompting for an Artificer's origin, revert this one line** (`server/services/artificerService.js:586`) and the matching assertion in `tests/artificer-class.test.js`.
4. **Corrected comments to state the ruling** rather than deleting them where they carried other meaning (for example, "do not silently flip a homebrew class to the Forgotten Realms" stays).
5. **Version bump to 1.0.199** (the DM prompt text changes, so the app changes). Reversal: two lines.

## Needs Zach's decision
1. **Should the AI still be told an Artificer's arrival from Eberron needs explaining?** Until today the DM prompt said "origin explanation REQUIRED, not yet recorded" for every Artificer, though the game never asks for one. I removed that line as part of "a class is a class" (Decision 3). Keep the removal, or restore the prompt? I checked: the creator never sends the field (`artificer_origin_explanation` has no client sender), and nothing refuses a commit without it.

## How to verify
**Gate:** `npm test` on the PC (expect 245 files).
**At `:5173` (never `:3000`), with `npm run dev`:**
1. Create a new character: any species with a **Forgotten Realms** origin, class **Warlord**, any Presence. Stage 2 shows the Presence with an "· origin KibblesTasty (setting-neutral)" note and **no** explanation box. Finish the stages and commit: no Review block, no refusal.
2. Create a second character whose **origin is outside the Realms** (for example Eberron on Stage 1). Stage 1 still asks "How did you come to be in the Forgotten Realms?"; leaving it empty blocks at Review, and the explanation prints on the Review summary once filled.
