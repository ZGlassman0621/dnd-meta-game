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

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const BASE = 'http://localhost:3001';
let server;
let testCharId;
let testCampaignId;
let testSessionId;
let testMerchantId;

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
