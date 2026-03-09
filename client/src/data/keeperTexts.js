// Keeper class — Texts, Recitations, and Genre data
// Each text grants a weapon manifestation + a Passage (once per short rest special effect)
// Texts are divided into Standard (available L1+) and Rare (available L9+)

export const RECITATIONS = [
  {
    name: "Cutting Words",
    description: "You hurl a barbed literary critique at a creature within 60 feet. Make a ranged spell attack using CHA. On a hit, deal 1d8 psychic damage.",
    damageType: "psychic",
    scaling: "damage",
    range: 60
  },
  {
    name: "Whispered Ward",
    description: "You recite a protective verse. One creature within 30 feet gains 1d8 + CHA modifier temporary hit points.",
    damageType: null,
    scaling: "healing",
    range: 30
  },
  {
    name: "Spoken Command",
    description: "You speak a single word of authority. One creature within 60 feet must make a WIS save or be compelled to use its reaction to move 10 feet in a direction of your choice.",
    damageType: null,
    scaling: "control",
    range: 60
  },
  {
    name: "Narrative Spark",
    description: "You ignite a mote of story-energy and fling it at a creature within 60 feet. Make a ranged spell attack using CHA. On a hit, deal 1d8 force damage.",
    damageType: "force",
    scaling: "damage",
    range: 60
  },
  {
    name: "Echo of Resolve",
    description: "You recite a line of determination. One creature within 30 feet gains advantage on the next saving throw it makes before the end of its next turn.",
    damageType: null,
    scaling: "buff",
    range: 30
  },
  {
    name: "Verdant Rebuke",
    description: "You speak the name of a mythic beast. One creature within 60 feet must make a WIS save or take 1d8 psychic damage and have disadvantage on the next attack roll it makes before the end of its next turn.",
    damageType: "psychic",
    scaling: "damage",
    range: 60
  },
  {
    name: "Illuminating Passage",
    description: "You recite a passage of revelation. A 20-foot radius around a point within 60 feet is bathed in dim light for 1 minute. Hidden creatures in the area must make a DEX save or be revealed.",
    damageType: null,
    scaling: "utility",
    range: 60
  },
  {
    name: "Binding Syllable",
    description: "You speak a single syllable of power. One creature within 60 feet must make a STR save or have its speed reduced by 10 feet until the end of its next turn.",
    damageType: null,
    scaling: "control",
    range: 60
  }
];

