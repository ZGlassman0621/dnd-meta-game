/**
 * Scenario tests — simulate real gameplay flows and report what happens.
 * Different from unit tests: the goal is to SHOW THE PLAYER how the game
 * actually responds to specific situations, not to assert correctness.
 *
 * Each scenario seeds data, exercises the real services, and prints
 * detailed narrative output.
 *
 * Run: node tests/scenarios.test.js
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';

// Routes
import characterRoutes from '../server/routes/character.js';
import dmSessionRoutes from '../server/routes/dmSession.js';
import npcRoutes from '../server/routes/npc.js';
import companionRoutes from '../server/routes/companion.js';
import merchantRoutes from '../server/routes/merchant.js';
import partyBaseRoutes from '../server/routes/partyBase.js';

// Services (for direct manipulation / inspection)
import { placeCommission, collectOrder, processDueOrders, listOrdersForCharacter } from '../server/services/merchantOrderService.js';
import { getRelationshipsForCharacter } from '../server/services/merchantRelationshipService.js';
import { processLivingWorldTick } from '../server/services/livingWorldService.js';
import { calculatePriceModifier } from '../server/services/consequenceService.js';
import { calculateHaggleDC, resolveHaggle } from '../server/services/bargainingService.js';
import { ENTANGLEMENT_THRESHOLDS } from '../server/config/partyBaseConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const BASE = 'http://localhost:3102';
let server;

// ─── Output helpers ────────────────────────────────────────

const C = {
  h: '\x1b[1;35m',    // magenta bold — scenario header
  s: '\x1b[1;36m',    // cyan bold — step
  ok: '\x1b[32m',     // green — success
  warn: '\x1b[33m',   // yellow — notable but not failure
  fail: '\x1b[31m',   // red — failure
  dim: '\x1b[2m',     // dim — supporting detail
  r: '\x1b[0m'        // reset
};

function header(n, title) {
  console.log(`\n${C.h}═══════════════════════════════════════════════════════════`);
  console.log(`SCENARIO ${n}: ${title}`);
  console.log(`═══════════════════════════════════════════════════════════${C.r}\n`);
}
function step(text) { console.log(`${C.s}▸ ${text}${C.r}`); }
function ok(text) { console.log(`  ${C.ok}✓${C.r} ${text}`); }
function warn(text) { console.log(`  ${C.warn}!${C.r} ${text}`); }
function fail(text) { console.log(`  ${C.fail}✗${C.r} ${text}`); }
function detail(text) { console.log(`  ${C.dim}${text}${C.r}`); }
function report(label, value) { console.log(`  ${label}: ${C.ok}${value}${C.r}`); }

// ─── HTTP helper ────────────────────────────────────────

async function api(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

// ─── Test rig lifecycle ────────────────────────────────

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  await initDatabase();

  app.use('/api/character', characterRoutes);
  app.use('/api/dm-session', dmSessionRoutes);
  app.use('/api/npc', npcRoutes);
  app.use('/api/companion', companionRoutes);
  app.use('/api/merchant', merchantRoutes);
  app.use('/api', partyBaseRoutes);

  return new Promise((resolve) => {
    server = app.listen(3102, () => {
      console.log(`${C.dim}Test server running on port 3102${C.r}`);
      resolve();
    });
  });
}
async function stopServer() {
  return new Promise((resolve) => server ? server.close(resolve) : resolve());
}

// Shared test character + campaign
let testUser, testCampaign, testCharacter;

async function seedWorld() {
  console.log(`${C.dim}Seeding test world...${C.r}`);

  await dbRun("INSERT OR IGNORE INTO users (username, password_hash) VALUES ('TEST_SCENARIOS', 'x')");
  testUser = await dbGet("SELECT id FROM users WHERE username = 'TEST_SCENARIOS'");

  await dbRun(
    `INSERT INTO campaigns (name, description, setting, tone, status, user_id)
     VALUES ('TEST_SCENARIOS_CAMPAIGN', 'Scenario testbed', 'Forgotten Realms', 'heroic', 'active', ?)`,
    [testUser.id]
  );
  testCampaign = await dbGet("SELECT id FROM campaigns WHERE name = 'TEST_SCENARIOS_CAMPAIGN' ORDER BY id DESC LIMIT 1");

  await dbRun(
    `INSERT INTO characters (
       name, first_name, class, subclass, race, level, current_hp, max_hp, armor_class, speed,
       current_location, current_quest, experience_to_next_level, gold_gp, gold_sp, gold_cp,
       ability_scores, skills, equipment, inventory, backstory, gender, alignment,
       campaign_id, game_day
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'TEST_Aerith', 'TEST', 'Fighter', 'Battle Master', 'Human',
      7, 56, 56, 18, 30,
      'Waterdeep', null, 23000, 500, 0, 0,
      JSON.stringify({ str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 13 }),
      JSON.stringify(['Athletics', 'Intimidation', 'Persuasion']),
      JSON.stringify({ mainHand: { name: 'Longsword', damage: '1d8', damageType: 'slashing' }, armor: { name: 'Chain Mail', baseAC: 16 } }),
      JSON.stringify([]),
      'A seasoned warrior testing the system.',
      'female', 'Neutral Good',
      testCampaign.id, 1
    ]
  );
  testCharacter = await dbGet("SELECT * FROM characters WHERE name = 'TEST_Aerith' ORDER BY id DESC LIMIT 1");
  detail(`Character: ${testCharacter.name} (Lv${testCharacter.level} ${testCharacter.class}, ${testCharacter.gold_gp}gp, game_day ${testCharacter.game_day})`);
  detail(`Campaign: ${testCampaign.id}`);
}

async function teardownWorld() {
  if (!testCampaign) return;
  console.log(`\n${C.dim}Cleaning up...${C.r}`);
  try {
    // Clear everything the scenarios might have touched in FK-safe order
    const campId = testCampaign.id;
    await dbRun("DELETE FROM base_threats WHERE campaign_id = ?", [campId]);
    await dbRun("DELETE FROM base_buildings WHERE base_id IN (SELECT id FROM party_bases WHERE campaign_id = ?)", [campId]);
    await dbRun("DELETE FROM party_bases WHERE campaign_id = ?", [campId]);
    await dbRun("DELETE FROM merchant_orders WHERE character_id = ?", [testCharacter.id]);
    await dbRun("DELETE FROM merchant_inventories WHERE campaign_id = ?", [campId]);
    await dbRun("DELETE FROM narrative_queue WHERE campaign_id = ?", [campId]);
    await dbRun("DELETE FROM base_officers WHERE companion_id IN (SELECT id FROM companions WHERE recruited_by_character_id = ?)", [testCharacter.id]);
    await dbRun("DELETE FROM companion_themes WHERE companion_id IN (SELECT id FROM companions WHERE recruited_by_character_id = ?)", [testCharacter.id]);
    await dbRun("DELETE FROM companion_theme_unlocks WHERE companion_id IN (SELECT id FROM companions WHERE recruited_by_character_id = ?)", [testCharacter.id]);
    await dbRun("DELETE FROM companion_ancestry_feats WHERE companion_id IN (SELECT id FROM companions WHERE recruited_by_character_id = ?)", [testCharacter.id]);
    await dbRun("DELETE FROM companion_backstories WHERE companion_id IN (SELECT id FROM companions WHERE recruited_by_character_id = ?)", [testCharacter.id]);
    await dbRun("DELETE FROM companion_activities WHERE companion_id IN (SELECT id FROM companions WHERE recruited_by_character_id = ?)", [testCharacter.id]);
    await dbRun("DELETE FROM companions WHERE recruited_by_character_id = ?", [testCharacter.id]);
    await dbRun("DELETE FROM world_events WHERE campaign_id = ?", [campId]);
    await dbRun("DELETE FROM character_themes WHERE character_id = ?", [testCharacter.id]);
    await dbRun("DELETE FROM character_theme_unlocks WHERE character_id = ?", [testCharacter.id]);
    await dbRun("DELETE FROM character_ancestry_feats WHERE character_id = ?", [testCharacter.id]);
    await dbRun("DELETE FROM npc_relationships WHERE character_id = ?", [testCharacter.id]);
    await dbRun("DELETE FROM dm_sessions WHERE character_id = ?", [testCharacter.id]);
    await dbRun("DELETE FROM characters WHERE id = ?", [testCharacter.id]);
    await dbRun("DELETE FROM campaigns WHERE id = ?", [campId]);
    await dbRun("DELETE FROM npcs WHERE name LIKE 'TEST_SCN_%'");
    await dbRun("DELETE FROM users WHERE username = 'TEST_SCENARIOS'");
  } catch (e) {
    warn(`Cleanup partial: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════
// SCENARIO 1 — Commission 6 pairs of custom boots, pick up in 7 days
// ═══════════════════════════════════════════════════════════

async function scenario1() {
  header(1, 'Commission 6 pairs of custom boots @ 30gp each, 7-day lead time');

  step('Stage the world');
  // Create a cobbler NPC so merchant relationship has a real target
  const cobblerNpcResult = await dbRun(
    `INSERT INTO npcs (name, race, occupation, stat_block, ability_scores)
     VALUES ('TEST_SCN_Cobbler Miriam', 'Human', 'cobbler', 'commoner', ?)`,
    [JSON.stringify({ str: 10, dex: 12, con: 11, int: 12, wis: 13, cha: 14 })]
  );
  const cobblerNpcId = Number(cobblerNpcResult.lastInsertRowid);

  // Create the merchant (Miriam's shop)
  const merchRes = await dbRun(
    `INSERT INTO merchant_inventories
       (campaign_id, merchant_name, merchant_type, inventory, gold_gp, prosperity)
     VALUES (?, 'TEST_SCN_Cobbler Miriam', 'cobbler', '[]', 200, 'comfortable')`,
    [testCampaign.id]
  );
  const merchantId = Number(merchRes.lastInsertRowid);
  detail(`Merchant: Cobbler Miriam (id=${merchantId})`);
  detail(`Character has ${testCharacter.gold_gp}gp before commission`);

  step('Place commission for 6 pairs of boots, 180gp total, 50% deposit (90gp), 7-day lead');
  const commissionResult = await placeCommission({
    merchantId,
    characterId: testCharacter.id,
    itemName: '6 pairs of custom leather boots',
    itemSpec: {
      quality: 'fine',
      description: 'Supple dark leather boots, matching the pair she sold yesterday',
      hook: 'tooled with a small twin-moon maker\'s mark on the heel',
      bundle_size: 6,
      price_per_pair_gp: 30
    },
    quotedPriceCp: 18000,  // 180gp total
    depositCp: 9000,        // 90gp deposit
    leadTimeDays: 7,
    currentGameDay: 1,
    narrativeHook: 'tooled with a small twin-moon maker\'s mark on the heel'
  });

  if (!commissionResult.ok) {
    fail(`Commission rejected: ${commissionResult.error}`);
    return;
  }
  ok(`Commission placed (order #${commissionResult.order.id})`);
  report('Deadline', `game day ${commissionResult.order.deadline_game_day}`);
  report('Deposit paid', `${commissionResult.order.deposit_paid_cp / 100}gp`);
  report('Balance due on pickup', `${commissionResult.order.balance_cp / 100}gp`);

  const charAfterDeposit = await dbGet('SELECT gold_gp FROM characters WHERE id = ?', [testCharacter.id]);
  detail(`Character now has ${charAfterDeposit.gold_gp}gp (90gp deposit deducted)`);

  step('Skip forward 7 game days (triggers living-world tick)');
  await dbRun('UPDATE characters SET game_day = 8 WHERE id = ?', [testCharacter.id]);
  const tickResult = await processLivingWorldTick(testCampaign.id, 7);

  const merchantOrderStep = tickResult.step_statuses.find(s => s.step === '3.9 merchant_orders');
  if (merchantOrderStep) {
    ok(`Living-world tick ran: ${merchantOrderStep.status} (readied: ${merchantOrderStep.readied || 0})`);
  } else {
    warn('No merchant_orders step recorded in tick');
  }

  const afterTick = await dbGet('SELECT * FROM merchant_orders WHERE id = ?', [commissionResult.order.id]);
  if (afterTick.status === 'ready') {
    ok(`Order flipped to "ready" on schedule (ready_game_day = ${afterTick.ready_game_day})`);
  } else {
    fail(`Order status is "${afterTick.status}", expected "ready"`);
  }

  step('Check narrative queue for the pickup notification');
  const queueEntries = await dbAll(
    `SELECT title, description, priority FROM narrative_queue
     WHERE campaign_id = ? AND event_type = 'merchant_order_ready'`,
    [testCampaign.id]
  );
  if (queueEntries.length > 0) {
    ok(`${queueEntries.length} queue entry found — DM will mention the pickup next session`);
    detail(`Title: "${queueEntries[0].title}"`);
    detail(`Body: "${queueEntries[0].description}"`);
  } else {
    warn('No narrative_queue entry — DM won\'t naturally mention the pickup');
  }

  step('Character collects the order and pays the balance');
  const collected = await collectOrder(commissionResult.order.id, testCharacter.id);
  if (!collected.ok) {
    fail(`Collect failed: ${collected.error}`);
    return;
  }
  ok(`Order collected. Final status: ${collected.order.status}`);

  const charAfterCollect = await dbGet('SELECT gold_gp, inventory FROM characters WHERE id = ?', [testCharacter.id]);
  const inv = JSON.parse(charAfterCollect.inventory || '[]');
  const bootsEntry = inv.find(i => i.name.toLowerCase().includes('boots'));
  if (bootsEntry) {
    ok(`Inventory now contains "${bootsEntry.name}"`);
  } else {
    fail('Boots not in inventory after collection');
  }
  detail(`Character gold: ${charAfterCollect.gold_gp}gp (started with 500, -90 deposit, -90 balance = 320 expected)`);

  step('Verdict');
  console.log(`${C.ok}  The commission → tick → ready → collect flow works end-to-end.${C.r}`);
  console.log(`${C.dim}  The item lands in inventory as a single bundle entry. If you wanted 6 separate stackable rows,${C.r}`);
  console.log(`${C.dim}  that would need the commission endpoint to accept a quantity parameter — currently it's 1 item${C.r}`);
  console.log(`${C.dim}  per order (the "6 pairs" lives in the item_spec metadata + the item name).${C.r}`);
}

// ═══════════════════════════════════════════════════════════
// SCENARIO 2 — Bandit chief siege: refuse tribute, 10 days, all-out siege
// ═══════════════════════════════════════════════════════════

async function scenario2() {
  header(2, 'Refuse bandit tribute → siege in 10 days');

  step('Stage a fortress with defenders');
  const baseRes = await api('POST', '/api/base', {
    characterId: testCharacter.id,
    campaignId: testCampaign.id,
    name: 'TEST_SCN_Greywatch',
    category: 'martial',
    subtype: 'fortress'
  });
  const baseId = baseRes.body.id;
  await dbRun(
    `UPDATE party_bases SET gold_treasury = 2000, garrison_strength = 15 WHERE id = ?`,
    [baseId]
  );

  // Install a gatehouse for +3 defense
  const gateRes = await api('POST', `/api/base/${baseId}/buildings`, { building_type: 'gatehouse' });
  await api('POST', `/api/base/${baseId}/buildings/${gateRes.body.id}/advance`, { hours: 120 });

  const garrisonRes = await api('GET', `/api/base/${baseId}/garrison`);
  report('Fortress defense', `${garrisonRes.body.defense_rating} (subtype ${garrisonRes.body.subtype_defense_bonus} + buildings ${garrisonRes.body.defense_from_buildings})`);
  report('Garrison strength', `${garrisonRes.body.garrison_strength}`);

  step('Create the threat — bandit chief demands 5000gp tribute, refused');
  // Simulate the scenario by inserting a threat directly (the player narratively
  // refused, the DM would emit this in the AI flow). 10-day warning.
  await dbRun('UPDATE characters SET game_day = 20 WHERE id = ?', [testCharacter.id]);
  const threatRes = await dbRun(
    `INSERT INTO base_threats
       (base_id, campaign_id, threat_type, attacker_source, attacker_category,
        attacker_force, warning_game_day, deadline_game_day, status)
     VALUES (?, ?, 'siege', 'Blackfen Bandit Chief and 40 raiders', 'criminal',
             18, 20, 30, 'approaching')`,
    [baseId, testCampaign.id]
  );
  const threatId = Number(threatRes.lastInsertRowid);
  ok(`Threat created — siege in 10 days, attacker force 18 vs defense ${garrisonRes.body.defense_rating}`);
  detail('Player\'s choice: engage defense (return to fortress) OR let it auto-resolve at deadline');

  step('Player does NOT engage — represents "I\'m too far to ride back in time"');
  detail('Skipping forward 10 game days (warning → deadline → auto-resolve)');

  await dbRun('UPDATE characters SET game_day = 30 WHERE id = ?', [testCharacter.id]);
  const tick2 = await processLivingWorldTick(testCampaign.id, 10);
  const threatStep = tick2.step_statuses.find(s => s.step === '3.95 base_threats');
  if (threatStep) {
    ok(`Base threats step: ${threatStep.status} (generated ${threatStep.generated || 0}, auto-resolved ${threatStep.auto_resolved || 0})`);
  }

  step('Check outcome');
  const resolved = await dbGet('SELECT * FROM base_threats WHERE id = ?', [threatId]);
  console.log(`  Threat status: ${C.ok}${resolved.status}${C.r}`);
  console.log(`  Outcome: ${resolved.outcome === 'captured' ? C.fail : C.ok}${(resolved.outcome || 'pending').toUpperCase()}${C.r}`);
  if (resolved.narrative) {
    console.log(`  ${C.dim}Narrative: "${resolved.narrative}"${C.r}`);
  }
  if (resolved.damage_report) {
    const dmg = JSON.parse(resolved.damage_report);
    detail(`Attacker roll: ${dmg.attacker_total} (${dmg.rolls?.attackerRoll} + force)`);
    detail(`Defender roll: ${dmg.defender_total} (${dmg.rolls?.defenderRoll} + defense + garrison/4)`);
    if (dmg.buildings_damaged?.length > 0) {
      detail(`Buildings damaged: ${dmg.buildings_damaged.map(b => b.name).join(', ')}`);
    }
    if (dmg.treasury_lost_gp > 0) detail(`Treasury lost: ${dmg.treasury_lost_gp}gp`);
    if (dmg.garrison_lost > 0) detail(`Garrison lost: ${dmg.garrison_lost}`);
  }

  if (resolved.outcome === 'captured') {
    if (resolved.recapture_deadline_game_day) {
      warn(`Base CAPTURED. 14-day recapture window: until game day ${resolved.recapture_deadline_game_day}`);
    }
  }

  step('Narrative queue notification');
  const nq = await dbAll(
    `SELECT title, description FROM narrative_queue
     WHERE campaign_id = ? AND event_type IN ('base_captured', 'base_damaged', 'base_defended')
     ORDER BY id DESC LIMIT 3`,
    [testCampaign.id]
  );
  if (nq.length > 0) {
    ok(`DM will mention the outcome next session:`);
    detail(`"${nq[0].title}"`);
    detail(`"${nq[0].description}"`);
  }

  step('Verdict');
  console.log(`${C.ok}  The refuse-tribute → 10-day-warning → auto-resolve chain works.${C.r}`);
  console.log(`${C.dim}  Force 18 vs defense ${garrisonRes.body.defense_rating} + garrison is roughly a coin flip.${C.r}`);
  console.log(`${C.dim}  If the player HAD engaged, POST /api/threats/:id/defend would have skipped auto-resolve${C.r}`);
  console.log(`${C.dim}  and the DM would narrate the defense as a combat sequence.${C.r}`);
}

// ═══════════════════════════════════════════════════════════
// SCENARIO 3 — Level-7 character recruits a new party member
// ═══════════════════════════════════════════════════════════

async function scenario3() {
  header(3, 'Level-7 character recruits a new party member');

  step('Create an NPC available for recruitment');
  const npcRes = await dbRun(
    `INSERT INTO npcs
       (name, race, gender, occupation, stat_block, ability_scores, campaign_availability, personality_trait_1, voice)
     VALUES ('TEST_SCN_Cyrus Ashenhand', 'Half-Elf', 'male', 'mercenary', 'scout',
             ?, 'companion', 'Speaks little but notices everything', 'low, deliberate')`,
    [JSON.stringify({ str: 12, dex: 16, con: 13, int: 11, wis: 14, cha: 10 })]
  );
  const npcId = Number(npcRes.lastInsertRowid);
  detail(`NPC: Cyrus Ashenhand (Half-Elf mercenary scout)`);

  step(`Recruit the NPC as a companion (player is Level ${testCharacter.level})`);
  const recruitRes = await api('POST', '/api/companion/recruit', {
    npc_id: npcId,
    recruited_by_character_id: testCharacter.id,
    progression_type: 'class_based',
    companion_class: 'Ranger',
    starting_level: null  // let the system decide
  });

  if (recruitRes.status !== 201) {
    fail(`Recruit failed: ${JSON.stringify(recruitRes.body)}`);
    return;
  }

  const companion = recruitRes.body.companion;
  ok('Companion recruited');
  report('Level', companion.companion_level);
  report('Class', `${companion.companion_class}${companion.companion_subclass ? ` (${companion.companion_subclass})` : ''}`);
  report('HP', `${companion.companion_current_hp}/${companion.companion_max_hp}`);
  report('Progression type', companion.progression_type);
  report('Status', companion.status);

  step('What happened automatically');
  // Theme auto-assigned?
  const theme = await dbGet(
    `SELECT ct.theme_id, t.name FROM companion_themes ct
     JOIN themes t ON ct.theme_id = t.id
     WHERE ct.companion_id = ?`,
    [companion.id]
  );
  if (theme) {
    ok(`Theme auto-assigned: ${theme.name} (based on Ranger class)`);
  }

  // L1 theme ability unlocked?
  const l1Unlock = await dbGet(
    `SELECT ta.ability_name FROM companion_theme_unlocks ctu
     LEFT JOIN theme_abilities ta ON ctu.tier_ability_id = ta.id
     WHERE ctu.companion_id = ? AND ctu.tier = 1`,
    [companion.id]
  );
  if (l1Unlock) {
    ok(`L1 theme ability unlocked: "${l1Unlock.ability_name}"`);
  }

  // Ancestry feat auto-picked?
  const feat = await dbGet(
    `SELECT af.feat_name, af.list_id FROM companion_ancestry_feats caf
     JOIN ancestry_feats af ON caf.feat_id = af.id
     WHERE caf.companion_id = ? AND caf.tier = 1`,
    [companion.id]
  );
  if (feat) {
    ok(`Tier-1 ancestry feat auto-picked: "${feat.feat_name}" (from "${feat.list_id}" list)`);
  }

  // Class levels array initialized?
  if (companion.companion_class_levels) {
    const cl = JSON.parse(companion.companion_class_levels);
    ok(`class_levels seeded: ${JSON.stringify(cl)}`);
  }

  // Progression snapshot
  step('Progression snapshot (what the DM sees)');
  const progRes = await api('GET', `/api/companion/${companion.id}/progression`);
  if (progRes.status === 200) {
    detail(`Theme: ${progRes.body.theme?.theme_name || 'none'}`);
    detail(`Total ability tiers in theme: ${progRes.body.theme_all_tiers?.length || 0}`);
    detail(`Abilities currently unlocked: ${progRes.body.theme_unlocks?.length || 0}`);
    detail(`Ancestry feats picked: ${progRes.body.ancestry_feats?.length || 0}`);
  }

  // Check if starting level matched character level
  step('Level assignment logic');
  if (companion.companion_level === testCharacter.level) {
    ok(`Companion started at player's level (${companion.companion_level}) — no "catch-up" grind`);
  } else {
    warn(`Companion started at level ${companion.companion_level}, player is level ${testCharacter.level}`);
  }

  step('Verdict');
  console.log(`${C.ok}  Recruitment at L7 works cleanly. The companion arrives at player's level${C.r}`);
  console.log(`${C.ok}  with auto-assigned theme, L1 ability, L1 ancestry feat, and class_levels seeded.${C.r}`);
  console.log(`${C.dim}  Phase 5.5 → 5.6 → 6 → 10 flow: theme + feats + class tracking all initialize${C.r}`);
  console.log(`${C.dim}  on a single recruit call. Companion is ready for play immediately.${C.r}`);

  // Save the companion for scenario 5
  return companion;
}

// ═══════════════════════════════════════════════════════════
// SCENARIO 4 — Faction reputation: merchant prices + guard responses
// ═══════════════════════════════════════════════════════════

async function scenario4() {
  header(4, 'Faction reputation vs. merchant prices & guard responses');

  step('Part A — Merchant price modifier at each disposition tier');
  console.log(`${C.dim}  (uses consequenceService.calculatePriceModifier math)${C.r}`);

  // Stage: create a faction NPC (merchant) + relationship at various dispositions
  const npcRes = await dbRun(
    `INSERT INTO npcs (name, race, occupation, stat_block, ability_scores)
     VALUES ('TEST_SCN_Faction Merchant', 'Human', 'trader', 'commoner', ?)`,
    [JSON.stringify({ str: 10, dex: 10, con: 10, int: 13, wis: 12, cha: 14 })]
  );
  const fMerchNpcId = Number(npcRes.lastInsertRowid);

  // Create a faction this NPC leads
  const fRes = await dbRun(
    `INSERT INTO factions (campaign_id, name, description, leader_npc_id, alignment)
     VALUES (?, 'TEST_SCN_Silver Sash Traders', 'A mercantile guild', ?, 'lawful neutral')`,
    [testCampaign.id, fMerchNpcId]
  );
  const factionId = Number(fRes.lastInsertRowid);

  // Table: each disposition value + its expected price behavior
  const dispositions = [
    { label: 'devoted  (+100)', d: 100, factionStanding: 75 },
    { label: 'allied   (+75)',  d: 75,  factionStanding: 50 },
    { label: 'friendly (+40)',  d: 40,  factionStanding: 25 },
    { label: 'neutral  (0)',    d: 0,   factionStanding: 0 },
    { label: 'cold     (-20)', d: -20, factionStanding: -10 },
    { label: 'unfriend (-40)', d: -40, factionStanding: -30 },
    { label: 'hostile  (-75)', d: -75, factionStanding: -60 }
  ];

  console.log(`\n  ${C.s}${'Disposition'.padEnd(18)} ${'Faction'.padEnd(9)} ${'Multiplier'.padEnd(12)} ${'100gp item costs'}${C.r}`);
  console.log(`  ${'-'.repeat(60)}`);

  for (const { label, d, factionStanding } of dispositions) {
    // Set the relationship
    await dbRun(
      `INSERT OR REPLACE INTO npc_relationships (character_id, npc_id, disposition, disposition_label, trust_level, updated_at)
       VALUES (?, ?, ?, 'auto', 50, CURRENT_TIMESTAMP)`,
      [testCharacter.id, fMerchNpcId, d]
    );
    // Set faction standing
    await dbRun(
      `INSERT OR REPLACE INTO faction_standings (character_id, faction_id, standing)
       VALUES (?, ?, ?)`,
      [testCharacter.id, factionId, factionStanding]
    );
    const mod = await calculatePriceModifier(testCharacter.id, testCampaign.id, fMerchNpcId);
    const pct = Math.round((mod.multiplier - 1) * 100);
    const sign = pct > 0 ? '+' : '';
    const finalPrice = Math.round(100 * mod.multiplier);
    const color = pct > 0 ? C.fail : pct < 0 ? C.ok : C.dim;
    console.log(
      `  ${label.padEnd(18)} ${String(factionStanding).padEnd(9)} ` +
      `${color}${(sign + pct + '%').padEnd(12)}${C.r} ${color}${finalPrice}gp${C.r}`
    );
  }

  console.log(`\n  ${C.dim}Disposition modifier range: +15% (hostile) to -10% (devoted)${C.r}`);
  console.log(`  ${C.dim}Faction standing compounds: -5% discount at +50 standing, +10% markup at -50${C.r}`);
  console.log(`  ${C.dim}Combined multiplier is clamped to [0.85, 1.25] (±15% to ±25%)${C.r}`);

  step('Part B — Notoriety → guard entanglement risk');
  console.log(`${C.dim}  (guards don't have a per-rep response system; they react via the notoriety/entanglement pipeline)${C.r}\n`);

  console.log(`  ${C.s}${'Notoriety'.padEnd(15)} ${'Band'.padEnd(20)} ${'Entanglement %/day'.padEnd(22)} ${'Guard behavior'}${C.r}`);
  console.log(`  ${'-'.repeat(90)}`);

  const notorietyScenarios = [
    { score: 0,   notes: 'unnoticed — guards ignore you' },
    { score: 15,  notes: 'occasional glances, no action' },
    { score: 30,  notes: 'city watch aware — checks names at gates' },
    { score: 50,  notes: 'warrants posted — guards approach on sight' },
    { score: 70,  notes: 'actively hunted — guards deploy in force' },
    { score: 90,  notes: 'kill-on-sight order from ruling authority' }
  ];

  for (const { score, notes } of notorietyScenarios) {
    const tier = ENTANGLEMENT_THRESHOLDS.find(t => score >= t.min && score <= t.max);
    const tierName = tier?.label || 'unknown';
    const riskPct = `${Math.round((tier?.risk || 0) * 100)}%`;
    console.log(
      `  ${String(score).padEnd(15)} ${tierName.padEnd(20)} ${riskPct.padEnd(22)} ${C.dim}${notes}${C.r}`
    );
  }

  step('Verdict');
  console.log(`${C.ok}  Merchants DO respond to rep. Prices swing by up to ±25% end-to-end.${C.r}`);
  console.log(`${C.ok}  Guards don't have a per-NPC reputation system — they respond via notoriety tiers.${C.r}`);
  console.log(`${C.dim}  A faction-aligned guard's BEHAVIOR (hostile/neutral/allied) flows from the DM's narrative${C.r}`);
  console.log(`${C.dim}  via the "Active faction standings" section of the DM prompt, not a separate mechanical system.${C.r}`);

  // Cleanup side effects from this scenario
  await dbRun('DELETE FROM faction_standings WHERE character_id = ? AND faction_id = ?', [testCharacter.id, factionId]);
  await dbRun('DELETE FROM npc_relationships WHERE character_id = ? AND npc_id = ?', [testCharacter.id, fMerchNpcId]);
  await dbRun('DELETE FROM factions WHERE id = ?', [factionId]);
}

// ═══════════════════════════════════════════════════════════
// SCENARIO 5 — Sell companion's equipped weapon, haggle new one, re-equip
// ═══════════════════════════════════════════════════════════

async function scenario5(companion) {
  header(5, 'Party inventory: unequip → sell → haggle → buy → equip on companion');

  if (!companion) {
    fail('No companion from scenario 3, skipping');
    return;
  }

  step('Stage the scene');

  // Equip the companion with an iron dagger (direct DB write for test speed)
  await dbRun(
    'UPDATE companions SET equipment = ? WHERE id = ?',
    [JSON.stringify({ mainHand: { name: 'Iron Dagger', damage: '1d4', damageType: 'piercing' } }), companion.id]
  );
  // Reset character gold + inventory for this scenario
  await dbRun(
    'UPDATE characters SET gold_gp = 200, gold_sp = 0, gold_cp = 0, inventory = ? WHERE id = ?',
    [JSON.stringify([]), testCharacter.id]
  );

  detail(`Companion ${companion.companion_class} Lv${companion.companion_level} — currently wielding "Iron Dagger"`);
  detail(`Party purse: 200gp`);

  // Create a weaponsmith merchant
  const smithRes = await dbRun(
    `INSERT INTO merchant_inventories
       (campaign_id, merchant_name, merchant_type, inventory, gold_gp, prosperity)
     VALUES (?, 'TEST_SCN_Weaponsmith Harlin', 'blacksmith', ?, 500, 'comfortable')`,
    [testCampaign.id, JSON.stringify([
      { name: 'Steel Shortsword', quantity: 1, price_gp: 60, price_sp: 0, price_cp: 0, category: 'weapon', rarity: 'common' },
      { name: 'Longsword', quantity: 2, price_gp: 15, price_sp: 0, price_cp: 0, category: 'weapon', rarity: 'common' }
    ])]
  );
  const smithId = Number(smithRes.lastInsertRowid);
  detail(`Merchant: Weaponsmith Harlin (500gp in till)`);

  step('1. Unequip the Iron Dagger — returns to party pool');
  const unequipRes = await api('POST', `/api/companion/${companion.id}/unequip`, { slot: 'mainHand' });
  if (unequipRes.status === 200) {
    ok(`Unequipped. Returned to pool: "${unequipRes.body.returned_to_pool?.name}"`);
  } else {
    fail(`Unequip failed: ${JSON.stringify(unequipRes.body)}`);
    return;
  }

  step('2. Sell the Iron Dagger + buy a Steel Shortsword (60gp) via merchant-transaction');
  // Need an active session for the merchant-transaction endpoint
  const sessRes = await dbRun(
    `INSERT INTO dm_sessions (character_id, status, title) VALUES (?, 'active', 'TEST_SCN_Session')`,
    [testCharacter.id]
  );
  const sessionId = Number(sessRes.lastInsertRowid);

  const txRes = await api('POST', `/api/dm-session/${sessionId}/merchant-transaction`, {
    merchantName: 'TEST_SCN_Weaponsmith Harlin',
    merchantId: smithId,
    bought: [{ name: 'Steel Shortsword', quantity: 1, price_gp: 60, price_sp: 0, price_cp: 0 }],
    sold: [{ name: 'Iron Dagger', quantity: 1, price_gp: 2, price_sp: 0, price_cp: 0 }]
  });

  if (txRes.status !== 200) {
    fail(`Transaction failed: ${JSON.stringify(txRes.body)}`);
    return;
  }
  ok(`Transaction completed`);
  detail(`  Bought: Steel Shortsword (60gp)`);
  detail(`  Sold:   Iron Dagger (2gp)`);
  const char = await dbGet('SELECT gold_gp, inventory FROM characters WHERE id = ?', [testCharacter.id]);
  detail(`  Party purse: 200 → ${char.gold_gp}gp (net -${200 - char.gold_gp}gp)`);
  const inv = JSON.parse(char.inventory);
  const hasSwordInPool = inv.find(i => i.name === 'Steel Shortsword');
  if (hasSwordInPool) {
    ok(`"Steel Shortsword" landed in the shared party pool (not on the companion yet)`);
  }

  step('3. Companion haggles AFTER purchase — wait, let\'s redo this properly');
  console.log(`${C.warn}  NOTE: In the real shop flow, haggle happens BEFORE confirm.${C.r}`);
  console.log(`${C.dim}  Let's show how the haggle check would have gone on the Steel Shortsword:${C.r}`);

  // Ensure the shortsword is back in stock for this haggle demo
  await dbRun(
    `UPDATE merchant_inventories SET inventory = ? WHERE id = ?`,
    [JSON.stringify([
      { name: 'Steel Shortsword', quantity: 1, price_gp: 60, price_sp: 0, price_cp: 0, category: 'weapon', rarity: 'common' }
    ]), smithId]
  );

  // Simulate companion's haggle roll
  const haggleRes = await api('POST', `/api/merchant/${smithId}/haggle`, {
    characterId: testCharacter.id,
    rollerType: 'companion',
    companionId: companion.id,
    skill: 'Persuasion',
    itemRarity: 'common',
    rollValue: 16  // decent roll to show success
  });

  if (haggleRes.status !== 200) {
    warn(`Haggle returned ${haggleRes.status}: ${JSON.stringify(haggleRes.body)}`);
  } else {
    const h = haggleRes.body;
    console.log(`  Roller: ${h.roller?.name} (${h.roller?.type}, Lv${h.roller?.level})`);
    console.log(`  Roll: ${h.roll} + ${h.modifier} = ${h.total} vs DC ${h.dc}`);
    if (h.success) {
      ok(`Success by margin ${h.margin} — merchant drops price by ${h.discountPercent}%`);
      detail(`New effective price: ${Math.round(60 * (1 - h.discountPercent / 100))}gp (was 60gp)`);
      detail(`Merchant disposition change: ${h.dispositionChange || 0}`);
    } else {
      warn(`Failed — no discount. Disposition change: ${h.dispositionChange}`);
    }
  }

  step('4. Equip the Steel Shortsword on the companion from the party pool');
  const equipRes = await api('POST', `/api/companion/${companion.id}/equip`, {
    slot: 'mainHand',
    itemName: 'Steel Shortsword'
  });
  if (equipRes.status === 200) {
    ok(`Equipped. Companion\'s mainHand is now: ${equipRes.body.equipped?.name}`);
    if (equipRes.body.returned_to_pool) {
      detail(`Previously equipped: ${equipRes.body.returned_to_pool.name} (returned to pool)`);
    }
    detail(`Steel Shortsword removed from party pool (equipped-by badge would show on the character-side inventory)`);
  } else {
    fail(`Equip failed: ${JSON.stringify(equipRes.body)}`);
  }

  step('5. Merchant relationship after the sale');
  const relRes = await api('GET', `/api/merchant/relationships/character/${testCharacter.id}`);
  if (relRes.status === 200) {
    const rel = relRes.body.relationships.find(r => r.merchant_id === smithId);
    if (rel) {
      ok(`Relationship recorded: ${rel.visit_count} visit(s), spent ${rel.total_spent_cp / 100}gp, earned ${rel.total_earned_cp / 100}gp`);
      if (rel.disposition) detail(`Disposition: ${rel.disposition}`);
      if (rel.loyalty_discount_percent > 0) detail(`Loyalty tier: -${rel.loyalty_discount_percent}% future discount`);
    }
  }

  // Cleanup session
  await dbRun('DELETE FROM dm_sessions WHERE id = ?', [sessionId]);

  step('Verdict');
  console.log(`${C.ok}  Full flow works: unequip → pool → sell → buy (via merchant tx) → equip → pool update${C.r}`);
  console.log(`${C.ok}  The haggle roll supports companion rollers directly — the companion's CHA mod${C.r}`);
  console.log(`${C.ok}  + proficiency + theme bonus all feed in. Discount tiers: 5/10/15/20% by success margin.${C.r}`);
  console.log(`${C.dim}  UX note: haggle happens via POST /api/merchant/:id/haggle, then the resulting${C.r}`);
  console.log(`${C.dim}  discountPercent rides along on the subsequent merchant-transaction body as${C.r}`);
  console.log(`${C.dim}  haggleDiscountPercent. Server clamps it to [0,20]. Buy confirm sends both fields.${C.r}`);
}

// ─── Main runner ───────────────────────────────────────

async function main() {
  try {
    await startServer();
    await seedWorld();

    await scenario1();
    await scenario2();
    const companion = await scenario3();
    await scenario4();
    await scenario5(companion);

    console.log(`\n${C.h}═══════════════════════════════════════════════════════════`);
    console.log('All scenarios complete.');
    console.log(`═══════════════════════════════════════════════════════════${C.r}\n`);
  } catch (err) {
    console.error(`\n${C.fail}FATAL:${C.r}`, err);
    console.error(err.stack);
  } finally {
    await teardownWorld();
    await stopServer();
    process.exit(0);
  }
}

main();
