/**
 * Magic Item Discovery Service — loot wiring, R-02 engine side.
 *
 * DM rules registry R-02 (Shawn's reel Dfc2wBgP8xj; 2014 DMG p.136):
 * never name a magic item — describe it and let the players find out
 * what it does. (1) Describe with the senses. (2) First use in a fight
 * shows one thing. (3) A short rest focused on the item unlocks the
 * rest. Cursed items stay hidden until attuned.
 *
 * Record home (no migration): per-item fields ON the inventory object
 * itself — { name, quantity, identified, revealedOne, cursed }.
 * Items dealt before this wiring carry no discovery fields and are
 * treated as already identified (legacy grandfathering — the player
 * already knows their names; hiding them retroactively would be a lie).
 * The no-repeat dealt record lives in class_resources_json.loot =
 * { dealt: [names] }, own-parse like attunementService (which owns
 * class_resources_json.attunement). No new table, no new migration.
 *
 * State machine per item: unidentified -> partial -> identified.
 * - unidentified: name hidden everywhere the DM prompt lists gear;
 *   the DM describes it with the senses (no sensory text exists in
 *   server item data yet — per-item sensory descriptions are a
 *   data-authoring follow-up, NOT invented here; the prompt section
 *   instructs the DM to describe, never name).
 * - partial (revealOne, "first use shows one thing"): the item's one
 *   catalog description is revealed — what it does — while the NAME
 *   stays hidden until the short rest. The merchant catalog carries a
 *   single effect string per item, so description-revealed is the
 *   honest mapping of "one thing" onto the data in hand; splitting
 *   one string into fake sub-properties would be invention.
 * - identified (ITEM_IDENTIFY, short rest focused on the item): name
 *   + full identity revealed.
 * - cursed: while cursed && !attuned, BOTH transitions refuse with
 *   reason 'cursed_hidden_until_attuned'. No catalog item carries a
 *   cursed flag today, so this limb is engine-ready but dormant —
 *   it fires the moment item data gains cursed items. Attunement is
 *   read from attunementService.isAttuned (hooks job #10, D10) — this
 *   job pushes AFTER #10, so the import resolves at push time.
 *
 * Triggers are DM-driven markers (same pattern as LOOT_DROP, which is
 * itself DM-driven): [ITEM_REVEAL_ONE: Target="Name" Item="..."] when
 * the item is first used in a fight, [ITEM_IDENTIFY: Target="Name"
 * Item="..."] when a short rest is spent focused on the item. The
 * engine holds the state and enforces the transitions; the DM drives
 * the triggers. A rest-path auto-offer (rest result listing
 * unidentified items to focus on) is a follow-up, not this job.
 *
 * PC vs companion split: markers act on the named target; the prompt
 * section never names an unidentified item for either. Nothing here
 * adds to a PC's reported totals — discovery is state, not math.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { isAttuned, attunementStateFromResources } from './attunementService.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';

export const DISCOVERY_UNIDENTIFIED = 'unidentified';
export const DISCOVERY_PARTIAL = 'partial';
export const DISCOVERY_IDENTIFIED = 'identified';

// An item is magic (gets discovery treatment) when the catalog says so:
// any non-common rarity, or a potion (consumable magic; Identify-by-taste
// is a book route, not built here). Mundane gear stays identified.
// Muse call, recorded: rarity is the catalog's own magic signal.
export function isMagicItem(catalogRecord) {
  if (!catalogRecord || typeof catalogRecord !== 'object') return false;
  if (String(catalogRecord.category || '').toLowerCase() === 'potion') return true;
  const rarity = String(catalogRecord.rarity || 'common').toLowerCase();
  return rarity !== 'common';
}

function normName(name) {
  return String(name || '').trim().toLowerCase();
}

export function discoveryStateOf(item) {
  if (!item || typeof item !== 'object') return DISCOVERY_IDENTIFIED;
  // No discovery fields = dealt before this wiring = already known.
  if (item.identified === undefined && item.revealedOne === undefined) return DISCOVERY_IDENTIFIED;
  if (item.identified === true) return DISCOVERY_IDENTIFIED;
  if (item.revealedOne === true) return DISCOVERY_PARTIAL;
  return DISCOVERY_UNIDENTIFIED;
}

export function isCursedHidden(item, attunementState) {
  if (!item || item.cursed !== true) return false;
  return !isAttuned(attunementState || null, item.name);
}

// Stamp a freshly dealt magic item. Mundane items pass through untouched.
export function stampDealtItem(item, { cursed = false } = {}) {
  const it = { ...(item || {}) };
  it.identified = false;
  it.revealedOne = false;
  it.cursed = cursed === true;
  return it;
}

// First use in a fight shows one thing: reveal the catalog description,
// keep the name hidden. Pure: returns a new inventory array.
export function revealOneProperty(inventory, itemName, attunementState) {
  const items = Array.isArray(inventory) ? inventory.map((i) => ({ ...(i || {}) })) : [];
  const want = normName(itemName);
  const idx = items.findIndex((i) => normName(i.name) === want);
  if (idx === -1) return { inventory: items, success: false, reason: 'item_not_in_inventory' };
  const item = items[idx];
  if (discoveryStateOf(item) === DISCOVERY_IDENTIFIED) {
    return { inventory: items, success: true, already: true, state: DISCOVERY_IDENTIFIED };
  }
  if (isCursedHidden(item, attunementState)) {
    return { inventory: items, success: false, reason: 'cursed_hidden_until_attuned' };
  }
  item.revealedOne = true;
  return { inventory: items, success: true, state: DISCOVERY_PARTIAL };
}

// Short rest focused on the item unlocks the rest (DMG p.136).
export function identifyOnShortRest(inventory, itemName, attunementState) {
  const items = Array.isArray(inventory) ? inventory.map((i) => ({ ...(i || {}) })) : [];
  const want = normName(itemName);
  const idx = items.findIndex((i) => normName(i.name) === want);
  if (idx === -1) return { inventory: items, success: false, reason: 'item_not_in_inventory' };
  const item = items[idx];
  if (discoveryStateOf(item) === DISCOVERY_IDENTIFIED) {
    return { inventory: items, success: true, already: true, state: DISCOVERY_IDENTIFIED };
  }
  if (isCursedHidden(item, attunementState)) {
    return { inventory: items, success: false, reason: 'cursed_hidden_until_attuned' };
  }
  item.identified = true;
  item.revealedOne = true;
  return { inventory: items, success: true, state: DISCOVERY_IDENTIFIED };
}

// --- No-repeat dealt record (class_resources_json.loot = { dealt: [] }) ---
export function defaultLootState() {
  return { dealt: [] };
}
export function lootStateFromResources(raw) {
  const parsed = typeof raw === 'string' ? safeParse(raw, {}) : (raw || {});
  const res = parsed && typeof parsed === 'object' ? parsed : {};
  const loot = res.loot && typeof res.loot === 'object' ? res.loot : null;
  return { dealt: Array.isArray(loot?.dealt) ? [...loot.dealt] : [] };
}
export function lootStateIntoResources(raw, state) {
  const parsed = typeof raw === 'string' ? safeParse(raw, {}) : (raw || {});
  const res = parsed && typeof parsed === 'object' ? { ...parsed } : {};
  res.loot = state;
  return res;
}
export function recordDealt(state, names) {
  const s = { dealt: [...((state && state.dealt) || [])] };
  for (const n of names || []) {
    const clean = String(n || '').trim();
    if (clean && !s.dealt.some((d) => normName(d) === normName(clean))) s.dealt.push(clean);
  }
  return s;
}
// Names still available to deal: table minus already-dealt minus already-owned.
export function availableToDeal(table, state, inventory) {
  const dealt = new Set(((state && state.dealt) || []).map(normName));
  const owned = new Set((Array.isArray(inventory) ? inventory : []).map((i) => normName(i.name || i)));
  return (Array.isArray(table) ? table : []).filter(
    (name) => !dealt.has(normName(name)) && !owned.has(normName(name))
  );
}

// --- DM prompt section -------------------------------------------------------
// Lists ONLY unidentified/partial items, never by name: "an unidentified
// <category> item" + what the DM may show at this state. Identified items
// are named normally by the existing Key Equipment line. Returns '' when
// there is nothing undiscovered, so the prompt stays clean.
export function discoveryPromptSection(inventory, catalogLookup) {
  const items = Array.isArray(inventory) ? inventory : [];
  const lines = [];
  for (const item of items) {
    const state = discoveryStateOf(item);
    if (state === DISCOVERY_IDENTIFIED) continue;
    const rec = typeof catalogLookup === 'function' ? catalogLookup(item.name) : null;
    const kind = rec?.category ? String(rec.category).replace(/_/g, ' ') : 'magic item';
    const rarity = rec?.rarity ? ` (${rec.rarity})` : '';
    if (state === DISCOVERY_PARTIAL) {
      lines.push(`- Unidentified ${kind}${rarity}: first use showed one thing — ${rec?.description || 'its effect is partly known'}. Its true name is still hidden; a short rest focused on it reveals the rest. Never speak its name.`);
    } else {
      lines.push(`- Unidentified ${kind}${rarity}: describe it with the senses only — never name it, never state what it does. First use in a fight shows one thing; a short rest focused on it unlocks the rest.`);
    }
  }
  if (!lines.length) return '';
  return `MAGIC ITEM DISCOVERY (R-02 — describe, never name):\n${lines.join('\n')}`;
}

// --- DB helpers --------------------------------------------------------------
function tableFor(kind) {
  return kind === 'companion' ? 'companions' : 'characters';
}
export async function loadLootState(kind, id) {
  try {
    const row = await dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
    if (!row) return defaultLootState();
    return lootStateFromResources(row.class_resources_json);
  } catch {
    return defaultLootState();
  }
}
export async function saveLootState(kind, id, lootState) {
  const row = await dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
  const resources = lootStateIntoResources(row ? row.class_resources_json : null, lootState);
  await dbRun(`UPDATE ${tableFor(kind)} SET class_resources_json = ? WHERE id = ?`, [
    JSON.stringify(resources), id,
  ]);
  return true;
}

// --- Marker handlers (DM-driven triggers) ------------------------------------
async function withDiscovery(parsed, context, fn) {
  const target = String(parsed?.Target || '').trim();
  const item = String(parsed?.Item || '').trim();
  if (!target || !item) return { success: false, reason: 'ITEM marker needs Target= and Item=' };
  const characterId = context?.characterId;
  if (!characterId) return { success: false, reason: 'no character in context' };
  // Target is the PC by name, or a companion by name; companions table
  // holds inventory too. PC first, companion fallback — same shape as
  // the rest dispatcher (name match, case-insensitive).
  const pc = await dbGet('SELECT id, name, inventory, class_resources_json FROM characters WHERE id = ?', [characterId]);
  if (!pc) return { success: false, reason: 'character not found' };
  // v1 is PC-only: the marker context carries the PC's characterId and
  // the target must name the PC. Companion discovery (companions hold
  // inventory too) is a follow-up — refusing here is safer than mutating
  // the wrong actor's gear on a name guess.
  if (normName(pc.name) !== normName(target)) {
    return { success: false, reason: 'unknown discovery target (v1 is PC-only)' };
  }
  const kind = 'character';
  const row = pc;
  const inventory = safeParse(row.inventory, []);
  const attState = attunementStateFromResources(row.class_resources_json);
  const result = fn(inventory, item, attState);
  if (!result.success) return result;
  await dbRun(`UPDATE ${tableFor(kind)} SET inventory = ? WHERE id = ?`, [JSON.stringify(result.inventory), row.id]);
  return { ...result, target, item };
}

registerMarkerHandler('ITEM_REVEAL_ONE', async (parsed, context) =>
  withDiscovery(parsed, context, (inv, item, att) => revealOneProperty(inv, item, att)));
registerMarkerHandler('ITEM_IDENTIFY', async (parsed, context) =>
  withDiscovery(parsed, context, (inv, item, att) => identifyOnShortRest(inv, item, att)));

export default {
  DISCOVERY_UNIDENTIFIED, DISCOVERY_PARTIAL, DISCOVERY_IDENTIFIED,
  isMagicItem, discoveryStateOf, isCursedHidden, stampDealtItem,
  revealOneProperty, identifyOnShortRest,
  defaultLootState, lootStateFromResources, lootStateIntoResources,
  recordDealt, availableToDeal, discoveryPromptSection,
  loadLootState, saveLootState,
};
