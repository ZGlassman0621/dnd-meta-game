/**
 * Prelude canon facts service.
 *
 * v1.0.60. A running ledger of canonical truths the AI has established
 * during prelude play. Injected into every Sonnet prompt as ground truth so
 * context drift (forgotten ages, invented weapon training, wandering
 * relationships) can't take hold.
 *
 * Consumed by:
 *   - preludeSessionService.sendMessage — processes [CANON_FACT] and
 *     [CANON_FACT_RETIRE] markers from Sonnet responses
 *   - preludeArcPromptBuilder.createPreludeSystemPrompt — injects the
 *     active-fact block before sending the next turn
 *   - PreludeSession.jsx Setup panel — surfaces the ledger to the player
 *     for debugging / review
 */

import { dbAll, dbRun } from '../database.js';

const CATEGORIES = ['npc', 'location', 'event', 'relationship', 'trait', 'item'];

/**
 * Record a new canon fact. Returns { status: 'inserted' | 'duplicate',
 * id, fact }. Duplicate inserts are silent no-ops (UNIQUE index catches
 * exact matches).
 */
export async function recordCanonFact(characterId, { subject, category, fact, establishedAge = null, sessionId = null }) {
  if (!subject || !fact) throw new Error('canon fact requires subject + fact');
  const cat = String(category || 'trait').toLowerCase();
  if (!CATEGORIES.includes(cat)) throw new Error(`unknown canon category: ${cat}`);

  const trimmedSubject = String(subject).trim();
  const trimmedFact = String(fact).trim();

  try {
    const result = await dbRun(
      `INSERT INTO prelude_canon_facts
         (character_id, category, subject, fact, established_age, session_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [characterId, cat, trimmedSubject, trimmedFact, establishedAge, sessionId]
    );
    return { status: 'inserted', id: Number(result.lastInsertRowid), subject: trimmedSubject, category: cat, fact: trimmedFact };
  } catch (err) {
    // UNIQUE index violation — exact duplicate. Not an error; just swallow.
    if (String(err?.message || '').includes('UNIQUE constraint')) {
      return { status: 'duplicate', subject: trimmedSubject, category: cat, fact: trimmedFact };
    }
    throw err;
  }
}

/**
 * Retire any active facts matching { subject, factContains } — move them
 * from 'active' to 'retired' so they stop appearing in the prompt. Used
 * when a fact is no longer true (age rolled forward, character died,
 * relationship changed).
 *
 * Returns array of retired fact rows for logging.
 */
export async function retireCanonFacts(characterId, { subject, factContains }) {
  if (!subject || !factContains) return [];
  const pattern = `%${factContains}%`;
  const toRetire = await dbAll(
    `SELECT id, subject, fact FROM prelude_canon_facts
     WHERE character_id = ? AND status = 'active'
       AND LOWER(subject) = LOWER(?) AND fact LIKE ?`,
    [characterId, subject, pattern]
  );
  if (toRetire.length === 0) return [];
  const ids = toRetire.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  await dbRun(
    `UPDATE prelude_canon_facts
     SET status = 'retired', retired_at = CURRENT_TIMESTAMP
     WHERE id IN (${placeholders})`,
    ids
  );
  return toRetire;
}

/**
 * List active canon facts for a character. Returns array grouped by
 * category internally but flat for the caller — caller can group as needed.
 */
export async function getActiveCanonFacts(characterId) {
  return dbAll(
    `SELECT id, category, subject, fact, established_age, session_id, created_at
     FROM prelude_canon_facts
     WHERE character_id = ? AND status = 'active'
     ORDER BY category, subject, id`,
    [characterId]
  );
}

/**
 * Build the CANON FACTS prompt block — a structured, grouped bullet list
 * that Sonnet sees every turn. Empty string when no facts yet.
 *
 * Format is intentionally terse. Each fact is one bullet. Subjects are
 * grouped together. Categories separate sections. Designed to be scanned
 * fast, not read.
 */
export async function buildCanonFactsBlock(characterId) {
  const rows = await getActiveCanonFacts(characterId);
  if (rows.length === 0) return '';

  // Group: category → subject → [facts]
  const byCategory = new Map();
  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, new Map());
    const bySubject = byCategory.get(r.category);
    if (!bySubject.has(r.subject)) bySubject.set(r.subject, []);
    bySubject.get(r.subject).push(r.fact);
  }

  const CATEGORY_HEADERS = {
    npc: 'PEOPLE',
    location: 'PLACES',
    event: 'EVENTS',
    relationship: 'RELATIONSHIPS',
    trait: 'TRAITS',
    item: 'ITEMS'
  };
  const order = ['npc', 'relationship', 'trait', 'location', 'item', 'event'];

  const sections = [];
  for (const cat of order) {
    if (!byCategory.has(cat)) continue;
    const bySubject = byCategory.get(cat);
    const lines = [];
    for (const [subject, facts] of bySubject.entries()) {
      lines.push(`  • ${subject}: ${facts.join('; ')}`);
    }
    sections.push(`${CATEGORY_HEADERS[cat]}:\n${lines.join('\n')}`);
  }

  return `CANON FACTS (ground truth — do NOT contradict. If something's wrong, use [CANON_FACT_RETIRE] then emit a new [CANON_FACT]):\n\n${sections.join('\n\n')}`;
}
