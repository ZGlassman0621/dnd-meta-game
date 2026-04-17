/**
 * Party Base Configuration
 * Defines base types, upgrade catalogs, level thresholds, perk effects,
 * and entanglement tables. Inspired by Blades in the Dark crew system.
 */

// ============================================================
// LEVEL THRESHOLDS
// ============================================================

export const LEVEL_THRESHOLDS = [
  { level: 1, renown: 0,   upgradeSlots: 2,  staffCap: 2,  upkeep: 10  },
  { level: 2, renown: 25,  upgradeSlots: 4,  staffCap: 4,  upkeep: 25  },
  { level: 3, renown: 60,  upgradeSlots: 6,  staffCap: 6,  upkeep: 50  },
  { level: 4, renown: 120, upgradeSlots: 8,  staffCap: 8,  upkeep: 100 },
  { level: 5, renown: 200, upgradeSlots: 10, staffCap: 12, upkeep: 200 },
];

export function getLevelForRenown(renown) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (renown >= LEVEL_THRESHOLDS[i].renown) return LEVEL_THRESHOLDS[i];
  }
  return LEVEL_THRESHOLDS[0];
}

// ============================================================
// BASE TYPES
// ============================================================

export const BASE_TYPES = {
  tavern: {
    name: 'Tavern',
    description: 'A bustling social hub where travelers share tales and coin flows freely. Your taproom is the heart of local gossip and opportunity.',
    icon: '🍺',
    incomeType: 'Patron spending',
    baseIncome: 3, // gp per game day at level 1
    incomePerLevel: 2,
    starterPerks: ['rumor_network'],
    uniqueUpgrades: ['private_rooms', 'stage', 'back_room', 'brewery'],
  },
  guild_hall: {
    name: 'Guild Hall',
    description: 'A headquarters for adventurers and mercenaries. Job boards, training yards, and shared resources draw skilled warriors and cunning operatives.',
    icon: '⚔️',
    incomeType: 'Quest board fees',
    baseIncome: 2,
    incomePerLevel: 2,
    starterPerks: ['quest_leads'],
    uniqueUpgrades: ['training_yard', 'armory', 'war_room', 'trophy_hall'],
  },
  wizard_tower: {
    name: 'Wizard Tower',
    description: 'A spire of arcane study reaching toward the heavens. Its shelves overflow with tomes, and its chambers hum with magical energy.',
    icon: '🔮',
    incomeType: 'Spell component sales',
    baseIncome: 2,
    incomePerLevel: 3,
    starterPerks: ['study_anywhere'],
    uniqueUpgrades: ['arcane_library', 'arcane_lab', 'observatory', 'planar_ward'],
  },
  temple: {
    name: 'Temple',
    description: 'A sanctuary of divine power. The faithful gather here for healing, guidance, and protection against the darkness.',
    icon: '⛪',
    incomeType: 'Donations',
    baseIncome: 2,
    incomePerLevel: 2,
    starterPerks: ['prayer_bonus'],
    uniqueUpgrades: ['healing_ward', 'sanctum', 'reliquary', 'bell_tower'],
  },
  thieves_den: {
    name: "Thieves' Den",
    description: 'A hidden network of tunnels, safe houses, and shadowy meeting places. Information is currency, and secrets are your stock in trade.',
    icon: '🗡️',
    incomeType: 'Fencing stolen goods',
    baseIncome: 4,
    incomePerLevel: 3,
    starterPerks: ['spy_network'],
    uniqueUpgrades: ['black_market', 'escape_routes', 'forgery_workshop', 'lookout_posts'],
  },
  manor: {
    name: 'Manor Estate',
    description: 'A grand estate befitting nobility. Servants attend to every need, and your name carries weight in political circles.',
    icon: '🏰',
    incomeType: 'Tenant rent',
    baseIncome: 5,
    incomePerLevel: 4,
    starterPerks: ['prestige'],
    uniqueUpgrades: ['grand_hall', 'servants_quarters', 'stables', 'gardens'],
  },
};

// ============================================================
// UPGRADE CATALOG
// ============================================================

