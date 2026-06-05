/**
 * AI Behavior Signals (Phase 4a SC-4a.2)
 *
 * A set of structured signals derived from production AI behavior,
 * queryable per character, per session, or in aggregate. Per spec §3.2:
 * the signals scaffold the questions Phase 4b will ask. Each signal
 * produces structured data; interpretation requires context. Phase 4a
 * doesn't build alerting — the user reads signals via the debug page
 * (SC-4a.4) when investigating.
 *
 * Each function is pure read-only on `ai_call_log` (and adjacent
 * tables when natural). All functions accept a common filter shape:
 *
 *   { characterId?, sessionId?, sinceIso?, untilIso?, limit? }
 *
 * Eight signals shipped at SC-4a.2:
 *   1. markerCorrectionLoopHits        — turns triggering correction loop
 *   2. ruleViolationRates              — per-call rule violation counts
 *   3. repetitionLedgerTriggers        — repetition-ledger flag rate
 *   4. responseLengthDistribution      — token counts of responses
 *   5. markerEmissionRates             — per-marker-type emission counts
 *   6. nameReuseSignal                 — distinct named NPCs introduced;
 *                                        watches for cross-character reuse
 *   7. timeDriftSignal                 — best-effort detection of time-fact
 *                                        contradictions across turns
 *   8. scopeOfInstructionApplication   — example-as-hard-fact warning
 *                                        (the most important signal per
 *                                        PHASE_4_OVERVIEW.md §6)
 *
 * Per spec §3.3: signals are NOT pass/fail metrics. Each returns a
 * number or distribution; interpretation requires context.
 */

import { dbAll, dbGet } from '../database.js';
import { safeParse } from '../utils/safeParse.js';

// ============================================================
// 1. Marker correction-loop hits (§3.2)
// ============================================================

/**
 * Count of turns where the marker pipeline detected malformed markers and
 * triggered a correction prompt next turn. High rates indicate AI is
 * producing markers it can't validate; might suggest prompt complexity.
 */
export async function markerCorrectionLoopHits(filter = {}) {
  const { where, args } = buildFilter(filter);
  const rows = await dbAll(
    `SELECT id, character_id, session_id, request_started_at, marker_failures
     FROM ai_call_log
     WHERE ${where} AND triggered_correction_loop = 1
     ORDER BY request_started_at DESC
     LIMIT ?`,
    [...args, filter.limit || 200]
  );
  // Rate = correction-loop hits / total qualifying calls
  const totalRow = await dbGet(
    `SELECT COUNT(*) as c FROM ai_call_log WHERE ${where}`,
    args
  );
  const total = totalRow?.c || 0;
  return {
    count: rows.length,
    total_calls: total,
    rate_per_call: total > 0 ? +(rows.length / total).toFixed(4) : 0,
    recent: rows.slice(0, 20).map(r => ({
      id: r.id,
      character_id: r.character_id,
      session_id: r.session_id,
      at: r.request_started_at,
      failures: safeParse(r.marker_failures, [])
    }))
  };
}

// ============================================================
// 2. Rule violation rates (§3.2)
// ============================================================

/**
 * Count of turns where the AI's response triggered any documented rule
 * violation (Cardinal Rule violations, marker validation failures, content
 * rule violations).
 */
export async function ruleViolationRates(filter = {}) {
  const { where, args } = buildFilter(filter);
  const rows = await dbAll(
    `SELECT id, character_id, session_id, rule_violations, request_started_at
     FROM ai_call_log
     WHERE ${where} AND rule_violations IS NOT NULL AND rule_violations != '[]'
     ORDER BY request_started_at DESC
     LIMIT ?`,
    [...args, filter.limit || 200]
  );
  // Bucket violations by rule kind across the filtered scope.
  const byKind = new Map();
  for (const row of rows) {
    const violations = safeParse(row.rule_violations, []);
    if (!Array.isArray(violations)) continue;
    for (const v of violations) {
      const kind = v?.kind || v?.rule || v?.type || 'unknown';
      byKind.set(kind, (byKind.get(kind) || 0) + 1);
    }
  }
  const totalRow = await dbGet(
    `SELECT COUNT(*) as c FROM ai_call_log WHERE ${where}`,
    args
  );
  const total = totalRow?.c || 0;
  return {
    flagged_call_count: rows.length,
    total_calls: total,
    rate_per_call: total > 0 ? +(rows.length / total).toFixed(4) : 0,
    by_kind: Object.fromEntries([...byKind.entries()].sort((a, b) => b[1] - a[1])),
    recent: rows.slice(0, 20).map(r => ({
      id: r.id,
      session_id: r.session_id,
      at: r.request_started_at,
      violations: safeParse(r.rule_violations, [])
    }))
  };
}

