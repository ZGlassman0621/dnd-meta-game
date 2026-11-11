import catalog from '../../data/spellCatalog.generated.json'
import classesData from '../../data/classes.json'

/**
 * Bundled-spell-catalog fallback for Stage 4 (item 23).
 *
 * When GET /api/spells is unreachable, Stage 4 falls back in this
 * order — live endpoint first, then the cached last-good fetch
 * (survives a transient drop mid-session), then this bundled dataset
 * (generated from the server catalog by
 * scripts/generate-spell-catalog.js — complete, authoritative,
 * available offline). The thin client spells.json (7 classes, levels
 * 1–2) is NEVER substituted.
 *
 * Honest limits of the bundled list: it filters by catalog class
 * membership, which is the endpoint's main gate (canLearnSpell), but
 * it cannot reproduce the endpoint's subclass gates — a subclass-
 * granted spell (domain, oath, patron) may be missing from the
 * bundled list until the server is back, and the UI says so. Counts
 * are exact: level1ByClass carries the server's own level-1 numbers,
 * computed by the generation script from levelProgression.js.
 */

const SPELL_CACHE_KEY = 'creator-next-spells-cache'

const CLASS_NAMES = new Map(
  (Array.isArray(classesData)
    ? classesData
    : Object.entries(classesData).map(([id, c]) => ({ id, ...c }))
  ).map(c => [String(c.id).toLowerCase(), c.name || c.id])
)

function level1Info(classId) {
  if (!classId) return null
  return catalog?.level1ByClass?.[String(classId).toLowerCase()] || null
}

/** Spells known at level 1 for this class (number, or null when the class does not track known spells). */
export function knownCountFor(classId) {
  const info = level1Info(classId)
  return info ? (typeof info.spellsKnown === 'number' ? info.spellsKnown : null) : null
}

/** Cantrips known at level 1 (Stage 2's territory; carried for completeness). */
export function cantripsKnownFor(classId) {
  const info = level1Info(classId)
  return info ? (typeof info.cantripsKnown === 'number' ? info.cantripsKnown : null) : null
}

/** Spellcasting ability key ('int'/'wis'/'cha') or null. */
export function spellcastingAbilityForClass(classId) {
  const info = level1Info(classId)
  return info?.spellcastingAbility || null
}

/**
 * Prepared-spell count at level 1 for this class at the given ability
 * modifier — the server's getSpellsPrepared, via the generated rule.
 * Null when the class is not a prepared caster; 0 for a prepared
 * caster with no 1st-level slots (blackguard). Paladin is table-driven
 * in 2024 (2 at L1), not zero.
 */
export function preparedCountFor(classId, abilityMod) {
  const info = level1Info(classId)
  if (!info) return null
  const rule = info.spellsPrepared
  if (!rule) return null
  if (rule.kind === 'none') return null
  if (rule.kind === 'zero') return 0
  const mod = Number(abilityMod) || 0
  const hit = rule.byMod?.[String(mod)]
  if (typeof hit === 'number') return hit
  if (rule.kind === 'modPlusLevel') return Math.max(1, mod + 1)
  if (rule.kind === 'modPlusHalfLevel') return Math.max(1, mod + Math.floor(1 / 2))
  return null
}

/**
 * Spellbook size at level 1 for this class (2026-11-07): the wizard's
 * book starts with 6 first-level spells; every other class has no
 * book, so null — the same null the live endpoint serves in
 * `spellbookSize` for non-wizards. Stage 4 is level 1 only, so the
 * level-1 size is the whole answer here; the sheet reads the
 * per-level size from spellbookHelpers.spellbookSizeForLevel.
 */
export function spellbookSizeFor(classId) {
  return String(classId || '').toLowerCase() === 'wizard' ? 6 : null
}

/** Player-facing prepared-count rule for the Tip (no numbers invented — the rule, not a count). */
export function preparedCountRuleText(classId) {
  const info = level1Info(classId)
  const kind = info?.spellsPrepared?.kind
  if (kind === 'modPlusLevel') return 'your spellcasting ability modifier + your character level (minimum 1)'
  if (kind === 'modPlusHalfLevel') return 'your spellcasting ability modifier + half your level, rounded down (minimum 1)'
  if (kind === 'table') return 'a fixed number from your class table'
  if (kind === 'zero') return '0 at level 1 — this class has no spell slots yet'
  return ''
}

/**
 * Level-1 spell slots for display. Normalizes the warlock shape
 * ({ slots: 1, level: 1 }) into the level-keyed shape the renderer
 * expects ({ '1': 1 }); every other class already serves level keys.
 */
export function spellSlotsFor(classId) {
  const info = level1Info(classId)
  const slots = info?.spellSlots
  if (!slots || typeof slots !== 'object') return null
  if (typeof slots.slots === 'number' && typeof slots.level === 'number') {
    return { [String(slots.level)]: slots.slots }
  }
  return slots
}

/**
 * Level-1 leveled spells this class can pick, from the bundled
 * catalog: level exactly 1, catalog classes include the class's
 * display name, cantrips (level 0) excluded — the endpoint's shape,
 * minus its subclass gates (see the module header). Sorted by name,
 * as the endpoint sorts level-then-name.
 */
export function bundledSpellsForClass(classId) {
  if (!classId) return []
  const displayName = CLASS_NAMES.get(String(classId).toLowerCase())
  if (!displayName) return []
  const wanted = displayName.toLowerCase()
  return (catalog?.spells || [])
    .filter(s => s && Number(s.level) === 1
      && Array.isArray(s.classes)
      && s.classes.some(c => String(c).toLowerCase() === wanted))
    .map(s => ({
      key: s.key,
      name: s.name,
      level: Number(s.level),
      school: s.school || '',
      classes: s.classes || [],
      description: s.description || ''
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * An endpoint-shaped spell response built from the bundled dataset,
 * for the offline fallback: { classId, level, cantripsKnown,
 * spellsKnown, spellsPrepared, spellbookSize, spellcastingAbility, spells,
 * spellSlots, source: 'bundled' }. Null when the class is unknown to
 * the dataset at all (then the caller shows the gap note, not a
 * fabricated list).
 */
export function bundledSpellData(classId, subclassName, abilityMod) {
  const info = level1Info(classId)
  if (!info) return null
  return {
    classId: String(classId).toLowerCase(),
    level: 1,
    cantripsKnown: cantripsKnownFor(classId),
    spellsKnown: knownCountFor(classId),
    spellsPrepared: preparedCountFor(classId, abilityMod),
    spellbookSize: spellbookSizeFor(classId),
    spellcastingAbility: spellcastingAbilityForClass(classId),
    spells: bundledSpellsForClass(classId),
    spellSlots: spellSlotsFor(classId),
    source: 'bundled'
  }
}

/** Last-good fetch cache (secondary fallback, localStorage, best-effort). */
export function loadCachedSpellData(classId) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const raw = window.localStorage.getItem(SPELL_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    const entry = cache?.[String(classId).toLowerCase()]
    return entry && typeof entry === 'object' ? entry : null
  } catch {
    return null
  }
}

export function saveCachedSpellData(classId, data) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    if (!data || typeof data !== 'object') return
    const raw = window.localStorage.getItem(SPELL_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : {}
    cache[String(classId).toLowerCase()] = data
    window.localStorage.setItem(SPELL_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // A full or unavailable store never blocks the creator.
  }
}
