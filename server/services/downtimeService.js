/**
 * Downtime Service — session-end downtime opt-in (Path A/B/C).
 *
 * Design: session-end-flow-design.md §3.
 *
 * Three paths:
 *   A — Clean end. Nothing scheduled, no clock change.
 *   B — Short skip. DM advances 1-2 days, narrative bridge. No task assignment.
 *   C — Full downtime. Player assigns tasks conversationally; parsed into
 *       entity_schedule rows; clock jumps; PC is protected (hard invariant).
 */

import { scheduleActivity, advanceDays, getCurrentDay } from './scheduleService.js';

const SKIP_PHRASES = [
  "i'll be right back", 'ill be right back', 'be right back',
  'just a short break', 'no downtime', 'skip downtime',
  'pick up where we left off', 'no time skip',
];

export function isSkipResponse(text) {
  if (!text) return true;
  const lower = text.toLowerCase().trim();
  return SKIP_PHRASES.some(p => lower.includes(p));
}

export function promptDowntimeOptIn(stewardName = null) {
  const voice = stewardName ? `${stewardName} (your steward)` : 'Your steward';
  return (
    `${voice} asks: "What should everyone be doing while you're away?"\n\n` +
    `Assign tasks for your companions, NPCs, and yourself — in your own words. ` +
    `Tell me how long you'll be gone in game-time, and I'll see it done.\n\n` +
    `(Or say "I'll be right back" to skip downtime and pick up where we left off.)`
  );
}

export function parseDowntimeAssignments(text, roster = [], spanDays = 0, startDay = 1) {
  if (!text || isSkipResponse(text)) return [];
  const VERBS = {
    train: 'training', training: 'training',
    scout: 'scouting', scouting: 'scouting',
    fortify: 'fortifying', building: 'building', build: 'building', construct: 'building',
    research: 'researching', researching: 'researching', study: 'researching',
    guard: 'guarding', patrol: 'guarding', watch: 'guarding',
    craft: 'crafting', crafting: 'crafting', forge: 'crafting',
    rest: 'resting', resting: 'resting', recover: 'resting',
    hunt: 'hunting', hunting: 'hunting',
    trade: 'trading', trading: 'trading',
  };
  const assignments = [];
  for (const person of roster) {
    const nameLower = person.name.toLowerCase();
    const sentences = text.split(/[.!?]+/);
    for (const sent of sentences) {
      if (!sent.toLowerCase().includes(nameLower)) continue;
      const sentLower = sent.toLowerCase();
      let activity = 'downtime_task';
      for (const [verb, canonical] of Object.entries(VERBS)) {
        if (sentLower.includes(verb)) { activity = canonical; break; }
      }
      assignments.push({
        entityType: person.type || 'companion', entityId: person.id,
        entityName: person.name, activity, rawText: sent.trim(),
        durationDays: spanDays, startDay,
      });
      break;
    }
  }
  return assignments;
}

export async function scheduleDowntime(assignments, pcId) {
  const protectEntityIds = pcId != null ? [pcId] : [];
  let scheduled = 0;
  for (const a of assignments) {
    const result = await scheduleActivity({
      entityType: a.entityType, entityId: a.entityId, entityName: a.entityName,
      activity: a.activity, location: a.location || null,
      durationDays: Math.max(1, a.durationDays || 1),
      details: {
        downtime: true, raw_assignment: a.rawText || null,
        protect_entity_ids: protectEntityIds,
        _startDayOverride: a.startDay,
      },
    });
    if (result) scheduled++;
  }
  return { scheduled, protectEntityIds };
}

export async function shortSkip(days = 1, campaignId = null) {
  const n = Math.max(1, Math.min(2, days));
  await advanceDays(n, { campaignId, reason: 'short_skip' });
  const newDay = await getCurrentDay(campaignId);
  return {
    daysAdvanced: n, newDay,
    bridgePrompt: `Narrate a brief bridge: the party wraps up loose ends, travels, rests. ${n} game-day(s) pass. Keep it to 2-3 sentences.`,
  };
}

export default { isSkipResponse, promptDowntimeOptIn, parseDowntimeAssignments, scheduleDowntime, shortSkip };

