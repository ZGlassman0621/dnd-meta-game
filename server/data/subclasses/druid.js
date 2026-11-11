/**
 * Druid subclasses — Batch 4 (PHB 2024 entity-heavy classes, LAST PHB batch).
 *
 * SCAN-EDITION WARNING — READ BEFORE TRUSTING ANY NUMBER BELOW:
 * The files named "PHB 2024 Classes Pt1/Pt2" that Zach split on
 * 2026-11-03 are NOT the 2024 Player's Handbook. They are image-only
 * printouts of the 2014 Player's Handbook, Chapter 3: Classes, from
 * an AnyFlip flipbook dated 2024-04-24 (before the 2024 book existed).
 * Evidence, checked visually from the rendered pages: Pt1 PDF p.1 is
 * printed p.45, "Chapter 3: Classes", with the 2014 classes table;
 * Pt2 PDF p.1 is printed p.80, "Way of Shadow" / "Way of the Four
 * Elements" with ki points — 2014 Monk, not 2024 Warrior of
 * Elements with Focus points; Pt1 Druid art page is printed p.64
 * and Pt2 Ranger art page is printed p.89, both 2014 art/layout.
 * The 2014 book has only Land and Moon as PHB Druid circles and
 * only Hunter and Beast Master as PHB Ranger archetypes, so it
 * cannot source Sea, Stars, Fey Wanderer, or Gloom Stalker at all,
 * and its Land/Moon/Hunter/Beast numbers are the 2014 numbers.
 * These entries were therefore NOT authored from those scans.
 * They were authored from 2024 knowledge, cross-checked against
 * secondary 2024 summaries, in the app's own wording, never copied
 * verbatim, and every level and number below is still a gate-check
 * item for Zach against his own 2024 PHB — nothing here is
 * presented as scan-checked. Do NOT relabel this batch
 * scan-checked without a verified 2024 source.
 * PHB-PHOTO VERIFICATION 2026-11-06 (source: '2024 PHB photos,
 * Zach-provided 2026-11-06'): the four PHB circles' feature names,
 * levels, and circle-spell lists are now verified against Zach's
 * 2024 PHB photos and match the registry — no corrections were
 * needed except the Star Map free-cast count (Wisdom modifier per
 * Long Rest). Mechanics bodies remain gateCheck.
 *
 * Cadence: Druid subclasses grant at 3rd, 6th, 10th, and 14th
 * in 2024 (not 3/6/10/14 carried over blindly — that IS the
 * Druid cadence here, with two features at 3rd for every circle).
 * Circle spells are ALWAYS PREPARED at druid levels 3/5/7/9,
 * except Land, whose list is chosen per Long Rest by land type.
 *
 * Entity honesty (kind H): Circle of the Moon Wild Shape forms
 * and the Beast Master Primal Companion (Ranger file) need an
 * entity/statblock path the app does not have — companions rows
 * are NPC-linked, and no beast-form row exists. This file models
 * the numbers, limits, and choices in the registry and surfaces
 * them in the DM prompt; it does NOT pretend a form/companion
 * entity exists. The entity path is a named follow-up.
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

export const DRUID_SUBCLASSES = [
  {
    key: 'circle_of_the_land',
    name: 'Circle of the Land',
    description: 'A druid of a chosen land — arid, polar, temperate, or tropical — whose spells change with the terrain you wake in. You call flowers and thorns to strike, recover spent magic on a short rest, resist your land\'s element, and at your peak you raise a sanctuary of spectral trees.',
    class: 'druid',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: '2024 knowledge + secondary 2024 summaries; NOT from the Pt1/Pt2 scans (those are the 2014 PHB — see header). 2024 Land uses four land types chosen at each Long Rest, not the 2014 eight terrains.',
    features: [
      {
        key: 'circle_of_the_land_spells',
        name: 'Circle of the Land Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'always prepared',
          choiceAtLongRest: true,
          landTypes: ['arid', 'polar', 'temperate', 'tropical'],
          alwaysPreparedByLand: {
            arid: { 3: ['Blur', 'Burning Hands', 'Fire Bolt'], 5: ['Fireball'], 7: ['Blight'], 9: ['Wall of Stone'] },
            polar: { 3: ['Fog Cloud', 'Hold Person', 'Ray of Frost'], 5: ['Sleet Storm'], 7: ['Ice Storm'], 9: ['Cone of Cold'] },
            temperate: { 3: ['Misty Step', 'Shocking Grasp', 'Sleep'], 5: ['Lightning Bolt'], 7: ['Freedom of Movement'], 9: ['Tree Stride'] },
            tropical: { 3: ['Acid Splash', 'Ray of Sickness', 'Web'], 5: ['Stinking Cloud'], 7: ['Polymorph'], 9: ['Insect Plague'] },
          },
        },
        prompt:
          'Circle of the Land Spells: whenever you finish a Long Rest, choose one land type — arid, polar, temperate, or tropical — and you have that land\'s spells prepared for your druid level and lower. Arid: Blur, Burning Hands, Fire Bolt at 3rd; Fireball at 5th; Blight at 7th; Wall of Stone at 9th. Polar: Fog Cloud, Hold Person, Ray of Frost at 3rd; Sleet Storm at 5th; Ice Storm at 7th; Cone of Cold at 9th. Temperate: Misty Step, Shocking Grasp, Sleep at 3rd; Lightning Bolt at 5th; Freedom of Movement at 7th; Tree Stride at 9th. Tropical: Acid Splash, Ray of Sickness, Web at 3rd; Stinking Cloud at 5th; Polymorph at 7th; Insect Plague at 9th. The land type is a stored choice (migration 103 column).',
        engine: 'subclassService.druidCircleSpellsAtLevel (pure lookup, by land type); catalog-checked in Batch 4.',
        gateCheck: true,
      },
      {
        key: 'lands_aid',
        name: "Land's Aid",
        level: 3,
        kind: 'C',
        mechanics: {
          action: 'Magic action',
          cost: 'one Wild Shape use',
          range: 'point within 60 feet',
          area: '10-foot-radius Sphere',
          damage: { dice: '2d6', type: 'Necrotic', save: 'Constitution', scaling: '3d6 at 10th, 4d6 at 14th' },
          healing: 'one creature of your choice in the area regains the same dice in Hit Points',
        },
        prompt:
          "Land's Aid (Magic action, expend one Wild Shape use): choose a point within 60 feet; flowers and thorns appear for a moment in a 10-foot-radius Sphere there. Each creature of your choice in the Sphere makes a Constitution saving throw against your spell save DC, taking 2d6 Necrotic damage on a failed save or half as much on a successful one, and one creature of your choice in the area regains 2d6 Hit Points. Damage and healing increase to 3d6 at 10th level and 4d6 at 14th level.",
        engine: 'subclassService.landAidDice (pure math); area/save application is DM-adjudicated in Batch 4.',
        gateCheck: true,
      },
      {
        key: 'natural_recovery',
        name: 'Natural Recovery',
        level: 6,
        kind: 'B',
        mechanics: {
          freeCircleSpell: 'once per Long Rest, cast one level 1+ spell you have prepared from Circle of the Land Spells without expending a spell slot',
          shortRestRecovery: 'on finishing a Short Rest, recover expended spell slots with combined levels up to half your druid level (rounded up), none of level 6+, once per Long Rest',
        },
        prompt:
          'Natural Recovery: once per Long Rest, you can cast one level 1+ spell you have prepared from your Circle of the Land Spells without expending a spell slot. In addition, when you finish a Short Rest, you can recover expended spell slots with combined levels up to half your druid level (rounded up), none of level 6 or higher, and you cannot do so again until you finish a Long Rest.',
        engine: 'DM-adjudicated in Batch 4; slot-recovery tracking is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'natures_ward',
        name: "Nature's Ward",
        level: 10,
        kind: 'E',
        mechanics: {
          immune: ['Poisoned'],
          resistanceByLand: { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' },
        },
        prompt:
          "Nature's Ward: you are immune to the Poisoned condition, and you have Resistance to a damage type tied to your current land choice — Fire for arid, Cold for polar, Lightning for temperate, Poison for tropical.",
        engine: 'DM-adjudicated in Batch 4; the resistance hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'natures_sanctuary',
        name: "Nature's Sanctuary",
        level: 14,
        kind: 'C',
        mechanics: {
          action: 'Magic action',
          cost: 'one Wild Shape use',
          area: '15-foot Cube on the ground within 120 feet',
          duration: '1 minute, or until you are Incapacitated or die',
          effect: 'you and your allies have Half Cover in the area, and allies there gain your Nature\'s Ward Resistance',
          move: 'as a Bonus Action, move the Cube up to 60 feet to ground within 120 feet',
        },
        prompt:
          "Nature's Sanctuary (Magic action, expend one Wild Shape use): spectral trees and vines appear in a 15-foot Cube on the ground within 120 feet of you, lasting 1 minute or until you are Incapacitated or die. You and your allies have Half Cover while in that area, and your allies gain your current Nature's Ward Resistance there. As a Bonus Action, you can move the Cube up to 60 feet to ground within 120 feet of you.",
        engine: 'DM-adjudicated in Batch 4; no area tracker exists yet.',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'land_type', options: ['arid', 'polar', 'temperate', 'tropical'], note: 'chosen at each Long Rest; stored in migration 103 subclass_choices_json' },
    ],
  },
  {
    key: 'circle_of_the_moon',
    name: 'Circle of the Moon',
    description: 'A druid who wears the moon\'s shape, fighting as a beast with lunar magic. Your wild shapes are mightier, your moon spells are always ready and castable in beast form, you step through moonlight, and at your peak your beast attacks burn radiant.',
    class: 'druid',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: '2024 knowledge + secondary 2024 summaries; NOT from the Pt1/Pt2 scans (2014 PHB — see header). 2024 Moon replaces 2014 Elemental Wild Shape / Thousand Forms with Moonlight Step / Lunar Form.',
    features: [
      {
        key: 'circle_forms',
        name: 'Circle Forms',
        level: 3,
        kind: 'H',
        mechanics: {
          maxChallengeRating: 'druid level divided by 3, rounded down',
          armorClass: '13 plus your Wisdom modifier if that total is higher than the Beast\'s AC',
          temporaryHitPoints: 'three times your druid level',
          entityPath: 'MODELED-NOT-READY: no Wild Shape form entity row exists in the app; numbers and limits are registry data only',
        },
        prompt:
          'Circle Forms (kind H, entity path modeled-not-ready — no Wild Shape form row exists yet, so the DM applies these numbers, they are not an entity): when you assume a Wild Shape form with lunar magic, the form\'s maximum Challenge Rating equals your druid level divided by 3 (rounded down); your AC in the form equals 13 plus your Wisdom modifier if that total is higher than the Beast\'s AC; and you gain Temporary Hit Points equal to three times your druid level.',
        engine: 'subclassService.moonWildShapeMaxCr / moonWildShapeAc / moonWildShapeTempHp (pure math); form instantiation is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'circle_of_the_moon_spells',
        name: 'Circle of the Moon Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'always prepared',
          castableInWildShape: true,
          alwaysPreparedByLevel: {
            3: ['Cure Wounds', 'Moonbeam', 'Starry Wisp'],
            5: ['Conjure Animals'],
            7: ['Fount of Moonlight'],
            9: ['Mass Cure Wounds'],
          },
        },
        prompt:
          'Circle of the Moon Spells: you always have these spells prepared, and you can cast them while in a Wild Shape form — Cure Wounds, Moonbeam, and Starry Wisp at 3rd; Conjure Animals at 5th; Fount of Moonlight at 7th; Mass Cure Wounds at 9th.',
        engine: 'subclassService.druidCircleSpellsAtLevel (pure lookup); catalog-checked in Batch 4.',
        gateCheck: true,
      },
      {
        key: 'improved_circle_forms',
        name: 'Improved Circle Forms',
        level: 6,
        kind: 'E',
        mechanics: {
          lunarRadiance: 'each attack in a Wild Shape form can deal its normal damage type or Radiant damage, chosen each time you hit',
          magicalAttacks: 'Wild Shape form attacks count as magical for overcoming Resistance and Immunity to nonmagical damage, as the DM confirms at the gate',
          constitutionSaves: 'add your Wisdom modifier to Constitution saving throws while in a Wild Shape form, as the DM confirms at the gate',
        },
        prompt:
          'Improved Circle Forms: while in a Wild Shape form, each of your attacks can deal its normal damage type or Radiant damage, chosen each time you hit. Your Wild Shape attacks count as magical for overcoming Resistance and Immunity to nonmagical damage, and you add your Wisdom modifier to Constitution saving throws while in form, both as the DM confirms at the gate.',
        engine: 'DM-adjudicated in Batch 4; the attack/save hooks are named follow-ups.',
        gateCheck: true,
      },
      {
        key: 'moonlight_step',
        name: 'Moonlight Step',
        level: 10,
        kind: 'C',
        mechanics: {
          action: 'Bonus Action',
          effect: 'teleport up to 30 feet to an unoccupied space you can see, and gain Advantage on the next attack roll you make before the end of this turn',
        },
        prompt:
          'Moonlight Step (Bonus Action): you magically transport yourself, reappearing in a burst of moonlight up to 30 feet away in an unoccupied space you can see, and you have Advantage on the next attack roll you make before the end of this turn.',
        engine: 'DM-adjudicated in Batch 4; no teleport tracker exists yet.',
        gateCheck: true,
      },
      {
        key: 'lunar_form',
        name: 'Lunar Form',
        level: 14,
        kind: 'E',
        mechanics: {
          improvedLunarRadiance: 'once per turn, deal an extra 2d10 Radiant damage to a target you hit with a Wild Shape form attack',
          sharedMoonlight: 'whenever you use Moonlight Step, you can also teleport one willing creature within 10 feet of you to an unoccupied space you can see within 10 feet of your destination space',
        },
        prompt:
          'Lunar Form: once per turn, you can deal an extra 2d10 Radiant damage to a target you hit with a Wild Shape form attack. Whenever you use Moonlight Step, you can also teleport one willing creature within 10 feet of you to an unoccupied space you can see within 10 feet of your destination space.',
        engine: 'DM-adjudicated in Batch 4; the extra-damage hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'circle_of_the_sea',
    name: 'Circle of the Sea',
    description: 'A druid of the ocean whose wrath is spray, storm, and tide. You wreath yourself in a sea-spray emanation, swim and then fly within it, resist cold, lightning, and thunder, and at your peak you can gift the whole storm to an ally.',
    class: 'druid',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: '2024 knowledge + secondary 2024 summaries; NOT from the Pt1/Pt2 scans (2014 PHB has no Circle of the Sea — see header). Sea is new in the 2024 PHB.',
    features: [
      {
        key: 'circle_of_the_sea_spells',
        name: 'Circle of the Sea Spells',
        level: 3,
        kind: 'D',
        mechanics: {
          access: 'always prepared',
          alwaysPreparedByLevel: {
            3: ['Fog Cloud', 'Gust of Wind', 'Ray of Frost', 'Shatter', 'Thunderwave'],
            5: ['Lightning Bolt', 'Water Breathing'],
            7: ['Control Water', 'Ice Storm'],
            9: ['Conjure Elemental', 'Hold Monster'],
          },
        },
        prompt:
          'Circle of the Sea Spells: you always have these spells prepared — Fog Cloud, Gust of Wind, Ray of Frost, Shatter, and Thunderwave at 3rd; Lightning Bolt and Water Breathing at 5th; Control Water and Ice Storm at 7th; Conjure Elemental and Hold Monster at 9th.',
        engine: 'subclassService.druidCircleSpellsAtLevel (pure lookup); catalog-checked in Batch 4.',
        gateCheck: true,
      },
      {
        key: 'wrath_of_the_sea',
        name: 'Wrath of the Sea',
        level: 3,
        kind: 'C',
        mechanics: {
          action: 'Bonus Action',
          cost: 'one Wild Shape use',
          area: '5-foot Emanation around you',
          duration: '10 minutes, ending early if you dismiss it (no action required), manifest it again, or have the Incapacitated condition',
          repeatAction: 'Bonus Action on subsequent turns',
          damage: { dice: 'd6s equal to your Wisdom modifier (minimum of one die)', type: 'Cold', save: 'Constitution', push: 'up to 15 feet away from you if the creature is Large or smaller' },
        },
        prompt:
          'Wrath of the Sea (Bonus Action, expend one Wild Shape use): you manifest a 5-foot Emanation of ocean spray around yourself for 10 minutes, ending early if you dismiss it (no action required), manifest it again, or have the Incapacitated condition. When you manifest it and as a Bonus Action on your subsequent turns, you can choose another creature you can see in the Emanation; it must succeed on a Constitution saving throw against your spell save DC or take Cold damage equal to a number of d6s equal to your Wisdom modifier (minimum of one die) and, if it is Large or smaller, be pushed up to 15 feet away from you.',
        engine: 'subclassService.wrathOfTheSeaDice (pure math); Emanation/save/push application is DM-adjudicated in Batch 4.',
        gateCheck: true,
      },
      {
        key: 'aquatic_affinity',
        name: 'Aquatic Affinity',
        level: 6,
        kind: 'E',
        mechanics: {
          emanationSize: '10 feet',
          swimSpeed: 'equal to your Speed',
        },
        prompt:
          'Aquatic Affinity: the size of your Wrath of the Sea Emanation increases to 10 feet, and you gain a Swim Speed equal to your Speed.',
        engine: 'DM-adjudicated in Batch 4; the speed hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'stormborn',
        name: 'Stormborn',
        level: 10,
        kind: 'E',
        mechanics: {
          whileWrathActive: { flySpeed: 'equal to your Speed', resistance: ['Cold', 'Lightning', 'Thunder'] },
        },
        prompt:
          'Stormborn: while your Wrath of the Sea is active, you gain a Fly Speed equal to your Speed and Resistance to Cold, Lightning, and Thunder damage.',
        engine: 'DM-adjudicated in Batch 4; the resistance/speed hooks are named follow-ups.',
        gateCheck: true,
      },
      {
        key: 'oceanic_gift',
        name: 'Oceanic Gift',
        level: 14,
        kind: 'C',
        mechanics: {
          effect: 'instead of manifesting Wrath of the Sea around yourself, manifest it around one willing creature within 60 feet of yourself; that creature gains all the benefits and uses your spell save DC and Wisdom modifier',
          both: 'expend two Wild Shape uses instead of one to manifest it around both the other creature and yourself',
        },
        prompt:
          'Oceanic Gift: instead of manifesting Wrath of the Sea around yourself, you can manifest it around one willing creature within 60 feet of yourself; that creature gains all the benefits of the Emanation and uses your spell save DC and Wisdom modifier for it. If you expend two uses of Wild Shape instead of one when manifesting it, you can manifest it around both the other creature and yourself.',
        engine: 'DM-adjudicated in Batch 4; no Emanation tracker exists yet.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'circle_of_the_stars',
    name: 'Circle of the Stars',
    description: 'A druid who reads the stars and wears their light instead of an animal\'s shape. Your star map focuses your spells, your starry form heals, harms, or shields by constellation, and at your peak you grow partly incorporeal and resist all weapon harm.',
    class: 'druid',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: '2024 knowledge + secondary 2024 summaries; NOT from the Pt1/Pt2 scans (2014 PHB has no Circle of the Stars — see header). Stars is imported from Tasha\'s, updated for 2024.',
    features: [
      {
        key: 'star_map',
        name: 'Star Map',
        level: 3,
        kind: 'D',
        mechanics: {
          object: 'Tiny star chart, usable as a Spellcasting Focus for your Druid spells',
          preparedWhileHolding: ['Guidance', 'Guiding Bolt'],
          freeGuidingBolt: 'cast Guiding Bolt without expending a spell slot a number of times equal to your Wisdom modifier per Long Rest',
        },
        prompt:
          'Star Map: you have created a star chart, a Tiny object you can use as a Spellcasting Focus for your Druid spells. While holding it, you have Guidance and Guiding Bolt prepared, and you can cast Guiding Bolt without expending a spell slot a number of times equal to your Wisdom modifier per Long Rest.',
        engine: 'DM-adjudicated in Batch 4; free-cast tracking is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'starry_form',
        name: 'Starry Form',
        level: 3,
        kind: 'C',
        mechanics: {
          action: 'Bonus Action',
          cost: 'one Wild Shape use',
          duration: '10 minutes, ending early if you dismiss it (no action required), have the Incapacitated condition, or use this feature again',
          light: 'Bright Light in a 10-foot radius and Dim Light for an additional 10 feet',
          constellations: {
            archer: 'when you activate this form and as a Bonus Action on subsequent turns while it lasts, make a ranged spell attack against a creature within 60 feet; on a hit, deal Radiant damage equal to 1d8 plus your Wisdom modifier (2d8 at 10th, see Twinkling Constellations)',
            chalice: 'whenever you cast a spell using a spell slot that restores Hit Points to a creature, you or another creature within 30 feet of you can regain Hit Points equal to 1d8 plus your Wisdom modifier (2d8 at 10th, see Twinkling Constellations)',
            dragon: 'when you make an Intelligence or Wisdom check or a Constitution saving throw to maintain Concentration, treat a roll of 9 or lower on the d20 as a 10',
          },
        },
        prompt:
          'Starry Form (Bonus Action, expend one Wild Shape use): instead of shape-shifting, you take on a luminous starry form for 10 minutes, shedding Bright Light in a 10-foot radius and Dim Light for an additional 10 feet, ending early if you dismiss it (no action required), have the Incapacitated condition, or use this feature again. When you assume the form, choose a constellation: Archer — when you activate the form and as a Bonus Action on subsequent turns, make a ranged spell attack against a creature within 60 feet, dealing 1d8 plus your Wisdom modifier Radiant damage on a hit. Chalice — whenever you cast a spell using a spell slot that restores Hit Points to a creature, you or another creature within 30 feet of you can regain 1d8 plus your Wisdom modifier Hit Points. Dragon — when you make an Intelligence or Wisdom check or a Constitution saving throw to maintain Concentration, treat a roll of 9 or lower on the d20 as a 10. The constellation is a per-activation choice, not a permanent stored choice.',
        engine: 'subclassService.starryFormDice (pure math); form/constellation application is DM-adjudicated in Batch 4.',
        gateCheck: true,
      },
      {
        key: 'cosmic_omen',
        name: 'Cosmic Omen',
        level: 6,
        kind: 'F',
        mechanics: {
          effect: 'at the end of a Long Rest, you gain a Reaction tied to an omen of Weal or Woe, as the DM adjudicates from the PHB — exact trigger, bonus/penalty, and use count are gate-check items, not encoded as numbers here',
        },
        prompt:
          'Cosmic Omen: at the end of a Long Rest, you gain a Reaction tied to an omen of Weal or Woe, as the DM adjudicates from the PHB. The exact trigger, bonus or penalty, and use count are gate-check items — this entry does not invent numbers for them.',
        engine: 'DM-adjudicated in Batch 4; modeled qualitatively, not numerically, because secondary summaries conflict on the details.',
        gateCheck: true,
      },
      {
        key: 'twinkling_constellations',
        name: 'Twinkling Constellations',
        level: 10,
        kind: 'E',
        mechanics: {
          archerChaliceDice: '2d8 instead of 1d8',
          dragonFlySpeed: '20 feet, with hover, while Dragon is active',
          changeConstellation: 'at the start of each of your turns while in Starry Form, you can change which constellation glimmers on your body',
        },
        prompt:
          'Twinkling Constellations: your Starry Form constellations improve — the Archer and Chalice dice become 2d8, and while Dragon is active you have a Fly Speed of 20 feet and can hover. At the start of each of your turns while in Starry Form, you can change which constellation glimmers on your body.',
        engine: 'DM-adjudicated in Batch 4; the constellation-switch hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'full_of_stars',
        name: 'Full of Stars',
        level: 14,
        kind: 'E',
        mechanics: {
          whileStarryForm: { resistance: ['Bludgeoning', 'Piercing', 'Slashing'] },
        },
        prompt:
          'Full of Stars: while in your Starry Form, you become partially incorporeal, giving you Resistance to Bludgeoning, Piercing, and Slashing damage.',
        engine: 'DM-adjudicated in Batch 4; the resistance hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'starry_constellation', options: ['Archer', 'Chalice', 'Dragon'], note: 'per-activation choice when assuming Starry Form, not a permanent character choice; validated by validateChoice' },
    ],
  },
  {
    key: 'circle_of_dreams',
    name: 'Circle of Dreams',
    description: 'A druid of the Summer Court whose fey balm heals at a touch and whose paths bend through dream. You heal from a pool of fey dice, shelter rests in hidden moonlight, teleport yourself or an ally, and at your peak you cast dream, scrying, or teleportation without a slot.',
    class: 'druid',
    source: "Xanathar's Guide to Everything (2014) — 2024 conversion",
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: '2014 selection was 2nd and grants ran 2/6/10/14; mapped onto the built 2024 Druid cadence 3/6/10/14. Only Balm of the Summer Court moved (2nd -> 3rd); Hearth, Hidden Paths, and Walker in Dreams sit on the same grant points in both editions. No 2024 reprint of this subclass exists: every number is gateCheck for Zach.',
    features: [
      {
        key: 'balm_of_the_summer_court',
        name: 'Balm of the Summer Court',
        level: 3,
        kind: 'B',
        mechanics: { pool: 'a number of d6s equal to your druid level', action: 'bonus action', range: 'one creature you can see within 120 feet of you', spend: 'a number of dice equal to half your druid level or less', effect: 'roll the spent dice and add them together; the target regains hit points equal to the total and gains 1 temporary hit point per die spent', rest: 'long' },
        prompt: 'Balm of the Summer Court (bonus action): you hold a pool of fey energy equal to your Druid level in d6s. Choose one creature you can see within 120 feet of you and spend a number of those dice equal to half your Druid level or less. Roll the spent dice: the target regains hit points equal to the total and gains 1 temporary hit point per die spent. You regain all expended dice when you finish a long rest.',
        engine: 'subclassService.balmPool (pure math: pool = druid level, max spend = floor(level / 2)); dice spend is DM-adjudicated in S1.',
        gateCheck: true,
      },
      {
        key: 'hearth_of_moonlight_and_shadow',
        name: 'Hearth of Moonlight and Shadow',
        level: 6,
        kind: 'F',
        mechanics: { timing: 'during a short or long rest, at the start of the rest you touch a point in space', sphere: 'an invisible 30-foot-radius sphere of magic centered on that point; total cover blocks the sphere', inside: 'you and your allies gain a +5 bonus to Dexterity (Stealth) and Wisdom (Perception) checks, and light from open flames in the sphere is not visible outside it', ends: 'the sphere vanishes at the end of the rest or when you leave the sphere' },
        prompt: 'Hearth of Moonlight and Shadow: during a short or long rest, you can touch a point in space at the start of the rest, and an invisible 30-foot-radius sphere of magic appears centered on that point (total cover blocks it). While within the sphere, you and your allies gain a +5 bonus to Dexterity (Stealth) and Wisdom (Perception) checks, and light from open flames in the sphere is not visible outside it. The sphere vanishes at the end of the rest or when you leave it.',
        engine: 'DM-prompt only in S1 (rest adjudication, no engine number beyond the +5).',
        gateCheck: true,
      },
      {
        key: 'hidden_paths',
        name: 'Hidden Paths',
        level: 10,
        kind: 'C',
        mechanics: { self: 'as a bonus action on your turn, teleport up to 60 feet to an unoccupied space you can see', ally: 'as an action, teleport one willing creature you touch up to 30 feet to an unoccupied space you can see', uses: 'a number of times equal to your Wisdom modifier (minimum of once)', rest: 'long' },
        prompt: 'Hidden Paths: as a bonus action on your turn, you can teleport up to 60 feet to an unoccupied space you can see. Alternatively, you can use your action to teleport one willing creature you touch up to 30 feet to an unoccupied space you can see. You can use this feature a number of times equal to your Wisdom modifier (minimum of once), regaining all expended uses when you finish a long rest.',
        engine: 'DM-prompt in S1; teleport/zone adjudication is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'walker_in_dreams',
        name: 'Walker in Dreams',
        level: 14,
        kind: 'D',
        mechanics: { timing: 'when you finish a short rest', spells: ['Dream', 'Scrying', 'Teleportation Circle'], cost: 'without expending a spell slot or requiring material components', dreamNote: 'Dream is cast with you as the messenger', circleNote: 'this Teleportation Circle opens a portal to the last location where you finished a long rest on your current plane of existence; if you have not taken a long rest on your current plane, the spell fails but is not wasted', rest: 'long' },
        prompt: 'Walker in Dreams: when you finish a short rest, you can cast Dream (with you as the messenger), Scrying, or Teleportation Circle, without expending a spell slot or requiring material components. This Teleportation Circle opens a portal to the last location where you finished a long rest on your current plane of existence; if you have not taken a long rest on your current plane, the spell fails but is not wasted. Once you use this feature, you cannot use it again until you finish a long rest. All three spells are in the app spell catalog.',
        engine: 'subclassService.walkerInDreamsSpells; all three spells catalog-checked in S1 tests.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'circle_of_the_shepherd',
    name: 'Circle of the Shepherd',
    description: 'A druid who speaks with beasts and summons spirits to guard the flock. Your spirit totem shields or heals, your summoned beasts are tougher and strike as magic, and at your peak your own fall summons a pack of beasts to fight on.',
    class: 'druid',
    source: "Xanathar's Guide to Everything (2014) — 2024 conversion",
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: '2014 selection was 2nd and grants ran 2/6/10/14; mapped onto the built 2024 Druid cadence 3/6/10/14. Only Speech of the Woods and Spirit Totem moved (2nd -> 3rd); Mighty Summoner, Guardian Spirit, and Faithful Summons sit on the same grant points in both editions. No 2024 reprint of this subclass exists: every number is gateCheck for Zach.',
    features: [
      {
        key: 'speech_of_the_woods',
        name: 'Speech of the Woods',
        level: 3,
        kind: 'F',
        mechanics: { effect: 'you learn to speak, read, and write Sylvan; beasts can understand your speech, and you can decipher their noises and motions', limits: 'most beasts cannot convey sophisticated concepts, and this ability does not grant you friendship with beasts, though a friendly beast could relay what it has seen or heard in the recent past' },
        prompt: 'Speech of the Woods: you learn to speak, read, and write Sylvan. Beasts can understand your speech, and you can decipher their noises and motions. Most beasts cannot convey sophisticated concepts, and this does not grant you friendship with beasts — though a friendly beast could relay what it has seen or heard recently.',
        engine: 'DM-prompt only in S1.',
        gateCheck: true,
      },
      {
        key: 'spirit_totem',
        name: 'Spirit Totem',
        level: 3,
        kind: 'G',
        mechanics: { choiceKey: 'spirit_totem', options: ['Bear Spirit', 'Hawk Spirit', 'Unicorn Spirit'], action: 'bonus action', placement: 'summon an incorporeal spirit to a point you can see within 60 feet of you; the spirit creates a 30-foot-radius aura around that point and counts as neither a creature nor an object', move: 'as a bonus action, move the spirit up to 60 feet to a point you can see', duration: '1 minute or until you are incapacitated', rest: 'short or long', Bear: 'each creature of your choice in the aura when the spirit appears gains temporary hit points equal to 5 + your druid level, and you and your allies gain advantage on Strength checks and Strength saving throws while in the aura', Hawk: 'when a creature makes an attack roll against a target in the aura, you can use your reaction to grant advantage to that attack roll, and you and your allies have advantage on Wisdom (Perception) checks while in the aura', Unicorn: 'you and your allies gain advantage on all ability checks made to detect creatures in the aura, and if you cast a spell using a spell slot that restores hit points to any creature inside or outside the aura, each creature of your choice in the aura also regains hit points equal to your druid level' },
        prompt: 'Spirit Totem (bonus action): summon an incorporeal spirit to a point you can see within 60 feet of you. It creates a 30-foot-radius aura around that point (it counts as neither a creature nor an object) and persists for 1 minute or until you are incapacitated. As a bonus action you can move it up to 60 feet to a point you can see. Choose one spirit (stored choice). Bear Spirit: each creature of your choice in the aura when the spirit appears gains temporary hit points equal to 5 + your Druid level, and you and your allies gain advantage on Strength checks and Strength saving throws while in the aura. Hawk Spirit: when a creature makes an attack roll against a target in the aura, you can use your reaction to grant advantage to that attack roll, and you and your allies have advantage on Wisdom (Perception) checks while in the aura. Unicorn Spirit: you and your allies gain advantage on ability checks made to detect creatures in the aura, and if you cast a spell using a spell slot that restores hit points to any creature, each creature of your choice in the aura also regains hit points equal to your Druid level. Once you use this feature, you cannot use it again until you finish a short or long rest.',
        engine: 'Stored choice via subclassService.validateChoice, migration 103; subclassService.spiritTotemTempHp (pure math); aura adjudication is DM-prompt in S1.',
        gateCheck: true,
      },
      {
        key: 'mighty_summoner',
        name: 'Mighty Summoner',
        level: 6,
        kind: 'E',
        mechanics: { appliesTo: 'any beast or fey summoned or created by a spell that you cast', benefits: ['the creature appears with 2 extra hit points per Hit Die it has', 'the damage from its natural weapons is considered magical for overcoming immunity and resistance to nonmagical attacks and damage'] },
        prompt: 'Mighty Summoner: any beast or fey summoned or created by a spell you cast appears with 2 extra hit points per Hit Die it has, and the damage from its natural weapons counts as magical for overcoming immunity and resistance to nonmagical attacks and damage.',
        engine: 'DM-prompt in S1; summoned-creature stat application is DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'guardian_spirit',
        name: 'Guardian Spirit',
        level: 10,
        kind: 'E',
        mechanics: { trigger: 'a beast or fey that you summoned or created with a spell ends its turn in your Spirit Totem aura', effect: 'that creature regains hit points equal to half your druid level' },
        prompt: 'Guardian Spirit: when a beast or fey that you summoned or created with a spell ends its turn in your Spirit Totem aura, that creature regains hit points equal to half your Druid level.',
        engine: 'subclassService.guardianSpiritHeal (pure math: floor(druid level / 2)).',
        gateCheck: true,
      },
      {
        key: 'faithful_summons',
        name: 'Faithful Summons',
        level: 14,
        kind: 'C',
        mechanics: { trigger: 'you are reduced to 0 hit points or are incapacitated against your will', effect: 'you immediately gain the benefits of Conjure Animals as if cast using a 9th-level spell slot: it summons four beasts of your choice that are challenge rating 2 or lower, appearing within 20 feet of you; if they receive no commands, they protect you from harm and attack your foes', duration: '1 hour, requiring no concentration, or until you dismiss it (no action required)', rest: 'long', entityNote: 'the summoned beasts have no entity row in the app — modeled-not-ready as entities, present as registry data + DM prompt only' },
        prompt: 'Faithful Summons: if you are reduced to 0 hit points or are incapacitated against your will, you immediately gain the benefits of Conjure Animals as if cast using a 9th-level spell slot. It summons four beasts of your choice, challenge rating 2 or lower, appearing within 20 feet of you. If they receive no commands, they protect you and attack your foes. The spell lasts for 1 hour, requires no concentration, and you can dismiss it with no action. Once you use this feature, you cannot use it again until you finish a long rest. Conjure Animals is in the app spell catalog.',
        engine: 'DM-adjudicated in S1; summoned beasts are modeled-not-ready as entities (no invented row), same honesty rule as Beast Master in Batch 4.',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'spirit_totem', level: 3, options: ['Bear Spirit', 'Hawk Spirit', 'Unicorn Spirit'] },
    ],
  },
  {
    key: 'circle_of_spores',
    name: 'Circle of Spores',
    description: 'A druid of rot and regrowth whose spores wither the living and raise the dead. Your halo deals necrotic harm, your symbiotic form grants temporary vitality, the fallen rise as fungal servants, and at your peak you cannot be blinded, deafened, frightened, or poisoned.',
    class: 'druid',
    source: "Guildmaster's Guide to Ravnica (2019) — 2024 conversion",
    sourceTier: 'scanned',
    origin_setting: 'Ravnica',
    origin_region: 'Ravnica',
    gateCheckRequired: true,
    conversionCheck: '2019 grants ran 2/6/10/14; mapped onto the built 2024 Druid cadence 3/6/10/14 — only the 2nd-level features (Circle Spells, Halo of Spores, Symbiotic Entity) moved to 3rd. Ravnica guilds are kept as themselves, not reskinned (plan section 12): on Ravnica this circle is found among the Golgari Swarm. No 2024 reprint of this subclass exists: every number is gateCheck for Zach.',
    choices: [],
    features: [
      {
        key: 'spores_circle_spells',
        name: 'Circle Spells',
        level: 3,
        kind: 'D',
        mechanics: { access: 'always prepared', cantrip: 'Chill Touch (learned at selection)', alwaysPreparedByLevel: { 3: ['Blindness/Deafness', 'Gentle Repose'], 5: ['Animate Dead', 'Gaseous Form'], 7: ['Blight', 'Confusion'], 9: ['Cloudkill', 'Contagion'] } },
        prompt: 'Circle Spells (ALWAYS PREPARED, not merely added to the list): you learn the Chill Touch cantrip at selection; at 3rd level Blindness/Deafness, Gentle Repose; at 5th Animate Dead, Gaseous Form; at 7th Blight, Confusion; at 9th Cloudkill, Contagion. All are in the app spell catalog.',
        engine: 'subclassService.druidCircleSpellsAtLevel (cumulative list); the prepared-spells route is a named follow-up, not wired in S3.',
        gateCheck: true,
      },
      {
        key: 'halo_of_spores',
        name: 'Halo of Spores',
        level: 3,
        kind: 'C',
        mechanics: { trigger: 'when a creature you can see moves into a space within 10 feet of you or starts its turn there', reaction: 'deal necrotic damage unless it succeeds on a Constitution saving throw against your spell save DC', damageDie: '1d4, increasing to 1d6 at 6th level, 1d8 at 10th level, 1d10 at 14th level' },
        prompt: 'Halo of Spores (reaction): when a creature you can see moves into a space within 10 feet of you or starts its turn there, deal necrotic damage unless it succeeds on a Constitution saving throw against your spell save DC. Damage is 1d4, increasing to 1d6 at 6th level, 1d8 at 10th level, and 1d10 at 14th level.',
        engine: 'DM-prompt in S3; reaction damage is DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'symbiotic_entity',
        name: 'Symbiotic Entity',
        level: 3,
        kind: 'B',
        mechanics: { action: 'action', cost: 'expend a use of Wild Shape rather than transforming into a beast form', tempHp: '4 temporary hit points for each level you have in this class', duration: '10 minutes, until you lose all the temporary hit points, or until you use Wild Shape again', benefits: ['when you deal Halo of Spores damage, roll the damage die a second time and add it to the total', 'melee weapon attacks deal an extra 1d6 poison damage to any target they hit'] },
        prompt: 'Symbiotic Entity (action, expend a Wild Shape use rather than transforming): gain 4 temporary hit points for each level you have in this class. For 10 minutes, until you lose all the temporary hit points, or until you use Wild Shape again: when you deal Halo of Spores damage, roll the damage die a second time and add it to the total, and your melee weapon attacks deal an extra 1d6 poison damage to any target they hit.',
        engine: 'DM-prompt in S3; Wild Shape spend and temporary-HP application are DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'fungal_infestation',
        name: 'Fungal Infestation',
        level: 6,
        kind: 'C',
        mechanics: { trigger: 'if a beast or humanoid that is Small or Medium dies within 10 feet of you', reaction: 'animate it; it stands up immediately with 1 hit point, uses the zombie stat block, remains animate for 1 hour, then collapses and dies; in combat its turn comes immediately after yours, it obeys your mental commands, and its only action is the Attack action making one melee attack', uses: 'Wisdom modifier (minimum 1)', rest: 'long' },
        prompt: 'Fungal Infestation (reaction, uses equal to Wisdom modifier, minimum 1, regained on a Long Rest): if a beast or humanoid that is Small or Medium dies within 10 feet of you, animate it — it stands up immediately with 1 hit point, uses the zombie stat block, remains animate for 1 hour, then collapses and dies. In combat its turn comes immediately after yours, it obeys your mental commands, and its only action is the Attack action making one melee attack. ENTITY NOTE: the animated zombie has no entity row in S3 — it is DM-tracked, same honesty rule as Beast Master.',
        engine: 'DM-prompt + DM-tracked zombie in S3; no entity row exists (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'spreading_spores',
        name: 'Spreading Spores',
        level: 10,
        kind: 'C',
        mechanics: { trigger: 'bonus action while Symbiotic Entity is active', effect: 'hurl spores up to 30 feet away, where they swirl in a 10-foot cube for 1 minute; spores disappear early if you use this feature again, dismiss them as a bonus action, or Symbiotic Entity ends', cubeDamage: 'whenever a creature moves into the cube or starts its turn there, it takes Halo of Spores damage unless it succeeds on a Constitution saving throw; a creature can take this damage no more than once per turn', haloSuppressed: 'while the cube persists, you cannot use your Halo of Spores reaction' },
        prompt: 'Spreading Spores (bonus action while Symbiotic Entity is active): hurl spores up to 30 feet away, where they swirl in a 10-foot cube for 1 minute (disappears early if you use this feature again, dismiss them as a bonus action, or Symbiotic Entity ends). Whenever a creature moves into the cube or starts its turn there, it takes your Halo of Spores damage unless it succeeds on a Constitution saving throw; a creature can take this damage no more than once per turn. While the cube persists, you cannot use your Halo of Spores reaction.',
        engine: 'DM-prompt in S3; cube tracking is DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'fungal_body',
        name: 'Fungal Body',
        level: 14,
        kind: 'E',
        mechanics: { immunities: ['blinded', 'deafened', 'frightened', 'poisoned'], critRule: 'any critical hit against you counts as a normal hit instead, unless you are incapacitated' },
        prompt: 'Fungal Body: you cannot be blinded, deafened, frightened, or poisoned, and any critical hit against you counts as a normal hit instead, unless you are incapacitated.',
        engine: 'DM-prompt in S3; condition/crit application is DM-adjudicated.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'circle_of_sand',
    name: 'Circle of Sand',
    description: 'A druid of the desert who walks sand untroubled and rides a spirit of the dunes. Your sand-spirit takes the shape of a desert beast, grows large enough to carry you, raises walls of sand, and at your peak you merge with it into a whirlwind of dust and grit.',
    class: 'druid',
    source: 'Hoard of Heroes — 2024 conversion',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: 'Hoard grants ran 2/6/10/14 -> 3/6/10/14 (only the 2nd-level features moved). No 2024 reprint exists: every number is gateCheck for Zach.',
    sourceNote: 'Hoard of Heroes is third-party/homebrew (Zach: ABSOLUTELY NECESSARY, plan section 13). Mechanics paraphrased in the app\'s own wording from the Hoard extract; never verbatim book prose.',
    features: [
      {
        key: 'sandwalker',
        name: 'Sandwalker',
        level: 3,
        kind: 'A',
        mechanics: { movement: 'moving across sand or loose earth costs you no extra movement', forage: 'advantage on checks made to forage for food or find water while within deserts and similar terrain' },
        prompt: 'Sandwalker: moving across sand or loose earth costs you no extra movement, and you have advantage on checks made to forage for food or find water while within deserts and similar terrain.',
        engine: 'DM-prompt in S4; movement/terrain hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'servant_of_the_desert',
        name: 'Servant of the Desert',
        level: 3,
        kind: 'H',
        mechanics: { form: 'an insubstantial cloud of sand, fitting within a five-foot cube, in the shape of a beast', position: 'stays within 5 feet of you, in an unoccupied space', defenses: 'attacks miss it automatically, it succeeds on all saving throws, and it is immune to all damage and conditions', interpose: 'reaction, when a creature you can see targets you with an attack: the spirit swirls between you and the attacker, giving the attack disadvantage', swarm: 'when a creature you can see fails a saving throw against one of your druid spells, the spirit swarms within that creature\'s space until the end of its next turn, or until you use your reaction to interpose it; the creature is blinded while the spirit occupies its space' },
        prompt: 'Servant of the Desert: you bond with a spirit of the desert, an insubstantial cloud of sand fitting within a five-foot cube, in the shape of a beast. It stays within 5 feet of you in an unoccupied space. Attacks miss it automatically, it succeeds on all saving throws, and it is immune to all damage and conditions. Reaction: when a creature you can see targets you with an attack, the spirit swirls between you and the attacker, giving the attack disadvantage. When a creature you can see fails a saving throw against one of your druid spells, you can have the spirit swarm within that creature\'s space until the end of its next turn, or until you use your reaction to interpose it; the creature is blinded while the spirit occupies its space. ENTITY NOTE: the spirit has no entity row in the app — its position is DM-tracked in S4, not system-tracked.',
        engine: 'DM-prompt + DM-tracked position in S4; no spirit entity row exists (named follow-up, same honesty rule as Beast Master).',
        gateCheck: true,
      },
      {
        key: 'spirit_guide',
        name: 'Spirit Guide',
        level: 6,
        kind: 'C',
        mechanics: { action: 'action', effect: 'the spirit expands to become Large, or returns to its normal size', whileLarge: 'Strength score equal to your Wisdom score; rideable as a mount by you and creatures friendly to you; carries pounds equal to thirty times its Strength score', revert: 'the spirit automatically returns to normal size when you activate any other feature that requires your spirit' },
        prompt: 'Spirit Guide (action): your spirit expands to become Large, or returns to its normal size. While Large, it gains a Strength score equal to your Wisdom score, can be ridden as a mount by you and creatures friendly to you, and can carry pounds equal to thirty times its Strength score. It automatically returns to normal size when you activate any of your other features that require your spirit.',
        engine: 'DM-prompt in S4; mount/carry math is DM-adjudicated (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'call_the_dune',
        name: 'Call the Dune',
        level: 10,
        kind: 'C',
        mechanics: { action: 'action', effect: 'disperse your spirit and cast Wall of Sand without using a spell slot', duration: 'lasts until you end it (no action required), requiring no concentration', lockout: 'until the spell ends, you cannot benefit from any feature that requires your spirit' },
        prompt: 'Call the Dune (action): you disperse your spirit and cast Wall of Sand without using a spell slot. The spell lasts until you end it (no action required) and requires no concentration. Until it ends, you cannot benefit from any of your features that require your spirit.',
        engine: 'DM-prompt in S4; Wall of Sand is in the spell catalog; the no-slot, no-concentration casting is DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'dust_devil',
        name: 'Dust Devil',
        level: 14,
        kind: 'H',
        mechanics: { cost: 'expend one use of your Wild Shape', duration: '1 minute', effects: 'resistance to cold and fire damage, size becomes Large, temporary hit points equal to your Druid level at the start of each of your turns, the area within 10 feet of you becomes heavily obscured for creatures other than you, flying speed equal to your walking speed', lockout: 'you cannot benefit from any feature that requires your spirit for the duration', rest: 'long' },
        prompt: 'Dust Devil: you can expend a use of your Wild Shape to merge with your spirit for 1 minute. For the duration you have resistance to cold and fire damage, your size becomes Large, you gain temporary hit points equal to your Druid level at the start of each of your turns, the area within 10 feet of you becomes heavily obscured for creatures other than you, and you gain a flying speed equal to your walking speed. You cannot benefit from any feature that requires your spirit for the duration. Once used, you cannot use it again until you complete a Long Rest. ENTITY NOTE: the merged form is DM-tracked in S4, not an entity row.',
        engine: 'DM-prompt in S4; merged-form state is DM-tracked (named follow-up).',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'spirit_form', level: 3, options: ['Camel', 'Vulture', 'Snake', 'Lizard', 'Coyote', 'Scorpion'] },
    ],
  },
  {
    key: 'circle_of_the_unborn',
    name: 'Circle of the Unborn',
    description: 'A druid of stillborn spirits and the line between life and death. You summon a stillborn spirit that feeds on necrotic harm, split or double the healing of life transference, and at your peak you and your spirit resist all weapon harm and pass through the world like ghosts.',
    class: 'druid',
    source: 'Additional Subclasses — Myths and Folklore Collection (Homebrewery, unofficial Fan Content)',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: 'Folklore inspiration (Pontianak/Kuntilanak) is flavor, not a feature.',
    conversionCheck: 'As-printed grants ran 2/6/10/14; mapped onto the built 2024 Druid cadence 3/6/10/14. Circle-spell tiers 2nd+3rd collapsed into the 2024 3rd tier (all four spells always prepared from selection); 5th/7th/9th pairs unchanged. Only Circle Spells and Stilled Summons moved (2nd -> 3rd); Transfer Essence, Dichotomic Aura, and Spirit Boundary sit on the same grant points in both editions. No 2024 reprint of this subclass exists: every number is gateCheck for Zach.',
    features: [
      {
        key: 'circle_spells_unborn',
        name: 'Circle Spells',
        level: 3,
        kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['Bane', 'Cure Wounds', 'Gentle Repose', 'Silence'], 5: ['Revivify', 'Vampiric Touch'], 7: ['Aura of Life', 'Death Ward'], 9: ['Antilife Shell', 'Reincarnate'] } },
        prompt: 'Circle Spells (ALWAYS PREPARED): at 3rd level Bane, Cure Wounds, Gentle Repose, Silence; at 5th Revivify, Vampiric Touch; at 7th Aura of Life, Death Ward; at 9th Antilife Shell, Reincarnate.',
        engine: 'subclassService.druidCircleSpellsAtLevel (cumulative).',
        gateCheck: true,
      },
      {
        key: 'stilled_summons',
        name: 'Stilled Summons',
        level: 3,
        kind: 'H',
        mechanics: { cost: 'expend a Wild Shape use, action', effect: 'summon a stillborn spirit — a Beast stat block per Wild Shape limits, type Undead, whose attacks may deal necrotic damage; necrotic damage heals it for half', duration: '1 hour or until dismissed, destroyed, or dead', onDestroyedByVisibleHostile: 'reaction curse: the next hit on that creature has vulnerability to all of that attack\'s damage', note: 'no entity row exists in the app; the spirit is DM-tracked' },
        prompt: 'Stilled Summons (action, expend a Wild Shape use): summon a stillborn spirit — a Beast stat block within your Wild Shape limits, type Undead, whose attacks may deal necrotic damage, and necrotic damage heals it for half. It lasts 1 hour or until dismissed, destroyed, or dead. If it is destroyed by a visible hostile creature, you can curse that creature as a Reaction: the next hit on it has vulnerability to all of that attack\'s damage. The spirit has no entity row in the app, so it is DM-tracked.',
        engine: 'DM-prompt + DM-tracked summon; no entity row exists (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'transfer_essence',
        name: 'Transfer Essence',
        level: 6,
        kind: 'E',
        mechanics: { spell: 'Life Transference', countsAgainstSpellsKnown: false, spellClass: 'druid', onCasting: 'either split the healing between two creatures in range or double the target\'s healing', modifications: 'Wisdom modifier per Long Rest' },
        prompt: 'Transfer Essence: you learn Life Transference as a druid spell, not counting against spells known. When you cast it, you can either split the healing between two creatures in range or double the target\'s healing (modifications equal to your Wisdom modifier per Long Rest).',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
      {
        key: 'dichotomic_aura',
        name: 'Dichotomic Aura',
        level: 10,
        kind: 'E',
        mechanics: { requires: 'spirit summoned', range: '10 feet', quietAura: '+1d6 necrotic damage, chosen creatures deafened, entrants and turn-starters make a Wisdom saving throw or are frightened, incapacitated, and speed 0 while inside', renewalAura: '+1d6 radiant damage, advantage on saving throws against and to end being frightened, 1d4 healing on entering or starting a turn inside', switch: 'switchable each turn' },
        prompt: 'Dichotomic Aura (while your spirit is summoned, 10 feet, switchable each turn): Quiet Aura — +1d6 necrotic damage, chosen creatures are deafened, and creatures entering or starting their turn inside make a Wisdom saving throw or are frightened, incapacitated, and speed 0 while inside; or Renewal Aura — +1d6 radiant damage, advantage on saving throws against and to end being frightened, and 1d4 healing on entering or starting a turn inside.',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
      {
        key: 'spirit_boundary',
        name: 'Spirit Boundary',
        level: 14,
        kind: 'C',
        mechanics: { empoweredSummoning: ['you and your spirit gain resistance to bludgeoning, piercing, and slashing damage', 'your spirit moves through creatures and objects as difficult terrain, taking 1d10 force damage if it ends its turn inside one', 'immunity to frightened', 'bonus action: swap places with your spirit within 120 feet while visible'], uses: '1 per Long Rest' },
        prompt: 'Spirit Boundary (once per Long Rest, empowered summoning): you and your spirit gain resistance to bludgeoning, piercing, and slashing damage; your spirit moves through creatures and objects as difficult terrain, taking 1d10 force damage if it ends its turn inside one; you are immune to frightened; and as a Bonus Action you can swap places with your spirit within 120 feet while visible.',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
];

export default DRUID_SUBCLASSES;
