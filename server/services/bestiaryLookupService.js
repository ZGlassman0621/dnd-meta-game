/**
 * Bestiary Lookup Service (Step 1 — Bestiary expansion, v1.0.194).
 *
 * The canonical 2024 statblocks live in data/bestiaryData.js
 * (BESTIARY_ENTRIES, 356 entries). The bestiary DB table remains the
 * custom/homebrew overlay, resolved in this order:
 *
 *   1. A DB row carrying statblock_json (a true custom/full override)
 *      under the asked name or the resolved book name — wins outright.
 *   2. The canonical data entry (exact key, else the 2024-rename alias:
 *      the DM says "goblin", the 2024 book says "goblin warrior").
 *   3. A legacy DB row (numbers only, no JSON) shaped into the entry
 *      shape — custom creatures the DM defined with bare stats. The
 *      10 seeded legacy rows land here too; their numbers match the
 *      book, but the canonical entry (tier 2) carries the full block,
 *      so seeds never shadow it.
 *
 * Also owns the two snapshot consumers' helpers: typed-damage
 * adjustment (resistance / vulnerability / immunity against the
 * COMBAT_START stats_json snapshot) and condition-immunity matching.
 *
 * Damage-vocab note: the book writes resistances in prose shapes —
 * "bludgeoning, piercing, and slashing from nonmagical attacks",
 * "bludgeoning (nonmagical)", "...that aren't silvered". Matching
 * normalizes case and list structure; a "nonmagical" qualifier means
 * the entry only applies to nonmagical damage (weapon hits count as
 * nonmagical — magic weapons are not modeled; silvered/adamantine
 * qualifiers are treated as satisfied for ordinary gear). A
 * "damage from spells" token applies to any spell damage.
 *
 * Overlay reads: bestiaryService.js (read 2026-10-21) confirms the
 * table's columns — name (lowercase key), display_name, max_hp,
 * armor_class, attack_bonus, damage_dice, dex_mod, challenge_rating,
 * xp_value, source (+ statblock_json from migration 085). The row
 * reads below stay mildly defensive (a display_name fallback, hp/ac
 * aliases) at no cost; this module could fold into bestiaryService.js
 * later with zero behavior change.
 */
import { dbGet } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { BESTIARY_ENTRIES } from '../data/bestiaryData.js';

export function normalizeBestiaryName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** 2024 renames, derived from the data: a "<base> warrior" key whose
 *  base is not itself a key aliases the base name (goblin → goblin
 *  warrior, bugbear → bugbear warrior, orc → orc warrior, …). */
export const BESTIARY_NAME_ALIASES = (() => {
  const map = {};
  for (const key of Object.keys(BESTIARY_ENTRIES)) {
    if (!key.endsWith(' warrior')) continue;
    const base = key.slice(0, -' warrior'.length);
    if (base && !BESTIARY_ENTRIES[base] && !map[base]) map[base] = key;
  }
  return map;
})();

export function resolveBestiaryKey(name) {
  const n = normalizeBestiaryName(name);
  if (!n) return null;
  if (BESTIARY_ENTRIES[n]) return n;
  const alias = BESTIARY_NAME_ALIASES[n];
  if (alias && BESTIARY_ENTRIES[alias]) return alias;
  return null;
}

export function abilityMod(score) {
  return Math.floor(((score ?? 10) - 10) / 2);
}

/** The block's primary attack line for the legacy combat columns:
 *  first melee/ranged action with an attack bonus and damage, else
 *  the first action with damage at all. Multiattack never qualifies
 *  (it has no single damage line) unless nothing else exists. */
export function primaryActionFor(entry) {
  const acts = entry?.actions || [];
  const withDmg = (a) => Array.isArray(a?.damage) && a.damage.length > 0;
  const pick = acts.find(a => (a.kind === 'melee' || a.kind === 'ranged') && a.attackBonus != null && withDmg(a))
    || acts.find(a => a.attackBonus != null && withDmg(a))
    || acts.find(withDmg);
  if (!pick) return null;
  const first = pick.damage[0] || {};
  return { name: pick.name, attackBonus: pick.attackBonus ?? null, damageDice: first.dice ?? null, damageType: first.type ?? null };
}

