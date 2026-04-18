/**
 * Nickname API Routes
 *
 * Character-scoped multi-nickname management with audience rules.
 * All routes are authenticated (mounted under /api which requires JWT).
 */

import express from 'express';
import * as nicknameService from '../services/nicknameService.js';
import { handleServerError, validationError } from '../utils/errorHandler.js';

const router = express.Router();

// GET /api/character/:id/nicknames — list all nickname rules for a character
router.get('/:id/nicknames', async (req, res) => {
  try {
    const nicknames = await nicknameService.listNicknames(req.params.id);
    res.json(nicknames);
  } catch (err) {
    handleServerError(res, err, 'list nicknames');
  }
});

// POST /api/character/:id/nicknames — create a new nickname rule
router.post('/:id/nicknames', async (req, res) => {
  try {
    const { nickname, audience_type, audience_value, notes } = req.body;
    if (!nickname || !audience_type) {
      return validationError(res, 'nickname and audience_type are required');
    }
    const created = await nicknameService.createNickname({
      character_id: Number(req.params.id),
      nickname,
      audience_type,
      audience_value: audience_value ?? null,
      notes: notes ?? null
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.message && (err.message.startsWith('Invalid audience_type') ||
                        err.message.includes('is required'))) {
      return validationError(res, err.message);
    }
    handleServerError(res, err, 'create nickname');
  }
});

// PUT /api/character/:id/nicknames/:nicknameId — update an existing rule
router.put('/:id/nicknames/:nicknameId', async (req, res) => {
  try {
    const existing = await nicknameService.getNicknameById(req.params.nicknameId);
    if (!existing) return res.status(404).json({ error: 'Nickname not found' });
    if (String(existing.character_id) !== String(req.params.id)) {
      return res.status(404).json({ error: 'Nickname not found for this character' });
    }
    const updated = await nicknameService.updateNickname(req.params.nicknameId, req.body);
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.startsWith('Invalid audience_type')) {
      return validationError(res, err.message);
    }
    handleServerError(res, err, 'update nickname');
  }
});

// DELETE /api/character/:id/nicknames/:nicknameId — remove a rule
router.delete('/:id/nicknames/:nicknameId', async (req, res) => {
  try {
    const existing = await nicknameService.getNicknameById(req.params.nicknameId);
    if (!existing) return res.status(404).json({ error: 'Nickname not found' });
    if (String(existing.character_id) !== String(req.params.id)) {
      return res.status(404).json({ error: 'Nickname not found for this character' });
    }
    const ok = await nicknameService.deleteNickname(req.params.nicknameId);
    res.json({ success: ok });
  } catch (err) {
    handleServerError(res, err, 'delete nickname');
  }
});

// GET /api/character/:id/nicknames/resolve/:npcId — what does this NPC call the PC?
// Useful for UI previews and debugging ("try Jarrick" → shows Riv).
router.get('/:id/nicknames/resolve/:npcId', async (req, res) => {
  try {
    const resolution = await nicknameService.resolveForNpc(req.params.id, req.params.npcId);
    res.json(resolution);
  } catch (err) {
    handleServerError(res, err, 'resolve nickname for NPC');
  }
});

export default router;
