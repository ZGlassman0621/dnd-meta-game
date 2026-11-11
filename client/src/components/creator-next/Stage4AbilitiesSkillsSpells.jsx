import { useEffect, useMemo, useState } from 'react'
import Tip from './Tooltip.jsx'
import classesData from '../../data/classes.json'
import { ABILITY_SCORES, SKILLS, TOOLS, LANGUAGES, concreteLanguages, skillKey } from '../../data/references.js'
import { isHeldOption } from './choiceOptions.js'
import { deferredNoteFor, isDeferredSpecies, resolveSpeciesGrants } from './speciesAdapter.js'
import { isMagicInitiateOriginFeat } from './stage1Persistence.js'
import { bundledSpellData, knownCountFor, loadCachedSpellData, preparedCountFor, preparedCountRuleText, saveCachedSpellData, spellbookSizeFor, spellcastingAbilityForClass } from './spellCatalogFallback.js'

/**
 * Creator-next Stage 4 — Abilities, Skills, & Spells (2026-11-06).
 *
 * Plan Pages 7–9 (Scores, Proficiencies, Spells) in one stage, because
 * skill bonuses derive from ability modifiers and the dedup decisions
 * belong with the scores that produce them.
 *
 * Tooltips on EVERY choice via <Tip> (hover/focus/tap), never
 * title-attribute-only. No silent defaults: every picker starts empty
 * (base_scores {} until the player places a score), and nothing is
 * auto-filled — this stage NEVER picks a class or a theme for the
 * player (same rule as Stages 2–3). Point buy DISPLAYS
 * unplaced scores as 8 (the buy's floor) but STORES nothing until the
 * player changes a score — the display floor
 * is a preview, never a placed score, so an untouched Stage 4 still
 * builds an empty save body.
 *
 * Data sources, and their honest limits:
 * - Class chassis (skillChoices/skillOptions, primaryAbility,
 *   savingThrows, spellcasting ability, toolProficiencies) from
 *   classes.json — the same source Stage 2 reads. skillOptions keys
 *   are normalized with skillKey() before any comparison (scholar
 *   and duelist use spaces, not snake_case).
 * - Species ASI, languages, traits, innate spells, dragonmark spells
 *   from the served species entry prop (server registry shape:
 *   abilityScoreIncrease + per-variant resolvedASI / innateSpells /
 *   markSpells). A variant's resolvedASI is its TOTAL ASI — never
 *   summed with the base. When only the interim adapter shape is
 *   present (variants carry no resolvedASI), the base ASI is used and
 *   the section says so; the live registry is the authority.
 * - Theme ASI (+2/+1) and signature skills from the served theme
 *   prop (same object Stage 3 renders). The ASI resolves from the
 *   stored theme — it is NOT written to any row. Origin feats grant
 *   NO ASI in 2024, so the Scores breakdown is base + species +
 *   choice + theme only, with no feat line.
 * - Spells ONLY from GET /api/spells?class=<id>&level=1&subclass=<name>
 *   (server contract: { classId, level, cantripsKnown, spellsKnown,
 *   spellsPrepared, spellbookSize, spellcastingAbility, spells: [{ key, name, level,
 *   school, classes, description }] }). Level-0 cantrips are excluded
 *   by the endpoint and never offered here — cantrips stay in Stage 2.
 *   A wizard collects TWO lists here (2026-11-07 spellbook system):
 *   a 6-spell spellbook in known_spells and a prepared subset in
 *   prepared_spells — every prepared spell must be in the book, and
 *   the book size comes from the envelope's spellbookSize (6 at L1),
 *   never from spellsKnown (which stays null for a wizard — the
 *   client uses null to mean "prepared caster").
 *   When the endpoint is unreachable the section falls back to the
 *   cached last-good fetch, then to the bundled generated catalog
 *   (spellCatalogFallback.js) — never to the thin client spells.json.
 * - Species skill/tool grants live in trait prose, not structured
 *   fields — they render as informational text, never parsed into
 *   pick data (same limit Stages 1/3 record). Class tool grants in
 *   classes.json are often free text ("One type of artisan's tools
 *   of your choice") — those render as informational text too; only
 *   entries that match a TOOLS key exactly are treated as grants.
 *   When the registry serves the structured `grants` field (items
 *   1 + 20), the grants DO consolidate: species skills join the held
 *   set and gray out like theme/feat grants, species tools join the
 *   final tool list, and the grants render as structured lines
 *   beside the prose. An entry without `grants` behaves exactly as
 *   before — prose only, no crash.
 *
 * State keys (draft state in the shell): generation_method,
 * base_scores {str,dex,con,int,wis,cha}, ability_choice_picks
 * {<ability>: 1}, ability_scores (finals, derived), skills /
 * tool_proficiencies / languages (final deduped lists), known_spells
 * / prepared_spells (spell KEYS from /api/spells). For a wizard the
 * two lists are the TWO spellbook lists: known_spells IS the
 * spellbook (6 L1 wizard spells) and prepared_spells is the prepared
 * subset marked within it — a prepared spell that is not in the book
 * is refused at save, and unchecking a book spell unprepares it too.
 * classSkillPicks [] (the class's own skill picks, snake_case keys)
 * rides the save body as class_skill_picks (the server treats it as
 * the authoritative class-pick list, item 22, 2026-11-06);
 * stage4PicksClass (the class the Stage 4 picks were made for — a
 * class change clears them) stays local-mirror-only, never in the
 * save body.
 *
 * Dedup rule (Zach, 2026-11-05, LOCKED): a proficiency granted twice
 * does not stack — the duplicate becomes a replacement pick of the
 * SAME type (skill for skill, tool for tool, language for language),
 * NEVER a boost (no free expertise). An option already held renders
 * DISABLED, opacity 0.55, with an " — already granted" suffix, never
 * hidden. If the class's available options shrink below the pick
 * count because held skills cover them, the remaining picks may come
 * from the full skill list (the plan's "any skill for a fully open
 * grant" rule).
 *
 * Method-switch rule: switching keeps already-placed values only
 * where legal, else resets that score — to Point Buy: values outside
 * 8–15 reset to 8, blanks become 8; to Standard Array: a value is
 * kept only if it is a distinct member of 15/14/13/12/10/8, anything
 * else (including duplicates) resets to blank; to Manual: every
 * placed value is kept (3–18 covers 8–15), blanks stay blank.
 *
 * Standard-array assignment order (recommendedArrayOrder /
 * assignStandardArray, exported + tested): the
 * Standard Array goes to the class's primary abilities first, then
 * by the class's saving throws, then remaining abilities in
 * Str/Dex/Con/Int/Wis/Cha order; species choice +1s go to primary
 * abilities first, same order.
 *
 * Resets: changing class clears spell picks + class skill picks (the
 * plan Page 9 rule; Stage 2's pickClass resets silently, so no
 * warning is shown before the change is confirmed here either — that
 * warning is a flagged gap, see notes). Changing species/theme
 * recomputes the Scores table and the held sets from the new entry;
 * a class pick that now duplicates a granted skill stops counting
 * toward the class total and is flagged, never silently dropped.
 */

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
export const POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
export const POINT_BUY_POINTS = 27
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
export const LEVEL_1_CAP = 18
const ABILITY_FULL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
const ABILITY_SHORT = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' }

