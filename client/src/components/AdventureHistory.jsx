import { useState, useEffect } from 'react'

function AdventureHistory({ character }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (character) {
      loadHistory()
    }
  }, [character])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/adventure/history/${character.id}`)
      const data = await response.json()
      setHistory(data)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatDuration = (hours) => {
    if (hours < 0.05) return '2 min (TEST)'
    if (hours < 1) return `${Math.round(hours * 60)} min`
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d ${hours % 24}h`
  }

  const getStatusBadge = (status, results) => {
    if (status === 'cancelled') {
      return <span className="risk-badge" style={{ background: '#95a5a6' }}>Cancelled</span>
    }

    if (results) {
      const parsedResults = typeof results === 'string' ? JSON.parse(results) : results
      if (parsedResults.success) {
        return <span className="risk-badge" style={{ background: '#2ecc71' }}>Success</span>
      } else {
        return <span className="risk-badge" style={{ background: '#e74c3c' }}>Failed</span>
      }
    }

    return <span className="risk-badge" style={{ background: '#f39c12' }}>In Progress</span>
  }

  if (loading) {
    return (
      <div className="container">
        <h2>Adventure History</h2>
        <p style={{ color: '#bbb', textAlign: 'center', padding: '2rem' }}>Loading history...</p>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="container">
        <h2>Adventure History</h2>
        <p style={{ color: '#bbb', textAlign: 'center', padding: '2rem' }}>
          No adventures yet. Start your first adventure to build your legend!
        </p>
      </div>
    )
  }

  return (
    <div className="container">
      <h2>Adventure History</h2>
      <p style={{ color: '#bbb', marginBottom: '1rem', fontSize: '0.9rem' }}>
        {history.length} adventure{history.length !== 1 ? 's' : ''} completed
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {history.map((adventure) => {
          const results = adventure.results ? JSON.parse(adventure.results) : null
          const isExpanded = expanded === adventure.id

          return (
            <div
              key={adventure.id}
              className="adventure-option"
              onClick={() => setExpanded(isExpanded ? null : adventure.id)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ marginBottom: '0.25rem' }}>{adventure.title}</h4>
                  <div style={{ fontSize: '0.85rem', color: '#888' }}>
                    {formatDate(adventure.start_time)} • {formatDuration(adventure.duration_hours)} • {adventure.risk_level} risk
                  </div>
                </div>
                {getStatusBadge(adventure.status, results)}
              </div>

              {isExpanded && (
                <>
                  <p style={{ color: '#bbb', fontSize: '0.9rem', marginTop: '0.75rem' }}>
                    {adventure.description}
                  </p>

                  {results && (
                    <>
                      {results.narrative && (
                        <div className="narrative" style={{ marginTop: '1rem' }}>
                          {results.narrative}
                        </div>
                      )}

                      {results.success && results.rewards && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(46, 204, 113, 0.1)', borderRadius: '4px' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#2ecc71', marginBottom: '0.5rem' }}>
                            Rewards
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#bbb' }}>
                            +{results.rewards.xp} XP
                            {results.rewards.gold && (results.rewards.gold.gp > 0 || results.rewards.gold.sp > 0 || results.rewards.gold.cp > 0) && (
                              <> • {results.rewards.gold.gp}g {results.rewards.gold.sp}s {results.rewards.gold.cp}c</>
                            )}
                            {results.rewards.hp_restored > 0 && (
                              <> • +{results.rewards.hp_restored} HP</>
                            )}
                          </div>
                        </div>
                      )}

                      {!results.success && results.consequences && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(231, 76, 60, 0.1)', borderRadius: '4px' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#e74c3c', marginBottom: '0.5rem' }}>
                            Consequences
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#bbb' }}>
                            {results.consequences.map((consequence, idx) => (
                              <li key={idx}>{consequence.description}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}

                  {adventure.status === 'cancelled' && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(149, 165, 166, 0.1)', borderRadius: '4px', fontSize: '0.85rem', color: '#95a5a6' }}>
                      Adventure was cancelled before completion
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: '#666' }}>
                    Click to collapse
                  </div>
                </>
              )}

              {!isExpanded && (
                <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                  Click to view details
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AdventureHistory
