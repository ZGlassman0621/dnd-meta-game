/**
 * AI Behavior diagnostic routes (Phase 4a SC-4a.4).
 *
 * Read-only API surface for the debug page + CLI tool. Wraps the
 * `aiBehaviorSignals.js` and `promptShapeAccounting.js` modules in HTTP
 * endpoints. Per spec §5.2: this is a power-user analysis surface;
 * lightweight visual treatment, no Design pass needed.
 */

import express from 'express';
import { dbAll, dbGet } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import {
  computeAllSignals,
  markerCorrectionLoopHits,
  ruleViolationRates,
  repetitionLedgerTriggers,
  responseLengthDistribution,
  markerEmissionRates,
  nameReuseSignal,
  timeDriftSignal,
  scopeOfInstructionApplication
} from '../services/aiBehaviorSignals.js';
import {
  lengthDistributionForBuilder,
  sectionContributionForBuilder,
  cumulativeContextForSession,
  promptGrowthForSession
} from '../services/promptShapeAccounting.js';

const router = express.Router();

// Filter parsing — accepts query params and turns them into the standard
// filter shape used by the signal functions.
function parseFilter(query = {}) {
  const filter = {};
  if (query.character_id) filter.characterId = parseInt(query.character_id, 10);
  if (query.session_id) filter.sessionId = parseInt(query.session_id, 10);
  if (query.since) filter.sinceIso = String(query.since);
  if (query.until) filter.untilIso = String(query.until);
  if (query.limit) filter.limit = Math.min(parseInt(query.limit, 10) || 200, 5000);
  return filter;
}

// ============================================================
// Listing endpoints
// ============================================================

/**
 * GET /api/ai-behavior/calls
 *   Filtered list of recent AI calls. Returns metadata only — full prompt
 *   and response are accessible via /calls/:id detail endpoint.
 */
router.get('/calls', async (req, res) => {
  try {
    const filter = parseFilter(req.query);
    const where = ['1=1'];
    const args = [];
    if (filter.characterId != null) { where.push('character_id = ?'); args.push(filter.characterId); }
    if (filter.sessionId != null) { where.push('session_id = ?'); args.push(filter.sessionId); }
    if (filter.sinceIso) { where.push('request_started_at >= ?'); args.push(filter.sinceIso); }
    if (filter.untilIso) { where.push('request_started_at <= ?'); args.push(filter.untilIso); }
    if (req.query.purpose) { where.push('call_purpose = ?'); args.push(String(req.query.purpose)); }
    args.push(filter.limit || 200);
    const rows = await dbAll(
      `SELECT id, character_id, campaign_id, session_id, turn_number,
              prompt_builder, call_purpose,
              request_started_at, latency_ms,
              model_id, input_tokens, output_tokens,
              response_status, triggered_correction_loop
       FROM ai_call_log
       WHERE ${where.join(' AND ')}
       ORDER BY request_started_at DESC
       LIMIT ?`,
      args
    );
    res.json({ count: rows.length, calls: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ai-behavior/calls/:id
 *   Full detail for a single AI call — system prompt, user message,
 *   response text, conversation history, marker results, etc.
 */
router.get('/calls/:id', async (req, res) => {
  try {
    const row = await dbGet(`SELECT * FROM ai_call_log WHERE id = ?`, [parseInt(req.params.id, 10)]);
    if (!row) return res.status(404).json({ error: 'AI call not found' });
    // Inflate the JSON columns so the client doesn't need to know to parse.
    row.conversation_history = safeParse(row.conversation_history, []);
    row.prompt_sections = safeParse(row.prompt_sections, []);
    row.markers_detected = safeParse(row.markers_detected, {});
    row.marker_failures = safeParse(row.marker_failures, []);
    row.rule_violations = safeParse(row.rule_violations, []);
    row.metadata = safeParse(row.metadata, {});
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Filter dimensions (for the debug page's filter dropdowns)
// ============================================================

router.get('/dimensions', async (req, res) => {
  try {
    // Distinct character_id / session_id values + counts, plus call_purpose roster.
    const characters = await dbAll(
      `SELECT character_id, COUNT(*) as call_count
       FROM ai_call_log
       WHERE character_id IS NOT NULL
       GROUP BY character_id
       ORDER BY call_count DESC`
    );
    const sessions = await dbAll(
      `SELECT session_id, MIN(character_id) as character_id,
              COUNT(*) as call_count, MAX(request_started_at) as last_at
       FROM ai_call_log
       WHERE session_id IS NOT NULL
       GROUP BY session_id
       ORDER BY last_at DESC
       LIMIT 100`
    );
    const purposes = await dbAll(
      `SELECT call_purpose, COUNT(*) as call_count
       FROM ai_call_log
       GROUP BY call_purpose
       ORDER BY call_count DESC`
    );
    const builders = await dbAll(
      `SELECT prompt_builder, COUNT(*) as call_count
       FROM ai_call_log
       WHERE prompt_builder IS NOT NULL
       GROUP BY prompt_builder
       ORDER BY call_count DESC`
    );
    res.json({ characters, sessions, purposes, builders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Signal endpoints
// ============================================================

router.get('/signals/all', async (req, res) => {
  try { res.json(await computeAllSignals(parseFilter(req.query))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/signals/marker-correction-loop', async (req, res) => {
  try { res.json(await markerCorrectionLoopHits(parseFilter(req.query))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/signals/rule-violations', async (req, res) => {
  try { res.json(await ruleViolationRates(parseFilter(req.query))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/signals/repetition-ledger', async (req, res) => {
  try { res.json(await repetitionLedgerTriggers(parseFilter(req.query))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/signals/response-length', async (req, res) => {
  try { res.json(await responseLengthDistribution(parseFilter(req.query))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/signals/marker-emission', async (req, res) => {
  try { res.json(await markerEmissionRates(parseFilter(req.query))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/signals/name-reuse', async (req, res) => {
  try { res.json(await nameReuseSignal(parseFilter(req.query))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/signals/time-drift', async (req, res) => {
  try { res.json(await timeDriftSignal(parseFilter(req.query))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/signals/scope-of-application', async (req, res) => {
  try { res.json(await scopeOfInstructionApplication(parseFilter(req.query))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// Prompt-shape endpoints (SC-4a.3)
// ============================================================

router.get('/prompt-shape/length-distribution', async (req, res) => {
  try {
    const builder = req.query.builder;
    if (!builder) return res.status(400).json({ error: 'builder query parameter required' });
    res.json(await lengthDistributionForBuilder({ builder, sinceIso: req.query.since }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/prompt-shape/section-contribution', async (req, res) => {
  try {
    const builder = req.query.builder;
    if (!builder) return res.status(400).json({ error: 'builder query parameter required' });
    res.json(await sectionContributionForBuilder({ builder, sinceIso: req.query.since }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/prompt-shape/cumulative-context/:sessionId', async (req, res) => {
  try {
    res.json(await cumulativeContextForSession({ sessionId: parseInt(req.params.sessionId, 10) }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/prompt-shape/growth/:sessionId', async (req, res) => {
  try {
    res.json(await promptGrowthForSession({ sessionId: parseInt(req.params.sessionId, 10) }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
