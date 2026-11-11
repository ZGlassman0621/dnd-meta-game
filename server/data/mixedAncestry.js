// server/data/mixedAncestry.js — Mixed Ancestry trait tables (2026-11-06).
//
// Transcribed EXACTLY as printed in the GM Binder homebrew
// "Mixed Ancestry for D&D 5r (2024)" (EmberBoar Creations, 4 pp,
// ~/workspace/dnd-app-review/blood-hunter-mixed-ancestry/
// Mixed_Ancestry_D_D_2024.txt). The costs are the author's homebrew
// values — do NOT re-balance them, and do not "correct" them against
// the PHB: this doc is the source for this system.
//
// Method (doc p.1): (1) choose two existing parent species;
// (2) type is Humanoid; (3) size from either parent; (4) speed 30 ft
// unless you take an increased-speed trait from a parent; (5) choose
// traits from the parents; combined power budget cannot exceed 7.
// Notes (doc p.3): a rule with a species prerequisite treats a Mixed
// Ancestry PC as eligible for EACH parent species; a 120 ft
// darkvision may instead be taken as 60 ft darkvision for 1 budget;
// you may forgo the Origin Feat from your background for +4 budget.
//
// `darkvisionFt` records the range the doc prints for a Darkvision
// trait (120 or 60) — it is what the 120→60 downgrade rule keys on.
// `speedFt` records the walking speed the doc prints for a speed
// trait (Goliath Speed, 35 ft) — it is what the speed rule keys on.
// Both are transcribed from the printed text, not invented.
//
// Goliath's table is transcribed even though goliath is NOT in the
// app's species registry (item 3, blocked on the 2024 PHB): the
// service refuses a goliath parent until the registry lands, so the
// table is inert until then. Orc's table is likewise transcribed;
// orc IS in the registry but is MVP-deferred, so the service refuses
// it as a parent until the MVP scope lifts.
export const MIXED_ANCESTRY_BASE_BUDGET = 7;
export const MIXED_ANCESTRY_FORGO_ORIGIN_FEAT_BONUS = 4;
export const MIXED_ANCESTRY_DEFAULT_SPEED = 30;
export const MIXED_ANCESTRY_DARKVISION_DOWNGRADE_FORM = 'darkvision60';

// key: registry species id (goliath has no registry entry yet; the key
// is the doc's species name lowercased, so it resolves the day the
// registry gains it).
export const MIXED_ANCESTRY_TRAIT_TABLES = {
  aasimar: {
    traits: [
      { name: 'Celestial Resistance', description: 'Resistance to Necrotic and Radiant damage', cost: 2 },
      { name: 'Darkvision', description: '60ft Darkvision', cost: 1, darkvisionFt: 60 },
      { name: 'Healing Hands', description: 'Heal Prof. Bonus number d4s once per long rest', cost: 2 },
      { name: 'Light Bearer', description: 'Gain the Light cantrip', cost: 1 },
      { name: 'Celestial Revelation', description: '3rd lvl, transformation + extra damage 1 min per long rest', cost: 2 },
    ],
  },
  dragonborn: {
    traits: [
      { name: 'Breath Weapon', description: 'AOE (line/cone), Prof times per long rest, damage scales with lvl', cost: 3 },
      { name: 'Damage Resistance', description: 'Resistance to type associated with ancestry', cost: 1 },
      { name: 'Darkvision', description: '60ft Darkvision', cost: 1, darkvisionFt: 60 },
      { name: 'Draconic Flight', description: '5th lvl, 10 min per long rest', cost: 2 },
    ],
  },
  dwarf: {
    traits: [
      { name: 'Darkvision', description: '120ft Darkvision', cost: 2, darkvisionFt: 120 },
      { name: 'Dwarven Resilience', description: 'Resistance to poison, adv on saves vs poisoned', cost: 2 },
      { name: 'Dwarven Toughness', description: 'Increase HP by 1 per level', cost: 2 },
      { name: 'Stonecunning', description: '60ft tremorsense through stone, 10 min, Prof per long rest', cost: 1 },
    ],
  },
  elf: {
    traits: [
      { name: 'Darkvision', description: '60ft Darkvision', cost: 1, darkvisionFt: 60 },
      { name: 'Elven Lineage', description: 'Improve other trait + a cantrip; also gain spell at lvl 3 and 5', cost: 5 },
      { name: 'Fey Ancestry', description: 'Adv against the charmed condition', cost: 1 },
      { name: 'Keen Senses', description: 'Proficiency in Insight, Perception, or Survival', cost: 1 },
      { name: 'Trance', description: "Don't need/can't be put to sleep", cost: 1 },
    ],
  },
  gnome: {
    traits: [
      { name: 'Darkvision', description: '60ft Darkvision', cost: 1, darkvisionFt: 60 },
      { name: 'Gnomish Cunning', description: 'Adv on Int, Wis, and Cha saving throws', cost: 3 },
      { name: 'Gnomish Lineage', description: 'Gain cantrip(s) and spells/other traits', cost: 3 },
    ],
  },
  goliath: {
    traits: [
      { name: 'Speed', description: 'Walking speed 35 ft', cost: 1, speedFt: 35 },
      { name: 'Giant Ancestry', description: 'Ancestry-based boon, Prof times per long rest', cost: 3 },
      { name: 'Large Form', description: '5th lvl, become Large for 10 minutes once per long rest', cost: 2 },
      { name: 'Powerful Build', description: 'Adv to end grappled, greater carrying capacity', cost: 1 },
    ],
  },
  halfling: {
    traits: [
      { name: 'Brave', description: 'Adv on saving throws to end frightened', cost: 1 },
      { name: 'Halfling Nimbleness', description: 'Move through space of any creature larger than you', cost: 1 },
      { name: 'Luck', description: 'Reroll 1s on any d20 test', cost: 4 },
      { name: 'Naturally Stealthy', description: 'Hide action when behind creature larger than you', cost: 1 },
    ],
  },
  human: {
    traits: [
      { name: 'Resourceful', description: 'Gain heroic inspiration after long rest', cost: 2 },
      { name: 'Skillful', description: 'Proficiency in any 1 skill', cost: 1 },
      { name: 'Versatile', description: 'Gain any Origin Feat', cost: 4 },
    ],
  },
  orc: {
    traits: [
      { name: 'Adrenaline Rush', description: 'Dash as bonus action + temp hp', cost: 2 },
      { name: 'Darkvision', description: '120ft Darkvision', cost: 2, darkvisionFt: 120 },
      { name: 'Relentless Endurance', description: 'When reduced to 0 go to 1 hp once per long rest', cost: 3 },
    ],
  },
  tiefling: {
    traits: [
      { name: 'Darkvision', description: '60ft Darkvision', cost: 1, darkvisionFt: 60 },
      { name: 'Fiendish Legacy', description: 'Gain a resistance and cantrip; also gain spell at lvl 3 and 5', cost: 5 },
      { name: 'Otherworldly Presence', description: 'Gain Thaumaturgy cantrip', cost: 1 },
    ],
  },
};