// Shared upgrades available to all base types
export const SHARED_UPGRADES = {
  fortifications: {
    name: 'Fortifications',
    category: 'security',
    tiers: [
      { level: 1, gold_cost: 100, hours_required: 40, perk: 'defense_1', description: 'Reinforced doors and basic walls. Reduces raid damage by 25%.' },
      { level: 2, gold_cost: 300, hours_required: 80, perk: 'defense_2', description: 'Stone walls, iron gates, and watchtower. Reduces raid damage by 50%.' },
      { level: 3, gold_cost: 800, hours_required: 160, perk: 'defense_3', description: 'Full battlements with murder holes and alarm system. Reduces raid damage by 75%.' },
    ],
  },
  guest_quarters: {
    name: 'Guest Quarters',
    category: 'comfort',
    tiers: [
      { level: 1, gold_cost: 50, hours_required: 24, perk: 'guest_quarters', description: 'Basic rooms for visitors. Attracts NPC visitors with quests and rumors.' },
    ],
  },
  storage_vault: {
    name: 'Storage Vault',
    category: 'commerce',
    tiers: [
      { level: 1, gold_cost: 75, hours_required: 30, perk: 'secure_storage', description: 'Locked vault for valuables. Items stored here are safe from raids.' },
      { level: 2, gold_cost: 200, hours_required: 60, perk: 'treasury_interest', description: 'Invested treasury earns 1% per month on stored gold.' },
    ],
  },
  training_ground: {
    name: 'Training Ground',
    category: 'knowledge',
    tiers: [
      { level: 1, gold_cost: 80, hours_required: 32, perk: 'training_bonus_xp', description: 'Practice dummies and sparring ring. +50% XP from train downtime.' },
      { level: 2, gold_cost: 250, hours_required: 64, perk: 'training_proficiency', description: 'Advanced equipment. Training can work toward tool/weapon proficiencies.' },
    ],
  },
  garden_kitchen: {
    name: 'Garden & Kitchen',
    category: 'comfort',
    tiers: [
      { level: 1, gold_cost: 40, hours_required: 20, perk: 'food_supply', description: 'Herb garden and kitchen. Reduces ration costs, rest quality +1 tier at base.' },
    ],
  },
};

