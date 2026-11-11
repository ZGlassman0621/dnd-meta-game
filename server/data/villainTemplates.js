/**
 * villainTemplates.js — D&D Villain Guide (Yellowbyte Studios, fan content),
 * staged for the 2024 system. DATA ONLY. No stats, no wiring, no seeding,
 * no prompt, no session, no route, no migration.
 *
 * Source: ~/workspace/dnd-app-review/gm-toolkits/gm-sort-1-proactive-villain.md,
 * built FROM THE SORT, not re-extracted from the PDF. Summaries below are
 * condensed in substance, never extended with new plot beats.
 *
 * Provenance is NOT a filter (Zach, 2026-10-28): a villain stays in if it
 * fits the game's style, whoever published it. Fit is judged on tone,
 * 2024 rebuild, and canon — not on publisher.
 *
 * Three-layer NPC model (Zach, 2026-10-28): ally/villain/patron is a
 * player-relative stance, NOT an identity, so it is NOT a field here.
 * Each template carries instead:
 *   - core self: name, title, appearance, personality (for the DM system;
 *     narration must show it via action, never narrate internal states)
 *   - personalGoal: a goal independent of the player character
 *   - faction: what group they lead, use, answer to, or create, and
 *     what that group wants — faction pull, not identity
 *   - minions, lair (description only), hook, alternativeEndings
 * At deal time the system adds, and does NOT store in this file:
 * player stance (derived, per relationship, with a history log),
 * knowledge flags (what the PC knows, 1, vs does not know, 0),
 * hidden-agenda tier (system-rolled, never visible to the player),
 * and schedule / resolve-by dates for lazy off-screen advancement.
 * Off-screen advancement is lazy: computed at arrival, session start,
 * or downtime return, never ticked continuously, never rolled yearly.
 *
 * What is DROPPED, on purpose: every statblock (ability scores, AC,
 * HP, attacks, spells, saving throws, skills, senses, languages,
 * legendary actions, lair actions, regional effects as mechanics),
 * every DC, damage die, gp figure, XP figure, and reward figure.
 * sourceTier is the book's own CR/Challenge figure, kept ONLY as a
 * rough tier hint for ordering (low/mid/high/endgame). It is NOT a
 * mechanic: combat is resolved by mapping the villain onto an existing
 * 2024 NPC/monster family at use time, under the app's own difficulty
 * system, and tier gating stays with that system.
 *
 * Seeding rule (Zach, 2026-10-27, still in force): templates are dealt
 * sparsely (seeded material ~5-10% of play), through a declinable hook,
 * never front-loaded, never forced. A declined or ignored hook is
 * recorded so it is not re-offered identically, and the world moves on.
 * Names and places below are reskin material for an unrecorded FR
 * pocket, never FR canon. Rename at use where reskinNote says so.
 */