export const STANDARD_TEXTS = [
  // === MELEE TEXTS ===
  {
    name: "The Siege of Aranthor",
    description: "An epic chronicle of the last stand at Aranthor's gates, where a lone guardian held the breach for three days",
    weapon: "Greataxe",
    weaponType: "melee",
    passage: {
      name: "Hold the Line",
      description: "Allies within 30 feet gain +2 AC until the end of your next turn.",
      type: "buff"
    }
  },
  {
    name: "Hymn of the Silver River",
    description: "A healing ballad from the riverlands, telling of waters that mend all wounds",
    weapon: "Shortsword",
    weaponType: "melee",
    passage: {
      name: "River's Mending",
      description: "One creature within 60 feet regains 2d6 + CHA modifier hit points.",
      type: "healing"
    }
  },
  {
    name: "The Titan's Lament",
    description: "The sorrowful tale of a giant who fought alone against an army, wielding a pillar torn from a temple",
    weapon: "Maul",
    weaponType: "melee",
    passage: {
      name: "Earthshaking Blow",
      description: "Each creature of your choice within 15 feet must make a STR save or be knocked prone and take 1d8 thunder damage.",
      type: "damage"
    }
  },
  {
    name: "The Duelist's Confession",
    description: "A romantic tragedy of two rival swordfighters whose duel ended in mutual respect and sacrifice",
    weapon: "Rapier",
    weaponType: "melee",
    passage: {
      name: "Riposte of the Heart",
      description: "Until the end of your next turn, when a creature misses you with a melee attack, you can use your reaction to make a manifested weapon attack against it with advantage.",
      type: "defense"
    }
  },
  {
    name: "Wrath of the Storm King",
    description: "A myth of the Storm King's fury unleashed upon those who broke their oaths",
    weapon: "Longsword",
    weaponType: "melee",
    passage: {
      name: "Oathbreaker's Judgment",
      description: "One creature within 60 feet must make a CHA save or take 2d8 lightning damage and be unable to tell a deliberate lie for 1 minute.",
      type: "damage"
    }
  },
  {
    name: "The Wanderer's Road",
    description: "A collection of travel journals from a legendary explorer who mapped the unknown reaches of the world",
    weapon: "Quarterstaff",
    weaponType: "melee",
    passage: {
      name: "Pathfinder's Boon",
      description: "Up to 4 creatures within 30 feet gain +10 movement speed and ignore difficult terrain for 10 minutes.",
      type: "utility"
    }
  },
  {
    name: "The Iron Vow",
    description: "A dwarven saga of oaths sworn on iron and kept through impossible hardship",
    weapon: "Warhammer",
    weaponType: "melee",
    passage: {
      name: "Unbreakable Oath",
      description: "You and one ally within 30 feet gain resistance to bludgeoning, piercing, and slashing damage until the end of your next turn.",
      type: "defense"
    }
  },
  {
    name: "Song of the Serpent",
    description: "A sinister tale of a poisoner who toppled a corrupt dynasty with nothing but patience and venom",
    weapon: "Scimitar",
    weaponType: "melee",
    passage: {
      name: "Serpent's Kiss",
      description: "Your manifested weapon attacks deal an extra 1d6 poison damage for 1 minute. The first creature you hit must make a CON save or be poisoned for 1 minute.",
      type: "damage"
    }
  },
  {
    name: "Chronicle of the First Flame",
    description: "A creation myth telling of the first fire that illuminated the void and gave birth to civilization",
    weapon: "Mace",
    weaponType: "melee",
    passage: {
      name: "Spark of Creation",
      description: "A 20-foot radius centered on you erupts with warmth. Each ally in the area regains 1d6 HP, and each enemy must make a DEX save or take 1d6 fire damage.",
      type: "mixed"
    }
  },

  // === RANGED TEXTS ===
  {
    name: "The Hawk's Pursuit",
    description: "A hunter's legend about an archer who never missed, guided by the spirit of a celestial hawk",
    weapon: "Longbow",
    weaponType: "ranged",
    passage: {
      name: "Unerring Arrow",
      description: "Your next manifested ranged weapon attack this turn has advantage and deals an extra 2d6 damage. If the target is concentrating on a spell, it has disadvantage on the concentration save.",
      type: "damage"
    }
  },
  {
    name: "The Bandit Queen's Gambit",
    description: "The story of a daring outlaw who robbed tyrants at crossbow-point and gave to the starving",
    weapon: "Hand Crossbow",
    weaponType: "ranged",
    passage: {
      name: "Robin's Justice",
      description: "Make a ranged manifested weapon attack. If it hits, the target drops one item it is holding (your choice) and you can choose one ally within 30 feet to gain temporary HP equal to the damage dealt.",
      type: "damage"
    }
  },
  {
    name: "Saga of the Stone Thrower",
    description: "A folk legend of a shepherd who slew giants with nothing but stones and faith",
    weapon: "Sling",
    weaponType: "ranged",
    passage: {
      name: "Giant Killer's Aim",
      description: "Your next ranged attack deals an extra 3d6 damage against a creature that is Large or larger. If the creature is Huge or larger, it must make a STR save or be stunned until the end of your next turn.",
      type: "damage"
    }
  },
  {
    name: "The Wind Dancer's Diary",
    description: "Writings of a halfling knife-thrower who performed impossible feats in traveling circuses",
    weapon: "Dagger (thrown)",
    weaponType: "ranged",
    passage: {
      name: "Blade Fan",
      description: "You manifest and throw three daggers at up to three different creatures within 30 feet. Make a separate attack roll for each. Each dagger that hits deals 1d4 + CHA modifier force damage.",
      type: "damage"
    }
  },
  {
    name: "Cartographer's Last Map",
    description: "The final work of a legendary cartographer who drew maps that could reshape the land itself",
    weapon: "Light Crossbow",
    weaponType: "ranged",
    passage: {
      name: "Charted Territory",
      description: "Choose a 30-foot square area within 120 feet. For 1 minute, you and your allies have advantage on attack rolls against creatures in that area, and creatures in the area have disadvantage on DEX saves from your Passages.",
      type: "control"
    }
  },

  // === VERSATILE/UTILITY TEXTS ===
  {
    name: "The Diplomat's Dilemma",
    description: "A treatise on a negotiator who prevented a war through nothing but clever argument and a sharp pen",
    weapon: "Dagger",
    weaponType: "melee",
    passage: {
      name: "Silver Tongue",
      description: "One creature within 60 feet that can hear you must make a WIS save. On failure, it regards you as a trusted friend for 1 minute or until you or your allies harm it. It will answer questions honestly and won't attack you willingly.",
      type: "control"
    }
  },
  {
    name: "The Librarian's Last Stand",
    description: "The tale of a scholar who defended a great library from an invading army using nothing but knowledge and cunning",
    weapon: "Club",
    weaponType: "melee",
    passage: {
      name: "Knowledge is Power",
      description: "For 1 minute, you can use your Intelligence modifier instead of Charisma for your manifested weapon attack and damage rolls, Recitation save DCs, and Passage save DCs.",
      type: "buff"
    }
  },
  {
    name: "Fables of the Trickster Fox",
    description: "A collection of tales about a cunning fox spirit who outsmarted gods and kings through wit alone",
    weapon: "Whip",
    weaponType: "melee",
    passage: {
      name: "Clever Gambit",
      description: "You become invisible until the end of your next turn or until you attack. During this time, you can move through occupied spaces, and the first attack you make after becoming visible has advantage and deals an extra 2d6 damage.",
      type: "utility"
    }
  }
];

