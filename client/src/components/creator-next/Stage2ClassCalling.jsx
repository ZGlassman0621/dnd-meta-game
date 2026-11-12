import { useEffect, useMemo, useRef, useState } from 'react'
import Tip from './Tooltip.jsx'
import classesData from '../../data/classes.json'
import deitiesData from '../../data/deities.json'
import { deferredNoteFor, isDeferredSpecies, resolveOriginSetting } from './speciesAdapter.js'
import { subclassOriginSuffix, subclassNeedsOriginExplanation } from './subclassOrigin.js'

/**
 * Creator-next Stage 2 — Class & Calling (2026-11-04, overnight build).
 *
 * Zach's rulings applied here:
 * - Non-caster classes DO show a cantrips subsection whenever ANY
 *   cantrip source applies (species innate, L1-subclass grant, or
 *   feat cantrip). The subsection renders for every class when the
 *   resolved list is non-empty — it is never caster-gated.
 * - Granted cantrips NEVER count against cantrips known/prepared.
 *   The class's own L1 cantrip count is shown beside the granted
 *   list with that rule stated, so the two numbers are never mixed.
 * - Tooltips on EVERY choice via <Tip> (hover/focus/tap), never
 *   title-attribute-only. A choice without a <Tip> is unfinished.
 * - No silent defaults: every picker starts empty. Nothing is
 *   auto-filled: the player makes every pick on this stage.
 *
 * Data sources, and their honest limits:
 * - Class chassis (hit die, saves, L1 cantrip count) from
 *   classes.json, passed in as `classes` or imported here.
 * - Subclasses ONLY from the server subclass registry, passed in
 *   via props (`subclassesByClass` map or `subclasses` array of
 *   registry entries with { name, source, selectionLevel, choices,
 *   class }). The shell fetches /api/subclasses and passes the map;
 *   when unreachable it passes {} — this component then shows the gap
 *   instead of substituting the client classes.json subclass list,
 *   which for artificer still carries unverified Forgewright /
 *   Warsmith and omits Cartographer. Classes with no registry
 *   entry at all (artificer, blood_hunter, keeper, warlord) get the
 *   same honest gap note, not a fake picker.
 * - Species cantrips are computed here from `speciesEntry`
 *   (registry client shape: entry/variant innateSpells, level 0
 *   only; `choose` entries are pending choices, never a spell).
 * - Subclass cantrips: registry entries carry grants only in
 *   free-form mechanics.cantrip text (see
 *   server/services/cantripResolutionService.js), so the server
 *   resolution — not this component — is the authority. This
 *   component shows a subclass cantrip only when the registry
 *   entry passed in carries a structured `grantedCantrips` array
 *   (future endpoint shape) or when a cantrip-naming subclass
 *   choice has been picked on this stage. Until the endpoint
 *   serves that field, subclass grants are under-reported here
 *   and the note below the subsection says so.
 * - Feat cantrips arrive via the `featCantrips` prop (caller-
 *   supplied names); no structured feat-cantrip source exists in
 *   the mirror, so none are invented here.
 * - God picker (cleric/paladin): the same state.faith Stage 5
 *   collects, from client/src/data/deities.json (55 entries) —
 *   the Faerûnian pantheon + None, or the origin setting's own
 *   pantheon when deities.json carries one (Exandria, Greyhawk).
 * - Pact picker (warlock): the three 2024 Pact invocations
 *   (Blade/Chain/Tome — Talisman is 2014-only), transcribed in
 *   the warlock reconciliation note; stored as state.pactBoon.
 * - Fighting style: the option list comes from GET
 *   /api/fighting-styles — the registry's 10 styles served verbatim
 *   (server/data/featRegistry.js via listFightingStyleFeats). There
 *   is NO hardcoded copy in this file. Fighter gets a picker at
 *   level 1; paladin/ranger get one at class level 2+ (the level
 *   arrives on the characterLevel/classLevels props from the shell —
 *   the row's level in edit mode, 1 by construction in create mode);
 *   College of Swords gets its own Dueling / Two-Weapon Fighting
 *   picker. Blood hunter names a fighting style with no structured
 *   options — no picker, and no note about it (the picker simply
 *   does not appear).
 * - Class cantrips are PICKED here (2026-11-07 follow-up), from
 *   GET /api/spells?class=X&level=0&subclass=Y — the catalog
 *   cantrips that class can learn at level 1 (the society for a
 *   magus). The picker offers exactly the class count (classes.json
 *   spellcasting.cantripsKnown[0], cross-checked against the
 *   endpoint's cantripsKnown) plus any species pending choices
 *   (High Elf fighter etc. — those picks are the species choice,
 *   not class picks). The stored list (state.knownCantrips) is the
 *   FINAL list — class picks + granted + species-choice picks, as
 *   spell keys — because the commit validator requires the full
 *   final list. Granted cantrips sync into it automatically (see
 *   the granted-sync effect below); the player's own picks are
 *   never touched by that sync. A granted cantrip shows in the
 *   picker checked and grayed out + disabled, never hidden.
 * - Subclass choices render from entry.choices. A subclass takes
 *   effect at its class's subclassLevel in classes.json (1 for
 *   magus/scholar, 3 for every other class, 6 for keeper — the 2024
 *   PHB puts every PHB class's subclass choice at 3rd level, so the
 *   old 1st/2nd values for cleric/sorcerer/warlock/druid/wizard were
 *   corrected in the 2024-accuracy audit, 2026-11-05); picking it
 *   here is choosing a calling, not claiming its features at level 1.
 * - Subclass origin suffix (creator test-notes #12 follow-up): a
 *   non-FR/null-origin subclass shows ' · origin <setting> — an
 *   origin explanation is required …' after its description, via
 *   subclassOriginSuffix (./subclassOrigin.js) — the requirement is
 *   otherwise invisible at pick time. FR entries show no suffix.
 *
 * State keys (draft state in the shell): classId, subclassName,
 * fightingStyle, subclassChoices { choiceKey: value | [values] },
 * faith (cleric/paladin god — the same field Stage 5 collects),
 * pactBoon (warlock pact — the L1 invocation pick).
 * Granted cantrips are derived at render, never stored, so they
 * cannot drift from their sources.
 */

