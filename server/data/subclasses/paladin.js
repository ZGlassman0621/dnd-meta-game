/**
 * Paladin subclasses — Batch 3 (PHB 2024 choice-heavy classes).
 *
 * PHB-VERIFIED 2026-11-06 (source: Zach's 2024 PHB photos, pp. 109–117):
 * the four PHB oaths below (Devotion, Glory, Ancients, Vengeance) were
 * reconciled level-by-level against the photos — oath spells, Channel
 * Divinity options, aura wording, and capstones. The book wins on any
 * conflict. The old gate-check warning below applied to the pre-photo
 * draft; the PHB-oath entries are now photo-verified, and their
 * gateCheck flags remain as record of that history, not as open items
 * on the corrected values.
 *
 * Channel Divinity options are ONE per oath in 2024, except Glory,
 * which has TWO (Peerless Athlete, Inspiring Smite). The 2014 second
 * options (Turn the Unholy, Turn the Faithless, Abjure Enemy) do not
 * exist in the 2024 PHB and were removed entirely in the 2026-11-06
 * reconciliation — they live inside no feature and appear in no prompt.
 *
 * Cadence: Paladin subclasses grant at 3rd, 7th, 15th, and 20th
 * in 2024 (not 3/6/10/14 — do NOT carry the old cadence over).
 * Each oath has five features in this batch: Oath Spells (kind D),
 * Channel Divinity (kind C, one option — Glory: two), an aura or equivalent
 * at 7th, a feature at 15th, and a capstone at 20th. Oath spells
 * are ALWAYS PREPARED at paladin levels 3/5/9/13/17.
 * Glory is counted once, as PHB 2024, not double-counted from
 * the Theros scanned source.
 *
 * Channel Divinity uses are the base-class pool in principle:
 * subclass Channel Divinity options spend that pool, they do
 * not create a parallel pool. classFeatureService integration
 * is a named follow-up, as in prior batches.
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

export const PALADIN_SUBCLASSES = [
  {
    key: 'oath_of_devotion',
    name: 'Oath of Devotion',
    description: 'A paladin of sacred honor whose weapon shines with holy light and whose aura no charm can pierce. You imbue your blade, shield your allies from fear, and at your peak your aura burns fiends and undead with radiant fire.',
    class: 'paladin',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    features: [
      {
        key: 'oath_of_devotion_spells',
        name: 'Oath of Devotion Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'always prepared',
          alwaysPreparedByLevel: {
            3: ['Protection from Evil and Good', 'Shield of Faith'],
            5: ['Aid', 'Zone of Truth'],
            9: ['Beacon of Hope', 'Dispel Magic'],
            13: ['Freedom of Movement', 'Guardian of Faith'],
            17: ['Commune', 'Flame Strike'],
          },
        },
        prompt:
          'Oath of Devotion Spells: you always have the listed oath spells prepared — Protection from Evil and Good and Shield of Faith at 3rd, Aid and Zone of Truth at 5th, Beacon of Hope and Dispel Magic at 9th, Freedom of Movement and Guardian of Faith at 13th, Commune and Flame Strike at 17th.',
        engine: 'subclassService.paladinOathSpellsAtLevel (pure lookup); catalog-checked in Batch 3.',
        gateCheck: true,
      },
      {
        key: 'channel_divinity_devotion',
        name: 'Channel Divinity (Devotion)',
        level: 3,
        kind: 'C',
        mechanics: {
          pool: 'Channel Divinity (base-class pool — no parallel pool)',
          options: [
            { name: 'Sacred Weapon', effect: 'when you take the Attack action, imbue one weapon you are carrying with positive energy for 10 minutes; you add your Charisma modifier to attack rolls made with that weapon (minimum bonus of +1), and when you hit with it you can choose for the damage to be its normal type or Radiant; the weapon sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet; the effect ends early if you use this feature again, end it (no action required), or are no longer carrying the weapon' },
          ],
        },
        prompt:
          'Channel Divinity (Devotion, spends the base Channel Divinity pool): Sacred Weapon — when you take the Attack action, imbue one weapon you are carrying with positive energy for 10 minutes; you add your Charisma modifier (minimum +1) to its attack rolls, and when you hit with it you can choose for the damage to be its normal type or Radiant; the weapon sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. The effect ends early if you use this feature again, end it (no action required), or are no longer carrying the weapon.',
        engine: 'DM-adjudicated in Batch 3; Channel Divinity pool integration is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'aura_of_devotion',
        name: 'Aura of Devotion',
        level: 7,
        kind: 'E',
        mechanics: {
          effect: 'you and your allies have Immunity to the Charmed condition while in your Aura of Protection; a Charmed ally entering your Aura of Protection has the condition suppressed while there',
        },
        prompt:
          'Aura of Devotion: you and your allies have Immunity to the Charmed condition while in your Aura of Protection. A Charmed ally entering your Aura of Protection has the condition suppressed while there.',
        engine: 'DM-adjudicated in Batch 3; the condition hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'smite_of_protection',
        name: 'Smite of Protection',
        level: 15,
        kind: 'C',
        mechanics: {
          effect: 'whenever you cast Divine Smite, you and your allies have Half Cover while in your Aura of Protection; the aura has this benefit until the start of your next turn',
        },
        prompt:
          'Smite of Protection: whenever you cast Divine Smite, you and your allies have Half Cover while in your Aura of Protection. The aura has this benefit until the start of your next turn.',
        engine: 'DM-adjudicated in Batch 3; the Half Cover benefit is triggered by casting Divine Smite and lasts until the start of your next turn.',
        gateCheck: true,
      },
      {
        key: 'holy_nimbus',
        name: 'Holy Nimbus',
        level: 20,
        kind: 'C',
        mechanics: {
          action: 'bonus action',
          duration: '10 minutes or until you end it (no action required)',
          effect: 'you imbue your Aura of Protection with holy power: Holy Ward — you have Advantage on saving throws you are forced to make by a Fiend or an Undead; Radiant Damage — whenever an enemy starts its turn in the aura, it takes Radiant damage equal to your Charisma modifier + your Proficiency Bonus; Sunlight — the aura is filled with Bright Light that is sunlight',
          limit: 'once per Long Rest, or restore the use by expending a level 5 spell slot (no action required)',
        },
        prompt:
          'Holy Nimbus (bonus action): you imbue your Aura of Protection for 10 minutes or until you end it (no action required). Holy Ward — you have Advantage on saving throws you are forced to make by a Fiend or an Undead. Radiant Damage — whenever an enemy starts its turn in the aura, it takes Radiant damage equal to your Charisma modifier + your Proficiency Bonus. Sunlight — the aura is filled with Bright Light that is sunlight. Once per Long Rest, or restore the use by expending a level 5 spell slot (no action required).',
        engine: 'DM-adjudicated in Batch 3; aura imbue with Holy Ward, Radiant Damage, and Sunlight benefits.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'oath_of_glory',
    name: 'Oath of Glory',
    description: 'A paladin of heroism and legend who runs faster, leaps further, and never misses when it matters. Your athletic feats inspire, your defense turns blows aside, and at your peak you cannot miss, cannot fail a save, and cannot be stopped.',
    class: 'paladin',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    features: [
      {
        key: 'oath_of_glory_spells',
        name: 'Oath of Glory Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'always prepared',
          alwaysPreparedByLevel: {
            3: ['Guiding Bolt', 'Heroism'],
            5: ['Enhance Ability', 'Magic Weapon'],
            9: ['Haste', 'Protection from Energy'],
            13: ['Compulsion', 'Freedom of Movement'],
            17: ['Legend Lore', "Yolande's Regal Presence"],
          },
        },
        prompt:
          'Oath of Glory Spells: you always have the listed oath spells prepared — Guiding Bolt and Heroism at 3rd, Enhance Ability and Magic Weapon at 5th, Haste and Protection from Energy at 9th, Compulsion and Freedom of Movement at 13th, Legend Lore and Yolande’s Regal Presence at 17th. Counted once, as PHB 2024, not double-counted from Theros.',
        engine: 'subclassService.paladinOathSpellsAtLevel (pure lookup); catalog-checked in Batch 3.',
        gateCheck: true,
      },
      {
        key: 'channel_divinity_glory',
        name: 'Channel Divinity (Glory)',
        level: 3,
        kind: 'C',
        mechanics: {
          pool: 'Channel Divinity (base-class pool — no parallel pool)',
          options: [
            { name: 'Peerless Athlete', effect: 'as a bonus action, augment your athleticism for 1 hour: you have Advantage on Strength (Athletics) and Dexterity (Acrobatics) checks, and your Long Jump and High Jump distances increase by 10 feet (the extra distance costs movement as normal)' },
            { name: 'Inspiring Smite', effect: 'immediately after you cast Divine Smite, distribute Temporary Hit Points equal to 2d8 + your Paladin level among creatures of your choice that you can see within 30 feet of you; the total can include you' },
          ],
        },
        prompt:
          'Channel Divinity (Glory, spends the base Channel Divinity pool): Peerless Athlete (bonus action) — for 1 hour, you have Advantage on Strength (Athletics) and Dexterity (Acrobatics) checks, and your Long Jump and High Jump distances increase by 10 feet (the extra distance costs movement as normal). Inspiring Smite — immediately after you cast Divine Smite, you can distribute Temporary Hit Points equal to 2d8 + your Paladin level among creatures of your choice that you can see within 30 feet of you; the total can include you.',
        engine: 'DM-adjudicated in Batch 3; Channel Divinity pool integration is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'aura_of_alacrity',
        name: 'Aura of Alacrity',
        level: 7,
        kind: 'E',
        mechanics: {
          effect: 'your Speed increases by 10 feet; whenever an ally enters your Aura of Protection for the first time on a turn or starts their turn there, their Speed increases by 10 feet until the end of their next turn',
        },
        prompt:
          'Aura of Alacrity: your Speed increases by 10 feet. Whenever an ally enters your Aura of Protection for the first time on a turn or starts their turn there, their Speed increases by 10 feet until the end of their next turn.',
        engine: 'DM-adjudicated in Batch 3; the speed hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'glorious_defense',
        name: 'Glorious Defense',
        level: 15,
        kind: 'C',
        mechanics: {
          action: 'reaction',
          trigger: 'you or another creature you can see within 10 feet of you is hit by an attack roll',
          effect: 'grant a bonus to the target’s Armor Class against that attack equal to your Charisma modifier (minimum of +1), potentially causing the attack to miss; if the attack misses, you can make one weapon attack against the attacker as part of this reaction, provided the attacker is within your weapon’s range',
          limit: 'a number of times equal to your Charisma modifier (minimum of once); you regain all expended uses when you finish a Long Rest',
        },
        prompt:
          'Glorious Defense (reaction): when you or a creature you can see within 10 feet of you is hit by an attack roll, grant the target a bonus to Armor Class against that attack equal to your Charisma modifier (minimum +1), potentially causing it to miss. If it misses, you can make one weapon attack against the attacker as part of this reaction, if the attacker is within your weapon’s range. You can use this feature a number of times equal to your Charisma modifier (minimum of once), and you regain all expended uses when you finish a Long Rest.',
        engine: 'subclassService.gloriousDefenseBonus (pure math); reaction and counterattack are DM-adjudicated in Batch 3.',
        gateCheck: true,
      },
      {
        key: 'living_legend',
        name: 'Living Legend',
        level: 20,
        kind: 'C',
        mechanics: {
          action: 'bonus action',
          duration: '10 minutes',
          effect: 'you gain Advantage on all Charisma checks; Unerring Strike — once per turn, you can turn a missed attack roll into a hit; Saving Throw Reroll — when you fail a saving throw, you can take a Reaction to reroll it, and you must use the new roll',
          limit: 'once per Long Rest, or restore the use by expending a level 5 spell slot (no action required)',
        },
        prompt:
          'Living Legend (bonus action): for 10 minutes you gain Advantage on all Charisma checks. Unerring Strike — once per turn, you can turn a missed attack roll into a hit. Saving Throw Reroll — when you fail a saving throw, you can take a Reaction to reroll it, and you must use the new roll. Once per Long Rest, or restore the use by expending a level 5 spell slot (no action required).',
        engine: 'DM-adjudicated in Batch 3; Unerring Strike is once per turn and the Saving Throw Reroll is a Reaction.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'oath_of_the_ancients',
    name: 'Oath of the Ancients',
    description: 'A paladin of primeval nature whose light preserves life and whose aura wards against death itself. You bind foes with nature\'s wrath, resist necrotic, psychic, and radiant harm, and at your peak you become nature\'s avatar and cannot be felled.',
    class: 'paladin',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    features: [
      {
        key: 'oath_of_the_ancients_spells',
        name: 'Oath of the Ancients Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'always prepared',
          alwaysPreparedByLevel: {
            3: ['Ensnaring Strike', 'Speak with Animals'],
            5: ['Misty Step', 'Moonbeam'],
            9: ['Plant Growth', 'Protection from Energy'],
            13: ['Ice Storm', 'Stoneskin'],
            17: ['Commune with Nature', 'Tree Stride'],
          },
        },
        prompt:
          'Oath of the Ancients Spells: you always have the listed oath spells prepared — Ensnaring Strike and Speak with Animals at 3rd, Misty Step and Moonbeam at 5th, Plant Growth and Protection from Energy at 9th, Ice Storm and Stoneskin at 13th, Commune with Nature and Tree Stride at 17th.',
        engine: 'subclassService.paladinOathSpellsAtLevel (pure lookup); catalog-checked in Batch 3.',
        gateCheck: true,
      },
      {
        key: 'channel_divinity_ancients',
        name: 'Channel Divinity (Ancients)',
        level: 3,
        kind: 'C',
        mechanics: {
          pool: 'Channel Divinity (base-class pool — no parallel pool)',
          options: [
            { name: 'Nature’s Wrath', effect: 'as a Magic action, spectral vines lash out at each creature of your choice that you can see within 15 feet of you; each target makes a Strength saving throw or has the Restrained condition for 1 minute; a Restrained creature repeats the saving throw at the end of each of its turns, ending the effect on itself on a success' },
          ],
        },
        prompt:
          'Channel Divinity (Ancients, spends the base Channel Divinity pool): Nature’s Wrath (Magic action) — each creature of your choice that you can see within 15 feet of you makes a Strength saving throw or has the Restrained condition for 1 minute. A Restrained creature repeats the saving throw at the end of each of its turns, ending the effect on itself on a success.',
        engine: 'DM-adjudicated in Batch 3; Channel Divinity pool integration is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'aura_of_warding',
        name: 'Aura of Warding',
        level: 7,
        kind: 'E',
        mechanics: {
          effect: 'you and your allies have Resistance to Necrotic, Psychic, and Radiant damage while in your Aura of Protection',
        },
        prompt:
          'Aura of Warding: you and your allies have Resistance to Necrotic, Psychic, and Radiant damage while in your Aura of Protection.',
        engine: 'DM-adjudicated in Batch 3; the damage hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'undying_sentinel',
        name: 'Undying Sentinel',
        level: 15,
        kind: 'E',
        mechanics: {
          effect: 'once per Long Rest, when you are reduced to 0 Hit Points and not killed outright, you instead drop to 1 Hit Point and regain Hit Points equal to 3 × your Paladin level; you cease visibly aging and can’t be aged magically',
        },
        prompt:
          'Undying Sentinel: once per Long Rest, when you are reduced to 0 Hit Points and not killed outright, you instead drop to 1 Hit Point and regain Hit Points equal to 3 × your Paladin level. You cease visibly aging and can’t be aged magically.',
        engine: 'DM-adjudicated in Batch 3; the death-drop hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'elder_champion',
        name: 'Elder Champion',
        level: 20,
        kind: 'C',
        mechanics: {
          action: 'bonus action',
          duration: '1 minute or until you end them (no action required)',
          effect: 'you assume the form of an avatar of primeval nature: Diminish Defiance — enemies in your Aura of Protection have disadvantage on saving throws against your spells and Channel Divinity; Regeneration — you regain 10 Hit Points at the start of each of your turns; Swift Spells — when you cast a spell that has a casting time of 1 action, you can cast it as a Bonus Action instead',
          limit: 'once per Long Rest, or restore the use by expending a level 5 spell slot (no action required)',
        },
        prompt:
          'Elder Champion (bonus action): for 1 minute or until you end them (no action required), you assume the form of an avatar of primeval nature. Diminish Defiance — enemies in your Aura of Protection have disadvantage on saving throws against your spells and Channel Divinity. Regeneration — you regain 10 Hit Points at the start of each of your turns. Swift Spells — when you cast a spell that has a casting time of 1 action, you can cast it as a Bonus Action instead. Once per Long Rest, or restore the use by expending a level 5 spell slot (no action required).',
        engine: 'DM-adjudicated in Batch 3; Diminish Defiance, Regeneration, and Swift Spells are DM-tracked benefits.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'oath_of_vengeance',
    name: 'Oath of Vengeance',
    description: 'A paladin sworn to hunt the wicked to the ends of the earth. Your vow grants advantage on every strike against your quarry, your vengeance answers every blow, and at your peak you fly on spectral wings and terrify all who face you.',
    class: 'paladin',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    features: [
      {
        key: 'oath_of_vengeance_spells',
        name: 'Oath of Vengeance Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'always prepared',
          alwaysPreparedByLevel: {
            3: ['Bane', "Hunter's Mark"],
            5: ['Hold Person', 'Misty Step'],
            9: ['Haste', 'Protection from Energy'],
            13: ['Banishment', 'Dimension Door'],
            17: ['Hold Monster', 'Scrying'],
          },
        },
        prompt:
          'Oath of Vengeance Spells: you always have the listed oath spells prepared — Bane and Hunter’s Mark at 3rd, Hold Person and Misty Step at 5th, Haste and Protection from Energy at 9th, Banishment and Dimension Door at 13th, Hold Monster and Scrying at 17th.',
        engine: 'subclassService.paladinOathSpellsAtLevel (pure lookup); catalog-checked in Batch 3.',
        gateCheck: true,
      },
      {
        key: 'channel_divinity_vengeance',
        name: 'Channel Divinity (Vengeance)',
        level: 3,
        kind: 'C',
        mechanics: {
          pool: 'Channel Divinity (base-class pool — no parallel pool)',
          options: [
            { name: 'Vow of Enmity', effect: 'when you take the Attack action, swear an oath of enmity against a creature you can see within 30 feet of you; you gain Advantage on attack rolls against that creature for 1 minute or until you use this feature again; if the creature drops to 0 Hit Points before the vow ends, you can transfer the vow to a different creature you can see within 30 feet of you (no action required)' },
          ],
        },
        prompt:
          'Channel Divinity (Vengeance, spends the base Channel Divinity pool): Vow of Enmity — when you take the Attack action, swear an oath of enmity against a creature you can see within 30 feet of you; you gain Advantage on attack rolls against that creature for 1 minute or until you use this feature again. If the creature drops to 0 Hit Points before the vow ends, you can transfer the vow to a different creature you can see within 30 feet of you (no action required).',
        engine: 'DM-adjudicated in Batch 3; Channel Divinity pool integration is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'relentless_avenger',
        name: 'Relentless Avenger',
        level: 7,
        kind: 'E',
        mechanics: {
          trigger: 'when you hit a creature with an Opportunity Attack',
          effect: 'you can reduce the creature’s Speed to 0 until the end of the current turn; you can then move up to half your Speed as part of the same Reaction, and this movement doesn’t provoke Opportunity Attacks',
        },
        prompt:
          'Relentless Avenger: when you hit a creature with an Opportunity Attack, you can reduce the creature’s Speed to 0 until the end of the current turn. You can then move up to half your Speed as part of the same Reaction, and this movement doesn’t provoke Opportunity Attacks.',
        engine: 'DM-adjudicated in Batch 3; the OA hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'soul_of_vengeance',
        name: 'Soul of Vengeance',
        level: 15,
        kind: 'C',
        mechanics: {
          action: 'reaction',
          trigger: 'immediately after a creature under the effect of your Vow of Enmity hits or misses with an attack roll',
          effect: 'you can make one melee attack against that creature if it’s within range',
        },
        prompt:
          'Soul of Vengeance (reaction): immediately after a creature under the effect of your Vow of Enmity hits or misses with an attack roll, you can make a melee attack against that creature if it’s within range.',
        engine: 'DM-adjudicated in Batch 3; the reaction-attack hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'avenging_angel',
        name: 'Avenging Angel',
        level: 20,
        kind: 'C',
        mechanics: {
          action: 'bonus action',
          duration: '10 minutes or until you end it (no action required)',
          effect: 'you assume the form of an angelic avenger: Flight — spectral wings grant you a Fly Speed of 60 feet, and you can hover; Frightful Aura — whenever an enemy starts its turn in your Aura of Protection, it must succeed on a Wisdom saving throw or have the Frightened condition for 1 minute or until it takes any damage; attack rolls against the Frightened creature have Advantage',
          limit: 'once per Long Rest, or restore the use by expending a level 5 spell slot (no action required)',
        },
        prompt:
          'Avenging Angel (bonus action): for 10 minutes or until you end it (no action required), you assume the form of an angelic avenger. Flight — spectral wings grant you a Fly Speed of 60 feet, and you can hover. Frightful Aura — whenever an enemy starts its turn in your Aura of Protection, it must succeed on a Wisdom saving throw or have the Frightened condition for 1 minute or until it takes any damage; attack rolls against the Frightened creature have Advantage. Once per Long Rest, or restore the use by expending a level 5 spell slot (no action required).',
        engine: 'DM-adjudicated in Batch 3; Flight and Frightful Aura are DM-tracked benefits.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'oath_of_conquest',
    name: 'Oath of Conquest',
    description: 'A paladin who conquers through fear — your presence alone breaks armies. Your aura roots the frightened in place, your rebukes wound the mind, and at your peak you resist all damage, strike once more, and your blade crits more often.',
    class: 'paladin',
    source: "Xanathar's Guide to Everything (2014) — 2024 conversion",
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: '2014 grant points 3/7/15/18/20 map onto the built 2024 Paladin cadence 3/7/15/20: the 18th-level step is not a separate feature in 2024 form, it is the Aura of Conquest range increase (10 to 30 feet) folded into the 7th-level aura mechanics, matching how PHB Paladin auras are modeled. Oath spells are carried as always prepared at 3/5/9/13/17, matching the PHB Paladin oath-spell pattern. No 2024 reprint of this subclass exists: this entry is the app conversion of the 2014 Xanathar extract, and every number is gateCheck for Zach.',
    features: [
      {
        key: 'oath_of_conquest_spells',
        name: 'Oath of Conquest Spells',
        level: 3,
        kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['Armor of Agathys', 'Command'], 5: ['Hold Person', 'Spiritual Weapon'], 9: ['Bestow Curse', 'Fear'], 13: ['Dominate Beast', 'Stoneskin'], 17: ['Cloudkill', 'Dominate Person'] } },
        prompt: 'Oath of Conquest Spells (ALWAYS PREPARED): at 3rd Armor of Agathys, Command; at 5th Hold Person, Spiritual Weapon; at 9th Bestow Curse, Fear; at 13th Dominate Beast, Stoneskin; at 17th Cloudkill, Dominate Person. All ten are in the app spell catalog.',
        engine: 'subclassService.paladinOathSpellsAtLevel (cumulative list); the prepared-spells route surfacing is a named follow-up, not wired in S2.',
        gateCheck: true,
      },
      {
        key: 'channel_divinity_conquest',
        name: 'Channel Divinity (Conquest)',
        level: 3,
        kind: 'C',
        mechanics: { options: ['Conquering Presence: as an action, force each creature of your choice that you can see within 30 feet to make a Wisdom saving throw; on a failed save it is Frightened of you for 1 minute, repeating the save at the end of each of its turns', 'Guided Strike: when you make an attack roll, use Channel Divinity to gain a +10 bonus to the roll; decide after seeing the roll, before the DM says whether it hits'], pool: 'Channel Divinity (base Paladin resource)' },
        prompt: 'Channel Divinity (Conquest): Conquering Presence — as an action, force each creature of your choice that you can see within 30 feet to make a Wisdom saving throw, or be Frightened of you for 1 minute (repeating the save at the end of each of its turns). Guided Strike — when you make an attack roll, gain a +10 bonus to the roll, decided after seeing the roll but before the DM says whether it hits.',
        engine: 'DM-prompt in S2; Channel Divinity spend is via the existing class resource path (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'aura_of_conquest',
        name: 'Aura of Conquest',
        level: 7,
        kind: 'E',
        mechanics: { range: '10 feet, increasing to 30 feet at 18th level', condition: 'while you are not incapacitated; does not extend through total cover', effect: 'a creature Frightened of you has its speed reduced to 0 while in the aura, and takes psychic damage equal to half your Paladin level if it starts its turn there' },
        prompt: 'Aura of Conquest: while you are not incapacitated, you emanate a menacing aura extending 10 feet (30 feet at 18th level, not through total cover). A creature Frightened of you has its speed reduced to 0 while in the aura, and takes psychic damage equal to half your Paladin level if it starts its turn there.',
        engine: 'DM-prompt in S2; aura sweep is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'scornful_rebuke',
        name: 'Scornful Rebuke',
        level: 15,
        kind: 'E',
        mechanics: { trigger: 'whenever a creature hits you with an attack', condition: 'you are not incapacitated', effect: 'that creature takes psychic damage equal to your Charisma modifier (minimum 1)' },
        prompt: 'Scornful Rebuke: whenever a creature hits you with an attack and you are not incapacitated, that creature takes psychic damage equal to your Charisma modifier (minimum 1).',
        engine: 'DM-prompt in S2; damage-reflection hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'invincible_conqueror',
        name: 'Invincible Conqueror',
        level: 20,
        kind: 'C',
        mechanics: { action: 'action', duration: '1 minute', benefits: ['resistance to all damage', 'one additional attack when you take the Attack action on your turn', 'melee weapon attacks score a critical hit on a roll of 19 or 20'], regain: 'once per Long Rest' },
        prompt: 'Invincible Conqueror: as an action, become an avatar of conquest for 1 minute — resistance to all damage, one additional attack when you take the Attack action on your turn, and melee weapon attacks score a critical hit on a roll of 19 or 20. Once per Long Rest.',
        engine: 'DM-prompt in S2; capstone tracking is DM-adjudicated (named follow-up).',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'oath_of_redemption',
    name: 'Oath of Redemption',
    description: 'A paladin who redeems the violent and shields the innocent with their own body. Your words calm and your rebukes punish, you take wounds meant for others, and at your peak you resist all harm and return it as radiant fire.',
    class: 'paladin',
    source: "Xanathar's Guide to Everything (2014) — 2024 conversion",
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: '2014 grant points 3/7/15/18/20 map onto the built 2024 Paladin cadence 3/7/15/20: the 18th-level step is not a separate feature in 2024 form, it is the Aura of the Guardian range increase (10 to 30 feet) folded into the 7th-level aura mechanics, matching how PHB Paladin auras are modeled. Oath spells are carried as always prepared at 3/5/9/13/17, matching the PHB Paladin oath-spell pattern. No 2024 reprint of this subclass exists: this entry is the app conversion of the 2014 Xanathar extract, and every number is gateCheck for Zach.',
    features: [
      {
        key: 'oath_of_redemption_spells',
        name: 'Oath of Redemption Spells',
        level: 3,
        kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['Sanctuary', 'Sleep'], 5: ['Calm Emotions', 'Hold Person'], 9: ['Counterspell', 'Hypnotic Pattern'], 13: ["Otiluke's Resilient Sphere", 'Stoneskin'], 17: ['Hold Monster', 'Wall of Force'] } },
        prompt: 'Oath of Redemption Spells (ALWAYS PREPARED): at 3rd Sanctuary, Sleep; at 5th Calm Emotions, Hold Person; at 9th Counterspell, Hypnotic Pattern; at 13th Otiluke\'s Resilient Sphere, Stoneskin; at 17th Hold Monster, Wall of Force. All ten are in the app spell catalog.',
        engine: 'subclassService.paladinOathSpellsAtLevel (cumulative list); the prepared-spells route surfacing is a named follow-up, not wired in S2.',
        gateCheck: true,
      },
      {
        key: 'channel_divinity_redemption',
        name: 'Channel Divinity (Redemption)',
        level: 3,
        kind: 'C',
        mechanics: { options: ['Emissary of Peace: as a Bonus Action, grant yourself a +5 bonus to Charisma (Persuasion) checks for the next 10 minutes', 'Rebuke the Violent: immediately after an attacker within 30 feet of you deals damage with an attack against a creature other than you, use your Reaction to force the attacker to make a Wisdom saving throw; on a failed save it takes radiant damage equal to the damage it just dealt, on a success half as much'], pool: 'Channel Divinity (base Paladin resource)' },
        prompt: 'Channel Divinity (Redemption): Emissary of Peace — as a Bonus Action, grant yourself a +5 bonus to Charisma (Persuasion) checks for the next 10 minutes. Rebuke the Violent — immediately after an attacker within 30 feet of you deals damage with an attack against a creature other than you, use your Reaction to force a Wisdom saving throw; on a failed save the attacker takes radiant damage equal to the damage it just dealt, on a success half as much.',
        engine: 'DM-prompt in S2; Channel Divinity spend is via the existing class resource path (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'aura_of_the_guardian',
        name: 'Aura of the Guardian',
        level: 7,
        kind: 'E',
        mechanics: { range: '10 feet, increasing to 30 feet at 18th level', reaction: 'when a creature within range takes damage, magically take that damage instead of that creature', limits: 'does not transfer any other effects accompanying the damage; this damage cannot be reduced in any way' },
        prompt: 'Aura of the Guardian: when a creature within 10 feet of you (30 feet at 18th level) takes damage, you can use your Reaction to magically take that damage instead. This does not transfer any other effects accompanying the damage, and this damage cannot be reduced in any way.',
        engine: 'DM-prompt in S2; reaction charge and damage transfer are turn-ledger / damage-path adjudicated (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'protective_spirit',
        name: 'Protective Spirit',
        level: 15,
        kind: 'E',
        mechanics: { trigger: 'if you end your turn in combat with fewer than half of your Hit Points remaining and you are not incapacitated', effect: 'regain Hit Points equal to 1d6 + half your Paladin level' },
        prompt: 'Protective Spirit: if you end your turn in combat with fewer than half of your Hit Points remaining and you are not incapacitated, you regain Hit Points equal to 1d6 + half your Paladin level.',
        engine: 'DM-prompt in S2; turn-end heal hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'emissary_of_redemption',
        name: 'Emissary of Redemption',
        level: 20,
        kind: 'C',
        mechanics: { benefits: ['resistance to all damage dealt by other creatures (their attacks, spells, and other effects)', 'whenever a creature hits you with an attack, it takes radiant damage equal to half the damage you take from the attack'], limit: 'if you attack a creature, cast a spell on it, or deal damage to it by any means but this feature, neither benefit works against that creature until you finish a Long Rest' },
        prompt: 'Emissary of Redemption: you have resistance to all damage dealt by other creatures, and whenever a creature hits you with an attack, it takes radiant damage equal to half the damage you take from the attack. If you attack a creature, cast a spell on it, or deal damage to it by any means but this feature, neither benefit works against that creature until you finish a Long Rest.',
        engine: 'DM-prompt in S2; capstone tracking is DM-adjudicated (named follow-up).',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'oath_of_resolve',
    name: 'Oath of Resolve',
    description: 'A paladin of unshakable duty whose vow carries them through any terrain and any trial. Your aura ignores difficult ground, your duty transcends even unconsciousness, and at your peak you become an avatar of conviction who cannot be brought below one hit point.',
    class: 'paladin',
    source: 'Hoard of Heroes — 2024 conversion',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: 'Hoard grants ran 3/7/15/18/20. The 18th step is the range increase of the 7th-level Aura of Tenacity, kept on the aura feature as with the built PHB auras; oath-spell tiers map onto the built 2024 Paladin pattern 3/5/9/13/17. No 2024 reprint exists: every number is gateCheck for Zach.',
    sourceNote: 'Hoard of Heroes is third-party/homebrew (Zach: ABSOLUTELY NECESSARY, plan section 13). Mechanics paraphrased in the app\'s own wording from the Hoard extract; never verbatim book prose.',
    features: [
      {
        key: 'oath_of_resolve_spells',
        name: 'Oath of Resolve Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'always prepared',
          alwaysPreparedByLevel: {
            3: ['Heroism', 'Longstrider'],
            5: ['Enhance Ability', 'Spider Climb'],
            9: ['Gaseous Form', 'Thunder Step'],
            13: ['Freedom of Movement', 'Locate Creature'],
            17: ['Greater Restoration', 'Passwall'],
          },
        },
        prompt: 'Oath of Resolve Spells (ALWAYS PREPARED): at 3rd level Heroism, Longstrider; at 5th Enhance Ability, Spider Climb; at 9th Gaseous Form, Thunder Step; at 13th Freedom of Movement, Locate Creature; at 17th Greater Restoration, Passwall. All ten are in the app spell catalog.',
        engine: 'subclassService.paladinOathSpellsAtLevel (cumulative list); the prepared-spells route surfacing is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'channel_divinity_resolve',
        name: 'Channel Divinity (Resolve)',
        level: 3,
        kind: 'C',
        mechanics: {
          pool: 'Channel Divinity (base-class pool — no parallel pool)',
          options: [
            { name: 'Vow of Duty', effect: 'as an action, present your holy symbol and speak a vow of duty; choose a creature or object within 30 feet of you; for 1 hour, the target gains no benefit against you from being invisible or heavily obscured, you do not have disadvantage on attacks made against it as a result of being blinded, and you know the exact direction and distance to the target while it is on the same plane of existence as you' },
            { name: 'Inexorable Advance', effect: 'as a bonus action, use your Channel Divinity to ignore creatures that would deny your passage; for 1 minute, you can move through the spaces of hostile creatures regardless of their size, and creatures you move through on your turn have disadvantage on opportunity attacks made against you until the end of that turn' },
          ],
        },
        prompt: 'Channel Divinity (Resolve, spends the base Channel Divinity pool): Vow of Duty (action) — present your holy symbol and speak a vow of duty, choosing a creature or object within 30 feet of you; for 1 hour, the target gains no benefit against you from being invisible or heavily obscured, you do not have disadvantage on attacks against it as a result of being blinded, and you know the exact direction and distance to it while it is on the same plane as you. Inexorable Advance (bonus action) — for 1 minute, you can move through the spaces of hostile creatures regardless of their size, and creatures you move through on your turn have disadvantage on opportunity attacks made against you until the end of that turn.',
        engine: 'DM-adjudicated in S4; Channel Divinity pool integration is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'aura_of_tenacity',
        name: 'Aura of Tenacity',
        level: 7,
        kind: 'E',
        mechanics: { effect: 'you and friendly creatures within 10 feet of you are unaffected by difficult terrain', rangeStep: 'at 18th level, the range of this aura increases to 30 feet' },
        prompt: 'Aura of Tenacity: you and friendly creatures within 10 feet of you are unaffected by difficult terrain. At 18th level, the range of this aura increases to 30 feet.',
        engine: 'DM-prompt in S4; aura/movement hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'eternal_vigilance',
        name: 'Eternal Vigilance',
        level: 15,
        kind: 'A',
        mechanics: { effect: 'you no longer suffer any of the penalties of being unconscious' },
        prompt: 'Eternal Vigilance: your refusal to shirk your duty transcends even your time of rest — you no longer suffer any of the penalties of being unconscious.',
        engine: 'DM-prompt in S4; the exact unconscious-penalty set is DM-adjudicated (the extract does not enumerate it) — gate-check item for Zach.',
        gateCheck: true,
      },
      {
        key: 'beyond_determination',
        name: 'Beyond Determination',
        level: 20,
        kind: 'C',
        mechanics: { action: 'action', duration: '1 minute', effects: 'you cannot be reduced to lower than 1 hit point; you can take the Dash action as a bonus action; you are immune to being charmed or grappled', rest: 'long' },
        prompt: 'Beyond Determination (action): you assume the form of an avatar of conviction for 1 minute. For the duration you cannot be reduced to lower than 1 hit point, you can take the Dash action as a bonus action, and you are immune to being charmed or grappled. Once used, you cannot use it again until you finish a Long Rest.',
        engine: 'DM-prompt in S4; transformation state is DM-tracked (named follow-up).',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'oath_of_the_noble_genies',
    name: 'Oath of the Noble Genies',
    description: 'A paladin whose smites carry the elements of the genies — earth, air, fire, and water. Your unarmored grace sets your defense, your aura shields against a chosen element, and at your peak you become a noble scion of the genies themselves.',
    class: 'paladin',
    source: 'Heroes of Faerûn',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: 'Heroes of Faerûn grants run 3/7/15/20, which coincide exactly with the built 2024 Paladin cadence 3/7/15/20 — no feature was re-pointed. Mechanics paraphrased in the app\'s own wording from the Heroes of Faerûn text extract (Mac, 660,813 bytes); every number is gateCheck for Zach.',
    choices: [
      { key: 'splendor_skill', options: ['Acrobatics', 'Intimidation', 'Performance', 'Persuasion'], note: 'chosen at selection; stored in migration 103 subclass_choices_json' },
    ],
    features: [
      {
        key: 'elemental_smite',
        name: 'Elemental Smite',
        level: 3,
        kind: 'C',
        mechanics: { trigger: 'immediately after you cast Divine Smite', cost: 'expend one use of your Channel Divinity', options: 'Dao\'s Crush — earth rises up around the target of your Divine Smite; the target has the Grappled condition (escape DC equal to your spell save DC) and while Grappled has the Restrained condition. Djinni\'s Escape — you teleport to an unoccupied space you can see within 30 feet of yourself and take on a semi-incorporeal form until the end of your next turn; while in this form you have Resistance to Bludgeoning, Piercing, and Slashing damage and Immunity to the Grappled, Prone, and Restrained conditions. Efreeti\'s Fury — the target of your Divine Smite takes an extra 2d4 Fire damage, and fire jumps from the target to another creature you can see within 30 feet of yourself; the second creature also takes 2d4 Fire damage. Marid\'s Surge — the target of your Divine Smite and each creature of your choice in a 10-foot Emanation originating from you make a Strength saving throw against your spell save DC; on a failed save, a creature is pushed 15 feet straight away from you and has the Prone condition' },
        prompt: 'Elemental Smite: immediately after you cast Divine Smite, you can expend one use of your Channel Divinity and invoke one of the following effects. Dao\'s Crush: earth rises up around the target of your Divine Smite; the target has the Grappled condition (escape DC equal to your spell save DC) and while Grappled has the Restrained condition. Djinni\'s Escape: you teleport to an unoccupied space you can see within 30 feet of yourself and take on a semi-incorporeal form until the end of your next turn; while in this form you have Resistance to Bludgeoning, Piercing, and Slashing damage and Immunity to the Grappled, Prone, and Restrained conditions. Efreeti\'s Fury: the target of your Divine Smite takes an extra 2d4 Fire damage, and fire jumps from the target to another creature you can see within 30 feet of yourself; the second creature also takes 2d4 Fire damage. Marid\'s Surge: the target of your Divine Smite and each creature of your choice in a 10-foot Emanation originating from you make a Strength saving throw against your spell save DC; on a failed save, a creature is pushed 15 feet straight away from you and has the Prone condition.',
        engine: 'DM-prompt in S5; Channel Divinity spend uses the existing base-class pool; the invoked effect is chosen at use, not stored.',
        gateCheck: true,
      },
      {
        key: 'genie_spells',
        name: 'Genie Spells',
        level: 3,
        kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['Chromatic Orb', 'Elementalism', 'Thunderous Smite'], 5: ['Mirror Image', 'Phantasmal Force'], 9: ['Fly', 'Gaseous Form'], 13: ['Conjure Minor Elementals', 'Summon Elemental'], 17: ['Banishing Smite', 'Contact Other Plane'] } },
        prompt: 'Genie Spells (always prepared): 3rd — Chromatic Orb, Elementalism, Thunderous Smite; 5th — Mirror Image, Phantasmal Force; 9th — Fly, Gaseous Form; 13th — Conjure Minor Elementals, Summon Elemental; 17th — Banishing Smite, Contact Other Plane.',
        engine: 'DM-prompt in S5; always-prepared list is paladinOathSpellsAtLevel (existing helper).',
        gateCheck: true,
      },
      {
        key: 'genies_splendor',
        name: 'Genie\'s Splendor',
        level: 3,
        kind: 'A',
        mechanics: { ac: 'when you are not wearing any armor, your base Armor Class equals 10 plus your Dexterity and Charisma modifiers; you can use a Shield and still gain this benefit', skill: 'proficiency in one skill of your choice from the splendor_skill choice list' },
        prompt: 'Genie\'s Splendor: when you are not wearing any armor, your base Armor Class equals 10 plus your Dexterity and Charisma modifiers. You can use a Shield and still gain this benefit. You also gain proficiency in one of the following skills of your choice: Acrobatics, Intimidation, Performance, or Persuasion.',
        engine: 'DM-prompt in S5; unarmored AC math is DM-adjudicated until an AC hook names this feature.',
        gateCheck: true,
      },
      {
        key: 'aura_of_elemental_shielding',
        name: 'Aura of Elemental Shielding',
        level: 7,
        kind: 'E',
        mechanics: { choose: 'one damage type: Acid, Cold, Fire, Lightning, or Thunder', effect: 'you and your allies have Resistance to that damage type while in your Aura of Protection', change: 'at the start of each of your turns, you can change the damage type affected by this feature to one of the other listed options (no action required)' },
        prompt: 'Aura of Elemental Shielding: choose one of the following damage types: Acid, Cold, Fire, Lightning, or Thunder. You and your allies have Resistance to that damage type while in your Aura of Protection. At the start of each of your turns, you can change the damage type affected by this feature to one of the other listed options (no action required).',
        engine: 'DM-prompt in S5; the chosen type is DM-tracked and changes at turn start, not stored.',
        gateCheck: true,
      },
      {
        key: 'elemental_rebuke',
        name: 'Elemental Rebuke',
        level: 15,
        kind: 'C',
        mechanics: { reaction: 'when you are hit by an attack roll', effect: 'halve the attack\'s damage against yourself (round down) and force the attacker to make a Dexterity saving throw against your spell save DC; on a failed save, the attacker takes damage equal to 2d10 plus your Charisma modifier of one of the following types (your choice): Acid, Cold, Fire, Lightning, or Thunder; on a successful save, the attacker takes half as much damage', uses: 'a number of times equal to your Charisma modifier (minimum of once) — see subclassService.elementalRebukeUses', rest: 'long' },
        prompt: 'Elemental Rebuke (Reaction): when you are hit by an attack roll, you can halve the attack\'s damage against yourself (round down) and force the attacker to make a Dexterity saving throw against your spell save DC. On a failed save, the attacker takes damage equal to 2d10 plus your Charisma modifier of one of the following types (your choice): Acid, Cold, Fire, Lightning, or Thunder. On a successful save, the attacker takes half as much damage. You can use this feature a number of times equal to your Charisma modifier (minimum of once), and you regain all expended uses when you finish a Long Rest.',
        engine: 'DM-prompt in S5; use count is subclassService.elementalRebukeUses (pure math).',
        gateCheck: true,
      },
      {
        key: 'noble_scion',
        name: 'Noble Scion',
        level: 20,
        kind: 'C',
        mechanics: { action: 'Bonus Action', duration: '10 minutes or until you end the benefits (no action required)', reuse: 'once used, cannot be used again until you finish a Long Rest; you can also restore your use by expending a level 5 spell slot (no action required)', flight: 'you have a Fly Speed of 60 feet and can hover', minorWish: 'when you or an ally in your Aura of Protection fails a D20 Test, you can take a Reaction to make you or that ally succeed instead' },
        prompt: 'Noble Scion (Bonus Action): you gain the benefits below for 10 minutes or until you end them (no action required). Once you use this feature, you cannot use it again until you finish a Long Rest. You can also restore your use of it by expending a level 5 spell slot (no action required). Flight: you have a Fly Speed of 60 feet and can hover. Minor Wish: when you or an ally in your Aura of Protection fails a D20 Test, you can take a Reaction to make you or that ally succeed instead.',
        engine: 'DM-prompt in S5; the capstone duration and Minor Wish reaction are DM-adjudicated.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'oath_of_charity',
    name: 'Oath of Charity',
    description: 'A paladin who gives everything away — spells, healing, and safety — and asks nothing back. You cast oath spells without a slot, pour Lay on Hands into your healing, and shield your allies with your aura.',
    class: 'paladin',
    source: 'Additional Subclasses — Myths and Folklore Collection (Homebrewery, unofficial Fan Content)',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: 'PARTIAL COVERAGE (ROSTER.md A2): confirmed levels only are wired. The 15th- and 20th-level features were lost to two-column OCR interleaving (fragments mention healing/a spell at 15th and a "Benev…" capstone at 20th) and are NOT reconstructed here. Tenets (Benevolence, Compassion, Humility) are flavor text, not mechanics; no folklore sidebar is printed for this entry.',
    unresolved: ['15th-level feature (name and mechanics lost to OCR interleaving)', '20th-level feature (name and mechanics lost; fragment reads "Benev…")'],
    features: [
      {
        key: 'oath_of_charity_spells',
        name: 'Oath of Charity Spells',
        level: 3,
        kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['Healing Word', 'Sanctuary'], 5: ['Prayer of Healing', 'Warding Bond'], 9: ['Create Food and Water', "Leomund's Tiny Hut"], 13: ['Fabricate', "Mordenkainen's Private Sanctum"], 17: ['Creation', 'Greater Restoration'] }, spellingNote: 'Printed as "Create Food or Water" in ROSTER; catalog spelling "Create Food and Water" is used in data (renamed 2026-11-06, item 13).' },
        prompt: 'Oath of Charity Spells (ALWAYS PREPARED): at 3rd level Healing Word, Sanctuary; at 5th Prayer of Healing, Warding Bond; at 9th Create Food and Water, Leomund\'s Tiny Hut; at 13th Fabricate, Mordenkainen\'s Private Sanctum; at 17th Creation, Greater Restoration.',
        engine: 'subclassService.paladinOathSpellsAtLevel (cumulative).',
        gateCheck: true,
      },
      {
        key: 'channel_divinity_charitable_giving',
        name: 'Channel Divinity: Charitable Giving',
        level: 3,
        kind: 'C',
        mechanics: { effect: 'cast any Oath Spell without a spell slot or non-consumed material components, if level-qualified' },
        prompt: 'Channel Divinity: Charitable Giving: cast any Oath Spell without a spell slot or non-consumed material components, if you are level-qualified for it.',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
      {
        key: 'healers_touch',
        name: "Healer's Touch",
        level: 3,
        kind: 'C',
        mechanics: { effect: 'when casting a healing spell, add any number of Lay on Hands points to the healing, divisible among targets; 5 points cures disease or poison as normal for Lay on Hands' },
        prompt: "Healer's Touch: when you cast a healing spell, you can add any number of Lay on Hands points to the healing, divisible among targets; spending 5 points cures disease or poison as normal for Lay on Hands.",
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
      {
        key: 'aura_of_shielding',
        name: 'Aura of Shielding',
        level: 7,
        kind: 'E',
        mechanics: { effect: 'you and chosen creatures within 10 feet gain +1 AC', rangeAt18th: '30 feet' },
        prompt: 'Aura of Shielding: you and chosen creatures within 10 feet of you gain +1 AC (range 30 feet at 18th level).',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
];

export default PALADIN_SUBCLASSES;
