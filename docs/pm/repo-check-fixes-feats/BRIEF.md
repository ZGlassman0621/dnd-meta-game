# Brief — repo-check-fixes-feats: the feat catalog becomes the 2024 book

## Goal (in play)
A player picking a feat sees the 2024 feat, not the 2014 one: Great
Weapon Master no longer offers a trade the book removed; Alert gives the
Initiative Swap the book grants; every feat the book offers is actually
there to pick — including all ten Fighting Style feats and all twelve
Epic Boons, which are currently missing entirely. And the game stops
offering a feat the player cannot take yet, because every feat now
carries the level its book entry requires.

## Background
- Read-only repo check against the 2024 PHB, run 2026-11-24 at Zach's
  direction ("Check it all"). Report:
  `~/workspace/dnd-app-review/repo-checks-2026-11-24-REPORT.md`, §3.
  Book source: Zach's photos of PHB Ch. 5, pp. 199–211, transcribed
  verbatim (`~/workspace/dnd-app-review/phb-2024-feats-pp199-205-transcription-2026-11-24.md`
  and `~/workspace/dnd-app-review/phb-2024-feats-transcription-pp206-211-2026-11-24.md`).
  The photo-read is authoritative. The book text quoted in this brief
  is copied from those transcriptions.
- The check compared the player-facing catalog
  `client/src/data/feats.json` (55 entries: 42 pre-homebrew + 13
  tagged `source: "Homebrew — …"`, as read 2026-11-24 on the
  `phase-4-hybrid-combat` branch — **confirm the live entries on the
  PC copy before editing; if they have drifted, stop and report the
  drift, do not guess**) and the server registry
  `server/data/featRegistry.js` (CORE_FEATS 21 + FIGHTING_STYLE_FEATS
  10 + ADDED_FEATS 14) against the book's 75 feats (10 Origin / 43
  General / 10 Fighting Style / 12 Epic Boon).
- Findings: **37 of the 75 feats are missing from the catalog** (2
  Origin, 13 General, all 10 Fighting Style, all 12 Epic Boon). Of the
  38 present, **only Tough is fully correct; 36 carry substantively
  wrong text, mostly wholesale 2014 text**, and 1 (Skilled) is missing
  only its Repeatable note. The catalog records **no Level 4+
  prerequisite anywhere** (`prerequisites: null` on nearly every
  entry) and has **no category field at all**, so it cannot tell an
  Origin feat from a General one or enforce the book's category rules.
- The server registry is substantially closer to the book and is the
  better source for the rewrite: it already holds correct 2024 text
  for Alert, Lucky, Great Weapon Master, Sharpshooter, Magic Initiate,
  Healer, Tavern Brawler, Crafter, Musician, Savage Attacker, War
  Caster, and Polearm Master, plus all 10 Fighting Style feats (with
  two small omissions — see item 7). Where client and server cover
  the same feat they disagree on 11. The book text in this brief is
  the authority in every case; where registry text and this brief
  differ, the book wins.
- Zach directed 2026-11-24 that all four checked sections be fixed in
  the engine. This brief is the feats section.

## What to build

**0. Confirm the live catalog first.** Read the live `feats.json` and
`featRegistry.js` on the PC copy. Confirm the entries this brief
touches still carry the text the check quoted. If any entry has
already changed, report it and do not build on a stale quote. Do not
widen scope to feats the check did not list.

**1. Add the 37 missing feats** to `client/src/data/feats.json`, with
the book text below (category, prerequisite, and benefits verbatim
from the book). Entry shape follows the file's existing conventions
(`name`, `description`, `benefits` as one string per benefit,
`prerequisites`, plus the new `category` field from item 4).

### Missing — Origin (2)

**Crafter** — Origin Feat. No prerequisite.
- **Tool Proficiency.** You gain proficiency with three different
  Artisan's Tools of your choice from the Fast Crafting table.
- **Discount.** Whenever you buy a nonmagical item, you receive a 20
  percent discount on it.
- **Fast Crafting.** When you finish a Long Rest, you can craft one
  piece of gear from the Fast Crafting table, provided you have the
  Artisan's Tools associated with that item and have proficiency with
  those tools. The item lasts until you finish another Long Rest, at
  which point the item falls apart.
- Fast Crafting table (store with the feat): Carpenter's Tools —
  Ladder, Torch; Leatherworker's Tools — Case, Pouch; Mason's Tools —
  Block and Tackle; Potter's Tools — Jug, Lamp; Smith's Tools — Ball
  Bearings, Bucket, Caltrops, Grappling Hook, Iron Pot; Tinker's
  Tools — Bell, Shovel, Tinder Box; Weaver's Tools — Basket, Rope,
  Net, Tent; Woodcarver's Tools — Club, Greatclub, Quarterstaff.

**Musician** — Origin Feat. No prerequisite.
- **Instrument Training.** You gain proficiency with three Musical
  Instruments of your choice.
- **Encouraging Song.** As you finish a Short or Long Rest, you can
  play a song on a Musical Instrument with which you have proficiency
  and give Heroic Inspiration to allies who hear the song. The number
  of allies you can affect in this way equals your Proficiency Bonus.

### Missing — General (13)

**Ability Score Improvement** — General Feat (Prerequisite: Level 4+).
- Increase one ability score of your choice by 2, or increase two
  ability scores of your choice by 1. This feat can't increase an
  ability score above 20.
- **Repeatable.** You can take this feat more than once.

**Chef** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Constitution or Wisdom
  score by 1, to a maximum of 20.
- **Cook's Utensils.** You gain proficiency with Cook's Utensils if
  you don't already have it.
- **Replenishing Meal.** As part of a Short Rest, you can cook special
  food if you have ingredients and Cook's Utensils on hand. You can
  prepare enough of this food for a number of creatures equal to 4
  plus your Proficiency Bonus. At the end of the Short Rest, any
  creature who eats the food and spends one or more Hit Dice to regain
  Hit Points regains an extra 1d8 Hit Points.
- **Bolstering Treats.** With 1 hour of work or when you finish a Long
  Rest, you can cook a number of treats equal to your Proficiency
  Bonus if you have ingredients and Cook's Utensils on hand. These
  special treats last 8 hours after being made. A creature can use a
  Bonus Action to eat one of those treats to gain a number of
  Temporary Hit Points equal to your Proficiency Bonus.

**Crusher** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Strength or Constitution
  score by 1, to a maximum of 20.
- **Push.** Once per turn, when you hit a creature with an attack that
  deals Bludgeoning damage, you can move it 5 feet to an unoccupied
  space if the target is no more than one size larger than you.
- **Enhanced Critical.** When you score a Critical Hit that deals
  Bludgeoning damage to a creature, attack rolls against that
  creature have Advantage until the start of your next turn.

**Fey-Touched** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Intelligence, Wisdom, or
  Charisma score by 1, to a maximum of 20.
