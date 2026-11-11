import { useEffect, useState } from 'react'
import Tip from './Tooltip.jsx'
import classesData from '../../data/classes.json'
import deitiesData from '../../data/deities.json'
import equipmentData from '../../data/equipment.json' with { type: 'json' }
import { THEME_GOLD_MODIFIERS, applyGoldModifier } from '../../data/themeGoldModifiers.js'
import { choiceCountOf, describeSentinel, isHeldOption, normalizeChoiceValues, resolveChoiceOptions } from './choiceOptions.js'

/**
 * Creator-next Stage 5 — Gear & Story (2026-11-07).
 *
 * Plan Pages 10–11 (Equipment + Story) in one stage: the class's
 * starting-equipment package (or gold instead), then appearance and
 * story text. Heirloom is NOT built here — deferred, no server home,
 * no design for what an heirloom is mechanically (see the shell's
 * STAGE_NOTES key 4, which no longer mentions it).
 *
 * Data contract — GET /api/starting-packages/:classId (server/data/
 * startingPackages.js, served by server/routes/startingPackages.js):
 *   { classId, options: [{ id, items, gold }], goldOption }
 *   id is the 'A' | 'B' | 'C' package letter; gold is the gold baked
 *   INTO that package (gp); goldOption is the take-gold-instead
 *   amount as a NUMBER, or null when the class's book prints no
 *   starting-gold value (the six source-silent classes). Fighter's
 *   (C) 155 GP is goldOption, not a package option — the fork toggle
 *   below presents it that way. The fetch runs on mount / class
 *   change; on failure the section shows the visible "server not
 *   reachable" banner from Stage 1 — no silent fallback, no invented
 *   packages. Story fields do not depend on the route and stay
 *   editable when it fails.
 *
 * Item entries (objects only — names are the exact 2024 chapter names):
 *   fixed   { name, quantity }
 *   choice  { key, choose, count, from, label? } where `from` is
 *           (a) a sentinel category key (any_simple_weapon,
 *           any_musical_instrument, any_artisan_tool, ...) — picks[key]
 *           is an array of `count` item names from that category; or
 *           (b) an ARRAY of alternatives — picks[key] is
 *           { alternative: <index> }. Each alternative is a fixed item,
 *           a nested choice (its own picks entry, required only when
 *           its alternative is taken), or a bundle { items, condition? }.
 *           `condition` is display-only ("Proficient with heavy
 *           armor") — the resolver does not enforce it, and neither
 *           does this UI; it is shown, never silently refused.
 *   bundle  { items, condition? } — a list of entries taken together.
 *   `key` is a stable per-option identifier; picks are an object keyed
 *   by it. `label` is the picker title. `choose` is 1 throughout the
 *   data (one alternative / `count` items); the count governs.
 * A gold-only option (no items, gold > 0) is folded into goldOption by
 * normalizePackageData as a defensive measure — the live route never
 * serves one, but an older reading of the contract did.
 *
 * The client sends PICKS ONLY (gear_choice, package_id,
 * package_picks as a JSON string — see stage1Persistence.js). The
 * SERVER resolves picks into inventory/equipment/gold and derives
 * HP/AC/speed at submit. Nothing here resolves items for the save.
 * Picks that stop applying when an alternative changes are PRUNED
 * here (stale-branch picks are an error server-side), never sent.
 *
 * Display-only numbers: package item prices/weights come from the
 * corrected 2024 equipment.json (never invented — an item the bank
 * cannot price shows no price, not a guess); the gold-fork total is
 * baseline × theme modifier via THEME_GOLD_MODIFIERS, display only,
 * the server is authoritative; HP/AC/speed below are computed from
 * the same rules for display only and are labelled server-derived
 * at save — the server recomputes them and never trusts these.
 *
 * Dedup rule (Zach, 2026-11-05, LOCKED): a proficiency granted twice
 * does not stack — the duplicate becomes a replacement pick of the
 * same type, never a boost. A category option already held (tool /
 * skill / language, from Stages 1/3/4) renders DISABLED, opacity
 * 0.55, with an " — already granted" suffix, never hidden.
 *
 * Tooltips on EVERY choice via <Tip> (hover/focus/tap), never
 * title-attribute-only. No silent defaults: the fork starts
 * unpicked, every story field starts blank.
 *
 * State keys (draft state in the shell): gear_choice ('packages' |
 * 'gold'), package_id ('A' | 'B' | 'C'), package_picks
 * { <packageId>: { <choiceKey>: [names] | { alternative: n } } },
 * stage5PicksClass (local-mirror-only — the class the picks were made
 * for, so a class change clears them), plus the plain story columns
 * (alignment, faith, lifestyle, age, height, weight, eye_color,
 * hair_color, skin_color, physical_build, personality_traits, ideals,
 * bonds, flaws, organizations, allies, enemies, backstory,
 * other_notes). There is NO distinguishing-features column on
 * characters — the plan's field has no server home, so it is not
 * collected here.
 */

export const GOLD_SILENT_CLASSES = ['blackguard', 'magus', 'pugilist', 'scholar', 'spellshot', 'warden']

export function abilityModifier(score) {
  if (score == null || Number.isNaN(Number(score))) return null
  return Math.floor((Number(score) - 10) / 2)
}

export function formatModifier(mod) {
  if (mod == null) return '—'
  return mod >= 0 ? `+${mod}` : `${mod}`
}

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }

/** The starting-gold baseline for the gold fork: null when the class's book prints none. Accepts null, a number, or { gold } / { average }. */
export function goldOptionBaseline(goldOption) {
  if (goldOption == null) return null
  if (typeof goldOption === 'number') return Number.isFinite(goldOption) ? goldOption : null
  if (typeof goldOption === 'object') {
    const v = goldOption.gold ?? goldOption.average ?? goldOption.baseline ?? null
    return v == null || !Number.isFinite(Number(v)) ? null : Number(v)
  }
  return null
}