function prettify(id) {
  if (!id) return ''
  return String(id).split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** Point-buy cost of a single base score (8–15). Out-of-range scores cost nothing here — the setter refuses them. */
export function pointBuyCost(score) {
  return POINT_BUY_COSTS[score] ?? 0
}

/** Total point-buy points spent by a base_scores map (missing abilities count as 8, cost 0). */
export function pointsSpent(baseScores) {
  return ABILITIES.reduce((sum, ab) => sum + pointBuyCost((baseScores || {})[ab] ?? 8), 0)
}

export function abilityModifier(finalScore) {
  if (finalScore == null) return null
  return Math.floor((finalScore - 10) / 2)
}

function formatModifier(mod) {
  if (mod == null) return '—'
  return mod >= 0 ? `+${mod}` : `${mod}`
}

/**
 * Resolve the species ASI for the picked species+variant.
 * Returns { fixed: {<ability>: n}, choice: N, fellBackToBase: bool }.
 * A variant's resolvedASI is its TOTAL ASI and wins outright; the
 * entry's abilityScoreIncrease is used only when the variant carries
 * none (interim adapter shape) — and then fellBackToBase is true, so
 * the UI can say the variant ASI is unresolved rather than claim it.
 */
export function resolveSpeciesASI(speciesEntry, subrace) {
  const variant = speciesEntry?.variants?.find(v => v.name === subrace) || null
  const variantASI = variant?.resolvedASI
  if (variantASI && typeof variantASI === 'object' && Object.keys(variantASI).length) {
    return splitASI(variantASI, false)
  }
  return splitASI(speciesEntry?.abilityScoreIncrease || {}, !!variant)
}

function splitASI(asi, fellBackToBase) {
  const fixed = {}
  let choice = 0
  for (const [k, v] of Object.entries(asi || {})) {
    const key = String(k).toLowerCase()
    if (key === 'choice') { choice = Number(v) || 0; continue }
    if (ABILITIES.includes(key) && typeof v === 'number' && v !== 0) fixed[key] = v
  }
  return { fixed, choice, fellBackToBase }
}

/**
 * Resolve the theme ASI (+2/+1) from the served theme object.
 * Tolerates the object form ({ str: 2, con: 1 }, snake_case keys)
 * and the array form Stage 3's formatAsi handles.
 */
export function resolveThemeASI(theme) {
  const raw = theme?.ability_score_increase ?? theme?.ability_score_increases
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out = {}
    for (const [k, v] of Object.entries(raw)) {
      const key = String(k).toLowerCase()
      if (ABILITIES.includes(key) && typeof v === 'number' && v !== 0) out[key] = v
    }
    return out
  }
  if (Array.isArray(raw)) {
    const out = {}
    for (const e of raw) {
      if (!e || typeof e === 'string') continue
      const key = String(e.ability || e.score || e.name || '').toLowerCase()
      const bonus = e.bonus ?? e.value ?? e.amount
      if (ABILITIES.includes(key) && typeof bonus === 'number' && bonus !== 0) out[key] = bonus
    }
    return out
  }
  return {}
}

/** Render a fixed ASI as "+2 Str, +1 Con" style text (Stage 3's formatAsi, object form). */
export function formatAsi(asi) {
  if (!asi || typeof asi !== 'object') return ''
  return Object.entries(asi)
    .filter(([, v]) => typeof v === 'number' && v !== 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `+${v} ${ABILITY_SHORT[k.toLowerCase()] || prettify(k)}`)
    .join(', ')
}

