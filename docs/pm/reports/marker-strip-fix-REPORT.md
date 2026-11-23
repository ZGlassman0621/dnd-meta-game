# Report — marker-strip fix: no raw markers in the player's chat

Builder: Claude Code (Opus 5.5). Brief: `docs/pm/marker-strip-fix/BRIEF.md`.
Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Version 1.0.203 → **1.0.204**.
Commit: recorded by a follow-up commit (see the "Commit:" line, filled in after the build commit).

## Understanding
The project is a solo D&D 2024 "forever game": one human player character, with the DM, NPCs, companions and enemies played by an AI (gemma4:12b on the PC). The DM drives the engine by writing short bracketed markers into its narration (`[SET_ROOM: …]`, `[COLD_SCENE: …]`). The engine reads each marker and does the real work, and the marker is supposed to be removed before the player reads the text.

In Zach's `:5173` session the markers showed up in chat. The cleanup was a hand-kept list that knew only 28 of the 126 marker types. This job replaces that list with one strip generated from the marker registry, so every marker, including any taught later, is removed from what the player reads. What the engine does stays exactly the same.

**Where the live build differs from the brief:**
1. **The leak was on four paths, not one.** Besides the turn narrative (the hand list), three other player-facing paths showed DM text with no stripping at all:
   - the session-start opening;
   - the history replayed when a session is reloaded;
   - the "Previously on…" resume recap, which is written with the DM's own prompt.

   All three had the same leak, so all three now use the same strip (fix-as-you-find-it).
2. **One of the 28 hand-list markers isn't a marker.** `SKILL_CHECK` is not in `MARKER_SCHEMAS`, and nothing in the codebase teaches it, handles it or mentions it apart from that one strip line: a dead legacy name, superseded by `ROLL_REQUEST`. The brief says the strip derives from the registry alone, so `SKILL_CHECK` is no longer stripped. The other 27 still are. This is a decision for veto, below.
3. **A different leak, reported as open (not fixed):** a reloaded session also shows the engine's system notes (`[SYSTEM NOTE - DO NOT RESPOND TO THIS]: …`) as if the player had typed them. They are stored as messages from the user's side, and they are not markers, so the marker strip can't remove them. It needs a different fix (below).

## Verdict
**BUILT + GREEN** on the builder's run (Files 250/250 green, assertions 19,652 passed, 0 failed). Not a gate: Zach's combined `npm test` and the `:5173` checks gate it.

## Per-item verdicts
| Item | Verdict | Evidence |
|---|---|---|
| 1. Survey | **Built** | Counts, pipeline position, Prelude evaluation and every player-facing path are below. |
| 2. One generated pattern | **Built** | `server/services/markerStrip.js` builds the pattern from `Object.keys(MARKER_SCHEMAS)`. The 28 hand lines are deleted, replaced by one call at the same point: after the engine reads the markers, before `reconcileTurn`. Schema names only, with or without a payload, case-insensitive. The same strip is applied to the session opening, the reload history and the resume recap. |
| 3. Tests | **Built** | New `tests/marker-strip.test.js`, **64/64**: every one of the 126 markers in 5 placements; the 27 old schema markers; the fences; the route order; a real turn with clean text whose effects still apply; reload, opening and recap. `rest-consolidation-client` (pinned the old lines) re-pointed, 42/42. |
| 4. Live proof | **Built** | Real server + gemma4:12b: the opening, the tavern fight, cover, the cold march and the soaking. **0 markers reached the player**, while the model emitted 12 across the four turns, and cold and soaked still applied (output below). |

## Item 1 — survey
- **`MARKER_SCHEMAS`:** **126** schemas, enumerated as `Object.keys(MARKER_SCHEMAS)` (the module exports the object directly; `markerSchemas.js`). Matches the H1 report's 126.
- **The hand list:** `server/routes/dmSession.js:2189-2227` at head `e66a400`. **28** strip lines: 27 schema markers plus `SKILL_CHECK`, which isn't a schema. In order:
  - MERCHANT_SHOP, MERCHANT_REFER, ADD_ITEM, LOOT_DROP, COMBAT_START, COMBAT_END, REST, TIME_ADVANCE, HP_CHANGE, SKILL_CHECK;
  - CONDITION_ADD, CONDITION_REMOVE, WEATHER_CHANGE, SHELTER_FOUND, SWIM, EAT, DRINK, FORAGE, RECIPE_FOUND, MATERIAL_FOUND;
  - CRAFT_PROGRESS, RECIPE_GIFT, MYTHIC_TRIAL, PIETY_CHANGE, ITEM_AWAKEN, MYTHIC_SURGE, PROMISE_MADE, PROMISE_FULFILLED.