- **Fey Magic.** Choose one level 1 spell from the Divination or
  Enchantment school of magic. You always have that spell and the
  Misty Step spell prepared. You can cast each of these spells without
  expending a spell slot. Once you cast either spell in this way, you
  can't cast that spell in this way again until you finish a Long
  Rest. You can also cast these spells using spell slots you have of
  the appropriate level. The spells' spellcasting ability is the
  ability increased by this feat.

**Martial Weapon Training** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Strength or Dexterity
  score by 1, to a maximum of 20.
- **Weapon Proficiency.** You gain proficiency with Martial weapons.
- Note: distinct from the 2014 feat Martial Adept, which stays in the
  catalog (see item 6). Do not confuse the two.

**Piercer** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Strength or Dexterity by 1,
  to a maximum of 20.
- **Puncture.** Once per turn, when you hit a creature with an attack
  that deals Piercing damage, you can reroll one of the attack's
  damage dice, and you must use the new roll.
- **Enhanced Critical.** When you score a Critical Hit that deals
  Piercing damage to a creature, you can roll one additional damage
  die when determining the extra Piercing damage the target takes.

**Poisoner** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Dexterity or Intelligence
  score by 1, to a maximum of 20.
- **Potent Poison.** When you make a damage roll that deals Poison
  damage, it ignores Resistance to Poison damage.
- **Brew Poison.** You gain proficiency with the Poisoner's Kit. With
  1 hour of work using such a kit and expending 50 GP worth of
  materials, you can create a number of poison doses equal to your
  Proficiency Bonus. As a Bonus Action, you can apply a poison dose to
  a weapon or piece of ammunition. Once applied, the poison retains
  its potency for 1 minute or until you deal damage with the poisoned
  item, whichever is shorter. When a creature takes damage from the
  poisoned item, that creature must succeed on a Constitution saving
  throw (DC 8 plus the modifier of the ability increased by this feat
  and your Proficiency Bonus) or take 2d8 Poison damage and have the
  Poisoned condition until the end of your next turn.

**Shadow-Touched** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Intelligence, Wisdom, or
  Charisma score by 1, to a maximum of 20.
- **Shadow Magic.** Choose one level 1 spell from the Illusion or
  Necromancy school of magic. You always have that spell and the
  *Invisibility* spell prepared. You can cast each of these spells
  without expending a spell slot. Once you cast either spell in this
  way, you can't cast that spell in this way again until you finish a
  Long Rest. You can also cast these spells using spell slots you have
  of the appropriate level. The spells' spellcasting ability is the
  ability increased by this feat.

**Skill Expert** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase one ability score of your choice
  by 1, to a maximum of 20.
- **Skill Proficiency.** You gain proficiency in one skill of your
  choice.
- **Expertise.** Choose one skill in which you have proficiency but
  lack Expertise. You gain Expertise with that skill.

**Slasher** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Strength or Dexterity
  score by 1, to a maximum of 20.
- **Hamstring.** Once per turn when you hit a creature with an attack
  that deals Slashing damage, you can reduce the Speed of that
  creature by 10 feet until the start of your next turn.
- **Enhanced Critical.** When you score a Critical Hit that deals
  Slashing damage to a creature, it has Disadvantage on attack rolls
  until the start of your next turn.

**Speedy** — General Feat (Prerequisite: Level 4+, Dexterity or
Constitution 13+).
- **Ability Score Increase.** Increase your Dexterity or Constitution
  score by 1, to a maximum of 20.
- **Speed Increase.** Your Speed increases by 10 feet.
- **Dash over Difficult Terrain.** When you take the Dash action on
  your turn, Difficult Terrain doesn't cost you extra movement for the
  rest of that turn.
- **Agile Movement.** Opportunity Attacks have Disadvantage against
  you.
- This is the 2024 replacement for Mobile (see item 5). Do not list
  Speedy anywhere else in this brief — it appears once, here.

**Telekinetic** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Intelligence, Wisdom, or
  Charisma score by 1, to a maximum of 20.
- **Minor Telekinesis.** You learn the *Mage Hand* spell. You can cast
  it without Verbal or Somatic components, you can make the spectral
  hand Invisible, and its range and the distance it can be away from
  you both increase by 30 feet when you cast it. The spell's
  spellcasting ability is the ability increased by this feat.
- **Telekinetic Shove.** As a Bonus Action, you can telekinetically
  shove one creature you can see within 30 feet of yourself. When you
  do so, the target must succeed on a Strength saving throw (DC 8
  plus the ability modifier of the score increased by this feat and
  your Proficiency Bonus) or be moved 5 feet toward or away from you.

**Telepathic** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Intelligence, Wisdom, or
  Charisma score by 1, to a maximum of 20.
- **Telepathic Utterance.** You can speak telepathically to any
  creature you can see within 60 feet of yourself. Your telepathic
  utterances are in a language you know, and the creature understands
  you only if it knows that language. Your communication doesn't give
  the creature the ability to respond to you telepathically.
- **Detect Thoughts.** You always have the *Detect Thoughts* spell
  prepared. You can cast it without a spell slot or spell components,
  and you must finish a Long Rest before you can cast it in this way
  again. You can also cast it using spell slots you have of the
  appropriate level. Your spellcasting ability for the spell is the
  ability increased by this feat.

### Missing — Fighting Style (10)

All ten carry the prerequisite **Fighting Style Feature**.

**Archery.** You gain a +2 bonus to attack rolls you make with Ranged
weapons.

**Blind Fighting.** You have Blindsight with a range of 10 feet.

**Defense.** While you're wearing Light, Medium, or Heavy armor, you
gain a +1 bonus to Armor Class.

**Dueling.** When you're holding a Melee weapon in one hand and no
other weapons, you gain a +2 bonus to damage rolls with that weapon.

**Great Weapon Fighting.** When you roll damage for an attack you make
with a Melee weapon that you are holding with two hands, you can
treat any 1 or 2 on a damage die as a 3. The weapon must have the
Two-Handed or Versatile property to gain this benefit.

**Interception.** When a creature you can see hits another creature
within 5 feet of you with an attack roll, you can take a Reaction to
reduce the damage dealt to the target by 1d10 plus your Proficiency
Bonus. You must be holding a Shield or a Simple or Martial weapon to
use this Reaction.

