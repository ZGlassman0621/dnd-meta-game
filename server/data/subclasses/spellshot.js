/**
 * Spellshot subclasses ("Drives") — Spellshot v0.5 homebrew, signed
 * "~ LucaWhiteWing". No publisher or edition claim is printed.
 *
 * Source: ONLY the verified digest at
 * ~/workspace/dnd-app-review/new-classes-staging/digests/spellshot.md.
 * Only the 4 Drives present in the body text are wired. The v0.5
 * changelog mentions an "Arcane Tinkerer" Drive, but no such section
 * appears in the body — it is NOT invented here (digest UNRESOLVED 1;
 * the build step must check the source PDF).
 *
 * Entry shape follows server/data/subclasses/fighter.js. Origin:
 * no setting is printed for this homebrew class, so origin_setting /
 * origin_region are null — under subclassService.isOutsideFr that
 * reads as outside-FR, i.e. an origin explanation is required at
 * selection. That is deliberate: do not silently default a homebrew
 * class to the Forgotten Realms. gateCheckRequired is true because
 * the source-PDF re-check (Arcane Tinkerer, two-column spell list)
 * is still pending.
 * Kinds follow the existing registry letters: B = resource pool,
 * E = passive / DM-prompt. No feature here grants a cantrip or a
 * spell slot (Spellshot has neither); Drive spell access is via
 * the Spell Battery Dynamo system, not slots.
 */

