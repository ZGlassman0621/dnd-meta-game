// client/src/data/warlockInvocations.js — client copy of the 2024 Warlock
// Eldritch Invocations catalog (class-audit item 2). The source of truth is
// server/data/warlockInvocations.js; tests/warlock-invocations.test.js pins
// this copy equal to it. The creator uses it for the level-1 pick; the
// level-up picker and the sheet read eligibility from the server.

export const INVOCATIONS_KNOWN_BY_LEVEL = [1,3,3,3,5,5,6,6,7,7,7,8,8,8,9,9,9,10,10,10]

export const WARLOCK_INVOCATIONS = [
  {
    "key": "agonizing_blast",
    "name": "Agonizing Blast",
    "minLevel": 2,
    "requires": {
      "cantrip": "damage"
    },
    "choiceKind": "cantrip",
    "repeatable": true,
    "prereqText": "Level 2+, a Warlock cantrip that deals damage",
    "effect": "Add your Charisma modifier to that cantrip's damage rolls."
  },
  {
    "key": "armor_of_shadows",
    "name": "Armor of Shadows",
    "minLevel": 1,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "—",
    "effect": "Cast Mage Armor on yourself without a spell slot."
  },
  {
    "key": "ascendant_step",
    "name": "Ascendant Step",
    "minLevel": 5,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 5+",
    "effect": "Cast Levitate on yourself without a spell slot."
  },
  {
    "key": "devils_sight",
    "name": "Devil's Sight",
    "minLevel": 2,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 2+",
    "effect": "See normally in magical and nonmagical Darkness within 120 ft."
  },
  {
    "key": "devouring_blade",
    "name": "Devouring Blade",
    "minLevel": 12,
    "requires": {
      "invocation": "thirsting_blade"
    },
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 12+, Thirsting Blade",
    "effect": "Thirsting Blade's Extra Attack gives two extra attacks instead of one."
  },
  {
    "key": "eldritch_mind",
    "name": "Eldritch Mind",
    "minLevel": 1,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "—",
    "effect": "Advantage on Constitution saves to maintain Concentration."
  },
  {
    "key": "eldritch_smite",
    "name": "Eldritch Smite",
    "minLevel": 5,
    "requires": {
      "pact": "blade"
    },
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 5+, Pact of the Blade",
    "effect": "Once per turn, spend a Pact slot on a pact-weapon hit: +1d8 Force per slot level, and Prone if Huge or smaller."
  },
  {
    "key": "eldritch_spear",
    "name": "Eldritch Spear",
    "minLevel": 2,
    "requires": {
      "cantrip": "damage_range10"
    },
    "choiceKind": "cantrip",
    "repeatable": true,
    "prereqText": "Level 2+, a Warlock cantrip that deals damage and has 10+ ft range",
    "effect": "That cantrip's range increases by 30 ft per Warlock level."
  },
  {
    "key": "fiendish_vigor",
    "name": "Fiendish Vigor",
    "minLevel": 2,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 2+",
    "effect": "Cast False Life on yourself without a spell slot (max Temp HP)."
  },
  {
    "key": "gaze_of_two_minds",
    "name": "Gaze of Two Minds",
    "minLevel": 5,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 5+",
    "effect": "Bonus Action: touch a willing creature and perceive through its senses until the end of your next turn."
  },
  {
    "key": "gift_of_the_depths",
    "name": "Gift of the Depths",
    "minLevel": 5,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 5+",
    "effect": "Breathe underwater, Swim Speed equal to Speed, cast Water Breathing once per Long Rest without a slot."
  },
  {
    "key": "gift_of_the_protectors",
    "name": "Gift of the Protectors",
    "minLevel": 9,
    "requires": {
      "pact": "tome"
    },
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 9+, Pact of the Tome",
    "effect": "A page in your Book of Shadows holds names (up to Cha mod); a named creature reduced to 0 HP drops to 1 HP instead, once per Long Rest."
  },
  {
    "key": "investment_of_the_chain_master",
    "name": "Investment of the Chain Master",
    "minLevel": 5,
    "requires": {
      "pact": "chain"
    },
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 5+, Pact of the Chain",
    "effect": "Your familiar gains a Fly or Swim Speed of 40 ft, a Bonus Action attack, Necrotic/Radiant damage option, your save DC, and Reaction-granted Resistance."
  },
  {
    "key": "lessons_of_the_first_ones",
    "name": "Lessons of the First Ones",
    "minLevel": 2,
    "requires": {},
    "choiceKind": "origin_feat",
    "repeatable": true,
    "prereqText": "Level 2+",
    "effect": "Gain one Origin feat of your choice."
  },
  {
    "key": "lifedrinker",
    "name": "Lifedrinker",
    "minLevel": 9,
    "requires": {
      "pact": "blade"
    },
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 9+, Pact of the Blade",
    "effect": "Once per turn, a pact-weapon hit deals +1d6 Necrotic/Psychic/Radiant, and you can spend a Hit Die to heal."
  },
  {
    "key": "mask_of_many_faces",
    "name": "Mask of Many Faces",
    "minLevel": 2,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 2+",
    "effect": "Cast Disguise Self without a spell slot."
  },
  {
    "key": "master_of_myriad_forms",
    "name": "Master of Myriad Forms",
    "minLevel": 5,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 5+",
    "effect": "Cast Alter Self without a spell slot."
  },
  {
    "key": "misty_visions",
    "name": "Misty Visions",
    "minLevel": 2,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 2+",
    "effect": "Cast Silent Image without a spell slot."
  },
  {
    "key": "one_with_shadows",
    "name": "One with Shadows",
    "minLevel": 5,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 5+",
    "effect": "In Dim Light or Darkness, cast Invisibility on yourself without a spell slot."
  },
  {
    "key": "otherworldly_leap",
    "name": "Otherworldly Leap",
    "minLevel": 2,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 2+",
    "effect": "Cast Jump on yourself without a spell slot."
  },
  {
    "key": "pact_of_the_blade",
    "name": "Pact of the Blade",
    "minLevel": 1,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "—",
    "effect": "Conjure or bond a pact weapon; use Charisma for attack/damage, deal Necrotic/Psychic/Radiant or normal damage."
  },
  {
    "key": "pact_of_the_chain",
    "name": "Pact of the Chain",
    "minLevel": 1,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "—",
    "effect": "Learn Find Familiar, cast without a slot; special forms (Imp, Pseudodragon, Quasit, Skeleton, Sphinx of Wonder, Sprite, Venomous Snake); forgo an attack to let the familiar attack."
  },
  {
    "key": "pact_of_the_tome",
    "name": "Pact of the Tome",
    "minLevel": 1,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "—",
    "effect": "Conjure a Book of Shadows: 3 cantrips + 2 level-1 Ritual spells prepared; use as a Spellcasting Focus."
  },
  {
    "key": "repelling_blast",
    "name": "Repelling Blast",
    "minLevel": 2,
    "requires": {
      "cantrip": "damage_attack"
    },
    "choiceKind": "cantrip",
    "repeatable": true,
    "prereqText": "Level 2+, a Warlock cantrip that deals damage via an attack roll",
    "effect": "On a hit vs a Large or smaller creature, push it 10 ft straight away from you."
  },
  {
    "key": "thirsting_blade",
    "name": "Thirsting Blade",
    "minLevel": 5,
    "requires": {
      "pact": "blade"
    },
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 5+, Pact of the Blade",
    "effect": "Extra Attack with your pact weapon only."
  },
  {
    "key": "visions_of_distant_realms",
    "name": "Visions of Distant Realms",
    "minLevel": 9,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 9+",
    "effect": "Cast Arcane Eye without a spell slot."
  },
  {
    "key": "whispers_of_the_grave",
    "name": "Whispers of the Grave",
    "minLevel": 7,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 7+",
    "effect": "Cast Speak with Dead without a spell slot."
  },
  {
    "key": "witch_sight",
    "name": "Witch Sight",
    "minLevel": 15,
    "requires": {},
    "choiceKind": null,
    "repeatable": false,
    "prereqText": "Level 15+",
    "effect": "Truesight with a range of 30 ft."
  }
]

export default { INVOCATIONS_KNOWN_BY_LEVEL, WARLOCK_INVOCATIONS }