export const RARE_TEXTS = [
  {
    name: "The Dragon's Epitaph",
    description: "A funerary text written in Draconic, recounting the death of an ancient wyrm and the power it left behind",
    weapon: "Greatsword",
    weaponType: "melee",
    passage: {
      name: "Dragon's Dying Breath",
      description: "You exhale a 30-foot cone of energy. Each creature in the area must make a DEX save, taking 4d8 fire, cold, lightning, or acid damage (your choice) on a failure, or half on a success.",
      type: "damage"
    },
    rare: true
  },
  {
    name: "Memoirs of the Archmage's Shadow",
    description: "The secret journals of an archmage's bodyguard, who learned to walk between moments of time",
    weapon: "Shortsword",
    weaponType: "melee",
    passage: {
      name: "Between the Moments",
      description: "You teleport up to 60 feet to an unoccupied space you can see, making a manifested weapon attack against each creature whose space you pass through. Each attack is made with advantage.",
      type: "mobility"
    },
    rare: true
  },
  {
    name: "The Siege Engine's Blueprint",
    description: "Technical schematics from a military genius, annotated with devastating tactical insights",
    weapon: "Heavy Crossbow",
    weaponType: "ranged",
    passage: {
      name: "Demolishing Shot",
      description: "Make a ranged manifested weapon attack. On a hit, the bolt deals an extra 4d8 force damage and the target must make a STR save or be knocked back 20 feet and fall prone. Objects and structures take double damage.",
      type: "damage"
    },
    rare: true
  },
  {
    name: "The Revenant's Confession",
    description: "A text found in a tomb — the written rage of one who died with unfinished business",
    weapon: "Morningstar",
    weaponType: "melee",
    passage: {
      name: "Undying Spite",
      description: "For 1 minute, when you are hit by an attack, the attacker takes 2d6 necrotic damage. If you are reduced to 0 HP during this time, you can stay conscious and keep fighting until the start of your next turn (you still make death saves).",
      type: "defense"
    },
    rare: true
  },
  {
    name: "The Celestial Concordance",
    description: "A star map annotated with divine observations, describing the movements of celestial beings",
    weapon: "Halberd",
    weaponType: "melee",
    passage: {
      name: "Heaven's Alignment",
      description: "For 1 minute, your manifested weapon sheds bright light in a 20-foot radius. Undead and fiends in the light have disadvantage on attack rolls and saving throws. You and allies in the light regain 1d6 HP at the start of each of your turns.",
      type: "mixed"
    },
    rare: true
  },
  {
    name: "The War Poet's Final Stanza",
    description: "The last work of a warrior-poet who wrote verses in blood on the battlefield, each word a weapon",
    weapon: "Glaive",
    weaponType: "melee",
    passage: {
      name: "Verse of Carnage",
      description: "For 1 minute, each time you hit a creature with a manifested weapon, you gain a stacking +1 bonus to damage rolls (max +5). If you reduce a creature to 0 HP, the bonus resets to +3.",
      type: "damage"
    },
    rare: true
  },
  {
    name: "The Prophecy Unspoken",
    description: "A scroll of prophecy that was never meant to be read aloud — its words reshape what will be",
    weapon: "Longbow",
    weaponType: "ranged",
    passage: {
      name: "Foretold Doom",
      description: "Choose one creature you can see within 120 feet. Declare a prophecy of its defeat. For 1 minute, all attacks against that creature have advantage, and it has disadvantage on all saving throws. The creature can make a CHA save at the end of each of its turns to end the effect.",
      type: "debuff"
    },
    rare: true
  },
  {
    name: "Testament of the Peacemaker",
    description: "The magnum opus of history's greatest mediator, whose words once ended a continental war",
    weapon: "Shield (manifested ward)",
    weaponType: "shield",
    passage: {
      name: "Words of Ceasefire",
      description: "Each creature of your choice within 60 feet must make a WIS save. On failure, the creature cannot make attack rolls for 1 minute (save at end of each turn to end). Taking damage from any source ends the effect on that creature.",
      type: "control"
    },
    rare: true
  }
];

