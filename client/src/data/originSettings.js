// Origin settings, regions, and arrival options for the creator's
// Stage 1 (client/src/components/creator-next/Stage1OriginIdentity.jsx).
//
// SETTINGS are worlds, not books: the setting is where the character is
// FROM, the region is where in it. That is why the registry's
// "Wildemount" is a REGION here, under Exandria — Wildemount is a
// continent of Exandria, the way the Sword Coast is a region of the
// Forgotten Realms. A species whose registry origins say "Wildemount"
// still resolves: the setting offered is Exandria, the region offered
// is Wildemount. The per-species origin restriction is GONE by Zach's
// call (2026-11-05): any species can come from any setting — the
// outside-FR explanation gate is what keeps it honest, not the list.
//
// REGION lists are region-level names only (not cities, with the
// unavoidable exceptions where the setting's regions ARE city-states:
// Theros's poleis, Athas's city-states, Planescape's gate-towns).
// A city answer goes through each list's Other option and is typed in.
// Every list is alphabetical. Each entry carries a one-sentence
// description, shown under the picker so the player knows what they
// are choosing; Spelljammer's list is short because a Spelljammer
// origin is a crystal sphere, and there are only a few named ones
// worth listing. Descriptions are authored from canon knowledge; the
// physical-book check covers them with the names.
//
// ARRIVAL_OPTIONS are the "how did you come to be in the Forgotten
// Realms" answers for outside-FR origins. They are DELIBERATELY NOT
// alphabetical — they read as a menu of story hooks, in rough order
// from the most common ways through. Each is a complete answer the DM
// prompt prints verbatim (Origin: <setting> — <region> — <option>),
// so each one is written as something the DM can pick up and play:
// a portal that might reopen, a pursuer, a debt, a god with a claim.
// "Born here, to parents from elsewhere" covers the character whose
// people are from another setting but who grew up in the Realms.
//
// FREE-TEXT RULE (Zach, 2026-11-05): free text exists ONLY through an
// Other option. Every free-text origin value — a custom setting name,
// a custom region, a custom arrival story — is stored as the plain
// origin_setting / origin_region / origin_explanation string and
// printed VERBATIM in the DM prompt's origin line
// (server/services/speciesService.js formatOriginLine), so the DM
// reads it and works it into the adventure. The dropdowns are "our"
// information; the text boxes are the escape hatch, and their help
// text says so. Nothing free-text is ever silently dropped.
//
// Dependency-free except for the FR list import below: the client
// component imports this, and the Stage 1 origin test imports it
// from node. No other imports here.
import { FORGOTTEN_REALMS_REGIONS } from './forgottenRealmsRegions.js'

export { FORGOTTEN_REALMS_REGIONS }

export const ORIGIN_SETTINGS = [
  'Birthright',
  'Dark Sun',
  'Dragonlance',
  'Eberron',
  'Exandria',
  'Forgotten Realms',
  'Greyhawk',
  'Mystara',
  'Planescape',
  'Ravenloft',
  'Ravnica',
  'Spelljammer',
  'Strixhaven',
  'Theros',
]

export const SETTING_DESCRIPTIONS = {
  'Birthright': 'Cerilia, where kings rule by divine blood — domain play, where ruling a land and leading armies matters as much as swinging a sword. Political fantasy.',
  'Dark Sun': 'Athas, a dying desert world where arcane magic drains life, psionics are common, and sorcerer-kings rule city-states with iron fists. Brutal survival fantasy.',
  'Dragonlance': 'The world of Krynn, where the War of the Lance was fought — Knights of Solamnia, the Tower of High Sorcery, draconians, and dragons on both sides. Epic war fantasy.',
  'Eberron': 'A world of magic-as-industry after a devastating war: lightning rails, airships, dragonmarked houses running commerce, and noir intrigue. Pulp adventure with moral grey areas.',
  'Exandria': 'The world of Critical Role — the continents of Wildemount and Tal’Dorei, where young nations, old empires, and ancient evils collide. Heroic fantasy with political intrigue.',
  'Forgotten Realms': 'The classic D&D world — the continent of Faerûn on the planet Toril: knights and wizards, ancient elven forests, dwarf holds under mountains, and drow cities in the Underdark. High fantasy with deep history; the game itself is set here.',
  'Greyhawk': 'The original D&D world — the Flanaess, a land of petty kingdoms, scheming wizards, and old evils stirring under the surface. Gritty, classic sword-and-sorcery.',
  'Mystara': 'The Known World — an old-school world of human kingdoms, halfling shires, wizard-princes, and the Savage Coast. Classic, wide-open exploration.',
  'Planescape': 'Sigil, the City of Doors, and the planes beyond — a hub where fiends, celestials, and philosophers argue in the streets. Philosophical, planar adventure.',
  'Ravenloft': 'The Domains of Dread — pocket realms of gothic horror, each ruled by a Darklord trapped by their own sins. Horror fantasy; the Mists take whom they please.',
  'Ravnica': 'A single endless city covering an entire plane, ruled by ten guilds — law, death, nature, chaos, commerce, and more, all fighting for the streets. Urban fantasy; every block is contested ground.',
  'Spelljammer': 'Wildspace — sailing between the stars in magic ships, from one crystal sphere to another. Swashbuckling space fantasy.',
  'Strixhaven': 'Arcavios, home to Strixhaven — a university of magic where five colleges study every kind of spellcraft. Campus fantasy; school is the adventure.',
  'Theros': 'A world of Greek myth: poleis of heroes, gods who walk among mortals, and monsters out of legend. Mythic heroism; fate and the gods are always watching.',
}

