import { useState, useRef, useEffect } from 'react'
import '../styles/hearth.css'
import '../styles/hearth-dashboard.css'

// MVP navigation: Character (sheet / companions / backstory parser / settings),
// Story (campaigns / campaign plan), Play (AI Dungeon Master).
//
// Hearth conversion (dashboard) — the menu now flows inline inside the
// persistent .dash-hdr. The three category buttons use the dark-editorial
// register (hairline pills, gold active state); the dropdown is a warm
// near-black card. All navigation wiring (activeView / onNavigate /
// hasCharacter / onHome) is preserved unchanged.

const menuCategories = {
  character: {
    label: 'Character',
    items: [
      { key: 'showCharacterSheet', label: 'Character Sheet' },
      { key: 'showCompanions', label: 'Companions' },
      { key: 'showParsedBackstory', label: 'Backstory Parser' },
      { key: 'showSettings', label: 'Settings' }
    ]
  },
  story: {
    label: 'Story',
    items: [
      { key: 'showCampaigns', label: 'Campaigns' },
      { key: 'showCampaignPlan', label: 'Campaign Plan' }
    ]
  },
  play: {
    label: 'Play',
    items: [
      { key: 'showDMSession', label: 'AI Dungeon Master' }
    ]
  }
}

function DropdownMenu({ category, isOpen, onToggle, activeView, onNavigate, hasCharacter }) {
  const menuRef = useRef(null)
  const { label, items } = menuCategories[category]

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        if (isOpen) onToggle(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onToggle])

  // Check if any item in this category is active
  const hasActiveItem = items.some(item => activeView === item.key)

  return (
    <div ref={menuRef} className="nav-cat">
      <button
        type="button"
        className={`nav-cat-btn${hasActiveItem ? ' active' : ''}`}
        onClick={() => onToggle(isOpen ? null : category)}
      >
        {label}
        <span className={`caret${isOpen ? ' open' : ''}`} aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div className="nav-cat-menu">
          {items.map(item => {
            // Skip character-dependent items if no character selected
            if (!hasCharacter) {
              return null
            }

            const isActive = activeView === item.key

            return (
              <button
                type="button"
                key={item.key}
                className={`nav-cat-item${isActive ? ' active' : ''}`}
                onClick={() => {
                  onNavigate(item.key)
                  onToggle(null)
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function NavigationMenu({ activeView, onNavigate, hasCharacter, onHome, user, onLogout }) {
  const [openMenu, setOpenMenu] = useState(null)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [cpCurrentPassword, setCpCurrentPassword] = useState('')
  const [cpNewPassword, setCpNewPassword] = useState('')
  const [cpConfirmPassword, setCpConfirmPassword] = useState('')
  const [cpError, setCpError] = useState(null)
  const [cpSuccess, setCpSuccess] = useState(false)
  const [cpLoading, setCpLoading] = useState(false)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setCpError(null)
    setCpSuccess(false)

    if (cpNewPassword !== cpConfirmPassword) {
      setCpError('New passwords do not match')
      return
    }

    setCpLoading(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword: cpCurrentPassword, newPassword: cpNewPassword })
      })
      const data = await res.json()
      if (!res.ok) {
        setCpError(data.error || 'Failed to change password')
        return
      }
      setCpSuccess(true)
      setCpCurrentPassword('')
      setCpNewPassword('')
      setCpConfirmPassword('')
      setTimeout(() => setShowChangePassword(false), 1500)
    } catch {
      setCpError('Failed to connect to server')
    } finally {
      setCpLoading(false)
    }
  }

  const isAnyViewActive = activeView !== null

  return (
    <div className="nav-menu">
      {/* Auth was removed for the single-player MVP — onLogout is undefined,
         so the account block (Password / Sign Out) only mounts if a real
         logout handler is supplied. Keeps the persistent header clean. */}
      {user && onLogout && (
        <div className="nav-account">
          <span className="nav-user">{user.display_name || user.username}</span>
          <button
            type="button"
            className="hdr-link as-btn"
            onClick={() => {
              setCpError(null)
              setCpSuccess(false)
              setCpCurrentPassword('')
              setCpNewPassword('')
              setCpConfirmPassword('')
              setShowChangePassword(true)
            }}
            title="Change password"
          >
            Password
          </button>
          <button type="button" className="hdr-link as-btn" onClick={onLogout} title="Sign out">
            Sign Out
          </button>
          <span className="vr" />
        </div>
      )}

      {showChangePassword && (
        <div className="scrim" onClick={() => setShowChangePassword(false)}>
          <div className="modal" style={{ width: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head"><h3>Change password</h3></div>
            <div className="modal-body">
              <form onSubmit={handleChangePassword}>
                <div style={{ marginBottom: '0.8rem' }}>
                  <label className="label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Current password
                  </label>
                  <input type="password" value={cpCurrentPassword} onChange={e => setCpCurrentPassword(e.target.value)}
                    required autoFocus className="cp-input" />
                </div>
                <div style={{ marginBottom: '0.8rem' }}>
                  <label className="label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    New password
                  </label>
                  <input type="password" value={cpNewPassword} onChange={e => setCpNewPassword(e.target.value)}
                    required minLength={6} className="cp-input" />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Confirm new password
                  </label>
                  <input type="password" value={cpConfirmPassword} onChange={e => setCpConfirmPassword(e.target.value)}
                    required minLength={6} className="cp-input" />
                </div>
                {cpError && <div className="cp-msg bad">{cpError}</div>}
                {cpSuccess && <div className="cp-msg good">Password changed successfully.</div>}
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: 4 }}>
                  <button type="submit" className="btn primary" disabled={cpLoading} style={{ flex: 1 }}>
                    {cpLoading ? 'Changing…' : 'Change password'}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setShowChangePassword(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isAnyViewActive && (
        <button type="button" className="hdr-link as-btn nav-home" onClick={onHome}>
          Home
        </button>
      )}

      {Object.keys(menuCategories).map(category => (
        <DropdownMenu
          key={category}
          category={category}
          isOpen={openMenu === category}
          onToggle={setOpenMenu}
          activeView={activeView}
          onNavigate={onNavigate}
          hasCharacter={hasCharacter}
        />
      ))}
    </div>
  )
}
