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

function App() {
  const [characters, setCharacters] = useState([])
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [activeAdventure, setActiveAdventure] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showCreationForm, setShowCreationForm] = useState(false)
  const [showDMSession, setShowDMSession] = useState(false)
  const [showNPCGenerator, setShowNPCGenerator] = useState(false)
  const [showCharacterSheet, setShowCharacterSheet] = useState(false)
  const [showDowntime, setShowDowntime] = useState(false)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [showMetaGame, setShowMetaGame] = useState(false)
  const [showCompanions, setShowCompanions] = useState(false)
  const [editCharacterInWizard, setEditCharacterInWizard] = useState(null)
  const [llmStatus, setLlmStatus] = useState(null)

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
    setShowCharacterSheet(false)
    setShowCreationForm(true)
  }

  const handleShowLevelUp = () => {
    setShowLevelUp(true)
    setShowCharacterSheet(false)
  }

  const handleLevelUpComplete = (updatedCharacter, summary) => {
    setCharacters(characters.map(c => c.id === updatedCharacter.id ? updatedCharacter : c))
    setSelectedCharacter(updatedCharacter)
    setShowLevelUp(false)
    setShowCharacterSheet(true)
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
          }}>
            <span style={{ fontSize: '0.8rem' }}>
              {llmStatus.available
                ? (llmStatus.provider === 'claude' ? '🟣' : '🟢')
                : '🔴'}
            </span>
            <span>
              {llmStatus.available
                ? (llmStatus.provider === 'claude' ? 'Claude AI' : 'Ollama')
                : 'AI Offline'}
            </span>
          </div>
        )}
        <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            display: 'flex',
            gap: '0.5rem'
          }}>
            {(showNPCGenerator || showDMSession || showSettings || showCharacterSheet || showDowntime || showMetaGame || showCompanions) && (
              <button
                onClick={() => { setShowNPCGenerator(false); setShowDMSession(false); setShowSettings(false); setShowCharacterSheet(false); setShowDowntime(false); setShowMetaGame(false); setShowCompanions(false); }}
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
                🏠 Home
              </button>
            )}
            <button
              onClick={() => { setShowNPCGenerator(!showNPCGenerator); setShowDMSession(false); setShowSettings(false); setShowCharacterSheet(false); setShowDowntime(false); setShowMetaGame(false); setShowCompanions(false); }}
              style={{
                background: showNPCGenerator ? 'rgba(230, 126, 34, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                border: showNPCGenerator ? '1px solid #e67e22' : '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {showNPCGenerator ? '← Back' : '👤 NPCs'}
            </button>
            {selectedCharacter && (
              <>
                <button
                  onClick={() => { setShowCharacterSheet(!showCharacterSheet); setShowDMSession(false); setShowSettings(false); setShowNPCGenerator(false); setShowDowntime(false); setShowMetaGame(false); setShowCompanions(false); }}
                  style={{
                    background: showCharacterSheet ? 'rgba(52, 152, 219, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    border: showCharacterSheet ? '1px solid #3498db' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {showCharacterSheet ? '← Back' : '📜 Character'}
                </button>
                <button
                  onClick={() => { setShowCompanions(!showCompanions); setShowCharacterSheet(false); setShowDMSession(false); setShowSettings(false); setShowNPCGenerator(false); setShowDowntime(false); setShowMetaGame(false); }}
                  style={{
                    background: showCompanions ? 'rgba(155, 89, 182, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    border: showCompanions ? '1px solid #9b59b6' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {showCompanions ? '← Back' : '👥 Companions'}
                </button>
                <button
                  onClick={() => { setShowDowntime(!showDowntime); setShowDMSession(false); setShowSettings(false); setShowNPCGenerator(false); setShowCharacterSheet(false); setShowMetaGame(false); setShowCompanions(false); }}
                  style={{
                    background: showDowntime ? 'rgba(155, 89, 182, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    border: showDowntime ? '1px solid #9b59b6' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {showDowntime ? '← Back' : '🛏️ Downtime'}
                </button>
                <button
                  onClick={() => { setShowDMSession(!showDMSession); setShowSettings(false); setShowNPCGenerator(false); setShowCharacterSheet(false); setShowDowntime(false); setShowMetaGame(false); setShowCompanions(false); }}
                  style={{
                    background: showDMSession ? 'rgba(243, 156, 18, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    border: showDMSession ? '1px solid #f39c12' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {showDMSession ? '← Back' : '🎲 AI DM'}
                </button>
                <button
                  onClick={() => { setShowSettings(!showSettings); setShowDMSession(false); setShowNPCGenerator(false); setShowCharacterSheet(false); setShowDowntime(false); setShowMetaGame(false); setShowCompanions(false); }}
                  style={{
                    background: showSettings ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {showSettings ? '← Back' : '⚙️ Settings'}
                </button>
                <button
                  onClick={() => { setShowMetaGame(!showMetaGame); setShowDMSession(false); setShowSettings(false); setShowNPCGenerator(false); setShowCharacterSheet(false); setShowDowntime(false); setShowCompanions(false); }}
                  style={{
                    background: showMetaGame ? 'rgba(46, 204, 113, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    border: showMetaGame ? '1px solid #2ecc71' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {showMetaGame ? '← Back' : '📊 Campaign'}
                </button>
              </>
            )}
          </div>
      </header>

      {showNPCGenerator ? (
        <NPCGenerator
          onBack={() => setShowNPCGenerator(false)}
          character={selectedCharacter}
        />
      ) : showLevelUp && selectedCharacter ? (
        <LevelUpPage
          character={selectedCharacter}
          onLevelUp={handleLevelUpComplete}
          onBack={() => {
            setShowLevelUp(false)
            setShowCharacterSheet(true)
          }}
        />
      ) : showCharacterSheet && selectedCharacter ? (
        <CharacterSheet
          character={selectedCharacter}
          onBack={() => setShowCharacterSheet(false)}
          onCharacterUpdated={handleCharacterUpdated}
          onEditInWizard={handleEditInWizard}
          onLevelUp={handleShowLevelUp}
        />
      ) : showDMSession && selectedCharacter ? (
        <DMSession
          character={selectedCharacter}
          allCharacters={characters}
          onBack={() => setShowDMSession(false)}
          onCharacterUpdated={handleCharacterUpdated}
        />
      ) : showDowntime && selectedCharacter ? (
        <Downtime
          character={selectedCharacter}
          onCharacterUpdated={handleCharacterUpdated}
        />
      ) : showMetaGame && selectedCharacter ? (
        <MetaGameDashboard
          character={selectedCharacter}
          onCharacterUpdated={() => loadCharacters()}
        />
      ) : showCompanions && selectedCharacter ? (
        <CompanionsPage
          character={selectedCharacter}
          onCharacterUpdated={handleCharacterUpdated}
        />
      ) : showSettings && selectedCharacter ? (
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
