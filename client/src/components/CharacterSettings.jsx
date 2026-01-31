import { useState } from 'react'

function CharacterSettings({ character, onSettingsChanged }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear all adventure history? This cannot be undone.')) {
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/adventure/clear-history/${character.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Adventure history cleared successfully' })
        if (onSettingsChanged) onSettingsChanged()
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Failed to clear history' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear history' })
      console.error('Error clearing history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResetXP = async () => {
    if (!confirm('Reset XP to 0? This will keep your level and other stats intact.')) {
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/character/reset-xp/${character.id}`, {
        method: 'POST'
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'XP reset to 0' })
        if (onSettingsChanged) onSettingsChanged()
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Failed to reset XP' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reset XP' })
      console.error('Error resetting XP:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResetCharacter = async () => {
    if (!confirm('⚠️ FULL CHARACTER RESET ⚠️\n\nThis will reset:\n- XP to 0\n- HP to max\n- Gold to starting amount\n- Clear all adventure history\n- Clear inventory\n\nThis cannot be undone. Continue?')) {
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/character/full-reset/${character.id}`, {
        method: 'POST'
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Character fully reset' })
        if (onSettingsChanged) onSettingsChanged()
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Failed to reset character' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reset character' })
      console.error('Error resetting character:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCharacter = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/character/${character.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        window.location.reload() // Reload to refresh character list
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Failed to delete character' })
        setConfirmDelete(false)
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete character' })
      console.error('Error deleting character:', error)
      setConfirmDelete(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h2>⚙️ Character Settings</h2>

      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{
          padding: '1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Clear Adventure History</h3>
          <p style={{ fontSize: '0.9rem', color: '#bbb', marginBottom: '1rem' }}>
            Remove all past adventure records. Your character stats will remain unchanged.
          </p>
          <button
            className="button"
            onClick={handleClearHistory}
            disabled={loading}
            style={{ background: '#f39c12', width: '100%' }}
          >
            {loading ? 'Clearing...' : 'Clear History'}
          </button>
        </div>

        <div style={{
          padding: '1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Reset XP</h3>
          <p style={{ fontSize: '0.9rem', color: '#bbb', marginBottom: '1rem' }}>
            Reset experience points to 0 while keeping level and other stats.
          </p>
          <button
            className="button"
            onClick={handleResetXP}
            disabled={loading}
            style={{ background: '#3498db', width: '100%' }}
          >
            {loading ? 'Resetting...' : 'Reset XP to 0'}
          </button>
        </div>

        <div style={{
          padding: '1rem',
          background: 'rgba(231, 76, 60, 0.1)',
          borderRadius: '6px',
          border: '1px solid rgba(231, 76, 60, 0.3)'
        }}>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem', color: '#e74c3c' }}>⚠️ Full Character Reset</h3>
          <p style={{ fontSize: '0.9rem', color: '#bbb', marginBottom: '1rem' }}>
            Reset everything: XP to 0, HP to max, gold to starting amount, clear inventory and adventure history.
          </p>
          <button
            className="button button-danger"
            onClick={handleResetCharacter}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Resetting...' : 'Full Reset'}
          </button>
        </div>

        <div style={{
          padding: '1rem',
          background: 'rgba(192, 57, 43, 0.2)',
          borderRadius: '6px',
          border: '2px solid rgba(192, 57, 43, 0.5)'
        }}>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem', color: '#c0392b' }}>Delete Character</h3>
          <p style={{ fontSize: '0.9rem', color: '#bbb', marginBottom: '1rem' }}>
            Permanently delete this character and all adventure history. This action cannot be undone.
          </p>
          {!confirmDelete ? (
            <button
              className="button button-danger"
              onClick={() => setConfirmDelete(true)}
              disabled={loading}
              style={{ width: '100%', background: '#c0392b' }}
            >
              Delete Character
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.9rem', color: '#e74c3c', fontWeight: 'bold', textAlign: 'center' }}>
                Are you sure? This deletion is irreversible.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="button button-secondary"
                  onClick={() => setConfirmDelete(false)}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  className="button button-danger"
                  onClick={handleDeleteCharacter}
                  disabled={loading}
                  style={{ flex: 1, background: '#c0392b' }}
                >
                  {loading ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'rgba(52, 152, 219, 0.1)',
        borderRadius: '6px',
        fontSize: '0.85rem',
        color: '#bbb'
      }}>
        <strong style={{ color: '#3498db' }}>Note:</strong> These actions cannot be undone.
        Use these tools for testing or when starting fresh with your character.
      </div>
    </div>
  )
}

export default CharacterSettings
