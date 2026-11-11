// server/services/packageResolutionService.js — resolve a Stage 5
// (Gear & Story) starting package into inventory items + gold.
//
// The packages live in server/data/startingPackages.js; the equipment
// truth lives in server/data/equipment2024.js (2024 PHB Ch. 6). This
// service is the only place the two meet: fixed items resolve by exact
// chapter name, category picks are validated as members of the named
// category, and an invalid pick is a field-named error, never silently
// dropped.
//
// Picks shape: an object keyed by the `key` on each choice entry in the
// chosen option, e.g. { instrument: ['Lute'], holy: { alternative: 0 } }.
//   - sentinel `from` ("any_simple_weapon", ...) -> picks[key] is an
//     array of `count` item names, each a member of that category.
//   - array `from` (alternatives) -> picks[key] is { alternative: index }
//     into the array. A nested choice inside the taken alternative is
//     answered under its own key, and only then.
// Missing, mistyped, out-of-category, out-of-range, unknown, and
// stale-branch picks all fail with field `picks.<key>`.
//
// Grant-once: the resolved list never contains the same name twice. When
// two entries grant the same item (a chosen pick naming an already-given
// item, or the same fixed item twice in the data), the row is kept once
// with the greater quantity — the item is granted once, not twice.
//
// Proficiency conditions ("(if proficient)" branches in the warlord /
// warden books) are carried on the branch as `condition` and shown by the
// UI. This resolver does NOT enforce them: it has no proficiency data.
// Enforcing them belongs to the Stage 5 server validator, which knows the
// character's proficiencies; silently refusing a branch here would be a
// worse lie than passing it through labelled.
import {
  WEAPONS,
  ARMOR,
  SHIELD,
  TOOLS,
  ADVENTURING_GEAR,
  AMMUNITION,
  FOCUSES,
  PACKS,
} from '../data/equipment2024.js';
import { STARTING_PACKAGES, GOLD_SOURCES } from '../data/startingPackages.js';

// ------------------------------------------------------------ categories
// Membership is derived from the equipment data, never hardcoded lists,
// so a chapter correction flows through automatically.
function weaponNames(pred) {
  return WEAPONS.filter(pred).map((w) => w.name);
}
function toolNames(pred) {
  return TOOLS.filter(pred).map((t) => t.name);
}

const TOOL_KIT_NAMES = [
  'Disguise Kit',
  'Forgery Kit',
  'Herbalism Kit',
  "Navigator's Tools",
  "Poisoner's Kit",
  "Thieves' Tools",
];
// The chapter has no "tool kit" category; the kits above are the six
// kit-named tools in the chapter (judgment call — see staging note).
// `any_tool` is every entry in the chapter Tools table, instruments and
// gaming sets included: the scholar's "any two tools or tool kits".

export const CATEGORY_MEMBERS = {
  any_simple_weapon: weaponNames((w) => w.category === 'simple'),
  any_simple_melee_weapon: weaponNames((w) => w.category === 'simple' && w.rangeType === 'melee'),
  any_martial_weapon: weaponNames((w) => w.category === 'martial'),
  any_martial_melee_weapon: weaponNames((w) => w.category === 'martial' && w.rangeType === 'melee'),
  any_artisan_tool: toolNames((t) => t.category === 'artisan'),
  any_tool: toolNames(() => true),
  any_tool_kit: TOOL_KIT_NAMES.filter((n) => toolNames(() => true).includes(n)),
  any_musical_instrument: toolNames((t) => t.category === 'instrument'),
  any_gaming_set: toolNames((t) => t.category === 'gaming'),
};

const CATEGORY_LABELS = {
  any_simple_weapon: 'a simple weapon',
  any_simple_melee_weapon: 'a simple melee weapon',
  any_martial_weapon: 'a martial weapon',
  any_martial_melee_weapon: 'a martial melee weapon',
  any_artisan_tool: "an artisan's tool",
  any_tool: 'a tool',
  any_tool_kit: 'a tool kit',
  any_musical_instrument: 'a musical instrument',
  any_gaming_set: 'a gaming set',
};

