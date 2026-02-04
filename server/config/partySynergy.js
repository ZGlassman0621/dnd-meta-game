/**
 * Party Synergy System
 *
 * Calculates success bonuses based on party composition using all 13 D&D 5e classes.
 * Each class contributes to different synergy categories, and balanced parties
 * receive bonuses based on coverage of key adventure requirements.
 */

// All 13 D&D 5e classes and their primary/secondary roles
export const CLASS_ROLES = {
  // Martial Classes
  barbarian: {
    name: 'Barbarian',
    primary: ['frontline', 'damage'],
    secondary: ['intimidation'],
    description: 'Rage-fueled warrior, excellent at soaking damage and dealing it back'
  },
  fighter: {
    name: 'Fighter',
    primary: ['frontline', 'damage'],
    secondary: ['tactics', 'versatility'],
    description: 'Master of weapons and armor, adaptable to any combat situation'
  },
  monk: {
    name: 'Monk',
    primary: ['mobility', 'damage'],
    secondary: ['stealth', 'perception'],
    description: 'Swift martial artist with supernatural abilities'
  },
  paladin: {
    name: 'Paladin',
    primary: ['frontline', 'healing'],
    secondary: ['social', 'divine'],
    description: 'Holy warrior combining martial prowess with divine magic'
  },
  ranger: {
    name: 'Ranger',
    primary: ['exploration', 'damage'],
    secondary: ['stealth', 'tracking'],
    description: 'Wilderness expert and skilled hunter'
  },

  // Skill Classes
  rogue: {
    name: 'Rogue',
    primary: ['stealth', 'skills'],
    secondary: ['damage', 'scouting'],
    description: 'Master of stealth, traps, and precision strikes'
  },

  // Full Casters
  bard: {
    name: 'Bard',
    primary: ['social', 'support'],
    secondary: ['healing', 'versatility'],
    description: 'Charismatic performer with magical versatility'
  },
  cleric: {
    name: 'Cleric',
    primary: ['healing', 'divine'],
    secondary: ['frontline', 'support'],
    description: 'Divine spellcaster and primary healer'
  },
  druid: {
    name: 'Druid',
    primary: ['nature', 'versatility'],
    secondary: ['healing', 'exploration'],
    description: 'Nature magic wielder with shapeshifting abilities'
  },
  sorcerer: {
    name: 'Sorcerer',
    primary: ['arcane', 'damage'],
    secondary: ['versatility'],
    description: 'Innate magic user with raw power'
  },
  warlock: {
    name: 'Warlock',
    primary: ['arcane', 'social'],
    secondary: ['damage', 'investigation'],
    description: 'Pact-bound caster with eldritch power'
  },
  wizard: {
    name: 'Wizard',
    primary: ['arcane', 'knowledge'],
    secondary: ['versatility', 'utility'],
    description: 'Learned spellcaster with vast magical knowledge'
  },

  // Artificer (added in later books)
  artificer: {
    name: 'Artificer',
    primary: ['crafting', 'support'],
    secondary: ['arcane', 'utility'],
    description: 'Magical inventor combining magic with technology'
  }
};

