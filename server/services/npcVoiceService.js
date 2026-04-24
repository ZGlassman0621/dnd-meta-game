/**
 * NPC Voice Palette Service
 *
 * Generates structured voice hints for NPCs so the DM prompt can surface
 * age-appropriate, register-specific dialogue cues. Uses Opus (high-quality,
 * one-time cost per NPC) rather than Sonnet — the palette is reused across
 * every future conversation with this NPC, so the quality difference matters.
 *
 * Triggers:
 *   IMPORTANT_NOW: generated at NPC creation time when the NPC's role is
 *     obviously going to get extensive dialogue time (companion, quest-giver,
 *     allied campaign-plan NPC, faction-leader).
 *   MINOR_LATER: generated on-demand once the NPC crosses 3 player interactions.
 *     A chance encounter stays voice-paletteless; a recurring contact gets one.
 *
 * Cost model: Opus call per palette, ~400-600 output tokens + ~600 prompt
 * tokens. We cache the result on `npcs.voice_palette` as JSON and never
 * regenerate unless the NPC is substantially enriched (new age, occupation,
 * backstory — none of which happen in normal play).
 *
 * Palette shape (JSON object stored as TEXT):
 *   {
 *     age_descriptor: string,   // "child (9)" | "elder (60s)" | ...
 *     register: string,         // "street slang, clipped" | "formal, measured"
 *     speech_patterns: string[],// ["trails off mid-thought", "uses 'and then' often"]
 *     mannerisms: string[],     // ["scratches arm when nervous"]
 *     vocabulary: string,       // "limited (kid-appropriate)" | "educated (scholarly)"
 *     forbid: string[]          // things this NPC would never say
 *   }
 */

import { dbGet, dbRun } from '../database.js';
import * as claude from './claude.js';
import { tryExtractLLMJson } from '../utils/llmJson.js';

// Occupations / relationship-types that warrant immediate palette generation.
// The NPC will see enough dialogue time that a bespoke voice pays off.
const IMPORTANT_ROLES = new Set([
  'companion', 'ally', 'quest_giver', 'mentor', 'patron', 'faction_leader',
  'noble', 'king', 'queen', 'duke', 'archon', 'high_priest', 'arch_mage',
  'villain', 'antagonist', 'rival'
]);

const IMPORTANT_OCCUPATION_KEYWORDS = [
  'bard', 'knight', 'captain', 'commander', 'general', 'baron', 'lord', 'lady',
  'priest', 'cleric', 'wizard', 'sage', 'innkeeper', 'blacksmith', 'merchant',
  'sheriff', 'warden', 'spymaster', 'scholar', 'guildmaster'
];

/**
 * Heuristic: is this NPC important enough to generate a palette at creation?
 */
export function isNpcImportant(npc) {
  if (!npc) return false;
  const rel = (npc.relationship_to_party || '').toLowerCase();
  if (IMPORTANT_ROLES.has(rel)) return true;

  const occ = (npc.occupation || '').toLowerCase();
  if (IMPORTANT_OCCUPATION_KEYWORDS.some(kw => occ.includes(kw))) return true;

  // Campaign-plan NPCs are always important (they have a narrative role)
  if (npc.is_campaign_plan_npc || npc.campaign_plan_id) return true;

  // NPCs flagged as companions via availability
  if ((npc.campaign_availability || '').toLowerCase() === 'companion') return true;

  return false;
}

/**
 * Build the Opus prompt for voice palette generation.
 * Kept compact (~600 tokens) so the per-NPC cost stays low.
 */
