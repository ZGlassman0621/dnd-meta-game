/**
 * Campaign Draft Service (Begin Campaign atelier, 2026-06-06).
 *
 * Powers the conversational "Begin a new Campaign" screen, where Opus authors
 * the world while the player sets the mood. Distinct from campaignPlanService
 * (which generates the full canonical plan for an EXISTING campaign): this
 * generates a lightweight, stateless DRAFT from a free-text prompt + dials,
 * refines it on nudges, and — when the player commits — creates the real
 * campaign with the co-authored draft stored as its plan, then links the
 * character so the existing /start flow plays it.
 */

import { isClaudeAvailable } from './claude.js';
import { loggedChat } from './aiCallLogger.js';
import { extractLLMJson } from '../utils/llmJson.js';
import { dbGet, dbRun } from '../database.js';
import * as campaignService from './campaignService.js';

const SCOPE_LABEL = { one: 'a tight one-shot', arc: 'a short arc (a handful of sessions)', open: 'an open-ended campaign' };
const NUDGE_DIRECTION = {
  darker: 'Make it darker and grimmer — heavier consequences, a colder world, morally harder choices.',
  hopeful: 'Make it more hopeful — warmth amid hardship, the possibility of grace, people worth saving.',
  stakes: 'Raise the stakes — widen the consequences, make the central threat more urgent and far-reaching.',
  intimate: 'Keep it intimate — smaller in scope, personal and character-driven rather than world-shaking.',
  oneshot: 'Reshape this into a tight, self-contained one-shot that resolves in a single sitting.',
  regen: 'Take a completely fresh angle on the same prompt — surprise the player with a different premise.'
};

const SYSTEM_PROMPT = `You are Opus, an AI Dungeon Master authoring a Dungeons & Dragons 5e campaign together with a player. The player gives you a mood, a place, or a fragment of an idea, and you build the world around it: its premise, its setting, the people in it, and the secret truth at its centre.

Your VOICE is literary and warm — manuscript prose, never chat-bot filler. You address the player directly and evocatively. Emphasis goes on the *world you are building together*.

You always return a single JSON object and NOTHING else (no markdown fences, no commentary). Schema:
{
  "title": "evocative campaign title (3-6 words)",
  "premise": "2-3 sentences of prose describing the campaign's premise — what it is about, the central tension",
  "openingScene": "3-4 sentences of vivid, sensory read-aloud prose for the very first moment of play, in second person",
  "region": "the name of the region/place the campaign is set in",
  "setting": { "name": "setting name", "sub": "a short evocative descriptor, e.g. 'high passes · a snowbound monastery road'" },
  "locations": ["3-5 distinct named locations within the region"],
  "npcs": [ { "name": "NPC name", "role": "one-line role/relationship" } ],
  "tones": ["2-3 tone words, e.g. Mystery, Survival, Quiet dread"],
  "scope": "one | arc | open",
  "hiddenTruth": "the secret truth at the campaign's centre — DM-only, the player will not see this directly",
  "opusMessage": "2-4 sentences of warm manuscript prose addressed to the player, presenting this draft as a living thing you are shaping together. Use *asterisks* around a few words for gentle emphasis."
}`;

function buildDraftUserPrompt({ prompt, subjectLine, seedLine, dials, priorDraft, nudge, userNote }) {
  const lines = [];
  if (priorDraft) {
    lines.push('You have already drafted this campaign. Here is the current draft (JSON):');
    lines.push(JSON.stringify({
      title: priorDraft.title, premise: priorDraft.premise, region: priorDraft.region,
      setting: priorDraft.setting, locations: priorDraft.locations, npcs: priorDraft.npcs,
      tones: priorDraft.tones, scope: priorDraft.scope, hiddenTruth: priorDraft.hiddenTruth
    }));
    lines.push('');
    if (nudge && NUDGE_DIRECTION[nudge]) {
      lines.push('The player nudges the draft: ' + NUDGE_DIRECTION[nudge]);
      lines.push('Revise the draft accordingly while keeping what still works. Keep the same title unless the change demands a new one.');
    }
    if (userNote) {
      lines.push('The player says: "' + userNote + '"');
      lines.push('Revise the draft to honour this, keeping continuity with what already works.');
    }
  } else {
    lines.push(subjectLine);
    if (seedLine) lines.push(seedLine);
    lines.push('');
    lines.push('What the player wants to play: "' + (prompt || 'Surprise me — find a story that fits.') + '"');
    if (dials?.scope) lines.push('Scope: ' + (SCOPE_LABEL[dials.scope] || dials.scope) + '.');
    if (dials?.tones?.length) lines.push('Tone leanings: ' + dials.tones.join(', ') + '.');
    lines.push('');
    lines.push('Author the first draft of this campaign now.');
  }
  return lines.join('\n');
}

