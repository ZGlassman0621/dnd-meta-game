/**
 * xanatharNameService.js — deal unused Xanathar Appendix B names for new NPCs.
 *
 * WHAT THIS DOES AND DOES NOT DO:
 *   - DOES: deal a per-session hand of full names from
 *     ../data/xanatharNames.js, excluding every name that is already a
 *     person (npcs rows + the caller's usedNames list). A dealt name is
 *     a suggestion for the DM, not a person: nothing is inserted into
 *     the npcs table here, and a dealt-but-never-introduced name may be
 *     dealt again in a later session, because it never became anyone.
 *   - DOES NOT: touch dmPromptBuilder.js, any route, any migration, or
 *     the C&C bank (npcNames.js / npcBankService.js). It never invents
 *     a name, never repeats a full name inside one hand, and never
 *     deals a personal name whose first name is already used — the
 *     existing usedNames list stores first names only (heuristic scan),
 *     so "Dagnal Balderk" must not follow an existing "Dagnal".
 *   - Full-name uniqueness is the rule; a clan/family name on its own
 *     MAY repeat (siblings share a clan), so only the full name and
 *     the personal first name are blocked.
 *   - Best-effort like npcBankService: a failed npcs lookup degrades to
 *     the caller's usedNames list only, and never throws the session
 *     start off course. Unknown species / culture / gender returns
 *     null, never a made-up fallback.
 *
 * HAND COMPOSITION (20 by default, in slot order):
 *   dragonborn f/m + clan, dwarf f/m + clan, elf f/m + family,
 *   elf child, gnome f/m + clan, halfling f/m + family,
 *   half-orc f/m, tiefling f/m, tiefling virtue name,
 *   4 human names from 4 distinct shuffled cultures.
 * An exhausted slot is skipped, so the hand can come back smaller —
 * never padded with invention.
 */

import { XANATHAR_NAME_TABLES } from '../data/xanatharNames.js';

const norm = (s) => String(s || '').toLowerCase().trim();
const firstToken = (s) => norm(s).split(/\s+/)[0] || '';

function pick(arr, rng) {
  if (!arr || arr.length === 0) return null;
  const r = typeof rng === 'function' ? rng() : Math.random();
  return arr[Math.floor(r * arr.length)];
}

function shuffled(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor((typeof rng === 'function' ? rng() : Math.random()) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function personalList(species, gender, humanCulture) {
  if (species === 'human') {
    const culture = XANATHAR_NAME_TABLES.human?.[humanCulture];
    return culture ? culture[gender] || null : null;
  }
  const group = XANATHAR_NAME_TABLES[species];
  return group ? group[gender] || null : null;
}

function suffixList(species, gender) {
  if (species === 'dragonborn' || species === 'dwarf' || species === 'gnome') {
    return XANATHAR_NAME_TABLES[species]?.clan || null;
  }
  if (species === 'elf' && (gender === 'female' || gender === 'male')) {
    return XANATHAR_NAME_TABLES.elf?.family || null;
  }
  if (species === 'halfling') {
    return XANATHAR_NAME_TABLES.halfling?.family || null;
  }
  return null;
}

const HUMAN_CULTURE_LABELS = { nigerCongo: 'Niger-Congo' };
function labelFor(species, gender, humanCulture, virtue) {
  if (species === 'human') {
    const culture = HUMAN_CULTURE_LABELS[humanCulture]
      || (humanCulture ? humanCulture[0].toUpperCase() + humanCulture.slice(1) : humanCulture);
    return `Human (${culture}), ${gender}`;
  }
  if (virtue) return 'Tiefling (virtue name)';
  if (gender === 'child') return 'Elf (child)';
  const pretty = species === 'halfOrc' ? 'Half-Orc' : species[0].toUpperCase() + species.slice(1);
  return `${pretty}, ${gender}`;
}

// Deal one full name. usedFirst / usedFull are Sets of normalised names
// (mutated by the caller between deals so a hand never repeats itself).
// Returns { fullName, personal, suffix, species, gender, table, label }
// or null when the table is unknown or exhausted.
export function dealXanatharName({ species, gender, humanCulture = null, virtue = false, usedFirst = new Set(), usedFull = new Set(), rng = null } = {}) {
  if (virtue) {
    const virtues = XANATHAR_NAME_TABLES.tiefling?.virtue;
    if (!virtues) return null;
    const candidates = [...virtues];
    while (candidates.length > 0) {
      const name = pick(candidates, rng);
      candidates.splice(candidates.indexOf(name), 1);
      if (usedFirst.has(norm(name)) || usedFull.has(norm(name))) continue;
      return { fullName: name, personal: name, suffix: null, species: 'tiefling', gender: 'virtue', table: 'Tiefling, Virtue', label: 'Tiefling (virtue name)' };
    }
    return null;
  }
  const list = personalList(species, gender, humanCulture);
  if (!list) return null;
  const suffixes = suffixList(species, gender);
  // Shuffle then iterate the whole list (keeps hands varied, and a
  // nearly-exhausted table still yields its last unused name).
  const tried = new Set();
  const order = shuffled(list, rng);
  for (const personal of order) {
    if (tried.has(personal)) continue;
    tried.add(personal);
    if (usedFirst.has(norm(personal)) || usedFull.has(norm(personal))) continue;
    let suffix = null;
    if (suffixes) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const cand = pick(suffixes, rng);
        if (!usedFull.has(norm(`${personal} ${cand}`))) { suffix = cand; break; }
      }
      // If every sampled suffix collides, fall through with the personal
      // name alone — it is still unused, and no name is invented.
    }
    const fullName = suffix ? `${personal} ${suffix}` : personal;
    if (usedFull.has(norm(fullName))) continue;
    const table = species === 'human'
      ? `${humanCulture}, ${gender}`
      : `${species}, ${gender}`;
    return { fullName, personal, suffix, species, gender, table, label: labelFor(species, gender, humanCulture, false) };
  }
  return null;
}

