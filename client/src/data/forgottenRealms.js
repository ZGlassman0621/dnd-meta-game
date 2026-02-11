// Forgotten Realms location and era data for AI DM sessions

export const STARTING_LOCATIONS = [
  // Major Cities
  {
    id: 'waterdeep',
    name: 'Waterdeep',
    type: 'city',
    region: 'Sword Coast',
    description: 'The City of Splendors - a bustling metropolis of trade, intrigue, and countless opportunities for adventure.'
  },
  {
    id: 'baldurs-gate',
    name: "Baldur's Gate",
    type: 'city',
    region: 'Sword Coast',
    description: 'A wealthy port city known for its powerful merchant princes and the shadow of Bhaal that lingers in its history.'
  },
  {
    id: 'neverwinter',
    name: 'Neverwinter',
    type: 'city',
    region: 'Sword Coast',
    description: 'The Jewel of the North - a city of skilled craftsmen rebuilding after catastrophe, warm even in winter.'
  },
  {
    id: 'luskan',
    name: 'Luskan',
    type: 'city',
    region: 'Sword Coast',
    description: 'City of Sails - a lawless port ruled by pirate captains and the mysterious Arcane Brotherhood.'
  },
  {
    id: 'silverymoon',
    name: 'Silverymoon',
    type: 'city',
    region: 'Silver Marches',
    description: 'Gem of the North - a center of learning and magic, known for its beauty and enlightened rule.'
  },
  {
    id: 'mithral-hall',
    name: 'Mithral Hall',
    type: 'city',
    region: 'Silver Marches',
    description: 'Ancient dwarven stronghold reclaimed by Clan Battlehammer, rich in mithral and heroic legacy.'
  },
  {
    id: 'candlekeep',
    name: 'Candlekeep',
    type: 'city',
    region: 'Sword Coast',
    description: 'The great library-fortress where knowledge is currency and secrets of the ages are preserved.'
  },
  {
    id: 'menzoberranzan',
    name: 'Menzoberranzan',
    type: 'city',
    region: 'Underdark',
    description: 'City of Spiders - the drow capital where Lolth\'s priestesses rule through fear and treachery.'
  },
  {
    id: 'calimport',
    name: 'Calimport',
    type: 'city',
    region: 'Calimshan',
    description: 'Ancient desert metropolis of genies, thieves\' guilds, and intricate political machinations.'
  },
  {
    id: 'athkatla',
    name: 'Athkatla',
    type: 'city',
    region: 'Amn',
    description: 'City of Coin - where the Council of Six rules and gold speaks louder than swords.'
  },
  // Regions
  {
    id: 'icewind-dale',
    name: 'Icewind Dale',
    type: 'region',
    region: 'The North',
    description: 'Frozen frontier of Ten-Towns, where barbarians roam and ancient evils sleep beneath the ice.'
  },
  {
    id: 'sword-coast',
    name: 'Sword Coast Wilderness',
    type: 'region',
    region: 'Sword Coast',
    description: 'The wild lands between the great cities - bandits, monsters, and ruins of fallen empires.'
  },
  {
    id: 'anauroch',
    name: 'Anauroch',
    type: 'region',
    region: 'The North',
    description: 'The Great Desert - once the heartland of ancient Netheril, now a wasteland of buried secrets.'
  },
  {
    id: 'cormanthor',
    name: 'Cormanthor',
    type: 'region',
    region: 'The Dalelands',
    description: 'Ancient elven forest harboring the ruins of Myth Drannor and countless magical mysteries.'
  },
  {
    id: 'chult',
    name: 'Chult',
    type: 'region',
    region: 'The South',
    description: 'Jungle peninsula of dinosaurs, yuan-ti, and the lost city of Omu hiding terrible secrets.'
  }
];

