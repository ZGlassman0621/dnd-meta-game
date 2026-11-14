/**
 * Deferred-resolution sweep (P5-D).
 *
 * With LIVING_WORLD_TICK off, the tick never runs, so time-deferred rows
 * strand silently: companion away-activities stuck in_progress (the companion
 * never returns — a soft-lock), merchant commissions stuck pending (never
 * become ready), and ready orders never expiring. sweepDeferredResolutions
 * runs the same three resolvers the tick would run.
 *
 * Covers: past-due activity resolves (companion returns to active, reunion
 * narrative queued), past-deadline order flips to ready, stale ready order
 * expires, narrative items queued for each, idempotency, not-past-due rows
 * untouched, and missing-args safety.
 *
 * NOTE: resolveActivity asks the local model first; the test runner points
 * OLLAMA_URL at a dead port, so that call fails at once and the
 * deterministic non-AI fallback outcomes are what this file exercises.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import { sweepDeferredResolutions } from '../server/services/deferredResolutionSweep.js';


let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${actual})`);
}

const ids = { campaigns: [], characters: [], npcs: [], companions: [], activities: [], merchants: [], orders: [] };

async function run() {
  await initDatabase();
  console.log('\n=== Test: deferred-resolution sweep ===\n');

  const GAME_DAY = 100;

  // ---- Seed ----
  const camp = await dbRun(`INSERT INTO campaigns (name, setting, status) VALUES ('TEST_Sweep Campaign', 'FR', 'active')`);
  const campaignId = Number(camp.lastInsertRowid); ids.campaigns.push(campaignId);

  const ch = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, campaign_id, game_day, current_location, experience_to_next_level)
     VALUES ('TEST_Sweep Hero', 'Fighter', 'Human', 5, 40, 40, ?, ?, 'Town', 6500)`,
    [campaignId, GAME_DAY]);
  const characterId = Number(ch.lastInsertRowid); ids.characters.push(characterId);

  // Companion away on a past-due activity (legacy stranded row).
  const npc = await dbRun(`INSERT INTO npcs (name, race, occupation, current_location, lifecycle_status) VALUES ('TEST_Sweep Scout', 'Human', 'Scout', 'Town', 'alive')`);
  const npcId = Number(npc.lastInsertRowid); ids.npcs.push(npcId);
  const comp = await dbRun(
    `INSERT INTO companions (npc_id, recruited_by_character_id, status) VALUES (?, ?, 'away')`,
    [npcId, characterId]);
  const companionId = Number(comp.lastInsertRowid); ids.companions.push(companionId);
  const act = await dbRun(
    `INSERT INTO entity_schedule (entity_type, entity_id, entity_name, activity, start_day, end_day, status, details_json)
     VALUES ('companion', ?, 'TEST_Sweep Scout', 'scouting', 90, 95, 'active', ?)`,
    [companionId, JSON.stringify({ companion_id: companionId, character_id: characterId, campaign_id: campaignId })]);
  const activityId = Number(act.lastInsertRowid); ids.activities.push(activityId);
  await dbRun(`UPDATE companions SET away_activity_id = ? WHERE id = ?`, [activityId, companionId]);

  // Companion away on a NOT-past-due activity (must be left alone).
  const npc2 = await dbRun(`INSERT INTO npcs (name, race, occupation, current_location, lifecycle_status) VALUES ('TEST_Sweep Scout 2', 'Human', 'Scout', 'Town', 'alive')`);
  const npcId2 = Number(npc2.lastInsertRowid); ids.npcs.push(npcId2);
  const comp2 = await dbRun(`INSERT INTO companions (npc_id, recruited_by_character_id, status) VALUES (?, ?, 'away')`, [npcId2, characterId]);
  const companionId2 = Number(comp2.lastInsertRowid); ids.companions.push(companionId2);
  const act2 = await dbRun(
    `INSERT INTO entity_schedule (entity_type, entity_id, entity_name, activity, start_day, end_day, status, details_json)
     VALUES ('companion', ?, 'TEST_Sweep Scout 2', 'training', 98, 103, 'active', ?)`,
    [companionId2, JSON.stringify({ companion_id: companionId2, character_id: characterId, campaign_id: campaignId })]);
  const activityId2 = Number(act2.lastInsertRowid); ids.activities.push(activityId2);
  await dbRun(`UPDATE companions SET away_activity_id = ? WHERE id = ?`, [activityId2, companionId2]);

  // Merchant with a past-deadline pending order and a stale ready order.
  const merch = await dbRun(
    `INSERT INTO merchant_inventories (campaign_id, merchant_name, merchant_type) VALUES (?, 'TEST_Sweep Smith', 'blacksmith')`,
    [campaignId]);
  const merchantId = Number(merch.lastInsertRowid); ids.merchants.push(merchantId);
  const ord1 = await dbRun(
    `INSERT INTO merchant_orders (merchant_id, character_id, item_name, quoted_price_cp, deposit_paid_cp, balance_cp, commissioned_game_day, deadline_game_day, status)
     VALUES (?, ?, 'TEST Sword', 10000, 2000, 8000, 90, 95, 'pending')`,
    [merchantId, characterId]);
  const orderId1 = Number(ord1.lastInsertRowid); ids.orders.push(orderId1);
  const ord2 = await dbRun(
    `INSERT INTO merchant_orders (merchant_id, character_id, item_name, quoted_price_cp, deposit_paid_cp, balance_cp, commissioned_game_day, deadline_game_day, ready_game_day, status)
     VALUES (?, ?, 'TEST Shield', 5000, 1000, 4000, 50, 55, 60, 'ready')`,
    [merchantId, characterId]);
  const orderId2 = Number(ord2.lastInsertRowid); ids.orders.push(orderId2);

  // ---- Sweep ----
  const result = await sweepDeferredResolutions(campaignId, characterId, GAME_DAY);
  assertEqual(result.activitiesResolved, 1, 'one past-due activity resolved');
  assertEqual(result.ordersReadied, 1, 'one past-deadline order readied');
  assertEqual(result.ordersExpired, 1, 'one stale ready order expired');

  // Companion returned.
  const compRow = await dbGet(`SELECT status, away_activity_id FROM companions WHERE id = ?`, [companionId]);
  assertEqual(compRow.status, 'active', 'stranded companion returns to active');
  assertEqual(compRow.away_activity_id, null, 'away_activity_id cleared');
  const actRow = await dbGet(`SELECT status FROM entity_schedule WHERE id = ?`, [activityId]);
  assertEqual(actRow.status, 'completed', 'past-due activity marked completed');

  // Not-past-due activity untouched.
  const compRow2 = await dbGet(`SELECT status FROM companions WHERE id = ?`, [companionId2]);
  assertEqual(compRow2.status, 'away', 'not-past-due companion stays away');
  const actRow2 = await dbGet(`SELECT status FROM entity_schedule WHERE id = ?`, [activityId2]);
  assertEqual(actRow2.status, 'active', 'not-past-due activity stays active');

  // Orders flipped.
  const o1 = await dbGet(`SELECT status FROM merchant_orders WHERE id = ?`, [orderId1]);
  assertEqual(o1.status, 'ready', 'past-deadline order becomes ready');
  const o2 = await dbGet(`SELECT status FROM merchant_orders WHERE id = ?`, [orderId2]);
  assertEqual(o2.status, 'expired', 'stale ready order expires');

  // Narrative items queued for the player.
  const queue = await dbAll(
    `SELECT event_type FROM narrative_queue WHERE character_id = ? AND status = 'pending'`,
    [characterId]);
  const types = queue.map(q => q.event_type);
  assert(types.includes('companion_mood_change'), 'reunion narrative queued');
  assert(types.includes('merchant_order_ready'), 'order-ready narrative queued');
  assert(types.includes('merchant_order_expired'), 'order-expired narrative queued');

  // Idempotent: second sweep is a no-op.
  const again = await sweepDeferredResolutions(campaignId, characterId, GAME_DAY);
  assertEqual(again.activitiesResolved, 0, 'second sweep resolves nothing');
  assertEqual(again.ordersReadied, 0, 'second sweep readies nothing');
  assertEqual(again.ordersExpired, 0, 'second sweep expires nothing');

  // Missing args: safe no-op.
  const empty = await sweepDeferredResolutions(null, null, null);
  assertEqual(empty.activitiesResolved, 0, 'null args resolve nothing');

  // ---- Cleanup (children before parents) ----
  await dbRun(`DELETE FROM narrative_queue WHERE character_id = ?`, [characterId]);
  await dbRun(`DELETE FROM entity_schedule WHERE id IN (${ids.activities.join(',')})`);
  await dbRun(`DELETE FROM merchant_orders WHERE id IN (${ids.orders.join(',')})`);
  await dbRun(`DELETE FROM companions WHERE id IN (${ids.companions.join(',')})`);
  await dbRun(`DELETE FROM merchant_inventories WHERE id IN (${ids.merchants.join(',')})`);
  await dbRun(`DELETE FROM npcs WHERE id IN (${ids.npcs.join(',')})`);
  await dbRun(`DELETE FROM characters WHERE id IN (${ids.characters.join(',')})`);
  await dbRun(`DELETE FROM campaigns WHERE id IN (${ids.campaigns.join(',')})`);
  const left = await dbGet(`SELECT COUNT(*) AS n FROM campaigns WHERE id IN (${ids.campaigns.join(',')})`);
  assertEqual(left.n, 0, 'test fixtures removed');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

await run();
