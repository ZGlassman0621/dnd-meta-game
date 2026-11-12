/**
 * Creator-next Stage 2 — subclass origin suffix (creator test-notes
 * #12 follow-up, 2026-11-09).
 *
 * The server registry carries origin_setting / origin_region per
 * subclass, and an outside-FR (or null-origin) subclass needs an
 * origin explanation — but the requirement is invisible at pick time
 * unless Stage 2 shows it (validateSelection has no callers in the
 * creator flow, so it never fires at commit either). This suffix is
 * rendered IN ADDITION to the subclass description, only for
 * non-FR/null origins. Wiring validateSelection into the commit path
 * is a separate follow-up: the client collects no subclass origin
 * explanation anywhere, so wiring it now would refuse every
 * outside-FR/null subclass at Review with no way to satisfy it.
 *
 * Rules (mirror server/services/subclassService.js formatSubclassOrigin
 * + isOutsideFr — null origin stays outside-FR, fail-closed, per the
 * server worker's #12 (c) decision: waiving would silently default
 * third-party/homebrew classes to FR):
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
  return ` · origin ${setting}${region} — an origin explanation is required for how its holder came to be in the Forgotten Realms`
}

/**
 * Creation-solidification item 5 (2026-11-12): true when the picked
 * subclass needs a SUBCLASS origin explanation — the same rule as the
 * server's subclassService.isOutsideFr (anything not Forgotten Realms,
 * a null origin included, fail-closed). Stage 2 shows the explanation
 * field when this is true; Review and the server commit both require
 * it. Pure function of the registry entry.
 */
export function subclassNeedsOriginExplanation(entry) {
  return !!entry && entry.origin_setting !== 'Forgotten Realms'
}
