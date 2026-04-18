import express from 'express';
import * as partyBaseService from '../services/partyBaseService.js';
import * as longTermProjectService from '../services/longTermProjectService.js';
import * as notorietyService from '../services/notorietyService.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

// ─── Party Base ───────────────────────────────────────────

// NOTE: The 2-param GET /base/:characterId/:campaignId route below is defined
// LAST among /base/... routes because Express matches patterns in registration
// order. `/base/:baseId/garrison` (3 segments on GET) would otherwise be
// swallowed by `/base/:a/:b`, which also matches any 3-segment /base URL.

// GET /api/base/:characterId/:campaignId — primary base (back-compat single)
// (defined at bottom of /base routes to avoid collision; see below)

// GET /api/bases/:characterId/:campaignId — ALL bases (F1b)
router.get('/bases/:characterId/:campaignId', async (req, res) => {
  try {
    const { characterId, campaignId } = req.params;
    const bases = await partyBaseService.getBases(characterId, campaignId);
    res.json({ bases });
  } catch (err) {
    handleServerError(res, err, 'fetch party bases');
  }
});

// POST /api/base — create a new base (F1 signature: category + subtype)
router.post('/base', async (req, res) => {
  try {
    const { characterId, campaignId, name, category, subtype, location_id, description, is_primary } = req.body;
    if (!characterId || !campaignId || !name || !category || !subtype) {
      return res.status(400).json({ error: 'characterId, campaignId, name, category, and subtype are required' });
    }
    const base = await partyBaseService.createBase(characterId, campaignId, {
      name, category, subtype, location_id, description, is_primary
    });
    res.status(201).json(base);
  } catch (err) {
    if (err.message?.includes('Invalid') || err.message?.includes("doesn't belong")) {
      return res.status(400).json({ error: err.message });
    }
    handleServerError(res, err, 'create party base');
  }
});

// POST /api/base/:baseId/set-primary — promote a satellite to primary
router.post('/base/:baseId/set-primary', async (req, res) => {
  try {
    const base = await partyBaseService.setPrimaryBase(Number(req.params.baseId));
    res.json(base);
  } catch (err) {
    handleServerError(res, err, 'set primary base');
  }
});

// PUT /api/base/:baseId — update base fields
router.put('/base/:baseId', async (req, res) => {
  try {
    const base = await partyBaseService.updateBase(req.params.baseId, req.body);
    res.json(base);
  } catch (err) {
    handleServerError(res, err, 'update party base');
  }
});

// DELETE /api/base/:baseId — abandon base (soft-delete)
router.delete('/base/:baseId', async (req, res) => {
  try {
    await partyBaseService.abandonBase(req.params.baseId);
    res.json({ success: true });
  } catch (err) {
    handleServerError(res, err, 'abandon party base');
  }
});

// POST /api/base/:baseId/establish — set base to active status
router.post('/base/:baseId/establish', async (req, res) => {
  try {
    const { currentGameDay } = req.body;
    const base = await partyBaseService.establishBase(req.params.baseId, currentGameDay);
    res.json(base);
  } catch (err) {
    handleServerError(res, err, 'establish party base');
  }
});

// ─── Upgrades ─────────────────────────────────────────────

// ─── Buildings (F1) — replaces the old base-level upgrade endpoints ──

// GET /api/base/:baseId/buildings/available — which building types can be
// installed in this base (filtered by the subtype's allowed categories)
router.get('/base/:baseId/buildings/available', async (req, res) => {
  try {
    const base = await partyBaseService.getBaseById(Number(req.params.baseId));
    if (!base) return res.status(404).json({ error: 'Base not found' });
    const { getAvailableBuildingsForSubtype } = await import('../config/partyBaseConfig.js');
    const catalog = getAvailableBuildingsForSubtype(base.subtype);

    // Filter out already-installed types (simple heuristic: one of each)
    const installedTypes = new Set((base.buildings || []).map(b => b.building_type));

    const out = Object.entries(catalog).map(([key, b]) => ({
      key,
      ...b,
      installed: installedTypes.has(key)
    }));
    res.json({ buildings: out, slotsUsed: (base.buildings || [])
      .filter(b => b.status !== 'damaged')
      .reduce((n, b) => n + ((catalog[b.building_type]?.slots) || 1), 0),
      slotsTotal: base.building_slots });
  } catch (err) {
    handleServerError(res, err, 'fetch available buildings');
  }
});

