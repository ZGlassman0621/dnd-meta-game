# Report — repo-check-fixes-tools: the tools say what the book says

## Understanding

The game is a solo D&D 2024 campaign with an AI Dungeon Master. The creator and the sheet describe each tool a character can be proficient with, from `client/src/data/references.js` (`TOOLS`).

The 2026-11-24 repo check found that 17 of the 37 tool descriptions were invented flavor rather than the 2024 book. Two of them said the opposite of the book: Calligrapher's Supplies "for forging" and the Dice Set "lets you cheat". No tool stored its book ability or DC.

This job:
- rewrites the 17 from the book's Utilize and Craft lines;
- stores the book's ability and every Utilize DC on all 37;
- leaves the other 20 descriptions byte-identical.

Nothing uses the new ability and DC data yet; that is a later job.

**Step 0, confirming the live entries:** the 17 entries still carried the text the brief quotes. The brief's quotes are shortened in places. Alchemist's Supplies continues after "substances" with "— vials, flasks, and reagents for extractions and analysis", and Cobbler's is quoted with "…". These are abridgements, not changes.

**No line drift:**
- `TOOLS` sits at lines 92–137, inside the brief's "~92–150".
- Alchemist's Supplies is on line 94, Calligrapher's on 96, Cobbler's on 99 and the Dice Set on 113, as the brief says.
- All 37 names match the book table: 0 missing, 0 extra.

## Verdict

BUILT + GREEN on the builder's run. Zach's run is the gate.

## The structured shape (for veto)

The entries were bare strings, so each one became a structured entry, as the brief allows:

```js
"Brewer's Supplies": {
  description: 'Detect a poisoned drink or identify alcohol, and craft antitoxin.',
  ability: 'Intelligence',
  utilize: [{ action: 'Detect poisoned drink', dc: 15 }, { action: 'Identify alcohol', dc: 10 }]
}
```

- **`description`:** the one sentence the player reads.
- **`ability`:** the Utilize ability, spelled in full as the book prints it.
- **`utilize`:** an array of `{ action, dc }`, one per Utilize option, in book order. A tool with two options stores both, each keyed to its own action. 21 entries have two options:
  - Alchemist's Supplies, Brewer's Supplies, Weaver's Tools, Cook's Utensils, Forgery Kit, Navigator's Tools and Thieves' Tools;
  - the 4 gaming sets;
  - the 10 instruments.
- **Shared book entries:** the four gaming sets share the book's one Gaming Set entry, and the ten instruments share its one Musical Instrument entry, so each variant carries the same fields.
- **New helper:** `toolDescription(name)` returns the sentence, or null.

The two readers of the old string now read `.description`: `lookupReference('tool', …)` in `references.js` and the creator's `resolveChoiceOptions` in `choiceOptions.js`. The two readers that use only the names (`speciesAdapter.js` and Stage 4) needed no change.

**Not stored:** the book's Craft lists, as data. The brief asks for ability and DC fields only. For the 17 rewritten tools, the craft items are in the description sentence.

**Confirmed: all 37 entries now carry an ability and DC data.** The tests check every entry against the brief's tables.

## Per-tool verdicts (all 37)

The live description and the stored ability and DCs come straight from the committed file. The book column is the brief's book line, from the PM transcription of PHB pp. 220–221.

