export const NAME_TABLES = {
  "dwarf": {
    "culture": "Dwarf",
    "flavour": "Hard sounds, 1-2 syllables (rarely 3), no male/female split. Norse-flavoured generic fantasy.",
    "tables": [
      {
        "name": "Single Element Names",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Adzo",
          "Alfrikr",
          "Anarr",
          "Bafurr",
          "Dagfinnr",
          "Eitri",
          "Fafnir",
          "Grimr",
          "Kili",
          "Torin",
          "Buri",
          "Etrund",
          "Grimwald",
          "Knutkin",
          "Munin",
          "Otr",
          "Rekkr",
          "Sigotheud",
          "Yngvi"
        ],
        "construction": "Pick one whole name; optionally add parentage, clan, or epitaph."
      },
      {
        "name": "Syllable List I",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Al",
          "Am",
          "Dag",
          "Faf",
          "Grim",
          "Karl",
          "Kili",
          "Nar",
          "Sig",
          "Wulf"
        ],
        "construction": "Combine Syllable I + Syllable II."
      },
      {
        "name": "Syllable List II (Second Syllable)",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Adal",
          "Bald",
          "Grim",
          "Helm",
          "Jarl",
          "Mund",
          "Rik",
          "Sig",
          "Wald",
          "Wulf"
        ],
        "construction": "Combine Syllable I + Syllable II."
      },
      {
        "name": "Nicknames and Epitaphs",
        "shape": "adjective + noun",
        "combinations": null,
        "coverage": "full",
        "adjectives": {
          "colors": [
            "Black",
            "Gray",
            "White",
            "Red",
            "Yellow",
            "Green",
            "Brown",
            "Hoar",
            "Gold",
            "Silver"
          ],
          "shapes": [
            "Square",
            "Fork",
            "Round",
            "Long",
            "Short",
            "Small",
            "Tall",
            "Fat",
            "Big",
            "Thin"
          ],
          "mood": [
            "Grim",
            "Bright",
            "Happy",
            "Sad",
            "Glum",
            "Mad",
            "Calm",
            "Angry",
            "Haughty",
            "Witty"
          ],
          "qualities": [
            "Strong",
            "Weak",
            "Good",
            "Keen",
            "Wild",
            "Stark",
            "True",
            "Strong",
            "Wise",
            "Bold"
          ]
        },
        "nouns": {
          "weapons": [
            "Axe",
            "Sword",
            "Spear",
            "Stave",
            "Club",
            "Mace",
            "Bow",
            "Hammer",
            "Flail",
            "Knife"
          ],
          "armor_fortification": [
            "Shield",
            "Helm",
            "Mail",
            "Plate",
            "Targe",
            "Wall",
            "Tower",
            "Moat",
            "Baily",
            "Gauntlet"
          ],
          "body_parts": [
            "Beard",
            "Head",
            "Nose",
            "Foot",
            "Arm",
            "Skull",
            "Fist",
            "Hand",
            "Eye",
            "Leg"
          ],
          "attributes": [
            "Blunt",
            "Eager",
            "Kind",
            "Cruel",
            "Mean",
            "Generous",
            "Clever",
            "Faithful",
            "Courageous",
            "Lucky"
          ],
          "animals": [
            "Crow",
            "Eagle",
            "Hart",
            "Drake",
            "Dragon",
            "Griffon",
            "Boar",
            "Bull",
            "Hind",
            "Hawk"
          ],
          "various": [
            "Storm",
            "Ballard",
            "Auld",
            "Barret",
            "Stout",
            "Stern",
            "Young",
            "Blythe",
            "Hopgood",
            "Culver"
          ]
        },
        "construction": "Pick one adjective and one noun, e.g. Ernmar Ironshield. Note: 'Strong' appears twice in the source Qualities list and is kept as-is."
      }
    ]
  },
  "elf": {
    "culture": "Elf",
    "flavour": "Soft syllables, no family names, male/female split.",
    "tables": [
      {
        "name": "Male Personal Names",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Aerlith",
          "Aemir",
          "Arathir",
          "Baelthaduin",
          "Celbriar",
          "Dathalian",
          "Emerilas",
          "Galdior",
          "Illefenlial",
          "Keradriol",
          "Mithandil",
          "Nimloth",
          "Saerion",
          "Thrandril",
          "Uderyce",
          "Yanediron"
        ]
      },
      {
        "name": "Female Personal Names",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Aelamleth",
          "Amalinda",
          "Ardirial",
          "Celarial",
          "Eldminwe",
          "Finwe",
          "Galireol",
          "Hanwen",
          "Kalarial",
          "Lindaswin",
          "Mithrios",
          "Nimrion",
          "Oribelion",
          "Silreil",
          "Tharvaluin",
          "Wunifar"
        ]
      }
    ]
  },
  "gnome": {
    "culture": "Gnome",
    "flavour": "'Wooden' sound, soft + hard mix, male/female split, no family names.",
    "tables": [
      {
        "name": "Male Personal Names",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Aelfhir",
          "Cadrach",
          "Darviad",
          "Egrick",
          "Geriant",
          "Harthul",
          "Istavar",
          "Lorcain",
          "Oisian",
          "Rendapir",
          "Tallashird",
          "Verngoge",
          "Yvar"
        ]
      },
      {
        "name": "Female Personal Names",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Agatheniad",
          "Bannagthe",
          "Ciar",
          "Delwin",
          "Ethelia",
          "Gwefr",
          "Jambdid",
          "Lathir",
          "Naflar",
          "Pamella",
          "Setach",
          "Ufra",
          "Yseult"
        ]
      },
      {
        "name": "Epitaph",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only (sort notes first ~80 legible; do not treat the sample below as the full grid)",
        "examples": [
          "Able",
          "Ark",
          "Axe",
          "Bale",
          "Black",
          "Boar",
          "Bold",
          "Break",
          "Brewer",
          "Bright",
          "Bull",
          "Butcher",
          "Cliff",
          "Crow",
          "Crown",
          "Dark",
          "Deft",
          "Durand",
          "Eagle",
          "Edge",
          "Fair",
          "Faithful",
          "Farsighted",
          "Ferret",
          "Finch",
          "Fish",
          "Fleet",
          "Fletcher",
          "Fox",
          "Free",
          "Giant",
          "Good",
          "Goose",
          "Gray",
          "Hammer",
          "Hawk",
          "Heart",
          "Hearth",
          "Hind",
          "Hood",
          "Hound",
          "Island",
          "Jaybird",
          "Jewel",
          "Jolly",
          "Keen",
          "Knife",
          "Leaf",
          "Lark",
          "Maul",
          "Moon",
          "Nail",
          "Needle",
          "Nightingale",
          "Night",
          "Noble",
          "Oak",
          "Old",
          "Otter",
          "Piper",
          "Plough",
          "Pratt",
          "Queen",
          "Ram",
          "Reeve",
          "Ring",
          "Rock",
          "Rune",
          "Savage",
          "Shadow",
          "Shield",
          "Sleek",
          "Small",
          "Sparrow",
          "Spear"
        ],
        "construction": "Male preceded by 'de', female by 'di'. Epitaphs attach to a trait, ability, or accomplishment, not at random."
      }
    ]
  },
  "halfling": {
    "culture": "Halfling",
    "flavour": "Soft, homely, vowels flow; older names end in vowels.",
    "tables": [
      {
        "name": "Male Personal Names",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only (male grid split across a page break in extraction)",
        "examples": [
          "William",
          "Yanol"
        ]
      },
      {
        "name": "Female Personal Names",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Adalad",
          "Aethna",
          "Clarice",
          "Diedrie",
          "Goldwyn",
          "Laura",
          "Nina",
          "Primula",
          "Rose",
          "Ursula",
          "Wanda",
          "Yolina"
        ]
      },
      {
        "name": "Family Names",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Allenby",
          "Amblin",
          "Boffin",
          "Bolger",
          "Burrow",
          "Cotton",
          "Diggle",
          "Edgewater",
          "Fallfoot",
          "Gardner",
          "Goodtub",
          "Hamfist",
          "Highhill",
          "Hornblower",
          "Hubrubru",
          "Ingles",
          "Ironpan",
          "Jillfish",
          "Jollygoat",
          "Jollywood",
          "Kettle",
          "Knotsnag",
          "Langley",
          "Lindenbrook",
          "Littletoes",
          "Longfoot",
          "Longshank",
          "Margo",
          "Margold",
          "Nagscatter",
          "Nimblewind",
          "Northhill",
          "Oldfur",
          "Oldhearth",
          "Plums",
          "Proudfeet",
          "Quickfoot",
          "Rainwell",
          "Ramble",
          "Riverbottom",
          "Rumbles",
          "Scatterleaf",
          "Shortwick",
          "Springale"
        ]
      },
      {
        "name": "First Element (Male)",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Ada",
          "Agg",
          "Ama",
          "Bada",
          "Can",
          "Duf",
          "Ful",
          "Ia",
          "Ki",
          "Mon",
          "Os",
          "Sa",
          "Um"
        ],
        "construction": "Combine first + second element."
      },
      {
        "name": "First Element (Female)",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Ada",
          "Agg",
          "Ama",
          "Ana",
          "Bada",
          "Bina",
          "Bir",
          "Cam",
          "Cul",
          "Du",
          "Es",
          "Ful",
          "Gil",
          "Ha",
          "Ia",
          "Ji",
          "Ka",
          "Ki",
          "Lavi",
          "Ma",
          "Nana",
          "Ol",
          "Pa",
          "Ri",
          "Sa",
          "Tal",
          "Ul",
          "Va",
          "Wen"
        ],
        "construction": "Combine first + second element."
      },
      {
        "name": "Second Element",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Ald",
          "Am",
          "An",
          "Ba",
          "Co",
          "Den",
          "El",
          "Fa",
          "Ga",
          "Ha",
          "Il",
          "Ing"
        ],
        "construction": "Combine first + second element."
      }
    ]
  },
  "hobgoblin": {
    "culture": "Hobgoblin",
    "flavour": "Rank-based, 1-5 elements, small word pool, names repeat. Monstrous NPC naming only; rank is a naming convention, not a 2024 mechanic.",
    "tables": [
      {
        "name": "Rank I (body parts/role)",
        "shape": "d8/d5",
        "combinations": 40,
        "coverage": "partial: 32 name+meaning pairs present in the sort file text; do NOT invent the remaining 8",
        "entries": [
          {
            "name": "Aksi",
            "meaning": "foot"
          },
          {
            "name": "Asnak",
            "meaning": "leg"
          },
          {
            "name": "Bog",
            "meaning": "foot soldier"
          },
          {
            "name": "Bogdan",
            "meaning": "sacrificial foot soldier"
          },
          {
            "name": "Boj",
            "meaning": "warrior"
          },
          {
            "name": "Chakram",
            "meaning": "muscle"
          },
          {
            "name": "Dalibar",
            "meaning": "fighter"
          },
          {
            "name": "Dobrom",
            "meaning": "killer"
          },
          {
            "name": "Ergemik",
            "meaning": "pirate"
          },
          {
            "name": "Falgorad",
            "meaning": "shoulder"
          },
          {
            "name": "Gumir",
            "meaning": "arm"
          },
          {
            "name": "Guslag",
            "meaning": "head"
          },
          {
            "name": "Lugyal",
            "meaning": "thigh"
          },
          {
            "name": "Margol",
            "meaning": "forearm"
          },
          {
            "name": "Midrag",
            "meaning": "messenger"
          },
          {
            "name": "Nirgal",
            "meaning": "troop"
          },
          {
            "name": "Offalk",
            "meaning": "stabber"
          },
          {
            "name": "Ovrakir",
            "meaning": "neck"
          },
          {
            "name": "Ragmir",
            "meaning": "throat slitter"
          },
          {
            "name": "Ridikir",
            "meaning": "heart"
          },
          {
            "name": "Savastirga",
            "meaning": "scout"
          },
          {
            "name": "Severingurj",
            "meaning": "heart"
          },
          {
            "name": "Slaven",
            "meaning": "knee"
          },
          {
            "name": "Tagar",
            "meaning": "skin"
          },
          {
            "name": "Tokalag",
            "meaning": "spearman"
          },
          {
            "name": "Tukrmak",
            "meaning": "lancer"
          },
          {
            "name": "Uvamlirk",
            "meaning": "stomach"
          },
          {
            "name": "Zdirk",
            "meaning": "bones"
          },
          {
            "name": "Zcazar",
            "meaning": "back"
          },
          {
            "name": "Zciko",
            "meaning": "flesh"
          },
          {
            "name": "Zju",
            "meaning": "poison"
          },
          {
            "name": "Zcukar",
            "meaning": "calf"
          }
        ]
      },
      {
        "name": "Rank II (colors/weapons/armor)",
        "shape": "d6/d5",
        "combinations": 30,
        "coverage": "partial: 29 name+meaning pairs present in the sort file text; do NOT invent the remaining 1",
        "entries": [
          {
            "name": "Bile",
            "meaning": "white"
          },
          {
            "name": "Drag",
            "meaning": "sword"
          },
          {
            "name": "Deklas",
            "meaning": "battle axe"
          },
          {
            "name": "Egavk",
            "meaning": "red"
          },
          {
            "name": "Godj",
            "meaning": "club"
          },
          {
            "name": "Ijkkark",
            "meaning": "black"
          },
          {
            "name": "Kestkarzj",
            "meaning": "breastplate"
          },
          {
            "name": "Kivet",
            "meaning": "shield"
          },
          {
            "name": "Krivar",
            "meaning": "yellow"
          },
          {
            "name": "Kojko",
            "meaning": "warhammer"
          },
          {
            "name": "Kresimar",
            "meaning": "bow"
          },
          {
            "name": "Lyabk",
            "meaning": "gorget"
          },
          {
            "name": "Lyubark",
            "meaning": "helm"
          },
          {
            "name": "Mishelgled",
            "meaning": "flail"
          },
          {
            "name": "Mugdarem",
            "meaning": "spear"
          },
          {
            "name": "Nafgurhik",
            "meaning": "green"
          },
          {
            "name": "Nuglu",
            "meaning": "dagger"
          },
          {
            "name": "Pitkilig",
            "meaning": "chainmail"
          },
          {
            "name": "Rudgeak",
            "meaning": "heart"
          },
          {
            "name": "Uvajkin",
            "meaning": "blue"
          },
          {
            "name": "Vijektig",
            "meaning": "arrow"
          },
          {
            "name": "Voolgar",
            "meaning": "gray"
          },
          {
            "name": "Volge",
            "meaning": "mace"
          },
          {
            "name": "Vumirkam",
            "meaning": "haberd"
          },
          {
            "name": "Vulgad",
            "meaning": "green"
          },
          {
            "name": "Vegarem",
            "meaning": "javelin"
          },
          {
            "name": "Yam",
            "meaning": "bow"
          },
          {
            "name": "Yrvar",
            "meaning": "longword"
          },
          {
            "name": "Zcuvirk",
            "meaning": "spike"
          }
        ]
      },
      {
        "name": "Rank III (achievement)",
        "shape": "d5/d5",
        "combinations": 25,
        "coverage": "examples-only (grid continues past the sort's extraction cut)",
        "examples": [
          "Auglark (burner of forests)",
          "Bojkar (winner of battles)",
          "Damk (taker of fortress)",
          "Giirgjk (sacker of cities)",
          "Glarugar (the breaker of bones)",
          "Igfirka (the immolator)"
        ]
      },
      {
        "name": "Rank IV/V",
        "shape": null,
        "combinations": null,
        "coverage": "not included: referenced in the introduction but tables not legibly present in the sort; do not invent them",
        "entries": []
      }
    ]
  },
  "human": {
    "culture": "Human",
    "flavour": "Culture-specific medieval English/Norman flavour, male/female split. Use for human cultures with that sound, not as a universal FR human pool.",
    "tables": [
      {
        "name": "Male Personal Names",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Adric",
          "Alard",
          "Alfric",
          "Arnulf",
          "Baldwyn",
          "Clement",
          "Cuthbert",
          "Desmond",
          "Edwin",
          "Elias",
          "Godfrey",
          "Godwin",
          "Hamon",
          "Hereward",
          "Jordan",
          "Julius",
          "Lance",
          "Maurice",
          "Miles",
          "Nigel",
          "Osbert",
          "Percival",
          "Piers",
          "Robert",
          "Roland",
          "Savaric",
          "Swain",
          "Thursten",
          "Ulrich",
          "Vaughn",
          "Waleran",
          "Wymarc",
          "Zachery"
        ],
        "note": "Source grid duplicates Jordan, Osbert, and Piers (twice each)."
      },
      {
        "name": "Female Personal Names",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Abigail",
          "Agatha",
          "Aldreda",
          "Beatrix",
          "Castanea",
          "Clarice",
          "Eleanor",
          "Francesca",
          "Galiana",
          "Hannah",
          "Isabel",
          "Juliana",
          "Kathryn",
          "Laurencia",
          "Meliora",
          "Nadia",
          "Olive",
          "Portia",
          "Rowena",
          "Sabine",
          "Sybil",
          "Tessa",
          "Ursula",
          "Valerie",
          "Veronica",
          "Yolanda",
          "Zelda",
          "Zoe"
        ]
      },
      {
        "name": "Family Names",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Abington",
          "Akers",
          "Bardell",
          "Caldwell",
          "Clemend",
          "Cunningham",
          "Dobell",
          "Edan",
          "Falks",
          "Grayson",
          "Grieve",
          "Hart",
          "Hollier",
          "Inglefield",
          "Ironmonger",
          "Jakes",
          "Kennard",
          "Kirby",
          "Lettson",
          "Lockheart",
          "Makins",
          "Monger",
          "Murray",
          "Nuttal",
          "Osgood",
          "Overton",
          "Oxley",
          "Paget"
        ],
        "construction": "In-world identifiers: place ('Tim from Oxley'), job ('Robert the Cooper'), or parentage ('Brin daughter of Godwin'), which later harden into family names."
      }
    ]
  },
  "goblin": {
    "culture": "Goblin",
    "flavour": "Two elements, no male/female split, referred to by second element.",
    "tables": [
      {
        "name": "First Element (clan name)",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Azjov",
          "Amilkirz",
          "Ashkib",
          "Baklad",
          "Chaznach",
          "Dlugozj",
          "Feklar",
          "Grignir",
          "Ikl",
          "Jiknird",
          "Kondrag",
          "Merklovar",
          "Naklirik",
          "Pagaliar",
          "Rakhliazj",
          "Seekarik",
          "Tarjikim",
          "Truvkaik",
          "Vistargikin",
          "Zakhark",
          "Zildarm"
        ]
      },
      {
        "name": "Second Element (use name)",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Agatim",
          "Azaturk",
          "Balathazar",
          "Dakavigad",
          "Fati",
          "Galar",
          "Huslog",
          "Karaparg",
          "Lezcek",
          "Nargl",
          "Parjuck",
          "Sagat",
          "Slag",
          "Tugrak",
          "Uaglar",
          "Varje"
        ],
        "construction": "First + second, each 1-3 syllables; elements can be recombined to start a new line."
      }
    ]
  },
  "orc": {
    "culture": "Orc",
    "flavour": "1-3 elements, no male/female split.",
    "tables": [
      {
        "name": "First Element",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Aag",
          "Aakt",
          "Alg",
          "Az",
          "Bal",
          "Bog",
          "Brak",
          "Chik",
          "Dak",
          "Erg",
          "Fek",
          "Gad",
          "Gul",
          "Haag",
          "Kazc",
          "Lug",
          "Mag",
          "Nag",
          "Olab",
          "Pit",
          "Rak",
          "Rod",
          "Sark",
          "Ulk",
          "Vad",
          "Warg",
          "Xak",
          "Zar",
          "Zsolt",
          "Zurk"
        ]
      },
      {
        "name": "Second Element",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "examples-only",
        "examples": [
          "Ag",
          "Agog",
          "Aknag",
          "Balazc",
          "Boldirz",
          "Czaka",
          "Draga",
          "Ezebet",
          "Forg",
          "Gul",
          "Heged",
          "Jagd",
          "Kerek",
          "Lusk",
          "Magdol",
          "Og",
          "Okar",
          "Reka",
          "Saralt",
          "Tirka",
          "Wegzel",
          "Yuokko",
          "Xigrasz"
        ]
      },
      {
        "name": "Third Element (affiliative identifier) — Adjectives",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "full",
        "entries": [
          "Aching",
          "Angry",
          "Atrocious",
          "Avenging",
          "Bent",
          "Blac",
          "Bleary",
          "Bloody",
          "Bone",
          "Cold",
          "Crave",
          "Cruel",
          "Cursed",
          "Deadly",
          "Defiant",
          "Desolate",
          "Devious",
          "Dire",
          "Dismal",
          "Doomed",
          "Dreary",
          "Eternal",
          "Evil",
          "Fatal",
          "Fearful",
          "ferocious",
          "Filthy",
          "Fierce",
          "Furious",
          "Giant",
          "Gleaming",
          "Grievous",
          "Grim",
          "Grinding",
          "Hard",
          "Harsh",
          "Horned",
          "Horrible",
          "Imperial",
          "Inglorious",
          "Infernal",
          "Iron",
          "Jagged",
          "Knobby",
          "Last",
          "Mad",
          "Maddening",
          "Magnificent",
          "Majestic",
          "Malignant",
          "Mangy",
          "Muddy",
          "Noisy",
          "Obedient",
          "Obscene",
          "Oppressive",
          "Parched",
          "Piercing",
          "Proud",
          "Profane",
          "Putrid",
          "Quick",
          "Quiet",
          "Rabid",
          "Raging",
          "Rancid",
          "Raw",
          "Red",
          "Rekt",
          "Ruined",
          "Ruthless",
          "Seething",
          "Shaggy",
          "Spoiled",
          "Stale",
          "Steel",
          "Swift",
          "Tarnished",
          "Tattered",
          "Terrible",
          "Thankless",
          "Thirsty",
          "Tireless",
          "Troubling",
          "Ugly",
          "Unbeaten",
          "Unending",
          "Unyielding",
          "Venal",
          "Vicious",
          "Vile",
          "Vengefu",
          "Voracious",
          "Vulgar",
          "Wailing",
          "Weary",
          "White",
          "Wretched",
          "Yellow",
          "Zealous."
        ],
        "construction": "Adjective + noun, used only when affiliation matters. Source typos kept: 'Blac' for Black, 'Vengefu', 'ferocious' lowercased."
      },
      {
        "name": "Third Element (affiliative identifier) — Nouns",
        "shape": "d10/d10",
        "combinations": 100,
        "coverage": "full",
        "entries": [
          "Anvil",
          "Arm",
          "Army",
          "Ash",
          "Axe",
          "Ball",
          "Band",
          "Banner",
          "Bear",
          "Beast",
          "Blade",
          "Blood",
          "Bone",
          "Boot",
          "Breath",
          "Buccaneer",
          "Castle",
          "Cave",
          "Chain",
          "Claw",
          "Club",
          "Cohort",
          "Collar",
          "Crow",
          "Dagger",
          "Devil",
          "Dog",
          "Doom",
          "Dragon",
          "Edge",
          "Fang",
          "Fire",
          "Fist",
          "Flag",
          "Flame",
          "Flood",
          "Foot",
          "Forge",
          "Fork",
          "Fort",
          "Knob",
          "Grave",
          "Hammer",
          "Heart",
          "Helm",
          "Horde",
          "Horn",
          "Hound",
          "Hou",
          "Hyena",
          "Ice",
          "Knife",
          "Leg",
          "Legion",
          "Lightening",
          "Limb",
          "Mace",
          "Mark",
          "Moat",
          "Mountain",
          "Mouth",
          "Noise",
          "Noose",
          "Orc",
          "Order",
          "Pole",
          "Ravager",
          "Raven",
          "Reaver",
          "Reaper",
          "River",
          "Road",
          "Rock",
          "Servant",
          "Shield",
          "Skull",
          "Smoke",
          "Spear",
          "Spike",
          "Spine",
          "Steel",
          "Stone",
          "Storm",
          "Sword",
          "Tail",
          "Teeth",
          "Throat",
          "Thunder",
          "Tide",
          "Tooth",
          "Tribe",
          "Troll",
          "Troop",
          "Wall",
          "Wave",
          "Whip",
          "Wing",
          "Wolf",
          "Worg",
          "Urk."
        ],
        "construction": "Adjective + noun. Source typos kept: 'Hou', 'Lightening' for Lightning."
      }
    ]
  },
  "halfOrc": {
    "culture": "Half-Orc",
    "flavour": "No table in the source.",
    "tables": [
      {
        "name": "None",
        "shape": null,
        "combinations": null,
        "coverage": "not included: one paragraph only, two-element convention mixed by upbringing. Use the human + orc tables and mix by upbringing; do not build a half-orc table from this.",
        "entries": []
      }
    ]
  },
  "ungern": {
    "culture": "Ungern",
    "flavour": "EXCLUDED — Aihrde-specific creature whose identity is its legion. Do NOT import Ungern, their legions, or the 'Falk' prefix as FR content. Listed only so the exclusion is visible.",
    "tables": [
      {
        "name": "Excluded",
        "shape": null,
        "combinations": null,
        "coverage": "excluded",
        "entries": [],
        "note": "Salvageable generic idea only: legion-first identity for a monstrous soldier culture, with a new FR-appropriate name and legion system, not these words."
      }
    ]
  }
};

