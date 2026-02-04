import express from 'express';
import * as npcRelationshipService from '../services/npcRelationshipService.js';

const router = express.Router();

// ============================================================
// RELATIONSHIP CRUD ROUTES
// ============================================================

// GET /api/npc-relationship/character/:characterId - Get all relationships for a character
router.get('/character/:characterId', async (req, res) => {
  try {
    const relationships = await npcRelationshipService.getCharacterRelationships(req.params.characterId);
    res.json(relationships);
  } catch (error) {
    console.error('Error fetching character relationships:', error);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

// GET /api/npc-relationship/character/:characterId/with-npcs - Get relationships with NPC details
router.get('/character/:characterId/with-npcs', async (req, res) => {
  try {
    const relationships = await npcRelationshipService.getCharacterRelationshipsWithNpcs(req.params.characterId);
    res.json(relationships);
  } catch (error) {
    console.error('Error fetching relationships with NPCs:', error);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

// GET /api/npc-relationship/character/:characterId/summary - Get relationship summary
router.get('/character/:characterId/summary', async (req, res) => {
  try {
    const summary = await npcRelationshipService.getRelationshipSummary(req.params.characterId);
    res.json(summary);
  } catch (error) {
    console.error('Error fetching relationship summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// GET /api/npc-relationship/character/:characterId/allies - Get allied NPCs
router.get('/character/:characterId/allies', async (req, res) => {
  try {
    const relationships = await npcRelationshipService.getAlliedNpcs(req.params.characterId);
    res.json(relationships);
  } catch (error) {
    console.error('Error fetching allies:', error);
    res.status(500).json({ error: 'Failed to fetch allies' });
  }
});

// GET /api/npc-relationship/character/:characterId/hostile - Get hostile NPCs
router.get('/character/:characterId/hostile', async (req, res) => {
  try {
    const relationships = await npcRelationshipService.getHostileNpcs(req.params.characterId);
    res.json(relationships);
  } catch (error) {
    console.error('Error fetching hostile NPCs:', error);
    res.status(500).json({ error: 'Failed to fetch hostile NPCs' });
  }
});

// GET /api/npc-relationship/character/:characterId/by-label/:label - Get NPCs by disposition label
router.get('/character/:characterId/by-label/:label', async (req, res) => {
  try {
    const relationships = await npcRelationshipService.getNpcsByDispositionLabel(
      req.params.characterId,
      req.params.label
    );
    res.json(relationships);
  } catch (error) {
    console.error('Error fetching NPCs by label:', error);
    res.status(500).json({ error: 'Failed to fetch NPCs' });
  }
});

// GET /api/npc-relationship/:characterId/:npcId - Get specific relationship
router.get('/:characterId/:npcId', async (req, res) => {
  try {
    const relationship = await npcRelationshipService.getRelationship(
      req.params.characterId,
      req.params.npcId
    );
    if (!relationship) {
      return res.status(404).json({ error: 'Relationship not found' });
    }
    res.json(relationship);
  } catch (error) {
    console.error('Error fetching relationship:', error);
    res.status(500).json({ error: 'Failed to fetch relationship' });
  }
});

// POST /api/npc-relationship - Create a new relationship
router.post('/', async (req, res) => {
  try {
    const { character_id, npc_id } = req.body;

    if (!character_id || !npc_id) {
      return res.status(400).json({ error: 'character_id and npc_id are required' });
    }

    const relationship = await npcRelationshipService.createRelationship(req.body);
    res.status(201).json(relationship);
  } catch (error) {
    console.error('Error creating relationship:', error);
    res.status(500).json({ error: 'Failed to create relationship' });
  }
});

// PUT /api/npc-relationship/:id - Update a relationship
router.put('/:id', async (req, res) => {
  try {
    const relationship = await npcRelationshipService.updateRelationship(req.params.id, req.body);
    if (!relationship) {
      return res.status(404).json({ error: 'Relationship not found' });
    }
    res.json(relationship);
  } catch (error) {
    console.error('Error updating relationship:', error);
    res.status(500).json({ error: 'Failed to update relationship' });
  }
});

// DELETE /api/npc-relationship/:id - Delete a relationship
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await npcRelationshipService.deleteRelationship(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Relationship not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting relationship:', error);
    res.status(500).json({ error: 'Failed to delete relationship' });
  }
});

// ============================================================
// DISPOSITION & TRUST ROUTES
// ============================================================

// POST /api/npc-relationship/:characterId/:npcId/disposition - Adjust disposition
router.post('/:characterId/:npcId/disposition', async (req, res) => {
  try {
    const { change, reason } = req.body;

    if (change === undefined) {
      return res.status(400).json({ error: 'change is required' });
    }

    const relationship = await npcRelationshipService.adjustDisposition(
      req.params.characterId,
      req.params.npcId,
      change,
      reason
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error adjusting disposition:', error);
    res.status(500).json({ error: 'Failed to adjust disposition' });
  }
});

// POST /api/npc-relationship/:characterId/:npcId/trust - Adjust trust
router.post('/:characterId/:npcId/trust', async (req, res) => {
  try {
    const { change } = req.body;

    if (change === undefined) {
      return res.status(400).json({ error: 'change is required' });
    }

    const relationship = await npcRelationshipService.adjustTrust(
      req.params.characterId,
      req.params.npcId,
      change
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error adjusting trust:', error);
    res.status(500).json({ error: 'Failed to adjust trust' });
  }
});

// POST /api/npc-relationship/:characterId/:npcId/interaction - Record an interaction
router.post('/:characterId/:npcId/interaction', async (req, res) => {
  try {
    const { game_date } = req.body;
    const relationship = await npcRelationshipService.recordInteraction(
      req.params.characterId,
      req.params.npcId,
      game_date
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error recording interaction:', error);
    res.status(500).json({ error: 'Failed to record interaction' });
  }
});

// ============================================================
// KNOWLEDGE ROUTES
// ============================================================

// POST /api/npc-relationship/:characterId/:npcId/known-fact - Add a known fact
router.post('/:characterId/:npcId/known-fact', async (req, res) => {
  try {
    const { fact } = req.body;

    if (!fact) {
      return res.status(400).json({ error: 'fact is required' });
    }

    const relationship = await npcRelationshipService.addKnownFact(
      req.params.characterId,
      req.params.npcId,
      fact
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error adding known fact:', error);
    res.status(500).json({ error: 'Failed to add known fact' });
  }
});

// POST /api/npc-relationship/:characterId/:npcId/player-known-fact - Add player-known fact
router.post('/:characterId/:npcId/player-known-fact', async (req, res) => {
  try {
    const { fact } = req.body;

    if (!fact) {
      return res.status(400).json({ error: 'fact is required' });
    }

    const relationship = await npcRelationshipService.addPlayerKnownFact(
      req.params.characterId,
      req.params.npcId,
      fact
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error adding player-known fact:', error);
    res.status(500).json({ error: 'Failed to add player-known fact' });
  }
});

// POST /api/npc-relationship/:characterId/:npcId/secret - Discover a secret
router.post('/:characterId/:npcId/secret', async (req, res) => {
  try {
    const { secret } = req.body;

    if (!secret) {
      return res.status(400).json({ error: 'secret is required' });
    }

    const relationship = await npcRelationshipService.discoverSecret(
      req.params.characterId,
      req.params.npcId,
      secret
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error discovering secret:', error);
    res.status(500).json({ error: 'Failed to discover secret' });
  }
});

// ============================================================
// RUMOR ROUTES
// ============================================================

// POST /api/npc-relationship/:characterId/:npcId/rumor - Add a rumor
router.post('/:characterId/:npcId/rumor', async (req, res) => {
  try {
    const { rumor } = req.body;

    if (!rumor) {
      return res.status(400).json({ error: 'rumor is required' });
    }

    const relationship = await npcRelationshipService.addRumorHeard(
      req.params.characterId,
      req.params.npcId,
      rumor
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error adding rumor:', error);
    res.status(500).json({ error: 'Failed to add rumor' });
  }
});

// POST /api/npc-relationship/:characterId/:npcId/rumor/:rumorIndex/disprove - Disprove a rumor
router.post('/:characterId/:npcId/rumor/:rumorIndex/disprove', async (req, res) => {
  try {
    const relationship = await npcRelationshipService.disproveRumor(
      req.params.characterId,
      req.params.npcId,
      parseInt(req.params.rumorIndex)
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error disproving rumor:', error);
    res.status(500).json({ error: 'Failed to disprove rumor' });
  }
});

// ============================================================
// PROMISE ROUTES
// ============================================================

// GET /api/npc-relationship/character/:characterId/promises - Get all pending promises
router.get('/character/:characterId/promises', async (req, res) => {
  try {
    const promises = await npcRelationshipService.getPendingPromises(req.params.characterId);
    res.json(promises);
  } catch (error) {
    console.error('Error fetching pending promises:', error);
    res.status(500).json({ error: 'Failed to fetch promises' });
  }
});

// POST /api/npc-relationship/:characterId/:npcId/promise - Add a promise
router.post('/:characterId/:npcId/promise', async (req, res) => {
  try {
    const { promise } = req.body;

    if (!promise) {
      return res.status(400).json({ error: 'promise is required' });
    }

    const relationship = await npcRelationshipService.addPromise(
      req.params.characterId,
      req.params.npcId,
      promise
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error adding promise:', error);
    res.status(500).json({ error: 'Failed to add promise' });
  }
});

// POST /api/npc-relationship/:characterId/:npcId/promise/:promiseIndex/fulfill - Fulfill a promise
router.post('/:characterId/:npcId/promise/:promiseIndex/fulfill', async (req, res) => {
  try {
    const relationship = await npcRelationshipService.fulfillPromise(
      req.params.characterId,
      req.params.npcId,
      parseInt(req.params.promiseIndex)
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error fulfilling promise:', error);
    res.status(500).json({ error: 'Failed to fulfill promise' });
  }
});

// POST /api/npc-relationship/:characterId/:npcId/promise/:promiseIndex/break - Break a promise
router.post('/:characterId/:npcId/promise/:promiseIndex/break', async (req, res) => {
  try {
    const { reason } = req.body;
    const relationship = await npcRelationshipService.breakPromise(
      req.params.characterId,
      req.params.npcId,
      parseInt(req.params.promiseIndex),
      reason
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error breaking promise:', error);
    res.status(500).json({ error: 'Failed to break promise' });
  }
});

// ============================================================
// DEBT ROUTES
// ============================================================

// GET /api/npc-relationship/character/:characterId/debts - Get all outstanding debts
router.get('/character/:characterId/debts', async (req, res) => {
  try {
    const debts = await npcRelationshipService.getOutstandingDebts(req.params.characterId);
    res.json(debts);
  } catch (error) {
    console.error('Error fetching outstanding debts:', error);
    res.status(500).json({ error: 'Failed to fetch debts' });
  }
});

// POST /api/npc-relationship/:characterId/:npcId/debt - Add a debt
router.post('/:characterId/:npcId/debt', async (req, res) => {
  try {
    const { type, description, direction } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    const relationship = await npcRelationshipService.addDebt(
      req.params.characterId,
      req.params.npcId,
      { type, description, direction }
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error adding debt:', error);
    res.status(500).json({ error: 'Failed to add debt' });
  }
});

// POST /api/npc-relationship/:characterId/:npcId/debt/:debtIndex/settle - Settle a debt
router.post('/:characterId/:npcId/debt/:debtIndex/settle', async (req, res) => {
  try {
    const { how_settled } = req.body;
    const relationship = await npcRelationshipService.settleDebt(
      req.params.characterId,
      req.params.npcId,
      parseInt(req.params.debtIndex),
      how_settled
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error settling debt:', error);
    res.status(500).json({ error: 'Failed to settle debt' });
  }
});

// POST /api/npc-relationship/:characterId/:npcId/debt/:debtIndex/forgive - Forgive a debt
router.post('/:characterId/:npcId/debt/:debtIndex/forgive', async (req, res) => {
  try {
    const relationship = await npcRelationshipService.forgiveDebt(
      req.params.characterId,
      req.params.npcId,
      parseInt(req.params.debtIndex)
    );
    res.json(relationship);
  } catch (error) {
    console.error('Error forgiving debt:', error);
    res.status(500).json({ error: 'Failed to forgive debt' });
  }
});

export default router;