// ============================================================
// 3. Repetition-ledger triggers (§3.2)
// ============================================================
//
// The existing repetition-ledger system flags repeated phrasing in DM
// responses. We don't have a dedicated `repetition_*` column on
// `ai_call_log`; the metadata field is the carrier when downstream
// passes record it. For Phase 4a v1 we surface what's in metadata; if
// repetition tracking moves to a dedicated column in Phase 4b, this
// signal updates accordingly.

export async function repetitionLedgerTriggers(filter = {}) {
  const { where, args } = buildFilter(filter);
  const rows = await dbAll(
    `SELECT id, character_id, session_id, request_started_at, metadata, response_text
     FROM ai_call_log
     WHERE ${where}
       AND metadata IS NOT NULL
       AND metadata LIKE '%repetition%'
     ORDER BY request_started_at DESC
     LIMIT ?`,
    [...args, filter.limit || 200]
  );
  const flagged = rows.filter(r => {
    const meta = safeParse(r.metadata, {});
    return meta?.repetition_flagged || meta?.repetition_count > 0;
  });
  return {
    count: flagged.length,
    examples: flagged.slice(0, 20).map(r => ({
      id: r.id,
      session_id: r.session_id,
      at: r.request_started_at,
      metadata: safeParse(r.metadata, {})
    }))
  };
}

// ============================================================
// 4. Response length distribution (§3.2)
// ============================================================

/**
 * Token counts of responses, segmented by call_purpose. Looks for
 * compression patterns ("responses got shorter as session progressed"),
 * bloat patterns ("responses growing unsustainably long"), or tightness
 * patterns ("responses uniformly short — possibly over-constrained").
 */
export async function responseLengthDistribution(filter = {}) {
  const { where, args } = buildFilter(filter);
  const rows = await dbAll(
    `SELECT call_purpose, output_tokens, response_text, request_started_at
     FROM ai_call_log
     WHERE ${where} AND response_status = 'ok'
     ORDER BY request_started_at DESC
     LIMIT ?`,
    [...args, filter.limit || 1000]
  );
  // Group by call_purpose; compute summary per group.
  const buckets = new Map();
  for (const r of rows) {
    const purpose = r.call_purpose || 'unknown';
    if (!buckets.has(purpose)) buckets.set(purpose, []);
    // Prefer API-reported token count; fall back to char/4 estimate.
    const tokens = r.output_tokens != null ? r.output_tokens : Math.ceil((r.response_text || '').length / 4);
    buckets.get(purpose).push(tokens);
  }
  const result = {};
  for (const [purpose, values] of buckets) {
    result[purpose] = summarizeDistribution(values);
  }
  return { call_count: rows.length, by_purpose: result };
}

// ============================================================
// 5. Marker emission rates per type (§3.2)
// ============================================================

/**
 * Count of each marker type emitted, per character, over time. Looks for
 * patterns like "AI stops emitting `[FORTRESS_THREAT]` markers" or
 * "AI emits `[NPC_INTRODUCED]` for the same name across multiple sessions".
 */