/** Display-only gold-fork total: baseline × theme modifier (THEME_GOLD_MODIFIERS). Null when there is no baseline. The server is authoritative. */
export function computedGold(baseline, themeId) {
  if (baseline == null) return null
  return applyGoldModifier(baseline, themeId)
}

/** Validate + normalize a starting-packages response into { classId, options, goldOption } or null when the shape is unusable. Never throws. A gold-only option (no items, gold > 0) is the gold fork, not a package: it folds into goldOption when the route did not already serve one, and leaves the package cards. */
export function normalizePackageData(data) {
  if (!data || typeof data !== 'object') return null
  if (!Array.isArray(data.options) || !data.options.length) return null
  const parsed = data.options
    .filter(o => o && typeof o === 'object' && typeof o.id === 'string' && Array.isArray(o.items))
    .map(o => ({ id: o.id, items: o.items, gold: Number.isFinite(Number(o.gold)) ? Number(o.gold) : 0 }))
  if (!parsed.length) return null
  let goldOption = data.goldOption ?? null
  let options = parsed
  const goldOnly = parsed.filter(o => o.items.length === 0 && o.gold > 0)
  const withItems = parsed.filter(o => o.items.length > 0)
  if (goldOnly.length && withItems.length) {
    if (goldOption == null) goldOption = goldOnly[0].gold
    options = withItems
  }
  return { classId: typeof data.classId === 'string' ? data.classId : '', options, goldOption }
}

// --- Item display prices/weights (corrected 2024 equipment.json) -----

const WEAPON_ROWS = [
  ...((equipmentData.simpleWeapons?.melee || [])),
  ...((equipmentData.simpleWeapons?.ranged || [])),
  ...((equipmentData.martialWeapons?.melee || [])),
  ...((equipmentData.martialWeapons?.ranged || [])),
]
const ARMOR_ROWS = [
  ...((equipmentData.armor?.light || [])),
  ...((equipmentData.armor?.medium || [])),
  ...((equipmentData.armor?.heavy || [])),
  ...((equipmentData.armor?.shields || [])),
]
const FOCUS_DETAIL_ROWS = [
  ...((equipmentData.musicalInstrumentDetails || [])),
  ...((equipmentData.arcaneFocusDetails || [])),
  ...((equipmentData.druidicFocusDetails || [])),
  ...((equipmentData.holySymbolDetails || [])),
]
const GEAR_ROWS = [
  ...((equipmentData.adventuringGear || [])),
  ...((equipmentData.ammunition || [])),
  ...((equipmentData.tools?.artisansTools || [])),
  ...((equipmentData.tools?.otherTools || [])),
  ...((equipmentData.tools?.gamingSets || [])),
  ...((equipmentData.mounts || [])),
  ...((equipmentData.tack || [])),
  ...((equipmentData.vehicles || [])),
  ...((equipmentData.waterVehicles || [])),
]

function normName(raw) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function rowPrice(row) {
  if (!row) return null
  const costGp = row.costGp ?? null
  // The corrected bank stores gear weights BOTH ways: `weightLb` (a
  // number) and `weight` (a "29 lb" string) on the same row. Prefer
  // the number; parse a leading number out of a string; "—" or
  // missing is null (negligible / unknown), never a guess.
  let weight = row.weightLb ?? row.weight ?? null
  if (typeof weight === 'string') {
    const m = weight.match(/([\d.]+)/)
    weight = m ? Number(m[1]) : null
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight)) weight = null
  if (costGp == null && weight == null) return null
  return { costGp, weight, cost: row.cost || (costGp != null ? `${costGp} gp` : null) }
}

/**
 * Display price/weight for an item name from equipment.json, or null
 * when the bank cannot price it (never invented). Matches the bank's
 * own names first, then the 2024 package spellings ("Studded Leather
 * Armor" → "Studded Leather"), focus parentheticals ("Arcane Focus
 * (crystal)" → "Crystal", "Druidic Focus (sprig of mistletoe)" →
 * "Sprig of Mistletoe"), and ammo bundles ("20 Arrows" →
 * "Arrows (20)"). Chapter-external package items (Sabre, A Worn
 * Leather-Bound Journal) have no bank row and show no price.
 */
export function priceForItem(rawName) {
  if (!rawName) return null
  const name = String(rawName).trim()
  const norm = normName(name)
  const allRows = [...WEAPON_ROWS, ...ARMOR_ROWS, ...FOCUS_DETAIL_ROWS, ...GEAR_ROWS]
  const exact = allRows.find(r => normName(r.name) === norm)
  if (exact) return rowPrice(exact)
  const noArmor = norm.replace(/ armor$/, '')
  const stripped = allRows.find(r => normName(r.name) === noArmor)
  if (stripped) return rowPrice(stripped)
  const paren = name.match(/\(([^)]+)\)/)
  if (paren) {
    const inner = normName(paren[1])
    const focus = FOCUS_DETAIL_ROWS.find(r => normName(r.name) === inner)
    if (focus) return rowPrice(focus)
    const weapon = WEAPON_ROWS.find(r => normName(r.name) === inner)
    if (weapon) return rowPrice(weapon)
  }
  const qty = name.match(/^(\d+)\s+(.+)$/)
  if (qty) {
    const bundled = GEAR_ROWS.find(r => normName(r.name) === normName(`${qty[2]} (${qty[1]})`))
    if (bundled) return rowPrice(bundled)
    // The chapter's bundle names ("Crossbow Bolts (20)", "Firearm
    // Bullets (10)") — the same free-text aliases the server resolver
    // carries, so a package spelling still prices.
    const bundleAliases = { arrows: 'Arrows', bolts: 'Crossbow Bolts', bullets: 'Firearm Bullets' }
    const alias = bundleAliases[normName(qty[2])]
    if (alias) {
      const aliased = GEAR_ROWS.find(r => normName(r.name) === normName(`${alias} (${qty[1]})`))
      if (aliased) return rowPrice(aliased)
    }
    const bare = allRows.find(r => normName(r.name) === normName(qty[2]))
    if (bare) return rowPrice(bare)
  }
  const pack = equipmentData.packs?.[name] || equipmentData.packs?.[Object.keys(equipmentData.packs || {}).find(k => normName(k) === norm)]
  if (pack) return rowPrice(pack)
  return null
}

