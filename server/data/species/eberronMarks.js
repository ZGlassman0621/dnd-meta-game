// Eberron dragonmarks — Eberron: Rising from the Last War (2026-11-04).
// The 12 marks as variant subraces on their base species, transcribed from
// the book extract on the VM, ASI as-written and flagged legacy. Variant
// trait lists are FULL lists (base traits kept, except where `replaces`
// names a superseded trait); `resolvedASI` is the TOTAL. `markSpells`
// are the spells ADDED TO THE SPELL LIST of a spellcasting class — they
// are not free casts; the free casts live in `innateSpells` (the magic
// trait). Human marks build on Variant Human (bonus feat + skill kept,
// ASI replaced); halfling / dwarf / gnome / elf marks keep the base ASI
// and add +1; half-elf marks replace ASI + Skill Versatility. Aberrant
// Dragonmark is a feat, not a subrace, and is deliberately excluded.
const HUMAN_MARK_BASE = [
  "Skills - Proficiency in one skill of your choice",
  "Feat - You gain one feat of your choice",
  "Extra Language - You can speak, read, and write one extra language of your choice",
];
const VARIANT_HUMAN_ASI = "Ability Score Increase - +1 to two different ability scores of your choice";

export const EBERRONMARKS = [
  {
    id: "half-elf", name: "Half-Elf", description: "", size: "", speeds: {}, languages: [],
    traits: [], abilityScoreIncrease: {}, source: "", origins: ["Eberron"], innateSpells: [],
    variants: [
      {
        name: "Mark of Detection",
        description: "House Medani's mark, borne by half-elves. The Warning Guild specializes in subtle threats and complex mysteries — an inquisitive's dream that sharpens observation and intuition.",
        traits: ["Darkvision (60 ft)", "Fey Ancestry - Advantage on saves against being charmed, magic can't put you to sleep", "Deductive Intuition - When you make an Intelligence (Investigation) or a Wisdom (Insight) check, you can roll a d4 and add the number rolled to the ability check", "Magical Detection - You can cast the Detect Magic and Detect Poison and Disease spells with this trait; starting at 3rd level, you can also cast the See Invisibility spell with it; once you cast any of these spells with this trait, you can't cast that spell with it again until you finish a long rest; Intelligence is your spellcasting ability, and you don't require material components for them"],
        grants: { senses: ["darkvision 60 ft"] },
        speeds: null,
        resolvedASI: {"wis": 2, "choice": 1},
        replaces: ["Skill Versatility - Proficiency in two skills of your choice"],
        innateSpells: [{"name": "Detect Magic", "level": 1, "uses": "once per long rest"}, {"name": "Detect Poison and Disease", "level": 1, "uses": "once per long rest"}, {"name": "See Invisibility", "level": 2, "atLevel": 3, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Detect Evil and Good", "Detect Poison and Disease"]}, {level: 2, spells: ["Detect Thoughts", "Find Traps"]}, {level: 3, spells: ["Clairvoyance", "Nondetection"]}, {level: 4, spells: ["Arcane Eye", "Divination"]}, {level: 5, spells: ["Legend Lore"]}],
      },
      {
        name: "Mark of Storm",
        description: "House Lyrandar's mark, borne by half-elves. The Raincallers' Guild uses it to control weather for clients, and Lyrandar's airships — and the lightning rail's rivals — run on its power.",
        traits: ["Darkvision (60 ft)", "Fey Ancestry - Advantage on saves against being charmed, magic can't put you to sleep", "Windwright's Intuition - When you make a Dexterity (Acrobatics) check or any ability check involving navigator's tools, you can roll a d4 and add the number rolled to the ability check", "Headwinds - You know the Gust cantrip; starting at 3rd level, you can cast the Gust of Wind spell once with this trait, regaining the ability when you finish a long rest; Charisma is your spellcasting ability"],
        grants: { senses: ["darkvision 60 ft"] },
        speeds: null,
        resolvedASI: {"cha": 2, "dex": 1},
        replaces: ["Skill Versatility - Proficiency in two skills of your choice"],
        innateSpells: [{"name": "Gust", "level": 0, "uses": "at will"}, {"name": "Gust of Wind", "level": 2, "atLevel": 3, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Feather Fall", "Fog Cloud"]}, {level: 2, spells: ["Gust of Wind", "Levitate"]}, {level: 3, spells: ["Sleet Storm", "Wind Wall"]}, {level: 4, spells: ["Conjure Minor Elemental", "Control Water"]}, {level: 5, spells: ["Conjure Elemental"]}],
      },
    ],
  },
  {
    id: "half-orc", name: "Half-Orc", description: "", size: "", speeds: {}, languages: [],
    traits: [], abilityScoreIncrease: {}, source: "", origins: ["Eberron"], innateSpells: [],
    variants: [
      {
        name: "Mark of Finding",
        description: "House Tharashk's mark, carried by half-orcs (and humans). The Finder's Guild licenses inquisitives and bounty hunters — and lately dragonshard prospectors, the house's newest source of wealth.",
        traits: ["Darkvision (60 ft)", "Menacing - Proficiency in Intimidation skill", "Relentless Endurance - Drop to 1 HP instead of 0 once per long rest", "Savage Attacks - Roll one extra weapon damage die on critical hits", "Hunter's Intuition - When you make a Wisdom (Perception) or Wisdom (Survival) check, you can roll a d4 and add the number rolled to the ability check", "Finder's Magic - You can cast the Hunter's Mark spell with this trait; starting at 3rd level, you can also cast the Locate Object spell with it; once you cast either spell with this trait, you can't cast that spell with it again until you finish a long rest; Wisdom is your spellcasting ability"],
        grants: { skills: ["intimidation"], senses: ["darkvision 60 ft"] },
        speeds: null,
        resolvedASI: {"wis": 2, "con": 1},
        replaces: [],
        innateSpells: [{"name": "Hunter's Mark", "level": 1, "uses": "once per long rest"}, {"name": "Locate Object", "level": 2, "atLevel": 3, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Faerie Fire", "Longstrider"]}, {level: 2, spells: ["Locate Animals or Plants", "Locate Object"]}, {level: 3, spells: ["Clairvoyance", "Speak with Plants"]}, {level: 4, spells: ["Divination", "Locate Creature"]}, {level: 5, spells: ["Commune with Nature"]}],
      },
    ],
  },
  {
    id: "human", name: "Human", description: "", size: "", speeds: {}, languages: [],
    traits: [], abilityScoreIncrease: {}, source: "", origins: ["Eberron"], innateSpells: [],
    variants: [
      {
        name: "Mark of Finding",
        description: "House Tharashk's mark, carried by humans (and half-orcs). Alone among the dragonmarks, Finding is carried by two races.",
        traits: [...HUMAN_MARK_BASE, "Hunter's Intuition - When you make a Wisdom (Perception) or Wisdom (Survival) check, you can roll a d4 and add the number rolled to the ability check", "Finder's Magic - You can cast the Hunter's Mark spell with this trait; starting at 3rd level, you can also cast the Locate Object spell with it; once you cast either spell with this trait, you can't cast that spell with it again until you finish a long rest; Wisdom is your spellcasting ability"],
        grants: { skills: [{ choose: 1, from: "any_skill" }] },
        speeds: null,
        resolvedASI: {"wis": 2, "choice": 1},
        replaces: [VARIANT_HUMAN_ASI],
        innateSpells: [{"name": "Hunter's Mark", "level": 1, "uses": "once per long rest"}, {"name": "Locate Object", "level": 2, "atLevel": 3, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Faerie Fire", "Longstrider"]}, {level: 2, spells: ["Locate Animals or Plants", "Locate Object"]}, {level: 3, spells: ["Clairvoyance", "Speak with Plants"]}, {level: 4, spells: ["Divination", "Locate Creature"]}, {level: 5, spells: ["Commune with Nature"]}],
      },
      {
        name: "Mark of Handling",
        description: "House Vadalis's mark. Vadalis breeds and trains the animals that feed, carry, and serve Khorvaire — and its most innovative members breed stranger things still.",
        traits: [...HUMAN_MARK_BASE, "Wild Intuition - When you make a Wisdom (Animal Handling) check, you can roll a d4 and add the number rolled to the ability check", "Handling Magic - You can cast the Animal Friendship and Speak with Animals spells with this trait; once you cast either spell with this trait, you can't cast that spell with it again until you finish a long rest; Wisdom is your spellcasting ability", "The Bigger They Are - Starting at 3rd level, you can target a beast or monstrosity when you cast Animal Friendship or Speak with Animals, provided the creature's Intelligence score is 3 or lower"],
        grants: { skills: [{ choose: 1, from: "any_skill" }] },
        speeds: null,
        resolvedASI: {"wis": 2, "choice": 1},
        replaces: [VARIANT_HUMAN_ASI],
        innateSpells: [{"name": "Animal Friendship", "level": 1, "uses": "once per long rest"}, {"name": "Speak with Animals", "level": 1, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Animal Friendship", "Speak with Animals"]}, {level: 2, spells: ["Beast Sense", "Calm Emotions"]}, {level: 3, spells: ["Beacon of Hope", "Conjure Animals"]}, {level: 4, spells: ["Aura of Life", "Dominate Beast"]}, {level: 5, spells: ["Awaken"]}],
      },
      {
        name: "Mark of Making",
        description: "House Cannith's mark. Cannith dominates all forms of manufacturing, mystical and mundane — and its forgeholds use streamlined production to arm nations, including the makers of the warforged.",
        traits: [...HUMAN_MARK_BASE, "Artisan's Intuition - When you make an Arcana check or an ability check involving artisan's tools, you can roll a d4 and add the number rolled to the ability check", "Spellsmith - You know the Mending cantrip; you can also cast the Magic Weapon spell once with this trait, regaining the ability when you finish a long rest; when you cast it this way, the spell lasts for 1 hour and doesn't require concentration; Intelligence is your spellcasting ability"],
        grants: { skills: [{ choose: 1, from: "any_skill" }] },
        speeds: null,
        resolvedASI: {"int": 2, "choice": 1},
        replaces: [VARIANT_HUMAN_ASI],
        innateSpells: [{"name": "Mending", "level": 0, "uses": "at will"}, {"name": "Magic Weapon", "level": 2, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Identify", "Tenser's Floating Disk"]}, {level: 2, spells: ["Continual Flame", "Magic Weapon"]}, {level: 3, spells: ["Conjure Barrage", "Elemental Weapon"]}, {level: 4, spells: ["Fabricate", "Stone Shape"]}, {level: 5, spells: ["Creation"]}],
      },
      {
        name: "Mark of Passage",
        description: "House Orien's mark. Orien has dominated transportation for centuries — caravans, coaches, and the lightning rail — and its heirs can step between places the way others step across a room.",
        traits: [...HUMAN_MARK_BASE, "Magical Passage - You can cast the Misty Step spell once with this trait, regaining the ability when you finish a long rest; Dexterity is your spellcasting ability"],
        grants: { skills: [{ choose: 1, from: "any_skill" }] },
        speeds: null,
        resolvedASI: {"dex": 2, "choice": 1},
        replaces: [VARIANT_HUMAN_ASI],
        innateSpells: [{"name": "Misty Step", "level": 2, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Expeditious Retreat", "Jump"]}, {level: 2, spells: ["Misty Step", "Pass without Trace"]}, {level: 3, spells: ["Blink", "Phantom Steed"]}, {level: 4, spells: ["Dimension Door", "Freedom of Movement"]}, {level: 5, spells: ["Teleportation Circle"]}],
      },
      {
        name: "Mark of Sentinel",
        description: "House Deneith's mark. Deneith's Blademarks Guild sells protection across Khorvaire, and its Sentinel Marshals hold the authority to pursue criminals and enforce the law across the length of the continent.",
        traits: [...HUMAN_MARK_BASE, "Sentinel's Intuition - When you make a Wisdom (Insight) or Wisdom (Perception) check, you can roll a d4 and add the number rolled to the ability check", "Guardian's Shield - You can cast the Shield spell once with this trait, regaining the ability when you finish a long rest; Wisdom is your spellcasting ability"],
        grants: { skills: [{ choose: 1, from: "any_skill" }] },
        speeds: null,
        resolvedASI: {"con": 2, "wis": 1},
        replaces: [VARIANT_HUMAN_ASI],
        innateSpells: [{"name": "Shield", "level": 1, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Compelled Duel", "Shield of Faith"]}, {level: 2, spells: ["Warding Bond", "Zone of Truth"]}, {level: 3, spells: ["Counterspell", "Protection from Energy"]}, {level: 4, spells: ["Death Ward", "Guardian of Faith"]}, {level: 5, spells: ["Bigby's Hand"]}],
      },
    ],
  },
  {
    id: "halfling", name: "Halfling", description: "", size: "", speeds: {}, languages: [],
    traits: [], abilityScoreIncrease: {}, source: "", origins: ["Eberron"], innateSpells: [],
    variants: [
      {
        name: "Mark of Healing",
        description: "House Jorasco's mark. Jorasco's healers are the public face of medicine across Khorvaire — if you can afford their services, they will treat you; the house maintains it's about prosperity, not greed.",
        traits: ["Lucky - Reroll 1s on attack rolls, ability checks, and saving throws", "Brave - Advantage on saving throws against being frightened", "Halfling Nimbleness - You can move through the space of any creature that is of a size larger than yours", "Medical Intuition - When you make a Wisdom (Medicine) check, you can roll a d4 and add the number rolled to the ability check", "Healing Touch - You can cast the Cure Wounds spell with this trait; starting at 3rd level, you can also cast the Lesser Restoration spell with it; once you cast either spell with this trait, you can't cast that spell with it again until you finish a long rest; Wisdom is your spellcasting ability"],
        speeds: null,
        resolvedASI: {"dex": 2, "wis": 1},
        replaces: [],
        innateSpells: [{"name": "Cure Wounds", "level": 1, "uses": "once per long rest"}, {"name": "Lesser Restoration", "level": 2, "atLevel": 3, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Cure Wounds", "Healing Word"]}, {level: 2, spells: ["Lesser Restoration", "Prayer of Healing"]}, {level: 3, spells: ["Aura of Vitality", "Mass Healing Word"]}, {level: 4, spells: ["Aura of Purity", "Aura of Life"]}, {level: 5, spells: ["Greater Restoration"]}],
      },
      {
        name: "Mark of Hospitality",
        description: "House Ghallanda's mark. Ghallanda's innkeepers hear everything worth knowing in a community — and they don't sell information, preferring to build friendship and deal in favors.",
        traits: ["Lucky - Reroll 1s on attack rolls, ability checks, and saving throws", "Brave - Advantage on saving throws against being frightened", "Halfling Nimbleness - You can move through the space of any creature that is of a size larger than yours", "Ever Hospitable - When you make a Charisma (Persuasion) check or an ability check involving brewer's supplies, you can roll a d4 and add the number rolled to the ability check", "Innkeeper's Magic - You know the Prestidigitation cantrip; you can also cast the Purify Food and Drink and Unseen Servant spells with this trait; once you cast either spell with this trait, you can't cast that spell with it again until you finish a long rest; Charisma is your spellcasting ability"],
        speeds: null,
        resolvedASI: {"dex": 2, "cha": 1},
        replaces: [],
        innateSpells: [{"name": "Prestidigitation", "level": 0, "uses": "at will"}, {"name": "Purify Food and Drink", "level": 1, "uses": "once per long rest"}, {"name": "Unseen Servant", "level": 1, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Goodberry", "Sleep"]}, {level: 2, spells: ["Aid", "Calm Emotions"]}, {level: 3, spells: ["Create Food and Water", "Leomund's Tiny Hut"]}, {level: 4, spells: ["Aura of Purity", "Mordenkainen's Private Sanctum"]}, {level: 5, spells: ["Hallow"]}],
      },
    ],
  },
  {
    id: "dwarf", name: "Dwarf", description: "", size: "", speeds: {}, languages: [],
    traits: [], abilityScoreIncrease: {}, source: "", origins: ["Eberron"], innateSpells: [],
    variants: [
      {
        name: "Mark of Warding",
        description: "House Kundarak's mark. Kundarak's bankers and goldsmiths secure the wealth of Khorvaire — and for clients who can afford it, a system of extradimensional vaults reachable from any enclave.",
        traits: ["Darkvision (60 ft)", "Dwarven Resilience - Advantage on saving throws against poison, resistance to poison damage", "Dwarven Combat Training - You have proficiency with battleaxes, handaxes, light hammers, and warhammers", "Tool Proficiency - Proficiency with one artisan's tool", "Stonecunning - Add double proficiency bonus on History checks for stonework", "Warder's Intuition - When you make an Intelligence (Investigation) check or an ability check using thieves' tools, you can roll a d4 and add the number rolled to the ability check", "Wards and Seals - You can cast the Alarm and Mage Armor spells with this trait; starting at 3rd level, you can also cast the Arcane Lock spell with it; once you cast any of these spells with this trait, you can't cast that spell with it again until you finish a long rest; Intelligence is your spellcasting ability"],
        grants: { tools: [{ choose: 1, from: "any_artisan_tool" }], weapons: ["Battleaxe", "Handaxe", "Light Hammer", "Warhammer"], senses: ["darkvision 60 ft"], resistances: ["poison"] },
        speeds: null,
        resolvedASI: {"con": 2, "int": 1},
        replaces: [],
        innateSpells: [{"name": "Alarm", "level": 1, "uses": "once per long rest"}, {"name": "Mage Armor", "level": 1, "uses": "once per long rest"}, {"name": "Arcane Lock", "level": 2, "atLevel": 3, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Alarm", "Armor of Agathys"]}, {level: 2, spells: ["Arcane Lock", "Knock"]}, {level: 3, spells: ["Glyph of Warding", "Magic Circle"]}, {level: 4, spells: ["Leomund's Secret Chest", "Mordenkainen's Faithful Hound"]}, {level: 5, spells: ["Antilife Shell"]}],
      },
    ],
  },
  {
    id: "gnome", name: "Gnome", description: "", size: "", speeds: {}, languages: [],
    traits: [], abilityScoreIncrease: {}, source: "", origins: ["Eberron"], innateSpells: [],
    variants: [
      {
        name: "Mark of Scribing",
        description: "House Sivis's mark. Sivis's scribes and message stations are the backbone of long-distance communication in Khorvaire, and the house holds a position of absolute neutrality in all disputes.",
        traits: ["Darkvision (60 ft)", "Gnome Cunning - Advantage on Intelligence, Wisdom, and Charisma saving throws against magic", "Gifted Scribe - When you make an Intelligence (History) check, you can roll a d4 and add the number rolled to the ability check", "Scribe's Insight - You know the Message cantrip; you can also cast Comprehend Languages once with this trait, regaining the ability when you finish a short or long rest; starting at 3rd level, you can cast the Magic Mouth spell with this trait, regaining the ability when you finish a long rest; Intelligence is your spellcasting ability"],
        grants: { senses: ["darkvision 60 ft"] },
        speeds: null,
        resolvedASI: {"int": 2, "cha": 1},
        replaces: [],
        innateSpells: [{"name": "Message", "level": 0, "uses": "at will"}, {"name": "Comprehend Languages", "level": 1, "uses": "once per short or long rest"}, {"name": "Magic Mouth", "level": 2, "atLevel": 3, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Comprehend Languages", "Illusory Script"]}, {level: 2, spells: ["Animal Messenger", "Silence"]}, {level: 3, spells: ["Sending", "Tongues"]}, {level: 4, spells: ["Arcane Eye", "Confusion"]}, {level: 5, spells: ["Dream"]}],
      },
    ],
  },
  {
    id: "elf", name: "Elf", description: "", size: "", speeds: {}, languages: [],
    traits: [], abilityScoreIncrease: {}, source: "", origins: ["Eberron"], innateSpells: [],
    variants: [
      {
        name: "Mark of Shadow",
        description: "House Phiarlan's (and Thuranni's) mark, borne by elves. Phiarlan sells entertainment and espionage in the lands west of the Mournland; after the Shadow Schism, Thuranni does the same in the east.",
        traits: ["Darkvision (60 ft)", "Keen Senses - Proficiency in Perception", "Fey Ancestry - Advantage on saves against being charmed, magic can't put you to sleep", "Trance - During a long rest, you meditate for 4 hours, rather than sleeping for 8 hours", "Cunning Intuition - When you make a Charisma (Performance) or Dexterity (Stealth) check, you can roll a d4 and add the number rolled to the ability check", "Shape Shadows - You know the Minor Illusion cantrip; starting at 3rd level, you can cast the Invisibility spell once with this trait, regaining the ability when you finish a long rest; Charisma is your spellcasting ability"],
        grants: { skills: ["perception"], senses: ["darkvision 60 ft"] },
        speeds: null,
        resolvedASI: {"dex": 2, "cha": 1},
        replaces: [],
        innateSpells: [{"name": "Minor Illusion", "level": 0, "uses": "at will"}, {"name": "Invisibility", "level": 2, "atLevel": 3, "uses": "once per long rest"}],
        markSpells: [{level: 1, spells: ["Disguise Self", "Silent Image"]}, {level: 2, spells: ["Darkness", "Pass without Trace"]}, {level: 3, spells: ["Clairvoyance", "Major Image"]}, {level: 4, spells: ["Greater Invisibility", "Hallucinatory Terrain"]}, {level: 5, spells: ["Mislead"]}],
      },
    ],
  },
];