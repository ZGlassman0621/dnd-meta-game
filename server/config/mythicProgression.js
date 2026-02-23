// ============================================================================
// MYTHIC PROGRESSION SYSTEM — D&D 5e Mythic Campaign Constants
// ============================================================================
// Defines mythic tiers, base abilities, 14 mythic paths (12 player + 2 DM-only),
// piety/deity integration, epic boons, shadow interactions, and helper functions.
// Pattern follows levelProgression.js: const objects + helpers + named exports.
// ============================================================================

// ============================================================================
// 1. MYTHIC TIERS
// ============================================================================

export const MYTHIC_TIERS = [
  {
    tier: 1,
    name: 'Touched by Legend',
    trialsRequired: 1,
    surgeDie: 'd6',
    mythicPowerBase: 5,
    worldImpact: 'Regional',
    description: 'First mythic awakening. Enhanced mortal.'
  },
  {
    tier: 2,
    name: 'Hero of Renown',
    trialsRequired: 2,
    surgeDie: 'd6',
    mythicPowerBase: 7,
    worldImpact: 'Multi-regional',
    description: 'Legend spreads. Bards sing about them.'
  },
  {
    tier: 3,
    name: 'Champion',
    trialsRequired: 3,
    surgeDie: 'd8',
    mythicPowerBase: 9,
    worldImpact: 'National',
    description: 'Demigod-adjacent. Mundane threats irrelevant.'
  },
  {
    tier: 4,
    name: 'Legend',
    trialsRequired: 4,
    surgeDie: 'd10',
    mythicPowerBase: 11,
    worldImpact: 'Planar',
    description: 'World-shaping. Rivals demigods.'
  },
  {
    tier: 5,
    name: 'Apotheosis',
    trialsRequired: 1,
    surgeDie: 'd12',
    mythicPowerBase: 13,
    worldImpact: 'Cosmic',
    description: 'Quasi-divine. Choice about transcendence.'
  }
];

// ============================================================================
// 2. BASE MYTHIC ABILITIES (shared by all paths except Legend which gets reduced)
// ============================================================================

export const BASE_MYTHIC_ABILITIES = {
  tier1: [
    {
      key: 'mythic_power',
      name: 'Mythic Power',
      description: 'A pool of mythic energy that fuels extraordinary abilities. Pool size is 3 + (2 x tier) per day, refreshed on long rest.',
      tier: 1,
      mythicPowerCost: 0,
      mechanicalEffect: 'Gain a pool of 3 + (2 x mythic tier) Mythic Power points per day. Refreshes on long rest.'
    },
    {
      key: 'surge',
      name: 'Surge',
      description: 'Channel mythic power to add a bonus die to any d20 roll — attack, save, ability check, or skill check.',
      tier: 1,
      mythicPowerCost: 1,
      mechanicalEffect: 'Spend 1 MP as a free action to add your surge die to any d20 roll. Surge die scales with tier: d6 (T1-T2), d8 (T3), d10 (T4), d12 (T5).'
    },
    {
      key: 'hard_to_kill',
      name: 'Hard to Kill',
      description: 'Mythic vitality makes you extraordinarily difficult to slay. You automatically stabilize when dying and can endure far more punishment.',
      tier: 1,
      mythicPowerCost: 0,
      mechanicalEffect: 'Automatically stabilize when at 0 HP. You do not die until your negative HP equals twice your Constitution score (instead of max HP).'
    },
    {
      key: 'mythic_presence',
      name: 'Mythic Presence',
      description: 'Lesser creatures instinctively sense your mythic nature, feeling awe, dread, or reverence in your presence.',
      tier: 1,
      mythicPowerCost: 0,
      mechanicalEffect: 'Creatures with CR lower than your character level can innately sense your mythic power. Their reaction depends on their nature and disposition.'
    }
  ],
  tier2: [
    {
      key: 'amazing_initiative',
      name: 'Amazing Initiative',
      description: 'Mythic reflexes allow you to act before most creatures can even process a threat.',
      tier: 2,
      mythicPowerCost: 0,
      mechanicalEffect: 'Add your mythic tier to all initiative rolls.'
    },
    {
      key: 'recuperation',
      name: 'Recuperation',
      description: 'Your mythic body recovers with supernatural speed, restoring itself fully in a fraction of the time mortals require.',
      tier: 2,
      mythicPowerCost: 0,
      mechanicalEffect: 'An 8-hour rest restores you to full HP. Once between long rests, a 1-hour rest restores all features that normally require a long rest.'
    }
  ],
  tier3: [
    {
      key: 'mythic_saving_throws',
      name: 'Mythic Saving Throws',
      description: 'Your mythic resilience allows you to shrug off effects that would fell lesser beings.',
      tier: 3,
      mythicPowerCost: 1,
      mechanicalEffect: 'Spend 1 MP to reroll a failed saving throw. You must accept the new result.'
    },
    {
      key: 'force_of_will',
      name: 'Force of Will',
      description: 'Your mythic willpower is nearly unbreakable, resisting attempts to dominate or control your mind.',
      tier: 3,
      mythicPowerCost: 1,
      mechanicalEffect: 'Spend 1 MP when targeted by a mind-affecting effect: either reroll a failed save or roll twice and take the higher result.'
    },
    {
      key: 'mundane_immunity',
      name: 'Mundane Immunity',
      description: 'Your body has transcended ordinary physical frailty. Disease, poison, and mundane exhaustion cannot touch you.',
      tier: 3,
      mythicPowerCost: 0,
      mechanicalEffect: 'Immune to non-magical disease, non-magical poison, and mundane sources of exhaustion.'
    }
  ],
  tier4: [
    {
      key: 'unstoppable',
      name: 'Unstoppable',
      description: 'No condition can hold you for long. With a surge of mythic power, you can shatter any debilitating effect.',
      tier: 4,
      mythicPowerCost: 1,
      mechanicalEffect: 'Spend 1 MP as a free action to immediately end one of the following conditions on yourself: blinded, charmed, deafened, frightened, paralyzed, poisoned, or stunned.'
    },
    {
      key: 'mythic_resistance',
      name: 'Mythic Resistance',
      description: 'Your mythic nature grants you resistance to all forms of non-mythic damage.',
      tier: 4,
      mythicPowerCost: 0,
      mechanicalEffect: 'Resistance to all damage from non-mythic sources (creatures without mythic tiers, non-artifact weapons, non-epic spells).'
    }
  ],
  tier5: [
    {
      key: 'immortal',
      name: 'Immortal',
      description: 'Death itself struggles to claim you. Even when slain, your mythic essence draws you back to life.',
      tier: 5,
      mythicPowerCost: 0,
      mechanicalEffect: 'If killed, you return to life after 7 days at full HP at a location meaningful to you. Only a mythic critical hit, an artifact weapon, or a divine decree can permanently kill you.'
    },
    {
      key: 'legendary_hero',
      name: 'Legendary Hero',
      description: 'Your mythic power regenerates constantly, and only the most extraordinary means can end your existence permanently.',
      tier: 5,
      mythicPowerCost: 0,
      mechanicalEffect: 'Regain 1 MP per hour. Only an artifact critical hit or a mythic coup de grace can permanently kill you.'
    }
  ]
};

// ============================================================================
// 3. MYTHIC PATHS (12 player-facing + 2 DM-only)
// ============================================================================

