/**
 * Bestiary Service (Combat Pipeline #7).
 * Canonical enemy stats lookup. COMBAT_START checks here first.
 */
import { dbGet, dbAll, dbRun } from '../database.js';

export async function lookupBestiary(name) {
  if (!name) return null;
  return dbGet('SELECT * FROM bestiary WHERE name = LOWER(?) LIMIT 1', [name.trim()]);
}

export async function searchBestiary(query, limit = 10) {
  return dbAll('SELECT * FROM bestiary WHERE name LIKE ? LIMIT ?', [`%${query.toLowerCase()}%`, limit]);
}

export async function addBestiaryEntry(entry) {
  const { name, displayName, maxHp, armorClass, attackBonus, damageDice, dexMod, cr, xpValue, source } = entry;
  if (!name || !displayName) return null;
  const r = await dbRun(
    `INSERT INTO bestiary (name, display_name, max_hp, armor_class, attack_bonus, damage_dice, dex_mod, challenge_rating, xp_value, source)
     VALUES (LOWER(?), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, displayName, maxHp || 10, armorClass || 10, attackBonus || 0, damageDice || '1d6', dexMod || 0, cr || '0', xpValue || 0, source || 'custom']
  );
  return Number(r.lastInsertRowid);
}

export default { lookupBestiary, searchBestiary, addBestiaryEntry };
