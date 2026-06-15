import { useState, useEffect } from 'react'

// Conversion rate: 1 real-world hour = 8 in-game hours
// So 1 in-game hour = 7.5 real-world minutes
const INGAME_HOUR_TO_REAL_MINUTES = 7.5

const formatRealWorldTime = (inGameHours) => {
  const realMinutes = inGameHours * INGAME_HOUR_TO_REAL_MINUTES
  if (realMinutes < 60) {
    const roundedMins = Math.round(realMinutes)
    return `${roundedMins} minute${roundedMins !== 1 ? 's' : ''}`
  }
  const hours = Math.floor(realMinutes / 60)
  const mins = Math.round(realMinutes % 60)
  if (mins === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  }
  return `${hours}h ${mins}m`
}

// Rest types matching server-side REST_TYPES
const REST_TYPES = {
  short: {
    id: 'short',
    name: 'Short Rest',
    icon: '⏰',
    duration: 1,
    description: 'A period of at least 1 hour during which you do nothing more strenuous than eating, drinking, reading, and tending to wounds.',
    benefits: 'Spend Hit Dice to recover HP. Some abilities recharge.'
  },
  long: {
    id: 'long',
    name: 'Long Rest',
    icon: '🌙',
    duration: 8,
    description: 'A period of extended rest, at least 8 hours long, during which you sleep for at least 6 hours.',
    benefits: 'Recover all HP. Regain half your Hit Dice. Most abilities recharge.'
  }
}

