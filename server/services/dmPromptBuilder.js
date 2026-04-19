/**
 * DM Prompt Builder - System Prompt Construction for AI Dungeon Master
 *
 * Handles all formatting of character data, content preferences, NPCs,
 * companions, campaign plans, and the massive DM system prompt.
 * Extracted from ollama.js for maintainability.
 */

// Quality rank bonuses for equipment
const QUALITY_BONUSES = {
  poor: { weapon: -1, armor: -1 },
  common: { weapon: 0, armor: 0 },
  fine: { weapon: 0, armor: 0 },
  masterwork: { weapon: 1, armor: 0 },
  exceptional: { weapon: 1, armor: 1 },
  legendary: { weapon: 2, armor: 1 }
};

// Armor base AC values
const ARMOR_DATA = {
  'Padded': { baseAC: 11, type: 'light' },
  'Leather': { baseAC: 11, type: 'light' },
  'Studded Leather': { baseAC: 12, type: 'light' },
  'Hide': { baseAC: 12, type: 'medium', maxDex: 2 },
  'Chain Shirt': { baseAC: 13, type: 'medium', maxDex: 2 },
  'Scale Mail': { baseAC: 14, type: 'medium', maxDex: 2 },
  'Breastplate': { baseAC: 14, type: 'medium', maxDex: 2 },
  'Half Plate': { baseAC: 15, type: 'medium', maxDex: 2 },
  'Ring Mail': { baseAC: 14, type: 'heavy' },
  'Chain Mail': { baseAC: 16, type: 'heavy' },
  'Splint': { baseAC: 17, type: 'heavy' },
  'Plate': { baseAC: 18, type: 'heavy' }
};

// Companion mood RP guidance for the DM
const MOOD_RP_GUIDANCE = {
  content: null, // No special guidance needed
  anxious: 'nervous, second-guessing, seeking reassurance',
  angry: 'short-tempered, confrontational, holding a grudge',
  sad: 'quiet, withdrawn, mentioning what they lost',
  fearful: 'reluctant, cautious, urging retreat',
  excited: 'eager, talkative, overconfident',
  conflicted: 'hesitant, voicing doubts, asking moral questions',
  grateful: 'warm, supportive, going extra mile for the party',
  resentful: 'cold, passive-aggressive, bringing up grievances',
  exhausted: 'slow, unfocused, asking for rest, making mistakes'
};

/**
 * Calculate combat stats from character equipment
 */
function calculateCombatStats(character) {
  const abilities = typeof character.ability_scores === 'string'
    ? JSON.parse(character.ability_scores || '{}')
    : (character.ability_scores || {});

  const equipment = typeof character.equipment === 'string'
    ? JSON.parse(character.equipment || '{}')
    : (character.equipment || {});

  const dexMod = Math.floor(((abilities.dex || 10) - 10) / 2);
  const strMod = Math.floor(((abilities.str || 10) - 10) / 2);
  const profBonus = Math.ceil((character.level || 1) / 4) + 1;

  // Calculate AC
  let ac = 10 + dexMod; // Base unarmored AC
  const equippedArmor = equipment.armor;
  if (equippedArmor) {
    const armorInfo = ARMOR_DATA[equippedArmor.name] || equippedArmor;
    if (armorInfo.type === 'heavy' || armorInfo.armorType === 'heavy') {
      ac = armorInfo.baseAC;
    } else if (armorInfo.type === 'medium' || armorInfo.armorType === 'medium') {
      const cappedDex = Math.min(dexMod, armorInfo.maxDex || armorInfo.maxDexBonus || 2);
      ac = armorInfo.baseAC + cappedDex;
    } else {
      ac = armorInfo.baseAC + dexMod;
    }
    // Quality bonus
    const quality = equippedArmor.quality || 'common';
    ac += QUALITY_BONUSES[quality]?.armor || 0;
  }

  // Shield bonus
  if (equipment.offHand?.acBonus) {
    ac += equipment.offHand.acBonus;
  }

  // Calculate weapon stats
  let weaponInfo = null;
  const weapon = equipment.mainHand;
  if (weapon) {
    const isFinesse = weapon.properties?.includes('finesse');
    const isRanged = weapon.rangeType === 'ranged';
    let abilityMod = isFinesse ? Math.max(strMod, dexMod) : (isRanged ? dexMod : strMod);
    const qualityBonus = QUALITY_BONUSES[weapon.quality || 'common']?.weapon || 0;
    const attackBonus = abilityMod + profBonus + qualityBonus;
    const damageBonus = abilityMod >= 0 ? `+${abilityMod}` : abilityMod;

    weaponInfo = {
      name: weapon.name,
      quality: weapon.quality || 'common',
      attackBonus: attackBonus,
      damage: `${weapon.damage || '1d4'}${damageBonus}`,
      damageType: weapon.damageType || 'bludgeoning'
    };
  }

  return { ac, weapon: weaponInfo };
}

/**
 * Format a character's info for the system prompt
 */
function formatCharacterInfo(character, label = 'PLAYER CHARACTER') {
  const abilities = typeof character.ability_scores === 'string'
    ? JSON.parse(character.ability_scores)
    : character.ability_scores;

  const inventory = typeof character.inventory === 'string'
    ? JSON.parse(character.inventory || '[]')
    : (character.inventory || []);

  const skills = typeof character.skills === 'string'
    ? JSON.parse(character.skills || '[]')
    : (character.skills || []);

  // Parse feats - can be array of strings or array of objects with name/key
  const featsRaw = typeof character.feats === 'string'
    ? JSON.parse(character.feats || '[]')
    : (character.feats || []);
  const feats = featsRaw.map(f => typeof f === 'string' ? f : (f.name || f.key)).filter(Boolean);

  // Parse known cantrips and spells
  const knownCantrips = typeof character.known_cantrips === 'string'
    ? JSON.parse(character.known_cantrips || '[]')
    : (character.known_cantrips || []);

  const knownSpells = typeof character.known_spells === 'string'
    ? JSON.parse(character.known_spells || '[]')
    : (character.known_spells || []);

  // Parse prepared spells (for prepared casters like Clerics, Paladins, Wizards)
  const preparedSpells = typeof character.prepared_spells === 'string'
    ? JSON.parse(character.prepared_spells || '[]')
    : (character.prepared_spells || []);

  const fullName = character.name;
  const firstName = character.first_name || character.name.split(' ')[0];
  const nickname = character.nickname || null;

  // Determine pronouns from gender
  const gender = character.gender?.toLowerCase() || '';
  let pronouns = 'they/them';
  if (gender === 'male' || gender === 'm') pronouns = 'he/him';
  else if (gender === 'female' || gender === 'f') pronouns = 'she/her';

  // Calculate combat stats from equipment
  const combatStats = calculateCombatStats(character);
  const ac = combatStats.ac;

  // Build weapon info string
  let weaponStr = 'Unarmed';
  if (combatStats.weapon) {
    const w = combatStats.weapon;
    const qualityPrefix = w.quality !== 'common' ? `${w.quality} ` : '';
    weaponStr = `${qualityPrefix}${w.name} (+${w.attackBonus} to hit, ${w.damage} ${w.damageType})`;
  }

  // Build feats section with mechanical effects for DM awareness
  let featsSection = '';
  if (feats.length > 0) {
    featsSection = `\n- Feats: ${feats.join(', ')}`;
    // Add important mechanical notes for common feats
    const featEffects = [];
    feats.forEach(feat => {
      const featLower = feat.toLowerCase().replace(/_/g, ' ');
      if (featLower.includes('dungeon delver')) {
        featEffects.push('Dungeon Delver: Advantage on Perception/Investigation to detect secret doors; advantage on saves vs traps; resistance to trap damage');
      }
      if (featLower.includes('alert')) {
        featEffects.push('Alert: +5 initiative; cannot be surprised; hidden creatures do not gain advantage');
      }
      if (featLower.includes('observant')) {
        featEffects.push('Observant: +5 passive Perception and Investigation; can read lips');
      }
      if (featLower.includes('lucky')) {
        featEffects.push('Lucky: 3 luck points to reroll d20s per long rest');
      }
      if (featLower.includes('sentinel')) {
        featEffects.push('Sentinel: Opportunity attacks reduce speed to 0; can attack when ally is attacked');
      }
      if (featLower.includes('sharpshooter')) {
        featEffects.push('Sharpshooter: No disadvantage at long range; ignore cover; can take -5 to hit for +10 damage');
      }
      if (featLower.includes('great weapon master')) {
        featEffects.push('Great Weapon Master: Bonus action attack on crit/kill; can take -5 to hit for +10 damage');
      }
      if (featLower.includes('polearm master')) {
        featEffects.push('Polearm Master: Bonus action d4 attack; opportunity attacks when enemies enter reach');
      }
      if (featLower.includes('war caster')) {
        featEffects.push('War Caster: Advantage on concentration saves; can cast spells as opportunity attacks');
      }
      if (featLower.includes('mobile')) {
        featEffects.push('Mobile: +10 speed; no opportunity attacks from creatures you attack');
      }
      if (featLower.includes('resilient')) {
        featEffects.push('Resilient: Proficiency in one saving throw');
      }
      if (featLower.includes('skulker')) {
        featEffects.push('Skulker: Can hide when lightly obscured; missed ranged attacks do not reveal position');
      }
      if (featLower.includes('mage slayer')) {
        featEffects.push('Mage Slayer: Reaction attack when adjacent creature casts spell; targets have disadvantage on concentration');
      }
      if (featLower.includes('savage attacker')) {
        featEffects.push('Savage Attacker: Reroll melee weapon damage once per turn');
      }
    });
    if (featEffects.length > 0) {
      featsSection += `\n  FEAT EFFECTS (apply these in relevant situations):\n  ${featEffects.join('\n  ')}`;
    }
  }

  // Build spellcasting section
  let spellSection = '';
  const hasSpells = knownCantrips.length > 0 || knownSpells.length > 0 || preparedSpells.length > 0;
  if (hasSpells) {
    const spellParts = [];
    if (knownCantrips.length > 0) {
      spellParts.push(`Cantrips: ${knownCantrips.join(', ')}`);
    }
    if (knownSpells.length > 0) {
      spellParts.push(`Known Spells: ${knownSpells.join(', ')}`);
    }
    if (preparedSpells.length > 0) {
      spellParts.push(`Prepared Spells: ${preparedSpells.join(', ')}`);
    }
    spellSection = `\n- Spellcasting: ${spellParts.join('; ')}`;
  }

  // Build Keeper abilities section
  let keeperSection = '';
  if (character.class?.toLowerCase() === 'keeper') {
    const keeperParts = [];
    const keeperTexts = typeof character.keeper_texts === 'string' ? JSON.parse(character.keeper_texts || '[]') : (character.keeper_texts || []);
    const keeperRecitations = typeof character.keeper_recitations === 'string' ? JSON.parse(character.keeper_recitations || '[]') : (character.keeper_recitations || []);

    if (keeperRecitations.length > 0) {
      keeperParts.push(`Recitations (at-will): ${keeperRecitations.join(', ')}`);
    }
    if (keeperTexts.length > 0) {
      keeperParts.push(`Library Texts (weapon + Passage each): ${keeperTexts.join(', ')}`);
    }
    if (character.keeper_genre_domain) {
      keeperParts.push(`Genre Domain: ${character.keeper_genre_domain}`);
    }
    if (character.keeper_specialization) {
      keeperParts.push(`Specialization: ${character.keeper_specialization}`);
    }
    if (keeperParts.length > 0) {
      keeperSection = `\n- Keeper Abilities: ${keeperParts.join('; ')}`;
      keeperSection += `\n  KEEPER RULES: Uses CHA for manifested weapon attacks. Manifest Weapon = bonus action to summon weapon from a text. Each text has a Passage (once per short rest special effect). Recitations are cantrip equivalents (at will). Keeper save DC = 8 + proficiency + CHA mod.${character.level >= 2 ? ' Keeper\'s Study = bonus action to mark a creature as Studied (PB/long rest) — Recitations and weapon attacks deal extra damage to Studied creatures, and Keeper learns one fact about them.' : ''}`;
    }
  }

  return {
    text: `${label}:
- Full Name: ${fullName}
- First Name: ${firstName}${nickname ? `\n- Nickname: ${nickname} (only close friends or those the character has shared this with would use it)` : ''}
- Gender: ${character.gender || 'unspecified'} - USE ${pronouns.toUpperCase()} PRONOUNS FOR THIS CHARACTER
- Race: ${character.race}
- Class: ${character.class}${character.subclass ? ` (${character.subclass})` : ''}${character.keeper_specialization ? ` [${character.keeper_specialization}]` : ''}
- Level: ${character.level}
- Background: ${character.background || 'Unknown'}
- Current HP: ${character.current_hp}/${character.max_hp}
- Armor Class: ${ac}
- Weapon: ${weaponStr}
- Abilities: STR ${abilities?.str || 10}, DEX ${abilities?.dex || 10}, CON ${abilities?.con || 10}, INT ${abilities?.int || 10}, WIS ${abilities?.wis || 10}, CHA ${abilities?.cha || 10}
- Skills: ${skills.length > 0 ? skills.join(', ') : 'None specified'}${featsSection}${spellSection}${keeperSection}
- Key Equipment: ${inventory.slice(0, 5).map(i => i.name || i).join(', ') || 'Basic adventuring gear'}
- Current Location: ${character.current_location || 'Unknown'}
- Current Quest: ${character.current_quest || 'None'}
${character.personality_traits ? `- Personality: ${character.personality_traits}` : ''}
${character.backstory ? `- Backstory: ${character.backstory}` : ''}`,
    firstName,
    nickname
  };
}

/**
 * Format a one-line naming protocol directive for a single NPC's block,
 * derived from a nickname resolution. Returns null when no resolution is
 * available so the caller can filter it out cleanly.
 */
function formatNamingProtocolLine(resolution) {
  if (!resolution) return null;
  if (resolution.bard_override) {
    const names = (resolution.allowed || []).map(a => a.nickname).filter(Boolean);
    return names.length > 0
      ? `  Calls the PC: any familiar form (bard — rule of cool). Known forms: ${names.join(', ')}.`
      : `  Calls the PC: any familiar form (bard — rule of cool).`;
  }
  const row = resolution.primary_row;
  if (!row) {
    return `  Calls the PC: ${resolution.fallback_legal_name} (no relationship-specific name applies).`;
  }
  const label = audiencePromptLabel(row);
  return `  Calls the PC: "${row.nickname}" (${label}).`;
}

function audiencePromptLabel(row) {
  switch (row.audience_type) {
    case 'default': return 'default / stranger-facing';
    case 'friends': return 'friends only';
    case 'allied': return 'allied or closer';
    case 'devoted': return 'devoted only';
    case 'specific_npc': return 'this NPC specifically';
    case 'role': return `role: ${row.audience_value}`;
    default: return row.audience_type;
  }
}

/**
 * Format an NPC's voice palette (stored as JSON on npcs.voice_palette) as a
 * multi-line prompt block. Returns null if no palette is set or the JSON is
 * malformed. Inlined here rather than imported from npcVoiceService to keep
 * the prompt builder free of AI-client dependencies.
 *
 * Palette shape:
 *   { age_descriptor, register, speech_patterns[], mannerisms[], vocabulary, forbid[] }
 */
