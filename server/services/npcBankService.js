/**
 * npcBankService.js — deal NPCs from the C&C Batch 1 bank into the app's
 * npcs table, and recall them later.
 *
 * WHAT THIS DOES AND DOES NOT DO:
 *   - DOES: deal the first unused bank entry for a profession into the
 *     npcs table (no repeats, no invention), and recall a dealt row
 *     by id with its bank fields intact.
 *   - DOES NOT: touch dmPromptBuilder.js, any route, any migration,
 *     stats, or combat. NO prompt wiring is claimed here.
 *   - The dealt row's shape is deliberately exactly what
 *     dmPromptBuilder.js formatCustomNpcs consumes (name, race, gender,
 *     occupation, current_location, relationship_to_party, motivation,
 *     personality_trait_1, distinguishing_features,
 *     campaign_availability), so a dealt NPC can be passed as a
 *     customNpc at session start. That prompt handoff is a separate
 *     step, not done by this file.
 *   - All Register bank entries are human in the source; race is
 *     assigned at use time, so every dealt row gets race 'Human'.
 *     Changing the race of a dealt row later is a DM decision, not
 *     something this service invents.
 *   - Unknown profession, empty profession, or all 20 entries already
 *     used: returns null. It NEVER invents an NPC and NEVER repeats
 *     one. The caller decides what to do with null (e.g. fall back to
 *     LLM extraction or tell the user the profession is exhausted).
 *
 * BANK-SOURCE MARKER FORMAT:
 *   bankMarker(professionKey, bankIndex)
 *     = `Bank source: ${professionKey} #${bankIndex + 1} of 20`
 *   background_notes for a dealt row
 *     = `${marker}. Hook: ${hook}`
 *   The marker is per-entry (it includes the entry number), so
 *   checking background_notes for one entry's marker never blocks a
 *   different entry from the same profession.
 *
 * DATABASE CONTRACT (db object, supplied by the caller or resolved
 * from server/database.js):
 *   - dbGet(sql, params) -> row or undefined/null
 *   - dbRun(sql, params) -> { lastInsertRowid, changes }
 *   - dbAll(sql, params) -> rows (optional; if absent, the service
 *     falls back to per-candidate dbGet checks, same result)
 *   The service never opens its own connection and never imports a
 *   test double. In tests, pass the real database.js functions bound
 *   to a throwaway temp DB.
 */

import { npcsFor, professionNames } from '../data/npcBanks.js';
import { assignWorldId } from './worldIdService.js';

function norm(s) {
  return String(s || '').toLowerCase().trim();
}

function resolveProfessionKey(profession) {
  if (typeof profession !== 'string' || norm(profession) === '') return null;
  return professionNames().find((k) => norm(k) === norm(profession)) || null;
}

export function bankMarker(professionKey, bankIndex) {
  return `Bank source: ${professionKey} #${bankIndex + 1} of 20`;
}

function genderFor(sex) {
  if (sex === 'M') return 'Male';
  if (sex === 'F') return 'Female';
  return null;
}

async function resolveDb(db) {
  if (db) return db;
  const m = await import('../database.js');
  return { dbGet: m.dbGet, dbRun: m.dbRun, dbAll: m.dbAll };
}

async function existingRowsForProfession(db, professionKey) {
  if (typeof db.dbAll === 'function') {
    const rows = await db.dbAll(
      'SELECT name, background_notes FROM npcs WHERE occupation = ?',
      [professionKey]
    );
    return rows || [];
  }
  return null;
}

async function entryAlreadyUsed(db, existingRows, professionKey, entry, bankIndex) {
  const marker = bankMarker(professionKey, bankIndex);
  if (existingRows) {
    return existingRows.some(
      (r) =>
        r.name === entry.name ||
        (typeof r.background_notes === 'string' && r.background_notes.includes(marker))
    );
  }
  const byName = await db.dbGet(
    'SELECT id FROM npcs WHERE name = ? AND occupation = ?',
    [entry.name, professionKey]
  );
  if (byName) return true;
  const byMarker = await db.dbGet(
    'SELECT id FROM npcs WHERE background_notes LIKE ?',
    [`%${marker}%`]
  );
  return Boolean(byMarker);
}

