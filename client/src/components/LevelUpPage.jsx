import { useState, useEffect } from 'react'
import classesData from '../data/classes.json'
import spellsData from '../data/spells/index.js'
import featsData from '../data/feats.json'
import { featAbilityOptions, featPickBlockReason, characterSaveProficiencies } from './featPickHelpers.js'
import { SPELLBOOK_START_SIZE } from './spellbookHelpers.js'

// Multiclass list (2026-11-08, prerequisites removed — all classes
// multiclass freely): every class key in classes.json, alphabetical
// by display name. Deferred classes (magus / blackguard / scholar —
// pcCreatable: false in classes.json) stay listed but disabled
// below; the server's POST /level-up guard is the enforcement, and
// the flag rides classes.json, the same source the creator picker
// reads. Keys, not display names: the server lowercases the submitted
// class to match its own keys, so 'Blood Hunter' would arrive as
// 'blood hunter' and match nothing — the submitted `class` stays the
// capitalized key ('Blood_hunter', the server's own convention) and
// the pretty name rides `displayName` for the render only.
const ALL_CLASSES = Object.keys(classesData)
  .sort((a, b) => (classesData[a]?.name || a).localeCompare(classesData[b]?.name || b))

// Hit dice (2026-11-08, multiclass removal): all 23, server values
// (levelProgression HIT_DICE). The old 14-entry map defaulted the
// other nine to 8 — wrong for warden 10, scholar 6, duelist 10,
// blackguard 10, blood_hunter 10 — a real HP bug on a multiclass take.
const HIT_DICE = {
  artificer: 8,
  barbarian: 12,
  bard: 8,
  blood_hunter: 10,
  cleric: 8,
  druid: 8,
  duelist: 10,
  fighter: 10,
  magus: 8,
  monk: 8,
  paladin: 10,
  pugilist: 8,
  ranger: 10,
  rogue: 8,
  scholar: 6,
  sorcerer: 6,
  spellshot: 8,
  warlock: 8,
  warden: 10,
  warlord: 8,
  wizard: 6,
  blackguard: 10
}

