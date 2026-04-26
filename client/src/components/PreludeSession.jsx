import React, { useState, useEffect, useRef } from 'react'
import PreludeLorePanel from './PreludeLorePanel'
import PreludeThemeCommitCard from './PreludeThemeCommitCard'

/**
 * PreludeSession — gameplay screen for a prelude-arc session.
 *
 * Phase 2b-i scope: text-based play. The player types an action, the AI
 * responds, markers are processed server-side, age/chapter update in real
 * time. Dice rolls are described in text for now (player tells the AI
 * their rolled number in their action text). Dice-roller UI + combat
 * tracker integration land in Phase 2b-ii.
 *
 * The component owns:
 *   - Message history (rendered bottom-up as a scroll feed)
 *   - Action input box + send button
 *   - Top bar showing character name, age, chapter
 *   - Auto-resume on mount via GET /sessions/active
 *   - Auto-scroll on new message
 *   - "Session ended" state when the AI emits a cliffhanger
 *
 * Does NOT own (yet): dice rolling, combat tracker, condition panel,
 * emergence toasts, values tracker, chapter-promise UI.
 */
// Shared text style for inline help/description copy. Mirrors the same
// style in PreludeSetupWizard so the two surfaces feel consistent.
const descStyle = { fontSize: '0.75rem', color: '#9fa3a8', fontStyle: 'italic', marginTop: '0.2rem', lineHeight: 1.4 }