- **Leaked before the fix:** **99 of 126** schema markers were never stripped (126 − 27). Among them: `ATTACK`, `ENEMY_ATTACK`, `SET_COVER`, `ROLL_REQUEST`, `SPELL_CAST`, `MOVE`, `TURN_ADVANCE`, every H1-taught marker and every class-feature marker.
- **Pipeline position:**
  1. `processResponseMarkers` dispatches the markers to the engine (`dmSession.js:1902`).
  2. The death-save step.
  3. The strip (now `:2195`, `let cleanNarrative = stripMarkers(result.narrative);`).
  4. `reconcileTurn(cleanNarrative, …)`.
  5. The response's `narrative`.

  Unchanged; a test pins the order. The stored history (`dm_sessions.messages`, the transcript) keeps the markers, as before.
- **The Prelude catch-all, evaluated and not adopted:** `preludeMarkerDetection.js:555` is `/\[[A-Z][A-Z_]{2,}(?::[^\]]*)?\]/g`, which removes any uppercase word in brackets. In the main game that would also remove `[OOC: Would you like to formally recruit …?]`, which the DM is taught to show the player when an NPC wants to join (`dmPromptBuilder.js`, COMPANION RECRUITMENT). That breaks the brief's fence, so the pattern is built from the registry instead. The Prelude flow itself already strips everything (it has its own catch-all), so it had no leak.
- **Every other path that shows DM text to the player:**

