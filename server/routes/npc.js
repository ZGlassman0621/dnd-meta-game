import express from 'express';
import db from '../database.js';

const router = express.Router();

// Get all NPCs
router.get('/', (req, res) => {
  try {
    const npcs = db.prepare('SELECT * FROM npcs ORDER BY created_at DESC').all();
    res.json(npcs);
  } catch (error) {
    console.error('Error fetching NPCs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single NPC by ID
router.get('/:id', (req, res) => {
  try {
    const npc = db.prepare('SELECT * FROM npcs WHERE id = ?').get(req.params.id);
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
router.post('/', (req, res) => {
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

    const stmt = db.prepare(`
      INSERT INTO npcs (
        name, nickname, race, gender, age, occupation, occupation_category,
        stat_block, cr, ac, hp, speed, ability_scores, skills, languages,
        height, build, hair_color, hair_style, eye_color, skin_tone,
        facial_features, distinguishing_marks, facial_hair, clothing_style,
        accessories, voice, personality_trait_1, personality_trait_2,
        mannerism, motivation, fear, secret, quirk, current_location,
        typical_locations, background_notes, relationship_to_party, campaign_availability, avatar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
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
    );

    const newNpc = db.prepare('SELECT * FROM npcs WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newNpc);
  } catch (error) {
    console.error('Error creating NPC:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update an NPC
router.put('/:id', (req, res) => {
  try {
    const npc = db.prepare('SELECT * FROM npcs WHERE id = ?').get(req.params.id);
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

    const stmt = db.prepare(`
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
    `);

    stmt.run(
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
    );

    const updatedNpc = db.prepare('SELECT * FROM npcs WHERE id = ?').get(req.params.id);
    res.json(updatedNpc);
  } catch (error) {
    console.error('Error updating NPC:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete an NPC
router.delete('/:id', (req, res) => {
  try {
    const npc = db.prepare('SELECT * FROM npcs WHERE id = ?').get(req.params.id);
    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    db.prepare('DELETE FROM npcs WHERE id = ?').run(req.params.id);
    res.json({ message: 'NPC deleted successfully' });
  } catch (error) {
    console.error('Error deleting NPC:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get NPCs available for campaigns (not marked as 'hidden')
router.get('/available/campaign', (req, res) => {
  try {
    const npcs = db.prepare(`
      SELECT * FROM npcs
      WHERE campaign_availability != 'hidden'
      ORDER BY name ASC
    `).all();
    res.json(npcs);
  } catch (error) {
    console.error('Error fetching available NPCs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search NPCs by name or occupation
router.get('/search/:query', (req, res) => {
  try {
    const query = `%${req.params.query}%`;
    const npcs = db.prepare(`
      SELECT * FROM npcs
      WHERE name LIKE ? OR nickname LIKE ? OR occupation LIKE ? OR current_location LIKE ?
      ORDER BY name ASC
    `).all(query, query, query, query);
    res.json(npcs);
  } catch (error) {
    console.error('Error searching NPCs:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
