/**
 * World ID Service — combat item 3, Tier 0.
 *
 * One permanent, cross-table identity per persistent being:
 * ID0000001, ID0000002, ... The sequence lives in world_id_counter
 * (migration 092, exactly one row, id = 1); npcs.world_id and
 * characters.world_id hold the assigned value. Companions need no
 * separate ID — a companion IS its npc row (companions.npc_id).
 *
 * Allocation is a compare-and-swap loop: read next_value, UPDATE
 * ... WHERE next_value = old, retry when zero rows changed. That
 * keeps two concurrent allocations from ever sharing a number, even
 * though callers issue one statement at a time.
 *
 * Executor contract (same shape as npcBankService's injected db):
 *   dbGet(sql, params) -> row or null/undefined
 *   dbRun(sql, params) -> { lastInsertRowid, changes }
 * Callers that already hold an injected db (npcBankService) pass it;
 * everyone else omits it and the service uses server/database.js.
 * The service never opens its own connection.
 *
 * IDs are system-only: tracker chrome + DM internal context, never
 * narrated. They are never reused, even after death or deletion —
 * assignWorldId only ever fills a NULL, never overwrites.
 */
import { dbGet as defaultDbGet, dbRun as defaultDbRun } from '../database.js';

export function formatWorldId(n) {
  return `ID${String(n).padStart(7, '0')}`;
}

export function parseWorldIdNumber(worldId) {
  const m = /^ID(\d+)$/.exec(String(worldId || ''));
  return m ? Number(m[1]) : null;
}

function executor(db) {
  if (db && typeof db.dbGet === 'function' && typeof db.dbRun === 'function') {
    return { dbGet: db.dbGet, dbRun: db.dbRun };
  }
  return { dbGet: defaultDbGet, dbRun: defaultDbRun };
}

function assertWorldTable(table) {
  if (table !== 'npcs' && table !== 'characters') {
    throw new Error(`worldIdService: table must be 'npcs' or 'characters', got '${table}'`);
  }
}

/**
 * Claim the next sequence number. Pure counter work — no row is
 * touched, so a claimed-then-unused number is simply skipped, never
 * reused. Retries on CAS loss; throws after 20 attempts rather than
 * handing out a duplicate.
 */
export async function allocateWorldIdNumber(db = null) {
  const { dbGet, dbRun } = executor(db);
  for (let attempt = 0; attempt < 20; attempt++) {
    const row = await dbGet('SELECT next_value FROM world_id_counter WHERE id = 1');
    if (!row) {
      // Counter missing (a DB that skipped migration 092, e.g. a test
      // fixture built before it): create it, then retry the claim.
      await dbRun('INSERT OR IGNORE INTO world_id_counter (id, next_value) VALUES (1, 1)');
      continue;
    }
    const n = Number(row.next_value);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`worldIdService: corrupt world_id_counter next_value: ${row.next_value}`);
    }
    const res = await dbRun(
      'UPDATE world_id_counter SET next_value = ? WHERE id = 1 AND next_value = ?',
      [n + 1, n]
    );
    if (res && res.changes === 1) return n;
  }
  throw new Error('worldIdService: could not allocate a world ID after 20 attempts');
}

/**
 * Assign (or return the existing) world ID for one row. Returns null
 * when the row does not exist — and never claims a number for a
 * ghost row. Idempotent: calling it twice returns the same ID.
 */
export async function assignWorldId(table, rowId, db = null) {
  assertWorldTable(table);
  if (rowId == null) return null;
  const { dbGet, dbRun } = executor(db);
  const row = await dbGet(`SELECT id, world_id FROM ${table} WHERE id = ?`, [rowId]);
  if (!row) return null;
  if (row.world_id) return row.world_id;
  const wid = formatWorldId(await allocateWorldIdNumber(db));
  const res = await dbRun(
    `UPDATE ${table} SET world_id = ? WHERE id = ? AND world_id IS NULL`,
    [wid, rowId]
  );
  if (res && res.changes === 1) return wid;
  // Lost a race to another assigner: return theirs, never a duplicate.
  const again = await dbGet(`SELECT world_id FROM ${table} WHERE id = ?`, [rowId]);
  return again ? again.world_id : null;
}

/** Alias: the repair entry point used at combat load for rows that
 * predate world IDs (seeds, direct inserts, tests). */
export const ensureWorldId = assignWorldId;

/**
 * Combat-scoped fallback identity for combatants with no world row:
 * mooks and summons that live only as combat_enemies rows. Stable
 * within one fight, never confused with a world ID (no ID prefix).
 */
export function combatFallbackId(sessionId, encounterSeq, combatEnemyId) {
  return `combat:${sessionId}:${encounterSeq}:${combatEnemyId}`;
}

export default { formatWorldId, parseWorldIdNumber, allocateWorldIdNumber, assignWorldId, ensureWorldId, combatFallbackId };
