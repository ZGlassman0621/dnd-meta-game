/**
 * Schedule Service (Travel/Time #13).
 * Unified timeline for all entities. Single world clock.
 *
 * The details_json field is extensible for future gameplay systems:
 * - Away missions: pending checks, danger level, comm range
 * - Crafting: materials checklist, daily schedule, interruptibility
 * - Training: expected outcomes, character deltas
 */
import { dbGet, dbAll, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';

// ── World Clock ──

export async function getCurrentDay() {
  const row = await dbGet('SELECT current_day FROM world_clock WHERE id = 1');
  return row?.current_day ?? 1;
}

export async function advanceDays(n = 1) {
  if (n < 1) return getCurrentDay();
  await dbRun('UPDATE world_clock SET current_day = current_day + ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [n]);
  return getCurrentDay();
}

export async function setCurrentDay(day) {
  if (day < 1) return getCurrentDay();
  await dbRun('UPDATE world_clock SET current_day = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [day]);
  return day;
}

// ── Schedule ──

export async function scheduleActivity({ entityType, entityId = null, entityName, activity, location = null, destination = null, durationDays, details = {} }) {
  if (!entityType || !entityName || !activity || !durationDays || durationDays < 1) return null;
  // Allow override for testing/backfill (e.g. companionActivityService passes _startDayOverride)
  const startDay = details._startDayOverride ?? await getCurrentDay();
  const endDay = startDay + durationDays;
  const r = await dbRun(
    `INSERT INTO entity_schedule (entity_type, entity_id, entity_name, activity, location, destination, start_day, end_day, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entityType, entityId, entityName, activity, location, destination, startDay, endDay, JSON.stringify(details)]
  );
  return { scheduleId: Number(r.lastInsertRowid), entityName, activity, startDay, endDay };
}

export async function getActiveSchedule(entityType, entityId, entityName = null) {
  const day = await getCurrentDay();
  let row;
  if (entityId !== null && entityId !== undefined) {
    row = await dbGet(
      `SELECT * FROM entity_schedule WHERE entity_type = ? AND entity_id = ? AND status = 'active' AND start_day <= ? AND end_day > ? ORDER BY start_day DESC LIMIT 1`,
      [entityType, entityId, day, day]
    );
  } else if (entityName) {
    row = await dbGet(
      `SELECT * FROM entity_schedule WHERE entity_type = ? AND entity_name = ? AND status = 'active' AND start_day <= ? AND end_day > ? ORDER BY start_day DESC LIMIT 1`,
      [entityType, entityName, day, day]
    );
  }
  if (!row) return null;
  return { ...row, details: safeParse(row.details_json, {}) };
}

export async function isAvailable(entityType, entityId, entityName = null) {
  const active = await getActiveSchedule(entityType, entityId, entityName);
  return active === null;
}

export async function whereIs(entityType, entityId, entityName = null) {
  const active = await getActiveSchedule(entityType, entityId, entityName);
  if (!active) return { location: 'unknown', activity: 'available' };
  return {
    location: active.destination || active.location || 'unknown',
    activity: active.activity,
    untilDay: active.end_day,
    details: active.details,
  };
}

export async function whatCompletesOn(day) {
  const rows = await dbAll(
    `SELECT * FROM entity_schedule WHERE status = 'active' AND end_day = ? ORDER BY entity_name`,
    [day]
  );
  return rows.map(r => ({ ...r, details: safeParse(r.details_json, {}) }));
}

export async function completeDueSchedules() {
  const day = await getCurrentDay();
  const due = await dbAll(
    `SELECT * FROM entity_schedule WHERE status = 'active' AND end_day <= ?`,
    [day]
  );
  for (const s of due) {
    await dbRun(`UPDATE entity_schedule SET status = 'completed' WHERE id = ?`, [s.id]);
  }
  return due.map(r => ({ ...r, details: safeParse(r.details_json, {}) }));
}

export async function cancelSchedule(scheduleId) {
  await dbRun(`UPDATE entity_schedule SET status = 'cancelled' WHERE id = ?`, [scheduleId]);
}

export default { getCurrentDay, advanceDays, setCurrentDay, scheduleActivity, getActiveSchedule, isAvailable, whereIs, whatCompletesOn, completeDueSchedules, cancelSchedule };
