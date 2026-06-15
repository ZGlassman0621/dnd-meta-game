import { useState, useEffect, useCallback } from 'react'

// Event type configurations
const EVENT_TYPES = {
  political: { label: 'Political', color: '#9b59b6', icon: '👑' },
  economic: { label: 'Economic', color: '#f39c12', icon: '💰' },
  military: { label: 'Military', color: '#e74c3c', icon: '⚔️' },
  natural: { label: 'Natural', color: '#27ae60', icon: '🌿' },
  magical: { label: 'Magical', color: '#3498db', icon: '✨' },
  religious: { label: 'Religious', color: '#8e44ad', icon: '🙏' },
  social: { label: 'Social', color: '#1abc9c', icon: '🎭' },
  conspiracy: { label: 'Conspiracy', color: '#2c3e50', icon: '🕵️' },
  threat: { label: 'Threat', color: '#c0392b', icon: '💀' }
}

const SCOPE_COLORS = {
  local: '#95a5a6',
  regional: '#27ae60',
  continental: '#2980b9',
  global: '#8e44ad'
}

const STATUS_COLORS = {
  active: '#27ae60',
  resolved: '#3498db',
  cancelled: '#95a5a6',
  expired: '#e67e22'
}

function WorldEventsPage({ character, onCharacterUpdated }) {
  const [events, setEvents] = useState([])
  const [activeEffects, setActiveEffects] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventEffects, setEventEffects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('active') // active, all, resolved
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'political',
    scope: 'regional',
    visibility: 'public'
  })

  // Load events and effects
  const loadData = useCallback(async () => {
    if (!character?.id || !character?.campaign_id) return
    setLoading(true)
    setError('')

    try {
      const [eventsRes, effectsRes] = await Promise.all([
        filter === 'active'
          ? fetch(`/api/world-event/campaign/${character.campaign_id}/active`)
          : fetch(`/api/world-event/campaign/${character.campaign_id}`),
        fetch(`/api/world-event/effects/campaign/${character.campaign_id}`)
      ])

      if (eventsRes.ok) {
        let data = await eventsRes.json()
        if (filter === 'resolved') {
          data = data.filter(e => e.status === 'resolved' || e.status === 'cancelled')
        }
        setEvents(data)
      }

      if (effectsRes.ok) {
        setActiveEffects(await effectsRes.json())
      }
    } catch (err) {
      console.error('Error loading world event data:', err)
      setError('Failed to load world events')
    }

    setLoading(false)
  }, [character?.id, character?.campaign_id, filter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Load event details when selected
  const loadEventDetails = useCallback(async (eventId) => {
    try {
      const effectsRes = await fetch(`/api/world-event/${eventId}/effects`)
      if (effectsRes.ok) {
        setEventEffects(await effectsRes.json())
      }
    } catch (err) {
      console.error('Error loading event details:', err)
    }
  }, [])

  // Select an event
  const handleSelectEvent = async (event) => {
    setSelectedEvent(event)
    await loadEventDetails(event.id)
  }

  // Advance event stage
  const handleAdvanceStage = async (eventId) => {
    try {
      const response = await fetch(`/api/world-event/${eventId}/advance-stage`, {
        method: 'POST'
      })

      if (response.ok) {
        const updated = await response.json()
        setSelectedEvent(updated)
        await loadData()
      }
    } catch (err) {
      console.error('Error advancing stage:', err)
    }
  }

  // Resolve event
  const handleResolveEvent = async (eventId, outcome) => {
    try {
      const response = await fetch(`/api/world-event/${eventId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, outcome_description: `Event resolved: ${outcome}` })
      })

      if (response.ok) {
        const updated = await response.json()
        setSelectedEvent(updated)
        await loadData()
      }
    } catch (err) {
      console.error('Error resolving event:', err)
    }
  }

  // Create a new event
  const handleCreateEvent = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/world-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEvent,
          campaign_id: character.campaign_id,
          status: 'active'
        })
      })

      if (response.ok) {
        await loadData()
        setShowCreateEvent(false)
        setNewEvent({
          title: '',
          description: '',
          event_type: 'political',
          scope: 'regional',
          visibility: 'public'
        })
      }
    } catch (err) {
      console.error('Error creating event:', err)
    }
  }

  // Get event type info
  const getEventType = (type) => EVENT_TYPES[type] || { label: type, color: '#666', icon: '📋' }

  // Calculate stage progress
  const getStageProgress = (event) => {
    if (!event.stages || event.stages.length === 0) return 100
    return ((event.current_stage + 1) / event.stages.length) * 100
  }

  if (loading && events.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading world events...</div>
      </div>
    )
  }

  if (!character?.campaign_id) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Character must be part of a campaign to view world events.</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>World Events</h2>

      {error && <div style={styles.error}>{error}</div>}

      {/* Filter tabs */}
      <div style={styles.filterTabs}>
        <button
          onClick={() => setFilter('active')}
          style={{
            ...styles.filterTab,
            ...(filter === 'active' ? styles.filterTabActive : {})
          }}
        >
          Active Events
        </button>
        <button
          onClick={() => setFilter('all')}
          style={{
            ...styles.filterTab,
            ...(filter === 'all' ? styles.filterTabActive : {})
          }}
        >
          All Events
        </button>
        <button
          onClick={() => setFilter('resolved')}
          style={{
            ...styles.filterTab,
            ...(filter === 'resolved' ? styles.filterTabActive : {})
          }}
        >
          Resolved
        </button>
      </div>

      {/* Active effects summary */}
      {activeEffects.length > 0 && (
        <div style={styles.effectsSummary}>
          <span style={styles.effectsLabel}>Active Effects:</span>
          <span style={styles.effectsCount}>{activeEffects.length}</span>
        </div>
      )}

      {/* Two column layout */}
      <div style={styles.layout}>
        {/* Event List */}
        <div style={styles.listColumn}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Events ({events.length})</h3>
            <button
              onClick={() => setShowCreateEvent(!showCreateEvent)}
              style={styles.addButton}
            >
              {showCreateEvent ? '×' : '+'}
            </button>
          </div>

          {/* Create Event Form */}
          {showCreateEvent && (
            <form onSubmit={handleCreateEvent} style={styles.createForm}>
              <input
                type="text"
                placeholder="Event Title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                style={styles.input}
                required
              />
              <textarea
                placeholder="Description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                style={styles.textarea}
              />
              <div style={styles.formRow}>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
                  style={styles.select}
                >
                  {Object.entries(EVENT_TYPES).map(([key, info]) => (
                    <option key={key} value={key}>{info.icon} {info.label}</option>
                  ))}
                </select>
                <select
                  value={newEvent.scope}
                  onChange={(e) => setNewEvent({ ...newEvent, scope: e.target.value })}
                  style={styles.select}
                >
                  <option value="local">Local</option>
                  <option value="regional">Regional</option>
                  <option value="continental">Continental</option>
                  <option value="global">Global</option>
                </select>
              </div>
              <div style={styles.formRow}>
                <select
                  value={newEvent.visibility}
                  onChange={(e) => setNewEvent({ ...newEvent, visibility: e.target.value })}
                  style={styles.select}
                >
                  <option value="public">Public</option>
                  <option value="rumored">Rumored</option>
                  <option value="secret">Secret</option>
                </select>
              </div>
              <button type="submit" style={styles.submitButton}>Create Event</button>
            </form>
          )}

          {/* Event Cards */}
          {events.length === 0 ? (
            <p style={styles.emptyMessage}>No events in this campaign yet.</p>
          ) : (
            <div style={styles.eventList}>
              {events.map(event => {
                const eventType = getEventType(event.event_type)
                const isSelected = selectedEvent?.id === event.id

                return (
                  <div
                    key={event.id}
                    onClick={() => handleSelectEvent(event)}
                    style={{
                      ...styles.eventCard,
                      borderLeftColor: eventType.color,
                      ...(isSelected ? styles.eventCardSelected : {})
                    }}
                  >
                    <div style={styles.eventHeader}>
                      <span style={styles.eventIcon}>{eventType.icon}</span>
                      <span style={styles.eventTitle}>{event.title}</span>
                    </div>
                    <div style={styles.eventMeta}>
                      <span style={{
                        ...styles.scopeBadge,
                        backgroundColor: SCOPE_COLORS[event.scope] || '#666'
                      }}>
                        {event.scope}
                      </span>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: STATUS_COLORS[event.status] || '#666'
                      }}>
                        {event.status}
                      </span>
                      <span style={{
                        ...styles.visibilityBadge,
                        backgroundColor: event.visibility === 'public' ? '#27ae60'
                          : event.visibility === 'rumored' ? '#f39c12'
                          : '#e74c3c'
                      }}>
                        {event.visibility}
                      </span>
                    </div>
                    {event.stages && event.stages.length > 0 && (
                      <div style={styles.stageProgress}>
                        <div style={styles.stageTrack}>
                          <div
                            style={{
                              ...styles.stageFill,
                              width: `${getStageProgress(event)}%`,
                              backgroundColor: eventType.color
                            }}
                          />
                        </div>
                        <span style={styles.stageText}>
                          Stage {event.current_stage + 1}/{event.stages.length}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Event Detail */}
        <div style={styles.detailColumn}>
          {selectedEvent ? (
            <>
              <div style={styles.section}>
                <div style={styles.detailHeader}>
                  <span style={styles.detailIcon}>{getEventType(selectedEvent.event_type).icon}</span>
                  <h3 style={styles.detailTitle}>{selectedEvent.title}</h3>
                </div>
                <p style={styles.description}>{selectedEvent.description || 'No description available.'}</p>

                <div style={styles.detailMeta}>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Type:</span>
                    <span style={{ color: getEventType(selectedEvent.event_type).color }}>
                      {getEventType(selectedEvent.event_type).label}
                    </span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Scope:</span>
                    <span>{selectedEvent.scope}</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Status:</span>
                    <span style={{ color: STATUS_COLORS[selectedEvent.status] }}>
                      {selectedEvent.status}
                    </span>
                  </div>
                  {selectedEvent.expected_duration_days && (
                    <div style={styles.metaItem}>
                      <span style={styles.metaLabel}>Duration:</span>
                      <span>{selectedEvent.expected_duration_days} days</span>
                    </div>
                  )}
                </div>

                {/* Stage Actions */}
                {selectedEvent.status === 'active' && (
                  <div style={styles.actionButtons}>
                    {selectedEvent.stages && selectedEvent.current_stage < selectedEvent.stages.length - 1 && (
                      <button
                        onClick={() => handleAdvanceStage(selectedEvent.id)}
                        style={styles.advanceButton}
                      >
                        Advance Stage
                      </button>
                    )}
                    <button
                      onClick={() => handleResolveEvent(selectedEvent.id, 'resolved')}
                      style={styles.resolveButton}
                    >
                      Resolve Event
                    </button>
                  </div>
                )}
              </div>

              {/* Stages */}
              {selectedEvent.stages && selectedEvent.stages.length > 0 && (
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>Stages</h4>
                  <div style={styles.stageList}>
                    {selectedEvent.stages.map((stage, index) => (
                      <div
                        key={index}
                        style={{
                          ...styles.stageCard,
                          borderLeftColor: index <= selectedEvent.current_stage
                            ? getEventType(selectedEvent.event_type).color
                            : '#ddd',
                          opacity: index <= selectedEvent.current_stage ? 1 : 0.5
                        }}
                      >
                        <div style={styles.stageHeader}>
                          <span style={styles.stageNumber}>Stage {index + 1}</span>
                          {index === selectedEvent.current_stage && (
                            <span style={styles.currentBadge}>Current</span>
                          )}
                          {index < selectedEvent.current_stage && (
                            <span style={styles.completeBadge}>Complete</span>
                          )}
                        </div>
                        <span style={styles.stageName}>{stage}</span>
                        {selectedEvent.stage_descriptions?.[index] && (
                          <p style={styles.stageDescription}>
                            {selectedEvent.stage_descriptions[index]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Possible Outcomes */}
              {selectedEvent.possible_outcomes && selectedEvent.possible_outcomes.length > 0 && (
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>Possible Outcomes</h4>
                  <ul style={styles.outcomeList}>
                    {selectedEvent.possible_outcomes.map((outcome, index) => (
                      <li key={index} style={styles.outcomeItem}>{outcome}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Player Intervention Options */}
              {selectedEvent.player_intervention_options && selectedEvent.player_intervention_options.length > 0 && (
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>Intervention Options</h4>
                  <ul style={styles.interventionList}>
                    {selectedEvent.player_intervention_options.map((option, index) => (
                      <li key={index} style={styles.interventionItem}>{option}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Effects */}
              {eventEffects.length > 0 && (
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>Active Effects</h4>
                  <div style={styles.effectList}>
                    {eventEffects.map(effect => (
                      <div key={effect.id} style={styles.effectCard}>
                        <div style={styles.effectHeader}>
                          <span style={styles.effectType}>{effect.effect_type}</span>
                          <span style={{
                            ...styles.effectStatus,
                            color: effect.status === 'active' ? '#27ae60' : '#95a5a6'
                          }}>
                            {effect.status}
                          </span>
                        </div>
                        <p style={styles.effectDescription}>{effect.description}</p>
                        <div style={styles.effectTarget}>
                          Target: {effect.target_type} #{effect.target_id}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outcome (if resolved) */}
              {selectedEvent.status === 'resolved' && selectedEvent.outcome_description && (
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>Outcome</h4>
                  <div style={styles.outcomeCard}>
                    <span style={styles.outcomeLabel}>{selectedEvent.outcome}</span>
                    <p style={styles.outcomeDescription}>{selectedEvent.outcome_description}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={styles.noSelection}>
              <p>Select an event to view details</p>
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
    marginBottom: '1rem',
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
  filterTabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem'
  },
  filterTab: {
    padding: '0.5rem 1rem',
    border: '1px solid #ddd',
    borderRadius: '0.25rem',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  filterTabActive: {
    backgroundColor: '#3498db',
    color: '#fff',
    borderColor: '#3498db'
  },
  effectsSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#fff3cd',
    borderRadius: '0.25rem',
    marginBottom: '1rem',
    fontSize: '0.9rem'
  },
  effectsLabel: {
    color: '#856404'
  },
  effectsCount: {
    fontWeight: 'bold',
    color: '#856404'
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
    gap: '0.5rem'
  },
  select: {
    flex: 1,
    padding: '0.5rem',
    border: '1px solid #ddd',
    borderRadius: '0.25rem',
    fontSize: '0.9rem'
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
  eventList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  eventCard: {
    padding: '0.75rem',
    backgroundColor: '#fff',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    borderLeft: '4px solid #666',
    transition: 'all 0.2s'
  },
  eventCardSelected: {
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    backgroundColor: '#f0f7ff'
  },
  eventHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem'
  },
  eventIcon: {
    fontSize: '1.1rem'
  },
  eventTitle: {
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1
  },
  eventMeta: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginBottom: '0.5rem'
  },
  scopeBadge: {
    padding: '0.1rem 0.4rem',
    borderRadius: '0.25rem',
    fontSize: '0.7rem',
    color: '#fff',
    textTransform: 'uppercase'
  },
  statusBadge: {
    padding: '0.1rem 0.4rem',
    borderRadius: '0.25rem',
    fontSize: '0.7rem',
    color: '#fff',
    textTransform: 'uppercase'
  },
  visibilityBadge: {
    padding: '0.1rem 0.4rem',
    borderRadius: '0.25rem',
    fontSize: '0.7rem',
    color: '#fff',
    textTransform: 'uppercase'
  },
  stageProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  stageTrack: {
    flex: 1,
    height: '4px',
    backgroundColor: '#eee',
    borderRadius: '2px',
    overflow: 'hidden'
  },
  stageFill: {
    height: '100%',
    transition: 'width 0.3s'
  },
  stageText: {
    fontSize: '0.75rem',
    color: '#888'
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: '0.75rem',
    padding: '1rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.75rem'
  },
  detailIcon: {
    fontSize: '1.5rem'
  },
  detailTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    margin: 0,
    color: '#2c3e50'
  },
  description: {
    color: '#666',
    marginBottom: '1rem',
    lineHeight: 1.5
  },
  detailMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.5rem',
    marginBottom: '1rem'
  },
  metaItem: {
    display: 'flex',
    gap: '0.5rem',
    fontSize: '0.9rem'
  },
  metaLabel: {
    color: '#888'
  },
  actionButtons: {
    display: 'flex',
    gap: '0.5rem'
  },
  advanceButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#f39c12',
    color: '#fff',
    border: 'none',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  resolveButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  stageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  stageCard: {
    padding: '0.75rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.5rem',
    borderLeft: '3px solid #ddd'
  },
  stageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem'
  },
  stageNumber: {
    fontSize: '0.8rem',
    color: '#888'
  },
  currentBadge: {
    padding: '0.1rem 0.4rem',
    backgroundColor: '#3498db',
    color: '#fff',
    borderRadius: '0.25rem',
    fontSize: '0.7rem'
  },
  completeBadge: {
    padding: '0.1rem 0.4rem',
    backgroundColor: '#27ae60',
    color: '#fff',
    borderRadius: '0.25rem',
    fontSize: '0.7rem'
  },
  stageName: {
    fontWeight: '500',
    color: '#2c3e50'
  },
  stageDescription: {
    fontSize: '0.85rem',
    color: '#666',
    marginTop: '0.25rem',
    marginBottom: 0
  },
  outcomeList: {
    margin: 0,
    paddingLeft: '1.5rem',
    color: '#666'
  },
  outcomeItem: {
    marginBottom: '0.25rem'
  },
  interventionList: {
    margin: 0,
    paddingLeft: '1.5rem',
    color: '#2980b9'
  },
  interventionItem: {
    marginBottom: '0.25rem'
  },
  effectList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  effectCard: {
    padding: '0.75rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.5rem'
  },
  effectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem'
  },
  effectType: {
    fontWeight: '500',
    color: '#2c3e50',
    textTransform: 'capitalize'
  },
  effectStatus: {
    fontSize: '0.8rem'
  },
  effectDescription: {
    fontSize: '0.85rem',
    color: '#666',
    marginBottom: '0.25rem'
  },
  effectTarget: {
    fontSize: '0.75rem',
    color: '#888'
  },
  outcomeCard: {
    padding: '0.75rem',
    backgroundColor: '#e8f4f8',
    borderRadius: '0.5rem',
    borderLeft: '3px solid #3498db'
  },
  outcomeLabel: {
    fontWeight: '600',
    color: '#2980b9',
    textTransform: 'capitalize'
  },
  outcomeDescription: {
    fontSize: '0.9rem',
    color: '#666',
    marginTop: '0.5rem',
    marginBottom: 0
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

export default WorldEventsPage
