import { useState } from 'react'
import classesData from '../data/classes.json'
import racesData from '../data/races.json'
import spellsData from '../data/spells.json'

const ALL_CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter',
  'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer',
  'Warlock', 'Wizard', 'Artificer'
]

const BACKGROUNDS = [
  'Acolyte', 'Charlatan', 'Criminal', 'Entertainer', 'Folk Hero',
  'Guild Artisan', 'Hermit', 'Noble', 'Outlander', 'Sage',
  'Sailor', 'Soldier', 'Urchin'
]

const ABILITY_NAMES = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

const SUBCLASS_LEVELS = {
  barbarian: 3, bard: 3, cleric: 1, druid: 2, fighter: 3,
  monk: 3, paladin: 3, ranger: 3, rogue: 3, sorcerer: 1,
  warlock: 1, wizard: 2, artificer: 3
}

// Skills by ability
const ALL_SKILLS = {
  str: ['Athletics'],
  dex: ['Acrobatics', 'Sleight of Hand', 'Stealth'],
  int: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'],
  wis: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'],
  cha: ['Deception', 'Intimidation', 'Performance', 'Persuasion']
}

// Flatten skills for easy lookup
const SKILL_LIST = Object.values(ALL_SKILLS).flat()

// Roll 4d6 drop lowest
const roll4d6DropLowest = () => {
  const rolls = Array(4).fill(0).map(() => Math.floor(Math.random() * 6) + 1)
  rolls.sort((a, b) => b - a)
  return { total: rolls[0] + rolls[1] + rolls[2], rolls }
}

