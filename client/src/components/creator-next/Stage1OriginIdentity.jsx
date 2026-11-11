import { useState, useEffect, useMemo } from 'react'
import { Field } from '../creator/creatorPrimitives.jsx'
import CelebrationCard from '../creator/CelebrationCard.jsx'
import Tip from './Tooltip.jsx'
import spellsData from '../../data/spells.json' with { type: 'json' }
import { deferredNoteFor, findSpeciesEntry, isDeferredSpecies, isOutsideFR, resolveOriginSetting } from './speciesAdapter.js'
import { LANGUAGES, concreteLanguages, languageChoiceCount } from '../../data/references.js'
import { ARRIVAL_OPTIONS, ORIGIN_SETTINGS, OTHER_ARRIVAL_VALUE, OTHER_REGION_VALUE, OTHER_SETTING_VALUE, isListedArrival, isListedRegion, regionDescription, regionFieldMode, regionsForSetting, settingDescription } from '../../data/originSettings.js'
import { validateStage1 } from './stage1Validation.js'
import { choiceCountOf, heldValuesForChoice, isHeldOption, normalizeChoiceValues, resolveChoiceOptions } from './choiceOptions.js'
import {
  ORIGIN_FEATS, blankMixedAncestry, effectiveTraitCost, fetchMixedAncestryFeatUnion,
  fetchMixedAncestryTables, hasMixedVersatileTrait, isDowngradableDarkvision,
  isMixedAncestry, mixedBudget, mixedSpeed, normalizeMixedSpeciesId, normalizeOriginFeatKey,
  originFeatByKey, traitTableFor, validateMixedAncestryClient, allowedSizesForParents,
  versatileThemeConflict
} from './mixedAncestry.js'

/**
 * Creator-next Stage 1 — Origin & Identity (2026-11-04).
 *
 * Zach's merge: name, gender, and avatar stay TIED to species and
 * origin in one stage, never a separate step. Species first within
 * the stage (traits and feat lists depend on it), identity alongside
 * it. Stored on advance (draft) and at submit: race key, subrace /
 * variant key, origin_setting, origin_region, origin_explanation,
 * ancestry_feat_id, ancestry_feat_choices, first/last/nickname,
 * gender, avatar.
 *
 * Ties and their limits, stated plainly in the UI:
 * - Changing species keeps name/gender/avatar: the avatar is a player
 *   upload, not a race-derived look, so BG3's appearance-reset lesson
 *   does not apply to it. Species/variant/feat changes DO reset the
 *   dependent picks (variant, feat, feat subchoices).
 * - Handoff mode: species, variant, and feat are locked from the
 *   Prelude (celebration card above, as in V2 Step 2); feat subchoices
 *   stay editable; name parts arrive editable as a starting point,
 *   not a lock; gender is locked from the setup wizard, as in V2.
 * - Every choice carries a <Tip> (the global tooltip rule). A choice
 *   without one is unfinished.
 *
 * `species` entries are registry-shaped (see speciesAdapter.js). The
 * component never imports races.json.
 */

