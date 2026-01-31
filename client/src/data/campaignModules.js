// Published D&D 5e Campaign Modules
// These provide context for AI DM sessions to follow established storylines

export const CAMPAIGN_MODULES = [
  {
    id: 'custom',
    name: 'Custom Adventure',
    description: 'Create your own adventure with the Forgotten Realms settings',
    type: 'custom',
    icon: '✨',
    suggestedLevel: '1-20',
    setting: 'Forgotten Realms',
    themes: ['Your choice'],
    synopsis: 'Build your own adventure using the location, era, and hook options below.'
  },
  {
    id: 'curse-of-strahd',
    name: 'Curse of Strahd',
    description: 'Gothic horror adventure in the demiplane of Barovia',
    type: 'published',
    icon: '🧛',
    suggestedLevel: '1-10',
    setting: 'Barovia (Ravenloft)',
    year: 'Timeless (Barovia exists outside normal time)',
    themes: ['Gothic Horror', 'Dark Fantasy', 'Mystery', 'Survival'],
    synopsis: 'Under raging storm clouds, the vampire Count Strahd von Zarovich stands silhouetted against the ancient walls of Castle Ravenloft. Rumbling thunder pounds the castle spires. A lightning flash rips through the darkness, illuminating Strahd\'s bytes diabolical smile. The master of Castle Ravenloft is having guests for dinner.',
    keyLocations: ['Village of Barovia', 'Castle Ravenloft', 'Vallaki', 'Krezk', 'Amber Temple', 'Argynvostholt'],
    keyNpcs: ['Strahd von Zarovich', 'Ireena Kolyana', 'Ismark Kolyanovich', 'Madam Eva', 'Van Richten', 'Ezmerelda'],
    plotPoints: [
      'Mysterious mists transport adventurers to Barovia',
      'The land is cursed, trapped in eternal gloom under Strahd\'s rule',
      'Ireena Kolyana is Strahd\'s obsession - she resembles his lost love Tatyana',
      'The Tarokka card reading from Madam Eva reveals the path to defeating Strahd',
      'Sacred artifacts hidden throughout Barovia can aid in the final battle',
      'Strahd toys with the party, appearing when least expected',
      'The Dark Powers of the Amber Temple offer tempting but corrupting gifts',
      'Only by confronting Strahd in Castle Ravenloft can the curse be broken'
    ],
    dmGuidance: 'Maintain an atmosphere of dread and helplessness. Strahd should appear periodically to toy with the party - he views them as entertainment. Use the Tarokka reading to guide the adventure structure. The mists should feel inescapable. Gothic horror elements: isolation, madness, corruption, doomed romance.'
  },
  {
    id: 'vecna-eve-of-ruin',
    name: 'Vecna: Eve of Ruin',
    description: 'Epic multiverse-spanning adventure against the lich-god Vecna',
    type: 'published',
    icon: '💀',
    suggestedLevel: '10-20',
    setting: 'Multiverse (multiple settings)',
    year: '1492 DR (starts in Forgotten Realms)',
    themes: ['Epic Fantasy', 'Planar Travel', 'Cosmic Horror', 'High Stakes'],
    synopsis: 'The lich-god Vecna is on the verge of remaking the multiverse in his own image. Heroes must travel across multiple D&D settings to gather legendary artifacts and allies to stop his apocalyptic ritual before reality itself is unmade.',
    keyLocations: ['Sigil', 'Greyhawk', 'Krynn', 'Eberron', 'Ravenloft', 'Forgotten Realms', 'Pandemonium'],
    keyNpcs: ['Vecna', 'Kas the Bloody-Handed', 'Alustriel Silverhand', 'Tasha', 'Lord Soth', 'Mordenkainen'],
    plotPoints: [
      'Vecna has discovered a ritual to remake all of existence',
      'Fragments of the Rod of Seven Parts are scattered across the multiverse',
      'Heroes must travel to iconic D&D worlds to find the rod pieces',
      'Kas, Vecna\'s traitorous vampire lieutenant, may be an unlikely ally',
      'Each world visited has its own threats and challenges',
      'Vecna\'s cultists pursue the party across realities',
      'The final confrontation takes place as Vecna attempts to complete his ritual',
      'The fate of the entire multiverse hangs in the balance'
    ],
    dmGuidance: 'Emphasize the epic scale - entire worlds are at stake. Each setting visited should feel distinct. Vecna is cunning and patient - he\'s planned this for millennia. Use the multiverse hopping to incorporate elements from the player\'s previous adventures. The tone should escalate from urgent to desperate as Vecna nears his goal.'
  },
  {
    id: 'tomb-of-annihilation',
    name: 'Tomb of Annihilation',
    description: 'Deadly jungle expedition and dungeon delve in Chult',
    type: 'published',
    icon: '💀',
    suggestedLevel: '1-11',
    setting: 'Chult (Forgotten Realms)',
    year: '1489 DR',
    themes: ['Exploration', 'Survival', 'Dungeon Crawl', 'Death'],
    synopsis: 'A death curse has befallen everyone who\'s ever been raised from the dead. Its victims are rotting away, and resurrection magic has ceased to function. The cure lies somewhere in Chult, a land of jungles, dinosaurs, and the undead.',
    keyLocations: ['Port Nyanzaru', 'The Jungle of Chult', 'Omu', 'The Tomb of the Nine Gods', 'Camp Righteous', 'Firefinger'],
    keyNpcs: ['Acererak', 'Syndra Silvane', 'The Nine Trickster Gods', 'Ras Nsi', 'Artus Cimber', 'Dragonbait'],
    plotPoints: [
      'The death curse originates from the Soulmonger deep in Chult',
      'Expedition through deadly jungle filled with undead and dinosaurs',
      'The lost city of Omu holds the entrance to the tomb',
      'Nine trickster gods offer their power to those who find their shrines',
      'Ras Nsi and the yuan-ti control Omu',
      'The Tomb of the Nine Gods is a deadly trap-filled dungeon',
      'Acererak the demilich created the Soulmonger to feed the Atropal',
      'Destroying the Soulmonger ends the curse but faces Acererak\'s wrath'
    ],
    dmGuidance: 'This adventure is notoriously deadly - communicate this to players. The jungle exploration should feel dangerous and rewarding. Use the hex crawl to build tension. The tomb itself is a brutal test - players should feel accomplishment surviving each room. The death curse creates real urgency.'
  },
  {
    id: 'waterdeep-dragon-heist',
    name: 'Waterdeep: Dragon Heist',
    description: 'Urban intrigue and treasure hunt in the City of Splendors',
    type: 'published',
    icon: '🐉',
    suggestedLevel: '1-5',
    setting: 'Waterdeep (Forgotten Realms)',
    year: '1492 DR',
    themes: ['Urban Adventure', 'Intrigue', 'Investigation', 'Faction Politics'],
    synopsis: 'A fantastic treasure trove is yours for the taking in this adventure for the world\'s greatest roleplaying game. Factions compete for a cache of dragons hidden in Waterdeep, and the adventurers are caught in the middle.',
    keyLocations: ['Trollskull Manor', 'Trollskull Alley', 'The Yawning Portal', 'Castle Waterdeep', 'The Vault of Dragons'],
    keyNpcs: ['Volothamp Geddarm', 'Renaer Neverember', 'Laeral Silverhand', 'The Cassalanters', 'Jarlaxle', 'Xanathar', 'Manshoon'],
    plotPoints: [
      'Half a million gold dragons are hidden somewhere in Waterdeep',
      'Lord Neverember embezzled the gold before his exile',
      'Multiple villains seek the treasure: Xanathar, the Cassalanters, Jarlaxle, or Manshoon',
      'A Stone of Golorr holds the key to finding the vault',
      'The adventurers inherit Trollskull Manor and must manage it',
      'Faction alliances determine allies and enemies',
      'The chase through Waterdeep\'s streets leads to the hidden vault',
      'Recovering the gold has political implications for the city'
    ],
    dmGuidance: 'This is a heist story - emphasize investigation and social encounters over combat. Waterdeep should feel alive with factions vying for power. Let players run their tavern and build connections. The villain (chosen by season/DM preference) should be a constant background threat. Urban adventures reward creative problem-solving.'
  },
  {
    id: 'rime-of-the-frostmaiden',
    name: 'Rime of the Frostmaiden',
    description: 'Survival horror in the frozen north of Icewind Dale',
    type: 'published',
    icon: '❄️',
    suggestedLevel: '1-12',
    setting: 'Icewind Dale (Forgotten Realms)',
    year: '1489 DR',
    themes: ['Survival Horror', 'Isolation', 'Secrets', 'Cold'],
    synopsis: 'Icewind Dale has become trapped in a perpetual winter. Auril the Frostmaiden has drawn a veil of darkness over the region, trapping its inhabitants in endless night. Paranoid townsfolk whisper of sacrifice while the cold closes in.',
    keyLocations: ['Ten-Towns', 'The Spine of the World', 'The Netherese City of Ythryn', 'Grimskalle', 'The Reghed Glacier'],
    keyNpcs: ['Auril the Frostmaiden', 'Avarice', 'Vellynne Harpell', 'Sephek Kaltro', 'Dzaan', 'Speaker Duvessa Shane'],
    plotPoints: [
      'Auril has cursed Icewind Dale with everlasting winter',
      'Each town has dark secrets the residents are hiding',
      'Human sacrifices are being made to appease the Frostmaiden',
      'A crashed Netherese flying city lies buried in the glacier',
      'The Arcane Brotherhood seeks ancient magic in the ice',
      'Reaching Auril\'s island fortress of Grimskalle reveals her weakness',
      'The lost city of Ythryn holds a mythallar that could end the curse',
      'Confronting Auril directly is the only way to free Icewind Dale'
    ],
    dmGuidance: 'Emphasize the oppressive cold and darkness - it should feel like the land itself is hostile. Each town has its own character and secrets; explore them. Paranoia and isolation drive people to do terrible things. The survival elements (food, warmth, light) create constant low-level tension. Auril is an uncaring goddess, not a villain with a plan.'
  },
  {
    id: 'storm-kings-thunder',
    name: 'Storm King\'s Thunder',
    description: 'Giants rampage across the Sword Coast as their ordning shatters',
    type: 'published',
    icon: '⛈️',
    suggestedLevel: '1-11',
    setting: 'Sword Coast (Forgotten Realms)',
    year: '1486 DR',
    themes: ['Giants', 'Sandbox', 'Politics', 'Epic Scale'],
    synopsis: 'Giants have emerged from their strongholds to threaten civilization as never before. Hill giants are stealing grain, stone giants are razing settlements, frost giants are raiding coastal towns, and fire giants are gathering slaves. Meanwhile, the storm giants\' ordning has collapsed.',
    keyLocations: ['Nightstone', 'Bryn Shander', 'Triboar', 'Goldenfields', 'Maelstrom', 'Eye of the All-Father'],
    keyNpcs: ['King Hekaton', 'Serissa', 'Iymrith', 'Zephyros', 'Harshnag', 'Duke Zalto', 'Chief Guh'],
    plotPoints: [
      'The giant ordning (social hierarchy) has shattered',
      'Each giant type is trying to prove themselves worthy of ruling',
      'King Hekaton of the storm giants has disappeared',
      'The blue dragon Iymrith is manipulating events from the shadows',
      'The Eye of the All-Father oracle can reveal the truth',
      'Harshnag the frost giant may become an unlikely ally',
      'Each giant lord must be confronted in their stronghold',
      'Rescuing Hekaton and defeating Iymrith can restore the ordning'
    ],
    dmGuidance: 'This is a sandbox adventure - let players explore the Sword Coast freely. Giants should feel massive and threatening. Each giant type has distinct culture and goals. The political intrigue among storm giants mirrors human court drama. Iymrith should be a shocking reveal. Use the scale of the world to create epic moments.'
  },
  {
    id: 'baldurs-gate-descent',
    name: 'Baldur\'s Gate: Descent into Avernus',
    description: 'Journey from Baldur\'s Gate into the first layer of the Nine Hells',
    type: 'published',
    icon: '🔥',
    suggestedLevel: '1-13',
    setting: 'Baldur\'s Gate & Avernus',
    year: '1494 DR',
    themes: ['Hellscape', 'Redemption', 'War', 'Mad Max'],
    synopsis: 'Diabolical dangers await in this adventure for the world\'s greatest roleplaying game. Baldur\'s Gate is being pulled into Avernus, the first layer of the Nine Hells. As the city falls, heroes must journey into the hellscape to save it.',
    keyLocations: ['Baldur\'s Gate', 'Elturel', 'Fort Knucklebone', 'The Wandering Emporium', 'The Bleeding Citadel'],
    keyNpcs: ['Zariel', 'Mad Maggie', 'Lulu', 'Reya Mantlemorn', 'Thavius Kreeg', 'Sylvira Savikas'],
    plotPoints: [
      'The city of Elturel has been dragged into Avernus',
      'A holy sword called the Companion hung over Elturel as protection - it was actually a devil\'s trap',
      'Baldur\'s Gate will be next unless the heroes intervene',
      'Lulu the hollyphant holds memories that could redeem Zariel',
      'Infernal war machines are key to surviving Avernus',
      'Zariel was once an angel who fell while fighting demons',
      'The Sword of Zariel could redeem her or destroy her',
      'The Blood War between devils and demons rages across Avernus'
    ],
    dmGuidance: 'Avernus should feel like a Mad Max-style wasteland meets hellish nightmare. War machines are awesome - let players customize them. Moral choices are key - redemption vs. pragmatism. Zariel is tragic, not simply evil. Devils make deals; everything has a price. The Blood War provides constant background chaos.'
  },
  {
    id: 'ghosts-of-saltmarsh',
    name: 'Ghosts of Saltmarsh',
    description: 'Nautical adventures in a haunted coastal town',
    type: 'published',
    icon: '⚓',
    suggestedLevel: '1-12',
    setting: 'Saltmarsh (Greyhawk/Forgotten Realms)',
    year: '1480 DR (or setting flexible)',
    themes: ['Nautical', 'Horror', 'Investigation', 'Coastal'],
    synopsis: 'Nestled on the coast of the Azure Sea is Saltmarsh, a sleepy fishing village that sits on the precipice of destruction. Smugglers guide their decadent ships to hidden coves, cult worship festers in nearby ruins, and a war with the sea lurks just over the horizon.',
    keyLocations: ['Saltmarsh', 'The Haunted House', 'The Sea Ghost', 'The Lizardfolk Lair', 'The Final Enemy', 'Isle of the Abbey'],
    keyNpcs: ['Eliander Fireborn', 'Eda Oweland', 'Gellan Primewater', 'Anders Solmor', 'The Scarlet Brotherhood'],
    plotPoints: [
      'A haunted house on the cliff hides a smuggling operation',
      'The smugglers are running weapons to lizardfolk',
      'The lizardfolk are actually preparing to fight sahuagin invaders',
      'An alliance with the lizardfolk may be necessary',
      'The sahuagin plan a massive assault on the coast',
      'Political factions in Saltmarsh have their own agendas',
      'The Scarlet Brotherhood operates in the shadows',
      'Naval combat and ship ownership become central'
    ],
    dmGuidance: 'This is a collection of linked adventures - each can stand alone but together tell a larger story. Ship rules and naval combat are key features. Saltmarsh should feel like a living town with factions. The horror elements are subtle - creepy rather than terrifying. Let players acquire and customize their own ship.'
  },
  {
    id: 'tales-yawning-portal',
    name: 'Tales from the Yawning Portal',
    description: 'Classic dungeon crawls updated for 5th Edition',
    type: 'published',
    icon: '🕳️',
    suggestedLevel: '1-15',
    setting: 'Various (Forgotten Realms frame)',
    year: 'Various (1350s-1480s DR)',
    themes: ['Dungeon Crawl', 'Classic Adventures', 'Deadly', 'Exploration'],
    synopsis: 'Seven of the greatest dungeons in D&D history, updated for 5th Edition. From the Sunless Citadel to the Tomb of Horrors, these legendary adventures have challenged players for decades.',
    keyLocations: ['The Sunless Citadel', 'The Forge of Fury', 'The Hidden Shrine of Tamoachan', 'White Plume Mountain', 'Dead in Thay', 'Against the Giants', 'Tomb of Horrors'],
    keyNpcs: ['Meepo the Kobold', 'Keraptis', 'Acererak', 'The Fire Giant King Snurre'],
    plotPoints: [
      'The Sunless Citadel holds a corrupted druid and the Gulthias Tree',
      'The Forge of Fury contains a legendary dwarven blade',
      'White Plume Mountain\'s wizard Keraptis guards three sentient weapons',
      'The Hidden Shrine tests those who would claim Tamoachan treasure',
      'Against the Giants reveals a drow conspiracy behind giant raids',
      'Dead in Thay pits heroes against a Red Wizard phylactery vault',
      'The Tomb of Horrors is Acererak\'s legendary deathtrap'
    ],
    dmGuidance: 'These are classic dungeon crawls - exploration, traps, and combat. Each dungeon has its own tone. The Tomb of Horrors is notoriously deadly - warn players. The Yawning Portal tavern in Waterdeep connects the adventures thematically. These dungeons reward careful play and clever thinking over brute force.'
  },
  {
    id: 'pool-of-radiance',
    name: 'Pool of Radiance',
    description: 'Reclaim the ruined city of Phlan from monstrous occupation',
    type: 'published',
    icon: '✨',
    suggestedLevel: '1-10',
    setting: 'Phlan, Moonsea (Forgotten Realms)',
    year: '1340 DR',
    themes: ['City Reclamation', 'Classic', 'Monster Slaying', 'Faction Politics'],
    synopsis: 'The city of Phlan lies in ruins, occupied by monsters and ruled by a mysterious force. The city council offers bounties to adventurers brave enough to clear the districts one by one and discover what dark power controls the Pool of Radiance.',
    keyLocations: ['Civilized Phlan', 'Kuto\'s Well', 'Podol Plaza', 'Sokal Keep', 'Stojanow Gate', 'Valjevo Castle', 'The Pool of Radiance'],
    keyNpcs: ['Porphyrys Cadorna', 'The City Council', 'Tyranthraxus the Possessing Spirit', 'Sasha the Bard'],
    plotPoints: [
      'Phlan was destroyed 50 years ago and is slowly being reclaimed',
      'The city council hires adventurers to clear monster-held districts',
      'Each cleared area reveals more about the dark power behind the ruins',
      'Political factions on the council have hidden agendas',
      'The Pool of Radiance is an ancient artifact of immense power',
      'Tyranthraxus, a possessing spirit, seeks to use the Pool',
      'A bronze dragon guards secrets beneath the city',
      'The final confrontation occurs at Valjevo Castle'
    ],
    dmGuidance: 'This is a sandbox city-reclamation campaign. Let players choose which districts to tackle. The setting is grittier and more dangerous than modern Faerûn - civilization is tenuous. Phlan should feel like a frontier town. The 1340s DR era predates many familiar NPCs and events. Gold Box game nostalgia is a feature.'
  },
  {
    id: 'ruins-of-undermountain',
    name: 'Ruins of Undermountain',
    description: 'Explore the legendary megadungeon beneath Waterdeep',
    type: 'published',
    icon: '🏚️',
    suggestedLevel: '1-20',
    setting: 'Undermountain, Waterdeep (Forgotten Realms)',
    year: '1357 DR (pre-Time of Troubles)',
    themes: ['Megadungeon', 'Exploration', 'Madness', 'Ancient Secrets'],
    synopsis: 'Beneath the city of Waterdeep lies Undermountain, the vast dungeon complex created by the mad wizard Halaster Blackcloak. Countless adventurers have descended through the well in the Yawning Portal tavern. Few return.',
    keyLocations: ['The Yawning Portal Entry Well', 'The Dungeon Level', 'The Storeroom Level', 'The Sargauth Level', 'Skullport', 'Halaster\'s Domain'],
    keyNpcs: ['Halaster Blackcloak', 'Durnan (younger)', 'The Seven (Halaster\'s apprentices)', 'Trobriand the Metal Mage'],
    plotPoints: [
      'Halaster Blackcloak is mad but immensely powerful',
      'The dungeon constantly shifts and changes',
      'Halaster\'s seven apprentices each control regions',
      'Skullport is an underground city of criminals and outcasts',
      'Ancient portals connect Undermountain to other planes',
      'Halaster toys with adventurers for his own amusement',
      'The deeper levels hold pre-human secrets',
      'Escape is never guaranteed - the dungeon has a will of its own'
    ],
    dmGuidance: 'This is the classic megadungeon experience. The 1357 DR setting predates the Time of Troubles - gods still walk among mortals occasionally. Durnan is younger and still actively adventuring. Undermountain should feel endless and unknowable. Halaster is not a villain to defeat but a force of nature to survive. Let the dungeon itself be a character.'
  },
  {
    id: 'against-the-giants',
    name: 'Against the Giants',
    description: 'Battle through three giant strongholds to uncover a dark conspiracy',
    type: 'published',
    icon: '🏔️',
    suggestedLevel: '8-14',
    setting: 'Sword Coast (Forgotten Realms)',
    year: '1357 DR',
    themes: ['Giants', 'War', 'Conspiracy', 'Classic'],
    synopsis: 'Giants have been raiding civilized lands with alarming coordination. Someone - or something - is uniting them. Heroes must assault the Steading of the Hill Giant Chief, the Glacial Rift of the Frost Giant Jarl, and the Hall of the Fire Giant King to discover the truth.',
    keyLocations: ['The Steading of the Hill Giant Chief', 'The Glacial Rift of the Frost Giant Jarl', 'The Hall of the Fire Giant King', 'The Drow Outpost'],
    keyNpcs: ['Chief Nosnra', 'Jarl Grugnur', 'King Snurre Iron Belly', 'Eclavdra (Drow Priestess)'],
    plotPoints: [
      'Hill giants raid with unusual organization and purpose',
      'Evidence at each stronghold points to the next',
      'The frost giants serve a greater power',
      'Fire giants forge weapons for a coming war',
      'Drow agents manipulate the giants from the shadows',
      'A portal in the fire giant hall leads to the Underdark',
      'The conspiracy extends to the drow city of Erelhei-Cinlu',
      'This is the classic prelude to the Descent series'
    ],
    dmGuidance: 'This is the original giant-slaying adventure - brutal, tactical, and rewarding. Each stronghold is a self-contained dungeon with its own character. Hill giants are crude, frost giants are organized, fire giants are militaristic. The drow reveal should be a twist. Combat is frequent and deadly - giants hit hard. This adventure directly leads into Descent into the Depths.'
  },
  {
    id: 'temple-elemental-evil',
    name: 'Temple of Elemental Evil',
    description: 'Confront a legendary temple dedicated to chaotic evil',
    type: 'published',
    icon: '🌀',
    suggestedLevel: '1-8',
    setting: 'Village of Hommlet (Greyhawk/Adaptable)',
    year: '1357 DR (adaptable)',
    themes: ['Classic Evil', 'Dungeon Crawl', 'Cults', 'Elemental Chaos'],
    synopsis: 'A decade ago, the forces of good destroyed the Temple of Elemental Evil, scattering its dark priests and cultists. But evil never truly dies. The temple stirs again, and the village of Hommlet stands in its shadow.',
    keyLocations: ['Village of Hommlet', 'The Moathouse', 'Nulb', 'The Temple of Elemental Evil', 'The Elemental Nodes'],
    keyNpcs: ['Lareth the Beautiful', 'Zuggtmoy (Demon Queen of Fungi)', 'Iuz the Old', 'The Four Elemental Prophets'],
    plotPoints: [
      'Bandits operate from the ruined moathouse near Hommlet',
      'The moathouse connects to the greater temple conspiracy',
      'Nulb is a wretched hive of villainy serving the temple',
      'Four elemental cults vie for dominance within the temple',
      'Each cult serves an elemental prince of evil',
      'Zuggtmoy, demon queen of fungi, is imprisoned beneath',
      'Iuz the demigod schemes to free or replace her',
      'The elemental nodes are pocket dimensions of pure destruction'
    ],
    dmGuidance: 'This is one of the most famous D&D adventures ever written. Hommlet should feel like a real village with personalities. The temple itself is a massive dungeon with factional conflicts. The four elements theme runs throughout. This adventure is HARD - smart play is essential. The Zuggtmoy/Iuz conflict adds layers to simple dungeon delving.'
  },
  {
    id: 'dead-in-thay',
    name: 'Dead in Thay',
    description: 'Assault a Red Wizard stronghold to destroy a phylactery vault',
    type: 'published',
    icon: '💀',
    suggestedLevel: '9-11',
    setting: 'Thay (Forgotten Realms)',
    year: '1486 DR',
    themes: ['Heist', 'Undead', 'Red Wizards', 'Tactical'],
    synopsis: 'The Thayan Resurrection has begun - Szass Tam\'s Red Wizards are creating an army of undead to conquer the Realms. A rebel faction offers heroes a chance to strike at the Doomvault, a secret complex where Thayan liches store their phylacteries.',
    keyLocations: ['The Doomvault', 'The Temples of Extraction', 'The Abyssal Prisons', 'The Phylactery Vault', 'The Forests of Slaughter'],
    keyNpcs: ['Szass Tam', 'Syranna (rebel Red Wizard)', 'Tarul Var', 'Kazit Gul'],
    plotPoints: [
      'A rebel Red Wizard faction opposes Szass Tam\'s rule',
      'The Doomvault holds the phylacteries of Thay\'s liches',
      'Destroying phylacteries permanently kills the liches',
      'The vault is divided into themed sectors',
      'Alert levels increase as the party causes chaos',
      'Multiple parties can assault different sectors simultaneously',
      'Szass Tam himself may intervene if alerted',
      'Success weakens Thay\'s military power significantly'
    ],
    dmGuidance: 'Originally designed for organized play with multiple parties. The alert system creates urgency. Each sector has distinct challenges. This is a tactical mission, not exploration. The rebels\' motives are questionable. Destroying phylacteries has real consequences for Thayan politics. Fast-paced and intense.'
  },
  {
    id: 'bloodstone-pass',
    name: 'The Bloodstone Saga',
    description: 'Defend a frontier barony and ultimately confront Orcus himself',
    type: 'published',
    icon: '⚔️',
    suggestedLevel: '15-20',
    setting: 'Damara & Vaasa (Forgotten Realms)',
    year: '1285-1290 DR',
    themes: ['War', 'Demons', 'Kingdom Building', 'Epic Confrontation'],
    synopsis: 'The Witch-King Zhengyi has unleashed armies of undead and demons upon the Bloodstone Lands. Heroes must defend the beleaguered Barony of Bloodstone, delve into demon-haunted mines, lead armies against the forces of darkness, and ultimately storm the Abyss itself to confront the demon prince Orcus.',
    keyLocations: ['Bloodstone Pass', 'The Bloodstone Mines', 'Castle Perilous', 'The Abyss', 'Orcus\'s Throne Room', 'Heliogabalus'],
    keyNpcs: ['The Witch-King Zhengyi', 'Orcus (Demon Prince of Undeath)', 'Baron Tranth', 'Gareth Dragonsbane', 'The Grandfather of Assassins'],
    plotPoints: [
      'Zhengyi the Witch-King threatens to overwhelm the Bloodstone Lands',
      'The mines beneath Bloodstone contain a gate to the Abyss',
      'Heroes must rally defenders and hold Bloodstone Pass',
      'Demonic forces pour through portals from Orcus\'s realm',
      'Mass battles determine the fate of kingdoms',
      'Castle Perilous is Zhengyi\'s seat of power',
      'The only way to end the threat is to confront Orcus directly',
      'Heroes must invade the Abyss and destroy Orcus\'s wand'
    ],
    dmGuidance: 'This is an EPIC campaign culminating in fighting a demon prince. The 1280s DR setting is before many major Realms events - Zhengyi is at the height of his power. Kingdom-building and mass combat are key features. Let players feel like they\'re shaping history. The Abyss invasion should feel desperate and apocalyptic. Orcus is one of D&D\'s most iconic villains - make him terrifying.'
  }
];

// Get module by ID
export const getCampaignModule = (id) => {
  return CAMPAIGN_MODULES.find(m => m.id === id);
};

// Get only published modules (not custom)
export const getPublishedModules = () => {
  return CAMPAIGN_MODULES.filter(m => m.type === 'published');
};

export default CAMPAIGN_MODULES;
