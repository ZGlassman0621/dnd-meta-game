/**
 * Schedule Service (Travel/Time #13) — unified clock as of Phase 0 (079).
 *
 * world_clock is the SINGLE authoritative clock (Q0: the clock we built
 * wins). One row per campaign, plus a fallback row (campaign_id NULL).
 * Every row carries both day scales, always in sync:
 *   current_day         — absolute day counter (monotonic; the scale
 *                         entity_schedule start/end days live on)
 *   current_day_of_year — Harptos day-of-year (the scale characters.game_day
 *                         and the deadline columns live on)
 *   current_year / current_hour — Harptos year (DR), hour 0..23.
 *
 * ALL clock reads/writes go through this module:
 *   getClock(campaignId) / getCurrentDay(campaignId) — read
 *   advanceDays(n, { campaignId, reason }) / advanceHours(h, { campaignId })
 *   setClockDate(campaignId, { dayOfYear, year })    — session-boundary sync
 * Advancing the clock MIRRORS the date onto the campaign's characters
 * (game_day/game_year/game_hour, forward-only) so legacy readers of
 * characters.game_day stay consistent until Phase 4 removes the mirror.
 *
 * The details_json field is extensible for future gameplay systems:
 * - Away missions: pending checks, danger level, comm range
 * - Crafting: materials checklist, daily schedule, interruptibility
 * - Training: expected outcomes, character deltas
 */