// Activity types and what roles they benefit from
export const ACTIVITY_SYNERGIES = {
  combat: {
    name: 'Combat',
    required: ['frontline', 'damage'],
    beneficial: ['healing', 'support', 'tactics'],
    description: 'Direct combat encounters'
  },
  exploration: {
    name: 'Exploration',
    required: ['exploration', 'perception'],
    beneficial: ['stealth', 'nature', 'mobility'],
    description: 'Scouting and navigating unknown areas'
  },
  social: {
    name: 'Social',
    required: ['social'],
    beneficial: ['intimidation', 'knowledge', 'divine'],
    description: 'Negotiations, diplomacy, and intrigue'
  },
  stealth: {
    name: 'Stealth',
    required: ['stealth'],
    beneficial: ['scouting', 'mobility', 'skills'],
    description: 'Infiltration and covert operations'
  },
  investigation: {
    name: 'Investigation',
    required: ['knowledge', 'investigation'],
    beneficial: ['arcane', 'divine', 'skills'],
    description: 'Research and mystery solving'
  },
  recovery: {
    name: 'Recovery',
    required: ['healing'],
    beneficial: ['support', 'nature'],
    description: 'Rest and recuperation'
  },
  crafting: {
    name: 'Crafting',
    required: ['crafting'],
    beneficial: ['arcane', 'knowledge', 'utility'],
    description: 'Creating items and equipment'
  },
  dungeon: {
    name: 'Dungeon Delve',
    required: ['frontline', 'stealth'],
    beneficial: ['healing', 'arcane', 'skills', 'damage'],
    description: 'Exploring dangerous dungeons and ruins'
  },
  monster_hunt: {
    name: 'Monster Hunt',
    required: ['tracking', 'damage'],
    beneficial: ['frontline', 'nature', 'healing'],
    description: 'Tracking and slaying dangerous creatures'
  },
  heist: {
    name: 'Heist',
    required: ['stealth', 'skills'],
    beneficial: ['social', 'arcane', 'mobility'],
    description: 'Theft and infiltration missions'
  },
  escort: {
    name: 'Escort',
    required: ['frontline', 'perception'],
    beneficial: ['healing', 'exploration', 'social'],
    description: 'Protecting people or cargo'
  },
  negotiation: {
    name: 'Negotiation',
    required: ['social'],
    beneficial: ['knowledge', 'intimidation'],
    description: 'Brokering deals and settling disputes'
  },
  training: {
    name: 'Training',
    required: [],
    beneficial: ['tactics', 'versatility'],
    description: 'Skill improvement and practice'
  },
  research: {
    name: 'Research',
    required: ['knowledge'],
    beneficial: ['arcane', 'divine'],
    description: 'Academic study and information gathering'
  },
  hunting: {
    name: 'Hunting',
    required: ['tracking', 'nature'],
    beneficial: ['stealth', 'damage'],
    description: 'Tracking game and gathering materials'
  },
  confrontation: {
    name: 'Confrontation',
    required: ['frontline', 'social'],
    beneficial: ['damage', 'intimidation', 'tactics'],
    description: 'Facing enemies or rivals directly'
  },
  mystery: {
    name: 'Mystery',
    required: ['investigation', 'knowledge'],
    beneficial: ['social', 'arcane', 'skills'],
    description: 'Solving puzzles and uncovering secrets'
  },
  work: {
    name: 'Work',
    required: [],
    beneficial: ['skills', 'crafting', 'social'],
    description: 'Honest labor for wages'
  }
};

/**
 * Get all roles contributed by a party member based on their class
 */
export function getClassRoles(className) {
  const normalizedClass = className?.toLowerCase()?.trim();
  const classInfo = CLASS_ROLES[normalizedClass];

  if (!classInfo) {
    // Unknown class - provide basic contribution
    return ['versatility'];
  }

  return [...classInfo.primary, ...classInfo.secondary];
}

/**
 * Calculate party synergy for a given activity type
 * Returns a synergy object with bonus percentage and breakdown
 */
export function calculatePartySynergy(partyMembers, activityType) {
  // Normalize activity type
  const normalizedActivity = activityType?.toLowerCase()?.replace(/[^a-z_]/g, '_');
  const activity = ACTIVITY_SYNERGIES[normalizedActivity] || ACTIVITY_SYNERGIES.combat;

  // Collect all roles from party members
  const partyRoles = new Set();
  const roleContributors = {};

  for (const member of partyMembers) {
    const memberClass = member.class || member.companion_class || member.occupation;
    const roles = getClassRoles(memberClass);

    for (const role of roles) {
      partyRoles.add(role);
      if (!roleContributors[role]) {
        roleContributors[role] = [];
      }
      roleContributors[role].push(member.name || member.firstName || 'Unknown');
    }
  }

  // Calculate coverage of required roles
  const requiredRoles = activity.required || [];
  const beneficialRoles = activity.beneficial || [];

  let requiredCoverage = 0;
  let beneficialCoverage = 0;
  const breakdown = [];

  // Check required roles (more important)
  for (const role of requiredRoles) {
    if (partyRoles.has(role)) {
      requiredCoverage++;
      breakdown.push({
        type: 'required',
        role,
        contributors: roleContributors[role] || [],
        bonus: 5 // 5% per required role covered
      });
    } else {
      breakdown.push({
        type: 'missing_required',
        role,
        contributors: [],
        penalty: -5 // Penalty for missing required role
      });
    }
  }

  // Check beneficial roles (nice to have)
  for (const role of beneficialRoles) {
    if (partyRoles.has(role)) {
      beneficialCoverage++;
      breakdown.push({
        type: 'beneficial',
        role,
        contributors: roleContributors[role] || [],
        bonus: 2 // 2% per beneficial role covered
      });
    }
  }

  // Calculate base synergy bonus
  let synergyBonus = 0;

  // Required role coverage bonus (up to +15% for full coverage)
  if (requiredRoles.length > 0) {
    const requiredPercent = requiredCoverage / requiredRoles.length;
    synergyBonus += Math.round(requiredPercent * 15);

    // Penalty for missing required roles
    const missingRequired = requiredRoles.length - requiredCoverage;
    synergyBonus -= missingRequired * 5;
  }

  // Beneficial role bonus (up to +10% for good coverage)
  if (beneficialRoles.length > 0) {
    const beneficialPercent = beneficialCoverage / beneficialRoles.length;
    synergyBonus += Math.round(beneficialPercent * 10);
  }

  // Party size bonus (larger parties have more options)
  if (partyMembers.length >= 4) {
    synergyBonus += 5;
    breakdown.push({
      type: 'party_size',
      role: 'full_party',
      contributors: partyMembers.map(m => m.name || m.firstName),
      bonus: 5
    });
  } else if (partyMembers.length >= 2) {
    synergyBonus += 2;
    breakdown.push({
      type: 'party_size',
      role: 'small_party',
      contributors: partyMembers.map(m => m.name || m.firstName),
      bonus: 2
    });
  }

  // Class diversity bonus (having different classes helps)
  const uniqueClasses = new Set(
    partyMembers.map(m => (m.class || m.companion_class || m.occupation || '').toLowerCase())
  );
  if (uniqueClasses.size >= 3) {
    synergyBonus += 3;
    breakdown.push({
      type: 'diversity',
      role: 'class_variety',
      contributors: Array.from(uniqueClasses),
      bonus: 3
    });
  }

  // Cap the bonus at +25% and floor at -10%
  synergyBonus = Math.max(-10, Math.min(25, synergyBonus));

  return {
    bonus: synergyBonus,
    bonusPercent: synergyBonus / 100,
    activity: activity.name,
    activityDescription: activity.description,
    partySize: partyMembers.length,
    rolesPresent: Array.from(partyRoles),
    requiredRoles,
    beneficialRoles,
    breakdown,
    summary: generateSynergySummary(synergyBonus, breakdown)
  };
}

