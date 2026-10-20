/**
 * NPC Complexity Service (DM System, Part 1).
 *
 * Anti-shelter layer. The problem: the AI defaults to harmony — guards are
 * just guards, every redeemed cultist is genuinely redeemed — and it will
 * not generate suspicion, betrayal, or hidden agendas on its own, even when
 * the player probes for it.
 *
 * The fix: the SYSTEM rolls for complexity. The AI never decides whether
 * an NPC has a secret. The roll does. The AI only invents the content for
 * the tier it was given, and plays what was rolled.
 *
 * Tiers (Zach 2026-10-19): d100 → 1-20 'significant', 21-80 'minor',
 * 81-100 'surface'. Once set, a tier is permanent — no re-rolls.
 *
 * Player visibility: NONE of this is ever shown to the player.
 * complexity_tier in particular must never surface — even 'this NPC seems
 * straightforward' is information.
 *
 * Three-role separation: this service feeds the NPC block of the DM prompt
 * only. The DM world block and the companion block never see these fields.
 */
import { dbGet, dbRun } from '../database.js';
import { roll } from '../utils/rng.js';

// Insight DC by tier. 'surface' NPCs have nothing to find — no roll needed.
export const INSIGHT_DC = { significant: 15, minor: 12 };

export const AGENDA_STATUS = ['hidden', 'hinted', 'revealed', 'resolved'];

/**
 * Pure d100 roll → complexity tier. 20% significant / 60% minor / 20% surface.
 * The 20% 'surface' is the pressure valve: when the roll says clean, the AI
 * is *allowed* to write a clean NPC, which makes the other 80% legitimate
 * instead of paranoid.
 */
export function rollComplexityTier() {
  const { total } = roll(100, 1, { reason: 'npc complexity tier' });
  if (total <= 20) return 'significant';
  if (total <= 80) return 'minor';
  return 'surface';
}

const TIER_GENERATION_INSTRUCTIONS = {
  significant:
    'This NPC is hiding something that would change how the player sees them. ' +
    'Invent a real secret with real stakes. It must be something the NPC would ' +
    'lie about if asked directly. "Significant" does not mean evil — a ' +
    'relapsing cultist who is terrified of being found out is significant. ' +
    'A compromised guard with gambling debts is significant. Give the secret ' +
    'a type, a description, what is at stake, who else knows, and 2-3 ' +
    'behavioral tells (small observable behaviors — a glance, a habit, an ' +
    'evasion — never the secret itself).',
  minor:
    'This NPC has an undisclosed motive — not world-shaking, but it colors ' +
    'their behavior. A favor they want, a debt they owe, a bias they hold, ' +
    'a grudge they nurse. Give it a type, a description, what is at stake, ' +
    'who else knows, and 1-2 behavioral tells (observable behaviors only, ' +
    'never the motive itself).'
};

function defaultSurfaceAgenda() {
  return { type: 'none', description: 'none', stakes: null, who_else_knows: [], tells: [], tells_shown: 0 };
}

/**
 * Generate the hidden-agenda content for a rolled tier. The AI invents the
 * *content*; the tier (the decision that a secret exists) came from the roll.
 *
 * llmCall: async (prompt: string) => string, dependency-injected like the
 * XP scorer. Must return JSON. For 'surface' tier no LLM call is made — the
 * explicit 'none' agenda is returned directly.
 *
 * Returns the agenda object (also persisted by the caller).
 */
