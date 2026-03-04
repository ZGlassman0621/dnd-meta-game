import express from 'express';
import * as partyBaseService from '../services/partyBaseService.js';
import * as longTermProjectService from '../services/longTermProjectService.js';
import * as notorietyService from '../services/notorietyService.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

// ─── Party Base ───────────────────────────────────────────

// GET /api/base/:characterId/:campaignId — fetch base with upgrades
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

// POST /api/base — create a new base
router.post('/base', async (req, res) => {
  try {
    const { characterId, campaignId, name, base_type, location_id, description } = req.body;
    if (!characterId || !campaignId || !name || !base_type) {
      return res.status(400).json({ error: 'characterId, campaignId, name, and base_type are required' });
    }
    const base = await partyBaseService.createBase(characterId, campaignId, {
      name, base_type, location_id, description
    });
    res.status(201).json(base);
  } catch (err) {
    if (err.message?.includes('already has a base')) {
      return res.status(409).json({ error: err.message });
    }
    handleServerError(res, err, 'create party base');
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

// GET /api/base/:baseId/upgrades/available — available upgrade catalog
router.get('/base/:baseId/upgrades/available', async (req, res) => {
  try {
    const upgrades = await partyBaseService.getAvailableUpgrades(req.params.baseId);
    res.json(upgrades);
  } catch (err) {
    handleServerError(res, err, 'fetch available upgrades');
  }
});

// POST /api/base/:baseId/upgrades — start an upgrade
router.post('/base/:baseId/upgrades', async (req, res) => {
  try {
    const { upgradeKey, level } = req.body;
    if (!upgradeKey) return res.status(400).json({ error: 'upgradeKey is required' });
    const upgrade = await partyBaseService.startUpgrade(req.params.baseId, upgradeKey, level);
    res.status(201).json(upgrade);
  } catch (err) {
    if (err.message?.includes('Not enough') || err.message?.includes('No upgrade slot') || err.message?.includes('not found')) {
      return res.status(400).json({ error: err.message });
    }
    handleServerError(res, err, 'start upgrade');
  }
});

// POST /api/base/:baseId/upgrades/:upgradeId/advance — add hours to upgrade
router.post('/base/:baseId/upgrades/:upgradeId/advance', async (req, res) => {
  try {
    const { hours } = req.body;
    if (!hours || hours <= 0) return res.status(400).json({ error: 'hours must be a positive number' });
    const result = await partyBaseService.advanceUpgrade(req.params.upgradeId, hours);
    res.json(result);
  } catch (err) {
    handleServerError(res, err, 'advance upgrade');
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
