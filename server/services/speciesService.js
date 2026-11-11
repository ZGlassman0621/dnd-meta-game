// server/services/speciesService.js — species registry lookup (2026-11-04).
//
// The registry is the server's single source of truth for playable
// species (PCs, companions, NPCs — NOT combat enemies; bestiary
// statblocks are untouched). Book files merge by species id: later
// files add variants + origins to an existing entry (same variant name
// replaces the earlier one) so outside-FR books land without editing
// the PHB files. Nothing here reads the client list or the movement
// speed map — those are consumers, and this file replaces them.
//
// Resolution rules (all case-insensitive, hyphens/spaces equivalent):
//   - a plain species id or name ('elf', 'Half-Orc', 'warforged')
//   - a variant stored as the species string ('Wood Elf', 'drow',
//     'Black Dragonborn', 'Variant Human') — old rows store these
//   - species + variant separately ('elf' + 'Wood Elf')
//   - legacy aliases for old stored strings ('human' for bank NPCs,
//     'dark elf' for Drow) so old characters never break.
// Unknown input resolves to null — callers fall back, never invent.
//
// ASI: callers use resolvedASIFor, never base + variant summed. That
// sum is the old double-count bug (dragonborn Str+4/Cha+2, half-elf
// Cha doubled). `choice: N` means N x +1 the player picks (Stage 4).
import { PHBSPECIES } from '../data/species/phbSpecies.js';
import { PHBSPECIES2 } from '../data/species/phbSpecies2.js';
import { VOLOSPECIES } from '../data/species/voloSpecies.js';
import { EBERRONSPECIES } from '../data/species/eberronSpecies.js';
import { WILDEMOUNTSPECIES } from '../data/species/wildemountSpecies.js';
import { WILDEMOUNTSPECIES2 } from '../data/species/wildemountSpecies2.js';
import { RAVNICASPECIES } from '../data/species/ravnicaSpecies.js';
import { EBERRONSPECIES2 } from '../data/species/eberronSpecies2.js';
import { EBERRONMARKS } from '../data/species/eberronMarks.js';

const BOOK_FILES = [PHBSPECIES, PHBSPECIES2, VOLOSPECIES, EBERRONSPECIES, WILDEMOUNTSPECIES, WILDEMOUNTSPECIES2, RAVNICASPECIES, EBERRONSPECIES2, EBERRONMARKS];

function mergeEntries(files) {
  const byId = new Map();
  for (const file of files) {
    for (const entry of file) {
      const existing = byId.get(entry.id);
      if (!existing) { byId.set(entry.id, { ...entry, variants: [...(entry.variants || [])] }); continue; }
      existing.origins = [...new Set([...(existing.origins || []), ...(entry.origins || [])])];
      for (const variant of entry.variants || []) {
        const at = existing.variants.findIndex(v => normKey(v.name) === normKey(variant.name));
        if (at >= 0) existing.variants[at] = variant;
        else existing.variants.push(variant);
      }
    }
  }
  return [...byId.values()];
}

export const SPECIES = mergeEntries(BOOK_FILES);

export function normKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[_]+/g, '-').replace(/\s+/g, '-');
}