**Protection.** When a creature you can see attacks a target other
than you that is within 5 feet of you, you can take a Reaction to
interpose your Shield if you're holding one. You impose Disadvantage
on the triggering attack roll and all other attack rolls against the
target until the start of your next turn if you remain within 5 feet
of the target.
- Note: the registry's Protection omits the extended Disadvantage
  ("and all other attack rolls against the target until the start of
  your next turn if you remain within 5 feet of the target"). Use the
  book text above, not the registry's.

**Thrown Weapon Fighting.** When you hit with a ranged attack roll
using a weapon that has the Thrown property, you gain a +2 bonus to
the damage roll.

**Two-Weapon Fighting.** When you make an extra attack as a result of
using a weapon that has the Light property, you can add your ability
modifier to the damage of that attack if you aren't already adding it
to the damage.

**Unarmed Fighting.** When you hit with your Unarmed Strike and deal
damage, you can deal Bludgeoning damage equal to 1d6 plus your
Strength modifier instead of the normal damage of an Unarmed Strike.
If you aren't holding any weapons or a Shield when you make the
attack roll, the d6 becomes a d8. At the start of each of your turns,
you can deal 1d4 Bludgeoning damage to one creature Grappled by you.
- Note: the registry's Unarmed Fighting omits the start-of-turn 1d4
  Bludgeoning damage to a Grappled creature. Use the book text above,
  not the registry's.

### Missing — Epic Boon (12)

All twelve carry the prerequisite **Level 19+**, and each grants +1
to an ability, maximum 30.

**Boon of Combat Prowess.** **Ability Score Increase.** Increase one
ability score of your choice by 1, to a maximum of 30. **Peerless
Aim.** When you miss with an attack roll, you can hit instead. Once
you use this benefit, you can't use it again until the start of your
next turn.

**Boon of Dimensional Travel.** **Ability Score Increase.** Increase
one ability score of your choice by 1, to a maximum of 30. **Blink
Steps.** Immediately after you take the Attack action or the Magic
action, you can teleport up to 30 feet to an unoccupied space you can
see.

**Boon of Energy Resistance.** **Ability Score Increase.** Increase one
ability score of your choice by 1, to a maximum of 30. **Energy
Resistances.** You gain Resistance to two of the following damage
types of your choice: Acid, Cold, Fire, Lightning, Necrotic, Poison,
Psychic, Radiant, or Thunder. Whenever you finish a Long Rest, you
can change your choices. **Energy Redirection.** When you take damage
of one of the types chosen for the Energy Resistances benefit, you can
take a Reaction to direct damage of the same type toward another
creature you can see within 60 feet of yourself that isn't behind
Total Cover. If you do so, that creature must succeed on a Dexterity
saving throw (DC 8 plus your Constitution modifier and Proficiency
Bonus) or take damage equal to 2d12 plus your Constitution modifier.

**Boon of Fate.** **Ability Score Increase.** Increase one ability score
of your choice by 1, to a maximum of 30. **Improve Fate.** When you or
another creature within 60 feet of you succeeds on or fails a D20
Test, you can roll 2d4 and apply the total rolled as a bonus or
penalty to the d20 roll. Once you use this benefit, you can't use it
again until you roll Initiative or finish a Short or Long Rest.

**Boon of Fortitude.** **Ability Score Increase.** Increase one ability
score of your choice by 1, to a maximum of 30. **Fortified Health.**
Your Hit Point maximum increases by 40. In addition, whenever you
regain Hit Points, you can regain additional Hit Points equal to your
Constitution modifier. Once you've regained these additional Hit
Points, you can't do so again until the start of your next turn.

**Boon of Irresistible Offense.** **Ability Score Increase.** Increase
your Strength or Dexterity score by 1, to a maximum of 30. **Overcome
Defenses.** The Bludgeoning, Piercing, and Slashing damage you deal
always ignores Resistance. **Overwhelming Strike.** When you roll a
20 on the d20 for an attack roll, you can deal extra damage to the
target equal to the ability score increased by this feat. The extra
damage's type is the same as the attack's type.
- Trap to avoid: Overwhelming Strike deals extra damage equal to the
  ability score itself (e.g. 20), not the modifier.

**Boon of Recovery.** **Ability Score Increase.** Increase one ability
score of your choice by 1, to a maximum of 30. **Last Stand.** When
you would be reduced to 0 Hit Points, you can drop to 1 Hit Point
instead and regain a number of Hit Points equal to half your Hit
Point maximum. Once you use this benefit, you can't use it again
until you finish a Long Rest. **Recover Vitality.** You have a pool
of ten d10s. As a Bonus Action, you can expend dice from the pool,
roll those dice, and regain a number of Hit Points equal to the
roll's total. You regain all the expended dice when you finish a Long
Rest.

**Boon of Skill.** **Ability Score Increase.** Increase one ability
score of your choice by 1, to a maximum of 30. **All-Around Adept.**
You gain proficiency in all skills. **Expertise.** Choose one skill
in which you lack Expertise. You gain Expertise in that skill.

**Boon of Speed.** **Ability Score Increase.** Increase one ability
score of your choice by 1, to a maximum of 30. **Escape Artist.** As
a Bonus Action, you can take the Disengage action, which also ends
the Grappled condition on you. **Quickness.** Your Speed increases by
30 feet.

**Boon of Spell Recall.** **Ability Score Increase.** Increase your
Intelligence, Wisdom, or Charisma score by 1, to a maximum of 30.
**Free Casting.** Whenever you cast a spell with a level 1–4 spell
slot, roll 1d4. If the number you roll is the same as the slot's
level, the slot isn't expended.
- Prerequisite: Level 19+, Spellcasting Feature.

**Boon of the Night Spirit.** **Ability Score Increase.** Increase one
ability score of your choice by 1, to a maximum of 30. **Merge with
Shadows.** While within Dim Light or Darkness, you can give yourself
the Invisible condition as a Bonus Action. The condition ends on you
immediately after you take an action, a Bonus Action, or a Reaction.
**Shadowy Form.** While within Dim Light or Darkness, you have
Resistance to all damage except Psychic and Radiant.

**Boon of Truesight.** **Ability Score Increase.** Increase one ability
score of your choice by 1, to a maximum of 30. **Truesight.** You
have Truesight with a range of 60 feet.

**2. Correct the 36 wrong texts** in `client/src/data/feats.json`.
Replace each entry's text wholesale with the book text below (category,
prerequisite, and benefits verbatim from the book). Where the registry
already holds the correct 2024 text, port it — but verify it against
the book text below first; the book wins on any difference. Feats
whose only error is a missing +1 or a missing restriction are listed
with the full book text anyway, so there is one source of truth.

**Alert** — Origin Feat. No prerequisite. (Registry holds the correct
2024 text; the catalog has the 2014 "+5 initiative" version.)
- **Initiative Proficiency.** When you roll Initiative, you can add
  your Proficiency Bonus to the roll.
- **Initiative Swap.** Immediately after you roll Initiative, you can
  swap your Initiative with the Initiative of one willing ally in the
  same combat. You can't make this swap if you or the ally has the
  Incapacitated condition.

**Actor** — General Feat (Prerequisite: Level 4+, Charisma 13+).
- **Ability Score Increase.** Increase your Charisma score by 1, to a
  maximum of 20.