/** Shape a legacy bestiary DB row (numbers only) into the entry
 *  shape. Fields the row never had stay empty/null — consumers treat
 *  a null abilities block as "fall back to the old estimates". */
export function shapeLegacyBestiaryRow(row) {
  if (!row) return null;
  const name = row.display_name ?? row.name;
  if (!name) return null;
  const attackBonus = row.attack_bonus ?? null;
  const damageDice = row.damage_dice ?? null;
  return {
    name,
    cr: row.challenge_rating != null ? String(row.challenge_rating) : (row.cr != null ? String(row.cr) : '1'),
    xp: row.xp_value ?? row.xp ?? 0,
    size: 'Medium', type: 'custom', alignment: 'unaligned',
    ac: row.armor_class ?? row.ac ?? 12,
    hp: row.max_hp ?? row.hp ?? 10,
    hitDice: null, speed: '30 ft.',
    abilities: null,
    saves: {}, skills: {},
    resistances: [], vulnerabilities: [], immunities: [], conditionImmunities: [],
    senses: '', languages: '',
    traits: [],
    actions: attackBonus != null
      ? [{ name: 'Attack', kind: 'melee', attackBonus, damage: damageDice ? [{ dice: damageDice, type: 'physical' }] : [], text: '' }]
      : [],
    bonusActions: [], reactions: [], legendaryActions: [],
    spellcasting: null,
    legacy: true, dexMod: row.dex_mod ?? 0,
    sourceBook: 'custom'
  };
}

async function overlayRowByName(name) {
  const n = normalizeBestiaryName(name);
  if (!n) return null;
  // The table's name column is read defensively (see header note):
  // try `name`, fall back to `display_name` if the column is absent.
  try {
    const row = await dbGet('SELECT * FROM bestiary WHERE LOWER(name) = LOWER(?) LIMIT 1', [name]);
    if (row) return row;
  } catch { /* column may not exist — try the other shape */ }
  try {
    const row = await dbGet('SELECT * FROM bestiary WHERE LOWER(display_name) = LOWER(?) LIMIT 1', [name]);
    if (row) return row;
  } catch { /* no overlay table access — canonical data still resolves */ }
  return null;
}

function rowEntry(row) {
  if (!row) return null;
  const parsed = safeParse(row.statblock_json, null);
  if (parsed && typeof parsed === 'object' && parsed.abilities) return parsed;
  return null;
}

/** Full statblock for a creature name, per the resolution order in
 *  the header. Returns the entry object, or null when unknown. */
export async function lookupBestiaryFull(name) {
  const n = normalizeBestiaryName(name);
  if (!n) return null;
  const key = resolveBestiaryKey(n);
  const bookName = key ? BESTIARY_ENTRIES[key].name : null;

  // Tier 1: a DB row with a full JSON block (asked name, then book name).
  const rowA = await overlayRowByName(name).catch(() => null);
  if (rowEntry(rowA)) return rowEntry(rowA);
  let rowB = null;
  if (bookName && normalizeBestiaryName(bookName) !== n) {
    rowB = await overlayRowByName(bookName).catch(() => null);
    if (rowEntry(rowB)) return rowEntry(rowB);
  }
  // Tier 2: canonical data. A numbers-only row NEVER shadows the
  // canonical block — not even under the book name (the seeded legacy
  // rows live there, and their numbers-only shape would strip the
  // saves/resistances this step exists to provide).
  if (key) return BESTIARY_ENTRIES[key];
  // Tier 3: legacy-shaped overlay rows (asked name, then book name).
  if (rowA) return shapeLegacyBestiaryRow(rowA);
  if (rowB) return shapeLegacyBestiaryRow(rowB);
  return null;
}