// Type-specific upgrades
export const TYPE_UPGRADES = {
  tavern: {
    private_rooms: {
      name: 'Private Rooms',
      category: 'commerce',
      tiers: [
        { level: 1, gold_cost: 60, hours_required: 24, perk: 'rest_quality_bonus', description: 'Comfortable private rooms. Rest quality upgraded by one tier at your tavern.' },
      ],
    },
    stage: {
      name: 'Performance Stage',
      category: 'commerce',
      tiers: [
        { level: 1, gold_cost: 80, hours_required: 20, perk: 'passive_income_2', description: 'Raised stage for bards. +2 gp/day passive income from entertainment.' },
      ],
    },
    back_room: {
      name: 'Back Room',
      category: 'special',
      tiers: [
        { level: 1, gold_cost: 100, hours_required: 16, perk: 'secret_meetings', description: 'Hidden meeting room. Enables secret faction meetings and shady deals.' },
      ],
    },
    brewery: {
      name: 'Brewery',
      category: 'commerce',
      tiers: [
        { level: 1, gold_cost: 150, hours_required: 40, perk: 'brewing', description: 'On-site brewing. Craft ale and spirits. Carouse at your tavern costs nothing.' },
        { level: 2, gold_cost: 400, hours_required: 80, perk: 'passive_income_4', description: 'Export-quality spirits. +4 gp/day from wholesale.' },
      ],
    },
  },
  guild_hall: {
    training_yard: {
      name: 'Training Yard',
      category: 'knowledge',
      tiers: [
        { level: 1, gold_cost: 100, hours_required: 32, perk: 'combat_training', description: 'Weapon racks and training dummies. +3 XP/hour during train downtime.' },
        { level: 2, gold_cost: 300, hours_required: 64, perk: 'sparring_partner', description: 'Hired sparring master. Train downtime can improve attack bonus (long-term project).' },
      ],
    },
    armory: {
      name: 'Armory',
      category: 'security',
      tiers: [
        { level: 1, gold_cost: 120, hours_required: 24, perk: 'equipment_maintenance', description: 'Weapon and armor storage with maintenance tools. Maintain downtime is instant.' },
      ],
    },
    war_room: {
      name: 'War Room',
      category: 'knowledge',
      tiers: [
        { level: 1, gold_cost: 150, hours_required: 30, perk: 'tactical_planning', description: 'Maps and strategy table. Gather intel downtime gets +1 bonus segment.' },
      ],
    },
    trophy_hall: {
      name: 'Trophy Hall',
      category: 'comfort',
      tiers: [
        { level: 1, gold_cost: 80, hours_required: 16, perk: 'renown_display', description: 'Display trophies from adventures. +25% renown gain from completed quests.' },
      ],
    },
  },
  wizard_tower: {
    arcane_library: {
      name: 'Arcane Library',
      category: 'knowledge',
      tiers: [
        { level: 1, gold_cost: 150, hours_required: 40, perk: 'study_bonus', description: 'Shelves of rare tomes. +50% XP from study downtime. Research projects advance faster.' },
        { level: 2, gold_cost: 400, hours_required: 80, perk: 'spell_research', description: 'Complete arcane archive. Can research new spells as long-term projects.' },
      ],
    },
    arcane_lab: {
      name: 'Arcane Laboratory',
      category: 'special',
      tiers: [
        { level: 1, gold_cost: 200, hours_required: 48, perk: 'crafting_speed', description: 'Magical workbench and reagent storage. +25% crafting project speed.' },
        { level: 2, gold_cost: 500, hours_required: 96, perk: 'potion_mastery', description: 'Advanced distillery. Potion crafting quality +1 tier.' },
      ],
    },
    observatory: {
      name: 'Observatory',
      category: 'knowledge',
      tiers: [
        { level: 1, gold_cost: 250, hours_required: 60, perk: 'divination', description: 'Star charts and scrying pool. Can attempt to scry locations during downtime.' },
      ],
    },
    planar_ward: {
      name: 'Planar Ward',
      category: 'security',
      tiers: [
        { level: 1, gold_cost: 300, hours_required: 48, perk: 'magic_defense', description: 'Protective glyphs. Base is immune to scrying and teleportation intrusions.' },
      ],
    },
  },
  temple: {
    healing_ward: {
      name: 'Healing Ward',
      category: 'comfort',
      tiers: [
        { level: 1, gold_cost: 100, hours_required: 30, perk: 'healing_ward', description: 'Consecrated healing room. Long rest at base removes 1 condition.' },
        { level: 2, gold_cost: 300, hours_required: 60, perk: 'restoration', description: 'Greater healing sanctum. Long rest removes up to 2 conditions and cures diseases.' },
      ],
    },
    sanctum: {
      name: 'Inner Sanctum',
      category: 'special',
      tiers: [
        { level: 1, gold_cost: 200, hours_required: 48, perk: 'piety_bonus', description: 'Holy inner chamber. Prayer downtime grants +50% piety gains.' },
      ],
    },
    reliquary: {
      name: 'Reliquary',
      category: 'knowledge',
      tiers: [
        { level: 1, gold_cost: 150, hours_required: 36, perk: 'divine_lore', description: 'Collection of sacred relics. Study downtime can reveal divine secrets.' },
      ],
    },
    bell_tower: {
      name: 'Bell Tower',
      category: 'security',
      tiers: [
        { level: 1, gold_cost: 120, hours_required: 32, perk: 'sanctuary_alarm', description: 'Consecrated bells. Alerts the faithful if the temple is attacked. +2 defense.' },
      ],
    },
  },
  thieves_den: {
    black_market: {
      name: 'Black Market',
      category: 'commerce',
      tiers: [
        { level: 1, gold_cost: 100, hours_required: 24, perk: 'black_market_access', description: 'Fence operation. Buy/sell illegal goods. +3 gp/day from fencing.' },
        { level: 2, gold_cost: 300, hours_required: 48, perk: 'smuggling', description: 'Smuggling network. Access rare items. +5 gp/day from contraband.' },
      ],
    },
    escape_routes: {
      name: 'Escape Routes',
      category: 'security',
      tiers: [
        { level: 1, gold_cost: 80, hours_required: 32, perk: 'escape_routes', description: 'Hidden tunnels and bolt-holes. Can escape entanglements with 50% chance.' },
      ],
    },
    forgery_workshop: {
      name: 'Forgery Workshop',
      category: 'special',
      tiers: [
        { level: 1, gold_cost: 120, hours_required: 28, perk: 'forgery', description: 'Forging tools and materials. Can create false documents during downtime.' },
      ],
    },
    lookout_posts: {
      name: 'Lookout Posts',
      category: 'security',
      tiers: [
        { level: 1, gold_cost: 60, hours_required: 16, perk: 'early_warning', description: 'Hidden watchers. Entanglements are detected 1 day early, giving time to prepare.' },
      ],
    },
  },
  manor: {
    grand_hall: {
      name: 'Grand Hall',
      category: 'comfort',
      tiers: [
        { level: 1, gold_cost: 200, hours_required: 48, perk: 'prestige_events', description: 'Lavish banquet hall. Host events that attract nobles. +faction standing from socializing.' },
      ],
    },
    servants_quarters: {
      name: "Servants' Quarters",
      category: 'commerce',
      tiers: [
        { level: 1, gold_cost: 80, hours_required: 24, perk: 'servant_staff', description: 'Staff housing. +2 staff cap. Staff handle maintain downtime automatically.' },
        { level: 2, gold_cost: 200, hours_required: 48, perk: 'major_domo', description: 'Head of household. +4 staff cap. Staff morale improved by 20%.' },
      ],
    },
    stables: {
      name: 'Stables',
      category: 'comfort',
      tiers: [
        { level: 1, gold_cost: 100, hours_required: 20, perk: 'mounts', description: 'Horse stables and tack room. Travel pace increased when departing from base.' },
      ],
    },
    gardens: {
      name: 'Formal Gardens',
      category: 'comfort',
      tiers: [
        { level: 1, gold_cost: 120, hours_required: 32, perk: 'garden_peace', description: 'Manicured gardens. Rest quality always luxurious at manor. +2 to social downtime.' },
      ],
    },
  },
};

// ============================================================
// PERK EFFECTS
// ============================================================

