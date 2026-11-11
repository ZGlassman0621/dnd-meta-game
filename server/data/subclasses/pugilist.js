/**
 * Pugilist subclasses — Fight Clubs (Sterling Vermin, 2016-2018,
 * 2014-era). Transcribed ONLY from the verified digest at
 * ~/workspace/dnd-app-review/new-classes-staging/digests/pugilist.md.
 *
 * Selection level 3; club features at 3rd, 6th, 11th, 17th.
 * The digest's club list is 6 clubs. The pre-existing client
 * classes.json pugilist entry lists a 7th club, "Hand of Dread,"
 * which does NOT appear in the digest — it is NOT carried here
 * and NOT carried in the pugilist client fragment. The coordinator
 * must resolve that discrepancy (digest vs client stub) before
 * merge; this file does not invent a Hand of Dread entry.
 *
 * Origin: same setting-neutral note as magus.js — the digest
 * names no setting for Sterling Vermin material, so entries carry
 * origin_setting 'Sterling Vermin (setting-neutral)' and are
 * flagged by the existing validator as requiring an origin
 * explanation until the coordinator rules otherwise. Do NOT
 * silently flip this to 'Forgotten Realms' at merge.
 *
 * UNRESOLVED, carried forward (digest §UNRESOLVED):
 * - General moxie-feature progression beyond the 3 starters is
 *   not enumerated (only the Squared Circle's 3 club additions
 *   appear). Only starters + club additions are wired.
 * - Moxie maxima for odd levels (incl. 3rd, 19th) are not in the
 *   digest's listed values; see pugilistService.js.
 * Every feature below is gateCheck: true — 2014-era numbers need
 * Zach's gate, and no 2024 conversion is applied (see
 * conversions-pugilist.md: none — as written).
 *
 * Companion note: Dog & Hound's hound is modeled in prose here
 * (wolf statistics + Brawler's Best Friend modifications, dire
 * wolf statistics at 17th except size stays Medium). No entity
 * row is created by this registry file — companion-entity wiring
 * is a named follow-up, not something this file pretends to do.
 */