// Variant stored as the species string, or a short name for it.
const VARIANT_NAME_ALIASES = {
  'drow': ['elf', 'Dark Elf (Drow)'],
  'dark-elf': ['elf', 'Dark Elf (Drow)'],
  'wood-elf': ['elf', 'Wood Elf'],
  'high-elf': ['elf', 'High Elf'],
  'mountain-dwarf': ['dwarf', 'Mountain Dwarf'],
  'hill-dwarf': ['dwarf', 'Hill Dwarf'],
  'lightfoot-halfling': ['halfling', 'Lightfoot Halfling'],
  'stout-halfling': ['halfling', 'Stout Halfling'],
  'standard-human': ['human', 'Standard Human'],
  'variant-human': ['human', 'Variant Human'],
  'standard-half-elf': ['half-elf', 'Standard Half-Elf'],
  'high-elf-descent': ['half-elf', 'High Elf Descent'],
  'wood-elf-descent': ['half-elf', 'Wood Elf Descent'],
  'drow-descent': ['half-elf', 'Drow Descent'],
  'protector-aasimar': ['aasimar', 'Protector Aasimar'],
  'scourge-aasimar': ['aasimar', 'Scourge Aasimar'],
  'fallen-aasimar': ['aasimar', 'Fallen Aasimar'],
  'forest-gnome': ['gnome', 'Forest Gnome'],
  'rock-gnome': ['gnome', 'Rock Gnome'],
  'draconblood': ['dragonborn', 'Draconblood'],
  'ravenite': ['dragonborn', 'Ravenite'],
  'pallid-elf': ['elf', 'Pallid Elf'],
  'sea-elf': ['elf', 'Sea Elf'],
  'lotusden-halfling': ['halfling', 'Lotusden Halfling'],
  'air-genasi': ['genasi', 'Air Genasi'],
  'earth-genasi': ['genasi', 'Earth Genasi'],
  'fire-genasi': ['genasi', 'Fire Genasi'],
  'water-genasi': ['genasi', 'Water Genasi'],
  'beasthide-shifter': ['shifter', 'Beasthide'],
  'longtooth-shifter': ['shifter', 'Longtooth'],
  'swiftstride-shifter': ['shifter', 'Swiftstride'],
  'wildhunt-shifter': ['shifter', 'Wildhunt'],
  'mark-of-detection': ['half-elf', 'Mark of Detection'],
  'mark-of-storm': ['half-elf', 'Mark of Storm'],
  'mark-of-handling': ['human', 'Mark of Handling'],
  'mark-of-making': ['human', 'Mark of Making'],
  'mark-of-passage': ['human', 'Mark of Passage'],
  'mark-of-sentinel': ['human', 'Mark of Sentinel'],
  'mark-of-healing': ['halfling', 'Mark of Healing'],
  'mark-of-hospitality': ['halfling', 'Mark of Hospitality'],
  'mark-of-warding': ['dwarf', 'Mark of Warding'],
  'mark-of-scribing': ['gnome', 'Mark of Scribing'],
  'mark-of-shadow': ['elf', 'Mark of Shadow'],
};
for (const color of ['black', 'blue', 'brass', 'bronze', 'copper', 'gold', 'green', 'red', 'silver', 'white']) {
  const name = color[0].toUpperCase() + color.slice(1) + ' Dragonborn';
  VARIANT_NAME_ALIASES[color + '-dragonborn'] = ['dragonborn', name];
}

function findSpecies(key) {
  const k = normKey(key);
  return SPECIES.find(e => normKey(e.id) === k || normKey(e.name) === k) || null;
}

function findVariant(entry, variantName) {
  if (!entry || !variantName) return null;
  const k = normKey(variantName);
  return (entry.variants || []).find(v => normKey(v.name) === k) || null;
}

/**
 * Resolve a stored species pick to { entry, variant }.
 * variant is null when the pick names a species with no variant, or a
 * species whose variants were never picked (base traits apply).
 * Returns null when nothing in the registry matches — unknown species
 * are a fallback case for callers, never an invented entry.
 */
export function resolveSpecies(race, subrace) {
  if (subrace) {
    const entry = findSpecies(race);
    if (!entry) return null;
    return { entry, variant: findVariant(entry, subrace) };
  }
  if (!race) return null;
  const alias = VARIANT_NAME_ALIASES[normKey(race)];
  if (alias) {
    const entry = findSpecies(alias[0]);
    return entry ? { entry, variant: findVariant(entry, alias[1]) } : null;
  }
  const entry = findSpecies(race);
  return entry ? { entry, variant: null } : null;
}

export function listSpecies() {
  return SPECIES;
}