// POST /api/base/:baseId/buildings — install a new building
router.post('/base/:baseId/buildings', async (req, res) => {
  try {
    const { building_type, name, currentGameDay } = req.body || {};
    if (!building_type) return res.status(400).json({ error: 'building_type is required' });
    const building = await partyBaseService.addBuilding(Number(req.params.baseId), {
      building_type, name, currentGameDay
    });
    res.status(201).json(building);
  } catch (err) {
    if (err.message?.includes('Not enough') || err.message?.includes('Unknown') ||
        err.message?.includes('cannot be installed') || err.message?.includes('Insufficient')) {
      return res.status(400).json({ error: err.message });
    }
    handleServerError(res, err, 'install building');
  }
});

// POST /api/base/:baseId/buildings/:buildingId/advance — add hours to construction
router.post('/base/:baseId/buildings/:buildingId/advance', async (req, res) => {
  try {
    const { hours, currentGameDay } = req.body || {};
    if (!hours || hours <= 0) return res.status(400).json({ error: 'hours must be a positive number' });
    const result = await partyBaseService.advanceBuildingConstruction(
      Number(req.params.buildingId), hours, currentGameDay
    );
    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'advance building construction');
  }
});

// DELETE /api/base/:baseId/buildings/:buildingId — demolish / remove a building
router.delete('/base/:baseId/buildings/:buildingId', async (req, res) => {
  try {
    const removed = await partyBaseService.removeBuilding(Number(req.params.buildingId));
    res.json({ success: true, removed });
  } catch (err) {
    handleServerError(res, err, 'remove building');
  }
});

// ─── Garrison & Officers (F2) ─────────────────────────────

// GET /api/base/:baseId/garrison — defense rating + garrison strength + officers
router.get('/base/:baseId/garrison', async (req, res) => {
  try {
    const snap = await partyBaseService.getGarrisonSnapshot(Number(req.params.baseId));
    if (!snap) return res.status(404).json({ error: 'Base not found' });
    res.json(snap);
  } catch (err) {
    handleServerError(res, err, 'fetch garrison');
  }
});

// POST /api/base/:baseId/officers — assign a companion as officer
router.post('/base/:baseId/officers', async (req, res) => {
  try {
    const { companionId, role, notes, currentGameDay } = req.body || {};
    if (!companionId) return res.status(400).json({ error: 'companionId is required' });
    const officers = await partyBaseService.assignOfficer(
      Number(req.params.baseId),
      Number(companionId),
      { role, notes, currentGameDay }
    );
    res.status(201).json({ officers });
  } catch (err) {
    if (err.message?.includes('not found') ||
        err.message?.includes('not active') ||
        err.message?.includes('different character') ||
        err.message?.includes('already an officer')) {
      return res.status(400).json({ error: err.message });
    }
    handleServerError(res, err, 'assign officer');
  }
});

// DELETE /api/base/:baseId/officers/:officerId — unassign
router.delete('/base/:baseId/officers/:officerId', async (req, res) => {
  try {
    const result = await partyBaseService.unassignOfficer(Number(req.params.officerId));
    res.json(result);
  } catch (err) {
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    handleServerError(res, err, 'unassign officer');
  }
});

// GET /api/base/:characterId/:campaignId — primary base (back-compat single).
// Registered AFTER the /base/:baseId/... routes to avoid swallowing their 3-
// segment patterns (like /base/:baseId/garrison).
router.get('/base/:characterId/:campaignId', async (req, res) => {
  try {
    const { characterId, campaignId } = req.params;
    const base = await partyBaseService.getBase(characterId, campaignId);
    if (!base) return res.json(null);
    res.json(base);
  } catch (err) {
    handleServerError(res, err, 'fetch party base');
  }
});

// ─── Staff ────────────────────────────────────────────────

// POST /api/base/:baseId/staff — hire a staff member
router.post('/base/:baseId/staff', async (req, res) => {
  try {
    const { name, role, salary_gp } = req.body;
    if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
    const base = await partyBaseService.hireStaff(req.params.baseId, {
      name, role, salary_gp: salary_gp || 5
    });
    res.json(base);
  } catch (err) {
    if (err.message?.includes('Staff cap')) {
      return res.status(400).json({ error: err.message });
    }
    handleServerError(res, err, 'hire staff');
  }
});

// DELETE /api/base/:baseId/staff/:index — fire a staff member
router.delete('/base/:baseId/staff/:index', async (req, res) => {
  try {
    const base = await partyBaseService.fireStaff(req.params.baseId, parseInt(req.params.index));
    res.json(base);
  } catch (err) {
    handleServerError(res, err, 'fire staff');
  }
});

// ─── Treasury ─────────────────────────────────────────────

// POST /api/base/:baseId/treasury — deposit or withdraw gold
router.post('/base/:baseId/treasury', async (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (amount === undefined || amount === 0) {
      return res.status(400).json({ error: 'amount is required (positive=deposit, negative=withdraw)' });
    }
    const base = await partyBaseService.modifyTreasury(req.params.baseId, amount, reason);
    res.json(base);
  } catch (err) {
    if (err.message?.includes('Insufficient')) {
      return res.status(400).json({ error: err.message });
    }
    handleServerError(res, err, 'modify treasury');
  }
});

