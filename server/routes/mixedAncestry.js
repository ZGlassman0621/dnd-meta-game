// server/routes/mixedAncestry.js — Mixed Ancestry read API (2026-11-06).
//
// GET /api/mixed-ancestry            -> trait tables for every parent
//   species in the doc, with availability (goliath: not in the registry
//   yet; orc + the other MVP-deferred species: grayed out), the base
//   budget (7), the forgo-origin-feat bonus (+4), and the default
//   speed (30). The Stage 1 picker reads this; the tables are the
//   transcribed doc values, never re-balanced.
// GET /api/mixed-ancestry/ancestry-lists?parents=human,elf
//   -> the ancestry-feat list_ids a mixed character with those parents
//   may pick from (either parent's list).
// Read-only: no creation, no mutation. Validation + storage live in
// mixedAncestryService.js and the character route.
import express from 'express';
import {
  MIXED_ANCESTRY_BASE_BUDGET,
  MIXED_ANCESTRY_FORGO_ORIGIN_FEAT_BONUS,
  MIXED_ANCESTRY_DEFAULT_SPEED,
} from '../data/mixedAncestry.js';
import {
  traitTablesForAllParents,
  ancestryFeatListsFor,
} from '../services/mixedAncestryService.js';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    baseBudget: MIXED_ANCESTRY_BASE_BUDGET,
    forgoOriginFeatBonus: MIXED_ANCESTRY_FORGO_ORIGIN_FEAT_BONUS,
    defaultSpeed: MIXED_ANCESTRY_DEFAULT_SPEED,
    tables: traitTablesForAllParents(),
  });
});

router.get('/ancestry-lists', (req, res) => {
  const raw = req.query.parents;
  const parents = typeof raw === 'string'
    ? raw.split(',').map((p) => p.trim()).filter(Boolean)
    : [];
  res.json({ parents, lists: ancestryFeatListsFor(parents) });
});

export default router;