function buildVoicePrompt(npc) {
  const lines = [
    'Generate a voice palette for an NPC in a D&D 5e campaign.',
    '',
    'NPC:',
    `  Name: ${npc.name || 'Unknown'}`,
    `  Race: ${npc.race || 'Human'}`,
    `  Gender: ${npc.gender || 'unspecified'}`,
  ];
  if (npc.age) lines.push(`  Age: ${npc.age}`);
  if (npc.occupation) lines.push(`  Occupation: ${npc.occupation}`);
  if (npc.personality_trait_1) lines.push(`  Personality: ${npc.personality_trait_1}${npc.personality_trait_2 ? `, ${npc.personality_trait_2}` : ''}`);
  if (npc.motivation) lines.push(`  Motivation: ${npc.motivation}`);
  if (npc.background_notes) lines.push(`  Notes: ${npc.background_notes}`);

  lines.push('');
  lines.push('Produce a JSON object with these fields, nothing else:');
  lines.push('');
  lines.push('{');
  lines.push('  "age_descriptor": "short phrase — e.g. \\"child (9)\\", \\"young adult (mid-20s)\\", \\"elder (60s)\\", \\"ageless\\"",');
  lines.push('  "register": "how they speak — e.g. \\"street slang, clipped sentences\\", \\"formal, measured, slight archaism\\", \\"trade dialect, direct\\"",');
  lines.push('  "speech_patterns": ["2-4 short phrases describing speech tics, e.g. \\"trails off mid-thought\\", \\"overuses \'and then\'\\", \\"tags questions with \'aye?\'\\""],');
  lines.push('  "mannerisms": ["2-3 short phrases describing physical tells, e.g. \\"scratches arm when nervous\\", \\"glances away before lying\\""],');
  lines.push('  "vocabulary": "short phrase — e.g. \\"limited (kid-appropriate)\\", \\"educated (scholarly)\\", \\"dockside trade\\", \\"courtly\\"",');
  lines.push('  "forbid": ["2-4 things this NPC would NEVER say — e.g. \\"long compound sentences\\", \\"Latin phrases\\", \\"abstract philosophy\\""]');
  lines.push('}');
  lines.push('');
  lines.push('Guidelines:');
  lines.push('- Match register to age + occupation. A 9-year-old should have short sentences, present tense, and kid-logic. A scholar should have long clauses and references to books.');
  lines.push('- Be specific, not generic. "Thoughtful" is useless; "pauses before answering, speaks in half-sentences" is useful.');
  lines.push('- Keep each field short. Speech patterns and mannerisms should be 2-5 words each.');
  lines.push('- No name reuse in the voice — describe speech patterns, not the NPC\'s identity.');
  lines.push('- Return only the JSON. No commentary.');

  return lines.join('\n');
}

/**
 * Generate and persist a voice palette for the given NPC.
 * Silent-fail on error: a missing palette just means the DM prompt falls
 * back to generic voice guidance — no gameplay break.
 *
 * @param {number} npcId
 * @returns {Promise<object|null>} parsed palette, or null on failure
 */
export async function generateVoicePalette(npcId) {
  if (!npcId) return null;
  try {
    const npc = await dbGet('SELECT * FROM npcs WHERE id = ?', [npcId]);
    if (!npc) return null;

    // Skip if we already have a recent palette
    if (npc.voice_palette && npc.voice_palette.trim()) {
      try {
        return JSON.parse(npc.voice_palette);
      } catch {
        // fall through and regenerate if the cached value is malformed
      }
    }

    if (!claude.isClaudeAvailable()) {
      // Ollama fallback is possible but the quality is usually too low for
      // this specific task. Skip for now — Opus is always preferred.
      return null;
    }

    const systemPrompt = 'You are a precise assistant that outputs JSON only, with no explanations.';
    const userPrompt = buildVoicePrompt(npc);

    const response = await claude.chat(
      systemPrompt,
      [{ role: 'user', content: userPrompt }],
      2,      // retries
      'opus', // force Opus for quality
      800     // maxTokens
    );

    const text = typeof response === 'string' ? response : (response?.content || '');
    const palette = tryExtractLLMJson(text);
    if (!palette) {
      console.warn(`[voicePalette] Could not extract JSON for NPC ${npcId}`);
      return null;
    }

    // Basic shape validation — require at least register + speech_patterns
    if (!palette.register || !Array.isArray(palette.speech_patterns)) {
      console.warn(`[voicePalette] Malformed palette for NPC ${npcId} — missing required fields`);
      return null;
    }

    await dbRun(
      `UPDATE npcs
       SET voice_palette = ?, voice_palette_generated_at = datetime('now')
       WHERE id = ?`,
      [JSON.stringify(palette), npcId]
    );

    return palette;
  } catch (err) {
    console.warn(`[voicePalette] Generation failed for NPC ${npcId}:`, err.message);
    return null;
  }
}

