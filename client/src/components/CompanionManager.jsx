import { useState, useEffect } from 'react'
import CompanionSheet from './CompanionSheet'
import PartyBuilder from './PartyBuilder'
import classesData from '../data/classes.json'

// Subclass selection levels by class
const SUBCLASS_LEVELS = {
  barbarian: 3,
  bard: 3,
  cleric: 1,
  druid: 2,
  fighter: 3,
  monk: 3,
  paladin: 3,
  ranger: 3,
  rogue: 3,
  sorcerer: 1,
  warlock: 1,
  wizard: 2,
  artificer: 3
}

function CompanionManager({ characterId, characterLevel, onCompanionChange }) {
  const [companions, setCompanions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCompanion, setSelectedCompanion] = useState(null)
  const [showRecruitModal, setShowRecruitModal] = useState(false)
  const [showPartyBuilder, setShowPartyBuilder] = useState(false)
  const [availableNpcs, setAvailableNpcs] = useState([])

  useEffect(() => {
    if (characterId) {
      fetchCompanions()
    }
  }, [characterId])

  const fetchCompanions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/companion/character/${characterId}`)
      if (!response.ok) throw new Error('Failed to fetch companions')
      const data = await response.json()
      setCompanions(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableNpcs = async () => {
    try {
      const response = await fetch(`/api/companion/available/${characterId}`)
      if (!response.ok) throw new Error('Failed to fetch available NPCs')
      const data = await response.json()
      setAvailableNpcs(data)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRecruit = async (npcId, progressionType = 'npc_stats', companionClass = null, companionSubclass = null) => {
    try {
      const response = await fetch('/api/companion/recruit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npc_id: npcId,
          recruited_by_character_id: characterId,
          progression_type: progressionType,
          companion_class: companionClass,
          companion_subclass: companionSubclass
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to recruit companion')
      }

      await fetchCompanions()
      setShowRecruitModal(false)
      if (onCompanionChange) onCompanionChange()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDismiss = async (companionId) => {
    if (!confirm('Are you sure you want to dismiss this companion?')) return

    try {
      const response = await fetch(`/api/companion/${companionId}/dismiss`, {
        method: 'POST'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to dismiss companion')
      }

      await fetchCompanions()
      setSelectedCompanion(null)
      if (onCompanionChange) onCompanionChange()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCompanionUpdate = async () => {
    await fetchCompanions()
    if (onCompanionChange) onCompanionChange()
  }

  const openRecruitModal = async () => {
    await fetchAvailableNpcs()
    setShowRecruitModal(true)
  }

  const handlePartyMemberCreated = async (companion) => {
    setShowPartyBuilder(false)
    await fetchCompanions()
    if (onCompanionChange) onCompanionChange()
  }

  if (loading) {
    return <div style={{ padding: '1rem', color: '#888' }}>Loading companions...</div>
  }

  return (
    <div className="companion-manager">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: 0, color: '#9b59b6' }}>Companions</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="button"
            onClick={() => setShowPartyBuilder(true)}
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
          >
            + Create Party Member
          </button>
          <button
            className="button button-secondary"
            onClick={openRecruitModal}
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
          >
            + Recruit NPC
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(231, 76, 60, 0.2)',
          border: '1px solid #e74c3c',
          borderRadius: '4px',
          padding: '0.5rem',
          marginBottom: '1rem',
          color: '#e74c3c',
          fontSize: '0.85rem'
        }}>
          {error}
        </div>
      )}

      {companions.length === 0 ? (
        <p style={{ color: '#888', fontSize: '0.9rem', fontStyle: 'italic' }}>
          No companions yet. Recruit NPCs during your adventures!
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {companions.map(companion => (
            <div
              key={companion.id}
              onClick={() => setSelectedCompanion(companion)}
              style={{
                background: 'rgba(155, 89, 182, 0.1)',
                border: '1px solid #9b59b6',
                borderRadius: '8px',
                padding: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(155, 89, 182, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(155, 89, 182, 0.1)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {companion.avatar && (
                  <img
                    src={companion.avatar}
                    alt={companion.name}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      objectFit: 'cover'
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', color: '#fff' }}>
                    {companion.nickname || companion.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>
                    {companion.race} {companion.occupation && `- ${companion.occupation}`}
                  </div>
                  {companion.progression_type === 'class_based' && (
                    <div style={{ fontSize: '0.8rem', color: '#3498db' }}>
                      Level {companion.companion_level} {companion.companion_class}
                      {companion.companion_subclass && ` (${companion.companion_subclass})`}
                    </div>
                  )}
                </div>
                {companion.progression_type === 'class_based' && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>HP</div>
                    <div style={{
                      color: companion.companion_current_hp < companion.companion_max_hp * 0.5
                        ? '#e74c3c'
                        : '#2ecc71',
                      fontWeight: 'bold'
                    }}>
                      {companion.companion_current_hp}/{companion.companion_max_hp}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Companion Detail Modal */}
      {selectedCompanion && (
        <CompanionSheet
          companion={selectedCompanion}
          onClose={() => setSelectedCompanion(null)}
          onDismiss={() => handleDismiss(selectedCompanion.id)}
          onUpdate={handleCompanionUpdate}
        />
      )}

      {/* Recruit Modal */}
      {showRecruitModal && (
        <div className="modal-overlay" onClick={() => setShowRecruitModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <h2 style={{ color: '#9b59b6', marginBottom: '1rem' }}>Recruit Companion</h2>

            {availableNpcs.length === 0 ? (
              <p style={{ color: '#888' }}>
                No NPCs are available for recruitment. NPCs must be marked as "Companion Available"
                in the NPC manager to appear here.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {availableNpcs.map(npc => (
                  <RecruitCard
                    key={npc.id}
                    npc={npc}
                    onRecruit={handleRecruit}
                    characterLevel={characterLevel}
                  />
                ))}
              </div>
            )}

            <button
              className="button button-secondary"
              onClick={() => setShowRecruitModal(false)}
              style={{ marginTop: '1rem', width: '100%' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Party Builder Modal */}
      {showPartyBuilder && (
        <PartyBuilder
          characterId={characterId}
          characterLevel={characterLevel}
          onComplete={handlePartyMemberCreated}
          onCancel={() => setShowPartyBuilder(false)}
        />
      )}
    </div>
  )
}

function RecruitCard({ npc, onRecruit, characterLevel }) {
  const [expanded, setExpanded] = useState(false)
  const [progressionType, setProgressionType] = useState('npc_stats')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubclass, setSelectedSubclass] = useState('')

  const classes = [
    'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter',
    'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer',
    'Warlock', 'Wizard', 'Artificer'
  ]

  // Get subclass options for the selected class
  const getSubclassOptions = () => {
    if (!selectedClass) return []
    const classKey = selectedClass.toLowerCase()
    return classesData[classKey]?.subclasses || []
  }

  // Check if subclass selection is needed at this level
  const needsSubclass = () => {
    if (!selectedClass) return false
    const classKey = selectedClass.toLowerCase()
    const subclassLevel = SUBCLASS_LEVELS[classKey] || 3
    // Companion starts at character's level, so check if that's >= subclass level
    return (characterLevel || 1) >= subclassLevel
  }

  // Reset subclass when class changes
  const handleClassChange = (cls) => {
    setSelectedClass(cls)
    setSelectedSubclass('')
  }

  return (
    <div style={{
      background: 'rgba(52, 152, 219, 0.1)',
      border: '1px solid #3498db',
      borderRadius: '8px',
      padding: '0.75rem',
      cursor: 'pointer'
    }}>
      <div onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {npc.avatar && (
            <img
              src={npc.avatar}
              alt={npc.name}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', color: '#fff' }}>
              {npc.name}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#888' }}>
              {npc.race} {npc.occupation && `- ${npc.occupation}`}
            </div>
          </div>
          <span style={{ color: '#888' }}>{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #444' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#bbb', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>
              Progression Type
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`button ${progressionType === 'npc_stats' ? '' : 'button-secondary'}`}
                onClick={() => setProgressionType('npc_stats')}
                style={{ flex: 1, fontSize: '0.8rem' }}
              >
                NPC Stats
              </button>
              <button
                className={`button ${progressionType === 'class_based' ? '' : 'button-secondary'}`}
                onClick={() => setProgressionType('class_based')}
                style={{ flex: 1, fontSize: '0.8rem' }}
              >
                Class-Based
              </button>
            </div>
            <p style={{ color: '#888', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              {progressionType === 'npc_stats'
                ? 'Uses their original CR and stat block. No level progression.'
                : 'Starts with a class at your level. Full level progression available.'}
            </p>
          </div>

          {progressionType === 'class_based' && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ color: '#bbb', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>
                  Starting Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => handleClassChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                >
                  <option value="">Select a class...</option>
                  {classes.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              {/* Subclass Selection */}
              {selectedClass && needsSubclass() && getSubclassOptions().length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ color: '#bbb', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>
                    {selectedClass === 'Cleric' ? 'Divine Domain' :
                     selectedClass === 'Warlock' ? 'Otherworldly Patron' :
                     selectedClass === 'Sorcerer' ? 'Sorcerous Origin' :
                     selectedClass === 'Wizard' ? 'Arcane Tradition' :
                     selectedClass === 'Druid' ? 'Druid Circle' :
                     'Subclass'}
                  </label>
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
                  {selectedSubclass && (
                    <p style={{ color: '#888', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                      {getSubclassOptions().find(s => s.name === selectedSubclass)?.description}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <button
            className="button"
            onClick={() => onRecruit(npc.id, progressionType, selectedClass || null, selectedSubclass || null)}
            disabled={progressionType === 'class_based' && (!selectedClass || (needsSubclass() && getSubclassOptions().length > 0 && !selectedSubclass))}
            style={{ width: '100%' }}
          >
            Recruit {npc.name}
          </button>
        </div>
      )}
    </div>
  )
}

export default CompanionManager
