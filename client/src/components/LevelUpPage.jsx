import { useState, useEffect } from 'react'
import { abilityModifier } from '../utils/dndMath.js'
import classesData from '../data/classes.json'
import spellsData from '../data/spells/index.js'
import featsData from '../data/feats.json'
import { STANDARD_TEXTS, RARE_TEXTS, RECITATIONS, SUBCLASS_TEXTS } from '../data/keeperTexts.js'
import '../styles/hearth.css'
import '../styles/hearth-levelup.css'

/* Local inline icon sprite + helper (do not import hearthUI.jsx) */
const LevelUpSprite = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
    <symbol id="i-arrow-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></symbol>
    <symbol id="i-arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
    <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></symbol>
    <symbol id="i-bolt" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></symbol>
    <symbol id="i-sparkles" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></symbol>
    <symbol id="i-book" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></symbol>
    <symbol id="i-scroll" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8" /><path d="M4 7v12a2 2 0 0 0 2 2" /><path d="M4 7a2 2 0 0 1 4 0v12" /></symbol>
  </defs></svg>
)
const Ic = ({ n }) => <svg className="ic"><use href={'#i-' + n} /></svg>

const ALL_CLASSES = [
  'Artificer', 'Barbarian', 'Bard', 'Cleric', 'Druid',
  'Fighter', 'Keeper', 'Monk', 'Paladin', 'Ranger', 'Rogue',
  'Sorcerer', 'Warlock', 'Wizard'
]