export const PUGILIST_SUBCLASSES = [
  {
    key: 'arena_royale',
    name: 'Arena Royale',
    description: 'A pugilist who fights as a larger-than-life persona, working the crowd into adoration or fear. Your persona spends points in place of moxie, the crowd bends to your will, and at your peak your signature move leaps, crits, and stuns.',
    class: 'pugilist',
    source: 'Sterling Vermin — Pugilist (DMs Guild, 2016–2018)',
    sourceTier: 'scanned',
    origin_setting: 'Sterling Vermin (setting-neutral)',
    origin_region: 'Sterling Vermin (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'persona_libre',
        name: 'Persona Libre',
        level: 3,
        kind: 'B',
        mechanics: {
          bonusProficiency: 'Performance, or Intimidation/Persuasion if already proficient in Performance.',
          persona: 'Create an alternate persona, adoptable or discardable as a bonus action.',
          personaPoints: '3 + Charisma modifier, minimum 1; spendable in place of moxie points and, before a Charisma check, to add your Strength modifier; only while the persona is adopted; regain on a long rest.',
        },
        prompt: 'Persona Libre: bonus proficiency Performance (or Intimidation/Persuasion if already proficient). Adopt or discard an alternate persona as a bonus action. Persona points (3 + Charisma modifier, min 1) may be spent in place of moxie points, and before a Charisma check to add Strength modifier — only while the persona is adopted; regain on a long rest.',
        engine: 'pugilistService.personaPointsMax / spendPersonaPoint (pure math + state); adoption itself is DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'work_the_crowd',
        name: 'Work the Crowd',
        level: 6,
        kind: 'E',
        mechanics: {
          action: 'While the persona is adopted: creatures within 30 feet who can see you make a Wisdom saving throw (DC 8 + proficiency bonus + Strength modifier) or be charmed (adoration) or frightened (fear) for 1 minute, repeatable on taking damage from you or your allies; 1/long rest.',
        },
        prompt: 'Work the Crowd: action while the persona is adopted — creatures within 30 feet who can see you save Wisdom (DC 8 + proficiency + Strength) or be charmed (adoration) or frightened (fear) for 1 minute, repeating the save on taking damage from you or allies; 1/long rest.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'high_flyer',
        name: 'High Flyer',
        level: 11,
        kind: 'E',
        mechanics: {
          speedBonus: 10,
          jumpDistanceDoubled: true,
          bonusActionDash: true,
        },
        prompt: 'High Flyer: base movement +10 feet, jump distance doubled, Dash as a bonus action.',
        engine: 'DM-prompt only in v1 (movement engine hook is a named follow-up).',
        gateCheck: true,
      },
      {
        key: 'signature_move',
        name: 'Signature Move',
        level: 17,
        kind: 'E',
        mechanics: {
          replaceAttack: 'Replace one unarmed strike or pugilist weapon attack: jump up to your movement speed in any direction, attack with advantage; on a hit it is a critical hit and the target is stunned until the end of your next turn.',
          recovery: 'On a hit: 1/long rest. On a miss: regained after 1 minute.',
        },
        prompt: 'Signature Move: replace one unarmed/pugilist weapon attack — jump up to your movement speed in any direction, attack with advantage; on a hit it is a critical and the target is stunned until the end of your next turn. On a hit: 1/long rest; on a miss: regained after 1 minute.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'bloodhound_bruisers',
    name: 'Bloodhound Bruisers',
    description: 'A pugilist detective who never stops watching and never misses a clue. You strike first, mark a suspect and never let go, know every settlement like home, and at your peak you see all — truesight and immunity to blindness and deafness.',
    class: 'pugilist',
    source: 'Sterling Vermin — Pugilist (DMs Guild, 2016–2018)',
    sourceTier: 'scanned',
    origin_setting: 'Sterling Vermin (setting-neutral)',
    origin_region: 'Sterling Vermin (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'ever_vigilant',
        name: 'Ever Vigilant',
        level: 3,
        kind: 'E',
        mechanics: {
          advantageOnInitiative: true,
          advantageVsNotYetActed: 'Advantage on attacks against creatures that have not acted yet during the first round.',
          detectiveWork: 'Proficiency in two of Insight, Investigation, Perception; spend 1 moxie for advantage on an Intelligence (Investigation), Wisdom (Insight), or Wisdom (Perception) check.',
        },
        prompt: 'Ever Vigilant: advantage on initiative; advantage on attacks vs creatures that have not acted yet in the first round. Detective Work: proficiency in two of Insight, Investigation, Perception; spend 1 moxie for advantage on an Intelligence (Investigation), Wisdom (Insight), or Wisdom (Perception) check.',
        engine: 'DM-prompt only in v1 (moxie spend via pugilistService.spendMoxie).',
        gateCheck: true,
      },
      {
        key: 'scrap_like_a_sleuth',
        name: 'Scrap Like a Sleuth',
        level: 6,
        kind: 'E',
        mechanics: {
          cost: 'Bonus action, 2 moxie: target a visible enemy within 30 feet.',
          effect: 'For 1 minute you have advantage on weapon attacks against it and add your proficiency bonus to AC against its attacks, or until you reuse this feature.',
        },
        prompt: 'Scrap Like a Sleuth: bonus action, 2 moxie, visible enemy within 30 feet — for 1 minute you have advantage on weapon attacks vs it and add proficiency bonus to AC vs its attacks, or until reused.',
        engine: 'DM-prompt only in v1 (moxie spend via pugilistService.spendMoxie).',
        gateCheck: true,
      },
      {
        key: 'heart_of_the_city',
        name: 'Heart of the City',
        level: 11,
        kind: 'E',
        mechanics: {
          familiarSettlement: 'On a long rest in a settlement, make it your familiar settlement, replacing the previous one.',
          benefits: "Cannot be surprised; add proficiency bonus to initiative; darkvision 120 feet; double proficiency bonus on Insight/Investigation/Perception checks that add proficiency; cannot be lost by any means; travel between two points in the settlement twice as fast outside combat.",
        },
        prompt: 'Heart of the City: on a long rest in a settlement, it becomes your familiar settlement (replacing the previous). There you cannot be surprised, add proficiency bonus to initiative, gain darkvision 120 feet, double proficiency bonus on Insight/Investigation/Perception checks that add proficiency, cannot be lost by any means, and travel between two points twice as fast outside combat.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'eyes_wide_open',
        name: 'Eyes Wide Open',
        level: 17,
        kind: 'E',
        mechanics: {
          cost: 'Bonus action, 1 moxie.',
          effect: 'For 1 minute: advantage on saving throws against being blinded or deafened, and truesight 30 feet.',
        },
        prompt: 'Eyes Wide Open: bonus action, 1 moxie — for 1 minute, advantage on saves vs blinded/deafened and truesight 30 feet.',
        engine: 'DM-prompt only in v1 (moxie spend via pugilistService.spendMoxie).',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'dog_and_hound',
    name: 'Dog & Hound',
    description: 'A pugilist who fights beside a loyal hound, the two of you a single pack. Your hound strikes with magic, attacks when you do, and at your peak it grows into a dire wolf that still fights at your side.',
    class: 'pugilist',
    source: 'Sterling Vermin — Pugilist (DMs Guild, 2016–2018)',
    sourceTier: 'scanned',
    origin_setting: 'Sterling Vermin (setting-neutral)',
    origin_region: 'Sterling Vermin (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'brawlers_best_friend',
        name: "Brawler's Best Friend",
        level: 3,
        kind: 'E',
        mechanics: {
          bonusProficiency: 'Animal Handling, or Perception/Survival if already proficient.',
          hound: 'Gain a hound using wolf statistics; add your proficiency bonus to its AC, saving throws, attack rolls, and damage rolls; +1d8 hit die per level after 3rd.',
          command: 'Bonus-action verbal command for Attack, Dash, Disengage, Dodge, or Help; the hound acts on its own if you are incapacitated or absent.',
          replacement: 'Replaceable by spending 8 hours bonding with a non-hostile canine.',
          muttWithMoxie: 'Brace Up temporary hit points are shared with the hound; The Old One-Two attacks may be made by the hound instead; Stick and Move lets the hound Dash.',
        },
        prompt: 'Brawler\'s Best Friend: bonus proficiency Animal Handling (or Perception/Survival if already proficient). Your hound uses wolf statistics, adds your proficiency bonus to AC, saves, attack and damage rolls, and gains +1d8 hit die per level after 3rd. Command it with a bonus-action verbal command (Attack/Dash/Disengage/Dodge/Help); it acts alone if you are incapacitated or absent. Mutt With Moxie: Brace Up temp HP is shared with the hound, The Old One-Two attacks may be made by the hound, and Stick and Move lets the hound Dash.',
        engine: 'DM-prompt only in v1 — no hound entity row is created by this registry file (named follow-up).',
        gateCheck: true,
      },
      {
        key: 'arcanine_bite',
        name: 'Arcanine Bite',
        level: 6,
        kind: 'E',
        mechanics: {
          houndAttacksMagical: true,
          coordinatedAttack: 'When you take the Attack action, if the hound can see you it may use its reaction to make a melee attack.',
        },
        prompt: 'Arcanine Bite: the hound\'s attacks count as magical. Coordinated Attack: when you take the Attack action, if the hound can see you it may use its reaction to make a melee attack.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'hounds_best_friend',
        name: "Hound's Best Friend",
        level: 11,
        kind: 'E',
        mechanics: {
          reaction: 'When a creature damages your hound with an attack, make an opportunity attack against that creature if it is in range.',
        },
        prompt: 'Hound\'s Best Friend: reaction — when a creature damages your hound with an attack, make an opportunity attack against it if in range.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'dire_hound',
        name: 'Dire Hound',
        level: 17,
        kind: 'E',
        mechanics: {
          houndStatistics: 'The hound uses dire wolf statistics instead of wolf statistics, except its size remains Medium, with the Brawler\'s Best Friend modifications.',
        },
        prompt: 'Dire Hound: your hound uses dire wolf statistics instead of wolf statistics, except its size remains Medium, with all Brawler\'s Best Friend modifications.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'piss_and_vinegar',
    name: 'Piss & Vinegar',
    description: 'A pugilist of insults, cheap shots, and pure spite. Your taunts wound and provoke, your dirty tricks steal moxie and slow foes, and at your peak your salute can provoke a whole crowd at once.',
    class: 'pugilist',
    source: 'Sterling Vermin — Pugilist (DMs Guild, 2016–2018)',
    sourceTier: 'scanned',
    origin_setting: 'Sterling Vermin (setting-neutral)',
    origin_region: 'Sterling Vermin (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'salty_salute',
        name: 'Salty Salute',
        level: 3,
        kind: 'E',
        mechanics: {
          bonusProficiency: 'Intimidation, if not already possessed.',
          saveDc: '8 + proficiency bonus + Charisma modifier.',
          effect: 'Bonus action: provoke a creature within 60 feet who can see or hear you; on a failed Wisdom saving throw it takes Fisticuffs die + Charisma modifier psychic damage and has disadvantage on attacks not including you until the start of your next turn.',
        },
        prompt: 'Salty Salute: bonus proficiency Intimidation (if not already possessed). Bonus action: provoke a creature within 60 feet who can see/hear you — Wisdom save (DC 8 + proficiency + Charisma) or take Fisticuffs die + Charisma modifier psychic damage and disadvantage on attacks not including you until the start of your next turn.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'dirty_tricks',
        name: 'Dirty Tricks',
        level: 6,
        kind: 'E',
        mechanics: {
          recovery: 'Each trick usable once, regained on a short or long rest.',
          heelstomper: 'On dealing unarmed damage: Dexterity saving throw or gain 1 moxie (up to max) and the target speed is halved for 1 minute.',
          lowBlow: 'On dealing unarmed damage: Strength saving throw or gain 1 moxie (up to max) and the target is knocked prone.',
          pocketSand: 'Bonus action against a creature within 5 feet: Constitution saving throw or gain 1 moxie (up to max) and the target is blinded until the end of its next turn.',
        },
        prompt: 'Dirty Tricks (each once, regained on a short/long rest): Heelstomper — on unarmed damage, Dexterity save or gain 1 moxie (up to max) and halve target speed for 1 minute. Low Blow — on unarmed damage, Strength save or gain 1 moxie and knock the target prone. Pocket Sand — bonus action vs a creature within 5 feet, Constitution save or gain 1 moxie and blind it until the end of its next turn.',
        engine: 'DM-prompt only in v1 (moxie gain via pugilistService.gainMoxie).',
        gateCheck: true,
      },
      {
        key: 'mean_old_cuss',
        name: 'Mean Old Cuss',
        level: 11,
        kind: 'E',
        mechanics: {
          intimidationAdvantage: 'Reaction + 1 moxie for advantage on a Charisma (Intimidation) check.',
          saveDisadvantage: 'Reaction + 1 moxie to impose disadvantage on a creature saving throw against your Piss & Vinegar features.',
        },
        prompt: 'Mean Old Cuss: reaction + 1 moxie for advantage on a Charisma (Intimidation) check, or reaction + 1 moxie to impose disadvantage on a creature\'s save against your Piss & Vinegar features.',
        engine: 'DM-prompt only in v1 (moxie spend via pugilistService.spendMoxie).',
        gateCheck: true,
      },
      {
        key: 'the_uncouth_art',
        name: 'The Uncouth Art',
        level: 17,
        kind: 'E',
        mechanics: {
          multiTarget: 'Salty Salute may target up to your pugilist level in creatures within 60 feet.',
          moxieOnHit: 'Gain 1 moxie (up to max) the first time each targeted creature hits you before the start of your next turn.',
          recovery: '1/long rest.',
        },
        prompt: 'The Uncouth Art: Salty Salute may target up to your pugilist level in creatures within 60 feet; gain 1 moxie (up to max) the first time each targeted creature hits you before the start of your next turn; 1/long rest.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'squared_circle',
    name: 'The Squared Circle',
    description: 'A grappler who turns the ring into a weapon — locks, pins, and shields of living flesh. You hold foes fast, use them as cover, drag them at full speed, and at your peak your strikes against the grappled crit on nineteen.',
    class: 'pugilist',
    source: 'Sterling Vermin — Pugilist (DMs Guild, 2016–2018)',
    sourceTier: 'scanned',
    origin_setting: 'Sterling Vermin (setting-neutral)',
    origin_region: 'Sterling Vermin (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'groundwork',
        name: 'Groundwork',
        level: 3,
        kind: 'B',
        mechanics: {
          moxieFeatures: [
            'Compression Lock — reaction + 1 moxie when a creature breaks your grapple successfully, forcing a reroll with the second result.',
            'Quick Pin — reaction + 1 moxie when a hostile creature movement provokes an opportunity attack, make a grapple attack instead.',
            'To the Mat — bonus action + 1 moxie, grapple attack against a creature in range, knocked prone on success.',
          ],
        },
        prompt: 'Groundwork: three additional moxie features — Compression Lock (reaction + 1 moxie when a creature breaks your grapple, forcing a reroll), Quick Pin (reaction + 1 moxie when hostile movement provokes an opportunity attack, grapple instead), To the Mat (bonus action + 1 moxie, grapple attack vs a creature in range, prone on success).',
        engine: 'pugilistService.moxieFeaturesFor (club additions); spends via spendMoxie.',
        gateCheck: true,
      },
      {
        key: 'meat_shield',
        name: 'Meat Shield',
        level: 6,
        kind: 'E',
        mechanics: {
          cover: 'While grappling an enemy, half cover against attacks from creatures you are not grappling.',
          redirect: 'Reaction + 1 moxie when such an attack misses: the attacker rerolls the attack against the grappled creature.',
        },
        prompt: 'Meat Shield: while grappling an enemy, half cover vs attacks from creatures you are not grappling; reaction + 1 moxie when such an attack misses — the attacker rerolls against the grappled creature.',
        engine: 'DM-prompt only in v1 (moxie spend via pugilistService.spendMoxie).',
        gateCheck: true,
      },
      {
        key: 'heavyweight',
        name: 'Heavyweight',
        level: 11,
        kind: 'E',
        mechanics: {
          grappleSize: 'Count as one size larger for grappling.',
          dragSpeed: 'Move at full speed while dragging or carrying a grappled creature of your size or smaller.',
        },
        prompt: 'Heavyweight: count as one size larger for grappling; move at full speed dragging/carrying a grappled creature your size or smaller.',
        engine: 'DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'clean_finish',
        name: 'Clean Finish',
        level: 17,
        kind: 'E',
        mechanics: {
          advantageVsGrappled: true,
          critThresholdVsGrappled: 19,
          scope: 'Unarmed strikes and pugilist weapon attacks against a grappled creature.',
        },
        prompt: 'Clean Finish: advantage on all attacks vs a grappled creature; unarmed strikes and pugilist weapon attacks vs a grappled creature score a critical hit on 19–20.',
        engine: 'DM-prompt only in v1 (crit-threshold hook is a named follow-up, cf. subclassService.critThresholdFor pattern).',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'sweet_science',
    name: 'The Sweet Science',
    description: 'A boxer of perfect counters and the perfect punch. You turn enemy blows aside and answer in the same breath, chain strikes into knockdowns, and at your peak a single blow can end a fight outright.',
    class: 'pugilist',
    source: 'Sterling Vermin — Pugilist (DMs Guild, 2016–2018)',
    sourceTier: 'scanned',
    origin_setting: 'Sterling Vermin (setting-neutral)',
    origin_region: 'Sterling Vermin (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'cross_counter',
        name: 'Cross Counter',
        level: 3,
        kind: 'E',
        mechanics: {
          cost: 'Reaction + 2 moxie.',
          reduction: 'Reduce damage from a melee weapon attack by 1d10 + Strength modifier + pugilist level.',
          counterattack: 'If the damage is reduced to 0, make an unarmed strike or pugilist weapon attack against a creature in range as part of the same reaction.',
        },
        prompt: 'Cross Counter: reaction + 2 moxie — reduce damage from a melee weapon attack by 1d10 + Strength modifier + pugilist level; if reduced to 0, make an unarmed/pugilist weapon attack vs a creature in range as part of the same reaction.',
        engine: 'DM-prompt only in v1 (moxie spend via pugilistService.spendMoxie).',
        gateCheck: true,
      },
      {
        key: 'one_two_three_floor',
        name: 'One, Two, Three, Floor',
        level: 6,
        kind: 'E',
        mechanics: {
          trigger: 'When using the bonus-action Old One-Two and hitting the same creature with both attacks.',
          effect: 'Spend 1 moxie for an additional unarmed strike as part of the same bonus action; on a hit, the target is knocked prone as well.',
        },
        prompt: 'One, Two, Three, Floor: when your bonus-action Old One-Two hits the same creature with both attacks, spend 1 moxie for an additional unarmed strike in the same bonus action; on a hit the target is also knocked prone.',
        engine: 'DM-prompt only in v1 (moxie spend via pugilistService.spendMoxie).',
        gateCheck: true,
      },
      {
        key: 'float_like_a_butterfly',
        name: 'Float Like a Butterfly, Sting Like a Bee',
        level: 11,
        kind: 'E',
        mechanics: {
          moxieRefund: 'When you reduce damage to 0 and hit with Cross Counter, regain 1 moxie, up to your maximum.',
        },
        prompt: 'Float Like a Butterfly, Sting Like a Bee: when you reduce damage to 0 and hit with Cross Counter, regain 1 moxie (up to max).',
        engine: 'DM-prompt only in v1 (moxie gain via pugilistService.gainMoxie).',
        gateCheck: true,
      },
      {
        key: 'knock_out',
        name: 'Knock Out',
        level: 17,
        kind: 'E',
        mechanics: {
          cost: 'On hitting with an unarmed strike or pugilist weapon, spend 1 or more moxie instead of dealing damage.',
          roll: '3d12 + 2d12 per moxie beyond the first + pugilist level.',
          effect: 'If the total is equal to or greater than the creature remaining hit points, it is unconscious for 10 minutes.',
        },
        prompt: 'Knock Out: on hitting with an unarmed/pugilist weapon, spend 1+ moxie instead of dealing damage — roll 3d12 + 2d12 per moxie beyond the first + pugilist level; if the total meets or beats the creature\'s remaining HP, it is unconscious for 10 minutes.',
        engine: 'DM-prompt only in v1 (moxie spend via pugilistService.spendMoxie).',
        gateCheck: true,
      },
    ],
  },
];
