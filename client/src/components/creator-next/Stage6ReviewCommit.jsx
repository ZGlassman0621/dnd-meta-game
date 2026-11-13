import { useEffect, useMemo, useRef, useState } from 'react'
import Tip from './Tooltip.jsx'
import classesData from '../../data/classes.json'
import { buildStage1ProgressBody, isMagicInitiateOriginFeat, saveStage1Progress, saveStage1LocalDraft } from './stage1Persistence.js'
import { cantripsKnownFor, knownCountFor, preparedCountFor, spellcastingAbilityForClass } from './spellCatalogFallback.js'
import { validateStage1 } from './stage1Validation.js'
import { isOutsideFR, resolveOriginSetting } from './speciesAdapter.js'
import { isMixedAncestry, mixedAncestrySaveRecord } from './mixedAncestry.js'
import { SPELLBOOK_START_SIZE } from '../spellbookHelpers.js'
import {
  ABILITIES, LEVEL_1_CAP, abilityModifier, finalForAbility,
  resolveSpeciesASI, resolveThemeASI, scoresComplete
} from './Stage4AbilitiesSkillsSpells.jsx'
import { computedGold, deriveLevel1Stats, goldOptionBaseline, normalizePackageData } from './Stage5GearStory.jsx'

/**
 * Creator-next Stage 6 — Review & Commit (2026-11-07).
 *
 * Plan Page 12: the last look, with nowhere to hide a mistake. Sections
 * with an Edit jump per section; validation grouped by stage with a jump
 * button each, in plain words; one server-validated commit that flips
 * creation_phase to 'active'. Submit does NOT start play — on success
 * the shell's onCommitted fires and HomeFlow reloads the roster and
 * routes home (coordinator decision 2026-11-07: App's
 * handleCharacterCreated auto-select + campaign-setup landing is NOT
 * called on this path).
 *
 * What this page does NOT do:
 * - Heirloom: deferred, no picker, no design (Stage 5 header). No
 *   heirloom section renders here; nothing is invented for it.
 * - Distinguishing features: the column EXISTS (migration 060)
 *   and the commit accepts + persists it when sent, never requires
 *   it — the client simply does not collect it in Review yet, so it
 *   is not shown and not asked for. A field can be added later with
 *   no server work.
 * - Local-only fields (fightingStyle, subclassChoices, cantrips):
 *   collected in the creator since the 2026-11-07 follow-up and sent
 *   on every draft save + the commit (fighting_style 058,
 *   subclass_choices_json 103, known_cantrips 001 — see
 *   buildStage1ProgressBody). Fighting style and subclass choices are
 *   SHOWN here from the draft. Granted cantrips are derived at render
 *   (same rule as Stage 2), never stored. Class cantrips known ARE
 *   picked on Stage 2 now — the class count is shown beside the
 *   picks, and the picks ride the commit body as the full final list
 *   (class picks + granted + species choices).
 * - Spell-count / skill-pick-count validation is the SERVER's at
 *   commit: the client checks what it can honestly check (scores
 *   placed, languages present, required picks made) and a server 400
 *   surfaces here as a field-named error with a stage jump. The
 *   client never blocks on a count it cannot derive.
 *
 * Commit contract: body = buildStage1ProgressBody(state, themes) + creator
 * marker + class/subclass + creation_phase 'active'; success returns
 * the committed row. If the character has no row yet (fresh create
 * that never advanced), the draft is saved first via the existing
 * path, then committed. The commit route exists live (POST
 * /api/character/:id/commit, landed 2026-11-07) — a 404 now means
 * the character id itself is unknown, and there is no PUT fallback:
 * a 400 shows the field-named error and stays on Review.
 *
 * Edit mode (mode === 'edit'): the Page 1 preservation rule is shown
 * in one line before commit — definition only, earned progression
 * (level, XP, inventory, gold) preserved except the CON-driven HP
 * recalculation. The commit body in edit mode strips the gear picks
 * (gear_choice / package_id / package_picks) so the server never
 * re-derives starting inventory/gold over earned gear; the commit
 * always targets the existing id and never POSTs a second row.
 *
 * Tooltips on every section via <Tip> (global rule). Dedup rule
 * (Zach, 2026-11-05, LOCKED): shown where it applies — a proficiency
 * granted twice becomes a replacement pick of the same type, never a
 * stack, never a boost; the readout lists the final deduped lists.
 */

const ABILITY_FULL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
const STAGE_NAMES = ['Origin & Identity', 'Class & Calling', 'Past & Path', 'Abilities, Skills, & Spells', 'Gear & Story']