// === SUBCLASS-SPECIFIC TEXTS ===
// Exclusive texts unlocked at subclass feature levels (L6, L11, L15)
// Grounded in Forgotten Realms established lore and book titles

export const SUBCLASS_TEXTS = {
  lorewarden: [
    {
      name: "The Fall of Myth Drannor",
      description: "A chronicle of the legendary siege that destroyed the elven city of Myth Drannor in 714 DR, preserved in Candlekeep's deepest vaults",
      weapon: "Tower Shield (manifested ward, +2 AC)",
      weaponType: "shield",
      passage: {
        name: "Akh'Faer's Last Line",
        description: "As a reaction when an ally within 10 feet is hit by an attack, reduce the damage by 1d10 + your CHA modifier. If this reduces the damage to 0, the attacker has disadvantage on its next attack.",
        type: "defense"
      },
      subclass: "Lorewarden",
      unlockedAt: 6
    },
    {
      name: "The Purple Dragon Field Manual",
      description: "Official military doctrine of Cormyr's elite Purple Dragon Knights, covering formation tactics and defensive protocols",
      weapon: "Bastard Sword (longsword, versatile)",
      weaponType: "melee",
      passage: {
        name: "Hold Until Relieved",
        description: "For 1 minute, you and allies within 10 feet cannot be moved against your will (immune to push, pull, and forced movement) and have advantage on STR saving throws.",
        type: "buff"
      },
      subclass: "Lorewarden",
      unlockedAt: 11
    },
    {
      name: "The Shieldmeet Concordance",
      description: "Historic treaties negotiated at Shieldmeet festivals in Waterdeep, imbued with the power of oaths sworn and kept",
      weapon: "Warhammer",
      weaponType: "melee",
      passage: {
        name: "Unbreakable Oath",
        description: "When you or an ally within 30 feet would be reduced to 0 HP, instead set them to 1 HP and grant them CHA modifier temp HP. Usable once per Passage use (recharges on short rest like all Passages).",
        type: "defense"
      },
      subclass: "Lorewarden",
      unlockedAt: 15
    }
  ],
  mythslinger: [
    {
      name: "Volo's Guide to the Sword Coast",
      description: "Volothamp Geddarm's famous travelogue, annotated with precise accounts of distant lands and the creatures within them",
      weapon: "Longbow",
      weaponType: "ranged",
      passage: {
        name: "The Precise Account",
        description: "Your next ranged attack ignores all cover (including full cover, as long as you know the target's location) and has advantage. If it hits, the target can't benefit from cover against your attacks until your next turn.",
        type: "damage"
      },
      subclass: "Mythslinger",
      unlockedAt: 6
    },
    {
      name: "The Ballad of the Windwalkers",
      description: "Songs of the Aarakocra scouts who patrolled the Storm Horns of Cormyr, striking like lightning from impossible distances",
      weapon: "Composite Longbow (longbow, +INT mod to damage)",
      weaponType: "ranged",
      passage: {
        name: "Wind's Judgment",
        description: "Fire a line of energy 15 feet wide and 60 feet long. Each creature in the line makes a DEX save or takes your weapon damage + Legendary Aim bonus. Half damage on a success.",
        type: "damage"
      },
      subclass: "Mythslinger",
      unlockedAt: 11
    },
    {
      name: "Elminster's Annotations on the Dracorage",
      description: "Elminster Aumar's personal account of the Rage of Dragons in 1018 DR, detailing how mortal heroes brought down wyrms",
      weapon: "Heavy Crossbow",
      weaponType: "ranged",
      passage: {
        name: "The Dragonslayer's Shot",
        description: "Declare before your attack. On a hit, deal an extra 4d8 force damage and the target must make a CON save or be stunned until the end of your next turn. On a critical hit, double the extra force damage.",
        type: "damage"
      },
      subclass: "Mythslinger",
      unlockedAt: 15
    }
  ],
  rhetorician: [
    {
      name: "Alaundo's Prophecies",
      description: "The chanted prophecies of Alaundo the Seer, kept by the Avowed of Candlekeep — every prophecy has come true",
      weapon: "Quarterstaff",
      weaponType: "melee",
      passage: {
        name: "The Foretold Failure",
        description: "Target creature within 60 feet makes a WIS save. On failure, its next attack roll, ability check, or saving throw has disadvantage, and you learn its next intended action (attack, flee, cast a spell, etc.).",
        type: "control"
      },
      subclass: "Rhetorician",
      unlockedAt: 6
    },
    {
      name: "The Cyrinishad",
      description: "The legendary book created by Cyric, god of lies — any who read it become enslaved to his will. Only fragments survive, but fragments are enough",
      weapon: "Dagger",
      weaponType: "melee",
      passage: {
        name: "Unmaking Words",
        description: "Target within 30 feet makes a CHA save. On failure, it loses concentration on any active spell or effect, and cannot cast spells or use abilities requiring mental focus until the end of your next turn.",
        type: "control"
      },
      subclass: "Rhetorician",
      unlockedAt: 11
    },
    {
      name: "The Leaves of One Night",
      description: "An ancient elven text said to contain truths that break the mortal mind — the elves sealed it away for good reason",
      weapon: "Rapier",
      weaponType: "melee",
      passage: {
        name: "Truth Unbearable",
        description: "30-foot cone. Each creature makes an INT save. On failure, stunned for 1 round AND you learn one secret (a vulnerability, a prepared spell, or a hidden motivation). On success, takes 2d8 psychic damage.",
        type: "control"
      },
      subclass: "Rhetorician",
      unlockedAt: 15
    }
  ],
  versebinder: [
    {
      name: "The Canticle of Selune",
      description: "Sacred hymns of the Moonmaiden, sung by her priestesses during healing rites under the full moon",
      weapon: "Mace",
      weaponType: "melee",
      passage: {
        name: "Moonfire Restoration",
        description: "Touch one creature: heal 2d8 + CHA modifier HP and remove one condition (poisoned, blinded, deafened, or frightened).",
        type: "healing"
      },
      subclass: "Versebinder",
      unlockedAt: 6
    },
    {
      name: "Deneir's Illuminated Codex",
      description: "The sacred text of Deneir, god of writing and illumination — its pages glow with divine light that mends the spirit",
      weapon: "Wand (as club)",
      weaponType: "melee",
      passage: {
        name: "Words of Warding",
        description: "All allies within 30 feet gain temporary HP equal to your CHA modifier and advantage on their next saving throw.",
        type: "buff"
      },
      subclass: "Versebinder",
      unlockedAt: 11
    },
    {
      name: "The Leaves of Learning",
      description: "Oghma's most sacred text, said to contain all knowledge of restoration and renewal — fragments surface in times of great need",
      weapon: "Quarterstaff",
      weaponType: "melee",
      passage: {
        name: "The Unwritten Verse",
        description: "Revive a creature that died within the last minute to 1 HP, then heal it for 4d8 + CHA modifier. It gains resistance to all damage for 1 round. This Passage cannot be recovered by Literary Recall.",
        type: "healing"
      },
      subclass: "Versebinder",
      unlockedAt: 15
    }
  ]
};

