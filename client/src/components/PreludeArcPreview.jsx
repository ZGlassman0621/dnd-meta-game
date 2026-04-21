import { useEffect, useState } from 'react'

/**
 * Post-setup arc preview.
 *
 * Renders the Opus-generated arc plan for a prelude-phase character and lets
 * the player re-roll once if it doesn't land. This is the bridge between the
 * 12-question setup (PreludeSetupWizard) and gameplay (PreludeSession, Phase 2b+).
 *
 * Flow:
 *   1. Mount: try GET /api/prelude/:id/arc-plan. If 404, generate via
 *      POST /api/prelude/:id/arc-plan.
 *   2. Render the home, four chapters, recurring threads, and trajectory.
 *   3. Allow one re-roll (driven by server-side cap) via
 *      POST /api/prelude/:id/arc-plan?regenerate=1.
 *   4. "Begin the prelude" — Phase 2a stops here and returns to the
 *      character list. Phase 2b wires this button to session start.
 */
export default function PreludeArcPreview({ character, onReturn, onBegin }) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Tick an elapsed-seconds counter while a network call is in flight so
  // the player sees real progress instead of a guessed static estimate.
  useEffect(() => {
    const busy = loading || regenerating
    if (!busy) {
      setElapsed(0)
      return
    }
    const start = Date.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 500)
    return () => clearInterval(id)
  }, [loading, regenerating])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        // Try to fetch existing plan first — avoids regenerating on remount.
        let resp = await fetch(`/api/prelude/${character.id}/arc-plan`)
        if (resp.status === 404) {
          // First-time generate (NOT a re-roll — regenerate_count stays at 0)
          resp = await fetch(`/api/prelude/${character.id}/arc-plan`, { method: 'POST' })
        }
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}))
          throw new Error(body.error || `Server error (${resp.status})`)
        }
        const data = await resp.json()
        if (!cancelled) setPlan(data)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [character.id])

  const handleReroll = async () => {
    if (!confirm('Re-roll the arc? You only get one re-roll per character.')) return
    setRegenerating(true)
    setError('')
    try {
      const resp = await fetch(`/api/prelude/${character.id}/arc-plan?regenerate=1`, { method: 'POST' })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.error || `Server error (${resp.status})`)
      }
      const data = await resp.json()
      setPlan(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setRegenerating(false)
    }
  }

  // ---- Layout helpers ----------------------------------------------------

  const card = {
    padding: '1rem',
    background: 'rgba(139,92,246,0.08)',
    border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: '8px',
    marginBottom: '1rem'
  }
  const chapterCard = {
    padding: '0.9rem 1rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(139,92,246,0.2)',
    borderRadius: '6px',
    marginBottom: '0.75rem'
  }
  const heading = { margin: '0 0 0.5rem 0', color: '#c4b5fd', fontSize: '1rem' }
  const theme = { color: '#e9d5ff', fontStyle: 'italic', marginBottom: '0.5rem', fontSize: '0.9rem' }
  const beat = { fontSize: '0.85rem', color: '#ccc', marginBottom: '0.4rem', lineHeight: 1.5 }
  const beatTitle = { fontWeight: 600, color: '#a78bfa' }
  const sub = { fontSize: '0.75rem', color: '#9fa3a8', fontStyle: 'italic', lineHeight: 1.4 }

  // Wrap the preview in an outer-centering shell so the 780px max-width is
  // horizontally centered inside the 1200px .app container. Without this, the
  // preview would hug the left edge.
  const shellStyle = { maxWidth: '780px', margin: '0 auto' }

  if (loading) {
    return (
      <div className="container" style={{ ...shellStyle, textAlign: 'center', padding: '3rem 1rem' }}>
        <h2 style={{ color: '#a78bfa', margin: 0 }}>Shaping the arc…</h2>
        <p style={{ color: '#bbb', marginTop: '0.5rem' }}>
          Opus is drawing the thread of {character.nickname || character.first_name || character.name}'s childhood. Typical: 45-90 seconds.
        </p>
        <p style={{ color: '#c4b5fd', marginTop: '0.75rem', fontSize: '1.1rem', fontFamily: 'monospace' }}>
          {elapsed}s elapsed
        </p>
      </div>
    )
  }

  if (error && !plan) {
    return (
      <div className="container" style={shellStyle}>
        <h2 style={{ color: '#f87171' }}>Couldn't generate the arc</h2>
        <p style={{ color: '#fca5a5', fontSize: '0.9rem' }}>{error}</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="button" onClick={onReturn} style={{ flex: 1, background: '#95a5a6' }}>Back to characters</button>
          <button className="button" onClick={() => window.location.reload()} style={{ flex: 1, background: '#8b5cf6', color: '#fff' }}>Retry</button>
        </div>
      </div>
    )
  }

  if (!plan) return null

  const chapters = [
    { n: 1, name: 'Early Childhood (ages 5-8)', arc: plan.chapter_1_arc },
    { n: 2, name: 'Middle Childhood (9-12)', arc: plan.chapter_2_arc },
    { n: 3, name: 'Adolescence (13-16)', arc: plan.chapter_3_arc },
    { n: 4, name: 'Threshold (17-21)', arc: plan.chapter_4_arc }
  ]

  return (
    <div className="container" style={shellStyle}>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#a78bfa' }}>
          ✦ The Arc of {character.nickname || character.first_name || character.name}
        </h2>
        <p style={{ color: '#bbb', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          A seven-to-ten-session shape for your character's first twenty years. The beats here are <em>reference</em> —
          your choices in play will bend them.
        </p>
      </div>

      {/* Home world */}
      {plan.home_world && (
        <div style={card}>
          <h3 style={heading}>Home</h3>
          <p style={{ ...beat, color: '#ddd' }}>{plan.home_world.description}</p>

          {Array.isArray(plan.home_world.locals) && plan.home_world.locals.length > 0 && (
            <>
              <p style={{ ...heading, fontSize: '0.85rem', marginTop: '0.75rem' }}>People you know</p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                {plan.home_world.locals.map((l, i) => (
                  <li key={i} style={{ ...beat, marginBottom: '0.25rem' }}>
                    <span style={beatTitle}>{l.name}</span>
                    {l.role && <span style={{ color: '#a78bfa', marginLeft: '0.35rem' }}>({l.role})</span>}
                    {l.description && <span style={{ color: '#bbb' }}> — {l.description}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {Array.isArray(plan.home_world.tensions) && plan.home_world.tensions.length > 0 && (
            <>
              <p style={{ ...heading, fontSize: '0.85rem', marginTop: '0.6rem' }}>Tensions</p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                {plan.home_world.tensions.map((t, i) => (
                  <li key={i} style={{ ...beat, color: '#bbb' }}>{t}</li>
                ))}
              </ul>
            </>
          )}

          {Array.isArray(plan.home_world.threats) && plan.home_world.threats.length > 0 && (
            <>
              <p style={{ ...heading, fontSize: '0.85rem', marginTop: '0.6rem' }}>Threats</p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                {plan.home_world.threats.map((t, i) => (
                  <li key={i} style={{ ...beat, color: '#bbb' }}>{t}</li>
                ))}
              </ul>
            </>
          )}

          {plan.home_world.mentor_possibility && (
            <div style={{ marginTop: '0.75rem', padding: '0.6rem', background: 'rgba(192,132,252,0.12)', border: '1px dashed rgba(192,132,252,0.4)', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#e9d5ff' }}>
                <strong>Mentor possibility:</strong> {plan.home_world.mentor_possibility.name}
                {plan.home_world.mentor_possibility.role && <span style={{ color: '#a78bfa' }}> — {plan.home_world.mentor_possibility.role}</span>}
              </p>
              {plan.home_world.mentor_possibility.why_they_matter && (
                <p style={{ ...sub, marginTop: '0.25rem' }}>{plan.home_world.mentor_possibility.why_they_matter}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chapters */}
      <div style={card}>
        <h3 style={heading}>Chapters</h3>
        {chapters.map(c => (
          <div key={c.n} style={chapterCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
              <strong style={{ color: '#a78bfa' }}>Chapter {c.n}</strong>
              <span style={{ color: '#9fa3a8', fontSize: '0.8rem' }}>{c.name}</span>
            </div>
            {c.arc?.theme && <p style={theme}>{c.arc.theme}</p>}
            {Array.isArray(c.arc?.beats) && c.arc.beats.length > 0 && (
              <ul style={{ margin: '0.3rem 0', paddingLeft: '1.2rem' }}>
                {c.arc.beats.map((b, i) => (
                  <li key={i} style={beat}>
                    {b.title && <span style={beatTitle}>{b.title}. </span>}
                    {b.description}
                  </li>
                ))}
              </ul>
            )}
            {c.arc?.chapter_end_moment && (
              <p style={{ ...sub, marginTop: '0.4rem' }}>
                <strong style={{ color: '#9fa3a8', fontStyle: 'normal' }}>Chapter close:</strong> {c.arc.chapter_end_moment}
              </p>
            )}
            {c.n === 4 && c.arc?.departure_seed && (
              <div style={{ marginTop: '0.5rem', padding: '0.55rem', background: 'rgba(139,92,246,0.1)', borderLeft: '3px solid #8b5cf6', borderRadius: '3px' }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#e9d5ff' }}>
                  <strong>Departure:</strong> {c.arc.departure_seed.reason}
                  {c.arc.departure_seed.tone && <span style={{ color: '#a78bfa' }}> — {c.arc.departure_seed.tone}</span>}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recurring threads */}
      {Array.isArray(plan.recurring_threads) && plan.recurring_threads.length > 0 && (
        <div style={card}>
          <h3 style={heading}>Recurring threads</h3>
          <p style={sub}>Threads that weave across chapters. Paying attention to these tends to pay off.</p>
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
            {plan.recurring_threads.map((t, i) => (
              <li key={i} style={beat}>
                <span style={beatTitle}>{t.name}</span>
                {t.description && <span style={{ color: '#bbb' }}> — {t.description}</span>}
                {Array.isArray(t.spans_chapters) && t.spans_chapters.length > 0 && (
                  <span style={{ color: '#9fa3a8', fontSize: '0.72rem', marginLeft: '0.4rem' }}>
                    (chapters {t.spans_chapters.join(', ')}{t.payoff_chapter ? `, payoff ch.${t.payoff_chapter}` : ''})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Character trajectory — shown softly; these are suggestions, not destiny */}
      {plan.character_trajectory && (
        <div style={{ ...card, background: 'rgba(192,132,252,0.06)' }}>
          <h3 style={heading}>Where the arc might lead</h3>
          <p style={sub}>These are suggestions. Actual class, theme, and ancestry-feat will emerge from what you play.</p>
          <p style={{ ...beat, marginTop: '0.5rem' }}>
            Class nudge: <strong style={{ color: '#a78bfa' }}>{plan.character_trajectory.suggested_class || '—'}</strong>
            {' · '}
            Theme nudge: <strong style={{ color: '#a78bfa' }}>{plan.character_trajectory.suggested_theme || '—'}</strong>
          </p>
          {plan.character_trajectory.why_class && (
            <p style={sub}><strong style={{ color: '#c4b5fd', fontStyle: 'normal' }}>Why class:</strong> {plan.character_trajectory.why_class}</p>
          )}
          {plan.character_trajectory.why_theme && (
            <p style={sub}><strong style={{ color: '#c4b5fd', fontStyle: 'normal' }}>Why theme:</strong> {plan.character_trajectory.why_theme}</p>
          )}
          {plan.character_trajectory.notes && <p style={sub}>{plan.character_trajectory.notes}</p>}
        </div>
      )}

      {error && (
        <p style={{ color: '#fca5a5', marginBottom: '0.75rem', fontSize: '0.9rem' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button
          className="button"
          onClick={onReturn}
          style={{ flex: 1, background: '#95a5a6' }}
        >
          Back to characters
        </button>
        {plan.can_regenerate && (
          <button
            className="button"
            onClick={handleReroll}
            disabled={regenerating}
            style={{
              flex: 1,
              background: regenerating ? '#6b7280' : 'rgba(139,92,246,0.2)',
              border: '1px solid #8b5cf6',
              color: '#c4b5fd'
            }}
            title="Use it if the arc doesn't land."
          >
            {regenerating ? 'Re-rolling…' : '↻ Re-roll'}
          </button>
        )}
        <button
          className="button"
          onClick={onBegin || onReturn}
          style={{
            flex: 2,
            background: '#8b5cf6',
            color: '#fff'
          }}
          title="Opens the first session. Opus writes the opening scene; Sonnet runs the gameplay."
        >
          Begin the Prelude →
        </button>
      </div>
    </div>
  )
}
