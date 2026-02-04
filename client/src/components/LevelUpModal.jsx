import { useState, useEffect } from 'react'
import classesData from '../data/classes.json'

function LevelUpModal({ character, onLevelUp, onClose }) {
  const [levelUpInfo, setLevelUpInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Step state for multiclassing flow
  const [step, setStep] = useState('class-selection') // 'class-selection' or 'choices'
  const [selectedClassOption, setSelectedClassOption] = useState(null)

  // Form state
  const [hpChoice, setHpChoice] = useState('average') // 'average' or 'roll'
  const [hpRoll, setHpRoll] = useState(null)
  const [asiChoice, setAsiChoice] = useState({ type: 'asi', increases: {} })
  const [selectedSubclass, setSelectedSubclass] = useState('')

  // ASI distribution state
  const [asiPoints, setAsiPoints] = useState(2)
  const [asiDistribution, setAsiDistribution] = useState({
    str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0
  })

  useEffect(() => {
    fetchLevelUpInfo()
  }, [character.id])

  // When class option is selected, reset form state
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

      // If there's only one class option (single class, no multiclass available),
      // auto-select it and skip to choices step
      if (data.classOptions && data.classOptions.length === 1) {
        setSelectedClassOption(data.classOptions[0])
        setStep('choices')
      } else if (data.classOptions && data.classOptions.length > 1) {
        // Multiple options - show class selection
        setStep('class-selection')
      } else {
        // Fallback for legacy data without classOptions
        setStep('choices')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const rollHitDie = () => {
    if (!levelUpInfo) return
    const hitDie = selectedClassOption?.hpGain?.hitDie || levelUpInfo.hpGain.hitDie
    const roll = Math.floor(Math.random() * hitDie) + 1
    setHpRoll(roll)
    setHpChoice('roll')
  }

  const handleAsiChange = (ability, delta) => {
    const currentAbilityScores = JSON.parse(character.ability_scores || '{}')
    const currentValue = currentAbilityScores[ability] || 10
    const currentIncrease = asiDistribution[ability]
    const newIncrease = currentIncrease + delta

    // Can't go below 0 or above 2 per ability
    if (newIncrease < 0 || newIncrease > 2) return

    // Can't exceed ability score of 20
    if (currentValue + newIncrease > 20) return

    // Check total points
    const currentTotalUsed = Object.values(asiDistribution).reduce((a, b) => a + b, 0)
    const newTotalUsed = currentTotalUsed + delta

    if (newTotalUsed > 2 || newTotalUsed < 0) return

    setAsiDistribution(prev => ({
      ...prev,
      [ability]: newIncrease
    }))
    setAsiPoints(2 - newTotalUsed)
  }

  const handleSubmit = async () => {
    if (!levelUpInfo) return

    setSubmitting(true)
    setError(null)

    // Use selected class option or fall back to current choices
    const activeChoices = selectedClassOption?.choices || levelUpInfo.choices
    const activeHpGain = selectedClassOption?.hpGain || levelUpInfo.hpGain

    try {
      // Build the request body
      const body = {
        hpRoll: hpChoice,
        rollValue: hpChoice === 'roll' ? hpRoll : undefined
      }

      // Add selected class for multiclassing
      if (selectedClassOption) {
        body.selectedClass = selectedClassOption.class
      }

      // Add ASI if needed
      if (activeChoices.needsASI) {
        const increases = {}
        for (const [ability, value] of Object.entries(asiDistribution)) {
          if (value > 0) {
            increases[ability] = value
          }
        }
        body.asiChoice = { type: 'asi', increases }
      }

      // Add subclass if needed
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
    } finally {
      setSubmitting(false)
    }
  }

  // Get subclass options from classes data
  const getSubclassOptions = (className = null) => {
    const classKey = (className || selectedClassOption?.class || character.class).toLowerCase()
    const classInfo = classesData[classKey]
    return classInfo?.subclasses || []
  }

  // Handle class selection for multiclassing
  const handleClassSelect = (classOption) => {
    setSelectedClassOption(classOption)
    setStep('choices')
  }

  // Go back to class selection
  const handleBackToClassSelection = () => {
    setStep('class-selection')
    setSelectedClassOption(null)
  }

  // Get active choices and hp info based on selected class
  const getActiveChoices = () => selectedClassOption?.choices || levelUpInfo?.choices || {}
  const getActiveHpGain = () => selectedClassOption?.hpGain || levelUpInfo?.hpGain || {}
  const getActiveNewFeatures = () => selectedClassOption?.newFeatures || levelUpInfo?.newFeatures || []
  const getActiveSubclassLevel = () => selectedClassOption?.subclassLevel || levelUpInfo?.subclassLevel

  // Format multiclass requirements for display
  const formatRequirements = (requirements) => {
    if (!requirements) return ''
    const parts = []
    const abilityNames = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
    const isEither = requirements.either
    for (const [key, value] of Object.entries(requirements)) {
      if (key !== 'either' && typeof value === 'number') {
        parts.push(`${abilityNames[key]} ${value}+`)
      }
    }
    return parts.join(isEither ? ' OR ' : ', ')
  }

  const currentAbilityScores = JSON.parse(character.ability_scores || '{}')

  const getModifier = (score) => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : mod.toString()
  }

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Loading level-up information...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !levelUpInfo) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h2 style={{ color: '#e74c3c' }}>Cannot Level Up</h2>
          <p style={{ color: '#bbb' }}>{error}</p>
          <button className="button" onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }

  // Build class display string for multiclass characters
  const getClassDisplay = () => {
    if (levelUpInfo?.classLevels && levelUpInfo.classLevels.length > 1) {
      return levelUpInfo.classLevels.map(c => `${c.class} ${c.level}`).join(' / ')
    }
    return `${character.class} ${character.level}`
  }

  const activeChoices = getActiveChoices()
  const activeHpGain = getActiveHpGain()
  const activeNewFeatures = getActiveNewFeatures()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '650px',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <h2 style={{ color: '#f1c40f', marginBottom: '0.5rem' }}>
          Level Up!
        </h2>
        <p style={{ color: '#bbb', marginBottom: '1.5rem' }}>
          {character.name} ({getClassDisplay()}) is advancing to Level {levelUpInfo.newLevel}!
        </p>

        {error && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.2)',
            border: '1px solid #e74c3c',
            borderRadius: '4px',
            padding: '0.75rem',
            marginBottom: '1rem',
            color: '#e74c3c'
          }}>
            {error}
          </div>
        )}

        {/* Step 1: Class Selection (for multiclass-capable characters) */}
        {step === 'class-selection' && levelUpInfo.classOptions && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#3498db', marginBottom: '1rem', fontSize: '1.1rem' }}>
              Choose a Class to Level Up
            </h3>

            {/* Existing Classes */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Continue with Current Class{levelUpInfo.classOptions.filter(o => o.type === 'existing').length > 1 ? 'es' : ''}
              </h4>
              {levelUpInfo.classOptions
                .filter(option => option.type === 'existing')
                .map((option, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleClassSelect(option)}
                    style={{
                      background: 'rgba(46, 204, 113, 0.1)',
                      border: '2px solid #2ecc71',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(46, 204, 113, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(46, 204, 113, 0.1)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', color: '#2ecc71', fontSize: '1.1rem' }}>
                          {option.class}
                        </span>
                        <span style={{ color: '#888', marginLeft: '0.5rem' }}>
                          Level {option.currentLevel} → {option.newLevel}
                        </span>
                        {option.subclass && (
                          <span style={{ color: '#9b59b6', marginLeft: '0.5rem' }}>
                            ({option.subclass})
                          </span>
                        )}
                      </div>
                      <span style={{ color: '#e74c3c' }}>+{option.hpGain.average} HP avg</span>
                    </div>
                    {option.newFeatures.length > 0 && (
                      <div style={{ color: '#bbb', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        New: {option.newFeatures.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Multiclass Options */}
            {levelUpInfo.canMulticlass && levelUpInfo.classOptions.filter(o => o.type === 'multiclass').length > 0 && (
              <div>
                <h4 style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  Multiclass into New Class
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '0.5rem'
                }}>
                  {levelUpInfo.classOptions
                    .filter(option => option.type === 'multiclass')
                    .map((option, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleClassSelect(option)}
                        style={{
                          background: 'rgba(155, 89, 182, 0.1)',
                          border: '2px solid #9b59b6',
                          borderRadius: '8px',
                          padding: '0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(155, 89, 182, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(155, 89, 182, 0.1)'}
                      >
                        <div style={{ fontWeight: 'bold', color: '#9b59b6' }}>
                          {option.class}
                        </div>
                        <div style={{ color: '#888', fontSize: '0.8rem' }}>
                          Start at Level 1
                        </div>
                        <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          Requires: {formatRequirements(option.requirements)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {!levelUpInfo.canMulticlass && (
              <p style={{ color: '#888', fontSize: '0.85rem', fontStyle: 'italic' }}>
                Multiclassing requires 13+ in your current class's key ability scores.
              </p>
            )}
          </div>
        )}

        {/* Step 2: Level Up Choices */}
        {step === 'choices' && (
          <>
            {/* Back button for multiclass */}
            {levelUpInfo.classOptions && levelUpInfo.classOptions.length > 1 && (
              <button
                onClick={handleBackToClassSelection}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#3498db',
                  cursor: 'pointer',
                  marginBottom: '1rem',
                  padding: 0,
                  fontSize: '0.9rem'
                }}
              >
                ← Back to class selection
              </button>
            )}

            {/* Selected class info */}
            {selectedClassOption && (
              <div style={{
                background: selectedClassOption.type === 'multiclass'
                  ? 'rgba(155, 89, 182, 0.1)'
                  : 'rgba(46, 204, 113, 0.1)',
                border: `1px solid ${selectedClassOption.type === 'multiclass' ? '#9b59b6' : '#2ecc71'}`,
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1.5rem'
              }}>
                <span style={{
                  fontWeight: 'bold',
                  color: selectedClassOption.type === 'multiclass' ? '#9b59b6' : '#2ecc71'
                }}>
                  {selectedClassOption.type === 'multiclass' ? 'Multiclassing into ' : 'Continuing as '}
                  {selectedClassOption.class}
                </span>
                <span style={{ color: '#888', marginLeft: '0.5rem' }}>
                  (Level {selectedClassOption.currentLevel} → {selectedClassOption.newLevel})
                </span>
              </div>
            )}

        {/* New Features Section */}
        {activeNewFeatures && activeNewFeatures.length > 0 && (
          <div style={{
            background: 'rgba(52, 152, 219, 0.1)',
            border: '1px solid #3498db',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: '#3498db', marginBottom: '0.75rem', fontSize: '1rem' }}>
              New Features at {selectedClassOption?.class || character.class} Level {selectedClassOption?.newLevel || levelUpInfo.newLevel}
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#ddd' }}>
              {activeNewFeatures.map((feature, idx) => (
                <li key={idx} style={{ marginBottom: '0.25rem' }}>{feature}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Proficiency Bonus Increase */}
        {levelUpInfo.proficiencyBonus.increased && (
          <div style={{
            background: 'rgba(46, 204, 113, 0.1)',
            border: '1px solid #2ecc71',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: '#2ecc71', marginBottom: '0.5rem', fontSize: '1rem' }}>
              Proficiency Bonus Increased!
            </h3>
            <p style={{ margin: 0, color: '#ddd' }}>
              Your proficiency bonus increases from +{levelUpInfo.proficiencyBonus.current} to +{levelUpInfo.proficiencyBonus.new}
            </p>
          </div>
        )}

        {/* Subclass Selection */}
        {activeChoices.needsSubclass && (
          <div style={{
            background: 'rgba(155, 89, 182, 0.1)',
            border: '1px solid #9b59b6',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: '#9b59b6', marginBottom: '0.75rem', fontSize: '1rem' }}>
              Choose Your Subclass
            </h3>
            <p style={{ color: '#bbb', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              At level {getActiveSubclassLevel()}, {selectedClassOption?.class || character.class}s choose their specialization.
            </p>
            <select
              value={selectedSubclass}
              onChange={(e) => setSelectedSubclass(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '1rem'
              }}
            >
              <option value="">Select a subclass...</option>
              {getSubclassOptions(selectedClassOption?.class).map(subclass => (
                <option key={subclass.name} value={subclass.name}>
                  {subclass.name}
                </option>
              ))}
            </select>
            {selectedSubclass && (
              <p style={{ marginTop: '0.75rem', color: '#bbb', fontSize: '0.85rem' }}>
                {getSubclassOptions(selectedClassOption?.class).find(s => s.name === selectedSubclass)?.description}
              </p>
            )}
          </div>
        )}

        {/* HP Gain Section */}
        <div style={{
          background: 'rgba(231, 76, 60, 0.1)',
          border: '1px solid #e74c3c',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ color: '#e74c3c', marginBottom: '0.75rem', fontSize: '1rem' }}>
            Hit Points
          </h3>
          <p style={{ color: '#bbb', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Roll your hit die (d{activeHpGain.hitDie}) or take the average.
            CON modifier: {getModifier(currentAbilityScores.con)}
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <button
              className={`button ${hpChoice === 'average' ? '' : 'button-secondary'}`}
              onClick={() => {
                setHpChoice('average')
                setHpRoll(null)
              }}
              style={{ flex: 1 }}
            >
              Take Average ({activeHpGain.average} HP)
            </button>
            <button
              className={`button ${hpChoice === 'roll' ? '' : 'button-secondary'}`}
              onClick={rollHitDie}
              style={{ flex: 1 }}
            >
              Roll d{activeHpGain.hitDie}
            </button>
          </div>

          {hpChoice === 'roll' && hpRoll !== null && (
            <div style={{
              textAlign: 'center',
              padding: '1rem',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px'
            }}>
              <p style={{ color: '#888', marginBottom: '0.25rem' }}>You rolled:</p>
              <p style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: hpRoll === 1 ? '#e74c3c' : hpRoll === activeHpGain.hitDie ? '#2ecc71' : '#fff',
                margin: 0
              }}>
                {hpRoll}
              </p>
              <p style={{ color: '#bbb', marginTop: '0.5rem' }}>
                Total HP gained: {Math.max(1, hpRoll + Math.floor((currentAbilityScores.con - 10) / 2))}
              </p>
              <button
                className="button button-secondary"
                onClick={rollHitDie}
                style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}
              >
                Re-roll
              </button>
            </div>
          )}

          <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.75rem' }}>
            Current HP: {character.current_hp}/{character.max_hp}
          </p>
        </div>

        {/* ASI Section */}
        {activeChoices.needsASI && (
          <div style={{
            background: 'rgba(241, 196, 15, 0.1)',
            border: '1px solid #f1c40f',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: '#f1c40f', marginBottom: '0.75rem', fontSize: '1rem' }}>
              Ability Score Improvement
            </h3>
            <p style={{ color: '#bbb', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Increase your ability scores by a total of 2 points. No ability can exceed 20.
            </p>

            <p style={{
              textAlign: 'center',
              color: asiPoints > 0 ? '#f1c40f' : '#2ecc71',
              fontWeight: 'bold',
              marginBottom: '1rem'
            }}>
              Points remaining: {asiPoints}
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem'
            }}>
              {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => {
                const currentScore = currentAbilityScores[ability] || 10
                const increase = asiDistribution[ability]
                const newScore = currentScore + increase
                const atMax = newScore >= 20

                return (
                  <div
                    key={ability}
                    style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '4px',
                      padding: '0.75rem',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{
                      color: '#888',
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      marginBottom: '0.25rem'
                    }}>
                      {ability}
                    </div>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color: increase > 0 ? '#2ecc71' : '#fff'
                    }}>
                      {newScore}
                      {increase > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#2ecc71' }}>
                          {' '}(+{increase})
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#3498db', fontSize: '0.85rem' }}>
                      {getModifier(newScore)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        onClick={() => handleAsiChange(ability, -1)}
                        disabled={increase <= 0}
                        style={{
                          width: '28px',
                          height: '28px',
                          padding: 0,
                          background: increase > 0 ? '#e74c3c' : '#444',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#fff',
                          cursor: increase > 0 ? 'pointer' : 'not-allowed',
                          opacity: increase > 0 ? 1 : 0.5
                        }}
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleAsiChange(ability, 1)}
                        disabled={asiPoints <= 0 || atMax || increase >= 2}
                        style={{
                          width: '28px',
                          height: '28px',
                          padding: 0,
                          background: (asiPoints > 0 && !atMax && increase < 2) ? '#2ecc71' : '#444',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#fff',
                          cursor: (asiPoints > 0 && !atMax && increase < 2) ? 'pointer' : 'not-allowed',
                          opacity: (asiPoints > 0 && !atMax && increase < 2) ? 1 : 0.5
                        }}
                      >
                        +
                      </button>
                    </div>
                    {atMax && increase === 0 && (
                      <div style={{ color: '#888', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                        Max
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Cantrips notification */}
        {activeChoices.newCantrips > 0 && (
          <div style={{
            background: 'rgba(52, 152, 219, 0.1)',
            border: '1px solid #3498db',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: '#3498db', marginBottom: '0.5rem', fontSize: '1rem' }}>
              New Cantrips Available
            </h3>
            <p style={{ color: '#bbb', margin: 0 }}>
              You can learn {activeChoices.newCantrips} new cantrip{activeChoices.newCantrips > 1 ? 's' : ''}.
              (Cantrip selection coming soon!)
            </p>
          </div>
        )}

        {/* Spells notification */}
        {activeChoices.newSpellsKnown > 0 && (
          <div style={{
            background: 'rgba(155, 89, 182, 0.1)',
            border: '1px solid #9b59b6',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: '#9b59b6', marginBottom: '0.5rem', fontSize: '1rem' }}>
              New Spells Available
            </h3>
            <p style={{ color: '#bbb', margin: 0 }}>
              You can learn {activeChoices.newSpellsKnown} new spell{activeChoices.newSpellsKnown > 1 ? 's' : ''}.
              (Spell selection coming soon!)
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button
            className="button button-secondary"
            onClick={onClose}
            style={{ flex: 1 }}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="button"
            onClick={handleSubmit}
            style={{ flex: 2 }}
            disabled={
              submitting ||
              (activeChoices.needsASI && asiPoints > 0) ||
              (activeChoices.needsSubclass && !selectedSubclass) ||
              (hpChoice === 'roll' && hpRoll === null)
            }
          >
            {submitting ? 'Leveling Up...' : (
              selectedClassOption?.type === 'multiclass'
                ? `Multiclass into ${selectedClassOption.class}!`
                : `Level Up to ${levelUpInfo.newLevel}!`
            )}
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  )
}

export default LevelUpModal
