/**
 * Artificer class service — base class ONLY (Forge 2024-style chassis,
 * Eberron kept only where Forge is silent or strictly additive).
 *
 * Sources (verified against the uploaded Forge PDF, 2026-11-04, by
 * reading the printed pages, NOT the interleaved text layer):
 * - Features table (p.8): Plans Known [-,4,4,4,4,5,5,5,5,6,6,6,6,7,7,7,7,8,8,8],
 *   Magic Items [-,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6],
 *   Cantrips 2 (L1-9), 3 (L10-13), 4 (L14-20),
 *   Prepared [2,3,4,5,6,6,7,7,9,9,10,10,11,11,12,12,14,14,15,15]
 *   (the L9=9 and L17=14 jumps are printed, not OCR errors),
 *   slots identical to levelProgression ARTIFICER_SPELL_SLOTS.
 * - Plan tables: 2+ (p.9), 6+ (p.9), 10+ (p.10), 14+ (p.10).
 * - Tinker's Magic (p.8): knows Mending; create a mundane item from
 *   the printed list with Tinker's Tools in hand; uses = Int mod
 *   (min 1) per Long Rest; item vanishes at Long Rest.
 * - Replicate Magic Item (pp.8-9): learn plans from any table you
 *   qualify for; replace one known plan per level gained; create at
 *   Long Rest with Tinker's Tools in hand, up to the Magic Items
 *   column, each from a different known plan; held cap = Magic Items
 *   column, oldest vanishes on exceeding; attune instantly at
 *   creation if the item requires it; created items vanish 1d4 days
 *   after your death; replacing a plan vanishes its created items;
 *   container contents harmlessly appear if the container vanishes.
 * - Magic Item Tinker (p.10): Charge (Bonus Action, expend L1+ slot,
 *   item regains = slot level charges), Drain (Bonus Action, once per
 *   Long Rest, item vanishes -> slot L1 if Common, L2 if Uncommon or
 *   Rare, slot vanishes at Long Rest), Transmute (Magic action, once
 *   per Long Rest, created item becomes another known-plan item).
 * - Flash of Genius (p.10): Reaction when you or a creature you can
 *   see within 30 ft FAILS a check/save; add Int mod (min +1);
 *   uses = Int mod (min 1) per Long Rest.
 * - Magic Item Adept (p.10): attune to 4. Advanced Artifice (p.11):
 *   Savant (attune 5) + Refreshed Genius (+1 Flash use on Short Rest).
 *   Magic Item Master (p.11): attune 6. Base attunement cap is 3.
 * - Spell-Storing Item (p.11): at Long Rest, store a level 1-3
 *   Artificer spell (action cast time, no consumed material, needn't
 *   be prepared) in a Simple/Martial weapon or focus; holder takes a
 *   Magic action to produce it using YOUR spellcasting ability mod;
 *   concentration by the holder; can't reuse until the holder's next
 *   turn starts; stays until used 2x Int mod times (min 2) or re-stored.
 * - Epic Boon (p.11): L19 feat (Boon of Energy Resistance recommended).
 * - Soul of Artifice (p.11, Forge): Cheat Death (0 HP, not killed
 *   outright -> disintegrate any number of Uncommon/Rare created
 *   items -> HP = 20 x items) + Magical Guidance (Short Rest regains
 *   ALL Flash uses if attuned to >= 1 magic item). The +1 save bonus
 *   per attuned item (max +6) is the EBERON Soul of Artifice element,
 *   kept as the additive element in the approved merged design.
 * - Eberron additive elements kept: Right Tool for the Job (L3),
 *   Tool Expertise (L6, double proficiency with tools), Savant's
 *   ignore item class/race/level requirements (L14; no requirement
 *   engine exists today, so this is recorded, not gated).
 * - Homunculus Servant (Forge spell, p.21): level 2 Conjuration,
 *   1 hour or Ritual, range 10 ft, V/S/M (gem 100+ GP), Instantaneous.
 *   Shares your initiative, acts immediately after you, obeys with
 *   NO action required (Forge; differs from Eberron's bonus-action
 *   command), else Dodge + move to avoid danger. Upcast: slot level
 *   is the spell's level in the stat block.
 *
 * NOT in v1 (approved scope): Eberron's bespoke infusions (Enhanced
 * Weapon/Defense, Radiant Weapon, Returning/Repeating, Boots of the
 * Winding Path, Resistant Armor, etc.) — v2 library. Item EFFECTS
 * of created items are recorded, not granted, except the +1/+2 bonus
 * parsed from the plan name onto the item record (application via
 * the game's existing magic weapon/armor path is a build-time check).
 * Rarity of named plans is DM-attested at creation (the plan tables
 * print attunement, not rarity); Drain and Cheat Death refuse or
 * skip items whose rarity is unattested rather than guessing.
 *
 * State lives in class_resources_json.artificer (migration 091 added
 * that column to characters AND companions), so no new migration.
 * Pure functions take state and return { state, ...result }; DB
 * helpers load/save that JSON. Never mutate the caller's state.
 *
 * Two integration facts found on the live files (2026-11-04), not
 * assumed: (1) classFeatureService.parseClassResources STRIPS unknown
 * top-level keys, so this service parses class_resources_json itself
 * (own full parse) instead of going through it — going through it
 * would silently drop .artificer on every load. (2) The same strip
 * happens in resetResourcesForRest, so that function gets a targeted
 * fix (spread preserved keys; its own docstring already promises
 * "Unknown keys pass through untouched") or the first rest wipes
 * every Artificer record. (3) The roll path has NO tool-check site
 * (checks are skill-based), so Tool Expertise v1 is a DM-prompt
 * instruction stating the doubled bonus — the item-2 PC-feature
 * pattern (instructions, never silently added to a reported total) —
 * plus the toolCheckBonus helper for any future tool site.
 * Flash of Genius, by contrast, IS engine-mechanical via its marker:
 * the handler spends a use only when the bonus flips the failure.
 *
 * Markers (schemas in markerSchemas.js, docs in the DM prompt):
 * ARTIFICER_LEARN_PLAN, ARTIFICER_REPLACE_PLAN, ARTIFICER_CREATE,
 * ARTIFICER_ATTUNE, ARTIFICER_UNATTUNE, ARTIFICER_FLASH,
 * ARTIFICER_TINKER, ARTIFICER_RIGHT_TOOL, ARTIFICER_CHARGE,
 * ARTIFICER_DRAIN, ARTIFICER_TRANSMUTE, ARTIFICER_STORE,
 * ARTIFICER_RELEASE, ARTIFICER_HOMUNCULUS, ARTIFICER_ORIGIN,
 * ARTIFICER_CHEAT_DEATH. Handlers register at import; restTimeService
 * and dmPromptBuilder both import this module, so registration rides
 * real load paths, not a new central registry.
 */