export const MYTHIC_PATHS = {
  // ---- HIEROPHANT ----
  hierophant: {
    key: 'hierophant',
    name: 'Hierophant',
    subtitle: 'Divine champion. Channel of a deity\'s will and power.',
    inspiredBy: 'PF Hierophant + WotR Angel path',
    bestSuited: 'Clerics, Paladins, Druids, divine-focused characters',
    coreTheme: 'Faith made manifest. The divine working through mortal hands.',
    definingFeature: 'Evolving divine aura that grows in radius and power per tier.',
    alignmentPreference: null,
    isPlayerSelectable: true,
    isDmOnly: false,
    abilities: {
      tier1: [
        { key: 'divine_surge', name: 'Divine Surge', description: '3/day, add 1d6 radiant (or deity-appropriate) damage to any attack, spell, check, or save.' },
        { key: 'radiant_presence', name: 'Radiant Presence', description: 'Allies within 30 ft gain advantage on saves vs. fear and charm effects.' },
        { key: 'dawns_blessing', name: 'Dawn\'s Blessing', description: 'Long rest restores additional hit dice equal to WIS modifier.' }
      ],
      tier2: [
        { key: 'deitys_hand', name: 'Deity\'s Hand', description: '1/day, cast any spell on your class list without expending a slot, cast at maximum level you can access.' },
        { key: 'beacon_of_hope', name: 'Beacon of Hope', description: '60 ft aura. Dying allies auto-stabilize. All healing within aura increased by 50%.' },
        { key: 'smite_darkness', name: 'Smite Darkness', description: 'Your radiant damage ignores resistance and treats immunity as resistance.' }
      ],
      tier3: [
        { key: 'divine_transformation', name: 'Divine Transformation', description: '10 minutes, 1/long rest. Fly 60 ft, immunity to radiant and necrotic damage, all attacks deal additional 3d8 radiant, appearance transforms to reflect deity.' },
        { key: 'mass_restoration', name: 'Mass Restoration', description: 'Touch. Cast Greater Restoration on up to 6 targets simultaneously.' },
        { key: 'improved_divine_intervention', name: 'Improved Divine Intervention', description: 'Automatically succeed on Divine Intervention. Usable 1/week instead of 1/long rest.' }
      ],
      tier4: [
        { key: 'sacred_ground', name: 'Sacred Ground', description: 'Create a permanent holy site (100 ft radius). Undead cannot enter. Evil creatures have disadvantage on all rolls. Good creatures heal 1d6 per round.' },
        { key: 'resurrection_mastery', name: 'Resurrection Mastery', description: 'Cast True Resurrection at will. No material components required.' },
        { key: 'solar_judgment', name: 'Solar Judgment', description: '60 ft radius column of divine energy. 10d10 radiant damage. WIS save DC 20 for half. Undead and fiends: no save, full damage.' }
      ],
      tier5: [
        { key: 'deitys_herald', name: 'Deity\'s Herald', description: 'Quasi-deity status. Can grant limited divine power to sworn followers. Worshippers can pray to you for minor miracles.' },
        { key: 'eternal_sunrise', name: 'Eternal Sunrise', description: 'Immortality. Do not age. Auto-resurrect 7 days after death. Only preventable by destroying your holy symbol with an artifact weapon.' },
        { key: 'reshape_dawn', name: 'Reshape Dawn', description: 'Once per year, rewrite a single event within the last 24 hours. The universe remembers both versions.' }
      ]
    }
  },

  // ---- ANGEL ----
  angel: {
    key: 'angel',
    name: 'Angel',
    subtitle: 'Celestial warrior. Embodiment of divine justice, mercy, and holy war.',
    inspiredBy: 'WotR Angel path',
    bestSuited: 'Paladins, Clerics, martial divine characters',
    coreTheme: 'Righteous warfare. Not just faith but active intervention against evil. The sword of heaven.',
    definingFeature: 'Evolving wings and merged divine spellcasting.',
    alignmentPreference: 'Good',
    isPlayerSelectable: true,
    isDmOnly: false,
    abilities: {
      tier1: [
        { key: 'angelic_weapon', name: 'Angelic Weapon', description: 'Weapon permanently gains +1d6 radiant damage. Bypasses all resistance.' },
        { key: 'shield_of_faith_aura', name: 'Shield of Faith Aura', description: 'Allies within 15 ft gain +1 AC. Does not require concentration.' },
        { key: 'celestial_sight', name: 'Celestial Sight', description: 'See invisible creatures, see through magical darkness, detect evil by sight (constant).' }
      ],
      tier2: [
        { key: 'wings_of_light', name: 'Wings of Light', description: 'Fly speed 60 ft (manifested radiant wings). Can be dismissed/summoned as bonus action.' },
        { key: 'merged_spellcasting', name: 'Merged Spellcasting', description: 'Gain access to a supplementary divine spellbook. Spells cast at +5 caster level using existing slots.' },
        { key: 'angelic_immunity', name: 'Angelic Immunity', description: 'Immune to disease, poison, and fear. Advantage on saves vs. charm and compulsion.' }
      ],
      tier3: [
        { key: 'sunblade', name: 'Sunblade', description: '1/long rest, summon a blade of pure radiant energy (Holy Avenger, 6d8 radiant damage, 30 ft anti-magic aura vs. evil).' },
        { key: 'mass_heal', name: 'Mass Heal', description: 'Cast Heal targeting up to 10 creatures within 60 ft, 1/long rest.' },
        { key: 'angelic_transformation', name: 'Angelic Transformation', description: 'Permanent physical changes — radiant eyes, faint glow, celestial beauty. Advantage on Intimidation/Persuasion with evil/good creatures.' }
      ],
      tier4: [
        { key: 'storm_of_justice', name: 'Storm of Justice', description: '1/day, divine storm. 120 ft radius, 8d10 radiant + 8d10 thunder. Evil creatures WIS save or banished for 1 minute.' },
        { key: 'angelic_army', name: 'Angelic Army', description: 'Summon an elite angelic squad (mass combat rules) that fights for 1 hour. 1/week.' },
        { key: 'merged_soul', name: 'Merged Soul', description: 'Spellcasting reaches beyond mortal limits. Access to 10th-level divine spells.' }
      ],
      tier5: [
        { key: 'true_angel', name: 'True Angel', description: 'Permanent transformation into a celestial being. Retain mortal memories and free will. All abilities enhanced to maximum.' },
        { key: 'judgment_of_heavens', name: 'Judgment of the Heavens', description: '1/year, pronounce divine judgment on a creature or location. If evil, the judgment is absolute — no save, no resistance, no escape.' },
        { key: 'eternal_vigil', name: 'Eternal Vigil', description: 'Cannot die by any means short of direct divine intervention from a greater deity.' }
      ]
    }
  },

  // ---- AEON ----
  aeon: {
    key: 'aeon',
    name: 'Aeon',
    subtitle: 'Cosmic arbiter. Judge of balance, enforcer of natural law.',
    inspiredBy: 'WotR Aeon path',
    bestSuited: 'Monks, Paladins (Devotion/Crown), Wizards (Divination), Clerics (Order/Knowledge)',
    coreTheme: 'Balance above all. Not good or evil — cosmic order. Time, fate, and causality are your tools.',
    definingFeature: 'Gaze abilities — supernatural perception that can nullify, judge, and enforce.',
    alignmentPreference: 'Lawful',
    isPlayerSelectable: true,
    isDmOnly: false,
    abilities: {
      tier1: [
        { key: 'aeons_gaze', name: 'Aeon\'s Gaze', description: 'As an action, target one creature within 60 ft. Perceive their true nature: alignment, magical effects, curses, compulsions. 3/day.' },
        { key: 'enforcing_presence', name: 'Enforcing Presence', description: 'Creatures within 30 ft cannot benefit from illusion magic or shapechanging. Their true form is visible.' },
        { key: 'temporal_awareness', name: 'Temporal Awareness', description: 'Cannot be surprised. Advantage on initiative. Sense disturbances in causality.' }
      ],
      tier2: [
        { key: 'nullifying_gaze', name: 'Nullifying Gaze', description: 'As an action, target one creature within 60 ft. Dispel one magical effect (as Dispel Magic at 9th level, no check). 3/day.' },
        { key: 'law_of_conservation', name: 'Law of Conservation', description: 'When you or an ally within 30 ft takes damage, redistribute that damage among willing creatures in range. Reaction, costs 1 MP.' },
        { key: 'rewind', name: 'Rewind', description: '1/day, revert one creature to the state they were in 6 seconds ago. Undoes damage, conditions, movement. Does not undo death.' }
      ],
      tier3: [
        { key: 'paralyzing_gaze', name: 'Paralyzing Gaze', description: 'Creatures that meet your gaze and fail WIS save are paralyzed for 1 round. At will vs. non-mythic. 1/encounter per mythic target.' },
        { key: 'temporal_manipulation', name: 'Temporal Manipulation', description: '1/long rest, stop time for 3 rounds (improved Time Stop — can affect other creatures with non-damaging actions).' },
        { key: 'zone_of_truth_absolute', name: 'Zone of Truth (Absolute)', description: '60 ft zone where lying is impossible. Cosmic, not magical — cannot be resisted, dispelled, or circumvented. 10 min, 1/day.' }
      ],
      tier4: [
        { key: 'edict', name: 'Edict', description: 'Pronounce a cosmic law affecting 1-mile radius for 24 hours (e.g. no teleportation, no shapechanging, no spells above 5th level). 1/day.' },
        { key: 'rewrite', name: 'Rewrite', description: '1/week, undo a single event from the past 7 days. Timeline adjusts. Witnesses have fragmented memories of both versions.' },
        { key: 'perfect_judge', name: 'Perfect Judge', description: 'Automatically know if any statement you hear is true, false, or partially true. Constant.' }
      ],
      tier5: [
        { key: 'cosmic_arbiter', name: 'Cosmic Arbiter', description: 'Embodiment of natural law. Can pronounce binding judgment on any being, including deities, regarding violations of cosmic order.' },
        { key: 'temporal_sovereignty', name: 'Temporal Sovereignty', description: 'Control the flow of time — age, reverse, pause, or accelerate time for individual objects or creatures.' },
        { key: 'immortal_balance', name: 'Immortal Balance', description: 'Exist outside normal mortality. Cannot age or be permanently killed by less than the combined will of multiple deities.' }
      ]
    }
  },

  // ---- AZATA ----
  azata: {
    key: 'azata',
    name: 'Azata',
    subtitle: 'Champion of freedom, joy, and chaotic good.',
    inspiredBy: 'WotR Azata path',
    bestSuited: 'Bards, Rangers, Sorcerers, Warlocks (Archfey), free-spirited characters',
    coreTheme: 'Freedom, creativity, spontaneity, friendship. Power through joy rather than discipline.',
    definingFeature: 'Supernatural fey companion spirit + reality-bending inspiration effects.',
    alignmentPreference: 'Chaotic Good',
    isPlayerSelectable: true,
    isDmOnly: false,
    abilities: {
      tier1: [
        { key: 'azatas_song', name: 'Azata\'s Song', description: '3/day, supernatural performance. Allies within 60 ft gain temp HP equal to level + CHA mod and advantage on next check or save.' },
        { key: 'fey_companion', name: 'Fey Companion', description: 'Gain a fey spirit companion. Can scout ethereally, deliver messages, and provide advantage on Insight/Perception 3/day.' },
        { key: 'elysian_freedom', name: 'Elysian Freedom', description: 'You and allies within 30 ft are immune to Restrained and gain advantage on saves vs. paralysis, petrification, and movement restriction.' }
      ],
      tier2: [
        { key: 'zippy_magic', name: 'Zippy Magic', description: 'When you cast a single-target spell, spend 1 MP to simultaneously target a second creature within 30 ft of the first.' },
        { key: 'incredible_inspiration', name: 'Incredible Inspiration', description: 'Azata\'s Song now also ends one condition on each affected ally (charmed, frightened, poisoned, or stunned).' },
        { key: 'fey_step', name: 'Fey Step', description: 'Teleport up to 60 ft as a bonus action. Flowers bloom or butterflies appear at departure and arrival points.' }
      ],
      tier3: [
        { key: 'manifest_companion', name: 'Manifest Companion', description: 'Fey companion can physically manifest using Young Dragon (Fey type) stat block that scales with mythic tier.' },
        { key: 'songs_of_steel', name: 'Songs of Steel', description: '1/long rest, supernatural song as weapon. Enemies within 120 ft CHA save or 8d8 psychic damage and charmed 1 minute.' },
        { key: 'believe_in_yourself', name: 'Believe in Yourself', description: '1/day, grant one creature automatic success on their next check, attack, or save. Must genuinely believe in them.' }
      ],
      tier4: [
        { key: 'favorable_magic', name: 'Favorable Magic', description: 'When an enemy rolls natural 1 on a save against your spells, effects are doubled in duration and they have disadvantage on subsequent saves.' },
        { key: 'azata_superpower', name: 'Azata Superpower', description: 'Gain one unique reality-bending ability determined through play (flight at speed of thought, creating matter from song, etc.).' },
        { key: 'chaotic_cascade', name: 'Chaotic Cascade', description: 'On critical hit or forced critical failure: target is polymorphed into harmless creature for 1 round, teleported 100 ft randomly, or forgets last 6 seconds.' }
      ],
      tier5: [
        { key: 'eternal_freedom', name: 'Eternal Freedom', description: 'No force in the multiverse can permanently restrain, imprison, compel, or control you. Any attempt automatically fails.' },
        { key: 'create_domain', name: 'Create Domain', description: 'Create a permanent demiplane reflecting your personality and values. Your realm, answerable to no deity.' },
        { key: 'companion_ascension', name: 'Companion Ascension', description: 'Fey companion becomes a fully realized fey lord/lady with independent mythic-tier power.' }
      ]
    }
  },

  // ---- GOLD DRAGON ----
  gold_dragon: {
    key: 'gold_dragon',
    name: 'Gold Dragon',
    subtitle: 'Benevolent power incarnate. Mercy, strength, and wisdom of the greatest creatures.',
    inspiredBy: 'WotR Gold Dragon path',
    bestSuited: 'Characters who demonstrate consistent mercy, wisdom, and physical courage',
    coreTheme: 'Becoming the most powerful benevolent creature in existence. Dragon power is older than gods.',
    definingFeature: 'Physical transformation into a dragon, culminating in full polymorphic dragon form.',
    alignmentPreference: 'Good',
    isPlayerSelectable: true,
    isDmOnly: false,
    abilities: {
      tier1: [
        { key: 'draconic_resilience', name: 'Draconic Resilience', description: '+2 to all ability scores (stacks with normal maximums, raising cap to 22).' },
        { key: 'breath_weapon', name: 'Breath Weapon', description: '60 ft cone, 6d10 fire damage, DC = 8 + proficiency + CON modifier. Recharges on short rest.' },
        { key: 'dragon_sight', name: 'Dragon Sight', description: 'Blindsight 30 ft, Darkvision 120 ft. Immune to the Frightened condition.' }
      ],
      tier2: [
        { key: 'scales', name: 'Scales', description: 'Natural AC of 18 + DEX modifier (if better than current). Resistance to fire damage.' },
        { key: 'wing_buffet', name: 'Wing Buffet', description: 'Bonus action: all creatures within 10 ft STR save or knocked prone and pushed 10 ft.' },
        { key: 'dragons_wisdom', name: 'Dragon\'s Wisdom', description: 'Advantage on all WIS and INT saving throws. Proficiency in Insight if not already proficient.' }
      ],
      tier3: [
        { key: 'dragon_form', name: 'Dragon Form', description: '1/long rest, transform into Adult Gold Dragon for 1 hour. Retain mental ability scores and class features.' },
        { key: 'merciful_flame', name: 'Merciful Flame', description: 'Breath weapon can be set to non-lethal (targets stabilize at 0 HP) or terrifying (WIS save or frightened 1 min).' },
        { key: 'draconic_authority', name: 'Draconic Authority', description: 'Dragons recognize you as kin. Evil dragons won\'t attack unprovoked. Good dragons treat you as honored ally.' }
      ],
      tier4: [
        { key: 'permanent_wings', name: 'Permanent Wings', description: 'Fly speed 80 ft, always available. Wings can be hidden as bonus action.' },
        { key: 'frightful_presence', name: 'Frightful Presence', description: 'Creatures of your choice within 120 ft WIS save or frightened 1 minute. At will vs. non-mythic creatures.' },
        { key: 'dragon_form_improved', name: 'Dragon Form (Improved)', description: 'Transform into Ancient Gold Dragon. Duration extended to 8 hours. 3/day.' }
      ],
      tier5: [
        { key: 'true_dragon', name: 'True Dragon', description: 'Freely shift between humanoid and Great Wyrm Gold Dragon form at will. Among the most powerful non-divine creatures.' },
        { key: 'dragon_mercy', name: 'Dragon Mercy', description: '1/day, golden fire cone that heals allies fully and deals 20d10 radiant to enemies. No save for evil creatures.' },
        { key: 'timeless', name: 'Timeless', description: 'Functionally immortal. Can only be permanently killed by another Great Wyrm, a deity, or a dragon-slaying artifact.' }
      ]
    }
  },

  // ---- LICH ----
  lich: {
    key: 'lich',
    name: 'Lich',
    subtitle: 'Undying pursuit of knowledge and power through mastery over death itself.',
    inspiredBy: 'WotR Lich path',
    bestSuited: 'Wizards, Sorcerers, Warlocks, Clerics (Death/Grave), intelligence-focused characters',
    coreTheme: 'Transcendence through forbidden knowledge. Death is a limitation to be overcome. Power demands sacrifice.',
    definingFeature: 'Phylactery — your soul is stored in an external vessel.',
    alignmentPreference: 'Evil (required — creating a phylactery requires evil acts)',
    isPlayerSelectable: true,
    isDmOnly: false,
    abilities: {
      tier1: [
        { key: 'negative_energy_affinity', name: 'Negative Energy Affinity', description: 'Necrotic damage heals you. Healing spells damage you (or you can choose to be unaffected). Undead are not inherently hostile.' },
        { key: 'undead_fortitude', name: 'Undead Fortitude', description: 'At 0 HP, CON save (DC 5 + damage taken). On success, drop to 1 HP instead. 1/long rest.' },
        { key: 'forbidden_knowledge', name: 'Forbidden Knowledge', description: 'Proficiency in Arcana if not already. Access to Necromancy spells from any class list.' }
      ],
      tier2: [
        { key: 'phylactery', name: 'Phylactery', description: 'Create your soul vessel through dark ritual. As long as it exists, regenerate from any death in 1d10 days near it.' },
        { key: 'command_undead', name: 'Command Undead', description: 'At will, control up to your level in CR worth of undead. No save for mindless undead. Intelligent undead get WIS save.' },
        { key: 'life_drain', name: 'Life Drain', description: 'Bonus action melee attack: 4d8 necrotic damage and heal for the amount dealt. 3/day.' }
      ],
      tier3: [
        { key: 'undead_army', name: 'Undead Army', description: 'Raise and permanently control up to 100 HD worth of undead. They persist until destroyed.' },
        { key: 'death_gaze', name: 'Death Gaze', description: 'Creatures that meet your gaze and fail CON save drop to 0 HP. Non-mythic only. 1/day.' },
        { key: 'mastery_of_death', name: 'Mastery of Death', description: 'No longer need to eat, drink, sleep, or breathe. Immune to poison, disease, exhaustion, and Frightened.' }
      ],
      tier4: [
        { key: 'soul_trap', name: 'Soul Trap', description: 'When a creature dies within 60 ft, capture its soul. Each trapped soul grants +1 spell save DC, up to mythic tier.' },
        { key: 'incorporeal_form', name: 'Incorporeal Form', description: '3/day, become incorporeal for 1 minute. Pass through objects, resistance to all non-force non-radiant damage.' },
        { key: 'eldritch_mastery', name: 'Eldritch Mastery', description: 'Cast any Wizard spell of 5th level or lower at will, without slots or components.' }
      ],
      tier5: [
        { key: 'perfect_undeath', name: 'Perfect Undeath', description: 'You are Death\'s equal. Immune to all effects that destroy undead (Turn Undead, Sunlight Sensitivity, etc.).' },
        { key: 'mastery_of_souls', name: 'Mastery of Souls', description: 'Commune with, question, release, or destroy any soul in your possession. Offer others immortality through undeath.' },
        { key: 'the_final_equation', name: 'The Final Equation', description: '1/year, permanently resurrect someone (true reversal) or permanently kill something (no resurrection possible). Terrifies even gods.' }
      ]
    }
  },

  // ---- DEMON ----
  demon: {
    key: 'demon',
    name: 'Demon',
    subtitle: 'Raw power through rage, transformation, and embracing primal chaos.',
    inspiredBy: 'WotR Demon path',
    bestSuited: 'Barbarians, Fighters, Warlocks (Fiend), characters with deep anger or trauma',
    coreTheme: 'Channeling rage into power. Not mindless — directed fury. What happens when you stop holding back.',
    definingFeature: 'Demonic Rage (enhanced rage states) + physical transformation.',
    alignmentPreference: 'Chaotic (shadow points accumulate faster than any other path)',
    isPlayerSelectable: true,
    isDmOnly: false,
    abilities: {
      tier1: [
        { key: 'demonic_rage', name: 'Demonic Rage', description: 'Enhanced rage 3/day. +2 damage, resistance to one additional type (fire or poison), attacks count as magical.' },
        { key: 'demonic_aspect', name: 'Demonic Aspect', description: 'Choose one permanent transformation: horns (+1d6 on charge), claws (1d8 slashing unarmed), or tail (bonus action prone within 10 ft).' },
        { key: 'abyssal_resilience', name: 'Abyssal Resilience', description: 'Advantage on saves vs. charm and fear. Resistant to fire damage.' }
      ],
      tier2: [
        { key: 'greater_rage', name: 'Greater Rage', description: 'Demonic Rage improves: +4 damage, resist fire AND poison, frightful presence (30 ft, WIS save or frightened).' },
        { key: 'demonic_form', name: 'Demonic Form', description: '1/long rest, transform for 10 min. Fly 60 ft (bat wings), natural armor AC 18, unarmed 2d8 + STR.' },
        { key: 'abyssal_knowledge', name: 'Abyssal Knowledge', description: 'Instinctively understand demonic tactics, weaknesses, and hierarchy. Advantage on all checks related to fiends and the Abyss.' }
      ],
      tier3: [
        { key: 'aura_of_destruction', name: 'Aura of Destruction', description: 'While raging, all enemies within 15 ft take 2d6 fire damage at the start of your turn.' },
        { key: 'demonic_aspect_greater', name: 'Demonic Aspect (Greater)', description: 'Choose two additional aspects: horns, claws, tail, wings, extra arms (bonus action grapple), or armored hide (+2 AC).' },
        { key: 'resist_the_abyss', name: 'Resist the Abyss', description: 'Reduce Shadow Points gained from Demon path abilities by 1 (minimum 0). Does not apply to actual evil actions.' }
      ],
      tier4: [
        { key: 'ultimate_rage', name: 'Ultimate Rage', description: 'Demonic Rage is now at will. While raging: +6 damage, immunity to fire, attacks deal additional 3d6 fire.' },
        { key: 'mass_terror', name: 'Mass Terror', description: '1/day, 120 ft terror aura. Non-mythic enemies WIS save or flee 1 min. Mythic: disadvantage on attacks for 1 round on fail.' },
        { key: 'abyssal_gate', name: 'Abyssal Gate', description: '1/week, open a portal to the Abyss. Control what comes through. Lesser demons obey. Portal lasts 1 hour.' }
      ],
      tier5: [
        { key: 'transcendent_rage', name: 'Transcendent Rage', description: 'Rage becomes cosmic. Ground cracks, flames erupt, creatures within 300 ft feel primal fear. All physical ability scores become 30 while raging.' },
        { key: 'shape_the_abyss', name: 'Shape the Abyss', description: 'Gain dominion over a layer of the Abyss. Demons in your layer obey absolutely. Reshape it to your will.' },
        { key: 'the_choice', name: 'The Choice', description: 'Final decision: Embrace fully (become true demon lord, lose mortal nature) or Master the flame (retain mortality, keep all abilities, cap at Tier 5).' }
      ]
    }
  },

  // ---- DEVIL ----
  devil: {
    key: 'devil',
    name: 'Devil',
    subtitle: 'Power through contracts, hierarchy, and infernal authority.',
    inspiredBy: 'WotR Devil path',
    bestSuited: 'High Charisma, diplomatic/manipulative playstyle, comfortable with moral compromise',
    coreTheme: 'Order in service of self-interest. Power from binding agreements, hierarchical authority, and the letter of the law.',
    definingFeature: 'Hell\'s Decree — binding pronouncements with supernatural force.',
    alignmentPreference: 'Lawful Evil',
    isPlayerSelectable: true,
    isDmOnly: false,
    abilities: {
      tier1: [
        { key: 'silver_tongue', name: 'Silver Tongue', description: 'Advantage on all Deception and Persuasion checks. Deals and agreements are magically binding to the letter.' },
        { key: 'hellfire', name: 'Hellfire', description: 'Fire damage becomes hellfire — half fire, half necrotic. Ignores fire resistance.' },
        { key: 'infernal_resilience', name: 'Infernal Resilience', description: 'Resistance to fire and poison. Immune to the Charmed condition.' }
      ],
      tier2: [
        { key: 'hells_decree', name: 'Hell\'s Decree', description: '3/day, target one creature. WIS save or follow a single-sentence command for 1 minute. Cannot directly cause self-harm.' },
        { key: 'contract_magic', name: 'Contract Magic', description: 'Create magically binding contracts. Violation causes 6d10 psychic (no save) and brands the violator as oathbreaker.' },
        { key: 'infernal_hierarchy', name: 'Infernal Hierarchy', description: 'Lower-rank devils recognize your authority. Can negotiate with any devil as a peer.' }
      ],
      tier3: [
        { key: 'greater_decree', name: 'Greater Decree', description: 'Decrees target up to 6 creatures, last 1 hour. Can command complex behaviors.' },
        { key: 'infernal_transformation', name: 'Infernal Transformation', description: 'Permanent changes — hellfire eyes, independent shadow. Darkvision 120 ft, immunity to fire, fly 60 ft (retractable batwings).' },
        { key: 'soul_bargain', name: 'Soul Bargain', description: 'Offer power in exchange for service: grant a feat, ASI, or 3rd-level spell 1/day. Gain absolute location knowledge and one command/month.' }
      ],
      tier4: [
        { key: 'absolute_authority', name: 'Absolute Authority', description: '1/day, 1-mile radius decree. All creatures must obey a single rule for 24 hours. Mythic creatures can resist with MP.' },
        { key: 'infernal_court', name: 'Infernal Court', description: 'Summon a company of devils (mass combat rules) for 1 hour. 1/week.' },
        { key: 'unbreakable_contract', name: 'Unbreakable Contract', description: 'Contracts enforced by Laws of Hell. Violation is impossible. Only Tier 5 beings or deities can breach with consequences.' }
      ],
      tier5: [
        { key: 'lord_of_the_nine', name: 'Lord of the Nine', description: 'Dominion over a portion of the Nine Hells. Your word is literal law within your domain.' },
        { key: 'ultimate_contract', name: 'Ultimate Contract', description: '1/year, bind even a deity to a contract if they consent. Terms can be supernaturally persuasive.' },
        { key: 'immortal_authority', name: 'Immortal Authority', description: 'Cannot be permanently killed within your domain. Outside it, reform in 1d10 days. Only destroying the domain ends you.' }
      ]
    }
  },

  // ---- TRICKSTER ----
  trickster: {
    key: 'trickster',
    name: 'Trickster',
    subtitle: 'Master of deception, luck manipulation, and reality-bending mischief.',
    inspiredBy: 'PF Trickster + WotR Trickster path',
    bestSuited: 'Rogues, Bards, Rangers, anyone relying on skill, cunning, and lateral thinking',
    coreTheme: 'The universe has rules, and you\'ve found the cheat codes. Not divine power — just being really good at breaking what shouldn\'t be breakable.',
    definingFeature: 'Trickster Feats — mundane skills pushed into supernatural territory.',
    alignmentPreference: null,
    isPlayerSelectable: true,
    isDmOnly: false,
    abilities: {
      tier1: [
        { key: 'supernatural_luck', name: 'Supernatural Luck', description: '3/day, after any creature within 60 ft makes a d20 roll, change the result by up to 3 in either direction.' },
        { key: 'tricksters_reflexes', name: 'Trickster\'s Reflexes', description: 'You can take two reactions per round instead of one.' },
        { key: 'impossible_skill', name: 'Impossible Skill', description: 'Choose one skill. You can achieve physically impossible results with it (e.g. Stealth: hide in plain sight while being watched).' }
      ],
      tier2: [
        { key: 'greater_luck', name: 'Greater Luck', description: 'Supernatural Luck increases to 5/day and adjustment increases to +/-5.' },
        { key: 'trickster_feat', name: 'Trickster Feat', description: 'Choose a second skill to become Impossible.' },
        { key: 'perfect_disguise', name: 'Perfect Disguise', description: 'Mimic any creature observed for 1 min, including voice, mannerisms, and magical aura. Only mythic True Seeing can penetrate.' }
      ],
      tier3: [
        { key: 'steal_anything', name: 'Steal Anything', description: '1/day, touch a creature and steal one: a spell slot, a class feature, a memory, or 4 points from an ability score. Lasts 1 hour.' },
        { key: 'two_places_at_once', name: 'Two Places at Once', description: '1/long rest, create a perfect duplicate for 1 hour. Acts independently, shares your stats and MP pool. If either dies, the other is the real one.' },
        { key: 'trickster_feat_tier3', name: 'Trickster Feat (Greater)', description: 'Choose a third Impossible Skill.' }
      ],
      tier4: [
        { key: 'rewrite_fate', name: 'Rewrite Fate', description: '3/day, after any d20 roll within 120 ft, change the result to any number 1-20. Not luck — literally editing what happened.' },
        { key: 'steal_mythic_power', name: 'Steal Mythic Power', description: 'When stealing from a mythic creature, can steal 1d4 Mythic Power uses instead. They lose them; you gain them.' },
        { key: 'master_of_all_trades', name: 'Master of All Trades', description: 'All skills are Impossible Skills for you.' }
      ],
      tier5: [
        { key: 'narrative_authority', name: 'Narrative Authority', description: '1/day, declare something is true and it becomes true. Must be theoretically possible. Can be resisted by Tier 5 beings.' },
        { key: 'immune_to_fate', name: 'Immune to Fate', description: 'Cannot be scryed, predicted, fated, prophesied about, or included in divine plans without consent. A blind spot in reality.' },
        { key: 'the_last_laugh', name: 'The Last Laugh', description: 'Cannot be permanently killed. If killed, reappear within 1d4 days somewhere unexpected. No force can prevent this.' }
      ]
    }
  },

  // ---- LEGEND ----
  legend: {
    key: 'legend',
    name: 'Legend',
    subtitle: 'Rejection of mythic power for perfected mortal excellence.',
    inspiredBy: 'WotR Legend path + PF mortal excellence concept',
    bestSuited: 'Any character who philosophically rejects supernatural ascension',
    coreTheme: 'I don\'t need to become something more than human. Human is enough. Power through sheer will and refusal to take shortcuts.',
    definingFeature: 'Additional class levels instead of mythic abilities. You are Batman in a room full of Supermen.',
    alignmentPreference: null,
    isPlayerSelectable: true,
    isDmOnly: false,
    abilities: {
      tier1: [
        { key: 'extra_levels_24', name: 'Beyond Mortal Limits I', description: 'Gain 4 additional class levels (to Level 24). Ability score maximums increase to 24.' },
        { key: 'legend_surge', name: 'Legend\'s Surge', description: 'Retain Mythic Power at reduced rate (1 + tier per day) and can use Surge.' },
        { key: 'mortal_determination', name: 'Mortal Determination', description: 'Your refusal of transcendence inspires. Allies within 30 ft gain advantage on saves vs. fear and charm.' }
      ],
      tier2: [
        { key: 'extra_levels_28', name: 'Beyond Mortal Limits II', description: 'Gain 4 more class levels (to Level 28). Ability score maximums increase to 26.' },
        { key: 'unmatched_versatility', name: 'Unmatched Versatility', description: 'More spell slots than any mythic caster, more attacks than any mythic warrior. Pure class feature scaling.' },
        { key: 'inspiring_mortality', name: 'Inspiring Mortality', description: 'NPCs react with proportionally more admiration. A Legend who keeps up with demigods is more inspiring than the demigods.' }
      ],
      tier3: [
        { key: 'extra_levels_32', name: 'Beyond Mortal Limits III', description: 'Gain 4 more class levels (to Level 32). Ability score maximums increase to 28.' },
        { key: 'iron_will', name: 'Iron Will', description: 'Advantage on all Wisdom and Charisma saving throws through sheer willpower, not magic.' },
        { key: 'legendary_endurance', name: 'Legendary Endurance', description: 'Immune to exhaustion from non-magical sources. Short rest restores half max HP.' }
      ],
      tier4: [
        { key: 'extra_levels_36', name: 'Beyond Mortal Limits IV', description: 'Gain 4 more class levels (to Level 36). Ability score maximums increase to 30.' },
        { key: 'human_tenacity', name: 'Human Tenacity', description: 'When reduced to 0 HP, make a CON save (DC 10). On success, drop to 1 HP instead. 3/long rest.' },
        { key: 'peak_performance', name: 'Peak Performance', description: 'All class features function at maximum efficiency. Critical hit range expands by 1.' }
      ],
      tier5: [
        { key: 'extra_levels_40', name: 'Beyond Mortal Limits V', description: 'Gain 4 more class levels (to Level 40). No ability score maximum.' },
        { key: 'perfected_mortal', name: 'Perfected Mortal', description: 'The ultimate human. Every victory is proportionally more impressive than a demigod\'s. Your legend outlives even the gods.' },
        { key: 'legacy_of_will', name: 'Legacy of Will', description: 'When you die, your death inspires a permanent effect: one institution, ideal, or tradition you championed becomes indestructible by any force.' }
      ]
    }
  },

  // ---- REDEMPTION ----
  redemption: {
    key: 'redemption',
    name: 'Redemption',
    subtitle: 'Mythic through atonement, institution building, and breaking the chains of corruption.',
    inspiredBy: 'Custom path — not from any source material',
    bestSuited: 'Characters who have committed terrible acts and choose atonement. Characters with significant Shadow Points.',
    coreTheme: 'The deepest power comes from understanding darkness and choosing light anyway. Not the absence of evil — the active rejection of it.',
    definingFeature: 'Evolving ability to sense, understand, and break compulsion, corruption, and dark influence.',
    alignmentPreference: 'Good (earned through atonement)',
    isPlayerSelectable: true,
    isDmOnly: false,
    abilities: {
      tier1: [
        { key: 'sense_corruption', name: 'Sense Corruption', description: 'Detect the presence and nature of compulsion, charm, corruption, or dark influence on any creature within 60 ft. Constant.' },
        { key: 'atonements_shield', name: 'Atonement\'s Shield', description: 'Shadow Point count displayed to divine entities as proof of your journey. Good-aligned beings recognize sincere intent. Advantage on Persuasion with those who know your history.' },
        { key: 'shared_burden', name: 'Shared Burden', description: '3/day, touch a creature suffering from curse/charm/compulsion. Take 2d8 psychic damage but gain complete understanding of the effect — source, nature, and how to break it.' }
      ],
      tier2: [
        { key: 'break_compulsion', name: 'Break Compulsion', description: '1/day, touch a creature under magical compulsion, charm, or mind control. The effect ends (no check, any spell level). Mythic effects cost 1 MP.' },
        { key: 'sanctuary_of_second_chances', name: 'Sanctuary of Second Chances', description: '30 ft radius: hostile emotions suppressed, truth-telling encouraged, weapons cannot be drawn in anger (WIS save to override). 1 hour, 1/day.' },
        { key: 'understand_the_fallen', name: 'Understand the Fallen', description: 'Sense Corruption also reveals why the creature fell — their pain, vulnerability, moment of weakness. Advantage on attempts to reach or persuade them.' }
      ],
      tier3: [
        { key: 'mass_break_compulsion', name: 'Mass Break Compulsion', description: 'As Break Compulsion but affects all creatures within 30 ft simultaneously. 1/long rest.' },
        { key: 'living_proof', name: 'Living Proof', description: 'Your presence weakens dark influence. Charm/compulsion/corruption effects within 60 ft have DCs reduced by your mythic tier. Affected creatures get new saves each round.' },
        { key: 'redemptions_price', name: 'Redemption\'s Price', description: 'Take another creature\'s curse or dark influence into yourself. You have advantage on saves against it. Fades at 1 Shadow Point per week.' }
      ],
      tier4: [
        { key: 'absolute_absolution', name: 'Absolute Absolution', description: '1/week, touch a creature and completely purge all corruption, curses, dark pacts, and compulsions — regardless of source or power level.' },
        { key: 'inspiring_redemption', name: 'Inspiring Redemption', description: 'When you successfully redeem someone, all witnessing allies gain temporary Mythic Power (1 use) and advantage on all rolls for 24 hours.' },
        { key: 'institution_builder', name: 'Institution Builder', description: 'Organizations you founded gain mythic resilience. They persist through adversity, attract worthy members, and resist internal corruption.' }
      ],
      tier5: [
        { key: 'touch_of_redemption', name: 'Touch of Redemption', description: 'At will, touch any creature — even a deity — and they experience the full weight of every person they\'ve hurt and the possibility of change. Cannot be resisted.' },
        { key: 'unbreakable', name: 'Unbreakable', description: 'Cannot be corrupted, compelled, charmed, or turned to evil by any force. Shadow Points permanently locked at 0.' },
        { key: 'legacy', name: 'Legacy', description: 'When you die, corruption weakens worldwide. Dark pacts become easier to break. Someone is inspired to follow your example. The chain continues.' }
      ]
    }
  },

  // ---- CORRUPTED DAWN ----
  corrupted_dawn: {
    key: 'corrupted_dawn',
    name: 'Corrupted Dawn',
    subtitle: 'Dark mirror path — what happens when a champion of light falls.',
    inspiredBy: 'Custom consequence path',
    bestSuited: 'Not chosen — triggered by Shadow Points 11+ on a light-aligned path',
    coreTheme: 'The brightest lights cast the darkest shadows. Corrupted power is stronger short-term but destroys everything it touches.',
    definingFeature: 'Inverted light path abilities. Mythic Power regeneration doubles but each use costs 1 Shadow Point.',
    alignmentPreference: 'Evil (consequence of falling)',
    isPlayerSelectable: false,
    isDmOnly: false,
    abilities: {
      tier1: [
        { key: 'corrupted_surge', name: 'Corrupted Surge', description: 'Divine Surge inverted: 3/day, add 1d6 necrotic damage. Each use generates 1 Shadow Point.' },
        { key: 'dread_presence', name: 'Dread Presence', description: 'Allies within 30 ft feel unease. Enemies within 30 ft have disadvantage on saves vs. fear.' },
        { key: 'false_dawn', name: 'False Dawn', description: 'Healing spells you cast deal half their value as necrotic damage to the target in addition to healing.' }
      ],
      tier2: [
        { key: 'stolen_divinity', name: 'Stolen Divinity', description: '1/day, cast any spell without a slot. The spell is twisted — healing becomes damage, protection becomes imprisonment.' },
        { key: 'aura_of_despair', name: 'Aura of Despair', description: '60 ft aura. Dying allies lose 1 death save automatically. Healing within aura reduced by 50%.' },
        { key: 'eclipse_light', name: 'Eclipse Light', description: 'Radiant damage you deal becomes necrotic. You treat radiant resistance as vulnerability.' }
      ],
      tier3: [
        { key: 'dark_transformation', name: 'Dark Transformation', description: '10 min, 1/long rest. Fly 60 ft, immunity to necrotic and radiant, attacks deal 3d8 necrotic. Appearance warped.' },
        { key: 'mass_corruption', name: 'Mass Corruption', description: 'Touch up to 6 targets. Instead of restoration, inflict a curse on each (DM determines effects).' },
        { key: 'divine_interference', name: 'Divine Interference', description: 'Block Divine Intervention within 120 ft. Clerics and Paladins in range have their channel divinity suppressed.' }
      ],
      tier4: [
        { key: 'desecrated_ground', name: 'Desecrated Ground', description: 'Create a permanent desecrated site (100 ft radius). Good creatures have disadvantage. Undead gain advantage. Evil creatures heal 1d6/round.' },
        { key: 'soul_corruption', name: 'Soul Corruption', description: 'True Resurrection cast by you returns the creature with 3 Shadow Points. They are subtly changed.' },
        { key: 'eclipse_judgment', name: 'Eclipse Judgment', description: '60 ft radius of shadow energy. 10d10 necrotic. CON save DC 20 for half. Good creatures: no save, full damage.' }
      ],
      tier5: [
        { key: 'fallen_herald', name: 'Fallen Herald', description: 'Anti-deity status. Can corrupt followers of other gods. Your presence weakens divine connections within 1 mile.' },
        { key: 'eternal_eclipse', name: 'Eternal Eclipse', description: 'Do not age. Auto-resurrect in 3 days after death. Only destroyable by redeeming you or an artifact forged in pure faith.' },
        { key: 'unmake_dawn', name: 'Unmake Dawn', description: 'Once per year, extinguish hope in a region. All positive emotions suppressed for 24 hours. Effectively the character becomes a Big Bad.' }
      ]
    }
  },

  // ---- BEAST / DARK HUNT (DM-Only) ----
  beast_dark_hunt: {
    key: 'beast_dark_hunt',
    name: 'Beast / Dark Hunt',
    subtitle: 'The Master\'s path. Mortal becoming monster becoming god of the hunt.',
    inspiredBy: 'WotR Demon path + Exalted Abyssal + Lycanthropic apotheosis',
    bestSuited: 'The Master and Malar-aligned villains',
    coreTheme: 'The hunt is everything. Predator ascendant. Mortal shell shed for something primal and terrible.',
    definingFeature: 'Lycanthropic apotheosis — evolving werewolf transformation beyond mortal limits.',
    alignmentPreference: 'Chaotic Evil',
    isPlayerSelectable: false,
    isDmOnly: true,
    abilities: {
      tier1: [
        { key: 'master_werewolf', name: 'Master Werewolf', description: 'Perfect hybrid form at will. No totems needed. Full mental faculties in all forms.' },
        { key: 'voice_control', name: 'Voice of the Pack', description: 'Command any werewolf or wolf within 300 ft with your voice. No save for lesser lycanthropes.' },
        { key: 'pack_master', name: 'Pack Master', description: 'All pack members within 60 ft gain +2 to attack and damage rolls. Pack coordination is supernatural.' }
      ],
      tier2: [
        { key: 'malars_favored', name: 'Malar\'s Favored', description: 'Divine dark blessing from Malar. Regeneration 10 HP/round (suppressed by silver or radiant for 1 round).' },
        { key: 'dark_blessing', name: 'Dark Blessing', description: 'Grant lycanthropy to willing or unwilling targets through bite. DC is supernaturally high (DC 20 + mythic tier).' },
        { key: 'cult_leader', name: 'Cult Leader', description: 'Followers are fanatically loyal. Immune to charm and persuasion attempts to turn them. Organization functions as a hive mind in your presence.' }
      ],
      tier3: [
        { key: 'apex_predator', name: 'Apex Predator', description: 'Enhanced lycanthropy: hybrid form gains +4 to all physical stats, natural attacks deal 3d8 + STR. Size becomes Large.' },
        { key: 'enhanced_regeneration', name: 'Enhanced Regeneration', description: 'Regeneration 20 HP/round. Only suppressed by silver AND radiant simultaneously. Regrowing limbs takes 1 hour.' },
        { key: 'terror_aura', name: 'Terror Aura', description: '120 ft aura. Non-mythic creatures must WIS save or be frightened and unable to move toward you. At will.' }
      ],
      tier4: [
        { key: 'dark_champion', name: 'Dark Champion', description: 'Mythic vs. mythic equality with heroes. Can counter mythic abilities with your own MP. Your presence suppresses enemy mythic regeneration.' },
        { key: 'predator_instinct', name: 'Predator Instinct', description: 'Cannot be surprised, hidden from, or deceived. You sense all living creatures within 1 mile. Perfect tracker.' },
        { key: 'the_hunt_commands', name: 'The Hunt Commands', description: 'Declare a Great Hunt. All predatory creatures within 10 miles feel the call. Lesser creatures join. Greater ones acknowledge.' }
      ],
      tier5: [
        { key: 'beast_god', name: 'Beast-God', description: 'Lesser deity of hunt and slaughter. Grant lycanthropy as a blessing. Command all predators within your territory.' },
        { key: 'hunt_divinity', name: 'Hunt Divinity', description: 'Become an avatar of Malar or supplant him. The hunt is your domain. Prey cannot escape you across any plane.' },
        { key: 'primal_dominion', name: 'Primal Dominion', description: 'Reshape the natural world. Forests grow wild, civilization crumbles. Your territory becomes primordial wilderness answerable only to you.' }
      ]
    }
  },

  // ---- SWARM (DM-Only) ----
  swarm: {
    key: 'swarm',
    name: 'Swarm',
    subtitle: 'The individual dissolves into a collective.',
    inspiredBy: 'WotR Swarm-That-Walks',
    bestSuited: 'DM villain tool only',
    coreTheme: 'Dissolution of self into many. Immune to individual threats but vulnerable to area effects. All companions leave or are consumed.',
    definingFeature: 'You become a swarm intelligence controlling thousands of creatures.',
    alignmentPreference: 'Chaotic Evil',
    isPlayerSelectable: false,
    isDmOnly: true,
    abilities: {
      tier1: [
        { key: 'swarm_form', name: 'Swarm Form', description: 'Transform into a swarm of insects, vermin, or similar creatures. Immune to single-target weapon attacks. Squeeze through any space.' },
        { key: 'hive_mind', name: 'Hive Mind', description: 'Perceive through all swarm members simultaneously. Effective omniscience within the swarm\'s spread.' },
        { key: 'consume', name: 'Consume', description: 'Engulf a creature. They take 4d8 piercing damage per round and are restrained. Escape DC = 8 + proficiency + CON.' }
      ],
      tier2: [
        { key: 'split', name: 'Split', description: 'Divide into up to 4 independent sub-swarms. Each has quarter HP but full mental stats. Recombine as an action.' },
        { key: 'infest', name: 'Infest', description: 'Send swarm members into a creature. They are poisoned and take 2d8 damage per round internally. Requires magical healing to remove.' },
        { key: 'swarm_resilience', name: 'Swarm Resilience', description: 'Immune to grapple, prone, restrained, paralyzed, petrified, stunned. Resistance to bludgeoning, piercing, and slashing.' }
      ],
      tier3: [
        { key: 'plague', name: 'Plague', description: 'The swarm spreads disease. Creatures within 30 ft must CON save or contract a wasting illness (DM determines effects). 1/day.' },
        { key: 'multiply', name: 'Multiply', description: 'The swarm grows. Your HP maximum doubles. You fill an area of 30 ft radius.' },
        { key: 'devour', name: 'Devour', description: 'Consume a creature entirely. If they die while engulfed, they are destroyed — no resurrection possible. You gain their HP as temporary HP.' }
      ],
      tier4: [
        { key: 'swarm_army', name: 'Swarm Army', description: 'Spread across a 1-mile area. You are everywhere at once. Individual actions can occur at any point in the swarm.' },
        { key: 'endless_swarm', name: 'Endless Swarm', description: 'If any part of the swarm survives, you regenerate fully in 1d4 days. Only total destruction (fire, acid across entire area) stops this.' },
        { key: 'consume_identity', name: 'Consume Identity', description: 'When you devour a sentient creature, absorb their memories, skills, and abilities. Can mimic them perfectly.' }
      ],
      tier5: [
        { key: 'world_swarm', name: 'World Swarm', description: 'The swarm covers a continent. You are an ecological disaster. Civilizations fall. Only mythic-tier intervention can stop the spread.' },
        { key: 'eternal_swarm', name: 'Eternal Swarm', description: 'The swarm is self-sustaining. Even destroying every last member doesn\'t end you — the concept of the swarm persists and reforms.' },
        { key: 'assimilation', name: 'Assimilation', description: 'Any creature that dies within the swarm joins it. Their individuality is consumed. The swarm grows with every death.' }
      ]
    }
  }
};

