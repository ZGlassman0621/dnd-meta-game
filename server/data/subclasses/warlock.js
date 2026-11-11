/**
 * Warlock subclasses — Batch 2 (PHB 2024 spell-list classes).
 *
 * PHB-photo verification (2026-11-06, 11 photos, pp. 153-163):
 * the four PHB patrons below (Archfey, Celestial, Fiend, Great Old
 * One) were reconciled against Zach's PHB photos — spell lists,
 * feature names, levels, and mechanics are PHB-verified, written
 * in the app's own wording, never copied verbatim. The gate-check
 * warning below now applies ONLY to Hexblade + The Ancient Dragon.
 *
 * Gate-check warning, read this before trusting any number below
 * (Hexblade + The Ancient Dragon only): there is no 2024 PHB PDF
 * in the scanned folder, so these entries were NOT extracted from
 * Zach's PHB. They were authored from 2024 knowledge in the app's
 * own wording, never copied verbatim, and every level and number
 * below is still a gate check item for Zach against his own PHB —
 * nothing here is presented as verified from the book itself.
 *
 * Selection level: 3rd for all four patrons, following the 2024
 * unification (2014 patrons were 1st — do NOT carry that over).
 * That level, like every feature level here, is gateCheck-flagged.
 *
 * Patron-spell distinction (kind D, and the point of this batch
 * for Warlock): patron spells are ADDED TO THE WARLOCK SPELL
 * LIST, not always prepared. That is different from Cleric
 * domain spells, which are always prepared — the prompt section
 * says which of the two applies, and the two helpers in
 * subclassService keep them apart.
 *
 * Celestial note: Celestial Patron is counted here once, as
 * PHB 2024. It also appears in Xanathar's Guide to Everything;
 * it must NOT be double-counted against the scanned pool.
 *
 * PC vs companion split (combat item 2, binding): these entries
 * return numbers and prompt text. They never add anything to a
 * PC's reported total. Companion math callers apply the numbers
 * directly; PC callers surface them as instructions and let the
 * player apply them.
 *
 * Origin: PHB core, Forgotten Realms available, no origin
 * explanation required. Origin fields exist on every entry for
 * later outside-FR batches.
 */

