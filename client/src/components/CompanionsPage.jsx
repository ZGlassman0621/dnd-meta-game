import { useState, useEffect } from 'react'
import CompanionSheet from './CompanionSheet'
import PartyBuilder from './PartyBuilder'

// XP thresholds for each level (same as character progression)
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
]

function CompanionsPage({ character, onCharacterUpdated }) {
  const [companions, setCompanions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCompanion, setSelectedCompanion] = useState(null)
  const [showPartyBuilder, setShowPartyBuilder] = useState(false)
  const [showRecruitModal, setShowRecruitModal] = useState(false)
  const [availableNpcs, setAvailableNpcs] = useState([])
  const [npcToRecruit, setNpcToRecruit] = useState(null)

  const campaignConfig = character.campaign_config
    ? JSON.parse(character.campaign_config)
    : {}

  useEffect(() => {
    if (character?.id) {
      fetchCompanions()
    }
  }, [character?.id])

  const fetchCompanions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/companion/character/${character.id}`)
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
      const response = await fetch(`/api/companion/available/${character.id}`)
      if (!response.ok) throw new Error('Failed to fetch available NPCs')
      const data = await response.json()
      setAvailableNpcs(data)
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
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCompanionUpdate = async () => {
    await fetchCompanions()
  }

  const handlePartyMemberCreated = async () => {
    setShowPartyBuilder(false)
    setNpcToRecruit(null)
    await fetchCompanions()
  }

  const openRecruitModal = async () => {
    await fetchAvailableNpcs()
    setShowRecruitModal(true)
  }

  // Calculate XP progress for a companion
  const getXpProgress = (companion) => {
    const currentXp = companion.companion_experience || 0
    const level = companion.companion_level || 1
    const currentLevelXp = XP_THRESHOLDS[level - 1] || 0
    const nextLevelXp = XP_THRESHOLDS[level] || XP_THRESHOLDS[XP_THRESHOLDS.length - 1]
    const xpInCurrentLevel = currentXp - currentLevelXp
    const xpNeededForLevel = nextLevelXp - currentLevelXp
    const progress = level >= 20 ? 100 : (xpInCurrentLevel / xpNeededForLevel) * 100

    return {
      currentXp,
      nextLevelXp,
      xpToNext: nextLevelXp - currentXp,
      progress: Math.min(100, Math.max(0, progress)),
      isMaxLevel: level >= 20
    }
  }

  const activeCompanions = companions.filter(c => c.status === 'active')
  const MAX_PARTY_SIZE = 12
  const canAddMore = activeCompanions.length < MAX_PARTY_SIZE

  // Determine if "Create Party Member" should be shown based on campaign type
  const showCreateButton = !campaignConfig ||
    !['saga', 'ongoing'].includes(campaignConfig.campaign_length)

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#888' }}>Loading companions...</p>
      </div>
    )
  }

  return (
    <div className="container" style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h2 style={{ color: '#9b59b6', margin: 0 }}>Companions</h2>
          <p style={{ color: '#888', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Party Members: {activeCompanions.length} / {MAX_PARTY_SIZE}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {showCreateButton && (
            <button
              className="button"
              onClick={() => setShowPartyBuilder(true)}
              disabled={!canAddMore}
              title={!canAddMore ? `Party limit reached (${MAX_PARTY_SIZE})` : ''}
            >
              + Create Party Member
            </button>
          )}
          <button
            className="button button-secondary"
            onClick={openRecruitModal}
            disabled={!canAddMore}
            title={!canAddMore ? `Party limit reached (${MAX_PARTY_SIZE})` : ''}
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
          padding: '0.75rem',
          marginBottom: '1rem',
          color: '#e74c3c'
        }}>
          {error}
        </div>
      )}

      {/* Companions Grid */}
      {activeCompanions.length === 0 ? (
        <div style={{
          background: 'rgba(155, 89, 182, 0.1)',
          border: '1px solid #9b59b6',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <p style={{ color: '#888', fontSize: '1rem', margin: 0 }}>
            No companions yet. Recruit NPCs during your adventures or create custom party members!
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '1rem'
        }}>
          {activeCompanions.map(companion => (
            <CompanionCard
              key={companion.id}
              companion={companion}
              xpProgress={getXpProgress(companion)}
              onClick={() => setSelectedCompanion(companion)}
            />
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
            <h2 style={{ color: '#9b59b6', marginBottom: '0.5rem' }}>Recruit Companion</h2>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Select an NPC to recruit. You'll customize their class, abilities, and other details.
            </p>

            {availableNpcs.length === 0 ? (
              <p style={{ color: '#888' }}>
                No NPCs are available for recruitment. NPCs must be marked as "Companion Available"
                in the NPC manager to appear here.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {availableNpcs.map(npc => (
                  <div
                    key={npc.id}
                    onClick={() => {
                      setNpcToRecruit(npc)
                      setShowRecruitModal(false)
                      setShowPartyBuilder(true)
                    }}
                    style={{
                      background: 'rgba(52, 152, 219, 0.1)',
                      border: '1px solid #3498db',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(52, 152, 219, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(52, 152, 219, 0.1)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {npc.avatar ? (
                        <img
                          src={npc.avatar}
                          alt={npc.name}
                          style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '8px',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem',
                          color: 'rgba(255, 255, 255, 0.4)'
                        }}>
                          ?
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>
                          {npc.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>
                          {npc.race} {npc.occupation && `- ${npc.occupation}`}
                        </div>
                      </div>
                      <div style={{ color: '#3498db', fontSize: '0.8rem' }}>
                        Select
                      </div>
                    </div>
                  </div>
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
          characterId={character.id}
          characterLevel={character.level}
          prefillFromNpc={npcToRecruit}
          onComplete={handlePartyMemberCreated}
          onCancel={() => {
            setShowPartyBuilder(false)
            setNpcToRecruit(null)
          }}
        />
      )}
    </div>
  )
}

// Companion Card Component with HP and XP display
function CompanionCard({ companion, xpProgress, onClick }) {
  const isClassBased = companion.progression_type === 'class_based'

  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(155, 89, 182, 0.1)',
        border: '1px solid #9b59b6',
        borderRadius: '12px',
        padding: '1rem',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(155, 89, 182, 0.2)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(155, 89, 182, 0.1)'}
    >
      {/* Header with Avatar and Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
        {companion.avatar ? (
          <img
            src={companion.avatar}
            alt={companion.name}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid #9b59b6'
            }}
          />
        ) : (
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(155, 89, 182, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            color: '#9b59b6',
            border: '2px solid #9b59b6'
          }}>
            {(companion.nickname || companion.name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1.1rem' }}>
            {companion.nickname && companion.name
              ? `${companion.name.split(' ')[0]} "${companion.nickname}" ${companion.name.split(' ').slice(1).join(' ')}`
              : companion.name || companion.nickname}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#888' }}>
            {companion.race} {companion.occupation && `- ${companion.occupation}`}
          </div>
          {isClassBased && (
            <div style={{ fontSize: '0.85rem', color: '#3498db', fontWeight: '500' }}>
              Level {companion.companion_level} {companion.companion_class}
              {companion.companion_subclass && ` (${companion.companion_subclass})`}
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      {isClassBased && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem'
        }}>
          {/* HP */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            padding: '0.5rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.25rem'
            }}>
              <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase' }}>HP</span>
              <span style={{
                color: companion.companion_current_hp < companion.companion_max_hp * 0.5
                  ? '#e74c3c'
                  : '#2ecc71',
                fontWeight: 'bold',
                fontSize: '0.9rem'
              }}>
                {companion.companion_current_hp}/{companion.companion_max_hp}
              </span>
            </div>
            <div style={{
              height: '4px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${(companion.companion_current_hp / companion.companion_max_hp) * 100}%`,
                background: companion.companion_current_hp < companion.companion_max_hp * 0.5
                  ? '#e74c3c'
                  : '#2ecc71',
                transition: 'width 0.3s'
              }} />
            </div>
          </div>

          {/* XP */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            padding: '0.5rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.25rem'
            }}>
              <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase' }}>XP</span>
              <span style={{
                color: xpProgress.isMaxLevel ? '#f1c40f' : '#3498db',
                fontWeight: 'bold',
                fontSize: '0.9rem'
              }}>
                {xpProgress.isMaxLevel ? 'MAX' : `${xpProgress.xpToNext.toLocaleString()} to next`}
              </span>
            </div>
            <div style={{
              height: '4px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${xpProgress.progress}%`,
                background: xpProgress.isMaxLevel ? '#f1c40f' : '#3498db',
                transition: 'width 0.3s'
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Non-class based companions just show basic info */}
      {!isClassBased && (
        <div style={{
          background: 'rgba(241, 196, 15, 0.1)',
          border: '1px solid #f1c40f',
          borderRadius: '8px',
          padding: '0.5rem',
          fontSize: '0.8rem',
          color: '#f1c40f'
        }}>
          NPC Companion - Convert to class-based for full progression
        </div>
      )}
    </div>
  )
}

export default CompanionsPage
