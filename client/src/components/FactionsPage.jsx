import { useState, useEffect, useCallback } from 'react'

// Standing level thresholds and labels
const STANDING_LEVELS = [
  { min: -100, max: -50, label: 'Hated', color: '#c0392b' },
  { min: -50, max: -25, label: 'Hostile', color: '#e74c3c' },
  { min: -25, max: -10, label: 'Unfriendly', color: '#e67e22' },
  { min: -10, max: 10, label: 'Neutral', color: '#95a5a6' },
  { min: 10, max: 25, label: 'Friendly', color: '#27ae60' },
  { min: 25, max: 50, label: 'Honored', color: '#2ecc71' },
  { min: 50, max: 100, label: 'Exalted', color: '#1abc9c' }
]

function getStandingLevel(value) {
  const level = STANDING_LEVELS.find(l => value >= l.min && value < l.max)
  return level || STANDING_LEVELS[3] // Default to neutral
}

function FactionsPage({ character, onCharacterUpdated }) {
  const [factions, setFactions] = useState([])
  const [standings, setStandings] = useState([])
  const [selectedFaction, setSelectedFaction] = useState(null)
  const [factionGoals, setFactionGoals] = useState([])
  const [factionMembers, setFactionMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateFaction, setShowCreateFaction] = useState(false)
  const [newFaction, setNewFaction] = useState({
    name: '',
    description: '',
    scope: 'regional',
    power_level: 5,
    alignment: 'neutral'
  })

  // Load factions and standings
  const loadData = useCallback(async () => {
    if (!character?.id || !character?.campaign_id) return
    setLoading(true)
    setError('')

    try {
      const [factionsRes, standingsRes] = await Promise.all([
        fetch(`/api/faction/campaign/${character.campaign_id}`),
        fetch(`/api/faction/standings/character/${character.id}`)
      ])

      if (factionsRes.ok) {
        const data = await factionsRes.json()
        setFactions(data)
      }

      if (standingsRes.ok) {
        const data = await standingsRes.json()
        setStandings(data)
      }
    } catch (err) {
      console.error('Error loading faction data:', err)
      setError('Failed to load faction data')
    }

    setLoading(false)
  }, [character?.id, character?.campaign_id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Load faction details when selected
  const loadFactionDetails = useCallback(async (factionId) => {
    try {
      const [goalsRes, membersRes] = await Promise.all([
        fetch(`/api/faction/${factionId}/goals/active`),
        fetch(`/api/faction/${factionId}/members`)
      ])

      if (goalsRes.ok) {
        const goals = await goalsRes.json()
        setFactionGoals(goals)
      }

      if (membersRes.ok) {
        const members = await membersRes.json()
        setFactionMembers(members)
      }
    } catch (err) {
      console.error('Error loading faction details:', err)
    }
  }, [])

  // Select a faction
  const handleSelectFaction = async (faction) => {
    setSelectedFaction(faction)
    await loadFactionDetails(faction.id)
  }

  // Get standing for a faction
  const getStandingForFaction = (factionId) => {
    return standings.find(s => s.faction_id === factionId)
  }

  // Join a faction
  const handleJoinFaction = async (factionId) => {
    try {
      const response = await fetch(`/api/faction/standing/${character.id}/${factionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membership_level: 'initiate' })
      })

      if (response.ok) {
        await loadData()
        if (selectedFaction?.id === factionId) {
          await loadFactionDetails(factionId)
        }
      }
    } catch (err) {
      console.error('Error joining faction:', err)
    }
  }

  // Leave a faction
  const handleLeaveFaction = async (factionId) => {
    try {
      const response = await fetch(`/api/faction/standing/${character.id}/${factionId}/leave`, {
        method: 'POST'
      })

      if (response.ok) {
        await loadData()
        if (selectedFaction?.id === factionId) {
          await loadFactionDetails(factionId)
        }
      }
    } catch (err) {
      console.error('Error leaving faction:', err)
    }
  }

  // Create a new faction
  const handleCreateFaction = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/faction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newFaction,
          campaign_id: character.campaign_id
        })
      })

      if (response.ok) {
        await loadData()
        setShowCreateFaction(false)
        setNewFaction({
          name: '',
          description: '',
          scope: 'regional',
          power_level: 5,
          alignment: 'neutral'
        })
      }
    } catch (err) {
      console.error('Error creating faction:', err)
    }
  }

  if (loading && factions.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading factions...</div>
      </div>
    )
  }

  if (!character?.campaign_id) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Character must be part of a campaign to view factions.</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Factions</h2>

      {error && <div style={styles.error}>{error}</div>}

      {/* Two column layout: faction list and detail */}
      <div style={styles.layout}>
        {/* Faction List */}
        <div style={styles.listColumn}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Known Factions</h3>
            <button
              onClick={() => setShowCreateFaction(!showCreateFaction)}
              style={styles.addButton}
            >
              {showCreateFaction ? '×' : '+'}
            </button>
          </div>

          {/* Create Faction Form */}
          {showCreateFaction && (
            <form onSubmit={handleCreateFaction} style={styles.createForm}>
              <input
                type="text"
                placeholder="Faction Name"
                value={newFaction.name}
                onChange={(e) => setNewFaction({ ...newFaction, name: e.target.value })}
                style={styles.input}
                required
              />
              <textarea
                placeholder="Description"
                value={newFaction.description}
                onChange={(e) => setNewFaction({ ...newFaction, description: e.target.value })}
                style={styles.textarea}
              />
              <div style={styles.formRow}>
                <select
                  value={newFaction.scope}
                  onChange={(e) => setNewFaction({ ...newFaction, scope: e.target.value })}
                  style={styles.select}
                >
                  <option value="local">Local</option>
                  <option value="regional">Regional</option>
                  <option value="continental">Continental</option>
                  <option value="global">Global</option>
                </select>
                <select
                  value={newFaction.alignment}
                  onChange={(e) => setNewFaction({ ...newFaction, alignment: e.target.value })}
                  style={styles.select}
                >
                  <option value="lawful good">Lawful Good</option>
                  <option value="neutral good">Neutral Good</option>
                  <option value="chaotic good">Chaotic Good</option>
                  <option value="lawful neutral">Lawful Neutral</option>
                  <option value="neutral">Neutral</option>
                  <option value="chaotic neutral">Chaotic Neutral</option>
                  <option value="lawful evil">Lawful Evil</option>
                  <option value="neutral evil">Neutral Evil</option>
                  <option value="chaotic evil">Chaotic Evil</option>
                </select>
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Power Level: {newFaction.power_level}</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={newFaction.power_level}
                  onChange={(e) => setNewFaction({ ...newFaction, power_level: parseInt(e.target.value) })}
                  style={styles.range}
                />
              </div>
              <button type="submit" style={styles.submitButton}>Create Faction</button>
            </form>
          )}

          {/* Faction Cards */}
          {factions.length === 0 ? (
            <p style={styles.emptyMessage}>No factions in this campaign yet.</p>
          ) : (
            <div style={styles.factionList}>
              {factions.map(faction => {
                const standing = getStandingForFaction(faction.id)
                const standingLevel = standing ? getStandingLevel(standing.standing_value) : null
                const isSelected = selectedFaction?.id === faction.id

                return (
                  <div
                    key={faction.id}
                    onClick={() => handleSelectFaction(faction)}
                    style={{
                      ...styles.factionCard,
                      ...(isSelected ? styles.factionCardSelected : {})
                    }}
                  >
                    <div style={styles.factionHeader}>
                      <span style={styles.factionName}>{faction.name}</span>
                      <span style={{
                        ...styles.scopeBadge,
                        backgroundColor: faction.scope === 'global' ? '#8e44ad'
                          : faction.scope === 'continental' ? '#2980b9'
                          : faction.scope === 'regional' ? '#27ae60'
                          : '#95a5a6'
                      }}>
                        {faction.scope}
                      </span>
                    </div>
                    {standing && (
                      <div style={styles.standingBar}>
                        <div style={styles.standingInfo}>
                          <span style={{ color: standingLevel.color }}>
                            {standingLevel.label}
                          </span>
                          <span style={styles.standingValue}>
                            {standing.standing_value > 0 ? '+' : ''}{standing.standing_value}
                          </span>
                        </div>
                        <div style={styles.standingTrack}>
                          <div
                            style={{
                              ...styles.standingFill,
                              width: `${((standing.standing_value + 100) / 200) * 100}%`,
                              backgroundColor: standingLevel.color
                            }}
                          />
                        </div>
                        {standing.is_member && (
                          <span style={styles.memberBadge}>
                            Member ({standing.membership_level})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Faction Detail */}
        <div style={styles.detailColumn}>
          {selectedFaction ? (
            <>
              <div style={styles.section}>
                <h3 style={styles.detailTitle}>{selectedFaction.name}</h3>
                <p style={styles.description}>{selectedFaction.description || 'No description available.'}</p>

                <div style={styles.statsGrid}>
                  <div style={styles.statCard}>
                    <div style={styles.statValue}>{selectedFaction.power_level}/10</div>
                    <div style={styles.statLabel}>Power</div>
                  </div>
                  <div style={styles.statCard}>
                    <div style={styles.statValue}>{selectedFaction.wealth_level || 5}/10</div>
                    <div style={styles.statLabel}>Wealth</div>
                  </div>
                  <div style={styles.statCard}>
                    <div style={styles.statValue}>{selectedFaction.military_strength || 5}/10</div>
                    <div style={styles.statLabel}>Military</div>
                  </div>
                  <div style={styles.statCard}>
                    <div style={styles.statValue}>{selectedFaction.political_influence || 5}/10</div>
                    <div style={styles.statLabel}>Political</div>
                  </div>
                </div>

                {selectedFaction.alignment && (
                  <div style={styles.alignmentBadge}>
                    {selectedFaction.alignment.charAt(0).toUpperCase() + selectedFaction.alignment.slice(1)}
                  </div>
                )}

                {/* Join/Leave buttons */}
                {(() => {
                  const standing = getStandingForFaction(selectedFaction.id)
                  if (standing?.is_member) {
                    return (
                      <button
                        onClick={() => handleLeaveFaction(selectedFaction.id)}
                        style={styles.leaveButton}
                      >
                        Leave Faction
                      </button>
                    )
                  } else {
                    return (
                      <button
                        onClick={() => handleJoinFaction(selectedFaction.id)}
                        style={styles.joinButton}
                      >
                        Join Faction
                      </button>
                    )
                  }
                })()}
              </div>

              {/* Active Goals */}
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Active Goals</h4>
                {factionGoals.length === 0 ? (
                  <p style={styles.emptyMessage}>No active goals.</p>
                ) : (
                  <div style={styles.goalList}>
                    {factionGoals.map(goal => (
                      <div key={goal.id} style={styles.goalCard}>
                        <div style={styles.goalHeader}>
                          <span style={styles.goalTitle}>{goal.title}</span>
                          <span style={{
                            ...styles.visibilityBadge,
                            backgroundColor: goal.visibility === 'public' ? '#27ae60'
                              : goal.visibility === 'rumored' ? '#f39c12'
                              : '#e74c3c'
                          }}>
                            {goal.visibility}
                          </span>
                        </div>
                        <p style={styles.goalDescription}>{goal.description}</p>
                        <div style={styles.progressBar}>
                          <div
                            style={{
                              ...styles.progressFill,
                              width: `${(goal.progress / goal.progress_max) * 100}%`
                            }}
                          />
                        </div>
                        <span style={styles.progressText}>
                          {goal.progress}/{goal.progress_max} ({Math.round((goal.progress / goal.progress_max) * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Members */}
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Notable Members</h4>
                {factionMembers.length === 0 ? (
                  <p style={styles.emptyMessage}>No known members.</p>
                ) : (
                  <div style={styles.memberList}>
                    {factionMembers.map(member => (
                      <div key={member.character_id} style={styles.memberCard}>
                        <span style={styles.memberName}>{member.character_name || `Character ${member.character_id}`}</span>
                        <span style={styles.memberLevel}>{member.membership_level}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={styles.noSelection}>
              <p>Select a faction to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '1rem',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '1.5rem',
    color: '#2c3e50'
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    color: '#666'
  },
  error: {
    padding: '1rem',
    backgroundColor: '#fee',
    color: '#c00',
    borderRadius: '0.5rem',
    marginBottom: '1rem'
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: '1.5rem'
  },
  listColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  detailColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem'
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    margin: 0,
    color: '#2c3e50'
  },
  addButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '1px solid #3498db',
    backgroundColor: '#fff',
    color: '#3498db',
    fontSize: '1.2rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  createForm: {
    backgroundColor: '#f8f9fa',
    padding: '1rem',
    borderRadius: '0.5rem',
    marginBottom: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  input: {
    padding: '0.5rem',
    border: '1px solid #ddd',
    borderRadius: '0.25rem',
    fontSize: '0.9rem'
  },
  textarea: {
    padding: '0.5rem',
    border: '1px solid #ddd',
    borderRadius: '0.25rem',
    fontSize: '0.9rem',
    minHeight: '60px',
    resize: 'vertical'
  },
  formRow: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center'
  },
  select: {
    flex: 1,
    padding: '0.5rem',
    border: '1px solid #ddd',
    borderRadius: '0.25rem',
    fontSize: '0.9rem'
  },
  label: {
    fontSize: '0.85rem',
    color: '#666',
    minWidth: '100px'
  },
  range: {
    flex: 1
  },
  submitButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  emptyMessage: {
    color: '#888',
    fontSize: '0.9rem',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '1rem'
  },
  factionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  factionCard: {
    padding: '0.75rem',
    backgroundColor: '#fff',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '2px solid transparent'
  },
  factionCardSelected: {
    borderColor: '#3498db',
    backgroundColor: '#f0f7ff'
  },
  factionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem'
  },
  factionName: {
    fontWeight: '600',
    color: '#2c3e50'
  },
  scopeBadge: {
    padding: '0.15rem 0.5rem',
    borderRadius: '0.25rem',
    fontSize: '0.7rem',
    color: '#fff',
    textTransform: 'uppercase'
  },
  standingBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  standingInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem'
  },
  standingValue: {
    color: '#666'
  },
  standingTrack: {
    height: '4px',
    backgroundColor: '#eee',
    borderRadius: '2px',
    overflow: 'hidden'
  },
  standingFill: {
    height: '100%',
    transition: 'width 0.3s'
  },
  memberBadge: {
    fontSize: '0.75rem',
    color: '#27ae60',
    marginTop: '0.25rem'
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: '0.75rem',
    padding: '1rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  detailTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    color: '#2c3e50'
  },
  description: {
    color: '#666',
    marginBottom: '1rem',
    lineHeight: 1.5
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.5rem',
    marginBottom: '1rem'
  },
  statCard: {
    textAlign: 'center',
    padding: '0.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.25rem'
  },
  statValue: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#2c3e50'
  },
  statLabel: {
    fontSize: '0.7rem',
    color: '#888',
    textTransform: 'uppercase'
  },
  alignmentBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '1rem',
    fontSize: '0.85rem',
    color: '#666',
    marginBottom: '1rem'
  },
  joinButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    width: '100%'
  },
  leaveButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    width: '100%'
  },
  goalList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  goalCard: {
    padding: '0.75rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.5rem'
  },
  goalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem'
  },
  goalTitle: {
    fontWeight: '600',
    color: '#2c3e50'
  },
  visibilityBadge: {
    padding: '0.15rem 0.5rem',
    borderRadius: '0.25rem',
    fontSize: '0.7rem',
    color: '#fff',
    textTransform: 'uppercase'
  },
  goalDescription: {
    fontSize: '0.85rem',
    color: '#666',
    marginBottom: '0.5rem'
  },
  progressBar: {
    height: '6px',
    backgroundColor: '#ddd',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '0.25rem'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498db',
    transition: 'width 0.3s'
  },
  progressText: {
    fontSize: '0.75rem',
    color: '#888'
  },
  memberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  memberCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.25rem'
  },
  memberName: {
    fontWeight: '500',
    color: '#2c3e50'
  },
  memberLevel: {
    fontSize: '0.8rem',
    color: '#666',
    textTransform: 'capitalize'
  },
  noSelection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.75rem',
    color: '#888'
  }
}

export default FactionsPage
