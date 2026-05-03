import { useEffect, useState } from 'react'

/**
 * Post-setup arc preview.
 *
 * Renders the Opus-generated arc plan for a prelude-phase character and lets
 * the player re-roll once if it doesn't land. This is the bridge between the
 * setup wizard (PreludeSetupWizard) and gameplay (PreludeSession).
 *
 * Phase 2 close-out (2026-05-03): editorial reskin per PM Medium-tier ruling.
 * Token swap from slate purple to `.creator-v2` editorial — second of two
 * surfaces in the prelude entry path that needed reskinning so the player
 * walking from HomeScreenV2 → PathChoiceScreen → PreludeSetupWizard →
 * PreludeArcPreview registers no visual seam at the transitions. PreludeSession
 * (the play loop) stays slate per scope ruling; parked.
 *
 * Flow:
 *   1. Mount: try GET /api/prelude/:id/arc-plan. If 404, generate via
 *      POST /api/prelude/:id/arc-plan.
 *   2. Render the home, four chapters, recurring threads, and trajectory.
 *   3. Allow one re-roll (driven by server-side cap) via
 *      POST /api/prelude/:id/arc-plan?regenerate=1.
 *   4. "Begin the prelude" hands off to the session loop.
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

  const characterDisplayName = character.nickname || character.first_name || character.name

  // ============== Loading state ==============
  if (loading) {
    return (
      <div className="creator-v2">
        <div className="appbar">
          <div className="brand">
            D <span className="amp">&amp;</span> D
            <span style={{ color: 'var(--ink-3)', fontStyle: 'normal', marginLeft: 6 }}>· Character Creator</span>
          </div>
          <div className="crumbs">Prelude · arc preview</div>
          <div className="spacer" />
        </div>
        <div className="stage">
          <div className="frame" style={{ textAlign: 'center', paddingTop: 80 }}>
            <h1 className="h-step">Shaping the arc…</h1>
            <p className="lede" style={{ marginTop: 16, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
              Opus is drawing the thread of {characterDisplayName}'s childhood. Typical: 45–90 seconds.
            </p>
            <p style={{ marginTop: 32, fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              {elapsed}s elapsed
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ============== Error-only state (no plan) ==============
  if (error && !plan) {
    return (
      <div className="creator-v2">
        <div className="appbar">
          <div className="brand">
            D <span className="amp">&amp;</span> D
            <span style={{ color: 'var(--ink-3)', fontStyle: 'normal', marginLeft: 6 }}>· Character Creator</span>
          </div>
          <div className="crumbs">Prelude · arc preview</div>
          <div className="spacer" />
        </div>
        <div className="stage">
          <div className="frame">
            <h1 className="h-step">Couldn't generate the arc</h1>
            <div
              role="alert"
              style={{
                marginTop: 24,
                padding: '14px 18px',
                background: 'var(--bg-2)',
                border: '1px solid var(--accent)',
                borderLeft: '3px solid var(--accent)',
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 16,
                color: 'var(--ink-2)'
              }}
            >
              {error}
            </div>
            <div className="wizard-foot">
              <button type="button" className="btn ghost" onClick={onReturn}>← Back to characters</button>
              <div className="spacer" />
              <button type="button" className="btn primary lg" onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          </div>
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

  // Inline style helpers — repeated structures expressed as constants for
  // readability. All references resolve against the .creator-v2 token set.
  const chapterCardStyle = {
    padding: '18px 22px',
    background: 'var(--bg-2)',
    border: '1px solid var(--rule-soft)',
    marginBottom: 14
  }
  const sectionLabelStyle = {
    fontFamily: 'var(--sans)',
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--ink-3)',
    fontWeight: 500,
    marginTop: 16,
    marginBottom: 8
  }
  const beatItemStyle = {
    fontFamily: 'var(--serif)',
    fontSize: 16,
    lineHeight: 1.55,
    color: 'var(--ink-2)',
    marginBottom: 6
  }
  const beatTitleStyle = {
    fontStyle: 'normal',
    fontWeight: 600,
    color: 'var(--ink)'
  }
  const subStyle = {
    fontFamily: 'var(--serif)',
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 1.5,
    color: 'var(--ink-3)'
  }

  return (
    <div className="creator-v2">
      <div className="appbar">
        <div className="brand">
          D <span className="amp">&amp;</span> D
          <span style={{ color: 'var(--ink-3)', fontStyle: 'normal', marginLeft: 6 }}>· Character Creator</span>
        </div>
        <div className="crumbs">Prelude · arc preview</div>
        <div className="spacer" />
      </div>

      <div className="stage">
        <div className="frame">
          {/* Header */}
          <div className="wizard-head">
            <div className="step-title">
              <div className="eyebrow step-label">Prelude character · arc preview</div>
              <h1 className="h-step" style={{ marginTop: 8 }}>
                The Arc of {characterDisplayName}
              </h1>
              <p className="lede" style={{ marginTop: 12, maxWidth: 720 }}>
                A five-session shape for your character's first twenty years. The beats here are <em>reference</em> —
                your choices in play will bend them.
              </p>
            </div>
          </div>

          {/* Tone card removed in Phase 2 (chunk 1). Tone presets were cut per
              DECISION_LOG 2026-04-30 Decision A; the locked tone description
              lives in preludePromptBuilder.js (chunk 3) and is no longer
              surfaced in this UI. Old prelude characters (with tone_tags in
              their setup blob) silently lose this card; intentional. */}

          {/* Home world */}
          {plan.home_world && (
            <div className="card" style={{ marginBottom: 18 }}>
              <h2 className="h-section">Home</h2>
              <p style={{
                fontFamily: 'var(--serif)',
                fontSize: 17,
                lineHeight: 1.55,
                color: 'var(--ink-2)',
                marginTop: 12,
                marginBottom: 0
              }}>
                {plan.home_world.description}
              </p>

              {Array.isArray(plan.home_world.locals) && plan.home_world.locals.length > 0 && (
                <>
                  <div style={sectionLabelStyle}>People you know</div>
                  <ul style={{ margin: 0, paddingLeft: 22 }}>
                    {plan.home_world.locals.map((l, i) => (
                      <li key={i} style={beatItemStyle}>
                        <span style={beatTitleStyle}>{l.name}</span>
                        {l.role && (
                          <span style={{ color: 'var(--accent)', marginLeft: 6, fontFamily: 'var(--sans)', fontSize: 12, letterSpacing: '0.04em' }}>
                            ({l.role})
                          </span>
                        )}
                        {l.description && <span style={{ color: 'var(--ink-2)' }}> — {l.description}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {Array.isArray(plan.home_world.tensions) && plan.home_world.tensions.length > 0 && (
                <>
                  <div style={sectionLabelStyle}>Tensions</div>
                  <ul style={{ margin: 0, paddingLeft: 22 }}>
                    {plan.home_world.tensions.map((t, i) => (
                      <li key={i} style={beatItemStyle}>{t}</li>
                    ))}
                  </ul>
                </>
              )}

              {Array.isArray(plan.home_world.threats) && plan.home_world.threats.length > 0 && (
                <>
                  <div style={sectionLabelStyle}>Threats</div>
                  <ul style={{ margin: 0, paddingLeft: 22 }}>
                    {plan.home_world.threats.map((t, i) => (
                      <li key={i} style={beatItemStyle}>{t}</li>
                    ))}
                  </ul>
                </>
              )}

              {plan.home_world.mentor_possibility && (
                <div style={{
                  marginTop: 18,
                  padding: '14px 18px',
                  background: 'var(--bg)',
                  border: '1px dashed var(--accent-2)',
                  borderLeft: '3px solid var(--accent)'
                }}>
                  <div style={{
                    fontFamily: 'var(--sans)',
                    fontSize: 10,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--accent)',
                    marginBottom: 8
                  }}>
                    Mentor possibility
                  </div>
                  <p style={{ ...beatItemStyle, marginBottom: 0 }}>
                    <span style={beatTitleStyle}>{plan.home_world.mentor_possibility.name}</span>
                    {plan.home_world.mentor_possibility.role && (
                      <span style={{ color: 'var(--accent)', marginLeft: 6, fontFamily: 'var(--sans)', fontSize: 12, letterSpacing: '0.04em' }}>
                        — {plan.home_world.mentor_possibility.role}
                      </span>
                    )}
                  </p>
                  {plan.home_world.mentor_possibility.why_they_matter && (
                    <p style={{ ...subStyle, marginTop: 8, marginBottom: 0 }}>
                      {plan.home_world.mentor_possibility.why_they_matter}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Chapters */}
          <div className="card" style={{ marginBottom: 18 }}>
            <h2 className="h-section">Chapters</h2>
            <div style={{ marginTop: 16 }}>
              {chapters.map(c => (
                <div key={c.n} style={chapterCardStyle}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 8,
                    paddingBottom: 8,
                    borderBottom: '1px solid var(--rule-soft)'
                  }}>
                    <span style={{
                      fontFamily: 'var(--sans)',
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--accent)',
                      fontWeight: 600
                    }}>
                      Chapter {c.n}
                    </span>
                    <span style={{
                      fontFamily: 'var(--serif)',
                      fontStyle: 'italic',
                      fontSize: 14,
                      color: 'var(--ink-3)'
                    }}>
                      {c.name}
                    </span>
                  </div>

                  {c.arc?.theme && (
                    <p style={{
                      fontFamily: 'var(--serif)',
                      fontStyle: 'italic',
                      fontSize: 17,
                      lineHeight: 1.5,
                      color: 'var(--ink-2)',
                      marginTop: 0,
                      marginBottom: 10
                    }}>
                      {c.arc.theme}
                    </p>
                  )}

                  {Array.isArray(c.arc?.beats) && c.arc.beats.length > 0 && (
                    <ul style={{ margin: '8px 0', paddingLeft: 22 }}>
                      {c.arc.beats.map((b, i) => (
                        <li key={i} style={beatItemStyle}>
                          {b.title && <span style={beatTitleStyle}>{b.title}. </span>}
                          {b.description}
                        </li>
                      ))}
                    </ul>
                  )}

                  {c.arc?.chapter_end_moment && (
                    <p style={{ ...subStyle, marginTop: 10, marginBottom: 0 }}>
                      <span style={{ ...beatTitleStyle, color: 'var(--ink-2)' }}>Chapter close: </span>
                      {c.arc.chapter_end_moment}
                    </p>
                  )}

                  {c.n === 4 && c.arc?.departure_seed && (() => {
                    const seed = c.arc.departure_seed
                    // v1.0.81 — new schema uses `primary_thread` + `plausible_shapes[]`
                    // (a SEED, not a verdict). Old arc plans had `reason` + `non_tragic_alternatives`
                    // — show those gracefully too.
                    const shapes = Array.isArray(seed.plausible_shapes) && seed.plausible_shapes.length > 0
                      ? seed.plausible_shapes
                      : Array.isArray(seed.non_tragic_alternatives) ? seed.non_tragic_alternatives : []
                    return (
                      <div style={{
                        marginTop: 14,
                        padding: '14px 18px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--rule)',
                        borderLeft: '3px solid var(--accent)'
                      }}>
                        <div style={{
                          fontFamily: 'var(--sans)',
                          fontSize: 10,
                          letterSpacing: '0.22em',
                          textTransform: 'uppercase',
                          color: 'var(--accent)',
                          marginBottom: 8,
                          fontWeight: 600
                        }}>
                          Departure seed
                        </div>
                        <p style={{ ...subStyle, marginTop: 0, marginBottom: 10 }}>
                          The final departure is decided at Chapter 3's theme commitment. These are plausible shapes, not a verdict.
                        </p>
                        {seed.primary_thread && (
                          <p style={{ ...beatItemStyle, marginBottom: 8 }}>
                            <span style={beatTitleStyle}>What most likely pulls them out: </span>
                            {seed.primary_thread}
                          </p>
                        )}
                        {shapes.length > 0 && (
                          <>
                            <div style={{ ...sectionLabelStyle, marginTop: 10, marginBottom: 6, color: 'var(--accent-2)' }}>
                              Plausible shapes (theme at Ch3 picks from these or overrides)
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 22 }}>
                              {shapes.map((s, i) => (
                                <li key={i} style={beatItemStyle}>{s}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        {/* Back-compat: if only the old `reason` field exists, show it as a single plausible-shape seed */}
                        {shapes.length === 0 && seed.reason && (
                          <p style={{ ...beatItemStyle, marginTop: 8, marginBottom: 0 }}>
                            <em>Legacy seed: </em>{seed.reason}
                            {seed.tone && (
                              <span style={{ color: 'var(--accent)', marginLeft: 4 }}> — {seed.tone}</span>
                            )}
                          </p>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>

          {/* Recurring threads */}
          {Array.isArray(plan.recurring_threads) && plan.recurring_threads.length > 0 && (
            <div className="card" style={{ marginBottom: 18 }}>
              <h2 className="h-section">Recurring threads</h2>
              <p className="help" style={{ marginTop: 8 }}>
                Threads that weave across chapters. Paying attention to these tends to pay off.
              </p>
              <ul style={{ margin: '14px 0 0', paddingLeft: 22 }}>
                {plan.recurring_threads.map((t, i) => (
                  <li key={i} style={beatItemStyle}>
                    <span style={beatTitleStyle}>{t.name}</span>
                    {t.description && <span style={{ color: 'var(--ink-2)' }}> — {t.description}</span>}
                    {Array.isArray(t.spans_chapters) && t.spans_chapters.length > 0 && (
                      <span style={{
                        marginLeft: 8,
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        color: 'var(--ink-3)',
                        letterSpacing: '0.04em'
                      }}>
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
            <div className="card" style={{ marginBottom: 18, background: 'var(--bg-2)' }}>
              <h2 className="h-section">Where the arc might lead</h2>
              <p className="help" style={{ marginTop: 8 }}>
                These are suggestions. Actual class, theme, and ancestry feat will emerge from what you play.
              </p>
              <p style={{ ...beatItemStyle, marginTop: 14 }}>
                Class nudge: <span style={beatTitleStyle}>{plan.character_trajectory.suggested_class || '—'}</span>
                {' · '}
                Theme nudge: <span style={beatTitleStyle}>{plan.character_trajectory.suggested_theme || '—'}</span>
              </p>
              {plan.character_trajectory.why_class && (
                <p style={{ ...subStyle, marginTop: 8 }}>
                  <span style={{ ...beatTitleStyle, color: 'var(--accent)' }}>Why class: </span>
                  {plan.character_trajectory.why_class}
                </p>
              )}
              {plan.character_trajectory.why_theme && (
                <p style={{ ...subStyle, marginTop: 6 }}>
                  <span style={{ ...beatTitleStyle, color: 'var(--accent)' }}>Why theme: </span>
                  {plan.character_trajectory.why_theme}
                </p>
              )}
              {plan.character_trajectory.notes && (
                <p style={{ ...subStyle, marginTop: 6 }}>{plan.character_trajectory.notes}</p>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                marginTop: 18,
                padding: '14px 18px',
                background: 'var(--bg-2)',
                border: '1px solid var(--accent)',
                borderLeft: '3px solid var(--accent)',
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 16,
                color: 'var(--ink-2)'
              }}
            >
              {error}
            </div>
          )}

          <div className="wizard-foot">
            <button type="button" className="btn ghost" onClick={onReturn}>← Back to characters</button>
            {plan.can_regenerate && (
              <button
                type="button"
                className="btn"
                onClick={handleReroll}
                disabled={regenerating}
                title="Use it if the arc doesn't land."
              >
                {regenerating ? 'Re-rolling…' : '↻ Re-roll'}
              </button>
            )}
            <div className="spacer" />
            <button
              type="button"
              className="btn primary lg"
              onClick={onBegin || onReturn}
              title="Opens the first session. Opus writes the opening scene; Sonnet runs the gameplay."
            >
              Begin the Prelude →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