import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { findCompanionIdByName } from './conditionService.js';

export const FORGE_PLANS_KNOWN =
  [0, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8];
export const FORGE_MAGIC_ITEMS =
  [0, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6];

// 2024 PHB (Zach, 2026-11-06 — standing rule: the 2024 book always
// wins): an artificer prepares Intelligence modifier + half artificer
// level (rounded down) spells, minimum 1. The old Forge table
// ([2,3,4,5,6,6,7,7,9,...], L1 = 2 at any mod) was a homebrew static
// table, not the book rule — deleted, not kept as a fallback.
export function preparedSpellsForLevel(level, intMod = 0) {
  const lvl = Math.min(20, Math.max(1, Math.trunc(level) || 1));
  const mod = Math.trunc(intMod) || 0;
  return Math.max(1, mod + Math.floor(lvl / 2));
}
export function plansKnownForLevel(level) {
  return FORGE_PLANS_KNOWN[Math.min(20, Math.max(1, Math.trunc(level) || 1)) - 1];
}
export function magicItemsForLevel(level) {
  return FORGE_MAGIC_ITEMS[Math.min(20, Math.max(1, Math.trunc(level) || 1)) - 1];
}
export function attunementCapForLevel(level) {
  const l = Math.trunc(level) || 1;
  if (l >= 18) return 6;
  if (l >= 14) return 5;
  if (l >= 10) return 4;
  return 3;
}
export function flashUsesMax(intMod) {
  return Math.max(1, Math.trunc(intMod) || 0);
}
export function spellStoringUsesMax(intMod) {
  return Math.max(2, 2 * (Math.trunc(intMod) || 0));
}
export function soulSaveBonus(level, attunedCount) {
  if ((Math.trunc(level) || 1) < 20) return 0;
  return Math.min(6, Math.max(0, Math.trunc(attunedCount) || 0));
}

export const TINKER_MUNDANE_ITEMS = [
  'Ball Bearings', 'Basket', 'Bedroll', 'Bell', 'Blanket',
  'Block and Tackle', 'Bottle, Glass', 'Bucket', 'Caltrops', 'Candle',
  'Crowbar', 'Flask', 'Grappling Hook', 'Hunting Trap', 'Jug', 'Lamp',
  'Manacles', 'Net', 'Oil', 'Paper', 'Parchment', 'Pole', 'Pouch',
  'Rope', 'Sack', 'Shovel', 'Spikes, Iron', 'String', 'Tinderbox',
  'Torch', 'Vial',
];

// Plan tables: attunement true/false, null = Varies (generic rows).
const P = (name, attunement) => ({ name, attunement });
export const PLAN_TABLES = {
  2: [
    P('Alchemy Jug', false), P('Bag of Holding', false),
    P('Cap of Water Breathing', false), P('Common magic item', null),
    P('Goggles of Night', false), P('Manifold Tool', true),
    P('Repeating Shot', true), P('Returning Weapon', false),
    P('Rope of Climbing', false), P('Sending Stones', false),
    P('Shield, +1', false), P('Wand of Magic Detection', false),
    P('Wand of Secrets', false), P('Wand of the War Mage, +1', true),
    P('Weapon, +1', false), P('Wraps of Unarmed Power, +1', false),
  ],
  6: [
    P('Armor, +1', false), P('Boots of Elvenkind', false),
    P('Boots of the Winding Path', true), P('Cloak of Elvenkind', true),
    P('Cloak of the Manta Ray', true), P('Dazzling Weapon', true),
    P('Eyes of Charming', true), P('Eyes of Minute Seeing', false),
    P('Gloves of Thievery', false), P('Helm of Awareness', false),
    P('Lantern of Revealing', false), P('Mind Sharpener', true),
    P('Necklace of Adaptation', true), P('Pipes of Haunting', false),
    P('Repulsion Shield', false), P('Ring of Swimming', false),
    P('Ring of Water Walking', false), P('Sentinel Shield', false),
    P('Spell-Refueling Ring', true), P('Wand of Magic Missiles', false),
    P('Wand of Web', true), P('Weapon of Warning', true),
  ],
  10: [
    P('Armor of Resistance', true), P('Dagger of Venom', false),
    P('Elven Chain', false), P('Ring of Feather Falling', true),
    P('Ring of Jumping', true), P('Ring of Mind Shielding', true),
    P('Shield, +2', false), P('Uncommon Wondrous Item', null),
    P('Wand of the War Mage, +2', true), P('Weapon, +2', false),
    P('Wraps of Unarmed Power, +2', false),
  ],
  14: [
    P('Armor, +2', false), P('Arrow-Catching Shield', true),
    P('Flame Tongue', true), P('Rare Wondrous Item', null),
    P('Ring of Free Action', true), P('Ring of Protection', true),
    P('Ring of the Ram', true),
  ],
};
export const MULTI_LEARN_PLANS = new Set([
  'Common magic item', 'Uncommon Wondrous Item', 'Rare Wondrous Item',
]);

