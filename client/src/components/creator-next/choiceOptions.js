/**
 * Ancestry-feat subchoice option resolution — creator-next Stage 1.
 *
 * The ancestry-feat data stores open-ended picks as sentinel strings
 * ("any_language", "any_skill", "any_artisan_tool", ...). The progression
 * route serves them verbatim, so the picker must expand them into real
 * option lists before rendering — the previous renderer called .map on
 * the raw string and threw for 7 of the 42 tier-1 feats (every feat with
 * a sentinel choice, including all four language cases).
 *
 * Expansion sources are the repo's own canonical lists — the same ones
 * the deprecated wizard's resolveAncestryChoiceOptions used, nothing
 * invented:
 *   any_language       → equipment.json languages.standard + exotic (16)
 *   any_skill          → references.js SKILLS (18)
 *   any_artisan_tool   → equipment.json tools.artisansTools (17)
 *   any_tool           → artisan tools + kits + Gaming Set + Musical Instrument
 *   any_martial_weapon → equipment.json martialWeapons melee + ranged (26; 2024: Net out, Musket/Pistol in; + Double-Bladed Scimitar / Hoopak setting weapons)
 *   any_instrument     → equipment.json musicalInstruments (10) — Stage 3
 *                        Musician origin feat
 *   any_skill_or_tool  → ALL_SKILLS + ALL_TOOLS — Stage 3 Skilled origin
 *                        feat (any combination of three skills or tools)
 * Sentinels with no list (cantrip / freeform spell picks) return null and
 * render as a free-form text input — the wizard's pattern for picks too
 * open-ended for a dropdown.
 *
 * Stage 5 (Gear & Story, 2026-11-07) adds the package-category
 * sentinels, same pattern, same source (the corrected 2024
 * equipment.json — never invented): the starting-packages route
 * serves category entries as sentinel strings (server/data/
 * startingPackages.js CATEGORY_SENTINELS — any_simple_weapon,
 * any_simple_melee_weapon, any_martial_weapon,
 * any_martial_melee_weapon, any_artisan_tool, any_tool,
 * any_tool_kit, any_musical_instrument, any_gaming_set), and this
 * module expands them into the real option lists the picker renders.
 *   any_simple_weapon / _melee / _ranged → simpleWeapons lists (15/11/4)
 *   any_martial_melee_weapon / _ranged   → martialWeapons lists (20/6)
 *   any_weapon                            → all 41 weapons (38 chapter + 3 setting)
 *   any_light/medium/heavy_armor / any_armor → armor lists by type
 *   any_pack                              → the 7 equipment packs
 *   any_tool_kit                          → tools.otherTools (the kits)
 *   any_gaming_set                        → tools.gamingSets
 *   any_musical_instrument                → the 10 instruments (the
 *                        route's key; any_instrument is the same list,
 *                        kept for the Stage 3 Musician feat)
 *   any_arcane_focus / any_druidic_focus / any_holy_symbol
 *                                           → the priced focus details
 * A sentinel the route invents later is a one-line addition here —
 * never a new picker. describeSentinel gives the picker its
 * plain-English label ("any simple weapon").
 *
 * Gray-out (Zach, 2026-11-05, LOCKED): an option the character already
 * holds renders DISABLED with an "already known" suffix, never hidden.
 * This module never filters the list — the held check is the separate
 * isHeldOption function the renderer applies per option.
 */
import { SKILLS } from '../../data/references.js'
import equipmentData from '../../data/equipment.json' with { type: 'json' }
import { resolveSpeciesGrants } from './speciesAdapter.js'

