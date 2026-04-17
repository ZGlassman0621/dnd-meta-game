import { useState, useEffect } from 'react'
import classesData from '../data/classes.json'
import CompanionEditor from './CompanionEditor'

// XP thresholds for each level (same as character progression)
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
]

function CompanionSheet({ companion, onClose, onDismiss, onUpdate }) {
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [levelUpInfo, setLevelUpInfo] = useState(null)
  const [loadingLevelUp, setLoadingLevelUp] = useState(false)
  const [error, setError] = useState(null)
  // Phase 6: spell slot + rest state
  const [spellSlots, setSpellSlots] = useState(null)
  const [resting, setResting] = useState(false)

  const isClassBased = companion.progression_type === 'class_based'

  useEffect(() => {
    let cancelled = false
    if (!isClassBased || !companion.id) {
      setSpellSlots(null)
      return
    }
    fetch(`/api/companion/${companion.id}/spell-slots`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setSpellSlots(data) })
      .catch(() => { if (!cancelled) setSpellSlots(null) })
    return () => { cancelled = true }
  }, [companion.id, isClassBased, companion.companion_level])

  const refetchSpellSlots = async () => {
    if (!isClassBased) return
    try {
      const r = await fetch(`/api/companion/${companion.id}/spell-slots`)
      if (r.ok) setSpellSlots(await r.json())
    } catch {}
  }

  const useSpellSlot = async (level) => {
    try {
      const r = await fetch(`/api/companion/${companion.id}/spell-slots/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      })
      if (!r.ok) {
        const data = await r.json()
        setError(data.error || 'Failed to use spell slot')
        return
      }
      await refetchSpellSlots()
    } catch (err) { setError(err.message) }
  }

  const restoreSpellSlot = async (level) => {
    try {
      const r = await fetch(`/api/companion/${companion.id}/spell-slots/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      })
      if (!r.ok) {
        const data = await r.json()
        setError(data.error || 'Failed to restore spell slot')
        return
      }
      await refetchSpellSlots()
    } catch (err) { setError(err.message) }
  }

  const handleRest = async (restType) => {
    setResting(true)
    setError(null)
    try {
      const r = await fetch(`/api/companion/${companion.id}/rest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restType })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to rest')
      await refetchSpellSlots()
      if (onUpdate) onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setResting(false)
    }
  }

  const abilityScores = isClassBased && companion.companion_ability_scores
    ? JSON.parse(companion.companion_ability_scores)
    : companion.npc_ability_scores
      ? JSON.parse(companion.npc_ability_scores)
      : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

  const getModifier = (score) => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : mod.toString()
  }

  const fetchLevelUpInfo = async () => {
    try {
      setLoadingLevelUp(true)
      const response = await fetch(`/api/companion/${companion.id}/level-up-info`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to get level-up info')
      }
      const data = await response.json()
      setLevelUpInfo(data)
      setShowLevelUp(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingLevelUp(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {companion.avatar && (
            <img
              src={companion.avatar}
              alt={companion.name}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid #9b59b6'
              }}
            />
          )}
          <div>
            <h2 style={{ color: '#9b59b6', margin: 0 }}>
              {companion.nickname && companion.name
                ? `${companion.name.split(' ')[0]} "${companion.nickname}" ${companion.name.split(' ').slice(1).join(' ')}`
                : companion.name || companion.nickname}
            </h2>
            <p style={{ color: '#bbb', margin: 0 }}>
              {companion.race} {companion.gender && `(${companion.gender})`}
              {companion.occupation && ` - ${companion.occupation}`}
            </p>
            {isClassBased && (
              <p style={{ color: '#3498db', margin: '0.25rem 0', fontWeight: 'bold' }}>
                Level {companion.companion_level} {companion.companion_class}
                {companion.companion_subclass && ` (${companion.companion_subclass})`}
              </p>
            )}
          </div>
        </div>

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

        {/* Stats Section */}
        {isClassBased ? (
          <ClassBasedStats
            companion={companion}
            abilityScores={abilityScores}
            getModifier={getModifier}
          />
        ) : (
          <NpcStats companion={companion} />
        )}

        {/* Ability Scores */}
        <div style={{
          background: 'rgba(52, 152, 219, 0.1)',
          border: '1px solid #3498db',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <h3 style={{ color: '#3498db', marginBottom: '0.75rem', fontSize: '1rem' }}>
            Ability Scores
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '0.5rem'
          }}>
            {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => (
              <div
                key={ability}
                style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '4px',
                  padding: '0.5rem',
                  textAlign: 'center'
                }}
              >
                <div style={{
                  color: '#888',
                  textTransform: 'uppercase',
                  fontSize: '0.7rem'
                }}>
                  {ability}
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>
                  {abilityScores[ability] || 10}
                </div>
                <div style={{ color: '#3498db', fontSize: '0.85rem' }}>
                  {getModifier(abilityScores[ability] || 10)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skill Proficiencies */}
        {companion.skill_proficiencies && (() => {
          const skills = typeof companion.skill_proficiencies === 'string'
            ? JSON.parse(companion.skill_proficiencies)
            : companion.skill_proficiencies;
          return skills.length > 0 ? (
            <div style={{
              background: 'rgba(46, 204, 113, 0.1)',
              border: '1px solid #2ecc71',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h3 style={{ color: '#2ecc71', marginBottom: '0.75rem', fontSize: '1rem' }}>
                Skill Proficiencies
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {skills.map(skill => (
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
          ) : null;
        })()}

        {/* Personality */}
        {(companion.personality_trait_1 || companion.personality_trait_2) && (
          <div style={{
            background: 'rgba(155, 89, 182, 0.1)',
            border: '1px solid #9b59b6',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h3 style={{ color: '#9b59b6', marginBottom: '0.75rem', fontSize: '1rem' }}>
              Personality
            </h3>
            {companion.personality_trait_1 && (
              <p style={{ color: '#ddd', margin: '0.25rem 0' }}>
                {companion.personality_trait_1}
              </p>
            )}
            {companion.personality_trait_2 && (
              <p style={{ color: '#ddd', margin: '0.25rem 0' }}>
                {companion.personality_trait_2}
              </p>
            )}
            {companion.voice && (
              <p style={{ color: '#888', fontStyle: 'italic', marginTop: '0.5rem' }}>
                Voice: {companion.voice}
              </p>
            )}
          </div>
        )}

        {/* Phase 6: Spell Slots — only render for class-based spellcasting companions */}
        {isClassBased && spellSlots && Object.keys(spellSlots.max || {}).filter(k => spellSlots.max[k] > 0).length > 0 && (
          <div style={{
            background: 'rgba(108, 99, 255, 0.1)',
            border: '1px solid #6c63ff',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h3 style={{ color: '#6c63ff', marginBottom: '0.75rem', fontSize: '1rem' }}>
              {companion.companion_class?.toLowerCase() === 'warlock' ? 'Pact Magic Slots' : 'Spell Slots'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {Object.entries(spellSlots.max)
                .filter(([, max]) => max > 0)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([level, max]) => {
                  const used = spellSlots.used?.[level] || 0
                  const remaining = max - used
                  return (
                    <div key={level} style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      padding: '0.3rem 0.5rem', background: 'rgba(255,255,255,0.03)',
                      borderRadius: '6px'
                    }}>
                      <span style={{ minWidth: '28px', fontWeight: 600, fontSize: '0.85rem', color: '#b0b0b0' }}>
                        L{level}
                      </span>
                      <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
                        {Array.from({ length: max }, (_, i) => (
                          <div key={i} style={{
                            width: '16px', height: '16px', borderRadius: '50%',
                            border: '2px solid ' + (i < remaining ? '#6c63ff' : '#444'),
                            background: i < remaining ? '#6c63ff' : 'transparent'
                          }} />
                        ))}
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#888', minWidth: '30px', textAlign: 'center' }}>
                        {remaining}/{max}
                      </span>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <button
                          onClick={() => useSpellSlot(Number(level))}
                          disabled={remaining <= 0}
                          style={{
                            background: remaining > 0 ? '#c0392b' : '#555',
                            color: '#fff', border: 'none', borderRadius: '4px',
                            padding: '2px 8px', fontSize: '0.72rem',
                            cursor: remaining > 0 ? 'pointer' : 'not-allowed',
                            opacity: remaining > 0 ? 1 : 0.5
                          }}
                        >Use</button>
                        <button
                          onClick={() => restoreSpellSlot(Number(level))}
                          disabled={used <= 0}
                          style={{
                            background: used > 0 ? '#27ae60' : '#555',
                            color: '#fff', border: 'none', borderRadius: '4px',
                            padding: '2px 8px', fontSize: '0.72rem',
                            cursor: used > 0 ? 'pointer' : 'not-allowed',
                            opacity: used > 0 ? 1 : 0.5
                          }}
                        >+1</button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginTop: '1.5rem'
        }}>
          {isClassBased && (
            <button
              className="button"
              onClick={fetchLevelUpInfo}
              disabled={loadingLevelUp || companion.companion_level >= 20}
              style={{ flex: 1 }}
            >
              {loadingLevelUp ? 'Loading...' : 'Level Up'}
            </button>
          )}

          {isClassBased && (
            <button
              className="button"
              onClick={() => handleRest('long')}
              disabled={resting}
              style={{ flex: 1, background: '#16a085' }}
              title="Restore full HP and all spell slots"
            >
              {resting ? 'Resting...' : 'Long Rest'}
            </button>
          )}

          {isClassBased && (
            <button
              className="button"
              onClick={() => handleRest('short')}
              disabled={resting}
              style={{ flex: 1, background: '#2980b9' }}
              title="Restore 50% missing HP (+pact slots for warlocks)"
            >
              {resting ? 'Resting...' : 'Short Rest'}
            </button>
          )}

          {!isClassBased && (
            <button
              className="button"
              onClick={() => setShowConvert(true)}
              style={{ flex: 1, background: '#3498db' }}
            >
              Convert to Class-Based
            </button>
          )}

          <button
            className="button"
            onClick={() => setShowEditor(true)}
            style={{ flex: 1, background: '#9b59b6' }}
          >
            Edit Details
          </button>

          <button
            className="button button-secondary"
            onClick={onDismiss}
            style={{ flex: 1 }}
          >
            Dismiss
          </button>

          <button
            className="button button-secondary"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            Close
          </button>
        </div>

        {/* Level Up Modal */}
        {showLevelUp && levelUpInfo && (
          <CompanionLevelUpModal
            companion={companion}
            levelUpInfo={levelUpInfo}
            onClose={() => setShowLevelUp(false)}
            onLevelUp={async () => {
              setShowLevelUp(false)
              onUpdate()
              onClose()
            }}
          />
        )}

        {/* Convert to Class Modal */}
        {showConvert && (
          <ConvertToClassModal
            companion={companion}
            onClose={() => setShowConvert(false)}
            onConvert={async () => {
              setShowConvert(false)
              onUpdate()
              onClose()
            }}
          />
        )}

        {/* Edit Companion Modal */}
        {showEditor && (
          <CompanionEditor
            companion={companion}
            onSave={async () => {
              setShowEditor(false)
              onUpdate()
              onClose()
            }}
            onCancel={() => setShowEditor(false)}
          />
        )}
      </div>
    </div>
  )
}

function ClassBasedStats({ companion, abilityScores, getModifier }) {
  const conMod = Math.floor((abilityScores.con - 10) / 2)

  // Calculate XP progress
  const currentXp = companion.companion_experience || 0
  const level = companion.companion_level || 1
  const currentLevelXp = XP_THRESHOLDS[level - 1] || 0
  const nextLevelXp = XP_THRESHOLDS[level] || XP_THRESHOLDS[XP_THRESHOLDS.length - 1]
  const xpInCurrentLevel = currentXp - currentLevelXp
  const xpNeededForLevel = nextLevelXp - currentLevelXp
  const xpProgress = level >= 20 ? 100 : (xpInCurrentLevel / xpNeededForLevel) * 100
  const isMaxLevel = level >= 20

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* Main Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.75rem',
        marginBottom: '0.75rem'
      }}>
        <div style={{
          background: 'rgba(231, 76, 60, 0.1)',
          border: '1px solid #e74c3c',
          borderRadius: '8px',
          padding: '0.75rem',
          textAlign: 'center'
        }}>
          <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
            HIT POINTS
          </div>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: companion.companion_current_hp < companion.companion_max_hp * 0.5
              ? '#e74c3c'
              : '#2ecc71'
          }}>
            {companion.companion_current_hp}/{companion.companion_max_hp}
          </div>
        </div>

        <div style={{
          background: 'rgba(52, 152, 219, 0.1)',
          border: '1px solid #3498db',
          borderRadius: '8px',
          padding: '0.75rem',
          textAlign: 'center'
        }}>
          <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
            LEVEL
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3498db' }}>
            {companion.companion_level}
          </div>
        </div>

        <div style={{
          background: 'rgba(241, 196, 15, 0.1)',
          border: '1px solid #f1c40f',
          borderRadius: '8px',
          padding: '0.75rem',
          textAlign: 'center'
        }}>
          <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
            PROFICIENCY
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f1c40f' }}>
            +{Math.ceil(companion.companion_level / 4) + 1}
          </div>
        </div>

        <div style={{
          background: 'rgba(155, 89, 182, 0.1)',
          border: '1px solid #9b59b6',
          borderRadius: '8px',
          padding: '0.75rem',
          textAlign: 'center'
        }}>
          <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
            TOTAL XP
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#9b59b6' }}>
            {currentXp.toLocaleString()}
          </div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div style={{
        background: 'rgba(155, 89, 182, 0.1)',
        border: '1px solid #9b59b6',
        borderRadius: '8px',
        padding: '0.75rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem'
        }}>
          <span style={{ color: '#888', fontSize: '0.8rem' }}>
            {isMaxLevel ? 'Maximum Level Reached' : `XP to Level ${level + 1}`}
          </span>
          <span style={{ color: '#9b59b6', fontWeight: 'bold', fontSize: '0.9rem' }}>
            {isMaxLevel ? 'MAX' : `${(nextLevelXp - currentXp).toLocaleString()} XP needed`}
          </span>
        </div>
        <div style={{
          height: '8px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, xpProgress))}%`,
            background: isMaxLevel
              ? 'linear-gradient(90deg, #f1c40f, #e67e22)'
              : 'linear-gradient(90deg, #9b59b6, #8e44ad)',
            transition: 'width 0.3s'
          }} />
        </div>
        {!isMaxLevel && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '0.25rem',
            fontSize: '0.7rem',
            color: '#666'
          }}>
            <span>{currentLevelXp.toLocaleString()} XP</span>
            <span>{nextLevelXp.toLocaleString()} XP</span>
          </div>
        )}
      </div>
    </div>
  )
}