function PartyBuilder({ characterId, characterLevel, onComplete, onCancel }) {
  const [step, setStep] = useState(1)
  const [companionData, setCompanionData] = useState({
    name: '',
    nickname: '',
    race: '',
    subrace: '',
    gender: '',
    age: '',
    companionClass: '',
    subclass: '',
    level: characterLevel || 1,
    background: '',
    // Appearance
    height: '',
    build: '',
    hairColor: '',
    hairStyle: '',
    eyeColor: '',
    skinTone: '',
    distinguishingMarks: '',
    // Personality
    personalityTrait1: '',
    personalityTrait2: '',
    voice: '',
    mannerism: '',
    motivation: '',
    // Ability scores
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    // Skills
    skillProficiencies: [],
    // Spells (for casters)
    cantrips: [],
    spellsKnown: [],
    // Origin
    backstory: '',
    relationshipToParty: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Ability score generation state
  const [abilityMethod, setAbilityMethod] = useState('standard_array') // standard_array, point_buy, roll, manual
  const [standardArrayAssignments, setStandardArrayAssignments] = useState({
    str: null, dex: null, con: null, int: null, wis: null, cha: null
  })
  const [pointBuyPoints, setPointBuyPoints] = useState(27)
  const [rolledScores, setRolledScores] = useState([])
  const [rolledAssignments, setRolledAssignments] = useState({
    str: null, dex: null, con: null, int: null, wis: null, cha: null
  })

  // Get races from data file
  const races = Object.keys(racesData || {})
  const selectedRaceData = racesData?.[companionData.race.toLowerCase()]
  const subraces = selectedRaceData?.subraces?.map(s => s.name) || []

  // Get class data
  const selectedClassData = companionData.companionClass
    ? classesData[companionData.companionClass.toLowerCase()]
    : null
  const subclassOptions = selectedClassData?.subclasses || []
  const needsSubclass = companionData.companionClass &&
    companionData.level >= (SUBCLASS_LEVELS[companionData.companionClass.toLowerCase()] || 3)

  // Get skill options from class
  const classSkillOptions = selectedClassData?.skillOptions?.map(s =>
    s.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  ) || SKILL_LIST
  const numSkillChoices = selectedClassData?.skillChoices || 2

  // Get spell info for casters
  const isCaster = selectedClassData && (
    selectedClassData.spellcasting ||
    ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard', 'paladin', 'ranger'].includes(
      companionData.companionClass.toLowerCase()
    )
  )

  const updateField = (field, value) => {
    setCompanionData(prev => ({ ...prev, [field]: value }))
  }

  const updateAbilityScore = (ability, value) => {
    const numValue = Math.max(1, Math.min(20, parseInt(value) || 10))
    setCompanionData(prev => ({
      ...prev,
      abilityScores: { ...prev.abilityScores, [ability]: numValue }
    }))
  }

  // Point buy cost table (8 = 0 points, each increase costs more)
  const getPointBuyCost = (score) => {
    if (score <= 8) return 0
    if (score <= 13) return score - 8
    if (score === 14) return 7
    if (score === 15) return 9
    return 999 // Can't go above 15 in point buy
  }

  const getTotalPointBuyCost = (scores) => {
    return Object.values(scores).reduce((sum, score) => sum + getPointBuyCost(score), 0)
  }

  // Assign standard array value to an ability
  const assignStandardArray = (ability, value) => {
    // Remove this value from any other ability
    const newAssignments = { ...standardArrayAssignments }
    Object.keys(newAssignments).forEach(key => {
      if (newAssignments[key] === value) newAssignments[key] = null
    })
    newAssignments[ability] = value
    setStandardArrayAssignments(newAssignments)

    // Update ability scores
    const newScores = { ...companionData.abilityScores }
    Object.entries(newAssignments).forEach(([key, val]) => {
      newScores[key] = val || 10
    })
    setCompanionData(prev => ({ ...prev, abilityScores: newScores }))
  }

  // Roll all 6 ability scores
  const rollAllScores = () => {
    const scores = Array(6).fill(0).map(() => roll4d6DropLowest())
    setRolledScores(scores)
    setRolledAssignments({ str: null, dex: null, con: null, int: null, wis: null, cha: null })
  }

  // Assign rolled score to an ability
  const assignRolledScore = (ability, scoreIndex) => {
    const newAssignments = { ...rolledAssignments }
    // Remove this score from any other ability
    Object.keys(newAssignments).forEach(key => {
      if (newAssignments[key] === scoreIndex) newAssignments[key] = null
    })
    newAssignments[ability] = scoreIndex
    setRolledAssignments(newAssignments)

    // Update ability scores
    const newScores = { ...companionData.abilityScores }
    Object.entries(newAssignments).forEach(([key, idx]) => {
      newScores[key] = idx !== null ? rolledScores[idx].total : 10
    })
    setCompanionData(prev => ({ ...prev, abilityScores: newScores }))
  }

  // Point buy adjustment
  const adjustPointBuy = (ability, delta) => {
    const currentScore = companionData.abilityScores[ability]
    const newScore = currentScore + delta

    if (newScore < 8 || newScore > 15) return

    const newScores = { ...companionData.abilityScores, [ability]: newScore }
    const newCost = getTotalPointBuyCost(newScores)

    if (newCost <= 27) {
      setCompanionData(prev => ({ ...prev, abilityScores: newScores }))
      setPointBuyPoints(27 - newCost)
    }
  }

  // Toggle skill proficiency
  const toggleSkill = (skill) => {
    const current = companionData.skillProficiencies
    if (current.includes(skill)) {
      setCompanionData(prev => ({
        ...prev,
        skillProficiencies: current.filter(s => s !== skill)
      }))
    } else if (current.length < numSkillChoices) {
      setCompanionData(prev => ({
        ...prev,
        skillProficiencies: [...current, skill]
      }))
    }
  }

  // Toggle cantrip/spell selection
  const toggleSpell = (spell, isCantrip) => {
    const field = isCantrip ? 'cantrips' : 'spellsKnown'
    const current = companionData[field]
    if (current.includes(spell)) {
      setCompanionData(prev => ({
        ...prev,
        [field]: current.filter(s => s !== spell)
      }))
    } else {
      setCompanionData(prev => ({
        ...prev,
        [field]: [...current, spell]
      }))
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/companion/create-party-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruited_by_character_id: characterId,
          name: companionData.name,
          nickname: companionData.nickname || null,
          race: companionData.race,
          subrace: companionData.subrace || null,
          gender: companionData.gender || null,
          age: companionData.age || null,
          companion_class: companionData.companionClass,
          companion_subclass: companionData.subclass || null,
          level: companionData.level,
          background: companionData.background || null,
          // Appearance
          height: companionData.height || null,
          build: companionData.build || null,
          hair_color: companionData.hairColor || null,
          hair_style: companionData.hairStyle || null,
          eye_color: companionData.eyeColor || null,
          skin_tone: companionData.skinTone || null,
          distinguishing_marks: companionData.distinguishingMarks || null,
          // Personality
          personality_trait_1: companionData.personalityTrait1 || null,
          personality_trait_2: companionData.personalityTrait2 || null,
          voice: companionData.voice || null,
          mannerism: companionData.mannerism || null,
          motivation: companionData.motivation || null,
          // Ability scores
          ability_scores: companionData.abilityScores,
          // Skills
          skill_proficiencies: companionData.skillProficiencies,
          // Origin
          backstory: companionData.backstory || null,
          relationship_to_party: companionData.relationshipToParty || null
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create party member')
      }

      const data = await response.json()
      onComplete(data.companion)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Check if ability scores are fully assigned based on method
  const abilityScoresComplete = () => {
    if (abilityMethod === 'manual') return true
    if (abilityMethod === 'point_buy') return pointBuyPoints >= 0
    if (abilityMethod === 'standard_array') {
      return Object.values(standardArrayAssignments).every(v => v !== null)
    }
    if (abilityMethod === 'roll') {
      return rolledScores.length === 6 && Object.values(rolledAssignments).every(v => v !== null)
    }
    return false
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return companionData.name && companionData.race && companionData.companionClass
      case 2:
        // Ability scores must be complete, subclass if needed, skills selected
        const subclassOk = !needsSubclass || companionData.subclass
        const skillsOk = companionData.skillProficiencies.length >= numSkillChoices
        return abilityScoresComplete() && subclassOk && skillsOk
      case 3:
        return true // Appearance is optional
      case 4:
        return true // Personality is optional
      case 5:
        return true // Always can submit from review
      default:
        return false
    }
  }

  const getModifier = (score) => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : mod.toString()
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content party-builder"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h2 style={{ color: '#9b59b6', marginBottom: '0.5rem' }}>
          Create Party Member
        </h2>
        <p style={{ color: '#888', marginBottom: '1.5rem' }}>
          Build a new companion for your adventuring party
        </p>

        {/* Progress Steps */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.25rem',
          marginBottom: '2rem',
          flexWrap: 'wrap'
        }}>
          {['Basics', 'Class Choices', 'Appearance', 'Personality', 'Review'].map((label, idx) => (
            <div
              key={label}
              onClick={() => idx + 1 <= step && setStep(idx + 1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: idx + 1 <= step ? 'pointer' : 'default',
                opacity: idx + 1 <= step ? 1 : 0.5
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: step === idx + 1 ? '#9b59b6' : step > idx + 1 ? '#2ecc71' : '#444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.75rem'
              }}>
                {step > idx + 1 ? '✓' : idx + 1}
              </div>
              <span style={{
                color: step === idx + 1 ? '#fff' : '#888',
                fontSize: '0.75rem'
              }}>
                {label}
              </span>
              {idx < 4 && (
                <div style={{
                  width: '20px',
                  height: '2px',
                  background: step > idx + 1 ? '#2ecc71' : '#444'
                }} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.2)',
            border: '1px solid #e74c3c',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            color: '#e74c3c'
          }}>
            {error}
          </div>
        )}

        {/* Step 1: Basics */}
        {step === 1 && (
          <div className="builder-step">
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Basic Information</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={companionData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Enter name..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Nickname
                </label>
                <input
                  type="text"
                  value={companionData.nickname}
                  onChange={(e) => updateField('nickname', e.target.value)}
                  placeholder="Optional nickname..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Race *
                </label>
                <select
                  value={companionData.race}
                  onChange={(e) => {
                    updateField('race', e.target.value)
                    updateField('subrace', '') // Reset subrace when race changes
                  }}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                >
                  <option value="">Select race...</option>
                  {races.map(race => (
                    <option key={race} value={race}>
                      {race.charAt(0).toUpperCase() + race.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              {subraces.length > 0 && (
                <div>
                  <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                    Subrace
                  </label>
                  <select
                    value={companionData.subrace}
                    onChange={(e) => updateField('subrace', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff'
                    }}
                  >
                    <option value="">Select subrace...</option>
                    {subraces.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Gender
                </label>
                <select
                  value={companionData.gender}
                  onChange={(e) => updateField('gender', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Age
                </label>
                <input
                  type="text"
                  value={companionData.age}
                  onChange={(e) => updateField('age', e.target.value)}
                  placeholder="e.g. 25, Young Adult..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Class *
                </label>
                <select
                  value={companionData.companionClass}
                  onChange={(e) => updateField('companionClass', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                >
                  <option value="">Select class...</option>
                  {ALL_CLASSES.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Level
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={companionData.level}
                  onChange={(e) => updateField('level', parseInt(e.target.value) || 1)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Background
              </label>
              <select
                value={companionData.background}
                onChange={(e) => updateField('background', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff'
                }}
              >
                <option value="">Select background...</option>
                {BACKGROUNDS.map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Class Choices */}
        {step === 2 && (
          <div className="builder-step">
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Class Choices</h3>

            {/* Ability Score Generation Method */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#f1c40f', marginBottom: '0.75rem' }}>Ability Scores</h4>

              {/* Method Selection */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {[
                  { value: 'standard_array', label: 'Standard Array' },
                  { value: 'point_buy', label: 'Point Buy' },
                  { value: 'roll', label: 'Roll 4d6' },
                  { value: 'manual', label: 'Manual' }
                ].map(method => (
                  <button
                    key={method.value}
                    className={`button ${abilityMethod === method.value ? '' : 'button-secondary'}`}
                    onClick={() => setAbilityMethod(method.value)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  >
                    {method.label}
                  </button>
                ))}
              </div>

              {/* Standard Array UI */}
              {abilityMethod === 'standard_array' && (
                <div>
                  <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    Assign each value from the standard array (15, 14, 13, 12, 10, 8) to an ability score.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {Object.entries(ABILITY_NAMES).map(([key, name]) => (
                      <div
                        key={key}
                        style={{
                          background: 'rgba(241, 196, 15, 0.1)',
                          border: '1px solid #f1c40f',
                          borderRadius: '8px',
                          padding: '0.5rem'
                        }}
                      >
                        <div style={{ color: '#f1c40f', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                          {name}
                        </div>
                        <select
                          value={standardArrayAssignments[key] || ''}
                          onChange={(e) => assignStandardArray(key, e.target.value ? parseInt(e.target.value) : null)}
                          style={{
                            width: '100%',
                            padding: '0.4rem',
                            background: '#2a2a2a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff'
                          }}
                        >
                          <option value="">--</option>
                          {STANDARD_ARRAY.map(val => {
                            const usedElsewhere = Object.entries(standardArrayAssignments)
                              .some(([k, v]) => k !== key && v === val)
                            return (
                              <option key={val} value={val} disabled={usedElsewhere}>
                                {val} {usedElsewhere ? '(used)' : ''}
                              </option>
                            )
                          })}
                        </select>
                        <div style={{ color: '#f1c40f', fontSize: '0.8rem', textAlign: 'center', marginTop: '0.25rem' }}>
                          {standardArrayAssignments[key] ? getModifier(standardArrayAssignments[key]) : '--'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Point Buy UI */}
              {abilityMethod === 'point_buy' && (
                <div>
                  <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    Spend points to increase abilities. All scores start at 8. Range: 8-15.
                  </p>
                  <div style={{
                    background: 'rgba(52, 152, 219, 0.2)',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    marginBottom: '0.75rem',
                    textAlign: 'center'
                  }}>
                    <span style={{ color: '#3498db', fontWeight: 'bold' }}>
                      Points Remaining: {pointBuyPoints}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {Object.entries(ABILITY_NAMES).map(([key, name]) => (
                      <div
                        key={key}
                        style={{
                          background: 'rgba(241, 196, 15, 0.1)',
                          border: '1px solid #f1c40f',
                          borderRadius: '8px',
                          padding: '0.5rem',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ color: '#f1c40f', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                          {name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => adjustPointBuy(key, -1)}
                            disabled={companionData.abilityScores[key] <= 8}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              background: companionData.abilityScores[key] <= 8 ? '#333' : '#e74c3c',
                              border: 'none',
                              color: '#fff',
                              cursor: companionData.abilityScores[key] <= 8 ? 'not-allowed' : 'pointer'
                            }}
                          >-</button>
                          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', width: '30px' }}>
                            {companionData.abilityScores[key]}
                          </span>
                          <button
                            onClick={() => adjustPointBuy(key, 1)}
                            disabled={companionData.abilityScores[key] >= 15 || pointBuyPoints <= 0}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              background: (companionData.abilityScores[key] >= 15 || pointBuyPoints <= 0) ? '#333' : '#2ecc71',
                              border: 'none',
                              color: '#fff',
                              cursor: (companionData.abilityScores[key] >= 15 || pointBuyPoints <= 0) ? 'not-allowed' : 'pointer'
                            }}
                          >+</button>
                        </div>
                        <div style={{ color: '#f1c40f', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          {getModifier(companionData.abilityScores[key])}
                        </div>
                        <div style={{ color: '#888', fontSize: '0.7rem' }}>
                          Cost: {getPointBuyCost(companionData.abilityScores[key])}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Roll 4d6 Drop Lowest UI */}
              {abilityMethod === 'roll' && (
                <div>
                  <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    Roll 4d6 and drop the lowest die for each score, then assign them to abilities.
                  </p>
                  <button
                    className="button"
                    onClick={rollAllScores}
                    style={{ marginBottom: '1rem' }}
                  >
                    {rolledScores.length > 0 ? 'Re-Roll All Scores' : 'Roll Ability Scores'}
                  </button>

                  {rolledScores.length > 0 && (
                    <>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        {rolledScores.map((score, idx) => {
                          const isAssigned = Object.values(rolledAssignments).includes(idx)
                          return (
                            <div
                              key={idx}
                              style={{
                                background: isAssigned ? 'rgba(46, 204, 113, 0.2)' : 'rgba(52, 152, 219, 0.2)',
                                border: `1px solid ${isAssigned ? '#2ecc71' : '#3498db'}`,
                                borderRadius: '8px',
                                padding: '0.5rem',
                                textAlign: 'center',
                                minWidth: '60px'
                              }}
                            >
                              <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#fff' }}>
                                {score.total}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#888' }}>
                                [{score.rolls.join(', ')}]
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                        {Object.entries(ABILITY_NAMES).map(([key, name]) => (
                          <div
                            key={key}
                            style={{
                              background: 'rgba(241, 196, 15, 0.1)',
                              border: '1px solid #f1c40f',
                              borderRadius: '8px',
                              padding: '0.5rem'
                            }}
                          >
                            <div style={{ color: '#f1c40f', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                              {name}
                            </div>
                            <select
                              value={rolledAssignments[key] !== null ? rolledAssignments[key] : ''}
                              onChange={(e) => assignRolledScore(key, e.target.value !== '' ? parseInt(e.target.value) : null)}
                              style={{
                                width: '100%',
                                padding: '0.4rem',
                                background: '#2a2a2a',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                color: '#fff'
                              }}
                            >
                              <option value="">--</option>
                              {rolledScores.map((score, idx) => {
                                const usedElsewhere = Object.entries(rolledAssignments)
                                  .some(([k, v]) => k !== key && v === idx)
                                return (
                                  <option key={idx} value={idx} disabled={usedElsewhere}>
                                    {score.total} {usedElsewhere ? '(used)' : ''}
                                  </option>
                                )
                              })}
                            </select>
                            <div style={{ color: '#f1c40f', fontSize: '0.8rem', textAlign: 'center', marginTop: '0.25rem' }}>
                              {rolledAssignments[key] !== null ? getModifier(rolledScores[rolledAssignments[key]].total) : '--'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Manual Entry UI */}
              {abilityMethod === 'manual' && (
                <div>
                  <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    Enter ability scores manually (1-20).
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {Object.entries(ABILITY_NAMES).map(([key, name]) => (
                      <div
                        key={key}
                        style={{
                          background: 'rgba(241, 196, 15, 0.1)',
                          border: '1px solid #f1c40f',
                          borderRadius: '8px',
                          padding: '0.5rem',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ color: '#f1c40f', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                          {name}
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={companionData.abilityScores[key]}
                          onChange={(e) => updateAbilityScore(key, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.4rem',
                            background: '#2a2a2a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                            textAlign: 'center',
                            fontWeight: 'bold'
                          }}
                        />
                        <div style={{ color: '#f1c40f', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          {getModifier(companionData.abilityScores[key])}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Subclass Selection */}
            {needsSubclass && subclassOptions.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#9b59b6', marginBottom: '0.75rem' }}>
                  {companionData.companionClass === 'Cleric' ? 'Divine Domain' :
                   companionData.companionClass === 'Warlock' ? 'Otherworldly Patron' :
                   companionData.companionClass === 'Sorcerer' ? 'Sorcerous Origin' :
                   companionData.companionClass === 'Wizard' ? 'Arcane Tradition' :
                   companionData.companionClass === 'Druid' ? 'Druid Circle' :
                   'Subclass'}
                </h4>
                <select
                  value={companionData.subclass}
                  onChange={(e) => updateField('subclass', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #9b59b6',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                >
                  <option value="">Select {companionData.companionClass === 'Cleric' ? 'domain' : 'subclass'}...</option>
                  {subclassOptions.map(sub => (
                    <option key={sub.name} value={sub.name}>{sub.name}</option>
                  ))}
                </select>
                {companionData.subclass && (
                  <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    {subclassOptions.find(s => s.name === companionData.subclass)?.description}
                  </p>
                )}
              </div>
            )}

            {/* Skill Proficiencies */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#2ecc71', marginBottom: '0.5rem' }}>
                Skill Proficiencies
                <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                  (Choose {numSkillChoices} from your class)
                </span>
              </h4>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Selected: {companionData.skillProficiencies.length} / {numSkillChoices}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {classSkillOptions.map(skill => {
                  const isSelected = companionData.skillProficiencies.includes(skill)
                  const canSelect = isSelected || companionData.skillProficiencies.length < numSkillChoices
                  return (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      disabled={!canSelect}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '20px',
                        border: `1px solid ${isSelected ? '#2ecc71' : '#444'}`,
                        background: isSelected ? 'rgba(46, 204, 113, 0.2)' : 'transparent',
                        color: isSelected ? '#2ecc71' : canSelect ? '#ddd' : '#666',
                        cursor: canSelect ? 'pointer' : 'not-allowed',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      {skill}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Spell Selection for Casters */}
            {isCaster && (
              <div>
                <h4 style={{ color: '#3498db', marginBottom: '0.75rem' }}>
                  Spells
                  <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                    (Spell selection coming soon)
                  </span>
                </h4>
                <p style={{ color: '#888', fontSize: '0.85rem' }}>
                  As a {companionData.companionClass}, you have access to spells.
                  Spell selection will be available in a future update.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Appearance */}
        {step === 3 && (
          <div className="builder-step">
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Appearance</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Height
                </label>
                <input
                  type="text"
                  value={companionData.height}
                  onChange={(e) => updateField('height', e.target.value)}
                  placeholder="e.g. 5'10, Tall..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Build
                </label>
                <select
                  value={companionData.build}
                  onChange={(e) => updateField('build', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                >
                  <option value="">Select...</option>
                  <option value="Slim">Slim</option>
                  <option value="Athletic">Athletic</option>
                  <option value="Average">Average</option>
                  <option value="Muscular">Muscular</option>
                  <option value="Stocky">Stocky</option>
                  <option value="Heavyset">Heavyset</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Hair Color
                </label>
                <input
                  type="text"
                  value={companionData.hairColor}
                  onChange={(e) => updateField('hairColor', e.target.value)}
                  placeholder="e.g. Black, Auburn..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Hair Style
                </label>
                <input
                  type="text"
                  value={companionData.hairStyle}
                  onChange={(e) => updateField('hairStyle', e.target.value)}
                  placeholder="e.g. Long braids, Short..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Eye Color
                </label>
                <input
                  type="text"
                  value={companionData.eyeColor}
                  onChange={(e) => updateField('eyeColor', e.target.value)}
                  placeholder="e.g. Brown, Blue..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Skin Tone
                </label>
                <input
                  type="text"
                  value={companionData.skinTone}
                  onChange={(e) => updateField('skinTone', e.target.value)}
                  placeholder="e.g. Tan, Pale..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Distinguishing Marks
              </label>
              <textarea
                value={companionData.distinguishingMarks}
                onChange={(e) => updateField('distinguishingMarks', e.target.value)}
                placeholder="Scars, tattoos, birthmarks, or other notable features..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        )}

        {/* Step 4: Personality */}
        {step === 4 && (
          <div className="builder-step">
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Personality & Background</h3>

            <div>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Personality Trait
              </label>
              <textarea
                value={companionData.personalityTrait1}
                onChange={(e) => updateField('personalityTrait1', e.target.value)}
                placeholder="A defining personality trait..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Second Personality Trait
              </label>
              <textarea
                value={companionData.personalityTrait2}
                onChange={(e) => updateField('personalityTrait2', e.target.value)}
                placeholder="Another defining trait..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Voice/Speech
                </label>
                <input
                  type="text"
                  value={companionData.voice}
                  onChange={(e) => updateField('voice', e.target.value)}
                  placeholder="e.g. Gruff, Melodic..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Mannerism
                </label>
                <input
                  type="text"
                  value={companionData.mannerism}
                  onChange={(e) => updateField('mannerism', e.target.value)}
                  placeholder="e.g. Fidgets constantly..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Motivation
              </label>
              <input
                type="text"
                value={companionData.motivation}
                onChange={(e) => updateField('motivation', e.target.value)}
                placeholder="What drives this character?"
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff'
                }}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Relationship to Party
              </label>
              <textarea
                value={companionData.relationshipToParty}
                onChange={(e) => updateField('relationshipToParty', e.target.value)}
                placeholder="How did they join? What's their connection to the party?"
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Backstory
              </label>
              <textarea
                value={companionData.backstory}
                onChange={(e) => updateField('backstory', e.target.value)}
                placeholder="Brief history and background..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div className="builder-step">
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Review Your Party Member</h3>

            {/* Basic Info Card */}
            <div style={{
              background: 'rgba(155, 89, 182, 0.1)',
              border: '1px solid #9b59b6',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ color: '#9b59b6', margin: '0 0 0.75rem 0' }}>
                {companionData.nickname || companionData.name}
              </h4>
              {companionData.nickname && (
                <p style={{ color: '#888', margin: '0 0 0.25rem 0', fontSize: '0.9rem' }}>
                  {companionData.name}
                </p>
              )}
              <p style={{ color: '#ddd', margin: 0 }}>
                Level {companionData.level} {companionData.companionClass}
                {companionData.subclass && ` (${companionData.subclass})`}
                {companionData.race && ` • ${companionData.subrace || ''} ${companionData.race}`.trim()}
                {companionData.gender && ` • ${companionData.gender}`}
                {companionData.age && ` • ${companionData.age}`}
              </p>
              {companionData.background && (
                <p style={{ color: '#888', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                  Background: {companionData.background}
                </p>
              )}
            </div>

            {/* Skill Proficiencies */}
            {companionData.skillProficiencies.length > 0 && (
              <div style={{
                background: 'rgba(46, 204, 113, 0.1)',
                border: '1px solid #2ecc71',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ color: '#2ecc71', margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
                  Skill Proficiencies
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {companionData.skillProficiencies.map(skill => (
                    <span
                      key={skill}
                      style={{
                        padding: '0.25rem 0.6rem',
                        background: 'rgba(46, 204, 113, 0.2)',
                        border: '1px solid #2ecc71',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        color: '#2ecc71'
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Ability Scores */}
            <div style={{
              background: 'rgba(241, 196, 15, 0.1)',
              border: '1px solid #f1c40f',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ color: '#f1c40f', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                Ability Scores
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '0.5rem'
              }}>
                {Object.entries(ABILITY_NAMES).map(([key]) => (
                  <div
                    key={key}
                    style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '4px',
                      padding: '0.4rem',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ color: '#888', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                      {key}
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#fff' }}>
                      {companionData.abilityScores[key]}
                    </div>
                    <div style={{ color: '#f1c40f', fontSize: '0.8rem' }}>
                      {getModifier(companionData.abilityScores[key])}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Appearance */}
            {(companionData.height || companionData.build || companionData.hairColor ||
              companionData.eyeColor || companionData.skinTone || companionData.distinguishingMarks) && (
              <div style={{
                background: 'rgba(52, 152, 219, 0.1)',
                border: '1px solid #3498db',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ color: '#3498db', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                  Appearance
                </h4>
                <div style={{ color: '#ddd', fontSize: '0.9rem' }}>
                  {[
                    companionData.height && `Height: ${companionData.height}`,
                    companionData.build && `Build: ${companionData.build}`,
                    companionData.hairColor && `Hair: ${companionData.hairColor}${companionData.hairStyle ? `, ${companionData.hairStyle}` : ''}`,
                    companionData.eyeColor && `Eyes: ${companionData.eyeColor}`,
                    companionData.skinTone && `Skin: ${companionData.skinTone}`
                  ].filter(Boolean).join(' • ')}
                </div>
                {companionData.distinguishingMarks && (
                  <p style={{ color: '#888', margin: '0.5rem 0 0 0', fontStyle: 'italic', fontSize: '0.85rem' }}>
                    {companionData.distinguishingMarks}
                  </p>
                )}
              </div>
            )}

            {/* Personality */}
            {(companionData.personalityTrait1 || companionData.personalityTrait2 ||
              companionData.voice || companionData.motivation) && (
              <div style={{
                background: 'rgba(46, 204, 113, 0.1)',
                border: '1px solid #2ecc71',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ color: '#2ecc71', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                  Personality
                </h4>
                {companionData.personalityTrait1 && (
                  <p style={{ color: '#ddd', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                    {companionData.personalityTrait1}
                  </p>
                )}
                {companionData.personalityTrait2 && (
                  <p style={{ color: '#ddd', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                    {companionData.personalityTrait2}
                  </p>
                )}
                {companionData.voice && (
                  <p style={{ color: '#888', margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
                    Voice: {companionData.voice}
                  </p>
                )}
                {companionData.motivation && (
                  <p style={{ color: '#888', margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
                    Motivation: {companionData.motivation}
                  </p>
                )}
              </div>
            )}

            {/* Backstory */}
            {(companionData.backstory || companionData.relationshipToParty) && (
              <div style={{
                background: 'rgba(231, 76, 60, 0.1)',
                border: '1px solid #e74c3c',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <h4 style={{ color: '#e74c3c', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                  Background
                </h4>
                {companionData.relationshipToParty && (
                  <p style={{ color: '#ddd', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                    <strong style={{ color: '#e74c3c' }}>Party Connection:</strong> {companionData.relationshipToParty}
                  </p>
                )}
                {companionData.backstory && (
                  <p style={{ color: '#ddd', margin: 0, fontSize: '0.9rem' }}>
                    {companionData.backstory}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px solid #444'
        }}>
          <button
            className="button button-secondary"
            onClick={() => step === 1 ? onCancel() : setStep(step - 1)}
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>

          {step < 5 ? (
            <button
              className="button"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Continue →
            </button>
          ) : (
            <button
              className="button"
              onClick={handleSubmit}
              disabled={submitting || !canProceed()}
              style={{ background: '#2ecc71' }}
            >
              {submitting ? 'Creating...' : 'Create Party Member'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default PartyBuilder