// class-audit gap 5: pick the infusion plans an artificer level grants.
// The available plans (by level) and the ones already known come from
// GET /api/character/artificer-plans/:id?level=N; the server validates the
// picks again at submit. Generic plans ("Common magic item", "Uncommon /
// Rare Wondrous Item") need the item named.
function ArtificerPlanPicker({ characterId, level, due, picks, setPicks, catalog, setCatalog }) {
  useEffect(() => {
    let cancelled = false
    fetch(`/api/character/artificer-plans/${characterId}?level=${level}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setCatalog(d) })
      .catch(() => { if (!cancelled) setCatalog(null) })
    return () => { cancelled = true }
  }, [characterId, level, setCatalog])
  const known = new Set(catalog?.known || [])
  const isPicked = (name) => picks.some(p => p.plan === name)
  const toggle = (plan) => {
    if (isPicked(plan.name)) setPicks(picks.filter(p => p.plan !== plan.name))
    else if (picks.length < due) setPicks([...picks, { plan: plan.name, detail: '' }])
  }
  const setDetail = (name, detail) => setPicks(picks.map(p => (p.plan === name ? { ...p, detail } : p)))
  return (
    <section className="choice-section">
      <h3>Infusion Plans</h3>
      <p>Artificer level {level} lets you learn {due} new plan{due === 1 ? '' : 's'} ({picks.length} of {due} chosen). You will know {(catalog?.known?.length ?? 0) + picks.length} of {catalog?.max ?? '?'} after this level.</p>
      {!catalog && <p style={{ color: '#888' }}>Loading plans…</p>}
      {catalog && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {catalog.available.filter(p => p.needsDetail || !known.has(p.name)).map(p => {
            const picked = isPicked(p.name)
            return (
              <div key={p.name}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: 'auto', flex: '0 0 auto', margin: 0 }} checked={picked}
                    disabled={!picked && picks.length >= due} onChange={() => toggle(p)} />
                  <span>{p.name}{p.attunement === true ? ' (requires attunement)' : ''}</span>
                </label>
                {picked && p.needsDetail && (
                  <input type="text" placeholder="Name the item (required)" value={picks.find(x => x.plan === p.name)?.detail || ''}
                    onChange={e => setDetail(p.name, e.target.value)}
                    style={{ marginLeft: 26, marginTop: 4, padding: '0.3rem 0.5rem', width: 'calc(100% - 26px)' }} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// class-audit item 2: Eldritch Invocations on a warlock level. Options and
// eligibility come from GET /api/character/invocations/:id?level=N (the new
// Warlock level); the server validates again at submit. An option whose
// only missing prerequisite is a Pact or invocation picked in this same
// level-up unlocks (the "learn it at the same time" rule). A repeatable
// invocation (Agonizing Blast, Lessons of the First Ones, …) names its
// cantrip or Origin feat. One optional replacement per warlock level.
const PACT_KEY = { blade: 'pact_of_the_blade', chain: 'pact_of_the_chain', tome: 'pact_of_the_tome' }
function invocationSelectable(option, level, picks) {
  if (option.eligible) return true
  if (level < option.minLevel || option.choiceKind) return false
  const req = option.requires || {}
  const picked = (k) => picks.some(p => p.key === k)
  if (req.pact) return picked(PACT_KEY[req.pact])
  if (req.invocation) return picked(req.invocation)
  return false
}
function InvocationPicker({ characterId, level, due, canReplace, picks, setPicks, replacement, setReplacement, catalog, setCatalog }) {
  useEffect(() => {
    let cancelled = false
    fetch(`/api/character/invocations/${characterId}?level=${level}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setCatalog(d) })
      .catch(() => { if (!cancelled) setCatalog(null) })
    return () => { cancelled = true }
  }, [characterId, level, setCatalog])
  const options = catalog?.options || []
  const pickOf = (key) => picks.find(p => p.key === key)
  const toggle = (o) => {
    if (pickOf(o.key)) setPicks(picks.filter(p => p.key !== o.key))
    else if (picks.length < due) setPicks([...picks, { key: o.key, choice: o.choiceKind ? (o.choices?.[0] || '') : null }])
  }
  const setChoice = (key, choice) => setPicks(picks.map(p => (p.key === key ? { ...p, choice } : p)))
  const fromOptions = catalog?.held || []
  const toOptions = options.filter(o => o.eligible)
  return (
    <section className="choice-section">
      <h3>Eldritch Invocations</h3>
      {due > 0 && (
        <p>Warlock level {level} knows {catalog?.known ?? '?'} invocation{catalog?.known === 1 ? '' : 's'}. Learn {due} now ({picks.length} of {due} chosen).</p>
      )}
      {!catalog && <p style={{ color: '#888' }}>Loading invocations…</p>}
      {catalog && due > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {options.map(o => {
            const picked = !!pickOf(o.key)
            const selectable = invocationSelectable(o, level, picks)
            return (
              <div key={o.key} style={{ opacity: selectable || picked ? 1 : 0.5 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: selectable ? 'pointer' : 'default' }}>
                  <input type="checkbox" style={{ width: 'auto', flex: '0 0 auto', margin: '0.2rem 0 0' }} checked={picked}
                    disabled={!picked && (!selectable || picks.length >= due)} onChange={() => toggle(o)} />
                  <span>
                    <strong>{o.name}</strong>
                    <span style={{ color: '#aaa' }}> — {o.effect}</span>
                    {!selectable && !picked && o.reason && <span style={{ display: 'block', fontSize: '0.8rem', color: '#888' }}>{o.reason}</span>}
                  </span>
                </label>
                {picked && o.choiceKind && (
                  <select value={pickOf(o.key)?.choice || ''} onChange={e => setChoice(o.key, e.target.value)}
                    style={{ marginLeft: 26, marginTop: 4 }}>
                    {(o.choices || []).map(c => <option key={c} value={c}>{o.choiceNames?.[c] || c}</option>)}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}
      {catalog && canReplace && fromOptions.length > 0 && (
        <div style={{ marginTop: '0.8rem' }}>
          <p style={{ marginBottom: 4 }}>Optionally, replace one invocation you know with another you qualify for:</p>
          <select value={replacement?.fromIndex ?? ''} onChange={e => setReplacement(e.target.value === '' ? null : { fromIndex: Number(e.target.value), to: replacement?.to || '' , toChoice: replacement?.toChoice || '' })}>
            <option value="">Keep all my invocations</option>
            {fromOptions.map((h, i) => <option key={`${h.key}-${i}`} value={i}>{h.name}{h.choiceName ? ` (${h.choiceName})` : ''}</option>)}
          </select>
          {replacement && (
            <>
              <span> → </span>
              <select value={replacement.to} onChange={e => {
                const o = toOptions.find(x => x.key === e.target.value)
                setReplacement({ ...replacement, to: e.target.value, toChoice: o?.choiceKind ? (o.choices?.[0] || '') : '' })
              }}>
                <option value="">Choose the new invocation…</option>
                {toOptions.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
              </select>
              {(() => {
                const o = toOptions.find(x => x.key === replacement.to)
                if (!o?.choiceKind) return null
                return (
                  <select value={replacement.toChoice} onChange={e => setReplacement({ ...replacement, toChoice: e.target.value })} style={{ marginLeft: 6 }}>
                    {(o.choices || []).map(c => <option key={c} value={c}>{o.choiceNames?.[c] || c}</option>)}
                  </select>
                )
              })()}
            </>
          )}
        </div>
      )}
    </section>
  )
}

function LevelUpPage({ character, onLevelUp, onBack }) {
  const [levelUpInfo, setLevelUpInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Step state
  const [step, setStep] = useState('class-selection') // 'class-selection', 'choices', or 'review'
  const [selectedClassOption, setSelectedClassOption] = useState(null)

  // Form state
  const [hpChoice, setHpChoice] = useState('average')
  const [hpRoll, setHpRoll] = useState(null)
  const [asiPoints, setAsiPoints] = useState(2)
  const [asiDistribution, setAsiDistribution] = useState({
    str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0
  })
  // 'asi' (default) or 'feat' — selected when the character reaches an ASI level
  const [asiOrFeat, setAsiOrFeat] = useState('asi')
  const [selectedFeatKey, setSelectedFeatKey] = useState('')
  const [selectedFeatAbility, setSelectedFeatAbility] = useState('')
  // class-audit gap 5: the artificer's infusion-plan picks at a level that
  // grants plans — { plan, detail } each; the catalog comes from the server.
  const [planPicks, setPlanPicks] = useState([])
  const [planCatalog, setPlanCatalog] = useState(null)
  // class-audit item 2: warlock invocation picks ({ key, choice }), the
  // optional replacement ({ fromIndex, to, toChoice }) and the catalog.
  const [invocationPicks, setInvocationPicks] = useState([])
  const [invocationReplacement, setInvocationReplacement] = useState(null)
  const [invocationCatalog, setInvocationCatalog] = useState(null)
  const [selectedSubclass, setSelectedSubclass] = useState('')

  // Spell selection state (for spells step)
  const [selectedNewCantrips, setSelectedNewCantrips] = useState([])
  const [selectedNewSpells, setSelectedNewSpells] = useState([])
  // V3 (2026-11-08): a multiclass wizard may start with an EMPTY
  // spellbook — no spells picked now, spells copied in later from
  // spellbooks found in play. The server accepts an explicit [].
  const [startEmptyBook, setStartEmptyBook] = useState(false)
  const [swapSpell, setSwapSpell] = useState(null) // { old: string, new: string }
  const [showSwapPanel, setShowSwapPanel] = useState(false)
  const [spellFilterLevel, setSpellFilterLevel] = useState('all')
  const [spellSearchText, setSpellSearchText] = useState('')

  // Progression (Phase 5): ancestry feat choice at L3/L7/L13/L18
  const [selectedAncestryFeatId, setSelectedAncestryFeatId] = useState(null)

  // The spells this class may learn at its new level, from GET /api/spells
  // (canLearnSpell enforces the slot table). classes.json carries no
  // spellSlotsByLevel, so the old client-side count found no spells for any
  // class but warlock — the wizard's +2 picker was always empty.
  const [serverSpellList, setServerSpellList] = useState(null)

  useEffect(() => {
    fetchLevelUpInfo()
  }, [character.id])

  useEffect(() => {
    const cls = selectedClassOption?.class?.toLowerCase()
    if (!cls) { setServerSpellList(null); return }
    const sub = selectedClassOption.subclass || selectedSubclass || ''
    let cancelled = false
    fetch(`/api/spells?class=${encodeURIComponent(cls)}&level=${selectedClassOption.newLevel || 1}${sub ? `&subclass=${encodeURIComponent(sub)}` : ''}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setServerSpellList(Array.isArray(d?.spells) ? d.spells : null) })
      .catch(() => { if (!cancelled) setServerSpellList(null) })
    return () => { cancelled = true }
  }, [selectedClassOption, selectedSubclass])

  useEffect(() => {
    if (selectedClassOption) {
      setHpChoice('average')
      setHpRoll(null)
      setSelectedSubclass('')
      setAsiPoints(2)
      setAsiDistribution({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 })
      setSelectedNewCantrips([])
      setSelectedNewSpells([])
      setStartEmptyBook(false)
      setSwapSpell(null)
      setShowSwapPanel(false)
      setSpellFilterLevel('all')
      setSpellSearchText('')
      setSelectedAncestryFeatId(null)
    }
  }, [selectedClassOption])

  const fetchLevelUpInfo = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/character/level-up-info/${character.id}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to get level-up info')
      }
      const data = await response.json()
      setLevelUpInfo(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const currentAbilityScores = JSON.parse(character.ability_scores || '{}')

  // Feat picker context (repo-check-fixes-feats): what the 2024 book's
  // prerequisites are judged against at this level-up. The server
  // level-up route re-checks the same rules.
  const heldFeats = (() => {
    try { const v = typeof character.feats === 'string' ? JSON.parse(character.feats || '[]') : character.feats; return Array.isArray(v) ? v : [] } catch { return [] }
  })()
  const startingClassKey = String(character.class || '').toLowerCase().trim().replace(/\s+/g, '_')
  const featPickCtx = {
    level: levelUpInfo?.newLevel || ((character.level || 0) + 1),
    scores: currentAbilityScores,
    heldFeats,
    hasFightingStyle: !!(character.fighting_style && String(character.fighting_style).trim())
      || heldFeats.some((f) => f && typeof f === 'object' && (f.category === 'fighting_style' || featsData[f.key]?.category === 'Fighting Style')),
    saveProficiencies: characterSaveProficiencies(classesData[startingClassKey]?.savingThrows, heldFeats),
  }

  const getModifier = (score) => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : mod.toString()
  }

  // Build all multiclass options (2026-11-08: prerequisites removed —
  // every class is offered, no ability-score gate). Deferred classes
  // ride pcCreatable false from classes.json and render disabled.
  const getAllMulticlassOptions = () => {
    if (!levelUpInfo) return []

    const existingClassNames = levelUpInfo.classLevels.map(c => c.class.toLowerCase())
    const conMod = Math.floor((currentAbilityScores.con - 10) / 2)

    return ALL_CLASSES.filter(classKey => !existingClassNames.includes(classKey))
      .map(classKey => {
        const className = classKey.charAt(0).toUpperCase() + classKey.slice(1)
        const hitDie = HIT_DICE[classKey] || 8
        const pcCreatable = classesData[classKey]?.pcCreatable !== false
        const pcCreatableNote = classesData[classKey]?.pcCreatableNote || null
        const classInfo = classesData[classKey]
        const subclassLevel = classInfo?.subclassLevel || 3

        return {
          type: 'multiclass',
          class: className,
          displayName: classesData[classKey]?.name || className,
          pcCreatable,
          pcCreatableNote,
          currentLevel: 0,
          newLevel: 1,
          subclass: null,
          newFeatures: classInfo?.featuresByLevel?.[1]?.map(f => f.name) || [],
          choices: {
            needsSubclass: subclassLevel === 1,
            needsASI: false,
            newCantrips: 0,
            // Multiclass-into-wizard starts a 1st-level wizard's book:
            // 6 spells (settled 2026-11-07 — the same 6 a wizard made
            // from scratch starts with). The server caps the seed at
            // 6 and refuses an empty one; the picker below requires
            // all 6 before Review, the same shape as the in-class +2
            // picker. Every other multiclass takes 0 here — their
            // counts come from the level-up envelope, not this list.
            newSpellsKnown: className.toLowerCase() === 'wizard' ? SPELLBOOK_START_SIZE : 0
          },
          hpGain: {
            hitDie,
            conMod,
            average: Math.floor(hitDie / 2) + 1 + conMod,
            minimum: 1 + conMod,
            maximum: hitDie + conMod
          },
          subclassLevel
        }
      })
  }

  const rollHitDie = () => {
    if (!selectedClassOption) return
    const hitDie = selectedClassOption.hpGain.hitDie
    const roll = Math.floor(Math.random() * hitDie) + 1
    setHpRoll(roll)
    setHpChoice('roll')
  }

  const handleAsiChange = (ability, delta) => {
    const currentValue = currentAbilityScores[ability] || 10
    const currentIncrease = asiDistribution[ability]
    const newIncrease = currentIncrease + delta

    if (newIncrease < 0 || newIncrease > 2) return
    if (currentValue + newIncrease > 20) return

    const currentTotalUsed = Object.values(asiDistribution).reduce((a, b) => a + b, 0)
    const newTotalUsed = currentTotalUsed + delta

    if (newTotalUsed > 2 || newTotalUsed < 0) return

    setAsiDistribution(prev => ({
      ...prev,
      [ability]: newIncrease
    }))
    setAsiPoints(2 - newTotalUsed)
  }

  const getSubclassOptions = (className = null) => {
    const classKey = (className || selectedClassOption?.class || character.class).toLowerCase()
    const classInfo = classesData[classKey]
    return classInfo?.subclasses || []
  }

  // Get subclass features for a specific level
  const getSubclassFeatures = (className, subclassName, level) => {
    if (!subclassName) return []
    const classKey = className.toLowerCase()
    const classInfo = classesData[classKey]
    const subclass = classInfo?.subclasses?.find(s => s.name === subclassName)
    return subclass?.featuresByLevel?.[level] || []
  }

  // Get domain/subclass spells for a specific level
  const getSubclassSpells = (className, subclassName, level) => {
    if (!subclassName) return []
    const classKey = className.toLowerCase()
    const classInfo = classesData[classKey]
    const subclass = classInfo?.subclasses?.find(s => s.name === subclassName)
    // Look for domainSpells, expandedSpells, or similar
    const spellList = subclass?.domainSpells || subclass?.expandedSpells || subclass?.patronSpells || {}
    return spellList[level] || []
  }

  // Determine if this class needs the spells step
  const needsSpellsStep = () => {
    if (!selectedClassOption) return false
    const choices = selectedClassOption.choices || {}
    return choices.newCantrips > 0 || choices.newSpellsKnown > 0
  }

  // Check if this class is a "known" caster (picks specific spells at level-up)
  const isKnownCaster = (className) => {
    const key = className?.toLowerCase()
    return ['bard', 'ranger', 'sorcerer', 'warlock'].includes(key)
  }

  // Check if this class is a Wizard (adds spells to spellbook)
  const isWizard = (className) => className?.toLowerCase() === 'wizard'

  // Get available cantrips for a class
  const getAvailableCantrips = (className) => {
    const key = className?.toLowerCase()
    const classCantrips = spellsData.cantrips[key] || []
    const existingCantrips = JSON.parse(character.known_cantrips || '[]')
    return classCantrips.filter(c => !existingCantrips.includes(c.name) && !selectedNewCantrips.includes(c.name))
  }

  // Get available spells for a class at specific levels
  const getAvailableSpells = (className) => {
    const key = className?.toLowerCase()
    const existingSpells = JSON.parse(character.known_spells || '[]')
    const swappedOut = swapSpell?.old
    const available = []
    const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

    if (serverSpellList) {
      for (const spell of serverSpellList) {
        const isKnown = existingSpells.includes(spell.name) && spell.name !== swappedOut
        if (!isKnown && !selectedNewSpells.includes(spell.name)) {
          available.push({ ...spell, level: ordinals[spell.level - 1] || `${spell.level}th` })
        }
      }
      return available
    }

    // Fallback while the server list loads: max spell level from classes.json
    const classInfo = classesData[key]
    const spellcasting = classInfo?.spellcasting
    if (!spellcasting) return []

    const newClassLevel = selectedClassOption?.newLevel || 1

    // Get max spell level from slot progression
    let maxSpellLevel = 0
    const slotsByLevel = spellcasting.spellSlotsByLevel
    if (slotsByLevel) {
      const slotsAtLevel = slotsByLevel[newClassLevel]
      if (slotsAtLevel) {
        for (let i = slotsAtLevel.length - 1; i >= 0; i--) {
          if (slotsAtLevel[i] > 0) {
            maxSpellLevel = i + 1
            break
          }
        }
      }
    }

    // Warlock pact magic: slot level = ceil(classLevel / 2), max 5
    if (key === 'warlock') {
      maxSpellLevel = Math.min(5, Math.ceil(newClassLevel / 2))
    }

    const levelLabels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
    for (let i = 0; i < maxSpellLevel; i++) {
      const levelKey = levelLabels[i]
      const levelSpells = spellsData.spells[levelKey] || []
      const classSpells = levelSpells.filter(s => s.classes.includes(key))
      classSpells.forEach(spell => {
        const isKnown = existingSpells.includes(spell.name) && spell.name !== swappedOut
        const isSelected = selectedNewSpells.includes(spell.name)
        if (!isKnown && !isSelected) {
          available.push({ ...spell, level: levelKey })
        }
      })
    }

    return available
  }

  // Get the character's current known spells for swap purposes
  const getCurrentKnownSpells = () => {
    return JSON.parse(character.known_spells || '[]')
  }

  const handleClassSelect = (classOption) => {
    setSelectedClassOption(classOption)
    setStep('choices')
  }

  const handleProceedFromChoices = () => {
    if (needsSpellsStep()) {
      setStep('spells')
    } else {
      setStep('review')
    }
  }

  const handleProceedToReview = () => {
    setStep('review')
  }

  const handleBackToChoices = () => {
    setStep('choices')
  }

  const handleBackToSpells = () => {
    setStep('spells')
  }

  const handleBackToClassSelection = () => {
    setStep('class-selection')
    setSelectedClassOption(null)
  }

  // Calculate what the final stats will be
  const calculateFinalStats = () => {
    const activeHpGain = selectedClassOption?.hpGain || {}
    let hpGain = hpChoice === 'roll' && hpRoll !== null
      ? Math.max(1, hpRoll + (activeHpGain.conMod || 0))
      : activeHpGain.average || 0

    // Account for CON increase from ASI
    const conIncrease = asiDistribution.con || 0
    if (conIncrease > 0) {
      const newConMod = Math.floor(((currentAbilityScores.con || 10) + conIncrease - 10) / 2)
      const oldConMod = Math.floor(((currentAbilityScores.con || 10) - 10) / 2)
      if (newConMod > oldConMod) {
        hpGain += (newConMod - oldConMod) * (levelUpInfo?.newLevel || 1)
      }
    }

    const newAbilityScores = { ...currentAbilityScores }
    for (const [ability, increase] of Object.entries(asiDistribution)) {
      if (increase > 0) {
        newAbilityScores[ability] = Math.min(20, (newAbilityScores[ability] || 10) + increase)
      }
    }

    return {
      hpGain,
      newMaxHp: character.max_hp + hpGain,
      newAbilityScores,
      asiChanges: Object.entries(asiDistribution).filter(([_, v]) => v > 0)
    }
  }

  const handleSubmit = async () => {
    if (!levelUpInfo || !selectedClassOption) return

    setSubmitting(true)
    setError(null)

    try {
      const body = {
        selectedClass: selectedClassOption.class,
        hpRoll: hpChoice,
        rollValue: hpChoice === 'roll' ? hpRoll : undefined
      }

      const activeChoices = selectedClassOption.choices || {}

      if (activeChoices.needsASI) {
        if (asiOrFeat === 'feat' && selectedFeatKey) {
          const feat = featsData[selectedFeatKey]
          body.asiChoice = {
            type: 'feat',
            feat: selectedFeatKey,
            featName: feat?.name || selectedFeatKey,
            featAbilityChoice: selectedFeatAbility || null
          }
        } else {
          const increases = {}
          for (const [ability, value] of Object.entries(asiDistribution)) {
            if (value > 0) {
              increases[ability] = value
            }
          }
          body.asiChoice = { type: 'asi', increases }
        }
      }

      if (activeChoices.needsSubclass && selectedSubclass) {
        body.subclass = selectedSubclass
      }

      // class-audit gap 5: the new infusion plans.
      if (activeChoices.newPlans > 0 && planPicks.length > 0) {
        body.newPlans = planPicks.map(p => ({ plan: p.plan, ...(p.detail ? { detail: p.detail } : {}) }))
      }

      // class-audit item 2: warlock invocations (new picks + one optional swap).
      const isWarlockLevel = String(selectedClassOption.class || '').toLowerCase() === 'warlock'
      if (isWarlockLevel && invocationPicks.length > 0) {
        body.newInvocations = invocationPicks.map(p => ({ key: p.key, ...(p.choice ? { choice: p.choice } : {}) }))
      }
      if (isWarlockLevel && invocationReplacement && invocationReplacement.to) {
        const from = invocationCatalog?.held?.[invocationReplacement.fromIndex]
        if (from) {
          body.replaceInvocation = {
            from: { key: from.key, ...(from.choice ? { choice: from.choice } : {}) },
            to: { key: invocationReplacement.to, ...(invocationReplacement.toChoice ? { choice: invocationReplacement.toChoice } : {}) },
          }
        }
      }

      // Progression (Phase 5): include ancestry feat pick when an L3/L7/L13/L18 tier crossed
      if (levelUpInfo?.progression?.ancestry_feat_tier && selectedAncestryFeatId) {
        body.ancestryFeatId = selectedAncestryFeatId
      }

      // Spell selections
      if (selectedNewCantrips.length > 0) {
        body.newCantrips = selectedNewCantrips
      }
      if (selectedNewSpells.length > 0) {
        body.newSpells = selectedNewSpells
      } else if (startEmptyBook && selectedClassOption.type === 'multiclass' && isWizard(selectedClassOption.class)) {
        // V3 (2026-11-08): an empty multiclass seed is allowed —
        // the wizard starts with an empty book and copies spells in
        // from found spellbooks in play. Sent as an explicit [],
        // which the server accepts; an absent key would be the same
        // shape, but explicit says what the player chose.
        body.newSpells = []
      }
      if (swapSpell && swapSpell.old && swapSpell.new) {
        body.swapSpell = swapSpell
        // Include the swap-in spell in newSpells if not already there
        if (!body.newSpells) body.newSpells = []
        if (!body.newSpells.includes(swapSpell.new)) {
          body.newSpells.push(swapSpell.new)
        }
      }

      const response = await fetch(`/api/character/level-up/${character.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to level up')
      }

      const data = await response.json()
      onLevelUp(data.character, data.levelUpSummary)
    } catch (err) {
      setError(err.message)
      setStep('choices') // Go back to choices if there's an error
    } finally {
      setSubmitting(false)
    }
  }

  const getClassDisplay = () => {
    if (levelUpInfo?.classLevels && levelUpInfo.classLevels.length > 1) {
      return levelUpInfo.classLevels.map(c => `${c.class} ${c.level}`).join(' / ')
    }
    return `${character.class} ${character.level}`
  }

  if (loading) {
    return (
      <div className="level-up-page">
        <div className="level-up-loading">
          <p>Loading level-up information...</p>
        </div>
      </div>
    )
  }

  if (error && !levelUpInfo) {
    return (
      <div className="level-up-page">
        <div className="level-up-header">
          <button className="button button-secondary" onClick={onBack}>
            ← Back to Character
          </button>
          <h1>Cannot Level Up</h1>
        </div>
        <div className="level-up-error">
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const existingClassOptions = levelUpInfo?.classOptions?.filter(o => o.type === 'existing') || []
  const allMulticlassOptions = getAllMulticlassOptions()
  // Gray-out (2026-11-08, MVP scope): deferred classes stay listed
  // but disabled on this PC surface only — same pattern as the
  // deferred subclasses below. A disabled card has no hover title
  // in most browsers, so the note rides the line under the grid.
  const deferredMulticlassOptions = allMulticlassOptions.filter(o => o.pcCreatable === false)
  const activeChoices = selectedClassOption?.choices || {}
  // Gray-out (2026-11-08, MVP scope): subclasses flagged pcCreatable: false
  // in classes.json stay listed but disabled on this PC surface only.
  // CompanionEditor reads the same list and ignores the flag, so the
  // companion surface stays open. A disabled <option> has no hover
  // title in most browsers, so the note rides the line under the select.
  const deferredSubclassOptions = selectedClassOption
    ? getSubclassOptions(selectedClassOption.class).filter(s => s.pcCreatable === false)
    : []
  const activeHpGain = selectedClassOption?.hpGain || {}
  const activeNewFeatures = selectedClassOption?.newFeatures || []

  return (
    <div className="level-up-page">
      {/* Header */}
      <div className="level-up-header">
        <button className="button button-secondary" onClick={onBack}>
          ← Back to Character
        </button>
        <div className="level-up-title">
          <h1>Level Up!</h1>
          <p className="subtitle">
            {character.nickname || character.name} ({getClassDisplay()}) → Level {levelUpInfo?.newLevel}
          </p>
        </div>
        <div className="level-up-progress">
          <div className={`progress-step ${step === 'class-selection' ? 'active' : ''} ${step !== 'class-selection' ? 'completed' : ''}`}>
            1. Class
          </div>
          <div className={`progress-step ${step === 'choices' ? 'active' : ''} ${['spells', 'review'].includes(step) ? 'completed' : ''}`}>
            2. Choices
          </div>
          {needsSpellsStep() && (
            <div className={`progress-step ${step === 'spells' ? 'active' : ''} ${step === 'review' ? 'completed' : ''}`}>
              3. Spells
            </div>
          )}
          <div className={`progress-step ${step === 'review' ? 'active' : ''}`}>
            {needsSpellsStep() ? '4' : '3'}. Review
          </div>
        </div>
      </div>

      {error && (
        <div className="level-up-error-banner">
          {error}
        </div>
      )}

      <div className="level-up-content">
        {/* Step 1: Class Selection */}
        {step === 'class-selection' && (
          <div className="level-up-step">
            <h2>Choose a Class to Level Up</h2>
            <p className="step-description">
              Continue with your current class, or multiclass into a new one.
            </p>

            {/* Existing Classes */}
            <div className="class-section">
              <h3>Continue Current Class{existingClassOptions.length > 1 ? 'es' : ''}</h3>
              <div className="class-options">
                {existingClassOptions.map((option, idx) => {
                  // Get subclass features for preview
                  const subclassFeatures = option.subclass
                    ? getSubclassFeatures(option.class, option.subclass, option.newLevel)
                    : []
                  const subclassSpells = option.subclass
                    ? getSubclassSpells(option.class, option.subclass, option.newLevel)
                    : []

                  const allFeatureNames = [
                    ...option.newFeatures,
                    ...subclassFeatures.map(f => f.name)
                  ]

                  return (
                    <div
                      key={idx}
                      className="class-option existing"
                      onClick={() => handleClassSelect(option)}
                    >
                      <div className="class-option-header">
                        <span className="class-name">{option.class}</span>
                        <span className="class-level">Level {option.currentLevel} → {option.newLevel}</span>
                      </div>
                      {option.subclass && (
                        <span className="class-subclass">{option.subclass}</span>
                      )}
                      <div className="class-option-info">
                        <span className="hp-gain">+{option.hpGain.average} HP avg</span>
                        {allFeatureNames.length > 0 && (
                          <span className="features-preview">
                            New: {allFeatureNames.slice(0, 2).join(', ')}
                            {allFeatureNames.length > 2 && '...'}
                          </span>
                        )}
                        {subclassSpells.length > 0 && (
                          <span className="features-preview" style={{ color: '#2ecc71' }}>
                            Spells: {subclassSpells.slice(0, 2).join(', ')}
                            {subclassSpells.length > 2 && '...'}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Multiclass Options */}
            <div className="class-section">
              <h3>Multiclass into New Class</h3>
              <p className="section-note">
                Choose any class to begin multiclassing. Your character will start at level 1 in the new class.
              </p>
              <div className="class-options multiclass-grid">
                {allMulticlassOptions.map((option, idx) => (
                  <div
                    key={idx}
                    className={`class-option multiclass${option.pcCreatable === false ? ' deferred' : ''}`}
                    onClick={option.pcCreatable === false ? undefined : () => handleClassSelect(option)}
                    title={option.class.toLowerCase() === 'wizard'
                      ? `Start a wizard's spellbook: you will pick ${option.choices.newSpellsKnown} first-level Wizard spells on the next step — a 1st-level wizard's book holds ${option.choices.newSpellsKnown} spells — or start with an empty book and copy spells in from spellbooks you find in play.`
                      : undefined}
                  >
                    <span className="class-name">{option.displayName || option.class}</span>
                    <span className="class-hit-die">d{option.hpGain.hitDie} hit die</span>
                    <span className="hp-gain">+{option.hpGain.average} HP avg</span>
                  </div>
                ))}
              </div>
              {deferredMulticlassOptions.length > 0 && (
                <p className="section-note">
                  {deferredMulticlassOptions.map(o => o.displayName || o.class).join(', ')} {deferredMulticlassOptions.length > 1 ? 'are' : 'is'} not available for player characters yet — {deferredMulticlassOptions[0].pcCreatableNote || 'Coming after the MVP.'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Level Up Choices */}
        {step === 'choices' && selectedClassOption && (
          <div className="level-up-step">
            <button className="back-link" onClick={handleBackToClassSelection}>
              ← Back to class selection
            </button>

            <div className="selected-class-banner" data-type={selectedClassOption.type}>
              <span className="banner-label">
                {selectedClassOption.type === 'multiclass' ? 'Multiclassing into' : 'Continuing as'}
              </span>
              <span className="banner-class">{selectedClassOption.class}</span>
              <span className="banner-level">
                Level {selectedClassOption.currentLevel} → {selectedClassOption.newLevel}
              </span>
            </div>

            {/* New Features */}
            {(() => {
              const subclass = selectedClassOption?.subclass || selectedSubclass
              const newLevel = selectedClassOption?.newLevel
              const className = selectedClassOption?.class

              const subclassFeatures = subclass
                ? getSubclassFeatures(className, subclass, newLevel)
                : []
              const subclassSpells = subclass
                ? getSubclassSpells(className, subclass, newLevel)
                : []

              const hasAnyFeatures = activeNewFeatures.length > 0 || subclassFeatures.length > 0 || subclassSpells.length > 0

              if (!hasAnyFeatures) return null

              return (
                <section className="choice-section features-section">
                  <h3>New Features at Level {newLevel}</h3>

                  {/* Base Class Features */}
                  {activeNewFeatures.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ color: '#60a5fa', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                        {className} Features
                      </h4>
                      <ul className="features-list">
                        {activeNewFeatures.map((feature, idx) => (
                          <li key={idx}>{feature}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Subclass Features */}
                  {subclassFeatures.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ color: '#a78bfa', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                        {subclass} Features
                      </h4>
                      <ul className="features-list" style={{ paddingLeft: '1.25rem' }}>
                        {subclassFeatures.map((feature, idx) => (
                          <li key={idx} style={{ marginBottom: '0.5rem' }}>
                            <strong>{feature.name}</strong>
                            {feature.description && (
                              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#aaa' }}>
                                {feature.description.length > 200
                                  ? feature.description.substring(0, 200) + '...'
                                  : feature.description}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Subclass Spells (Domain Spells, etc.) */}
                  {subclassSpells.length > 0 && (
                    <div>
                      <h4 style={{ color: '#2ecc71', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                        {subclass} Spells (Always Prepared)
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {subclassSpells.map((spell, idx) => (
                          <span key={idx} style={{
                            background: 'rgba(46, 204, 113, 0.15)',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '4px',
                            fontSize: '0.9rem'
                          }}>
                            {spell}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )
            })()}

            {/* Proficiency Bonus Increase */}
            {levelUpInfo.proficiencyBonus.increased && (
              <section className="choice-section proficiency-section">
                <h3>Proficiency Bonus Increased!</h3>
                <p>
                  Your proficiency bonus increases from +{levelUpInfo.proficiencyBonus.current} to +{levelUpInfo.proficiencyBonus.new}
                </p>
              </section>
            )}

            {/* Subclass Selection */}
            {activeChoices.needsSubclass && (
              <section className="choice-section subclass-section">
                <h3>Choose Your Subclass</h3>
                <p>
                  At level {selectedClassOption.subclassLevel}, {selectedClassOption.class}s choose their specialization.
                </p>
                <select
                  value={selectedSubclass}
                  onChange={(e) => setSelectedSubclass(e.target.value)}
                  className="subclass-select"
                >
                  <option value="">Select a subclass...</option>
                  {getSubclassOptions(selectedClassOption.class).map(subclass => (
                    <option key={subclass.name} value={subclass.name} disabled={subclass.pcCreatable === false}>
                      {subclass.name}
                    </option>
                  ))}
                </select>
                {deferredSubclassOptions.length > 0 && (
                  <p className="subclass-note">
                    {deferredSubclassOptions.map(s => s.name).join(' and ')} {deferredSubclassOptions.length > 1 ? 'are' : 'is'} not available for player characters yet — {deferredSubclassOptions[0].pcCreatableNote || 'Coming after the MVP.'}
                  </p>
                )}
                {selectedSubclass && (
                  <p className="subclass-description">
                    {getSubclassOptions(selectedClassOption.class).find(s => s.name === selectedSubclass)?.description}
                  </p>
                )}
              </section>
            )}

            {/* HP Gain */}
            <section className="choice-section hp-section">
              <h3>Hit Points</h3>
              <p>
                Roll your hit die (d{activeHpGain.hitDie}) or take the average.
                <span className="con-mod">CON modifier: {getModifier(currentAbilityScores.con)}</span>
              </p>

              <div className="hp-options">
                <button
                  className={`hp-option ${hpChoice === 'average' ? 'selected' : ''}`}
                  onClick={() => {
                    setHpChoice('average')
                    setHpRoll(null)
                  }}
                >
                  <span className="hp-option-label">Take Average</span>
                  <span className="hp-option-value">+{activeHpGain.average} HP</span>
                </button>
                <button
                  className={`hp-option ${hpChoice === 'roll' ? 'selected' : ''}`}
                  onClick={rollHitDie}
                >
                  <span className="hp-option-label">Roll d{activeHpGain.hitDie}</span>
                  {hpChoice === 'roll' && hpRoll !== null ? (
                    <span className={`hp-option-value rolled ${hpRoll === 1 ? 'low' : hpRoll === activeHpGain.hitDie ? 'high' : ''}`}>
                      Rolled: {hpRoll} (+{Math.max(1, hpRoll + activeHpGain.conMod)} HP)
                    </span>
                  ) : (
                    <span className="hp-option-value">Click to roll</span>
                  )}
                </button>
              </div>

              {hpChoice === 'roll' && hpRoll !== null && (
                <button className="reroll-button" onClick={rollHitDie}>
                  Re-roll
                </button>
              )}

              <p className="current-hp">Current HP: {character.current_hp}/{character.max_hp}</p>
            </section>

            {/* class-audit item 2: Warlock Eldritch Invocations */}
            {String(selectedClassOption.class || '').toLowerCase() === 'warlock' && (activeChoices.newInvocations > 0 || activeChoices.canReplaceInvocation) && (
              <InvocationPicker
                characterId={character.id}
                level={selectedClassOption.newLevel}
                due={activeChoices.newInvocations || 0}
                canReplace={!!activeChoices.canReplaceInvocation}
                picks={invocationPicks}
                setPicks={setInvocationPicks}
                replacement={invocationReplacement}
                setReplacement={setInvocationReplacement}
                catalog={invocationCatalog}
                setCatalog={setInvocationCatalog}
              />
            )}

            {/* class-audit gap 5: Artificer infusion plans */}
            {activeChoices.newPlans > 0 && (
              <ArtificerPlanPicker
                characterId={character.id}
                level={selectedClassOption.newLevel}
                due={activeChoices.newPlans}
                picks={planPicks}
                setPicks={setPlanPicks}
                catalog={planCatalog}
                setCatalog={setPlanCatalog}
              />
            )}

            {/* ASI or Feat choice */}
            {activeChoices.needsASI && (
              <section className="choice-section asi-section">
                <h3>Ability Score Improvement or Feat</h3>
                <p>At this level, choose either to increase your ability scores by 2 points total, or to take a feat instead.</p>

                {/* Toggle between ASI and Feat */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setAsiOrFeat('asi')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: asiOrFeat === 'asi' ? '2px solid #f39c12' : '1px solid rgba(255,255,255,0.15)',
                      background: asiOrFeat === 'asi' ? 'rgba(243,156,18,0.15)' : 'rgba(255,255,255,0.03)',
                      color: asiOrFeat === 'asi' ? '#f39c12' : '#ccc',
                      cursor: 'pointer',
                      fontWeight: asiOrFeat === 'asi' ? 'bold' : 'normal'
                    }}
                  >
                    Increase Ability Scores (+2 total)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAsiOrFeat('feat')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: asiOrFeat === 'feat' ? '2px solid #f39c12' : '1px solid rgba(255,255,255,0.15)',
                      background: asiOrFeat === 'feat' ? 'rgba(243,156,18,0.15)' : 'rgba(255,255,255,0.03)',
                      color: asiOrFeat === 'feat' ? '#f39c12' : '#ccc',
                      cursor: 'pointer',
                      fontWeight: asiOrFeat === 'feat' ? 'bold' : 'normal'
                    }}
                  >
                    Take a Feat
                  </button>
                </div>

                {asiOrFeat === 'asi' ? (
                  <>
                    <div className="asi-points-remaining" data-complete={asiPoints === 0}>
                      Points remaining: {asiPoints}
                    </div>

                    <div className="asi-grid">
                      {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => {
                        const currentScore = currentAbilityScores[ability] || 10
                        const increase = asiDistribution[ability]
                        const newScore = currentScore + increase
                        const atMax = newScore >= 20

                        return (
                          <div key={ability} className="asi-ability">
                            <div className="asi-ability-name">{ability.toUpperCase()}</div>
                            <div className={`asi-ability-score ${increase > 0 ? 'increased' : ''}`}>
                              {newScore}
                              {increase > 0 && <span className="increase-badge">+{increase}</span>}
                            </div>
                            <div className="asi-ability-mod">{getModifier(newScore)}</div>
                            <div className="asi-controls">
                              <button
                                onClick={() => handleAsiChange(ability, -1)}
                                disabled={increase <= 0}
                                className="asi-button decrease"
                              >
                                -
                              </button>
                              <button
                                onClick={() => handleAsiChange(ability, 1)}
                                disabled={asiPoints <= 0 || atMax || increase >= 2}
                                className="asi-button increase"
                              >
                                +
                              </button>
                            </div>
                            {atMax && increase === 0 && <span className="at-max-label">Max</span>}
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', color: '#ccc' }}>
                        Choose a feat:
                      </label>
                      <select
                        value={selectedFeatKey}
                        onChange={e => {
                          setSelectedFeatKey(e.target.value)
                          // A fixed +1 (Actor: Cha) needs no choice — preselect it.
                          const opts = featAbilityOptions(featsData[e.target.value], featPickCtx)
                          setSelectedFeatAbility(opts.length === 1 ? opts[0] : '')
                        }}
                        style={{
                          width: '100%', padding: '0.5rem',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px', color: '#ddd'
                        }}
                      >
                        <option value="">Select a feat...</option>
                        {/* The Ability Score Improvement feat IS the ASI toggle above, so it is not repeated here. */}
                        {Object.entries(featsData).filter(([key]) => key !== 'ability_score_improvement').map(([key, f]) => {
                          const blocked = featPickBlockReason(key, f, featPickCtx)
                          return (
                            <option key={key} value={key} disabled={!!blocked}>
                              {f.name}{f.category ? ` — ${f.category}` : ''}{blocked ? ` (${blocked})` : ''}
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    {selectedFeatKey && featsData[selectedFeatKey] && (
                      <div style={{
                        padding: '0.75rem', background: 'rgba(243,156,18,0.08)',
                        border: '1px solid rgba(243,156,18,0.3)', borderRadius: '4px'
                      }}>
                        <div style={{ fontWeight: 'bold', color: '#f39c12', marginBottom: '0.3rem' }}>
                          {featsData[selectedFeatKey].name}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#ddd', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                          {featsData[selectedFeatKey].description}
                        </div>
                        {featsData[selectedFeatKey].prerequisites && (
                          <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>
                            <strong>Prerequisite:</strong> {featsData[selectedFeatKey].prerequisites}
                          </div>
                        )}
                        {featsData[selectedFeatKey].benefits && (
                          <ul style={{ fontSize: '0.82rem', color: '#bbb', marginTop: '0.4rem', paddingLeft: '1.2rem' }}>
                            {featsData[selectedFeatKey].benefits.map((b, i) => (
                              <li key={i} style={{ marginBottom: '0.2rem' }}>{b}</li>
                            ))}
                          </ul>
                        )}
                        {featsData[selectedFeatKey].abilityIncrease && (
                          <div style={{ marginTop: '0.75rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: '#f39c12' }}>
                              This feat grants +1 to one ability. Choose:
                            </label>
                            <select
                              value={selectedFeatAbility}
                              onChange={e => setSelectedFeatAbility(e.target.value)}
                              style={{
                                padding: '0.4rem', background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '4px', color: '#ddd'
                              }}
                            >
                              <option value="">Select ability...</option>
                              {featAbilityOptions(featsData[selectedFeatKey], featPickCtx).map(ab => (
                                <option key={ab} value={ab}>{ab.toUpperCase()}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Progression: Theme tier unlock (auto — no choice) */}
            {levelUpInfo?.progression?.theme_tier_unlock && (
              <section className="choice-section" style={{
                border: '1px solid rgba(139, 92, 246, 0.4)',
                background: 'rgba(139, 92, 246, 0.08)',
                borderRadius: '6px',
                padding: '1rem'
              }}>
                <h3 style={{ color: '#a78bfa' }}>
                  Theme Tier Unlock — L{levelUpInfo.progression.theme_tier_unlock.tier}
                </h3>
                <p style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                  Your <strong>{levelUpInfo.progression.theme_tier_unlock.theme_name}</strong> theme
                  awakens to a new tier. This ability will be granted automatically when you complete this level-up.
                </p>
                <div style={{
                  padding: '0.75rem',
                  background: 'rgba(139, 92, 246, 0.12)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '4px'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#c4b5fd', marginBottom: '0.3rem' }}>
                    {levelUpInfo.progression.theme_tier_unlock.ability_name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#ddd', lineHeight: 1.5 }}>
                    {levelUpInfo.progression.theme_tier_unlock.ability_description}
                  </div>
                  {levelUpInfo.progression.theme_tier_unlock.flavor_text && (
                    <div style={{
                      fontSize: '0.8rem', color: '#a78bfa', marginTop: '0.5rem',
                      fontStyle: 'italic'
                    }}>
                      {levelUpInfo.progression.theme_tier_unlock.flavor_text}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Progression: Ancestry feat choice (L3/L7/L13/L18) */}
            {levelUpInfo?.progression?.ancestry_feat_tier && (
              <section className="choice-section" style={{
                border: '1px solid rgba(20, 184, 166, 0.4)',
                background: 'rgba(20, 184, 166, 0.06)',
                borderRadius: '6px',
                padding: '1rem'
              }}>
                <h3 style={{ color: '#14b8a6' }}>
                  Ancestry Feat — L{levelUpInfo.progression.ancestry_feat_tier.tier}
                </h3>
                <p style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.75rem' }}>
                  Your heritage deepens. Choose one feat from your ancestry's tier {levelUpInfo.progression.ancestry_feat_tier.tier} options:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {levelUpInfo.progression.ancestry_feat_tier.options.map(opt => {
                    const isSelected = selectedAncestryFeatId === opt.id
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setSelectedAncestryFeatId(opt.id)}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          border: isSelected
                            ? '2px solid #14b8a6'
                            : '1px solid rgba(255,255,255,0.15)',
                          background: isSelected
                            ? 'rgba(20, 184, 166, 0.15)'
                            : 'rgba(255,255,255,0.03)'
                        }}
                      >
                        <div style={{
                          fontWeight: 'bold',
                          color: isSelected ? '#2dd4bf' : '#ddd',
                          marginBottom: '0.25rem'
                        }}>
                          {opt.feat_name}
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.9, lineHeight: 1.5 }}>
                          {opt.description}
                        </div>
                        {opt.mechanics && (
                          <div style={{
                            fontSize: '0.78rem', opacity: 0.75,
                            fontStyle: 'italic', marginTop: '0.35rem'
                          }}>
                            {opt.mechanics}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Spells preview (details on next step) */}
            {(activeChoices.newCantrips > 0 || activeChoices.newSpellsKnown > 0) && (
              <section className="choice-section notification-section">
                <h3>Spells</h3>
                <p style={{ color: '#aaa', fontSize: '0.9rem' }}>
                  {activeChoices.newCantrips > 0 && (
                    <span>{activeChoices.newCantrips} new cantrip{activeChoices.newCantrips > 1 ? 's' : ''}</span>
                  )}
                  {activeChoices.newCantrips > 0 && activeChoices.newSpellsKnown > 0 && ' and '}
                  {activeChoices.newSpellsKnown > 0 && (
                    <span>
                      {isWizard(selectedClassOption.class)
                        ? `${activeChoices.newSpellsKnown} new spell${activeChoices.newSpellsKnown > 1 ? 's' : ''} for your spellbook`
                        : `${activeChoices.newSpellsKnown} new spell${activeChoices.newSpellsKnown > 1 ? 's' : ''} to learn`}
                    </span>
                  )}
                  {' — you\'ll choose on the next step.'}
                </p>
              </section>
            )}

            {/* Continue Button */}
            <div className="step-actions">
              <button
                className="button"
                onClick={handleProceedFromChoices}
                disabled={
                  // ASI validation: if user chose 'asi', must spend all 2 points.
                  // If user chose 'feat', must select a feat AND (if the feat needs
                  // an ability pick) have selected that ability.
                  (activeChoices.needsASI && asiOrFeat === 'asi' && asiPoints > 0) ||
                  (activeChoices.needsASI && asiOrFeat === 'feat' && !selectedFeatKey) ||
                  (activeChoices.needsASI && asiOrFeat === 'feat' && selectedFeatKey &&
                    featsData[selectedFeatKey]?.abilityIncrease && !selectedFeatAbility) ||
                  (activeChoices.needsSubclass && !selectedSubclass) ||
                  (hpChoice === 'roll' && hpRoll === null) ||
                  // Progression: ancestry feat pick required when tier crossed
                  (levelUpInfo?.progression?.ancestry_feat_tier && !selectedAncestryFeatId)
                }
              >
                {needsSpellsStep() ? 'Choose Spells →' : 'Review Level Up →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Spells (conditional) */}
        {step === 'spells' && selectedClassOption && (
          <div className="level-up-step">
            <button className="back-link" onClick={handleBackToChoices}>
              ← Back to choices
            </button>

            <h2>
              {isWizard(selectedClassOption.class)
                ? 'Add Spells to Spellbook'
                : 'Learn New Spells'}
            </h2>
            <p className="step-description">
              {isWizard(selectedClassOption.class)
                ? `Through study, you add ${activeChoices.newSpellsKnown || 2} new spells to your spellbook.`
                : isKnownCaster(selectedClassOption.class)
                  ? 'Choose which spells to learn as you grow in power.'
                  : 'Select new spells for your repertoire.'}
            </p>

            {/* New Cantrips */}
            {activeChoices.newCantrips > 0 && (
              <section className="choice-section" style={{ marginBottom: '1.5rem' }}>
                <h3>New Cantrips ({selectedNewCantrips.length}/{activeChoices.newCantrips})</h3>
                <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  Choose {activeChoices.newCantrips} new cantrip{activeChoices.newCantrips > 1 ? 's' : ''} to learn permanently.
                </p>

                {/* Selected cantrips */}
                {selectedNewCantrips.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {selectedNewCantrips.map(name => (
                      <span key={name} style={{
                        background: 'rgba(96, 165, 250, 0.2)',
                        border: '1px solid rgba(96, 165, 250, 0.4)',
                        padding: '0.3rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                      }} onClick={() => setSelectedNewCantrips(prev => prev.filter(c => c !== name))}>
                        {name} ✕
                      </span>
                    ))}
                  </div>
                )}

                {/* Available cantrips */}
                {selectedNewCantrips.length < activeChoices.newCantrips && (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #333', borderRadius: '6px', padding: '0.5rem' }}>
                    {getAvailableCantrips(selectedClassOption.class).map(cantrip => (
                      <div key={cantrip.name} style={{
                        padding: '0.4rem 0.6rem',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      className="spell-option-row"
                      onClick={() => setSelectedNewCantrips(prev => [...prev, cantrip.name])}>
                        <span>{cantrip.name}</span>
                        <span style={{ color: '#888', fontSize: '0.8rem' }}>{cantrip.school}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* New Spells */}
            {activeChoices.newSpellsKnown > 0 && (
              <section className="choice-section" style={{ marginBottom: '1.5rem' }}>
                <h3>
                  {isWizard(selectedClassOption.class) ? 'New Spellbook Spells' : 'New Spells Known'}
                  {' '}({selectedNewSpells.length}/{activeChoices.newSpellsKnown})
                </h3>
                <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  {isWizard(selectedClassOption.class)
                    ? `Add ${activeChoices.newSpellsKnown} spells to your spellbook from any Wizard spell level you can cast.`
                    : `Choose ${activeChoices.newSpellsKnown} new spell${activeChoices.newSpellsKnown > 1 ? 's' : ''} from the ${selectedClassOption.class} spell list.`}
                </p>

                {/* V3 (2026-11-08): a multiclass wizard may start
                    with an EMPTY spellbook — no spells picked now,
                    spells copied in later from spellbooks found in
                    play. The wizard cannot prepare wizard spells
                    until the book holds some. */}
                {isWizard(selectedClassOption.class) && selectedClassOption.type === 'multiclass' && (
                  <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: '#ccc', fontSize: '0.9rem', marginBottom: '0.75rem', cursor: 'pointer' }} title="Start with an empty spellbook — pick no spells now. Your wizard cannot prepare wizard spells until spells are copied in from spellbooks you find in play.">
                    <input type="checkbox" checked={startEmptyBook} onChange={(e) => { setStartEmptyBook(e.target.checked); if (e.target.checked) setSelectedNewSpells([]) }} style={{ marginTop: '0.2rem' }} />
                    <span>Start with an empty spellbook — pick no spells now</span>
                  </label>
                )}
                {startEmptyBook && selectedClassOption.type === 'multiclass' && isWizard(selectedClassOption.class) && (
                  <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    Starting with an empty spellbook — copy spells in from spellbooks you find in play. You cannot prepare wizard spells until the book holds some.
                  </p>
                )}

                {/* Selected spells */}
                {selectedNewSpells.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {selectedNewSpells.map(name => (
                      <span key={name} style={{
                        background: 'rgba(168, 85, 247, 0.2)',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        padding: '0.3rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                      }} onClick={() => setSelectedNewSpells(prev => prev.filter(s => s !== name))}>
                        {name} ✕
                      </span>
                    ))}
                  </div>
                )}

                {/* Filters */}
                {!startEmptyBook && selectedNewSpells.length < activeChoices.newSpellsKnown && (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      {['all', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'].map(lvl => {
                        const available = getAvailableSpells(selectedClassOption.class)
                        const count = lvl === 'all' ? available.length : available.filter(s => s.level === lvl).length
                        if (lvl !== 'all' && count === 0) return null
                        return (
                          <button key={lvl} onClick={() => setSpellFilterLevel(lvl)} style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '4px',
                            border: spellFilterLevel === lvl ? '1px solid #a855f7' : '1px solid #555',
                            background: spellFilterLevel === lvl ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                            color: spellFilterLevel === lvl ? '#a855f7' : '#ccc',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}>
                            {lvl === 'all' ? 'All' : lvl} ({count})
                          </button>
                        )
                      })}
                    </div>
                    <input
                      type="text"
                      placeholder="Search spells..."
                      value={spellSearchText}
                      onChange={(e) => setSpellSearchText(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        border: '1px solid #555',
                        background: '#1a1a2e',
                        color: '#eee',
                        fontSize: '0.9rem',
                        marginBottom: '0.5rem',
                        boxSizing: 'border-box'
                      }}
                    />

                    {/* Available spells list */}
                    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #333', borderRadius: '6px', padding: '0.5rem' }}>
                      {(() => {
                        let spells = getAvailableSpells(selectedClassOption.class)
                        if (spellFilterLevel !== 'all') {
                          spells = spells.filter(s => s.level === spellFilterLevel)
                        }
                        if (spellSearchText) {
                          const search = spellSearchText.toLowerCase()
                          spells = spells.filter(s => s.name.toLowerCase().includes(search))
                        }
                        if (spells.length === 0) {
                          return <p style={{ color: '#666', textAlign: 'center', margin: '0.5rem 0', fontSize: '0.85rem' }}>No spells available</p>
                        }
                        return spells.map(spell => (
                          <div key={spell.name} style={{
                            padding: '0.4rem 0.6rem',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          className="spell-option-row"
                          onClick={() => setSelectedNewSpells(prev => [...prev, spell.name])}>
                            <span>{spell.name}</span>
                            <span style={{ color: '#888', fontSize: '0.8rem' }}>{spell.level} {spell.school}</span>
                          </div>
                        ))
                      })()}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* Spell Swap (Bard, Sorcerer, Warlock, Ranger) */}
            {isKnownCaster(selectedClassOption.class) && getCurrentKnownSpells().length > 0 && (
              <section className="choice-section" style={{ marginBottom: '1.5rem' }}>
                <h3>Swap a Known Spell (Optional)</h3>
                <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  You may replace one spell you know with a different spell from the {selectedClassOption.class} spell list.
                </p>

                {swapSpell && swapSpell.new ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      padding: '0.3rem 0.75rem',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      textDecoration: 'line-through'
                    }}>{swapSpell.old}</span>
                    <span style={{ color: '#888' }}>→</span>
                    <span style={{
                      background: 'rgba(34, 197, 94, 0.2)',
                      border: '1px solid rgba(34, 197, 94, 0.4)',
                      padding: '0.3rem 0.75rem',
                      borderRadius: '4px',
                      fontSize: '0.9rem'
                    }}>{swapSpell.new}</span>
                    <button onClick={() => { setSwapSpell(null); setShowSwapPanel(false) }} style={{
                      background: 'transparent',
                      border: '1px solid #555',
                      color: '#aaa',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}>Cancel Swap</button>
                  </div>
                ) : showSwapPanel ? (
                  <div>
                    <p style={{ color: '#ccc', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Select a spell to replace:</p>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #333', borderRadius: '6px', padding: '0.5rem', marginBottom: '0.75rem' }}>
                      {getCurrentKnownSpells().map(spellName => (
                        <div key={spellName}
                          className="spell-option-row"
                          style={{
                            padding: '0.4rem 0.6rem',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '0.9rem'
                          }}
                          onClick={() => {
                            // Set swap old, now need to pick new
                            setSwapSpell({ old: spellName, new: null })
                          }}>
                          {spellName}
                        </div>
                      ))}
                    </div>

                    {swapSpell?.old && !swapSpell?.new && (
                      <>
                        <p style={{ color: '#ccc', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                          Replacing <strong style={{ color: '#ef4444' }}>{swapSpell.old}</strong> — choose a replacement:
                        </p>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #333', borderRadius: '6px', padding: '0.5rem' }}>
                          {getAvailableSpells(selectedClassOption.class).filter(s => s.name !== swapSpell.old).map(spell => (
                            <div key={spell.name}
                              className="spell-option-row"
                              style={{
                                padding: '0.4rem 0.6rem',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                display: 'flex',
                                justifyContent: 'space-between'
                              }}
                              onClick={() => setSwapSpell({ old: swapSpell.old, new: spell.name })}>
                              <span>{spell.name}</span>
                              <span style={{ color: '#888', fontSize: '0.8rem' }}>{spell.level} {spell.school}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <button onClick={() => { setShowSwapPanel(false); setSwapSpell(null) }} style={{
                      marginTop: '0.5rem',
                      background: 'transparent',
                      border: '1px solid #555',
                      color: '#aaa',
                      padding: '0.3rem 0.75rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setShowSwapPanel(true)} style={{
                    background: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: '#a855f7',
                    padding: '0.4rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}>Swap a Spell</button>
                )}
              </section>
            )}

            {/* Continue to Review */}
            <div className="step-actions">
              <button
                className="button"
                onClick={handleProceedToReview}
                disabled={
                  (activeChoices.newCantrips > 0 && selectedNewCantrips.length < activeChoices.newCantrips) ||
                  ((activeChoices.newSpellsKnown > 0 && selectedNewSpells.length < activeChoices.newSpellsKnown) && !startEmptyBook) ||
                  (swapSpell && !swapSpell.new)
                }
              >
                Review Level Up →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 'review' && selectedClassOption && (
          <div className="level-up-step">
            <button className="back-link" onClick={needsSpellsStep() ? handleBackToSpells : handleBackToChoices}>
              ← Back to {needsSpellsStep() ? 'spells' : 'choices'}
            </button>

            <h2>Review Your Level Up</h2>
            <p className="step-description">
              Confirm your choices before leveling up.
            </p>

            {(() => {
              const finalStats = calculateFinalStats()
              return (
                <div className="review-summary">
                  {/* Character Summary */}
                  <div className="review-card">
                    <h3>Character</h3>
                    <div className="review-row">
                      <span className="review-label">Name</span>
                      <span className="review-value">{character.nickname || character.name}</span>
                    </div>
                    <div className="review-row">
                      <span className="review-label">Current</span>
                      <span className="review-value">{getClassDisplay()}</span>
                    </div>
                    <div className="review-row highlight">
                      <span className="review-label">After Level Up</span>
                      <span className="review-value">
                        {selectedClassOption.type === 'multiclass'
                          ? `${getClassDisplay()} / ${selectedClassOption.class} 1`
                          : levelUpInfo.classLevels.map(c =>
                              c.class.toLowerCase() === selectedClassOption.class.toLowerCase()
                                ? `${c.class} ${c.level + 1}`
                                : `${c.class} ${c.level}`
                            ).join(' / ')
                        }
                      </span>
                    </div>
                    <div className="review-row">
                      <span className="review-label">Total Level</span>
                      <span className="review-value">{levelUpInfo.currentLevel} → {levelUpInfo.newLevel}</span>
                    </div>
                  </div>

                  {/* HP Summary */}
                  <div className="review-card">
                    <h3>Hit Points</h3>
                    <div className="review-row">
                      <span className="review-label">HP Gained</span>
                      <span className="review-value highlight-green">+{finalStats.hpGain}</span>
                    </div>
                    <div className="review-row">
                      <span className="review-label">Current HP</span>
                      <span className="review-value">{character.max_hp}</span>
                    </div>
                    <div className="review-row highlight">
                      <span className="review-label">New Max HP</span>
                      <span className="review-value">{finalStats.newMaxHp}</span>
                    </div>
                    <div className="review-row small">
                      <span className="review-label">Method</span>
                      <span className="review-value">
                        {hpChoice === 'average' ? 'Average' : `Rolled ${hpRoll}`}
                      </span>
                    </div>
                  </div>

                  {/* ASI Summary */}
                  {activeChoices.needsASI && asiOrFeat === 'asi' && finalStats.asiChanges.length > 0 && (
                    <div className="review-card">
                      <h3>Ability Score Improvements</h3>
                      {finalStats.asiChanges.map(([ability, increase]) => (
                        <div key={ability} className="review-row">
                          <span className="review-label">{ability.toUpperCase()}</span>
                          <span className="review-value">
                            {currentAbilityScores[ability]} → {finalStats.newAbilityScores[ability]}
                            <span className="highlight-green"> (+{increase})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Feat Summary */}
                  {activeChoices.needsASI && asiOrFeat === 'feat' && selectedFeatKey && (
                    <div className="review-card">
                      <h3>New Feat</h3>
                      <div className="review-row">
                        <span className="review-label">Feat</span>
                        <span className="review-value">{featsData[selectedFeatKey]?.name || selectedFeatKey}</span>
                      </div>
                      {selectedFeatAbility && (
                        <div className="review-row">
                          <span className="review-label">+1 Ability</span>
                          <span className="review-value">{selectedFeatAbility.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subclass Summary */}
                  {selectedSubclass && (
                    <div className="review-card">
                      <h3>Subclass</h3>
                      <div className="review-row">
                        <span className="review-label">Chosen</span>
                        <span className="review-value">{selectedSubclass}</span>
                      </div>
                    </div>
                  )}

                  {/* class-audit item 2: the invocations being learned / swapped */}
                  {(invocationPicks.length > 0 || invocationReplacement?.to) && (
                    <div className="review-card">
                      <h3>Eldritch Invocations</h3>
                      {invocationPicks.length > 0 && (
                        <div className="review-row">
                          <span className="review-label">Learning</span>
                          <span className="review-value">{invocationPicks.map(p => {
                            const o = invocationCatalog?.options?.find(x => x.key === p.key)
                            return `${o?.name || p.key}${p.choice ? ` (${o?.choiceNames?.[p.choice] || p.choice})` : ''}`
                          }).join(', ')}</span>
                        </div>
                      )}
                      {invocationReplacement?.to && (
                        <div className="review-row">
                          <span className="review-label">Replacing</span>
                          <span className="review-value">
                            {invocationCatalog?.held?.[invocationReplacement.fromIndex]?.name} → {invocationCatalog?.options?.find(x => x.key === invocationReplacement.to)?.name}{invocationReplacement.toChoice ? ` (${invocationReplacement.toChoice})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* class-audit gap 5: the infusion plans being learned */}
                  {planPicks.length > 0 && (
                    <div className="review-card">
                      <h3>Infusion Plans</h3>
                      <div className="review-row">
                        <span className="review-label">Learning</span>
                        <span className="review-value">{planPicks.map(p => (p.detail ? `${p.plan} (${p.detail})` : p.plan)).join(', ')}</span>
                      </div>
                    </div>
                  )}

                  {/* Progression Summary (Theme tier + Ancestry feat) */}
                  {levelUpInfo?.progression?.theme_tier_unlock && (
                    <div className="review-card">
                      <h3 style={{ color: '#a78bfa' }}>Theme Tier Unlock</h3>
                      <div className="review-row">
                        <span className="review-label">Theme</span>
                        <span className="review-value">{levelUpInfo.progression.theme_tier_unlock.theme_name}</span>
                      </div>
                      <div className="review-row">
                        <span className="review-label">New ability (L{levelUpInfo.progression.theme_tier_unlock.tier})</span>
                        <span className="review-value">{levelUpInfo.progression.theme_tier_unlock.ability_name}</span>
                      </div>
                    </div>
                  )}

                  {levelUpInfo?.progression?.ancestry_feat_tier && selectedAncestryFeatId && (
                    <div className="review-card">
                      <h3 style={{ color: '#14b8a6' }}>Ancestry Feat</h3>
                      <div className="review-row">
                        <span className="review-label">Tier</span>
                        <span className="review-value">L{levelUpInfo.progression.ancestry_feat_tier.tier}</span>
                      </div>
                      <div className="review-row">
                        <span className="review-label">Chosen</span>
                        <span className="review-value">
                          {levelUpInfo.progression.ancestry_feat_tier.options.find(o => o.id === selectedAncestryFeatId)?.feat_name}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* New Features Summary */}
                  {(() => {
                    const subclass = selectedClassOption?.subclass || selectedSubclass
                    const newLevel = selectedClassOption?.newLevel
                    const className = selectedClassOption?.class

                    const subclassFeatures = subclass
                      ? getSubclassFeatures(className, subclass, newLevel)
                      : []
                    const subclassSpells = subclass
                      ? getSubclassSpells(className, subclass, newLevel)
                      : []

                    const hasAnyFeatures = activeNewFeatures.length > 0 || subclassFeatures.length > 0 || subclassSpells.length > 0

                    if (!hasAnyFeatures) return null

                    return (
                      <div className="review-card">
                        <h3>New Features</h3>
                        {activeNewFeatures.length > 0 && (
                          <ul className="review-features-list">
                            {activeNewFeatures.map((feature, idx) => (
                              <li key={idx}>{feature}</li>
                            ))}
                          </ul>
                        )}
                        {subclassFeatures.length > 0 && (
                          <>
                            <h4 style={{ color: '#a78bfa', margin: '0.75rem 0 0.5rem', fontSize: '0.9rem' }}>
                              {subclass} Features
                            </h4>
                            <ul className="review-features-list">
                              {subclassFeatures.map((feature, idx) => (
                                <li key={idx}>{feature.name}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        {subclassSpells.length > 0 && (
                          <>
                            <h4 style={{ color: '#2ecc71', margin: '0.75rem 0 0.5rem', fontSize: '0.9rem' }}>
                              {subclass} Spells
                            </h4>
                            <p style={{ fontSize: '0.85rem', margin: 0 }}>
                              {subclassSpells.join(', ')}
                            </p>
                          </>
                        )}
                      </div>
                    )
                  })()}

                  {/* Spells Summary */}
                  {(selectedNewCantrips.length > 0 || selectedNewSpells.length > 0 || swapSpell || startEmptyBook) && (
                    <div className="review-card">
                      <h3>Spells</h3>
                      {startEmptyBook && (
                        <>
                          <h4 style={{ color: '#a855f7', margin: '0.5rem 0 0.25rem', fontSize: '0.9rem' }}>
                            Spellbook
                          </h4>
                          <p style={{ fontSize: '0.85rem', margin: 0 }}>
                            Starts empty — no spells picked. Copy spells in from spellbooks you find in play.
                          </p>
                        </>
                      )}
                      {selectedNewCantrips.length > 0 && (
                        <>
                          <h4 style={{ color: '#60a5fa', margin: '0.5rem 0 0.25rem', fontSize: '0.9rem' }}>
                            New Cantrips
                          </h4>
                          <p style={{ fontSize: '0.85rem', margin: 0 }}>
                            {selectedNewCantrips.join(', ')}
                          </p>
                        </>
                      )}
                      {selectedNewSpells.length > 0 && (
                        <>
                          <h4 style={{ color: '#a855f7', margin: '0.75rem 0 0.25rem', fontSize: '0.9rem' }}>
                            {isWizard(selectedClassOption.class) ? 'Spellbook Additions' : 'New Spells Known'}
                          </h4>
                          <p style={{ fontSize: '0.85rem', margin: 0 }}>
                            {selectedNewSpells.join(', ')}
                          </p>
                        </>
                      )}
                      {swapSpell && swapSpell.old && swapSpell.new && (
                        <>
                          <h4 style={{ color: '#f59e0b', margin: '0.75rem 0 0.25rem', fontSize: '0.9rem' }}>
                            Spell Swap
                          </h4>
                          <p style={{ fontSize: '0.85rem', margin: 0 }}>
                            <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>{swapSpell.old}</span>
                            {' → '}
                            <span style={{ color: '#22c55e' }}>{swapSpell.new}</span>
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Proficiency Bonus */}
                  {levelUpInfo.proficiencyBonus.increased && (
                    <div className="review-card">
                      <h3>Proficiency Bonus</h3>
                      <div className="review-row highlight">
                        <span className="review-label">Bonus</span>
                        <span className="review-value">
                          +{levelUpInfo.proficiencyBonus.current} → +{levelUpInfo.proficiencyBonus.new}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Final Action */}
            <div className="step-actions final">
              <button
                className="button button-secondary"
                onClick={needsSpellsStep() ? handleBackToSpells : handleBackToChoices}
                disabled={submitting}
              >
                ← Go Back
              </button>
              <button
                className="button level-up-button"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Leveling Up...' : (
                  selectedClassOption.type === 'multiclass'
                    ? `Multiclass into ${selectedClassOption.class}!`
                    : `Level Up to ${levelUpInfo.newLevel}!`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LevelUpPage
