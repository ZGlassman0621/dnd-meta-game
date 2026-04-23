/**
 * Prelude API routes.
 *
 * Phase 1 endpoints:
 *   POST /api/prelude/setup         Create a new prelude-phase character
 *                                   from the 12-question setup wizard.
 *   GET  /api/prelude/list          List all prelude-phase characters.
 *   GET  /api/prelude/:characterId  Fetch a single prelude character with
 *                                   parsed setup data.
 *
 * Later phases will add: arc-plan generation (/arc-plan), session
 * lifecycle (/sessions), emergence handling (/emergences), transition
 * (/end-prelude). Keeping those off the surface until the relevant phase
 * ships keeps the API clean.
 */

import express from 'express';
import {
  createPreludeCharacter,
  getPreludeCharacter,
  listPreludeCharacters
} from '../services/preludeService.js';
import {
  generateArcPlan,
  getArcPlan,
  canRegenerate
} from '../services/preludeArcService.js';
import {
  startSession as startPreludeSession,
  getActiveSession,
  getResumePayload,
  sendMessage as sendPreludeMessage,
  endSession as endPreludeSession,
  resumeSession as resumePreludeSession
} from '../services/preludeSessionService.js';
import * as emergenceService from '../services/preludeEmergenceService.js';
import * as canonService from '../services/preludeCanonService.js';
import * as themeService from '../services/preludeThemeService.js';
import { stripPreludeMarkers } from '../services/preludeMarkerDetection.js';
import { handleServerError, notFound, validationError } from '../utils/errorHandler.js';

const router = express.Router();

/**
 * POST /api/prelude/setup
 * Body: the full 12-answer setup payload. See `preludeService.validateSetupPayload`
 * for field requirements.
 * Returns: the created prelude character row (with `creation_phase='prelude'`).
 */
router.post('/setup', async (req, res) => {
  try {
    const character = await createPreludeCharacter(req.body);
    res.status(201).json(character);
  } catch (err) {
    if (err && err.message && err.message.startsWith('Invalid setup:')) {
      return validationError(res, err.message);
    }
    handleServerError(res, err, 'create prelude character');
  }
});

/**
 * GET /api/prelude/list
 * Returns every prelude-phase character in the database. Used by the
 * character manager to surface in-progress preludes alongside finished
 * characters.
 */
router.get('/list', async (req, res) => {
  try {
    const rows = await listPreludeCharacters();
    res.json(rows);
  } catch (err) {
    handleServerError(res, err, 'list prelude characters');
  }
});

/**
 * GET /api/prelude/:characterId
 * Returns a single prelude character with parsed setup data.
 * 404 if the row doesn't exist or isn't in prelude phase.
 */
router.get('/:characterId', async (req, res) => {
  try {
    const character = await getPreludeCharacter(req.params.characterId);
    if (!character) return notFound(res, 'Prelude character');
    res.json(character);
  } catch (err) {
    handleServerError(res, err, 'fetch prelude character');
  }
});

/**
 * POST /api/prelude/:characterId/arc-plan
 * Generate the arc plan for a prelude character. Uses Opus; ~1-2k tokens out.
 * Initial generation (no existing plan) or explicit re-roll when the
 * `?regenerate=1` query param is set. Returns the parsed arc plan.
 */
router.post('/:characterId/arc-plan', async (req, res) => {
  try {
    const characterId = req.params.characterId;
    const character = await getPreludeCharacter(characterId);
    if (!character) return notFound(res, 'Prelude character');
    const isRegeneration = req.query.regenerate === '1' || req.body?.regenerate === true;
    const plan = await generateArcPlan(characterId, { isRegeneration });
    // Include the re-roll eligibility flag in the POST response too (GET
    // already did). Without this, the client hides the re-roll button
    // after the first generation because `plan.can_regenerate` is undefined.
    const regenEligible = await canRegenerate(characterId);
    res.json({ ...plan, can_regenerate: regenEligible });
  } catch (err) {
    if (err && err.message && err.message.includes('re-roll limit')) {
      return validationError(res, err.message);
    }
    handleServerError(res, err, 'generate arc plan');
  }
});

/**
 * GET /api/prelude/:characterId/arc-plan
 * Returns the stored arc plan for a prelude character, or 404 if not
 * yet generated. Includes `can_regenerate` flag so the UI can decide
 * whether to show the re-roll button.
 */
router.get('/:characterId/arc-plan', async (req, res) => {
  try {
    const characterId = req.params.characterId;
    const plan = await getArcPlan(characterId);
    if (!plan) return notFound(res, 'Arc plan');
    const regenEligible = await canRegenerate(characterId);
    res.json({ ...plan, can_regenerate: regenEligible });
  } catch (err) {
    handleServerError(res, err, 'fetch arc plan');
  }
});

