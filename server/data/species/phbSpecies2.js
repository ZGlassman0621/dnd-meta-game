// server/data/species/phbSpecies2.js — species registry book file (2026-11-04).
//
// One entry per species, full mechanics, ASI as-written from the 2014 book
// and flagged legacy (asiLegacy) — NO 2024 conversion in this build, per
// the Races design. Variant trait lists are FULL lists (base traits
// repeated plus variant extras, as the legacy client list stored them);
// `replaces[]` names the base traits a variant supersedes so readers
// never double-count. `resolvedASI` is the TOTAL static bonus for that
// species+variant — runtime never sums base + variant (that sum is the
// old double-count bug: dragonborn +4/+2, half-elf Cha doubled).
// `choice: N` in an ASI means N x +1 the player picks (Stage 4's job).
// Gnome is authored fresh on the 2014 PHB baseline (the legacy list
// omitted it) — confirm wording against Zach's physical handbook at
// the gate, like the Batch 4 subclass numbers. Later book files merge
// by species id (variants + origins union); they never edit this file.
export const PHBSPECIES2 = [
  {
    id: "half-elf",
    name: "Half-Elf",
    description: "Children of two worlds — human and elf — belonging fully to neither. Half-elves stand on a bridge between short-lived ambition and long-lived grace, often restless wanderers and natural diplomats. Most were raised in one parent's culture and carry a quiet curiosity about the other.",
    size: "Medium",
    speeds: { walk: 30 },
    languages: ["Common", "Elvish", "One extra language of your choice"],
    traits: ["Darkvision (60 ft)", "Fey Ancestry - Advantage on saves against being charmed, magic can't put you to sleep", "Skill Versatility - Proficiency in two skills of your choice"],
    grants: { skills: [{ choose: 2, from: "any_skill" }], senses: ["darkvision 60 ft"] },
    abilityScoreIncrease: {"cha": 2, "choice": 2},
    asiLegacy: true,
    source: "Player's Handbook (2014)",
    origins: ["Forgotten Realms"],
    innateSpells: [],
    variants: [
      {
        name: "Standard Half-Elf",
        description: "Versatile and charismatic, blending human adaptability with elven grace. Skilled diplomats and jacks-of-all-trades.",
        traits: ["Darkvision (60 ft)", "Fey Ancestry - Advantage on saves against being charmed, magic can't put you to sleep", "Skill Versatility - Proficiency in two skills of your choice"],
        grants: { skills: [{ choose: 2, from: "any_skill" }], senses: ["darkvision 60 ft"] },
        speeds: null,
        resolvedASI: {"cha": 2, "choice": 2},
        replaces: [],
        innateSpells: [],
      },
      {
        name: "High Elf Descent",
        description: "Inherited the magical aptitude of high elf ancestry. Often scholars or arcanists bridging two worlds.",
        traits: ["Darkvision (60 ft)", "Fey Ancestry - Advantage on saves against being charmed, magic can't put you to sleep", "Elf Weapon Training - Proficiency with longsword, shortsword, shortbow, longbow", "Cantrip - Know one cantrip from wizard spell list"],
        grants: { weapons: ["Longsword", "Shortsword", "Shortbow", "Longbow"], senses: ["darkvision 60 ft"] },
        speeds: null,
        resolvedASI: {"cha": 2, "int": 1},
        replaces: ["Skill Versatility - Proficiency in two skills of your choice"],
        innateSpells: [],
      },
      {
        name: "Wood Elf Descent",
        description: "Inherited the swiftness and woodland affinity of wood elf ancestry. Natural rangers and scouts.",
        traits: ["Darkvision (60 ft)", "Fey Ancestry - Advantage on saves against being charmed, magic can't put you to sleep", "Elf Weapon Training - Proficiency with longsword, shortsword, shortbow, longbow", "Fleet of Foot - Base walking speed increases to 35 feet", "Mask of the Wild - Can attempt to hide in light foliage, heavy rain, falling snow, mist"],
        grants: { weapons: ["Longsword", "Shortsword", "Shortbow", "Longbow"], senses: ["darkvision 60 ft"] },
        speeds: {"walk": 35},
        resolvedASI: {"cha": 2, "wis": 1},
        replaces: ["Skill Versatility - Proficiency in two skills of your choice"],
        innateSpells: [],
      },
      {
        name: "Drow Descent",
        description: "Inherited the dark magic of drow ancestry. Often outcasts from both societies, walking between shadow and light.",
        traits: ["Darkvision (60 ft)", "Fey Ancestry - Advantage on saves against being charmed, magic can't put you to sleep", "Drow Magic - Know Dancing Lights cantrip"],
        grants: { senses: ["darkvision 60 ft"] },
        speeds: null,
        resolvedASI: {"cha": 2, "dex": 1},
        replaces: ["Skill Versatility - Proficiency in two skills of your choice"],
        innateSpells: [{"name": "Dancing Lights", "level": 0, "uses": "at will"}],
      },
    ],
  },
  {
    id: "half-orc",
    name: "Half-Orc",
    description: "Strong, fierce, and often caught between cultures. Half-orcs carry obvious orcish features — heavy jaw, prominent tusks, greyish or green-tinged skin — and draw stares from both human and orc kin. They feel emotion powerfully: rage, joy, and grief all run close to the surface.",
    size: "Medium",
    speeds: { walk: 30 },
    languages: ["Common", "Orc"],
    traits: ["Darkvision (60 ft)", "Menacing - Proficiency in Intimidation skill", "Relentless Endurance - Drop to 1 HP instead of 0 once per long rest", "Savage Attacks - Roll one extra weapon damage die on critical hits"],
    grants: { skills: ["intimidation"], senses: ["darkvision 60 ft"] },
    abilityScoreIncrease: {"str": 2, "con": 1},
    asiLegacy: true,
    source: "Player's Handbook (2014)",
    origins: ["Forgotten Realms"],
    innateSpells: [],
    variants: [
    ],
  },
  {
    id: "halfling",
    name: "Halfling",
    description: "Small, hardy folk who value home, hearth, and good food above glory. Halflings stand three to four feet tall, move quietly, and take unusual pleasure in the simple things — a warm fire, a full pantry, an evening of song. They endure hardship with a cheerfulness that surprises taller races.",
    size: "Small",
    speeds: { walk: 25 },
    languages: ["Common", "Halfling"],
    traits: ["Lucky - Reroll 1s on attack rolls, ability checks, and saving throws", "Brave - Advantage on saving throws against being frightened", "Halfling Nimbleness - You can move through the space of any creature that is of a size larger than yours"],
    abilityScoreIncrease: {"dex": 2},
    asiLegacy: true,
    source: "Player's Handbook (2014)",
    origins: ["Forgotten Realms"],
    innateSpells: [],
    variants: [
      {
        name: "Lightfoot Halfling",
        description: "Social and stealthy, blending into crowds with ease. Natural rogues and diplomats who slip through unnoticed.",
        traits: ["Lucky - Reroll 1s on attack rolls, ability checks, and saving throws", "Brave - Advantage on saving throws against being frightened", "Halfling Nimbleness - You can move through the space of any creature that is of a size larger than yours", "Naturally Stealthy - Can hide when obscured by a creature one size larger"],
        speeds: null,
        resolvedASI: {"dex": 2, "cha": 1},
        replaces: [],
        innateSpells: [],
      },
      {
        name: "Stout Halfling",
        description: "Hardy and resilient, rumored to have dwarven blood. Tough and dependable companions who endure hardship.",
        traits: ["Lucky - Reroll 1s on attack rolls, ability checks, and saving throws", "Brave - Advantage on saving throws against being frightened", "Halfling Nimbleness - You can move through the space of any creature that is of a size larger than yours", "Stout Resilience - Advantage on saving throws against poison, resistance to poison damage"],
        grants: { resistances: ["poison"] },
        speeds: null,
        resolvedASI: {"dex": 2, "con": 1},
        replaces: [],
        innateSpells: [],
      },
    ],
  },
  {
    id: "human",
    name: "Human",
    description: "The most numerous and widespread of the civilized peoples. Humans lack the long memory of elves or the clannish roots of dwarves, but they compensate with ambition, adaptability, and sheer range — from merchant princes to tundra herders, humans live in nearly every climate and culture.",
    size: "Medium",
    // 2024 size choice (PHB p. 194, Zach's photo 2026-11-06): Medium
    // (about 4–7 feet tall) or Small (about 2–4 feet tall), chosen
    // when you select this species. `size` stays the default
    // (Medium); `sizes` is the choice list the creator offers and
    // the route validates against. First species with a size choice
    // — no other entry carries `sizes` yet.
    sizes: ["Medium", "Small"],
    speeds: { walk: 30 },
    languages: ["Common", "One extra language of your choice"],
    // 2024 traits (PHB p. 194, Zach's photo 2026-11-06 — verbatim):
    // Resourceful, Skillful, Versatile. No ability score increase
    // (the theme's +2/+1 is the 2024 ASI now) and no subraces — the
    // 2014 Standard/Variant Human entry is retired, not presented
    // as the 2024 human. Old rows storing 'Standard Human' /
    // 'Variant Human' still resolve to this entry (legacy aliases
    // in speciesService.js) with no variant applied.
    traits: [
      "Resourceful - You gain Heroic Inspiration whenever you finish a Long Rest",
      "Skillful - You gain proficiency in one skill of your choice",
      "Versatile - You gain an Origin feat of your choice (Skilled is recommended)",
    ],
    // Skillful, structured (items 1+20 grants shape): one skill
    // proficiency of the player's choice — the Stage 4
    // consolidation point reads this from the entry.
    grants: { skills: [{ choose: 1, from: "any_skill" }] },
    abilityScoreIncrease: {},
    // 2024 Versatile (item 19): confirmed by the PHB p. 194 photo
    // (2026-11-06) as well as the Mixed Ancestry doc — "gain an
    // Origin feat of your choice". The creator + validator read
    // this flag — it is the source of truth for who may take the
    // standalone Versatile pick.
    versatile2024: true,
    source: "Player's Handbook (2024)",
    origins: ["Forgotten Realms"],
    innateSpells: [],
    variants: [],
  },
  {
    id: "tiefling",
    name: "Tiefling",
    description: "Humans whose bloodline has been touched by the Lower Planes — often an infernal ancestor many generations removed. Tieflings carry visible signs: horns, a barbed tail, unusual eye color, skin in warm hues. They are met with suspicion nearly everywhere, which shapes them: wary, self-reliant, and used to making their own way.",
    size: "Medium",
    speeds: { walk: 30 },
    languages: ["Common", "Infernal"],
    traits: ["Darkvision (60 ft)", "Hellish Resistance - Resistance to fire damage", "Infernal Legacy - Know Thaumaturgy cantrip, cast Hellish Rebuke and Darkness at higher levels"],
    grants: { senses: ["darkvision 60 ft"], resistances: ["fire"] },
    abilityScoreIncrease: {"int": 1, "cha": 2},
    asiLegacy: true,
    source: "Player's Handbook (2014)",
    origins: ["Forgotten Realms"],
    innateSpells: [{"name": "Thaumaturgy", "level": 0, "uses": "at will"}, {"name": "Hellish Rebuke", "level": 1, "atLevel": 3, "uses": "once per long rest"}, {"name": "Darkness", "level": 2, "atLevel": 5, "uses": "once per long rest"}],
    variants: [
    ],
  },
];