/** Armor entry for an armor name from equipment.json, or null. Same name normalization as priceForItem. */
export function armorEntryFor(rawName) {
  if (!rawName) return null
  const norm = normName(rawName)
  const rows = [...((equipmentData.armor?.light || [])), ...((equipmentData.armor?.medium || [])), ...((equipmentData.armor?.heavy || []))]
  return rows.find(r => normName(r.name) === norm)
    || rows.find(r => normName(r.name) === norm.replace(/ armor$/, ''))
    || null
}

export function isShieldItem(rawName) {
  return normName(rawName) === 'shield'
}

// --- Package entry parsing -------------------------------------------
// String entries are a fallback only (the live route sends objects);
// the string phrases below parse the book's free-text lines the way
// the old fixtures wrote them, so a hand-written fixture still reads.

const CATEGORY_PHRASES = [
  [/artisan'?s tools or musical instrument/i, ['any_artisan_tool', 'any_musical_instrument']],
  [/musical instrument of your choice/i, ['any_musical_instrument']],
  [/any (?:\w+ )?simple melee weapons?/i, ['any_simple_melee_weapon']],
  [/any (?:\w+ )?martial melee weapons?/i, ['any_martial_melee_weapon']],
  [/any (?:\w+ )?simple ranged weapons?/i, ['any_simple_ranged_weapon']],
  [/any (?:\w+ )?martial ranged weapons?/i, ['any_martial_ranged_weapon']],
  [/any (?:\w+ )?simple weapons?/i, ['any_simple_weapon']],
  [/any (?:\w+ )?martial weapons?/i, ['any_martial_weapon']],
  [/any (light|medium|heavy) armor/i, null], // resolved below by the captured type
  [/any armor/i, ['any_armor']],
  [/any gaming set/i, ['any_gaming_set']],
  [/any tool kits?/i, ['any_tool_kit']],
  [/any arcane focus/i, ['any_arcane_focus']],
  [/any druidic focus/i, ['any_druidic_focus']],
  [/any holy symbol/i, ['any_holy_symbol']],
  [/any (musical )?instrument/i, ['any_musical_instrument']],
  [/any tool/i, ['any_tool']],
  [/any skill/i, ['any_skill']],
  [/any language/i, ['any_language']],
]

function countFromText(text) {
  const digit = String(text || '').match(/(\d+)/)
  if (digit) return Number(digit[1])
  const word = String(text || '').toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/)
  return word ? NUMBER_WORDS[word[1]] : 1
}

function sentinelsFromText(text) {
  const t = String(text || '')
  for (const [re, sentinels] of CATEGORY_PHRASES) {
    const m = t.match(re)
    if (!m) continue
    if (sentinels) return sentinels
    if (m[1]) return [`any_${m[1].toLowerCase()}_armor`]
  }
  return null
}

function isFixedEntry(entry) {
  return entry && typeof entry.name === 'string' && typeof entry.quantity === 'number'
}
function isChoiceEntry(entry) {
  return entry && typeof entry.key === 'string' && typeof entry.choose === 'number'
    && typeof entry.count === 'number' && 'from' in entry
}
function isBundleEntry(entry) {
  return entry && Array.isArray(entry.items)
}

/** An alternative normalises to a list of entries: a bare array is itself, { items } unwraps, a fixed item or a choice entry stands alone. */
export function alternativeEntries(alternative) {
  if (Array.isArray(alternative)) return alternative
  if (isBundleEntry(alternative)) return alternative.items
  return [alternative]
}

/**
 * Parse one package entry into a renderable kind. Kinds: 'fixed'
 * (a named item, { name, quantity }), 'choice' (a picker,
 * { key, count, label, from }) where `from` is a sentinel string or
 * an array of alternatives, 'bundle' ({ entries, condition }), 'gold'
 * (gp inside the package, { amount }), 'text' (anything else,
 * rendered verbatim). Never throws; an unrecognised entry is 'text'.
 */
export function parsePackageItem(entry) {
  if (entry == null) return { kind: 'text', label: '' }
  if (typeof entry === 'string') {
    const text = entry.trim()
    if (!text) return { kind: 'text', label: '' }
    const gold = text.match(/^(\d+)\s*gp$/i)
    if (gold) return { kind: 'gold', amount: Number(gold[1]), label: text }
    if (/^any_[a-z_]+$/.test(text)) {
      return { kind: 'choice', key: text, count: 1, label: describeSentinel(text), from: text }
    }
    const sentinels = sentinelsFromText(text)
    if (sentinels) {
      return { kind: 'choice', key: text, count: countFromText(text), label: text, from: sentinels[0] }
    }
    const qty = text.match(/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)$/i)
    if (qty) {
      const n = /^\d+$/.test(qty[1]) ? Number(qty[1]) : NUMBER_WORDS[qty[1].toLowerCase()]
      return { kind: 'fixed', name: qty[2].trim(), quantity: n, label: text }
    }
    return { kind: 'fixed', name: text, quantity: 1, label: text }
  }
  if (typeof entry === 'object') {
    if (isFixedEntry(entry)) {
      return { kind: 'fixed', name: String(entry.name), quantity: entry.quantity, label: String(entry.name) }
    }
    if (isChoiceEntry(entry)) {
      return { kind: 'choice', key: entry.key, count: choiceCountOf(entry), label: entry.label || entry.key, from: entry.from }
    }
    if (isBundleEntry(entry)) {
      return { kind: 'bundle', entries: entry.items, condition: entry.condition || null, label: '' }
    }
    if (Array.isArray(entry)) {
      return { kind: 'bundle', entries: entry, condition: null, label: '' }
    }
    if (Number.isFinite(Number(entry.gold))) {
      return { kind: 'gold', amount: Number(entry.gold), label: `${entry.gold} GP` }
    }
    if (entry.name) {
      return { kind: 'fixed', name: String(entry.name), quantity: Number.isFinite(Number(entry.quantity)) && Number(entry.quantity) > 0 ? Number(entry.quantity) : 1, label: entry.label || String(entry.name) }
    }
    if (entry.text || entry.label) {
      return { kind: 'text', label: String(entry.text || entry.label) }
    }
  }
  return { kind: 'text', label: String(entry) }
}

