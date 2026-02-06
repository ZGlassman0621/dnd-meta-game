import { useState, useRef, useEffect } from 'react'

const menuCategories = {
  character: {
    label: 'Character',
    color: '#3498db',
    items: [
      { key: 'showCharacterSheet', label: 'Character Sheet' },
      { key: 'showCompanions', label: 'Companions' },
      { key: 'showParsedBackstory', label: 'Backstory Parser' },
      { key: 'showDowntime', label: 'Downtime' },
      { key: 'showSettings', label: 'Settings' }
    ]
  },
  world: {
    label: 'World',
    color: '#27ae60',
    items: [
      { key: 'showLocations', label: 'Locations' },
      { key: 'showFactions', label: 'Factions' },
      { key: 'showNPCGenerator', label: 'NPC Generator' },
      { key: 'showNPCRelationships', label: 'NPC Relationships' },
      { key: 'showTravel', label: 'Travel' },
      { key: 'showWorldEvents', label: 'World Events' },
      { key: 'showLivingWorld', label: 'Living World' }
    ]
  },
  story: {
    label: 'Story',
    color: '#9b59b6',
    items: [
      { key: 'showCampaigns', label: 'Campaigns' },
      { key: 'showQuests', label: 'Quests' },
      { key: 'showBackstories', label: 'Companion Backstories' },
      { key: 'showNarrativeQueue', label: 'Narrative Queue' }
    ]
  },
  play: {
    label: 'Play',
    color: '#e67e22',
    items: [
      { key: 'showDMSession', label: 'AI Dungeon Master' },
      { key: 'showMetaGame', label: 'Campaign Stats' },
      { key: 'showGeneration', label: 'Generate Content' }
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
            if (!hasCharacter && item.key !== 'showNPCGenerator') {
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

export default function NavigationMenu({ activeView, onNavigate, hasCharacter, onHome }) {
  const [openMenu, setOpenMenu] = useState(null)

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