const ALL_SKILLS = Object.values(SKILLS).map(s => s.name)
const ALL_LANGUAGES = [
  ...(equipmentData.languages?.standard || []),
  ...(equipmentData.languages?.exotic || []),
]
const ARTISAN_TOOLS = (equipmentData.tools?.artisansTools || []).map(t => t.name)
const OTHER_TOOLS = (equipmentData.tools?.otherTools || []).map(t => t.name)
const ALL_TOOLS = [...ARTISAN_TOOLS, ...OTHER_TOOLS, 'Gaming Set', 'Musical Instrument']
const MUSICAL_INSTRUMENTS = [...(equipmentData.musicalInstruments || [])]
const ALL_SKILLS_OR_TOOLS = [...ALL_SKILLS, ...ALL_TOOLS]
const MARTIAL_WEAPONS = [
  ...((equipmentData.martialWeapons?.melee || []).map(w => w.name)),
  ...((equipmentData.martialWeapons?.ranged || []).map(w => w.name)),
]
// Stage 5 package categories — same equipment.json source, split the
// way the 2024 packages phrase them ("any simple weapon", "any two
// martial weapons", "a martial weapon and a shield").
const SIMPLE_MELEE_WEAPONS = ((equipmentData.simpleWeapons?.melee || []).map(w => w.name))
const SIMPLE_RANGED_WEAPONS = ((equipmentData.simpleWeapons?.ranged || []).map(w => w.name))
const SIMPLE_WEAPONS = [...SIMPLE_MELEE_WEAPONS, ...SIMPLE_RANGED_WEAPONS]
const MARTIAL_MELEE_WEAPONS = ((equipmentData.martialWeapons?.melee || []).map(w => w.name))
const MARTIAL_RANGED_WEAPONS = ((equipmentData.martialWeapons?.ranged || []).map(w => w.name))
const ALL_WEAPONS = [...SIMPLE_WEAPONS, ...MARTIAL_WEAPONS]
const LIGHT_ARMOR = ((equipmentData.armor?.light || []).map(a => a.name))
const MEDIUM_ARMOR = ((equipmentData.armor?.medium || []).map(a => a.name))
const HEAVY_ARMOR = ((equipmentData.armor?.heavy || []).map(a => a.name))
const ALL_ARMOR = [...LIGHT_ARMOR, ...MEDIUM_ARMOR, ...HEAVY_ARMOR]
const PACKS = Object.keys(equipmentData.packs || {})
const TOOL_KITS = (equipmentData.tools?.otherTools || []).map(t => t.name)
const GAMING_SETS = (equipmentData.tools?.gamingSets || []).map(t => t.name)
// Focuses: the priced *Details arrays (2024 chapter values) when
// present, else the name-only lists — never an invented price.
const ARCANE_FOCUSES = (equipmentData.arcaneFocusDetails || equipmentData.arcaneFocus || [])
  .map(f => (typeof f === 'string' ? f : f.name))
const DRUIDIC_FOCUSES = (equipmentData.druidicFocusDetails || equipmentData.druidicFocus || [])
  .map(f => (typeof f === 'string' ? f : f.name))
const HOLY_SYMBOLS = (equipmentData.holySymbolDetails || equipmentData.holySymbol || [])
  .map(f => (typeof f === 'string' ? f : f.name))

const SENTINEL_LABELS = {
  any_skill: 'any skill',
  any_language: 'any language',
  any_artisan_tool: 'any artisan’s tool',
  any_tool: 'any tool',
  any_martial_weapon: 'any martial weapon',
  any_instrument: 'any musical instrument',
  any_musical_instrument: 'any musical instrument',
  any_skill_or_tool: 'any skill or tool',
  any_simple_weapon: 'any simple weapon',
  any_simple_melee_weapon: 'any simple melee weapon',
  any_simple_ranged_weapon: 'any simple ranged weapon',
  any_martial_melee_weapon: 'any martial melee weapon',
  any_martial_ranged_weapon: 'any martial ranged weapon',
  any_weapon: 'any weapon',
  any_light_armor: 'any light armor',
  any_medium_armor: 'any medium armor',
  any_heavy_armor: 'any heavy armor',
  any_armor: 'any armor',
  any_pack: 'any pack',
  any_tool_kit: 'any tool kit',
  any_gaming_set: 'any gaming set',
  any_arcane_focus: 'any arcane focus',
  any_druidic_focus: 'any druidic focus',
  any_holy_symbol: 'any holy symbol',
}

/** Plain-English label for a category sentinel, for the picker heading. Unknown sentinels read back verbatim (underscores as spaces) — never blank. */
export function describeSentinel(sentinel) {
  if (!sentinel) return ''
  return SENTINEL_LABELS[sentinel] || String(sentinel).replace(/_/g, ' ')
}

function normalize(list) {
  return (list || []).map(o => (typeof o === 'string' ? { value: o, label: o } : o))
}

/**
 * Resolve a feat subchoice's options into renderable {value, label} pairs.
 * Returns null when the choice is too open-ended for a dropdown (cantrip /
 * freeform spell picks) — the caller renders a text input instead.
 * Never throws on a sentinel string; a fixed array passes through unchanged.
 */