export async function generateHiddenAgenda(tier, npcContext, llmCall) {
  if (!tier || tier === 'surface') return defaultSurfaceAgenda();
  const instruction = TIER_GENERATION_INSTRUCTIONS[tier] || TIER_GENERATION_INSTRUCTIONS.minor;
  const ctx = npcContext || {};
  const prompt =
    `You are generating a hidden agenda for an NPC in a D&D campaign. ` +
    `${instruction}\n\n` +
    `NPC: ${ctx.name || 'unnamed'} — ${ctx.occupation || 'unknown occupation'}. ` +
    `${ctx.background ? `Background: ${ctx.background}. ` : ''}` +
    `${ctx.publicPersona ? `Public persona: ${ctx.publicPersona}. ` : ''}` +
    `\nRespond with JSON ONLY, no other text: ` +
    `{"type": "...", "description": "...", "stakes": "...", "who_else_knows": ["..."], "tells": ["...", "..."]}`;
  if (typeof llmCall !== 'function') {
    throw new Error('generateHiddenAgenda requires an llmCall for non-surface tiers');
  }
  const raw = await llmCall(prompt);
  const agenda = parseAgendaJson(raw);
  if (!agenda) {
    throw new Error('generateHiddenAgenda: llmCall did not return parseable agenda JSON');
  }
  return agenda;
}

/** Defensive JSON parse for LLM output (handles code fences). */
export function parseAgendaJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object' || !obj.description) return null;
    return {
      type: obj.type || 'unknown',
      description: String(obj.description),
      stakes: obj.stakes || null,
      who_else_knows: Array.isArray(obj.who_else_knows) ? obj.who_else_knows : [],
      tells: Array.isArray(obj.tells) ? obj.tells.map(String) : [],
      tells_shown: 0
    };
  } catch {
    return null;
  }
}

/**
 * Backfill-on-appearance (Zach 2026-10-19). If an NPC predates the
 * complexity system (complexity_tier IS NULL), roll the tier now and persist
 * it. Called the next time the NPC appears in a session — never bulk.
 * Returns the tier (existing or newly rolled).
 */
export async function ensureComplexityTier(npcId) {
  const npc = await dbGet('SELECT id, complexity_tier FROM npcs WHERE id = ?', [npcId]);
  if (!npc) return null;
  if (npc.complexity_tier) return npc.complexity_tier;
  const tier = rollComplexityTier();
  await dbRun("UPDATE npcs SET complexity_tier = ?, agenda_status = 'hidden' WHERE id = ?", [tier, npcId]);
  return tier;
}

/**
 * Generate and persist agenda content for an NPC that has a tier but no
 * agenda yet (e.g. backfilled on appearance). No-op for 'surface' tier or
 * when content already exists. Returns the agenda object or null.
 */
export async function ensureAgendaContent(npcId, llmCall) {
  const npc = await dbGet(
    'SELECT id, name, occupation, background_notes, complexity_tier, hidden_agenda FROM npcs WHERE id = ?',
    [npcId]
  );
  if (!npc || !npc.complexity_tier || npc.complexity_tier === 'surface') return null;
  if (npc.hidden_agenda) {
    try { return JSON.parse(npc.hidden_agenda); } catch { /* fall through and regenerate */ }
  }
  const agenda = await generateHiddenAgenda(npc.complexity_tier, {
    name: npc.name,
    occupation: npc.occupation,
    background: npc.background_notes
  }, llmCall);
  await dbRun('UPDATE npcs SET hidden_agenda = ? WHERE id = ?', [JSON.stringify(agenda), npcId]);
  return agenda;
}

/**
 * Companion hidden-agenda roll at recruitment (Zach 2026-10-19: YES,
 * mechanical, not vibes). Companions are full players run by the DM — their
 * opacity is a system property. Writes to the companion's npcs row via
 * npc_id. Returns { tier, agenda } or null when the companion has no npc row.
 */
export async function rollCompanionAgenda(companionId, llmCall = null) {
  const comp = await dbGet(
    `SELECT c.id, c.npc_id, n.name, n.occupation, n.background_notes, n.complexity_tier, n.hidden_agenda
     FROM companions c LEFT JOIN npcs n ON n.id = c.npc_id WHERE c.id = ?`,
    [companionId]
  );
  if (!comp || !comp.npc_id) return null;
  const tier = await ensureComplexityTier(comp.npc_id);
  let agenda = null;
  if (tier !== 'surface') {
    if (comp.hidden_agenda) {
      try { agenda = JSON.parse(comp.hidden_agenda); } catch { agenda = null; }
    }
    if (!agenda && typeof llmCall === 'function') {
      agenda = await ensureAgendaContent(comp.npc_id, llmCall);
    }
  }
  return { tier, agenda };
}