export async function dealBankNpc({ profession, location = null, db = null } = {}) {
  const professionKey = resolveProfessionKey(profession);
  if (!professionKey) return null;
  const list = npcsFor(professionKey);
  if (!list || list.length === 0) return null;
  const dbObj = await resolveDb(db);
  const existingRows = await existingRowsForProfession(dbObj, professionKey);
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    if (await entryAlreadyUsed(dbObj, existingRows, professionKey, entry, i)) {
      continue;
    }
    const marker = bankMarker(professionKey, i);
    const result = await dbObj.dbRun(
      `INSERT INTO npcs
         (name, race, gender, occupation, current_location,
          relationship_to_party, campaign_availability,
          distinguishing_marks, background_notes, personality_trait_1,
          motivation, distinguishing_features, enrichment_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.name,
        'Human',
        genderFor(entry.sex),
        professionKey,
        location,
        'neutral',
        'available',
        entry.appearance,
        `${marker}. Hook: ${entry.hook}`,
        entry.personality,
        entry.hook,
        entry.appearance,
        0,
      ]
    );
    let id = result ? result.lastInsertRowid : null;
    if (id == null) {
      const row = await dbObj.dbGet(
        'SELECT id FROM npcs WHERE name = ? AND occupation = ? AND background_notes LIKE ?',
        [entry.name, professionKey, `%${marker}%`]
      );
      id = row ? row.id : null;
    }
    // World ID (item 3, Tier 0): best-effort at creation, on the caller's
    // db when one was injected (tests) so no second connection opens.
    try { await assignWorldId('npcs', id, dbObj); } catch (e) { console.error('[npcBank] world ID assignment failed:', e.message); }
    return {
      id,
      name: entry.name,
      profession: professionKey,
      bankIndex: i,
      appearance: entry.appearance,
      personality: entry.personality,
      hook: entry.hook,
      location,
    };
  }
  return null;
}

export async function recallBankNpc(id, db = null) {
  if (id == null) return null;
  const dbObj = await resolveDb(db);
  const row = await dbObj.dbGet('SELECT * FROM npcs WHERE id = ?', [id]);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    profession: row.occupation,
    appearance: row.distinguishing_features,
    personality: row.personality_trait_1,
    hook: row.motivation,
    location: row.current_location,
    bankSource: row.background_notes,
  };
}

// dealSessionNpcs — prompt handoff. Explicit only: the caller names the
// professions it wants (bankDeals), the server deals exactly those, and
// the merged list is what goes into the session's customNpcs. Nothing
// here auto-loads all npcs into a session.
export async function dealSessionNpcs({ bankDeals = [], existingNpcs = [], db = null } = {}) {
  const dbObj = await resolveDb(db);
  const existing = Array.isArray(existingNpcs) ? existingNpcs : [];
  const dealt = [];
  const skipped = [];
  const dealtRows = [];
  const deals = Array.isArray(bankDeals) ? bankDeals : [];
  for (const deal of deals) {
    const profession = deal && typeof deal === 'object' ? deal.profession : null;
    const location = deal && typeof deal === 'object' ? (deal.location ?? null) : null;
    const result = await dealBankNpc({ profession, location, db: dbObj });
    if (!result) {
      const known = profession != null && npcsFor(profession) != null;
      skipped.push({ profession, reason: known ? 'exhausted' : 'unknown' });
      continue;
    }
    dealt.push(result);
    const row = await dbObj.dbGet('SELECT * FROM npcs WHERE id = ?', [result.id]);
    if (!row) continue;
    if (existing.some((n) => n && n.id === row.id)) continue;
    if (dealtRows.some((n) => n && n.id === row.id)) continue;
    dealtRows.push(row);
  }
  return { npcs: [...existing, ...dealtRows], dealt, skipped };
}