export function resolveChoiceOptions(choice) {
  if (!choice) return []
  if (Array.isArray(choice.options)) return normalize(choice.options)
  switch (choice.options) {
    case 'any_skill': return normalize(ALL_SKILLS)
    case 'any_language': return normalize(ALL_LANGUAGES)
    case 'any_artisan_tool': return normalize(ARTISAN_TOOLS)
    case 'any_tool': return normalize(ALL_TOOLS)
    case 'any_martial_weapon': return normalize(MARTIAL_WEAPONS)
    case 'any_instrument': return normalize(MUSICAL_INSTRUMENTS)
    case 'any_musical_instrument': return normalize(MUSICAL_INSTRUMENTS)
    case 'any_skill_or_tool': return normalize(ALL_SKILLS_OR_TOOLS)
    case 'any_simple_weapon': return normalize(SIMPLE_WEAPONS)
    case 'any_simple_melee_weapon': return normalize(SIMPLE_MELEE_WEAPONS)
    case 'any_simple_ranged_weapon': return normalize(SIMPLE_RANGED_WEAPONS)
    case 'any_martial_melee_weapon': return normalize(MARTIAL_MELEE_WEAPONS)
    case 'any_martial_ranged_weapon': return normalize(MARTIAL_RANGED_WEAPONS)
    case 'any_weapon': return normalize(ALL_WEAPONS)
    case 'any_light_armor': return normalize(LIGHT_ARMOR)
    case 'any_medium_armor': return normalize(MEDIUM_ARMOR)
    case 'any_heavy_armor': return normalize(HEAVY_ARMOR)
    case 'any_armor': return normalize(ALL_ARMOR)
    case 'any_pack': return normalize(PACKS)
    case 'any_tool_kit': return normalize(TOOL_KITS)
    case 'any_gaming_set': return normalize(GAMING_SETS)
    case 'any_arcane_focus': return normalize(ARCANE_FOCUSES)
    case 'any_druidic_focus': return normalize(DRUIDIC_FOCUSES)
    case 'any_holy_symbol': return normalize(HOLY_SYMBOLS)
    default: return null
  }
}

/**
 * Is this option value already held? Case-insensitive — the registry
 * writes "Elvish", the option lists write "Elvish", but a stored draft
 * or a variant could differ in case; the comparison must not care.
 */
export function isHeldOption(value, heldValues) {
  const held = new Set((heldValues || []).map(v => String(v).toLowerCase()))
  return held.has(String(value).toLowerCase())
}

/**
 * How many picks a feat subchoice grants (item 2). `choice.count` was
 * never read anywhere before this — Traveler's Tongue carries count 2
 * and the renderer showed one select. Anything without a positive
 * integer count grants exactly one pick.
 */
export function choiceCountOf(choice) {
  const n = Number(choice?.count)
  return Number.isInteger(n) && n > 0 ? n : 1
}

/**
 * Normalize a stored subchoice value into exactly `count` render
 * slots. A legacy single string reads as the first slot; an array
 * reads in order (deduped, capped at count); unpicked slots are ''.
 * The renderer writes back the compacted picks (see Stage 1), so a
 * stored string never becomes a stored array for a count-1 choice.
 */
export function normalizeChoiceValues(raw, count) {
  const n = choiceCountOf({ count })
  const picked = []
  const flat = Array.isArray(raw) ? raw : (raw != null && String(raw).trim() !== '' ? [raw] : [])
  for (const v of flat) {
    if (v == null || String(v).trim() === '') continue
    if (picked.some(x => String(x).toLowerCase() === String(v).toLowerCase())) continue
    picked.push(v)
    if (picked.length >= n) break
  }
  while (picked.length < n) picked.push('')
  return picked
}

/**
 * Values already held for a feat subchoice of this type, from the
 * species entry (items 1 + 20). Language picks gray out against the
 * species' languages; skill/tool picks gray out against the
 * structured species grants (resolveSpeciesGrants — the registry
 * serves `grants` since items 1 + 20 landed 2026-11-06, so held
 * skills/tools gray out). Trait prose is never parsed. Returns display
 * values (skill names, tool names) so isHeldOption matches the
 * option lists case-insensitively.
 */
export function heldValuesForChoice(choice, speciesEntry, subrace) {
  if (!choice) return []
  if (choice.type === 'language') return [...(speciesEntry?.languages || [])]
  const grants = resolveSpeciesGrants(speciesEntry, subrace)
  if (choice.type === 'skill') return grants.skills.map(k => SKILLS[k]?.name || k)
  if (choice.type === 'tool') return [...grants.tools]
  return []
}