export default function PreludeSession({ character, onBack }) {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([]) // {role, content}
  const [runtime, setRuntime] = useState({ age: character.prelude_age, chapter: character.prelude_chapter })
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [lastCliffhanger, setLastCliffhanger] = useState(null)
  const [sessionRecap, setSessionRecap] = useState(null)
  // v1.0.78 — session highlights accumulator. Populated per-turn from
  // data.markers so the wrap-up screen can show "what happened this play-
  // session" without any extra server round-trips. Reset on session start
  // and on resume (new play-session). Never persisted.
  const [sessionSummary, setSessionSummary] = useState({
    emergencesAccepted: [],     // { kind, target, magnitude, reason }
    canonFactsAdded: [],        // { subject, fact, category }
    npcsCanonized: [],          // { name, relationship }
    locationsCanonized: [],     // { name, type }
    totalHpDelta: 0,            // net across all HP_CHANGE markers
    hpReasons: [],              // most recent reason strings
    chapterAdvanced: null,      // { from, to }
    ageAdvanced: null,          // { from, to, years }
    themeCommitted: null        // theme id, if committed this session
  })
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [showSetup, setShowSetup] = useState(false)
  const [showLore, setShowLore] = useState(false)
  const [values, setValues] = useState([])
  // Canon facts moved to PreludeLorePanel (v1.0.75 → fully migrated). The
  // panel fetches its own data via /canon-facts when it opens.
  // v1.0.75 — simplified to a two-state toggle: 'auto' (default — Sonnet,
  // escalating to Opus on heavy beats) or 'sonnet' (always Sonnet).
  // The server still accepts 'opus' for legacy session state, but the UI
  // no longer surfaces it. resolvedModel/resolveReason still carry the
  // server's last-turn decision so the UI can show why Auto escalated.
  const [model, setModel] = useState('auto')
  const [resolvedModel, setResolvedModel] = useState('sonnet')
  const [resolveReason, setResolveReason] = useState(null)
  const scrollerRef = useRef(null)

  // Fetch emerging values whenever the Setup panel opens, or after a player
  // turn (to reflect new values from the last AI response). Canon facts are
  // fetched independently by PreludeLorePanel.
  useEffect(() => {
    if (!showSetup || !character?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const vResp = await fetch(`/api/prelude/${character.id}/values`)
        if (vResp.ok) {
          const data = await vResp.json()
          if (!cancelled) setValues(data)
        }
      } catch (_) { /* silent */ }
    })()
    return () => { cancelled = true }
  }, [showSetup, character?.id, messages.length])

  // Elapsed-seconds counter for loading/sending states.
  useEffect(() => {
    const busy = loading || sending
    if (!busy) { setElapsed(0); return }
    const start = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)
    return () => clearInterval(id)
  }, [loading, sending])

  // Initial load: resume active session or start a new one.
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      setLoading(true)
      setError('')
      try {
        // Try to resume
        const activeResp = await fetch(`/api/prelude/${character.id}/sessions/active`)
        if (activeResp.ok) {
          const active = await activeResp.json()
          // Full payload with character + messages + runtime
          const fullResp = await fetch(`/api/prelude/sessions/${active.id}`)
          if (!fullResp.ok) throw new Error('Failed to load active session')
          const full = await fullResp.json()
          if (cancelled) return
          setSessionId(full.sessionId)
          setMessages(full.messages.filter(m => m.role !== 'system'))
          setRuntime(full.runtime)
          setLastCliffhanger(full.lastCliffhanger || null)
          setSessionRecap(full.lastSessionRecap || null)
          setSessionEnded(full.status === 'paused')
          if (full.model === 'sonnet' || full.model === 'opus' || full.model === 'auto') setModel(full.model)
          return
        }
        // No active session → start a new one
        const startResp = await fetch(`/api/prelude/${character.id}/sessions/start`, { method: 'POST' })
        if (!startResp.ok) {
          const body = await startResp.json().catch(() => ({}))
          throw new Error(body.error || `Server error (${startResp.status})`)
        }
        const started = await startResp.json()
        if (cancelled) return
        setSessionId(started.sessionId)
        setMessages([{ role: 'assistant', content: started.opening }])
        setRuntime(started.runtime)
        if (started.model === 'sonnet' || started.model === 'opus' || started.model === 'auto') setModel(started.model)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [character.id])

  // Auto-scroll to bottom on message change
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
    }
  }, [messages, sending])

  const handleSend = async () => {
    if (!action.trim() || sending || sessionEnded) return
    const a = action.trim()
    setAction('')
    setError('')
    setSending(true)
    // Optimistically show the player's action
    setMessages(prev => [...prev, { role: 'user', content: a }])
    try {
      const resp = await fetch(`/api/prelude/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: a, model })
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        // Prefer the user-friendly `message` field (set on retryable
        // errors like 503 OVERLOADED) over the short `error` slug.
        throw new Error(body.message || body.error || `Server error (${resp.status})`)
      }
      const data = await resp.json()
      // Chapter-promise marker fires at the opening of chapters 3/4 — surface
      // it as its own beat in the feed so the player can see the chapter's
      // thematic framing and respond to it (confirm / redirect / see-where).
      const newAssistant = { role: 'assistant', content: data.response }
      if (data.markers?.chapterPromise) {
        newAssistant.chapterPromise = data.markers.chapterPromise
      }
      // Phase 3 — attach any offered emergences (stat/skill) to the
      // assistant beat. Rendered as accept/decline cards inline below.
      if (Array.isArray(data.markers?.offeredEmergences) && data.markers.offeredEmergences.length > 0) {
        newAssistant.offeredEmergences = data.markers.offeredEmergences
      }
      // v1.0.67 — Rule 2 violation flag. If the detector caught quoted
      // dialogue attributed to the PC, attach the flag to the message so
      // the render layer can show a red warning badge. The server has
      // already queued a correction [SYSTEM NOTE] for the next turn.
      if (data.markers?.rule2Violation) {
        newAssistant.rule2Violation = data.markers.rule2Violation
      }
      // v1.0.77 — theme commitment offer (Ch3 wrap-up). Server recomputes
      // the authoritative offer from the trajectory + setup wildcards;
      // attach it to the assistant beat so a Choose Your Path card renders
      // inline below the narration.
      if (data.markers?.themeCommitmentOffer) {
        newAssistant.themeCommitmentOffer = data.markers.themeCommitmentOffer
      }
      // Chapter advancement + age advancement produce tiny notice banners
      // between messages — purely informational.
      const notices = []
      if (data.markers?.chapterAdvanced) {
        notices.push({ role: 'notice', content: `→ Chapter ${data.markers.chapterAdvanced.to}` })
      }
      if (data.markers?.ageAdvanced && !data.markers?.chapterAdvanced) {
        notices.push({ role: 'notice', content: `→ +${data.markers.ageAdvanced.years} year${data.markers.ageAdvanced.years === 1 ? '' : 's'} (Age ${data.markers.ageAdvanced.to})` })
      }
      if (data.markers?.hpDelta) {
        const d = data.markers.hpDelta
        const label = d < 0 ? `HP ${d}` : `HP +${d}`
        notices.push({ role: 'notice', content: label })
      }
      setMessages(prev => [...prev, ...notices, newAssistant])

      // v1.0.78 — accumulate session highlights from this turn's markers.
      // The wrap-up screen will render these so the player sees what
      // happened mechanically this play-session, not just the prose recap.
      const m = data.markers || {}
      setSessionSummary(prev => ({
        ...prev,
        canonFactsAdded: m.canonFactsAdded?.length
          ? [...prev.canonFactsAdded, ...m.canonFactsAdded]
          : prev.canonFactsAdded,
        npcsCanonized: m.npcsCreated?.length
          ? [...prev.npcsCanonized, ...m.npcsCreated]
          : prev.npcsCanonized,
        locationsCanonized: m.locationsCreated?.length
          ? [...prev.locationsCanonized, ...m.locationsCreated]
          : prev.locationsCanonized,
        totalHpDelta: prev.totalHpDelta + (m.hpDelta || 0),
        hpReasons: m.hpReasons?.length
          ? [...prev.hpReasons, ...m.hpReasons].slice(-10)
          : prev.hpReasons,
        chapterAdvanced: m.chapterAdvanced || prev.chapterAdvanced,
        ageAdvanced: m.ageAdvanced || prev.ageAdvanced
      }))

      if (data.runtime) setRuntime(data.runtime)
      if (data.model === 'sonnet' || data.model === 'opus' || data.model === 'auto') setModel(data.model)
      if (data.resolvedModel === 'sonnet' || data.resolvedModel === 'opus') setResolvedModel(data.resolvedModel)
      setResolveReason(data.resolveReason || null)
      if (data.sessionEnded) {
        setSessionEnded(true)
        if (data.markers?.cliffhanger) setLastCliffhanger(data.markers.cliffhanger)
        if (data.markers?.sessionRecap) setSessionRecap(data.markers.sessionRecap)
      }
    } catch (e) {
      setError(e.message)
      // Roll back the optimistic user message so they can retry
      setMessages(prev => prev.slice(0, -1))
      setAction(a)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleEndSession = async () => {
    if (!confirm('End this session? You can resume later from the character list.')) return
    try {
      await fetch(`/api/prelude/sessions/${sessionId}/end`, { method: 'POST' })
      setSessionEnded(true)
    } catch (e) {
      setError(e.message)
    }
  }

  // Phase 3 — emergence decision handler. Updates the local message
  // optimistically so the card re-renders with the new status.
  const handleEmergenceDecision = async (emergenceId, decision) => {
    const url = decision === 'accept'
      ? `/api/prelude/${character.id}/emergences/${emergenceId}/accept`
      : `/api/prelude/${character.id}/emergences/${emergenceId}/decline`
    const body = decision === 'never' ? { permanent: true } : {}
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: decision === 'never' ? JSON.stringify(body) : undefined
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `Server error (${resp.status})`)
      }
      const updated = await resp.json()
      // Mark this emergence card as resolved in the message feed
      setMessages(prev => prev.map(m => {
        if (!m.offeredEmergences) return m
        return {
          ...m,
          offeredEmergences: m.offeredEmergences.map(e =>
            e.emergenceId === emergenceId ? { ...e, _resolved: updated.status } : e
          )
        }
      }))
      // v1.0.78 — track accepted emergences for the wrap-up screen.
      if (decision === 'accept') {
        // Find the full emergence record in the message feed so we can
        // capture kind/target/magnitude/reason for the highlights list.
        const found = messages
          .flatMap(m => m.offeredEmergences || [])
          .find(e => e.emergenceId === emergenceId)
        if (found) {
          setSessionSummary(prev => ({
            ...prev,
            emergencesAccepted: [...prev.emergencesAccepted, {
              kind: found.kind,
              target: found.kind === 'stat' ? found.stat : found.skill || found.target,
              magnitude: found.magnitude,
              reason: found.reason
            }]
          }))
        }
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const handleResumeSession = async () => {
    setError('')
    try {
      const resp = await fetch(`/api/prelude/sessions/${sessionId}/resume`, { method: 'POST' })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.error || `Server error (${resp.status})`)
      }
      setSessionEnded(false)
      // Clear the cliffhanger from the UI — the prompt builder already
      // injects it into the next Sonnet call via session_config.lastCliffhanger,
      // so we don't need to show it as a banner anymore.
      // v1.0.78 — reset session highlights accumulator for the new
      // play-session. The wrap-up screen for the upcoming session starts
      // fresh; the completed session's summary was already shown.
      setSessionSummary({
        emergencesAccepted: [],
        canonFactsAdded: [],
        npcsCanonized: [],
        locationsCanonized: [],
        totalHpDelta: 0,
        hpReasons: [],
        chapterAdvanced: null,
        ageAdvanced: null,
        themeCommitted: null
      })
    } catch (e) {
      setError(e.message)
    }
  }

  // ---- Render ------------------------------------------------------------

  // v1.0.83 — shell uses a fixed-width play area that DOESN'T change when
  // the Lore panel toggles. Lore pops out to the right of the play area.
  // Top bar and play-area footer live inside a fixed-width wrapper; the
  // flex row that contains the play area + Lore sibling centers them
  // together on a wide screen. Future "Map" panel will use the same
  // sibling-dock pattern.
  const PLAY_AREA_WIDTH = 1200
  const SIDE_PANEL_WIDTH = 420
  const SIDE_PANEL_GAP = 16
  const shellStyle = {
    maxWidth: `${PLAY_AREA_WIDTH + SIDE_PANEL_WIDTH + SIDE_PANEL_GAP + 32}px`,
    margin: '0 auto',
    padding: '0 1rem'
  }

  if (loading) {
    // When the arc preview was skipped, this call generates the arc plan
    // AND the opening scene — can run 90-150s. When resuming or coming
    // from the arc preview, only the opening — 30-60s.
    return (
      // v1.0.84 — loading/error states use narrower width (shellStyle is
      // sized for the play-area + Lore combo; these transient states don't
      // need that width).
      <div className="container" style={{ maxWidth: '860px', margin: '0 auto', textAlign: 'center', padding: '3rem 1rem' }}>
        <h2 style={{ color: '#a78bfa', margin: 0 }}>Opening the scene…</h2>
        <p style={{ color: '#bbb', marginTop: '0.5rem' }}>
          Opus is setting the stage for {character.nickname || character.first_name || character.name}. Typical: 30-60 seconds, or up to 2 minutes if the arc plan is being generated at the same time.
        </p>
        <p style={{ color: '#c4b5fd', marginTop: '0.75rem', fontSize: '1.1rem', fontFamily: 'monospace' }}>
          {elapsed}s elapsed
        </p>
      </div>
    )
  }

  if (error && messages.length === 0) {
    return (
      <div className="container" style={{ maxWidth: '860px', margin: '0 auto' }}>
        <h2 style={{ color: '#f87171' }}>Couldn't open the session</h2>
        <p style={{ color: '#fca5a5', fontSize: '0.9rem' }}>{error}</p>
        <button className="button" onClick={onBack} style={{ background: '#95a5a6' }}>Back to characters</button>
      </div>
    )
  }

  const chapterName = ['', 'Early Childhood', 'Middle Childhood', 'Adolescence', 'Threshold'][runtime.chapter] || '?'
  const sessionNum = runtime.sessionNumber || 1

  return (
    // v1.0.84 — outer shell is pure layout (no `.container` chrome). The
    // container CSS (background/border/padding) would otherwise wrap the
    // WHOLE shell + Lore area, drawing a dark box around empty flex space
    // when Lore is closed. Each panel now carries its own chrome.
    <div style={shellStyle}>
      {/* v1.0.83 — Flex row wraps the ENTIRE play area + Lore. Lore pops
          out to the right of the play area without shrinking it. The
          combined unit (play + Lore) centers inside the shell. Future
          Map panel will use the same sibling-dock pattern. */}
      <div style={{ display: 'flex', gap: `${SIDE_PANEL_GAP}px`, justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{
          width: `${PLAY_AREA_WIDTH}px`,
          flexShrink: 0,
          minWidth: 0,
          // v1.0.84 — play area gets its own container chrome (matches
          // .container from index.css so the visual is identical to the
          // pre-flex layout, just scoped to this wrapper).
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>

      {/* Top bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid rgba(139,92,246,0.3)'
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#a78bfa' }}>
            ✦ {[character.first_name, character.last_name].filter(Boolean).join(' ') || character.name}
          </h2>
          {/* v1.0.83 — hyphen-separated meta, no "of 4" or chapter-name
              (chapter number is enough; the name is known to the player
              from the setup wizard and the wrap-up screen). */}
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#bbb' }}>
            Session {sessionNum} - Chapter {runtime.chapter} - Age {runtime.age}
            {runtime.currentHp != null && runtime.maxHp != null && (
              <>
                {' - '}
                <span style={{
                  color: runtime.currentHp <= 0 ? '#f87171' : runtime.currentHp < runtime.maxHp / 2 ? '#fbbf24' : '#86efac',
                  fontFamily: 'monospace',
                  fontWeight: 600
                }}>
                  HP {runtime.currentHp}/{runtime.maxHp}
                </span>
              </>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* v1.0.83 — Auto toggle flattened: the column-wrapper and
              resolve-reason indicator were making the button taller than
              its siblings (misaligned row). If the player wants to see
              last-turn resolution, server logs carry it. The Auto label
              itself shows a tiny arrow-marker when last turn was Opus. */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.7rem',
              border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: '14px',
              background: model === 'auto' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
              cursor: sending ? 'not-allowed' : 'pointer',
              fontSize: '0.78rem',
              fontFamily: 'monospace',
              color: model === 'auto' ? '#e9d5ff' : '#9ca3af',
              userSelect: 'none'
            }}
            title={
              model === 'auto' && resolvedModel === 'opus' && resolveReason
                ? `Auto mode on — last turn escalated to Opus (${resolveReason}). Toggle off for Sonnet-always.`
                : 'Auto mode: Sonnet for texture, Opus for heavy beats. Toggle off to always use Sonnet.'
            }
          >
            <input
              type="checkbox"
              checked={model === 'auto'}
              disabled={sending}
              onChange={e => setModel(e.target.checked ? 'auto' : 'sonnet')}
              style={{ cursor: sending ? 'not-allowed' : 'pointer' }}
            />
            Auto
            {model === 'auto' && resolvedModel === 'opus' && (
              <span style={{ marginLeft: '0.15rem', color: '#c4b5fd', fontSize: '0.72rem' }}>→opus</span>
            )}
          </label>
          {(() => {
            // v1.0.82 — compact uniform button styling
            const btn = (bg, border, color, extra = {}) => ({
              padding: '0.35rem 0.65rem',
              background: bg,
              border: `1px solid ${border}`,
              color,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              whiteSpace: 'nowrap',
              ...extra
            })
            return (
              <>
                <button
                  onClick={() => setShowLore(s => !s)}
                  title="Toggle the Lore panel — canon, world events, relationships."
                  style={btn(
                    showLore ? 'rgba(251,191,36,0.25)' : 'rgba(251,191,36,0.1)',
                    'rgba(251,191,36,0.4)',
                    '#fbbf24'
                  )}
                >Lore</button>
                <button
                  onClick={() => setShowSetup(s => !s)}
                  title="Toggle the Setup review — character details and emerging values. (Canon lore is in the Lore panel.)"
                  style={btn(
                    showSetup ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.1)',
                    'rgba(139,92,246,0.4)',
                    '#c4b5fd'
                  )}
                >Setup</button>
                <button
                  onClick={handleEndSession}
                  disabled={sessionEnded}
                  title="End this play-session and save."
                  style={btn(
                    'rgba(239,68,68,0.15)',
                    'rgba(239,68,68,0.4)',
                    sessionEnded ? '#6b7280' : '#fca5a5',
                    { cursor: sessionEnded ? 'not-allowed' : 'pointer' }
                  )}
                >End</button>
                <button
                  onClick={onBack}
                  title="Back to character list."
                  style={btn(
                    'rgba(255,255,255,0.05)',
                    'rgba(255,255,255,0.15)',
                    '#ccc'
                  )}
                >Characters</button>
              </>
            )
          })()}
        </div>
      </div>

      {/* Setup review — lets the player confirm what they picked. */}
      {showSetup && (() => {
        const setup = (() => {
          if (!character.prelude_setup_data) return null
          if (typeof character.prelude_setup_data === 'string') {
            try { return JSON.parse(character.prelude_setup_data) } catch { return null }
          }
          return character.prelude_setup_data
        })()
        if (!setup) {
          return (
            <div style={{ padding: '0.8rem 1rem', background: 'rgba(139,92,246,0.06)', border: '1px dashed rgba(139,92,246,0.3)', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem', color: '#bbb' }}>
              No setup data on file for this character.
            </div>
          )
        }
        const parentLines = (setup.parents || []).map(p => `${p.role || 'parent'}: ${p.name || '(unnamed)'} — ${p.status}`).join('; ')
        const siblingLines = (setup.siblings || []).length > 0
          ? setup.siblings.map(s => `${s.name} (${s.gender || 'sibling'}, ${s.relative_age || '?'})`).join('; ')
          : 'only child'
        const row = (label, value) => (
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ color: '#a78bfa', fontSize: '0.78rem', fontWeight: 600 }}>{label}</span>
            <span style={{ color: '#ddd', fontSize: '0.82rem' }}>{value}</span>
          </div>
        )
        return (
          <div style={{
            padding: '0.9rem 1rem',
            background: 'rgba(139,92,246,0.06)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: '6px',
            marginBottom: '1rem'
          }}>
            <h4 style={{ margin: '0 0 0.5rem', color: '#c4b5fd', fontSize: '0.9rem' }}>Your prelude setup</h4>
            {row('Name', `${setup.first_name || ''} ${setup.last_name || ''}${setup.nickname ? ` ("${setup.nickname}")` : ''}`)}
            {row('Gender', setup.gender || '—')}
            {row('Race', `${character.race}${character.subrace ? ` (${character.subrace})` : ''}`)}
            {row('Birth', setup.birth_circumstance || '—')}
            {row('Home', setup.home_setting || '—')}
            {row('Region', setup.region || '—')}
            {row('Parents', parentLines || 'none')}
            {row('Siblings', siblingLines)}
            {row('Good at', (setup.talents || []).join(', ') || '—')}
            {row('Cares about', (setup.cares || []).join(', ') || '—')}
            {row('Tone', (setup.tone_tags || []).join(', ') || '—')}

            {/* Canon ledger lived here in v1.0.60 but moved to PreludeLorePanel
                in v1.0.75 for top-level access, search, and category grouping.
                Only the character setup details and emerging values stay in
                this panel — canon belongs in the Lore button. */}

            {/* Phase 3 — emergent values (accumulates during play). Raw scores
                shown while playing; narrative paragraph at prelude end (Phase 5). */}
            {values.length > 0 && (
              <div style={{ marginTop: '0.9rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(139,92,246,0.2)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#c4b5fd', fontSize: '0.9rem' }}>Emerging values</h4>
                <p style={{ ...descStyle, marginTop: 0, marginBottom: '0.5rem' }}>
                  What your choices have been revealing about who you're becoming. Positive scores = values you've leaned into; negative = values you've leaned away from.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.2rem 0.75rem' }}>
                  {values.map(v => (
                    <React.Fragment key={v.value}>
                      <span style={{ color: '#ddd', fontSize: '0.82rem' }}>{v.value.replace(/_/g, ' ')}</span>
                      <span style={{
                        color: v.score >= 3 ? '#86efac' : v.score > 0 ? '#c4b5fd' : v.score < -2 ? '#fca5a5' : '#9fa3a8',
                        fontSize: '0.82rem',
                        fontFamily: 'monospace',
                        textAlign: 'right',
                        fontWeight: 600
                      }}>{v.score > 0 ? '+' : ''}{v.score}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Message scroller (v1.0.83 — inside the fixed-width play area) */}
      <div
        ref={scrollerRef}
        style={{
          minHeight: '60vh',
          maxHeight: '70vh',
          overflowY: 'auto',
          padding: '0.5rem 0.25rem',
          marginBottom: '1rem'
        }}
      >
        {messages.map((m, i) => {
          // Quiet notice pill — chapter advances, age advances, HP deltas
          if (m.role === 'notice') {
            return (
              <div key={i} style={{
                textAlign: 'center',
                margin: '0.4rem 0',
                padding: '0.25rem 0.5rem',
                fontSize: '0.72rem',
                color: '#9fa3a8',
                fontFamily: 'monospace',
                letterSpacing: '0.05em'
              }}>
                {m.content}
              </div>
            )
          }
          return (
            <div key={i}>
              <div
                style={{
                  marginBottom: '1rem',
                  padding: m.role === 'user' ? '0.6rem 0.85rem' : '0.75rem 1rem',
                  background: m.role === 'user' ? 'rgba(52,152,219,0.1)' : 'rgba(139,92,246,0.08)',
                  border: m.role === 'user' ? '1px solid rgba(52,152,219,0.25)' : '1px solid rgba(139,92,246,0.25)',
                  borderRadius: '8px',
                  fontSize: m.role === 'user' ? '0.9rem' : '0.92rem',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  color: m.role === 'user' ? '#9cc7ee' : '#e4e4e4'
                }}
              >
                {m.role === 'user' && (
                  <div style={{ fontSize: '0.72rem', color: '#60a5fa', marginBottom: '0.25rem', fontWeight: 600 }}>You</div>
                )}
                {m.content}
              </div>
              {/* v1.0.67 — Rule 2 violation warning badge. Surfaces when the
                  server-side detector catches quoted dialogue attributed to
                  the player character. The server already queued a correction
                  [SYSTEM NOTE] for the next turn; this badge just makes the
                  violation visible to the player so they know to disregard
                  the offending passage. */}
              {m.rule2Violation && (
                <div style={{
                  margin: '-0.5rem 0 1rem',
                  padding: '0.6rem 0.85rem',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.5)',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  color: '#fca5a5',
                  lineHeight: 1.4
                }}>
                  <div style={{ fontWeight: 700, color: '#fca5a5', marginBottom: '0.25rem' }}>
                    ⚠ Rule violation flagged
                  </div>
                  <div style={{ color: '#fecaca' }}>
                    The DM wrote dialogue or reaction attributed to your character. Disregard that passage — your character has not spoken or reacted. The DM has been notified and will correct on the next turn.
                  </div>
                </div>
              )}
              {/* v1.0.77 — theme commitment card (Ch3 wrap-up). */}
              {m.themeCommitmentOffer && (
                <PreludeThemeCommitCard
                  characterId={character?.id}
                  offer={m.themeCommitmentOffer}
                  onCommit={({ theme }) => {
                    if (theme) {
                      setSessionSummary(prev => ({ ...prev, themeCommitted: theme }))
                    }
                  }}
                />
              )}
              {/* Phase 3 — emergence offer cards. Stat/skill hints get
                  accept / not now / never buttons. Class/theme/ancestry
                  hints are tallied silently server-side (no card needed). */}
              {Array.isArray(m.offeredEmergences) && m.offeredEmergences.map(e => (
                <div key={e.emergenceId} style={{
                  margin: '0 0 1rem',
                  padding: '0.85rem 1rem',
                  background: e._resolved === 'accepted' ? 'rgba(16,185,129,0.1)' :
                              e._resolved ? 'rgba(107,114,128,0.08)' : 'rgba(245,158,11,0.08)',
                  border: e._resolved === 'accepted' ? '1px solid rgba(16,185,129,0.4)' :
                          e._resolved ? '1px solid rgba(107,114,128,0.3)' : '1px solid rgba(245,158,11,0.4)',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                    ✦ EMERGENCE OFFER
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#e4e4e4' }}>
                    {e.kind === 'stat' && (
                      <>Your <strong style={{ color: '#fbbf24' }}>{e.stat.toUpperCase()}</strong> has shown pressure — take <strong style={{ color: '#86efac' }}>+{e.magnitude}</strong>?</>
                    )}
                    {e.kind === 'skill' && (
                      <>You've earned a pull toward <strong style={{ color: '#fbbf24' }}>{e.skill.replace(/_/g, ' ')}</strong>. Take it as proficiency?</>
                    )}
                  </p>
                  {e.reason && (
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#bbb', fontStyle: 'italic' }}>
                      {e.reason}
                    </p>
                  )}
                  {!e._resolved && (
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                      <button
                        onClick={() => handleEmergenceDecision(e.emergenceId, 'accept')}
                        style={{ padding: '0.35rem 0.8rem', background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: '#86efac', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                      >
                        ✓ Accept
                      </button>
                      <button
                        onClick={() => handleEmergenceDecision(e.emergenceId, 'decline')}
                        style={{ padding: '0.35rem 0.8rem', background: 'rgba(107,114,128,0.2)', border: '1px solid #6b7280', color: '#d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' }}
                      >
                        Not now
                      </button>
                      <button
                        onClick={() => handleEmergenceDecision(e.emergenceId, 'never')}
                        style={{ padding: '0.35rem 0.8rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' }}
                      >
                        Never offer
                      </button>
                    </div>
                  )}
                  {e._resolved === 'accepted' && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#86efac', fontWeight: 600 }}>✓ Accepted</p>
                  )}
                  {e._resolved === 'declined' && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#9fa3a8' }}>Declined (may be offered again)</p>
                  )}
                  {e._resolved === 'declined_permanently' && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#fca5a5' }}>Declined permanently</p>
                  )}
                </div>
              ))}

              {/* Chapter-promise beat — at the opening of chapters 3/4, the AI
                  surfaces the thematic question. Render as a distinct card so
                  the player knows to respond to it. */}
              {m.chapterPromise && (
                <div style={{
                  margin: '0 0 1rem',
                  padding: '0.9rem 1rem',
                  background: 'rgba(192,132,252,0.1)',
                  border: '1px dashed rgba(192,132,252,0.5)',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                    ✦ CHAPTER {runtime.chapter} PROMISE
                  </div>
                  {m.chapterPromise.theme && (
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#e9d5ff', fontStyle: 'italic' }}>
                      This chapter feels like it's about <strong style={{ fontStyle: 'normal' }}>{m.chapterPromise.theme}</strong>.
                    </p>
                  )}
                  {m.chapterPromise.question && (
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#c4b5fd' }}>
                      {m.chapterPromise.question}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {sending && (
          <div style={{
            padding: '0.75rem 1rem',
            color: '#9fa3a8',
            fontStyle: 'italic',
            fontSize: '0.88rem'
          }}>
            The story unfolds… <span style={{ fontFamily: 'monospace', color: '#c4b5fd' }}>({elapsed}s)</span>
          </div>
        )}
      </div>

      {error && messages.length > 0 && (
        <p style={{ color: '#fca5a5', marginBottom: '0.5rem', fontSize: '0.85rem' }}>{error}</p>
      )}

      {/* v1.0.78 — Session wrap-up screen. Expanded from the old single-
          banner into a structured recap with progress bar, session-
          highlights section, cliffhanger, and action buttons. */}
      {sessionEnded && (
        <div style={{
          padding: '1.25rem 1.3rem',
          background: 'rgba(139,92,246,0.12)',
          border: '1px solid rgba(139,92,246,0.5)',
          borderRadius: '10px',
          marginBottom: '1rem'
        }}>
          {/* Header + progress bar */}
          <p style={{ margin: 0, fontSize: '1.05rem', color: '#e9d5ff', fontWeight: 700 }}>
            ✦ Session {sessionNum} of 5 complete
          </p>
          <p style={{ margin: '0.25rem 0 0.6rem', fontSize: '0.8rem', color: '#9fa3a8' }}>
            Chapter {runtime.chapter} of 4 · {chapterName} · Age {runtime.age}
          </p>
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '1rem',
            height: '8px'
          }}>
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} style={{
                flex: 1,
                background: n <= sessionNum ? '#a78bfa' : 'rgba(167,139,250,0.18)',
                borderRadius: '3px'
              }} />
            ))}
          </div>

          {/* AI-generated prose recap (v1.0.55) */}
          {sessionRecap && (
            <div style={{ margin: '0 0 0.85rem', padding: '0.75rem 0.9rem', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', borderLeft: '3px solid #a78bfa' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#a78bfa', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                SESSION {sessionNum} RECAP
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#ddd', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {sessionRecap}
              </p>
            </div>
          )}

          {/* v1.0.78 — Session highlights ("what happened mechanically").
              Accumulated client-side from per-turn marker payloads. Only
              renders sections that have something to show. */}
          {(() => {
            const s = sessionSummary
            const hasAny =
              s.emergencesAccepted.length > 0 ||
              s.canonFactsAdded.length > 0 ||
              s.npcsCanonized.length > 0 ||
              s.locationsCanonized.length > 0 ||
              s.totalHpDelta !== 0 ||
              s.chapterAdvanced ||
              s.ageAdvanced ||
              s.themeCommitted
            if (!hasAny) return null
            return (
              <div style={{ margin: '0 0 0.85rem', padding: '0.75rem 0.9rem', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', borderLeft: '3px solid #fbbf24' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  SESSION HIGHLIGHTS
                </p>

                {s.themeCommitted && (
                  <div style={{ marginBottom: '0.4rem', fontSize: '0.85rem', color: '#e4e4e4' }}>
                    ⚑ <strong style={{ color: '#c4b5fd' }}>Path chosen:</strong> {s.themeCommitted.replace(/_/g, ' ')}
                  </div>
                )}

                {s.chapterAdvanced && (
                  <div style={{ marginBottom: '0.4rem', fontSize: '0.85rem', color: '#e4e4e4' }}>
                    ↑ <strong style={{ color: '#86efac' }}>Chapter {s.chapterAdvanced.from} → {s.chapterAdvanced.to}</strong>
                  </div>
                )}

                {s.ageAdvanced && (
                  <div style={{ marginBottom: '0.4rem', fontSize: '0.85rem', color: '#e4e4e4' }}>
                    ⏳ <strong style={{ color: '#86efac' }}>
                      +{s.ageAdvanced.years} year{s.ageAdvanced.years === 1 ? '' : 's'} — age {s.ageAdvanced.to}
                    </strong>
                  </div>
                )}

                {s.emergencesAccepted.length > 0 && (
                  <div style={{ marginBottom: '0.4rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#c4b5fd', marginBottom: '0.2rem' }}>✦ Emergences accepted</div>
                    {s.emergencesAccepted.map((e, i) => (
                      <div key={i} style={{ fontSize: '0.82rem', color: '#ddd', marginLeft: '0.8rem', lineHeight: 1.4 }}>
                        {e.kind === 'stat' && <>• <strong>{String(e.target).toUpperCase()}</strong> +{e.magnitude}{e.reason ? <span style={{ color: '#9fa3a8', fontStyle: 'italic' }}> — {e.reason}</span> : null}</>}
                        {e.kind === 'skill' && <>• <strong>{String(e.target).replace(/_/g, ' ')}</strong> (skill){e.reason ? <span style={{ color: '#9fa3a8', fontStyle: 'italic' }}> — {e.reason}</span> : null}</>}
                      </div>
                    ))}
                  </div>
                )}

                {s.npcsCanonized.length > 0 && (
                  <div style={{ marginBottom: '0.4rem', fontSize: '0.82rem', color: '#ddd' }}>
                    <span style={{ color: '#c4b5fd' }}>👥 Met:</span>{' '}
                    {s.npcsCanonized.map(n => `${n.name}${n.relationship ? ` (${n.relationship})` : ''}`).join(', ')}
                  </div>
                )}

                {s.locationsCanonized.length > 0 && (
                  <div style={{ marginBottom: '0.4rem', fontSize: '0.82rem', color: '#ddd' }}>
                    <span style={{ color: '#c4b5fd' }}>🗺️ Places named:</span>{' '}
                    {s.locationsCanonized.map(l => l.name).join(', ')}
                  </div>
                )}

                {s.canonFactsAdded.length > 0 && (
                  <div style={{ marginBottom: '0.4rem', fontSize: '0.82rem', color: '#ddd' }}>
                    <span style={{ color: '#c4b5fd' }}>📜 Canon facts added:</span>{' '}
                    <span style={{ color: '#e4e4e4' }}>{s.canonFactsAdded.length}</span>
                    <span style={{ color: '#9fa3a8', fontSize: '0.78rem' }}> (see Lore panel for full ledger)</span>
                  </div>
                )}

                {s.totalHpDelta !== 0 && (
                  <div style={{ marginBottom: '0.4rem', fontSize: '0.82rem', color: '#ddd' }}>
                    <span style={{ color: '#c4b5fd' }}>💔 Net HP change:</span>{' '}
                    <span style={{ color: s.totalHpDelta > 0 ? '#86efac' : '#fca5a5' }}>
                      {s.totalHpDelta > 0 ? `+${s.totalHpDelta}` : s.totalHpDelta}
                    </span>
                    {s.hpReasons.length > 0 && (
                      <span style={{ color: '#9fa3a8', fontSize: '0.78rem', fontStyle: 'italic' }}> — {s.hpReasons.slice(-3).join('; ')}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Cliffhanger (unchanged position) */}
          {lastCliffhanger && (
            <div style={{ margin: '0 0 0.85rem', padding: '0.65rem 0.9rem', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', borderLeft: '3px solid #c4b5fd' }}>
              <div style={{ fontSize: '0.72rem', color: '#c4b5fd', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                CARRIED FORWARD
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#ddd', fontStyle: 'italic', lineHeight: 1.5 }}>
                {lastCliffhanger}
              </p>
            </div>
          )}

          <p style={{ margin: '0.5rem 0 0.75rem', fontSize: '0.8rem', color: '#9fa3a8' }}>
            {sessionNum < 5
              ? `Ready for Session ${sessionNum + 1} of 5? Or pick this up later from the character list.`
              : 'This is the final session of the prelude — the arc approaches the Threshold.'}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleResumeSession} className="button" style={{ background: '#8b5cf6', color: '#fff', flex: 1 }}>
              ▶ Begin Session {sessionNum + 1}
            </button>
            <button onClick={onBack} className="button" style={{ background: '#95a5a6', flex: 1 }}>
              Back to characters
            </button>
          </div>
        </div>
      )}

      {/* Action input */}
      {!sessionEnded && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <textarea
            value={action}
            onChange={e => setAction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you do? (Enter to send, Shift+Enter for a new line. Describe your action; roll dice physically and tell the AI the number.)"
            disabled={sending}
            rows={3}
            style={{
              flex: 1,
              padding: '0.6rem 0.8rem',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              color: '#e4e4e4',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              resize: 'vertical',
              minHeight: '60px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !action.trim()}
            style={{
              padding: '0.6rem 1.2rem',
              background: sending || !action.trim() ? '#6b7280' : '#8b5cf6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: sending || !action.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              alignSelf: 'stretch'
            }}
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      )}

        </div>{/* /play area wrapper */}

        {/* v1.0.83 — Lore panel popout. Sibling of the fixed-width play
            area. When Lore is toggled off, the play area centers alone.
            When on, both center together as a unit; play area keeps its
            width and Lore appears to its right. */}
        {showLore && (
          <div style={{ width: `${SIDE_PANEL_WIDTH}px`, flexShrink: 0 }}>
            <PreludeLorePanel
              characterId={character?.id}
              visible={showLore}
              onClose={() => setShowLore(false)}
              docked={true}
            />
          </div>
        )}
      </div>{/* /flex row */}
    </div>
  )
}