function formatVoicePalette(paletteJson) {
  if (!paletteJson) return null;
  let palette;
  if (typeof paletteJson === 'string') {
    try { palette = JSON.parse(paletteJson); } catch { return null; }
  } else {
    palette = paletteJson;
  }
  if (!palette || !palette.register) return null;

  const lines = [];
  const voicePieces = [palette.age_descriptor, palette.register].filter(Boolean);
  if (voicePieces.length > 0) lines.push(`  Voice: ${voicePieces.join(', ')}.`);
  if (Array.isArray(palette.speech_patterns) && palette.speech_patterns.length > 0) {
    lines.push(`  Speech: ${palette.speech_patterns.join(', ')}.`);
  }
  if (Array.isArray(palette.mannerisms) && palette.mannerisms.length > 0) {
    lines.push(`  Mannerisms: ${palette.mannerisms.join(', ')}.`);
  }
  if (palette.vocabulary) lines.push(`  Vocabulary: ${palette.vocabulary}.`);
  if (Array.isArray(palette.forbid) && palette.forbid.length > 0) {
    lines.push(`  Never says: ${palette.forbid.join(', ')}.`);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Format custom NPC data for the system prompt.
 *
 * `nicknameResolutions` is an optional map keyed by npc id → resolution object
 * (shape from `nicknameService.resolveForNpc`). When present, each NPC block
 * gets a "Calls the PC:" line specifying which form of the player's name this
 * NPC should use, based on the audience rules the player set up.
 */
function formatCustomNpcs(npcs, nicknameResolutions = null) {
  if (!npcs || npcs.length === 0) return '';

  const npcDescriptions = npcs.map(npc => {
    const availability = npc.campaign_availability || 'available';
    let roleNote = '';
    if (availability === 'companion') {
      roleNote = ' [POTENTIAL COMPANION - can offer to join the party if appropriate]';
    } else if (availability === 'mention_only') {
      roleNote = ' [MENTION ONLY - reference this character but they should not appear directly in scenes]';
    }

    const relationship = npc.relationship_to_party?.replace(/_/g, ' ') || 'neutral';
    let roleDescription = '';
    if (relationship === 'merchant' || npc.occupation_category === 'merchant') {
      roleDescription = ' ** THIS IS A MERCHANT - they buy and sell goods, NOT a quest giver or guardian **';
    } else if (relationship === 'ally') {
      roleDescription = ' ** This NPC is friendly and may help the player **';
    } else if (relationship === 'enemy') {
      roleDescription = ' ** This NPC is hostile to the player **';
    }

    const resolution = nicknameResolutions ? nicknameResolutions[npc.id] : null;
    const namingLine = formatNamingProtocolLine(resolution);

    // Voice palette (v1.0.33+): if the NPC has a generated voice palette,
    // surface it to the DM as structured speech hints so dialogue can match
    // age and register. formatVoicePaletteForPrompt returns a multi-line
    // string (already indented) or null if no palette.
    const voiceBlock = formatVoicePalette(npc.voice_palette);

    const parts = [
      `- ${npc.name}${roleNote}${roleDescription}`,
      `  Race: ${npc.race}${npc.age ? ` (${npc.age})` : ''}, Gender: ${npc.gender || 'unspecified'}`,
      npc.nickname ? `  Private Nickname: "${npc.nickname}" (ONLY use if the NPC explicitly shares it with the player - introduce them by their full name first)` : null,
      namingLine,
      npc.occupation ? `  OCCUPATION: ${npc.occupation} - THIS DEFINES WHAT THEY DO. A book dealer sells books. A blacksmith forges weapons. DO NOT make them into something else.` : null,
      npc.occupation_category ? `  Occupation Type: ${npc.occupation_category}` : null,
      npc.current_location ? `  Location: ${npc.current_location}` : null,
      `  Relationship to Player: ${relationship}`,
      npc.personality_trait_1 ? `  Personality: ${npc.personality_trait_1}${npc.personality_trait_2 ? ', ' + npc.personality_trait_2 : ''}` : null,
      npc.motivation ? `  Motivation: ${npc.motivation}` : null,
      npc.secret ? `  Secret (reveal gradually if appropriate): ${npc.secret}` : null,
      npc.background_notes ? `  Notes: ${npc.background_notes}` : null,
      voiceBlock
    ].filter(Boolean);

    return parts.join('\n');
  });

  return `\n\nCUSTOM NPCS - CRITICAL INSTRUCTIONS:
These are pre-defined characters the user created. You MUST respect their established roles:
- A MERCHANT sells goods - they are NOT mysterious guardians, quest givers, or plot devices
- An NPC's OCCUPATION defines what they do - a "Book Dealer" deals books, not guards ancient sites
- Use their personality traits, but keep them in their established role
- If you need a guardian, mystic, or quest-giver, create a NEW NPC - don't repurpose these

${npcDescriptions.join('\n\n')}`;
}

// Map each D&D 5e skill to its governing ability score
const SKILL_ABILITY_MAP = {
  'Acrobatics': 'dex', 'Animal Handling': 'wis', 'Arcana': 'int',
  'Athletics': 'str', 'Deception': 'cha', 'History': 'int',
  'Insight': 'wis', 'Intimidation': 'cha', 'Investigation': 'int',
  'Medicine': 'wis', 'Nature': 'int', 'Perception': 'wis',
  'Performance': 'cha', 'Persuasion': 'cha', 'Religion': 'int',
  'Sleight of Hand': 'dex', 'Stealth': 'dex', 'Survival': 'wis'
};

function computeSkillModifiers(abilityScores, skillNames, level) {
  const profBonus = Math.floor(((level || 1) - 1) / 4) + 2;
  const modifiers = [];
  for (const skill of skillNames) {
    const ability = SKILL_ABILITY_MAP[skill];
    if (!ability) continue;
    const score = abilityScores[ability] || 10;
    const abilityMod = Math.floor((score - 10) / 2);
    const total = abilityMod + profBonus;
    modifiers.push(`${skill} ${total >= 0 ? '+' : ''}${total}`);
  }
  return modifiers;
}

function computePassivePerception(abilityScores, skillNames, level) {
  const profBonus = Math.floor(((level || 1) - 1) / 4) + 2;
  const wisMod = Math.floor(((abilityScores.wis || 10) - 10) / 2);
  const hasProficiency = skillNames.some(s => s.toLowerCase() === 'perception');
  return 10 + wisMod + (hasProficiency ? profBonus : 0);
}

/**
 * Format a companion's current mood for the system prompt
 */
function formatCompanionMood(companion) {
  const mood = companion.companion_mood || 'content';
  if (mood === 'content' || !mood) return null;

  const intensity = companion.companion_mood_intensity || 1;
  const cause = companion.companion_mood_cause;
  const guidance = MOOD_RP_GUIDANCE[mood];

  let line = `  CURRENT MOOD: ${mood.charAt(0).toUpperCase() + mood.slice(1)} (${intensity}/5)`;
  if (cause) line += ` — ${cause}`;
  if (guidance) line += `\n  → Roleplay as ${guidance}`;

  return line;
}

/**
 * Format active companions for the system prompt
 */
/**
 * Render a single companion's progression layer (theme + unlocked abilities +
 * ancestry feats) as indented lines for inclusion inside their formatCompanions
 * block. Returns '' when there's nothing to show, so the `.filter(Boolean)`
 * upstream drops it cleanly. Parity with formatProgression() for player
 * characters but slimmer — no Knight path, synergies, or mythic (which apply
 * to player characters only today).
 */
/**
 * Render a spellcasting companion's slot state as an indented line for the
 * DM prompt: "Spell slots: L1 2/4, L2 0/3" (used/max). Returns '' when the
 * companion has no slots (non-casters, npc-stats companions, or pre-rest).
 */
/**
 * Render a companion's persistent active conditions as an indented line:
 *   "Active conditions: Poisoned, Prone, Exhaustion 2"
 * Pulls from the `active_conditions` JSON column (Phase 7). Returns '' when
 * there's nothing to show. Distinct from the session-transient ConditionPanel
 * state, which the DM session also injects via formatConditionsForAI().
 */
export function formatCompanionActiveConditionsLine(activeConditions) {
  if (!activeConditions) return '';
  let arr = activeConditions;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch { return ''; }
  }
  if (!Array.isArray(arr) || arr.length === 0) return '';
  const display = arr.map(k =>
    String(k).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  );
  return `  Active conditions: ${display.join(', ')}`;
}

/**
 * Render a dying companion's death save tally as an indented line:
 *   "Death saves: 2 successes, 1 failure (at 0 HP — one more failure = dead)"
 * Only rendered when the companion is at 0 HP. Returns '' otherwise.
 */
export function formatCompanionDeathSavesLine(companion) {
  const hp = companion?.companion_current_hp;
  if (hp === undefined || hp === null || hp > 0) return '';
  const s = companion.death_save_successes || 0;
  const f = companion.death_save_failures || 0;
  const sLabel = s === 1 ? 'success' : 'successes';
  const fLabel = f === 1 ? 'failure' : 'failures';
  const edge = f >= 2
    ? ' — one more failure = dead'
    : s >= 2
      ? ' — one more success stabilizes'
      : '';
  return `  Death saves: ${s} ${sLabel}, ${f} ${fLabel} (at 0 HP${edge})`;
}

export function formatCompanionSpellSlotsLine(max, used) {
  if (!max || typeof max !== 'object') return '';
  const levels = Object.keys(max)
    .map(k => parseInt(k, 10))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 9)
    .sort((a, b) => a - b);
  if (levels.length === 0) return '';

  const parts = levels
    .map(lv => {
      const m = max[lv] || max[String(lv)] || 0;
      if (!m) return null;
      const u = (used && (used[lv] ?? used[String(lv)])) || 0;
      return `L${lv} ${u}/${m}`;
    })
    .filter(Boolean);
  if (parts.length === 0) return '';

  // Warlock-style shape: { slots: N, level: M } — handled separately by
  // callers; this helper only renders the standard `{ "1": N, "2": N }` map.
  return `  Spell slots: ${parts.join(', ')}`;
}

export function formatCompanionProgressionLines(progression) {
  if (!progression || !progression.theme) return '';

  const parts = [];
  parts.push(`  Theme: ${progression.theme.theme_name}${progression.theme.path_choice ? ` (${progression.theme.path_choice})` : ''}`);

  if (progression.theme_unlocks && progression.theme_unlocks.length > 0) {
    parts.push('  Unlocked theme abilities:');
    for (const u of progression.theme_unlocks) {
      if (!u.ability_name) continue;
      parts.push(`    - L${u.tier} ${u.ability_name}: ${u.ability_description}`);
      if (u.mechanics) parts.push(`      Mechanics: ${u.mechanics}`);
    }
  }

  if (progression.ancestry_feats && progression.ancestry_feats.length > 0) {
    parts.push('  Ancestry feats:');
    for (const f of progression.ancestry_feats) {
      parts.push(`    - L${f.tier} ${f.feat_name}: ${f.description}`);
      if (f.mechanics) parts.push(`      Mechanics: ${f.mechanics}`);
    }
  }

  return parts.join('\n');
}