export function planEntryForLevel(planName, level) {
  for (const minLevel of [14, 10, 6, 2]) {
    if (level < minLevel) continue;
    const found = PLAN_TABLES[minLevel].find(p => p.name === planName);
    if (found) return { ...found, minLevel };
  }
  return null;
}
export function plansAvailableAtLevel(level) {
  const out = [];
  for (const minLevel of [2, 6, 10, 14]) {
    if (level >= minLevel) out.push(...PLAN_TABLES[minLevel]);
  }
  return out;
}

export function defaultArtificerState() {
  return {
    plansKnown: [],
    createdItems: [],
    attunedExternal: [],
    tinkersUsesLeft: 0,
    tinkersUsesMax: 0,
    tinkeredItems: [],
    flashUsesLeft: 0,
    flashUsesMax: 0,
    drainUsed: false,
    transmuteUsed: false,
    storedSpell: null,
    homunculus: null,
    rightTool: null,
    origin: null,
    nextItemOrder: 1,
  };
}
function clone(state) {
  return JSON.parse(JSON.stringify(state || defaultArtificerState()));
}
function bonusFromPlanName(name) {
  const m = /\+(\d)\s*$/.exec(String(name || ''));
  return m ? parseInt(m[1], 10) : 0;
}

export function attunedCount(state) {
  const s = state || defaultArtificerState();
  return (s.createdItems || []).filter(i => i.attuned).length
    + (s.attunedExternal || []).length;
}

// --- Plans ---------------------------------------------------------------
export function learnPlan(state, level, planName, detail) {
  const s = clone(state);
  const entry = planEntryForLevel(planName, level);
  if (!entry) return { state: s, success: false, reason: 'plan_not_available_at_level' };
  const key = MULTI_LEARN_PLANS.has(planName) && detail
    ? `${planName}: ${detail}` : planName;
  if (MULTI_LEARN_PLANS.has(planName) && !detail) {
    return { state: s, success: false, reason: 'generic_plan_needs_item' };
  }
  if (s.plansKnown.includes(key)) return { state: s, success: false, reason: 'plan_already_known' };
  if (s.plansKnown.length >= plansKnownForLevel(level)) {
    return { state: s, success: false, reason: 'plans_known_cap' };
  }
  s.plansKnown.push(key);
  return { state: s, success: true, plan: key };
}
export function replacePlan(state, level, oldKey, newPlanName, detail) {
  const s = clone(state);
  const idx = s.plansKnown.indexOf(oldKey);
  if (idx === -1) return { state: s, success: false, reason: 'plan_not_known' };
  const entry = planEntryForLevel(newPlanName, level);
  if (!entry) return { state: s, success: false, reason: 'plan_not_available_at_level' };
  const key = MULTI_LEARN_PLANS.has(newPlanName) && detail
    ? `${newPlanName}: ${detail}` : newPlanName;
  if (MULTI_LEARN_PLANS.has(newPlanName) && !detail) {
    return { state: s, success: false, reason: 'generic_plan_needs_item' };
  }
  if (s.plansKnown.includes(key)) return { state: s, success: false, reason: 'plan_already_known' };
  // Book: any magic item created with the replaced plan vanishes at once.
  const vanished = s.createdItems.filter(i => i.plan === oldKey);
  s.createdItems = s.createdItems.filter(i => i.plan !== oldKey);
  s.plansKnown[idx] = key;
  return { state: s, success: true, plan: key, vanished };
}