/** Plain-English label for one alternative (fixed item, nested choice, or bundle) for the radio list. */
export function alternativeLabel(alternative) {
  const entries = alternativeEntries(alternative)
  const parts = entries.map(e => {
    const p = parsePackageItem(e)
    if (p.kind === 'fixed') return `${p.quantity > 1 ? `${p.quantity} × ` : ''}${p.name}`
    if (p.kind === 'choice') return p.label
    if (p.kind === 'bundle') return alternativeLabel(e)
    if (p.kind === 'gold') return `${p.amount} GP`
    return p.label || ''
  }).filter(Boolean)
  return parts.join(' + ')
}

/** Condition text carried on a bundle alternative, if any ("Proficient with heavy armor" — display-only). */
export function alternativeCondition(alternative) {
  if (!alternative || typeof alternative !== 'object' || Array.isArray(alternative)) return null
  return typeof alternative.condition === 'string' && alternative.condition.trim()
    ? alternative.condition.trim()
    : null
}

/**
 * Choice keys reachable under the current picks: a choice's own key
 * always counts; a nested choice counts only when its alternative is
 * taken. Used to prune stale-branch picks (the resolver refuses a
 * pick that does not apply to the selected alternative).
 */
export function reachableChoiceKeys(entries, picks = {}) {
  const into = new Set()
  const walk = (list) => {
    for (const entry of list || []) {
      const p = parsePackageItem(entry)
      if (p.kind === 'choice') {
        into.add(p.key)
        if (Array.isArray(p.from)) {
          const taken = picks?.[p.key]
          if (taken && typeof taken === 'object' && !Array.isArray(taken) && Number.isInteger(taken.alternative)) {
            const alt = p.from[taken.alternative]
            if (alt !== undefined) walk(alternativeEntries(alt))
          }
        }
      } else if (p.kind === 'bundle') {
        walk(p.entries)
      }
    }
  }
  walk(entries)
  return into
}

/** Drop picks whose keys are not reachable under the current picks (stale branches). */
export function prunePicks(entries, picks = {}) {
  const keep = reachableChoiceKeys(entries, picks)
  const out = {}
  for (const [k, v] of Object.entries(picks || {})) {
    if (keep.has(k)) out[k] = v
  }
  return out
}

/**
 * Fixed items in a package option under the current picks — only the
 * TAKEN alternatives count (an untaken armor fork grants no armor).
 * Returns [{ name, quantity }]. Used for the derived-AC display.
 */
export function selectedFixedItems(option, picks = {}) {
  const out = []
  const walk = (list) => {
    for (const entry of list || []) {
      const p = parsePackageItem(entry)
      if (p.kind === 'fixed') out.push({ name: p.name, quantity: p.quantity })
      else if (p.kind === 'choice' && Array.isArray(p.from)) {
        const taken = picks?.[p.key]
        if (taken && typeof taken === 'object' && !Array.isArray(taken) && Number.isInteger(taken.alternative)) {
          const alt = p.from[taken.alternative]
          if (alt !== undefined) walk(alternativeEntries(alt))
        }
      } else if (p.kind === 'bundle') walk(p.entries)
    }
  }
  walk(option?.items || [])
  return out
}

/**
 * Display-only level-1 derived numbers, from the same rules the
 * server recomputes at submit — HP = hit die + Con mod (min 1),
 * AC = 10 + Dex mod, or armor base + Dex (light: full; medium:
 * capped at +2; heavy: none) + 2 for a shield, speed from the
 * species walk speed. Nulls where the inputs are not placed yet.
 * Never sent as authoritative — the server derives these at save.
 */
export function deriveLevel1Stats({ hitDie, conScore, dexScore, armorName, hasShield, walkSpeed }) {
  const conMod = abilityModifier(conScore)
  const dexMod = abilityModifier(dexScore)
  const hp = hitDie != null && conMod != null ? Math.max(1, hitDie + conMod) : null
  let ac = null
  let acNote = ''
  if (dexMod != null) {
    const armor = armorEntryFor(armorName)
    if (armor) {
      const dexPart = armor.armorType === 'light' ? dexMod
        : armor.armorType === 'medium' ? Math.min(dexMod, armor.maxDexBonus ?? 2)
        : 0
      ac = armor.baseAC + dexPart + (hasShield ? 2 : 0)
      acNote = `${armor.name} ${armor.baseAC} + Dex ${formatModifier(dexPart)}${hasShield ? ' + Shield 2' : ''}`
    } else {
      ac = 10 + dexMod
      acNote = `10 + Dex ${formatModifier(dexMod)} (before armor)`
    }
  }
  return {
    hp,
    // The minimum-1 rule governs the TOTAL, never the Con modifier:
    // "8 hit die + 4 Con modifier = 12". The minimum note attaches
    // to the total and shows only when it actually binds (hit die +
    // Con modifier below 1) — otherwise it is noise on a normal total.
    hpNote: hp == null ? '' : (hitDie + conMod < 1
      ? `${hitDie} hit die ${conMod < 0 ? '-' : '+'} ${Math.abs(conMod)} Con modifier; minimum 1 HP total`
      : `${hitDie} hit die ${conMod < 0 ? '-' : '+'} ${Math.abs(conMod)} Con modifier = ${hp}`),
    ac,
    acNote,
    speed: Number.isFinite(Number(walkSpeed)) ? Number(walkSpeed) : null,
  }
}

