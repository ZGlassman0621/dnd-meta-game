import { useState, useEffect } from 'react'
import classesData from '../data/classes.json'
import spellsData from '../data/spells/index.js'
import featsData from '../data/feats.json'
import { STANDARD_TEXTS, RARE_TEXTS, RECITATIONS, SUBCLASS_TEXTS } from '../data/keeperTexts.js'

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
    const mod = Math.floor((score - 10) / 2)
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
  const activeChoices = selectedClassOption?.choices || {}
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
                    className="class-option multiclass"
                    onClick={() => handleClassSelect(option)}
                  >
                    <span className="class-name">{option.class}</span>
                    <span className="class-hit-die">d{option.hpGain.hitDie} hit die</span>
                    <span className="hp-gain">+{option.hpGain.average} HP avg</span>
                  </div>
                ))}
              </div>
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
                    <option key={subclass.name} value={subclass.name}>
                      {subclass.name}
                    </option>
                  ))}
                </select>
                {selectedSubclass && (
                  <p className="subclass-description">
                    {getSubclassOptions(selectedClassOption.class).find(s => s.name === selectedSubclass)?.description}
                  </p>
                )}
              </section>
            )}

            {/* Keeper: Genre Domain Selection (Level 3) */}
            {selectedClassOption.class.toLowerCase() === 'keeper' && selectedClassOption.newLevel === 3 && (
              <section className="choice-section" style={{ borderLeft: '3px solid #a78bfa' }}>
                <h3 style={{ color: '#a78bfa' }}>Choose Your Genre Domain</h3>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  Your genre defines your scholarly specialization. You'll gain a passive benefit and a bonus text.
                </p>
                {classesData.keeper?.genreDomains?.map(genre => (
                  <div
                    key={genre.name}
                    onClick={() => setSelectedGenreDomain(genre.name)}
                    style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      borderRadius: '6px',
                      border: `2px solid ${selectedGenreDomain === genre.name ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
                      background: selectedGenreDomain === genre.name ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: selectedGenreDomain === genre.name ? '#c4b5fd' : '#ccc' }}>
                      {genre.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>{genre.description}</div>
                    <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.25rem' }}>
                      <strong>Passive:</strong> {genre.passive}
                    </div>
                    {genre.bonusText && (
                      <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
                        <strong>Bonus Text:</strong> {genre.bonusText.name} ({genre.bonusText.weapon})
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* Keeper: Specialization or Polymath (Level 6) */}
            {selectedClassOption.class.toLowerCase() === 'keeper' && selectedClassOption.newLevel === 6 && (
              <section className="choice-section" style={{ borderLeft: '3px solid #a78bfa' }}>
                <h3 style={{ color: '#a78bfa' }}>Specialization or Polymath</h3>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  Choose a combat specialization or embrace the Polymath path for breadth over depth.
                </p>
                <div
                  onClick={() => { setKeeperSpecialization('polymath'); setSelectedSubclass('') }}
                  style={{
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    borderRadius: '6px',
                    border: `2px solid ${keeperSpecialization === 'polymath' ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                    background: keeperSpecialization === 'polymath' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: keeperSpecialization === 'polymath' ? '#6ee7b7' : '#ccc' }}>
                    Polymath (Pure Keeper)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
                    +2 skill proficiencies, +2 Literary Recall uses, manifest weapons as a free action. Further improvements at L11 and L15.
                  </div>
                </div>
                {classesData.keeper?.subclasses?.map(sub => {
                  // Get genre interaction for current genre domain
                  const currentGenre = character.keeper_genre_domain || selectedGenreDomain || ''
                  const genreKey = currentGenre.toLowerCase().replace(/ /g, '_')
                  const interaction = sub.genreInteractions?.[genreKey]
                  const ratingColors = { 'A+': '#22c55e', 'A': '#4ade80', 'B+': '#86efac', 'B': '#94a3b8', 'B-': '#9ca3af', 'C': '#ef4444' }

                  return (
                    <div
                      key={sub.name}
                      onClick={() => { setKeeperSpecialization(sub.name); setSelectedSubclass(sub.name) }}
                      style={{
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        borderRadius: '6px',
                        border: `2px solid ${keeperSpecialization === sub.name ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
                        background: keeperSpecialization === sub.name ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 'bold', color: keeperSpecialization === sub.name ? '#c4b5fd' : '#ccc' }}>
                          {sub.name}
                        </div>
                        {interaction && (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background: `${ratingColors[interaction.rating] || '#888'}22`,
                            color: ratingColors[interaction.rating] || '#888',
                            border: `1px solid ${ratingColors[interaction.rating] || '#888'}44`
                          }}>
                            {currentGenre} Synergy: {interaction.rating}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>{sub.description}</div>
                      {interaction && (
                        <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.25rem', fontStyle: 'italic' }}>
                          {interaction.synergy}
                        </div>
                      )}
                      {/* Show subclass text they'll get */}
                      {(() => {
                        const subKey = sub.name.toLowerCase()
                        const subText = SUBCLASS_TEXTS[subKey]?.find(t => t.unlockedAt === 6)
                        if (!subText) return null
                        return (
                          <div style={{ fontSize: '0.75rem', color: '#c084fc', marginTop: '0.35rem', padding: '0.3rem 0.5rem', background: 'rgba(192,132,252,0.08)', borderRadius: '4px' }}>
                            <strong>Bonus Text:</strong> {subText.name} ({subText.weapon}) — {subText.passage.name}
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </section>
            )}

            {/* Keeper: Second Genre Domain or Genre Mastery (Level 15) */}
            {selectedClassOption.class.toLowerCase() === 'keeper' && selectedClassOption.newLevel === 15 && (
              <section className="choice-section" style={{ borderLeft: '3px solid #a78bfa' }}>
                <h3 style={{ color: '#a78bfa' }}>Second Genre Domain or Genre Mastery</h3>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  Deepen your primary Genre ({character.keeper_genre_domain}) with Genre Mastery, or broaden your knowledge with a second Genre Domain.
                </p>

                {/* Genre Mastery option */}
                <div
                  onClick={() => { setGenreMasteryChoice('mastery'); setSelectedSecondGenre('') }}
                  style={{
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    borderRadius: '6px',
                    border: `2px solid ${genreMasteryChoice === 'mastery' ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
                    background: genreMasteryChoice === 'mastery' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: genreMasteryChoice === 'mastery' ? '#fbbf24' : '#ccc' }}>
                    Genre Mastery — Deepen {character.keeper_genre_domain}
                  </div>
                  {(() => {
                    const genre = classesData.keeper?.genreDomains?.find(g => g.name === character.keeper_genre_domain)
                    return genre ? (
                      <>
                        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
                          <strong>Mastery Capstone:</strong> {genre.masteryCapstone}
                        </div>
                      </>
                    ) : null
                  })()}
                </div>

                {/* Second Genre option */}
                <div
                  onClick={() => setGenreMasteryChoice('second_genre')}
                  style={{
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    borderRadius: '6px',
                    border: `2px solid ${genreMasteryChoice === 'second_genre' ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
                    background: genreMasteryChoice === 'second_genre' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: genreMasteryChoice === 'second_genre' ? '#c4b5fd' : '#ccc' }}>
                    Second Genre Domain
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
                    Choose a second Genre for its passive benefit and bonus text. More breadth, less depth.
                  </div>
                </div>

                {/* Genre picker (only if second genre selected) */}
                {genreMasteryChoice === 'second_genre' && (
                  <div style={{ marginTop: '0.75rem', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(167, 139, 250, 0.3)' }}>
                    {classesData.keeper?.genreDomains
                      ?.filter(g => g.name !== character.keeper_genre_domain)
                      .map(genre => (
                        <div
                          key={genre.name}
                          onClick={() => setSelectedSecondGenre(genre.name)}
                          style={{
                            padding: '0.6rem',
                            marginBottom: '0.4rem',
                            borderRadius: '6px',
                            border: `1px solid ${selectedSecondGenre === genre.name ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
                            background: selectedSecondGenre === genre.name ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: selectedSecondGenre === genre.name ? '#c4b5fd' : '#ccc' }}>
                            {genre.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.15rem' }}>{genre.passive}</div>
                          {genre.bonusText && (
                            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.15rem' }}>
                              Bonus Text: {genre.bonusText.name} ({genre.bonusText.weapon})
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </section>
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
                <section className="choice-section" style={{ borderLeft: '3px solid #c084fc' }}>
                  <h3 style={{ color: '#c084fc' }}>New Subclass Text Unlocked</h3>
                  <div style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    background: 'rgba(192, 132, 252, 0.1)',
                    border: '1px solid rgba(192, 132, 252, 0.3)'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#c4b5fd' }}>{grantedText.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>{grantedText.description}</div>
                    <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.25rem' }}>
                      <strong>Weapon:</strong> {grantedText.weapon} | <strong>Passage:</strong> {grantedText.passage.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                      {grantedText.passage.description}
                    </div>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem' }}>
                    This text is automatically added to your Library as a {subKey.charAt(0).toUpperCase() + subKey.slice(1)} exclusive.
                  </p>
                </section>
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
                <section className="choice-section" style={{ borderLeft: '3px solid #a78bfa' }}>
                  <h3 style={{ color: '#a78bfa' }}>Learn New Text{textsToChoose > 1 ? 's' : ''}</h3>
                  <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                    Choose {textsToChoose} new text{textsToChoose > 1 ? 's' : ''} for your Library.
                    {newLevel >= 9 && <span style={{ color: '#c084fc' }}> Rare texts are now available!</span>}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {availableTexts.map(text => {
                      const isSelected = selectedKeeperTexts.includes(text.name)
                      const isDisabled = !isSelected && selectedKeeperTexts.length >= textsToChoose
                      return (
                        <div
                          key={text.name}
                          onClick={() => {
                            if (isSelected) setSelectedKeeperTexts(prev => prev.filter(t => t !== text.name))
                            else if (selectedKeeperTexts.length < textsToChoose) setSelectedKeeperTexts(prev => [...prev, text.name])
                          }}
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            border: `1px solid ${isSelected ? '#a78bfa' : text.rare ? 'rgba(192, 132, 252, 0.3)' : 'rgba(255,255,255,0.15)'}`,
                            background: isSelected ? 'rgba(139, 92, 246, 0.25)' : text.rare ? 'rgba(192, 132, 252, 0.05)' : 'rgba(255,255,255,0.05)',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.4 : 1,
                            flex: '1 1 280px',
                            minWidth: '200px'
                          }}
                        >
                          <div style={{ fontSize: '0.85rem', color: isSelected ? '#c4b5fd' : text.rare ? '#c084fc' : '#ccc', fontWeight: 'bold' }}>
                            {text.name} {text.rare && '(Rare)'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#888' }}>
                            Weapon: {text.weapon} | Passage: {text.passage.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.15rem' }}>
                            {text.passage.description}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#a78bfa', marginTop: '0.5rem' }}>
                    Selected: {selectedKeeperTexts.length}/{textsToChoose}
                  </p>
                </section>
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
                <section className="choice-section" style={{ borderLeft: '3px solid #a78bfa' }}>
                  <h3 style={{ color: '#a78bfa' }}>Learn New Recitation{recToChoose > 1 ? 's' : ''}</h3>
                  <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                    Choose {recToChoose} new recitation{recToChoose > 1 ? 's' : ''}.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {availableRec.map(rec => {
                      const isSelected = selectedKeeperRecitations.includes(rec.name)
                      const isDisabled = !isSelected && selectedKeeperRecitations.length >= recToChoose
                      return (
                        <div
                          key={rec.name}
                          onClick={() => {
                            if (isSelected) setSelectedKeeperRecitations(prev => prev.filter(r => r !== rec.name))
                            else if (selectedKeeperRecitations.length < recToChoose) setSelectedKeeperRecitations(prev => [...prev, rec.name])
                          }}
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            border: `1px solid ${isSelected ? '#a78bfa' : 'rgba(255,255,255,0.15)'}`,
                            background: isSelected ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255,255,255,0.05)',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.4 : 1,
                            flex: '1 1 280px',
                            minWidth: '200px'
                          }}
                        >
                          <div style={{ fontSize: '0.85rem', color: isSelected ? '#c4b5fd' : '#ccc', fontWeight: 'bold' }}>
                            {rec.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#666' }}>{rec.description}</div>
                        </div>
                      )
                    })}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#a78bfa', marginTop: '0.5rem' }}>
                    Selected: {selectedKeeperRecitations.length}/{recToChoose}
                  </p>
                </section>
              )
            })()}

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
                          setSelectedFeatAbility('')
                        }}
                        style={{
                          width: '100%', padding: '0.5rem',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px', color: '#ddd'
                        }}
                      >
                        <option value="">Select a feat...</option>
                        {Object.entries(featsData).map(([key, f]) => (
                          <option key={key} value={key}>{f.name}</option>
                        ))}
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
                {selectedNewSpells.length < activeChoices.newSpellsKnown && (
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
                  (activeChoices.newSpellsKnown > 0 && selectedNewSpells.length < activeChoices.newSpellsKnown) ||
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
                              c.class === selectedClassOption.class
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
                        <div className="review-card">
                          <h3 style={{ color: '#a78bfa' }}>Keeper Choices</h3>
                          {hasGenre && (
                            <div className="review-row">
                              <span className="review-label">Genre Domain</span>
                              <span className="review-value" style={{ color: '#c4b5fd' }}>{selectedGenreDomain}</span>
                            </div>
                          )}
                          {hasSpec && (
                            <div className="review-row">
                              <span className="review-label">Specialization</span>
                              <span className="review-value" style={{ color: keeperSpecialization === 'polymath' ? '#6ee7b7' : '#c4b5fd' }}>
                                {keeperSpecialization === 'polymath' ? 'Polymath (Pure Keeper)' : keeperSpecialization}
                              </span>
                            </div>
                          )}
                          {genreMasteryChoice === 'mastery' && (
                            <div className="review-row">
                              <span className="review-label">Genre Mastery</span>
                              <span className="review-value" style={{ color: '#fbbf24' }}>Deepened {character.keeper_genre_domain}</span>
                            </div>
                          )}
                          {genreMasteryChoice === 'second_genre' && selectedSecondGenre && (
                            <div className="review-row">
                              <span className="review-label">Second Genre</span>
                              <span className="review-value" style={{ color: '#c4b5fd' }}>{selectedSecondGenre}</span>
                            </div>
                          )}
                          {grantedText && (
                            <div className="review-row">
                              <span className="review-label">Subclass Text</span>
                              <span className="review-value" style={{ color: '#c084fc' }}>{grantedText.name}</span>
                            </div>
                          )}
                          {hasTexts && (
                            <div className="review-row">
                              <span className="review-label">New Texts</span>
                              <span className="review-value">{selectedKeeperTexts.join(', ')}</span>
                            </div>
                          )}
                          {hasRec && (
                            <div className="review-row">
                              <span className="review-label">New Recitations</span>
                              <span className="review-value">{selectedKeeperRecitations.join(', ')}</span>
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
                  {(selectedNewCantrips.length > 0 || selectedNewSpells.length > 0 || swapSpell) && (
                    <div className="review-card">
                      <h3>Spells</h3>
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
