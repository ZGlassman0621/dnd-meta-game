/**
 * Equipment package option resolver — looks up the items inside a
 * class's startingEquipment.choices `from` strings against
 * equipment.json so the picker can show contents + stats inline.
 *
 * Class equipment options are short labels like "Chain Mail", "Two
 * Handaxes", "Light Crossbow and 20 Bolts", "Dungeoneer's Pack". This
 * helper parses each label and returns:
 *
 *   {
 *     items: [{ name, kind: 'weapon|armor|pack|other', stats?: ..., qty? }],
 *     packContents?: [string]
 *   }
 *
 * Stats per kind:
 *   - weapon: { damage, damageType, properties[] }
 *   - armor: { baseAC, armorType, maxDexBonus, strReq, stealthDisadvantage }
 *   - pack: { cost, contents }
 *
 * Per-class "(if proficient)" qualifier (e.g., Cleric "Warhammer (if
 * proficient)"): filtered out at the resolver level — the option is
 * dropped entirely. Once subclass-aware proficiency tracking lands,
 * the filter can flip to include-when-proficient. PM call 2026-05-02:
 * better to hide than to surface a confusing tag.
 */

import equipmentData from '../../data/equipment.json'

const SIMPLE_WEAPONS = [
  ...((equipmentData.simpleWeapons?.melee) || []),
  ...((equipmentData.simpleWeapons?.ranged) || [])
]
const MARTIAL_WEAPONS = [
  ...((equipmentData.martialWeapons?.melee) || []),
  ...((equipmentData.martialWeapons?.ranged) || [])
]
const ALL_WEAPONS = [...SIMPLE_WEAPONS, ...MARTIAL_WEAPONS]

/**
 * Spellcasting / class foci — short descriptions surfaced in Step 6
 * so the player knows what each focus actually IS without having to
 * consult the PHB. Keys match the option labels exactly.
 */
const FOCUS_DESCRIPTIONS = {
  'Component Pouch': 'A small belt pouch holding the material components for spells (powders, herbs, tiny vials). Required by spells that list material components — replaces having to track each ingredient individually.',
  'Arcane Focus': 'A crystal, orb, rod, staff, or wand that channels arcane spellcasting. Substitutes for material components without a listed gp cost. Wizards, sorcerers, and warlocks use this in place of (or alongside) a Component Pouch.',
  'Holy Symbol': 'A symbol of your deity worn or held — amulet, emblem on a shield, or reliquary. Required for clerics and paladins to channel divine spellcasting and Channel Divinity.',
  'Druidic Focus': "A sprig of mistletoe, totem, yew wand, or carved staff inscribed with druidic markings. Channels druidic spellcasting in place of material components."
}

export function getFocusDescription(label) {
  return FOCUS_DESCRIPTIONS[String(label || '').trim()] || null
}

/**
 * "Any X Weapon" predicate — class equipment options often offer a generic
 * weapon choice the player resolves to a specific weapon. Recognizes the
 * simple/martial tier plus an optional melee/ranged qualifier, e.g.:
 *   "Any Simple Weapon", "A Martial Weapon", "Any Simple Melee Weapon",
 *   "Any Martial Ranged Weapon".
 * Returns the matching weapon list, or null when the label isn't a weapon choice.
 */
export function getWeaponChoiceList(label) {
  const s = String(label || '').trim().toLowerCase()
  if (!/\bweapons?\b/.test(s)) return null
  const tier = /\bsimple\b/.test(s) ? 'simple' : /\bmartial\b/.test(s) ? 'martial' : null
  if (!tier) return null
  const data = (tier === 'simple' ? equipmentData.simpleWeapons : equipmentData.martialWeapons) || {}
  const melee = /\bmelee\b/.test(s)
  const ranged = /\branged\b/.test(s)
  if (melee && !ranged) return data.melee || []
  if (ranged && !melee) return data.ranged || []
  return [...(data.melee || []), ...(data.ranged || [])]
}

/**
 * Generic non-weapon "any X" tool / instrument choice. Class equipment
 * options often offer a choice the player resolves to a specific item:
 *   "Any Other Musical Instrument", "a musical instrument of your choice",
 *   "an artisan's tools of your choice", "a gaming set", and the combined
 *   "Choose one type of artisan's tools or one musical instrument".
 * Returns an array of pickable item names (strings), or null when the
 * label isn't one of these generic tool/instrument choices. The combined
 * "artisan's tools OR musical instrument" form returns both pools.
 */
export function getToolChoiceList(label) {
  const s = String(label || '').trim().toLowerCase()
  const wantsInstrument = /musical instrument/.test(s)
  const wantsArtisan = /artisan'?s?\s+tools?/.test(s)
  const wantsGaming = /gaming set/.test(s)
  if (!wantsInstrument && !wantsArtisan && !wantsGaming) return null
  const norm = (x) => (typeof x === 'string' ? x : (x?.name || String(x)))
  const tools = equipmentData.tools || {}
  const out = []
  if (wantsInstrument) (equipmentData.musicalInstruments || []).forEach(i => out.push(norm(i)))
  if (wantsArtisan) (tools.artisansTools || []).forEach(t => out.push(norm(t)))
  if (wantsGaming) (tools.gamingSets || []).forEach(t => out.push(norm(t)))
  const uniq = [...new Set(out.filter(Boolean))]
  return uniq.length ? uniq.sort((a, b) => a.localeCompare(b)) : null
}