function themeSignatureSkillsOf(theme) {
  if (Array.isArray(theme?.signature_skills) && theme.signature_skills.length) {
    return theme.signature_skills.map(s => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
  }
  if (Array.isArray(theme?.skills) && theme.skills.length) {
    return theme.skills.map(s => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
  }
  return [theme?.signature_skill_1, theme?.signature_skill_2].filter(Boolean)
}

/**
 * Classify feat-picked values (ancestry_feat_choices + originFeatChoices,
 * flattened strings/arrays) into skills (snake_case keys), tools
 * (canonical TOOLS names) and languages (canonical LANGUAGES names).
 * Values matching none of the three are ignored — a feat pick can be
 * a weapon, a spell, or a cantrip, none of which belong in these lists.
 */
export function classifyFeatPickValues(values) {
  const skills = []
  const tools = []
  const languages = []
  const toolByLower = new Map(Object.keys(TOOLS).map(k => [k.toLowerCase(), k]))
  const langByLower = new Map(Object.keys(LANGUAGES).map(k => [k.toLowerCase(), k]))
  const flat = (Array.isArray(values) ? values : [values]).flatMap(v => (Array.isArray(v) ? v : [v]))
  for (const raw of flat) {
    if (raw == null || typeof raw === 'object') continue
    const str = String(raw).trim()
    if (!str) continue
    const key = skillKey(str)
    if (SKILLS[key]) {
      if (!skills.includes(key)) skills.push(key)
      continue
    }
    const tool = toolByLower.get(str.toLowerCase())
    if (tool) {
      if (!tools.includes(tool)) tools.push(tool)
      continue
    }
    const lang = langByLower.get(str.toLowerCase())
    if (lang) {
      if (!languages.includes(lang)) languages.push(lang)
    }
  }
  return { skills, tools, languages }
}

/**
 * Class tool grants that are structured enough to treat as grants:
 * entries of cls.toolProficiencies matching a TOOLS key
 * (case-insensitive). Free-text entries ("…of your choice") are
 * returned separately as informational text, never pick data.
 */
export function splitClassTools(toolProficiencies) {
  const granted = []
  const info = []
  const toolByLower = new Map(Object.keys(TOOLS).map(k => [k.toLowerCase(), k]))
  for (const raw of (toolProficiencies || [])) {
    if (raw == null) continue
    const str = String(raw).trim()
    if (!str) continue
    const match = toolByLower.get(str.toLowerCase())
    if (match) {
      if (!granted.includes(match)) granted.push(match)
    } else {
      info.push(str)
    }
  }
  return { granted, info }
}

/** Priority order for assigning the Standard Array: primary abilities, then saving throws, then Str/Dex/Con/Int/Wis/Cha. */
export function recommendedArrayOrder(cls) {
  const order = []
  const push = (ab) => {
    const key = String(ab || '').toLowerCase()
    if (ABILITIES.includes(key) && !order.includes(key)) order.push(key)
  }
  ;(cls?.primaryAbility || []).forEach(push)
  ;(cls?.savingThrows || []).forEach(push)
  ABILITIES.forEach(push)
  return order
}

/** Standard Array assigned in recommended order: { <ability>: value }. */
export function assignStandardArray(cls) {
  const order = recommendedArrayOrder(cls)
  const assigned = {}
  STANDARD_ARRAY.forEach((v, i) => { assigned[order[i]] = v })
  return assigned
}

/** Final score for one ability: base + species fixed + choice pick + theme. Null when the base is not placed yet. */
export function finalForAbility(ab, base, speciesFixed, choicePicks, themeASI) {
  if (base == null) return null
  return base + (speciesFixed?.[ab] || 0) + (choicePicks?.[ab] || 0) + (themeASI?.[ab] || 0)
}

/**
 * Are all six base scores actually placed? This is the ONLY
 * completeness test the save path uses — it must NOT treat point
 * buy's display floor (8) as a placed score, or a Stage 4 the player
 * never touched would silently store all-8s and break the blank-save
 * guard. base_scores gains all six keys on the first real placement
 * (the point-buy setter fills unplaced scores with 8 when one changes).
 */
export function scoresComplete(baseScores) {
  return ABILITIES.every(ab => (baseScores || {})[ab] != null)
}

function spellKeyOf(spell) {
  return spell?.key || String(spell?.name || '').toLowerCase().trim()
}

export default function Stage4AbilitiesSkillsSpells({ state, set, themes = null, speciesEntry = null }) {
  const classList = useMemo(() => {
    const src = classesData
    const list = Array.isArray(src)
      ? [...src]
      : Object.entries(src).map(([id, c]) => ({ id, ...c }))
    return list.sort((a, b) => (a.name || prettify(a.id)).localeCompare(b.name || prettify(b.id)))
  }, [])
  const classId = state.classId || ''
  const cls = classList.find(c => c.id === classId) || null

  const themeList = useMemo(() => {
    const src = Array.isArray(themes) ? themes : (Array.isArray(themes?.themes) ? themes.themes : null)
    if (!src) return null
    return [...src].sort((a, b) => (a.name || prettify(a.id)).localeCompare(b.name || prettify(b.id)))
  }, [themes])
  const theme = themeList?.find(t => t.id === (state.themeId || '')) || null

  // --- Scores: derived inputs -------------------------------------------
  const speciesASI = useMemo(
    () => resolveSpeciesASI(speciesEntry, state.subrace),
    [speciesEntry, state.subrace]
  )
  const themeASI = useMemo(() => resolveThemeASI(theme), [theme])
  const method = state.generation_method || 'point_buy'
  const baseScores = state.base_scores || {}
  const choiceCount = speciesASI.choice || 0
  // Choice picks are capped to the species' choice count (first N in
  // ability order) and dropped entirely when the species grants none —
  // a species change must not leave stale +1s in the finals.
  const choicePicks = useMemo(() => {
    const raw = state.ability_choice_picks || {}
    const out = {}
    if (!choiceCount) return out
    for (const ab of ABILITIES) {
      if (raw[ab] && Object.keys(out).length < choiceCount) out[ab] = 1
    }
    return out
  }, [state.ability_choice_picks, choiceCount])
  const choiceUsed = Object.keys(choicePicks).length
  const choiceLeft = Math.max(0, choiceCount - choiceUsed)

  // Display base: point buy floors at 8 (the buy starts there); array
  // and manual show blank until placed. The stored base_scores only
  // gains keys when the player places a value — a blank Stage 4 stays
  // blank in the save body.
  const displayBase = (ab) => (method === 'point_buy' ? (baseScores[ab] ?? 8) : (baseScores[ab] ?? ''))
  const placedCount = ABILITIES.filter(ab => baseScores[ab] != null).length
  const finals = useMemo(() => {
    const out = {}
    for (const ab of ABILITIES) {
      const base = method === 'point_buy' ? (baseScores[ab] ?? 8) : baseScores[ab]
      out[ab] = finalForAbility(ab, base, speciesASI.fixed, choicePicks, themeASI)
    }
    return out
  }, [baseScores, method, speciesASI, choicePicks, themeASI])
  const overCap = ABILITIES.filter(ab => finals[ab] != null && finals[ab] > LEVEL_1_CAP)
  const spent = method === 'point_buy' ? pointsSpent(baseScores) : null
  const pointsLeft = spent == null ? null : POINT_BUY_POINTS - spent
  const arrayUsed = method === 'standard_array'
    ? ABILITIES.map(ab => baseScores[ab]).filter(v => v != null)
    : []
  const arrayRemaining = method === 'standard_array'
    ? STANDARD_ARRAY.filter(v => !arrayUsed.includes(v))
    : []

  // --- Held sets: skills / tools / languages / granted spells ----------
  const themeSkills = useMemo(
    () => themeSignatureSkillsOf(theme).map(skillKey).filter(k => SKILLS[k]),
    [theme]
  )
  const featPicks = useMemo(() => {
    const values = []
    const pushChoices = (obj) => {
      for (const v of Object.values(obj || {})) values.push(v)
    }
    pushChoices(state.ancestry_feat_choices)
    pushChoices(state.originFeatChoices)
    return classifyFeatPickValues(values)
  }, [state.ancestry_feat_choices, state.originFeatChoices])
  // Species grants (items 1 + 20): the structured `grants` field on
  // the entry / picked variant, when the registry serves it. Empty
  // lists when the field is absent — the callers below fall back to
  // prose display, exactly as before.
  const speciesGrants = useMemo(
    () => resolveSpeciesGrants(speciesEntry, state.subrace),
    [speciesEntry, state.subrace]
  )
  const heldSkillSet = useMemo(
    () => new Set([...themeSkills, ...featPicks.skills, ...speciesGrants.skills]),
    [themeSkills, featPicks, speciesGrants]
  )
  const speciesLanguages = useMemo(
    () => [...(speciesEntry?.languages || [])],
    [speciesEntry]
  )
  // Stage 1 extra-language picks (R2-15): the player's resolution of
  // a "one extra language of your choice" grant. They join the derived
  // list below; the placeholder itself never does.
  const languageChoices = Array.isArray(state.languageChoices) ? state.languageChoices : []
  const selectedVariant = speciesEntry?.variants?.find(v => v.name === state.subrace) || null
  const speciesTraits = useMemo(() => {
    if (selectedVariant?.traits?.length) return selectedVariant.traits
    return speciesEntry?.traits || []
  }, [selectedVariant, speciesEntry])
  const classTools = useMemo(() => splitClassTools(cls?.toolProficiencies), [cls])
  const grantedSpells = useMemo(() => {
    const out = []
    const seen = new Set()
    const push = (name, level, source) => {
      const key = String(name || '').toLowerCase().trim()
      if (!key || seen.has(key)) return
      seen.add(key)
      out.push({ name, level, source })
    }
    const innate = selectedVariant?.innateSpells?.length
      ? selectedVariant.innateSpells
      : (speciesEntry?.innateSpells || [])
    for (const s of innate) {
      if (s?.name && s.level != null && s.level >= 1) push(s.name, s.level, 'species')
    }
    const marks = selectedVariant?.markSpells?.length
      ? selectedVariant.markSpells
      : (speciesEntry?.markSpells || [])
    for (const s of marks) {
      if (typeof s === 'string') push(s, 1, 'dragonmark')
      else if (s?.name) push(s.name, s.level ?? 1, 'dragonmark')
    }
    const miIsMagicInitiate = isMagicInitiateOriginFeat(state.originFeat)
    const miSpell = miIsMagicInitiate ? (state.originFeatChoices || {}).spell : null
    if (typeof miSpell === 'string' && miSpell.trim()) {
      push(miSpell.trim(), 1, 'origin feat (Magic Initiate)')
    }
    // Magic Initiate cantrips (item 15): the feat's two cantrips are
    // granted alongside its level-1 spell — visible here, never
    // double-counted (the dedupe above drops a cantrip the species
    // already grants). Gated on the origin feat actually being Magic
    // Initiate: a theme change clears the choices on Stage 3, and the
    // server validator governs the stored list — the UI never shows
    // stale cantrips from a previous theme.
    const miCantrips = miIsMagicInitiate ? (state.originFeatChoices || {}).cantrips : null
    for (const c of (Array.isArray(miCantrips) ? miCantrips : [])) {
      if (typeof c === 'string' && c.trim()) push(c.trim(), 0, 'origin feat (Magic Initiate)')
    }
    // Versatile Magic Initiate (2026-11-07 follow-up): the server
    // supplies feat cantrips from the versatile slot alongside the
    // origin slot's, so the granted list must include them too —
    // otherwise the player could re-pick one as a prepared spell and
    // the commit would refuse it as already granted.
    if (isMagicInitiateOriginFeat(state.versatileFeat)) {
      const vSpell = (state.versatileFeatChoices || {}).spell
      if (typeof vSpell === 'string' && vSpell.trim()) push(vSpell.trim(), 1, 'versatile feat (Magic Initiate)')
      for (const c of (Array.isArray((state.versatileFeatChoices || {}).cantrips) ? state.versatileFeatChoices.cantrips : [])) {
        if (typeof c === 'string' && c.trim()) push(c.trim(), 0, 'versatile feat (Magic Initiate)')
      }
    }
    return out
  }, [selectedVariant, speciesEntry, state.originFeat, state.originFeatChoices, state.versatileFeat, state.versatileFeatChoices])
  const grantedSpellNames = useMemo(
    () => new Set(grantedSpells.map(g => g.name.toLowerCase())),
    [grantedSpells]
  )

  // --- Class skill picks -------------------------------------------------
  const skillChoices = cls?.skillChoices ?? 0
  const classSkillOptions = useMemo(() => {
    const opts = (cls?.skillOptions || []).map(skillKey).filter(k => SKILLS[k])
    return [...new Set(opts)]
  }, [cls])
  const classSkillPicks = Array.isArray(state.classSkillPicks) ? state.classSkillPicks : []
  // A pick that now duplicates a granted skill (theme/feat changed
  // after it was picked) stops counting toward the class total and is
  // flagged in the UI — never silently dropped.
  const effectiveClassPicks = classSkillPicks.filter(k => !heldSkillSet.has(k))
  const staleClassPicks = classSkillPicks.filter(k => heldSkillSet.has(k))
  const classPicksRemaining = Math.max(0, skillChoices - effectiveClassPicks.length)
  const classOptionsAvailable = classSkillOptions.filter(k => !heldSkillSet.has(k))
  const needsFullListFallback = cls && classOptionsAvailable.length < skillChoices
  const fullListFallback = useMemo(() => {
    if (!needsFullListFallback) return []
    return Object.keys(SKILLS).filter(k => !classSkillOptions.includes(k) && !heldSkillSet.has(k))
  }, [needsFullListFallback, classSkillOptions, heldSkillSet])

  // --- Final lists (synced to state by the effect below) ----------------
  const derived = useMemo(() => {
    // ability_scores syncs ONLY once all six bases are actually placed
    // (scoresComplete) — point buy's display floor of 8 is a preview,
    // not a placed score, so an untouched Stage 4 stores nothing.
    const complete = scoresComplete(baseScores)
    const abilityScores = {}
    if (complete) {
      for (const ab of ABILITIES) abilityScores[ab] = finals[ab]
    }
    const skills = [...new Set([...themeSkills, ...featPicks.skills, ...speciesGrants.skills, ...effectiveClassPicks])]
    const tools = [...new Map(
      [...classTools.granted, ...featPicks.tools, ...speciesGrants.tools].map(t => [t.toLowerCase(), t])
    ).values()]
    // Languages: the species' CONCRETE grants (a "one extra language
    // of your choice" placeholder is a promise, not a language — the
    // Stage 1 picker resolves it into languageChoices above) + feat
    // picks + the Stage 1 language picks. The placeholder never
    // reaches state.languages.
    const languages = [...new Map(
      [...concreteLanguages(speciesLanguages), ...featPicks.languages, ...languageChoices].map(l => [l.toLowerCase(), l])
    ).values()]
    return { abilityScores, abilityChoicePicks: choicePicks, skills, toolProficiencies: tools, languages }
  }, [finals, baseScores, themeSkills, featPicks, effectiveClassPicks, classTools, speciesLanguages, speciesGrants, choicePicks, state.languageChoices])

  // Sync the derived finals into state so the save body carries them.
  // JSON-guarded: the effect writes only when the derived value differs
  // from what state already holds, so it converges in one render.
  useEffect(() => {
    const patch = {}
    if (JSON.stringify(derived.abilityScores) !== JSON.stringify(state.ability_scores || {})) {
      patch.ability_scores = derived.abilityScores
    }
    if (JSON.stringify(derived.abilityChoicePicks) !== JSON.stringify(state.ability_choice_picks || {})) {
      patch.ability_choice_picks = derived.abilityChoicePicks
    }
    if (JSON.stringify(derived.skills) !== JSON.stringify(state.skills || [])) patch.skills = derived.skills
    if (JSON.stringify(derived.toolProficiencies) !== JSON.stringify(state.tool_proficiencies || [])) {
      patch.tool_proficiencies = derived.toolProficiencies
    }
    if (JSON.stringify(derived.languages) !== JSON.stringify(state.languages || [])) patch.languages = derived.languages
    if (Object.keys(patch).length) set(prev => ({ ...prev, ...patch }))
    // Runs when the derived finals change (species/theme/class/choice
    // edits elsewhere in the wizard recompute them here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived])

  // Class change clears Stage 4 picks made for the old class (plan
  // Page 9). stage4PicksClass records which class the current picks
  // belong to; when it mismatches the picked class, the picks go and
  // the new class is recorded. First arrival (no record yet) just
  // records — a resumed draft's picks were made for the class it
  // already carries, and a fresh draft has no picks to clear.
  useEffect(() => {
    if (!classId) return
    const recorded = state.stage4PicksClass || ''
    if (!recorded) {
      const hasPicks = classSkillPicks.length > 0
        || (state.known_spells || []).length > 0
        || (state.prepared_spells || []).length > 0
      set(prev => ({
        ...prev,
        stage4PicksClass: classId,
        ...(hasPicks ? { classSkillPicks: [], known_spells: [], prepared_spells: [] } : {})
      }))
      return
    }
    if (recorded !== classId) {
      set(prev => ({
        ...prev,
        stage4PicksClass: classId,
        classSkillPicks: [],
        known_spells: [],
        prepared_spells: []
      }))
    }
    // Runs only when the picked class changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  // --- Spells: fetch from /api/spells when class/subclass changes ------
  const [spellData, setSpellData] = useState(null)
  const [spellsLoading, setSpellsLoading] = useState(false)
  const [spellsFailed, setSpellsFailed] = useState(false)
  // Where the spell list came from: 'live' (endpoint), 'cached' (the
  // last-good fetch this browser saved), or 'bundled' (the generated
  // catalog). The UI names the source so a degraded list is never
  // mistaken for the live one.
  const [spellSource, setSpellSource] = useState(null)
  useEffect(() => {
    if (!classId) { setSpellData(null); setSpellsFailed(false); setSpellSource(null); return }
    let live = true
    setSpellsLoading(true)
    setSpellsFailed(false)
    setSpellSource(null)
    const qs = new URLSearchParams({ class: classId, level: '1' })
    if (state.subclassName) qs.set('subclass', state.subclassName)
    // The prepared count depends on the spellcasting-ability modifier,
    // which lives in the final scores — send it so the endpoint (the
    // single source of truth for the count) returns the number the
    // server validator will enforce. Without it the endpoint assumes
    // mod 0 and the client would offer fewer prepared spells than the
    // server expects. Refetches when finals change.
    const abilityKey = String(cls?.spellcasting?.ability || '').toLowerCase()
    const abilityScore = ABILITIES.includes(abilityKey) ? finals[abilityKey] : null
    const abilityMod = abilityScore != null ? abilityModifier(abilityScore) : 0
    qs.set('abilityMod', String(abilityMod))
    // Offline fallback (item 23): the cached last-good fetch first,
    // then the bundled generated catalog. Counts always recompute
    // from the bundled dataset at the CURRENT ability modifier — a
    // cached response's counts were computed at the modifier the
    // player had when it was fetched, which may have changed since.
    // Only the spell LIST comes from the cache; the numbers come
    // from the dataset either way. When neither source can serve
    // this class, the gap note below shows instead of a fabricated
    // list.
    const applyFallback = () => {
      if (!live) return
      const cached = loadCachedSpellData(classId)
      const bundled = bundledSpellData(classId, state.subclassName, abilityMod)
      const base = cached || bundled
      if (!base) {
        setSpellData(null)
        setSpellsFailed(true)
        setSpellsLoading(false)
        return
      }
      setSpellData({
        ...base,
        spellsKnown: knownCountFor(classId),
        spellsPrepared: preparedCountFor(classId, abilityMod),
        spellbookSize: spellbookSizeFor(classId),
        spellcastingAbility: spellcastingAbilityForClass(classId) ?? base.spellcastingAbility,
        source: cached ? 'cached' : 'bundled'
      })
      setSpellSource(cached ? 'cached' : 'bundled')
      setSpellsFailed(false)
      setSpellsLoading(false)
    }
    fetch(`/api/spells?${qs.toString()}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!live) return
        setSpellsLoading(false)
        if (d && typeof d === 'object') {
          setSpellData(d)
          setSpellSource('live')
          setSpellsFailed(false)
          saveCachedSpellData(classId, d)
        } else applyFallback()
      })
      .catch(() => {
        if (!live) return
        applyFallback()
      })
    return () => { live = false }
  }, [classId, state.subclassName, finals])

  const spellcastingAbility = (() => {
    const raw = spellData?.spellcastingAbility ?? cls?.spellcasting?.ability
    const key = String(raw || '').toLowerCase()
    return ABILITIES.includes(key) ? key : null
  })()
  const castingMod = spellcastingAbility && finals[spellcastingAbility] != null
    ? abilityModifier(finals[spellcastingAbility])
    : null
  // Fallback when the endpoint served no count: the prepared count
  // from the bundled dataset's per-class rule (generated from the
  // server's getSpellsPrepared) at the current casting modifier.
  // Blackguard is 0 at level 1 (no slots yet); paladin is table-
  // driven in 2024 (2 at L1, PHB pp. 109-110); artificer is mod +
  // half level, the rest are mod + level — the old "mod + 1,
  // artificer + 0" fallback was wrong for paladin and blackguard.
  const preparedFromScores = castingMod != null
    ? preparedCountFor(classId, castingMod)
    : null
  const knownCount = typeof spellData?.spellsKnown === 'number' ? spellData.spellsKnown : null
  const preparedCount = typeof spellData?.spellsPrepared === 'number'
    ? spellData.spellsPrepared
    : (cls && typeof cls.spellcasting?.spellsKnown === 'string'
      && /prepared|spellbook/i.test(cls.spellcasting.spellsKnown)
      ? preparedFromScores
      : null)
  // Wizard spellbook size (2026-11-07): the book holds exactly 6 L1
  // spells at creation. The count comes from the envelope's
  // spellbookSize when the live endpoint served it; the bundled /
  // cached fallback recomputes it (spellbookSizeFor: 6 for a wizard,
  // null otherwise) — spellsKnown stays null for a wizard and is
  // never repurposed as the book count.
  const isWizard = classId === 'wizard'
  const bookCount = isWizard
    ? (typeof spellData?.spellbookSize === 'number' ? spellData.spellbookSize : spellbookSizeFor(classId))
    : null
  const hasSpellPicks = (knownCount != null && knownCount > 0) || (preparedCount != null && preparedCount > 0)
  const spellOptions = useMemo(() => {
    const list = Array.isArray(spellData?.spells) ? spellData.spells : []
    return list
      .filter(s => s?.name && (s.level == null || s.level === 1))
      .map(s => ({
        key: spellKeyOf(s),
        name: s.name,
        school: s.school || '',
        description: s.description || ''
      }))
  }, [spellData])
  const spellSlots = spellData?.spellSlots ?? spellData?.slots ?? null
  const spellSlotsText = (() => {
    if (!spellSlots || typeof spellSlots !== 'object') return ''
    const parts = Object.entries(spellSlots)
      .filter(([, v]) => typeof v === 'number' && v > 0)
      .map(([level, count]) => `${count} × ${level}-level`)
    return parts.join(', ')
  })()

  // --- Handlers ----------------------------------------------------------
  const update = (patch) => set({ ...state, ...patch })

  const setMethod = (nextMethod) => {
    if (nextMethod === method) return
    const next = {}
    if (nextMethod === 'point_buy') {
      // Keep values inside 8–15; anything outside (or blank) becomes 8.
      for (const ab of ABILITIES) {
        const v = baseScores[ab]
        next[ab] = (typeof v === 'number' && v >= 8 && v <= 15) ? v : 8
      }
    } else if (nextMethod === 'standard_array') {
      // Keep a value only if it is a distinct member of the array;
      // duplicates and non-array values reset to blank.
      const seen = new Set()
      for (const ab of ABILITIES) {
        const v = baseScores[ab]
        if (typeof v === 'number' && STANDARD_ARRAY.includes(v) && !seen.has(v)) {
          next[ab] = v
          seen.add(v)
        }
      }
    } else {
      // Manual keeps every placed value (3–18 covers 8–15); blanks stay blank.
      for (const ab of ABILITIES) {
        if (baseScores[ab] != null) next[ab] = baseScores[ab]
      }
    }
    update({ generation_method: nextMethod, base_scores: next })
  }

  const setBaseScore = (ab, value) => {
    if (method === 'point_buy') {
      const v = Number(value)
      if (!Number.isInteger(v) || v < 8 || v > 15) return
      const next = { ...baseScores }
      for (const a of ABILITIES) if (next[a] == null) next[a] = 8
      next[ab] = v
      if (pointsSpent(next) > POINT_BUY_POINTS) return
      update({ base_scores: next })
      return
    }
    if (method === 'standard_array') {
      const next = { ...baseScores }
      if (value === '' || value == null) { delete next[ab] }
      else {
        const v = Number(value)
        if (!STANDARD_ARRAY.includes(v)) return
        if (Object.entries(next).some(([k, x]) => k !== ab && x === v)) return
        next[ab] = v
      }
      update({ base_scores: next })
      return
    }
    // Manual: 3–18 per score, validated per field.
    const next = { ...baseScores }
    if (value === '' || value == null) { delete next[ab] }
    else {
      const v = Number(value)
      if (!Number.isInteger(v)) return
      next[ab] = Math.min(18, Math.max(3, v))
    }
    update({ base_scores: next })
  }

  const toggleChoicePick = (ab) => {
    const picks = { ...(state.ability_choice_picks || {}) }
    if (picks[ab]) delete picks[ab]
    else if (Object.keys(picks).length < choiceCount) picks[ab] = 1
    update({ ability_choice_picks: picks })
  }

  const toggleClassSkill = (key) => {
    const cur = [...classSkillPicks]
    const at = cur.indexOf(key)
    if (at >= 0) cur.splice(at, 1)
    else if (effectiveClassPicks.length < skillChoices) cur.push(key)
    update({ classSkillPicks: cur })
  }

  const toggleSpell = (listKey, spellKey, maxCount) => {
    const cur = Array.isArray(state[listKey]) ? [...state[listKey]] : []
    const at = cur.indexOf(spellKey)
    if (at >= 0) cur.splice(at, 1)
    else if (!maxCount || cur.length < maxCount) cur.push(spellKey)
    update({ [listKey]: cur })
  }

  /**
   * Wizard spellbook toggle (2026-11-07): the book picker writes
   * known_spells, capped at bookCount. A spell leaving the book
   * stops being prepared — the server refuses a prepared spell
   * outside the book, so the state never holds one. (The prepared
   * picker below only offers book spells, so a prepared spell can
   * only leave the book here, never by re-picking.)
   */
  const toggleBookSpell = (spellKey) => {
    const curBook = Array.isArray(state.known_spells) ? [...state.known_spells] : []
    const at = curBook.indexOf(spellKey)
    if (at >= 0) {
      curBook.splice(at, 1)
      const nextPrepared = (Array.isArray(state.prepared_spells) ? state.prepared_spells : [])
        .filter(p => p !== spellKey)
      update({ known_spells: curBook, prepared_spells: nextPrepared })
    } else if (!bookCount || curBook.length < bookCount) {
      curBook.push(spellKey)
      update({ known_spells: curBook })
    }
  }

  const selectStyle = {
    width: '100%', padding: '10px 12px', fontFamily: 'var(--serif)',
    fontSize: 16, background: 'var(--paper, #fff)', color: 'var(--ink, #222)',
    border: '1px solid var(--rule, #888)', borderRadius: 6
  }
  const labelStyle = { display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '18px 0 6px' }
  const checkStyle = { display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--serif)', fontSize: 15, margin: '4px 0' }
  // One shared checkbox-row style (creator test-notes #13/#18/#19):
  // a flex row keeps the checkbox on the same horizontal plane as
  // its name, in every picker on this stage. The checkbox never
  // shrinks. Spell rows (name + school + block description) use the
  // flex-start variant with the text in a wrapper, so a tall row
  // never centers its checkbox against two lines of text.
  const checkStyleTop = { display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: 'var(--serif)', fontSize: 15, margin: '4px 0' }
  const checkInputStyle = { flex: '0 0 auto' }
  const primarySet = new Set((cls?.primaryAbility || []).map(a => String(a).toLowerCase()))
  const knownSpells = Array.isArray(state.known_spells) ? state.known_spells : []
  const preparedSpells = Array.isArray(state.prepared_spells) ? state.prepared_spells : []
  // A wizard's prepared spells must come from the book: any prepared
  // spell the book no longer holds (a draft saved before the book
  // existed, or a book spell unpicked after preparing) is stale — it
  // renders as a warning with an unprepare button below, never as a
  // silent pick the server would refuse.
  const stalePreparedSpells = isWizard ? preparedSpells.filter(p => !knownSpells.includes(p)) : []
  const spellReason = !cls?.spellcasting
    ? 'This class does not cast spells — no spell picks here.'
    : (classId === 'warden' || classId === 'scholar')
      ? 'This class casts only through a subclass, starting at level 3 — no spells to pick at level 1.'
      : 'This class has no level-1 spell picks (0 known and 0 prepared at level 1).'

  return (
    <div className="card">
      <div className="eyebrow">Stage 4 of 6</div>
      <h1 className="h-step">Abilities, Skills, &amp; Spells</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Set your ability scores, then the skills, tools, languages, and
        spells that follow from them. Scores are set at creation and
        editable later in edit mode — finals recompute, and a Constitution
        change re-runs the hit-point rule. Nothing here is pre-picked:
        every picker starts empty.
      </p>

      {!classId && (
        <div className="help" style={{ fontStyle: 'normal' }}>
          No class picked yet — pick one on Stage 2 first. Scores can be
          placed without a class, but skill counts, primary abilities,
          and spell picks all need it.
        </div>
      )}

      {/* ---- Scores ---- */}
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 19, marginTop: 22 }}>
        Ability scores
        <Tip text="What you are capable of: six scores, and every bonus in the game derives from them. Scores are set at creation and editable later in edit mode — finals recompute, and a Constitution change re-runs the hit-point rule. The level-1 cap is 18: a final over 18 is shown as a warning and clamped at submit, never silently changed." />
      </h2>

      <div style={{ marginTop: 6 }}>
        <span style={labelStyle}>Generation method
          <Tip text="How the six base scores are set. Point Buy (27 points, bases 8–15) is the default. Standard Array assigns 15, 14, 13, 12, 10, 8. Manual enters 3–18 per score. Switching methods keeps placed values only where legal — anything else resets to 8 (point buy) or blank (array) — and never invents a score." />
        </span>
        <div role="group" aria-label="Generation method">
          {[
            ['point_buy', 'Point Buy'],
            ['standard_array', 'Standard Array'],
            ['manual', 'Manual']
          ].map(([value, label]) => (
            <label key={value} style={{ ...checkStyle, display: 'inline-block', marginRight: 16 }}>
              <input
                type="radio" name="stage4-method" value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
              /> {label}
            </label>
          ))}
        </div>
      </div>

      {method === 'point_buy' && (
        <div className="help" style={{ fontStyle: 'normal' }}>
          {pointsLeft} of {POINT_BUY_POINTS} points left.
          Costs: 8 free, 9 → 1, 10 → 2, 11 → 3, 12 → 4, 13 → 5, 14 → 7, 15 → 9.
        </div>
      )}
      {method === 'standard_array' && (
        <div className="help" style={{ fontStyle: 'normal' }}>
          {placedCount === 6
            ? 'All six array values assigned.'
            : `Unassigned array values: ${arrayRemaining.join(', ') || '—'}. Each value is used once.`}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--serif)', fontSize: 15, marginTop: 10 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--rule, #888)' }}>
            <th style={{ padding: '6px 4px' }}>Ability</th>
            <th style={{ padding: '6px 4px' }}>Base</th>
            <th style={{ padding: '6px 4px' }}>Species</th>
            <th style={{ padding: '6px 4px' }}>Choice</th>
            <th style={{ padding: '6px 4px' }}>Theme</th>
            <th style={{ padding: '6px 4px' }}>Final</th>
            <th style={{ padding: '6px 4px' }}>Mod</th>
          </tr>
        </thead>
        <tbody>
          {ABILITIES.map(ab => {
            const isPrimary = primarySet.has(ab)
            const base = displayBase(ab)
            const final = finals[ab]
            const over = final != null && final > LEVEL_1_CAP
            return (
              <tr key={ab} style={{ borderBottom: '1px solid var(--rule, #ddd)', fontWeight: isPrimary ? 700 : 400 }}>
                <td style={{ padding: '6px 4px' }}>
                  {ABILITY_FULL[ab]}{isPrimary ? ' ★' : ''}
                  <Tip text={`${ABILITY_SCORES[ab]?.description || ''}${isPrimary ? ` Primary ability for ${cls?.name || 'this class'} — it drives the class's core features.` : ''}`} />
                </td>
                <td style={{ padding: '6px 4px' }}>
                  {method === 'point_buy' && (
                    <span>
                      <button type="button" aria-label={`Decrease ${ABILITY_FULL[ab]}`} disabled={base <= 8}
                        onClick={() => setBaseScore(ab, base - 1)} style={{ width: 28 }}>−</button>
                      <span style={{ display: 'inline-block', minWidth: 28, textAlign: 'center' }}>{base}</span>
                      <button type="button" aria-label={`Increase ${ABILITY_FULL[ab]}`}
                        disabled={base >= 15 || pointBuyCost(base + 1) - pointBuyCost(base) > (pointsLeft ?? 0)}
                        onClick={() => setBaseScore(ab, base + 1)} style={{ width: 28 }}>+</button>
                    </span>
                  )}
                  {method === 'standard_array' && (
                    <select
                      aria-label={`${ABILITY_FULL[ab]} (standard array)`}
                      value={base === '' ? '' : base}
                      onChange={e => setBaseScore(ab, e.target.value === '' ? '' : Number(e.target.value))}
                      style={{ padding: '4px 6px', fontFamily: 'var(--serif)', fontSize: 15 }}
                    >
                      <option value="">—</option>
                      {STANDARD_ARRAY.filter(v => arrayRemaining.includes(v) || v === base).map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  )}
                  {method === 'manual' && (
                    <input
                      type="number" min={3} max={18} aria-label={`${ABILITY_FULL[ab]} (manual, 3–18)`}
                      value={base === '' ? '' : base}
                      onChange={e => setBaseScore(ab, e.target.value === '' ? '' : Number(e.target.value))}
                      style={{ width: 64, padding: '4px 6px', fontFamily: 'var(--serif)', fontSize: 15 }}
                    />
                  )}
                </td>
                <td style={{ padding: '6px 4px' }}>{speciesASI.fixed[ab] ? `+${speciesASI.fixed[ab]}` : '—'}</td>
                <td style={{ padding: '6px 4px' }}>{choicePicks[ab] ? '+1' : '—'}</td>
                <td style={{ padding: '6px 4px' }}>{themeASI[ab] ? `+${themeASI[ab]}` : '—'}</td>
                <td style={{ padding: '6px 4px', color: over ? '#c0392b' : undefined }}>
                  {final == null ? '—' : `${final}${over ? ' — over the level-1 cap of 18' : ''}`}
                </td>
                <td style={{ padding: '6px 4px' }}>{formatModifier(final == null ? null : abilityModifier(final))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {speciesASI.fellBackToBase && (
        <div className="help" style={{ fontStyle: 'normal' }}>
          The species list served no per-variant ability increase for this
          variant, so the species base increase is shown instead — a
          variant's increase is its final increase, never base-plus-a-repeat,
          and the registry entry is the authority when it serves one.
        </div>
      )}
      {overCap.length > 0 && (
        <div className="help" style={{ fontStyle: 'normal', color: '#c0392b' }}>
          Warning: {overCap.map(ab => `${ABILITY_FULL[ab]} ${finals[ab]}`).join(', ')} exceed{' '}
          {overCap.length === 1 ? 's' : ''} the level-1 cap of 18. The cap clamps at
          submit and Review names the clamped ability — nothing is changed silently here.
        </div>
      )}
      <div className="help" style={{ fontStyle: 'normal' }}>
        Breakdown per ability: base + species bonus (resolved per species
        and variant) + choice picks + theme +2/+1 = final. No feat line:
        no origin feat grants an ability-score increase in 2024.
        {cls ? ` ★ marks ${cls.name}'s primary ${primarySet.size === 1 ? 'ability' : 'abilities'}.` : ''}
        {theme ? ` Theme increase: ${formatAsi(themeASI) || 'not listed yet'}.` : ' No theme picked yet — pick one on Stage 3 and its +2/+1 lands here.'}
      </div>

      {choiceCount > 0 && (
        <div style={{ marginTop: 6 }}>
          <span style={labelStyle}>Species choice increases ({choiceLeft} choice +1{choiceLeft === 1 ? '' : 's'} left)
            <Tip text="Your species grants choice increases: each +1 goes to a different ability, and the count above is how many are left to place. They lock at creation along with the rest of the species package. If you change species, unplaced or excess picks are dropped — the new species' count rules." />
          </span>
          {ABILITIES.map(ab => (
            <label key={ab} style={{ ...checkStyle, display: 'inline-block', marginRight: 16 }}>
              <input
                type="checkbox"
                checked={!!choicePicks[ab]}
                disabled={!choicePicks[ab] && choiceLeft <= 0}
                onChange={() => toggleChoicePick(ab)}
              /> {ABILITY_SHORT[ab]} +1
            </label>
          ))}
        </div>
      )}

      {/* ---- Skills, tools, languages ---- */}
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 19, marginTop: 26 }}>
        Skills, tools &amp; languages
        <Tip text="One consolidation point for every proficiency grant, so nothing is wasted or doubled. A proficiency granted twice becomes a replacement pick of the same type — never a stack, never a free expertise. Proficiencies are set at creation and editable later in edit mode — changing species, background, or class re-runs consolidation." />
      </h2>

      <div style={{ marginTop: 14 }}>
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Theme signature skills</strong>
        <Tip text="The two skills your theme trained. They are part of the theme package — granted at submit, not chosen here — and they are fixed, pre-checked, and read-only. If a later pick duplicates one, the duplicate becomes a replacement pick of the same type instead of a stack." />
        {theme ? (
          <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
            {themeSkills.length
              ? themeSkills.map(k => (
                <span key={k} style={{ display: 'block' }}>☑ {SKILLS[k]?.name || prettify(k)} — granted by theme</span>
              ))
              : 'No signature skills listed for this theme yet.'}
          </div>
        ) : (
          <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
            No theme picked yet — pick one on Stage 3 and its two signature skills land here, granted.
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Species grants</strong>
        <Tip text="What your species grants: its languages, its traits, and — when the registry serves them — its structured skill, tool, weapon, armor, sense, and resistance grants, which join the consolidation above. Traits live in the registry as prose — they are shown here as they are written, never parsed into pick data, so a trait that grants a skill in words does not silently become a structured pick." />
        <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
          {speciesEntry ? (
            <>
              <div>Languages: {speciesLanguages.length ? speciesLanguages.join(', ') : 'no languages listed'}{languageChoices.length > 0 ? ` — your extra language: ${languageChoices.join(', ')}` : ''}</div>
              {speciesGrants.skills.length > 0 && (
                <div style={{ marginTop: 4 }}>Skills: {speciesGrants.skills.map(k => SKILLS[k]?.name || prettify(k)).join(', ')}</div>
              )}
              {speciesGrants.tools.length > 0 && (
                <div style={{ marginTop: 4 }}>Tools: {speciesGrants.tools.join(', ')}</div>
              )}
              {speciesGrants.weapons.length > 0 && (
                <div style={{ marginTop: 4 }}>Weapons: {speciesGrants.weapons.join(', ')}</div>
              )}
              {speciesGrants.armor.length > 0 && (
                <div style={{ marginTop: 4 }}>Armor: {speciesGrants.armor.join(', ')}</div>
              )}
              {speciesGrants.senses.length > 0 && (
                <div style={{ marginTop: 4 }}>Senses: {speciesGrants.senses.join(', ')}</div>
              )}
              {speciesGrants.resistances.length > 0 && (
                <div style={{ marginTop: 4 }}>Resistances: {speciesGrants.resistances.join(', ')}</div>
              )}
              {speciesTraits.length > 0 && (
                <div style={{ marginTop: 4 }}>Traits:
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                    {speciesTraits.map(t => (<li key={t}>{t}</li>))}
                  </ul>
                </div>
              )}
              {isDeferredSpecies(speciesEntry) && (
                <div style={{ marginTop: 4 }}>{deferredNoteFor(speciesEntry)}</div>
              )}
            </>
          ) : (
            'No species picked yet — pick one on Stage 1 and its languages and traits land here.'
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <span style={labelStyle}>Class skills {cls ? `(choose ${skillChoices})` : ''}
          <Tip text="Your class's skill picks: the count and the options come from your class. An option you already hold — from your theme or a feat — is grayed out and disabled, never hidden, and does not count against the class total: pick a replacement of the same type instead. If held skills leave fewer class options than picks, the remaining picks may come from any skill." />
        </span>
        {!cls ? (
          <div className="help" style={{ fontStyle: 'normal' }}>Pick a class on Stage 2 first; its skill count and options list here.</div>
        ) : (
          <>
            <div className="help" style={{ fontStyle: 'normal' }}>
              {effectiveClassPicks.length} of {skillChoices} class skills picked
              {classPicksRemaining > 0 ? ` — ${classPicksRemaining} left` : ' — complete'}.
            </div>
            {classSkillOptions.map(k => {
              const held = heldSkillSet.has(k)
              const checked = classSkillPicks.includes(k)
              return (
                <label key={k} style={{ ...checkStyle, opacity: held ? 0.55 : 1 }}>
                  <input
                    type="checkbox" style={checkInputStyle} disabled={held} checked={checked}
                    onChange={() => toggleClassSkill(k)}
                  />
                  <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                    {held ? `${SKILLS[k]?.name || prettify(k)} — already granted` : (SKILLS[k]?.name || prettify(k))}
                    {SKILLS[k]?.description ? <span style={{ display: 'block', opacity: 0.75, fontSize: 14 }}>{SKILLS[k].description}</span> : null}
                  </span>
                </label>
              )
            })}
            {needsFullListFallback && (
              <div style={{ marginTop: 10 }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>
                  Any skill (replacement picks)
                  <Tip text="Fewer unheld class options remain than picks, so the remaining class picks may come from any skill — the plan's fully-open-grant rule. These are still class picks: they count toward the class total above, and they lock at creation like the rest." />
                </span>
                {fullListFallback.map(k => {
                  const checked = classSkillPicks.includes(k)
                  return (
                    <label key={k} style={checkStyle}>
                      <input type="checkbox" style={checkInputStyle} checked={checked} onChange={() => toggleClassSkill(k)} />
                      <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                        {SKILLS[k]?.name || prettify(k)}
                        {SKILLS[k]?.description ? <span style={{ display: 'block', opacity: 0.75, fontSize: 14 }}>{SKILLS[k].description}</span> : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
            {staleClassPicks.length > 0 && (
              <div className="help" style={{ fontStyle: 'normal', color: '#c0392b' }}>
                {staleClassPicks.map(k => SKILLS[k]?.name || prettify(k)).join(', ')} now duplicate
                {' '}a granted skill (theme or feat changed after the pick) — they no longer
                count toward the class total above. Uncheck them and pick replacements.
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Feat-granted picks</strong>
        <Tip text="Proficiencies your feats already granted — the ancestry feat from Stage 1 and the origin feat from Stage 3. They were picked on those stages and arrive here as held, never re-picked: a duplicate in the class picker above becomes a replacement pick instead." />
        <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
          {featPicks.skills.length === 0 && featPicks.tools.length === 0 && featPicks.languages.length === 0 ? (
            'No feat-granted proficiencies yet — ancestry and origin feat subchoices land here once picked.'
          ) : (
            <>
              {featPicks.skills.length > 0 && (
                <div>Skills: {featPicks.skills.map(k => SKILLS[k]?.name || prettify(k)).join(', ')}</div>
              )}
              {featPicks.tools.length > 0 && (
                <div>Tools: {featPicks.tools.join(', ')}</div>
              )}
              {featPicks.languages.length > 0 && (
                <div>Languages: {featPicks.languages.join(', ')}</div>
              )}
            </>
          )}
          {classTools.info.length > 0 && (
            <div style={{ marginTop: 4 }}>
              Class tool notes (not picks — your class grants a choice the
              registry does not structure): {classTools.info.join('; ')}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Final lists</strong>
        <Tip text="The deduplicated result: every proficiency you hold, each listed once, whatever granted it. These are the lists saved at this stage — the per-source picks stay in the draft so going back never loses a choice." />
        <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
          <div>Skills: {derived.skills.length ? derived.skills.map(k => SKILLS[k]?.name || prettify(k)).join(', ') : '—'}</div>
          <div>Tools: {derived.toolProficiencies.length ? derived.toolProficiencies.join(', ') : '—'}</div>
          <div>Languages: {derived.languages.length ? derived.languages.join(', ') : '—'}</div>
        </div>
      </div>

      {/* ---- Spells ---- */}
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 19, marginTop: 26 }}>
        Spells
        <Tip text="What magic you start with. Known-casters pick spells they know; prepared-casters pick spells they prepare each day from what they could know. Known spells lock at creation; prepared spells can change later. Granted spells — species, dragonmark, or the Magic Initiate level-1 spell and cantrips — never count against either total. Cantrips are not picked here; they stay in Stage 2." />
      </h2>

      {!classId ? (
        <div className="help" style={{ fontStyle: 'normal' }}>
          Pick a class on Stage 2 first; its level-1 spells list here.
        </div>
      ) : spellsLoading ? (
        <div className="help" style={{ fontStyle: 'normal' }}>Loading level-1 spells…</div>
      ) : spellsFailed || !spellData ? (
        <div className="help" style={{ fontStyle: 'normal' }}>
          Couldn&apos;t load the spell list — check your connection and refresh.
        </div>
      ) : !hasSpellPicks ? (
        <div className="help" style={{ fontStyle: 'normal' }}>{spellReason}</div>
      ) : (
        <>
          {spellSource === 'bundled' && (
            <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>
              Showing the built-in spell list while the server is unreachable — check your connection and refresh to see the full list. A subclass-granted spell may be missing until the server is back.
            </div>
          )}
          {spellSource === 'cached' && (
            <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>
              Showing the last spell list this browser fetched — it may be out of date. Check your connection and refresh.
            </div>
          )}
          {grantedSpells.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Granted spells</strong>
              <Tip text="Spells you are GRANTED — from your species, a dragonmark, or your Magic Initiate origin feat. They never count against spells known or prepared, and they are read-only here: a granted spell is never picked again below." />
              <ul style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>
                {grantedSpells.map(g => (
                  <li key={`${g.source}-${g.name}`}>{g.name} <span style={{ opacity: 0.75 }}>— granted by {g.source}</span></li>
                ))}
              </ul>
            </div>
          )}
          {knownCount > 0 && (
            <div style={{ marginTop: 6 }}>
              <span style={labelStyle}>Spells known (choose {knownCount})
                <Tip text="Spells your class knows at level 1. These lock at creation — you cannot swap a known spell freely later — so pick the ones you want to keep. Granted spells above never count against this total." />
              </span>
              <div className="help" style={{ fontStyle: 'normal' }}>
                {knownSpells.length} of {knownCount} known spells picked.
              </div>
              {spellOptions.length === 0 ? (
                <div className="help" style={{ fontStyle: 'normal' }}>
                  The server served a known-spell count but no spell list, so no spells can be picked here yet.
                </div>
              ) : spellOptions.map(s => {
                const held = isHeldOption(s.name, [...grantedSpellNames])
                const checked = knownSpells.includes(s.key)
                return (
                  <label key={s.key} style={{ ...checkStyleTop, opacity: held ? 0.55 : 1 }}>
                    <input type="checkbox" style={checkInputStyle} disabled={held} checked={checked} onChange={() => toggleSpell('known_spells', s.key, knownCount)} />
                    <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                      {held ? `${s.name} — already granted` : s.name}
                      {s.school ? <span style={{ opacity: 0.75 }}> ({s.school})</span> : null}
                      {s.description ? <span style={{ display: 'block', opacity: 0.75, fontSize: 14 }}>{s.description}</span> : null}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
          {isWizard && bookCount > 0 && (
            <div style={{ marginTop: 6 }}>
              <span style={labelStyle}>Spellbook (choose {bookCount})
                <Tip text="Your spellbook: the spells you OWN. At level 1 it holds exactly 6 first-level wizard spells, and it grows by 2 every wizard level after that. You prepare spells FROM this book — a spell must be in the book before it can be marked prepared below. The book is what you start with: in play you copy new spells into it for 50 gold and 2 hours per spell level, and if the book is lost you cannot change your prepared spells until it is recovered or replaced. Cantrips are never book spells — they stay in Stage 2." />
              </span>
              <div className="help" style={{ fontStyle: 'normal' }}>
                {knownSpells.length} of {bookCount} spells in the book.
              </div>
              {spellOptions.length === 0 ? (
                <div className="help" style={{ fontStyle: 'normal' }}>
                  The server served a spellbook count but no spell list, so no spells can be picked here yet.
                </div>
              ) : spellOptions.map(s => {
                const held = isHeldOption(s.name, [...grantedSpellNames])
                const checked = knownSpells.includes(s.key)
                const isPrepared = preparedSpells.includes(s.key)
                return (
                  <label key={s.key} style={{ ...checkStyleTop, opacity: held ? 0.55 : 1 }}>
                    <input type="checkbox" style={checkInputStyle} disabled={held} checked={checked} onChange={() => toggleBookSpell(s.key)} />
                    <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                      {held ? `${s.name} — already granted` : s.name}
                      {isPrepared ? <span style={{ opacity: 0.75 }}> — prepared ✓</span> : null}
                      {s.school ? <span style={{ opacity: 0.75 }}> ({s.school})</span> : null}
                      {s.description ? <span style={{ display: 'block', opacity: 0.75, fontSize: 14 }}>{s.description}</span> : null}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
          {preparedCount > 0 && (
            <div style={{ marginTop: 6 }}>
              <span style={labelStyle}>Spells prepared (choose {preparedCount})
                <Tip text={`Spells you prepare each day from what your class could know. Prepared spells can change later — this list is what you start with, not a lock. The count is ${preparedCountRuleText(classId) || 'your spellcasting ability modifier + your character level (minimum 1)'}. Granted spells above never count against this total.${isWizard ? ' A wizard prepares FROM the spellbook above — only spells already in the book can be marked prepared here.' : ''}`} />
              </span>
              <div className="help" style={{ fontStyle: 'normal' }}>
                {preparedFromScores != null && spellcastingAbility
                  ? `${ABILITY_FULL[spellcastingAbility]} ${formatModifier(castingMod)}, level 1 → prepare ${preparedCount}. `
                  : ''}
                {preparedSpells.length} of {preparedCount} prepared spells picked.
              </div>
              {isWizard && knownSpells.length === 0 && (
                <div className="help" style={{ fontStyle: 'normal' }}>
                  Pick your spellbook above first — prepared spells come from the book, so there is nothing to mark prepared yet.
                </div>
              )}
              {stalePreparedSpells.length > 0 && (
                <div className="help" style={{ fontStyle: 'normal', color: '#c0392b' }}>
                  Prepared but not in the spellbook — the server refuses these at save. Unprepare them, or add them to the book above:
                  {stalePreparedSpells.map(k => (
                    <span key={k} style={{ display: 'block' }}>
                      {prettify(k)}{' '}
                      <button type="button" onClick={() => toggleSpell('prepared_spells', k, preparedCount)} style={{ fontSize: 13, padding: '2px 8px' }}>Unprepare</button>
                    </span>
                  ))}
                </div>
              )}
              {spellOptions.length === 0 ? (
                <div className="help" style={{ fontStyle: 'normal' }}>
                  The server served a prepared-spell count but no spell list, so no spells can be picked here yet.
                </div>
              ) : (isWizard ? spellOptions.filter(s => knownSpells.includes(s.key)) : spellOptions).map(s => {
                const held = isHeldOption(s.name, [...grantedSpellNames])
                const checked = preparedSpells.includes(s.key)
                return (
                  <label key={s.key} style={{ ...checkStyleTop, opacity: held ? 0.55 : 1 }}>
                    <input type="checkbox" style={checkInputStyle} disabled={held} checked={checked} onChange={() => toggleSpell('prepared_spells', s.key, preparedCount)} />
                    <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                      {held ? `${s.name} — already granted` : s.name}
                      {s.school ? <span style={{ opacity: 0.75 }}> ({s.school})</span> : null}
                      {s.description ? <span style={{ display: 'block', opacity: 0.75, fontSize: 14 }}>{s.description}</span> : null}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
          {spellSlotsText && (
            <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>
              Spell slots at level 1: {spellSlotsText} (shown, not picked — slots are a result, not a choice).
            </div>
          )}
        </>
      )}

    </div>
  )
}
