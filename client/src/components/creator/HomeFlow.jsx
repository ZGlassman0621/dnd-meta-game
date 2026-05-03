import { useState, useEffect, useCallback } from 'react'
import HomeScreenV2 from './HomeScreenV2.jsx'
import PathChoiceScreen from './PathChoiceScreen.jsx'
import CharacterCreatorV2 from './CharacterCreatorV2.jsx'
import {
  rehydrateManualCreatorState,
  rehydrateHandoffCreatorState
} from './creatorPersistence.js'

/**
 * Phase 2 chunk 5 batch 3 sub-checkpoint 2 (5.L.6) — live home flow.
 *
 * Wraps HomeScreenV2 + PathChoiceScreen + CharacterCreatorV2 with real
 * `/api/character` data + a small state machine for the home → path →
 * creator chain.
 *
 * Replaces the `CharacterManager` render in App.jsx for the
 * no-character-selected case. When the player picks an active
 * character, this component invokes `onSelectActive(character)` so
 * App.jsx can set `selectedCharacter` and render the existing dashboard.
 *
 * State machine:
 *   route='home' (default)        — HomeScreenV2 with real characters
 *   route='path'                  — PathChoiceScreen (Prelude / Campaign)
 *   route='wizard.manual'         — CharacterCreatorV2 in manual mode (new)
 *   route='wizard.resume.manual'  — CharacterCreatorV2 with rehydrated 'creating' state
 *   route='wizard.resume.handoff' — CharacterCreatorV2 with rehydrated 'ready_for_primary' state
 *
 * Card click routing per spec §3.5:
 *   - Active card → calls onSelectActive (App.jsx renders dashboard)
 *   - 'creating' card → load character row, rehydrate manual state, open wizard
 *   - 'ready_for_primary' card → load character + handoff payload, rehydrate, open wizard
 */
