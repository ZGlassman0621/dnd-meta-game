import React, { useState, useEffect, useRef } from 'react'

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
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [showSetup, setShowSetup] = useState(false)
  const [values, setValues] = useState([])
  const [canonFacts, setCanonFacts] = useState([])
  const scrollerRef = useRef(null)

  // Fetch values + canon facts whenever the Setup panel opens, or after
  // a player turn (to reflect possible new facts/values from the last AI
  // response). Both endpoints are cheap.
  useEffect(() => {
    if (!showSetup || !character?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const [vResp, cResp] = await Promise.all([
          fetch(`/api/prelude/${character.id}/values`),
          fetch(`/api/prelude/${character.id}/canon-facts`)
        ])
        if (vResp.ok) {
          const data = await vResp.json()
          if (!cancelled) setValues(data)
        }
        if (cResp.ok) {
          const data = await cResp.json()
          if (!cancelled) setCanonFacts(data)
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
        body: JSON.stringify({ action: a })
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.error || `Server error (${resp.status})`)
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
      if (data.runtime) setRuntime(data.runtime)
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
    } catch (e) {
      setError(e.message)
    }
  }

  // ---- Render ------------------------------------------------------------

  const shellStyle = { maxWidth: '860px', margin: '0 auto' }

  if (loading) {
    // When the arc preview was skipped, this call generates the arc plan
    // AND the opening scene — can run 90-150s. When resuming or coming
    // from the arc preview, only the opening — 30-60s.
    return (
      <div className="container" style={{ ...shellStyle, textAlign: 'center', padding: '3rem 1rem' }}>
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
      <div className="container" style={shellStyle}>
        <h2 style={{ color: '#f87171' }}>Couldn't open the session</h2>
        <p style={{ color: '#fca5a5', fontSize: '0.9rem' }}>{error}</p>
        <button className="button" onClick={onBack} style={{ background: '#95a5a6' }}>Back to characters</button>
      </div>
    )
  }

  const chapterName = ['', 'Early Childhood', 'Middle Childhood', 'Adolescence', 'Threshold'][runtime.chapter] || '?'
  const sessionNum = runtime.sessionNumber || 1

  return (
    <div className="container" style={shellStyle}>
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
            ✦ {character.nickname || character.first_name || character.name}'s Prelude
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#bbb' }}>
            Session {sessionNum} · Chapter {runtime.chapter} of 4 — <em>{chapterName}</em> · Age {runtime.age}
            {runtime.currentHp != null && runtime.maxHp != null && (
              <span style={{
                marginLeft: '0.75rem',
                color: runtime.currentHp <= 0 ? '#f87171' : runtime.currentHp < runtime.maxHp / 2 ? '#fbbf24' : '#86efac',
                fontFamily: 'monospace',
                fontWeight: 600
              }}>
                HP {runtime.currentHp}/{runtime.maxHp}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setShowSetup(s => !s)} style={{
            padding: '0.4rem 0.8rem',
            background: showSetup ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.1)',
            border: '1px solid rgba(139,92,246,0.4)',
            color: '#c4b5fd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.82rem'
          }}>{showSetup ? 'Hide setup' : 'Setup'}</button>
          <button onClick={handleEndSession} disabled={sessionEnded} style={{
            padding: '0.4rem 0.8rem',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.4)',
            color: sessionEnded ? '#6b7280' : '#fca5a5',
            borderRadius: '4px',
            cursor: sessionEnded ? 'not-allowed' : 'pointer',
            fontSize: '0.82rem'
          }}>End session</button>
          <button onClick={onBack} style={{
            padding: '0.4rem 0.8rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.82rem'
          }}>Characters</button>
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

            {/* v1.0.60 — canon ledger. Shows the ground truth Sonnet sees
                every turn. Useful to verify drift hasn't happened ("did
                Sonnet register Moss is 9?") and to trace what the AI has
                established. Grouped by category. */}
            {canonFacts.length > 0 && (() => {
              const byCategory = new Map()
              for (const f of canonFacts) {
                if (!byCategory.has(f.category)) byCategory.set(f.category, [])
                byCategory.get(f.category).push(f)
              }
              const CATEGORY_ORDER = ['npc', 'relationship', 'trait', 'location', 'item', 'event']
              const CATEGORY_LABELS = {
                npc: 'People', relationship: 'Relationships', trait: 'Traits',
                location: 'Places', item: 'Items', event: 'Events'
              }
              return (
                <div style={{ marginTop: '0.9rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(139,92,246,0.2)' }}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#c4b5fd', fontSize: '0.9rem' }}>Canon ledger</h4>
                  <p style={{ ...descStyle, marginTop: 0, marginBottom: '0.5rem' }}>
                    What the AI has registered as ground truth. Re-checked every turn to prevent drift.
                  </p>
                  {CATEGORY_ORDER.filter(c => byCategory.has(c)).map(cat => (
                    <div key={cat} style={{ marginBottom: '0.55rem' }}>
                      <div style={{ fontSize: '0.72rem', color: '#a78bfa', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                        {CATEGORY_LABELS[cat] || cat.toUpperCase()}
                      </div>
                      {byCategory.get(cat).map(f => (
                        <div key={f.id} style={{ fontSize: '0.78rem', color: '#ddd', lineHeight: 1.45, marginBottom: '0.15rem', paddingLeft: '0.5rem' }}>
                          <strong style={{ color: '#e9d5ff' }}>{f.subject}:</strong> {f.fact}
                          {f.established_age != null && (
                            <span style={{ color: '#6b7280', fontSize: '0.7rem', marginLeft: '0.4rem' }}>
                              (est. age {f.established_age})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )
            })()}

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

      {/* Message scroller */}
      <div
        ref={scrollerRef}
        style={{
          maxHeight: '60vh',
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

      {/* Session ended banner */}
      {sessionEnded && (
        <div style={{
          padding: '1rem 1.1rem',
          background: 'rgba(139,92,246,0.12)',
          border: '1px solid rgba(139,92,246,0.5)',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <p style={{ margin: 0, fontSize: '1rem', color: '#e9d5ff', fontWeight: 700 }}>
            ✦ Session {sessionNum} complete
          </p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#9fa3a8' }}>
            (Chapter {runtime.chapter} of 4 · {chapterName} · Age {runtime.age} · ~7-10 sessions total in a prelude)
          </p>
          {sessionRecap && (
            <div style={{ margin: '0.75rem 0 0', padding: '0.75rem 0.9rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', borderLeft: '3px solid #a78bfa' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#a78bfa', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                SESSION {sessionNum} RECAP
              </p>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#ddd', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {sessionRecap}
              </p>
            </div>
          )}
          {lastCliffhanger && (
            <p style={{ margin: '0.55rem 0 0', fontSize: '0.88rem', color: '#ddd', fontStyle: 'italic', lineHeight: 1.45 }}>
              <strong style={{ color: '#c4b5fd', fontStyle: 'normal' }}>Carried forward:</strong> {lastCliffhanger}
            </p>
          )}
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#9fa3a8' }}>
            {sessionNum < 10
              ? `Ready for Session ${sessionNum + 1}? Or pick this up later from the character list.`
              : 'This is a late session — the arc may be approaching the Threshold.'}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
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
    </div>
  )
}
