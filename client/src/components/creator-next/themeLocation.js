/**
 * Creator-next — the theme location choice's legal options
 * (creation-solidification item 1, stale-choice edge, 2026-11-12).
 *
 * A theme whose creation choice is a location carries
 * creation_choice_source 'origin_regions': a non-FR character is
 * offered their own origin setting's REGIONS ("Home Region"); an FR
 * origin (or unset origin, or a setting with no region list) keeps the
 * theme's served list and label. Stage 3 renders these options, and
 * the shell uses the same function to clear a stored pick that is no
 * longer legal after the player changes origin on Stage 1 — one rule,
 * no drift. Pure: no fetch, no state.
 */
import { regionsForSetting } from '../../data/originSettings.js'
import { isOutsideFR, resolveOriginSetting } from './speciesAdapter.js'

export function themeLocationOptions(theme, state) {
  const creationOptions = Array.isArray(theme?.creation_choice_options) ? theme.creation_choice_options : []
  const originSetting = resolveOriginSetting(state?.origin_setting, state?.origin_setting_custom)
  const originRegions = theme?.creation_choice_source === 'origin_regions' && originSetting && isOutsideFR(originSetting)
    ? regionsForSetting(originSetting)
    : []
  const options = originRegions.length > 0
    ? originRegions.map(r => ({ value: r.name, label: r.name, description: r.description || '' }))
    : creationOptions
  const label = originRegions.length > 0
    ? 'Home Region'
    : (theme?.creation_choice_label || 'Path choice')
  return { options, label }
}

/**
 * True when the stored pick is no longer one of the legal options —
 * the pick to clear. An empty pick, or a theme that offers no fixed
 * options at all (nothing to check against), is never stale.
 */
export function isStaleThemePathChoice(theme, state) {
  const pick = state?.themePathChoice
  if (!pick) return false
  const { options } = themeLocationOptions(theme, state)
  if (options.length === 0) return false
  return !options.some(o => (o.value ?? o.label) === pick)
}