| # | Tool | Verdict | Live description | Stored ability · Utilize (DC) | Book (brief) |
|---|---|---|---|---|---|
| 1 | Alchemist's Supplies | **Rebuilt** | Identify a substance or start a fire, and craft acid, alchemist's fire, a component pouch, oil, paper, or perfume. | Intelligence · Identify a substance (DC 15); Start a fire (DC 15) | Intelligence. Utilize: Identify a substance (DC 15), or Start a fire (DC 15). Craft: Acid, Alchemist's Fire, Component Pouch, Oil, Paper, Perfume |
| 2 | Brewer's Supplies | **Rebuilt** | Detect a poisoned drink or identify alcohol, and craft antitoxin. | Intelligence · Detect poisoned drink (DC 15); Identify alcohol (DC 10) | Intelligence. Utilize: Detect poisoned drink (DC 15), or Identify alcohol (DC 10). Craft: Antitoxin |
| 3 | Calligrapher's Supplies | **Rebuilt** | Write text with impressive flourishes that guard against forgery, and craft ink or a spell scroll. | Dexterity · Write text with impressive flourishes that guard against forgery (DC 15) | Dexterity. Utilize: Write text with impressive flourishes that guard against forgery (DC 15). Craft: Ink, Spell Scroll |
| 4 | Carpenter's Tools | **Rebuilt** | Seal or pry open a door or container, and craft a club, greatclub, quarterstaff, barrel, chest, ladder, pole, portable ram, or torch. | Strength · Seal or pry open a door or container (DC 20) | Strength. Utilize: Seal or pry open a door or container (DC 20). Craft: Club, Greatclub, Quarterstaff, Barrel, Chest, Ladder, Pole, Portable Ram, Torch |
| 5 | Cartographer's Tools | **Rebuilt** | Draft a map of a small area, and craft maps. | Wisdom · Draft a map of a small area (DC 15) | Wisdom. Utilize: Draft a map of a small area (DC 15). Craft: Map |
| 6 | Cobbler's Tools | **Rebuilt** | Modify footwear to give Advantage on the wearer's next Dexterity (Acrobatics) check, and craft a climber's kit. | Dexterity · Modify footwear to give Advantage on the wearer's next Dexterity (Acrobatics) check (DC 10) | Dexterity. Utilize: Modify footwear to give Advantage on the wearer's next Dexterity (Acrobatics) check (DC 10). Craft: Climber's Kit |
| 7 | Cook's Utensils | Already correct, fields added | Preparing meals — seasoning, preservation, identifying ingredients, and spotting tainted food. | Wisdom · Improve food's flavor (DC 10); Detect spoiled or poisoned food (DC 15) | Wisdom. Utilize: Improve food's flavor (DC 10), Detect spoiled or poisoned food (DC 15) (text matched the book; fields only) |
| 8 | Glassblower's Tools | **Rebuilt** | Discern what a glass object held in the past 24 hours, and craft a glass bottle, magnifying glass, spyglass, or vial. | Intelligence · Discern what a glass object held in the past 24 hours (DC 15) | Intelligence. Utilize: Discern what a glass object held in the past 24 hours (DC 15). Craft: Glass Bottle, Magnifying Glass, Spyglass, Vial |
| 9 | Jeweler's Tools | **Rebuilt** | Discern a gem's value, and craft an arcane focus or a holy symbol. | Intelligence · Discern a gem's value (DC 15) | Intelligence. Utilize: Discern a gem's value (DC 15). Craft: Arcane Focus, Holy Symbol |
| 10 | Leatherworker's Tools | **Rebuilt** | Add a design to a leather item, and craft a sling, whip, hide armor, leather armor, studded leather armor, backpack, crossbow bolt case, map or scroll case, parchment, pouch, quiver, or waterskin. | Dexterity · Add a design to a leather item (DC 10) | Dexterity. Utilize: Add a design to a leather item (DC 10). Craft: Sling, Whip, Hide Armor, Leather Armor, Studded Leather Armor, Backpack, Crossbow Bolt Case, Map or Scroll Case, Parchment, Pouch, Quiver, Waterskin |
| 11 | Mason's Tools | **Rebuilt** | Chisel a symbol or hole in stone, and craft a block and tackle. | Strength · Chisel a symbol or hole in stone (DC 10) | Strength. Utilize: Chisel a symbol or hole in stone (DC 10). Craft: Block and Tackle |
| 12 | Painter's Supplies | **Rebuilt** | Paint a recognizable image of something you've seen, and craft a druidic focus or a holy symbol. | Wisdom · Paint a recognizable image of something you've seen (DC 10) | Wisdom. Utilize: Paint a recognizable image of something you've seen (DC 10). Craft: Druidic Focus, Holy Symbol |
| 13 | Potter's Tools | **Rebuilt** | Discern what a ceramic object held in the past 24 hours, and craft a jug or a lamp. | Intelligence · Discern what a ceramic object held in the past 24 hours (DC 15) | Intelligence. Utilize: Discern what a ceramic object held in the past 24 hours (DC 15). Craft: Jug, Lamp |
| 14 | Smith's Tools | **Rebuilt** | Pry open a door or container, and craft any melee weapon except a club, greatclub, quarterstaff, or whip, medium armor except hide, heavy armor, ball bearings, a bucket, caltrops, a chain, a crowbar, firearm bullets, a grappling hook, an iron pot, iron spikes, or sling bullets. | Strength · Pry open a door or container (DC 20) | Strength. Utilize: Pry open a door or container (DC 20). Craft: Any Melee weapon (except Club, Greatclub, Quarterstaff, and Whip), Medium armor (except Hide), Heavy armor, Ball Bearings, Bucket, Caltrops, Chain, Crowbar, Firearm Bullets, Grappling Hook, Iron Pot, Iron Spikes, Sling Bullets |
| 15 | Tinker's Tools | **Rebuilt** | Assemble a Tiny item composed of scrap, which falls apart in 1 minute, and craft a musket, pistol, bell, bullseye lantern, flask, hooded lantern, hunting trap, lock, manacles, mirror, shovel, signal whistle, or tinderbox. | Dexterity · Assemble a Tiny item composed of scrap, which falls apart in 1 minute (DC 20) | Dexterity. Utilize: Assemble a Tiny item composed of scrap, which falls apart in 1 minute (DC 20). Craft: Musket, Pistol, Bell, Bullseye Lantern, Flask, Hooded Lantern, Hunting Trap, Lock, Manacles, Mirror, Shovel, Signal Whistle, Tinderbox |
| 16 | Weaver's Tools | **Rebuilt** | Mend a tear in clothing or sew a Tiny design, and craft padded armor, a basket, bedroll, blanket, fine clothes, net, robe, rope, sack, string, tent, or traveler's clothes. | Dexterity · Mend a tear in clothing (DC 10); Sew a Tiny design (DC 10) | Dexterity. Utilize: Mend a tear in clothing (DC 10), or Sew a Tiny design (DC 10). Craft: Padded Armor, Basket, Bedroll, Blanket, Fine Clothes, Net, Robe, Rope, Sack, String, Tent, Traveler's Clothes |
| 17 | Woodcarver's Tools | **Rebuilt** | Carve a pattern in wood, and craft a club, greatclub, quarterstaff, ranged weapon (except a pistol, musket, or sling), arcane focus, arrows, bolts, druidic focus, ink pen, or needles. | Dexterity · Carve a pattern in wood (DC 10) | Dexterity. Utilize: Carve a pattern in wood (DC 10). Craft: Club, Greatclub, Quarterstaff, Ranged weapons (except Pistol, Musket, and Sling), Arcane Focus, Arrows, Bolts, Druidic Focus, Ink Pen, Needles |
| 18 | Dice Set | **Rebuilt** | Discern whether someone is cheating at dice, or win the game. | Wisdom · Discern whether someone is cheating (DC 10); Win the game (DC 20) | Wisdom. Utilize: Discern whether someone is cheating (DC 10), or Win the game (DC 20). Craft: — (Gaming Set; no craft) |
| 19 | Dragonchess Set | Already correct, fields added | Playing dragonchess — a three-tiered strategy game enjoyed in urbane or scholarly circles. | Wisdom · Discern whether someone is cheating (DC 10); Win the game (DC 20) | Wisdom. Utilize: Discern whether someone is cheating (DC 10), Win the game (DC 20) (text matched the book; fields only) |
| 20 | Playing Card Set | Already correct, fields added | Playing card games of chance and skill. Useful for wagering in taverns or reading a player's tell. | Wisdom · Discern whether someone is cheating (DC 10); Win the game (DC 20) | Wisdom. Utilize: Discern whether someone is cheating (DC 10), Win the game (DC 20) (text matched the book; fields only) |
| 21 | Three-Dragon Ante Set | Already correct, fields added | Playing the gambling card game favored across the Realms. A common tavern pastime. | Wisdom · Discern whether someone is cheating (DC 10); Win the game (DC 20) | Wisdom. Utilize: Discern whether someone is cheating (DC 10), Win the game (DC 20) (text matched the book; fields only) |
| 22 | Disguise Kit | Already correct, fields added | Changing appearance — cosmetics, hair dye, prosthetics, and costume pieces to impersonate another. | Charisma · Apply makeup (DC 10) | Charisma. Utilize: Apply makeup (DC 10) (text matched the book; fields only) |
| 23 | Forgery Kit | Already correct, fields added | Producing false documents — seals, parchment, inks, and scripts to fool an untrained inspector. | Dexterity · Mimic 10 or fewer words of someone else's handwriting (DC 15); Duplicate a wax seal (DC 20) | Dexterity. Utilize: Mimic 10 or fewer words of someone else's handwriting (DC 15), Duplicate a wax seal (DC 20) (text matched the book; fields only) |
| 24 | Herbalism Kit | Already correct, fields added | Identifying plants, brewing antitoxins, and crafting healing potions from natural ingredients. | Intelligence · Identify a plant (DC 10) | Intelligence. Utilize: Identify a plant (DC 10) (text matched the book; fields only) |
| 25 | Navigator's Tools | Already correct, fields added | Charting courses, reading maps, and fixing position at sea by sextant and stars. | Wisdom · Plot a course (DC 10); Determine position by stargazing (DC 15) | Wisdom. Utilize: Plot a course (DC 10), Determine position by stargazing (DC 15) (text matched the book; fields only) |
| 26 | Poisoner's Kit | Already correct, fields added | Crafting poisons, applying them to weapons, and identifying poisons in food or drink. | Intelligence · Detect a poisoned object (DC 10) | Intelligence. Utilize: Detect a poisoned object (DC 10) (text matched the book; fields only) |
| 27 | Thieves' Tools | Already correct, fields added | Picking locks, disabling traps, and performing subtle mechanical tampering. Required proficiency for most locks. | Dexterity · Pick a lock (DC 15); Disarm a trap (DC 15) | Dexterity. Utilize: Pick a lock (DC 15), Disarm a trap (DC 15) (text matched the book; fields only) |
| 28 | Bagpipes | Already correct, fields added | A drone-and-chanter instrument associated with highland and military traditions. | Charisma · Play a known tune (DC 10); Improvise a song (DC 15) | Charisma. Utilize: Play a known tune (DC 10), Improvise a song (DC 15) (text matched the book; fields only) |
| 29 | Drum | Already correct, fields added | Percussion for tavern songs, martial cadences, and tribal dance. | Charisma · Play a known tune (DC 10); Improvise a song (DC 15) | Charisma. Utilize: Play a known tune (DC 10), Improvise a song (DC 15) (text matched the book; fields only) |
| 30 | Dulcimer | Already correct, fields added | A hammered stringed instrument producing shimmering, layered tones. | Charisma · Play a known tune (DC 10); Improvise a song (DC 15) | Charisma. Utilize: Play a known tune (DC 10), Improvise a song (DC 15) (text matched the book; fields only) |
| 31 | Flute | Already correct, fields added | A transverse woodwind — bright, airy, good for carrying across crowds. | Charisma · Play a known tune (DC 10); Improvise a song (DC 15) | Charisma. Utilize: Play a known tune (DC 10), Improvise a song (DC 15) (text matched the book; fields only) |
| 32 | Lute | Already correct, fields added | The classic bard's plucked string instrument. Portable, expressive, and suited to song. | Charisma · Play a known tune (DC 10); Improvise a song (DC 15) | Charisma. Utilize: Play a known tune (DC 10), Improvise a song (DC 15) (text matched the book; fields only) |
| 33 | Lyre | Already correct, fields added | An ancient plucked string instrument associated with poetry, scholarship, and classical music. | Charisma · Play a known tune (DC 10); Improvise a song (DC 15) | Charisma. Utilize: Play a known tune (DC 10), Improvise a song (DC 15) (text matched the book; fields only) |
| 34 | Horn | Already correct, fields added | Brass signaling instrument — hunt calls, warnings, and ceremonial fanfare. | Charisma · Play a known tune (DC 10); Improvise a song (DC 15) | Charisma. Utilize: Play a known tune (DC 10), Improvise a song (DC 15) (text matched the book; fields only) |
| 35 | Pan Flute | Already correct, fields added | A set of pitched pipes played by blowing across them. Pastoral and woodland in character. | Charisma · Play a known tune (DC 10); Improvise a song (DC 15) | Charisma. Utilize: Play a known tune (DC 10), Improvise a song (DC 15) (text matched the book; fields only) |
| 36 | Shawm | Already correct, fields added | A piercing double-reed woodwind, ancestor of the oboe. Loud, formal, and festival-appropriate. | Charisma · Play a known tune (DC 10); Improvise a song (DC 15) | Charisma. Utilize: Play a known tune (DC 10), Improvise a song (DC 15) (text matched the book; fields only) |
| 37 | Viol | Already correct, fields added | A bowed string instrument with a mellow, melancholy tone. | Charisma · Play a known tune (DC 10); Improvise a song (DC 15) | Charisma. Utilize: Play a known tune (DC 10), Improvise a song (DC 15) (text matched the book; fields only) |