// --- Replicate: creation at Long Rest ------------------------------------
export function createReplicatedItems(state, level, planKeys, opts = {}) {
  const s = clone(state);
  if (!opts.tinkersToolsInHand) {
    return { state: s, success: false, reason: 'tinkers_tools_required' };
  }
  if (!Array.isArray(planKeys) || planKeys.length === 0) {
    return { state: s, success: false, reason: 'no_plans_given' };
  }
  const cap = magicItemsForLevel(level);
  if (planKeys.length > cap) {
    return { state: s, success: false, reason: 'create_count_exceeds_table', cap };
  }
  if (new Set(planKeys).size !== planKeys.length) {
    return { state: s, success: false, reason: 'duplicate_plan_in_creation' };
  }
  for (const key of planKeys) {
    if (!s.plansKnown.includes(key)) {
      return { state: s, success: false, reason: 'plan_not_known', plan: key };
    }
  }
  const created = [];
  const evicted = [];
  for (const key of planKeys) {
    const base = key.split(':')[0].trim();
    const entry = planEntryForLevel(base, level);
    const order = s.nextItemOrder++;
    const item = {
      id: `art-${order}`,
      plan: key,
      name: key,
      attunementRequired: entry ? entry.attunement : null,
      attuned: false,
      rarity: opts.rarityByPlan ? (opts.rarityByPlan[key] || null) : null,
      bonus: bonusFromPlanName(key),
      charges: null,
      order,
    };
    // Held cap: oldest vanishes, then the new item appears.
    while (s.createdItems.length >= cap) {
      evicted.push(s.createdItems.shift());
    }
    s.createdItems.push(item);
    created.push(item);
  }
  return { state: s, success: true, created, evicted };
}

// --- Attunement (first engine record; cap is hard, like ammo at zero) -----
export function attuneCreatedItem(state, level, itemId) {
  const s = clone(state);
  const item = s.createdItems.find(i => i.id === itemId);
  if (!item) return { state: s, success: false, reason: 'item_not_found' };
  if (item.attuned) return { state: s, success: true, already: true };
  if (attunedCount(s) >= attunementCapForLevel(level)) {
    return { state: s, success: false, reason: 'attunement_cap', cap: attunementCapForLevel(level) };
  }
  item.attuned = true;
  return { state: s, success: true };
}
export function attuneExternalItem(state, level, name) {
  const s = clone(state);
  if (s.attunedExternal.includes(name)) return { state: s, success: true, already: true };
  if (attunedCount(s) >= attunementCapForLevel(level)) {
    return { state: s, success: false, reason: 'attunement_cap', cap: attunementCapForLevel(level) };
  }
  s.attunedExternal.push(name);
  return { state: s, success: true };
}
export function findCreatedItem(state, target) {
  const s = state || defaultArtificerState();
  return s.createdItems.find(i => i.id === target)
    || s.createdItems.find(i => i.name === target)
    || null;
}
export function unattune(state, target) {
  const s = clone(state);
  const item = findCreatedItem(s, target);
  if (item) { item.attuned = false; return { state: s, success: true }; }
  const idx = s.attunedExternal.indexOf(target);
  if (idx !== -1) { s.attunedExternal.splice(idx, 1); return { state: s, success: true }; }
  return { state: s, success: false, reason: 'not_attuned' };
}

// --- Tinker's Magic ---------------------------------------------------------
export function useTinkersMagic(state, intMod, itemName, opts = {}) {
  const s = clone(state);
  if (!opts.tinkersToolsInHand) {
    return { state: s, success: false, reason: 'tinkers_tools_required' };
  }
  if (!TINKER_MUNDANE_ITEMS.includes(itemName)) {
    return { state: s, success: false, reason: 'item_not_on_tinker_list' };
  }
  const max = Math.max(1, Math.trunc(intMod) || 0);
  // Fresh state (max never initialized) starts full; an exhausted state
  // (max set, left 0) stays empty until a Long Rest refills it.
  if (!s.tinkersUsesMax) { s.tinkersUsesMax = max; s.tinkersUsesLeft = max; }
  if (s.tinkersUsesLeft > max) s.tinkersUsesLeft = max;
  if (s.tinkersUsesLeft <= 0) {
    return { state: s, success: false, reason: 'no_uses_left' };
  }
  s.tinkersUsesLeft -= 1;
  s.tinkeredItems.push(itemName);
  return { state: s, success: true, item: itemName, usesLeft: s.tinkersUsesLeft };
}

// --- Flash of Genius (reaction AFTER a failure is known) -------------------
export function applyFlashOfGenius(state, { total, dc, intMod }) {
  const s = clone(state);
  const bonus = Math.max(1, Math.trunc(intMod) || 0);
  // Fresh state (max never initialized) starts full, like Tinker's Magic.
  if (!s.flashUsesMax) { s.flashUsesMax = flashUsesMax(intMod); s.flashUsesLeft = s.flashUsesMax; }
  if (s.flashUsesLeft <= 0) return { state: s, success: false, reason: 'no_uses_left', flips: false };
  if (total >= dc) return { state: s, success: false, reason: 'already_succeeded', flips: false };
  if (total + bonus < dc) return { state: s, success: false, reason: 'flash_insufficient', flips: false, newTotal: total + bonus };
  s.flashUsesLeft -= 1;
  return { state: s, success: true, flips: true, newTotal: total + bonus, usesLeft: s.flashUsesLeft };
}

// --- Tool Expertise (L6): double proficiency on tool checks -----------------
export function toolCheckBonus({ level, proficient, proficiencyBonus }) {
  if ((Math.trunc(level) || 1) >= 6 && proficient) return (proficiencyBonus || 0) * 2;
  return proficiencyBonus || 0;
}

