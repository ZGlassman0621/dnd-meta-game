// server/routes/startingPackages.js — starting-package read API (Stage 5).
//
// GET /api/starting-packages/:classId -> one class's package options
//   { classId, options: [{ id, items, gold }], goldOption }
//   404 { error, field: 'classId' } for an unknown class id.
// Read-only: no creation, no mutation. The creator Stage 5 UI fetches
// this on mount; the resolver owns the data (startingPackages.js).
import express from 'express';
import { listPackageOptions } from '../services/packageResolutionService.js';

const router = express.Router();

router.get('/:classId', (req, res) => {
  const result = listPackageOptions(req.params.classId);
  if (!result.ok) {
    return res.status(404).json({ error: result.errors[0]?.message || `Unknown class: ${req.params.classId}`, field: 'classId' });
  }
  res.json({ classId: result.classId, options: result.options, goldOption: result.goldOption });
});

export default router;