function formatCompanions(companions, awayCompanions = []) {
  if ((!companions || companions.length === 0) && awayCompanions.length === 0) return '';

  const companionDescriptions = companions.map(companion => {
    const isClassBased = companion.progression_type === 'class_based';
    let statsLine = '';

    if (isClassBased) {
      const abilityScores = companion.companion_ability_scores
        ? JSON.parse(companion.companion_ability_scores)
        : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

      // Phase 10: render multiclass breakdown when class_levels has >1 entry
      let classLine;
      let classLevels = companion.companion_class_levels;
      if (typeof classLevels === 'string') {
        try { classLevels = JSON.parse(classLevels); } catch { classLevels = null; }
      }
      if (Array.isArray(classLevels) && classLevels.length > 1) {
        const parts = classLevels.map(cl =>
          `${cl.class} ${cl.level}${cl.subclass ? ` (${cl.subclass})` : ''}`
        );
        classLine = `  Classes: ${parts.join(' / ')} — total ${companion.companion_level}`;
      } else {
        classLine = `  Class: ${companion.companion_class} Level ${companion.companion_level}${companion.companion_subclass ? ` (${companion.companion_subclass})` : ''}`;
      }

      statsLine = `${classLine}
  HP: ${companion.companion_current_hp}/${companion.companion_max_hp}
  Abilities: STR ${abilityScores.str}, DEX ${abilityScores.dex}, CON ${abilityScores.con}, INT ${abilityScores.int}, WIS ${abilityScores.wis}, CHA ${abilityScores.cha}`;
    } else {
      const originalStats = companion.original_stats_snapshot
        ? JSON.parse(companion.original_stats_snapshot)
        : null;
      if (originalStats) {
        statsLine = `  Using NPC Stats: CR ${originalStats.cr || 'unknown'}, AC ${originalStats.ac || 10}, HP ${originalStats.hp || '?'}`;
      }
    }

    // Parse equipment for companion
    let equipmentLine = '';
    try {
      const equipment = typeof companion.equipment === 'string'
        ? JSON.parse(companion.equipment || '{}')
        : (companion.equipment || {});
      const equippedItems = [];
      if (equipment.mainHand?.name) {
        equippedItems.push(`${equipment.mainHand.name} (weapon)`);
      }
      if (equipment.offHand?.name) {
        equippedItems.push(`${equipment.offHand.name}`);
      }
      if (equipment.armor?.name) {
        equippedItems.push(`${equipment.armor.name} (armor)`);
      }
      if (equippedItems.length > 0) {
        equipmentLine = `  Equipment: ${equippedItems.join(', ')}`;
      }
    } catch (e) {
      // Ignore equipment parsing errors
    }

    // Parse skills and compute modifiers
    let skillsLine = '';
    let passivePerceptionLine = '';
    try {
      const npcSkills = companion.npc_skills
        ? (typeof companion.npc_skills === 'string' ? JSON.parse(companion.npc_skills) : companion.npc_skills)
        : [];
      const companionSkills = companion.skill_proficiencies
        ? (typeof companion.skill_proficiencies === 'string' ? JSON.parse(companion.skill_proficiencies) : companion.skill_proficiencies)
        : [];
      const allSkills = [...new Set([...npcSkills, ...companionSkills])];

      if (allSkills.length > 0 && isClassBased) {
        const abilityScores = companion.companion_ability_scores
          ? (typeof companion.companion_ability_scores === 'string' ? JSON.parse(companion.companion_ability_scores) : companion.companion_ability_scores)
          : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
        const modifiers = computeSkillModifiers(abilityScores, allSkills, companion.companion_level);
        if (modifiers.length > 0) {
          skillsLine = `  Skills: ${modifiers.join(', ')}`;
        }
        const passivePerception = computePassivePerception(abilityScores, allSkills, companion.companion_level);
        passivePerceptionLine = `  Passive Perception: ${passivePerception}`;
      } else if (allSkills.length > 0) {
        skillsLine = `  Skills: ${allSkills.join(', ')}`;
      }
    } catch (e) {
      // Ignore
    }

    // Determine pronouns for this companion
    const gender = companion.gender?.toLowerCase() || '';
    let pronouns = 'they/them';
    if (gender === 'male' || gender === 'm') pronouns = 'he/him';
    else if (gender === 'female' || gender === 'f') pronouns = 'she/her';

    // Determine languages
    const occupation = (companion.occupation || '').toLowerCase();
    const isEducated = occupation.includes('scholar') || occupation.includes('wizard') ||
                       occupation.includes('sage') || occupation.includes('noble') ||
                       occupation.includes('priest') || occupation.includes('cleric');
    const languagesNote = isEducated
      ? '  Languages: Common (may know additional scholarly languages)'
      : '  Languages: Common ONLY (cannot read or identify other scripts)';

    // Determine limitations based on background
    let limitationsLine = '';
    const limitationsList = [];
    if (!isEducated && !occupation.includes('healer') && !occupation.includes('medic') && !occupation.includes('doctor')) {
      limitationsList.push('no medical/healer training');
    }
    if (!isEducated) {
      limitationsList.push('cannot identify magical runes or ancient scripts');
    }
    if (occupation.includes('farm') || occupation.includes('peasant') || occupation.includes('laborer')) {
      limitationsList.push('limited worldly knowledge');
    }
    if (limitationsList.length > 0) {
      limitationsLine = `  LIMITATIONS (respect these): ${limitationsList.join(', ')}`;
    }

    const backgroundName = companion.companion_background || companion.background || companion.occupation;

    const parts = [
      `- ${companion.name}${companion.nickname ? ` "${companion.nickname}"` : ''} (Companion)`,
      `  Gender: ${companion.gender || 'unspecified'} - USE ${pronouns.toUpperCase()} PRONOUNS`,
      `  Race: ${companion.companion_subrace ? `${companion.companion_subrace} ` : ''}${companion.race}${companion.age ? `, Age: ${companion.age}` : ''}`,
      backgroundName ? `  Background: ${backgroundName}` : null,
      companion.alignment ? `  Alignment: ${companion.alignment}` : null,
      companion.faith ? `  Faith/Deity: ${companion.faith}` : null,
      statsLine,
      companion.armor_class ? `  AC: ${companion.armor_class}, Speed: ${companion.companion_speed || companion.speed || 30} ft.` : null,
      equipmentLine || null,
      skillsLine || null,
      passivePerceptionLine || null,
      languagesNote,
      limitationsLine || null,
      companion.personality_trait_1 ? `  Personality: ${companion.personality_trait_1}${companion.personality_trait_2 ? '. ' + companion.personality_trait_2 : ''}` : null,
      companion.ideals ? `  Ideals: ${companion.ideals}` : null,
      companion.bonds ? `  Bonds: ${companion.bonds}` : null,
      companion.flaws ? `  Flaws: ${companion.flaws}` : null,
      companion.voice ? `  Voice/Speech: ${companion.voice}` : null,
      companion.mannerism ? `  Mannerism: ${companion.mannerism}` : null,
      companion.motivation ? `  Motivation: ${companion.motivation}` : null,
      companion.relationship_to_party ? `  Relationship to Party: ${companion.relationship_to_party}` : null,
      companion.background_notes ? `  Backstory: ${companion.background_notes}` : null,
      companion.notes ? `  Player Notes: ${companion.notes}` : null,
      formatCompanionMood(companion),
      formatCompanionProgressionLines(companion.progression),
      formatCompanionSpellSlotsLine(companion.spell_slots_max, companion.spell_slots_used),
      formatCompanionActiveConditionsLine(companion.active_conditions),
      formatCompanionDeathSavesLine(companion)
    ].filter(Boolean);

    return parts.join('\n');
  });

  return `\n\nACTIVE COMPANIONS IN THE PARTY:
These NPCs have joined the player's adventuring party. They travel and fight alongside the player.

COMPANION CONTROL:
- YOU (the DM) roleplay companion dialogue, personality, and reactions
- The PLAYER controls companion combat actions and level-up choices
- Companions should have distinct voices and opinions based on their personalities
- Companions should feel like real party members, not silent followers
- CRITICAL: Respect each companion's LIMITATIONS - a farm boy cannot identify runes, a commoner doesn't know healing arts
- Companions ONLY wield the weapons listed in their Equipment - do not invent or change their gear

COMPANION PERSONALITY AND MORAL INDEPENDENCE - CRITICAL:
- Companions are NOT yes-men. They have their OWN moral compass, opinions, and emotional responses.
- CHECK EACH COMPANION'S ALIGNMENT, IDEALS, AND FLAWS. These should ACTIVELY shape how they react.
- A lawful good companion should object when the player steals, lies, or harms innocents.
- A chaotic neutral companion might act impulsively, take things without asking, or refuse to follow rules.
- A lawful neutral companion cares about order and contracts — not the player's feelings.
- Companions can and SHOULD disagree with the player's decisions when those decisions conflict with their values.
- Disagreement doesn't mean disloyalty — it means the companion is a real person with convictions.
- Companions should exhibit REAL EMOTIONS beyond cheerful helpfulness:
  * FEAR: A companion can be scared before entering a dungeon, reluctant to face overwhelming odds, or panicked after a near-death experience
  * DOUBT: A companion can question the plan, wonder if they're on the right side, or lose faith in the mission
  * AMBITION: A companion can want glory, credit, a bigger share of treasure, or to lead instead of follow
  * RESENTMENT: A companion can be bitter about being sidelined, ignored, or overruled
  * FRUSTRATION: A companion can snap at the player for reckless decisions or poor planning
  * MORAL CONFLICT: A companion can refuse an order that violates their principles — "I won't do that."
- Not every companion reaction should be supportive. Mix in reluctance, grumbling, side-eye, muttered objections.
- Companions with evil or neutral alignments may suggest morally questionable solutions: bribery, intimidation, theft, abandoning those in need, cutting losses.
- Companions with good alignments may insist on helping when the player wants to move on, or refuse to leave innocents behind.
- Let companion personalities CLASH with each other too — different companions may disagree about what to do next.

PARTY LOCATION TRACKING - CRITICAL:
- Track WHERE each companion is at all times during the session
- If a companion was sent somewhere, they are AT THAT LOCATION until they return
- If a companion was just with the player 15 minutes ago, they should NOT act surprised to see them
- When the party splits up, remember WHO went WHERE and for what purpose
- Companions who stayed together know what each other experienced
- A companion returning from an errand knows only what happened at THEIR location, not what the player did while apart
- When reuniting, companions should react appropriately to the TIME elapsed and WHAT they know

COMPANION SKILL CHECKS:
When you call for a skill check from the player, consider if present companions should also attempt it:
- Check each companion's skill modifiers listed below
- If a companion is proficient in the relevant skill AND is present, they attempt it too
- You decide the companion's result narratively (no need to state numbers)
- If the player FAILS but a companion SUCCEEDS, narrate the companion stepping in with personality-appropriate flavor
- If BOTH fail, narrate the shared failure
- If the player SUCCEEDS, the companion's attempt is usually unnecessary — skip it
- NOT every check involves companions — only when relevant and the companion is present
- Social checks (Persuasion, Deception, Intimidation) usually only involve the speaker
- Companions with high passive Perception may notice things the player misses

${companionDescriptions.join('\n\n')}${formatAwayCompanions(awayCompanions)}`;
}

/**
 * Format away companions section for the DM prompt.
 */
function formatAwayCompanions(awayCompanions) {
  if (!awayCompanions || awayCompanions.length === 0) return '';

  const lines = awayCompanions.map(c => {
    const elapsed = c.start_game_day ? `away ${c.expected_duration_days ? `~${c.expected_duration_days} days` : 'unknown duration'}` : '';
    const location = c.location ? ` at ${c.location}` : '';
    return `- ${c.name}: ${c.activity_type}${location} (${elapsed})`;
  });

  return `

COMPANIONS CURRENTLY AWAY:
These companions are NOT present. Do NOT include them in scenes or combat.
If the player asks about them, reference their activity.
${lines.join('\n')}`;
}

/**
 * Format custom concepts/themes for the system prompt
 */
function formatCustomConcepts(concepts) {
  if (!concepts || concepts.trim().length === 0) return '';

  return `\n\nPLAYER'S NARRATIVE VISION:
The player has shared what they want this campaign to explore:

"${concepts.trim()}"

HOW TO USE THIS:
- These are THEMES to embody, not items to check off a list
- Create situations that naturally evoke these themes - don't force or explicitly mention them
- Build NPCs who can become vehicles for these themes (potential allies, rivals, love interests, betrayers)
- Let relationships develop organically through shared experiences
- Plant seeds early that pay off later - a friendly NPC now might become family over sessions
- Create moments of vulnerability, trust, and choice where these themes can emerge
- The player will drive the connections - your job is to create opportunities
- Heartbreak and betrayal should feel EARNED, not arbitrary - build trust before testing it
- Found family forms through surviving challenges together, not through declaration`;
}

/**
 * Format pending downtime narratives for the system prompt
 */
function formatPendingNarratives(narratives) {
  if (!narratives || narratives.length === 0) return '';

  const narrativeDescriptions = narratives.map(event => {
    let description = `- ${event.activityName} (${event.duration}): ${event.result}`;

    if (event.details?.events && event.details.events.length > 0) {
      description += `\n  Notable: ${event.details.events.join(', ')}`;
    }

    return description;
  });

  return `\n\nRECENT DOWNTIME ACTIVITIES:
The character completed these activities since the last adventure. Acknowledge this naturally in your opening narrative - weave it into the scene without making it feel like a checklist. For example, if they trained, they might feel sharper; if they worked, they might have coins in their purse; if they rested well, they feel refreshed.

${narrativeDescriptions.join('\n')}

IMPORTANT: Reference this downtime ONCE at the start, then move on. Don't keep bringing it up.`;
}

/**
 * Format previous session summaries for campaign continuity.
 * Prefers richer chronicle summaries (300-500 words with mood/cliffhanger) when available.
 */
function formatPreviousSessionSummaries(summaries, isContinuing, chronicleSummaries = []) {
  // Use chronicle summaries if available (richer data), otherwise fall back to dm_sessions summaries
  const hasChronicles = chronicleSummaries && chronicleSummaries.length > 0;
  const hasSummaries = summaries && summaries.length > 0;

  if (!hasChronicles && !hasSummaries) return '';

  let summaryDescriptions;

  if (hasChronicles) {
    summaryDescriptions = chronicleSummaries.map(c => {
      const dayRange = c.game_day_start && c.game_day_end
        ? ` (Days ${c.game_day_start}-${c.game_day_end})`
        : c.game_day_start ? ` (Day ${c.game_day_start})` : '';
      const mood = c.mood ? `, Mood: ${c.mood}` : '';
      let text = `Session ${c.session_number}${dayRange}${mood}: ${c.summary || 'No summary available.'}`;
      if (c.cliffhanger) {
        text += `\n  Cliffhanger: ${c.cliffhanger}`;
      }
      // Include key decisions if available
      const decisions = typeof c.key_decisions === 'string' ? JSON.parse(c.key_decisions || '[]') : (c.key_decisions || []);
      if (decisions.length > 0) {
        const decisionLines = decisions.slice(0, 3).map(d => {
          const decision = d.decision || d;
          const consequence = d.consequence ? ` → ${d.consequence}` : '';
          return `  - ${decision}${consequence}`;
        });
        text += '\n  Key decisions:\n' + decisionLines.join('\n');
      }
      return text;
    });
  } else {
    summaryDescriptions = summaries.map((session, index) => {
      return `Session ${index + 1}: ${session.summary || 'No summary available.'}`;
    });
  }

  return `\n\nPREVIOUS ADVENTURES — FULL CAMPAIGN HISTORY:
This character has a rich history of previous adventures. ALL of these events are CANON — they happened and shape the ongoing story.
NPCs remember the character. Consequences of past actions persist. The story is deeply connected across sessions.

${summaryDescriptions.join('\n\n')}

USING THIS HISTORY:
- Reference past events naturally when they become relevant — NPCs may mention them, consequences may surface
- The player lived through these events — subtle callbacks are better than exposition dumps
- Don't recap everything at once, but DO remember it all. When an NPC from Session 2 appears in Session 8, they remember what happened
- Promises, deals, and unfinished business from ANY session remain active until resolved`;
}

/**
 * Format campaign notes for persistent memory across sessions
 */
function formatCampaignNotes(notes) {
  if (!notes || notes.trim().length === 0) return '';

  return `\n\n=== CAMPAIGN MEMORY (CRITICAL - READ CAREFULLY) ===
These are persistent details from the character's previous adventures. You MUST remember and reference these when relevant:

${notes}

=== END CAMPAIGN MEMORY ===

USING THIS MEMORY:
- Reference NPCs by name when they appear or are relevant
- Remember promises made and obligations owed
- Know who the character's allies and enemies are
- Recall items given to NPCs or received from them
- Build on established relationships
- Follow up on unresolved threads when appropriate
- These details are CANON - they actually happened`;
}

/**
 * Format character personality memories observed during gameplay
 */
function formatCharacterMemories(memories) {
  if (!memories || memories.trim().length === 0) return '';

  return `\n\n=== CHARACTER PERSONALITY (OBSERVED IN PLAY) ===
These personality details emerged from actual gameplay — things the character revealed through their own words and choices. They are CANON — this is who the character IS:

${memories}

USING THESE MEMORIES:
- Reference these personality traits when relevant situations arise naturally
- Have NPCs react to the character's known preferences and habits (e.g., offer tea instead of ale if they prefer tea)
- If the character expressed discomfort with something, that discomfort persists unless noted otherwise
- Some memories reflect current state (gear, preparedness, health) — reference them accurately
- Weave these details into the narrative naturally — don't lecture or remind the player of their own traits
- These evolve over time — trust what is written here as the character's CURRENT state
=== END CHARACTER PERSONALITY ===`;
}

/**
 * Format a single NPC entry with optional voice guide
 */
function formatNPCEntry(npc, includeVoice) {
  let entry = `- ${npc.name} (${npc.role}): ${npc.motivation || npc.description || ''} - typically found at ${npc.location || 'various locations'}`;
  if (includeVoice && npc.voice_guide) {
    const vg = npc.voice_guide;
    if (vg.speech) entry += `\n  Voice: ${vg.speech}`;
    if (vg.surface) entry += `\n  Surface: ${vg.surface}`;
  }
  if (npc.secrets && npc.secrets.length > 0) {
    entry += `\n  DM-ONLY secrets: ${npc.secrets.slice(0, 3).join('; ')}`;
  }
  return entry;
}

/**
 * Format campaign plan for DM context
 */
/**
 * Per-theme narration hooks that the AI DM should weave into gameplay when the
 * character has the corresponding theme. Keyed by theme_id. Each entry is a
 * short directive — not content to render literally, but guidance for how the
 * theme should shape narration.
 */
