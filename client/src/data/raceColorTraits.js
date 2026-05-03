/**
 * Per-race eye / hair / skin / build options for Step 7's physical-
 * description picker. Distilled from PHB Chapter 2 race entries plus
 * Volo's Guide (aasimar) / Eberron: Rising from the Last War (warforged) /
 * Mordenkainen's Tome of Foes (dragonborn ancestry colors).
 *
 * Per spec §5.7.4 + PM review (2026-05-02): same shape as
 * raceDemographics — `{ value, label }` arrays per trait, with a
 * "Custom…" affordance handled by the picker for player-authoring agency.
 *
 * Trait notes:
 *   - "Hair" for Dragonborn / Warforged uses body-coverage analogues
 *     (Dragonborn = none; Warforged = filaments/none).
 *   - "Skin" for Dragonborn = scale colors keyed off draconic ancestry.
 *     For Warforged = plating material.
 *   - "Build" tilts toward humanoid silhouettes for most races; constructed
 *     and reptilian races get morphology-appropriate options.
 *
 * Race id keys match `races.json` (hyphenated for half-elf / half-orc).
 */

// ---------------------------------------------------------------------
// Reusable option pools ------------------------------------------------
// ---------------------------------------------------------------------

const HUMAN_EYES = [
  'Brown', 'Hazel', 'Blue', 'Green', 'Gray', 'Amber', 'Black'
].map(v => ({ value: v, label: v }))

const HUMAN_HAIR = [
  'Black', 'Brown', 'Blonde', 'Auburn', 'Red', 'Gray', 'White', 'Bald'
].map(v => ({ value: v, label: v }))

const HUMAN_SKIN = [
  'Pale', 'Fair', 'Light Tan', 'Tan', 'Olive', 'Brown', 'Dark Brown', 'Ebony'
].map(v => ({ value: v, label: v }))

const HUMANOID_BUILD = [
  'Slight', 'Lean', 'Average', 'Athletic', 'Stocky', 'Heavy', 'Muscular', 'Tall', 'Short'
].map(v => ({ value: v, label: v }))

// ---------------------------------------------------------------------
// Per-race overrides ---------------------------------------------------
// ---------------------------------------------------------------------