const SPECIES_SLOTS = [
  { species: 'dragonborn', gender: 'female' },
  { species: 'dragonborn', gender: 'male' },
  { species: 'dwarf', gender: 'female' },
  { species: 'dwarf', gender: 'male' },
  { species: 'elf', gender: 'female' },
  { species: 'elf', gender: 'male' },
  { species: 'elf', gender: 'child' },
  { species: 'gnome', gender: 'female' },
  { species: 'gnome', gender: 'male' },
  { species: 'halfling', gender: 'female' },
  { species: 'halfling', gender: 'male' },
  { species: 'halfOrc', gender: 'female' },
  { species: 'halfOrc', gender: 'male' },
  { species: 'tiefling', gender: 'female' },
  { species: 'tiefling', gender: 'male' },
  { species: 'tiefling', gender: 'virtue', virtue: true },
];

async function resolveNpcNames(dbAll) {
  if (typeof dbAll === 'function') {
    try {
      const rows = await dbAll('SELECT name FROM npcs');
      return (rows || []).map((r) => r?.name).filter(Boolean);
    } catch (e) {
      console.error('[xanathar-names] npcs lookup failed:', e?.message || e);
      return [];
    }
  }
  try {
    const m = await import('../database.js');
    if (typeof m.dbAll === 'function') {
      const rows = await m.dbAll('SELECT name FROM npcs');
      return (rows || []).map((r) => r?.name).filter(Boolean);
    }
  } catch (e) {
    console.error('[xanathar-names] npcs lookup failed:', e?.message || e);
  }
  return [];
}

// Deal a hand of unused names. usedNames is the caller's list (the
// prompt's "already used" names, first names included); dbAll, when
// supplied, is a (sql, params) => rows function like database.js dbAll.
// Never throws on a lookup failure; returns whatever hand could be dealt.
export async function dealAvailableNames({ usedNames = [], dbAll = null, count = 20, rng = null } = {}) {
  const usedFirst = new Set();
  const usedFull = new Set();
  const addUsed = (name) => {
    if (!name) return;
    usedFull.add(norm(name));
    const first = firstToken(name);
    if (first) usedFirst.add(first);
  };
  (Array.isArray(usedNames) ? usedNames : []).forEach(addUsed);
  const npcNames = await resolveNpcNames(dbAll);
  npcNames.forEach(addUsed);

  const entries = [];
  const slots = [...SPECIES_SLOTS];
  const cultures = shuffled(Object.keys(XANATHAR_NAME_TABLES.human || {}), rng);
  cultures.slice(0, 4).forEach((culture, i) => {
    slots.push({ species: 'human', gender: i % 2 === 0 ? 'female' : 'male', humanCulture: culture });
  });
  for (const slot of slots.slice(0, count)) {
    const dealt = dealXanatharName({ ...slot, usedFirst, usedFull, rng });
    if (!dealt) continue;
    entries.push(dealt);
    usedFull.add(norm(dealt.fullName));
    usedFirst.add(norm(dealt.personal));
  }
  return entries;
}

export default { dealAvailableNames, dealXanatharName };
