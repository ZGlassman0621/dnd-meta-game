/**
 * Magus subclasses — Eldritch Societies (Sterling Vermin, 2016-2019,
 * 2014-era). Transcribed ONLY from the verified digest at
 * ~/workspace/dnd-app-review/new-classes-staging/digests/magus.md.
 *
 * Selection level 1; society features at 1st, 3rd, 7th, 14th.
 * Society spell lists (451 entries across the 6 lists) are ANOTHER
 * agent's data file (planned server/data/newClassSpellLists.js):
 * entries below reference the society key in
 * mechanics.societySpellList and NEVER duplicate a spell list.
 * Cantrip grants follow the existing registry pattern (survey §4):
 * mechanics.cantrip is prompt text, not a spell-list write, and
 * granted cantrips never count against cantrips known.
 *
 * Origin: the digest names NO setting for Sterling Vermin material.
 * Entries therefore carry origin_setting 'Sterling Vermin
 * (setting-neutral)' rather than an invented Forgotten Realms
 * origin. Under the existing validator (isOutsideFr = setting !==
 * 'Forgotten Realms') that flags these as requiring an origin
 * explanation until the coordinator rules whether setting-neutral
 * third-party classes count as FR-available. Do NOT silently flip
 * this to 'Forgotten Realms' at merge.
 *
 * UNRESOLVED, carried forward (digest §UNRESOLVED):
 * - Sidereal Cabal multiclass prerequisite not printed.
 * - Primordial Seal spellcasting focus not stated (null in the
 *   service's SOCIETY_FOCUS; no focus line is claimed here).
 * - Society spell-list counts need re-verification against the
 *   PDF layout (interleaved columns), especially Shadow Court
 *   2nd level and Sidereal Cabal 2nd level.
 * Every feature below is gateCheck: true — 2014-era numbers need
 * Zach's gate, and no 2024 conversion is applied (see
 * conversions-magus.md: none — as written).
 */

