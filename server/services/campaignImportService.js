/**
 * Campaign Import Service
 *
 * Validates and imports a complete campaign from a JSON payload.
 * Creates campaign, character, session history, companion, faction,
 * location, NPC, and quest relational records.
 */

import db, { dbRun, dbGet } from '../database.js';
import { createMerchantsFromPlan } from './merchantService.js';

/**
 * Ensure a value is a JSON string for DB storage.
 * Passes through strings as-is, stringifies objects/arrays.
 */
function toJSON(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

/**
 * Normalize a campaign plan to ensure all required structures exist.
 * Maps common alternative field names to expected ones and ensures
 * arrays/objects needed by plan editing endpoints are present.
 * @param {object} plan - Raw campaign plan from import
 * @returns {object} Normalized plan with all required structures
 */
export function normalizePlan(plan) {
  const normalized = { ...plan };

  // Map common alternative field names to expected ones
  const fieldMappings = {
    main_story: 'main_quest',
    primary_quest: 'main_quest',
    story_arc: 'main_quest',
    characters: 'npcs',
    key_npcs: 'npcs',
    npc_list: 'npcs',
    companions: 'potential_companions',
    companion_list: 'potential_companions',
    timeline: 'world_timeline',
    events: 'world_timeline',
    world_events: 'world_timeline',
    quests: 'side_quests',
    shops: 'merchants',
    stores: 'merchants',
    merchant_list: 'merchants',
    location_list: 'locations',
    faction_list: 'factions',
    notes: 'dm_notes'
  };

  for (const [alt, expected] of Object.entries(fieldMappings)) {
    if (normalized[alt] && !normalized[expected]) {
      normalized[expected] = normalized[alt];
      delete normalized[alt];
    }
  }

  // If world_timeline was mapped from a plain events array, wrap it
  if (Array.isArray(normalized.world_timeline)) {
    normalized.world_timeline = {
      description: 'Events that will happen regardless of player intervention',
      events: normalized.world_timeline
    };
  }

  // Ensure required arrays exist (prevents crashes in addWorldEvent, addNPC, etc.)
  if (!normalized.npcs) normalized.npcs = [];
  if (!normalized.potential_companions) normalized.potential_companions = [];
  if (!normalized.locations) normalized.locations = [];
  if (!normalized.merchants) normalized.merchants = [];
  if (!normalized.factions) normalized.factions = [];
  if (!normalized.side_quests) normalized.side_quests = [];
  if (!normalized.themes) normalized.themes = [];

  // Ensure world_timeline has events array
  if (!normalized.world_timeline) {
    normalized.world_timeline = { description: '', events: [] };
  } else if (!normalized.world_timeline.events) {
    normalized.world_timeline.events = [];
  }

  // Ensure world_state exists
  if (!normalized.world_state) {
    normalized.world_state = {
      political_situation: '',
      major_threats: [],
      faction_tensions: [],
      regional_news: []
    };
  }

  // Ensure dm_notes exists
  if (!normalized.dm_notes) {
    normalized.dm_notes = {};
  }

  // Ensure main_quest has acts array
  if (normalized.main_quest && !normalized.main_quest.acts) {
    normalized.main_quest.acts = [];
  }

  return normalized;
}

/**
 * Validate the import payload structure.
 * @param {object} payload - The full import JSON
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateImportPayload(payload) {
  const errors = [];

  // Campaign validation
  if (!payload.campaign) {
    errors.push('Missing "campaign" section');
  } else {
    if (!payload.campaign.name) errors.push('campaign.name is required');
  }

  // Character validation (optional — can import campaign + plan without a character)
  if (payload.character) {
    if (!payload.character.name) errors.push('character.name is required');
    if (!payload.character.class) errors.push('character.class is required');
    if (!payload.character.race) errors.push('character.race is required');
  }

  // Campaign plan (optional but validate structure if present)
  if (payload.campaign_plan) {
    if (!payload.campaign_plan.main_quest) {
      errors.push('campaign_plan.main_quest is required when plan is provided');
    }
  }

  // Sessions (optional)
  if (payload.sessions !== undefined) {
    if (!Array.isArray(payload.sessions)) {
      errors.push('"sessions" must be an array');
    } else {
      payload.sessions.forEach((s, i) => {
        if (!s.title && !s.summary) {
          errors.push(`sessions[${i}] needs at least a title or summary`);
        }
      });
    }
  }

  // Companions (optional)
  if (payload.companions !== undefined) {
    if (!Array.isArray(payload.companions)) {
      errors.push('"companions" must be an array');
    } else {
      payload.companions.forEach((c, i) => {
        if (!c.npc) {
          errors.push(`companions[${i}].npc is required`);
        } else {
          if (!c.npc.name) errors.push(`companions[${i}].npc.name is required`);
          if (!c.npc.race) errors.push(`companions[${i}].npc.race is required`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Execute the full campaign import pipeline.
 * @param {object} payload - Validated import payload
 * @returns {{ campaignId: number, characterId: number|null, sessionsCreated: number, companionsCreated: number }}
 */
export async function importCampaign(payload) {
  const { campaign, campaign_plan, character, sessions, companions } = payload;

  // Wrap entire import in a transaction — all-or-nothing, no orphaned records on failure
  const tx = await db.transaction('write');
  try {
    // Step 1: Create campaign
    const campaignResult = await tx.execute({
      sql: `INSERT INTO campaigns (name, description, setting, tone, starting_location, time_ratio)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        campaign.name,
        campaign.description || null,
        campaign.setting || 'Forgotten Realms',
        campaign.tone || 'heroic fantasy',
        campaign.starting_location || null,
        campaign.time_ratio || 'normal'
      ]
    });
    const campaignId = Number(campaignResult.lastInsertRowid);

    // Step 2: Store campaign plan if provided (normalize to ensure required structures)
    let normalizedPlan = null;
    if (campaign_plan) {
      normalizedPlan = normalizePlan({
        ...campaign_plan,
        version: campaign_plan.version || 1,
        generated_at: campaign_plan.generated_at || new Date().toISOString(),
        last_modified: new Date().toISOString(),
        imported: true
      });
      await tx.execute({
        sql: 'UPDATE campaigns SET campaign_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [JSON.stringify(normalizedPlan), campaignId]
      });
    }

    // Step 3: Create character (optional — can import campaign + plan without character)
    if (!character) {
      await tx.commit();

      // Post-transaction: create merchants & relational records (non-critical, won't orphan data)
      if (normalizedPlan) {
        await createPostImportRecords(campaignId, normalizedPlan, null);
      }

      return {
        campaignId,
        characterId: null,
        sessionsCreated: 0,
        companionsCreated: 0,
        questsCreated: 0
      };
    }

    const c = character;
    const charResult = await tx.execute({
      sql: `INSERT INTO characters (
        name, first_name, last_name, nickname, gender,
        class, subclass, race, subrace, background,
        level, current_hp, max_hp, current_location, current_quest,
        gold_cp, gold_sp, gold_gp, starting_gold_cp, starting_gold_sp, starting_gold_gp,
        experience, experience_to_next_level,
        armor_class, speed, ability_scores, skills, advantages, inventory,
        faction_standings, injuries, debuffs, equipment,
        alignment, faith, lifestyle,
        hair_color, skin_color, eye_color, height, weight, age,
        personality_traits, ideals, bonds, flaws,
        organizations, allies, enemies, backstory, other_notes,
        known_cantrips, known_spells, prepared_spells, feats,
        languages, tool_proficiencies,
        campaign_notes, character_memories,
        campaign_id, game_day, game_year, game_hour
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )`,
      args: [
        c.name,
        c.first_name || null,
        c.last_name || null,
        c.nickname || null,
        c.gender || null,
        c.class,
        c.subclass || null,
        c.race,
        c.subrace || null,
        c.background || null,
        c.level || 1,
        c.current_hp || c.max_hp || 10,
        c.max_hp || 10,
        c.current_location || campaign.starting_location || 'Unknown',
        c.current_quest || null,
        c.gold_cp || 0,
        c.gold_sp || 0,
        c.gold_gp || 0,
        c.gold_cp || 0,
        c.gold_sp || 0,
        c.gold_gp || 0,
        c.experience || 0,
        c.experience_to_next_level || 300,
        c.armor_class || 10,
        c.speed || 30,
        toJSON(c.ability_scores) || '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
        toJSON(c.skills) || '[]',
        toJSON(c.advantages) || '[]',
        toJSON(c.inventory) || '[]',
        toJSON(c.faction_standings) || '{}',
        toJSON(c.injuries) || '[]',
        toJSON(c.debuffs) || '[]',
        toJSON(c.equipment) || '{}',
        c.alignment || null,
        c.faith || null,
        c.lifestyle || null,
        c.hair_color || null,
        c.skin_color || null,
        c.eye_color || null,
        c.height || null,
        c.weight || null,
        c.age || null,
        c.personality_traits || null,
        c.ideals || null,
        c.bonds || null,
        c.flaws || null,
        c.organizations || null,
        c.allies || null,
        c.enemies || null,
        c.backstory || null,
        c.other_notes || null,
        toJSON(c.known_cantrips) || '[]',
        toJSON(c.known_spells) || '[]',
        toJSON(c.prepared_spells) || '[]',
        toJSON(c.feats) || '[]',
        toJSON(c.languages) || '[]',
        toJSON(c.tool_proficiencies) || '[]',
        c.campaign_notes || '',
        c.character_memories || '',
        campaignId,
        c.game_day || 1,
        c.game_year || 1350,
        c.game_hour || 8
      ]
    });
    const characterId = Number(charResult.lastInsertRowid);

    // Step 4: Create session history
    let sessionsCreated = 0;
    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        await tx.execute({
          sql: `INSERT INTO dm_sessions (
            character_id, title, summary, status, rewards_claimed,
            messages, game_start_day, game_start_year, game_end_day, game_end_year
          ) VALUES (?, ?, ?, 'completed', 1, '[]', ?, ?, ?, ?)`,
          args: [
            characterId,
            session.title || `Session ${sessionsCreated + 1}`,
            session.summary || null,
            session.game_start_day || null,
            session.game_start_year || null,
            session.game_end_day || null,
            session.game_end_year || null
          ]
        });
        sessionsCreated++;
      }
    }

    // Step 5: Create companions
    let companionsCreated = 0;
    if (companions && companions.length > 0) {
      for (const comp of companions) {
        const npc = comp.npc;

        const npcResult = await tx.execute({
          sql: `INSERT INTO npcs (
            name, nickname, race, gender, age, occupation,
            personality_trait_1, personality_trait_2, motivation, secret,
            current_location, background_notes, relationship_to_party,
            campaign_availability
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'companion')`,
          args: [
            npc.name,
            npc.nickname || null,
            npc.race,
            npc.gender || null,
            npc.age || null,
            npc.occupation || null,
            npc.personality_trait_1 || null,
            npc.personality_trait_2 || null,
            npc.motivation || null,
            npc.secret || null,
            npc.current_location || campaign.starting_location || null,
            npc.background_notes || null,
            npc.relationship_to_party || null
          ]
        });
        const npcId = Number(npcResult.lastInsertRowid);

        await tx.execute({
          sql: `INSERT INTO companions (
            npc_id, recruited_by_character_id,
            progression_type, companion_class, companion_subclass,
            companion_level, companion_max_hp, companion_current_hp,
            companion_ability_scores, equipment,
            alignment, ideals, bonds, flaws,
            status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          args: [
            npcId,
            characterId,
            comp.progression_type || 'npc_stats',
            comp.companion_class || null,
            comp.companion_subclass || null,
            comp.companion_level || 1,
            comp.companion_max_hp || null,
            comp.companion_current_hp || null,
            toJSON(comp.companion_ability_scores) || null,
            toJSON(comp.equipment) || '{}',
            comp.alignment || null,
            comp.ideals || null,
            comp.bonds || null,
            comp.flaws || null
          ]
        });
        companionsCreated++;
      }
    }

    // Step 6: Create quest records from plan (requires character_id)
    let questsCreated = 0;
    if (campaign_plan) {
      const plan = typeof campaign_plan === 'string' ? JSON.parse(campaign_plan) : campaign_plan;

      if (plan.side_quests && plan.side_quests.length > 0) {
        for (const sq of plan.side_quests) {
          await tx.execute({
            sql: `INSERT INTO quests (campaign_id, character_id, quest_type, title, premise, description, status, priority)
                  VALUES (?, ?, 'side', ?, ?, ?, 'active', 'normal')`,
            args: [
              campaignId, characterId,
              sq.title || 'Untitled Quest',
              sq.description || sq.title || '',
              sq.connection_to_main_quest || sq.description || null
            ]
          });
          questsCreated++;
        }
      }

      if (plan.main_quest?.title) {
        await tx.execute({
          sql: `INSERT INTO quests (campaign_id, character_id, quest_type, title, premise, description, status, priority, stages)
                VALUES (?, ?, 'main', ?, ?, ?, 'active', 'critical', ?)`,
          args: [
            campaignId, characterId,
            plan.main_quest.title,
            plan.main_quest.summary || plan.main_quest.hook || '',
            plan.main_quest.stakes || null,
            toJSON(plan.main_quest.acts) || '[]'
          ]
        });
        questsCreated++;
      }
    }

    await tx.commit();

    // Post-transaction: create merchants & relational records (non-critical enrichment)
    if (normalizedPlan) {
      await createPostImportRecords(campaignId, normalizedPlan, characterId);
    }

    return {
      campaignId,
      characterId,
      sessionsCreated,
      companionsCreated,
      questsCreated
    };
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

/**
 * Create non-critical enrichment records after the main transaction commits.
 * Merchants and relational records (factions, locations, NPCs) are additive —
 * they enhance the campaign but aren't required for it to function.
 */
async function createPostImportRecords(campaignId, plan, characterId) {
  try {
    await createMerchantsFromPlan(campaignId, plan);
  } catch (e) {
    console.error('Error creating merchants from imported plan:', e.message);
  }
  try {
    await createRelationalRecordsFromPlan(campaignId, plan);
  } catch (e) {
    console.error('Error creating relational records from imported plan:', e.message);
  }
}

/**
 * Create relational faction, location, and NPC records from campaign plan data.
 * These populate the living world systems (faction ticks, location discovery, NPC relationships).
 * @param {number} campaignId - The campaign ID
 * @param {object} plan - The normalized campaign plan
 */
async function createRelationalRecordsFromPlan(campaignId, plan) {
  let factionsCreated = 0;
  let locationsCreated = 0;
  let npcsCreated = 0;

  // Create faction records
  if (plan.factions && plan.factions.length > 0) {
    for (const f of plan.factions) {
      try {
        await dbRun(`
          INSERT INTO factions (
            campaign_id, name, description, alignment, scope, primary_values,
            motto, power_level, influence_areas, leadership_structure,
            notable_members, typical_methods, public_reputation, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `, [
          campaignId,
          f.name,
          f.description || null,
          f.alignment_tendency || f.alignment || 'neutral',
          f.type || f.scope || 'local',
          toJSON(f.goals || f.primary_values) || '[]',
          f.motto || null,
          f.power_level || 5,
          toJSON(f.influence_areas || f.areas_of_influence) || '[]',
          f.leadership_structure || f.structure || 'autocratic',
          toJSON(f.notable_members || f.key_members) || '[]',
          toJSON(f.methods || f.typical_methods) || '[]',
          f.public_reputation || 0
        ]);
        factionsCreated++;
      } catch (e) {
        if (!e.message?.includes('UNIQUE')) {
          console.warn(`Failed to create faction "${f.name}":`, e.message);
        }
      }
    }
  }

  // Create location records
  if (plan.locations && plan.locations.length > 0) {
    for (const loc of plan.locations) {
      try {
        await dbRun(`
          INSERT INTO locations (
            campaign_id, name, description, location_type, region, tags,
            population_size, danger_level, prosperity_level, services,
            climate, current_state, state_description, discovery_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown')
        `, [
          campaignId,
          loc.name,
          loc.description || null,
          loc.type || loc.location_type || 'settlement',
          loc.region || null,
          toJSON(loc.notable_features || loc.tags || loc.dangers) || '[]',
          loc.population_size || loc.population || null,
          loc.danger_level || 1,
          loc.prosperity_level || loc.prosperity || 5,
          toJSON(loc.services || loc.available_services) || '[]',
          loc.climate || 'temperate',
          loc.current_state || 'peaceful',
          loc.state_description || null
        ]);
        locationsCreated++;
      } catch (e) {
        if (!e.message?.includes('UNIQUE')) {
          console.warn(`Failed to create location "${loc.name}":`, e.message);
        }
      }
    }
  }

  // Create NPC records (for relationship tracking — not companions, those are handled separately)
  if (plan.npcs && plan.npcs.length > 0) {
    for (const npc of plan.npcs) {
      try {
        // Check if NPC already exists (may have been created as a companion)
        const existing = await dbGet(
          'SELECT id FROM npcs WHERE name = ? AND campaign_availability != ?',
          [npc.name, 'hidden']
        );
        if (existing) continue;

        await dbRun(`
          INSERT INTO npcs (
            name, race, gender, age, occupation, occupation_category,
            personality_trait_1, personality_trait_2, motivation, fear, secret, quirk,
            current_location, typical_locations, background_notes,
            relationship_to_party, campaign_availability
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
        `, [
          npc.name,
          npc.race || 'Unknown',
          npc.gender || null,
          npc.age || null,
          npc.role || npc.occupation || null,
          npc.occupation_category || null,
          npc.description || npc.personality_trait_1 || null,
          npc.personality_trait_2 || null,
          npc.motivation || null,
          npc.fear || null,
          npc.secrets?.length ? (Array.isArray(npc.secrets) ? npc.secrets[0] : npc.secrets) : (npc.secret || null),
          npc.quirk || null,
          npc.location || npc.current_location || null,
          npc.typical_locations || null,
          npc.relationship_to_player || npc.background_notes || null,
          npc.relationship_to_party || npc.role || 'neutral'
        ]);
        npcsCreated++;
      } catch (e) {
        if (!e.message?.includes('UNIQUE')) {
          console.warn(`Failed to create NPC "${npc.name}":`, e.message);
        }
      }
    }
  }

  if (factionsCreated || locationsCreated || npcsCreated) {
    console.log(`Import: created ${factionsCreated} factions, ${locationsCreated} locations, ${npcsCreated} NPCs for campaign ${campaignId}`);
  }
}