const SWORDS_STYLES = ['Dueling', 'Two-Weapon Fighting']

/**
 * The three 2024 Pact invocations (PHB pp. 155–157, transcribed in
 * the warlock reconciliation note). Pact of the Talisman is
 * 2014-only and is NOT offered. A warlock gains one invocation at
 * level 1 and the Pact IS an invocation, so picking it at creation
 * matches the book. The five-invocation picker (Armor of Shadows,
 * Eldritch Mind + the 3 Pacts) is a follow-up, not this job.
 */
const PACT_BOONS = [
  { name: 'Pact of the Blade', description: 'Conjure or bond a pact weapon with a Bonus Action — a Simple or Martial Melee weapon that uses your Charisma for attack and damage rolls.' },
  { name: 'Pact of the Chain', description: 'Learn Find Familiar and cast it without a slot — your familiar can take a special form: Imp, Pseudodragon, Quasit, Skeleton, Slaad Tadpole, Sphinx of Wonder, Sprite, or Venomous Snake.' },
  { name: 'Pact of the Tome', description: 'Conjure a Book of Shadows holding 3 cantrips and 2 level-1 Ritual spells from any class list — they stay prepared while the book is on your person, and the book is your spellcasting focus.' },
]

/**
 * Stage 2 god picker: the origin setting's own pantheon when
 * deities.json carries one, else the Faerûnian pantheon — the game
 * is set in the Realms, so Faerûn is the default for every other
 * setting, including an unset one.
 */
const SETTING_PANTHEONS = { Exandria: 'Exandrian', Greyhawk: 'Greyhawk' }

/**
 * Class level for the fighting-style gate: the entry for this class
 * in class_levels when present (a paladin 1 / rogue 1 has paladin
 * level 1 even though the row total is 2), else the row total, else 1.
 * Same shape + fallback as the server's paladin PUT block and
 * wizardLevelFromClassLevels (server/services/spellbookService.js) —
 * the client gate must agree with the server §13 gate, or a
 * multiclass character would see a picker for a style it cannot have
 * yet (or be blocked at Review for one the server does not require).
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

/**
 * The fighting-style gate, as the component renders it: which list
 * (if any) the picker shows, and whether the class offers a style at
 * this level. Fighter at L1; paladin/ranger at class level 2+; the
 * College of Swords pair for a Swords bard. styleOptions is the live
 * /api/fighting-styles list (null while loading) — never a hardcoded
 * list. Exported so the integration test calls the real gate instead
 * of re-implementing it.
 */
export function fightingStyleGate({ classId, subclassName = '', characterLevel = 1, classLevels = null, styleOptions = null }) {
  const level = classLevelFor(classId, characterLevel, classLevels)
  const offersFightingStyle = classId === 'fighter'
    || ((classId === 'paladin' || classId === 'ranger') && level >= 2)
  const fightingStyles = offersFightingStyle
    ? styleOptions
    : (subclassName === 'College of Swords' ? SWORDS_STYLES : null)
  return { fightingStyles, offersFightingStyle }
}

