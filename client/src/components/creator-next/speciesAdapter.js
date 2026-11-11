import { SKILLS, TOOLS, skillKey } from '../../data/references.js'

/**
 * INTERIM species adapter — creator-next Stage 1 offline fallback.
 * The server species registry landed 2026-11-04 and is the authority;
 * the shell fetches /api/species first and uses this adapter only when
 * the endpoint cannot be reached. The Stage 1 component never imports
 * races.json; only this adapter does, and only the preview shell
 * imports this adapter. Entries match the registry client shape.
 *
 * Registry shape produced per species:
 *   { id, name, description, size, speed, languages, traits: [string],
 *     abilityScoreIncrease: {str,dex,con,int,wis,cha} (book, as written,
 *       display only — Stage 1 does no score math),
 *     variants: [{ name, description, traits: [string], replaces: null }],
 *     origins: [{ setting, label, outsideFR }] }
 *
 * Known interim gaps, documented here (2026-11-09: the interim note
 * that used to render on the species card is deleted — the registry
 * is live and the note was stale in the normal path): half-elf /
 * half-orc are legacy entries
 * (the 2024 PHB carries neither as a species; they survive here as
 * the registry serves them, and stored spellings resolve to them
 * through findSpeciesEntry below), warforged with no source book, and
 * NO per-variant `replaces[]` data — legacy subraces carry traits but
 * never say which base traits they replace, so the stage shows
 * variant traits without claiming replacements. The 18 MVP-deferred
 * species never appear in this fallback at all (the legacy list
 * predates them). The registry supplies all of this; nothing here is
 * invented to fill the gaps.
 *
 * Gnome (2026-11-06, item 4): races.json omits gnome entirely, so the
 * adapter patches the entry in from the server registry entry
 * (server/data/species/phbSpecies.js:201-237, 2014 PHB baseline — the
 * same wording caveat as the registry itself: Zach's physical-book
 * check is still open). Only the Forest + Rock variants are patched:
 * the Mark of Scribing dragonmark variant lives in the registry's
 * Eberron merge, not in the legacy list. The patch applies ONLY when
 * the input is the full legacy list (all 10 races.json keys) — a
 * partial input maps 1:1, so callers passing a subset never gain a
 * species they did not ask for.
 */

/** The MVP-deferred note, client copy of the server's MVP_DEFERRED_NOTE. */
export const MVP_DEFERRED_NOTE = 'Coming after the MVP — NPCs can still be this species.'

const INTERIM_ORIGINS = [
  { setting: 'Forgotten Realms', label: 'Forgotten Realms', outsideFR: false },
  { setting: '__other__', label: 'Another setting…', outsideFR: true }
]

// The 10 keys races.json carries. The gnome patch below fires only
// when every one of them is present — i.e. the input IS the legacy
// list, not a caller's subset.
const LEGACY_RACE_IDS = [
  'aasimar', 'dragonborn', 'dwarf', 'elf', 'half-elf',
  'half-orc', 'halfling', 'human', 'tiefling', 'warforged'
]

// Gnome, transcribed verbatim from the registry entry
// (server/data/species/phbSpecies.js:201-237). No pcCreatable flag:
// the adapter carries no flag by contract (a missing flag reads as
// creatable under the picker's `=== false` test), and gnome is a PC
// species, so no flag is the correct value here.
const GNOME_ADAPTER_ENTRY = {
  id: 'gnome',
  name: 'Gnome',
  description: 'Small, clever folk who love ingenious devices, hidden magic, and good company. Gnomes are curious, cheerful, and hard to surprise — and their wits have kept them alive in a world of much larger neighbors.',
  size: 'Small',
  speed: 25,
  languages: ['Common', 'Gnomish'],
  traits: ['Darkvision (60 ft)', 'Gnome Cunning - Advantage on Intelligence, Wisdom, and Charisma saving throws against magic'],
  abilityScoreIncrease: { int: 2 },
  variants: [
    {
      name: 'Forest Gnome',
      description: 'Curious, shy gnomes of the deep woods, at ease with small beasts and minor magic.',
      traits: ['Darkvision (60 ft)', 'Gnome Cunning - Advantage on Intelligence, Wisdom, and Charisma saving throws against magic', 'Natural Illusionist - You know the Minor Illusion cantrip', 'Speak with Small Beasts - You can communicate simple ideas with Small or smaller beasts'],
      replaces: [],
      resolvedASI: { int: 2, dex: 1 },
      innateSpells: [{ name: 'Minor Illusion', level: 0, uses: 'at will' }]
    },
    {
      name: 'Rock Gnome',
      description: 'Inventive gnomes of hills and workshops, makers of clever devices and keen judges of crafted work.',
      traits: ['Darkvision (60 ft)', 'Gnome Cunning - Advantage on Intelligence, Wisdom, and Charisma saving throws against magic', "Artificer's Lore - When you make a History check related to magic items, alchemical objects, or technological devices, add double your proficiency bonus", 'Tinker - You can build small clockwork devices'],
      replaces: [],
      resolvedASI: { int: 2, con: 1 },
      innateSpells: []
    }
  ],
  origins: INTERIM_ORIGINS
}

