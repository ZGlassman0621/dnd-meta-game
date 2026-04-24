/**
 * NPC Mail/Message Service
 *
 * Generates NPC-initiated messages between sessions. NPCs with strong
 * relationships, active events, or unresolved promises send letters,
 * warnings, requests, or gifts to the player.
 *
 * Uses the existing narrative_queue for delivery — no new table needed.
 * Mail is queued during the living world tick and delivered at session start.
 */

import { dbAll, dbGet } from '../database.js';
import { addToQueue } from './narrativeQueueService.js';
import { chat as claudeChat } from './claude.js';
import { tryExtractLLMJson } from '../utils/llmJson.js';

// ============================================================
// MAIL TYPES
// ============================================================

export const MAIL_TYPES = {
  npc_letter: 'General letter (gossip, thanks, update)',
  npc_warning: 'Urgent warning (world event, danger)',
  npc_request: 'Favor request (fetch item, visit, help)',
  npc_gift: 'Gift with letter (high disposition/trust)',
  npc_rumor: 'Shares a rumor or plot hook'
};

// ============================================================
// TEMPLATE FALLBACKS (when AI unavailable)
// ============================================================

const MAIL_TEMPLATES = {
  npc_letter: [
    "{name} writes: \"I hope this finds you well. Things have been {mood} in {location} lately. Do visit when you can.\"",
    "{name} sends word: \"I've been thinking about our last meeting. {location} isn't the same without adventurers passing through.\"",
    "{name} pens a brief note: \"Just wanted you to know — your deeds haven't gone unnoticed around {location}.\""
  ],
  npc_warning: [
    "{name} sends an urgent note: \"Be careful if you travel near {location}. I've heard troubling things.\"",
    "{name} writes hastily: \"Something is wrong in {location}. I thought you should know before it's too late.\""
  ],
  npc_request: [
    "{name} writes: \"I hate to ask, but I could use your help with something. Come see me in {location} when you have time.\"",
    "{name} sends a request: \"There's a matter I can't handle alone. If you're near {location}, I'd be grateful for your assistance.\""
  ],
  npc_gift: [
    "{name} sends a package with a note: \"Found this and thought of you. Consider it a token of my appreciation.\"",
    "{name} writes: \"I came across something you might find useful on your travels. Please accept this gift.\""
  ],
  npc_rumor: [
    "{name} passes along a rumor: \"I've heard whispers about something unusual. Might be worth investigating.\"",
    "{name} shares some gossip: \"You didn't hear this from me, but there's talk of strange happenings nearby.\""
  ]
};

// ============================================================
// CANDIDATE SCORING (exported for testing)
// ============================================================

/**
 * Score an NPC on likelihood of sending mail.
 * Higher score = more likely to send.
 *
 * @param {object} rel - NPC relationship with NPC details joined
 * @param {number} currentGameDay - Current game day
 * @param {object} options - { hasWorldEventEffect, hasPromisesOrDebts }
 * @returns {number} Score (threshold >= 8 to be a candidate)
 */
export function scoreMailCandidate(rel, currentGameDay, options = {}) {
  let score = 0;

  // Disposition: 0-10 points (disposition ranges -100 to 100)
  score += Math.max(0, Math.floor(rel.disposition / 10));

  // Trust: 0-5 points
  score += Math.max(0, Math.floor(rel.trust_level / 20));

  // Absence bonus: NPC misses the player
  if (currentGameDay && rel.last_interaction_game_day) {
    const daysSince = currentGameDay - rel.last_interaction_game_day;
    if (daysSince >= 10) score += 5;
    if (daysSince < 3) score -= 3; // Too recent
  }

  // World event effect bonus
  if (options.hasWorldEventEffect) score += 3;

  // Unresolved promises/debts bonus
  if (options.hasPromisesOrDebts) score += 4;

  // Hostile NPCs don't send friendly mail
  if (rel.disposition < -20) score -= 10;

  return score;
}

export const MAIL_SCORE_THRESHOLD = 8;

// ============================================================
// MAIL TYPE SELECTION
// ============================================================

/**
 * Pick the most appropriate mail type based on NPC state.
 */
export function pickMailType(rel, options = {}) {
  if (options.hasWorldEventEffect) return 'npc_warning';
  if (options.hasPromisesOrDebts) return 'npc_request';
  if (rel.disposition >= 60 && rel.trust_level >= 40) return 'npc_gift';
  if (rel.trust_level >= 30) return 'npc_rumor';
  return 'npc_letter';
}

// ============================================================
// CONTENT GENERATION
// ============================================================

/**
 * Generate mail content using AI or template fallback.
 */
export async function generateMailContent(npc, rel, character, campaign, mailType) {
  // Try AI generation
  try {
    const prompt = buildMailPrompt(npc, rel, character, mailType);
    const messages = [{ role: 'user', content: prompt }];
    const response = await claudeChat(null, messages, 1, 'opus');

    if (response) {
      const text = typeof response === 'string' ? response : response.content?.[0]?.text || response.content || '';
      const parsed = tryExtractLLMJson(text);
      if (parsed) {
        return {
          subject: parsed.subject || `Letter from ${npc.name}`,
          body: parsed.body || `${npc.name} sends their regards.`,
          tone: parsed.tone || 'warm',
          gift_item: parsed.gift_item || null,
          requires_response: parsed.requires_response || false
        };
      }
    }
  } catch (e) {
    console.log('[NPC Mail] AI generation failed, using template fallback:', e.message);
  }

  // Template fallback
  return generateFromTemplate(npc, rel, mailType);
}

