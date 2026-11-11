// server/routes/species.js — species registry read API (2026-11-04).
//
// GET /api/species     -> every registry entry, client shape
// GET /api/species/:id -> one entry, or 404 when unregistered
// Read-only: no creation, no mutation. The creator shell reads this;
// the interim adapter is the offline fallback when it cannot.
import express from 'express';
import { listSpecies, resolveSpecies, toClientShape } from '../services/speciesService.js';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ species: listSpecies().map(toClientShape) });
});

router.get('/:id', (req, res) => {
  const resolved = resolveSpecies(req.params.id, null);
  if (!resolved) return res.status(404).json({ error: `Unknown species: ${req.params.id}` });
  res.json({ species: toClientShape(resolved.entry) });
});

export default router;