const ALL_ARMOR = [
  ...((equipmentData.armor?.light) || []),
  ...((equipmentData.armor?.medium) || []),
  ...((equipmentData.armor?.heavy) || []),
  ...((equipmentData.armor?.shields) || [])
]

const PACKS = equipmentData.packs || {}

/**
 * Predicate: is this equipment-option label gated on a proficiency
 * the player may not have? Any string containing "(if proficient)" or
 * similar qualifier is filtered out per PM ruling.
 */
export function isProficiencyGated(optionLabel) {
  return /\(if proficient\)/i.test(String(optionLabel || ''))
}

/**
 * Strip the "(if proficient)" tag from the label if present, returning
 * the bare item name. Used downstream of the filter for cosmetic
 * cleanup if we ever want to display the gated option separately.
 */
export function stripProficiencyTag(optionLabel) {
  return String(optionLabel || '').replace(/\s*\(if proficient\)/i, '').trim()
}

/**
 * Resolve a class equipment option label into structured item info.
 * Handles single items ("Chain Mail"), quantity-prefixed items
 * ("Two Handaxes"), conjunctions ("Leather Armor, Longbow, and 20
 * Arrows"), and pack lookups ("Dungeoneer's Pack").
 *
 * Returns { items: [...], packContents: [...] | null }.
 */
export function resolveOptionLabel(label) {
  if (!label) return { items: [], packContents: null }
  const cleanLabel = stripProficiencyTag(label)

  // Pack lookup — full contents available.
  const pack = PACKS[cleanLabel]
  if (pack) {
    return {
      items: [{ name: cleanLabel, kind: 'pack', cost: pack.cost }],
      packContents: pack.contents || []
    }
  }

  // Conjunction split — "X, Y, and Z" or "X and Y".
  const parts = splitConjunction(cleanLabel)
  const items = parts.map(part => resolveSinglePart(part)).filter(Boolean)

  return { items, packContents: null }
}

function splitConjunction(label) {
  // Replace " and " with comma, then split on commas. Handles
  // "Leather Armor, Longbow, and 20 Arrows" → 3 parts.
  const normalized = label.replace(/,?\s+and\s+/i, ', ')
  return normalized.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean)
}

const QTY_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10
}

function resolveSinglePart(part) {
  // Try to extract a leading quantity (numeric or word).
  let qty = 1
  let stripped = part
  const numMatch = part.match(/^(\d+)\s+(.+)$/)
  const wordMatch = part.match(/^([A-Za-z]+)\s+(.+)$/)
  if (numMatch) {
    qty = parseInt(numMatch[1], 10)
    stripped = numMatch[2]
  } else if (wordMatch && QTY_WORDS[wordMatch[1].toLowerCase()]) {
    qty = QTY_WORDS[wordMatch[1].toLowerCase()]
    // Singularize: "Two Handaxes" → singular "Handaxe"
    stripped = singularize(wordMatch[2])
  }

  // Try weapon match
  const weapon = ALL_WEAPONS.find(w => looseNameMatch(w.name, stripped))
  if (weapon) {
    return {
      name: weapon.name,
      kind: 'weapon',
      qty,
      stats: {
        damage: weapon.damage,
        damageType: weapon.damageType,
        properties: weapon.properties || [],
        weaponType: weapon.weaponType
      }
    }
  }

  // Try armor match
  const armor = ALL_ARMOR.find(a => looseNameMatch(a.name, stripped))
  if (armor) {
    return {
      name: armor.name,
      kind: 'armor',
      qty,
      stats: {
        baseAC: armor.baseAC,
        armorType: armor.armorType,
        maxDexBonus: armor.maxDexBonus,
        strReq: armor.strReq,
        stealthDisadvantage: armor.stealthDisadvantage
      }
    }
  }

  // Fallback: unknown item (e.g., "20 Bolts", "Holy Symbol") — render as
  // a quantity-tagged label.
  return { name: stripped, kind: 'other', qty }
}

function looseNameMatch(canonical, candidate) {
  if (!canonical || !candidate) return false
  const a = String(canonical).toLowerCase().replace(/\s+/g, '')
  const b = String(candidate).toLowerCase().replace(/\s+/g, '')
  return a === b || a.includes(b) || b.includes(a)
}

function singularize(word) {
  if (!word) return word
  // Crude: just strip a trailing "s" — sufficient for D&D weapon plurals
  // (Handaxes → Handaxe, Daggers → Dagger). Doesn't break "Crossbows"
  // → "Crossbow" (one trailing s).
  if (word.endsWith('es') && !word.endsWith('aes')) return word.slice(0, -2) + 'e'
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

export { ALL_WEAPONS, ALL_ARMOR, PACKS }
