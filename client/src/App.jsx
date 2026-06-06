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

// Phase — Hearth dashboard conversion. The per-character landing (hero +
// navigation grid) and the persistent header are restyled to the
// dark-editorial Hearth system. Class hit-die data backs HP fallbacks.
import classesData from './data/classes.json'
import './styles/hearth.css'
import './styles/hearth-dashboard.css'

/* ── local Hearth icon sprite (paths copied from Dashboard.html defs) ── */
function DashboardSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <symbol id="i-arrow-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></symbol>
      <symbol id="i-arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
      <symbol id="i-play" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 4.5v15a1 1 0 0 0 1.54.84l11.5-7.5a1 1 0 0 0 0-1.68L7.54 3.66A1 1 0 0 0 6 4.5z" /></symbol>
      <symbol id="i-settings" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></symbol>
      <symbol id="i-scroll" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" /><path d="M19 17V5a2 2 0 0 0-2-2H4" /></symbol>
      <symbol id="i-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></symbol>
      <symbol id="i-compass" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></symbol>
      <symbol id="i-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" /></symbol>
      <symbol id="i-feather" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" /></symbol>
      <symbol id="i-sliders" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></symbol>
      <symbol id="i-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></symbol>
    </defs></svg>
  )
}
const Ic = ({ n }) => <svg className="ic"><use href={"#i-" + n} /></svg>