- **Impersonation.** While you're disguised as a real or fictional
  person, you have Advantage on Charisma (Deception or Performance)
  checks to convince others that you are that person.
- **Mimicry.** You can mimic the sounds of other creatures, including
  speech. A creature that hears the mimicry must succeed on a Wisdom
  (Insight) check to determine the effect is faked (DC 8 plus your
  Charisma modifier and Proficiency Bonus).
- The Advantage applies only while disguised; the Mimicry Insight
  check was missing entirely from the catalog.

**Athlete** — General Feat (Prerequisite: Level 4+, Strength or
Dexterity 13+).
- **Ability Score Increase.** Increase your Strength or Dexterity
  score by 1, to a maximum of 20.
- **Climb Speed.** You gain a Climb Speed equal to your Speed.
- **Hop Up.** When you have the Prone condition, you can right
  yourself with only 5 feet of movement.
- **Jumping.** You can make a running Long or High Jump after moving
  only 5 feet.
- The catalog's "Climbing doesn't cost extra movement" is the 2014
  benefit, not the book's Climb Speed.

**Charger** — General Feat (Prerequisite: Level 4+, Strength or
Dexterity 13+).
- **Ability Score Increase.** Increase your Strength or Dexterity
  score by 1, to a maximum of 20.
- **Improved Dash.** When you take the Dash action, your Speed
  increases by 10 feet for that action.
- **Charge Attack.** If you move at least 10 feet in a straight line
  toward a target immediately before hitting it with a melee attack
  roll as part of the Attack action, choose one of the following
  effects: gain a 1d8 bonus to the attack's damage roll, or push the
  target up to 10 feet away if it is no more than one size larger
  than you. You can use this benefit only once on each of your turns.
- The catalog has no +1, no Improved Dash, and the wrong damage/push
  numbers and trigger.

**Crossbow Expert** — General Feat (Prerequisite: Level 4+, Dexterity
13+).
- **Ability Score Increase.** Increase your Dexterity score by 1, to a
  maximum of 20.
- **Ignore Loading.** You ignore the Loading property of the Hand
  Crossbow, Heavy Crossbow, and Light Crossbow (all called crossbows
  elsewhere in this feat). If you're holding one of them, you can load
  a piece of ammunition into it even if you lack a free hand.
- **Firing in Melee.** Being within 5 feet of an enemy doesn't impose
  Disadvantage on your attack rolls with crossbows.
- **Dual Wielding.** When you make the extra attack of the Light
  property, you can add your ability modifier to the damage of the
  extra attack if that attack is with a crossbow that has the Light
  property and you aren't already adding that modifier to the damage.
- The hand-crossbow bonus-action attack in the catalog was removed in
  2024; the +1 Dex and the no-free-hand loading clause were missing.

**Defensive Duelist** — General Feat (Prerequisite: Level 4+,
Dexterity 13+).
- **Ability Score Increase.** Increase your Dexterity score by 1, to a
  maximum of 20.
- **Parry.** If you're holding a Finesse weapon and another creature
  hits you with a melee attack, you can take a Reaction to add your
  Proficiency Bonus to your Armor Class, potentially causing the
  attack to miss you. You gain this bonus to your AC against melee
  attacks until the start of your next turn.
- The catalog omits the +1 Dex and the "until the start of your next
  turn" duration.

**Dual Wielder** — General Feat (Prerequisite: Level 4+, Strength or
Dexterity 13+).
- **Ability Score Increase.** Increase your Strength or Dexterity
  score by 1, to a maximum of 20.
- **Enhanced Dual Wielding.** When you take the Attack action on your
  turn and attack with a weapon that has the Light property, you can
  make one extra attack as a Bonus Action later on the same turn with
  a different weapon, which must be a Melee weapon that lacks the
  Two-Handed property. You don't add your ability modifier to the
  extra attack's damage unless that modifier is negative.
- **Quick Draw.** You can draw or stow two weapons that lack the
  Two-Handed property when you would normally be able to draw or
  stow only one.
- There is no +1 AC in 2024; the extra attack is gated on the Light
  property, not "any one-handed melee weapons."

**Durable** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Constitution score by 1,
  to a maximum of 20.
- **Defy Death.** You have Advantage on Death Saving Throws.
- **Speedy Recovery.** As a Bonus Action, you can expend one of your
  Hit Point Dice, roll the die, and regain a number of Hit Points
  equal to the roll.
- The catalog's Hit Die minimum (twice Con mod) is the 2014 text.

**Elemental Adept** — General Feat (Prerequisite: Level 4+,
Spellcasting or Pact Magic Feature).
- **Ability Score Increase.** Increase your Intelligence, Wisdom, or
  Charisma score by 1, to a maximum of 20.
- **Energy Mastery.** Choose one of the following damage types: Acid,
  Cold, Fire, Lightning, or Thunder. Spells you cast ignore
  Resistance to damage of the chosen type. In addition, when you roll
  damage for a spell you cast that deals damage of that type, you can
  treat any 1 on a damage die as a 2.
- **Repeatable.** You can take this feat more than once, but you must
  choose a different damage type each time for Energy Mastery.