export const WARLOCK_SUBCLASSES = [
  {
    key: 'archfey_patron',
    name: 'Archfey Patron',
    description: 'A warlock of the fey courts — beguiling, elusive, and impossible to pin down. You step through the Feywild at will, vanish when struck, charm all who meet you, and at your peak every enchantment you cast carries you through the mist.',
    class: 'warlock',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    features: [
      {
        key: 'archfey_spells',
        name: 'Archfey Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'added to list',
          spellsByLevel: {
            3: ['Calm Emotions', 'Faerie Fire', 'Misty Step', 'Phantasmal Force', 'Sleep'],
            5: ['Blink', 'Plant Growth'],
            7: ['Dominate Beast', 'Greater Invisibility'],
            9: ['Dominate Person', 'Seeming'],
          },
        },
        prompt:
          'Archfey Spells (ADDED TO YOUR WARLOCK SPELL LIST, not always prepared): at 3rd level Calm Emotions, Faerie Fire, Misty Step, Phantasmal Force, Sleep; at 5th Blink, Plant Growth; at 7th Dominate Beast, Greater Invisibility; at 9th Dominate Person, Seeming. All eleven are in the app spell catalog.',
        engine: 'subclassService.warlockPatronSpellsAtLevel (cumulative list); the known-spells route surfacing added-to-list spells is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'steps_of_the_fey',
        name: 'Steps of the Fey',
        level: 3,
        kind: 'C',
        mechanics: {
          action: 'bonus action',
          effect: 'cast Misty Step without expending a spell slot',
          uses: 'a number of times equal to your Charisma modifier (minimum of 1), regained when you finish a long rest',
          refreshingStep: 'when you use this feature, you or one creature within 10 feet of you gains 1d10 temporary Hit Points',
          tauntingStep: 'creatures within 5 feet of the space you left make a Wisdom saving throw against your spell save DC or have disadvantage on attack rolls against creatures other than you until the start of your next turn',
        },
        prompt:
          'Steps of the Fey (bonus action): cast Misty Step without expending a spell slot, a number of times equal to your Charisma modifier (minimum of 1), regained on a long rest. Refreshing Step: when you do, you or one creature within 10 feet of you gains 1d10 temporary Hit Points. Taunting Step: creatures within 5 feet of the space you left make a Wisdom saving throw against your spell save DC or have disadvantage on attack rolls against creatures other than you until the start of your next turn.',
        engine: 'DM-adjudicated in Batch 2; the teleport hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'misty_escape',
        name: 'Misty Escape',
        level: 6,
        kind: 'C',
        mechanics: {
          action: 'reaction',
          trigger: 'you take damage',
          effect: 'cast Misty Step as a reaction',
          disappearingStep: 'you are invisible until the start of your next turn or until you attack, deal damage, or cast a spell',
          dreadfulStep: 'creatures within 5 feet of the space you left or the space you appeared in make a Wisdom saving throw against your spell save DC or take 2d10 Psychic damage',
          note: 'use limit is a gate-check item — the DM applies it from the PHB',
        },
        prompt:
          'Misty Escape (reaction, when you take damage): cast Misty Step as a reaction. Disappearing Step: you are invisible until the start of your next turn or until you attack, deal damage, or cast a spell. Dreadful Step: creatures within 5 feet of the space you left or the space you appeared in make a Wisdom saving throw against your spell save DC or take 2d10 Psychic damage. The use limit is a gate-check item — the DM applies it from the PHB.',
        engine: 'DM-adjudicated in Batch 2; the damage-path hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'beguiling_defenses',
        name: 'Beguiling Defenses',
        level: 10,
        kind: 'E',
        mechanics: {
          effect: 'you are immune to being charmed',
          reaction: 'after you are hit by an attack, halve the damage taken (rounded down), and the attacker makes a Wisdom saving throw against your spell save DC or takes Psychic damage equal to the damage taken',
          uses: 'once per long rest, unless you expend a Pact Magic spell slot to use it again',
        },
        prompt:
          'Beguiling Defenses: you are immune to being charmed. After you are hit by an attack, you can halve the damage taken (rounded down), and the attacker makes a Wisdom saving throw against your spell save DC or takes Psychic damage equal to the damage taken. You can use this reaction once per long rest, unless you expend a Pact Magic spell slot to use it again.',
        engine: 'DM-adjudicated in Batch 2; the charm-resolution hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'bewitching_magic',
        name: 'Bewitching Magic',
        level: 14,
        kind: 'C',
        mechanics: {
          effect: 'immediately after you cast an Enchantment or Illusion spell using an action and a spell slot, cast Misty Step as part of the same action without expending a spell slot',
        },
        prompt:
          'Bewitching Magic: immediately after you cast an Enchantment or Illusion spell using an action and a spell slot, you can cast Misty Step as part of the same action without expending a spell slot.',
        engine: 'DM-adjudicated in Batch 2; the spell-cast hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'celestial_patron',
    name: 'Celestial Patron',
    description: 'A warlock of a celestial patron — a healer whose light mends and sears alike. Your healing light restores from afar, your radiant soul burns brighter, and at your peak you snatch allies back from death\'s door.',
    class: 'warlock',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    features: [
      {
        key: 'celestial_spells',
        name: 'Celestial Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'added to list',
          spellsByLevel: {
            3: ['Aid', 'Cure Wounds', 'Guiding Bolt', 'Lesser Restoration', 'Light', 'Sacred Flame'],
            5: ['Daylight', 'Revivify'],
            7: ['Guardian of Faith', 'Wall of Fire'],
            9: ['Greater Restoration', 'Summon Celestial'],
          },
        },
        prompt:
          'Celestial Spells (ADDED TO YOUR WARLOCK SPELL LIST, not always prepared): at 3rd level Aid, Cure Wounds, Guiding Bolt, Lesser Restoration, Light, Sacred Flame; at 5th Daylight, Revivify; at 7th Guardian of Faith, Wall of Fire; at 9th Greater Restoration, Summon Celestial. All twelve are in the app spell catalog.',
        engine: 'subclassService.warlockPatronSpellsAtLevel (cumulative list); the known-spells route surfacing added-to-list spells is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'healing_light',
        name: 'Healing Light',
        level: 3,
        kind: 'B',
        mechanics: {
          action: 'bonus action',
          pool: 'a pool of d6s equal to 1 + your Warlock level',
          effect: 'spend any number of dice from the pool to restore Hit Points to a creature you can see within 60 feet, equal to the total rolled',
          maxPerUse: 'no more than your Charisma modifier (minimum of 1) dice per use',
          regain: 'all expended dice return when you finish a long rest',
        },
        prompt:
          'Healing Light (bonus action): you have a pool of d6s equal to 1 + your Warlock level. Spend any number of those dice to restore Hit Points to a creature you can see within 60 feet, equal to the total rolled. You can spend no more than your Charisma modifier (minimum of 1) of those dice on a single use. All expended dice return on a long rest.',
        engine: 'subclassService.healingLightDice (pure pool count); pool tracking is a named follow-up, not wired in Batch 2.',
        gateCheck: true,
      },
      {
        key: 'radiant_soul',
        name: 'Radiant Soul',
        level: 6,
        kind: 'E',
        mechanics: {
          effect: 'once per turn, when you deal damage with a spell that deals Fire or Radiant damage, add your Charisma modifier to one damage roll of that spell against one of the spell\'s targets; you have resistance to Radiant damage',
        },
        prompt:
          'Radiant Soul: once per turn, when you deal damage with a spell that deals Fire or Radiant damage, add your Charisma modifier to one damage roll of that spell against one of the spell\'s targets. You have resistance to Radiant damage.',
        engine: 'DM-adjudicated in Batch 2; the spell-damage hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'celestial_resilience',
        name: 'Celestial Resilience',
        level: 10,
        kind: 'B',
        mechanics: {
          trigger: 'when you finish a short or long rest',
          self: 'you gain temporary Hit Points equal to your Warlock level + your Charisma modifier',
          allies: 'up to five creatures of your choice within 30 feet of you gain temporary Hit Points equal to half your Warlock level + your Charisma modifier',
        },
        prompt:
          'Celestial Resilience: when you finish a short or long rest, you gain temporary Hit Points equal to your Warlock level + your Charisma modifier. Up to five creatures of your choice within 30 feet of you gain temporary Hit Points equal to half your Warlock level + your Charisma modifier.',
        engine: 'subclassService.celestialResilienceTempHp (self) and celestialResilienceAllyTempHp (allies); rest-hook application is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'searing_vengeance',
        name: 'Searing Vengeance',
        level: 14,
        kind: 'C',
        mechanics: {
          trigger: 'when you or an ally within 60 feet of you is about to make a death saving throw',
          effect: 'that creature regains Hit Points equal to half its Hit Point maximum and can end the Prone condition on itself',
          burst: 'each creature of your choice within 30 feet of you takes Radiant damage equal to 2d8 + your Charisma modifier and has the Blinded condition until the end of the current turn',
          uses: 'once, regained when you finish a long rest',
        },
        prompt:
          'Searing Vengeance: when you or an ally within 60 feet of you is about to make a death saving throw, that creature regains Hit Points equal to half its Hit Point maximum and can end the Prone condition on itself. Each creature of your choice within 30 feet of you takes Radiant damage equal to 2d8 + your Charisma modifier and has the Blinded condition until the end of the current turn. You regain this feature on a long rest.',
        engine: 'DM-adjudicated in Batch 2; the death-save hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'fiend_patron',
    name: 'Fiend Patron',
    description: 'A warlock of the fiend who grows stronger on every death. Your kills feed you temporary life, your luck bends rolls in your favor, you resist any harm you choose, and at your peak you hurl your enemies through Hell itself.',
    class: 'warlock',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    features: [
      {
        key: 'fiend_spells',
        name: 'Fiend Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'added to list',
          spellsByLevel: {
            3: ['Burning Hands', 'Command', 'Scorching Ray', 'Suggestion'],
            5: ['Fireball', 'Stinking Cloud'],
            7: ['Fire Shield', 'Wall of Fire'],
            9: ['Geas', 'Insect Plague'],
          },
        },
        prompt:
          'Fiend Spells (ADDED TO YOUR WARLOCK SPELL LIST, not always prepared): at 3rd level Burning Hands, Command, Scorching Ray, Suggestion; at 5th Fireball, Stinking Cloud; at 7th Fire Shield, Wall of Fire; at 9th Geas, Insect Plague. All ten are in the app spell catalog.',
        engine: 'subclassService.warlockPatronSpellsAtLevel (cumulative list); the known-spells route surfacing added-to-list spells is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'dark_ones_blessing',
        name: "Dark One's Blessing",
        level: 3,
        kind: 'B',
        mechanics: {
          trigger: 'when you reduce a hostile creature to 0 Hit Points, or when another creature reduces a hostile creature within 10 feet of you to 0 Hit Points',
          effect: 'you gain temporary Hit Points equal to your Charisma modifier + your Warlock level (minimum of 1)',
        },
        prompt:
          "Dark One's Blessing: when you reduce a hostile creature to 0 Hit Points, or when another creature reduces a hostile creature within 10 feet of you to 0 Hit Points, you gain temporary Hit Points equal to your Charisma modifier + your Warlock level (minimum of 1).",
        engine: 'subclassService.darkOnesBlessingTempHp (pure math); kill-hook application is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'dark_ones_own_luck',
        name: "Dark One's Own Luck",
        level: 6,
        kind: 'E',
        mechanics: {
          effect: 'when you make an ability check or a saving throw, you can add a d10 to the roll, after seeing the roll but before knowing whether it succeeds',
          uses: 'a number of times equal to your Charisma modifier (minimum of 1), regained when you finish a long rest; no more than once per roll',
        },
        prompt:
          "Dark One's Own Luck: when you make an ability check or a saving throw, you can add a d10 to the roll after seeing it but before knowing whether it succeeds, no more than once per roll. You can use this a number of times equal to your Charisma modifier (minimum of 1), regained on a long rest.",
        engine: 'DM-adjudicated in Batch 2; the roll hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'fiendish_resilience',
        name: 'Fiendish Resilience',
        level: 10,
        kind: 'G',
        mechanics: {
          effect: 'choose one damage type, other than Force, whenever you finish a short or long rest; you have resistance to that damage type until you choose a different one with this feature',
        },
        prompt:
          'Fiendish Resilience: choose one damage type, other than Force, whenever you finish a short or long rest. You have resistance to that damage type until you choose a different one with this feature.',
        engine: 'Stored choice via subclassService.validateChoice (fiendish_resilience_type) and migration 103 subclass_choices_json; resistance application is DM-adjudicated in Batch 2.',
        gateCheck: true,
      },
      {
        key: 'hurl_through_hell',
        name: 'Hurl Through Hell',
        level: 14,
        kind: 'C',
        mechanics: {
          trigger: 'once per turn, when you hit a creature with an attack',
          effect: 'the target makes a Charisma saving throw against your spell save DC or disappears and hurtles through a nightmare landscape; a creature that is not a Fiend takes 8d10 Psychic damage',
          return: 'the creature is incapacitated until the end of your next turn, then returns to the space it left or the nearest unoccupied space',
          uses: 'once, regained when you finish a long rest, unless you expend a Pact Magic spell slot to use it again',
        },
        prompt:
          'Hurl Through Hell (once per turn, when you hit a creature with an attack): the target makes a Charisma saving throw against your spell save DC or disappears and hurtles through a nightmare landscape. A creature that is not a Fiend takes 8d10 Psychic damage. The creature is incapacitated until the end of your next turn, then returns. You regain this feature on a long rest, unless you expend a Pact Magic spell slot to use it again.',
        engine: 'DM-adjudicated in Batch 2; the attack-path hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [
      {
        key: 'fiendish_resilience_type',
        options: ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'],
      },
    ],
  },
  {
    key: 'great_old_one_patron',
    name: 'Great Old One Patron',
    description: 'A warlock who speaks with something vast and unknowable — and it answers. Your mind reaches across miles, your spells turn psychic, your hex deepens, and at your peak your thralls serve you without concentration.',
    class: 'warlock',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    features: [
      {
        key: 'great_old_one_spells',
        name: 'Great Old One Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'added to list',
          spellsByLevel: {
            3: ['Detect Thoughts', 'Dissonant Whispers', 'Phantasmal Force', "Tasha's Hideous Laughter"],
            5: ['Clairvoyance', 'Hunger of Hadar'],
            7: ['Confusion', 'Summon Aberration'],
            9: ['Modify Memory', 'Telekinesis'],
          },
        },
        prompt:
          'Great Old One Spells (ADDED TO YOUR WARLOCK SPELL LIST, not always prepared): at 3rd level Detect Thoughts, Dissonant Whispers, Phantasmal Force, Tasha\'s Hideous Laughter; at 5th Clairvoyance, Hunger of Hadar; at 7th Confusion, Summon Aberration; at 9th Modify Memory, Telekinesis. All ten are in the app spell catalog.',
        engine: 'subclassService.warlockPatronSpellsAtLevel (cumulative list); the known-spells route surfacing added-to-list spells is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'awakened_mind',
        name: 'Awakened Mind',
        level: 3,
        kind: 'C',
        mechanics: {
          action: 'bonus action',
          effect: 'form a telepathic connection with a creature you can see; while the connection lasts you can communicate telepathically with that creature',
          range: 'the connection lasts only while the creature is within a number of miles equal to your Charisma modifier (minimum of 1)',
          duration: 'a number of minutes equal to your Warlock level',
          ends: 'the connection ends early if you connect with a different creature',
          language: 'you must mentally use a language the other creature knows',
        },
        prompt:
          'Awakened Mind (bonus action): form a telepathic connection with a creature you can see. While it lasts — a number of minutes equal to your Warlock level, and only while the creature is within a number of miles equal to your Charisma modifier (minimum of 1) — you can communicate telepathically with that creature, using a language it knows. The connection ends early if you connect with a different creature.',
        engine: 'Marker AWAKENED_MIND (bonus-action ledger charge via turnLedgerService checkBonus/spendBonus) + link record { target, rangeMiles: max(1, chaMod), durationMinutes: warlock level, one connection at a time — a new connection ends the old one } on the actor pair. Schemas + handler in HANDOFF.md for the markers family. Duration rides the world clock. The language rule (must use a language the creature knows) stays DM-attested — no language-comprehension engine exists.',
        gateCheck: true,
      },
      {
        key: 'psychic_spells',
        name: 'Psychic Spells',
        level: 3,
        kind: 'E',
        mechanics: {
          effect: 'when you cast a Warlock spell that deals damage, you can change its damage type to Psychic; when you cast a Warlock spell that is an Enchantment or Illusion spell, you can cast it without Verbal or Somatic components',
        },
        prompt:
          'Psychic Spells: when you cast a Warlock spell that deals damage, you can change its damage type to Psychic. When you cast a Warlock spell that is an Enchantment or Illusion spell, you can cast it without Verbal or Somatic components.',
        engine: 'DM-adjudicated in Batch 2; the spell-cast hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'clairvoyant_combatant',
        name: 'Clairvoyant Combatant',
        level: 6,
        kind: 'E',
        mechanics: {
          trigger: 'when you form a telepathic bond with a creature using Awakened Mind',
          effect: 'force that creature to make a Wisdom saving throw against your spell save DC; on a failed save, it has disadvantage on attack rolls against you and you have advantage on attack rolls against it for the duration of the bond',
          uses: 'once per short or long rest, unless you expend a Pact Magic spell slot to use it again',
        },
        prompt:
          'Clairvoyant Combatant: when you form a telepathic bond with a creature using Awakened Mind, force that creature to make a Wisdom saving throw against your spell save DC. On a failed save, it has disadvantage on attack rolls against you and you have advantage on attack rolls against it for the duration of the bond. You regain this feature on a short or long rest, unless you expend a Pact Magic spell slot to use it again.',
        engine: 'DM-adjudicated in Batch 2; the attack/spell hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'eldritch_hex',
        name: 'Eldritch Hex',
        level: 10,
        kind: 'E',
        mechanics: {
          effect: 'you always have the Hex spell prepared',
          hex: 'when you cast Hex and choose an ability, the target also has disadvantage on saving throws of the chosen ability for the duration of the spell',
        },
        prompt:
          'Eldritch Hex: you always have the Hex spell prepared. When you cast Hex and choose an ability, the target also has disadvantage on saving throws of the chosen ability for the duration of the spell.',
        engine: 'DM-adjudicated in Batch 2; the damage/save hooks are named follow-ups.',
        gateCheck: true,
      },
      {
        key: 'thought_shield',
        name: 'Thought Shield',
        level: 10,
        kind: 'E',
        mechanics: {
          effect: 'your thoughts cannot be read by telepathy or other means unless you allow it; you have resistance to Psychic damage; whenever a creature deals Psychic damage to you, that creature takes the same amount of damage',
        },
        prompt:
          'Thought Shield: your thoughts cannot be read by telepathy or other means unless you allow it. You have resistance to Psychic damage, and whenever a creature deals Psychic damage to you, that creature takes the same amount of damage.',
        engine: 'DM-adjudicated in Batch 2; the damage-reflection hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'create_thrall',
        name: 'Create Thrall',
        level: 14,
        kind: 'C',
        mechanics: {
          effect: 'when you cast Summon Aberration, you can modify it so it does not require Concentration; its duration becomes 1 minute',
          summon: 'when summoned, the Aberration has temporary Hit Points equal to your Warlock level + your Charisma modifier',
          hex: 'the first time each turn the Aberration hits a creature under the effect of your Hex, it deals extra Psychic damage equal to the bonus damage of that spell',
        },
        prompt:
          'Create Thrall: when you cast Summon Aberration, you can modify it so it does not require Concentration and its duration becomes 1 minute. When summoned, the Aberration has temporary Hit Points equal to your Warlock level + your Charisma modifier. The first time each turn the Aberration hits a creature under the effect of your Hex, it deals extra Psychic damage equal to the bonus damage of that spell.',
        engine: 'DM-adjudicated in Batch 2; the charm/condition hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'hexblade',
    name: 'Hexblade',
    description: 'A warlock bound to a cursed blade — a warrior of shadow steel. Your curse marks the doomed, your weapon answers your hand, the slain rise as specters, and at your peak your curse never ends — it passes from the dead to the living.',
    class: 'warlock',
    source: "Xanathar's Guide to Everything (2014) — 2024 conversion",
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: '2014 grant points 1/6/10/14 map onto the built 2024 Warlock cadence 3/6/10/14: the three 1st-level features (Expanded Spell List, Hexblade\'s Curse, Hex Warrior) move to 3rd; 6th, 10th, and 14th stay. Patron spells use the Batch 2 helper (spellsByLevel, tiers 3/5/9/13/17). The extract names two 2014 smites that are NOT in the 2024 app spell catalog (Branding Smite, Banishing Smite) — both are kept in the data and logged as catalogGap (Batch 3 Summon Dragon pattern), never invented as catalog entries and never silently swapped. Approved ruling 2026-11-03 (Zach): Banishing Smite is kept in its 2024 form (catalog entry added, numbers flagged for Zach\'s physical PHB check); Shining Smite replaces Branding Smite (already in the catalog), so the former catalogGap is now resolved. No 2024 reprint of this subclass exists: this entry is the app conversion of the 2014 Xanathar extract, and every number is gateCheck for Zach.',
    features: [
      {
        key: 'hexblade_spells',
        name: 'Hexblade Spells',
        level: 3,
        kind: 'D',
        mechanics: { access: 'added to the Warlock spell list for you; if you have the Pact Magic feature, they are added to the spell list of that feature', spellsByLevel: { 3: ['Shield', 'Wrathful Smite'], 5: ['Blur', 'Shining Smite'], 9: ['Blink', 'Elemental Weapon'], 13: ['Phantasmal Killer', 'Staggering Smite'], 17: ['Banishing Smite', 'Cone of Cold'] }, catalogGap: [] },
        prompt: 'Hexblade Spells (ADDED TO YOUR SPELL LIST): at 3rd Shield, Wrathful Smite; at 5th Blur, Shining Smite; at 9th Blink, Elemental Weapon; at 13th Phantasmal Killer, Staggering Smite; at 17th Banishing Smite, Cone of Cold.',
        engine: 'subclassService.warlockPatronSpellsAtLevel (cumulative list); the known-spells route surfacing is a named follow-up, not wired in S2.',
        gateCheck: true,
      },
      {
        key: 'hexblades_curse',
        name: "Hexblade's Curse",
        level: 3,
        kind: 'B',
        mechanics: { action: 'Bonus Action', range: 'one creature you can see within 30 feet', duration: '1 minute', endsEarly: ['the target dies', 'you die', 'you are incapacitated'], effects: ['gain a bonus to damage rolls against the cursed target equal to your Proficiency Bonus', 'any attack roll you make against the cursed target scores a critical hit on a roll of 19 or 20'], killHeal: 'if the cursed target dies, you regain Hit Points equal to your Warlock level + your Charisma modifier (minimum of 1)', regain: 'once per Short or Long Rest' },
        prompt: "Hexblade's Curse: as a Bonus Action, place a baleful curse on one creature you can see within 30 feet. The curse lasts for 1 minute, ending early if the target dies, you die, or you are incapacitated. You gain a bonus to damage rolls against the cursed target equal to your Proficiency Bonus, and any attack roll you make against the cursed target scores a critical hit on a roll of 19 or 20. If the cursed target dies, you regain Hit Points equal to your Warlock level + your Charisma modifier (minimum of 1). Once per Short or Long Rest.",
        engine: 'DM-prompt in S2; curse tracking / crit-threshold hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'hex_warrior',
        name: 'Hex Warrior',
        level: 3,
        kind: 'A',
        mechanics: { proficiencies: ['Medium armor', 'Shields', 'Martial weapons'], weaponBond: 'whenever you finish a Long Rest, touch one weapon that you are proficient with and that lacks the two-handed property; when you attack with that weapon, use your Charisma modifier, instead of Strength or Dexterity, for the attack and damage rolls; this benefit lasts until you finish a Long Rest', pactWeapon: 'if you later gain the Pact of the Blade feature, this benefit extends to every pact weapon you conjure with that feature, no matter the weapon\'s type' },
        prompt: 'Hex Warrior: you gain proficiency with medium armor, shields, and martial weapons. Whenever you finish a Long Rest, you can touch one weapon that you are proficient with and that lacks the two-handed property; when you attack with that weapon, use your Charisma modifier, instead of Strength or Dexterity, for the attack and damage rolls, until your next Long Rest. If you later gain the Pact of the Blade feature, this benefit extends to every pact weapon you conjure with that feature, no matter the weapon\'s type.',
        engine: 'DM-prompt in S2; weapon-bond and Charisma-attack hooks are named follow-ups.',
        gateCheck: true,
      },
      {
        key: 'accursed_specter',
        name: 'Accursed Specter',
        level: 6,
        kind: 'C',
        mechanics: { trigger: 'when you slay a humanoid', effect: 'cause its spirit to rise from its corpse as a specter; the statistics for the specter are in the Monster Manual, with these changes: its Temporary Hit Points equal half your Warlock level, and it gets a bonus to its attack rolls equal to your Charisma modifier (minimum of +0)', obedience: 'it obeys your verbal commands, and gains a Special Trait, Incorporeal Movement, if it does not have it already; it remains in your service until the end of your next Long Rest', initiative: 'rolls its own initiative', regain: 'once per Long Rest' },
        prompt: 'Accursed Specter: starting when you slay a humanoid, you can cause its spirit to rise from its corpse as a specter. Its statistics are those of a specter, with Temporary Hit Points equal to half your Warlock level and a bonus to its attack rolls equal to your Charisma modifier (minimum of +0). It obeys your verbal commands, gains Incorporeal Movement if it does not have it already, rolls its own initiative, and remains in your service until the end of your next Long Rest. Once per Long Rest.',
        engine: 'DM-prompt in S2; the specter is modeled-not-ready as an entity (no specter row exists — same honesty rule as Beast Master), present as registry data + DM prompt only.',
        gateCheck: true,
      },
      {
        key: 'armor_of_hexes',
        name: 'Armor of Hexes',
        level: 10,
        kind: 'C',
        mechanics: { reaction: 'when you are hit by an attack from a creature under the effect of your Hexblade\'s Curse', effect: 'roll a d6; on a roll of 4 or higher, the attack misses instead, regardless of its roll' },
        prompt: 'Armor of Hexes: if you are hit by an attack from a creature under the effect of your Hexblade\'s Curse, you can use your Reaction to roll a d6. On a roll of 4 or higher, the attack misses instead, regardless of its roll.',
        engine: 'DM-prompt in S2; attack-negation hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'master_of_hexes',
        name: 'Master of Hexes',
        level: 14,
        kind: 'B',
        mechanics: { trigger: 'when a creature under the effect of your Hexblade\'s Curse dies', effect: 'apply the curse to a different creature you can see within 30 feet, if you are not incapacitated; you do not regain Hit Points from the death of the previous target' },
        prompt: 'Master of Hexes: when a creature under the effect of your Hexblade\'s Curse dies, you can apply the curse to a different creature you can see within 30 feet, if you are not incapacitated. You do not regain Hit Points from the death of the previous target.',
        engine: 'DM-prompt in S2; curse transfer hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'the_ancient_dragon',
    name: 'The Ancient Dragon',
    description: 'A warlock of the ancient dragon — whose patron grants a dragon\'s might and a hoard of your own. Your spells carry draconic power, you fly from danger, fear cannot touch you, and at your peak you own a lair beyond the world.',
    class: 'warlock',
    source: 'Hoard of Heroes — 2024 conversion',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: 'Hoard grants ran 1/6/10/14 -> 3/6/10/14 (only the 1st-level features moved). Patron spell tiers are keyed by spell level in the source (1st-5th); they are re-keyed here to character levels at warlock slot unlocks (3rd: 1st+2nd-level spells, 5th: 3rd, 7th: 4th, 9th: 5th), matching how the built PHB patron entries are keyed. No 2024 reprint exists: every number is gateCheck for Zach.',
    sourceNote: 'Hoard of Heroes is third-party/homebrew (Zach: ABSOLUTELY NECESSARY, plan section 13). Mechanics paraphrased in the app\'s own wording from the Hoard extract; never verbatim book prose. The dragon-type table\'s hoard mandates (e.g. Black: Relics of Fallen Empires, Gold: Pearls and other Gems) are DM-facing flavor and are not wired as data in S4. The Hoard Eldritch Invocations tied to this patron are a separate feature system and are NOT wired in S4 — see PUSH-CHECKLIST follow-up.',
    features: [
      {
        key: 'ancient_dragon_spells',
        name: 'Ancient Dragon Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'added to list',
          spellsByLevel: {
            3: ['Absorb Elements', 'Command', "Dragon's Breath", 'Alter Self'],
            5: ['Elemental Weapon', 'Wind Wall'],
            7: ['Elemental Bane', 'Locate Creature'],
            9: ['Control Winds', 'Legend Lore'],
          },
        },
        prompt: 'Ancient Dragon Spells (ADDED TO YOUR WARLOCK SPELL LIST, not always prepared): at 3rd level Absorb Elements, Command, Dragon\'s Breath, Alter Self; at 5th Elemental Weapon, Wind Wall; at 7th Elemental Bane, Locate Creature; at 9th Control Winds, Legend Lore. All ten are in the app spell catalog.',
        engine: 'subclassService.warlockPatronSpellsAtLevel (cumulative list); the known-spells route surfacing added-to-list spells is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'might_of_the_maw',
        name: 'Might of the Maw',
        level: 3,
        kind: 'C',
        mechanics: { choice: 'choose one warlock spell you know with a casting time of one action or bonus action', components: 'you can cast this spell as if it only had verbal components, although you must still provide material components with a gold cost', recast: 'after casting this spell, once on your turn during the next minute you can cast it again without using a spell slot', rest: 'long', fear: 'when you cast this spell, you can choose one target of the spell, or a creature within 30 feet of you; that creature must succeed on a Wisdom saving throw or become frightened of you until the end of your next turn', reselect: 'each time you gain a level in this class, you can choose to switch these benefits to a different warlock spell that you know of 5th level or lower' },
        prompt: 'Might of the Maw: choose one warlock spell you know with a casting time of one action or bonus action. You can cast this spell as if it only had verbal components, although you must still provide material components with a gold cost. After casting this spell, once on your turn during the next minute you can cast it again without using a spell slot. When you cast this spell, you can choose one target of the spell, or a creature within 30 feet of you; that creature must succeed on a Wisdom saving throw or become frightened of you until the end of your next turn. You must complete a Long Rest before you can use the free recast again. Each time you gain a level in this class, you can switch these benefits to a different warlock spell that you know of 5th level or lower. RECORD THE CHOSEN SPELL: the choice is open (any known spell), so it is stored as free text in subclass_choices_json by the DM, not validated against a fixed option list.',
        engine: 'DM-prompt in S4; the free recast and frighten rider are DM-adjudicated (named follow-ups).',
        gateCheck: true,
      },
      {
        key: 'scales_ascending',
        name: 'Scales Ascending',
        level: 6,
        kind: 'C',
        mechanics: { trigger: 'when a creature hits you with a melee attack', reaction: 'reaction', flight: 'fly up to 30 feet without provoking opportunity attacks', dispersal: 'gas or vapor within 5 feet of you is dispersed, and candles, torches, and similar unprotected flames are extinguished', linger: 'until the end of your next turn, you have a flying speed of 30 feet; you fall if you end your turn in the air and nothing else is holding you aloft', rest: 'short or long' },
        prompt: 'Scales Ascending (reaction): when a creature hits you with a melee attack, you can fly up to 30 feet without provoking opportunity attacks. When you fly in this way, gas or vapor within 5 feet of you is dispersed, and candles, torches, and similar unprotected flames are extinguished. Until the end of your next turn, you have a flying speed of 30 feet. You fall if you end your turn in the air and nothing else is holding you aloft. Once used, you cannot use it again until you finish a Short or Long Rest.',
        engine: 'DM-prompt in S4; flight/fall adjudication is DM-side (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'tempered_by_terror',
        name: 'Tempered by Terror',
        level: 10,
        kind: 'E',
        mechanics: { immunity: 'immune to being frightened', advantage: 'advantage on the saving throws of spells cast by creatures that are frightened' },
        prompt: 'Tempered by Terror: you are immune to being frightened, and you have advantage on the saving throws of spells cast by creatures that are frightened.',
        engine: 'DM-prompt in S4; condition/save hooks are named follow-ups.',
        gateCheck: true,
      },
      {
        key: 'hidden_hoard',
        name: 'Hidden Hoard',
        level: 14,
        kind: 'C',
        mechanics: { action: 'action', trigger: 'touch a solid surface', opening: 'an opening no more than 10 feet in any dimension, leading to an extradimensional space of your own design, no more than 100 feet in each dimension, constructed of wood, stone, and similar materials', duration: 'the opening lasts until you use your action to create a new opening, at which point the old one immediately vanishes', createdObjects: 'objects created by this feature disappear if removed from the lair', rest: 'long' },
        prompt: 'Hidden Hoard (action): you gain access to a lair of your very own. Touch a solid surface and create an opening no more than 10 feet in any dimension, leading to an extradimensional space of your own design, no more than 100 feet in each dimension, constructed of wood, stone, and similar materials. The opening lasts until you use your action to create a new opening, at which point the old one immediately vanishes. Objects created by this feature disappear if removed from the lair. After creating an opening, you must complete a Long Rest before you can do so again. ENTITY NOTE: the lair space is DM-tracked in S4, not an entity row.',
        engine: 'DM-prompt + DM-tracked lair space in S4; no lair entity row exists (named follow-up).',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'dragon_patron_type', level: 3, options: ['Black', 'Blue', 'Brass', 'Bronze', 'Copper', 'Gold', 'Green', 'Red', 'Silver', 'White'] },
    ],
  },
  {
    key: 'the_beholder',
    name: 'The Beholder',
    description: 'A warlock bound to a beholder\'s dreaming eye — paranoid, watchful, and impossible to surprise. Your eyes are your focus, your spells bend to your gaze, attackers find new targets, and at your peak you dream yourself a new body when you fall.',
    class: 'warlock',
    source: 'Hoard of Heroes — 2024 conversion',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: 'Hoard grants ran 1/6/10/14 -> 3/6/10/14 (only the 1st-level features moved). Patron spell tiers are keyed by spell level in the source (1st-5th); they are re-keyed here to character levels at warlock slot unlocks (3rd: 1st+2nd-level spells, 5th: 3rd, 7th: 4th, 9th: 5th), matching how the built PHB patron entries are keyed. No 2024 reprint exists: every number is gateCheck for Zach.',
    sourceNote: 'Hoard of Heroes is third-party/homebrew (Zach: ABSOLUTELY NECESSARY, plan section 13). Mechanics paraphrased in the app\'s own wording from the Hoard extract; never verbatim book prose. The source names Xanathar of Skullport (Forgotten Realms) among prominent beholders, so the origin stays Forgotten Realms. The gazer familiar variant (Pact of the Chain) is noted, not wired: Pact Boon is base-class and the gazer has no entity row. The Hoard Eldritch Invocations tied to this patron are a separate feature system and are NOT wired in S4 — see PUSH-CHECKLIST follow-up.',
    features: [
      {
        key: 'beholder_spells',
        name: 'Beholder Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'added to list',
          spellsByLevel: {
            3: ['Ray of Sickness', 'Sleep', 'Scorching Ray', 'See Invisibility'],
            5: ['Blink', 'Clairvoyance'],
            7: ['Arcane Eye', 'Phantasmal Killer'],
            9: ['Dominate Person', 'Telekinesis'],
          },
        },
        prompt: 'Beholder Spells (ADDED TO YOUR WARLOCK SPELL LIST, not always prepared): at 3rd level Ray of Sickness, Sleep, Scorching Ray, See Invisibility; at 5th Blink, Clairvoyance; at 7th Arcane Eye, Phantasmal Killer; at 9th Dominate Person, Telekinesis. All ten are in the app spell catalog.',
        engine: 'subclassService.warlockPatronSpellsAtLevel (cumulative list); the known-spells route surfacing added-to-list spells is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'eye_of_the_beholder',
        name: 'Eye of the Beholder',
        level: 3,
        kind: 'C',
        mechanics: { focus: 'you can treat your eyes as an arcane focus', somatic: 'you can ignore any somatic component of spells you cast', originShift: 'when you cast a spell that does not have a range of Self, you can have it originate at a point within sight', rest: 'long' },
        prompt: 'Eye of the Beholder: you can treat your eyes as an arcane focus, and you can ignore any somatic component of spells you cast. Additionally, when you cast a spell that does not have a range of Self, you can have it originate at a point within sight. Once you use the origin shift, you cannot use it again until you finish a Long Rest.',
        engine: 'DM-prompt in S4; the origin-shift use is DM-tracked (named follow-up). Whether the Long Rest limit gates the focus/somatic benefits or only the origin shift is ambiguous in the extract and is a gate-check item — this entry reads it as gating the origin shift only.',
        gateCheck: true,
      },
      {
        key: 'partners_through_prejudice',
        name: 'Partners through Prejudice',
        level: 6,
        kind: 'C',
        mechanics: { trigger: 'reaction, when a creature you can see targets you with an attack', save: 'Wisdom saving throw against your warlock spell save DC', effect: 'on a failed save, you can choose a new target within range for the attack, and the creature is charmed by you until the end of your next turn', exclusion: 'this feature has no effect on humanoids', rest: 'short or long' },
        prompt: 'Partners through Prejudice (reaction): when a creature you can see targets you with an attack, you can force it to make a Wisdom saving throw against your warlock spell save DC. If it fails, you can choose a new target within range for the attack, and the creature is charmed by you until the end of your next turn. This feature has no effect on humanoids. Once used, you cannot use it again until you finish a Short or Long Rest.',
        engine: 'DM-prompt in S4; attack-retargeting is DM-adjudicated (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'confirmed_suspicions',
        name: 'Confirmed Suspicions',
        level: 10,
        kind: 'E',
        mechanics: { effect: 'you have resistance to all damage when you have not taken a turn in combat yet' },
        prompt: 'Confirmed Suspicions: you have resistance to all damage when you have not taken a turn in combat yet.',
        engine: 'DM-prompt in S4; first-turn window is DM-tracked (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'extraneous_ego',
        name: 'Extraneous Ego',
        level: 14,
        kind: 'H',
        mechanics: { trigger: 'when you would be rendered unconscious as a result of being reduced to 0 hit points, while in the grip of sleep', clone: 'you conjure a manifestation of your dream self: a new body within 15 feet of you, identical to the original, lasting for 1 minute or until it is reduced to 0 hit points or dies', endEffect: 'at the end of the duration, or if you become conscious, your clone vanishes and you regain hit points equal to its current hit points', cloneStats: 'the clone is under your control, has none of your gear, has hit points equal to half its maximum, and takes your place in the initiative order', deathSaves: 'while you remain unconscious you do not make death saving throws for your original body, but you fail them from taking damage as normal', permanence: 'if you would die while your clone is still present, your clone becomes your new body permanently', rest: 'long' },
        prompt: 'Extraneous Ego: when you would be rendered unconscious as a result of being reduced to 0 hit points, you can conjure a manifestation of your dream self — a new body within 15 feet of you, identical to the original, lasting for 1 minute or until it is reduced to 0 hit points or dies. At the end of the duration, or if you become conscious, your clone vanishes and you regain hit points equal to its current hit points. The clone is under your control, has none of your gear, has hit points equal to half its maximum, and takes your place in the initiative order. While you remain unconscious you do not make death saving throws for your original body, but you fail them from taking damage as normal. If you would die while your clone is still present, your clone becomes your new body permanently. Once used, you cannot use it again until you finish a Long Rest. ENTITY NOTE: the clone body is DM-tracked in S4, not an entity row.',
        engine: 'DM-prompt + DM-tracked clone in S4; no clone entity row exists (named follow-up, same honesty rule as Beast Master).',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'many_faces',
    name: 'Many Faces',
    description: 'A warlock of many faces — a mad chorus of voices that no mind can navigate. Your utterings frighten attackers, intruders take psychic wounds, your wails sap your enemies\' strength, and at your peak your caterwaul overwhelms the field.',
    class: 'warlock',
    source: 'Additional Subclasses — Myths and Folklore Collection (Homebrewery, unofficial Fan Content)',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: 'Expanded Spell List is printed by SPELL level (1st–5th); it is mapped here to warlock levels 3/5/7/9 at slot unlocks for the cumulative accessor — that mapping is a gate-check item. Folklore inspiration (Legion, Biblical lore) is flavor, not a feature.',
    conversionCheck: 'As-printed grants ran 1/6/10/14; mapped onto the built 2024 Warlock cadence 3/6/10/14. Only the two 1st-level features (Expanded Spell List, Manic Utterings) moved to 3rd; 6th, 10th, and 14th stay. Patron spell tiers are keyed by spell level in the source (1st-5th); they are re-keyed here to character levels at warlock slot unlocks (3rd: 1st+2nd-level spells, 5th: 3rd, 7th: 4th, 9th: 5th), matching how the built PHB patron entries are keyed. No 2024 reprint of this subclass exists: every number is gateCheck for Zach.',
    features: [
      {
        key: 'many_faces_spells',
        name: 'Expanded Spell List',
        level: 3,
        kind: 'D',
        mechanics: { access: 'added to the Warlock spell list for you', spellsByLevel: { 3: ['Dissonant Whispers', 'False Life', 'Detect Thoughts', "Nystul's Magic Aura"], 5: ['Nondetection', 'Spirit Guardians'], 7: ['Compulsion', 'Confusion'], 9: ['Dominate Person', 'Modify Memory'] }, mappingNote: 'as printed by spell level 1st–5th, re-keyed to warlock levels 3/5/7/9 at slot unlocks (Hoard pattern); gate-check this mapping' },
        prompt: 'Expanded Spell List (ADDED TO YOUR WARLOCK SPELL LIST, not always prepared): at 3rd level Dissonant Whispers, False Life, Detect Thoughts, Nystul\'s Magic Aura; at 5th Nondetection, Spirit Guardians; at 7th Compulsion, Confusion; at 9th Dominate Person, Modify Memory (re-keyed to warlock levels 3/5/7/9 at slot unlocks; mapping is a gate check).',
        engine: 'subclassService.warlockPatronSpellsAtLevel (cumulative).',
        gateCheck: true,
      },
      {
        key: 'manic_utterings',
        name: 'Manic Utterings',
        level: 3,
        kind: 'C',
        mechanics: { trigger: 'reaction when a visible creature within 30 feet attacks you', effect: 'Wisdom saving throw or frightened of you until the start of its next turn and the attack or spell wasted', uses: '1 per Long Rest' },
        prompt: 'Manic Utterings (reaction, once per Long Rest): when a visible creature within 30 feet attacks you, it must succeed on a Wisdom saving throw or be frightened of you until the start of its next turn and the attack or spell is wasted.',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
      {
        key: 'unnavigable_subconscious',
        name: 'Unnavigable Subconscious',
        level: 6,
        kind: 'E',
        mechanics: { trigger: 'a creature attempts to read your thoughts or enter your mind', effect: 'it must first make a Wisdom saving throw or take 3d6 psychic damage and fail to read them; you learn its precise location for 1 minute regardless, unless it is on another plane' },
        prompt: 'Unnavigable Subconscious: a creature attempting to read your thoughts or enter your mind must first make a Wisdom saving throw or take 3d6 psychic damage and fail to read them; you learn its precise location for 1 minute regardless, unless it is on another plane.',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
      {
        key: 'torturous_wails',
        name: 'Torturous Wails',
        level: 10,
        kind: 'E',
        mechanics: { effect: 'chosen creatures you can see within 15 feet have disadvantage on attack rolls against you', exception: 'does not affect creatures with Intelligence 3 or lower' },
        prompt: 'Torturous Wails: chosen creatures you can see within 15 feet have disadvantage on attack rolls against you (does not affect creatures with Intelligence 3 or lower).',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
      {
        key: 'overwhelming_caterwaul',
        name: 'Overwhelming Caterwaul',
        level: 14,
        kind: 'C',
        mechanics: { action: 'bonus action', duration: '1 minute', aura: 'Torturous Wails extends to 30 feet; regain a Manic Utterings use (free during the duration); enemies in the aura have disadvantage on attack rolls against you and on Intelligence, Wisdom, and Charisma saving throws', actionEachTurn: 'force a visible creature in the aura to make a Wisdom saving throw or take 4d10 psychic damage, fall prone, and become incapacitated until the start of its next turn (half damage, no other effects on success)', uses: '1 per Long Rest, or expend a warlock spell slot to reuse with only one benefit' },
        prompt: 'Overwhelming Caterwaul (bonus action, 1 minute, once per Long Rest or by expending a warlock spell slot to reuse with only one benefit): Torturous Wails extends to 30 feet, you regain a Manic Utterings use (free during the duration), and enemies in the aura have disadvantage on attack rolls against you and on Intelligence, Wisdom, and Charisma saving throws. As an action each turn, force a visible creature in the aura to make a Wisdom saving throw or take 4d10 psychic damage, fall prone, and become incapacitated until the start of its next turn (half damage, no other effects on success).',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'spiritual_guardian',
    name: 'Spiritual Guardian',
    description: 'A warlock whose patron guards through a talisman — a keeper of souls and sacred rites. Your talisman saves your checks, your offerings earn boons, your warding bond shields your allies, and at your peak the patron itself possesses your talisman.',
    class: 'warlock',
    source: 'Additional Subclasses — Myths and Folklore Collection (Homebrewery, unofficial Fan Content)',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: 'Expanded Spell List is printed by SPELL level (1st–5th); it is mapped here to warlock levels 3/5/7/9 at slot unlocks for the cumulative accessor — that mapping is a gate-check item. Folklore inspiration (Haitian Vodou and the Lwa) is flavor, not a feature.',
    conversionCheck: 'As-printed grants ran 1/6/10/14; mapped onto the built 2024 Warlock cadence 3/6/10/14. Only the three 1st-level features (Expanded Spell List, Soul Talisman, Ritual Communication) moved to 3rd; 6th, 10th, and 14th stay. Patron spell tiers are keyed by spell level in the source (1st-5th); they are re-keyed here to character levels at warlock slot unlocks (3rd: 1st+2nd-level spells, 5th: 3rd, 7th: 4th, 9th: 5th), matching how the built PHB patron entries are keyed. No 2024 reprint of this subclass exists: every number is gateCheck for Zach.',
    features: [
      {
        key: 'spiritual_guardian_spells',
        name: 'Expanded Spell List',
        level: 3,
        kind: 'D',
        mechanics: { access: 'added to the Warlock spell list for you', spellsByLevel: { 3: ['Ceremony', 'Sanctuary', 'Gentle Repose', 'Healing Spirit'], 5: ['Revivify', 'Spirit Guardians'], 7: ['Divination', 'Death Ward'], 9: ['Commune', 'Raise Dead'] }, mappingNote: 'as printed by spell level 1st–5th, re-keyed to warlock levels 3/5/7/9 at slot unlocks (Hoard pattern); gate-check this mapping' },
        prompt: 'Expanded Spell List (ADDED TO YOUR WARLOCK SPELL LIST, not always prepared): at 3rd level Ceremony, Sanctuary, Gentle Repose, Healing Spirit; at 5th Revivify, Spirit Guardians; at 7th Divination, Death Ward; at 9th Commune, Raise Dead (re-keyed to warlock levels 3/5/7/9 at slot unlocks; mapping is a gate check).',
        engine: 'subclassService.warlockPatronSpellsAtLevel (cumulative).',
        gateCheck: true,
      },
      {
        key: 'soul_talisman',
        name: 'Soul Talisman',
        level: 3,
        kind: 'B',
        mechanics: { effect: 'when failing an ability check, add a d4, potentially turning it into a success', uses: 'Proficiency Bonus per Long Rest', replacement: '1-hour ceremony during a Short or Long Rest replaces a lost talisman, destroying the previous one', onDeath: 'turns to ash', pactOfTheTalisman: 'if you gain Pact of the Talisman, the Soul Talisman becomes that amulet and the die becomes d6 at 10th level, plus once per turn you may expend a Pact of the Talisman use on a failed attack roll or saving throw if you are the wearer' },
        prompt: 'Soul Talisman: when you fail an ability check, add a d4, potentially turning it into a success (uses equal to your Proficiency Bonus per Long Rest). A 1-hour ceremony during a Short or Long Rest replaces a lost talisman, destroying the previous one; it turns to ash on your death. If you gain Pact of the Talisman, the Soul Talisman becomes that amulet and the die becomes d6 at 10th level, plus once per turn you may expend a Pact of the Talisman use on a failed attack roll or saving throw if you are the wearer.',
        engine: 'DM-prompt only; no talisman resource pool exists in this batch.',
        gateCheck: true,
      },
      {
        key: 'ritual_communication',
        name: 'Ritual Communication',
        level: 3,
        kind: 'E',
        mechanics: { proficiencies: ['Performance skill', 'one musical instrument'], focus: 'the instrument can be used as a spellcasting focus' },
        prompt: 'Ritual Communication: you gain proficiency in Performance and with one musical instrument, which can be used as your spellcasting focus.',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
      {
        key: 'sacrificial_offering',
        name: 'Sacrificial Offering',
        level: 6,
        kind: 'C',
        mechanics: { trigger: 'once before the end of the next Long Rest, 10-minute ritual with a proficient instrument offering a Beast carcass of CR 1/2 or lower', boonTable: ['poison and disease immunity + poison resistance', 'a shared Soul Talisman d4 use', 'a skill proficiency + expertise', 'radiant retaliation equal to warlock level', 'blindsight 10 feet', 'advantage against charmed and frightened for the wearer and allies within 10 feet'], duration: 'until the end of the next Long Rest or talisman removal', roll: 'd6 on the Sacrificial Boon table' },
        prompt: 'Sacrificial Offering (once before the end of the next Long Rest): a 10-minute ritual with a proficient instrument, offering a Beast carcass of CR 1/2 or lower, then roll a d6 on the Sacrificial Boon table — poison and disease immunity + poison resistance; a shared Soul Talisman d4 use; a skill proficiency + expertise; radiant retaliation equal to warlock level; blindsight 10 feet; or advantage against charmed and frightened for the wearer and allies within 10 feet — lasting until the end of the next Long Rest or talisman removal.',
        engine: 'DM-prompt only; the boon roll is DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'talisman_of_protection',
        name: 'Talisman of Protection',
        level: 10,
        kind: 'C',
        mechanics: { action: 'action', effect: 'cast Warding Bond slot-free and material-free between you and another talisman wearer', endsEarly: 'beyond 60 feet or if a talisman is removed', uses: 'Proficiency Bonus per Long Rest' },
        prompt: 'Talisman of Protection (action, uses equal to your Proficiency Bonus per Long Rest): cast Warding Bond slot-free and material-free between you and another talisman wearer; it ends early beyond 60 feet or if a talisman is removed.',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
      {
        key: 'patron_possession',
        name: 'Patron Possession',
        level: 14,
        kind: 'C',
        mechanics: { action: 'action', effect: 'the talisman wearer gains all Sacrificial Boon benefits for 1 minute, ending early if the talisman is removed', wearerBenefits: ['unlimited Soul Talisman uses (once per turn)', 'resistance to nonmagical bludgeoning, piercing, and slashing damage', 'loss of attackers\' advantage against you within 30 feet', 'Extra Attack if you lack it'], uses: '1 per Long Rest, or expend a warlock spell slot to reuse with only one benefit' },
        prompt: 'Patron Possession (action, 1 minute, once per Long Rest or by expending a warlock spell slot to reuse with only one benefit): the talisman wearer gains all Sacrificial Boon benefits, ending early if the talisman is removed. You gain unlimited Soul Talisman uses (once per turn), resistance to nonmagical bludgeoning, piercing, and slashing damage, loss of attackers\' advantage against you within 30 feet, and Extra Attack if you lack it.',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
];

export default WARLOCK_SUBCLASSES;