function prettifyFeatId(id) {
  if (!id) return ''
  return String(id).split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Mirrors V2 Step 2's helper (same ancestry-feat list mapping, same
// two special cases): aasimar splits by subrace, drow lives at top
// level rather than under elf. Returns '' when not yet disambiguated.
function computeAncestryListId(race, subrace) {
  if (!race) return ''
  const lowerSub = (subrace || '').toLowerCase()
  if (race === 'elf' && (lowerSub.includes('drow') || lowerSub.includes('dark elf'))) return 'drow'
  if (race === 'aasimar') {
    if (lowerSub.includes('protector')) return 'aasimar_protector'
    if (lowerSub.includes('scourge')) return 'aasimar_scourge'
    if (lowerSub.includes('fallen')) return 'aasimar_fallen'
    return ''
  }
  return race.replace(/-/g, '_')
}

const ASI_LABELS = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' }
function formatASI(asi) {
  const parts = Object.entries(asi || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${ASI_LABELS[k] || k} ${v > 0 ? '+' : ''}${v}`)
  return parts.join(', ')
}

export default function Stage1OriginIdentity({ state, set, mode, payload, species = [], mixedTables: mixedTablesProp = null }) {
  const isHandoff = mode === 'handoff'
  const mixed = isMixedAncestry(state)
  const mixedRecord = state.mixedAncestry || null
  const mixedParents = mixedRecord?.parents || []
  const mixedParentsKey = mixed ? mixedParents.filter(Boolean).join(',') : ''

  // Handoff locks mirror V2: race / subrace / feat / gender arrive
  // committed. Everything else on this stage stays editable.
  useEffect(() => {
    if (!isHandoff) return
    const updates = {}
    if (payload?.race && state.race !== payload.race) updates.race = payload.race
    if (payload?.subrace && state.subrace !== payload.subrace) updates.subrace = payload.subrace
    if (payload?.ancestry_feat_id && state.ancestry_feat_id !== payload.ancestry_feat_id) {
      updates.ancestry_feat_id = payload.ancestry_feat_id
    }
    if (payload?.gender && state.gender !== payload.gender) updates.gender = payload.gender
    if (Object.keys(updates).length > 0) set({ ...state, ...updates })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHandoff, payload?.race, payload?.subrace, payload?.ancestry_feat_id, payload?.gender])

  const raceId = state.race || (isHandoff ? payload?.race : '')
  const subrace = state.subrace || (isHandoff ? payload?.subrace : '')
  const featId = state.ancestry_feat_id || (isHandoff ? payload?.ancestry_feat_id : '')

  const currentEntry = useMemo(() => findSpeciesEntry(species, raceId), [species, raceId])
  // A deferred species' content is grayed with the MVP note wherever
  // it can appear (a resume, a PUT, or an NPC path can still set one,
  // even though the picker below never offers it). The check is the
  // one shared isDeferredSpecies — the server's pcCreatable flag.
  const speciesDeferred = isDeferredSpecies(currentEntry)
  const speciesDeferredNote = speciesDeferred ? deferredNoteFor(currentEntry) : ''
  const variants = currentEntry?.variants || []
  // Alphabetical at render, so the picker order never depends on the
  // /api/species merge order or the interim adapter's races.json order
  // (the same copied-array sort the class picker uses).
  const sortedSpecies = useMemo(() => [...species].sort((a, b) =>
    (a.name || a.id || '').localeCompare(b.name || b.id || '')), [species])
  const sortedVariants = useMemo(() => [...variants].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')), [variants])
  const selectedVariant = variants.find(v => v.name === subrace) || null

  // Extra-language choice (R2-15): human + half-elf grant "one extra
  // language of your choice" — a placeholder in the species languages,
  // not a language. The picker below resolves it into
  // state.languageChoices; Stage 4 merges the picks into the derived
  // languages list. Held set: the species' concrete languages, plus
  // picks already made in sibling slots.
  const speciesLanguageSlots = !mixed && currentEntry ? languageChoiceCount(currentEntry.languages || []) : 0
  const languageChoices = Array.isArray(state.languageChoices) ? state.languageChoices : []
  const speciesLanguageDisplay = currentEntry
    ? [...concreteLanguages(currentEntry.languages || []), ...languageChoices.filter(Boolean),
      ...Array(Math.max(0, speciesLanguageSlots - languageChoices.filter(Boolean).length)).fill('One extra language of your choice')]
    : []

  // Mixed Ancestry trait tables (GET /api/mixed-ancestry): the shell
  // fetches them on mount and passes them in; when it could not (the
  // endpoint was unreachable) this component fetches them lazily the
  // first time a mixed record is on, so the trait picker never blocks
  // the rest of the stage on a failed fetch. A null table set means
  // the picker shows the gap honestly instead of invented traits.
  const [tablesLocal, setTablesLocal] = useState(null)
  const [tablesError, setTablesError] = useState(false)
  useEffect(() => {
    if (mixedTablesProp || tablesLocal || tablesError) return
    if (!mixed) return
    let cancelled = false
    fetchMixedAncestryTables()
      .then(d => { if (!cancelled) setTablesLocal(d) })
      .catch(() => { if (!cancelled) setTablesError(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixedTablesProp, mixed, tablesLocal, tablesError])
  const mixedTables = mixedTablesProp || tablesLocal
  const mixedTableList = Array.isArray(mixedTables?.tables) ? mixedTables.tables : (Array.isArray(mixedTables) ? mixedTables : [])
  const mixedBudgetNow = mixed ? mixedBudget(mixedRecord.traits || [], mixedRecord.forgoOriginFeat) : null
  const mixedErrors = mixed ? validateMixedAncestryClient(mixedRecord, mixedTableList, species) : []

  const [feats, setFeats] = useState([])
  const [featsLoading, setFeatsLoading] = useState(false)
  const [featsLoaded, setFeatsLoaded] = useState(false)

  useEffect(() => {
    // Mixed Ancestry: the ancestry-feat picker offers the UNION of
    // the two parents' lists (GET /api/mixed-ancestry/ancestry-lists
    // then each list at tier 1) — a feat on both parents' lists
    // appears once. Fewer than two parents means no list yet.
    if (mixed) {
      if (mixedParents.filter(Boolean).length !== 2) { setFeats([]); setFeatsLoaded(false); return }
      let cancelled = false
      setFeatsLoading(true)
      fetchMixedAncestryFeatUnion(mixedParents.filter(Boolean))
        .then(data => {
          if (cancelled) return
          setFeats(Array.isArray(data) ? data : [])
          setFeatsLoaded(true)
          setFeatsLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setFeats([]); setFeatsLoaded(true); setFeatsLoading(false)
        })
      return () => { cancelled = true }
    }
    if (!raceId) { setFeats([]); setFeatsLoaded(false); return }
    const listId = computeAncestryListId(raceId, subrace)
    if (!listId) { setFeats([]); setFeatsLoaded(false); return }
    let cancelled = false
    setFeatsLoading(true)
    fetch(`/api/progression/ancestry-feats/${listId}?tier=1`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        if (cancelled) return
        setFeats(Array.isArray(data) ? data : [])
        setFeatsLoaded(true)
        setFeatsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setFeats([]); setFeatsLoaded(true); setFeatsLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId, subrace, mixed, mixedParentsKey])

  const featById = useMemo(() => Object.fromEntries(feats.map(f => [f.id, f])), [feats])
  const selectedFeat = featId ? featById[featId] : null
  // Fallback rule: a species with no feat list at all does not block
  // on a missing feat (it would make the species unplayable).
  const featListAvailable = !featsLoaded || feats.length > 0 || !!featId
  const validation = validateStage1(state, {
    featListAvailable,
    mixedTables: mixedTableList,
    speciesEntries: species,
    speciesEntry: currentEntry
  })

  const [avatarError, setAvatarError] = useState(null)
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    set({ ...state, avatarPreview: previewUrl })
    setAvatarError(null)
    const formDataToSend = new FormData()
    formDataToSend.append('avatar', file)
    try {
      const response = await fetch('/api/upload/avatar', { method: 'POST', body: formDataToSend })
      const result = await response.json()
      if (result.success) set({ ...state, avatar: result.avatarPath, avatarPreview: previewUrl })
      else { setAvatarError('Avatar upload failed — your preview is kept locally but not saved. Try again.'); set({ ...state, avatar: null }) }
    } catch (err) {
      setAvatarError('Avatar upload failed — your preview is kept locally but not saved. Try again.')
      set({ ...state, avatar: null })
    }
  }

  const originSetting = resolveOriginSetting(state.origin_setting, state.origin_setting_custom)
  const outsideFR = originSetting ? isOutsideFR(originSetting) : false

  // Region field mode: a dropdown of that setting's regions when it
  // has a curated list, free text for any other setting (or none yet).
  // The setting list is curated (originSettings.js), not the species'
  // origins — any species can come from any setting; the outside-FR
  // explanation gate is what keeps that honest, not the list.
  const regionMode = regionFieldMode(originSetting)
  const settingRegions = regionsForSetting(originSetting)
  // A stored region not on the list (a legacy free-text draft, or one
  // typed through Other) keeps its text and shows the Other input.
  const regionIsCustom = regionMode === 'dropdown' && !!state.origin_region && !isListedRegion(originSetting, state.origin_region)
  // Local UI flag only: picking Other must reveal the text input even
  // before anything is typed. The stored string stays the source of
  // truth — this flag never reaches persistence, and both selects
  // clear it when the player picks a listed value or a new setting.
  const [regionOtherOpen, setRegionOtherOpen] = useState(false)
  const showRegionCustomInput = regionMode === 'dropdown' && (regionOtherOpen || regionIsCustom)

  // Arrival dropdown (outside-FR only): the explanation is picked
  // from the curated list, or typed through Other. FR-born characters
  // keep the free-text optional note — there is no arrival to explain.
  const explanationIsCustom = outsideFR && !!state.origin_explanation && !isListedArrival(state.origin_explanation)
  const [explanationOtherOpen, setExplanationOtherOpen] = useState(false)
  const showExplanationCustomInput = outsideFR && (explanationOtherOpen || explanationIsCustom)

  // Descriptions shown under the pickers (the species pattern): what
  // the picked setting / region is, so the player knows what they are
  // choosing. A custom setting or region has no description to show.
  const selectedSettingDesc = settingDescription(originSetting)
  const selectedRegion = regionMode === 'dropdown'
    ? settingRegions.find(r => r.name === state.origin_region) || null
    : null
  const ancestryBeats = payload?.ancestry_chapter_beats || []

  const pickSpecies = (id) => {
    // Dependent picks reset with the species; identity fields survive.
    // A species pick also clears anything the mixed / human-trait
    // sections held: a mixed record, a size choice, and a Versatile
    // pick all belong to the previous species, never the new one.
    // The extra-language pick belongs to the old species' grant too.
    set({ ...state, race: id, subrace: '', ancestry_feat_id: null, ancestry_feat_choices: {}, mixedAncestry: null, size: '', versatileFeat: '', versatileFeatChoices: {}, languageChoices: [] })
  }

  // Extra-language pick (R2-15): one select per promised slot. A pick
  // in one slot is excluded from the sibling slots, so the picks can
  // never be the same — the feat language-subchoice pattern.
  const setLanguageChoice = (slot, value) => {
    const next = [...languageChoices]
    while (next.length < speciesLanguageSlots) next.push('')
    if (value && next.some((v, j) => j !== slot && v && String(v).toLowerCase() === String(value).toLowerCase())) return
    next[slot] = value
    set({ ...state, languageChoices: next.filter(v => v != null && String(v).trim() !== '') })
  }

  // --- Mixed Ancestry handlers (Stage 1, species step) -------------
  const toggleMixed = (on) => {
    if (on) {
      // Turning mixed on clears the single-species pick and its
      // dependent picks (variant, feat, size, Versatile) — the record
      // replaces the species choice, it does not sit beside it.
      set({ ...state, race: '', subrace: '', ancestry_feat_id: null, ancestry_feat_choices: {}, mixedAncestry: blankMixedAncestry(), size: '', versatileFeat: '', versatileFeatChoices: {}, languageChoices: [] })
    } else {
      set({ ...state, mixedAncestry: null, ancestry_feat_id: null, ancestry_feat_choices: {}, languageChoices: [] })
    }
  }
  const setMixed = (patch) => set({ ...state, mixedAncestry: { ...(state.mixedAncestry || blankMixedAncestry()), ...patch } })
  const pickMixedParent = (slot, speciesId) => {
    const parents = [mixedRecord?.parents?.[0] || '', mixedRecord?.parents?.[1] || '']
    parents[slot] = speciesId
    // Traits of a replaced parent drop with it; the mixed Versatile
    // pick drops if its trait is gone.
    const kept = (mixedRecord?.traits || []).filter(t =>
      parents.some(p => p && normalizeMixedSpeciesId(p) === normalizeMixedSpeciesId(t.species)))
    const next = { ...mixedRecord, parents, traits: kept }
    if (!hasMixedVersatileTrait(next)) next.versatileFeat = ''
    next.speed = mixedSpeed(next, mixedTableList)
    setMixed(next)
  }
  const toggleMixedTrait = (speciesId, tableTrait) => {
    const cur = [...(mixedRecord?.traits || [])]
    const at = cur.findIndex(t =>
      normalizeMixedSpeciesId(t.species) === normalizeMixedSpeciesId(speciesId)
      && String(t.trait).toLowerCase() === String(tableTrait.name).toLowerCase())
    if (at >= 0) cur.splice(at, 1)
    else cur.push({ species: normalizeMixedSpeciesId(speciesId), trait: tableTrait.name, cost: tableTrait.cost })
    const next = { ...mixedRecord, traits: cur }
    if (!hasMixedVersatileTrait(next)) next.versatileFeat = ''
    next.speed = mixedSpeed(next, mixedTableList)
    setMixed(next)
  }
  const setMixedTraitForm = (speciesId, tableTrait, downgraded) => {
    const cur = (mixedRecord?.traits || []).map(t => {
      if (normalizeMixedSpeciesId(t.species) !== normalizeMixedSpeciesId(speciesId)
        || String(t.trait).toLowerCase() !== String(tableTrait.name).toLowerCase()) return t
      if (!downgraded) {
        const { form, ...rest } = t
        return { ...rest, cost: tableTrait.cost }
      }
      return { ...t, cost: effectiveTraitCost(tableTrait, 'darkvision60'), form: 'darkvision60' }
    })
    setMixed({ traits: cur })
  }
  const mixedTraitPicked = (speciesId, tableTrait) => (mixedRecord?.traits || []).some(t =>
    normalizeMixedSpeciesId(t.species) === normalizeMixedSpeciesId(speciesId)
    && String(t.trait).toLowerCase() === String(tableTrait.name).toLowerCase())
  const mixedTraitPickedElsewhere = (tableTrait) => (mixedRecord?.traits || []).some(t =>
    String(t.trait).toLowerCase() === String(tableTrait.name).toLowerCase())
  const mixedAllowedSizes = mixed ? allowedSizesForParents(mixedParents, species) : []

  // --- Standalone Human Versatile handlers -------------------------
  // The pick is chosen at Stage 1 (it is a human trait) but can only
  // be judged "different from the theme feat" once the theme is
  // known at Stage 3 — so the option equal to the known theme feat
  // is grayed out here, and Stage 3 + the shell block the equal
  // choice before any save. A feat change clears its subchoices.
  const versatileFeatKey = normalizeOriginFeatKey(state.versatileFeat)
  const pickVersatileFeat = (key) => set({
    ...state,
    versatileFeat: key,
    versatileFeatChoices: {}
  })
  const setVersatileChoice = (key, value) => set({
    ...state,
    versatileFeatChoices: { ...(state.versatileFeatChoices || {}), [key]: value }
  })
  const toggleVersatileMulti = (key, option, maxCount) => {
    const cur = Array.isArray((state.versatileFeatChoices || {})[key]) ? [...(state.versatileFeatChoices || {})[key]] : []
    const at = cur.indexOf(option)
    if (at >= 0) cur.splice(at, 1)
    else if (!maxCount || cur.length < maxCount) cur.push(option)
    setVersatileChoice(key, cur)
  }
  const versatileChoices = state.versatileFeatChoices || {}
  const versatileList = (versatileChoices.spell_list || '').toLowerCase()
  const versatileCantripOptions = useMemo(() => {
    if (versatileFeatKey !== 'magic_initiate' || !versatileList) return []
    return ((spellsData.cantrips || {})[versatileList] || []).map(s => s?.name).filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [versatileFeatKey, versatileList])
  const versatileLevel1Options = useMemo(() => {
    if (versatileFeatKey !== 'magic_initiate' || !versatileList) return []
    return ((spellsData.spells || {})['1st'] || [])
      .filter(s => s?.name && Array.isArray(s.classes) && s.classes.includes(versatileList))
      .map(s => s.name)
      .sort((a, b) => a.localeCompare(b))
  }, [versatileFeatKey, versatileList])
  // Species-granted spells gray out in the Versatile Magic Initiate
  // pickers — a granted spell is never re-picked (Stage 3 pattern).
  const versatileHeldCantrips = (selectedVariant?.innateSpells?.length ? selectedVariant.innateSpells : (currentEntry?.innateSpells || []))
    .filter(s => s && s.level === 0 && s.name).map(s => s.name)
  const versatileHeldSpells = (selectedVariant?.innateSpells?.length ? selectedVariant.innateSpells : (currentEntry?.innateSpells || []))
    .filter(s => s && s.level === 1 && s.name).map(s => s.name)

  return (
    <>
      <div className="wizard-head">
        <div className="step-title">
          <div className="eyebrow step-label">
            New Character Creator<span className="dot" />Stage 1 of 6
          </div>
          <h1 className="h-step">Origin &amp; Identity</h1>
          <p className="lede" style={{ marginTop: 12, maxWidth: 640 }}>
            Who you are and where you are from — one step, because your name, your face,
            and your people belong together.
          </p>
        </div>
      </div>

      {isHandoff && ancestryBeats.length > 0 && (
        <CelebrationCard
          opening="These moments named your ancestry feat:"
          beats={ancestryBeats}
          outcomePrefix="Your ancestry feat:"
          outcomeBold={selectedFeat?.feat_name || payload?.ancestry_feat_name || prettifyFeatId(featId)}
          outcomeSuffix={
            (selectedFeat?.description || payload?.ancestry_feat_description)
              ? ` — ${selectedFeat?.description || payload?.ancestry_feat_description}`
              : '.'
          }
        />
      )}

      <div className="card">
        <Field
          label={<span>Species<Tip text="Your lineage: the body, senses, and traits you were born with. This shapes your starting traits, languages, and speed, and it decides which ancestry feats you can pick below. Locked at creation — you cannot change species later, so pick the one you want to play." /></span>}
        >
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {sortedSpecies.map(s => {
              // MVP player-species scope (Zach, 2026-11-05): the 18
              // outside-FR species stay visible but disabled, with the
              // reason as the tooltip. A missing flag (the interim
              // adapter's 10 legacy races) means creatable — only an
              // explicit false grays a chip out.
              const grayed = s.pcCreatable === false
              const grayedNote = s.pcCreatableNote || 'Coming after the MVP — NPCs can still be this species.'
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`chip ${raceId === s.id ? 'on' : ''}`}
                  disabled={isHandoff || grayed}
                  onClick={() => pickSpecies(s.id)}
                  title={grayed ? grayedNote : s.description}
                  aria-label={grayed ? `${s.name} — ${grayedNote}` : s.name}
                  style={grayed ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
        </Field>

        <Field
          label={<span>Mixed Ancestry<Tip text="Born of two peoples: pick two parent species and build your heritage from their traits, within a power budget of 7. Each trait costs what the Mixed Ancestry rules charge for it; Darkvision from both parents is the same trait, so it can only be taken once. This replaces a single-species pick — turning it on clears the species above. Locked at creation, like species. In handoff mode the Prelude already fixed your species, so this stays off." /></span>}
        >
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`chip ${mixed ? 'on' : ''}`}
              disabled={isHandoff}
              onClick={() => toggleMixed(!mixed)}
              title={isHandoff ? 'Your species was fixed by the Prelude.' : 'Build a heritage from two parent species.'}
            >
              {mixed ? 'Mixed Ancestry — on' : 'Mixed Ancestry'}
            </button>
          </div>
          {mixed && (
            <>
              <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
                Pick two parent species, then their traits. Your size comes from either parent, your speed is 30 ft unless a trait raises it, and your ancestry feat below comes from either parent&apos;s list.
              </div>
              <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)', marginTop: 8 }}>
                You have 7 points to spend across both parents&apos; traits. Each trait costs the points shown next to it — stronger traits cost more. You can spend up to 11 if you give up your theme&apos;s origin feat (below). Size never changes your speed.
              </div>
              {!mixedTables && !tablesError && (
                <div className="help">Loading trait tables…</div>
              )}
              {tablesError && (
                <div className="help">Couldn&apos;t load the Mixed Ancestry trait tables — check your connection and refresh. Your picks here are kept in this browser for now.</div>
              )}
              {mixedTableList.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
                    {[0, 1].map(slot => (
                      <div key={slot} style={{ flex: '1 1 200px' }}>
                        <label style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, marginBottom: 6 }}>
                          {slot === 0 ? 'First parent' : 'Second parent'}
                          <Tip text={slot === 0 ? 'The first of your two parent species. Order is display order only — it changes how your heritage reads, never what it grants.' : 'The second of your two parent species. It must be a different species from the first, and both must be playable species — the grayed-out ones below are not available as parents yet.'} />
                        </label>
                        <select
                          className="select"
                          value={mixedParents[slot] || ''}
                          disabled={isHandoff}
                          onChange={e => pickMixedParent(slot, e.target.value)}
                        >
                          <option value="">Choose a parent species…</option>
                          {mixedTableList.map(t => {
                            const otherPick = mixedParents[slot === 0 ? 1 : 0]
                            const alreadyOther = !!otherPick && normalizeMixedSpeciesId(otherPick) === normalizeMixedSpeciesId(t.speciesId)
                            const disabled = t.available === false || alreadyOther
                            return (
                              <option key={t.speciesId} value={t.speciesId} disabled={disabled}>
                                {t.available === false ? `${t.name} — ${t.unavailableReason}` : alreadyOther ? `${t.name} — already the other parent` : t.name}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    ))}
                  </div>
                  {mixedParents.filter(Boolean).map(pid => {
                    const table = traitTableFor(mixedTableList, pid)
                    if (!table) return null
                    return (
                      <div key={pid} style={{ marginTop: 14 }}>
                        <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>{table.name} traits</strong>
                        <Tip text="Each trait costs power budget from the shared pool below. A trait taken from one parent cannot be taken again from the other — Darkvision from both parents is the same trait. Traits that would push you over the budget are grayed out until you free budget or take the forgo trade below." />
                        {table.traits.map(tr => {
                          const picked = mixedTraitPicked(pid, tr)
                          const dupElsewhere = !picked && mixedTraitPickedElsewhere(tr)
                          const minCost = isDowngradableDarkvision(tr) ? 1 : tr.cost
                          const wouldExceed = !picked && minCost > (mixedBudgetNow?.remaining ?? 0)
                          const disabled = isHandoff || dupElsewhere || wouldExceed
                          const pickedEntry = (mixedRecord?.traits || []).find(t =>
                            normalizeMixedSpeciesId(t.species) === normalizeMixedSpeciesId(pid)
                            && String(t.trait).toLowerCase() === String(tr.name).toLowerCase())
                          return (
                            <div key={tr.name}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--serif)', fontSize: 15, margin: '4px 0', opacity: disabled ? 0.55 : 1 }}>
                                <input type="checkbox" style={{ flex: '0 0 auto' }} disabled={disabled} checked={picked} onChange={() => toggleMixedTrait(pid, tr)} /> <span>{tr.name} — {tr.cost} power{tr.cost !== 1 ? 's' : ''}
                                {tr.darkvisionFt ? ` (${tr.darkvisionFt} ft darkvision)` : ''}
                                {tr.speedFt ? ` (${tr.speedFt} ft speed)` : ''}
                                {tr.description ? ` — ${tr.description}` : ''}
                                {dupElsewhere ? ' — already picked from the other parent' : ''}
                                {wouldExceed ? ' — would exceed the budget' : ''}</span>
                              </label>
                              {picked && isDowngradableDarkvision(tr) && (
                                <div style={{ marginLeft: 24 }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--serif)', fontSize: 15, margin: '2px 0' }}>
                                    <input
                                      type="checkbox"
                                      style={{ flex: '0 0 auto' }}
                                      disabled={isHandoff}
                                      checked={pickedEntry?.form === 'darkvision60'}
                                      onChange={e => setMixedTraitForm(pid, tr, e.target.checked)}
                                    /> <span>Take as 60 ft darkvision instead (cost 1, not 2)</span>
                                  </label>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}

                  <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)', marginTop: 12 }}>
                    Power budget: <strong>{mixedBudgetNow?.used ?? 0}/{mixedBudgetNow?.cap ?? 7}</strong>
                    {mixedBudgetNow ? ` — ${mixedBudgetNow.remaining} left` : ''}
                    {mixedRecord.forgoOriginFeat ? ' (7 + 4 for forgoing your theme\'s origin feat)' : ''}.
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--serif)', fontSize: 15, marginTop: 10 }}>
                    <input
                      type="checkbox"
                      style={{ flex: '0 0 auto' }}
                      disabled={isHandoff}
                      checked={!!mixedRecord.forgoOriginFeat}
                      onChange={e => setMixed({ forgoOriginFeat: e.target.checked })}
                    /> <span>Forgo the theme origin feat for +4 power budget</span>
                    <Tip text="A trade, not a bonus: you give up the origin feat your theme would grant at Stage 3, and your power budget rises from 7 to 11. Stage 3 will show the theme's feat as not granted. You can turn this off any time before Review to take the feat instead — but then any traits over 7 budget must come off first." />
                  </label>
                  {mixedRecord.forgoOriginFeat && (
                    <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
                      Your theme&apos;s origin feat is forgone — Stage 3 will show it as not granted, and you keep the extra 4 budget instead.
                    </div>
                  )}

                  {mixedAllowedSizes.length > 0 && (
                    <>
                      <div style={{ marginTop: 12 }}>
                        <span style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Size
                          <Tip text="Your size comes from either parent — pick one of the sizes your parents offer. A human parent offers Medium or Small (2024 book); most other parents offer one fixed size. Size never changes your speed. Locked at creation." />
                        </span>
                        <div className="chips" style={{ flexWrap: 'wrap', marginTop: 6 }}>
                          {mixedAllowedSizes.map(s => (
                            <button
                              key={s}
                              type="button"
                              className={`chip ${mixedRecord.size === s ? 'on' : ''}`}
                              disabled={isHandoff}
                              onClick={() => setMixed({ size: s })}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)', marginTop: 10 }}>
                    Speed: {mixedSpeed(mixedRecord, mixedTableList)} ft — 30 ft unless a trait raises it (the Goliath Speed trait, 35 ft, is not available until goliath lands). Size never changes your speed.
                  </div>

                  {hasMixedVersatileTrait(mixedRecord) && (
                    <>
                      <label style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '14px 0 6px' }}>
                        Versatile origin feat (Mixed Ancestry trait)
                        <Tip text="The Human Versatile trait lets you gain any one origin feat — this is the Mixed Ancestry trait pick, stored inside your Mixed Ancestry record. It is NOT the standalone human Versatile pick, and like that pick it must differ from your theme's feat. It costs 4 of your power budget as the trait itself." />
                      </label>
                      <select
                        className="select"
                        value={mixedRecord.versatileFeat || ''}
                        disabled={isHandoff}
                        onChange={e => setMixed({ versatileFeat: e.target.value })}
                      >
                        <option value="">Choose an origin feat…</option>
                        {ORIGIN_FEATS.map(f => {
                          const blocked = !!versatileThemeConflict(f.key, state.originFeat)
                          return (
                            <option key={f.key} value={f.key} disabled={blocked}>
                              {blocked ? `${f.name} — already your theme's feat` : f.name}
                            </option>
                          )
                        })}
                      </select>
                      {versatileThemeConflict(mixedRecord.versatileFeat, state.originFeat) && (
                        <div className="help" style={{ color: '#c0392b' }}>
                          This feat is already your theme&apos;s origin feat — the Versatile feat must be a different origin feat. Pick another one above.
                        </div>
                      )}
                      {mixedRecord.versatileFeat && (
                        <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
                          {originFeatByKey(mixedRecord.versatileFeat)?.effect || ''}
                        </div>
                      )}
                    </>
                  )}

                  {mixedErrors.length > 0 && (
                    <div className="help" style={{ color: '#c0392b', marginTop: 10 }}>
                      {mixedErrors.join(' ')}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Field>

        {currentEntry && (
          <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)', marginBottom: 18 }}>
            <strong>{currentEntry.name}.</strong> {currentEntry.description}
            <ul style={{ margin: '6px 0 0', paddingLeft: '1.1em' }}>
              {currentEntry.size && <li>Size: {currentEntry.size}</li>}
              {currentEntry.speed != null && <li>Speed: {currentEntry.speed} ft.</li>}
              {currentEntry.languages.length > 0 && <li>Languages: {speciesLanguageDisplay.join(', ')}</li>}
              {formatASI(currentEntry.abilityScoreIncrease) && (
                <li>Ability increases, as written in the book: {formatASI(currentEntry.abilityScoreIncrease)} (shown, not yet applied — scores are Stage 4).</li>
              )}
              {currentEntry.traits.map(t => <li key={t}>{t}</li>)}
            </ul>
            {speciesDeferred && (
              <div style={{ marginTop: 6 }}>{speciesDeferredNote} — its feats and traits are shown for reference, not picked.</div>
            )}
          </div>
        )}

        {currentEntry && !mixed && speciesLanguageSlots > 0 && (
          <Field
            label={<span>Extra language<Tip text="Your species lets you pick an extra language of your choice — one for each choice your species grants. Pick it here: it is part of your species package, chosen at Stage 1, and it locks at creation like species. A language you already know is grayed out — it is already yours, so it is not picked again here." /></span>}
          >
            {Array.from({ length: speciesLanguageSlots }, (_, slot) => (
              <select
                key={slot}
                className="select"
                style={slot > 0 ? { marginTop: 8 } : undefined}
                value={languageChoices[slot] || ''}
                disabled={isHandoff}
                onChange={e => setLanguageChoice(slot, e.target.value)}
              >
                <option value="">Choose a language…</option>
                {Object.keys(LANGUAGES)
                  .filter(name => !languageChoices.some((v, j) => j !== slot && v && String(v).toLowerCase() === String(name).toLowerCase()))
                  .map(name => {
                    const held = concreteLanguages(currentEntry.languages || [])
                      .some(l => String(l).toLowerCase() === String(name).toLowerCase())
                    return (
                      <option key={name} value={name} disabled={held}>
                        {held ? `${name} — already known` : name}
                      </option>
                    )
                  })}
              </select>
            ))}
            {languageChoices.filter(Boolean).map(name => (
              <div key={name} className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
                <strong>{name}</strong> — {LANGUAGES[name] || ''}
              </div>
            ))}
          </Field>
        )}

        {currentEntry && Array.isArray(currentEntry.sizes) && currentEntry.sizes.length > 0 && !mixed && (
          <Field
            label={<span>Size<Tip text="Your size, chosen when you select this species (2024 book). It is fixed at creation — it decides what spaces you fit through and what you can grapple and carry — and it cannot change later. It never changes your speed. A species with one fixed size shows no picker: there is nothing to choose." /></span>}
          >
            <div className="chips" style={{ flexWrap: 'wrap' }}>
              {currentEntry.sizes.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${state.size === s ? 'on' : ''}`}
                  onClick={() => set({ ...state, size: s })}
                >
                  {s}
                </button>
              ))}
            </div>
            {!state.size && (
              <div className="help">No size picked yet — that is fine for a draft; the species&apos; usual size applies until you pick one.</div>
            )}
          </Field>
        )}

        {currentEntry?.versatile2024 === true && !mixed && (
          <Field
            label={<span>Versatile — an origin feat of your choice<Tip text="The 2024 human Versatile trait: gain any ONE origin feat of your choice, on top of the one your theme grants at Stage 3 — it stacks, but the two feats must be different. Pick it here: it is a human trait, chosen at Stage 1. The equal choice is grayed out once your theme is known, and Stage 3 warns you before anything is saved. Locked at creation, like species." /></span>}
          >
            <select
              className="select"
              value={state.versatileFeat || ''}
              onChange={e => pickVersatileFeat(e.target.value)}
            >
              <option value="">Choose an origin feat… (optional)</option>
              {ORIGIN_FEATS.map(f => {
                const blocked = !!state.originFeat
                  && normalizeOriginFeatKey(f.key) === normalizeOriginFeatKey(state.originFeat)
                return (
                  <option key={f.key} value={f.key} disabled={blocked}>
                    {blocked ? `${f.name} — already your theme's feat` : f.name}
                  </option>
                )
              })}
            </select>
            {versatileFeatKey && originFeatByKey(versatileFeatKey) && (
              <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
                {originFeatByKey(versatileFeatKey).effect}
              </div>
            )}
            {state.originFeat && versatileFeatKey
              && normalizeOriginFeatKey(versatileFeatKey) === normalizeOriginFeatKey(state.originFeat) && (
              <div className="help" style={{ color: '#c0392b' }}>
                This feat is already your theme&apos;s origin feat — the Versatile feat must be a different origin feat. Pick another one above.
              </div>
            )}

            {versatileFeatKey === 'magic_initiate' && (
              <>
                <label style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '14px 0 6px' }}>
                  Spell list — your choice
                  <Tip text="Magic Initiate draws all its spells from ONE list, and for the Versatile pick YOU choose which one — Cleric, Druid, or Wizard. The list locks with the feat at creation and never changes later. Your picks below are only the ability and the spells themselves." />
                </label>
                <select
                  className="select"
                  value={versatileChoices.spell_list || ''}
                  onChange={e => setVersatileChoice('spell_list', e.target.value)}
                >
                  <option value="">Choose a spell list…</option>
                  {['cleric', 'druid', 'wizard'].map(l => (
                    <option key={l} value={l}>{prettify(l)}</option>
                  ))}
                </select>
                {versatileList && (
                  <>
                    <label style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '14px 0 6px' }}>
                      Spellcasting ability
                      <Tip text="The ability your Magic Initiate spells use. Pick the one that matches how you cast — Intelligence, Wisdom, or Charisma. It locks with the feat at creation and cannot be swapped later." />
                    </label>
                    <select
                      className="select"
                      value={versatileChoices.spellcasting_ability || ''}
                      onChange={e => setVersatileChoice('spellcasting_ability', e.target.value)}
                    >
                      <option value="">Choose an ability…</option>
                      {['Intelligence', 'Wisdom', 'Charisma'].map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                    <div style={{ marginTop: 6 }}>
                      <span style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '14px 0 6px' }}>Cantrips (choose 2)
                        <Tip text="Two cantrips from the list above. They are granted by the feat, never counted against your class cantrips known or prepared. A cantrip your species already grants is grayed out — it is already yours, so it is not picked again here." />
                      </span>
                      {versatileCantripOptions.map(c => {
                        const held = isHeldOption(c, versatileHeldCantrips)
                        return (
                          <label key={c} style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '4px 0', opacity: held ? 0.55 : 1 }}>
                            <input type="checkbox" disabled={held} checked={Array.isArray(versatileChoices.cantrips) && versatileChoices.cantrips.includes(c)} onChange={() => toggleVersatileMulti('cantrips', c, 2)} /> {held ? `${c} — already granted` : c}
                          </label>
                        )
                      })}
                    </div>
                    <label style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '14px 0 6px' }}>
                      Level-1 spell (choose 1)
                      <Tip text="One level-1 spell from the list above. It is always prepared, castable once per Long Rest without a slot and with spell slots thereafter. A spell your species already grants is grayed out — it is already yours, so it is not picked again here." />
                    </label>
                    <select
                      className="select"
                      value={versatileChoices.level1_spell || ''}
                      onChange={e => setVersatileChoice('level1_spell', e.target.value)}
                    >
                      <option value="">Choose a spell…</option>
                      {versatileLevel1Options.map(s => {
                        const held = isHeldOption(s, versatileHeldSpells)
                        return (
                          <option key={s} value={s} disabled={held}>{held ? `${s} — already granted` : s}</option>
                        )
                      })}
                    </select>
                  </>
                )}
              </>
            )}

            {versatileFeatKey === 'musician' && (
              <div style={{ marginTop: 6 }}>
                <span style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '14px 0 6px' }}>Instruments (choose 3)
                  <Tip text="Three musical instruments you gain proficiency with. Proficiency here is permanent — it locks at creation and travels with you. Playing one as you finish a rest gives Heroic Inspiration to allies who hear it." />
                </span>
                {(resolveChoiceOptions({ options: 'any_instrument' }) || []).map(o => (
                  <label key={o.value} style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '4px 0' }}>
                    <input type="checkbox" checked={Array.isArray(versatileChoices.instruments) && versatileChoices.instruments.includes(o.value)} onChange={() => toggleVersatileMulti('instruments', o.value, 3)} /> {o.label || o.value}
                  </label>
                ))}
              </div>
            )}

            {versatileFeatKey === 'skilled' && (
              <div style={{ marginTop: 6 }}>
                <span style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '14px 0 6px' }}>Skills or tools (choose 3)
                  <Tip text="Proficiency in any combination of three skills or tools of your choice. These are new proficiencies — they lock at creation. If one duplicates a proficiency you already hold, Stage 4 dedup turns the duplicate into a replacement pick of the same type instead of a stack." />
                </span>
                {(resolveChoiceOptions({ options: 'any_skill_or_tool' }) || []).map(o => (
                  <label key={o.value} style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '4px 0' }}>
                    <input type="checkbox" checked={Array.isArray(versatileChoices.skills_or_tools) && versatileChoices.skills_or_tools.includes(o.value)} onChange={() => toggleVersatileMulti('skills_or_tools', o.value, 3)} /> {o.label || o.value}
                  </label>
                ))}
              </div>
            )}

            {versatileFeatKey === 'crafter' && (
              <div style={{ marginTop: 6 }}>
                <span style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '14px 0 6px' }}>Artisan&apos;s tools (choose 3)
                  <Tip text="Proficiency with three artisan's tools of your choice. They lock at creation, and the feat's crafting — a 20% discount on nonmagical items and one piece of gear crafted at the end of a Long Rest — needs the tools you pick here." />
                </span>
                {(resolveChoiceOptions({ options: 'any_artisan_tool' }) || []).map(o => (
                  <label key={o.value} style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '4px 0' }}>
                    <input type="checkbox" checked={Array.isArray(versatileChoices.artisan_tools) && versatileChoices.artisan_tools.includes(o.value)} onChange={() => toggleVersatileMulti('artisan_tools', o.value, 3)} /> {o.label || o.value}
                  </label>
                ))}
              </div>
            )}
          </Field>
        )}

        {variants.length > 0 && (
          <Field
            label={<span>Variant<Tip text="A subgroup within your species — a distinct upbringing with distinct gifts. Your variant traits are listed below when you pick one. Locked at creation, like species." /></span>}
            locked={isHandoff}
            lockTag="From the Prelude"
          >
            <div className="chips" style={{ flexWrap: 'wrap' }}>
              {sortedVariants.map(v => (
                <button
                  key={v.name}
                  type="button"
                  className={`chip ${subrace === v.name ? 'on' : ''}`}
                  disabled={isHandoff || speciesDeferred}
                  onClick={() => set({ ...state, subrace: v.name, ancestry_feat_id: null, ancestry_feat_choices: {} })}
                  title={speciesDeferred ? speciesDeferredNote : v.description}
                  aria-label={speciesDeferred ? `${v.name} — ${speciesDeferredNote}` : v.name}
                  style={speciesDeferred ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                >
                  {v.name}
                </button>
              ))}
            </div>
            {selectedVariant && (
              <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
                {selectedVariant.description}
                {selectedVariant.traits.length > 0 && (
                  <ul style={{ margin: '6px 0 0', paddingLeft: '1.1em' }}>
                    {selectedVariant.traits.map(t => <li key={t}>{t}</li>)}
                  </ul>
                )}
                {selectedVariant.replaces === null && (
                  <div>This list doesn&apos;t say which base traits this variant replaces, so nothing is filled in for it.</div>
                )}
              </div>
            )}
          </Field>
        )}

        <Field
          label={<span>Where are you from?<Tip text="Origin is a visible second pick after species: the setting your character comes from, kept labelled as-is — never reskinned into the Realms. The DM prompt shows this line, so the world reacts to where you are actually from. Locked at creation." /></span>}
        >
          <select
            className="select"
            value={state.origin_setting || ''}
            onChange={e => { setRegionOtherOpen(false); setExplanationOtherOpen(false); set({ ...state, origin_setting: e.target.value, origin_setting_custom: e.target.value === '__other__' ? state.origin_setting_custom : '' }) }}
          >
            <option value="">Choose a setting…</option>
            {ORIGIN_SETTINGS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value={OTHER_SETTING_VALUE}>Another setting…</option>
          </select>
          {selectedSettingDesc && (
            <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
              {selectedSettingDesc}
            </div>
          )}
        </Field>

        {state.origin_setting === '__other__' && (
          <Field
            label={<span>Which setting?<Tip text="Type the setting name as it is known — Eberron, Exandria, Ravnica, or anywhere else. It is stored exactly as you write it, and the explanation below is what lets it sit in the Forgotten Realms without rewriting either world." /></span>}
            help="Typed exactly as you write it — the DM reads this name and treats it as a real setting, so use the name it is known by."
          >
            <input
              type="text"
              className="input"
              value={state.origin_setting_custom || ''}
              onChange={e => set({ ...state, origin_setting_custom: e.target.value })}
              maxLength={64}
              placeholder="e.g. Eberron"
            />
          </Field>
        )}

        <Field
          label={<span>Region<Tip text="Where in your setting you grew up or lived. Pick from the list — every setting has its own regions — or choose Other and type your own, for a city or a corner not listed. For a setting with no list yet it's free text. It grounds your backstory and gives the DM something concrete to reference. Locked at creation." /></span>}
          help={regionMode === 'dropdown' ? (showRegionCustomInput ? 'Typed exactly as you write it — the DM reads this and treats it as a real place.' : 'Pick a region — or Other to type your own.') : 'Free text. Examples only, not a list to pick from.'}
        >
          {regionMode === 'dropdown' ? (
            <>
              <select
                className="select"
                value={showRegionCustomInput ? OTHER_REGION_VALUE : (state.origin_region || '')}
                onChange={e => {
                  if (e.target.value === OTHER_REGION_VALUE) {
                    setRegionOtherOpen(true)
                    set({ ...state, origin_region: '' })
                  } else {
                    setRegionOtherOpen(false)
                    set({ ...state, origin_region: e.target.value })
                  }
                }}
              >
                <option value="">Choose a region…</option>
                {settingRegions.map(r => (
                  <option key={r.name} value={r.name}>{r.name}</option>
                ))}
                <option value={OTHER_REGION_VALUE}>Other… (type your own)</option>
              </select>
              {selectedRegion && (
                <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
                  {selectedRegion.description}
                </div>
              )}
              {showRegionCustomInput && (
                <input
                  type="text"
                  className="input"
                  style={{ marginTop: 8 }}
                  value={state.origin_region || ''}
                  onChange={e => set({ ...state, origin_region: e.target.value })}
                  maxLength={96}
                  placeholder="e.g. Baldur's Gate"
                />
              )}
            </>
          ) : (
            <input
              type="text"
              className="input"
              value={state.origin_region || ''}
              onChange={e => set({ ...state, origin_region: e.target.value })}
              maxLength={96}
              placeholder="e.g. Sword Coast"
            />
          )}
        </Field>

        {outsideFR && (
        <Field
          label={<span>How did you come to be in the Forgotten Realms? (required)<Tip text="Required whenever your origin is outside the Forgotten Realms, and the one gate that blocks leaving this stage. Pick how you arrived — each option is a story hook the DM will work into your adventure — or choose Other and write your own. Without it, the DM has to invent your arrival mid-scene — this stops that." /></span>}
          help={showExplanationCustomInput ? 'Write your arrival in a sentence or two — the DM reads this and will work it into your adventure.' : 'Pick how you arrived — or Other to write your own.'}
        >
              <select
                className="select"
                value={showExplanationCustomInput ? OTHER_ARRIVAL_VALUE : (state.origin_explanation || '')}
                onChange={e => {
                  if (e.target.value === OTHER_ARRIVAL_VALUE) {
                    setExplanationOtherOpen(true)
                    set({ ...state, origin_explanation: '' })
                  } else {
                    setExplanationOtherOpen(false)
                    set({ ...state, origin_explanation: e.target.value })
                  }
                }}
              >
                <option value="">Choose how you arrived…</option>
                {ARRIVAL_OPTIONS.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
                <option value={OTHER_ARRIVAL_VALUE}>Other… (write your own)</option>
              </select>
              {showExplanationCustomInput && (
                <textarea
                  className="input"
                  style={{ marginTop: 8 }}
                  value={state.origin_explanation || ''}
                  onChange={e => set({ ...state, origin_explanation: e.target.value })}
                  maxLength={500}
                  rows={3}
                  placeholder="Write your arrival in a sentence or two — the DM reads this and will work it into your adventure."
                />
              )}
        </Field>
        )}
      </div>

      <div className="card">
        <div className="field-row three">
          <Field
            label={<span>First name<Tip text="Required. This is the name the roster, the character sheet, and the DM prompt use for you. Changeable later in edit mode." /></span>}
            help="Required."
          >
            <input
              type="text"
              className="input"
              value={state.first_name || ''}
              onChange={e => set({ ...state, first_name: e.target.value })}
              maxLength={64}
              placeholder="—"
            />
          </Field>
          <Field
            label={<span>Last name<Tip text="Some peoples do not use family surnames. Leave blank if that fits your character — blank is never filled in for you." /></span>}
            help="Some peoples don't use family surnames. Leave blank if that fits."
          >
            <input
              type="text"
              className="input"
              value={state.last_name || ''}
              onChange={e => set({ ...state, last_name: e.target.value })}
              maxLength={64}
              placeholder="—"
            />
          </Field>
          <Field
            label={<span>Nickname<Tip text="What people call you informally, if anything. Used in dialogue and narration where it fits. Changeable later." /></span>}
            help="If you have one — what people call you informally."
          >
            <input
              type="text"
              className="input"
              value={state.nickname || ''}
              onChange={e => set({ ...state, nickname: e.target.value })}
              maxLength={32}
              placeholder="—"
            />
          </Field>
        </div>

        <Field
          label={<span>Gender<Tip text="How the game refers to you in narration and dialogue. Changeable later in edit mode." /></span>}
          locked={isHandoff}
          lockTag="From the setup wizard"
        >
          <div className="chips">
            {['Female', 'Male'].map(g => (
              <button
                key={g}
                type="button"
                className={`chip ${state.gender === g ? 'on' : ''}`}
                disabled={isHandoff}
                onClick={() => set({ ...state, gender: g })}
              >
                {g}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label={<span>Avatar (optional)<Tip text="Your portrait for the roster and character sheet. Upload any image; it is yours, not tied to your species, so changing species never resets it. Changeable later in edit mode." /></span>}
          help="Optional. Upload an image to represent your character."
        >
          <input type="file" accept="image/*" onChange={handleAvatarUpload} />
          {state.avatarPreview && (
            <div style={{ marginTop: 10 }}>
              <img src={state.avatarPreview} alt="Avatar preview" style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8 }} />
            </div>
          )}
          {avatarError && <div className="help" style={{ color: '#c0392b' }}>{avatarError}</div>}
        </Field>
      </div>

      <div className="card">
        <Field
          label={<span>Ancestry feat<Tip text="An ancestry feat — a small mechanical advantage that comes with your lineage, chosen here and granted at submit. Locked at creation; in handoff mode the Prelude committed it and only its subchoices below stay editable. If your species has no feat list yet, this stage says so plainly and does not block you — that species stays playable." /></span>}
          locked={isHandoff}
          lockTag="From the Prelude"
        >
          {isHandoff ? (
            <div className="pick locked" style={{ display: 'block', marginTop: 4 }}>
              <div className="name">
                {selectedFeat?.feat_name
                  || payload?.ancestry_feat_name
                  || (featsLoading ? 'Loading…' : prettifyFeatId(featId) || '—')}
              </div>
              {(selectedFeat?.description || payload?.ancestry_feat_description) && (
                <div className="sub" style={{ marginTop: 6, textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink-2)' }}>
                  {selectedFeat?.description || payload?.ancestry_feat_description}
                </div>
              )}
            </div>
          ) : (
            <>
              <select
                className="select"
                value={featId}
                disabled={mixed ? mixedParents.filter(Boolean).length !== 2 : (!computeAncestryListId(raceId, subrace) || speciesDeferred)}
                onChange={e => set({ ...state, ancestry_feat_id: e.target.value, ancestry_feat_choices: {} })}
              >
                <option value="">
                  {mixed
                    ? (mixedParents.filter(Boolean).length !== 2
                      ? 'Pick two parent species first…'
                      : (featsLoading ? 'Loading…' : 'Choose an ancestry feat…'))
                    : !raceId
                      ? 'Pick a species first…'
                      : (raceId === 'aasimar' && !subrace)
                        ? 'Pick a variant first…'
                        : (featsLoading ? 'Loading…' : 'Choose an ancestry feat…')}
                </option>
                {feats.map(f => (
                  <option key={f.id} value={f.id}>{f.feat_name}</option>
                ))}
              </select>
              {speciesDeferred && raceId && (
                <div className="help">{speciesDeferredNote} — no ancestry feat can be picked for this species yet.</div>
              )}
              {featsLoaded && feats.length === 0 && raceId && !speciesDeferred && computeAncestryListId(raceId, subrace) && (
                <div className="help">No feat list exists for this species yet — you can continue without one, and Review will not block on it.</div>
              )}
              {mixed && featsLoaded && feats.length === 0 && mixedParents.filter(Boolean).length === 2 && (
                <div className="help">No feat list exists for these parents yet — you can continue without one, and Review will not block on it.</div>
              )}
              {selectedFeat && (
                <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
                  {selectedFeat.description || selectedFeat.desc}
                </div>
              )}
            </>
          )}
        </Field>

        {/* Generic feat subchoices: rendered only when the fetched feat
            actually carries a choices array (each {id, label, options}).
            Nothing is invented for feats without one. Sentinel options
            ("any_language", "any_skill", ...) expand to real lists via
            resolveChoiceOptions — the route serves them verbatim, and the
            old renderer threw .map on the raw string. A choice too
            open-ended for a dropdown (cantrip / freeform spell picks)
            renders as a text input instead, as the old wizard did.
            Language options the species already knows render grayed out
            and disabled, never hidden — the player sees what they already
            have instead of re-picking it. Skill/tool options gray out
            the same way against the structured species grants (when the
            registry serves them); trait prose is never parsed into pick
            data. A choice with count > 1 (Traveler's Tongue grants two
            languages) renders one control per pick and stores an ARRAY
            of that many distinct values — a pick in one slot is
            excluded from the sibling slots, so the two can never be
            the same. */}
        {selectedFeat?.choices?.map(choice => {
          const options = resolveChoiceOptions(choice)
          // choice.count was never read before this (item 2): a count-2
          // choice rendered one control and stored one value. A count-1
          // choice stores a single string, exactly as before; a
          // count>1 choice stores an array of distinct values.
          const count = choiceCountOf(choice)
          const raw = (state.ancestry_feat_choices || {})[choice.id]
          const values = normalizeChoiceValues(raw, count)
          const setChoice = value => set({ ...state, ancestry_feat_choices: { ...(state.ancestry_feat_choices || {}), [choice.id]: value } })
          const setChoiceAt = (slot, value) => {
            // A count-1 choice stores a single string, exactly as
            // before — only count>1 choices store an array.
            if (count === 1) { setChoice(value); return }
            const next = [...values]
            // A freeform duplicate of another slot is ignored, never
            // stored twice (the selects exclude sibling picks outright).
            if (value && values.some((v, j) => j !== slot && v && String(v).toLowerCase() === String(value).toLowerCase())) return
            next[slot] = value
            setChoice(next.filter(v => v != null && String(v).trim() !== ''))
          }
          // Held values for this choice type: species languages for a
          // language pick, species-granted skills/tools for skill/tool
          // picks. A held option renders disabled, never hidden.
          const heldValues = choice.type === 'language'
            ? [...(currentEntry?.languages || [])]
            : heldValuesForChoice(choice, currentEntry, subrace)
          const renderSelect = (slot) => (
            <select
              key={slot}
              className="select"
              style={slot > 0 ? { marginTop: 8 } : undefined}
              value={values[slot]}
              onChange={e => setChoiceAt(slot, e.target.value)}
            >
              <option value="">Choose…</option>
              {options
                .filter(o => !values.some((v, j) => j !== slot && v && String(v).toLowerCase() === String(o.value).toLowerCase()))
                .map(o => {
                  const held = isHeldOption(o.value, heldValues)
                  return (
                    <option key={o.value} value={o.value} disabled={held}>
                      {held ? `${o.label || o.value} — already known` : (o.label || o.value)}
                    </option>
                  )
                })}
            </select>
          )
          const renderText = (slot) => (
            <input
              key={slot}
              type="text"
              className="input"
              style={slot > 0 ? { marginTop: 8 } : undefined}
              value={values[slot]}
              placeholder="Type the name…"
              onChange={e => setChoiceAt(slot, e.target.value)}
            />
          )
          return (
            <Field
              key={choice.id}
              label={<span>{choice.label || choice.id}<Tip text="A subchoice of your ancestry feat. Picking here decides exactly what the feat grants — it is stored with the feat and granted at submit." /></span>}
            >
              {count === 1 ? (
                options === null ? renderText(0) : renderSelect(0)
              ) : (
                <>
                  {values.map((_, slot) => (options === null ? renderText(slot) : renderSelect(slot)))}
                  <div className="help">Pick {count} — each one different.</div>
                </>
              )}
            </Field>
          )
        })}
      </div>

      {(validation.blocking.length > 0 || validation.needed.length > 0) && (
        <div className="card">
          {validation.blocking.length > 0 && (
            <div style={{ padding: '12px 16px', background: 'rgba(231, 76, 60, 0.08)', border: '1px solid #e74c3c', color: '#c0392b', fontFamily: 'var(--serif)', fontSize: 15 }}>
              Before continuing: {validation.blocking.join(' ')}
            </div>
          )}
          {validation.needed.length > 0 && (
            <div className="help" style={{ marginTop: 10 }}>
              Still needed before Review (not blocking this stage): {validation.needed.join(', ')}.
            </div>
          )}
        </div>
      )}
    </>
  )
}
