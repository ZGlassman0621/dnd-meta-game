import { useState, useEffect, useCallback } from 'react'

// Time ratio presets (matching server)
const TIME_RATIOS = {
  realtime: { label: 'Real-Time', ratio: 1, description: '1 real hour = 1 in-game hour' },
  leisurely: { label: 'Leisurely', ratio: 4, description: '1 real hour = 4 in-game hours' },
  normal: { label: 'Normal', ratio: 8, description: '1 real hour = 8 in-game hours' },
  fast: { label: 'Fast', ratio: 12, description: '1 real hour = 12 in-game hours' },
  montage: { label: 'Montage', ratio: 24, description: '1 real hour = 1 in-game day' }
}

function MetaGameDashboard({ character, onCharacterUpdated }) {
  const [status, setStatus] = useState(null)
  const [context, setContext] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showTimeSettings, setShowTimeSettings] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [processingQueue, setProcessingQueue] = useState(false)

  // Load all data
  const loadData = useCallback(async () => {
    if (!character?.id) return
    setLoading(true)
    setError('')

    try {
      const [statusRes, contextRes, suggestionsRes, queueRes] = await Promise.all([
        fetch(`/api/meta-game/status/${character.id}`),
        fetch(`/api/meta-game/context/${character.id}`),
        fetch(`/api/meta-game/suggestions/${character.id}`),
        fetch(`/api/meta-game/queue/${character.id}`)
      ])

      if (statusRes.ok) {
        setStatus(await statusRes.json())
      }

      if (contextRes.ok) {
        setContext(await contextRes.json())
      }

      if (suggestionsRes.ok) {
        const data = await suggestionsRes.json()
        setSuggestions(data.suggestions || [])
      }

      if (queueRes.ok) {
        const data = await queueRes.json()
        setQueue(data.queue || [])
      }
    } catch (err) {
      console.error('Error loading Meta Game data:', err)
      setError('Failed to load campaign data')
    }

    setLoading(false)
  }, [character?.id])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [loadData])

  // Change time ratio
  const changeTimeRatio = async (newRatio) => {
    try {
      const response = await fetch(`/api/meta-game/time-ratio/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratio: newRatio })
      })

      if (response.ok) {
        await loadData()
      }
    } catch (err) {
      console.error('Error changing time ratio:', err)
    }
  }

  // Add activity to queue
  const addToQueue = async (activityType, hours, options = {}) => {
    try {
      const response = await fetch(`/api/meta-game/queue/${character.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType,
          durationHours: hours,
          options
        })
      })

      if (response.ok) {
        await loadData()
      }
    } catch (err) {
      console.error('Error adding to queue:', err)
    }
  }

  // Remove from queue
  const removeFromQueue = async (queueId) => {
    try {
      const response = await fetch(`/api/meta-game/queue/${character.id}/${queueId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadData()
      }
    } catch (err) {
      console.error('Error removing from queue:', err)
    }
  }

  // Process the queue (advance time and check for completions)
  const processQueue = async () => {
    setProcessingQueue(true)
    try {
      const response = await fetch(`/api/meta-game/process/${character.id}`, {
        method: 'POST'
      })

      if (response.ok) {
        const results = await response.json()
        await loadData()

        // If there were completed activities, notify
        if (results.processed && results.processed.length > 0) {
          if (onCharacterUpdated) {
            onCharacterUpdated()
          }
        }
      }
    } catch (err) {
      console.error('Error processing queue:', err)
    }
    setProcessingQueue(false)
  }

  // Advance time manually
  const advanceTime = async (hours) => {
    try {
      const response = await fetch(`/api/meta-game/advance-time/${character.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours })
      })

      if (response.ok) {
        await loadData()
        if (onCharacterUpdated) {
          onCharacterUpdated()
        }
      }
    } catch (err) {
      console.error('Error advancing time:', err)
    }
  }

  if (loading && !context) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading campaign state...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
        <button onClick={loadData} style={styles.button}>Retry</button>
      </div>
    )
  }

  const currentRatio = status?.timeRatio?.key || 'normal'
  const calendar = context?.calendar || status?.calendar

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Campaign Dashboard</h2>

      {/* Calendar & Time */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Campaign Time</h3>
          <button
            onClick={() => setShowTimeSettings(!showTimeSettings)}
            style={styles.iconButton}
            title="Time settings"
          >
            {showTimeSettings ? '▲' : '⚙️'}
          </button>
        </div>

        <div style={styles.calendarDisplay}>
          <div style={styles.dateDisplay}>
            <span style={styles.dateLabel}>Current Date:</span>
            <span style={styles.dateValue}>{calendar?.formatted || 'Unknown'}</span>
          </div>
          <div style={styles.seasonBadge} data-season={calendar?.season}>
            {calendar?.season?.charAt(0).toUpperCase() + calendar?.season?.slice(1)}
          </div>
        </div>

        {showTimeSettings && (
          <div style={styles.timeSettings}>
            <p style={styles.settingsLabel}>Time Flow Rate:</p>
            <div style={styles.ratioButtons}>
              {Object.entries(TIME_RATIOS).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => changeTimeRatio(key)}
                  style={{
                    ...styles.ratioButton,
                    ...(currentRatio === key ? styles.ratioButtonActive : {})
                  }}
                  title={info.description}
                >
                  {info.label}
                </button>
              ))}
            </div>
            <p style={styles.ratioDescription}>
              {TIME_RATIOS[currentRatio]?.description}
            </p>

            <div style={styles.advanceTimeSection}>
              <p style={styles.settingsLabel}>Quick Advance:</p>
              <div style={styles.advanceButtons}>
                <button onClick={() => advanceTime(1)} style={styles.smallButton}>+1h</button>
                <button onClick={() => advanceTime(4)} style={styles.smallButton}>+4h</button>
                <button onClick={() => advanceTime(8)} style={styles.smallButton}>+8h</button>
                <button onClick={() => advanceTime(24)} style={styles.smallButton}>+1 day</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current Activity Status */}
      {status?.hasEvent && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Current Activity</h3>
          <div style={{
            ...styles.activityCard,
            borderColor: status.status === 'completed' ? '#27ae60' : '#3498db'
          }}>
            <div style={styles.activityIcon}>
              {status.eventType === 'downtime' ? '🏠' : '⚔️'}
            </div>
            <div style={styles.activityInfo}>
              <div style={styles.activityTitle}>
                {status.activity?.title || status.activity?.activityType || 'Activity'}
              </div>
              {status.status === 'completed' ? (
                <div style={styles.completedBadge}>Completed! Claim rewards</div>
              ) : (
                <div style={styles.activityTime}>
                  Completes in: {status.remainingFormatted}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Activity Suggestions */}
      {suggestions.length > 0 && !status?.hasEvent && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Suggested Activities</h3>
          <div style={styles.suggestions}>
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <div
                key={index}
                style={{
                  ...styles.suggestionCard,
                  borderLeftColor: suggestion.priority === 'high' ? '#e74c3c'
                    : suggestion.priority === 'medium' ? '#f39c12'
                    : '#27ae60'
                }}
              >
                <div style={styles.suggestionHeader}>
                  <span style={styles.suggestionType}>{suggestion.type}</span>
                  <span style={{
                    ...styles.priorityBadge,
                    backgroundColor: suggestion.priority === 'high' ? '#e74c3c'
                      : suggestion.priority === 'medium' ? '#f39c12'
                      : '#27ae60'
                  }}>
                    {suggestion.priority}
                  </span>
                </div>
                <p style={styles.suggestionReason}>{suggestion.reason}</p>
                <button
                  onClick={() => addToQueue(suggestion.activity, suggestion.estimatedHours)}
                  style={styles.addButton}
                >
                  Add to Queue ({suggestion.estimatedHours}h)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Queue */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Activity Queue ({queue.length})</h3>
          <button
            onClick={() => setShowQueue(!showQueue)}
            style={styles.iconButton}
          >
            {showQueue ? '▲' : '▼'}
          </button>
        </div>

        {showQueue && (
          <>
            {queue.length === 0 ? (
              <p style={styles.emptyMessage}>No activities queued. Add some from the suggestions above!</p>
            ) : (
              <div style={styles.queue}>
                {queue.map((item, index) => (
                  <div key={item.id} style={styles.queueItem}>
                    <span style={styles.queueOrder}>{index + 1}.</span>
                    <span style={styles.queueActivity}>{item.activity_type}</span>
                    <span style={styles.queueDuration}>{item.duration_hours}h</span>
                    <span style={{
                      ...styles.queueStatus,
                      color: item.status === 'active' ? '#27ae60' : '#888'
                    }}>
                      {item.status}
                    </span>
                    {item.status === 'pending' && (
                      <button
                        onClick={() => removeFromQueue(item.id)}
                        style={styles.removeButton}
                        title="Remove from queue"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {queue.length > 0 && (
              <button
                onClick={processQueue}
                disabled={processingQueue}
                style={styles.processButton}
              >
                {processingQueue ? 'Processing...' : 'Process Queue'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Quick Stats */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Campaign Overview</h3>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{context?.character?.currentLocation || 'Unknown'}</div>
            <div style={styles.statLabel}>Location</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{context?.companions?.length || 0}</div>
            <div style={styles.statLabel}>Companions</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{context?.recentSessions?.length || 0}</div>
            <div style={styles.statLabel}>Sessions</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              {Math.round((context?.character?.currentHp / context?.character?.maxHp) * 100) || 0}%
            </div>
            <div style={styles.statLabel}>Health</div>
          </div>
        </div>

        {context?.character?.currentQuest && (
          <div style={styles.questCard}>
            <span style={styles.questLabel}>Active Quest:</span>
            <span style={styles.questText}>{context.character.currentQuest}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '1rem',
    maxWidth: '800px',
    margin: '0 auto'
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '1.5rem',
    color: '#2c3e50',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
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
  section: {
    backgroundColor: '#fff',
    borderRadius: '0.75rem',
    padding: '1rem',
    marginBottom: '1rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem'
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    margin: 0,
    color: '#2c3e50'
  },
  iconButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem'
  },
  calendarDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.5rem'
  },
  dateDisplay: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  dateLabel: {
    fontSize: '0.8rem',
    color: '#666'
  },
  dateValue: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#2c3e50'
  },
  seasonBadge: {
    padding: '0.25rem 0.75rem',
    borderRadius: '1rem',
    fontSize: '0.85rem',
    fontWeight: '500',
    backgroundColor: '#e8f4f8',
    color: '#2980b9'
  },
  timeSettings: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.5rem'
  },
  settingsLabel: {
    fontSize: '0.9rem',
    color: '#666',
    marginBottom: '0.5rem'
  },
  ratioButtons: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginBottom: '0.75rem'
  },
  ratioButton: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #ddd',
    borderRadius: '0.25rem',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'all 0.2s'
  },
  ratioButtonActive: {
    backgroundColor: '#3498db',
    color: '#fff',
    borderColor: '#3498db'
  },
  ratioDescription: {
    fontSize: '0.85rem',
    color: '#666',
    fontStyle: 'italic'
  },
  advanceTimeSection: {
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #eee'
  },
  advanceButtons: {
    display: 'flex',
    gap: '0.5rem'
  },
  smallButton: {
    padding: '0.4rem 0.6rem',
    border: '1px solid #ddd',
    borderRadius: '0.25rem',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '0.8rem'
  },
  activityCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.5rem',
    borderLeft: '4px solid #3498db'
  },
  activityIcon: {
    fontSize: '2rem'
  },
  activityInfo: {
    flex: 1
  },
  activityTitle: {
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '0.25rem'
  },
  activityTime: {
    fontSize: '0.9rem',
    color: '#666'
  },
  completedBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    backgroundColor: '#27ae60',
    color: '#fff',
    borderRadius: '0.25rem',
    fontSize: '0.85rem',
    fontWeight: '500'
  },
  suggestions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  suggestionCard: {
    padding: '0.75rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.5rem',
    borderLeft: '4px solid #27ae60'
  },
  suggestionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem'
  },
  suggestionType: {
    fontSize: '0.8rem',
    color: '#666',
    textTransform: 'uppercase'
  },
  priorityBadge: {
    padding: '0.15rem 0.5rem',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    color: '#fff',
    fontWeight: '500'
  },
  suggestionReason: {
    fontSize: '0.9rem',
    color: '#2c3e50',
    margin: '0.5rem 0'
  },
  addButton: {
    padding: '0.4rem 0.75rem',
    backgroundColor: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  queue: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  queueItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.75rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.25rem'
  },
  queueOrder: {
    fontWeight: '600',
    color: '#888',
    width: '1.5rem'
  },
  queueActivity: {
    flex: 1,
    fontWeight: '500',
    textTransform: 'capitalize'
  },
  queueDuration: {
    color: '#666',
    fontSize: '0.9rem'
  },
  queueStatus: {
    fontSize: '0.8rem',
    textTransform: 'uppercase'
  },
  removeButton: {
    background: 'none',
    border: 'none',
    color: '#c00',
    cursor: 'pointer',
    fontSize: '1.2rem',
    padding: '0 0.25rem'
  },
  processButton: {
    marginTop: '1rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    width: '100%'
  },
  emptyMessage: {
    color: '#888',
    fontSize: '0.9rem',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '1rem'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  statCard: {
    textAlign: 'center',
    padding: '0.75rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.5rem'
  },
  statValue: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '0.25rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#888',
    textTransform: 'uppercase'
  },
  questCard: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem',
    backgroundColor: '#fff8e1',
    borderRadius: '0.5rem',
    borderLeft: '4px solid #f39c12'
  },
  questLabel: {
    fontWeight: '600',
    color: '#f39c12'
  },
  questText: {
    color: '#2c3e50'
  },
  button: {
    padding: '0.5rem 1rem',
    backgroundColor: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: '0.25rem',
    cursor: 'pointer'
  }
}

export default MetaGameDashboard
