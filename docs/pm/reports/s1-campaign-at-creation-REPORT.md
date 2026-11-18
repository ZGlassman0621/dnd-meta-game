# Report — S1: campaign gate for play

Builder: Claude Code (Opus 5.5). Brief: `docs/pm/s1-campaign-at-creation/BRIEF.md`.
Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.199 → **1.0.200**.
Commit: `ee70403` (the build); a follow-up commit adds this line.

## Understanding
The project is a solo D&D 2024 "forever game": one human player character; the DM, NPCs, companions and enemies are played by an AI (gemma4:12b on the PC) in a persistent world. A campaign is what holds that world for a character: session memory (the chronicle), the shops, and the calendar.

Audit finding S1: a character created without joining a campaign could still play. It got no session memory and no shop, and worse, its time moved **every other character's** calendar, because the campaign-less clock was copied onto all characters in the database. This job closes Play to a character with no campaign (client and server), proves and enforces that no character's play moves another character's clock, and leaves campaign characters playing exactly as before. Nothing auto-creates a campaign; creation is unchanged.

**Where my understanding differs from the brief (all within its latitude):**
1. **More campaign-less clock paths than the audit listed.** Besides session play, three **out-of-session** actions advance time through the same service for any character: copying a spell into a spellbook, replacing a lost spellbook, and copying into a backup book (`server/routes/character.js:5625, 5975, 6127`). For a campaign-less character each of those advanced the shared fallback clock and copied the date onto every character. These are legitimate actions with or without a campaign, so I **scoped them per-character** rather than refusing them (item 4).
2. **Session routes beyond `/start`.** The survey found 14 more session routes that play, shop, move time or record memory. All refuse a campaign-less session. Housekeeping (read a session, pause, abort, delete) stays open, so a stranded old session can still be closed.
3. **Two existing suites asserted the old behavior** (`rest-time`, `spellbook-routes`: a campaign-less character's rest or spell copy advanced the shared clock) and one (`session-end-world-tick` test 7: a campaign-less session ended normally). They now assert the new rules with the same strength (exact hours), not weaker.

## Verdict
**BUILT + GREEN** on the builder's run (Files 246/246 green, assertions 19,611 passed, 0 failed). Not a gate: Zach's own `npm test` and the `:5173` checks gate it.

## Per-item verdicts
| Item | Verdict | Evidence |
|---|---|---|
| 1. Survey first | **Built** | Every audit evidence point verified against live bytes before any edit (table below, with the drifted line numbers); every session-start path and every clock writer listed. |
| 2. Gate Play in the client | **Built** | Nav "Play" is visible but disabled for a campaign-less character, with "Create or join a campaign to play" beside it as a link to the Campaign page; the home-screen "AI Dungeon Master" card shows the same reason and opens Campaign; the Play view itself shows a gate panel if reached any other way; after joining a campaign, Play waits for the refreshed character. |
| 3. Refuse server-side | **Built** | `POST /api/dm-session/start` refuses before anything is written or assembled: `409 {"error":"This character is not in a campaign. Create or join a campaign to play.","code":"CAMPAIGN_REQUIRED"}`. The same refusal is on 14 session routes and on the meta-game time advance. |
| 4. Clock invariant | **Built** | `scheduleService` no longer copies the campaign-less fallback clock onto any character (root fix); campaign-less out-of-session time costs move only that character; campaign clocks unchanged. Mechanism and full caller inventory below. |
| 5. Prelude | **Exempt by construction, with proof and bounds** | See "Prelude finding". |
| 6. CLAUDE.md debt line | **Updated, not removed** | Creation still does not set `campaign_id`, so the line now states the new invariant (play requires a campaign; the clock invariant; the Prelude exemption). |
| 7. Tests | **Built** | New `tests/s1-campaign-gate.test.js` (53/53); `session-end-world-tick` test 7, `rest-time` and `spellbook-routes` updated to the new rules. |
| 8. Prove at `:5173` | **Server half proven live; UI clicks not done by me** | No browser tool in this session. I booted the real server with the real gemma4:12b against a throwaway database and drove the repro and a short campaign session over HTTP (results below). The exact click steps are in "How to verify". |

## Item 1 — survey

### The audit's evidence, checked against live bytes (audit line numbers were from `6084b18`)
| Audit point | Live location (before this job) | Confirmed |
|---|---|---|
| (a) Client only *suggests* a campaign after creation | `client/src/App.jsx:217-224` (`handleCharacterCreated` opens the Campaign page) | yes |
| (a) Nav "Play" always available | `client/src/components/NavigationMenu.jsx:43` (`{ key: 'showDMSession', label: 'Play' }`), disabled only when no character is selected | yes |
| (a) Second Play entry (not in the audit) | `client/src/App.jsx:609` home-screen "AI Dungeon Master" card | yes |
| (b) Session start adds world context only `if (character.campaign_id)` | `server/routes/dmSession.js:688, 698, 731, 1150` | yes |
| (c) Chronicle refuses without a campaign | `server/services/storyChronicleService.js:63-70` | yes |
| (c) Shop 404 "No campaign found for this character" | `server/routes/dmSession.js:2519` (`generate-merchant-inventory`) | yes |
| (d) Campaign-less clock copied onto **all** characters | `server/services/scheduleService.js:70-73` (`mirrorToCharacters`, the `SELECT … FROM characters` branch), called from `advanceDays:102`, `advanceHours:116`, `setCurrentDay:127`, `setClockDate:144` | yes |

### Every session-start path
| Path | Where | Disposition |
|---|---|---|
| DM session start | `POST /api/dm-session/start` (`server/routes/dmSession.js:480`, insert at `:1187`) | **Gated** (409 before any write). |
| Prelude session start | `POST /api/prelude/:characterId/sessions/start` (`server/routes/prelude.js:200`) → `preludeSessionService.js:223` (`session_type = 'prelude_arc'`) | **Exempt by construction** (Prelude finding). |
| Imported campaign | `server/services/campaignImportService.js:338` | Not a play path: it writes **completed** history rows (`status 'completed'`) for a character the import creates inside the imported campaign (`campaign_id` set at `:247`). No change. |
| Time-based "adventures" | `server/routes/adventure.js:104` (start), claim writes the date at `:335` | Not a DM session; the claim writes **only that character's** date (`WHERE id = ?`), so it never moves another character. No change. |

### Every session-scoped route, and what it does now
- **Refused for a campaign-less session (409 `CAMPAIGN_REQUIRED`):** `POST /:sessionId/message`, `/end`, `/merchant-transaction`, `/generate-merchant-inventory`, `/restock-merchant`, `/adjust-date`, `/inject-context`, `/rest-narrative`, `/advance-turn`, `/apply-inventory`, `/resume`, `/claim`, `/extract-npcs`, and `GET /:sessionId/merchants`.
- **Left open (housekeeping, no play effects):** `GET /:sessionId`, `POST /:sessionId/pause`, `POST /:sessionId/abort`, `DELETE /:sessionId`, and the character-history routes. A campaign-less character with an old active session can still close it.
- **Also refused:** `POST /api/meta-game/advance-time/:characterId` (the in-session meta-game tab's time skip, which also runs the living-world tick).

## Item 4 — the clock invariant

### Mechanism (and why)
1. **Root fix in `server/services/scheduleService.js`:** `mirrorToCharacters` now returns immediately for the campaign-less fallback clock. It used to copy that clock onto every character in the database; now the mirror only ever reaches the characters of the campaign being advanced. This alone makes it impossible for any campaign-less path to move another character.
2. **Per-character scope for legitimate campaign-less time costs:** `getClock`, `advanceDays` and `advanceHours` accept `{ characterId }`. With no campaign and a named character, only that character's `game_day` / `game_year` / `game_hour` move, and the shared fallback row is left alone. `advanceClockForSession` (`server/services/restTimeService.js`) passes the character through. I chose scoping over refusal because spellbook copying and its siblings are character-sheet actions that make sense before a character joins a campaign, and the brief allows scoping "if a legitimate path needs it".
3. **Refusal for session paths:** every session path requires a campaign (items 3 and the routes above), so a campaign-less session can no longer reach the clock at all.
4. **Campaign characters unchanged:** the campaign branch of every function is untouched.

### Complete `scheduleService` caller inventory
**Writers** (`advanceDays`, `advanceHours`, `setCurrentDay`, `setClockDate`):
| Caller | Reached from | Disposition |
|---|---|---|
| `server/routes/dmSession.js:1191` `setClockDate(cid, …)` | `/start` | Behind the S1 gate: always a campaign. Unchanged. |
| `server/routes/metaGame.js:404` `advanceHours(…)` | `POST /api/meta-game/advance-time/:id` | Campaign-less: **refused (409)**. Campaign: unchanged. |
| `server/services/downtimeService.js:93` `advanceDays(…)` (`shortSkip`) | `sessionEndService.js:64` ← `POST /:sessionId/end` | Behind the gated `/end`: always a campaign. Unchanged. |
| `server/services/restTimeService.js:249` `advanceHours(…)` (`advanceClockForSession`) | `advanceTimeForSession` (`:260`) ← the `[TIME_ADVANCE]` marker handler (`:952`) and the spellbook routes `character.js:5625` (copy), `:5975` (replace), `:6127` (backup); `applyRest` (`:721`) ← the `[REST]` marker handler (`:970`) | Marker handlers run only inside a gated session: always a campaign, unchanged. Spellbook routes for a campaign-less character: **per-character scope** (only that character moves). |
| `setCurrentDay` | no production caller (tests only) | With no campaign it now advances the fallback row without copying it onto characters. |

**Readers only** (`getClock` / `getCurrentDay`, no writes): `server/routes/companion.js:25`, `server/services/companionActivityService.js:68`, `dungeonGenerationService.js:56`, `livingWorldService.js:10`, `sessionEndService.js:12`, `timeEvolutionService.js:54`.

**Other date writes checked:** `server/routes/dmSession.js:3254` (session end, `WHERE id = ?`) and `server/routes/adventure.js:335` (adventure claim, `WHERE id = ?`) each write one character only. `server/routes/downtime.js:1684` (`applyDowntimeRest`) moves no clock (asserted by `rest-time`).

## Prelude finding — exempt by construction, bounded
- **The survey shows a legitimate campaign-less start:** Prelude characters are created with no campaign (`server/services/preludeService.js:263, 337`), and Prelude sessions start only for a character in the Prelude phase (`preludeSessionService.js:144`, `creation_phase !== 'prelude'` refused) with their own session type (`prelude_arc`). The Prelude is the pre-campaign prologue (post-MVP); it has to run before a campaign exists.
- **The exemption is structural, not a flag:** Prelude sessions run through their own router (`server/routes/prelude.js`), which the gate does not touch.
- **Bounds, proved:** a scan of `server/routes/prelude.js` and all 12 `server/services/prelude*.js` files finds no call into the clock (`scheduleService`, `advanceDays/Hours`, `setClockDate`), the chronicle (`storyChronicleService`, `generateSessionChronicle`) or the shop (`merchantService`, `merchant_inventories`). `campaign_id` appears there only as a logging field. And a Prelude session sent to the DM routes is refused like any campaign-less session (asserted).

## Files changed
| File | New / edited | SHA-256 | Bytes |
|---|---|---|---|
| `server/utils/campaignGate.js` | new | `8d0e05613051d1fc13f1ef3087a8d997fb09ee5d7ac236cd5f3c59a54e7c694f` | 2,862 |
| `tests/s1-campaign-gate.test.js` | new | `6071d1b23f5b04b2030a3b3d08b877aa97d7a49276275a58845a48b415c1f4bf` | 16,808 |
| `docs/pm/s1-campaign-at-creation/BRIEF.md` | new | `f62ca46dd8b995f957e6aa7a64b3cd7ed269a8e400dcbfe2e996fa3aead9445c` | 8,467 |
| `CLAUDE.md` | edited | `852220117023e8ae20ca1c4ffa7a688b7dfb13f09ecccee4182a86328b495db6` | 25,162 |
| `client/package.json` | edited | `07029bacbdffc1014c218f0b5fd4e97df5a4f2597c4cbd8b958bb2f344edf128` | 427 |
| `client/src/App.jsx` | edited | `8bb9d49dc66e8d0586ee81dff99cd8209a3fc6c959a4dbfd9e034f8594b8eabd` | 30,515 |
| `client/src/components/NavigationMenu.jsx` | edited | `38a0e9717aed091c96b3e568b434c23eeb2797bc8b0849315f58ba5b9a901501` | 4,821 |
| `package.json` | edited | `b9d4fbdec0f97b0a328ef5941624d03991b3202bef8e977121f01d8da6384581` | 1,398 |
| `server/routes/dmSession.js` | edited | `306f48daf21fe3ea12db21e0bd5e9b170d216dca868aa3078148852f1d1783f9` | 195,642 |
| `server/routes/metaGame.js` | edited | `308b923e0b30e1c8a8108dc51241d2a051392ae959beff9895ef89b0d7f93795` | 18,063 |
| `server/services/restTimeService.js` | edited | `c57f566ece89fdfa701b581324f77d3f20e269721633a74b29e2e9a06985b980` | 50,903 |
| `server/services/scheduleService.js` | edited | `a2b02043a7ebb6b4642c0c2661f177861fdbe1f0046725c47be2ea7615eec0f7` | 12,243 |
| `tests/rest-time.test.js` | edited | `cbc065c7635043dbe440bf15d1e0063a20c63a35f08f350367a3a39c1eb81205` | 64,217 |
| `tests/session-end-world-tick.test.js` | edited | `28225bf0176034b8438ccb220c313e696ccbe6ecfe80d0a309835a1c4c73c2da` | 16,072 |
| `tests/spellbook-routes.test.js` | edited | `87fb1576d90f0c4ef27785aa755a76d19b12b7e0e8f565bb491dbeac8469bfd2` | 134,292 |

No migration, no backfill, no data change.

## What was built (in play)
- **A character with no campaign:** the nav shows "Play", greyed out, with "Create or join a campaign to play" next to it; clicking that phrase opens the Campaign page. The home screen's "AI Dungeon Master" card reads the same and also opens Campaign. Right after creating a character, the Campaign page still opens first, and now it is the required path. Calling the server directly gets a clear refusal; nothing is written, no model is called and no calendar moves.
- **A character in a campaign:** unchanged. Sessions start, turns run, the shop answers, session end writes the chronicle, and the calendar moves for that campaign only.
- **Calendars:** no character's play moves another character's calendar. A campaign-less character can still copy a spell into its spellbook; the hours spent move only its own date.

## Test results
- **Full `npm test` on the PC, after all edits:** Files **246/246 green**, assertions **19,611 passed, 0 failed**. (The file count is 245 + the new `s1-campaign-gate`.)
- An earlier full run found two red files, `rest-time` (4 assertions) and `spellbook-routes` (5): both asserted that a campaign-less character's rest or spell copy advanced the **shared** clock, the very behavior S1 removes. They now read the character's own clock with the same exact-hour checks: `rest-time` **206/0**, `spellbook-routes` **494/494**.
- Windows runner notes from the final run: `creator-next-stage5-validation`, `creator-next-stage6-commit` and `stage2-validation-wiring` were each retried once after a native crash mid-run and passed; `migration-schema-contract` and `subclass-batch1` counted `pass*` (libSQL exit crash after all assertions passed).
- **Touched suites, own counts:** `s1-campaign-gate` **53/53** (groups: start refused with no row, no model call, no clock move; 14 session routes refused, session untouched, no chronicle attempt, housekeeping open; campaign character's turn, shop and start still work; clock invariant (campaign advance moves only that campaign, campaign-less cost moves only that character, the fallback row is never copied onto characters); meta-game advance refused; Prelude bounds; client gate). `session-end-world-tick` **35/35** (test 7 now: campaign-less time moves only itself; `/end` refused, session left open; tests 1-6 still prove a campaign session's clock advance, world tick and chronicle). `rest-time` 206/0, `spellbook-routes` 494/494.
- **Campaign chronicles still write:** `session-end-world-tick` drives a real `/end` for campaign characters (unchanged tests 1-6) and the live probe below wrote a chronicle row.
- **Static import check:** `server/` 1,882 named imports across 430 files, **0 problems**. **Client build:** succeeds.

## Live proof (item 8): real server, real model
The real `server/index.js` booted on port 3077 against a throwaway database, with Ollama and gemma4:12b running, driven over HTTP (script: scratchpad `s1-probe.mjs`; it stopped only its own child process). Output, verbatim where quoted:

```
server up: true
create campaign: 201 1

--- repro: a character with no campaign ---
POST /api/dm-session/start (no campaign): 409 {"error":"This character is not in a campaign. Create or join a campaign to play.","code":"CAMPAIGN_REQUIRED","characterId":1}
session rows for that character: 0
POST /api/meta-game/advance-time (no campaign): 409 CAMPAIGN_REQUIRED
any character date changed? no

--- a campaign character plays a short session (real gemma4:12b) ---
POST /start: 200 219.8 s session 1
opening (first 240 chars): The morning sun over Daggerford is crisp, casting long, sharp shadows across the cobblestone streets. The air carries the scent of woodsmoke and damp earth, a common perfume in this walled frontier town. To your left, the rhythmic *clink-cl
POST /message: 200 2.3 s
reply (first 240 chars): The trader is a stout man with a thick beard that seems to have more gray than brown in it. He leans against a heavy wooden table piled with assorted goods—bundles of dried herbs, jars of preserved meat, and several coiled ropes of various 
GET /merchants (shop answers): 200
POST /message (rest): 200 0.5 s
POST /end: 200 12.5 s
chronicle rows written for the session: 1
dates before /end: ["TEST_S1 Loner (no campaign): day 100 1492 8h","TEST_S1 Player (in campaign): day 211 1492 8h","TEST_S1 Bystander (no campaign): day 100 1492 8h"]
dates after  /end: ["TEST_S1 Loner (no campaign): day 100 1492 8h","TEST_S1 Player (in campaign): day 211 1492 8h","TEST_S1 Bystander (no campaign): day 100 1492 8h"]
campaign-less characters moved by the campaign session? no

server log lines mentioning errors: 0
```

What it shows: the campaign-less character is refused at session start (no session row) and at the meta-game time advance, and no character's date moves. The campaign character starts a session on the real model (219.8 s, including a cold model load), plays two turns (2.3 s and 0.5 s), opens the shop (200), and ends the session (12.5 s) with **one chronicle row** written; neither campaign-less character's date moved. The campaign character's date did not advance at `/end` because no in-game time passed during the two turns (session end only measures in-session time; unchanged behavior).

## Not done / still open
- **`:5173` click-through:** not done by me; there is no browser tool in this session. The server half is proven live above; the UI half is covered by the static client checks in `s1-campaign-gate` group 7 and the steps below.
- **The return-loop test suite** is a separate job (out of scope), now unblocked.
- Cost and usage against the $30/month cap: not measurable from inside the session.

## Decisions made (reversible, for veto)
1. **Per-character clock for campaign-less out-of-session time costs** (spellbook copy, replace, backup) instead of refusing them. Reversal: refuse those three routes for a campaign-less character instead (small), or require a campaign for them.
2. **Housekeeping routes stay open** for campaign-less sessions (read, pause, abort, delete) so old sessions can be closed. Reversal: add the middleware to them (one word per route).
3. **409 Conflict** with code `CAMPAIGN_REQUIRED` as the refusal. Reversal: change the status in one helper (`server/utils/campaignGate.js`).
4. **The meta-game time advance is refused** for a campaign-less character, as a session tool. Reversal: remove five lines in `server/routes/metaGame.js`.
5. **The fallback clock row still advances** when called with no campaign and no character (only campaign-less companion schedules use it), but it is never copied onto characters. Reversal: none needed for the invariant.
6. **Version bump to 1.0.200.** Reversal: two lines.

## Needs Zach's decision
None. Zach's part is the gate.

## How to verify
**Gate:** `npm test` on the PC (expect 246 files).
**At `:5173` (never `:3000`), with `npm run dev`:**
1. Create a new character and, when the Campaign page opens, **don't** create or join a campaign. Click **Home**.
2. In the top nav, **Play** is greyed out and can't be clicked, with **"Create or join a campaign to play"** beside it. On the home screen, the **AI Dungeon Master** card says the same. Clicking either the phrase or the card opens the **Campaign** page.
3. On the Campaign page, create a campaign for this character (or attach it to an existing one). Use **Play**: the session setup opens normally.
4. Start a short session: send a turn, open the shop if offered, then end the session. It should behave exactly as before, and the session summary should appear when you come back.
