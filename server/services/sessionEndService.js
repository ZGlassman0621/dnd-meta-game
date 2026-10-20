/**
 * Session-End Service — the orchestrator.
 *
 * Pipeline: XP → downtime → domains (stub) → digest (stub) → sweep.
 * Each stage idempotent via session_end_runs. Failures don't block others.
 */

import { dbGet, dbRun } from '../database.js';
import { scoreSessionWithLLM, awardSessionXP } from './xpService.js';
import { isSkipResponse, parseDowntimeAssignments, scheduleDowntime, shortSkip } from './downtimeService.js';
import { sweepDeferredResolutions } from './deferredResolutionSweep.js';
import { getCurrentDay } from './scheduleService.js';

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
  await markStage(sessionId, 'xp', 'started');
  try {
    if (!llmCall) {
      const detail = { reason: 'no_llm_call', note: 'XP scoring deferred' };
      await markStage(sessionId, 'xp', 'pending_llm', detail);
      return { status: 'pending_llm', ...detail };
    }
    const { scores } = await scoreSessionWithLLM(sessionData || {}, llmCall);
    const award = await awardSessionXP(characterId, scores, db || { get: dbGet, run: dbRun });
    const detail = { xpAwarded: award.xpAwarded, leveledUp: award.leveledUp, newLevel: award.newLevel, scores };
    await markStage(sessionId, 'xp', 'complete', detail);
    return { status: 'complete', ...detail };
  } catch (e) {
    const detail = { error: e.message };
    await markStage(sessionId, 'xp', 'failed', detail);
    return { status: 'failed', ...detail };
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
    const gameDay = await getCurrentDay(campaignId);
    const result = await sweepDeferredResolutions(campaignId, characterId, gameDay);
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

export async function getEndStatus(sessionId) {
  const out = {};
  for (const stage of STAGES) {
    const row = await stageStatus(sessionId, stage);
    out[stage] = row ? row.status : 'not_started';
  }
  return out;
}

export default { endSession, getEndStatus };


