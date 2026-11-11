/**
 * Ranger subclasses — Batch 4 (PHB 2024 entity-heavy classes, LAST PHB batch).
 *
 * SCAN-EDITION WARNING — same as druid.js, read before trusting any
 * number below: the files named "PHB 2024 Classes Pt1/Pt2" split on
 * 2026-11-03 are image-only printouts of the 2014 Player's
 * Handbook, Chapter 3 (AnyFlip flipbook dated 2024-04-24, before
 * the 2024 book existed). Pt2 PDF p.1 is printed p.80 (2014 Monk
 * ki-point content) and the Ranger art page is printed p.89 in
 * 2014 layout. The 2014 book has only Hunter and Beast Master as
 * PHB Ranger archetypes, so it cannot source Fey Wanderer or
 * Gloom Stalker at all, and its Hunter/Beast numbers are the
 * 2014 numbers. These entries were therefore NOT authored from
 * those scans. They were authored from 2024 knowledge,
 * cross-checked against secondary 2024 summaries, in the app's
 * own wording, never copied verbatim, and every level and number
 * below is still a gate-check item for Zach against his own 2024
 * PHB — nothing here is presented as scan-checked.
 *
 * Cadence: Ranger subclasses grant at 3rd, 7th, 11th, and 15th
 * in 2024 (not 3/6/10/14 — do NOT carry the old cadence over).
 * Subclass spells are ALWAYS PREPARED at ranger levels
 * 3/5/9/13/17. Gloom Stalker is counted once, as PHB 2024, not
 * double-counted from the Xanathar scanned source; Fey Wanderer
 * is counted once, as PHB 2024, not double-counted from Tasha's.
 *
 * Entity honesty (kind H): the Beast Master Primal Companion
 * needs a companion/statblock path the app does not have —
 * companions rows are NPC-linked, and no primal-beast row
 * exists. This file models the companion's numbers, limits, and
 * statblock choice in the registry and surfaces them in the DM
 * prompt; it does NOT pretend a primal companion entity exists.
 * The entity path is a named follow-up.
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

export const RANGER_SUBCLASSES = [
  {
    key: 'beast_master',
    name: 'Beast Master',
    description: 'A ranger who fights beside a primal beast — land, sea, or sky — that grows with you. Your companion strikes, dashes, and helps at your command, shares your spells, and at your peak it shares your Hunter\'s Mark itself.',
    class: 'ranger',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: '2024 knowledge + secondary 2024 summaries; NOT from the Pt1/Pt2 scans (2014 PHB — see header). 2024 Primal Companion AC and strike damage scale with Wisdom modifier, not Proficiency Bonus.',
    features: [
      {
        key: 'primal_companion',
        name: 'Primal Companion',
        level: 3,
        kind: 'H',
        mechanics: {
          statblocks: {
            beast_of_the_land: { armorClass: '13 plus your Wisdom modifier', hitPoints: '5 plus five times your Ranger level', hitDice: 'd8s equal to your Ranger level', strike: '1d8 + 2 plus your Wisdom modifier Bludgeoning, Piercing, or Slashing damage (damage type chosen when you summon the beast); if the beast moved at least 20 feet straight toward the target before the hit, the target takes an extra 1d6 damage of the same type and has the Prone condition if it is Large or smaller' },
            beast_of_the_sea: { armorClass: '13 plus your Wisdom modifier', hitPoints: '5 plus five times your Ranger level', hitDice: 'd8s equal to your Ranger level', strike: '1d6 + 2 plus your Wisdom modifier Bludgeoning or Piercing damage (damage type chosen when you summon the beast), and the target has the Grappled condition (escape DC equals your spell save DC)' },
            beast_of_the_sky: { armorClass: '13 plus your Wisdom modifier', hitPoints: '4 plus four times your Ranger level', hitDice: 'd6s equal to your Ranger level', strike: '1d4 + 3 plus your Wisdom modifier Slashing damage' },
          },
          command: 'the beast moves and uses its Reaction on its own, but only takes the Dodge action unless you take a Bonus Action to command it to take an action in its stat block, or you sacrifice one of your attacks when you take the Attack action to command it to take the Beast\'s Strike action',
          primalBond: 'add your Proficiency Bonus to any ability check or saving throw the beast makes',
          entityPath: 'MODELED-NOT-READY: no primal-beast entity row exists in the app; statblock, numbers, and choice are registry data only',
        },
        prompt:
          'Primal Companion (kind H, entity path modeled-not-ready — no primal-beast row exists yet, so the DM applies these numbers, they are not an entity): you magically summon a primal beast; choose its stat block — Beast of the Land, Beast of the Sea, or Beast of the Sky — stored as a choice. All three have AC 13 plus your Wisdom modifier and add your Proficiency Bonus to their ability checks and saving throws. Land: Hit Points 5 plus five times your Ranger level (d8 Hit Dice equal to your Ranger level); Beast\'s Strike deals 1d8 + 2 plus your Wisdom modifier Bludgeoning, Piercing, or Slashing damage (type chosen at summoning), plus 1d6 extra and Prone (Large or smaller) if the beast moved at least 20 feet straight toward the target first. Sea: Hit Points 5 plus five times your Ranger level (d8 Hit Dice equal to your Ranger level); Beast\'s Strike deals 1d6 + 2 plus your Wisdom modifier Bludgeoning or Piercing damage and Grapples the target (escape DC equals your spell save DC). Sky: Hit Points 4 plus four times your Ranger level (d6 Hit Dice equal to your Ranger level); Beast\'s Strike deals 1d4 + 3 plus your Wisdom modifier Slashing damage. The beast moves and uses its Reaction on its own, but only takes the Dodge action unless you take a Bonus Action to command it, or sacrifice one of your attacks to command Beast\'s Strike.',
        engine: 'subclassService.primalCompanionAc / primalCompanionHp (pure math); companion instantiation and command actions are named follow-ups.',
        gateCheck: true,
      },
      {
        key: 'exceptional_training',
        name: 'Exceptional Training',
        level: 7,
        kind: 'C',
        mechanics: {
          effect: 'whenever you command your Primal Companion with a Bonus Action, it can also take the Dash, Disengage, Dodge, or Help action using its Bonus Action; its Beast\'s Strike counts as magical for overcoming Resistance and Immunity to nonmagical damage, as the DM confirms at the gate',
        },
        prompt:
          'Exceptional Training: whenever you command your Primal Companion with a Bonus Action, it can also take the Dash, Disengage, Dodge, or Help action using its Bonus Action. Its Beast\'s Strike counts as magical for overcoming Resistance and Immunity to nonmagical damage, as the DM confirms at the gate.',
        engine: 'DM-adjudicated in Batch 4; the companion-action hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'bestial_fury',
        name: 'Bestial Fury',
        level: 11,
        kind: 'C',
        mechanics: {
          effect: 'your Primal Companion can make two Beast\'s Strike attacks when commanded; once per turn, when it hits a creature marked by your Hunter\'s Mark, it shares some of that spell\'s extra damage, as the DM confirms at the gate for the exact amount',
        },
        prompt:
          'Bestial Fury: your Primal Companion can make two Beast\'s Strike attacks when commanded. Once per turn, when it hits a creature marked by your Hunter\'s Mark, it shares some of that spell\'s extra damage, as the DM confirms at the gate for the exact amount.',
        engine: 'DM-adjudicated in Batch 4; the companion-attack hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'share_spells',
        name: 'Share Spells',
        level: 15,
        kind: 'E',
        mechanics: {
          effect: 'when you cast a spell that targets only yourself, your Primal Companion also gains the spell\'s benefit if it is within range, as the DM confirms at the gate for the exact range and limits',
        },
        prompt:
          'Share Spells: when you cast a spell that targets only yourself, your Primal Companion also gains the spell\'s benefit if it is within range, as the DM confirms at the gate for the exact range and limits.',
        engine: 'DM-adjudicated in Batch 4; the spell-sharing hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'primal_beast_statblock', options: ['Beast of the Land', 'Beast of the Sea', 'Beast of the Sky'], note: 'stored in migration 103 subclass_choices_json; Beast of the Pack is a later variant, NOT in the PHB 2024 entry and not an option here' },
    ],
  },
  {
    key: 'fey_wanderer',
    name: 'Fey Wanderer',
    description: 'A ranger touched by the Feywild whose strikes carry psychic dread and whose words charm. Your fey spells are always ready, your glamour bends every Charisma check, and at your peak you step through mist without a slot.',
    class: 'ranger',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: '2024 knowledge + secondary 2024 summaries; NOT from the Pt1/Pt2 scans (2014 PHB has no Fey Wanderer — see header). Fey Wanderer is imported from Tasha\'s, updated for 2024; Summon Fey replaces Dispel Magic at 9th because Dispel Magic is now on the Ranger list.',
    features: [
      {
        key: 'dreadful_strikes',
        name: 'Dreadful Strikes',
        level: 3,
        kind: 'A',
        mechanics: {
          damage: { dice: '1d4', type: 'Psychic', limit: 'once per turn', scaling: '1d6 at 11th level' },
        },
        prompt:
          'Dreadful Strikes: when you hit a creature with a weapon, you can deal an extra 1d4 Psychic damage to the target, which can take this extra damage only once per turn. The extra damage increases to 1d6 when you reach 11th level.',
        engine: 'subclassService.dreadfulStrikesDie (pure math); the extra-damage hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'fey_wanderer_spells',
        name: 'Fey Wanderer Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'always prepared',
          alwaysPreparedByLevel: {
            3: ['Charm Person'],
            5: ['Misty Step'],
            9: ['Summon Fey'],
            13: ['Dimension Door'],
            17: ['Mislead'],
          },
        },
        prompt:
          'Fey Wanderer Spells: you always have these spells prepared — Charm Person at 3rd, Misty Step at 5th, Summon Fey at 9th, Dimension Door at 13th, Mislead at 17th. Counted once, as PHB 2024, not double-counted from Tasha\'s.',
        engine: 'subclassService.rangerSubclassSpellsAtLevel (pure lookup); catalog-checked in Batch 4.',
        gateCheck: true,
      },
      {
        key: 'otherworldly_glamour',
        name: 'Otherworldly Glamour',
        level: 3,
        kind: 'E',
        mechanics: {
          charismaCheckBonus: 'your Wisdom modifier (minimum of +1)',
          skillProficiencyChoice: ['Deception', 'Performance', 'Persuasion'],
        },
        prompt:
          'Otherworldly Glamour: whenever you make a Charisma check, you gain a bonus to the check equal to your Wisdom modifier (minimum of +1). You also gain proficiency in one skill of your choice: Deception, Performance, or Persuasion.',
        engine: 'DM-adjudicated in Batch 4; the check-bonus hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'beguiling_twist',
        name: 'Beguiling Twist',
        level: 7,
        kind: 'E',
        mechanics: {
          saves: 'Advantage on saving throws to avoid or end the Charmed or Frightened condition',
          redirect: 'whenever you or a creature you can see within 120 feet of you succeeds on a saving throw against being Charmed or Frightened, you can use your Reaction to force a different creature you can see within 120 feet of you to make a Wisdom saving throw against your spell save DC, becoming Charmed or Frightened on a failure, as the DM confirms at the gate for repeat saves',
        },
        prompt:
          'Beguiling Twist: you have Advantage on saving throws to avoid or end the Charmed or Frightened condition. Whenever you or a creature you can see within 120 feet of you succeeds on a saving throw against being Charmed or Frightened, you can use your Reaction to force a different creature you can see within 120 feet of you to make a Wisdom saving throw against your spell save DC, becoming Charmed or Frightened on a failure, as the DM confirms at the gate for repeat saves.',
        engine: 'DM-adjudicated in Batch 4; the reaction-redirect hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'fey_reinforcements',
        name: 'Fey Reinforcements',
        level: 11,
        kind: 'C',
        mechanics: {
          effect: 'you can cast Summon Fey without a Material component; once per Long Rest, you can cast it without using a spell slot; you can also cast it for a shorter duration without requiring Concentration, as the DM confirms at the gate for the exact duration',
        },
        prompt:
          'Fey Reinforcements: you can cast Summon Fey without a Material component. Once per Long Rest, you can cast it without using a spell slot, and you can also cast it for a shorter duration without requiring Concentration, as the DM confirms at the gate for the exact duration.',
        engine: 'DM-adjudicated in Batch 4; the summon hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'misty_wanderer',
        name: 'Misty Wanderer',
        level: 15,
        kind: 'C',
        mechanics: {
          effect: 'cast Misty Step without expending a spell slot, a number of times equal to your Wisdom modifier (minimum of once) per Long Rest; you can also bring one willing creature with you, as the DM confirms at the gate',
        },
        prompt:
          'Misty Wanderer: you can cast Misty Step without expending a spell slot, a number of times equal to your Wisdom modifier (minimum of once), regaining all expended uses when you finish a Long Rest. You can also bring one willing creature with you, as the DM confirms at the gate.',
        engine: 'DM-adjudicated in Batch 4; the teleport hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'otherworldly_glamour_skill', options: ['Deception', 'Performance', 'Persuasion'] },
    ],
  },
  {
    key: 'gloom_stalker',
    name: 'Gloom Stalker',
    description: 'A ranger who hunts from the dark no eye can pierce. You strike first and hardest, vanish in darkness, shrug off charm and fear, and at your peak your dodges carry you through shadow itself.',
    class: 'ranger',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: '2024 knowledge + secondary 2024 summaries; NOT from the Pt1/Pt2 scans (2014 PHB has no Gloom Stalker — see header). Gloom Stalker is imported from Xanathar\'s, revised for 2024: no first-round extra attack, Dreadful Strike is a per-Long-Rest Psychic bonus instead.',
    features: [
      {
        key: 'dread_ambusher',
        name: 'Dread Ambusher',
        level: 3,
        kind: 'A',
        mechanics: {
          ambushersLeap: 'at the start of your first turn of each combat, your Speed increases by 10 feet until the end of that turn',
          dreadfulStrike: { dice: '2d6', type: 'Psychic', limit: 'once per turn, a number of times equal to your Wisdom modifier (minimum of once) per Long Rest', scaling: '2d8 at 11th, see Stalker\'s Flurry' },
        },
        prompt:
          'Dread Ambusher: at the start of your first turn of each combat, your Speed increases by 10 feet until the end of that turn. When you attack a creature and hit it with a weapon, you can deal an extra 2d6 Psychic damage; you can use this benefit only once per turn, a number of times equal to your Wisdom modifier (minimum of once), regaining all expended uses when you finish a Long Rest. At 11th level the damage becomes 2d8 (see Stalker\'s Flurry).',
        engine: 'subclassService.dreadAmbusherDice (pure math); the extra-damage hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'gloom_stalker_spells',
        name: 'Gloom Stalker Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'always prepared',
          alwaysPreparedByLevel: {
            3: ['Disguise Self'],
            5: ['Rope Trick'],
            9: ['Fear'],
            13: ['Greater Invisibility'],
            17: ['Seeming'],
          },
        },
        prompt:
          'Gloom Stalker Spells: you always have these spells prepared — Disguise Self at 3rd, Rope Trick at 5th, Fear at 9th, Greater Invisibility at 13th, Seeming at 17th. Counted once, as PHB 2024, not double-counted from Xanathar\'s.',
        engine: 'subclassService.rangerSubclassSpellsAtLevel (pure lookup); catalog-checked in Batch 4.',
        gateCheck: true,
      },
      {
        key: 'umbral_sight',
        name: 'Umbral Sight',
        level: 3,
        kind: 'E',
        mechanics: {
          darkvision: '60 feet, or your existing Darkvision range increases by 60 feet',
          invisibleInDarkness: 'while entirely in Darkness, you have the Invisible condition against any creature that relies on Darkvision to see you in that Darkness',
        },
        prompt:
          'Umbral Sight: you gain Darkvision out to a range of 60 feet; if you already have Darkvision, its range increases by 60 feet. While entirely in Darkness, you have the Invisible condition against any creature that relies on Darkvision to see you in that Darkness.',
        engine: 'DM-adjudicated in Batch 4; the vision hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'iron_mind',
        name: 'Iron Mind',
        level: 7,
        kind: 'E',
        mechanics: {
          effect: 'gain proficiency in Wisdom saving throws; if you already have that proficiency, gain proficiency in Intelligence or Charisma saving throws (your choice)',
        },
        prompt:
          'Iron Mind: you gain proficiency in Wisdom saving throws. If you already have that proficiency, you instead gain proficiency in Intelligence or Charisma saving throws (your choice).',
        engine: 'DM-adjudicated in Batch 4; the save-proficiency hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'stalkers_flurry',
        name: "Stalker's Flurry",
        level: 11,
        kind: 'C',
        mechanics: {
          dreadfulStrikeUpgrade: '2d8 Psychic damage',
          extraEffects: [
            { name: 'Sudden Strike', effect: 'when you use Dreadful Strike, make another attack with the same weapon against a different creature within 5 feet of the original target and within the weapon\'s range' },
            { name: 'Mass Fear', effect: 'when you use Dreadful Strike, the target and each creature within 10 feet of it must make a Wisdom saving throw against your spell save DC or be Frightened, as the DM confirms at the gate for duration' },
          ],
        },
        prompt:
          'Stalker\'s Flurry: the Psychic damage of your Dreadful Strike becomes 2d8. In addition, when you use Dreadful Strike, you can cause one additional effect: Sudden Strike — make another attack with the same weapon against a different creature within 5 feet of the original target and within the weapon\'s range; or Mass Fear — the target and each creature within 10 feet of it must make a Wisdom saving throw against your spell save DC or be Frightened, as the DM confirms at the gate for duration.',
        engine: 'DM-adjudicated in Batch 4; the extra-attack/fear hooks are named follow-ups.',
        gateCheck: true,
      },
      {
        key: 'shadowy_dodge',
        name: 'Shadowy Dodge',
        level: 15,
        kind: 'C',
        mechanics: {
          action: 'Reaction',
          trigger: 'a creature makes an attack roll against you',
          effect: 'impose Disadvantage on that roll; whether the attack hits or misses, after it is resolved you can teleport up to 30 feet to an unoccupied space you can see',
        },
        prompt:
          'Shadowy Dodge (Reaction): when a creature makes an attack roll against you, you can impose Disadvantage on that roll. Whether the attack hits or misses, after it is resolved you can teleport up to 30 feet to an unoccupied space you can see.',
        engine: 'DM-adjudicated in Batch 4; the reaction/teleport hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'hunter',
    name: 'Hunter',
    description: 'A ranger who reads prey like a book and kills it like a professional. Your mark reveals every weakness, your prey falls to slayer, horde-breaker, or colossus-slayer tricks, and at your peak your defense turns any blow aside.',
    class: 'ranger',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: '2024 knowledge + secondary 2024 summaries; NOT from the Pt1/Pt2 scans (2014 PHB Hunter differs: no Hunter\'s Lore at 3rd, Multiattack at 11th, and a choose-one Superior Hunter\'s Defense at 15th — see header). 2024 Hunter drops Multiattack and makes Superior Hunter\'s Defense a fixed reaction.',
    features: [
      {
        key: 'hunters_lore',
        name: "Hunter's Lore",
        level: 3,
        kind: 'F',
        mechanics: {
          effect: 'while a creature is marked by your Hunter\'s Mark, you know whether it has any Immunities, Resistances, or Vulnerabilities, and if it has any, you know what they are',
        },
        prompt:
          'Hunter\'s Lore: while a creature is marked by your Hunter\'s Mark, you know whether that creature has any Immunities, Resistances, or Vulnerabilities, and if it has any, you know what they are.',
        engine: 'Family-3-style surfacing (mechanics-hooks, Amendment 2 §2 #14): while a creature is marked by Hunter\'s Mark, its Immunities/Resistances/Vulnerabilities are read from the bestiary (lookupBestiaryFull carries I/R/V) and surfaced in the prompt/pending block. TAXONOMY GAP, flagged: no existing kind fits a computed-knowledge surfacing — kind stays F ONLY because no letter fits, not because it is prompt-only; the plan update must add the kind. FOLLOW-UP: no Hunter\'s Mark state exists in the staged mirror (zero matches) — the surfacing cannot fire until a mark record exists. Exact implementation patch is in HANDOFF.md for the always-prepared family.',
        gateCheck: true,
      },
      {
        key: 'hunters_prey',
        name: "Hunter's Prey",
        level: 3,
        kind: 'G',
        mechanics: {
          swappable: 'whenever you finish a Short or Long Rest, you can replace the chosen option with the other one',
          options: [
            { name: 'Colossus Slayer', effect: 'when you hit a creature with a weapon, the weapon deals an extra 1d8 damage to the target if it is missing any of its Hit Points, once per turn' },
            { name: 'Horde Breaker', effect: 'once on each of your turns when you make an attack with a weapon, you can make another attack with the same weapon against a different creature within 5 feet of the original target, within the weapon\'s range, that you have not attacked this turn' },
          ],
        },
        prompt:
          'Hunter\'s Prey (stored choice, swappable on a Short or Long Rest): choose Colossus Slayer — when you hit a creature with a weapon, the weapon deals an extra 1d8 damage if the target is missing any Hit Points, once per turn; or Horde Breaker — once on each of your turns when you make an attack with a weapon, you can make another attack with the same weapon against a different creature within 5 feet of the original target, within the weapon\'s range, that you have not attacked this turn.',
        engine: 'subclassService.colossusSlayerDamage (pure math, 1d8); the extra-attack hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'defensive_tactics',
        name: 'Defensive Tactics',
        level: 7,
        kind: 'G',
        mechanics: {
          swappable: 'whenever you finish a Short or Long Rest, you can replace the chosen option with the other one',
          options: [
            { name: 'Escape the Horde', effect: 'Opportunity Attacks have Disadvantage against you' },
            { name: 'Multiattack Defense', effect: 'when a creature hits you with an attack roll, that creature has Disadvantage on all other attack rolls against you this turn' },
          ],
        },
        prompt:
          'Defensive Tactics (stored choice, swappable on a Short or Long Rest): choose Escape the Horde — Opportunity Attacks have Disadvantage against you; or Multiattack Defense — when a creature hits you with an attack roll, that creature has Disadvantage on all other attack rolls against you this turn.',
        engine: 'DM-adjudicated in Batch 4; the disadvantage hooks are named follow-ups.',
        gateCheck: true,
      },
      {
        key: 'superior_hunters_prey',
        name: "Superior Hunter's Prey",
        level: 11,
        kind: 'C',
        mechanics: {
          effect: 'once per turn when you deal damage to a creature marked by your Hunter\'s Mark, you can also deal that spell\'s extra damage to a different creature that you can see within 30 feet of the first creature',
        },
        prompt:
          'Superior Hunter\'s Prey: once per turn when you deal damage to a creature marked by your Hunter\'s Mark, you can also deal that spell\'s extra damage to a different creature that you can see within 30 feet of the first creature.',
        engine: 'DM-adjudicated in Batch 4; the splash-damage hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'superior_hunters_defense',
        name: "Superior Hunter's Defense",
        level: 15,
        kind: 'C',
        mechanics: {
          action: 'Reaction',
          trigger: 'you take damage',
          effect: 'give yourself Resistance to that damage and any other damage of the same type until the end of the current turn',
        },
        prompt:
          'Superior Hunter\'s Defense (Reaction): when you take damage, you can give yourself Resistance to that damage and any other damage of the same type until the end of the current turn. In 2024 this is a fixed feature, not a choose-one option.',
        engine: 'DM-adjudicated in Batch 4; the resistance hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'hunters_prey', options: ['Colossus Slayer', 'Horde Breaker'], note: 'swappable on a Short or Long Rest; stored in migration 103 subclass_choices_json' },
      { key: 'defensive_tactics', options: ['Escape the Horde', 'Multiattack Defense'], note: 'swappable on a Short or Long Rest; stored in migration 103 subclass_choices_json' },
    ],
  },
  {
    key: 'horizon_walker',
    name: 'Horizon Walker',
    description: 'A ranger who walks between planes and strikes with force itself. You sense portals, turn your damage to force, step through the Ethereal, and at your peak you teleport between every blow and resist what hits you.',
    class: 'ranger',
    source: "Xanathar's Guide to Everything (2014) — 2024 conversion",
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: '2014 grant points 3/7/11/15 coincide with the built 2024 Ranger cadence, so no feature was re-pointed. The 2014 subclass spells were added to the list and did not count against spells known; they are carried as always prepared at 3/5/9/13/17, matching the PHB Ranger subclass-spell pattern, and that access change is flagged gateCheck. No 2024 reprint of this subclass exists: this entry is the app conversion of the 2014 Xanathar extract, and every number is gateCheck for Zach.',
    features: [
      {
        key: 'horizon_walker_magic',
        name: 'Horizon Walker Magic',
        level: 3,
        kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['Protection from Evil and Good'], 5: ['Misty Step'], 9: ['Haste'], 13: ['Banishment'], 17: ['Teleportation Circle'] } },
        prompt: 'Horizon Walker Magic (ALWAYS PREPARED): at 3rd Protection from Evil and Good; at 5th Misty Step; at 9th Haste; at 13th Banishment; at 17th Teleportation Circle. All five are in the app spell catalog.',
        engine: 'subclassService.rangerSubclassSpellsAtLevel (cumulative list); the prepared-spells route surfacing is a named follow-up, not wired in S2.',
        gateCheck: true,
      },
      {
        key: 'detect_portal',
        name: 'Detect Portal',
        level: 3,
        kind: 'C',
        mechanics: { action: 'action', effect: 'detect the distance and direction to the closest planar portal within 1 mile of you', regain: 'once per Short or Long Rest' },
        prompt: 'Detect Portal: as an action, detect the distance and direction to the closest planar portal within 1 mile of you. Once per Short or Long Rest.',
        engine: 'DM-prompt in S2; portal detection is DM-adjudicated (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'planar_warrior',
        name: 'Planar Warrior',
        level: 3,
        kind: 'B',
        mechanics: { action: 'Bonus Action', range: 'one creature you can see within 30 feet', effect: 'the next time you hit that creature with a weapon attack on this turn, all damage dealt by the attack becomes force damage, and the creature takes an extra 1d8 force damage (2d8 at 11th level)' },
        prompt: 'Planar Warrior: as a Bonus Action, choose one creature you can see within 30 feet. The next time you hit that creature with a weapon attack on this turn, all damage dealt by the attack becomes force damage, and the creature takes an extra 1d8 force damage (2d8 at 11th level).',
        engine: 'DM-prompt in S2; attack-path damage conversion is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'ethereal_step',
        name: 'Ethereal Step',
        level: 7,
        kind: 'C',
        mechanics: { action: 'Bonus Action', effect: 'cast Etherealness with this feature, without expending a spell slot; the spell ends at the end of the current turn', regain: 'once per Short or Long Rest' },
        prompt: 'Ethereal Step: as a Bonus Action, cast Etherealness with this feature, without expending a spell slot, but the spell ends at the end of the current turn. Once per Short or Long Rest.',
        engine: 'DM-prompt in S2; spell-cast hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'distant_strike',
        name: 'Distant Strike',
        level: 11,
        kind: 'C',
        mechanics: { trigger: 'when you take the Attack action', effect: 'teleport up to 10 feet to an unoccupied space you can see before each attack; if you attack at least two different creatures with the action, you can make one additional attack with it against a third creature' },
        prompt: 'Distant Strike: when you take the Attack action, you can teleport up to 10 feet to an unoccupied space you can see before each attack. If you attack at least two different creatures with the action, you can make one additional attack with it against a third creature.',
        engine: 'DM-prompt in S2; teleport/extra-attack hooks are named follow-ups.',
        gateCheck: true,
      },
      {
        key: 'spectral_defense',
        name: 'Spectral Defense',
        level: 15,
        kind: 'E',
        mechanics: { reaction: 'when you take damage from an attack', effect: 'give yourself resistance to all of that attack\'s damage on this turn' },
        prompt: 'Spectral Defense: when you take damage from an attack, you can use your Reaction to give yourself resistance to all of that attack\'s damage on this turn.',
        engine: 'DM-prompt in S2; damage-path resistance hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'monster_slayer',
    name: 'Monster Slayer',
    description: 'A ranger who hunts the supernatural by knowing it — its resistances, its spells, its very thoughts. You mark a quarry, add dice to every save against it, foil its magic, and at your peak you strike it before it can strike you.',
    class: 'ranger',
    source: "Xanathar's Guide to Everything (2014) — 2024 conversion",
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: '2014 grant points 3/7/11/15 coincide with the built 2024 Ranger cadence, so no feature was re-pointed. The 2014 subclass spells were added to the list and did not count against spells known; they are carried as always prepared at 3/5/9/13/17, matching the PHB Ranger subclass-spell pattern, and that access change is flagged gateCheck. No 2024 reprint of this subclass exists: this entry is the app conversion of the 2014 Xanathar extract, and every number is gateCheck for Zach.',
    features: [
      {
        key: 'monster_slayer_magic',
        name: 'Monster Slayer Magic',
        level: 3,
        kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['Protection from Evil and Good'], 5: ['Zone of Truth'], 9: ['Magic Circle'], 13: ['Banishment'], 17: ['Hold Monster'] } },
        prompt: 'Monster Slayer Magic (ALWAYS PREPARED): at 3rd Protection from Evil and Good; at 5th Zone of Truth; at 9th Magic Circle; at 13th Banishment; at 17th Hold Monster. All five are in the app spell catalog.',
        engine: 'subclassService.rangerSubclassSpellsAtLevel (cumulative list); the prepared-spells route surfacing is a named follow-up, not wired in S2.',
        gateCheck: true,
      },
      {
        key: 'hunters_sense',
        name: "Hunter's Sense",
        level: 3,
        kind: 'C',
        mechanics: { action: 'action', range: 'one creature you can see within 60 feet', effect: 'immediately learn whether the creature has any damage immunities, resistances, or vulnerabilities and what they are; if the creature is hidden from divination magic, you sense that it has none', uses: 'equal to your Wisdom modifier (minimum of once)', regain: 'all expended uses on a Long Rest' },
        prompt: "Hunter's Sense: as an action, choose one creature you can see within 60 feet and immediately learn whether it has any damage immunities, resistances, or vulnerabilities and what they are (if it is hidden from divination magic, you sense that it has none). Uses equal to your Wisdom modifier (minimum of once), regained on a Long Rest.",
        engine: 'DM-prompt in S2; information reveal is DM-adjudicated (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'slayers_prey',
        name: "Slayer's Prey",
        level: 3,
        kind: 'B',
        mechanics: { action: 'Bonus Action', range: 'one creature you can see within 60 feet', effect: 'the first time each turn that you hit that target with a weapon attack, it takes an extra 1d6 damage from the weapon', duration: 'until you finish a Short or Long Rest; ends early if you designate a different creature' },
        prompt: "Slayer's Prey: as a Bonus Action, designate one creature you can see within 60 feet. The first time each turn that you hit that target with a weapon attack, it takes an extra 1d6 damage from the weapon. This lasts until you finish a Short or Long Rest, or until you designate a different creature.",
        engine: 'DM-prompt in S2; attack-path extra damage is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'supernatural_defense',
        name: 'Supernatural Defense',
        level: 7,
        kind: 'E',
        mechanics: { trigger: 'whenever the target of your Slayer\'s Prey forces you to make a saving throw, and whenever you make an ability check to escape that target\'s grapple', effect: 'add 1d6 to your roll' },
        prompt: 'Supernatural Defense: whenever the target of your Slayer\'s Prey forces you to make a saving throw, and whenever you make an ability check to escape that target\'s grapple, add 1d6 to your roll.',
        engine: 'DM-prompt in S2; save/check hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'magic_users_nemesis',
        name: "Magic-User's Nemesis",
        level: 11,
        kind: 'C',
        mechanics: { reaction: 'when you see a creature casting a spell or teleporting within 60 feet of you', effect: 'the creature must succeed on a Wisdom saving throw against your spell save DC, or its spell or teleport fails and is wasted', regain: 'once per Short or Long Rest' },
        prompt: "Magic-User's Nemesis: when you see a creature casting a spell or teleporting within 60 feet of you, you can use your Reaction to try to foil it. The creature must succeed on a Wisdom saving throw against your spell save DC, or its spell or teleport fails and is wasted. Once per Short or Long Rest.",
        engine: 'DM-prompt in S2; reaction/counterspell-style hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'slayers_counter',
        name: "Slayer's Counter",
        level: 15,
        kind: 'C',
        mechanics: { reaction: 'if the target of your Slayer\'s Prey forces you to make a saving throw', effect: 'make one weapon attack against the quarry immediately before making the saving throw; if your attack hits, your save automatically succeeds, in addition to the attack\'s normal effects' },
        prompt: "Slayer's Counter: if the target of your Slayer's Prey forces you to make a saving throw, you can use your Reaction to make one weapon attack against the quarry immediately before making the saving throw. If your attack hits, your save automatically succeeds, in addition to the attack's normal effects.",
        engine: 'DM-prompt in S2; reaction/attack-before-save hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'stone_singer',
    name: 'Stone Singer',
    description: 'A ranger who sings to stone and wears the mountain. Your weapon coats in exploding rock, you burrow through earth, your guard turns blades aside, and at your peak you answer a hit with a diamond\'s hardness.',
    class: 'ranger',
    source: 'Hoard of Heroes — 2024 conversion',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: 'Hoard grants ran 3/7/11/15, which coincide exactly with the built 2024 Ranger cadence 3/7/11/15 — no re-pointing. Stone Singer Magic is the source\'s "learned, not counted against known" wording, carried here as always-prepared in the 2024 pattern. Stone Step\'s 11th-level improvement is kept on the 3rd-level feature, as with PHB improvement-on-feature patterns. No 2024 reprint exists: every number is gateCheck for Zach.',
    sourceNote: 'Hoard of Heroes is third-party/homebrew (Zach: ABSOLUTELY NECESSARY, plan section 13). Mechanics paraphrased in the app\'s own wording from the Hoard extract; never verbatim book prose. NAME FLAG: the feature table calls the 7th-level feature "Granite Aegis" while its body heading reads "Granite Guard" — the body heading is used here, and the discrepancy is flagged for Zach/the gate.',
    features: [
      {
        key: 'stone_singer_magic',
        name: 'Stone Singer Magic',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'always prepared (2024 conversion of the source\'s learned, not counted against known)',
          alwaysPreparedByLevel: {
            3: ['Earth Tremor'],
            5: ['Shatter'],
            9: ['Meld into Stone'],
            13: ['Stone Shape'],
            17: ['Transmute Rock'],
          },
        },
        prompt: 'Stone Singer Magic (ALWAYS PREPARED in the 2024 pattern): at 3rd level Earth Tremor; at 5th Shatter; at 9th Meld into Stone; at 13th Stone Shape; at 17th Transmute Rock. All five are in the app spell catalog.',
        engine: 'subclassService.rangerSubclassSpellsAtLevel (cumulative list); the prepared-spells route surfacing is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'earthen_armament',
        name: 'Earthen Armament',
        level: 3,
        kind: 'C',
        mechanics: { action: 'bonus action', target: 'one weapon or piece of ammunition', duration: 'until the end of your turn', effect: 'the next time you hit with that weapon or piece of ammunition, the coating explodes and deals an additional 1d6 piercing damage to the target and another creature of your choice within 5 feet of it' },
        prompt: 'Earthen Armament (bonus action): you coat one weapon or piece of ammunition in a sheath of fragile stone until the end of your turn. The next time you hit with that weapon or piece of ammunition, the coating explodes and deals an additional 1d6 piercing damage to the target and another creature of your choice within 5 feet of it.',
        engine: 'DM-prompt in S4; the splash rider is DM-adjudicated (named follow-up), never silently added to a PC reported total.',
        gateCheck: true,
      },
      {
        key: 'stone_step',
        name: 'Stone Step',
        level: 3,
        kind: 'C',
        mechanics: { action: 'action', burrow: 'burrowing speed of 5 feet until the end of your turn; this increases to 10 feet at 11th level', at11: 'when you reach 11th level, you can burrow through nonmagical, unworked earth and stone, and while doing so you do not disturb the material you move through' },
        prompt: 'Stone Step (action): you gain a burrowing speed of 5 feet until the end of your turn. This increases to 10 feet at 11th level, at which point you can burrow through nonmagical, unworked earth and stone without disturbing the material you move through.',
        engine: 'DM-prompt in S4; burrowing movement is DM-adjudicated (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'granite_guard',
        name: 'Granite Guard',
        level: 7,
        kind: 'E',
        mechanics: { trigger: 'when you use your Earthen Armament feature', effect: 'you gain resistance to nonmagical bludgeoning, piercing, and slashing damage until the beginning of your next turn, or until you take damage' },
        prompt: 'Granite Guard: when you use your Earthen Armament feature, you gain resistance to nonmagical bludgeoning, piercing, and slashing damage until the beginning of your next turn, or until you take damage. (The Hoard feature table calls this feature Granite Aegis; the body heading Granite Guard is used here — see the entry source note.)',
        engine: 'DM-prompt in S4; resistance window is DM-tracked (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'boulder_breaker',
        name: 'Boulder Breaker',
        level: 11,
        kind: 'C',
        mechanics: { frequency: 'once on your turn', damage: 'an extra 1d6 bludgeoning damage to one target you hit with an attack', save: 'if the target is a creature, it must succeed on a Strength saving throw or be knocked prone or pushed 15 feet away from you, your choice', collision: 'if, as a result of being pushed away, the target would collide with a solid surface, or an object or creature that is its size or larger, it takes an additional 1d6 bludgeoning damage' },
        prompt: 'Boulder Breaker: once on your turn, you can deal an extra 1d6 bludgeoning damage to one target you hit with an attack. If the target is a creature, it must succeed on a Strength saving throw or be knocked prone or pushed 15 feet away from you, your choice. If, as a result of being pushed away, the target would collide with a solid surface, or an object or creature that is its size or larger, it takes an additional 1d6 bludgeoning damage.',
        engine: 'DM-prompt in S4; push/collision resolution is DM-adjudicated (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'diamond_defense',
        name: 'Diamond Defense',
        level: 15,
        kind: 'C',
        mechanics: { trigger: 'when a creature hits you with an attack, but before the damage is dealt', reaction: 'reaction', tempHp: 'temporary hit points equal to half your Ranger level + your Constitution modifier' },
        prompt: 'Diamond Defense (reaction): when a creature hits you with an attack but before the damage is dealt, you can gain temporary hit points equal to half your Ranger level + your Constitution modifier.',
        engine: 'DM-prompt in S4; reaction timing vs the damage path is a named follow-up. Temp-HP math is subclassService.stoneDiamondDefenseTempHp (pure math).',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'winter_walker',
    name: 'Winter Walker',
    description: 'A ranger of the frozen wastes whose cold ignores resistance and whose mark freezes the fleeing. Your Hunter\'s Mark grants temporary life, your soul fortifies allies, and at your peak you haunt the snow as a ghostly frozen form.',
    class: 'ranger',
    source: 'Heroes of Faerûn',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: 'Heroes of Faerûn grants run 3/7/11/15, which coincide exactly with the built 2024 Ranger cadence 3/7/11/15 — no feature was re-pointed. Mechanics paraphrased in the app\'s own wording from the Heroes of Faerûn text extract (Mac, 660,813 bytes); every number is gateCheck for Zach.',
    choices: [],
    features: [
      {
        key: 'frigid_explorer',
        name: 'Frigid Explorer',
        level: 3,
        kind: 'E',
        mechanics: { bitingCold: 'damage from your weapon attacks, Ranger spells, and Ranger features ignores Resistance to Cold damage', frostResistance: 'you have Resistance to Cold damage', polarStrikes: 'when you hit a creature with an attack roll using a weapon, you can deal an extra 1d4 Cold damage to the target, which can take this extra damage only once per turn; when you reach Ranger level 11, this extra damage increases to 1d6 — see subclassService.polarStrikesDie' },
        prompt: 'Frigid Explorer: Biting Cold — damage from your weapon attacks, Ranger spells, and Ranger features ignores Resistance to Cold damage. Frost Resistance — you have Resistance to Cold damage. Polar Strikes — when you hit a creature with an attack roll using a weapon, you can deal an extra 1d4 Cold damage to the target, which can take this extra damage only once per turn. When you reach Ranger level 11, this extra damage increases to 1d6.',
        engine: 'DM-prompt in S5; Cold resistance bypass and the once-per-turn limit are DM-adjudicated; the die step is subclassService.polarStrikesDie (pure math).',
        gateCheck: true,
      },
      {
        key: 'hunters_rime',
        name: 'Hunter\'s Rime',
        level: 3,
        kind: 'E',
        mechanics: { trigger: 'when you cast Hunter\'s Mark', tempHp: 'you gain Temporary Hit Points equal to 1d10 plus your Ranger level', marked: 'while a creature is marked by your Hunter\'s Mark, it cannot take the Disengage action' },
        prompt: 'Hunter\'s Rime: when you cast Hunter\'s Mark, you gain Temporary Hit Points equal to 1d10 plus your Ranger level. Additionally, while a creature is marked by your Hunter\'s Mark, it cannot take the Disengage action.',
        engine: 'DM-prompt in S5; the Disengage ban on a marked creature is DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'winter_walker_spells',
        name: 'Winter Walker Spells',
        level: 3,
        kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['Ice Knife'], 5: ['Hold Person'], 9: ['Remove Curse'], 13: ['Ice Storm'], 17: ['Cone of Cold'] } },
        prompt: 'Winter Walker Spells (always prepared): 3rd — Ice Knife; 5th — Hold Person; 9th — Remove Curse; 13th — Ice Storm; 17th — Cone of Cold.',
        engine: 'DM-prompt in S5; always-prepared list is rangerSubclassSpellsAtLevel (existing helper).',
        gateCheck: true,
      },
      {
        key: 'fortifying_soul',
        name: 'Fortifying Soul',
        level: 7,
        kind: 'C',
        mechanics: { action: 'Magic action', targets: 'a number of creatures you can see equal to your Wisdom modifier (minimum of one) — see subclassService.fortifyingSoulTargets', effect: 'each chosen creature regains Hit Points equal to 1d10 plus your Ranger level and has Advantage on saving throws to avoid or end the Frightened condition for 1 hour', reuse: 'once used, cannot be used again until you finish a Long Rest' },
        prompt: 'Fortifying Soul (Magic action): choose a number of creatures you can see equal to your Wisdom modifier (minimum of one). Each chosen creature regains Hit Points equal to 1d10 plus your Ranger level and has Advantage on saving throws to avoid or end the Frightened condition for 1 hour. Once you use this feature, you cannot use it again until you finish a Long Rest.',
        engine: 'DM-prompt in S5; target count is subclassService.fortifyingSoulTargets (pure math).',
        gateCheck: true,
      },
      {
        key: 'chilling_retribution',
        name: 'Chilling Retribution',
        level: 11,
        kind: 'C',
        mechanics: { reaction: 'when a creature hits you with an attack roll', save: 'force the creature to make a Wisdom saving throw against your spell save DC; on a failed save, the target has the Stunned condition until the end of your next turn; while the target is Stunned, its Speed is reduced to 0 feet', uses: 'a number of times equal to your Wisdom modifier (minimum of once) — see subclassService.chillingRetributionUses', rest: 'long' },
        prompt: 'Chilling Retribution (Reaction): when a creature hits you with an attack roll, you can force the creature to make a Wisdom saving throw against your spell save DC. On a failed save, the target has the Stunned condition until the end of your next turn. While the target is Stunned, its Speed is reduced to 0 feet. You can use this feature a number of times equal to your Wisdom modifier (minimum of once), and you regain all expended uses when you finish a Long Rest.',
        engine: 'DM-prompt in S5; use count is subclassService.chillingRetributionUses (pure math); the Stunned condition is DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'frozen_haunt',
        name: 'Frozen Haunt',
        level: 15,
        kind: 'H',
        mechanics: { trigger: 'when you cast Hunter\'s Mark, you can adopt a ghostly, snowy form; this form lasts until the spell ends', reuse: 'once used, cannot be used again until you finish a Long Rest unless you expend a level 4+ spell slot (no action required)', frozenSoul: 'you have Immunity to Cold damage; when you first adopt this form and at the start of each of your subsequent turns, each creature of your choice in a 15-foot Emanation originating from you takes 2d4 Cold damage', partiallyIncorporeal: 'you have Immunity to the Grappled, Prone, and Restrained conditions; you can move through creatures and objects as if they were Difficult Terrain, but you take 1d10 Force damage if you end your turn inside a creature or an object; if the form ends while you are inside a creature or an object, you are shunted to the nearest unoccupied space' },
        prompt: 'Frozen Haunt: when you cast Hunter\'s Mark, you can adopt a ghostly, snowy form. This form lasts until the spell ends, and while you are in this form, you gain the following benefits. Once you use this feature, you cannot use it again until you finish a Long Rest unless you expend a level 4+ spell slot (no action required). Frozen Soul: you have Immunity to Cold damage. When you first adopt this form and at the start of each of your subsequent turns, each creature of your choice in a 15-foot Emanation originating from you takes 2d4 Cold damage. Partially Incorporeal: you have Immunity to the Grappled, Prone, and Restrained conditions. You can move through creatures and objects as if they were Difficult Terrain, but you take 1d10 Force damage if you end your turn inside a creature or an object. If the form ends while you are inside a creature or an object, you are shunted to the nearest unoccupied space. ENTITY NOTE: this form has no entity row in the app — it is DM-tracked, not system-tracked.',
        engine: 'DM-prompt in S5; the form is transformation state, DM-tracked — no entity row is created for it (named follow-up if a form state system is ever built).',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'ferryman',
    name: 'Ferryman',
    description: 'A ranger who ferries souls and cuts them loose — a healer of the dying and a reaper of the dead. Your life force grows with every level, your blade deals psychic or radiant harm, and your spells — Bless, Gentle Repose, Speak with Dead — are always ready.',
    class: 'ranger',
    source: 'Additional Subclasses — Myths and Folklore Collection (Homebrewery, unofficial Fan Content)',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: 'PARTIAL COVERAGE (ROSTER.md A3/A4): confirmed 3rd-level features only are wired. The 7th-, 11th-, and 15th-level features were lost to two-column OCR interleaving (fragments confirm an 11th-level "Fated…" feature) and are NOT reconstructed here. Soul Cutter\'s Constitution-save rider is partially interleaved: the damage and psychic/radiant choice are confirmed, the rider\'s full effect is not.',
    unresolved: ['7th-level feature (name and mechanics lost to OCR interleaving)', '11th-level feature (fragment reads "Fated…"; name and mechanics lost)', '15th-level feature (name and mechanics lost)', 'Soul Cutter Constitution-save rider (full effect lost; damage and damage-type choice confirmed)'],
    features: [
      {
        key: 'ferryman_magic',
        name: 'Ferryman Magic',
        level: 3,
        kind: 'D',
        mechanics: { cantrip: 'you learn Spare the Dying if you do not know it', access: 'always prepared', alwaysPreparedByLevel: { 3: ['Bless'], 5: ['Gentle Repose'], 9: ['Speak with Dead'], 13: ['Death Ward'], 17: ['Holy Weapon'] } },
        prompt: 'Ferryman Magic: you learn Spare the Dying if you do not know it. Additional spells (ALWAYS PREPARED, not counting against spells known): at 3rd level Bless; at 5th Gentle Repose; at 9th Speak with Dead; at 13th Death Ward; at 17th Holy Weapon.',
        engine: 'subclassService.rangerSubclassSpellsAtLevel (cumulative) for the always-prepared spells; the cantrip grant is a prompt line, not a spell-list write.',
        gateCheck: true,
      },
      {
        key: 'enhanced_life_force',
        name: 'Enhanced Life Force',
        level: 3,
        kind: 'A',
        mechanics: { hitPointMaximum: '+3, then +1 per ranger level gained' },
        prompt: 'Enhanced Life Force: your hit point maximum increases by 3, then by 1 for each ranger level you gain.',
        engine: 'DM-prompt only in this batch; hit-point-maximum application is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'soul_cutter',
        name: 'Soul Cutter',
        level: 3,
        kind: 'C',
        mechanics: { trigger: 'once per turn on a weapon hit', extraDamage: '1d6 psychic or radiant, your choice', at11th: '1d8', rider: 'UNRESOLVED — the target makes a Constitution saving throw against the extra damage\'s rider, but the rider\'s full effect was lost to OCR interleaving; do not adjudicate the rider until the PDF is re-read' },
        prompt: 'Soul Cutter: once per turn on a weapon hit, deal +1d6 psychic or radiant damage, your choice (+1d8 at 11th level). The target makes a Constitution saving throw against an additional rider effect, whose full effect is UNRESOLVED (lost to OCR interleaving) — do not adjudicate the rider until the source PDF is re-read.',
        engine: 'DM-prompt only and gated for the rider.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
];

export default RANGER_SUBCLASSES;