/**
 * Find one fighting style by name in the fetched /api/fighting-styles
 * list (full objects: { key, name, category, effect, source }).
 * Exported so the test calls the real lookup instead of re-implementing
 * it. Returns null when the list has not loaded or names nothing — the
 * picker then shows no effect line rather than an invented one.
 */
export function fightingStyleByName(styleOptions, name) {
  if (!name || !Array.isArray(styleOptions)) return null
  const key = String(name).toLowerCase().trim()
  return styleOptions.find(f => String(f?.name || '').toLowerCase().trim() === key) || null
}

function prettify(id) {
  if (!id) return ''
  return String(id).split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** Spell-key form: the catalog key is the lowercase name ('fire bolt'). */
function spellKeyOf(name) {
  return String(name || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export default function Stage2ClassCalling({
  state, set, classes = null, subclassesByClass = null, subclasses = null,
  speciesEntry = null, featCantrips = [], characterLevel = 1, classLevels = null
}) {
  const classList = useMemo(() => {
    const src = classes || classesData
    const list = Array.isArray(src)
      ? [...src]
      : Object.entries(src).map(([id, c]) => ({ id, ...c }))
    // Alphabetical by display name, so the picker order never depends on
    // classes.json key order (the 7 new classes were appended at the end).
    return list.sort((a, b) =>
      (a.name || prettify(a.id)).localeCompare(b.name || prettify(b.id)))
  }, [classes])
  const classId = state.classId || ''
  const cls = classList.find(c => c.id === classId) || null
  // Gray-out (2026-11-08, MVP scope): classes flagged pcCreatable: false
  // in classes.json stay listed but disabled — never removed, so the
  // count stays 23. A disabled <option> has no hover title in most
  // browsers, so the note rides the Class Tip, not a title or a
  // banner (the banner above the picker was removed 2026-11-09, R2-7).
  // Draft edge (same date): a draft saved before the
  // gray-out keeps its stored classId selected — the select still
  // shows a disabled option as its value, and the server POST/PUT/
  // commit guards refuse it at submit with a named error (the
  // species precedent for deferred-race drafts). Nothing here clears it.

  // God picker options (cleric/paladin): the origin setting's own
  // pantheon when deities.json carries one, else Faerûnian + None.
  // A god picked elsewhere (Stage 5 offers all 55) stays offered
  // here so the stored value never blanks the picker.
  const originSettingName = resolveOriginSetting(state.origin_setting, state.origin_setting_custom)
  const godPantheon = SETTING_PANTHEONS[originSettingName] || 'Faerûnian'
  const godOptions = (() => {
    const names = Object.values(deitiesData).filter(d => d?.pantheon === godPantheon).map(d => d.name)
    if (state.faith && state.faith !== 'None' && !names.includes(state.faith)) names.push(state.faith)
    return ['None', ...names]
  })()
  const selectedGod = godOptions.includes(state.faith)
    ? Object.values(deitiesData).find(d => d.name === state.faith) || null
    : null
  const selectedPact = PACT_BOONS.find(p => p.name === state.pactBoon) || null

  const registrySubs = useMemo(() => {
    if (subclassesByClass && classId) return subclassesByClass[classId] || []
    if (Array.isArray(subclasses)) return subclasses.filter(s => (s.class || s.classId) === classId)
    return []
  }, [subclassesByClass, subclasses, classId])
  const subclassEntry = registrySubs.find(s => s.name === state.subclassName) || null
  const registryUnavailable = !!classId && !(subclassesByClass || subclasses)

  // Subclass picker gate (2026-11-05 polish): only classes that choose
  // their subclass at level 1 show the picker. The level comes from
  // the class record (classes.json subclassLevel), never from the
  // registry entry's selectionLevel — the registry's per-entry value
  // is unreliable (most PHB entries say 3 while the Additional
  // Subclasses homebrew entries say 1/2 for their own sources), so
  // it cannot gate anything.
  const subclassLevel = cls?.subclassLevel ?? null
  const showSubclassPicker = subclassLevel === 1

  const selectedVariant = speciesEntry?.variants?.find(v => v.name === state.subrace) || null
  const innate = selectedVariant?.innateSpells?.length
    ? selectedVariant.innateSpells
    : (speciesEntry?.innateSpells || [])
  const speciesCantrips = innate.filter(s => s && s.level === 0 && s.name).map(s => s.name)
  const speciesPending = innate.filter(s => s && s.choose).map(s =>
    `Choose ${s.choose} cantrip${s.choose === 1 ? '' : 's'}${s.class ? ` from the ${s.class} list` : ''}`)

  const choiceCantrips = Object.entries(state.subclassChoices || {})
    .filter(([k]) => k.toLowerCase().includes('cantrip'))
    .flatMap(([, v]) => (Array.isArray(v) ? v : [v]).filter(Boolean))
  const entryCantrips = Array.isArray(subclassEntry?.grantedCantrips) ? subclassEntry.grantedCantrips : []
  const granted = []
  const seen = new Set()
  const pushGranted = (spell, source) => {
    const key = String(spell).toLowerCase().trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    granted.push({ spell, source })
  }
  speciesCantrips.forEach(s => pushGranted(s, 'species'))
  entryCantrips.forEach(s => pushGranted(s, 'subclass'))
  choiceCantrips.forEach(s => pushGranted(s, 'subclass choice'))
  ;(Array.isArray(featCantrips) ? featCantrips : []).forEach(f =>
    pushGranted(typeof f === 'string' ? f : f?.name, 'feat'))

  // --- Cantrip picker state (2026-11-07 follow-up) ---
  const l1Cantrips = cls?.spellcasting?.cantripsKnown?.[0]
  // Species pending choices: innate entries carrying `choose` (High
  // Elf: choose 1 from the wizard list). They are picks, not grants —
  // the picker offers them, and they count toward the pick total
  // alongside the class picks (the server consumes them first).
  const speciesPendingEntries = innate.filter(s => s && s.choose)
  const speciesPendingTotal = speciesPendingEntries.reduce((n, s) => n + (Number(s.choose) || 0), 0)
  const speciesListClasses = [...new Set(
    speciesPendingEntries.map(s => String(s.class || '').trim().toLowerCase()).filter(Boolean)
  )]
  // Classes whose cantrip lists the picker must fetch: the class list
  // (when the class picks cantrips at level 1) + each species
  // pending-choice list. The endpoint lowercases the class param, so
  // the species entry's class value ('wizard') passes as-is.
  const listClassesKey = (() => {
    const ids = []
    if ((l1Cantrips ?? 0) > 0 && classId) ids.push(classId)
    for (const c of speciesListClasses) if (!ids.includes(c)) ids.push(c)
    return ids.join(',')
  })()
  const needsCantripPicker = (l1Cantrips ?? 0) > 0 || speciesPendingTotal > 0
  const [styleOptions, setStyleOptions] = useState(null)
  const [stylesFailed, setStylesFailed] = useState(false)
  const [cantripData, setCantripData] = useState(null)
  const [cantripFailed, setCantripFailed] = useState(false)

  // Fighting styles: one fetch, the registry list served verbatim
  // and kept WHOLE (name + effect + source). No hardcoded fallback —
  // when unreachable the picker says so. The select below renders
  // names; the picked style's effect renders under it.
  useEffect(() => {
    let live = true
    fetch('/api/fighting-styles')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!live) return
        const styles = Array.isArray(d?.fightingStyles)
          ? d.fightingStyles.filter(f => f?.name)
          : []
        if (styles.length) setStyleOptions(styles)
        else setStylesFailed(true)
      })
      .catch(() => { if (live) setStylesFailed(true) })
    return () => { live = false }
  }, [])

  // Cantrip lists: the class list (+ subclass, so a magus gets its
  // society's list) and each species pending-choice list, unioned
  // below. A magus with no society gets an empty list from the
  // endpoint (cantripsKnown still 2) — the picker shows the
  // pick-your-society note instead of that empty list.
  useEffect(() => {
    if (!needsCantripPicker || !listClassesKey) { setCantripData(null); setCantripFailed(false); return }
    let live = true
    setCantripData(null)
    setCantripFailed(false)
    const classes = listClassesKey.split(',')
    Promise.all(classes.map(c => {
      const qs = new URLSearchParams({ class: c, level: '0' })
      if (c === classId && state.subclassName) qs.set('subclass', state.subclassName)
      return fetch(`/api/spells?${qs.toString()}`).then(r => (r.ok ? r.json() : null)).catch(() => null)
    })).then(results => {
      if (!live) return
      if (results.some(r => !r || !Array.isArray(r.spells))) { setCantripFailed(true); return }
      const byClass = {}
      results.forEach((r, i) => { byClass[classes[i]] = r })
      setCantripData(byClass)
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsCantripPicker, listClassesKey, state.subclassName])

  // Granted-cantrip sync: the stored list (state.knownCantrips) is
  // the FINAL list the commit validator requires — class picks +
  // granted + species-choice picks. A granted cantrip lands in it the
  // moment its source appears and leaves the moment its source goes
  // away; the player's own picks are never touched. Runs only when
  // the granted set itself changes, so a toggle never loops it.
  const grantedKeyString = granted.map(g => spellKeyOf(g.spell)).join('|')
  const grantedKeys = grantedKeyString ? grantedKeyString.split('|') : []
  const prevGrantedRef = useRef([])
  useEffect(() => {
    const nextGranted = grantedKeyString ? grantedKeyString.split('|') : []
    const prevGranted = prevGrantedRef.current || []
    prevGrantedRef.current = nextGranted
    if (nextGranted.join('|') === prevGranted.join('|')) return
    set(prev => {
      const cur = Array.isArray(prev.knownCantrips) ? prev.knownCantrips : []
      const prevSet = new Set(prevGranted)
      const keptPicks = cur.filter(k => !prevSet.has(spellKeyOf(k)))
      const next = [...new Set([...nextGranted, ...keptPicks])]
      if (next.join('|') === cur.join('|')) return prev
      return { ...prev, knownCantrips: next }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grantedKeyString])

  const cantripOptions = useMemo(() => {
    if (!cantripData) return null
    const seen = new Map()
    for (const c of Object.keys(cantripData)) {
      for (const s of cantripData[c]?.spells || []) {
        if (!s?.key || seen.has(s.key)) continue
        seen.set(s.key, s)
      }
    }
    return [...seen.values()].sort((a, b) => (a.name || a.key).localeCompare(b.name || b.key))
  }, [cantripData])
  const grantedKeySet = new Set(grantedKeys)
  const knownList = Array.isArray(state.knownCantrips) ? state.knownCantrips : []
  const classPickKeys = knownList.filter(k => !grantedKeySet.has(spellKeyOf(k)))
  const toggleCantrip = (key) => {
    const picks = [...classPickKeys]
    const at = picks.indexOf(key)
    if (at >= 0) picks.splice(at, 1)
    else if (picks.length < maxCantripPicks) picks.push(key)
    else return
    update({ knownCantrips: [...new Set([...grantedKeys, ...picks])] })
  }

  // Fighting-style gate (2026-11-08, edit-mode L2 picker): fighter at
  // L1, paladin/ranger at class level 2+ (level props from the shell —
  // the row's level in edit mode, 1 by construction in create mode).
  const { fightingStyles, offersFightingStyle } = fightingStyleGate({
    classId, subclassName: subclassEntry?.name, characterLevel, classLevels, styleOptions
  })
  const showFightingStylePicker = fightingStyles != null
    || (offersFightingStyle && (styleOptions === null || stylesFailed))
  // The gate hands back either the fetched style objects or the
  // College of Swords name pair — the select renders names either
  // way, and the effect line below looks the pick up in the fetched
  // objects (the Swords pair is in the fetched 10 when it loaded).
  const fightingStyleNames = (fightingStyles || []).map(f => typeof f === 'string' ? f : f?.name).filter(Boolean)
  const selectedStyle = fightingStyleByName(styleOptions, state.fightingStyle)
  // Class cantrip count: classes.json first (it renders before any
  // fetch), the endpoint's cantripsKnown once it lands — the two
  // agree at level 1 (recon §(b)); the endpoint wins when it lands
  // because the server enforces its count.
  const jsonCantripCount = l1Cantrips ?? 0
  const endpointCantripCount = (cantripData && classId && typeof cantripData[classId]?.cantripsKnown === 'number')
    ? cantripData[classId].cantripsKnown
    : null
  const classCantripCount = endpointCantripCount ?? jsonCantripCount
  const maxCantripPicks = classCantripCount + speciesPendingTotal

  // The class facts (hit die, saves, primary ability, spellcasting,
  // L1 cantrip count) live ONLY in the description tooltip, never on
  // the card — the card reads as lore + how the class plays.
  const factsTip = cls ? [
    `Hit die d${cls.hitDie}.`,
    cls.savingThrows?.length ? `Saving throws: ${cls.savingThrows.map(prettify).join(', ')}.` : '',
    cls.primaryAbility?.length ? `Primary ability: ${cls.primaryAbility.map(prettify).join(', ')}.` : '',
    cls.spellcasting
      ? `Spellcasting (${prettify(cls.spellcasting.ability)}). Cantrips known at level 1: ${l1Cantrips ?? '—'}.`
      : 'No spellcasting.',
    'Cantrips known here is the class count only — granted cantrips in the section below never count against it.',
  ].filter(Boolean).join(' ') : ''

  const update = (patch) => set({ ...state, ...patch })
  // A class/subclass change clears the cantrip picks (the old list
  // is not learnable under the new class/society) — and resets the
  // granted-sync's memory, so the effect re-merges the granted
  // cantrips on the next render even when the granted set itself did
  // not change across the switch.
  const pickClass = (id) => {
    prevGrantedRef.current = []
    update({
      classId: id, subclassName: '', fightingStyle: '', subclassChoices: {}, knownCantrips: [], subclassOriginExplanation: '',
      // The pact belongs to the warlock — a class change drops it.
      // Faith is NOT cleared: it is the shared Stage 5 field, and a
      // cleric who becomes a fighter keeps their god.
      pactBoon: ''
    })
  }
  const pickSubclass = (name) => {
    prevGrantedRef.current = []
    // A new subclass is a new tradition — its origin explanation is
    // written for the old one, so it clears with the pick.
    update({ subclassName: name, subclassChoices: {}, knownCantrips: [], subclassOriginExplanation: '' })
  }
  const setChoice = (key, value) => update({
    subclassChoices: { ...(state.subclassChoices || {}), [key]: value }
  })
  const toggleMultiChoice = (key, option, maxCount) => {
    const cur = Array.isArray((state.subclassChoices || {})[key]) ? [...(state.subclassChoices || {})[key]] : []
    const at = cur.indexOf(option)
    if (at >= 0) cur.splice(at, 1)
    else if (!maxCount || cur.length < maxCount) cur.push(option)
    setChoice(key, cur)
  }

  const selectStyle = {
    width: '100%', padding: '10px 12px', fontFamily: 'var(--serif)',
    fontSize: 16, background: 'var(--paper, #fff)', color: 'var(--ink, #222)',
    border: '1px solid var(--rule, #888)', borderRadius: 6
  }
  const labelStyle = { display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '18px 0 6px' }
  // One shared checkbox-row style (creator test-notes #13/#18/#19):
  // a flex row keeps the checkbox on the same horizontal plane as
  // its name, in every picker on this stage. The checkbox never
  // shrinks; the label text takes the rest of the row.
  const checkRowStyle = { display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--serif)', fontSize: 15, margin: '4px 0' }
  const checkInputStyle = { flex: '0 0 auto' }

  return (
    <div className="card">
      <div className="eyebrow">Stage 2 of 6</div>
      <h1 className="h-step">Class &amp; Calling</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Pick a class. If it chooses a subclass at level 1, you pick that here too — the rest wait until you reach that level. Nothing here is pre-picked: every picker starts empty, so what you see is what you chose.
      </p>

      <label style={labelStyle} htmlFor="stage2-class">
        Class
        <Tip text="What you are in play: hit die, saving throws, and spellcasting (if any). Your class can never change later, but your subclass choice here is a calling — its features arrive when you reach its selection level, not all at level 1. Some classes are coming after the MVP and can't be picked yet." />
      </label>
      <select id="stage2-class" style={selectStyle} value={classId} onChange={e => pickClass(e.target.value)}>
        <option value="">Choose a class…</option>
        {classList.map(c => (
          <option key={c.id} value={c.id} disabled={c.pcCreatable === false}>{c.name}</option>
        ))}
      </select>

      {cls && (
        <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>
          {cls.description || ''}
          <Tip text={factsTip} />
        </div>
      )}

      <label style={labelStyle} htmlFor="stage2-subclass">
        Subclass (calling)
        <Tip text="The path within your class. It locks your subclass features and spell access when you reach its selection level, and it cannot be swapped freely later — but picking it now does not grant level-3 features at level 1." />
      </label>
      {!classId ? (
        <div className="help" style={{ fontStyle: 'normal' }}>
          Pick a class first; its registry subclasses will list here.
        </div>
      ) : !showSubclassPicker ? (
        <div className="help" style={{ fontStyle: 'normal' }}>
          {classId === 'warlock' && subclassLevel === 3
            ? 'Your patron (subclass) — Archfey, Fiend, and the rest — is chosen at level 3.'
            : subclassLevel != null
              ? `You choose your subclass at level ${subclassLevel} — nothing to pick here yet.`
              : 'This class chooses its subclass later — nothing to pick here yet.'}
        </div>
      ) : registryUnavailable ? (
        <div className="help" style={{ fontStyle: 'normal' }}>
          Couldn&apos;t load the subclass list — check your connection and refresh.
        </div>
      ) : registrySubs.length === 0 ? (
        <div className="help" style={{ fontStyle: 'normal' }}>
          {`No subclasses listed for ${cls?.name || classId} yet.`}
        </div>
      ) : (
        <select id="stage2-subclass" style={selectStyle} value={state.subclassName || ''} onChange={e => pickSubclass(e.target.value)}>
          <option value="">Choose a subclass…</option>
          {registrySubs.map(s => (
            <option key={s.key || s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
      )}
      {subclassEntry && (
        <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>
          {subclassEntry.name} takes effect at level {cls?.subclassLevel ?? '—'}
          {subclassEntry.description ? ` — ${subclassEntry.description}` : ''}
          {subclassOriginSuffix(subclassEntry)}
        </div>
      )}
      {subclassNeedsOriginExplanation(subclassEntry) && (
        <>
          <label style={labelStyle} htmlFor="stage2-subclass-origin">
            Subclass origin
            <Tip text="This subclass comes from outside the Forgotten Realms. In a sentence or two, say how its tradition reached your character here — a teacher who crossed over, a book, a patron, a pact. The DM reads it. Required before you can commit; pick a Forgotten Realms subclass instead if you'd rather not." />
          </label>
          <textarea
            id="stage2-subclass-origin"
            className="input"
            value={state.subclassOriginExplanation || ''}
            onChange={e => update({ subclassOriginExplanation: e.target.value })}
            maxLength={500}
            rows={3}
            placeholder={`How did the ${subclassEntry.name} tradition reach your character in the Forgotten Realms?`}
          />
        </>
      )}

      {(classId === 'cleric' || classId === 'paladin') && (
        <>
          <label style={labelStyle} htmlFor="stage2-faith">
            God
            <Tip text="The god you serve — or None, if you serve none. A cleric's power comes through a god; a paladin's comes through an oath, but the god they honor still shapes how the world answers them. This is the same Faith Stage 5 asks about, so a pick here carries through — and it changes nothing mechanical, so it can change later in edit mode." />
          </label>
          <select id="stage2-faith" style={selectStyle} value={state.faith || ''} onChange={e => update({ faith: e.target.value })}>
            <option value="">Choose a god…</option>
            {godOptions.map(g => (<option key={g} value={g}>{g}</option>))}
          </select>
          {selectedGod && (
            <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>
              {selectedGod.description || ''}{selectedGod.domain ? ` — ${selectedGod.domain}` : ''}{selectedGod.alignment ? ` (${selectedGod.alignment})` : ''}
            </div>
          )}
        </>
      )}

      {classId === 'warlock' && (
        <>
          <label style={labelStyle} htmlFor="stage2-pact-boon">
            Pact Boon (Eldritch Invocation)
            <Tip text="Your pact boon — the one Eldritch Invocation you gain at level 1. It shapes what your warlock can do from the start: a weapon, a familiar, or a book of borrowed magic. It locks at creation like the rest of this stage, and later invocations build on it." />
          </label>
          <select id="stage2-pact-boon" style={selectStyle} value={state.pactBoon || ''} onChange={e => update({ pactBoon: e.target.value })}>
            <option value="">Choose a pact boon…</option>
            {PACT_BOONS.map(p => (<option key={p.name} value={p.name}>{p.name}</option>))}
          </select>
          {selectedPact && (
            <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>
              {selectedPact.description}
            </div>
          )}
        </>
      )}

      {showFightingStylePicker && (
        <>
          <label style={labelStyle} htmlFor="stage2-fighting-style">
            Fighting style
            <Tip text="A permanent combat style. It locks in how you fight with weapons and cannot be changed freely later — pick the one that matches the weapons you plan to use, not the one that sounds strongest in isolation." />
          </label>
          {offersFightingStyle && !fightingStyles ? (
            <div className="help" style={{ fontStyle: 'normal' }}>
              {stylesFailed
                ? 'Couldn\'t load the fighting-style list — check your connection and refresh.'
                : 'Loading fighting styles…'}
            </div>
          ) : (
            <>
              <select id="stage2-fighting-style" style={selectStyle} value={state.fightingStyle || ''} onChange={e => update({ fightingStyle: e.target.value })}>
                <option value="">Choose a fighting style…</option>
                {fightingStyleNames.map(f => (<option key={f} value={f}>{f}</option>))}
              </select>
              {selectedStyle?.effect && (
                <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>
                  {selectedStyle.effect}
                </div>
              )}
            </>
          )}
        </>
      )}
      {(subclassEntry?.choices || []).map(ch => {
        const cur = (state.subclassChoices || {})[ch.key]
        const multi = ch.maxCount && ch.maxCount > 1
        return (
          <div key={ch.key}>
            <label style={labelStyle} htmlFor={`stage2-choice-${ch.key}`}>
              {prettify(ch.key)}{ch.maxCount ? ` (choose up to ${ch.maxCount})` : ''}
              <Tip text={`A choice your subclass asks for${ch.level ? ` at level ${ch.level}` : ''}. ${ch.note || 'It locks when picked; later picks in the same list do not overwrite it silently.'}`} />
            </label>
            {!ch.options ? (
              <div className="help" style={{ fontStyle: 'normal' }}>
                This choice is recorded in words, not from a fixed list — note it at Review.
              </div>
            ) : multi ? (
              <div>
                {(ch.options || []).map(o => (
                  <label key={o} style={checkRowStyle}>
                    <input type="checkbox" style={checkInputStyle} checked={Array.isArray(cur) && cur.includes(o)} onChange={() => toggleMultiChoice(ch.key, o, ch.maxCount)} /> {o}
                  </label>
                ))}
              </div>
            ) : (
              <select id={`stage2-choice-${ch.key}`} style={selectStyle} value={typeof cur === 'string' ? cur : ''} onChange={e => setChoice(ch.key, e.target.value)}>
                <option value="">Choose…</option>
                {(ch.options || []).map(o => (<option key={o} value={o}>{o}</option>))}
              </select>
            )}
          </div>
        )
      })}

      {needsCantripPicker && (
        <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--rule, #888)' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 19, margin: 0 }}>
            Cantrips — pick {maxCantripPicks}
            <Tip text={`Pick ${classCantripCount} cantrip${classCantripCount === 1 ? '' : 's'} from your class list${speciesPendingTotal ? `, plus ${speciesPendingTotal} species choice${speciesPendingTotal === 1 ? '' : 's'}` : ''}. Granted cantrips never count against these picks — one already granted shows checked and grayed out, never hidden, and it is never picked again here.`} />
          </h2>
          <p className="help" style={{ fontStyle: 'normal' }}>
            {classPickKeys.length} of {maxCantripPicks} picked
            {speciesPendingTotal > 0 ? ` (${classCantripCount} class + ${speciesPendingTotal} species choice${speciesPendingTotal === 1 ? '' : 's'})` : ''}.
            Granted cantrips never count against these picks.
          </p>
          {classId === 'magus' && !state.subclassName ? (
            <div className="help" style={{ fontStyle: 'normal' }}>
              Pick your society first — a magus&apos;s cantrips come from its society&apos;s list, and there is no list to offer until then.
            </div>
          ) : !cantripData ? (
            <div className="help" style={{ fontStyle: 'normal' }}>
              {cantripFailed
                ? 'Couldn\'t load the cantrip list — check your connection and refresh.'
                : 'Loading cantrips…'}
            </div>
          ) : cantripOptions.length === 0 ? (
            <div className="help" style={{ fontStyle: 'normal' }}>
              No cantrips listed for this class yet.
            </div>
          ) : (
            <div>
              {cantripOptions.map(s => {
                const grantedHere = grantedKeySet.has(spellKeyOf(s.key))
                const grantedSource = grantedHere
                  ? granted.find(g => spellKeyOf(g.spell) === spellKeyOf(s.key))?.source || 'granted'
                  : null
                const checked = grantedHere || classPickKeys.includes(s.key)
                const disabled = grantedHere || (!checked && classPickKeys.length >= maxCantripPicks)
                return (
                  <label key={s.key} style={{ ...checkRowStyle, opacity: grantedHere ? 0.6 : 1 }}>
                    <input type="checkbox" style={checkInputStyle} checked={checked} disabled={disabled} onChange={() => toggleCantrip(s.key)} /> {s.name}
                    <Tip text={`${s.description || s.name}${grantedHere ? ` Granted by ${grantedSource} — it never counts against your ${maxCantripPicks} picks.` : ''}`} />
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      {(granted.length > 0 || speciesPending.length > 0) && (
        <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--rule, #888)' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 19, margin: 0 }}>
            Granted cantrips
            <Tip text="Cantrips you are GRANTED — from your species, your subclass, or a feat. These never count against your class cantrips known or prepared, caster or not. A fighter with a granted cantrip still casts it; it just does not use up a class cantrip slot." />
          </h2>
          <p className="help" style={{ fontStyle: 'normal' }}>
            These are granted, not chosen from your class list — they never count against cantrips known or prepared.
          </p>
          {isDeferredSpecies(speciesEntry) && (
            <p className="help" style={{ fontStyle: 'normal' }}>
              {deferredNoteFor(speciesEntry)} — these granted cantrips come with the species and are shown, not picked.
            </p>
          )}
          {granted.length > 0 && (
            <ul style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>
              {granted.map(g => (<li key={`${g.source}-${g.spell}`}>{g.spell} <span style={{ opacity: 0.75 }}>— granted by {g.source}</span></li>))}
            </ul>
          )}
          {speciesPending.length > 0 && (
            <div className="help" style={{ fontStyle: 'normal' }}>
              Still to choose: {speciesPending.join('; ')} — a pending choice is shown, never filled with an invented spell.
            </div>
          )}
          {subclassEntry && entryCantrips.length === 0 && (
            <div className="help" style={{ fontStyle: 'normal' }}>
              If this subclass grants a cantrip that is not listed above, it will appear here once it is added.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
