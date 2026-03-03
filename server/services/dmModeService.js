/**
 * DM Mode Service — Marker detection and response parsing for AI-as-players mode.
 * Detects skill checks, attacks, spell casts from AI character declarations.
 */

/**
 * Detect [SKILL_CHECK: Character="Name" Skill="Perception" Modifier="+5"] markers
 */
export function detectSkillChecks(text) {
  if (!text) return [];
  const results = [];
  const pattern = /\[SKILL_CHECK:\s*Character="([^"]+)"\s*Skill="([^"]+)"\s*Modifier="([^"]+)"\]/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    results.push({
      character: match[1],
      skill: match[2],
      modifier: match[3]
    });
  }
  return results;
}

/**
 * Detect [ATTACK: Character="Name" Target="Goblin" Weapon="Longbow" AttackBonus="+7"] markers
 */
export function detectAttacks(text) {
  if (!text) return [];
  const results = [];
  const pattern = /\[ATTACK:\s*Character="([^"]+)"\s*Target="([^"]+)"\s*Weapon="([^"]+)"\s*AttackBonus="([^"]+)"\]/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    results.push({
      character: match[1],
      target: match[2],
      weapon: match[3],
      attackBonus: match[4]
    });
  }
  return results;
}

/**
 * Detect [CAST_SPELL: Character="Name" Spell="Healing Word" Target="Dorn" Level="1"] markers
 */
export function detectSpellCasts(text) {
  if (!text) return [];
  const results = [];
  const pattern = /\[CAST_SPELL:\s*Character="([^"]+)"\s*Spell="([^"]+)"\s*Target="([^"]+)"\s*Level="([^"]+)"\]/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    results.push({
      character: match[1],
      spell: match[2],
      target: match[3],
      level: parseInt(match[4])
    });
  }
  return results;
}

/**
 * Parse AI response into character segments for multi-character rendering.
 * Splits on **CharName:** or **CharName** patterns.
 * Returns array of { character, content }
 */
export function parseCharacterSegments(text) {
  if (!text) return [];

  const segments = [];
  // Match **Name:** or **Name** followed by content
  // This regex captures the character name and everything until the next **Name pattern or end
  const lines = text.split('\n');
  let currentChar = null;
  let currentContent = [];

  for (const line of lines) {
    // Check if line starts with a character label
    const charMatch = line.match(/^\*\*([^*]+?)(?::\*\*|\*\*:?)\s*(.*)/);
    if (charMatch) {
      // Save previous segment
      if (currentChar !== null) {
        segments.push({ character: currentChar, content: currentContent.join('\n').trim() });
      }
      currentChar = charMatch[1].trim();
      const rest = charMatch[2]?.trim() || '';
      currentContent = rest ? [rest] : [];
    } else if (currentChar !== null) {
      // Continue current character's content
      currentContent.push(line);
    } else {
      // Content before any character label (narration)
      if (line.trim()) {
        segments.push({ character: null, content: line.trim() });
      }
    }
  }

  // Save last segment
  if (currentChar !== null) {
    segments.push({ character: currentChar, content: currentContent.join('\n').trim() });
  }

  // If no character labels found at all, return the whole text as-is
  if (segments.length === 0 && text.trim()) {
    return [{ character: null, content: text.trim() }];
  }

  return segments;
}

/**
 * Detect [BOND_SHIFT: From="Name" To="Name" Warmth=+1 Trust=+1 Reason="reason"] markers.
 * Returns array of { from, to, warmthDelta, trustDelta, reason }
 */
export function detectBondShifts(text) {
  if (!text) return [];
  const shifts = [];
  const pattern = /\[BOND_SHIFT:\s*From="([^"]+)"\s+To="([^"]+)"(?:\s+Warmth=([+-]?\d+))?(?:\s+Trust=([+-]?\d+))?(?:\s+Reason="([^"]*)")?\]/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const warmthDelta = parseInt(match[3] || '0');
    const trustDelta = parseInt(match[4] || '0');
    if (warmthDelta === 0 && trustDelta === 0) continue; // skip no-ops
    shifts.push({
      from: match[1],
      to: match[2],
      warmthDelta,
      trustDelta,
      reason: match[5] || ''
    });
  }
  return shifts;
}

/**
 * Strip all DM Mode markers from narrative text for display.
 */
export function cleanDMModeNarrative(text) {
  if (!text) return text;
  return text
    .replace(/\[SKILL_CHECK:[^\]]*\]/gi, '')
    .replace(/\[ATTACK:[^\]]*\]/gi, '')
    .replace(/\[CAST_SPELL:[^\]]*\]/gi, '')
    .replace(/\[PARTY_ARGUMENT:[^\]]*\]/gi, '')
    .replace(/\[BOND_SHIFT:[^\]]*\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
