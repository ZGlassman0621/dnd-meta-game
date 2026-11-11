/**
 * Wizard subclasses — Batch 2 (PHB 2024 spell-list classes).
 *
 * Gate-check warning, read this before trusting any number below:
 * there is no 2024 PHB PDF in the scanned folder, so these entries
 * were NOT extracted from Zach's PHB. They were authored from 2024
 * knowledge in the app's own wording, never copied verbatim, and
 * every level and number below is still a gate check item for Zach
 * against his own PHB — nothing here is presented as verified
 * from the book itself.
 *
 * Selection level: 3rd for all four schools, following the 2024
 * unification (2014 schools were 2nd — do NOT carry that over).
 * That level, like every feature level here, is gateCheck-flagged.
 *
 * PHB-PHOTO VERIFICATION 2026-11-06 (2024 PHB photos, Zach-provided,
 * pp. 165-175): the four PHB schools' feature NAMES + LEVELS match the
 * book exactly (cadence 3/3/6/10/14; Evoker Potent Cantrip/Sculpt Spells
 * levels were swapped and are corrected here; Illusionist 'Improved Minor
 * Illusion' is the 2014 name — 2024 is 'Improved Illusions'). All four
 * Savant features carry the shared 2024 rule (two school spells of 2nd
 * level or lower free at 3rd, +1 free school spell per new slot level);
 * the 2014 copying-discount text is gone. Feature BODIES beyond the
 * corrected fields were NOT transcribed from the photos and stay
 * gateCheck-flagged. The six non-PHB schools are untouched by this job.
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

export const WIZARD_SUBCLASSES = [
  {
    key: 'abjurer',
    name: 'Abjurer',
    description: 'A wizard of abjuration — a shield against all magic. Your ward absorbs blows for you and your allies, your dispels and counterspells hit harder, and at your peak spells themselves struggle to touch you.',
    class: 'wizard',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    features: [
      {
        key: 'abjuration_savant',
        name: 'Abjuration Savant',
        level: 3,
        kind: 'D',
        mechanics: {
          effect: 'choose two Abjuration spells of 2nd level or lower and add them to your spellbook for free; whenever you gain access to a new level of spell slots, add one Abjuration spell of a level for which you have slots to your spellbook for free',
        },
        prompt:
          'Abjuration Savant: choose two Abjuration spells of 2nd level or lower and add them to your spellbook for free. Whenever you gain access to a new level of spell slots, add one Abjuration spell to your spellbook for free.',
        engine: 'Kind D (spell access, reclassified 2026-11-09, mechanics hooks Amendment 2): the free additions ride the spellbook system (migration 111, spellbookService.js) — 0 gp / 0 h adds via the savantSpells level-up field at 3rd (two school spells of 2nd level or lower) and at each new spell-slot level (one school spell).',
        gateCheck: true,
      },
      {
        key: 'arcane_ward',
        name: 'Arcane Ward',
        level: 3,
        kind: 'B',
        mechanics: {
          wardHp: '2 x wizard level + Intelligence modifier',
          trigger: 'when you cast an Abjuration spell with a spell slot, the ward regains Hit Points equal to twice the spell slot level',
          absorbs: 'damage you would take, until the ward is depleted; a ward with 0 Hit Points cannot absorb damage',
        },
        prompt:
          'Arcane Ward: you have a magical ward with Hit Points equal to twice your Wizard level + your Intelligence modifier. When you take damage, the ward takes the damage first. When you cast an Abjuration spell with a spell slot, the ward regains Hit Points equal to twice the spell slot level. A ward reduced to 0 cannot absorb damage until it regains Hit Points.',
        engine: 'subclassService.arcaneWardHp (pure math); ward tracking and damage absorption are named follow-ups, not wired in Batch 2.',
        gateCheck: true,
      },
      {
        key: 'projected_ward',
        name: 'Projected Ward',
        level: 6,
        kind: 'C',
        mechanics: {
          action: 'reaction',
          trigger: 'a creature you can see within 30 feet of you takes damage',
          effect: 'your Arcane Ward absorbs that damage instead',
        },
        prompt:
          'Projected Ward (reaction): when a creature you can see within 30 feet of you takes damage, your Arcane Ward absorbs that damage instead of the creature taking it.',
        engine: 'DM-adjudicated in Batch 2; no ward-tracking engine exists yet, so no marker is added.',
        gateCheck: true,
      },
      {
        key: 'spell_breaker',
        name: 'Spell Breaker',
        level: 10,
        kind: 'E',
        mechanics: {
          effect: 'when you cast Dispel Magic or Counterspell, add your Intelligence modifier to the spellcasting ability check for that spell',
        },
        prompt:
          'Spell Breaker: when you cast Dispel Magic or Counterspell, add your Intelligence modifier to the ability check made for that spell.',
        engine: 'DM-adjudicated in Batch 2; the spell-cast hook for dispel/counter checks is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'spell_resistance',
        name: 'Spell Resistance',
        level: 14,
        kind: 'E',
        mechanics: {
          effect: 'advantage on saving throws against spells, and resistance to damage from spells',
        },
        prompt:
          'Spell Resistance: you have advantage on saving throws against spells, and resistance to damage dealt by spells.',
        engine: 'DM-adjudicated in Batch 2; the save/damage hooks for this are named follow-ups.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'diviner',
    name: 'Diviner',
    description: 'A wizard who has already seen tomorrow. Your portents let you replace any roll, your divinations return spent slots, your third eye sees all, and at your peak you hold three fates in your hand.',
    class: 'wizard',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    features: [
      {
        key: 'divination_savant',
        name: 'Divination Savant',
        level: 3,
        kind: 'D',
        mechanics: {
          effect: 'choose two Divination spells of 2nd level or lower and add them to your spellbook for free; whenever you gain access to a new level of spell slots, add one Divination spell of a level for which you have slots to your spellbook for free',
        },
        prompt:
          'Divination Savant: choose two Divination spells of 2nd level or lower and add them to your spellbook for free. Whenever you gain access to a new level of spell slots, add one Divination spell to your spellbook for free.',
        engine: 'Kind D (spell access, reclassified 2026-11-09, mechanics hooks Amendment 2): the free additions ride the spellbook system (migration 111, spellbookService.js) — 0 gp / 0 h adds via the savantSpells level-up field at 3rd (two school spells of 2nd level or lower) and at each new spell-slot level (one school spell).',
        gateCheck: true,
      },
      {
        key: 'portent',
        name: 'Portent',
        level: 3,
        kind: 'B',
        mechanics: {
          dice: '2 dice at 3rd level, 3 dice at 14th level (Greater Portent)',
          timing: 'roll the dice after finishing a long rest; each die can replace one attack roll, saving throw, or ability check made by you or a creature you can see, before the roll is made',
          expiry: 'each die can be used only once; unused dice are lost when you finish a long rest',
        },
        prompt:
          'Portent: after you finish a long rest, roll two d20s (three at 14th level, Greater Portent) and record the results. Before any attack roll, saving throw, or ability check by you or a creature you can see is made, you can replace that roll with one of your recorded Portent dice. Each die can be used only once, and unused dice are lost when you finish a long rest.',
        engine: 'subclassService.portentDice (pure count); Portent die tracking and roll replacement are named follow-ups, not wired in Batch 2.',
        gateCheck: true,
      },
      {
        key: 'expert_divination',
        name: 'Expert Divination',
        level: 6,
        kind: 'B',
        mechanics: {
          effect: 'when you cast a Divination spell of 2nd level or higher using a spell slot, you regain one expended spell slot',
          regainedSlot: 'of a level lower than the spell you cast, and no higher than 5th level',
        },
        prompt:
          'Expert Divination: when you cast a Divination spell of 2nd level or higher using a spell slot, you regain one expended spell slot of a level lower than the spell you cast (and no higher than 5th level).',
        engine: 'DM-adjudicated in Batch 2; the spell-cast hook for slot recovery is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'the_third_eye',
        name: 'The Third Eye',
        level: 10,
        kind: 'G',
        mechanics: {
          action: 'use an action to gain one of the listed benefits',
          duration: 'until you finish a long rest, or until you use this feature again to choose a different benefit',
          benefits: ['Darkvision', 'Ethereal Sight', 'Greater Comprehension', 'See Invisibility'],
        },
        prompt:
          'The Third Eye (action): choose one benefit — Darkvision (see in darkness as if in dim light, and in dim light as if in bright light, out to a range the DM states), Ethereal Sight (see into the Ethereal Plane), Greater Comprehension (read any language), or See Invisibility (see invisible creatures and objects). The benefit lasts until you finish a long rest or choose a different benefit with this feature.',
        engine: 'Stored choice via subclassService.validateChoice (third_eye_benefit) and migration 103 subclass_choices_json; benefit effects are DM-adjudicated in Batch 2.',
        gateCheck: true,
      },
      {
        key: 'greater_portent',
        name: 'Greater Portent',
        level: 14,
        kind: 'B',
        mechanics: {
          effect: 'Portent now gives three dice instead of two',
        },
        prompt:
          'Greater Portent: your Portent feature now rolls three dice instead of two after a long rest.',
        engine: 'subclassService.portentDice (pure count); die tracking is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [
      {
        key: 'third_eye_benefit',
        options: ['Darkvision', 'Ethereal Sight', 'Greater Comprehension', 'See Invisibility'],
      },
    ],
  },
  {
    key: 'evoker',
    name: 'Evoker',
    description: 'A wizard of pure destructive power who sculpts explosions around their friends. Your cantrips never truly miss, your evocations hit harder, and at your peak your spells deal maximum damage.',
    class: 'wizard',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    features: [
      {
        key: 'evocation_savant',
        name: 'Evocation Savant',
        level: 3,
        kind: 'D',
        mechanics: {
          effect: 'choose two Evocation spells of 2nd level or lower and add them to your spellbook for free; whenever you gain access to a new level of spell slots, add one Evocation spell of a level for which you have slots to your spellbook for free',
        },
        prompt:
          'Evocation Savant: choose two Evocation spells of 2nd level or lower and add them to your spellbook for free. Whenever you gain access to a new level of spell slots, add one Evocation spell to your spellbook for free.',
        engine: 'Kind D (spell access, reclassified 2026-11-09, mechanics hooks Amendment 2): the free additions ride the spellbook system (migration 111, spellbookService.js) — 0 gp / 0 h adds via the savantSpells level-up field at 3rd (two school spells of 2nd level or lower) and at each new spell-slot level (one school spell).',
        gateCheck: true,
      },
      {
        key: 'potent_cantrip',
        name: 'Potent Cantrip',
        level: 3,
        kind: 'E',
        mechanics: {
          effect: 'when a creature succeeds on a saving throw against one of your Wizard cantrips, it takes half the cantrip damage (if any) instead of none',
        },
        prompt:
          'Potent Cantrip: when a creature succeeds on a saving throw against one of your Wizard cantrips, it still takes half the cantrip damage, if the cantrip deals damage.',
        engine: 'DM-adjudicated in Batch 2; the cantrip-save hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'sculpt_spells',
        name: 'Sculpt Spells',
        level: 6,
        kind: 'E',
        mechanics: {
          effect: 'when you cast an Evocation spell that affects other creatures you can see, you can choose a number of those creatures equal to 1 + the spell slot level; chosen creatures automatically succeed on saving throws against the spell and take no damage from it',
        },
        prompt:
          'Sculpt Spells: when you cast an Evocation spell that affects other creatures you can see, choose a number of those creatures equal to 1 + the spell slot level. Chosen creatures automatically succeed on their saving throws against the spell and take no damage from it.',
        engine: 'DM-adjudicated in Batch 2; the spell-cast hook for sculpted targets is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'empowered_evocation',
        name: 'Empowered Evocation',
        level: 10,
        kind: 'A',
        mechanics: {
          effect: 'add your Intelligence modifier to the damage roll of any Wizard Evocation spell you cast',
        },
        prompt:
          'Empowered Evocation: add your Intelligence modifier to the damage roll of any Wizard Evocation spell you cast.',
        engine: 'DM-adjudicated for PCs (pending instruction, never silently added) and companion math in principle; the spell-damage hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'overchannel',
        name: 'Overchannel',
        level: 14,
        kind: 'C',
        mechanics: {
          effect: 'when you cast a Wizard Evocation spell of 5th level or lower that deals damage, you can deal maximum damage with that spell instead of rolling',
          cost: 'after the first use, each further use before finishing a long rest deals necrotic damage to you that grows with each use; the DM states the exact cost at the gate — the cost curve is gateCheck, do not assume it from this entry',
          limit: 'you cannot use this feature again until you finish a long rest after taking its cost, as the DM confirms at the gate',
        },
        prompt:
          'Overchannel: when you cast a Wizard Evocation spell of 5th level or lower that deals damage, you can deal maximum damage with that spell instead of rolling. Further uses before a long rest harm you with necrotic damage that grows each time — the exact cost curve is a gate-check item, so the DM states it from the PHB rather than this entry inventing it.',
        engine: 'DM-adjudicated in Batch 2; no overchannel cost tracker exists yet.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'illusionist',
    name: 'Illusionist',
    description: 'A wizard whose illusions are almost real — and at your peak, real enough. Your minor illusions sing and show at once, your phantasms bite, your illusory self takes the blow, and your illusions become solid for a full minute.',
    class: 'wizard',
    source: 'PHB 2024',
    sourceTier: 'core',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    features: [
      {
        key: 'illusion_savant',
        name: 'Illusion Savant',
        level: 3,
        kind: 'D',
        mechanics: {
          effect: 'choose two Illusion spells of 2nd level or lower and add them to your spellbook for free; whenever you gain access to a new level of spell slots, add one Illusion spell of a level for which you have slots to your spellbook for free',
        },
        prompt:
          'Illusion Savant: choose two Illusion spells of 2nd level or lower and add them to your spellbook for free. Whenever you gain access to a new level of spell slots, add one Illusion spell to your spellbook for free.',
        engine: 'Kind D (spell access, reclassified 2026-11-09, mechanics hooks Amendment 2): the free additions ride the spellbook system (migration 111, spellbookService.js) — 0 gp / 0 h adds via the savantSpells level-up field at 3rd (two school spells of 2nd level or lower) and at each new spell-slot level (one school spell).',
        gateCheck: true,
      },
      {
        key: 'improved_illusions',
        name: 'Improved Illusions',
        level: 3,
        kind: 'E',
        mechanics: {
          effect: 'when you cast Minor Illusion, you can create both a sound and an image with a single casting, instead of only one or the other',
        },
        prompt:
          'Improved Illusions: when you cast Minor Illusion, you can create both a sound and an image with that one casting.',
        engine: 'DM-adjudicated in Batch 2; the cantrip hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'phantasmal_creatures',
        name: 'Phantasmal Creatures',
        level: 6,
        kind: 'E',
        mechanics: {
          effect: 'your illusion spells can become quasi-real: a creature that fails to see through one of your illusions can be affected by it as if it were real, as the DM adjudicates from the PHB text — exact trigger, damage, and limits are gateCheck items, not encoded as numbers here',
        },
        prompt:
          'Phantasmal Creatures: your illusions can become quasi-real for a creature that fails to see through them, so that creature can be affected by the illusion as if it were real. The exact trigger, damage, and limits are gate-check items — the DM applies them from the PHB, this entry does not invent numbers for them.',
        engine: 'DM-adjudicated in Batch 2; the illusion-resolution hook is a named follow-up. Modeled qualitatively, not numerically, because the exact mechanics were not confidently sourced.',
        gateCheck: true,
      },
      {
        key: 'illusory_self',
        name: 'Illusory Self',
        level: 10,
        kind: 'C',
        mechanics: {
          action: 'reaction',
          trigger: 'a creature makes an attack roll against you',
          effect: 'you create an illusory duplicate of yourself and the attack misses; you regain the use of this feature when you finish a short or long rest',
        },
        prompt:
          'Illusory Self (reaction): when a creature makes an attack roll against you, you can create an illusory duplicate of yourself and the attack misses. You regain this feature when you finish a short or long rest.',
        engine: 'DM-adjudicated in Batch 2; the attack-path hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'illusory_reality',
        name: 'Illusory Reality',
        level: 14,
        kind: 'C',
        mechanics: {
          action: 'bonus action',
          effect: 'choose one inanimate, nonmagical object that is part of your illusion spell and make it real for 1 minute; it cannot deal damage or otherwise directly harm anyone',
          duration: '1 minute',
        },
        prompt:
          'Illusory Reality (bonus action): choose one inanimate, nonmagical object that is part of your illusion spell and make it real for 1 minute. The object cannot deal damage or otherwise directly harm anyone.',
        engine: 'DM-adjudicated in Batch 2; no illusion-object tracker exists yet.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'war_magic',
    name: 'War Magic',
    description: 'A wizard of war magic — deflecting blows and answering with force. Your wit puts you first, your deflections shield you, your power surges feed your spells, and at your peak every deflection blasts your enemies with force.',
    class: 'wizard',
    source: "Xanathar's Guide to Everything (2014) — 2024 conversion",
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: '2014 grant points 2/6/10/14 map onto the built 2024 Wizard cadence 3/6/10/14: the two 2nd-level features (Arcane Deflection, Tactical Wit) move to 3rd; 6th, 10th, and 14th stay. No 2024 reprint of this subclass exists: this entry is the app conversion of the 2014 Xanathar extract, and every number is gateCheck for Zach.',
    features: [
      {
        key: 'arcane_deflection',
        name: 'Arcane Deflection',
        level: 3,
        kind: 'C',
        mechanics: { reaction: 'when you are hit by an attack or you fail a saving throw', effects: ['gain a +2 bonus to your AC against that attack', 'gain a +4 bonus to that saving throw'], restriction: 'after using this feature, you cannot cast spells other than cantrips until the end of your next turn' },
        prompt: 'Arcane Deflection: when you are hit by an attack or you fail a saving throw, you can use your Reaction to gain a +2 bonus to your AC against that attack or a +4 bonus to that saving throw. After using this feature, you cannot cast spells other than cantrips until the end of your next turn.',
        engine: 'DM-prompt in S2; reaction AC/save hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'tactical_wit',
        name: 'Tactical Wit',
        level: 3,
        kind: 'A',
        mechanics: { initiativeBonus: 'your Intelligence modifier' },
        prompt: 'Tactical Wit: you add your Intelligence modifier to your initiative rolls.',
        engine: 'DM-prompt in S2; initiative hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'power_surge',
        name: 'Power Surge',
        level: 6,
        kind: 'B',
        mechanics: { maximum: 'equal to your Intelligence modifier (minimum of 1)', regain: ['regain all expended uses on a Long Rest', 'gain 1 when you successfully end a spell with Dispel Magic or Counterspell', 'if you end a Short Rest with no power surges, gain 1'], spend: 'once per turn, when you deal damage to a creature or object with a wizard spell, spend 1 power surge to deal extra force damage to that target equal to half your Wizard level' },
        prompt: 'Power Surge: you have a maximum number of power surges equal to your Intelligence modifier (minimum of 1), regained on a Long Rest. You gain 1 when you successfully end a spell with Dispel Magic or Counterspell, and if you end a Short Rest with no power surges, you gain 1. Once per turn, when you deal damage to a creature or object with a wizard spell, you can spend 1 power surge to deal extra force damage to that target equal to half your Wizard level.',
        engine: 'DM-prompt in S2; power-surge tracking is a named follow-up (classFeatureService pool integration, not wired in S2).',
        gateCheck: true,
      },
      {
        key: 'durable_magic',
        name: 'Durable Magic',
        level: 10,
        kind: 'E',
        mechanics: { condition: 'while you are concentrating on a spell', effect: 'gain a +2 bonus to AC and all saving throws' },
        prompt: 'Durable Magic: while you are concentrating on a spell, you have a +2 bonus to AC and all saving throws.',
        engine: 'DM-prompt in S2; concentration-conditional bonus hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'deflecting_shroud',
        name: 'Deflecting Shroud',
        level: 14,
        kind: 'C',
        mechanics: { trigger: 'when you use your Arcane Deflection feature', effect: 'up to three creatures of your choice within 60 feet of you each take force damage equal to half your Wizard level' },
        prompt: 'Deflecting Shroud: when you use your Arcane Deflection feature, up to three creatures of your choice within 60 feet of you each take force damage equal to half your Wizard level.',
        engine: 'DM-prompt in S2; deflection-damage hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'chronurgy_magic',
    name: 'Chronurgy Magic',
    description: 'A wizard of chronurgy who bends time itself. You force rerolls, freeze foes in stasis, bottle spells in beads, and at your peak you decide whether any roll succeeds or fails.',
    class: 'wizard',
    source: "Explorer's Guide to Wildemount (2020) — 2024 conversion",
    sourceTier: 'scanned',
    origin_setting: 'Exandria',
    origin_region: 'Wildemount',
    gateCheckRequired: true,
    conversionCheck: '2020 grants ran 2/6/10/14; mapped onto the built 2024 Wizard cadence 3/6/10/14 — only the two 2nd-level features (Chronal Shift, Temporal Awareness) moved to 3rd. Dunamis is kept as itself, not reskinned (plan section 12). Dunamancy spells are a separate spell shelf, not a Chronurgy spell list: this entry grants no spell list, and dunamancy availability is a DM decision noted in the prompt. No 2024 reprint of this subclass exists: every number is gateCheck for Zach.',
    choices: [],
    features: [
      {
        key: 'chronal_shift',
        name: 'Chronal Shift',
        level: 3,
        kind: 'C',
        mechanics: { reaction: 'after you or a creature you can see within 30 feet makes an attack roll, an ability check, or a saving throw', effect: 'force the creature to reroll; the target must use the second roll; you decide after seeing success or failure', uses: 2, rest: 'long' },
        prompt: 'Chronal Shift (reaction, 2 uses, regained on a Long Rest): after you or a creature you can see within 30 feet makes an attack roll, an ability check, or a saving throw, force that creature to reroll — decided after seeing success or failure, and the target must use the second roll.',
        engine: 'DM-prompt in S3; no roll-replacement hook exists (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'temporal_awareness',
        name: 'Temporal Awareness',
        level: 3,
        kind: 'A',
        mechanics: { effect: 'add Intelligence modifier to Initiative rolls' },
        prompt: 'Temporal Awareness: add your Intelligence modifier to your Initiative rolls.',
        engine: 'DM-prompt in S3; Initiative math is DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'momentary_stasis',
        name: 'Momentary Stasis',
        level: 6,
        kind: 'C',
        mechanics: { action: 'action', range: 'Large or smaller creature you can see within 60 feet', save: 'Constitution against your spell save DC', effect: 'on a failed save the creature is encased until the end of your next turn or until it takes any damage; while encased it is incapacitated and has speed 0', uses: 'Intelligence modifier (minimum 1)', rest: 'long' },
        prompt: 'Momentary Stasis (action, uses equal to Intelligence modifier, minimum 1, regained on a Long Rest): force a Large or smaller creature you can see within 60 feet to make a Constitution saving throw against your spell save DC. On a failure it is encased until the end of your next turn or until it takes any damage; while encased it is incapacitated and has speed 0.',
        engine: 'DM-prompt in S3; condition application is DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'arcane_abeyance',
        name: 'Arcane Abeyance',
        level: 10,
        kind: 'C',
        mechanics: { trigger: 'when you cast a spell using a spell slot of 4th level or lower', effect: 'condense the spell into a gray bead (Tiny object, AC 15, 1 HP, immune to poison and psychic damage) for 1 hour; a creature holding the bead can use its action to release the spell, using your spell attack bonus and save DC, treating the releaser as the caster; if the duration ends or the bead is destroyed, the spell is lost', rest: 'short or long' },
        prompt: 'Arcane Abeyance: when you cast a spell using a spell slot of 4th level or lower, condense it into a gray bead (Tiny, AC 15, 1 HP, immune to poison and psychic damage) for 1 hour. A creature holding the bead can use its action to release the spell, using your spell attack bonus and save DC and treating the releaser as the caster. If the duration ends or the bead is destroyed, the spell is lost. Once used, cannot be used again until a Short or Long Rest.',
        engine: 'DM-prompt in S3; no bead-item engine exists.',
        gateCheck: true,
      },
      {
        key: 'convergent_future',
        name: 'Convergent Future',
        level: 14,
        kind: 'C',
        mechanics: { reaction: 'when you or a creature you can see within 60 feet makes an attack roll, an ability check, or a saving throw', effect: 'ignore the die roll and decide whether the number rolled is the minimum needed to succeed or one less than that number (your choice)', cost: 'gain one level of exhaustion, removable only by finishing a Long Rest' },
        prompt: 'Convergent Future (reaction): when you or a creature you can see within 60 feet makes an attack roll, an ability check, or a saving throw, ignore the die roll and decide whether the number rolled is the minimum needed to succeed or one less than that number (your choice). When you use this feature you gain one level of exhaustion, removable only by finishing a Long Rest.',
        engine: 'DM-prompt in S3; no roll-replacement or exhaustion hook exists (named follow-up).',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'graviturgy_magic',
    name: 'Graviturgy Magic',
    description: 'A wizard of graviturgy who makes weight itself a weapon. You lighten and crush, drag foes with every spell, turn attacks back on their makers, and at your peak your event horizon drags the hostile to their knees.',
    class: 'wizard',
    source: "Explorer's Guide to Wildemount (2020) — 2024 conversion",
    sourceTier: 'scanned',
    origin_setting: 'Exandria',
    origin_region: 'Wildemount',
    gateCheckRequired: true,
    conversionCheck: '2020 grants ran 2/6/10/14; mapped onto the built 2024 Wizard cadence 3/6/10/14 — only the 2nd-level feature (Adjust Density) moved to 3rd, and its 10th-level Huge-target step is carried inside Adjust Density. Dunamis is kept as itself, not reskinned (plan section 12). Dunamancy spells are a separate spell shelf, not a Graviturgy spell list: this entry grants no spell list. No 2024 reprint of this subclass exists: every number is gateCheck for Zach.',
    choices: [],
    features: [
      {
        key: 'adjust_density',
        name: 'Adjust Density',
        level: 3,
        kind: 'C',
        mechanics: { action: 'action', target: 'one object or creature you can see within 30 feet, Large or smaller (Huge or smaller at 10th level)', effect: 'target weight halved or doubled for up to 1 minute or until concentration ends', halved: 'speed +10 feet, jump twice as far, disadvantage on Strength checks and Strength saving throws', doubled: 'speed -10 feet, advantage on Strength checks and Strength saving throws' },
        prompt: 'Adjust Density (action): alter the weight of one object or creature you can see within 30 feet (Large or smaller; Huge or smaller once you reach 10th level in this class). Halved weight lasts up to 1 minute or until concentration ends: speed +10 feet, jump twice as far, disadvantage on Strength checks and Strength saving throws. Doubled weight: speed -10 feet, advantage on Strength checks and Strength saving throws.',
        engine: 'DM-prompt in S3; concentration/speed application is DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'gravity_well',
        name: 'Gravity Well',
        level: 6,
        kind: 'E',
        mechanics: { trigger: 'whenever you cast a spell on a creature', effect: 'move the target 5 feet to an unoccupied space of your choice if the target is willing to move, the spell hits it with an attack, or it fails a saving throw against the spell' },
        prompt: 'Gravity Well: whenever you cast a spell on a creature, you can move the target 5 feet to an unoccupied space of your choice if the target is willing to move, the spell hits it with an attack, or it fails a saving throw against the spell.',
        engine: 'DM-prompt in S3; no forced-movement hook exists (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'violent_attraction',
        name: 'Violent Attraction',
        level: 10,
        kind: 'C',
        mechanics: { reaction: 'when another creature you can see within 60 feet hits with a weapon attack, or when a creature within 60 feet takes damage from a fall', effects: ['weapon hit: target takes an extra 1d10 damage of the weapon type', 'fall: increase the fall damage by 2d10'], uses: 'Intelligence modifier (minimum 1)', rest: 'long' },
        prompt: 'Violent Attraction (reaction, uses equal to Intelligence modifier, minimum 1, regained on a Long Rest): when another creature you can see within 60 feet hits with a weapon attack, the attack target takes an extra 1d10 damage of the weapon type; or when a creature within 60 feet takes damage from a fall, increase the fall damage by 2d10.',
        engine: 'DM-prompt in S3; damage-rider application is DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'event_horizon',
        name: 'Event Horizon',
        level: 14,
        kind: 'C',
        mechanics: { action: 'action', duration: 'up to 1 minute or until concentration ends', effect: 'whenever a creature hostile to you starts its turn within 30 feet, it makes a Strength saving throw against your spell save DC; on a failed save it takes 2d10 force damage and its speed is reduced to 0 until the start of its next turn; on a successful save it takes half damage and every foot it moves this turn costs 2 extra feet of movement', reuse: 'once used, cannot be used again until a Long Rest or until you expend a spell slot of 3rd level or higher on it' },
        prompt: 'Event Horizon (action, up to 1 minute or until concentration ends): whenever a creature hostile to you starts its turn within 30 feet, it makes a Strength saving throw against your spell save DC. On a failure it takes 2d10 force damage and its speed is reduced to 0 until the start of its next turn; on a success it takes half damage and every foot it moves this turn costs 2 extra feet of movement. Once used, cannot be used again until a Long Rest or until you expend a spell slot of 3rd level or higher on it.',
        engine: 'DM-prompt in S3; turn-start aura application is DM-adjudicated.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'hedge_mage',
    name: 'Hedge Mage',
    description: 'A hedge wizard who wastes nothing — every scroll kept, every spell read twice. Your eye learns spells as they are cast, your fast reading casts unprepared magic, and at your peak you cast your enemies\' own spells back at them.',
    class: 'wizard',
    source: 'Hoard of Heroes — 2024 conversion',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: 'Hoard grants ran 2/6/10/14 -> 3/6/10/14 (only the 2nd-level features moved). No 2024 reprint exists: every number is gateCheck for Zach.',
    sourceNote: 'Hoard of Heroes is third-party/homebrew (Zach: ABSOLUTELY NECESSARY, plan section 13). Mechanics paraphrased in the app\'s own wording from the Hoard extract; never verbatim book prose.',
    features: [
      {
        key: 'nothing_to_waste',
        name: 'Nothing to Waste',
        level: 3,
        kind: 'A',
        mechanics: { scrollCopy: 'you no longer destroy a spell scroll when you successfully copy it into your spellbook', scrollUse: 'you have advantage on ability checks made to use spell scrolls of a level higher than you can cast' },
        prompt: 'Nothing to Waste: you no longer destroy a spell scroll when you successfully copy it into your spellbook, and you have advantage on ability checks made to use spell scrolls of a level higher than you can cast.',
        engine: 'DM-prompt in S4; scroll/copy rules are DM-adjudicated.',
        gateCheck: true,
      },
      {
        key: 'students_eye',
        name: "Student's Eye",
        level: 3,
        kind: 'E',
        mechanics: { arcana: 'you gain proficiency in the Arcana skill if you do not already have it, and your proficiency bonus is doubled for any check you make with it', reaction: 'when a creature you can see and hear within 60 feet of you begins to cast a spell, you can use your reaction to gain knowledge of one of the following: its spellcasting ability; its spell save DC and spell attack bonus; the spell it is casting; its spellcasting level (if any)' },
        prompt: "Student's Eye: you gain proficiency in the Arcana skill if you do not already have it, and your proficiency bonus is doubled for any check you make with it. Additionally, when a creature you can see and hear within 60 feet of you begins to cast a spell, you can use your reaction to gain knowledge of one of the following: its spellcasting ability; its spell save DC and spell attack bonus; the spell it is casting; or its spellcasting level (if any).",
        engine: 'DM-prompt in S4; reaction identification is DM-adjudicated (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'fast_reader',
        name: 'Fast Reader',
        level: 6,
        kind: 'C',
        mechanics: { action: 'bonus action on your turn', effect: 'quickly read through one of the spells in your spellbook; until the end of your next turn, you can cast that spell even if you do not have it prepared', rest: 'short or long' },
        prompt: 'Fast Reader (bonus action): on your turn you can quickly read through one of the spells in your spellbook. Until the end of your next turn, you can cast that spell even if you do not have it prepared. Once used, you cannot use it again until you finish a Short or Long Rest.',
        engine: 'DM-prompt in S4; prepared-spell bypass is DM-adjudicated (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'efficient_casting',
        name: 'Efficient Casting',
        level: 10,
        kind: 'C',
        mechanics: { trigger: 'reaction, when you cast a spell that targets creatures hostile to you and all targets succeed on the initial saving throw', effect: 'you can regain one expended spell slot; the slot regained must be of a level lower than the spell you cast and cannot be higher than 5th level', rest: 'short or long' },
        prompt: 'Efficient Casting (reaction): when you cast a spell that targets creatures hostile to you and all targets succeed on the initial saving throw, you can regain one expended spell slot. The slot you regain must be of a level lower than the spell you cast and cannot be higher than 5th level. Once used, you cannot use it again until you complete a Short or Long Rest.',
        engine: 'DM-prompt in S4; slot recovery is DM-adjudicated (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'spell_mimic',
        name: 'Spell Mimic',
        level: 14,
        kind: 'C',
        mechanics: { trigger: 'when you use your Student\'s Eye to gain knowledge of a spell a hostile creature is casting, and that spell is on the wizard spell list', effect: 'as part of that reaction, you can immediately cast that spell, providing it is of a level you can cast and has a casting time of one action or bonus action', slot: 'casting in this way expends a spell slot as normal, but can only be cast at its lowest level' },
        prompt: 'Spell Mimic: when you use your Student\'s Eye to gain knowledge of a spell a hostile creature is casting and that spell is on the wizard spell list, as part of that reaction you can immediately cast that spell, providing it is of a level you can cast and has a casting time of one action or bonus action. Casting a spell in this way expends a spell slot as normal, but can only be cast at its lowest level.',
        engine: 'DM-prompt in S4; mimic casting is DM-adjudicated (named follow-up).',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'bladesinger',
    name: 'Bladesinger',
    description: 'A wizard-bladesinger who fights in a whirlwind of steel and song. Your bladesong quickens you, your blade is your focus, your attacks weave cantrips, and at your peak every spell you cast is followed by a strike.',
    class: 'wizard',
    source: 'Heroes of Faerûn',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    conversionCheck: 'Heroes of Faerûn grants run 3/6/10/14, which coincide exactly with the built 2024 Wizard cadence 3/6/10/14 — no feature was re-pointed. Mechanics paraphrased in the app\'s own wording from the Heroes of Faerûn text extract (Mac, 660,813 bytes); every number is gateCheck for Zach.',
    choices: [
      { key: 'bladesinger_skill', options: ['Acrobatics', 'Athletics', 'Performance', 'Persuasion'], note: 'chosen at selection; stored in migration 103 subclass_choices_json' },
    ],
    features: [
      {
        key: 'bladesong',
        name: 'Bladesong',
        level: 3,
        kind: 'B',
        mechanics: { action: 'Bonus Action', requirement: 'you are not wearing armor or using a Shield', duration: '1 minute; ends early if you have the Incapacitated condition, if you don armor or a Shield, or if you use two hands to make an attack with a weapon; you can dismiss the Bladesong at any time (no action required)', uses: 'a number of times equal to your Intelligence modifier (minimum of once) — see subclassService.bladesongUses; you regain all expended uses when you finish a Long Rest; you regain one expended use when you use Arcane Recovery', agility: 'you gain a bonus to your AC equal to your Intelligence modifier (minimum of +1) — see subclassService.bladesongAcBonus — and your Speed increases by 10 feet; in addition, you have Advantage on Dexterity (Acrobatics) checks', bladework: 'whenever you attack with a weapon with which you have proficiency, you can use your Intelligence modifier for the attack and damage rolls instead of using Strength or Dexterity', focus: 'when you make a Constitution saving throw to maintain Concentration, you can add your Intelligence modifier to the total' },
        prompt: 'Bladesong (Bonus Action, provided you are not wearing armor or using a Shield): the Bladesong lasts for 1 minute and ends early if you have the Incapacitated condition, if you don armor or a Shield, or if you use two hands to make an attack with a weapon. You can dismiss the Bladesong at any time (no action required). While the Bladesong is active, you gain the following benefits. You can invoke the Bladesong a number of times equal to your Intelligence modifier (minimum of once), and you regain all expended uses when you finish a Long Rest. You regain one expended use when you use Arcane Recovery. Agility: you gain a bonus to your AC equal to your Intelligence modifier (minimum of +1), and your Speed increases by 10 feet. In addition, you have Advantage on Dexterity (Acrobatics) checks. Bladework: whenever you attack with a weapon with which you have proficiency, you can use your Intelligence modifier for the attack and damage rolls instead of using Strength or Dexterity. Focus: when you make a Constitution saving throw to maintain Concentration, you can add your Intelligence modifier to the total.',
        engine: 'DM-prompt in S5; use count and AC bonus are subclassService.bladesongUses / bladesongAcBonus (pure math); the active state is DM-tracked.',
        gateCheck: true,
      },
      {
        key: 'training_in_war_and_song',
        name: 'Training in War and Song',
        level: 3,
        kind: 'A',
        mechanics: { weapons: 'proficiency with all Melee Martial weapons that do not have the Two-Handed or Heavy property', focus: 'you can use a Melee weapon with which you have proficiency as a Spellcasting Focus for your Wizard spells', skill: 'proficiency in one skill of your choice from the bladesinger_skill choice list' },
        prompt: 'Training in War and Song: you gain proficiency with all Melee Martial weapons that do not have the Two-Handed or Heavy property. You can use a Melee weapon with which you have proficiency as a Spellcasting Focus for your Wizard spells. You also gain proficiency in one of the following skills of your choice: Acrobatics, Athletics, Performance, or Persuasion.',
        engine: 'DM-prompt in S5; the skill choice is validated.',
        gateCheck: true,
      },
      {
        key: 'extra_attack',
        name: 'Extra Attack',
        level: 6,
        kind: 'A',
        mechanics: { effect: 'you can attack twice, instead of once, whenever you take the Attack action on your turn; moreover, you can cast one of your Wizard cantrips that has a casting time of an action in place of one of those attacks' },
        prompt: 'Extra Attack: you can attack twice, instead of once, whenever you take the Attack action on your turn. Moreover, you can cast one of your Wizard cantrips that has a casting time of an action in place of one of those attacks.',
        engine: 'DM-prompt in S5; Extra Attack counting uses the existing turn-ledger path, not a new resource.',
        gateCheck: true,
      },
      {
        key: 'song_of_defense',
        name: 'Song of Defense',
        level: 10,
        kind: 'C',
        mechanics: { reaction: 'when you take damage while your Bladesong is active', cost: 'expend one spell slot', effect: 'reduce the damage taken by an amount equal to five times the spell slot\'s level — see subclassService.songOfDefenseReduction' },
        prompt: 'Song of Defense (Reaction): when you take damage while your Bladesong is active, you can expend one spell slot and reduce the damage taken by an amount equal to five times the spell slot\'s level.',
        engine: 'DM-prompt in S5; the reduction is subclassService.songOfDefenseReduction (pure math); slot spend uses the existing base-class pool.',
        gateCheck: true,
      },
      {
        key: 'song_of_victory',
        name: 'Song of Victory',
        level: 14,
        kind: 'C',
        mechanics: { trigger: 'after you cast a spell that has a casting time of an action', effect: 'you can make one attack with a weapon as a Bonus Action' },
        prompt: 'Song of Victory: after you cast a spell that has a casting time of an action, you can make one attack with a weapon as a Bonus Action.',
        engine: 'DM-prompt in S5; the bonus-action attack uses the existing turn-ledger path.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'runecrafter',
    name: 'Runecrafter',
    description: 'A wizard-runecrafter who writes spells in living runes. Your runes empower every casting, your sigils shield you, your glyphs cost nothing, and at your peak two runes answer a single spell.',
    class: 'wizard',
    source: 'Additional Subclasses — Myths and Folklore Collection (Homebrewery, unofficial Fan Content)',
    sourceTier: 'scanned',
    origin_setting: 'Forgotten Realms',
    origin_region: 'Forgotten Realms',
    gateCheckRequired: true,
    sourceNote: 'Folklore inspiration (runes of the Poetic Edda / Sigdrifumal) is flavor, not a feature.',
    conversionCheck: 'As-printed grants ran 2/6/10/14; mapped onto the built 2024 Wizard cadence 3/6/10/14. Only the two 2nd-level features (Rune Script, Runic Empowerment) moved to 3rd, and the stored rune choice (runic_empowerment_runes) moves with them to 3rd; 6th, 10th, and 14th stay. No 2024 reprint of this subclass exists: every number is gateCheck for Zach.',
    features: [
      {
        key: 'rune_script',
        name: 'Rune Script',
        level: 3,
        kind: 'E',
        mechanics: { languages: 'speak, read, and write Dwarvish, or another Dwarvish-script language if Dwarvish is already known', runicInscription: 'spells learned on wizard level-up may be inscribed normally or in Runic; copying a spell in Runic takes twice the time and cost; another wizard cannot copy a Runic spell' },
        prompt: 'Rune Script: you can speak, read, and write Dwarvish, or another Dwarvish-script language if you already know Dwarvish. Spells learned on wizard level-up may be inscribed normally or in Runic; copying a spell in Runic takes twice the time and cost, and another wizard cannot copy a Runic spell.',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
      {
        key: 'runic_empowerment',
        name: 'Runic Empowerment',
        level: 3,
        kind: 'G',
        mechanics: { choiceKey: 'runic_empowerment_runes', runesKnown: '2 now, +1 at 6th, 10th, and 14th level (5 total)', replace: 'replace one known rune per wizard level', invoke: 'when casting a wizard spell written in Runic, invoke one known rune', uses: 'Intelligence modifier, minimum 1, per Long Rest', arcaneRecoveryAt10th: 'regain one use via Arcane Recovery', runes: { Alerune: 'chosen creature within 30 feet has advantage on its next saving throw against or to end being charmed within 1 minute', Biargrune: '6th level or higher: chosen creature within 30 feet adds your Intelligence modifier (minimum +1) to Strength and Constitution saving throws for 1 minute', Brimrune: '6th level or higher: when casting an action or bonus-action spell, your speed increases by 5 feet times the slot level and your movement does not provoke Opportunity Attacks until the start of your next turn', Gamanrune: 'chosen creature within 30 feet adds your Proficiency Bonus to its next Initiative roll before the end of the next Long Rest and cannot be surprised until the rune is used or that Long Rest ends', Hugrune: 'a touch-range spell target rolls 1d4 on Wisdom checks, a number of times equal to the slot level, losing unused uses on a Long Rest', Limrune: 'chosen creature within 30 feet, including yourself, regains hit points equal to 5 times the slot level', Malrune: 'bonus to Charisma (Persuasion) checks equal to the slot level for 1 hour', Tyrune: '6th level or higher: on a spell attack roll, give another creature within 60 feet advantage on its next weapon attack before the end of your next turn, dealing +Intelligence modifier damage on a hit' } },
        prompt: 'Runic Empowerment: you learn 2 runes (stored choice, +1 at 6th, 10th, and 14th level) and can replace one per wizard level. When casting a wizard spell written in Runic, invoke one known rune (uses equal to your Intelligence modifier, minimum 1, per Long Rest; regain one use via Arcane Recovery at 10th level). Runes: Alerune (advantage on next save vs/ending charmed, 30 feet, 1 minute); Biargrune, 6th+ (add Intelligence modifier, minimum +1, to Strength/Constitution saves, 30 feet, 1 minute); Brimrune, 6th+ (speed +5 feet per slot level, no Opportunity Attacks until start of next turn); Gamanrune (add Proficiency Bonus to next Initiative before end of next Long Rest, cannot be surprised until used or that rest ends); Hugrune (touch-range spell target rolls 1d4 on Wisdom checks, times equal to slot level); Limrune (regain hit points equal to 5 times slot level, 30 feet); Malrune (bonus to Charisma (Persuasion) checks equal to slot level, 1 hour); Tyrune, 6th+ (on a spell attack roll, give another creature within 60 feet advantage on its next weapon attack before end of next turn, +Intelligence modifier damage on a hit).',
        engine: 'Stored choice list via subclassService.validateChoiceList (runic_empowerment_runes, maxCount 5; level gating to 2/3/4/5 runes at 3rd/6th/10th/14th is DM-adjudicated).',
        gateCheck: true,
      },
      {
        key: 'sigil_of_might',
        name: 'Sigil of Might',
        level: 6,
        kind: 'C',
        mechanics: { trigger: 'reaction', effect: 'advantage on a Strength, Dexterity, or Constitution saving throw', uses: '1 per Long Rest unless a Runic Empowerment use is spent' },
        prompt: 'Sigil of Might (reaction, once per Long Rest unless a Runic Empowerment use is spent): gain advantage on a Strength, Dexterity, or Constitution saving throw.',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
      {
        key: 'protective_glyph',
        name: 'Protective Glyph',
        level: 10,
        kind: 'C',
        mechanics: { spell: 'Glyph of Warding', spellbook: 'added to your spellbook, not counting against prepared spells', runicUseOptions: 'expend a Runic Empowerment use when casting it to waive costly components, change casting time from 1 hour to 1 minute, or waive the spell slot' },
        prompt: 'Protective Glyph: Glyph of Warding is added to your spellbook, not counting against prepared spells. When casting it, you can expend a Runic Empowerment use to waive its costly components, change its casting time from 1 hour to 1 minute, or waive the spell slot.',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
      {
        key: 'rune_maven',
        name: 'Rune Maven',
        level: 14,
        kind: 'E',
        mechanics: { effect: 'invoke up to two runes per spell for a single Runic Empowerment use, if prerequisites are met' },
        prompt: 'Rune Maven: you can invoke up to two runes per spell for a single Runic Empowerment use, if prerequisites are met.',
        engine: 'DM-prompt only.',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'runic_empowerment_runes', level: 3, maxCount: 5, options: ['Alerune', 'Biargrune', 'Brimrune', 'Gamanrune', 'Hugrune', 'Limrune', 'Malrune', 'Tyrune'] },
    ],
  },
];

export default WIZARD_SUBCLASSES;