function NpcStats({ companion }) {
  const originalStats = companion.original_stats_snapshot
    ? JSON.parse(companion.original_stats_snapshot)
    : null

  return (
    <div style={{
      background: 'rgba(241, 196, 15, 0.1)',
      border: '1px solid #f1c40f',
      borderRadius: '8px',
      padding: '1rem',
      marginBottom: '1rem'
    }}>
      <h3 style={{ color: '#f1c40f', marginBottom: '0.75rem', fontSize: '1rem' }}>
        NPC Stats
      </h3>
      {originalStats ? (
        <div style={{ display: 'flex', gap: '1.5rem', color: '#ddd' }}>
          {originalStats.cr && (
            <div>
              <span style={{ color: '#888' }}>CR:</span> {originalStats.cr}
            </div>
          )}
          {originalStats.ac && (
            <div>
              <span style={{ color: '#888' }}>AC:</span> {originalStats.ac}
            </div>
          )}
          {originalStats.hp && (
            <div>
              <span style={{ color: '#888' }}>HP:</span> {originalStats.hp}
            </div>
          )}
          {originalStats.speed && (
            <div>
              <span style={{ color: '#888' }}>Speed:</span> {originalStats.speed}
            </div>
          )}
        </div>
      ) : (
        <p style={{ color: '#888', margin: 0 }}>
          No stat block available
        </p>
      )}
    </div>
  )
}