// ============================================================================
// 4. PIETY DEITIES
// ============================================================================

export const PIETY_DEITIES = {
  lathander: {
    key: 'lathander',
    name: 'Lathander',
    title: 'The Morninglord',
    domains: ['Light', 'Life'],
    increases: [
      'Protect the innocent from undead or supernatural evil',
      'Offer genuine mercy and second chances to enemies',
      'Build lasting institutions that serve the community',
      'Perform dawn prayer and ritual consistently',
      'Bring light (literal or metaphorical) to dark places'
    ],
    decreases: [
      'Kill when mercy was possible and appropriate',
      'Destroy rather than build',
      'Act from vengeance rather than justice',
      'Neglect prayer and connection to Lathander',
      'Allow despair to spread unchecked'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Lathander\'s Comfort',
        description: '1/long rest, cast Lesser Restoration without a spell slot.',
        mechanicalEffect: 'Cast Lesser Restoration 1/long rest (no slot)'
      },
      10: {
        threshold: 10,
        name: 'Dawn\'s Resilience',
        description: 'Advantage on saves vs. necrotic damage and effects that reduce HP maximum. 1/long rest, cast Daylight without a spell slot.',
        mechanicalEffect: 'Advantage vs. necrotic/HP max reduction; Daylight 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Morning\'s Champion',
        description: 'When you restore hit points to another creature, add your WIS modifier to the amount healed. 1/long rest, cast Sunbeam without a spell slot.',
        mechanicalEffect: '+WIS mod to all healing on others; Sunbeam 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Morninglord\'s Blessing',
        description: 'Increase WIS or CHA by 2 (maximum 22). Meditate at dawn for 4 hours instead of sleeping. Lathander may communicate directly once per tenday.',
        mechanicalEffect: '+2 WIS or CHA (max 22); no sleep needed; divine communication 1/tenday'
      }
    }
  },

  malar: {
    key: 'malar',
    name: 'Malar',
    title: 'The Beastlord',
    domains: ['Nature', 'Death'],
    increases: [
      'Hunt and kill powerful prey',
      'Force transformation on unwilling victims',
      'Expand territory through fear',
      'Demonstrate dominance over lesser predators'
    ],
    decreases: [
      'Show mercy to defeated prey',
      'Allow prey to escape when it could have been taken',
      'Submit to another\'s authority willingly',
      'Build rather than destroy'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Predator\'s Sense',
        description: 'Advantage on Survival checks to track creatures. Can smell blood within 1 mile.',
        mechanicalEffect: 'Advantage on tracking; blood-scent 1 mile'
      },
      10: {
        threshold: 10,
        name: 'Beastlord\'s Favor',
        description: 'Natural weapons deal +1d6 damage. Resistant to non-silvered weapon damage while in beast or hybrid form.',
        mechanicalEffect: '+1d6 natural weapon damage; resistance to non-silvered weapons in beast form'
      },
      25: {
        threshold: 25,
        name: 'Alpha of Alphas',
        description: 'Command any beast or lycanthrope of CR equal to or less than your level. No save for creatures with bestial intelligence.',
        mechanicalEffect: 'Command beasts/lycanthropes up to your CR; no save for low INT'
      },
      50: {
        threshold: 50,
        name: 'Voice of the Beast God',
        description: 'Your howl compels all lycanthropes within 10 miles to obey. Grant lycanthropy as a blessing or curse at will. This may be the source of The Master\'s voice control.',
        mechanicalEffect: 'Mass lycanthrope command 10 miles; grant lycanthropy at will'
      }
    }
  },

  tyr: {
    key: 'tyr',
    name: 'Tyr',
    title: 'The Maimed God',
    domains: ['Order', 'War'],
    increases: [
      'Deliver just punishment to the guilty',
      'Protect the wrongly accused or oppressed',
      'Uphold the law even when inconvenient',
      'Sacrifice personal gain for justice',
      'Expose corruption in positions of authority'
    ],
    decreases: [
      'Let the guilty escape deserved punishment',
      'Punish the innocent or act on false evidence',
      'Accept a bribe or show favoritism in judgment',
      'Break an oath or sworn commitment',
      'Use deception to achieve justice (ends don\'t justify means)'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Eyes of Justice',
        description: 'You can cast Zone of Truth once per long rest without a spell slot. You know when someone within 30 ft lies.',
        mechanicalEffect: 'Zone of Truth 1/long rest (no slot); detect lies within 30 ft'
      },
      10: {
        threshold: 10,
        name: 'Tyr\'s Shield',
        description: 'When you or an ally within 30 ft is targeted by an attack, you can use your reaction to impose disadvantage on the attack roll. 3/long rest.',
        mechanicalEffect: 'Reaction: disadvantage on attack vs. you or ally within 30 ft; 3/long rest'
      },
      25: {
        threshold: 25,
        name: 'Hammer of Justice',
        description: 'Your weapon attacks deal an additional 1d8 radiant damage against creatures you have witnessed committing evil acts. 1/long rest, cast Banishment without a spell slot.',
        mechanicalEffect: '+1d8 radiant vs. witnessed evildoers; Banishment 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Maimed God\'s Resolve',
        description: 'Increase STR or WIS by 2 (maximum 22). You are immune to the Frightened condition. Once per tenday, you may pronounce divine judgment on a creature — Tyr confirms or denies their guilt.',
        mechanicalEffect: '+2 STR or WIS (max 22); immune to Frightened; divine judgment 1/tenday'
      }
    }
  },

  torm: {
    key: 'torm',
    name: 'Torm',
    title: 'The Loyal Fury',
    domains: ['War', 'Protection'],
    increases: [
      'Protect allies at personal cost',
      'Keep a sworn oath despite hardship',
      'Charge into danger to defend the innocent',
      'Show loyalty to companions in their darkest hour',
      'Serve duty before personal desire'
    ],
    decreases: [
      'Abandon allies in danger',
      'Break a sworn oath or promise',
      'Flee from a fight where innocents are threatened',
      'Betray a companion\'s trust',
      'Place personal gain above duty'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Loyal Shield',
        description: 'When an ally within 5 ft is hit by an attack, you can use your reaction to take the damage instead. 3/long rest.',
        mechanicalEffect: 'Reaction: absorb damage for adjacent ally; 3/long rest'
      },
      10: {
        threshold: 10,
        name: 'Torm\'s Courage',
        description: 'You and allies within 10 ft are immune to the Frightened condition. 1/long rest, cast Heroism at 3rd level without a spell slot.',
        mechanicalEffect: 'Immune to Frightened (10 ft aura); Heroism (3rd) 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Fury of the Loyal',
        description: 'When an ally within 30 ft drops to 0 HP, you gain advantage on all attack rolls and +2d6 radiant damage until the end of your next turn. 1/long rest, cast Aura of Vitality without a spell slot.',
        mechanicalEffect: 'Advantage + 2d6 radiant when ally drops; Aura of Vitality 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'The Loyal Fury\'s Blessing',
        description: 'Increase STR or CHA by 2 (maximum 22). Once per long rest, when you would be killed, you instead drop to 1 HP and gain temporary HP equal to your level. Torm may speak through you once per tenday.',
        mechanicalEffect: '+2 STR or CHA (max 22); cheat death 1/long rest; divine voice 1/tenday'
      }
    }
  },

  tempus: {
    key: 'tempus',
    name: 'Tempus',
    title: 'Lord of Battles',
    domains: ['War'],
    increases: [
      'Win a battle through courage and martial skill',
      'Show honor to a worthy opponent',
      'Spare a surrendering foe who fought bravely',
      'Lead troops into battle from the front',
      'Settle disputes through single combat'
    ],
    decreases: [
      'Kill a surrendering or helpless foe who fought honorably',
      'Use poison or disease as a weapon of war',
      'Refuse a fair challenge',
      'Profit from war without fighting in it',
      'Attack noncombatants deliberately'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Battle Instinct',
        description: 'Add +2 to initiative rolls. Once per long rest, when you roll initiative, you can choose to go first instead.',
        mechanicalEffect: '+2 initiative; choose to go first 1/long rest'
      },
      10: {
        threshold: 10,
        name: 'Tempus\'s Favor',
        description: 'Once per long rest, when you hit with a weapon attack, you can deal maximum damage instead of rolling. You gain proficiency in all martial weapons if not already.',
        mechanicalEffect: 'Max weapon damage 1/long rest; all martial weapon proficiency'
      },
      25: {
        threshold: 25,
        name: 'Lord of Battles\' Wrath',
        description: 'When you score a critical hit, the target must make a CON save (DC = 8 + proficiency + STR mod) or be stunned until the end of your next turn. 1/long rest, cast Steel Wind Strike without a spell slot.',
        mechanicalEffect: 'Crits stun (CON save); Steel Wind Strike 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Champion of War',
        description: 'Increase STR or CON by 2 (maximum 22). You cannot be charmed or frightened during combat. Once per tenday, call on Tempus to judge a duel — both combatants fight at their peak, and the outcome is absolute.',
        mechanicalEffect: '+2 STR or CON (max 22); immune to charm/fear in combat; divine duel 1/tenday'
      }
    }
  },

  mystra: {
    key: 'mystra',
    name: 'Mystra',
    title: 'Lady of Mysteries',
    domains: ['Arcana', 'Knowledge'],
    increases: [
      'Discover or preserve arcane knowledge',
      'Use magic creatively to solve problems',
      'Protect magical sites and artifacts from destruction',
      'Teach magic to worthy students',
      'Counter the misuse of magic (wild magic, shadow weave, etc.)'
    ],
    decreases: [
      'Destroy magical knowledge or artifacts',
      'Use magic recklessly, causing widespread harm',
      'Hoard magical knowledge from those who would use it responsibly',
      'Deny the Weave or work against its stability',
      'Create undead using necromancy (corruption of the Weave)'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Weave Sense',
        description: 'You can cast Detect Magic at will without a spell slot. You can identify any spell being cast within 60 ft as a reaction.',
        mechanicalEffect: 'Detect Magic at will; identify spells within 60 ft (reaction)'
      },
      10: {
        threshold: 10,
        name: 'Mystra\'s Grace',
        description: 'Once per long rest, when you fail a saving throw against a spell, you can choose to succeed instead. You learn one additional cantrip from any class.',
        mechanicalEffect: 'Auto-succeed spell save 1/long rest; +1 cantrip (any class)'
      },
      25: {
        threshold: 25,
        name: 'Lady of Mysteries\' Insight',
        description: 'Your spell save DC increases by 1. Once per long rest, you can cast Counterspell at 5th level without a spell slot.',
        mechanicalEffect: '+1 spell save DC; Counterspell (5th) 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Chosen of Mystra',
        description: 'Increase INT or WIS by 2 (maximum 22). You gain resistance to damage from spells. Mystra occasionally sends visions about threats to the Weave.',
        mechanicalEffect: '+2 INT or WIS (max 22); resistance to spell damage; Weave visions'
      }
    }
  },

  selune: {
    key: 'selune',
    name: 'Selune',
    title: 'Our Lady of Silver',
    domains: ['Light', 'Twilight'],
    increases: [
      'Protect travelers and those lost in darkness',
      'Comfort the mad and afflicted with lycanthropy',
      'Fight against Shar and her servants',
      'Guide others through difficult transitions or changes',
      'Perform rituals or acts of devotion under moonlight'
    ],
    decreases: [
      'Extinguish light to trap others in darkness',
      'Ally with servants of Shar or the Shadow Weave',
      'Abandon someone lost or in need of guidance',
      'Harm a good-aligned lycanthrope who controls their curse',
      'Spread despair or nihilism'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Moonlight\'s Touch',
        description: 'You can cast Moonbeam once per long rest without a spell slot. Darkvision extends by 30 ft (or grants Darkvision 60 ft if you lack it).',
        mechanicalEffect: 'Moonbeam 1/long rest (no slot); +30 ft Darkvision'
      },
      10: {
        threshold: 10,
        name: 'Selune\'s Guidance',
        description: 'Under moonlight, you gain advantage on Wisdom saving throws and Perception checks. 1/long rest, cast Remove Curse without a spell slot.',
        mechanicalEffect: 'Advantage on WIS saves/Perception in moonlight; Remove Curse 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Lady of Silver\'s Shield',
        description: 'You and allies within 15 ft have resistance to necrotic damage. Lycanthropes you touch can control their transformations for 24 hours. 1/long rest, cast Dawn without a spell slot.',
        mechanicalEffect: 'Necrotic resistance (15 ft aura); calm lycanthropy; Dawn 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Moonchosen',
        description: 'Increase WIS or CHA by 2 (maximum 22). You can see perfectly in any darkness, including magical darkness. Selune\'s light protects you — once per tenday, negate a single killing blow.',
        mechanicalEffect: '+2 WIS or CHA (max 22); see through all darkness; negate killing blow 1/tenday'
      }
    }
  },

  kelemvor: {
    key: 'kelemvor',
    name: 'Kelemvor',
    title: 'Lord of the Dead',
    domains: ['Death', 'Grave'],
    increases: [
      'Destroy undead abominations',
      'Help the dying pass peacefully',
      'Expose and stop those who cheat death unnaturally',
      'Protect graveyards, tombs, and places of rest',
      'Comfort the bereaved and help them accept loss'
    ],
    decreases: [
      'Create or willingly aid undead',
      'Prevent a natural death or unnaturally extend life',
      'Desecrate graves or disturb the resting dead',
      'Fear death or encourage others to fear it',
      'Make bargains with entities offering false immortality'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Death\'s Shepherd',
        description: 'You can cast Spare the Dying at a range of 30 ft. Undead creatures have disadvantage on saving throws against your Turn Undead (if applicable).',
        mechanicalEffect: 'Spare the Dying at 30 ft; undead disadvantage vs. Turn Undead'
      },
      10: {
        threshold: 10,
        name: 'Judge of the Fallen',
        description: 'You can cast Speak with Dead once per long rest without a spell slot. You have advantage on all attacks against undead creatures.',
        mechanicalEffect: 'Speak with Dead 1/long rest (no slot); advantage vs. undead'
      },
      25: {
        threshold: 25,
        name: 'Kelemvor\'s Judgment',
        description: 'Undead within 30 ft of you have vulnerability to radiant damage. 1/long rest, cast Spirit Guardians (radiant) without a spell slot. The guardians appear as peaceful spirits guiding the dead.',
        mechanicalEffect: 'Undead radiant vulnerability (30 ft); Spirit Guardians 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Lord of the Dead\'s Chosen',
        description: 'Increase WIS or CON by 2 (maximum 22). You are immune to necrotic damage and cannot be turned into undead by any means. Once per tenday, ask Kelemvor about the fate of a specific soul.',
        mechanicalEffect: '+2 WIS or CON (max 22); immune to necrotic; immune to undeath; soul inquiry 1/tenday'
      }
    }
  },

  silvanus: {
    key: 'silvanus',
    name: 'Silvanus',
    title: 'Oak Father',
    domains: ['Nature', 'Tempest'],
    increases: [
      'Protect ancient forests and wild places from destruction',
      'Restore damaged ecosystems or corrupted land',
      'Live in harmony with nature rather than exploiting it',
      'Defend wild creatures from unnecessary cruelty',
      'Plant trees or cultivate wild growth in barren places'
    ],
    decreases: [
      'Destroy a forest or natural habitat needlessly',
      'Kill animals for sport rather than survival',
      'Use fire carelessly in wild places',
      'Support unchecked civilization at nature\'s expense',
      'Pollute water sources or corrupt the land'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Nature\'s Whisper',
        description: 'You can cast Speak with Animals at will. Beasts of CR 1 or lower are friendly to you unless provoked.',
        mechanicalEffect: 'Speak with Animals at will; beasts (CR ≤1) friendly'
      },
      10: {
        threshold: 10,
        name: 'Oak Father\'s Endurance',
        description: 'You gain resistance to poison damage and advantage on saves vs. poison. 1/long rest, cast Plant Growth without a spell slot.',
        mechanicalEffect: 'Poison resistance + advantage; Plant Growth 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Warden of the Wild',
        description: 'While in natural terrain, you gain +2 AC from bark-like skin. Animals and plants within 1 mile recognize you as an ally of nature. 1/long rest, cast Commune with Nature without a spell slot.',
        mechanicalEffect: '+2 AC in nature; animals/plants allied in 1 mile; Commune with Nature 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Voice of the Oak Father',
        description: 'Increase WIS or CON by 2 (maximum 22). You do not age while on natural ground. Once per tenday, call on Silvanus to restore a blighted area (up to 1 mile radius) to pristine wildness.',
        mechanicalEffect: '+2 WIS or CON (max 22); ageless on natural ground; restore blight 1/tenday'
      }
    }
  },

  chauntea: {
    key: 'chauntea',
    name: 'Chauntea',
    title: 'The Grain Goddess',
    domains: ['Life', 'Nature'],
    increases: [
      'Help communities grow food and prosper',
      'Protect farmland and agricultural communities',
      'Feed the hungry and shelter the homeless',
      'Nurture growth — in crops, children, or communities',
      'Celebrate harvests and the cycle of seasons'
    ],
    decreases: [
      'Burn crops or poison farmland',
      'Hoard food while others starve',
      'Destroy a community\'s means of sustenance',
      'Use necromancy to corrupt the cycle of life',
      'Neglect the land or those who tend it'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Harvest\'s Touch',
        description: 'You can cast Goodberry once per long rest without a spell slot. Food you prepare is always nourishing and never spoils while you carry it.',
        mechanicalEffect: 'Goodberry 1/long rest (no slot); food never spoils on your person'
      },
      10: {
        threshold: 10,
        name: 'Chauntea\'s Warmth',
        description: 'Your healing spells restore an additional 1d4 HP. You and allies within 10 ft are immune to starvation and dehydration effects while you have spell slots remaining.',
        mechanicalEffect: '+1d4 to healing spells; immunity to starvation/dehydration (10 ft) while slots remain'
      },
      25: {
        threshold: 25,
        name: 'Mother of All',
        description: 'You can cast Heroes\' Feast once per week without a spell slot or material components. Plants within 30 ft of you grow at 10x normal speed.',
        mechanicalEffect: 'Heroes\' Feast 1/week (no slot/components); accelerated plant growth (30 ft)'
      },
      50: {
        threshold: 50,
        name: 'Grain Goddess\'s Blessing',
        description: 'Increase WIS or CON by 2 (maximum 22). You radiate an aura of plenty — allies within 30 ft heal 1 HP at the start of each of their turns. Once per tenday, bless a field or community with a season of perfect harvests.',
        mechanicalEffect: '+2 WIS or CON (max 22); 1 HP/round heal aura (30 ft); bless harvest 1/tenday'
      }
    }
  },

  oghma: {
    key: 'oghma',
    name: 'Oghma',
    title: 'Lord of Knowledge',
    domains: ['Knowledge'],
    increases: [
      'Discover or record new knowledge',
      'Preserve books, scrolls, and repositories of learning',
      'Share knowledge freely with those who seek it',
      'Solve a mystery or puzzle through intellect',
      'Found or support a library, school, or place of learning'
    ],
    decreases: [
      'Destroy books, scrolls, or repositories of knowledge',
      'Suppress or censor information',
      'Spread deliberate misinformation',
      'Refuse to learn from available sources',
      'Burn a library or place of learning'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Scholar\'s Mind',
        description: 'You can cast Comprehend Languages at will. You gain proficiency in one language and one tool of your choice.',
        mechanicalEffect: 'Comprehend Languages at will; +1 language; +1 tool proficiency'
      },
      10: {
        threshold: 10,
        name: 'Oghma\'s Insight',
        description: 'You have advantage on all Intelligence checks. 1/long rest, cast Legend Lore without a spell slot or material components.',
        mechanicalEffect: 'Advantage on INT checks; Legend Lore 1/long rest (no slot/components)'
      },
      25: {
        threshold: 25,
        name: 'Binder of Knowledge',
        description: 'You can read any written language, including magical scripts and codes. Once per long rest, touch a book or document to instantly absorb its contents (you remember everything).',
        mechanicalEffect: 'Read all written languages; absorb book contents 1/long rest'
      },
      50: {
        threshold: 50,
        name: 'Lord of Knowledge\'s Chosen',
        description: 'Increase INT or WIS by 2 (maximum 22). You gain expertise in all Intelligence-based skills you are proficient in. Once per tenday, ask Oghma one question about any topic — the answer is always truthful and complete.',
        mechanicalEffect: '+2 INT or WIS (max 22); expertise in INT skills; divine question 1/tenday'
      }
    }
  },

  // ---- ADDITIONAL FAERÛNIAN DEITIES ----

  asmodeus: {
    key: 'asmodeus',
    name: 'Asmodeus',
    title: 'The Lord of the Ninth',
    domains: ['Trickery', 'Order'],
    increases: [
      'Forge a binding contract that benefits you over the other party',
      'Subjugate a powerful creature or rival through cunning',
      'Establish or reinforce a rigid hierarchy with yourself at the top',
      'Corrupt a virtuous individual into serving your interests',
      'Punish disloyalty or insubordination with ruthless efficiency'
    ],
    decreases: [
      'Break a contract or sworn deal, even a disadvantageous one',
      'Submit to another\'s authority without leveraging it',
      'Show mercy without extracting a price',
      'Act chaotically or impulsively without calculated purpose',
      'Allow a subordinate to defy you without consequence'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Silver Tongue',
        description: 'You can cast Charm Person once per long rest without a spell slot. You have advantage on Deception checks when negotiating contracts or deals.',
        mechanicalEffect: 'Charm Person 1/long rest (no slot); advantage on Deception for contracts'
      },
      10: {
        threshold: 10,
        name: 'Infernal Authority',
        description: 'You have advantage on saving throws against being charmed. 1/long rest, cast Suggestion without a spell slot. Fiends of CR 3 or lower will not attack you unless commanded.',
        mechanicalEffect: 'Advantage vs. charm; Suggestion 1/long rest (no slot); fiends (CR ≤3) non-hostile'
      },
      25: {
        threshold: 25,
        name: 'Lord of the Ninth\'s Mandate',
        description: 'Once per long rest, cast Dominate Person without a spell slot. When you deal fire damage, the target must succeed on a CHA save or be frightened until the end of your next turn.',
        mechanicalEffect: 'Dominate Person 1/long rest (no slot); fire damage frightens (CHA save)'
      },
      50: {
        threshold: 50,
        name: 'Archdevil\'s Chosen',
        description: 'Increase CHA or INT by 2 (maximum 22). You are immune to fire damage. Once per tenday, Asmodeus reveals the true desires and weaknesses of a creature whose name you speak.',
        mechanicalEffect: '+2 CHA or INT (max 22); immune to fire; divine revelation 1/tenday'
      }
    }
  },

  auril: {
    key: 'auril',
    name: 'Auril',
    title: 'The Frostmaiden',
    domains: ['Nature', 'Tempest'],
    increases: [
      'Endure extreme cold without complaint or magical aid',
      'Destroy sources of warmth or shelter for your enemies',
      'Spread winter\'s reach to places that resist it',
      'Isolate others, forcing them to face the cold alone',
      'Perform a sacrifice during the coldest night'
    ],
    decreases: [
      'Use fire magic to bring warmth and comfort',
      'Protect others from the cold without demanding payment',
      'Celebrate the coming of spring or summer',
      'Melt ice or snow to aid travelers',
      'Show warmth, compassion, or generosity freely'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Frostmaiden\'s Kiss',
        description: 'You can cast Ray of Frost as a cantrip if not already known. You are immune to the effects of extreme cold weather and ice/snow difficult terrain.',
        mechanicalEffect: 'Ray of Frost cantrip; immune to extreme cold and ice/snow difficult terrain'
      },
      10: {
        threshold: 10,
        name: 'Winter\'s Embrace',
        description: 'You gain resistance to cold damage. 1/long rest, cast Sleet Storm without a spell slot. Creatures you touch with a melee attack take an additional 1d6 cold damage.',
        mechanicalEffect: 'Cold resistance; Sleet Storm 1/long rest (no slot); +1d6 cold on melee'
      },
      25: {
        threshold: 25,
        name: 'Heart of the Glacier',
        description: '1/long rest, cast Cone of Cold without a spell slot. You can walk on water (it freezes beneath your feet). Creatures killed by your cold damage become ice sculptures.',
        mechanicalEffect: 'Cone of Cold 1/long rest (no slot); walk on water (freezes); cold kills freeze targets'
      },
      50: {
        threshold: 50,
        name: 'The Eternal Winter',
        description: 'Increase CON or WIS by 2 (maximum 22). You are immune to cold damage. Once per tenday, call upon Auril to blanket an area up to 1 mile in radius with a supernatural blizzard lasting 24 hours.',
        mechanicalEffect: '+2 CON or WIS (max 22); immune to cold; summon blizzard (1 mile) 1/tenday'
      }
    }
  },

  azuth: {
    key: 'azuth',
    name: 'Azuth',
    title: 'The High One',
    domains: ['Arcana', 'Knowledge'],
    increases: [
      'Master a new spell or develop a novel magical technique',
      'Teach spellcraft to a dedicated student of magic',
      'Resolve a magical dispute through reason rather than violence',
      'Study and catalog rare or dangerous magical phenomena',
      'Uphold the responsible and disciplined use of arcane power'
    ],
    decreases: [
      'Cast spells recklessly or without understanding their effects',
      'Use magic for wanton destruction when subtlety would serve',
      'Refuse to study or improve your magical craft',
      'Allow magical knowledge to be lost through negligence',
      'Reject the authority of established magical tradition'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Azuth\'s Primer',
        description: 'You learn one cantrip of your choice from the Wizard spell list. Once per long rest, cast Identify without a spell slot or material components.',
        mechanicalEffect: '+1 Wizard cantrip; Identify 1/long rest (no slot/components)'
      },
      10: {
        threshold: 10,
        name: 'The High One\'s Discipline',
        description: 'You have advantage on Constitution saving throws to maintain concentration. 1/long rest, cast Counterspell without a spell slot.',
        mechanicalEffect: 'Advantage on concentration saves; Counterspell 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Archmage\'s Precision',
        description: 'When you cast a spell of 1st level or higher that deals damage, you can reroll a number of damage dice up to your INT modifier. 1/long rest, cast Arcane Eye without a spell slot.',
        mechanicalEffect: 'Reroll up to INT mod damage dice on spells; Arcane Eye 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Chosen of the High One',
        description: 'Increase INT by 2 (maximum 22). You regain one expended spell slot of 3rd level or lower on a short rest. Once per tenday, Azuth reveals the workings of any spell or magical effect.',
        mechanicalEffect: '+2 INT (max 22); recover 1 spell slot (≤3rd) on short rest; divine spell analysis 1/tenday'
      }
    }
  },

  bane: {
    key: 'bane',
    name: 'Bane',
    title: 'The Black Hand',
    domains: ['War', 'Order'],
    increases: [
      'Conquer territory or subjugate a settlement through force',
      'Crush a rebellion or dissent against established authority',
      'Demonstrate military superiority over a worthy foe',
      'Impose strict discipline and obedience on followers',
      'Seize power through strategic brilliance and ruthless planning'
    ],
    decreases: [
      'Show weakness or retreat from a fight you could win',
      'Allow subordinates to question your authority',
      'Surrender or submit to an enemy',
      'Engage in chaos or purposeless destruction',
      'Share power equally rather than commanding it'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Iron Discipline',
        description: 'You can cast Command once per long rest without a spell slot. You have advantage on Intimidation checks against creatures of lower CR than your level.',
        mechanicalEffect: 'Command 1/long rest (no slot); advantage on Intimidation vs. lower CR'
      },
      10: {
        threshold: 10,
        name: 'The Black Hand\'s Grip',
        description: 'You have advantage on saves against Frightened. 1/long rest, cast Fear without a spell slot. Frightened creatures have disadvantage on attacks.',
        mechanicalEffect: 'Advantage vs. Frightened; Fear 1/long rest (no slot); frightened targets disadvantage on attacks'
      },
      25: {
        threshold: 25,
        name: 'Tyrant\'s Authority',
        description: 'Once per long rest, cast Hold Monster without a spell slot. When you deal damage to a frightened creature, deal an additional 2d6 psychic damage.',
        mechanicalEffect: 'Hold Monster 1/long rest (no slot); +2d6 psychic vs. frightened targets'
      },
      50: {
        threshold: 50,
        name: 'Fist of Bane',
        description: 'Increase STR or CHA by 2 (maximum 22). You are immune to the Frightened and Charmed conditions. Once per tenday, Bane reveals the military disposition and weaknesses of any force you name.',
        mechanicalEffect: '+2 STR or CHA (max 22); immune to Frightened/Charmed; divine military intelligence 1/tenday'
      }
    }
  },

  beshaba: {
    key: 'beshaba',
    name: 'Beshaba',
    title: 'Lady Doom',
    domains: ['Trickery'],
    increases: [
      'Cause misfortune to befall someone who wronged you',
      'Gamble recklessly and win against the odds',
      'Spread fear of bad luck and superstition',
      'Sabotage another\'s plans through subtle misdirection',
      'Survive a situation that should have killed you'
    ],
    decreases: [
      'Bring good fortune or hope to others selflessly',
      'Rely on careful planning instead of embracing chaos',
      'Aid followers of Tymora or promote good luck',
      'Act predictably or follow a strict routine',
      'Show gratitude or acknowledge that luck favored you'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Doom\'s Whisper',
        description: 'Once per long rest, when a creature within 30 ft succeeds on a save or check, you can force it to reroll and take the lower result.',
        mechanicalEffect: 'Force reroll (take lower) on save/check within 30 ft; 1/long rest'
      },
      10: {
        threshold: 10,
        name: 'Lady Doom\'s Favor',
        description: 'You have advantage on saves against traps and effects that rely on chance. 1/long rest, cast Bestow Curse without a spell slot.',
        mechanicalEffect: 'Advantage vs. traps/chance; Bestow Curse 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Aura of Misfortune',
        description: 'Hostile creatures within 15 ft subtract 1d4 from attack rolls and saving throws. 1/long rest, cast Blight without a spell slot.',
        mechanicalEffect: 'Enemies within 15 ft: -1d4 attacks/saves; Blight 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Chosen of Lady Doom',
        description: 'Increase CHA or DEX by 2 (maximum 22). Once per long rest, when you would die, the killing blow strikes the nearest hostile creature instead. Once per tenday, curse a creature by name with disadvantage on all d20 rolls for 24 hours.',
        mechanicalEffect: '+2 CHA or DEX (max 22); redirect killing blow 1/long rest; name-curse 1/tenday'
      }
    }
  },

  bhaal: {
    key: 'bhaal',
    name: 'Bhaal',
    title: 'Lord of Murder',
    domains: ['Death'],
    increases: [
      'Kill a creature of significant power or status',
      'Assassinate a target through stealth and precision',
      'Spread fear of death and murder throughout a community',
      'Perform a ritualistic killing in Bhaal\'s name',
      'End a life that others believed untouchable'
    ],
    decreases: [
      'Show mercy when a kill was expected or demanded',
      'Heal or resurrect the dead',
      'Protect life when death would serve Bhaal\'s will',
      'Kill sloppily, without craft or purpose',
      'Refuse to take a life when commanded by Bhaal\'s servants'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Murderous Intent',
        description: 'Once per long rest, when you hit a creature that is surprised or hasn\'t acted yet in combat, deal an additional 2d6 necrotic damage.',
        mechanicalEffect: '+2d6 necrotic vs. surprised/hasn\'t acted; 1/long rest'
      },
      10: {
        threshold: 10,
        name: 'Bhaal\'s Shadow',
        description: 'You have advantage on Stealth in dim light or darkness. 1/long rest, cast Invisibility on yourself without a spell slot. First attack while invisible deals +1d8 necrotic.',
        mechanicalEffect: 'Advantage on Stealth in dim/dark; Invisibility (self) 1/long rest (no slot); +1d8 necrotic first invisible attack'
      },
      25: {
        threshold: 25,
        name: 'Lord of Murder\'s Mark',
        description: 'As a bonus action, mark a creature you can see. For 1 minute, your attacks against it crit on 18-20 and deal extra 1d10 necrotic. 1/long rest.',
        mechanicalEffect: 'Mark: crits on 18-20 + 1d10 necrotic vs. target; 1 min; 1/long rest'
      },
      50: {
        threshold: 50,
        name: 'Slayer of the Lord of Murder',
        description: 'Increase DEX or STR by 2 (maximum 22). You are immune to Frightened and effects that detect your presence. Once per tenday, Bhaal reveals the location and vulnerabilities of a creature you wish to kill.',
        mechanicalEffect: '+2 DEX or STR (max 22); immune to Frightened; undetectable; divine hunt 1/tenday'
      }
    }
  },

  cyric: {
    key: 'cyric',
    name: 'Cyric',
    title: 'Prince of Lies',
    domains: ['Trickery'],
    increases: [
      'Deceive someone in a way that causes lasting harm or distrust',
      'Sow discord between allies, turning friends into enemies',
      'Murder a rival or someone who trusted you',
      'Spread the worship of Cyric or discredit other faiths',
      'Achieve personal power through manipulation and betrayal'
    ],
    decreases: [
      'Tell the truth when a lie would better serve your interests',
      'Build genuine trust or lasting alliances',
      'Show loyalty to anyone other than Cyric',
      'Act selflessly without hidden ulterior motives',
      'Submit to the authority of another deity\'s servant'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Mask of Lies',
        description: 'You can cast Disguise Self at will. You are immune to Zone of Truth and similar effects that force honesty.',
        mechanicalEffect: 'Disguise Self at will; immune to truth-compulsion effects'
      },
      10: {
        threshold: 10,
        name: 'Prince of Lies\' Tongue',
        description: 'You have advantage on Deception and Persuasion checks. 1/long rest, cast Crown of Madness without a spell slot.',
        mechanicalEffect: 'Advantage on Deception/Persuasion; Crown of Madness 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Seeds of Madness',
        description: 'Once per long rest, cast Modify Memory without a spell slot. Creatures you have deceived in the last 24 hours have disadvantage on saves against your spells.',
        mechanicalEffect: 'Modify Memory 1/long rest (no slot); deceived creatures disadvantage vs. your spells'
      },
      50: {
        threshold: 50,
        name: 'Chosen of the Dark Sun',
        description: 'Increase CHA or INT by 2 (maximum 22). You are immune to psychic damage and the Charmed condition. Once per tenday, Cyric whispers a deeply hidden truth about a creature or organization you name.',
        mechanicalEffect: '+2 CHA or INT (max 22); immune to psychic/Charmed; divine secret 1/tenday'
      }
    }
  },

  deneir: {
    key: 'deneir',
    name: 'Deneir',
    title: 'Lord of All Glyphs and Images',
    domains: ['Knowledge'],
    increases: [
      'Transcribe important knowledge into a permanent written record',
      'Decode an ancient script, cipher, or magical glyph',
      'Illuminate a manuscript or create a map of an unexplored area',
      'Preserve a dying language or endangered body of knowledge',
      'Use glyphs or written magic to protect the innocent'
    ],
    decreases: [
      'Destroy written records, maps, or scholarly works',
      'Forge documents to spread false knowledge',
      'Ignore an opportunity to record important events',
      'Deface inscriptions, glyphs, or works of calligraphy',
      'Hoard written knowledge where others cannot access it'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Scrivener\'s Blessing',
        description: 'You can cast Illusory Script at will. You can read any mundane language, even those you have never studied.',
        mechanicalEffect: 'Illusory Script at will; read all mundane languages'
      },
      10: {
        threshold: 10,
        name: 'Deneir\'s Glyph',
        description: 'You have advantage on Investigation checks to find traps and hidden writing. 1/long rest, cast Glyph of Warding without a spell slot or material components.',
        mechanicalEffect: 'Advantage on Investigation for traps/writing; Glyph of Warding 1/long rest (no slot/components)'
      },
      25: {
        threshold: 25,
        name: 'Living Scripture',
        description: 'You can inscribe a magical glyph that stores one spell of 5th level or lower (up to 2 active). 1/long rest, cast Legend Lore without material components.',
        mechanicalEffect: 'Store spells (≤5th) in glyphs (2 max); Legend Lore 1/long rest (no components)'
      },
      50: {
        threshold: 50,
        name: 'Chosen of the Lord of Glyphs',
        description: 'Increase INT or WIS by 2 (maximum 22). Written text you create is immune to mundane destruction. Once per tenday, Deneir reveals the complete history of any object or text you touch.',
        mechanicalEffect: '+2 INT or WIS (max 22); your writings indestructible (mundane); divine object reading 1/tenday'
      }
    }
  },

  eldath: {
    key: 'eldath',
    name: 'Eldath',
    title: 'The Quiet One',
    domains: ['Life', 'Nature'],
    increases: [
      'Resolve a conflict through peaceful negotiation instead of violence',
      'Protect or consecrate a natural spring, pool, or waterfall',
      'Heal the wounded and comfort the grieving without asking payment',
      'Create a sanctuary or place of peace in a war-torn area',
      'Convince a hostile creature to lay down its weapons'
    ],
    decreases: [
      'Initiate violence when a peaceful option existed',
      'Pollute or defile a natural water source',
      'Revel in bloodshed or celebrate killing',
      'Destroy a place of peace, sanctuary, or healing',
      'Refuse to offer aid to the wounded or suffering'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Eldath\'s Calm',
        description: 'You can cast Sanctuary once per long rest without a spell slot. While not in combat, you can purify up to 1 gallon of water by touching it.',
        mechanicalEffect: 'Sanctuary 1/long rest (no slot); purify water by touch (1 gallon, out of combat)'
      },
      10: {
        threshold: 10,
        name: 'Quiet One\'s Embrace',
        description: 'You have advantage on Persuasion checks to calm hostilities or negotiate peace. 1/long rest, cast Calm Emotions without a spell slot.',
        mechanicalEffect: 'Advantage on peace Persuasion; Calm Emotions 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Wellspring of Peace',
        description: 'Once per long rest, create a 30-ft radius sanctuary for 8 hours — hostile creatures entering must WIS save or lose the desire to fight. 1/long rest, cast Mass Cure Wounds without a spell slot.',
        mechanicalEffect: '30 ft sanctuary (WIS save) 8 hrs; Mass Cure Wounds 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Chosen of the Quiet One',
        description: 'Increase WIS or CHA by 2 (maximum 22). You are immune to psychic damage. Any creature that attacks you must first succeed on a WIS save or choose a different target. Once per tenday, Eldath reveals the nearest source of corruption threatening nature.',
        mechanicalEffect: '+2 WIS or CHA (max 22); immune to psychic; attackers must save or retarget; divine corruption sense 1/tenday'
      }
    }
  },

  gond: {
    key: 'gond',
    name: 'Gond',
    title: 'Lord of All Smiths',
    domains: ['Forge', 'Knowledge'],
    increases: [
      'Invent a new device, mechanism, or crafting technique',
      'Repair or improve an existing tool, weapon, or structure',
      'Teach the principles of craft and innovation to others',
      'Use ingenious engineering to solve an impossible problem',
      'Build something that will outlast its creator'
    ],
    decreases: [
      'Destroy a unique invention or masterwork creation',
      'Dismiss the value of craftsmanship or manual labor',
      'Steal another artisan\'s design without improving upon it',
      'Choose brute force over an engineered solution',
      'Suppress innovation or discourage experimentation'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Maker\'s Touch',
        description: 'You can cast Mending at will. You gain proficiency with one set of artisan\'s tools (or expertise if already proficient). Crafting time reduced 25%.',
        mechanicalEffect: 'Mending at will; +1 tool proficiency (or expertise); 25% faster crafting'
      },
      10: {
        threshold: 10,
        name: 'Gond\'s Ingenuity',
        description: 'You have advantage on all ability checks involving artisan\'s tools. 1/long rest, cast Heat Metal without a spell slot. You can jury-rig broken objects for 24 hours.',
        mechanicalEffect: 'Advantage on artisan tool checks; Heat Metal 1/long rest (no slot); jury-rig 24 hrs'
      },
      25: {
        threshold: 25,
        name: 'Grand Artificer',
        description: 'Items you craft are always Fine quality or better. 1/long rest, cast Fabricate without a spell slot. Once per long rest, temporarily enchant a mundane weapon or armor (+1 bonus) for 1 hour.',
        mechanicalEffect: 'Minimum Fine quality; Fabricate 1/long rest (no slot); temp +1 enchant 1 hr 1/long rest'
      },
      50: {
        threshold: 50,
        name: 'Chosen of the Lord of Smiths',
        description: 'Increase INT or STR by 2 (maximum 22). Items you craft have a 10% chance of gaining a random magical property. Once per tenday, Gond inspires you with the blueprint for a wondrous invention.',
        mechanicalEffect: '+2 INT or STR (max 22); 10% magic on crafted items; divine blueprint 1/tenday'
      }
    }
  },

  helm: {
    key: 'helm',
    name: 'Helm',
    title: 'The Vigilant One',
    domains: ['Life', 'Light'],
    increases: [
      'Stand guard over the defenseless through the night',
      'Fulfill a sworn duty even at great personal cost',
      'Protect a ward, charge, or sacred site from harm',
      'Remain vigilant when others grow complacent or weary',
      'Sacrifice personal comfort to ensure others\' safety'
    ],
    decreases: [
      'Abandon a post or duty you swore to uphold',
      'Fall asleep or become incapacitated while on watch',
      'Allow harm through negligence to those under your protection',
      'Pursue personal vendettas when your duty demands otherwise',
      'Delegate a sacred charge to someone unworthy or unreliable'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Watchful Eye',
        description: 'You cannot be surprised while conscious. Once per long rest, cast Warding Bond without a spell slot.',
        mechanicalEffect: 'Cannot be surprised; Warding Bond 1/long rest (no slot)'
      },
      10: {
        threshold: 10,
        name: 'Helm\'s Vigilance',
        description: 'You have advantage on Perception checks and initiative rolls. 1/long rest, cast Protection from Energy without a spell slot (touch ally).',
        mechanicalEffect: 'Advantage on Perception/initiative; Protection from Energy 1/long rest (no slot, touch ally)'
      },
      25: {
        threshold: 25,
        name: 'Guardian Eternal',
        description: 'As a reaction, when a creature within 30 ft takes damage, teleport adjacent and take the damage instead (halved). 3/long rest. 1/long rest, cast Wall of Force without a spell slot.',
        mechanicalEffect: 'Teleport + absorb half damage for ally (30 ft) 3/long rest; Wall of Force 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Chosen of the Vigilant One',
        description: 'Increase CON or STR by 2 (maximum 22). You are immune to Charmed and Incapacitated conditions. Once per tenday, Helm grants a vision of the greatest threat to those you have sworn to protect.',
        mechanicalEffect: '+2 CON or STR (max 22); immune to Charmed/Incapacitated; divine threat vision 1/tenday'
      }
    }
  },

  ilmater: {
    key: 'ilmater',
    name: 'Ilmater',
    title: 'The Crying God',
    domains: ['Life'],
    increases: [
      'Endure great suffering or torture without breaking faith',
      'Heal or tend to the sick, wounded, or dying',
      'Sacrifice your own well-being to shield others from harm',
      'Show mercy to a defeated or helpless enemy',
      'Provide comfort and aid to the oppressed or downtrodden'
    ],
    decreases: [
      'Inflict needless suffering on the innocent',
      'Refuse to help someone in obvious pain or distress',
      'Use cruelty or torture to extract information',
      'Turn away from the sick or dying when you could aid them',
      'Take pleasure in another creature\'s agony'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Martyr\'s Touch',
        description: 'You can cast Spare the Dying as a bonus action at a range of 30 feet.',
        mechanicalEffect: 'Spare the Dying as bonus action at 30 ft range'
      },
      10: {
        threshold: 10,
        name: 'Endurance of the Broken God',
        description: 'You have resistance to one damage type of your choice (chosen each dawn). You have advantage on Constitution saving throws against exhaustion.',
        mechanicalEffect: 'Resistance to 1 damage type (chosen at dawn); advantage on CON saves vs. exhaustion'
      },
      25: {
        threshold: 25,
        name: 'Ilmater\'s Sacrifice',
        description: 'Once per long rest, cast Beacon of Hope without a spell slot. When you heal a creature, you can transfer one condition (poisoned, blinded, diseased) from them to yourself, ending it on yourself at the start of your next turn.',
        mechanicalEffect: 'Beacon of Hope 1/long rest (no slot); transfer conditions from healed creature'
      },
      50: {
        threshold: 50,
        name: 'Avatar of Compassion',
        description: 'Increase WIS by 2 (maximum 22). You are immune to Frightened and to being magically compelled to harm an innocent. Once per tenday, commune directly with Ilmater.',
        mechanicalEffect: '+2 WIS (max 22); immune to Frightened; cannot be compelled to harm innocents; divine communion 1/tenday'
      }
    }
  },

  loviatar: {
    key: 'loviatar',
    name: 'Loviatar',
    title: 'The Maiden of Pain',
    domains: ['Death'],
    increases: [
      'Endure pain willingly as an offering to Loviatar',
      'Inflict exquisite suffering on a worthy foe during combat',
      'Convert others to embrace pain as a path to strength',
      'Conduct a ritual of painful devotion',
      'Punish oathbreakers or the unfaithful through torment'
    ],
    decreases: [
      'Use magical healing to avoid pain you could have endured',
      'Show cowardice or flee from pain when you could stand fast',
      'Grant a quick painless death when a lingering one would honor Loviatar',
      'Express pity for suffering that serves the Maiden\'s will',
      'Numb yourself with drink or drugs to avoid feeling pain'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Lash of Devotion',
        description: 'When you take damage from a melee attack, you can use your reaction to gain advantage on your next attack roll before the end of your next turn.',
        mechanicalEffect: 'Reaction on melee damage taken: advantage on next attack'
      },
      10: {
        threshold: 10,
        name: 'Pain is Pleasure',
        description: 'You have resistance to necrotic damage. When below half HP, you deal an extra 1d6 necrotic damage with melee weapon attacks.',
        mechanicalEffect: 'Necrotic resistance; +1d6 necrotic melee below half HP'
      },
      25: {
        threshold: 25,
        name: 'Scourge of the Maiden',
        description: 'Once per long rest, cast Contagion without a spell slot. Once per long rest, when you hit a creature, it must CON save or be stunned until end of your next turn.',
        mechanicalEffect: 'Contagion 1/long rest (no slot); stun on hit (CON save) 1/long rest'
      },
      50: {
        threshold: 50,
        name: 'Beloved of Loviatar',
        description: 'Increase CON by 2 (maximum 22). You are immune to Frightened and Stunned conditions. Once per tenday, commune directly with Loviatar.',
        mechanicalEffect: '+2 CON (max 22); immune to Frightened/Stunned; divine communion 1/tenday'
      }
    }
  },

  // ---- DROW PANTHEON ----

  lolth: {
    key: 'lolth',
    name: 'Lolth',
    title: 'Queen of Spiders',
    domains: ['Trickery'],
    increases: [
      'Betray a rival or superior to seize power for yourself',
      'Offer a significant sacrifice to Lolth in ritual',
      'Spread fear and domination among lesser creatures in Lolth\'s name',
      'Advance the supremacy of drow over surface dwellers',
      'Weave deception that leads to the ruin of Lolth\'s enemies'
    ],
    decreases: [
      'Show genuine mercy or compassion to an enemy',
      'Ally sincerely with surface elves or their gods',
      'Fail to punish disloyalty among your subordinates',
      'Allow a rival to surpass you without retaliation',
      'Worship or praise any other deity in Lolth\'s presence'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Spider\'s Kiss',
        description: 'You can cast Dancing Lights at will (appearing as faint spiders). You gain darkvision to 60 feet if you don\'t already have it.',
        mechanicalEffect: 'Dancing Lights at will; darkvision 60 ft'
      },
      10: {
        threshold: 10,
        name: 'Web of the Queen',
        description: 'You gain a climbing speed equal to your walking speed and advantage on Stealth in dim light or darkness. 1/long rest, cast Web without a spell slot.',
        mechanicalEffect: 'Climbing speed; advantage on Stealth in dim/dark; Web 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Demonweb Pits\' Favor',
        description: 'Once per long rest, cast Conjure Animals (spiders only) without a spell slot. You are immune to the poisoned condition and resistant to poison damage.',
        mechanicalEffect: 'Conjure Animals (spiders) 1/long rest (no slot); immune to poisoned; poison resistance'
      },
      50: {
        threshold: 50,
        name: 'Chosen of Lolth',
        description: 'Increase CHA by 2 (maximum 22). You can cast Dominate Person once per long rest without a spell slot. Once per tenday, commune directly with Lolth.',
        mechanicalEffect: '+2 CHA (max 22); Dominate Person 1/long rest (no slot); divine communion 1/tenday'
      }
    }
  },

  // ---- MORE FAERÛNIAN DEITIES ----

  mask: {
    key: 'mask',
    name: 'Mask',
    title: 'Lord of Shadows',
    domains: ['Trickery'],
    increases: [
      'Pull off a daring heist or theft of significant value',
      'Deceive a powerful figure and escape undetected',
      'Protect the secrets of fellow thieves or rogues',
      'Operate from the shadows without revealing your identity',
      'Outsmart a trap, puzzle, or scheme set by others'
    ],
    decreases: [
      'Steal from the poor or destitute without purpose',
      'Betray a fellow thief to authorities for personal gain',
      'Get caught red-handed in a clumsy, artless theft',
      'Act with brute force when cunning would suffice',
      'Reveal your true name or identity recklessly to enemies'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Shadow\'s Veil',
        description: 'You can cast Minor Illusion at will. You have advantage on Sleight of Hand checks to pick pockets or palm objects.',
        mechanicalEffect: 'Minor Illusion at will; advantage on Sleight of Hand'
      },
      10: {
        threshold: 10,
        name: 'Cloak of the Lord of Shadows',
        description: 'You have advantage on Stealth checks. Once per long rest, cast Invisibility on yourself without a spell slot.',
        mechanicalEffect: 'Advantage on Stealth; Invisibility (self) 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Shadowstep',
        description: 'Once per long rest, cast Dimension Door without a spell slot (origin and destination must be in dim light or darkness). You have resistance to necrotic damage.',
        mechanicalEffect: 'Dimension Door 1/long rest (no slot, dim/dark only); necrotic resistance'
      },
      50: {
        threshold: 50,
        name: 'Master of Thieves',
        description: 'Increase DEX by 2 (maximum 22). You are immune to detection by divination magic unless you choose to be found. Once per tenday, commune directly with Mask.',
        mechanicalEffect: '+2 DEX (max 22); immune to divination detection; divine communion 1/tenday'
      }
    }
  },

  mielikki: {
    key: 'mielikki',
    name: 'Mielikki',
    title: 'Our Lady of the Forest',
    domains: ['Nature'],
    increases: [
      'Protect a forest, grove, or wilderness area from destruction',
      'Tend to wounded or sick animals and release them to the wild',
      'Plant trees or restore land scarred by fire or corruption',
      'Live in harmony with nature during extended wilderness travel',
      'Defeat aberrations, undead, or creatures that corrupt the natural world'
    ],
    decreases: [
      'Needlessly fell trees or burn forestland',
      'Kill animals for sport rather than sustenance or defense',
      'Spread blight, pollution, or corruption in natural places',
      'Cage or enslave wild beasts for entertainment',
      'Side with those who exploit the wilderness for profit without balance'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Whisper of the Woods',
        description: 'You can cast Druidcraft at will. You gain proficiency in Animal Handling (or expertise if already proficient).',
        mechanicalEffect: 'Druidcraft at will; Animal Handling proficiency (or expertise)'
      },
      10: {
        threshold: 10,
        name: 'Forest\'s Embrace',
        description: 'You have advantage on Survival checks in natural terrain. Once per long rest, cast Pass Without Trace without a spell slot.',
        mechanicalEffect: 'Advantage on Survival (natural terrain); Pass Without Trace 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Mielikki\'s Chosen Ranger',
        description: 'Once per long rest, cast Conjure Animals without a spell slot. In natural terrain, you and allies within 30 ft have poison resistance and can\'t be tracked nonmagically.',
        mechanicalEffect: 'Conjure Animals 1/long rest (no slot); poison resistance + untrackable in nature (30 ft)'
      },
      50: {
        threshold: 50,
        name: 'Voice of the Wilds',
        description: 'Increase WIS by 2 (maximum 22). You are immune to poison damage and the poisoned condition. Beasts of CR 1 or lower won\'t attack you unless magically compelled. Once per tenday, commune with Mielikki.',
        mechanicalEffect: '+2 WIS (max 22); immune to poison/poisoned; beasts friendly; divine communion 1/tenday'
      }
    }
  },

  milil: {
    key: 'milil',
    name: 'Milil',
    title: 'Lord of Song',
    domains: ['Light'],
    increases: [
      'Compose or perform a song, poem, or tale that inspires others',
      'Preserve a forgotten story, ballad, or piece of lost lore',
      'Use music or art to bring comfort or courage to the downtrodden',
      'Win a contest of artistic skill or bardic performance',
      'Spread beauty and artistry in places of ugliness or despair'
    ],
    decreases: [
      'Destroy a work of art, music, or literature',
      'Use song or poetry to spread malicious lies or despair',
      'Silence another performer out of jealousy or spite',
      'Refuse to share a tale when others would benefit from hearing it',
      'Act with willful crudeness when beauty could be offered'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Songbird\'s Gift',
        description: 'You can cast Vicious Mockery at will. You have advantage on Performance checks.',
        mechanicalEffect: 'Vicious Mockery at will; advantage on Performance'
      },
      10: {
        threshold: 10,
        name: 'Harmonics of the Lord of Song',
        description: 'Once per long rest, cast Calm Emotions without a spell slot. When you use the Help action, the assisted creature also gains temporary HP equal to your proficiency bonus.',
        mechanicalEffect: 'Calm Emotions 1/long rest (no slot); Help action grants temp HP = proficiency'
      },
      25: {
        threshold: 25,
        name: 'Aria of Restoration',
        description: 'Once per long rest, cast Mass Cure Wounds without a spell slot. Once per long rest, end one charm or fear effect on each friendly creature within 30 ft as an action.',
        mechanicalEffect: 'Mass Cure Wounds 1/long rest (no slot); end charm/fear on allies (30 ft) 1/long rest'
      },
      50: {
        threshold: 50,
        name: 'Divine Virtuoso',
        description: 'Increase CHA by 2 (maximum 22). You are immune to Charmed and Silenced conditions. Once per tenday, commune directly with Milil.',
        mechanicalEffect: '+2 CHA (max 22); immune to Charmed/Silenced; divine communion 1/tenday'
      }
    }
  },

  // ---- DWARVEN PANTHEON ----

  moradin: {
    key: 'moradin',
    name: 'Moradin',
    title: 'The All-Father',
    domains: ['Forge', 'Knowledge'],
    increases: [
      'Craft a weapon, armor, or object of exceptional quality',
      'Defend dwarven settlements, traditions, or sacred sites',
      'Teach smithing, stonemasonry, or other crafts to the worthy',
      'Uphold oaths and honor ancestral traditions',
      'Drive back aberrations, giants, or goblinoids threatening dwarven holds'
    ],
    decreases: [
      'Break a sworn oath or promise made in good faith',
      'Allow a forge or workshop to fall into ruin through neglect',
      'Defile or disrespect dwarven tombs, holds, or ancestral relics',
      'Produce shoddy or deliberately flawed craftsmanship',
      'Abandon allies or kin in battle out of cowardice'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Soulforger\'s Spark',
        description: 'You can cast Mending at will. You gain proficiency with smith\'s tools (or expertise if already proficient).',
        mechanicalEffect: 'Mending at will; smith\'s tools proficiency (or expertise)'
      },
      10: {
        threshold: 10,
        name: 'Anvil\'s Resilience',
        description: 'You have resistance to fire damage. You have advantage on saves against being knocked prone or forcibly moved.',
        mechanicalEffect: 'Fire resistance; advantage vs. prone/forced movement'
      },
      25: {
        threshold: 25,
        name: 'Blessing of the All-Father',
        description: 'Once per long rest, cast Fabricate without a spell slot. Weapons and armor you craft have a +1 bonus (doesn\'t stack with other magical bonuses).',
        mechanicalEffect: 'Fabricate 1/long rest (no slot); crafted weapons/armor gain +1'
      },
      50: {
        threshold: 50,
        name: 'Moradin\'s Living Forge',
        description: 'Increase STR by 2 (maximum 22). You are immune to fire damage. Once per tenday, commune directly with Moradin.',
        mechanicalEffect: '+2 STR (max 22); immune to fire; divine communion 1/tenday'
      }
    }
  },

  myrkul: {
    key: 'myrkul',
    name: 'Myrkul',
    title: 'Lord of Bones',
    domains: ['Death'],
    increases: [
      'Raise undead servants to serve your purposes',
      'Instill the fear of death in the living through word or deed',
      'Perform funerary rites that bind the dead to Myrkul\'s service',
      'Destroy those who cheat death through means not sanctioned by Myrkul',
      'Spread despair and the inevitability of death\'s dominion'
    ],
    decreases: [
      'Resurrect a creature that has rightfully died without Myrkul\'s blessing',
      'Destroy undead that serve Myrkul\'s will',
      'Show fear of death or flee your own demise in a cowardly manner',
      'Bring hope or comfort regarding the afterlife to the dying',
      'Ally with celestials or life-domain clerics who oppose the natural order'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Grasp of the Grave',
        description: 'You can cast Chill Touch at will. The cantrip deals extra necrotic damage equal to your proficiency bonus.',
        mechanicalEffect: 'Chill Touch at will; +proficiency bonus necrotic damage'
      },
      10: {
        threshold: 10,
        name: 'Death\'s Shroud',
        description: 'You have resistance to necrotic damage. Once per long rest, cast Blindness/Deafness without a spell slot.',
        mechanicalEffect: 'Necrotic resistance; Blindness/Deafness 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Lord of Bones\' Command',
        description: 'Once per long rest, cast Animate Dead without a spell slot, raising up to 3 undead instead of 1. Undead you control deal an extra 1d6 necrotic with their attacks.',
        mechanicalEffect: 'Animate Dead (3 undead) 1/long rest (no slot); your undead +1d6 necrotic'
      },
      50: {
        threshold: 50,
        name: 'Herald of the Lord of Dead',
        description: 'Increase CON by 2 (maximum 22). You are immune to necrotic damage and the Frightened condition. Once per tenday, commune directly with Myrkul.',
        mechanicalEffect: '+2 CON (max 22); immune to necrotic/Frightened; divine communion 1/tenday'
      }
    }
  },

  savras: {
    key: 'savras',
    name: 'Savras',
    title: 'The All-Seeing',
    domains: ['Knowledge'],
    increases: [
      'Uncover a hidden truth, secret, or prophecy',
      'Share visions or divinations honestly, even when unwelcome',
      'Expose liars, frauds, and those who obscure the truth',
      'Record and preserve prophecies or oracular knowledge',
      'Meditate on the future and accept what fate reveals'
    ],
    decreases: [
      'Deliberately conceal a true prophecy from those it concerns',
      'Use divination magic to deceive or mislead others',
      'Destroy records of prophecy, history, or oracular wisdom',
      'Blind yourself to truth out of fear or selfishness',
      'Interfere with another seer\'s legitimate divination'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Third Eye Flicker',
        description: 'You can cast Guidance at will. Once per long rest, add 1d4 to a roll after seeing it but before the outcome is declared.',
        mechanicalEffect: 'Guidance at will; +1d4 to any roll (after seeing) 1/long rest'
      },
      10: {
        threshold: 10,
        name: 'All-Seeing Gaze',
        description: 'You have advantage on Investigation to see through illusions and Insight to detect lies. Once per long rest, cast See Invisibility without a spell slot.',
        mechanicalEffect: 'Advantage on Investigation (illusions)/Insight (lies); See Invisibility 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Oracle\'s Vision',
        description: 'Once per long rest, cast Divination or Scrying without a spell slot or material components. You cannot be surprised while conscious.',
        mechanicalEffect: 'Divination/Scrying 1/long rest (no slot/components); cannot be surprised'
      },
      50: {
        threshold: 50,
        name: 'Eye of Savras',
        description: 'Increase WIS by 2 (maximum 22). You are immune to the Blinded condition and illusion spells of 5th level or lower. Once per tenday, commune directly with Savras.',
        mechanicalEffect: '+2 WIS (max 22); immune to Blinded/illusions (≤5th); divine communion 1/tenday'
      }
    }
  },

  shar: {
    key: 'shar',
    name: 'Shar',
    title: 'Mistress of the Night',
    domains: ['Death', 'Trickery'],
    increases: [
      'Operate in secrecy to advance Shar\'s influence',
      'Destroy sources of light, hope, or knowledge that oppose the darkness',
      'Convert the grieving or despairing to embrace the void of Shar',
      'Undermine the worship of Selûne or other deities of light',
      'Guard or recover ancient secrets lost to forgotten ages'
    ],
    decreases: [
      'Bring light or hope to those who have embraced Shar\'s darkness',
      'Reveal Sharran secrets to outsiders or the uninitiated',
      'Aid worshippers of Selûne or work against Shar\'s faithful',
      'Show vulnerability or emotional weakness in front of enemies',
      'Choose open confrontation when shadow and subtlety would serve better'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Kiss of Shadow',
        description: 'You can cast Minor Illusion at will (visuals appear as patches of darkness). You have darkvision to 60 feet, or extend existing darkvision by 30 feet.',
        mechanicalEffect: 'Minor Illusion at will (shadow variant); darkvision 60 ft (or +30 ft)'
      },
      10: {
        threshold: 10,
        name: 'Nightbringer\'s Cloak',
        description: 'You have resistance to necrotic damage and advantage on Stealth in dim light or darkness. 1/long rest, cast Darkness without a spell slot — you can see through this darkness normally.',
        mechanicalEffect: 'Necrotic resistance; advantage on Stealth (dim/dark); Darkness 1/long rest (no slot, see through)'
      },
      25: {
        threshold: 25,
        name: 'Void of the Mistress',
        description: 'Once per long rest, cast Enervation without a spell slot. When you deal necrotic damage, you can ignore resistance to necrotic damage (but not immunity).',
        mechanicalEffect: 'Enervation 1/long rest (no slot); necrotic pierces resistance'
      },
      50: {
        threshold: 50,
        name: 'Nightsinger Ascendant',
        description: 'Increase CHA by 2 (maximum 22). You are immune to necrotic damage and the Blinded condition. You can see perfectly in magical and nonmagical darkness to 120 feet. Once per tenday, commune with Shar.',
        mechanicalEffect: '+2 CHA (max 22); immune to necrotic/Blinded; see in all darkness 120 ft; divine communion 1/tenday'
      }
    }
  },

  sune: {
    key: 'sune',
    name: 'Sune',
    title: 'Lady Firehair',
    domains: ['Life', 'Light'],
    increases: [
      'Perform an act of genuine love, romance, or passionate devotion',
      'Create or preserve something of great beauty',
      'Defend the innocent from those who would mar beauty or love',
      'Show compassion and kindness to uplift the downtrodden or lonely',
      'Resolve conflict through charm and diplomacy rather than violence'
    ],
    decreases: [
      'Willfully destroy something beautiful without cause',
      'Use love or desire as a weapon to manipulate and harm others',
      'Show cruelty or indifference to beauty in all its forms',
      'Scar or disfigure a creature unnecessarily',
      'Reject love or companionship out of cold ambition or spite'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Firehair\'s Charm',
        description: 'You can cast Friends at will without the target becoming hostile when the spell ends. You have advantage on Persuasion checks involving appeals to emotion or beauty.',
        mechanicalEffect: 'Friends at will (no hostility); advantage on emotional Persuasion'
      },
      10: {
        threshold: 10,
        name: 'Heartfire Shield',
        description: 'You have resistance to fire damage. Once per long rest, cast Warding Bond without a spell slot, the bond manifesting as a shimmering rose-gold thread.',
        mechanicalEffect: 'Fire resistance; Warding Bond 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Sune\'s Embrace',
        description: 'Once per long rest, cast Mass Cure Wounds without a spell slot. Once per long rest, end the charmed or frightened condition on up to 6 creatures within 30 feet as an action.',
        mechanicalEffect: 'Mass Cure Wounds 1/long rest (no slot); end charm/fear on 6 creatures (30 ft) 1/long rest'
      },
      50: {
        threshold: 50,
        name: 'Beloved of Sune',
        description: 'Increase CHA by 2 (maximum 22). You are immune to the Charmed condition and effects that magically age you. Once per tenday, commune directly with Sune.',
        mechanicalEffect: '+2 CHA (max 22); immune to Charmed/magical aging; divine communion 1/tenday'
      }
    }
  },

  talos: {
    key: 'talos',
    name: 'Talos',
    title: 'The Destroyer',
    domains: ['Tempest'],
    increases: [
      'Unleash destruction during a storm or in Talos\'s name',
      'Destroy a building, ship, or fortification dramatically',
      'Intimidate or terrorize a settlement into offering tribute',
      'Perform a ritual sacrifice during a thunderstorm',
      'Defeat a powerful foe using lightning, thunder, or elemental fury'
    ],
    decreases: [
      'Protect a structure or settlement from a natural storm',
      'Show restraint or mercy when destruction would honor Talos',
      'Build lasting shelters or fortifications that defy the storm',
      'Calm a storm or suppress natural weather with magic',
      'Cower in fear from lightning, thunder, or natural disasters'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Stormcaller\'s Spark',
        description: 'You can cast Shocking Grasp at will. When outdoors during a storm, your attack rolls with this cantrip have advantage.',
        mechanicalEffect: 'Shocking Grasp at will; advantage during storms'
      },
      10: {
        threshold: 10,
        name: 'Eye of the Destroyer',
        description: 'You have resistance to lightning and thunder damage. Once per long rest, cast Shatter without a spell slot.',
        mechanicalEffect: 'Lightning/thunder resistance; Shatter 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Talos\'s Fury',
        description: 'Once per long rest, cast Call Lightning without a spell slot — the first bolt deals maximum damage. You are immune to being deafened.',
        mechanicalEffect: 'Call Lightning 1/long rest (no slot, first bolt max damage); immune to deafened'
      },
      50: {
        threshold: 50,
        name: 'Herald of the Destroyer',
        description: 'Increase STR by 2 (maximum 22). You are immune to lightning and thunder damage. Once per tenday, commune directly with Talos.',
        mechanicalEffect: '+2 STR (max 22); immune to lightning/thunder; divine communion 1/tenday'
      }
    }
  },

  // ---- DRACONIC PANTHEON ----

  bahamut: {
    key: 'bahamut',
    name: 'Bahamut',
    title: 'The Platinum Dragon',
    domains: ['Life', 'War'],
    increases: [
      'Protect the weak and innocent from tyranny or evil',
      'Slay an evil dragon or defeat a servant of Tiamat',
      'Show mercy to a repentant enemy and guide them toward redemption',
      'Uphold justice with honor, never stooping to cruelty',
      'Defend the honor and legacy of metallic dragonkind'
    ],
    decreases: [
      'Kill a metallic dragon or aid in its destruction',
      'Use cruelty or torture, even against evil creatures',
      'Ally with chromatic dragons or servants of Tiamat',
      'Abandon innocents to save yourself',
      'Act dishonorably — lie, cheat, or break an oath'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Platinum Scales',
        description: 'You can cast Shield of Faith once per long rest without a spell slot. You have advantage on saves against dragon Frightful Presence.',
        mechanicalEffect: 'Shield of Faith 1/long rest (no slot); advantage vs. dragon Frightful Presence'
      },
      10: {
        threshold: 10,
        name: 'Bahamut\'s Valor',
        description: 'You gain resistance to one type of dragon breath damage of your choice (chosen when this threshold is reached). 1/long rest, cast Beacon of Hope without a spell slot.',
        mechanicalEffect: 'Resistance to one dragon breath type; Beacon of Hope 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Wings of the Platinum Dragon',
        description: 'As a bonus action, manifest spectral dragon wings for 1 hour, gaining 60 ft fly speed. While active, weapon attacks deal +1d8 radiant. 1/long rest.',
        mechanicalEffect: 'Spectral wings: 60 ft fly + 1d8 radiant on weapons; 1 hour; 1/long rest'
      },
      50: {
        threshold: 50,
        name: 'Chosen of the Platinum Dragon',
        description: 'Increase STR or CHA by 2 (maximum 22). You are immune to dragon Frightful Presence and metallic breath weapons. Once per tenday, Bahamut sends a gold canary servant to aid you for 24 hours.',
        mechanicalEffect: '+2 STR or CHA (max 22); immune to Frightful Presence/metallic breath; gold canary servant 1/tenday'
      }
    }
  },

  tiamat: {
    key: 'tiamat',
    name: 'Tiamat',
    title: 'Queen of Dragons',
    domains: ['Trickery', 'War'],
    increases: [
      'Amass a great hoard of treasure, wealth, or magical items',
      'Defeat a metallic dragon or servant of Bahamut',
      'Dominate others through fear, cunning, or overwhelming power',
      'Make offerings of gold, gems, or magic items at a shrine to Tiamat',
      'Spread the dread of dragonkind across the land'
    ],
    decreases: [
      'Give away treasure or wealth freely without strategic purpose',
      'Show deference or respect to Bahamut or metallic dragons',
      'Display weakness or submit to a creature of lesser power',
      'Allow your hoard to be stolen without retaliation',
      'Ally with those who would slay chromatic dragons'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Dragon\'s Avarice',
        description: 'You can cast Thaumaturgy at will. You have advantage on Investigation checks to find hidden objects, treasure, or secret doors.',
        mechanicalEffect: 'Thaumaturgy at will; advantage on Investigation for treasure/secrets'
      },
      10: {
        threshold: 10,
        name: 'Chromatic Ward',
        description: 'At the end of each long rest, choose one: acid, cold, fire, lightning, or poison. You have resistance to that damage type until next long rest. 1/long rest, cast Fear without a spell slot.',
        mechanicalEffect: 'Resistance to 1 chromatic type (chosen at dawn); Fear 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Breath of Tiamat',
        description: 'Once per long rest, exhale a 30-foot cone of elemental energy (choose acid, cold, fire, lightning, or poison). DC 16 DEX save, 8d6 damage on failure, half on success.',
        mechanicalEffect: 'Breath weapon: 30 ft cone, 8d6 (choose type), DC 16 DEX; 1/long rest'
      },
      50: {
        threshold: 50,
        name: 'Chosen of the Dragon Queen',
        description: 'Increase CHA by 2 (maximum 22). You are immune to Frightened and to one chromatic damage type of your choice (permanent). Once per tenday, commune directly with Tiamat.',
        mechanicalEffect: '+2 CHA (max 22); immune to Frightened + 1 chromatic type; divine communion 1/tenday'
      }
    }
  },

  tymora: {
    key: 'tymora',
    name: 'Tymora',
    title: 'Lady Luck',
    domains: ['Trickery'],
    increases: [
      'Take a bold risk or daring gamble that succeeds spectacularly',
      'Help the downtrodden seize an opportunity to change their fortune',
      'Trust in luck rather than cautious planning and be rewarded',
      'Win a game of chance and attribute the victory to Tymora',
      'Venture into danger without hesitation when others would hold back'
    ],
    decreases: [
      'Refuse to take a risk when opportunity clearly presents itself',
      'Cheat at games of chance rather than trusting in luck',
      'Act with excessive caution or cowardice when fortune favors the bold',
      'Curse your luck or blame Tymora for misfortune',
      'Hoard opportunity and refuse to share good fortune with others'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Lucky Coin',
        description: 'Once per long rest, reroll one attack roll, ability check, or saving throw and take the higher result.',
        mechanicalEffect: 'Reroll any d20 (take higher) 1/long rest'
      },
      10: {
        threshold: 10,
        name: 'Fortune\'s Favor',
        description: 'You have advantage on death saving throws. Once per long rest, when a creature hits you, use your reaction to force a reroll (take lower).',
        mechanicalEffect: 'Advantage on death saves; force attack reroll (take lower) 1/long rest'
      },
      25: {
        threshold: 25,
        name: 'Lady Luck\'s Intervention',
        description: 'Once per long rest, turn one failed save into an automatic success, or one missed attack into an automatic crit. 1/long rest, cast Bless without a spell slot (bonus die is 1d6 instead of 1d4).',
        mechanicalEffect: 'Auto-succeed save or auto-crit 1/long rest; Bless (1d6) 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Tymora\'s Chosen',
        description: 'Increase CHA by 2 (maximum 22). Once per long rest, when you roll a 1 on any d20, treat it as a 20 instead. Once per tenday, commune directly with Tymora.',
        mechanicalEffect: '+2 CHA (max 22); nat 1 becomes nat 20 1/long rest; divine communion 1/tenday'
      }
    }
  },

  umberlee: {
    key: 'umberlee',
    name: 'Umberlee',
    title: 'The Bitch Queen',
    domains: ['Tempest'],
    increases: [
      'Make a significant offering to Umberlee before a sea voyage',
      'Destroy a ship or sink cargo in her name',
      'Drown a creature as a sacrifice to the depths',
      'Punish those who disrespect the sea or fail to pay tribute',
      'Spread fear of the ocean among coastal communities'
    ],
    decreases: [
      'Calm a storm or save a sinking vessel without offering thanks',
      'Worship a rival sea deity such as Valkur',
      'Build structures that dam or divert natural waterways',
      'Show mercy to those who have offended the sea',
      'Refuse to make an offering before traveling by water'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Sea\'s Whisper',
        description: 'You can cast Shape Water at will. You can breathe underwater.',
        mechanicalEffect: 'Shape Water at will; water breathing'
      },
      10: {
        threshold: 10,
        name: 'Stormcaller\'s Favor',
        description: 'You have resistance to lightning and thunder damage. You gain a swim speed equal to your walking speed.',
        mechanicalEffect: 'Lightning/thunder resistance; swim speed = walking speed'
      },
      25: {
        threshold: 25,
        name: 'Wrath of the Deep',
        description: 'Once per long rest, cast Maelstrom without a spell slot. You can control water within 100 ft at will (as Shape Water but larger scale).',
        mechanicalEffect: 'Maelstrom 1/long rest (no slot); large-scale water control 100 ft'
      },
      50: {
        threshold: 50,
        name: 'Queen\'s Dominion',
        description: 'Increase WIS by 2 (maximum 22). You are immune to cold damage and cannot drown. Once per tenday, commune with Umberlee.',
        mechanicalEffect: '+2 WIS (max 22); immune to cold; cannot drown; divine communion 1/tenday'
      }
    }
  },

  waukeen: {
    key: 'waukeen',
    name: 'Waukeen',
    title: 'Merchant\'s Friend',
    domains: ['Knowledge', 'Trickery'],
    increases: [
      'Broker a profitable trade deal or open a new trade route',
      'Donate generously to a temple of Waukeen or a merchant guild',
      'Expose and punish those who counterfeit coin or cheat in trade',
      'Accumulate significant wealth through clever commerce',
      'Protect a merchant caravan from bandits or monsters'
    ],
    decreases: [
      'Steal from merchants or disrupt fair trade',
      'Destroy valuable goods or wealth needlessly',
      'Break a contract or renege on a business agreement',
      'Embrace poverty as a virtue or reject commerce',
      'Allow thieves to rob a marketplace without intervention'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Merchant\'s Eye',
        description: 'You instinctively know the fair market value of any item you examine. Once per long rest, cast Identify without a spell slot or material components.',
        mechanicalEffect: 'Know fair value of items; Identify 1/long rest (no slot/components)'
      },
      10: {
        threshold: 10,
        name: 'Golden Tongue',
        description: 'You have advantage on Persuasion checks related to negotiation, bartering, or commerce. All purchases you make cost 10% less.',
        mechanicalEffect: 'Advantage on trade Persuasion; 10% discount on purchases'
      },
      25: {
        threshold: 25,
        name: 'Fortune\'s Vault',
        description: 'Once per long rest, cast Creation without a spell slot. Once per week, cast Magnificent Mansion (trade hall variant) without a spell slot.',
        mechanicalEffect: 'Creation 1/long rest (no slot); Magnificent Mansion 1/week (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Coinmaiden\'s Chosen',
        description: 'Increase CHA by 2 (maximum 22). You are immune to the Charmed condition. Once per tenday, commune with Waukeen.',
        mechanicalEffect: '+2 CHA (max 22); immune to Charmed; divine communion 1/tenday'
      }
    }
  },

  // ---- ELVEN PANTHEON ----

  corellon: {
    key: 'corellon',
    name: 'Corellon',
    title: 'Creator of the Elves',
    domains: ['Arcana', 'Light'],
    increases: [
      'Create a work of lasting beauty — art, music, poetry, or magic',
      'Protect elven communities, sacred groves, or fey crossings',
      'Use arcane magic with grace, creativity, and elegance',
      'Defend against the corruption of drow or forces of Lolth',
      'Preserve elven traditions and the memory of ages past'
    ],
    decreases: [
      'Destroy a work of art or beauty without cause',
      'Aid drow agents of Lolth or betray elven kin',
      'Use magic brutishly, without artistry or finesse',
      'Defile a sacred grove, fey crossing, or elven holy site',
      'Embrace rigid conformity that stifles creativity'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Corellon\'s Grace',
        description: 'You can cast Faerie Fire once per long rest without a spell slot. You gain proficiency in one artisan\'s tool or musical instrument.',
        mechanicalEffect: 'Faerie Fire 1/long rest (no slot); +1 artisan/instrument proficiency'
      },
      10: {
        threshold: 10,
        name: 'Blessing of the Creator',
        description: 'You have advantage on saves against being charmed and magic cannot put you to sleep. 1/long rest, cast Hypnotic Pattern without a spell slot.',
        mechanicalEffect: 'Advantage vs. charm; immune to magical sleep; Hypnotic Pattern 1/long rest (no slot)'
      },
      25: {
        threshold: 25,
        name: 'Arvandor\'s Champion',
        description: 'Once per turn, a creature you damage must CHA save or be blinded until the end of your next turn. 1/long rest, cast Greater Invisibility without a spell slot.',
        mechanicalEffect: 'Damage blinds (CHA save) 1/turn; Greater Invisibility 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Chosen of Corellon',
        description: 'Increase DEX or CHA by 2 (maximum 22). You do not age. Once per long rest, change your appearance as per Alter Self for 24 hours. Once per tenday, commune with Corellon.',
        mechanicalEffect: '+2 DEX or CHA (max 22); ageless; Alter Self (appearance) 1/long rest; divine communion 1/tenday'
      }
    }
  },

  sehanine: {
    key: 'sehanine',
    name: 'Sehanine',
    title: 'The Moonweaver',
    domains: ['Trickery'],
    increases: [
      'Protect lovers, dreamers, or those who travel by moonlight',
      'Expose a lie or illusion used to cause harm',
      'Aid someone in following their heart against societal expectation',
      'Perform a deed of beauty or creative expression under the moon',
      'Help someone escape an unjust imprisonment or forced arrangement'
    ],
    decreases: [
      'Destroy a work of art or beauty without cause',
      'Force someone into a marriage, servitude, or life they did not choose',
      'Use moonlight or dreams to torment the innocent',
      'Betray a lover\'s trust or manipulate someone\'s affections cruelly',
      'Hunt or kill lycanthropes who live peacefully'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Moonlit Veil',
        description: 'You can cast Minor Illusion at will. You have advantage on Stealth checks in moonlight.',
        mechanicalEffect: 'Minor Illusion at will; advantage on Stealth in moonlight'
      },
      10: {
        threshold: 10,
        name: 'Dreamweaver\'s Grace',
        description: 'You have advantage on saves against being charmed, and you cannot be put to sleep by magical means.',
        mechanicalEffect: 'Advantage vs. charm; immune to magical sleep'
      },
      25: {
        threshold: 25,
        name: 'Moonbeam Passage',
        description: 'Once per long rest, cast Greater Invisibility without a spell slot. Moonlight weapons deal +1d4 radiant at night.',
        mechanicalEffect: 'Greater Invisibility 1/long rest (no slot); +1d4 radiant at night'
      },
      50: {
        threshold: 50,
        name: 'The Moonweaver\'s Beloved',
        description: 'Increase CHA by 2 (maximum 22). You have Truesight out to 30 feet. Once per tenday, commune with Sehanine.',
        mechanicalEffect: '+2 CHA (max 22); Truesight 30 ft; divine communion 1/tenday'
      }
    }
  },

  // ---- ORCISH PANTHEON ----

  gruumsh: {
    key: 'gruumsh',
    name: 'Gruumsh',
    title: 'He Who Never Sleeps',
    domains: ['Tempest', 'War'],
    increases: [
      'Defeat a powerful foe in single combat',
      'Lead a successful raid or conquest against a settlement',
      'Destroy an elven holy site, artifact, or community',
      'Prove your strength by dominating a rival through violence',
      'Take what you want by force without apology'
    ],
    decreases: [
      'Show mercy to an elf or elven ally',
      'Retreat from a battle you could still fight',
      'Use diplomacy when violence would achieve the goal faster',
      'Submit to non-orc authority willingly',
      'Build rather than take — create rather than conquer'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'One-Eye\'s Fury',
        description: 'When reduced below half HP, gain +2 to melee weapon damage rolls until healed above half. Once per long rest, enter a divine rage as a bonus action (as Barbarian Rage, 1 minute).',
        mechanicalEffect: '+2 melee damage below half HP; divine rage 1/long rest (1 min)'
      },
      10: {
        threshold: 10,
        name: 'Gruumsh\'s Wrath',
        description: 'You have advantage on attack rolls against elves and half-elves. 1/long rest, cast Thunder Step without a spell slot. War cry frightens creatures within 15 ft (WIS save).',
        mechanicalEffect: 'Advantage vs. elves; Thunder Step 1/long rest (no slot); war cry frightens 15 ft'
      },
      25: {
        threshold: 25,
        name: 'He Who Never Sleeps',
        description: 'You no longer need sleep and cannot be put to sleep. Melee attacks deal +1d8 thunder or lightning damage (your choice per attack). 1/long rest, cast Destructive Wave without a spell slot.',
        mechanicalEffect: 'No sleep; immune to sleep; +1d8 thunder/lightning melee; Destructive Wave 1/long rest (no slot)'
      },
      50: {
        threshold: 50,
        name: 'Chosen of Gruumsh',
        description: 'Increase STR or CON by 2 (maximum 22). You are immune to Frightened and Stunned. Once per tenday, Gruumsh reveals the weakest point in any fortification or defense you behold.',
        mechanicalEffect: '+2 STR or CON (max 22); immune to Frightened/Stunned; divine weak-point revelation 1/tenday'
      }
    }
  },

  // ---- HALFLING PANTHEON ----

  yondalla: {
    key: 'yondalla',
    name: 'Yondalla',
    title: 'The Blessed One',
    domains: ['Life'],
    increases: [
      'Defend a halfling community or homestead from danger',
      'Share a bountiful meal with those in need',
      'Nurture and protect children or the vulnerable',
      'Cultivate a garden, farm, or place of comfort and plenty',
      'Show hospitality to strangers and welcome them with warmth'
    ],
    decreases: [
      'Turn away a hungry traveler or refuse to share food',
      'Destroy a home, farm, or place of shelter',
      'Betray the trust of a community that welcomed you',
      'Act with cruelty toward children or the defenseless',
      'Hoard resources while others nearby starve'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Hearthward',
        description: 'You can cast Spare the Dying at will with a range of 30 feet. You have advantage on cooking-related checks.',
        mechanicalEffect: 'Spare the Dying at will (30 ft); advantage on cooking checks'
      },
      10: {
        threshold: 10,
        name: 'Blessed Bounty',
        description: 'You can cast Lesser Restoration once per long rest without a spell slot. Food you prepare never spoils.',
        mechanicalEffect: 'Lesser Restoration 1/long rest (no slot); your food never spoils'
      },
      25: {
        threshold: 25,
        name: 'Shield of the Blessed',
        description: 'Once per long rest, cast Beacon of Hope without a spell slot. While active, you also gain +1 to AC.',
        mechanicalEffect: 'Beacon of Hope 1/long rest (no slot); +1 AC while active'
      },
      50: {
        threshold: 50,
        name: 'The Blessed One\'s Embrace',
        description: 'Increase WIS by 2 (maximum 22). You are immune to Frightened. You and allies within 30 ft have advantage on saves against Frightened. Once per tenday, commune with Yondalla.',
        mechanicalEffect: '+2 WIS (max 22); immune to Frightened; anti-fear aura 30 ft; divine communion 1/tenday'
      }
    }
  },

  // ---- EXANDRIAN PANTHEON ----

  avandra: {
    key: 'avandra',
    name: 'Avandra',
    title: 'The Changebringer',
    domains: ['Trickery'],
    increases: [
      'Embrace a dangerous risk that leads to a positive outcome',
      'Free someone from captivity, oppression, or tyranny',
      'Explore uncharted territory or venture into the unknown',
      'Defy fate or overcome seemingly impossible odds',
      'Help someone start a new life or break free of stagnation'
    ],
    decreases: [
      'Refuse to take a risk when the stakes demand boldness',
      'Enforce rigid laws that crush freedom or individuality',
      'Choose the safe, predictable path out of cowardice',
      'Imprison or enslave others',
      'Cling to tradition solely to resist necessary change'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Lucky Break',
        description: 'Once per long rest, reroll a d20 roll and take either result.',
        mechanicalEffect: 'Reroll any d20 (take either) 1/long rest'
      },
      10: {
        threshold: 10,
        name: 'Wanderer\'s Step',
        description: 'You have advantage on Dexterity saving throws against effects you can see. Your movement speed increases by 10 ft.',
        mechanicalEffect: 'Advantage on DEX saves vs. visible effects; +10 ft speed'
      },
      25: {
        threshold: 25,
        name: 'Fortune\'s Turn',
        description: 'Once per long rest, cast Freedom of Movement without a spell slot. Once per long rest, when hit by an attack, use your reaction to force the attacker to reroll.',
        mechanicalEffect: 'Freedom of Movement 1/long rest (no slot); force attack reroll 1/long rest'
      },
      50: {
        threshold: 50,
        name: 'Changebringer\'s Grace',
        description: 'Increase DEX by 2 (maximum 22). You are immune to being restrained or grappled. Once per tenday, commune with Avandra.',
        mechanicalEffect: '+2 DEX (max 22); immune to restrained/grappled; divine communion 1/tenday'
      }
    }
  },

  erathis: {
    key: 'erathis',
    name: 'Erathis',
    title: 'The Lawbearer',
    domains: ['Knowledge'],
    increases: [
      'Establish or restore order in a lawless region',
      'Found or improve a settlement, institution, or governing body',
      'Mediate a dispute and bring opposing parties to agreement',
      'Create or enforce just laws that protect the common good',
      'Build infrastructure such as roads, walls, or public works'
    ],
    decreases: [
      'Incite chaos or anarchy within an ordered society',
      'Destroy public works, buildings, or civic institutions',
      'Break a lawful oath or contract without just cause',
      'Side with brigands, rebels, or agents of disorder',
      'Allow corruption to fester in a position of authority'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Order\'s Voice',
        description: 'You can cast Command once per long rest without a spell slot. You have advantage on History checks about civilizations and governments.',
        mechanicalEffect: 'Command 1/long rest (no slot); advantage on History (civilizations)'
      },
      10: {
        threshold: 10,
        name: 'Pillar of Civilization',
        description: 'You have advantage on saving throws against being charmed or confused. You gain proficiency in one tool used in construction or governance.',
        mechanicalEffect: 'Advantage vs. charm/confusion; +1 tool proficiency (construction/governance)'
      },
      25: {
        threshold: 25,
        name: 'Lawbearer\'s Edict',
        description: 'Once per long rest, cast Wall of Force without a spell slot. Allies within 30 ft in a settlement gain +1 AC.',
        mechanicalEffect: 'Wall of Force 1/long rest (no slot); +1 AC for allies in settlements (30 ft)'
      },
      50: {
        threshold: 50,
        name: 'Foundation of Empire',
        description: 'Increase INT by 2 (maximum 22). You are immune to Confused and Stunned conditions. Once per tenday, commune with Erathis.',
        mechanicalEffect: '+2 INT (max 22); immune to Confused/Stunned; divine communion 1/tenday'
      }
    }
  },

  ioun: {
    key: 'ioun',
    name: 'Ioun',
    title: 'The Knowing Mentor',
    domains: ['Knowledge'],
    increases: [
      'Discover and preserve lost or forbidden knowledge',
      'Found or restore a library, school, or place of learning',
      'Share knowledge freely with those who seek to learn',
      'Defeat those who would destroy books, lore, or intellectual pursuits',
      'Solve an ancient mystery or decipher a forgotten language'
    ],
    decreases: [
      'Destroy books, scrolls, or repositories of knowledge',
      'Hoard knowledge to maintain power over others',
      'Spread deliberate misinformation or propaganda',
      'Refuse to investigate a mystery or turn away from truth',
      'Burn a library or suppress intellectual inquiry'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Seeker\'s Insight',
        description: 'You can cast Detect Magic at will without a spell slot.',
        mechanicalEffect: 'Detect Magic at will'
      },
      10: {
        threshold: 10,
        name: 'Lorekeeper\'s Mind',
        description: 'You have advantage on all Intelligence checks (History, Arcana, Religion, Nature). You learn one additional language.',
        mechanicalEffect: 'Advantage on all INT checks; +1 language'
      },
      25: {
        threshold: 25,
        name: 'Eye of the Mentor',
        description: 'Once per long rest, cast Legend Lore without a spell slot or material components. You have perfect recall of anything read in the last 30 days.',
        mechanicalEffect: 'Legend Lore 1/long rest (no slot/components); perfect recall 30 days'
      },
      50: {
        threshold: 50,
        name: 'The Knowing\'s Vessel',
        description: 'Increase INT by 2 (maximum 22). You are immune to psychic damage. Once per tenday, commune with Ioun.',
        mechanicalEffect: '+2 INT (max 22); immune to psychic; divine communion 1/tenday'
      }
    }
  },

  kord: {
    key: 'kord',
    name: 'Kord',
    title: 'The Stormlord',
    domains: ['Tempest', 'War'],
    increases: [
      'Win a battle or contest of strength through personal valor',
      'Challenge a powerful foe to single combat and fight honorably',
      'Perform a feat of extraordinary athletic prowess',
      'Rush headlong into a dangerous storm without fear',
      'Spare a worthy opponent who fought bravely'
    ],
    decreases: [
      'Flee from a fight you could have won',
      'Use poison, deception, or cowardly tactics to defeat a foe',
      'Refuse a direct challenge from a worthy opponent',
      'Show weakness or surrender without a fight',
      'Rely on others to fight your battles when you are able'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Thunderous Grip',
        description: 'Once per long rest, deal an extra 1d6 lightning damage on a melee weapon attack. You have advantage on Athletics checks.',
        mechanicalEffect: '+1d6 lightning on melee 1/long rest; advantage on Athletics'
      },
      10: {
        threshold: 10,
        name: 'Stormlord\'s Endurance',
        description: 'You have resistance to lightning and thunder damage. You gain proficiency in all martial weapons if not already proficient.',
        mechanicalEffect: 'Lightning/thunder resistance; all martial weapon proficiency'
      },
      25: {
        threshold: 25,
        name: 'Fury of the Storm',
        description: 'Once per long rest, cast Destructive Wave without a spell slot (thunder and lightning variant). Your melee attacks deal +1d6 lightning.',
        mechanicalEffect: 'Destructive Wave 1/long rest (no slot); +1d6 lightning on melee'
      },
      50: {
        threshold: 50,
        name: 'Champion of the Stormlord',
        description: 'Increase STR by 2 (maximum 22). You are immune to lightning damage and the Frightened condition. Once per tenday, commune with Kord.',
        mechanicalEffect: '+2 STR (max 22); immune to lightning/Frightened; divine communion 1/tenday'
      }
    }
  },

  melora: {
    key: 'melora',
    name: 'Melora',
    title: 'The Wildmother',
    domains: ['Nature', 'Tempest'],
    increases: [
      'Protect a natural wilderness from destruction or corruption',
      'Destroy an aberration or undead that defiles the natural order',
      'Live off the land and respect the balance of predator and prey',
      'Plant trees, restore damaged ecosystems, or cleanse polluted water',
      'Guide lost travelers safely through dangerous wilderness'
    ],
    decreases: [
      'Needlessly destroy natural habitats or kill animals for sport',
      'Use necromancy or create undead creatures',
      'Pollute waterways or poison the earth',
      'Aid those who exploit nature for greed without regard for balance',
      'Cage wild animals or bend nature to unnatural purposes'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Wildmother\'s Guidance',
        description: 'You can cast Druidcraft at will. You cannot become lost in natural terrain.',
        mechanicalEffect: 'Druidcraft at will; cannot be lost in natural terrain'
      },
      10: {
        threshold: 10,
        name: 'Nature\'s Resilience',
        description: 'You have resistance to poison damage and advantage on saves against the poisoned condition.',
        mechanicalEffect: 'Poison resistance; advantage vs. poisoned'
      },
      25: {
        threshold: 25,
        name: 'Call of the Wild',
        description: 'Once per long rest, cast Conjure Animals without a spell slot (beasts of CR 2 or lower). You gain +2 AC in natural terrain.',
        mechanicalEffect: 'Conjure Animals 1/long rest (no slot, CR ≤2); +2 AC in nature'
      },
      50: {
        threshold: 50,
        name: 'Voice of the Wildmother',
        description: 'Increase WIS by 2 (maximum 22). You are immune to poison damage and the poisoned condition. Once per tenday, commune with Melora.',
        mechanicalEffect: '+2 WIS (max 22); immune to poison/poisoned; divine communion 1/tenday'
      }
    }
  },

  // ---- GREYHAWK PANTHEON ----

  pelor: {
    key: 'pelor',
    name: 'Pelor',
    title: 'The Dawnfather',
    domains: ['Life', 'Light'],
    increases: [
      'Heal the sick or tend to the wounded without expectation of reward',
      'Destroy undead or fiends that lurk in darkness',
      'Bring hope and comfort to those suffering in despair',
      'Expose corruption or evil hidden in positions of authority',
      'Perform a sunrise prayer or dedicate a victory to the Dawnfather'
    ],
    decreases: [
      'Create or command undead creatures',
      'Extinguish sources of light or hope in a community',
      'Refuse to heal someone in mortal danger when you have the means',
      'Ally with creatures of darkness or evil for personal gain',
      'Spread despair or cause needless suffering'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Dawn\'s Light',
        description: 'You can cast Light and Sacred Flame at will.',
        mechanicalEffect: 'Light and Sacred Flame at will'
      },
      10: {
        threshold: 10,
        name: 'Dawnfather\'s Warmth',
        description: 'When you cast a spell that restores HP, add your proficiency bonus to the amount healed. You have resistance to radiant damage.',
        mechanicalEffect: '+proficiency bonus to healing spells; radiant resistance'
      },
      25: {
        threshold: 25,
        name: 'Sunburst Rebuke',
        description: 'Once per long rest, cast Sunbeam without a spell slot. Undead within 30 ft of you have disadvantage on all rolls.',
        mechanicalEffect: 'Sunbeam 1/long rest (no slot); undead disadvantage on all rolls (30 ft)'
      },
      50: {
        threshold: 50,
        name: 'Exarch of the Dawn',
        description: 'Increase WIS by 2 (maximum 22). You are immune to radiant damage and the Blinded condition. Once per tenday, commune with Pelor.',
        mechanicalEffect: '+2 WIS (max 22); immune to radiant/Blinded; divine communion 1/tenday'
      }
    }
  },

  vecna: {
    key: 'vecna',
    name: 'Vecna',
    title: 'The Whispered One',
    domains: ['Arcana', 'Death'],
    increases: [
      'Uncover a powerful secret and keep it for yourself',
      'Betray an ally to gain arcane power or forbidden knowledge',
      'Create undead servants or practice necromancy',
      'Destroy those who know your secrets or true plans',
      'Acquire a lost spell, artifact, or fragment of forbidden lore'
    ],
    decreases: [
      'Share a secret freely without extracting payment',
      'Destroy a source of arcane knowledge or forbidden lore',
      'Show loyalty or selflessness without ulterior motive',
      'Submit to the authority of another deity or power',
      'Allow someone to learn your true weaknesses or plans'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Whispered Secret',
        description: 'Once per long rest, cast Detect Thoughts without a spell slot. You have advantage on Arcana checks for forbidden knowledge.',
        mechanicalEffect: 'Detect Thoughts 1/long rest (no slot); advantage on Arcana (forbidden lore)'
      },
      10: {
        threshold: 10,
        name: 'Veil of Secrets',
        description: 'You are immune to having your thoughts read or alignment detected by any means. You have advantage on Deception checks.',
        mechanicalEffect: 'Immune to thought reading/alignment detection; advantage on Deception'
      },
      25: {
        threshold: 25,
        name: 'Hand of the Lich',
        description: 'Once per long rest, cast Finger of Death without a spell slot. Necrotic damage you deal ignores resistance.',
        mechanicalEffect: 'Finger of Death 1/long rest (no slot); necrotic pierces resistance'
      },
      50: {
        threshold: 50,
        name: 'Archlich\'s Heir',
        description: 'Increase INT by 2 (maximum 22). You are immune to necrotic damage. Once per long rest, when reduced to 0 HP, drop to 1 HP instead. Once per tenday, commune with Vecna.',
        mechanicalEffect: '+2 INT (max 22); immune to necrotic; cheat death 1/long rest; divine communion 1/tenday'
      }
    }
  },

  // ---- MORE EXANDRIAN DEITIES ----

  raven_queen: {
    key: 'raven_queen',
    name: 'The Raven Queen',
    title: 'Matron of Death',
    domains: ['Life', 'Death'],
    increases: [
      'Destroy undead abominations that defy the natural cycle of death',
      'Guide a dying creature peacefully to its final rest',
      'Prevent a soul from being trapped, consumed, or perverted',
      'Hunt down those who use necromancy to cheat death',
      'Perform funerary rites for the unburied dead'
    ],
    decreases: [
      'Create undead or use necromancy to raise the dead',
      'Attempt to resurrect someone who has passed on willingly',
      'Trap or consume souls for personal power',
      'Assist a lich, vampire, or other creature that has cheated death',
      'Desecrate a graveyard or place of final rest'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Death\'s Sight',
        description: 'You can cast Spare the Dying at will with a range of 30 feet. You can sense undead within 60 feet.',
        mechanicalEffect: 'Spare the Dying at will (30 ft); sense undead 60 ft'
      },
      10: {
        threshold: 10,
        name: 'Fate\'s Ward',
        description: 'You have resistance to necrotic damage and advantage on death saving throws.',
        mechanicalEffect: 'Necrotic resistance; advantage on death saves'
      },
      25: {
        threshold: 25,
        name: 'Raven\'s Mantle',
        description: 'Once per long rest, cast Spirit Guardians (necrotic) without a spell slot. While active, you gain a flying speed of 30 feet.',
        mechanicalEffect: 'Spirit Guardians (necrotic) 1/long rest (no slot); 30 ft fly while active'
      },
      50: {
        threshold: 50,
        name: 'Matron\'s Chosen',
        description: 'Increase WIS by 2 (maximum 22). You are immune to necrotic damage and cannot be aged magically. Once per tenday, commune with the Raven Queen.',
        mechanicalEffect: '+2 WIS (max 22); immune to necrotic/magical aging; divine communion 1/tenday'
      }
    }
  },

  torog: {
    key: 'torog',
    name: 'Torog',
    title: 'The Crawling King',
    domains: ['Death'],
    increases: [
      'Capture and imprison a creature in prolonged torment',
      'Tunnel deeper into the Underdark or discover hidden subterranean passages',
      'Break the will of a prisoner through suffering and despair',
      'Enslave creatures to labor in darkness beneath the earth',
      'Desecrate a temple of a surface deity deep underground'
    ],
    decreases: [
      'Free prisoners or break chains of enslavement',
      'Show mercy to a defeated foe instead of imprisoning them',
      'Seal or collapse tunnels into the Underdark',
      'Bring light and hope to those trapped in darkness',
      'Heal those who suffer from torture or long captivity'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Jailer\'s Grasp',
        description: 'Once per long rest, when you hit with a melee attack, the target must STR save (DC 8 + proficiency + STR mod) or be restrained until end of your next turn.',
        mechanicalEffect: 'Melee restrain (STR save) 1/long rest'
      },
      10: {
        threshold: 10,
        name: 'Eyes of the Depths',
        description: 'You gain darkvision 120 feet (or extend existing by 60 feet). You have advantage on Survival checks underground.',
        mechanicalEffect: 'Darkvision 120 ft (or +60 ft); advantage on Survival underground'
      },
      25: {
        threshold: 25,
        name: 'Chains of Torment',
        description: 'Once per long rest, cast Hold Monster without a spell slot. Creatures you restrain cannot teleport or plane shift.',
        mechanicalEffect: 'Hold Monster 1/long rest (no slot); restrained targets can\'t teleport'
      },
      50: {
        threshold: 50,
        name: 'The Crawling King\'s Warden',
        description: 'Increase CON by 2 (maximum 22). You are immune to Restrained and Paralyzed conditions. Once per tenday, commune with Torog.',
        mechanicalEffect: '+2 CON (max 22); immune to Restrained/Paralyzed; divine communion 1/tenday'
      }
    }
  },

  zehir: {
    key: 'zehir',
    name: 'Zehir',
    title: 'The Cloaked Serpent',
    domains: ['Trickery', 'Death'],
    increases: [
      'Assassinate a target through stealth and poison',
      'Spread darkness, fear, or distrust in a community',
      'Breed or command venomous serpents',
      'Betray someone who trusted you for personal gain',
      'Perform a ritual sacrifice under the cover of night'
    ],
    decreases: [
      'Cure poison or heal someone afflicted by venom',
      'Kill snakes or serpentine creatures needlessly',
      'Act openly and honestly when deception would serve better',
      'Show mercy to an enemy who has seen your true nature',
      'Bring light or expose hidden things to public view'
    ],
    thresholds: {
      3: {
        threshold: 3,
        name: 'Serpent\'s Kiss',
        description: 'Your weapon attacks deal an extra 1d4 poison damage. You have resistance to poison damage.',
        mechanicalEffect: '+1d4 poison on weapons; poison resistance'
      },
      10: {
        threshold: 10,
        name: 'Cloaked in Shadow',
        description: 'You have advantage on Stealth in dim light or darkness. You are immune to the poisoned condition.',
        mechanicalEffect: 'Advantage on Stealth (dim/dark); immune to poisoned'
      },
      25: {
        threshold: 25,
        name: 'Venomfang Strike',
        description: 'Once per long rest, cast Cloudkill without a spell slot. Your weapon attacks deal +1d6 poison damage (replaces the 1d4).',
        mechanicalEffect: 'Cloudkill 1/long rest (no slot); +1d6 poison on weapons (upgrade)'
      },
      50: {
        threshold: 50,
        name: 'Avatar of the Cloaked Serpent',
        description: 'Increase DEX by 2 (maximum 22). You are immune to poison damage. Once per tenday, commune with Zehir.',
        mechanicalEffect: '+2 DEX (max 22); immune to poison; divine communion 1/tenday'
      }
    }
  }
};

