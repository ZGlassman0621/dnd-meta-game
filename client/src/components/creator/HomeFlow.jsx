import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import HomeScreenV2 from './HomeScreenV2.jsx'
import CreatorNextShell from '../creator-next/CreatorNextShell.jsx'
import PreludeArcPreview from '../PreludeArcPreview.jsx'
import PreludeSession from '../PreludeSession.jsx'
import SettingsOverlay from '../settings/SettingsOverlay.jsx'

// Phase 4a SC-4a.4 — lazy-load the diagnostic page; only fetched when
// the user clicks the AI Behavior appbar link.
const AIBehaviorDebugPage = lazy(() => import('../AIBehaviorDebugPage.jsx'))

/**
 * Phase 2 chunk 5 batch 3 sub-checkpoint 2 (5.L.6) — live home flow.
 *
 * Wraps HomeScreenV2 + CreatorNextShell with real `/api/character` data
 * + a small state machine for the home → creator chain.
 *
 * Replaces the `CharacterManager` render in App.jsx for the
 * no-character-selected case. When the player picks an active
 * character, this component invokes `onSelectActive(character)` so
 * App.jsx can set `selectedCharacter` and render the existing dashboard.
 *
 * State machine (2026-11-05 unhook: the new creator is the only path):
 *   route='home' (default)        — HomeScreenV2 with real characters
 *   route='wizard.next'           — CreatorNextShell (new creator);
 *                                  fresh create, or a 'creating' draft via
 *                                  resumeCharacterId (see below)
 *   route='prelude.arc'           — PreludeArcPreview (AI arc plan)
 *   route='prelude.session'       — PreludeSession (DM play loop)
 *
 * Card click routing per spec §3.5:
 *   - Active card → calls onSelectActive (App.jsx renders dashboard)
 *   - 'creating' card → open the new creator on that row. The shell
 *     trusts the local draft only when it belongs to this character;
 *     otherwise Stage 1 starts blank on the same row (first save PUTs
 *     it, so no orphan row). Server-row fields DO rehydrate now
 *     (rehydrateFromServerCharacter: row + progression snapshot);
 *     only the local-only fields (fighting style, subclass choices,
 *     cantrips, generation method, base scores, choice picks) and the
 *     derived Stage 4 lists still need the local mirror.
 *   - 'ready_for_primary' card → Prelude handoff is not built in the
 *     new creator yet; the roster shows an honest message, the row is
 *     left untouched.
 *   - 'prelude_setup' card → Prelude setup is not available in the new
 *     creator yet; same honest message, row untouched.
 *   - 'prelude' card → resume PreludeSession on the existing character
 */