/**
 * Insight check resolution. Returns a TELL on success — never the secret.
 * On success, agenda_status moves hidden → hinted. Further successful checks
 * cycle through remaining tells; when exhausted, no new tells (the player
 * must confront or the NPC must confess to move to 'revealed').
 *
 * This is the hook for the future [ROLL_REQUEST] marker (kind: 'insight').
 * For now it is a pure service call: pass the player's roll total.
 */
export async function getInsightTell(npcId, rollTotal) {
  const npc = await dbGet(
    'SELECT complexity_tier, agenda_status, hidden_agenda FROM npcs WHERE id = ?',
    [npcId]
  );
  if (!npc || !npc.complexity_tier || npc.complexity_tier === 'surface') {
    return { found: false, success: true, tell: null, note: 'nothing_to_find' };
  }
  const dc = INSIGHT_DC[npc.complexity_tier];
  if (rollTotal < dc) {
    return { found: false, success: false, tell: null, dc, tier: npc.complexity_tier };
  }
  let agenda = null;
  try { agenda = npc.hidden_agenda ? JSON.parse(npc.hidden_agenda) : null; } catch { agenda = null; }
  const tells = (agenda && Array.isArray(agenda.tells)) ? agenda.tells : [];
  const shown = (agenda && Number.isInteger(agenda.tells_shown)) ? agenda.tells_shown : 0;
  if (shown >= tells.length) {
    return { found: true, success: true, tell: null, dc, tier: npc.complexity_tier, note: 'no_new_tells' };
  }
  const tell = tells[shown];
  agenda.tells_shown = shown + 1;
  const updates = ['hidden_agenda = ?'];
  const params = [JSON.stringify(agenda)];
  if (npc.agenda_status === 'hidden') {
    updates.push("agenda_status = 'hinted'");
  }
  params.push(npcId);
  await dbRun(`UPDATE npcs SET ${updates.join(', ')} WHERE id = ?`, params);
  return { found: true, success: true, tell, dc, tier: npc.complexity_tier };
}

/**
 * Per-character disposition. The system owns the number (-100..100);
 * the AI plays the attitude. Shifts from actions, never from narration.
 */
export async function updateDisposition(npcId, characterId, delta) {
  const row = await dbGet('SELECT disposition_json FROM npcs WHERE id = ?', [npcId]);
  let disp = {};
  try { disp = row && row.disposition_json ? JSON.parse(row.disposition_json) : {}; } catch { disp = {}; }
  const key = String(characterId);
  const next = Math.max(-100, Math.min(100, (Number(disp[key]) || 0) + delta));
  disp[key] = next;
  await dbRun('UPDATE npcs SET disposition_json = ? WHERE id = ?', [JSON.stringify(disp), npcId]);
  return next;
}

export async function getDisposition(npcId, characterId) {
  const row = await dbGet('SELECT disposition_json FROM npcs WHERE id = ?', [npcId]);
  try {
    const disp = row && row.disposition_json ? JSON.parse(row.disposition_json) : {};
    return Number(disp[String(characterId)]) || 0;
  } catch {
    return 0;
  }
}

/**
 * Anti-shelter surfacing verifier. If a significant-tier NPC's agenda is
 * still 'hidden' after 5+ interactions, the prompt layer should nudge the AI
 * to surface a tell (an evasion, an inconsistency — never the secret).
 * Fires at most once per 3 interactions. Returns { nudge: boolean }.
 */
