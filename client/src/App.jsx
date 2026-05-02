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
import LoginPage from './components/LoginPage'

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
const PlayerJournalPage = lazy(() => import('./components/PlayerJournalPage'))
const DMMode = lazy(() => import('./components/DMMode'))
const MythicProgressionPage = lazy(() => import('./components/MythicProgressionPage'))
const PartyBasePage = lazy(() => import('./components/PartyBasePage'))

// Phase 2 chunk 5 batch 2 — preview affordance for the rebuilt creator
// (`?creator=v2` in the URL). Direct import (not lazy) because the
// preview is opt-in via query param and the styles/fonts are also
// bundled globally per CLAUDE.md scoping conventions.
import CharacterCreatorV2 from './components/creator/CharacterCreatorV2.jsx'
import HomeScreenV2 from './components/creator/HomeScreenV2.jsx'
import PathChoiceScreen from './components/creator/PathChoiceScreen.jsx'

// Preview-only handoff payloads — exercise the celebration card on
// Step 2 + Step 3, the narrative-continuity card on Step 4, the bump
// celebration card on Step 5 (singular AND plural phrasings), and all
// three gold modifier display variants on Step 6 (positive / zero /
// negative with U+2212 minus). Uses the §8.2.1 schema_version=2 shape.
// Selected via `?creator=v2&handoff=1&fixture=<name>` — defaults to
// 'verena' if no fixture name given. Removed when 5.K wires the new
// creator into the home page (real payloads then come from
// /api/prelude/:id/handoff-payload).

// Default — multi-bump (plural "Two moments shaped you"), Soldier theme
// (zero gold modifier — "Fighter baseline" with no theme adjustment).
const PREVIEW_FIXTURE_VERENA = {
  schema_version: 2,
  character_id: 0,
  setup_name: 'Vera',
  name: 'Verena Ashfall',
  gender: 'Female',
  race: 'human',
  subrace: 'Variant Human',
  committed_theme: 'soldier',
  theme_chapter_beats: [
    { chapter: 1, reason: 'You marched with the muster when the levies came through, and stayed when others ran.' },
    { chapter: 2, reason: 'You held the river crossing for an hour against odds the captain still talks about.' },
    { chapter: 3, reason: 'You carried the standard out of a field that had become a graveyard.' }
  ],
  ancestry_feat_id: 'lucky',
  // Display overrides — production payload would have the API-resolved
  // name + description; for fixtures we hardcode them so the celebration
  // card renders cleanly without relying on a slug→DB-id lookup.
  ancestry_feat_name: 'Lucky',
  ancestry_feat_description: 'Spend luck points to reroll attacks, checks, or saves.',
  ancestry_chapter_beats: [
    { chapter: 1, reason: 'You survived a fall from the bell-tower scaffold that should have killed a child.' },
    { chapter: 2, reason: 'You drew the long straw in a coin-toss the village elders rigged against you.' },
    { chapter: 3, reason: 'The hunter\'s snare gave way the moment your weight came onto it.' }
  ],
  class_suggestion: 'fighter',
  accepted_stat_bumps: [
    { stat: 'str', magnitude: 1, chapter: 1, chapter_beat: 'The months at the smithy after the muster broadened your shoulders.' },
    { stat: 'con', magnitude: 1, chapter: 3, chapter_beat: 'You marched through the river-crossing winter for three days in soaked boots, and your body learned what it could endure.' }
  ],
  accepted_skill_bumps: [
    { skill: 'Athletics', chapter: 2, chapter_beat: 'The drills became second nature; your old captain stopped correcting your form.' },
    { skill: 'Intimidation', chapter: 3, chapter_beat: 'You found a voice that made the conscripts listen.' }
  ],
  heirloom_candidates: [],
  biography_seed: [
    { age: 12, chapter: 1, text: "Your mother's funeral. The priest let you carry the censer, and the weight of it was the first weight that ever felt real." },
    { age: 16, chapter: 2, text: "You took the king's coin at the spring muster. Your sister did not speak to you for a year, and then she did, and the year was not the part that mattered." },
    { age: 19, chapter: 3, text: "The river crossing. Captain Reyne fell. You did not. The standard was in your hand without your remembering picking it up." },
    { age: 21, chapter: 3, text: "You carried the standard back to the garrison through three days of rain. The captain who took it from your hand never used your name again." }
  ],
  canon_npcs: [
    { id: 1, name: 'Captain Reyne', relationship: 'commander', status: 'deceased' },
    { id: 2, name: 'Vesna', relationship: 'sister', status: 'alive' }
  ],
  canon_locations: [
    { id: 1, name: 'Holdfast River Crossing', type: 'battlefield', is_home: false },
    { id: 2, name: 'Three Mills', type: 'village', is_home: true }
  ],
  canon_threads: [],
  mentor_imprint_eligible: false,
  name_parts: { first_name: 'Verena', last_name: 'Ashfall', nickname: null }
}

