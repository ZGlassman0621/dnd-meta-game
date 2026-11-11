/**
 * Blackguard Vices — digest-only registry entries.
 *
 * Source: ~/workspace/dnd-app-review/new-classes-staging/digests/blackguard.md
 * (Libris Mortis 5e Conversion, Ch. 5). STANDALONE FULL CLASS — this file holds
 * its 5 Vices as ITS subclasses; it is NOT a paladin subclass file, and no entry
 * here may be filed under paladin.
 *
 * Vice features at 3rd, 7th, 15th, 20th (including vice spells + Channel Divinity
 * at 3rd). Vice spell NAMES are referenced from the digest; the spell entries
 * themselves are another agent's catalog work (class key "Blackguard").
 *
 * gateCheckRequired is true on EVERY entry here, and gateCheck true on every
 * feature, because: (a) Dark Blessing text is unlocated; (b) several
 * Despair/Pride/Treachery feature bodies are two-column interleaved in the
 * extract (digest UNRESOLVED 3) — names, levels, and headline effects below are
 * confirmed, full mechanical detail must be re-read from the PDF before build;
 * (c) Domination/Fury "same features" mapping was unresolved (UNRESOLVED 2).
 * RESOLVED FOR SPELLS by coordinator ruling 2026-11-06 (item 25): Domination =
 * Oath of Conquest spells, Fury = Oath of Vengeance spells, at OATH tiers
 * (3/5/9/13/17), copied from the in-repo paladin.js lists — "same features"
 * plus the other three vices' structure. Whether "same features" also includes
 * the oath Channel Divinity options, and how they map onto the Vice
 * 3rd/7th/15th/20th pattern, is STILL UNRESOLVED (see the mapping notes on
 * the two oath-features entries). No feature body below invents detail the digest does not confirm; where the
 * digest gives only a headline, the mechanics field says so explicitly.
 *
 * NAME-COLLISION GUARD: Despair's 20th feature key is despair_dread_lord —
 * NEVER a bare dread_lord key, which would collide with the Chapter 6 warlock
 * patron "The Dread Lord" (a different thing entirely).
 *
 * origin_setting / origin_region are null: the digest states NO setting for the
 * Blackguard. Coordinator must decide how validateSelection treats null
 * (recommendation: FR-neutral) before these entries gate. sourceTier
 * 'fan-conversion' is this batch's label; no existing tier vocabulary for it
 * was found in the survey — coordinator to confirm.
 */

