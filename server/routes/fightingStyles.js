// server/routes/fightingStyles.js — fighting-style registry read API
// (Stage 6 follow-up, 2026-11-07).
//
// GET /api/fighting-styles
//   -> { fightingStyles: [{ key, name, category, effect, source }] }
//
// The 10 2024 fighting styles, served verbatim from
// listFightingStyleFeats() in server/data/featRegistry.js — the
// single source of truth. The client must read this endpoint, not
// keep a hardcoded copy (Stage 2's hardcoded FIGHTING_STYLES is
// the copy this replaces). No per-class subsets: the full registry
// list is the list (coordinator decision 2026-11-07, reversible).
//
// Read-only: no creation, no mutation. Mounted in server/index.js
// next to the spells route.
import express from 'express';
import { listFightingStyleFeats } from '../data/featRegistry.js';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ fightingStyles: listFightingStyleFeats() });
});

export default router;