// Single-bump variant — exercises the singular "One moment shaped you"
// phrasing on Step 5's bump celebration card. Investigator theme so
// Step 6 also exercises the POSITIVE gold variant (+10%).
const PREVIEW_FIXTURE_SINGLE_BUMP = {
  schema_version: 2,
  character_id: 0,
  setup_name: 'Halvor',
  name: 'Halvor',
  gender: 'Male',
  race: 'half-elf',
  subrace: null,
  committed_theme: 'investigator',
  theme_chapter_beats: [
    { chapter: 2, reason: 'You sorted a tangle of contradictory testimony at the village dispute and named the lying witness.' },
    { chapter: 3, reason: 'The merchant\'s missing coin was in the floorboards of his own son\'s room; only you thought to look.' }
  ],
  ancestry_feat_id: 'fey_touched',
  ancestry_feat_name: 'Fey-Touched',
  ancestry_feat_description: 'Learn misty step and one 1st-level divination or enchantment spell.',
  ancestry_chapter_beats: [
    { chapter: 1, reason: 'You learned both your parents\' tongues before you could read either, and switched between them mid-sentence.' },
    { chapter: 2, reason: 'You understood what the elven traders were saying before they realized you would.' }
  ],
  class_suggestion: 'rogue',
  accepted_stat_bumps: [
    { stat: 'wis', magnitude: 1, chapter: 3, chapter_beat: 'You learned to wait, to watch the room before speaking — the way your aunt taught you.' }
  ],
  accepted_skill_bumps: [
    { skill: 'Insight', chapter: 3, chapter_beat: 'You read the tax collector before he\'d finished his first sentence.' }
  ],
  heirloom_candidates: [],
  biography_seed: [],
  canon_npcs: [],
  canon_locations: [],
  canon_threads: [],
  mentor_imprint_eligible: false,
  name_parts: { first_name: 'Halvor', last_name: '', nickname: null }
}

// Negative-gold variant — Hermit theme exercises the NEGATIVE gold
// display (−35% with U+2212 minus glyph, NOT a hyphen). Wood Elf so
// Step 5 has a static racial bonus (+1 WIS) rather than the human
// "choice" pattern.
const PREVIEW_FIXTURE_HERMIT = {
  schema_version: 2,
  character_id: 0,
  setup_name: 'Vass',
  name: 'Vass',
  gender: 'Female',
  race: 'elf',
  subrace: 'Wood Elf',
  committed_theme: 'hermit',
  theme_chapter_beats: [
    { chapter: 1, reason: 'You stayed behind when the village left for the harvest fair; the silence didn\'t bother you.' },
    { chapter: 2, reason: 'You spent a winter in the high cabin reading what the previous keeper had left, and you stopped going down for supplies.' },
    { chapter: 3, reason: 'A traveler found you in the second spring; they spoke to you for three days and you remembered how to answer.' }
  ],
  ancestry_feat_id: 'elven_accuracy',
  ancestry_feat_name: 'Elven Accuracy',
  ancestry_feat_description: 'When you have advantage on an attack roll using DEX, INT, WIS, or CHA, reroll one of the dice.',
  ancestry_chapter_beats: [
    { chapter: 2, reason: 'You moved through the deep wood without leaving a track even your kin could read.' },
    { chapter: 3, reason: 'The wolves stopped marking your scent as a threat; the forest settled around you.' }
  ],
  class_suggestion: 'druid',
  accepted_stat_bumps: [
    { stat: 'wis', magnitude: 1, chapter: 2, chapter_beat: 'The long quiet taught you to hear what wasn\'t there.' },
    { stat: 'wis', magnitude: 1, chapter: 3, chapter_beat: 'The traveler\'s questions taught you to hear what was.' }
  ],
  accepted_skill_bumps: [
    { skill: 'Survival', chapter: 1, chapter_beat: 'You learned to feed yourself in the woods before you needed to.' }
  ],
  heirloom_candidates: [],
  biography_seed: [],
  canon_npcs: [],
  canon_locations: [],
  canon_threads: [],
  mentor_imprint_eligible: false,
  name_parts: { first_name: 'Vass', last_name: '', nickname: null }
}

