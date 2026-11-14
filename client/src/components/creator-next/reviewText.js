/**
 * Player-facing text helpers for the creator's Review screen. Pure: no imports, so
 * tests can load this file directly.
 */

/** An alternative as a list of entries: a bare array is itself, { items } unwraps, anything else stands alone. */
function alternativeEntries(alt) {
  if (Array.isArray(alt)) return alt
  if (alt && Array.isArray(alt.items) && !alt.name) return alt.items
  return [alt]
}

/**
 * The item list for the chosen starting package: fixed items, the alternative taken for each
 * choice, and bundles unwrapped. Returns [] when the package data has not loaded. Never shows
 * raw pick objects ({"holy":{"alternative":0}}) — those are internal.
 */
export function packageItemLines(packageData, packageId, allPicks) {
  const pkg = (packageData?.options || []).find(o => o.id === packageId)
  if (!pkg) return []
  const picks = (allPicks && allPicks[packageId]) || {}
  const out = []
  const walk = (entries) => {
    for (const e of entries || []) {
      if (!e || typeof e !== 'object') continue
      if (Array.isArray(e.items) && !e.name) { walk(e.items); continue }
      if (e.key && Array.isArray(e.from)) {
        const idx = picks[e.key]?.alternative
        if (Number.isInteger(idx) && e.from[idx] !== undefined) walk(alternativeEntries(e.from[idx]))
        else out.push(`${e.label || 'Choice'}: not chosen yet`)
        continue
      }
      if (e.key && typeof e.from === 'string') {
        const chosen = Array.isArray(picks[e.key]) ? picks[e.key] : []
        out.push(chosen.length ? chosen.join(', ') : `${e.label || 'Choice'}: not chosen yet`)
        continue
      }
      if (e.name) out.push(`${e.name}${e.quantity > 1 ? ` ×${e.quantity}` : ''}`)
    }
  }
  walk(pkg.items)
  if (pkg.gold > 0) out.push(`${pkg.gold} GP`)
  return out
}

/**
 * The catalog description of the cantrip a trait grants ("You know the Light cantrip"), or ''.
 * `spells` is the catalog's spell array ({ key, description }).
 */
export function grantedCantripText(note, spells) {
  const m = String(note || '').match(/\b(?:know|learn)s? the ([A-Z][A-Za-z'’ -]+?) cantrip/)
  if (!m) return ''
  const key = m[1].toLowerCase().trim()
  const hit = (spells || []).find(s => s.key === key)
  return hit?.description || ''
}