function CompanionLevelUpModal({ companion, levelUpInfo, onClose, onLevelUp }) {
  const [hpChoice, setHpChoice] = useState('average')
  const [hpRoll, setHpRoll] = useState(null)
  const [selectedSubclass, setSelectedSubclass] = useState('')
  const [asiDistribution, setAsiDistribution] = useState({
    str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0
  })
  const [asiPoints, setAsiPoints] = useState(2)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const abilityScores = companion.companion_ability_scores
    ? JSON.parse(companion.companion_ability_scores)
    : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

  const getModifier = (score) => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : mod.toString()
  }

  const rollHitDie = () => {
    const roll = Math.floor(Math.random() * levelUpInfo.hpGain.hitDie) + 1
    setHpRoll(roll)
    setHpChoice('roll')
  }

  const handleAsiChange = (ability, delta) => {
    const currentValue = abilityScores[ability] || 10
    const currentIncrease = asiDistribution[ability]
    const newIncrease = currentIncrease + delta

    if (newIncrease < 0 || newIncrease > 2) return
    if (currentValue + newIncrease > 20) return

    const currentTotalUsed = Object.values(asiDistribution).reduce((a, b) => a + b, 0)
    const newTotalUsed = currentTotalUsed + delta

    if (newTotalUsed > 2 || newTotalUsed < 0) return

    setAsiDistribution(prev => ({ ...prev, [ability]: newIncrease }))
    setAsiPoints(2 - newTotalUsed)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const body = {
        hpRoll: hpChoice,
        rollValue: hpChoice === 'roll' ? hpRoll : undefined
      }

      if (levelUpInfo.choices.needsASI) {
        const increases = {}
        for (const [ability, value] of Object.entries(asiDistribution)) {
          if (value > 0) increases[ability] = value
        }
        body.asiChoice = { type: 'asi', increases }
      }

      if (levelUpInfo.choices.needsSubclass && selectedSubclass) {
        body.subclass = selectedSubclass
      }

      const response = await fetch(`/api/companion/${companion.id}/level-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to level up')
      }

      onLevelUp()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getSubclassOptions = () => {
    const classKey = companion.companion_class.toLowerCase()
    return classesData[classKey]?.subclasses || []
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}
      >
        <h2 style={{ color: '#f1c40f' }}>
          Level Up {companion.name}!
        </h2>
        <p style={{ color: '#bbb' }}>
          {companion.companion_class} Level {levelUpInfo.currentLevel} → {levelUpInfo.newLevel}
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

        {/* HP Section */}
        <div style={{
          background: 'rgba(231, 76, 60, 0.1)',
          border: '1px solid #e74c3c',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <h3 style={{ color: '#e74c3c', fontSize: '1rem' }}>Hit Points</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`button ${hpChoice === 'average' ? '' : 'button-secondary'}`}
              onClick={() => { setHpChoice('average'); setHpRoll(null) }}
              style={{ flex: 1 }}
            >
              Average ({levelUpInfo.hpGain.average} HP)
            </button>
            <button
              className={`button ${hpChoice === 'roll' ? '' : 'button-secondary'}`}
              onClick={rollHitDie}
              style={{ flex: 1 }}
            >
              Roll d{levelUpInfo.hpGain.hitDie}
            </button>
          </div>
          {hpChoice === 'roll' && hpRoll !== null && (
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <span style={{ color: '#888' }}>Rolled: </span>
              <span style={{ fontWeight: 'bold', color: '#fff' }}>
                {hpRoll} = {Math.max(1, hpRoll + levelUpInfo.hpGain.conMod)} HP
              </span>
            </div>
          )}
        </div>

        {/* Phase 5.5: Theme Tier Auto-Unlock (L5/L11/L17) */}
        {levelUpInfo.progression?.theme_tier_unlock && (
          <div style={{
            background: 'rgba(155, 89, 182, 0.1)',
            border: '1px solid #9b59b6',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h3 style={{ color: '#c084fc', fontSize: '1rem', marginTop: 0 }}>
              Theme Ability Unlocks · Tier {levelUpInfo.progression.theme_tier_unlock.tier}
            </h3>
            <div style={{ color: '#bbb', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
              {levelUpInfo.progression.theme_tier_unlock.theme_name}
            </div>
            <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              {levelUpInfo.progression.theme_tier_unlock.ability_name}
            </div>
            <div style={{ color: '#ddd', fontSize: '0.85rem' }}>
              {levelUpInfo.progression.theme_tier_unlock.ability_description}
            </div>
            {levelUpInfo.progression.theme_tier_unlock.flavor_text && (
              <div style={{ color: '#999', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '0.4rem' }}>
                {levelUpInfo.progression.theme_tier_unlock.flavor_text}
              </div>
            )}
          </div>
        )}

        {/* Phase 5.5: Ancestry Feat Auto-Pick (L3/L7/L13/L18) */}
        {levelUpInfo.progression?.ancestry_feat_auto_pick && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10b981',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h3 style={{ color: '#34d399', fontSize: '1rem', marginTop: 0 }}>
              Ancestry Feat · Tier {levelUpInfo.progression.ancestry_feat_auto_pick.tier}
            </h3>
            <div style={{ color: '#bbb', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
              Auto-picked (companions don't choose)
            </div>
            <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              {levelUpInfo.progression.ancestry_feat_auto_pick.feat_name}
            </div>
            <div style={{ color: '#ddd', fontSize: '0.85rem' }}>
              {levelUpInfo.progression.ancestry_feat_auto_pick.description}
            </div>
          </div>
        )}

        {/* Subclass Section */}
        {levelUpInfo.choices.needsSubclass && (
          <div style={{
            background: 'rgba(155, 89, 182, 0.1)',
            border: '1px solid #9b59b6',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h3 style={{ color: '#9b59b6', fontSize: '1rem' }}>Choose Subclass</h3>
            <select
              value={selectedSubclass}
              onChange={(e) => setSelectedSubclass(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff'
              }}
            >
              <option value="">Select a subclass...</option>
              {getSubclassOptions().map(sub => (
                <option key={sub.name} value={sub.name}>{sub.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* ASI Section */}
        {levelUpInfo.choices.needsASI && (
          <div style={{
            background: 'rgba(241, 196, 15, 0.1)',
            border: '1px solid #f1c40f',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h3 style={{ color: '#f1c40f', fontSize: '1rem' }}>
              Ability Score Improvement (Points: {asiPoints})
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem'
            }}>
              {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => {
                const currentScore = abilityScores[ability] || 10
                const increase = asiDistribution[ability]
                const newScore = currentScore + increase
                const atMax = newScore >= 20

                return (
                  <div
                    key={ability}
                    style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '4px',
                      padding: '0.5rem',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ color: '#888', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                      {ability}
                    </div>
                    <div style={{ color: increase > 0 ? '#2ecc71' : '#fff', fontWeight: 'bold' }}>
                      {newScore}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                      <button
                        onClick={() => handleAsiChange(ability, -1)}
                        disabled={increase <= 0}
                        style={{
                          width: '24px',
                          height: '24px',
                          padding: 0,
                          background: increase > 0 ? '#e74c3c' : '#444',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#fff',
                          cursor: increase > 0 ? 'pointer' : 'not-allowed'
                        }}
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleAsiChange(ability, 1)}
                        disabled={asiPoints <= 0 || atMax || increase >= 2}
                        style={{
                          width: '24px',
                          height: '24px',
                          padding: 0,
                          background: (asiPoints > 0 && !atMax && increase < 2) ? '#2ecc71' : '#444',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#fff',
                          cursor: (asiPoints > 0 && !atMax && increase < 2) ? 'pointer' : 'not-allowed'
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="button button-secondary"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            className="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              (levelUpInfo.choices.needsASI && asiPoints > 0) ||
              (levelUpInfo.choices.needsSubclass && !selectedSubclass) ||
              (hpChoice === 'roll' && hpRoll === null)
            }
            style={{ flex: 1 }}
          >
            {submitting ? 'Leveling Up...' : 'Level Up!'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConvertToClassModal({ companion, onClose, onConvert }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const classes = [
    'Artificer', 'Barbarian', 'Bard', 'Cleric', 'Druid',
    'Fighter', 'Keeper', 'Monk', 'Paladin', 'Ranger', 'Rogue',
    'Sorcerer', 'Warlock', 'Wizard'
  ]

  const handleConvert = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/companion/${companion.id}/convert-to-class`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companion_class: selectedClass })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to convert')
      }

      onConvert()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '400px' }}
      >
        <h2 style={{ color: '#3498db' }}>Convert to Class-Based</h2>
        <p style={{ color: '#bbb' }}>
          Give {companion.name} a D&D class for full level progression.
          They will start at your character's level.
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

        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#fff',
            marginBottom: '1rem'
          }}
        >
          <option value="">Select a class...</option>
          {classes.map(cls => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="button button-secondary"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            className="button"
            onClick={handleConvert}
            disabled={!selectedClass || submitting}
            style={{ flex: 1 }}
          >
            {submitting ? 'Converting...' : 'Convert'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CompanionSheet
