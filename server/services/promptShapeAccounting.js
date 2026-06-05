/**
 * Prompt-Shape Accounting (Phase 4a SC-4a.3)
 *
 * Visibility into the prompts themselves — section anatomy, length
 * distribution, growth patterns. Per spec §4.2: Phase 4b's constraint
 * audit needs to know what the prompts actually are to evaluate them
 * against current evidence.
 *
 * Section-boundary inference is **heuristic** (Q5 / spec §4.4):
 * regex on existing prompt builders' output rather than modifying each
 * builder to emit structured breakdowns. Heuristic is fine for v1; exact
 * builder annotation is a future ship if accuracy proves insufficient.
 *
 * Token counting uses a cheap character-based estimate (≈ chars/4 for
 * Claude/GPT-family tokenizers). Where the API returns actual token
 * counts (in `data.usage`), captured per-call those land in dedicated
 * `input_tokens`/`output_tokens` columns; this estimator is for the
 * pre-API breakdown stored in `prompt_sections`.
 */

import { dbAll, dbGet } from '../database.js';
import { safeParse } from '../utils/safeParse.js';

// ============================================================
// Tokenization estimate (heuristic)
// ============================================================
//
// Real Claude tokenizer averages ~4 chars/token for English prose, lower
// (~2-3 chars/token) for code/structured text, higher (~5+) for very
// repetitive or whitespace-heavy text. This estimator is good enough for
// the section-relative-share question Phase 4 asks; exact counts come
// from API usage when available.

export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  // Empirically tuned: sample of dmPromptBuilder output averaged 3.7
  // chars/token in practice across mixed content (markdown structure +
  // English prose + code-fence-style markers). Round to 4 for simplicity.
  return Math.ceil(text.length / 4);
}

// ============================================================
// Section-boundary inference (heuristic)
// ============================================================
//
// The prompt builders use a recognizable pattern of `=== SECTION NAME ===`
// markers (consistent across `dmPromptBuilder.js`, `dmModePromptBuilder.js`,
// and `preludeArcPromptBuilder.js`). Some sections also use uppercase
// header lines without the equals decoration ("CARDINAL RULES:", "WORLD
// SETTING:", "ACTIVE QUESTS:" etc.). The inference recognizes both.
//
// A "section" runs from a header line up to (but not including) the next
// header line. Content before the first recognized header gets bucketed
// as `'preamble'`. Content with no headers at all becomes a single
// `'unstructured'` section. The output preserves source order.

const SECTION_HEADER_PATTERNS = [
  // === SECTION NAME ===  (matches both opening and END markers; END
  // markers function as section closes, naturally absorbed into the
  // next section's start-of-segment by the splitter).
  /^=== ([^=]+?) ===\s*$/,
  // ALL-CAPS HEADER:  (must be at line start, ≥ 3 letters, end with colon)
  /^([A-Z][A-Z0-9 \-/&]{2,80}):\s*$/,
  // **Bold header** (markdown style, also used in some builders)
  /^\*\*([^*]{3,80})\*\*\s*$/,
  // # Markdown headings (rare but used in some builders)
  /^#{1,3}\s+(.+?)\s*$/
];

function inferSectionName(line) {
  for (const pat of SECTION_HEADER_PATTERNS) {
    const m = line.match(pat);
    if (m) {
      return normalizeSectionName(m[1]);
    }
  }
  return null;
}

function normalizeSectionName(raw) {
  // Slugify: lowercase, collapse whitespace + non-word chars to `_`,
  // strip leading/trailing underscores. Stable across the END-marker
  // variants (`END WORLD STATE` → `end_world_state`).
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

/**
 * Compute the section breakdown of a system prompt.
 *
 * @param {string} prompt        — the full system prompt text
 * @param {string} [builder]     — optional prompt-builder hint for context-aware
 *                                  inference. (Currently unused; reserved for a
 *                                  future ship that wants per-builder rules.)
 * @returns {Array<{name, chars, tokens, line_start, line_end}>}
 */
export function computePromptSections(prompt, builder = null) {
  if (!prompt || typeof prompt !== 'string') return [];
  const lines = prompt.split('\n');
  const sections = [];
  let current = { name: 'preamble', startLine: 0, content: [] };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerName = inferSectionName(line);
    if (headerName) {
      // Close the current section, open a new one. The header line itself
      // is included in the new section's content (it's part of the section
      // it announces, semantically).
      if (current.content.length > 0) {
        sections.push(finalizeSection(current, i - 1));
      }
      current = { name: headerName, startLine: i, content: [line] };
    } else {
      current.content.push(line);
    }
  }
  // Final section
  if (current.content.length > 0) {
    sections.push(finalizeSection(current, lines.length - 1));
  }

  // Strip empty preamble (very common — most prompts start with a header).
  const cleaned = sections.filter(s => !(s.name === 'preamble' && s.chars === 0));
  return cleaned.length > 0 ? cleaned : sections;
}

function finalizeSection(section, endLine) {
  const text = section.content.join('\n');
  return {
    name: section.name,
    chars: text.length,
    tokens: estimateTokens(text),
    line_start: section.startLine,
    line_end: endLine
  };
}

// ============================================================
// Aggregation queries (§4.4)
// ============================================================
//
// Each function takes filter parameters (per-builder, per-character,
// per-session, time range) and returns structured aggregates.

/**
 * Distribution of total prompt length across calls for a builder.
 */
