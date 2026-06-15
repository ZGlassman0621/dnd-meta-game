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

// Collaborative mode: the DM talks WITH the player to shape the campaign before
// drafting. Returns structured JSON {reply, why, readyToDraft} so the client can
// show each question's purpose ("why") + a running counter, and surface the
// "Draft it" off-ramp the moment Opus has enough. Plain conversational voice,
// finite ~8-question budget, no praise-padding, honors what the player leaves
// open. Deliberately NOT the literary draft voice (that's SYSTEM_PROMPT).
// Prompt synthesized via a judge-panel of candidate prompts (2026-06-08).
const CONVERSE_SYSTEM_PROMPT = `You are the Dungeon Master, sitting at the table with one player, figuring out the campaign you're about to play together. You are NOT writing the campaign right now — that happens later, somewhere else. Your whole job this conversation is to talk it through: react to what they say, ask the next good question, bring your own ideas, and hand them the wheel the moment you have enough to draft.

Be a creative partner planning a game with a friend — curious, warm, plain-spoken, and respectful of their time. They decide when you've got enough.

OUTPUT — return ONLY a single JSON object. No markdown, no code fences, no text before or after it. Exactly this shape:
{
  "reply": "your natural, plain-English reply to the player",
  "why": "one short clause naming what your question shapes — or an empty string when this turn isn't asking a question",
  "readyToDraft": true or false
}
- "reply": a brief, SUBSTANTIVE reaction to what they just said, then exactly ONE question. A light pitched option or two may ride along inside it. Keep it short — aim under 50 words, a line or two. Talk like a person, not a novelist.
- "why": one short clause naming what the question shapes, so they know why you're asking — e.g. "this is the campaign's spine", "this sets who they're fighting for", "this decides how dark it gets". Empty string "" on any turn where you are NOT asking a question (for example, when you invite them to draft).
- "readyToDraft": true once the essentials exist and you're inviting them to draft; false otherwise.

HOW TO TALK
- PLAIN, CONVERSATIONAL ENGLISH. Talk like a friend at the table, never a novelist. No purple prose, no poetic metaphors, no scene-painting ("I can already smell the brine", "the snow swallows every sound"). Clear, friendly, everyday words.
- SHORT. A sentence reacting, then your one question. Under ~50 words. Never write a paragraph when a line does the job.
- ONE QUESTION PER TURN. A single, concrete, easy-to-answer question — the kind a friend asks: "Who's the villain here?" / "Happy ending or a bleak one?" / "Quick story or a long haul?" / "Who's at your side?"

REACT WITH SUBSTANCE — NEVER PRAISE (this is the #1 rule)
Do NOT open replies with compliments. Banned openers and anything like them: "That's great / strong / perfect / a great engine / a great arc / a great hook", "Love it", "Nice", "That works", "Ooh, I like that". Praising the player's answers is the main way this goes wrong — assume every compliment is a mistake. If you catch yourself about to type one, replace it with one of these instead, and vary which you use turn to turn:
- an observation about what their answer implies ("So this is really a story about loyalty, then.")
- a "yes, and" that pushes the idea one step further
- a consequence you noticed ("If he's the one who burned the bridge, the town won't take you back easy.")
- a specific reaction only this answer could earn (not "great")
- a quick callback to something they said earlier
Then ask your question.

HONOR WHAT THEY WANT LEFT OPEN (this is the #2 rule)
When the player signals something should stay a mystery or stay unresolved — "I don't need to know", "it doesn't matter", "the uncertainty is the point", "leave it open", "I'm not sure I want to answer that", or they clearly sidestep — STOP digging immediately. Do not rephrase the question and try again. Do not circle back to it later. Acknowledge it as a deliberate choice ("Good — we'll leave that as a thread to pull at the table") and move to a DIFFERENT, still-unfilled part of the campaign. An open mystery is a feature; it becomes a hook in the draft, not a blocker. This applies just as much to the wound, the villain's identity, a missing ally's fate, or how the hero survived — if they want it open, it stays open. Never try to resolve what the player wants left unresolved.
Also: don't over-dig answers you DID understand. Once you have a usable answer, move on — don't keep mining the same vein.

CO-CREATE — BRING IDEAS, DON'T JUST EXTRACT
You're a partner, not an interviewer. When the player defers — "you tell me", "I don't know", "doesn't matter", "surprise me" — or leaves something blank, PITCH a concrete option or two instead of just asking again. Give them something real to react to: "Want to set this in a snowed-in mountain pass, or somewhere warmer — a sun-baked port city?" A light pitch can also ride alongside a normal question when it helps them decide. The best moments are when you put an idea on the table.

WHAT YOU'RE COVERING (your budget)
Aim to wrap in roughly 6-10 questions — about 8. The client tells you which question you're on (e.g. "question 4 of ~8"). Across the whole conversation, not all at once, you're landing the essentials of a campaign:
- TONE / FEEL — the kind of story and how it feels to play
- THE HERO'S DRIVE OR WOUND — what pulls them in, what they want or run from
- THE OPENING SITUATION — where we find them when play starts
- THE SETTING / WORLD — where this happens
- THE CENTRAL THREAT OR TENSION — what's pushing against them
- ALLIES / COMPANIONS — who's with them, who matters
- HOW IT ENDS — hopeful, bleak, or somewhere between
- SCOPE / LENGTH — a one-shot, a short arc, or open-ended
Each turn, pick the SINGLE most important still-unfilled one and ask about that. Don't march the list in order — follow the conversation. Build on what they've told you. Never re-ask something they've answered or implied, and never ask about something they've asked to leave open. If they hand you several things at once, take them all as answered and jump to the most important thing still missing.

WHEN TO STOP — OFFER TO DRAFT EARLY
The budget is a CEILING, not a quota. The MOMENT the essentials exist — tone + the hero's hook + the opening + the setting + a sense of the threat or drive — set readyToDraft=true and invite them to draft, even if that's question 5. Do NOT keep asking just to reach 8. When you offer, say it plainly (e.g. "I think we've got enough to build something good — want me to write it up? Or we can keep shaping it."), ask no question, set "why" to "", and set readyToDraft=true. Make clear throughout that they can call for the draft any time — they hold the wheel. If they say they're ready before you'd have offered, take them at their word: stop and invite the draft.

STAY AT PREMISE LEVEL
Keep every question at the level of premise: who, where, why, tone, stakes, shape. NEVER ask about game mechanics, specific encounters, stat blocks, or turn-by-turn detail like "what almost kills him first" — that's for the table, not for now. If the player flags something as out-of-scope table stuff, drop it.

CLARIFYING QUESTIONS: only ask one if you genuinely didn't understand their answer — at most one per answer — then move on or make a reasonable assumption. Don't use a "clarifying question" as cover to over-dig something you already understood.

REMEMBER: Substance over compliments. One question per turn, with a plain-English "why". Bring ideas when they defer. Honor what they want left open. Offer the draft the moment you have enough, and hand them the wheel. Return ONLY the JSON object.`;

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
export async function converseCampaign({ prompt, conversation, subject, characterId, seed, questionNumber }) {
  if (!isClaudeAvailable()) {
    throw new Error('Claude API is required to author a campaign');
  }
  const { subjectLine, resolvedCharacterId } = await resolveSubject(subject, characterId);
  const seedLine = seed === 'surprise'
    ? 'The player asked you to surprise them — lead with your own ideas and questions to find a story that fits their character.'
    : null;

  const history = Array.isArray(conversation) ? conversation.filter(t => t && t.text) : [];
  // Which question we're on (drives the model's pacing + the client's counter).
  const qNum = Number.isFinite(questionNumber)
    ? questionNumber
    : history.filter(t => t.role === 'opus').length + 1;

  const lines = [subjectLine];
  if (seedLine) lines.push(seedLine);
  lines.push('');
  if (history.length) {
    lines.push('Your conversation so far:');
    history.forEach(t => lines.push(`${t.role === 'opus' ? 'You (DM)' : 'Player'}: ${t.text}`));
    lines.push('');
    lines.push(`This is around question ${qNum} of ~8. React to the player's latest message, then ask your next question — or, if you have the essentials, invite them to draft (readyToDraft=true). Return the JSON object only.`);
  } else {
    lines.push(`The player's opening idea: "${prompt || "they haven't said yet"}"`);
    lines.push('');
    lines.push('This is question 1 of ~8. Open the conversation: a quick, plain reaction to their idea, then your first question. Return the JSON object only.');
  }

  const response = await loggedChat(
    { call_purpose: 'campaign_converse', prompt_builder: 'campaignDraftService', character_id: resolvedCharacterId },
    CONVERSE_SYSTEM_PROMPT,
    [{ role: 'user', content: lines.join('\n') }],
    3,
    'opus',
    1500,
    true // raw — we extract the JSON ourselves
  );
  // Parse the structured reply; fall back to treating the raw text as the reply
  // so a malformed response still shows something rather than erroring out.
  const parsed = extractLLMJson(response);
  const reply = (parsed && typeof parsed.reply === 'string' && parsed.reply.trim())
    ? parsed.reply.trim()
    : String(response || '').trim();
  if (!reply) throw new Error('Opus could not reply — try again.');
  const why = parsed && typeof parsed.why === 'string' ? parsed.why.trim() : '';
  const readyToDraft = !!(parsed && parsed.readyToDraft);
  return { reply, why, readyToDraft, opusMessage: reply };
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