export const VILLAIN_TEMPLATES = [
  {
    id: 'selene-nightshade',
    name: 'Selene Nightshade',
    title: 'The Mistress of Shadows',
    appearance:
      'Slender and graceful, pale almost translucent skin, piercing crystalline blue eyes, long midnight-black hair in intricate braids interwoven with small onyx beads, form-fitting obsidian robes patterned like intertwining shadow tendrils. Moves fluidly and deliberately; voice melodic and enchanting, unsettling in its otherworldly quality.',
    personality:
      'Unpredictable and veiled. Changes tactics, reveals unexpected layers and alliances or betrayals, keeps true motives shrouded and lets players uncover fragments through investigation. Show via action and manipulation, never by narrating her internal state.',
    origin:
      'Born to a once-noble family slain in a raid on their estate, left orphaned and alone. Latent arcane ability, fuelled by grief and anger, drew her to a hidden coven of shadow-worshipping sorcerers led by Malachi Darkthorn. She surpassed her master and became a revered figure within the coven.',
    personalGoal:
      'Attain unrivalled mastery of shadow magic, rule a world cast into eternal darkness under her authority, and transcend mortality to a higher, godlike state. Power, dominion, and ascendancy are three faces of the same goal, not three separate quests.',
    faction: {
      name: 'Shadow coven',
      relationship: 'leads and uses',
      goal: 'Spread shadow rule and corrupt institutions, dismantling existing power structures in the name of reshaping the world.',
    },
    minions: [
      { name: 'Shadowstalkers', role: 'Elite assassins and spies, eyes and ears, strike from shadow' },
      { name: 'Morwen Blackthorn', role: 'Necromancer ally commanding a legion of undead enforcers' },
    ],
    lair:
      'The Lair of Shadows, hidden deep in a labyrinthine network of underground caverns, reached only by treacherous concealed paths. Twisting corridors, shadow-filled chambers, traps, illusions, magical wards, and shadowy sentinels; within, a vault of ancient tomes, forbidden grimoires, and enchanted artefacts, plus a network of contacts and informants.',
    hook:
      'The Veil of Eternal Night: rumours of growing darkness, lengthening shadows, fading light. A desperate village on a kingdom’s outskirts has fallen under her influence — shadowy minions infiltrating, crops withering, livestock sickening, community near collapse. Village elders speak of a prophecy and of fragments of a Dawnstone that could challenge her. Offered, declinable, never forced.',
    alternativeEndings: [
      'Triumph of Light: the Dawnstone fragments are gathered, her defences overcome, and eternal night is dispelled.',
      'Shadow Ascendancy: she outmanoeuvres the party, seizes the Dawnstone for herself, and the campaign becomes resistance against her shadowy reign.',
      'Sacrificial Balance: the party learns she seeks a cosmic balance disrupted by outside forces, and must choose between destroying her and restoring light at a cost, or a harder balance.',
    ],
    sourceTier: 13,
    reskinNote: 'Dawnstone, Malachi Darkthorn, and the coven are book names; rename for an unrecorded FR pocket. Eternal night is a threat shape, not an FR canon event.',
  },
  {
    id: 'thaddeus-swiftblade',
    name: 'Thaddeus Swiftblade',
    title: 'The Bandit King',
    appearance:
      'Imposing, about six and a half feet tall, muscular build earned from a life on the fringes, confident bearing, steady eye contact, calm tone. Dresses dark, moves with the assurance of someone accustomed to being in control and expecting acknowledgement of his authority.',
    personality:
      'A tapestry of contradictions: principled and brutal, honourable and criminal. Earns respect and loyalty rather than ruling by fear alone. Forces questions about right and wrong — players should be torn between duty and empathy, not handed a simple villain.',
    origin:
      'Born in a small village on the outskirts of society, overlooked and poor, survived by nimble fingers and quick wits. Rose through the criminal underworld, clashed with rival gang leader Marcellus Blackthorn in a duel of wits and steel, spared his defeated foe, and reshaped his understanding of leadership and honour.',
    personalGoal:
      'Freedom and justice for the oppressed: use ill-gotten gains to destabilise an unjust established order, protect those on the fringes, and be recognised as a worthy adversary and leader, not merely a criminal.',
    faction: {
      name: 'His bandit gang',
      relationship: 'leads',
      goal: 'Survive outside the law, redistribute from the powerful, and keep the common folk sympathetic enough that authorities cannot move against the gang without risking popular backlash.',
    },
    minions: [
      { name: 'Lady Valeria Blackthorn', role: 'Strikingly beautiful, cunning noblewoman ally wielding charm and influence' },
      { name: 'Malakai', role: 'Muscular, shaven-headed enforcer' },
      { name: 'Shadow agents', role: 'Agents who strike swiftly and lethally from darkness on his behalf' },
    ],
    lair:
      'A well-guarded stronghold serving as both sanctuary and hub for criminal operations, approached in eerie silence broken by wind. Only those deemed worthy, or who have proven themselves, are welcomed inside.',
    hook:
      'The Stolen Relic: a gem of immense magical power, Eloria, safeguarded for centuries in an ancient temple, is now rumoured loose. Priests plead for help tracking it down; Thaddeus seeks to harness its power for his own agenda. The party must decide whether to stop him, help him, or use him.',
    alternativeEndings: [
      'A Shattered Alliance: an alliance with Thaddeus breaks under the weight of his methods or the party’s loyalties.',
      'Confrontation and choice: the party confronts him and must weigh duty against empathy for the injustices he seeks to rectify.',
    ],
    sourceTier: 3,
    reskinNote: 'Eloria, Marcellus and Valeria Blackthorn are book names; rename for FR. The sympathetic-bandit pattern is the value, not the names.',
  },
  {
    id: 'zephyrion',
    name: 'Zephyrion',
    title: 'The Stormwyrm',
    appearance:
      'An ancient dragon, serpentine body over seventy feet long, vibrant azure scales like an approaching thunderstorm, cracks of static energy dancing across them, horns like lightning bolts, colossal wings wide enough to darken the sky, snout of razor-sharp obsidian-like teeth.',
    personality:
      'Grandeur and corrupted majesty. Once a noble guardian, now perverse and chaotic. Emphasise scale and elemental fury in action and description; do not reduce it to a monster that simply attacks on sight — its corruption is the story.',
    origin:
      'Born within the heart of a raging storm, with an innate connection to wind and lightning. Spent early years as a guardian of harmony and balance, keeping watch over the natural world. Stumbled on the Stormheart, an ancient artefact whispering promises of greater power, succumbed to its corrupting grip, and turned from protector to bringer of chaos.',
    personalGoal:
      'Unleash storm and chaos on the realm it once guarded, driven by the Stormheart’s corruption and a perverse desire for dominion over the elements. Not conquest for territory — ruin as an expression of corrupted nature.',
    faction: {
      name: 'Creatures of the storm and twisted mages',
      relationship: 'draws to itself',
      goal: 'Serve and spread the storm’s wrath, allying with dark entities drawn to the corrupted dragon.',
    },
    minions: [
      { name: 'Storm creatures', role: 'Creatures of storm drawn to Zephyrion’s side' },
      { name: 'Twisted mages', role: 'Mages allied with the corrupted dragon' },
    ],
    lair:
      'The Dragon’s Lair, a high storm-wracked seat from which it takes to the skies. The book gives it a lair with storm effects; this module records only the place and its storm character, no lair actions or regional mechanics.',
    hook:
      'Storms of unparalleled ferocity sweep a realm the dragon once protected; lightning strikes fear into mortals, rivers and lands suffer. Heroes are called to rise against a former guardian whose corruption makes victory treacherous. Endgame-tier shape only — do not deal early.',
    alternativeEndings: [
      'The corrupted guardian is confronted and its storm is ended, at great cost.',
      'The Stormheart’s corruption endures and the storm continues, becoming a long war against chaos rather than a single battle.',
    ],
    sourceTier: 20,
    reskinNote: 'Stormheart is a book artefact name; rename for FR. Deal only at endgame tier; sourceTier 20 is an ordering hint, not a level gate in this module.',
  },
  {
    id: 'lady-evangeline-blackthorn',
    name: 'Lady Evangeline Blackthorn',
    title: 'Noblewoman and cult leader',
    appearance:
      'Noble bearing, influential presence, shrouded in mystery and treachery. Political manoeuvring is her surface; the cult behind her is what she hides. Emotionally detached in pursuit of her aims, which makes her harder to read than a raging villain.',
    personality:
      'Calculating, patient, detached. Deflects suspicion, uses political position as cover, lets followers act while she stays respectable. Show her through denials, delays, and other people’s loyalty, never by narrating her cult allegiance.',
    origin:
      'Hailed from a long line of influential nobles. Matured into political manoeuvring, developed an insatiable thirst for power and recognition, and built a cult of fervent worshippers behind her respectable public life, seeking to etch her name into history.',
    personalGoal:
      'Power and recognition that outlasts a single lifetime: a name etched into history, achieved through political control and a secret cult, not through open war.',
    faction: {
      name: 'Her cult',
      relationship: 'leads in secret',
      goal: 'Worship and advance Evangeline, deflect suspicion from her, and carry out actions she cannot be seen to order.',
    },
    minions: [
      { name: 'Cult worshippers', role: 'Fervent followers who act on her behalf and shield her from suspicion' },
    ],
    lair:
      'Lady Evangeline’s Lair, a noble seat with a hidden cult heart beneath its respectable surface. The book gives lair mechanics; this module records only the place and its double character.',
    hook:
      'A noblewoman of influence is suspected, but never caught, in a string of political and cult-linked events. The party is drawn in by authorities, rivals, or victims, and must prove what respectable power is hiding — or be used by it.',
    alternativeEndings: [
      'Apprehension: she is exposed and taken by the city’s authorities.',
      'Escape through respectability: suspicion deflects, and she survives to act again, more carefully.',
    ],
    sourceTier: 7,
    reskinNote: 'Blackthorn is a book family name shared with other entries; do not treat shared surnames as shared FR canon. Rename the family for FR if needed.',
  },
  {
    id: 'kharok-ironblood',
    name: 'Kharok Ironblood',
    title: 'The Warbringer',
    appearance:
      'A warlord whose presence instils fear and awe in those who oppose him. Leadership and tactical bearing are his surface; the destined-leader story told about him by shamans is part of his power, not just his past.',
    personality:
      'Tactical, relentless, convinced of destiny. Leads by the prophecy of a destined leader foretold by shamans, and by the loyalty that story buys. Show through discipline, strategy, and the devotion of followers, not through boasts alone.',
    origin:
      'Rose as a figure shamans foretold as a destined leader. His journey towards unifying forces under his banner began with that prophecy and with an insatiable thirst that followers read as destiny rather than mere ambition.',
    personalGoal:
      'Unify the world under his leadership through conquest — a warbringer’s unification, not a king’s inheritance. The goal is the unification itself, achieved by force and tactical superiority.',
    faction: {
      name: 'His war host',
      relationship: 'leads',
      goal: 'Conquer and unify, following Kharok as the foretold leader.',
    },
    minions: [
      { name: 'War host creatures and warriors', role: 'Forces that serve Kharok and carry out his campaigns' },
    ],
    lair:
      'Kharok’s Lair, a war camp and stronghold from which campaigns are launched. The book gives lair mechanics; this module records only the place as a military seat.',
    hook:
      'A unifying warlord is on the move, and towns, factions, and the party must choose: join, resist, flee, or use the war for their own ends. The hook is the war itself, not a single dungeon.',
    alternativeEndings: [
      'The war host is broken and unification fails, scattering followers.',
      'Unification succeeds in part, and the party must live in the order Kharok creates.',
    ],
    sourceTier: 10,
    reskinNote: 'Kharok is a book warlord; place his campaign in an unrecorded pocket or as a distant war felt through news and refugees, never as an FR canon war.',
  },
  {
    id: 'rak-thar',
    name: 'Rak’Thar',
    title: 'Demon of consumption',
    appearance:
      'A terrifying demonic force leaving destruction in its wake, a vessel for malevolence. Its presence is devouring and eerie, carved in darkness; followers and spawn carry its aura rather than merely obeying orders.',
    personality:
      'Voracious and manipulative. Craves consumption of dark power and uses others’ vulnerabilities to further its own goals. Its original intent, in the book’s telling, was twisted from safeguarding realms into devouring them — show that inversion through what it consumes, not through exposition.',
    origin:
      'A demon whose original intent was to safeguard realms, corrupted over centuries into a vessel for malevolence. Its voracious appetite grew with its power, and its legend became one of terror and devouring.',
    personalGoal:
      'Consume dark power and expand its dominion by devouring what others value — souls, power, realms — until nothing stands against its appetite.',
    faction: {
      name: 'Darkspawn',
      relationship: 'creates and commands',
      goal: 'Serve Rak’Thar’s consumption, carved by the claws of the damned, spreading its eerie influence.',
    },
    minions: [
      { name: 'Darkspawn', role: 'Spawn with an inherent eerie aura, serving Rak’Thar’s devouring goals' },
    ],
    lair:
      'Rak’Thar’s Lair, a dark place carved by the claws of the damned. The book gives lair mechanics; this module records only the place and its devouring character.',
    hook:
      'A devouring demon’s influence spreads; people, places, or powers the party values begin to be consumed or corrupted. The party is drawn by loss, by rumour, or by their own ambitions intersecting its location.',
    alternativeEndings: [
      'Rak’Thar is confronted and its consumption is halted, at least for a time.',
      'A tenuous balance: it is contained, not destroyed, and its hunger remains a standing threat.',
    ],
    sourceTier: 14,
    reskinNote: 'Rak’Thar is a book demon; do not import it as an FR canon demon lord. Reskin origin and name for an unrecorded pocket, or use the consumption pattern with a 2024 demon family.',
  },
  {
    id: 'bloodclaw',
    name: 'Bloodclaw',
    title: 'The Dire Alpha',
    appearance:
      'A dire lycanthrope alpha commanding a pack of savage corrupted werebears with ease. Thunderous presence, a roar that once stilled a bustling region, a sprawling cavern lair concealed by thick undergrowth and gnarled trees.',
    personality:
      'Hunger-driven and pack-bound. Insatiable hunger through the ages, loyalty enforced by the curse, authority maintained by raids and fear. Pack members lay down their lives in service; that loyalty is the horror, not just the claws.',
    origin:
      'Through the ages, Bloodclaw’s insatiable hunger grew, and it built a pack by spreading the curse of lycanthropy, adding those with potential to its ranks. A once-bustling region fell silent under its thunderous roar and its raids.',
    personalGoal:
      'Expand and sustain the pack: spread the curse, add new members, raid nearby settlements for sustenance and dominance, and keep the local populace fearful and compliant.',
    faction: {
      name: 'The dire pack',
      relationship: 'leads as alpha',
      goal: 'Grow the pack, hold territory around the lair, and raid settlements to sustain itself.',
    },
    minions: [
      { name: 'Corrupted werebears', role: 'Pack members, savage and loyal, serving the Dire Alpha' },
    ],
    lair:
      'A sprawling network of caverns concealed by thick undergrowth, dense foliage acting as natural cover, surrounded by tainted land for about a mile: gnarled trees, shadowed perceptions, unnatural resilience in the lair and its surroundings. Description only; no regional mechanics imported.',
    hook:
      'A region is tainted by a lycanthrope pack: raids on nearby settlements, a populace kept fearful, a lair hidden in the wilds. The party may be hired to end the raids, may be drawn by a victim, or may stumble on the taint while travelling.',
    alternativeEndings: [
      'Tenuous Peace: the pack is broken or bargained with, and a fragile peace holds.',
      'Tenuous Balance: Bloodclaw survives, contained but not ended, and the curse remains a standing threat.',
    ],
    sourceTier: 5,
    reskinNote: 'Bloodclaw is a book lycanthrope alpha; map combat to a 2024 lycanthrope family at use. The curse-spreading pattern is the value.',
  },
  {
    id: 'baroness-seraphina-shadowheart',
    name: 'Baroness Seraphina Shadowheart',
    title: 'Vampire seeking redemption',
    appearance:
      'A baroness whose dark secret and desperate quest for redemption shape her bearing. Vampirism is her condition and her burden, not a costume; her impulses threaten to derail a noble quest, which is visible in restraint, not in narration of her thoughts.',
    personality:
      'Torn and restrained. A dark secret and a desperate transformation into a creature of the night began a quest for redemption that her own impulses constantly threaten. She must be played as someone fighting herself, shown through choices and restraint, not through internal monologue.',
    origin:
      'A baroness who became a vampire and began a quest for redemption, seeking a way to undo or atone for darkness while granting herself a chance at redemption. Her mortality faded, replaced by a never-ending thirst she must master.',
    personalGoal:
      'Redemption: find a way to atone for vampirism and its deeds, despite impulses that threaten to derail that quest. This is a goal that conflicts with her own nature, which is why it is interesting.',
    faction: {
      name: 'Her household and thralls',
      relationship: 'leads, uneasily',
      goal: 'Serve and protect the baroness while she pursues redemption, even as her nature endangers them.',
    },
    minions: [
      { name: 'Household servants and thralls', role: 'Those bound to the baroness, serving her redemption quest and her household' },
    ],
    lair:
      'The Baroness’ Lair, a noble seat with a vampiric heart. The book gives lair mechanics and vampire weaknesses; this module records only the place, and notes that weaknesses exist to be rebuilt in 2024 form at use, not imported here.',
    hook:
      'Rumours circulate about a mysterious baroness, a noble quest, and a dark secret. The party may be drawn by her plea, by victims, or by their own moral stance, and must decide whether to help a monster seeking redemption or to end her.',
    alternativeEndings: [
      'Embracing a moral stance: the party helps or judges her on the terms of redemption she seeks.',
      'Redemption fails: impulses win, and the baroness becomes the threat she was trying not to be.',
    ],
    sourceTier: 8,
    reskinNote: 'This Seraphina is a book character, NOT the Seraphine of the earlier test scenes (who is not a campaign character). Do not merge them. Rename for FR if the name collides in play.',
  },
  {
    id: 'brother-percival-brightmore',
    name: 'Brother Percival Brightmore',
    title: 'The Benevolent Deceiver',
    appearance:
      'A holy man believed by all to be a paragon of virtue: soothing tone, empathetic manner, benevolent bearing. The deception is in the gap between that surface and what his prayers actually do — show the surface, never narrate the siphoning.',
    personality:
      'Empathetic in manner, manipulative in fact. Makes an effort to appear empathetic and soothing, guides prayers skilfully, and uses benevolence as cover. This is the hidden-agenda pattern in its purest book form: a significant secret, played, not announced.',
    origin:
      'A tale of a holy man who, seeking knowledge, delved into a forbidden tome detailing dark arts. He learned to guide prayers so as to siphon the life force of the faithful, while remaining believed to be a paragon of virtue.',
    personalGoal:
      'Immortality and power through deception: siphon life force through prayer, grow in power while remaining trusted, and complete a ritual that cements that power — all while being believed virtuous.',
    faction: {
      name: 'His congregation',
      relationship: 'uses as cover and resource',
      goal: 'Worship, trust, and pray as Percival guides them, unknowingly feeding his siphoning.',
    },
    minions: [
      { name: 'Devoted followers', role: 'Faithful who defend Percival’s virtue and carry out his guidance, unknowingly' },
    ],
    lair:
      'A shrine or temple seat where Percival guides prayer and conducts his ritual. The book gives lair mechanics; this module records only the place as a trusted holy site with a hidden ritual purpose.',
    hook:
      'Rumours circulate about a mysterious holy man, and about prayers that leave the faithful drained. The party may be drawn by victims, by a rival clergy, or by Percival’s own invitation to a ritual — and must expose his true nature before the ritual completes, or be deceived into helping it.',
    alternativeEndings: [
      'Exposure: his true nature is revealed and the ritual is disrupted in a climactic showdown.',
      'Deception holds: he remains believed virtuous, and the siphoning continues, now more carefully hidden.',
    ],
    sourceTier: 15,
    reskinNote: 'Percival is the clearest fit for the app’s system-rolled hidden-agenda problem. Use the pattern (trusted holy figure, secret siphoning) with a 2024 cleric/cultist family at use; do not import his book mechanics.',
  },
  {
    id: 'vossan-kragmire',
    name: 'Vossan Kragmire',
    title: 'The Plaguebearer',
    appearance:
      'A dwarf of mere four feet, wiry and hunched, tattered stained robes faded to a sickly hue of decay, fingers stained with toxin residue twitching with nervous energy, deep-set eyes flickering with manic intensity, wild unkempt beard once fiery red now matted and grey-patched, pallid sunken cheeks. A stench of decay hangs wherever he goes; his boots leave traces behind him.',
    personality:
      'Mad, sadistic, cunning, and delusional. Derives pleasure from suffering as proof of power, speaks in cryptic philosophical terms about purification through disease, retains sharp intellect and manipulation despite madness. Show through delight at plague effects, cryptic talk, and careful planning, never through a diagnosis narrated to the player.',
    origin:
      'As a young dwarf, showed remarkable aptitude for the arcane arts and was drawn to forbidden necromancy and disease, immersing himself in ancient tomes in secret. Experimented with alchemical concoctions harnessing disease itself; one night containment failed, a potent plague strain was unleashed on his own laboratory, and he should have succumbed but did not. Exiled by his dwarven kin as a pariah, he embraced the Plaguebearer identity and travelled spreading chaos.',
    personalGoal:
      'Enlightenment through widespread suffering: unleash deadly plagues on a world he sees as stagnant and complacent, force humanity to confront its own decay, and thereby purify the souls of survivors. Cataclysm as purification, in his distorted vision, plus recognition and validation for his genius.',
    faction: {
      name: 'The Afflicted and his alchemical following',
      relationship: 'leads and weaponises',
      goal: 'Spread contagion, sow suffering, and prove Vossan’s vision of purification through disease.',
    },
    minions: [
      { name: 'Gravok the Foul', role: 'Hulking former gladiator, trusted lieutenant and enforcer, steeped in Vossan’s concoctions' },
      { name: 'The Afflicted', role: 'Plague survivors turned foot soldiers, spreading contagion and sowing suffering' },
      { name: 'Alchemical Constructs', role: 'Bizarre grotesque constructs assembled from decay, assisting experiments and guarding the lair' },
      { name: 'The Ratkin Scourge', role: 'Ratkin civilisation allied by hunger and shared malevolence, spreading plague' },
    ],
    lair:
      'An ancient labyrinthine laboratory and lair, pungent with decay, walls bearing plague imagery, deepest recess holding a secret sacred space. Intruders face illusions, wards, traps, and shadowy sentinels in the book; this module records only the place and its pestilential character.',
    hook:
      'Heroes are approached by a high-ranking official, witness devastation from plague, or become embroiled in a deadly game around a supposed cure. A supposed creator of a cure may secretly be working with Vossan; a sister’s sacrifice may purge plague at great cost. The hook is the plague and the false hope around it, not a single dungeon.',
    alternativeEndings: [
      'Sacrificial Redemption: a sister offers herself as sacrifice, absorbing the plague within Vossan and purging it, at poignant cost.',
      'Uncovering the truth: heroes uncover Vossan’s secrets, face the horrors unleashed, and bring a city closer to collapse or to a cure — depending on choices made along the way.',
    ],
    sourceTier: 11,
    reskinNote: 'SourceTier 11 comes from the book’s statblock figure, since the intro does not cleanly state it; it is still only a tier hint, and no figure from that block is imported here. Plague mechanics must be rebuilt in 2024 form at use, if used at all.',
  },
];

export function villains() {
  return VILLAIN_TEMPLATES.map((v) => ({
    ...v,
    faction: { ...v.faction },
    minions: v.minions.map((m) => ({ ...m })),
    alternativeEndings: [...v.alternativeEndings],
  }));
}

export function villainById(id) {
  const found = VILLAIN_TEMPLATES.find((v) => v.id === id);
  if (!found) return null;
  return {
    ...found,
    faction: { ...found.faction },
    minions: found.minions.map((m) => ({ ...m })),
    alternativeEndings: [...found.alternativeEndings],
  };
}

export function villainIds() {
  return VILLAIN_TEMPLATES.map((v) => v.id);
}
