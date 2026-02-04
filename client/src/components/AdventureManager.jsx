import { useState, useEffect } from 'react'

// Time ratio presets (matching server)
const TIME_RATIOS = {
  realtime: { label: 'Real-Time', ratio: 1, description: '1 real hour = 1 in-game hour' },
  leisurely: { label: 'Leisurely', ratio: 4, description: '1 real hour = 4 in-game hours' },
  normal: { label: 'Normal', ratio: 8, description: '1 real hour = 8 in-game hours' },
  fast: { label: 'Fast', ratio: 12, description: '1 real hour = 12 in-game hours' },
  montage: { label: 'Montage', ratio: 24, description: '1 real hour = 1 in-game day' }
}

function AdventureManager({ character, onAdventureStarted }) {
  const [duration, setDuration] = useState(8)
  const [options, setOptions] = useState([])
  const [selectedOption, setSelectedOption] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [campaignContext, setCampaignContext] = useState(null)
  const [loadingContext, setLoadingContext] = useState(true)
  const [timeAdvanceHours, setTimeAdvanceHours] = useState(1)
  const [advancingTime, setAdvancingTime] = useState(false)
  const [oddsPreview, setOddsPreview] = useState(null)
  const [loadingOdds, setLoadingOdds] = useState(false)

  // Load campaign context on mount
  useEffect(() => {
    loadCampaignContext()
  }, [character.id])

  // Get assigned companion IDs for the selected adventure
  const getAssignedCompanionIds = (option) => {
    if (!campaignContext?.companions?.length || !option) return []

    const recommended = option.recommended_participants
    if (!recommended || recommended.length === 0 || recommended.includes('all')) {
      // Default to all companions
      return campaignContext.companions.map(c => c.id)
    }

    // Match recommended names to companion IDs (case-insensitive first name match)
    return campaignContext.companions
      .filter(companion => {
        const firstName = (companion.name || companion.nickname || '').split(' ')[0].toLowerCase()
        return recommended.some(rec => rec.toLowerCase() === firstName)
      })
      .map(c => c.id)
  }

  // Get assigned companions as objects for display
  const getAssignedCompanions = (option) => {
    if (!campaignContext?.companions?.length || !option) return []

    const recommended = option.recommended_participants
    if (!recommended || recommended.length === 0 || recommended.includes('all')) {
      return campaignContext.companions
    }

    return campaignContext.companions.filter(companion => {
      const firstName = (companion.name || companion.nickname || '').split(' ')[0].toLowerCase()
      return recommended.some(rec => rec.toLowerCase() === firstName)
    })
  }

  const loadCampaignContext = async () => {
    setLoadingContext(true)
    try {
      const contextRes = await fetch(`/api/meta-game/context/${character.id}`)
      if (contextRes.ok) {
        setCampaignContext(await contextRes.json())
      }
    } catch (err) {
      console.error('Error loading campaign context:', err)
    }
    setLoadingContext(false)
  }

  // Fetch odds preview when adventure is selected
  const fetchOddsPreview = async (option) => {
    if (!option) {
      setOddsPreview(null)
      return
    }

    setLoadingOdds(true)
    try {
      const companionIds = getAssignedCompanionIds(option)
      const response = await fetch('/api/adventure/preview-odds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: character.id,
          risk_level: option.risk_level || 'medium',
          activity_type: option.activity_type || 'combat',
          participating_companions: companionIds
        })
      })

      if (response.ok) {
        const data = await response.json()
        setOddsPreview(data.odds)
      }
    } catch (err) {
      console.error('Error fetching odds preview:', err)
    }
    setLoadingOdds(false)
  }

  // Handle option selection with odds fetch
  const handleSelectOption = (option) => {
    setSelectedOption(option)
    fetchOddsPreview(option)
  }

  const changeTimeRatio = async (newRatio) => {
    try {
      await fetch(`/api/meta-game/time-ratio/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratio: newRatio })
      })
      await loadCampaignContext()
    } catch (err) {
      console.error('Error changing time ratio:', err)
    }
  }

  const advanceTime = async () => {
    if (advancingTime || timeAdvanceHours < 1) return
    setAdvancingTime(true)
    try {
      await fetch(`/api/meta-game/advance-time/${character.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: timeAdvanceHours })
      })
      await loadCampaignContext()
    } catch (err) {
      console.error('Error advancing time:', err)
    }
    setAdvancingTime(false)
  }

  const handleGenerateOptions = async () => {
    setLoading(true)
    setError(null)
    setOptions([])
    setSelectedOption(null)

    try {
      const response = await fetch('/api/adventure/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: character.id,
          risk_level: 'all'  // Generate one adventure per risk level
        })
      })

      const data = await response.json()
      setOptions(data.options)
    } catch (err) {
      setError('Failed to generate adventure options. Please try again.')
      console.error('Error generating options:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStartAdventure = async () => {
    if (!selectedOption) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/adventure/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: character.id,
          adventure: selectedOption,
          duration_hours: duration,
          risk_level: selectedOption.risk_level || 'medium',
          participating_companions: getAssignedCompanionIds(selectedOption)
        })
      })

      if (response.ok) {
        onAdventureStarted()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to start adventure')
      }
    } catch (err) {
      setError('Failed to start adventure. Please try again.')
      console.error('Error starting adventure:', err)
    } finally {
      setLoading(false)
    }
  }

  const getTimeMultiplier = () => {
    if (duration >= 24) return 2.0
    if (duration >= 14) return 1.6
    if (duration >= 10) return 1.3
    if (duration >= 8) return 1.0
    if (duration >= 4) return 0.7
    return 0.3
  }

  const currentRatio = campaignContext?.calendar?.timeRatio || 'normal'
  const calendar = campaignContext?.calendar

  return (
    <div className="container">
      {/* Campaign Context Header */}
      {campaignContext && (
        <div style={{
          background: 'rgba(46, 204, 113, 0.1)',
          border: '1px solid rgba(46, 204, 113, 0.3)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Campaign Date & Time</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2ecc71' }}>
                {calendar?.formatted || 'Unknown'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#f39c12', marginTop: '0.25rem' }}>
                {calendar?.formattedTime || '8:00 AM'} ({calendar?.timeOfDay || 'morning'})
              </div>
              <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>
                {calendar?.season?.charAt(0).toUpperCase() + calendar?.season?.slice(1)} Season
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Time Flow</div>
              <select
                value={currentRatio}
                onChange={(e) => changeTimeRatio(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.9rem'
                }}
              >
                {Object.entries(TIME_RATIOS).map(([key, info]) => (
                  <option key={key} value={key} style={{ background: '#1a1a2e', color: '#fff' }}>
                    {info.label}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                {TIME_RATIOS[currentRatio]?.description}
              </div>

              {/* Manual Time Advance */}
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <select
                  value={timeAdvanceHours}
                  onChange={(e) => setTimeAdvanceHours(parseInt(e.target.value))}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '0.3rem 0.4rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="1" style={{ background: '#1a1a2e' }}>1 hour</option>
                  <option value="4" style={{ background: '#1a1a2e' }}>4 hours</option>
                  <option value="8" style={{ background: '#1a1a2e' }}>8 hours</option>
                  <option value="12" style={{ background: '#1a1a2e' }}>12 hours</option>
                  <option value="24" style={{ background: '#1a1a2e' }}>1 day</option>
                </select>
                <button
                  onClick={advanceTime}
                  disabled={advancingTime}
                  style={{
                    background: 'rgba(52, 152, 219, 0.3)',
                    border: '1px solid rgba(52, 152, 219, 0.5)',
                    color: '#fff',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    cursor: advancingTime ? 'not-allowed' : 'pointer',
                    opacity: advancingTime ? 0.6 : 1
                  }}
                >
                  {advancingTime ? '...' : 'Advance'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{
            display: 'flex',
            gap: '1.5rem',
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            flexWrap: 'wrap'
          }}>
            <div>
              <span style={{ color: '#888', fontSize: '0.8rem' }}>Location: </span>
              <span style={{ color: '#fff' }}>{campaignContext.character?.currentLocation || 'Unknown'}</span>
            </div>
            {campaignContext.companions?.length > 0 && (
              <div>
                <span style={{ color: '#888', fontSize: '0.8rem' }}>Party: </span>
                <span style={{ color: '#fff' }}>
                  {campaignContext.companions.map(c => (c.name || c.npc_name || '').split(' ')[0]).join(', ')}
                </span>
              </div>
            )}
            {campaignContext.character?.currentQuest && (
              <div style={{ flex: 1 }}>
                <span style={{ color: '#888', fontSize: '0.8rem' }}>Quest: </span>
                <span style={{ color: '#f39c12' }}>{campaignContext.character.currentQuest}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <h2>Start New Adventure</h2>

      {error && <div className="error">{error}</div>}

      <div className="form-group">
        <label>Duration (Real-World Hours)</label>
        <select value={duration} onChange={(e) => setDuration(parseFloat(e.target.value))}>
          <option value="0.033">TEST: 2 minutes (simulates 8-hour rewards)</option>
          <option value="2">2 hours (x0.3 rewards)</option>
          <option value="4">4 hours (x0.7 rewards)</option>
          <option value="8">8 hours (x1.0 rewards)</option>
          <option value="10">10 hours (x1.3 rewards)</option>
          <option value="14">14 hours (x1.6 rewards)</option>
          <option value="24">24 hours (x2.0 rewards)</option>
        </select>
        <small style={{ color: '#bbb', marginTop: '0.5rem', display: 'block' }}>
          {duration === 0.033
            ? 'TEST MODE: 2 minutes real time, simulates 8-hour (x1.0) rewards'
            : `In-game time: ${Math.round(duration * (TIME_RATIOS[currentRatio]?.ratio || 6))} hours (${Math.floor(duration * (TIME_RATIOS[currentRatio]?.ratio || 6) / 24)} days)`
          }
        </small>
      </div>

      <button
        className="button"
        onClick={handleGenerateOptions}
        disabled={loading}
        style={{ marginBottom: '1.5rem' }}
      >
        {loading ? 'Generating Adventures...' : 'Generate Adventure Options'}
      </button>

      {loading && !options.length && (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#bbb',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          marginBottom: '1.5rem'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚔️</div>
          <div>Consulting with the local guild...</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.7 }}>
            Generating contextual adventures based on your quest
          </div>
        </div>
      )}

      {options.length > 0 && (
        <>
          <h3 style={{ marginBottom: '1rem' }}>Available Adventures</h3>

          {options.map((option, index) => (
            <div
              key={index}
              className={`adventure-option ${selectedOption === option ? 'selected' : ''}`}
              onClick={() => handleSelectOption(option)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                <h4>{option.title}</h4>
                <span className={`risk-badge risk-${option.risk_level || 'medium'}`}>{option.risk_level || 'medium'}</span>
              </div>
              <p style={{ color: '#bbb', marginBottom: '0.5rem' }}>{option.description}</p>
              <div style={{ fontSize: '0.85rem', color: '#888', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span>Type: {option.activity_type}</span>
                {option.quest_relevance && option.quest_relevance !== 'side_quest' && (
                  <span style={{
                    color: option.quest_relevance === 'quest_advancing' ? '#2ecc71' : '#f39c12',
                    fontWeight: 500
                  }}>
                    {option.quest_relevance === 'quest_advancing' ? '⭐ Quest Advancing' : '🔗 Quest Adjacent'}
                  </span>
                )}
              </div>
              {campaignContext?.companions?.length > 0 && option.recommended_participants && (
                <div style={{ fontSize: '0.8rem', color: '#9b59b6', marginTop: '0.5rem', fontStyle: 'italic' }}>
                  Party: {option.recommended_participants.includes('all')
                    ? 'Everyone'
                    : option.recommended_participants.join(', ').replace(/, ([^,]*)$/, ' and $1')
                  }
                </div>
              )}
            </div>
          ))}

          {/* Assigned Party Members (read-only) */}
          {campaignContext?.companions?.length > 0 && selectedOption && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'rgba(155, 89, 182, 0.1)',
              border: '1px solid rgba(155, 89, 182, 0.3)',
              borderRadius: '6px'
            }}>
              <h4 style={{ marginBottom: '0.75rem', color: '#9b59b6' }}>Assigned Party</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {getAssignedCompanions(selectedOption).map(companion => (
                  <div
                    key={companion.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.75rem',
                      background: 'rgba(155, 89, 182, 0.25)',
                      border: '1px solid rgba(155, 89, 182, 0.5)',
                      borderRadius: '4px'
                    }}
                  >
                    <span style={{ color: '#fff', fontWeight: 500 }}>
                      {companion.name?.split(' ')[0] || companion.nickname}
                    </span>
                    {companion.class && (
                      <span style={{ color: '#aaa', fontSize: '0.8rem' }}>
                        {companion.class}
                      </span>
                    )}
                  </div>
                ))}
                {getAssignedCompanions(selectedOption).length === 0 && (
                  <span style={{ color: '#888', fontStyle: 'italic' }}>Solo mission</span>
                )}
              </div>
              {getAssignedCompanions(selectedOption).length < campaignContext.companions.length && (
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.75rem' }}>
                  Companions not participating will receive 50% XP.
                </div>
              )}
            </div>
          )}

          {/* Odds Preview Display */}
          {selectedOption && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'rgba(52, 152, 219, 0.1)',
              border: '1px solid rgba(52, 152, 219, 0.3)',
              borderRadius: '6px'
            }}>
              <h4 style={{ marginBottom: '0.75rem', color: '#3498db', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Success Odds</span>
                {loadingOdds && <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>calculating...</span>}
              </h4>

              {oddsPreview ? (
                <>
                  {/* Main odds display */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: 'bold',
                      color: oddsPreview.finalChance >= 70 ? '#2ecc71' :
                             oddsPreview.finalChance >= 50 ? '#f39c12' : '#e74c3c'
                    }}>
                      {oddsPreview.finalChance}%
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#888' }}>
                      chance of success
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '4px',
                    padding: '0.75rem'
                  }}>
                    {oddsPreview.breakdown?.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.4rem 0',
                        borderBottom: idx < oddsPreview.breakdown.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none'
                      }}>
                        <div>
                          <div style={{ color: '#fff', fontSize: '0.9rem' }}>{item.factor}</div>
                          <div style={{ color: '#888', fontSize: '0.75rem' }}>{item.description}</div>
                        </div>
                        <div style={{
                          color: item.value.startsWith('+') ? '#2ecc71' :
                                 item.value.startsWith('-') ? '#e74c3c' : '#fff',
                          fontWeight: 'bold',
                          fontSize: '0.95rem'
                        }}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Synergy details expandable */}
                  {oddsPreview.synergyDetails && (
                    <details style={{ marginTop: '0.75rem' }}>
                      <summary style={{ cursor: 'pointer', color: '#888', fontSize: '0.85rem' }}>
                        View party synergy details
                      </summary>
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.5rem' }}>
                          Activity: {oddsPreview.synergyDetails.activity}
                        </div>
                        {oddsPreview.synergyDetails.breakdown?.filter(b => b.bonus || b.penalty).map((item, idx) => (
                          <div key={idx} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.8rem',
                            padding: '0.2rem 0',
                            color: item.bonus ? '#2ecc71' : item.penalty ? '#e74c3c' : '#888'
                          }}>
                            <span style={{ textTransform: 'capitalize' }}>
                              {item.type.replace(/_/g, ' ')}: {item.role.replace(/_/g, ' ')}
                            </span>
                            <span>
                              {item.bonus ? `+${item.bonus}%` : item.penalty ? `-${item.penalty}%` : ''}
                            </span>
                          </div>
                        ))}
                        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem', fontStyle: 'italic' }}>
                          Roles present: {oddsPreview.synergyDetails.rolesPresent?.join(', ') || 'none'}
                        </div>
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <div style={{ color: '#888', fontSize: '0.9rem', textAlign: 'center' }}>
                  Select an adventure to see success odds
                </div>
              )}
            </div>
          )}

          <button
            className="button"
            onClick={handleStartAdventure}
            disabled={!selectedOption || loading}
            style={{ marginTop: '1rem', width: '100%' }}
          >
            {loading ? 'Starting...' : 'Begin Adventure'}
          </button>
        </>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '6px' }}>
        <h4 style={{ marginBottom: '0.5rem', color: '#3498db' }}>Time Scale Info</h4>
        <p style={{ fontSize: '0.9rem', color: '#bbb', marginBottom: '0.5rem' }}>
          {TIME_RATIOS[currentRatio]?.description || '1 real-world hour = 6 in-game hours'}
        </p>
        <p style={{ fontSize: '0.9rem', color: '#bbb', marginBottom: '0.5rem' }}>
          In-game duration: ~{Math.round(duration * (TIME_RATIOS[currentRatio]?.ratio || 6))} hours ({Math.floor(duration * (TIME_RATIOS[currentRatio]?.ratio || 6) / 24)} days)
        </p>
        <p style={{ fontSize: '0.9rem', color: '#bbb' }}>
          Reward multiplier: x{getTimeMultiplier()}
        </p>
      </div>
    </div>
  )
}

export default AdventureManager