export async function markerEmissionRates(filter = {}) {
  const { where, args } = buildFilter(filter);
  const rows = await dbAll(
    `SELECT id, character_id, session_id, markers_detected, request_started_at
     FROM ai_call_log
     WHERE ${where}
       AND markers_detected IS NOT NULL
       AND markers_detected != '{}'
     ORDER BY request_started_at DESC
     LIMIT ?`,
    [...args, filter.limit || 1000]
  );
  const totals = new Map();
  for (const r of rows) {
    const detected = safeParse(r.markers_detected, {});
    if (!detected || typeof detected !== 'object') continue;
    for (const [key, count] of Object.entries(detected)) {
      totals.set(key, (totals.get(key) || 0) + (Number(count) || 0));
    }
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  return {
    call_count: rows.length,
    total_marker_emissions: sorted.reduce((a, [, n]) => a + n, 0),
    by_type: Object.fromEntries(sorted)
  };
}

// ============================================================
// 6. Name-reuse signal (§3.2)
// ============================================================
//
// Track distinct NPC names that surface in `[NPC_INTRODUCED]` markers
// (or via canon-fact rows downstream). Watch for names appearing across
// multiple different characters. The OoDL reference texture has dozens
// of distinct named NPCs; production diverging from that suggests the
// AI has settled into recurring archetypes.
//
// Phase 4a v1 implementation: scan response text for proper-noun-shaped
// tokens that follow common "the [name]" or quote-introduction patterns.
// This is a heuristic; refine in Phase 4b when investigation #2
// (continuity preservation) shapes the right signal exactly.

export async function nameReuseSignal(filter = {}) {
  const { where, args } = buildFilter(filter);
  const rows = await dbAll(
    `SELECT character_id, session_id, response_text, request_started_at
     FROM ai_call_log
     WHERE ${where} AND response_text IS NOT NULL AND character_id IS NOT NULL
     ORDER BY request_started_at DESC
     LIMIT ?`,
    [...args, filter.limit || 500]
  );

  // Per-character set of names seen.
  // Heuristic: capitalized two-or-more-letter words that don't appear
  // in a fixed stoplist. Cross-character reuse = name appears for ≥2
  // distinct character_ids.
  const STOP = new Set([
    'You', 'The', 'And', 'But', 'Or', 'So', 'If', 'Then', 'When', 'Where',
    'What', 'Who', 'Why', 'How', 'It', 'They', 'He', 'She', 'We', 'I',
    'A', 'An', 'In', 'On', 'At', 'To', 'From', 'With', 'For', 'By',
    'Yes', 'No', 'OK', 'Okay', 'DM', 'PC', 'NPC', 'HP', 'AC', 'XP',
    'Roll', 'Save', 'Check', 'Attack', 'Damage', 'Round',
    'Faerun', 'Forgotten', 'Realms', 'Waterdeep'
  ]);
  const NAME_RE = /\b([A-Z][a-z]{2,15})\b/g;

  const namesByCharacter = new Map();  // character_id → Set of names
  for (const r of rows) {
    if (!r.response_text) continue;
    const names = new Set();
    let m;
    while ((m = NAME_RE.exec(r.response_text)) !== null) {
      const name = m[1];
      if (!STOP.has(name)) names.add(name);
    }
    if (!namesByCharacter.has(r.character_id)) {
      namesByCharacter.set(r.character_id, new Set());
    }
    for (const n of names) namesByCharacter.get(r.character_id).add(n);
  }

  // Cross-character reuse — name appears in ≥2 character_id sets.
  const nameToChars = new Map();  // name → Set of character_ids
  for (const [charId, names] of namesByCharacter) {
    for (const n of names) {
      if (!nameToChars.has(n)) nameToChars.set(n, new Set());
      nameToChars.get(n).add(charId);
    }
  }
  const reused = [];
  for (const [name, chars] of nameToChars) {
    if (chars.size >= 2) reused.push({ name, character_ids: [...chars] });
  }

  return {
    distinct_characters: namesByCharacter.size,
    distinct_names: nameToChars.size,
    cross_character_reused: reused.length,
    reused_examples: reused.slice(0, 20),
    per_character_distinct_names: Object.fromEntries(
      [...namesByCharacter.entries()].map(([id, set]) => [id, set.size])
    )
  };
}

// ============================================================
// 7. Time-drift signal (§3.2)
// ============================================================
//
// When the AI states a time-bounded fact (`X arrives in 7 days`,
// `the ward holds for 4 hours`), and the same fact appears later, do
// they agree? Per spec §3.2: this is a hard signal; SC-4a.2 implements
// best-effort. Phase 4b investigation #2 refines.
//
// Heuristic: scan response text for "X in N days" / "N days from now" /
// "after N days" / "lasts N hours" patterns. For each match, key by the
// preceding subject phrase (best-effort), record the duration. Within
// a session, if the same subject reappears with a different duration
// such that the drift exceeds a threshold, flag.

const TIME_PATTERNS = [
  /\b(\w+)\s+(?:arrives?|comes?|will be here|reaches?|gets back)\s+in\s+(\d{1,3})\s+(day|days|hour|hours|week|weeks)\b/gi,
  /\b(?:in|after|within)\s+(\d{1,3})\s+(day|days|hour|hours|week|weeks),\s+(\w+)\s+(?:will|should|may|must)\b/gi,
  /\b(?:the|this)\s+(\w+)\s+(?:lasts?|holds?|holds for|remains? for)\s+(\d{1,3})\s+(day|days|hour|hours|week|weeks)\b/gi
];

function normalizeUnit(unit) {
  unit = unit.toLowerCase();
  if (unit === 'day' || unit === 'days') return 'days';
  if (unit === 'hour' || unit === 'hours') return 'hours';
  if (unit === 'week' || unit === 'weeks') return 'weeks';
  return unit;
}

function extractTimeMentions(text) {
  if (!text || typeof text !== 'string') return [];
  const mentions = [];
  for (const pat of TIME_PATTERNS) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(text)) !== null) {
      // Subject is sometimes m[1], sometimes m[3] depending on the pattern shape.
      const subject = (m[1] && !/^\d+$/.test(m[1])) ? m[1] : (m[3] || 'unknown');
      const value = parseInt(m[2] || m[1], 10);
      const unit = normalizeUnit(m[3] || m[2] || '');
      if (Number.isFinite(value) && unit) {
        mentions.push({ subject: subject.toLowerCase(), value, unit });
      }
    }
  }
  return mentions;
}

