# Report — repo-check-fixes-feats: the feat catalog becomes the 2024 book

## Understanding first

**The project.** This is a solo D&D 2024 game. One player character adventures in a persistent world, and an AI Dungeon Master runs everyone else. When a character reaches an Ability Score Improvement level (4, 8, 12, 16, 19), the level-up page offers either the score increase or a feat, picked from a list.

**This job.** A 2026-11-24 check against the 2024 Player's Handbook found that the level-up feat list was mostly the 2014 book. Thirty-seven of the 2024 book's 75 feats were missing, including every Fighting Style feat and every Epic Boon. Thirty-six of the feats that were present carried old text, such as Great Weapon Master's −5/+10 trade and Alert's +5 initiative. The list also didn't record the level each feat requires. This job makes the list the 2024 book:
- every one of the 75 feats, in the book's words;
- each feat's category, its prerequisite in the book's wording, and whether it can be taken more than once;
- the book's choice of ability for each +1.

Mobile goes, and Speedy replaces it. Dungeon Delver, Linguist and Martial Adept stay, tagged as 2014 feats. The 13 homebrew feats stay as they are. The game should also stop offering a feat the character can't take yet. The server's own feat list (the text the DM is given) gets the same corrections wherever it disagreed with the book.

**Where my reading differs from the brief, or the live code adds something:**
- **Step 0 (the drift check): no drift.** The live `feats.json` had the 55 entries the brief describes (42 non-homebrew + 13 homebrew), with the quoted 2014 texts. The registry had CORE_FEATS 21, FIGHTING_STYLE_FEATS 10 and ADDED_FEATS 14. I built on it. Pre-job hashes: `feats.json` `5b0ec127ab7d1a31e7c9373183e8f08913969ce011d2607d806f9134941af953`; `featRegistry.js` `f8814ee2eafdd3b8857fb0d388dc579657fdebd685ff7b7da01bbbd7eec0e58b`.
- **The registry had more wrong entries than the brief's item 8 lists.** Item 8 names Sentinel, Skulker, Observant and Resilient. Checking every registry entry against the brief's book text turned up more: Mage Slayer was the 2014 text, and Great Weapon Master had an invented "once per turn". Polearm Master, War Caster and six Fighting Style entries also differed from the book: Great Weapon Fighting, Interception, Protection, Thrown Weapon Fighting, Two-Weapon Fighting and Unarmed Fighting. Defense was imprecise rather than wrong. The acceptance criteria require the two files to agree, and the fix-as-you-find-it rule applies, so I corrected all of them. Each one is listed below.
- **The engine has a "once per turn" on Great Weapon Master that the book lacks.** `server/services/partyAttackService.js:1489` (the `gwmUsed` flag) adds the bonus damage only once per turn. The book text in this brief has no such limit. That is engine behavior, which the brief puts out of scope, so it is **not changed**. It is listed under Not done.
- **The brief's Setup section is out of date.** It still says Zach pulls to the Mac for the gate. HANDOFF.md (2026-11-25) says the PC copy is the only working copy, and I followed HANDOFF.md.

## Verdict

**BUILT + GREEN.** The catalog holds all 75 book feats in book text, and my full-suite run is green: 261/261 files, 19,717 assertions passed, 0 failed. Zach's run is the gate.

## Files changed