// --- Magic Item Tinker (L6) --------------------------------------------------
export function chargeCreatedItem(state, level, itemId, slotLevel) {
  const s = clone(state);
  if ((Math.trunc(level) || 1) < 6) return { state: s, success: false, reason: 'level_too_low' };
  const item = s.createdItems.find(i => i.id === itemId);
  if (!item) return { state: s, success: false, reason: 'item_not_found' };
  if (item.charges === null || item.charges === undefined) {
    return { state: s, success: false, reason: 'item_uses_no_charges' };
  }
  item.charges += Math.max(1, Math.trunc(slotLevel) || 1);
  return { state: s, success: true, charges: item.charges };
}
export function drainCreatedItem(state, level, itemId) {
  const s = clone(state);
  if ((Math.trunc(level) || 1) < 6) return { state: s, success: false, reason: 'level_too_low' };
  if (s.drainUsed) return { state: s, success: false, reason: 'drain_already_used_this_rest' };
  const idx = s.createdItems.findIndex(i => i.id === itemId);
  if (idx === -1) return { state: s, success: false, reason: 'item_not_found' };
  const item = s.createdItems[idx];
  if (!item.rarity) return { state: s, success: false, reason: 'rarity_unattested' };
  let slotLevel;
  if (item.rarity === 'common') slotLevel = 1;
  else if (item.rarity === 'uncommon' || item.rarity === 'rare') slotLevel = 2;
  else return { state: s, success: false, reason: 'rarity_not_drainable' };
  s.createdItems.splice(idx, 1);
  s.drainUsed = true;
  return { state: s, success: true, slotLevel, item: item.name };
}
export function transmuteCreatedItem(state, level, itemId, newPlanKey) {
  const s = clone(state);
  if ((Math.trunc(level) || 1) < 6) return { state: s, success: false, reason: 'level_too_low' };
  if (s.transmuteUsed) return { state: s, success: false, reason: 'transmute_already_used_this_rest' };
  const item = s.createdItems.find(i => i.id === itemId);
  if (!item) return { state: s, success: false, reason: 'item_not_found' };
  if (!s.plansKnown.includes(newPlanKey)) {
    return { state: s, success: false, reason: 'plan_not_known' };
  }
  const base = newPlanKey.split(':')[0].trim();
  const entry = planEntryForLevel(base, level);
  item.plan = newPlanKey;
  item.name = newPlanKey;
  item.attunementRequired = entry ? entry.attunement : null;
  item.bonus = bonusFromPlanName(newPlanKey);
  item.attuned = false;
  s.transmuteUsed = true;
  return { state: s, success: true, item };
}

// --- Spell-Storing Item (L11) -------------------------------------------------
export function storeSpell(state, level, intMod, spell) {
  const s = clone(state);
  if ((Math.trunc(level) || 1) < 11) return { state: s, success: false, reason: 'level_too_low' };
  if (!spell || typeof spell.level !== 'number' || spell.level < 1 || spell.level > 3) {
    return { state: s, success: false, reason: 'spell_level_out_of_range' };
  }
  if (spell.castTime !== '1 action') {
    return { state: s, success: false, reason: 'spell_cast_time_not_action' };
  }
  if (spell.materialConsumed === undefined) {
    return { state: s, success: false, reason: 'material_unconfirmed' };
  }
  if (spell.materialConsumed) {
    return { state: s, success: false, reason: 'spell_consumes_material' };
  }
  s.storedSpell = {
    spell: spell.name, level: spell.level,
    usesLeft: spellStoringUsesMax(intMod), lastHolderTurn: null,
  };
  return { state: s, success: true, stored: s.storedSpell };
}
export function releaseStoredSpell(state, holderTurnKey) {
  const s = clone(state);
  if (!s.storedSpell) return { state: s, success: false, reason: 'no_spell_stored' };
  if (s.storedSpell.usesLeft <= 0) return { state: s, success: false, reason: 'stored_spell_exhausted' };
  if (s.storedSpell.lastHolderTurn === holderTurnKey) {
    return { state: s, success: false, reason: 'stored_spell_reused_this_turn' };
  }
  s.storedSpell.usesLeft -= 1;
  s.storedSpell.lastHolderTurn = holderTurnKey;
  return { state: s, success: true, spell: s.storedSpell.spell, usesLeft: s.storedSpell.usesLeft };
}

// --- Right Tool for the Job (L3, Eberron) --------------------------------------
export function createRightTool(state, level, toolName) {
  const s = clone(state);
  if ((Math.trunc(level) || 1) < 3) return { state: s, success: false, reason: 'level_too_low' };
  s.rightTool = toolName;
  return { state: s, success: true, tool: toolName };
}

// --- Soul of Artifice (L20) ------------------------------------------------------
export function cheatDeath(state, { killedOutright }) {
  const s = clone(state);
  if (killedOutright) return { state: s, success: false, reason: 'killed_outright' };
  const sacrifice = s.createdItems.filter(i => i.rarity === 'uncommon' || i.rarity === 'rare');
  if (sacrifice.length === 0) {
    return { state: s, success: false, reason: 'no_sacrificeable_items' };
  }
  const names = new Set(sacrifice.map(i => i.id));
  s.createdItems = s.createdItems.filter(i => !names.has(i.id));
  return { state: s, success: true, hp: 20 * sacrifice.length, consumed: sacrifice.map(i => i.name) };
}

