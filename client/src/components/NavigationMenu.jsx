import { useState, useRef, useEffect } from 'react'

// Pages hidden from nav but code still exists for future reintegration / offline play:
// Character: (Downtime is now its own combined page with meta game + adventure history)
// World: showLocations, showFactions, showTravel, showWorldEvents, showLivingWorld,
//        showNPCGenerator, showNPCRelationships
// Story: showNarrativeQueue, showQuests, showBackstories (covered by Campaign Plan)
// Play: showMetaGame (embedded as DM Session tab), showGeneration (auto via campaign plan)

const menuCategories = {
  character: {
    label: 'Character',
    color: '#3498db',
    items: [
      { key: 'showCharacterSheet', label: 'Character Sheet' },
      { key: 'showCompanions', label: 'Companions' },
      { key: 'showParsedBackstory', label: 'Backstory Parser' },
      { key: 'showDowntime', label: 'Downtime & Stats' },
      { key: 'showSettings', label: 'Settings' }
    ]
  },
  story: {
    label: 'Story',
    color: '#9b59b6',
    items: [
      { key: 'showCampaigns', label: 'Campaigns' },
      { key: 'showCampaignPlan', label: 'Campaign Plan' },
      { key: 'showPlayerJournal', label: 'Player Journal' }
    ]
  },
  play: {
    label: 'Play',
    color: '#e67e22',
    items: [
      { key: 'showDMSession', label: 'AI Dungeon Master' },
      { key: 'showDMMode', label: 'DM Mode' }
    ]
  }
}

function DropdownMenu({ category, isOpen, onToggle, activeView, onNavigate, hasCharacter }) {
  const menuRef = useRef(null)
  const { label, color, items } = menuCategories[category]

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
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => onToggle(isOpen ? null : category)}
        style={{
          background: hasActiveItem ? `${color}33` : 'rgba(255, 255, 255, 0.1)',
          border: hasActiveItem ? `1px solid ${color}` : '1px solid rgba(255, 255, 255, 0.2)',
          color: '#fff',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem'
        }}
      >
        {label}
        <span style={{
          fontSize: '0.7rem',
          marginLeft: '0.2rem',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.25rem',
          background: 'rgba(30, 30, 40, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '6px',
          padding: '0.5rem 0',
          minWidth: '180px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000
        }}>
          {items.map(item => {
            // Skip character-dependent items if no character selected
            if (!hasCharacter && item.key !== 'showNPCGenerator' && item.key !== 'showDMMode') {
              return null
            }

            const isActive = activeView === item.key

            return (
              <button
                key={item.key}
                onClick={() => {
                  onNavigate(item.key)
                  onToggle(null)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.6rem 1rem',
                  background: isActive ? `${color}33` : 'transparent',
                  border: 'none',
                  color: isActive ? color : '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.target.style.background = 'rgba(255, 255, 255, 0.1)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.target.style.background = 'transparent'
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
    <div style={{
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center'
    }}>
      {user && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          marginRight: '0.5rem'
        }}>
          <span style={{ color: '#999', fontSize: '0.8rem' }}>
            {user.display_name || user.username}
          </span>
          <button
            onClick={() => {
              setCpError(null)
              setCpSuccess(false)
              setCpCurrentPassword('')
              setCpNewPassword('')
              setCpConfirmPassword('')
              setShowChangePassword(true)
            }}
            title="Change password"
            style={{
              background: 'none',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#999',
              padding: '0.3rem 0.6rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
            onMouseEnter={e => { e.target.style.color = '#8b5cf6'; e.target.style.borderColor = 'rgba(139, 92, 246, 0.4)' }}
            onMouseLeave={e => { e.target.style.color = '#999'; e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)' }}
          >
            Password
          </button>
          <button
            onClick={onLogout}
            title="Sign out"
            style={{
              background: 'none',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#999',
              padding: '0.3rem 0.6rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
            onMouseEnter={e => { e.target.style.color = '#e74c3c'; e.target.style.borderColor = 'rgba(231, 76, 60, 0.4)' }}
            onMouseLeave={e => { e.target.style.color = '#999'; e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)' }}
          >
            Sign Out
          </button>
        </div>
      )}

      {showChangePassword && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }} onClick={() => setShowChangePassword(false)}>
          <div style={{
            width: '100%', maxWidth: '360px', padding: '2rem',
            background: '#1e1e2e', border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '12px'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#f5f5f5', margin: '0 0 1.5rem', fontSize: '1.1rem' }}>
              Change Password
            </h3>
            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', color: '#ccc', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  Current Password
                </label>
                <input type="password" value={cpCurrentPassword} onChange={e => setCpCurrentPassword(e.target.value)}
                  required autoFocus style={{
                    width: '100%', padding: '0.5rem 0.7rem', background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#f5f5f5',
                    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                  }} />
              </div>
              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', color: '#ccc', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  New Password
                </label>
                <input type="password" value={cpNewPassword} onChange={e => setCpNewPassword(e.target.value)}
                  required minLength={6} style={{
                    width: '100%', padding: '0.5rem 0.7rem', background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#f5f5f5',
                    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                  }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#ccc', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  Confirm New Password
                </label>
                <input type="password" value={cpConfirmPassword} onChange={e => setCpConfirmPassword(e.target.value)}
                  required minLength={6} style={{
                    width: '100%', padding: '0.5rem 0.7rem', background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#f5f5f5',
                    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                  }} />
              </div>
              {cpError && (
                <div style={{
                  padding: '0.5rem', background: 'rgba(231,76,60,0.15)',
                  border: '1px solid rgba(231,76,60,0.3)', borderRadius: '6px',
                  color: '#e74c3c', fontSize: '0.85rem', marginBottom: '0.8rem'
                }}>{cpError}</div>
              )}
              {cpSuccess && (
                <div style={{
                  padding: '0.5rem', background: 'rgba(16,185,129,0.15)',
                  border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px',
                  color: '#10b981', fontSize: '0.85rem', marginBottom: '0.8rem'
                }}>Password changed successfully!</div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" disabled={cpLoading} style={{
                  flex: 1, padding: '0.6rem', background: cpLoading ? '#555' : '#8b5cf6',
                  border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.9rem',
                  fontWeight: '600', cursor: cpLoading ? 'not-allowed' : 'pointer'
                }}>
                  {cpLoading ? 'Changing...' : 'Change Password'}
                </button>
                <button type="button" onClick={() => setShowChangePassword(false)} style={{
                  padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
                  color: '#ccc', fontSize: '0.9rem', cursor: 'pointer'
                }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAnyViewActive && (
        <button
          onClick={onHome}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
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
