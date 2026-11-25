# Report — repo-check-fixes-alignment-lifestyle: the picker says what the book says

## Understanding first

**The project.** This is a solo D&D 2024 game. One player character adventures in a persistent world, and an AI Dungeon Master runs everyone else. The character creator walks the player through building a character. Its Stage 5 ("Gear & Story") asks for an alignment and a lifestyle, and shows a short description under each choice.

**This job.** A 2026-11-24 check against the 2024 Player's Handbook found that eight of those descriptions were the builder's own summaries rather than the book's words. Two were alignments (Chaotic Good, Neutral Evil) and six were lifestyles (Wretched, Squalid, Poor, Modest, Comfortable, Aristocratic). Some invented things the book never says, such as Neutral Evil being about "getting away with" things, or lifestyles described as stables, huts and inns. This job replaces those eight with the book's wording, quoted in the brief. Nothing else changes: no names, costs or order, True Neutral stays as it is, and the Faith list is left alone.

**Where my reading differs from the brief:**
- **Step 0 (the drift check): no drift.** The live file `client/src/data/storyChoices.js` was 3,531 bytes, the size the brief names. All eight entries carried exactly the "Repo now" text the brief quotes (lines 12, 17 and 23–29). I built on it.
- **Apostrophes.** The file already used the typographic apostrophe (’), as in "baron’s". The brief's plain-text quotes use the straight one ('). I kept the file's ’ in "baron’s" and "You’re". The words are the book's; only the apostrophe glyph differs from the brief's typing. See Decisions made.
- **The Faith entries aren't in this file.** They live in `client/src/data/deities.json` (Atheist, Agnostic) and in Stage 5. Neither file was touched; the evidence is below.
- **The brief's Setup section is out of date.** It still says Zach pulls to the Mac for the gate. The handoff document of 2026-11-25 says the PC copy is the only working copy, and I followed the handoff. Nothing in the build depends on this.

## Verdict

**BUILT + GREEN.** All eight descriptions are the book's wording, and my full-suite run is green. Zach's run is the gate.

## Files changed

| File | Status | Size (bytes) | SHA-256 |
|---|---|---:|---|
| `client/src/data/storyChoices.js` | Edited | 4,015 (was 3,531) | `41ccab3835c79fffa3fc5429515eb85908d91fcd5f352a1885d2014c674fd675` |
| `tests/repo-check-fixes-alignment-lifestyle.test.js` | New | 7,514 | `8a0bce19118c598ed959cca60de08268775195e6e211b386c0be71469404a488` |
| `docs/pm/repo-check-fixes-alignment-lifestyle/BRIEF.md` | New (the brief, placed as asked) | 8,962 | `b1e9505b84ddbf535040e217f35236afbf51944125b85a8c0aa5072b70435db9` |
| `package.json` | Edited (version 1.0.214 → 1.0.215) | 1,398 | `fb30f3035b6c9bee5dc1853b6c1f8674052b2d44de92c69414521a37fbe3c11c` |
| `client/package.json` | Edited (version 1.0.214 → 1.0.215) | 427 | `7ee7e4ab6b1fa10f9d8408cef65135219749a8655d4cb798e005381b5ed1eeba` |
| `docs/pm/reports/repo-check-fixes-alignment-lifestyle-REPORT.md` | New (this report) | — | — |

No migrations. The `storyChoices.js` hash before this job was `6969b2187a01de9fe11b5219ab7b9bb8cd724910876be2e7eeec364d24d6a65f`.

## What was built, in gameplay terms

In the creator's Stage 5, choosing **Chaotic Good** or **Neutral Evil** now shows the Player's Handbook's own two sentences, example included. Choosing **Wretched, Squalid, Poor, Modest, Comfortable or Aristocratic** shows the book's sentence or two, followed by the daily cost, which is unchanged (for example "You spend frugally for your necessities. Cost: 2 sp a day."). The invented details are gone: the stables, huts, inns and meals, "whatever you can get away with", and Aristocratic's "(This is the least it costs.)". Every other alignment and lifestyle reads exactly as before.

