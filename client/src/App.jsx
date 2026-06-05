import { useState, useEffect, lazy, Suspense, Component } from 'react'
import CharacterManager from './components/CharacterManager'
import CharacterSettings from './components/CharacterSettings'
import CharacterSheet from './components/CharacterSheet'
import LevelUpPage from './components/LevelUpPage'
import CompanionsPage from './components/CompanionsPage'
import CampaignsPage from './components/CampaignsPage'
import BackstoryParserPage from './components/BackstoryParserPage'
import NavigationMenu from './components/NavigationMenu'

// Lazy-loaded pages (loaded on demand to reduce initial bundle)
const DMSession = lazy(() => import('./components/DMSession'))
const CampaignPlanPage = lazy(() => import('./components/CampaignPlanPage'))
const CompanionBackstoryPage = lazy(() => import('./components/CompanionBackstoryPage'))
// Phase 4a SC-4a.4 — diagnostic surface for AI behavior. Lazy-loaded;
// only opens when user navigates to it via the dashboard.
const AIBehaviorDebugPage = lazy(() => import('./components/AIBehaviorDebugPage'))

// Phase 2 chunk 5 batch 3 sub-checkpoint 2 (5.L.6) — the rebuilt
// creator + new home flow becomes the live path. Direct import (not
// lazy) — the editorial styles/fonts are bundled globally and the
// home flow is the user's first surface after login.
import HomeFlow from './components/creator/HomeFlow.jsx'

// Phase 3.5 — Settings overlay (per `settings/SETTINGS_DESIGN_BRIEF.md`).
// Direct import; the overlay is small, mounted-on-demand, and reachable
// from both the editorial home appbar (HomeFlow) and the dashboard
// header below.
import SettingsOverlay from './components/settings/SettingsOverlay.jsx'