## Files changed

There is no migration. The version is now 1.0.211, in both `package.json` files. The SHA-256 values are of the committed bytes.

| File | New / edited | Bytes | SHA-256 |
|---|---|---|---|
| `client/package.json` | edited | 427 | `9f36ae61332a4772713f19f2385525fec21bddadc5faea15f01b8a27b456841f` |
| `client/src/components/creator-next/choiceOptions.js` | edited | 12535 | `e731e150fd6109f266a3a244672a80371c9a70b33130f04f38c4c59a0277c423` |
| `client/src/data/references.js` | edited | 24511 | `abfe076386c769fe2404bc448467d868c939f21681251f2dceb375b053df9ac9` |
| `package.json` | edited | 1398 | `699e4d98403e396f3fdf3ec5aaa551c6c5227ff1918d80fb2ccd957c4287f10b` |
| `tests/creator-round-3.test.js` | edited | 12169 | `7aa3f2cb297d3cff709ebc11fe2fe923e62f30d41e2f10841d981017330bc822` |
| `docs/pm/repo-check-fixes-tools/BRIEF.md` | new | 16079 | `4bed258cf24a1f0ca1ad606ea53050f5e7eb6362ffac903b782370b4c04633d9` |
| `tests/repo-check-fixes-tools.test.js` | new | 13518 | `981c8349a18fedcabcf64f79bce07a2489e42b0b97aab0b25e0207a88238efe4` |