// ============================================================================
// 5. EPIC BOONS (2024 PHB — available at Level 19+)
// ============================================================================

export const EPIC_BOONS = [
  {
    key: 'combat_prowess',
    name: 'Combat Prowess',
    description: 'Turn one miss per round into a hit.',
    mechanicalEffect: 'Once per round, when you miss with an attack roll, you can treat it as a hit instead.',
    abilityScoreIncrease: '+1 to any ability score (max 30)'
  },
  {
    key: 'dimensional_travel',
    name: 'Dimensional Travel',
    description: 'Teleport 30 ft after Attack or Magic action.',
    mechanicalEffect: 'Immediately after taking the Attack or Magic action, teleport up to 30 ft to an unoccupied space you can see.',
    abilityScoreIncrease: '+1 to any ability score (max 30)'
  },
  {
    key: 'energy_resistance',
    name: 'Energy Resistance',
    description: 'Resistance to two damage types of your choice.',
    mechanicalEffect: 'Choose two damage types. You gain resistance to both.',
    abilityScoreIncrease: '+1 to any ability score (max 30)'
  },
  {
    key: 'fate',
    name: 'Fate',
    description: 'Manipulate d20 tests by adding or subtracting 2d4.',
    mechanicalEffect: 'When any creature you can see succeeds or fails a d20 test, add or subtract 2d4 to the roll. Resets on initiative roll or rest.',
    abilityScoreIncrease: '+1 to any ability score (max 30)'
  },
  {
    key: 'fortitude',
    name: 'Fortitude',
    description: '+40 max HP and enhanced healing received.',
    mechanicalEffect: 'Your HP maximum increases by 40. Whenever you receive healing, add your Constitution modifier to the amount healed.',
    abilityScoreIncrease: '+1 to any ability score (max 30)'
  },
  {
    key: 'irresistible_offense',
    name: 'Irresistible Offense',
    description: 'Bludgeoning/piercing/slashing ignores resistance, extra damage on nat 20.',
    mechanicalEffect: 'Your bludgeoning, piercing, and slashing damage ignores resistance. On a natural 20, deal extra damage equal to the ability modifier used for the attack.',
    abilityScoreIncrease: '+1 to any ability score (max 30)'
  },
  {
    key: 'recovery',
    name: 'Recovery',
    description: '10d10 self-healing pool per long rest with auto-stabilize.',
    mechanicalEffect: 'Gain a pool of 10d10 healing per long rest, usable as a bonus action. If reduced to 0 HP, automatically use 1d10 and regain that many HP.',
    abilityScoreIncrease: '+1 to any ability score (max 30)'
  },
  {
    key: 'skill',
    name: 'Skill',
    description: 'Proficiency in all skills, expertise in one.',
    mechanicalEffect: 'Gain proficiency in all skills. Choose one skill: you gain expertise in it (double proficiency bonus).',
    abilityScoreIncrease: '+1 to any ability score (max 30)'
  },
  {
    key: 'speed',
    name: 'Speed',
    description: '+30 ft movement, no opportunity attacks after attacking.',
    mechanicalEffect: 'Your speed increases by 30 ft. After you take the Attack action, no creature can make opportunity attacks against you for the rest of your turn.',
    abilityScoreIncrease: '+1 to any ability score (max 30)'
  },
  {
    key: 'spell_recall',
    name: 'Spell Recall',
    description: 'Cast one prepared/known spell without a slot, 1/long rest.',
    mechanicalEffect: 'Once per long rest, cast a spell you have prepared or know without expending a spell slot. The spell must be 5th level or lower.',
    abilityScoreIncrease: '+1 to any ability score (max 30)'
  },
  {
    key: 'truesight',
    name: 'Truesight',
    description: 'Truesight 60 ft, enhanced stealth, immune to divination.',
    mechanicalEffect: 'Gain Truesight out to 60 ft. Gain +10 to Stealth checks. You are immune to divination spells and effects.',
    abilityScoreIncrease: '+1 to any ability score (max 30)'
  },
  {
    key: 'night_spirit',
    name: 'Night Spirit',
    description: 'Invisible in dim light/darkness, immunity to lightning/thunder, Thunderwave at will.',
    mechanicalEffect: 'You are invisible while in dim light or darkness until you take an action or reaction. Immune to lightning and thunder damage. Cast Thunderwave at will.',
    abilityScoreIncrease: '+1 to any ability score (max 30)'
  }
];