// ==========================================================================
// Session endpoints (Phase 2b-i)
// ==========================================================================

/**
 * POST /api/prelude/:characterId/sessions/start
 * Start a new prelude session. Rejects if one is already active (the UI
 * should call GET /sessions/active first and route to resume if so).
 * Returns { sessionId, opening, runtime }.
 */
router.post('/:characterId/sessions/start', async (req, res) => {
  try {
    const session = await startPreludeSession(req.params.characterId);
    res.status(201).json({
      sessionId: session.sessionId,
      title: session.title,
      opening: stripPreludeMarkers(session.opening),
      runtime: session.runtime
    });
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('already active') || msg.includes('not in prelude phase') || msg.includes('Arc plan not generated')) {
      return validationError(res, msg);
    }
    if (msg.includes('not found')) return notFound(res, 'Prelude character');
    handleServerError(res, err, 'start prelude session');
  }
});

/**
 * GET /api/prelude/:characterId/sessions/active
 * Returns the active prelude session for this character, or 404. Lets
 * the UI decide between "Begin" and "Resume" on click.
 */
router.get('/:characterId/sessions/active', async (req, res) => {
  try {
    const session = await getActiveSession(req.params.characterId);
    if (!session) return notFound(res, 'Active prelude session');
    res.json(session);
  } catch (err) {
    handleServerError(res, err, 'fetch active prelude session');
  }
});

/**
 * GET /api/prelude/sessions/:sessionId
 * Full payload for resuming a specific session — messages history,
 * character, runtime, last cliffhanger.
 */
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const payload = await getResumePayload(req.params.sessionId);
    // Strip markers from assistant messages for display — the server needs
    // the raw text for Sonnet's context, but the UI only wants clean narrative.
    const cleanedMessages = payload.messages.map(m =>
      m.role === 'assistant'
        ? { ...m, content: stripPreludeMarkers(m.content) }
        : m
    );
    res.json({ ...payload, messages: cleanedMessages });
  } catch (err) {
    if (String(err?.message || '').includes('not found')) return notFound(res, 'Prelude session');
    handleServerError(res, err, 'fetch prelude session');
  }
});

/**
 * POST /api/prelude/sessions/:sessionId/message
 * Send a player action, get Sonnet's response. Processes markers server-side
 * and returns { response (markers stripped), runtime, sessionEnded, markers }.
 */
router.post('/sessions/:sessionId/message', async (req, res) => {
  try {
    const { action, model } = req.body || {};
    if (!action || typeof action !== 'string' || !action.trim()) {
      return validationError(res, 'action is required');
    }
    const modelOverride = (model === 'sonnet' || model === 'opus' || model === 'auto') ? model : null;
    const result = await sendPreludeMessage(req.params.sessionId, action.trim(), modelOverride);
    res.json({
      response: stripPreludeMarkers(result.response),
      runtime: result.runtime,
      sessionEnded: result.sessionEnded,
      model: result.model,
      resolvedModel: result.resolvedModel,
      resolveReason: result.resolveReason,
      // markers carries the processed marker events the UI wants to surface
      // (HP changes, chapter advance, chapter promise, recap on pause, etc.).
      markers: result.markers
    });
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('not found')) return notFound(res, 'Prelude session');
    if (msg.includes('already completed')) return validationError(res, msg);
    handleServerError(res, err, 'send prelude message');
  }
});

/**
 * POST /api/prelude/sessions/:sessionId/end
 * End a prelude session. Defaults to 'paused' (resumable). Pass
 * { completed: true } to mark it fully done — reserved for Phase 5's
 * [PRELUDE_END] transition flow.
 */
router.post('/sessions/:sessionId/end', async (req, res) => {
  try {
    const completed = !!req.body?.completed;
    const result = await endPreludeSession(req.params.sessionId, { completed });
    res.json(result);
  } catch (err) {
    if (String(err?.message || '').includes('not found')) return notFound(res, 'Prelude session');
    handleServerError(res, err, 'end prelude session');
  }
});

/**
 * POST /api/prelude/sessions/:sessionId/resume
 * Flip a paused session back to active so sendMessage is allowed. No-op
 * if already active. Rejects with 400 if the session is completed.
 */
router.post('/sessions/:sessionId/resume', async (req, res) => {
  try {
    const result = await resumePreludeSession(req.params.sessionId);
    res.json(result);
  } catch (err) {
    const msg = String(err?.message || '');
    if (msg.includes('not found')) return notFound(res, 'Prelude session');
    if (msg.includes('completed')) return validationError(res, msg);
    handleServerError(res, err, 'resume prelude session');
  }
});

