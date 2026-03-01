/**
 * DM Mode Campaign Prep Service
 *
 * CRUD for campaign prep items: NPCs, enemies, locations, lore, treasure, session notes.
 * Each item has a type discriminator and a JSON content blob whose structure varies by type.
 */

import { dbAll, dbGet, dbRun } from '../database.js';

const VALID_TYPES = ['npc', 'enemy', 'location', 'lore', 'treasure', 'session_notes'];

/**
 * List prep items for a party with optional type filter and text search.
 */
export async function getPrep(partyId, { type = '', search = '', archived = 0 } = {}) {
  let query = 'SELECT * FROM dm_mode_prep WHERE dm_mode_party_id = ? AND archived = ?';
  const params = [partyId, archived];

  if (type && VALID_TYPES.includes(type)) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY type ASC, sort_order ASC, name ASC';

  let items = await dbAll(query, params);

  // Parse content JSON
  items = items.map(item => ({
    ...item,
    content: safeParseJson(item.content)
  }));

  // Text search across name and stringified content
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(item =>
      item.name.toLowerCase().includes(q) ||
      JSON.stringify(item.content).toLowerCase().includes(q)
    );
  }

  return items;
}

/**
 * Get a single prep item by ID with parsed content.
 */
export async function getPrepItem(id) {
  const item = await dbGet('SELECT * FROM dm_mode_prep WHERE id = ?', [id]);
  if (!item) return null;
  return { ...item, content: safeParseJson(item.content) };
}

/**
 * Create a new prep item.
 */
export async function createPrep(partyId, { type, name, content = {} }) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid prep type: ${type}. Must be one of: ${VALID_TYPES.join(', ')}`);
  }
  if (!name || !name.trim()) {
    throw new Error('Name is required');
  }

  // Get max sort_order for this type
  const max = await dbGet(
    'SELECT MAX(sort_order) as maxOrder FROM dm_mode_prep WHERE dm_mode_party_id = ? AND type = ?',
    [partyId, type]
  );
  const sortOrder = (max?.maxOrder ?? -1) + 1;

  const result = await dbRun(
    `INSERT INTO dm_mode_prep (dm_mode_party_id, type, name, content, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [partyId, type, name.trim(), JSON.stringify(content), sortOrder]
  );

  return getPrepItem(Number(result.lastInsertRowid));
}

/**
 * Update a prep item (partial update — only provided fields).
 */
export async function updatePrep(id, { name, content, sort_order }) {
  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (content !== undefined) {
    updates.push('content = ?');
    params.push(JSON.stringify(content));
  }
  if (sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(sort_order);
  }

  if (updates.length === 0) return getPrepItem(id);

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  await dbRun(`UPDATE dm_mode_prep SET ${updates.join(', ')} WHERE id = ?`, params);
  return getPrepItem(id);
}

/**
 * Soft-delete (archive) a prep item.
 */
export async function archivePrep(id) {
  await dbRun(
    'UPDATE dm_mode_prep SET archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id]
  );
  return { success: true };
}

/**
 * Hard-delete a prep item.
 */
export async function deletePrep(id) {
  await dbRun('DELETE FROM dm_mode_prep WHERE id = ?', [id]);
  return { success: true };
}

/**
 * Duplicate a prep item with " (copy)" appended to name.
 */
export async function duplicatePrep(id) {
  const original = await getPrepItem(id);
  if (!original) throw new Error('Prep item not found');

  return createPrep(original.dm_mode_party_id, {
    type: original.type,
    name: `${original.name} (copy)`,
    content: original.content
  });
}

/**
 * Get counts per type for badge display.
 */
export async function getPrepCounts(partyId) {
  const rows = await dbAll(
    'SELECT type, COUNT(*) as count FROM dm_mode_prep WHERE dm_mode_party_id = ? AND archived = 0 GROUP BY type',
    [partyId]
  );
  const counts = {};
  for (const t of VALID_TYPES) counts[t] = 0;
  for (const row of rows) counts[row.type] = row.count;
  return counts;
}

/**
 * Batch update sort_order for items of a given type.
 */
export async function reorderPrep(partyId, type, orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    await dbRun(
      'UPDATE dm_mode_prep SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND dm_mode_party_id = ? AND type = ?',
      [i, orderedIds[i], partyId, type]
    );
  }
  return { success: true };
}

function safeParseJson(str) {
  try {
    return JSON.parse(str || '{}');
  } catch {
    return {};
  }
}
