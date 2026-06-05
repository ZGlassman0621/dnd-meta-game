import { useState } from 'react'
import '../styles/hearth.css'
import '../styles/hearth-settings.css'

/* ───────────────────────── Hearth · Character Settings ───────────────────────
   Hearth dark-editorial styling of the character maintenance screen, built from
   Hearth/Settings.html. The mockup's DM-storytelling preferences (difficulty,
   narrative intensity, combat lethality, DM voice, table-rule toggles) are NOT
   rendered: the app has no backing data or API for them, so faking them would
   violate data-honesty. Instead the screen presents the component's REAL,
   already-wired maintenance actions in the design's set-card / set-row
   vocabulary, with danger-tinted rows for the destructive operations. All
   existing state, handlers, and API calls are preserved verbatim.
   ──────────────────────────────────────────────────────────────────────── */

// local inline icon sprite (paths copied from the design HTML's defs)
const HearthSettingsSprite = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
    <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></symbol>
    <symbol id="i-alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></symbol>
  </defs></svg>
)
const Ic = ({ n }) => <svg className="ic"><use href={'#i-' + n} /></svg>

function CharacterSettings({ character, onSettingsChanged, onBack }) {
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

  const charName = character?.nickname || character?.name || 'this character'

  return (
    <div className="hearth settings-screen app-bg">
      <HearthSettingsSprite />

      {/* ───────── HEADER ───────── */}
      <header className="dash-hdr">
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <div className="vr"></div>
        <button className="back" onClick={onBack} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>← Home</button>
        <span className="serif italic muted" style={{ fontSize: 15 }}>{charName}</span>
        <div className="spacer"></div>
        <span className="opus"><span className="dot"></span>Opus</span>
      </header>

      {/* ───────── SETTINGS ───────── */}
      <main className="settings">
        <h1 className="set-title">Settings</h1>
        <div className="set-sub">
          Maintenance tools for <em>{charName}</em>. These rewrite the chronicle — every action here is permanent.
        </div>

        <div className="set-card">
          <div className="set-row">
            <div className="sr-top">
              <span className="sr-name">Clear adventure history</span>
              <span className="sr-val">Records only</span>
            </div>
            <div className="sr-desc" style={{ marginBottom: 14 }}>
              Remove all past adventure records. Your character's stats remain untouched.
            </div>
            <button className="btn lg" onClick={handleClearHistory} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Clearing…' : 'Clear history'}
            </button>
          </div>

          <div className="set-row">
            <div className="sr-top">
              <span className="sr-name">Reset experience</span>
              <span className="sr-val">XP → 0</span>
            </div>
            <div className="sr-desc" style={{ marginBottom: 14 }}>
              Set experience points back to zero while keeping your level and other stats.
            </div>
            <button className="btn lg" onClick={handleResetXP} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Resetting…' : 'Reset XP to 0'}
            </button>
          </div>
        </div>

        <div className="sec-head" style={{ margin: '30px 0 14px' }}>
          <h2>Dangerous ground</h2>
          <span className="glyph">❧</span>
          <span className="fl"></span>
        </div>

        <div className="set-card">
          <div className="set-row danger">
            <div className="sr-top">
              <span className="sr-name">Full character reset</span>
              <span className="sr-val">Wipe progress</span>
            </div>
            <div className="sr-desc" style={{ marginBottom: 14 }}>
              Reset everything: XP to 0, HP to max, gold to starting amount, and clear inventory and adventure history.
            </div>
            <button className="btn danger lg" onClick={handleResetCharacter} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Resetting…' : 'Full reset'}
            </button>
          </div>

          <div className="set-row danger">
            <div className="sr-top">
              <span className="sr-name">Delete character</span>
              <span className="sr-val">Irreversible</span>
            </div>
            <div className="sr-desc" style={{ marginBottom: 14 }}>
              Permanently delete this character and all adventure history. This cannot be undone.
            </div>
            {!confirmDelete ? (
              <button className="btn danger lg" onClick={() => setConfirmDelete(true)} disabled={loading} style={{ width: '100%' }}>
                Delete character
              </button>
            ) : (
              <div className="confirm">
                <div className="cwarn">Are you sure? This deletion is irreversible.</div>
                <div className="crow">
                  <button className="btn lg" onClick={() => setConfirmDelete(false)} disabled={loading}>Cancel</button>
                  <button className="btn danger lg" onClick={handleDeleteCharacter} disabled={loading}>
                    {loading ? 'Deleting…' : 'Delete permanently'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="set-foot">
          {message && (
            <span className={`saved ${message.type === 'success' ? 'good' : 'bad'}`}>
              <Ic n={message.type === 'success' ? 'check' : 'alert'} />
              {message.text}
            </span>
          )}
        </div>

        <div className="set-note">
          <div className="nt">A word of caution</div>
          <div className="nb">These actions cannot be undone. Use them for testing, or when you want to begin this character's story again from a clean page.</div>
        </div>
      </main>
    </div>
  )
}

export default CharacterSettings