export const MAGUS_SUBCLASSES = [
  {
    key: 'arcane_order',
    name: 'The Arcane Order',
    description: 'A magus of the Arcane Order who binds force to blade and shield to ally. Your enspell strikes with force or hurls foes down, your aegis turns aside harm, and at your peak you recover spent slots on a short rest.',
    class: 'magus',
    source: 'Sterling Vermin — Magus (DMs Guild, 2016–2019)',
    sourceTier: 'scanned',
    origin_setting: 'Sterling Vermin (setting-neutral)',
    origin_region: 'Sterling Vermin (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'arcane_order_initiate',
        name: 'Initiate of the Arcane Order',
        level: 1,
        kind: 'E',
        mechanics: {
          spellcastingAbility: 'int',
          focus: 'arcane focus',
          cantrip: 'Society cantrips: 2 at 1st, +1 at 4th, +1 at 10th, chosen from the Arcane Order list; they count as magus spells and do not double-count against cantrips known.',
          societySpellList: 'arcane_order',
          bonusProficiencies: ['Arcana', "one set of artisan's tools"],
        },
        prompt: 'Arcane Order Initiate: spellcasting ability Intelligence, arcane focus. Bonus proficiencies: Arcana and one set of artisan\'s tools. Society cantrips (2 at 1st, +1 at 4th, +1 at 10th) come from the Arcane Order list.',
        engine: 'DM-prompt only in v1 (cantrip grant is a prompt line, not a spell-list write; list validation follows the newClassSpellLists data file).',
        gateCheck: true,
      },
      {
        key: 'amethyst_mark',
        name: 'Amethyst Mark',
        level: 3,
        kind: 'E',
        mechanics: {
          arcaneEnspell: 'Deal force damage instead of the weapon normal damage type; or remove the enspell on dealing damage to force a Strength saving throw or push the target 15 feet and knock it prone.',
          arcaneAegis: 'Reaction when an aegis-protected creature takes damage: remove the aegis, teleport up to 30 feet, and make a weapon attack against the attacker.',
        },
        prompt: 'Amethyst Mark: Arcane Enspell may deal force damage, or be removed on dealing damage to force a Strength save or push 15 feet + knock prone. Arcane Aegis: reaction when an aegis target takes damage — remove the aegis, teleport up to 30 feet, attack the attacker.',
        engine: 'DM-prompt only in v1 (no enspell/aegis combat hook exists yet).',
        gateCheck: true,
      },
      {
        key: 'occult_savant',
        name: 'Occult Savant',
        level: 7,
        kind: 'E',
        mechanics: {
          bonusSpells: 'Learn 2 spells of your choice from any society list, of a level you can cast (or cantrips); they count as Arcane Order spells and do not count toward Spells Known.',
        },
        prompt: 'Occult Savant: two spells learned from any society list (a level you can cast, or cantrips) count as Arcane Order spells and do not count toward Spells Known.',
        engine: 'DM-prompt only in v1 (spell-list validation follows the newClassSpellLists data file).',
        gateCheck: true,
      },
      {
        key: 'arcane_recovery',
        name: 'Arcane Recovery',
        level: 14,
        kind: 'E',
        mechanics: {
          recovery: 'Once per day when finishing a short rest, recover expended spell slots with a combined level equal to or less than half your magus level (rounded up); none may be 6th level or higher.',
        },
        prompt: 'Arcane Recovery: once per day, on finishing a short rest, recover expended slots totalling at most half your magus level (rounded up); no recovered slot may be 6th level or higher.',
        engine: 'DM-prompt only in v1 (slot recovery is DM-adjudicated until a slot-spend engine exists).',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'knights_stygian',
    name: 'The Knights Stygian',
    description: 'A magus of the Knights Stygian who wields necrotic power and fear. Your enspell chills with death or frightens the struck, your aegis answers attacks, and at your peak you raise the dead without a slot and they fight stronger.',
    class: 'magus',
    source: 'Sterling Vermin — Magus (DMs Guild, 2016–2019)',
    sourceTier: 'scanned',
    origin_setting: 'Sterling Vermin (setting-neutral)',
    origin_region: 'Sterling Vermin (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'knights_stygian_initiate',
        name: 'Initiate of the Knights Stygian',
        level: 1,
        kind: 'E',
        mechanics: {
          spellcastingAbility: 'cha',
          focus: 'arcane focus',
          cantrip: 'Society cantrips: 2 at 1st, +1 at 4th, +1 at 10th, chosen from the Knights Stygian list; they count as magus spells and do not double-count against cantrips known.',
          societySpellList: 'knights_stygian',
          bonusProficiencies: ['Intimidation', "embalmer's tools"],
        },
        prompt: 'Knights Stygian Initiate: spellcasting ability Charisma, arcane focus. Bonus proficiencies: Intimidation and embalmer\'s tools. Society cantrips (2 at 1st, +1 at 4th, +1 at 10th) come from the Knights Stygian list.',
        engine: 'DM-prompt only in v1 (see Arcane Order Initiate engine note).',
        gateCheck: true,
      },
      {
        key: 'obsidian_seal',
        name: 'Obsidian Seal',
        level: 3,
        kind: 'E',
        mechanics: {
          stygianEnspell: 'Deal necrotic damage instead of the weapon normal damage type; or remove the enspell on a hit to force a Wisdom saving throw or frighten the target until the end of your next turn.',
          stygianAegis: 'Reaction when an aegis-protected creature takes damage from an attack: remove the aegis, and the attacker makes a Constitution saving throw or takes necrotic damage equal to the triggering damage.',
        },
        prompt: 'Obsidian Seal: Stygian Enspell may deal necrotic damage, or be removed on a hit to force a Wisdom save or frighten until the end of your next turn. Stygian Aegis: reaction when an aegis target takes attack damage — remove the aegis, attacker saves Constitution or takes necrotic damage equal to the triggering damage.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'face_of_fear',
        name: 'Face of Fear',
        level: 7,
        kind: 'E',
        mechanics: {
          advantageOnSavesVsFrightened: true,
          reaction: 'Give disadvantage to a creature within 30 feet on a saving throw against being frightened.',
        },
        prompt: 'Face of Fear: advantage on saving throws against being frightened; reaction to give a creature within 30 feet disadvantage on a save against being frightened.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'necromantic_surge',
        name: 'Necromantic Surge',
        level: 14,
        kind: 'E',
        mechanics: {
          animateDeadWithoutSlot: 'Cast animate dead once without expending a spell slot, as if using your highest available slot; 1/long rest.',
          undeadBonus: 'Undead created by your necromancy spells gain bonus maximum hit points equal to your magus level and add your proficiency bonus to weapon damage rolls.',
        },
        prompt: 'Necromantic Surge: cast animate dead once without a slot, as if using your highest slot (1/long rest). Undead from your necromancy spells gain +magus level maximum HP and add your proficiency bonus to weapon damage.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'primordial_seal',
    name: 'The Primordial Seal',
    description: 'A magus of the Primordial Seal who speaks the elements\' own tongue. Your enspell takes any element\'s shape or strips its resistance, your body aligns to your chosen element, and at your peak you call its investiture without a slot and hold it unbroken.',
    class: 'magus',
    source: 'Sterling Vermin — Magus (DMs Guild, 2016–2019)',
    sourceTier: 'scanned',
    origin_setting: 'Sterling Vermin (setting-neutral)',
    origin_region: 'Sterling Vermin (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'primordial_seal_initiate',
        name: 'Initiate of the Primordial Seal',
        level: 1,
        kind: 'E',
        mechanics: {
          spellcastingAbility: 'cha',
          focus: null, // UNRESOLVED: not stated in the digest.
          cantrip: 'Society cantrips: 2 at 1st, +1 at 4th, +1 at 10th, chosen from the Primordial Seal list; they count as magus spells and do not double-count against cantrips known.',
          societySpellList: 'primordial_seal',
          bonusProficiencies: ['Survival'],
          bonusLanguages: ['Primordial'],
        },
        prompt: 'Primordial Seal Initiate: spellcasting ability Charisma. Bonus proficiency: Survival; speak, read, and write Primordial. Society cantrips (2 at 1st, +1 at 4th, +1 at 10th) come from the Primordial Seal list. Spellcasting focus: NOT STATED in the source — do not assume one.',
        engine: 'DM-prompt only in v1 (see Arcane Order Initiate engine note).',
        gateCheck: true,
      },
      {
        key: 'tourmaline_mark',
        name: 'Tourmaline Mark',
        level: 3,
        kind: 'E',
        mechanics: {
          primordialEnspell: 'While enspelled, choose acid, cold, fire, lightning, or thunder as the weapon damage type; or remove the enspell on a hit to force a Constitution saving throw or lose resistance/immunity to that type until the end of your next turn.',
          primordialAegis: 'Reaction when an aegis-protected creature takes damage: remove the aegis and grant resistance to one chosen element type for 1 minute.',
        },
        prompt: 'Tourmaline Mark: Primordial Enspell sets the weapon damage type to acid, cold, fire, lightning, or thunder, or is removed on a hit to force a Constitution save or strip resistance/immunity to that type until the end of your next turn. Primordial Aegis: reaction when an aegis target takes damage — remove the aegis, grant resistance to one element type for 1 minute.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'elemental_alignment',
        name: 'Elemental Alignment',
        level: 7,
        kind: 'G',
        mechanics: {
          choiceKey: 'elemental_alignment',
          options: ['Air', 'Earth', 'Fire', 'Water'],
          air: '+10 feet speed, advantage on initiative rolls.',
          earth: '+2 hit points per magus level, +2 per level gained.',
          fire: 'Darkvision 120 feet, proficiency in Dexterity saving throws.',
          water: 'Water breathing, swim speed equal to walking speed, advantage on saving throws and checks against being restrained or grappled.',
        },
        prompt: 'Elemental Alignment: choose one element — Air (+10 speed, advantage on initiative), Earth (+2 HP per magus level and per level gained), Fire (darkvision 120 feet, Dexterity save proficiency), or Water (water breathing, swim speed = walking speed, advantage vs restrained/grappled).',
        engine: 'Stored choice (subclass_choices_json); effects are DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'elemental_attunement',
        name: 'Elemental Attunement',
        level: 14,
        kind: 'E',
        mechanics: {
          investitureByElement: {
            Air: 'Investiture of Wind',
            Earth: 'Investiture of Stone',
            Fire: 'Investiture of Flame',
            Water: 'Investiture of Ice',
          },
          investiture: 'Cast your element investiture spell without expending a spell slot; you cannot lose concentration on it from taking damage; 1/long rest.',
        },
        prompt: 'Elemental Attunement: cast your element\'s investiture spell (Air: Wind, Earth: Stone, Fire: Flame, Water: Ice) without a slot, and damage cannot break your concentration on it; 1/long rest.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'elemental_alignment', level: 7, options: ['Air', 'Earth', 'Fire', 'Water'] },
    ],
  },
  {
    key: 'shadow_court',
    name: 'The Shadow Court',
    description: 'A magus of the Shadow Court who fights from darkness with unarmed strikes and mirrors. Your enspell blinds the struck, your duplicates fight beside you, and at your peak a hit turns to nothing as you vanish and reappear three hundred feet away.',
    class: 'magus',
    source: 'Sterling Vermin — Magus (DMs Guild, 2016–2019)',
    sourceTier: 'scanned',
    origin_setting: 'Sterling Vermin (setting-neutral)',
    origin_region: 'Sterling Vermin (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'shadow_court_initiate',
        name: 'Initiate of the Shadow Court',
        level: 1,
        kind: 'E',
        mechanics: {
          spellcastingAbility: 'int',
          focus: 'arcane focus',
          cantrip: 'Society cantrips: 2 at 1st, +1 at 4th, +1 at 10th, chosen from the Shadow Court list; they count as magus spells and do not double-count against cantrips known.',
          societySpellList: 'shadow_court',
          bonusProficiencies: ['Deception', 'Stealth'],
        },
        prompt: 'Shadow Court Initiate: spellcasting ability Intelligence, arcane focus. Bonus proficiencies: Deception and Stealth. Society cantrips (2 at 1st, +1 at 4th, +1 at 10th) come from the Shadow Court list.',
        engine: 'DM-prompt only in v1 (see Arcane Order Initiate engine note).',
        gateCheck: true,
      },
      {
        key: 'jade_seal',
        name: 'Jade Seal',
        level: 3,
        kind: 'E',
        mechanics: {
          shadowEnspell: 'May also enspell unarmed strikes: use Dexterity for attack and damage rolls and roll 1d6 instead of normal unarmed damage; or remove the enspell on a hit to force a Constitution saving throw or blind the target until the start of its next turn.',
          shadowAegis: 'Reaction when an aegis-protected creature takes damage from an attack: remove the aegis, and the target becomes invisible until the end of its next turn or until it casts a spell or attacks.',
        },
        prompt: 'Jade Seal: Shadow Enspell may apply to unarmed strikes (Dexterity for attack/damage, 1d6 damage), or be removed on a hit to force a Constitution save or blind until the start of its next turn. Shadow Aegis: reaction when an aegis target takes attack damage — remove the aegis, target turns invisible until the end of its next turn or until it casts a spell or attacks.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'broken_mirror_jutsu',
        name: 'Broken Mirror Jutsu',
        level: 7,
        kind: 'E',
        mechanics: {
          cost: 'Expend a spell slot to summon duplicates in unoccupied spaces within 60 feet, equal in number to the slot level.',
          attack: 'You and each duplicate make a melee spell attack against a creature within 5 feet for 1d10 + Intelligence modifier force damage.',
          stun: 'If all attack the same creature and at least one deals damage, the creature makes a Constitution saving throw or is stunned until the end of your next turn.',
        },
        prompt: 'Broken Mirror Jutsu: expend a slot to summon duplicates (count = slot level) in unoccupied spaces within 60 feet; you and each duplicate make a melee spell attack within 5 feet for 1d10 + Intelligence modifier force damage. If all hit the same creature and at least one deals damage, it saves Constitution or is stunned until the end of your next turn.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'false_body_jutsu',
        name: 'False Body Jutsu',
        level: 14,
        kind: 'E',
        mechanics: {
          reaction: 'When hit: reduce the damage to 1, become invisible for 1 minute, and teleport up to 300 feet to an unoccupied space, leaving behind a block of wood or harmless mundane object; 1/long rest.',
        },
        prompt: 'False Body Jutsu: reaction when hit — damage becomes 1, you turn invisible for 1 minute and teleport up to 300 feet to an unoccupied space, leaving a block of wood or harmless mundane object behind; 1/long rest.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'sidereal_cabal',
    name: 'The Sidereal Cabal',
    description: 'A magus of the Sidereal Cabal who bends fate\'s dice themselves. Your enspell strikes true or rerolls a miss, your clockwork turns a die up or down by your will, and at your peak you force fate to roll three dice instead of two.',
    class: 'magus',
    source: 'Sterling Vermin — Magus (DMs Guild, 2016–2019)',
    sourceTier: 'scanned',
    origin_setting: 'Sterling Vermin (setting-neutral)',
    origin_region: 'Sterling Vermin (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'sidereal_cabal_initiate',
        name: 'Initiate of the Sidereal Cabal',
        level: 1,
        kind: 'E',
        mechanics: {
          spellcastingAbility: 'int',
          focus: 'astrolabe or arcane focus',
          cantrip: 'Society cantrips: 2 at 1st, +1 at 4th, +1 at 10th, chosen from the Sidereal Cabal list; they count as magus spells and do not double-count against cantrips known.',
          societySpellList: 'sidereal_cabal',
          bonusProficiencies: ['Perception', "navigator's tools", 'water vehicles'],
        },
        prompt: 'Sidereal Cabal Initiate: spellcasting ability Intelligence, astrolabe or arcane focus. Bonus proficiencies: Perception, navigator\'s tools, water vehicles. Society cantrips (2 at 1st, +1 at 4th, +1 at 10th) come from the Sidereal Cabal list.',
        engine: 'DM-prompt only in v1 (see Arcane Order Initiate engine note).',
        gateCheck: true,
      },
      {
        key: 'selenite_seal',
        name: 'Selenite Seal',
        level: 3,
        kind: 'E',
        mechanics: {
          siderealEnspell: 'Deal force damage instead of the weapon normal damage type; or on a miss, remove the enspell to reroll the attack with advantage.',
          siderealAegis: 'Reaction when an attack hits an aegis-protected creature: remove the aegis, and the attacker rerolls the attack with disadvantage.',
        },
        prompt: 'Selenite Seal: Sidereal Enspell may deal force damage, or be removed on a miss to reroll the attack with advantage. Sidereal Aegis: reaction when an attack hits an aegis target — remove the aegis, attacker rerolls with disadvantage.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'celestial_clockwork_control',
        name: 'Celestial Clockwork Control',
        level: 7,
        kind: 'E',
        mechanics: {
          reaction: 'When a creature within 60 feet makes an ability check, attack roll, or saving throw, expend a spell slot to increase or decrease the die result (not the total) by the slot level, potentially turning it into a natural 1 or 20.',
        },
        prompt: 'Celestial Clockwork Control: reaction + expend a slot when a creature within 60 feet makes a check, attack, or save — raise or lower the die result (not the total) by the slot level, which can turn it into a natural 1 or 20.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'seal_fate',
        name: 'Seal Fate',
        level: 14,
        kind: 'E',
        mechanics: {
          reaction: 'When a creature within 60 feet rolls with advantage or disadvantage, it instead rolls three d20s, using the highest (advantage) or lowest (disadvantage).',
        },
        prompt: 'Seal Fate: reaction when a creature within 60 feet rolls with advantage or disadvantage — it rolls three d20s instead, taking the highest for advantage or the lowest for disadvantage.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'sylvan_circle',
    name: 'The Sylvan Circle',
    description: 'A magus of the Sylvan Circle who wields poison and the wild\'s own magic. Your enspell poisons or binds the struck, you can wear another shape without a slot, and at your peak your magic heals you and your allies alike.',
    class: 'magus',
    source: 'Sterling Vermin — Magus (DMs Guild, 2016–2019)',
    sourceTier: 'scanned',
    origin_setting: 'Sterling Vermin (setting-neutral)',
    origin_region: 'Sterling Vermin (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'sylvan_circle_initiate',
        name: 'Initiate of the Sylvan Circle',
        level: 1,
        kind: 'E',
        mechanics: {
          spellcastingAbility: 'wis',
          focus: 'druidic focus',
          cantrip: 'Society cantrips: 2 at 1st, +1 at 4th, +1 at 10th, chosen from the Sylvan Circle list; they count as magus spells and do not double-count against cantrips known.',
          societySpellList: 'sylvan_circle',
          bonusProficiencies: ['Nature', 'herbalism kit or poisoner\'s kit'],
        },
        prompt: 'Sylvan Circle Initiate: spellcasting ability Wisdom, druidic focus. Bonus proficiencies: Nature and a herbalism kit or poisoner\'s kit. Society cantrips (2 at 1st, +1 at 4th, +1 at 10th) come from the Sylvan Circle list.',
        engine: 'DM-prompt only in v1 (see Arcane Order Initiate engine note).',
        gateCheck: true,
      },
      {
        key: 'emerald_mark',
        name: 'Emerald Mark',
        level: 3,
        kind: 'E',
        mechanics: {
          sylvanEnspell: 'Deal poison damage instead of the weapon normal damage type; or remove the enspell on dealing damage to force a Strength saving throw or restrain the target until the end of your next turn as roots tether it.',
          sylvanAegis: 'Reaction when an aegis-protected creature fails a saving throw: remove the aegis, and the target rerolls the save with advantage.',
        },
        prompt: 'Emerald Mark: Sylvan Enspell may deal poison damage, or be removed on dealing damage to force a Strength save or restrain until the end of your next turn. Sylvan Aegis: reaction when an aegis target fails a save — remove the aegis, target rerolls with advantage.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'natures_mask',
        name: "Nature's Mask",
        level: 7,
        kind: 'E',
        mechanics: {
          polymorphSelfWithoutSlot: 'Cast polymorph on yourself without expending a spell slot; 1/long rest.',
        },
        prompt: 'Nature\'s Mask: cast polymorph on yourself without a slot; 1/long rest.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'font_of_life',
        name: 'Font of Life',
        level: 14,
        kind: 'E',
        mechanics: {
          healing: 'Bonus action + expend a spell slot: regain magus level + 1d12 hit points per slot level; chosen creatures within 30 feet regain half that amount; 1/short-or-long rest.',
        },
        prompt: 'Font of Life: bonus action + expend a slot — regain magus level + 1d12 HP per slot level, and chosen creatures within 30 feet regain half that amount; 1/short-or-long rest.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
    ],
  },
];
