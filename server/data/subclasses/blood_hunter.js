/**
 * Blood Hunter Orders — the four Blood Hunter subclasses.
 *
 * Source: Blood Hunter (2024 Rules), GM Binder fan conversion of Matt Mercer's
 * Blood Hunter, 16 pp — transcribed ONLY from the verified text extract at
 * ~/workspace/dnd-app-review/blood-hunter-mixed-ancestry/Blood_Hunter_2024.txt.
 * The client classes.json display list (Ghostslayer/Lycan/Mutant/Profane Soul)
 * was checked against that extract name by name; the PDF wins on every
 * disagreement (see the build notes for the corrections it forced).
 *
 * Subclass choice at 3rd ("Blood Hunter Order"); subclass features at
 * 3rd, 7th, 11th, 15th, 18th (2024 martial cadence, per the PDF's own
 * design-notes appendix).
 *
 * No per-entry `selectionLevel` field: it is DERIVED by subclassService.js
 * from SUBCLASS_LEVELS (2026-11-06, item 29) — the class record is the
 * single source of truth, so entries can't drift.
 *
 * Kinds follow the registry convention: 'E' = DM-prompt only in v1 (no
 * combat-engine hook exists for hemocraft — no `hemocraft` string exists
 * anywhere in server/ today; rites, curses, mutagens, and transformations
 * are prompt text, like the overnight classes' Tier 0), 'D' = always-prepared
 * spell lists (the blackguard vice-spell pattern).
 *
 * gateCheckRequired is true on EVERY entry: the source is a fan-made
 * conversion, not a WotC printing, so no official 2024 book exists to
 * check the numbers against — Zach's gate IS the PDF check.
 *
 * origin_setting / origin_region are null (blackguard precedent): the
 * document prints NO setting for the Blood Hunter. Under validateSelection
 * (isOutsideFr = setting !== 'Forgotten Realms') a null origin requires
 * an origin explanation — fail-closed per the outside-FR ruling.
 *
 * Variant NOT built (PDF, "Variant: Hemocraft Ability Score"): with the
 * DM's permission a blood hunter may use Wisdom instead of Intelligence
 * for all blood hunter features. Default is Intelligence; the Wisdom
 * variant is recorded here as flagged/unbuilt, not implemented.
 */