export async function checkSurfacingVerifier(npcId) {
  const npc = await dbGet(
    'SELECT complexity_tier, agenda_status, interaction_count, verifier_nudge_count FROM npcs WHERE id = ?',
    [npcId]
  );
  if (!npc || npc.complexity_tier !== 'significant' || npc.agenda_status !== 'hidden') {
    return { nudge: false };
  }
  const interactions = npc.interaction_count || 0;
  if (interactions < 5) return { nudge: false, interactions };
  const lastNudge = npc.verifier_nudge_count || 0;
  if (interactions - lastNudge < 3) return { nudge: false, interactions };
  await dbRun('UPDATE npcs SET verifier_nudge_count = ? WHERE id = ?', [interactions, npcId]);
  return { nudge: true, interactions };
}

/**
 * Killed NPC (Zach 2026-10-19): the secret does NOT die with them — it
 * surfaces through consequences in the world. Marks the agenda 'resolved'
 * and returns the parsed agenda (including who_else_knows) so the caller
 * can inject those consequences. Returns null for surface-tier or
 * agenda-less NPCs (nothing to surface).
 */
export async function onNpcDeath(npcId) {
  const npc = await dbGet(
    'SELECT complexity_tier, agenda_status, hidden_agenda FROM npcs WHERE id = ?',
    [npcId]
  );
  if (!npc || !npc.complexity_tier || npc.complexity_tier === 'surface') return null;
  await dbRun("UPDATE npcs SET agenda_status = 'resolved' WHERE id = ?", [npcId]);
  try {
    return npc.hidden_agenda ? JSON.parse(npc.hidden_agenda) : null;
  } catch {
    return null;
  }
}

/**
 * Build the DM-ONLY hidden-agenda prompt block for one NPC row. Pure
 * function — no DB. Returns null when there is nothing to render
 * (no tier, surface tier, or no agenda content yet).
 *
 * The AI sees this block but must NEVER reveal it directly — behavior only.
 * This block lives in the NPC section of the prompt, structurally separate
 * from the DM world block and the companion block (three-role separation).
 */
export function buildAgendaPromptBlock(npc, characterId = null) {
  if (!npc || !npc.complexity_tier || npc.complexity_tier === 'surface') return null;
  let desc = '';
  try {
    const agenda = typeof npc.hidden_agenda === 'string' ? JSON.parse(npc.hidden_agenda) : npc.hidden_agenda;
    desc = (agenda && agenda.description) ? String(agenda.description) : '';
  } catch {
    desc = '';
  }
  if (!desc || desc === 'none') return null;
  const lines = [];
  lines.push(`  DM-ONLY — HIDDEN AGENDA [${npc.complexity_tier}] (status: ${npc.agenda_status || 'hidden'}): ${desc}`);
  if (npc.what_they_want_from_pc) {
    lines.push(`  DM-ONLY — What they want from the player: ${npc.what_they_want_from_pc}`);
  }
  if (characterId != null && npc.disposition_json) {
    try {
      const disp = JSON.parse(npc.disposition_json);
      const val = Number(disp[String(characterId)]);
      if (Number.isFinite(val) && val !== 0) {
        lines.push(`  DM-ONLY — Disposition toward this character: ${val} (-100 hostile … +100 devoted). Play the attitude; never state the number.`);
      }
    } catch { /* disposition is best-effort */ }
  }
  lines.push('  DM-ONLY RULES: NEVER reveal the hidden agenda directly — not in narration, not in dialogue, not in brackets. Surface it ONLY through behavior: evasions, tells, inconsistencies, actions. If the player rolls Insight/Perception against this NPC, the system will tell you what (if anything) they detect. Do not volunteer it. Play the public persona cleanly until a tell is earned.');
  return lines.join('\n');
}

export default {
  rollComplexityTier,
  generateHiddenAgenda,
  parseAgendaJson,
  ensureComplexityTier,
  ensureAgendaContent,
  rollCompanionAgenda,
  getInsightTell,
  updateDisposition,
  getDisposition,
  checkSurfacingVerifier,
  onNpcDeath,
  buildAgendaPromptBlock,
  INSIGHT_DC,
  AGENDA_STATUS
};

