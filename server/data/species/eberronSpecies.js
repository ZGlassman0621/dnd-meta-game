// server/data/species/eberronSpecies.js — species registry book file (2026-11-04).
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
export const EBERRONSPECIES = [
  {
    id: "warforged",
    name: "Warforged",
    description: "Sentient constructs — walking soldiers of wood, stone, metal, and magical fiber, built to serve in old wars and left behind after. Warforged don't eat, drink, or sleep the way flesh-and-blood folk do; they stand watch through the night and ask, each dawn, what purpose they carry today.",
    size: "Medium",
    speeds: { walk: 30 },
    languages: ["Common", "One language of your choice"],
    traits: ["Constructed Resilience - Advantage on saves against poison, resistance to poison damage, immune to disease, doesn't need to eat/drink/breathe, doesn't need to sleep", "Sentry's Rest - When you take a long rest, you spend 6 hours in an inactive state rather than sleeping", "Integrated Protection - Your body has built-in defensive layers: you gain a +1 bonus to Armor Class. You can don only armor with which you have proficiency; incorporating armor into your body or removing it takes 1 hour, and your armor can't be removed against your will", "Specialized Design - You gain one skill proficiency and one tool proficiency of your choice"],
    grants: { skills: [{ choose: 1, from: "any_skill" }], tools: [{ choose: 1, from: "any_tool" }], resistances: ["poison"] },
    abilityScoreIncrease: {"con": 2, "choice": 1},
    asiLegacy: true,
    source: "Eberron: Rising from the Last War",
    origins: ["Eberron"],
    innateSpells: [],
    variants: [
    ],
  },
];