export const SPELLSHOT_SUBCLASSES = [
  {
    key: 'bullet_weaver',
    name: 'Bullet Weaver',
    description: 'A spellshot who weaves spells into bullets — infusing each shot with magic and storing spells in ammunition. Your infusion turns every bullet into a spell, and at your peak your shots become pure force and you hold two spells at once.',
    class: 'spellshot',
    source: 'Spellshot v0.5 (homebrew, LucaWhiteWing)',
    sourceTier: 'homebrew',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'spell_infusion', name: 'Spell Infusion', level: 3, kind: 'E',
        mechanics: { action: 'infuse your next firearm attack with a spell, as an action', note: 'Spell is cast via Spell Battery Dynamo costs; see spellshotService.castSpellBatterySpell' },
        prompt: 'Bullet Weaver Spell Infusion: as an action, you may infuse your next firearm attack with a spell (cast via Spell Battery Dynamo costs).',
        engine: 'DM-prompt in this batch; infusion resolution hook is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'delayed_spells', name: 'Delayed Spells', level: 7, kind: 'B',
        mechanics: { effect: 'store a spell in ammunition for later release', uses: 'Intelligence modifier per long rest' },
        prompt: 'Bullet Weaver Delayed Spells: you may store a spell in ammunition; uses equal your Intelligence modifier per long rest.',
        engine: 'DM-prompt in this batch; stored-spell record is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'infused_secrets', name: 'Infused Secrets', level: 10, kind: 'E',
        mechanics: { effect: 'learn 3 spells of 3rd level or lower from any class list, castable only via Delayed Spells' },
        prompt: 'Bullet Weaver Infused Secrets: you learn 3 spells of 3rd level or lower from any class list; they may only be cast via Delayed Spells.',
        engine: 'DM-prompt in this batch; the 3 spell picks are not enumerated in the digest and are not stored as choices here (any-list picks need a picker).',
        gateCheck: true,
      },
      {
        key: 'infusion_prowess', name: 'Infusion Prowess', level: 10, kind: 'E',
        mechanics: { effect: 'Delayed Spells may target a non-arsenal weapon' },
        prompt: 'Bullet Weaver Infusion Prowess: your Delayed Spells may target a weapon that is not in your arsenal.',
        engine: 'DM-prompt in this batch.',
        gateCheck: true,
      },
      {
        key: 'one_with_the_weave', name: 'One with the Weave', level: 15, kind: 'B',
        mechanics: { costDynamo: 13, action: 'bonus action', duration: '1 minute', effects: ['change firearm/spell damage to force', 'concentrate on two Spell Battery spells', 'reload all arsenal as a bonus action or as part of an attack'], uses: '1 per short or long rest' },
        prompt: 'Bullet Weaver One with the Weave (13 Dynamo, bonus action, 1 minute, 1/short-or-long rest): firearm and spell damage becomes force, you may concentrate on two Spell Battery spells, and you may reload all arsenal weapons as a bonus action or as part of an attack.',
        engine: 'DM-prompt in this batch; dual-concentration hook is a named follow-up.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'thrill_seeker',
    name: 'Thrill Seeker',
    description: 'A spellshot who lives for the rush — the faster you fight, the deadlier you get. Your bravado builds power as you brawl, your arsenal joins your melee, and at your peak you explode in a burst of piercing shrapnel.',
    class: 'spellshot',
    source: 'Spellshot v0.5 (homebrew, LucaWhiteWing)',
    sourceTier: 'homebrew',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'bravado', name: 'Bravado', level: 3, kind: 'E',
        mechanics: { effect: 'extra Dynamo-gain methods while in melee (see digest; thresholds follow the base Dynamo-gain rules)' },
        prompt: 'Thrill Seeker Bravado: you gain Dynamo by additional methods while fighting in melee, on top of the base Dynamo-gain rules.',
        engine: 'DM-prompt in this batch; melee-gain triggers are a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'daring_arsenal', name: 'Daring Arsenal', level: 3, kind: 'E',
        mechanics: { effects: ['add a melee weapon to your arsenal at no arsenal-slot cost', 'no disadvantage for close-range firearm attacks', 'on a hit, you may forgo your proficiency bonus on the attack roll to add double your proficiency bonus to damage'] },
        prompt: 'Thrill Seeker Daring Arsenal: a melee weapon joins your arsenal free; you suffer no close-range disadvantage; on a hit you may forgo proficiency on the attack to add double proficiency to damage.',
        engine: 'DM-prompt in this batch.',
        gateCheck: true,
      },
      {
        key: 'top_gear', name: 'Top Gear', level: 7, kind: 'E',
        mechanics: { thresholdsDynamo: [3, 6, 12, 22], effects: 'threshold states granting speed, a damage-die floor, an AC/saving-throw bonus, and an extra action (see digest for the per-threshold table)' },
        prompt: 'Thrill Seeker Top Gear: at Dynamo thresholds of 3, 6, 12 and 22 you enter escalating states granting speed, a damage-die floor, an AC and saving-throw bonus, and at the top threshold an extra action.',
        engine: 'DM-prompt in this batch; per-threshold numbers are in the digest table and must be read from it at build time, not summarized here.',
        gateCheck: true,
      },
      {
        key: 'full_throttle', name: 'Full Throttle', level: 10, kind: 'E',
        mechanics: { effect: 'Top Gear lasts until the end of your next turn' },
        prompt: 'Thrill Seeker Full Throttle: your Top Gear state lasts until the end of your next turn.',
        engine: 'DM-prompt in this batch.',
        gateCheck: true,
      },
      {
        key: 'hellish_burst', name: 'Hellish Burst', level: 15, kind: 'B',
        mechanics: { costDynamo: 13, action: 'action', effect: 'Dexterity save vs 6d8 piercing damage in 30 feet, plus 3d8 slashing damage within 5 feet' },
        prompt: 'Thrill Seeker Hellish Burst (13 Dynamo, action): creatures in 30 feet make a Dexterity save or take 6d8 piercing damage, plus 3d8 slashing damage within 5 feet.',
        engine: 'DM-prompt in this batch.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'virtuoso',
    name: 'Virtuoso',
    description: 'A spellshot-artiste who turns every gunfight into a performance in four acts. Your shots build toward a devastating finale, your captivated audiences erupt in force, and at your peak you fire four perfect shots in a single curtain call.',
    class: 'spellshot',
    source: 'Spellshot v0.5 (homebrew, LucaWhiteWing)',
    sourceTier: 'homebrew',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'an_artistes_mind', name: "An Artiste's Mind", level: 3, kind: 'E',
        mechanics: { proficiencies: ['one musical instrument', 'disguise kit or calligrapher\'s tools (choice)'] },
        prompt: "Virtuoso An Artiste's Mind: you gain proficiency with a musical instrument and with either a disguise kit or calligrapher's tools.",
        engine: 'DM-prompt in this batch; the kit/tools choice is not stored as a choice here (tool proficiency, no registry field).',
        gateCheck: true,
      },
      {
        key: 'death_in_four_acts', name: 'Death in Four Acts', level: 3, kind: 'B',
        mechanics: { effect: 'gain Act points on firearm attacks; at 3 Act points, your next weapon attack gains your Intelligence bonus, an extended critical range by your Intelligence modifier, 1s do not auto-miss, no misfire, and doubled Dynamo gain' },
        prompt: 'Virtuoso Death in Four Acts: firearm attacks build Act points; at 3 Act points your next weapon attack adds your Intelligence bonus, extends its critical range by your Intelligence modifier, cannot auto-miss on a 1, cannot misfire, and gains double Dynamo.',
        engine: 'DM-prompt in this batch; Act-point tracking is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'captivate_the_public', name: 'Captivate the Public', level: 7, kind: 'B',
        mechanics: { action: 'bonus action', range: 'point within 60 feet', effect: 'at the start of your next turn, 4d4 force damage plus a Wisdom save or be charmed', uses: 'Intelligence modifier per long rest, or 4 Dynamo once uses are exhausted' },
        prompt: 'Virtuoso Captivate the Public (bonus action, point within 60 feet, uses equal Intelligence modifier per long rest or 4 Dynamo when exhausted): at the start of your next turn the point erupts for 4d4 force damage, and creatures there make a Wisdom save or be charmed.',
        engine: 'DM-prompt in this batch.',
        gateCheck: true,
      },
      {
        key: 'last_whisper', name: 'Last Whisper', level: 10, kind: 'B',
        mechanics: { trigger: 'reaction when a Worthy creature drops to 0 hit points within 30 feet', effect: 'gain 4 Dynamo and set Act points to 3', uses: 'Intelligence modifier per short or long rest' },
        prompt: 'Virtuoso Last Whisper (reaction, Worthy creature drops to 0 within 30 feet, uses equal Intelligence modifier per short or long rest): gain 4 Dynamo and set Act points to 3.',
        engine: 'DM-prompt in this batch.',
        gateCheck: true,
      },
      {
        key: 'curtain_call', name: 'Curtain Call', level: 15, kind: 'B',
        mechanics: { costDynamo: 13, action: 'action', effect: 'four ranged attacks at 60/180 feet, 4d4 + Dexterity piercing each, +4d4 per subsequent hit, last hit may become a critical hit', uses: '1 per short or long rest' },
        prompt: 'Virtuoso Curtain Call (13 Dynamo, action, 1/short-or-long rest): make four ranged attacks at 60/180 feet, each dealing 4d4 + Dexterity piercing, +4d4 per subsequent hit; the last hit may become a critical hit.',
        engine: 'DM-prompt in this batch.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
  {
    key: 'wildcard',
    name: 'Wildcard',
    description: 'A spellshot who gambles on every misfire — and usually wins. You roll twice on every misfire, turn misses into hits, and at your peak you unleash a storm of wild spells from the table itself.',
    class: 'spellshot',
    source: 'Spellshot v0.5 (homebrew, LucaWhiteWing)',
    sourceTier: 'homebrew',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'caution_to_the_wind', name: 'Caution to the Wind!', level: 3, kind: 'E',
        mechanics: { effects: ['on a misfire, roll 2d20 and choose the result', 'spend 2 Dynamo to purposely misfire a ranged firearm attack'] },
        prompt: 'Wildcard Caution to the Wind!: on a misfire roll 2d20 and choose the result; you may spend 2 Dynamo to purposely misfire a ranged firearm attack.',
        engine: 'DM-prompt in this batch; misfire-table resolution is a named follow-up.',
        gateCheck: true,
      },
      {
        key: 'make_it_work', name: 'Make it Work!', level: 7, kind: 'B',
        mechanics: { effects: ['gain 1 Dynamo on a misfire', 'may turn a misfire miss into a hit'], uses: 'Intelligence modifier per short or long rest' },
        prompt: 'Wildcard Make it Work! (uses equal Intelligence modifier per short or long rest): gain 1 Dynamo on a misfire, and you may turn a misfire miss into a hit.',
        engine: 'DM-prompt in this batch.',
        gateCheck: true,
      },
      {
        key: 'get_it_together', name: 'Get it Together!', level: 10, kind: 'E',
        mechanics: { effect: 'on a misfire, roll 3d20 and choose up to two results' },
        prompt: 'Wildcard Get it Together!: on a misfire roll 3d20 and choose up to two results.',
        engine: 'DM-prompt in this batch.',
        gateCheck: true,
      },
      {
        key: 'all_the_nines_break_loose', name: 'All the Nines Break Loose!', level: 15, kind: 'B',
        mechanics: { costDynamo: 13, action: 'action', effect: 'roll 3d20 and cast the spells on the d20 table at their lowest level, regaining Dynamo per Spell Battery', d20Table: ['Fire Bolt', 'Ray of Frost', 'Thunderclap', 'Burning Hands', 'Color Spray', 'Magic Missile', 'Thunderwave', 'Witch Bolt', 'Sleep', 'Guiding Bolt', "Melf's Acid Arrow", 'Misty Step', 'Scorching Ray', 'Shatter', 'Dispel Magic', 'Fireball', 'Lightning Bolt', 'Blight', 'Ice Storm', 'Cone of Cold'] },
        prompt: 'Wildcard All the Nines Break Loose! (13 Dynamo, action): roll 3d20 and cast the spells on the Wildcard d20 table at their lowest level, regaining Dynamo per Spell Battery.',
        engine: 'DM-prompt in this batch; the d20 table spells are recorded in mechanics.d20Table (digest-verbatim order, 1-20). Note: several table spells (Fire Bolt, Guiding Bolt, Misty Step, Dispel Magic, etc.) are NOT on the Spellshot spell list — the feature grants them for this roll only; do not add them to the class list.',
        gateCheck: true,
      },
    ],
    choices: [],
  },
];