const PREVIEW_FIXTURES = {
  verena: PREVIEW_FIXTURE_VERENA,
  'single-bump': PREVIEW_FIXTURE_SINGLE_BUMP,
  hermit: PREVIEW_FIXTURE_HERMIT
}

// Phase 2 chunk 5 batch 3 checkpoint 3 — home page roster fixtures.
// Exercises all three card states (active / creating / ready_for_primary)
// for visual review of the Diablo-4 Create entry + per-state badge
// treatment + meta line composition. Removed when 5.L.6 wires the new
// home page to the real characters API as the live path.
/**
 * Phase 2 chunk 5 batch 3 checkpoint 3 sub-router for the new home →
 * Screen 2 → creator preview flow. Lets PM walk through the full
 * user journey at visual review.
 *
 * URL parameters:
 *   ?creator=v2                       → opens directly at the creator
 *   ?creator=v2&from=home             → opens at the new home page
 *   ?creator=v2&from=path             → opens at Screen 2 (path choice)
 *   ?creator=v2&handoff=1&fixture=X   → opens at the creator in handoff mode (existing)
 *
 * Removed in 5.L.6 cleanup when the new flow becomes the live path.
 */
function CreatorV2Preview({ startAt, previewPayload, onExit }) {
  const initialRoute = startAt === 'home' ? 'home' : startAt === 'path' ? 'path' : 'wizard'
  const [route, setRoute] = useState(initialRoute)
  const [activePayload, setActivePayload] = useState(previewPayload)

  if (route === 'home') {
    return (
      <div className="creator-v2">
        <div className="appbar">
          <div className="brand">
            D <span className="amp">&amp;</span> D
            <span style={{ color: 'var(--ink-3)', fontStyle: 'normal', marginLeft: 6 }}>· Character Creator</span>
          </div>
          <div className="crumbs">The roster</div>
          <div className="spacer" />
          <button type="button" className="btn ghost" onClick={onExit}>Exit preview</button>
        </div>
        <div className="stage">
          <HomeScreenV2
            characters={PREVIEW_HOME_CHARACTERS}
            onNew={() => setRoute('path')}
            onOpenCharacter={(c) => {
              if (c.state === 'ready_for_primary') {
                // Resume in handoff mode — use the Verena fixture as a
                // representative payload until 5.L.3 wires real per-character
                // handoff payloads.
                setActivePayload(PREVIEW_FIXTURE_VERENA)
                setRoute('wizard')
              } else if (c.state === 'creating') {
                // Resume manual creator. 5.L.3 will load the character's
                // saved creator state; preview just opens the empty creator.
                setActivePayload(null)
                setRoute('wizard')
              } else {
                window.alert(`Active character — would open the game screen for ${c.name}. (Out of scope for the v2 preview; live cutover wires this.)`)
              }
            }}
          />
        </div>
      </div>
    )
  }

  if (route === 'path') {
    return (
      <div className="creator-v2">
        <div className="appbar">
          <div className="brand">
            D <span className="amp">&amp;</span> D
            <span style={{ color: 'var(--ink-3)', fontStyle: 'normal', marginLeft: 6 }}>· Character Creator</span>
          </div>
          <div className="crumbs">A choice of beginnings</div>
          <div className="spacer" />
          <button type="button" className="btn ghost" onClick={onExit}>Exit preview</button>
        </div>
        <div className="stage center">
          <PathChoiceScreen
            onPrelude={() => window.alert('Prelude path → opens PreludeSetupWizard. (Out of scope for v2 preview; live cutover wires this.)')}
            onCampaign={() => {
              setActivePayload(null)
              setRoute('wizard')
            }}
            onBack={() => setRoute('home')}
          />
        </div>
      </div>
    )
  }

  // wizard route
  return (
    <CharacterCreatorV2
      preludePayload={activePayload}
      onExit={onExit}
    />
  )
}

