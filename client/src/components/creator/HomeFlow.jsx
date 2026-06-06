import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import HomeScreenV2 from './HomeScreenV2.jsx'
import CharacterCreatorV2 from './CharacterCreatorV2.jsx'
import SettingsOverlay from '../settings/SettingsOverlay.jsx'

// Phase 4a SC-4a.4 — lazy-load the diagnostic page; only fetched when
// the user clicks the AI Behavior appbar link.
const AIBehaviorDebugPage = lazy(() => import('../AIBehaviorDebugPage.jsx'))
import { rehydrateManualCreatorState } from './creatorPersistence.js'

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
 *   route='prelude.setup'         — PreludeCreatorV2 (6-step structural wizard)
 *   route='prelude.arc'           — PreludeArcPreview (Opus arc plan)
 *   route='prelude.session'       — PreludeSession (Sonnet play loop)
 *
 * Card click routing per spec §3.5:
 *   - Active card → calls onSelectActive (App.jsx renders dashboard)
 *   - 'creating' card → load character row, rehydrate manual state, open wizard
 *   - 'ready_for_primary' card → load character + handoff payload, rehydrate, open wizard
 *   - 'prelude' card → resume PreludeSession on the existing character
 */
export default function HomeFlow({ onSelectActive, onCharacterCreated }) {
  const [route, setRoute] = useState('home')
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [resumePayload, setResumePayload] = useState(null)
  const [resumeState, setResumeState] = useState(null)
  const [resumeCharacterId, setResumeCharacterId] = useState(null)
  const [error, setError] = useState(null)
  // Phase 3.5 — Settings overlay open state. Scoped per-character; the
  // home appbar's `Settings` link picks the most-recently-updated active
  // character (or a 'creating'/'ready_for_primary' draft if no actives
  // exist) so the per-character `survival_intensity` PUT writes
  // somewhere sensible. Link is hidden when there are zero characters.
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Phase 4a SC-4a.4 — AI Behavior debug page open state. Same access
  // pattern as Settings (appbar link, both home + path routes), but
  // distinct surface — a full-screen page rather than an overlay sheet.
  const [aiBehaviorOpen, setAiBehaviorOpen] = useState(false)

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

      // Any in-progress draft resumes in the manual creator. (The prelude
      // creator was removed in the MVP; legacy prelude / ready_for_primary
      // cards also resume here.)
      setResumePayload(null)
      setResumeState(rehydrateManualCreatorState(character))
      setResumeCharacterId(character.id)
      setRoute('wizard.resume.manual')
    } catch (err) {
      setError(err.message || 'Could not open character.')
    }
  }, [characters, onSelectActive])

  // "Create New" goes straight to the manual creator. (The prelude path
  // was removed in the MVP, so there's no longer a path-choice step.)
  const handleNew = useCallback(() => {
    setResumePayload(null)
    setResumeState(null)
    setResumeCharacterId(null)
    setRoute('wizard.manual')
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

  // Phase 3.5 — pick the per-character row Settings should scope to when
  // the user opens it from the home appbar. Active characters take
  // precedence, then in-progress drafts; tiebreaker is most-recent
  // updated_at. Returns null when there's nothing — the link won't render.
  const settingsCharacter = useMemo(() => {
    if (!characters.length) return null
    const byUpdated = (a, b) => {
      const ad = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const bd = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return bd - ad
    }
    const actives = characters.filter(c => (c.creation_phase || 'active') === 'active').sort(byUpdated)
    if (actives.length) return actives[0]
    return [...characters].sort(byUpdated)[0] || null
  }, [characters])

  const handleSettingsSaved = useCallback((updated) => {
    // Patch the character into the local list so subsequent home renders
    // reflect the new survival_intensity (status-display, future use).
    if (!updated?.id) return
    setCharacters(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
  }, [])

  // --- Render ---------------------------------------------------------------

  // Phase 4a SC-4a.4 — AI Behavior debug page takes over full-screen when
  // open (same pattern as the wizard / prelude routes). Independent of
  // the dashboard activeView path (which doesn't reach here) so the link
  // works from home or the path-choice screen alike.
  if (aiBehaviorOpen) {
    return (
      <Suspense fallback={<div style={{ padding: 32, color: '#999', fontFamily: 'monospace' }}>Loading AI Behavior debug page…</div>}>
        <AIBehaviorDebugPage
          onBack={() => setAiBehaviorOpen(false)}
          defaultCharacterId={settingsCharacter?.id || null}
        />
      </Suspense>
    )
  }

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

  // Home route (default). HomeScreenV2 is a full-screen `.hearth` surface, so
  // the old `.creator-v2` appbar that used to carry Settings / AI-Behavior was
  // painted behind it and unreachable. Those affordances now live in the
  // roster's own Hearth header (onSettings / onAIBehavior props). The loading /
  // error states render on a matching Hearth backdrop so there's no light flash.
  if (loading || error) {
    return (
      <div className="hearth app-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        {loading
          ? <p style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink-3)' }}>Gathering your characters…</p>
          : <div style={{ maxWidth: 640, padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: 'color-mix(in oklab, var(--bad) 10%, var(--bg-card))', border: '1px solid color-mix(in oklab, var(--bad) 40%, var(--rule))', color: 'var(--bad)', fontFamily: 'var(--serif)' }}>{error}</div>}
      </div>
    )
  }
  return (
    <>
      <HomeScreenV2
        characters={characters.map(mapCharacterForHome)}
        onNew={handleNew}
        onOpenCharacter={handleOpenCharacter}
        onAIBehavior={() => setAiBehaviorOpen(true)}
        onSettings={settingsCharacter ? () => setSettingsOpen(true) : null}
      />
      {settingsOpen && settingsCharacter && (
        <SettingsOverlay
          character={settingsCharacter}
          context="home"
          onClose={() => setSettingsOpen(false)}
          onSaved={handleSettingsSaved}
        />
      )}
    </>
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
    prelude_chapter: c.prelude_chapter || null,
    prelude_age: c.prelude_age || null,
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
