import { useEffect, useState } from 'react'

/**
 * Prelude transition screen — Phase 2 chunk 2.
 *
 * Renders after [PRELUDE_END] fires (or when re-entered from the
 * "Finish creating [name]" home-page card on resume). Surfaces a summary
 * of what the Prelude produced — biography seed entries, canon NPCs,
 * canon locations, canon threads, emergence summary, mentor imprint when
 * applicable.
 *
 * CTA: "Begin character creation" → launches the existing
 * `CharacterCreationWizard.jsx` with `preludePayload` prop populated
 * from `/api/prelude/:id/handoff-payload`. Per A2a option (iv): the
 * existing creator pre-fills what it can; chunk 5 (rebuilt creator)
 * will consume more of the payload.
 *
 * Resume semantics: hitting this screen on a 'ready_for_primary' character
 * never re-fires the transition — it only reads the persisted payload.
 * The transition itself was idempotent at the moment [PRELUDE_END] fired.
 */
export default function PreludeTransitionScreen({ character, onLaunchCreator, onCancel }) {
  const [payload, setPayload] = useState(null)
  const [biography, setBiography] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [pResp, bResp] = await Promise.all([
          fetch(`/api/prelude/${character.id}/handoff-payload`),
          fetch(`/api/prelude/${character.id}/biography`)
        ])
        if (!pResp.ok) {
          const body = await pResp.json().catch(() => ({}))
          throw new Error(body.error || `Could not load handoff payload (${pResp.status})`)
        }
        const p = await pResp.json()
        const b = bResp.ok ? (await bResp.json()).entries : []
        if (!cancelled) {
          setPayload(p)
          setBiography(b || [])
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [character.id])

  const card = {
    padding: '1rem',
    background: 'rgba(139,92,246,0.08)',
    border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: '8px',
    marginBottom: '1rem'
  }
  const heading = { margin: '0 0 0.5rem 0', color: '#c4b5fd', fontSize: '1rem' }
  const subheading = { margin: '0.4rem 0 0.3rem 0', color: '#a78bfa', fontSize: '0.85rem', fontWeight: 600 }
  const body = { fontSize: '0.88rem', color: '#ddd', lineHeight: 1.55 }
  const sub = { fontSize: '0.78rem', color: '#9fa3a8', fontStyle: 'italic', lineHeight: 1.45 }
  const shell = { maxWidth: '780px', margin: '0 auto' }

  if (loading) {
    return (
      <div className="container" style={{ ...shell, textAlign: 'center', padding: '3rem 1rem' }}>
        <h2 style={{ color: '#a78bfa', margin: 0 }}>Gathering everything that happened…</h2>
        <p style={{ color: '#bbb', marginTop: '0.5rem' }}>
          The biography is being seeded. This takes a few seconds.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container" style={{ ...shell, padding: '2rem 1rem' }}>
        <h2 style={{ color: '#fca5a5' }}>Couldn't load the transition</h2>
        <p style={{ color: '#bbb' }}>{error}</p>
        {onCancel && (
          <button type="button" onClick={onCancel} className="button" style={{ background: '#95a5a6' }}>
            Back
          </button>
        )}
      </div>
    )
  }

  const locked = payload?.locked || {}
  const suggested = payload?.suggested || {}
  const canon = payload?.canon || { npcs: [], locations: [], threads: [], fact_count: 0 }
  const displayName = character.nickname || character.first_name || character.name
  const totalStatBumps = Object.values(suggested.stat_bonuses || {}).reduce((a, b) => a + b, 0)

  return (
    <div className="container" style={{ ...shell, padding: '1rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0, color: '#a78bfa' }}>Your Prelude is Complete</h2>
        <p style={{ ...body, marginTop: '0.4rem' }}>
          {displayName} has reached the threshold of adulthood. What happened during the formative years lives in the world now —
          the people who shaped them, the places that mattered, the threads the world will remember.
          The next step is character creation — most of the work is done; you'll fill in the mechanics.
        </p>
      </div>

      {/* Biography */}
      <div style={card}>
        <h3 style={heading}>Biography (seed entries)</h3>
        {biography.length === 0 ? (
          <p style={sub}>(no biography entries on file — Opus generation may have failed silently; you can still proceed)</p>
        ) : (
          biography.map(entry => (
            <div key={entry.id} style={{ marginBottom: '0.6rem', borderLeft: '2px solid rgba(167,139,250,0.4)', paddingLeft: '0.7rem' }}>
              <div style={{ ...sub, marginBottom: '0.2rem' }}>
                {entry.origin_age != null ? `Age ${entry.origin_age}` : 'Age unspecified'}
                {entry.origin_chapter ? ` · Chapter ${entry.origin_chapter}` : ''}
              </div>
              <div style={body}>{entry.body}</div>
            </div>
          ))
        )}
      </div>

      {/* Canon NPCs */}
      <div style={card}>
        <h3 style={heading}>Canon — People ({canon.npcs.length})</h3>
        {canon.npcs.length === 0 ? (
          <p style={sub}>(no canonical NPCs recorded)</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {canon.npcs.map(n => (
              <li key={n.id} style={{ ...body, marginBottom: '0.25rem' }}>
                <strong>{n.name}</strong>
                {n.relationship ? <span style={{ color: '#a78bfa' }}> ({n.relationship})</span> : null}
                <span style={sub}> — {n.status || 'alive'}{n.age_at_prelude_end != null ? `, age ${n.age_at_prelude_end} at prelude end` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Canon locations */}
      <div style={card}>
        <h3 style={heading}>Canon — Places ({canon.locations.length})</h3>
        {canon.locations.length === 0 ? (
          <p style={sub}>(no canonical places recorded)</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {canon.locations.map(l => (
              <li key={l.id} style={{ ...body, marginBottom: '0.25rem' }}>
                <strong>{l.name}</strong>
                {l.is_home ? <span style={{ color: '#a78bfa' }}> [home]</span> : null}
                {l.type ? <span style={sub}> — {l.type}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Canon threads */}
      <div style={card}>
        <h3 style={heading}>Threads the world will hold ({canon.threads.length})</h3>
        <p style={sub}>
          Unresolved obligations the AI may resurface in the main campaign — sometimes years later. The world remembers.
        </p>
        {canon.threads.length === 0 ? (
          <p style={sub}>(no long-term threads emerged from this prelude)</p>
        ) : (
          <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.2rem' }}>
            {canon.threads.map(t => (
              <li key={t.id} style={{ ...body, marginBottom: '0.35rem' }}>
                <span style={{ color: '#c4b5fd', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em', marginRight: '0.5rem' }}>{t.weight}</span>
                <strong>{t.kind.replace(/_/g, ' ')}</strong>
                {t.subject_text ? <span style={sub}> — {t.subject_text}</span> : null}
                {t.condition ? <div style={{ ...sub, marginLeft: '0.2rem' }}>↳ ripens when: {t.condition}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Emergence summary */}
      <div style={card}>
        <h3 style={heading}>What emerged from play</h3>
        <p style={subheading}>Stat bonuses</p>
        <div style={body}>
          {totalStatBumps === 0 ? (
            <span style={sub}>none accepted</span>
          ) : (
            Object.entries(suggested.stat_bonuses || {})
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k.toUpperCase()} +${v}`)
              .join(', ')
          )}
        </div>
        <p style={subheading}>Skills emerged</p>
        <div style={body}>
          {(suggested.skills || []).length === 0 ? (
            <span style={sub}>none</span>
          ) : (
            (suggested.skills || []).join(', ')
          )}
        </div>
        <p style={subheading}>Trajectory leaders</p>
        <div style={body}>
          Theme committed: <strong>{locked.committed_theme || '(not committed)'}</strong>
          <span style={sub}> {/* preserve a leading space */}</span>
        </div>
        <div style={body}>
          Class trajectory: <strong>{suggested.class || '(undecided)'}</strong>
          {suggested.class_score != null ? <span style={sub}> ({suggested.class_score.toFixed(1)} pts)</span> : null}
        </div>
        <div style={body}>
          Ancestry feat trajectory: <strong>{locked.ancestry_feat_id || '(undecided)'}</strong>
          {suggested.ancestry_score != null ? <span style={sub}> ({suggested.ancestry_score.toFixed(1)} pts)</span> : null}
        </div>
      </div>

      {/* Mentor imprint surfacing */}
      {payload?.mentor_imprint_id && (
        <div style={card}>
          <h3 style={heading}>Mentor imprint seeded</h3>
          <p style={body}>
            Your authority figure during the Prelude was a mentor. Their relationship with you has been recorded —
            when the main campaign begins, they're already woven into the world with the history you played, not as a blank meet.
          </p>
        </div>
      )}

      {/* CTAs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} className="button" style={{ flex: 1, background: '#95a5a6' }}>
            Save and exit
          </button>
        )}
        <button
          type="button"
          onClick={() => onLaunchCreator && onLaunchCreator(payload)}
          className="button"
          style={{ flex: 2, background: '#8b5cf6', color: '#fff' }}
        >
          Begin character creation
        </button>
      </div>

      <p style={{ ...sub, textAlign: 'center', marginTop: '0.75rem' }}>
        Most of your character is decided. The next step fills in mechanics — ability scores, skills, equipment.
      </p>
    </div>
  )
}