// --- Prepared spells (subclass always-prepared excluded from the count) -----------
export function validatePreparedSpells(level, preparedList, alwaysPreparedList, intMod = 0) {
  const max = preparedSpellsForLevel(level, intMod);
  // Case-insensitive match (2026-11-06, item 13): same insurance as
  // the blackguard/paladin validators — an always-prepared name
  // typed in a different case than the data must still be excluded.
  const norm = (s) => String(s || '').trim().toLowerCase();
  const always = new Set((alwaysPreparedList || []).map(norm));
  const counted = (preparedList || []).filter(sp => !always.has(norm(sp)));
  return { max, counted: counted.length, ok: counted.length <= max, over: Math.max(0, counted.length - max) };
}

// --- Homunculus Servant (Forge spell version) --------------------------------------
export function homunculusStats(slotLevel, spellAttackMod) {
  const lvl = Math.max(1, Math.trunc(slotLevel) || 2);
  return {
    ac: 13,
    hp: 5 + 5 * lvl,
    maxHp: 5 + 5 * lvl,
    hitDice: `${lvl}d4`,
    speed: { walk: 20, fly: 30 },
    abilities: { str: 4, dex: 15, con: 12, int: 10, wis: 10, cha: 7 },
    saves: { str: -3, dex: 2, con: 1, int: 0, wis: 0, cha: -2 },
    damageImmunities: ['poison'],
    conditionImmunities: ['exhaustion', 'poisoned'],
    senses: 'Darkvision 60 ft., Passive Perception 10',
    languages: 'Telepathy 1 mile (you only)',
    traits: ['Evasion', `Magic Bond (+${lvl} to ability checks and saving throws)`],
    actions: [{ name: 'Force Strike', bonus: spellAttackMod, reach: '5 ft. or range 30 ft.', damage: `1d6+${lvl} force` }],
    reactions: ['Channel Magic (delivers your touch-range spell within 120 ft.)'],
    commandCost: 'none (obeys, no action required; otherwise Dodge + move to avoid danger)',
  };
}
export function summonHomunculus(state, slotLevel, spellAttackMod) {
  const s = clone(state);
  s.homunculus = { slotLevel, ...homunculusStats(slotLevel, spellAttackMod) };
  return { state: s, success: true, homunculus: s.homunculus };
}

// --- Rests -------------------------------------------------------------------------
export function onLongRest(state, { level, intMod }) {
  const s = clone(state);
  const fMax = flashUsesMax(intMod);
  const tMax = Math.max(1, Math.trunc(intMod) || 0);
  s.flashUsesMax = fMax; s.flashUsesLeft = fMax;
  s.tinkersUsesMax = tMax; s.tinkersUsesLeft = tMax;
  s.tinkeredItems = [];
  s.drainUsed = false; s.transmuteUsed = false;
  return { state: s, success: true };
}
export function onShortRest(state, { level, intMod, attunedCount: attCount }) {
  const s = clone(state);
  const fMax = flashUsesMax(intMod);
  s.flashUsesMax = fMax;
  if ((Math.trunc(level) || 1) >= 20 && (attCount || 0) >= 1) {
    s.flashUsesLeft = fMax; // Magical Guidance
  } else if ((Math.trunc(level) || 1) >= 14) {
    s.flashUsesLeft = Math.min(fMax, s.flashUsesLeft + 1); // Refreshed Genius
  }
  return { state: s, success: true, flashUsesLeft: s.flashUsesLeft };
}

// --- DM prompt section (seam for dmPromptBuilder) --------------------------------------
export function artificerPromptSection(state, { level, intMod, name }) {
  const s = state || defaultArtificerState();
  const tMax = s.tinkersUsesMax || Math.max(1, Math.trunc(intMod) || 0);
  const tLeft = s.tinkersUsesMax ? s.tinkersUsesLeft : tMax;
  const fMax = s.flashUsesMax || flashUsesMax(intMod);
  const fLeft = s.flashUsesMax ? s.flashUsesLeft : fMax;
  const pb = 2 + Math.floor(((Math.trunc(level) || 1) - 1) / 4);
  const lines = [`Artificer (level ${level}, Int mod ${intMod}):`];
  lines.push(`- Plans known (${s.plansKnown.length}/${plansKnownForLevel(level)}): ${s.plansKnown.join(', ') || 'none'}`);
  lines.push(`- Created items (${s.createdItems.length}/${magicItemsForLevel(level)}): ${s.createdItems.map(i => `${i.name}${i.attuned ? ' [attuned]' : ''}`).join(', ') || 'none'}`);
  lines.push(`- Attuned ${attunedCount(s)}/${attunementCapForLevel(level)} (origin: Eberron/Khorvaire${s.origin ? ` — ${s.origin.explanation}` : ' — origin explanation REQUIRED, not yet recorded'})`);
  lines.push(`- Flash of Genius uses left: ${fLeft}/${fMax} (Reaction after a known failure within 30 ft, add Int mod; spend with [ARTIFICER_FLASH: Target="Name" Total="13" DC="15"])`);
  lines.push(`- Tinker's Magic uses left: ${tLeft}/${tMax} (create a mundane item with Tinker's Tools in hand; item vanishes at Long Rest)`);
  if ((Math.trunc(level) || 1) >= 6) lines.push(`- Tool Expertise: double proficiency bonus on tool checks (base +${pb}, doubled +${pb * 2}) — apply to the reported total, never silently added`);
  if (s.storedSpell) lines.push(`- Spell-Storing Item: ${s.storedSpell.spell} (${s.storedSpell.usesLeft} uses left)`);
  if (s.homunculus) lines.push(`- Homunculus Servant: ${s.homunculus.hp}/${s.homunculus.maxHp} HP, AC 13`);
  if (s.rightTool) lines.push(`- Right Tool for the Job: ${s.rightTool}`);
  return lines.join('\n');
}