export const BLOOD_HUNTER_SUBCLASSES = [
  {
    key: 'ghostslayer',
    name: 'Order of the Ghostslayer',
    description: 'A hunter of the undead whose crimson rite burns radiant and whose blade cuts the ethereal. Your rite lights the dark and resists necrotic harm, you step through the veil between planes, and at your peak you rise from zero hit points by burning your rites out.',
    class: 'blood_hunter',
    source: 'Blood Hunter (2024 Rules) — GM Binder fan conversion of Matt Mercer\'s Blood Hunter',
    sourceTier: 'fan-conversion',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'rite_of_the_dawn', name: 'Rite of the Dawn', level: 3, kind: 'E',
        mechanics: {
          riteDamageType: 'radiant',
          brightLightRadius: 20,
          resistancesWhileActive: ['necrotic'],
          bonusHemocraftDieVs: 'Undead',
          note: 'Learned as part of Crimson Rite; the extra rite damage is Radiant while this rite is active.',
        },
        prompt: 'Rite of the Dawn: your Crimson Rite damage is Radiant. While active, your weapon sheds Bright Light in a 20-foot radius, you have Resistance to Necrotic damage, and you roll an additional Hemocraft die against Undead.',
        engine: 'DM-prompt only in v1 (no hemocraft engine exists yet).',
        gateCheck: true,
      },
      {
        key: 'curse_specialist', name: 'Curse Specialist', level: 3, kind: 'E',
        mechanics: { bonusBloodMaledictUses: 1, cursesTargetAnyCreature: true, note: 'Blood Curses can target any creature, whether it has blood or not.' },
        prompt: 'Curse Specialist: you gain an additional use of your Blood Maledict feature, and your Blood Curses can target any creature, whether it has blood or not.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'aether_walk', name: 'Aether Walk', level: 7, kind: 'E',
        mechanics: {
          trigger: 'at the start of your turn, while not Incapacitated',
          effect: 'move through other creatures and objects as if they were Difficult Terrain; see and affect creatures and objects on the Ethereal Plane',
          endTurnInsideObject: '1d10 Force damage',
          durationRounds: 'Intelligence modifier (minimum of 1 round)',
          endsInsideObject: 'shunted to the nearest unoccupied space; Force damage equal to twice the number of feet moved',
          uses: '1/short or long rest; twice between rests starting at 15th level',
        },
        prompt: 'Aether Walk: at the start of your turn (while not Incapacitated) you can step into the veil between the planes — move through creatures and objects as Difficult Terrain, see and affect the Ethereal Plane. Lasts Intelligence modifier rounds (minimum 1). You take 1d10 Force damage if you end your turn inside an object; if you are inside an object when it ends, you are shunted to the nearest unoccupied space and take Force damage equal to twice the number of feet you moved. Once per Short or Long Rest, twice between rests at 15th level.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'brand_of_sundering', name: 'Brand of Sundering', level: 11, kind: 'E',
        mechanics: {
          bonusHemocraftDieVsBranded: true,
          blocksIncorporealMovementWhileBranded: true,
          note: 'When you hit a branded creature with a weapon for which you have an active Crimson Rite, roll an additional Hemocraft die for the rite damage.',
        },
        prompt: 'Brand of Sundering: when you hit a branded creature with a weapon for which you have an active Crimson Rite, roll an additional Hemocraft die for the rite damage. A branded creature with Incorporeal Movement (or a similar feature) cannot move through creatures or objects while branded.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'blood_curse_of_the_exorcist', name: 'Blood Curse of the Exorcist', level: 15, kind: 'E',
        mechanics: {
          bloodCurse: 'Blood Curse of the Exorcist',
          prerequisite: '15th level, Order of the Ghostslayer',
          countsAgainstCursesKnown: false,
          effect: 'Bonus Action: choose one creature you can see within 30 feet that has the Charmed or Frightened condition, or is under a possession effect — it is no longer Charmed, Frightened, or possessed.',
          amplify: 'A creature that charmed, frightened, or possessed the target takes 3d6 Psychic damage and must succeed on a Wisdom saving throw or have the Stunned condition until the end of your next turn.',
        },
        prompt: 'Blood Curse of the Exorcist (gained at 15th; does not count against your Blood Curses known): Bonus Action — a creature within 30 feet that is Charmed, Frightened, or possessed is no longer so. Amplify: the creature that imposed it takes 3d6 Psychic damage and must succeed on a Wisdom save or be Stunned until the end of your next turn.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'rite_revival', name: 'Rite Revival', level: 18, kind: 'E',
        mechanics: {
          trigger: 'reduced to 0 Hit Points but not killed outright, while one or more Crimson Rites are active',
          effect: 'all active Crimson Rites end and you drop to 1 Hit Point instead',
          uses: '1/long rest',
        },
        prompt: 'Rite Revival: if you have one or more Crimson Rites active and are reduced to 0 Hit Points but do not die outright, you can end all your active Crimson Rites and drop to 1 Hit Point instead. Once per Long Rest.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'lycan',
    name: 'Order of the Lycan',
    description: 'A blood hunter who transforms into a hybrid beast, fast and feral. Your senses sharpen, your strikes grow stronger, you regenerate while bloodied, and at your peak the transformation is yours without limit.',
    class: 'blood_hunter',
    source: 'Blood Hunter (2024 Rules) — GM Binder fan conversion of Matt Mercer\'s Blood Hunter',
    sourceTier: 'fan-conversion',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'heightened_senses', name: 'Heightened Senses', level: 3, kind: 'E',
        mechanics: { advantageOn: 'Wisdom (Perception) checks that rely on hearing or smell' },
        prompt: 'Heightened Senses: you have Advantage on Wisdom (Perception) checks that rely on hearing or smell.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'hybrid_transformation', name: 'Hybrid Transformation', level: 3, kind: 'E',
        mechanics: {
          action: 'Bonus Action',
          duration: 'up to 1 hour',
          uses: 'once; must finish a Short or Long Rest before using it again',
          revert: 'Bonus Action; automatically on Unconscious or death',
          note: 'You can speak, use equipment, and wear armor while transformed. This feature replaces the standard rules for lycanthropy.',
          feralMight: 'Advantage on Strength checks and Strength saving throws; +1 bonus to melee damage rolls (+2 at 11th level, +3 at 18th level)',
          resilientHide: 'Resistance to Bludgeoning, Piercing, and Slashing damage from nonmagical attacks not made with silvered weapons; +1 bonus to AC while not wearing Heavy armor',
          predatoryStrikes: 'Apply Crimson Rite to Unarmed Strikes (treated as one weapon); Dexterity instead of Strength for attack and damage; 1d6 Bludgeoning or Slashing (1d8 at 11th level); when you take the Attack action to make an Unarmed Strike, make one additional Unarmed Strike as a Bonus Action',
          bloodlust: 'If you start your turn with fewer Hit Points than half your maximum, DC 8 Wisdom saving throw or move directly toward the nearest creature and take the Attack action against it (auto-fail while concentrating or under an effect that prevents concentrating, e.g. Rage; Extra Attack may be used; random target if equally near; control regained once the attack resolves)',
        },
        prompt: 'Hybrid Transformation: Bonus Action, transform into a hybrid form for up to 1 hour (once; regain on a Short or Long Rest). Revert as a Bonus Action, or automatically on Unconscious/death. While transformed: Feral Might (Advantage on Strength checks/saves, +1 melee damage, +2 at 11th, +3 at 18th); Resilient Hide (Resistance to nonmagical Bludgeoning/Piercing/Slashing except silvered, +1 AC without Heavy armor); Predatory Strikes (Crimson Rite on Unarmed Strikes, Dexterity instead of Strength, 1d6 Bludgeoning or Slashing, 1d8 at 11th, plus one Bonus Action Unarmed Strike after an Attack-action Unarmed Strike); Bloodlust (below half HP at turn start: DC 8 Wisdom save or attack the nearest creature).',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'stalkers_prowess', name: "Stalker's Prowess", level: 7, kind: 'E',
        mechanics: {
          speedBonus: 10,
          longJumpBonus: 10,
          highJumpBonus: 3,
          improvedPredatoryStrikes: '+1 bonus to attack rolls with Unarmed Strikes (+2 at 11th level, +3 at 18th level); with an active Crimson Rite on Unarmed Strikes in hybrid form, Unarmed Strikes are magical for overcoming Resistance/Immunity to nonmagical attacks and damage',
        },
        prompt: "Stalker's Prowess: your Speed increases by 10 feet, long jump distance by 10 feet, high jump by 3 feet. Improved Predatory Strikes: +1 to Unarmed Strike attack rolls (+2 at 11th, +3 at 18th); with an active Crimson Rite, your hybrid-form Unarmed Strikes count as magical.",
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'advanced_transformation', name: 'Advanced Transformation', level: 11, kind: 'E',
        mechanics: {
          uses: 'twice, regaining all expended uses when you finish a Short or Long Rest',
          lycanRegeneration: 'At the start of each of your turns when you have at least 1 Hit Point but fewer than half your maximum, gain Hit Points equal to 1 + Constitution modifier (minimum of 1); in hybrid form, gained before the Bloodlust saving throw',
        },
        prompt: 'Advanced Transformation: you can use Hybrid Transformation twice, regaining all uses on a Short or Long Rest. Lycan Regeneration: at the start of each turn below half HP (but at 1+ HP), regain 1 + Constitution modifier Hit Points (minimum 1) — in hybrid form, before the Bloodlust save.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'brand_of_the_voracious', name: 'Brand of the Voracious', level: 15, kind: 'E',
        mechanics: {
          advantageOnBloodlustSaveWhileHybrid: true,
          advantageOnAttacksVsBrandedWhileHybrid: true,
        },
        prompt: 'Brand of the Voracious: you have Advantage on the saving throw for your Bloodlust while in hybrid form, and Advantage on attack rolls against a creature branded by you while in hybrid form.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'hybrid_transformation_mastery', name: 'Hybrid Transformation Mastery', level: 18, kind: 'E',
        mechanics: {
          uses: 'unlimited',
          duration: 'until you revert, have the Unconscious condition, or die',
          bloodCurse: 'Blood Curse of the Howl',
          countsAgainstCursesKnown: false,
          bloodCurseOfTheHowl: 'Magic action: each creature within 30 feet that can hear you must succeed on a Wisdom saving throw or have the Frightened condition for 1 minute or until it takes any damage (while Frightened this way, it can do only one of move / take an action / take a Bonus Action on its turns; failing by 5+ also Stunned while Frightened). Success: immune for 24 hours. You may exempt any number of creatures you can see. Amplify: range 60 feet. Prerequisite: 18th level, Order of the Lycan.',
        },
        prompt: 'Hybrid Transformation Mastery: unlimited Hybrid Transformation uses; the form lasts until you revert, are Unconscious, or die. You gain the Blood Curse of the Howl (does not count against your Blood Curses known): Magic action — creatures within 30 feet that hear you must succeed on a Wisdom save or be Frightened for 1 minute or until damaged (one of move/action/Bonus Action per turn; fail by 5+ also Stunned); success grants 24-hour immunity; you may exempt creatures you see. Amplify: range 60 feet.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'mutant',
    name: 'Order of the Mutant',
    description: 'A blood hunter who drinks mutagens to reshape body and mind for the hunt ahead. Each formula trades a gift for a cost, you grow immune to poison, and at your peak you can swap one mutation for another in the heat of battle.',
    class: 'blood_hunter',
    source: 'Blood Hunter (2024 Rules) — GM Binder fan conversion of Matt Mercer\'s Blood Hunter',
    sourceTier: 'fan-conversion',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'mutagencraft', name: 'Mutagencraft', level: 3, kind: 'E',
        mechanics: {
          action: 'Bonus Action to consume a mutagen',
          duration: 'effects and side effects last until you finish a Short or Long Rest unless otherwise specified',
          flush: 'while one or more mutagens affect you, take a Magic action to focus and flush all mutagens, ending their effects and side effects',
          onlyAffectsCreator: true,
          potency: 'mutagens become inert if not used before you finish your next Short or Long Rest',
          replaceOnLearn: 'when you learn a new mutagen formula, you may replace one formula you already know',
          formulasKnownByLevel: { 3: 4, 7: 5, 11: 6, 15: 7, 18: 8 },
          mutagensCreatedByLevel: { 3: 1, 7: 2, 11: 2, 15: 3, 18: 3 },
          createdWhen: 'when you finish a Short or Long Rest',
        },
        prompt: 'Mutagencraft: as a Bonus Action, consume a mutagen; effects and side effects last until a Short or Long Rest (unless specified). A Magic action flushes all active mutagens. Mutagens affect only you and go inert if unused before your next Short or Long Rest. Formulas known 4/5/6/7/8 at 3rd/7th/11th/15th/18th; mutagens created 1/2/2/3/3 when you finish a Short or Long Rest. Learning a new formula lets you replace one you know.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'mutagen_formulas', name: 'Mutagen Formulas', level: 3, kind: 'E',
        mechanics: {
          count: 20,
          formulas: [
            { name: 'Aether', prerequisite: '11th level', effect: 'Fly Speed 20 feet for 1 hour', sideEffect: 'Disadvantage on Strength checks and Dexterity checks during this time' },
            { name: 'Alluring', effect: 'Advantage on Charisma checks', sideEffect: 'Disadvantage on Initiative rolls' },
            { name: 'Celerity', effect: 'Dexterity score +3, and maximum +3 (+4 at 11th level, +5 at 18th level)', sideEffect: 'Disadvantage on Wisdom saving throws' },
            { name: 'Conversant', effect: 'Advantage on Intelligence checks', sideEffect: 'Disadvantage on Wisdom checks' },
            { name: 'Cruelty', prerequisite: '11th level', effect: 'When you take the Attack action, make one additional weapon attack as a Bonus Action', sideEffect: 'Disadvantage on Intelligence, Wisdom, and Charisma saving throws' },
            { name: 'Deftness', effect: 'Advantage on Dexterity checks', sideEffect: 'Disadvantage on Wisdom checks' },
            { name: 'Embers', effect: 'Resistance to Fire damage', sideEffect: 'Vulnerability to Cold damage' },
            { name: 'Gelid', effect: 'Resistance to Cold damage', sideEffect: 'Vulnerability to Fire damage' },
            { name: 'Impermeable', effect: 'Resistance to Piercing damage', sideEffect: 'Vulnerability to Slashing damage' },
            { name: 'Mobility', effect: 'Immunity to the Grappled and Restrained conditions (at 11th level, also immune to the Paralyzed condition)', sideEffect: 'Disadvantage on Strength checks' },
            { name: 'Nighteye', effect: 'Darkvision 60 feet (if you already have Darkvision, range +60 feet)', sideEffect: 'Disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight when you, the target, or what you perceive is in direct sunlight' },
            { name: 'Percipient', effect: 'Advantage on Wisdom checks', sideEffect: 'Disadvantage on Charisma checks' },
            { name: 'Potency', effect: 'Strength score +3, and maximum +3 (+4 at 11th level, +5 at 18th level)', sideEffect: 'Disadvantage on Dexterity saving throws' },
            { name: 'Precision', prerequisite: '11th level', effect: 'Weapon attacks score a Critical Hit on a roll of 19 or 20', sideEffect: 'Disadvantage on Strength saving throws' },
            { name: 'Rapidity', effect: 'Speed +10 feet (+5 more at 15th level)', sideEffect: 'Disadvantage on Intelligence checks' },
            { name: 'Reconstruction', prerequisite: '7th level', effect: 'For 1 hour, at the start of each of your turns when you have at least 1 Hit Point but fewer than half your maximum, regain Hit Points equal to your Proficiency Bonus', sideEffect: 'Speed reduced by 10 feet during this time' },
            { name: 'Sagacity', effect: 'Intelligence score +3, and maximum +3 (+4 at 11th level, +5 at 18th level)', sideEffect: 'Disadvantage on Charisma saving throws' },
            { name: 'Shielded', effect: 'Resistance to Slashing damage', sideEffect: 'Vulnerability to Bludgeoning damage' },
            { name: 'Unbreakable', effect: 'Resistance to Bludgeoning damage', sideEffect: 'Vulnerability to Piercing damage' },
            { name: 'Vermillion', effect: 'An additional use of your Blood Maledict feature', sideEffect: 'Disadvantage on Death Saving Throws' },
          ],
        },
        prompt: 'Mutagen Formulas (20): Aether (11th: Fly 20 ft for 1 hour; Disadvantage on Strength/Dexterity checks), Alluring (Advantage on Charisma checks; Disadvantage on Initiative), Celerity (Dexterity +3, max +3; +4 at 11th, +5 at 18th; Disadvantage on Wisdom saves), Conversant (Advantage on Intelligence checks; Disadvantage on Wisdom checks), Cruelty (11th: one extra weapon attack as a Bonus Action on the Attack action; Disadvantage on Intelligence/Wisdom/Charisma saves), Deftness (Advantage on Dexterity checks; Disadvantage on Wisdom checks), Embers (Fire Resistance; Cold Vulnerability), Gelid (Cold Resistance; Fire Vulnerability), Impermeable (Piercing Resistance; Slashing Vulnerability), Mobility (Immune to Grappled/Restrained, Paralyzed at 11th; Disadvantage on Strength checks), Nighteye (Darkvision 60 ft, or +60 ft; Disadvantage on sight-based attacks/Perception in direct sunlight), Percipient (Advantage on Wisdom checks; Disadvantage on Charisma checks), Potency (Strength +3, max +3; +4 at 11th, +5 at 18th; Disadvantage on Dexterity saves), Precision (11th: weapon crits on 19–20; Disadvantage on Strength saves), Rapidity (Speed +10 ft, +5 more at 15th; Disadvantage on Intelligence checks), Reconstruction (7th: for 1 hour, regain Proficiency Bonus HP at turn start below half HP; Speed −10 ft), Sagacity (Intelligence +3, max +3; +4 at 11th, +5 at 18th; Disadvantage on Charisma saves), Shielded (Slashing Resistance; Bludgeoning Vulnerability), Unbreakable (Bludgeoning Resistance; Piercing Vulnerability), Vermillion (+1 Blood Maledict use; Disadvantage on Death Saves).',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'strange_metabolism', name: 'Strange Metabolism', level: 7, kind: 'E',
        mechanics: {
          immunities: ['Poison damage', 'Poisoned condition'],
          adrenalineBurst: 'Bonus Action: ignore the negative side effect of one mutagen affecting you for 1 minute',
          adrenalineUses: '1/long rest',
        },
        prompt: 'Strange Metabolism: Immunity to Poison damage and the Poisoned condition. As a Bonus Action, ignore the negative side effect of one mutagen affecting you for 1 minute (once per Long Rest).',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'brand_of_axiom', name: 'Brand of Axiom', level: 11, kind: 'E',
        mechanics: {
          endsOnBrand: ['Illusion effects', 'Invisibility effects'],
          blockedWhileBranded: ['Invisibility effects', 'Illusion effects'],
          alternateFormOnBrand: 'Wisdom saving throw against your Hemocraft save DC or revert to true form and have the Stunned condition until the end of your next turn',
          formChangeAttemptWhileBranded: 'Wisdom saving throw against your Hemocraft save DC or the attempt fails, and the Stunned condition until the end of your next turn',
        },
        prompt: 'Brand of Axiom: any Illusion or Invisibility on a creature ends when you brand it, and it cannot benefit from either while branded. A branded creature in an alternative form (Polymorph, Change Shape, Shapechanger, Wild Shape, or similar) must succeed on a Wisdom save against your Hemocraft save DC or revert to its true form and be Stunned until the end of your next turn; any attempt to alter its form while branded must succeed on the same save or fail, with the Stunned condition until the end of your next turn.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'blood_curse_of_corrosion', name: 'Blood Curse of Corrosion', level: 15, kind: 'E',
        mechanics: {
          bloodCurse: 'Blood Curse of Corrosion',
          prerequisite: '15th level, Order of the Mutant',
          countsAgainstCursesKnown: false,
          effect: 'Bonus Action: a creature within 30 feet has the Poisoned condition; it can make a Constitution saving throw at the end of each of its turns, ending the curse on a success.',
          amplify: 'The cursed creature takes 4d6 Necrotic damage when you inflict this curse, and again each time it fails a Constitution saving throw to end the curse.',
        },
        prompt: 'Blood Curse of Corrosion (gained at 15th; does not count against your Blood Curses known): Bonus Action — a creature within 30 feet has the Poisoned condition (Constitution save at the end of each of its turns ends it). Amplify: 4d6 Necrotic damage when inflicted, and again each time it fails the save to end the curse.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'exalted_mutation', name: 'Exalted Mutation', level: 18, kind: 'E',
        mechanics: {
          action: 'Bonus Action',
          effect: 'choose one mutagen currently affecting you; its effects and side effects end, and a mutagen you know the formula for immediately takes effect in its place',
          uses: 'Intelligence modifier (minimum of once); regain all expended uses when you finish a Long Rest',
        },
        prompt: 'Exalted Mutation: as a Bonus Action, end one mutagen affecting you and immediately gain a different mutagen you know in its place. Uses equal to your Intelligence modifier (minimum of once); regain all uses on a Long Rest.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'profane_soul',
    name: 'Order of the Profane Soul',
    description: 'A blood hunter who struck a bargain with an otherworldly patron — Archfey, Celestial, Fiend, or Great Old One — and casts warlock spells with Intelligence through a rite-bound weapon. Your patron shapes your rite and grants you always-prepared spells, your branded foes falter against your magic, and at your peak your patron feeds on the dying.',
    class: 'blood_hunter',
    source: 'Blood Hunter (2024 Rules) — GM Binder fan conversion of Matt Mercer\'s Blood Hunter',
    sourceTier: 'fan-conversion',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'otherworldly_patron', name: 'Otherworldly Patron', level: 3, kind: 'E',
        mechanics: {
          patrons: ['The Archfey', 'The Celestial', 'The Fiend', 'The Great Old One'],
          note: 'The PDF lists exactly these four patrons. The client classes.json list also carried The Undying and The Hexblade — those are NOT in this document and were removed (see build notes). The patron augments Rite Focus (3rd), Revealed Arcana (7th), and Unsealed Arcana (15th).',
        },
        prompt: 'Otherworldly Patron: you strike a bargain with an otherworldly being — The Archfey, The Celestial, The Fiend, or The Great Old One. Your patron augments your Rite Focus, Revealed Arcana, and Unsealed Arcana features.',
        engine: 'Stored choice (subclass_choices_json) via subclassService.validateChoice; effects are DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'pact_magic', name: 'Pact Magic', level: 3, kind: 'E',
        mechanics: {
          spellList: 'Warlock',
          spellcastingAbility: 'int',
          spellSaveDc: '8 + Proficiency Bonus + Intelligence modifier',
          spellAttackModifier: 'Proficiency Bonus + Intelligence modifier',
          focus: 'a weapon for which you have an active Crimson Rite',
          cantripsKnownByLevel: { 3: 2, 10: 3 },
          preparedSpellsByLevel: { 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6, 12: 6, 13: 7, 14: 7, 15: 8, 16: 8, 17: 9, 18: 9, 19: 10, 20: 11 },
          spellSlotsByLevel: { 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 2, 18: 2, 19: 2, 20: 2 },
          slotLevelByLevel: { 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2, 13: 3, 14: 3, 15: 3, 16: 3, 17: 3, 18: 3, 19: 4, 20: 4 },
          slotsRegainedOn: 'Short or Long Rest',
          changePreparedOn: 'whenever you finish a Long Rest, replace one spell on your list with another Warlock spell for which you have spell slots',
          note: 'Prepared spells must be of a level no higher than the Slot Level column for your level. Tables live in levelProgression.js (PROFANE_SOUL_*); this feature is the prompt mirror.',
        },
        prompt: 'Pact Magic: you cast Warlock spells with Intelligence (save DC 8 + Proficiency Bonus + Intelligence modifier; attack Proficiency Bonus + Intelligence modifier). A weapon with an active Crimson Rite is your Spellcasting Focus. Cantrips known 2 at 3rd, 3 at 10th; prepared spells 2 at 3rd rising to 11 at 20th; spell slots 1 at 3rd–5th, 2 at 6th+ (slot level 1st at 3rd–6th, 2nd at 7th–12th, 3rd at 13th–18th, 4th at 19th–20th); all Pact Magic slots return on a Short or Long Rest. Change one prepared spell on a Long Rest.',
        engine: 'levelProgression getSpellSlots / getCantripsKnown / getSpellsPrepared (Profane Soul arms); spellSelectionService canLearnSpell (Warlock list, slot-level cap).',
        gateCheck: true,
      },
      {
        key: 'rite_focus', name: 'Rite Focus', level: 3, kind: 'E',
        mechanics: {
          trigger: 'while you have an active Crimson Rite',
          byPatron: {
            'The Archfey': 'When you damage a creature with a weapon for which you have an active Crimson Rite, that creature glows with faint light until the end of your next turn; for the duration, it gains no benefit from any cover or from being Invisible.',
            'The Celestial': 'As a Bonus Action, expend one use of your Blood Maledict feature to heal one creature you can see within 60 feet; it regains Hit Points equal to one roll of your Hemocraft die + your Intelligence modifier (minimum of +1).',
            'The Fiend': 'While using the Rite of the Flame, if you roll a 1 or 2 on a damage die when you roll the extra damage from the rite, you can reroll the die and choose which roll to use.',
            'The Great Old One': 'When you score a Critical Hit against a creature, that creature and any other creatures of your choice within 10 feet of it have the Frightened condition until the end of your next turn (you choose the source of the fear).',
          },
          note: 'The client classes.json Rite Focus benefits (Archfey charm resistance, Fiend bonus fire damage, Great Old One psychic messaging, Celestial bonus healing, plus Undying/Hexblade lines) were invented and are NOT in the PDF — replaced here with the printed benefits.',
        },
        prompt: 'Rite Focus (while you have an active Crimson Rite): The Archfey — a creature you damage with the rite weapon glows with faint light until the end of your next turn and gains no benefit from cover or being Invisible. The Celestial — Bonus Action, expend a Blood Maledict use to heal a creature within 60 feet for one Hemocraft die + Intelligence modifier (minimum +1). The Fiend — while using the Rite of the Flame, reroll 1s and 2s on the rite damage dice (choose which roll to use). The Great Old One — on a Critical Hit, the target and creatures of your choice within 10 feet of it are Frightened until the end of your next turn.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'mystic_frenzy', name: 'Mystic Frenzy', level: 7, kind: 'E',
        mechanics: {
          trigger: 'when you take the Magic action to cast a cantrip',
          effect: 'immediately make one weapon attack as a Bonus Action',
        },
        prompt: 'Mystic Frenzy: when you take the Magic action to cast a cantrip, you can immediately make one weapon attack as a Bonus Action.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'revealed_arcana', name: 'Revealed Arcana', level: 7, kind: 'D',
        mechanics: {
          access: 'always prepared',
          alwaysPreparedByPatron: {
            'The Archfey': ['Blur'],
            'The Celestial': ['Lesser Restoration'],
            'The Fiend': ['Scorching Ray'],
            'The Great Old One': ['Detect Thoughts'],
          },
          freeCast: 'cast the spell once without expending a spell slot; regain the ability when you finish a Long Rest; may also be cast using Pact Magic spell slots',
          note: 'The client classes.json list also carried Undying Silence and Hexblade Branding Smite — neither is in the PDF.',
        },
        prompt: 'Revealed Arcana: your patron grants you a spell you always have prepared (does not count against prepared spells) — The Archfey: Blur; The Celestial: Lesser Restoration; The Fiend: Scorching Ray; The Great Old One: Detect Thoughts. You can cast it once without a spell slot (regained on a Long Rest), or with a Pact Magic slot.',
        engine: 'DM-prompt only in v1; always-prepared subtraction follows the blackguard vice-spell pattern when a Profane Soul prepared validator is built (not built yet — flagged follow-up).',
        gateCheck: true,
      },
      {
        key: 'brand_of_the_sapping_scar', name: 'Brand of the Sapping Scar', level: 11, kind: 'E',
        mechanics: {
          effect: 'A creature branded by you has Disadvantage on saving throws against your Warlock spells',
        },
        prompt: 'Brand of the Sapping Scar: a creature branded by you has Disadvantage on saving throws against your Warlock spells.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'unsealed_arcana', name: 'Unsealed Arcana', level: 15, kind: 'D',
        mechanics: {
          access: 'always prepared',
          alwaysPreparedByPatron: {
            'The Archfey': ['Slow'],
            'The Celestial': ['Revivify'],
            'The Fiend': ['Fireball'],
            'The Great Old One': ['Haste'],
          },
          freeCast: 'cast the spell once without expending a spell slot; regain the ability when you finish a Long Rest',
          note: 'The client classes.json list gave the Great Old One Hunger of Hadar plus Undying Bestow Curse and Hexblade Blink — the PDF says Haste for the Great Old One and has no Undying/Hexblade patrons.',
        },
        prompt: 'Unsealed Arcana: your patron grants you an additional always-prepared spell (does not count against prepared spells) — The Archfey: Slow; The Celestial: Revivify; The Fiend: Fireball; The Great Old One: Haste. You can cast it once without a spell slot (regained on a Long Rest).',
        engine: 'DM-prompt only in v1; see Revealed Arcana for the validator note.',
        gateCheck: true,
      },
      {
        key: 'blood_curse_of_the_soul_eater', name: 'Blood Curse of the Soul Eater', level: 18, kind: 'E',
        mechanics: {
          bloodCurse: 'Blood Curse of the Soul Eater',
          prerequisite: '18th level, Order of the Profane Soul',
          countsAgainstCursesKnown: false,
          effect: 'Reaction: when a creature that is not a Construct or Undead is reduced to 0 Hit Points within 30 feet of you, offer its life energy to your patron — until the end of your next turn, you make attack rolls with Advantage and have Resistance to all damage.',
          amplify: 'Additionally, you regain an expended Pact Magic spell slot. Once you have amplified this Blood Curse, you must finish a Long Rest before you can amplify it again.',
        },
        prompt: 'Blood Curse of the Soul Eater (gained at 18th; does not count against your Blood Curses known): Reaction — a non-Construct, non-Undead creature reduced to 0 Hit Points within 30 feet of you feeds your patron; until the end of your next turn your attack rolls have Advantage and you have Resistance to all damage. Amplify: regain an expended Pact Magic slot (once amplified, you must finish a Long Rest before amplifying again).',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'patron', level: 3, options: ['The Archfey', 'The Celestial', 'The Fiend', 'The Great Old One'] },
    ],
  },
];