// ─── Events ───────────────────────────────────────────────

// GET /api/base/:baseId/events — base events (optional ?resolved=true)
router.get('/base/:baseId/events', async (req, res) => {
  try {
    const includeResolved = req.query.resolved === 'true';
    const events = await partyBaseService.getBaseEvents(req.params.baseId, includeResolved);
    res.json(events);
  } catch (err) {
    handleServerError(res, err, 'fetch base events');
  }
});

// POST /api/base/:baseId/events/:eventId/resolve — resolve a base event
router.post('/base/:baseId/events/:eventId/resolve', async (req, res) => {
  try {
    const { resolution } = req.body;
    const event = await partyBaseService.resolveEvent(req.params.eventId, resolution);
    res.json(event);
  } catch (err) {
    handleServerError(res, err, 'resolve base event');
  }
});

// ─── Renown ───────────────────────────────────────────────

// POST /api/base/:baseId/renown — add renown
router.post('/base/:baseId/renown', async (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount is required' });
    const result = await partyBaseService.addRenown(req.params.baseId, amount, reason);
    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'add renown');
  }
});

// ─── Long-Term Projects ──────────────────────────────────

// GET /api/projects/:characterId/:campaignId — all projects
router.get('/projects/:characterId/:campaignId', async (req, res) => {
  try {
    const { characterId, campaignId } = req.params;
    const projects = await longTermProjectService.getProjects(characterId, campaignId);
    res.json(projects);
  } catch (err) {
    handleServerError(res, err, 'fetch projects');
  }
});

// POST /api/projects — create a new project
router.post('/projects', async (req, res) => {
  try {
    const { characterId, campaignId, name, description, project_type, total_segments,
            skill_used, dc, rewards, started_game_day } = req.body;
    if (!characterId || !campaignId || !name || !project_type || !total_segments) {
      return res.status(400).json({ error: 'characterId, campaignId, name, project_type, and total_segments are required' });
    }
    const project = await longTermProjectService.createProject(characterId, campaignId, {
      name, description, project_type, total_segments, skill_used, dc, rewards, started_game_day
    });
    res.status(201).json(project);
  } catch (err) {
    if (err.message?.includes('Maximum')) {
      return res.status(400).json({ error: err.message });
    }
    handleServerError(res, err, 'create project');
  }
});

// POST /api/projects/:projectId/advance — advance project segments
router.post('/projects/:projectId/advance', async (req, res) => {
  try {
    const { segments } = req.body;
    if (!segments || segments <= 0) return res.status(400).json({ error: 'segments must be a positive number' });
    const project = await longTermProjectService.advanceProject(req.params.projectId, segments);
    res.json(project);
  } catch (err) {
    handleServerError(res, err, 'advance project');
  }
});

// POST /api/projects/:projectId/work — work on project (hours + skill roll)
router.post('/projects/:projectId/work', async (req, res) => {
  try {
    const { hoursSpent, skillModifier } = req.body;
    if (!hoursSpent || hoursSpent <= 0) return res.status(400).json({ error: 'hoursSpent is required' });
    const result = await longTermProjectService.workOnProject(
      req.params.projectId, hoursSpent, skillModifier || 0
    );
    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'work on project');
  }
});

// DELETE /api/projects/:projectId — abandon project
router.delete('/projects/:projectId', async (req, res) => {
  try {
    await longTermProjectService.abandonProject(req.params.projectId);
    res.json({ success: true });
  } catch (err) {
    handleServerError(res, err, 'abandon project');
  }
});

// ─── Notoriety ────────────────────────────────────────────

// GET /api/notoriety/:characterId/:campaignId — all notoriety entries
router.get('/notoriety/:characterId/:campaignId', async (req, res) => {
  try {
    const { characterId, campaignId } = req.params;
    const notoriety = await notorietyService.getNotoriety(characterId, campaignId);
    res.json(notoriety);
  } catch (err) {
    handleServerError(res, err, 'fetch notoriety');
  }
});

// POST /api/notoriety — add notoriety (used by session marker detection)
router.post('/notoriety', async (req, res) => {
  try {
    const { characterId, campaignId, source, amount, category, reason } = req.body;
    if (!characterId || !campaignId || !source || amount === undefined) {
      return res.status(400).json({ error: 'characterId, campaignId, source, and amount are required' });
    }
    const entry = await notorietyService.addNotoriety(characterId, campaignId, {
      source, amount, category, reason
    });
    res.json(entry);
  } catch (err) {
    handleServerError(res, err, 'add notoriety');
  }
});

export default router;