export const ALL_TEXTS = [...STANDARD_TEXTS, ...RARE_TEXTS];

export const GENRE_DOMAINS = [
  {
    id: "history",
    name: "History",
    description: "Chronicles, timelines, and the rise and fall of civilizations",
    passive: "Advantage on INT checks to recall historical events, people, and places. When you use a Passage that targets an enemy, learn one fact about them (creature type, a resistance, or a vulnerability).",
    masteryUpgrade: "Your history knowledge becomes supernatural. You can cast Legend Lore once per long rest without material components.",
    masteryCapstone: "Lesson of the Past: Once per long rest, choose one creature you can see. For 1 minute, you and allies have advantage on attack rolls against it."
  },
  {
    id: "tactics",
    name: "Tactics",
    description: "Military treatises, battle formations, and the art of war",
    passive: "Add INT modifier to initiative. On the first round of combat, manifested weapon attacks deal an extra 1d6 damage.",
    masteryUpgrade: "Your tactical initiative bonus applies to allies within 30 feet who can hear you.",
    masteryCapstone: "Battle Plan: Once per long rest, for 1 minute, up to 4 allies add your INT modifier to initiative and gain advantage on their first attack each turn."
  },
  {
    id: "romance",
    name: "Romance",
    description: "Love epics, tragedies, and courtly tales of devotion and sacrifice",
    passive: "Add CHA modifier as bonus to Persuasion and Deception. When an ally within 30 feet drops to 0 HP, use reaction to give them temp HP equal to Keeper level (once per short rest).",
    masteryUpgrade: "Your protective reaction now also stabilizes the ally and lets them use their reaction to stand up.",
    masteryCapstone: "Lover's Vow: Once per long rest, bond with one ally for 1 minute. You each may take half the other's damage (no action required)."
  },
  {
    id: "poetry",
    name: "Poetry",
    description: "Verse, meter, rhythm, and the power of spoken word",
    passive: "Recitations have doubled range (120 ft attacks, 60 ft buffs). Using the same Recitation on consecutive turns increases its damage by 1d8 on the second use.",
    masteryUpgrade: "Consecutive Recitation bonus stacks up to 3 turns (+1d8, +2d8, +3d8).",
    masteryCapstone: "Magnum Opus: Once per long rest, for 1 minute, all Recitations deal max damage and save DCs increase by 2."
  },
  {
    id: "mythology",
    name: "Mythology",
    description: "Creation myths, divine tales, and prophecy",
    passive: "Choose a damage type (fire, cold, lightning, or radiant). Gain resistance to it. Passages can deal this type instead of normal.",
    masteryUpgrade: "Choose a second damage type for resistance. Your manifested weapons deal an extra 1d4 of your chosen type.",
    masteryCapstone: "Mythic Invocation: Once per long rest, for 1 minute, manifested weapons deal extra 2d6 of your chosen type and you gain immunity to it."
  },
  {
    id: "political_science",
    name: "Political Science",
    description: "Treatises on power, law, governance, and manipulation",
    passive: "Gain expertise in Insight. When you use Compelling Rhetoric (L10), the target has disadvantage on its initial save.",
    masteryUpgrade: "Compelling Rhetoric can target two creatures simultaneously.",
    masteryCapstone: "Edict of Authority: Once per long rest, up to 6 creatures within 60 ft make WIS save or follow a one-sentence command for 1 minute (save at end of each turn)."
  },
  {
    id: "natural_philosophy",
    name: "Natural Philosophy",
    description: "Bestiaries, herbalism, and elemental theory",
    passive: "Manifested weapons can deal fire, cold, lightning, or acid damage (chosen each manifest). Advantage on Nature and Survival checks.",
    masteryUpgrade: "Your elemental weapon damage ignores resistance (but not immunity).",
    masteryCapstone: "Theorem of Elements: Once per long rest, for 1 minute, each hit forces CON save or elemental affliction (fire: 1d6 ongoing, cold: speed halved, lightning: no reactions, acid: -2 AC)."
  },
  {
    id: "forbidden_texts",
    name: "Forbidden Texts",
    description: "Banned works, heretical writings, and truths too dangerous to speak",
    passive: "Recitations and Passages can deal necrotic/psychic. When using a Passage, take 1d6 unreducible necrotic to add 2d6 to its damage or healing.",
    masteryUpgrade: "The self-damage reduces to 1d4, and the bonus increases to 3d6.",
    masteryCapstone: "Forbidden Chapter: Once per long rest, for 1 minute, Passages cost no action (invoke as part of attack), but each deals 1d6 necrotic to you. Recitations deal extra 2d8 necrotic."
  }
];
