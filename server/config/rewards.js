import { calculatePartySynergy, calculateModifiedSuccessChance } from './partySynergy.js';

// Time multipliers based on duration
export function getTimeMultiplier(hours) {
  // TEST MODE: 0.033 hours (2 minutes) simulates 8-hour rewards
  if (hours < 0.05) return 1.0; // Treat very short durations as 8-hour baseline

  if (hours >= 24) return 2.0;
  if (hours >= 14) return 1.6;
  if (hours >= 10) return 1.3;
  if (hours >= 8) return 1.0;
  if (hours >= 4) return 0.7;
  return 0.3; // 2 hours or less
}

// Base gold rewards by level (in copper pieces for easier calculation)
export function getBaseGoldReward(level) {
  if (level <= 3) return 50; // 50 cp
  if (level <= 7) return 100; // 10 sp = 100 cp
  if (level <= 10) return 500; // 50 sp = 500 cp
  if (level <= 13) return 5000; // 5 gp = 5000 cp
  if (level <= 16) return 25000; // 25 gp = 25000 cp
  return 100000; // 100 gp = 100000 cp (levels 17-20)
}

// Risk multipliers
export const RISK_MULTIPLIERS = {
  low: { gold: 0.5, xp: 0.6, failure_chance: 0.1 },
  medium: { gold: 1.0, xp: 1.0, failure_chance: 0.25 },
  high: { gold: 1.8, xp: 1.5, failure_chance: 0.4 }
};

// Base XP rewards by character level (roughly tuned for D&D 5e progression)
// These represent baseline XP for a standard 8-hour adventure
export function getBaseXPReward(level) {
  // XP rewards scale with level to match the increasing thresholds
  // Level 1-4: ~75-100 XP per adventure (need 3-4 adventures to level)
  // Level 5-10: ~200-400 XP per adventure
  // Level 11+: ~500-1000+ XP per adventure
  if (level <= 2) return 75;
  if (level <= 4) return 150;
  if (level <= 6) return 300;
  if (level <= 8) return 500;
  if (level <= 10) return 750;
  if (level <= 12) return 1000;
  if (level <= 14) return 1500;
  if (level <= 16) return 2000;
  if (level <= 18) return 3000;
  return 4000; // 19-20
}

// Calculate XP reward
export function calculateXPReward(currentXP, experienceToNextLevel, riskLevel, timeMultiplier, level = 1) {
  const baseXP = getBaseXPReward(level);
  const riskMultiplier = RISK_MULTIPLIERS[riskLevel].xp;
  return Math.floor(baseXP * riskMultiplier * timeMultiplier);
}

// Calculate gold reward (returns object with cp, sp, gp)
export function calculateGoldReward(level, riskLevel, timeMultiplier) {
  const baseGold = getBaseGoldReward(level);
  const riskMultiplier = RISK_MULTIPLIERS[riskLevel].gold;
  const totalCopper = Math.floor(baseGold * riskMultiplier * timeMultiplier);

  // Convert to gp, sp, cp
  const gp = Math.floor(totalCopper / 10000);
  const remaining = totalCopper % 10000;
  const sp = Math.floor(remaining / 100);
  const cp = remaining % 100;

  return { cp, sp, gp };
}

// Determine if adventure succeeds or fails (basic version without party synergy)
export function determineSuccess(riskLevel) {
  const failureChance = RISK_MULTIPLIERS[riskLevel].failure_chance;
  return Math.random() > failureChance;
}

/**
 * Determine success with full odds calculation including party synergy
 * Returns success result plus full odds breakdown for transparency
 */
