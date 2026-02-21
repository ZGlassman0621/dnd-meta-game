/**
 * Campaign Import integration tests
 * Run: node tests/campaign-import.test.js
 *
 * Uses port 3001 to avoid conflicts with dev server.
 * All test data prefixed with TEST_ and cleaned up at the end.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import campaignRoutes from '../server/routes/campaign.js';
import characterRoutes from '../server/routes/character.js';
import npcRoutes from '../server/routes/npc.js';
import companionRoutes from '../server/routes/companion.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const BASE = 'http://localhost:3001';
let server;

let passed = 0;
let failed = 0;
const createdCampaignIds = [];
const createdCharacterIds = [];

function assert(condition, message) {
  if (condition) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.error(`  \u2717 ${message}`);
    failed++;
  }
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

// ===== Server Lifecycle =====

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  await initDatabase();

  app.use('/api/campaign', campaignRoutes);
  app.use('/api/character', characterRoutes);
  app.use('/api/npc', npcRoutes);
  app.use('/api/companion', companionRoutes);

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

// ===== Test Payloads =====

const MINIMAL_PAYLOAD = {
  campaign: {
    name: 'TEST_Import Minimal Campaign'
  },
  character: {
    name: 'TEST_MinimalChar',
    class: 'Fighter',
    race: 'Human'
  }
};

const FULL_PAYLOAD = {
  campaign: {
    name: 'TEST_Import Full Campaign',
    description: 'A test campaign with all sections populated',
    setting: 'Forgotten Realms',
    tone: 'dark fantasy',
    starting_location: 'Baldur\'s Gate',
    time_ratio: 'normal'
  },
  campaign_plan: {
    version: 1,
    main_quest: {
      title: 'The Shadow of Blackhollow',
      summary: 'An ancient evil stirs beneath the ruins.',
      hook: 'A mysterious letter arrives.',
      stakes: 'The region falls to darkness.',
      acts: [
        {
          act_number: 1,
          title: 'The Gathering Storm',
          summary: 'Investigate disappearances.',
          key_locations: ['Baldur\'s Gate'],
          key_npcs: ['Elder Mira'],
          potential_outcomes: ['Discover the cult', 'Get captured']
        }
      ]
    },
    world_state: {
      political_situation: 'Tensions between the Flaming Fist and the Guild.',
      major_threats: ['Cult of Shadows', 'Orcish raiders'],
      faction_tensions: [],
      regional_news: ['Strange lights over the moors']
    },
    world_timeline: {
      description: 'Events unfold regardless of player action.',
      events: [
        {
          id: 'evt_1',
          title: 'Merchant caravan vanishes',
          description: 'A major trade caravan goes missing on the Coast Way.',
          timing: '1 week from campaign start',
          visibility: 'public',
          affected_locations: ['Coast Way'],
          affected_factions: ['Merchants Guild'],
          player_can_influence: true,
          consequences_if_ignored: 'Trade prices spike 50%'
        }
      ]
    },
    npcs: [
      {
        id: 'npc_1',
        name: 'Elder Mira',
        role: 'patron',
        alignment: 'neutral_good',
        from_backstory: true,
        description: 'A weathered sage with silver eyes.',
        motivation: 'Protect the region from the returning shadow.',
        secrets: ['Knows the location of the first seal'],
        location: 'Temple of Selune, Baldur\'s Gate',
        faction_affiliations: ['Harpers'],
        relationship_to_player: 'Former mentor'
      }
    ],
    potential_companions: [],
    locations: [
      {
        id: 'loc_1',
        name: 'Baldur\'s Gate',
        type: 'city',
        region: 'Western Heartlands',
        description: 'The great mercantile city on the Sword Coast.',
        importance_to_plot: 'Starting location and political hub.',
        notable_features: ['Wide', 'The Blushing Mermaid'],
        dangers: ['Thieves Guild activity'],
        opportunities: ['Mercenary work', 'Faction contacts']
      }
    ],
    merchants: [
      {
        id: 'merch_1',
        name: 'Garrick the Ironmonger',
        type: 'blacksmith',
        location: 'Baldur\'s Gate',
        specialty: 'Fine weapons and custom armor',
        personality: 'Gruff but honest',
        prosperity_level: 'comfortable'
      }
    ],
    factions: [
      {
        id: 'fac_1',
        name: 'The Harpers',
        type: 'political',
        alignment_tendency: 'chaotic_good',
        description: 'A secret network dedicated to balance.',
        goals: ['Counter the Zhentarim', 'Protect the innocent'],
        resources: ['Spies', 'Safe houses'],
        relationship_to_party: 'potential',
        key_members: ['Elder Mira']
      }
    ],
    side_quests: [
      {
        id: 'sq_1',
        title: 'The Rat Catcher\'s Dilemma',
        type: 'mystery',
        description: 'Giant rats in the sewers hide a deeper problem.',
        quest_giver: 'City Guard Captain',
        location: 'Baldur\'s Gate sewers',
        rewards: '50 gp and a city commendation',
        connection_to_main_quest: 'The rats were mutated by shadow magic'
      }
    ],
    themes: ['corruption', 'redemption', 'found family'],
    dm_notes: {
      tone_guidance: 'Dark but not hopeless. Small victories matter.',
      potential_twists: ['Elder Mira is hiding her own connection to the shadow'],
      backup_hooks: ['A fire in the docks district forces action'],
      session_zero_topics: ['Character motivation', 'Comfort with dark themes']
    }
  },
  character: {
    name: 'TEST_Thorn Blackwood',
    first_name: 'Thorn',
    last_name: 'Blackwood',
    nickname: 'Thorn',
    gender: 'male',
    class: 'Ranger',
    subclass: 'Gloom Stalker',
    race: 'Half-Elf',
    background: 'Outlander',
    level: 7,
    current_hp: 52,
    max_hp: 58,
    armor_class: 16,
    speed: 30,
    current_location: 'Baldur\'s Gate',
    current_quest: 'Investigate the Blackhollow Ruins',
    gold_gp: 145,
    gold_sp: 30,
    gold_cp: 0,
    experience: 25000,
    experience_to_next_level: 34000,
    ability_scores: { str: 14, dex: 18, con: 14, int: 10, wis: 16, cha: 12 },
    skills: ['Perception', 'Stealth', 'Survival', 'Nature', 'Athletics'],
    inventory: [
      { name: 'Potion of Healing', quantity: 3 },
      { name: 'Rope (50 ft.)', quantity: 1 }
    ],
    equipment: {
      mainHand: { name: 'Longbow', damage: '1d8', damageType: 'piercing', properties: ['ammunition', 'heavy', 'two-handed'] },
      armor: { name: 'Studded Leather', baseAC: 12, armorType: 'light' }
    },
    backstory: 'Thorn grew up in the Chondalwood, raised by a reclusive ranger named Aravelle.',
    personality_traits: 'I keep meticulous notes about everything I observe.',
    ideals: 'The natural world must be protected from corruption.',
    bonds: 'My mentor Aravelle disappeared tracking shadow creatures.',
    flaws: 'I trust animals more than people.',
    campaign_notes: '--- Session 1 ---\nMet Elder Mira at the Temple of Selune.',
    character_memories: 'Prefers tea over ale. Uncomfortable in large crowds.',
    alignment: 'Neutral Good',
    faith: 'Mielikki',
    known_cantrips: [],
    known_spells: ['Hunter\'s Mark', 'Goodberry', 'Pass without Trace'],
    prepared_spells: ['Hunter\'s Mark', 'Goodberry'],
    feats: ['Sharpshooter'],
    languages: ['Common', 'Elvish', 'Sylvan'],
    tool_proficiencies: ['Herbalism Kit'],
    game_day: 45,
    game_year: 1350,
    game_hour: 14
  },
  sessions: [
    {
      title: 'Arrival at Baldur\'s Gate',
      summary: 'Thorn arrived in Baldur\'s Gate seeking information about his missing mentor. He met Elder Mira at the Temple of Selune who shared cryptic warnings about a returning shadow.',
      game_start_day: 1,
      game_start_year: 1350,
      game_end_day: 3,
      game_end_year: 1350
    },
    {
      title: 'The Merchant Quarter Mystery',
      summary: 'Investigated disappearances in the merchant quarter. Discovered a hidden entrance to ancient tunnels beneath the city. Found shadow-touched rats and a mysterious sigil.',
      game_start_day: 4,
      game_start_year: 1350,
      game_end_day: 8,
      game_end_year: 1350
    }
  ],
  companions: [
    {
      npc: {
        name: 'TEST_Kira Stonefist',
        race: 'Dwarf',
        gender: 'female',
        occupation: 'Mercenary',
        personality_trait_1: 'Blunt and impatient',
        personality_trait_2: 'Fiercely loyal once trust is earned',
        motivation: 'Searching for a lost clan artifact',
        current_location: 'Baldur\'s Gate',
        background_notes: 'Former member of the Stonefist clan, exiled for defying the clan elder.',
        relationship_to_party: 'Hired sword turned friend'
      },
      companion_class: 'Fighter',
      companion_level: 6,
      companion_subclass: 'Champion',
      companion_max_hp: 52,
      companion_current_hp: 52,
      companion_ability_scores: { str: 18, dex: 12, con: 16, int: 10, wis: 12, cha: 8 },
      progression_type: 'class_based',
      equipment: {
        mainHand: { name: 'Battleaxe', damage: '1d8', damageType: 'slashing' },
        armor: { name: 'Chain Mail', baseAC: 16, armorType: 'heavy' }
      },
      alignment: 'Lawful Neutral',
      ideals: 'Honor above all',
      bonds: 'The Stonefist clan is everything',
      flaws: 'Stubborn to a fault'
    }
  ]
};

// ===== Test Suite =====

async function runTests() {
  console.log('\n=== Campaign Import Tests ===\n');

  // Test 1: Minimal import
  console.log('1. Minimal import (campaign + character only)');
  {
    const res = await api('POST', '/api/campaign/import', MINIMAL_PAYLOAD);
    assert(res.status === 201, `Status 201 (got ${res.status})`);
    assert(res.body?.success === true, 'Response has success: true');
    assert(typeof res.body?.campaign?.id === 'number', 'Campaign ID is a number');
    assert(typeof res.body?.characterId === 'number', 'Character ID is a number');
    assert(res.body?.sessionsCreated === 0, 'No sessions created');
    assert(res.body?.companionsCreated === 0, 'No companions created');
    assert(res.body?.campaign?.name === 'TEST_Import Minimal Campaign', 'Campaign name matches');

    if (res.body?.campaign?.id) createdCampaignIds.push(res.body.campaign.id);
    if (res.body?.characterId) createdCharacterIds.push(res.body.characterId);

    // Verify character is assigned to campaign
    if (res.body?.characterId) {
      const charRes = await api('GET', `/api/character/${res.body.characterId}`);
      assert(charRes.body?.campaign_id === res.body.campaign.id, 'Character assigned to campaign');
    }
  }

  // Test 2: Full import with all sections
  console.log('\n2. Full import (plan + sessions + companions)');
  let fullCampaignId, fullCharId;
  {
    const res = await api('POST', '/api/campaign/import', FULL_PAYLOAD);
    assert(res.status === 201, `Status 201 (got ${res.status})`);
    assert(res.body?.success === true, 'Response has success: true');
    assert(res.body?.sessionsCreated === 2, `2 sessions created (got ${res.body?.sessionsCreated})`);
    assert(res.body?.companionsCreated === 1, `1 companion created (got ${res.body?.companionsCreated})`);

    fullCampaignId = res.body?.campaign?.id;
    fullCharId = res.body?.characterId;
    if (fullCampaignId) createdCampaignIds.push(fullCampaignId);
    if (fullCharId) createdCharacterIds.push(fullCharId);
  }

  // Test 3: Campaign plan stored and parseable
  console.log('\n3. Campaign plan verification');
  if (fullCampaignId) {
    const planRes = await api('GET', `/api/campaign/${fullCampaignId}/plan`);
    assert(planRes.status === 200, `Plan fetch returned 200 (got ${planRes.status})`);
    assert(planRes.body?.main_quest?.title === 'The Shadow of Blackhollow', 'Main quest title preserved');
    assert(planRes.body?.imported === true, 'Plan marked as imported');
    assert(Array.isArray(planRes.body?.npcs), 'NPCs array present in plan');
    assert(planRes.body?.npcs?.length === 1, `1 NPC in plan (got ${planRes.body?.npcs?.length})`);
    assert(Array.isArray(planRes.body?.themes), 'Themes array present');
    assert(planRes.body?.themes?.length === 3, `3 themes (got ${planRes.body?.themes?.length})`);
  }

  // Test 4: Character data verification
  console.log('\n4. Character data verification');
  if (fullCharId) {
    const charRes = await api('GET', `/api/character/${fullCharId}`);
    assert(charRes.status === 200, `Character fetch returned 200`);
    assert(charRes.body?.name === 'TEST_Thorn Blackwood', 'Character name matches');
    assert(charRes.body?.class === 'Ranger', 'Character class matches');
    assert(charRes.body?.level === 7, `Level is 7 (got ${charRes.body?.level})`);
    assert(charRes.body?.current_hp === 52, `HP is 52 (got ${charRes.body?.current_hp})`);
    assert(charRes.body?.gold_gp === 145, `Gold is 145 (got ${charRes.body?.gold_gp})`);
    assert(charRes.body?.game_day === 45, `Game day is 45 (got ${charRes.body?.game_day})`);
    assert(charRes.body?.game_year === 1350, `Game year is 1350 (got ${charRes.body?.game_year})`);

    // Check JSON fields parsed correctly
    const skills = typeof charRes.body?.skills === 'string'
      ? JSON.parse(charRes.body.skills) : charRes.body?.skills;
    assert(Array.isArray(skills) && skills.includes('Stealth'), 'Skills array contains Stealth');

    const abilityScores = typeof charRes.body?.ability_scores === 'string'
      ? JSON.parse(charRes.body.ability_scores) : charRes.body?.ability_scores;
    assert(abilityScores?.dex === 18, `DEX is 18 (got ${abilityScores?.dex})`);

    // Campaign notes and memories
    assert(charRes.body?.campaign_notes?.includes('Elder Mira'), 'Campaign notes preserved');
    assert(charRes.body?.character_memories?.includes('tea over ale'), 'Character memories preserved');
    assert(charRes.body?.backstory?.includes('Chondalwood'), 'Backstory preserved');
  }

  // Test 5: Session history verification
  console.log('\n5. Session history verification');
  if (fullCharId) {
    const sessions = await dbAll(
      "SELECT * FROM dm_sessions WHERE character_id = ? ORDER BY id",
      [fullCharId]
    );
    assert(sessions.length === 2, `2 sessions in DB (got ${sessions.length})`);
    assert(sessions[0]?.title === 'Arrival at Baldur\'s Gate', 'First session title matches');
    assert(sessions[0]?.status === 'completed', 'Session status is completed');
    assert(sessions[0]?.rewards_claimed === 1, 'Rewards marked as claimed');
    assert(sessions[0]?.game_start_day === 1, 'Session start day correct');
    assert(sessions[1]?.title === 'The Merchant Quarter Mystery', 'Second session title matches');
    assert(sessions[1]?.summary?.includes('shadow-touched rats'), 'Session summary preserved');
  }

  // Test 6: Companion + NPC verification
  console.log('\n6. Companion and NPC verification');
  if (fullCharId) {
    const companions = await dbAll(
      "SELECT c.*, n.name as npc_name, n.race as npc_race, n.campaign_availability FROM companions c JOIN npcs n ON c.npc_id = n.id WHERE c.recruited_by_character_id = ?",
      [fullCharId]
    );
    assert(companions.length === 1, `1 companion in DB (got ${companions.length})`);
    assert(companions[0]?.npc_name === 'TEST_Kira Stonefist', 'Companion NPC name matches');
    assert(companions[0]?.npc_race === 'Dwarf', 'Companion NPC race matches');
    assert(companions[0]?.campaign_availability === 'companion', 'NPC marked as companion');
    assert(companions[0]?.companion_class === 'Fighter', 'Companion class matches');
    assert(companions[0]?.companion_level === 6, `Companion level is 6 (got ${companions[0]?.companion_level})`);
    assert(companions[0]?.progression_type === 'class_based', 'Progression type matches');
    assert(companions[0]?.status === 'active', 'Companion status is active');
    assert(companions[0]?.alignment === 'Lawful Neutral', 'Companion alignment matches');
  }

  // Test 7: Validation - missing campaign name
  console.log('\n7. Validation: missing campaign.name');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: { description: 'No name here' },
      character: { name: 'Test', class: 'Fighter', race: 'Human' }
    });
    assert(res.status === 400, `Status 400 (got ${res.status})`);
    assert(res.body?.details?.some(d => d.includes('campaign.name')), 'Error mentions campaign.name');
  }

  // Test 8: Import without character section (character is optional)
  console.log('\n8. Import without character section (optional)');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: { name: 'TEST_NoChar' }
    });
    assert(res.status === 201, `Status 201 (got ${res.status})`);
    assert(res.body.characterId === null, 'No character created');
    if (res.body?.campaign?.id) createdCampaignIds.push(res.body.campaign.id);
  }

  // Test 9: Validation - missing character.class
  console.log('\n9. Validation: missing character.class');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: { name: 'TEST_NoClass' },
      character: { name: 'Test', race: 'Human' }
    });
    assert(res.status === 400, `Status 400 (got ${res.status})`);
    assert(res.body?.details?.some(d => d.includes('character.class')), 'Error mentions character.class');
  }

  // Test 10: Validation - invalid sessions format
  console.log('\n10. Validation: invalid sessions format');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: { name: 'TEST_BadSessions' },
      character: { name: 'Test', class: 'Fighter', race: 'Human' },
      sessions: 'not an array'
    });
    assert(res.status === 400, `Status 400 (got ${res.status})`);
    assert(res.body?.details?.some(d => d.includes('sessions')), 'Error mentions sessions');
  }

  // Test 11: Import with empty sessions array
  console.log('\n11. Import with empty sessions array');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: { name: 'TEST_EmptySessions' },
      character: { name: 'TEST_EmptySessionChar', class: 'Wizard', race: 'Elf' },
      sessions: []
    });
    assert(res.status === 201, `Status 201 (got ${res.status})`);
    assert(res.body?.sessionsCreated === 0, 'Zero sessions created');

    if (res.body?.campaign?.id) createdCampaignIds.push(res.body.campaign.id);
    if (res.body?.characterId) createdCharacterIds.push(res.body.characterId);
  }

  // Test 12: Import without campaign plan
  console.log('\n12. Import without campaign plan');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: { name: 'TEST_NoPlan', setting: 'Custom World' },
      character: { name: 'TEST_NoPlanChar', class: 'Rogue', race: 'Halfling' }
    });
    assert(res.status === 201, `Status 201 (got ${res.status})`);
    assert(res.body?.campaign?.setting === 'Custom World', 'Custom setting preserved');

    // Verify no plan stored
    const planRes = await api('GET', `/api/campaign/${res.body.campaign.id}/plan`);
    assert(planRes.body === null, 'No campaign plan stored');

    if (res.body?.campaign?.id) createdCampaignIds.push(res.body.campaign.id);
    if (res.body?.characterId) createdCharacterIds.push(res.body.characterId);
  }

  // Test 13: Imported campaign appears in campaign list
  console.log('\n13. Imported campaign in campaign list');
  {
    const res = await api('GET', '/api/campaign');
    assert(res.status === 200, 'Campaign list returned 200');
    const imported = res.body?.find(c => c.name === 'TEST_Import Full Campaign');
    assert(!!imported, 'Full import campaign found in list');
    assert(imported?.status === 'active', 'Campaign status is active');
    assert(imported?.tone === 'dark fantasy', 'Campaign tone preserved');
  }

  // Test 14: Validation - companion missing npc.name
  console.log('\n14. Validation: companion missing npc.name');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: { name: 'TEST_BadComp' },
      character: { name: 'Test', class: 'Fighter', race: 'Human' },
      companions: [{ npc: { race: 'Elf' } }]
    });
    assert(res.status === 400, `Status 400 (got ${res.status})`);
    assert(res.body?.details?.some(d => d.includes('companions[0].npc.name')), 'Error mentions companion npc name');
  }

  // Test 15: Character defaults for missing optional fields
  console.log('\n15. Character defaults for missing optional fields');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: { name: 'TEST_Defaults' },
      character: { name: 'TEST_DefaultChar', class: 'Barbarian', race: 'Goliath' }
    });
    assert(res.status === 201, `Status 201 (got ${res.status})`);

    const charRes = await api('GET', `/api/character/${res.body.characterId}`);
    assert(charRes.body?.level === 1, `Default level is 1 (got ${charRes.body?.level})`);
    assert(charRes.body?.max_hp === 10, `Default max HP is 10 (got ${charRes.body?.max_hp})`);
    assert(charRes.body?.game_day === 1, `Default game day is 1 (got ${charRes.body?.game_day})`);
    assert(charRes.body?.game_year === 1350, `Default game year is 1350 (got ${charRes.body?.game_year})`);
    assert(charRes.body?.experience_to_next_level === 300, `Default XP to next is 300 (got ${charRes.body?.experience_to_next_level})`);

    if (res.body?.campaign?.id) createdCampaignIds.push(res.body.campaign.id);
    if (res.body?.characterId) createdCharacterIds.push(res.body.characterId);
  }

  // Test 16: Plan normalizer - ensures required arrays exist
  console.log('\n16. Plan normalizer: missing arrays created');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: { name: 'TEST_NormalizerPlan' },
      character: { name: 'TEST_NormChar', class: 'Cleric', race: 'Dwarf' },
      campaign_plan: {
        main_quest: { title: 'The Lost Temple', summary: 'Find the temple' }
        // No npcs, locations, merchants, world_timeline, etc.
      }
    });
    assert(res.status === 201, `Status 201 (got ${res.status})`);

    const planRes = await api('GET', `/api/campaign/${res.body.campaign.id}/plan`);
    assert(planRes.status === 200, 'Plan fetch returned 200');
    assert(Array.isArray(planRes.body?.npcs), 'NPCs array created by normalizer');
    assert(planRes.body?.npcs?.length === 0, 'NPCs array is empty');
    assert(Array.isArray(planRes.body?.locations), 'Locations array created');
    assert(Array.isArray(planRes.body?.merchants), 'Merchants array created');
    assert(Array.isArray(planRes.body?.factions), 'Factions array created');
    assert(Array.isArray(planRes.body?.side_quests), 'Side quests array created');
    assert(Array.isArray(planRes.body?.themes), 'Themes array created');
    assert(planRes.body?.world_timeline?.events !== undefined, 'World timeline events created');
    assert(planRes.body?.world_state !== undefined, 'World state created');
    assert(planRes.body?.dm_notes !== undefined, 'DM notes created');
    assert(Array.isArray(planRes.body?.main_quest?.acts), 'Main quest acts array created');

    if (res.body?.campaign?.id) createdCampaignIds.push(res.body.campaign.id);
    if (res.body?.characterId) createdCharacterIds.push(res.body.characterId);
  }

  // Test 17: Plan normalizer - alternative field name mapping
  console.log('\n17. Plan normalizer: alternative field names mapped');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: { name: 'TEST_AltFields' },
      character: { name: 'TEST_AltChar', class: 'Wizard', race: 'Elf' },
      campaign_plan: {
        main_story: { title: 'Alt Quest', summary: 'Using main_story instead of main_quest' },
        characters: [{ name: 'Alt NPC', role: 'ally' }],
        timeline: { description: 'Alt timeline', events: [{ title: 'Event 1', timing: 'Now' }] }
      }
    });
    assert(res.status === 201, `Status 201 (got ${res.status})`);

    const planRes = await api('GET', `/api/campaign/${res.body.campaign.id}/plan`);
    assert(planRes.body?.main_quest?.title === 'Alt Quest', 'main_story mapped to main_quest');
    assert(planRes.body?.npcs?.[0]?.name === 'Alt NPC', 'characters mapped to npcs');
    assert(planRes.body?.world_timeline?.events?.[0]?.title === 'Event 1', 'timeline mapped to world_timeline');

    if (res.body?.campaign?.id) createdCampaignIds.push(res.body.campaign.id);
    if (res.body?.characterId) createdCharacterIds.push(res.body.characterId);
  }

  // Test 18: Custom plan sections preserved (dm_directives, campaign_metadata, etc.)
  console.log('\n18. Custom plan sections preserved');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: { name: 'TEST_CustomSections' },
      character: { name: 'TEST_CustomChar', class: 'Paladin', race: 'Human' },
      campaign_plan: {
        main_quest: { title: 'Custom Campaign', summary: 'With custom sections' },
        campaign_metadata: {
          year: '1327 DR',
          season: 'Deep Winter',
          tone: 'Serious, character-driven'
        },
        dm_directives: {
          never_reveal: ['The villain\'s true goal'],
          always_follow: ['Never decide for player character'],
          narrative_principles: ['World moves independently']
        },
        npc_relationship_system: {
          levels: [
            { level: 1, label: 'Acquaintance', description: 'Surface only' },
            { level: 2, label: 'Familiar', description: 'Some trust' }
          ]
        },
        session_continuity: {
          current_state: 'Post-time-skip, expedition imminent',
          recent_events: ['Defeated the cultists', 'Formed alliance with Baron'],
          unresolved_threads: ['Missing patrol', 'Hidden infiltrator']
        },
        npcs: [{
          name: 'Garrick',
          role: 'ally',
          from_backstory: true,
          motivation: 'Build things that last',
          location: 'Forge',
          voice_guide: {
            speech: 'Measured, patient, craft metaphors',
            surface: 'Warm, steady'
          },
          secrets: ['Chose south barricade over west wall']
        }]
      }
    });
    assert(res.status === 201, `Status 201 (got ${res.status})`);

    const planRes = await api('GET', `/api/campaign/${res.body.campaign.id}/plan`);
    const plan = planRes.body;

    // Campaign metadata preserved
    assert(plan?.campaign_metadata?.year === '1327 DR', 'Campaign metadata year preserved');
    assert(plan?.campaign_metadata?.season === 'Deep Winter', 'Campaign metadata season preserved');

    // DM directives preserved
    assert(plan?.dm_directives?.never_reveal?.length === 1, 'DM directives never_reveal preserved');
    assert(plan?.dm_directives?.always_follow?.length === 1, 'DM directives always_follow preserved');
    assert(plan?.dm_directives?.narrative_principles?.length === 1, 'DM directives narrative_principles preserved');

    // Relationship system preserved
    assert(plan?.npc_relationship_system?.levels?.length === 2, 'Relationship system levels preserved');

    // Session continuity preserved
    assert(plan?.session_continuity?.current_state?.includes('expedition'), 'Session continuity current_state preserved');
    assert(plan?.session_continuity?.recent_events?.length === 2, 'Session continuity recent_events preserved');
    assert(plan?.session_continuity?.unresolved_threads?.length === 2, 'Session continuity unresolved_threads preserved');

    // NPC voice guide preserved
    assert(plan?.npcs?.[0]?.voice_guide?.speech?.includes('craft metaphors'), 'NPC voice guide preserved');
    assert(plan?.npcs?.[0]?.secrets?.length === 1, 'NPC secrets preserved');

    if (res.body?.campaign?.id) createdCampaignIds.push(res.body.campaign.id);
    if (res.body?.characterId) createdCharacterIds.push(res.body.characterId);
  }

  // Test 19: getPlanSummaryForSession includes extended fields
  console.log('\n19. Plan summary includes extended fields');
  {
    // Import the function directly
    const { getPlanSummaryForSession } = await import('../server/services/campaignPlanService.js');

    // Use the campaign from test 18 (has custom sections)
    const lastCampaignId = createdCampaignIds[createdCampaignIds.length - 1];
    const summary = await getPlanSummaryForSession(lastCampaignId);

    assert(summary !== null, 'Plan summary returned');
    assert(summary?.campaign_metadata?.year === '1327 DR', 'Summary includes campaign_metadata');
    assert(summary?.dm_directives?.never_reveal?.length === 1, 'Summary includes dm_directives');
    assert(summary?.npc_relationship_system?.levels?.length === 2, 'Summary includes npc_relationship_system');
    assert(summary?.session_continuity?.current_state?.includes('expedition'), 'Summary includes session_continuity');
    assert(summary?.detailed_npcs?.[0]?.voice_guide?.speech?.includes('craft metaphors'), 'Summary includes NPC voice guides');
    assert(summary?.detailed_npcs?.[0]?.secrets?.length === 1, 'Summary includes NPC secrets');
    assert(summary?.dm_notes?.twists === undefined || summary?.dm_notes?.twists === null || Array.isArray(summary?.dm_notes?.twists), 'dm_notes.twists not broken');
  }

  // Test 20: Plan normalizer - plain events array wrapped in world_timeline
  console.log('\n20. Plan normalizer: plain events array wrapped');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: { name: 'TEST_PlainEvents' },
      character: { name: 'TEST_EventChar', class: 'Sorcerer', race: 'Tiefling' },
      campaign_plan: {
        main_quest: { title: 'Event Test', summary: 'Testing events normalization' },
        world_timeline: [
          { title: 'Siege begins', timing: '2 weeks' },
          { title: 'Reinforcements arrive', timing: '1 month' }
        ]
      }
    });
    assert(res.status === 201, `Status 201 (got ${res.status})`);

    const planRes = await api('GET', `/api/campaign/${res.body.campaign.id}/plan`);
    assert(typeof planRes.body?.world_timeline === 'object' && !Array.isArray(planRes.body?.world_timeline), 'Events array wrapped in object');
    assert(planRes.body?.world_timeline?.events?.length === 2, `2 events preserved (got ${planRes.body?.world_timeline?.events?.length})`);
    assert(planRes.body?.world_timeline?.events?.[0]?.title === 'Siege begins', 'Event data preserved');

    if (res.body?.campaign?.id) createdCampaignIds.push(res.body.campaign.id);
    if (res.body?.characterId) createdCharacterIds.push(res.body.characterId);
  }

  // Test 21: Campaign-only import (no character section)
  console.log('\n21. Campaign-only import (no character)');
  {
    const res = await api('POST', '/api/campaign/import', {
      campaign: {
        name: 'TEST_CampaignOnly',
        description: 'Imported campaign without a character',
        setting: 'Forgotten Realms',
        starting_location: 'Waterdeep'
      },
      campaign_plan: {
        main_quest: { title: 'The Lost Artifact', summary: 'A mysterious relic surfaces in Waterdeep' },
        npcs: [{ name: 'Durnan', role: 'Tavern Owner', location: 'Yawning Portal' }],
        locations: [{ name: 'Waterdeep', description: 'City of Splendors' }],
        side_quests: [{ title: 'Rat Problem', description: 'Clear the cellar' }]
      }
    });
    assert(res.status === 201, `Status 201 (got ${res.status})`);
    assert(res.body.success === true, 'Import succeeded');
    assert(res.body.campaign?.id > 0, 'Campaign created');
    assert(res.body.characterId === null, 'No character created');
    assert(res.body.sessionsCreated === 0, 'No sessions created');
    assert(res.body.companionsCreated === 0, 'No companions created');

    // Verify plan was stored
    const planRes = await api('GET', `/api/campaign/${res.body.campaign.id}/plan`);
    assert(planRes.status === 200, `Plan retrievable (got ${planRes.status})`);
    assert(planRes.body?.main_quest?.title === 'The Lost Artifact', 'Plan main_quest preserved');
    assert(planRes.body?.imported === true, 'Plan marked as imported');

    // Verify campaign appears in list
    const listRes = await api('GET', '/api/campaign');
    const found = listRes.body?.find(c => c.name === 'TEST_CampaignOnly');
    assert(found, 'Campaign appears in campaign list');

    // Verify no characters tied to this campaign
    const charsRes = await api('GET', `/api/campaign/${res.body.campaign.id}/characters`);
    assert(charsRes.body?.length === 0, 'No characters assigned to campaign');

    if (res.body?.campaign?.id) createdCampaignIds.push(res.body.campaign.id);
  }
}

// ===== Cleanup =====

async function cleanup() {
  console.log('\n--- Cleanup ---');

  // Delete test quests (FK to both campaign_id and character_id — must go first)
  for (const campId of createdCampaignIds) {
    await dbRun('DELETE FROM quests WHERE campaign_id = ?', [campId]);
  }

  // Delete test sessions
  for (const charId of createdCharacterIds) {
    await dbRun('DELETE FROM dm_sessions WHERE character_id = ?', [charId]);
  }

  // Delete test companions and their NPCs
  for (const charId of createdCharacterIds) {
    const companions = await dbAll('SELECT npc_id FROM companions WHERE recruited_by_character_id = ?', [charId]);
    await dbRun('DELETE FROM companions WHERE recruited_by_character_id = ?', [charId]);
    for (const comp of companions) {
      await dbRun('DELETE FROM npcs WHERE id = ?', [comp.npc_id]);
    }
  }

  // Delete test characters
  for (const charId of createdCharacterIds) {
    await dbRun('DELETE FROM characters WHERE id = ?', [charId]);
  }

  // Delete test relational records, merchant inventories, and campaigns
  for (const campId of createdCampaignIds) {
    await dbRun('DELETE FROM factions WHERE campaign_id = ?', [campId]);
    await dbRun('DELETE FROM locations WHERE campaign_id = ?', [campId]);
    await dbRun('DELETE FROM merchant_inventories WHERE campaign_id = ?', [campId]);
    await dbRun('DELETE FROM campaigns WHERE id = ?', [campId]);
  }

  // Cleanup any remaining TEST_ NPCs
  await dbRun("DELETE FROM npcs WHERE name LIKE 'TEST_%'");

  console.log(`  Cleaned up ${createdCampaignIds.length} campaigns, ${createdCharacterIds.length} characters`);
}

// ===== Main =====

async function main() {
  try {
    await startServer();
    await runTests();
  } catch (error) {
    console.error('Test suite error:', error);
    failed++;
  } finally {
    await cleanup();
    await stopServer();
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