const NARRATION_HOOKS_BY_THEME = {
  soldier: 'The character is a military veteran. NPCs who were soldiers recognize their bearing. Use tactical language when describing combat. Military authority figures respond to them as a peer.',
  sage: 'The character is a scholar. When lore-appropriate, acknowledge their expertise with subtle detail — they would recognize references others would miss. Knowledge-based NPCs treat them as a colleague.',
  criminal: 'The character has underworld connections. Criminal-aligned NPCs sense their status. When in dangerous districts, the character moves with familiarity that strangers do not. Subtle underworld signals (gestures, code words) are visible to them.',
  acolyte: 'The character is temple-trained. NPCs who share their faith treat them with reverence. Temples are safe ground. Invoke their faith when narrating moments of prayer, grief, or moral clarity.',
  charlatan: 'The character is a con artist by trade. They notice marks instinctively. NPCs trying to deceive them face a skeptical eye. Surface opportunities for them to slip into false identities when the situation calls for it.',
  entertainer: 'The character is a performer. Crowds notice them. When they speak in public, eyes turn. Taverns warm to them. Lean into spectacle — describe the effect their presence has on a room.',
  noble: 'The character is nobility. Commoners defer automatically. Other nobles treat them as a peer. Court etiquette matters. They have political awareness commoners lack — surface subtle political signals in social scenes.',
  outlander: 'The character is wilderness-raised. In their chosen biome they move with confidence others lack. They read wind, tracks, and sky instinctively. Natural environments feel like home; cities feel foreign.',
  sailor: 'The character has lived at sea. Salty language, knowledge of tides and ships, and an ease with sailors come naturally. Ports feel like home. Land-locked cities feel confining.',
  far_traveler: 'The character is foreign. Their accent and mannerisms mark them. Locals are curious. They notice what insiders miss — surface details about local culture that a Far Traveler would spot and comment on.',
  haunted_one: 'The character has faced true horror. Common folk sense it and are simultaneously drawn to them and uneasy. Supernatural creatures recognize the mark. When dark things happen, the Haunted One sees them clearly — describe the chill in the air that others dismiss.',
  guild_artisan: 'The character is a guild-trained craftsperson. They appraise goods by instinct. Merchants treat them with professional respect. Use maker\'s marks, material quality, and craft gossip when they interact with traders.',
  clan_crafter: 'The character is ancestrally trained in craft. Materials and old techniques speak to them. Dwarven kin especially offer hospitality. Describe artisanal details through their trained eye.',
  hermit: 'The character spent years in isolation and carries a discovery. Surface moments of inner stillness. They are composed when others panic. The revelation from their hermitage should occasionally echo in their thoughts during relevant scenes.',
  investigator: 'The character reads scenes the way others read books. Describe crime scenes and mysteries with the detail they would notice. Let them ask DC-appropriate questions of witnesses. Others defer to their analysis.',
  city_watch: 'The character walked the beat. In their home city (or cities of the same banner), they know every alley and face. Local guards recognize them. Describe urban environments with their familiar eye.',
  knight_of_the_order: 'The character is sworn to an order. Their oath shapes their choices. Order members recognize them on sight. Their moral path (True/Reformer/Martyr/Complicit/Fallen/Redemption — tracked in knight_moral_paths) shapes their interactions — reinforce the tension or honor accordingly. Code violations should have consequences.',
  mercenary_veteran: 'The character is a battle-hardened sellsword. Loyalty is earned, not given. They appraise fights by profit and survival. Fellow mercenaries recognize the look. Be pragmatic in their internal frame.',
  urban_bounty_hunter: 'The character hunts people for a living. They notice marks in crowds. Criminal-aligned NPCs hesitate around them. In cities, they know how to ask without asking. Surface pursuit instinct when relevant.',
  folk_hero: 'The character is a legend among common folk. In their home region, commoners greet them warmly. Their deeds precede them. Tyrants notice them too — lean into the double edge of popular recognition.',
  urchin: 'The character survived the streets. They notice escape routes instinctively. Street children recognize one of their own (and may defer to them if the character has treated their kind well). Describe urban environments with the gaps others miss.'
};

/**
 * Format progression data (theme, abilities, ancestry feats, synergies, moral
 * path, mythic amplification) into a prompt section. Returns an empty string
 * when progression is null or the character has no theme selected.
 *
 * This is the DM-facing view of progression: concise, mechanical, with
 * narration hooks. Unlike the Character Sheet which shows the full 4-tier
 * preview, this prompt only highlights UNLOCKED abilities (the AI DM
 * shouldn't narrate abilities the character can't yet use).
 */
export function formatProgression(progression) {
  if (!progression || !progression.theme) return '';

  const parts = [];
  parts.push('\n\nCHARACTER PROGRESSION LAYER:');
  parts.push(`THEME: ${progression.theme.theme_name}${progression.theme.path_choice ? ` (${progression.theme.path_choice})` : ''}`);
  if (progression.theme.identity) {
    parts.push(`Identity: ${progression.theme.identity}`);
  }
  if (progression.theme.signature_skill_1) {
    const sigSkills = [progression.theme.signature_skill_1, progression.theme.signature_skill_2]
      .filter(Boolean)
      .join(', ');
    parts.push(`Signature skills: ${sigSkills}`);
  }

  // Unlocked theme abilities
  if (progression.theme_unlocks && progression.theme_unlocks.length > 0) {
    parts.push('\nUNLOCKED THEME ABILITIES (available for use in narration):');
    for (const u of progression.theme_unlocks) {
      parts.push(`- L${u.tier} ${u.ability_name}: ${u.ability_description}`);
      if (u.mechanics) {
        parts.push(`  Mechanics: ${u.mechanics}`);
      }
    }
  }

  // Ancestry feats
  if (progression.ancestry_feats && progression.ancestry_feats.length > 0) {
    parts.push('\nANCESTRY FEATS:');
    for (const f of progression.ancestry_feats) {
      parts.push(`- L${f.tier} ${f.feat_name}: ${f.description}`);
      if (f.mechanics) {
        parts.push(`  Mechanics: ${f.mechanics}`);
      }
    }
  }

  // Knight moral path (narrative-critical for Knight-themed characters)
  if (progression.knight_moral_path) {
    parts.push(`\nKNIGHT MORAL PATH: ${progression.knight_moral_path.current_path.toUpperCase()}`);
    const pathGuidance = {
      true: 'Character is currently walking the True Path — their oath is intact. Reinforce institutional trust and camaraderie with their order.',
      reformer: 'Character has seen their order falter and is trying to reform it from within. Surface moral tension between personal conviction and institutional authority. Some order members support them; others see them as a threat.',
      martyr: 'Character refused a corrupt order and paid a price. They are disowned but morally clear. Other knights may quietly admire or publicly denounce them.',
      complicit: 'Character obeyed an unjust order out of fear or duty. They carry the weight. Surface dreams, flinches, quiet hollowness — the dissonance between who they thought they were and what they did.',
      fallen: 'Character has broken their oath. Former order members treat them as a traitor. They have lost some abilities and may be hunted. Lean into shame, bravado, or denial as fits their current framing.',
      redemption: 'Character is actively atoning for past failures. Track their progress toward restoration — small acts of contrition matter. Former allies slowly warm; former enemies watch for backsliding.'
    };
    const guidance = pathGuidance[progression.knight_moral_path.current_path];
    if (guidance) parts.push(guidance);
  }

  // Subclass × Theme resonant synergy
  if (progression.subclass_theme_synergy) {
    parts.push(`\nRESONANT SUBCLASS×THEME SYNERGY: ${progression.subclass_theme_synergy.synergy_name}`);
    parts.push(progression.subclass_theme_synergy.description);
    if (progression.subclass_theme_synergy.mechanics) {
      parts.push(`Mechanics: ${progression.subclass_theme_synergy.mechanics}`);
    }
  }

  // Mythic × Theme amplification or dissonant arc
  if (progression.mythic_theme_amplification) {
    const m = progression.mythic_theme_amplification;
    parts.push(`\nMYTHIC ${m.is_dissonant ? 'DISSONANT ARC' : 'AMPLIFICATION'}: ${m.combo_name}`);
    if (m.shared_identity) parts.push(m.shared_identity);
    if (m.is_dissonant) {
      parts.push(`Arc: ${m.dissonant_arc_description || '(no description)'}`);
      if (m.required_threshold_acts) {
        parts.push(`Threshold acts required for resolution: ${m.required_threshold_acts}`);
      }
    } else {
      // Emit the tier bonuses the character currently qualifies for based on their level.
      // Mythic tiers: T1=L5, T2=L10, T3=L15, T4=L20 per CLAUDE.md
      const level = progression.character?.level || 1;
      const tiers = [
        { t: 1, min: 5, text: m.t1_bonus },
        { t: 2, min: 10, text: m.t2_bonus },
        { t: 3, min: 15, text: m.t3_bonus },
        { t: 4, min: 20, text: m.t4_bonus }
      ].filter(x => x.text);
      const qualified = tiers.filter(x => level >= x.min);
      if (qualified.length > 0) {
        parts.push('Active tier bonuses:');
        qualified.forEach(x => parts.push(`- T${x.t}: ${x.text}`));
      }
    }
  }

  // Narration hooks tied to the theme
  const hook = NARRATION_HOOKS_BY_THEME[progression.theme.theme_id];
  if (hook) {
    parts.push(`\nNARRATION HOOK: ${hook}`);
  }

  parts.push('\nIntegrate the progression layer naturally — let the character FEEL their theme through NPC responses, environmental description, and scene framing. Do NOT narrate the character using abilities they have not unlocked. Do NOT force theme references in every scene — weave them where they fit.');

  return parts.join('\n');
}

function formatCampaignPlan(planSummary) {
  if (!planSummary) return '';

  const isImported = !!planSummary.campaign_metadata || !!planSummary.dm_directives;
  const hasDetailedNpcs = planSummary.detailed_npcs && planSummary.detailed_npcs.length > 0;
  let sections = [];

  // === PRIMACY: Campaign context and DM directives first ===

  // Campaign metadata (imported campaigns — year, season, status)
  if (planSummary.campaign_metadata) {
    const meta = planSummary.campaign_metadata;
    let metaLines = [];
    if (meta.year) metaLines.push(`Campaign Year: ${meta.year}`);
    if (meta.season) metaLines.push(`Season: ${meta.season}`);
    if (meta.setting) metaLines.push(`Setting: ${meta.setting}`);
    if (meta.tone) metaLines.push(`Tone: ${meta.tone}`);
    if (meta.status) metaLines.push(`Current Status: ${meta.status}`);
    if (meta.expedition_party) metaLines.push(`Active Party: ${Array.isArray(meta.expedition_party) ? meta.expedition_party.join(', ') : meta.expedition_party}`);
    // Pass through any other metadata fields
    const knownKeys = ['_schema_extension', 'campaign_name', 'system', 'year', 'season', 'setting', 'tone', 'status', 'expedition_party'];
    for (const [key, value] of Object.entries(meta)) {
      if (!knownKeys.includes(key) && value) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        metaLines.push(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
      }
    }
    if (metaLines.length > 0) {
      sections.push(`CAMPAIGN CONTEXT:\n${metaLines.join('\n')}`);
    }

    // Timeline enforcement from campaign metadata year
    if (meta.year) {
      const yearStr = String(meta.year);
      const yearMatch = yearStr.match(/(\d{3,4})/);
      if (yearMatch) {
        const campaignYear = parseInt(yearMatch[1]);
        sections.push(`=== TIMELINE ENFORCEMENT ===
The campaign year is ${campaignYear} DR. This is NOT negotiable.
FORBIDDEN: Events after ${campaignYear} DR, documents dated after ${campaignYear} DR, anachronistic references.
When inventing historical references, use dates 50-200 years BEFORE ${campaignYear} DR.
=== END TIMELINE ENFORCEMENT ===`);
      }
    }
  }

  // DM directives (imported campaigns — critical behavioral rules)
  if (planSummary.dm_directives) {
    const dir = planSummary.dm_directives;
    let dirLines = [];
    if (dir.never_reveal && dir.never_reveal.length > 0) {
      dirLines.push(`NEVER REVEAL TO THE PLAYER:\n${dir.never_reveal.map(r => `- ${r}`).join('\n')}`);
    }
    if (dir.always_follow && dir.always_follow.length > 0) {
      dirLines.push(`ALWAYS FOLLOW:\n${dir.always_follow.map(r => `- ${r}`).join('\n')}`);
    }
    if (dir.narrative_principles && dir.narrative_principles.length > 0) {
      dirLines.push(`NARRATIVE PRINCIPLES:\n${dir.narrative_principles.map(r => `- ${r}`).join('\n')}`);
    }
    // Pass through any other directive arrays
    const knownKeys = ['_schema_extension', 'never_reveal', 'always_follow', 'narrative_principles'];
    for (const [key, value] of Object.entries(dir)) {
      if (!knownKeys.includes(key) && Array.isArray(value) && value.length > 0) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        dirLines.push(`${label.toUpperCase()}:\n${value.map(r => `- ${r}`).join('\n')}`);
      }
    }
    if (dirLines.length > 0) {
      sections.push(`=== DM DIRECTIVES (FOLLOW STRICTLY) ===\n${dirLines.join('\n\n')}\n=== END DM DIRECTIVES ===`);
    }
  }

  // === CORE PLAN: Main quest, acts, world state ===

  if (planSummary.main_quest_title) {
    let questSection = `MAIN QUEST: ${planSummary.main_quest_title}\n${planSummary.main_quest_summary || ''}`;
    if (planSummary.main_quest_hook) {
      questSection += `\nHOW IT BEGINS: ${planSummary.main_quest_hook}`;
    }
    if (planSummary.main_quest_stakes) {
      questSection += `\nSTAKES: ${planSummary.main_quest_stakes}`;
    }
    sections.push(questSection);
  }

  if (planSummary.current_act) {
    const act = planSummary.current_act;
    sections.push(`CURRENT ACT (Act ${act.act_number || 1}): ${act.title || 'The Beginning'}
${act.summary || act.description || ''}
Use this act to guide the current story arc.${!isImported ? ' IMPORTANT: The opening scene must take place at the character\'s STARTING LOCATION (see WORLD SETTING above) — build toward this act\'s events from there, do not skip ahead.' : ''}`);
  }

  if (planSummary.world_state) {
    const ws = planSummary.world_state;
    sections.push(`WORLD STATE:
${ws.political_situation || ''}
Major Threats: ${(ws.major_threats || []).join(', ')}`);
  }

  // === NPCs: Use detailed NPCs with voice guides when available ===

  if (hasDetailedNpcs) {
    const backstoryNpcs = planSummary.detailed_npcs.filter(n => n.from_backstory);
    const otherNpcs = planSummary.detailed_npcs.filter(n => !n.from_backstory);

    if (backstoryNpcs.length > 0) {
      sections.push(`KEY NPCs FROM BACKSTORY (USE THESE - DO NOT INVENT REPLACEMENTS):
${backstoryNpcs.map(npc => formatNPCEntry(npc, true)).join('\n')}`);
    }
    if (otherNpcs.length > 0) {
      sections.push(`OTHER KEY NPCs IN THIS WORLD:
${otherNpcs.map(npc => formatNPCEntry(npc, true)).join('\n')}`);
    }
  } else {
    // Fallback to simple NPC lists (non-imported plans)
    if (planSummary.active_npcs && planSummary.active_npcs.length > 0) {
      sections.push(`KEY NPCs FROM BACKSTORY (USE THESE - DO NOT INVENT REPLACEMENTS):
${planSummary.active_npcs.map(npc => `- ${npc.name} (${npc.role}): ${npc.motivation} - typically found at ${npc.location || 'various locations'}`).join('\n')}`);
    }
    if (planSummary.all_npcs && planSummary.all_npcs.length > 0) {
      sections.push(`OTHER KEY NPCs IN THIS WORLD:
${planSummary.all_npcs.map(npc => `- ${npc.name} (${npc.role}) - ${npc.location || 'various locations'}`).join('\n')}`);
    }
  }

  // === NPC relationship system (imported campaigns) ===

  if (planSummary.npc_relationship_system) {
    const rs = planSummary.npc_relationship_system;
    let rsLines = [];
    // Render levels if defined
    if (rs.levels && Array.isArray(rs.levels)) {
      rsLines.push('RELATIONSHIP LEVELS:');
      for (const level of rs.levels) {
        rsLines.push(`- Level ${level.level || level.name}: ${level.label || ''} — ${level.description || ''}`);
      }
    }
    // Render any other string/array fields
    const knownKeys = ['_schema_extension', 'levels'];
    for (const [key, value] of Object.entries(rs)) {
      if (!knownKeys.includes(key)) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (typeof value === 'string') {
          rsLines.push(`${label}: ${value}`);
        } else if (Array.isArray(value)) {
          rsLines.push(`${label}:\n${value.map(v => `- ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')}`);
        }
      }
    }
    if (rsLines.length > 0) {
      sections.push(`NPC RELATIONSHIP SYSTEM:\n${rsLines.join('\n')}`);
    }
  }

  // === Standard sections ===

  if (planSummary.upcoming_events && planSummary.upcoming_events.length > 0) {
    sections.push(`UPCOMING WORLD EVENTS (these will happen regardless of player action):
${planSummary.upcoming_events.map(e => `- ${e.title} (${e.timing}) - ${e.visibility === 'secret' ? 'SECRET' : e.visibility === 'rumored' ? 'RUMORED' : 'PUBLIC KNOWLEDGE'}`).join('\n')}`);
  }

  if (planSummary.merchants && planSummary.merchants.length > 0) {
    sections.push(`MERCHANTS IN THIS WORLD (player can shop at these - use their EXACT names):
${planSummary.merchants.map(m => `- ${m.name} (${m.type}) at ${m.location}${m.personality ? ' - ' + m.personality : ''}`).join('\n')}`);
  }

  if (planSummary.side_quests && planSummary.side_quests.length > 0) {
    sections.push(`AVAILABLE SIDE QUESTS (introduce naturally when appropriate):
${planSummary.side_quests.map(q => `- ${q.title}: ${q.description}`).join('\n')}`);
  }

  if (planSummary.themes && planSummary.themes.length > 0) {
    sections.push(`CAMPAIGN THEMES TO EXPLORE: ${planSummary.themes.join(', ')}`);
  }

  if (planSummary.dm_notes?.tone) {
    sections.push(`TONE GUIDANCE: ${planSummary.dm_notes.tone}`);
  }

  if (planSummary.dm_notes?.twists && planSummary.dm_notes.twists.length > 0) {
    sections.push(`POTENTIAL TWISTS TO CONSIDER: ${planSummary.dm_notes.twists.join('; ')}`);
  }

  if (planSummary.dm_notes?.backup_hooks && planSummary.dm_notes.backup_hooks.length > 0) {
    sections.push(`BACKUP HOOKS (if player goes off-track): ${planSummary.dm_notes.backup_hooks.join('; ')}`);
  }

  // === RECENCY: Session continuity last (immediate context for the DM) ===

  if (planSummary.session_continuity) {
    const sc = planSummary.session_continuity;
    let scLines = [];
    // Render known fields
    if (sc.current_state) scLines.push(`Current State: ${typeof sc.current_state === 'string' ? sc.current_state : JSON.stringify(sc.current_state)}`);
    if (sc.recent_events && Array.isArray(sc.recent_events)) {
      scLines.push(`Recent Events:\n${sc.recent_events.map(e => `- ${typeof e === 'string' ? e : e.description || JSON.stringify(e)}`).join('\n')}`);
    }
    if (sc.immediate_context) scLines.push(`Immediate Context: ${typeof sc.immediate_context === 'string' ? sc.immediate_context : JSON.stringify(sc.immediate_context)}`);
    if (sc.unresolved_threads && Array.isArray(sc.unresolved_threads)) {
      scLines.push(`Unresolved Threads:\n${sc.unresolved_threads.map(t => `- ${typeof t === 'string' ? t : t.description || JSON.stringify(t)}`).join('\n')}`);
    }
    // Pass through any other fields
    const knownKeys = ['_schema_extension', 'current_state', 'recent_events', 'immediate_context', 'unresolved_threads'];
    for (const [key, value] of Object.entries(sc)) {
      if (!knownKeys.includes(key) && value) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (typeof value === 'string') {
          scLines.push(`${label}: ${value}`);
        } else if (Array.isArray(value)) {
          scLines.push(`${label}:\n${value.map(v => `- ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')}`);
        }
      }
    }
    if (scLines.length > 0) {
      sections.push(`CURRENT CAMPAIGN STATE (pick up from here):\n${scLines.join('\n')}`);
    }
  }

  if (sections.length === 0) return '';

  const header = isImported
    ? `=== IMPORTED CAMPAIGN PLAN ===
This campaign was imported with a detailed plan. You MUST use this as your guide for the story.
DO NOT invent your own BBEG, story arc, or quest - the plan below defines all of these.
Pay special attention to DM DIRECTIVES — they are binding rules for this campaign.`
    : `=== CAMPAIGN PLAN (Generated by Claude Opus) ===
This campaign has a pre-generated plan. You MUST use this as your guide for the story.
DO NOT invent your own BBEG, story arc, or quest - the plan below defines all of these.`;

  return `\n\n${header}

${sections.join('\n\n')}

CRITICAL RULES FOR USING THIS PLAN:
1. The MAIN QUEST above IS the campaign's story - do NOT create a different one
2. The NPCs listed above are established characters - USE THEM, do not invent generic replacements
3. The CURRENT ACT describes where the story is right now - ground your scenes in it
4. World events will unfold according to the timeline - the world is ALIVE
5. Weave the main quest naturally into the narrative - don't force it, but don't ignore it either
6. This plan is your guide, not a script - adapt to player choices while maintaining the plan's narrative${isImported ? '\n7. NPC voice guides define HOW each character speaks - use them for authentic dialogue\n8. DM-ONLY secrets must NEVER be revealed to the player unless they earn the knowledge through gameplay\n9. Respect the NPC relationship system - depth of information shared depends on relationship level' : ''}
=== END CAMPAIGN PLAN ===`;
}