export function determineSuccessWithOdds(riskLevel, partyMembers, activityType) {
  const baseSuccessChance = 1 - RISK_MULTIPLIERS[riskLevel].failure_chance;

  // Calculate party synergy bonus
  const synergy = calculatePartySynergy(partyMembers, activityType);

  // Apply synergy to success chance (cap at 95%, floor at 5%)
  const modifiedChance = Math.min(0.95, Math.max(0.05, baseSuccessChance + synergy.bonusPercent));

  // Roll for success
  const roll = Math.random();
  const success = roll < modifiedChance;

  return {
    success,
    roll: Math.round(roll * 100),
    odds: {
      baseChance: Math.round(baseSuccessChance * 100),
      riskLevel,
      synergyBonus: synergy.bonus,
      finalChance: Math.round(modifiedChance * 100),
      breakdown: [
        {
          factor: 'Base Success Rate',
          value: `${Math.round(baseSuccessChance * 100)}%`,
          description: `${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} risk adventure`
        },
        {
          factor: 'Party Synergy',
          value: `${synergy.bonus >= 0 ? '+' : ''}${synergy.bonus}%`,
          description: synergy.summary
        }
      ],
      synergyDetails: synergy
    }
  };
}

/**
 * Get odds preview without rolling (for UI display before starting adventure)
 */
export function previewOdds(riskLevel, partyMembers, activityType) {
  const baseSuccessChance = 1 - RISK_MULTIPLIERS[riskLevel].failure_chance;
  const synergy = calculatePartySynergy(partyMembers, activityType);
  const modifiedChance = Math.min(0.95, Math.max(0.05, baseSuccessChance + synergy.bonusPercent));

  return {
    baseChance: Math.round(baseSuccessChance * 100),
    riskLevel,
    synergyBonus: synergy.bonus,
    finalChance: Math.round(modifiedChance * 100),
    breakdown: [
      {
        factor: 'Base Success Rate',
        value: `${Math.round(baseSuccessChance * 100)}%`,
        description: `${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} risk adventure`
      },
      {
        factor: 'Party Synergy',
        value: `${synergy.bonus >= 0 ? '+' : ''}${synergy.bonus}%`,
        description: synergy.summary
      }
    ],
    synergyDetails: synergy
  };
}

// Generate failure consequences
export function generateConsequences(character, riskLevel) {
  const consequences = [];
  const severity = riskLevel === 'high' ? 2 : riskLevel === 'medium' ? 1 : 0.5;

  // HP loss (percentage based)
  const hpLoss = Math.floor(character.max_hp * (0.1 + Math.random() * 0.3) * severity);
  consequences.push({
    type: 'hp_loss',
    value: hpLoss,
    description: `Lost ${hpLoss} HP`
  });

  // Possible gold loss
  if (Math.random() < 0.4) {
    const goldLossPercent = Math.random() * 0.2 * severity; // Up to 20% loss
    consequences.push({
      type: 'gold_loss',
      value: goldLossPercent,
      description: `Lost ${Math.floor(goldLossPercent * 100)}% of carried gold`
    });
  }

  // Possible equipment damage
  if (Math.random() < 0.3) {
    consequences.push({
      type: 'equipment_damage',
      description: 'Equipment damaged - requires repair'
    });
  }

  // Possible temporary debuff
  if (Math.random() < 0.5) {
    const debuffs = [
      'Exhausted - disadvantage on ability checks',
      'Injured - movement speed reduced',
      'Poisoned - disadvantage on attack rolls',
      'Frightened - disadvantage on saving throws'
    ];
    consequences.push({
      type: 'debuff',
      description: debuffs[Math.floor(Math.random() * debuffs.length)],
      duration: '1d4 game days'
    });
  }

  return consequences;
}

// Consequence categories for story threads
export const CONSEQUENCE_CATEGORIES = {
  new_enemy: {
    name: 'New Enemy',
    successChance: 0.15, // 15% chance on adventure
    failureChance: 0.30, // 30% chance on failed adventure
    description: 'Someone now knows about and opposes the party'
  },
  new_ally: {
    name: 'New Ally',
    successChance: 0.20,
    failureChance: 0.05,
    description: 'A potential new friend or contact'
  },
  intel: {
    name: 'Intelligence',
    successChance: 0.35,
    failureChance: 0.15,
    description: 'Valuable information discovered'
  },
  reputation: {
    name: 'Reputation',
    successChance: 0.25,
    failureChance: 0.25,
    description: 'How the party is perceived has changed'
  },
  resource: {
    name: 'Resource',
    successChance: 0.20,
    failureChance: 0.05,
    description: 'Access to new resources or opportunities'
  }
};

/**
 * Generate story consequences for an adventure
 * These create story threads that persist and can affect future sessions
 */