- The catalog omits the +1, uses a non-book prerequisite ("The ability
  to cast at least one spell"), and states the 1→2 treatment as
  automatic where the book says "you can."

**Grappler** — General Feat (Prerequisite: Level 4+, Strength or
Dexterity 13+).
- **Ability Score Increase.** Increase your Strength or Dexterity
  score by 1, to a maximum of 20.
- **Punch and Grab.** When you hit a creature with an Unarmed Strike
  as part of the Attack action on your turn, you can use both the
  Damage and the Grapple option. You can use this benefit only once
  per turn.
- **Attack Advantage.** You have Advantage on attack rolls against a
  creature Grappled by you.
- **Fast Wrestler.** You don't have to spend extra movement to move a
  creature Grappled by you if the creature is your size or smaller.
- The pin mechanic in the catalog does not exist in 2024.

**Great Weapon Master** — General Feat (Prerequisite: Level 4+,
Strength 13+). (Registry holds the correct 2024 text.)
- **Ability Score Increase.** Increase your Strength score by 1, to a
  maximum of 20.
- **Heavy Weapon Mastery.** When you hit a creature with a weapon that
  has the Heavy property as part of the Attack action on your turn,
  you can cause the weapon to deal extra damage to the target. The
  extra damage equals your Proficiency Bonus.
- **Hew.** Immediately after you score a Critical Hit with a Melee
  weapon or reduce a creature to 0 Hit Points with one, you can make
  one attack with the same weapon as a Bonus Action.
- The −5/+10 trade in the catalog was removed in 2024.

**Healer** — Origin Feat. No prerequisite. (Registry holds the correct
2024 text.)
- **Battle Medic.** If you have a Healer's Kit, you can expend one use
  of it and tend to a creature within 5 feet of yourself as a Utilize
  action. That creature can expend one of its Hit Point Dice, and you
  then roll that die. The creature regains a number of Hit Points
  equal to the roll plus your Proficiency Bonus.
- **Healing Rerolls.** Whenever you roll a die to determine the number
  of Hit Points you restore with a spell or with this feat's Battle
  Medic benefit, you can reroll the die if it rolls a 1, and you must
  use the new roll.

**Heavily Armored** — General Feat (Prerequisite: Level 4+, Medium
Armor Training).
- **Ability Score Increase.** Increase your Constitution or Strength
  score by 1, to a maximum of 20.
- **Armor Training.** You gain training with Heavy armor.
- The catalog restricts the +1 to Strength only; the book allows
  Constitution or Strength. Any stored single-ability field must
  support the choice.

**Heavy Armor Master** — General Feat (Prerequisite: Level 4+, Heavy
Armor Training).
- **Ability Score Increase.** Increase your Constitution or Strength
  score by 1, to a maximum of 20.
- **Damage Reduction.** When you're hit by an attack while you're
  wearing Heavy armor, any Bludgeoning, Piercing, and Slashing damage
  dealt to you by that attack is reduced by an amount equal to your
  Proficiency Bonus.
- The catalog's flat −3 and "nonmagical weapons" qualifier are 2014;
  the reduction scales with Proficiency Bonus and has no nonmagical
  qualifier in 2024. The catalog also restricts the +1 to Strength.

**Inspiring Leader** — General Feat (Prerequisite: Level 4+, Wisdom
or Charisma 13+).
- **Ability Score Increase.** Increase your Wisdom or Charisma score
  by 1, to a maximum of 20.
- **Bolstering Performance.** When you finish a Short or Long Rest, you
  can give an inspiring performance: a speech, song, or dance. When
  you do so, choose up to six allies (which can include yourself)
  within 30 feet of yourself who witness the performance. The chosen
  creatures each gain Temporary Hit Points equal to your character
  level plus the modifier of the ability you increased with this feat.
- The trigger is finishing a rest, not a 10-minute speech; the temp HP
  keys off the increased ability, not always Charisma; there is no
  rest-gated reuse in 2024; the catalog omits the +1 and the 30 ft /
  witness conditions.

**Keen Mind** — General Feat (Prerequisite: Level 4+, Intelligence
13+).
- **Ability Score Increase.** Increase your Intelligence score by 1, to
  a maximum of 20.
- **Lore Knowledge.** Choose one of the following skills: Arcana,
  History, Investigation, Nature, or Religion. If you lack
  proficiency in the chosen skill, you gain proficiency in it, and if
  you already have proficiency in it, you gain Expertise in it.
- **Quick Study.** You can take the Study action as a Bonus Action.
- None of the catalog's three benefits (north, sunrise/sunset, recall)
  exists in 2024.

**Lightly Armored** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Strength or Dexterity
  score by 1, to a maximum of 20.
- **Armor Training.** You gain training with Light armor and Shields.
- The catalog omits Shield training.

**Lucky** — Origin Feat. No prerequisite. (Registry holds the correct
2024 text.)
- **Luck Points.** You have a number of Luck Points equal to your
  Proficiency Bonus and can spend the points on the benefits below.
  You regain your expended Luck Points when you finish a Long Rest.
- **Advantage.** When you roll a d20 for a D20 Test, you can spend 1
  Luck Point to give yourself Advantage on the roll.
- **Disadvantage.** When a creature rolls a d20 for an attack roll
  against you, you can spend 1 Luck Point to impose Disadvantage on
  that roll.
- The catalog's 3 luck points and extra-d20 spend are 2014.

**Mage Slayer** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Strength or Dexterity
  score by 1, to a maximum of 20.
- **Concentration Breaker.** When you damage a creature that is
  concentrating, it has Disadvantage on the saving throw it makes to
  maintain Concentration.
- **Guarded Mind.** If you fail an Intelligence, a Wisdom, or a
  Charisma saving throw, you can cause yourself to succeed instead.
  Once you use this benefit, you can't use it again until you finish
  a Short or Long Rest.
- The reaction attack and the save Advantage vs adjacent casters in
  the catalog were removed in 2024; Guarded Mind is entirely absent
  from the catalog.

**Magic Initiate** — Origin Feat. No prerequisite. (Registry holds the
correct 2024 text.)
- **Two Cantrips.** You learn two cantrips of your choice from the
  Cleric, Druid, or Wizard spell list. Intelligence, Wisdom, or
  Charisma is your spellcasting ability for this feat's spells (choose
  when you select this feat).
- **Level 1 Spell.** Choose a level 1 spell from the same list you
  selected for this feat's cantrips. You always have that spell
  prepared. You can cast it once without a spell slot, and you regain
  the ability to cast it in that way when you finish a Long Rest. You
  can also cast the spell using any spell slots you have.
- **Spell Change.** Whenever you gain a new level, you can replace one
  of the spells you chose for this feat with a different spell of the
  same level from the chosen spell list.
- **Repeatable.** You can take this feat more than once, but you must
  choose a different spell list each time.
- Bard, Sorcerer, and Warlock are not options in 2024; the catalog
  offers all six classes and omits "always prepared", Spell Change,
  and Repeatable.

**Medium Armor Master** — General Feat (Prerequisite: Level 4+,
Medium Armor Training).
- **Ability Score Increase.** Increase your Strength or Dexterity
  score by 1, to a maximum of 20.
- **Dexterous Wearer.** While you're wearing Medium armor, you can add
  3, rather than 2, to your AC if you have a Dexterity score of 16 or
  higher.
- The Stealth benefit in the catalog was removed in 2024; the +3 cap
  is conditional on Dexterity 16+; the catalog omits the +1.

**Moderately Armored** — General Feat (Prerequisite: Level 4+, Light
Armor Training).
- **Ability Score Increase.** Increase your Strength or Dexterity
  score by 1, to a maximum of 20.
- **Armor Training.** You gain training with Medium armor.
- The catalog adds shields; shields belong to Lightly Armored in 2024,
  not here.

**Mounted Combatant** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Strength, Dexterity, or
  Wisdom score by 1, to a maximum of 20.
- **Mounted Strike.** While mounted, you have Advantage on attack
  rolls against any unmounted creature within 5 feet of your mount
  that is at least one size smaller than the mount.
- **Leap Aside.** If your mount is subjected to an effect that allows
  it to make a Dexterity saving throw to take only half damage, it
  instead takes no damage if it succeeds on the saving throw and only
  half damage if it fails. For your mount to gain this benefit, you
  must be riding it, and neither of you can have the Incapacitated
  condition.
- **Veer.** While mounted, you can force an attack that hits your
  mount to hit you instead if you don't have the Incapacitated
  condition.