export const PERK_EFFECTS = {
  // Starter perks
  rumor_network: { name: 'Rumor Network', effect: 'Socialize/carouse rumor chance doubled' },
  quest_leads: { name: 'Quest Leads', effect: 'Faction quests discovered 1 day earlier' },
  study_anywhere: { name: 'Arcane Study', effect: 'Study downtime has no location requirement' },
  prayer_bonus: { name: 'Sacred Ground', effect: 'Prayer XP +25% at temple' },
  spy_network: { name: 'Spy Network', effect: 'Gather intel reveals more faction secrets' },
  prestige: { name: 'Noble Prestige', effect: '+5 disposition with NPCs who know your name' },

  // Shared upgrade perks
  defense_1: { name: 'Basic Defenses', effect: 'Raid damage reduced 25%' },
  defense_2: { name: 'Strong Defenses', effect: 'Raid damage reduced 50%' },
  defense_3: { name: 'Fortress', effect: 'Raid damage reduced 75%' },
  guest_quarters: { name: 'Guest Quarters', effect: 'NPC visitors bring quests and rumors' },
  secure_storage: { name: 'Secure Storage', effect: 'Stored items are safe from raids' },
  treasury_interest: { name: 'Invested Treasury', effect: 'Treasury earns 1% per 30 game days' },
  training_bonus_xp: { name: 'Training Grounds', effect: '+50% XP from train downtime' },
  training_proficiency: { name: 'Advanced Training', effect: 'Can train toward proficiencies' },
  food_supply: { name: 'Kitchen & Garden', effect: 'Rest quality +1 tier at base, reduced ration costs' },

  // Type-specific perks
  rest_quality_bonus: { name: 'Private Rooms', effect: 'Rest quality +1 tier at tavern' },
  passive_income_2: { name: 'Entertainment Income', effect: '+2 gp/day passive income' },
  secret_meetings: { name: 'Secret Meetings', effect: 'Enables faction meetings and shady deals' },
  brewing: { name: 'Brewery', effect: 'Carouse at tavern is free' },
  passive_income_4: { name: 'Export Spirits', effect: '+4 gp/day from wholesale' },
  combat_training: { name: 'Combat Training', effect: '+3 XP/hour during train downtime' },
  sparring_partner: { name: 'Sparring Master', effect: 'Train can improve attack bonus' },
  equipment_maintenance: { name: 'Armory', effect: 'Maintain downtime is instant' },
  tactical_planning: { name: 'War Room', effect: 'Gather intel +1 bonus segment' },
  renown_display: { name: 'Trophy Hall', effect: '+25% renown from completed quests' },
  study_bonus: { name: 'Arcane Library', effect: '+50% XP from study, research projects faster' },
  spell_research: { name: 'Spell Research', effect: 'Can research new spells as long-term projects' },
  crafting_speed: { name: 'Arcane Lab', effect: '+25% crafting project speed' },
  potion_mastery: { name: 'Potion Mastery', effect: 'Potion crafting quality +1 tier' },
  divination: { name: 'Observatory', effect: 'Can attempt scrying during downtime' },
  magic_defense: { name: 'Planar Ward', effect: 'Base immune to scrying and teleportation' },
  healing_ward: { name: 'Healing Ward', effect: 'Long rest at base removes 1 condition' },
  restoration: { name: 'Greater Healing', effect: 'Long rest removes 2 conditions and diseases' },
  piety_bonus: { name: 'Inner Sanctum', effect: 'Prayer piety gains +50%' },
  divine_lore: { name: 'Reliquary', effect: 'Study can reveal divine secrets' },
  sanctuary_alarm: { name: 'Bell Tower', effect: 'Attack alerts faithful, +2 defense' },
  black_market_access: { name: 'Black Market', effect: 'Buy/sell illegal goods, +3 gp/day' },
  smuggling: { name: 'Smuggling Network', effect: 'Access rare items, +5 gp/day' },
  escape_routes: { name: 'Escape Routes', effect: '50% chance to escape entanglements' },
  forgery: { name: 'Forgery', effect: 'Can create false documents during downtime' },
  early_warning: { name: 'Early Warning', effect: 'Entanglements detected 1 day early' },
  prestige_events: { name: 'Grand Events', effect: 'Host events, +faction standing from socializing' },
  servant_staff: { name: 'Staff Quarters', effect: '+2 staff cap, auto-maintain equipment' },
  major_domo: { name: 'Major Domo', effect: '+4 staff cap, +20% staff morale' },
  mounts: { name: 'Stables', effect: 'Faster travel pace from base' },
  garden_peace: { name: 'Formal Gardens', effect: 'Always luxurious rest, +2 social downtime' },
  faction_work_bonus: { name: 'Faction Connections', effect: '+1 segment on faction projects' },
};

// ============================================================
// ENTANGLEMENT TABLES
// ============================================================