const HIT_DICE = {
  artificer: 8,
  barbarian: 12,
  bard: 8,
  cleric: 8,
  druid: 8,
  fighter: 10,
  keeper: 8,
  monk: 8,
  paladin: 10,
  ranger: 10,
  rogue: 8,
  sorcerer: 6,
  warlock: 8,
  wizard: 6
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
  const [selectedSubclass, setSelectedSubclass] = useState('')

  // Spell selection state (for spells step)
  const [selectedNewCantrips, setSelectedNewCantrips] = useState([])
  const [selectedNewSpells, setSelectedNewSpells] = useState([])
  const [swapSpell, setSwapSpell] = useState(null) // { old: string, new: string }
  const [showSwapPanel, setShowSwapPanel] = useState(false)
  const [spellFilterLevel, setSpellFilterLevel] = useState('all')
  const [spellSearchText, setSpellSearchText] = useState('')

  // Keeper-specific state
  const [selectedGenreDomain, setSelectedGenreDomain] = useState('')
  const [selectedKeeperTexts, setSelectedKeeperTexts] = useState([])
  const [selectedKeeperRecitations, setSelectedKeeperRecitations] = useState([])
  const [keeperSpecialization, setKeeperSpecialization] = useState('') // subclass name or 'polymath'
  const [selectedSecondGenre, setSelectedSecondGenre] = useState('')
  const [genreMasteryChoice, setGenreMasteryChoice] = useState('') // 'second_genre' or 'mastery'

  // Progression (Phase 5): ancestry feat choice at L3/L7/L13/L18
  const [selectedAncestryFeatId, setSelectedAncestryFeatId] = useState(null)

  useEffect(() => {
    fetchLevelUpInfo()
  }, [character.id])

  useEffect(() => {
    if (selectedClassOption) {
      setHpChoice('average')
      setHpRoll(null)
      setSelectedSubclass('')
      setAsiPoints(2)
      setAsiDistribution({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 })
      setSelectedNewCantrips([])
      setSelectedNewSpells([])
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

  const getModifier = (score) => {
    const mod = abilityModifier(score)
    return mod >= 0 ? `+${mod}` : mod.toString()
  }

  // Build all multiclass options (ignoring prerequisites)
  const getAllMulticlassOptions = () => {
    if (!levelUpInfo) return []

    const existingClassNames = levelUpInfo.classLevels.map(c => c.class.toLowerCase())
    const conMod = Math.floor((currentAbilityScores.con - 10) / 2)

    return ALL_CLASSES.filter(className => !existingClassNames.includes(className.toLowerCase()))
      .map(className => {
        const classKey = className.toLowerCase()
        const hitDie = HIT_DICE[classKey] || 8
        const classInfo = classesData[classKey]
        const subclassLevel = classInfo?.subclassLevel || 3

        return {
          type: 'multiclass',
          class: className,
          currentLevel: 0,
          newLevel: 1,
          subclass: null,
          newFeatures: classInfo?.featuresByLevel?.[1]?.map(f => f.name) || [],
          choices: {
            needsSubclass: subclassLevel === 1,
            needsASI: false,
            newCantrips: 0,
            newSpellsKnown: 0
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

    // Determine max spell level this class can cast at its new level
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

      // Progression (Phase 5): include ancestry feat pick when an L3/L7/L13/L18 tier crossed
      if (levelUpInfo?.progression?.ancestry_feat_tier && selectedAncestryFeatId) {
        body.ancestryFeatId = selectedAncestryFeatId
      }

      // Keeper-specific data
      const isKeeper = selectedClassOption.class.toLowerCase() === 'keeper'
      if (isKeeper) {
        if (selectedGenreDomain) body.keeperGenreDomain = selectedGenreDomain
        if (selectedKeeperTexts.length > 0) body.keeperNewTexts = selectedKeeperTexts
        if (selectedKeeperRecitations.length > 0) body.keeperNewRecitations = selectedKeeperRecitations
        if (keeperSpecialization) body.keeperSpecialization = keeperSpecialization
        if (genreMasteryChoice === 'second_genre' && selectedSecondGenre) {
          body.keeperSecondGenre = selectedSecondGenre
        } else if (genreMasteryChoice === 'mastery') {
          body.keeperGenreMastery = true
        }
        // Auto-grant subclass texts at L6/L11/L15
        const subKey = (keeperSpecialization || character.subclass || '').toLowerCase()
        const subTexts = SUBCLASS_TEXTS[subKey]
        if (subTexts) {
          const newLevel = selectedClassOption.newLevel
          const grantedText = subTexts.find(t => t.unlockedAt === newLevel)
          if (grantedText) {
            body.keeperSubclassText = grantedText.name
          }
        }
      }

      // Spell selections
      if (selectedNewCantrips.length > 0) {
        body.newCantrips = selectedNewCantrips
      }
      if (selectedNewSpells.length > 0) {
        body.newSpells = selectedNewSpells
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
      <div className="hearth levelup app-bg">
        <LevelUpSprite />
        <header className="dash-hdr">
          <div className="wordmark">D<span className="amp">&amp;</span>D</div>
          <div className="vr"></div>
          <button className="back" onClick={onBack}><Ic n="arrow-left" />Character sheet</button>
          <div className="spacer"></div>
          <span className="opus"><span className="dot"></span>Opus</span>
        </header>
        <div className="lu-state"><span className="lede">Gathering what this level grants…</span></div>
      </div>
    )
  }

  if (error && !levelUpInfo) {
    return (
      <div className="hearth levelup app-bg">
        <LevelUpSprite />
        <header className="dash-hdr">
          <div className="wordmark">D<span className="amp">&amp;</span>D</div>
          <div className="vr"></div>
          <button className="back" onClick={onBack}><Ic n="arrow-left" />Character sheet</button>
          <div className="spacer"></div>
          <span className="opus"><span className="dot"></span>Opus</span>
        </header>
        <div className="lu-state">
          <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 27, margin: '0 0 10px' }}>Cannot level up</h2>
          <span className="lede">{error}</span>
        </div>
      </div>
    )
  }

  const existingClassOptions = levelUpInfo?.classOptions?.filter(o => o.type === 'existing') || []
  const allMulticlassOptions = getAllMulticlassOptions()
  const activeChoices = selectedClassOption?.choices || {}
  const activeHpGain = selectedClassOption?.hpGain || {}
  const activeNewFeatures = selectedClassOption?.newFeatures || []

  // ── Step rail model — reflects the component's REAL flow ──
  const showSpellsStep = needsSpellsStep()
  const railSteps = [
    { key: 'class-selection', title: 'Class', sub: 'choose a path' },
    { key: 'choices', title: 'Choices', sub: selectedClassOption ? `${selectedClassOption.class.toLowerCase()} · l${selectedClassOption.newLevel}` : 'level reward' },
    ...(showSpellsStep ? [{ key: 'spells', title: 'Spells', sub: 'learn & swap' }] : []),
    { key: 'review', title: 'Review', sub: 'confirm' }
  ]
  const stepOrder = railSteps.map(s => s.key)
  const curStepIdx = stepOrder.indexOf(step)
  const monogram = ((character.nickname || character.name || '?').trim().charAt(0) || '?').toUpperCase()

  return (
    <div className="hearth levelup app-bg">
      <LevelUpSprite />

      {/* ───────── HEADER ───────── */}
      <header className="dash-hdr">
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <div className="vr"></div>
        <button className="back" onClick={onBack}><Ic n="arrow-left" />Character sheet</button>
        <div className="spacer"></div>
        <span className="opus"><span className="dot"></span>Opus</span>
      </header>

      <main className="wiz">
        {/* ───────── HERO ───────── */}
        <div className="wiz-hero">
          <div className="crest"><span className="mono">{monogram}</span></div>
          <div className="wh-txt">
            <span className="eyebrow">Level up</span>
            <h1>{character.nickname || character.name}</h1>
            <div className="sub">{getClassDisplay()}</div>
          </div>
          <div className="lvlchip">
            <span className="n">{levelUpInfo?.currentLevel}</span>
            <svg className="ic ar"><use href="#i-arrow-right" /></svg>
            <span className="n to">{levelUpInfo?.newLevel}</span>
          </div>
        </div>

        <div className="wiz-grid">
          {/* ───────── STEP RAIL ───────── */}
          <nav className="steprail">
            {railSteps.map((s, i) => {
              const isActive = step === s.key
              const isDone = i < curStepIdx
              // can only jump backward to a completed step
              const canJump = i < curStepIdx
              return (
                <button
                  key={s.key}
                  type="button"
                  className={`lu-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
                  disabled={!canJump}
                  onClick={() => {
                    if (s.key === 'class-selection') handleBackToClassSelection()
                    else if (s.key === 'choices') handleBackToChoices()
                    else if (s.key === 'spells') handleBackToSpells()
                  }}
                >
                  <span className="sn">{isDone ? <Ic n="check" /> : i + 1}</span>
                  <div><div className="st">{s.title}</div><div className="substep">{s.sub}</div></div>
                </button>
              )
            })}
          </nav>

          {/* ───────── STAGE ───────── */}
          <div className="stage">
            <div className="stage-body">
              {error && <div className="lu-error">{error}</div>}

        {/* Step 1: Class Selection */}
        {step === 'class-selection' && (
          <div className="pane">
            <h2>Choose a class to level up</h2>
            <div className="lede">Continue along a path you already walk, or branch into something new — your character begins at level 1 in any class you've not yet taken.</div>

            {/* Existing Classes */}
            <div className="lu-group">
              <h3>Continue current class{existingClassOptions.length > 1 ? 'es' : ''}</h3>
              <div className="choices">
                {existingClassOptions.map((option, idx) => {
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
                    <button
                      key={idx}
                      type="button"
                      className="choice"
                      onClick={() => handleClassSelect(option)}
                    >
                      <div className="ct">
                        {option.class}
                        {option.subclass && <span className="syn">{option.subclass}</span>}
                      </div>
                      <div className="cd">
                        Level {option.currentLevel} → {option.newLevel} · <em>+{option.hpGain.average} HP avg</em>
                        {allFeatureNames.length > 0 && <>. New: {allFeatureNames.slice(0, 2).join(', ')}{allFeatureNames.length > 2 && '…'}</>}
                        {subclassSpells.length > 0 && <>. Spells: {subclassSpells.slice(0, 2).join(', ')}{subclassSpells.length > 2 && '…'}</>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Multiclass Options */}
            <div className="lu-group">
              <h3>Multiclass into a new class</h3>
              <p className="gsub">Begin again at level 1 in another discipline.</p>
              <div className="classgrid">
                {allMulticlassOptions.map((option, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="choice"
                    onClick={() => handleClassSelect(option)}
                  >
                    <div className="ct">{option.class}</div>
                    <div className="cmeta">d{option.hpGain.hitDie} · +{option.hpGain.average} HP avg</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Level Up Choices */}
        {step === 'choices' && selectedClassOption && (
          <div className="pane">
            <h2>{selectedClassOption.type === 'multiclass' ? `Take up the ${selectedClassOption.class.toLowerCase()}'s path` : 'Shape this level'}</h2>
            <div className="lede">Everything this level asks of you, gathered in one place. Make your choices, then review before it's written down.</div>

            <div className="lu-banner">
              <span className="bl">{selectedClassOption.type === 'multiclass' ? 'Multiclassing into' : 'Continuing as'}</span>
              <span className="bc">{selectedClassOption.class}</span>
              <span className="bv">Level {selectedClassOption.currentLevel} → {selectedClassOption.newLevel}</span>
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
                <div className="lu-group">
                  <h3>What level {newLevel} grants</h3>
                  <p className="gsub">These come automatically with the level — new ground beneath you.</p>

                  {activeNewFeatures.length > 0 && activeNewFeatures.map((feature, idx) => (
                    <div className="nf" key={`base-${idx}`}>
                      <span className="nfi"><Ic n="sparkles" /></span>
                      <div>
                        <div className="nft">{feature} <span className="src">{className} {newLevel}</span></div>
                      </div>
                    </div>
                  ))}

                  {subclassFeatures.map((feature, idx) => (
                    <div className="nf" key={`sub-${idx}`}>
                      <span className="nfi"><Ic n="bolt" /></span>
                      <div>
                        <div className="nft">{feature.name} <span className="src">{subclass}</span></div>
                        {feature.description && (
                          <div className="nfd">
                            {feature.description.length > 200
                              ? feature.description.substring(0, 200) + '…'
                              : feature.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {subclassSpells.length > 0 && (
                    <div className="nf">
                      <span className="nfi"><Ic n="scroll" /></span>
                      <div>
                        <div className="nft">{subclass} spells <span className="src">always prepared</span></div>
                        <div className="nfd">{subclassSpells.join(', ')}</div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Proficiency Bonus Increase */}
            {levelUpInfo.proficiencyBonus.increased && (
              <div className="lu-group">
                <div className="lu-callout gold">
                  <div className="cot">Proficiency bonus rises</div>
                  <div className="cod">From +{levelUpInfo.proficiencyBonus.current} to +{levelUpInfo.proficiencyBonus.new} — every trained skill, save, and attack sharpens.</div>
                </div>
              </div>
            )}

            {/* Subclass Selection */}
            {activeChoices.needsSubclass && (
              <div className="lu-group">
                <h3>Choose your subclass</h3>
                <p className="gsub">At level {selectedClassOption.subclassLevel}, {selectedClassOption.class}s choose their specialization.</p>
                <select
                  value={selectedSubclass}
                  onChange={(e) => setSelectedSubclass(e.target.value)}
                  className="lu-select"
                >
                  <option value="">Select a subclass…</option>
                  {getSubclassOptions(selectedClassOption.class).map(subclass => (
                    <option key={subclass.name} value={subclass.name}>
                      {subclass.name}
                    </option>
                  ))}
                </select>
                {selectedSubclass && (
                  <p className="lu-note">
                    {getSubclassOptions(selectedClassOption.class).find(s => s.name === selectedSubclass)?.description}
                  </p>
                )}
              </div>
            )}

            {/* Keeper: Genre Domain Selection (Level 3) */}
            {selectedClassOption.class.toLowerCase() === 'keeper' && selectedClassOption.newLevel === 3 && (
              <div className="lu-group">
                <h3>Choose your genre domain</h3>
                <p className="gsub">Your genre defines your scholarly specialization — a passive benefit and a bonus text.</p>
                {classesData.keeper?.genreDomains?.map(genre => (
                  <div
                    key={genre.name}
                    className={`pickrow${selectedGenreDomain === genre.name ? ' sel' : ''}`}
                    onClick={() => setSelectedGenreDomain(genre.name)}
                  >
                    <div className="pt">{genre.name}</div>
                    <div className="pd">{genre.description}</div>
                    <div className="pd"><strong>Passive:</strong> {genre.passive}</div>
                    {genre.bonusText && (
                      <div className="pmeta">Bonus text: {genre.bonusText.name} ({genre.bonusText.weapon})</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Keeper: Specialization or Polymath (Level 6) */}
            {selectedClassOption.class.toLowerCase() === 'keeper' && selectedClassOption.newLevel === 6 && (
              <div className="lu-group">
                <h3>Specialization or Polymath</h3>
                <p className="gsub">Choose a combat specialization, or embrace the Polymath path for breadth over depth.</p>
                <div
                  className={`pickrow${keeperSpecialization === 'polymath' ? ' sel' : ''}`}
                  onClick={() => { setKeeperSpecialization('polymath'); setSelectedSubclass('') }}
                >
                  <div className="pt">Polymath (Pure Keeper)</div>
                  <div className="pd">+2 skill proficiencies, +2 Literary Recall uses, manifest weapons as a free action. Further improvements at L11 and L15.</div>
                </div>
                {classesData.keeper?.subclasses?.map(sub => {
                  const currentGenre = character.keeper_genre_domain || selectedGenreDomain || ''
                  const genreKey = currentGenre.toLowerCase().replace(/ /g, '_')
                  const interaction = sub.genreInteractions?.[genreKey]

                  return (
                    <div
                      key={sub.name}
                      className={`pickrow${keeperSpecialization === sub.name ? ' sel' : ''}`}
                      onClick={() => { setKeeperSpecialization(sub.name); setSelectedSubclass(sub.name) }}
                    >
                      <div className="pt">
                        <span>{sub.name}</span>
                        {interaction && <span className="chip magic">{currentGenre} · {interaction.rating}</span>}
                      </div>
                      <div className="pd">{sub.description}</div>
                      {interaction && <div className="pd" style={{ fontStyle: 'italic' }}>{interaction.synergy}</div>}
                      {(() => {
                        const subKey = sub.name.toLowerCase()
                        const subText = SUBCLASS_TEXTS[subKey]?.find(t => t.unlockedAt === 6)
                        if (!subText) return null
                        return (
                          <div className="pmeta">Bonus text: {subText.name} ({subText.weapon}) — {subText.passage.name}</div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Keeper: Second Genre Domain or Genre Mastery (Level 15) */}
            {selectedClassOption.class.toLowerCase() === 'keeper' && selectedClassOption.newLevel === 15 && (
              <div className="lu-group">
                <h3>Second genre or genre mastery</h3>
                <p className="gsub">Deepen your primary genre (<span className="hl">{character.keeper_genre_domain}</span>) with mastery, or broaden with a second genre domain.</p>

                {/* Genre Mastery option */}
                <div
                  className={`pickrow${genreMasteryChoice === 'mastery' ? ' sel' : ''}`}
                  onClick={() => { setGenreMasteryChoice('mastery'); setSelectedSecondGenre('') }}
                >
                  <div className="pt">Genre Mastery — deepen {character.keeper_genre_domain}</div>
                  {(() => {
                    const genre = classesData.keeper?.genreDomains?.find(g => g.name === character.keeper_genre_domain)
                    return genre ? (
                      <div className="pd"><strong>Mastery capstone:</strong> {genre.masteryCapstone}</div>
                    ) : null
                  })()}
                </div>

                {/* Second Genre option */}
                <div
                  className={`pickrow${genreMasteryChoice === 'second_genre' ? ' sel' : ''}`}
                  onClick={() => setGenreMasteryChoice('second_genre')}
                >
                  <div className="pt">Second Genre Domain</div>
                  <div className="pd">Choose a second genre for its passive benefit and bonus text. More breadth, less depth.</div>
                </div>

                {/* Genre picker (only if second genre selected) */}
                {genreMasteryChoice === 'second_genre' && (
                  <div style={{ marginTop: 10 }}>
                    {classesData.keeper?.genreDomains
                      ?.filter(g => g.name !== character.keeper_genre_domain)
                      .map(genre => (
                        <div
                          key={genre.name}
                          className={`pickrow${selectedSecondGenre === genre.name ? ' sel' : ''}`}
                          onClick={() => setSelectedSecondGenre(genre.name)}
                        >
                          <div className="pt">{genre.name}</div>
                          <div className="pd">{genre.passive}</div>
                          {genre.bonusText && (
                            <div className="pmeta">Bonus text: {genre.bonusText.name} ({genre.bonusText.weapon})</div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Keeper: Subclass Text Notification (L6/L11/L15) */}
            {selectedClassOption.class.toLowerCase() === 'keeper' && (() => {
              const subKey = (keeperSpecialization || character.subclass || '').toLowerCase()
              const subTexts = SUBCLASS_TEXTS[subKey]
              if (!subTexts) return null
              const newLevel = selectedClassOption.newLevel
              const grantedText = subTexts.find(t => t.unlockedAt === newLevel)
              if (!grantedText) return null
              // Don't show at L6 — already shown in the picker above
              if (newLevel === 6 && keeperSpecialization) return null

              return (
                <div className="lu-group">
                  <h3>New subclass text unlocked</h3>
                  <div className="lu-callout">
                    <div className="cot">{grantedText.name}</div>
                    <div className="cod">{grantedText.description}</div>
                    <div className="cod" style={{ marginTop: 6 }}><strong>Weapon:</strong> {grantedText.weapon} · <strong>Passage:</strong> {grantedText.passage.name}</div>
                    <div className="coflavor">{grantedText.passage.description}</div>
                  </div>
                  <p className="lu-note">Automatically added to your Library as a {subKey.charAt(0).toUpperCase() + subKey.slice(1)} exclusive.</p>
                </div>
              )
            })()}

            {/* Keeper: New Texts Selection */}
            {selectedClassOption.class.toLowerCase() === 'keeper' && (() => {
              const keeperData = classesData.keeper?.keeperAbilities
              if (!keeperData) return null
              const oldLevel = selectedClassOption.currentLevel || 0
              const newLevel = selectedClassOption.newLevel
              const oldTexts = keeperData.textsKnown[oldLevel - 1] || 0
              const newTexts = keeperData.textsKnown[newLevel - 1] || 0
              const textsToChoose = newTexts - oldTexts
              if (textsToChoose <= 0) return null

              const existingTexts = JSON.parse(character.keeper_texts || '[]')
              const availableTexts = newLevel >= 9
                ? [...STANDARD_TEXTS, ...RARE_TEXTS].filter(t => !existingTexts.includes(t.name))
                : STANDARD_TEXTS.filter(t => !existingTexts.includes(t.name))

              return (
                <div className="lu-group">
                  <h3>Learn new text{textsToChoose > 1 ? 's' : ''}</h3>
                  <p className="gsub">
                    Choose {textsToChoose} new text{textsToChoose > 1 ? 's' : ''} for your Library.
                    {newLevel >= 9 && <span className="hl"> Rare texts are now available.</span>}
                  </p>
                  <div className="pickgrid">
                    {availableTexts.map(text => {
                      const isSelected = selectedKeeperTexts.includes(text.name)
                      const isDisabled = !isSelected && selectedKeeperTexts.length >= textsToChoose
                      return (
                        <div
                          key={text.name}
                          className={`pickrow${isSelected ? ' sel' : ''}${isDisabled ? ' disabled' : ''}`}
                          onClick={() => {
                            if (isSelected) setSelectedKeeperTexts(prev => prev.filter(t => t !== text.name))
                            else if (selectedKeeperTexts.length < textsToChoose) setSelectedKeeperTexts(prev => [...prev, text.name])
                          }}
                        >
                          <div className="pt">{text.name} {text.rare && '· Rare'}</div>
                          <div className="pmeta">Weapon: {text.weapon} · Passage: {text.passage.name}</div>
                          <div className="pd">{text.passage.description}</div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="pickcount">Selected: {selectedKeeperTexts.length}/{textsToChoose}</p>
                </div>
              )
            })()}

            {/* Keeper: New Recitations */}
            {selectedClassOption.class.toLowerCase() === 'keeper' && (() => {
              const keeperData = classesData.keeper?.keeperAbilities
              if (!keeperData) return null
              const oldLevel = selectedClassOption.currentLevel || 0
              const newLevel = selectedClassOption.newLevel
              const oldRec = keeperData.recitations[oldLevel - 1] || 0
              const newRec = keeperData.recitations[newLevel - 1] || 0
              const recToChoose = newRec - oldRec
              if (recToChoose <= 0) return null

              const existingRec = JSON.parse(character.keeper_recitations || '[]')
              const availableRec = RECITATIONS.filter(r => !existingRec.includes(r.name))

              return (
                <div className="lu-group">
                  <h3>Learn new recitation{recToChoose > 1 ? 's' : ''}</h3>
                  <p className="gsub">Choose {recToChoose} new recitation{recToChoose > 1 ? 's' : ''}.</p>
                  <div className="pickgrid">
                    {availableRec.map(rec => {
                      const isSelected = selectedKeeperRecitations.includes(rec.name)
                      const isDisabled = !isSelected && selectedKeeperRecitations.length >= recToChoose
                      return (
                        <div
                          key={rec.name}
                          className={`pickrow${isSelected ? ' sel' : ''}${isDisabled ? ' disabled' : ''}`}
                          onClick={() => {
                            if (isSelected) setSelectedKeeperRecitations(prev => prev.filter(r => r !== rec.name))
                            else if (selectedKeeperRecitations.length < recToChoose) setSelectedKeeperRecitations(prev => [...prev, rec.name])
                          }}
                        >
                          <div className="pt">{rec.name}</div>
                          <div className="pd">{rec.description}</div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="pickcount">Selected: {selectedKeeperRecitations.length}/{recToChoose}</p>
                </div>
              )
            })()}

            {/* HP Gain */}
            {(() => {
              const conMod = activeHpGain.conMod || 0
              const conSign = conMod >= 0 ? `+${conMod}` : `${conMod}`
              const rolledGain = hpRoll !== null ? Math.max(1, hpRoll + conMod) : null
              return (
                <div className="lu-group">
                  <h3>Roll your hit points</h3>
                  <p className="gsub">A d{activeHpGain.hitDie} each level, plus your Constitution modifier ({conSign}). Take the safe average, or trust the dice.</p>
                  <div className="choices two">
                    <button
                      type="button"
                      className={`choice${hpChoice === 'average' ? ' sel' : ''}`}
                      onClick={() => { setHpChoice('average'); setHpRoll(null) }}
                    >
                      <div className="ct">Take the average</div>
                      <div className="cn">+{activeHpGain.average}</div>
                      <div className="cd">A flat <em>{Math.floor(activeHpGain.hitDie / 2) + 1}</em> + {conSign} CON. Reliable. HP {character.max_hp} → <em>{character.max_hp + activeHpGain.average}</em>.</div>
                    </button>
                    <button
                      type="button"
                      className={`choice${hpChoice === 'roll' ? ' sel rolled' : ''}`}
                      onClick={rollHitDie}
                    >
                      <div className="ct">Roll the d{activeHpGain.hitDie}</div>
                      <div className="cn">{hpChoice === 'roll' && rolledGain !== null ? `+${rolledGain}` : `+${Math.max(1, 1 + conMod)} … +${activeHpGain.hitDie + conMod}`}</div>
                      <div className="cd">
                        {hpChoice === 'roll' && hpRoll !== null
                          ? <>Rolled a <em>{hpRoll}</em> on the d{activeHpGain.hitDie}, {conSign} CON. HP {character.max_hp} → <em>{character.max_hp + rolledGain}</em>.</>
                          : <>1d{activeHpGain.hitDie} {conSign} CON. Could be a triumph or a regret — no take-backs.</>}
                      </div>
                      {hpChoice === 'roll' && hpRoll !== null && <div className="cmeta">Click again to re-roll</div>}
                    </button>
                  </div>
                  <p className="lu-note">Current HP {character.current_hp}/{character.max_hp}</p>
                </div>
              )
            })()}

            {/* ASI or Feat choice */}
            {activeChoices.needsASI && (
              <div className="lu-group">
                <h3>Sharpen yourself</h3>
                <p className="gsub">Raise your ability scores by 2 points total, or take a feat instead.</p>

                {/* Toggle between ASI and Feat */}
                <div className="seg">
                  <button type="button" className={asiOrFeat === 'asi' ? 'on' : ''} onClick={() => setAsiOrFeat('asi')}>Improve abilities</button>
                  <button type="button" className={asiOrFeat === 'feat' ? 'on' : ''} onClick={() => setAsiOrFeat('feat')}>Take a feat</button>
                </div>

                {asiOrFeat === 'asi' ? (
                  <>
                    <div className="asi-remaining" data-complete={asiPoints === 0}>
                      Points remaining: {asiPoints}
                    </div>

                    <div className="asi-grid">
                      {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => {
                        const currentScore = currentAbilityScores[ability] || 10
                        const increase = asiDistribution[ability]
                        const newScore = currentScore + increase
                        const atMax = newScore >= 20

                        return (
                          <div key={ability} className={`asi-cell${increase > 0 ? ' up' : ''}`}>
                            <div className="ab">{ability.toUpperCase()}</div>
                            <div className="sc">
                              {newScore}
                              {increase > 0 && <span className="badge">+{increase}</span>}
                            </div>
                            <div className="md">{getModifier(newScore)}</div>
                            <div className="asi-ctl">
                              <button onClick={() => handleAsiChange(ability, -1)} disabled={increase <= 0}>−</button>
                              <button onClick={() => handleAsiChange(ability, 1)} disabled={asiPoints <= 0 || atMax || increase >= 2}>+</button>
                            </div>
                            {atMax && increase === 0 && <div className="maxlbl">Max</div>}
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="lu-fieldlabel">Choose a feat</label>
                    <select
                      className="lu-select"
                      value={selectedFeatKey}
                      onChange={e => {
                        setSelectedFeatKey(e.target.value)
                        setSelectedFeatAbility('')
                      }}
                    >
                      <option value="">Select a feat…</option>
                      {Object.entries(featsData).map(([key, f]) => (
                        <option key={key} value={key}>{f.name}</option>
                      ))}
                    </select>

                    {selectedFeatKey && featsData[selectedFeatKey] && (
                      <div className="lu-detail">
                        <div className="dt">{featsData[selectedFeatKey].name}</div>
                        <div className="dd">{featsData[selectedFeatKey].description}</div>
                        {featsData[selectedFeatKey].prerequisites && (
                          <div className="dmeta">Prerequisite: {featsData[selectedFeatKey].prerequisites}</div>
                        )}
                        {featsData[selectedFeatKey].benefits && (
                          <ul>
                            {featsData[selectedFeatKey].benefits.map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        )}
                        {featsData[selectedFeatKey].abilityIncrease && (
                          <div style={{ marginTop: 12 }}>
                            <label className="lu-fieldlabel">This feat grants +1 to one ability</label>
                            <select
                              className="lu-select"
                              value={selectedFeatAbility}
                              onChange={e => setSelectedFeatAbility(e.target.value)}
                            >
                              <option value="">Select ability…</option>
                              {(Array.isArray(featsData[selectedFeatKey].abilityIncrease)
                                ? featsData[selectedFeatKey].abilityIncrease
                                : Object.keys(featsData[selectedFeatKey].abilityIncrease || {})
                              ).map(ab => (
                                <option key={ab} value={ab}>{ab.toUpperCase()}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Progression: Theme tier unlock (auto — no choice) */}
            {levelUpInfo?.progression?.theme_tier_unlock && (
              <div className="lu-group">
                <h3>Theme tier unlock — L{levelUpInfo.progression.theme_tier_unlock.tier}</h3>
                <p className="gsub">
                  Your <span className="hl">{levelUpInfo.progression.theme_tier_unlock.theme_name}</span> theme
                  awakens to a new tier — granted automatically when you complete this level-up.
                </p>
                <div className="lu-callout">
                  <div className="cot">{levelUpInfo.progression.theme_tier_unlock.ability_name}</div>
                  <div className="cod">{levelUpInfo.progression.theme_tier_unlock.ability_description}</div>
                  {levelUpInfo.progression.theme_tier_unlock.flavor_text && (
                    <div className="coflavor">{levelUpInfo.progression.theme_tier_unlock.flavor_text}</div>
                  )}
                </div>
              </div>
            )}

            {/* Progression: Ancestry feat choice (L3/L7/L13/L18) */}
            {levelUpInfo?.progression?.ancestry_feat_tier && (
              <div className="lu-group">
                <h3>Ancestry feat — L{levelUpInfo.progression.ancestry_feat_tier.tier}</h3>
                <p className="gsub">Your heritage deepens. Choose one feat from your ancestry's tier {levelUpInfo.progression.ancestry_feat_tier.tier} options.</p>
                {levelUpInfo.progression.ancestry_feat_tier.options.map(opt => {
                  const isSelected = selectedAncestryFeatId === opt.id
                  return (
                    <div
                      key={opt.id}
                      className={`pickrow${isSelected ? ' sel' : ''}`}
                      onClick={() => setSelectedAncestryFeatId(opt.id)}
                    >
                      <div className="pt">{opt.feat_name}</div>
                      <div className="pd">{opt.description}</div>
                      {opt.mechanics && <div className="pmeta">{opt.mechanics}</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Spells preview (details on next step) */}
            {(activeChoices.newCantrips > 0 || activeChoices.newSpellsKnown > 0) && (
              <div className="lu-group">
                <h3>Spells</h3>
                <p className="gsub">
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
              </div>
            )}
          </div>
        )}

        {/* Step 3: Spells (conditional) */}
        {step === 'spells' && selectedClassOption && (
          <div className="pane">
            <h2>
              {isWizard(selectedClassOption.class)
                ? 'Add spells to your spellbook'
                : 'Learn new spells'}
            </h2>
            <div className="lede">
              {isWizard(selectedClassOption.class)
                ? `Through study, you add ${activeChoices.newSpellsKnown || 2} new spells to your spellbook.`
                : isKnownCaster(selectedClassOption.class)
                  ? 'Choose which spells to learn as you grow in power.'
                  : 'Select new spells for your repertoire.'}
            </div>

            {/* New Cantrips */}
            {activeChoices.newCantrips > 0 && (
              <div className="lu-group">
                <h3>New cantrips <span style={{ color: 'var(--accent)' }}>({selectedNewCantrips.length}/{activeChoices.newCantrips})</span></h3>
                <p className="gsub">Choose {activeChoices.newCantrips} new cantrip{activeChoices.newCantrips > 1 ? 's' : ''} to learn permanently.</p>

                {/* Selected cantrips */}
                {selectedNewCantrips.length > 0 && (
                  <div className="lu-tags" style={{ marginBottom: 12 }}>
                    {selectedNewCantrips.map(name => (
                      <span key={name} className="selchip" onClick={() => setSelectedNewCantrips(prev => prev.filter(c => c !== name))}>
                        {name} <span className="x">✕</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Available cantrips */}
                {selectedNewCantrips.length < activeChoices.newCantrips && (
                  <div className="spelllist" style={{ maxHeight: 200 }}>
                    {getAvailableCantrips(selectedClassOption.class).map(cantrip => (
                      <div key={cantrip.name} className="spell-row" onClick={() => setSelectedNewCantrips(prev => [...prev, cantrip.name])}>
                        <span>{cantrip.name}</span>
                        <span className="lvl">{cantrip.school}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* New Spells */}
            {activeChoices.newSpellsKnown > 0 && (
              <div className="lu-group">
                <h3>
                  {isWizard(selectedClassOption.class) ? 'New spellbook spells' : 'New spells known'}
                  {' '}<span style={{ color: 'var(--accent)' }}>({selectedNewSpells.length}/{activeChoices.newSpellsKnown})</span>
                </h3>
                <p className="gsub">
                  {isWizard(selectedClassOption.class)
                    ? `Add ${activeChoices.newSpellsKnown} spells to your spellbook from any Wizard spell level you can cast.`
                    : `Choose ${activeChoices.newSpellsKnown} new spell${activeChoices.newSpellsKnown > 1 ? 's' : ''} from the ${selectedClassOption.class} spell list.`}
                </p>

                {/* Selected spells */}
                {selectedNewSpells.length > 0 && (
                  <div className="lu-tags" style={{ marginBottom: 12 }}>
                    {selectedNewSpells.map(name => (
                      <span key={name} className="selchip" onClick={() => setSelectedNewSpells(prev => prev.filter(s => s !== name))}>
                        {name} <span className="x">✕</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Filters */}
                {selectedNewSpells.length < activeChoices.newSpellsKnown && (
                  <>
                    <div className="spell-filters">
                      {['all', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'].map(lvl => {
                        const available = getAvailableSpells(selectedClassOption.class)
                        const count = lvl === 'all' ? available.length : available.filter(s => s.level === lvl).length
                        if (lvl !== 'all' && count === 0) return null
                        return (
                          <button key={lvl} className={spellFilterLevel === lvl ? 'on' : ''} onClick={() => setSpellFilterLevel(lvl)}>
                            {lvl === 'all' ? 'All' : lvl} ({count})
                          </button>
                        )
                      })}
                    </div>
                    <input
                      type="text"
                      className="lu-input"
                      placeholder="Search spells…"
                      value={spellSearchText}
                      onChange={(e) => setSpellSearchText(e.target.value)}
                      style={{ marginBottom: 10 }}
                    />

                    {/* Available spells list */}
                    <div className="spelllist">
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
                          return <p className="spell-empty">No spells available</p>
                        }
                        return spells.map(spell => (
                          <div key={spell.name} className="spell-row" onClick={() => setSelectedNewSpells(prev => [...prev, spell.name])}>
                            <span>{spell.name}</span>
                            <span className="lvl">{spell.level} {spell.school}</span>
                          </div>
                        ))
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Spell Swap (Bard, Sorcerer, Warlock, Ranger) */}
            {isKnownCaster(selectedClassOption.class) && getCurrentKnownSpells().length > 0 && (
              <div className="lu-group">
                <h3>Swap a known spell <span style={{ color: 'var(--ink-4)', fontStyle: 'italic', fontSize: 15 }}>optional</span></h3>
                <p className="gsub">You may replace one spell you know with a different spell from the {selectedClassOption.class} spell list.</p>

                {swapSpell && swapSpell.new ? (
                  <div className="swap-line">
                    <span className="selchip old">{swapSpell.old}</span>
                    <span className="ar">→</span>
                    <span className="selchip new">{swapSpell.new}</span>
                    <button className="btn ghost sm" onClick={() => { setSwapSpell(null); setShowSwapPanel(false) }}>Cancel swap</button>
                  </div>
                ) : showSwapPanel ? (
                  <div>
                    <p className="lu-note" style={{ marginTop: 0 }}>Select a spell to replace:</p>
                    <div className="spelllist" style={{ maxHeight: 150, marginBottom: 12 }}>
                      {getCurrentKnownSpells().map(spellName => (
                        <div key={spellName} className="spell-row"
                          onClick={() => setSwapSpell({ old: spellName, new: null })}>
                          {spellName}
                        </div>
                      ))}
                    </div>

                    {swapSpell?.old && !swapSpell?.new && (
                      <>
                        <p className="lu-note" style={{ marginTop: 0 }}>
                          Replacing <strong style={{ color: 'var(--bad)' }}>{swapSpell.old}</strong> — choose a replacement:
                        </p>
                        <div className="spelllist" style={{ maxHeight: 200 }}>
                          {getAvailableSpells(selectedClassOption.class).filter(s => s.name !== swapSpell.old).map(spell => (
                            <div key={spell.name} className="spell-row"
                              onClick={() => setSwapSpell({ old: swapSpell.old, new: spell.name })}>
                              <span>{spell.name}</span>
                              <span className="lvl">{spell.level} {spell.school}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => { setShowSwapPanel(false); setSwapSpell(null) }}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn" onClick={() => setShowSwapPanel(true)}>Swap a spell</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {step === 'review' && selectedClassOption && (
          <div className="pane">
            <h2>Confirm your ascent</h2>
            <div className="lede">One last look before it's written into {character.nickname || character.name}'s story.</div>

            {(() => {
              const finalStats = calculateFinalStats()
              return (
                <div className="review">
                  {/* Character Summary */}
                  <div className="rv-group">
                    <h3>Character</h3>
                    <div className="rv">
                      <span className="rk">Current</span>
                      <span className="rvv">{getClassDisplay()}</span>
                    </div>
                    <div className="rv">
                      <span className="rk">After level up</span>
                      <span className="rvv">
                        <span className="to">
                        {selectedClassOption.type === 'multiclass'
                          ? `${getClassDisplay()} / ${selectedClassOption.class} 1`
                          : levelUpInfo.classLevels.map(c =>
                              c.class === selectedClassOption.class
                                ? `${c.class} ${c.level + 1}`
                                : `${c.class} ${c.level}`
                            ).join(' / ')
                        }
                        </span>
                      </span>
                    </div>
                    <div className="rv">
                      <span className="rk">Total level</span>
                      <span className="rvv"><span className="from">{levelUpInfo.currentLevel}</span><span className="ar">→</span><span className="to">{levelUpInfo.newLevel}</span></span>
                    </div>
                  </div>

                  {/* HP Summary */}
                  <div className="rv-group">
                    <h3>Hit points</h3>
                    <div className="rv">
                      <span className="rk">HP gained</span>
                      <span className="rvv good">+{finalStats.hpGain}</span>
                    </div>
                    <div className="rv">
                      <span className="rk">Max HP</span>
                      <span className="rvv"><span className="from">{character.max_hp}</span><span className="ar">→</span><span className="to">{finalStats.newMaxHp}</span></span>
                    </div>
                    <div className="rv">
                      <span className="rk">Method</span>
                      <span className="rvv">{hpChoice === 'average' ? 'Average' : `Rolled ${hpRoll}`}</span>
                    </div>
                  </div>

                  {/* ASI Summary */}
                  {activeChoices.needsASI && asiOrFeat === 'asi' && finalStats.asiChanges.length > 0 && (
                    <div className="rv-group">
                      <h3>Ability score improvements</h3>
                      {finalStats.asiChanges.map(([ability, increase]) => (
                        <div key={ability} className="rv">
                          <span className="rk">{ability.toUpperCase()}</span>
                          <span className="rvv"><span className="from">{currentAbilityScores[ability]}</span><span className="ar">→</span><span className="to">{finalStats.newAbilityScores[ability]}</span></span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Feat Summary */}
                  {activeChoices.needsASI && asiOrFeat === 'feat' && selectedFeatKey && (
                    <div className="rv-group">
                      <h3>New feat</h3>
                      <div className="rv">
                        <span className="rk">Feat</span>
                        <span className="rvv"><span className="to">{featsData[selectedFeatKey]?.name || selectedFeatKey}</span></span>
                      </div>
                      {selectedFeatAbility && (
                        <div className="rv">
                          <span className="rk">+1 ability</span>
                          <span className="rvv">{selectedFeatAbility.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subclass Summary */}
                  {selectedSubclass && (
                    <div className="rv-group">
                      <h3>Subclass</h3>
                      <div className="rv">
                        <span className="rk">Chosen</span>
                        <span className="rvv"><span className="to">{selectedSubclass}</span></span>
                      </div>
                    </div>
                  )}

                  {/* Progression Summary (Theme tier + Ancestry feat) */}
                  {levelUpInfo?.progression?.theme_tier_unlock && (
                    <div className="rv-group">
                      <h3>Theme tier unlock</h3>
                      <div className="rv">
                        <span className="rk">Theme</span>
                        <span className="rvv">{levelUpInfo.progression.theme_tier_unlock.theme_name}</span>
                      </div>
                      <div className="rv">
                        <span className="rk">New ability (L{levelUpInfo.progression.theme_tier_unlock.tier})</span>
                        <span className="rvv"><span className="to">{levelUpInfo.progression.theme_tier_unlock.ability_name}</span></span>
                      </div>
                    </div>
                  )}

                  {levelUpInfo?.progression?.ancestry_feat_tier && selectedAncestryFeatId && (
                    <div className="rv-group">
                      <h3>Ancestry feat</h3>
                      <div className="rv">
                        <span className="rk">Tier</span>
                        <span className="rvv">L{levelUpInfo.progression.ancestry_feat_tier.tier}</span>
                      </div>
                      <div className="rv">
                        <span className="rk">Chosen</span>
                        <span className="rvv"><span className="to">
                          {levelUpInfo.progression.ancestry_feat_tier.options.find(o => o.id === selectedAncestryFeatId)?.feat_name}
                        </span></span>
                      </div>
                    </div>
                  )}

                  {/* Keeper Summary */}
                  {selectedClassOption.class.toLowerCase() === 'keeper' && (
                    (() => {
                      const hasGenre = !!selectedGenreDomain
                      const hasSpec = !!keeperSpecialization
                      const hasTexts = selectedKeeperTexts.length > 0
                      const hasRec = selectedKeeperRecitations.length > 0
                      const hasL15Genre = genreMasteryChoice === 'mastery' || (genreMasteryChoice === 'second_genre' && selectedSecondGenre)
                      const subKey = (keeperSpecialization || character.subclass || '').toLowerCase()
                      const subTexts = SUBCLASS_TEXTS[subKey]
                      const grantedText = subTexts?.find(t => t.unlockedAt === selectedClassOption.newLevel)

                      if (!hasGenre && !hasSpec && !hasTexts && !hasRec && !hasL15Genre && !grantedText) return null

                      return (
                        <div className="rv-group">
                          <h3>Keeper choices</h3>
                          {hasGenre && (
                            <div className="rv">
                              <span className="rk">Genre domain</span>
                              <span className="rvv"><span className="to">{selectedGenreDomain}</span></span>
                            </div>
                          )}
                          {hasSpec && (
                            <div className="rv">
                              <span className="rk">Specialization</span>
                              <span className="rvv"><span className="to">{keeperSpecialization === 'polymath' ? 'Polymath (Pure Keeper)' : keeperSpecialization}</span></span>
                            </div>
                          )}
                          {genreMasteryChoice === 'mastery' && (
                            <div className="rv">
                              <span className="rk">Genre mastery</span>
                              <span className="rvv"><span className="to">Deepened {character.keeper_genre_domain}</span></span>
                            </div>
                          )}
                          {genreMasteryChoice === 'second_genre' && selectedSecondGenre && (
                            <div className="rv">
                              <span className="rk">Second genre</span>
                              <span className="rvv"><span className="to">{selectedSecondGenre}</span></span>
                            </div>
                          )}
                          {grantedText && (
                            <div className="rv">
                              <span className="rk">Subclass text</span>
                              <span className="rvv"><span className="to">{grantedText.name}</span></span>
                            </div>
                          )}
                          {hasTexts && (
                            <div className="rv">
                              <span className="rk">New texts</span>
                              <span className="rvv">{selectedKeeperTexts.join(', ')}</span>
                            </div>
                          )}
                          {hasRec && (
                            <div className="rv">
                              <span className="rk">New recitations</span>
                              <span className="rvv">{selectedKeeperRecitations.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      )
                    })()
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
                      <div className="rv-group">
                        <h3>New features</h3>
                        {activeNewFeatures.length > 0 && (
                          <ul className="lu-featlist">
                            {activeNewFeatures.map((feature, idx) => (
                              <li key={idx}>{feature}</li>
                            ))}
                          </ul>
                        )}
                        {subclassFeatures.length > 0 && (
                          <ul className="lu-featlist" style={{ marginTop: 8 }}>
                            {subclassFeatures.map((feature, idx) => (
                              <li key={idx}><strong>{feature.name}</strong> <span style={{ color: 'var(--ink-4)' }}>· {subclass}</span></li>
                            ))}
                          </ul>
                        )}
                        {subclassSpells.length > 0 && (
                          <div className="rv">
                            <span className="rk">{subclass} spells</span>
                            <span className="rvv" style={{ maxWidth: 320 }}>{subclassSpells.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Spells Summary */}
                  {(selectedNewCantrips.length > 0 || selectedNewSpells.length > 0 || swapSpell) && (
                    <div className="rv-group">
                      <h3>Spells</h3>
                      {selectedNewCantrips.length > 0 && (
                        <div className="rv">
                          <span className="rk">New cantrips</span>
                          <span className="rvv" style={{ maxWidth: 320 }}><span className="to">{selectedNewCantrips.join(', ')}</span></span>
                        </div>
                      )}
                      {selectedNewSpells.length > 0 && (
                        <div className="rv">
                          <span className="rk">{isWizard(selectedClassOption.class) ? 'Spellbook additions' : 'New spells known'}</span>
                          <span className="rvv" style={{ maxWidth: 320 }}><span className="to">{selectedNewSpells.join(', ')}</span></span>
                        </div>
                      )}
                      {swapSpell && swapSpell.old && swapSpell.new && (
                        <div className="rv">
                          <span className="rk">Spell swap</span>
                          <span className="rvv"><span className="from" style={{ textDecoration: 'line-through' }}>{swapSpell.old}</span><span className="ar">→</span><span className="to">{swapSpell.new}</span></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Proficiency Bonus */}
                  {levelUpInfo.proficiencyBonus.increased && (
                    <div className="rv-group">
                      <h3>Proficiency bonus</h3>
                      <div className="rv">
                        <span className="rk">Bonus</span>
                        <span className="rvv"><span className="from">+{levelUpInfo.proficiencyBonus.current}</span><span className="ar">→</span><span className="to">+{levelUpInfo.proficiencyBonus.new}</span></span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

            </div>{/* /stage-body */}

            {/* ───────── SHARED STAGE FOOT ───────── */}
            <div className="stage-foot">
              <span className="prog">Step {curStepIdx + 1} of {railSteps.length}</span>
              <span className="spacer"></span>

              {step === 'class-selection' && (
                <button className="btn" onClick={onBack}><Ic n="arrow-left" />Cancel</button>
              )}

              {step === 'choices' && (
                <>
                  <button className="btn" onClick={handleBackToClassSelection}><Ic n="arrow-left" />Back</button>
                  <button
                    className="btn primary"
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
                    {needsSpellsStep() ? 'Choose spells' : 'Review level up'}<Ic n="arrow-right" />
                  </button>
                </>
              )}

              {step === 'spells' && (
                <>
                  <button className="btn" onClick={handleBackToChoices}><Ic n="arrow-left" />Back</button>
                  <button
                    className="btn primary"
                    onClick={handleProceedToReview}
                    disabled={
                      (activeChoices.newCantrips > 0 && selectedNewCantrips.length < activeChoices.newCantrips) ||
                      (activeChoices.newSpellsKnown > 0 && selectedNewSpells.length < activeChoices.newSpellsKnown) ||
                      (swapSpell && !swapSpell.new)
                    }
                  >
                    Review level up<Ic n="arrow-right" />
                  </button>
                </>
              )}

              {step === 'review' && (
                <>
                  <button
                    className="btn"
                    onClick={needsSpellsStep() ? handleBackToSpells : handleBackToChoices}
                    disabled={submitting}
                  >
                    <Ic n="arrow-left" />Back
                  </button>
                  <button
                    className="btn primary"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? 'Leveling up…' : (
                      selectedClassOption?.type === 'multiclass'
                        ? `Multiclass into ${selectedClassOption.class}`
                        : 'Confirm level up'
                    )}
                    {!submitting && <Ic n="check" />}
                  </button>
                </>
              )}
            </div>
          </div>{/* /stage */}
        </div>{/* /wiz-grid */}
      </main>
    </div>
  )
}

export default LevelUpPage
