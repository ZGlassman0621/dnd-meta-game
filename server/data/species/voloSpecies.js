// server/data/species/voloSpecies.js — species registry book file (2026-11-04).
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
export const VOLOSPECIES = [
  {
    id: "aasimar",
    name: "Aasimar",
    description: "Humans touched by the divine — descendants, hosts, or chosen of celestial beings. Aasimar look human with subtle luminous traits: metallic hair, piercing eyes, a faint glow in low light. Their souls answer to a guiding celestial, and the relationship shapes who they become.",
    size: "Medium",
    speeds: { walk: 30 },
    languages: ["Common", "Celestial"],
    traits: ["Darkvision (60 ft)", "Celestial Resistance - Resistance to necrotic and radiant damage", "Healing Hands - Touch a creature to heal HP equal to your level (once per long rest)", "Light Bearer - You know the Light cantrip"],
    grants: { senses: ["darkvision 60 ft"], resistances: ["necrotic", "radiant"] },
    abilityScoreIncrease: {"cha": 2},
    asiLegacy: true,
    source: "Volo's Guide to Monsters",
    origins: ["Forgotten Realms"],
    innateSpells: [{"name": "Light", "level": 0, "uses": "at will"}],
    variants: [
      {
        name: "Protector Aasimar",
        description: "Charged by celestial powers to guard the weak and strike at evil. Wings of light manifest their divine mission.",
        traits: ["Darkvision (60 ft)", "Celestial Resistance - Resistance to necrotic and radiant damage", "Healing Hands - Touch a creature to heal HP equal to your level (once per long rest)", "Light Bearer - You know the Light cantrip", "Radiant Soul - Once per long rest, unleash divine energy for 1 minute. You can fly with 30 ft speed and deal extra radiant damage equal to your level once per turn"],
        grants: { senses: ["darkvision 60 ft"], resistances: ["necrotic", "radiant"] },
        speeds: null,
        resolvedASI: {"cha": 2, "wis": 1},
        replaces: [],
        innateSpells: [],
      },
      {
        name: "Scourge Aasimar",
        description: "Touched by divine light that burns intensely within. They mask their celestial nature until unleashing devastating radiance.",
        traits: ["Darkvision (60 ft)", "Celestial Resistance - Resistance to necrotic and radiant damage", "Healing Hands - Touch a creature to heal HP equal to your level (once per long rest)", "Light Bearer - You know the Light cantrip", "Radiant Consumption - Once per long rest, radiate intense light for 1 minute. You deal radiant damage equal to half your level to yourself and enemies within 10 ft at start of your turns"],
        grants: { senses: ["darkvision 60 ft"], resistances: ["necrotic", "radiant"] },
        speeds: null,
        resolvedASI: {"cha": 2, "con": 1},
        replaces: [],
        innateSpells: [],
      },
      {
        name: "Fallen Aasimar",
        description: "Their inner light has been touched by shadow. Dark wings and an aura of fear mark their separation from celestial grace.",
        traits: ["Darkvision (60 ft)", "Celestial Resistance - Resistance to necrotic and radiant damage", "Healing Hands - Touch a creature to heal HP equal to your level (once per long rest)", "Light Bearer - You know the Light cantrip", "Necrotic Shroud - Once per long rest, unleash divine energy for 1 minute. Creatures within 10 ft must make CHA save or be frightened. Deal extra necrotic damage equal to your level once per turn"],
        grants: { senses: ["darkvision 60 ft"], resistances: ["necrotic", "radiant"] },
        speeds: null,
        resolvedASI: {"cha": 2, "str": 1},
        replaces: [],
        innateSpells: [],
      },
    ],
  },
];