export const RACE_COLOR_TRAITS = {
  human: {
    eyes: HUMAN_EYES,
    hair: HUMAN_HAIR,
    skin: HUMAN_SKIN,
    build: HUMANOID_BUILD
  },

  // Deep tan / lighter brown skin per PHB; dark eyes; long braided hair common.
  dwarf: {
    eyes: ['Brown', 'Hazel', 'Dark Brown', 'Gray', 'Amber', 'Green'].map(v => ({ value: v, label: v })),
    hair: ['Black', 'Brown', 'Auburn', 'Red', 'Gray', 'White'].map(v => ({ value: v, label: v })),
    skin: ['Ruddy Tan', 'Tan', 'Brown', 'Dark Brown', 'Pale', 'Coppery'].map(v => ({ value: v, label: v })),
    build: ['Stocky', 'Broad-shouldered', 'Heavy', 'Compact', 'Stout', 'Muscular'].map(v => ({ value: v, label: v }))
  },

  // Elven palette skews pale-to-copper skin, dark/silver hair, vivid eyes.
  elf: {
    eyes: ['Green', 'Hazel', 'Blue', 'Gray', 'Amber', 'Violet', 'Gold'].map(v => ({ value: v, label: v })),
    hair: ['Black', 'Silver-White', 'Brown', 'Copper-Red', 'Blonde', 'Auburn', 'Pale Gold'].map(v => ({ value: v, label: v })),
    skin: ['Pale', 'Fair', 'Coppery', 'Olive', 'Dark Brown', 'Ebony'].map(v => ({ value: v, label: v })),
    build: ['Slender', 'Lithe', 'Lean', 'Tall', 'Graceful'].map(v => ({ value: v, label: v }))
  },

  // Blend of human and elven traits.
  'half-elf': {
    eyes: ['Hazel', 'Green', 'Blue', 'Gray', 'Brown', 'Amber', 'Violet', 'Gold'].map(v => ({ value: v, label: v })),
    hair: ['Black', 'Brown', 'Auburn', 'Blonde', 'Silver-White', 'Copper-Red'].map(v => ({ value: v, label: v })),
    skin: ['Pale', 'Fair', 'Tan', 'Olive', 'Brown', 'Coppery', 'Dark Brown', 'Ebony'].map(v => ({ value: v, label: v })),
    build: HUMANOID_BUILD
  },

  // Orcish ancestry — gray-green or ashen skin, coarse dark hair.
  'half-orc': {
    eyes: ['Brown', 'Dark Brown', 'Hazel', 'Amber', 'Yellow', 'Red'].map(v => ({ value: v, label: v })),
    hair: ['Black', 'Dark Brown', 'Iron Gray', 'Coal Black'].map(v => ({ value: v, label: v })),
    skin: ['Gray-Green', 'Ash Gray', 'Olive-Green', 'Tan', 'Slate', 'Pale Green'].map(v => ({ value: v, label: v })),
    build: ['Muscular', 'Broad-shouldered', 'Heavy', 'Tall', 'Towering', 'Powerfully built'].map(v => ({ value: v, label: v }))
  },

  // Halfling: small frames, ruddy or brown skin, hazel/brown eyes.
  halfling: {
    eyes: ['Hazel', 'Brown', 'Green', 'Blue'].map(v => ({ value: v, label: v })),
    hair: ['Brown', 'Black', 'Blonde', 'Auburn', 'Red', 'Sandy'].map(v => ({ value: v, label: v })),
    skin: ['Ruddy', 'Tan', 'Fair', 'Olive', 'Brown'].map(v => ({ value: v, label: v })),
    build: ['Small', 'Wiry', 'Plump', 'Stout', 'Compact', 'Quick'].map(v => ({ value: v, label: v }))
  },

  // Tiefling — infernal palette: skin in shades hinting at devil heritage,
  // solid-color eyes, often dark or vividly unnatural hair.
  tiefling: {
    eyes: ['Red', 'Gold', 'Silver', 'Black', 'White', 'Solid Black', 'Burning Orange', 'Violet'].map(v => ({ value: v, label: v })),
    hair: ['Black', 'Dark Red', 'Crimson', 'Dark Brown', 'Blue-Black', 'Violet', 'Silver'].map(v => ({ value: v, label: v })),
    skin: ['Red', 'Crimson', 'Dusky Red', 'Purple', 'Dark Blue', 'Olive', 'Bronze', 'Charcoal'].map(v => ({ value: v, label: v })),
    build: HUMANOID_BUILD
  },

  // Aasimar — celestial markers: metallic-tone hair, luminous eyes,
  // human-range skin with subtle glow.
  aasimar: {
    eyes: ['Gold', 'Silver', 'Pale Blue', 'Pearl White', 'Luminous Green', 'Amber', 'Violet'].map(v => ({ value: v, label: v })),
    hair: ['Gold', 'Silver', 'Copper', 'Bronze', 'Platinum', 'Black', 'White', 'Auburn'].map(v => ({ value: v, label: v })),
    skin: ['Pale', 'Fair', 'Olive', 'Bronze', 'Brown', 'Dark Brown', 'Subtly Luminous'].map(v => ({ value: v, label: v })),
    build: HUMANOID_BUILD
  },

  // Dragonborn — scaled, no hair traditionally; scale color reflects
  // draconic ancestry (metallic + chromatic). Eyes draconic.
  dragonborn: {
    eyes: ['Red', 'Gold', 'Silver', 'Bronze', 'Copper', 'Green', 'Blue', 'Black', 'White'].map(v => ({ value: v, label: v })),
    hair: ['None — scaled'].map(v => ({ value: v, label: v })),
    skin: [
      'Brass scales', 'Bronze scales', 'Copper scales', 'Gold scales', 'Silver scales',
      'Black scales', 'Blue scales', 'Green scales', 'Red scales', 'White scales'
    ].map(v => ({ value: v, label: v })),
    build: ['Tall', 'Powerfully built', 'Muscular', 'Broad-shouldered', 'Towering', 'Heavy'].map(v => ({ value: v, label: v }))
  },

  // Warforged — constructed body. "Hair" is filaments or none; "skin" is
  // plating material. Eyes commonly crystalline or glowing.
  warforged: {
    eyes: ['Glowing Blue', 'Glowing Green', 'Glowing Amber', 'Glowing Red', 'Crystalline Clear', 'Pale White', 'Black'].map(v => ({ value: v, label: v })),
    hair: ['None — constructed', 'Wire filaments', 'Cable strands', 'Cloth wrap'].map(v => ({ value: v, label: v })),
    skin: ['Steel plating', 'Iron plating', 'Bronze plating', 'Wood-and-metal', 'Stone-clad', 'Darksteel', 'Bone-frame composite'].map(v => ({ value: v, label: v })),
    build: ['Tall', 'Heavy', 'Bulky', 'Sleek', 'Reinforced', 'Slender frame', 'Towering'].map(v => ({ value: v, label: v }))
  }
}

/**
 * Lookup helper. Falls back to human options if race is unknown
 * (defensive — caller should always pass a known race, but a safe
 * fallback prevents the picker from going blank on data drift).
 */
export function getRaceColorTraits(raceId) {
  return RACE_COLOR_TRAITS[raceId] || RACE_COLOR_TRAITS.human
}