// Global fetch interceptor — adds auth token to all /api requests automatically.
// This avoids touching every fetch call across all components.
const _originalFetch = window.fetch;
window.fetch = (url, opts = {}) => {
  if (typeof url === 'string' && url.startsWith('/api') && !url.startsWith('/api/auth/login') && !url.startsWith('/api/auth/register')) {
    const token = localStorage.getItem('auth_token');
    if (token) {
      opts.headers = { ...opts.headers, 'Authorization': `Bearer ${token}` };
    }
  }
  return _originalFetch(url, opts);
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: '#e74c3c', textAlign: 'center' }}>
          <h3>Something went wrong loading this page</h3>
          <p style={{ color: '#999', fontSize: '0.9rem' }}>{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  // Auth/login was removed for the single-player MVP — a no-op server
  // middleware resolves one local user. Keep a truthy placeholder user so
  // downstream props (NavigationMenu) still receive a valid object.
  const [user] = useState({ username: 'local' })
  const [characters, setCharacters] = useState([])
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState(null) // Single state for current view
  // Phase 3.5 — Settings overlay open state (dashboard branch). HomeFlow
  // owns its own copy. The overlay always scopes to `selectedCharacter`
  // here since the dashboard branch is only reached when one is selected.
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Phase 4a SC-4a.4 — shared style for the appbar text-link buttons
  // (Settings, AI Behavior). Mirrors HomeFlow's `.nav-settings` class
  // semantically; the dashboard chrome uses dark-aesthetic inline styles.
  const appbarLinkStyle = {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#ccc',
    padding: '0.4rem 0.85rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontFamily: 'Inter, system-ui, sans-serif',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  }
  const appbarLinkGlyph = {
    fontFamily: "'EB Garamond', Georgia, serif",
    fontStyle: 'italic',
    fontSize: '15px',
    letterSpacing: 0,
    color: '#d4a86a'
  }
  const [showCreationForm, setShowCreationForm] = useState(false)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [editCharacterInWizard, setEditCharacterInWizard] = useState(null)
  const [llmStatus, setLlmStatus] = useState(null)
  const [campaignPlanReady, setCampaignPlanReady] = useState(false)
  const [hasStartedAdventure, setHasStartedAdventure] = useState(false)
  // NOTE: hasStartedAdventure is kept — it drives the "Play" card copy
  // (Continue vs Start). It is derived from DM-session history, not the
  // removed odds-based adventure system.

  // Sonnet vs Opus selector. Opus is the production default (v1.0.99 — see
  // DECISION_LOG "Opus as production default for main DM session continuations").
  // The toggle is now an opt-down to Sonnet, not an opt-up to Opus. Persisted
  // in localStorage as `dndUseSonnet` ('1' = use Sonnet override, '0' or absent
  // = use Opus default). Shared with DMSession's in-session pill via the same key.
  const [useSonnet, setUseSonnet] = useState(() => {
    try { return localStorage.getItem('dndUseSonnet') === '1' } catch { return false }
  })
  const updateUseSonnet = (next) => {
    setUseSonnet(next)
    try { localStorage.setItem('dndUseSonnet', next ? '1' : '0') } catch {}
  }

  // (Lean Prompt UI toggle was removed in v1.0.100 per the "Retire Lean
  // Prompt toggle as production direction" decision in DECISION_LOG. The
  // underlying applyLeanTransforms() post-processor remains wired in
  // dmPromptBuilder.js and the leanPrompt body param still works on the
  // server — DMSession reads `dndLeanPrompt` from localStorage at API-call
  // time, so a developer can still trigger lean by setting that key in the
  // browser console for prompt-design experiments. The toggle is just no
  // longer surfaced to users.)

  // Navigation helper
  const navigateTo = (view) => {
    setActiveView(view)
    setShowLevelUp(false)
    window.scrollTo(0, 0)
  }

  const goHome = () => {
    setActiveView(null)
    setShowLevelUp(false)
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    if (user) {
      loadCharacters()
      checkLLMStatus()
    }
  }, [user])

  const checkLLMStatus = async () => {
    try {
      const response = await fetch('/api/dm-session/llm-status')
      const data = await response.json()
      setLlmStatus(data)
    } catch (err) {
      setLlmStatus({ available: false, error: err.message })
    }
  }

  // Check if selected character has a campaign plan ready + has past sessions
  useEffect(() => {
    if (selectedCharacter?.campaign_id) {
      fetch(`/api/campaign/${selectedCharacter.campaign_id}/plan`)
        .then(res => res.json())
        .then(data => setCampaignPlanReady(!!(data?.main_quest)))
        .catch(() => setCampaignPlanReady(false))
      fetch(`/api/dm-session/history/${selectedCharacter.id}`)
        .then(res => res.json())
        .then(data => setHasStartedAdventure((data?.sessions?.length || 0) > 0))
        .catch(() => setHasStartedAdventure(false))
    } else {
      setCampaignPlanReady(false)
      setHasStartedAdventure(false)
    }
  }, [selectedCharacter])

  const loadCharacters = async () => {
    try {
      const response = await fetch('/api/character')
      const data = await response.json()
      setCharacters(data)
      // Phase 2 chunk 5 batch 3 sub-checkpoint 2 — do NOT auto-select
      // the first character. The new HomeFlow ("Your Characters") is
      // the landing surface; the player picks from the roster
      // deliberately. Only refresh in-place if a character is already
      // selected (e.g., after campaign assignment).
      if (selectedCharacter) {
        const updated = data.find(c => c.id === selectedCharacter.id)
        if (updated) setSelectedCharacter(updated)
      }
    } catch (error) {
      console.error('Error loading characters:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCharacterCreated = (character) => {
    setCharacters([character, ...characters])
    setSelectedCharacter(character)
  }

  const handleCharacterUpdated = (character) => {
    setCharacters(characters.map(c => c.id === character.id ? character : c))
    setSelectedCharacter(character)
  }

  const handleSettingsChanged = () => {
    loadCharacters()
  }

  const handleEditInWizard = (character) => {
    setEditCharacterInWizard(character)
    setActiveView(null)
    setShowCreationForm(true)
  }

  const handleShowLevelUp = (character) => {
    // Accept an optional character — if the caller is the character list, it
    // passes the character explicitly. If called from the sheet, selectedCharacter
    // is already the right one.
    if (character && character.id !== selectedCharacter?.id) {
      setSelectedCharacter(character)
    }
    setShowLevelUp(true)
    setActiveView(null)
  }

  const handleLevelUpComplete = (updatedCharacter, summary) => {
    setCharacters(characters.map(c => c.id === updatedCharacter.id ? updatedCharacter : c))
    setSelectedCharacter(updatedCharacter)
    setShowLevelUp(false)
    setActiveView('showCharacterSheet')
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  // Phase 2 chunk 5 batch 3 sub-checkpoint 2 (5.L.6) — when no
  // character is selected, render the new HomeFlow (editorial "Your
  // Characters" roster) as the live entry point. Replaces the old
  // CharacterManager landing. When the player picks a character,
  // selectedCharacter is set and the existing dashboard chrome takes
  // over below. The "← Your characters" button in the dashboard
  // header navigates back to HomeFlow by clearing selectedCharacter.
  if (!selectedCharacter && !showCreationForm) {
    return (
      <HomeFlow
        onSelectActive={(char) => setSelectedCharacter(char)}
        onCharacterCreated={(char) => {
          // Refresh the characters list and select the new character so
          // App's existing dashboard takes over. handleCharacterCreated
          // does both.
          handleCharacterCreated(char)
        }}
      />
    )
  }

  return (
    <div className="app">
      <header style={{ paddingTop: '3rem' }}>
        {/* Back-to-roster affordance per Phase 2 chunk 5 batch 3
           sub-checkpoint 2 — clears selectedCharacter so HomeFlow
           takes over again. Always available when a character is
           selected (which is always true in this branch since the
           !selectedCharacter case is handled by the early return). */}
        {selectedCharacter && (
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setSelectedCharacter(null)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#ccc',
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              ← Your characters
            </button>
            {/* Phase 3.5 — Settings access in the dashboard appbar. Mirrors
               the HomeFlow appbar's editorial-aesthetic Settings link
               using the dark dashboard's button register.
               Phase 4a SC-4a.4 — AI Behavior link added beside it; same
               appbar treatment, different surface. */}
            <span style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => setActiveView('showAIBehavior')}
              aria-label="AI Behavior debug"
              title="Phase 4a diagnostic surface — captured prompts, signals, prompt-shape accounting"
              style={appbarLinkStyle}
            >
              <span style={{ ...appbarLinkGlyph, color: '#7aafff' }}>◇</span>
              AI Behavior
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              title="Settings"
              style={appbarLinkStyle}
            >
              <span style={appbarLinkGlyph}>✦</span>
              Settings
            </button>
          </div>
        )}
        <h1>D&D Meta Game</h1>
        <p className="subtitle">Adventure awaits while you're away</p>
        {llmStatus && (() => {
          // When Claude is available, the pill becomes a clickable Sonnet/Opus
          // toggle. Opus is the production default (v1.0.99); the toggle now
          // selects Sonnet as an opt-down. Any non-Claude case stays a plain
          // status indicator.
          const isClickable = llmStatus.available && llmStatus.provider === 'claude'
          const accent = !llmStatus.available
            ? { bg: 'rgba(231, 76, 60, 0.2)', border: '#e74c3c', text: '#e74c3c', dot: '🔴', label: 'AI Offline' }
            : isClickable && useSonnet
              ? { bg: 'rgba(139, 92, 246, 0.2)', border: '#8b5cf6', text: '#a78bfa', dot: '🟣', label: 'Sonnet' }
              : isClickable
                ? { bg: 'rgba(255, 140, 0, 0.2)', border: '#ff8c00', text: '#ff8c00', dot: '🟠', label: 'Opus' }
                : { bg: 'rgba(46, 204, 113, 0.2)', border: '#2ecc71', text: '#2ecc71', dot: '🟢', label: 'Ollama' }
          const baseStyle = {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            background: accent.bg,
            border: `1px solid ${accent.border}`,
            color: accent.text,
            marginTop: '0.5rem',
            cursor: isClickable ? 'pointer' : 'default'
          }
          const tooltip = isClickable
            ? (useSonnet
              ? 'Using Sonnet (cheaper, thinner prose). Click to switch back to Opus (the production default).'
              : 'Using Opus (production default — better prose at ~$1.50/hour). Click to opt down to Sonnet.')
            : undefined
          const inner = (
            <>
              <span style={{ fontSize: '0.8rem' }}>{accent.dot}</span>
              <span>{accent.label}</span>
            </>
          )
          return isClickable ? (
            <button
              type="button"
              onClick={() => updateUseSonnet(!useSonnet)}
              title={tooltip}
              style={{ ...baseStyle, font: 'inherit', fontSize: '0.75rem' }}
            >
              {inner}
            </button>
          ) : (
            <div style={baseStyle} title={tooltip}>{inner}</div>
          )
        })()}

        <NavigationMenu
          activeView={activeView}
          onNavigate={navigateTo}
          hasCharacter={!!selectedCharacter}
          onHome={goHome}
          user={user}
        />
      </header>

      <ErrorBoundary>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>Loading...</div>}>
      {showLevelUp && selectedCharacter ? (
        <LevelUpPage
          character={selectedCharacter}
          onLevelUp={handleLevelUpComplete}
          onBack={() => {
            setShowLevelUp(false)
            setActiveView('showCharacterSheet')
          }}
        />
      ) : activeView === 'showCharacterSheet' && selectedCharacter ? (
        <CharacterSheet
          character={selectedCharacter}
          onBack={goHome}
          onCharacterUpdated={handleCharacterUpdated}
          onEditInWizard={handleEditInWizard}
          onLevelUp={handleShowLevelUp}
        />
      ) : activeView === 'showDMSession' && selectedCharacter ? (
        <DMSession
          character={selectedCharacter}
          allCharacters={characters}
          onBack={goHome}
          onCharacterUpdated={handleCharacterUpdated}
        />
      ) : activeView === 'showAIBehavior' ? (
        <AIBehaviorDebugPage
          onBack={goHome}
          defaultCharacterId={selectedCharacter?.id || null}
        />
      ) : activeView === 'showCompanions' && selectedCharacter ? (
        <CompanionsPage
          character={selectedCharacter}
          onCharacterUpdated={handleCharacterUpdated}
        />
      ) : activeView === 'showParsedBackstory' && selectedCharacter ? (
        <BackstoryParserPage
          character={selectedCharacter}
          onCharacterUpdated={handleCharacterUpdated}
        />
      ) : activeView === 'showCampaigns' && selectedCharacter ? (
        <CampaignsPage
          character={selectedCharacter}
          allCharacters={characters}
          onCharacterUpdated={() => loadCharacters()}
          onNavigateToPlay={() => {
            loadCharacters()
            navigateTo('showDMSession')
          }}
        />
      ) : activeView === 'showCampaignPlan' && selectedCharacter ? (
        <CampaignPlanPage
          character={selectedCharacter}
        />
      ) : activeView === 'showBackstories' && selectedCharacter ? (
        <CompanionBackstoryPage
          characterId={selectedCharacter.id}
        />
      ) : activeView === 'showSettings' && selectedCharacter ? (
        <CharacterSettings
          character={selectedCharacter}
          onSettingsChanged={handleSettingsChanged}
        />
      ) : (
        <>
          {selectedCharacter && !showCreationForm && campaignPlanReady && (
            <div
              onClick={() => navigateTo('showDMSession')}
              style={{
                marginBottom: '1.5rem',
                padding: '1.25rem 2rem',
                background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.3), rgba(39, 174, 96, 0.2))',
                border: '1px solid rgba(46, 204, 113, 0.4)',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(46, 204, 113, 0.5), rgba(39, 174, 96, 0.35))'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(46, 204, 113, 0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(46, 204, 113, 0.3), rgba(39, 174, 96, 0.2))'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#f5f5f5', marginBottom: '0.25rem' }}>
                Play
              </div>
              <div style={{ fontSize: '0.85rem', color: '#6ee7b7' }}>
                {hasStartedAdventure
                  ? `Continue your adventure with ${selectedCharacter.name}`
                  : `Start your adventure with ${selectedCharacter.name}!`}
              </div>
            </div>
          )}

          {/*
            Phase 2 chunk 5 batch 3 sub-checkpoint 2 — CharacterManager
            is now hidden by default (HomeFlow handles the roster + new
            character creation). Kept here only for the edit-existing-
            character path: CharacterSheet's "Edit in Wizard" button
            sets showCreationForm=true + editCharacterInWizard, which
            triggers CharacterManager to render the legacy
            CharacterCreationWizard in edit mode. The new
            CharacterCreatorV2 doesn't yet support an
            "edit existing" surface; that's a follow-up. Until then the
            old wizard remains accessible for editing only.
          */}
          {showCreationForm && (
            <CharacterManager
              characters={characters}
              selectedCharacter={selectedCharacter}
              onSelectCharacter={setSelectedCharacter}
              onCharacterCreated={handleCharacterCreated}
              onCharacterUpdated={handleCharacterUpdated}
              onCreationFormChange={setShowCreationForm}
              editCharacterInWizard={editCharacterInWizard}
              onClearEditCharacter={() => setEditCharacterInWizard(null)}
              onShowLevelUp={handleShowLevelUp}
            />
          )}

          {selectedCharacter && !showCreationForm && (
            <div style={{
              marginTop: '2rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '1rem'
            }}>
              {[
                { key: 'showCharacterSheet', label: 'Character Sheet', desc: 'View stats, equipment, abilities, and level up', color: '#3498db' },
                { key: 'showCompanions', label: 'Companions', desc: 'Manage your companion characters and their stories', color: '#1abc9c' },
                { key: 'showParsedBackstory', label: 'Backstory Parser', desc: 'AI-parse your backstory into structured elements', color: '#e67e22' },
                { key: 'showCampaigns', label: 'Campaigns', desc: 'Create campaigns with auto-generated world plans', color: '#9b59b6' },
                { key: 'showCampaignPlan', label: 'Campaign Plan', desc: 'View your campaign world, NPCs, factions, and quests', color: '#e91e63' },
                { key: 'showDMSession', label: 'AI Dungeon Master', desc: 'Play through your campaign with an AI DM', color: '#2ecc71' },
                { key: 'showSettings', label: 'Settings', desc: 'Configure character preferences and options', color: '#95a5a6' },
                // Phase 4a SC-4a.4 — AI Behavior debug page is reached via
                // the appbar link (right side, beside Settings). Removed
                // from the dashboard nav grid per PM 2026-05-06 review:
                // "appbar near Settings, distinct from but parallel to
                // Settings access pattern" — single canonical entry point.
              ].map(card => (
                <div
                  key={card.key}
                  onClick={() => navigateTo(card.key)}
                  style={{
                    padding: '1.25rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${card.color}44`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    borderLeft: `3px solid ${card.color}`
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `${card.color}1a`
                    e.currentTarget.style.borderColor = `${card.color}88`
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = `0 4px 12px ${card.color}22`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    e.currentTarget.style.borderColor = `${card.color}44`
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: card.color, marginBottom: '0.4rem' }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#999', lineHeight: '1.3' }}>
                    {card.desc}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </Suspense>
      </ErrorBoundary>
      {/* Phase 3.5 — Settings overlay sits above the dashboard chrome. The
         underlying view (DMSession, character sheet, etc.) is not unmounted
         while open — closing returns the player to the same DM turn they
         paused on per the design brief's mid-session safety contract. */}
      {settingsOpen && selectedCharacter && (
        <SettingsOverlay
          character={selectedCharacter}
          context={activeView === 'showDMSession' ? 'session' : 'home'}
          onClose={() => setSettingsOpen(false)}
          onSaved={(updated) => {
            // Patch the locally-tracked character so subsequent reads
            // (status displays, future per-character settings) reflect
            // the saved value without a refetch round-trip.
            if (updated?.id) {
              setSelectedCharacter(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev)
              setCharacters(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
            }
          }}
        />
      )}
    </div>
  )
}

export default App
