/**
 * D&D 5e Conditions & Status Effects
 * Used for in-session condition tracking UI
 */

export const CONDITIONS = {
  blinded: {
    name: 'Blinded',
    description: 'Cannot see. Auto-fail checks requiring sight. Attack rolls against have advantage, attacks made have disadvantage.',
    color: '#6b7280',
    autoClear: ['long_rest'],
    category: 'sensory'
  },
  charmed: {
    name: 'Charmed',
    description: 'Cannot attack the charmer. Charmer has advantage on social checks against you.',
    color: '#ec4899',
    autoClear: ['long_rest', 'combat_end'],
    category: 'mental'
  },
  deafened: {
    name: 'Deafened',
    description: 'Cannot hear. Auto-fail checks requiring hearing.',
    color: '#6b7280',
    autoClear: ['long_rest'],
    category: 'sensory'
  },
  frightened: {
    name: 'Frightened',
    description: 'Disadvantage on ability checks and attacks while source of fear is in line of sight. Cannot willingly move closer to fear source.',
    color: '#a855f7',
    autoClear: ['long_rest', 'combat_end'],
    category: 'mental'
  },
  grappled: {
    name: 'Grappled',
    description: 'Speed becomes 0. Ends if grappler is incapacitated or forced apart.',
    color: '#ef4444',
    autoClear: ['combat_end'],
    category: 'movement'
  },
  incapacitated: {
    name: 'Incapacitated',
    description: 'Cannot take actions or reactions.',
    color: '#1f2937',
    autoClear: ['long_rest'],
    category: 'incapacitation'
  },
  invisible: {
    name: 'Invisible',
    description: 'Cannot be seen without magic or special sense. Advantage on attack rolls, attacks against have disadvantage.',
    color: '#06b6d4',
    autoClear: ['long_rest'],
    category: 'sensory'
  },
  paralyzed: {
    name: 'Paralyzed',
    description: 'Incapacitated, cannot move or speak. Auto-fail STR and DEX saves. Attacks have advantage, melee hits are auto-crits.',
    color: '#dc2626',
    autoClear: ['long_rest'],
    category: 'incapacitation'
  },
  petrified: {
    name: 'Petrified',
    description: 'Transformed to stone. Weight x10, no aging. Incapacitated, unaware. Resistance to all damage. Immune to poison and disease.',
    color: '#78716c',
    autoClear: [],
    category: 'incapacitation'
  },
  poisoned: {
    name: 'Poisoned',
    description: 'Disadvantage on attack rolls and ability checks.',
    color: '#22c55e',
    autoClear: ['long_rest'],
    category: 'other'
  },
  prone: {
    name: 'Prone',
    description: 'Disadvantage on attack rolls. Melee attacks against have advantage, ranged attacks have disadvantage. Must use half movement to stand.',
    color: '#f59e0b',
    autoClear: ['combat_end'],
    category: 'movement'
  },
  restrained: {
    name: 'Restrained',
    description: 'Speed becomes 0. Attacks have disadvantage, attacks against have advantage. Disadvantage on DEX saves.',
    color: '#ef4444',
    autoClear: ['combat_end'],
    category: 'movement'
  },
  stunned: {
    name: 'Stunned',
    description: 'Incapacitated, cannot move, can only speak falteringly. Auto-fail STR and DEX saves. Attacks against have advantage.',
    color: '#eab308',
    autoClear: ['combat_end'],
    category: 'incapacitation'
  },
  unconscious: {
    name: 'Unconscious',
    description: 'Incapacitated, cannot move or speak, unaware. Drop what held, fall prone. Auto-fail STR/DEX saves. Attacks have advantage, melee auto-crit.',
    color: '#1f2937',
    autoClear: ['healing'],
    category: 'incapacitation'
  },
  exhaustion_1: {
    name: 'Exhaustion 1',
    description: 'Disadvantage on ability checks.',
    color: '#f59e0b',
    autoClear: ['long_rest_reduce'],
    category: 'exhaustion'
  },
  exhaustion_2: {
    name: 'Exhaustion 2',
    description: 'Speed halved.',
    color: '#f59e0b',
    autoClear: ['long_rest_reduce'],
    category: 'exhaustion'
  },
  exhaustion_3: {
    name: 'Exhaustion 3',
    description: 'Disadvantage on attack rolls and saving throws.',
    color: '#f59e0b',
    autoClear: ['long_rest_reduce'],
    category: 'exhaustion'
  },
  exhaustion_4: {
    name: 'Exhaustion 4',
    description: 'Hit point maximum halved.',
    color: '#f59e0b',
    autoClear: ['long_rest_reduce'],
    category: 'exhaustion'
  },
  exhaustion_5: {
    name: 'Exhaustion 5',
    description: 'Speed reduced to 0.',
    color: '#f59e0b',
    autoClear: ['long_rest_reduce'],
    category: 'exhaustion'
  },
  exhaustion_6: {
    name: 'Exhaustion 6',
    description: 'Death.',
    color: '#dc2626',
    autoClear: [],
    category: 'exhaustion'
  }
};

export const CONDITION_CATEGORIES = {
  sensory: { label: 'Sensory', color: '#6b7280' },
  movement: { label: 'Movement', color: '#ef4444' },
  mental: { label: 'Mental', color: '#a855f7' },
  incapacitation: { label: 'Incapacitation', color: '#1f2937' },
  other: { label: 'Other', color: '#22c55e' },
  exhaustion: { label: 'Exhaustion', color: '#f59e0b' }
};

/**
 * Get conditions that auto-clear on a given trigger
 */
export function getConditionsToClear(trigger, activeConditions) {
  return activeConditions.filter(condKey => {
    const cond = CONDITIONS[condKey];
    if (!cond) return false;
    if (trigger === 'long_rest') {
      return cond.autoClear.includes('long_rest');
    }
    if (trigger === 'combat_end') {
      return cond.autoClear.includes('combat_end');
    }
    if (trigger === 'healing') {
      return cond.autoClear.includes('healing');
    }
    return false;
  });
}

/**
 * Reduce exhaustion by 1 level on long rest (5e rule)
 * Returns updated conditions array
 */
export function reduceExhaustion(activeConditions) {
  const exhaustionKey = activeConditions.find(k => k.startsWith('exhaustion_'));
  if (!exhaustionKey) return activeConditions;

  const level = parseInt(exhaustionKey.split('_')[1]);
  const withoutCurrent = activeConditions.filter(k => k !== exhaustionKey);

  if (level <= 1) {
    return withoutCurrent; // Exhaustion removed
  }
  return [...withoutCurrent, `exhaustion_${level - 1}`]; // Reduce by 1
}