/**
 * Map faction standing label to NPC behavior hint
 */
function getStandingBehavior(label) {
  const behaviors = {
    exalted: 'Go out of their way to help, offer resources freely',
    revered: 'Very helpful, share sensitive information',
    honored: 'Cooperative, willing to assist',
    friendly: 'Helpful but with limits',
    neutral: 'Indifferent',
    unfriendly: 'Wary, may overcharge or withhold info',
    hostile: 'Actively obstructive, may report you to leadership',
    hated: 'Will work against you, may set traps or ambushes',
    enemy: 'Hostile on sight, will attack or attempt capture'
  };
  return behaviors[label] || 'Indifferent';
}

/**
 * Map numeric trust level to readable label
 */
function getTrustLabel(trust) {
  if (trust >= 76) return 'Absolute';
  if (trust >= 51) return 'High';
  if (trust >= 26) return 'Moderate';
  if (trust >= 1) return 'Low';
  return 'None';
}

/**
 * Generate a 1-line RP voice hint for an NPC.
 * Enriched NPCs get personality-derived hints; others get occupation-based defaults.
 */
function generateNpcVoiceHint(r) {
  // Enriched NPCs — distill voice + personality into an actionable RP instruction
  if (r.npc_enrichment_level >= 1) {
    const parts = [];
    if (r.npc_voice) parts.push(r.npc_voice);
    if (r.npc_personality) parts.push(r.npc_personality);
    if (r.npc_mannerism) parts.push(r.npc_mannerism);
    if (parts.length > 0) {
      return `  -> RP: ${parts.join('; ').substring(0, 120)}`;
    }
  }

  // Non-enriched NPCs — derive from occupation
  const occupationVoiceMap = {
    merchant: 'transactional, names prices, values repeat customers',
    shopkeeper: 'transactional, names prices, values repeat customers',
    trader: 'transactional, names prices, values repeat customers',
    guard: 'clipped and authoritative, suspicious of strangers',
    soldier: 'clipped and authoritative, follows chain of command',
    noble: 'formal diction, expects deference, speaks in measured tones',
    innkeeper: 'warm and chatty, knows local gossip, hospitable',
    bartender: 'warm and chatty, knows local gossip, hospitable',
    priest: 'serene and measured, speaks in blessings, offers counsel',
    cleric: 'serene and measured, speaks in blessings, offers counsel',
    blacksmith: 'gruff, few words, respects action over talk',
    farmer: 'plain-spoken, weather-focused, community-minded',
    thief: 'evasive, speaks in implications, never commits to facts',
    rogue: 'evasive, speaks in implications, never commits to facts',
    scholar: 'precise vocabulary, corrects others, loves tangents',
    wizard: 'precise vocabulary, speaks cryptically, tests intelligence',
    sage: 'precise vocabulary, speaks cryptically, tests intelligence',
    beggar: 'desperate, obsequious, shrewd underneath',
    bard: 'theatrical, embellishes everything, quotes poems',
    ranger: 'terse, observant, speaks of nature and trails',
    hunter: 'terse, observant, speaks of nature and trails'
  };

  const occ = (r.npc_occupation || '').toLowerCase();
  for (const [key, hint] of Object.entries(occupationVoiceMap)) {
    if (occ.includes(key)) {
      return `  -> Voice hint: ${hint}`;
    }
  }

  // Final fallback — derive from disposition
  const dispLabel = (r.disposition_label || 'neutral').toLowerCase();
  const dispositionVoiceMap = {
    hostile: 'aggressive, may refuse to engage',
    unfriendly: 'curt, gives minimal answers',
    neutral: 'polite but reserved',
    friendly: 'open, willing to chat',
    allied: 'warm, volunteers information',
    devoted: 'eager to help, deeply loyal'
  };
  const dispHint = dispositionVoiceMap[dispLabel];
  if (dispHint) return `  -> Voice hint: ${dispHint}`;

  return '';
}

/**
 * Format compressed world state snapshot for DM context
 * Includes: faction standings, active world events, NPC relationships,
 * known faction goals, and discovered locations.
 */