export const ENTANGLEMENT_THRESHOLDS = [
  { min: 0,  max: 20,  risk: 0,    label: 'Safe' },
  { min: 21, max: 40,  risk: 0.10, label: 'Watched' },
  { min: 41, max: 60,  risk: 0.20, label: 'Wanted' },
  { min: 61, max: 80,  risk: 0.35, label: 'Hunted' },
  { min: 81, max: 100, risk: 0.50, label: 'Critical' },
];

export const ENTANGLEMENTS = {
  criminal: [
    { weight: 3, severity: 'minor', title: 'Guard Patrol', description: 'City guards are making extra rounds near your usual haunts.' },
    { weight: 3, severity: 'minor', title: 'Informant', description: 'Someone is asking questions about you in the local taverns.' },
    { weight: 2, severity: 'moderate', title: 'Bounty Posted', description: 'A bounty has been posted for information leading to your capture.' },
    { weight: 2, severity: 'moderate', title: 'Shakedown', description: 'A local gang demands payment for "protection" or threatens to turn you in.' },
    { weight: 1, severity: 'major', title: 'Raid', description: 'Authorities are planning to raid your known locations.' },
    { weight: 1, severity: 'critical', title: 'Arrest Warrant', description: 'An official arrest warrant has been issued. Guards actively seek you.' },
  ],
  political: [
    { weight: 3, severity: 'minor', title: 'Rumors', description: 'Unflattering rumors about you circulate in noble circles.' },
    { weight: 3, severity: 'minor', title: 'Tax Collector', description: 'A persistent tax collector demands payment of dubious "fees."' },
    { weight: 2, severity: 'moderate', title: 'Rival Noble', description: 'A rival noble works to undermine your influence and reputation.' },
    { weight: 2, severity: 'moderate', title: 'Public Accusation', description: 'You are publicly accused of misconduct at a gathering.' },
    { weight: 1, severity: 'major', title: 'Summons', description: 'You are summoned before a local lord or council to answer charges.' },
    { weight: 1, severity: 'critical', title: 'Exile Threat', description: 'Powerful forces move to have you banished from the region.' },
  ],
  arcane: [
    { weight: 3, severity: 'minor', title: 'Magical Detection', description: 'Your magical activities have been detected by local wards.' },
    { weight: 3, severity: 'minor', title: 'Curious Scholar', description: 'An inquisitive mage is investigating your arcane dealings.' },
    { weight: 2, severity: 'moderate', title: 'Arcane Bounty', description: 'A wizard enclave offers a reward for information about your activities.' },
    { weight: 2, severity: 'moderate', title: 'Wild Magic Event', description: 'Your accumulated magical footprint triggers a wild magic surge near your location.' },
    { weight: 1, severity: 'major', title: 'Planar Attention', description: 'Extraplanar entities have taken notice of your magical activities.' },
    { weight: 1, severity: 'critical', title: 'Arcane Tribunal', description: 'A magical authority demands you stand before an arcane tribunal.' },
  ],
  religious: [
    { weight: 3, severity: 'minor', title: 'Temple Shunning', description: 'Local temples refuse you service until you atone.' },
    { weight: 3, severity: 'minor', title: 'Divine Omen', description: 'An ominous sign appears wherever you go, unnerving the faithful.' },
    { weight: 2, severity: 'moderate', title: 'Zealot Pursuit', description: 'Religious zealots follow you, attempting to "save" or punish you.' },
    { weight: 2, severity: 'moderate', title: 'Holy Ground Barrier', description: 'Consecrated ground becomes uncomfortable — you feel unwelcome in temples.' },
    { weight: 1, severity: 'major', title: 'Inquisitor', description: 'A formal inquisitor has been assigned to investigate your sins.' },
    { weight: 1, severity: 'critical', title: 'Excommunication', description: 'Your deity or the church moves to formally excommunicate you.' },
  ],
  military: [
    { weight: 3, severity: 'minor', title: 'Military Patrol', description: 'Soldiers increase patrols in your area and check papers at gates.' },
    { weight: 3, severity: 'minor', title: 'Conscription Notice', description: 'You receive a notice of mandatory military service.' },
    { weight: 2, severity: 'moderate', title: 'Desertion Charge', description: 'You are accused of desertion or aiding deserters.' },
    { weight: 2, severity: 'moderate', title: 'Fortress Lockdown', description: 'Military installations in the area go on lockdown, restricting movement.' },
    { weight: 1, severity: 'major', title: 'Military Tribunal', description: 'You are ordered to appear before a military court.' },
    { weight: 1, severity: 'critical', title: 'Martial Law', description: 'Martial law is declared in the region. All movement is restricted.' },
  ],
};

// ============================================================
// PROJECT TYPES
// ============================================================

