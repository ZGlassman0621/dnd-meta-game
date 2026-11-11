export const DESCRIPTOR_BANKS = {
  "1": {
    "id": 1,
    "name": "Type",
    "dice": "d20",
    "kind": "ranges",
    "ranges": [
      {
        "range": "01–19",
        "value": "Adherent (see Table 2)"
      },
      {
        "range": "20",
        "value": "Class (see Table 6)"
      }
    ],
    "note": "01–19 Adherent (see Table 2); 20 Class (see Table 6)."
  },
  "2": {
    "id": 2,
    "name": "Adherent background",
    "dice": "d20",
    "kind": "ranges",
    "ranges": [
      {
        "range": "00–05",
        "value": "Agriculture"
      },
      {
        "range": "06–10",
        "value": "Fishing"
      },
      {
        "range": "11–15",
        "value": "Husbandry"
      },
      {
        "range": "16–18",
        "value": "Common profession (Table 3)"
      },
      {
        "range": "19",
        "value": "Rare profession (Table 4)"
      },
      {
        "range": "1",
        "value": "from the roll (source instruction)"
      }
    ],
    "note": "00–05 Agriculture; 06–10 Fishing; 11–15 Husbandry; 16–18 Common profession (Table 3); 19 Rare profession (Table 4); 20 Elite (Table 5). In a rural environment, subtract 1 from the roll (source instruction)."
  },
  "7": {
    "id": 7,
    "name": "Race",
    "dice": "d20",
    "kind": "ranges",
    "ranges": [
      {
        "range": "1–10",
        "value": "Human"
      },
      {
        "range": "11–12",
        "value": "Elf"
      },
      {
        "range": "13–14",
        "value": "Gnome"
      },
      {
        "range": "15–16",
        "value": "Halfling"
      },
      {
        "range": "17–18",
        "value": "Dwarf"
      },
      {
        "range": "19",
        "value": "Half-elf"
      },
      {
        "range": "20",
        "value": "Half-orc"
      }
    ],
    "note": "1–10 Human, 11–12 Elf, 13–14 Gnome, 15–16 Halfling, 17–18 Dwarf, 19 Half-elf, 20 Half-orc. Source note: in an elven kingdom, swap the elf/human ranges. This is a population-frequency table, not a 2024 race mechanic."
  },
  "8": {
    "id": 8,
    "name": "Sex",
    "dice": "d20",
    "kind": "ranges",
    "ranges": [
      {
        "range": "1–10",
        "value": "Male"
      },
      {
        "range": "11–20",
        "value": "Female"
      }
    ],
    "note": "1–10 Male, 11–20 Female. (Source field only; see header note.)"
  },
  "9": {
    "id": 9,
    "name": "Alignment",
    "dice": "d20",
    "kind": "ranges",
    "ranges": [
      {
        "range": "1",
        "value": "Chaotic Evil"
      },
      {
        "range": "2–3",
        "value": "Lawful Evil"
      },
      {
        "range": "4–6",
        "value": "Neutral Evil"
      },
      {
        "range": "7–14",
        "value": "Neutral"
      },
      {
        "range": "15–17",
        "value": "Neutral Good"
      },
      {
        "range": "18–19",
        "value": "Chaotic Good"
      },
      {
        "range": "20",
        "value": "Lawful Good"
      }
    ],
    "note": "1 Chaotic Evil, 2–3 Lawful Evil, 4–6 Neutral Evil, 7–14 Neutral, 15–17 Neutral Good, 18–19 Chaotic Good, 20 Lawful Good. Source note: extreme alignments are rare; adjust to milieu. 2024 alignment is descriptive, so this ports as a frequency guide only."
  },
  "3": {
    "id": 3,
    "name": "Adherent Common Profession",
    "dice": "d100 ÷ 2, round up",
    "kind": "list",
    "entries": [
      "Apothecary",
      "Armorer",
      "Barber",
      "Bargemen",
      "Blacksmith",
      "Beggar",
      "Bowyer",
      "Butcher",
      "Caravanner",
      "Carpenter",
      "Chandler",
      "Cobbler",
      "Cook",
      "Cordwainer",
      "Drover",
      "Falconer",
      "Fisherman",
      "Fletcher",
      "Farmer",
      "Grinder",
      "Girdler",
      "Goldsmith",
      "Grocer",
      "Groom of the Stool",
      "Herbalist",
      "Herdsman",
      "Hound Master",
      "Inn Keeper",
      "Jailer",
      "Jeweler",
      "Leatherworkers",
      "Locksmith",
      "Merchants",
      "Men-at-Arms",
      "Page",
      "Poleturner",
      "Pursemaker",
      "Reeve",
      "Rope Maker",
      "Sailor",
      "Shopkeeper",
      "Silversmith",
      "Stonemason",
      "Tailor",
      "Tavern Keeper",
      "Tanner",
      "Tax Collector",
      "Urchin",
      "Weaver",
      "Winemaker"
    ]
  },
  "4": {
    "id": 4,
    "name": "Adherent Rare Profession",
    "dice": "d20",
    "kind": "list",
    "entries": [
      "Bailiff",
      "Bishop",
      "Cardinal",
      "Librarian",
      "Reliquarian",
      "Priest",
      "Steward",
      "Guild Master",
      "Jester",
      "Steward",
      "Herald",
      "Sheriff",
      "Seneschal",
      "Notary",
      "Glazier",
      "Scrivener",
      "Hatter",
      "Chef",
      "Minor Ecclesiastic",
      "Minor Nobility"
    ]
  },
  "5": {
    "id": 5,
    "name": "Adherent Elite Profession",
    "dice": "d20",
    "kind": "list",
    "entries": [
      "Baron",
      "Crown Prince",
      "High Prince",
      "Count",
      "Viscount",
      "High Priest",
      "Cardinal",
      "Sage",
      "Archduke",
      "Duke",
      "Prince",
      "Marquis",
      "Earl",
      "Treasurer",
      "Chancellor",
      "Bishop",
      "Archbishop",
      "Prelate",
      "Sexton",
      "Elder"
    ]
  },
  "12": {
    "id": 12,
    "name": "Appearance, Build",
    "dice": "d20",
    "kind": "list",
    "entries": [
      "Lean",
      "Stocky",
      "Willowy",
      "Short",
      "Scrawny",
      "Tall",
      "Athletic",
      "Gaunt",
      "Pudgy",
      "Thin",
      "Slim",
      "Slender",
      "Frail",
      "Wiry",
      "Muscular",
      "Tone",
      "Broad",
      "Squat",
      "Buff",
      "Lanky"
    ]
  },
  "13": {
    "id": 13,
    "name": "Appearance, Complexion",
    "dice": "d20",
    "kind": "list",
    "entries": [
      "Ebony",
      "Bronze",
      "Tawny",
      "Olive",
      "Cinnamon",
      "Tan",
      "Coppery",
      "Sallow",
      "Pallid",
      "Golden",
      "Ivory",
      "Crimson",
      "Leathery",
      "Wrinkled",
      "Splotchy",
      "Wan",
      "Porcelain",
      "Florid",
      "Loose",
      "Pocked"
    ]
  },
  "14": {
    "id": 14,
    "name": "Appearance, Face",
    "dice": "d20",
    "kind": "list",
    "entries": [
      "Triangle",
      "Pear",
      "Oblong",
      "Heart",
      "Diamond",
      "Long",
      "Oval",
      "Round",
      "Square",
      "Heart",
      "Protruding",
      "Flat",
      "Bulette",
      "Pointed",
      "Sharp",
      "Angular",
      "Lumpy",
      "Wide",
      "Small",
      "Large"
    ]
  },
  "15": {
    "id": 15,
    "name": "Appearance, Hair",
    "dice": "d20",
    "kind": "list",
    "entries": [
      "Bald",
      "Bobbed",
      "Unkempt",
      "Long",
      "Braided",
      "Spiked",
      "Que",
      "Bangs",
      "Multibraided",
      "Pageboy",
      "Short",
      "Waist length",
      "Topknot",
      "Scalplock",
      "Piled",
      "Crew",
      "Mullet",
      "Tonsured",
      "Tousled",
      "Ponytail"
    ]
  },
  "17": {
    "id": 17,
    "name": "Appearance, Beard",
    "dice": "d10",
    "kind": "list",
    "entries": [
      "Full",
      "Long",
      "Muttonchops",
      "Spiked",
      "Braided",
      "Forked",
      "Handlebar",
      "Mustache",
      "Goatee",
      "Ringleted"
    ],
    "note": "Style only; presence of a beard is left to DM/culture/race."
  },
  "18": {
    "id": 18,
    "name": "Unique Feature #1",
    "dice": "d20",
    "kind": "list",
    "entries": [
      "Freckles",
      "Moles",
      "Green eyes",
      "Barrel-chested",
      "Bushy eyebrows",
      "Dimples",
      "Cleft chin",
      "Thin lips",
      "Small mouth",
      "Milky eyes",
      "Streaked hair",
      "Upturned nose",
      "White hair",
      "Gray eyes",
      "Bulbous nose",
      "Bloodshot eyes",
      "Red hair",
      "Large ears",
      "Sunken cheeks",
      "Multicolored eyes"
    ]
  },
  "19": {
    "id": 19,
    "name": "Unique Feature #2",
    "dice": "d20",
    "kind": "list",
    "entries": [
      "Receding hairline",
      "Bulging forehead",
      "Gap toothed",
      "Droopy eyes",
      "Cauliflower ears",
      "Arm tattoo",
      "Missing tooth",
      "Facial scar",
      "Filed teeth",
      "Straight teeth",
      "Thick eyebrows",
      "Piercings",
      "Long arms",
      "Scarred hands",
      "Sharp nose",
      "Hunchback",
      "Buck teeth",
      "Jutting chin",
      "Facial tattoo",
      "Silken hair"
    ]
  },
  "20": {
    "id": 20,
    "name": "Appearance, Demeanor and Style",
    "dice": "d20",
    "kind": "list",
    "entries": [
      "Dandy",
      "Ostentatious",
      "Refined",
      "Dowdy",
      "Rustic",
      "Fastidious",
      "Elegant",
      "Eclectic",
      "Functional",
      "Colorful",
      "Drab",
      "Manicured",
      "Stern",
      "Mischievous",
      "Conservative",
      "Liberal",
      "Worn",
      "Haughty",
      "Humble",
      "Wistful"
    ]
  },
  "21": {
    "id": 21,
    "name": "Colors",
    "dice": "d20",
    "kind": "list",
    "entries": [
      "Alabaster",
      "Ebony",
      "Mahogany",
      "Crimson",
      "Copper",
      "Ruby",
      "Primrose",
      "Olive",
      "Sorrel",
      "Malachite",
      "Sage",
      "White",
      "Salmon",
      "Amethyst",
      "Orange",
      "Gray",
      "Indigo",
      "Amber",
      "Ochre",
      "Damask"
    ]
  },
  "6": {
    "id": 6,
    "name": "Class",
    "dice": "percentile",
    "kind": "ranges",
    "ranges": [
      {
        "range": "1–2",
        "value": "Arcane Thief"
      },
      {
        "range": "3–6",
        "value": "Archer"
      },
      {
        "range": "7",
        "value": "Assassin"
      },
      {
        "range": "8–13",
        "value": "Barbarian"
      },
      {
        "range": "14–18",
        "value": "Bard"
      },
      {
        "range": "19–23",
        "value": "Cleric"
      },
      {
        "range": "24–25",
        "value": "Divine Knight"
      },
      {
        "range": "26–29",
        "value": "Druid"
      },
      {
        "range": "30–31",
        "value": "Foresworn"
      },
      {
        "range": "32–33",
        "value": "Ethereal Knight"
      },
      {
        "range": "34–40",
        "value": "Fighter"
      },
      {
        "range": "41–43",
        "value": "Illusionist"
      },
      {
        "range": "44–48",
        "value": "Knight"
      },
      {
        "range": "49–51",
        "value": "Magic User"
      },
      {
        "range": "52–56",
        "value": "Monk"
      },
      {
        "range": "57–59",
        "value": "Oathsworn"
      },
      {
        "range": "60–65",
        "value": "Pacer"
      },
      {
        "range": "66–67",
        "value": "Paladin"
      },
      {
        "range": "68–69",
        "value": "Primal Druid"
      },
      {
        "range": "70–73",
        "value": "Ranger"
      },
      {
        "range": "74–75",
        "value": "Rune Mark"
      },
      {
        "range": "76–81",
        "value": "Rogue"
      },
      {
        "range": "82–84",
        "value": "Seeker"
      },
      {
        "range": "85–88",
        "value": "Skald"
      },
      {
        "range": "89–93",
        "value": "Thief"
      },
      {
        "range": "94–97",
        "value": "Warrior Priest"
      }
    ],
    "note": "C&C-specific classes (Arcane Thief, Divine Knight, Ethereal Knight, Foresworn, Oathsworn, Pacer, Primal Druid, Rune Mark, Seeker, Skald) are concept labels only, not 2024 classes."
  },
  "10": {
    "id": 10,
    "name": "Personality Traits",
    "dice": "percentile ÷ 2, roll once per column",
    "kind": "columns",
    "columns": {
      "positive": [
        "Adaptable",
        "Alert",
        "Amiable",
        "Articulate",
        "Benevolent",
        "Capable",
        "Clever",
        "Compassionate",
        "Courteous",
        "Curious",
        "Decisive",
        "Dignified",
        "Disciplined",
        "Earnest",
        "Efficient",
        "Empathetic",
        "Farsighted",
        "Firm",
        "Focused",
        "Forthright",
        "Generous",
        "Gentle",
        "Gracious",
        "Honest",
        "Humorous",
        "Idealistic",
        "Incisive",
        "Insightful",
        "Intuitive",
        "Kind",
        "Logical",
        "Loyal",
        "Magnanimous",
        "Meticulous",
        "Modest",
        "Neat",
        "Optimistic",
        "Orderly",
        "Perceptive",
        "Principled",
        "Prudent",
        "Reflective",
        "Reverential",
        "Shrewd",
        "Sophisticated",
        "Stoic",
        "Studious",
        "Subtle",
        "Sympathetic",
        "Tolerant"
      ],
      "neutral": [
        "Aggressive",
        "Ambitious",
        "Amusing",
        "Authoritarian",
        "Boring",
        "Casual",
        "Cerebral",
        "Circumspect",
        "Competitive",
        "Conservative",
        "Deceptive",
        "Determined",
        "Distracted",
        "Driven",
        "Droll",
        "Emotional",
        "Enigmatic",
        "Experimental",
        "Formal",
        "Frugal",
        "Guileless",
        "Hurried",
        "Idiosyncratic",
        "Impassive",
        "Impersonal",
        "Innocuous",
        "Intense",
        "Equivocal",
        "Hesitant",
        "Outspoken",
        "Predictable",
        "Preoccupied",
        "Private",
        "Proud",
        "Quiet",
        "Religious",
        "Reserved",
        "Restrained",
        "Sarcastic",
        "Skeptical",
        "Solemn",
        "Solitary",
        "Stern",
        "Stubborn",
        "Unambitious",
        "Undemanding",
        "Uninhibited",
        "Unpredictable",
        "Whimsical"
      ],
      "negative": [
        "Arrogant",
        "Barbaric",
        "Blunt",
        "Brittle",
        "Brutal",
        "Calculating",
        "Callous",
        "Compulsive",
        "Cowardly",
        "Cruel",
        "Decadent",
        "Demanding",
        "Devious",
        "Disloyal",
        "Dissolute",
        "Envious",
        "Extravagant",
        "Extreme",
        "Fanatical",
        "Fatalistic",
        "Fearful",
        "Gloomy",
        "Grim",
        "Gullible",
        "Haughty",
        "Hedonistic",
        "Hostile",
        "Impulsive",
        "Irritable",
        "Libidinous",
        "Malicious",
        "Melancholic",
        "Moody",
        "Morbid",
        "Naive",
        "Narcissistic",
        "Opportunistic",
        "Paranoid",
        "Predatory",
        "Pugnacious",
        "Ritualistic",
        "Sadistic",
        "Scheming",
        "Sordid",
        "Timid",
        "Treacherous",
        "Unreliable",
        "Vacuous",
        "Vindictive",
        "Willful"
      ]
    }
  },
  "11": {
    "id": 11,
    "name": "Motivations",
    "dice": "d20 per column; combine columns 1+2 as a\ncurrent activity, column 3 as background",
    "kind": "columns",
    "columns": {
      "verb": [
        "Seeks",
        "Covets",
        "Investigates",
        "Hides",
        "Knows",
        "Suspects",
        "Guards",
        "Gambles",
        "Steals",
        "Hunts",
        "Explores",
        "Smuggles",
        "Spies",
        "Manipulates",
        "Offers",
        "Regrets",
        "Appeases",
        "Guides",
        "Rescues",
        "Contrives"
      ],
      "object": [
        "Gold",
        "Treasure",
        "Map",
        "Armor",
        "Weapon",
        "Message",
        "Secret",
        "Goods",
        "Relic",
        "Herbs",
        "Jewels",
        "Book",
        "Vault",
        "Tome",
        "Dungeon",
        "Temple",
        "Castle",
        "Tomb",
        "Chest",
        "Prison"
      ],
      "backstory": [
        "Assassination",
        "Kidnapping",
        "Atonement",
        "Indebted",
        "Revenge",
        "Affair",
        "Identified",
        "Retrieved",
        "Buried",
        "Quest",
        "Asylum",
        "Theft",
        "Summoned",
        "Failure",
        "Guilt",
        "Delivery",
        "Escape",
        "Accused",
        "Betrayed",
        "Explore"
      ]
    }
  },
  "16": {
    "id": 16,
    "name": "Hair Color / Eye Color",
    "dice": "d10 each",
    "kind": "columns",
    "columns": {
      "hair": [
        "Ebony",
        "Raven",
        "Golden",
        "Flaxen",
        "Titan",
        "Chestnut",
        "Dun",
        "Rusty",
        "Gray",
        "Brick"
      ],
      "eye": [
        "Lilac",
        "Ice",
        "Hazel",
        "Flecked",
        "Seafoam",
        "Midnight",
        "Violet",
        "Mint",
        "Azure",
        "Pale"
      ]
    }
  }
};