// --- Multiclass grant (Forge, p.7 in the PDF text layer) -------------------------------
export const MULTICLASS_GRANT = {
  hitDie: 8,
  tools: ["Tinker's Tools"],
  skillChoices: 1,
  skillOptions: ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Sleight of Hand'],
  armor: ['light', 'medium', 'shields'],
};

// --- DB helpers (class_resources_json.artificer; no new migration) ---------------------
// Own full parse on purpose: classFeatureService.parseClassResources
// strips every top-level key except used/raging/bardicHeld, which
// would silently drop .artificer on every load and save.
function tableFor(kind) {
  return kind === 'companion' ? 'companions' : 'characters';
}
function parseAllResources(raw) {
  const parsed = typeof raw === 'string' ? safeParse(raw, {}) : (raw || {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}
export async function loadArtificerState(kind, id) {
  try {
    const row = await dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
    if (!row) return defaultArtificerState();
    const resources = parseAllResources(row.class_resources_json);
    return resources.artificer ? { ...defaultArtificerState(), ...resources.artificer } : defaultArtificerState();
  } catch {
    return defaultArtificerState();
  }
}
export async function saveArtificerState(kind, id, artificerState) {
  const row = await dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
  const resources = parseAllResources(row ? row.class_resources_json : null);
  resources.artificer = artificerState;
  await dbRun(`UPDATE ${tableFor(kind)} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(resources), id]);
  return true;
}

// --- Marker handlers (the DM's call sites) -----------------------------------------
const truthy = (v) => ['true', 'yes', '1'].includes(String(v || '').toLowerCase().trim());
function intModOf(abilityScores) {
  const scores = typeof abilityScores === 'string' ? safeParse(abilityScores, {}) : (abilityScores || {});
  return Math.floor((Number(scores.int ?? scores.intelligence ?? 10) - 10) / 2);
}
async function resolveArtificer(context, targetRaw) {
  const character = await dbGet('SELECT id, name, class, level, ability_scores FROM characters WHERE id = ?', [context.characterId]);
  const raw = String(targetRaw || '').trim();
  const isPc = !raw || /^(player|pc|character)$/i.test(raw) ||
    (character && raw.toLowerCase() === String(character.name).toLowerCase());
  if (isPc) {
    return {
      kind: 'player', id: context.characterId, name: character?.name || 'Player',
      className: String(character?.class || '').toLowerCase().trim(),
      level: character?.level || 1, intMod: intModOf(character?.ability_scores),
    };
  }
  const compId = await findCompanionIdByName(context.characterId, raw);
  if (!compId) return null;
  const comp = await dbGet('SELECT id, name, companion_class, companion_level, companion_ability_scores FROM companions WHERE id = ?', [compId]);
  if (!comp) return null;
  return {
    kind: 'companion', id: compId, name: comp.name || raw,
    className: String(comp.companion_class || '').toLowerCase().trim(),
    level: comp.companion_level || 1, intMod: intModOf(comp.companion_ability_scores),
  };
}
async function withArtificer(parsed, context, type, fn) {
  if (!context?.characterId) return null;
  try {
    const actor = await resolveArtificer(context, parsed?.Target);
    if (!actor) return { type, success: false, reason: 'unknown target' };
    if (actor.className !== 'artificer') return { type, success: false, reason: `${actor.name} is not an artificer` };
    const state = await loadArtificerState(actor.kind, actor.id);
    const res = await fn(state, actor);
    if (res && res.success) await saveArtificerState(actor.kind, actor.id, res.state);
    if (!res) return null;
    const { state: _saved, ...out } = res;
    return { type, actor: actor.name, ...out };
  } catch (e) {
    console.error('[artificerService] marker handler failed:', e.message);
    return null;
  }
}

registerMarkerHandler('ARTIFICER_LEARN_PLAN', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_learn_plan', (s, a) =>
    learnPlan(s, a.level, String(parsed?.Plan || '').trim(), parsed?.Detail ? String(parsed.Detail).trim() : undefined)));

registerMarkerHandler('ARTIFICER_REPLACE_PLAN', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_replace_plan', (s, a) =>
    replacePlan(s, a.level, String(parsed?.Old || '').trim(), String(parsed?.Plan || '').trim(), parsed?.Detail ? String(parsed.Detail).trim() : undefined)));

registerMarkerHandler('ARTIFICER_CREATE', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_create', (s, a) => {
    const plans = String(parsed?.Plans || '').split(',').map(p => p.trim()).filter(Boolean);
    const res = createReplicatedItems(s, a.level, plans, { tinkersToolsInHand: truthy(parsed?.Tools) });
    if (!res.success) return res;
    let cur = res.state;
    const attuned = [];
    if (truthy(parsed?.Attune)) {
      for (const item of res.created) {
        const r = attuneCreatedItem(cur, a.level, item.id);
        if (r.success) { cur = r.state; attuned.push(item.name); }
      }
    }
    return { ...res, state: cur, attuned };
  }));

registerMarkerHandler('ARTIFICER_ATTUNE', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_attune', (s, a) => {
    const item = String(parsed?.Item || '').trim();
    const created = findCreatedItem(s, item);
    if (created) return attuneCreatedItem(s, a.level, created.id);
    return attuneExternalItem(s, a.level, item);
  }));

registerMarkerHandler('ARTIFICER_UNATTUNE', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_unattune', (s) =>
    unattune(s, String(parsed?.Item || '').trim())));

registerMarkerHandler('ARTIFICER_FLASH', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_flash', (s, a) => {
    const total = Number(parsed?.Total);
    const dc = Number(parsed?.DC);
    if (!Number.isFinite(total) || !Number.isFinite(dc)) {
      return { state: s, success: false, reason: 'ARTIFICER_FLASH needs Total= and DC=' };
    }
    return applyFlashOfGenius(s, { total, dc, intMod: a.intMod });
  }));

registerMarkerHandler('ARTIFICER_TINKER', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_tinker', (s, a) =>
    useTinkersMagic(s, a.intMod, String(parsed?.Item || '').trim(), { tinkersToolsInHand: truthy(parsed?.Tools) })));

registerMarkerHandler('ARTIFICER_RIGHT_TOOL', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_right_tool', (s, a) =>
    createRightTool(s, a.level, String(parsed?.Tool || '').trim())));

registerMarkerHandler('ARTIFICER_CHARGE', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_charge', (s, a) => {
    const item = findCreatedItem(s, String(parsed?.Item || '').trim());
    if (!item) return { state: s, success: false, reason: 'item_not_found' };
    return chargeCreatedItem(s, a.level, item.id, Number(parsed?.Slot));
  }));

registerMarkerHandler('ARTIFICER_DRAIN', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_drain', (s, a) => {
    const item = findCreatedItem(s, String(parsed?.Item || '').trim());
    if (!item) return { state: s, success: false, reason: 'item_not_found' };
    return drainCreatedItem(s, a.level, item.id);
  }));

registerMarkerHandler('ARTIFICER_TRANSMUTE', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_transmute', (s, a) => {
    const item = findCreatedItem(s, String(parsed?.Item || '').trim());
    if (!item) return { state: s, success: false, reason: 'item_not_found' };
    return transmuteCreatedItem(s, a.level, item.id, String(parsed?.Plan || '').trim());
  }));

registerMarkerHandler('ARTIFICER_STORE', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_store', (s, a) =>
    storeSpell(s, a.level, a.intMod, {
      name: String(parsed?.Spell || '').trim(),
      level: Number(parsed?.Level),
      castTime: String(parsed?.CastTime || '').trim(),
      materialConsumed: parsed?.MaterialConsumed === undefined ? undefined : truthy(parsed.MaterialConsumed),
    })));

registerMarkerHandler('ARTIFICER_RELEASE', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_release', (s) =>
    releaseStoredSpell(s, String(parsed?.Turn || '').trim())));

registerMarkerHandler('ARTIFICER_HOMUNCULUS', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_homunculus', (s) =>
    summonHomunculus(s, Number(parsed?.Slot), Number(parsed?.AttackBonus))));

registerMarkerHandler('ARTIFICER_ORIGIN', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_origin', (s) => {
    const next = clone(s);
    next.origin = {
      setting: String(parsed?.Setting || 'Eberron').trim(),
      region: parsed?.Region ? String(parsed.Region).trim() : null,
      explanation: String(parsed?.Explanation || '').trim(),
    };
    if (!next.origin.explanation) return { state: s, success: false, reason: 'ARTIFICER_ORIGIN needs Explanation=' };
    return { state: next, success: true, origin: next.origin };
  }));

registerMarkerHandler('ARTIFICER_CHEAT_DEATH', async (parsed, context) =>
  withArtificer(parsed, context, 'artificer_cheat_death', async (s, a) => {
    const res = cheatDeath(s, { killedOutright: truthy(parsed?.KilledOutright) });
    if (!res.success) return res;
    const table = a.kind === 'companion' ? 'companions' : 'characters';
    const hpCol = a.kind === 'companion' ? 'companion_current_hp' : 'current_hp';
    await dbRun(`UPDATE ${table} SET ${hpCol} = ? WHERE id = ?`, [res.hp, a.id]);
    return res;
  }));

export default {
  FORGE_PLANS_KNOWN, FORGE_MAGIC_ITEMS,
  preparedSpellsForLevel, plansKnownForLevel, magicItemsForLevel,
  attunementCapForLevel, flashUsesMax, spellStoringUsesMax, soulSaveBonus,
  TINKER_MUNDANE_ITEMS, PLAN_TABLES, MULTI_LEARN_PLANS,
  planEntryForLevel, plansAvailableAtLevel, defaultArtificerState, attunedCount,
  learnPlan, replacePlan, createReplicatedItems,
  attuneCreatedItem, attuneExternalItem, unattune, findCreatedItem,
  useTinkersMagic, applyFlashOfGenius, toolCheckBonus,
  chargeCreatedItem, drainCreatedItem, transmuteCreatedItem,
  storeSpell, releaseStoredSpell, createRightTool, cheatDeath,
  validatePreparedSpells, homunculusStats, summonHomunculus,
  onLongRest, onShortRest, artificerPromptSection, MULTICLASS_GRANT,
  loadArtificerState, saveArtificerState,
};