The file's header comment now records that these eight entries are the book's wording as of this job. The original note ("summaries … NOT quotations") stays, because it still describes the entries this job did not touch.

### Per-item verdicts (live text next to the book text in the brief)

| # | Entry | Verdict | Live description now (`storyChoices.js`) | Book text in the brief |
|---|---|---|---|---|
| 1 | Chaotic Good | **Rebuilt** | Chaotic Good creatures act as their conscience directs with little regard for what others expect. A rebel who waylays a cruel baron’s tax collectors and uses the stolen money to help the poor is probably Chaotic Good. | Chaotic Good creatures act as their conscience directs with little regard for what others expect. A rebel who waylays a cruel baron's tax collectors and uses the stolen money to help the poor is probably Chaotic Good. |
| 2 | Neutral Evil | **Rebuilt** | Neutral Evil is the alignment of those who are untroubled by the harm they cause as they pursue their desires. A criminal who robs and murders as they please is probably Neutral Evil. | Neutral Evil is the alignment of those who are untroubled by the harm they cause as they pursue their desires. A criminal who robs and murders as they please is probably Neutral Evil. |
| 3 | Wretched | **Rebuilt** | You survive via chance and charity. You’re often exposed to natural dangers as a result of sleeping outside. | You survive via chance and charity. You're often exposed to natural dangers as a result of sleeping outside. |
| 4 | Squalid | **Rebuilt** | You spend the bare minimum for your necessities. You might be exposed to unhealthy conditions and opportunistic criminals. | You spend the bare minimum for your necessities. You might be exposed to unhealthy conditions and opportunistic criminals. |
| 5 | Poor | **Rebuilt** | You spend frugally for your necessities. | You spend frugally for your necessities. |
| 6 | Modest | **Rebuilt** | You support yourself at an average level. | You support yourself at an average level. |
| 7 | Comfortable | **Rebuilt** | You spend modestly for your necessities and enjoy a few luxuries. | You spend modestly for your necessities and enjoy a few luxuries. |
| 8 | Aristocratic | **Rebuilt** | You pay for the best and might have a staff that supports your lifestyle. Others notice your wealth and might encourage you to share it, either legally or otherwise. | You pay for the best and might have a staff that supports your lifestyle. Others notice your wealth and might encourage you to share it, either legally or otherwise. |