/** Member names for a sentinel, or null for an unknown sentinel. */
export function categoryMembers(sentinel) {
  const members = CATEGORY_MEMBERS[sentinel];
  return members ? [...members] : null;
}

// ------------------------------------------------------------ name index
// Canonical chapter names, plus the chapter-external items a package may
// legitimately grant (see startingPackages.js header), plus aliases for
// the free-text names classes.json uses ("Leather Armor" x13) so a
// client submitting those strings still resolves to the canonical item.
export const PACKAGE_ONLY_ITEMS = {
  Spellbook: 'Wizard class item (PHB class chapter, not Equipment Ch. 6)',
  Sabre: 'Duelist own-book weapon (Duelist Class Overview)',
  'A Worn Leather-Bound Journal': 'Keeper flavour given item (classes.json)',
};

const NAME_ALIASES = {
  'leather armor': 'Leather',
  'studded leather armor': 'Studded Leather',
  '20 arrows': 'Arrows (20)',
  arrows: 'Arrows (20)',
  '20 bolts': 'Crossbow Bolts (20)',
  bolts: 'Crossbow Bolts (20)',
  '20 crossbow bolts': 'Crossbow Bolts (20)',
  'bag of 1000 ball bearings': 'Ball Bearings',
  'bag of 1,000 ball bearings': 'Ball Bearings',
  'firearm bullets': 'Firearm Bullets (10)',
  '20 bullets': 'Firearm Bullets (10)',
};

function buildNameIndex() {
  const index = new Map(); // lowercase name -> canonical name
  const add = (name) => index.set(String(name).toLowerCase(), name);
  for (const w of WEAPONS) add(w.name);
  for (const a of ARMOR) add(a.name);
  add(SHIELD.name);
  for (const t of TOOLS) add(t.name);
  for (const g of ADVENTURING_GEAR) add(g.name);
  for (const a of AMMUNITION) add(a.name);
  for (const f of [...FOCUSES.arcane, ...FOCUSES.druidic, ...FOCUSES.holy]) add(f.name);
  for (const p of Object.keys(PACKS)) add(p);
  for (const n of Object.keys(PACKAGE_ONLY_ITEMS)) add(n);
  return index;
}
const NAME_INDEX = buildNameIndex();

/**
 * Resolve a submitted item name to its canonical chapter name, or null
 * when it names nothing the equipment data knows. Exact match first,
 * then case-insensitive, then the free-text aliases above.
 */
export function resolveItemName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const direct = NAME_INDEX.get(trimmed.toLowerCase());
  if (direct) return direct;
  const aliased = NAME_ALIASES[trimmed.toLowerCase()];
  if (aliased && NAME_INDEX.get(aliased.toLowerCase())) return aliased;
  return null;
}

function isFixedEntry(entry) {
  return entry && typeof entry.name === 'string' && typeof entry.quantity === 'number';
}
function isChoiceEntry(entry) {
  return entry && typeof entry.key === 'string' && typeof entry.choose === 'number'
    && typeof entry.count === 'number' && 'from' in entry;
}
function isBundle(entry) {
  return entry && Array.isArray(entry.items);
}

// An alternative normalises to a list of entries: a bare array is itself,
// { items } unwraps, a fixed item or a choice entry stands alone.
function alternativeEntries(alternative) {
  if (Array.isArray(alternative)) return alternative;
  if (isBundle(alternative)) return alternative.items;
  return [alternative];
}

// Every choice key in the option, all branches (used to catch unknown picks).
function collectChoiceKeys(entries, into = new Set()) {
  for (const entry of entries || []) {
    if (isChoiceEntry(entry)) {
      into.add(entry.key);
      if (Array.isArray(entry.from)) {
        for (const alt of entry.from) collectChoiceKeys(alternativeEntries(alt), into);
      }
    } else if (isBundle(entry)) {
      collectChoiceKeys(entry.items, into);
    } else if (Array.isArray(entry)) {
      collectChoiceKeys(entry, into);
    }
  }
  return into;
}

function err(field, message) {
  return { field, message };
}

