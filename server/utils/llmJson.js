/**
 * Robust JSON extraction from LLM responses.
 *
 * LLMs (Opus especially) don't always honour "respond with a single JSON
 * object, no preamble" perfectly. We've seen:
 *   • JSON wrapped in ```json fences
 *   • Preamble prose before the JSON ("Here's the plan:")
 *   • Two top-level objects emitted back-to-back
 *     (e.g. a standalone tone_reflection object followed by the main body)
 *   • Trailing commas inside arrays/objects
 *   • Brace-like characters inside string values
 *
 * All the ad-hoc parsers in server/services/* handled these partially and
 * each had at least one class of bug. This utility replaces them with one
 * string-aware brace matcher and predictable behaviour.
 *
 *   import { extractLLMJson } from '../utils/llmJson.js';
 *
 *   const plan = extractLLMJson(raw);                      // object, auto-merge
 *   const list = extractLLMJson(raw, { expect: 'array' }); // array
 *   const one  = extractLLMJson(raw, { merge: false });    // first object only
 *
 * Throws a descriptive Error on failure. Callers should wrap with their
 * own context (operation name, raw-response preview for debugging) if a
 * dev needs to see where it came from.
 */

/**
 * Strip leading prose and ```fenced blocks, returning the meaningful tail.
 */
function stripWrappers(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty or non-string LLM response');
  }
  let text = raw.trim();

  // ``` or ```json ... ```
  if (text.startsWith('```')) {
    const firstNl = text.indexOf('\n');
    if (firstNl > 0) text = text.slice(firstNl + 1);
    if (text.endsWith('```')) text = text.slice(0, -3);
    text = text.trim();
  }

  return text;
}

/**
 * Walk `text` and return all balanced top-level delimiter blocks of type
 * `open`/`close` (e.g. `{`/`}` or `[`/`]`), respecting JSON string
 * quoting. Braces/brackets inside "..." strings do not shift depth.
 */
function findBalancedBlocks(text, open, close) {
  const blocks = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let blockStart = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = false; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === open) {
      if (depth === 0) blockStart = i;
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0 && blockStart !== -1) {
        blocks.push(text.slice(blockStart, i + 1));
        blockStart = -1;
      } else if (depth < 0) {
        // Stray close — reset defensively and keep scanning.
        depth = 0;
      }
    }
  }
  return blocks;
}

/**
 * Repair common JSON hiccups LLMs emit:
 *   • trailing commas before } or ]
 *
 * Kept conservative — we don't try to fix unclosed strings or auto-quote
 * keys, because those tend to mask real prompt bugs that deserve a fix
 * upstream rather than a silent patch.
 */
function repairCommonIssues(jsonText) {
  return jsonText.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Extract a JSON value from an LLM response.
 *
 * @param {string} raw                 - Raw LLM output.
 * @param {object} [opts]
 * @param {'object'|'array'} [opts.expect='object']
 *     Shape to look for. For 'object', finds all balanced {...} blocks.
 *     For 'array', finds the first balanced [...] block.
 * @param {boolean} [opts.merge=true]
 *     Only applies to expect='object'. When multiple top-level objects
 *     are found, shallow-merges them (later keys override earlier). When
 *     false, returns the first parsed object.
 * @param {boolean} [opts.repair=true] - Apply trailing-comma repair.
 * @returns {*} Parsed JSON value.
 * @throws {Error} If no parseable block matches.
 */
export function extractLLMJson(raw, opts = {}) {
  const { expect = 'object', merge = true, repair = true } = opts;
  const text = stripWrappers(raw);

  if (expect === 'array') {
    const blocks = findBalancedBlocks(text, '[', ']');
    if (blocks.length === 0) {
      throw new Error('No JSON array found in response');
    }
    const candidate = repair ? repairCommonIssues(blocks[0]) : blocks[0];
    try {
      return JSON.parse(candidate);
    } catch (err) {
      throw new Error(`JSON array parse failed: ${err.message}`);
    }
  }

  const blocks = findBalancedBlocks(text, '{', '}');
  if (blocks.length === 0) {
    throw new Error('No JSON object found in response');
  }

  const parsed = [];
  const errors = [];
  for (const s of blocks) {
    const candidate = repair ? repairCommonIssues(s) : s;
    try { parsed.push(JSON.parse(candidate)); }
    catch (err) { errors.push(err.message); }
  }
  if (parsed.length === 0) {
    throw new Error(
      `No parseable JSON object in response ` +
      `(${blocks.length} candidate block(s); first error: ${errors[0]})`
    );
  }

  if (!merge || parsed.length === 1) return parsed[0];
  return Object.assign({}, ...parsed);
}

/**
 * Best-effort extract for paths that prefer a fallback over a throw.
 * Returns the parsed value, or `fallback` if extraction failed.
 */
export function tryExtractLLMJson(raw, fallback = null, opts = {}) {
  try { return extractLLMJson(raw, opts); }
  catch { return fallback; }
}