export const PROJECT_TYPES = {
  research: { name: 'Research', icon: '📚', defaultDC: 14, defaultSegments: 8, skillSuggestions: ['arcana', 'history', 'investigation', 'religion', 'nature'] },
  construction: { name: 'Construction', icon: '🏗️', defaultDC: 12, defaultSegments: 6, skillSuggestions: ['athletics', 'survival', 'mason_tools', 'carpenter_tools'] },
  networking: { name: 'Networking', icon: '🤝', defaultDC: 13, defaultSegments: 6, skillSuggestions: ['persuasion', 'deception', 'insight', 'performance'] },
  training: { name: 'Training', icon: '⚔️', defaultDC: 14, defaultSegments: 8, skillSuggestions: ['athletics', 'acrobatics', 'specific_weapon', 'specific_tool'] },
  investigation: { name: 'Investigation', icon: '🔍', defaultDC: 15, defaultSegments: 8, skillSuggestions: ['investigation', 'perception', 'insight', 'stealth'] },
};

// ============================================================
// RENOWN SOURCES
// ============================================================

export const RENOWN_SOURCES = {
  quest_completion: { base: 5, label: 'Quest completed' },
  faction_quest: { base: 8, label: 'Faction quest completed' },
  major_event: { base: 10, label: 'Major world event involvement' },
  upgrade_completed: { base: 3, label: 'Base upgrade completed' },
  staff_hired: { base: 1, label: 'Staff hired' },
  npc_favor: { base: 2, label: 'NPC favor' },
  project_completed: { base: 4, label: 'Long-term project completed' },
};

// ============================================================
// F1: CATEGORIES + SUBTYPES + BUILDINGS
// ============================================================
// The old BASE_TYPES above become BUILDINGS you install inside a base.
// A base is now picked from BASE_CATEGORIES → BASE_SUBTYPES hierarchy.

export const BASE_CATEGORIES = {
  martial: {
    name: 'Martial',
    description: 'Strongholds and fortifications. Built for defense, garrison, and territorial control.',
    icon: '🏰'
  },
  civilian: {
    name: 'Civilian',
    description: 'Halls, manors, and houses of trade. Built for commerce, hospitality, and social influence.',
    icon: '🏛️'
  },
  arcane: {
    name: 'Arcane',
    description: 'Towers and sanctums of magical study. Built for research, ritual, and planar work.',
    icon: '🔮'
  },
  sanctified: {
    name: 'Sanctified',
    description: 'Temples, monasteries, and holy sites. Built for worship, healing, and divine work.',
    icon: '⛪'
  }
};

// Subtype defines building-slot cap, base stats, and flavor. Building slots
// cap how many named buildings can fit inside the base. Watchtowers are
// cramped (3 slots); full fortresses sprawl (14 slots).
export const BASE_SUBTYPES = {
  // MARTIAL
  watchtower: {
    category: 'martial', name: 'Watchtower',
    description: 'A narrow spire on a trade road or border. A handful of garrisoned soldiers, a beacon, a single well.',
    icon: '🗼', buildingSlots: 3, baseUpkeepGp: 8, startingRenown: 0
  },
  outpost: {
    category: 'martial', name: 'Outpost',
    description: 'A fortified camp at the edge of civilization. Wooden palisade, a handful of buildings inside.',
    icon: '⛺', buildingSlots: 5, baseUpkeepGp: 15, startingRenown: 0
  },
  keep: {
    category: 'martial', name: 'Keep',
    description: 'A stone tower with supporting structures. Defensible, respectable, the core of a small holding.',
    icon: '🏯', buildingSlots: 8, baseUpkeepGp: 30, startingRenown: 10
  },
  fortress: {
    category: 'martial', name: 'Fortress',
    description: 'A major walled stronghold with gatehouse, multiple towers, courtyards, and barracks for a standing garrison.',
    icon: '🏰', buildingSlots: 14, baseUpkeepGp: 75, startingRenown: 25
  },
  castle: {
    category: 'martial', name: 'Castle',
    description: 'The seat of a lord or crown. Concentric walls, a great hall, a donjon. Armies assemble in its courtyards.',
    icon: '🏰', buildingSlots: 20, baseUpkeepGp: 150, startingRenown: 50
  },

  // CIVILIAN
  tavern: {
    category: 'civilian', name: 'Tavern',
    description: 'A small inn or public house. The smallest viable base — a room for you, a common area below.',
    icon: '🍺', buildingSlots: 3, baseUpkeepGp: 10, startingRenown: 0
  },
  hall: {
    category: 'civilian', name: 'Hall',
    description: 'A guild hall, meeting lodge, or trade house. A base of operations for commerce and gathering.',
    icon: '🏛️', buildingSlots: 6, baseUpkeepGp: 25, startingRenown: 5
  },
  manor: {
    category: 'civilian', name: 'Manor',
    description: 'A grand house on grounds. Servants, gardens, stables — a landed-gentry estate.',
    icon: '🏡', buildingSlots: 10, baseUpkeepGp: 50, startingRenown: 15
  },

  // ARCANE
  wizard_tower: {
    category: 'arcane', name: 'Wizard Tower',
    description: 'A solitary spire reaching above the treeline. Cramped, stacked, every floor packed with tomes and experiments.',
    icon: '🗼', buildingSlots: 5, baseUpkeepGp: 20, startingRenown: 5
  },
  academy: {
    category: 'arcane', name: 'Academy',
    description: 'A small college of magic with classrooms, a library, and warded workshops. Teaches and researches.',
    icon: '📚', buildingSlots: 10, baseUpkeepGp: 50, startingRenown: 20
  },

  // SANCTIFIED
  chapel: {
    category: 'sanctified', name: 'Chapel',
    description: 'A small house of prayer for a single deity or pantheon. One hall, a few quarters.',
    icon: '⛪', buildingSlots: 4, baseUpkeepGp: 10, startingRenown: 0
  },
  temple: {
    category: 'sanctified', name: 'Temple',
    description: 'A full temple complex with sanctuary, cloister, and scriptorium. Pilgrims come here.',
    icon: '⛪', buildingSlots: 8, baseUpkeepGp: 30, startingRenown: 10
  },
  sanctuary: {
    category: 'sanctified', name: 'Sanctuary / Monastery',
    description: 'Retreat and reliquary. Walled grounds, guest cells, a great library of holy texts.',
    icon: '🛕', buildingSlots: 12, baseUpkeepGp: 60, startingRenown: 25
  }
};

