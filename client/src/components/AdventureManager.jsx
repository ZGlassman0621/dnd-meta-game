import { useState } from 'react'

function AdventureManager({ character, onAdventureStarted }) {
  const [riskLevel, setRiskLevel] = useState('medium')
  const [duration, setDuration] = useState(8)
  const [options, setOptions] = useState([])
  const [selectedOption, setSelectedOption] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
          risk_level: riskLevel
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
          risk_level: riskLevel
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

  return (
    <div className="container">
      <h2>Start New Adventure</h2>

      {error && <div className="error">{error}</div>}

      <div className="form-group">
        <label>Risk Level</label>
        <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
          <option value="low">Low Risk (10% XP, 50% gold, 10% failure)</option>
          <option value="medium">Medium Risk (25% XP, 100% gold, 25% failure)</option>
          <option value="high">High Risk (40% XP, 180% gold, 40% failure)</option>
        </select>
      </div>

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
            : `In-game time: ${duration * 4} hours (${Math.floor(duration * 4 / 24)} days, ${(duration * 4) % 24} hours)`
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
              onClick={() => setSelectedOption(option)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                <h4>{option.title}</h4>
                <span className={`risk-badge risk-${riskLevel}`}>{riskLevel}</span>
              </div>
              <p style={{ color: '#bbb', marginBottom: '0.5rem' }}>{option.description}</p>
              <div style={{ fontSize: '0.85rem', color: '#888' }}>
                Type: {option.activity_type}
              </div>
            </div>
          ))}

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
          1 real-world hour = 4 in-game hours
        </p>
        <p style={{ fontSize: '0.9rem', color: '#bbb' }}>
          Current multiplier: x{getTimeMultiplier()} rewards
        </p>
      </div>
    </div>
  )
}

export default AdventureManager