// ---------------------------------------------------------------- resolve
function resolveEntries(entries, picks, state) {
  for (const entry of entries || []) {
    if (isFixedEntry(entry)) {
      const canonical = resolveItemName(entry.name);
      if (!canonical) {
        state.errors.push(err('items', `Unknown item "${entry.name}" — not in the 2024 equipment chapter`));
        continue;
      }
      grant(state.granted, canonical, entry.quantity);
      continue;
    }
    if (isChoiceEntry(entry)) {
      resolveChoice(entry, picks, state);
      continue;
    }
    if (isBundle(entry)) {
      resolveEntries(entry.items, picks, state);
      continue;
    }
    if (Array.isArray(entry)) {
      resolveEntries(entry, picks, state);
      continue;
    }
    state.errors.push(err('items', `Unrecognised package entry: ${JSON.stringify(entry)}`));
  }
}

// Grant-once: one row per name, keeping the greater quantity.
function grant(granted, name, quantity) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  granted.set(name, Math.max(granted.get(name) || 0, qty));
}

function resolveChoice(entry, picks, state) {
  const field = `picks.${entry.key}`;
  state.requiredKeys.add(entry.key);
  const pick = picks[entry.key];

  if (typeof entry.from === 'string') {
    const members = CATEGORY_MEMBERS[entry.from];
    if (!members) {
      state.errors.push(err(field, `Unknown category "${entry.from}" for "${entry.label || entry.key}"`));
      return;
    }
    if (pick === undefined) {
      state.errors.push(err(field, `Choose ${entry.count} ${CATEGORY_LABELS[entry.from] || entry.from}${entry.label ? ` (${entry.label})` : ''}`));
      return;
    }
    if (!Array.isArray(pick)) {
      state.errors.push(err(field, `Pick for "${entry.label || entry.key}" must be a list of ${entry.count} ${CATEGORY_LABELS[entry.from] || entry.from}`));
      return;
    }
    if (pick.length !== entry.count) {
      state.errors.push(err(field, `Pick ${entry.count} ${CATEGORY_LABELS[entry.from] || entry.from} for "${entry.label || entry.key}", got ${pick.length}`));
      return;
    }
    // Within one pick, identical names sum: picking the same weapon
    // twice for a count-2 pick is two physical items. Across entries,
    // grant() keeps the greater quantity (grant-once).
    const tally = new Map();
    for (const name of pick) {
      const canonical = resolveItemName(name);
      if (!canonical || !members.includes(canonical)) {
        state.errors.push(err(field, `"${name}" is not ${CATEGORY_LABELS[entry.from] || entry.from}`));
        continue;
      }
      tally.set(canonical, (tally.get(canonical) || 0) + 1);
    }
    for (const [canonical, n] of tally) grant(state.granted, canonical, n);
    return;
  }

  if (Array.isArray(entry.from)) {
    if (pick === undefined) {
      state.errors.push(err(field, `Choose one option for "${entry.label || entry.key}"`));
      return;
    }
    if (!pick || typeof pick !== 'object' || Array.isArray(pick)
      || !Number.isInteger(pick.alternative)) {
      state.errors.push(err(field, `Pick for "${entry.label || entry.key}" must be { alternative: <index> }`));
      return;
    }
    const index = pick.alternative;
    if (index < 0 || index >= entry.from.length) {
      state.errors.push(err(field, `Alternative ${index} is out of range for "${entry.label || entry.key}" (0–${entry.from.length - 1})`));
      return;
    }
    resolveEntries(alternativeEntries(entry.from[index]), picks, state);
    return;
  }

  state.errors.push(err(field, `Choice "${entry.label || entry.key}" has an unrecognised "from" value`));
}

/**
 * Resolve a package option into inventory items + gold.
 * Returns { ok, items: [{ name, quantity }], gold, errors }.
 * `picks` is an object keyed by choice-entry key (see header).
 * On any error, items/gold are still the partial resolution so the caller
 * can show what did resolve; ok is false and errors name the fields.
 */