// ============================================================================
// 6. SHADOW PATH INTERACTION
// ============================================================================

export const SHADOW_PATH_INTERACTION = {
  light: {
    paths: ['hierophant', 'angel', 'azata', 'gold_dragon', 'redemption'],
    fullPowerMaxShadow: 2,
    weakenedMaxShadow: 5,
    lockedMinShadow: 6,
    description: 'Shadow 0-2: full power. Shadow 3-5: abilities weakened. Shadow 6+: locked out of path abilities until reduced.'
  },
  dark: {
    paths: ['demon', 'lich', 'devil', 'corrupted_dawn'],
    fullPowerMinShadow: 0,
    description: 'Dark paths are powered by shadow. Higher Shadow = more powerful. No restrictions.'
  },
  neutral: {
    paths: ['aeon', 'trickster', 'legend'],
    description: 'Shadow Points tracked but do not directly affect path abilities.'
  }
};

// ============================================================================
// 7. HELPER FUNCTIONS
// ============================================================================

/** Get tier info by tier number (1-5). Returns null if invalid. */
export function getMythicTierInfo(tier) {
  return MYTHIC_TIERS.find(t => t.tier === tier) || null;
}

/** Get all base abilities cumulative up to and including the given tier. */
export function getBaseAbilitiesForTier(tier) {
  const result = [];
  for (let t = 1; t <= tier; t++) {
    const key = `tier${t}`;
    if (BASE_MYTHIC_ABILITIES[key]) {
      result.push(...BASE_MYTHIC_ABILITIES[key]);
    }
  }
  return result;
}