// Buildings you can install INSIDE a base. Each has a slot cost, install
// cost (gold + hours), and may grant perks. Some are category-locked (you
// can't install a Temple inside a Wizard Tower) — enforced by
// `allowedCategories`. `allowedCategories: null` means any category works.
export const BUILDING_TYPES = {
  // MARTIAL-FLAVORED (installable in martial bases; some elsewhere)
  barracks: {
    name: 'Barracks',
    description: 'Houses a garrison of soldiers. Each level doubles garrison capacity.',
    icon: '🛏️',
    allowedCategories: ['martial', 'civilian'],
    slots: 1, baseGoldCost: 500, baseHoursRequired: 80,
    perks: ['garrison_capacity_20']
  },
  armory: {
    name: 'Armory',
    description: 'Stores and maintains weapons + armor for the garrison. Reduces equipment wear.',
    icon: '⚔️',
    allowedCategories: ['martial', 'civilian'],
    slots: 1, baseGoldCost: 400, baseHoursRequired: 60,
    perks: ['equipment_maintenance']
  },
  gatehouse: {
    name: 'Gatehouse',
    description: 'Fortified entry with portcullis and murder holes. Major defense bonus.',
    icon: '🚪',
    allowedCategories: ['martial'],
    slots: 1, baseGoldCost: 800, baseHoursRequired: 120,
    perks: ['defense_rating_plus_3']
  },
  watchtower: {
    name: 'Watchtower (building)',
    description: 'A tower extending your base. Spots approaching threats before they arrive.',
    icon: '🗼',
    allowedCategories: ['martial', 'civilian'],
    slots: 1, baseGoldCost: 350, baseHoursRequired: 50,
    perks: ['early_warning']
  },
  training_yard: {
    name: 'Training Yard',
    description: 'Dedicated grounds for combat drill. Garrison fights harder; party gets XP bonus during downtime.',
    icon: '🎯',
    allowedCategories: ['martial', 'civilian'],
    slots: 1, baseGoldCost: 300, baseHoursRequired: 40,
    perks: ['training_bonus_xp']
  },
  stables: {
    name: 'Stables',
    description: 'Housing for mounts. Enables mounted travel bonuses.',
    icon: '🐎',
    allowedCategories: ['martial', 'civilian', 'sanctified'],
    slots: 1, baseGoldCost: 250, baseHoursRequired: 35,
    perks: ['mounted_travel']
  },

  // CIVILIAN
  tavern: {
    name: 'Tavern',
    description: 'A taproom for locals and travelers. Rumor network, modest income.',
    icon: '🍺',
    allowedCategories: ['civilian', 'martial'],
    slots: 1, baseGoldCost: 400, baseHoursRequired: 60,
    perks: ['rumor_network', 'passive_income_3']
  },
  guild_hall: {
    name: 'Guild Hall (building)',
    description: 'A meeting room and job board for sellswords and specialists.',
    icon: '⚔️',
    allowedCategories: ['civilian', 'martial'],
    slots: 1, baseGoldCost: 500, baseHoursRequired: 80,
    perks: ['quest_leads']
  },
  manor_house: {
    name: 'Manor House',
    description: 'Living quarters with prestige. Social-standing bonus in the region.',
    icon: '🏡',
    allowedCategories: ['civilian'],
    slots: 2, baseGoldCost: 1000, baseHoursRequired: 150,
    perks: ['prestige']
  },
  garden_kitchen: {
    name: 'Garden & Kitchen',
    description: 'Herbs, food, alchemical ingredients. Reduces ration cost and feeds staff.',
    icon: '🌿',
    allowedCategories: ['civilian', 'sanctified', 'arcane'],
    slots: 1, baseGoldCost: 200, baseHoursRequired: 30,
    perks: ['self_sufficient']
  },

  // ARCANE
  wizard_tower: {
    name: 'Wizard Tower (building)',
    description: 'An arcane spire within the base. Enables spell research and ritual casting at home.',
    icon: '🔮',
    allowedCategories: ['arcane', 'martial', 'civilian'],
    slots: 2, baseGoldCost: 1500, baseHoursRequired: 200,
    perks: ['spell_research', 'study_anywhere']
  },
  arcane_library: {
    name: 'Arcane Library',
    description: 'Shelves of tomes and scrolls. Tomes and scrolls generate slowly. Casters get research bonus.',
    icon: '📚',
    allowedCategories: ['arcane', 'sanctified', 'civilian'],
    slots: 1, baseGoldCost: 600, baseHoursRequired: 90,
    perks: ['research_bonus']
  },
  arcane_lab: {
    name: 'Arcane Laboratory',
    description: 'Alchemy, enchanting, and magical crafting workshop.',
    icon: '🧪',
    allowedCategories: ['arcane', 'sanctified'],
    slots: 1, baseGoldCost: 700, baseHoursRequired: 100,
    perks: ['crafting_speed', 'alchemy_station']
  },
  observatory: {
    name: 'Observatory',
    description: 'Celestial observation. Enables divination-based foresight once per week.',
    icon: '🔭',
    allowedCategories: ['arcane', 'sanctified'],
    slots: 1, baseGoldCost: 900, baseHoursRequired: 120,
    perks: ['divination_weekly']
  },

  // SANCTIFIED
  temple: {
    name: 'Temple (building)',
    description: 'A hall of worship. Healing services, divine communion, prayer bonuses.',
    icon: '⛪',
    allowedCategories: ['sanctified', 'civilian', 'martial'],
    slots: 2, baseGoldCost: 1000, baseHoursRequired: 150,
    perks: ['prayer_bonus', 'healing_ward']
  },
  chapel: {
    name: 'Chapel',
    description: 'A small shrine within the base. Morale bonus for garrison and staff.',
    icon: '🕊️',
    allowedCategories: null, // Any base can have a chapel
    slots: 1, baseGoldCost: 300, baseHoursRequired: 40,
    perks: ['morale_bonus']
  },
  reliquary: {
    name: 'Reliquary',
    description: 'Secured vault for holy relics. Attracts pilgrims and donations.',
    icon: '💠',
    allowedCategories: ['sanctified', 'civilian'],
    slots: 1, baseGoldCost: 700, baseHoursRequired: 90,
    perks: ['pilgrim_donations', 'passive_income_5']
  },

  // SHARED UTILITY
  storage_vault: {
    name: 'Storage Vault',
    description: 'Secure underground storage for treasure and supplies. Expands treasury capacity.',
    icon: '🗝️',
    allowedCategories: null,
    slots: 1, baseGoldCost: 400, baseHoursRequired: 60,
    perks: ['secure_storage']
  },
  guest_quarters: {
    name: 'Guest Quarters',
    description: 'Rooms for visiting allies. Allied NPCs stay longer; morale bump.',
    icon: '🛋️',
    allowedCategories: null,
    slots: 1, baseGoldCost: 300, baseHoursRequired: 45,
    perks: ['hospitality']
  }
};

