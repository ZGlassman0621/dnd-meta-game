/**
 * Story starters for Stage 5 (story-starters job, 2026-11-25).
 *
 * The choice lists come ONLY from text the repo already holds — the
 * seven data files below, written for the old creator's Step 7 and
 * orphaned until this job. Nothing here adds a starter. A field with
 * no starter set (organizations, allies, enemies, other_notes) gets
 * no list; alignment / faith / lifestyle are already selects.
 *
 * Drivers, per set (only where the data names one):
 *   - theme   → personality_traits, ideals, bonds, flaws (single pick)
 *               and backstory (multi-pick moments). Keyed by theme id.
 *   - species → age, height, weight, eye_color, hair_color,
 *               skin_color, physical_build. Keyed by species id.
 *   - size    → height and weight only. The ranges describe a species
 *               at its usual size, so they show only when the
 *               character's size is that usual size (a Small human
 *               gets free text; no Small range exists to offer).
 * A species or theme with no entry gets no list: the field stays free
 * text. There is NO fallback to another species' ranges.
 *
 * Storage: every pick is the plain string the field already holds
 * (existing columns, no new ones). A stored value that matches a
 * listed option rehydrates as that pick; any other non-empty value is
 * the player's own words ("Other"). Backstory moments are sentences in
 * the backstory text, one per line, alongside whatever the player
 * wrote.
 *
 * Provenance (shown to the player as a source line): none of this is
 * 2024 book text.
 *   - The theme starters were written for this game (the files'
 *     headers cite PHASE_2_CREATOR_SPEC.md §7.2–7.6).
 *   - The appearance lists were compiled for this game from older
 *     books (the files' headers cite "PHB Chapter 2 race entries",
 *     Volo's Guide, Eberron: Rising from the Last War and Mordenkainen's
 *     Tome of Foes).
 */
import { THEME_PERSONALITY_PROMPTS } from '../../data/themePersonalityPrompts.js'
import { THEME_IDEALS_PROMPTS } from '../../data/themeIdealsPrompts.js'
import { THEME_BONDS_PROMPTS } from '../../data/themeBondsPrompts.js'
import { THEME_FLAWS_PROMPTS } from '../../data/themeFlawsPrompts.js'
import { THEME_BACKSTORY_MOMENTS } from '../../data/themeBackstoryMoments.js'
import { RACE_COLOR_TRAITS } from '../../data/raceColorTraits.js'
import { RACE_DEMOGRAPHICS } from '../../data/raceDemographics.js'

export const THEME_SOURCE_NOTE = 'Starters written for this game, not book text. Pick one, or choose Other to write your own.'
export const SPECIES_SOURCE_NOTE = 'Suggestions compiled for this game from older sourcebooks, not 2024 book text. Pick one, or choose Other to type your own.'
export const MOMENTS_SOURCE_NOTE = 'Moments written for this game, not book text. Tick any that fit — each one adds a line to your backstory, which you can edit freely.'

/** The starters' alignment tags, spelled as Stage 5's alignment list spells them. */
export const ALIGNMENT_TAG_NAMES = {
  LG: 'Lawful Good', NG: 'Neutral Good', CG: 'Chaotic Good',
  LN: 'Lawful Neutral', N: 'True Neutral', CN: 'Chaotic Neutral',
  LE: 'Lawful Evil', NE: 'Neutral Evil', CE: 'Chaotic Evil',
}

/** The value the select's "Other" entry carries (never stored). */
export const OTHER_STARTER_VALUE = '__other__'

const THEME_SETS = {
  personality_traits: THEME_PERSONALITY_PROMPTS,
  ideals: THEME_IDEALS_PROMPTS,
  bonds: THEME_BONDS_PROMPTS,
  flaws: THEME_FLAWS_PROMPTS,
}
const SPECIES_COLOR_FIELDS = { eye_color: 'eyes', hair_color: 'hair', skin_color: 'skin', physical_build: 'build' }
const SPECIES_DEMO_FIELDS = { age: 'age', height: 'height', weight: 'weight' }
const SIZE_DRIVEN = new Set(['height', 'weight'])

