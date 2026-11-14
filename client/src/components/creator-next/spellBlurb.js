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