// MVP player-species scope (Zach, 2026-11-05): player characters are
// limited to the 11 pre-expansion (v1) species. The 18 outside-FR
// species are NOT removed — they stay in the registry (NPCs can still
// be any of them) and are only grayed out of the player creator.
// Reversible by design: putting a species back is deleting one line
// here. The flag is game policy, so it lives in this service layer,
// never in the book data files.
export const MVP_DEFERRED_SPECIES = new Set([
  'aarakocra', 'firbolg', 'genasi', 'goblin', 'bugbear', 'hobgoblin',
  'kenku', 'tabaxi', 'tortle', 'centaur', 'loxodon', 'minotaur',
  'simic-hybrid', 'vedalken', 'changeling', 'kalashtar', 'shifter', 'orc',
]);

export const MVP_DEFERRED_NOTE = 'Coming after the MVP — NPCs can still be this species.';

/**
 * Is this species pick creatable as a player character in the MVP?
 * Resolves through resolveSpecies, so variant strings ('Air Genasi')
 * and species+variant picks judge by their entry. Unknown species
 * resolve to null and stay creatable — the v1 rule (no POST rejection
 * of unknown species) is preserved; only known deferred species refuse.
 */
export function isPcCreatable(race, subrace) {
  const resolved = resolveSpecies(race, subrace);
  if (!resolved) return true;
  return !MVP_DEFERRED_SPECIES.has(normKey(resolved.entry.id));
}

/**
 * Sizes a character of this species may be: the entry's `sizes`
 * choice list when it has one (2024 human: Medium or Small, PHB
 * p. 194), else the entry's single size. Null when the species is
 * unknown (unjudgeable — draft-tolerant callers skip validation).
 */
export function allowedSizesFor(race, subrace) {
  const resolved = resolveSpecies(race, subrace);
  if (!resolved) return null;
  const entry = resolved.entry;
  if (Array.isArray(entry.sizes) && entry.sizes.length) return [...entry.sizes];
  return entry.size ? [entry.size] : null;
}

export function walkSpeedFor(race, subrace) {
  const resolved = resolveSpecies(race, subrace);
  if (!resolved) return null;
  const variantSpeed = resolved.variant?.speeds?.walk;
  if (Number.isFinite(variantSpeed) && variantSpeed > 0) return variantSpeed;
  const baseSpeed = resolved.entry?.speeds?.walk;
  return Number.isFinite(baseSpeed) && baseSpeed > 0 ? baseSpeed : null;
}

export function traitListFor(race, subrace) {
  const resolved = resolveSpecies(race, subrace);
  if (!resolved) return [];
  return resolved.variant ? (resolved.variant.traits || []) : (resolved.entry.traits || []);
}

export function resolvedASIFor(race, subrace) {
  const resolved = resolveSpecies(race, subrace);
  if (!resolved) return null;
  if (resolved.variant) return resolved.variant.resolvedASI || null;
  return resolved.entry.abilityScoreIncrease || {};
}

export function innateSpellsFor(race, subrace) {
  const resolved = resolveSpecies(race, subrace);
  if (!resolved) return [];
  return resolved.variant?.innateSpells?.length
    ? resolved.variant.innateSpells
    : (resolved.entry.innateSpells || []);
}

export function isOutsideFRSetting(setting) {
  const s = String(setting || '').trim().toLowerCase();
  if (!s || s === '__other__') return true;
  return s !== 'forgotten realms';
}

/**
 * One-line species readout for the DM prompt: name, speed, languages,
 * and the full trait list of the picked species+variant. Empty string
 * when the species is not in the registry (caller omits the line).
 * `size` is the stored per-character size choice (migration 110) —
 * printed only when given, so legacy rows with no choice recorded
 * read exactly as before.
 */