/** Every field that can carry a starter list, with its driver. */
export const STARTER_FIELDS = {
  personality_traits: 'theme', ideals: 'theme', bonds: 'theme', flaws: 'theme',
  backstory: 'theme',
  age: 'species', height: 'species+size', weight: 'species+size',
  eye_color: 'species', hair_color: 'species', skin_color: 'species', physical_build: 'species',
}

/**
 * Does the character's size match the size the species data describes?
 * The data describes the species at its usual size (speciesEntry.size).
 * No pick yet means the usual size applies (Stage 1's rule).
 */
export function sizeMatchesData(state, speciesEntry) {
  const chosen = String(state?.size || '').trim()
  if (!chosen) return true
  const usual = String(speciesEntry?.size || '').trim()
  return !!usual && chosen.toLowerCase() === usual.toLowerCase()
}

/** Species id for the appearance lists, or '' when none applies (mixed ancestry: no single species). */
function speciesKey(state) {
  if (state?.mixedAncestry && Array.isArray(state.mixedAncestry.parents) && state.mixedAncestry.parents.length) return ''
  return String(state?.race || '').trim().toLowerCase()
}

/**
 * The choice list for one story field, or null when the field has no
 * starter set for this character. Returns
 *   { field, driver, source, options: [{ value, label, alignment? }] }
 * For backstory the options are moments (multi-pick).
 */
export function storyStarterOptions(field, state = {}, speciesEntry = null) {
  const driver = STARTER_FIELDS[field]
  if (!driver) return null
  if (driver === 'theme') {
    const themeId = String(state?.themeId || '').trim()
    if (!themeId) return null
    if (field === 'backstory') {
      const moments = THEME_BACKSTORY_MOMENTS[themeId]
      if (!Array.isArray(moments) || !moments.length) return null
      return { field, driver, source: MOMENTS_SOURCE_NOTE, multi: true, options: moments.map(m => ({ value: m, label: m })) }
    }
    const set = THEME_SETS[field]?.[themeId]
    if (!Array.isArray(set) || !set.length) return null
    return { field, driver, source: THEME_SOURCE_NOTE, options: set.map(p => ({ value: p.text, label: p.text, alignment: p.alignment })) }
  }
  const key = speciesKey(state)
  if (!key) return null
  if (SIZE_DRIVEN.has(field) && !sizeMatchesData(state, speciesEntry)) return null
  let list = null
  if (SPECIES_COLOR_FIELDS[field]) list = RACE_COLOR_TRAITS[key]?.[SPECIES_COLOR_FIELDS[field]]
  else if (SPECIES_DEMO_FIELDS[field]) list = RACE_DEMOGRAPHICS[key]?.[SPECIES_DEMO_FIELDS[field]]
  if (!Array.isArray(list) || !list.length) return null
  return { field, driver, source: SPECIES_SOURCE_NOTE, options: list.map(o => ({ value: String(o.value), label: String(o.label) })) }
}

/**
 * How a stored value shows against a list (single-pick fields):
 *   { mode: 'blank' }             nothing stored
 *   { mode: 'pick', value }       the value is a listed option
 *   { mode: 'other', value }      the player's own words
 */
export function pickerState(value, starters) {
  const v = value == null ? '' : String(value)
  if (!v.trim()) return { mode: 'blank', value: '' }
  if (starters?.options?.some(o => o.value === v)) return { mode: 'pick', value: v }
  return { mode: 'other', value: v }
}

/** Backstory lines that are listed moments (checked on rehydrate). */
export function checkedMoments(backstory, starters) {
  const lines = String(backstory || '').split(/\r?\n/).map(l => l.trim())
  return (starters?.options || []).filter(o => lines.includes(o.value)).map(o => o.value)
}

/**
 * Tick or untick one moment. Ticking appends it as its own line;
 * unticking removes exactly that line. The player's own lines are
 * never touched.
 */
export function toggleMoment(backstory, moment, on) {
  const lines = String(backstory || '').split(/\r?\n/)
  const has = lines.some(l => l.trim() === moment)
  if (on && !has) {
    const text = String(backstory || '').replace(/\s+$/, '')
    return text ? `${text}\n${moment}` : moment
  }
  if (!on && has) return lines.filter(l => l.trim() !== moment).join('\n').replace(/^\n+|\n+$/g, '')
  return String(backstory || '')
}

export default { storyStarterOptions, pickerState, checkedMoments, toggleMoment, sizeMatchesData, STARTER_FIELDS }
