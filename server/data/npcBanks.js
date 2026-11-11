/**
 * npcBanks.js — Castles & Crusades Batch 1, staged for the 2024 system.
 *
 * DATA ONLY. No stats, no wiring, no Mac repo edits.
 * Source: cc-batch1-npc-names-sort.md (Book of Names 2021; NPC Almanac:
 * The Register 2022; NPC Almanac: Sketches 2021), parsed programmatically
 * from that sort file — NPC rows were not retyped by hand.
 *
 * What is in here:
 *   - NPC_PROFESSIONS: 50 adherent professions x 20 NPCs, each
 *     { name, sex, appearance, personality, hook } and nothing else.
 *     No BtH, HP, AC, level, treasure, spells, or attributes.
 *   - DESCRIPTOR_BANKS: Register Engineering Tables 1-21, description
 *     vocabulary and generator lists. No level/equipment generation
 *     (Tables 22-36 were dropped in the sort and are not here).
 *   - NAME_TABLES: Book of Names tables. Full grids only where the
 *     sort gives them in full; d10/d10 grids given as examples in the
 *     sort are marked examples-only and are NOT full grids. Nothing
 *     was invented to fill a grid.
 *
 * What is NOT in here, on purpose:
 *   - Heroes of Aihrde as persons, Ungern names/legions, and the
 *     'Falk' prefix (Aihrde content, excluded from FR use).
 *   - C&C-specific classes as classes (Arcane Thief, Divine Knight,
 *     Ethereal Knight, Foresworn, Oathsworn, Pacer, Primal Druid,
 *     Rune Mark, Seeker, Skald appear only as concept labels in
 *     Table 6, never as 2024 classes).
 *   - Sketches backpacks (they reference the Adventurers Backpack,
 *     not in Batch 1), class-based NPC rosters (sampled only in the
 *     sort, not reliably parseable), and any C&C statblock.
 *
 * All Register/Sketches entries are human in the source; race is
 * assigned by the DM/system at use time, not by these tables.
 * The source's M/F sex column is reproduced as a data field only.
 * Book typos and duplicates are kept, not silently cleaned — see
 * the notes on individual entries (e.g. Armorer's two Tudai Katzevs,
 * Table 4's two Stewards, Table 14's two Hearts).
 */

import { NPC_PROFESSIONS_1 } from './npcProfessions1.js';
import { NPC_PROFESSIONS_2 } from './npcProfessions2.js';
import { NPC_PROFESSIONS_3 } from './npcProfessions3.js';
import { DESCRIPTOR_BANKS } from './npcDescriptors.js';
import { NAME_TABLES } from './npcNames.js';

export const NPC_PROFESSIONS = { ...NPC_PROFESSIONS_1, ...NPC_PROFESSIONS_2, ...NPC_PROFESSIONS_3 };
export { DESCRIPTOR_BANKS, NAME_TABLES };

const norm = (s) => String(s || '').toLowerCase().trim();
function pick(arr, rng) {
  if (!arr || arr.length === 0) return null;
  const r = typeof rng === 'function' ? rng() : Math.random();
  return arr[Math.floor(r * arr.length)];
}

export function npcsFor(profession) {
  const key = Object.keys(NPC_PROFESSIONS).find((k) => norm(k) === norm(profession));
  return key ? NPC_PROFESSIONS[key] : null;
}

export function professionNames() {
  return Object.keys(NPC_PROFESSIONS);
}

export function randomNpc(profession, rng) {
  const list = npcsFor(profession);
  return list ? pick(list, rng) : null;
}

export function descriptorBank(table) {
  if (typeof table === 'number') return DESCRIPTOR_BANKS[String(table)] || null;
  const key = Object.keys(DESCRIPTOR_BANKS).find((k) => norm(DESCRIPTOR_BANKS[k].name) === norm(table));
  return key ? DESCRIPTOR_BANKS[key] : null;
}

export function randomDescriptor(table, column, rng) {
  const bank = descriptorBank(table);
  if (!bank) return null;
  if (bank.kind === 'list') return pick(bank.entries, rng);
  if (bank.kind === 'ranges') return pick(bank.ranges, rng);
  if (bank.kind === 'columns') {
    const col = column || Object.keys(bank.columns)[0];
    return pick(bank.columns[col], rng);
  }
  return null;
}

export function rollNameTable(culture, tableName, rng) {
  const entry = NAME_TABLES[norm(culture) === 'half-orc' ? 'halfOrc' : culture] || NAME_TABLES[culture];
  if (!entry) return null;
  const table = entry.tables.find((t) => norm(t.name) === norm(tableName));
  if (!table) return null;
  if (table.adjectives) {
    const adjCat = pick(Object.keys(table.adjectives), rng);
    const nounCat = pick(Object.keys(table.nouns), rng);
    return { value: `${pick(table.adjectives[adjCat], rng)} ${pick(table.nouns[nounCat], rng)}`, coverage: table.coverage, adjectiveCategory: adjCat, nounCategory: nounCat };
  }
  const list = table.entries || table.examples || [];
  if (list.length === 0) return { value: null, coverage: table.coverage };
  const v = pick(list, rng);
  return { value: typeof v === 'object' ? v.name : v, coverage: table.coverage, raw: v };
}

export default { NPC_PROFESSIONS, DESCRIPTOR_BANKS, NAME_TABLES, npcsFor, professionNames, randomNpc, descriptorBank, randomDescriptor, rollNameTable };