export const ERAS = [
  {
    id: 'era-1271',
    name: '1271 DR - Pre-Icewind Dale Era',
    years: '1271 DR',
    description: 'A decade before the demon Belhifet\'s scheme. Ten-Towns is a harsh but peaceful frontier. The Dale is wild and unforgiving.',
    loreContext: 'Ten years before the events of Icewind Dale. Ten-Towns scratches out a meager existence fishing knucklehead trout. Barbarian tribes roam the tundra. The Spine of the World hides forgotten Netherese ruins. Luskan\'s influence grows in the north. This is a time of relative calm before darker threats emerge.'
  },
  {
    id: 'era-1281',
    name: '1281 DR - Icewind Dale Era',
    years: '1281 DR',
    description: 'The frozen north faces an ancient evil. Ten-Towns struggles to survive against barbarian raids and darker threats.',
    loreContext: 'This is the era of the original Icewind Dale. The demon Belhifet schemes to open a portal to the Nine Hells. Kuldahar faces destruction. The Spine of the World holds ancient Netherese ruins. Ten-Towns is a rough frontier, decades before Drizzt arrives.'
  },
  {
    id: 'era-1312',
    name: '1312 DR - Icewind Dale II Era',
    years: '1312 DR',
    description: 'The Legion of the Chimera marches on Ten-Towns. Goblinoid armies threaten to overwhelm the frozen frontier.',
    loreContext: 'Thirty years after the first Icewind Dale crisis. Isair and Madae, cambion twins born of a devil and a priestess, lead the Legion of the Chimera against Ten-Towns. The North faces its greatest military threat in generations.'
  },
  {
    id: 'era-1350',
    name: '1350-1370 DR - Time of Troubles Era',
    years: '1350-1370 DR',
    description: 'The gods walk Faerûn during the Time of Troubles (1358). Magic is wild and unpredictable. Cyric and Midnight rise to godhood.',
    loreContext: 'This is the era of the Avatar Crisis. In 1358 DR, the gods were cast down to walk among mortals. Bane, Bhaal, and Myrkul meet their ends. Midnight becomes the new Mystra. The Tablets of Fate have been stolen and must be recovered.'
  },
  {
    id: 'era-1371',
    name: '1371-1385 DR - Post-Troubles Era',
    years: '1371-1385 DR',
    description: 'Recovery from divine chaos. Drizzt\'s legendary adventures. The return of Shade Enclave. Rising tensions precede the Spellplague.',
    loreContext: 'The world rebuilds after the Time of Troubles. Netheril returns as the Shade Enclave. Drizzt Do\'Urden and his companions are in their prime. Fzoul Chembryl leads the Zhentarim. The Spellplague looms on the horizon (1385 DR).'
  },
  {
    id: 'era-1480',
    name: '1480-1489 DR - Era of Upheaval',
    years: '1480-1489 DR',
    description: 'A century after the Spellplague. The world has changed dramatically. Ancient empires stir. The Sundering approaches.',
    loreContext: 'The Spellplague has reshaped reality. Abeir and Toril were briefly merged. Dragonborn now walk Faerûn. The primordials stir. Many gods are dead or changed. The Second Sundering (1484-1487 DR) will restore much of what was lost.'
  },
  {
    id: 'era-1489',
    name: '1489-1495 DR - Post-Sundering Era',
    years: '1489-1495 DR',
    description: 'The classic 5th Edition era. The Sundering has restored the old order. Cult of the Dragon rises. Giants march to war.',
    loreContext: 'This is the era of published 5th Edition adventures. Tiamat threatens to rise (Tyranny of Dragons). Elemental cults gather (Princes of the Apocalypse). Giants wage war (Storm King\'s Thunder). Acererak schemes in Chult (Tomb of Annihilation).'
  },
  {
    id: 'era-1496',
    name: '1496-1500 DR - Modern Era',
    years: '1496-1500 DR',
    description: 'The latest era of adventure. Old threats return with new faces. Heroes are needed more than ever.',
    loreContext: 'Recent events cast long shadows. Vecna has attempted to remake reality. The Shadowfell bleeds into the world. Waterdeep\'s dragonhoard has been plundered. New threats emerge as old villains scheme their returns.'
  }
];

export const ARRIVAL_HOOKS = [
  {
    id: 'native',
    name: 'Born and Raised',
    description: 'This is your home. You know the streets, the people, and the hidden corners most outsiders never see.'
  },
  {
    id: 'seeking-fortune',
    name: 'Seeking Fortune',
    description: 'You came here chasing rumors of opportunity - treasure, work, or a fresh start away from your past.'
  },
  {
    id: 'following-lead',
    name: 'Following a Lead',
    description: 'A letter, a map, or a dying whisper led you here. Someone or something awaits you in this place.'
  },
  {
    id: 'fleeing-danger',
    name: 'Fleeing Danger',
    description: 'You\'re running from something - enemies, a curse, or a past that refuses to stay buried.'
  },
  {
    id: 'hired-job',
    name: 'Hired for a Job',
    description: 'A patron has employed your services. The work seemed straightforward enough... at first.'
  },
  {
    id: 'shipwrecked',
    name: 'Shipwrecked / Stranded',
    description: 'Disaster left you here with little more than the clothes on your back. Now you must survive and find a way forward.'
  },
  {
    id: 'pilgrimage',
    name: 'On Pilgrimage',
    description: 'Your faith or personal quest has led you to this sacred or significant place.'
  },
  {
    id: 'mysterious-circumstances',
    name: 'Mysterious Circumstances',
    description: 'You don\'t quite remember how you got here. Strange dreams, lost time, or magical mishap brought you to this moment.'
  },
  {
    id: 'caravan-guard',
    name: 'Caravan Guard / Escort',
    description: 'You were protecting a merchant caravan or noble\'s entourage. The journey has ended, but adventure awaits.'
  },
  {
    id: 'exile',
    name: 'Exile or Outcast',
    description: 'Cast out from your homeland or organization, you\'ve come here to rebuild your life or prove your worth.'
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Write your own arrival story...'
  }
];

export const CAMPAIGN_LENGTHS = [
  {
    id: 'one-shot',
    name: 'One-Shot',
    description: 'A single self-contained adventure meant to be completed in one session.',
    sessionEstimate: '1 session'
  },
  {
    id: 'short-campaign',
    name: 'Short Campaign',
    description: 'A brief adventure arc with a clear beginning, middle, and end.',
    sessionEstimate: '3-5 sessions'
  },
  {
    id: 'ongoing-saga',
    name: 'Ongoing Saga',
    description: 'An open-ended campaign that can grow and evolve over many sessions.',
    sessionEstimate: 'Open-ended'
  }
];