function Downtime({ character, onCharacterUpdated }) {
  const [activities, setActivities] = useState({ available: [], unavailable: [] })
  const [workOptions, setWorkOptions] = useState({ available: [], unavailable: [] })
  const [restInfo, setRestInfo] = useState(null)
  const [activeDowntime, setActiveDowntime] = useState(null)
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [selectedWorkType, setSelectedWorkType] = useState(null)
  const [selectedRestType, setSelectedRestType] = useState(null)
  const [duration, setDuration] = useState(4)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState('')
  const [completionResult, setCompletionResult] = useState(null)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  // New activity selections
  const [factions, setFactions] = useState([])
  const [selectedFactionId, setSelectedFactionId] = useState(null)
  const [activeProjects, setActiveProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [inProgressUpgrades, setInProgressUpgrades] = useState([])
  const [selectedUpgradeId, setSelectedUpgradeId] = useState(null)

  useEffect(() => {
    loadData()
    const interval = setInterval(checkStatus, 2000) // Check every 2 seconds
    return () => clearInterval(interval)
  }, [character.id])

  const loadData = async () => {
    setLoading(true)
    await Promise.all([
      fetchActivities(),
      fetchWorkOptions(),
      checkStatus(),
      fetchHistory(),
      fetchExtras()
    ])
    setLoading(false)
  }

  const fetchActivities = async () => {
    try {
      const response = await fetch(`/api/downtime/available/${character.id}`)
      const data = await response.json()
      setActivities({
        available: data.available || [],
        unavailable: data.unavailable || []
      })
      // Extract rest quality info from location context
      if (data.locationContext) {
        setRestInfo({
          quality: data.locationContext.restQuality,
          multiplier: data.locationContext.restMultiplier,
          description: data.locationContext.restDescription
        })
      }
    } catch (err) {
      console.error('Error fetching activities:', err)
      setError('Failed to load activities')
    }
  }

  const fetchWorkOptions = async () => {
    try {
      const response = await fetch(`/api/downtime/work-options/${character.id}`)
      const data = await response.json()
      setWorkOptions({
        available: data.available || [],
        unavailable: data.unavailable || [],
        levelMultiplier: data.levelMultiplier
      })
    } catch (err) {
      console.error('Error fetching work options:', err)
    }
  }

  const checkStatus = async () => {
    try {
      const response = await fetch(`/api/downtime/status/${character.id}`)
      const data = await response.json()

      if (data.status === 'active') {
        setActiveDowntime(data)
      } else if (data.status === 'completed') {
        setActiveDowntime(data)
      } else {
        setActiveDowntime(null)
      }
    } catch (err) {
      console.error('Error checking status:', err)
    }
  }

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/downtime/history/${character.id}`)
      const data = await response.json()
      setHistory(data)
    } catch (err) {
      console.error('Error fetching history:', err)
    }
  }

  const fetchExtras = async () => {
    // Load factions for faction_work/gather_intel
    try {
      const res = await fetch(`/api/faction/standings/${character.id}`)
      if (res.ok) {
        const data = await res.json()
        setFactions(data.filter(f => f.standing > -50))
      }
    } catch (_e) { /* ignore */ }
    // Load active projects for long_project
    if (character.campaign_id) {
      try {
        const res = await fetch(`/api/projects/${character.id}/${character.campaign_id}`)
        if (res.ok) {
          const data = await res.json()
          setActiveProjects(data.filter(p => p.status === 'active'))
        }
      } catch (_e) { /* ignore */ }
    }
    // Load in-progress upgrades for base_upgrade
    if (character.campaign_id) {
      try {
        const res = await fetch(`/api/base/${character.id}/${character.campaign_id}`)
        if (res.ok) {
          const base = await res.json()
          if (base?.upgrades) {
            setInProgressUpgrades(base.upgrades.filter(u => u.status === 'in_progress'))
          }
        }
      } catch (_e) { /* ignore */ }
    }
  }

  const startActivity = async () => {
    if (!selectedActivity) return
    if (selectedActivity.id === 'work' && !selectedWorkType) return
    if (selectedActivity.id === 'rest' && !selectedRestType) return
    if ((selectedActivity.id === 'faction_work' || selectedActivity.id === 'gather_intel') && !selectedFactionId) return
    if (selectedActivity.id === 'long_project' && !selectedProjectId) return
    if (selectedActivity.id === 'base_upgrade' && !selectedUpgradeId) return

    setStarting(true)
    setError('')

    try {
      const payload = {
        characterId: character.id,
        activityType: selectedActivity.id,
        durationHours: duration
      }

      // Add work type if this is a work activity
      if (selectedActivity.id === 'work' && selectedWorkType) {
        payload.workType = selectedWorkType.id
      }

      // Add rest type if this is a rest activity
      if (selectedActivity.id === 'rest' && selectedRestType) {
        payload.restType = selectedRestType.id
        payload.durationHours = selectedRestType.duration
      }

      // Add new activity selection IDs
      if (selectedActivity.id === 'faction_work' || selectedActivity.id === 'gather_intel') {
        payload.factionId = selectedFactionId
      }
      if (selectedActivity.id === 'long_project') {
        payload.projectId = selectedProjectId
      }
      if (selectedActivity.id === 'base_upgrade') {
        payload.upgradeId = selectedUpgradeId
      }

      const response = await fetch('/api/downtime/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start activity')
      }

      setActiveDowntime({
        status: 'active',
        activity: data.downtime,
        activity_type: data.activity,
        work_option: data.workOption,
        rest_type: data.restType
      })
      setSelectedActivity(null)
      setSelectedWorkType(null)
      setSelectedRestType(null)
      setSelectedFactionId(null)
      setSelectedProjectId(null)
      setSelectedUpgradeId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setStarting(false)
    }
  }

  const completeActivity = async () => {
    if (!activeDowntime?.activity) return

    setCompleting(true)
    setError('')

    try {
      const response = await fetch(`/api/downtime/complete/${activeDowntime.activity.id}`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete activity')
      }

      setCompletionResult(data.benefits)
      setActiveDowntime(null)
      onCharacterUpdated && onCharacterUpdated(data.character)
      fetchHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setCompleting(false)
    }
  }

  const cancelActivity = async () => {
    if (!activeDowntime?.activity) return

    try {
      const response = await fetch(`/api/downtime/cancel/${activeDowntime.activity.id}`, {
        method: 'POST'
      })

      if (response.ok) {
        setActiveDowntime(null)
      }
    } catch (err) {
      console.error('Error cancelling activity:', err)
    }
  }

  const formatTimeRemaining = (ms) => {
    if (ms <= 0) return 'Complete!'
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  }

  const getDurationOptions = (activity) => {
    const max = activity.maxHours || 10
    const options = [2, 4, 6, 8, 10].filter(h => h <= max)
    return options
  }

  if (loading) {
    return (
      <div className="downtime-container">
        <div className="loading">Loading downtime options...</div>
      </div>
    )
  }

  // Show completion result
  if (completionResult) {
    return (
      <div className="downtime-container">
        <div className="downtime-completion">
          <h2>Activity Complete!</h2>

          <div className="completion-summary">
            <p className="completion-description">{completionResult.description}</p>

            <div className="completion-rewards">
              {completionResult.hpRestored > 0 && (
                <div className="reward-item hp">
                  <span className="reward-icon">❤️</span>
                  <span className="reward-value">+{completionResult.hpRestored} HP</span>
                </div>
              )}
              {completionResult.hpRestored < 0 && (
                <div className="reward-item hp negative">
                  <span className="reward-icon">💔</span>
                  <span className="reward-value">{completionResult.hpRestored} HP</span>
                </div>
              )}
              {completionResult.goldEarned > 0 && (
                <div className="reward-item gold">
                  <span className="reward-icon">💰</span>
                  <span className="reward-value">+{completionResult.goldEarned} GP</span>
                </div>
              )}
              {completionResult.goldEarned < 0 && (
                <div className="reward-item gold negative">
                  <span className="reward-icon">💸</span>
                  <span className="reward-value">{completionResult.goldEarned} GP</span>
                </div>
              )}
              {completionResult.xpGained > 0 && (
                <div className="reward-item xp">
                  <span className="reward-icon">✨</span>
                  <span className="reward-value">+{completionResult.xpGained} XP</span>
                </div>
              )}
            </div>

            {completionResult.events && completionResult.events.length > 0 && (
              <div className="completion-events">
                {completionResult.events.map((event, i) => (
                  <p key={i} className="event-text">{event}</p>
                ))}
              </div>
            )}
          </div>

          <button
            className="button"
            onClick={() => setCompletionResult(null)}
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // Show active downtime
  if (activeDowntime) {
    const activity = activeDowntime.activity_type || {}
    const workOption = activeDowntime.work_option
    const restTypeOption = activeDowntime.rest_type
    const endTime = new Date(activeDowntime.activity.end_time)
    const now = new Date()
    const isComplete = now >= endTime

    const displayName = workOption ? workOption.name : (restTypeOption ? restTypeOption.name : activity.name)
    const displayIcon = workOption ? workOption.icon : (restTypeOption ? restTypeOption.icon : activity.icon)

    return (
      <div className="downtime-container">
        <div className="active-downtime">
          <div className="activity-header">
            <span className="activity-icon-large">{displayIcon}</span>
            <div>
              <h2>{displayName}</h2>
              <p className="activity-duration">{activeDowntime.activity.duration_hours} hours</p>
            </div>
          </div>

          <div className="downtime-progress">
            {isComplete ? (
              <>
                <div className="progress-complete">Activity Complete!</div>
                <button
                  className="button claim-btn"
                  onClick={completeActivity}
                  disabled={completing}
                >
                  {completing ? 'Claiming...' : 'Claim Results'}
                </button>
              </>
            ) : (
              <>
                <div className="progress-timer">
                  <span className="timer-label">Time Remaining:</span>
                  <span className="timer-value">{formatTimeRemaining(endTime - now)}</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, ((now - new Date(activeDowntime.activity.start_time)) / (endTime - new Date(activeDowntime.activity.start_time))) * 100)}%`
                    }}
                  />
                </div>
                <button
                  className="button button-secondary cancel-btn"
                  onClick={cancelActivity}
                >
                  Cancel Activity
                </button>
              </>
            )}
          </div>

          {error && <div className="error">{error}</div>}
        </div>
      </div>
    )
  }

  // Show activity selection
  return (
    <div className="downtime-container">
      <div className="downtime-header">
        <h2>Downtime Activities</h2>
        <p className="location-info">
          Current Location: <strong>{character.current_location || 'Unknown'}</strong>
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      {selectedActivity ? (
        <div className="activity-setup">
          <button
            className="button button-secondary back-btn"
            onClick={() => {
              if (selectedActivity.id === 'work' && selectedWorkType) {
                setSelectedWorkType(null)
              } else if (selectedActivity.id === 'rest' && selectedRestType) {
                setSelectedRestType(null)
              } else {
                setSelectedActivity(null)
                setSelectedWorkType(null)
                setSelectedRestType(null)
              }
            }}
          >
            ← Back
          </button>

          {/* Rest activity - show rest type selection */}
          {selectedActivity.id === 'rest' && !selectedRestType ? (
            <>
              <h3 className="rest-selection-title">Choose Your Rest Type</h3>
              <p className="rest-subtitle">
                How long do you want to rest?
              </p>

              {/* Rest quality indicator */}
              {restInfo && (
                <div className={`rest-quality-banner ${restInfo.quality}`}>
                  <span className="rest-quality-icon">
                    {restInfo.quality === 'luxurious' && '🏰'}
                    {restInfo.quality === 'comfortable' && '🛏️'}
                    {restInfo.quality === 'adequate' && '🛋️'}
                    {restInfo.quality === 'poor' && '⛺'}
                    {restInfo.quality === 'terrible' && '💀'}
                  </span>
                  <div className="rest-quality-info">
                    <span className="rest-quality-label">
                      {restInfo.quality.charAt(0).toUpperCase() + restInfo.quality.slice(1)} Conditions
                    </span>
                    <span className="rest-quality-desc">{restInfo.description}</span>
                  </div>
                  {restInfo.quality === 'terrible' && (
                    <span className="rest-warning">⚠️ Rest may be interrupted!</span>
                  )}
                </div>
              )}

              <div className="rest-type-grid">
                {Object.values(REST_TYPES).map(restType => (
                  <div
                    key={restType.id}
                    className="rest-type-card"
                    onClick={() => setSelectedRestType(restType)}
                  >
                    <span className="rest-type-icon">{restType.icon}</span>
                    <div className="rest-type-info">
                      <h4>{restType.name}</h4>
                      <p className="rest-type-duration">{restType.duration} hour{restType.duration !== 1 ? 's' : ''} <span style={{ opacity: 0.7, fontSize: '0.85em' }}>({formatRealWorldTime(restType.duration)} real)</span></p>
                      <p className="rest-type-desc">{restType.description}</p>
                      <p className="rest-type-benefits">{restType.benefits}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : selectedActivity.id === 'work' && !selectedWorkType ? (
            /* Work activity - show work type selection */
            <>
              <h3 className="work-selection-title">Choose Your Work</h3>
              <p className="work-subtitle">
                As a Level {character.level} {character.class}, you have specialized skills
              </p>

              <div className="work-options-grid">
                {workOptions.available.map(option => (
                  <div
                    key={option.id}
                    className="work-option-card"
                    onClick={() => setSelectedWorkType(option)}
                  >
                    <span className="work-option-icon">{option.icon}</span>
                    <div className="work-option-info">
                      <h4>{option.name}</h4>
                      <p className="work-option-desc">{option.description}</p>
                      <p className="work-option-rate">
                        ~{option.gpPerHour.toFixed(1)} GP/hour
                        {option.xpBonus && <span className="xp-bonus"> +{option.xpBonus} XP/hour</span>}
                      </p>
                      {option.riskLevel && (
                        <span className={`risk-tag ${option.riskLevel}`}>
                          {option.riskLevel === 'medium' ? 'Some Risk' : 'Low Risk'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {workOptions.unavailable.length > 0 && (
                <>
                  <h4 className="unavailable-work-header">Unavailable Here</h4>
                  <div className="work-options-grid unavailable">
                    {workOptions.unavailable.map(option => (
                      <div key={option.id} className="work-option-card unavailable">
                        <span className="work-option-icon">{option.icon}</span>
                        <div className="work-option-info">
                          <h4>{option.name}</h4>
                          <p className="unavailable-reason">{option.unavailableReason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (selectedActivity.id === 'rest' && selectedRestType) ? (
            <>
              {/* Show selected rest type */}
              <div className="selected-activity-card rest-selected">
                <span className="activity-icon-large">{selectedRestType.icon}</span>
                <h3>{selectedRestType.name}</h3>
                <p>{selectedRestType.description}</p>
                <p className="rest-benefits-preview">{selectedRestType.benefits}</p>
                <p className="rest-duration-info">Duration: {selectedRestType.duration} hour{selectedRestType.duration !== 1 ? 's' : ''}</p>
                <p className="real-world-time-info" style={{
                  fontSize: '0.85rem',
                  color: 'rgba(255,255,255,0.7)',
                  marginTop: '0.25rem'
                }}>
                  🕐 Real-world time: <strong>{formatRealWorldTime(selectedRestType.duration)}</strong>
                </p>

                {/* Rest quality indicator */}
                {restInfo && (
                  <div className={`rest-quality-indicator ${restInfo.quality}`}>
                    <div className="rest-quality-header">
                      <span className="rest-quality-icon">
                        {restInfo.quality === 'luxurious' && '🏰'}
                        {restInfo.quality === 'comfortable' && '🛏️'}
                        {restInfo.quality === 'adequate' && '🛋️'}
                        {restInfo.quality === 'poor' && '⛺'}
                        {restInfo.quality === 'terrible' && '💀'}
                      </span>
                      <span className="rest-quality-label">
                        {restInfo.quality.charAt(0).toUpperCase() + restInfo.quality.slice(1)} Conditions
                      </span>
                    </div>
                    <p className="rest-quality-desc">{restInfo.description}</p>
                    {restInfo.quality === 'terrible' && (
                      <p className="rest-quality-warning">⚠️ Warning: Your rest may be interrupted and you may take damage!</p>
                    )}
                    {restInfo.quality === 'poor' && (
                      <p className="rest-quality-warning">⚠️ Poor conditions will reduce rest effectiveness</p>
                    )}
                    {restInfo.quality === 'luxurious' && selectedRestType.id === 'long' && (
                      <p className="rest-quality-bonus">✨ Luxurious rest grants bonus XP!</p>
                    )}
                  </div>
                )}
              </div>

              <button
                className="button start-downtime-btn"
                onClick={startActivity}
                disabled={starting}
              >
                {starting ? 'Starting...' : `Begin ${selectedRestType.name}`}
              </button>
            </>
          ) : (
            <>
              {/* Faction selection for faction_work / gather_intel */}
              {(selectedActivity.id === 'faction_work' || selectedActivity.id === 'gather_intel') && !selectedFactionId && (
                <div>
                  <h3 style={{ marginBottom: '0.5rem' }}>Select a Faction</h3>
                  {factions.length === 0 ? (
                    <p style={{ color: '#888' }}>No known factions. Discover factions during your adventures.</p>
                  ) : (
                    <div className="work-options-grid">
                      {factions.map(f => (
                        <div key={f.faction_id} className="work-option-card" onClick={() => setSelectedFactionId(f.faction_id)}>
                          <div className="work-option-info">
                            <h4>{f.faction_name || f.name}</h4>
                            <p className="work-option-desc">Standing: {f.standing}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Project selection for long_project */}
              {selectedActivity.id === 'long_project' && !selectedProjectId && (
                <div>
                  <h3 style={{ marginBottom: '0.5rem' }}>Select a Project</h3>
                  {activeProjects.length === 0 ? (
                    <p style={{ color: '#888' }}>No active projects. Create one from the Party Base page.</p>
                  ) : (
                    <div className="work-options-grid">
                      {activeProjects.map(p => (
                        <div key={p.id} className="work-option-card" onClick={() => setSelectedProjectId(p.id)}>
                          <div className="work-option-info">
                            <h4>{p.name}</h4>
                            <p className="work-option-desc">{p.project_type} — {p.segments_filled}/{p.total_segments} segments — {p.skill_used || 'any'} DC {p.dc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Upgrade selection for base_upgrade */}
              {selectedActivity.id === 'base_upgrade' && !selectedUpgradeId && (
                <div>
                  <h3 style={{ marginBottom: '0.5rem' }}>Select an Upgrade</h3>
                  {inProgressUpgrades.length === 0 ? (
                    <p style={{ color: '#888' }}>No upgrades in progress. Start one from the Party Base page.</p>
                  ) : (
                    <div className="work-options-grid">
                      {inProgressUpgrades.map(u => (
                        <div key={u.id} className="work-option-card" onClick={() => setSelectedUpgradeId(u.id)}>
                          <div className="work-option-info">
                            <h4>{u.name}</h4>
                            <p className="work-option-desc">{Math.floor((u.hours_invested / u.hours_required) * 100)}% complete ({u.hours_invested.toFixed(1)}/{u.hours_required} hours)</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Show selected activity or work type */}
              <div className="selected-activity-card">
                <span className="activity-icon-large">
                  {selectedWorkType ? selectedWorkType.icon : selectedActivity.icon}
                </span>
                <h3>{selectedWorkType ? selectedWorkType.name : selectedActivity.name}</h3>
                <p>{selectedWorkType ? selectedWorkType.description : selectedActivity.description}</p>
                {selectedWorkType && (
                  <p className="work-earnings-preview">
                    Estimated: ~{(selectedWorkType.gpPerHour * duration).toFixed(0)} GP for {duration} hours
                    {selectedWorkType.xpBonus && ` + ${selectedWorkType.xpBonus * duration} XP`}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label>Duration (in-game hours)</label>
                <div className="duration-options">
                  {getDurationOptions(selectedActivity).map(hours => (
                    <button
                      key={hours}
                      className={`duration-btn ${duration === hours ? 'selected' : ''}`}
                      onClick={() => setDuration(hours)}
                    >
                      {hours}h
                    </button>
                  ))}
                </div>
                <div className="real-world-time" style={{
                  fontSize: '0.85rem',
                  color: 'rgba(255,255,255,0.7)',
                  marginTop: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <span>🕐</span>
                  <span>Real-world time: <strong>{formatRealWorldTime(duration)}</strong></span>
                </div>
                <small>
                  {selectedWorkType
                    ? `~${(selectedWorkType.gpPerHour * duration).toFixed(0)} GP earnings`
                    : selectedActivity.benefits?.perHour
                  }
                  {selectedActivity.maxHours && ` (max ${selectedActivity.maxHours} hours)`}
                </small>
              </div>

              <button
                className="button start-downtime-btn"
                onClick={startActivity}
                disabled={starting}
              >
                {starting ? 'Starting...' : `Begin ${selectedWorkType ? selectedWorkType.name : selectedActivity.name}`}
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="activities-grid">
            {activities.available.map(activity => (
              <div
                key={activity.id}
                className="activity-card available"
                onClick={() => {
                  setSelectedActivity(activity)
                  setDuration(Math.min(4, activity.maxHours || 4))
                }}
              >
                <span className="activity-icon">{activity.icon}</span>
                <h4>{activity.name}</h4>
                <p className="activity-desc">{activity.description}</p>
                <p className="activity-benefit">{activity.benefits?.base}</p>
              </div>
            ))}
          </div>

          {activities.unavailable.length > 0 && (
            <>
              <h3 className="unavailable-header">Unavailable</h3>
              <div className="activities-grid unavailable">
                {activities.unavailable.map(activity => (
                  <div
                    key={activity.id}
                    className="activity-card unavailable"
                  >
                    <span className="activity-icon">{activity.icon}</span>
                    <h4>{activity.name}</h4>
                    <p className="unavailable-reason">{activity.unavailableReason}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {history.length > 0 && (
            <div className="history-section">
              <button
                className="history-toggle"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? '▼' : '▶'} Recent Activity ({history.length})
              </button>

              {showHistory && (
                <div className="history-list">
                  {history.slice(0, 5).map(item => (
                    <div key={item.id} className="history-item">
                      <span className="history-icon">{item.activity?.icon}</span>
                      <div className="history-info">
                        <span className="history-name">{item.activity?.name}</span>
                        <span className="history-result">{item.results}</span>
                      </div>
                      <span className="history-hours">{item.duration_hours}h</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Downtime
