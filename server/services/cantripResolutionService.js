// server/services/cantripResolutionService.js — creator-next Stage 2
// (2026-11-04, overnight Stage 2 build).
//
// Pure cantrip resolution: which cantrips a new character is GRANTED
// (as opposed to chosen from the class cantrip list), and the rule
// that granted cantrips NEVER count against cantrips known/prepared
// (Zach's ruling, 2026-11-04).
//
// Pure means: no database imports anywhere in this module. The two
// registry imports below (speciesService, subclassService, spell
// catalog) are pure data lookups — no session state, no DB — so this
// module is harness-testable standalone with plain node.
//
// Sources, in dedup priority order (first source wins on a repeat):
//   1. species — innateSpellsFor(species, variant), cantrips only
//      (entry.level === 0; entries carrying `choose` are a PENDING
//      CHOICE, never an invented spell — e.g. High Elf "choose 1
//      wizard cantrip" resolves to choicesPending, not to a spell).
//   2. subclass — the subclass registry entry's feature mechanics.
//      FIELD EVIDENCE (grep of server/data/subclasses/*.js, 2026-11-04):
//      there is NO dedicated cantrip-grant field on registry entries.
//      Grants live in free-form `features[].mechanics.cantrip`
//      (singular string) on a handful of entries, e.g.:
//        - druid Circle of Spores: 'Chill Touch (learned at selection)'
//        - cleric Grave Domain: 'you learn Spare the Dying, ...'
//        - cleric Revelry Domain: 'Prestidigitation'
//        - monk Shadow Arts: 'Minor Illusion'
//        - monk Elements: 'Elementalism'
//      Only a single CONCRETE spell name that the catalog confirms
//      is level 0 is granted from this field. Two shapes are NOT
//      granted and are reported as choicesPending instead:
//        - a choice phrase ('one cantrip from the Druid spell list',
//          College of the Moon Primal Lore; 'Prestidigitation or
//          Druidcraft', Arcane Archer lore — the latter IS granted
//          once the player picks, via subclassChoices, below);
//        - the plural `mechanics.cantrips` array, which on its sole
//          occurrence (Fighter Eldritch Knight) is an EXAMPLE list
//          ('Fire Bolt', 'True Strike', ...), not a grant — the
//          entry's own note says individual choices are not stored.
//      Subclass CHOICES that name a cantrip (entry.choices keys
//      containing 'cantrip', e.g. arcane_archer_lore_cantrip) grant
//      the picked value once the caller passes it in subclassChoices.
//      Scion of the Three's dread_allegiance choice maps to a cantrip
//      (Bane -> Minor Illusion, Bhaal -> Blade Ward,
//      Myrkul -> Chill Touch) per its mechanics.benefits text.
//   3. feat — an explicit featCantrips array passed by the caller.
//      FEAT GAP (2026-11-04): no structured feat-cantrip data source
//      exists in this mirror. There is no server/data/featRegistry.js
//      (subclassService's header mentions one, but the file is absent),
//      and ancestry feats live in DB tables (ancestry_feats), not in a
//      pure module this service may import. So feat cantrips are an
//      INPUT, never invented here: pass the feat's cantrip names and
//      they are filtered to level 0 exactly like the other sources.
//      A feat cantrip with no catalog entry lands in `unresolved`,
//      never in the granted list.
//
// Every granted item is { spell, source, granted: true } and the
// module-level flag grantedCantripsNeverCount() is true: granted
// cantrips sit OUTSIDE the class cantripsKnown count (classes.json
// spellcasting.cantripsKnown / levelProgression getCantripsKnown).

import { innateSpellsFor } from './speciesService.js';
import { getSubclass } from './subclassService.js';
import { lookupSpell } from '../data/spellCatalog.js';

export const GRANTED_CANTRIPS_NEVER_COUNT = true;

export function grantedCantripsNeverCount() {
  return true;
}