export function adaptLegacySpecies(racesData) {
  const entries = Object.entries(racesData || {}).map(([id, r]) => ({
    id,
    name: r.name || id,
    description: r.description || '',
    size: r.size || '',
    speed: r.speed ?? null,
    languages: Array.isArray(r.languages) ? r.languages : [],
    traits: Array.isArray(r.traits) ? r.traits : [],
    abilityScoreIncrease: r.abilityScoreIncrease || {},
    variants: (r.subraces || []).map(s => ({
      name: s.name || '',
      description: s.description || '',
      traits: Array.isArray(s.traits) ? s.traits : [],
      // Legacy data never records replacements — null means "registry
      // will specify", and the UI must not claim otherwise.
      replaces: null
    })),
    origins: INTERIM_ORIGINS
  }))
  // Gnome patch: races.json omits gnome; the full legacy list gains
  // the transcribed registry entry (see GNOME_ADAPTER_ENTRY). A
  // partial input is mapped 1:1 and gains nothing.
  if (!entries.some(e => normalizeSpeciesId(e.id) === 'gnome')
    && LEGACY_RACE_IDS.every(id => Object.keys(racesData || {}).some(k => normalizeSpeciesId(k) === id))) {
    entries.push(JSON.parse(JSON.stringify(GNOME_ADAPTER_ENTRY)))
  }
  return entries
}

/**
 * Resolve the stored origin_setting for a species entry: the '__other__'
 * option means the player typed a setting name, which is stored as-is
 * (labelled, never reskinned, per the outside-FR ruling).
 */
export function resolveOriginSetting(setting, customSetting) {
  if (setting === '__other__') return (customSetting || '').trim()
  return setting || ''
}

export function isOutsideFR(setting) {
  const s = (setting || '').trim().toLowerCase()
  if (!s || s === '__other__') return true
  return s !== 'forgotten realms'
}

/**
 * Normalize a stored species string the way the server's normKey does
 * (server/services/speciesService.js): lowercase, underscores and
 * spaces become hyphens. 'half_elf', 'Half-Elf', and 'half elf' are
 * the same entry — half-elf / half-orc survive as legacy entries and
 * old drafts may spell them any of those ways.
 */
export function normalizeSpeciesId(value) {
  return String(value || '').trim().toLowerCase().replace(/[_]+/g, '-').replace(/\s+/g, '-')
}

/**
 * Find a species entry by a stored race string. Exact id/name match
 * first (normalized); then a variant-as-species string ('Air Genasi',
 * 'Mark of Scribing') resolves to the entry that owns the variant —
 * the server's resolveSpecies judges those by their entry too. Null
 * when nothing matches: unknown species are a fallback case for
 * callers, never an invented entry.
 */
export function findSpeciesEntry(species, raceId) {
  const list = Array.isArray(species) ? species : []
  if (!raceId) return null
  const key = normalizeSpeciesId(raceId)
  const byId = list.find(s => normalizeSpeciesId(s.id) === key || normalizeSpeciesId(s.name) === key)
  if (byId) return byId
  return list.find(s => (s.variants || []).some(v => normalizeSpeciesId(v.name) === key)) || null
}

/**
 * The ONE shared MVP-creatable check for the creator (items 1 + 20).
 * The server is the source of the flag (toClientShape serves
 * pcCreatable per entry); the client reads it and nothing else. A
 * missing flag (the interim adapter's entries) reads as creatable —
 * only an explicit false grays a species out. That is the v1 rule:
 * unknown species stay creatable.
 */
export function isPcCreatableEntry(entry) {
  return entry?.pcCreatable !== false
}

export function isDeferredSpecies(entry) {
  return entry?.pcCreatable === false
}

export function deferredNoteFor(entry) {
  return entry?.pcCreatableNote || MVP_DEFERRED_NOTE
}

const EMPTY_GRANTS = { skills: [], tools: [], weapons: [], armor: [], senses: [], resistances: [] }

/**
 * Resolve the structured species grants for the picked species +
 * variant (items 1 + 20, one source of truth, two consumers: the
 * Stage 1/3 gray-outs and the Stage 4 consolidation). Reads the
 * registry's `grants` field on the entry and on the picked variant.
 * Variant grants are FULL effective grants: when a variant is
 * chosen, ONLY its grants apply — never unioned with the base
 * entry, or a replacing variant (e.g. High Elf Descent, which has
 * no skill choice) would double-grant. DEFENSIVE: an entry
 * without a `grants` field — grants landed 2026-11-06 (items
 * 1 + 20), but legacy/interim entries may still lack the field —
 * resolves to empty lists, never a crash, and the callers fall
 * back to prose display. Skills come back as snake_case keys
 * (Stage 4's held set), tools as canonical TOOLS names, the rest
 * as display strings. Trait prose is NEVER parsed.
 */
export function resolveSpeciesGrants(speciesEntry, subrace) {
  const out = { skills: [], tools: [], weapons: [], armor: [], senses: [], resistances: [] }
  if (!speciesEntry) return out
  const toolByLower = new Map(Object.keys(TOOLS).map(k => [k.toLowerCase(), k]))
  const push = (bucket, raw, normalize) => {
    if (raw == null) return
    const value = normalize ? normalize(raw) : String(raw).trim()
    if (!value) return
    if (!out[bucket].some(v => String(v).toLowerCase() === String(value).toLowerCase())) out[bucket].push(value)
  }
  const pushGrants = (grants) => {
    if (!grants || typeof grants !== 'object') return
    for (const raw of (grants.skills || [])) push('skills', raw, v => { const k = skillKey(v); return SKILLS[k] ? k : null })
    for (const raw of (grants.tools || [])) push('tools', raw, v => toolByLower.get(String(v).trim().toLowerCase()) || null)
    for (const raw of (grants.weapons || [])) push('weapons', raw, null)
    for (const raw of (grants.armor || [])) push('armor', raw, null)
    for (const raw of (grants.senses || [])) push('senses', raw, null)
    for (const raw of (grants.resistances || [])) push('resistances', raw, null)
  }
  const variant = (speciesEntry.variants || []).find(v => v.name === subrace) || null
  // Variant grants REPLACE the base entry's grants (items 1 + 20
  // contract): a chosen variant's grants are its full effective
  // grants, never unioned with the entry's.
  if (variant) pushGrants(variant.grants)
  else pushGrants(speciesEntry.grants)
  return out
}