export function generateStoryConsequences(adventure, success, questRelevance = 'side_quest') {
  const storyConsequences = [];

  // Higher chance of story consequences for quest-related adventures
  const relevanceMultiplier = questRelevance === 'quest_advancing' ? 1.5 :
                               questRelevance === 'quest_adjacent' ? 1.2 : 1.0;

  for (const [category, config] of Object.entries(CONSEQUENCE_CATEGORIES)) {
    const baseChance = success ? config.successChance : config.failureChance;
    const adjustedChance = baseChance * relevanceMultiplier;

    if (Math.random() < adjustedChance) {
      storyConsequences.push({
        category,
        name: config.name,
        description: config.description,
        success,
        // Flag if this consequence could resolve a quest (for quest-advancing adventures)
        canResolveQuest: questRelevance === 'quest_advancing' &&
                         success &&
                         (category === 'intel' || category === 'new_ally'),
        // Quest relevance flows through to the consequence
        questRelevance
      });
    }
  }

  // Guarantee at least one story consequence for quest-advancing adventures
  if (storyConsequences.length === 0 && questRelevance === 'quest_advancing') {
    const guaranteedCategory = success ? 'intel' : 'new_enemy';
    const config = CONSEQUENCE_CATEGORIES[guaranteedCategory];
    storyConsequences.push({
      category: guaranteedCategory,
      name: config.name,
      description: config.description,
      success,
      canResolveQuest: success && guaranteedCategory === 'intel',
      questRelevance
    });
  }

  return storyConsequences;
}

// Equipment loot tables by level range — items match names in merchantLootTables.js
const EQUIPMENT_BY_LEVEL = {
  1: [
    'Potion of Healing', 'Driftglobe', 'Moon-Touched Sword',
    'Cloak of Many Fashions', 'Candle of the Deep', 'Enduring Spellbook',
    'Ruby of the War Mage', 'Tankard of Sobriety', 'Clockwork Amulet',
    'Hat of Wizardry', 'Cloak of Billowing', 'Walloping Ammunition',
    'Veteran\'s Cane', 'Pole of Collapsing', 'Horn of Silent Alarm'
  ],
  5: [
    'Potion of Greater Healing', 'Bag of Holding', 'Cloak of Protection',
    'Boots of Elvenkind', 'Gauntlets of Ogre Power', 'Winged Boots',
    'Javelin of Lightning', 'Weapon of Warning', 'Wand of Magic Missiles',
    'Goggles of Night', 'Pearl of Power', 'Headband of Intellect',
    'Hat of Disguise', 'Immovable Rod', 'Stone of Good Luck'
  ],
  10: [
    'Potion of Superior Healing', 'Flame Tongue', 'Sun Blade',
    'Cloak of Displacement', 'Boots of Speed', 'Amulet of Health',
    'Ring of Spell Storing', 'Necklace of Fireballs', 'Wand of Fireballs',
    'Belt of Giant Strength (Hill)', '+2 Armor (any)', 'Ring of Evasion',
    'Dragon Slayer', 'Portable Hole', 'Wings of Flying'
  ],
  15: [
    'Potion of Speed', 'Dancing Sword', 'Scimitar of Speed',
    '+3 Armor (any)', 'Animated Shield', 'Carpet of Flying',
    'Ring of Regeneration', 'Staff of Power', 'Robe of Stars',
    'Manual of Bodily Health', 'Cloak of Arachnida', 'Oathbow'
  ]
};

// Generate random loot (20% chance on successful high-risk adventures)
export function generateLoot(level, riskLevel) {
  // Only high-risk adventures drop loot, and only 20% of the time
  if (riskLevel !== 'high' || Math.random() > 0.2) {
    return null;
  }

  // Find appropriate loot table based on character level
  let lootTable = EQUIPMENT_BY_LEVEL[1];
  if (level >= 15) lootTable = EQUIPMENT_BY_LEVEL[15];
  else if (level >= 10) lootTable = EQUIPMENT_BY_LEVEL[10];
  else if (level >= 5) lootTable = EQUIPMENT_BY_LEVEL[5];

  // Pick a random item
  const item = lootTable[Math.floor(Math.random() * lootTable.length)];
  return item;
}
