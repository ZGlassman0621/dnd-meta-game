/**
 * XP Service — session-end LLM scoring system.
 *
 * Design: ~/workspace/dnd-app-review/session-end-flow-design.md (§2)
 * Decided 2026-10-16, refined 2026-10-18, locked 2026-10-18.
 *
 * Pure session-end LLM scoring across 5 categories (combat/exploration/
 * quests/discovery/social), each 0-10 or N/A. No per-kill XP.
 *
 * Formula: xp = round(avg(scored) / 10 × xp_to_next / sessions_per_level) × breadth
 */

// ---------------------------------------------------------------------------
// D&D 2024 XP thresholds (cumulative XP to REACH each level)
// ---------------------------------------------------------------------------
const XP_TABLE = {
  1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500, 6: 14000, 7: 23000, 8: 34000,
  9: 48000, 10: 64000, 11: 85000, 12: 100000, 13: 120000, 14: 140000,
  15: 165000, 16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000,
};

/**
 * XP needed to go from `level` to `level + 1`.
 * Levels 21+: extrapolated (no official table).
 */
export function xpToNext(level) {
  if (level < 1) level = 1;
  if (level < 20) return XP_TABLE[level + 1] - XP_TABLE[level];
  return 50000 + (level - 20) * 10000;
}

// ---------------------------------------------------------------------------
// Sessions-per-level bands (Zach, 2026-10-18 — uses band midpoint)
// ---------------------------------------------------------------------------
const PACE_BANDS = [
  { lo: 1, hi: 3, spl: 1.5 },
  { lo: 4, hi: 7, spl: 2.5 },
  { lo: 8, hi: 10, spl: 3.5 },
  { lo: 11, hi: 14, spl: 6 },
  { lo: 15, hi: 25, spl: 10 },
  { lo: 26, hi: 50, spl: 14 },
];

/** Sessions-per-level for a given character level (uses band midpoint). */
export function sessionsPerLevel(level) {
  const band = PACE_BANDS.find(b => level >= b.lo && level <= b.hi);
  return band ? band.spl : 14;
}

// ---------------------------------------------------------------------------
// Breadth multipliers — rewards engaging multiple pillars (Zach, 2026-10-18)
// ---------------------------------------------------------------------------
export const BREADTH_MULTIPLIERS = { 1: 1.0, 2: 1.15, 3: 1.3, 4: 1.4, 5: 1.5 };

// ---------------------------------------------------------------------------
// Companion XP multipliers (Zach, 2026-10-18)
// ---------------------------------------------------------------------------
export const COMPANION_XP = { present: 1.0, away: 0.5, absent: 0.2 };

export const XP_CATEGORIES = ['combat', 'exploration', 'quests', 'discovery', 'social'];

