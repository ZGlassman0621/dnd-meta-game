/**
 * Integration tests — starts a real Express server, seeds data, hits real endpoints.
 * Run: node tests/integration.test.js
 *
 * Uses port 3001 to avoid conflicts with dev server.
 * Uses the same local.db database; all test data prefixed with TEST_ and cleaned up.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';

// Route imports (same as server/index.js)
import characterRoutes from '../server/routes/character.js';
import adventureRoutes from '../server/routes/adventure.js';
import uploadRoutes from '../server/routes/upload.js';
import dmSessionRoutes, { pickSeasonalStartDay } from '../server/routes/dmSession.js';
import npcRoutes from '../server/routes/npc.js';
import downtimeRoutes from '../server/routes/downtime.js';
import companionRoutes from '../server/routes/companion.js';
import metaGameRoutes from '../server/routes/metaGame.js';
import storyThreadRoutes from '../server/routes/storyThreads.js';
import campaignRoutes from '../server/routes/campaign.js';
import locationRoutes from '../server/routes/location.js';
import questRoutes from '../server/routes/quest.js';
import narrativeQueueRoutes from '../server/routes/narrativeQueue.js';
import factionRoutes from '../server/routes/faction.js';
import worldEventRoutes from '../server/routes/worldEvent.js';
import travelRoutes from '../server/routes/travel.js';
import npcRelationshipRoutes from '../server/routes/npcRelationship.js';
import livingWorldRoutes from '../server/routes/livingWorld.js';
import dmModeRoutes from '../server/routes/dmMode.js';
import progressionRoutes from '../server/routes/progression.js';
import merchantRoutes from '../server/routes/merchant.js';
import partyBaseRoutes from '../server/routes/partyBase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const BASE = 'http://localhost:3001';
let server;
let testCharId;
let testCampaignId;
let testSessionId;
let testMerchantId;
let testDmModePartyId;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function parseJSON(val) {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

function inRange(day, ranges) {
  return ranges.some(([min, max]) => day >= min && day <= max);
}

// ===== Server Lifecycle =====

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  await initDatabase();

  app.use('/api/character', characterRoutes);
  app.use('/api/adventure', adventureRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/dm-session', dmSessionRoutes);
  app.use('/api/npc', npcRoutes);
  app.use('/api/downtime', downtimeRoutes);
  app.use('/api/companion', companionRoutes);
  app.use('/api/meta-game', metaGameRoutes);
  app.use('/api/story-threads', storyThreadRoutes);
  app.use('/api/campaign', campaignRoutes);
  app.use('/api/location', locationRoutes);
  app.use('/api/quest', questRoutes);
  app.use('/api/narrative-queue', narrativeQueueRoutes);
  app.use('/api/faction', factionRoutes);
  app.use('/api/world-event', worldEventRoutes);
  app.use('/api/travel', travelRoutes);
  app.use('/api/npc-relationship', npcRelationshipRoutes);
  app.use('/api/living-world', livingWorldRoutes);
  app.use('/api/dm-mode', dmModeRoutes);
  app.use('/api/progression', progressionRoutes);
  app.use('/api/merchant', merchantRoutes);
  app.use('/api', partyBaseRoutes); // /api/base, /api/bases, /api/projects, /api/notoriety

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'D&D Meta Game API is running' });
  });

  return new Promise((resolve) => {
    server = app.listen(3001, () => {
      console.log('Test server running on port 3001');
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
}

async function cleanup() {
  console.log('\n--- Cleanup ---');
  try {
    if (testCampaignId) {
      await dbRun('DELETE FROM merchant_inventories WHERE campaign_id = ?', [testCampaignId]);
    }
    if (testCharId) {
      await dbRun('DELETE FROM dm_sessions WHERE character_id = ?', [testCharId]);
    }
    if (testCharId) {
      await dbRun('DELETE FROM characters WHERE id = ?', [testCharId]);
    }
    if (testCampaignId) {
      await dbRun('DELETE FROM campaigns WHERE id = ?', [testCampaignId]);
    }
    if (testDmModePartyId) {
      await dbRun('DELETE FROM dm_sessions WHERE dm_mode_party_id = ?', [testDmModePartyId]);
      await dbRun('DELETE FROM dm_mode_parties WHERE id = ?', [testDmModePartyId]);
    }
    console.log('  Cleanup complete.');
  } catch (err) {
    console.error('  Cleanup error:', err.message);
  }
}

// ===== GROUP 1: Character CRUD & Inventory =====

async function testCreateCharacter() {
  console.log('\n  -- Create Character --');
  const { status, body } = await api('POST', '/api/character', {
    name: 'TEST_IntegrationChar',
    first_name: 'TEST',
    class: 'Cleric',
    subclass: 'Life Domain',
    race: 'Human',
    level: 5,
    current_hp: 38,
    max_hp: 38,
    armor_class: 18,
    speed: 30,
    current_location: 'Waterdeep',
    current_quest: null,
    experience_to_next_level: 6500,
    gold_gp: 100, gold_sp: 50, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 10, dex: 12, con: 14, int: 13, wis: 18, cha: 16 }),
    skills: JSON.stringify(['Medicine', 'Religion', 'Insight', 'Persuasion']),
    equipment: JSON.stringify({ armor: 'Chain Mail', mainHand: 'Mace', offHand: 'Shield' }),
    inventory: JSON.stringify([
      { name: 'Potion of Healing', quantity: 2 },
      { name: 'Holy Symbol', quantity: 1 }
    ]),
    languages: JSON.stringify(['Common', 'Celestial', 'Elvish']),
    feats: JSON.stringify(['War Caster']),
    tool_proficiencies: JSON.stringify(['Herbalism Kit']),
    known_cantrips: JSON.stringify(['Sacred Flame', 'Guidance', 'Light']),
    known_spells: JSON.stringify(['Cure Wounds', 'Guiding Bolt', 'Shield of Faith']),
    spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }),
    backstory: 'A devoted cleric from Waterdeep.',
    gender: 'male',
    alignment: 'Lawful Good'
  });

  assert(status === 201, `POST /api/character returns 201 (got ${status})`);
  assert(body && typeof body.id === 'number', 'Response has numeric id');
  assert(body.name === 'TEST_IntegrationChar', 'Name matches');
  assert(body.level === 5, 'Level matches');
  assert(body.armor_class === 18, 'AC matches');
  assert(body.gold_gp === 100, 'Gold GP matches');
  assert(body.alignment === 'Lawful Good', 'Alignment matches');

  testCharId = body.id;
}

async function testGetCharacter() {
  console.log('\n  -- Get Character --');
  const { status, body } = await api('GET', `/api/character/${testCharId}`);

  assert(status === 200, `GET /api/character/${testCharId} returns 200`);
  assert(body.id === testCharId, 'ID matches');

  const abilityScores = parseJSON(body.ability_scores);
  assert(abilityScores.wis === 18, 'Ability scores: WIS is 18');

  const equipment = parseJSON(body.equipment);
  assert(equipment.armor === 'Chain Mail', 'Equipment: armor is Chain Mail');
  assert(equipment.mainHand === 'Mace', 'Equipment: mainHand is Mace');
  assert(equipment.offHand === 'Shield', 'Equipment: offHand is Shield');

  const inventory = parseJSON(body.inventory);
  assert(Array.isArray(inventory) && inventory.length === 2, 'Inventory has 2 items');
  assert(inventory[0].name === 'Potion of Healing' && inventory[0].quantity === 2, 'Potion of Healing qty 2');

  const languages = parseJSON(body.languages);
  assert(Array.isArray(languages) && languages.includes('Celestial'), 'Languages includes Celestial');

  const feats = parseJSON(body.feats);
  assert(Array.isArray(feats) && feats.includes('War Caster'), 'Feats includes War Caster');

  const tools = parseJSON(body.tool_proficiencies);
  assert(Array.isArray(tools) && tools.includes('Herbalism Kit'), 'Tool proficiencies includes Herbalism Kit');

  const cantrips = parseJSON(body.known_cantrips);
  assert(Array.isArray(cantrips) && cantrips.length === 3, 'Cantrips has 3 entries');

  const spells = parseJSON(body.known_spells);
  assert(Array.isArray(spells) && spells.includes('Guiding Bolt'), 'Known spells includes Guiding Bolt');
}

async function testUpdateCharacter() {
  console.log('\n  -- Update Character --');
  const { status, body } = await api('PUT', `/api/character/${testCharId}`, {
    current_hp: 25,
    gold_gp: 80,
    current_location: "Baldur's Gate"
  });

  assert(status === 200, 'PUT returns 200');
  assert(body.current_hp === 25, 'HP updated to 25');
  assert(body.gold_gp === 80, 'Gold updated to 80');
  assert(body.current_location === "Baldur's Gate", 'Location updated');
  assert(body.max_hp === 38, 'Max HP unchanged');
  assert(body.level === 5, 'Level unchanged');
}

async function testDiscardItemDecrement() {
  console.log('\n  -- Discard Item (decrement) --');
  const { status, body } = await api('POST', `/api/character/${testCharId}/discard-item`, {
    itemName: 'Potion of Healing'
  });

  assert(status === 200, 'Discard returns 200');
  const inventory = parseJSON(body.inventory);
  const potion = inventory.find(i => i.name === 'Potion of Healing');
  assert(potion && potion.quantity === 1, 'Potion quantity decremented to 1');
  assert(inventory.length === 2, 'Still 2 items in inventory');
}

async function testDiscardItemRemove() {
  console.log('\n  -- Discard Item (remove) --');
  const { status, body } = await api('POST', `/api/character/${testCharId}/discard-item`, {
    itemName: 'Potion of Healing'
  });

  assert(status === 200, 'Discard returns 200');
  const inventory = parseJSON(body.inventory);
  assert(inventory.length === 1, 'Only 1 item remains');
  assert(inventory[0].name === 'Holy Symbol', 'Remaining item is Holy Symbol');
}

async function testDiscardItemNotFound() {
  console.log('\n  -- Discard Item (not found) --');
  const { status, body } = await api('POST', `/api/character/${testCharId}/discard-item`, {
    itemName: 'Nonexistent Sword'
  });

  assert(status === 404, 'Returns 404 for missing item');
  assert(body.error && body.error.includes('not found'), 'Error message mentions not found');
}

async function testLongRest() {
  console.log('\n  -- Long Rest --');
  // Set up damaged state with used spell slots
  await api('PUT', `/api/character/${testCharId}`, {
    current_hp: 20,
    spell_slots_used: JSON.stringify({ 1: 2, 2: 1, 3: 0 })
  });

  const { status, body } = await api('POST', `/api/character/rest/${testCharId}`, {
    restType: 'long'
  });

  assert(status === 200, 'Rest returns 200');
  assert(body.success === true, 'Success is true');
  assert(body.newHp === 38, 'HP fully restored to 38');
  assert(body.spell_slots_restored === true, 'Spell slots restored flag is true');

  // Verify DB directly
  const dbChar = await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [testCharId]);
  assert(dbChar.spell_slots_used === '{}', 'DB spell_slots_used reset to empty');
}

// ===== GROUP 2: Campaign Management =====

async function testCreateCampaign() {
  console.log('\n  -- Create Campaign --');
  const { status, body } = await api('POST', '/api/campaign', {
    name: 'TEST_IntegrationCampaign',
    description: 'A winter campaign in the frozen north, where blizzards rage and ice covers the land.',
    setting: 'Forgotten Realms',
    tone: 'dark fantasy',
    starting_location: 'Icewind Dale'
  });

  assert(status === 201, `POST /api/campaign returns 201 (got ${status})`);
  assert(body && typeof body.id === 'number', 'Response has numeric id');
  assert(body.name === 'TEST_IntegrationCampaign', 'Name matches');
  assert(body.setting === 'Forgotten Realms', 'Setting matches');
  assert(body.status === 'active', 'Status is active');

  testCampaignId = body.id;
}

async function testGetCampaign() {
  console.log('\n  -- Get Campaign --');
  const { status, body } = await api('GET', `/api/campaign/${testCampaignId}`);

  assert(status === 200, 'GET returns 200');
  assert(body.id === testCampaignId, 'ID matches');
  assert(body.name === 'TEST_IntegrationCampaign', 'Name matches');
  assert(body.tone === 'dark fantasy', 'Tone matches');
}

async function testAssignCharacter() {
  console.log('\n  -- Assign Character to Campaign --');
  const { status, body } = await api('POST', `/api/campaign/${testCampaignId}/assign-character`, {
    character_id: testCharId
  });

  assert(status === 200, 'Assignment returns 200');
  assert(Number(body.campaign_id) === testCampaignId, 'Character now has campaign_id');
}

async function testCharacterCampaignLink() {
  console.log('\n  -- Character Campaign Link --');
  const { status, body } = await api('GET', `/api/character/${testCharId}/campaign`);

  assert(status === 200, 'GET returns 200');
  assert(body.campaign && body.campaign.id === testCampaignId, 'Campaign object has correct id');
  assert(body.campaign.name === 'TEST_IntegrationCampaign', 'Campaign name matches');
}

async function testCampaignCharacters() {
  console.log('\n  -- Campaign Characters --');
  const { status, body } = await api('GET', `/api/campaign/${testCampaignId}/characters`);

  assert(status === 200, 'GET returns 200');
  assert(Array.isArray(body), 'Response is an array');
  const found = body.find(c => c.id === testCharId);
  assert(found !== undefined, 'Test character appears in campaign roster');
}

// ===== GROUP 3: DM Session Infrastructure =====

async function testCampaignContext() {
  console.log('\n  -- Campaign Context --');
  const { status, body } = await api('GET', `/api/dm-session/campaign-context/${testCharId}`);

  assert(status === 200, 'GET returns 200');
  assert(body.hasPreviousSessions === false, 'No previous sessions');
  assert(body.campaignPlan !== null, 'Campaign plan info present');
  assert(body.campaignPlan.campaignName === 'TEST_IntegrationCampaign', 'Campaign name in plan matches');
  assert(body.campaignPlan.startingLocation === 'Icewind Dale', 'Starting location in plan matches');
}

async function testItemRarityLookup() {
  console.log('\n  -- Item Rarity Lookup (known items) --');
  const { status, body } = await api('POST', '/api/dm-session/item-rarity-lookup', {
    items: ['Potion of Healing', 'Flame Tongue', 'Bag of Holding']
  });

  assert(status === 200, 'POST returns 200');
  assert(body.items && typeof body.items === 'object', 'Response has items object');

  const potion = body.items['potion of healing'];
  assert(potion && potion.rarity === 'common', 'Potion of Healing is common');

  const flame = body.items['flame tongue'];
  assert(flame && flame.rarity === 'rare', 'Flame Tongue is rare');

  const bag = body.items['bag of holding'];
  assert(bag && bag.rarity === 'uncommon', 'Bag of Holding is uncommon');
}

async function testItemRarityUnknown() {
  console.log('\n  -- Item Rarity Lookup (unknown) --');
  const { status, body } = await api('POST', '/api/dm-session/item-rarity-lookup', {
    items: ['Completely Made Up Item']
  });

  assert(status === 200, 'POST returns 200');
  const item = body.items['completely made up item'];
  assert(item === undefined || item === null, 'Unknown item not found in lookup');
}

async function testLlmStatus() {
  console.log('\n  -- LLM Status --');
  const { status, body } = await api('GET', '/api/dm-session/llm-status');

  assert(status === 200, 'GET returns 200');
  assert(typeof body.available === 'boolean', 'Has available boolean');
  assert('provider' in body, 'Has provider field');
}

async function testSeasonalStartDay() {
  console.log('\n  -- Seasonal Start Day (direct function) --');

  // Winter keywords
  let allWinter = true;
  for (let i = 0; i < 20; i++) {
    const day = pickSeasonalStartDay('A cold winter adventure in the frozen north, blizzards rage', '');
    if (!inRange(day, [[1, 61], [336, 365]])) {
      allWinter = false;
      console.error(`    Winter iteration ${i}: day ${day} out of range`);
    }
  }
  assert(allWinter, 'Winter keywords → all 20 results in winter range [1-61, 336-365]');

  // Summer keywords
  const summerDay = pickSeasonalStartDay('The scorching summer heat of the desert', '');
  assert(inRange(summerDay, [[153, 243]]), `Summer keywords → day ${summerDay} in range [153-243]`);

  // Spring keywords
  const springDay = pickSeasonalStartDay('Spring bloom and renewal across the land', '');
  assert(inRange(springDay, [[62, 152]]), `Spring keywords → day ${springDay} in range [62-152]`);

  // Autumn keywords
  const autumnDay = pickSeasonalStartDay('The autumn harvest festival approaches', '');
  assert(inRange(autumnDay, [[244, 335]]), `Autumn keywords → day ${autumnDay} in range [244-335]`);

  // No keywords → any valid day
  const genericDay = pickSeasonalStartDay('A generic adventure', '');
  assert(genericDay >= 1 && genericDay <= 365, `No keywords → day ${genericDay} in [1-365]`);

  // Null input → still valid
  const nullDay = pickSeasonalStartDay(null, null);
  assert(nullDay >= 1 && nullDay <= 365, `Null input → day ${nullDay} in [1-365]`);

  // Location name matching
  const icewindDay = pickSeasonalStartDay('', 'Icewind Dale');
  assert(inRange(icewindDay, [[1, 61], [336, 365]]), `Location "Icewind Dale" → day ${icewindDay} in winter range`);
}

// ===== GROUP 4: Merchant System =====

async function seedTestSession() {
  console.log('\n  -- Seed Test Session --');
  const result = await dbRun(`
    INSERT INTO dm_sessions (character_id, title, setting, tone, model, status, messages)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [testCharId, 'TEST_MerchantSession', 'Waterdeep', 'heroic', 'test', 'active', '[]']);
  testSessionId = Number(result.lastInsertRowid);
  assert(testSessionId > 0, `Seeded test session with id ${testSessionId}`);
}

async function testGenerateMerchantInventory() {
  console.log('\n  -- Generate Merchant Inventory --');
  const { status, body } = await api('POST', `/api/dm-session/${testSessionId}/generate-merchant-inventory`, {
    merchantName: 'TEST_Merchant_Blacksmith',
    merchantType: 'blacksmith',
    location: 'Waterdeep Market'
  });

  assert(status === 200, `POST returns 200 (got ${status})`);
  assert(body.merchantName === 'TEST_Merchant_Blacksmith', 'Merchant name matches');
  assert(body.merchantType === 'blacksmith', 'Merchant type matches');
  assert(Array.isArray(body.inventory) && body.inventory.length > 0, `Inventory has ${body.inventory?.length} items`);
  assert(typeof body.merchantId === 'number', 'merchantId is a number');
  assert(typeof body.merchantGold === 'number' && body.merchantGold > 0, `Merchant has ${body.merchantGold} gold`);

  // Verify item structure
  const item = body.inventory[0];
  assert(item.name && typeof item.name === 'string', 'First item has name');
  assert(typeof item.price_gp === 'number', 'First item has price_gp');

  testMerchantId = body.merchantId;
}

async function testListMerchants() {
  console.log('\n  -- List Merchants --');
  const { status, body } = await api('GET', `/api/dm-session/${testSessionId}/merchants`);

  assert(status === 200, 'GET returns 200');
  assert(Array.isArray(body.merchants), 'Response has merchants array');
  const found = body.merchants.find(m => m.merchant_name === 'TEST_Merchant_Blacksmith');
  assert(found !== undefined, 'Test merchant appears in merchant list');
}

async function testMerchantIdempotent() {
  console.log('\n  -- Merchant Idempotent --');
  const { status, body } = await api('POST', `/api/dm-session/${testSessionId}/generate-merchant-inventory`, {
    merchantName: 'TEST_Merchant_Blacksmith',
    merchantType: 'blacksmith',
    location: 'Waterdeep Market'
  });

  assert(status === 200, 'POST returns 200');
  assert(body.merchantId === testMerchantId, 'Same merchantId returned (idempotent)');
}

async function testMerchantBuy() {
  console.log('\n  -- Merchant Buy --');
  // Reset character state
  await api('PUT', `/api/character/${testCharId}`, {
    gold_gp: 500, gold_sp: 0, gold_cp: 0,
    inventory: JSON.stringify([])
  });

  // Get merchant inventory to find an item to buy
  const merchantRes = await api('POST', `/api/dm-session/${testSessionId}/generate-merchant-inventory`, {
    merchantName: 'TEST_Merchant_Blacksmith',
    merchantType: 'blacksmith',
    location: 'Waterdeep Market'
  });
  const itemToBuy = merchantRes.body.inventory[0];

  const { status, body } = await api('POST', `/api/dm-session/${testSessionId}/merchant-transaction`, {
    merchantName: 'TEST_Merchant_Blacksmith',
    merchantId: testMerchantId,
    bought: [{
      name: itemToBuy.name,
      price_gp: itemToBuy.price_gp,
      price_sp: itemToBuy.price_sp || 0,
      price_cp: itemToBuy.price_cp || 0,
      quantity: 1
    }],
    sold: []
  });

  assert(status === 200, `Transaction returns 200 (got ${status})`);
  assert(body.success === true, 'Transaction success');
  assert(Array.isArray(body.changes) && body.changes.length > 0, 'Has changes array');
  assert(body.changes[0].toLowerCase().includes('bought'), 'Change describes a purchase');
  assert(body.newGold.gp < 500, `Gold decreased from 500 to ${body.newGold.gp}`);

  // Verify item in character inventory via DB
  const dbChar = await dbGet('SELECT inventory FROM characters WHERE id = ?', [testCharId]);
  const inv = parseJSON(dbChar.inventory);
  const purchased = inv.find(i => (i.name || i) === itemToBuy.name);
  assert(purchased !== undefined, `Purchased item "${itemToBuy.name}" found in character inventory`);
}

async function testMerchantInsufficientGold() {
  console.log('\n  -- Merchant Insufficient Gold --');
  // Set gold to 0
  await api('PUT', `/api/character/${testCharId}`, {
    gold_gp: 0, gold_sp: 0, gold_cp: 0
  });

  const { status, body } = await api('POST', `/api/dm-session/${testSessionId}/merchant-transaction`, {
    merchantName: 'TEST_Merchant_Blacksmith',
    merchantId: testMerchantId,
    bought: [{
      name: 'Expensive Plate Armor',
      price_gp: 9999,
      price_sp: 0,
      price_cp: 0,
      quantity: 1
    }],
    sold: []
  });

  assert(status === 400, `Returns 400 (got ${status})`);
  assert(body.error && body.error.toLowerCase().includes('not enough gold'), 'Error mentions insufficient gold');
}

// ===== GROUP 5: Side Panel Data Round-Trip =====

async function testSidePanelData() {
  console.log('\n  -- Side Panel Data Round-Trip --');
  // Re-read the character with all fields
  const { status, body } = await api('GET', `/api/character/${testCharId}`);
  assert(status === 200, 'GET returns 200');

  // Equipment
  const eq = parseJSON(body.equipment);
  assert(eq.armor === 'Chain Mail' && eq.mainHand === 'Mace' && eq.offHand === 'Shield',
    'Equipment JSON round-trips: armor/mainHand/offHand');

  // Languages
  const lang = parseJSON(body.languages);
  assert(Array.isArray(lang) && lang.length === 3 && lang.includes('Elvish'),
    'Languages array round-trips with 3 entries');

  // Feats
  const feats = parseJSON(body.feats);
  assert(Array.isArray(feats) && feats[0] === 'War Caster',
    'Feats array round-trips');

  // Tool proficiencies
  const tools = parseJSON(body.tool_proficiencies);
  assert(Array.isArray(tools) && tools[0] === 'Herbalism Kit',
    'Tool proficiencies round-trips');

  // Cantrips and spells
  const cantrips = parseJSON(body.known_cantrips);
  const spells = parseJSON(body.known_spells);
  assert(cantrips.length === 3 && cantrips.includes('Sacred Flame'),
    'Cantrips round-trip (3 entries, includes Sacred Flame)');
  assert(spells.length === 3 && spells.includes('Shield of Faith'),
    'Known spells round-trip (3 entries, includes Shield of Faith)');
}

// ===== GROUP 6: Player Journal =====

async function testJournalEndpoint() {
  console.log('\n  -- Player Journal (basic) --');
  const { status, body } = await api('GET', `/api/character/${testCharId}/journal`);

  assert(status === 200, `GET /api/character/${testCharId}/journal returns 200`);
  assert(typeof body === 'object', 'Response is an object');

  // NPCs section
  assert(body.npcs && Array.isArray(body.npcs.met), 'npcs.met is an array');
  assert(typeof body.npcs.unknownCount === 'number', 'npcs.unknownCount is a number');

  // Locations section
  assert(body.locations && Array.isArray(body.locations.visited), 'locations.visited is an array');
  assert(Array.isArray(body.locations.rumored), 'locations.rumored is an array');
  assert(typeof body.locations.unknownCount === 'number', 'locations.unknownCount is a number');

  // Factions section
  assert(Array.isArray(body.factions), 'factions is an array');

  // Quests section
  assert(body.quests && Array.isArray(body.quests.active), 'quests.active is an array');
  assert(Array.isArray(body.quests.completed), 'quests.completed is an array');

  // Events section
  assert(Array.isArray(body.events), 'events is an array');

  // Notes section
  assert(typeof body.notes === 'string', 'notes is a string');
}

async function testJournalNotFound() {
  console.log('\n  -- Player Journal (not found) --');
  const { status, body } = await api('GET', '/api/character/99999/journal');

  assert(status === 404, 'Returns 404 for nonexistent character');
  assert(body.error && body.error.includes('not found'), 'Error mentions not found');
}

async function testJournalNoCampaign() {
  console.log('\n  -- Player Journal (no campaign) --');
  // Create a character without a campaign
  const { body: newChar } = await api('POST', '/api/character', {
    name: 'TEST_NoCampaignChar',
    first_name: 'TEST',
    class: 'Fighter',
    race: 'Dwarf',
    level: 1,
    current_hp: 12,
    max_hp: 12,
    armor_class: 16,
    speed: 25,
    current_location: 'Neverwinter',
    current_quest: null,
    experience_to_next_level: 300,
    gold_gp: 10, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }),
    skills: JSON.stringify([]),
    equipment: JSON.stringify({}),
    inventory: JSON.stringify([]),
    backstory: '',
    gender: 'male',
    alignment: 'Neutral'
  });

  const { status, body } = await api('GET', `/api/character/${newChar.id}/journal`);

  assert(status === 200, 'Returns 200 even without campaign');
  assert(body.npcs.met.length === 0, 'No NPCs met without campaign');
  assert(body.npcs.unknownCount === 0, 'Unknown NPC count is 0 without campaign plan');
  assert(body.locations.visited.length === 0, 'No locations without campaign');
  assert(body.factions.length === 0, 'No factions without campaign');

  // Cleanup
  await dbRun('DELETE FROM characters WHERE id = ?', [newChar.id]);
}

// ===== GROUP 7: Rest Narrative & Conditions =====

async function testRestNarrativeEndpoint() {
  console.log('\n  -- Rest Narrative Endpoint --');
  const { status, body } = await api('POST', `/api/dm-session/${testSessionId}/rest-narrative`, {
    restType: 'long',
    characterName: 'TEST_RestChar',
    mechanicalResult: 'Restored 10 HP and all spell slots.'
  });

  assert(status === 200, 'Returns 200');
  assert('narrative' in body, 'Response has narrative field');
  // narrative may be null if no AI key is configured — that's fine
}

async function testRestNarrativeNotFound() {
  console.log('\n  -- Rest Narrative 404 --');
  const { status, body } = await api('POST', `/api/dm-session/99999/rest-narrative`, {
    restType: 'long',
    characterName: 'Nobody'
  });

  assert(status === 404, 'Returns 404 for nonexistent session');
  assert(body.error === 'Session not found', 'Error message matches');
}

async function testRestNarrativeBadRequest() {
  console.log('\n  -- Rest Narrative Bad Request --');
  const { status, body } = await api('POST', `/api/dm-session/${testSessionId}/rest-narrative`, {});

  assert(status === 400, 'Returns 400 for missing required fields');
  assert(body.error.includes('required'), 'Error mentions required fields');
}

async function testMessageWithConditions() {
  console.log('\n  -- Message With Active Conditions --');
  // This tests that sending activeConditions doesn't break the message endpoint
  // (actual AI response will fail without API key, but the endpoint should handle it gracefully)
  const { status } = await api('POST', `/api/dm-session/${testSessionId}/message`, {
    action: 'I look around the room.',
    activeConditions: {
      player: ['poisoned', 'frightened'],
      companions: { 'Elara': ['charmed'] }
    }
  });

  // 503 if no LLM available, 200 if available — both are acceptable
  assert(status === 200 || status === 503, `Returns 200 or 503 (got ${status})`);
}

// ===== GROUP 8: Edge Cases =====

async function testNonexistentCharacter() {
  console.log('\n  -- Nonexistent Character --');
  const { status, body } = await api('GET', '/api/character/99999');

  assert(status === 404, 'Returns 404');
  assert(body && body.error, 'Has error field');
}

async function testHealthCheck() {
  console.log('\n  -- Health Check --');
  const { status, body } = await api('GET', '/api/health');

  assert(status === 200, 'Returns 200');
  assert(body.status === 'ok', 'Status is ok');
}

// ===== GROUP 9: DM Mode (Party CRUD, Session Lifecycle) =====

async function testDmModeListPartiesEmpty() {
  console.log('\n  -- DM Mode: List parties (empty) --');
  const { status, body } = await api('GET', '/api/dm-mode/parties');
  assert(status === 200, `GET /api/dm-mode/parties returns 200 (got ${status})`);
  assert(Array.isArray(body), 'Returns an array');
}

async function testDmModeCreatePartyDirect() {
  console.log('\n  -- DM Mode: Create party directly (seed) --');
  // Seed a party directly in DB since we don't want to call Opus in tests
  const partyData = JSON.stringify([
    { name: 'TEST_Thorn', race: 'Half-Orc', class: 'Fighter', subclass: 'Champion', level: 3, alignment: 'Lawful Good', ability_scores: { str: 16, dex: 12, con: 14, int: 10, wis: 13, cha: 8 }, max_hp: 28, current_hp: 28, armor_class: 16, speed: 30, skill_proficiencies: ['Athletics', 'Intimidation'], equipment: { mainHand: { name: 'Greataxe', damage: '1d12', damageType: 'slashing' }, offHand: null, armor: { name: 'Chain Mail', baseAC: 16, type: 'heavy' } }, inventory: ['Rope'], gold_gp: 50, known_cantrips: [], known_spells: [], spell_slots: {}, spell_slots_used: {}, personality_traits: 'Honorable', ideals: 'Justice', bonds: 'His village', flaws: 'Stubborn', motivation: 'Protect the weak', fear: 'Failure', secret: 'Killed a man', quirk: 'Hums', speaking_style: 'Terse', combat_style: 'Aggressive', social_style: 'Leader', moral_tendencies: 'Good', party_relationships: {}, color: '#60a5fa' },
    { name: 'TEST_Elara', race: 'Wood Elf', class: 'Rogue', subclass: 'Thief', level: 3, alignment: 'Chaotic Neutral', ability_scores: { str: 8, dex: 18, con: 12, int: 14, wis: 10, cha: 13 }, max_hp: 21, current_hp: 21, armor_class: 15, speed: 35, skill_proficiencies: ['Stealth', 'Perception'], equipment: { mainHand: { name: 'Shortsword', damage: '1d6', damageType: 'piercing' }, offHand: null, armor: { name: 'Leather', baseAC: 11, type: 'light' } }, inventory: ['Lockpicks'], gold_gp: 120, known_cantrips: [], known_spells: [], spell_slots: {}, spell_slots_used: {}, personality_traits: 'Sarcastic', ideals: 'Freedom', bonds: 'A stolen amulet', flaws: 'Greedy', motivation: 'Profit', fear: 'Commitment', secret: 'Betrayed a friend', quirk: 'Fidgets', speaking_style: 'Chatty', combat_style: 'Sneaky', social_style: 'Deflects', moral_tendencies: 'Selfish', party_relationships: {}, color: '#c084fc' },
    { name: 'TEST_Dorn', race: 'Hill Dwarf', class: 'Cleric', subclass: 'Life', level: 3, alignment: 'Neutral Good', ability_scores: { str: 14, dex: 10, con: 16, int: 12, wis: 17, cha: 11 }, max_hp: 27, current_hp: 27, armor_class: 18, speed: 25, skill_proficiencies: ['Medicine', 'Religion'], equipment: { mainHand: { name: 'Warhammer', damage: '1d8', damageType: 'bludgeoning' }, offHand: { name: 'Shield', ac_bonus: 2 }, armor: { name: 'Chain Mail', baseAC: 16, type: 'heavy' } }, inventory: ['Holy Symbol'], gold_gp: 30, known_cantrips: ['Sacred Flame'], known_spells: ['Cure Wounds', 'Bless'], spell_slots: { '1': 4, '2': 2 }, spell_slots_used: {}, personality_traits: 'Devout', ideals: 'Compassion', bonds: 'His temple', flaws: 'Judgmental', motivation: 'Serve his god', fear: 'Heresy', secret: 'Lost his faith once', quirk: 'Prays before meals', speaking_style: 'Measured', combat_style: 'Defensive', social_style: 'Mediator', moral_tendencies: 'Principled', party_relationships: {}, color: '#10b981' },
    { name: 'TEST_Pip', race: 'Halfling', class: 'Wizard', subclass: 'Evocation', level: 3, alignment: 'Chaotic Good', ability_scores: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 13 }, max_hp: 18, current_hp: 18, armor_class: 12, speed: 25, skill_proficiencies: ['Arcana', 'Investigation'], equipment: { mainHand: { name: 'Quarterstaff', damage: '1d6', damageType: 'bludgeoning' }, offHand: null, armor: null }, inventory: ['Spellbook'], gold_gp: 60, known_cantrips: ['Fire Bolt', 'Prestidigitation'], known_spells: ['Magic Missile', 'Shield', 'Fireball'], spell_slots: { '1': 4, '2': 2 }, spell_slots_used: {}, personality_traits: 'Curious', ideals: 'Knowledge', bonds: 'His mentor', flaws: 'Impulsive', motivation: 'Discovery', fear: 'The unknown', secret: 'Stole a spellbook', quirk: 'Talks to himself', speaking_style: 'Chatty and awkward', combat_style: 'Reckless caster', social_style: 'Awkward', moral_tendencies: 'Good but reckless', party_relationships: {}, color: '#f59e0b' }
  ]);
  const tensions = JSON.stringify(['Thorn and Elara disagree on stealing', 'Dorn lost faith once']);

  const result = await dbRun(
    `INSERT INTO dm_mode_parties (name, setting, tone, level, party_data, party_dynamics, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    ['TEST_Party', 'Forgotten Realms', 'heroic fantasy', 3, partyData, tensions]
  );
  testDmModePartyId = Number(result.lastInsertRowid);
  assert(testDmModePartyId > 0, `Party created with id ${testDmModePartyId}`);
}

async function testDmModeGetParty() {
  console.log('\n  -- DM Mode: Get party --');
  const { status, body } = await api('GET', `/api/dm-mode/party/${testDmModePartyId}`);
  assert(status === 200, `GET /api/dm-mode/party/:id returns 200 (got ${status})`);
  assert(body.name === 'TEST_Party', `Party name is TEST_Party (got ${body.name})`);
  assert(body.characters.length === 4, `Has 4 characters (got ${body.characters.length})`);
  assert(body.characters[0].name === 'TEST_Thorn', `First character is TEST_Thorn`);
}

async function testDmModeListPartiesNonEmpty() {
  console.log('\n  -- DM Mode: List parties (non-empty) --');
  const { status, body } = await api('GET', '/api/dm-mode/parties');
  assert(status === 200, `Returns 200`);
  const testParty = body.find(p => p.id === testDmModePartyId);
  assert(testParty !== undefined, `Test party appears in list`);
  assert(testParty.characters.length === 4, `Has 4 characters in list`);
}

async function testDmModeNoActiveSession() {
  console.log('\n  -- DM Mode: No active session --');
  const { status, body } = await api('GET', `/api/dm-mode/active/${testDmModePartyId}`);
  assert(status === 200, `Returns 200`);
  assert(body === null, `No active session (got ${JSON.stringify(body)})`);
}

async function testDmModeSessionHistory() {
  console.log('\n  -- DM Mode: Session history (empty) --');
  const { status, body } = await api('GET', `/api/dm-mode/history/${testDmModePartyId}`);
  assert(status === 200, `Returns 200`);
  assert(Array.isArray(body), `Returns array`);
}

async function testDmModeUpdateHpRequiresSession() {
  console.log('\n  -- DM Mode: Update HP without session --');
  const { status } = await api('POST', '/api/dm-mode/999999/update-hp', { characterName: 'Test', newHp: 10 });
  assert(status === 404, `Returns 404 for nonexistent session (got ${status})`);
}

async function testDmModeRetireParty() {
  console.log('\n  -- DM Mode: Retire party --');
  // Create a second party to retire (don't retire the main test party yet)
  const result = await dbRun(
    `INSERT INTO dm_mode_parties (name, setting, tone, level, party_data, party_dynamics, status)
     VALUES (?, ?, ?, ?, '[]', '[]', 'active')`,
    ['TEST_RetireMe', 'Forgotten Realms', 'heroic', 1]
  );
  const retireId = Number(result.lastInsertRowid);
  const { status, body } = await api('DELETE', `/api/dm-mode/party/${retireId}`);
  assert(status === 200, `DELETE returns 200 (got ${status})`);
  assert(body.success === true, `Returns success`);

  // Verify it's retired
  const check = await dbGet('SELECT status FROM dm_mode_parties WHERE id = ?', [retireId]);
  assert(check.status === 'retired', `Status changed to retired`);

  // Cleanup
  await dbRun('DELETE FROM dm_mode_parties WHERE id = ?', [retireId]);
}

async function testDmModeGetPartyNotFound() {
  console.log('\n  -- DM Mode: Get party not found --');
  const { status } = await api('GET', '/api/dm-mode/party/999999');
  assert(status === 404, `Returns 404 (got ${status})`);
}

// ===== GROUP 10: Progression System (Themes, Ancestry Feats) =====

async function testProgressionListThemes() {
  console.log('\n  -- Progression: List themes --');
  const { status, body } = await api('GET', '/api/progression/themes');
  assert(status === 200, `GET /api/progression/themes returns 200 (got ${status})`);
  assert(Array.isArray(body), 'Returns array');
  assert(body.length === 21, `Returns 21 themes (got ${body.length})`);
  assert(body.every(t => t.id && t.name && t.l1_ability), 'Each theme has id, name, and l1_ability');
  // Internal "any" sentinel theme should NOT be in the list
  assert(!body.some(t => t.id === 'any'), "Internal 'any' sentinel is excluded");
  // Outlander should have a creation choice for biome
  const outlander = body.find(t => t.id === 'outlander');
  assert(outlander?.creation_choice_label === 'Chosen Biome', 'Outlander has Chosen Biome creation choice');
  assert(Array.isArray(outlander?.creation_choice_options), 'Outlander has biome options array');
}

async function testProgressionGetThemeById() {
  console.log('\n  -- Progression: Get theme by id --');
  const { status, body } = await api('GET', '/api/progression/themes/soldier');
  assert(status === 200, `GET /api/progression/themes/soldier returns 200 (got ${status})`);
  assert(body.id === 'soldier', 'Returns soldier theme');
  assert(Array.isArray(body.abilities), 'Returns abilities array');
  assert(body.abilities.length === 4, `Soldier has 4 tier abilities (got ${body.abilities.length})`);
  const tiers = body.abilities.map(a => a.tier).sort((a, b) => a - b);
  assert(JSON.stringify(tiers) === '[1,5,11,17]', 'All four tiers (L1/L5/L11/L17) present');
}

async function testProgressionGetThemeNotFound() {
  console.log('\n  -- Progression: Get nonexistent theme returns 404 --');
  const { status } = await api('GET', '/api/progression/themes/nonexistent_theme');
  assert(status === 404, `Returns 404 (got ${status})`);
}

async function testProgressionAncestryFeatsByRace() {
  console.log('\n  -- Progression: Get dwarf ancestry feats --');
  const { status, body } = await api('GET', '/api/progression/ancestry-feats/dwarf');
  assert(status === 200, `Returns 200 (got ${status})`);
  assert(Array.isArray(body), 'Returns array');
  assert(body.length === 15, `Dwarf has 15 feats total (got ${body.length})`);
  const tiers = [...new Set(body.map(f => f.tier))].sort((a, b) => a - b);
  assert(JSON.stringify(tiers) === '[1,3,7,13,18]', 'All five tiers present');
}

async function testProgressionAncestryFeatsTierFilter() {
  console.log('\n  -- Progression: Get elf L1 ancestry feats only --');
  const { status, body } = await api('GET', '/api/progression/ancestry-feats/elf?tier=1');
  assert(status === 200, `Returns 200 (got ${status})`);
  assert(body.length === 3, `Exactly 3 L1 elf feats (got ${body.length})`);
  assert(body.every(f => f.tier === 1), 'All returned feats are tier 1');
  assert(body.every(f => f.list_id === 'elf'), 'All returned feats are for elf list');
}

async function testProgressionAncestryFeatsNotFound() {
  console.log('\n  -- Progression: Nonexistent race returns 404 --');
  const { status } = await api('GET', '/api/progression/ancestry-feats/not_a_race');
  assert(status === 404, `Returns 404 (got ${status})`);
}

async function testCreateCharacterWithProgression() {
  console.log('\n  -- Progression: Create character with theme + ancestry feat --');
  // Fetch Soldier's theme L1 ability ID and Human's first L1 ancestry feat ID from the catalog
  const themesRes = await api('GET', '/api/progression/themes');
  const soldier = themesRes.body.find(t => t.id === 'soldier');
  assert(soldier && soldier.l1_ability, 'Soldier theme loaded from API');

  const humanFeatsRes = await api('GET', '/api/progression/ancestry-feats/human?tier=1');
  assert(humanFeatsRes.body.length === 3, '3 human L1 feats available');
  const pickedFeat = humanFeatsRes.body[0];

  // Create a character that selects Soldier theme and the first Human L1 feat
  const { status, body } = await api('POST', '/api/character', {
    name: 'TEST_ProgressionChar',
    first_name: 'TEST',
    class: 'Fighter',
    subclass: 'Champion',
    race: 'Human',
    level: 1,
    current_hp: 12, max_hp: 12,
    armor_class: 15, speed: 30,
    current_location: 'Neverwinter',
    current_quest: null,
    experience_to_next_level: 300,
    gold_gp: 50, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 }),
    skills: JSON.stringify(['Athletics', 'Intimidation']),
    equipment: JSON.stringify({}),
    inventory: JSON.stringify([]),
    languages: JSON.stringify(['Common']),
    feats: JSON.stringify([]),
    tool_proficiencies: JSON.stringify([]),
    backstory: 'TEST character for progression integration test',
    gender: 'female',
    alignment: 'Lawful Good',
    // Progression fields
    theme_id: 'soldier',
    theme_path_choice: null,
    ancestry_feat_id: pickedFeat.id,
    ancestry_list_id: 'human'
  });

  assert(status === 201, `Character creation returns 201 (got ${status})`);
  assert(body && typeof body.id === 'number', 'Response has character id');
  const createdId = body.id;

  // Verify progression persisted
  const progRes = await api('GET', `/api/character/${createdId}/progression`);
  assert(progRes.status === 200, `GET progression returns 200 (got ${progRes.status})`);
  assert(progRes.body.theme?.theme_id === 'soldier', `Theme persisted as soldier (got ${progRes.body.theme?.theme_id})`);
  assert(progRes.body.theme?.theme_name === 'Soldier', 'Theme name resolved from join');
  assert(Array.isArray(progRes.body.theme_unlocks), 'theme_unlocks is array');
  assert(progRes.body.theme_unlocks.length === 1, `One L1 unlock recorded (got ${progRes.body.theme_unlocks.length})`);
  assert(progRes.body.theme_unlocks[0].tier === 1, 'Unlock is tier 1');
  assert(progRes.body.theme_unlocks[0].ability_name === 'Military Rank', `L1 ability is Military Rank (got ${progRes.body.theme_unlocks[0].ability_name})`);

  assert(Array.isArray(progRes.body.ancestry_feats), 'ancestry_feats is array');
  assert(progRes.body.ancestry_feats.length === 1, `One ancestry feat recorded (got ${progRes.body.ancestry_feats.length})`);
  assert(progRes.body.ancestry_feats[0].feat_name === pickedFeat.feat_name, 'Feat name matches');

  // Cleanup
  await dbRun('DELETE FROM characters WHERE id = ?', [createdId]);
}

async function testProgressionReturnsUpcomingTiersAndSynergy() {
  console.log('\n  -- Progression: Character progression includes upcoming tiers + subclass synergy --');
  // Battle Master + Soldier is a resonant pair in subclass_theme_synergies seed data
  const { body: created } = await api('POST', '/api/character', {
    name: 'TEST_ProgressionSynergyChar',
    first_name: 'TEST',
    class: 'Fighter',
    subclass: 'Battle Master',
    race: 'Human',
    level: 5,
    current_hp: 44, max_hp: 44,
    armor_class: 17, speed: 30,
    current_location: 'Neverwinter',
    current_quest: null,
    experience_to_next_level: 14000,
    gold_gp: 0, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }),
    skills: JSON.stringify([]),
    equipment: JSON.stringify({}),
    inventory: JSON.stringify([]),
    languages: JSON.stringify(['Common']),
    feats: JSON.stringify([]),
    tool_proficiencies: JSON.stringify([]),
    backstory: 'TEST',
    gender: 'male',
    alignment: 'Lawful Good',
    theme_id: 'soldier',
    theme_path_choice: null,
    ancestry_feat_id: null,
    ancestry_list_id: 'human'
  });
  const id = created.id;
  assert(typeof id === 'number', 'Character id returned');

  const { status, body } = await api('GET', `/api/character/${id}/progression`);
  assert(status === 200, `Progression endpoint returns 200 (got ${status})`);

  // Character block
  assert(body.character?.class === 'Fighter', 'Character class in response');
  assert(body.character?.subclass === 'Battle Master', 'Character subclass in response');
  assert(body.character?.level === 5, 'Character level in response');

  // Theme with enriched fields
  assert(body.theme?.theme_id === 'soldier', 'Theme is soldier');
  assert(body.theme?.identity?.length > 0, 'Theme identity included');
  assert(body.theme?.signature_skill_1 === 'Athletics', 'Signature skill 1 populated');
  assert(Array.isArray(body.theme?.tags), 'Tags parsed as array');

  // All 4 tiers (L1/L5/L11/L17) returned for display
  assert(Array.isArray(body.theme_all_tiers), 'theme_all_tiers is array');
  assert(body.theme_all_tiers.length === 4, `All 4 tiers returned (got ${body.theme_all_tiers.length})`);
  const tierNums = body.theme_all_tiers.map(t => t.tier).sort((a, b) => a - b);
  assert(JSON.stringify(tierNums) === '[1,5,11,17]', 'Tiers are L1/L5/L11/L17');

  // Only L1 unlocked (created at level 5 but only L1 tier is auto-granted at creation)
  assert(body.theme_unlocks.length === 1, `One L1 unlock at creation (got ${body.theme_unlocks.length})`);
  assert(body.theme_unlocks[0].tier === 1, 'Unlock is L1');

  // Resonant synergy detected
  assert(body.subclass_theme_synergy, 'Subclass×Theme synergy present for Battle Master + Soldier');
  assert(body.subclass_theme_synergy?.synergy_name === "Tactician's Eye", `Synergy name is Tactician's Eye (got ${body.subclass_theme_synergy?.synergy_name})`);

  // No mythic amplification expected (character has no mythic path)
  assert(body.mythic_theme_amplification === null, 'No mythic amplification (character has no mythic path)');

  await dbRun('DELETE FROM characters WHERE id = ?', [id]);
}

async function testProgressionNoSynergyForNonResonantPair() {
  console.log('\n  -- Progression: No synergy for non-resonant subclass/theme pair --');
  // Fighter + Champion + Criminal is NOT in the subclass_theme_synergies seed data
  const { body: created } = await api('POST', '/api/character', {
    name: 'TEST_NoSynergyChar',
    first_name: 'TEST',
    class: 'Fighter',
    subclass: 'Champion',
    race: 'Human',
    level: 1,
    current_hp: 12, max_hp: 12,
    armor_class: 16, speed: 30,
    current_location: 'X',
    current_quest: null,
    experience_to_next_level: 300,
    gold_gp: 0, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }),
    skills: JSON.stringify([]),
    equipment: JSON.stringify({}),
    inventory: JSON.stringify([]),
    languages: JSON.stringify(['Common']),
    feats: JSON.stringify([]),
    tool_proficiencies: JSON.stringify([]),
    backstory: 'TEST',
    gender: 'female',
    alignment: 'Chaotic Neutral',
    theme_id: 'criminal'
  });
  const id = created.id;
  const { body } = await api('GET', `/api/character/${id}/progression`);
  assert(body.subclass_theme_synergy === null, 'No resonant synergy for Champion + Criminal');
  await dbRun('DELETE FROM characters WHERE id = ?', [id]);
}

async function testLevelUpRequiresSubclassForMulticlass() {
  console.log('\n  -- Level-up: multiclassing into a L1-subclass class without subclass returns 422 --');
  // Create a Fighter at L1 with enough XP to level up (300 xp)
  const { body: created } = await api('POST', '/api/character', {
    name: 'TEST_MulticlassValidation',
    first_name: 'TEST',
    class: 'Fighter',
    subclass: null,
    race: 'Human',
    level: 1,
    current_hp: 12, max_hp: 12,
    armor_class: 15, speed: 30,
    current_location: 'Anywhere',
    current_quest: null,
    experience: 300,
    experience_to_next_level: 900,
    gold_gp: 0, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }),
    skills: JSON.stringify([]),
    equipment: JSON.stringify({}),
    inventory: JSON.stringify([]),
    languages: JSON.stringify(['Common']),
    feats: JSON.stringify([]),
    tool_proficiencies: JSON.stringify([]),
    backstory: 'TEST',
    gender: 'female',
    alignment: 'Neutral'
  });
  const id = created.id;

  // Attempt to multiclass into Cleric (which requires a subclass at L1) without passing one
  const { status, body } = await api('POST', `/api/character/level-up/${id}`, {
    selectedClass: 'Cleric',
    hpRoll: 'average'
    // NOTE: deliberately omit `subclass`
  });
  assert(status === 422, `Returns 422 (got ${status})`);
  assert(body.error && body.error.includes('Subclass selection required'), 'Error message mentions subclass requirement');
  assert(body.targetClass === 'Cleric', 'Error payload includes targetClass');
  assert(body.newClassLevel === 1, 'Error payload includes newClassLevel');

  // Verify character was NOT mutated (still L1 Fighter)
  const { body: check } = await api('GET', `/api/character/${id}`);
  assert(check.level === 1, `Level unchanged after failed level-up (got ${check.level})`);
  assert(check.class === 'Fighter', `Class unchanged after failed level-up (got ${check.class})`);

  // Now retry WITH a subclass — should succeed
  const retry = await api('POST', `/api/character/level-up/${id}`, {
    selectedClass: 'Cleric',
    subclass: 'Life Domain',
    hpRoll: 'average'
  });
  assert(retry.status === 200, `Retry with subclass succeeds (got ${retry.status})`);

  await dbRun('DELETE FROM characters WHERE id = ?', [id]);
}

async function testLevelUpFeatInsteadOfASI() {
  console.log('\n  -- Level-up: feat-instead-of-ASI appends to feats array + applies half-ASI bump --');
  // Create a Fighter at L3 with enough XP to level up to L4 (ASI level)
  const { body: created } = await api('POST', '/api/character', {
    name: 'TEST_FeatLevelUp',
    first_name: 'TEST',
    class: 'Fighter',
    subclass: 'Champion',
    race: 'Human',
    level: 3,
    current_hp: 28, max_hp: 28,
    armor_class: 16, speed: 30,
    current_location: 'X',
    current_quest: null,
    experience: 2700,
    experience_to_next_level: 6500,
    gold_gp: 0, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }),
    skills: JSON.stringify([]),
    equipment: JSON.stringify({}),
    inventory: JSON.stringify([]),
    languages: JSON.stringify(['Common']),
    feats: JSON.stringify([]),
    tool_proficiencies: JSON.stringify([]),
    backstory: 'TEST',
    gender: 'male',
    alignment: 'Neutral'
  });
  const id = created.id;

  // Level up with feat choice (Resilient with +1 CON — a half-ASI feat)
  const { status, body } = await api('POST', `/api/character/level-up/${id}`, {
    hpRoll: 'average',
    asiChoice: {
      type: 'feat',
      feat: 'resilient',
      featName: 'Resilient',
      featAbilityChoice: 'con'
    }
  });
  assert(status === 200, `Level-up with feat returns 200 (got ${status})`);
  assert(body.character.level === 4, `Character is now L4 (got ${body.character.level})`);

  // Verify feat was persisted
  const feats = parseJSON(body.character.feats);
  assert(Array.isArray(feats) && feats.length === 1, `Feats array has 1 entry (got ${feats.length})`);
  assert(feats[0].key === 'resilient', `Feat key is resilient (got ${feats[0].key})`);
  assert(feats[0].abilityChoice === 'con', 'Feat abilityChoice captured');
  assert(feats[0].acquiredAtLevel === 4, 'acquiredAtLevel recorded');

  // Verify CON was bumped from 14 to 15 (half-ASI)
  const scores = parseJSON(body.character.ability_scores);
  assert(scores.con === 15, `CON bumped to 15 (got ${scores.con})`);

  await dbRun('DELETE FROM characters WHERE id = ?', [id]);
}

async function testLevelUpFeatMissingFeatKey() {
  console.log('\n  -- Level-up: feat choice without feat key should still succeed but add nothing --');
  // Edge case: asiChoice.type === 'feat' but no feat name provided.
  // Current behavior: the condition `asiChoice.feat` guards the feat path;
  // with no feat key, nothing is persisted. Character still levels up.
  const { body: created } = await api('POST', '/api/character', {
    name: 'TEST_EmptyFeatLevelUp',
    first_name: 'TEST',
    class: 'Fighter',
    subclass: 'Champion',
    race: 'Human',
    level: 3,
    current_hp: 28, max_hp: 28,
    armor_class: 16, speed: 30,
    current_location: 'X',
    current_quest: null,
    experience: 2700,
    experience_to_next_level: 6500,
    gold_gp: 0, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }),
    skills: JSON.stringify([]),
    equipment: JSON.stringify({}),
    inventory: JSON.stringify([]),
    languages: JSON.stringify(['Common']),
    feats: JSON.stringify([]),
    tool_proficiencies: JSON.stringify([]),
    backstory: 'TEST',
    gender: 'male',
    alignment: 'Neutral'
  });
  const id = created.id;

  const { status, body } = await api('POST', `/api/character/level-up/${id}`, {
    hpRoll: 'average',
    asiChoice: { type: 'feat' } // intentionally missing 'feat' key
  });
  assert(status === 200, `Level-up with no feat key still returns 200 (got ${status})`);
  const feats = parseJSON(body.character.feats);
  assert(feats.length === 0, `No feat appended when key missing (got ${feats.length})`);
  assert(body.character.level === 4, 'Character still leveled up');

  await dbRun('DELETE FROM characters WHERE id = ?', [id]);
}

async function testLevelUpInfoSurfacesProgressionDecisions() {
  console.log('\n  -- Level-up-info: progression decisions surfaced at correct thresholds --');
  // Create a Fighter at L2 (ancestry feat tier threshold is L3) with Soldier theme
  // and a dwarf L1 ancestry feat — so progression machinery knows the theme and list.
  const themesRes = await api('GET', '/api/progression/themes');
  assert(themesRes.status === 200, 'Themes API alive');

  const dwarfFeatsRes = await api('GET', '/api/progression/ancestry-feats/dwarf?tier=1');
  const l1Feat = dwarfFeatsRes.body[0];

  const { body: created } = await api('POST', '/api/character', {
    name: 'TEST_ProgressionLevelUp',
    first_name: 'TEST',
    class: 'Fighter',
    subclass: 'Champion',
    race: 'Dwarf',
    subrace: 'Hill Dwarf',
    level: 2,
    current_hp: 20, max_hp: 20,
    armor_class: 16, speed: 25,
    current_location: 'X', current_quest: null,
    experience: 900, experience_to_next_level: 2700,
    gold_gp: 0, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 16, int: 10, wis: 12, cha: 10 }),
    skills: JSON.stringify([]), equipment: JSON.stringify({}),
    inventory: JSON.stringify([]), languages: JSON.stringify(['Common']),
    feats: JSON.stringify([]), tool_proficiencies: JSON.stringify([]),
    backstory: 'TEST', gender: 'male', alignment: 'Lawful Good',
    theme_id: 'soldier',
    ancestry_feat_id: l1Feat.id,
    ancestry_list_id: 'dwarf'
  });
  const id = created.id;

  // Check level-up info at L2 → L3 (ancestry feat threshold)
  const info = await api('GET', `/api/character/level-up-info/${id}`);
  assert(info.status === 200, `Info returns 200 (got ${info.status})`);
  assert(info.body.progression, 'Response includes progression section');
  assert(info.body.progression.theme_tier_unlock === null, 'No theme unlock at L3 (theme tiers are L5/L11/L17)');
  assert(info.body.progression.ancestry_feat_tier, 'Ancestry feat tier decision present at L3');
  assert(info.body.progression.ancestry_feat_tier.tier === 3, 'Tier is 3');
  assert(info.body.progression.ancestry_feat_tier.options.length === 3, `3 options offered (got ${info.body.progression.ancestry_feat_tier.options.length})`);
  assert(info.body.progression.ancestry_feat_tier.list_id === 'dwarf', 'Options are from dwarf list');

  await dbRun('DELETE FROM characters WHERE id = ?', [id]);
}

async function testLevelUpRequiresAncestryFeatId() {
  console.log('\n  -- Level-up: missing ancestryFeatId at tier threshold returns 422 --');
  const dwarfFeatsRes = await api('GET', '/api/progression/ancestry-feats/dwarf?tier=1');
  const l1Feat = dwarfFeatsRes.body[0];

  const { body: created } = await api('POST', '/api/character', {
    name: 'TEST_AncestryFeatRequired',
    first_name: 'TEST',
    class: 'Fighter',
    subclass: 'Champion',
    race: 'Dwarf',
    level: 2,
    current_hp: 20, max_hp: 20,
    armor_class: 16, speed: 25,
    current_location: 'X', current_quest: null,
    experience: 900, experience_to_next_level: 2700,
    gold_gp: 0, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 16, int: 10, wis: 12, cha: 10 }),
    skills: JSON.stringify([]), equipment: JSON.stringify({}),
    inventory: JSON.stringify([]), languages: JSON.stringify(['Common']),
    feats: JSON.stringify([]), tool_proficiencies: JSON.stringify([]),
    backstory: 'TEST', gender: 'female', alignment: 'Neutral',
    theme_id: 'soldier',
    ancestry_feat_id: l1Feat.id,
    ancestry_list_id: 'dwarf'
  });
  const id = created.id;

  // Level up from L2 to L3 WITHOUT ancestryFeatId — should return 422
  const bad = await api('POST', `/api/character/level-up/${id}`, { hpRoll: 'average' });
  assert(bad.status === 422, `Missing ancestryFeatId returns 422 (got ${bad.status})`);
  assert(bad.body.error && bad.body.error.includes('Ancestry feat selection required'), 'Error message correct');

  // Character unchanged
  const check = await api('GET', `/api/character/${id}`);
  assert(check.body.level === 2, `Character level unchanged (got ${check.body.level})`);

  await dbRun('DELETE FROM characters WHERE id = ?', [id]);
}

async function testLevelUpPersistsAncestryFeatAndThemeTier() {
  console.log('\n  -- Level-up: ancestry feat + theme tier auto-unlock at L5 --');
  const dwarfFeatsRes = await api('GET', '/api/progression/ancestry-feats/dwarf?tier=1');
  const l1Feat = dwarfFeatsRes.body[0];

  // Create a Fighter at L4 with Soldier theme. Level-up to L5 = theme tier unlock.
  const { body: created } = await api('POST', '/api/character', {
    name: 'TEST_ThemeTierUnlock',
    first_name: 'TEST',
    class: 'Fighter',
    subclass: 'Champion',
    race: 'Dwarf',
    level: 4,
    current_hp: 36, max_hp: 36,
    armor_class: 16, speed: 25,
    current_location: 'X', current_quest: null,
    experience: 6500, experience_to_next_level: 14000,
    gold_gp: 0, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 16, int: 10, wis: 12, cha: 10 }),
    skills: JSON.stringify([]), equipment: JSON.stringify({}),
    inventory: JSON.stringify([]), languages: JSON.stringify(['Common']),
    feats: JSON.stringify([]), tool_proficiencies: JSON.stringify([]),
    backstory: 'TEST', gender: 'male', alignment: 'Neutral',
    theme_id: 'soldier',
    ancestry_feat_id: l1Feat.id,
    ancestry_list_id: 'dwarf'
  });
  const id = created.id;

  // Level up to L5 — theme tier unlock should fire (no ancestry feat at L5)
  const res = await api('POST', `/api/character/level-up/${id}`, { hpRoll: 'average' });
  assert(res.status === 200, `Level-up to L5 succeeds (got ${res.status})`);
  assert(res.body.levelUpSummary.themeTierUnlocked, 'Theme tier unlock reported in summary');
  assert(res.body.levelUpSummary.themeTierUnlocked.tier === 5, 'Tier is 5');
  assert(res.body.levelUpSummary.themeTierUnlocked.ability_name === 'Field Discipline',
    `L5 ability is Field Discipline (got ${res.body.levelUpSummary.themeTierUnlocked.ability_name})`);
  assert(res.body.levelUpSummary.ancestryFeatSelected === null, 'No ancestry feat at L5 (tiers are L3/L7/L13/L18)');

  // Verify persisted in character_theme_unlocks
  const prog = await api('GET', `/api/character/${id}/progression`);
  const l5Unlock = prog.body.theme_unlocks.find(u => u.tier === 5);
  assert(l5Unlock, 'L5 theme unlock persisted');
  assert(l5Unlock.ability_name === 'Field Discipline', 'Correct ability persisted');

  await dbRun('DELETE FROM characters WHERE id = ?', [id]);
}

async function testLevelUpWithAncestryFeatChoice() {
  console.log('\n  -- Level-up: picking an ancestry feat at L3 persists the choice --');
  const dwarfL1 = await api('GET', '/api/progression/ancestry-feats/dwarf?tier=1');
  const dwarfL3 = await api('GET', '/api/progression/ancestry-feats/dwarf?tier=3');
  const pickedFeat = dwarfL3.body[1]; // second option

  const { body: created } = await api('POST', '/api/character', {
    name: 'TEST_FeatPick',
    first_name: 'TEST',
    class: 'Fighter',
    subclass: 'Champion',
    race: 'Dwarf',
    level: 2,
    current_hp: 20, max_hp: 20,
    armor_class: 16, speed: 25,
    current_location: 'X', current_quest: null,
    experience: 900, experience_to_next_level: 2700,
    gold_gp: 0, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 16, int: 10, wis: 12, cha: 10 }),
    skills: JSON.stringify([]), equipment: JSON.stringify({}),
    inventory: JSON.stringify([]), languages: JSON.stringify(['Common']),
    feats: JSON.stringify([]), tool_proficiencies: JSON.stringify([]),
    backstory: 'TEST', gender: 'female', alignment: 'Neutral',
    theme_id: 'soldier',
    ancestry_feat_id: dwarfL1.body[0].id,
    ancestry_list_id: 'dwarf'
  });
  const id = created.id;

  // Level-up L2→L3 with feat pick
  const res = await api('POST', `/api/character/level-up/${id}`, {
    hpRoll: 'average',
    ancestryFeatId: pickedFeat.id
  });
  assert(res.status === 200, `Level-up succeeds with feat pick (got ${res.status})`);
  assert(res.body.levelUpSummary.ancestryFeatSelected, 'Feat reported in summary');
  assert(res.body.levelUpSummary.ancestryFeatSelected.id === pickedFeat.id, 'Correct feat id in summary');

  // Verify persisted
  const prog = await api('GET', `/api/character/${id}/progression`);
  const l3Feat = prog.body.ancestry_feats.find(f => f.tier === 3);
  assert(l3Feat, 'L3 ancestry feat persisted');
  assert(l3Feat.feat_name === pickedFeat.feat_name, 'Correct feat name persisted');

  await dbRun('DELETE FROM characters WHERE id = ?', [id]);
}

async function testLevelUpRejectsInvalidAncestryFeatId() {
  console.log('\n  -- Level-up: invalid ancestryFeatId returns 400 --');
  const dwarfL1 = await api('GET', '/api/progression/ancestry-feats/dwarf?tier=1');
  const elfL3 = await api('GET', '/api/progression/ancestry-feats/elf?tier=3');
  const elfFeatId = elfL3.body[0].id; // an elf feat — not valid for a dwarf character

  const { body: created } = await api('POST', '/api/character', {
    name: 'TEST_InvalidFeat',
    first_name: 'TEST',
    class: 'Fighter',
    subclass: 'Champion',
    race: 'Dwarf',
    level: 2,
    current_hp: 20, max_hp: 20,
    armor_class: 16, speed: 25,
    current_location: 'X', current_quest: null,
    experience: 900, experience_to_next_level: 2700,
    gold_gp: 0, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 16, int: 10, wis: 12, cha: 10 }),
    skills: JSON.stringify([]), equipment: JSON.stringify({}),
    inventory: JSON.stringify([]), languages: JSON.stringify(['Common']),
    feats: JSON.stringify([]), tool_proficiencies: JSON.stringify([]),
    backstory: 'TEST', gender: 'female', alignment: 'Neutral',
    theme_id: 'soldier',
    ancestry_feat_id: dwarfL1.body[0].id,
    ancestry_list_id: 'dwarf'
  });
  const id = created.id;

  const res = await api('POST', `/api/character/level-up/${id}`, {
    hpRoll: 'average',
    ancestryFeatId: elfFeatId  // invalid — this is an elf feat, character is a dwarf
  });
  assert(res.status === 400, `Returns 400 for invalid feat id (got ${res.status})`);
  assert(res.body.error && res.body.error.includes('not a valid option'), 'Error mentions invalid option');

  // Character unchanged
  const check = await api('GET', `/api/character/${id}`);
  assert(check.body.level === 2, 'Character unchanged after invalid feat');

  await dbRun('DELETE FROM characters WHERE id = ?', [id]);
}

async function testCreateKnightInitializesMoralPath() {
  console.log('\n  -- Progression: Creating Knight theme initializes moral path to "true" --');
  const { status, body } = await api('POST', '/api/character', {
    name: 'TEST_KnightChar',
    first_name: 'TEST',
    class: 'Paladin',
    subclass: 'Oath of Devotion',
    race: 'Human',
    level: 1,
    current_hp: 12, max_hp: 12,
    armor_class: 16, speed: 30,
    current_location: 'Baldurs Gate',
    current_quest: null,
    experience_to_next_level: 300,
    gold_gp: 50, gold_sp: 0, gold_cp: 0,
    ability_scores: JSON.stringify({ str: 16, dex: 10, con: 14, int: 10, wis: 13, cha: 15 }),
    skills: JSON.stringify([]),
    equipment: JSON.stringify({}),
    inventory: JSON.stringify([]),
    languages: JSON.stringify(['Common']),
    feats: JSON.stringify([]),
    tool_proficiencies: JSON.stringify([]),
    backstory: 'TEST knight',
    gender: 'male',
    alignment: 'Lawful Good',
    theme_id: 'knight_of_the_order',
    theme_path_choice: 'chivalric',
    ancestry_feat_id: null,
    ancestry_list_id: null
  });

  assert(status === 201, `Character creation returns 201 (got ${status})`);
  const createdId = body.id;

  const progRes = await api('GET', `/api/character/${createdId}/progression`);
  assert(progRes.status === 200, 'Progression GET returns 200');
  assert(progRes.body.theme?.theme_id === 'knight_of_the_order', 'Knight theme persisted');
  assert(progRes.body.theme?.path_choice === 'chivalric', `Path choice saved as chivalric (got ${progRes.body.theme?.path_choice})`);
  assert(progRes.body.knight_moral_path?.current_path === 'true', `Moral path initialized to "true" (got ${progRes.body.knight_moral_path?.current_path})`);

  await dbRun('DELETE FROM characters WHERE id = ?', [createdId]);
}

// ===== GROUP 11: Companion Progression (Phase 5.5) =====
//
// Every test here creates its own test NPC + companion and cleans them up
// at the end, so they don't depend on each other or interact with the
// testCharId cleanup done for Group 1.

async function createTestNpcAndRecruit(race, companionClass, startingLevel = 1) {
  const npcRes = await api('POST', '/api/npc', {
    name: `TEST_Companion_${race}_${Date.now()}`,
    race,
    stat_block: 'commoner',
    campaign_availability: 'companion',
    ability_scores: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }
  });
  if (npcRes.status !== 201) throw new Error(`NPC create failed: ${JSON.stringify(npcRes.body)}`);
  const npcId = npcRes.body.id;

  const recruitRes = await api('POST', '/api/companion/recruit', {
    npc_id: npcId,
    recruited_by_character_id: testCharId,
    progression_type: 'class_based',
    companion_class: companionClass,
    starting_level: startingLevel
  });
  if (recruitRes.status !== 201) throw new Error(`Recruit failed: ${JSON.stringify(recruitRes.body)}`);
  return { npcId, companionId: recruitRes.body.companion.id };
}

async function cleanupTestCompanion(companionId, npcId) {
  if (companionId) {
    await dbRun('DELETE FROM companion_ancestry_feats WHERE companion_id = ?', [companionId]);
    await dbRun('DELETE FROM companion_theme_unlocks WHERE companion_id = ?', [companionId]);
    await dbRun('DELETE FROM companion_themes WHERE companion_id = ?', [companionId]);
    await dbRun('DELETE FROM companions WHERE id = ?', [companionId]);
  }
  if (npcId) await dbRun('DELETE FROM npcs WHERE id = ?', [npcId]);
}

async function testCompanionRecruitAutoAssignsThemeAndAncestryFeat() {
  console.log('\n  -- Companion recruit auto-assigns theme + L1 ancestry feat --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Wood Elf', 'Fighter', 1);

  const theme = await dbGet('SELECT theme_id FROM companion_themes WHERE companion_id = ?', [companionId]);
  assert(theme?.theme_id === 'soldier', `Fighter companion gets soldier theme (got ${theme?.theme_id})`);

  const unlock = await dbGet(
    'SELECT tier, unlocked_at_level FROM companion_theme_unlocks WHERE companion_id = ? AND tier = 1',
    [companionId]
  );
  assert(unlock, 'L1 theme ability is unlocked');

  const feat = await dbGet(
    `SELECT af.list_id FROM companion_ancestry_feats caf
     JOIN ancestry_feats af ON caf.feat_id = af.id
     WHERE caf.companion_id = ? AND caf.tier = 1`,
    [companionId]
  );
  assert(feat?.list_id === 'elf', `Wood Elf companion gets 'elf' ancestry list (got ${feat?.list_id})`);

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionRaceNormalizationSkipsUnmapped() {
  console.log('\n  -- Unmapped race (Goblin) silently skips ancestry feat --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Goblin', 'Rogue', 1);

  const theme = await dbGet('SELECT theme_id FROM companion_themes WHERE companion_id = ?', [companionId]);
  assert(theme?.theme_id === 'criminal', `Rogue companion still gets criminal theme (got ${theme?.theme_id})`);

  const feat = await dbGet('SELECT id FROM companion_ancestry_feats WHERE companion_id = ?', [companionId]);
  assert(!feat, 'No ancestry feat seeded for unmapped race');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionLevelUpTriggersThemeTierUnlock() {
  console.log('\n  -- Companion L4→L5 triggers theme tier auto-unlock --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 4);

  const infoRes = await api('GET', `/api/companion/${companionId}/level-up-info`);
  assert(infoRes.status === 200, `level-up-info returns 200 (got ${infoRes.status})`);
  assert(
    infoRes.body.progression?.theme_tier_unlock?.tier === 5,
    'level-up-info previews theme_tier_unlock at tier 5'
  );

  const upRes = await api('POST', `/api/companion/${companionId}/level-up`, { hpRoll: 'average' });
  assert(upRes.status === 200, `level-up returns 200 (got ${upRes.status})`);
  assert(
    upRes.body.levelUpSummary?.themeTierUnlocked?.tier === 5,
    'level-up response includes themeTierUnlocked'
  );

  const unlock = await dbGet(
    'SELECT tier FROM companion_theme_unlocks WHERE companion_id = ? AND tier = 5',
    [companionId]
  );
  assert(unlock, 'Theme tier 5 unlock persisted to DB');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionLevelUpAutoPicksAncestryFeat() {
  console.log('\n  -- Companion L2→L3 auto-picks ancestry feat --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Mountain Dwarf', 'Cleric', 2);

  const upRes = await api('POST', `/api/companion/${companionId}/level-up`, { hpRoll: 'average' });
  assert(upRes.status === 200, `level-up returns 200 (got ${upRes.status})`);
  assert(
    upRes.body.levelUpSummary?.ancestryFeatSelected?.tier === 3,
    'level-up response includes ancestryFeatSelected at tier 3'
  );

  const feat = await dbGet(
    `SELECT af.list_id FROM companion_ancestry_feats caf
     JOIN ancestry_feats af ON caf.feat_id = af.id
     WHERE caf.companion_id = ? AND caf.tier = 3`,
    [companionId]
  );
  assert(feat?.list_id === 'dwarf', `Auto-picked dwarf feat at tier 3 (got ${feat?.list_id})`);

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionProgressionEndpoint() {
  console.log('\n  -- GET /companion/:id/progression returns full snapshot --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Tiefling', 'Wizard', 1);

  const res = await api('GET', `/api/companion/${companionId}/progression`);
  assert(res.status === 200, `progression GET returns 200 (got ${res.status})`);
  assert(res.body.theme?.theme_id === 'sage', `Wizard gets sage theme (got ${res.body.theme?.theme_id})`);
  assert(Array.isArray(res.body.theme_all_tiers), 'theme_all_tiers is an array');
  assert(res.body.theme_all_tiers.length >= 4, 'theme_all_tiers has at least 4 tiers');
  assert(res.body.theme_unlocks.length === 1, 'One tier unlocked at L1');
  assert(res.body.ancestry_feats.length === 1, 'One L1 ancestry feat seeded');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionLevelUpLazyBackfill() {
  console.log('\n  -- Pre-5.5 companion gets lazy-backfilled at level-up --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Half-Elf', 'Bard', 1);

  // Simulate a pre-5.5 companion: wipe the auto-assigned rows
  await dbRun('DELETE FROM companion_ancestry_feats WHERE companion_id = ?', [companionId]);
  await dbRun('DELETE FROM companion_theme_unlocks WHERE companion_id = ?', [companionId]);
  await dbRun('DELETE FROM companion_themes WHERE companion_id = ?', [companionId]);

  const infoRes = await api('GET', `/api/companion/${companionId}/level-up-info`);
  assert(infoRes.status === 200, 'level-up-info triggers backfill successfully');

  const theme = await dbGet('SELECT theme_id FROM companion_themes WHERE companion_id = ?', [companionId]);
  assert(theme?.theme_id === 'entertainer', `Backfilled bard theme (got ${theme?.theme_id})`);

  const feat = await dbGet(
    `SELECT af.list_id FROM companion_ancestry_feats caf
     JOIN ancestry_feats af ON caf.feat_id = af.id
     WHERE caf.companion_id = ? AND caf.tier = 1`,
    [companionId]
  );
  assert(feat?.list_id === 'half_elf', `Backfilled half_elf feat (got ${feat?.list_id})`);

  await cleanupTestCompanion(companionId, npcId);
}

// ===== GROUP 12: Companion Rest + Spell Slots (Phase 6) =====

async function testCompanionSpellSlotsForCaster() {
  console.log('\n  -- Spellcasting companion reports non-empty spell slots --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Wizard', 5);

  const res = await api('GET', `/api/companion/${companionId}/spell-slots`);
  assert(res.status === 200, `GET spell-slots returns 200 (got ${res.status})`);
  assert(res.body.max && Object.keys(res.body.max).length > 0, 'Wizard L5 has non-empty max slots');
  assert(res.body.max['1'] === 4, `L1 slot count is 4 (got ${res.body.max['1']})`);
  assert(res.body.max['3'] === 2, `L3 slot count is 2 (got ${res.body.max['3']})`);
  assert(Object.keys(res.body.used || {}).length === 0, 'No slots used at recruit');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionSpellSlotsForNonCaster() {
  console.log('\n  -- Non-caster (fighter) reports empty spell slot maps --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 5);

  const res = await api('GET', `/api/companion/${companionId}/spell-slots`);
  assert(res.status === 200, 'GET spell-slots returns 200 for non-caster');
  assert(Object.keys(res.body.max || {}).length === 0, 'Fighter has no spell slots');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionUseAndRestoreSlot() {
  console.log('\n  -- Use + restore a spell slot round-trip --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Cleric', 3);

  const useRes = await api('POST', `/api/companion/${companionId}/spell-slots/use`, { level: 1 });
  assert(useRes.status === 200, `Use L1 slot returns 200 (got ${useRes.status})`);
  assert(useRes.body.remaining === 3, `L1 remaining is 3 (got ${useRes.body.remaining})`);

  const statusRes = await api('GET', `/api/companion/${companionId}/spell-slots`);
  assert(statusRes.body.used['1'] === 1, 'used[1] persisted as 1');

  const restoreRes = await api('POST', `/api/companion/${companionId}/spell-slots/restore`, { level: 1 });
  assert(restoreRes.status === 200, 'Restore L1 slot returns 200');
  assert(restoreRes.body.remaining === 4, `L1 remaining restored to 4 (got ${restoreRes.body.remaining})`);

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionUseSlotRejectsWhenEmpty() {
  console.log('\n  -- Use rejects when slots exhausted or non-existent --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Cleric', 1);

  // L1 cleric has 2 L1 slots, 0 L2 slots
  const deepRes = await api('POST', `/api/companion/${companionId}/spell-slots/use`, { level: 5 });
  assert(deepRes.status === 400, `Reject L5 slot (has none) with 400 (got ${deepRes.status})`);

  await api('POST', `/api/companion/${companionId}/spell-slots/use`, { level: 1 });
  await api('POST', `/api/companion/${companionId}/spell-slots/use`, { level: 1 });
  const thirdRes = await api('POST', `/api/companion/${companionId}/spell-slots/use`, { level: 1 });
  assert(thirdRes.status === 400, 'Rejects when all L1 slots used');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionLongRest() {
  console.log('\n  -- Long rest restores HP and clears spell slot usage --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Druid', 3);

  // Use a slot
  await api('POST', `/api/companion/${companionId}/spell-slots/use`, { level: 1 });
  // Damage the companion
  await dbRun('UPDATE companions SET companion_current_hp = 1 WHERE id = ?', [companionId]);

  const restRes = await api('POST', `/api/companion/${companionId}/rest`, { restType: 'long' });
  assert(restRes.status === 200, `Long rest returns 200 (got ${restRes.status})`);
  assert(restRes.body.spell_slots_restored === true, 'Long rest reports slots restored');
  assert(restRes.body.newHp === restRes.body.companion.companion_max_hp, 'HP restored to max');

  const statusRes = await api('GET', `/api/companion/${companionId}/spell-slots`);
  assert(Object.keys(statusRes.body.used || {}).every(k => statusRes.body.used[k] === 0 || !statusRes.body.used[k]),
    'All slot usage cleared after long rest');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionShortRestHealsButKeepsSlots() {
  console.log('\n  -- Short rest heals 50% HP but keeps non-warlock slots used --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Cleric', 3);

  await api('POST', `/api/companion/${companionId}/spell-slots/use`, { level: 1 });
  await dbRun('UPDATE companions SET companion_current_hp = 10, companion_max_hp = 30 WHERE id = ?', [companionId]);

  const restRes = await api('POST', `/api/companion/${companionId}/rest`, { restType: 'short' });
  assert(restRes.status === 200, 'Short rest returns 200');
  assert(restRes.body.newHp === 20, `Short rest heals 50% of missing 20 → newHp=20 (got ${restRes.body.newHp})`);
  assert(restRes.body.spell_slots_restored === false, 'Non-warlock does not restore slots on short rest');

  const statusRes = await api('GET', `/api/companion/${companionId}/spell-slots`);
  assert(statusRes.body.used['1'] === 1, 'Cleric still has 1 used L1 slot after short rest');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionShortRestWarlockSlots() {
  console.log('\n  -- Warlock short rest restores pact slots --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Warlock', 3);

  await api('POST', `/api/companion/${companionId}/spell-slots/use`, { level: 2 });
  const restRes = await api('POST', `/api/companion/${companionId}/rest`, { restType: 'short' });
  assert(restRes.status === 200, 'Warlock short rest returns 200');
  assert(restRes.body.spell_slots_restored === true, 'Warlock reports slots restored on short rest');

  const statusRes = await api('GET', `/api/companion/${companionId}/spell-slots`);
  assert(!statusRes.body.used || Object.keys(statusRes.body.used).length === 0 || statusRes.body.used['2'] === 0,
    'Warlock pact slots cleared after short rest');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionSpellSlotRejectsNpcStatsCompanion() {
  console.log('\n  -- npc_stats companion /spell-slots/use returns 400 --');
  // Create an npc_stats companion directly
  const npcRes = await api('POST', '/api/npc', {
    name: `TEST_NpcStats_${Date.now()}`, race: 'Human', stat_block: 'commoner',
    campaign_availability: 'companion'
  });
  assert(npcRes.status === 201, 'NPC create OK');
  const npcId = npcRes.body.id;

  const recRes = await api('POST', '/api/companion/recruit', {
    npc_id: npcId,
    recruited_by_character_id: testCharId,
    progression_type: 'npc_stats'
  });
  assert(recRes.status === 201, 'Recruit npc_stats OK');
  const companionId = recRes.body.companion.id;

  const getRes = await api('GET', `/api/companion/${companionId}/spell-slots`);
  assert(getRes.status === 200, 'GET returns 200 with empty shape for npc_stats');
  assert(Object.keys(getRes.body.max || {}).length === 0, 'max is empty for npc_stats');

  const useRes = await api('POST', `/api/companion/${companionId}/spell-slots/use`, { level: 1 });
  assert(useRes.status === 400, `POST /use returns 400 for npc_stats (got ${useRes.status})`);

  await cleanupTestCompanion(companionId, npcId);
}

// ===== GROUP 13: Companion Combat Safety — Conditions + Death Saves (Phase 7) =====

async function testCompanionConditionsInitialState() {
  console.log('\n  -- New companion starts with empty conditions array --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);
  const res = await api('GET', `/api/companion/${companionId}/conditions`);
  assert(res.status === 200, `GET conditions returns 200 (got ${res.status})`);
  assert(Array.isArray(res.body.conditions) && res.body.conditions.length === 0, 'conditions is empty array');
  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionConditionAddRemove() {
  console.log('\n  -- Add + remove conditions round-trip --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);

  const addRes = await api('POST', `/api/companion/${companionId}/conditions/add`, { condition: 'poisoned' });
  assert(addRes.status === 200, 'add poisoned returns 200');
  assert(addRes.body.conditions.includes('poisoned'), 'conditions includes poisoned after add');

  const add2 = await api('POST', `/api/companion/${companionId}/conditions/add`, { condition: 'Prone' });
  assert(add2.body.conditions.includes('prone'), 'Case insensitive — Prone normalized to prone');
  assert(add2.body.conditions.length === 2, 'conditions has 2 entries');

  const dup = await api('POST', `/api/companion/${companionId}/conditions/add`, { condition: 'poisoned' });
  assert(dup.body.conditions.length === 2, 'Duplicate add is idempotent (still 2)');

  const remRes = await api('POST', `/api/companion/${companionId}/conditions/remove`, { condition: 'poisoned' });
  assert(!remRes.body.conditions.includes('poisoned'), 'conditions no longer includes poisoned');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionExhaustionMutuallyExclusive() {
  console.log('\n  -- Exhaustion levels are mutually exclusive --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);

  await api('POST', `/api/companion/${companionId}/conditions/add`, { condition: 'exhaustion_2' });
  const addRes = await api('POST', `/api/companion/${companionId}/conditions/add`, { condition: 'exhaustion_4' });
  const exhaustion = addRes.body.conditions.filter(c => c.startsWith('exhaustion_'));
  assert(exhaustion.length === 1, `Only one exhaustion level at a time (got ${exhaustion.length})`);
  assert(exhaustion[0] === 'exhaustion_4', 'Latest exhaustion level replaces prior');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionUnknownConditionRejected() {
  console.log('\n  -- Unknown condition returns 400 --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);
  const res = await api('POST', `/api/companion/${companionId}/conditions/add`, { condition: 'radiant_bloom' });
  assert(res.status === 400, `Unknown condition returns 400 (got ${res.status})`);
  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionLongRestClearsConditionsAndDecrementsExhaustion() {
  console.log('\n  -- Long rest clears conditions and decrements exhaustion --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);

  await api('POST', `/api/companion/${companionId}/conditions/add`, { condition: 'poisoned' });
  await api('POST', `/api/companion/${companionId}/conditions/add`, { condition: 'exhaustion_3' });
  await api('POST', `/api/companion/${companionId}/conditions/add`, { condition: 'petrified' });

  await api('POST', `/api/companion/${companionId}/rest`, { restType: 'long' });

  const res = await api('GET', `/api/companion/${companionId}/conditions`);
  assert(!res.body.conditions.includes('poisoned'), 'poisoned cleared by long rest');
  assert(res.body.conditions.includes('petrified'), 'petrified persists through long rest');
  assert(res.body.conditions.includes('exhaustion_2'), `exhaustion_3 decremented to exhaustion_2 (got ${res.body.conditions})`);

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionDeathSaveBlockedWhenAbove0Hp() {
  console.log('\n  -- Death save blocked when HP > 0 --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);
  const res = await api('POST', `/api/companion/${companionId}/death-save`, { roll: 15 });
  assert(res.status === 400, `Returns 400 when HP > 0 (got ${res.status})`);
  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionDeathSaveSuccess() {
  console.log('\n  -- Death save success increments successes --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);
  await dbRun('UPDATE companions SET companion_current_hp = 0 WHERE id = ?', [companionId]);

  const r = await api('POST', `/api/companion/${companionId}/death-save`, { outcome: 'success' });
  assert(r.status === 200, 'success outcome returns 200');
  assert(r.body.successes === 1 && r.body.failures === 0, 'successes=1, failures=0');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionDeathSaveStabilizesAtThreeSuccesses() {
  console.log('\n  -- Three successes = stabilized --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);
  await dbRun('UPDATE companions SET companion_current_hp = 0 WHERE id = ?', [companionId]);

  await api('POST', `/api/companion/${companionId}/death-save`, { outcome: 'success' });
  await api('POST', `/api/companion/${companionId}/death-save`, { outcome: 'success' });
  const r = await api('POST', `/api/companion/${companionId}/death-save`, { outcome: 'success' });
  assert(r.body.stabilized === true, 'stabilized=true after third success');
  assert(r.body.successes === 0 && r.body.failures === 0, 'tallies reset to 0 after stabilize');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionDeathSaveDiesAtThreeFailures() {
  console.log('\n  -- Three failures = dead --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);
  await dbRun('UPDATE companions SET companion_current_hp = 0 WHERE id = ?', [companionId]);

  await api('POST', `/api/companion/${companionId}/death-save`, { outcome: 'failure' });
  await api('POST', `/api/companion/${companionId}/death-save`, { outcome: 'failure' });
  const r = await api('POST', `/api/companion/${companionId}/death-save`, { outcome: 'failure' });
  assert(r.body.dead === true, 'dead=true after third failure');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionDeathSaveCriticalSuccessRevives() {
  console.log('\n  -- Natural 20 revives at 1 HP --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);
  await dbRun('UPDATE companions SET companion_current_hp = 0, death_save_successes = 2 WHERE id = ?', [companionId]);

  const r = await api('POST', `/api/companion/${companionId}/death-save`, { roll: 20 });
  assert(r.body.hp === 1, `HP revives to 1 (got ${r.body.hp})`);
  assert(r.body.successes === 0 && r.body.failures === 0, 'tallies reset after revive');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionDeathSaveCriticalFailureCountsTwo() {
  console.log('\n  -- Natural 1 counts as two failures --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);
  await dbRun('UPDATE companions SET companion_current_hp = 0 WHERE id = ?', [companionId]);

  const r = await api('POST', `/api/companion/${companionId}/death-save`, { roll: 1 });
  assert(r.body.failures === 2, `failures=2 after nat 1 (got ${r.body.failures})`);
  assert(r.body.dead === false, 'Not dead at 2 failures');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionStabilizeEndpoint() {
  console.log('\n  -- Stabilize resets death save tallies --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);
  await dbRun('UPDATE companions SET companion_current_hp = 0, death_save_successes = 1, death_save_failures = 2 WHERE id = ?', [companionId]);

  const r = await api('POST', `/api/companion/${companionId}/stabilize`);
  assert(r.status === 200, 'stabilize returns 200');
  assert(r.body.successes === 0 && r.body.failures === 0, 'tallies reset to 0');

  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionLongRestResetsDeathSaves() {
  console.log('\n  -- Long rest resets death save tallies --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);
  await dbRun(
    'UPDATE companions SET death_save_successes = 2, death_save_failures = 1 WHERE id = ?',
    [companionId]
  );
  await api('POST', `/api/companion/${companionId}/rest`, { restType: 'long' });
  const c = await dbGet('SELECT death_save_successes, death_save_failures FROM companions WHERE id = ?', [companionId]);
  assert(c.death_save_successes === 0 && c.death_save_failures === 0, 'Long rest clears both tallies');
  await cleanupTestCompanion(companionId, npcId);
}


// ===== GROUP 14: Party Inventory + Equip/Unequip (M1) =====

async function setCharInventory(charId, items) {
  await dbRun('UPDATE characters SET inventory = ? WHERE id = ?', [JSON.stringify(items), charId]);
}
async function getCharInventory(charId) {
  const row = await dbGet('SELECT inventory FROM characters WHERE id = ?', [charId]);
  return parseJSON(row?.inventory || '[]');
}

async function testM1RetiredEndpointsReturn410() {
  console.log('\n  -- Retired Phase 8/9 endpoints return 410 --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);

  const give = await api('POST', `/api/companion/${companionId}/give-item`, {
    characterId: testCharId, itemName: 'Anything', quantity: 1
  });
  assert(give.status === 410, `give-item returns 410 (got ${give.status})`);

  const take = await api('POST', `/api/companion/${companionId}/take-item`, {
    characterId: testCharId, itemName: 'Anything', quantity: 1
  });
  assert(take.status === 410, 'take-item returns 410');

  const merchant = await api('POST', `/api/companion/${companionId}/merchant-transaction`, {
    bought: [{ name: 'Thing', quantity: 1, price_gp: 1 }]
  });
  assert(merchant.status === 410, 'companion merchant-transaction returns 410');

  await cleanupTestCompanion(companionId, npcId);
}

async function testM1EquipItemFromPartyPool() {
  console.log('\n  -- Companion equips an item from the party pool --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);
  await setCharInventory(testCharId, [{ name: 'Longsword', quantity: 1 }]);

  const r = await api('POST', `/api/companion/${companionId}/equip`, {
    slot: 'mainHand', itemName: 'Longsword'
  });
  assert(r.status === 200, `equip returns 200 (got ${r.status})`);
  assert(r.body.equipped?.name === 'Longsword', 'equipped field reports Longsword');

  const charInv = await getCharInventory(testCharId);
  assert(charInv.length === 0, 'Longsword removed from party pool');

  const compRow = await dbGet('SELECT equipment FROM companions WHERE id = ?', [companionId]);
  const eq = parseJSON(compRow.equipment);
  assert(eq.mainHand?.name === 'Longsword', 'companion.equipment.mainHand is Longsword');

  await cleanupTestCompanion(companionId, npcId);
  await setCharInventory(testCharId, []);
}

async function testM1EquipReturnsPreviousItemToPool() {
  console.log('\n  -- Equipping a second item returns the previous to the pool --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);
  await setCharInventory(testCharId, [
    { name: 'Dagger', quantity: 1 },
    { name: 'Mace', quantity: 1 }
  ]);

  await api('POST', `/api/companion/${companionId}/equip`, { slot: 'mainHand', itemName: 'Dagger' });
  const r = await api('POST', `/api/companion/${companionId}/equip`, { slot: 'mainHand', itemName: 'Mace' });
  assert(r.status === 200, 'swap equip returns 200');
  assert(r.body.returned_to_pool?.name === 'Dagger', 'previous item returned to pool');

  const charInv = await getCharInventory(testCharId);
  assert(charInv.find(i => i.name === 'Dagger')?.quantity === 1, 'Dagger back in party pool');
  assert(!charInv.find(i => i.name === 'Mace'), 'Mace removed from party pool (now equipped)');

  await cleanupTestCompanion(companionId, npcId);
  await setCharInventory(testCharId, []);
}

async function testM1UnequipToPool() {
  console.log('\n  -- Unequip returns the item to the party pool --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);
  await setCharInventory(testCharId, [{ name: 'Shield', quantity: 1 }]);

  await api('POST', `/api/companion/${companionId}/equip`, { slot: 'offHand', itemName: 'Shield' });
  const r = await api('POST', `/api/companion/${companionId}/unequip`, { slot: 'offHand' });
  assert(r.status === 200, 'unequip returns 200');
  assert(r.body.returned_to_pool?.name === 'Shield', 'Shield returned to pool');

  const charInv = await getCharInventory(testCharId);
  assert(charInv.find(i => i.name === 'Shield')?.quantity === 1, 'Shield back in party pool');

  const compRow = await dbGet('SELECT equipment FROM companions WHERE id = ?', [companionId]);
  const eq = parseJSON(compRow.equipment);
  assert(!eq.offHand || !eq.offHand.name, 'offHand slot cleared');

  await cleanupTestCompanion(companionId, npcId);
  await setCharInventory(testCharId, []);
}

async function testM1EquipRejectsMissingItem() {
  console.log('\n  -- Equip rejects when item is not in the pool --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);
  await setCharInventory(testCharId, []);

  const r = await api('POST', `/api/companion/${companionId}/equip`, {
    slot: 'mainHand', itemName: 'Phantom Blade'
  });
  assert(r.status === 400, `Returns 400 when item missing from pool (got ${r.status})`);

  await cleanupTestCompanion(companionId, npcId);
}

async function testM1EquipRejectsInvalidSlot() {
  console.log('\n  -- Equip rejects unknown slot names --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);
  await setCharInventory(testCharId, [{ name: 'Hat', quantity: 1 }]);

  const r = await api('POST', `/api/companion/${companionId}/equip`, {
    slot: 'helmet', itemName: 'Hat'
  });
  assert(r.status === 400, `Unknown slot returns 400 (got ${r.status})`);

  await cleanupTestCompanion(companionId, npcId);
  await setCharInventory(testCharId, []);
}

async function testM1UnequipRejectsEmptySlot() {
  console.log('\n  -- Unequip rejects when the slot is already empty --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);

  const r = await api('POST', `/api/companion/${companionId}/unequip`, { slot: 'mainHand' });
  assert(r.status === 400, 'Empty slot unequip returns 400');

  await cleanupTestCompanion(companionId, npcId);
}

async function testM1RecruitStartsCompanionWithEmptyCarry() {
  console.log('\n  -- Recruit leaves companion inventory + gold empty (party bucket absorbs) --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);

  const row = await dbGet(
    'SELECT inventory, gold_gp, gold_sp, gold_cp FROM companions WHERE id = ?',
    [companionId]
  );
  const inv = parseJSON(row.inventory || '[]');
  assert(Array.isArray(inv) && inv.length === 0, 'companion.inventory is empty');
  assert((row.gold_gp || 0) === 0 && (row.gold_sp || 0) === 0 && (row.gold_cp || 0) === 0,
    'companion gold columns are all zero');

  await cleanupTestCompanion(companionId, npcId);
}

// ===== GROUP 16: Companion Multiclass (Phase 10) =====

async function testCompanionRecruitSeedsClassLevels() {
  console.log('\n  -- Recruit seeds companion_class_levels --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 2);
  const row = await dbGet(
    'SELECT companion_class_levels FROM companions WHERE id = ?',
    [companionId]
  );
  const parsed = parseJSON(row.companion_class_levels || '[]');
  assert(Array.isArray(parsed) && parsed.length === 1, 'class_levels is a single-entry array');
  assert(parsed[0].class === 'Fighter' && parsed[0].level === 2, `Primary class seeded correctly (got ${JSON.stringify(parsed)})`);
  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionLevelUpAdvancesPrimary() {
  console.log('\n  -- Level-up with no targetClass advances primary class --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 2);
  const r = await api('POST', `/api/companion/${companionId}/level-up`, { hpRoll: 'average' });
  assert(r.status === 200, `level-up returns 200 (got ${r.status})`);

  const row = await dbGet(
    'SELECT companion_level, companion_class_levels FROM companions WHERE id = ?',
    [companionId]
  );
  assert(row.companion_level === 3, `Total level = 3 (got ${row.companion_level})`);
  const cl = parseJSON(row.companion_class_levels);
  assert(cl.length === 1 && cl[0].class === 'Fighter' && cl[0].level === 3,
    `Fighter advanced to 3 (got ${JSON.stringify(cl)})`);
  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionLevelUpMulticlassAdd() {
  console.log('\n  -- Level-up with new targetClass adds multiclass entry --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);

  const r = await api('POST', `/api/companion/${companionId}/level-up`, {
    hpRoll: 'average',
    targetClass: 'Wizard'
  });
  assert(r.status === 200, 'multiclass-add returns 200');
  assert(r.body.levelUpSummary.isMulticlassAddition === true, 'marked as multiclass addition');
  assert(r.body.levelUpSummary.targetClass === 'Wizard', 'targetClass reported');

  const row = await dbGet(
    'SELECT companion_level, companion_class, companion_class_levels FROM companions WHERE id = ?',
    [companionId]
  );
  assert(row.companion_level === 4, `Total level = 4 (got ${row.companion_level})`);
  assert(row.companion_class === 'Fighter', `Primary class stays Fighter (got ${row.companion_class})`);
  const cl = parseJSON(row.companion_class_levels);
  assert(cl.length === 2, `class_levels has 2 entries (got ${cl.length})`);
  assert(cl.find(c => c.class === 'Wizard')?.level === 1, 'Wizard entry at level 1');
  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionLevelUpAdvancesSecondary() {
  console.log('\n  -- Level-up advances a secondary class once multiclass is set up --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);

  // First, multiclass into Wizard
  await api('POST', `/api/companion/${companionId}/level-up`, {
    hpRoll: 'average', targetClass: 'Wizard'
  });
  // Then advance Wizard again
  const r = await api('POST', `/api/companion/${companionId}/level-up`, {
    hpRoll: 'average', targetClass: 'Wizard'
  });
  assert(r.status === 200, 'secondary advance returns 200');
  assert(r.body.levelUpSummary.isMulticlassAddition === false,
    'second Wizard level is not a new addition');

  const row = await dbGet(
    'SELECT companion_level, companion_class_levels FROM companions WHERE id = ?',
    [companionId]
  );
  assert(row.companion_level === 5, `Total level = 5 (got ${row.companion_level})`);
  const cl = parseJSON(row.companion_class_levels);
  assert(cl.find(c => c.class === 'Wizard')?.level === 2, 'Wizard advanced to 2');
  assert(cl.find(c => c.class === 'Fighter')?.level === 3, 'Fighter stays at 3');
  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionMulticlassSpellSlots() {
  console.log('\n  -- Multiclass companion gets combined spell slots --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Wizard', 3);

  // Multiclass into Cleric
  await api('POST', `/api/companion/${companionId}/level-up`, {
    hpRoll: 'average', targetClass: 'Cleric'
  });

  const r = await api('GET', `/api/companion/${companionId}/spell-slots`);
  assert(r.status === 200, 'spell-slots returns 200');
  // Wizard 3 + Cleric 1 → caster level 4 (both full casters, combined)
  // Full caster L4: { 1: 4, 2: 3 }
  assert(r.body.max['1'] === 4, `L1 slots = 4 (got ${r.body.max['1']})`);
  assert(r.body.max['2'] === 3, `L2 slots = 3 (got ${r.body.max['2']})`);
  assert(Array.isArray(r.body.class_levels) && r.body.class_levels.length === 2,
    'class_levels returned with 2 entries');
  await cleanupTestCompanion(companionId, npcId);
}

async function testCompanionLevelUpInfoExposesClassLevels() {
  console.log('\n  -- level-up-info exposes classLevels + canMulticlass flag --');
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);
  const r = await api('GET', `/api/companion/${companionId}/level-up-info`);
  assert(r.status === 200, 'level-up-info returns 200');
  assert(Array.isArray(r.body.classLevels) && r.body.classLevels.length === 1,
    'classLevels is an array');
  assert(r.body.choices?.canMulticlass === true, 'canMulticlass flag is true');
  await cleanupTestCompanion(companionId, npcId);
}

// ===== GROUP 17: Merchant Commissions (M2) =====
//
// Custom-order lifecycle: commission → pending → ready (via tick) →
// collected. Plus cancel/expire edge cases.

async function createTestMerchantForCommission(goldGp = 1000) {
  const result = await dbRun(
    `INSERT INTO merchant_inventories (campaign_id, merchant_name, merchant_type, inventory, gold_gp, prosperity)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [testCampaignId, `TEST_OrderMerchant_${Date.now()}`, 'blacksmith', '[]', goldGp, 'comfortable']
  );
  return Number(result.lastInsertRowid);
}

async function cleanupTestOrderMerchant(merchantId) {
  if (merchantId) {
    await dbRun('DELETE FROM merchant_orders WHERE merchant_id = ?', [merchantId]);
    await dbRun('DELETE FROM merchant_inventories WHERE id = ?', [merchantId]);
  }
}

async function testPlaceCommissionHappyPath() {
  console.log('\n  -- Place commission deducts deposit and records pending order --');
  const merchantId = await createTestMerchantForCommission();
  await dbRun('UPDATE characters SET gold_gp = 500, gold_sp = 0, gold_cp = 0 WHERE id = ?', [testCharId]);

  const r = await api('POST', `/api/merchant/${merchantId}/commission`, {
    characterId: testCharId,
    itemName: 'Masterwork Longsword',
    itemSpec: { quality: 'masterwork', description: 'etched with crescent moon' },
    quotedPriceGp: 400,
    depositGp: 150,
    leadTimeDays: 7,
    currentGameDay: 10,
    narrativeHook: 'crescent moon etched into the blade'
  });
  assert(r.status === 201, `commission returns 201 (got ${r.status})`);
  assert(r.body.order.status === 'pending', 'order status is pending');
  assert(r.body.order.deadline_game_day === 17, `deadline = 10 + 7 = 17 (got ${r.body.order.deadline_game_day})`);
  assert(r.body.order.balance_cp === 25000, `balance = 400-150 = 250gp = 25000cp (got ${r.body.order.balance_cp})`);

  const char = await dbGet('SELECT gold_gp FROM characters WHERE id = ?', [testCharId]);
  assert(char.gold_gp === 350, `Character gold reduced to 350gp (got ${char.gold_gp})`);

  await cleanupTestOrderMerchant(merchantId);
}

async function testCommissionRejectsInsufficientDeposit() {
  console.log('\n  -- Commission rejected when party can\'t afford deposit --');
  const merchantId = await createTestMerchantForCommission();
  await dbRun('UPDATE characters SET gold_gp = 5, gold_sp = 0, gold_cp = 0 WHERE id = ?', [testCharId]);

  const r = await api('POST', `/api/merchant/${merchantId}/commission`, {
    characterId: testCharId,
    itemName: 'Magic Wand',
    quotedPriceGp: 500,
    depositGp: 200,
    leadTimeDays: 14
  });
  assert(r.status === 400, 'returns 400 on insufficient gold');

  const char = await dbGet('SELECT gold_gp FROM characters WHERE id = ?', [testCharId]);
  assert(char.gold_gp === 5, 'Character gold unchanged after rejected commission');

  await cleanupTestOrderMerchant(merchantId);
}

async function testCommissionRejectsBadInput() {
  console.log('\n  -- Commission rejects bad inputs (deposit > quoted, zero lead time) --');
  const merchantId = await createTestMerchantForCommission();
  await dbRun('UPDATE characters SET gold_gp = 500 WHERE id = ?', [testCharId]);

  const r1 = await api('POST', `/api/merchant/${merchantId}/commission`, {
    characterId: testCharId, itemName: 'Thing', quotedPriceGp: 50, depositGp: 100, leadTimeDays: 3
  });
  assert(r1.status === 400, 'deposit > quoted price rejected');

  const r2 = await api('POST', `/api/merchant/${merchantId}/commission`, {
    characterId: testCharId, itemName: 'Thing', quotedPriceGp: 50, depositGp: 10, leadTimeDays: 0
  });
  assert(r2.status === 400, 'zero lead time rejected');

  await cleanupTestOrderMerchant(merchantId);
}

async function testCommissionProcessDueOrders() {
  console.log('\n  -- Living-world tick flips due orders from pending to ready --');
  const merchantId = await createTestMerchantForCommission();
  await dbRun('UPDATE characters SET gold_gp = 500 WHERE id = ?', [testCharId]);

  const c = await api('POST', `/api/merchant/${merchantId}/commission`, {
    characterId: testCharId, itemName: 'Test Blade', quotedPriceGp: 100, depositGp: 50,
    leadTimeDays: 3, currentGameDay: 10
  });
  assert(c.status === 201, 'commission placed');
  const orderId = c.body.order.id;

  // Import the service directly and simulate a tick at game day 13
  const { processDueOrders } = await import('../server/services/merchantOrderService.js');
  const readied = await processDueOrders(13);
  assert(Array.isArray(readied), 'processDueOrders returns an array');
  assert(readied.find(o => o.id === orderId), 'our order was flipped to ready');

  const after = await api('GET', `/api/merchant/orders/${orderId}`);
  assert(after.body.order.status === 'ready', 'order status is now ready');
  assert(after.body.order.ready_game_day === 13, 'ready_game_day stamped');

  await cleanupTestOrderMerchant(merchantId);
}

async function testCollectOrder() {
  console.log('\n  -- Collect ready order: pays balance, adds item to party inventory --');
  const merchantId = await createTestMerchantForCommission();
  await dbRun('UPDATE characters SET gold_gp = 500, inventory = ? WHERE id = ?', [JSON.stringify([]), testCharId]);

  const c = await api('POST', `/api/merchant/${merchantId}/commission`, {
    characterId: testCharId, itemName: 'Silver Dagger', quotedPriceGp: 100, depositGp: 50,
    leadTimeDays: 2, currentGameDay: 10
  });
  const orderId = c.body.order.id;

  const { processDueOrders } = await import('../server/services/merchantOrderService.js');
  await processDueOrders(12);

  const r = await api('POST', `/api/merchant/orders/${orderId}/collect`, { characterId: testCharId });
  assert(r.status === 200, `collect returns 200 (got ${r.status})`);
  assert(r.body.order.status === 'collected', 'status = collected');

  const char = await dbGet('SELECT gold_gp, inventory FROM characters WHERE id = ?', [testCharId]);
  assert(char.gold_gp === 400, `Balance 50gp deducted (got ${char.gold_gp})`);
  const inv = parseJSON(char.inventory);
  assert(inv.find(i => i.name === 'Silver Dagger'), 'Silver Dagger added to inventory');

  await cleanupTestOrderMerchant(merchantId);
  await dbRun('UPDATE characters SET inventory = ? WHERE id = ?', [JSON.stringify([]), testCharId]);
}

async function testCollectBlockedWhenNotReady() {
  console.log('\n  -- Collect rejected while order is still pending --');
  const merchantId = await createTestMerchantForCommission();
  await dbRun('UPDATE characters SET gold_gp = 500 WHERE id = ?', [testCharId]);

  const c = await api('POST', `/api/merchant/${merchantId}/commission`, {
    characterId: testCharId, itemName: 'Pending Item', quotedPriceGp: 50, depositGp: 25, leadTimeDays: 10
  });
  const orderId = c.body.order.id;

  const r = await api('POST', `/api/merchant/orders/${orderId}/collect`, { characterId: testCharId });
  assert(r.status === 400, 'pending collect returns 400');

  await cleanupTestOrderMerchant(merchantId);
}

async function testCancelOrderForfeitsDeposit() {
  console.log('\n  -- Cancel pending order: deposit is forfeit --');
  const merchantId = await createTestMerchantForCommission();
  await dbRun('UPDATE characters SET gold_gp = 500 WHERE id = ?', [testCharId]);

  const c = await api('POST', `/api/merchant/${merchantId}/commission`, {
    characterId: testCharId, itemName: 'Cancelled Order', quotedPriceGp: 100, depositGp: 40, leadTimeDays: 5
  });
  const orderId = c.body.order.id;

  const r = await api('POST', `/api/merchant/orders/${orderId}/cancel`, { characterId: testCharId });
  assert(r.status === 200, 'cancel returns 200');
  assert(r.body.order.status === 'cancelled', 'status = cancelled');
  assert(r.body.deposit_forfeit_cp === 4000, 'deposit_forfeit_cp = 40gp = 4000cp');

  const char = await dbGet('SELECT gold_gp FROM characters WHERE id = ?', [testCharId]);
  assert(char.gold_gp === 460, `Gold unchanged after cancel (deposit already deducted at placement) — got ${char.gold_gp}`);

  await cleanupTestOrderMerchant(merchantId);
}

async function testListOrdersForCharacter() {
  console.log('\n  -- List orders for character returns all statuses --');
  const merchantId = await createTestMerchantForCommission();
  await dbRun('UPDATE characters SET gold_gp = 500 WHERE id = ?', [testCharId]);

  await api('POST', `/api/merchant/${merchantId}/commission`, {
    characterId: testCharId, itemName: 'Order 1', quotedPriceGp: 50, depositGp: 20, leadTimeDays: 5
  });
  await api('POST', `/api/merchant/${merchantId}/commission`, {
    characterId: testCharId, itemName: 'Order 2', quotedPriceGp: 80, depositGp: 30, leadTimeDays: 10
  });

  const r = await api('GET', `/api/merchant/orders/character/${testCharId}`);
  assert(r.status === 200, 'list returns 200');
  assert(Array.isArray(r.body.orders) && r.body.orders.length >= 2, 'returned at least 2 orders');
  assert(r.body.orders.every(o => o.character_id === testCharId), 'all orders belong to our character');

  await cleanupTestOrderMerchant(merchantId);
}

// ===== GROUP 18: Merchant Bargaining / Haggle (M3) =====

async function testHaggleHappyPath() {
  console.log('\n  -- Character haggles successfully, gets a discount --');
  const merchantId = await createTestMerchantForCommission();
  await dbRun('UPDATE characters SET gold_gp = 500 WHERE id = ?', [testCharId]);

  const r = await api('POST', `/api/merchant/${merchantId}/haggle`, {
    characterId: testCharId,
    rollerType: 'character',
    skill: 'Persuasion',
    itemRarity: 'common',
    rollValue: 20 // natural 20 — max tier
  });
  assert(r.status === 200, `haggle returns 200 (got ${r.status})`);
  assert(r.body.success === true, 'nat 20 always succeeds');
  assert(r.body.discountPercent === 20, `nat 20 gives 20% discount (got ${r.body.discountPercent})`);
  assert(r.body.critical === true, 'critical flag set');

  await cleanupTestOrderMerchant(merchantId);
}

async function testHaggleFailure() {
  console.log('\n  -- Haggle failure returns no discount --');
  const merchantId = await createTestMerchantForCommission();

  const r = await api('POST', `/api/merchant/${merchantId}/haggle`, {
    characterId: testCharId,
    rollerType: 'character',
    skill: 'Persuasion',
    itemRarity: 'legendary', // DC 23 at neutral comfortable
    rollValue: 3 // low roll, guaranteed fail
  });
  assert(r.body.success === false, 'low roll vs legendary DC fails');
  assert(r.body.discountPercent === 0, 'no discount on failure');

  await cleanupTestOrderMerchant(merchantId);
}

async function testHaggleCriticalFail() {
  console.log('\n  -- Natural 1 is auto-fail with disposition hit --');
  const merchantId = await createTestMerchantForCommission();

  const r = await api('POST', `/api/merchant/${merchantId}/haggle`, {
    characterId: testCharId,
    skill: 'Persuasion',
    itemRarity: 'common',
    rollValue: 1,
    attemptNumber: 1
  });
  assert(r.body.success === false, 'nat 1 always fails');
  assert(r.body.criticalFail === true, 'criticalFail flag set');
  assert(r.body.dispositionChange <= -1, `disposition hit on crit fail (got ${r.body.dispositionChange})`);

  await cleanupTestOrderMerchant(merchantId);
}

async function testHaggleIntimidationPenalty() {
  console.log('\n  -- Intimidation failure carries a disposition hit even on first attempt --');
  const merchantId = await createTestMerchantForCommission();

  const r = await api('POST', `/api/merchant/${merchantId}/haggle`, {
    characterId: testCharId,
    skill: 'Intimidation',
    itemRarity: 'rare', // DC 18 base
    rollValue: 5,
    attemptNumber: 1
  });
  assert(r.body.success === false, 'Intimidation fails with low roll');
  assert(r.body.dispositionChange < 0, `Intimidation failure hits disposition (got ${r.body.dispositionChange})`);

  await cleanupTestOrderMerchant(merchantId);
}

async function testHaggleRepeatAttemptPenalty() {
  console.log('\n  -- Repeat haggle attempts accrue a disposition penalty on failure --');
  const merchantId = await createTestMerchantForCommission();

  const r = await api('POST', `/api/merchant/${merchantId}/haggle`, {
    characterId: testCharId,
    skill: 'Persuasion',
    itemRarity: 'rare',
    rollValue: 5,
    attemptNumber: 3 // third attempt, failure
  });
  assert(r.body.success === false, 'Repeat attempt fails');
  assert(r.body.dispositionChange < 0, 'Repeat persuasion failure accrues disposition hit');

  await cleanupTestOrderMerchant(merchantId);
}

async function testHaggleRejectsInvalidSkill() {
  console.log('\n  -- Haggle rejects unknown skills --');
  const merchantId = await createTestMerchantForCommission();

  const r = await api('POST', `/api/merchant/${merchantId}/haggle`, {
    characterId: testCharId,
    skill: 'Athletics',
    rollValue: 15
  });
  assert(r.status === 400, `unknown skill rejected (got ${r.status})`);

  await cleanupTestOrderMerchant(merchantId);
}

async function testHaggleCompanionRoller() {
  console.log('\n  -- Companion can roll to haggle --');
  const merchantId = await createTestMerchantForCommission();
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Bard', 3);

  const r = await api('POST', `/api/merchant/${merchantId}/haggle`, {
    characterId: testCharId,
    rollerType: 'companion',
    companionId,
    skill: 'Persuasion',
    itemRarity: 'common',
    rollValue: 18
  });
  assert(r.status === 200, `companion haggle returns 200 (got ${r.status})`);
  assert(r.body.roller?.type === 'companion', 'roller reported as companion');

  await cleanupTestCompanion(companionId, npcId);
  await cleanupTestOrderMerchant(merchantId);
}

async function testHaggleDiscountAppliesToTransaction() {
  console.log('\n  -- haggleDiscountPercent is applied server-side in transaction --');
  // Stage: fully-stocked test merchant
  const merchantId = await createTestMerchantForCommission();
  await dbRun(
    `UPDATE merchant_inventories SET inventory = ? WHERE id = ?`,
    [JSON.stringify([{ name: 'Sword', quantity: 1, price_gp: 100, price_sp: 0, price_cp: 0, category: 'weapon', rarity: 'common' }]), merchantId]
  );
  await dbRun('UPDATE characters SET gold_gp = 200, gold_sp = 0, gold_cp = 0, inventory = ? WHERE id = ?',
    [JSON.stringify([]), testCharId]);

  // Need an active session to call merchant-transaction; use the already-seeded testSessionId.
  const r = await api('POST', `/api/dm-session/${testSessionId}/merchant-transaction`, {
    merchantName: `TEST_OrderMerchant_${merchantId}`, // name doesn't need to match — merchantId is the key
    merchantId,
    bought: [{ name: 'Sword', quantity: 1, price_gp: 100, price_sp: 0, price_cp: 0 }],
    sold: [],
    haggleDiscountPercent: 20
  });
  assert(r.status === 200, `transaction returns 200 (got ${r.status})`);

  const char = await dbGet('SELECT gold_gp FROM characters WHERE id = ?', [testCharId]);
  // With 20% discount on 100gp: 80gp spent, so gold should be 120
  assert(char.gold_gp === 120, `20% discount applied — 200-80=120gp (got ${char.gold_gp})`);

  await cleanupTestOrderMerchant(merchantId);
}

async function testHaggleDiscountClampedServerSide() {
  console.log('\n  -- Server clamps haggleDiscountPercent to [0, 20] --');
  const merchantId = await createTestMerchantForCommission();
  await dbRun(
    `UPDATE merchant_inventories SET inventory = ? WHERE id = ?`,
    [JSON.stringify([{ name: 'Bow', quantity: 1, price_gp: 50, price_sp: 0, price_cp: 0, category: 'weapon', rarity: 'common' }]), merchantId]
  );
  await dbRun('UPDATE characters SET gold_gp = 100, gold_sp = 0, gold_cp = 0, inventory = ? WHERE id = ?',
    [JSON.stringify([]), testCharId]);

  // Claim an outrageous 90% discount — server should clamp to 20%
  const r = await api('POST', `/api/dm-session/${testSessionId}/merchant-transaction`, {
    merchantName: `TEST_OrderMerchant_${merchantId}`,
    merchantId,
    bought: [{ name: 'Bow', quantity: 1, price_gp: 50, price_sp: 0, price_cp: 0 }],
    sold: [],
    haggleDiscountPercent: 90
  });
  assert(r.status === 200, 'transaction accepted');

  const char = await dbGet('SELECT gold_gp FROM characters WHERE id = ?', [testCharId]);
  // Clamped to 20%: 50*0.8 = 40gp spent, gold = 60
  assert(char.gold_gp === 60, `clamp to 20% — 100-40=60gp (got ${char.gold_gp})`);

  await cleanupTestOrderMerchant(merchantId);
}

// ===== GROUP 19: Merchant Relationships (M4) =====

async function testRelationshipsEmptyByDefault() {
  console.log('\n  -- Character with no transactions has no relationships --');
  const r = await api('GET', `/api/merchant/relationships/character/${testCharId}`);
  assert(r.status === 200, `returns 200 (got ${r.status})`);
  assert(Array.isArray(r.body.relationships), 'returns array');
}

async function testRelationshipAppearsAfterTransaction() {
  console.log('\n  -- Relationship appears after a transaction is recorded --');
  const merchantId = await createTestMerchantForCommission();
  // Seed a fake transaction history entry directly to avoid needing a full session flow
  await dbRun(
    `UPDATE merchant_inventories SET transaction_history = ? WHERE id = ?`,
    [JSON.stringify([{
      character_id: testCharId, game_day: 5, date: new Date().toISOString(),
      at: new Date().toISOString(),
      total_spent_cp: 5000, total_earned_cp: 0,
      bought: [{ name: 'Sword', category: 'weapon', qty: 1 }], sold: []
    }]), merchantId]
  );

  const r = await api('GET', `/api/merchant/relationships/character/${testCharId}`);
  const rel = r.body.relationships.find(x => x.merchant_id === merchantId);
  assert(rel, 'relationship row present for our merchant');
  assert(rel.visit_count === 1, `visit_count = 1 (got ${rel?.visit_count})`);
  assert(rel.total_spent_cp === 5000, `total_spent_cp = 5000 (got ${rel?.total_spent_cp})`);
  assert(rel.last_visit_game_day === 5, 'last visit day = 5');

  await cleanupTestOrderMerchant(merchantId);
}

async function testRelationshipNotesUpsert() {
  console.log('\n  -- Notes are upserted per character/merchant pair --');
  const merchantId = await createTestMerchantForCommission();
  await dbRun(
    `UPDATE merchant_inventories SET transaction_history = ? WHERE id = ?`,
    [JSON.stringify([{ character_id: testCharId, game_day: 1, bought: [], sold: [] }]), merchantId]
  );

  const r1 = await api('PUT', `/api/merchant/relationships/${merchantId}`, {
    characterId: testCharId,
    notes: 'Great source of rare potions, always has component pouches'
  });
  assert(r1.status === 200, 'initial notes set returns 200');
  assert(r1.body.notes.includes('rare potions'), 'notes persisted');

  // Update just the favorited flag — notes should be preserved
  const r2 = await api('PUT', `/api/merchant/relationships/${merchantId}`, {
    characterId: testCharId, favorited: true
  });
  assert(r2.body.favorited === true, 'favorited toggled on');
  assert(r2.body.notes.includes('rare potions'), 'notes preserved across favorite update');

  await dbRun('DELETE FROM character_merchant_relationships WHERE merchant_id = ?', [merchantId]);
  await cleanupTestOrderMerchant(merchantId);
}

async function testRelationshipFavoritesSortFirst() {
  console.log('\n  -- Favorited merchants sort first in the list --');
  const m1 = await createTestMerchantForCommission();
  const m2 = await createTestMerchantForCommission();

  // Seed both with a transaction
  const tx = [{ character_id: testCharId, game_day: 1, bought: [], sold: [] }];
  await dbRun('UPDATE merchant_inventories SET transaction_history = ? WHERE id = ?', [JSON.stringify(tx), m1]);
  await dbRun('UPDATE merchant_inventories SET transaction_history = ? WHERE id = ?', [JSON.stringify(tx), m2]);

  // Favorite m2
  await api('PUT', `/api/merchant/relationships/${m2}`, { characterId: testCharId, favorited: true });

  const r = await api('GET', `/api/merchant/relationships/character/${testCharId}`);
  const indices = r.body.relationships.map((x, i) => ({ id: x.merchant_id, favorited: x.favorited, i }));
  const m2Idx = indices.find(x => x.id === m2)?.i;
  const m1Idx = indices.find(x => x.id === m1)?.i;
  assert(m2Idx < m1Idx, `favorited merchant ${m2} sorts before non-favorite ${m1}`);

  await dbRun('DELETE FROM character_merchant_relationships WHERE merchant_id IN (?, ?)', [m1, m2]);
  await cleanupTestOrderMerchant(m1);
  await cleanupTestOrderMerchant(m2);
}

async function testRelationshipRequiresCharacterId() {
  console.log('\n  -- PUT /relationships/:merchantId requires characterId --');
  const merchantId = await createTestMerchantForCommission();
  const r = await api('PUT', `/api/merchant/relationships/${merchantId}`, { notes: 'no charId' });
  assert(r.status === 400, 'returns 400 without characterId');
  await cleanupTestOrderMerchant(merchantId);
}

// ===== GROUP 20: Fortress Base Refactor (F1) =====

async function cleanupTestBase(baseId) {
  if (baseId) {
    await dbRun('DELETE FROM base_buildings WHERE base_id = ?', [baseId]);
    await dbRun('DELETE FROM party_bases WHERE id = ?', [baseId]);
  }
}

async function testCreateBaseWithCategorySubtype() {
  console.log('\n  -- Create base with new category + subtype signature --');
  const r = await api('POST', '/api/base', {
    characterId: testCharId,
    campaignId: testCampaignId,
    name: 'TEST_Greywatch',
    category: 'martial',
    subtype: 'fortress',
    description: 'A test fortress'
  });
  assert(r.status === 201, `create base returns 201 (got ${r.status})`);
  assert(r.body.category === 'martial', 'category persisted');
  assert(r.body.subtype === 'fortress', 'subtype persisted');
  assert(r.body.building_slots === 14, `fortress has 14 building slots (got ${r.body.building_slots})`);
  assert(r.body.is_primary === 1, 'first base auto-marked primary');

  await cleanupTestBase(r.body.id);
}

async function testCreateBaseRejectsMismatch() {
  console.log('\n  -- Create rejects subtype that doesn\'t match category --');
  const r = await api('POST', '/api/base', {
    characterId: testCharId,
    campaignId: testCampaignId,
    name: 'TEST_Mismatch',
    category: 'arcane',
    subtype: 'fortress' // fortress is martial, not arcane
  });
  assert(r.status === 400, `mismatch rejected (got ${r.status})`);
}

async function testMultipleBasesSupported() {
  console.log('\n  -- Multiple bases per character; only one primary --');
  const r1 = await api('POST', '/api/base', {
    characterId: testCharId,
    campaignId: testCampaignId,
    name: 'TEST_Primary',
    category: 'martial',
    subtype: 'keep'
  });
  const r2 = await api('POST', '/api/base', {
    characterId: testCharId,
    campaignId: testCampaignId,
    name: 'TEST_Satellite',
    category: 'martial',
    subtype: 'watchtower'
  });
  assert(r1.status === 201 && r2.status === 201, 'both bases created');
  assert(r1.body.is_primary === 1, 'first base is primary');
  assert(r2.body.is_primary === 0, 'second base is not primary');

  const list = await api('GET', `/api/bases/${testCharId}/${testCampaignId}`);
  const ours = list.body.bases.filter(b => [r1.body.id, r2.body.id].includes(b.id));
  assert(ours.length === 2, `both bases returned by /bases endpoint (got ${ours.length})`);

  await cleanupTestBase(r1.body.id);
  await cleanupTestBase(r2.body.id);
}

async function testSetPrimaryBase() {
  console.log('\n  -- Promote a satellite base to primary --');
  const r1 = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_Old_Primary', category: 'martial', subtype: 'keep'
  });
  const r2 = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_New_Primary', category: 'civilian', subtype: 'manor'
  });

  const p = await api('POST', `/api/base/${r2.body.id}/set-primary`);
  assert(p.status === 200 && p.body.is_primary === 1, 'satellite promoted to primary');

  // The old primary should now be a satellite
  const list = await api('GET', `/api/bases/${testCharId}/${testCampaignId}`);
  const oldRow = list.body.bases.find(b => b.id === r1.body.id);
  assert(oldRow.is_primary === 0, 'old primary demoted');

  await cleanupTestBase(r1.body.id);
  await cleanupTestBase(r2.body.id);
}

async function testInstallAndCompleteBuilding() {
  console.log('\n  -- Install building, advance construction, verify perks merge --');
  const b = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_Fortress_For_Building', category: 'martial', subtype: 'fortress'
  });
  // Seed enough treasury for a barracks (500gp)
  await dbRun('UPDATE party_bases SET gold_treasury = 1000 WHERE id = ?', [b.body.id]);

  const install = await api('POST', `/api/base/${b.body.id}/buildings`, {
    building_type: 'barracks', currentGameDay: 10
  });
  assert(install.status === 201, `install returns 201 (got ${install.status})`);
  assert(install.body.status === 'in_progress', 'building status starts in_progress');

  // Advance to completion (barracks needs 80 hours per config)
  const adv = await api('POST', `/api/base/${b.body.id}/buildings/${install.body.id}/advance`, {
    hours: 80, currentGameDay: 15
  });
  assert(adv.status === 200 && adv.body.status === 'completed', 'building completes at hours_required');

  // Verify perk merged into base.active_perks
  const baseRow = await dbGet('SELECT active_perks, gold_treasury FROM party_bases WHERE id = ?', [b.body.id]);
  const perks = parseJSON(baseRow.active_perks);
  assert(perks.includes('garrison_capacity_20'), 'barracks perk in active_perks');
  assert(baseRow.gold_treasury === 500, `treasury reduced by 500gp (got ${baseRow.gold_treasury})`);

  await cleanupTestBase(b.body.id);
}

async function testBuildingCategoryAllowlist() {
  console.log('\n  -- Installing building rejected when category disallows it --');
  const b = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_Wizard_Tower', category: 'arcane', subtype: 'wizard_tower'
  });
  await dbRun('UPDATE party_bases SET gold_treasury = 2000 WHERE id = ?', [b.body.id]);

  // Gatehouse is martial-only
  const r = await api('POST', `/api/base/${b.body.id}/buildings`, {
    building_type: 'gatehouse'
  });
  assert(r.status === 400, `gatehouse rejected in arcane base (got ${r.status})`);

  await cleanupTestBase(b.body.id);
}

async function testBuildingSlotCap() {
  console.log('\n  -- Slot cap enforced — watchtower has only 3 slots --');
  const b = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_Tiny_Watchtower', category: 'martial', subtype: 'watchtower'
  });
  await dbRun('UPDATE party_bases SET gold_treasury = 5000 WHERE id = ?', [b.body.id]);

  // Install 3 single-slot buildings (we have 3 slots)
  await api('POST', `/api/base/${b.body.id}/buildings`, { building_type: 'barracks' });
  await api('POST', `/api/base/${b.body.id}/buildings`, { building_type: 'armory' });
  await api('POST', `/api/base/${b.body.id}/buildings`, { building_type: 'chapel' });

  // Fourth should fail
  const r = await api('POST', `/api/base/${b.body.id}/buildings`, {
    building_type: 'storage_vault'
  });
  assert(r.status === 400, `4th building rejected (got ${r.status})`);

  await cleanupTestBase(b.body.id);
}

async function testAvailableBuildingsEndpoint() {
  console.log('\n  -- /buildings/available returns filtered catalog + slot usage --');
  const b = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_Chapel', category: 'sanctified', subtype: 'chapel'
  });

  const r = await api('GET', `/api/base/${b.body.id}/buildings/available`);
  assert(r.status === 200, 'returns 200');
  assert(Array.isArray(r.body.buildings), 'buildings array');
  assert(r.body.slotsUsed === 0, 'no buildings installed yet');
  assert(r.body.slotsTotal === 4, 'chapel has 4 slots');
  // Gatehouse is martial-only; should not be in sanctified catalog
  assert(!r.body.buildings.find(x => x.key === 'gatehouse'), 'gatehouse excluded from sanctified base');
  // Chapel building is allowedCategories:null → always shown
  assert(r.body.buildings.find(x => x.key === 'chapel'), 'universal-allowed chapel building present');

  await cleanupTestBase(b.body.id);
}

async function testRemoveBuildingStripsPerk() {
  console.log('\n  -- Demolishing a completed building removes its perk from the base --');
  const b = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_Demolish_Base', category: 'martial', subtype: 'fortress'
  });
  await dbRun('UPDATE party_bases SET gold_treasury = 1000 WHERE id = ?', [b.body.id]);

  const install = await api('POST', `/api/base/${b.body.id}/buildings`, {
    building_type: 'barracks'
  });
  await api('POST', `/api/base/${b.body.id}/buildings/${install.body.id}/advance`, { hours: 80 });

  const before = await dbGet('SELECT active_perks FROM party_bases WHERE id = ?', [b.body.id]);
  assert(parseJSON(before.active_perks).includes('garrison_capacity_20'), 'perk was present');

  const d = await api('DELETE', `/api/base/${b.body.id}/buildings/${install.body.id}`);
  assert(d.status === 200, 'demolish returns 200');

  const after = await dbGet('SELECT active_perks FROM party_bases WHERE id = ?', [b.body.id]);
  assert(!parseJSON(after.active_perks).includes('garrison_capacity_20'), 'perk removed after demolish');

  await cleanupTestBase(b.body.id);
}

// ===== GROUP 21: Base Garrison + Defense (F2) =====

async function testSubtypeDefenseBonus() {
  console.log('\n  -- Subtype defense bonus applies at creation --');
  const r = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_DefFort', category: 'martial', subtype: 'fortress'
  });
  assert(r.status === 201, 'base created');
  assert(r.body.subtype_defense_bonus === 8, `fortress has +8 inherent defense (got ${r.body.subtype_defense_bonus})`);
  assert(r.body.defense_rating === 8, 'defense_rating initialized to subtype bonus');
  assert(r.body.garrison_strength === 0, 'garrison_strength starts at 0');
  await cleanupTestBase(r.body.id);
}

async function testCompletedBuildingRaisesDefense() {
  console.log('\n  -- Gatehouse completion adds +3 defense; barracks adds +20 garrison --');
  const r = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_DefBuildings', category: 'martial', subtype: 'fortress'
  });
  await dbRun('UPDATE party_bases SET gold_treasury = 3000 WHERE id = ?', [r.body.id]);

  const g = await api('POST', `/api/base/${r.body.id}/buildings`, { building_type: 'gatehouse' });
  await api('POST', `/api/base/${r.body.id}/buildings/${g.body.id}/advance`, { hours: 120 });

  const b = await api('POST', `/api/base/${r.body.id}/buildings`, { building_type: 'barracks' });
  await api('POST', `/api/base/${r.body.id}/buildings/${b.body.id}/advance`, { hours: 80 });

  const g2 = await api('GET', `/api/base/${r.body.id}/garrison`);
  assert(g2.body.defense_rating === 11, `fortress 8 + gatehouse 3 = 11 defense (got ${g2.body.defense_rating})`);
  assert(g2.body.garrison_strength === 20, `barracks gives 20 garrison (got ${g2.body.garrison_strength})`);

  await cleanupTestBase(r.body.id);
}

async function testAssignAndUnassignOfficer() {
  console.log('\n  -- Assign companion as officer; unassign reverses defense --');
  const base = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_OfficerBase', category: 'martial', subtype: 'keep'
  });

  // Recruit a level-3 companion
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 3);

  const assign = await api('POST', `/api/base/${base.body.id}/officers`, { companionId });
  assert(assign.status === 201, `assign returns 201 (got ${assign.status})`);
  assert(Array.isArray(assign.body.officers) && assign.body.officers.length === 1, 'officer listed');

  // Officer contributes ceil(3/3)=1 defense. Keep subtype = +5.
  const g = await api('GET', `/api/base/${base.body.id}/garrison`);
  assert(g.body.defense_rating === 6, `keep(5) + L3 officer(1) = 6 defense (got ${g.body.defense_rating})`);
  assert(g.body.officer_count === 1, 'officer_count is 1');

  // Unassign
  const officer = assign.body.officers[0];
  const un = await api('DELETE', `/api/base/${base.body.id}/officers/${officer.id}`);
  assert(un.status === 200, 'unassign returns 200');

  const g2 = await api('GET', `/api/base/${base.body.id}/garrison`);
  assert(g2.body.defense_rating === 5, `defense back to keep-only 5 (got ${g2.body.defense_rating})`);

  await cleanupTestCompanion(companionId, npcId);
  await cleanupTestBase(base.body.id);
}

async function testOfficerRejectsInactiveCompanion() {
  console.log('\n  -- Reject assigning a dismissed companion --');
  const base = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_Reject', category: 'martial', subtype: 'keep'
  });
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);
  await dbRun(`UPDATE companions SET status = 'dismissed' WHERE id = ?`, [companionId]);

  const r = await api('POST', `/api/base/${base.body.id}/officers`, { companionId });
  assert(r.status === 400, `dismissed companion rejected (got ${r.status})`);

  await cleanupTestCompanion(companionId, npcId);
  await cleanupTestBase(base.body.id);
}

async function testOfficerRejectsDuplicateAssignment() {
  console.log('\n  -- Rejects assigning the same companion twice --');
  const base = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_Dupe', category: 'martial', subtype: 'keep'
  });
  const { npcId, companionId } = await createTestNpcAndRecruit('Human', 'Fighter', 1);

  await api('POST', `/api/base/${base.body.id}/officers`, { companionId });
  const r = await api('POST', `/api/base/${base.body.id}/officers`, { companionId });
  assert(r.status === 400, 'duplicate assignment rejected');

  await cleanupTestCompanion(companionId, npcId);
  await cleanupTestBase(base.body.id);
}

async function testDemolishRemovesDefense() {
  console.log('\n  -- Demolishing a gatehouse removes its defense bonus --');
  const base = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: 'TEST_Demolish_Def', category: 'martial', subtype: 'keep'
  });
  await dbRun('UPDATE party_bases SET gold_treasury = 1500 WHERE id = ?', [base.body.id]);

  const g = await api('POST', `/api/base/${base.body.id}/buildings`, { building_type: 'gatehouse' });
  await api('POST', `/api/base/${base.body.id}/buildings/${g.body.id}/advance`, { hours: 120 });

  const before = await api('GET', `/api/base/${base.body.id}/garrison`);
  assert(before.body.defense_rating === 8, `keep(5) + gate(3) = 8 (got ${before.body.defense_rating})`);

  await api('DELETE', `/api/base/${base.body.id}/buildings/${g.body.id}`);

  const after = await api('GET', `/api/base/${base.body.id}/garrison`);
  assert(after.body.defense_rating === 5, `defense drops back to 5 (got ${after.body.defense_rating})`);

  await cleanupTestBase(base.body.id);
}

// ===== GROUP 22: Base Threats / Raids / Sieges (F3) =====

async function createTestBaseForThreat(subtype = 'watchtower', defenseRating = 0) {
  const r = await api('POST', '/api/base', {
    characterId: testCharId, campaignId: testCampaignId,
    name: `TEST_ThreatBase_${subtype}`, category: 'martial', subtype
  });
  await dbRun(
    'UPDATE party_bases SET status = ?, defense_rating = ?, gold_treasury = 500, garrison_strength = 10 WHERE id = ?',
    ['active', defenseRating, r.body.id]
  );
  return r.body.id;
}

async function createRawThreat(baseId, args = {}) {
  const {
    attackerForce = 10, attackerSource = 'TEST Raiders', attackerCategory = 'criminal',
    threatType = 'raid', warningGameDay = 10, deadlineGameDay = 15, status = 'approaching'
  } = args;
  const result = await dbRun(
    `INSERT INTO base_threats
     (base_id, campaign_id, threat_type, attacker_source, attacker_category,
      attacker_force, warning_game_day, deadline_game_day, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [baseId, testCampaignId, threatType, attackerSource, attackerCategory,
     attackerForce, warningGameDay, deadlineGameDay, status]
  );
  return Number(result.lastInsertRowid);
}

async function cleanupThreats(baseId) {
  await dbRun('DELETE FROM base_threats WHERE base_id = ?', [baseId]);
}

async function testListThreatsEmpty() {
  console.log('\n  -- Empty threats list for a peaceful base --');
  const baseId = await createTestBaseForThreat();
  const r = await api('GET', `/api/base/${baseId}/threats`);
  assert(r.status === 200, 'returns 200');
  assert(Array.isArray(r.body.threats) && r.body.threats.length === 0, 'no threats');
  await cleanupTestBase(baseId);
}

async function testCreateAndListThreat() {
  console.log('\n  -- Threat appears in base listing and campaign active list --');
  const baseId = await createTestBaseForThreat();
  const threatId = await createRawThreat(baseId);

  const byBase = await api('GET', `/api/base/${baseId}/threats`);
  assert(byBase.body.threats.length === 1, 'base-scoped list returns 1');

  const byCampaign = await api('GET', `/api/threats/campaign/${testCampaignId}`);
  assert(byCampaign.body.threats.some(t => t.id === threatId), 'campaign-scoped list includes it');

  await cleanupThreats(baseId);
  await cleanupTestBase(baseId);
}

async function testDefendFlowTransitions() {
  console.log('\n  -- POST /defend flips approaching → defending --');
  const baseId = await createTestBaseForThreat();
  const threatId = await createRawThreat(baseId);

  const r = await api('POST', `/api/threats/${threatId}/defend`);
  assert(r.status === 200, `defend returns 200 (got ${r.status})`);
  assert(r.body.threat.status === 'defending', `status = defending (got ${r.body.threat.status})`);
  assert(r.body.threat.player_defended === 1, 'player_defended flag set');

  await cleanupThreats(baseId);
  await cleanupTestBase(baseId);
}

async function testDefendRejectsNonApproaching() {
  console.log('\n  -- Cannot defend a threat that is already resolving --');
  const baseId = await createTestBaseForThreat();
  const threatId = await createRawThreat(baseId, { status: 'resolving' });

  const r = await api('POST', `/api/threats/${threatId}/defend`);
  assert(r.status === 400, 'rejected with 400');

  await cleanupThreats(baseId);
  await cleanupTestBase(baseId);
}

async function testResolvePlayerDefense() {
  console.log('\n  -- Resolve player defense with outcome=repelled --');
  const baseId = await createTestBaseForThreat();
  const threatId = await createRawThreat(baseId);
  await api('POST', `/api/threats/${threatId}/defend`);

  const r = await api('POST', `/api/threats/${threatId}/resolve-defense`, {
    outcome: 'repelled', narrative: 'The raiders broke on our walls.'
  });
  assert(r.status === 200, 'resolve returns 200');
  assert(r.body.threat.status === 'resolved', 'status = resolved');
  assert(r.body.threat.outcome === 'repelled', 'outcome = repelled');

  await cleanupThreats(baseId);
  await cleanupTestBase(baseId);
}

async function testResolveDefenseRejectsBadOutcome() {
  console.log('\n  -- Invalid outcome rejected --');
  const baseId = await createTestBaseForThreat();
  const threatId = await createRawThreat(baseId);
  await api('POST', `/api/threats/${threatId}/defend`);

  const r = await api('POST', `/api/threats/${threatId}/resolve-defense`, {
    outcome: 'glorious_victory'
  });
  assert(r.status === 400, 'rejected with 400');

  await cleanupThreats(baseId);
  await cleanupTestBase(baseId);
}

async function testAutoResolveMath() {
  console.log('\n  -- computeAutoResolveOutcome produces a valid outcome --');
  const { computeAutoResolveOutcome } = await import('../server/services/baseThreatService.js');
  // Stack the deck: huge defense, tiny force → repelled
  const strong = computeAutoResolveOutcome({
    attackerForce: 2, defenseRating: 30, garrisonStrength: 40, threatType: 'raid'
  });
  assert(strong.outcome === 'repelled', `overwhelming defense → repelled (got ${strong.outcome})`);

  // Tiny defense, huge force → captured
  const weak = computeAutoResolveOutcome({
    attackerForce: 25, defenseRating: 0, garrisonStrength: 0, threatType: 'raid'
  });
  assert(weak.outcome === 'captured', `overwhelming attacker → captured (got ${weak.outcome})`);
}

async function testAutoResolveCapturedStartsRecaptureClock() {
  console.log('\n  -- Auto-resolving a 100%-loss threat schedules a 14-day recapture window --');
  const baseId = await createTestBaseForThreat('watchtower', 0);
  // Force a captured outcome by stacking an impossible attacker
  const threatId = await createRawThreat(baseId, {
    attackerForce: 100, status: 'resolving', deadlineGameDay: 20
  });

  const { autoResolveThreat } = await import('../server/services/baseThreatService.js');
  const resolved = await autoResolveThreat(threatId, 20);
  assert(resolved.status === 'resolved', 'threat resolved');
  assert(resolved.outcome === 'captured', `outcome captured (got ${resolved.outcome})`);
  assert(resolved.recapture_deadline_game_day === 34, `recapture deadline = 20 + 14 = 34 (got ${resolved.recapture_deadline_game_day})`);

  await cleanupThreats(baseId);
  await dbRun('DELETE FROM base_buildings WHERE base_id = ?', [baseId]);
  await dbRun('DELETE FROM party_bases WHERE id = ?', [baseId]);
}

async function testExpireCapturedBase() {
  console.log('\n  -- expireStaleCapturedBases flips base to abandoned after window --');
  const baseId = await createTestBaseForThreat();
  // Manually set up a captured threat whose recapture window is long past
  await createRawThreat(baseId, { status: 'resolving', deadlineGameDay: 10 });
  await dbRun(
    `UPDATE base_threats
     SET status = 'resolved', outcome = 'captured', recapture_deadline_game_day = 15
     WHERE base_id = ?`,
    [baseId]
  );

  const { expireStaleCapturedBases } = await import('../server/services/baseThreatService.js');
  const expired = await expireStaleCapturedBases(testCampaignId, 30);
  assert(expired.length >= 1, 'expired at least one base');

  const baseRow = await dbGet('SELECT status FROM party_bases WHERE id = ?', [baseId]);
  assert(baseRow.status === 'abandoned', `base status = abandoned (got ${baseRow.status})`);

  await cleanupThreats(baseId);
  await dbRun('DELETE FROM party_bases WHERE id = ?', [baseId]);
}

// ===== TEST RUNNER =====

async function runTests() {
  try {
    console.log('Starting test server...\n');
    await startServer();

    console.log('\n=== Group 1: Character CRUD & Inventory ===');
    await testCreateCharacter();
    await testGetCharacter();
    await testUpdateCharacter();
    await testDiscardItemDecrement();
    await testDiscardItemRemove();
    await testDiscardItemNotFound();
    await testLongRest();

    console.log('\n=== Group 2: Campaign Management ===');
    await testCreateCampaign();
    await testGetCampaign();
    await testAssignCharacter();
    await testCharacterCampaignLink();
    await testCampaignCharacters();

    console.log('\n=== Group 3: DM Session Infrastructure ===');
    await testCampaignContext();
    await testItemRarityLookup();
    await testItemRarityUnknown();
    await testLlmStatus();
    await testSeasonalStartDay();

    console.log('\n=== Group 4: Merchant System ===');
    await seedTestSession();
    await testGenerateMerchantInventory();
    await testListMerchants();
    await testMerchantIdempotent();
    await testMerchantBuy();
    await testMerchantInsufficientGold();

    console.log('\n=== Group 5: Side Panel Data Round-Trip ===');
    await testSidePanelData();

    console.log('\n=== Group 6: Player Journal ===');
    await testJournalEndpoint();
    await testJournalNotFound();
    await testJournalNoCampaign();

    console.log('\n=== Group 7: Rest Narrative & Conditions ===');
    await testRestNarrativeEndpoint();
    await testRestNarrativeNotFound();
    await testRestNarrativeBadRequest();
    await testMessageWithConditions();

    console.log('\n=== Group 8: Edge Cases ===');
    await testNonexistentCharacter();
    await testHealthCheck();

    console.log('\n=== Group 9: DM Mode (Party CRUD) ===');
    await testDmModeListPartiesEmpty();
    await testDmModeCreatePartyDirect();
    await testDmModeGetParty();
    await testDmModeListPartiesNonEmpty();
    await testDmModeNoActiveSession();
    await testDmModeSessionHistory();
    await testDmModeUpdateHpRequiresSession();
    await testDmModeRetireParty();
    await testDmModeGetPartyNotFound();

    console.log('\n=== Group 10: Progression System ===');
    await testProgressionListThemes();
    await testProgressionGetThemeById();
    await testProgressionGetThemeNotFound();
    await testProgressionAncestryFeatsByRace();
    await testProgressionAncestryFeatsTierFilter();
    await testProgressionAncestryFeatsNotFound();
    await testCreateCharacterWithProgression();
    await testProgressionReturnsUpcomingTiersAndSynergy();
    await testProgressionNoSynergyForNonResonantPair();
    await testLevelUpRequiresSubclassForMulticlass();
    await testLevelUpFeatInsteadOfASI();
    await testLevelUpFeatMissingFeatKey();
    await testLevelUpInfoSurfacesProgressionDecisions();
    await testLevelUpRequiresAncestryFeatId();
    await testLevelUpPersistsAncestryFeatAndThemeTier();
    await testLevelUpWithAncestryFeatChoice();
    await testLevelUpRejectsInvalidAncestryFeatId();
    await testCreateKnightInitializesMoralPath();

    console.log('\n=== Group 11: Companion Progression (Phase 5.5) ===');
    await testCompanionRecruitAutoAssignsThemeAndAncestryFeat();
    await testCompanionRaceNormalizationSkipsUnmapped();
    await testCompanionLevelUpTriggersThemeTierUnlock();
    await testCompanionLevelUpAutoPicksAncestryFeat();
    await testCompanionProgressionEndpoint();
    await testCompanionLevelUpLazyBackfill();

    console.log('\n=== Group 12: Companion Rest + Spell Slots (Phase 6) ===');
    await testCompanionSpellSlotsForCaster();
    await testCompanionSpellSlotsForNonCaster();
    await testCompanionUseAndRestoreSlot();
    await testCompanionUseSlotRejectsWhenEmpty();
    await testCompanionLongRest();
    await testCompanionShortRestHealsButKeepsSlots();
    await testCompanionShortRestWarlockSlots();
    await testCompanionSpellSlotRejectsNpcStatsCompanion();

    console.log('\n=== Group 13: Companion Combat Safety (Phase 7) ===');
    await testCompanionConditionsInitialState();
    await testCompanionConditionAddRemove();
    await testCompanionExhaustionMutuallyExclusive();
    await testCompanionUnknownConditionRejected();
    await testCompanionLongRestClearsConditionsAndDecrementsExhaustion();
    await testCompanionDeathSaveBlockedWhenAbove0Hp();
    await testCompanionDeathSaveSuccess();
    await testCompanionDeathSaveStabilizesAtThreeSuccesses();
    await testCompanionDeathSaveDiesAtThreeFailures();
    await testCompanionDeathSaveCriticalSuccessRevives();
    await testCompanionDeathSaveCriticalFailureCountsTwo();
    await testCompanionStabilizeEndpoint();
    await testCompanionLongRestResetsDeathSaves();

    console.log('\n=== Group 14: Party Inventory + Equip/Unequip (M1) ===');
    await testM1RetiredEndpointsReturn410();
    await testM1EquipItemFromPartyPool();
    await testM1EquipReturnsPreviousItemToPool();
    await testM1UnequipToPool();
    await testM1EquipRejectsMissingItem();
    await testM1EquipRejectsInvalidSlot();
    await testM1UnequipRejectsEmptySlot();
    await testM1RecruitStartsCompanionWithEmptyCarry();

    console.log('\n=== Group 16: Companion Multiclass (Phase 10) ===');
    await testCompanionRecruitSeedsClassLevels();
    await testCompanionLevelUpAdvancesPrimary();
    await testCompanionLevelUpMulticlassAdd();
    await testCompanionLevelUpAdvancesSecondary();
    await testCompanionMulticlassSpellSlots();
    await testCompanionLevelUpInfoExposesClassLevels();

    console.log('\n=== Group 17: Merchant Commissions (M2) ===');
    await testPlaceCommissionHappyPath();
    await testCommissionRejectsInsufficientDeposit();
    await testCommissionRejectsBadInput();
    await testCommissionProcessDueOrders();
    await testCollectOrder();
    await testCollectBlockedWhenNotReady();
    await testCancelOrderForfeitsDeposit();
    await testListOrdersForCharacter();

    console.log('\n=== Group 18: Merchant Bargaining / Haggle (M3) ===');
    await testHaggleHappyPath();
    await testHaggleFailure();
    await testHaggleCriticalFail();
    await testHaggleIntimidationPenalty();
    await testHaggleRepeatAttemptPenalty();
    await testHaggleRejectsInvalidSkill();
    await testHaggleCompanionRoller();
    await testHaggleDiscountAppliesToTransaction();
    await testHaggleDiscountClampedServerSide();

    console.log('\n=== Group 19: Merchant Relationships (M4) ===');
    await testRelationshipsEmptyByDefault();
    await testRelationshipAppearsAfterTransaction();
    await testRelationshipNotesUpsert();
    await testRelationshipFavoritesSortFirst();
    await testRelationshipRequiresCharacterId();

    console.log('\n=== Group 20: Fortress Base Refactor (F1) ===');
    await testCreateBaseWithCategorySubtype();
    await testCreateBaseRejectsMismatch();
    await testMultipleBasesSupported();
    await testSetPrimaryBase();
    await testInstallAndCompleteBuilding();
    await testBuildingCategoryAllowlist();
    await testBuildingSlotCap();
    await testAvailableBuildingsEndpoint();
    await testRemoveBuildingStripsPerk();

    console.log('\n=== Group 21: Base Garrison + Defense (F2) ===');
    await testSubtypeDefenseBonus();
    await testCompletedBuildingRaisesDefense();
    await testAssignAndUnassignOfficer();
    await testOfficerRejectsInactiveCompanion();
    await testOfficerRejectsDuplicateAssignment();
    await testDemolishRemovesDefense();

    console.log('\n=== Group 22: Base Threats / Raids / Sieges (F3) ===');
    await testListThreatsEmpty();
    await testCreateAndListThreat();
    await testDefendFlowTransitions();
    await testDefendRejectsNonApproaching();
    await testResolvePlayerDefense();
    await testResolveDefenseRejectsBadOutcome();
    await testAutoResolveMath();
    await testAutoResolveCapturedStartsRecaptureClock();
    await testExpireCapturedBase();

  } catch (err) {
    console.error('\nFATAL TEST ERROR:', err);
    failed++;
  } finally {
    await cleanup();
    await stopServer();
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));
    if (failed > 0) process.exit(1);
  }
}

runTests();
