/**
 * Session-End Service — the orchestrator.
 *
 * Pipeline: XP → downtime → domains (stub) → digest (stub) → sweep.
 * Each stage idempotent via session_end_runs. Failures don't block others.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { XP_THRESHOLDS } from '../config/levelProgression.js';
import { scoreSessionWithLLM, awardSessionXP } from './xpService.js';
import { isSkipResponse, parseDowntimeAssignments, scheduleDowntime, shortSkip } from './downtimeService.js';
import { sweepDeferredResolutions } from './deferredResolutionSweep.js';
import { getClock, getCurrentDay } from './scheduleService.js';

const STAGES = ['xp', 'downtime', 'domains', 'digest', 'sweep'];

async function stageStatus(sessionId, stage) {
  return await dbGet(
    `SELECT status, detail_json FROM session_end_runs WHERE session_id = ? AND stage = ?`,
    [String(sessionId), stage]
  ) || null;
}

async function markStage(sessionId, stage, status, detail = null) {
  await dbRun(
    `INSERT INTO session_end_runs (session_id, stage, status, detail_json, completed_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(session_id, stage) DO UPDATE SET status=excluded.status, detail_json=excluded.detail_json, completed_at=excluded.completed_at`,
    [String(sessionId), stage, status, detail ? JSON.stringify(detail) : null]
  );
}

async function runXpStage(sessionId, { characterId, sessionData, llmCall, db }) {
  const existing = await stageStatus(sessionId, 'xp');
  if (existing && existing.status === 'complete') return { skipped: true, ...JSON.parse(existing.detail_json || '{}') };
  // What the retry at the next session start scores from: the session data
  // exactly as it stood at session end (return-loop-xp-fixes, G-2).
  const held = { sessionData: sessionData || {}, characterId };
  await markStage(sessionId, 'xp', 'started');
  try {
    if (!llmCall) {
      const detail = { reason: 'no_llm_call', note: 'XP scoring deferred', ...held };
      await markStage(sessionId, 'xp', 'pending_llm', detail);
      return { status: 'pending_llm', ...detail };
    }
    const { scores } = await scoreSessionWithLLM(sessionData || {}, llmCall);
    const award = await awardSessionXP(characterId, scores, db || { get: dbGet, run: dbRun });
    const detail = { xpAwarded: award.xpAwarded, leveledUp: award.leveledUp, newLevel: award.newLevel, scores };
    await markStage(sessionId, 'xp', 'complete', detail);
    return { status: 'complete', ...detail };
  } catch (e) {
    await markStage(sessionId, 'xp', 'failed', { error: e.message, ...held });
    return { status: 'failed', error: e.message };
  }
}

async function runDowntimeStage(sessionId, { characterId, campaignId, downtimeChoice, roster, spanDays }) {
  const existing = await stageStatus(sessionId, 'downtime');
  if (existing && existing.status === 'complete') return { skipped: true, ...JSON.parse(existing.detail_json || '{}') };
  await markStage(sessionId, 'downtime', 'started');
  try {
    let detail;
    const choice = (downtimeChoice || {}).path || 'clean';
    if (choice === 'clean' || choice === 'skip' || (downtimeChoice?.text != null && isSkipResponse(downtimeChoice.text))) {
      detail = { path: 'clean', scheduled: 0 };
    } else if (choice === 'short') {
      const res = await shortSkip(downtimeChoice?.days || 1, campaignId);
      detail = { path: 'short', ...res };
    } else {
      const startDay = await getCurrentDay(campaignId);
      const assignments = parseDowntimeAssignments(downtimeChoice?.text || '', roster || [], spanDays || downtimeChoice?.spanDays || 0, startDay);
      const { scheduled, protectEntityIds } = await scheduleDowntime(assignments, characterId);
      detail = { path: 'full', scheduled, protectEntityIds, spanDays: spanDays || downtimeChoice?.spanDays || 0 };
    }
    await markStage(sessionId, 'downtime', 'complete', detail);
    return { status: 'complete', ...detail };
  } catch (e) {
    const detail = { error: e.message };
    await markStage(sessionId, 'downtime', 'failed', detail);
    return { status: 'failed', ...detail };
  }
}

async function runDomainsStage(sessionId) {
  const existing = await stageStatus(sessionId, 'domains');
  if (existing && existing.status === 'complete') return { skipped: true, ...JSON.parse(existing.detail_json || '{}') };
  await markStage(sessionId, 'domains', 'started');
  // STUB — steward data model (domains table, resolveDomainTurn) not built yet.
  console.log('[session-end] domain turns not yet implemented — skipping');
  const detail = { stub: true, note: 'domain turns not yet implemented', turnsResolved: 0 };
  await markStage(sessionId, 'domains', 'complete', detail);
  return { status: 'complete', ...detail };
}

async function runDigestStage(sessionId) {
  const existing = await stageStatus(sessionId, 'digest');
  if (existing && existing.status === 'complete') return { skipped: true, ...JSON.parse(existing.detail_json || '{}') };
  await markStage(sessionId, 'digest', 'started');
  // STUB — needs domain-turn outcomes (stage 3). When built: freeze treasury
  // delta, routine/notable/held items into narrative_queue as steward_digest.
  console.log('[session-end] digest pre-assembly not yet implemented — skipping');
  const detail = { stub: true, note: 'digest pre-assembly not yet implemented', itemsFrozen: 0 };
  await markStage(sessionId, 'digest', 'complete', detail);
  return { status: 'complete', ...detail };
}

async function runSweepStage(sessionId, { campaignId, characterId }) {
  const existing = await stageStatus(sessionId, 'sweep');
  if (existing && existing.status === 'complete') return { skipped: true, ...JSON.parse(existing.detail_json || '{}') };
  await markStage(sessionId, 'sweep', 'started');
  try {
    // Both day scales: companion activities are on the absolute counter,
    // commission deadlines on day-of-year (G-3). See deferredResolutionSweep.js.
    const clock = await getClock(campaignId);
    const result = await sweepDeferredResolutions(campaignId, characterId, clock);
    await markStage(sessionId, 'sweep', 'complete', { ...result });
    return { status: 'complete', ...result };
  } catch (e) {
    const detail = { error: e.message };
    await markStage(sessionId, 'sweep', 'failed', detail);
    return { status: 'failed', ...detail };
  }
}

export async function endSession(sessionId, options = {}) {
  if (!sessionId) throw new Error('endSession: sessionId required');
  const { characterId = null, campaignId = null, sessionData = {}, llmCall = null,
    downtimeChoice = { path: 'clean' }, roster = [], spanDays = 0, db = null } = options;
  // Pipeline order: XP → downtime → domains → digest → sweep.
  const xp = await runXpStage(sessionId, { characterId, sessionData, llmCall, db });
  const downtime = await runDowntimeStage(sessionId, { characterId, campaignId, downtimeChoice, roster, spanDays });
  const domains = await runDomainsStage(sessionId);
  const digest = await runDigestStage(sessionId);
  const sweep = await runSweepStage(sessionId, { campaignId, characterId });
  return { xp, downtime, domains, digest, sweep };
}

// ---------------------------------------------------------------------------
// Companion session XP (return-loop-xp-fixes, item 3).
//
// Companions are awarded ONLY here, once per session. The claim route calls
// it with the session's stored award; the held-XP retry calls it when the
// session was claimed before its score landed. The session's rewards JSON
// carries `companionXpAwarded` as the once-only marker, so whichever path
// runs second awards nothing.
// ---------------------------------------------------------------------------
export async function awardCompanionSessionXP(characterId, xp) {
  const results = [];
  if (!(xp > 0)) return results;
  const companions = await dbAll(`
    SELECT c.id, c.companion_level, c.companion_experience, c.companion_class, n.name
    FROM companions c
    JOIN npcs n ON c.npc_id = n.id
    WHERE c.recruited_by_character_id = ? AND c.status = 'active' AND c.progression_type = 'class_based'
  `, [characterId]);
  for (const companion of companions) {
    const oldXP = companion.companion_experience || 0;
    const newXP = oldXP + xp;
    const currentLevel = companion.companion_level;
    const nextLevelXP = currentLevel < 20 ? XP_THRESHOLDS[currentLevel + 1] : null;
    await dbRun('UPDATE companions SET companion_experience = ? WHERE id = ?', [newXP, companion.id]);
    results.push({
      id: companion.id,
      name: companion.name,
      class: companion.companion_class,
      level: currentLevel,
      xpGained: xp,
      totalXP: newXP,
      canLevelUp: nextLevelXP !== null && newXP >= nextLevelXP,
      xpToNextLevel: nextLevelXP ? nextLevelXP - newXP : null
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// retryHeldXpAwards(characterId, { llmCallFor, db }) — G-2.
//
// Called at the next session start. Every one of this character's sessions
// whose XP stage is `failed` or `pending_llm` is scored again from the session
// data stored at session end, and on success awarded through the canonical
// path (awardSessionXP: experience, level and level-up choices together).
//
// Exactly once: each row is claimed with a conditional UPDATE (failed /
// pending_llm → started) before scoring, so a second or concurrent retry finds
// nothing to claim. A retry that fails again puts the row back to `failed`.
// Never throws — a retry problem must not block session start.
//
// llmCallFor(sessionRow) returns the scorer call for that session.
// ---------------------------------------------------------------------------
export async function retryHeldXpAwards(characterId, { llmCallFor, db = null } = {}) {
  const out = [];
  if (characterId == null || typeof llmCallFor !== 'function') return out;
  let rows;
  try {
    rows = await dbAll(`
      SELECT r.session_id, r.status, r.detail_json, d.id AS dm_session_id
      FROM session_end_runs r
      JOIN dm_sessions d ON CAST(d.id AS TEXT) = r.session_id
      WHERE d.character_id = ? AND r.stage = 'xp' AND r.status IN ('failed', 'pending_llm')
      ORDER BY d.id
    `, [characterId]);
  } catch (e) {
    console.warn('[session-end] held-XP lookup failed:', e.message);
    return out;
  }
  for (const row of rows) {
    const sessionId = row.session_id;
    const prior = safeJson(row.detail_json);
    try {
      const claimed = await dbRun(
        `UPDATE session_end_runs SET status = 'started', completed_at = CURRENT_TIMESTAMP
         WHERE session_id = ? AND stage = 'xp' AND status IN ('failed', 'pending_llm')`,
        [sessionId]
      );
      if (claimed.changes !== 1) continue; // another retry took it
    } catch (e) {
      console.warn(`[session-end] held-XP claim failed for session ${sessionId}:`, e.message);
      continue;
    }
    const retries = (prior.retries || 0) + 1;
    try {
      const session = await dbGet('SELECT id, character_id, messages, rewards, rewards_claimed FROM dm_sessions WHERE id = ?', [row.dm_session_id]);
      const sessionData = prior.sessionData || sessionDataFromMessages(session);
      const { scores } = await scoreSessionWithLLM(sessionData, llmCallFor(session));
      const award = await awardSessionXP(characterId, scores, db || { get: dbGet, run: dbRun });
      const detail = { xpAwarded: award.xpAwarded, leveledUp: award.leveledUp, newLevel: award.newLevel, scores, retried: true, retries };
      await markStage(sessionId, 'xp', 'complete', detail);
      let companionXPResults = [];
      try {
        companionXPResults = await settleSessionRewards(session, award);
      } catch (e) {
        console.warn(`[session-end] held-XP rewards record failed for session ${sessionId}:`, e.message);
      }
      out.push({ sessionId, status: 'complete', ...detail, companionXPResults });
    } catch (e) {
      await markStage(sessionId, 'xp', 'failed', { ...prior, error: e.message, retries }).catch(() => {});
      console.warn(`[session-end] held-XP retry failed for session ${sessionId} (attempt ${retries}):`, e.message);
      out.push({ sessionId, status: 'failed', error: e.message, retries });
    }
  }
  return out;
}

// After a retried award lands: record it on the session's rewards (so history
// shows it), and — if the session was already claimed, so the claim could not
// have awarded companions this XP — award the companions now, once. An
// unclaimed session keeps the award in rewards.xp for its claim to pay out.
async function settleSessionRewards(session, award) {
  if (!session) return [];
  const rewards = safeJson(session.rewards);
  rewards.xp = award.xpAwarded;
  rewards.leveledUp = award.leveledUp;
  rewards.newLevel = award.newLevel;
  let results = [];
  if (session.rewards_claimed && !rewards.companionXpAwarded && award.xpAwarded > 0) {
    results = await awardCompanionSessionXP(session.character_id, award.xpAwarded);
    rewards.companionXpAwarded = award.xpAwarded;
  }
  await dbRun('UPDATE dm_sessions SET rewards = ? WHERE id = ?', [JSON.stringify(rewards), session.id]);
  return results;
}

// Legacy rows (held before this job stored sessionData): rebuild the same
// narrative the end route scores from.
function sessionDataFromMessages(session) {
  const messages = safeJson(session?.messages, []);
  const narrative = (Array.isArray(messages) ? messages : [])
    .filter(m => m.role === 'assistant')
    .map(m => typeof m.content === 'string' ? m.content : '')
    .join('\n');
  return { narrative };
}

function safeJson(text, fallback = {}) {
  if (!text) return fallback;
  try { return JSON.parse(text) ?? fallback; } catch { return fallback; }
}

export async function getEndStatus(sessionId) {
  const out = {};
  for (const stage of STAGES) {
    const row = await stageStatus(sessionId, stage);
    out[stage] = row ? row.status : 'not_started';
  }
  return out;
}

export default { endSession, getEndStatus, retryHeldXpAwards, awardCompanionSessionXP };