Commit `e42abe9` on `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. No migrations.

| File | Status | Size (bytes) | SHA-256 |
|---|---|---:|---|
| `client/src/data/feats.json` | Edited (rebuilt: 55 → 91 entries) | 72,944 | `0b211276e64954d592ec789723b0917d0894a199fb8ab1a2f86888f586274c40` |
| `server/data/featRegistry.js` | Edited (16 entries corrected, Mobile → Speedy) | 26,164 | `30ef903f2aa15c3d7e2dbb942f827e9f5fbd49c2a6e51497ce600a996a892d71` |
| `server/data/featCatalog.js` | New (the server's read of `feats.json` + the level-up check) | 5,742 | `12a8cdcfb30603e47ea20a0b1a7a9500fe1e9b1adddbe1b528265d616e79cd45` |
| `client/src/components/featPickHelpers.js` | Edited (picker checks) | 4,169 | `1902abd71bb0544ea8519e0e665206c76fe073315f0e80fbf94725aa85a9f09a` |
| `client/src/components/LevelUpPage.jsx` | Edited (picker uses the checks) | 96,804 | `5aeffad7481d2cec587995157132361c647a9aa1546e2a4c4f7d586fca247a68` |
| `server/routes/character.js` | Edited (level-up feat branch re-checks the catalog) | 452,951 | `81f4f05bdab10185d2b2c1c31280512b29802fdc82ec243009fe44fa13b5e23f` |
| `tests/repo-check-fixes-feats.test.js` | New | 25,631 | `2d2cc9847e7e6fbaf84a33f5572d445ead5314b829ed1a4eba8fb75208acd346` |
| `tests/integration.test.js` | Edited (Resilient test: CON → WIS; see Decisions) | 153,868 | `80ce333b919f0a41e00af5efc8ff1b4a60dacfce898b6c67caf516050133b420` |
| `CLAUDE.md` | Edited (Feats section describes the new catalog) | 30,740 | `07c22ab6599f150b5ad467f11b3f5e2a4f8c60b38aaf220d8956005e6082bd04` |
| `package.json` | Edited (1.0.215 → 1.0.216) | 1,398 | `348502f60b62eb2c375db53bda15dc9cd64fde25a922559cfbea58b85a9efe6d` |
| `client/package.json` | Edited (1.0.215 → 1.0.216) | 427 | `f1506df7471dd3511eb5351f707c2254a7c74088220f4b1df148b7241c7cdfb4` |
| `docs/pm/repo-check-fixes-feats/BRIEF.md` | New (the brief, placed as asked) | 58,282 | `ec7756be10a101b998921ab0bd4ec7f7a2ec911844be29617fc03229d0a8255f` |
| `docs/pm/reports/repo-check-fixes-feats-REPORT.md` | New (this report) | — | — |

The pre-job `feats.json` and `featRegistry.js` were also backed up outside the repo before editing. Git history holds them too.

## What was built, in gameplay terms

At a level-up that offers "Ability Score Improvement or Feat", the feat list now holds:
- every feat in the 2024 Player's Handbook, in the book's words, with its category next to its name (for example "Chef — General");
- Dungeon Delver, Linguist and Martial Adept, which stay;
- the 13 homebrew feats, unchanged.

When you open a feat, the panel starts with the book's own header line, such as "General Feat (Prerequisite: Level 4+, Strength or Dexterity 13+)". The benefits follow, each one named as in the book: "Heavy Weapon Mastery. …", "Hew. …".

The list greys out a feat the character can't take, and says why:
- **Level:** "requires level 4" for a General feat below level 4, and "requires level 19" for an Epic Boon.
- **Ability scores:** "requires Level 4+, Strength or Dexterity 13+". Either score is enough, as the book says.
- **Fighting Style feats:** need a character that already has the Fighting Style feature.
- **Repeats:** "already taken" for a feat the character holds that the book doesn't mark Repeatable. Ability Score Improvement, Elemental Adept, Magic Initiate and Skilled can be taken again.
- **Resilient:** offers only the abilities the character lacks a saving throw proficiency in. A Fighter sees DEX, INT, WIS and CHA, but not STR or CON.

The +1 choice offers the book's options. Heavily Armored and Heavy Armor Master now offer Constitution or Strength, Chef offers Constitution or Wisdom, and so on. An Epic Boon's +1 can raise a score to 30.

The server re-checks all of this, so a request that skips the page is refused with the same reason.

Great Weapon Master no longer offers −5/+10, Alert gives the Initiative Swap, Lucky gives Proficiency Bonus luck points, and so on through the list. Mobile is gone and Speedy is there.

The DM's feat text (the registry) now matches the book for every book feat it carries. For example, Sentinel no longer claims Disengage doesn't work, and Skulker no longer claims dim-light sight.

## Test results

Full `npm test` on the PC, from the repo root, after the last edit:

```
Files: 261/261 green  |  Assertions: 19717 passed, 0 failed
Retried once after a Windows native crash mid-run (result shown is the retry's): blood-hunter-subclasses.test.js → pass
pass* (Windows native exit crash AFTER all assertions passed — counted green, see run-tests.js): artificer-class.test.js, dungeon-content.test.js, mechanics-hooks-crit.test.js
```

The retry and the `pass*` entries are the known Windows libSQL exit crash that the runner handles (windows-test-portability job). None of those files is touched by this job.

Suites this job touched, each run directly:

| Suite | Result |
|---|---|
| `tests/repo-check-fixes-feats.test.js` (new) | 81 passed, 0 failed |
| `tests/feat-addition-14.test.js` | 142 passed, 0 failed |
| `tests/integration.test.js` | 498/498 (in the full run) |
| `cd client && npx vite build` | built, no errors |

The new suite has eight groups:
1. **Catalog.** 91 entries. All 75 book feats are present, each with the right category and no source tag. The 2014 three are tagged. The 13 homebrew feats are tagged and carry the registry's category. Speedy appears once and Mobile nowhere. Martial Weapon Training and Martial Adept are distinct. Fighting Initiate, Gunner and Aberrant Dragonmark are in neither file.
2. **Prerequisites.** Origin feats have none. All 43 General feats carry the book's prerequisite string exactly, plus minLevel 4. Fighting Style feats carry "Fighting Style Feature". Epic Boons carry Level 19+, and Spell Recall adds Spellcasting Feature. Repeatable is set on exactly the four.
3. **+1 options.** Every book feat's options match a per-feat table of the book's abilities. No Origin feat grants a +1. The cap is 30 on boons and 20 elsewhere.
4. **Book text.** Key book sentences are present: Protection's extended Disadvantage, Unarmed Fighting's 1d4 to a Grappled creature, Overwhelming Strike's "ability score", Magic Initiate's Cleric/Druid/Wizard. A scan of 23 2014 phrases finds none in any book feat.
5. **Registry.** Each correction is checked. Mobile is gone and Speedy is present. The 30 PHB feats in both files agree on category and on the +1's abilities.
6. **Picker helpers.** Level, either-or ability prerequisites, Fighting Style, already-held versus Repeatable, and Resilient's options.
7. **Server catalog check.** Class saves come from `classes.json`. Resilient CON is refused for a Fighter, a fixed +1 is filled in, a choice must be made, Alert can't take a +1, the boon cap is 30, and the ASI feat is routed to the ASI path.
8. **The real level-up route** over a throwaway DB:
   - Refused: Resilient CON on a Fighter, an Epic Boon at level 4, Speedy at Dex 12 / Con 12, Archery with no fighting style, Mobile, Tavern Brawler with a +1, and Alert taken twice.
   - Accepted: Resilient WIS, Great Weapon Master with its Str +1, and Archery for a character with a fighting style.

## Cost and usage

I can't measure this session's cost or the remaining usage from inside the session. Zach can see it on the Claude account usage page against the $30/month cap.

## Per-feat verdicts and evidence

All 75 book feats are listed below, followed by the 2014 and homebrew feats and the registry agreement table.

**Added (37):**
- Origin: Crafter, Musician.
- General: Ability Score Improvement, Chef, Crusher, Fey-Touched, Martial Weapon Training, Piercer, Poisoner, Shadow-Touched, Skill Expert, Slasher, Speedy, Telekinetic, Telepathic.
- All 10 Fighting Style feats.
- All 12 Epic Boons.

**Corrected (36):** Alert, Actor, Athlete, Charger, Crossbow Expert, Defensive Duelist, Dual Wielder, Durable, Elemental Adept, Grappler, Great Weapon Master, Healer, Heavily Armored, Heavy Armor Master, Inspiring Leader, Keen Mind, Lightly Armored, Lucky, Mage Slayer, Magic Initiate, Medium Armor Master, Moderately Armored, Mounted Combatant, Observant, Polearm Master, Resilient, Ritual Caster, Savage Attacker, Sentinel, Sharpshooter, Shield Master, Skulker, Spell Sniper, Tavern Brawler, War Caster, Weapon Master.

**Skilled:** the Repeatable note and flag were added. The rest of its text is unchanged.

**Tough:** already correct. Only its category (Origin) was added.

**Mobile: removed** from both files. The grep (`grep -rni "\bmobile\b"` over `client/src`, `server`, `tests`, then `'mobile'` / `"mobile"` / feat-context searches) found **exactly two feat references**: the `feats.json` entry and the registry's CORE_FEATS line. Both are removed, and Speedy is in their place. Every other "mobile" hit is unrelated: the Bard's "Mobile Flourish" in `classes.json` and `subclasses/bard.js`, a rogue description reading "Quick and mobile", and "mobile illumination" in `kalas.js`. No test, picker, validator or seed data named the feat. A level-up request that still sends `mobile` is now refused (tested).

Every row's "Live benefits text" below was printed from the committed `feats.json`. The text is the book text from the brief, copied verbatim. The book's header line ("General Feat (Prerequisite: …)") is stored as each feat's `description`.

#### Origin (10)

| Feat | Verdict | Prerequisite (stored) | minLevel | +1 (stored) | Repeatable | Live benefits text |
|---|---|---|---|---|---|---|
| Alert | corrected | none | — | — | no | Initiative Proficiency. When you roll Initiative, you can add your Proficiency Bonus to the roll. / Initiative Swap. Immediately after you roll Initiative, you can swap your Initiative with the Initiative of one willing ally in the same combat. You can't make this swap if you or the ally has the Incapacitated condition. |
| Crafter | added | none | — | — | no | Tool Proficiency. You gain proficiency with three different Artisan's Tools of your choice from the Fast Crafting table. / Discount. Whenever you buy a nonmagical item, you receive a 20 percent discount on it. / Fast Crafting. When you finish a Long Rest, you can craft one piece of gear from the Fast Crafting table, provided you have the Artisan's Tools associated with that item and have proficiency with those tools. The item lasts until you finish another Long Rest, at which point the item falls apart. |
| Healer | corrected | none | — | — | no | Battle Medic. If you have a Healer's Kit, you can expend one use of it and tend to a creature within 5 feet of yourself as a Utilize action. That creature can expend one of its Hit Point Dice, and you then roll that die. The creature regains a number of Hit Points equal to the roll plus your Proficiency Bonus. / Healing Rerolls. Whenever you roll a die to determine the number of Hit Points you restore with a spell or with this feat's Battle Medic benefit, you can reroll the die if it rolls a 1, and you must use the new roll. |
| Lucky | corrected | none | — | — | no | Luck Points. You have a number of Luck Points equal to your Proficiency Bonus and can spend the points on the benefits below. You regain your expended Luck Points when you finish a Long Rest. / Advantage. When you roll a d20 for a D20 Test, you can spend 1 Luck Point to give yourself Advantage on the roll. / Disadvantage. When a creature rolls a d20 for an attack roll against you, you can spend 1 Luck Point to impose Disadvantage on that roll. |
| Magic Initiate | corrected | none | — | — | yes | Two Cantrips. You learn two cantrips of your choice from the Cleric, Druid, or Wizard spell list. Intelligence, Wisdom, or Charisma is your spellcasting ability for this feat's spells (choose when you select this feat). / Level 1 Spell. Choose a level 1 spell from the same list you selected for this feat's cantrips. You always have that spell prepared. You can cast it once without a spell slot, and you regain the ability to cast it in that way when you finish a Long Rest. You can also cast the spell using any spell slots you have. / Spell Change. Whenever you gain a new level, you can replace one of the spells you chose for this feat with a different spell of the same level from the chosen spell list. / Repeatable. You can take this feat more than once, but you must choose a different spell list each time. |
| Musician | added | none | — | — | no | Instrument Training. You gain proficiency with three Musical Instruments of your choice. / Encouraging Song. As you finish a Short or Long Rest, you can play a song on a Musical Instrument with which you have proficiency and give Heroic Inspiration to allies who hear the song. The number of allies you can affect in this way equals your Proficiency Bonus. |
| Savage Attacker | corrected | none | — | — | no | You've trained to deal particularly damaging strikes. Once per turn when you hit a target with a weapon, you can roll the weapon's damage dice twice and use either roll against the target. |
| Skilled | Repeatable note added | none | — | — | yes | Gain proficiency in three skills or tools of your choice / Repeatable. You can take this feat more than once. |
| Tavern Brawler | corrected | none | — | — | no | Enhanced Unarmed Strike. When you hit with your Unarmed Strike and deal damage, you can deal Bludgeoning damage equal to 1d4 plus your Strength modifier instead of the normal damage of an Unarmed Strike. / Damage Rerolls. Whenever you roll a damage die for your Unarmed Strike, you can reroll the die if it rolls a 1, and you must use the new roll. / Improvised Weaponry. You have proficiency with improvised weapons. / Push. When you hit a creature with an Unarmed Strike as part of the Attack action on your turn, you can deal damage to the target and also push it 5 feet away from you. You can use this benefit only once per turn. |
| Tough | already correct (category added) | none | — | — | no | Hit point maximum increases by twice your level / +2 HP per level gained |

Skilled's `description` (unchanged) is the book sentence: "You gain proficiency in any combination of three skills or tools of your choice." Tough's `description` (unchanged) is the book text. Crafter also stores the Fast Crafting table as `fastCraftingTable`, with eight tools and their items exactly as in the brief.

#### General (43)

| Feat | Verdict | Prerequisite (stored) | minLevel | +1 (stored) | Repeatable | Live benefits text |
|---|---|---|---|---|---|---|
| Ability Score Improvement | added | Level 4+ | 4 | — | yes | Increase one ability score of your choice by 2, or increase two ability scores of your choice by 1. This feat can't increase an ability score above 20. / Repeatable. You can take this feat more than once. |
| Actor | corrected | Level 4+, Charisma 13+ | 4 | +1 CHA (max 20) | no | Ability Score Increase. Increase your Charisma score by 1, to a maximum of 20. / Impersonation. While you're disguised as a real or fictional person, you have Advantage on Charisma (Deception or Performance) checks to convince others that you are that person. / Mimicry. You can mimic the sounds of other creatures, including speech. A creature that hears the mimicry must succeed on a Wisdom (Insight) check to determine the effect is faked (DC 8 plus your Charisma modifier and Proficiency Bonus). |
| Athlete | corrected | Level 4+, Strength or Dexterity 13+ | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. / Climb Speed. You gain a Climb Speed equal to your Speed. / Hop Up. When you have the Prone condition, you can right yourself with only 5 feet of movement. / Jumping. You can make a running Long or High Jump after moving only 5 feet. |
| Charger | corrected | Level 4+, Strength or Dexterity 13+ | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. / Improved Dash. When you take the Dash action, your Speed increases by 10 feet for that action. / Charge Attack. If you move at least 10 feet in a straight line toward a target immediately before hitting it with a melee attack roll as part of the Attack action, choose one of the following effects: gain a 1d8 bonus to the attack's damage roll, or push the target up to 10 feet away if it is no more than one size larger than you. You can use this benefit only once on each of your turns. |
| Chef | added | Level 4+ | 4 | +1 CON/WIS (max 20) | no | Ability Score Increase. Increase your Constitution or Wisdom score by 1, to a maximum of 20. / Cook's Utensils. You gain proficiency with Cook's Utensils if you don't already have it. / Replenishing Meal. As part of a Short Rest, you can cook special food if you have ingredients and Cook's Utensils on hand. You can prepare enough of this food for a number of creatures equal to 4 plus your Proficiency Bonus. At the end of the Short Rest, any creature who eats the food and spends one or more Hit Dice to regain Hit Points regains an extra 1d8 Hit Points. / Bolstering Treats. With 1 hour of work or when you finish a Long Rest, you can cook a number of treats equal to your Proficiency Bonus if you have ingredients and Cook's Utensils on hand. These special treats last 8 hours after being made. A creature can use a Bonus Action to eat one of those treats to gain a number of Temporary Hit Points equal to your Proficiency Bonus. |
| Crossbow Expert | corrected | Level 4+, Dexterity 13+ | 4 | +1 DEX (max 20) | no | Ability Score Increase. Increase your Dexterity score by 1, to a maximum of 20. / Ignore Loading. You ignore the Loading property of the Hand Crossbow, Heavy Crossbow, and Light Crossbow (all called crossbows elsewhere in this feat). If you're holding one of them, you can load a piece of ammunition into it even if you lack a free hand. / Firing in Melee. Being within 5 feet of an enemy doesn't impose Disadvantage on your attack rolls with crossbows. / Dual Wielding. When you make the extra attack of the Light property, you can add your ability modifier to the damage of the extra attack if that attack is with a crossbow that has the Light property and you aren't already adding that modifier to the damage. |
| Crusher | added | Level 4+ | 4 | +1 STR/CON (max 20) | no | Ability Score Increase. Increase your Strength or Constitution score by 1, to a maximum of 20. / Push. Once per turn, when you hit a creature with an attack that deals Bludgeoning damage, you can move it 5 feet to an unoccupied space if the target is no more than one size larger than you. / Enhanced Critical. When you score a Critical Hit that deals Bludgeoning damage to a creature, attack rolls against that creature have Advantage until the start of your next turn. |
| Defensive Duelist | corrected | Level 4+, Dexterity 13+ | 4 | +1 DEX (max 20) | no | Ability Score Increase. Increase your Dexterity score by 1, to a maximum of 20. / Parry. If you're holding a Finesse weapon and another creature hits you with a melee attack, you can take a Reaction to add your Proficiency Bonus to your Armor Class, potentially causing the attack to miss you. You gain this bonus to your AC against melee attacks until the start of your next turn. |
| Dual Wielder | corrected | Level 4+, Strength or Dexterity 13+ | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. / Enhanced Dual Wielding. When you take the Attack action on your turn and attack with a weapon that has the Light property, you can make one extra attack as a Bonus Action later on the same turn with a different weapon, which must be a Melee weapon that lacks the Two-Handed property. You don't add your ability modifier to the extra attack's damage unless that modifier is negative. / Quick Draw. You can draw or stow two weapons that lack the Two-Handed property when you would normally be able to draw or stow only one. |
| Durable | corrected | Level 4+ | 4 | +1 CON (max 20) | no | Ability Score Increase. Increase your Constitution score by 1, to a maximum of 20. / Defy Death. You have Advantage on Death Saving Throws. / Speedy Recovery. As a Bonus Action, you can expend one of your Hit Point Dice, roll the die, and regain a number of Hit Points equal to the roll. |
| Elemental Adept | corrected | Level 4+, Spellcasting or Pact Magic Feature | 4 | +1 INT/WIS/CHA (max 20) | yes | Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. / Energy Mastery. Choose one of the following damage types: Acid, Cold, Fire, Lightning, or Thunder. Spells you cast ignore Resistance to damage of the chosen type. In addition, when you roll damage for a spell you cast that deals damage of that type, you can treat any 1 on a damage die as a 2. / Repeatable. You can take this feat more than once, but you must choose a different damage type each time for Energy Mastery. |
| Fey-Touched | added | Level 4+ | 4 | +1 INT/WIS/CHA (max 20) | no | Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. / Fey Magic. Choose one level 1 spell from the Divination or Enchantment school of magic. You always have that spell and the Misty Step spell prepared. You can cast each of these spells without expending a spell slot. Once you cast either spell in this way, you can't cast that spell in this way again until you finish a Long Rest. You can also cast these spells using spell slots you have of the appropriate level. The spells' spellcasting ability is the ability increased by this feat. |
| Grappler | corrected | Level 4+, Strength or Dexterity 13+ | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. / Punch and Grab. When you hit a creature with an Unarmed Strike as part of the Attack action on your turn, you can use both the Damage and the Grapple option. You can use this benefit only once per turn. / Attack Advantage. You have Advantage on attack rolls against a creature Grappled by you. / Fast Wrestler. You don't have to spend extra movement to move a creature Grappled by you if the creature is your size or smaller. |
| Great Weapon Master | corrected | Level 4+, Strength 13+ | 4 | +1 STR (max 20) | no | Ability Score Increase. Increase your Strength score by 1, to a maximum of 20. / Heavy Weapon Mastery. When you hit a creature with a weapon that has the Heavy property as part of the Attack action on your turn, you can cause the weapon to deal extra damage to the target. The extra damage equals your Proficiency Bonus. / Hew. Immediately after you score a Critical Hit with a Melee weapon or reduce a creature to 0 Hit Points with one, you can make one attack with the same weapon as a Bonus Action. |
| Heavily Armored | corrected | Level 4+, Medium Armor Training | 4 | +1 CON/STR (max 20) | no | Ability Score Increase. Increase your Constitution or Strength score by 1, to a maximum of 20. / Armor Training. You gain training with Heavy armor. |
| Heavy Armor Master | corrected | Level 4+, Heavy Armor Training | 4 | +1 CON/STR (max 20) | no | Ability Score Increase. Increase your Constitution or Strength score by 1, to a maximum of 20. / Damage Reduction. When you're hit by an attack while you're wearing Heavy armor, any Bludgeoning, Piercing, and Slashing damage dealt to you by that attack is reduced by an amount equal to your Proficiency Bonus. |
| Inspiring Leader | corrected | Level 4+, Wisdom or Charisma 13+ | 4 | +1 WIS/CHA (max 20) | no | Ability Score Increase. Increase your Wisdom or Charisma score by 1, to a maximum of 20. / Bolstering Performance. When you finish a Short or Long Rest, you can give an inspiring performance: a speech, song, or dance. When you do so, choose up to six allies (which can include yourself) within 30 feet of yourself who witness the performance. The chosen creatures each gain Temporary Hit Points equal to your character level plus the modifier of the ability you increased with this feat. |
| Keen Mind | corrected | Level 4+, Intelligence 13+ | 4 | +1 INT (max 20) | no | Ability Score Increase. Increase your Intelligence score by 1, to a maximum of 20. / Lore Knowledge. Choose one of the following skills: Arcana, History, Investigation, Nature, or Religion. If you lack proficiency in the chosen skill, you gain proficiency in it, and if you already have proficiency in it, you gain Expertise in it. / Quick Study. You can take the Study action as a Bonus Action. |
| Lightly Armored | corrected | Level 4+ | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. / Armor Training. You gain training with Light armor and Shields. |
| Mage Slayer | corrected | Level 4+ | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. / Concentration Breaker. When you damage a creature that is concentrating, it has Disadvantage on the saving throw it makes to maintain Concentration. / Guarded Mind. If you fail an Intelligence, a Wisdom, or a Charisma saving throw, you can cause yourself to succeed instead. Once you use this benefit, you can't use it again until you finish a Short or Long Rest. |
| Martial Weapon Training | added | Level 4+ | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. / Weapon Proficiency. You gain proficiency with Martial weapons. |
| Medium Armor Master | corrected | Level 4+, Medium Armor Training | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. / Dexterous Wearer. While you're wearing Medium armor, you can add 3, rather than 2, to your AC if you have a Dexterity score of 16 or higher. |
| Moderately Armored | corrected | Level 4+, Light Armor Training | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. / Armor Training. You gain training with Medium armor. |
| Mounted Combatant | corrected | Level 4+ | 4 | +1 STR/DEX/WIS (max 20) | no | Ability Score Increase. Increase your Strength, Dexterity, or Wisdom score by 1, to a maximum of 20. / Mounted Strike. While mounted, you have Advantage on attack rolls against any unmounted creature within 5 feet of your mount that is at least one size smaller than the mount. / Leap Aside. If your mount is subjected to an effect that allows it to make a Dexterity saving throw to take only half damage, it instead takes no damage if it succeeds on the saving throw and only half damage if it fails. For your mount to gain this benefit, you must be riding it, and neither of you can have the Incapacitated condition. / Veer. While mounted, you can force an attack that hits your mount to hit you instead if you don't have the Incapacitated condition. |
| Observant | corrected | Level 4+, Intelligence or Wisdom 13+ | 4 | +1 INT/WIS (max 20) | no | Ability Score Increase. Increase your Intelligence or Wisdom score by 1, to a maximum of 20. / Keen Observer. Choose one of the following skills: Insight, Investigation, or Perception. If you lack proficiency with the chosen skill, you gain proficiency in it, and if you already have proficiency in it, you gain Expertise in it. / Quick Search. You can take the Search action as a Bonus Action. |
| Piercer | added | Level 4+ | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20. / Puncture. Once per turn, when you hit a creature with an attack that deals Piercing damage, you can reroll one of the attack's damage dice, and you must use the new roll. / Enhanced Critical. When you score a Critical Hit that deals Piercing damage to a creature, you can roll one additional damage die when determining the extra Piercing damage the target takes. |
| Poisoner | added | Level 4+ | 4 | +1 DEX/INT (max 20) | no | Ability Score Increase. Increase your Dexterity or Intelligence score by 1, to a maximum of 20. / Potent Poison. When you make a damage roll that deals Poison damage, it ignores Resistance to Poison damage. / Brew Poison. You gain proficiency with the Poisoner's Kit. With 1 hour of work using such a kit and expending 50 GP worth of materials, you can create a number of poison doses equal to your Proficiency Bonus. As a Bonus Action, you can apply a poison dose to a weapon or piece of ammunition. Once applied, the poison retains its potency for 1 minute or until you deal damage with the poisoned item, whichever is shorter. When a creature takes damage from the poisoned item, that creature must succeed on a Constitution saving throw (DC 8 plus the modifier of the ability increased by this feat and your Proficiency Bonus) or take 2d8 Poison damage and have the Poisoned condition until the end of your next turn. |
| Polearm Master | corrected | Level 4+, Strength or Dexterity 13+ | 4 | +1 DEX/STR (max 20) | no | Ability Score Increase. Increase your Dexterity or Strength score by 1, to a maximum of 20. / Pole Strike. Immediately after you take the Attack action and attack with a Quarterstaff, a Spear, or a weapon that has the Heavy and Reach properties, you can use a Bonus Action to make a melee attack with the opposite end of the weapon. The weapon deals Bludgeoning damage, and the weapon's damage die for this attack is a d4. / Reactive Strike. While you're holding a Quarterstaff, a Spear, or a weapon that has the Heavy and Reach properties, you can take a Reaction to make one melee attack against a creature that enters the reach you have with that weapon. |
| Resilient | corrected | Level 4+ | 4 | +1 any (max 20), only an ability without save proficiency | no | Ability Score Increase. Choose one ability in which you lack saving throw proficiency. Increase the chosen ability score by 1, to a maximum of 20. / Saving Throw Proficiency. You gain saving throw proficiency with the chosen ability. |
| Ritual Caster | corrected | Level 4+; Intelligence, Wisdom, or Charisma 13+ | 4 | +1 INT/WIS/CHA (max 20) | no | Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. / Ritual Spells. Choose a number of level 1 spells equal to your Proficiency Bonus that have the Ritual tag. You always have those spells prepared, and you can cast them with any spell slots you have. The spells' spellcasting ability is the ability increased by this feat. Whenever your Proficiency Bonus increases thereafter, you can add an additional level 1 spell with the Ritual tag to the spells always prepared with this feature. / Quick Ritual. With this benefit, you can cast a Ritual spell that you have prepared using its regular casting time rather than the extended time for a Ritual. Doing so doesn't require a spell slot. Once you cast the spell in this way, you can't use this benefit again until you finish a Long Rest. |
| Sentinel | corrected | Level 4+, Strength or Dexterity 13+ | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. / Guardian. Immediately after a creature within 5 feet of you takes the Disengage action or hits a target other than you with an attack, you can make an Opportunity Attack against that creature. / Halt. When you hit a creature with an Opportunity Attack, the creature's Speed becomes 0 for the rest of the current turn. |
| Shadow-Touched | added | Level 4+ | 4 | +1 INT/WIS/CHA (max 20) | no | Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. / Shadow Magic. Choose one level 1 spell from the Illusion or Necromancy school of magic. You always have that spell and the Invisibility spell prepared. You can cast each of these spells without expending a spell slot. Once you cast either spell in this way, you can't cast that spell in this way again until you finish a Long Rest. You can also cast these spells using spell slots you have of the appropriate level. The spells' spellcasting ability is the ability increased by this feat. |
| Sharpshooter | corrected | Level 4+, Dexterity 13+ | 4 | +1 DEX (max 20) | no | Ability Score Increase. Increase your Dexterity score by 1, to a maximum of 20. / Bypass Cover. Your ranged attacks with weapons ignore Half Cover and Three-Quarters Cover. / Firing in Melee. Being within 5 feet of an enemy doesn't impose Disadvantage on your attack rolls with Ranged weapons. / Long Shots. Attacking at long range doesn't impose Disadvantage on your attack rolls with Ranged weapons. |
| Shield Master | corrected | Level 4+, Shield Training | 4 | +1 STR (max 20) | no | Ability Score Increase. Increase your Strength score by 1, to a maximum of 20. / Shield Bash. If you attack a creature within 5 feet of you as part of the Attack action and hit with a Melee weapon, you can immediately bash the target with your Shield if it's equipped, forcing the target to make a Strength saving throw (DC 8 plus your Strength modifier and Proficiency Bonus). On a failed save, you either push the target 5 feet from you or cause it to have the Prone condition (your choice). You can use this benefit only once on each of your turns. / Interpose Shield. If you're subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you can take a Reaction to take no damage if you succeed on the saving throw and are holding a Shield. |
| Skill Expert | added | Level 4+ | 4 | +1 any (max 20) | no | Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 20. / Skill Proficiency. You gain proficiency in one skill of your choice. / Expertise. Choose one skill in which you have proficiency but lack Expertise. You gain Expertise with that skill. |
| Skulker | corrected | Level 4+, Dexterity 13+ | 4 | +1 DEX (max 20) | no | Ability Score Increase. Increase your Dexterity score by 1, to a maximum of 20. / Blindsight. You have Blindsight with a range of 10 feet. / Fog of War. You exploit the distractions of battle, gaining Advantage on any Dexterity (Stealth) check you make as part of the Hide action during combat. / Sniper. If you make an attack roll while hidden and the roll misses, making the attack roll doesn't reveal your location. |
| Slasher | added | Level 4+ | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. / Hamstring. Once per turn when you hit a creature with an attack that deals Slashing damage, you can reduce the Speed of that creature by 10 feet until the start of your next turn. / Enhanced Critical. When you score a Critical Hit that deals Slashing damage to a creature, it has Disadvantage on attack rolls until the start of your next turn. |
| Speedy | added | Level 4+, Dexterity or Constitution 13+ | 4 | +1 DEX/CON (max 20) | no | Ability Score Increase. Increase your Dexterity or Constitution score by 1, to a maximum of 20. / Speed Increase. Your Speed increases by 10 feet. / Dash over Difficult Terrain. When you take the Dash action on your turn, Difficult Terrain doesn't cost you extra movement for the rest of that turn. / Agile Movement. Opportunity Attacks have Disadvantage against you. |
| Spell Sniper | corrected | Level 4+, Spellcasting or Pact Magic Feature | 4 | +1 INT/WIS/CHA (max 20) | no | Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. / Bypass Cover. Your attack rolls for spells ignore Half Cover and Three-Quarters Cover. / Casting in Melee. Being within 5 feet of an enemy doesn't impose Disadvantage on your attack rolls with spells. / Increased Range. When you cast a spell that has a range of at least 10 feet and requires you to make an attack roll, you can increase the spell's range by 60 feet. |
| Telekinetic | added | Level 4+ | 4 | +1 INT/WIS/CHA (max 20) | no | Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. / Minor Telekinesis. You learn the Mage Hand spell. You can cast it without Verbal or Somatic components, you can make the spectral hand Invisible, and its range and the distance it can be away from you both increase by 30 feet when you cast it. The spell's spellcasting ability is the ability increased by this feat. / Telekinetic Shove. As a Bonus Action, you can telekinetically shove one creature you can see within 30 feet of yourself. When you do so, the target must succeed on a Strength saving throw (DC 8 plus the ability modifier of the score increased by this feat and your Proficiency Bonus) or be moved 5 feet toward or away from you. |
| Telepathic | added | Level 4+ | 4 | +1 INT/WIS/CHA (max 20) | no | Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. / Telepathic Utterance. You can speak telepathically to any creature you can see within 60 feet of yourself. Your telepathic utterances are in a language you know, and the creature understands you only if it knows that language. Your communication doesn't give the creature the ability to respond to you telepathically. / Detect Thoughts. You always have the Detect Thoughts spell prepared. You can cast it without a spell slot or spell components, and you must finish a Long Rest before you can cast it in this way again. You can also cast it using spell slots you have of the appropriate level. Your spellcasting ability for the spell is the ability increased by this feat. |
| War Caster | corrected | Level 4+, Spellcasting or Pact Magic Feature | 4 | +1 INT/WIS/CHA (max 20) | no | Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. / Concentration. You have Advantage on Constitution saving throws that you make to maintain Concentration. / Reactive Spell. When a creature provokes an Opportunity Attack from you by leaving your reach, you can take a Reaction to cast a spell at the creature rather than making an Opportunity Attack. The spell must have a casting time of one action and must target only that creature. / Somatic Components. You can perform the Somatic components of spells even when you have weapons or a Shield in one or both hands. |
| Weapon Master | corrected | Level 4+ | 4 | +1 STR/DEX (max 20) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. / Mastery Property. Your training with weapons allows you to use the mastery property of one kind of Simple or Martial weapon of your choice, provided you have proficiency with it. Whenever you finish a Long Rest, you can change the kind of weapon to another eligible kind. |

#### Fighting Style (10)

| Feat | Verdict | Prerequisite (stored) | minLevel | +1 (stored) | Repeatable | Live benefits text |
|---|---|---|---|---|---|---|
| Archery | added | Fighting Style Feature | — | — | no | You gain a +2 bonus to attack rolls you make with Ranged weapons. |
| Blind Fighting | added | Fighting Style Feature | — | — | no | You have Blindsight with a range of 10 feet. |
| Defense | added | Fighting Style Feature | — | — | no | While you're wearing Light, Medium, or Heavy armor, you gain a +1 bonus to Armor Class. |
| Dueling | added | Fighting Style Feature | — | — | no | When you're holding a Melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon. |
| Great Weapon Fighting | added | Fighting Style Feature | — | — | no | When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit. |
| Interception | added | Fighting Style Feature | — | — | no | When a creature you can see hits another creature within 5 feet of you with an attack roll, you can take a Reaction to reduce the damage dealt to the target by 1d10 plus your Proficiency Bonus. You must be holding a Shield or a Simple or Martial weapon to use this Reaction. |
| Protection | added | Fighting Style Feature | — | — | no | When a creature you can see attacks a target other than you that is within 5 feet of you, you can take a Reaction to interpose your Shield if you're holding one. You impose Disadvantage on the triggering attack roll and all other attack rolls against the target until the start of your next turn if you remain within 5 feet of the target. |
| Thrown Weapon Fighting | added | Fighting Style Feature | — | — | no | When you hit with a ranged attack roll using a weapon that has the Thrown property, you gain a +2 bonus to the damage roll. |
| Two-Weapon Fighting | added | Fighting Style Feature | — | — | no | When you make an extra attack as a result of using a weapon that has the Light property, you can add your ability modifier to the damage of that attack if you aren't already adding it to the damage. |
| Unarmed Fighting | added | Fighting Style Feature | — | — | no | When you hit with your Unarmed Strike and deal damage, you can deal Bludgeoning damage equal to 1d6 plus your Strength modifier instead of the normal damage of an Unarmed Strike. If you aren't holding any weapons or a Shield when you make the attack roll, the d6 becomes a d8. At the start of each of your turns, you can deal 1d4 Bludgeoning damage to one creature Grappled by you. |

#### Epic Boon (12)

| Feat | Verdict | Prerequisite (stored) | minLevel | +1 (stored) | Repeatable | Live benefits text |
|---|---|---|---|---|---|---|
| Boon of Combat Prowess | added | Level 19+ | 19 | +1 any (max 30) | no | Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. / Peerless Aim. When you miss with an attack roll, you can hit instead. Once you use this benefit, you can't use it again until the start of your next turn. |
| Boon of Dimensional Travel | added | Level 19+ | 19 | +1 any (max 30) | no | Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. / Blink Steps. Immediately after you take the Attack action or the Magic action, you can teleport up to 30 feet to an unoccupied space you can see. |
| Boon of Energy Resistance | added | Level 19+ | 19 | +1 any (max 30) | no | Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. / Energy Resistances. You gain Resistance to two of the following damage types of your choice: Acid, Cold, Fire, Lightning, Necrotic, Poison, Psychic, Radiant, or Thunder. Whenever you finish a Long Rest, you can change your choices. / Energy Redirection. When you take damage of one of the types chosen for the Energy Resistances benefit, you can take a Reaction to direct damage of the same type toward another creature you can see within 60 feet of yourself that isn't behind Total Cover. If you do so, that creature must succeed on a Dexterity saving throw (DC 8 plus your Constitution modifier and Proficiency Bonus) or take damage equal to 2d12 plus your Constitution modifier. |
| Boon of Fate | added | Level 19+ | 19 | +1 any (max 30) | no | Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. / Improve Fate. When you or another creature within 60 feet of you succeeds on or fails a D20 Test, you can roll 2d4 and apply the total rolled as a bonus or penalty to the d20 roll. Once you use this benefit, you can't use it again until you roll Initiative or finish a Short or Long Rest. |
| Boon of Fortitude | added | Level 19+ | 19 | +1 any (max 30) | no | Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. / Fortified Health. Your Hit Point maximum increases by 40. In addition, whenever you regain Hit Points, you can regain additional Hit Points equal to your Constitution modifier. Once you've regained these additional Hit Points, you can't do so again until the start of your next turn. |
| Boon of Irresistible Offense | added | Level 19+ | 19 | +1 STR/DEX (max 30) | no | Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 30. / Overcome Defenses. The Bludgeoning, Piercing, and Slashing damage you deal always ignores Resistance. / Overwhelming Strike. When you roll a 20 on the d20 for an attack roll, you can deal extra damage to the target equal to the ability score increased by this feat. The extra damage's type is the same as the attack's type. |
| Boon of Recovery | added | Level 19+ | 19 | +1 any (max 30) | no | Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. / Last Stand. When you would be reduced to 0 Hit Points, you can drop to 1 Hit Point instead and regain a number of Hit Points equal to half your Hit Point maximum. Once you use this benefit, you can't use it again until you finish a Long Rest. / Recover Vitality. You have a pool of ten d10s. As a Bonus Action, you can expend dice from the pool, roll those dice, and regain a number of Hit Points equal to the roll's total. You regain all the expended dice when you finish a Long Rest. |
| Boon of Skill | added | Level 19+ | 19 | +1 any (max 30) | no | Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. / All-Around Adept. You gain proficiency in all skills. / Expertise. Choose one skill in which you lack Expertise. You gain Expertise in that skill. |
| Boon of Speed | added | Level 19+ | 19 | +1 any (max 30) | no | Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. / Escape Artist. As a Bonus Action, you can take the Disengage action, which also ends the Grappled condition on you. / Quickness. Your Speed increases by 30 feet. |
| Boon of Spell Recall | added | Level 19+, Spellcasting Feature | 19 | +1 INT/WIS/CHA (max 30) | no | Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 30. / Free Casting. Whenever you cast a spell with a level 1–4 spell slot, roll 1d4. If the number you roll is the same as the slot's level, the slot isn't expended. |
| Boon of the Night Spirit | added | Level 19+ | 19 | +1 any (max 30) | no | Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. / Merge with Shadows. While within Dim Light or Darkness, you can give yourself the Invisible condition as a Bonus Action. The condition ends on you immediately after you take an action, a Bonus Action, or a Reaction. / Shadowy Form. While within Dim Light or Darkness, you have Resistance to all damage except Psychic and Radiant. |
| Boon of Truesight | added | Level 19+ | 19 | +1 any (max 30) | no | Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. / Truesight. You have Truesight with a range of 60 feet. |

#### The 3 staying 2014 feats and the 13 homebrew feats

| Feat | Verdict | source | category | Text changed? |
|---|---|---|---|---|
| Dungeon Delver | kept (2014, tagged) | 2014 | General | no — identical to the pre-job entry |
| Linguist | kept (2014, tagged) | 2014 | General | no — identical to the pre-job entry |
| Martial Adept | kept (2014, tagged) | 2014 | General | no — identical to the pre-job entry |
| Tactician | kept (homebrew) | Homebrew — DNDBlue Feat Collection v2.4 | General | no — identical to the pre-job entry |
| Sage Advice | kept (homebrew) | Homebrew — Fantastic Feats of Forgotten Realms | General | no — identical to the pre-job entry |
| Hound | kept (homebrew) | Homebrew — DNDBlue Feat Collection v2.4 | General | no — identical to the pre-job entry |
| Feather Foot | kept (homebrew) | Homebrew — DNDBlue Feat Collection v2.4 | General | no — identical to the pre-job entry |
| Seismic Touch | kept (homebrew) | Homebrew — DNDBlue Feat Collection v2.4 | General | no — identical to the pre-job entry |
| Trapper | kept (homebrew) | Homebrew — Book of Revised Feats | General | no — identical to the pre-job entry |
| Friend of the Forest | kept (homebrew) | Homebrew — DNDBlue Feat Collection v2.4 | General | no — identical to the pre-job entry |
| Elusive | kept (homebrew) | Homebrew — DNDBlue Feat Collection v2.4 | General | no — identical to the pre-job entry |
| Sling Expert | kept (homebrew) | Homebrew — Book of Revised Feats | General | no — identical to the pre-job entry |
| Mountaineer | kept (homebrew) | Homebrew — DNDBlue Feat Collection v2.4 | General | no — identical to the pre-job entry |
| Quick Draw | kept (homebrew) | Homebrew — Fantastic Feats of Forgotten Realms | General | no — identical to the pre-job entry |
| Silver Tongue | kept (homebrew) | Homebrew — adaptation of Xanathar's Guide to Everything | General | no — identical to the pre-job entry |
| Elegant Maneuver | kept (homebrew) | Homebrew — adaptation of Xanathar's Guide to Everything | General | no — identical to the pre-job entry |

#### Registry ↔ catalog agreement (every PHB feat in both files, after the rebuild)

| Feat | Registry category | Catalog category | Registry effect (DM prompt text) | Agrees with the book text in the catalog? |
|---|---|---|---|---|
| Alert | origin | Origin | Add your proficiency bonus to Initiative; immediately after rolling Initiative, you may swap your Initiative with a willing ally in the same combat (neither can have the Incapacitated condition) | yes (unchanged; already agreed) |
| Crafter | origin | Origin | Proficiency with three Artisan's Tools of your choice from the Fast Crafting table; 20% discount on nonmagical items; at the end of a Long Rest, craft one piece of gear from the Fast Crafting table (requires the associated tools and proficiency with them); the crafted item lasts until you finish another Long Rest, then falls apart | yes (unchanged; already agreed) |
| Healer | origin | Origin | With a Healer's Kit, expend one use as a Utilize action to tend a creature within 5 ft; that creature expends one of its Hit Point Dice and regains HP equal to the roll + your proficiency bonus; when you roll dice to restore HP with a spell or this feat's Battle Medic benefit, reroll any 1s (must use the new roll) | yes (unchanged; already agreed) |
| Lucky | origin | Origin | After a long rest, Luck Points equal to your proficiency bonus; spend one to gain advantage on a d20 test, or to impose disadvantage on an attack roll against you | yes (unchanged; already agreed) |
| Magic Initiate | origin | Origin | Choose one spell list — Cleric, Druid, or Wizard; learn two cantrips and one level 1 spell from it (Intelligence, Wisdom, or Charisma is your spellcasting ability, chosen when you take the feat); the level 1 spell is always prepared, castable once per Long Rest without a slot and with spell slots thereafter; on gaining a level, replace one feat spell with another of the same level from the list; repeatable with a different list | yes (unchanged; already agreed) |
| Musician | origin | Origin | Proficiency with three musical instruments of your choice; as you finish a Short or Long Rest, play a song on an instrument you are proficient with to give Heroic Inspiration to allies who hear it, up to your proficiency bonus in allies | yes (unchanged; already agreed) |
| Savage Attacker | origin | Origin | Once per turn, when you hit a target with a weapon, roll the weapon's damage dice twice and use either roll against the target | yes (unchanged; already agreed) |
| Skilled | origin | Origin | Proficiency in any combination of three skills or tools of your choice; repeatable | yes (unchanged; already agreed) |
| Tavern Brawler | origin | Origin | When you hit with an Unarmed Strike and deal damage, deal 1d4 + Strength bludgeoning instead of the normal damage; reroll any 1 on an Unarmed Strike damage die (must use the new roll); proficiency with improvised weapons; once per turn, when you hit a creature with an Unarmed Strike as part of the Attack action, push it 5 ft away in addition to dealing damage | yes (unchanged; already agreed) |
| Tough | origin | Origin | Your Hit Point maximum increases by twice your character level when you gain this feat; thereafter it increases by 2 each time you level up | yes (unchanged; already agreed) |
| Great Weapon Master | general | General | +1 Strength; Heavy Weapon Mastery: when you hit a creature with a Heavy weapon as part of the Attack action on your turn, you can deal extra damage equal to your proficiency bonus; Hew: immediately after you score a Critical Hit with a Melee weapon or reduce a creature to 0 HP with one, you can make one attack with the same weapon as a Bonus Action | yes (corrected this job) |
| Mage Slayer | general | General | +1 Strength or Dexterity; Concentration Breaker: a concentrating creature you damage has disadvantage on the save to maintain Concentration; Guarded Mind: if you fail an Intelligence, Wisdom, or Charisma saving throw, you can succeed instead (once per Short or Long Rest) | yes (corrected this job) |
| Observant | general | General | +1 Intelligence or Wisdom; Keen Observer: choose Insight, Investigation, or Perception — gain proficiency in it, or Expertise if already proficient; Quick Search: take the Search action as a Bonus Action | yes (corrected this job) |
| Polearm Master | general | General | +1 Dexterity or Strength; Pole Strike: immediately after you take the Attack action and attack with a Quarterstaff, a Spear, or a weapon with the Heavy and Reach properties, you can use a Bonus Action to make a melee attack with the opposite end (Bludgeoning, d4 damage die); Reactive Strike: while holding such a weapon, you can take a Reaction to make one melee attack against a creature that enters the reach you have with that weapon | yes (corrected this job) |
| Resilient | general | General | +1 to one ability in which you lack saving throw proficiency (max 20); you gain saving throw proficiency with that ability | yes (corrected this job) |
| Sentinel | general | General | +1 Strength or Dexterity; Guardian: immediately after a creature within 5 ft of you takes the Disengage action or hits a target other than you with an attack, you can make an Opportunity Attack against it; Halt: when you hit a creature with an Opportunity Attack, its Speed becomes 0 for the rest of the current turn | yes (corrected this job) |
| Sharpshooter | general | General | +1 Dexterity; no disadvantage at long range; ignore half and three-quarters cover; no disadvantage on ranged attacks within 5 ft of an enemy | yes (unchanged; already agreed) |
| Skulker | general | General | +1 Dexterity; Blindsight 10 ft; Fog of War: advantage on Dexterity (Stealth) checks made as part of the Hide action during combat; Sniper: if you attack while hidden and miss, the attack roll does not reveal your location | yes (corrected this job) |
| Speedy | general | General | +1 Dexterity or Constitution; your Speed increases by 10 ft; when you take the Dash action, Difficult Terrain costs no extra movement for the rest of that turn; Opportunity Attacks have disadvantage against you | yes (corrected this job) |
| War Caster | general | General | +1 Intelligence, Wisdom, or Charisma; advantage on Constitution saves to maintain Concentration; Reactive Spell: when a creature provokes an Opportunity Attack from you by leaving your reach, you can take a Reaction to cast a spell at it instead (casting time one action, targets only that creature); you can perform Somatic components with weapons or a Shield in one or both hands | yes (corrected this job) |
| Archery | fighting_style | Fighting Style | +2 to attack rolls with ranged weapons | yes (unchanged; already agreed) |
| Blind Fighting | fighting_style | Fighting Style | Blindsight 10 ft (prompt-only: needs item 4 positioning to enforce) | yes (unchanged; already agreed) |
| Defense | fighting_style | Fighting Style | +1 AC while wearing Light, Medium, or Heavy armor | yes (corrected this job) |
| Dueling | fighting_style | Fighting Style | +2 damage with a melee weapon wielded in one hand and no other weapon | yes (unchanged; already agreed) |
| Great Weapon Fighting | fighting_style | Fighting Style | When you roll damage for an attack with a Melee weapon you hold with two hands, treat any 1 or 2 on a damage die as a 3; the weapon must have the Two-Handed or Versatile property | yes (corrected this job) |
| Interception | fighting_style | Fighting Style | Reaction when a creature you can see hits another creature within 5 ft of you with an attack roll: reduce the damage to the target by 1d10 + proficiency bonus; you must be holding a Shield or a Simple or Martial weapon (prompt-only: needs item 3 reactions) | yes (corrected this job) |
| Protection | fighting_style | Fighting Style | Reaction when a creature you can see attacks a target other than you within 5 ft of you, if you are holding a Shield: impose disadvantage on the triggering attack roll and on all other attack rolls against the target until the start of your next turn, if you remain within 5 ft of the target (prompt-only: needs item 3 reactions) | yes (corrected this job) |
| Thrown Weapon Fighting | fighting_style | Fighting Style | +2 to the damage roll when you hit with a ranged attack roll using a weapon that has the Thrown property | yes (corrected this job) |
| Two-Weapon Fighting | fighting_style | Fighting Style | When you make an extra attack as a result of using a weapon with the Light property, add your ability modifier to that attack's damage if you are not already adding it | yes (corrected this job) |
| Unarmed Fighting | fighting_style | Fighting Style | When you hit with an Unarmed Strike and deal damage, deal 1d6 + Strength modifier bludgeoning damage instead, or 1d8 if you are not holding any weapons or a Shield when you make the attack roll; at the start of each of your turns, you can deal 1d4 bludgeoning damage to one creature Grappled by you | yes (corrected this job) |

Book feats in the catalog with no registry entry (45): Ability Score Improvement, Actor, Athlete, Charger, Chef, Crossbow Expert, Crusher, Defensive Duelist, Dual Wielder, Durable, Elemental Adept, Fey-Touched, Grappler, Heavily Armored, Heavy Armor Master, Inspiring Leader, Keen Mind, Lightly Armored, Martial Weapon Training, Medium Armor Master, Moderately Armored, Mounted Combatant, Piercer, Poisoner, Ritual Caster, Shadow-Touched, Shield Master, Skill Expert, Slasher, Spell Sniper, Telekinetic, Telepathic, Weapon Master, Boon of Combat Prowess, Boon of Dimensional Travel, Boon of Energy Resistance, Boon of Fate, Boon of Fortitude, Boon of Irresistible Offense, Boon of Recovery, Boon of Skill, Boon of Speed, Boon of Spell Recall, Boon of the Night Spirit, Boon of Truesight.

## Registry fixes (item 8), with before → after

Each fix replaced one registry line in place.

| Registry entry | Before (pre-job) | Why it was wrong |
|---|---|---|
| Observant | "+1 Intelligence or Wisdom; +5 passive Perception and Investigation; can read lips" | 2014 (named in the brief) |
| Sentinel | "...creatures you hit with opportunity attacks cannot use Disengage to avoid them" | invented clause; the 2024 Guardian trigger was missing (named in the brief) |
| Skulker | "...you can see in dim light as if it were bright within 60 ft for the purpose of hiding" | invented clause, and 2014 benefits (named in the brief) |
| Resilient | "+1 to the chosen ability score; proficiency in that ability's saving throws" | missing "lack saving throw proficiency" (named in the brief) |
| Mobile | the 2014 feat | removed; Speedy added (named in the brief) |
| Mage Slayer | "Reaction attack when an adjacent creature casts a spell; targets have disadvantage on concentration saves" | **2014 text, not named in the brief**; no +1 and no Guarded Mind |
| Great Weapon Master | "...extra damage equal to your proficiency bonus (once per turn)..." | the **"once per turn" is not in the book**; Hew lacked "Melee" / "same weapon" |
| Polearm Master | "...glaive, halberd, quarterstaff, or spear; opportunity attack when an enemy enters your reach" | the book's list is Quarterstaff, Spear, or any Heavy + Reach weapon (so a pike counts too); it's a Reaction attack |
| War Caster | "...can cast spells as opportunity attacks..." | missing "by leaving your reach" |
| Great Weapon Fighting | "a damage die cannot roll below 3" | missing the Two-Handed or Versatile requirement |
| Interception | "reduce damage to a creature within 5 ft..." | missing "a creature you can see hits" and the Shield-or-weapon requirement |
| Protection | "impose disadvantage on an attack roll..." | missing the extended Disadvantage (the brief notes this for the catalog) |
| Thrown Weapon Fighting | "+2 damage with thrown weapons" | the book applies it only to a ranged attack roll with a Thrown weapon |
| Two-Weapon Fighting | "add your ability modifier to the damage of your off-hand attack" | the book's trigger is the Light property's extra attack, if you aren't already adding the modifier |
| Unarmed Fighting | "...or 1d8 if you are not wielding weapons or a shield" | missing the 1d4 to a Grappled creature (the brief notes this for the catalog) |
| Defense | "+1 AC while wearing armor" | made precise: Light, Medium, or Heavy armor |

Entries left untouched because they already agreed with the book: Alert, Lucky, Sharpshooter, Savage Attacker, Crafter, Healer, Magic Initiate, Musician, Skilled, Tavern Brawler, Tough, Archery, Blind Fighting, Dueling. Also left untouched: Dungeon Delver (a 2014 feat, which agrees with the catalog's unchanged text) and every homebrew entry (ADDED_FEATS, including the registry-only `energy_affinity`, and the JSON rulesets). The "(prompt-only: needs item 3 reactions / item 4 positioning)" engine notes on Blind Fighting, Interception and Protection were kept, because they describe what the engine does.

## Field shapes chosen (for the PM's veto)

Every catalog entry has:
- `category`: `"Origin"`, `"General"`, `"Fighting Style"` or `"Epic Boon"`. The registry keeps its own lowercase keys (`origin`, `general`, `fighting_style`), and the test maps between them.
- `prerequisites`: a string in the book's wording, or `null` for Origin feats.
- `repeatable`: a boolean on every entry; `true` on exactly four.

Book feats also carry these structured gates, which the picker and the server enforce:
- `minLevel`: 4 on every General feat, 19 on every Epic Boon. Absent means none.
- `prerequisiteScore`: every listed score is required, e.g. `{ "dex": 13 }`. This shape already existed for the homebrew feats.
- `prerequisiteScoreAny`: any one listed score is enough, e.g. `{ "str": 13, "dex": 13 }`. This is new, for the book's "X or Y 13+".
- `prerequisiteFeature`: one of `"fighting_style"` (enforced), `"spellcasting_or_pact_magic"`, `"spellcasting"`, `"light_armor_training"`, `"medium_armor_training"`, `"heavy_armor_training"`, or `"shield_training"`. Only the first is enforced; the others are recorded but not checked.

**ASI-choice shape.** `abilityIncrease` stores the book's +1:
- a single ability: `{ "ability": "str", "amount": 1, "max": 20 }`;
- a choice: `{ "choice": ["con", "str"], "amount": 1, "max": 20 }`;
- Resilient adds `"lackingSaveProficiency": true`;
- Epic Boons use `"max": 30`.

The picker offers the options, and the level-up route checks the pick and stores it as the feat's `abilityChoice` (an existing field). A single-option feat gets its +1 filled in; a choice feat with no pick is refused. The Ability Score Improvement feat has no `abilityIncrease`, because the existing ASI path is that feat.

## Not done / still open

- **Effects not wired in the engine (correct text only).** Most new and corrected feats are rules text the DM reads. The engine doesn't resolve their mechanics, and the brief puts that wiring in a later job. The feats the engine already acts on are:
  - Alert's +PB to initiative;
  - Great Weapon Master's +PB damage;
  - six Fighting Style feats, through `classFeatureService.js` and `partyAttackService.js:294`. Archery, Dueling, Thrown Weapon Fighting and Great Weapon Fighting are applied to the attack math. Defense is applied to AC. Two-Weapon Fighting restores the off-hand modifier. Unarmed Fighting is a note in the attack panel only, with its damage not applied. Its new 1d4 to a Grappled creature, and Great Weapon Fighting's new Two-Handed-or-Versatile requirement, are not checked by the engine.

  Everything else is text only. That covers every Epic Boon, Speedy's +10 Speed, Boon of Fortitude's +40 HP, Tough's HP, Skill Expert's skill picks, and the spell picks for Fey-Touched, Shadow-Touched, Telekinetic and Telepathic. The +1 to an ability score is applied by the level-up for every feat that has one.
- **The DM has no effect text for 45 of the catalog's 75 book feats.** The registry, which feeds the DM prompt's FEAT EFFECTS block, carries only the 30 PHB feats it had before, with Mobile replaced by Speedy. A character holding a newly added feat such as Chef or Boon of Fate appears in the DM prompt by name only. Adding 45 registry entries was outside item 8, so it is not done. It is a natural follow-up brief. The 45 are listed below the agreement table.
- **Sub-choices the book asks for are not offered by the picker.** These are: Skill Expert's skill and Expertise; Keen Mind's and Observant's skill; Fey-Touched's and Shadow-Touched's level 1 spell; Ritual Caster's ritual spells; Weapon Master's weapon; Crafter's and Musician's tools; Boon of Energy Resistance's two damage types; Boon of Skill's Expertise. The level-up page has never sent feat sub-choices (`asiChoice.featChoices` is read by the server but never sent by the client). That was true before this job and is unchanged.
- **Prerequisites recorded but not enforced:** Spellcasting or Pact Magic Feature (Elemental Adept, Spell Sniper, War Caster, Boon of Spell Recall), armor training (Heavily Armored, Heavy Armor Master, Medium Armor Master, Moderately Armored) and Shield Training (Shield Master). The character record has no reliable single source for "has armor training" or "has the Spellcasting feature" today. The text shows the prerequisite, but the picker doesn't grey these feats out.
- **Repeatable sub-rules not enforced:** Magic Initiate needs a different spell list each time, and Elemental Adept a different damage type. Taking either again is allowed, but the "different" part isn't checked. This is a rare corner and a known edge.
- **Great Weapon Master's "once per turn" in the engine** (`server/services/partyAttackService.js:1489`, `gwmUsed`; comment at `server/services/classFeatureService.js:163`). The book text has no per-turn limit. The engine limits the bonus damage to once per turn, so it under-pays when a character with Extra Attack hits twice with a Heavy weapon. This is engine behavior, outside this brief. A one-line fix brief can remove the flag check.
- **L19 still offers ASI-or-feat, not a dedicated Epic Boon pick.** The note in `levelProgression.js` says to replace the L19 ASI entry when an Epic Boon picker exists. The level-up picker now offers the Epic Boons at level 19+ (and greys them out below), so L19 is effectively a boon-or-feat-or-ASI pick. The book's L19 is "an Epic Boon feat or another feat". Restricting L19 to that set is left as is.
- **Fighting Style feats taken at level-up need a character that already has one.** That is the book's Fighting Style feature prerequisite. A class whose Fighting Style feature arrives at this same level (Paladin or Ranger at 2) picks its style through the class's own picker, as before, not through this list.

## Decisions made (reversible, for veto)

1. **Each book feat's `description` is the book's category header line**, e.g. "General Feat (Prerequisite: Level 4+, Charisma 13+)", and each `benefits` string is "Benefit Name. Book text." This was chosen instead of writing an intro sentence, which would have been invented text. Tough and Skilled keep their existing description, as the brief says. *Reversal cost:* one field per entry in a script.
2. **The catalog was rebuilt by a script, not patched by hand.** The brief says the client catalog is rebuilt. Homebrew and 2014 entries are carried over field-for-field; the test and the agreement table show no change. JSON formatting is now uniform, so the few previously inline `abilityIncrease` objects are now multi-line. *Reversal cost:* none needed; the content is identical.
3. **Book feats are ordered Origin → General → Fighting Style → Epic Boon, then the 2014 three, then the homebrew.** This order is what the picker list shows. *Reversal cost:* reorder keys.
4. **The 2014 three are tagged `source: "2014"` and category General** (the brief's PM decision, item 6). Their text is unchanged.
5. **Ability Score Improvement is not repeated in the feat drop-down.** The "Ability Score Improvement" toggle beside "Take a Feat" already is that feat. The server refuses it as a feat pick and points to the ASI path. The entry is still in the catalog, so the count is 75. *Reversal cost:* remove one filter and one check.
6. **Origin feats stay pickable at level-up.** The book's ASI feature allows "another feat of your choice for which you qualify", and Origin feats have no prerequisite. Before this job, they were already pickable in the old list. *Reversal cost:* a one-line filter.
7. **A feat in neither the catalog nor the registry is now refused at level-up.** Before, the client was trusted for any key. This is what keeps a stale `mobile` from landing. Manual of Martial Mastery feats, which are registry-only, are still accepted. *Reversal cost:* delete the 3-line check.
8. **"Has the Fighting Style feature" means the character already has a fighting style.** That is either `characters.fighting_style` or a feat entry in the Fighting Style category. *Reversal cost:* change one predicate in each of `featPickHelpers.js` and `featCatalog.js`.
9. **Resilient's save proficiencies = the starting class's two saves (from `classes.json`) plus any earlier Resilient pick.** This follows the 2024 rule that multiclassing grants no saves. *Reversal cost:* one function.
10. **`tests/integration.test.js` was changed from Resilient CON to Resilient WIS.** Its test character is a Fighter, which has CON save proficiency, so the book now refuses CON. The test still checks the same behavior: the half-feat +1 is applied and the feat is stored. *Reversal cost:* none; the old pick is book-illegal.
11. **Old feat `choices` data was corrected where it was 2014:**
    - Magic Initiate's list choice is now Cleric/Druid/Wizard, with an added spellcasting-ability choice (Int/Wis/Cha).
    - Ritual Caster's 2014 class + two-ritual choice was removed, because the book has no class pick.
    - Elemental Adept's damage-type choice was kept, since it matches the book.

    The level-up page doesn't currently send these choices (see Not done), so this only changes data. *Reversal cost:* restore from git.
12. **Registry entries beyond item 8's four were corrected** (Mage Slayer, GWM, Polearm Master, War Caster, six Fighting Styles). This follows from the acceptance criterion that the two files agree, and from the fix-as-you-find-it rule. *Reversal cost:* revert individual lines.

## Needs Zach's decision

Nothing beyond the gate itself. The open items above (registry effect text for the 45 new feats, sub-choice pickers, armor and Spellcasting prerequisite checks, and the engine's Great Weapon Master once-per-turn) are follow-up jobs the PM can scope.

## How to verify

**Gate:** from `E:\DnD Meta Game\dnd-meta-game` on `phase-4-hybrid-combat` at commit `e42abe9` or later, run `npm test`. Expect `Files: 261/261 green`, with `repo-check-fixes-feats.test.js` passing (81 assertions when run alone: `npm test repo-check-fixes-feats`).

**In the browser (`npm run dev`, then http://localhost:5173):**
1. Take a character at level 3 with enough XP to level up and open Level Up. For a Fighter 3, choose Fighter so the new level is 4, then click **Take a Feat**.
2. Open the feat list:
   - Each entry shows its category, e.g. "Alert — Origin" or "Chef — General".
   - **Mobile is not there; Speedy is.**
   - All 10 Fighting Style feats and all 12 Boons are listed.
   - The Boons are greyed out with "(requires level 19)".
   - With no fighting style, the Fighting Style feats are greyed out with "(requires the Fighting Style feature)".
   - "Ability Score Improvement" is not in the list, because it's the toggle next to "Take a Feat".
3. Pick **Great Weapon Master**. The panel reads "General Feat (Prerequisite: Level 4+, Strength 13+)", then "Ability Score Increase…", "Heavy Weapon Mastery…" and "Hew…". There is no −5/+10, and the +1 offers only STR.
4. Pick **Heavily Armored**. The +1 offers CON and STR.
5. On a Fighter, pick **Resilient**. The +1 offers DEX, INT, WIS and CHA, but not STR or CON.
6. Pick **Alert**. It shows Initiative Proficiency and Initiative Swap, with no +5.
7. If a character's Dexterity and Constitution are both below 13, **Speedy** is greyed out with "(requires Level 4+, Dexterity or Constitution 13+)".
