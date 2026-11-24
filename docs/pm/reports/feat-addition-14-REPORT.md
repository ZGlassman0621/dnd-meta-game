# Report — feat addition: the fourteen approved feats (twelve + two WoW feats)

## Understanding

The game is a solo D&D 2024 campaign. One human player character plays alongside an AI Dungeon Master (gemma4:12b on Zach's PC), and the AI runs every NPC, companion and enemy in a persistent Forgotten Realms world. The engine owns the rules math, and the player rolls their own dice. This job adds fourteen new feats a player can take:
- twelve from the feat PDFs Zach supplied;
- two homebrew adaptations of Xanathar's Guide to Everything, Silver Tongue and Elegant Maneuver.

Each feat must do what its mechanic says in play. Where the engine has a hook for it, the engine enforces it. Where the game's route is the DM prompt, it is taught there. Where neither exists, the gap is stated plainly. Nothing is left as narrative-only flavour.

Differences between the brief and the live build, stated up front:

1. **The brief file's own header says "DRAFT VARIANT — not approved for courier, not queued".** Zach couriered it to me with no other instruction, and I took that as Zach picking the fourteen-feat version. If that was not the intent, the twelve-feat draft is a strict subset: dropping Silver Tongue and Elegant Maneuver means removing their two registry entries, two `feats.json` entries, the `WINNING_WORDS` marker and the Elegant Maneuver branch of `FEAT_USE`.
2. **"Pickable in the creator" does not match how this game hands out feats.** The creator (creator-next) builds a level-1 character. At level 1 the only feats are:
   - the origin feat, which is **fixed by the theme** — the server refuses any other (`server/routes/character.js:463`);
   - the Human Versatile / Mixed Ancestry versatile pick, which is chosen from the origin list.

   General feats are taken only at level-up (ASI levels), from `client/src/data/feats.json`. So:
   - the thirteen general feats were added to the level-up picker;
   - Energy Affinity was added to the origin list, which makes it pickable through Human Versatile.

   No theme grants Energy Affinity. Assigning it to a theme would be a theme-design decision, and that is not mine to make.
3. **The source PDF per feat was not in the brief.** The brief named a copy only for Mountaineer (DNDBlue). Muse supplied the rest on 2026-11-24 from the PM research report §1, and each feat is now tagged with its source PDF (see the addendum).

## Verdict

BUILT + GREEN (builder's run). Zach's run is the gate.

## Per-feat verdicts and enforcement route

| # | Feat | Slot | Verdict | Route |
|---|---|---|---|---|
| 1 | Tactician | general | built | **Engine, initiative.** The player is asked for a d20 **and a d4** and sends "14 3". The d4 is the player's die; without it the initiative stays pending. The swap is a "swap with &lt;ally&gt;" in the same reply, applies only to a party member, and happens once per combat. |
| 2 | Sage Advice | general | built | **Engine, `[FEAT_USE]`.** Checks the advisor's proficiency, allows at most 6 allies, spends 1 of PB uses (refilled by a long rest), and sets a 1-hour window on the game clock. Each **non-proficient** ally adds +PB once to their next check with that skill. A tool check is DM-applied, because tool checks are not engine rolls. |
| 3 | Hound | general, +1 Wis | built | **Engine rider** on ROLL_REQUEST `Feat="Hound smell"` (Perception with advantage) or `Feat="Hound track"` (+5 to Perception/Survival). The DM judges *when* it is smell or a scent trail. See the gap on the "+5 until a long rest" scent state. |
| 4 | Feather Foot | general, +1 Dex, Dex 13+ | built (prompt) | **DM prompt.** The game has no jump math and no trap-trigger type ("pressure"), so both clauses are registry text. This is a gap, stated below. |
| 5 | Seismic Touch | general | built | **Engine, `[FEAT_USE]`.** Records tremorsense 60 ft on the player's action state with `until` = the start of their next turn, which expires lazily on the same read as Dodge. The game has **no senses system**, so what tremorsense reveals is told to the DM, who narrates it. |
| 6 | Trapper | general, +1 Wis | built | **Engine:** 2 free Hunter's Mark casts per long rest (`SPELL_CAST … Free="true"`, or automatic when no 1st-level slot is left), at 1st level only; slotted casts beyond that. **Engine rider** `Feat="Trapper track"` (advantage on Survival) and `Feat="Trapper harvest"` (advantage on any check to skin, extract or preserve). |
| 7 | Friend of the Forest | general | built (prompt) | **DM prompt / registry**, the game's route for information sources such as beasts. See the inventory. |
| 8 | Elusive | general, +1 Dex, Dex 13+ | built | **Engine rider** `Feat="Elusive"` on a **creature's** tracking Perception/Survival roll gives it disadvantage, and it is refused on the player's own roll. The **stealth travel pace is a gap**: the game has no travel-pace model. |
| 9 | Sling Expert | general | built | **Engine, damage dice.** +1d4 within the sling's first range increment (30 ft, from the zone distance). +1d4 more against a target exactly one size larger, using the PC's `characters.size` (or a single-size species) and the enemy's statblock `size`. An unknown fact skips its die and says so. The bonus-action attack rides the existing generic `Bonus="true"` attack, which spends the bonus action; that path does not check the source of any bonus attack today. |
| 10 | Mountaineer | general, **no ASI** | built | **Engine rider** `Feat="Mountaineer climb"` (advantage on Athletics). **Gaps:** no climbing-speed model and no falling-damage engine, so both are registry text. |
| 11 | Energy Affinity | **origin** | built | **Engine:** the chosen resistance only, read through the D9 resistance table (`FEAT_RESISTANCE_TABLE`), applied to enemy spell damage. The cantrip is **granted** and never counted (client Stage 4 granted list and server Stage 6 cantrip check). |
| 12 | Quick Draw | general | built (part) | **Engine:** a creature moving to within 5 ft provokes while the player wields a ranged or thrown weapon (`provokedByMove`). **Gap:** the game has no improvised-weapon resolution, so the d4 and the proficiency are registry text. |
| 13 | Silver Tongue | general, +1 Cha, Cha 13+ | built | **Engine, `[WINNING_WORDS]`.** Refused on a hostile target (an enemy in the fight, or `Attitude="hostile"`) and when no shared language is recorded. The engine rolls the NPC's Insight in secret and asks the player for Persuasion. A win (beating the total; a tie keeps things as they were) charms for 1 minute on the game clock, or 10 rounds in combat. `End="true"` ends it on harm. There is no usage limit. |
| 14 | Elegant Maneuver | general | built | **Engine, `[FEAT_USE]`.** Spends the bonus action in combat and stores advantage, which the next Acrobatics/Athletics ROLL_REQUEST takes, the same path as HELP_CHECK. It ends with the turn. |

Fixes found along the way (fix-as-you-find-it):
- **Alert never added its +PB to initiative**, because the engine added Dex only. Alert's swap was also missing. Both now ride the same hook as Tactician.
- **The level-up half-feat dropdown was broken for every half-feat** (Actor, Athlete, Resilient and the rest). It listed the keys of the `abilityIncrease` object, so the player saw "ABILITY / AMOUNT" or "CHOICE / AMOUNT" instead of abilities, and the server then applied no +1 at all.

## Feat-system inventory (the survey, before any change)

| What | Where (live bytes, before this job) | Notes |
|---|---|---|
| DM-prompt feat catalog | `server/data/featRegistry.js` — `CORE_FEATS` (21), `FIGHTING_STYLE_FEATS` (10), Manual of Martial Mastery JSON (53) | The prompt text plus the server's origin-feat check (`category`) |
| Level-up feat catalog | `client/src/data/feats.json` (42 entries, mostly 2014 text, e.g. Alert "+5 initiative") | The only general-feat picker. The 2014 text is stale, but it is not this job (separate-job candidate, Not done 10a) |
| Origin feats | Theme-fixed (`themes.js` `origin_feat`; server refusal at `character.js:463`). Human Versatile picks from `ORIGIN_FEATS` (`creator-next/mixedAncestry.js:31`, server check `entry.category === 'origin'`) | Stored in `character_origin_feats` (`persistOriginFeatSelection`, `character.js:3675`) |
| Half-feat +1 flow | Client: `LevelUpPage.jsx` (dropdown — broken, see above). Server: `POST /level-up/:id` feat branch (`character.js:7145`) applies +1, capped at 20 | It exists, so it was used. The broken client side was fixed |
| Prerequisites | Shown as text (`LevelUpPage.jsx`), **enforced nowhere** | Now enforced for the three structured prerequisites (client disables the pick, server refuses with 400). Free-text prerequisites stay shown, not enforced |
| Mechanics reach play | `dmPromptBuilder.js:122` `renderFeatEffectsForPrompt` (prompt). Engine reads feats by name via `classFeatureService.hasFeat` (fighting styles, Two-Weapon Fighting) | Most core feats are prompt-only today |
| Granted cantrips | `cantripResolutionService.resolveCantrips` "feat cantrips" (caller-supplied); Stage 6 commit feeds Magic Initiate's | Energy Affinity's now joins there |
| Granted spells / free casts | **Free-cast uses are tracked nowhere** (`rangerService.js:29-33` says so for Favored Enemy). Magic Initiate's once-per-rest cast is untracked too | A tracker was built for Trapper (feat `uses`). Ranger and Magic Initiate were not moved onto it (see Not done) |
| Resistances | D9 table `resistanceService.js:75` (subclass features), applied to enemy spell damage (`enemySpellService`) | The feat table was added beside it |
| Per-long-rest uses | No feat use tracking anywhere (Lucky's luck points are prompt-only) | Added on the feat's own `characters.feats` entry (`uses.used`), so no new column was needed |
| Contested checks | **None** | Winning Words builds its contest on the existing pending-roll path |
| Conditions on NPCs | `conditionService` covers player, companion and enemy only (`TABLE_BY_KIND`) | The Winning Words charm on a town NPC lives in `session_config.featCharms` |
| Hearing / language | Deafened exists for party and enemies. Languages are stored (`characters.languages`, `npcs.languages`). An NPC's hearing is not stored | The language check is built; the NPC's hearing is a gap |
| Advantage on a check | HELP_CHECK's stored per-ally entry, consumed by the next matching ROLL_REQUEST (`rollRequestService.js`) | Elegant Maneuver rides the same pattern |
| Timed effects | `durationTrackerService.tickTimedEffects` **has no caller**, so turn-counted timed effects never tick (an existing defect, outside this job). `actionStateService` expires lazily on `until` | Seismic Touch and Elegant Maneuver use the lazy `until` |
| Opportunity attacks | `movementService.provokedByMove` (leaving reach only) | Quick Draw's entering-within-5-ft trigger was added |
| Size | `characters.size` (migration 110); enemy `stats_json.size` from the statblock | Used by Sling Expert |
| Hunter's Mark, Mind Sliver, Sacred Flame, Toll the Dead | All present in `spellCatalogData.js` (PHB 2024) | Nothing was added to the catalog |

Re-verified against live bytes: none of the fourteen names collides with a core feat, a fighting style, a Manual of Martial Mastery feat or a client catalog entry. The closest is the Tiefling ancestry feat "Silver Tongue of the Damned", a different name in a separate system.

## Files changed

There is no migration: feat uses ride the existing `characters.feats` JSON entry. The version is now 1.0.209, in both `package.json` files. The SHA-256 values are of the working-tree bytes at commit time; the commit hash is recorded below.

| File | New / edited | Bytes | SHA-256 |
|---|---|---|---|
| `CLAUDE.md` | edited | 30011 | `74fb2706a51bf642633e91ea763c198c034676b9f7f1386ecc5b88357ea8a29d` |
| `client/package.json` | edited | 427 | `ec088482abe7cb89906a62ee1b9b653b72a79a21c7c2eb7bf4178f0da79dece0` |
| `client/src/components/LevelUpPage.jsx` | edited | 107864 | `8ebb10b175f7314bb9fa04b77a77a145362e6a7bee25771d15971967608d81b7` |
| `client/src/components/creator-next/CreatorNextShell.jsx` | edited | 24184 | `9287cd998acc676ec977fd14f26c85739859454aa08825ffda3764ee637bbb60` |
| `client/src/components/creator-next/Stage1OriginIdentity.jsx` | edited | 73294 | `5cd3fbb3b78aa2150a50c0d08e7e54555ceaa058d04726cc5cd22df30de50b45` |
| `client/src/components/creator-next/Stage4AbilitiesSkillsSpells.jsx` | edited | 71542 | `47ed213be93d7f99f2c1da65ff2ef9bde39cec209511cb4197c0273a4da1643a` |
| `client/src/components/creator-next/mixedAncestry.js` | edited | 22941 | `7a99f384705f24f53ad8520db9c4d08e5f64edb2679e0862d3802ae485e0a3f9` |
| `client/src/data/feats.json` | edited | 27204 | `e4d2cae1bfd71ad457689a2284e04fb4ecbf855ea69ac001a933512756896771` |
| `package.json` | edited | 1398 | `f3025b6501a757898fd763f9133feb3b590385602fcd27e731a2b1704d676a62` |
| `server/data/featRegistry.js` | edited | 23144 | `c477b85e36850d668ee7f574088f4d6b83c34496a47120a05f2a750d5455ca70` |
| `server/routes/character.js` | edited | 433268 | `06a4a64c7f3f7f29b29fa78cd07077a16543ac711c3035457cc45fc22095be36` |
| `server/routes/dmSession.js` | edited | 229309 | `5ee030778920ce75bf2f1aa4679cbb65663272ef1a0425da89ef972ca396601f` |
| `server/services/actionStateService.js` | edited | 8411 | `9a97f3ad37b60222b62807612a840297df142eec6b09ef27874185f51d7001fc` |
| `server/services/combatLoopService.js` | edited | 25138 | `40c033c83353d740efae435534ac3c98b21511896c91d17b98f18d3c0e7c2182` |
| `server/services/combatMarkerService.js` | edited | 95373 | `38288e48d9c5ede14de6ffe2546115471a591b97366dd43fa7968625d7890a0e` |
| `server/services/dmPromptBuilder.js` | edited | 199367 | `7e9c0f44f69c4ea5b80d491adc0777460781d7786aa1b834d75d444cdd04905b` |
| `server/services/markerSchemas.js` | edited | 66612 | `79089788cbefbbffbdf3e031b2d4eea325ba02ffa00739237ec4c4cec27c9860` |
| `server/services/movementService.js` | edited | 27920 | `e31ec0a8d15a69d7e9490f32ca4270dd2b5e8d0910a64d8aa5d838eb3e42a092` |
| `server/services/partyAttackService.js` | edited | 130171 | `88c05bf512a640b9380b5e6ec61bead45e85b9defed9077432ab62b61b888b2a` |
| `server/services/resistanceService.js` | edited | 36791 | `2913d88bd79c8261eef5c61528f6d52c8fad80655f2201b424a980fa1e9ced89` |
| `server/services/restTimeService.js` | edited | 56362 | `626c8ecf7108f515183354df9ba4a10e3c0217ad7f493a5832a7f4d4a2d0de18` |
| `server/services/rollRequestService.js` | edited | 61313 | `27abd222d9f1efdc9ca67e0a80e479690dfd55884caef2509f81be09a622a745` |
| `server/services/spellCastService.js` | edited | 93909 | `5b45aa86a6ea0f7854282d28984a9fe9812ff6ab5bfd17a94ca8399d9e57c377` |
| `tests/creator-next-stage1-mixed-ancestry.test.js` | edited | 32563 | `98eca0595faef161d870773d31cb92292e4991bad200ed452e47a2da56520670` |
| `tests/gray-out-client.test.js` | edited | 33470 | `1e882f9df458ad9011e7a9de608000ee1332e0e587da0c675a4c6ca5a386b570` |
| `tests/marker-strip.test.js` | edited | 10863 | `e8388c0aa66785f97d1bfacdbed6dc8744b5bd473cc43d094576261a087c85c7` |
| `client/src/components/featPickHelpers.js` | new | 1142 | `0d86e63b6302f610122c246ac5c046f5dbec011b08ae3f74adc4e71b619b8b8e` |
| `docs/pm/feat-addition-14/BRIEF.md` | new | 21325 | `8fd38c701b06e12fe913a57a349c195a057dc366c22adeaae5e5959c870e1e36` |
| `server/services/featMechanicsService.js` | new | 43069 | `dce4903ec7836237b2a12aeef2525b64d43895ec8201db1f3241d2c9b941d160` |
| `tests/feat-addition-14.test.js` | new | 41764 | `65ba195c2ca0b7d8708c3f8ed35268cc19918f0022e2c704ddd5088c657e5f21` |

## What was built (in play)

- **Level-up:** the thirteen general feats appear in the feat dropdown.
  - Feather Foot, Elusive and Silver Tongue are greyed out, with "(requires …)", when the score is too low, and the server refuses them too.
  - A half-feat's +1 now lists real abilities. A fixed one, such as Hound's Wisdom, is pre-selected and cannot be changed.
- **Creator, Stage 1:** a human's Versatile origin pick includes Energy Affinity, with a Mind/Soul/Death picker. The cantrip appears on Stage 4 as granted ("versatile feat (Energy Affinity)").
- **Initiative:**
  - A Tactician is asked "Roll a d20 and a d4 (Tactician) … send both, d20 first (e.g. "14 3")".
  - An Alert character's modifier now includes their proficiency bonus.
  - Either can add "swap with Lyra".
- **During play:**
  - The DM is taught the marker for each feat the player actually holds, and sees uses left ("Hunter's Mark free casts 2/2 left", "Sage Advice 2/3 uses left").
  - Using a feat brings back a ⚙ line or a system fact: advantage applied, charm landed, free cast spent, or refused and why.

## Live probe (real server + real gemma4:12b)

This run used the real `server/index.js` on port 3091 with a throwaway database and gemma4:12b through Ollama. Each scene had a fresh invented character (Wren Ashdown, a level 5 ranger) and its own session, and the player wrote as a player would. The script and its outputs are in the scratchpad (`feat-probe.mjs`, `feat-probe.out`, `feat-probe2.out`, `feat-probe3.out`).

| Scene | What the player did | What happened |
|---|---|---|
| A Tactician | Started a tavern fight, then replied "14", then "14 3" | Prompt: "🎲 Roll a d20 and a d4 (Tactician) for initiative — send both, d20 first (e.g. "14 3"); the engine adds +3 (Dex) after. To swap with a willing ally, add "swap with &lt;name&gt;"." "14" alone gave "⚙ Initiative not settled: send your d20 AND your d4 (Tactician)", and nothing was rolled for the player. "14 3" gave "⚙ Initiative: d20 14 + d4 3 (Tactician) + 3 (Dex) = 20" and the player went first. |
| B Elegant Maneuver | "I use my Elegant Maneuver feat as a bonus action and leap across the gap." | The DM wrote `[FEAT_USE: Feat="Elegant Maneuver"]` and then `[ROLL_REQUEST: Skill="Athletics" …]`. The pending roll had advantage, and the player saw "Roll two d20s (advantage: Elegant Maneuver …)". |
| C Silver Tongue, first run | "I use Winning Words on Hulda …" | **Defect found:** the DM wrote no marker and narrated Hulda won over, with no roll. Its system prompt *did* carry the teaching (checked in `ai_call_log`). **Fixed:** when the player names a feat they hold, a one-line directive is appended to that action, the same recency mechanism as the dice directive (`featActionDirective`). |
| C Silver Tongue, after the fix | Same two messages, then "16" | The DM wrote `[WINNING_WORDS: Target="Hulda Brightmere"]` and the player was asked for Persuasion. "16" gave "⚙ Winning Words: your Persuasion 21 beats Hulda Brightmere's Insight — Hulda Brightmere is charmed for 1 minute." `featCharms` held Hulda for 1/60 hour. The NPC's Insight total never reached the player. |
| D Hound, first run | Smelled the thief's scarf and followed the trail | The DM wrote `ROLL_REQUEST Skill="Survival" … Feat="Hound smell"`. The engine correctly refused it, because "smell" is Perception only, and the roll went ahead without the rider. **Fixed:** when the tag names the wrong situation but exactly one rider of the same feat covers that skill (for Survival, only "Hound track"), the engine uses that rider and says so. |
| D Hound, after the fix | Same | The DM wrote `ROLL_REQUEST Skill="Perception" … Feat="Hound smell"`. The player saw "Roll two d20s (advantage: Hound: Perception based on smell)", and it rolled openly; the Perception bank does not swallow a declared scent check. |
| E Trapper | "I cast Hunter's Mark on the wolf with one of my free Trapper casts, then shoot it." | The DM wrote `[SPELL_CAST: Spell="Hunter's Mark" Level=1 Free="true"]`. The Trapper counter went 0 → 1, and `spell_slots_used` stayed `{}`, so no slot was spent. |

No server error lines appeared in any run.

## Test results

This was the builder's full `npm test` on the PC, 2026-11-24. **Files: 254/254 green. Assertions: 19,746 passed, 0 failed.**
- **Retried once after Windows' native libsql crash** (`0xC0000005`); the retries passed: `creator-next-stage5-validation`, `human-versatile`.
- **`pass*`** (the native crash came after every assertion had passed, so it counts green): `item-3c-bonus-action`, `npc-bank-wiring`, `subclass-batch4`.

The first full run found 4 red files, all fixed:
- `marker-strip` pins the schema count. It is now 132, with FEAT_USE and WINNING_WORDS added.
- `creator-next-stage1-mixed-ancestry` pinned "exactly 10 origin feats". It now checks 10 book origin feats plus the homebrew Energy Affinity.
- `gray-out-client`'s mutation test copies `LevelUpPage`'s sibling imports by hand. It now also copies the new `featPickHelpers.js`.
- `downtime-rest` hit the Windows native crash before any assertion ran. Run alone it gives 31/31.

**New: `tests/feat-addition-14.test.js`, 130 assertions, 15 groups.** It uses the real services, the real character router for level-up, and reported dice only. Where an outcome is asserted, the NPC dice are forced through the DM-settable modifier.

| # | Group | What it covers |
|---|---|---|
| 1 | Catalog | Fourteen feats in the right slots, homebrew-tagged; the five half-feats; Mountaineer has no ASI and no "+5"; no house systems |
| 2 | Picker helpers | The dropdown fix (Actor → CHA, Athlete → STR/DEX); the prerequisite gates |
| 3 | Level-up, real route | Silver Tongue Cha 13 → 14, applied once; Cha 12 refused; Hound refuses a Cha +1; Mountaineer refuses any +1 and lands with none; Trapper at Wis 20 caps at 20; the use counter is seeded |
| 4 | Uses | Trapper 2 and Sage Advice = PB; the third spend is refused; a short rest restores nothing; a long rest (`applyRest`) refills |
| 5 | Initiative | Alert +PB; Tactician d4 (pending without it, a 7 rejected, 10+2+3 = 15); swap with the companion; an enemy refused; once per combat; the DM fact |
| 6 | Riders | Hound smell and track (+5 in the total); Mountaineer; Trapper harvest; wrong skill refused; saves never; no feat refused; Elusive gives the tracker 2d20 and takes the lower, never on the player's own roll; the live-found "Hound smell" on Survival resolves to track |
| 7 | Elegant Maneuver | Advantage in the same reply, then spent; Stealth does not use it; it lapses out of combat; no feat refused; in combat it spends the bonus action, a second use is refused, and it ends when the turn passes |
| 8 | Seismic Touch | Active on the player's turn and through the goblin's turn; gone at the start of the player's next turn |
| 9 | Sage Advice | The advisor must be proficient; uses go to 2/3; a non-proficient ally gets +3 once; a proficient ally gets nothing; the bonus is gone after the hour |
| 10 | Winning Words | Contest asked for; R-29 note; win charms for 1 minute; harm ends it; a loss charms nobody; hostile, an enemy in the fight, and no shared language are refused; no feat refused; no usage counter; the action directive |
| 11 | Trapper | Free cast with no slot spent; without `Free=` a slot pays; the automatic fallback; the third free cast refused; long-rest reset; 1st level only; no effect without the feat; the prompt line |
| 12 | Energy Affinity | The three grants; psychic 11 → 5 and the other two types untouched; the creator refuses "fire" and accepts Soul for Human Versatile; the cantrip is granted and never counts |
| 13 | Sling Expert | Each +1d4 clause separately (in or out of range; same, one larger or two larger size; unknown facts); the real attack path asks for "1d4 + 1d4 + 1d4" |
| 14 | Quick Draw | Bow plus the feat provokes; no feat, nothing; a melee weapon, nothing; a thrown dagger counts |
| 15 | Markers and prompt | Dispatch order; the `Feat=` and `Free=` fields; DM teaching only for held feats; uses shown |

Client: `cd client && npx vite build` is green.

## Cost and usage

I can't measure this session's cost or the remaining usage from inside the session. Nothing in this job calls a paid API: the game runs gemma4:12b locally.

## Not done / still open

1. **Feather Foot, both clauses: registry text only.** The game has no jump-distance math and no trap-trigger type ("pressure" versus magical), so nothing in the engine can enforce either one. Enforcing them needs a trigger field on trap/hazard records and a jump rule.
2. **Elusive's stealth travel pace: registry text only.** There is no travel-pace model. The tracking-disadvantage half is engine-enforced.
3. **Mountaineer's climbing speed and falling-damage reduction: registry text only.** There is no climb-speed field in `movementService.speedFor` and no falling-damage engine. The climbing advantage is engine-enforced.
4. **Quick Draw's improvised-weapon d4 and proficiency: registry text only.** No code anywhere resolves improvised weapons, including Tavern Brawler's improvised proficiency. The opportunity-attack trigger is engine-enforced.
5. **Seismic Touch:** the duration is engine-tracked, but **what** it reveals is the DM's narration. There is no senses system.
6. **Hound's "+5 until a long rest" after smelling an object:** the +5 is engine-applied when the DM tags `Feat="Hound track"`, but the engine does not store which creature's scent the player holds. The DM judges that.
7. **Silver Tongue, two parts:**
   - The target's ability to hear is not stored for NPCs, so the DM judges it.
   - The 1-minute charm runs on the game clock (or 10 rounds in combat). If no `TIME_ADVANCE` happens out of combat, it lasts until the DM ends it or the party harms the target.
   - Harm ends it through `[WINNING_WORDS … End="true"]` (the DM's call) or `endCharmOnHarm`. No attack or spell hook calls `endCharmOnHarm` automatically yet.
8. **Sage Advice: a stat-block (non-class) companion's proficiency is unknown,** so the bonus is not applied to them rather than guessed. Tool checks are DM-applied.
9. **Sling Expert's bonus-action attack** rides the existing generic `Bonus="true"` attack. That path does not check which feature grants a bonus attack, for any feature.
10. **Ranger Favored Enemy and Magic Initiate free casts are still untracked.** Muse, 2026-11-24: out of scope here. The Trapper tracker stays scoped to Trapper's Hunter's Mark. Generalizing it is a **separate-job candidate**.
10a. **Separate-job candidate, catalog-text corrections:** the level-up feat list (`client/src/data/feats.json`) carries 2014 text for the book feats (Alert still says "+5 initiative"), and origin feats such as Alert and Lucky are tagged and offered as general feats. Muse, 2026-11-24: out of scope here. It goes on the catalog-text-corrections pile, origin-feat tagging included.
11. **Existing defect found:** `durationTrackerService.tickTimedEffects` has no caller, so turn-counted timed effects never tick. It is outside this job and reported here.
12. **The :5173 visual check was not clicked through by me.** The client build is green and the steps are below. Zach's click-through is part of the gate.

## Decisions made (reversible, for veto)

1. **The fourteen-feat variant was built** from the file as couriered, even though its header says draft. Reversal: remove Silver Tongue and Elegant Maneuver. That is two registry entries, two `feats.json` entries, the `WINNING_WORDS` handler and schema, and one branch of `FEAT_USE`, about an hour of work.
2. **Energy Affinity is reachable only through Human Versatile** (and the Mixed Ancestry versatile pick). No theme was given it. Reversal: set a theme's `origin_feat` to `energy_affinity`; the validators already accept it.
3. **Energy Affinity is not offered as a level-up feat.** The brief calls it origin, so it isn't in `feats.json`. Reversal: one `feats.json` entry, plus a choice picker on the level-up page.
4. **Sling Expert's "one size larger" is read as written: exactly one size larger.** A Huge target against a Medium slinger gets no die. **Confirmed by Muse, 2026-11-24:** the book text is "one size larger than you".
5. **Winning Words:**
   - The player must **beat** the Insight total; a tie means no charm. This is the general contest rule, with the status quo on a tie.
   - The NPC's Insight uses the stored NPC modifier, or an `Insight=` value the DM gives.
   - "Hostile" means an enemy standing in the current fight, a `disposition_json` attitude of "hostile", or `Attitude="hostile"` on the marker.

   Reversal: three lines each.
6. **Out of combat, "this turn" has no turn.** For Elegant Maneuver and Seismic Touch it lasts through the DM's reply to the action that used it and the player's next action, then lapses. Reversal: the `oocLapsed` window.
7. **The Trapper free cast is used automatically when no 1st-level slot is left.** With a slot left, it is used only on `Free="true"`, so the player keeps the free casts for when they need them. Reversal: one condition in `trapperFreeCast`.
8. **A Hound scent check rolls openly, past the Perception bank,** like a hearing-tagged check: it is a sense the player declared. Reversal: one condition in the bank guard.
9. **Wrong-situation riders.** A rider named for the wrong situation falls back to the one same-feat rider that covers the skill, found live with "Hound smell" on Survival. With two or more possible siblings it is refused. Reversal: remove the fallback block in `judgeFeatRider`.
10. **The feat directive appended to the player's action.** It is added only when the player names a feat they hold, and the stored history keeps the clean action. Reversal: delete the one `featActionDirective` call in `dmSession.js`.
11. **Prerequisites and the +1 are enforced only for registry feats that carry structured fields** (the fourteen). The existing book feats in `feats.json` keep their old trust-the-client behaviour on the server; the client dropdown fix applies to all of them. Reversal: none needed. Extending enforcement to the book feats would need structured prerequisites added to `feats.json`.

## Needs Zach's decision

All four questions were answered by Muse on 2026-11-24 (see the addendum). Nothing else needs a decision here. The origin call for Sage Advice and Friend of the Forest stays Zach's, at the gate:

Sage Advice and Friend of the Forest as origin feats — exactly what would change (build step 13; built as general, the call is Zach's):
- **Registry:** set `category: 'origin'` on each entry in `server/data/featRegistry.js`. The server's origin check (`entry.category === 'origin'`, `character.js:458/515`, `mixedAncestryService.js:380`) then accepts them.
- **Picker:** add each to `ORIGIN_FEATS` in `client/src/components/creator-next/mixedAncestry.js`. Human Versatile then offers them, and the "exactly 10 book origin feats" test count moves.
- **Slot rule:** neither feat has an ASI, so both fit the origin shape. Origin feats are taken at level 1.
- **Sage Advice at level 1:** its uses equal PB, so 2 at level 1, which grows with level. That is fine as an origin feat.
- **Theme fit:** to grant either from a theme, set that theme's `origin_feat`. Sage Advice suits Sage/Scholar-type themes and Friend of the Forest suits Outlander/Hermit-type ones. Picking the themes is a design decision.
- **Keep both slots, or move?** Either can stay in `feats.json` as a level-up general feat too, or be removed from it if it should be origin-only.

There is no code beyond those four touches, and no migration.

## How to verify

**Gate:** from the repo root, run `npm test`. Expect all files green, including the new `feat-addition-14.test.js` (130 assertions).

At **:5173** (never :3000), after `npm run dev`:

1. **Level-up picker, with prerequisites:** open a level 3 character with enough XP, choose Level Up, take the ASI, then choose "Feat".
   - The dropdown lists the thirteen new general feats.
   - With Dex below 13, Feather Foot and Elusive appear greyed with "(requires Dexterity 13 or higher)". With Cha below 13, Silver Tongue appears greyed with "(requires Charisma 13 or higher)".
2. **The half-feat +1:** in the same picker, pick Hound. The +1 dropdown shows **WIS** only, already selected, and not "ABILITY" or "AMOUNT". Pick Actor: CHA. Pick Athlete: STR or DEX.
   - Finish the level-up. The sheet shows Wisdom up by 1 and Hound in the feat list.
3. **Mountaineer:** pick Mountaineer. No +1 dropdown appears, and finishing changes no score.
4. **Energy Affinity:** start a new character in the creator, choose Human, and in the Human Versatile origin pick choose Energy Affinity.
   - A Mind/Soul/Death picker appears; choose Mind.
   - On Stage 4 the spell section lists Mind Sliver as a granted cantrip, "versatile feat (Energy Affinity)", and it does not use a class cantrip pick.
5. **Tactician:** in play, a Tactician character who starts a fight is asked for "a d20 and a d4 (Tactician)". Replying "14 3" shows the ⚙ initiative line with the d4 in it.
6. **Feat markers:** in play, with each feat on the character, say what you do using the feat's name:
   - "I use Elegant Maneuver and leap the gap": the roll prompt asks for two d20s, with advantage.
   - "I use Winning Words on the innkeeper": a Persuasion roll prompt, then a ⚙ charm line or a no-charm line.
   - "I cast Hunter's Mark with a free Trapper cast": no spell slot is spent.

## Verification evidence

- Commit `15e38a4` "Feat addition: the fourteen approved feats (v1.0.209)", branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`, pushed to `origin`.
- SHA-256 per file: see the Files changed table. The hashes were taken before the commit, of the bytes that were committed.
- Tests: the Test results section. Live behaviour: the Live probe section.

## Addendum — Muse's answers (2026-11-24)

1. **Source PDFs: applied.** Each feat now carries its source PDF: `sourcePdf` in `server/data/featRegistry.js`, and the `source` line in `client/src/data/feats.json`. None is "unknown" any more.

   | PDF | Feats |
   |---|---|
   | DNDBlue Feat Collection v2.4 | Tactician, Hound, Feather Foot, Seismic Touch, Friend of the Forest, Elusive, Mountaineer |
   | Fantastic Feats of Forgotten Realms | Sage Advice, Quick Draw |
   | Book of Revised Feats | Trapper, Sling Expert |
   | Homebrew Feats 2024 | Energy Affinity |

   Silver Tongue and Elegant Maneuver keep their Xanathar adaptation tags. New assertions in `feat-addition-14.test.js` group 1 pin all twelve sources, matching in both catalogs.
2. **Sling Expert stays at exactly one size larger,** as built. The book text is "one size larger than you". No code change.
3. **The 2014 book-feat text in the level-up list is out of scope.** It is recorded as a separate-job candidate on the catalog-text-corrections pile, origin-feat tagging included (Not done 10a).
4. **Favored Enemy and Magic Initiate free casts are out of scope.** The Trapper tracker stays scoped to Trapper's Hunter's Mark. Generalizing it is recorded as a separate-job candidate (Not done 10).

**Tests:** `feat-addition-14.test.js` is 133/133. The builder's full `npm test` is 254/254 files green, 19,745 assertions passed, 0 failed.
- The total is one lower than the first run's 19,746, although this change added three assertions. Five files took the Windows `pass*` exit this time (`arms-armor-variants`, `item-4-movement`, `item-7-damage-tables`, `item-8-conditions`, `subclass-tier0`), and two of them reported no count. No assertion failed.

**Files changed in this follow-up:**

| File | New / edited | Bytes | SHA-256 |
|---|---|---|---|
| `server/data/featRegistry.js` | edited | 23334 | `82f897a4d2b34e72c65faeb484de475fc7376056c29368666d817484deca507b` |
| `client/src/data/feats.json` | edited | 26973 | `5b0ec127ab7d1a31e7c9373183e8f08913969ce011d2607d806f9134941af953` |
| `tests/feat-addition-14.test.js` | edited | 42832 | `2ddbee2507b7dd9107781efdf1d6a945dda4df8c8fe4c7ce956e48c1273532ad` |

The version stays 1.0.209: this is a follow-up inside the same job.
- Follow-up commit: `89a4c56`, branch `phase-4-hybrid-combat`, pushed.

## Addendum — provenance fence (Muse, 2026-11-24)

**Rule:** a feat's source tag (DNDBlue, Book of Revised Feats, Fantastic Feats, Homebrew Feats 2024, and the Xanathar / WoW origin of Silver Tongue and Elegant Maneuver) is internal metadata. It stays in the registry data and in this report, and never appears in anything the player sees, DM narration included.

**Surfaces checked, and the result:**

| Surface | What renders there | Result |
|---|---|---|
| Level-up feat list (`client/src/components/LevelUpPage.jsx` + `client/src/data/feats.json`) | name, description, prerequisites, benefits, the +1 picker | **Clean.** The `source` field in `feats.json` is data only, and `LevelUpPage` never reads it. Test-pinned. |
| Creator: Human Versatile / Mixed Ancestry origin picker (`creator-next/Stage1OriginIdentity.jsx`, `ORIGIN_FEATS` in `mixedAncestry.js`) | feat name, effect text, the Energy Affinity tooltip and choice | **Two leaks found and fixed.** Both were added earlier in this job. The Energy Affinity effect text began "Homebrew." and its tooltip began "Homebrew origin feat." Both words are gone; the `homebrew: true` flag stays as data. |
| Creator: Stage 3 theme origin feat (`Stage3PastPath.jsx`) | the theme's feat name and effect | **Clean.** No theme grants one of the fourteen, and registry effect texts name no source. |
| Creator: Stage 4 granted spells and Stage 6 review | "granted by versatile feat (Energy Affinity)" | **Clean.** It names the feat, not its source. |
| Character sheet (`CharacterSheet.jsx`) | its feat sections: Fighting Style and ancestry feats | **Clean.** None of the fourteen renders a source there. The sheet has no general-feat section. |
| Tooltips and descriptions | every string the fourteen feats render | **Clean** after the two fixes above. |
| DM prompt, feat effects (`renderFeatEffectsForPrompt`) | the feat list the DM sees | **Fixed.** The fourteen used to render under a header naming their ruleset ("HOMEBREW FEAT EFFECTS (Feat PDFs (Zach-supplied; PM research 2026-11-20))…"), which the DM could repeat in narration. They now render in the plain "FEAT EFFECTS" list with no ruleset name; they override no book rule. |
| DM prompt, "FEAT STATE AND USE" block, per-action feat directives, FEAT_USE / WINNING_WORDS system notes, ⚙ engine lines, roll prompts | text sent to the DM and the player | **Clean.** The Winning Words note's rule id "(R-29)" was also dropped, as an internal tag the DM need not see. |
| The tags themselves | `sourcePdf`, `rulesetId` | **Still in the data** (test-pinned). |

**Proof:** new group 16 in `tests/feat-addition-14.test.js` scans every one of those rendered strings for the provenance words. That covers the level-up fields, the origin picker text, the Stage 1 Energy Affinity block, the rendered DM feat effects, the full DM system prompt's feat section for a character holding all thirteen general feats, every string literal in `featMechanicsService`, and the per-action directives. The words scanned are DNDBlue, Revised Feats, Fantastic Feats, Homebrew Feats, Xanathar, homebrew, feat pdf, PM research, Panache, Swashbuckler, WoW and 2014. The group also checks that the tags are still in the data. `feat-addition-14.test.js` is 142/142.

**Found, not changed — a decision for Muse:** the **Manual of Martial Mastery** feats predate this job and are not among the fourteen. They still render to the DM under "HOMEBREW FEAT EFFECTS (Nardo's Manual of Martial Mastery) — these OVERRIDE standard D&D 5e rules…", so that source name reaches the DM prompt for a character who holds one. The header carries the override instruction, and `tests/feat-registry.test.js` pins it. Should the fence cover those feats too? Doing so means dropping the ruleset name from that header while keeping the override instruction.

**Tests:** the builder's full `npm test` is 254/254 files green, 19,746 passed, 0 failed.
- Retried after Windows' native crash, and passed: `h2-h3-2024-rules`, `mixed-ancestry`.
- `pass*`: `artificer-class`, `lair-hazard-auto`, `subclass-scanned2`, `weapons-mastery`.

The client build is green.

**Files changed in this follow-up:**

| File | New / edited | Bytes | SHA-256 |
|---|---|---|---|
| `server/data/featRegistry.js` | edited | 23920 | `0d96d16c523cca99201c816ead9d3dd256dd46c9add10243e64da16d88fe491b` |
| `server/services/featMechanicsService.js` | edited | 43062 | `c948fd258866df8ffca9a8e5ba5c06c004e6982b1f7f9193b55ded9b22487154` |
| `client/src/components/creator-next/Stage1OriginIdentity.jsx` | edited | 73272 | `f1e2f1dc3ad7d73a76e3ec53d58e7ae213f96c282e898ba0a3b74654ce116b01` |
| `client/src/components/creator-next/mixedAncestry.js` | edited | 23092 | `b27550583673aa7a465db2c4d9a3d6a839019e4a2df0522d37e250c141394d42` |
| `tests/feat-addition-14.test.js` | edited | 47066 | `4d6c5fa2b7d16cbfe7035aa10856635e06f0897fc69286f0492a77797d0a8db1` |
- Provenance-fence commit: `88ee28b`, branch `phase-4-hybrid-combat`, pushed.