export default function HomeFlow({ onSelectActive, onCharacterCreated }) {
  const [route, setRoute] = useState('home')
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [resumePayload, setResumePayload] = useState(null)
  const [resumeState, setResumeState] = useState(null)
  const [resumeCharacterId, setResumeCharacterId] = useState(null)
  const [error, setError] = useState(null)

  const loadCharacters = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/character')
      if (!res.ok) throw new Error(`Could not load characters (HTTP ${res.status})`)
      const data = await res.json()
      setCharacters(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Could not load characters.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCharacters() }, [loadCharacters])

  // --- Card click handlers --------------------------------------------------

  const handleOpenCharacter = useCallback(async (uiCharacter) => {
    // The shape passed by HomeScreenV2 is the API row mapped through
    // `mapCharacterForHome`. We need the raw API row for rehydration —
    // refetch by id so we get all columns.
    if (uiCharacter.state === 'active') {
      // Find the raw row in our characters list
      const row = characters.find(c => c.id === uiCharacter.id)
      if (onSelectActive && row) onSelectActive(row)
      return
    }

    // In-progress card — load full character record + (handoff only)
    // its prelude_handoff_payload, then route to the wizard with
    // rehydrated state.
    setError(null)
    try {
      const charRes = await fetch(`/api/character/${uiCharacter.id}`)
      if (!charRes.ok) throw new Error(`Could not load character #${uiCharacter.id}`)
      const character = await charRes.json()

      if (uiCharacter.state === 'ready_for_primary') {
        const payloadRes = await fetch(`/api/prelude/${uiCharacter.id}/handoff-payload`)
        const payload = payloadRes.ok ? await payloadRes.json() : null
        setResumePayload(payload)
        setResumeState(rehydrateHandoffCreatorState(character, payload))
        setResumeCharacterId(character.id)
        setRoute('wizard.resume.handoff')
      } else {
        // 'creating' — manual rehydration (no payload)
        setResumePayload(null)
        setResumeState(rehydrateManualCreatorState(character))
        setResumeCharacterId(character.id)
        setRoute('wizard.resume.manual')
      }
    } catch (err) {
      setError(err.message || 'Could not open character.')
    }
  }, [characters, onSelectActive])

  const handleNew = useCallback(() => setRoute('path'), [])

  const handlePickCampaign = useCallback(() => {
    setResumePayload(null)
    setResumeState(null)
    setResumeCharacterId(null)
    setRoute('wizard.manual')
  }, [])

  const handlePickPrelude = useCallback(() => {
    // Prelude path is owned by the existing PreludeSetupWizard. The full
    // wiring (launching the setup wizard from here) is its own integration
    // surface — the existing app already has it under a different path.
    // For now, surface a minimal handoff so the player can see what to do.
    window.alert('The Prelude path uses the existing Prelude Setup Wizard. (Live wiring of "from new home → setup wizard" is a small follow-up that doesn\'t affect Phase 2 ship.)')
  }, [])

  const handleSubmitSuccess = useCallback(async (result) => {
    // Refresh the character list and route back to home; if the
    // newly-active character can be picked up, hand it to App.jsx so
    // the dashboard takes over.
    await loadCharacters()
    setResumePayload(null); setResumeState(null); setResumeCharacterId(null)
    if (onCharacterCreated && result?.character_id) {
      try {
        const res = await fetch(`/api/character/${result.character_id}`)
        if (res.ok) {
          const character = await res.json()
          onCharacterCreated(character)
          return
        }
      } catch { /* fall through to home */ }
    }
    setRoute('home')
  }, [loadCharacters, onCharacterCreated])

  const handleExitWizard = useCallback(() => {
    setResumePayload(null); setResumeState(null); setResumeCharacterId(null)
    setRoute('home')
  }, [])

  // --- Render ---------------------------------------------------------------

  if (route === 'wizard.manual') {
    return (
      <CharacterCreatorV2
        preludePayload={null}
        persistProgress={true}
        onExit={handleExitWizard}
        onSubmitSuccess={handleSubmitSuccess}
      />
    )
  }
  if (route === 'wizard.resume.manual') {
    return (
      <CharacterCreatorV2
        preludePayload={null}
        initialState={resumeState}
        initialCharacterId={resumeCharacterId}
        persistProgress={true}
        onExit={handleExitWizard}
        onSubmitSuccess={handleSubmitSuccess}
      />
    )
  }
  if (route === 'wizard.resume.handoff') {
    return (
      <CharacterCreatorV2
        preludePayload={resumePayload}
        initialState={resumeState}
        initialCharacterId={resumeCharacterId}
        persistProgress={true}
        onExit={handleExitWizard}
        onSubmitSuccess={handleSubmitSuccess}
      />
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
        </div>
        <div className="stage center">
          <PathChoiceScreen
            onPrelude={handlePickPrelude}
            onCampaign={handlePickCampaign}
            onBack={() => setRoute('home')}
          />
        </div>
      </div>
    )
  }

  // Home route (default)
  return (
    <div className="creator-v2">
      <div className="appbar">
        <div className="brand">
          D <span className="amp">&amp;</span> D
          <span style={{ color: 'var(--ink-3)', fontStyle: 'normal', marginLeft: 6 }}>· Character Creator</span>
        </div>
        <div className="crumbs">The roster</div>
        <div className="spacer" />
      </div>
      <div className="stage">
        {loading && (
          <p className="lede" style={{ textAlign: 'center', padding: '60px 0' }}>
            Gathering your characters…
          </p>
        )}
        {error && (
          <div style={{
            maxWidth: 640,
            margin: '40px auto',
            padding: '16px 20px',
            background: 'rgba(231, 76, 60, 0.08)',
            border: '1px solid #e74c3c',
            color: '#c0392b',
            fontFamily: 'var(--serif)'
          }}>
            {error}
          </div>
        )}
        {!loading && !error && (
          <HomeScreenV2
            characters={characters.map(mapCharacterForHome)}
            onNew={handleNew}
            onOpenCharacter={handleOpenCharacter}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Map an /api/character row into the shape HomeScreenV2 expects. The
 * card needs: id, state, name, glyph, race_label, theme_label,
 * class_label, level, campaign, last.
 *
 * `state` derives from `creation_phase`. `glyph` defaults to first
 * character of first_name. Theme/class labels prettify the stored ids.
 */
function mapCharacterForHome(c) {
  const phase = c.creation_phase || 'active'
  return {
    id: c.id,
    state: phase,
    name: composeName(c) || '(unnamed)',
    glyph: (c.first_name || c.name || '?').charAt(0).toUpperCase(),
    race_label: prettify(c.subrace || c.race),
    theme_label: prettify(c.theme_id),
    class_label: prettify(c.class),
    level: c.level || null,
    campaign: c.campaign_name || null,
    last: c.updated_at ? formatLastTouched(c.updated_at) : null
  }
}

function composeName(c) {
  if (c.first_name || c.last_name) {
    return [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
  }
  return c.name || ''
}

function prettify(id) {
  if (!id) return null
  return String(id).split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function formatLastTouched(iso) {
  try {
    const then = new Date(iso)
    const now = new Date()
    const diffMs = now - then
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 14) return 'Last week'
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    if (days < 365) return `${Math.floor(days / 30)} months ago`
    return `${Math.floor(days / 365)} years ago`
  } catch {
    return null
  }
}