Rows 1 and 3 differ from the brief only in the apostrophe glyph (’ against '). Every other character matches.

### Confirmations the brief asks for

- **True Neutral is unchanged.** The key is still `'True Neutral'`, and its description, parenthetical included, is byte-identical: "You steer clear of moral questions and take no side, doing what seems best at the time. (The 2024 rules call this alignment Neutral.)". The test pins it, and also checks that no `'Neutral'` key appeared.
- **The Faith entries are unchanged.** `client/src/data/deities.json` and `Stage5GearStory.jsx` are not in this commit; `git status` showed only the files in the table above. Their current hashes are:
  - `deities.json`, 11,322 bytes: `e3665cad0c2e9c793c00d51fc9d1cee07dfe65e7a9afb9c4f511e9eccc716719`
  - `Stage5GearStory.jsx`, 51,512 bytes: `6f0eb98f6397ca0d0bdf5a396ff0812754f74f05b8ed423a9fab0d0d7b5ead55`

  The test also pins the Atheist and Agnostic descriptions.
- **Nothing else changed.** The other alignments (Lawful Good, Neutral Good, Lawful Neutral, Chaotic Neutral, Lawful Evil, Chaotic Evil, Unaligned) and the Wealthy lifestyle are byte-identical to before. The test holds their pre-job text. The keys, their order, the seven lifestyle names and order, and the daily costs (Free / 1 sp / 2 sp / 1 gp / 2 gp / 4 gp / 10 gp) are unchanged.

## Test results

**Full suite, my run on the PC, 2026-11-25:** `Files: 260/260 green  |  Assertions: 19717 passed, 0 failed`.
- Retried once after the Windows libSQL native crash mid-run (the runner's documented behaviour): creator-gaps-batch.test.js, which passed on the retry.

**Suites this job added or touched:**
- **repo-check-fixes-alignment-lifestyle (new): 35 passed, 0 failed.** It checks:
  - the 8 entries word for word against the brief's book text, with apostrophes compared normalised;
  - the two restored clauses, named;
  - the out-of-scope entries byte-identical to their pre-job text;
  - True Neutral's key and parenthetical;
  - keys, order and costs;
  - the Faith entries;
  - that the eight invented phrases are gone;
  - the header note.
- **Proof the test bites:** run against the pre-job file, it fails 19 checks (the 8 entries, the 2 clauses, the 8 phrases and the header). The 16 unchanged-entry checks pass, which shows they pin the original text.
- **creator-round-3** (the existing story-choice suite, which keeps costs equal to the server table): 46 passed, 0 failed.

**Client build** (`cd client && npx vite build`): built, no errors.

Zach's run is the gate, and this is not it.

## Cost and usage

I can't measure this session's cost or the usage left against the $30/month cap from inside the session. The cost is unmeasured, not zero.

## What was NOT done / still open

Every item in the brief is done. Out of scope and untouched, as the brief says:
- True Neutral's name;
- the costs;
- the other entries;
- Unaligned as a picker option;
- the Faith None / Atheist / Agnostic duplication, still open for Zach;
- the other three repo-check jobs (tools, feats, spells).

**Fix-as-you-find-it:** nothing found. The same descriptions are not copied anywhere else in the repo. A search for the replaced phrases outside `storyChoices.js` found only unrelated text: a Bad Reputation background feature and a theme flaw prompt, both using "get away with" in their own meaning.

## Decisions made inside the brief's latitude

1. **Typographic apostrophes (’) in "baron’s" and "You’re".** The file and the Stage 5 screen already use ’, so I kept it, and the test compares apostrophes normalised. *Reversal:* trivial. Change the two characters to ' and the test still passes.
2. **The header note** is added beneath the original note, not in place of it, so the original still describes the untouched entries, as the brief says. *Reversal:* trivial (comment only).

## Anything needing Zach's decision

None. The Faith duplication stays open from earlier jobs, and this brief leaves it out of scope.

## Verification evidence

- **Commit:** the hash is recorded in the commit that follows this report (`Report: record … commit`), on branch `phase-4-hybrid-combat`, in the PC repo at `E:\DnD Meta Game\dnd-meta-game`, pushed to origin.
- **File hashes:** in the Files changed table above.
- **Tests:** `npm test repo-check-fixes-alignment-lifestyle` gives 35 passed, 0 failed. The full `npm test` gives 260/260 files green.
- **At :5173:**
  1. Run `npm run dev` and open http://localhost:5173. Start a new character and go to Stage 5 (Gear & Story).
  2. In **Alignment**, pick Neutral Evil. The text under it reads "Neutral Evil is the alignment of those who are untroubled by the harm they cause as they pursue their desires. A criminal who robs and murders as they please is probably Neutral Evil."
  3. Pick Chaotic Good. It ends "…uses the stolen money to help the poor is probably Chaotic Good."
  4. Pick True Neutral. It still reads "…(The 2024 rules call this alignment Neutral.)".
  5. In **Lifestyle**, pick Aristocratic. It reads "You pay for the best and might have a staff that supports your lifestyle. Others notice your wealth and might encourage you to share it, either legally or otherwise. Cost: 10 gp a day.", with no "(This is the least it costs.)".
  6. Pick Poor. It reads "You spend frugally for your necessities. Cost: 2 sp a day."