export const BLACKGUARD_SUBCLASSES = [
  {
    key: 'despair',
    name: 'Vice of Despair',
    description: 'A blackguard of hopelessness whose cold smites and dark channeling break the living and command the dead. You control undead, burst with necrotic energy, endure poison and exhaustion, and at your peak you surround yourself with an aura of gloom and send shadows to attack.',
    class: 'blackguard',
    source: 'Libris Mortis 5e Conversion, Ch. 5',
    sourceTier: 'fan-conversion',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'despair_vice_spells', name: 'Vice Spells (Despair)', level: 3, kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['bane', 'inflict wounds'], 5: ['darkness', 'ray of enfeeblement'], 9: ['animate dead', 'bestow curse'], 13: ['blight', 'phantasmal killer'], 17: ['contagion', 'destructive wave'] }, note: 'vice spells are always prepared and do not count against spells prepared; a vice spell not on the blackguard list still counts as a blackguard spell' },
        prompt: 'Vice Spells (Despair, always prepared, not counted against prepared): 3rd bane, inflict wounds; 5th darkness, ray of enfeeblement; 9th animate dead, bestow curse; 13th blight, phantasmal killer; 17th contagion, destructive wave.',
        engine: 'blackguardService.validatePreparedSpells (always-prepared subtraction); spell entries are catalog work.',
        gateCheck: true,
      },
      {
        key: 'despair_dread_smite_type', name: 'Dread Smite (Cold)', level: 3, kind: 'A',
        mechanics: { damageType: 'cold', note: 'from 3rd, Dread Smite damage type becomes cold for this Vice' },
        prompt: 'Dread Smite (Despair): your Dread Smite damage type is cold.',
        engine: 'blackguardService.dreadSmiteTypeForVice.',
        gateCheck: true,
      },
      {
        key: 'control_undead', name: 'Control Undead', level: 3, kind: 'B',
        mechanics: { channelDivinity: true, effect: 'action, target undead within 30 feet, must obey for 24 hours or until reused; undead with CR equal to or greater than blackguard level immune' },
        prompt: 'Channel Divinity — Control Undead: action, target an undead within 30 feet; it must obey you for 24 hours or until you reuse this option. Undead with CR equal to or greater than your blackguard level are immune.',
        engine: 'blackguardService.useChannelDivinity (1/short-or-long rest); targeting is DM adjudicated.',
        gateCheck: true,
      },
      {
        key: 'disrupt_life', name: 'Disrupt Life', level: 3, kind: 'B',
        mechanics: { channelDivinity: true, headline: 'burst of negative energy: living creatures take 2d10 + blackguard level necrotic on a failed save, half on success', fullText: 'INTERLEAVED IN EXTRACT — full targeting text NOT confirmed in digest; re-read from PDF before build (digest UNRESOLVED 3)' },
        prompt: 'Channel Divinity — Disrupt Life: burst of negative energy; living creatures take 2d10 + blackguard level necrotic on a failed save, half on success. FULL TARGETING TEXT UNCONFIRMED (interleaved extract) — re-read from the PDF before use.',
        engine: 'blackguardService.useChannelDivinity; full targeting is a gate-check item, not engine data.',
        gateCheck: true,
      },
      {
        key: 'aura_of_despair', name: 'Aura of Despair', level: 7, kind: 'E',
        mechanics: { headline: 'aura of hopelessness/sorrow; hostile creatures affected as printed', range: '10 feet, 30 feet at 18th', fullText: 'INTERLEAVED IN EXTRACT — full detail NOT confirmed in digest; re-read from PDF before build (digest UNRESOLVED 3)' },
        prompt: 'Aura of Despair: an aura of hopelessness and sorrow (10 feet, 30 feet at 18th); hostile creatures are affected as printed. FULL DETAIL UNCONFIRMED (interleaved extract) — re-read from the PDF before use.',
        engine: 'DM-prompt only in Tier 0; full detail is a gate-check item.',
        gateCheck: true,
      },
      {
        key: 'unliving_fortitude', name: 'Unliving Fortitude', level: 15, kind: 'E',
        mechanics: { resistances: ['necrotic', 'poison'], advantageOnSaves: ['exhaustion', 'poisoned'] },
        prompt: 'Unliving Fortitude: resistance to necrotic and poison damage; advantage on saving throws against exhaustion and the poisoned condition.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'despair_dread_lord', name: 'Dread Lord', level: 20, kind: 'B',
        mechanics: { uses: '1/long rest', headline: 'action: surround yourself with an aura of gloom for 1 minute; bonus action on your turn to make shadows attack one creature for 3d10 + Charisma modifier necrotic', fullText: 'INTERLEAVED IN EXTRACT — full detail NOT confirmed in digest; re-read from PDF before build (digest UNRESOLVED 3)', note: 'NOT the Chapter 6 warlock patron "The Dread Lord" — distinct feature, distinct key' },
        prompt: 'Dread Lord (Vice of Despair capstone — NOT the warlock patron of the same name): 1/long rest, action — surround yourself with an aura of gloom for 1 minute; bonus action on your turn to make shadows attack one creature for 3d10 + Charisma modifier necrotic. FULL DETAIL UNCONFIRMED (interleaved extract) — re-read from the PDF before use.',
        engine: 'DM-prompt only in Tier 0; full detail is a gate-check item.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'domination',
    name: 'Vice of Domination',
    description: 'A blackguard who rules through the Oath of Conquest\'s features without swearing its oath, your smites striking with psychic force. Your always-prepared spells — Command, Hold Person, Dominate Beast, Dominate Person — bind enemy after enemy to your will.',
    class: 'blackguard',
    source: 'Libris Mortis 5e Conversion, Ch. 5',
    sourceTier: 'fan-conversion',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'domination_vice_spells', name: 'Vice Spells (Domination)', level: 3, kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['Armor of Agathys', 'Command'], 5: ['Hold Person', 'Spiritual Weapon'], 9: ['Bestow Curse', 'Fear'], 13: ['Dominate Beast', 'Stoneskin'], 17: ['Cloudkill', 'Dominate Person'] }, note: 'vice spells are always prepared and do not count against spells prepared; a vice spell not on the blackguard list still counts as a blackguard spell. List = Oath of Conquest spells at oath tiers (3/5/9/13/17), copied from the in-repo paladin.js Oath of Conquest entry — coordinator ruling 2026-11-06 (item 25). Spell names are Title Case as in paladin.js; the other three vices use lowercase in this file, and the validator does exact matching, so the server worker\'s spell-name canonicalization (item 13) must normalize both sides.' },
        prompt: 'Vice Spells (Domination, always prepared, not counted against prepared): 3rd Armor of Agathys, Command; 5th Hold Person, Spiritual Weapon; 9th Bestow Curse, Fear; 13th Dominate Beast, Stoneskin; 17th Cloudkill, Dominate Person.',
        engine: 'blackguardService.validatePreparedSpells (always-prepared subtraction); spell entries are catalog work.',
        gateCheck: true,
      },
      {
        key: 'domination_oath_features', name: 'Oath of Conquest Features', level: 3, kind: 'E',
        mechanics: { asPrinted: 'Blackguards of the Vice of Domination gain the same features as paladins of the Oath of Conquest (XGE p. 37), without following any tenets associated with that oath, drawing strength from negative emotions instead', mapping: 'SPELL MAPPING RESOLVED by coordinator ruling 2026-11-06 (item 25): "same features" includes the Oath of Conquest spell list at oath tiers (3/5/9/13/17) — see the Vice Spells (Domination) feature in this entry. CHANNEL DIVINITY MAPPING STILL UNRESOLVED: whether "same features" includes the Conquest Channel Divinity options, and how they map onto the Vice 3rd/7th/15th/20th pattern, is NOT spelled out in the extract — build step must decide from the source PDF + XGE text, not from this digest', dreadSmiteType: 'psychic' },
        prompt: 'Vice of Domination: you gain the same features as paladins of the Oath of Conquest (XGE p. 37), without following that oath\'s tenets; your Dread Smite damage type is psychic. SPELL MAPPING RESOLVED (ruling 2026-11-06): the Conquest oath spells are your Vice Spells at oath tiers — see Vice Spells (Domination). Channel Divinity mapping is still unresolved — decide from the source PDF + XGE at build, do not guess.',
        engine: 'blackguardService.blackguardViceSpellsAtLevel (cumulative) for the spells; Channel Divinity mapping still unresolved — no engine mapping is fabricated for it.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'fury',
    name: 'Vice of Fury',
    description: 'A blackguard who fights with the Oath of Vengeance\'s features without swearing its oath, your smites striking with thunder. Your always-prepared spells — Hunter\'s Mark, Misty Step, Haste, Banishment, Hold Monster — hunt, chase, and pin your prey.',
    class: 'blackguard',
    source: 'Libris Mortis 5e Conversion, Ch. 5',
    sourceTier: 'fan-conversion',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'fury_vice_spells', name: 'Vice Spells (Fury)', level: 3, kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['Bane', "Hunter's Mark"], 5: ['Hold Person', 'Misty Step'], 9: ['Haste', 'Protection from Energy'], 13: ['Banishment', 'Dimension Door'], 17: ['Hold Monster', 'Scrying'] }, note: 'vice spells are always prepared and do not count against spells prepared; a vice spell not on the blackguard list still counts as a blackguard spell. List = Oath of Vengeance spells at oath tiers (3/5/9/13/17), copied from the in-repo paladin.js Oath of Vengeance entry — coordinator ruling 2026-11-06 (item 25). Spell names are Title Case as in paladin.js; the other three vices use lowercase in this file, and the validator does exact matching, so the server worker\'s spell-name canonicalization (item 13) must normalize both sides.' },
        prompt: 'Vice Spells (Fury, always prepared, not counted against prepared): 3rd Bane, Hunter\'s Mark; 5th Hold Person, Misty Step; 9th Haste, Protection from Energy; 13th Banishment, Dimension Door; 17th Hold Monster, Scrying.',
        engine: 'blackguardService.validatePreparedSpells (always-prepared subtraction); spell entries are catalog work.',
        gateCheck: true,
      },
      {
        key: 'fury_oath_features', name: 'Oath of Vengeance Features', level: 3, kind: 'E',
        mechanics: { asPrinted: 'Blackguards of the Vice of Fury gain the same features as paladins of the Oath of Vengeance, without following any tenets associated with that paladin oath', mapping: 'SPELL MAPPING RESOLVED by coordinator ruling 2026-11-06 (item 25): "same features" includes the Oath of Vengeance spell list at oath tiers (3/5/9/13/17) — see the Vice Spells (Fury) feature in this entry. CHANNEL DIVINITY MAPPING STILL UNRESOLVED: whether "same features" includes the Vengeance Channel Divinity options, and how they map onto the Vice 3rd/7th/15th/20th pattern, is NOT spelled out in the extract — build step must decide from the source PDF at build, not from this digest', dreadSmiteType: 'thunder' },
        prompt: 'Vice of Fury: you gain the same features as paladins of the Oath of Vengeance, without following that oath\'s tenets; your Dread Smite damage type is thunder. SPELL MAPPING RESOLVED (ruling 2026-11-06): the Vengeance oath spells are your Vice Spells at oath tiers — see Vice Spells (Fury). Channel Divinity mapping is still unresolved — decide from the source PDF at build, do not guess.',
        engine: 'blackguardService.blackguardViceSpellsAtLevel (cumulative) for the spells; Channel Divinity mapping still unresolved — no engine mapping is fabricated for it.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'pride',
    name: 'Vice of Pride',
    description: 'A blackguard who wears salvation like a mask, your smites radiant and your words honeyed. You charm and compel, bathe foes in radiant light, and at your peak you transform with spectral wings, commanding the charmed to obey.',
    class: 'blackguard',
    source: 'Libris Mortis 5e Conversion, Ch. 5',
    sourceTier: 'fan-conversion',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'pride_vice_spells', name: 'Vice Spells (Pride)', level: 3, kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['charm person', 'cure wounds'], 5: ['detect thoughts', 'suggestion'], 9: ['beacon of hope', 'daylight'], 13: ['charm monster', 'compulsion'], 17: ['dominate person', 'geas'] }, note: 'vice spells are always prepared and do not count against spells prepared' },
        prompt: 'Vice Spells (Pride, always prepared, not counted against prepared): 3rd charm person, cure wounds; 5th detect thoughts, suggestion; 9th beacon of hope, daylight; 13th charm monster, compulsion; 17th dominate person, geas.',
        engine: 'blackguardService.validatePreparedSpells (always-prepared subtraction); spell entries are catalog work.',
        gateCheck: true,
      },
      {
        key: 'pride_dread_smite_type', name: 'Dread Smite (Radiant)', level: 3, kind: 'A',
        mechanics: { damageType: 'radiant', note: 'from 3rd, Dread Smite damage type becomes radiant for this Vice' },
        prompt: 'Dread Smite (Pride): your Dread Smite damage type is radiant.',
        engine: 'blackguardService.dreadSmiteTypeForVice.',
        gateCheck: true,
      },
      {
        key: 'honeyed_words', name: 'Honeyed Words', level: 3, kind: 'B',
        mechanics: { channelDivinity: true, effect: 'bonus action: +5 to Charisma (Deception) checks for 10 minutes' },
        prompt: 'Channel Divinity — Honeyed Words: bonus action, +5 to Charisma (Deception) checks for 10 minutes.',
        engine: 'blackguardService.useChannelDivinity (1/short-or-long rest).',
        gateCheck: true,
      },
      {
        key: 'radiance_of_the_savior', name: 'Radiance of the Savior', level: 3, kind: 'B',
        mechanics: { channelDivinity: true, headline: 'action, present holy symbol: harness sunlight, banish darkness, deal radiant damage to foes — 1d10 + blackguard level as printed in the damage line', fullText: 'INTERLEAVED IN EXTRACT — full detail NOT confirmed in digest; re-read from PDF before build (digest UNRESOLVED 3)' },
        prompt: 'Channel Divinity — Radiance of the Savior: action, present your holy symbol to harness sunlight, banish darkness, and deal radiant damage to foes (1d10 + blackguard level in the printed damage line). FULL DETAIL UNCONFIRMED (interleaved extract) — re-read from the PDF before use.',
        engine: 'blackguardService.useChannelDivinity; full detail is a gate-check item.',
        gateCheck: true,
      },
      {
        key: 'aura_of_false_divinity', name: 'Aura of False Divinity', level: 7, kind: 'E',
        mechanics: { headline: 'aura of awe-inspiring energy; creatures\' saves vs your blackguard spells and Vice features affected as printed', range: '10 feet, 30 feet at 18th', fullText: 'INTERLEAVED IN EXTRACT — full detail NOT confirmed in digest; re-read from PDF before build (digest UNRESOLVED 3)' },
        prompt: 'Aura of False Divinity: an aura of awe-inspiring energy (10 feet, 30 feet at 18th) affecting creatures\' saves against your blackguard spells and Vice features as printed. FULL DETAIL UNCONFIRMED (interleaved extract) — re-read from the PDF before use.',
        engine: 'DM-prompt only in Tier 0; full detail is a gate-check item.',
        gateCheck: true,
      },
      {
        key: 'self_importance', name: 'Self-Importance', level: 15, kind: 'E',
        mechanics: { headline: 'reaction when taking damage — full effect interleaved in extract', fullText: 'INTERLEAVED IN EXTRACT — full effect NOT confirmed in digest; re-read from PDF before build (digest UNRESOLVED 3)' },
        prompt: 'Self-Importance: reaction when taking damage (full effect interleaved in the extract — re-read from the PDF before use; nothing is guessed here).',
        engine: 'DM-prompt only in Tier 0; full detail is a gate-check item.',
        gateCheck: true,
      },
      {
        key: 'herald_of_salvation', name: 'Herald of Salvation', level: 20, kind: 'B',
        mechanics: { uses: '1/long rest', effect: 'action, transformation for 1 minute: spectral wings granting flight equal to walking speed, shed bright light 30 feet + dim light 30 feet beyond, creatures charmed by you follow verbal commands even if harmful or against moral integrity, creatures within 10 feet have disadvantage on Wisdom and Charisma saves vs your blackguard spells and Vice features' },
        prompt: 'Herald of Salvation: 1/long rest, action — transform for 1 minute: spectral wings (flight equal to walking speed), bright light 30 feet + dim light 30 feet beyond; creatures charmed by you follow verbal commands even if harmful or against moral integrity; creatures within 10 feet have disadvantage on Wisdom and Charisma saves against your blackguard spells and Vice features.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'treachery',
    name: 'Vice of Treachery',
    description: 'A blackguard of betrayal whose poisoned smites and shadowed tricks strike from nowhere. You turn invisible, poison blades with a touch, slip away the moment you are hit, and at your peak you become an avatar of deceit who turns your attacker\'s own blows against them.',
    class: 'blackguard',
    source: 'Libris Mortis 5e Conversion, Ch. 5',
    sourceTier: 'fan-conversion',
    origin_setting: null,
    origin_region: null,
    gateCheckRequired: true,
    features: [
      {
        key: 'treachery_vice_spells', name: 'Vice Spells (Treachery)', level: 3, kind: 'D',
        mechanics: { access: 'always prepared', alwaysPreparedByLevel: { 3: ['charm person', 'expeditious retreat'], 5: ['invisibility', 'mirror image'], 9: ['gaseous form', 'haste'], 13: ['confusion', 'greater invisibility'], 17: ['dominate person', 'passwall'] }, note: 'vice spells are always prepared and do not count against spells prepared' },
        prompt: 'Vice Spells (Treachery, always prepared, not counted against prepared): 3rd charm person, expeditious retreat; 5th invisibility, mirror image; 9th gaseous form, haste; 13th confusion, greater invisibility; 17th dominate person, passwall.',
        engine: 'blackguardService.validatePreparedSpells (always-prepared subtraction); spell entries are catalog work.',
        gateCheck: true,
      },
      {
        key: 'treachery_dread_smite_type', name: 'Dread Smite (Poison)', level: 3, kind: 'A',
        mechanics: { damageType: 'poison', note: 'from 3rd, Dread Smite damage type becomes poison for this Vice' },
        prompt: 'Dread Smite (Treachery): your Dread Smite damage type is poison.',
        engine: 'blackguardService.dreadSmiteTypeForVice.',
        gateCheck: true,
      },
      {
        key: 'cloak_of_shadows', name: 'Cloak of Shadows', level: 3, kind: 'B',
        mechanics: { channelDivinity: true, effect: 'action: invisible until end of next turn, visible if you attack or cast a spell' },
        prompt: 'Channel Divinity — Cloak of Shadows: action, invisible until the end of your next turn (visible if you attack or cast a spell).',
        engine: 'blackguardService.useChannelDivinity (1/short-or-long rest).',
        gateCheck: true,
      },
      {
        key: 'poison_strike', name: 'Poison Strike', level: 3, kind: 'B',
        mechanics: { channelDivinity: true, effect: 'bonus action: touch a weapon/ammunition, conjure a special poison; on hit deals poison damage equal to 2d10 + blackguard level, or 20 + blackguard level with advantage on the attack roll — as printed' },
        prompt: 'Channel Divinity — Poison Strike: bonus action, touch a weapon or ammunition to conjure a special poison; on a hit it deals poison damage equal to 2d10 + blackguard level, or 20 + blackguard level with advantage on the attack roll, as printed.',
        engine: 'blackguardService.useChannelDivinity; damage is DM adjudicated in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'aura_of_treachery', name: 'Aura of Treachery', level: 7, kind: 'E',
        mechanics: { headline: 'aura of discord; benefits as printed', range: '10 feet, 30 feet at 18th', fullText: 'INTERLEAVED IN EXTRACT — full detail NOT confirmed in digest; re-read from PDF before build (digest UNRESOLVED 3)' },
        prompt: 'Aura of Treachery: an aura of discord (10 feet, 30 feet at 18th) with benefits as printed. FULL DETAIL UNCONFIRMED (interleaved extract) — re-read from the PDF before use.',
        engine: 'DM-prompt only in Tier 0; full detail is a gate-check item.',
        gateCheck: true,
      },
      {
        key: 'betrayers_escape', name: "Betrayer's Escape", level: 15, kind: 'E',
        mechanics: { headline: 'reaction immediately after being hit by an attack: slip away; you remain invisible until end of next turn or until you attack/cast', fullText: 'INTERLEAVED IN EXTRACT — full detail NOT confirmed in digest; re-read from PDF before build (digest UNRESOLVED 3)' },
        prompt: "Betrayer's Escape: reaction immediately after being hit by an attack — slip away; you remain invisible until the end of your next turn or until you attack or cast a spell. FULL DETAIL UNCONFIRMED (interleaved extract) — re-read from the PDF before use.",
        engine: 'DM-prompt only in Tier 0; full detail is a gate-check item.',
        gateCheck: true,
      },
      {
        key: 'icon_of_deceit', name: 'Icon of Deceit', level: 20, kind: 'B',
        mechanics: { uses: '1/long rest', effect: 'action, avatar of deceit for 1 minute: you are invisible; a creature that damages you on its turn must make a Wisdom save or you control its movement and action on its next turn (auto-success if immune to charmed, provided you are not incapacitated); if you have advantage on an attack roll, add blackguard level to its damage roll' },
        prompt: 'Icon of Deceit: 1/long rest, action — avatar of deceit for 1 minute: you are invisible; a creature that damages you on its turn must make a Wisdom save or you control its movement and action on its next turn (auto-success if immune to charmed, provided you are not incapacitated); if you have advantage on an attack roll, add your blackguard level to its damage roll.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
    ],
  },
];
