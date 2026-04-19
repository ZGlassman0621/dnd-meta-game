/**
 * Repetition Ledger Service (Pillar 5)
 *
 * Tracks distinctive imagery (similes) used in AI responses across a session
 * so the next prompt can tell the DM "you already used these — find fresh
 * images." Solves the playtest failure where the AI reuses phrases like
 * "skinny as a pulled thread" across multiple descriptions.
 *
 * Scope (from design discussion):
 *   STRICT  — on imagery / simile / distinctive descriptive metaphor.
 *   LOOSE   — on functional language ("the door opens", "he sits down").
 *
 * We only track similes ("X as Y", "like X") because:
 *   1. They're high-signal for the actual repetition complaint.
 *   2. They're easy to extract with regex (no LLM call needed).
 *   3. False positives are low — functional language rarely uses simile.
 *
 * Storage: `dm_sessions.session_config` JSON, under key
 *   `repetition_ledger: { similes: string[], updated_at: ISO }`
 * No migration needed — session_config is already a JSON TEXT column.
 *
 * Cap: 30 most recent entries, FIFO. Survives restart (it's on the session
 * row in the DB).
 *
 * Extraction is called from dmSession.js after each AI response is saved.
 * Injection happens in dmPromptBuilder via formatRepetitionLedger().
 */

import { dbGet, dbRun } from '../database.js';

const LEDGER_CAP = 30;

/**
 * Extract similes from narration text. Targets the patterns most players
 * notice as "that's the same image again":
 *
 *   "as [adj] as [noun-phrase]"    → "as skinny as a pulled thread"
 *   "like a [noun-phrase]"          → "like a coin at the bottom of a well"
 *   "the [n] of [n]"                → "the weight of secrets"  (if distinctive)
 *
 * We DON'T extract from dialogue (inside quotes) — those belong to NPCs and
 * reusing a character's catchphrase is fine.
 *
 * @param {string} text — the AI response narrative
 * @returns {string[]} array of simile-like phrases (trimmed, lowercased)
 */
export function extractSimiles(text) {
  if (!text || typeof text !== 'string') return [];

  // Strip anything inside "" or *...* (dialogue / italics) — that's NPC voice.
  const stripped = text
    .replace(/"[^"]{0,200}"/g, ' ')
    .replace(/\*[^*\n]{0,200}\*/g, ' ');

  const found = new Set();

  // Pattern 1: "X as Y as Z" — e.g. "skinny as a pulled thread"
  // Capture ~2-6 word phrases ending in a noun
  const asPattern = /\b([a-z]{2,20})\s+as\s+([a-z]\s+[a-z]{2,20}(?:\s+[a-z]{2,20})?(?:\s+[a-z]{2,20})?)/gi;
  let m;
  while ((m = asPattern.exec(stripped)) !== null) {
    const phrase = `${m[1]} as ${m[2]}`.trim().toLowerCase();
    if (phrase.length >= 10 && phrase.length <= 60) {
      found.add(phrase);
    }
  }

  // Pattern 2: "like a X" / "like an X" — e.g. "like a coin at the bottom of a well"
  // Capture the article + noun phrase, allowing a short tail for "of Y" extensions.
  const likePattern = /\blike\s+(an?\s+[a-z]+(?:\s+[a-z]+){0,6})/gi;
  while ((m = likePattern.exec(stripped)) !== null) {
    // Trim trailing function words so we don't capture "like a coin at the bottom of a"
    let phrase = `like ${m[1]}`.trim().toLowerCase();
    phrase = phrase.replace(/\s+(of|in|on|at|to|with|and|but|or|the|a|an)$/, '').trim();
    // Filter out common non-simile usage
    if (/^like (an? )?(this|that|how|when|if|the|you|we|he|she|it|they)\b/.test(phrase)) continue;
    if (phrase.length >= 10 && phrase.length <= 60) {
      found.add(phrase);
    }
  }

  // Pattern 3: "the X of Y" — often distinctive imagery ("the weight of secrets",
  // "the color of old pewter"). Require the X word to be evocative (4+ chars,
  // not a common positional/structural noun), and cap Y at 2 words to avoid
  // greedy captures like "the weight of secrets pressing down on".
  const ofPattern = /\bthe\s+([a-z]{4,20})\s+of\s+([a-z]+(?:\s+[a-z]+)?)/gi;
  const COMMON_STRUCTURAL = new Set([
    'edge', 'rest', 'side', 'back', 'front', 'middle', 'center', 'part', 'end',
    'start', 'top', 'bottom', 'kind', 'type', 'sort', 'piece', 'bit', 'area',
    'way', 'time', 'place', 'name', 'size', 'amount', 'number', 'group',
    'rest'
  ]);
  while ((m = ofPattern.exec(stripped)) !== null) {
    const head = m[1].toLowerCase();
    if (COMMON_STRUCTURAL.has(head)) continue;
    const phrase = `the ${head} of ${m[2]}`.trim().toLowerCase();
    // Filter out "of [pronoun/article]" which is rarely imagery
    if (/\bof (the|a|an|this|that|these|those|my|your|his|her|its|our|their)\b/.test(phrase)) continue;
    if (phrase.length >= 15 && phrase.length <= 50) {
      found.add(phrase);
    }
  }

  return Array.from(found);
}

