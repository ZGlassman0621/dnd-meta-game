import { useState, useEffect, lazy, Suspense, Component } from 'react'
import CharacterManager from './components/CharacterManager'
import AdventureManager from './components/AdventureManager'
import ActiveAdventure from './components/ActiveAdventure'
import AdventureHistory from './components/AdventureHistory'
import CharacterSettings from './components/CharacterSettings'
import CharacterSheet from './components/CharacterSheet'
import Downtime from './components/Downtime'
import LevelUpPage from './components/LevelUpPage'
import MetaGameDashboard from './components/MetaGameDashboard'
import CompanionsPage from './components/CompanionsPage'
import CampaignsPage from './components/CampaignsPage'
import BackstoryParserPage from './components/BackstoryParserPage'
import NavigationMenu from './components/NavigationMenu'

// Lazy-loaded pages (loaded on demand to reduce initial bundle)
const DMSession = lazy(() => import('./components/DMSession'))
const CampaignPlanPage = lazy(() => import('./components/CampaignPlanPage'))
const NPCGenerator = lazy(() => import('./components/NPCGenerator'))
const FactionsPage = lazy(() => import('./components/FactionsPage'))
const WorldEventsPage = lazy(() => import('./components/WorldEventsPage'))
const TravelPage = lazy(() => import('./components/TravelPage'))
const NPCRelationshipsPage = lazy(() => import('./components/NPCRelationshipsPage'))
const LivingWorldPage = lazy(() => import('./components/LivingWorldPage'))
const QuestsPage = lazy(() => import('./components/QuestsPage'))
const LocationsPage = lazy(() => import('./components/LocationsPage'))
const CompanionBackstoryPage = lazy(() => import('./components/CompanionBackstoryPage'))
const NarrativeQueuePage = lazy(() => import('./components/NarrativeQueuePage'))
const GenerationControlsPage = lazy(() => import('./components/GenerationControlsPage'))

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
  const [characters, setCharacters] = useState([])
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [activeAdventure, setActiveAdventure] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState(null) // Single state for current view
  const [showCreationForm, setShowCreationForm] = useState(false)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [editCharacterInWizard, setEditCharacterInWizard] = useState(null)
  const [llmStatus, setLlmStatus] = useState(null)
  const [campaignPlanReady, setCampaignPlanReady] = useState(false)
  const [hasStartedAdventure, setHasStartedAdventure] = useState(false)

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
    loadCharacters()
    checkLLMStatus()
  }, [])

  const checkLLMStatus = async () => {
    try {
      const response = await fetch('/api/dm-session/llm-status')
      const data = await response.json()
      setLlmStatus(data)
    } catch (err) {
      setLlmStatus({ available: false, error: err.message })
    }
  }

  useEffect(() => {
    if (selectedCharacter) {
      checkActiveAdventure()
      const interval = setInterval(checkActiveAdventure, 30000) // Check every 30 seconds
      return () => clearInterval(interval)
    }
  }, [selectedCharacter])

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
      if (data.length > 0 && !selectedCharacter) {
        setSelectedCharacter(data[0])
      } else if (selectedCharacter) {
        // Refresh selectedCharacter with latest data (e.g. after campaign assignment)
        const updated = data.find(c => c.id === selectedCharacter.id)
        if (updated) setSelectedCharacter(updated)
      }
    } catch (error) {
      console.error('Error loading characters:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkActiveAdventure = async () => {
    if (!selectedCharacter) return

    try {
      const response = await fetch(`/api/adventure/status/${selectedCharacter.id}`)
      const data = await response.json()

      if (data.status === 'active' || data.status === 'completed') {
        setActiveAdventure(data)
      } else {
        setActiveAdventure(null)
      }
    } catch (error) {
      console.error('Error checking adventure status:', error)
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

  const handleAdventureStarted = () => {
    checkActiveAdventure()
  }

  const handleAdventureClaimed = () => {
    setActiveAdventure(null)
    loadCharacters()
  }

  const handleSettingsChanged = () => {
    loadCharacters()
    checkActiveAdventure()
  }

  const handleEditInWizard = (character) => {
    setEditCharacterInWizard(character)
    setActiveView(null)
    setShowCreationForm(true)
  }

  const handleShowLevelUp = () => {
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

  return (
    <div className="app">
      <header style={{ paddingTop: '3rem' }}>
        <h1>D&D Meta Game</h1>
        <p className="subtitle">Adventure awaits while you're away</p>
        {llmStatus && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            background: llmStatus.available
              ? (llmStatus.provider === 'claude' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(46, 204, 113, 0.2)')
              : 'rgba(231, 76, 60, 0.2)',
            border: `1px solid ${llmStatus.available
              ? (llmStatus.provider === 'claude' ? '#8b5cf6' : '#2ecc71')
              : '#e74c3c'}`,
            color: llmStatus.available
              ? (llmStatus.provider === 'claude' ? '#a78bfa' : '#2ecc71')
              : '#e74c3c',
            marginTop: '0.5rem'
          }}
          title={llmStatus.provider === 'claude' && llmStatus.models
            ? `Opus 4.5 for new campaigns, Sonnet 4 for gameplay`
            : undefined}
          >
            <span style={{ fontSize: '0.8rem' }}>
              {llmStatus.available
                ? (llmStatus.provider === 'claude' ? '🟣' : '🟢')
                : '🔴'}
            </span>
            <span>
              {llmStatus.available
                ? (llmStatus.provider === 'claude'
                  ? (llmStatus.models ? 'Opus + Sonnet' : 'Claude AI')
                  : 'Ollama')
                : 'AI Offline'}
            </span>
          </div>
        )}
        <NavigationMenu
          activeView={activeView}
          onNavigate={navigateTo}
          hasCharacter={!!selectedCharacter}
          onHome={goHome}
        />
      </header>

      <ErrorBoundary>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>Loading...</div>}>
      {activeView === 'showNPCGenerator' ? (
        <NPCGenerator
          onBack={goHome}
          character={selectedCharacter}
        />
      ) : showLevelUp && selectedCharacter ? (
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
      ) : activeView === 'showDowntime' && selectedCharacter ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <Downtime
                character={selectedCharacter}
                onCharacterUpdated={handleCharacterUpdated}
              />
            </div>
            <div>
              {activeAdventure && activeAdventure.status !== 'none' ? (
                <ActiveAdventure
                  adventure={activeAdventure}
                  character={selectedCharacter}
                  onAdventureClaimed={handleAdventureClaimed}
                  onAdventureComplete={checkActiveAdventure}
                />
              ) : (
                <AdventureManager
                  character={selectedCharacter}
                  onAdventureStarted={handleAdventureStarted}
                />
              )}
            </div>
          </div>
          <MetaGameDashboard
            character={selectedCharacter}
            onCharacterUpdated={() => loadCharacters()}
          />
          <div style={{ marginTop: '1.5rem' }}>
            <AdventureHistory character={selectedCharacter} />
          </div>
        </div>
      ) : activeView === 'showMetaGame' && selectedCharacter ? (
        <MetaGameDashboard
          character={selectedCharacter}
          onCharacterUpdated={() => loadCharacters()}
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
      ) : activeView === 'showFactions' && selectedCharacter ? (
        <FactionsPage
          character={selectedCharacter}
          onCharacterUpdated={() => loadCharacters()}
        />
      ) : activeView === 'showWorldEvents' && selectedCharacter ? (
        <WorldEventsPage
          character={selectedCharacter}
          onCharacterUpdated={() => loadCharacters()}
        />
      ) : activeView === 'showTravel' && selectedCharacter ? (
        <TravelPage
          campaignId={selectedCharacter.campaign_id}
          characters={characters}
          locations={[]}
        />
      ) : activeView === 'showNPCRelationships' && selectedCharacter ? (
        <NPCRelationshipsPage
          character={selectedCharacter}
        />
      ) : activeView === 'showLivingWorld' && selectedCharacter ? (
        <LivingWorldPage
          character={selectedCharacter}
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
      ) : activeView === 'showQuests' && selectedCharacter ? (
        <QuestsPage
          character={selectedCharacter}
        />
      ) : activeView === 'showLocations' && selectedCharacter ? (
        <LocationsPage
          character={selectedCharacter}
        />
      ) : activeView === 'showBackstories' && selectedCharacter ? (
        <CompanionBackstoryPage
          characterId={selectedCharacter.id}
        />
      ) : activeView === 'showNarrativeQueue' && selectedCharacter ? (
        <NarrativeQueuePage
          character={selectedCharacter}
        />
      ) : activeView === 'showGeneration' && selectedCharacter ? (
        <GenerationControlsPage
          character={selectedCharacter}
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

          <CharacterManager
            characters={characters}
            selectedCharacter={selectedCharacter}
            onSelectCharacter={setSelectedCharacter}
            onCharacterCreated={handleCharacterCreated}
            onCharacterUpdated={handleCharacterUpdated}
            onCreationFormChange={setShowCreationForm}
            editCharacterInWizard={editCharacterInWizard}
            onClearEditCharacter={() => setEditCharacterInWizard(null)}
          />

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
                { key: 'showDowntime', label: 'Downtime & Stats', desc: 'Rest, train, generate adventures, and track progress', color: '#f39c12' },
                { key: 'showSettings', label: 'Settings', desc: 'Configure character preferences and options', color: '#95a5a6' },
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
    </div>
  )
}

export default App
