/**
 * Spell Material Service (repo-check-fixes-spells item 9, 2024 PHB).
 *
 * A component pouch or spellcasting focus stands in for an ordinary
 * Material component, but not for one with a stated cost or one the
 * spell consumes (PHB 2024, Ch. 7 "Components"). Those must be in the
 * party's carried inventory — the recruiting character's `inventory`
 * column, which holds the whole party's goods since migration 032 — or
 * the cast is refused. A consumed component is spent after the cast.
 *
 * The catalog carries the specifics on the entry's `material` field
 * ({ text, costGp, consumed, match }); `spellMaterial` /
 * `materialIsEnforced` in server/data/spellCatalog.js read it. A spell
 * with no `material` data is not checked (the data gap is reported).
 *
 * Matching: an inventory item counts when its name contains one of the
 * `match` words. Its value is its own price (price_gp, value_gp,
 * cost_gp, a "(300 gp)" in its name), else the exact-name price from
 * the merchant tables or the 2024 equipment list; an item with no
 * known value does not count toward a cost. Several items add up
 * ("diamonds worth 300 GP" can be three 100 GP diamonds). Known edge,
 * deliberately not modelled: a cost written for one object ("a bowl
 * worth 1,000+ GP") is also met by two cheaper bowls.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { spellMaterial, materialIsEnforced } from '../data/spellCatalog.js';
import { lookupItemByName } from '../data/merchantLootTables.js';

let equipmentPrices = null;
async function equipmentPriceFor(name) {
  if (!equipmentPrices) {
    equipmentPrices = new Map();
    try {
      const mod = await import('../data/equipment2024.js');
      // Lists sit at the top level (WEAPONS, ADVENTURING_GEAR…) or one
      // level down (FOCUSES.holy — Amulet/Emblem/Reliquary, 5 GP each).
      const lists = [];
      for (const v of Object.values(mod)) {
        if (Array.isArray(v)) lists.push(v);
        else if (v && typeof v === 'object') for (const w of Object.values(v)) if (Array.isArray(w)) lists.push(w);
      }
      for (const v of lists) {
        for (const it of v) {
          if (it && typeof it.name === 'string' && Number.isFinite(Number(it.costGp))) {
            equipmentPrices.set(it.name.toLowerCase(), Number(it.costGp));
          }
        }
      }
    } catch { /* price list optional */ }
  }
  return equipmentPrices.get(String(name).toLowerCase()) ?? null;
}

/** GP value of ONE unit of an inventory item, or null when unknown. */
export async function itemUnitValueGp(item) {
  if (!item || typeof item !== 'object') return null;
  for (const f of ['price_gp', 'value_gp', 'cost_gp', 'costGp', 'valueGp']) {
    const n = Number(item[f]);
    if (item[f] != null && Number.isFinite(n) && n > 0) return n;
  }
  const inName = /\(\s*([\d,]+)\s*\+?\s*gp\s*\)/i.exec(String(item.name || ''));
  if (inName) return Number(inName[1].replace(/,/g, ''));
  const exact = lookupItemByName(String(item.name || ''));
  if (exact && String(exact.name || '').toLowerCase() === String(item.name || '').toLowerCase() && Number(exact.price_gp) > 0) {
    return Number(exact.price_gp);
  }
  return equipmentPriceFor(item.name || '');
}

function nameMatches(item, match) {
  const n = String(item?.name || '').toLowerCase();
  return (match || []).some(m => n.includes(String(m).toLowerCase()));
}

/**
 * Pure selection: which inventory units cover the material. Returns
 * { ok, have, take: [{ index, quantity }] }. Cheapest-sufficient first:
 * units are taken in ascending value until the cost is met, so a
 * 1,000 GP diamond is not spent where a 300 GP one does.
 */
export async function selectMaterialUnits(inventory, material) {
  const cost = Number(material?.costGp) || 0;
  const units = [];
  for (let i = 0; i < (inventory || []).length; i++) {
    const it = inventory[i];
    if (!nameMatches(it, material.match)) continue;
    const qty = Math.max(1, Math.trunc(Number(it.quantity) || 1));
    const value = await itemUnitValueGp(it);
    for (let q = 0; q < qty; q++) units.push({ index: i, value });
  }
  if (cost <= 0) {
    // Consumed but costless: any one matching unit.
    return units.length ? { ok: true, have: 0, take: [{ index: units[0].index, quantity: 1 }] } : { ok: false, have: 0, take: [] };
  }
  const priced = units.filter(u => u.value != null).sort((a, b) => a.value - b.value);
  const total = priced.reduce((s, u) => s + u.value, 0);
  if (total < cost) return { ok: false, have: total, take: [] };
  // Spend the least value that covers the cost: the cheaper of (a) the
  // single cheapest unit that covers it alone and (b) units accumulated
  // from the cheapest up.
  const single = priced.find(u => u.value >= cost);
  const stack = [];
  let acc = 0;
  for (const u of priced) { stack.push(u); acc += u.value; if (acc >= cost) break; }
  const chosen = single && single.value <= acc ? [single] : stack;
  const byIndex = new Map();
  for (const u of chosen) byIndex.set(u.index, (byIndex.get(u.index) || 0) + 1);
  return { ok: true, have: total, take: [...byIndex].map(([index, quantity]) => ({ index, quantity })) };
}

/**
 * Check the party inventory for a spell's costly/consumed material.
 * Returns { ok: true } when nothing is enforced, or
 * { ok, material, take, reason }.
 */
export async function checkSpellMaterial(characterId, spellName) {
  const material = spellMaterial(spellName);
  if (!materialIsEnforced(material)) return { ok: true, enforced: false };
  const row = characterId ? await dbGet('SELECT inventory FROM characters WHERE id = ?', [characterId]) : null;
  const inventory = safeParse(row?.inventory, []);
  const sel = await selectMaterialUnits(Array.isArray(inventory) ? inventory : [], material);
  if (sel.ok) return { ok: true, enforced: true, material, take: sel.take };
  const costText = material.costGp ? ` (the party carries ${sel.have} GP of it)` : '';
  return {
    ok: false, enforced: true, material,
    reason: `missing material component: ${material.text}${costText}`,
    remedy: `Acquire ${material.text} — a component pouch or spellcasting focus cannot replace a component with a cost${material.consumed ? ' or one the spell consumes' : ''}.`,
  };
}

/** Spend a consumed material after a successful cast. Returns the
 *  consumed summary, or null when the material is not consumed. */
export async function spendSpellMaterial(characterId, check) {
  if (!check?.enforced || !check.material || check.material.consumed !== true || !check.take?.length) return null;
  const row = await dbGet('SELECT inventory FROM characters WHERE id = ?', [characterId]);
  const inventory = safeParse(row?.inventory, []);
  if (!Array.isArray(inventory)) return null;
  const spent = [];
  for (const { index, quantity } of check.take) {
    const it = inventory[index];
    if (!it) continue;
    const have = Math.max(1, Math.trunc(Number(it.quantity) || 1));
    spent.push({ name: it.name, quantity });
    if (have > quantity) it.quantity = have - quantity;
    else inventory[index] = null;
  }
  const next = inventory.filter(Boolean);
  await dbRun('UPDATE characters SET inventory = ? WHERE id = ?', [JSON.stringify(next), characterId]);
  return { material: check.material.text, spent };
}

export default { checkSpellMaterial, spendSpellMaterial, selectMaterialUnits, itemUnitValueGp };