export async function timeDriftSignal(filter = {}) {
  const { where, args } = buildFilter(filter);
  const rows = await dbAll(
    `SELECT id, character_id, session_id, response_text, request_started_at
     FROM ai_call_log
     WHERE ${where} AND response_text IS NOT NULL AND session_id IS NOT NULL
     ORDER BY session_id ASC, request_started_at ASC
     LIMIT ?`,
    [...args, filter.limit || 500]
  );

  // Group by session; within each session, build subject → durations[]
  const bySession = new Map();
  for (const r of rows) {
    if (!bySession.has(r.session_id)) bySession.set(r.session_id, []);
    const mentions = extractTimeMentions(r.response_text);
    for (const m of mentions) {
      bySession.get(r.session_id).push({ ...m, callId: r.id, at: r.request_started_at });
    }
  }

  const drifts = [];
  for (const [sessionId, mentions] of bySession) {
    const subjectMap = new Map();  // subject → first mention
    for (const m of mentions) {
      const key = `${m.subject}:${m.unit}`;
      if (!subjectMap.has(key)) {
        subjectMap.set(key, m);
      } else {
        const prior = subjectMap.get(key);
        if (prior.value !== m.value) {
          drifts.push({
            session_id: sessionId,
            subject: m.subject,
            unit: m.unit,
            first_mention: { value: prior.value, callId: prior.callId, at: prior.at },
            later_mention: { value: m.value, callId: m.callId, at: m.at },
            drift: m.value - prior.value
          });
        }
      }
    }
  }

  return {
    session_count: bySession.size,
    drift_count: drifts.length,
    examples: drifts.slice(0, 20)
  };
}

// ============================================================
// 8. Scope-of-instruction-application (§3.5) — most important signal
// ============================================================
//
// Per the example-as-hard-fact warning (PHASE_4_OVERVIEW.md §6): when a
// prompt restriction targets a failure mode by example, measure whether
// the AI follows the broad principle (good) or only the narrow example
// (bad).
//
// Concrete v1 implementation: for the Cardinal Rule "don't speak for the
// player" — known autonomy-violation patterns. Flag responses that
// contain non-example violations (broader pattern violations beyond the
// narrow example).
//
// This is intentionally a starting roster of pattern detectors. Phase 4b
// investigation #1 (constraint audit) refines.

const AUTONOMY_VIOLATION_PATTERNS = [
  // Player-character self-reference attribution
  { kind: 'player_dialogue_attribution', pattern: /\byou (say|tell|whisper|shout|reply|answer|ask|insist|declare|admit|confess|exclaim|murmur|mutter|state|cry|warn)\b/i, broad_principle: "Don't put quoted dialogue in the PC's mouth", narrow_example: "Don't say 'you sit at the table'" },
  { kind: 'player_thought_attribution', pattern: /\byou (think|know|knew|remember|recall|realize|understand|wonder|believe|recognize|decide|choose|prefer)\b/i, broad_principle: "Don't describe the PC's internal state, feelings, or unsaid thoughts", narrow_example: "Don't say 'you sit at the table'" },
  { kind: 'player_emotion_attribution', pattern: /\byou (feel|love|hate|like|enjoy|fear|miss|long for|yearn|despise)\b/i, broad_principle: "Don't describe the PC's feelings", narrow_example: "Don't say 'you sit at the table'" },
  { kind: 'player_physical_action_directive', pattern: /\byou (sit|stand|walk|run|jump|kneel|rise|step|move|turn|lean|reach|grab|take|drop|smile|frown|nod|shrug)\b/i, broad_principle: "Don't direct the PC's body or actions", narrow_example: "Don't say 'you sit at the table'" }
];