function formatWorldStateSnapshot(worldState) {
  if (!worldState) return '';

  const sections = [];

  // 1. Faction Standings (skip neutrals unless member)
  const meaningfulStandings = (worldState.factionStandings || [])
    .filter(s => s.standing !== 0 || s.is_member);
  if (meaningfulStandings.length > 0) {
    const lines = meaningfulStandings.slice(0, 6).map(s => {
      const label = (s.standing_label || 'neutral').toUpperCase();
      const memberNote = s.is_member ? ', Member' : '';
      const behavior = getStandingBehavior(s.standing_label || 'neutral');
      return `- ${s.faction_name}: ${label} (${s.standing > 0 ? '+' : ''}${s.standing})${memberNote} - ${behavior}`;
    });
    sections.push('FACTION STANDINGS:\n' + lines.join('\n'));
  }

  // 2. Active World Events (with stage info)
  const events = worldState.visibleEvents || [];
  if (events.length > 0) {
    const lines = events.slice(0, 5).map(e => {
      const totalStages = e.stages?.length || 0;
      const stageNum = (e.current_stage || 0) + 1;
      const stageInfo = totalStages > 0 ? ` - Stage ${stageNum}/${totalStages}` : '';
      const stageDesc = e.stage_descriptions?.[e.current_stage];
      const descSuffix = stageDesc ? ': ' + stageDesc.substring(0, 80) : '';
      return `- "${e.title}" (${e.event_type}, ${e.scope})${stageInfo}${descSuffix}`;
    });
    sections.push('WORLD EVENTS IN PROGRESS:\n' + lines.join('\n'));
  }

  // 3. NPC Voicing Guide + Relationships
  sections.push(`NPC VOICING GUIDE:
When roleplaying NPCs, differentiate them through speech patterns:
- USE their RP/Voice hint to shape dialogue (accent, vocabulary, tempo)
- Disposition CHANGES how they interact: hostile NPCs withhold info, allied NPCs volunteer it
- Trust level determines what NPCs reveal: Low = surface conversation; High = secrets and favors
- Each NPC's occupation defines their expertise and what they talk about naturally
- NPCs with conversation history remember what was discussed — reference past topics`);

  const allNpcs = (worldState.npcRelationships || []).filter(r => {
    const hasPendingPromises = r.promises_made?.some(p => p.status === 'pending');
    const hasOutstandingDebts = r.debts_owed?.some(d => d.status === 'outstanding');
    const hasSecrets = r.discovered_secrets?.length > 0;
    const hasConversations = worldState.npcConversations?.[r.npc_id]?.length > 0;
    const hasInteracted = r.times_met > 0;
    return r.disposition !== 0 || hasPendingPromises || hasOutstandingDebts || hasSecrets || hasConversations || hasInteracted;
  });

  // Separate alive vs deceased NPCs
  const aliveNpcs = allNpcs.filter(r => (r.npc_lifecycle_status || 'alive') !== 'deceased');
  const deceasedNpcs = allNpcs.filter(r => r.npc_lifecycle_status === 'deceased');

  // Build NPC event effects lookup for inline annotations
  const npcEffectsMap = {};
  for (const effect of (worldState.npcEventEffects || [])) {
    if (!npcEffectsMap[effect.npc_id]) npcEffectsMap[effect.npc_id] = [];
    npcEffectsMap[effect.npc_id].push(effect);
  }

  if (aliveNpcs.length > 0) {
    const lines = aliveNpcs.slice(0, 25).map(r => {
      const occupation = r.npc_occupation ? ` (${r.npc_occupation})` : '';
      const location = r.npc_location ? ` at ${r.npc_location}` : '';
      const parts = [`- ${r.npc_name}${occupation}${location}: ${(r.disposition_label || 'neutral').toUpperCase()}, Trust: ${getTrustLabel(r.trust_level || 0)}`];

      // Voice/RP hint (enriched NPCs get personality-derived, others get occupation-based)
      const voiceHint = generateNpcVoiceHint(r);
      if (voiceHint) parts.push(voiceHint);

      // Motivation (kept separate — drives NPC goals, not voice)
      if (r.npc_enrichment_level >= 1 && r.npc_motivation) {
        parts.push(`  Motivation: ${r.npc_motivation}`);
      }

      // Pending promises with urgency annotations
      const pendingPromises = (r.promises_made || []).filter(p => p.status === 'pending');
      pendingPromises.slice(0, 5).forEach(p => {
        const text = typeof p === 'string' ? p : (p.promise || p.text || '');
        if (text) {
          let urgency = '';
          if (worldState.currentGameDay && p.game_day_made) {
            const daysSince = worldState.currentGameDay - p.game_day_made;
            if (p.deadline_game_day && worldState.currentGameDay > p.deadline_game_day) {
              urgency = ' [OVERDUE — DEADLINE PASSED]';
            } else if (p.deadline_game_day) {
              const daysLeft = p.deadline_game_day - worldState.currentGameDay;
              if (daysLeft <= 7) urgency = ` [URGENT — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left]`;
            } else if (daysSince >= 21) {
              urgency = ` [OVERDUE — ${daysSince} days]`;
            }
          }
          const weightLabel = p.weight ? ` [${p.weight.toUpperCase()}]` : '';
          parts.push(`  Promise${weightLabel}: ${text.substring(0, 100)}${urgency}`);
        }
      });

      // Outstanding debts only
      const outstandingDebts = (r.debts_owed || []).filter(d => d.status === 'outstanding');
      outstandingDebts.slice(0, 5).forEach(d => {
        const direction = d.direction === 'player_owes_npc' ? 'You owe them' : 'They owe you';
        const desc = typeof d === 'string' ? d : (d.description || d.type || '');
        if (desc) parts.push(`  Debt: ${direction} - ${desc.substring(0, 80)}`);
      });

      // Discovered secrets (max 1)
      (r.discovered_secrets || []).slice(0, 1).forEach(s => {
        const text = typeof s === 'string' ? s : (s.secret || s.text || '');
        if (text) parts.push(`  Secret known: ${text.substring(0, 100)}`);
      });

      // Conversation history (up to 4 conversations with this NPC)
      const npcConvs = worldState.npcConversations?.[r.npc_id];
      if (npcConvs && npcConvs.length > 0) {
        npcConvs.slice(0, 4).forEach((conv, i) => {
          const label = conv.session_number ? `Session ${conv.session_number}` : (i === 0 ? 'recent' : 'earlier');
          const toneNote = conv.tone ? ` Tone: ${conv.tone}.` : '';
          const topicsNote = conv.topics?.length > 0 ? ` Topics: ${conv.topics.join(', ')}.` : '';
          const maxLen = i === 0 ? 400 : 250;
          parts.push(`  Conversation (${label}): ${conv.summary.substring(0, maxLen)}${toneNote}${topicsNote}`);
        });
      }

      // Inline world event effect annotations
      const npcEffects = npcEffectsMap[r.npc_id];
      if (npcEffects && npcEffects.length > 0) {
        for (const eff of npcEffects.slice(0, 2)) {
          const params = typeof eff.parameters === 'string' ? JSON.parse(eff.parameters) : eff.parameters;
          const shortDesc = eff.effect_type === 'disposition_shift' ? `attitude shifted ${params.shift > 0 ? '+' : ''}${params.shift}`
            : eff.effect_type === 'location_change' ? `relocated to ${params.new_location}`
            : eff.effect_type === 'status_change' ? `now ${params.new_status}`
            : eff.effect_type === 'occupation_change' ? `now ${params.new_occupation}`
            : eff.description;
          parts.push(`  [EVENT: "${eff.event_title}" → ${shortDesc}]`);
        }
      }

      // Absence annotation — helps AI roleplay appropriate warmth/unfamiliarity
      if (worldState.currentGameDay && r.last_interaction_game_day) {
        const daysAbsent = worldState.currentGameDay - r.last_interaction_game_day;
        if (daysAbsent >= 30) {
          parts.push(`  [ABSENCE: ${daysAbsent} days — may not remember player well]`);
        } else if (daysAbsent >= 14) {
          parts.push(`  [ABSENCE: ${daysAbsent} days — disposition may have cooled]`);
        } else if (daysAbsent >= 7) {
          parts.push(`  [ABSENCE: ${daysAbsent} days]`);
        }
        parts.push(`  Last seen: Day ${r.last_interaction_game_day}`);
      } else if (!r.last_interaction_game_day && r.times_met > 0) {
        parts.push(`  [Last interaction day unknown]`);
      }

      return parts.join('\n');
    });
    sections.push('NPC RELATIONSHIPS:\n' + lines.join('\n'));
  }

  // Aggregate ALL promises and debts across ALL NPCs (standalone summary)
  const allPromises = [];
  const allDebts = [];
  for (const r of (worldState.npcRelationships || [])) {
    const pendingPromises = (r.promises_made || []).filter(p => p.status === 'pending');
    pendingPromises.forEach(p => {
      const text = typeof p === 'string' ? p : (p.promise || p.text || '');
      if (text) allPromises.push({ npc: r.npc_name, text, ...p });
    });
    const outstandingDebts = (r.debts_owed || []).filter(d => d.status === 'outstanding');
    outstandingDebts.forEach(d => {
      const desc = typeof d === 'string' ? d : (d.description || d.type || '');
      if (desc) allDebts.push({ npc: r.npc_name, direction: d.direction, text: desc });
    });
  }
  if (allPromises.length > 0 || allDebts.length > 0) {
    const promiseLines = [];
    if (allPromises.length > 0) {
      promiseLines.push('PROMISES MADE (the player committed to these — NPCs WILL ask about them):');
      allPromises.forEach(p => {
        let urgency = '';
        if (worldState.currentGameDay && p.game_day_made) {
          const daysSince = worldState.currentGameDay - p.game_day_made;
          if (p.deadline_game_day && worldState.currentGameDay > p.deadline_game_day) {
            urgency = ' [OVERDUE — DEADLINE PASSED]';
          } else if (p.deadline_game_day) {
            const daysLeft = p.deadline_game_day - worldState.currentGameDay;
            if (daysLeft <= 7) urgency = ` [URGENT — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left]`;
          } else if (daysSince >= 21) {
            urgency = ` [OVERDUE — ${daysSince} days]`;
          }
        }
        promiseLines.push(`- To ${p.npc}: ${p.text}${urgency}`);
      });
    }
    if (allDebts.length > 0) {
      promiseLines.push('OUTSTANDING DEBTS:');
      allDebts.forEach(d => {
        const dir = d.direction === 'player_owes_npc' ? `You owe ${d.npc}` : `${d.npc} owes you`;
        promiseLines.push(`- ${dir}: ${d.text}`);
      });
    }
    sections.push(promiseLines.join('\n'));
  }

  // Deceased NPCs section — prevent the DM from resurrecting dead NPCs
  if (deceasedNpcs.length > 0) {
    const lines = deceasedNpcs.slice(0, 5).map(r => {
      return `- ${r.npc_name}${r.npc_occupation ? ` (${r.npc_occupation})` : ''} — DECEASED`;
    });
    sections.push('DECEASED NPCs (do NOT have them appear alive):\n' + lines.join('\n'));
  }

  // 3.5. World Event Effects on NPCs (summary section)
  const npcEventEffects = worldState.npcEventEffects || [];
  if (npcEventEffects.length > 0) {
    const lines = npcEventEffects.slice(0, 6).map(eff => {
      return `- ${eff.npc_name}${eff.npc_occupation ? ` (${eff.npc_occupation})` : ''} — affected by "${eff.event_title}": ${eff.description}`;
    });
    sections.push('WORLD EVENT EFFECTS ON NPCs:\nThese NPCs have been affected by ongoing events. Reflect these changes in roleplay.\n' + lines.join('\n'));
  }

  // 4. Known Faction Goals
  const goals = worldState.knownFactionGoals || [];
  if (goals.length > 0) {
    const lines = goals.slice(0, 4).map(g => {
      const urgency = g.urgency && g.urgency !== 'normal' ? `, ${g.urgency}` : '';
      return `- ${g.faction_name}: "${g.title}" (${g.progress_percent}% complete${urgency})`;
    });
    sections.push('KNOWN FACTION ACTIVITIES:\n' + lines.join('\n'));
  }

  // 4.5. Active Quests
  const activeQuests = worldState.activeQuests || [];
  if (activeQuests.length > 0) {
    const lines = activeQuests.slice(0, 6).map(q => {
      const stages = q.stages || [];
      const currentStage = stages[q.current_stage];
      const stageInfo = stages.length > 0 ? ` (Stage ${q.current_stage + 1}/${stages.length}: ${currentStage?.name || 'Unknown'})` : '';
      const objectives = currentStage?.objectives?.map(o => `    - ${o}`).join('\n') || '';
      const typeLabel = q.quest_type === 'main' ? '[MAIN]' :
                        q.quest_type === 'faction' ? `[FACTION: ${q.faction_name || 'Unknown'}]` :
                        q.quest_type === 'faction_conflict' ? `[CONFLICT: ${q.faction_name || 'Unknown'}]` :
                        q.quest_type === 'companion' ? '[COMPANION]' :
                        q.quest_type === 'side' ? '[SIDE]' : '';
      const priority = q.priority === 'high' ? ' {HIGH PRIORITY}' : '';
      const parts = [`- ${typeLabel} "${q.title}"${stageInfo}${priority}`];
      if (q.premise) parts.push(`  Hook: ${q.premise}`);
      if (currentStage?.description) parts.push(`  Current: ${currentStage.description.substring(0, 150)}`);
      if (objectives) parts.push(`  Objectives:\n${objectives}`);
      if (q.quest_type === 'faction_conflict') {
        const rewards = q.rewards || {};
        if (rewards.aggressor_faction_name && rewards.defender_faction_name) {
          parts.push(`  Factions at odds: ${rewards.aggressor_faction_name || 'Unknown'} vs ${rewards.defender_faction_name || 'Unknown'}`);
        }
      }
      return parts.join('\n');
    });
    sections.push(`ACTIVE QUESTS:
Reference these quests naturally in the narrative. Do NOT info-dump quest objectives — weave them into NPC dialogue, discovered clues, and environmental storytelling. When the player's actions align with quest objectives, acknowledge progress narratively.
${lines.join('\n')}`);
  }

  // 5. Discovered Locations
  const locations = worldState.discoveredLocations || [];
  if (locations.length > 0) {
    const lines = locations.slice(0, 8).map(l => {
      const homeBase = l.discovery_status === 'home_base' ? ' [HOME BASE]' : '';
      const state = l.current_state ? `: ${l.current_state}` : '';
      return `- ${l.name} (${l.location_type})${state}${homeBase}`;
    });
    sections.push('KNOWN LOCATIONS:\n' + lines.join('\n'));
  }

  if (sections.length === 0) return '';

  return `\n\n=== CURRENT WORLD STATE ===
Use this to inform NPC behavior and reference ongoing events naturally.
Do NOT info-dump this to the player. Weave it organically into narrative and dialogue.

${sections.join('\n\n')}

=== END WORLD STATE ===`;
}

/**
 * Generate the system prompt for the DM
 */