export const REGIONS_BY_SETTING = {
  'Forgotten Realms': FORGOTTEN_REALMS_REGIONS,
  'Birthright': [
  { name: 'Aduria', description: 'A southern continent of Cerilia — where the old empires fell and the new ones rise.' },
  { name: 'Anuire', description: 'The heartland of Cerilia — where the Anuirean kings once ruled and the Iron Throne stands empty.' },
  { name: 'Brechtür', description: 'A land of merchants and the Brecht — where the sea trade rules and the guilds hold the power.' },
  { name: 'Djapar', description: 'A distant land of Cerilia — where the trade winds blow and the unknown waits.' },
  { name: 'Gorgon\'s Crown', description: 'The Gorgon’s domain — where the awnshegh’s stone gaze holds and the land is cursed.' },
  { name: 'Khinasi', description: 'A land of the Khinasi — where the sun faith holds and the wizards of the south rule.' },
  { name: 'Rjurik', description: 'A land of the Rjurik — where the jarls rule and the old gods of the north still speak.' },
  { name: 'Shadow World', description: 'The world behind the world — where the shadows walk and the dead whisper.' },
  { name: 'Vosgaard', description: 'A land of the Vos — where the cold holds and the warlords rule with iron.' },
  ],
  'Dark Sun': [
  { name: 'Balic', description: 'A city-state of merchants and the sorcerer-king Andropinis — a city of trade, where the patricians hold the real power.' },
  { name: 'Crescent Forest', description: 'A crescent of green in the desert, where the halflings’ forest-home endures.' },
  { name: 'Crimson Savannah', description: 'A savannah of crimson grass and the herds of the Athasian plains, where the nomads ride.' },
  { name: 'Dead Lands', description: 'A land of the dead — where the obsidian plains and the undead of the Dead Lands wait.' },
  { name: 'Draj', description: 'A city-state ruled by the god-king Tectuktitlay, where sacrifice feeds the moon’s hunger.' },
  { name: 'Forest Ridge', description: 'A ridge of the last forests of Athas, where halflings and the creatures of the green still live.' },
  { name: 'Gulg', description: 'A city-state of the forest, ruled by the Oba — a sorcerer-queen who is one with the jungle.' },
  { name: 'Hinterlands', description: 'The lands beyond the Tablelands — where the maps end and the wastes begin.' },
  { name: 'Ivory Triangle', description: 'A triangle of trade between Tyr, Urik, and Raam — the richest and most dangerous roads on Athas.' },
  { name: 'Jagged Cliffs', description: 'Cliffs of jagged stone above the Silt Sea, where the thri-kreen and the cliff-dwellers live.' },
  { name: 'Nibenay', description: 'A city-state of the Shadow King — a sorcerer-king who rules from the shadows, and whose city is a maze of secrets.' },
  { name: 'Raam', description: 'A city-state of chaos and the sorcerer-queen Abalach-Re — where the streets are ruled by gangs and the queen’s whims.' },
  { name: 'Ringing Mountains', description: 'A mountain range that rings the Tyr Region, where the last forests hide and the halflings hunt.' },
  { name: 'Silt Sea', description: 'A sea of silt, not water — where silt horrors swim and the silt skimmers sail.' },
  { name: 'Tablelands', description: 'The heart of Athas — the Tyr Region’s tablelands, where the city-states cling to the last water and the wastes press in.' },
  { name: 'Tyr', description: 'A free city of Athas — the only city-state to throw off its sorcerer-king, and the freest place on a dying world.' },
  { name: 'Urik', description: 'A city-state of Hamanu, the Lion of Urik — a sorcerer-king of war and order, whose legions are feared across the Tablelands.' },
  { name: 'Valley of Dust and Fire', description: 'A valley of dust and fire, where the Dragon’s levy is paid and the sorcerer-kings fear to tread.' },
  ],
  'Dragonlance': [
  { name: 'Abanasinia', description: 'A frontier land of small towns and old forests, where the Heroes of the Lance began — and where the Inn of the Last Home still stands.' },
  { name: 'Ansalon', description: 'The main continent of Krynn — where the War of the Lance was fought, and where dragons still shape history.' },
  { name: 'Blood Sea', description: 'A red sea of blood and the ruins of Istar — where the Cataclysm struck and the gods’ wrath still stains the water.' },
  { name: 'Desolation', description: 'A blasted land of the Dragonarmies’ making — ash, ruin, and the bones of dragons.' },
  { name: 'Ergoth', description: 'An old empire of knights and ruins — Northern Ergoth’s wild coast and Southern Ergoth’s fallen glory.' },
  { name: 'Goodlund', description: 'A cold northern peninsula of forests and the ruins of old kingdoms.' },
  { name: 'Hylo', description: 'A coastal peninsula where the sea elves keep their own counsel.' },
  { name: 'Icereach', description: 'The frozen northern sea, where ice barbarians hunt and the cold kills the unprepared.' },
  { name: 'Icewall', description: 'A wall of ice at the top of the world — the edge of the map, where the Ice Folk live.' },
  { name: 'Khalkist Mountains', description: 'A mountain range of fire and stone, where the Dragonarmies’ fortresses were built.' },
  { name: 'Kharolis', description: 'A mountain land of dwarves — Thorbardin’s mountains, where the dwarf clans hold their halls.' },
  { name: 'Khur', description: 'A desert land of nomads and the ruins of old empires, where water is worth more than gold.' },
  { name: 'Lemish', description: 'A small, poor nation of farmers and soldiers, caught between greater powers.' },
  { name: 'Neraka', description: 'The dark heart of Ansalon — the Dragonarmies’ home, where the Dark Queen’s temples still stand.' },
  { name: 'Newsea', description: 'A great inland sea of trade and fishing, where the ports are free and the pirates are bold.' },
  { name: 'Nordmaar', description: 'A northern land of barbarian tribes and the ruins of the Istaran empire.' },
  { name: 'Northern Ergoth', description: 'A wild, forested land of elves and the remnants of the Ergothian empire.' },
  { name: 'Plains of Dust', description: 'A dust-choked plain of ruins and the remnants of the Cataclysm, where nothing grows and the dead walk.' },
  { name: 'Qualinesti', description: 'The elven homeland of Qualinesti — a forest of silver trees and the oldest elven magic.' },
  { name: 'Sancrist', description: 'An island of the Solamnic knights — their refuge and their fortress, where the knighthood endures.' },
  { name: 'Silvanesti', description: 'The oldest elven kingdom — a dreamlike forest where time moves strangely and the elves keep their secrets.' },
  { name: 'Solamnia', description: 'The land of the Knights of Solamnia — honor, castles, and the measure of a knight’s oath.' },
  { name: 'Southern Ergoth', description: 'A land of ruins and old magic, where the empire’s fall is still written in stone.' },
  { name: 'Taman Busuk', description: 'A swampy, diseased land of the Dragonarmies’ rear — where the air is poison and the dead rise.' },
  { name: 'Thorbardin', description: 'The great dwarf kingdom under the Kharolis mountains — the Life Tree, the forges, and the clans.' },
  ],
  'Eberron': [
  { name: 'Aerenal', description: 'The island continent of the elves — an ancient, isolationist land ruled by the Undying Court of elven ancestors.' },
  { name: 'Argonnessen', description: 'The dragon continent — where dragons rule and prophecy is written in the land itself. Mortals are not welcome.' },
  { name: 'Aundair', description: 'A nation of wizards and arcane academies, proud and refined — and still smarting from the Last War.' },
  { name: 'Breland', description: 'The largest of the Five Nations — a pragmatic, industrial kingdom of trade, spies, and the King’s Citadel.' },
  { name: 'Darguun', description: 'A goblinoid nation carved from Cyre’s ruins — hobgoblin warlords and the Dhakaani legacy.' },
  { name: 'Demon Wastes', description: 'A blasted land where the Lords of Dust are bound — fiends, cultists, and the ruins of the Age of Demons.' },
  { name: 'Droaam', description: 'A monster nation ruled by hags and warlords, where medusas, ogres, and harpies hold citizenship.' },
  { name: 'Eldeen Reaches', description: 'A wild land of druids and shifters, where the Wardens of the Wood guard the deep forests.' },
  { name: 'Frostfell', description: 'A frozen continent at the top of the world, where ice and the cold itself are the enemy.' },
  { name: 'Karrnath', description: 'A grim, martial nation of undead soldiers and necromancers, ruled from Korth.' },
  { name: 'Khorvaire', description: 'The main continent of Eberron — five nations rebuilding after the Last War, with lightning rails and dragonmarked houses.' },
  { name: 'Lhazaar Principalities', description: 'A confederation of pirate princes and sea captains, where every ship flies its own flag.' },
  { name: 'Mournland', description: 'The dead-grey mist that swallowed Cyre — a land where the Last War never ended, and the dead don’t decay.' },
  { name: 'Mror Holds', description: 'A land of dwarf clans and deep mines, where the holds guard their gold and their grudges.' },
  { name: 'Q\'barra', description: 'A jungle frontier of lizardfolk and dragonborn, where settlers and scalefolk uneasily share the land.' },
  { name: 'Sarlona', description: 'The continent of psionics and the Inspired — ruled by the Dreaming Dark, where dreams are policed.' },
  { name: 'Shadow Marches', description: 'A swampy, haunted land of orc tribes and the Gatekeepers — the druids who hold back aberrations.' },
  { name: 'Talenta Plains', description: 'Wide grasslands of halfling nomads, who ride dinosaurs and keep the old ways.' },
  { name: 'Thrane', description: 'A theocratic nation ruled by the Church of the Silver Flame — paladins, inquisitors, and holy war.' },
  { name: 'Valenar', description: 'A land of elf warriors who honor their ancestors by reliving ancient battles — every day is a war reenactment.' },
  { name: 'Xen\'drik', description: 'A jungle continent of giant ruins and drow tribes — the shattered homeland of the giants, full of treasure and danger.' },
  { name: 'Zilargo', description: 'A gnomish nation of spies, artificers, and secrets — where everyone knows something, and no one says it plainly.' },
  ],
  'Exandria': [
  { name: 'Alabaster Sierras', description: 'White mountains on Tal’Dorei’s northern edge — home to the frost giants of the Frostweald.' },
  { name: 'Blightshore', description: 'A twisted coast where the land itself is wrong — aberrations, rifts, and the ruins of the Calamity.' },
  { name: 'Bramblewood', description: 'A dark, tangled forest on Tal’Dorei’s coast, where the fey are thick and the paths change.' },
  { name: 'Cliffkeep Mountains', description: 'A rugged mountain range of dwarf holds and old mines, guarding Tal’Dorei’s western approaches.' },
  { name: 'Dreamseep Marshlands', description: 'A swamp of strange dreams and stranger things, where the veil between worlds runs thin.' },
  { name: 'Dwendalian Empire', description: 'A disciplined empire of law and industry, ruled from Rexxentrum, where the Cerberus Assembly’s wizards hold power.' },
  { name: 'Eiselcross', description: 'A frozen island of ancient Aeorian ruins, where expeditions dig for lost magic and wake what should stay buried.' },
  { name: 'Frostweald', description: 'A cold pine forest of frost giants and hardy hunters, north of Whitestone.' },
  { name: 'Greying Wildlands', description: 'A cold, ashen frontier of jagged mountains and hardy clans, north of the Empire.' },
  { name: 'Ironseat Ridge', description: 'A mountain ridge of iron mines and dwarf clans, where the forges never cool.' },
  { name: 'K\'Tawl Swamp', description: 'A fetid swamp of lizardfolk and worse, where the roads sink and the dead don’t stay down.' },
  { name: 'Menagerie Coast', description: 'A coast of free port cities — Nicodranas, Port Damali — where trade, pirates, and the Myriad’s smugglers thrive.' },
  { name: 'Mornset Countryside', description: 'Rolling farmland and small villages around the city of Emon — peaceful, until it isn’t.' },
  { name: 'Parchwood Timberlands', description: 'A great timber forest worked by loggers and rangers, where the trees hide old elven ruins.' },
  { name: 'Ruins of Sorrow', description: 'A haunted ruin-field where a city fell to betrayal, and the dead still keep their grudges.' },
  { name: 'Shadebarrow', description: 'A barrow-land of old kings and older curses, where the dead are buried deep for a reason.' },
  { name: 'Shifting Keep', description: 'A wandering ruin that appears where it pleases, full of the treasure — and traps — of a fallen wizard.' },
  { name: 'Summit Peaks', description: 'High, cold peaks where the air is thin and the dragons are old.' },
  { name: 'Tal\'Dorei', description: 'The continent of Tal’Dorei — city-states, fey forests, and the ruins of the Chroma Conclave’s war.' },
  { name: 'Turst Fields', description: 'Open farmland and grain fields, the breadbasket of Tal’Dorei — and the first place armies march through.' },
  { name: 'Verdant Expanse', description: 'A wide, green wilderness of plains and forests, home to nomads and the last wild herds.' },
  { name: 'Wildemount', description: 'The continent of Wildemount — the Dwendalian Empire, the Menagerie Coast, and the wastes of Xhorhas, where old wars still echo.' },
  { name: 'Xhorhas', description: 'A dark, blighted land of the Kryn Dynasty — drow who worship the Luxon, and ruins of the fallen Betrayer Gods.' },
  ],
  'Greyhawk': [
  { name: 'Ahlissa', description: 'The successor of the Great Kingdom — a land of scheming nobles and the Scarlet Brotherhood’s reach.' },
  { name: 'Amedio Jungle', description: 'A dense jungle of Olman ruins and yuan-ti, south of the Flanaess — hot, wet, and full of old gods.' },
  { name: 'Bandit Kingdoms', description: 'A patchwork of bandit lords and petty tyrants, where the law is whatever the strongest sword says.' },
  { name: 'Bright Desert', description: 'A shining desert of glass and the ruins of the Baklunish — where the dervishes ride and the Suel’s ghosts linger.' },
  { name: 'Celene', description: 'A reclusive elven kingdom of the west, where the elves keep to their forests and their queen’s counsel.' },
  { name: 'County of Urnst', description: 'A free county of merchants and miners, caught between Nyrond and the Great Kingdom’s ambitions.' },
  { name: 'Duchy of Tenh', description: 'A small duchy of hardy folk, caught between Stonefist and the barbarians — and holding.' },
  { name: 'Duchy of Urnst', description: 'A duchy of trade and the Suel’s old roads, where the merchants grow rich and the nobles scheme.' },
  { name: 'Ekbir', description: 'A Baklunish sultanate of deserts and horse-lords, where the faith of Al’Akbar holds sway.' },
  { name: 'Furyondy', description: 'A kingdom of paladins and the front line against Iuz — the Shield Lands’ bulwark.' },
  { name: 'Hepmonaland', description: 'A jungle continent south of the Flanaess, where the Olman and the Scarlet Brotherhood’s secrets lie.' },
  { name: 'Horned Society', description: 'A theocracy of devil-worshippers, where the Horned Society’s priests rule in Iuz’s shadow.' },
  { name: 'Iuz', description: 'The empire of the cambion Iuz — a land of fiends, undead, and the Old One’s cruelty.' },
  { name: 'Keoland', description: 'A kingdom of knights and the Suel’s old roads, where the king’s writ runs thin at the borders.' },
  { name: 'Ket', description: 'A Baklunish sheikdom of merchants and the crossroads of the west, where the caravans meet.' },
  { name: 'Lendore Isles', description: 'Elven isles off the eastern coast, where the high elves keep their oldest secrets.' },
  { name: 'Lordship of the Isles', description: 'A sea-lord’s domain of islands and pirates, where the Sea Princes’ heirs still sail.' },
  { name: 'Nyrond', description: 'A kingdom of the Great Kingdom’s heirs, hard-pressed by Iuz and the Scarlet Brotherhood.' },
  { name: 'Pale', description: 'A theocracy of the Pale — a land of priests and the Pholtus faith, stern and unyielding.' },
  { name: 'Plains of the Paynims', description: 'A steppe of Baklunish nomads, where horse tribes ride and the khans rule.' },
  { name: 'Pomarj', description: 'A peninsula of orcs and goblinoids, where the human states were driven out and the monsters hold the land.' },
  { name: 'Principality of Ulek', description: 'A principality of halflings and humans in the Kron Hills, where the gnomes and halflings keep their own.' },
  { name: 'Rovers of the Barrens', description: 'A land of barbarian horsemen, the Rovers, who guard the northern passes against Iuz.' },
  { name: 'Sea of Dust', description: 'A sea of dust and the ruins of the Suel Imperium — where the Rain of Colorless Fire fell.' },
  { name: 'Shield Lands', description: 'A land of shield-bearers and the front line against the Horned Society and Iuz.' },
  { name: 'Stonefist', description: 'The Hold of Stonefist — a land of barbarian warriors and the Fists’ brutal rule.' },
  { name: 'Sunndi', description: 'A kingdom of the old Suel, where the sun-priests rule and the jungle presses in.' },
  { name: 'Tilvanot Peninsula', description: 'The Scarlet Brotherhood’s home — a peninsula of spies, assassins, and the Suel’s purest blood.' },
  { name: 'Tusmit', description: 'A Baklunish pasha’s land of deserts and the crossroads of the west.' },
  { name: 'Ull', description: 'A Baklunish state of horse-lords and the Uli, where the deserts meet the mountains.' },
  { name: 'Wild Coast', description: 'A coast of free towns and pirates, where the law is thin and the gold is thick.' },
  { name: 'Yeomanry', description: 'A free land of yeoman farmers and the Kron Hills, where the people rule themselves.' },
  { name: 'Zeif', description: 'A Baklunish sultanate of deserts and the sea, where the merchants of Zeif grow rich on the spice trade.' },
  ],
  'Mystara': [
  { name: 'Alphatia', description: 'An empire of wizards — where the Alphatian wizards rule and the magic is the air itself.' },
  { name: 'Atruaghin', description: 'A land of the Atruaghin clans — where the tribes keep their ways and the spirits speak.' },
  { name: 'Broken Lands', description: 'A land of the broken — where the humanoids hold and the old wars never ended.' },
  { name: 'Darokin', description: 'A republic of merchants — where the caravans rule and the gold is the law.' },
  { name: 'Five Shires', description: 'The halfling shires — five shires of farmers, pipeweed, and the Hin’s quiet ways.' },
  { name: 'Glantri', description: 'A magocracy of wizard-princes — where the Principalities’ wizards rule and the magic is law.' },
  { name: 'Heldannic Territories', description: 'A land of the Heldannic Knights — where the knights’ order holds and the faith is law.' },
  { name: 'Ierendi', description: 'An island kingdom of the sea — where the pirates and the traders share the waves.' },
  { name: 'Isle of Dawn', description: 'An island of the dawn — where the sun rises first and the old powers wake.' },
  { name: 'Karameikos', description: 'A young kingdom of the Known World — where the Duke’s writ is new and the wilderness is old.' },
  { name: 'Ostland', description: 'An island of the Northmen — where the Ostlanders keep their own laws and their own gods.' },
  { name: 'Rockhome', description: 'A dwarf kingdom of the mountains — where the clans hold their halls and the forges burn.' },
  { name: 'Savage Coast', description: 'A coast of the savage — where the Red Steel curses and the adventurers seek their fortunes.' },
  { name: 'Soderfjord', description: 'A fjord-land of the Northmen — where the longships sail and the sagas are sung.' },
  { name: 'Thyatis', description: 'An empire of the Thyatian legions — where the emperors rule and the armies march.' },
  { name: 'Vestland', description: 'A northern land of the Northmen — where the jarls rule and the seas are the roads.' },
  { name: 'Ylaruam', description: 'A desert emirate of the Alasiyan faith — where the sands hide the old and the new.' },
  ],
  'Planescape': [
  { name: 'Automata', description: 'A gate-town of perfect order — where the modrons’ law holds and the streets are ruled by routine.' },
  { name: 'Clerk\'s Ward', description: 'Sigil’s ward of scribes and bureaucrats — where the paperwork of the planes is filed.' },
  { name: 'Excelsior', description: 'A gate-town of the heavens — where the righteous gather and the light never dims.' },
  { name: 'Faunel', description: 'A gate-town of the Beastlands — where the wild holds and the animals rule.' },
  { name: 'Glorium', description: 'A gate-town of the heroes — where the warriors of Ysgard feast and the valkyries choose.' },
  { name: 'Guildhall Ward', description: 'Sigil’s ward of the factions’ guildhalls — where the philosophies argue and the politics bite.' },
  { name: 'Hive Ward', description: 'Sigil’s slum — where the poor, the mad, and the desperate crowd, and the Harmonium rarely patrols.' },
  { name: 'Hopeless', description: 'A gate-town of despair — where the Grey Waste’s gloom settles and hope dies.' },
  { name: 'Lady\'s Ward', description: 'Sigil’s richest ward — where the Lady of Pain’s shadow falls and the powerful keep their doors.' },
  { name: 'Lower Ward', description: 'Sigil’s industrial ward — forges, foundries, and the smoke of the Lower Planes’ trade.' },
  { name: 'Market Ward', description: 'Sigil’s great bazaar — where everything is for sale, from every plane, at the right price.' },
  { name: 'Outlands', description: 'The ring-land around Sigil — where the gate-towns lead to every plane, and neutrality is the law.' },
  { name: 'Plague-Mort', description: 'A gate-town of disease — where the Abyss’s rot spreads and the sick are the citizens.' },
  { name: 'Ribcage', description: 'A gate-town of the Nine Hells — where the devils’ law holds and the deals are binding.' },
  { name: 'Sylvania', description: 'A gate-town of the fey — where the Seelie Court’s light shines and the forests never end.' },
  { name: 'Torch', description: 'A gate-town of fire — where the Elemental Plane of Fire’s heat blazes and the efreet trade.' },
  { name: 'Xaos', description: 'A gate-town of chaos — where the streets change, the laws invert, and nothing stays the same.' },
  ],
  'Ravenloft': [
  { name: 'Amber Wastes', description: 'A domain of the desert and the pharaoh — where the sands hide tombs and the mummies walk.' },
  { name: 'Barovia', description: 'The first Domain of Dread — Count Strahd’s valley, where the mists never lift and the vampire rules.' },
  { name: 'Bluetspur', description: 'A domain of the mind flayers — where the God-Brain dreams and the thralls obey.' },
  { name: 'Borca', description: 'A domain of poison and politics — where the Borcan nobility’s intrigues are as deadly as their wines.' },
  { name: 'Darkon', description: 'A domain of the lich-king Azalin — where the dead walk and the living forget.' },
  { name: 'Dementlieu', description: 'A domain of high society and the Opera — where the Darklord’s salons hide horrors behind manners.' },
  { name: 'Falkovnia', description: 'A domain of the military — where the warlord Vlad Drakov’s armies march and the dead rise to fight again.' },
  { name: 'Forlorn', description: 'A domain of goblyns and the castle of its Darklord, standing alone in the mists.' },
  { name: 'Frozen Reaches', description: 'A domain of ice and the frozen dead — where the cold is a Darklord’s will.' },
  { name: 'Har\'Akir', description: 'A domain of the desert and the mummy — where Anhktepot’s tomb holds the secrets of the Amber Wastes.' },
  { name: 'Hazlan', description: 'A domain of the wizard Hazlik — where magic is law and the Darklord’s experiments never end.' },
  { name: 'Kartakass', description: 'A domain of music and the wolf — where the bards sing and the werewolves hunt.' },
  { name: 'Lamordia', description: 'A domain of the scientist Mordenheim — where the flesh golem Adam walks and science is a horror.' },
  { name: 'Markovia', description: 'A domain of the island and the mad scientist — where the beasts are men and the men are beasts.' },
  { name: 'Mists', description: 'The Mists themselves — the fog between domains, where the Vistani wander and the lost are taken.' },
  { name: 'Mordent', description: 'A domain of ghosts and the House on Gryphon Hill — where the dead outnumber the living.' },
  { name: 'Nightmare Lands', description: 'A domain of dreams — where the Nightmare Court rules the sleeping and the waking is a trap.' },
  { name: 'Nocturnal Sea', description: 'A sea of night, where the vampire’s ships sail and the moon never sets.' },
  { name: 'Nova Vaasa', description: 'A domain of the plains and the horse-lords — where the Darklord’s law is absolute.' },
  { name: 'Richemulot', description: 'A domain of the wererats — where the sewers are a kingdom and the rats rule.' },
  { name: 'Sea of Sorrows', description: 'A sea of the Mists, where the ghost ships sail and the drowned never rest.' },
  { name: 'Shadow Rift', description: 'A rift in the Mists where the shadow fey dwell — a domain of the Arak and the Shadow.' },
  { name: 'Sithicus', description: 'A domain of the elf-lord Soth — where the Death Knight’s curse holds and the dead march.' },
  { name: 'Souragne', description: 'A domain of the swamps and the loa — where the dead rise and the spirits demand their due.' },
  { name: 'Tepest', description: 'A domain of the fey and the inquisition — where the hags and the witch-hunters both prey on the innocent.' },
  { name: 'Valachan', description: 'A domain of the panther-lord — where the jungle hunts and the Darklord’s cats are always watching.' },
  { name: 'Verbrek', description: 'A domain of the werewolves — where the packs rule the forests and the moon is a god.' },
  ],
  'Ravnica': [
  { name: 'Precinct Eight', description: 'A district of the poor and the desperate — where the Gruul’s rubble and the Golgari’s undercity meet the streets.' },
  { name: 'Precinct Five', description: 'A district of gardens and the Selesnya’s great tree-temples — green, quiet, and watched.' },
  { name: 'Precinct Four', description: 'A district of soldiers and smiths — the Boros garrison, the forges, and the training grounds.' },
  { name: 'Precinct Nine', description: 'A district of the dead — the Orzhov’s catacombs and the Golgari’s rot farms, where the dead work.' },
  { name: 'Precinct One', description: 'The old heart of Ravnica — guildhalls, monuments, and the politics of the ten guilds at their most formal.' },
  { name: 'Precinct Seven', description: 'A district of artists and the Rakdos’s stages — revels that turn violent after dark.' },
  { name: 'Precinct Six', description: 'A district of docks and warehouses — the flow of goods, and the Dimir’s quiet business.' },
  { name: 'Precinct Ten', description: 'The newest district — a frontier of building sites, guild land-grabs, and fresh opportunity.' },
  { name: 'Precinct Three', description: 'A district of scholars and spies — libraries, laboratories, and the Simic’s hidden labs.' },
  { name: 'Precinct Two', description: 'A district of markets, theaters, and the wealthy — where the Orzhov count their coins and the Azorius count their laws.' },
  { name: 'Rubblebelt', description: 'The ruined district the Gruul claim — broken streets, wild clans, and the rage of the old world.' },
  { name: 'Undercity', description: 'The world below Ravnica’s streets — sewers, rot farms, and the Golgari’s kingdom of decay.' },
  ],
  'Spelljammer': [
  { name: 'Greyspace', description: 'Oerth’s crystal sphere — the world of Greyhawk and its moons, where the spelljammers trade.' },
  { name: 'Krynnspace', description: 'Krynn’s crystal sphere — the world of Dragonlance and its three moons, where the gods watch.' },
  { name: 'Realmspace', description: 'Toril’s crystal sphere — the sun, the planets, and the Tears of Selûne, where spelljammers sail.' },
  { name: 'Rock of Bral', description: 'An asteroid city in Wildspace — the free port of the stars, where every crew docks and every deal is made.' },
  { name: 'Tears of Selûne', description: 'A cluster of asteroids around Toril — the Tears, where the spelljammers hide and the pirates lurk.' },
  ],
  'Strixhaven': [
  { name: 'Lorehold', description: 'The college of history and archaeology — where the past is dug up and the dead are studied.' },
  { name: 'Prismari', description: 'The college of art and elemental magic — where the performances are spells and the spells are art.' },
  { name: 'Quandrix', description: 'The college of mathematics and magic — where the numbers are spells and the spells are numbers.' },
  { name: 'Silverquill', description: 'The college of words and light — where the bards and the orators shape the world with speech.' },
  { name: 'Strixhaven Campus', description: 'The campus itself — where the five colleges meet, and the students’ lives unfold.' },
  { name: 'Witherbloom', description: 'The college of life and death — where the druids and the necromancers study the cycle.' },
  ],
  'Theros': [
  { name: 'Akros', description: 'A polis of warriors and athletes, where heroes are made in the arena and the gods’ favor is won by strength.' },
  { name: 'Ashen Reaches', description: 'A scorched land of volcanoes and ash, where the forge-god Purphoros’s fires never go out.' },
  { name: 'Burning Isles', description: 'Volcanic islands of fire and ash, where Purphoros’s forges burn and the lava runs like rivers.' },
  { name: 'Deyda River', description: 'A river at the underworld’s border, where the dead are ferried and the living dare not drink.' },
  { name: 'Katachthon Mountains', description: 'A mountain range at the underworld’s edge — where the dead pass and the living turn back.' },
  { name: 'Meletis', description: 'A polis of scholars, sailors, and temples — the most civilized city of Theros, and the most schemed-over.' },
  { name: 'Nessian Wood', description: 'A great forest of centaurs, satyrs, and the god Nylea’s domain — beautiful and deadly in equal measure.' },
  { name: 'Odunos', description: 'A desert waste of ash and bone, where the dead do not rest and the living rarely pass.' },
  { name: 'Oraniad Mountains', description: 'High peaks where the gods’ temples stand and the storms answer to no one.' },
  { name: 'Oreskos', description: 'The open plains of the leonin prides — hunters and warriors who answer to no polis.' },
  { name: 'Phoberos', description: 'A badlands of minotaurs and monsters, where the strong rule and the weak are eaten.' },
  { name: 'Setessa', description: 'A polis of archers and nature’s defenders, hidden in the Nessian Wood, where the wild is a neighbor.' },
  { name: 'Siren Sea', description: 'The sea of Theros — tritons, sirens, and the storms of Thassa, god of the sea.' },
  { name: 'Skola Vale', description: 'A quiet valley of villages and oracles, where fate is read in the stars and the birds.' },
  ],
}

