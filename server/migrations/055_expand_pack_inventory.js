/**
 * Migration 055 — Expand equipment packs already stored in character inventories.
 *
 * Characters created before the pack-expansion fix store a pack (e.g.
 * "Explorer's Pack") as a single inventory line, so neither the player nor the
 * DM (which reads the inventory) can see or use the contents. This backfills
 * existing characters: any stored item whose name matches a known pack is
 * replaced by its individual contents, tagged with `pack_source` for provenance.
 *
 * Idempotent: expanded items carry `pack_source` and their names are no longer
 * pack names, so re-running finds nothing to expand. Contents are kept in sync
 * with client/src/data/equipment.json (standard PHB packs).
 */

const PACK_CONTENTS = {
  "Burglar's Pack": ['Backpack', 'Bag of 1,000 ball bearings', '10 feet of string', 'Bell', '5 candles', 'Crowbar', 'Hammer', '10 pitons', 'Hooded lantern', '2 flasks of oil', '5 days rations', 'Tinderbox', 'Waterskin', '50 feet of hempen rope'],
  "Diplomat's Pack": ['Chest', '2 cases for maps and scrolls', 'Fine clothes', 'Bottle of ink', 'Ink pen', 'Lamp', '2 flasks of oil', '5 sheets of paper', 'Vial of perfume', 'Sealing wax', 'Soap'],
  "Dungeoneer's Pack": ['Backpack', 'Crowbar', 'Hammer', '10 pitons', '10 torches', 'Tinderbox', '10 days of rations', 'Waterskin', '50 feet of hempen rope'],
  "Entertainer's Pack": ['Backpack', 'Bedroll', '2 costumes', '5 candles', '5 days of rations', 'Waterskin', 'Disguise kit'],
  "Explorer's Pack": ['Backpack', 'Bedroll', 'Mess kit', 'Tinderbox', '10 torches', '10 days of rations', 'Waterskin', '50 feet of hempen rope'],
  "Priest's Pack": ['Backpack', 'Blanket', '10 candles', 'Tinderbox', 'Alms box', '2 blocks of incense', 'Censer', 'Vestments', '2 days of rations', 'Waterskin'],
  "Scholar's Pack": ['Backpack', 'Book of lore', 'Bottle of ink', 'Ink pen', '10 sheets of parchment', 'Little bag of sand', 'Small knife'],
};

export async function up(db) {
  let rows;
  try {
    rows = await db.execute('SELECT id, inventory FROM characters');
  } catch (e) {
    console.warn('Migration 055: could not read characters; skipping:', e.message);
    return;
  }

  let updated = 0;
  for (const r of rows.rows) {
    let inv;
    try { inv = JSON.parse(r.inventory || '[]'); } catch { continue; }
    if (!Array.isArray(inv)) continue;

    let changed = false;
    const next = [];
    for (const item of inv) {
      const name = typeof item === 'string' ? item : (item && (item.name || item.label));
      const alreadyExpanded = item && typeof item === 'object' && item.pack_source;
      const contents = name && PACK_CONTENTS[name];
      if (contents && !alreadyExpanded) {
        changed = true;
        const source = (item && typeof item === 'object' && item.source) || 'class_package';
        for (const c of contents) {
          next.push({ name: c, label: c, original_pick: name, source, pack_source: name });
        }
      } else {
        next.push(item);
      }
    }

    if (changed) {
      await db.execute({ sql: 'UPDATE characters SET inventory = ? WHERE id = ?', args: [JSON.stringify(next), r.id] });
      updated++;
    }
  }

  if (updated > 0) console.log(`Migration 055: expanded packs in ${updated} character inventory/inventories.`);
}

export async function down(db) {
  // Expansion is not reversed — leaving the individual items is harmless.
}