function buildMailPrompt(npc, rel, character, mailType) {
  const charName = character.name || 'the adventurer';
  const voiceHint = npc.voice || npc.personality_trait_1 || `a ${npc.occupation || 'local'}`;
  const dispositionLabel = rel.disposition_label || 'neutral';

  return `NPC ${npc.name} (${npc.race || 'human'}, ${npc.occupation || 'commoner'}) is writing to the player character ${charName}.
Relationship: disposition ${rel.disposition} (${dispositionLabel}), trust ${rel.trust_level}, met ${rel.times_met} times.
Mail type: ${mailType}
Tone guidance: ${voiceHint}

Generate a short in-character letter (2-4 sentences) as JSON:
{
  "subject": "Brief subject line",
  "body": "The letter text, in the NPC's voice",
  "tone": "warm|formal|urgent|nervous|cryptic",
  "gift_item": ${mailType === 'npc_gift' ? '"a small, thematic item name"' : 'null'},
  "requires_response": ${mailType === 'npc_request' ? 'true' : 'false'}
}`;
}

/**
 * Generate mail content from templates (no AI needed).
 */
export function generateFromTemplate(npc, rel, mailType) {
  const templates = MAIL_TEMPLATES[mailType] || MAIL_TEMPLATES.npc_letter;
  const template = templates[Math.floor(Math.random() * templates.length)];

  const moodWords = ['quiet', 'busy', 'unsettling', 'peaceful', 'tense', 'lively'];
  const mood = moodWords[Math.floor(Math.random() * moodWords.length)];

  const body = template
    .replace(/{name}/g, npc.name || 'An acquaintance')
    .replace(/{location}/g, npc.current_location || 'town')
    .replace(/{mood}/g, mood)
    .replace(/{gossip}/g, 'strange things are happening around here')
    .replace(/{threat}/g, 'something dangerous');

  return {
    subject: `Letter from ${npc.name || 'an acquaintance'}`,
    body,
    tone: mailType === 'npc_warning' ? 'urgent' : 'warm',
    gift_item: mailType === 'npc_gift' ? 'A small token of appreciation' : null,
    requires_response: mailType === 'npc_request'
  };
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * Generate NPC mail for a campaign during the living world tick.
 * Scores candidates, picks 0-2 senders, generates content, queues delivery.
 *
 * @param {number} campaignId - Campaign ID
 * @param {number} characterId - Character ID
 * @param {number} currentGameDay - Current game day
 * @returns {object[]} Array of mail items queued
 */
export async function generateNpcMail(campaignId, characterId, currentGameDay) {
  if (!characterId || !currentGameDay) return [];

  // Get NPC relationships with details
  const relationships = await dbAll(`
    SELECT r.*, n.name, n.race, n.occupation, n.current_location, n.lifecycle_status,
           n.voice, n.personality_trait_1
    FROM npc_relationships r
    JOIN npcs n ON r.npc_id = n.id
    WHERE r.character_id = ?
      AND n.lifecycle_status = 'alive'
    ORDER BY r.disposition DESC
  `, [characterId]);

  if (relationships.length === 0) return [];

  // Check for active world event effects on NPCs
  const eventEffects = await dbAll(`
    SELECT DISTINCT ee.target_id as npc_id
    FROM event_effects ee
    JOIN world_events we ON ee.event_id = we.id
    WHERE we.campaign_id = ? AND ee.target_type = 'npc' AND ee.status = 'active'
  `, [campaignId]);
  const npcWithEffects = new Set(eventEffects.map(e => e.npc_id));

  // Score candidates
  const candidates = [];
  for (const rel of relationships) {
    const hasPromises = ((rel.promises_made ? JSON.parse(rel.promises_made) : [])
      .some(p => p.status === 'pending')) ||
      ((rel.debts_owed ? JSON.parse(rel.debts_owed) : [])
      .some(d => d.status === 'outstanding'));

    const score = scoreMailCandidate(rel, currentGameDay, {
      hasWorldEventEffect: npcWithEffects.has(rel.npc_id),
      hasPromisesOrDebts: hasPromises
    });

    if (score >= MAIL_SCORE_THRESHOLD) {
      candidates.push({ rel, score, hasWorldEventEffect: npcWithEffects.has(rel.npc_id), hasPromises });
    }
  }

  if (candidates.length === 0) return [];

  // Sort by score descending, pick top 0-2
  candidates.sort((a, b) => b.score - a.score);
  const maxMail = Math.min(2, candidates.length);
  // Random chance: sometimes 0 mail even if candidates exist (30% chance of no mail)
  const mailCount = Math.random() < 0.3 ? 0 : Math.min(maxMail, Math.ceil(Math.random() * 2));
  const selected = candidates.slice(0, mailCount);

  // Generate and queue mail
  const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
  const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
  const queued = [];

  for (const { rel, hasWorldEventEffect, hasPromises } of selected) {
    const npc = {
      name: rel.name, race: rel.race, occupation: rel.occupation,
      current_location: rel.current_location, voice: rel.voice,
      personality_trait_1: rel.personality_trait_1
    };

    const mailType = pickMailType(rel, { hasWorldEventEffect, hasPromisesOrDebts: hasPromises });
    const content = await generateMailContent(npc, rel, character, campaign, mailType);

    // Queue via narrative queue
    const priority = mailType === 'npc_warning' ? 'high'
      : mailType === 'npc_request' ? 'normal'
      : 'low';

    const item = await addToQueue({
      campaign_id: campaignId,
      character_id: characterId,
      event_type: mailType,
      priority,
      title: content.subject,
      description: content.body,
      context: {
        npc_name: npc.name,
        npc_id: rel.npc_id,
        tone: content.tone,
        gift_item: content.gift_item,
        requires_response: content.requires_response,
        mail_type: mailType
      },
      related_npc_id: rel.npc_id
    });

    queued.push(item);
  }

  return queued;
}