- The catalog omits the +1, the 5-ft range and "at least one size
  smaller" limits, the "while mounted" and Incapacitated conditions,
  and changes Veer from attacks that *hit* to attacks *targeting*.

**Observant** — General Feat (Prerequisite: Level 4+, Intelligence or
Wisdom 13+).
- **Ability Score Increase.** Increase your Intelligence or Wisdom
  score by 1, to a maximum of 20.
- **Keen Observer.** Choose one of the following skills: Insight,
  Investigation, or Perception. If you lack proficiency with the
  chosen skill, you gain proficiency in it, and if you already have
  proficiency in it, you gain Expertise in it.
- **Quick Search.** You can take the Search action as a Bonus Action.
- The +5 passive bonus and lip reading in the catalog were removed in
  2024. Note: the registry carries the same 2014 text as the catalog
  — do NOT copy Observant from the registry; use the book text above.
  (Registry fix is item 8.)

**Polearm Master** — General Feat (Prerequisite: Level 4+, Strength
or Dexterity 13+). (Registry holds substantively correct 2024 text;
verify against the book below.)
- **Ability Score Increase.** Increase your Dexterity or Strength
  score by 1, to a maximum of 20.
- **Pole Strike.** Immediately after you take the Attack action and
  attack with a Quarterstaff, a Spear, or a weapon that has the Heavy
  and Reach properties, you can use a Bonus Action to make a melee
  attack with the opposite end of the weapon. The weapon deals
  Bludgeoning damage, and the weapon's damage die for this attack is
  a d4.
- **Reactive Strike.** While you're holding a Quarterstaff, a Spear, or
  a weapon that has the Heavy and Reach properties, you can take a
  Reaction to make one melee attack against a creature that enters
  the reach you have with that weapon.
- The catalog omits the +1 and loses the Reaction cost / "the reach
  you have with that weapon" precision.

**Resilient** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Choose one ability in which you lack
  saving throw proficiency. Increase the chosen ability score by 1,
  to a maximum of 20.
- **Saving Throw Proficiency.** You gain saving throw proficiency with
  the chosen ability.
- The catalog allows picking an ability you already have save
  proficiency in, which the book forbids. The picker/validator must
  enforce the "lack saving throw proficiency" restriction. (Registry
  fix is item 8 — it has the same error.)

**Ritual Caster** — General Feat (Prerequisite: Level 4+;
Intelligence, Wisdom, or Charisma 13+).
- **Ability Score Increase.** Increase your Intelligence, Wisdom, or
  Charisma score by 1, to a maximum of 20.
- **Ritual Spells.** Choose a number of level 1 spells equal to your
  Proficiency Bonus that have the Ritual tag. You always have those
  spells prepared, and you can cast them with any spell slots you
  have. The spells' spellcasting ability is the ability increased by
  this feat. Whenever your Proficiency Bonus increases thereafter, you
  can add an additional level 1 spell with the Ritual tag to the
  spells always prepared with this feature.
- **Quick Ritual.** With this benefit, you can cast a Ritual spell that
  you have prepared using its regular casting time rather than the
  extended time for a Ritual. Doing so doesn't require a spell slot.
  Once you cast the spell in this way, you can't use this benefit
  again until you finish a Long Rest.
- There is no ritual book and no copying in 2024; the catalog omits
  the +1 and Charisma from the prerequisite.

**Savage Attacker** — Origin Feat. No prerequisite. (Registry holds
the correct text.)
- You've trained to deal particularly damaging strikes. Once per turn
  when you hit a target with a weapon, you can roll the weapon's
  damage dice twice and use either roll against the target.
- The book applies to any weapon hit, including ranged; the catalog
  restricts it to melee.

**Sentinel** — General Feat (Prerequisite: Level 4+, Strength or
Dexterity 13+).
- **Ability Score Increase.** Increase your Strength or Dexterity
  score by 1, to a maximum of 20.
- **Guardian.** Immediately after a creature within 5 feet of you
  takes the Disengage action or hits a target other than you with an
  attack, you can make an Opportunity Attack against that creature.
- **Halt.** When you hit a creature with an Opportunity Attack, the
  creature's Speed becomes 0 for the rest of the current turn.
- 2024 folds both triggers into one Opportunity Attack; the catalog's
  third benefit is the 2014 reaction attack, and the +1 is missing.
  Note: the registry's Sentinel is also wrong, differently ("creatures
  you hit with opportunity attacks cannot use Disengage to avoid
  them" is not in the book) — do NOT copy Sentinel from the registry.
  (Registry fix is item 8.)

**Sharpshooter** — General Feat (Prerequisite: Level 4+, Dexterity
13+). (Registry holds the correct 2024 text.)
- **Ability Score Increase.** Increase your Dexterity score by 1, to a
  maximum of 20.
- **Bypass Cover.** Your ranged attacks with weapons ignore Half Cover
  and Three-Quarters Cover.
- **Firing in Melee.** Being within 5 feet of an enemy doesn't impose
  Disadvantage on your attack rolls with Ranged weapons.
- **Long Shots.** Attacking at long range doesn't impose Disadvantage
  on your attack rolls with Ranged weapons.
- The −5/+10 trade in the catalog was removed in 2024.

**Shield Master** — General Feat (Prerequisite: Level 4+, Shield
Training).
- **Ability Score Increase.** Increase your Strength score by 1, to a
  maximum of 20.
- **Shield Bash.** If you attack a creature within 5 feet of you as
  part of the Attack action and hit with a Melee weapon, you can
  immediately bash the target with your Shield if it's equipped,
  forcing the target to make a Strength saving throw (DC 8 plus your
  Strength modifier and Proficiency Bonus). On a failed save, you
  either push the target 5 feet from you or cause it to have the
  Prone condition (your choice). You can use this benefit only once on
  each of your turns.
- **Interpose Shield.** If you're subjected to an effect that allows
  you to make a Dexterity saving throw to take only half damage, you
  can take a Reaction to take no damage if you succeed on the saving
  throw and are holding a Shield.
- The catalog's bonus-action shove and "+shield AC to Dex saves" are
  2014.

**Skulker** — General Feat (Prerequisite: Level 4+, Dexterity 13+).
- **Ability Score Increase.** Increase your Dexterity score by 1, to a
  maximum of 20.
- **Blindsight.** You have Blindsight with a range of 10 feet.
- **Fog of War.** You exploit the distractions of battle, gaining
  Advantage on any Dexterity (Stealth) check you make as part of the
  Hide action during combat.
- **Sniper.** If you make an attack roll while hidden and the roll
  misses, making the attack roll doesn't reveal your location.
- Note: the registry's Skulker is also wrong, differently (it adds
  "you can see in dim light as if it were bright within 60 ft for the
  purpose of hiding", which is in neither the book nor the catalog) —
  do NOT copy Skulker from the registry. (Registry fix is item 8.)

