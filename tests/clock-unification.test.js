/**
 * tests/clock-unification.test.js — Phase 0: ONE clock (world_clock wins, Q0).
 *
 * Covers migration 079 (per-campaign world_clock, backfill option A),
 * the scheduleService unified API (getClock / advanceDays / advanceHours /
 * setClockDate + the forward-only character mirror), campaign isolation,
 * lazy row seeding, and the schedule/downtime integration points.
 *
 * Isolated throwaway DB (chdir + TURSO env clear BEFORE importing
 * database.js — see capstone-combat.test.js for why the env clear matters).
 *
 *   node tests/clock-unification.test.js
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-clock-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
const db = dbModule.default;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const sched = await import(svc('server/services/scheduleService.js'));
const downtime = await import(svc('server/services/downtimeService.js'));
const harptos = await import(svc('server/config/harptos.js'));
const migration079 = await import(svc('server/migrations/079_world_clock_unification.js'));

let passed = 0;
let failed = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { passed++; } else { failed++; failures.push(msg); console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n${name}`); }

async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = [];
  const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(overrides, c.name)) {
      cols.push(c.name); vals.push(overrides[c.name]); continue;
    }
    if (c.notnull && c.dflt_value == null) {
      const t = (c.type || '').toUpperCase();
      cols.push(c.name); vals.push(t.includes('INT') ? 1 : `TEST_${c.name}`);
    }
  }
  const r = await dbRun(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals
  );
  return Number(r.lastInsertRowid);
}

// ---------------------------------------------------------------------------
group('1. Migration 079 shape on a fresh DB');
{
  const cols = (await dbAll('PRAGMA table_info(world_clock)')).map(r => r.name);
  for (const c of ['campaign_id', 'current_day', 'current_day_of_year', 'current_year', 'current_hour']) {
    assert(cols.includes(c), `world_clock has column ${c}`);
  }
  const fb = await dbGet('SELECT * FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
  assert(!!fb, 'fallback row (campaign_id NULL) exists');
  assert(fb.current_day === 1 && fb.current_day_of_year === 1, 'fresh fallback starts at day 1');
}

// ---------------------------------------------------------------------------
group('2. Backfill (option A) via direct up() on a pre-079 clock');
const camp1 = await insertRow('campaigns', { name: 'TEST Camp One' });
const camp2 = await insertRow('campaigns', { name: 'TEST Camp Two' });
const charA = await insertRow('characters', { name: 'TEST A', campaign_id: camp1, game_day: 300, game_year: 1491 });
const charB = await insertRow('characters', { name: 'TEST B', campaign_id: camp1, game_day: 150, game_year: 1492 });
const charC = await insertRow('characters', { name: 'TEST C', campaign_id: camp1, game_day: 200, game_year: 1492 });
const charD = await insertRow('characters', { name: 'TEST D', campaign_id: camp2, game_day: 40, game_year: 1490 });
{
  // Rebuild world_clock in its pre-079 singleton shape (old day = 5).
  await dbRun('DROP TABLE world_clock');
  await dbRun(`CREATE TABLE world_clock (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current_day INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await dbRun('INSERT INTO world_clock (id, current_day) VALUES (1, 5)');

  await migration079.up(db);

  const r1 = await dbGet('SELECT * FROM world_clock WHERE campaign_id = ?', [camp1]);
  assert(r1.current_day === 200 && r1.current_day_of_year === 200 && r1.current_year === 1492,
    `camp1 clock picks up at most-advanced character (1492, day 200) — got (${r1.current_year}, ${r1.current_day})`);
  assert(r1.current_hour === 8, 'camp1 clock hour defaults to 8');
  const r2 = await dbGet('SELECT * FROM world_clock WHERE campaign_id = ?', [camp2]);
  assert(r2.current_day === 40 && r2.current_year === 1490, 'camp2 clock seeded from its own character (1490, day 40)');
  const fb = await dbGet('SELECT * FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
  assert(fb.current_day === 200 && fb.current_year === 1492, 'fallback row mirrors the most advanced character overall');

  await migration079.up(db); // idempotent
  const r1b = await dbGet('SELECT * FROM world_clock WHERE campaign_id = ?', [camp1]);
  assert(r1b.current_day === 200, 'up() is idempotent (second run changes nothing)');
}

// ---------------------------------------------------------------------------
group('3. Unified API reads');
{
  const clock = await sched.getClock(camp1);
  assert(clock.day === 200 && clock.dayOfYear === 200 && clock.year === 1492 && clock.hour === 8,
    'getClock(camp1) returns the backfilled clock');
  assert((await sched.getCurrentDay(camp1)) === 200, 'getCurrentDay(camp1) = absolute 200');
  assert((await sched.getCurrentDay()) === 200, 'getCurrentDay() reads the fallback row');
  assert((await sched.getCurrentDay(camp2)) === 40, 'getCurrentDay(camp2) is campaign-scoped');
}

// ---------------------------------------------------------------------------
group('4. setClockDate + advanceDays Harptos rollover');
{
  await sched.setClockDate(camp1, { dayOfYear: 350, year: 1492 });
  let clock = await sched.getClock(camp1);
  assert(clock.dayOfYear === 350 && clock.year === 1492, 'setClockDate lands on (1492, 350)');
  assert(clock.day === 350, 'absolute counter shifted by the same delta (200 -> 350)');

  const after = await sched.advanceDays(30, { campaignId: camp1, reason: 'test' });
  const expected = harptos.advanceTime(350, 1492, 30); // 1492 is a Shieldmeet (leap) year: 366 days
  assert(after.dayOfYear === expected.day && after.year === expected.year,
    `advanceDays rolls the Harptos year correctly (expected ${expected.year}/${expected.day}, got ${after.year}/${after.dayOfYear})`);
  assert(after.day === 380, 'absolute counter advanced by exactly 30 (350 -> 380)');
}

// ---------------------------------------------------------------------------
group('5. Character mirror — forward only');
{
  const a = await dbGet('SELECT game_day, game_year FROM characters WHERE id = ?', [charA]);
  assert(a.game_day === 14 && a.game_year === 1493, 'behind character mirrored to the clock date (1493, 14)');
  const charE = await insertRow('characters', { name: 'TEST E', campaign_id: camp1, game_day: 100, game_year: 1494 });
  await sched.advanceDays(1, { campaignId: camp1 });
  const e = await dbGet('SELECT game_day, game_year FROM characters WHERE id = ?', [charE]);
  assert(e.game_day === 100 && e.game_year === 1494, 'character AHEAD of the clock is never dragged backward');
  const c = await dbGet('SELECT game_day, game_year FROM characters WHERE id = ?', [charC]);
  assert(c.game_day === 15 && c.game_year === 1493, 'mirror keeps pace on subsequent advances');
}

// ---------------------------------------------------------------------------
group('6. advanceHours rolls into days');
{
  const before = await sched.getClock(camp1); // hour 8, absolute 381, doy 15
  const after = await sched.advanceHours(20, { campaignId: camp1 });
  assert(after.hour === 4 && after.day === before.day + 1 && after.dayOfYear === before.dayOfYear + 1,
    `advanceHours(20) from 08:00 crosses midnight once (got hour ${after.hour}, day ${after.day})`);
}

// ---------------------------------------------------------------------------
group('7. Campaign isolation');
{
  const c1Before = await sched.getClock(camp1);
  const fbBefore = await sched.getClock(null);
  const c2After = await sched.advanceDays(5, { campaignId: camp2 });
  assert(c2After.day === 45 && c2After.dayOfYear === 45 && c2After.year === 1490, 'camp2 advanced on its own clock');
  const c1After = await sched.getClock(camp1);
  assert(c1After.day === c1Before.day, 'camp1 clock untouched by camp2 advance');
  const fbAfter = await sched.getClock(null);
  assert(fbAfter.day === fbBefore.day, 'fallback clock untouched by campaign advance');
}

// ---------------------------------------------------------------------------
group('8. Lazy seeding for a campaign with no clock row');
{
  const camp3 = await insertRow('campaigns', { name: 'TEST Camp Three' });
  const clock = await sched.getClock(camp3);
  const fb = await sched.getClock(null);
  assert(clock.day === fb.day && clock.year === fb.year, 'new campaign clock seeds from the fallback (world) date');
  const row = await dbGet('SELECT * FROM world_clock WHERE campaign_id = ?', [camp3]);
  assert(!!row, 'lazy seed persisted a campaign clock row');
}

// ---------------------------------------------------------------------------
group('9. Schedule integration on the unified clock');
{
  const c1 = await sched.getClock(camp1);
  const s = await sched.scheduleActivity({
    entityType: 'pc', entityId: charC, entityName: 'TEST C', activity: 'training',
    durationDays: 3, campaignId: camp1,
  });
  assert(s.startDay === c1.day && s.endDay === c1.day + 3, 'scheduleActivity starts on the campaign absolute day');
  const active = await sched.getActiveSchedule('pc', charC, null, camp1);
  assert(!!active, 'activity is active inside its window');
  await sched.advanceDays(3, { campaignId: camp1 });
  const after = await sched.getActiveSchedule('pc', charC, null, camp1);
  assert(after === null, 'activity leaves the active window once the campaign clock passes end_day');

  const fb0 = await sched.getClock(null);
  const s2 = await sched.scheduleActivity({
    entityType: 'npc', entityName: 'TEST NPC', activity: 'travel', durationDays: 2,
  });
  assert(s2.startDay === fb0.day, 'campaign-less activity uses the fallback clock');
  await sched.advanceDays(2, { reason: 'test' });
  const due = await sched.completeDueSchedules();
  assert(due.some(d => d.id === s2.scheduleId), 'completeDueSchedules completes fallback-due activities');
}

// ---------------------------------------------------------------------------
group('10. Downtime shortSkip threads the campaign clock');
{
  const before = await sched.getClock(camp2);
  const res = await downtime.shortSkip(2, camp2);
  assert(res.newDay === before.day + 2, 'shortSkip(days, campaignId) advances that campaign clock');
  const c1 = await sched.getClock(camp1);
  assert(c1.day === 385, 'shortSkip on camp2 does not move camp1');
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

