// server/routes/themes.js — theme registry read API (Stage 3, 2026-11-06).
//
// GET /api/themes     -> every registry entry, client shape
// GET /api/themes/:id -> one entry, or 404 when unregistered
// Read-only: no creation, no mutation. The creator shell reads this;
// the seeded `themes` table is not consulted (see themeService.js).
import express from 'express';
import { listThemes, resolveTheme, toClientShape } from '../services/themeService.js';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ themes: listThemes().map(toClientShape) });
});

router.get('/:id', (req, res) => {
  const resolved = resolveTheme(req.params.id);
  if (!resolved) return res.status(404).json({ error: `Unknown theme: ${req.params.id}` });
  res.json({ theme: toClientShape(resolved) });
});

export default router;
