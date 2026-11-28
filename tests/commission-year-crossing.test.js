/**
 * Commission year-crossing fix (brief docs/pm/healers-kit-stabilize, Part 2).
 *
 * Orders stored a day-of-year deadline with no year: ordered on day 360
 * with 10 days of work, due "day 370", which a day-of-year clock never
 * reaches. Orders now time on the absolute day counter (deadline_abs_day /
 * ready_abs_day); the day-of-year columns stay for the commissions panel.
 *
 * On the real services and a real (throwaway) DB:
 *  - ready across the year boundary (day 360 + 10 → day 5 next year);
 *  - expiry across the boundary (ready late in the year, 30 days held);
 *  - a late-year order with a short making time is ready the same year;
 *  - a second-year campaign (the two scales differ) times on the absolute day;
 *  - a legacy row with no absolute day keeps its day-of-year comparison;
 *  - migration 120, per case.
 * Run: npm test commission-year
 */
import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import { placeCommission, processDueOrders, expireStaleReadyOrders } from '../server/services/merchantOrderService.js';
import { sweepDeferredResolutions } from '../server/services/deferredResolutionSweep.js';
import { getClock, advanceDays } from '../server/services/scheduleService.js';
import { up as migration120 } from '../server/migrations/120_commission_absolute_day.js';

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); } else { failed++; console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n== ${name}`); }

await initDatabase();
const made = { campaigns: [], chars: [], merchants: [], orders: [] };

async function insertRow(table, overrides) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = []; const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(overrides, c.name)) { cols.push(c.name); vals.push(overrides[c.name]); continue; }
    if (c.notnull && c.dflt_value == null) {
      const t = (c.type || '').toUpperCase();
      cols.push(c.name); vals.push(t.includes('INT') || t.includes('REAL') ? 1 : `TEST_${c.name}`);
    }
  }
  const r = await dbRun(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
  return Number(r.lastInsertRowid);
}

/** A campaign whose clock reads { day, dayOfYear, year }, a character, a merchant. */
async function world(name, { day, dayOfYear, year }) {
  const camp = await insertRow('campaigns', { name: `TEST_YC ${name}`, status: 'active' });
  made.campaigns.push(camp);
  await getClock(camp); // creates the campaign's clock row
  await dbRun('UPDATE world_clock SET current_day = ?, current_day_of_year = ?, current_year = ? WHERE campaign_id = ?', [day, dayOfYear, year, camp]);
  const ch = await insertRow('characters', {
    name: `TEST_YC ${name} Hero`, class: 'Fighter', race: 'Human', level: 3, current_hp: 20, max_hp: 20,
    current_location: 'TEST_YC Town', experience_to_next_level: 900, campaign_id: camp, game_day: dayOfYear, game_year: year,
    gold_gp: 1000, gold_sp: 0, gold_cp: 0,
  });
  made.chars.push(ch);
  const m = await insertRow('merchant_inventories', { campaign_id: camp, merchant_name: `TEST_YC ${name} Smith`, merchant_type: 'blacksmith' });
  made.merchants.push(m);
  return { camp, ch, m };
}
async function order(w, item, lead, currentGameDay) {
  const r = await placeCommission({ merchantId: w.m, characterId: w.ch, itemName: item, quotedPriceCp: 1000, depositCp: 100, leadTimeDays: lead, currentGameDay });
  if (r.order) made.orders.push(r.order.id);
  return r.order;
}
const row = (id) => dbGet('SELECT status, deadline_game_day, deadline_abs_day, ready_game_day, ready_abs_day FROM merchant_orders WHERE id = ?', [id]);
const sweep = async (w) => sweepDeferredResolutions(w.camp, w.ch, await getClock(w.camp));

try {
  // =========================================================================
  group('1. Ordered on day 360 with 10 days of work: ready on day 5 of the next year');
  {
    // 1491 is a 365-day year (Shieldmeet falls in 1492). A first-year campaign: both scales equal.
    const w = await world('Cross', { day: 360, dayOfYear: 360, year: 1491 });
    const o = await order(w, 'TEST_YC Cross Sword', 10, 360);
    const r0 = await row(o.id);
    check(r0.deadline_game_day === 370 && r0.deadline_abs_day === 370, 'placed: day-of-year deadline 370 (shown as before), absolute deadline 370');
    await advanceDays(5, { campaignId: w.camp });
    await sweep(w);
    check((await row(o.id)).status === 'pending', 'day 365 of 1491 (5 days in): still being made');
    await advanceDays(4, { campaignId: w.camp });
    await sweep(w);
    const c9 = await getClock(w.camp);
    check(c9.dayOfYear === 4 && c9.year === 1492 && (await row(o.id)).status === 'pending', 'day 4 of 1492 (9 days in): still being made');
    await advanceDays(1, { campaignId: w.camp });
    const c10 = await getClock(w.camp);
    const res = await sweep(w);
    const r1 = await row(o.id);
    check(c10.dayOfYear === 5 && c10.year === 1492 && c10.day === 370, 'the clock reads day 5 of 1492 (absolute day 370)');
    check(r1.status === 'ready' && res.ordersReadied === 1, 'day 5 of 1492 (10 days in): the commission is READY — the old day-of-year compare (5 ≥ 370) never got here');
    check(r1.ready_game_day === 5 && r1.ready_abs_day === 370, 'ready stamped on both scales: day-of-year 5, absolute 370');
  }

  // =========================================================================
  group('2. Made ready near year end: expires on schedule in the next year');
  {
    const w = await world('Expire', { day: 350, dayOfYear: 350, year: 1491 });
    const o = await order(w, 'TEST_YC Expire Helm', 1, 349);
    await sweep(w);
    const r0 = await row(o.id);
    check(r0.status === 'ready' && r0.ready_game_day === 350 && r0.ready_abs_day === 350, 'ready on day 350 of 1491');
    await advanceDays(30, { campaignId: w.camp }); // day 15 of 1492, 30 days held
    await sweep(w);
    check((await getClock(w.camp)).dayOfYear === 15 && (await row(o.id)).status === 'ready', 'day 15 of 1492 (30 days held): still held for pickup');
    await advanceDays(1, { campaignId: w.camp }); // 31 days held
    const res = await sweep(w);
    check((await row(o.id)).status === 'expired' && res.ordersExpired === 1, 'day 16 of 1492 (31 days held): EXPIRED on schedule — the old compare (16 − 350) never expired it');
  }

  // =========================================================================
  group('3. A late-year order with a short making time is ready the same year');
  {
    const w = await world('Short', { day: 355, dayOfYear: 355, year: 1491 });
    const o = await order(w, 'TEST_YC Short Dagger', 5, 355);
    await advanceDays(4, { campaignId: w.camp });
    await sweep(w);
    check((await row(o.id)).status === 'pending', 'day 359: still being made');
    await advanceDays(1, { campaignId: w.camp });
    await sweep(w);
    const r = await row(o.id);
    check(r.status === 'ready' && r.ready_game_day === 360 && (await getClock(w.camp)).year === 1491, 'day 360 of 1491: ready, the same year');
  }

  // =========================================================================
  group('4. A second-year campaign (the two scales differ) times on the absolute day');
  {
    // Absolute day 400 = day 35 of 1492 for a campaign that began on day 1 of 1491.
    const w = await world('Second', { day: 400, dayOfYear: 35, year: 1492 });
    const o = await order(w, 'TEST_YC Second Shield', 10, 35);
    const r0 = await row(o.id);
    check(r0.deadline_game_day === 45 && r0.deadline_abs_day === 410, 'placed on day 35: day-of-year deadline 45, absolute 410');
    await advanceDays(9, { campaignId: w.camp });
    await sweep(w);
    check((await row(o.id)).status === 'pending', '9 days in: still being made (no early ready on the absolute scale)');
    await advanceDays(1, { campaignId: w.camp });
    await sweep(w);
    const r1 = await row(o.id);
    check(r1.status === 'ready' && r1.ready_abs_day === 410 && r1.ready_game_day === 45, '10 days in: ready, stamped absolute 410 / day-of-year 45');
    const placed = await placeCommission({ merchantId: w.m, characterId: w.ch, itemName: 'TEST_YC Second Explicit', quotedPriceCp: 500, depositCp: 0, leadTimeDays: 3, currentGameDay: 45, currentAbsDay: 410 });
    made.orders.push(placed.order.id);
    check(placed.order.deadline_abs_day === 413, 'an explicit absolute "now" (the marker handler passes the clock\'s day) is used as given');
  }

  // =========================================================================
  group('5. A legacy row with no absolute day keeps its day-of-year comparison');
  {
    const w = await world('Legacy', { day: 500, dayOfYear: 135, year: 1492 });
    const id = await insertRow('merchant_orders', {
      merchant_id: w.m, character_id: w.ch, item_name: 'TEST_YC Legacy Bow', quoted_price_cp: 1000, deposit_paid_cp: 0, balance_cp: 1000,
      commissioned_game_day: 120, deadline_game_day: 130, status: 'pending',
    });
    made.orders.push(id);
    check((await row(id)).deadline_abs_day === null, 'the legacy row carries no absolute deadline');
    const readied = await processDueOrders({ day: 500, dayOfYear: 135 });
    const r = await row(id);
    check(readied.some((o) => o.id === id) && r.status === 'ready' && r.ready_game_day === 135 && r.ready_abs_day === 500, 'it readies on day-of-year 130 ≤ 135 as before, and gains an absolute ready day');
    const notYet = await expireStaleReadyOrders({ day: 530, dayOfYear: 165 });
    check(!notYet.some((o) => o.id === id) && (await row(id)).status === 'ready', '30 days held: not expired');
    const gone = await expireStaleReadyOrders({ day: 531, dayOfYear: 166 });
    check(gone.some((o) => o.id === id), '31 days held: expired');
    check((await processDueOrders(999999)).every((o) => o.character_id !== w.ch), 'a bare number still works (both scales equal)');
  }

  // =========================================================================
  group('6. Migration 120, per case');
  {
    const adapter = {
      async execute(q) {
        const sql = typeof q === 'string' ? q : q.sql;
        const args = typeof q === 'string' ? [] : (q.args || []);
        if (/^\s*(SELECT|PRAGMA)/i.test(sql)) return { rows: await dbAll(sql, args) };
        await dbRun(sql, args);
        return { rows: [] };
      },
    };
    const same = await world('MigSame', { day: 200, dayOfYear: 200, year: 1491 });
    const diff = await world('MigDiff', { day: 600, dayOfYear: 235, year: 1492 });
    const mk = async (w, item, status, extra = {}) => {
      const id = await insertRow('merchant_orders', {
        merchant_id: w.m, character_id: w.ch, item_name: item, quoted_price_cp: 1000, deposit_paid_cp: 0, balance_cp: 1000,
        commissioned_game_day: 190, deadline_game_day: 205, status, ...extra,
      });
      made.orders.push(id);
      return id;
    };
    const samePending = await mk(same, 'TEST_YC Mig P', 'pending');
    const sameReady = await mk(same, 'TEST_YC Mig R', 'ready', { ready_game_day: 199 });
    const sameCollected = await mk(same, 'TEST_YC Mig C', 'collected', { ready_game_day: 199, collected_game_day: 199 });
    const diffPending = await mk(diff, 'TEST_YC Mig DP', 'pending');
    const diffReady = await mk(diff, 'TEST_YC Mig DR', 'ready', { ready_game_day: 230 });
    await migration120(adapter);
    await migration120(adapter); // idempotent
    const sp = await row(samePending); const sr = await row(sameReady); const sc = await row(sameCollected);
    const dp = await row(diffPending); const dr = await row(diffReady);
    check(sp.deadline_abs_day === 205 && sp.deadline_game_day === 205 && sp.status === 'pending', 'same-scale campaign, pending: the deadline copied across unchanged (it already was the absolute day)');
    check(sr.ready_abs_day === 199 && sr.deadline_abs_day === 205 && sr.status === 'ready', 'same-scale campaign, ready: ready day and deadline copied across');
    check(sc.deadline_abs_day === null && sc.ready_abs_day === null && sc.status === 'collected', 'collected order: history, left alone');
    check(dp.deadline_abs_day === null && dp.deadline_game_day === 205 && dp.status === 'pending', 'scales differ, pending: no year recorded — NOT guessed; left on its day-of-year comparison');
    check(dr.ready_abs_day === null && dr.ready_game_day === 230 && dr.status === 'ready', 'scales differ, ready: NOT guessed; left on its day-of-year comparison');
  }
} catch (e) {
  failed++;
  console.log(`  ✗ unexpected error: ${e.stack || e.message}`);
} finally {
  const del = async (sql, ids) => { if (ids.length) await dbRun(sql.replace('?', ids.map(() => '?').join(',')), ids).catch(() => {}); };
  await del('DELETE FROM narrative_queue WHERE character_id IN (?)', made.chars);
  await del('DELETE FROM merchant_orders WHERE id IN (?)', made.orders);
  await del('DELETE FROM merchant_inventories WHERE id IN (?)', made.merchants);
  await del('DELETE FROM characters WHERE id IN (?)', made.chars);
  await del('DELETE FROM world_clock WHERE campaign_id IN (?)', made.campaigns);
  await del('DELETE FROM campaigns WHERE id IN (?)', made.campaigns);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