export function resolvePackage(classId, optionId, picks = {}) {
  const errors = [];
  const pkg = STARTING_PACKAGES[classId];
  if (!pkg) {
    return { ok: false, items: [], gold: 0, errors: [err('classId', `Unknown class: ${classId}`)] };
  }
  const option = pkg.options.find((o) => o.id === optionId);
  if (!option) {
    return {
      ok: false,
      items: [],
      gold: 0,
      errors: [err('optionId', `Unknown package option "${optionId}" for ${classId} (has: ${pkg.options.map((o) => o.id).join(', ')})`)],
    };
  }
  if (!picks || typeof picks !== 'object' || Array.isArray(picks)) {
    return { ok: false, items: [], gold: 0, errors: [err('picks', 'picks must be an object keyed by choice key')] };
  }

  const state = { granted: new Map(), errors, requiredKeys: new Set() };
  resolveEntries(option.items, picks, state);

  const knownKeys = collectChoiceKeys(option.items);
  for (const key of Object.keys(picks)) {
    if (!knownKeys.has(key)) {
      errors.push(err(`picks.${key}`, `Unknown pick "${key}" for ${classId} option ${optionId}`));
    } else if (!state.requiredKeys.has(key)) {
      errors.push(err(`picks.${key}`, `Pick "${key}" does not apply to the selected alternative`));
    }
  }

  const items = [...state.granted.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: errors.length === 0, items, gold: option.gold || 0, errors };
}

/**
 * Validate a package choice without resolving it for display.
 * Returns { ok, errors }.
 */
export function validatePackageChoice(classId, optionId, picks = {}) {
  const { ok, errors } = resolvePackage(classId, optionId, picks);
  return { ok, errors };
}

/**
 * List a class's package options (deep copy — callers cannot mutate the
 * data). Returns { ok, classId, options, goldOption, errors }.
 */
export function listPackageOptions(classId) {
  const pkg = STARTING_PACKAGES[classId];
  if (!pkg) {
    return { ok: false, classId, options: [], goldOption: null, errors: [err('classId', `Unknown class: ${classId}`)] };
  }
  return {
    ok: true,
    classId,
    options: JSON.parse(JSON.stringify(pkg.options)),
    goldOption: pkg.goldOption ?? null,
    errors: [],
  };
}

/**
 * Gold fork: starting gold for a class, adjusted by a theme modifier.
 * Pure function — the theme modifier is passed in as a number (the
 * server worker owns the theme table; this takes it as an argument).
 * Formula: round(baseline x (1 + themeMod)) — the same half-up rounding
 * as the client applyGoldModifier.
 * Returns { ok, gold, baseline, themeId, themeMod, errors }. A class
 * whose source prints no starting-gold value (goldOption null) fails
 * with an error naming the class and its source — the fork needs a
 * ruling/value, not an invented number.
 */
export function computeGoldFork(classId, themeId, themeMod) {
  const pkg = STARTING_PACKAGES[classId];
  if (!pkg) {
    return { ok: false, gold: 0, baseline: null, themeId, themeMod, errors: [err('classId', `Unknown class: ${classId}`)] };
  }
  const baseline = pkg.goldOption ?? null;
  if (baseline === null) {
    const source = GOLD_SOURCES[classId] || 'classes.json';
    return {
      ok: false,
      gold: 0,
      baseline: null,
      themeId,
      themeMod,
      errors: [err('goldOption', `no starting-gold value for ${classId} in ${source} — the source prints no starting-wealth alternative`)],
    };
  }
  if (typeof themeMod !== 'number' || !Number.isFinite(themeMod)) {
    return { ok: false, gold: 0, baseline, themeId, themeMod, errors: [err('themeMod', 'themeMod must be a finite number')] };
  }
  const gold = Math.round(baseline * (1 + themeMod));
  if (gold < 0) {
    return { ok: false, gold: 0, baseline, themeId, themeMod, errors: [err('themeMod', `themeMod ${themeMod} would reduce ${classId} starting gold below 0`)] };
  }
  return { ok: true, gold, baseline, themeId, themeMod, errors: [] };
}

export default { resolvePackage, validatePackageChoice, listPackageOptions, computeGoldFork, categoryMembers, resolveItemName };