import { dbGet, dbAll, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { advanceTime, daysBetween } from '../config/harptos.js';

// ── World Clock ──

async function resolveClockRow(campaignId = null) {
  if (campaignId != null) {
    let row = await dbGet('SELECT * FROM world_clock WHERE campaign_id = ?', [campaignId]);
    if (!row) {
      // First touch for this campaign: seed from the fallback row so the
      // campaign starts from the world's current date, never from day 1.
      const fb = await dbGet('SELECT * FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
      await dbRun(
        `INSERT OR IGNORE INTO world_clock (campaign_id, current_day, current_day_of_year, current_year, current_hour)
         VALUES (?, ?, ?, ?, ?)`,
        [campaignId, fb?.current_day ?? 1, fb?.current_day_of_year ?? 1, fb?.current_year ?? 1492, fb?.current_hour ?? 8]
      );
      row = await dbGet('SELECT * FROM world_clock WHERE campaign_id = ?', [campaignId]);
    }
    return row;
  }
  return dbGet('SELECT * FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
}

function rowToClock(row, campaignId = null) {
  if (!row) return { campaignId, day: 1, dayOfYear: 1, year: 1492, hour: 8 };
  return {
    campaignId: row.campaign_id ?? campaignId,
    day: row.current_day ?? 1,
    dayOfYear: row.current_day_of_year ?? row.current_day ?? 1,
    year: row.current_year ?? 1492,
    hour: row.current_hour ?? 8,
  };
}

export async function getClock(campaignId = null) {
  return rowToClock(await resolveClockRow(campaignId), campaignId);
}

export async function getCurrentDay(campaignId = null) {
  return (await getClock(campaignId)).day;
}

async function mirrorToCharacters(campaignId, clock) {
  const rows = campaignId != null
    ? await dbAll('SELECT id, game_day, game_year FROM characters WHERE campaign_id = ?', [campaignId])
    : await dbAll('SELECT id, game_day, game_year FROM characters');
  for (const ch of rows || []) {
    const behind = ch.game_day == null
      || (ch.game_year ?? 1492) < clock.year
      || ((ch.game_year ?? 1492) === clock.year && ch.game_day < clock.dayOfYear);
    if (behind) {
      await dbRun(
        'UPDATE characters SET game_day = ?, game_year = ?, game_hour = ? WHERE id = ?',
        [clock.dayOfYear, clock.year, clock.hour, ch.id]
      );
    }
  }
}

async function writeClock(row, { day, dayOfYear, year, hour }) {
  await dbRun(
    `UPDATE world_clock SET current_day = ?, current_day_of_year = ?, current_year = ?, current_hour = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [day, dayOfYear, year, hour, row.id]
  );
}

export async function advanceDays(n = 1, { campaignId = null, reason = null } = {}) {
  if (!n || n < 1) return getClock(campaignId);
  const row = await resolveClockRow(campaignId);
  const cur = rowToClock(row, campaignId);
  const rolled = advanceTime(cur.dayOfYear, cur.year, n);
  const next = { day: cur.day + n, dayOfYear: rolled.day, year: rolled.year, hour: cur.hour };
  await writeClock(row, next);
  await mirrorToCharacters(campaignId, next);
  return getClock(campaignId);
}

export async function advanceHours(h = 1, { campaignId = null, reason = null } = {}) {
  if (!h || h < 1) return getClock(campaignId);
  const cur = await getClock(campaignId);
  const total = cur.hour + h;
  const days = Math.floor(total / 24);
  const hour = total % 24;
  if (days > 0) await advanceDays(days, { campaignId, reason: reason || 'advance_hours' });
  const row = await resolveClockRow(campaignId);
  const now = rowToClock(row, campaignId);
  await writeClock(row, { ...now, hour });
  await mirrorToCharacters(campaignId, { ...now, hour });
  return getClock(campaignId);
}

export async function setCurrentDay(day, campaignId = null) {
  const row = await resolveClockRow(campaignId);
  const cur = rowToClock(row, campaignId);
  if (!day || day < 1 || day === cur.day) return getClock(campaignId);
  const rolled = advanceTime(cur.dayOfYear, cur.year, day - cur.day);
  const next = { day, dayOfYear: rolled.day, year: rolled.year, hour: cur.hour };
  await writeClock(row, next);
  await mirrorToCharacters(campaignId, next);
  return getClock(campaignId);
}

/**
 * Sync the clock to an explicit Harptos date (session boundaries: /start
 * records the session's start date; /end re-syncs before advancing so the
 * elapsed span lands on the right date). The absolute counter shifts by
 * the same delta, keeping both scales in lockstep.
 */
export async function setClockDate(campaignId, { dayOfYear, year } = {}) {
  if (dayOfYear == null || year == null) return getClock(campaignId);
  const row = await resolveClockRow(campaignId);
  const cur = rowToClock(row, campaignId);
  const delta = daysBetween(cur.dayOfYear, cur.year, dayOfYear, year);
  const next = { day: cur.day + delta, dayOfYear, year, hour: cur.hour };
  await writeClock(row, next);
  await mirrorToCharacters(campaignId, next);
  return getClock(campaignId);
}

// ── Schedule ──

export async function scheduleActivity({ entityType, entityId = null, entityName, activity, location = null, destination = null, durationDays, details = {}, campaignId = null }) {
  if (!entityType || !entityName || !activity || !durationDays || durationDays < 1) return null;
  // Allow override for testing/backfill (e.g. companionActivityService passes _startDayOverride)
  const startDay = details._startDayOverride ?? (await getClock(campaignId)).day;
  const endDay = startDay + durationDays;
  const r = await dbRun(
    `INSERT INTO entity_schedule (entity_type, entity_id, entity_name, activity, location, destination, start_day, end_day, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entityType, entityId, entityName, activity, location, destination, startDay, endDay, JSON.stringify(details)]
  );
  return { scheduleId: Number(r.lastInsertRowid), entityName, activity, startDay, endDay };
}

export async function getActiveSchedule(entityType, entityId, entityName = null, campaignId = null) {
  const day = await getCurrentDay(campaignId);
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

export async function isAvailable(entityType, entityId, entityName = null, campaignId = null) {
  const active = await getActiveSchedule(entityType, entityId, entityName, campaignId);
  return active === null;
}

export async function whereIs(entityType, entityId, entityName = null, campaignId = null) {
  const active = await getActiveSchedule(entityType, entityId, entityName, campaignId);
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

export default { getClock, getCurrentDay, advanceDays, advanceHours, setCurrentDay, setClockDate, scheduleActivity, getActiveSchedule, isAvailable, whereIs, whatCompletesOn, completeDueSchedules, cancelSchedule };