/**
 * Returns which building types can be installed in a base of the given
 * subtype. Filters BUILDING_TYPES by its `allowedCategories` against the
 * subtype's category. Null allowedCategories means always allowed.
 */
export function getAvailableBuildingsForSubtype(subtype) {
  const subtypeConfig = BASE_SUBTYPES[subtype];
  if (!subtypeConfig) return {};
  const cat = subtypeConfig.category;
  const out = {};
  for (const [key, b] of Object.entries(BUILDING_TYPES)) {
    if (b.allowedCategories === null || b.allowedCategories.includes(cat)) {
      out[key] = b;
    }
  }
  return out;
}

// ============================================================
// HELPERS
// ============================================================

export function getUpgradeCatalog(baseType) {
  const typeUpgrades = TYPE_UPGRADES[baseType] || {};
  return { ...SHARED_UPGRADES, ...typeUpgrades };
}

export function getBaseIncome(baseType, level) {
  const type = BASE_TYPES[baseType];
  if (!type) return 0;
  return type.baseIncome + (type.incomePerLevel * (level - 1));
}

export function rollEntanglement(category) {
  const table = ENTANGLEMENTS[category] || ENTANGLEMENTS.criminal;
  const totalWeight = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return table[0];
}

export function getEntanglementRisk(score) {
  for (const t of ENTANGLEMENT_THRESHOLDS) {
    if (score >= t.min && score <= t.max) return t;
  }
  return ENTANGLEMENT_THRESHOLDS[0];
}