**Spell Sniper** — General Feat (Prerequisite: Level 4+, Spellcasting
or Pact Magic Feature).
- **Ability Score Increase.** Increase your Intelligence, Wisdom, or
  Charisma score by 1, to a maximum of 20.
- **Bypass Cover.** Your attack rolls for spells ignore Half Cover and
  Three-Quarters Cover.
- **Casting in Melee.** Being within 5 feet of an enemy doesn't impose
  Disadvantage on your attack rolls with spells.
- **Increased Range.** When you cast a spell that has a range of at
  least 10 feet and requires you to make an attack roll, you can
  increase the spell's range by 60 feet.
- Double range and the bonus cantrip in the catalog were removed in
  2024; the catalog omits the +1 and Casting in Melee.

**Tavern Brawler** — Origin Feat. No prerequisite. (Registry holds
the correct 2024 text.)
- **Enhanced Unarmed Strike.** When you hit with your Unarmed Strike
  and deal damage, you can deal Bludgeoning damage equal to 1d4 plus
  your Strength modifier instead of the normal damage of an Unarmed
  Strike.
- **Damage Rerolls.** Whenever you roll a damage die for your Unarmed
  Strike, you can reroll the die if it rolls a 1, and you must use the
  new roll.
- **Improvised Weaponry.** You have proficiency with improvised
  weapons.
- **Push.** When you hit a creature with an Unarmed Strike as part of
  the Attack action on your turn, you can deal damage to the target
  and also push it 5 feet away from you. You can use this benefit only
  once per turn.
- The catalog's flat d4 and bonus-action grapple are 2014.

**War Caster** — General Feat (Prerequisite: Level 4+, Spellcasting or
Pact Magic Feature). (Registry holds the +1 and is otherwise correct;
verify against the book below.)
- **Ability Score Increase.** Increase your Intelligence, Wisdom, or
  Charisma score by 1, to a maximum of 20.
- **Concentration.** You have Advantage on Constitution saving throws
  that you make to maintain Concentration.
- **Reactive Spell.** When a creature provokes an Opportunity Attack
  from you by leaving your reach, you can take a Reaction to cast a
  spell at the creature rather than making an Opportunity Attack. The
  spell must have a casting time of one action and must target only
  that creature.
- **Somatic Components.** You can perform the Somatic components of
  spells even when you have weapons or a Shield in one or both hands.
- The catalog omits the +1, the "by leaving your reach" trigger, and
  uses a non-book prerequisite phrasing.

**Weapon Master** — General Feat (Prerequisite: Level 4+).
- **Ability Score Increase.** Increase your Strength or Dexterity
  score by 1, to a maximum of 20.
- **Mastery Property.** Your training with weapons allows you to use
  the mastery property of one kind of Simple or Martial weapon of your
  choice, provided you have proficiency with it. Whenever you finish
  a Long Rest, you can change the kind of weapon to another eligible
  kind.
- 2024 Weapon Master grants a weapon mastery property, not weapon
  proficiencies.

**3. Skilled — add the Repeatable note only.** The catalog text
otherwise matches the book. Book: "You gain proficiency in any
combination of three skills or tools of your choice. **Repeatable.**
You can take this feat more than once." Add the repeatable flag (see
item 4).

**Tough — no text change.** The catalog text already matches the book.
It still needs the `category` field (Origin) from item 4.

**4. Add a `category` field and correct prerequisites on every entry.**
- Every entry in `feats.json` gains `category` with one of the book's
  values: Origin, General, Fighting Style, Epic Boon. The values are
  given per feat in items 1–3 above. The registry already tags its
  entries correctly for every PHB feat it covers — use it as a
  cross-check, not as the authority; the book text above governs.
- Every General feat gains its book prerequisite: Level 4+, plus the
  ability/training prerequisite where the book lists one (given per
  feat above — e.g. Athlete "Level 4+, Strength or Dexterity 13+",
  Heavily Armored "Level 4+, Medium Armor Training", Elemental Adept
  "Level 4+, Spellcasting or Pact Magic Feature"). Record the
  prerequisite in the entry's existing `prerequisites` field, in the
  book's wording, not the 2014 form. Where the catalog records a 2014
  prerequisite (e.g. Heavily Armored "Proficiency with medium armor"),
  replace it.
- Every Fighting Style feat gains prerequisite "Fighting Style
  Feature". Every Epic Boon gains "Level 19+" (Boon of Spell Recall
  additionally "Spellcasting Feature"). Origin feats carry no
  prerequisite.