/**
 * Generate (or refine) a campaign draft. Stateless — no DB write.
 */
export async function draftCampaign({ prompt, subject, seed, characterId, dials, priorDraft, nudge, userNote }) {
  if (!isClaudeAvailable()) {
    throw new Error('Claude API is required to author a campaign');
  }

  // Subject context — the character who walks into the story, or world-first.
  let subjectLine = 'The player is building the world first; a hero will be chosen later.';
  let resolvedCharacterId = null;
  if (subject && subject !== 'world' && characterId) {
    const c = await dbGet(
      'SELECT id, name, race, class, level, alignment, backstory FROM characters WHERE id = ?',
      [characterId]
    );
    if (c) {
      resolvedCharacterId = c.id;
      const bits = [c.name, c.race, c.class, c.level ? `level ${c.level}` : null].filter(Boolean).join(', ');
      subjectLine = `The hero who walks into this story: ${bits}.`;
      if (c.backstory) subjectLine += ` Their backstory: ${String(c.backstory).slice(0, 600)}`;
    }
  }
  const seedLine = seed === 'surprise'
    ? "The player has asked you to surprise them — choose a story that fits the shape of their character."
    : (seed ? `The player is starting from a drafted seed: "${seed}".` : null);

  const userPrompt = buildDraftUserPrompt({ prompt, subjectLine, seedLine, dials, priorDraft, nudge, userNote });

  const response = await loggedChat(
    { call_purpose: 'campaign_draft', prompt_builder: 'campaignDraftService', character_id: resolvedCharacterId },
    SYSTEM_PROMPT,
    [{ role: 'user', content: userPrompt }],
    3,
    'opus',
    3000,
    true // raw — we extract JSON ourselves
  );

  const draft = extractLLMJson(response);
  if (!draft || !draft.title) {
    throw new Error('Could not author a campaign draft from that — try rephrasing.');
  }
  // Normalize shapes defensively.
  draft.locations = Array.isArray(draft.locations) ? draft.locations.filter(Boolean) : [];
  draft.npcs = Array.isArray(draft.npcs) ? draft.npcs.filter(n => n && n.name) : [];
  draft.tones = Array.isArray(draft.tones) ? draft.tones.filter(Boolean) : [];
  if (!['one', 'arc', 'open'].includes(draft.scope)) draft.scope = dials?.scope || 'arc';
  if (!draft.setting || typeof draft.setting !== 'object') draft.setting = { name: draft.region || 'Unknown', sub: '' };
  return draft;
}

/**
 * Commit a draft: create the real campaign, store the co-authored draft as its
 * plan, and link the character so the existing /start flow plays it.
 * Returns { campaignId }.
 */
export async function beginCampaign({ draft, characterId, userId }) {
  if (!draft || !draft.title) throw new Error('A campaign draft is required');
  if (!characterId) throw new Error('A character is required to begin a campaign');

  const campaign = await campaignService.createCampaign({
    name: draft.title,
    description: draft.premise || '',
    setting: draft.setting?.name || draft.region || '',
    tone: (draft.tones || []).join(', '),
    starting_location: draft.setting?.name || draft.region || '',
    user_id: userId
  });

  // Store the co-authored draft as the campaign plan, in a shape the session
  // prompt builder + Campaign Plan screen can read.
  const plan = {
    generated_from: 'begin_campaign_atelier',
    premise: draft.premise,
    opening_scene: draft.openingScene,
    region: draft.region,
    setting: draft.setting,
    main_quest: { title: draft.title, description: draft.premise, hidden_truth: draft.hiddenTruth },
    hidden_truth: draft.hiddenTruth,
    locations: (draft.locations || []).map(name => (typeof name === 'string' ? { name } : name)),
    npcs: draft.npcs || [],
    factions: [],
    side_quests: [],
    tone: (draft.tones || []).join(', '),
    scope: draft.scope
  };
  await dbRun(
    'UPDATE campaigns SET campaign_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(plan), campaign.id]
  );

  await campaignService.assignCharacterToCampaign(characterId, campaign.id);

  return { campaignId: campaign.id, campaign };
}