/**
 * Read the ledger for a session. Returns `{ similes: string[] }`.
 * Never throws — returns empty ledger on any error.
 */
export async function getLedger(sessionId) {
  if (!sessionId) return { similes: [] };
  try {
    const row = await dbGet(
      'SELECT session_config FROM dm_sessions WHERE id = ?',
      [sessionId]
    );
    if (!row || !row.session_config) return { similes: [] };
    const config = typeof row.session_config === 'string'
      ? JSON.parse(row.session_config)
      : row.session_config;
    const ledger = config?.repetition_ledger;
    if (!ledger || !Array.isArray(ledger.similes)) return { similes: [] };
    return { similes: ledger.similes };
  } catch (err) {
    return { similes: [] };
  }
}

/**
 * Record new similes for a session. Dedupes, appends to the tail, and
 * truncates to LEDGER_CAP (FIFO). Silent-fail on error.
 */
export async function recordSimiles(sessionId, newSimiles) {
  if (!sessionId || !Array.isArray(newSimiles) || newSimiles.length === 0) return;
  try {
    const row = await dbGet(
      'SELECT session_config FROM dm_sessions WHERE id = ?',
      [sessionId]
    );
    if (!row) return;
    let config = {};
    if (row.session_config) {
      try {
        config = typeof row.session_config === 'string'
          ? JSON.parse(row.session_config)
          : row.session_config;
      } catch {
        config = {};
      }
    }
    const existing = new Set((config.repetition_ledger?.similes) || []);
    const toAdd = newSimiles
      .filter(s => s && typeof s === 'string')
      .map(s => s.toLowerCase().trim())
      .filter(s => s && !existing.has(s));
    if (toAdd.length === 0) return;

    const merged = [...(config.repetition_ledger?.similes || []), ...toAdd];
    const capped = merged.slice(-LEDGER_CAP); // keep most recent

    config.repetition_ledger = {
      similes: capped,
      updated_at: new Date().toISOString()
    };

    await dbRun(
      'UPDATE dm_sessions SET session_config = ? WHERE id = ?',
      [JSON.stringify(config), sessionId]
    );
  } catch (err) {
    // Silent-fail — ledger is a polish feature.
  }
}

/**
 * Combined helper: extract + record in one call. Returns the count of new
 * entries recorded.
 */
export async function captureFromResponse(sessionId, responseText) {
  const similes = extractSimiles(responseText);
  if (similes.length === 0) return 0;
  await recordSimiles(sessionId, similes);
  return similes.length;
}

/**
 * Format the ledger as a prompt block. Returns empty string if the ledger
 * is empty (so it can be concatenated unconditionally without adding noise).
 *
 * Output:
 *   ══════════════════════════════════════════════════════════════
 *   RECENTLY USED IMAGERY — DO NOT REUSE THIS SESSION
 *   ══════════════════════════════════════════════════════════════
 *   You've already used these similes and vivid phrasings this session.
 *   For fresh imagery, find a different angle:
 *     • skinny as a pulled thread
 *     • like a coin at the bottom of a well
 *     • the weight of secrets
 */
export function formatRepetitionLedger(ledger) {
  if (!ledger || !Array.isArray(ledger.similes) || ledger.similes.length === 0) {
    return '';
  }
  const bullets = ledger.similes.map(s => `  • ${s}`).join('\n');
  return `\n\n══════════════════════════════════════════════════════════════\nRECENTLY USED IMAGERY — DO NOT REUSE THIS SESSION\n══════════════════════════════════════════════════════════════\nYou've already used these similes and distinctive phrasings this session. For fresh imagery, find a different angle:\n${bullets}\n\n(This rule is STRICT for imagery and simile. Functional language — "the door opens", "he nods" — is fine to reuse.)`;
}
