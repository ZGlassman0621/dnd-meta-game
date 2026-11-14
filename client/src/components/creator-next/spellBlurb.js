/**
 * One-line summary of a spell for a picker row: the first sentence of the
 * book description, cut at a word boundary if still long. Never invents
 * text; returns '' when the spell has no description.
 *
 * Shared by every creator spell picker (Stage 2 cantrips, Stage 4 known /
 * spellbook / prepared spells) so they all read the same way.
 */
export function shortSpellBlurb(text, max = 170) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const m = t.match(/^.*?[.!?](?=\s|$)/)
  const first = m ? m[0] : t
  if (first.length <= max) return first
  return first.slice(0, max).replace(/\s+\S*$/, '') + '…'
}
