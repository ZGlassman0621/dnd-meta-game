// Forgotten Realms regions for the creator's Origin region picker
// (Stage 1, client/src/components/creator-next/Stage1OriginIdentity.jsx).
//
// Region-level names only — not cities. A city answer ("I'm from
// Baldur's Gate") goes through the picker's Other option and is typed
// in, so the list never has to pretend a city is a region. Toril's
// other continents (Kara-Tur, Maztica, Zakhara) are listed because a
// character from them is still a Forgotten Realms-setting origin;
// anything further afield (another setting entirely) keeps the
// free-text region field, since we hold no curated list for it.
//
// Names are stored WITHOUT a leading "The" ("Sword Coast", not "The
// Sword Coast") so the list sorts cleanly and the stored value reads
// naturally in the DM prompt's origin line. Each entry carries a
// one-sentence description, shown under the picker so the player
// knows what they are choosing. Descriptions are authored from canon
// knowledge; the physical-book check covers them with the names.
//
// Dependency-free on purpose: originSettings.js imports this list,
// the client component and the Stage 1 origin test import the
// settings module. No imports here.
export const FORGOTTEN_REALMS_REGIONS = [
  { name: 'Aglarond', description: 'A forested peninsula kingdom of half-elves on the Sea of Fallen Stars, ruled by the Simbul — a powerful sorcerer-queen — and long at war with Thay.' },
  { name: 'Amn', description: 'A wealthy merchant nation south of the Sword Coast, ruled by the Council of Six, where gold matters more than gods or kings.' },
  { name: 'Anauroch', description: 'The Great Desert — the buried ruins of fallen Netheril under endless sand, haunted by phaerimm and the returned City of Shade.' },
  { name: 'Border Kingdoms', description: 'A patchwork of petty realms between the big powers, where a sword and a charter can make you a king — briefly.' },
  { name: 'Calimshan', description: 'An ancient desert empire of genies, assassins, and merchant princes on the southern coast, rich and decadent.' },
  { name: 'Chult', description: 'A jungle peninsula of dinosaurs, yuan-ti, and lost cities — deadly, wild, and full of ruins no one has mapped.' },
  { name: 'Cormanthor', description: 'The ancient elven forest, home to the ruins of Myth Drannor — the greatest elven city ever built, and its most haunted.' },
  { name: 'Cormyr', description: 'The Forest Kingdom — a strong, well-ruled land of knights, Purple Dragons, and War Wizards, and the heart of the Dalelands’ trade.' },
  { name: 'Dalelands', description: 'A loose confederation of farming dales between Cormyr and the Moonsea — peaceful villages, old forests, and trouble from every direction.' },
  { name: 'Damara', description: 'A cold northern kingdom on the frontier of the Great Glacier, rebuilt after the Witch-King’s fall — hard people, harder winters.' },
  { name: 'Dragon Coast', description: 'A stretch of lawless port towns on the Sea of Fallen Stars, run by merchant lords, pirates, and thieves’ guilds.' },
  { name: 'Great Dale', description: 'A vast, sparsely settled land of nomads and forest tribes east of the Moonsea, where the old ways still hold.' },
  { name: 'Great Glacier', description: 'A frozen waste at the top of the world, home to frost giants, remorhaz, and the lost cities of the ice.' },
  { name: 'Halruaa', description: 'A hidden magocracy of wizards in the southern mountains, where magic is a craft and the land is kept secret by illusions.' },
  { name: 'High Forest', description: 'One of Faerûn’s oldest forests — ancient elven ruins, treants, and fey, and the home of the Emerald Enclave’s druids.' },
  { name: 'Hordelands', description: 'The Endless Wastes — the great steppe of horse-nomads east of the Moonsea, where tribes ride and khans rule.' },
  { name: 'Icewind Dale', description: 'A frozen frontier of Ten-Towns on the edge of the Spine of the World — barbarians, fishermen, and things under the ice.' },
  { name: 'Impiltur', description: 'A proud old kingdom on the Easting Reach, battered by demons and hobgoblins, whose paladins still hold the line.' },
  { name: 'Kara-Tur', description: 'The far east of Toril — empires like Shou Lung and Kozakura, with their own gods, spirits, and ways of war.' },
  { name: 'Lake of Steam', description: 'A volcanic region of hot springs and geysers south of Calimshan, where fire giants and azer work the forges.' },
  { name: 'Lantan', description: 'An island of gnomish inventors, where strange machines and smokepowder are made — and kept secret from the mainland.' },
  { name: 'Maztica', description: 'A distant continent across the western sea — jungles, feathered warriors, and gods who demand blood.' },
  { name: 'Moonsea', description: 'A hard, cold land around a black lake — Zhentil Keep, the Zhentarim’s home, and a dozen rough towns that answer to no one.' },
  { name: 'Moonshae Isles', description: 'Foggy islands off the Sword Coast where the Earthmother is worshipped, the Ffolk live simply, and the Northmen raid.' },
  { name: 'Narfell', description: 'A cold, broken land of ruins and tribes — once the empire of demon-summoning rivals to Netheril, now little more than its bones.' },
  { name: 'Nelanther Isles', description: 'A pirate-haunted archipelago off the Sword Coast, where every island has a captain and every captain has a price.' },
  { name: 'North', description: 'The wild north of Faerûn — frontier towns, barbarian tribes, dwarf holds, and ruins, from the Sword Coast to the Spine of the World.' },
  { name: 'Rashemen', description: 'A cold, spiritual land of witches (the Wychlaran) and berserkers, where spirits walk and the land itself is sacred.' },
  { name: 'Ride', description: 'The open plains of the Ride — horse tribes and the fortress-city of Glister, on the road between the Moonsea and the east.' },
  { name: 'Sembia', description: 'A merchant kingdom of caravan lords and counting-houses between Cormyr and the Moonsea, where everything is for sale.' },
  { name: 'Shaar', description: 'A vast grassland of nomadic tribes south of the Dalelands, where horses are wealth and the wind never stops.' },
  { name: 'Silver Marches', description: 'A confederation of free cities in the North — Silverymoon, Mithral Hall, Everlund — built to hold back orcs and worse.' },
  { name: 'Spine of the World', description: 'The great mountain wall of the North — orc tribes, frost giants, dwarf delvings, and passes no one crosses lightly.' },
  { name: 'Sword Coast', description: 'The famous coast of the west — Waterdeep, Baldur’s Gate, Neverwinter, and the wild lands between them.' },
  { name: 'Tashalar', description: 'A hot, jungle coast south of the Shaar, where yuan-ti and lizardfolk rule the ruins and the air is thick with snakes.' },
  { name: 'Tethyr', description: 'A young kingdom of forests and plains south of Amn, rebuilt after civil war — and home to the Forest of Tethir.' },
  { name: 'Thar', description: 'A badlands of ogres and orcs north of the Moonsea, where the ogre kingdom of Thar still threatens the civilized lands.' },
  { name: 'Thay', description: 'A magocracy of Red Wizards — necromancers, slavers, and schemers — ruled by the lich Szass Tam from behind its plateau.' },
  { name: 'Thesk', description: 'A merchant crossroads east of the Moonsea, where caravan towns grow rich on the Golden Way between Faerûn and Kara-Tur.' },
  { name: 'Thindol', description: 'A jungle peninsula of lizardfolk and yuan-ti, south of Tashalar — wild, wet, and barely explored.' },
  { name: 'Underdark', description: 'The lightless world below — drow cities, duergar holds, mind flayers, and caverns so deep no map reaches them.' },
  { name: 'Vaasa', description: 'A cold, grim land of ruins and monsters north of Damara, where the Witch-King’s shadow still lies heavy.' },
  { name: 'Vast', description: 'A rugged land of frontier towns and old ruins on the eastern shore of the Dragon Reach, between the Moonsea and the sea.' },
  { name: 'Vilhon Reach', description: 'A region of merchant cities and old Chondathan kingdoms around the Vilhon Reach, where trade and intrigue run deep.' },
  { name: 'Western Heartlands', description: 'The rolling farmlands and wild hills between the Sword Coast and Cormyr — small towns, old roads, and older ruins.' },
  { name: 'Zakhara', description: 'The Land of Fate — a desert continent of genies, holy warriors, and merchant princes, far across the southern sea.' },
]

// The setting/region/arrival helpers live in originSettings.js, which
// imports this list. This file is data only.