export async function lengthDistributionForBuilder({ builder, sinceIso = null, limit = 10000 } = {}) {
  if (!builder) throw new Error('lengthDistributionForBuilder: builder required');
  const where = ['prompt_builder = ?'];
  const args = [builder];
  if (sinceIso) { where.push('request_started_at >= ?'); args.push(sinceIso); }
  args.push(limit);
  const rows = await dbAll(
    `SELECT input_tokens, system_prompt
     FROM ai_call_log
     WHERE ${where.join(' AND ')}
     ORDER BY request_started_at DESC
     LIMIT ?`,
    args
  );
  const tokenCounts = rows.map(r => r.input_tokens ?? estimateTokens(r.system_prompt || '')).filter(n => n > 0);
  return summarizeDistribution(tokenCounts);
}

/**
 * Average section contribution (% of prompt) per builder, across the
 * filtered scope. Useful for the question "Cardinal Rules section is
 * what fraction of an average dmPromptBuilder call?"
 */
export async function sectionContributionForBuilder({ builder, sinceIso = null, limit = 1000 } = {}) {
  if (!builder) throw new Error('sectionContributionForBuilder: builder required');
  const where = ['prompt_builder = ?', 'prompt_sections IS NOT NULL'];
  const args = [builder];
  if (sinceIso) { where.push('request_started_at >= ?'); args.push(sinceIso); }
  args.push(limit);
  const rows = await dbAll(
    `SELECT prompt_sections, input_tokens
     FROM ai_call_log
     WHERE ${where.join(' AND ')}
     ORDER BY request_started_at DESC
     LIMIT ?`,
    args
  );

  // Sum tokens per section name across rows; sum totals; compute share.
  const sectionTotals = new Map();
  let totalTokens = 0;
  let callCount = 0;
  for (const row of rows) {
    const sections = safeParse(row.prompt_sections, []);
    if (!Array.isArray(sections) || sections.length === 0) continue;
    callCount++;
    const callTotal = sections.reduce((a, s) => a + (s.tokens || 0), 0);
    totalTokens += callTotal;
    for (const s of sections) {
      sectionTotals.set(s.name, (sectionTotals.get(s.name) || 0) + (s.tokens || 0));
    }
  }
  const breakdown = [];
  for (const [name, sum] of sectionTotals) {
    breakdown.push({
      name,
      avg_tokens: callCount > 0 ? Math.round(sum / callCount) : 0,
      share_pct: totalTokens > 0 ? +((sum / totalTokens) * 100).toFixed(2) : 0
    });
  }
  breakdown.sort((a, b) => b.avg_tokens - a.avg_tokens);
  return { call_count: callCount, total_tokens: totalTokens, sections: breakdown };
}

/**
 * Cumulative token usage across a session (input + output across turns).
 * Phase 4b: useful for "did this session approach the context cap?"
 */
export async function cumulativeContextForSession({ sessionId } = {}) {
  if (!sessionId) throw new Error('cumulativeContextForSession: sessionId required');
  const rows = await dbAll(
    `SELECT id, request_started_at, turn_number, input_tokens, output_tokens
     FROM ai_call_log
     WHERE session_id = ?
     ORDER BY request_started_at ASC`,
    [sessionId]
  );
  let cumulative_input = 0;
  let cumulative_output = 0;
  const trajectory = rows.map(r => {
    cumulative_input += (r.input_tokens || 0);
    cumulative_output += (r.output_tokens || 0);
    return {
      id: r.id,
      turn: r.turn_number,
      at: r.request_started_at,
      input_tokens: r.input_tokens || 0,
      output_tokens: r.output_tokens || 0,
      cumulative_input,
      cumulative_output,
      cumulative_total: cumulative_input + cumulative_output
    };
  });
  return {
    call_count: rows.length,
    final_cumulative_input: cumulative_input,
    final_cumulative_output: cumulative_output,
    final_cumulative_total: cumulative_input + cumulative_output,
    trajectory
  };
}

/**
 * Prompt-length growth pattern within a session — does the system prompt
 * itself (not conversation history) grow as the session progresses?
 * Useful for catching unbounded state-injection.
 */
export async function promptGrowthForSession({ sessionId } = {}) {
  if (!sessionId) throw new Error('promptGrowthForSession: sessionId required');
  const rows = await dbAll(
    `SELECT id, turn_number, request_started_at, input_tokens, system_prompt
     FROM ai_call_log
     WHERE session_id = ?
     ORDER BY request_started_at ASC`,
    [sessionId]
  );
  const points = rows.map(r => ({
    id: r.id,
    turn: r.turn_number,
    at: r.request_started_at,
    system_prompt_tokens: estimateTokens(r.system_prompt || ''),
    input_tokens: r.input_tokens || 0
  }));
  if (points.length < 2) return { call_count: points.length, growth_per_turn: null, points };
  // Slope of system_prompt tokens vs turn number — simple linear regression
  // (or first-vs-last delta if turns aren't dense). Phase 4b can refine.
  const first = points[0];
  const last = points[points.length - 1];
  const turns = (last.turn || points.length) - (first.turn || 1);
  const growthDelta = last.system_prompt_tokens - first.system_prompt_tokens;
  const growth_per_turn = turns > 0 ? Math.round(growthDelta / turns) : null;
  return {
    call_count: points.length,
    first_prompt_tokens: first.system_prompt_tokens,
    last_prompt_tokens: last.system_prompt_tokens,
    growth_per_turn,
    points
  };
}

// ============================================================
// Helpers
// ============================================================

function summarizeDistribution(values) {
  if (!values || values.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, median: 0, p90: 0, p99: 0 };
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
    p90: pct(0.9),
    p99: pct(0.99)
  };
}