// ==========================================================================
// Emergence endpoints (Phase 3)
// ==========================================================================

/**
 * GET /api/prelude/:characterId/emergences/offered
 * All stat/skill offers currently awaiting player decision.
 */
router.get('/:characterId/emergences/offered', async (req, res) => {
  try {
    const rows = await emergenceService.getOfferedEmergences(req.params.characterId);
    res.json(rows);
  } catch (err) {
    handleServerError(res, err, 'fetch offered emergences');
  }
});

/**
 * POST /api/prelude/:characterId/emergences/:emergenceId/accept
 * Accept an offered stat or skill emergence.
 */
router.post('/:characterId/emergences/:emergenceId/accept', async (req, res) => {
  try {
    const result = await emergenceService.acceptEmergence(req.params.characterId, req.params.emergenceId);
    res.json(result);
  } catch (err) {
    const msg = String(err?.message || '');
    if (msg.includes('not found')) return notFound(res, 'Emergence');
    if (msg.includes('Cannot accept')) return validationError(res, msg);
    handleServerError(res, err, 'accept emergence');
  }
});

/**
 * POST /api/prelude/:characterId/emergences/:emergenceId/decline
 * Decline an offered emergence. Body: { permanent: boolean } — when true,
 * the same target will be rejected outright in future hint firings.
 */
router.post('/:characterId/emergences/:emergenceId/decline', async (req, res) => {
  try {
    const permanent = !!req.body?.permanent;
    const result = await emergenceService.declineEmergence(
      req.params.characterId,
      req.params.emergenceId,
      { permanent }
    );
    res.json(result);
  } catch (err) {
    const msg = String(err?.message || '');
    if (msg.includes('not found')) return notFound(res, 'Emergence');
    if (msg.includes('Cannot decline')) return validationError(res, msg);
    handleServerError(res, err, 'decline emergence');
  }
});

/**
 * GET /api/prelude/:characterId/values
 * Current rolling values tally for the Setup panel.
 */
router.get('/:characterId/values', async (req, res) => {
  try {
    const rows = await emergenceService.getValues(req.params.characterId);
    res.json(rows);
  } catch (err) {
    handleServerError(res, err, 'fetch values');
  }
});

/**
 * GET /api/prelude/:characterId/canon-facts
 * Active canon ledger for the Setup panel. Grouped by category for
 * convenient rendering.
 */
router.get('/:characterId/canon-facts', async (req, res) => {
  try {
    const rows = await canonService.getActiveCanonFacts(req.params.characterId);
    res.json(rows);
  } catch (err) {
    handleServerError(res, err, 'fetch canon facts');
  }
});

/**
 * v1.0.77 — Theme commitment endpoints.
 *
 * The flow:
 *   1. At Ch3 wrap-up the AI emits [THEME_COMMITMENT_OFFERED] and the
 *      session-send response carries `markers.themeCommitmentOffer` with
 *      the authoritative offer (built server-side from the trajectory
 *      tally + setup wildcards).
 *   2. Client renders a Choose Your Path card and, when the player picks,
 *      posts here with the theme id (or null = defer).
 *   3. GET endpoint exists for debugging / future rehydration.
 */
router.post('/:characterId/commit-theme', async (req, res) => {
  try {
    const { theme, reason, source } = req.body || {};
    const result = await themeService.commitTheme(req.params.characterId, {
      theme: theme === undefined ? null : theme,  // allow explicit null = defer
      reason: reason || null,
      source: source || 'unknown'
    });
    res.json(result);
  } catch (err) {
    if (err.message && err.message.startsWith('Unknown theme id:')) {
      return validationError(res, err.message);
    }
    handleServerError(res, err, 'commit theme');
  }
});

router.get('/:characterId/committed-theme', async (req, res) => {
  try {
    const row = await themeService.getCommittedTheme(req.params.characterId);
    res.json(row || { theme: null, committed_at: null });
  } catch (err) {
    handleServerError(res, err, 'fetch committed theme');
  }
});

/**
 * Rebuild the current theme offer (leading + alternatives + wildcard).
 * Used by the UI to rehydrate the Choose Your Path card if the player
 * navigates away and returns before committing.
 */
router.get('/:characterId/theme-offer', async (req, res) => {
  try {
    const offer = await themeService.buildThemeOffer(req.params.characterId);
    res.json(offer);
  } catch (err) {
    handleServerError(res, err, 'build theme offer');
  }
});

export default router;
