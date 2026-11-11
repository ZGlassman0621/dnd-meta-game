/**
 * Duelist Dueling Archetypes — Overview-only registry entries.
 *
 * Source: ~/workspace/dnd-app-review/new-classes-staging/digests/duelist.md
 * (GM Binder "Duelist Class Overview", Fan Content; NO author/date/edition
 * printed). Only what the Overview states is wired; its gaps stay gaps:
 * NO expanded archetype text beyond the feature blocks, NO feats/variants,
 * NO NPC/DM guidance, NO multiclass rules (see duelistService header).
 *
 * origin_setting / origin_region are null: the Overview states NO setting,
 * and inventing one would corrupt the outside-FR explanation check either way.
 * Coordinator must decide how validateSelection treats null (recommendation:
 * FR-neutral) before these entries gate. sourceTier 'fan' is this batch's label
 * for Fan Content material; no existing tier vocabulary for it was found in
 * the survey — coordinator to confirm.
 *
 * Archetype features at 3rd, 6th, 13th, 17th (class table). Base-class choices
 * (Fighting Style at 1st, Critical Strikes at 5th/9th/14th) live in
 * duelistService, NOT here — this file holds archetype entries only, except
 * Blade's Additional Fighting Style, which IS an archetype feature (6th) and
 * therefore carries a choices entry below.
 */