export function formatSpeciesLine(race, subrace, size) {
  const resolved = resolveSpecies(race, subrace);
  if (!resolved) return '';
  const { entry, variant } = resolved;
  const name = variant ? `${entry.name} (${variant.name})` : entry.name;
  const speed = walkSpeedFor(race, subrace);
  const traits = traitListFor(race, subrace);
  const parts = [`Species: ${name}`];
  if (typeof size === 'string' && size.trim()) parts.push(`Size ${size.trim()}`);
  if (speed) parts.push(`Speed ${speed} ft`);
  if (entry.languages?.length) parts.push(`Languages: ${entry.languages.join(', ')}`);
  if (traits.length) parts.push(`Traits: ${traits.join('; ')}`);
  return parts.join(' — ');
}

/**
 * Origin line for the DM prompt. Rules, following the Artificer origin
 * precedent exactly: a stored explanation is shown as written; an
 * outside-FR origin without one is FLAGGED, never invented; a
 * Forgotten Realms species with no origin stored gets no line (legacy
 * rows predate the origin system — silence, not invention).
 * Returns '' when no line applies.
 */
export function formatOriginLine(originSetting, originRegion, originExplanation, race) {
  const setting = String(originSetting || '').trim();
  const region = String(originRegion || '').trim();
  const explanation = String(originExplanation || '').trim();
  if (setting && explanation) {
    return `Origin: ${setting}${region ? ` — ${region}` : ''} — ${explanation}`;
  }
  if (setting && isOutsideFRSetting(setting)) {
    return `Origin: ${setting}${region ? ` — ${region}` : ''} — origin explanation REQUIRED, not yet recorded`;
  }
  if (setting) return `Origin: ${setting}${region ? ` — ${region}` : ''}`;
  const resolved = resolveSpecies(race, null);
  const homeOutsideFR = resolved && (resolved.entry.origins || []).length > 0
    && !(resolved.entry.origins || []).includes('Forgotten Realms');
  if (homeOutsideFR) {
    return `Origin: explanation REQUIRED, not yet recorded (this species is not native to the Forgotten Realms)`;
  }
  return '';
}

/**
 * Client shape for /api/species and the creator shell — matches the
 * interim adapter shape Stage 1 already renders, plus source and the
 * registry fields Stage 2+ will need. The '__other__' origin option is
 * a picker affordance, not a book origin, and is appended here so the
 * shell never has to know the difference.
 */
export function toClientShape(entry) {
  const pcCreatable = isPcCreatable(entry.id, null);
  return {
    id: entry.id,
    name: entry.name,
    pcCreatable,
    pcCreatableNote: pcCreatable ? null : MVP_DEFERRED_NOTE,
    description: entry.description || '',
    size: entry.size || '',
    // Size choice (2024 human, PHB p. 194): the list the creator
    // offers when the species lets the player choose; null when
    // the species has a single fixed size.
    sizes: entry.sizes || null,
    speed: entry.speeds?.walk ?? null,
    speeds: entry.speeds || {},
    languages: entry.languages || [],
    traits: entry.traits || [],
    grants: entry.grants || null,
    abilityScoreIncrease: entry.abilityScoreIncrease || {},
    // 2024 Versatile (item 19): true only on the human entry — the
    // creator reads this to offer the standalone Versatile pick.
    versatile2024: entry.versatile2024 === true,
    source: entry.source || '',
    variants: (entry.variants || []).map(v => ({
      name: v.name,
      description: v.description || '',
      traits: v.traits || [],
      grants: v.grants || null,
      speed: v.speeds?.walk ?? null,
      resolvedASI: v.resolvedASI || null,
      replaces: v.replaces || [],
      innateSpells: v.innateSpells || [],
      markSpells: v.markSpells || [],
    })),
    origins: [
      ...(entry.origins || []).map(setting => ({
        setting, label: setting, outsideFR: isOutsideFRSetting(setting),
      })),
      { setting: '__other__', label: 'Another setting…', outsideFR: true },
    ],
  };
}