function prettify(id) {
  if (!id) return ''
  return String(id).split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function classList() {
  const src = classesData
  const list = Array.isArray(src)
    ? [...src]
    : Object.entries(src).map(([id, c]) => ({ id, ...c }))
  return list
}

export function classRecordFor(classId) {
  if (!classId) return null
  return classList().find(c => c.id === classId) || null
}

/**
 * Class level for the fighting-style check: the entry for this class
 * in class_levels when present (a paladin 1 / rogue 1 has paladin
 * level 1 even though the row total is 2), else the row total, else 1.
 * Twin of classLevelFor in Stage2ClassCalling.jsx — same shape +
 * fallback as the server's paladin PUT block and
 * wizardLevelFromClassLevels, so Review agrees with the server §13
 * gate. Kept inline here (not imported from Stage 2) so this file's
 * esbuild bundle stays self-contained for the pure-helper tests.
 */
export function classLevelFor(classId, characterLevel = 1, classLevels = null) {
  const list = typeof classLevels === 'string'
    ? (() => { try { return JSON.parse(classLevels || '[]') } catch { return null } })()
    : classLevels
  if (Array.isArray(list)) {
    const entry = list.find(e => String(e?.class ?? e?.classId ?? '').toLowerCase() === String(classId || '').toLowerCase())
    const n = Number(entry?.level)
    if (Number.isFinite(n) && n >= 1) return n
  }
  const total = Number(characterLevel)
  return Number.isFinite(total) && total >= 1 ? total : 1
}

function themeOf(themes, themeId) {
  const list = Array.isArray(themes) ? themes : (Array.isArray(themes?.themes) ? themes.themes : null)
  if (!list || !themeId) return null
  return list.find(t => t.id === themeId) || null
}

function l1AbilityOf(theme) {
  const list = Array.isArray(theme?.abilities) ? theme.abilities : []
  return list.find(a => a?.tier === 1) || list[0] || null
}

function featKeyOf(theme) {
  const raw = theme?.origin_feat ?? theme?.origin_feat_key ?? theme?.feat ?? ''
  return String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function featNameOf(theme) {
  return theme?.origin_feat_name || theme?.feat_name || prettify(featKeyOf(theme)) || ''
}

/** "Origin: <setting> — <region> — <explanation>", dropping empty parts. */
export function formatOriginLine(state) {
  const setting = resolveOriginSetting(state.origin_setting, state.origin_setting_custom)
  const parts = [setting, (state.origin_region || '').trim(), (state.origin_explanation || '').trim()].filter(Boolean)
  return parts.length ? `Origin: ${parts.join(' — ')}` : 'Origin: not picked yet'
}

function mixedLabel(state) {
  const rec = mixedAncestrySaveRecord(state.mixedAncestry)
  if (!rec) return ''
  return `Mixed Ancestry (${(rec.parents || []).map(prettify).join(' / ')})`
}

/**
 * Score breakdown, derived the same way Stage 4 computes it — do NOT
 * invent a second scores formula. base + species fixed + choice pick
 * + theme = final, per ability; finals above the level-1 cap (18)
 * clamp at submit and the clamped abilities are named. Mixed
 * ancestry: species ASI is 0 (the Stage 4 arithmetic is skipped for
 * mixed server-side; the theme ASI still applies on top of the 0).
 * Returns { rows, complete, clamped } — rows carry base/species/
 * choice/theme/final/mod, final null while the base is unplaced.
 */
export function deriveScoreBreakdown(state, speciesEntry, theme) {
  const mixed = isMixedAncestry(state)
  const speciesASI = mixed ? { fixed: {}, choice: 0 } : resolveSpeciesASI(speciesEntry, state.subrace)
  const themeASI = resolveThemeASI(theme)
  const method = state.generation_method || 'point_buy'
  const baseScores = state.base_scores || {}
  const choiceCount = speciesASI.choice || 0
  const rawPicks = state.ability_choice_picks || {}
  const choicePicks = {}
  if (choiceCount) {
    for (const ab of ABILITIES) {
      if (rawPicks[ab] && Object.keys(choicePicks).length < choiceCount) choicePicks[ab] = 1
    }
  }
  const rows = ABILITIES.map(ab => {
    const base = method === 'point_buy' ? (baseScores[ab] ?? 8) : baseScores[ab]
    const placed = baseScores[ab] != null
    const raw = finalForAbility(ab, base, speciesASI.fixed, choicePicks, themeASI)
    const final = raw == null ? null : Math.min(raw, LEVEL_1_CAP)
    return {
      ab,
      name: ABILITY_FULL[ab],
      base: placed ? baseScores[ab] : null,
      species: speciesASI.fixed[ab] || 0,
      choice: choicePicks[ab] || 0,
      theme: themeASI[ab] || 0,
      final,
      mod: abilityModifier(final),
      clamped: raw != null && raw > LEVEL_1_CAP,
      placed
    }
  })
  return {
    rows,
    complete: scoresComplete(baseScores),
    clamped: rows.filter(r => r.clamped).map(r => r.name)
  }
}

/** One trait entry, string or object shape — never crash on either. */
export function renderTrait(t) {
  if (t == null) return null
  if (typeof t === 'string') return { name: t, note: '' }
  if (typeof t === 'object') {
    return {
      name: t.name || t.trait || '',
      note: t.description || t.mechanics || t.text || ''
    }
  }
  return { name: String(t), note: '' }
}

/**
 * Granted spells + cantrips, derived at render the same way Stages 2
 * and 4 derive them (species innate, dragonmark, subclass grants,
 * feat cantrips, Magic Initiate). Returns { cantrips: [{spell, source}],
 * spells: [{name, level, source}] }. Pending pick-one grants render as
 * text items with source 'pending' — a choice the player has not made
 * yet, never a filled-in spell.
 */
export function grantedSpells(state, { speciesEntry = null, subclassesByClass = null, featCantrips = [] } = {}) {
  const selectedVariant = speciesEntry?.variants?.find(v => v.name === state.subrace) || null
  const innate = selectedVariant?.innateSpells?.length
    ? selectedVariant.innateSpells
    : (speciesEntry?.innateSpells || [])
  const cantrips = []
  const spells = []
  const seenC = new Set()
  const seenS = new Set()
  const pushC = (spell, source) => {
    const key = String(spell || '').toLowerCase().trim()
    if (!key || seenC.has(key)) return
    seenC.add(key)
    cantrips.push({ spell, source })
  }
  const pushS = (name, level, source) => {
    const key = String(name || '').toLowerCase().trim()
    if (!key || seenS.has(key)) return
    seenS.add(key)
    spells.push({ name, level, source })
  }
  for (const s of innate) {
    if (!s) continue
    if (s.choose) {
      pushC(`Choose ${s.choose} cantrip${s.choose === 1 ? '' : 's'}${s.class ? ` from the ${s.class} list` : ''} — not picked yet`, 'pending')
      continue
    }
    if (s.name && s.level === 0) pushC(s.name, 'species')
    else if (s.name && s.level >= 1) pushS(s.name, s.level, 'species')
  }
  const marks = selectedVariant?.markSpells?.length
    ? selectedVariant.markSpells
    : (speciesEntry?.markSpells || [])
  for (const s of marks) {
    if (typeof s === 'string') pushS(s, 1, 'dragonmark')
    else if (s?.name) pushS(s.name, s.level ?? 1, 'dragonmark')
  }
  const subs = subclassesByClass && state.classId ? (subclassesByClass[state.classId] || []) : []
  const subEntry = subs.find(s => s.name === state.subclassName) || null
  for (const c of (Array.isArray(subEntry?.grantedCantrips) ? subEntry.grantedCantrips : [])) pushC(c, 'subclass')
  const choiceCantrips = Object.entries(state.subclassChoices || {})
    .filter(([k]) => k.toLowerCase().includes('cantrip'))
    .flatMap(([, v]) => (Array.isArray(v) ? v : [v]).filter(Boolean))
  for (const c of choiceCantrips) pushC(c, 'subclass choice')
  for (const f of (Array.isArray(featCantrips) ? featCantrips : [])) {
    pushC(typeof f === 'string' ? f : f?.name, 'feat')
  }
  if (isMagicInitiateOriginFeat(state.originFeat)) {
    const miSpell = (state.originFeatChoices || {}).spell
    if (typeof miSpell === 'string' && miSpell.trim()) pushS(miSpell.trim(), 1, 'origin feat (Magic Initiate)')
    for (const c of (Array.isArray((state.originFeatChoices || {}).cantrips) ? state.originFeatChoices.cantrips : [])) {
      if (typeof c === 'string' && c.trim()) pushC(c.trim(), 'origin feat (Magic Initiate)')
    }
  }
  // Versatile Magic Initiate (human Versatile slot): the server
  // supplies its cantrips from versatile_feat_choices alongside the
  // origin slot's, so the client must grant them here too — otherwise
  // a Versatile-MI caster's final cantrip list could never include
  // them and the commit would refuse. Same shape as the origin slot.
  if (isMagicInitiateOriginFeat(state.versatileFeat)) {
    const miSpell = (state.versatileFeatChoices || {}).spell
    if (typeof miSpell === 'string' && miSpell.trim()) pushS(miSpell.trim(), 1, 'versatile feat (Magic Initiate)')
    for (const c of (Array.isArray((state.versatileFeatChoices || {}).cantrips) ? state.versatileFeatChoices.cantrips : [])) {
      if (typeof c === 'string' && c.trim()) pushC(c.trim(), 'versatile feat (Magic Initiate)')
    }
  }
  return { cantrips, spells }
}

/**
 * Cantrip completeness, mirroring the server's stage6CheckCantrips
 * presence rule (server/routes/character.js §16). The stored list
 * (state.knownCantrips) is the FINAL list — class picks + granted +
 * species-choice picks — so the expected length is the sum of the
 * three sources. Returns { classCount, grantedCount, pendingTotal,
 * expected, actual, required, skipCount, complete }.
 * - classCount: the L1 class pick count — the generated catalog's
 *   cantripsKnownFor (server-derived) with classes.json as fallback.
 * - grantedCount: real granted cantrips; the 'Choose N…' pending
 *   text items (source 'pending') are excluded — they are the
 *   pendingTotal, not grants.
 * - pendingTotal: species pending choices (innate `choose` entries).
 * - skipCount: the server skips the exact count for mixed ancestry
 *   and for any subclass with a pending cantrip choice phrase. The
 *   client cannot parse the free-form phrase, so it skips on the two
 *   shapes it CAN see: every magus (all six societies carry the
 *   same 'chosen from the society list' phrase) and an unpicked
 *   cantrip-named subclass choice. With skipCount only presence is
 *   enforced — the picker still caps at exactly N, so the visible
 *   behavior is identical: pick the N the picker offers.
 * - required: any source applies (class count, a grant, or a pending
 *   choice) — the presence rule fires on any of the three.
 */
export function cantripCompleteness(state, ctx = {}) {
  const { speciesEntry = null, subclassesByClass = null } = ctx
  const cls = classRecordFor(state.classId)
  const classCount = cantripsKnownFor(state.classId)
    ?? cls?.spellcasting?.cantripsKnown?.[0] ?? 0
  const grantedAll = grantedSpells(state, { speciesEntry, subclassesByClass, featCantrips: [] })
  const grantedReal = grantedAll.cantrips.filter(c => c.source !== 'pending')
  const selectedVariant = speciesEntry?.variants?.find(v => v.name === state.subrace) || null
  const innate = selectedVariant?.innateSpells?.length
    ? selectedVariant.innateSpells
    : (speciesEntry?.innateSpells || [])
  const pendingTotal = innate.filter(s => s && s.choose).reduce((n, s) => n + (Number(s.choose) || 0), 0)
  const subs = subclassesByClass && state.classId ? (subclassesByClass[state.classId] || []) : []
  const subEntry = subs.find(s => s.name === state.subclassName) || null
  const unpickedCantripChoice = (subEntry?.choices || []).some(ch =>
    String(ch.key || '').toLowerCase().includes('cantrip')
    && (state.subclassChoices?.[ch.key] == null
      || state.subclassChoices[ch.key] === ''
      || (Array.isArray(state.subclassChoices[ch.key]) && state.subclassChoices[ch.key].length === 0)))
  const skipCount = isMixedAncestry(state) || state.classId === 'magus' || unpickedCantripChoice
  const expected = classCount + grantedReal.length + pendingTotal
  const actual = Array.isArray(state.knownCantrips) ? state.knownCantrips.length : 0
  const required = classCount > 0 || grantedReal.length > 0 || pendingTotal > 0
  const complete = !required || (actual > 0 && (skipCount || actual === expected))
  return { classCount, grantedCount: grantedReal.length, pendingTotal, expected, actual, required, skipCount, complete }
}

/**
 * Review validation, grouped by stage. Client-side only where the
 * client can honestly judge it; spell counts and skill-pick counts
 * are the server's at commit (a 400 surfaces as a field-named error
 * with a stage jump — see stageForServerError). Errors are plain
 * words, each carrying the stage index its jump button targets.
 */
export function validateReview(state, ctx = {}) {
  const { speciesEntry = null, speciesEntries = null, mixedTables = null, themes = null, subclassesByClass = null, characterLevel = 1, classLevels = null } = ctx
  const errors = []
  const push = (stageIndex, field, message) => errors.push({ stage: STAGE_NAMES[stageIndex], stageIndex, field, message })

  // Stage 1 — reuse the Stage 1 validator (origin gates + needed list).
  const v1 = validateStage1(state, { featListAvailable: true, mixedTables, speciesEntries, speciesEntry })
  for (const b of v1.blocking) {
    const field = String(b).split(':')[0] || 'Stage 1'
    push(0, field, `Stage 1 — ${b}`)
  }
  for (const n of v1.needed) {
    push(0, n, `Stage 1 — ${n} is still needed. Fill it in on Stage 1 before committing.`)
  }

  // Stage 2 — class, subclass at level 1, fighting style where offered.
  const cls = classRecordFor(state.classId)
  if (!state.classId) {
    push(1, 'class', 'Stage 2 — Class is still needed. Pick a class on Stage 2 before committing.')
  } else {
    const subclassLevel = cls?.subclassLevel ?? null
    if (subclassLevel === 1 && !state.subclassName) {
      push(1, 'subclass', `Stage 2 — Subclass is still needed. ${cls?.name || prettify(state.classId)} picks its subclass at level 1.`)
    }
    // Fighting style (2026-11-08, edit-mode L2 picker — mirrors the
    // server §13 rule): fighter at L1, paladin/ranger at class level
    // 2+. The level comes from the shell's row fetch via ctx (1 by
    // construction in create mode); a multiclass character is gated
    // on its paladin/ranger class level, not the row total.
    const styleLevel = state.classId === 'fighter' ? 1
      : (state.classId === 'paladin' || state.classId === 'ranger') ? 2 : null
    const offersFightingStyle = styleLevel != null
      && classLevelFor(state.classId, characterLevel, classLevels) >= styleLevel
    if (offersFightingStyle && !state.fightingStyle) {
      push(1, 'fightingStyle', `Stage 2 — Fighting style is still needed. ${cls?.name || prettify(state.classId)} picks a fighting style at level ${styleLevel} — pick one on Stage 2 before committing.`)
    }
    // Cantrips: the final list (class picks + granted + species
    // choices) must be complete — the server refuses a commit without
    // it, so Review blocks first and jumps to Stage 2, where the
    // picker lives. Paladin/ranger have no cantrips at level 1 and
    // need no picker; a fighter with no cantrip source needs none.
    const cantrips = cantripCompleteness(state, { speciesEntry, subclassesByClass })
    if (cantrips.required && !cantrips.complete) {
      const what = cantrips.actual === 0
        ? `pick ${cantrips.expected} cantrip${cantrips.expected === 1 ? '' : 's'}`
        : `${cantrips.actual} of ${cantrips.expected} cantrips are in the list`
      push(1, 'knownCantrips', `Stage 2 — Cantrips are still needed (${what}: ${cantrips.classCount} class + ${cantrips.grantedCount} granted + ${cantrips.pendingTotal} species choice${cantrips.pendingTotal === 1 ? '' : 's'}). Pick them on Stage 2 before committing.`)
    }
  }

  // Stage 3 — theme, origin feat (unless forgone), path choice.
  const theme = themeOf(themes, state.themeId)
  if (!state.themeId) {
    push(2, 'theme', 'Stage 3 — Theme is still needed. Pick a theme on Stage 3 before committing.')
  } else {
    const forgo = mixedAncestrySaveRecord(state.mixedAncestry)?.forgoOriginFeat === true
    if (!forgo && !state.originFeat) {
      push(2, 'originFeat', 'Stage 3 — Origin feat is still needed. The theme fixes it — pick a theme with its feat on Stage 3.')
    }
    if (Array.isArray(theme?.creation_choice_options) && theme.creation_choice_options.length && !state.themePathChoice) {
      push(2, 'themePathChoice', `Stage 3 — ${theme.creation_choice_label || 'Path choice'} is still needed. Pick one on Stage 3 before committing.`)
    }
  }

  // Stage 4 — scores placed, languages present. Spell counts and
  // skill-pick counts are server-validated at commit — except the
  // PRESENCE of the spell lists: the server's commit-only §11 check
  // refuses a prepared/known caster with an empty list (Stage 4
  // alone tolerates it), so Review blocks first and jumps to Stage 4,
  // where the picker lives. That is the paladin/ranger case: both
  // prepare 2 spells at level 1 and must carry the list at commit.
  const breakdown = deriveScoreBreakdown(state, speciesEntry, theme)
  if (!breakdown.complete) {
    const missing = breakdown.rows.filter(r => !r.placed).map(r => r.name)
    push(3, 'base_scores', `Stage 4 — Ability scores are not all placed yet (${missing.join(', ')} missing). Place them on Stage 4 before committing.`)
  }
  if ((state.race || isMixedAncestry(state)) && !(Array.isArray(state.languages) && state.languages.length)) {
    push(3, 'languages', 'Stage 4 — Languages are still needed. Your species languages land on Stage 4 — visit it and let them consolidate.')
  }
  {
    // §11, mirrored: a known caster with no known list, or (when it
    // knows nothing) a prepared caster with no prepared list, refuses
    // at commit. Counts come from the generated catalog (the same
    // source Stage 4's picker uses); the mod-0 floor is enough here
    // because every L1 prepared count is positive at any modifier.
    const abilityKey = spellcastingAbilityForClass(state.classId)
    const abilityFinal = abilityKey
      ? breakdown.rows.find(r => r.ab === abilityKey)?.final ?? null
      : null
    const castingMod = abilityFinal != null ? abilityModifier(abilityFinal) : 0
    const knownCount = knownCountFor(state.classId)
    const prepCount = preparedCountFor(state.classId, castingMod)
    if (knownCount != null && knownCount > 0 && !(Array.isArray(state.known_spells) && state.known_spells.length)) {
      push(3, 'known_spells', `Stage 4 — Spells known are still needed. ${cls?.name || prettify(state.classId)} knows ${knownCount} spell${knownCount === 1 ? '' : 's'} at level 1 — pick them on Stage 4 before committing.`)
    } else if ((knownCount == null || knownCount === 0) && prepCount != null && prepCount > 0
      && !(Array.isArray(state.prepared_spells) && state.prepared_spells.length)) {
      push(3, 'prepared_spells', `Stage 4 — Spells prepared are still needed. ${cls?.name || prettify(state.classId)} prepares ${prepCount} spell${prepCount === 1 ? '' : 's'} at level 1 — pick them on Stage 4 before committing.`)
    }
    // Wizard spellbook (2026-11-07), mirroring the server's commit
    // §11 + membership rules so Review blocks first with a Stage 4
    // jump instead of the commit 400: a wizard whose prepared list
    // is non-empty but whose book is empty is refused at commit (the
    // book is never auto-filled), and a prepared spell outside the
    // book is refused the same way.
    if (state.classId === 'wizard') {
      const book = Array.isArray(state.known_spells) ? state.known_spells : []
      const prep = Array.isArray(state.prepared_spells) ? state.prepared_spells : []
      if (prep.length > 0 && book.length === 0) {
        push(3, 'known_spells', `Stage 4 — Spellbook is still needed. A wizard's prepared spells must come from the spellbook — pick ${SPELLBOOK_START_SIZE} spells for the book on Stage 4 before committing. The book is never auto-filled.`)
      } else if (book.length > 0 && prep.length > 0) {
        const bookSet = new Set(book.map(s => String(s).toLowerCase()))
        const outside = prep.filter(p => !bookSet.has(String(p).toLowerCase()))
        if (outside.length) {
          push(3, 'prepared_spells', `Stage 4 — ${outside.map(prettify).join(', ')} ${outside.length === 1 ? 'is' : 'are'} prepared but not in the spellbook. Prepared spells must come from the book — fix it on Stage 4 before committing.`)
        }
      }
    }
  }

  // Stage 5 — gear fork, required story anchors.
  if (!state.gear_choice) {
    push(4, 'gear_choice', 'Stage 5 — Starting gear is still needed. Take the equipment packages or the gold instead, on Stage 5.')
  } else if (state.gear_choice === 'packages' && !state.package_id) {
    push(4, 'package_id', 'Stage 5 — Equipment package is still needed. Pick package A, B, or C on Stage 5.')
  }
  if (!state.alignment) push(4, 'alignment', 'Stage 5 — Alignment is still needed. Pick one on Stage 5 before committing.')
  if (!state.faith) push(4, 'faith', 'Stage 5 — Faith is still needed. Pick a deity — or None — on Stage 5 before committing.')
  if (!state.lifestyle) push(4, 'lifestyle', 'Stage 5 — Lifestyle is still needed. Pick one on Stage 5 before committing.')
  for (const [field, label] of [['age', 'Age'], ['height', 'Height'], ['weight', 'Weight'], ['eye_color', 'Eye color'], ['hair_color', 'Hair color'], ['skin_color', 'Skin color'], ['physical_build', 'Build']]) {
    if (!state[field]) push(4, field, `Stage 5 — ${label} is still needed. Physical description is required — fill it in on Stage 5.`)
  }

  return { errors, canCommit: errors.length === 0 }
}

/** Map a server refusal to the stage its jump button should target. */
export function stageForServerError(message) {
  const m = String(message || '').toLowerCase()
  // Creation-solidification (2026-11-12): the species extra-language
  // pick lives on Stage 1 (its message says "language").
  if (/extra language/.test(m)) return 0
  if (/species|origin|ancestry|mixed|versatile|size/.test(m)) return 0
  if (/class|subclass|fighting|cantrip/.test(m)) return 1
  if (/theme|origin feat|path choice/.test(m)) return 2
  if (/score|ability|skill|tool|language|spell|prepared|known/.test(m)) return 3
  if (/gear|package|gold|alignment|faith|lifestyle|age|height|weight|eye|hair|skin|build|story/.test(m)) return 4
  return null
}

/**
 * The commit body: the draft save body + creator marker + class /
 * subclass + creation_phase 'active'. In edit mode the gear picks are
 * stripped so the server never re-derives starting inventory/gold
 * over earned gear (plan Page 10 edit mode: equipment/gold/inventory
 * are preserved exactly).
 */
export function buildCommitBody(state, { mode = 'manual', themes = null } = {}) {
  const body = buildStage1ProgressBody(state, themes)
  body.creator = 'creator-next'
  if (state.classId) body.class = state.classId
  if (state.subclassName) body.subclass = state.subclassName
  if (mode === 'edit') {
    delete body.gear_choice
    delete body.package_id
    delete body.package_picks
  }
  body.creation_phase = 'active'
  return body
}

/**
 * One server-validated commit. Ensures the row exists first (fresh
 * create that never advanced saves the draft, then commits), POSTs
 * /api/character/:id/commit, and throws Error(server's field-named
 * message) on a refusal — the caller shows it and stays on Review.
 * Returns the committed row on success. There is no PUT fallback:
 * the commit route exists live, so a 404 means the character id
 * itself is unknown — falling back to PUT would only mask a
 * route-shape mismatch behind an unvalidated flip.
 */
export async function commitCharacter({ state, characterId, mode = 'manual', onCharacterId, themes = null } = {}) {
  let id = characterId || null
  if (!id) {
    const saved = await saveStage1Progress({ state, characterId: null, themes })
    id = saved.character_id
    if (onCharacterId && id) onCharacterId(id)
  }
  const body = buildCommitBody(state, { mode, themes })
  const post = await fetch(`/api/character/${id}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!post.ok) {
    let detail = ''
    try { detail = (await post.json()).error || '' } catch {}
    throw new Error(detail || `Commit failed (HTTP ${post.status})`)
  }
  return post.json()
}

function EditJump({ onJump, stageIndex, label = 'Edit' }) {
  if (!onJump) return null
  return (
    <button type="button" className="btn ghost" onClick={() => onJump(stageIndex)} style={{ fontSize: 13, padding: '4px 10px' }}>
      {label} →
    </button>
  )
}

function Section({ title, tip, onJump, stageIndex, children }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 17 }}>
          {title}
          {tip && <Tip text={tip} />}
        </strong>
        <EditJump onJump={onJump} stageIndex={stageIndex} />
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  )
}

function fmtMod(mod) {
  if (mod == null) return '—'
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export default function Stage6ReviewCommit({
  state, characterId = null, onCharacterId,
  speciesEntry = null, speciesEntries = null, mixedTables = null,
  themes = null, subclassesByClass = null, featCantrips = [],
  characterLevel = 1, classLevels = null,
  mode = 'manual', onCommitted, onJump, commitRef
}) {
  const isEdit = mode === 'edit'
  const theme = themeOf(themes, state.themeId)
  const cls = classRecordFor(state.classId)
  const mixed = isMixedAncestry(state)
  const breakdown = useMemo(
    () => deriveScoreBreakdown(state, speciesEntry, theme),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.base_scores, state.generation_method, state.ability_choice_picks, speciesEntry, state.subrace, theme, mixed]
  )
  const validation = useMemo(
    () => validateReview(state, { speciesEntry, speciesEntries, mixedTables, themes, subclassesByClass, characterLevel, classLevels }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, speciesEntry, speciesEntries, mixedTables, themes, subclassesByClass, characterLevel, classLevels]
  )
  const granted = useMemo(
    () => grantedSpells(state, { speciesEntry, subclassesByClass, featCantrips }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, speciesEntry, subclassesByClass, featCantrips]
  )
  // Class cantrip picks: the final list minus the granted ones (the
  // granted list is shown on its own line above). Keys, like
  // known_spells — prettified at render, same as the Spells known
  // line below.
  const knownCantripPicks = useMemo(() => {
    const grantedKeys = new Set(granted.cantrips.map(c => String(c.spell || '').toLowerCase().trim()))
    return (state.knownCantrips || []).filter(k => !grantedKeys.has(String(k || '').toLowerCase().trim()))
  }, [state.knownCantrips, granted])
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState(null)
  const [commitErrorStage, setCommitErrorStage] = useState(null)
  const [ancestryFeatName, setAncestryFeatName] = useState(null)
  const [packageData, setPackageData] = useState(null)

  // Ancestry feat name: the draft stores only the seeded row id — the
  // name is resolved back through the list endpoint (same lookup the
  // server-row rehydration uses). Best-effort: the id shows when the
  // lookup fails, never a guessed name.
  useEffect(() => {
    const featId = state.ancestry_feat_id
    if (!featId) { setAncestryFeatName(null); return }
    let live = true
    const listIds = mixed
      ? (mixedAncestrySaveRecord(state.mixedAncestry)?.parents || [])
      : [state.race].filter(Boolean)
    Promise.all(listIds.map(listId =>
      fetch(`/api/progression/ancestry-feats/${encodeURIComponent(listId)}?tier=1`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null)
    )).then(results => {
      if (!live) return
      for (const feats of results) {
        const match = (Array.isArray(feats) ? feats : []).find(f => f?.id === featId)
        if (match?.feat_name) { setAncestryFeatName(match.feat_name); return }
      }
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ancestry_feat_id, state.race, mixed])

  // Starting packages for the gold-fork total (same route Stage 5
  // reads). Best-effort: the server is authoritative at submit, so a
  // failed fetch just hides the display total, never a guessed one.
  useEffect(() => {
    if (!state.classId || state.gear_choice !== 'gold') { setPackageData(null); return }
    let live = true
    fetch(`/api/starting-packages/${encodeURIComponent(state.classId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live) setPackageData(normalizePackageData(d)) })
      .catch(() => { if (live) setPackageData(null) })
    return () => { live = false }
  }, [state.classId, state.gear_choice])

  const handleCommit = async () => {
    if (committing) return
    if (!validation.canCommit) return
    setCommitting(true)
    setCommitError(null)
    setCommitErrorStage(null)
    try {
      const row = await commitCharacter({ state, characterId, mode, onCharacterId, themes })
      saveStage1LocalDraft(state, row?.id || characterId)
      if (onCommitted) onCommitted(row)
    } catch (err) {
      const message = err?.message || 'Commit failed.'
      setCommitError(message)
      setCommitErrorStage(stageForServerError(message))
      setCommitting(false)
    }
  }
  const handleCommitRef = useRef(handleCommit)
  handleCommitRef.current = handleCommit
  useEffect(() => {
    if (!commitRef) return undefined
    commitRef.current = () => handleCommitRef.current()
    return () => { commitRef.current = null }
  }, [commitRef])

  const errorsByStage = useMemo(() => {
    const groups = []
    for (const e of validation.errors) {
      const g = groups.find(x => x.stageIndex === e.stageIndex)
      if (g) g.errors.push(e)
      else groups.push({ stageIndex: e.stageIndex, stage: e.stage, errors: [e] })
    }
    return groups.sort((a, b) => a.stageIndex - b.stageIndex)
  }, [validation])

  const speciesLabel = mixed ? mixedLabel(state) : (speciesEntry?.name || prettify(state.race) || '—')
  const variantLabel = !mixed && state.subrace ? ` (${state.subrace})` : ''
  const subclassLevel = cls?.subclassLevel ?? null
  const subclassLine = state.subclassName
    ? state.subclassName
    : (subclassLevel != null ? `picks subclass at level ${subclassLevel}` : 'subclass not picked yet')
  const walkSpeed = state.mixedAncestry?.speed
    ?? speciesEntry?.speeds?.walk
    ?? speciesEntry?.speed
    ?? null
  const otherSpeeds = speciesEntry?.speeds
    ? Object.entries(speciesEntry.speeds).filter(([k, v]) => k !== 'walk' && Number.isFinite(Number(v)))
    : []
  const derived = deriveLevel1Stats({
    hitDie: cls?.hitDie ?? null,
    conScore: breakdown.rows.find(r => r.ab === 'con')?.final ?? null,
    dexScore: breakdown.rows.find(r => r.ab === 'dex')?.final ?? null,
    armorName: null,
    hasShield: false,
    walkSpeed
  })
  const goldBaseline = goldOptionBaseline(packageData?.goldOption ?? null)
  const goldTotal = goldBaseline == null ? null : computedGold(goldBaseline, state.themeId)
  const l1Ability = l1AbilityOf(theme)
  const originFeatName = featNameOf(theme)
  const forgo = mixedAncestrySaveRecord(state.mixedAncestry)?.forgoOriginFeat === true
  const selectedVariant = speciesEntry?.variants?.find(v => v.name === state.subrace) || null
  const traitList = mixed
    ? (state.mixedAncestry?.traits || []).map(t => ({ name: t.trait, note: `${prettify(t.species)} trait — power budget cost ${t.cost ?? '?'}` }))
    : (selectedVariant?.traits?.length ? selectedVariant.traits : (speciesEntry?.traits || [])).map(renderTrait).filter(Boolean)
  const fullName = [state.first_name, state.last_name].filter(Boolean).join(' ') || '(unnamed)'
  const storyFields = [
    ['Alignment', state.alignment], ['Faith', state.faith], ['Lifestyle', state.lifestyle],
    ['Age', state.age], ['Height', state.height], ['Weight', state.weight],
    ['Eyes', state.eye_color], ['Hair', state.hair_color], ['Skin', state.skin_color], ['Build', state.physical_build]
  ].filter(([, v]) => v)
  const storyText = [
    ['Personality', state.personality_traits], ['Ideals', state.ideals], ['Bonds', state.bonds],
    ['Flaws', state.flaws], ['Organizations', state.organizations], ['Allies', state.allies],
    ['Enemies', state.enemies], ['Backstory', state.backstory], ['Notes', state.other_notes]
  ].filter(([, v]) => v)

  return (
    <div>
      <div className="eyebrow">Stage 6 of 6</div>
      <h1 className="h-step">Review &amp; Commit</h1>
      <p className="lede" style={{ marginTop: 12, maxWidth: 640 }}>
        The last look, with nowhere to hide a mistake. Check every section — each one jumps back to the stage that owns it — then commit once.
        {isEdit ? ' Editing changes definition only.' : ' Committing flips this draft to an active character on the roster.'}
      </p>
      {isEdit && (
        <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)', marginTop: 12 }}>
          Editing changes definition only and preserves earned progression (level, XP, inventory, gold) — except the CON-driven hit-point recalculation.
        </div>
      )}

      {errorsByStage.length > 0 && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(231, 76, 60, 0.08)', border: '1px solid #e74c3c', color: '#c0392b', fontFamily: 'var(--serif)' }}>
          <strong>Still needed before commit:</strong>
          {errorsByStage.map(g => (
            <div key={g.stageIndex} style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
                <strong>{g.stage}</strong>
                <EditJump onJump={onJump} stageIndex={g.stageIndex} label={`Go to ${g.stage}`} />
              </div>
              <ul style={{ margin: '6px 0 0', paddingLeft: '1.1em' }}>
                {g.errors.map((e, i) => <li key={i}>{e.message.replace(/^Stage \d+ — /, '')}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
      {errorsByStage.length === 0 && (
        <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)', marginTop: 16 }}>
          Everything checks out — ready to commit.
        </div>
      )}

      <Section
        title="Who is this?"
        tip="The head line: name, species and variant, origin, theme, class and subclass. Species, theme, and class lock at creation; name and origin text stay editable later."
        onJump={onJump} stageIndex={0}
      >
        <div style={{ fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.6 }}>
          <div><strong>{fullName}</strong>{state.nickname ? ` “${state.nickname}”` : ''}{state.gender ? ` · ${state.gender}` : ''}</div>
          <div>{speciesLabel}{variantLabel} · Level 1</div>
          <div>{formatOriginLine(state)}</div>
          <div>Theme: {theme?.name || prettify(state.themeId) || '—'}</div>
          <div>Class: {cls?.name || prettify(state.classId) || '—'} · {subclassLine}</div>
        </div>
      </Section>

      <Section
        title="Ability scores"
        tip="Base + species + choice + theme = final, per ability — the same math Stage 4 shows. A final over 18 clamps at submit and the clamped ability is named here, never silently changed."
        onJump={onJump} stageIndex={3}
      >
        {breakdown.complete ? (
          <>
            <table style={{ borderCollapse: 'collapse', fontFamily: 'var(--serif)', fontSize: 15 }}>
              <thead><tr>{['Ability', 'Base', 'Species', 'Choice', 'Theme', 'Final', 'Mod'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '4px 12px 4px 0', borderBottom: '1px solid var(--rule)' }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {breakdown.rows.map(r => (
                  <tr key={r.ab}>
                    <td style={{ padding: '4px 12px 4px 0' }}>{r.name}</td>
                    <td style={{ padding: '4px 12px 4px 0' }}>{r.base ?? '—'}</td>
                    <td style={{ padding: '4px 12px 4px 0' }}>{r.species ? `+${r.species}` : '—'}</td>
                    <td style={{ padding: '4px 12px 4px 0' }}>{r.choice ? `+${r.choice}` : '—'}</td>
                    <td style={{ padding: '4px 12px 4px 0' }}>{r.theme ? `+${r.theme}` : '—'}</td>
                    <td style={{ padding: '4px 12px 4px 0' }}><strong>{r.final ?? '—'}</strong>{r.clamped ? ' (clamped at 18)' : ''}</td>
                    <td style={{ padding: '4px 12px 4px 0' }}>{fmtMod(r.mod)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {breakdown.clamped.length > 0 && (
              <div className="help" style={{ fontStyle: 'normal', marginTop: 8 }}>
                Clamped at the level-1 cap of 18: {breakdown.clamped.join(', ')}.
              </div>
            )}
            <div className="help" style={{ fontStyle: 'normal', marginTop: 8 }}>
              Method: {state.generation_method || 'point_buy'}. Origin feats grant no ability increase in 2024, so there is no feat line.
            </div>
          </>
        ) : (
          <div className="help" style={{ fontStyle: 'normal' }}>
            Scores are not all placed yet — {breakdown.rows.filter(r => !r.placed).map(r => r.name).join(', ')} missing. Place them on Stage 4.
          </div>
        )}
      </Section>

      <Section
        title="Derived numbers"
        tip="Hit points from your class hit die plus your Constitution modifier (at least 1 HP total), armor class from Dexterity before armor, walk speed from your species. Shown, not picked — the server recomputes them at submit and never trusts these numbers."
        onJump={onJump} stageIndex={3}
      >
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6 }}>
          <div>Hit points: {derived.hp == null ? '—' : `${derived.hp} HP`} {derived.hpNote ? `(${derived.hpNote})` : ''}</div>
          <div>Base armor class: {derived.ac == null ? '—' : `${derived.ac}`} {derived.acNote ? `(${derived.acNote})` : ''}</div>
          <div>Walk speed: {derived.speed == null ? '—' : `${derived.speed} ft`}{otherSpeeds.length ? ` · ${otherSpeeds.map(([k, v]) => `${prettify(k)} ${v} ft`).join(' · ')}` : ''}</div>
          <div className="help" style={{ fontStyle: 'normal', marginTop: 6 }}>
            Armor and shield from the picked package raise armor class at submit — the base above is before armor.
          </div>
        </div>
      </Section>

      <Section
        title="Species traits"
        tip="Every trait your species — or your Mixed Ancestry picks — actually grants, with what it does in play. Traits lock at creation."
        onJump={onJump} stageIndex={0}
      >
        {traitList.length ? (
          <ul style={{ margin: 0, paddingLeft: '1.1em', fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6 }}>
            {traitList.map((t, i) => (
              <li key={i}><strong>{t.name}</strong>{t.note ? ` — ${t.note}` : ''}</li>
            ))}
          </ul>
        ) : (
          <div className="help" style={{ fontStyle: 'normal' }}>No traits listed for this species yet.</div>
        )}
        {mixed && (
          <div className="help" style={{ fontStyle: 'normal', marginTop: 8 }}>
            Mixed Ancestry: traits are picked, not inherited whole — each costs power budget (7, or 11 with the origin-feat trade).
          </div>
        )}
      </Section>

      <Section
        title="Languages &amp; proficiencies"
        tip="One consolidation point: a proficiency granted twice becomes a replacement pick of the same type — never a stack, never a free expertise. An option already held shows grayed out and disabled on the picking stages, never hidden."
        onJump={onJump} stageIndex={3}
      >
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6 }}>
          <div>Languages: {(state.languages || []).length ? state.languages.join(', ') : '—'}</div>
          <div>Skills: {(state.skills || []).length ? state.skills.map(prettify).join(', ') : '—'}</div>
          <div>Tools: {(state.tool_proficiencies || []).length ? state.tool_proficiencies.join(', ') : '—'}</div>
          <div className="help" style={{ fontStyle: 'normal', marginTop: 6 }}>
            Species languages: {(speciesEntry?.languages || []).length ? speciesEntry.languages.join(', ') : 'no languages listed'}. A language already known can never be re-picked as a “new” language.
          </div>
        </div>
      </Section>

      <Section
        title="Spells"
        tip={state.classId === 'wizard'
          ? 'Cantrips, spellbook, prepared, and granted — labeled separately. A wizard\'s known spells ARE its spellbook (the spells it owns — 6 at level 1), and prepared spells are the subset marked ready from it. Granted spells never count against the book or prepared totals. Class cantrips are picked on Stage 2 — the class count is shown beside the picks.'
          : 'Cantrips, known, prepared, and granted — labeled separately. Granted spells never count against known or prepared totals. Class cantrips are picked on Stage 2 — the class count is shown beside the picks.'}
        onJump={onJump} stageIndex={3}
      >
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6 }}>
          <div>
            Cantrips (granted): {granted.cantrips.length
              ? granted.cantrips.map(c => `${c.spell} (${c.source})`).join(', ')
              : 'none granted'}
          </div>
          <div>
            Class cantrips known at level 1: {cls?.spellcasting?.cantripsKnown?.[0] ?? '—'}
            {cls?.spellcasting ? ` — picked on Stage 2: ${knownCantripPicks.length ? knownCantripPicks.map(prettify).join(', ') : 'not picked yet'}` : ''}
          </div>
          {state.classId === 'wizard' ? (
            <>
              <div>Spellbook ({(state.known_spells || []).length} of {SPELLBOOK_START_SIZE} spells): {(state.known_spells || []).length ? state.known_spells.map(prettify).join(', ') : '— not picked yet'}</div>
              <div>Spells prepared ({(state.prepared_spells || []).length} — from the book above): {(state.prepared_spells || []).length ? state.prepared_spells.map(prettify).join(', ') : '—'}</div>
            </>
          ) : (
            <>
              <div>Spells known: {(state.known_spells || []).length ? state.known_spells.map(prettify).join(', ') : '—'}</div>
              <div>Spells prepared: {(state.prepared_spells || []).length ? state.prepared_spells.map(prettify).join(', ') : '—'}</div>
            </>
          )}
          <div>
            Granted spells: {granted.spells.length
              ? granted.spells.map(s => `${s.name} (level ${s.level}, ${s.source})`).join(', ')
              : 'none granted'}
          </div>
        </div>
      </Section>

      <Section
        title="Features"
        tip="Only what the draft actually holds — ancestry feat and its subchoices, the level-1 theme ability, fighting style, and subclass choices. Nothing is invented for a pick that was never made."
        onJump={onJump} stageIndex={1}
      >
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6 }}>
          <div>
            Ancestry feat: {ancestryFeatName || (state.ancestry_feat_id ? `#${state.ancestry_feat_id}` : '—')}
            {state.ancestry_feat_choices && Object.keys(state.ancestry_feat_choices).length
              ? ` — choices: ${Object.entries(state.ancestry_feat_choices).map(([k, v]) => `${prettify(k)}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')}`
              : ''}
          </div>
          <div>
            Level-1 theme ability: {l1Ability ? (<><strong>{l1Ability.name}</strong>{l1Ability.mechanics ? ` — ${l1Ability.mechanics}` : ''}</>) : '—'}
          </div>
          <div>
            Origin feat: {forgo ? 'forgone — the Mixed Ancestry trade gave up the feat for +4 power budget' : (originFeatName || '—')}
            {state.originFeatChoices && Object.keys(state.originFeatChoices).length && !forgo
              ? ` — choices: ${Object.entries(state.originFeatChoices).map(([k, v]) => `${prettify(k)}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')}`
              : ''}
          </div>
          <div>Fighting style: {state.fightingStyle || '—'}</div>
          <div>
            Subclass choices: {state.subclassChoices && Object.keys(state.subclassChoices).length
              ? Object.entries(state.subclassChoices).map(([k, v]) => `${prettify(k)}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')
              : '—'}
          </div>
          {state.versatileFeat && (
            <div>Human Versatile feat: {prettify(state.versatileFeat)}</div>
          )}
        </div>
      </Section>

      <Section
        title="Equipment &amp; gold"
        tip="Starting gear, resolved by the server at submit from the picks — the client sends picks only, never resolved items. In edit mode this section is shown, not re-derived: inventory and gold stay exactly as they are."
        onJump={onJump} stageIndex={4}
      >
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6 }}>
          {state.gear_choice === 'packages' && (
            <>
              <div>Equipment packages — package {state.package_id || '—'}</div>
              <div>
                Package picks: {state.package_picks && Object.keys(state.package_picks).length
                  ? Object.entries(state.package_picks).map(([k, v]) => `${prettify(k)}: ${Array.isArray(v) ? v.join(', ') : JSON.stringify(v)}`).join('; ')
                  : 'defaults'}
              </div>
              <div className="help" style={{ fontStyle: 'normal', marginTop: 6 }}>
                The server resolves these picks into inventory, equipment, and gold at submit.
              </div>
            </>
          )}
          {state.gear_choice === 'gold' && (
            <>
              <div>Gold instead of equipment</div>
              <div>
                Starting gold: {goldTotal == null
                  ? 'worked out by the server at submit (class baseline × theme modifier)'
                  : `${goldTotal} GP (class baseline ${goldBaseline} GP × theme modifier)`}
              </div>
            </>
          )}
          {!state.gear_choice && <div>Starting gear not picked yet — choose packages or gold on Stage 5.</div>}
          {isEdit && (
            <div className="help" style={{ fontStyle: 'normal', marginTop: 6 }}>
              Edit mode: equipment, gold, and inventory are preserved exactly — nothing here is re-derived.
            </div>
          )}
        </div>
      </Section>

      <Section
        title="Story"
        tip="Who this person is. Alignment, faith, lifestyle, and physical description are required and lock the character's anchors; personality, ideals, bonds, flaws, and connections are optional and stay editable later."
        onJump={onJump} stageIndex={4}
      >
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6 }}>
          {storyFields.length
            ? storyFields.map(([k, v]) => <div key={k}>{k}: {v}</div>)
            : <div>Story anchors not filled in yet.</div>}
          {storyText.map(([k, v]) => <div key={k} style={{ marginTop: 6 }}>{k}: {v}</div>)}
        </div>
      </Section>

      {commitError && (
        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: 'rgba(231, 76, 60, 0.08)', border: '1px solid #e74c3c',
          color: '#c0392b', fontFamily: 'var(--serif)', fontSize: 15
        }}>
          Couldn&apos;t commit: {commitError} (Your character is unchanged — fix it and try again.)
          {commitErrorStage != null && onJump && (
            <span>
              {' '}
              <button type="button" className="btn ghost" onClick={() => onJump(commitErrorStage)} style={{ fontSize: 13, padding: '4px 10px' }}>
                Go to {STAGE_NAMES[commitErrorStage]} →
              </button>
            </span>
          )}
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          className="btn primary lg"
          onClick={handleCommit}
          disabled={!validation.canCommit || committing}
        >
          {committing ? 'Committing…' : isEdit ? 'Save edits' : 'Commit character'}
        </button>
        {!validation.canCommit && (
          <span className="help" style={{ fontStyle: 'normal' }}>
            Commit unlocks once everything above is filled in.
          </span>
        )}
        {isEdit && (
          <span className="help" style={{ fontStyle: 'normal' }}>
            This edits character #{characterId ?? '—'} — no second character is created.
          </span>
        )}
      </div>
    </div>
  )
}
