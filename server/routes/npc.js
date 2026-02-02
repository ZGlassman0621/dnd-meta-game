import express from 'express';
import { dbAll, dbGet, dbRun } from '../database.js';

const router = express.Router();

// Get all NPCs
router.get('/', async (req, res) => {
  try {
    const npcs = await dbAll('SELECT * FROM npcs ORDER BY created_at DESC');
    res.json(npcs);
  } catch (error) {
    console.error('Error fetching NPCs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single NPC by ID
router.get('/:id', async (req, res) => {
  try {
    const npc = await dbGet('SELECT * FROM npcs WHERE id = ?', [req.params.id]);
    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }
    res.json(npc);
  } catch (error) {
    console.error('Error fetching NPC:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new NPC
router.post('/', async (req, res) => {
  try {
    const {
      name,
      nickname,
      race,
      gender,
      age,
      occupation,
      occupation_category,
      stat_block,
      cr,
      ac,
      hp,
      speed,
      ability_scores,
      skills,
      languages,
      height,
      build,
      hair_color,
      hair_style,
      eye_color,
      skin_tone,
      facial_features,
      distinguishing_marks,
      facial_hair,
      clothing_style,
      accessories,
      voice,
      personality_trait_1,
      personality_trait_2,
      mannerism,
      motivation,
      fear,
      secret,
      quirk,
      current_location,
      typical_locations,
      background_notes,
      relationship_to_party,
      campaign_availability,
      avatar
    } = req.body;

    if (!name || !race) {
      return res.status(400).json({ error: 'Name and race are required' });
    }

    const result = await dbRun(`
      INSERT INTO npcs (
        name, nickname, race, gender, age, occupation, occupation_category,
        stat_block, cr, ac, hp, speed, ability_scores, skills, languages,
        height, build, hair_color, hair_style, eye_color, skin_tone,
        facial_features, distinguishing_marks, facial_hair, clothing_style,
        accessories, voice, personality_trait_1, personality_trait_2,
        mannerism, motivation, fear, secret, quirk, current_location,
        typical_locations, background_notes, relationship_to_party, campaign_availability, avatar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name,
      nickname || null,
      race,
      gender || null,
      age || null,
      occupation || null,
      occupation_category || null,
      stat_block || 'commoner',
      cr || '0',
      ac || 10,
      hp || 4,
      speed || '30 ft.',
      typeof ability_scores === 'object' ? JSON.stringify(ability_scores) : ability_scores || '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
      typeof skills === 'object' ? JSON.stringify(skills) : skills || '[]',
      languages || 'Common',
      height || null,
      build || null,
      hair_color || null,
      hair_style || null,
      eye_color || null,
      skin_tone || null,
      Array.isArray(facial_features) ? JSON.stringify(facial_features) : facial_features || null,
      distinguishing_marks || null,
      facial_hair || null,
      clothing_style || null,
      accessories || null,
      voice || null,
      personality_trait_1 || null,
      personality_trait_2 || null,
      mannerism || null,
      motivation || null,
      fear || null,
      secret || null,
      quirk || null,
      current_location || null,
      typical_locations || null,
      background_notes || null,
      relationship_to_party || null,
      campaign_availability || 'available',
      avatar || null
    ]);

    const newNpc = await dbGet('SELECT * FROM npcs WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(newNpc);
  } catch (error) {
    console.error('Error creating NPC:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update an NPC
router.put('/:id', async (req, res) => {
  try {
    const npc = await dbGet('SELECT * FROM npcs WHERE id = ?', [req.params.id]);
    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    const {
      name,
      nickname,
      race,
      gender,
      age,
      occupation,
      occupation_category,
      stat_block,
      cr,
      ac,
      hp,
      speed,
      ability_scores,
      skills,
      languages,
      height,
      build,
      hair_color,
      hair_style,
      eye_color,
      skin_tone,
      facial_features,
      distinguishing_marks,
      facial_hair,
      clothing_style,
      accessories,
      voice,
      personality_trait_1,
      personality_trait_2,
      mannerism,
      motivation,
      fear,
      secret,
      quirk,
      current_location,
      typical_locations,
      background_notes,
      relationship_to_party,
      campaign_availability,
      avatar
    } = req.body;

    await dbRun(`
      UPDATE npcs SET
        name = ?, nickname = ?, race = ?, gender = ?, age = ?,
        occupation = ?, occupation_category = ?, stat_block = ?,
        cr = ?, ac = ?, hp = ?, speed = ?, ability_scores = ?,
        skills = ?, languages = ?, height = ?, build = ?,
        hair_color = ?, hair_style = ?, eye_color = ?, skin_tone = ?,
        facial_features = ?, distinguishing_marks = ?, facial_hair = ?,
        clothing_style = ?, accessories = ?, voice = ?,
        personality_trait_1 = ?, personality_trait_2 = ?, mannerism = ?,
        motivation = ?, fear = ?, secret = ?, quirk = ?,
        current_location = ?, typical_locations = ?, background_notes = ?,
        relationship_to_party = ?, campaign_availability = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name || npc.name,
      nickname !== undefined ? nickname : npc.nickname,
      race || npc.race,
      gender !== undefined ? gender : npc.gender,
      age !== undefined ? age : npc.age,
      occupation !== undefined ? occupation : npc.occupation,
      occupation_category !== undefined ? occupation_category : npc.occupation_category,
      stat_block || npc.stat_block,
      cr !== undefined ? cr : npc.cr,
      ac !== undefined ? ac : npc.ac,
      hp !== undefined ? hp : npc.hp,
      speed || npc.speed,
      ability_scores ? (typeof ability_scores === 'object' ? JSON.stringify(ability_scores) : ability_scores) : npc.ability_scores,
      skills ? (typeof skills === 'object' ? JSON.stringify(skills) : skills) : npc.skills,
      languages || npc.languages,
      height !== undefined ? height : npc.height,
      build !== undefined ? build : npc.build,
      hair_color !== undefined ? hair_color : npc.hair_color,
      hair_style !== undefined ? hair_style : npc.hair_style,
      eye_color !== undefined ? eye_color : npc.eye_color,
      skin_tone !== undefined ? skin_tone : npc.skin_tone,
      facial_features !== undefined ? (Array.isArray(facial_features) ? JSON.stringify(facial_features) : facial_features) : npc.facial_features,
      distinguishing_marks !== undefined ? distinguishing_marks : npc.distinguishing_marks,
      facial_hair !== undefined ? facial_hair : npc.facial_hair,
      clothing_style !== undefined ? clothing_style : npc.clothing_style,
      accessories !== undefined ? accessories : npc.accessories,
      voice !== undefined ? voice : npc.voice,
      personality_trait_1 !== undefined ? personality_trait_1 : npc.personality_trait_1,
      personality_trait_2 !== undefined ? personality_trait_2 : npc.personality_trait_2,
      mannerism !== undefined ? mannerism : npc.mannerism,
      motivation !== undefined ? motivation : npc.motivation,
      fear !== undefined ? fear : npc.fear,
      secret !== undefined ? secret : npc.secret,
      quirk !== undefined ? quirk : npc.quirk,
      current_location !== undefined ? current_location : npc.current_location,
      typical_locations !== undefined ? typical_locations : npc.typical_locations,
      background_notes !== undefined ? background_notes : npc.background_notes,
      relationship_to_party !== undefined ? relationship_to_party : npc.relationship_to_party,
      campaign_availability !== undefined ? campaign_availability : npc.campaign_availability,
      avatar !== undefined ? avatar : npc.avatar,
      req.params.id
    ]);

    const updatedNpc = await dbGet('SELECT * FROM npcs WHERE id = ?', [req.params.id]);
    res.json(updatedNpc);
  } catch (error) {
    console.error('Error updating NPC:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete an NPC
router.delete('/:id', async (req, res) => {
  try {
    const npc = await dbGet('SELECT * FROM npcs WHERE id = ?', [req.params.id]);
    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    await dbRun('DELETE FROM npcs WHERE id = ?', [req.params.id]);
    res.json({ message: 'NPC deleted successfully' });
  } catch (error) {
    console.error('Error deleting NPC:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get NPCs available for campaigns (not marked as 'hidden')
router.get('/available/campaign', async (req, res) => {
  try {
    const npcs = await dbAll(`
      SELECT * FROM npcs
      WHERE campaign_availability != 'hidden'
      ORDER BY name ASC
    `);
    res.json(npcs);
  } catch (error) {
    console.error('Error fetching available NPCs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search NPCs by name or occupation
router.get('/search/:query', async (req, res) => {
  try {
    const query = `%${req.params.query}%`;
    const npcs = await dbAll(`
      SELECT * FROM npcs
      WHERE name LIKE ? OR nickname LIKE ? OR occupation LIKE ? OR current_location LIKE ?
      ORDER BY name ASC
    `, [query, query, query, query]);
    res.json(npcs);
  } catch (error) {
    console.error('Error searching NPCs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save an AI-generated NPC from a session
// This endpoint is specifically for capturing NPCs that were introduced by the AI during DM sessions
router.post('/from-session', async (req, res) => {
  try {
    const {
      name,
      race,
      gender,
      occupation,
      current_location,
      personality_traits,
      appearance,
      wants_to_join,
      session_id,
      relationship_to_party
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'NPC name is required' });
    }

    // Check if an NPC with this name already exists
    const existing = await dbGet('SELECT id FROM npcs WHERE name = ?', [name]);
    if (existing) {
      // Return existing NPC instead of creating duplicate
      const existingNpc = await dbGet('SELECT * FROM npcs WHERE id = ?', [existing.id]);
      return res.json({ npc: existingNpc, existed: true });
    }

    // Parse personality traits if provided
    let personality1 = null;
    let personality2 = null;
    if (personality_traits) {
      if (Array.isArray(personality_traits)) {
        personality1 = personality_traits[0] || null;
        personality2 = personality_traits[1] || null;
      } else if (typeof personality_traits === 'string') {
        // Split comma-separated traits
        const traits = personality_traits.split(',').map(t => t.trim());
        personality1 = traits[0] || null;
        personality2 = traits[1] || null;
      }
    }

    // Parse appearance into physical attributes if provided
    let height = null;
    let build = null;
    let hair_color = null;
    let eye_color = null;
    let distinguishing_marks = null;

    if (appearance && typeof appearance === 'string') {
      // Store full appearance as background notes if can't parse
      distinguishing_marks = appearance;
    }

    // Set campaign availability based on whether NPC wants to join
    const campaign_availability = wants_to_join ? 'companion' : 'available';

    const result = await dbRun(`
      INSERT INTO npcs (
        name, race, gender, occupation, current_location,
        personality_trait_1, personality_trait_2,
        height, build, hair_color, eye_color, distinguishing_marks,
        relationship_to_party, campaign_availability,
        background_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name,
      race || 'Human',
      gender || null,
      occupation || null,
      current_location || null,
      personality1,
      personality2,
      height,
      build,
      hair_color,
      eye_color,
      distinguishing_marks,
      relationship_to_party || 'neutral',
      campaign_availability,
      session_id ? `First encountered in session #${session_id}` : null
    ]);

    const newNpc = await dbGet('SELECT * FROM npcs WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ npc: newNpc, existed: false });
  } catch (error) {
    console.error('Error saving AI-generated NPC:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark an NPC as interested in joining the party (companion availability)
router.post('/:id/mark-recruitable', async (req, res) => {
  try {
    const npc = await dbGet('SELECT * FROM npcs WHERE id = ?', [req.params.id]);
    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    await dbRun(
      'UPDATE npcs SET campaign_availability = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['companion', req.params.id]
    );

    const updatedNpc = await dbGet('SELECT * FROM npcs WHERE id = ?', [req.params.id]);
    res.json(updatedNpc);
  } catch (error) {
    console.error('Error marking NPC as recruitable:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