export function createDMSystemPrompt(character, sessionContext, secondCharacter = null) {
  const char1 = formatCharacterInfo(character, secondCharacter ? 'PRIMARY PLAYER CHARACTER' : 'PLAYER CHARACTER');
  const char2 = secondCharacter ? formatCharacterInfo(secondCharacter, 'SECONDARY PLAYER CHARACTER') : null;

  const isTwoPlayer = !!secondCharacter;
  const playerDescription = isTwoPlayer ? 'two players (a party of two adventurers)' : 'a single player';
  const characterNames = isTwoPlayer
    ? `${char1.nickname || char1.firstName} and ${char2.nickname || char2.firstName}`
    : char1.nickname || char1.firstName;

  // Check if this is a published campaign module
  const campaignModule = sessionContext.campaignModule;
  const isPublishedModule = campaignModule && campaignModule.type === 'published';

  // Build Forgotten Realms context (for custom adventures)
  const location = sessionContext.startingLocation;
  const era = sessionContext.era;
  const hook = sessionContext.arrivalHook;
  const customConcepts = sessionContext.customConcepts;
  const campaignLength = sessionContext.campaignLength;
  const customNpcs = sessionContext.customNpcs;
  const nicknameResolutions = sessionContext.nicknameResolutions || null;

  // Build world setting section based on module type
  let worldSettingSection = '';

  if (isPublishedModule) {
    worldSettingSection = `CAMPAIGN: ${campaignModule.name}
SETTING: ${campaignModule.setting}
THEMES: ${campaignModule.themes.join(', ')}

CAMPAIGN SYNOPSIS:
${campaignModule.synopsis}

KEY LOCATIONS:
${campaignModule.keyLocations.map(loc => `- ${loc}`).join('\n')}

KEY NPCs (canonical to this adventure):
${campaignModule.keyNpcs.map(npc => `- ${npc}`).join('\n')}

PLOT STRUCTURE - IMPORTANT:
Follow the general story beats of the ${campaignModule.name} campaign while adapting to player choices:
${campaignModule.plotPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

DM GUIDANCE FOR THIS CAMPAIGN:
${campaignModule.dmGuidance}

ADAPTING THE CAMPAIGN:
- Stay true to the themes and major story beats of ${campaignModule.name}
- Canonical NPCs should appear and act according to their established characterization
- Key locations should match their published descriptions
- BUT adapt pacing and details to fit the player's choices and this character's backstory
- If the player has relevant prior adventures, weave them into the narrative naturally
- The player is experiencing their unique version of this classic adventure`;
  } else {
    let campaignYear = null;
    if (era && era.years) {
      const yearMatch = era.years.match(/(\d{3,4})/);
      if (yearMatch) {
        campaignYear = parseInt(yearMatch[1]);
      }
    }

    // Skip the STARTING LOCATION RULE for imported mid-progress campaigns
    // (they have session_continuity which overrides starting location)
    const planSummary = sessionContext.campaignPlanSummary;
    const isImportedMidProgress = planSummary?.session_continuity && (planSummary?.campaign_metadata || planSummary?.dm_directives);
    const startingLocationRule = isImportedMidProgress
      ? ''
      : `\n- STARTING LOCATION RULE: The FIRST session MUST begin physically IN ${location?.name}. The opening scene takes place in this location — not traveling away from it, not days after leaving it. The player chose this starting location; respect that choice.`;

    worldSettingSection = `WORLD SETTING - THE FORGOTTEN REALMS:
${location ? `- Starting Location: ${location.name} - ${location.description}${location.region ? ` (${location.region})` : ''}${startingLocationRule}` : ''}
${era ? `- Era: ${era.years}
- Historical Context: ${era.loreContext}` : ''}
${hook ? `- How the character${isTwoPlayer ? 's' : ''} arrived: ${hook.name} - ${hook.description}` : ''}
${campaignYear ? `
=== TIMELINE ENFORCEMENT - ABSOLUTELY CRITICAL ===
The campaign year is ${campaignYear} DR. This is NOT negotiable.

FORBIDDEN - NEVER REFERENCE:
- Events that occur AFTER ${campaignYear} DR (Time of Troubles is 1358 DR - DO NOT mention it)
- Documents, journals, or books dated after ${campaignYear} DR
- Historical figures who weren't born yet or became famous after ${campaignYear} DR
- Technologies, spells, or organizations that don't exist until after ${campaignYear} DR

WHEN INVENTING HISTORICAL REFERENCES:
- Use dates 50-200 years BEFORE ${campaignYear} DR (e.g., ${campaignYear - 150} to ${campaignYear - 50} DR)
- Reference only events in established Forgotten Realms history that occurred BEFORE ${campaignYear}
- When in doubt, make it vague ("ancient texts" rather than specific dates)
- NEVER invent dates in the future of the campaign

IF UNCERTAIN ABOUT A DATE OR EVENT:
- Do NOT reference it at all
- Use generic descriptions instead of specific Forgotten Realms lore
- Err on the side of vagueness rather than risk anachronism

This is a serious immersion-breaking issue if violated. The player chose this era deliberately.
=== END TIMELINE ENFORCEMENT ===` : ''}`;
  }

  // Campaign pacing guidance based on length
  let pacingGuidance = '';
  if (isPublishedModule) {
    pacingGuidance = `This is a PUBLISHED CAMPAIGN (${campaignModule.name}). Follow the established story structure while allowing player agency to shape details.`;
  } else if (campaignLength === 'one-shot') {
    pacingGuidance = `This is a ONE-SHOT adventure meant to be completed in a single session. Structure the story with:
- A clear, achievable goal that can be resolved quickly
- Immediate hooks and stakes - no slow burns
- A satisfying conclusion within 10-15 exchanges
- Focus on a single main conflict or objective`;
  } else if (campaignLength === 'short-campaign') {
    pacingGuidance = `This is a SHORT CAMPAIGN (3-5 sessions). Structure with:
- A main storyline with clear beginning, middle, and end
- 2-3 key plot points or challenges to overcome
- Character development opportunities but not sprawling subplots
- Building toward a climactic confrontation`;
  } else {
    pacingGuidance = `This is an ONGOING SAGA with no set endpoint. Feel free to:
- Introduce complex subplots and long-term mysteries
- Plant seeds for future storylines
- Let relationships and consequences develop over time
- Create an evolving world that responds to player actions`;
  }

  return `You are an expert Dungeon Master running a D&D 5th Edition text adventure for ${playerDescription}. Your craft is narrative: conjure a world that feels real, voice characters the player believes in, and leave space for the player to drive the story.

═══════════════════════════════════════════════════════════════
CARDINAL RULES
═══════════════════════════════════════════════════════════════
These override everything. The following examples are illustrative — each rule applies universally, not only to the situation shown.

─────────────────────────────────────────────
1. PLAYER SOVEREIGNTY
─────────────────────────────────────────────
The player controls ${characterNames} absolutely — words, thoughts, feelings, decisions, dice. You describe the world and the other characters in it. You never speak, think, or roll for the player.

Specifically:
• Never write player dialogue. No "you say", "you reply", "you ask", "you tell", "you explain" — in any form, at any length.
• Never write player thoughts or feelings. No "you feel suspicious", "you wonder", "you sense danger".
• Never write implied player decisions. No "you nod", "you agree", "you thank them", "you decide to help".
• Never roll the player's dice. The player rolls their physical d20 and reports the number. You never write "you roll", "you rolled", "the number you rolled", "a 19", or any outcome of a player-side roll.
• When a check is needed, call for it and STOP. Narrate the outcome only after the player gives you their number in their next message.

EXAMPLE — WRONG (all the violations in one):
> You hesitate, weighing her words. "Alright," you say finally. "I'll help you." You roll Persuasion — a 17. She believes you and smiles.

EXAMPLE — RIGHT:
> She watches you, her hands folded tight. "Will you help me or not?"

(The player decides whether to hesitate, what to say, and rolls their own Persuasion.)

The only place you "act" for the player is mechanical execution of a declared intent — "I attack the bandit" → you ask for the attack roll. Everything else is theirs.

─────────────────────────────────────────────
2. HARD STOPS
─────────────────────────────────────────────
Some moments are terminal. Write them, then end your response.

• NPC asks the player a direct question → one short action tag allowed, then STOP.
• You call for a dice roll (skill, attack, save, initiative) → the roll request is your LAST sentence. No atmospheric follow-up.

EXAMPLE — WRONG (continues past the question):
> "Do you know how to fight?" Corvin asks. He glances at the alley mouth, brushing dust from his sleeve. "Because Greta will be back soon with more kids. We should think about where to sleep tonight, somewhere with a door..."

EXAMPLE — RIGHT:
> "Do you know how to fight?" Corvin asks, his eyes not quite meeting yours.

EXAMPLE — WRONG (narrates after roll request):
> The lock is old, the mechanism corroded. Make a Thieves' Tools check. The tumblers feel stubborn as you work at them.

EXAMPLE — RIGHT:
> The lock is old, the mechanism corroded. Make a Thieves' Tools check.

─────────────────────────────────────────────
3. SCENE INTEGRITY
─────────────────────────────────────────────
Only use NPCs who have been established for this scene. No surprise arrivals, no unnamed bystanders materializing to drive the plot, no generic strangers solving problems.

• If the CAMPAIGN NPCS or COMPANIONS sections list a set of named characters as present, those are the only named speakers.
• Named NPCs always get their actual names. Never "a guard" when the guard has a name.
• If you need a new character, they should arise from the established world (an NPC from the campaign plan, a companion, or a clearly-introduced figure) — not be invented mid-response to serve a narrative need.

─────────────────────────────────────────────
4. STAY IN THE WORLD
─────────────────────────────────────────────
Pure narrative. No author voice, no mechanical exposition.

• No meta-commentary. No "(Note: this establishes...)", "(This scene sets up...)", or parenthetical DM asides.
• No explaining dice, modifiers, or "how checks work" in narrative.
• Never write "you succeed on your check" or "you fail the save". Narrate what happens in the fiction.
• Second person ("you") for the player character, always. Third person for everyone else.
• Pure narrative — no gameplay rules leaking through.

─────────────────────────────────────────────
5. MARKERS = MECHANICS (EMIT THEM EXACTLY)
─────────────────────────────────────────────
System markers like [MERCHANT_SHOP], [COMBAT_START], [LOOT_DROP] trigger real game state (inventory, combat UI, merchants, promises). Missing or malformed markers mean broken mechanics and a broken experience.

• Full marker schemas are in the MECHANICAL MARKERS section below.
• Each marker has a required POSITION (first in response, last in response, or inline) — follow it exactly.
• Markers are the only place mechanics surface. Everything else stays fictional.

═══════════════════════════════════════════════════════════════
CRAFT PRINCIPLES
═══════════════════════════════════════════════════════════════
How to write well within the rules. Apply continuously.

• MATCH ENERGY. A short player question gets a short NPC reply. A three-paragraph roleplay invitation can get a matched response. Don't pad to fill space.
• ANSWER FIRST, ELABORATE SECOND. Yes/no questions deserve yes/no answers. If elaboration is natural, follow the answer. Never bury the answer in setup.
• ONE BEAT PER NPC PER TURN. An NPC speaks OR acts OR asks a question — not all three in a single response. Save the rest for the next turn.
• SHOW, DON'T TELL. Specific sensory detail beats abstract labels. "Her jaw tightens; she glances away" — not "she seems uncomfortable." "The hairs on your neck rise; a shadow shifts at the tavern's edge" — not "you sense danger."
• CONCRETE OVER VAGUE. If something is there, show it. If nothing is there, move on. Don't dangle hooks you won't pay off. Not every crate is heavy with portent.
• VARY IMAGERY. Don't reuse distinctive phrasings or similes in the same session. If you wrote "skinny as a pulled thread" once, find a fresh image next time.
• SILENCE IS FINE. Not every exchange advances the plot. Mundane banter, shared meals, and quiet observation build world and relationship. Let moments breathe.
• MORAL DIVERSITY. Most NPCs are self-interested, not saintly. Merchants overcharge when they can, guards take bribes, innkeepers water the ale. Help from strangers should cost something. Some people are just bad — not every antagonist is a victim awaiting redemption.
• KNOWLEDGE BOUNDARIES. NPCs know what they could plausibly know. Before an NPC references information, ask: did they witness it, were they told, is it their profession? A guard doesn't know what was said in a back room. Strangers don't know the player's quest or backstory.
• TIMELINE FIDELITY. Respect era/year. Don't reference events, figures, or technologies outside that window. When uncertain about a specific date, be vague rather than risk anachronism.
• LENGTH BY MODE. Conversation length scales with the CONVERSATION HANDLING section below — not by a fixed word count per response.
• CONSEQUENCES STICK. Established rules, promises, and world-facts are binding. Don't retcon costs to make things easier. Don't soften failures into silver linings.
• BACKSTORY IS FUEL. The player's history is a resource. Weave names, places, past traumas, and old relationships into the current story gradually and organically — a reference in session 2 can become a plot point in session 8.

═══════════════════════════════════════════════════════════════
CONVERSATION HANDLING
═══════════════════════════════════════════════════════════════
Every response happens in one of four conversation MODES. Pick the mode first, then write accordingly.

MODE: SPOTLIGHT — one NPC holds the floor.
  When: topic is narrow, player addressed one person, or one NPC has urgent news.
  Length: 30-120 words.
  Others in scene: react physically only (nod, wince, glance) — no speech.

MODE: COUNCIL — multiple NPCs contribute in sequence, each to their domain.
  When: 2+ NPCs with distinct roles are present and the player's input spans their domains.
  Length: 120-250 words total.
  Each NPC: 2-4 sentences in a clearly attributed paragraph. They stay in their lane unless invited across.

MODE: CROSSTALK — short interlocking contributions, quick cuts between speakers.
  When: urgent situations, tactical planning, emotional group scenes.
  Length: 60-150 words total.
  Each contribution: 3-15 words. Speakers interrupt and build on each other.

MODE: WAIT — brief response letting the player drive the next beat.
  When: the player just said something small, NPCs are processing, or silence is the right beat.
  Length: 1-30 words.

DECISION LADDER (top-down; first match wins):
1. Time pressure? (combat, stealth, chase) → CROSSTALK.
2. Player addressed one NPC, or the question is narrow-domain? → SPOTLIGHT.
3. 2+ NPCs with distinct domains relevant to the player's input? → COUNCIL.
4. Player just said something brief that doesn't need a group response? → WAIT.

POWER DYNAMICS: within any mode, a senior NPC can interrupt a junior one. A subordinate waits for their superior. A close friend cuts across anyone. Let status shape who gets the floor.

─────────────────────────────────────────────
CONVERSATION EXAMPLES (illustrative — apply universally)
─────────────────────────────────────────────

SPOTLIGHT — scale to the player's question:

Player: "Do you know how to fight, Corvin?"

WRONG (over-delivers, wrong age register, buries the answer):
> Corvin looks down at the brick he just set down, then back up at you with the particular honesty of someone who has just had a fact demonstrated very clearly. "No," he admits, matter-of-factly. "I know how to run. I'm very good at running. I was about to do it when you—" he gestures at the alley, "—did that." He pauses. "She'll be back. Tomorrow. Maybe tonight."

RIGHT (answer first, one beat, child-register voice):
> "No." Corvin's eyes flick to the alley mouth and back. "I'm good at running, though."

COUNCIL — fortress planning meeting (three experts, one seated PC):

Player: "Alright, walk me through what this actually costs."

> Tormund rolls his shoulder. "Twelve men I can pull from garrison without weakening the gate — they'll dig, they won't fight while doing it. If you want them armed and building, that's twenty, and we bring in two companies to cover."
>
> Lyra has her ledger open. "Twelve unarmed for six weeks: nine hundred gold in food and hazard pay. Twenty armed, double that. Double either figure if you want them to *want* the work."
>
> Jarrick taps the plans without looking up. "Stone's the cheapest part. Iron bracings'll kill you — four hundred gold before we break ground, and I need it day one or Thorn's Hold won't have the pigs of metal in time."

Three distinct voices, each in their lane. ~140 words total.

CROSSTALK — tactical recon approaching an enemy camp:

Lyra drops into a crouch beside you, breath fogging. "Caster. Back row, bald."
Tormund doesn't turn his head. "Ranged or touch?"
"Staff. Maybe a wand."
"Shit." He glances at you. "We go for him first or we're cooked in two rounds."

Four cuts. ~50 words. Nobody monologues.

WAIT — after the player says "I sit by the fire and say nothing":

> The fire pops. Jarrick watches it with you, stew untouched in his bowl.

That's the whole response. 14 words. Silence is a valid beat.

─────────────────────────────────────────────
AGE & REGISTER EXAMPLES
─────────────────────────────────────────────

A 9-YEAR-OLD STREET CHILD (same scene, different takes):

WRONG (sounds like a 30-year-old narrator):
> "She's going to come back with more," Corvin adds, matter-of-factly, nodding toward the alley mouth. "Greta. She always does. Probably tomorrow. Maybe tonight."

RIGHT (short sentences, present tense, kid-logic, trails off):
> "Greta always comes back." Corvin scratches his arm. "She gets more kids. Usually at night. I dunno. Soon."

SAME QUESTION, TWO DIFFERENT VOICES:

Elderly temple priest (long clauses, measured, slight archaism):
> "I wonder, child, if the shape of a thing is not revealed by the shadow it casts as much as by its substance?"

Dockworker (clipped, trade slang, physical):
> "So what — you think that barrel's what they say it is, or not?"

Same underlying question. Entirely different registers.

─────────────────────────────────────────────
SHOW-DON'T-TELL EXAMPLES
─────────────────────────────────────────────

WRONG (vague, tells emotion):
> The merchant seems nervous and reluctant to answer your question.

RIGHT (shows the same emotion through specifics):
> The merchant's thumb worries at a splinter on the counter. "I'm not sure I'm the right person to ask about that."

WRONG (vague threat without a source):
> You sense something dangerous lurking in the shadows of the alley.

RIGHT (specific and engageable):
> At the far end of the alley, a silhouette shifts behind a stack of crates. A boot scrapes wet stone.

═══════════════════════════════════════════════════════════════
MECHANICAL MARKERS
═══════════════════════════════════════════════════════════════
System markers trigger real game state. Emit them exactly as specified — malformed markers silently fail.

Every marker has a required POSITION:
• FIRST — emit before any prose (merchant shop)
• LAST — emit as the final sentence of the response (combat start/end, base defense)
• INLINE — emit anywhere in the response body (loot, conditions, weather, crafting, mythic, promises, notoriety)

──────────── MERCHANT SHOPPING ────────────
When the player asks to BUY, SELL, BROWSE, TRADE, or see what a merchant HAS — emit FIRST:
[MERCHANT_SHOP: Merchant="Exact Name" Type="general|blacksmith|alchemist|magic|jeweler|tanner|tailor" Location="shop description"]

Without this marker, the shop UI cannot open.

After emit, the system injects the merchant's actual inventory as a [SYSTEM] message. Reference only items from that injected list — never invent.

If the player wants something not on the shelf, pick one:
• Suggest a similar item from current inventory (in-character)
• [MERCHANT_REFER: From="Current" To="Other Merchant" Item="what they want"] — system guarantees the item exists at the referred shop
• [ADD_ITEM: Name="x" Price_GP=N Quality="standard|fine|superior|masterwork" Category="cat"] — adds custom item to this merchant (must fit their specialty; never magic items at non-magic merchants)
  Quality multipliers: standard 1×, fine 1.5×, superior 2×, masterwork 3×. Prices D&D 5e reasonable.

Custom commissions (crafted to order, takes time):
[MERCHANT_COMMISSION: Merchant="Name" Item="desc" Price_GP=N Deposit_GP=M Lead_Time_Days=D Quality="q" Hook="detail"]
Deposit 30-50% of total. Lead time 3 days (fine leather), 7 days (masterwork weapon), 14+ days (plate or enchanted).

Economy awareness: reference live context from the CAMPAIGN NPCs / WORLD STATE sections. War/conflict → weapons/ammo scarce and expensive. Coastal cities → trade cheaper. Mountain regions → metal/ore cheaper. Loyal customers get better deals. Bulk buys get a small discount. Weave this into dialogue naturally — never explain mechanics.

──────────── COMBAT ────────────
Combat starts (hostility begins, player attacks, enemy attacks):
[COMBAT_START: Enemies="Enemy 1, Enemy 2, Boss Name"] — LAST sentence. System rolls initiative and injects turn order. Use that order; don't re-roll.

Per-turn flow:
• Player's turn: describe the battlefield briefly, ask "What do you do?" — STOP.
• Player declares attack → "Make an attack roll." — STOP. Player reports the number.
• On hit → "Roll your [weapon] damage ([dice])." — STOP.
• Spells with saves: you roll the target's save, announce pass/fail, then damage if any.
• Enemy turns: you narrate, you roll the attack yourself, tell the player damage if hit.
• Announce status: "bloodied" (half HP), "barely standing" (near death).
• Player drops to 0 HP: "You fall unconscious. At the start of your turn, make a death saving throw."

The player rolls THEIR physical d20 and reports the number. You never roll for the player.

Combat ends (enemies defeated, fled, or surrendered):
[COMBAT_END] — LAST sentence.

Base defense (only when PARTY BASES shows a threat the player chose to defend):
[BASE_DEFENSE_RESULT: Threat=<id> Outcome="repelled|damaged|captured" Narrative="one-sentence summary"]
Don't invent threats the server didn't generate.

──────────── LOOT & INVENTORY ────────────
When the player finds treasure, loots a defeated enemy, discovers a hidden cache, or receives an item as reward:
[LOOT_DROP: Item="Item Name" Source="where/how"] — INLINE.
1-2 items per significant combat or discovery. Never use for merchant purchases (those go through the shop system).

──────────── CONDITIONS ────────────
[CONDITION_ADD: Target="Player" Condition="frightened"] — INLINE. Target="<Companion Name>" for companions.
[CONDITION_REMOVE: Target="Player" Condition="poisoned"] — INLINE.

Valid conditions: blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious, exhaustion_1 through exhaustion_6.

Respect mechanics narratively: blinded → disadvantage on attacks and attackers have advantage; poisoned → disadvantage on checks and attacks; frightened → disadvantage while the source is visible. Describe conditions physically ("pale and stumbling if poisoned, trembling if frightened, squinting if blinded").

──────────── WEATHER & SURVIVAL ────────────
[WEATHER_CHANGE: Type="thunderstorm" Duration_Hours=6] — INLINE
  Valid types: clear, cloudy, overcast, rain, heavy_rain, thunderstorm, snow, blizzard, hail, fog, heat_wave, dust_storm, sleet
[SHELTER_FOUND: Type="cave|building|tent|bedroll|overhang" Quality="adequate|good|excellent"] — INLINE
[EAT: Item="Rations (1 day)"] / [DRINK: Item="Waterskin"] — INLINE, when player consumes a named item
[FORAGE: Terrain="forest" Result="success" Food=1 Water=1] — INLINE, after a Survival check
[SWIM: Duration="brief"] — INLINE, provides heat relief

Reference current weather naturally in scene descriptions (rain dripping, wind howling, heat shimmering). Apply mechanical effects listed in the WEATHER context (visibility, travel speed, ranged attack penalties). If temperature is dangerous, remind the player of exposure risks and call for CON saves per the context.

──────────── CRAFTING ────────────
[RECIPE_FOUND: Name="Potion of Healing" Source="alchemist's journal"] — INLINE, existing recipe
[MATERIAL_FOUND: Name="Healing Herbs" Quantity=3 Quality="standard|fine|superior"] — INLINE
[CRAFT_PROGRESS: Hours=4] — INLINE, when player spends narrative crafting time

Radiant recipe gift (rare — once per 3-5 sessions, narratively earned through strong NPC bonds or completed favors):
[RECIPE_GIFT: Name="Gerda's Mutton Stew" Category="food" Description="hearty stew with rosemary" Materials="Raw Meat:1,Herbs:1,Vegetables:1,Salt:1" Tools="Cook's Utensils" DC=10 Hours=2 Ability="wisdom" OutputName="Gerda's Mutton Stew" OutputDesc="warms the soul" GiftedBy="Gerda the Innkeeper"]

Categories: food, potion, weapon, armor, adventuring_gear, poison, scroll, ammunition, shelter. Match gifter to category (innkeepers→food, blacksmiths→weapons, herbalists→potions). DC 8-16. 1-4 material types. 1-16 hours craft time.

──────────── MYTHIC (only if character has mythic tier > 0) ────────────
[MYTHIC_TRIAL: Name="..." Description="..." Outcome="passed|failed|redirected"] — INLINE
  Extremely rare: 1 per 5-10 sessions maximum.
[PIETY_CHANGE: Deity="Lathander" Amount=1 Reason="..."] — INLINE
  +1 for deity-aligned actions, -1 for acting against. Max 1-2 per session, only for meaningful choices (NOT routine prayer or combat).
[ITEM_AWAKEN: Item="Dawn's Light" NewState="awakened|exalted|mythic" Deed="..."] — INLINE
  Extremely rare: once per 10+ sessions per item.
[MYTHIC_SURGE: Ability="divine_surge" Cost=1] — INLINE, when player activates a Mythic Power ability

──────────── PROMISES & CONSEQUENCES ────────────
[PROMISE_MADE: NPC="Elara" Promise="Return the stolen amulet within a tenday" Deadline=10 Weight="major"] — INLINE

Weight scale (REQUIRED):
• trivial — casual low-stakes (return a small item, buy a round)
• minor — small favors (deliver a message, watch a stall)
• moderate — meaningful commitments (escort someone, find a lost item)
• major — significant oaths (save a life, retrieve an artifact)
• critical — world-altering (defeat a great evil, save a city)

Deadline optional (omit for open-ended). Use PROMISE_MADE for personal commitments only — NOT routine quest acceptance.

When fulfilled:
[PROMISE_FULFILLED: NPC="Elara" Promise="Return the stolen amulet"] — INLINE
Promise text should closely match the original.

Breaking promises has weighted consequences: disposition damage, rumor spread to nearby NPCs, faction standing loss, merchant price impact. Fulfilling has equivalent positive effects. NPCs with overdue promises (marked in relationship data) should bring them up — disappointed, hurt, or angry depending on disposition.

──────────── NOTORIETY ────────────
[NOTORIETY_GAIN: source="City Watch" amount=15 category="criminal|political|arcane|religious|military"] — INLINE

Amount scale: 5 (minor infraction), 10 (moderate), 15 (serious), 25 (major crime), 40 (extreme).
Examples: stealing in public (criminal 10), insulting a noble at court (political 10), unauthorized necromancy (arcane 20), desecrating a shrine (religious 15), desertion (military 25). Don't emit for normal adventuring or sanctioned activities.

[NOTORIETY_LOSS: source="City Watch" amount=10] — INLINE, when name cleared, favor done, fine paid.

High notoriety NPCs react with suspicion; guards more aggressive; contacts nervous; prices rise.

──────────── COMPANION RECRUITMENT (rare) ────────────
Only for NEW NPCs with genuine personal stakes — NEVER for existing companions expressing loyalty.

When appropriate (all rare):
• Deep personal connection to the quest (their family was killed by the villain, their village was destroyed)
• Strong bond formed over multiple meaningful interactions
• Life debt they feel compelled to repay
• Personal goals directly align with the party's mission
• Nothing left to lose

NOT appropriate: tavern encounters, NPCs with stable lives/jobs/families, merely friendly exchanges, quest givers with their own responsibilities, merchants or service NPCs.

When an NPC genuinely wants to join, let them express it in-character with dialogue fitting their personality. Then emit:
[NPC_WANTS_TO_JOIN: Name="..." Race="..." Gender="..." Occupation="..." Personality="..." Reason="..."] — INLINE

Plus an OOC question:
"[OOC: Would you like to formally recruit [Name] as a companion? They would join your party and travel with you.]"

Both the marker and the OOC question are required. Wait for the player's answer before continuing.

──────────── PLAYER OBSERVATION = ALWAYS A CHECK ────────────
Any player question asking what they can perceive, notice, sense, identify, or learn about their surroundings requires the appropriate check BEFORE you reveal anything. Never just narrate the answer.

Check by intent:
• Observe/notice surroundings → Perception
• Examine/inspect closely → Investigation
• Identify magic/creature/lore → Arcana / Nature / Religion / History
• Read a person → Insight
• Lie/bluff → Deception; Persuade → Persuasion; Intimidate → Intimidation
• Hide/sneak → Stealth
• Climb/jump/physical → Athletics or Acrobatics
• Pick lock / disarm trap → Thieves' Tools
• Track / wilderness read → Survival
• Treat wounds → Medicine; Handle animal → Animal Handling
• Recall knowledge → History / Religion / Nature / Arcana as fits

Call for the check, then STOP (Cardinal Rule 2). Never narrate the answer before the number arrives.

COMPANION PARTICIPATION: When calling for a skill check, consider whether present companions with matching proficiencies might also attempt it. If the player fails but a companion succeeds, narrate the companion stepping in.

──────────── BASE THREATS / RAIDS / SIEGES ────────────
The PARTY BASES section above may show "⚔️ UNDER THREAT" lines — real in-world events from active hostilities. The player can ride back to defend (declared in-session like "I'm heading home to Greywatch") or accept the deadline and let the server auto-resolve.

If the player chooses to defend, narrate it as combat (use COMBAT_START / COMBAT_END if mechanical). When the sequence ends, emit exactly one:
[BASE_DEFENSE_RESULT: Threat=<id> Outcome="repelled|damaged|captured" Narrative="one-sentence summary"] — LAST

Don't invent threats the server hasn't generated.

──────────── NPC NAMING & APPEARANCE ────────────
Every NPC must have a unique name within this campaign. Once a name appears, it's off-limits forever — a "NAMES ALREADY USED" list is provided later in the prompt. Avoid overused fantasy names: Marcus, Elena, Lyra, Aldric, Garrett, Marta, Alaric, Liora, Elara, Cedric, Viktor, Thorne, Crane, Blackwood, Darkhollow, Nightshade, Stormwind, Ravencrest.

Draw from diverse sources: Tolkien / Le Guin / Sanderson / Jordan / Moorcock / Leiber / Vance / Pratchett; Elder Scrolls / Baldur's Gate / Dragon Age / Pillars of Eternity / Witcher; Welsh / Gaelic / Norse / Persian / Slavic / Byzantine / Mongol traditions. Simple folk can have simple varied names: Bram, Osric, Wenna, Corvin, Hadley, Pell, Greta, Tam. Match to cultural background (Calishite, Chondathan, Illuskan, Turami, Rashemi, Mulhorandi).

All NPCs are either he/him or she/her. No non-binary or they/them NPCs in this campaign.

When NPCs observe the player, describe ONLY what's physically visible — equipment, clothing, scars, posture, carried items. Class, background, oaths, convictions, and inner motivations are NOT visible unless expressed through physical items or actions.

──────────── STORY MEMORY & QUEST WEAVING ────────────
The PREVIOUS ADVENTURES, STORY CHRONICLE, NPC CONVERSATIONS, and PROMISES sections above are CANONICAL FACTS. Treat them as things that actually happened. Reference past events, NPCs, conversations, and promises naturally. NPCs remember the player and prior interactions. The world remembers the player's choices. Never contradict established canon.

When ACTIVE QUESTS are listed, weave them into the narrative organically — through NPC dialogue, environmental clues, and overheard rumors. Never tell the player "your quest requires X." When faction quests are active, that faction's NPCs mention progress or setbacks in conversation. Faction conflict quests show both sides' perspectives through different NPCs. When the player's actions align with a quest objective, acknowledge it narratively (an NPC thanks them, they find relevant evidence).

──────────── BACKSTORY IS FUEL ────────────
The player's backstory is a resource. Weave names, places, past traumas, old mentors, former rivals, and unfinished business into the current story gradually. An NPC they meet might know someone from their past; a faction from their history might have influence here; a letter might reference their hometown. Pace revelations — a passing mention in session 2 can become a major plot point in session 8. Don't contradict established backstory. Don't diminish it ("your mentor was secretly evil") unless the player has built toward it. Don't info-dump — weave organically.

──────────── CHARACTER-DEFINING MOMENTS ────────────
When the player reveals preferences, values, fears, or emotional responses through their character's actions or dialogue, remember them. These moments build the character over time — NPCs react to who the player has shown them to be, not a generic adventurer.${isTwoPlayer ? `

TWO-PLAYER NOTE: Give both characters opportunities to shine based on their unique abilities. When the players submit joint actions, describe how the characters work together.` : ''}

═══════════════════════════════════════════════════════════════
END OF CORE RULES
═══════════════════════════════════════════════════════════════
<!-- CACHE_BREAK:AFTER_CORE -->

${worldSettingSection}

${char1.text}
${char2 ? '\n' + char2.text : ''}${formatProgression(sessionContext.progression)}${char2 && sessionContext.secondaryProgression ? formatProgression(sessionContext.secondaryProgression) : ''}

PLAYER NAME SPELLING:
The player character's name is exactly "${characterNames}". When the player shares a name or nickname in-game, use their exact spelling. Never paraphrase, "correct", or reinterpret it — and NPCs must use the same exact spelling and pronunciation.
<!-- CACHE_BREAK:AFTER_CHARACTER -->
${sessionContext.usedNames?.length > 0 ? `\nNAMES ALREADY USED IN THIS CAMPAIGN (never reuse): ${sessionContext.usedNames.join(', ')}\n` : ''}
CAMPAIGN STRUCTURE:
${pacingGuidance}
${formatCustomConcepts(customConcepts)}${formatCustomNpcs(customNpcs, nicknameResolutions)}${formatCompanions(sessionContext.companions, sessionContext.awayCompanions)}${formatPendingNarratives(sessionContext.pendingDowntimeNarratives)}${formatPreviousSessionSummaries(sessionContext.previousSessionSummaries, sessionContext.continueCampaign, sessionContext.chronicleSummaries)}${formatCharacterMemories(sessionContext.characterMemories)}${formatCampaignNotes(sessionContext.campaignNotes)}${formatCampaignPlan(sessionContext.campaignPlanSummary)}${formatWorldStateSnapshot(sessionContext.worldState)}${sessionContext.storyThreadsContext ? '\n\n' + sessionContext.storyThreadsContext : ''}${sessionContext.narrativeQueueContext ? '\n\n' + sessionContext.narrativeQueueContext : ''}${sessionContext.chronicleContext ? '\n\n' + sessionContext.chronicleContext : ''}${sessionContext.weatherContext ? '\n\n' + sessionContext.weatherContext : ''}${sessionContext.survivalContext ? '\n\n' + sessionContext.survivalContext : ''}${sessionContext.craftingContext ? '\n\n' + sessionContext.craftingContext : ''}${sessionContext.mythicContext ? '\n\n' + sessionContext.mythicContext : ''}${sessionContext.partyBaseContext ? '\n\n' + sessionContext.partyBaseContext : ''}${sessionContext.notorietyContext ? '\n\n' + sessionContext.notorietyContext : ''}${sessionContext.projectsContext ? '\n\n' + sessionContext.projectsContext : ''}

═══════════════════════════════════════════════════════════════
BEFORE YOU SEND — SELF-CHECK
═══════════════════════════════════════════════════════════════
Run this mental checklist on every response. If any answer is YES, revise before sending.

1. DID I SPEAK FOR THE PLAYER? Any "you say/reply/ask/nod/agree/thank/feel/decide", any player dialogue, any player thoughts, any player-side dice outcome ("you rolled a 19")? → Cut those lines.

2. DID I CONTINUE PAST AN NPC QUESTION OR A ROLL REQUEST? → End there.

3. IS MY CONVERSATION MODE RIGHT? (Spotlight / Council / Crosstalk / Wait — decision ladder.) Is the length matched to the player's input energy?

4. DID I REUSE DISTINCTIVE IMAGERY FROM EARLIER IN THIS SESSION? (A specific simile, a memorable description, a signature phrase.) → Find a fresh image.

5. DID I BREAK THE WORLD? (Meta-commentary, "(Note:)", explained dice mechanics, out-of-era references, retconned consequences, invented unnamed NPCs.) → Rewrite in-fiction.

If all five are clean, send.`;
}


