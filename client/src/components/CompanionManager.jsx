import { useState, useEffect } from 'react'
import CompanionSheet from './CompanionSheet'
import PartyBuilder from './PartyBuilder'

// Maximum active companions allowed in party
const MAX_PARTY_SIZE = 12

function CompanionManager({ characterId, characterLevel, onCompanionChange, campaignConfig }) {
  const [companions, setCompanions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCompanion, setSelectedCompanion] = useState(null)
  const [showRecruitModal, setShowRecruitModal] = useState(false)
  const [showPartyBuilder, setShowPartyBuilder] = useState(false)
  const [npcToRecruit, setNpcToRecruit] = useState(null) // NPC to pre-fill PartyBuilder with
  const [availableNpcs, setAvailableNpcs] = useState([])
  const [activeTab, setActiveTab] = useState('companions') // 'companions' or 'npcs'
  const [allNpcs, setAllNpcs] = useState([])
  const [npcSearchQuery, setNpcSearchQuery] = useState('')
  const [selectedNpcForView, setSelectedNpcForView] = useState(null)

  useEffect(() => {
    if (characterId) {
      fetchCompanions()
    }
  }, [characterId])

  useEffect(() => {
    if (activeTab === 'npcs') {
      fetchAllNpcs()
    }
  }, [activeTab])

  const fetchAllNpcs = async () => {
    try {
      const response = await fetch('/api/npc')
      if (!response.ok) throw new Error('Failed to fetch NPCs')
      const data = await response.json()
      setAllNpcs(data)
    } catch (err) {
      console.error('Error fetching NPCs:', err)
    }
  }

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
    setNpcToRecruit(null)
    await fetchCompanions()
    if (onCompanionChange) onCompanionChange()
  }

  if (loading) {
    return <div style={{ padding: '1rem', color: '#888' }}>Loading companions...</div>
  }

  // Filter NPCs based on search query
  const filteredNpcs = allNpcs.filter(npc => {
    if (!npcSearchQuery) return true
    const query = npcSearchQuery.toLowerCase()
    return (
      npc.name?.toLowerCase().includes(query) ||
      npc.nickname?.toLowerCase().includes(query) ||
      npc.occupation?.toLowerCase().includes(query) ||
      npc.race?.toLowerCase().includes(query) ||
      npc.current_location?.toLowerCase().includes(query)
    )
  })

  // Check if we can add more companions
  const activeCompanions = companions.filter(c => c.status === 'active')
  const canAddMore = activeCompanions.length < MAX_PARTY_SIZE

  // Determine if "Create Party Member" should be shown based on campaign type
  // Hide for ongoing saga campaigns (campaign_length === 'saga' or 'ongoing')
  const showCreateButton = !campaignConfig ||
    !['saga', 'ongoing'].includes(campaignConfig.campaign_length)

  return (
    <div className="companion-manager">
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #444',
        marginBottom: '1rem'
      }}>
        <button
          onClick={() => setActiveTab('companions')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'companions' ? 'rgba(155, 89, 182, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'companions' ? '2px solid #9b59b6' : '2px solid transparent',
            color: activeTab === 'companions' ? '#9b59b6' : '#888',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'companions' ? 'bold' : 'normal'
          }}
        >
          Party ({activeCompanions.length}/{MAX_PARTY_SIZE})
        </button>
        <button
          onClick={() => setActiveTab('npcs')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'npcs' ? 'rgba(230, 126, 34, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'npcs' ? '2px solid #e67e22' : '2px solid transparent',
            color: activeTab === 'npcs' ? '#e67e22' : '#888',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'npcs' ? 'bold' : 'normal'
          }}
        >
          All NPCs ({allNpcs.length})
        </button>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: 0, color: activeTab === 'companions' ? '#9b59b6' : '#e67e22' }}>
          {activeTab === 'companions' ? 'Companions' : 'Known NPCs'}
        </h3>
        {activeTab === 'companions' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {showCreateButton && (
              <button
                className="button"
                onClick={() => setShowPartyBuilder(true)}
                disabled={!canAddMore}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                title={!canAddMore ? `Party limit reached (${MAX_PARTY_SIZE})` : ''}
              >
                + Create Party Member
              </button>
            )}
            <button
              className="button button-secondary"
              onClick={openRecruitModal}
              disabled={!canAddMore}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
              title={!canAddMore ? `Party limit reached (${MAX_PARTY_SIZE})` : ''}
            >
              + Recruit NPC
            </button>
          </div>
        )}
        {activeTab === 'npcs' && (
          <input
            type="text"
            placeholder="Search NPCs..."
            value={npcSearchQuery}
            onChange={(e) => setNpcSearchQuery(e.target.value)}
            style={{
              padding: '0.4rem 0.75rem',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '0.85rem',
              width: '200px'
            }}
          />
        )}
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

      {/* Companions Tab Content */}
      {activeTab === 'companions' && (
        <>
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
        </>
      )}

      {/* NPCs Tab Content */}
      {activeTab === 'npcs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredNpcs.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.9rem', fontStyle: 'italic' }}>
              {npcSearchQuery ? 'No NPCs match your search.' : 'No NPCs in the database yet.'}
            </p>
          ) : (
            filteredNpcs.map(npc => (
              <NpcCard
                key={npc.id}
                npc={npc}
                isRecruited={companions.some(c => c.npc_id === npc.id)}
                onSelect={() => setSelectedNpcForView(npc)}
              />
            ))
          )}
        </div>
      )}

      {/* NPC Detail Modal */}
      {selectedNpcForView && (
        <div className="modal-overlay" onClick={() => setSelectedNpcForView(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <NpcDetailView
              npc={selectedNpcForView}
              isRecruited={companions.some(c => c.npc_id === selectedNpcForView.id)}
              onClose={() => setSelectedNpcForView(null)}
              onRecruit={canAddMore && selectedNpcForView.campaign_availability === 'companion' ? () => {
                // Open PartyBuilder with NPC data pre-filled
                setNpcToRecruit(selectedNpcForView)
                setSelectedNpcForView(null)
                setShowPartyBuilder(true)
              } : null}
            />
          </div>
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

      {/* Recruit Modal - NPC Picker that opens PartyBuilder */}
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
                      // Open PartyBuilder with this NPC pre-filled
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
                          👤
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>
                          {npc.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>
                          {npc.race} {npc.occupation && `• ${npc.occupation}`}
                        </div>
                        {(npc.personality_trait_1 || npc.personality_trait_2) && (
                          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                            {[npc.personality_trait_1, npc.personality_trait_2].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                      <div style={{ color: '#3498db', fontSize: '0.8rem' }}>
                        Select →
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
          characterId={characterId}
          characterLevel={characterLevel}
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

// NPC Card for the NPC viewer tab
function NpcCard({ npc, isRecruited, onSelect }) {
  return (
    <div
      onClick={onSelect}
      style={{
        background: isRecruited ? 'rgba(155, 89, 182, 0.1)' : 'rgba(230, 126, 34, 0.1)',
        border: `1px solid ${isRecruited ? '#9b59b6' : '#e67e22'}`,
        borderRadius: '8px',
        padding: '0.75rem',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = isRecruited ? 'rgba(155, 89, 182, 0.2)' : 'rgba(230, 126, 34, 0.2)'}
      onMouseLeave={(e) => e.currentTarget.style.background = isRecruited ? 'rgba(155, 89, 182, 0.1)' : 'rgba(230, 126, 34, 0.1)'}
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
            👤
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>
              {npc.nickname ? `"${npc.nickname}" ` : ''}{npc.name}
            </span>
            {isRecruited && (
              <span style={{
                fontSize: '0.65rem',
                background: '#9b59b6',
                color: '#fff',
                padding: '0.15rem 0.4rem',
                borderRadius: '3px'
              }}>
                IN PARTY
              </span>
            )}
            {npc.campaign_availability === 'companion' && !isRecruited && (
              <span style={{
                fontSize: '0.65rem',
                background: '#27ae60',
                color: '#fff',
                padding: '0.15rem 0.4rem',
                borderRadius: '3px'
              }}>
                RECRUITABLE
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>
            {npc.age && `${npc.age} `}
            {npc.gender && `${npc.gender} `}
            {npc.race}
            {npc.occupation && ` • ${npc.occupation}`}
          </div>
          {npc.current_location && (
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              📍 {npc.current_location}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#888' }}>
          <div>CR {npc.cr || '0'}</div>
          <div>AC {npc.ac || 10} | HP {npc.hp || 4}</div>
        </div>
      </div>
    </div>
  )
}

// NPC Detail View modal
function NpcDetailView({ npc, isRecruited, onClose, onRecruit }) {
  const getModifier = (score) => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : mod.toString()
  }

  // Parse ability scores if string
  const abilityScores = typeof npc.ability_scores === 'string'
    ? JSON.parse(npc.ability_scores)
    : npc.ability_scores || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

  // Parse facial features if string
  const facialFeatures = (() => {
    if (!npc.facial_features) return []
    if (Array.isArray(npc.facial_features)) return npc.facial_features
    try { return JSON.parse(npc.facial_features) } catch { return [] }
  })()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          {npc.avatar ? (
            <img
              src={npc.avatar}
              alt={npc.name}
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '8px',
                objectFit: 'cover'
              }}
            />
          ) : (
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              color: 'rgba(255, 255, 255, 0.4)'
            }}>
              👤
            </div>
          )}
          <div>
            <h2 style={{ color: '#e67e22', margin: 0 }}>
              {npc.nickname ? `"${npc.nickname}" ` : ''}{npc.name}
            </h2>
            <p style={{ color: '#888', margin: '0.25rem 0' }}>
              {npc.age && `${npc.age} `}
              {npc.gender && `${npc.gender} `}
              {npc.race}
            </p>
            {npc.occupation && (
              <p style={{ color: '#aaa', margin: '0.25rem 0' }}>
                {npc.occupation}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              {isRecruited && (
                <span style={{
                  fontSize: '0.75rem',
                  background: '#9b59b6',
                  color: '#fff',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px'
                }}>
                  In Your Party
                </span>
              )}
              <span style={{
                fontSize: '0.75rem',
                background: npc.campaign_availability === 'companion' ? '#27ae60' :
                           npc.campaign_availability === 'hidden' ? '#7f8c8d' : '#3498db',
                color: '#fff',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px'
              }}>
                {npc.campaign_availability === 'companion' ? 'Recruitable' :
                 npc.campaign_availability === 'hidden' ? 'Hidden' :
                 npc.campaign_availability === 'mention_only' ? 'Mention Only' : 'Available'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#888',
            fontSize: '1.5rem',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.5rem',
        marginBottom: '1rem',
        background: 'rgba(0, 0, 0, 0.2)',
        padding: '0.75rem',
        borderRadius: '8px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#888' }}>CR</div>
          <div style={{ fontWeight: 'bold', color: '#fff' }}>{npc.cr || '0'}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#888' }}>AC</div>
          <div style={{ fontWeight: 'bold', color: '#fff' }}>{npc.ac || 10}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#888' }}>HP</div>
          <div style={{ fontWeight: 'bold', color: '#fff' }}>{npc.hp || 4}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#888' }}>Speed</div>
          <div style={{ fontWeight: 'bold', color: '#fff' }}>{npc.speed || '30 ft.'}</div>
        </div>
      </div>

      {/* Ability Scores */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '0.5rem',
        marginBottom: '1rem'
      }}>
        {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ab => (
          <div key={ab} style={{
            textAlign: 'center',
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '0.5rem',
            borderRadius: '4px'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>{ab}</div>
            <div style={{ fontWeight: 'bold', color: '#fff' }}>{abilityScores[ab] || 10}</div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>({getModifier(abilityScores[ab] || 10)})</div>
          </div>
        ))}
      </div>

      {/* Appearance */}
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ color: '#e67e22', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Appearance</h4>
        <p style={{ color: '#ccc', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
          {[
            npc.height && `${npc.height}`,
            npc.build && `${npc.build} build`,
            npc.skin_tone && `${npc.skin_tone} skin`,
            npc.hair_color && npc.hair_style && `${npc.hair_color} hair worn ${npc.hair_style}`,
            npc.eye_color && `${npc.eye_color} eyes`,
            facialFeatures.length > 0 && facialFeatures.join(', '),
            npc.facial_hair && npc.facial_hair !== 'clean-shaven' && npc.facial_hair,
            npc.distinguishing_marks && `Notable: ${npc.distinguishing_marks}`
          ].filter(Boolean).join('. ') || 'No description available.'}
        </p>
        {npc.clothing_style && <p style={{ color: '#888', fontSize: '0.8rem', margin: '0.25rem 0' }}>Clothing: {npc.clothing_style}</p>}
        {npc.voice && <p style={{ color: '#888', fontSize: '0.8rem', margin: '0.25rem 0' }}>Voice: {npc.voice}</p>}
      </div>

      {/* Personality */}
      {(npc.personality_trait_1 || npc.personality_trait_2 || npc.motivation || npc.fear) && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: '#e67e22', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Personality</h4>
          {(npc.personality_trait_1 || npc.personality_trait_2) && (
            <p style={{ color: '#ccc', fontSize: '0.85rem', margin: '0.25rem 0' }}>
              <strong>Traits:</strong> {[npc.personality_trait_1, npc.personality_trait_2].filter(Boolean).join(', ')}
            </p>
          )}
          {npc.mannerism && <p style={{ color: '#ccc', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Mannerism:</strong> {npc.mannerism}</p>}
          {npc.motivation && <p style={{ color: '#ccc', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Motivation:</strong> {npc.motivation}</p>}
          {npc.fear && <p style={{ color: '#ccc', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Fear:</strong> {npc.fear}</p>}
          {npc.quirk && <p style={{ color: '#ccc', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Quirk:</strong> {npc.quirk}</p>}
          {npc.secret && <p style={{ color: '#888', fontSize: '0.85rem', margin: '0.25rem 0', fontStyle: 'italic' }}><strong>Secret:</strong> {npc.secret}</p>}
        </div>
      )}

      {/* Location */}
      {(npc.current_location || npc.typical_locations) && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: '#e67e22', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Location</h4>
          {npc.current_location && <p style={{ color: '#ccc', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Current:</strong> {npc.current_location}</p>}
          {npc.typical_locations && <p style={{ color: '#ccc', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Usually found:</strong> {npc.typical_locations}</p>}
        </div>
      )}

      {/* Background Notes */}
      {npc.background_notes && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: '#e67e22', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Notes</h4>
          <p style={{ color: '#ccc', fontSize: '0.85rem', margin: 0 }}>{npc.background_notes}</p>
        </div>
      )}

      {/* Languages */}
      {npc.languages && (
        <p style={{ color: '#888', fontSize: '0.8rem' }}><strong>Languages:</strong> {npc.languages}</p>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        {onRecruit && !isRecruited && (
          <button
            className="button"
            onClick={onRecruit}
            style={{ flex: 1 }}
          >
            Recruit to Party
          </button>
        )}
        <button
          className="button button-secondary"
          onClick={onClose}
          style={{ flex: onRecruit && !isRecruited ? undefined : 1 }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default CompanionManager