// The "Other…" option's value in the setting and region dropdowns.
// A UI sentinel only — the component clears it back to an empty value
// before the typed text is stored, so it never reaches persistence.
export const OTHER_SETTING_VALUE = '__other__'
export const OTHER_REGION_VALUE = '__other__'

// The "Other…" option's value in the arrival dropdown. Same rule:
// the component clears it before the typed story is stored.
export const OTHER_ARRIVAL_VALUE = '__other__'

// How you arrived in the Forgotten Realms, for origins outside it.
// Stored verbatim as origin_explanation; the DM prompt prints it.
export const ARRIVAL_OPTIONS = [
  'Through a portal that spat me out here',
  'A planar storm tore me from home',
  'A spell gone wrong stranded me',
  'Following a lead through a gate',
  'Fleeing something that wanted me dead',
  'Looking for work, gold, or a fresh start',
  'Hired to guard a caravan',
  'Exiled from my home',
  'Taken — and escaped here',
  'Sent by a god',
  'Shipwrecked on these shores',
  'Walked the long way across the planes',
  'Born here, to parents from elsewhere',
  "I don't remember how I got here"
]

// The region list for a resolved origin setting, or [] when the
// setting has no curated list (a custom Other setting, or none yet).
// Entries are { name, description } — the stored value is the name.
export function regionsForSetting(originSetting) {
  return REGIONS_BY_SETTING[originSetting] || []
}

// The description of one setting, or '' when it has none (a custom
// Other setting, or none picked yet).
export function settingDescription(originSetting) {
  return SETTING_DESCRIPTIONS[originSetting] || ''
}

// The description of one region within its setting, or '' when the
// region is not on that setting's list (a typed custom region).
export function regionDescription(originSetting, regionName) {
  const entry = regionsForSetting(originSetting).find(r => r.name === regionName)
  return entry ? entry.description : ''
}

// Which region field the picker shows for a resolved origin setting:
// the dropdown when the setting has a curated list, free text
// otherwise (another setting, or no setting picked yet).
export function regionFieldMode(originSetting) {
  return regionsForSetting(originSetting).length > 0 ? 'dropdown' : 'text'
}

export function isListedRegion(originSetting, value) {
  return regionsForSetting(originSetting).some(r => r.name === value)
}

export function isListedArrival(value) {
  return ARRIVAL_OPTIONS.includes(value)
}