// ---------------------------------------------------------------------------
// calculateSessionRewards(scores, level) — the core formula (pure function)
//
// scores: { combat: 8, exploration: null, quests: 7, discovery: null, social: 9 }
//   null/undefined = N/A (excluded from average, never a penalty)
// ---------------------------------------------------------------------------
export function calculateSessionRewards(scores, level) {
  const scored = XP_CATEGORIES.filter(c => scores[c] != null);
  if (scored.length === 0) {
    return { xp: 0, avg: 0, breadth: 0, categoriesScored: 0, effective: 0 };
  }
  const avg = scored.reduce((s, c) => s + scores[c], 0) / scored.length;
  const breadth = BREADTH_MULTIPLIERS[scored.length] || 1.5;
  const effective = avg * breadth;
  const xp = Math.round((effective / 10) * xpToNext(level) / sessionsPerLevel(level));
  return {
    xp,
    avg: Math.round(avg * 100) / 100,
    breadth,
    categoriesScored: scored.length,
    effective: Math.round(effective * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// scoreSessionWithLLM(sessionData, llmCall) — the scorer call
//
// A SEPARATE analytic LLM call, not the session DM. Reads the session bundle
// cold and returns structured JSON. Blind to player intent/notes — scores only
// what happened in the fiction (Zach, 2026-10-18).
// ---------------------------------------------------------------------------
const SCORER_SYSTEM_PROMPT = `You are an impartial session scorer for a D&D 2024 campaign. You read a session's fiction cold and score it across five categories. Your ruling is final — return numbers only, no explanations.

CATEGORIES (score each 0-10, or mark opportunity=false for N/A):
- COMBAT: hostile encounters — fights won, clever tactics, survival against odds.
- EXPLORATION: travel, mapping, discovering locations, navigating hazards.
- QUESTS: advancing active quest objectives, completing beats.
- DISCOVERY: new lore, secrets revealed, mysteries unraveled.
- SOCIAL: meaningful NPC interaction — negotiation, relationships built or tested.

RUBRIC: 0-2 failure despite opportunity; 3-4 poor; 5-6 adequate; 7-8 strong; 9-10 exceptional.

OPPORTUNITY RULES: Judge FIRST whether the category had opportunity. If opportunity=false, score MUST be null (excluded entirely, never zero). SUBSTITUTION: if one approach REPLACED another, the replaced category is N/A not 0. Talking past guards = Social scored, Combat N/A.

Score OPPORTUNITY-RELATIVE not absolute. A 20-min session with one brilliant scene can score 9/10.

OUTPUT: valid JSON only: {"combat":{"opportunity":true,"score":7},"exploration":{"opportunity":false,"score":null},"quests":{"opportunity":true,"score":8},"discovery":{"opportunity":true,"score":9},"social":{"opportunity":true,"score":8}}`;

export function buildScorerPrompt(sessionData) {
  const d = sessionData;
  const parts = [SCORER_SYSTEM_PROMPT, '', '--- SESSION DATA ---', `Character level: ${d.characterLevel ?? 'unknown'}`];
  if (d.narrative) parts.push('', '--- NARRATIVE ---', d.narrative);
  return parts.join('\n');
}

export function validateScorerOutput(parsed) {
  for (const cat of XP_CATEGORIES) {
    const entry = parsed[cat];
    if (!entry || typeof entry.opportunity !== 'boolean') throw new Error(`Invalid category: ${cat}`);
    if (!entry.opportunity && entry.score !== null) throw new Error(`${cat}: opportunity=false but score not null`);
    if (entry.opportunity && (!Number.isInteger(entry.score) || entry.score < 0 || entry.score > 10)) throw new Error(`${cat}: score must be 0-10`);
  }
  return true;
}

export async function scoreSessionWithLLM(sessionData, llmCall) {
  const prompt = buildScorerPrompt(sessionData);
  const raw = await llmCall(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Scorer returned no JSON');
  const parsed = JSON.parse(match[0]);
  validateScorerOutput(parsed);
  const scores = {};
  for (const cat of XP_CATEGORIES) scores[cat] = parsed[cat].score;
  return { scores, detail: parsed };
}

// ---------------------------------------------------------------------------
// awardSessionXP(characterId, scores, db) — apply XP, check level-up
// ---------------------------------------------------------------------------
export async function awardSessionXP(characterId, scores, db) {
  const char = await db.get('SELECT id, level, experience FROM characters WHERE id = ?', [characterId]);
  if (!char) throw new Error(`Character not found: ${characterId}`);
  const level = char.level ?? 1;
  const result = calculateSessionRewards(scores, level);
  const newXpTotal = (char.experience ?? 0) + result.xp;
  let newLevel = level;
  let cumulativeAtLevel = 0;
  for (let l = 1; l < newLevel; l++) cumulativeAtLevel += xpToNext(l);
  let leveledUp = false;
  while (newXpTotal >= cumulativeAtLevel + xpToNext(newLevel) && newLevel < 50) {
    cumulativeAtLevel += xpToNext(newLevel);
    newLevel++;
    leveledUp = true;
  }
  const pendingChoices = leveledUp ? queueLevelUpChoices(level, newLevel) : [];
  await db.run(`UPDATE characters SET experience = ?, level = ?, experience_to_next_level = ?, level_up_pending_choices = ? WHERE id = ?`, [newXpTotal, newLevel, xpToNext(newLevel), pendingChoices.length ? JSON.stringify(pendingChoices) : null, characterId]);
  return { xpAwarded: result.xp, leveledUp, newLevel, previousLevel: level, pendingChoices, breakdown: result };
}

function queueLevelUpChoices(oldLevel, newLevel) {
  const choices = [];
  for (let l = oldLevel + 1; l <= newLevel; l++) {
    if ([4, 8, 12, 16, 19].includes(l)) choices.push({ level: l, type: 'asi_or_feat', prompt: 'Choose: Ability Score Improvement or a feat.' });
    choices.push({ level: l, type: 'level_up_review', prompt: `Review level ${l} features with the DM.` });
  }
  return choices;
}

export function companionXP(baseXp, role) {
  const mult = COMPANION_XP[role] ?? COMPANION_XP.absent;
  return Math.round(baseXp * mult);
}