export const DUELIST_SUBCLASSES = [
  {
    key: 'blade',
    name: 'The Blade',
    description: 'A duelist of the longsword, rapier, and saber whose strikes land true and whose guard turns blows aside. Your attacks crit more often, your ripostes answer every miss, and at your peak you crit on eighteen and can reroll a miss with advantage.',
    class: 'duelist',
    source: 'GM Binder Duelist Class Overview (Fan Content)',
    sourceTier: 'fan',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'blade_proficiency', name: 'Blade Proficiency', level: 3, kind: 'E',
        mechanics: { proficiencies: ['Shields'], restriction: 'all archetype features work only with longsword, rapier, dagger, shortsword, scimitar, saber' },
        prompt: 'The Blade: gain proficiency in Shields. All archetype features work only with longsword, rapier, dagger, shortsword, scimitar, or saber.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'pinpoint_strikes', name: 'Pinpoint Strikes', level: 3, kind: 'A',
        mechanics: { critThreshold: 19, martialAdvantageOption: 'when using Martial Advantage you may instead add any number of the dice to your attack roll rather than damage' },
        prompt: 'Pinpoint Strikes: weapon attacks crit on 19-20; when using Martial Advantage you may instead add any number of the dice to your attack roll rather than damage.',
        engine: 'duelistService.critThresholdFor (pure math; the attack-path hook that consumes it is a named follow-up).',
        gateCheck: true,
      },
      {
        key: 'additional_fighting_style', name: 'Additional Fighting Style', level: 6, kind: 'G',
        mechanics: { options: ['Defense', 'Dueling', 'Protection', 'Two-weapon Fighting'], note: 'choose a second option from the Fighting Style feature; cannot take an option more than once' },
        prompt: 'Additional Fighting Style: choose a second Fighting Style option (Defense, Dueling, Protection, or Two-weapon Fighting; no option twice).',
        engine: 'subclassService.validateChoice; storage is subclass_choices_json (migration 103).',
        gateCheck: true,
      },
      {
        key: 'warding_blades', name: 'Warding Blades', level: 6, kind: 'E',
        mechanics: { effect: 'reaction when another creature hits you with a melee attack: add 1 + proficiency bonus to AC for that attack, potentially causing a miss' },
        prompt: 'Warding Blades: reaction when another creature hits you with a melee attack — add 1 + your proficiency bonus to AC for that attack, potentially causing a miss.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'riposte', name: 'Riposte', level: 13, kind: 'E',
        mechanics: { effect: 'reaction when a creature misses you with a melee attack: make a melee weapon attack vs that creature' },
        prompt: 'Riposte: reaction when a creature misses you with a melee attack — make a melee weapon attack against that creature.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'perfect_strikes', name: 'Perfect Strikes', level: 17, kind: 'A',
        mechanics: { critThreshold: 18, missReroll: 'if you miss with an attack roll, roll it again with advantage; 1/short-or-long rest' },
        prompt: 'Perfect Strikes: weapon attacks crit on 18-20; if you miss with an attack roll, roll it again with advantage (1/short-or-long rest).',
        engine: 'duelistService.critThresholdFor for the threshold; the reroll is DM adjudicated in Tier 0.',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'additional_fighting_style', level: 6, options: ['Defense', 'Dueling', 'Protection', 'Two-weapon Fighting'] },
    ],
  },
  {
    key: 'mask',
    name: 'The Mask',
    description: 'A duelist of disguise and daring who wins fights with words before blades are drawn. You frighten foes with a glance, read hearts to gain the upper hand, and at your peak no one can pierce your disguise — every attempt to find you fails.',
    class: 'duelist',
    source: 'GM Binder Duelist Class Overview (Fan Content)',
    sourceTier: 'fan',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'mask_proficiency', name: 'Mask Proficiency', level: 3, kind: 'E',
        mechanics: { proficiencies: ['Disguise kit', 'Deception or Stealth (choose one)'] },
        prompt: 'The Mask: gain proficiency in the Disguise kit, and either Deception or Stealth.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'mask_expertise', name: 'Expertise', level: 3, kind: 'E',
        mechanics: { effect: 'choose two skill proficiencies; proficiency bonus doubled for those checks', note: 'the Overview does not restrict the two skills to the class list — no restriction is invented here' },
        prompt: 'Mask Expertise: choose two skill proficiencies; your proficiency bonus is doubled for those checks.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'en_garde', name: 'En Garde', level: 3, kind: 'B',
        mechanics: { effect: 'bonus action: Charisma (Intimidation) check vs a visible, non-incapacitated creature\'s Wisdom (Insight); on success target frightened until end of your next turn; each creature targetable once before you take a short/long rest, success or failure' },
        prompt: 'En Garde: bonus action — Charisma (Intimidation) vs a visible, non-incapacitated creature\'s Wisdom (Insight); on success the target is frightened until the end of your next turn. Each creature can be targeted once before you take a short or long rest, success or failure.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'seen_it_done_it_lived_it', name: 'Seen it, Done It, Lived It', level: 6, kind: 'E',
        mechanics: { effect: 'add half proficiency bonus, rounded down, to any check that does not already include proficiency bonus' },
        prompt: 'Seen it, Done It, Lived It: add half your proficiency bonus (rounded down) to any check that does not already include your proficiency bonus.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'the_hearts_of_men', name: 'The Hearts of Men', level: 6, kind: 'E',
        mechanics: { effect: 'after a successful Insight check on a creature, roll Deception or Persuasion vs them with advantage' },
        prompt: 'The Hearts of Men: after a successful Insight check on a creature, roll Deception or Persuasion against them with advantage.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'superior_skill', name: 'Superior Skill', level: 13, kind: 'B',
        mechanics: { uses: 'twice before needing a long rest', effect: 'instead of rolling a d20, roll your Martial Advantage dice for a skill check' },
        prompt: 'Superior Skill: twice before needing a long rest, instead of rolling a d20 for a skill check, roll your Martial Advantage dice.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'who_knows_what_lies', name: 'Who Knows What Lies…', level: 17, kind: 'E',
        mechanics: { effect: 'Insight, Perception, or Investigation checks to discover who or where you are are made with disadvantage' },
        prompt: 'Who Knows What Lies…: Insight, Perception, or Investigation checks to discover who or where you are are made with disadvantage.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'acrobat',
    name: 'The Acrobat',
    description: 'A duelist who never stands still and is never caught flat-footed. You strike first, dodge what hits you, evade what others cannot, and at your peak no attack against you ever has advantage.',
    class: 'duelist',
    source: 'GM Binder Duelist Class Overview (Fan Content)',
    sourceTier: 'fan',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'acrobat_proficiency', name: 'Acrobat Proficiency', level: 3, kind: 'E',
        mechanics: { proficiencies: ['Acrobatics or Athletics (choose one)'], rope: 'you may add proficiency bonus to any skill check using a rope' },
        prompt: 'The Acrobat: gain proficiency in Acrobatics or Athletics; you may add your proficiency bonus to any skill check using a rope.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'fast_as_lightning', name: 'Fast as Lightning', level: 3, kind: 'A',
        mechanics: { initiativeBonus: 'proficiency bonus' },
        prompt: 'Fast as Lightning: add your proficiency bonus to initiative.',
        engine: 'DM-prompt only in Tier 0 (initiative hook is a named follow-up).',
        gateCheck: true,
      },
      {
        key: 'uncanny_dodge', name: 'Uncanny Dodge', level: 6, kind: 'E',
        mechanics: { effect: 'reaction when a visible attacker hits you: halve the attack\'s damage' },
        prompt: 'Uncanny Dodge: reaction when a visible attacker hits you — halve the attack\'s damage.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'evasion', name: 'Evasion', level: 13, kind: 'E',
        mechanics: { effect: 'Dexterity save for half damage: no damage on success, half on failure' },
        prompt: 'Evasion: on a Dexterity saving throw for half damage, take no damage on a success and half damage on a failure.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'elusive', name: 'Elusive', level: 17, kind: 'E',
        mechanics: { effect: 'no attack roll has advantage against you while you are not incapacitated' },
        prompt: 'Elusive: no attack roll has advantage against you while you are not incapacitated.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
    ],
  },
];
