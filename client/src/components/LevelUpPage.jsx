import { useState, useEffect } from 'react'
import classesData from '../data/classes.json'

const ALL_CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter',
  'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer',
  'Warlock', 'Wizard', 'Artificer'
]

const HIT_DICE = {
  barbarian: 12,
  bard: 8,
  cleric: 8,
  druid: 8,
  fighter: 10,
  monk: 8,
  paladin: 10,
  ranger: 10,
  rogue: 8,
  sorcerer: 6,
  warlock: 8,
  wizard: 6,
  artificer: 8
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
  const [selectedSubclass, setSelectedSubclass] = useState('')

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

  const handleClassSelect = (classOption) => {
    setSelectedClassOption(classOption)
    setStep('choices')
  }

  const handleProceedToReview = () => {
    setStep('review')
  }

  const handleBackToChoices = () => {
    setStep('choices')
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
        const increases = {}
        for (const [ability, value] of Object.entries(asiDistribution)) {
          if (value > 0) {
            increases[ability] = value
          }
        }
        body.asiChoice = { type: 'asi', increases }
      }

      if (activeChoices.needsSubclass && selectedSubclass) {
        body.subclass = selectedSubclass
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
          <div className={`progress-step ${step === 'choices' ? 'active' : ''} ${step === 'review' ? 'completed' : ''}`}>
            2. Choices
          </div>
          <div className={`progress-step ${step === 'review' ? 'active' : ''}`}>
            3. Review
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
                {existingClassOptions.map((option, idx) => (
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
                      {option.newFeatures.length > 0 && (
                        <span className="features-preview">
                          New: {option.newFeatures.slice(0, 2).join(', ')}
                          {option.newFeatures.length > 2 && '...'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
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
            {activeNewFeatures.length > 0 && (
              <section className="choice-section features-section">
                <h3>New Features</h3>
                <ul className="features-list">
                  {activeNewFeatures.map((feature, idx) => (
                    <li key={idx}>{feature}</li>
                  ))}
                </ul>
              </section>
            )}

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

            {/* ASI */}
            {activeChoices.needsASI && (
              <section className="choice-section asi-section">
                <h3>Ability Score Improvement</h3>
                <p>Increase your ability scores by a total of 2 points. No ability can exceed 20.</p>

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
              </section>
            )}

            {/* Cantrips notification */}
            {activeChoices.newCantrips > 0 && (
              <section className="choice-section notification-section">
                <h3>New Cantrips Available</h3>
                <p>
                  You can learn {activeChoices.newCantrips} new cantrip{activeChoices.newCantrips > 1 ? 's' : ''}.
                  (Cantrip selection available on your character sheet)
                </p>
              </section>
            )}

            {/* Spells notification */}
            {activeChoices.newSpellsKnown > 0 && (
              <section className="choice-section notification-section">
                <h3>New Spells Available</h3>
                <p>
                  You can learn {activeChoices.newSpellsKnown} new spell{activeChoices.newSpellsKnown > 1 ? 's' : ''}.
                  (Spell selection available on your character sheet)
                </p>
              </section>
            )}

            {/* Continue Button */}
            <div className="step-actions">
              <button
                className="button"
                onClick={handleProceedToReview}
                disabled={
                  (activeChoices.needsASI && asiPoints > 0) ||
                  (activeChoices.needsSubclass && !selectedSubclass) ||
                  (hpChoice === 'roll' && hpRoll === null)
                }
              >
                Review Level Up →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && selectedClassOption && (
          <div className="level-up-step">
            <button className="back-link" onClick={handleBackToChoices}>
              ← Back to choices
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
                  {activeChoices.needsASI && finalStats.asiChanges.length > 0 && (
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

                  {/* New Features Summary */}
                  {activeNewFeatures.length > 0 && (
                    <div className="review-card">
                      <h3>New Features</h3>
                      <ul className="review-features-list">
                        {activeNewFeatures.map((feature, idx) => (
                          <li key={idx}>{feature}</li>
                        ))}
                      </ul>
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
                onClick={handleBackToChoices}
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