// onCharacterCreated is App's handler (auto-select + campaign-setup
// landing). Stage 6 commit does NOT call it — the plan says submit
// does NOT start play, so HomeFlow's handleCommitted reloads the
// roster and routes home instead (coordinator decision 2026-11-07,
// reversible: call onCharacterCreated?.(character) in handleCommitted
// to restore the auto-select + campaign-setup landing). App still
// passes it; nothing here calls it on the commit path.
export default function HomeFlow({ onSelectActive, onCharacterCreated }) {
  const [route, setRoute] = useState('home')
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  // The 'creating' row a roster click is resuming in the new creator.
  // Passed to CreatorNextShell so it opens that row (and only that row's
  // local draft). Null for a fresh create.
  const [resumeCharacterId, setResumeCharacterId] = useState(null)
  // Creator mode: 'manual' (fresh create / draft resume) or 'edit'
  // (an active character opened for editing — same wizard, existing
  // row, Page 1 preservation rule on Review).
  const [creatorMode, setCreatorMode] = useState('manual')
  const [preludeCharacter, setPreludeCharacter] = useState(null)
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
    // `mapCharacterForHome`. We need the raw API row to confirm the
    // character exists — refetch by id so we get all columns.
    if (uiCharacter.state === 'active') {
      // Find the raw row in our characters list
      const row = characters.find(c => c.id === uiCharacter.id)
      if (onSelectActive && row) onSelectActive(row)
      return
    }

    setError(null)
    try {
      const charRes = await fetch(`/api/character/${uiCharacter.id}`)
      if (!charRes.ok) throw new Error(`Could not load character #${uiCharacter.id}`)
      const character = await charRes.json()

      if (uiCharacter.state === 'prelude_setup') {
        // Prelude setup has no home in the new creator yet (no Prelude
        // mode). Say so plainly and leave the row untouched — do not
        // route anywhere a creator cannot finish.
        setError('Prelude setup is not available in the new creator yet — this draft cannot be resumed until a Prelude mode is built.')
      } else if (uiCharacter.state === 'prelude') {
        // Resume the in-flight Prelude session on this character.
        setPreludeCharacter(character)
        setRoute('prelude.session')
      } else if (uiCharacter.state === 'ready_for_primary') {
        // Prelude handoff is not built in the new creator yet. Say so
        // plainly and leave the row (and its handoff payload) untouched.
        setError('Prelude handoff is not built in the new creator yet — this character cannot step forward until handoff mode lands.')
      } else {
        // 'creating' — open the new creator on this row. The shell
        // rehydrates the local draft only when it belongs to this
        // character; otherwise Stage 1 starts blank on the same row.
        setResumeCharacterId(character.id)
        setCreatorMode('manual')
        setRoute('wizard.next')
      }
    } catch (err) {
      setError(err.message || 'Could not open character.')
    }
  }, [characters, onSelectActive])

  // Create — the new creator is the only path. Fresh start: clear any
  // draft-resume state from a prior card click.
  const handleNew = useCallback(() => {
    setResumeCharacterId(null)
    setCreatorMode('manual')
    setRoute('wizard.next')
  }, [])

  // Edit — an ACTIVE character opens in the creator in edit mode: the
  // same wizard on the existing row, fields pre-filled via the
  // existing rehydration path. Never a second row, never a reset to
  // level 1 (the commit targets this id).
  const handleEditCharacter = useCallback((uiCharacter) => {
    setResumeCharacterId(uiCharacter.id)
    setCreatorMode('edit')
    setRoute('wizard.next')
  }, [])

  // Commit — the character is active on the roster now. Refresh the
  // roster so the new/edited card shows up, then return home. This
  // deliberately does NOT call onCharacterCreated: the plan says
  // submit does NOT start play — the player picks the character and
  // starts an adventure from home.
  const handleCommitted = useCallback(async () => {
    setResumeCharacterId(null)
    setCreatorMode('manual')
    await loadCharacters()
    setRoute('home')
  }, [loadCharacters])

  const handlePreludeArcBegin = useCallback(() => {
    setRoute('prelude.session')
  }, [])

  const handlePreludeReturn = useCallback(async () => {
    // Player exited from arc preview / session. Refresh the roster so
    // the new card (or the now-'ready_for_primary' card if [PRELUDE_END]
    // fired) shows up, then return home.
    setPreludeCharacter(null)
    await loadCharacters()
    setRoute('home')
  }, [loadCharacters])

  const handleExitWizard = useCallback(() => {
    setResumeCharacterId(null)
    setCreatorMode('manual')
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
  // works from home alike.
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

  // The new creator — the only creation path. Fresh create when
  // resumeCharacterId is null; a 'creating' roster draft otherwise.
  // Exit returns to the roster.
  if (route === 'wizard.next') {
    return (
      <CreatorNextShell
        onExit={handleExitWizard}
        resumeCharacterId={resumeCharacterId}
        onCommitted={handleCommitted}
        mode={creatorMode}
      />
    )
  }
  if (route === 'prelude.arc' && preludeCharacter) {
    return (
      <PreludeArcPreview
        character={preludeCharacter}
        onBegin={handlePreludeArcBegin}
        onReturn={handlePreludeReturn}
      />
    )
  }
  if (route === 'prelude.session' && preludeCharacter) {
    return (
      <PreludeSession
        character={preludeCharacter}
        onBack={handlePreludeReturn}
      />
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
        <button
          type="button"
          className="nav-settings"
          onClick={() => setAiBehaviorOpen(true)}
          aria-label="AI Behavior debug"
          title="Phase 4a diagnostic surface — captured prompts, signals, prompt-shape accounting"
        >
          <span className="glyph">◇</span>AI Behavior
        </button>
        {settingsCharacter && (
          <button
            type="button"
            className="nav-settings"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <span className="glyph">✦</span>Settings
          </button>
        )}
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
            onEditCharacter={handleEditCharacter}
          />
        )}
      </div>
      {settingsOpen && settingsCharacter && (
        <SettingsOverlay
          character={settingsCharacter}
          context="home"
          onClose={() => setSettingsOpen(false)}
          onSaved={handleSettingsSaved}
        />
      )}
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
