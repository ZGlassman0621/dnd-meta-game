/**
 * Warlord Presences — KibblesTasty's Warlord v1.5 (GM Binder).
 *
 * Source: "5e - Warlord (KibblesTasty) _ GM Binder.pdf" on Zach's Mac
 * (~/Desktop/Scanned PDFs/, 16 pp, printed from GM Binder
 * https://www.gmbinder.com/share/-LW4agTNJcbwe6kSv4H2 — corroborated
 * 2026-11-06 against the live GM Binder page and the v1.4.2b PDF, which
 * agree on the six core Presences, the 1st-level choice, and the
 * 1/3/7/11/15/18 feature cadence). Transcribed from the PDF text
 * extract; mechanics are paraphrased in the app's own wording, never
 * copied verbatim (same rule as fighter.js).
 *
 * The class itself is NOT in this file: the base class (hit die d8,
 * Leadership Dice, Battlefield Presence, ASI at 4/8/10/12/16/19)
 * lives in
 * server/config/levelProgression.js (CLASS_FEATURES / ASI_LEVELS /
 * SUBCLASS_LEVELS / WARLORD_MULTICLASS_GRANT / CASTER_TYPE) and in
 * client/src/data/classes.json. The Presence ("subclass") is chosen
 * at 1st level — NOT 3rd, as the old client entry claimed — with
 * features at 1st, 3rd, 7th, 11th, 15th, and 18th. selectionLevel is
 * DERIVED from SUBCLASS_LEVELS at read time (item 29); no entry here
 * carries its own selectionLevel field.
 *
 * Eight Presences, not six: the PDF prints six core Presences
 * (Commander, Chieftain, Noble, Packleader, Paragon, Tactician) plus
 * two "Expanded Options" under the heading "Consult your DM to see if
 * they are allowed" — Dancer's Presence and Dreadlord's Presence
 * [Beta]. Both are registered here with `expanded: true` (Dreadlord
 * also `beta: true`) so the DM prompt and picker can label them; if
 * Zach rules them out, deleting the two entries is the whole change.
 *
 * gateCheckRequired / gateCheck are true on every entry/feature, per
 * registry convention: Zach confirms the transcription at the gate.
 * (Unlike the blackguard digest entries, nothing here is reconstructed
 * from an interleaved extract — the PDF text is complete.)
 *
 * Known gaps, flagged not fixed:
 * - Dreadlord's Supernatural Dread casts `frighten` (a 1st-level
 *   necromancy spell printed in the PDF's Referenced Spells). That
 *   spell is NOT in the spell catalog (verified 2026-11-06: no
 *   `frighten` key in spellCatalogData.js) — catalog work, not a
 *   registry gap. The prompt still names it; no accessor depends on it.
 * - Packleader's Nature's Gift also grants "one additional cantrip
 *   from the Druid list" and "one additional 1st-level Druid spell"
 *   (player-chosen, open lists). Per the warden precedent ("fixedList:
 *   NONE PRINTED — player-chosen; list data is planned, not duplicated
 *   here"), the open picks are NOT duplicated as choices options; the
 *   fixed grant (Mold Earth) is carried in mechanics.cantrip so
 *   cantripResolutionService grants it, and the open picks are stated
 *   in the prompt. The Warlord of the Wilds L18 list (five Druid
 *   spells of 4th level or lower, changeable on a long rest) is the
 *   same shape: stated in the prompt, no stored list yet.
 * - The two Warlord feats in the PDF (Tactical Combatant, Synchronized
 *   Combatant, both prerequisite 4th-level Warlord) belong to the feat
 *   registry, not this file.
 * - Ghosts of the Wild (Packleader 15th): the "shroud a granted attack
 *   with advantage" paragraph follows the Hide-action paragraph under
 *   the same heading in the PDF with no second heading, so it is filed
 *   as part of that one feature. If Zach reads it as a separate
 *   feature, split the entry — same level, no other change.
 * - Noble's Destined Leader grants an additional Leadership Die at
 *   3rd, 9th, and 15th level; leadershipDice() below counts it.
 */

