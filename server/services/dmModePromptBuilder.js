/**
 * DM Mode Prompt Builder — Constructs the system prompt for AI-as-4-Players mode.
 * Uses 3-point reinforcement: ABSOLUTE RULES → detailed sections → FINAL REMINDER.
 */

import { SKILL_ABILITY_MAP, computeSkillModifiers } from './dmPromptBuilder.js';

/**
 * Format a single character's sheet for the system prompt.
 */
function formatCharacterBlock(char, allCharacters) {
  const parts = [];

  parts.push(`=== ${char.name.toUpperCase()} — ${char.race}${char.subrace ? ` (${char.subrace})` : ''} ${char.class}${char.subclass ? ` (${char.subclass})` : ''} ${char.level} ===`);
  parts.push(`Gender: ${char.gender || 'Unknown'} | Background: ${char.background || 'Unknown'} | Alignment: ${char.alignment}`);

  // Ability Scores
  const scores = char.ability_scores || {};
  parts.push(`STR ${scores.str || 10} | DEX ${scores.dex || 10} | CON ${scores.con || 10} | INT ${scores.int || 10} | WIS ${scores.wis || 10} | CHA ${scores.cha || 10}`);

  // Combat stats
  parts.push(`HP: ${char.current_hp}/${char.max_hp} | AC: ${char.armor_class} | Speed: ${char.speed}ft`);

  // Equipment
  if (char.equipment) {
    const eq = char.equipment;
    const weaponStr = eq.mainHand ? `${eq.mainHand.name} (${eq.mainHand.damage} ${eq.mainHand.damageType})` : 'Unarmed';
    const armorStr = eq.armor ? `${eq.armor.name} (AC ${eq.armor.baseAC})` : 'No armor';
    const offhandStr = eq.offHand ? `, Off-hand: ${eq.offHand.name}` : '';
    parts.push(`Weapon: ${weaponStr}${offhandStr} | Armor: ${armorStr}`);
  }

  // Skills with modifiers
  if (char.skill_proficiencies && char.skill_proficiencies.length > 0) {
    const profBonus = Math.floor((char.level - 1) / 4) + 2;
    const skillStrs = char.skill_proficiencies.map(skill => {
      const abilityKey = SKILL_ABILITY_MAP[skill];
      const abilityScore = scores[abilityKey] || 10;
      const abilityMod = Math.floor((abilityScore - 10) / 2);
      const total = abilityMod + profBonus;
      return `${skill} ${total >= 0 ? '+' : ''}${total}`;
    });
    parts.push(`Skills: ${skillStrs.join(', ')}`);

    // Passive Perception
    const hasPerception = char.skill_proficiencies.some(s => s.toLowerCase() === 'perception');
    const wisMod = Math.floor(((scores.wis || 10) - 10) / 2);
    const passivePerc = 10 + wisMod + (hasPerception ? profBonus : 0);
    parts.push(`Passive Perception: ${passivePerc}`);
  }

  // Spellcasting
  if (char.known_cantrips && char.known_cantrips.length > 0) {
    parts.push(`Cantrips: ${char.known_cantrips.join(', ')}`);
  }
  if (char.known_spells && char.known_spells.length > 0) {
    parts.push(`Spells: ${char.known_spells.join(', ')}`);
    if (char.spell_slots && Object.keys(char.spell_slots).length > 0) {
      const slotStr = Object.entries(char.spell_slots)
        .map(([lvl, count]) => {
          const used = (char.spell_slots_used || {})[lvl] || 0;
          return `Lv${lvl}: ${count - used}/${count}`;
        }).join(', ');
      parts.push(`Spell Slots: ${slotStr}`);
    }
  }

  // Inventory
  if (char.inventory && char.inventory.length > 0) {
    parts.push(`Inventory: ${char.inventory.join(', ')}`);
  }
  if (char.gold_gp) {
    parts.push(`Gold: ${char.gold_gp} gp`);
  }

  // Personality (THE MOST IMPORTANT PART)
  parts.push('');
  parts.push('PERSONALITY:');
  parts.push(`Traits: ${char.personality_traits}`);
  parts.push(`Ideals: ${char.ideals}`);
  parts.push(`Bonds: ${char.bonds}`);
  parts.push(`Flaws: ${char.flaws}`);
  parts.push(`Motivation: ${char.motivation}`);
  parts.push(`Fear: ${char.fear}`);
  parts.push(`Secret (PROTECT THIS — only reveal at dramatically perfect moments): ${char.secret}`);
  parts.push(`Quirk: ${char.quirk}`);
  parts.push(`Mannerism: ${char.mannerism}`);

  // Voice & Behavioral
  parts.push('');
  parts.push('VOICE & BEHAVIOR:');
  parts.push(`Voice: ${char.voice}`);
  parts.push(`Speaking Style: ${char.speaking_style}`);
  parts.push(`Combat Style: ${char.combat_style}`);
  parts.push(`Social Style: ${char.social_style}`);
  parts.push(`Moral Tendencies: ${char.moral_tendencies}`);

  // Relationships
  if (char.party_relationships) {
    parts.push('');
    parts.push('RELATIONSHIPS WITH PARTY MEMBERS:');
    for (const [name, rel] of Object.entries(char.party_relationships)) {
      parts.push(`- ${name}: ${rel.attitude} — "${rel.tension}"`);
    }
  }

  return parts.join('\n');
}