// Derive display HP / AC / speed for the hero, mirroring SessionCockpit's
// fallback logic so an unfilled stored value (0/0, AC 10) still shows a
// computed figure rather than a hole. Pure helpers — no fabricated data;
// they only compute from real ability scores + class hit-die.
const parseJson = (v, dflt) => { if (v == null) return dflt; if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return dflt } }
function deriveVitals(character) {
  if (!character) return null
  const level = character.level || 1
  const classKey = character.class?.toLowerCase()
  const classData = classesData[classKey]
  const isMonk = classKey === 'monk'
  const abil = parseJson(character.ability_scores, null) || {
    str: character.strength, dex: character.dexterity, con: character.constitution,
    int: character.intelligence, wis: character.wisdom, cha: character.charisma
  }
  const mod = (k) => Math.floor((((abil?.[k]) ?? 10) - 10) / 2)
  const hitDie = classData?.hitDie || 8
  const conMod = mod('con')
  const computedMaxHp = Math.max(1, hitDie + conMod + Math.max(0, level - 1) * (Math.floor(hitDie / 2) + 1 + conMod))
  const maxHp = character.max_hp > 0 ? character.max_hp : computedMaxHp
  const curHp = character.current_hp > 0 ? character.current_hp : maxHp
  const ac = isMonk ? 10 + mod('dex') + mod('wis')
    : classKey === 'barbarian' ? 10 + mod('dex') + mod('con')
    : (character.armor_class && character.armor_class > 0) ? character.armor_class : 10 + mod('dex')
  return {
    level, classKey, isMonk,
    curHp, maxHp, ac,
    speed: character.speed || 30,
    gold: character.gold_gp,
    hpKind: (maxHp ? curHp / maxHp : 1) > 0.5 ? '' : (maxHp ? curHp / maxHp : 1) > 0.25 ? 'warn' : 'bad'
  }
}
const titleCase = (s) => (s == null || s === '') ? '' : String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())


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

  // (The dashboard appbar links — Settings, AI Behavior — are now styled
  // via the Hearth `.hdr-link` class in the persistent header below, so the
  // former inline appbarLinkStyle/appbarLinkGlyph objects were removed.)
  const [showCreationForm, setShowCreationForm] = useState(false)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [editCharacterInWizard, setEditCharacterInWizard] = useState(null)
  const [llmStatus, setLlmStatus] = useState(null)
  const [campaignPlanReady, setCampaignPlanReady] = useState(false)
  const [hasStartedAdventure, setHasStartedAdventure] = useState(false)
  // Hearth hero — the campaign's display name (the characters table doesn't
  // carry it; we read it from the campaign record). Null when the character
  // has no campaign assigned, in which case the hero omits the campaign line.
  const [campaignName, setCampaignName] = useState(null)
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
      // Campaign display name for the Hearth hero. Best-effort; omitted
      // gracefully if the fetch fails or the record lacks a name.
      fetch(`/api/campaign/${selectedCharacter.campaign_id}`)
        .then(res => res.json())
        .then(data => setCampaignName(data?.name || null))
        .catch(() => setCampaignName(null))
    } else {
      setCampaignPlanReady(false)
      setHasStartedAdventure(false)
      setCampaignName(null)
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

  // Hearth model pill — the persistent header carries a Sonnet/Opus
  // indicator that doubles as a toggle when Claude is the provider.
  // Opus is the production default (v1.0.99); clicking opts down to Sonnet.
  const modelPill = llmStatus && (() => {
    const isClickable = llmStatus.available && llmStatus.provider === 'claude'
    const accent = !llmStatus.available
      ? { dot: 'var(--bad)', text: 'var(--bad)', label: 'AI Offline' }
      : isClickable && useSonnet
        ? { dot: 'var(--accent-2)', text: 'var(--accent-2)', label: 'Sonnet' }
        : isClickable
          ? { dot: 'var(--accent)', text: 'var(--accent)', label: 'Opus' }
          : { dot: 'var(--good)', text: 'var(--good)', label: 'Ollama' }
    const tooltip = isClickable
      ? (useSonnet
        ? 'Using Sonnet (cheaper, thinner prose). Click to switch back to Opus (the production default).'
        : 'Using Opus (production default — better prose at ~$1.50/hour). Click to opt down to Sonnet.')
      : undefined
    return (
      <button
        type="button"
        className="hdr-pill"
        disabled={!isClickable}
        onClick={isClickable ? () => updateUseSonnet(!useSonnet) : undefined}
        title={tooltip}
        style={{ color: accent.text }}
      >
        <span className="pdot" style={{ background: accent.dot, boxShadow: `0 0 7px ${accent.dot}` }} />
        {accent.label}
      </button>
    )
  })()

  return (
    <div className="hearth dashboard app-bg">
      <DashboardSprite />

      {/* ───────── persistent header ───────── */}
      <header className="dash-hdr">
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <div className="vr"></div>
        {/* Back-to-roster affordance — clears selectedCharacter so HomeFlow
           takes over again. Always available in this branch. */}
        <button type="button" className="back as-btn" onClick={() => setSelectedCharacter(null)}>
          <Ic n="arrow-left" />Your characters
        </button>
        <div className="spacer"></div>

        {/* NavigationMenu (Character / Story / Play) flows inline here */}
        <NavigationMenu
          activeView={activeView}
          onNavigate={navigateTo}
          hasCharacter={!!selectedCharacter}
          onHome={goHome}
          user={user}
        />

        <div className="vr"></div>
        {/* Phase 4a SC-4a.4 — AI Behavior diagnostic surface. */}
        <button
          type="button"
          className="hdr-link as-btn"
          onClick={() => setActiveView('showAIBehavior')}
          aria-label="AI Behavior debug"
          title="Phase 4a diagnostic surface — captured prompts, signals, prompt-shape accounting"
        >
          AI Behavior
        </button>
        {/* Phase 3.5 — Settings overlay access. */}
        <button
          type="button"
          className="hdr-link as-btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title="Settings"
        >
          <Ic n="settings" />Settings
        </button>
        <div className="vr"></div>
        {modelPill}
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
          onBack={goHome}
        />
      ) : activeView === 'showParsedBackstory' && selectedCharacter ? (
        <BackstoryParserPage
          character={selectedCharacter}
          onCharacterUpdated={handleCharacterUpdated}
          onBack={goHome}
        />
      ) : activeView === 'showCampaigns' && selectedCharacter ? (
        <CampaignsPage
          character={selectedCharacter}
          allCharacters={characters}
          onCharacterUpdated={() => loadCharacters()}
          onBack={goHome}
          onNavigateToPlay={() => {
            loadCharacters()
            navigateTo('showDMSession')
          }}
        />
      ) : activeView === 'showCampaignPlan' && selectedCharacter ? (
        <CampaignPlanPage
          character={selectedCharacter}
          onBack={goHome}
        />
      ) : activeView === 'showSettings' && selectedCharacter ? (
        <CharacterSettings
          character={selectedCharacter}
          onSettingsChanged={handleSettingsChanged}
          onBack={goHome}
        />
      ) : (
        <>
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

          {/* ───────── Hearth dashboard landing (hero + navigation) ───────── */}
          {selectedCharacter && !showCreationForm && (() => {
            const v = deriveVitals(selectedCharacter)
            const name = selectedCharacter.name || selectedCharacter.nickname || 'Adventurer'
            const monogram = (name || '?').trim().charAt(0).toUpperCase()
            // descriptor line — race · class/subclass · background, omitting blanks
            const klass = selectedCharacter.subclass
              ? `${titleCase(selectedCharacter.class)} · ${titleCase(selectedCharacter.subclass)}`
              : titleCase(selectedCharacter.class)
            const descParts = [
              titleCase(selectedCharacter.subrace || selectedCharacter.race),
              klass,
              titleCase(selectedCharacter.background)
            ].filter(Boolean)

            // Hero navigation cards — the full Manage set. The Campaign Plan
            // card carries the design's spoiler flag. Each maps to an existing
            // activeView target via navigateTo.
            const navCards = [
              { key: 'showCharacterSheet', icon: 'scroll', title: 'Character Sheet', desc: 'Abilities, features, spells, equipment, and progression.' },
              { key: 'showCompanions', icon: 'users', title: 'Companions', desc: 'The allies who travel with you and their stories.' },
              { key: 'showCampaigns', icon: 'compass', title: 'Campaigns', desc: "The adventures you've begun, and the ones waiting." },
              { key: 'showCampaignPlan', icon: 'globe', title: 'Campaign Plan', desc: 'The world bible Opus wrote — locations, NPCs, lore.', spoiler: true },
              { key: 'showParsedBackstory', icon: 'feather', title: 'Backstory', desc: 'Your origin, parsed into people, places, and hooks.' },
              { key: 'showSettings', icon: 'sliders', title: 'Settings', desc: 'Difficulty, tone, and how the Dungeon Master behaves.' }
            ]

            return (
              <main className="home">
                <div className="home-eyebrow">
                  <span className="eyebrow">Character home</span>
                  <span className="ln"></span>
                </div>

                {/* HERO · continue / start */}
                <section className="hero">
                  <div className="hero-top">
                    <div className="crest">
                      <span className="mono">{monogram}</span>
                      {v?.level ? <span className="lvl">{v.level}</span> : null}
                    </div>
                    <div className="hero-id">
                      <h1>{name}</h1>
                      {descParts.length > 0 && (
                        <div className="desc">
                          {descParts.map((p, i) => (
                            <span key={i}>{i > 0 && <span className="sep">·</span>}{p}</span>
                          ))}
                        </div>
                      )}
                      {campaignName && (
                        <div className="campaign">
                          <span className="ct">Campaign</span>
                          <span className="cn">{campaignName}</span>
                        </div>
                      )}
                    </div>
                    <div className="hero-cta">
                      {campaignPlanReady ? (
                        <button className="btn primary lg" onClick={() => navigateTo('showDMSession')}>
                          <Ic n="play" />{hasStartedAdventure ? 'Continue' : 'Begin'}
                        </button>
                      ) : (
                        <button className="btn primary lg" onClick={() => navigateTo('showCampaigns')}>
                          <Ic n="compass" />Start a campaign
                        </button>
                      )}
                      <span className="last">
                        {campaignPlanReady
                          ? (hasStartedAdventure
                            ? `Continue your adventure with ${name}`
                            : `Begin your adventure with ${name}`)
                          : 'No campaign yet — create one to play'}
                      </span>
                    </div>
                  </div>

                  {/* The app does not yet persist a "where you left off" recap
                     blurb for the dashboard, so the design's recap prose block
                     is omitted rather than faked. */}

                  {v && (
                    <div className="hero-stats">
                      <span className="stat hp">
                        <span className="sl">HP</span>
                        <span className="sv" style={{ color: v.hpKind === 'bad' ? 'var(--bad)' : v.hpKind === 'warn' ? 'var(--warn)' : 'var(--good)' }}>
                          {v.curHp}<span className="mx"> / {v.maxHp}</span>
                        </span>
                      </span>
                      <span className="stat"><span className="sl">AC</span><span className="sv">{v.ac}</span></span>
                      <span className="stat"><span className="sl">Speed</span><span className="sv">{v.speed} ft</span></span>
                      {v.isMonk && v.level > 0 && (
                        <span className="stat">
                          <span className="sl">Ki</span>
                          <span className="stat-pips">
                            {Array.from({ length: v.level }).map((_, i) => <span key={i} className="pip magic full" />)}
                          </span>
                        </span>
                      )}
                      {typeof v.gold === 'number' && (
                        <span className="stat gold"><span className="sl">Gold</span><span className="sv">{v.gold} gp</span></span>
                      )}
                    </div>
                  )}
                </section>

                {/* NAVIGATION */}
                <div className="home-eyebrow">
                  <span className="eyebrow">Manage {name.split(' ')[0]}</span>
                  <span className="ln"></span>
                </div>

                <div className="nav-grid">
                  {navCards.map(card => (
                    <button type="button" key={card.key} className="nav-card" onClick={() => navigateTo(card.key)}>
                      <div className="arrow"><Ic n="arrow-right" /></div>
                      <div className="nc-top">
                        <span className="nc-ic"><Ic n={card.icon} /></span>
                        {card.spoiler && (
                          <span className="spoiler-flag"><Ic n="eye-off" />Spoilers</span>
                        )}
                      </div>
                      <h3>{card.title}</h3>
                      <p>{card.desc}</p>
                    </button>
                  ))}
                </div>
              </main>
            )
          })()}
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
