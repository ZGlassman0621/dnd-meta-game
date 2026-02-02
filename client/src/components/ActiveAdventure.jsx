import { useState, useEffect } from 'react'

function ActiveAdventure({ adventure, character, onAdventureClaimed, onAdventureComplete }) {
  const [timeRemaining, setTimeRemaining] = useState('')
  const [progress, setProgress] = useState(0)
  const [hasNotified, setHasNotified] = useState(false)

  useEffect(() => {
    if (adventure.status === 'active') {
      // Update every 100ms for smooth progress bar
      const interval = setInterval(() => {
        updateTimeRemaining()
      }, 100)

      updateTimeRemaining()
      return () => clearInterval(interval)
    }
  }, [adventure])

  const updateTimeRemaining = () => {
    const now = new Date()
    const start = new Date(adventure.adventure.start_time)
    const end = new Date(adventure.adventure.end_time)
    const diff = end - now
    const total = end - start

    // Calculate progress locally for smooth updates
    const currentProgress = Math.min(100, Math.max(0, ((now - start) / total) * 100))
    setProgress(currentProgress)

    if (diff <= 0) {
      setTimeRemaining('Complete!')
      setProgress(100)
      // Notify parent that adventure is complete so it can refresh status
      if (!hasNotified && onAdventureComplete) {
        setHasNotified(true)
        setTimeout(() => onAdventureComplete(), 1000) // Wait 1 second before checking
      }
      return
    }

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`)
  }

  const handleClaimRewards = async () => {
    try {
      const response = await fetch(`/api/adventure/claim/${adventure.adventure.id}`, {
        method: 'POST'
      })

      if (response.ok) {
        onAdventureClaimed()
      }
    } catch (error) {
      console.error('Error claiming rewards:', error)
    }
  }

  const handleCancelAdventure = async () => {
    if (!confirm('Are you sure you want to cancel this adventure? Progress will be lost.')) {
      return
    }

    try {
      const response = await fetch(`/api/adventure/cancel/${character.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onAdventureClaimed() // Use same callback to refresh
      }
    } catch (error) {
      console.error('Error cancelling adventure:', error)
    }
  }

  if (adventure.status === 'active') {
    return (
      <div className="container">
        <h2>Adventure In Progress</h2>

        <div className="adventure-option" style={{ cursor: 'default' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <h3>{adventure.adventure.title}</h3>
            <span className={`risk-badge risk-${adventure.adventure.risk_level}`}>
              {adventure.adventure.risk_level}
            </span>
          </div>
          <p style={{ color: '#bbb' }}>{adventure.adventure.description}</p>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span>Progress</span>
            <span>{Math.floor(progress)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: '#bbb', marginBottom: '0.5rem' }}>
            Time Remaining
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f39c12' }}>
            {timeRemaining}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px' }}>
          <p style={{ fontSize: '0.9rem', color: '#bbb', textAlign: 'center' }}>
            Your character is currently adventuring. Check back when the timer completes to see the results!
          </p>
        </div>

        <button
          className="button button-danger"
          onClick={handleCancelAdventure}
          style={{ marginTop: '1rem', width: '100%' }}
        >
          Cancel Adventure
        </button>
      </div>
    )
  }

  if (adventure.status === 'completed') {
    // Results can come from two places:
    // 1. adventure.results (when just completed from active status check)
    // 2. adventure.adventure.results (when loaded from database)
    const results = adventure.results || JSON.parse(adventure.adventure.results)

    return (
      <div className="container">
        <h2>Adventure Complete!</h2>

        <div className="adventure-option" style={{ cursor: 'default' }}>
          <h3>{adventure.adventure.title}</h3>
          <p style={{ color: '#bbb' }}>{adventure.adventure.description}</p>
        </div>

        <div className={results.success ? 'success' : 'error'} style={{ marginTop: '1.5rem' }}>
          <strong>{results.success ? 'Success!' : 'Failed'}</strong>
        </div>

        {results.narrative && (
          <div className="narrative">
            {results.narrative}
          </div>
        )}

        {results.success && results.rewards && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Rewards</h3>
            <div className="stat-grid">
              <div className="stat">
                <div className="stat-label">Experience</div>
                <div className="stat-value">+{results.rewards.xp} XP</div>
              </div>
              <div className="stat">
                <div className="stat-label">Gold</div>
                <div className="stat-value">
                  {results.rewards.gold.gp > 0 && `${results.rewards.gold.gp}g `}
                  {results.rewards.gold.sp > 0 && `${results.rewards.gold.sp}s `}
                  {results.rewards.gold.cp > 0 && `${results.rewards.gold.cp}c`}
                </div>
              </div>
              {results.rewards.hp_restored && results.rewards.hp_restored > 0 && (
                <div className="stat">
                  <div className="stat-label">HP Restored</div>
                  <div className="stat-value" style={{ color: '#2ecc71' }}>+{results.rewards.hp_restored} HP</div>
                </div>
              )}
            </div>

            {results.rewards.loot && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'rgba(241, 196, 15, 0.1)',
                borderRadius: '6px',
                border: '1px solid rgba(241, 196, 15, 0.3)'
              }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f1c40f', marginBottom: '0.5rem' }}>
                  ⚔️ Loot Found!
                </div>
                <div style={{ fontSize: '1rem', color: '#fff' }}>
                  {results.rewards.loot}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#bbb', marginTop: '0.5rem' }}>
                  Added to your inventory
                </div>
              </div>
            )}
          </div>
        )}

        {!results.success && results.consequences && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', color: '#e74c3c' }}>Consequences</h3>
            <ul style={{ paddingLeft: '1.5rem', color: '#bbb' }}>
              {results.consequences.map((consequence, index) => (
                <li key={index} style={{ marginBottom: '0.5rem' }}>
                  {consequence.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="button-group" style={{ marginTop: '1.5rem' }}>
          <button
            className="button"
            onClick={handleClaimRewards}
            style={{ flex: 1 }}
          >
            Claim & Continue
          </button>
          <button
            className="button button-danger"
            onClick={handleCancelAdventure}
            style={{ flex: 0, minWidth: '120px' }}
          >
            Clear Results
          </button>
        </div>
      </div>
    )
  }

  return null
}

export default ActiveAdventure