/**
 * Build the full system prompt for DM Mode sessions.
 * @param {Object} party - Party data from dm_mode_parties table
 * @param {Object} context - { previousSummaries, sessionCount }
 */
export function createDMModeSystemPrompt(party, context = {}) {
  const { previousSummaries, sessionCount = 0 } = context;
  const chars = party.characters || [];
  const tensions = party.tensions || [];
  const dynamics = party.party_dynamics;

  const characterNames = chars.map(c => c.name);

  const sections = [];

  // ==========================================
  // ROLE DECLARATION
  // ==========================================
  sections.push(`You are playing ${chars.length} distinct D&D 5e player characters in a campaign. The USER is the Dungeon Master (DM). You respond in character as these adventurers — reacting to the DM's narration, making decisions, having conversations with each other, and declaring actions.

THE PARTY: "${party.party_name || 'The Adventurers'}"
${party.party_concept || ''}`);

  // ==========================================
  // ABSOLUTE RULES — Point 1 of 3-point reinforcement
  // ==========================================
  sections.push(`
========================================
=== ABSOLUTE RULES — NEVER VIOLATE ===
========================================

CHARACTER VOICE — MANDATORY:
You are playing ${chars.length} DIFFERENT people. Each has their own vocabulary, rhythm, worldview, and emotional register:
${chars.map(c => `- ${c.name}: ${c.speaking_style}`).join('\n')}
If a reader covers the character names, they MUST be able to tell who is speaking from the dialogue alone.

RESPONSE FORMAT — MANDATORY:
- Label EVERY character's speech/action with their name in bold: **${characterNames[0]}:** "dialogue" or **${characterNames[0]}** *action description*
- Characters who have nothing meaningful to add STAY SILENT. 2-3 characters responding per DM prompt is typical.
- Not every character speaks every turn. Silence is characterization.
- Dialogue uses quotes. Actions and internal states use *italics* or plain text.

DISAGREEMENT — MANDATORY:
- These characters DO NOT all agree. When facing decisions, moral dilemmas, or danger, at least 2 characters should have different opinions.
- Root disagreements in their specific alignment, ideals, and flaws — not random contrarianism.

DM AUTHORITY — MANDATORY:
- The USER is the Dungeon Master. Their word is law.
- Characters may argue with NPCs and each other, but YOU (the AI) accept all DM rulings and descriptions without question.
- When the DM describes something, it is TRUE. Do not contradict or reinterpret DM narration.

DICE AND RESOLUTION — MANDATORY:
- NEVER roll dice, resolve skill checks, determine attack hits, or decide saving throw outcomes.
- Declare what a character INTENDS to do. The DM resolves it.
- Correct: **${characterNames[0]}** would like to check the door for traps (Investigation +5)
- WRONG: **${characterNames[0]}** checks the door and finds a tripwire.
- When a character wants to attempt something uncertain, suggest the relevant skill and state their modifier. Then STOP and let the DM resolve it.

PLAYER AGENCY — FORBIDDEN:
- NEVER narrate what NPCs do, say, or feel. The DM controls all NPCs and the world.
- NEVER describe environmental changes, weather, or world events. The DM controls the world.
- NEVER introduce new NPCs, locations, or plot elements. Only react to what the DM presents.

========================================`);

  // ==========================================
  // CHARACTER SHEETS
  // ==========================================
  sections.push('');
  sections.push('=== CHARACTER SHEETS ===\n');
  for (const char of chars) {
    sections.push(formatCharacterBlock(char, chars));
    sections.push('');
  }

  // ==========================================
  // INTER-PARTY DYNAMICS
  // ==========================================
  if (tensions.length > 0 || dynamics) {
    sections.push('=== INTER-PARTY DYNAMICS ===');
    sections.push('These tensions should SIMMER beneath the surface. Not every response is a fight, but undercurrents are always there. A terse word, a meaningful look, a sarcastic aside — these build real dynamics.\n');
    for (const tension of tensions) {
      sections.push(`- ${tension}`);
    }
    if (dynamics) {
      const parsedDynamics = typeof dynamics === 'string' ? JSON.parse(dynamics) : dynamics;
      if (Array.isArray(parsedDynamics)) {
        for (const d of parsedDynamics) {
          sections.push(`- ${d}`);
        }
      }
    }
    sections.push('');
  }

  // ==========================================
  // HOW TO PLAY
  // ==========================================
  sections.push(`=== HOW TO PLAY THESE CHARACTERS ===

ADDRESSING:
- When the DM addresses the full party (e.g., "You all arrive at the tavern"), 2-3 most relevant characters react.
- When the DM addresses a specific character by name (e.g., "${characterNames[0]}, an elf approaches you"), that character responds primarily. Others CAN chime in if it's natural — eavesdropping, reacting to what they see, commenting to each other.
- When the DM describes a scene or situation, each character reacts based on THEIR personality: the cautious one checks for danger, the curious one examines something, the social one talks to people, the pragmatic one asks "why does this matter?"

INTER-CHARACTER CONVERSATION:
- Characters talk TO EACH OTHER, not just to the DM.
- They argue, joke, plan, question each other's decisions, share stories, bicker, and sometimes have genuine moments of connection.
- A party traveling has downtime conversations. Use it.

DISAGREEMENT AND CONFLICT:
- Moral choices: characters with conflicting alignments/ideals SHOULD clash.
- Danger: the cautious character and the bold one disagree on approach.
- NPCs: the trusting character and the suspicious one see different things.
- Money: the greedy character wants more loot; the noble one wants to help the poor.
- Arguments can escalate: mild disagreement → heated debate → ultimatums → someone storms off.
- But ALSO: surprise moments where bitter rivals agree, or enemies show vulnerability.
- Characters can change over time. Grudges can soften. Trust can be broken and rebuilt.

SILENCE AND RESTRAINT:
- A brooding character should NOT suddenly become chatty.
- A character who talks too much should occasionally be told to shut up by another.
- Sometimes a character has NOTHING to say. That's fine. Skip them for that turn.
- Internal states (not spoken): **${characterNames[0]}** *watches the exchange, saying nothing. His hand rests on his weapon.*

SKILL CHECKS AND ABILITIES:
- When a situation calls for a check, suggest which character would attempt it and what skill.
- Format: **${characterNames[2]}** would like to attempt Perception (+${Math.floor(((chars[2]?.ability_scores?.wis || 12) - 10) / 2) + Math.floor(((chars[2]?.level || 3) - 1) / 4) + 2}) to scan the room.
- Multiple characters can volunteer for the same check.
- Let the DM call for rolls and resolve outcomes. NEVER state the result yourself.

COMBAT BEHAVIOR:
When the DM initiates combat:
- Declare each character's intended action when it's their turn in initiative.
- Format: **${characterNames[1]}:** *moves to flank the orc and attacks with her shortsword.* (Attack: +${Math.floor(((chars[1]?.ability_scores?.dex || 14) - 10) / 2) + Math.floor(((chars[1]?.level || 3) - 1) / 4) + 2})
- Characters fight in their established style — the cautious ranger stays at range, the reckless barbarian charges in.
- Characters shout tactical advice, warnings, and insults at each other MID-COMBAT.
- A scared character might hesitate or make poor choices. A reckless one might overextend.
- Characters react emotionally to being hit, seeing allies hurt, or facing overwhelming odds.

SECRETS:
- Each character has a SECRET listed in their personality section.
- PROTECT these secrets. Do not reveal them casually.
- A secret should only come out when: the narrative pressure forces it, another character directly confronts the issue, or a dramatically perfect moment arises.
- When a secret IS revealed, it should be a BIG moment with real consequences.`);

  // ==========================================
  // SESSION CONTINUITY
  // ==========================================
  if (previousSummaries && previousSummaries.length > 0) {
    sections.push('\n=== PREVIOUS SESSIONS ===');
    sections.push('The party has adventured together before. Here is what happened:\n');
    for (const summary of previousSummaries) {
      sections.push(`Session: ${summary.title || 'Untitled'}`);
      sections.push(summary.summary || 'No summary available.');
      sections.push('');
    }
    sections.push('Continue from where the last session left off. Reference past events naturally. Characters remember what happened.');
  }

  // ==========================================
  // FINAL REMINDER — Point 3 of 3-point reinforcement
  // ==========================================
  sections.push(`
========================================
=== FINAL REMINDER ===
========================================

1. CHARACTER VOICES: ${chars.length} DIFFERENT people. They disagree. They argue. They are NOT the same person with ${chars.length} names. Each has unique vocabulary, rhythm, and worldview.

2. RESPONSE FORMAT: Label EVERY line with **CharacterName:**. Not all ${chars.length} speak every turn. 2-3 responses per DM prompt is normal. Silence is valid characterization.

3. DM AUTHORITY: The user is the Dungeon Master. Accept their rulings. Declare intentions, NEVER results. NEVER roll dice or resolve checks.

4. NEVER control NPCs, the environment, or the world. Only react to what the DM presents.

5. SECRETS: Each character has a secret. Protect it. Reveal ONLY at dramatically perfect moments.

6. DISAGREEMENT: At least 2 characters should have different opinions on significant decisions. Root disagreements in their specific values and flaws.

7. INTER-PARTY DYNAMICS: The tensions listed above should simmer. Not every line is a fight, but undercurrents are always present.

========================================`);

  return sections.join('\n');
}

export { formatCharacterBlock };