| Path | Before | Now |
|---|---|---|
| Turn narrative (`POST /:sessionId/message`) | 28 hand lines | generated strip |
| Session-start opening (`POST /start` → `openingNarrative`) | **not stripped** | generated strip (display only; stored history unchanged) |
| Reloaded session history (`GET /:sessionId` → client) | **raw stored history, markers included** | the server adds `session.display_messages` (DM turns stripped); the client shows it. `session.messages` is unchanged |
| Resume recap (`POST /:sessionId/resume` → `recap`) | **not stripped** (written with the DM's prompt) | stripped before saving and at the response, so a recap saved before this fix is cleaned too |
| Prelude flow | own catch-all | unchanged, no leak |
| Session transcript, chronicle | no screen shows the transcript (searched `client/src`); chronicles are written by the summary model from the history | not changed. Markers in a chronicle were not observed and not tested; low risk, noted |
| Reloaded history: system notes | shown as if the player typed them | **open**, different fix (below) |

## Files changed
| File | New / edited | SHA-256 | Bytes |
|---|---|---|---|
| `server/services/markerStrip.js` | new | `b3b1d6076bd48bebfa55a2f86bc701104e354b109de64ccb255321fe875df780` | 2,071 |
| `server/routes/dmSession.js` | edited | `88c7ad297870bb9275366fd22c5eb4ba8406a5660ed7c9e0dac8a79486652ec6` | 194,723 |
| `client/src/components/DMSession.jsx` | edited | `0a7fe0a9933d0fc6f541fba0760dc06f2ecbd8f4a0eb6a3bfc7673a1a16a4d2e` | 130,566 |
| `tests/marker-strip.test.js` | new | `2e5111c846dfc9d7cfe7a0489ef1d7286cdb76b434ec3afb02207d09ad5ece27` | 10,686 |
| `tests/rest-consolidation-client.test.js` | edited | `7c87f331ca54504ed886f0b462b9c89a4f38f540a4ec1a832ca0cb183b4084b4` | 13,609 |
| `CLAUDE.md` | edited (debt line) | `3197f3f0439054fab3d4b42ec03d25ea27a9bb9c576c43147cf3ef097d712bb1` | 25,406 |
| `docs/pm/marker-strip-fix/BRIEF.md` | new | `26ad1c845ea674326d090061661718d1f0cc63f5db52ab4748db4e9aaef7d44a` | 9,541 |
| `package.json` | edited | `ea3a43431b5778dbe591ecc5857d63e825361330151148111f385efb57482837` | 1,398 |
| `client/package.json` | edited | `cf8bf6ebc5b6960ace9a33e297cc24c2cf23b9d17daa31b00a9b89d8e9281c69` | 427 |

No marker schema, handler, validation, dispatch or engine behaviour changed. No migration.

## What was built (in play)
- **Chat is clean fiction.** Fights, cover, enemy attacks, rolls, the cold, getting wet: the DM's bracketed instructions no longer appear in the chat, in the session opening, in a reloaded session, or in the "Previously on…" recap.
- **The effects still happen.** The engine reads the markers before they're removed.
- **New markers are handled automatically.** Any marker taught in future is hidden with no further work.
- **Normal bracketed writing still shows**, such as the DM asking "[OOC: Would you like to recruit Mira?]".

## Test results
- **Full `npm test` on the PC, after all edits:** Files **250/250 green**, assertions **19,652 passed, 0 failed** (249 files before, plus `marker-strip`).
  - Windows runner notes: `creation-solidification` and `wizard-validator-wiring` were each retried once after a native crash mid-run and passed; `perception-pre-roll` and `subclass-batch2` counted `pass*`.
- **Earlier full run:** 249/250. `rest-consolidation-client` failed 3 assertions: it pinned the deleted hand-list lines by their exact source text, and ran private copies of their regexes. It now pins the generated strip, with the same sample texts and a mutation check that removing the strip call fails the pin; 42/42.
- **New suite `marker-strip`, 64/64:**
  - (a) the stripped names are exactly `Object.keys(MARKER_SCHEMAS)` (126), and the pattern is global and case-insensitive.
  - (b) all 126 markers are stripped in 5 placements each (with payload, bare, lower case, spaced colon, at the end), with surrounding prose intact; Zach's exact tavern and cold markers vanish.
  - (c) the 27 old schema markers are still stripped, and so are bare `[COMBAT_END]` / `[REST]`; `SKILL_CHECK` is pinned as no longer stripped.
  - (d) fences: `[OOC: …]`, `[COMBAT_STARTED: …]`, `[SET_ROOMS: …]`, `[HP: 5]`, `[a scrawled note]`, `[Thorne nods]`, `[REDACTED]` and `[ATTACKS: 2]` all survive.
  - (e) the hand lines are gone, and the order is dispatch → strip → reconcile. A real turn through the route over the LLM harness returns clean narration, while `COLD_SCENE` and `COLD_WET` still applied and the stored history kept the markers.
  - (f) the reload display copy is clean and the raw history is unchanged; the opening and the recap are stripped; the client reads the display copy.
- **Static import check:** `server/` 1,891 named imports, **0 problems**. **Client build** succeeds.

## Live proof (item 4): real server, real model
The real `server/index.js` was booted on port 3082 against a throwaway database, with Ollama and gemma4:12b running. The script is `strip-probe.mjs` in the session scratchpad; it stopped only its own child process. It checks the text the route actually returns for any `MARKER_SCHEMAS` marker. Output, verbatim:

```
server up: true
POST /start: 200 21.7 s | markers in the opening the player sees: []

turn: "I'm drinking in the tavern common room when two thugs draw knives and attack me. I fight."
  HTTP 200 2.6 s
  markers the model emitted: [COMBAT_START: Enemies="Thug 1 (HP 12, AC 13, ATK +4, DMG 1d6+2), Thug 2 (HP 10, AC 12, ATK +3, DMG 1d4+1)"]
  markers in the narrative the player receives: NONE
  narrative (first 220 chars): "The atmosphere inside *The Broken Hull* is a thick soup of pipe smoke and the low thrum of a half-dozen voices. You sit at a scarred wooden table, a mug of bitter, lukewarm ale in your hand, the condensation slick agains"

turn: "I duck behind the bar for cover and swing at the nearest thug."
  HTTP 200 2.4 s
  markers the model emitted: [SET_COVER: Target="TEST_STRIP" Cover="full" Feature="Bar"] [ENEMY_ATTACK: Enemy="Thug 2" Target="TEST_STRIP" Multiattack="true"] [TURN_ADVANCE]
  markers in the narrative the player receives: NONE
  narrative (first 220 chars): "The broader of the two men, Thug 2, sees you duck behind the heavy oak counter. He snarls, his knife gleaming in the firelight. He lunges forward, but the thick, grease-slicked wood of the bar serves as a wall between yo"

turn: "After the fight, I leave town and march north into frozen mountain passes — snow and bitter wind — for four hours."
  HTTP 200 3.8 s
  markers the model emitted: [TIME_ADVANCE: Hours=4 Reason="marching north into the mountains"] [COLD_SCENE: BaseLevel=3] [ROLL_REQUEST: Save="Constitution" DC=13 Looks="the wind is a physical weight against your chest, biting through your layers and numbing your fingers"]
  markers in the narrative the player receives: NONE
  narrative (first 220 chars): "The tavern door groans on its hinges as you push through, leaving the warmth and the lingering tension of the brawl behind. The transition is immediate; the air outside is a sharp blade of frost that cuts into your lungs"

turn: "The ice breaks and I fall into a frozen stream, soaked through. I keep walking for an hour."
  HTTP 200 3.8 s
  markers the model emitted: [COLD_WET: Target="Player" Status="soaked"] [TIME_ADVANCE: Hours=1 Reason="pushing through the mountain pass"] [ROLL_REQUEST: Save="Constitution" DC=15 Looks="the water has stripped away your defenses, and the wind is now a relentless, freezing gale"]
  markers in the narrative the player receives: NONE
  narrative (first 220 chars): "The ground beneath your boots suddenly gives way with a sickening, muffled crack. The ice sheet shatters like glass, and the world tilts. You plunge into the water—a shock of liquid ice that steals the breath from your l"

--- reload (GET session) ---
display messages: 12 | markers in reloaded DM turns: NONE | markers kept in the stored history: 10

--- effects (engine state) ---
encounter room links: []
cold scene: {"baseColdLevel":3,"campfire":false,"insulatedTent":false,"blizzard":false,"magicalBlizzard":false,"elevation":0,"forceGoliathColdLevel0":false}
character: {"frost_exhaustion":1,"cold_wet_status":"soaked"}

TOTAL markers shown to the player across all turns: 0
server log lines mentioning errors: 0
```

What it shows:
- **No marker reached the player.** The model emitted 12 markers across four turns, including every kind Zach saw (`SET_COVER`, `ENEMY_ATTACK`, `COLD_SCENE`, `COLD_WET`, `TIME_ADVANCE`) plus `COMBAT_START`, `ROLL_REQUEST` and `TURN_ADVANCE`. None appeared in the opening, the four turns or the reloaded history.
- **The effects still applied.** The cold scene was set, the hero took Frost Exhaustion, and the soaked status was stored. The stored history still holds its 10 markers.
- **No room this time.** The model didn't emit `SET_ROOM` in this run, so no room was linked. That is the model's choice, not this fix.

## Not done / still open
- **System notes on reload (open; needs a different fix).** The engine's notes to the DM (`[SYSTEM NOTE - DO NOT RESPOND TO THIS]: …`) are stored as messages from the user's side, and a reloaded session shows them as if the player had typed them. They aren't markers, so the schema strip correctly leaves them alone. The fix is to leave system-note messages out of the reload display copy; a small brief.
- **Chronicles / summaries:** written by the summary model from history that contains markers. No marker was observed in one, and none is tested; not changed.
- **Out of scope as briefed:** the marker-result feedback route and the combat-loop diagnosis (H1 report, Finding 2).
- **`:5173` click-through:** not done by me; there is no browser tool in this session. Steps below.
- **Cost and usage against the $30/month cap:** not measurable from inside the session.

## Decisions made (reversible, for veto)
1. **`SKILL_CHECK` no longer stripped.** It is not a schema and nothing teaches or handles it; the brief requires a registry-only strip. Reversal: add a `SKILL_CHECK` schema, or one name to the strip (one line).
2. **Fixed the three other leaking paths** (session opening, reload history, resume recap) with the same strip, as fix-as-you-find-it. Reversal: three one-line edits plus the client fallback.
3. **Reload uses a new `display_messages` field** rather than changing `session.messages`, so anything reading the raw history is unaffected. The client falls back to `messages` against an older server. Reversal: small.
4. **The recap is stripped before saving as well as at the response.** It is display-only text. Reversal: one line.
5. **Whitespace kept exactly as the old list:** a removed marker takes its trailing whitespace with it, and the text is trimmed. Reversal: one pattern.
6. **Known edge, accepted:** a schema name that is also an English word, written alone in brackets in the DM's prose, is removed, for example `[Rest]` or `[Hide]`. The old list already did this for `REST`, `EAT`, `DRINK` and `SWIM`. Reversal: none sensible without losing a real marker.
7. **Version bump to 1.0.204.** Reversal: two lines.

## Needs Zach's decision
None. Zach's part is the combined gate (H1 + H2+H3 + this fix).

## How to verify
**Gate:** `npm test` on the PC (expect 250 files green). This gate runs combined with H1 + H2+H3.

**At `:5173` (never `:3000`), with `npm run dev`:**
1. Use a campaign character. Start a session in a town.
   - **Look for:** the opening narration has no bracketed marker text.
2. Type "I'm drinking in the tavern common room when two thugs draw knives and attack me. I fight." Then type "I duck behind the bar for cover."
   - **Look for:** the fight starts and the DM describes cover at the bar, with **no bracketed marker text anywhere in the chat**: no `[SET_ROOM: …]`, `[SET_COVER: …]`, `[ENEMY_ATTACK: …]` or `[COMBAT_START: …]`.
3. After the fight, type "I leave town and march north into frozen mountain passes — snow and bitter wind — for four hours."
   - **Look for:** the DM narrates the cold, and there is no `[COLD_SCENE: …]` or `[TIME_ADVANCE: …]` in the chat.
4. Type "The ice breaks and I fall into a frozen stream, soaked through. I keep walking for an hour."
   - **Look for:** the DM treats you as soaked, and there is no `[COLD_WET: …]` in the chat.
5. **Reload:** refresh the page, or leave the session and resume it.
   - **Look for:** the replayed story and the "Previously on…" recap have no marker text either.
   - You may still see lines starting `[SYSTEM NOTE - DO NOT RESPOND TO THIS]` among your own messages. That is the known open item above, not a marker.