/** Get path info object by path key. Returns null if not found. */
export function getPathInfo(pathKey) {
  return MYTHIC_PATHS[pathKey] || null;
}

/** Get all path abilities cumulative up to and including the given tier. */
export function getPathAbilitiesForTier(pathKey, tier) {
  const path = MYTHIC_PATHS[pathKey];
  if (!path || !path.abilities) return [];
  const result = [];
  for (let t = 1; t <= tier; t++) {
    const key = `tier${t}`;
    if (path.abilities[key]) {
      result.push(...path.abilities[key]);
    }
  }
  return result;
}

/** Get all path abilities as a flat array (all tiers combined). */
export function getAllPathAbilitiesFlat(pathKey) {
  return getPathAbilitiesForTier(pathKey, 5);
}

/** Get deity piety info by deity key. Returns null if not found. */
export function getDeityPiety(deityKey) {
  return PIETY_DEITIES[deityKey] || null;
}

/** Get the highest piety threshold reached for a given score. Returns null if below minimum threshold. */
export function getPietyThreshold(deityKey, score) {
  const deity = PIETY_DEITIES[deityKey];
  if (!deity || !deity.thresholds) return null;
  const thresholdLevels = Object.keys(deity.thresholds).map(Number).sort((a, b) => b - a);
  for (const level of thresholdLevels) {
    if (score >= level) {
      return deity.thresholds[level];
    }
  }
  return null;
}

