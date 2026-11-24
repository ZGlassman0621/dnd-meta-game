/**
 * Player-facing spell text for the creator's pickers (Stage 2 cantrips, Stage 4
 * known / spellbook / prepared spells), so every picker reads the same way.
 *
 * - spellDescriptionText: the catalog description, whitespace-normalised and shown
 *   IN FULL. (An earlier version cut it at 170 characters and dropped mechanics
 *   mid-sentence, e.g. "the damage is reduced by…".)
 * - spellFactsLine: one line built only from the catalog's own fields — cast time,
 *   range, duration, saving throw, ritual — so every spell shows its mechanics even
 *   when its prose carries no numbers. Nothing here is invented: a missing field is
 *   simply left out.
 */
const SAVE_NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }

export function spellDescriptionText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

export function spellFactsLine(spell) {
  if (!spell) return ''
  const parts = []
  if (spell.castTime) parts.push(`Cast: ${spell.castTime}`)
  if (spell.range) parts.push(`Range: ${spell.range}`)
  if (spell.duration) parts.push(`Duration: ${spell.duration}`)
  const save = SAVE_NAMES[String(spell.save || '').toLowerCase()]
  if (save) parts.push(`${save} save`)
  if (spell.ritual) parts.push('Ritual')
  return parts.join(' · ')
}

/**
 * The client catalog (data/spells.json) entry for a spell name, shaped for
 * SpellPickRow: `castingTime` maps to the row's `castTime`. Cantrip lists are
 * per class; level-1 spells are one list. Returns { name } alone when the
 * catalog has no entry (nothing invented). creator-round-3 item 9.
 */
export function catalogSpellRow(spellsData, name) {
  const want = String(name || '').trim().toLowerCase()
  if (!want) return { name: '' }
  const pools = [
    ...Object.values((spellsData && spellsData.cantrips) || {}),
    ...Object.values((spellsData && spellsData.spells) || {}),
  ]
  for (const list of pools) {
    const hit = (Array.isArray(list) ? list : []).find(s => s && String(s.name).toLowerCase() === want)
    if (hit) {
      return {
        name: hit.name, school: hit.school || null, description: hit.description || '',
        castTime: hit.castTime || hit.castingTime || null, range: hit.range || null,
        duration: hit.duration || null, save: hit.save || null, ritual: !!hit.ritual,
      }
    }
  }
  return { name: String(name) }
}

/**
 * creator-round-3 item 4: a spell list grouped by school of magic, schools in
 * alphabetical order, spells keeping their incoming order inside each school.
 * A spell with no school goes in a final "Other" group (none do today).
 */
export function groupSpellsBySchool(spells) {
  const groups = new Map()
  for (const s of Array.isArray(spells) ? spells : []) {
    const school = s && s.school ? String(s.school) : 'Other'
    if (!groups.has(school)) groups.set(school, [])
    groups.get(school).push(s)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'Other') - (b === 'Other') || a.localeCompare(b))
    .map(([school, list]) => ({ school, spells: list }))
}
