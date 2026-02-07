import { useState, useEffect } from 'react'
import CharacterManager from './components/CharacterManager'
import AdventureManager from './components/AdventureManager'
import ActiveAdventure from './components/ActiveAdventure'
import AdventureHistory from './components/AdventureHistory'
import CharacterSettings from './components/CharacterSettings'
import CharacterSheet from './components/CharacterSheet'
import DMSession from './components/DMSession'
import NPCGenerator from './components/NPCGenerator'
import Downtime from './components/Downtime'
import LevelUpPage from './components/LevelUpPage'
import MetaGameDashboard from './components/MetaGameDashboard'
import CompanionsPage from './components/CompanionsPage'
import FactionsPage from './components/FactionsPage'
import WorldEventsPage from './components/WorldEventsPage'
import TravelPage from './components/TravelPage'
import NPCRelationshipsPage from './components/NPCRelationshipsPage'
import LivingWorldPage from './components/LivingWorldPage'
import CampaignsPage from './components/CampaignsPage'
import CampaignPlanPage from './components/CampaignPlanPage'
import QuestsPage from './components/QuestsPage'
import LocationsPage from './components/LocationsPage'
import CompanionBackstoryPage from './components/CompanionBackstoryPage'
import BackstoryParserPage from './components/BackstoryParserPage'
import NarrativeQueuePage from './components/NarrativeQueuePage'
import GenerationControlsPage from './components/GenerationControlsPage'
import NavigationMenu from './components/NavigationMenu'

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

  // Navigation helper
  const navigateTo = (view) => {
    setActiveView(view)
    setShowLevelUp(false)
  }

  const goHome = () => {
    setActiveView(null)
    setShowLevelUp(false)
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

  // Check if selected character has a campaign plan ready
  useEffect(() => {
    if (selectedCharacter?.campaign_id) {
      fetch(`/api/campaign/${selectedCharacter.campaign_id}/plan`)
        .then(res => res.json())
        .then(data => setCampaignPlanReady(!!(data?.main_quest)))
        .catch(() => setCampaignPlanReady(false))
    } else {
      setCampaignPlanReady(false)
    }
  }, [selectedCharacter])

  const loadCharacters = async () => {
    try {
      const response = await fetch('/api/character')
      const data = await response.json()
      setCharacters(data)
      if (data.length > 0 && !selectedCharacter) {
        setSelectedCharacter(data[0])
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
        <Downtime
          character={selectedCharacter}
          onCharacterUpdated={handleCharacterUpdated}
        />
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
          <div className={showCreationForm ? '' : 'grid-2'}>
        <div>
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
        </div>

        {!showCreationForm && (
          <div>
            {selectedCharacter && (
              <>
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
              </>
            )}
          </div>
        )}
      </div>

          {selectedCharacter && !showCreationForm && campaignPlanReady && (
            <div
              onClick={() => navigateTo('showDMSession')}
              style={{
                marginTop: '2rem',
                padding: '1.5rem 2rem',
                background: 'linear-gradient(135deg, rgba(155, 89, 182, 0.3), rgba(142, 68, 173, 0.2))',
                border: '1px solid rgba(155, 89, 182, 0.4)',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(155, 89, 182, 0.5), rgba(142, 68, 173, 0.35))'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(155, 89, 182, 0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(155, 89, 182, 0.3), rgba(142, 68, 173, 0.2))'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#f5f5f5', marginBottom: '0.25rem' }}>
                Play
              </div>
              <div style={{ fontSize: '0.85rem', color: '#a78bfa' }}>
                Continue your adventure with {selectedCharacter.name}
              </div>
            </div>
          )}

          {selectedCharacter && !showCreationForm && (
            <div style={{ marginTop: '2rem' }}>
              <AdventureHistory character={selectedCharacter} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default App