/**
 * Called at NPC-creation time. Generates a palette immediately for important
 * NPCs; skips minor NPCs (they'll generate after 3 interactions if they
 * become recurring). Runs asynchronously by default — don't block creation.
 *
 * @param {number} npcId
 * @param {object} [options]
 * @param {boolean} [options.force=false] force generation regardless of role
 * @param {boolean} [options.await=false] await the result; default fire-and-forget
 */
export async function generateVoicePaletteIfImportant(npcId, options = {}) {
  if (!npcId) return null;
  const npc = await dbGet('SELECT * FROM npcs WHERE id = ?', [npcId]);
  if (!npc) return null;

  const shouldGenerate = options.force || isNpcImportant(npc);
  if (!shouldGenerate) return null;

  if (options.await) {
    return generateVoicePalette(npcId);
  }
  // Fire-and-forget so NPC creation doesn't block on the API call
  generateVoicePalette(npcId).catch(err => {
    console.warn(`[voicePalette] Background generation failed for NPC ${npcId}:`, err.message);
  });
  return null;
}

/**
 * Called from `recordInteraction` after incrementing the counter. Triggers
 * auto-generation exactly once, when the NPC crosses the threshold and
 * doesn't already have a palette.
 *
 * @param {number} npcId
 * @param {number} newInteractionCount
 * @param {number} [threshold=3]
 */
export async function maybeGenerateOnInteraction(npcId, newInteractionCount, threshold = 3) {
  if (!npcId) return;
  if (newInteractionCount < threshold) return;

  try {
    const npc = await dbGet(
      'SELECT voice_palette FROM npcs WHERE id = ?',
      [npcId]
    );
    if (!npc) return;
    if (npc.voice_palette && npc.voice_palette.trim()) return; // already have one

    // Fire-and-forget
    generateVoicePalette(npcId).catch(err => {
      console.warn(`[voicePalette] Threshold-triggered generation failed for NPC ${npcId}:`, err.message);
    });
  } catch (err) {
    console.warn(`[voicePalette] maybeGenerateOnInteraction failed for NPC ${npcId}:`, err.message);
  }
}

/**
 * Format a palette as a compact prompt-friendly multi-line string.
 * Called from dmPromptBuilder.formatCustomNpcs when rendering per-NPC details.
 * Returns null if palette is missing/empty so the caller can omit the line.
 *
 * Example output:
 *   Voice: child (9), street slang, clipped sentences.
 *   Speech: trails off mid-thought, overuses "and then", present tense.
 *   Mannerisms: scratches arm when nervous, glances at alley mouth.
 *   Never: long compound sentences, abstract philosophy, formal grammar.
 */
export function formatVoicePaletteForPrompt(paletteJson) {
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
  if (voicePieces.length > 0) {
    lines.push(`  Voice: ${voicePieces.join(', ')}.`);
  }
  if (Array.isArray(palette.speech_patterns) && palette.speech_patterns.length > 0) {
    lines.push(`  Speech: ${palette.speech_patterns.join(', ')}.`);
  }
  if (Array.isArray(palette.mannerisms) && palette.mannerisms.length > 0) {
    lines.push(`  Mannerisms: ${palette.mannerisms.join(', ')}.`);
  }
  if (palette.vocabulary) {
    lines.push(`  Vocabulary: ${palette.vocabulary}.`);
  }
  if (Array.isArray(palette.forbid) && palette.forbid.length > 0) {
    lines.push(`  Never says: ${palette.forbid.join(', ')}.`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}