const ALIGNMENTS = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', 'Unaligned']
const LIFESTYLES = ['Wretched', 'Squalid', 'Poor', 'Modest', 'Comfortable', 'Wealthy', 'Aristocratic']

export default function Stage5GearStory({ state, set, themes = null, speciesEntry = null }) {
  const classId = state.classId || ''
  const cls = classesData[classId] || null
  const className = cls?.name || (classId ? classId : '')
  const themeId = state.themeId || ''
  const themeList = Array.isArray(themes) ? themes : (Array.isArray(themes?.themes) ? themes.themes : null)
  const theme = (themeList || []).find(t => t.id === themeId) || null
  const finals = state.ability_scores || {}
  const gearChoice = state.gear_choice || ''
  const packageId = state.package_id || ''
  const packagePicks = state.package_picks || {}

  const update = (patch) => set(prev => ({ ...prev, ...patch }))

  // --- Starting packages: fetch from the route when class changes ----
  const [packageData, setPackageData] = useState(null)
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [packagesFailed, setPackagesFailed] = useState(false)
  useEffect(() => {
    if (!classId) { setPackageData(null); setPackagesFailed(false); setPackagesLoading(false); return }
    let live = true
    setPackagesLoading(true)
    setPackagesFailed(false)
    fetch(`/api/starting-packages/${encodeURIComponent(classId)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => {
        if (!live) return
        setPackagesLoading(false)
        const norm = normalizePackageData(d)
        if (norm) { setPackageData(norm); setPackagesFailed(false) }
        else { setPackageData(null); setPackagesFailed(true) }
      })
      .catch((err) => {
        if (!live) return
        console.warn('[creator] /api/starting-packages unreachable:', err?.message || err)
        setPackagesLoading(false)
        setPackageData(null)
        setPackagesFailed(true)
      })
    return () => { live = false }
  }, [classId])

  // Class change clears Stage 5 picks made for the old class (plan
  // Page 9 rule, same as Stage 4). stage5PicksClass records which
  // class the current picks belong to; first arrival just records.
  useEffect(() => {
    if (!classId) return
    const recorded = state.stage5PicksClass || ''
    if (!recorded) {
      const hasPicks = !!gearChoice || !!packageId || Object.keys(packagePicks).length > 0
      update({ stage5PicksClass: classId, ...(hasPicks ? { gear_choice: '', package_id: '', package_picks: {} } : {}) })
      return
    }
    if (recorded !== classId) {
      update({ stage5PicksClass: classId, gear_choice: '', package_id: '', package_picks: {} })
    }
    // Runs only when the picked class changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  const goldBaseline = goldOptionBaseline(packageData?.goldOption ?? null)
  const goldTotal = computedGold(goldBaseline, themeId)
  const selectedOption = (packageData?.options || []).find(o => o.id === packageId) || null
  const selectedPicks = packagePicks[packageId] || {}

  // Dedup held sets (Stages 1/3/4): a category option already held
  // grays out. Instruments and tools are tool proficiencies; skills
  // and languages read their own lists. Weapons, armor, packs, and
  // focuses have no held list in state, so nothing grays out there.
  const heldForSentinel = (sentinel) => {
    if (/skill/.test(sentinel)) return [...(state.skills || [])]
    if (/language/.test(sentinel)) return [...(state.languages || [])]
    if (/tool|instrument|focus/.test(sentinel)) return [...(state.tool_proficiencies || [])]
    return []
  }

  const pickPackage = (id) => update({ gear_choice: 'packages', package_id: id })
  const pickGold = () => {
    if (goldBaseline == null) return
    update({ gear_choice: 'gold' })
  }
  // Sentinel-category pick: one slot of a `count`-slot pick, stored as
  // an array under the choice key. Switching an alternative prunes
  // stale-branch picks (the resolver refuses them).
  const setSentinelPick = (optionId, key, slot, value) => {
    const cur = (packagePicks[optionId] || {})
    const existing = Array.isArray(cur[key]) ? cur[key] : []
    const next = [...existing]
    while (next.length <= slot) next.push('')
    next[slot] = value
    const compacted = next.filter(v => v !== '')
    const opt = (packageData?.options || []).find(o => o.id === optionId)
    const pruned = opt ? prunePicks(opt.items, { ...cur, [key]: compacted }) : { ...cur, [key]: compacted }
    update({ package_picks: { ...packagePicks, [optionId]: pruned } })
  }
  const setAlternativePick = (optionId, key, index) => {
    const cur = (packagePicks[optionId] || {})
    const opt = (packageData?.options || []).find(o => o.id === optionId)
    const pruned = opt ? prunePicks(opt.items, { ...cur, [key]: { alternative: index } }) : { ...cur, [key]: { alternative: index } }
    update({ package_picks: { ...packagePicks, [optionId]: pruned } })
  }

  // Derived numbers (display only — the server recomputes at save).
  const walkSpeed = state.mixedAncestry?.speed
    ?? speciesEntry?.speeds?.walk
    ?? speciesEntry?.speed
    ?? 30
  const selectedNames = selectedOption ? selectedFixedItems(selectedOption, selectedPicks).map(i => i.name) : []
  const selectedArmor = selectedNames.map(armorEntryFor).find(Boolean)?.name || null
  const selectedShield = selectedNames.some(isShieldItem)
  const derived = deriveLevel1Stats({
    hitDie: cls?.hitDie ?? null,
    conScore: finals.con ?? null,
    dexScore: finals.dex ?? null,
    armorName: gearChoice === 'packages' ? selectedArmor : null,
    hasShield: gearChoice === 'packages' ? selectedShield : false,
    walkSpeed,
  })

  const selectStyle = {
    width: '100%', padding: '10px 12px', fontFamily: 'var(--serif)',
    fontSize: 16, background: 'var(--paper, #fff)', color: 'var(--ink, #222)',
    border: '1px solid var(--rule, #888)', borderRadius: 6
  }
  const inputStyle = {
    width: '100%', padding: '10px 12px', fontFamily: 'var(--serif)',
    fontSize: 16, background: 'var(--paper, #fff)', color: 'var(--ink, #222)',
    border: '1px solid var(--rule, #888)', borderRadius: 6
  }
  const labelStyle = { display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '18px 0 6px' }
  // One shared checkbox-row style (creator test-notes #13/#18/#19,
  // extended to Stage 5 in round 2): a flex row keeps the radio /
  // checkbox on the same horizontal plane as its name. The input
  // never shrinks; the label text takes the rest of the row.
  const checkStyle = { display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--serif)', fontSize: 15, margin: '4px 0' }
  const checkInputStyle = { flex: '0 0 auto' }

  // Recursive entry renderer: fixed items, sentinel pickers,
  // alternative forks (with their taken branch rendered nested),
  // bundles. `picks` is this option's picks object.
  const renderEntries = (entries, optionId, picks) => (
    <ul style={{ fontFamily: 'var(--serif)', fontSize: 15, margin: '6px 0 0 20px' }}>
      {(entries || []).map((entry, idx) => {
        const parsed = parsePackageItem(entry)
        const key = `${optionId}-entry-${idx}`
        if (parsed.kind === 'gold') {
          return <li key={key}>and {parsed.amount} GP</li>
        }
        if (parsed.kind === 'text') {
          return <li key={key}>{parsed.label}</li>
        }
        if (parsed.kind === 'bundle') {
          return (
            <li key={key}>
              {parsed.condition && <span>({parsed.condition}) </span>}
              {renderEntries(parsed.entries, optionId, picks)}
            </li>
          )
        }
        if (parsed.kind === 'choice') {
          if (typeof parsed.from === 'string') {
            const optionList = resolveChoiceOptions({ options: parsed.from }) || []
            const held = heldForSentinel(parsed.from)
            const count = parsed.count || 1
            const slots = normalizeChoiceValues(picks?.[parsed.key], count)
            const heading = parsed.label && parsed.label !== parsed.key
              ? parsed.label
              : `Choose ${count > 1 ? `${count} ` : ''}${describeSentinel(parsed.from)}`
            if (!optionList.length) {
              return (
                <li key={key}>
                  <span style={labelStyle}>{heading}
                    <Tip text={`A free choice of ${describeSentinel(parsed.from)} — too open-ended for a list, so write it in. It locks at creation with the rest of the package. A duplicate of something you already hold becomes a replacement pick of the same type, never a stack.`} />
                  </span>
                  {slots.map((slotVal, slot) => (
                    <input
                      key={slot}
                      type="text"
                      aria-label={`${heading} ${slot + 1}`}
                      value={slotVal}
                      onChange={e => setSentinelPick(optionId, parsed.key, slot, e.target.value)}
                      style={{ ...inputStyle, marginTop: 4 }}
                      placeholder={`Choose ${describeSentinel(parsed.from)}`}
                    />
                  ))}
                </li>
              )
            }
            return (
              <li key={key}>
                <span style={labelStyle}>{heading}
                  <Tip text={`Pick ${count > 1 ? `${count} ` : 'one '}from ${describeSentinel(parsed.from)} — the book leaves this open, so you choose. It locks at creation with the rest of the package. An option you already hold is grayed out and disabled, never hidden: pick a replacement of the same type instead, never a stack or a boost.`} />
                </span>
                {slots.map((slotVal, slot) => (
                  <select
                    key={slot}
                    aria-label={`${heading} ${slot + 1}`}
                    value={slotVal}
                    onChange={e => setSentinelPick(optionId, parsed.key, slot, e.target.value)}
                    style={{ ...selectStyle, marginTop: 4 }}
                  >
                    <option value="">—</option>
                    {optionList.map(o => {
                      const heldOpt = isHeldOption(o.value, held)
                      const taken = slots.includes(o.value) && slotVal !== o.value
                      return (
                        <option key={o.value} value={o.value} disabled={heldOpt || taken}>
                          {o.label}{heldOpt ? ' — already granted' : ''}
                        </option>
                      )
                    })}
                  </select>
                ))}
              </li>
            )
          }
          // Array `from`: one alternative, rendered as radios; the
          // taken alternative's entries render nested beneath it.
          // `condition` on an alternative is display-only — shown,
          // never enforced (the resolver has no proficiency data).
          const taken = picks?.[parsed.key]
          const takenIndex = taken && typeof taken === 'object' && !Array.isArray(taken) && Number.isInteger(taken.alternative)
            ? taken.alternative
            : null
          return (
            <li key={key}>
              <span style={labelStyle}>{parsed.label}
                <Tip text={`${parsed.label}: pick one of the options below — the book offers them as alternatives, not as a bundle. It locks at creation with the rest of the package. A branch marked with a condition (e.g. proficient with heavy armor) is shown as the book prints it; the condition is not enforced here.`} />
              </span>
              <div role="group" aria-label={parsed.label} style={{ marginLeft: 12 }}>
                {parsed.from.map((alt, altIdx) => {
                  const cond = alternativeCondition(alt)
                  return (
                    <label key={altIdx} style={checkStyle}>
                      <input
                        type="radio" name={`stage5-${optionId}-${parsed.key}`} value={altIdx}
                        style={checkInputStyle}
                        checked={takenIndex === altIdx}
                        onChange={() => setAlternativePick(optionId, parsed.key, altIdx)}
                      /> {alternativeLabel(alt)}
                      {cond && <span style={{ opacity: 0.75 }}> ({cond})</span>}
                    </label>
                  )
                })}
              </div>
              {takenIndex != null && parsed.from[takenIndex] !== undefined && (
                <div style={{ marginLeft: 12 }}>
                  {renderEntries(alternativeEntries(parsed.from[takenIndex]), optionId, picks)}
                </div>
              )}
            </li>
          )
        }
        const price = priceForItem(parsed.name)
        return (
          <li key={key}>
            {parsed.quantity > 1 ? `${parsed.quantity} × ` : ''}{parsed.name}
            {price?.cost ? ` — ${price.cost}` : ''}
            {price?.weight != null && price.weight !== 0 ? `, ${price.weight} lb` : ''}
          </li>
        )
      })}
    </ul>
  )

  // Story fields (R2-14): the description renders INLINE under the
  // label, visible without hovering — the ? button is gone where its
  // text is now inline. These two helpers serve the Story section
  // only, so nothing else on the stage changes. `guide` is extra
  // prompt lines under the description (personality traits only):
  // questions to answer, never sample traits.
  const textField = (key, label, tip, multiline = false, guide = null) => (
    <div key={key}>
      <label style={labelStyle}>{label}</label>
      <div className="help" style={{ fontStyle: 'normal', marginTop: 2 }}>{tip}</div>
      {guide && (
        <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
          {guide.map(q => (<div key={q}>· {q}</div>))}
        </div>
      )}
      {multiline ? (
        <textarea
          aria-label={label}
          value={state[key] || ''}
          onChange={e => update({ [key]: e.target.value })}
          rows={3}
          style={{ ...inputStyle, minHeight: 72 }}
        />
      ) : (
        <input
          type="text"
          aria-label={label}
          value={state[key] || ''}
          onChange={e => update({ [key]: e.target.value })}
          style={inputStyle}
        />
      )}
    </div>
  )
  const selectField = (key, label, tip, options) => (
    <div key={key}>
      <label style={labelStyle}>{label}</label>
      <div className="help" style={{ fontStyle: 'normal', marginTop: 2 }}>{tip}</div>
      <select
        aria-label={label}
        value={state[key] || ''}
        onChange={e => update({ [key]: e.target.value })}
        style={selectStyle}
      >
        <option value="">—</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="card">
      <div className="eyebrow">Stage 5 of 6</div>
      <h1 className="h-step">Gear &amp; Story</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Take your class&apos;s starting equipment — or gold instead — then
        say who this person is. The gear choice locks at creation; the
        story text stays editable later in edit mode. Nothing here is
        pre-picked: the fork starts empty, and every story field starts blank.
      </p>

      {!classId && (
        <div className="help" style={{ fontStyle: 'normal' }}>
          No class picked yet — pick one on Stage 2 first. Starting
          equipment packages are per-class.
        </div>
      )}

      {/* ---- Starting equipment ---- */}
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 19, marginTop: 22 }}>
        Starting equipment
        <Tip text="Your class's starting equipment, straight from its book: a package of gear, or gold to buy your own instead. The package choice locks at creation — the server turns your pick into inventory, equipment, and gold at submit, and it never re-derives it later. Picking gold means starting with coin and no gear: buy what you need when play starts." />
      </h2>

      {classId && packagesLoading && (
        <div className="help" style={{ fontStyle: 'normal' }}>
          Loading {className || classId}&apos;s starting packages…
        </div>
      )}
      {classId && packagesFailed && (
        <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
          Couldn&apos;t load the starting packages — check your connection and refresh. Your story text below still saves.
        </div>
      )}

      {classId && packageData && (
        <>
          <div role="group" aria-label="Equipment or gold">
            {packageData.options.map(option => {
              const chosen = gearChoice === 'packages' && packageId === option.id
              return (
                <div
                  key={option.id}
                  style={{
                    border: chosen ? '2px solid var(--ink, #222)' : '1px solid var(--rule, #888)',
                    borderRadius: 8, padding: '12px 14px', marginTop: 10,
                    background: chosen ? 'rgba(0,0,0,0.03)' : 'transparent'
                  }}
                >
                  <label style={{ ...checkStyle, fontWeight: 700 }}>
                    <input
                      type="radio" name="stage5-package" value={option.id}
                      style={checkInputStyle}
                      checked={chosen}
                      onChange={() => pickPackage(option.id)}
                    /> Package ({option.id})
                    <Tip text={`Package (${option.id}) for ${className || classId}: the gear listed below, plus ${option.gold} GP tucked in with it. It locks at creation — the server resolves it into your inventory and equipment at submit. Picking a package means no starting-gold fork: the gold below is the package's own coin, not the fork amount.`} />
                  </label>
                  {renderEntries(option.items, option.id, packagePicks[option.id] || {})}
                  {option.gold > 0 && (
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 15, marginTop: 6 }}>
                      Package gold: {option.gold} GP (in with the gear, not instead of it)
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div
            style={{
              border: goldBaseline == null ? '1px solid var(--rule, #888)' : (gearChoice === 'gold' ? '2px solid var(--ink, #222)' : '1px solid var(--rule, #888)'),
              borderRadius: 8, padding: '12px 14px', marginTop: 10,
              opacity: goldBaseline == null ? 0.55 : 1
            }}
          >
            <label style={{ ...checkStyle, fontWeight: 700 }}>
              <input
                type="radio" name="stage5-package" value="gold"
                style={checkInputStyle}
                checked={gearChoice === 'gold'}
                disabled={goldBaseline == null}
                onChange={pickGold}
              /> Take gold instead
              <Tip text={goldBaseline == null
                ? `No starting-gold value in ${className || classId}'s book — the book prints equipment only, so there is no gold amount to take instead. The package above is the only starting gear for this class.`
                : `Gold instead of the package: ${goldBaseline} GP from ${className || classId}'s book${theme ? `, ${theme.name} adjusts it to ${goldTotal} GP` : ''}. It locks at creation — the server pays it out at submit, and it never re-derives later. Starting with coin means starting with no gear: buy what you need when play starts.`} />
            </label>
            {goldBaseline != null && (
              <div style={{ fontFamily: 'var(--serif)', fontSize: 15, marginTop: 6 }}>
                Class baseline {goldBaseline} GP
                {theme && (
                  <> · {theme.name} {(() => {
                    const mod = THEME_GOLD_MODIFIERS[themeId] ?? 0
                    if (mod === 0) return '— no change'
                    const pct = Math.round(Math.abs(mod) * 100)
                    return mod > 0 ? `+${pct}%` : `−${pct}%`
                  })()} → <strong>{goldTotal} GP</strong></>
                )}
                {!theme && <> · no theme picked yet — pick one on Stage 3 and its gold modifier lands here</>}
              </div>
            )}
            {goldBaseline == null && (
              <div style={{ fontFamily: 'var(--serif)', fontSize: 15, marginTop: 6 }}>
                No starting-gold value in {className || classId}&apos;s book.
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- Derived numbers (display only) ---- */}
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 19, marginTop: 22 }}>
        What you start with
        <Tip text="Your level-1 numbers, worked out from the same rules the server uses at submit: hit points from your class hit die plus your Constitution modifier (at least 1 HP total), armor class from your Dexterity plus the armor and shield in the package you picked, walk speed from your species. These are shown, not picked — the server recomputes them at submit and never trusts these numbers." />
      </h2>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 15, marginTop: 6 }}>
        <div>Hit points: {derived.hp == null ? '— place Constitution on Stage 4 first' : `${derived.hp} (${derived.hpNote})`}</div>
        <div>Armor class: {derived.ac == null ? '— place Dexterity on Stage 4 first' : `${derived.ac} (${derived.acNote})`}</div>
        <div>Walk speed: {derived.speed == null ? '—' : `${derived.speed} ft`}</div>
      </div>
      <div className="help" style={{ fontStyle: 'normal' }}>
        Server-derived at save: the numbers above are computed here for display only, from the same rules. The server recomputes HP, AC, and speed at submit — nothing on this page sends them as authoritative.
        {gearChoice === 'gold' && ' On the gold fork there is no package armor yet, so armor class is shown before armor — buy armor with your gold and the sheet works it out.'}
      </div>

      {/* ---- Story & appearance ---- */}
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 19, marginTop: 22 }}>
        Story &amp; appearance
        <Tip text="Who this person is, for the DM to play with. All of it is optional at this stage — alignment, faith, lifestyle, and physical description are required at Review (Stage 6), the rest can stay blank — and all of it stays editable later in edit mode. Nothing here touches mechanics." />
      </h2>

      {selectField('alignment', 'Alignment', 'Your moral compass: the nine alignments, or Unaligned if none of them fit. It shapes how the DM plays the world around you, never a mechanic — no class or feature reads it. Required at Review, changeable later in edit mode.', ALIGNMENTS)}
      {selectField('faith', 'Faith', 'Who you worship, if anyone — the Faerûnian pantheon, or None. Picking None is a real choice, not a missing value: an atheist and a devout cleric meet the world differently, and the DM plays that. Required at Review, changeable later in edit mode.', ['None', ...Object.values(deitiesData).map(d => d.name)])}
      {selectField('lifestyle', 'Lifestyle', 'How you live day to day, from Wretched to Aristocratic. It sets what a night, a meal, and a roof cost you between adventures — flavor with a price tag, not a lock. Required at Review, changeable later in edit mode.', LIFESTYLES)}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        {textField('age', 'Age', 'How old you are, in years or in your species’ own reckoning. Flavor for the DM — it never changes a number. Optional, changeable later in edit mode.')}
        {textField('height', 'Height', 'How tall you are — feet and inches, or your species’ own measure. Flavor for the DM, never a mechanic. Optional, changeable later in edit mode.')}
        {textField('weight', 'Weight', 'How much you weigh. Flavor for the DM, never a mechanic. Optional, changeable later in edit mode.')}
        {textField('physical_build', 'Build', 'Your build — slim, heavy, wiry, broad, or your own words. Flavor for the DM, never a mechanic. Optional, changeable later in edit mode.')}
        {textField('eye_color', 'Eyes', 'Your eye color. Flavor for the DM, never a mechanic. Optional, changeable later in edit mode.')}
        {textField('hair_color', 'Hair', 'Your hair color and style, or bald, or something stranger. Flavor for the DM, never a mechanic. Optional, changeable later in edit mode.')}
        {textField('skin_color', 'Skin', 'Your skin color and texture. Flavor for the DM, never a mechanic. Optional, changeable later in edit mode.')}
      </div>

      {textField('personality_traits', 'Personality traits', 'How you act — habits, tics, the things people notice first. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode.', true, [
        'What do people notice about you first?',
        'What habit gives you away?',
        'What do you do when you\u2019re nervous?',
      ])}
      {textField('ideals', 'Ideals', 'What you believe in — the principles you would not give up. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode.', true)}
      {textField('bonds', 'Bonds', 'Who and what you are tied to — people, places, promises. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode.', true)}
      {textField('flaws', 'Flaws', 'Where you go wrong — the weakness the world can press on. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode.', true)}
      {textField('organizations', 'Organizations', 'Groups you belong to — a guild, an order, a crew. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode.', true)}
      {textField('allies', 'Allies', 'People on your side — friends, patrons, debts owed to you. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode.', true)}
      {textField('enemies', 'Enemies', 'People against you — rivals, hunters, debts you owe. Free text; the DM plays off it, nothing in the rules reads it. Optional, changeable later in edit mode.', true)}
      {textField('backstory', 'Backstory', 'Your story so far, in your own words — where you came from, what brought you here. The DM reads it and works it into the adventure. Optional, changeable later in edit mode.', true)}
      {textField('other_notes', 'Other notes', 'Anything else the DM should know that fits nowhere above. Free text, never a mechanic. Optional, changeable later in edit mode.', true)}

      <div className="help" style={{ fontStyle: 'normal' }}>
        Locked at creation: the equipment package or gold. Changeable later: everything on this page below the gear — appearance and story text never touch mechanics.
      </div>
    </div>
  )
}