const PREVIEW_HOME_CHARACTERS = [
  {
    id: 'fx-1',
    state: 'ready_for_primary',
    name: 'Verena Ashfall',
    glyph: 'V',
    race_label: 'Variant Human',
    theme_label: 'Soldier',
    last: 'Prelude completed 2 days ago'
  },
  {
    id: 'fx-2',
    state: 'active',
    name: 'Aelarra Stormwhisper',
    glyph: 'A',
    race_label: 'Wood Elf',
    theme_label: 'Outlander',
    class_label: 'Ranger',
    level: 7,
    campaign: 'The Hollow Crown',
    last: 'Yesterday'
  },
  {
    id: 'fx-3',
    state: 'creating',
    name: 'Brenn',
    glyph: 'B',
    race_label: 'Mountain Dwarf',
    last: 'Step 2 of 8 · 4 days ago'
  },
  {
    id: 'fx-4',
    state: 'active',
    name: 'Quill of the Late Lantern',
    glyph: 'Q',
    race_label: 'Tiefling',
    theme_label: 'Charlatan',
    class_label: 'Bard',
    level: 4,
    campaign: 'Salt & Cinder',
    last: 'Last week'
  },
  {
    id: 'fx-5',
    state: 'ready_for_primary',
    name: 'Halvor',
    glyph: 'H',
    race_label: 'Half-Elf',
    theme_label: 'Investigator',
    last: 'Prelude completed yesterday'
  }
]

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
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
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

  // Check for existing auth token on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setAuthLoading(false)
      return
    }
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setUser(data.user))
      .catch(() => localStorage.removeItem('auth_token'))
      .finally(() => setAuthLoading(false))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    setUser(null)
    setCharacters([])
    setSelectedCharacter(null)
    setActiveView(null)
  }

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

  if (authLoading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />
  }

  // Phase 2 chunk 5 batch 2 — preview affordance for the rebuilt creator.
  // `?creator=v2` opens the new creator in manual mode for visual review.
  // `?creator=v2&handoff=1` simulates handoff mode using a built-in fixture
  // so the celebration card + narrative-continuity card can be inspected
  // without a live Prelude. Removed when 5.K wires the new creator into
  // the home page as the only path.
  const queryParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams()
  if (queryParams.get('creator') === 'v2') {
    const useHandoff = queryParams.get('handoff') === '1'
    const fixtureName = queryParams.get('fixture') || 'verena'
    const fixture = PREVIEW_FIXTURES[fixtureName] || PREVIEW_FIXTURES.verena
    const previewPayload = useHandoff ? fixture : null
    return (
      <CreatorV2Preview
        startAt={queryParams.get('from') || 'wizard'}
        previewPayload={previewPayload}
        onExit={() => {
          // Strip the query params and reload into the normal app shell.
          const url = new URL(window.location.href)
          url.searchParams.delete('creator')
          url.searchParams.delete('handoff')
          url.searchParams.delete('fixture')
          url.searchParams.delete('from')
          window.history.replaceState({}, '', url.toString())
          window.location.reload()
        }}
      />
    )
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
          onLogout={handleLogout}
        />
      </header>

      <ErrorBoundary>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>Loading...</div>}>
      {activeView === 'showDMMode' ? (
        <DMMode onBack={goHome} />
      ) : activeView === 'showNPCGenerator' ? (
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
      ) : activeView === 'showPlayerJournal' && selectedCharacter ? (
        <PlayerJournalPage
          character={selectedCharacter}
          onBack={() => navigateTo('home')}
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
      ) : activeView === 'showMythicProgression' && selectedCharacter ? (
        <MythicProgressionPage
          character={selectedCharacter}
          onCharacterUpdated={(char) => {
            setSelectedCharacter(char)
            loadCharacters()
          }}
        />
      ) : activeView === 'showPartyBase' && selectedCharacter ? (
        <PartyBasePage
          characterId={selectedCharacter.id}
          campaignId={selectedCharacter.campaign_id}
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
            onShowLevelUp={handleShowLevelUp}
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
                { key: 'showPlayerJournal', label: 'Player Journal', desc: 'NPCs met, places visited, faction standings, and quests', color: '#10b981' },
                { key: 'showDMSession', label: 'AI Dungeon Master', desc: 'Play through your campaign with an AI DM', color: '#2ecc71' },
                { key: 'showDMMode', label: 'DM Mode', desc: 'You DM for 4 AI player characters', color: '#e67e22' },
                { key: 'showDowntime', label: 'Downtime & Stats', desc: 'Rest, train, generate adventures, and track progress', color: '#f39c12' },
                { key: 'showMythicProgression', label: 'Mythic Progression', desc: 'Mythic tiers, paths, piety, epic boons, and legendary items', color: '#ff6b35' },
                { key: 'showPartyBase', label: 'Stronghold', desc: 'Manage your base, upgrades, staff, projects, and notoriety', color: '#b45309' },
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
