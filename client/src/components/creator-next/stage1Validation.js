import { isOutsideFR, resolveOriginSetting } from './speciesAdapter.js'
import { languageChoiceCount } from '../../data/references.js'
import { isMixedAncestry, validateMixedAncestryClient, versatileThemeConflict } from './mixedAncestry.js'

/**
 * Stage 1 validation — creator-next.
 *
 * Plan rule: Review is the only hard gate EXCEPT the origin gates,
 * which block leaving their stage. So Stage 1's Continue is blocked by
 * exactly one thing: an outside-FR origin without its required
 * explanation. Everything else missing is reported as "still needed
 * before Review" — a checklist, not a block — so a player can move
 * forward, save a draft, and come back through the jump menu.
 *
 * Ancestry-feat fallback (plan): if the species has no feat list at
 * all (fetch returned nothing and no locked feat), a missing feat
 * does NOT block and is NOT listed as needed — blocking on it would
 * make that species unplayable. Species with a list still require
 * the feat before Review.
 */
export function validateStage1(state, { featListAvailable = true, mixedTables = null, speciesEntries = null, speciesEntry = null } = {}) {
  const blocking = []
  const needed = []

  const mixed = isMixedAncestry(state)
  // A mixed character's species choice IS the mixed record — it
  // replaces the single-species pick, so 'Species' is not listed
  // as needed while it is on.
  if (!state.race && !mixed) needed.push('Species')
  // Mixed Ancestry errors block advancing: the record is an explicit
  // choice, and an invalid one would either 400 the draft save or
  // be silently dropped — both worse than saying what is wrong.
  // (An untouched blank record is a draft, not an error — the
  // validator returns [] for it.)
  if (mixed) {
    for (const err of validateMixedAncestryClient(state.mixedAncestry, mixedTables, speciesEntries)) {
      blocking.push(err)
    }
  }
  // Standalone Versatile pick: offered only to registry humans
  // (versatile2024), never to a mixed character — a pick that
  // survived a species change is a stale pick, and the server
  // refuses it, so it blocks here with the reason instead.
  if (state.versatileFeat) {
    if (mixed) {
      blocking.push('versatileFeat: the standalone Versatile pick is only for registry-human characters — a mixed-ancestry character takes Versatile as a trait pick inside the Mixed Ancestry record instead.')
    } else if (speciesEntry && speciesEntry.versatile2024 !== true) {
      blocking.push(`versatileFeat: the Versatile pick is only available to human characters (2024 Versatile) — ${speciesEntry.name || state.race} does not have it.`)
    }
    // The pick must differ from the theme's fixed origin feat — but
    // the theme is only known once Stage 3 is picked. While it is
    // known, the equal pick blocks here (and the picker grays it
    // out); while it is not known yet, nothing blocks — Stage 3
    // warns and the shell blocks the advance there instead.
    const conflict = versatileThemeConflict(state.versatileFeat, state.originFeat)
    if (conflict) blocking.push(conflict)
  }
  // Human size choice: only a size the picked species actually
  // offers is valid (today: Medium or Small for human). A stale
  // size left by a species change blocks rather than 400ing.
  if (state.size && !mixed && Array.isArray(speciesEntry?.sizes) && speciesEntry.sizes.length) {
    if (!speciesEntry.sizes.some(s => String(s).toLowerCase() === String(state.size).toLowerCase())) {
      blocking.push(`size: '${state.size}' is not a size for ${speciesEntry.name || state.race} (${speciesEntry.sizes.join(' or ')})`)
    }
  }
  const originSetting = resolveOriginSetting(state.origin_setting, state.origin_setting_custom)
  if (!originSetting) {
    needed.push('Origin setting')
  } else if (isOutsideFR(originSetting) && !(state.origin_explanation || '').trim()) {
    blocking.push('Origin explanation is required when your origin is outside the Forgotten Realms — say how you came to be in the Realms.')
  }
  if (!state.origin_region?.trim()) needed.push('Origin region')
  if (!state.first_name?.trim()) needed.push('First name')
  if (!state.gender) needed.push('Gender')
  if (featListAvailable && !state.ancestry_feat_id) needed.push('Ancestry feat')

  // R2-15 count rule (creation-solidification item 3, Zach 2026-11-10):
  // a species promising "one extra language of your choice" (Human,
  // Half-Elf, ...) must have that pick made. Listed as NEEDED, not
  // blocking — Stage 1 still advances; Review refuses to commit until
  // the pick is made (validateReview reuses this list). Mixed ancestry
  // offers no species language slots, so it is never counted here.
  if (!mixed && speciesEntry) {
    const slots = languageChoiceCount(speciesEntry.languages || [])
    const picked = (Array.isArray(state.languageChoices) ? state.languageChoices : [])
      .filter(v => v != null && String(v).trim() !== '').length
    if (slots > picked) needed.push(slots - picked === 1 ? 'Extra language' : `Extra languages (${slots - picked} more)`)
  }

  return { blocking, needed, canAdvance: blocking.length === 0 }
}