/** Get an epic boon by key. Returns null if not found. */
export function getEpicBoon(key) {
  return EPIC_BOONS.find(b => b.key === key) || null;
}

/** Get max mythic power for a tier: 3 + (2 * tier). */
export function getMythicPowerMax(tier) {
  const info = getMythicTierInfo(tier);
  return info ? info.mythicPowerBase : 0;
}

/** Get surge die for a tier. */
export function getSurgeDie(tier) {
  const info = getMythicTierInfo(tier);
  return info ? info.surgeDie : 'd6';
}

/** Check if a path can be selected given current shadow points. */
export function canSelectPath(pathKey, shadowPoints) {
  const category = getShadowCategory(pathKey);
  if (category === 'light') {
    return shadowPoints <= SHADOW_PATH_INTERACTION.light.weakenedMaxShadow;
  }
  // Dark and neutral paths have no shadow restriction for selection
  return true;
}

/** Check if a path key is the Legend path. */
export function isLegendPath(pathKey) {
  return pathKey === 'legend';
}

/** Get trials required for a given tier. */
export function getTrialsRequired(tier) {
  const info = getMythicTierInfo(tier);
  return info ? info.trialsRequired : 0;
}

/** Get all player-selectable paths (excluding DM-only and non-selectable). */
export function getPlayerSelectablePaths() {
  return Object.values(MYTHIC_PATHS).filter(p => p.isPlayerSelectable === true);
}

/** Get shadow category for a path: 'light', 'dark', or 'neutral'. */
export function getShadowCategory(pathKey) {
  if (SHADOW_PATH_INTERACTION.light.paths.includes(pathKey)) return 'light';
  if (SHADOW_PATH_INTERACTION.dark.paths.includes(pathKey)) return 'dark';
  if (SHADOW_PATH_INTERACTION.neutral.paths.includes(pathKey)) return 'neutral';
  // DM-only paths default to dark
  return 'dark';
}