export const WARLORD_SUBCLASSES = [
  {
    key: 'commander',
    name: "Commander's Presence",
    description: 'A warlord who commands from the front — forming up allies before the first blow falls. Your orders move the line, lift the fallen, shield your friends, and at your peak no one is ever left behind.',
    class: 'warlord',
    source: "KibblesTasty's Warlord v1.5 (GM Binder)",
    sourceTier: 'homebrew',
    origin_setting: 'KibblesTasty (setting-neutral)',
    origin_region: 'KibblesTasty (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'commander_martial_proficiency', name: 'Martial Proficiency', level: 1, kind: 'E',
        mechanics: { proficiencies: ['heavy armor', 'shields', 'martial weapons'] },
        prompt: 'Martial Proficiency (Commander): proficiency in heavy armor, shields, and martial weapons.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'form_up', name: 'Form Up!', level: 1, kind: 'E',
        mechanics: { range: '30 feet', moveFeet: '5 x Wisdom modifier (minimum 5 feet)', trigger: 'when you roll initiative and are not surprised', targets: 'any number of friendly creatures within 30 feet' },
        prompt: 'Form Up! (Commander): when you roll initiative and are not surprised, any number of friendly creatures within 30 feet of you can move up to their speed a number of feet equal to five times your Wisdom modifier (minimum 5 feet).',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'keen_pointer', name: 'Keen Pointer', level: 3, kind: 'E',
        mechanics: { freeHelpfulWordWithinFeet: 5, rallyingMarkOnHelp: 'expend Leadership Dice to apply Rallying Mark to the creature you are taking the Help action against' },
        prompt: 'Keen Pointer (Commander): you can take the Helpful Word bonus action without expending a Leadership Die if you are within 5 feet of the creature you are taking the Help action against. When you do so, you can expend Leadership Dice to apply Rallying Mark to that creature.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'on_your_feet', name: 'On Your Feet!', level: 7, kind: 'B',
        mechanics: { action: 'bonus action', cost: '1 Leadership Die', range: '5 feet', heal: 'your Leadership die', atZeroHp: 'add your Wisdom modifier', prone: 'the creature can choose to stand immediately' },
        prompt: 'On Your Feet! (Commander): as a bonus action, expend one Leadership Die to restore the will to fight in an allied creature within 5 feet of you. That creature regains hit points equal to your Leadership die; if it is at 0 hit points, add your Wisdom modifier, and if it is prone it can choose to stand immediately.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'martial_advantage', name: 'Martial Advantage', level: 11, kind: 'A',
        mechanics: { uses: 'once per turn', damage: '2d6', condition: 'creature you hit with a weapon attack is within 5 feet of an ally that is not incapacitated' },
        prompt: 'Martial Advantage (Commander): once per turn, you can deal an extra 2d6 damage to a creature you hit with a weapon attack if that creature is within 5 feet of an ally that is not incapacitated.',
        engine: 'DM-prompt only in Tier 0 (damage is DM adjudicated; no attack-path hook).',
        gateCheck: true,
      },
      {
        key: 'bulwark', name: 'Bulwark', level: 15, kind: 'E',
        mechanics: { range: '30 feet', effect: 'when you and any number of friendly creatures within 30 feet of you make a saving throw against the same effect, your allies gain advantage on their saving throw if you succeed' },
        prompt: 'Bulwark (Commander): when you and any number of friendly creatures within 30 feet of you make a saving throw against the same effect, your allies gain advantage on their saving throw if you succeed on yours.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'no_one_left_behind', name: 'No One Left Behind!', level: 18, kind: 'B',
        mechanics: { move: 'up to your speed to get within 5 feet of a creature while using On Your Feet', resistance: 'resistance to all damage during this movement', bonusHeal: 'target regains an additional 1d8 hit points for each attack of opportunity made against you during this movement' },
        prompt: 'No One Left Behind! (Commander): you can move up to your speed to get within 5 feet of a creature while using your On Your Feet feature. During this movement you gain resistance to all damage, and the target regains an additional 1d8 hit points for each attack of opportunity made against you during this movement.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'chieftain',
    name: "Chieftain's Presence",
    description: 'A warlord-chieftain whose warcry drives the whole pack. Your pack moves as one, your shouts grant strength, your assaults turn reckless, and at your peak your victories are bloody and your warcry costs nothing.',
    class: 'warlord',
    source: "KibblesTasty's Warlord v1.5 (GM Binder)",
    sourceTier: 'homebrew',
    origin_setting: 'KibblesTasty (setting-neutral)',
    origin_region: 'KibblesTasty (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'chieftain_proficiency', name: "Chieftain's Proficiency", level: 1, kind: 'E',
        mechanics: { proficiencies: ['shields', 'martial weapons'], skill: 'Intimidation, or another skill of your choice if you are already proficient' },
        prompt: "Chieftain's Proficiency: proficiency in shields, martial weapons, and the Intimidation skill (or another skill of your choice if you are already proficient).",
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'wolfpack_movement', name: 'Wolfpack Movement', level: 1, kind: 'E',
        mechanics: { trigger: 'the first time an allied creature moves', carried: 'a number of willing creatures equal to your Charisma modifier (minimum 1) within 20 feet of you', limits: 'same distance and direction; cannot move more than half of their movement speed; cannot move more than 20 feet from you; creatures can stop at any point along the path' },
        prompt: 'Wolfpack Movement (Chieftain): the first time an allied creature moves, it can bring a number of willing creatures equal to your Charisma modifier (minimum 1) within 20 feet of you along with it in the same distance and direction, but they cannot move more than half of their movement speed and cannot move more than 20 feet from you. Creatures can stop this movement at any point along the path.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'warcry', name: 'Warcry', level: 3, kind: 'B',
        mechanics: { action: 'action, or in place of an attack as part of the Attack action', cost: 'Leadership Dice (up to your per-turn limit)', range: '20 feet', tempHp: 'Leadership Dice roll + your Charisma modifier (minimum 1)', targets: 'you and friendly creatures within 20 feet, up to 1 + your Charisma modifier (minimum 1) creatures', bonusAttack: 'you can make a single weapon attack as a bonus action after unleashing a Warcry, with disadvantage unless made with a weapon with the light property' },
        prompt: 'Warcry (Chieftain): as an action or in place of an attack as part of the Attack action, expend Leadership Dice (up to your per-turn limit) to inspire your allies. You and friendly creatures within 20 feet of you gain temporary hit points equal to the Leadership Dice roll + your Charisma modifier (minimum 1); this can affect up to 1 + your Charisma modifier creatures (minimum 1). You can make a single weapon attack as a bonus action after unleashing a Warcry, but the attack roll has disadvantage unless made with a weapon with the light property.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'savage_momentum', name: 'Savage Momentum', level: 3, kind: 'E',
        mechanics: { trigger: 'whenever you spend a Leadership Die', effect: 'advantage on the next attack roll you make before the end of your turn' },
        prompt: 'Savage Momentum (Chieftain): whenever you spend a Leadership Die, you gain advantage on the next attack roll you make before the end of your turn.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'reckless_assault', name: 'Reckless Assault', level: 7, kind: 'E',
        mechanics: { trigger: 'when a creature with temporary hit points from one of your abilities deals damage', effect: 'they can expend those temporary hit points to add damage equal to half the temporary hit points sacrificed to their damage dealt' },
        prompt: 'Reckless Assault (Chieftain): when a creature with temporary hit points from one of your abilities deals damage, they can expend those temporary hit points to add damage equal to half the temporary hit points sacrificed to their damage dealt.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'wolfpack_tactics', name: 'Wolfpack Tactics', level: 11, kind: 'A',
        mechanics: { firstHitBonus: '1d12 additional damage to the first creature you hit that has taken damage from one of your allies since the end of your last turn', grantedAttackBonus: 'the first time a creature you grant an attack with Battlefield Presence deals damage to a creature you dealt damage to during your turn, that attack deals an additional 1d4 damage' },
        prompt: 'Wolfpack Tactics (Chieftain): the first creature you hit that has taken damage from one of your allies since the end of your last turn suffers an additional 1d12 damage. The first time a creature you grant an attack with Battlefield Presence deals damage to a creature you dealt damage to during your turn, that attack deals an additional 1d4 damage.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'booming_shout', name: 'Booming Shout', level: 15, kind: 'B',
        mechanics: { trigger: 'when you unleash your Warcry', save: 'Wisdom, DC 8 + Charisma modifier + proficiency bonus', effect: 'any number of creatures of your choice within range of your Warcry become frightened of you until the end of their turn', uses: 'once, then not again until you complete a short or long rest', rangeDoubling: 'the range of your Rallying Mark, Urgent Orders, Helpful Word, and Warcry is doubled' },
        prompt: 'Booming Shout (Chieftain): when you unleash your Warcry, any number of creatures of your choice within range of your Warcry must make a Wisdom saving throw (DC 8 + your Charisma modifier + your proficiency bonus) or become frightened of you until the end of their turn. Once you have used Booming Shout, you cannot use it again until you complete a short or long rest. Additionally, the range of your Rallying Mark, Urgent Orders, Helpful Word, and Warcry is doubled.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'bloody_victory', name: 'Bloody Victory', level: 18, kind: 'B',
        mechanics: { trigger: 'when you or an ally reduces a hostile creature that has dealt damage to you to 0 hit points', effect: 'unleash a Warcry as a reaction, expending no Leadership Dice and using a d12 in place of your Leadership Die', uses: 'a number of times equal to your Charisma modifier, regaining all uses on a long rest' },
        prompt: 'Bloody Victory (Chieftain): when you or an ally reduces a hostile creature that has dealt damage to you to 0 hit points, you can unleash a Warcry as a reaction. When you unleash your Warcry in this way, you do not expend any Leadership Dice and you use a d12 in place of your Leadership Die. You can use this reaction a number of times equal to your Charisma modifier, regaining all uses on a long rest.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'noble',
    name: "Noble's Presence",
    description: 'A warlord of noble birth whose very presence commands obedience. Your call to arms grants advantage, your divine right commands with a word, your zeal blesses every blade, and at your peak your decrees bind whole crowds.',
    class: 'warlord',
    source: "KibblesTasty's Warlord v1.5 (GM Binder)",
    sourceTier: 'homebrew',
    origin_setting: 'KibblesTasty (setting-neutral)',
    origin_region: 'KibblesTasty (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'destined_leader', name: 'Destined Leader', level: 1, kind: 'E',
        mechanics: { proficiencies: ['rapiers', 'longswords'], skill: 'Persuasion, or another skill of your choice if you are already proficient', extraLeadershipDice: { 3: 1, 9: 1, 15: 1 }, note: 'an additional Leadership Die at 3rd, 9th, and 15th level (cumulative)' },
        prompt: 'Destined Leader (Noble): proficiency with rapiers, longswords, and the Persuasion skill (or another skill of your choice if you are already proficient). Additionally, you gain an additional Leadership Die at 3rd level, 9th level, and 15th level.',
        engine: 'DM-prompt only in Tier 0; extra dice counted by subclassService.leadershipDice.',
        gateCheck: true,
      },
      {
        key: 'call_to_arms', name: 'Call to Arms', level: 1, kind: 'E',
        mechanics: { trigger: 'when you roll initiative', range: '60 feet', targets: 'creatures of your choice equal to your Charisma modifier (minimum 1)', effect: 'advantage on their first attack roll' },
        prompt: 'Call to Arms (Noble): when you roll initiative you can call out to friendly creatures within 60 feet of you. Creatures of your choice equal to your Charisma modifier (minimum 1) gain advantage on their first attack roll.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'inspiring_leader', name: 'Inspiring Leader', level: 1, kind: 'E',
        mechanics: { appliesTo: 'an allied creature with a CR of less than half your Warlord level (or with fewer class levels than you have Warlord levels if the creature does not have a CR)', effect: 'the creature can choose to use your proficiency bonus + Charisma modifier for the attack roll modifier on the first Attack they make in a turn where they have been granted an attack by Battlefield Presence' },
        prompt: 'Inspiring Leader (Noble): an allied creature with a CR of less than half your Warlord level (or with fewer class levels than you have Warlord levels if the creature does not have a CR) can choose to use your proficiency bonus + Charisma modifier for the attack roll modifier on the first Attack they make in a turn where they have been granted an attack by Battlefield Presence.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'divine_right', name: 'Divine Right', level: 3, kind: 'B',
        mechanics: { cost: 'Leadership Dice (up to your per-turn limit)', spells: ['command'], spellLevel: 'equal to the number of Leadership Dice spent', saveDc: '8 + Charisma modifier + proficiency bonus', acBonus: 'add your Charisma modifier (maximum 2) to your AC so long as you are not wearing heavy armor or using a shield' },
        prompt: 'Divine Right (Noble): you can use Leadership Dice (up to your per-turn limit) to cast command. The level of the spell is equal to the number of Leadership Dice spent; the spell save DC is 8 + your Charisma modifier + your proficiency bonus. You can also add your Charisma modifier (maximum 2) to your AC so long as you are not wearing heavy armor or using a shield.',
        engine: 'DM-prompt only in Tier 0; dice-cast, not always-prepared — no kind-D entry.',
        gateCheck: true,
      },
      {
        key: 'charismatic_leadership', name: 'Charismatic Leadership', level: 3, kind: 'A',
        mechanics: { rallyingMarkDamageBonus: 'your Charisma modifier', urgentOrdersTempHpBonus: 'your Charisma modifier', helpfulWordAttackBonus: 'your Charisma modifier to the attack roll of a creature that gains advantage from Helpful Word' },
        prompt: 'Charismatic Leadership (Noble): you can add your Charisma modifier to the damage bonus of Rallying Mark, the temporary hit points granted by Urgent Orders, and the attack roll of a creature that gains advantage from Helpful Word.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'words_of_conviction', name: 'Words of Conviction', level: 7, kind: 'B',
        mechanics: { cost: 'Leadership Dice (up to your per-turn limit)', spells: ['bless', 'heroism'], spellLevel: 'equal to the number of Leadership Dice spent', materialComponents: 'none required' },
        prompt: 'Words of Conviction (Noble): you can use Leadership Dice (up to your per-turn limit) to cast bless or heroism without providing material components. The level of the spell is equal to the number of Leadership Dice spent.',
        engine: 'DM-prompt only in Tier 0; dice-cast, not always-prepared — no kind-D entry.',
        gateCheck: true,
      },
      {
        key: 'imperative_order', name: 'Imperative Order', level: 7, kind: 'B',
        mechanics: { trigger: 'when you spend Leadership Dice on a target with Urgent Orders', twoDice: 'the target creature can make a single weapon attack with their reaction instead of moving', threeDice: 'the target creature can both move and make a single weapon attack with their reaction' },
        prompt: 'Imperative Order (Noble): when you spend 2 or more Leadership Dice on a target with Urgent Orders, you can allow the target creature to make a single weapon attack with their reaction instead of moving. If you spend 3 or more Leadership Dice on a target, the target creature can both move and make a single weapon attack with their reaction.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'inspired_zeal', name: 'Inspired Zeal', level: 11, kind: 'E',
        mechanics: { range: '30 feet', effect: 'all creatures of your choice within 30 feet of you deal an extra 1d4 radiant damage when they hit with a weapon attack' },
        prompt: 'Inspired Zeal (Noble): all creatures of your choice within 30 feet of you deal an extra 1d4 radiant damage when they hit with a weapon attack.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'untouchable_presence', name: 'Untouchable Presence', level: 15, kind: 'E',
        mechanics: { effect: 'you are under the effect of sanctuary; the effect ends as normal if you take an action that would break it, but returns at the start of your next turn', saveDc: '8 + Charisma modifier + proficiency bonus' },
        prompt: 'Untouchable Presence (Noble): you are under the effect of sanctuary. This effect ends as normal if you take an action that would break it, but returns at the start of your next turn. The spell save DC is 8 + your Charisma modifier + your proficiency bonus.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'grand_decree', name: 'Grand Decree', level: 18, kind: 'B',
        mechanics: { cost: 'no spell slot or Leadership Dice', spells: ['command'], effect: 'the spell affects all creatures of your choice within range that could be affected by the spell', uses: 'once, then not again until you complete a long rest' },
        prompt: "Grand Decree (Noble): you can use this ability to cast command without expending a spell slot or Leadership Dice. When you do so, the spell affects all creatures of your choice within range that could be affected by the spell. Once you cast command using this ability, you cannot cast it using this ability again until you complete a long rest.",
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'packleader',
    name: "Packleader's Presence",
    description: 'A warlord of the wilds who moves unseen and strikes from nowhere. Your pack approaches in silence, your nature\'s gift hides and heals, and at your peak you are a warlord of the wilds — five druid spells at your command.',
    class: 'warlord',
    source: "KibblesTasty's Warlord v1.5 (GM Binder)",
    sourceTier: 'homebrew',
    origin_setting: 'KibblesTasty (setting-neutral)',
    origin_region: 'KibblesTasty (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'tools_of_the_wild', name: 'Tools of the Wild', level: 1, kind: 'E',
        mechanics: { proficiencies: ['martial weapons'], skill: 'Survival, or another skill of your choice if already proficient', toolChoice: 'Herbalism Kit or Poisoner\'s Kit' },
        prompt: "Tools of the Wild (Packleader): proficiency in martial weapons, the Survival skill (or another skill of your choice if already proficient), and your choice of the Herbalism Kit or the Poisoner's Kit.",
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'concealed_approach', name: 'Concealed Approach', level: 1, kind: 'E',
        mechanics: { preparation: 'at least a minute to prepare', stealth: 'add your Wisdom modifier to a Dexterity (Stealth) check for you and up to five friendly creatures', initiative: 'you and friendly creatures within 30 feet of you that roll for initiative while hidden can add your Wisdom modifier to the initiative result' },
        prompt: 'Concealed Approach (Packleader): if you have at least a minute to prepare, you can add your Wisdom modifier to a Dexterity (Stealth) check for you and up to five friendly creatures. You and friendly creatures within 30 feet of you that roll for initiative while hidden can add your Wisdom modifier to the initiative result.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'natures_gift', name: "Nature's Gift", level: 3, kind: 'B',
        mechanics: { cantrip: 'Mold Earth', additionalCantrip: 'one additional cantrip from the Druid list that you know (player-chosen, open list — not duplicated here; see file header)', diceSpells: ['fog cloud', 'snare'], diceSpellLevel: 1, diceCost: 'one Leadership Die', snareCastingTime: 'one action when you cast it this way', additionalSpell: 'one additional 1st-level spell from the Druid spell list with a casting time of one action to cast this way (player-chosen)', spellcastingAbility: 'Wisdom', saveDc: '8 + proficiency bonus + Wisdom modifier' },
        prompt: "Nature's Gift (Packleader): you learn the spell mold earth, and can pick one additional cantrip from the Druid list that you know. Additionally, you can expend one Leadership Die to cast fog cloud or snare as 1st-level spells. The casting time of snare is one action when you cast it this way. You can pick one additional 1st-level spell from the Druid spell list with a casting time of one action to cast this way. Your spellcasting modifier for these spells is Wisdom, and your spell save DC is 8 + your proficiency bonus + your Wisdom modifier.",
        engine: 'DM-prompt only in Tier 0; Mold Earth is granted by cantripResolutionService via mechanics.cantrip; dice-cast spells are not always-prepared — no kind-D entry.',
        gateCheck: true,
      },
      {
        key: 'shroud_of_nature', name: 'Shroud of Nature', level: 7, kind: 'E',
        mechanics: { trigger: 'whenever you cast a spell that results in you or a friendly creature becoming obscured (such as being within the radius of a fog cloud or behind earth moved by mold earth)', effect: 'the obscured creature can use their reaction to take the Hide action' },
        prompt: 'Shroud of Nature (Packleader): whenever you cast a spell that results in you or a friendly creature becoming obscured (such as being within the radius of a fog cloud or behind earth moved by mold earth), the obscured creature can use their reaction to take the Hide action.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'trackless_trails', name: 'Trackless Trails', level: 7, kind: 'B',
        mechanics: { cost: '2 Leadership Dice', spells: ['pass without trace'], materialComponents: 'none required' },
        prompt: 'Trackless Trails (Packleader): you can spend 2 Leadership Dice to cast pass without trace without providing material components.',
        engine: 'DM-prompt only in Tier 0; dice-cast, not always-prepared — no kind-D entry.',
        gateCheck: true,
      },
      {
        key: 'fleeting_strikers', name: 'Fleeting Strikers', level: 11, kind: 'A',
        mechanics: { trigger: 'you are not in the same spot you were at the end of your last turn, or you are obscured from your target', damage: '1d10 additional damage on the first attack you make during your turn', grantedAttackOption: 'a creature you grant an Attack with Battlefield Presence can take the Dash action instead of making the attack you granted' },
        prompt: "Fleeting Strikers (Packleader): if you are not in the same spot you were at the end of your last turn or are obscured from your target, the first attack you make during your turn deals an additional 1d10 damage. Additionally, a creature that you grant an Attack with Battlefield Presence can take the Dash action instead of making the attack you granted.",
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'ghosts_of_the_wild', name: 'Ghosts of the Wild', level: 15, kind: 'B',
        mechanics: { hide: 'while under the effect of pass without trace, expend one Leadership Die to take the Hide action at the end of your turn without expending an action', shroudGrantedAttack: 'if you use Battlefield Presence to grant an attack to a creature, expend one Leadership Die to shroud them with shadows or natural phenomena, granting them advantage on the first attack they make before the start of your next turn; if they are under the effect of pass without trace, you can do this without expending a Leadership Die', note: 'the shroud paragraph follows the Hide paragraph under the same heading in the PDF with no second heading — filed as one feature (see file header)' },
        prompt: 'Ghosts of the Wild (Packleader): while under the effect of pass without trace, you can expend one Leadership Die to take the Hide action at the end of your turn without expending an action. If you use Battlefield Presence to grant an attack to a creature, you can expend one Leadership Die to shroud them with shadows or natural phenomena, granting them advantage on the first attack they make before the start of your next turn. If they are under the effect of pass without trace, you can do this without expending a Leadership Die.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'warlord_of_the_wilds', name: 'Warlord of the Wilds', level: 18, kind: 'B',
        mechanics: { spells: 'pick five additional spells from the Druid spell list of 4th level or lower (player-chosen; change the list when you complete a long rest)', cost: 'Leadership Dice equal to the level of the spell', saveDc: '8 + proficiency bonus + Wisdom modifier', bonusAttack: 'any time you use Leadership Dice to cast a spell, you can take the Attack action (one weapon attack only) as a bonus action' },
        prompt: 'Warlord of the Wilds (Packleader): you can pick five additional spells from the Druid spell list of 4th level or lower. You can cast these spells using Leadership Dice equal to the level of the spell. You can change the list of spells you have selected when you complete a long rest. The spell save DC is 8 + your proficiency bonus + your Wisdom modifier. Any time you use Leadership Dice to cast a spell, you can take the Attack action (one weapon attack only) as a bonus action.',
        engine: 'DM-prompt only in Tier 0; dice-cast, not always-prepared — no kind-D entry.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'paragon',
    name: "Paragon's Presence",
    description: 'A warlord-paragon who leads the charge and refuses to fall. Your strikes mark the enemy, your defiance raises you from zero, your resolve turns failure to success, and at your peak no ally falls while you still stand.',
    class: 'warlord',
    source: "KibblesTasty's Warlord v1.5 (GM Binder)",
    sourceTier: 'homebrew',
    origin_setting: 'KibblesTasty (setting-neutral)',
    origin_region: 'KibblesTasty (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'paragon_martial_proficiency', name: 'Martial Proficiency', level: 1, kind: 'E',
        mechanics: { proficiencies: ['heavy armor', 'shields', 'martial weapons'] },
        prompt: 'Martial Proficiency (Paragon): proficiency in heavy armor, shields, and martial weapons.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'lead_the_charge', name: 'Lead the Charge', level: 1, kind: 'E',
        mechanics: { initiativeBonus: 'your Charisma modifier', tempHpOnInitiative: 'your Charisma modifier + your proficiency bonus' },
        prompt: 'Lead the Charge (Paragon): you can give yourself a bonus to your initiative rolls equal to your Charisma modifier. Additionally, when you roll initiative you gain temporary hit points equal to your Charisma modifier + your proficiency bonus.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'fighting_style', name: 'Fighting Style', level: 3, kind: 'G',
        mechanics: { choice: 'fighting_style', options: ['Defense', 'Dueling', 'Great Weapon Fighting', 'Two-Weapon Fighting'], note: 'Defense: +1 AC while wearing armor. Dueling: +2 damage with a one-handed melee weapon and no other weapons. Great Weapon Fighting: reroll 1s and 2s on damage dice with a two-handed or versatile melee weapon. Two-Weapon Fighting: add your ability modifier to the damage of the second attack.' },
        prompt: 'Fighting Style (Paragon): choose one — Defense (+1 AC while wearing armor), Dueling (+2 damage with a one-handed melee weapon), Great Weapon Fighting (reroll 1s and 2s on damage with a two-handed or versatile melee weapon), or Two-Weapon Fighting (add your ability modifier to the damage of the second attack).',
        engine: 'Stored choice (subclass_choices_json); effects are DM-prompt only in v1.',
        gateCheck: true,
      },
      {
        key: 'heroic_strike', name: 'Heroic Strike', level: 3, kind: 'B',
        mechanics: { trigger: 'when you take the Attack action', uses: 'once per turn', cost: 'Leadership Dice (up to your per-turn limit)', effect: 'apply Rallying Mark as part of a melee weapon attack; whenever you expend Leadership Dice as part of making an attack, add the expended Leadership Dice to the damage roll of the attack' },
        prompt: 'Heroic Strike (Paragon): when you take the Attack action, once per turn you can expend Leadership Dice (up to your per-turn limit) to apply Rallying Mark as part of a melee weapon attack. Whenever you expend Leadership Dice as part of making an attack, you can add the expended Leadership Dice to the damage roll of the attack.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'stand_defiant', name: 'Stand Defiant', level: 7, kind: 'E',
        mechanics: { trigger: 'when you are reduced to zero hit points', heal: 'your Charisma modifier (minimum 1)', extraHeal: 'expend a number of Leadership Dice equal to the number of friendly creatures within 60 feet of you, regaining additional hit points equal to the value rolled', uses: 'once, then not again until you complete a short or long rest' },
        prompt: 'Stand Defiant (Paragon): when you are reduced to zero hit points, you instantly regain a number of hit points equal to your Charisma modifier (minimum 1). Additionally, you can expend a number of Leadership Dice equal to the number of friendly creatures within 60 feet of you, regaining additional hit points equal to the value rolled this way. Once you use this feature, you cannot use it again until you complete a short or long rest.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'inspired_warrior', name: 'Inspired Warrior', level: 11, kind: 'A',
        mechanics: { trigger: 'once per turn, when one of your allies within 30 feet takes or deals damage', pool: 'gain d4 dice, maximum equal to your Charisma modifier (minimum 1)', spend: 'until the end of your next turn, when you deal damage you can expend any number of dice from this pool, rolling them and dealing additional damage equal to the value rolled' },
        prompt: 'Inspired Warrior (Paragon): once per turn, when one of your allies within 30 feet takes or deals damage, you gain d4 dice, adding it to a pool of dice. You can have a maximum number of d4 dice in this pool equal to your Charisma modifier (minimum 1). Until the end of your next turn, when you deal damage you can expend any number of dice from this pool, rolling them and dealing additional damage equal to the value rolled.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'dauntless_resolve', name: 'Dauntless Resolve', level: 15, kind: 'E',
        mechanics: { trigger: 'when you fail a saving throw', effect: 'choose to succeed instead', uses: 'once, then not again until you complete a long rest' },
        prompt: 'Dauntless Resolve (Paragon): when you fail a saving throw, you can choose to succeed instead. Once you do this, you cannot do this again until you complete a long rest.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'invincible_legion', name: 'Invincible Legion', level: 18, kind: 'E',
        mechanics: { trigger: 'a friendly creature within 60 feet of you is reduced to 0 hit points, but not killed outright', effect: 'they can drop to 1 hit point instead, so long as they can see or hear you', perCreature: 'once a creature benefits from this effect, they cannot benefit from it again until they complete a long rest' },
        prompt: 'Invincible Legion (Paragon): when a friendly creature within 60 feet of you is reduced to 0 hit points, but not killed outright, they can drop to 1 hit point instead so long as they can see or hear you. Once a creature benefits from this effect, they cannot benefit from it again until they complete a long rest.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
    ],
    choices: [
      { key: 'fighting_style', level: 3, options: ['Defense', 'Dueling', 'Great Weapon Fighting', 'Two-Weapon Fighting'] },
    ],
  },
  {
    key: 'tactician',
    name: "Tactician's Presence",
    description: 'A warlord-tactician who wins battles in the planning. Your battle plans set the order, your insight reads every foe, your orders move the field, and at your peak your schemes are unstoppable and layered.',
    class: 'warlord',
    source: "KibblesTasty's Warlord v1.5 (GM Binder)",
    sourceTier: 'homebrew',
    origin_setting: 'KibblesTasty (setting-neutral)',
    origin_region: 'KibblesTasty (setting-neutral)',
    gateCheckRequired: true,
    features: [
      {
        key: 'tacticians_cunning', name: "Tactician's Cunning", level: 1, kind: 'E',
        mechanics: { proficiencies: ['History', 'Investigation'], skillFallback: 'other skills of your choice if you are already proficient', slowCheckFloor: 'if you can take a minute or more making a skill check, treat a d20 roll of 4 or lower as a 5' },
        prompt: "Tactician's Cunning: proficiency in the History and Investigation skills (or other skills of your choice if you are already proficient). Additionally, if you can take a minute or more making a skill check, you can treat a d20 roll of 4 or lower as a 5.",
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'battle_plans', name: 'Battle Plans', level: 1, kind: 'E',
        mechanics: { initiativeBonus: 'your Intelligence modifier', swap: 'you can exchange your initiative roll with a willing friendly creature within 60 feet' },
        prompt: 'Battle Plans (Tactician): you can give yourself a bonus to your initiative rolls equal to your Intelligence modifier. Additionally, you can exchange your initiative roll with a willing friendly creature within 60 feet.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'tactical_insight', name: 'Tactical Insight', level: 3, kind: 'B',
        mechanics: { action: 'bonus action', check: 'Intelligence (Investigation) contested by the target\'s Charisma (Deception)', range: '60 feet, a creature you can see', effects: ['Determine Attack: cause the target to have disadvantage on their next attack against a creature that can see or hear you', 'Predict Movement: deduce where they plan to move on their next turn; if they move anywhere else, their movement speed is reduced by 10 feet', 'Outwit Response: negate their ability to use their reaction until the end of their next turn', 'Expose Weakness: use Helpful Word to grant advantage against that target as part of the bonus action without expending a Leadership Die'] },
        prompt: 'Tactical Insight (Tactician): as a bonus action, make an Intelligence (Investigation) check contested by a Charisma (Deception) check against any creature you can see within 60 feet. On a success, you can see through their tactics, granting one of: Determine Attack (disadvantage on their next attack against a creature that can see or hear you), Predict Movement (if they move anywhere else than predicted, their movement speed is reduced by 10 feet), Outwit Response (they cannot use their reaction until the end of their next turn), or Expose Weakness (use Helpful Word to grant advantage against that target as part of the bonus action without expending a Leadership Die).',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'tactical_flexibility', name: 'Tactical Flexibility', level: 3, kind: 'E',
        mechanics: { effect: 'use Tactical Insight, Rallying Mark, Helpful Word, and Urgent Orders as an action or a bonus action on your turn' },
        prompt: 'Tactical Flexibility (Tactician): you gain the ability to use Tactical Insight, Rallying Mark, Helpful Word, and Urgent Orders as an action or a bonus action on your turn.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'inscrutable_mind', name: 'Inscrutable Mind', level: 7, kind: 'E',
        mechanics: { saveProficiency: 'Intelligence saving throws', reaction: 'when forced to make a Wisdom, Intelligence, or Charisma saving throw, expend one Leadership Die and add the die result to the saving throw' },
        prompt: 'Inscrutable Mind (Tactician): you gain proficiency in Intelligence saving throws. Additionally, as a reaction when being forced to make a Wisdom, Intelligence, or Charisma saving throw, you can expend one Leadership Die and add the die result to the saving throw.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'control_the_field', name: 'Control the Field', level: 7, kind: 'E',
        mechanics: { appliesTo: 'an ability that moves allied creatures (such as Urgent Orders or Shift the Field)', properties: ['Deceptive Movement: attempt to move creatures that are not allies up to 5 feet (or half their movement speed, whichever is less); the creature must make an Intelligence saving throw (DC 8 + Intelligence modifier + proficiency bonus) or feel compelled to move to the new position immediately; targets moved this way do not gain temporary hit points', 'Flanking Maneuvers: if two allies you move are on opposite sides of a creature after the movement, the first one to attack that enemy has advantage on their first attack if they attack before the creature moves', 'Coordinated Transitions: allies can move through each other\'s spaces during the movement you grant without it being difficult terrain'] },
        prompt: 'Control the Field (Tactician): when you use an ability that moves allied creatures (such as Urgent Orders or Shift the Field), it gains: Deceptive Movement (move non-allies up to 5 feet or half their speed, whichever is less, on a failed Intelligence save, DC 8 + your Intelligence modifier + your proficiency bonus; no temporary hit points), Flanking Maneuvers (two allies ending on opposite sides of a creature grant the first attacker advantage on their first attack before the creature moves), and Coordinated Transitions (allies move through each other\'s spaces without difficult terrain).',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'tactical_strike', name: 'Tactical Strike', level: 11, kind: 'A',
        mechanics: { trigger: 'when you succeed on a Tactical Insight check against a creature', damage: '2d6', window: 'the next time you or a friendly creature deal damage against it before the start of your next turn' },
        prompt: 'Tactical Strike (Tactician): when you succeed on a Tactical Insight check against a creature, the next time you or a friendly creature deal damage against it before the start of your next turn it is increased by 2d6 damage.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'advanced_orders', name: 'Advanced Orders', level: 15, kind: 'E',
        mechanics: { trigger: 'when you expend a Leadership Die on Urgent Orders', effect: 'allow the creature to take one of the Use an Object, Search, Hide, or Dodge actions as their reaction instead of moving' },
        prompt: 'Advanced Orders (Tactician): when you expend a Leadership Die on Urgent Orders, you can allow the creature to take one of the Use an Object, Search, Hide, or Dodge actions as their reaction instead of moving.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'unstoppable_schemes', name: 'Unstoppable Schemes', level: 18, kind: 'E',
        mechanics: { trigger: 'when you move your allies with Urgent Orders or Shift the Field', effect: 'they can move through spaces occupied by hostile creatures so long as they do not end their movement in an occupied space' },
        prompt: 'Unstoppable Schemes (Tactician): when you move your allies with Urgent Orders or Shift the Field, they can move through spaces occupied by hostile creatures so long as they do not end their movement in an occupied space.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'multilayered_tactics', name: 'Multilayered Tactics', level: 18, kind: 'E',
        mechanics: { trigger: 'when you succeed on a Tactical Insight check against a creature', effect: 'choose two of the listed Tactical Insight effects instead of one' },
        prompt: 'Multilayered Tactics (Tactician): when you succeed on a Tactical Insight check against a creature, you can choose two of the listed effects.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'dancer',
    name: "Dancer's Presence",
    description: 'A warlord-dancer whose battlefield is a ballroom — grace, misdirection, and a blade that never stops. Your entrance sets the tempo, your distracts unbalance foes, misses feed your dice, and at your peak you trade places with your allies to take their blows.',
    class: 'warlord',
    source: "KibblesTasty's Warlord v1.5 (GM Binder)",
    sourceTier: 'homebrew',
    origin_setting: 'KibblesTasty (setting-neutral)',
    origin_region: 'KibblesTasty (setting-neutral)',
    gateCheckRequired: true,
    expanded: true,
    features: [
      {
        key: 'dancers_grace', name: "Dancer's Grace", level: 1, kind: 'E',
        mechanics: { skill: 'Performance; if you already have proficiency with Performance, you gain expertise with it (twice your proficiency bonus)', unarmoredDefense: 'while you are not wearing armor or carrying a shield, 10 + Dexterity modifier + Charisma modifier' },
        prompt: "Dancer's Grace (expanded option — ask your DM): proficiency with Performance; if you already have proficiency with Performance, you gain expertise with it. Additionally, while you are not wearing armor or carrying a shield, you gain an unarmored defense of 10 + your Dexterity modifier + your Charisma modifier.",
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'graceful_entrance', name: 'Graceful Entrance', level: 1, kind: 'E',
        mechanics: { initiativeBonus: 'your Charisma modifier', trigger: 'when you roll initiative and are not surprised', move: 'up to your half movement speed', tempHp: 'you and any creature you end this movement within 5 feet of gains temporary hit points equal to your Charisma modifier' },
        prompt: "Graceful Entrance (Dancer): you can give yourself a bonus to your initiative rolls equal to your Charisma modifier. Additionally, when you roll initiative and are not surprised, you can move up to your half movement speed, and you and any creature you end this movement within 5 feet of gains temporary hit points equal to your Charisma modifier.",
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'distract', name: 'Distract', level: 3, kind: 'B',
        mechanics: { grantedBy: 'Bewildering Steps: an additional use for Leadership Dice', action: 'bonus action', range: '30 feet', effect: 'until the start of its next turn, if that creature attacks a creature other than you while you are within range of its attack, you can roll your Leadership Die and subtract it from their attack' },
        prompt: 'Distract (Dancer, from Bewildering Steps): as a bonus action, you attempt to distract a creature within 30 feet. Until the start of its next turn, if that creature attacks a creature other than you while you are within range of its attack, you can roll your Leadership Die and subtract it from their attack.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'dancers_dodge', name: "Dancer's Dodge", level: 3, kind: 'B',
        mechanics: { trigger: 'when you take the Dodge action while you are not wearing armor or carrying a shield', freeUse: 'use Distract, Helpful Word, Urgent Orders, or Rallying Mark without expending a Leadership Die (applies as if you had spent 1 Leadership Die)', grantedAttacks: 'when you take the Dodge action, expend Leadership Dice to grant attacks through Battlefield Presence — a number of attacks equal to the Leadership Dice spent, up to your per-turn limit' },
        prompt: "Dancer's Dodge: when you take the Dodge action while you are not wearing armor or carrying a shield, you can use Distract, Helpful Word, Urgent Orders, or Rallying Mark without expending a Leadership Die. When you do so, it applies as if you had spent 1 Leadership Die on it for its effect. Additionally, when you take the Dodge action, you can expend Leadership Dice to grant attacks through Battlefield Presence. You can grant a number of attacks equal to the Leadership Dice spent, up to your per-turn limit.",
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'battlefield_grace', name: 'Battlefield Grace', level: 7, kind: 'E',
        mechanics: { trigger: 'whenever a creature misses you with an attack', effect: 'you regain 1 spent Leadership Die and can move 5 feet; this movement does not provoke attacks of opportunity', limit: 'you cannot regain a Leadership Die this way again until the start of your next turn' },
        prompt: 'Battlefield Grace (Dancer): whenever a creature misses you with an attack, you regain 1 spent Leadership Die and can move 5 feet. This movement does not provoke attacks of opportunity. You cannot regain a Leadership Die this way again until the start of your next turn.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'whirling_thorns', name: 'Whirling Thorns', level: 7, kind: 'B',
        mechanics: { requirement: 'carrying a melee weapon with the light property', effect: 'make a single attack with it as a bonus action; expend Leadership Dice to make additional attacks as part of the same action, each attack against a different target within range' },
        prompt: 'Whirling Thorns (Dancer): if you are carrying a melee weapon with the light property, you can make a single attack with it as a bonus action. You can expend Leadership Dice to make additional attacks as part of the same action, but each attack must be against a different target within range.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'furious_tempo', name: 'Furious Tempo', level: 11, kind: 'A',
        mechanics: { damageBonus: 'your Charisma modifier', appliesTo: 'attacks you make or grant through Battlefield Presence' },
        prompt: 'Furious Tempo (Dancer): you can add your Charisma modifier to the damage of attacks you make or grant through Battlefield Presence.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'evasion', name: 'Evasion', level: 15, kind: 'E',
        mechanics: { trigger: 'when you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage', effect: 'you instead take no damage if you succeed on the saving throw, and only half damage if you fail' },
        prompt: 'Evasion (Dancer): when you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'elegant_exchange', name: 'Elegant Exchange', level: 18, kind: 'B',
        mechanics: { trigger: 'a willing creature within 15 feet of you is the target of a spell, attack, or targeted effect that would cause them to take damage', action: 'reaction', effect: 'move their position 5 feet in any direction and become the target of the attack' },
        prompt: 'Elegant Exchange (Dancer): when a willing creature within 15 feet of you is the target of a spell, attack, or targeted effect that would cause them to take damage, you can move their position as a reaction, moving them 5 feet in any direction and becoming the target of the attack.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
    ],
  },
  {
    key: 'dreadlord',
    name: "Dreadlord's Presence",
    description: 'A warlord-dreadlord whose presence alone breaks armies. Your demoralization dice spread fear, your supernatural dread casts terror without a slot, your mask hides all, and at your peak the frightened flee in panic at your word.',
    class: 'warlord',
    source: "KibblesTasty's Warlord v1.5 (GM Binder)",
    sourceTier: 'homebrew',
    origin_setting: 'KibblesTasty (setting-neutral)',
    origin_region: 'KibblesTasty (setting-neutral)',
    gateCheckRequired: true,
    expanded: true,
    beta: true,
    features: [
      {
        key: 'dreadlord_proficiency', name: 'Dreadlord Proficiency', level: 1, kind: 'E',
        mechanics: { proficiencies: ['heavy armor'], skill: 'Intimidation' },
        prompt: 'Dreadlord Proficiency (expanded option, Beta — ask your DM): proficiency in heavy armor and the Intimidation skill.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'unapproachable', name: 'Unapproachable', level: 1, kind: 'E',
        mechanics: { trigger: 'after rolling initiative', effect: 'the first attack by the first hostile creature to attack an allied creature within 30 feet of you has disadvantage' },
        prompt: 'Unapproachable (Dreadlord): after rolling initiative, the first attack by the first hostile creature to attack an allied creature within 30 feet of you has disadvantage.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'demoralization_dice', name: 'Demoralization Dice', level: 3, kind: 'B',
        mechanics: { gain: 'whenever you spend a Leadership Die, you gain a Demoralization Die of equal size', expiry: 'Demoralization Dice last until you have gone 1 minute without earning or spending one', uses: ['Make it Excruciating: when a creature within 30 feet of you takes damage from a weapon attack roll made by an ally of yours, as a reaction expend up to your Leadership Die limit of Demoralization Dice, rolling them and causing the target to take additional damage equal to the value rolled', 'Don\'t Touch That: when a creature attacks an allied creature within 30 feet of you, as a reaction expend one Demoralization Die, rolling it and reducing the attacker\'s attack roll', 'Are You Sure?: when a creature ends their turn within 5 feet of you, as a reaction expend Demoralization Dice (up to your Leadership Die limit) and force the creature to make a Wisdom saving throw (DC 8 + your Charisma modifier + your proficiency bonus); on failure, the creature uses their reaction to move away from you a number of feet equal to 10 x the Demoralization Dice spent; the target automatically passes if it is immune to the frightened condition'] },
        prompt: 'Demoralization Dice (Dreadlord): whenever you spend a Leadership Die, you gain a Demoralization Die of equal size. Demoralization Dice last until you have gone 1 minute without earning or spending one. You can spend Demoralization Dice as a reaction: Make it Excruciating (an ally\'s weapon attack within 30 feet deals additional damage equal to the dice rolled, up to your Leadership Die limit); Don\'t Touch That (reduce an attacker\'s attack roll against an ally within 30 feet by the die rolled); Are You Sure? (a creature ending its turn within 5 feet of you must make a Wisdom save, DC 8 + your Charisma modifier + your proficiency bonus, or use its reaction to move 10 feet per die spent away from you; immune to frightened passes automatically).',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'supernatural_dread', name: 'Supernatural Dread', level: 7, kind: 'B',
        mechanics: { cost: 'Leadership Dice (up to your per-turn limit)', spells: ['frighten'], spellLevel: 'equal to the number of Leadership Dice spent', noSlot: true, fearOption: 'spend 3 Leadership Dice (even if it exceeds your per-turn limit) to cast fear without expending a spell slot or material component once; after you do this, you cannot cast fear this way again until you complete a long rest', spellcastingAbility: 'Charisma', catalogGap: 'frighten is NOT in the spell catalog (verified 2026-11-06) — catalog work, not a registry gap' },
        prompt: 'Supernatural Dread (Dreadlord): you can use Leadership Dice (up to your per-turn limit) to cast frighten without a spell slot. The level of the spell is equal to the number of Leadership Dice spent. Alternatively, you can spend 3 Leadership Dice (even if it exceeds your per-turn limit) to cast fear without expending a spell slot or material component once; after you do this, you cannot cast fear this way again until you complete a long rest. Charisma is your spellcasting modifier for these spells.',
        engine: 'DM-prompt only in Tier 0; dice-cast, not always-prepared — no kind-D entry. frighten is not in the spell catalog.',
        gateCheck: true,
      },
      {
        key: 'iron_mask', name: 'Iron Mask', level: 7, kind: 'E',
        mechanics: { insight: 'creatures have disadvantage on Wisdom (Insight) ability checks against you', suppressFrightened: 'you can suppress the effect of the frightened condition on yourself, but it requires concentration (as if concentrating on a spell); you cannot lose concentration on the effect, but cannot maintain it while concentrating on a spell' },
        prompt: 'Iron Mask (Dreadlord): creatures have disadvantage on Wisdom (Insight) ability checks against you. Additionally, you can suppress the effect of the frightened condition on yourself, but it requires concentration (as if concentrating on a spell). You cannot lose concentration on the effect, but cannot maintain it while concentrating on a spell.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'punish_the_weak', name: 'Punish the Weak', level: 11, kind: 'B',
        mechanics: { trigger: 'when you target a creature within 60 feet of you with any ability, feature, or attack', action: 'no action required', markDuration: 'until the creature ends their turn more than 60 feet from you, dies, or you mark another creature', damage: 'once per turn when the marked creature takes damage, they take an additional 1d8 damage; 1d12 if the target is frightened of you' },
        prompt: 'Punish the Weak (Dreadlord): when you target a creature within 60 feet of you with any ability, feature, or attack, you can mark them for punishment (no action required). The mark lasts until the creature ends their turn more than 60 feet from you, dies, or you mark another creature. Once per turn when the marked creature takes damage, they take an additional 1d8 damage. This is increased to 1d12 if the target is frightened of you.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'instinctive_flinch', name: 'Instinctive Flinch', level: 15, kind: 'E',
        mechanics: { trigger: 'when a creature passes a Wisdom saving throw against one of your features that would cause them to become frightened or flee', effect: 'they still gain disadvantage on their next attack roll made before the start of your next turn', immune: 'no effect if the target is immune to the frightened condition' },
        prompt: 'Instinctive Flinch (Dreadlord): when a creature passes a Wisdom saving throw against one of your features that would cause them to become frightened or flee, they still gain disadvantage on their next attack roll made before the start of your next turn. This has no effect if the target is immune to the frightened condition.',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'expanded_dominion', name: 'Expanded Dominion', level: 15, kind: 'E',
        mechanics: { effect: 'the range of your Demoralization Dice effects are doubled (making them 60 feet, 60 feet, and 10 feet, respectively)' },
        prompt: 'Expanded Dominion (Dreadlord): the range of your Demoralization Dice effects are doubled (making them 60 feet, 60 feet, and 10 feet, respectively).',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
      {
        key: 'dreadful_terror', name: 'Dreadful Terror', level: 18, kind: 'B',
        mechanics: { trigger: 'when a target becomes frightened of you', action: 'no action required', enhancements: ['Panicked Terror: the target immediately spends their reaction to move up to half of their movement speed away from you', 'Blind Terror: expend 2 Demoralization Dice to cause the target to become blinded until the start of your next turn', 'Paralyzing Terror: expend 3 Demoralization Dice to cause the target to become paralyzed until the start of your next turn'] },
        prompt: 'Dreadful Terror (Dreadlord): when a target becomes frightened of you, you can expend Demoralization Dice to enhance the effect (no action required): Panicked Terror (the target immediately spends their reaction to move up to half of their movement speed away from you); Blind Terror (expend 2 Demoralization Dice to cause the target to become blinded until the start of your next turn); Paralyzing Terror (expend 3 Demoralization Dice to cause the target to become paralyzed until the start of your next turn).',
        engine: 'DM-prompt only in Tier 0.',
        gateCheck: true,
      },
    ],
  },
];