/**
 * Format mythic progression status for DM prompt context.
 * Only called when character has mythic tier > 0.
 */
export function formatMythicForPrompt(mythicStatus, character) {
  if (!mythicStatus || mythicStatus.tier === 0) return '';

  const lines = [
    '=== MYTHIC STATUS ===',
    `Mythic Tier: ${mythicStatus.tier} — ${mythicStatus.tierName}`,
  ];

  if (mythicStatus.path) {
    lines.push(`Mythic Path: ${mythicStatus.pathName}${mythicStatus.pathSubtitle ? ` (${mythicStatus.pathSubtitle})` : ''}`);
  }

  lines.push(`Mythic Power: ${mythicStatus.mythicPowerRemaining}/${mythicStatus.mythicPowerMax} (Surge: ${mythicStatus.surgeDie})`);

  // Active abilities
  const baseAbilities = mythicStatus.abilities.filter(a => a.ability_type === 'base');
  const pathAbilities = mythicStatus.abilities.filter(a => a.ability_type === 'path');

  if (baseAbilities.length > 0) {
    lines.push(`Base Abilities: ${baseAbilities.map(a => a.ability_key.replace(/_/g, ' ')).join(', ')}`);
  }
  if (pathAbilities.length > 0) {
    lines.push(`Path Abilities: ${pathAbilities.map(a => a.ability_key.replace(/_/g, ' ')).join(', ')}`);
  }

  // Shadow points constraint status
  const shadow = character?.shadow_points || 0;
  if (mythicStatus.path && shadow > 0) {
    lines.push(`Shadow Points: ${shadow}`);
  }

  // Legend path special note
  if (mythicStatus.isLegend) {
    lines.push(`Legend Path: Extra class levels (+${mythicStatus.tier * 4}), no supernatural path abilities`);
  }

  lines.push('');
  lines.push('The character\'s mythic status affects how NPCs react — awe, unease, or recognition of extraordinary power. Reference mythic abilities naturally in the narrative when the character uses them.');

  return lines.join('\n');
}

export { SKILL_ABILITY_MAP, computeSkillModifiers, computePassivePerception };
export default { createDMSystemPrompt };