## What was built (in play)

- **The 17 rewritten tools now read the book's way.** When a player picks a tool in the creator (Clan's Craft, the Crafter feat, Skilled and similar pickers), the description says what the book's Utilize action does and what the tool crafts.
  - Calligrapher's Supplies: flourishes "that guard against forgery".
  - The Dice Set: it lets you "discern whether someone is cheating".
  - No "also useful for identifying…" clause remains in any of the 17.
- **The other 20 read exactly as before.**
- **Every tool now knows its book ability and DCs** (for example, Thieves' Tools: Dexterity; pick a lock DC 15, disarm a trap DC 15). Nothing in play uses them yet.

## Test results

This was the builder's full `npm test` on the PC, 2026-11-24. **Files: 256/256 green. Assertions: 19,751 passed, 0 failed.**
- Retried after Windows' native libsql crash, and passed: `creator-next-stage6`, `h2-h3-2024-rules`.
- `pass*` (the crash came after every assertion had passed, so it counts green): `mechanics-hooks-crit`.

**New: `tests/repo-check-fixes-tools.test.js`, 85 passed.** It checks:
- all 37 present and structured;
- the ability and every Utilize DC on all 37, against a table typed from the brief, with each DC keyed to its action;
- each of the 17 rewritten descriptions: the book's Utilize and Craft words present, every invented clause the check named absent, one sentence, and both inversions corrected;
- the 20 matching descriptions byte-identical, against a snapshot of the live strings taken before the edit;
- `toolDescription`, `lookupReference('tool')` and the creator's tool pickers all reading the new sentence.

**Updated: `tests/creator-round-3.test.js`, 46 passed.** It compares against `TOOLS[name].description` now that the entries are structured.

Client build (`npx vite build`): green.

## Cost and usage

I can't measure this session's cost or remaining usage from inside the session. The job made no paid API calls.

## Not done / still open

1. **Nothing uses the new ability and DC data yet,** for checks, crafting or prompts. That is out of scope, and a later job.
2. **Thieves' Tools keeps its unsourced claim "Required proficiency for most locks".** The brief says observed, not fixed.
3. **The Craft lists are not stored as their own field.** Only the sentence carries them for the 17. Store them if a later crafting job needs structured data.
4. **The 20 "matching" texts still carry their own flavor.** Herbalism Kit says "crafting healing potions", Poisoner's Kit "crafting poisons", and the gaming sets and instruments are pure flavor. The check judged them as matching, and the brief locks their text, so they are untouched. They are listed here only so a later pass can decide whether "matching" was meant strictly.

## Decisions made (reversible, for veto)

1. **The shape: `{ description, ability, utilize: [{ action, dc }] }`.**
   - Reversal: rename the fields (three keys) and the one helper.
2. **`ability` is spelled in full ("Intelligence")** rather than abbreviated ("int"), as the book prints it.
   - Reversal: change 37 strings.
3. **Each rewritten sentence lists the book's craft items in the book's order,** joined with "or" for single items ("craft ink or a spell scroll"). Smith's and Woodcarver's keep the book's exclusions inline ("any melee weapon except a club, greatclub, quarterstaff, or whip").
   - Reversal: rewrite the sentences.

## Needs Zach's decision

None.

## How to verify

**Gate:** `npm test` from the repo root (`E:\DnD Meta Game\dnd-meta-game`). Expect all files green, including the new `tests/repo-check-fixes-tools.test.js` (85 assertions).

At **:5173** (never :3000), after `npm run dev` and a hard refresh:
1. Choose **Create New Character**, then **Dwarf**.
2. Set the ancestry feat to **Clan's Craft**, then pick **Calligrapher's Supplies**.
3. The description under the picker reads: "Write text with impressive flourishes that guard against forgery, and craft ink or a spell scroll."

The builder checked this live, with the same result. Pick **Mason's Tools** and it reads "Chisel a symbol or hole in stone, and craft a block and tackle."

## Verification evidence

- Commit `0ab8f0c`, branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`, pushed to `origin`.
- SHA-256 per file: the Files changed table.
- Tests: the Test results section.
- Live check at :5173: the How to verify section (Calligrapher's Supplies under Clan's Craft).