export function normalizeSpellName(name) {
  return String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** True only when the spell catalog confirms the name is a level-0 spell. */
export function isCatalogCantrip(name) {
  const entry = lookupSpell(name);
  return !!entry && Number(entry.level) === 0;
}

/** Display name for a catalog spell (catalog keys are lowercase). */
function displayName(name) {
  return String(name || '').trim();
}

function stripParenthetical(text) {
  return String(text || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
}

// A mechanics.cantrip string is a concrete grant only when it names
// exactly one catalog cantrip. Choice phrasing ("one cantrip from…",
// "X or Y") is a pending choice, not a grant. A sentence grant
// ("you learn Spare the Dying, which does not count…") grants the
// single cantrip it names.
function parseMechanicsCantrip(raw) {
  const text = stripParenthetical(raw);
  if (!text) return { kind: 'none' };
  if (/^one cantrip from/i.test(text) || /\bor\b/i.test(text)) {
    return { kind: 'choice', detail: text };
  }
  if (/^[a-z' -]+$/i.test(text)) return { kind: 'grant', spell: text };
  const words = text.split(/\s+/);
  const found = [];
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const candidate = words.slice(i, i + n).join(' ').replace(/[^a-z' -]/gi, '').trim();
      if (candidate && isCatalogCantrip(candidate) && !found.some(f => normalizeSpellName(f) === normalizeSpellName(candidate))) {
        found.push(candidate);
      }
    }
  }
  if (found.length === 1) return { kind: 'grant', spell: found[0] };
  return { kind: 'choice', detail: text };
}

const DREAD_ALLEGIANCE_CANTRIPS = {
  bane: 'Minor Illusion',
  bhaal: 'Blade Ward',
  myrkul: 'Chill Touch',
};

function pushUnique(list, seen, spell, source) {
  const key = normalizeSpellName(spell);
  if (!key || seen.has(key)) return;
  seen.add(key);
  list.push({ spell: displayName(spell), source, granted: true });
}

/**
 * resolveCantrips({ species, variant, speciesInnateSpells,
 *   classId, subclass, subclassEntry, subclassChoices, featCantrips })
 *
 * - species: species id/name string (resolved via innateSpellsFor),
 *   or null when the caller already passes speciesInnateSpells.
 * - speciesInnateSpells: array of innate-spell entries (objects with
 *   { name, level } or { choose, class, level }, or plain strings).
 * - subclass: subclass name string (resolved via getSubclass with
 *   classId), or null when subclassEntry is passed directly.
 * - subclassChoices: { choiceKey: value | [values] } — values for
 *   cantrip-naming choices grant their picked cantrip.
 * - featCantrips: array of spell names or { name, level } objects.
 *
 * Returns { cantrips, choicesPending, unresolved,
 *   grantedNeverCount: true }.
 */
export function resolveCantrips({
  species = null,
  variant = null,
  speciesInnateSpells = null,
  classId = null,
  subclass = null,
  subclassEntry = null,
  subclassChoices = {},
  featCantrips = [],
} = {}) {
  const cantrips = [];
  const choicesPending = [];
  const unresolved = [];
  const seen = new Set();

  // 1. Species innate spells (cantrips only).
  let innate = speciesInnateSpells;
  if (innate == null && species) {
    try { innate = innateSpellsFor(species, variant) || []; } catch { innate = []; }
  }
  for (const entry of Array.isArray(innate) ? innate : []) {
    if (typeof entry === 'string') {
      if (isCatalogCantrip(entry)) pushUnique(cantrips, seen, entry, 'species');
      else unresolved.push({ spell: entry, source: 'species', reason: 'not a level-0 spell in the catalog' });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    if (entry.choose) {
      choicesPending.push({
        source: 'species',
        detail: `choose ${entry.choose} cantrip${entry.choose === 1 ? '' : 's'} from the ${entry.class || ''} spell list`.trim(),
      });
      continue;
    }
    const name = entry.name;
    if (!name) continue;
    const level = entry.level != null ? Number(entry.level) : (lookupSpell(name)?.level ?? null);
    if (level === 0) pushUnique(cantrips, seen, name, 'species');
    else if (level != null) { /* levelled innate spell: not a cantrip, correctly skipped */ }
    else unresolved.push({ spell: name, source: 'species', reason: 'not found in the spell catalog' });
  }

  // 2. Subclass grants.
  let entry = subclassEntry || null;
  if (!entry && classId && subclass) {
    try { entry = getSubclass(classId, subclass) || null; } catch { entry = null; }
  }
  if (entry) {
    for (const feature of entry.features || []) {
      const mechanics = feature?.mechanics || {};
      if (typeof mechanics.cantrip === 'string' && mechanics.cantrip.trim()) {
        const parsed = parseMechanicsCantrip(mechanics.cantrip);
        if (parsed.kind === 'grant') {
          if (isCatalogCantrip(parsed.spell)) pushUnique(cantrips, seen, parsed.spell, 'subclass');
          else unresolved.push({ spell: parsed.spell, source: 'subclass', reason: 'not a level-0 spell in the catalog' });
        } else if (parsed.kind === 'choice') {
          choicesPending.push({ source: 'subclass', detail: parsed.detail, feature: feature.key || feature.name || null });
        }
      }
      // mechanics.cantrips (plural) is deliberately NOT granted: its
      // sole occurrence is the Eldritch Knight example list.
    }
    // Subclass choices that pick a cantrip grant the picked cantrip.
    for (const [key, value] of Object.entries(subclassChoices || {})) {
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) {
        if (typeof v !== 'string' || !v.trim()) continue;
        if (key === 'dread_allegiance') {
          const mapped = DREAD_ALLEGIANCE_CANTRIPS[normalizeSpellName(v)];
          if (mapped) pushUnique(cantrips, seen, mapped, 'subclass');
          continue;
        }
        if (key.toLowerCase().includes('cantrip') && isCatalogCantrip(v)) {
          pushUnique(cantrips, seen, v, 'subclass');
        }
      }
    }
  }

  // 3. Feat cantrips (caller-supplied; see FEAT GAP in the header).
  for (const feat of Array.isArray(featCantrips) ? featCantrips : []) {
    const name = typeof feat === 'string' ? feat : feat?.name;
    if (!name) continue;
    const level = typeof feat === 'object' && feat.level != null
      ? Number(feat.level)
      : (lookupSpell(name)?.level ?? null);
    if (level === 0) pushUnique(cantrips, seen, name, 'feat');
    else if (level == null) unresolved.push({ spell: name, source: 'feat', reason: 'not found in the spell catalog' });
    // Levelled feat spells are correctly skipped, not cantrips.
  }

  return { cantrips, choicesPending, unresolved, grantedNeverCount: true };
}

export default {
  resolveCantrips,
  grantedCantripsNeverCount,
  GRANTED_CANTRIPS_NEVER_COUNT,
  normalizeSpellName,
  isCatalogCantrip,
};
