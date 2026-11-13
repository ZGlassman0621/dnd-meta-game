/**
 * Creator-next Stage 2 — subclass origin suffix (creator test-notes
 * #12 follow-up, 2026-11-09).
 *
 * The server registry carries origin_setting / origin_region per
 * subclass. This suffix tells the player where a non-FR subclass
 * comes from, rendered IN ADDITION to the subclass description, only
 * for non-FR/null origins. It is informational: per Zach's ruling
 * 2026-11-12 ("a class is a class"), no subclass needs an origin
 * explanation, and the creator commit enforces only validateSelection's
 * found + level halves.
 *
 * Rules (mirror server/services/subclassService.js formatSubclassOrigin
 * + isOutsideFr):
 * - Forgotten Realms → '' (no suffix).
 * - Null/empty origin_setting → 'unspecified setting' (the text
 *   formatSubclassOrigin already produces).
 * - The region is never repeated when it equals the setting (Warlord
 *   used to render 'KibblesTasty (setting-neutral)' twice).
 * Pure function of the registry entry; no fetch, no state.
 */
export function subclassOriginSuffix(entry) {
  if (!entry || entry.origin_setting === 'Forgotten Realms') return ''
  const setting = entry.origin_setting || 'unspecified setting'
  const region = entry.origin_region && entry.origin_region !== entry.origin_setting
    ? ` (${entry.origin_region})`
    : ''
  // Informational only. Zach's ruling 2026-11-12 ("a class is a
  // class"): no subclass needs an origin explanation, so the suffix
  // no longer claims one is required.
  return ` · origin ${setting}${region}`
}
