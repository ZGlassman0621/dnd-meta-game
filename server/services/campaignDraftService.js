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

// Collaborative mode: the DM talks WITH the player to figure out the campaign
// before drafting. Plain, conversational English — short replies, one question
// at a time. Deliberately NOT the literary draft voice (that's SYSTEM_PROMPT);
// this phase is a back-and-forth chat, so it must read like normal speech.
const CONVERSE_SYSTEM_PROMPT = `You are the Dungeon Master, helping a player figure out the campaign they want to play — by talking it through, the way two friends would plan a game at the table. You are NOT writing the campaign yet. Your whole job right now is to ask good questions and build on the answers until the player is ready to see a draft.

HOW TO TALK — this matters most:
- Plain, natural, conversational English. Talk like a person, not a novelist. No flowery prose, no poetic metaphors, no scene-painting like "I can already smell the brine" — just clear, friendly, everyday words.
- Keep it SHORT. A sentence or two reacting to what they said, then your question. Aim for under 50 words. Never write a paragraph when a line will do.
- Ask ONE question at a time (two at most, and only if they're tightly linked). Make it concrete and easy to answer — the kind of thing a friend would ask: "Who's the villain?" / "Happy ending or a bleak one?" / "Quick story or a long campaign?" / "What's the one scene you'd hate to miss?" / "Who's with you — any allies?"
- Build on what they've told you. Never re-ask something they've answered. If they hand you a lot at once, pick the most interesting thread and dig into that one.
- It's their game. Toss out a quick suggestion if it helps them decide, but let them make the calls.

Across the whole conversation (not all at once) you're trying to learn: the kind of story and tone, how dark or hopeful, how long it runs, who matters (allies, villains), the stakes, and what they're excited to actually do.

When you've got enough to build something good — or they say they're ready — just tell them plainly that they can draft it whenever they like (they'll click "Draft it").

Return ONLY your reply as plain text. No JSON, no markdown, no field lists, and no asterisks for emphasis.`;

function buildDraftUserPrompt({ prompt, subjectLine, seedLine, dials, priorDraft, nudge, userNote, conversation }) {
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
    const history = Array.isArray(conversation) ? conversation.filter(t => t && t.text) : [];
    if (history.length) {
      lines.push('You and the player have been shaping this campaign together. Your conversation:');
      history.forEach(t => lines.push(`${t.role === 'opus' ? 'You (Opus)' : 'Player'}: ${t.text}`));
      lines.push('');
      lines.push("Now author the first draft, weaving in everything you discussed — the player's answers are your brief.");
    } else {
      lines.push('What the player wants to play: "' + (prompt || 'Surprise me — find a story that fits.') + '"');
    }
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
/**
 * Resolve the subject context line — the character who walks into the story,
 * or world-first. Shared by draftCampaign and converseCampaign.
 */
async function resolveSubject(subject, characterId) {
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
  return { subjectLine, resolvedCharacterId };
}

export async function draftCampaign({ prompt, subject, seed, characterId, dials, priorDraft, nudge, userNote, conversation }) {
  if (!isClaudeAvailable()) {
    throw new Error('Claude API is required to author a campaign');
  }

  // Subject context — the character who walks into the story, or world-first.
  const { subjectLine, resolvedCharacterId } = await resolveSubject(subject, characterId);
  const seedLine = seed === 'surprise'
    ? "The player has asked you to surprise them — choose a story that fits the shape of their character."
    : (seed ? `The player is starting from a drafted seed: "${seed}".` : null);

  const userPrompt = buildDraftUserPrompt({ prompt, subjectLine, seedLine, dials, priorDraft, nudge, userNote, conversation });

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
 * Collaborative conversation turn (Begin Campaign, "Build it together" mode).
 * Opus discusses the campaign and asks questions — it does NOT draft yet.
 * Stateless: the client passes the running conversation each turn. Returns
 * { opusMessage } (prose). The player drafts from the conversation when ready
 * via draftCampaign({ conversation }).
 */
export async function converseCampaign({ prompt, conversation, subject, characterId, seed }) {
  if (!isClaudeAvailable()) {
    throw new Error('Claude API is required to author a campaign');
  }
  const { subjectLine, resolvedCharacterId } = await resolveSubject(subject, characterId);
  const seedLine = seed === 'surprise'
    ? 'The player asked you to surprise them — lead with your own questions to find a story that fits their character.'
    : null;

  const lines = [subjectLine];
  if (seedLine) lines.push(seedLine);
  lines.push('');
  const history = Array.isArray(conversation) ? conversation.filter(t => t && t.text) : [];
  if (history.length) {
    lines.push('Your collaboration so far:');
    history.forEach(t => lines.push(`${t.role === 'opus' ? 'You (Opus)' : 'Player'}: ${t.text}`));
    lines.push('');
    lines.push("React briefly to the player's latest message, then ask your next question — or, if they've signalled they're ready, tell them plainly they can draft it whenever they like.");
  } else {
    lines.push(`The player's opening idea: "${prompt || "they haven't said yet"}"`);
    lines.push('');
    lines.push('Open the conversation: a quick, friendly line about their idea, then your first question.');
  }

  const response = await loggedChat(
    { call_purpose: 'campaign_converse', prompt_builder: 'campaignDraftService', character_id: resolvedCharacterId },
    CONVERSE_SYSTEM_PROMPT,
    [{ role: 'user', content: lines.join('\n') }],
    3,
    'opus',
    1200,
    true // raw — we use the prose reply directly (no JSON)
  );
  const opusMessage = String(response || '').trim();
  if (!opusMessage) throw new Error('Opus could not reply — try again.');
  return { opusMessage };
}

/**
 * Commit a draft: create the real campaign, store the co-authored draft as its
 * plan, and link the character so the existing /start flow plays it.
 * Returns { campaignId }.
 */
export async function beginCampaign({ draft, characterId, userId, linesAndVeils }) {
  if (!draft || !draft.title) throw new Error('A campaign draft is required');
  if (!characterId) throw new Error('A character is required to begin a campaign');

  // Normalize the table's content boundaries (lines & veils) — each topic is
  // open (shown in full) / veil (off the page) / line (never appears).
  const boundaries = Array.isArray(linesAndVeils)
    ? linesAndVeils
        .filter(b => b && b.topic && ['open', 'veil', 'line'].includes(b.state))
        .map(b => ({ topic: String(b.topic), state: b.state }))
    : [];

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
    scope: draft.scope,
    // The table's content boundaries, co-authored on the Begin screen. Stored
    // on the plan so the campaign carries them (off-open topics are the ones
    // that matter); a future pass can surface these in the DM prompt.
    lines_and_veils: boundaries
  };
  await dbRun(
    'UPDATE campaigns SET campaign_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(plan), campaign.id]
  );

  await campaignService.assignCharacterToCampaign(characterId, campaign.id);

  return { campaignId: campaign.id, campaign };
}