/**
 * Generate a human-readable summary of the synergy calculation
 */
function generateSynergySummary(bonus, breakdown) {
  if (bonus >= 20) {
    return 'Excellent party composition! Your team is well-suited for this adventure.';
  } else if (bonus >= 10) {
    return 'Good party synergy. Your team has solid coverage for this activity.';
  } else if (bonus >= 0) {
    return 'Adequate party composition. Consider your approach carefully.';
  } else if (bonus >= -5) {
    return 'Suboptimal party for this activity. Some key roles are missing.';
  } else {
    return 'Challenging party composition. Your team lacks critical capabilities for this adventure.';
  }
}

/**
 * Get suggested classes that would improve synergy for an activity
 */
export function getSuggestedClasses(currentParty, activityType) {
  const synergy = calculatePartySynergy(currentParty, activityType);
  const suggestions = [];

  // Find missing required roles
  for (const item of synergy.breakdown) {
    if (item.type === 'missing_required') {
      // Find classes that provide this role
      for (const [className, classInfo] of Object.entries(CLASS_ROLES)) {
        if (classInfo.primary.includes(item.role)) {
          suggestions.push({
            class: classInfo.name,
            reason: `Would provide ${item.role} (required for this activity)`,
            priority: 'high'
          });
        }
      }
    }
  }

  // Suggest beneficial roles if we have room
  if (suggestions.length < 2) {
    for (const role of synergy.beneficialRoles) {
      if (!synergy.rolesPresent.includes(role)) {
        for (const [className, classInfo] of Object.entries(CLASS_ROLES)) {
          if (classInfo.primary.includes(role) && !suggestions.some(s => s.class === classInfo.name)) {
            suggestions.push({
              class: classInfo.name,
              reason: `Would provide ${role} (beneficial for this activity)`,
              priority: 'medium'
            });
            break;
          }
        }
      }
      if (suggestions.length >= 3) break;
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Calculate the modified success chance based on base chance and party synergy
 */
export function calculateModifiedSuccessChance(baseSuccessChance, partyMembers, activityType) {
  const synergy = calculatePartySynergy(partyMembers, activityType);

  // Apply synergy bonus to success chance
  const modifiedChance = Math.min(0.95, Math.max(0.05, baseSuccessChance + synergy.bonusPercent));

  return {
    baseChance: baseSuccessChance,
    synergyBonus: synergy.bonus,
    modifiedChance,
    synergyDetails: synergy
  };
}

export default {
  CLASS_ROLES,
  ACTIVITY_SYNERGIES,
  getClassRoles,
  calculatePartySynergy,
  getSuggestedClasses,
  calculateModifiedSuccessChance
};