export async function scopeOfInstructionApplication(filter = {}) {
  const { where, args } = buildFilter(filter);
  const rows = await dbAll(
    `SELECT id, character_id, session_id, response_text, request_started_at
     FROM ai_call_log
     WHERE ${where} AND response_text IS NOT NULL AND response_status = 'ok'
     ORDER BY request_started_at DESC
     LIMIT ?`,
    [...args, filter.limit || 500]
  );

  const byKind = new Map();
  const flaggedCalls = [];

  for (const r of rows) {
    const text = r.response_text || '';
    const hits = [];
    for (const detector of AUTONOMY_VIOLATION_PATTERNS) {
      const m = text.match(detector.pattern);
      if (m) {
        byKind.set(detector.kind, (byKind.get(detector.kind) || 0) + 1);
        hits.push({
          kind: detector.kind,
          snippet: text.slice(Math.max(0, m.index - 30), Math.min(text.length, m.index + 80)),
          broad_principle: detector.broad_principle
        });
      }
    }
    if (hits.length > 0) {
      flaggedCalls.push({
        id: r.id,
        character_id: r.character_id,
        session_id: r.session_id,
        at: r.request_started_at,
        hits
      });
    }
  }

  return {
    call_count: rows.length,
    flagged_call_count: flaggedCalls.length,
    rate_per_call: rows.length > 0 ? +(flaggedCalls.length / rows.length).toFixed(4) : 0,
    by_kind: Object.fromEntries([...byKind.entries()].sort((a, b) => b[1] - a[1])),
    examples: flaggedCalls.slice(0, 20),
    note: 'v1 implementation per spec §3.5 — best-effort detection; refinement in Phase 4b investigation #1.'
  };
}

// ============================================================
// Helpers
// ============================================================

function buildFilter({ characterId, sessionId, sinceIso, untilIso } = {}) {
  const clauses = ['1=1'];
  const args = [];
  if (characterId != null) { clauses.push('character_id = ?'); args.push(characterId); }
  if (sessionId != null) { clauses.push('session_id = ?'); args.push(sessionId); }
  if (sinceIso) { clauses.push('request_started_at >= ?'); args.push(sinceIso); }
  if (untilIso) { clauses.push('request_started_at <= ?'); args.push(untilIso); }
  return { where: clauses.join(' AND '), args };
}

function summarizeDistribution(values) {
  if (!values || values.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, median: 0, p90: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(sum / sorted.length),
    median: sorted[Math.floor(sorted.length / 2)],
    p90: pct(0.9)
  };
}

// ============================================================
// Orchestration helper — compute all signals for a single scope
// ============================================================

/**
 * Run all primary signals for a single filter scope. Convenience for the
 * debug page (SC-4a.4) and CLI tool — composes the eight signals into a
 * single result object.
 */
export async function computeAllSignals(filter = {}) {
  const [
    correctionLoop, ruleViolations, repetition, lengthDist,
    markerEmission, nameReuse, timeDrift, scopeApplication
  ] = await Promise.all([
    markerCorrectionLoopHits(filter),
    ruleViolationRates(filter),
    repetitionLedgerTriggers(filter),
    responseLengthDistribution(filter),
    markerEmissionRates(filter),
    nameReuseSignal(filter),
    timeDriftSignal(filter),
    scopeOfInstructionApplication(filter)
  ]);
  return {
    filter,
    signals: {
      marker_correction_loop_hits: correctionLoop,
      rule_violation_rates: ruleViolations,
      repetition_ledger_triggers: repetition,
      response_length_distribution: lengthDist,
      marker_emission_rates: markerEmission,
      name_reuse: nameReuse,
      time_drift: timeDrift,
      scope_of_instruction_application: scopeApplication
    }
  };
}