- Add a `repeatable` flag (or the file's equivalent) set from the
  book's Feat List: Ability Score Improvement, Elemental Adept, Magic
  Initiate, and Skilled are Repeatable; no other 2024 PHB feat is.
  The catalog currently lacks the flag on Skilled and the registry
  already records it — carry it over.
- Where a feat grants a +1 to an ability, the stored ability-increase
  data must support the book's choice: a single ability where the book
  names one (e.g. Great Weapon Master: Strength), a choice where the
  book offers one (e.g. Heavily Armored and Heavy Armor Master:
  Constitution or Strength; Chef: Constitution or Wisdom; Inspiring
  Leader: Wisdom or Charisma; Mounted Combatant: Strength, Dexterity,
  or Wisdom). If the current field holds only a single ability (e.g.
  Heavily Armored's `abilityIncrease: { ability: "str" }`), extend it
  so the picker can offer the book's choice, and report the shape.
  The picker/validator must offer the choice and store the pick.
- Resilient's restriction ("in which you lack saving throw
  proficiency") must be enforced by the picker/validator, not just
  written in the text.

**5. Mobile goes; Speedy replaces it.** Remove the Mobile entry from
`client/src/data/feats.json` (2014 feat, absent from the 2024 Feat
List) and from `server/data/featRegistry.js` (CORE_FEATS, as
`general`). Add Speedy in its place, with the full book text in item
1 above — Speedy is already on the missing list; it is added once,
here, not twice. Before removing, grep the repo for references to the
Mobile feat (pickers, validators, tests, seed/test data) and handle
each reference — a dangling reference is a defect, not a cleanup. No
game exists yet and no live characters hold the feat; report what the
grep found.

**6. Dungeon Delver, Linguist, and Martial Adept stay.** These three
are 2014 feats with no 2024 counterpart, and they stay in the catalog
with their current text unchanged. But they must stop presenting as
book feats: give each a `source` tag of `"2014"` (following the
file's existing `source: "Homebrew — …"` convention) and a `category`
of General (matching how the registry already tags Dungeon Delver),
so the picker keeps offering them and the catalog is honest about
what they are. Flag this tagging as a PM decision for Zach's veto at
the gate. Do not change their benefit text.
- Martial Adept stays distinct from Martial Weapon Training (item 1):
  the two are different feats; both are now in the catalog.

**7. Use the registry as the source where it is right — and only
there.** For Alert, Lucky, Great Weapon Master, Sharpshooter, Magic
Initiate, Healer, Tavern Brawler, Crafter, Musician, Savage Attacker,
War Caster, and Polearm Master, the registry already holds correct
2024 text: port it into the catalog, verifying each against the book
text in this brief first. For the 10 Fighting Style feats, port the
registry's entries except Protection and Unarmed Fighting, which use
the book text in item 1 (the registry omits text the book has). For
every other feat, write from the book text in this brief — do NOT copy
from the registry: its Sentinel, Skulker, Observant, and Resilient
are wrong (see items 2 and 8).

**8. Fix the registry's own wrong entries (fix-as-you-find-it).** The
registry is the server's feat source; leaving known-wrong server text
in place while rebuilding the client would preserve the client/server
disagreement this check found. In `server/data/featRegistry.js`,
using the book text in item 2 above:
- Correct Sentinel, Skulker, Observant, and Resilient to the book
  text (Sentinel: drop the invented Disengage clause; Skulker: drop
  the invented dim-light clause; Observant: replace the 2014 text
  with Keen Observer + Quick Search; Resilient: add the "lack saving
  throw proficiency" restriction).
- Remove Mobile (see item 5) and add Speedy with the book text in
  item 1.
- Leave the registry's correct entries untouched, and leave its
  homebrew entries (e.g. `energy_affinity`, registry-only) untouched.
- After this job, the registry and the catalog must agree on every
  PHB feat they both cover. The report carries the agreement check.

**9. The 13 homebrew-tagged feats stay as-is.** Tactician, Sage
Advice, Hound, Feather Foot, Seismic Touch, Trapper, Friend of the
Forest, Elusive, Sling Expert, Mountaineer, Quick Draw, Silver Tongue,
Elegant Maneuver — keep their current text and their
`source: "Homebrew — …"` tags. They still gain a `category` field
(item 4) so pickers can filter them: use the category recorded for
each feat in the registry where the registry holds one; if a homebrew
feat has no recorded category anywhere, flag it in the report rather
than guessing one.

## Out of scope
- **Do NOT add Fighting Initiate, Gunner, or Aberrant Dragonmark.**
  None appears in the 2024 PHB (Fighting Initiate and Gunner are
  Tasha's; Aberrant Dragonmark is Eberron). They are not in the
  catalog and stay out.
- Do not add any other feat from any other book.
- The 13 homebrew feats' text and effects — unchanged (item 9).
- Dungeon Delver, Linguist, and Martial Adept benefit text —
  unchanged (item 6).
- The other three repo-check fix jobs (tools, alignment/lifestyle,
  spells) — separate briefs, separate gates.
- Any engine behavior beyond the picker/validator enforcement named
  in items 4 (Resilient restriction, ASI choices) and the feats'
  own effects: feats whose effects the engine does not yet resolve
  get correct text in this job; wiring new mechanical effects is a
  later job, reported as still-open per feat.

## Acceptance criteria
- `feats.json` holds all 75 book feats with the book's text, plus the
  13 homebrew feats and the 3 staying 2014 feats — 91 entries total.
  No book feat missing, no book feat carrying 2014 text.
- Every entry carries `category` (Origin / General / Fighting Style /
  Epic Boon) matching the book, and `prerequisites` in the book's
  wording: Level 4+ on every General feat (plus the ability/training
  prerequisite where the book lists one), Fighting Style Feature on
  every Fighting Style feat, Level 19+ on every Epic Boon.
- The `repeatable` flag is set on Ability Score Improvement, Elemental
  Adept, Magic Initiate, and Skilled, and on no other book feat.
- Mobile appears nowhere in `feats.json` or `featRegistry.js`; Speedy
  appears once in each, with the book's text.
- Dungeon Delver, Linguist, and Martial Adept are present with
  unchanged text, tagged `source: "2014"` and category General.
- Fighting Initiate, Gunner, and Aberrant Dragonmark appear in
  neither file.
- The registry and the catalog agree on every PHB feat they both
  cover, verified by a per-feat comparison in the report.
- Full `npm test` green on the builder's run; new/updated suites
  cover the catalog: all 75 present, category + prerequisite fields
  correct per feat, no 2014 text surviving in a book feat's entry.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  (`E:\DnD Meta Game\dnd-meta-game`) and iterate until green. Zach's
  full run is the gate — never claim it.
- Re-check: the report lists, per feat, the live catalog text and the
  stored category/prerequisite next to the book text in this brief,
  so the PM can verify without opening the repo. Include the
  registry/catalog agreement comparison and the Mobile grep results.

## Decisions already made
- The 2024 book wins on conflict; a feat the 2024 book has must match
  the book's version (Zach, 2026-11-24).
- **2014 feats are fine so long as they are distinct from 2024 feats**
  (Zach, 2026-11-24): Dungeon Delver, Linguist, and Martial Adept
  stay; a feat the book does have must match the book (the book
  supersedes its 2014 text). Mobile goes, replaced by its 2024
  version Speedy.
- The 13 homebrew feats stay as-is (Zach's feat-addition-14 set,
  minus Energy Affinity which is registry-only).
- The server registry is the better source for the rewrite; the client
  catalog is rebuilt, not patched (check judgment, confirmed by the
  counts above).
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling
  gets fixed in this job and reported — this is the basis for item 8
  (registry's own wrong entries).
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.
- Zach directed 2026-11-24 that all four checked sections be fixed in
  the engine.

## Report
- §3 format from `claude-code-handoff.md`, plus per-feat verdicts
  for all 75 book feats (added / corrected / already-correct /
  still-open with evidence), the 3 staying 2014 feats, the 13
  homebrew feats, and Mobile's removal (with the grep results).
- The registry/catalog agreement comparison (per feat, after the
  rebuild) and the registry fixes from item 8.
- The `category` / `prerequisites` / `repeatable` field shapes chosen
  and the ASI-choice storage shape, for the PM's veto at the gate.
- Any feat whose effect the engine does not yet resolve, listed as
  still-open (correct text, unwired effect) rather than silently
  dropped.
- Any question for Zach in full plain terms, one per item, with what
  was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never
  :3000).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief to
  Claude Code and carries the report back to Muse.
- Repo sync CONFIRMED 2026-11-10: the project lives on GitHub; Zach
  keeps the Mac and PC copies in sync. Claude Code builds on the PC
  copy and pushes to GitHub; Zach pulls to the Mac for the gate test.
- This job is one of four sibling briefs from the 2026-11-24 repo
  check (tools, alignment/lifestyle, feats, spells). They touch
  different files; Zach places them in order, one job at a time, one
  serial gate each.
- Place this brief at `docs/pm/repo-check-fixes-feats/BRIEF.md` in the
  repo when handing it over.