// ---------------------------------------------------------------------------
// Snapshot consumers: typed damage + condition immunities
// ---------------------------------------------------------------------------

const DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
  'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];

function tokenMatchesType(token, type, magical) {
  const t = String(token || '').toLowerCase().trim();
  if (!t) return false;
  if (t === 'damage from spells') return magical === true;
  if (t.includes('nonmagical') && magical) return false;
  const cleaned = t.replace(/\([^)]*\)/g, ' ');
  const parts = cleaned.split(/,|\band\b/).map(s => s.trim()).filter(Boolean);
  return parts.some(part => part === type || part.startsWith(type + ' '));
}

/** Resistance / vulnerability / immunity for one typed damage packet
 *  against a statblock (usually the combat_enemies stats_json
 *  snapshot). Returns null when nothing applies, else
 *  { immune, resistant, vulnerable, label }. Untyped or pseudo-typed
 *  damage ('physical', 'spell') never matches — stated approximation. */
export function damageAdjustmentFor(entry, damageType, { magical = false } = {}) {
  if (!entry || !damageType) return null;
  const type = String(damageType).toLowerCase().trim();
  if (!DAMAGE_TYPES.includes(type)) return null;
  const hit = (list) => (list || []).some(tok => tokenMatchesType(tok, type, magical));
  const immune = hit(entry.immunities);
  const resistant = !immune && hit(entry.resistances);
  const vulnerable = !immune && hit(entry.vulnerabilities);
  if (!immune && !resistant && !vulnerable) return null;
  return {
    immune, resistant, vulnerable,
    label: immune ? 'immune' : resistant && vulnerable ? 'resistant+vulnerable' : resistant ? 'resistant' : 'vulnerable'
  };
}

/** Does a conditionImmunities list (book vocabulary, mixed case,
 *  'Exhaustion' for the whole family) cover this engine condition
 *  key ('poisoned', 'exhaustion_3', …)? */
export function conditionImmunityMatch(conditionImmunities, key) {
  if (!Array.isArray(conditionImmunities) || !key) return false;
  const base = key.startsWith('exhaustion') ? 'exhaustion' : key;
  return conditionImmunities.some(c => String(c).toLowerCase().trim() === base);
}

/** One compact DM-facing line per enemy: the traits, actions and
 *  spellcasting the DM should narrate from (COMBAT_START digest). */
export function bestiaryDigestLine(entry) {
  if (!entry?.name) return null;
  const bits = [];
  if (entry.traits?.length) bits.push(`Traits: ${entry.traits.map(t => t.name).join(', ')}`);
  const acts = (entry.actions || []).map(a => a.name).filter(Boolean);
  if (acts.length) bits.push(`Actions: ${acts.join(', ')}`);
  const bonus = (entry.bonusActions || []).map(a => a.name).filter(Boolean);
  if (bonus.length) bits.push(`Bonus actions: ${bonus.join(', ')}`);
  const reacts = (entry.reactions || []).map(a => a.name).filter(Boolean);
  if (reacts.length) bits.push(`Reactions: ${reacts.join(', ')}`);
  if (entry.spellcasting) {
    const sc = entry.spellcasting;
    const spells = [];
    for (const list of Object.values(sc.spells || {})) {
      if (Array.isArray(list)) spells.push(...list);
    }
    bits.push(`Spellcasting: DC ${sc.dc}, attack +${sc.attackBonus}${spells.length ? `; spells: ${spells.slice(0, 10).join(', ')}` : ''}`);
  }
  if (entry.legendaryActions?.length) bits.push(`Legendary actions: ${entry.legendaryActions.map(a => a.name).join(', ')}`);
  if (!bits.length) return null;
  return `${entry.name} — ${bits.join('. ')}`;
}

export default { normalizeBestiaryName, BESTIARY_NAME_ALIASES, resolveBestiaryKey, abilityMod,
  primaryActionFor, shapeLegacyBestiaryRow, lookupBestiaryFull,
  damageAdjustmentFor, conditionImmunityMatch, bestiaryDigestLine };
